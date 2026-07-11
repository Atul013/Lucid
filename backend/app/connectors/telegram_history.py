"""Telegram chat-history importer (user account, MTProto via Telethon).

Companion to the bot connector in `telegram.py`, not a replacement:

  * bot.py    → live commands + briefing delivery. Only sees messages sent TO the bot.
  * this file → reads your EXISTING conversations with real people.

Both write into the same `messages` archive using the same id formula
(md5 of "telegram|chat_id|message_id"), so a message picked up by both routes
upserts onto one record instead of duplicating.

Setup is credential-based like the bot: api_id/api_hash from https://my.telegram.org
→ API development tools, pasted in the Connectors UI. Credentials and the session
live in telegram_config.json (gitignored) alongside the bot token.

NOTE: the session string is *full account access*, not a scoped bot token. Treat it
like a password — it is why telegram_config.json must never be committed.
"""

import asyncio
import hashlib
from datetime import datetime, timezone

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import (
    SessionPasswordNeededError,
    PhoneCodeInvalidError,
    PhoneCodeExpiredError,
    FloodWaitError,
)

# Same config file as the bot connector — one credential store for Telegram.
from app.connectors.telegram import _read_config, _write_config


# ── credentials ──────────────────────────────────────────────────────────────

def _api_creds() -> tuple[int, str]:
    cfg = _read_config()
    api_id, api_hash = cfg.get("api_id"), cfg.get("api_hash")
    if not api_id or not api_hash:
        raise ValueError(
            "Telegram API credentials missing. Get an api_id and api_hash from "
            "https://my.telegram.org → API development tools, then save them first."
        )
    return int(api_id), api_hash


def save_api_credentials(api_id: str, api_hash: str):
    api_id, api_hash = str(api_id).strip(), api_hash.strip()
    if not api_id.isdigit():
        raise ValueError("api_id must be numeric — check what my.telegram.org gave you.")
    if not api_hash:
        raise ValueError("api_hash is empty.")
    cfg = _read_config()
    cfg.update({"api_id": int(api_id), "api_hash": api_hash})
    _write_config(cfg)


def is_connected() -> bool:
    return _read_config().get("user_status") == "connected"


def status() -> dict:
    cfg = _read_config()
    return {
        "connected": cfg.get("user_status") == "connected",
        "pending": cfg.get("user_status") == "pending",
        "has_api_credentials": bool(cfg.get("api_id") and cfg.get("api_hash")),
        "account": cfg.get("user_account"),
        "last_sync": cfg.get("history_last_sync"),
        "synced_messages": cfg.get("history_synced", 0),
    }


# ── async plumbing ───────────────────────────────────────────────────────────

def _run(coro):
    """Telethon is async; the routers are sync. Drive it on a throwaway loop."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _client(session: str = "") -> TelegramClient:
    api_id, api_hash = _api_creds()
    client = TelegramClient(StringSession(session), api_id, api_hash)
    await client.connect()
    return client


# ── login: phone → code → (optional) 2FA password ────────────────────────────

async def _start_login(phone: str) -> dict:
    client = await _client()
    try:
        sent = await client.send_code_request(phone)
    except FloodWaitError as e:
        raise ValueError(f"Telegram is rate-limiting logins — retry in {e.seconds}s.")
    finally_session = client.session.save()
    await client.disconnect()

    cfg = _read_config()
    cfg.update({
        "user_status": "pending",
        # Persist the still-unauthorized session so verify_code can resume it.
        "user_session": finally_session,
        "pending_phone": phone,
        "pending_code_hash": sent.phone_code_hash,
    })
    _write_config(cfg)
    return {"pending": True, "needs_code": True}


def start_login(phone: str) -> dict:
    phone = phone.strip()
    if not phone.startswith("+"):
        raise ValueError("Phone must be in international format, e.g. +919876543210.")
    return _run(_start_login(phone))


async def _verify_code(code: str, password: str | None) -> dict:
    cfg = _read_config()
    if cfg.get("user_status") != "pending":
        raise ValueError("No login in progress — start with your phone number first.")

    client = await _client(cfg["user_session"])
    try:
        try:
            await client.sign_in(
                phone=cfg["pending_phone"],
                code=code,
                phone_code_hash=cfg["pending_code_hash"],
            )
        except SessionPasswordNeededError:
            if not password:
                # Keep the pending session alive so the user can retry with a password.
                cfg["user_session"] = client.session.save()
                _write_config(cfg)
                return {"pending": True, "needs_password": True}
            await client.sign_in(password=password)
        except PhoneCodeInvalidError:
            raise ValueError("That code is wrong — check the one Telegram sent you.")
        except PhoneCodeExpiredError:
            raise ValueError("That code expired. Request a new one.")

        me = await client.get_me()
        account = me.username or " ".join(
            filter(None, [me.first_name, me.last_name])
        ) or str(me.id)
        session = client.session.save()
    finally:
        await client.disconnect()

    cfg.update({"user_status": "connected", "user_session": session, "user_account": account})
    for k in ("pending_phone", "pending_code_hash"):
        cfg.pop(k, None)
    _write_config(cfg)
    return {"connected": True, "account": account}


def verify_code(code: str, password: str | None = None) -> dict:
    code = str(code).strip()
    if not code:
        raise ValueError("Login code is empty.")
    return _run(_verify_code(code, password))


def logout():
    cfg = _read_config()
    for k in ("user_status", "user_session", "user_account",
              "pending_phone", "pending_code_hash"):
        cfg.pop(k, None)
    _write_config(cfg)


# ── history import ───────────────────────────────────────────────────────────

def _record(msg, chat_id: int, chat_name: str, sender_name: str) -> dict:
    """Shape a Telethon message like the bot's _normalize does, so the two
    ingestion routes collide on id instead of double-writing the archive."""
    date = msg.date or datetime.now(timezone.utc)
    uid = hashlib.md5(f"telegram|{chat_id}|{msg.id}".encode()).hexdigest()
    return {
        "id": uid,
        "date": date.strftime("%Y-%m-%d"),
        "datetime": date.isoformat(),
        "from": "me" if msg.out else sender_name,
        "chat": chat_name,
        "chat_id": str(chat_id),
        "source": "telegram",
        "outgoing": bool(msg.out),
        "text": msg.text or msg.message or "",
    }


async def _fetch_history(chat_limit: int, per_chat: int) -> list[dict]:
    cfg = _read_config()
    if cfg.get("user_status") != "connected":
        raise ValueError("Telegram account not connected — log in with your phone first.")

    client = await _client(cfg["user_session"])
    records: list[dict] = []
    try:
        async for dialog in client.iter_dialogs(limit=chat_limit):
            chat_name = dialog.name or str(dialog.id)
            async for msg in client.iter_messages(dialog.id, limit=per_chat):
                if not (msg.text or msg.message):
                    continue  # media/service messages carry no text to embed
                sender_name = chat_name
                if not msg.out:
                    sender = await msg.get_sender()
                    if sender is not None:
                        sender_name = (
                            getattr(sender, "username", None)
                            or " ".join(filter(None, [
                                getattr(sender, "first_name", None),
                                getattr(sender, "last_name", None),
                            ]))
                            or getattr(sender, "title", None)
                            or chat_name
                        )
                records.append(_record(msg, dialog.id, chat_name, sender_name))
    except FloodWaitError as e:
        # Return what we already have rather than losing the whole run.
        if not records:
            raise ValueError(f"Telegram rate limit hit — retry in {e.seconds}s.")
    finally:
        await client.disconnect()
    return records


def fetch_history(chat_limit: int = 20, per_chat: int = 100) -> list[dict]:
    records = _run(_fetch_history(chat_limit, per_chat))
    cfg = _read_config()
    cfg["history_last_sync"] = datetime.now(timezone.utc).isoformat()
    cfg["history_synced"] = len(records)
    _write_config(cfg)
    return records

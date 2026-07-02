"""Telegram Bot API connector.

Dual role: data source (messages sent to your bot land in the archive)
and delivery channel (Lucid can push briefings/alerts to your chat).

Setup is credential-based, not OAuth: create a bot with @BotFather,
paste the token in the Connectors UI. See docs/connect/TELEGRAM_CONNECT.md.
"""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import requests

API_BASE = "https://api.telegram.org"
CONFIG_FILE = Path("telegram_config.json")  # gitignored — holds the bot token
REQUEST_TIMEOUT = 15


# ── config ───────────────────────────────────────────────────────────────────

def _read_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _write_config(cfg: dict):
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")


def is_connected() -> bool:
    return bool(_read_config().get("bot_token"))


# ── Bot API calls ────────────────────────────────────────────────────────────

def _call(method: str, token: str, **params) -> dict:
    """Call a Bot API method; raise ValueError with Telegram's own message on failure."""
    try:
        r = requests.post(f"{API_BASE}/bot{token}/{method}", json=params, timeout=REQUEST_TIMEOUT)
    except requests.RequestException as e:
        raise ValueError(f"Could not reach Telegram: {e}")
    data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if not data.get("ok"):
        raise ValueError(data.get("description", f"Telegram API error (HTTP {r.status_code})"))
    return data["result"]


def connect(bot_token: str, chat_id: str | None = None) -> dict:
    """Validate the token via getMe and persist it. Returns bot info."""
    bot_token = bot_token.strip()
    if not bot_token:
        raise ValueError("Bot token is empty.")
    try:
        me = _call("getMe", bot_token)
    except ValueError as e:
        if str(e) in ("Not Found", "Unauthorized"):
            raise ValueError(
                "Telegram rejected this token — check it matches what @BotFather sent "
                "(format: 123456789:AAF…) with no extra spaces."
            )
        raise
    cfg = _read_config()
    cfg.update({
        "bot_token": bot_token,
        "bot_username": me.get("username"),
        "bot_name": me.get("first_name"),
        "connected_at": datetime.now(timezone.utc).isoformat(),
    })
    if chat_id:
        cfg["chat_id"] = str(chat_id).strip()
    _write_config(cfg)
    return {"bot_username": me.get("username"), "bot_name": me.get("first_name")}


def disconnect():
    if CONFIG_FILE.exists():
        CONFIG_FILE.unlink()


def status() -> dict:
    cfg = _read_config()
    return {
        "connected": bool(cfg.get("bot_token")),
        "bot_username": cfg.get("bot_username"),
        "chat_id": cfg.get("chat_id"),
        "last_sync": cfg.get("last_sync"),
        "synced_messages": cfg.get("synced_messages", 0),
    }


# ── sync: pull messages sent to the bot ──────────────────────────────────────

def _normalize(msg: dict) -> dict | None:
    """Bot API message → archive record. Returns None for non-text updates."""
    text = msg.get("text") or msg.get("caption")
    if not text:
        return None
    sender = msg.get("from", {})
    chat = msg.get("chat", {})
    from_name = " ".join(filter(None, [sender.get("first_name"), sender.get("last_name")])) \
        or sender.get("username") or "unknown"
    date = datetime.fromtimestamp(msg.get("date", 0), tz=timezone.utc)
    uid = hashlib.md5(f"telegram|{chat.get('id')}|{msg.get('message_id')}".encode()).hexdigest()
    return {
        "id": uid,
        "date": date.strftime("%Y-%m-%d"),
        "datetime": date.isoformat(),
        "from": from_name,
        "chat": chat.get("title") or chat.get("first_name") or str(chat.get("id")),
        "chat_id": str(chat.get("id")),
        "source": "telegram",
        "text": text,
    }


def fetch_updates() -> list[dict]:
    """getUpdates since the last sync; remembers the chat_id of the most
    recent private chat so send_message works without manual setup."""
    cfg = _read_config()
    token = cfg.get("bot_token")
    if not token:
        raise ValueError("Telegram not connected.")
    params = {"timeout": 0, "allowed_updates": ["message"]}
    offset = cfg.get("last_update_id")
    if offset is not None:
        params["offset"] = offset + 1
    updates = _call("getUpdates", token, **params)

    messages = []
    for u in updates:
        cfg["last_update_id"] = u["update_id"]
        record = _normalize(u.get("message") or {})
        if record:
            messages.append(record)
            if (u.get("message", {}).get("chat", {}).get("type") == "private"
                    and not cfg.get("chat_id_manual")):
                cfg["chat_id"] = record["chat_id"]

    cfg["last_sync"] = datetime.now(timezone.utc).isoformat()
    cfg["synced_messages"] = cfg.get("synced_messages", 0) + len(messages)
    _write_config(cfg)
    return messages


# ── send: briefing/alert delivery ────────────────────────────────────────────

def send_message(text: str, chat_id: str | None = None) -> dict:
    cfg = _read_config()
    token = cfg.get("bot_token")
    if not token:
        raise ValueError("Telegram not connected.")
    target = chat_id or cfg.get("chat_id")
    if not target:
        raise ValueError(
            "No chat_id yet — send any message to your bot on Telegram, then Sync once."
        )
    result = _call("sendMessage", token, chat_id=target, text=text)
    return {"sent": True, "message_id": result.get("message_id"), "chat_id": str(target)}


def set_chat_id(chat_id: str):
    cfg = _read_config()
    cfg["chat_id"] = str(chat_id).strip()
    cfg["chat_id_manual"] = True
    _write_config(cfg)

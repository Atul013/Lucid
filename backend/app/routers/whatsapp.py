import os
import json
import hashlib
import logging
import secrets
import httpx
from pathlib import Path
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.connectors import chroma, llm

router = APIRouter()
log = logging.getLogger("lucid.whatsapp")

WA_SERVICE = os.getenv("WA_SERVICE_URL", "http://localhost:3001")
NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
NIM_MODEL = "minimaxai/minimax-m3"

ASK_SYSTEM = (
    "You are Lucid, a personal archive assistant answering over WhatsApp. "
    "Answer using ONLY the excerpts provided. Be concise — this is a chat "
    "message, so keep it to a few sentences. If the excerpts don't contain "
    "the answer, say so plainly; do not invent details. Plain text only: no "
    "markdown, asterisks, headers, or bullet symbols."
)


CONFIG_FILE = Path("whatsapp_config.json")  # gitignored — holds the bound owner
PAIR_TTL = timedelta(minutes=5)


def _read_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _write_config(cfg: dict):
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")


def _norm(number: str) -> str:
    return number.lstrip("+").replace(" ", "").replace("-", "")


def _owner_numbers() -> set[str]:
    """Numbers allowed to write to the archive and talk to the agent.

    Lucid's number is public — anyone can message it. Without this allowlist a
    stranger's message would be archived as if it were the owner's own life
    data, and would get an AI reply.

    Owners come from the pairing flow (a number that proved possession by
    messaging us a one-time code), plus any LUCID_OWNER_NUMBERS set in env as
    an escape hatch for local dev.
    """
    paired = {_norm(n) for n in _read_config().get("owners", [])}
    env = {_norm(n) for n in os.getenv("LUCID_OWNER_NUMBERS", "").split(",") if n.strip()}
    return paired | env


def _is_owner(number: str) -> bool:
    owners = _owner_numbers()
    if not owners:
        # Fail closed: an unconfigured allowlist must not mean "trust everyone".
        return False
    return _norm(number) in owners


# ── pairing: prove you own the number by messaging us a one-time code ────────

def _new_pair_code() -> str:
    # Unambiguous alphabet — no O/0, I/1 — because this gets typed on a phone.
    body = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(4))
    return f"LUCID-{body}"


def start_pairing() -> dict:
    cfg = _read_config()
    code = _new_pair_code()
    cfg["pairing"] = {
        "code": code,
        "expires_at": (datetime.now(timezone.utc) + PAIR_TTL).isoformat(),
    }
    _write_config(cfg)
    return {"code": code, "expires_in": int(PAIR_TTL.total_seconds())}


def _claim_if_pairing_code(number: str, text: str) -> bool:
    """If `text` is the live pairing code, bind `number` as an owner.

    This is what makes ownership verifiable: only someone holding the phone can
    send from that number, so a matching code proves possession. Beats typing a
    number into a form (unverified) or trust-on-first-use (racy).
    """
    pending = _read_config().get("pairing")
    if not pending:
        return False
    if text.strip().upper() != pending["code"]:
        return False
    if datetime.now(timezone.utc) > datetime.fromisoformat(pending["expires_at"]):
        return False

    cfg = _read_config()
    owners = set(cfg.get("owners", []))
    owners.add(_norm(number))
    cfg["owners"] = sorted(owners)
    cfg.pop("pairing", None)  # single-use
    cfg["paired_at"] = datetime.now(timezone.utc).isoformat()
    _write_config(cfg)
    log.info("WA paired: %s is now an owner", number)
    return True

WELCOME_SYSTEM = (
    "You are Lucid — a personal AI that lives in someone's archive. "
    "A new user just messaged you for the first time on WhatsApp. "
    "Write a warm, concise welcome (2-3 sentences max). "
    "Tell them their messages will be archived and understood by Lucid. "
    "Sound human and a little intelligent — not robotic or corporate. "
    "No emojis. No bullet points. Plain text only."
)

# Greetings that suggest a first-time user saying hello
_GREETING_WORDS = {"hi", "hey", "hello", "heyy", "hii", "sup", "yo", "howdy", "start"}


def _looks_like_greeting(text: str) -> bool:
    """True for a bare "hey" but also for the openers our own wa.me link
    prefills ("Hey Lucid, connect me!"), which an exact match would miss.
    Only the first word counts, so "hey, remind me to call mum" still archives."""
    words = text.strip().lower().rstrip("!?. ").replace(",", " ").split()
    if not words:
        return False
    if words[0] not in _GREETING_WORDS:
        return False
    # A greeting plus a real request is a request, not a hello.
    return len(words) <= 5


async def _nim_reply(sender: str) -> str:
    api_key = os.getenv("NVIDIA_API_KEY", "")
    if not api_key:
        return "Hey — you're connected to Lucid. Your messages will be archived and understood."
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                NIM_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": NIM_MODEL,
                    "messages": [
                        {"role": "system", "content": WELCOME_SYSTEM},
                        {"role": "user", "content": f"The user's name is {sender}. Write the welcome."},
                    ],
                    "max_tokens": 120,
                    "temperature": 0.85,
                },
            )
        data = r.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return "Hey — you're connected to Lucid. Your messages will be archived and understood."


async def _send_wa(to: str, message: str):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{WA_SERVICE}/send",
                json={"to": to, "message": message},
            )
        if not r.is_success:
            log.warning("WA reply to %s rejected by bridge: %s", to, r.text)
    except Exception as e:
        # A failed reply must not fail ingest — but it must not be silent either.
        log.warning("WA reply to %s failed: %s", to, e)


def _answer_from_archive(question: str) -> str:
    """Answer a question over the chat archive + email, like /archive/ask does
    but across messages too — WhatsApp questions are usually about conversations."""
    hits = chroma.search_messages(question, n_results=5) + chroma.search_emails(question, n_results=3)
    if not hits:
        return "Your archive is empty — connect a source and sync first."

    context = "\n\n---\n\n".join(
        f"From: {h.get('from', '?')}\nDate: {h.get('date', '?')}\n{h.get('text', '')}"
        for h in hits
    )
    return llm.chat(
        [
            {"role": "system", "content": ASK_SYSTEM},
            {"role": "user", "content": f"Excerpts:\n\n{context}\n\nQuestion: {question}"},
        ],
        max_tokens=300,
    )


class OutboundMessage(BaseModel):
    to: str
    message: str


@router.post("/whatsapp/ingest")
async def ingest_message(raw: dict):
    """Handle an incoming WhatsApp message from the Node bridge.

    Mirrors the Telegram bot: slash commands run against the todo list,
    questions are answered from the archive, everything else is saved.
    Records share the Telegram record shape, so every chat source lands in one
    `messages` collection that Archive/Ego/sentiment read uniformly.
    """
    sender = raw.get("from") or raw.get("from_name") or raw.get("number", "unknown")
    body = raw.get("body", "")
    ts = raw.get("timestamp", int(datetime.now(timezone.utc).timestamp()))
    number = raw.get("number", "")

    if not body.strip():
        return {"ok": True, "skipped": True}

    # Lucid's number is public. Only the owner may write to the archive or
    # reach the agent — strangers are dropped silently, with no reply, so the
    # bot can't be used as a free LLM or to poison the archive.
    # Pairing is checked before the allowlist — it's how a number *becomes* an
    # owner in the first place.
    if _claim_if_pairing_code(number, body):
        await _send_wa(
            number,
            "Linked. 🌘 This number now owns your Lucid archive.\n\n"
            "Send me a thought and I'll file it, ask a question and I'll answer "
            "from your archive, or try /help for commands.",
        )
        return {"ok": True, "handled": "paired"}

    if not _is_owner(number):
        log.warning(
            "WA message from %r ignored — not a paired owner %s",
            number, sorted(_owner_numbers()) or "(none)",
        )
        return {"ok": True, "ignored": "not_owner"}

    log.info("WA message from owner %s: %r", number, body[:60])

    text = body.strip()

    if text.startswith("/"):
        # Same todo commands as the Telegram bot — one shared list.
        from app.connectors.telegram import _handle_command
        await _send_wa(number, _handle_command(text))
        return {"ok": True, "handled": "command"}

    if _looks_like_greeting(text):
        await _send_wa(number, await _nim_reply(sender))
        return {"ok": True, "handled": "greeting"}

    date = datetime.fromtimestamp(ts, tz=timezone.utc)
    # Stable id → replaying the same message upserts instead of duplicating.
    uid = hashlib.md5(f"whatsapp|{number}|{ts}".encode()).hexdigest()
    ingested = chroma.ingest_messages([{
        "id": uid,
        "date": date.strftime("%Y-%m-%d"),
        "datetime": date.isoformat(),
        "from": sender,
        "chat": sender,
        "chat_id": number,
        "source": "whatsapp",
        "outgoing": False,
        "text": text,
    }])

    # A question is a request, not a diary entry — answer it from the archive.
    if text.endswith("?"):
        await _send_wa(number, _answer_from_archive(text))
        return {"ok": True, "ingested": ingested, "handled": "question"}

    await _send_wa(number, "Saved to your archive. 📥  (/help for commands)")
    return {"ok": True, "ingested": ingested, "handled": "archived"}


@router.post("/whatsapp/send")
async def send_message(msg: OutboundMessage):
    """Send a WhatsApp message via the Node bridge."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{WA_SERVICE}/send",
                json={"to": msg.to, "message": msg.message},
            )
        if not r.is_success:
            raise HTTPException(status_code=502, detail=r.text)
        return r.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="WhatsApp bridge not running — start backend/whatsapp_service/index.js",
        )


@router.get("/whatsapp/status")
async def wa_status():
    """Two independent things:

    `ready`  — the Lucid service itself is linked to WhatsApp (operator setup,
               done once by whoever holds the business SIM).
    `paired` — this user has proved ownership of their number (the user's own
               connect step). Both must be true for WhatsApp to actually work.
    """
    paired = bool(_owner_numbers())
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{WA_SERVICE}/health")
        return {**r.json(), "paired": paired, "owners_configured": paired}
    except httpx.ConnectError:
        return {
            "status": "offline",
            "ready": False,
            "paired": paired,
            "owners_configured": paired,
        }


@router.post("/whatsapp/pair/start")
async def wa_pair_start():
    """Mint a one-time code. The user messages it to Lucid from the phone they
    want to own the archive; receiving it proves they hold that number."""
    return start_pairing()


@router.get("/whatsapp/pair/status")
async def wa_pair_status():
    cfg = _read_config()
    pending = cfg.get("pairing")
    expired = bool(
        pending and datetime.now(timezone.utc) > datetime.fromisoformat(pending["expires_at"])
    )
    return {
        "owners": sorted(_owner_numbers()),
        "paired": bool(_owner_numbers()),
        "code": None if (not pending or expired) else pending["code"],
        "expired": expired,
    }


@router.delete("/whatsapp/pair")
async def wa_unpair():
    """Unbind every paired number. Env-configured owners are unaffected."""
    cfg = _read_config()
    cfg["owners"] = []
    cfg.pop("pairing", None)
    _write_config(cfg)
    return {"paired": bool(_owner_numbers())}


@router.get("/whatsapp/qr")
async def wa_qr():
    """The live pairing QR, as a data-URL, so /connectors can show it in the
    browser. Null once the account is linked. WhatsApp rotates it every ~20s."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{WA_SERVICE}/qr")
        return r.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="WhatsApp bridge not running — start backend/whatsapp_service (npm start).",
        )

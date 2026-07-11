import os
import hashlib
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.connectors import chroma, llm

router = APIRouter()

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


def _owner_numbers() -> set[str]:
    """Numbers allowed to write to the archive and talk to the agent.

    Lucid's business number is public — anyone can message it. Without this
    allowlist a stranger's message would be archived as if it were the owner's
    own life data, and would get an AI reply. Configure LUCID_OWNER_NUMBERS
    (comma-separated, country code, no +) to your own number(s).
    """
    raw = os.getenv("LUCID_OWNER_NUMBERS", "")
    return {n.strip().lstrip("+").replace(" ", "") for n in raw.split(",") if n.strip()}


def _is_owner(number: str) -> bool:
    owners = _owner_numbers()
    if not owners:
        # Fail closed: an unconfigured allowlist must not mean "trust everyone".
        return False
    return number.lstrip("+").replace(" ", "") in owners

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
    return text.strip().lower().rstrip("!. ") in _GREETING_WORDS


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
            await client.post(
                f"{WA_SERVICE}/send",
                json={"to": to, "message": message},
            )
    except Exception:
        pass  # don't fail ingest if reply fails


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
    if not _is_owner(number):
        return {"ok": True, "ignored": "not_owner"}

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
    """Check if the Node bridge is up and WhatsApp is linked."""
    owners_configured = bool(_owner_numbers())
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{WA_SERVICE}/health")
        return {**r.json(), "owners_configured": owners_configured}
    except httpx.ConnectError:
        return {"status": "offline", "ready": False, "owners_configured": owners_configured}


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

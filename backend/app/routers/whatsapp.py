import os
import hashlib
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.connectors import chroma

router = APIRouter()

WA_SERVICE = os.getenv("WA_SERVICE_URL", "http://localhost:3001")
NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
NIM_MODEL = "minimaxai/minimax-m3"

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


class OutboundMessage(BaseModel):
    to: str
    message: str


@router.post("/whatsapp/ingest")
async def ingest_message(raw: dict):
    """Receive an incoming WhatsApp message from the Node bridge and archive it.

    Records use the same shape as the Telegram connector so every chat source
    lands in one `messages` collection that Archive/Ego/sentiment read uniformly.
    """
    sender = raw.get("from") or raw.get("from_name") or raw.get("number", "unknown")
    body = raw.get("body", "")
    ts = raw.get("timestamp", int(datetime.now(timezone.utc).timestamp()))
    number = raw.get("number", "")

    if not body.strip():
        return {"ok": True, "skipped": True}

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
        "text": body,
    }])

    # Auto-reply with an AI welcome when someone says hello.
    if _looks_like_greeting(body):
        reply = await _nim_reply(sender)
        await _send_wa(number, reply)

    return {"ok": True, "ingested": ingested}


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
    """Check if the Node bridge is up and WhatsApp is connected."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{WA_SERVICE}/health")
        return r.json()
    except httpx.ConnectError:
        return {"status": "offline", "ready": False}

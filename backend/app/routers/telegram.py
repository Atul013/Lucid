from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.connectors import chroma
from app.connectors import telegram as telegram_connector

router = APIRouter(prefix="/telegram")


class ConnectBody(BaseModel):
    bot_token: str
    chat_id: str | None = None


class SendBody(BaseModel):
    text: str
    chat_id: str | None = None


class ChatIdBody(BaseModel):
    chat_id: str


@router.post("/connect")
def connect(body: ConnectBody):
    """Validate a BotFather token and save it. See docs/connect/TELEGRAM_CONNECT.md."""
    try:
        info = telegram_connector.connect(body.bot_token, body.chat_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    telegram_connector.start_poller()
    return {"connected": True, **info}


@router.get("/status")
def status():
    return telegram_connector.status()


@router.post("/sync")
def sync():
    """Pull new messages into the archive. When the live bot is polling it
    already archives everything in real time, so sync just reports that."""
    if telegram_connector.poller_running():
        s = telegram_connector.status()
        return {"live": True, "fetched": 0, "ingested": 0,
                "total_archived": s["synced_messages"]}
    try:
        messages = telegram_connector.fetch_updates()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    ingested = chroma.ingest_messages(messages)
    return {"live": False, "fetched": len(messages), "ingested": ingested}


@router.post("/send")
def send(body: SendBody):
    """Push a message to your chat — used for briefings and drift alerts."""
    try:
        return telegram_connector.send_message(body.text, body.chat_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/chat-id")
def set_chat_id(body: ChatIdBody):
    """Manually pin the chat_id used for outgoing messages."""
    if not telegram_connector.is_connected():
        raise HTTPException(status_code=400, detail="Telegram not connected.")
    telegram_connector.set_chat_id(body.chat_id)
    return telegram_connector.status()


@router.delete("/disconnect")
def disconnect():
    telegram_connector.stop_poller()
    telegram_connector.disconnect()
    return {"connected": False}


@router.get("/search")
def search(q: str, n: int = 10):
    return {"results": chroma.search_messages(q, n)}

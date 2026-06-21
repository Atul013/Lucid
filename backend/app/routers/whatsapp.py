import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.connectors import chroma

router = APIRouter()

WA_SERVICE = "http://localhost:3001"


class InboundMessage(BaseModel):
    from_name: str = ""
    number: str
    body: str
    timestamp: int
    type: str = "whatsapp"

    model_config = {"populate_by_name": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        # rename 'from' key (reserved word) before validation
        if isinstance(obj, dict) and "from" in obj:
            obj = {**obj, "from_name": obj.pop("from")}
        return super().model_validate(obj, **kwargs)


class OutboundMessage(BaseModel):
    to: str
    message: str


@router.post("/whatsapp/ingest")
async def ingest_message(raw: dict):
    """Receive an incoming WhatsApp message from the Node bridge and store it."""
    sender = raw.get("from") or raw.get("from_name") or raw.get("number", "unknown")
    body = raw.get("body", "")
    ts = raw.get("timestamp", int(datetime.now(timezone.utc).timestamp()))
    number = raw.get("number", "")

    if not body.strip():
        return {"ok": True, "skipped": True}

    dt = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="seconds")

    chroma.add_document(
        doc_id=f"wa_{number}_{ts}",
        content=body,
        metadata={
            "source": "whatsapp",
            "from": sender,
            "number": number,
            "date": dt,
        },
    )
    return {"ok": True}


@router.post("/whatsapp/send")
async def send_message(msg: OutboundMessage):
    """Send a WhatsApp message via the Node bridge."""
    import httpx

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
    import httpx

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{WA_SERVICE}/health")
        return r.json()
    except httpx.ConnectError:
        return {"status": "offline", "ready": False}

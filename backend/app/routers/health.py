from pathlib import Path
from fastapi import APIRouter, HTTPException
from app import crypto_store
from app.connectors import chroma
from app.connectors import health as health_connector

router = APIRouter(prefix="/health-data")

TIMELINE_CACHE = Path("timeline.json")


@router.post("/seed")
def seed():
    """Load the bundled 3-month mock smartwatch export (Maya Chen)."""
    records = health_connector.load_mock_statement()
    ingested = chroma.ingest_health(records)
    return {"parsed": len(records), "ingested": ingested}


@router.post("/upload")
def upload(payload: dict | list):
    """Ingest a smartwatch export: {"records": [...]} or a bare list of days."""
    try:
        records = health_connector.parse_records(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not records:
        raise HTTPException(status_code=400, detail="No usable daily records found.")
    ingested = chroma.ingest_health(records)
    return {"parsed": len(records), "ingested": ingested}


@router.get("/summary")
def summary():
    records = chroma.all_health()
    if not records:
        raise HTTPException(status_code=400, detail="No health data — seed or upload first.")
    return health_connector.summarize(records)


@router.get("/search")
def search(q: str, n: int = 10):
    return {"results": chroma.search_health(q, n)}


@router.get("/correlation")
def correlation():
    """Correlate daily health metrics with the emotion timeline (if built)."""
    records = chroma.all_health()
    if not records:
        raise HTTPException(status_code=400, detail="No health data — seed or upload first.")
    timeline = crypto_store.read_json(TIMELINE_CACHE, None)
    if timeline is None:
        raise HTTPException(
            status_code=400,
            detail="Emotion timeline not built yet — POST /ego/timeline/build first.",
        )
    days = timeline.get("days", [])
    sentiment = {
        d["date"]: float(d["score"])
        for d in days
        if d.get("date") and d.get("score") is not None
    }
    return health_connector.correlate_with_sentiment(records, sentiment)

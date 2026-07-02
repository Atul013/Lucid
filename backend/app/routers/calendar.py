from fastapi import APIRouter, HTTPException
from app.connectors import chroma, gmail
from app.connectors import calendar as calendar_connector

router = APIRouter(prefix="/calendar")


@router.post("/seed")
def seed():
    """Load the bundled 3-month mock calendar (Maya Chen)."""
    events = calendar_connector.load_mock_events()
    ingested = chroma.ingest_events(events)
    return {"parsed": len(events), "ingested": ingested}


@router.get("/sync")
def sync(max_results: int = 250):
    """Pull real events via the Google Calendar API (needs Google connected
    with the calendar.readonly scope — reconnect if authorized before it
    was added)."""
    if not gmail.is_connected():
        raise HTTPException(status_code=401, detail="Google not connected")
    try:
        events = calendar_connector.fetch_events(max_results)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Calendar API error: {e}")
    ingested = chroma.ingest_events(events)
    return {"fetched": len(events), "ingested": ingested}


@router.get("/summary")
def summary():
    """Meeting-load analysis: weekly workload series, overload weeks,
    after-hours creep — the Digital Twin's workload history."""
    events = chroma.all_events()
    if not events:
        raise HTTPException(status_code=400, detail="No calendar data — seed or sync first.")
    return calendar_connector.summarize(events)


@router.get("/search")
def search(q: str, n: int = 10):
    return {"results": chroma.search_events(q, n)}

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.connectors import snn

router = APIRouter(prefix="/snn")


class ScanBody(BaseModel):
    wake: bool = False


@router.get("/status")
def status():
    last = snn.last_report()
    return {
        "last_scan": last["ran_at"] if last else None,
        "days": last["days"] if last else 0,
        "trips": len(last["trips"]) if last else 0,
        "fresh_trips": len(last["fresh_trips"]) if last else 0,
        "params": last["params"] if last else None,
    }


@router.post("/scan")
def scan(body: ScanBody):
    """Replay the LIF layer over everything in the archive. With wake=true,
    a trip within the last few days launches an agent run."""
    report = snn.scan(wake=body.wake)
    if not report["days"]:
        raise HTTPException(status_code=400, detail="No timestamped data — seed some connectors first.")
    return report


@router.get("/report")
def report():
    last = snn.last_report()
    if last is None:
        raise HTTPException(status_code=404, detail="No scan yet.")
    return last

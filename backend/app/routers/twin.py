from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.connectors import chroma, twin

router = APIRouter(prefix="/twin")


class SimulateBody(BaseModel):
    extra_meeting_hours: float = 0.0
    sleep_delta_hours: float = 0.0


@router.get("/status")
def status():
    """Data availability + model state — what the Twin has to work with."""
    health = chroma.all_health()
    events = chroma.all_events()
    out = {
        "health_days": len(health),
        "calendar_events": len(events),
        "trained": False,
    }
    try:
        model = twin.train()
        out.update(
            trained=True,
            backend=model["backend"],
            days=model["days"],
            stressed_days=model["stressed_days"],
            train_accuracy=model["train_accuracy"],
            window={"from": model["from"], "to": model["to"]},
            baseline=model["baseline"],
        )
    except ValueError as e:
        out["detail"] = str(e)
    return out


@router.post("/train")
def retrain():
    """Refit after new calendar/health data lands."""
    try:
        model = twin.train(retrain=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "backend": model["backend"],
        "days": model["days"],
        "train_accuracy": model["train_accuracy"],
    }


@router.post("/simulate")
def simulate(body: SimulateBody):
    """What-if: shift weekly meeting hours and nightly sleep, get the
    change in daily high-stress probability."""
    try:
        return twin.simulate_workload(body.extra_meeting_hours, body.sleep_delta_hours)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/scenarios")
def scenarios():
    """Risk curves across meeting loads (at current sleep and +1h sleep)
    for the frontend chart."""
    try:
        return twin.scenario_grid()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.connectors import agent

router = APIRouter(prefix="/agent")


class RunBody(BaseModel):
    goal: str | None = None


@router.get("/status")
def status():
    last = agent.last_report()
    return {
        "mode": "live" if os.getenv("NVIDIA_API_KEY") else "mock",
        "running": agent.running(),
        "last_run": last["ran_at"] if last else None,
        "last_actions": len(last["actions"]) if last else 0,
        "steps_done": len(last["steps"]) if last else 0,
    }


@router.post("/run")
def run(body: RunBody):
    """Start one agent run in the background: it investigates (twin,
    calendar, health, archive), then acts — drafts, calendar proposals,
    todos, Telegram wrap-up. Poll /agent/status; read /agent/report when
    running goes false. Live LLM runs can take a few minutes."""
    if not agent.run_async(body.goal):
        raise HTTPException(status_code=409, detail="A run is already in progress.")
    return {"started": True}


@router.get("/report")
def report():
    last = agent.last_report()
    if last is None:
        raise HTTPException(status_code=404, detail="No agent run yet.")
    return last

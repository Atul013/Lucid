import json
from pathlib import Path
from datetime import date
from fastapi import APIRouter, HTTPException
from app.connectors import agent, chroma, llm, twin

router = APIRouter()

CACHE = Path("briefing.json")
EGO = Path("ego_insights.json")
GOALS = Path("goals.json")

SYSTEM = (
    "You are Lucid, writing a brief, warm morning briefing for the person whose "
    "archive you live in. Use the signals provided — recent inbox activity, "
    "their known themes, and their goals. Greet them, tell them what's "
    "demanding attention right now, flag anything time-sensitive, and end with "
    "one gentle nudge toward a goal. 120-180 words, plain prose, second person, "
    "no markdown, no lists."
)


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def _twin_snapshot() -> dict | None:
    """Current stress forecast, or None if there isn't enough joined
    calendar/health data to train on yet (twin.train() raises ValueError)."""
    try:
        model = twin.train()
        now = twin.simulate_workload(0, 0)
    except ValueError:
        return None
    return {
        "current_risk": now["current_risk"],
        "current_level": now["current_level"],
        "days_trained": model["days"],
    }


def _agent_snapshot() -> dict | None:
    """Latest autonomous agent run, or None if it hasn't run yet."""
    last = agent.last_report()
    if last is None:
        return None
    return {
        "ran_at": last.get("ran_at"),
        "summary": last.get("summary", ""),
        "action_count": len(last.get("actions", [])),
    }


@router.get("/briefing")
def get_briefing():
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    return {"generated": False}


@router.post("/briefing/build")
def build_briefing():
    emails = chroma.sample(limit=40)
    if not emails:
        raise HTTPException(status_code=400, detail="Archive is empty — sync first.")

    ego = _read(EGO)
    goals = _read(GOALS).get("goals", [])
    twin_snapshot = _twin_snapshot()
    agent_snapshot = _agent_snapshot()

    recent = "\n".join(f"- From {e['from']}: {e['subject']}" for e in emails)
    themes = "; ".join(t.get("title", "") for t in ego.get("themes", []))
    signals = (
        f"Recent inbox ({len(emails)} emails):\n{recent}\n\n"
        f"Known themes: {themes or 'none yet'}\n"
        f"Goals: {', '.join(goals) or 'none set'}"
    )
    if twin_snapshot:
        signals += (
            f"\nStress forecast: {twin_snapshot['current_level']} risk "
            f"({twin_snapshot['current_risk']:.0%})"
        )
    if agent_snapshot and agent_snapshot["summary"]:
        signals += f"\nLast agent run: {agent_snapshot['summary'][:200]}"

    text = llm.chat(
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": signals},
        ],
        max_tokens=500,
        temperature=0.7,
    )

    result = {
        "generated": True,
        "date": date.today().isoformat(),
        "briefing": text,
        "twin": twin_snapshot,
        "agent": agent_snapshot,
    }
    CACHE.write_text(json.dumps(result), encoding="utf-8")
    return result

import json
from pathlib import Path
from datetime import date
from fastapi import APIRouter, HTTPException
from app.connectors import chroma, llm

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

    recent = "\n".join(f"- From {e['from']}: {e['subject']}" for e in emails)
    themes = "; ".join(t.get("title", "") for t in ego.get("themes", []))
    signals = (
        f"Recent inbox ({len(emails)} emails):\n{recent}\n\n"
        f"Known themes: {themes or 'none yet'}\n"
        f"Goals: {', '.join(goals) or 'none set'}"
    )

    text = llm.chat(
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": signals},
        ],
        max_tokens=500,
        temperature=0.7,
    )

    result = {"generated": True, "date": date.today().isoformat(), "briefing": text}
    CACHE.write_text(json.dumps(result), encoding="utf-8")
    return result

import json
import re
from collections import defaultdict
from email.utils import parsedate_to_datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app import crypto_store
from app.connectors import chroma, llm

router = APIRouter()

CACHE = Path("timeline.json")

SYSTEM = (
    "You read the emotional tone of someone's inbox day by day. For each day "
    "given (with that day's email subjects), assign a sentiment score from "
    "-1.0 (heavy, stressful, negative) to 1.0 (light, positive, exciting), and "
    "a single-word mood. Judge the felt texture, not just the topics. "
    'Respond ONLY with strict JSON: {"days": [{"date": "YYYY-MM-DD", '
    '"score": -1.0..1.0, "mood": "one word"}]}. '
    "No markdown, no text outside the JSON."
)


def _day(date_str: str) -> str | None:
    try:
        return parsedate_to_datetime(date_str).date().isoformat()
    except (TypeError, ValueError):
        return None


def _extract_json(s: str) -> dict:
    s = re.sub(r"^```(?:json)?|```$", "", s.strip(), flags=re.MULTILINE).strip()
    a, b = s.find("{"), s.rfind("}")
    if a != -1 and b != -1:
        s = s[a : b + 1]
    return json.loads(s)


@router.get("/ego/timeline")
def get_timeline():
    return crypto_store.read_json(CACHE, {"generated": False, "days": []})


@router.post("/ego/timeline/build")
def build_timeline():
    emails = chroma.sample(limit=200)
    if not emails:
        raise HTTPException(status_code=400, detail="Archive is empty — sync first.")

    by_day: dict[str, list[str]] = defaultdict(list)
    for e in emails:
        d = _day(e.get("date", ""))
        if d:
            by_day[d].append(e["subject"])

    if not by_day:
        raise HTTPException(status_code=400, detail="No dated emails to chart.")

    counts = {d: len(s) for d, s in by_day.items()}
    digest = "\n\n".join(
        f"{d} ({len(subs)} emails):\n" + "\n".join(f"  - {s}" for s in subs[:12])
        for d, subs in sorted(by_day.items())
    )
    raw = llm.chat(
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Days:\n\n{digest}"},
        ],
        max_tokens=1200,
        temperature=0.5,
    )
    try:
        days = _extract_json(raw).get("days", [])
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=502, detail="Could not read the timeline — try again.")

    for d in days:
        d["count"] = counts.get(d.get("date", ""), 0)
    days.sort(key=lambda d: d.get("date", ""))

    result = {"generated": True, "days": days}
    crypto_store.write_json(CACHE, result)
    return result

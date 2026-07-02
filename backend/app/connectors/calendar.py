"""Google Calendar connector — event ingestion and workload analysis.

Mock-first, same shape as the finance/health connectors: real mode pulls
events through the Google Calendar API reusing the Gmail OAuth credentials
(needs the calendar.readonly scope — re-connect Google after deploying);
mock mode loads a bundled 3-month event export.

The summary's weekly workload series is the Digital Twin's training input:
Phase 2's simulate_workload() reads meeting-hours-per-week from here.
"""
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

MOCK_EVENTS = Path(__file__).resolve().parents[2] / "mock_data" / "calendar_events.json"

EVENING_HOUR = 18  # meetings starting at/after this count as after-hours


def _iso(value) -> str:
    """Start/end from either our mock shape (ISO string) or the Google API
    shape ({"dateTime": ...} or {"date": ...} for all-day)."""
    if isinstance(value, dict):
        return value.get("dateTime") or value.get("date") or ""
    return str(value or "")


def _parse_dt(iso: str) -> datetime | None:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def parse_events(raw: dict | list) -> list[dict]:
    """Normalize a calendar export / API response into flat event records."""
    items = raw.get("events", raw.get("items", raw)) if isinstance(raw, dict) else raw
    if not isinstance(items, list):
        raise ValueError("Expected a list of events or {'events': [...]}")

    events = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = item.get("summary") or item.get("title") or ""
        start = _parse_dt(_iso(item.get("start")))
        if not title or not start:
            continue
        end = _parse_dt(_iso(item.get("end")))
        duration = int((end - start).total_seconds() / 60) if end else 0

        attendees = item.get("attendees", 0)
        if isinstance(attendees, list):  # Google API shape
            attendees = len(attendees)
        organizer = item.get("organizer", "")
        if isinstance(organizer, dict):
            organizer = organizer.get("email", "")

        event = {
            "id": item.get("id") or hashlib.md5(f"{start.isoformat()}|{title}".encode()).hexdigest()[:16],
            "title": title,
            "date": start.date().isoformat(),
            "start": start.isoformat(),
            "duration_minutes": max(0, duration),
            "attendees": int(attendees or 0),
            "location": str(item.get("location", "")),
            "organizer": str(organizer),
        }
        event["text"] = (
            f"{event['date']} {start.strftime('%H:%M')}: {title} "
            f"({event['duration_minutes']}min, {event['attendees']} attendees"
            + (f", {event['location']}" if event["location"] else "") + ")"
        )
        events.append(event)

    events.sort(key=lambda e: e["start"])
    return events


def load_mock_events() -> list[dict]:
    return parse_events(json.loads(MOCK_EVENTS.read_text(encoding="utf-8")))


def fetch_events(max_results: int = 250) -> list[dict]:
    """Real mode: pull events via the Google Calendar API (Gmail OAuth creds)."""
    from googleapiclient.discovery import build
    from app.connectors import gmail

    service = build("calendar", "v3", credentials=gmail.load_creds())
    result = service.events().list(
        calendarId="primary",
        maxResults=max_results,
        singleEvents=True,
        orderBy="startTime",
    ).execute()
    return parse_events(result.get("items", []))


def _week(event: dict) -> str:
    year, week, _ = datetime.fromisoformat(event["start"]).isocalendar()
    return f"{year}-W{week:02d}"


def summarize(events: list[dict]) -> dict:
    """Meeting load over time — the Twin's workload history."""
    if not events:
        return {"events": 0}
    events = sorted(events, key=lambda e: e["start"])

    minutes_by_week: dict[str, int] = defaultdict(int)
    count_by_week: dict[str, int] = defaultdict(int)
    minutes_by_day: dict[str, int] = defaultdict(int)
    evening = 0
    titles = Counter()
    for e in events:
        minutes_by_week[_week(e)] += e["duration_minutes"]
        count_by_week[_week(e)] += 1
        minutes_by_day[e["date"]] += e["duration_minutes"]
        if datetime.fromisoformat(e["start"]).hour >= EVENING_HOUR and e["attendees"] > 2:
            evening += 1
        titles[e["title"]] += 1

    weekly = [
        {"week": w, "meeting_hours": round(m / 60, 1), "meetings": count_by_week[w]}
        for w, m in sorted(minutes_by_week.items())
    ]
    hours = sorted(w["meeting_hours"] for w in weekly)
    median = hours[len(hours) // 2]
    overload = [w for w in weekly if median > 0 and w["meeting_hours"] > median * 1.3]
    busiest = max(minutes_by_day.items(), key=lambda kv: kv[1])

    return {
        "events": len(events),
        "from": events[0]["date"],
        "to": events[-1]["date"],
        "total_meeting_hours": round(sum(e["duration_minutes"] for e in events) / 60, 1),
        "median_weekly_hours": median,
        "weekly_workload": weekly,
        "overload_weeks": overload,
        "busiest_day": {"date": busiest[0], "meeting_hours": round(busiest[1] / 60, 1)},
        "after_hours_meetings": evening,
        "top_recurring": [
            {"title": t, "count": c} for t, c in titles.most_common(5) if c >= 3
        ],
    }

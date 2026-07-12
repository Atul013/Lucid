"""SNN tripwire (Phase 3) — a spiking sentinel over temporal metadata.

A layer of leaky integrate-and-fire (LIF) neurons watches the *rhythm* of the
user's life — email volume, meeting load, late-night activity, spending,
stress, and communication silence — one neuron per stream. Each day, a
neuron's input current is how far that day sits above its trailing baseline
(a clipped z-score); the membrane potential leaks between days, so a single
odd day decays away but a sustained anomaly accumulates until the neuron
fires. A fired neuron is the tripwire: cheap, always-on, no LLM involved —
and a *fresh* trip is what wakes the expensive agent loop.

Pure Python by design (per ROADMAP: prove the trigger before adopting
Norse/torch) — the whole net is a few hundred floats, no new dependencies,
and it will run unchanged on the Pi Zero.
"""
import math
import threading
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

from app import crypto_store
from app.connectors import chroma

REPORT_FILE = Path("snn_report.json")
_lock = threading.Lock()

# ── LIF parameters ───────────────────────────────────────────────────────────
DECAY = 0.6              # membrane leak per day: V <- V*DECAY + I
THRESHOLD = 4.0          # fire when V crosses this
REFRACTORY_DAYS = 2      # ignore input right after a spike
BASELINE_WINDOW = 21     # trailing days that define "normal"
MIN_BASELINE_DAYS = 5    # need at least this much history before judging
# Cap the daily input BELOW threshold: a single wild day can never fire the
# wire on its own — only a sustained anomaly accumulates past it (2+ days).
CURRENT_CAP = 3.5
LATE_START, LATE_END = 22, 6   # late-night window (hours)
FRESH_TRIP_DAYS = 3      # a trip this recent counts as "now" → wake the agent
MAX_LOOKBACK_DAYS = 400  # ignore timestamps outside the recent past (a real
                         # calendar sync brings in recurring events expanded
                         # decades out — rhythm only means anything recently)


def _parse_dt(value: str) -> datetime | None:
    """Timestamps arrive in two shapes: RFC-2822 (emails) and ISO (rest)."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        pass
    try:
        return parsedate_to_datetime(str(value))
    except (TypeError, ValueError):
        return None


# ── encode: archive → daily activity streams ─────────────────────────────────

def build_streams() -> dict:
    """Daily value series per stream over the union date range."""
    emails = chroma.all_emails()
    events = chroma.all_events()
    messages = chroma.all_messages()
    txns = chroma.all_transactions()
    health = chroma.all_health()

    email_dt = [d for e in emails if (d := _parse_dt(e.get("date", "")))]
    msg_dt = [d for m in messages if (d := _parse_dt(m.get("datetime", m.get("date", ""))))]

    days: dict[str, dict[str, float]] = {}
    today = datetime.now(timezone.utc).date()
    lo_bound = (today - timedelta(days=MAX_LOOKBACK_DAYS)).isoformat()
    hi_bound = (today + timedelta(days=1)).isoformat()

    def bump(day: str, stream: str, amount: float = 1.0):
        if not (lo_bound <= day <= hi_bound):
            return
        days.setdefault(day, {})[stream] = days.get(day, {}).get(stream, 0.0) + amount

    for dt in email_dt:
        bump(dt.date().isoformat(), "email_volume")
        if dt.hour >= LATE_START or dt.hour < LATE_END:
            bump(dt.date().isoformat(), "late_night")
    for dt in msg_dt:
        bump(dt.date().isoformat(), "email_volume")  # communications, broadly
        if dt.hour >= LATE_START or dt.hour < LATE_END:
            bump(dt.date().isoformat(), "late_night")
    for e in events:
        bump(e["date"], "meeting_load", e.get("duration_minutes", 0) / 60)
    for t in txns:
        if str(t.get("type", "")).lower() != "credit":
            bump(str(t.get("date", ""))[:10], "spending", abs(float(t.get("amount", 0))))
    for r in health:
        bump(r["date"], "stress", float(r.get("stress_score", 0)))

    all_days = sorted(d for d in days if d)
    if not all_days:
        return {"dates": [], "streams": {}}
    start = date.fromisoformat(all_days[0])
    end = date.fromisoformat(all_days[-1])
    dates = [(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)]

    streams = {
        name: [days.get(d, {}).get(name, 0.0) for d in dates]
        for name in ("email_volume", "meeting_load", "late_night", "spending", "stress")
    }
    return {"dates": dates, "streams": streams}


# ── the LIF layer ────────────────────────────────────────────────────────────

def _global_std(values: list[float]) -> float:
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    return math.sqrt(sum((x - mean) ** 2 for x in values) / len(values))


def _trailing_z(values: list[float], t: int, gstd: float) -> float | None:
    """z-score of values[t] against the trailing BASELINE_WINDOW days.

    The std is floored by a fraction of the stream's overall spread so an
    all-zero quiet stretch can't make one ordinary day look astronomical.
    """
    lo = max(0, t - BASELINE_WINDOW)
    window = values[lo:t]
    if len(window) < MIN_BASELINE_DAYS:
        return None
    mean = sum(window) / len(window)
    var = sum((x - mean) ** 2 for x in window) / len(window)
    std = max(math.sqrt(var), 0.15 * mean, 0.25 * gstd, 1e-6)
    return (values[t] - mean) / std


def _run_neuron(dates: list[str], values: list[float], invert: bool = False) -> dict:
    """Replay one LIF neuron over a daily series.

    invert=True fires on sustained *absence* (the silence neuron): input
    current is how far the day sits below baseline instead of above it.
    """
    potential = 0.0
    refractory = 0
    gstd = _global_std(values)
    currents, potentials, spikes = [], [], []
    for t in range(len(values)):
        z = _trailing_z(values, t, gstd)
        raw = 0.0 if z is None else (-z if invert else z)
        current = min(CURRENT_CAP, max(0.0, raw))
        if refractory > 0:
            refractory -= 1
            current = 0.0
        potential = potential * DECAY + current
        spiked = potential >= THRESHOLD
        if spiked:
            potential = 0.0
            refractory = REFRACTORY_DAYS
        currents.append(round(current, 2))
        potentials.append(round(potential, 2))
        spikes.append(spiked)
    return {"currents": currents, "potentials": potentials, "spikes": spikes}


NEURONS = [
    {"name": "email_volume", "label": "Communication burst", "invert": False,
     "note": "email + message volume well above your trailing norm"},
    {"name": "meeting_load", "label": "Meeting overload", "invert": False,
     "note": "sustained meeting hours far past baseline"},
    {"name": "late_night", "label": "Late-night activity", "invert": False,
     "note": "work bleeding into 22:00–06:00"},
    {"name": "spending", "label": "Spending spike", "invert": False,
     "note": "outflows well above the trailing norm"},
    {"name": "stress", "label": "Physiological stress", "invert": False,
     "note": "smartwatch stress scores climbing above baseline"},
    {"name": "email_volume", "label": "Gone quiet", "invert": True, "alias": "silence",
     "note": "communication drying up — the neglect signal"},
]


def scan(wake: bool = False) -> dict:
    """Rebuild streams from the archive, replay every neuron over history,
    persist the report. With wake=True, a fresh trip launches an agent run."""
    with _lock:
        data = build_streams()
        dates = data["dates"]

        neurons, trips = [], []
        for spec in NEURONS:
            values = data["streams"].get(spec["name"], [])
            run = _run_neuron(dates, values, invert=spec["invert"])
            neuron_id = spec.get("alias", spec["name"])
            neuron_trips = [
                {"date": dates[i], "neuron": neuron_id, "label": spec["label"],
                 "current": run["currents"][i], "note": spec["note"]}
                for i, s in enumerate(run["spikes"]) if s
            ]
            trips.extend(neuron_trips)
            neurons.append({
                "id": neuron_id,
                "label": spec["label"],
                "note": spec["note"],
                "trips": len(neuron_trips),
                "series": {
                    "values": [round(v, 2) for v in values],
                    "potentials": run["potentials"],
                    "spikes": run["spikes"],
                },
            })

        trips.sort(key=lambda t: t["date"])
        fresh = [
            t for t in trips
            if dates and (date.fromisoformat(dates[-1]) - date.fromisoformat(t["date"])).days < FRESH_TRIP_DAYS
        ]

        woke_agent = False
        if wake and fresh:
            from app.connectors import agent
            reasons = "; ".join(f"{t['label']} on {t['date']}" for t in fresh)
            woke_agent = agent.run_async(
                "The SNN tripwire fired: " + reasons + ". Investigate what changed "
                "in my life around those dates, figure out what is driving it, and "
                "take helpful low-risk actions."
            )

        report = {
            "ran_at": datetime.now(timezone.utc).isoformat(),
            "days": len(dates),
            "from": dates[0] if dates else None,
            "to": dates[-1] if dates else None,
            "dates": dates,
            "params": {"decay": DECAY, "threshold": THRESHOLD,
                       "baseline_window": BASELINE_WINDOW, "refractory_days": REFRACTORY_DAYS},
            "neurons": neurons,
            "trips": trips,
            "fresh_trips": fresh,
            "woke_agent": woke_agent,
        }
        crypto_store.write_json(REPORT_FILE, report)
        return report


def last_report() -> dict | None:
    return crypto_store.read_json(REPORT_FILE, None)

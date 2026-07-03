"""Digital Twin — simulation engine (Phase 2).

Joins daily calendar load with daily health metrics and fits a small
logistic model: P(high-stress day | meeting hours, recent load, sleep, HRV).
simulate_workload() then answers what-if questions — "what happens to my
stress risk if next week adds 6 meeting hours and I lose an hour of sleep?"

Uses scikit-learn when it's installed; otherwise falls back to a pure-Python
gradient-descent logistic regression with the same contract, so mock mode
(Windows, no compiled deps) works out of the box.
"""
import math
from collections import defaultdict
from datetime import datetime

from app.connectors import chroma

STRESS_THRESHOLD = 60   # smartwatch stress_score at/above this = high-stress day
LOAD_WINDOW_DAYS = 7    # trailing window for the cumulative-load feature
BASELINE_DAYS = 14      # recent days that define "your current life" for what-ifs
WORKDAYS_PER_WEEK = 5   # weekly meeting-hour deltas are spread over workdays

FEATURES = ["meeting_hours", "trailing_load_hours", "sleep_hours", "hrv_ms"]


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def build_dataset() -> dict:
    """Join calendar and health by date into daily feature rows.

    Row: [meeting hours that day, avg daily meeting hours over the previous
    7 days, sleep hours, HRV] → label 1 if stress_score >= STRESS_THRESHOLD.
    Days without a health record are dropped; days without meetings count
    as 0 hours (a quiet calendar is signal, not missing data).
    """
    health = chroma.all_health()
    events = chroma.all_events()

    meeting_min: dict[str, float] = defaultdict(float)
    for e in events:
        meeting_min[e["date"]] += e.get("duration_minutes", 0)

    rows, labels, dates = [], [], []
    ordered = sorted(health, key=lambda r: r["date"])
    for i, r in enumerate(ordered):
        date = r["date"]
        day_hours = meeting_min.get(date, 0.0) / 60
        window = ordered[max(0, i - LOAD_WINDOW_DAYS):i]
        trailing = _mean([meeting_min.get(w["date"], 0.0) / 60 for w in window]) if window else day_hours
        rows.append([
            round(day_hours, 2),
            round(trailing, 2),
            round(r.get("sleep_minutes", 0) / 60, 2),
            float(r.get("hrv_ms", 0)),
        ])
        labels.append(1 if r.get("stress_score", 0) >= STRESS_THRESHOLD else 0)
        dates.append(date)

    return {"rows": rows, "labels": labels, "dates": dates}


def _standardize(rows: list[list[float]]) -> tuple[list[list[float]], list[float], list[float]]:
    cols = list(zip(*rows))
    means = [_mean(list(c)) for c in cols]
    stds = []
    for c, m in zip(cols, means):
        var = _mean([(x - m) ** 2 for x in c])
        stds.append(math.sqrt(var) or 1.0)
    scaled = [[(x - m) / s for x, m, s in zip(row, means, stds)] for row in rows]
    return scaled, means, stds


def _fit_pure(X: list[list[float]], y: list[int]) -> tuple[list[float], float]:
    """Plain gradient-descent logistic regression — no dependencies."""
    n_feat = len(X[0])
    w, b, lr = [0.0] * n_feat, 0.0, 0.2
    for _ in range(400):
        gw, gb = [0.0] * n_feat, 0.0
        for row, label in zip(X, y):
            z = sum(wi * xi for wi, xi in zip(w, row)) + b
            p = 1 / (1 + math.exp(-max(-30, min(30, z))))
            err = p - label
            for j in range(n_feat):
                gw[j] += err * row[j]
            gb += err
        n = len(X)
        w = [wi - lr * g / n for wi, g in zip(w, gw)]
        b -= lr * gb / n
    return w, b


def _fit(X: list[list[float]], y: list[int]) -> tuple[list[float], float, str]:
    try:
        from sklearn.linear_model import LogisticRegression

        clf = LogisticRegression(max_iter=1000).fit(X, y)
        return list(clf.coef_[0]), float(clf.intercept_[0]), "scikit-learn"
    except ImportError:
        w, b = _fit_pure(X, y)
        return w, b, "pure-python"


_model: dict | None = None  # trained lazily, invalidated via retrain=True


def train(retrain: bool = False) -> dict:
    """Fit the stress model over everything currently ingested."""
    global _model
    if _model is not None and not retrain:
        return _model

    data = build_dataset()
    rows, labels = data["rows"], data["labels"]
    if len(rows) < 14 or len(set(labels)) < 2:
        raise ValueError(
            f"Not enough joined data to train ({len(rows)} days, "
            f"{sum(labels)} stressed) — seed/sync calendar and health first."
        )

    X, means, stds = _standardize(rows)
    weights, bias, backend = _fit(X, labels)

    correct = 0
    for row, label in zip(X, labels):
        z = sum(w * x for w, x in zip(weights, row)) + bias
        correct += (z >= 0) == bool(label)

    _model = {
        "weights": weights,
        "bias": bias,
        "means": means,
        "stds": stds,
        "backend": backend,
        "days": len(rows),
        "stressed_days": sum(labels),
        "from": data["dates"][0],
        "to": data["dates"][-1],
        "train_accuracy": round(correct / len(rows), 3),
        "baseline": _recent_baseline(rows, data["dates"]),
    }
    return _model


def _recent_baseline(rows: list[list[float]], dates: list[str]) -> dict:
    recent = rows[-BASELINE_DAYS:]
    cols = list(zip(*recent))
    return {
        name: round(_mean(list(c)), 2)
        for name, c in zip(FEATURES, cols)
    } | {"days": len(recent), "from": dates[-len(recent)], "to": dates[-1]}


def _predict(model: dict, features: list[float]) -> float:
    z = model["bias"]
    for w, x, m, s in zip(model["weights"], features, model["means"], model["stds"]):
        z += w * (x - m) / s
    return 1 / (1 + math.exp(-max(-30, min(30, z))))


def _risk_level(p: float) -> str:
    if p < 0.3:
        return "low"
    if p < 0.6:
        return "moderate"
    return "high"


def simulate_workload(
    extra_meeting_hours: float = 0.0,
    sleep_delta_hours: float = 0.0,
) -> dict:
    """What-if: shift next week's meeting load and nightly sleep from the
    recent baseline and report the change in daily high-stress probability.

    extra_meeting_hours is per week (spread over workdays); sleep_delta_hours
    is per night. HRV is held at baseline — it's an outcome, not a lever.
    """
    model = train()
    base = model["baseline"]
    per_day = extra_meeting_hours / WORKDAYS_PER_WEEK

    current = [base[f] for f in FEATURES]
    scenario = [
        base["meeting_hours"] + per_day,
        base["trailing_load_hours"] + per_day,
        max(0.0, base["sleep_hours"] + sleep_delta_hours),
        base["hrv_ms"],
    ]

    p_now = _predict(model, current)
    p_then = _predict(model, scenario)

    # Which lever moved the needle: re-predict changing one input at a time.
    drivers = {}
    if per_day:
        alone = current.copy()
        alone[0] += per_day
        alone[1] += per_day
        drivers["meetings"] = round(_predict(model, alone) - p_now, 3)
    if sleep_delta_hours:
        alone = current.copy()
        alone[2] = scenario[2]
        drivers["sleep"] = round(_predict(model, alone) - p_now, 3)

    return {
        "inputs": {
            "extra_meeting_hours_per_week": extra_meeting_hours,
            "sleep_delta_hours_per_night": sleep_delta_hours,
        },
        "baseline": base,
        "current_risk": round(p_now, 3),
        "current_level": _risk_level(p_now),
        "simulated_risk": round(p_then, 3),
        "simulated_level": _risk_level(p_then),
        "change": round(p_then - p_now, 3),
        "drivers": drivers,
        "summary": _narrate(p_now, p_then, extra_meeting_hours, sleep_delta_hours),
    }


def _narrate(p_now: float, p_then: float, meetings: float, sleep: float) -> str:
    changes = []
    if meetings:
        changes.append(f"{'+' if meetings > 0 else ''}{meetings:g}h of meetings/week")
    if sleep:
        changes.append(f"{'+' if sleep > 0 else ''}{sleep:g}h of sleep/night")
    what = " and ".join(changes) or "no change"
    if abs(p_then - p_now) < 0.005:
        return (
            f"With {what}, your daily high-stress probability stays at "
            f"{p_now:.0%} ({_risk_level(p_now)} risk)."
        )
    direction = "rises" if p_then > p_now else "falls"
    return (
        f"With {what}, your daily high-stress probability {direction} from "
        f"{p_now:.0%} to {p_then:.0%} ({_risk_level(p_then)} risk)."
    )


def scenario_grid() -> dict:
    """Risk curve across meeting loads at current sleep and +1h sleep —
    the frontend's chart data."""
    model = train()
    steps = [-10, -5, 0, 5, 10, 15]
    curves = {}
    for label, sleep in (("current_sleep", 0.0), ("plus_1h_sleep", 1.0)):
        curves[label] = [
            {
                "extra_meeting_hours": h,
                "risk": simulate_workload(h, sleep)["simulated_risk"],
            }
            for h in steps
        ]
    return {"baseline": model["baseline"], "curves": curves}

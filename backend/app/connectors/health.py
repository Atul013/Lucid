"""Health data connector — mock smartwatch JSON ingestion and analysis.

Mock-first, same shape as the finance connector: parse a smartwatch export
(daily records of sleep, HRV, resting HR, steps, stress), normalize into flat
records for ChromaDB, and compute summaries + a sentiment-correlation hook.
Later: Apple Health / Google Fit APIs behind the same parse_records() contract.
"""
import hashlib
import json
import math
from pathlib import Path

MOCK_STATEMENT = Path(__file__).resolve().parents[2] / "mock_data" / "smartwatch.json"

SLEEP_TARGET_MINUTES = 8 * 60


def _num(value, default=0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def parse_records(raw: dict | list) -> list[dict]:
    """Normalize a smartwatch export into flat daily records.

    Accepts either {"records": [...]} or a bare list. Each record needs a
    "date" (YYYY-MM-DD); sleep may be nested under "sleep" or flat
    (sleep_minutes / total_minutes). Unknown fields are ignored.
    """
    items = raw.get("records", raw) if isinstance(raw, dict) else raw
    if not isinstance(items, list):
        raise ValueError("Expected a list of daily records or {'records': [...]}")

    records = []
    for item in items:
        if not isinstance(item, dict) or not item.get("date"):
            continue
        date = str(item["date"])[:10]
        sleep = item.get("sleep") if isinstance(item.get("sleep"), dict) else item
        total = _num(sleep.get("total_minutes", sleep.get("sleep_minutes")))
        if total <= 0:
            continue

        record = {
            "id": hashlib.md5(f"health|{date}".encode()).hexdigest()[:16],
            "date": date,
            "sleep_minutes": int(total),
            "deep_minutes": int(_num(sleep.get("deep_minutes"))),
            "rem_minutes": int(_num(sleep.get("rem_minutes"))),
            "awake_minutes": int(_num(sleep.get("awake_minutes"))),
            "bedtime": str(sleep.get("bedtime", "")),
            "sleep_score": int(_num(sleep.get("score", sleep.get("sleep_score")))),
            "hrv_ms": round(_num(item.get("hrv_ms", item.get("hrv"))), 1),
            "resting_hr": int(_num(item.get("resting_hr", item.get("resting_heart_rate")))),
            "steps": int(_num(item.get("steps"))),
            "active_minutes": int(_num(item.get("active_minutes"))),
            "stress_score": int(_num(item.get("stress_score", item.get("stress")))),
        }
        record["text"] = (
            f"{date}: slept {record['sleep_minutes'] / 60:.1f}h "
            f"(score {record['sleep_score']}), HRV {record['hrv_ms']}ms, "
            f"resting HR {record['resting_hr']}, {record['steps']} steps, "
            f"stress {record['stress_score']}"
        )
        records.append(record)

    records.sort(key=lambda r: r["date"])
    return records


def load_mock_statement() -> list[dict]:
    return parse_records(json.loads(MOCK_STATEMENT.read_text(encoding="utf-8")))


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _month(record: dict) -> str:
    return record["date"][:7]


def summarize(records: list[dict]) -> dict:
    """Averages, monthly trend, sleep debt, and flagged rough patches."""
    if not records:
        return {"days": 0}
    records = sorted(records, key=lambda r: r["date"])

    def averages(subset: list[dict]) -> dict:
        return {
            "sleep_hours": round(_mean([r["sleep_minutes"] for r in subset]) / 60, 2),
            "sleep_score": round(_mean([r["sleep_score"] for r in subset]), 1),
            "hrv_ms": round(_mean([r["hrv_ms"] for r in subset]), 1),
            "resting_hr": round(_mean([r["resting_hr"] for r in subset]), 1),
            "steps": int(_mean([r["steps"] for r in subset])),
            "stress_score": round(_mean([r["stress_score"] for r in subset]), 1),
        }

    by_month: dict[str, list[dict]] = {}
    for r in records:
        by_month.setdefault(_month(r), []).append(r)

    last7 = records[-7:]
    baseline = records[:-7] or records
    sleep_debt_min = sum(max(0, SLEEP_TARGET_MINUTES - r["sleep_minutes"]) for r in last7)

    # Rough patches: 3+ consecutive days of short sleep (<6h) or low HRV
    # (>15% under the overall average) — the launch-crunch detector.
    avg_hrv = _mean([r["hrv_ms"] for r in records])
    streaks, current = [], []
    for r in records:
        if r["sleep_minutes"] < 360 or r["hrv_ms"] < avg_hrv * 0.85:
            current.append(r)
        else:
            if len(current) >= 3:
                streaks.append(current)
            current = []
    if len(current) >= 3:
        streaks.append(current)

    best = max(records, key=lambda r: r["sleep_score"])
    worst = min(records, key=lambda r: r["sleep_score"])

    return {
        "days": len(records),
        "from": records[0]["date"],
        "to": records[-1]["date"],
        "averages": averages(records),
        "last_7_days": averages(last7),
        "baseline": averages(baseline),
        "sleep_debt_hours_last_7_days": round(sleep_debt_min / 60, 1),
        "by_month": {m: averages(rs) for m, rs in sorted(by_month.items())},
        "best_sleep": {"date": best["date"], "score": best["sleep_score"]},
        "worst_sleep": {"date": worst["date"], "score": worst["sleep_score"]},
        "rough_patches": [
            {
                "from": s[0]["date"],
                "to": s[-1]["date"],
                "days": len(s),
                "avg_sleep_hours": round(_mean([r["sleep_minutes"] for r in s]) / 60, 2),
                "avg_hrv_ms": round(_mean([r["hrv_ms"] for r in s]), 1),
            }
            for s in streaks
        ],
    }


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mx, my = _mean(xs), _mean(ys)
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if sx == 0 or sy == 0:
        return None
    return round(cov / (sx * sy), 3)


def correlate_with_sentiment(records: list[dict], sentiment_by_date: dict[str, float]) -> dict:
    """Join daily health metrics with a {date: score} sentiment map
    (the emotion timeline) and report Pearson correlations."""
    joined = [
        (r, sentiment_by_date[r["date"]])
        for r in records
        if r["date"] in sentiment_by_date
    ]
    if len(joined) < 3:
        return {"overlapping_days": len(joined), "correlations": {}}

    scores = [s for _, s in joined]
    return {
        "overlapping_days": len(joined),
        "correlations": {
            "sleep_hours_vs_sentiment": _pearson(
                [r["sleep_minutes"] / 60 for r, _ in joined], scores
            ),
            "hrv_vs_sentiment": _pearson([r["hrv_ms"] for r, _ in joined], scores),
            "steps_vs_sentiment": _pearson([float(r["steps"]) for r, _ in joined], scores),
            "stress_vs_sentiment": _pearson(
                [float(r["stress_score"]) for r, _ in joined], scores
            ),
        },
    }

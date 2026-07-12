"""Digital Twin: stress model training and what-if simulation. Pure math
over synthetic calendar/health data injected via monkeypatched chroma
calls — no real ChromaDB/mock-JSON-store dependency needed.

This venv has no scikit-learn (matches the project's "no C++ build tools"
mock-mode default), so these tests exercise twin.py's pure-Python
gradient-descent fallback (_fit_pure) — the same path mock/demo mode uses.
"""
from datetime import date, timedelta

import pytest

from app.connectors import twin


def _synthetic_days(n: int):
    """n days with a strong, unambiguous pattern: heavy meetings + short
    sleep -> stressed; light meetings + long sleep -> not stressed. Alternates
    so the label classes are balanced and the correlation is learnable by a
    plain logistic fit in a handful of gradient steps.
    """
    health, events = [], []
    start = date(2026, 1, 1)
    for i in range(n):
        d = (start + timedelta(days=i)).isoformat()
        stressed = i % 2 == 0
        health.append({
            "date": d,
            "sleep_minutes": 5 * 60 if stressed else 8 * 60,
            "hrv_ms": 35 if stressed else 65,
            "stress_score": 75 if stressed else 20,
        })
        if stressed:
            events.append({"date": d, "duration_minutes": 7 * 60})
    return health, events


@pytest.fixture(autouse=True)
def reset_model_cache():
    # twin._model is a module-level cache; each test needs a clean slate,
    # otherwise later tests would silently reuse an earlier test's model.
    twin._model = None
    yield
    twin._model = None


def _patch_chroma(monkeypatch, health, events):
    monkeypatch.setattr(twin.chroma, "all_health", lambda: health)
    monkeypatch.setattr(twin.chroma, "all_events", lambda: events)


def test_train_raises_with_insufficient_data(monkeypatch):
    health, events = _synthetic_days(10)  # below the 14-day floor
    _patch_chroma(monkeypatch, health, events)
    with pytest.raises(ValueError):
        twin.train()


def test_train_raises_with_single_label_class(monkeypatch):
    # 20 days, all identical (never stressed) -> only one label class.
    health = [
        {"date": (date(2026, 1, 1) + timedelta(days=i)).isoformat(),
         "sleep_minutes": 480, "hrv_ms": 60, "stress_score": 10}
        for i in range(20)
    ]
    _patch_chroma(monkeypatch, health, [])
    with pytest.raises(ValueError):
        twin.train()


def test_train_succeeds_with_enough_balanced_data(monkeypatch):
    health, events = _synthetic_days(20)
    _patch_chroma(monkeypatch, health, events)
    model = twin.train()
    assert model["days"] == 20
    assert model["backend"] == "pure-python"
    assert 0.0 <= model["train_accuracy"] <= 1.0
    # A cleanly separable synthetic pattern should fit near-perfectly.
    assert model["train_accuracy"] >= 0.9


def test_train_caches_until_retrain(monkeypatch):
    health, events = _synthetic_days(20)
    _patch_chroma(monkeypatch, health, events)
    first = twin.train()
    # Change the underlying data but don't ask for a retrain — should get
    # back the exact same cached model object.
    monkeypatch.setattr(twin.chroma, "all_health", lambda: [])
    second = twin.train()
    assert second is first

    monkeypatch.setattr(twin.chroma, "all_health", lambda: health)
    third = twin.train(retrain=True)
    assert third is not first


def test_simulate_workload_more_meetings_raises_risk(monkeypatch):
    health, events = _synthetic_days(20)
    _patch_chroma(monkeypatch, health, events)
    twin.train()

    baseline = twin.simulate_workload(0, 0)
    more_meetings = twin.simulate_workload(20, 0)  # +20h/week of meetings
    assert more_meetings["simulated_risk"] >= baseline["current_risk"]


def test_simulate_workload_more_sleep_lowers_risk(monkeypatch):
    health, events = _synthetic_days(20)
    _patch_chroma(monkeypatch, health, events)
    twin.train()

    baseline = twin.simulate_workload(0, 0)
    more_sleep = twin.simulate_workload(0, 2)  # +2h/night sleep
    assert more_sleep["simulated_risk"] <= baseline["current_risk"]


def test_simulate_workload_response_shape(monkeypatch):
    health, events = _synthetic_days(20)
    _patch_chroma(monkeypatch, health, events)
    twin.train()

    r = twin.simulate_workload(5, -1)
    assert set(r.keys()) == {
        "inputs", "baseline", "current_risk", "current_level",
        "simulated_risk", "simulated_level", "change", "drivers", "summary",
    }
    assert r["current_level"] in ("low", "moderate", "high")
    assert r["simulated_level"] in ("low", "moderate", "high")
    assert 0.0 <= r["current_risk"] <= 1.0
    assert 0.0 <= r["simulated_risk"] <= 1.0

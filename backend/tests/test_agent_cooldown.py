"""Agent run cooldown + action audit log (added in PR #47) — pure logic
around a JSON report file, isolated from the real one via tmp_path so tests
never touch backend/agent_report.json or trigger a real run.
"""
import json
from datetime import datetime, timedelta, timezone

import pytest

from app.connectors import agent


@pytest.fixture(autouse=True)
def isolated_files(tmp_path, monkeypatch):
    monkeypatch.setattr(agent, "REPORT_FILE", tmp_path / "agent_report.json")
    monkeypatch.setattr(agent, "ACTION_LOG_FILE", tmp_path / "agent_actions.log")
    monkeypatch.setattr(agent, "MIN_RUN_INTERVAL_SECONDS", 600)


def test_seconds_until_next_run_with_no_report():
    assert agent.seconds_until_next_run() == 0.0


def test_seconds_until_next_run_right_after_a_run():
    agent.REPORT_FILE.write_text(
        json.dumps({"ran_at": datetime.now(timezone.utc).isoformat()})
    )
    remaining = agent.seconds_until_next_run()
    assert 590 < remaining <= 600


def test_seconds_until_next_run_after_cooldown_elapsed():
    old = datetime.now(timezone.utc) - timedelta(seconds=700)
    agent.REPORT_FILE.write_text(json.dumps({"ran_at": old.isoformat()}))
    assert agent.seconds_until_next_run() == 0.0


def test_seconds_until_next_run_ignores_malformed_timestamp():
    agent.REPORT_FILE.write_text(json.dumps({"ran_at": "not-a-timestamp"}))
    assert agent.seconds_until_next_run() == 0.0


def test_run_async_raises_cooldown_active_when_called_too_soon():
    agent.REPORT_FILE.write_text(
        json.dumps({"ran_at": datetime.now(timezone.utc).isoformat()})
    )
    with pytest.raises(agent.CooldownActive) as exc_info:
        agent.run_async("test goal")
    assert 590 < exc_info.value.retry_after <= 600


def test_log_event_appends_valid_jsonl():
    agent._log_event("todo", text="buy milk", id=1)
    agent._log_event("telegram", headline="hi", bullets=["a", "b"])

    lines = agent.ACTION_LOG_FILE.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 2
    for line in lines:
        entry = json.loads(line)
        assert "ts" in entry and "kind" in entry
    assert json.loads(lines[0])["kind"] == "todo"
    assert json.loads(lines[1])["bullets"] == ["a", "b"]


def test_extract_headline_bullets_truncates_and_filters():
    headline, bullets = agent._extract_headline_bullets({
        "headline": "x" * 500,
        "bullets": ["  keep me  ", "", "   ", "y" * 300, 42],
    })
    assert len(headline) == 300
    assert bullets[0] == "keep me"
    assert "" not in bullets and "   " not in bullets
    assert len(bullets[1]) == 200
    assert bullets[-1] == "42"  # non-string values get stringified


def test_extract_headline_bullets_falls_back_through_legacy_keys():
    # Back-compat: older/looser tool-call args using summary/text instead
    # of headline still produce something usable.
    headline, _ = agent._extract_headline_bullets({"summary": "from summary"})
    assert headline == "from summary"
    headline, _ = agent._extract_headline_bullets({"text": "from text"})
    assert headline == "from text"

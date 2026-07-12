"""Data export and right-to-delete (PLAN.md Phase 3 #3).

Stores are isolated into tmp_path via monkeypatch so these tests never touch
real dev-local JSON files, and never depend on real Gmail/Telegram/WhatsApp
credentials being configured.
"""
import json

import pytest
from cryptography.fernet import Fernet

from app import crypto_store
from app.connectors import agent
from app.routers import privacy


@pytest.fixture(autouse=True)
def reset_fernet_cache(monkeypatch):
    monkeypatch.setattr(crypto_store, "_fernet", None)
    monkeypatch.setattr(crypto_store, "_warned", False)
    monkeypatch.delenv("LUCID_ENCRYPTION_KEY", raising=False)
    yield
    monkeypatch.setattr(crypto_store, "_fernet", None)
    monkeypatch.setattr(crypto_store, "_warned", False)


@pytest.fixture
def isolated_stores(tmp_path, monkeypatch):
    """Point every JSON store + the action log at tmp_path, and stub out the
    archive collections so no real chroma/mock data is touched."""
    stores = {name: tmp_path / f"{name}.json" for name in privacy._JSON_STORES}
    monkeypatch.setattr(privacy, "_JSON_STORES", stores)

    action_log = tmp_path / "agent_actions.log"
    monkeypatch.setattr(agent, "ACTION_LOG_FILE", action_log)

    archive = {
        "emails": [{"id": "e1"}],
        "transactions": [{"id": "t1"}],
        "health": [{"id": "h1"}],
        "events": [{"id": "ev1"}],
        "messages": [{"id": "m1"}],
    }
    for kind, data in archive.items():
        monkeypatch.setattr(privacy.chroma, f"all_{kind}", lambda data=data: data)

    wiped = []
    for kind in archive:
        monkeypatch.setattr(privacy.chroma, f"wipe_{kind}", lambda kind=kind: wiped.append(kind))

    monkeypatch.setattr(privacy.telegram_connector, "stop_poller", lambda: wiped.append("poller_stopped"))
    monkeypatch.setattr(privacy.telegram_connector, "disconnect", lambda: wiped.append("telegram_disconnected"))

    return stores, action_log, archive, wiped


def test_export_bundles_every_store(isolated_stores):
    stores, action_log, archive, _ = isolated_stores
    crypto_store.write_json(stores["ego_insights"], {"text": "you focus on deep work"})
    crypto_store.write_json(stores["goals"], {"goals": ["ship the export endpoint"]})
    crypto_store.append_line(action_log, {"kind": "todo", "id": 1})

    response = privacy.export_data()
    body = json.loads(response.body)

    assert body["archive"] == archive
    assert body["ego_insights"] == {"text": "you focus on deep work"}
    assert body["goals"] == {"goals": ["ship the export endpoint"]}
    assert body["agent_actions"] == [{"kind": "todo", "id": 1}]
    # A store that was never written still shows up with a null, not a KeyError.
    assert body["briefing"] is None
    assert "attachment" in response.headers["content-disposition"]


def test_export_round_trips_through_encryption(isolated_stores):
    stores, _, _, _ = isolated_stores
    import os

    os.environ["LUCID_ENCRYPTION_KEY"] = Fernet.generate_key().decode()
    try:
        crypto_store.write_json(stores["goals"], {"goals": ["stay encrypted at rest"]})
        response = privacy.export_data()
        body = json.loads(response.body)
        assert body["goals"] == {"goals": ["stay encrypted at rest"]}
    finally:
        os.environ.pop("LUCID_ENCRYPTION_KEY", None)


def test_purge_without_confirm_is_a_noop(isolated_stores):
    stores, _, _, wiped = isolated_stores
    crypto_store.write_json(stores["goals"], {"goals": ["do not delete me"]})

    result = privacy.purge_data(confirm=False)

    assert result == {
        "purged": False,
        "detail": "Pass ?confirm=true to purge — this deletes everything and cannot be undone.",
    }
    assert stores["goals"].exists()
    assert crypto_store.read_json(stores["goals"], None) == {"goals": ["do not delete me"]}
    assert wiped == []


def test_purge_with_confirm_wipes_every_store(isolated_stores):
    stores, action_log, _, wiped = isolated_stores
    for path in stores.values():
        crypto_store.write_json(path, {"data": "sensitive"})
    crypto_store.append_line(action_log, {"kind": "todo"})

    result = privacy.purge_data(confirm=True)

    assert result == {"purged": True}
    for path in stores.values():
        assert not path.exists()
    assert not action_log.exists()
    assert set(wiped) == {
        "emails", "transactions", "health", "events", "messages",
        "poller_stopped", "telegram_disconnected",
    }


def test_purge_with_confirm_does_not_fail_on_missing_stores(isolated_stores):
    # Nothing was ever written — a fresh install purging is a valid no-op-ish call.
    result = privacy.purge_data(confirm=True)
    assert result == {"purged": True}

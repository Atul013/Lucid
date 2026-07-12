"""Telegram bot sender authorization (data protection hardening).

A bot's username is discoverable, so without pinning ownership to the
first private sender, any stranger who DMs the bot could run todo
commands (/del, /clear, ...) or seed the owner's archive — which feeds
Ego/Drift/Twin/the agent — with their own text. Network and the real
config file are stubbed out; only the routing logic is under test.
"""
import pytest

from app.connectors import telegram


def _update(update_id, chat_id, text, chat_type="private"):
    return {
        "update_id": update_id,
        "message": {
            "message_id": update_id,
            "date": 0,
            "chat": {"id": chat_id, "type": chat_type, "first_name": "Someone"},
            "from": {"id": chat_id, "first_name": "Someone"},
            "text": text,
        },
    }


@pytest.fixture(autouse=True)
def stub_network(monkeypatch):
    sent = []

    def fake_call(method, token, **params):
        sent.append((method, params))
        return {}

    monkeypatch.setattr(telegram, "_call", fake_call)
    return sent


@pytest.fixture
def archived(monkeypatch):
    from app.connectors import chroma

    ingested = []
    monkeypatch.setattr(chroma, "ingest_messages", lambda msgs: ingested.extend(msgs) or len(msgs))
    return ingested


def test_first_private_sender_claims_chat_id(archived):
    cfg = {"bot_token": "t"}
    telegram._process_update(_update(1, "111", "hello"), cfg)
    assert cfg["chat_id"] == "111"
    assert len(archived) == 1


def test_second_sender_is_rejected_once_owner_claimed(stub_network, archived):
    cfg = {"bot_token": "t"}
    telegram._process_update(_update(1, "111", "hello"), cfg)
    telegram._process_update(_update(2, "222", "intruder text"), cfg)

    assert cfg["chat_id"] == "111"  # ownership unchanged
    assert len(archived) == 1  # intruder's text was never archived
    assert any("private" in params.get("text", "") for _, params in stub_network)


def test_intruder_cannot_run_todo_commands(monkeypatch):
    from app.connectors import todos

    calls = []
    monkeypatch.setattr(todos, "clear_done", lambda: calls.append("clear_done") or 0)
    cfg = {"bot_token": "t", "chat_id": "111"}  # owner already claimed

    telegram._process_update(_update(1, "222", "/clear"), cfg)

    assert calls == []  # command never reached todos


def test_fetch_updates_filters_out_non_owner_messages(monkeypatch):
    updates = [_update(1, "111", "first"), _update(2, "222", "second")]
    monkeypatch.setattr(telegram, "_call", lambda method, token, **p: updates if method == "getUpdates" else {})
    monkeypatch.setattr(telegram, "_read_config", lambda: {"bot_token": "t"})
    written = {}
    monkeypatch.setattr(telegram, "_write_config", lambda cfg: written.update(cfg))

    messages = telegram.fetch_updates()

    assert [m["chat_id"] for m in messages] == ["111"]
    assert written["chat_id"] == "111"


def test_owner_can_still_run_commands(monkeypatch):
    from app.connectors import todos

    monkeypatch.setattr(todos, "clear_done", lambda: 2)
    monkeypatch.setattr(todos, "render", lambda: "📝 Your todos:\n(empty)")
    cfg = {"bot_token": "t", "chat_id": "111"}

    telegram._process_update(_update(1, "111", "/clear"), cfg)  # must not raise


def test_group_message_cannot_claim_ownership(archived):
    # Regression: the bot must never let a group it's been added to (or a
    # stray sender inside one) seize ownership ahead of the real owner's
    # first private DM — a group's membership is, by definition, not just
    # the owner.
    cfg = {"bot_token": "t"}
    telegram._process_update(_update(1, "999", "hi from a group", chat_type="group"), cfg)

    assert cfg.get("chat_id") is None
    assert len(archived) == 0

    # The real owner's subsequent private DM claims ownership normally.
    telegram._process_update(_update(2, "111", "hello", chat_type="private"), cfg)
    assert cfg["chat_id"] == "111"


def test_fetch_updates_does_not_claim_ownership_from_group_messages(monkeypatch):
    updates = [_update(1, "999", "hi from a group", chat_type="group")]
    monkeypatch.setattr(telegram, "_call", lambda method, token, **p: updates if method == "getUpdates" else {})
    monkeypatch.setattr(telegram, "_read_config", lambda: {"bot_token": "t"})
    written = {}
    monkeypatch.setattr(telegram, "_write_config", lambda cfg: written.update(cfg))

    messages = telegram.fetch_updates()

    assert messages == []
    assert "chat_id" not in written

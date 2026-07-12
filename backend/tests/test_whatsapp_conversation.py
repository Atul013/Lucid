"""WhatsApp reply formatting + conversation context.

Bot replies used to be plain prose with no memory of what was just asked —
a follow-up like "what about last week?" had nothing to resolve against.
This covers the WhatsApp-native markdown normalization and the short
per-chat Q&A window that gives follow-ups something to refer to.
"""
import pytest

from app import crypto_store
from app.connectors import chroma, llm
from app.routers import whatsapp


@pytest.fixture(autouse=True)
def isolated_store(tmp_path, monkeypatch):
    monkeypatch.setattr(whatsapp, "CONVERSATIONS_FILE", tmp_path / "whatsapp_conversations.json")
    monkeypatch.setattr(crypto_store, "_fernet", None)
    monkeypatch.setattr(crypto_store, "_warned", False)
    monkeypatch.delenv("LUCID_ENCRYPTION_KEY", raising=False)


# ── _to_whatsapp_format ──────────────────────────────────────────────────────

def test_double_asterisk_bold_becomes_single():
    assert whatsapp._to_whatsapp_format("This is **important**") == "This is *important*"


def test_markdown_headers_are_stripped():
    assert whatsapp._to_whatsapp_format("### Summary\nDetails here") == "Summary\nDetails here"


def test_bullet_symbols_normalized_to_dash():
    assert whatsapp._to_whatsapp_format("• first\n• second") == "- first\n- second"


def test_already_whatsapp_native_text_is_untouched():
    text = "You're *on track*. _Nice work_ this week."
    assert whatsapp._to_whatsapp_format(text) == text


def test_surrounding_whitespace_is_trimmed():
    assert whatsapp._to_whatsapp_format("  hello  \n") == "hello"


# ── conversation memory ──────────────────────────────────────────────────────

def test_remember_and_recall_a_turn():
    whatsapp._remember_turn("123@c.us", "what's on my plate today?", "A budget review at 2pm.")
    turns = whatsapp._recent_turns("123@c.us")
    assert len(turns) == 1
    assert turns[0]["q"] == "what's on my plate today?"
    assert turns[0]["a"] == "A budget review at 2pm."


def test_conversations_are_isolated_per_chat():
    whatsapp._remember_turn("a@c.us", "q1", "a1")
    whatsapp._remember_turn("b@c.us", "q2", "a2")
    assert [t["q"] for t in whatsapp._recent_turns("a@c.us")] == ["q1"]
    assert [t["q"] for t in whatsapp._recent_turns("b@c.us")] == ["q2"]


def test_history_is_capped_at_max_turns():
    for i in range(whatsapp.MAX_TURNS + 3):
        whatsapp._remember_turn("123@c.us", f"q{i}", f"a{i}")
    turns = whatsapp._recent_turns("123@c.us")
    assert len(turns) == whatsapp.MAX_TURNS
    # Oldest turns fall off the front, most recent survive.
    assert turns[0]["q"] == f"q{3}"
    assert turns[-1]["q"] == f"q{whatsapp.MAX_TURNS + 2}"


# ── _answer_from_archive ──────────────────────────────────────────────────────

def _hit(text="a message", frm="a@b.com", date="2026-01-01"):
    return {"text": text, "from": frm, "date": date}


def test_empty_archive_returns_fallback_without_calling_llm(monkeypatch):
    monkeypatch.setattr(chroma, "search_messages", lambda q, n_results=5: [])
    monkeypatch.setattr(chroma, "search_emails", lambda q, n_results=3: [])
    calls = []
    monkeypatch.setattr(llm, "chat", lambda *a, **k: calls.append(1) or "should not be called")

    result = whatsapp._answer_from_archive("123@c.us", "anything?")

    assert result == "Your archive is empty — connect a source and sync first."
    assert calls == []
    assert whatsapp._recent_turns("123@c.us") == []


def test_first_question_has_no_recent_conversation_in_prompt(monkeypatch):
    monkeypatch.setattr(chroma, "search_messages", lambda q, n_results=5: [_hit()])
    monkeypatch.setattr(chroma, "search_emails", lambda q, n_results=3: [])
    captured = {}

    def fake_chat(messages, **kwargs):
        captured["user"] = next(m["content"] for m in messages if m["role"] == "user")
        return "Here's the answer."

    monkeypatch.setattr(llm, "chat", fake_chat)

    whatsapp._answer_from_archive("123@c.us", "what's up?")

    assert "Recent conversation" not in captured["user"]
    assert "what's up?" in captured["user"]


def test_followup_question_includes_recent_conversation_in_prompt(monkeypatch):
    monkeypatch.setattr(chroma, "search_messages", lambda q, n_results=5: [_hit()])
    monkeypatch.setattr(chroma, "search_emails", lambda q, n_results=3: [])
    monkeypatch.setattr(llm, "chat", lambda *a, **k: "first answer")
    whatsapp._answer_from_archive("123@c.us", "what's the budget number?")

    captured = {}

    def fake_chat(messages, **kwargs):
        captured["user"] = next(m["content"] for m in messages if m["role"] == "user")
        return "second answer"

    monkeypatch.setattr(llm, "chat", fake_chat)
    whatsapp._answer_from_archive("123@c.us", "and what about last month?")

    assert "Recent conversation" in captured["user"]
    assert "what's the budget number?" in captured["user"]
    assert "first answer" in captured["user"]


def test_llm_output_is_normalized_and_the_turn_is_remembered(monkeypatch):
    monkeypatch.setattr(chroma, "search_messages", lambda q, n_results=5: [_hit()])
    monkeypatch.setattr(chroma, "search_emails", lambda q, n_results=3: [])
    monkeypatch.setattr(llm, "chat", lambda *a, **k: "**Bold** claim\n# Heading\n• point one")

    result = whatsapp._answer_from_archive("123@c.us", "how am I doing?")

    assert result == "*Bold* claim\nHeading\n- point one"
    turns = whatsapp._recent_turns("123@c.us")
    assert len(turns) == 1
    assert turns[0]["q"] == "how am I doing?"
    assert turns[0]["a"] == result

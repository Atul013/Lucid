"""Encryption at rest for local JSON stores (data protection hardening).
Isolated from the real module-level key state via monkeypatch so tests
never depend on (or leak) whatever LUCID_ENCRYPTION_KEY is set in the
environment running pytest.
"""
import pytest
from cryptography.fernet import Fernet

from app import crypto_store


@pytest.fixture(autouse=True)
def reset_fernet_cache(monkeypatch):
    # crypto_store caches the loaded Fernet instance at module level; force
    # every test to re-derive it from whatever env var this test sets.
    monkeypatch.setattr(crypto_store, "_fernet", None)
    monkeypatch.setattr(crypto_store, "_warned", False)
    yield
    monkeypatch.setattr(crypto_store, "_fernet", None)
    monkeypatch.setattr(crypto_store, "_warned", False)


def test_disabled_without_key_reads_and_writes_plain_json(tmp_path, monkeypatch):
    monkeypatch.delenv("LUCID_ENCRYPTION_KEY", raising=False)
    path = tmp_path / "store.json"
    crypto_store.write_json(path, {"a": 1})
    assert not crypto_store.enabled()
    assert b'"a"' in path.read_bytes()  # plain, human-readable JSON on disk
    assert crypto_store.read_json(path, None) == {"a": 1}


def test_enabled_with_key_encrypts_on_disk_and_round_trips(tmp_path, monkeypatch):
    monkeypatch.setenv("LUCID_ENCRYPTION_KEY", Fernet.generate_key().decode())
    path = tmp_path / "store.json"
    crypto_store.write_json(path, {"secret": "shh", "n": 42})
    assert crypto_store.enabled()
    raw = path.read_bytes()
    assert b"secret" not in raw and b"shh" not in raw
    assert crypto_store.read_json(path, None) == {"secret": "shh", "n": 42}


def test_missing_file_returns_default(tmp_path, monkeypatch):
    monkeypatch.setenv("LUCID_ENCRYPTION_KEY", Fernet.generate_key().decode())
    assert crypto_store.read_json(tmp_path / "nope.json", "fallback") == "fallback"


def test_legacy_plaintext_file_still_reads_once_a_key_is_turned_on(tmp_path, monkeypatch):
    # A file written before LUCID_ENCRYPTION_KEY was ever set must still be
    # readable — no separate migration step.
    monkeypatch.delenv("LUCID_ENCRYPTION_KEY", raising=False)
    path = tmp_path / "store.json"
    crypto_store.write_json(path, {"legacy": True})

    monkeypatch.setenv("LUCID_ENCRYPTION_KEY", Fernet.generate_key().decode())
    monkeypatch.setattr(crypto_store, "_fernet", None)
    assert crypto_store.read_json(path, None) == {"legacy": True}


def test_bad_key_raises_clear_error(tmp_path, monkeypatch):
    monkeypatch.setenv("LUCID_ENCRYPTION_KEY", "not-a-valid-fernet-key")
    with pytest.raises(ValueError, match="not a valid Fernet key"):
        crypto_store.write_json(tmp_path / "store.json", {"a": 1})


def test_append_line_and_read_lines_round_trip_encrypted(tmp_path, monkeypatch):
    monkeypatch.setenv("LUCID_ENCRYPTION_KEY", Fernet.generate_key().decode())
    path = tmp_path / "audit.log"
    crypto_store.append_line(path, {"kind": "todo", "id": 1})
    crypto_store.append_line(path, {"kind": "telegram", "headline": "hi"})

    raw = path.read_text(encoding="utf-8")
    assert "kind" not in raw  # each line is an opaque Fernet token
    assert len(raw.strip().splitlines()) == 2
    assert crypto_store.read_lines(path) == [
        {"kind": "todo", "id": 1},
        {"kind": "telegram", "headline": "hi"},
    ]


def test_read_lines_skips_corrupt_entries(tmp_path, monkeypatch):
    monkeypatch.delenv("LUCID_ENCRYPTION_KEY", raising=False)
    path = tmp_path / "audit.log"
    crypto_store.append_line(path, {"kind": "todo"})
    with path.open("a", encoding="utf-8") as f:
        f.write("not valid json at all\n")
    crypto_store.append_line(path, {"kind": "telegram"})
    assert crypto_store.read_lines(path) == [{"kind": "todo"}, {"kind": "telegram"}]

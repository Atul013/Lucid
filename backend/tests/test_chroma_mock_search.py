"""Mock-mode search embeddings (chroma.py, MOCK_MODE branch).

Verifies: embeddings are computed once at ingest and reused (not
recomputed), never leak into API-facing results, ranking follows cosine
similarity when the model's available, and falls back to the original
keyword-overlap behavior when it isn't. The real fastembed model is never
loaded here — `embeddings.embed_one/embed_many` are monkeypatched to a fast
fake so tests don't depend on a network download.
"""
import pytest

from app import crypto_store, embeddings
from app.connectors import chroma

pytestmark = pytest.mark.skipif(not chroma.MOCK_MODE, reason="mock-mode-only search path")


@pytest.fixture(autouse=True)
def isolated_store(tmp_path, monkeypatch):
    monkeypatch.setattr(chroma, "MOCK_FILE", tmp_path / "chroma_mock_db.json")
    monkeypatch.setattr(crypto_store, "_fernet", None)
    monkeypatch.setattr(crypto_store, "_warned", False)
    monkeypatch.delenv("LUCID_ENCRYPTION_KEY", raising=False)


# A tiny fake embedding space: each text's "vector" is derived from a tag
# word inside it, so cosine similarity is exact and predictable without
# touching the real model.
_TAG_VECTORS = {
    "hiking": [1.0, 0.0, 0.0],
    "budget": [0.0, 1.0, 0.0],
    "unrelated": [0.0, 0.0, 1.0],
}


def _fake_embed_one(text: str):
    for tag, vec in _TAG_VECTORS.items():
        if tag in text.lower():
            return vec
    return [0.0, 0.0, 0.0]


@pytest.fixture
def fake_embeddings(monkeypatch):
    monkeypatch.setattr(embeddings, "available", lambda: True)
    monkeypatch.setattr(embeddings, "embed_one", _fake_embed_one)


def _email(id_, subject, snippet="", frm="a@b.com", date="2026-01-01"):
    return {"id": id_, "subject": subject, "snippet": snippet, "from": frm, "date": date}


def test_ingest_computes_and_caches_embedding(fake_embeddings):
    chroma.ingest_emails([_email("1", "hiking trip planning")])
    raw = chroma._read_db()
    assert raw[0]["_embedding"] == [1.0, 0.0, 0.0]


def test_embedding_never_leaks_into_public_results(fake_embeddings):
    chroma.ingest_emails([_email("1", "hiking trip planning")])
    for record in (*chroma.all_emails(), *chroma.sample(), *chroma.search_emails("hiking")):
        assert "_embedding" not in record


def test_search_ranks_by_cosine_similarity_when_embeddings_available(fake_embeddings):
    chroma.ingest_emails([
        _email("1", "budget review meeting notes"),
        _email("2", "hiking trip planning"),
        _email("3", "totally unrelated topic"),
    ])
    results = chroma.search_emails("hiking gear checklist")
    assert results[0]["id"] == "2"


def test_search_falls_back_to_keyword_overlap_without_embeddings(monkeypatch):
    # Patch the loader itself (not just available()) so ingest's call to
    # embed_one() doesn't fall through to the real model.
    monkeypatch.setattr(embeddings, "_load_model", lambda: None)
    chroma.ingest_emails([
        _email("1", "quarterly budget numbers"),
        _email("2", "hiking trip planning"),
    ])
    results = chroma.search_emails("budget")
    assert results[0]["id"] == "1"


def test_ingesting_a_new_batch_does_not_touch_existing_records(fake_embeddings, monkeypatch):
    chroma.ingest_emails([_email("1", "hiking trip planning")])
    calls = []
    monkeypatch.setattr(embeddings, "embed_one", lambda t: calls.append(t) or _fake_embed_one(t))
    chroma.ingest_emails([_email("2", "budget review")])
    # Only the new record's text should have been embedded — record 1 wasn't
    # in this batch, so its cached vector must be left alone (no full-corpus
    # re-embed on every ingest call).
    assert calls == ["budget review "]  # subject + " " + snippet (empty)


def test_search_with_no_matching_records_still_returns_something(fake_embeddings):
    chroma.ingest_emails([_email("1", "totally unrelated topic")])
    results = chroma.search_emails("hiking")
    assert len(results) == 1  # no crash, no empty-because-zero-similarity result set

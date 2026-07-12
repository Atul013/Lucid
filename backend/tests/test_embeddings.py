"""Local vector embeddings for mock-mode search (fastembed ONNX MiniLM).

Never loads the real model here — that means a ~90MB one-time download and
would make the suite slow/network-dependent. Instead this exercises the
degrade-gracefully contract (available()/embed_*() return falsy without a
working model) and the pure-math cosine() helper.
"""
import pytest

from app import embeddings


@pytest.fixture(autouse=True)
def reset_model_cache(monkeypatch):
    monkeypatch.setattr(embeddings, "_model", None)
    monkeypatch.setattr(embeddings, "_unavailable", False)
    yield
    monkeypatch.setattr(embeddings, "_model", None)
    monkeypatch.setattr(embeddings, "_unavailable", False)


def test_cosine_identical_vectors_is_one():
    assert embeddings.cosine([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)


def test_cosine_orthogonal_vectors_is_zero():
    assert embeddings.cosine([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)


def test_cosine_opposite_vectors_is_negative_one():
    assert embeddings.cosine([1.0, 0.0], [-1.0, 0.0]) == pytest.approx(-1.0)


def test_cosine_zero_vector_does_not_divide_by_zero():
    assert embeddings.cosine([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_unavailable_when_construction_raises(monkeypatch):
    # e.g. no network on first run and the model can't be downloaded — the
    # import succeeds but building TextEmbedding() fails.
    import fastembed

    def boom(*a, **k):
        raise RuntimeError("could not download model")

    monkeypatch.setattr(fastembed, "TextEmbedding", boom)
    assert embeddings.available() is False
    assert embeddings.embed_one("hello") is None
    # Once marked unavailable, later calls don't retry construction.
    assert embeddings._model is None
    assert embeddings._unavailable is True


def test_available_false_when_import_fails(monkeypatch):
    import builtins

    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "fastembed":
            raise ImportError("fastembed not installed")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    assert embeddings.available() is False
    assert embeddings.embed_one("hello") is None
    assert embeddings.embed_many(["hello", "world"]) is None


def test_embed_many_empty_list_short_circuits(monkeypatch):
    # Should never touch the model loader for an empty batch.
    monkeypatch.setattr(embeddings, "_load_model", lambda: (_ for _ in ()).throw(AssertionError("should not load")))
    assert embeddings.embed_many([]) == []


def test_embed_one_and_many_use_the_loaded_model(monkeypatch):
    class FakeVector(list):
        def tolist(self):
            return list(self)

    class FakeModel:
        def embed(self, texts):
            return iter([FakeVector([float(len(t)), 0.0]) for t in texts])

    monkeypatch.setattr(embeddings, "_load_model", lambda: FakeModel())
    assert embeddings.embed_one("hi") == [2.0, 0.0]
    assert embeddings.embed_many(["hi", "there"]) == [[2.0, 0.0], [5.0, 0.0]]
    assert embeddings.available() is True

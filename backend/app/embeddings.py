"""Local vector embeddings for mock-mode search.

The real ChromaDB backend embeds automatically on ingest/query. The mock
fallback (used wherever chromadb can't compile — no C++ toolchain, see
app/connectors/chroma.py) used to rank results by plain keyword overlap.
This gives it real cosine-similarity search instead, via fastembed's
ONNX-quantized MiniLM: prebuilt wheels only, no torch, no compiler needed,
so it installs on the same machines chromadb itself can't.

Degrades gracefully, same pattern as crypto_store.py and security.py: if the
package or the one-time model download isn't available (offline, first run,
not installed), `available()` returns False and callers fall back to their
own keyword-overlap logic.
"""

import logging
import threading
from pathlib import Path

logger = logging.getLogger("lucid.embeddings")

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
# Persistent, not the OS temp dir — fastembed's own default cache lives under
# a temp path on Windows, which risks re-downloading the ~90MB model (and
# eating the resulting minute-long stall) whenever the OS clears temp files.
CACHE_DIR = Path("embedding_cache")

_model = None
_unavailable = False
_lock = threading.Lock()


def _load_model():
    global _model, _unavailable
    if _model is not None or _unavailable:
        return _model
    with _lock:
        if _model is not None or _unavailable:
            return _model
        try:
            from fastembed import TextEmbedding

            _model = TextEmbedding(model_name=MODEL_NAME, cache_dir=str(CACHE_DIR))
        except Exception as e:
            logger.warning(
                "Embedding model unavailable (%s) — mock-mode search falls back to keyword overlap", e
            )
            _unavailable = True
    return _model


def available() -> bool:
    return _load_model() is not None


def warm() -> None:
    """Trigger the model load (and, on first run, the one-time download) in
    the background at startup, so it isn't the first request's problem."""
    threading.Thread(target=_load_model, daemon=True).start()


def embed_one(text: str) -> list[float] | None:
    model = _load_model()
    if model is None:
        return None
    return next(model.embed([text])).tolist()


def embed_many(texts: list[str]) -> list[list[float]] | None:
    if not texts:
        return []
    model = _load_model()
    if model is None:
        return None
    return [e.tolist() for e in model.embed(texts)]


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

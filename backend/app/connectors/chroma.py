import os
from pathlib import Path

from app import crypto_store, embeddings

try:
    import chromadb
    MOCK_MODE = False
except ImportError:
    MOCK_MODE = True

if MOCK_MODE:
    # A simple JSON-based fallback for environments (like Windows without C++ build tools)
    # where compiling chromadb/chroma-hnswlib is not possible. Encrypted at
    # rest when LUCID_ENCRYPTION_KEY is set — see app/crypto_store.py.
    MOCK_FILE = Path("chroma_mock_db.json")

    def _with_embedding(record: dict) -> dict:
        """Compute + cache the record's embedding at ingest time, so search
        only has to embed the (short) query, not the whole corpus every call.
        No-ops if the model isn't available — record stays keyword-searchable."""
        if "_embedding" not in record:
            vec = embeddings.embed_one(record["text"])
            if vec is not None:
                record["_embedding"] = vec
        return record

    def _public(records: list[dict]) -> list[dict]:
        """Strip the internal embedding vector before handing records back —
        it's a large (384-float) implementation detail, not archive content."""
        return [{k: v for k, v in r.items() if k != "_embedding"} for r in records]

    def _keyword_rank(db: list[dict], query: str, n_results: int) -> list[dict]:
        q_words = [w.lower() for w in query.split() if len(w) > 2] or [query.lower()]
        scored = [(sum(1 for qw in q_words if qw in r["text"].lower()), r) for r in db]
        scored.sort(key=lambda x: x[0], reverse=True)
        results = [r for score, r in scored if score > 0] or [r for _, r in scored]
        return results[:n_results]

    def _rank(db: list[dict], query: str, n_results: int) -> list[dict]:
        """Rank by embedding cosine similarity when the model's available and
        every record has a cached vector; otherwise keyword overlap."""
        if not query:
            return db[:n_results]
        if embeddings.available():
            q_vec = embeddings.embed_one(query)
            vectored = [r for r in db if r.get("_embedding")]
            if q_vec is not None and vectored:
                scored = [(embeddings.cosine(q_vec, r["_embedding"]), r) for r in vectored]
                scored.sort(key=lambda x: x[0], reverse=True)
                return [r for _, r in scored[:n_results]]
        return _keyword_rank(db, query, n_results)

    def _read_db() -> list[dict]:
        return crypto_store.read_json(MOCK_FILE, [])

    def _write_db(data: list[dict]):
        crypto_store.write_json(MOCK_FILE, data)

    def ingest_emails(emails: list[dict]) -> int:
        if not emails:
            return 0
        db = _read_db()
        db_ids = {e["id"] for e in db}
        added = 0
        for e in emails:
            record = _with_embedding({
                "id": e["id"],
                "text": f"{e['subject']} {e['snippet']}",
                "subject": e["subject"],
                "from": e["from"],
                "date": e["date"],
            })
            if e["id"] in db_ids:
                # Update
                idx = next(i for i, x in enumerate(db) if x["id"] == e["id"])
                db[idx] = record
            else:
                db.append(record)
                added += 1
        _write_db(db)
        return len(emails)

    def search_emails(query: str, n_results: int = 10) -> list[dict]:
        return _public(_rank(_read_db(), query, n_results))

    def count() -> int:
        return len(_read_db())

    def sample(limit: int = 60) -> list[dict]:
        return _public(_read_db()[:limit])

    def all_emails() -> list[dict]:
        return _public(_read_db())

    def wipe_emails():
        MOCK_FILE.unlink(missing_ok=True)

    FINANCE_MOCK_FILE = Path("finance_mock_db.json")

    def _read_finance_db() -> list[dict]:
        return crypto_store.read_json(FINANCE_MOCK_FILE, [])

    def _write_finance_db(data: list[dict]):
        crypto_store.write_json(FINANCE_MOCK_FILE, data)

    def ingest_transactions(txns: list[dict]) -> int:
        if not txns:
            return 0
        db = {t["id"]: t for t in _read_finance_db()}
        for t in txns:
            db[t["id"]] = _with_embedding({**t, "text": f"{t['date']} {t['description']} {t['category']}"})
        _write_finance_db(list(db.values()))
        return len(txns)

    def search_transactions(query: str, n_results: int = 10) -> list[dict]:
        return _public(_rank(_read_finance_db(), query, n_results))

    def all_transactions() -> list[dict]:
        return _public(_read_finance_db())

    def wipe_transactions():
        FINANCE_MOCK_FILE.unlink(missing_ok=True)

    HEALTH_MOCK_FILE = Path("health_mock_db.json")

    def _read_health_db() -> list[dict]:
        return crypto_store.read_json(HEALTH_MOCK_FILE, [])

    def ingest_health(records: list[dict]) -> int:
        if not records:
            return 0
        by_id = {r["id"]: r for r in _read_health_db()}
        for r in records:
            by_id[r["id"]] = _with_embedding(r)
        crypto_store.write_json(HEALTH_MOCK_FILE, sorted(by_id.values(), key=lambda r: r["date"]))
        return len(records)

    def search_health(query: str, n_results: int = 10) -> list[dict]:
        db = _read_health_db()
        if not query:
            return _public(db[:n_results])
        return _public(_rank(db, query, n_results))

    def all_health() -> list[dict]:
        return _public(_read_health_db())

    def wipe_health():
        HEALTH_MOCK_FILE.unlink(missing_ok=True)

    EVENTS_MOCK_FILE = Path("calendar_mock_db.json")

    def _read_events_db() -> list[dict]:
        return crypto_store.read_json(EVENTS_MOCK_FILE, [])

    def ingest_events(events: list[dict]) -> int:
        if not events:
            return 0
        by_id = {e["id"]: e for e in _read_events_db()}
        for e in events:
            by_id[e["id"]] = _with_embedding(e)
        crypto_store.write_json(EVENTS_MOCK_FILE, sorted(by_id.values(), key=lambda e: e["start"]))
        return len(events)

    def search_events(query: str, n_results: int = 10) -> list[dict]:
        db = _read_events_db()
        if not query:
            return _public(db[:n_results])
        return _public(_rank(db, query, n_results))

    def all_events() -> list[dict]:
        return _public(_read_events_db())

    def wipe_events():
        EVENTS_MOCK_FILE.unlink(missing_ok=True)

    MESSAGES_MOCK_FILE = Path("messages_mock_db.json")

    def _read_messages_db() -> list[dict]:
        return crypto_store.read_json(MESSAGES_MOCK_FILE, [])

    def ingest_messages(messages: list[dict]) -> int:
        if not messages:
            return 0
        by_id = {m["id"]: m for m in _read_messages_db()}
        for m in messages:
            by_id[m["id"]] = _with_embedding(m)
        crypto_store.write_json(
            MESSAGES_MOCK_FILE, sorted(by_id.values(), key=lambda m: m.get("datetime", m["date"]))
        )
        return len(messages)

    def search_messages(query: str, n_results: int = 10) -> list[dict]:
        db = _read_messages_db()
        if not query:
            return _public(db[:n_results])
        return _public(_rank(db, query, n_results))

    def all_messages() -> list[dict]:
        return _public(_read_messages_db())

    def wipe_messages():
        MESSAGES_MOCK_FILE.unlink(missing_ok=True)

    NOTES_MOCK_FILE = Path("notes_mock_db.json")

    def _read_notes_db() -> list[dict]:
        return crypto_store.read_json(NOTES_MOCK_FILE, [])

    def ingest_notes(records: list[dict]) -> int:
        if not records:
            return 0
        by_id = {r["id"]: r for r in _read_notes_db()}
        for r in records:
            by_id[r["id"]] = _with_embedding(r)
        crypto_store.write_json(NOTES_MOCK_FILE, sorted(by_id.values(), key=lambda r: r["date"]))
        return len(records)

    def search_notes(query: str, n_results: int = 10) -> list[dict]:
        db = _read_notes_db()
        if not query:
            return _public(db[:n_results])
        return _public(_rank(db, query, n_results))

    def all_notes() -> list[dict]:
        return _public(_read_notes_db())

    def wipe_notes():
        NOTES_MOCK_FILE.unlink(missing_ok=True)

else:
    _CLIENT = chromadb.PersistentClient(path=os.getenv("CHROMA_PATH", "chroma_data"))

    def _safe_delete_collection(name: str):
        """Wipe a collection that may never have been created (nothing was
        ever ingested into it) — delete_collection raises in that case."""
        try:
            _CLIENT.delete_collection(name)
        except Exception:
            pass

    def _collection():
        return _CLIENT.get_or_create_collection("emails")

    def ingest_emails(emails: list[dict]) -> int:
        if not emails:
            return 0

        _collection().upsert(
            ids=[e["id"] for e in emails],
            documents=[f"{e['subject']} {e['snippet']}" for e in emails],
            metadatas=[{
                "subject": e["subject"],
                "from": e["from"],
                "date": e["date"],
            } for e in emails],
        )
        return len(emails)

    def search_emails(query: str, n_results: int = 10) -> list[dict]:
        results = _collection().query(query_texts=[query], n_results=n_results)
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        return [{"text": d, **m} for d, m in zip(docs, metas)]

    def count() -> int:
        return _collection().count()

    def sample(limit: int = 60) -> list[dict]:
        """A slice of the whole archive, for analysis jobs (not a query)."""
        data = _collection().get(limit=limit, include=["documents", "metadatas"])
        return [
            {"text": d, **m}
            for d, m in zip(data["documents"], data["metadatas"])
        ]

    def all_emails() -> list[dict]:
        """Every email, for temporal-analysis jobs (not a query)."""
        data = _collection().get(include=["documents", "metadatas"])
        return [
            {"text": d, **m}
            for d, m in zip(data["documents"], data["metadatas"])
        ]

    def wipe_emails():
        _safe_delete_collection("emails")

    def _transactions():
        return _CLIENT.get_or_create_collection("transactions")

    def ingest_transactions(txns: list[dict]) -> int:
        if not txns:
            return 0
        _transactions().upsert(
            ids=[t["id"] for t in txns],
            documents=[f"{t['date']} {t['description']} {t['category']}" for t in txns],
            metadatas=[{
                "date": t["date"],
                "description": t["description"],
                "amount": t["amount"],
                "type": t["type"],
                "category": t["category"],
            } for t in txns],
        )
        return len(txns)

    def search_transactions(query: str, n_results: int = 10) -> list[dict]:
        results = _transactions().query(query_texts=[query], n_results=n_results)
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        return [{"text": d, **m} for d, m in zip(docs, metas)]

    def all_transactions() -> list[dict]:
        """Every transaction, for summary/insight jobs (not a query)."""
        data = _transactions().get(include=["metadatas"])
        return list(data["metadatas"])

    def wipe_transactions():
        _safe_delete_collection("transactions")

    def _health_collection():
        return _CLIENT.get_or_create_collection("health")

    def ingest_health(records: list[dict]) -> int:
        if not records:
            return 0
        _health_collection().upsert(
            ids=[r["id"] for r in records],
            documents=[r["text"] for r in records],
            metadatas=[{k: v for k, v in r.items() if k not in ("id", "text")} for r in records],
        )
        return len(records)

    def search_health(query: str, n_results: int = 10) -> list[dict]:
        results = _health_collection().query(query_texts=[query], n_results=n_results)
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        ids = results["ids"][0]
        return [{"id": i, "text": d, **m} for i, d, m in zip(ids, docs, metas)]

    def all_health() -> list[dict]:
        """Every daily record, for summary/correlation jobs (not a query)."""
        data = _health_collection().get(include=["documents", "metadatas"])
        return [
            {"id": i, "text": d, **m}
            for i, d, m in zip(data["ids"], data["documents"], data["metadatas"])
        ]

    def wipe_health():
        _safe_delete_collection("health")

    def _events_collection():
        return _CLIENT.get_or_create_collection("events")

    def ingest_events(events: list[dict]) -> int:
        if not events:
            return 0
        _events_collection().upsert(
            ids=[e["id"] for e in events],
            documents=[e["text"] for e in events],
            metadatas=[{k: v for k, v in e.items() if k not in ("id", "text")} for e in events],
        )
        return len(events)

    def search_events(query: str, n_results: int = 10) -> list[dict]:
        results = _events_collection().query(query_texts=[query], n_results=n_results)
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        ids = results["ids"][0]
        return [{"id": i, "text": d, **m} for i, d, m in zip(ids, docs, metas)]

    def all_events() -> list[dict]:
        """Every event, for workload/summary jobs (not a query)."""
        data = _events_collection().get(include=["documents", "metadatas"])
        return [
            {"id": i, "text": d, **m}
            for i, d, m in zip(data["ids"], data["documents"], data["metadatas"])
        ]

    def wipe_events():
        _safe_delete_collection("events")

    def _messages_collection():
        return _CLIENT.get_or_create_collection("messages")

    def ingest_messages(messages: list[dict]) -> int:
        if not messages:
            return 0
        _messages_collection().upsert(
            ids=[m["id"] for m in messages],
            documents=[m["text"] for m in messages],
            metadatas=[{k: v for k, v in m.items() if k not in ("id", "text")} for m in messages],
        )
        return len(messages)

    def search_messages(query: str, n_results: int = 10) -> list[dict]:
        results = _messages_collection().query(query_texts=[query], n_results=n_results)
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        ids = results["ids"][0]
        return [{"id": i, "text": d, **m} for i, d, m in zip(ids, docs, metas)]

    def all_messages() -> list[dict]:
        """Every chat message, for sentiment/analysis jobs (not a query)."""
        data = _messages_collection().get(include=["documents", "metadatas"])
        return [
            {"id": i, "text": d, **m}
            for i, d, m in zip(data["ids"], data["documents"], data["metadatas"])
        ]

    def wipe_messages():
        _safe_delete_collection("messages")

    def _notes_collection():
        return _CLIENT.get_or_create_collection("notes")

    def ingest_notes(records: list[dict]) -> int:
        if not records:
            return 0
        _notes_collection().upsert(
            ids=[r["id"] for r in records],
            documents=[r["text"] for r in records],
            metadatas=[{k: v for k, v in r.items() if k not in ("id", "text")} for r in records],
        )
        return len(records)

    def search_notes(query: str, n_results: int = 10) -> list[dict]:
        results = _notes_collection().query(query_texts=[query], n_results=n_results)
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        ids = results["ids"][0]
        return [{"id": i, "text": d, **m} for i, d, m in zip(ids, docs, metas)]

    def all_notes() -> list[dict]:
        """Every note, for summary/analysis jobs (not a query)."""
        data = _notes_collection().get(include=["documents", "metadatas"])
        return [
            {"id": i, "text": d, **m}
            for i, d, m in zip(data["ids"], data["documents"], data["metadatas"])
        ]

    def wipe_notes():
        _safe_delete_collection("notes")

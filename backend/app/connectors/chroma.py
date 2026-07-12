import os
from pathlib import Path

from app import crypto_store

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
            record = {
                "id": e["id"],
                "text": f"{e['subject']} {e['snippet']}",
                "subject": e["subject"],
                "from": e["from"],
                "date": e["date"],
            }
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
        db = _read_db()
        if not query:
            return db[:n_results]
        # Simple keyword overlap search to simulate vector search
        q_words = [w.lower() for w in query.split() if len(w) > 2]
        if not q_words:
            q_words = [query.lower()]

        scored = []
        for e in db:
            text = e["text"].lower()
            score = sum(1 for qw in q_words if qw in text)
            scored.append((score, e))

        # Sort by match score (descending)
        scored.sort(key=lambda x: x[0], reverse=True)
        # Return records with score > 0, or just return first n_results if no query matches
        results = [e for score, e in scored if score > 0]
        if not results:
            results = [e for score, e in scored]
        return results[:n_results]

    def count() -> int:
        return len(_read_db())

    def sample(limit: int = 60) -> list[dict]:
        return _read_db()[:limit]

    def all_emails() -> list[dict]:
        return _read_db()

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
            db[t["id"]] = {**t, "text": f"{t['date']} {t['description']} {t['category']}"}
        _write_finance_db(list(db.values()))
        return len(txns)

    def search_transactions(query: str, n_results: int = 10) -> list[dict]:
        db = _read_finance_db()
        q_words = [w.lower() for w in query.split() if len(w) > 2] or [query.lower()]
        scored = [(sum(1 for qw in q_words if qw in t["text"].lower()), t) for t in db]
        scored.sort(key=lambda x: x[0], reverse=True)
        results = [t for score, t in scored if score > 0] or [t for _, t in scored]
        return results[:n_results]

    def all_transactions() -> list[dict]:
        return _read_finance_db()

    HEALTH_MOCK_FILE = Path("health_mock_db.json")

    def _read_health_db() -> list[dict]:
        return crypto_store.read_json(HEALTH_MOCK_FILE, [])

    def ingest_health(records: list[dict]) -> int:
        if not records:
            return 0
        by_id = {r["id"]: r for r in _read_health_db()}
        for r in records:
            by_id[r["id"]] = r
        crypto_store.write_json(HEALTH_MOCK_FILE, sorted(by_id.values(), key=lambda r: r["date"]))
        return len(records)

    def search_health(query: str, n_results: int = 10) -> list[dict]:
        db = _read_health_db()
        if not query:
            return db[:n_results]
        q_words = [w.lower() for w in query.split() if len(w) > 2] or [query.lower()]
        scored = sorted(
            ((sum(1 for qw in q_words if qw in r["text"].lower()), r) for r in db),
            key=lambda x: x[0],
            reverse=True,
        )
        results = [r for score, r in scored if score > 0] or [r for _, r in scored]
        return results[:n_results]

    def all_health() -> list[dict]:
        return _read_health_db()

    EVENTS_MOCK_FILE = Path("calendar_mock_db.json")

    def _read_events_db() -> list[dict]:
        return crypto_store.read_json(EVENTS_MOCK_FILE, [])

    def ingest_events(events: list[dict]) -> int:
        if not events:
            return 0
        by_id = {e["id"]: e for e in _read_events_db()}
        for e in events:
            by_id[e["id"]] = e
        crypto_store.write_json(EVENTS_MOCK_FILE, sorted(by_id.values(), key=lambda e: e["start"]))
        return len(events)

    def search_events(query: str, n_results: int = 10) -> list[dict]:
        db = _read_events_db()
        if not query:
            return db[:n_results]
        q_words = [w.lower() for w in query.split() if len(w) > 2] or [query.lower()]
        scored = sorted(
            ((sum(1 for qw in q_words if qw in e["text"].lower()), e) for e in db),
            key=lambda x: x[0],
            reverse=True,
        )
        results = [e for score, e in scored if score > 0] or [e for _, e in scored]
        return results[:n_results]

    def all_events() -> list[dict]:
        return _read_events_db()

    MESSAGES_MOCK_FILE = Path("messages_mock_db.json")

    def _read_messages_db() -> list[dict]:
        return crypto_store.read_json(MESSAGES_MOCK_FILE, [])

    def ingest_messages(messages: list[dict]) -> int:
        if not messages:
            return 0
        by_id = {m["id"]: m for m in _read_messages_db()}
        for m in messages:
            by_id[m["id"]] = m
        crypto_store.write_json(
            MESSAGES_MOCK_FILE, sorted(by_id.values(), key=lambda m: m.get("datetime", m["date"]))
        )
        return len(messages)

    def search_messages(query: str, n_results: int = 10) -> list[dict]:
        db = _read_messages_db()
        if not query:
            return db[:n_results]
        q_words = [w.lower() for w in query.split() if len(w) > 2] or [query.lower()]
        scored = sorted(
            ((sum(1 for qw in q_words if qw in m["text"].lower()), m) for m in db),
            key=lambda x: x[0],
            reverse=True,
        )
        results = [m for score, m in scored if score > 0] or [m for _, m in scored]
        return results[:n_results]

    def all_messages() -> list[dict]:
        return _read_messages_db()

else:
    _CLIENT = chromadb.PersistentClient(path=os.getenv("CHROMA_PATH", "chroma_data"))

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

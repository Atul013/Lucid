import os
import json
from pathlib import Path

try:
    import chromadb
    MOCK_MODE = False
except ImportError:
    MOCK_MODE = True

if MOCK_MODE:
    # A simple JSON-based fallback for environments (like Windows without C++ build tools)
    # where compiling chromadb/chroma-hnswlib is not possible.
    MOCK_FILE = Path("chroma_mock_db.json")
    
    def _read_db() -> list[dict]:
        if MOCK_FILE.exists():
            try:
                return json.loads(MOCK_FILE.read_text(encoding="utf-8"))
            except Exception:
                return []
        return []
        
    def _write_db(data: list[dict]):
        MOCK_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

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

    EVENTS_MOCK_FILE = Path("calendar_mock_db.json")

    def _read_events_db() -> list[dict]:
        if EVENTS_MOCK_FILE.exists():
            try:
                return json.loads(EVENTS_MOCK_FILE.read_text(encoding="utf-8"))
            except Exception:
                return []
        return []

    def ingest_events(events: list[dict]) -> int:
        if not events:
            return 0
        by_id = {e["id"]: e for e in _read_events_db()}
        for e in events:
            by_id[e["id"]] = e
        EVENTS_MOCK_FILE.write_text(
            json.dumps(sorted(by_id.values(), key=lambda e: e["start"]), indent=2),
            encoding="utf-8",
        )
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


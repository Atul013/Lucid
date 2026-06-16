import os
import chromadb

# ponytail: HttpClient when running via Docker, direct client for local dev
def _client():
    host = os.getenv("CHROMA_HOST", "localhost")
    port = int(os.getenv("CHROMA_PORT", "8001"))
    if host == "chromadb":
        return chromadb.HttpClient(host=host, port=8000)
    return chromadb.HttpClient(host=host, port=port)


def ingest_emails(emails: list[dict]) -> int:
    if not emails:
        return 0

    col = _client().get_or_create_collection("emails")

    col.upsert(
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
    col = _client().get_or_create_collection("emails")
    results = col.query(query_texts=[query], n_results=n_results)
    docs = results["documents"][0]
    metas = results["metadatas"][0]
    return [{"text": d, **m} for d, m in zip(docs, metas)]

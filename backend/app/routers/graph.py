import json
import re
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app import crypto_store
from app.connectors import chroma, llm

router = APIRouter()

CACHE = Path("graph.json")

SYSTEM = (
    "You map a person's email archive into a knowledge graph. From the sample, "
    "identify the most significant PEOPLE/organizations (senders) and the main "
    "TOPICS/themes running through the mail. Then connect each person to the "
    "topics they relate to. Aim for 6-9 people and 5-8 topics. "
    'Respond ONLY with strict JSON: {"nodes": [{"id": "unique-slug", '
    '"label": "Display Name", "type": "person|topic", "weight": 1-10}], '
    '"edges": [{"source": "node-id", "target": "node-id"}]}. '
    "Edges connect a person id to a topic id. Every edge id must exist in nodes. "
    "No markdown, no text outside the JSON."
)


def _extract_json(s: str) -> dict:
    s = re.sub(r"^```(?:json)?|```$", "", s.strip(), flags=re.MULTILINE).strip()
    start, end = s.find("{"), s.rfind("}")
    if start != -1 and end != -1:
        s = s[start : end + 1]
    return json.loads(s)


def _validate(graph: dict) -> dict:
    nodes = graph.get("nodes", [])
    ids = {n["id"] for n in nodes if "id" in n}
    edges = [
        e
        for e in graph.get("edges", [])
        if e.get("source") in ids and e.get("target") in ids
    ]
    return {"nodes": nodes, "edges": edges}


@router.get("/graph")
def get_graph():
    return crypto_store.read_json(CACHE, {"generated": False, "nodes": [], "edges": []})


@router.post("/graph/build")
def build_graph():
    emails = chroma.sample(limit=70)
    if not emails:
        raise HTTPException(status_code=400, detail="Archive is empty — sync first.")

    catalogue = "\n".join(f"- From {e['from']}: {e['subject']}" for e in emails)
    raw = llm.chat(
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Emails ({len(emails)}):\n{catalogue}"},
        ],
        max_tokens=1600,
        temperature=0.5,
    )
    try:
        graph = _validate(_extract_json(raw))
    except (json.JSONDecodeError, ValueError, KeyError):
        raise HTTPException(status_code=502, detail="Could not build graph — try again.")

    result = {"generated": True, **graph}
    crypto_store.write_json(CACHE, result)
    return result

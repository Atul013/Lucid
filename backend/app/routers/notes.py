from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app import crypto_store
from app.connectors import chroma, notes

router = APIRouter(prefix="/notes")

CONFIG_FILE = Path("notes_config.json")  # gitignored — holds the configured vault path


def _read_config() -> dict:
    return crypto_store.read_json(CONFIG_FILE, {})


def _write_config(cfg: dict):
    crypto_store.write_json(CONFIG_FILE, cfg)


class ConfigureBody(BaseModel):
    path: str


@router.post("/configure")
def configure(body: ConfigureBody):
    """Point Lucid at a local folder of .md files (an Obsidian vault, etc)."""
    if not Path(body.path).is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {body.path}")
    _write_config({"path": body.path})
    return {"path": body.path}


@router.get("/status")
def status():
    cfg = _read_config()
    return {
        "configured": bool(cfg.get("path")),
        "path": cfg.get("path"),
        "notes": len(chroma.all_notes()),
    }


@router.post("/sync")
def sync(path: str | None = None):
    """Scan the configured (or given) folder for .md files and ingest them.

    An explicit `path` overrides and replaces the stored configuration —
    the same pattern as re-pairing an owner: the newest call wins.
    """
    target = path or _read_config().get("path")
    if not target:
        raise HTTPException(status_code=400, detail="No folder configured — POST /notes/configure first.")
    try:
        records = notes.scan_vault(target)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if path:
        _write_config({"path": target})
    ingested = chroma.ingest_notes(records)
    return {"parsed": len(records), "ingested": ingested}


@router.get("/summary")
def summary():
    return notes.summarize(chroma.all_notes())


@router.get("/search")
def search(q: str, n: int = 10):
    return {"results": chroma.search_notes(q, n)}

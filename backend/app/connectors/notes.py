"""Local Notes connector — scans a folder of markdown files (an Obsidian
vault or similar) and normalizes each into a flat record, same parse ->
chroma.ingest_* contract as the finance/health connectors.

No live filesystem watching — that would need a new dependency (watchdog)
and a background thread, like the Telegram poller. Every other connector in
this app syncs on demand (a button, not a daemon), so this does too:
POST /notes/sync re-scans the configured folder.
"""
import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path

_FRONTMATTER = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n?", re.DOTALL)
_FRONTMATTER_DATE = re.compile(r"^date:\s*['\"]?(\d{4}-\d{2}-\d{2})", re.MULTILINE)
_HEADING = re.compile(r"^#\s+(.+)$", re.MULTILINE)
# Obsidian-style inline tags ("#work", "#project/lucid") — requires no space
# after the "#", which is what tells them apart from a markdown heading.
_TAG = re.compile(r"(?<![\w#])#([A-Za-z][\w/-]*)")


def _strip_frontmatter(raw: str) -> tuple[str, str | None]:
    m = _FRONTMATTER.match(raw)
    if not m:
        return raw, None
    return raw[m.end():], m.group(1)


def parse_note_text(relative_path: str, raw: str, mtime: datetime) -> dict:
    """Normalize one markdown file's content into an archive record."""
    body, frontmatter = _strip_frontmatter(raw)

    date = None
    if frontmatter:
        m = _FRONTMATTER_DATE.search(frontmatter)
        if m:
            date = m.group(1)
    if not date:
        date = mtime.date().isoformat()

    heading = _HEADING.search(body)
    title = heading.group(1).strip() if heading else Path(relative_path).stem

    # Comma-joined, not a list — ChromaDB metadata values must be scalars.
    tags = ",".join(sorted(set(_TAG.findall(raw))))

    return {
        "id": hashlib.md5(relative_path.encode()).hexdigest()[:16],
        "path": relative_path,
        "title": title,
        "date": date,
        "tags": tags,
        "text": f"{title}\n\n{body.strip()}",
    }


def scan_vault(root: str) -> list[dict]:
    """Walk `root` for every .md file and parse it into a record."""
    base = Path(root)
    if not base.is_dir():
        raise ValueError(f"Not a directory: {root}")

    records = []
    for path in sorted(base.rglob("*.md")):
        try:
            raw = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        relative_path = path.relative_to(base).as_posix()
        mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        records.append(parse_note_text(relative_path, raw, mtime))

    records.sort(key=lambda r: r["date"])
    return records


def summarize(records: list[dict]) -> dict:
    if not records:
        return {"notes": 0}
    records = sorted(records, key=lambda r: r["date"])
    tag_counts: dict[str, int] = {}
    for r in records:
        for t in filter(None, r.get("tags", "").split(",")):
            tag_counts[t] = tag_counts.get(t, 0) + 1
    return {
        "notes": len(records),
        "from": records[0]["date"],
        "to": records[-1]["date"],
        "top_tags": sorted(tag_counts.items(), key=lambda kv: kv[1], reverse=True)[:10],
    }

"""Shared todo list — editable from the Telegram bot and the REST API."""

import json
import threading
from datetime import datetime, timezone
from pathlib import Path

TODO_FILE = Path("todos.json")
_LOCK = threading.Lock()


def _read() -> dict:
    if TODO_FILE.exists():
        try:
            return json.loads(TODO_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"next_id": 1, "items": []}


def _write(data: dict):
    TODO_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def all_todos() -> list[dict]:
    return _read()["items"]


def add(text: str) -> dict:
    text = text.strip()
    if not text:
        raise ValueError("Todo text is empty.")
    with _LOCK:
        data = _read()
        item = {
            "id": data["next_id"],
            "text": text,
            "done": False,
            "created": datetime.now(timezone.utc).isoformat(),
        }
        data["items"].append(item)
        data["next_id"] += 1
        _write(data)
    return item


def _find(data: dict, number: int) -> dict:
    """Todos are addressed by their 1-based position in the list, the same
    numbering /todo shows — not by internal id."""
    items = data["items"]
    if not 1 <= number <= len(items):
        raise ValueError(f"No todo #{number} — the list has {len(items)} item(s).")
    return items[number - 1]


def set_done(number: int, done: bool = True) -> dict:
    with _LOCK:
        data = _read()
        item = _find(data, number)
        item["done"] = done
        _write(data)
    return item


def edit(number: int, text: str) -> dict:
    text = text.strip()
    if not text:
        raise ValueError("New text is empty.")
    with _LOCK:
        data = _read()
        item = _find(data, number)
        item["text"] = text
        _write(data)
    return item


def delete(number: int) -> dict:
    with _LOCK:
        data = _read()
        item = _find(data, number)
        data["items"].remove(item)
        _write(data)
    return item


def clear_done() -> int:
    with _LOCK:
        data = _read()
        before = len(data["items"])
        data["items"] = [i for i in data["items"] if not i["done"]]
        _write(data)
        return before - len(data["items"])


def render() -> str:
    """Plain-text listing for Telegram."""
    items = all_todos()
    if not items:
        return "Your todo list is empty. Add one with:\n/add buy milk"
    lines = ["📝 Your todos:"]
    for n, item in enumerate(items, 1):
        mark = "✅" if item["done"] else "◻️"
        lines.append(f"{n}. {mark} {item['text']}")
    lines.append("\n/add <text> · /done <n> · /undo <n> · /edit <n> <text> · /del <n> · /clear")
    return "\n".join(lines)

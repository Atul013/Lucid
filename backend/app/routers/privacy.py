"""Data export and right-to-delete.

One place that dumps or purges everything Lucid holds locally, now that
every store shares a single access path (crypto_store) to hang this off —
see PLAN.md Phase 3. Covers the archive collections (emails, transactions,
health, events, messages, notes), every derived-analysis cache (Ego, Drift,
Relationships, Graph, Timeline, Briefing, SNN, agent report), the todo
list, the agent's audit trail, and connector credentials (Gmail OAuth
tokens, Telegram bot config, WhatsApp owner pairing).

Not covered: the real (non-mock) ChromaDB backend's own SQLite files, and
whatever session state the Node WhatsApp bridge keeps for itself — both are
outside this Python process, same caveat as crypto_store.py.
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Response

from app import crypto_store
from app.connectors import agent, chroma, gmail, snn, todos
from app.connectors import telegram as telegram_connector
from app.routers import briefing, drift, ego, graph, notes as notes_mod, relationships, timeline
from app.routers import whatsapp as whatsapp_mod

router = APIRouter(prefix="/privacy")

# Every local JSON cache/credential file, keyed by export field name. Both
# endpoints below iterate this, so adding a new store here is the only step
# needed to bring it under export + purge.
_JSON_STORES = {
    "ego_insights": ego.CACHE,
    "briefing": briefing.CACHE,
    "goals": drift.GOALS_FILE,
    "relationships": relationships.CACHE,
    "graph": graph.CACHE,
    "emotion_timeline": timeline.CACHE,
    "snn_report": snn.REPORT_FILE,
    "agent_report": agent.REPORT_FILE,
    "todos": todos.TODO_FILE,
    "gmail_tokens": gmail.TOKENS_FILE,
    "telegram_config": telegram_connector.CONFIG_FILE,
    "whatsapp_config": whatsapp_mod.CONFIG_FILE,
    "notes_config": notes_mod.CONFIG_FILE,
}


@router.get("/export")
def export_data():
    """Every store Lucid holds locally, bundled as one downloadable JSON."""
    bundle = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "archive": {
            "emails": chroma.all_emails(),
            "transactions": chroma.all_transactions(),
            "health": chroma.all_health(),
            "events": chroma.all_events(),
            "messages": chroma.all_messages(),
            "notes": chroma.all_notes(),
        },
        **{name: crypto_store.read_json(path, None) for name, path in _JSON_STORES.items()},
        "agent_actions": crypto_store.read_lines(agent.ACTION_LOG_FILE),
    }
    filename = f"lucid-export-{datetime.now(timezone.utc).date().isoformat()}.json"
    return Response(
        content=json.dumps(bundle, indent=2, ensure_ascii=False, default=str),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/purge")
def purge_data(confirm: bool = False):
    """Wipe everything — archive collections, every derived cache, and
    connector credentials. Irreversible, so it's a no-op without ?confirm=true."""
    if not confirm:
        return {
            "purged": False,
            "detail": "Pass ?confirm=true to purge — this deletes everything and cannot be undone.",
        }

    chroma.wipe_emails()
    chroma.wipe_transactions()
    chroma.wipe_health()
    chroma.wipe_events()
    chroma.wipe_messages()
    chroma.wipe_notes()

    for path in _JSON_STORES.values():
        path.unlink(missing_ok=True)
    agent.ACTION_LOG_FILE.unlink(missing_ok=True)

    # Route through the connectors' own teardown where one exists, so the
    # live poller/session state doesn't outlive the config it depends on.
    telegram_connector.stop_poller()
    telegram_connector.disconnect()

    return {"purged": True}

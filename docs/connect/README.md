# Connector Setup Guides

Every data source in Lucid connects from the **Connectors** page in the web app. Each card either takes credentials directly in the UI (paste → Connect), reuses an existing login, or accepts a file upload — these guides cover where to get the credentials/files and what to do when something breaks.

| Connector | Type | Guide |
|---|---|---|
| Gmail | Google OAuth (one click) | [GMAIL_CONNECT.md](GMAIL_CONNECT.md) |
| Telegram | Bot token (paste in UI) | [TELEGRAM_CONNECT.md](TELEGRAM_CONNECT.md) |
| WhatsApp | Message Lucid's number | [WHATSAPP_CONNECT.md](WHATSAPP_CONNECT.md) |
| Google Calendar | Reuses Gmail OAuth | [CALENDAR_CONNECT.md](CALENDAR_CONNECT.md) |
| Bank Statement | CSV upload | [FINANCE_CONNECT.md](FINANCE_CONNECT.md) |
| Smartwatch Export | JSON upload | [HEALTH_CONNECT.md](HEALTH_CONNECT.md) |

Planned (cards show **soon**): Notion, Google Keep, Discord, Local Notes.

## The pattern for new connectors

When adding a connector, follow the credential-in-UI pattern Telegram established:

1. **Backend** — `app/connectors/<name>.py` with `connect(credentials)`, `status()`, `is_connected()`, a sync/fetch function, and config persisted to a gitignored local JSON file. Router in `app/routers/<name>.py` with `POST /<name>/connect`, `GET /<name>/status`, `POST /<name>/sync`, `DELETE /<name>/disconnect`.
2. **Storage** — add `ingest_*` / `search_*` / `all_*` to `app/connectors/chroma.py`, in **both** the mock and real branches.
3. **Frontend** — a card on the Connectors page: credential input when disconnected, Sync/Test/Disconnect when connected, inline result notes (no alerts).
4. **Guide** — a `<NAME>_CONNECT.md` in this folder: user steps first, developer setup second, troubleshooting table last. Link it from the card's `guide` prop and this README.

Every demo-able connector should also ship a **Load demo data** action so the app works with zero real accounts.

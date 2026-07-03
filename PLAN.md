# Lucid — Working Plan (Am4l-babu's track)

> What's done, what's next, and where this could go. Vision and phase detail in
> [ROADMAP.md](ROADMAP.md); live team status in [PROGRESS.md](PROGRESS.md).
> Last updated: 2026-07-02

---

## ✅ Done

| When | What |
|---|---|
| 2026-07-02 | **Offline mock mode** committed to main: `chroma.py` falls back to a JSON store when chromadb can't compile (Windows, no C++ build tools); `llm.py` returns Maya-Chen-persona canned replies when `NVIDIA_API_KEY` is unset. App now runs fully out of the box |
| 2026-07-02 | **Financial data connector** — [PR #23](https://github.com/Atul013/Lucid/pull/23) to `development`. CSV parser (debit/credit or signed-amount formats), keyword categorizer, recurring-subscription detector ($315/mo found in demo data), monthly cash-flow summary + next-month forecast. Endpoints: `POST /finance/upload`, `POST /finance/seed`, `GET /finance/summary`, `GET /finance/search`. 3-month mock statement aligned with the expo persona |
| 2026-07-02 | **Health connector** (PR #25), **Malayalam/Manglish sentiment** (PR #26), **Google Calendar connector** (PR #27) — all merged; Phase 1 data foundation complete |
| 2026-07-02 | **Telegram connector + connectors UI + guides** (PR #28) and **todos system with multi-channel reminders** (PR #29) — live bot with /todo commands, web todos page, reminder scheduler (Telegram/WhatsApp/Email/Browser) |
| 2026-07-03 | **Digital Twin simulation engine** (PR #30) — `simulate_workload()`: logistic stress model over calendar × sleep/HRV (pure-Python fallback, no new deps), what-if sliders + risk curves on `/twin`. Phase 2 gate opened |
| 2026-07-03 | **Autonomous agent loop** (`feature/agent-loop`) — dependency-free tool-use loop over `llm.py` (no LangChain): investigates twin/calendar/health/archive, then drafts replies, proposes calendar changes, adds todos, sends a Telegram wrap-up. Async runs with step-by-step progress; scripted mock trajectory offline |

Team foundation already in place (Atul013 & ZayedBH): FastAPI + Next.js scaffold, ChromaDB ingestion, Google OAuth, Gmail connector, Archive/Ego/Drift AI layers, dark-console UI — see PROGRESS.md.

## 🔜 Next up (Phase 3, in order)

1. **Twin × Briefing integration** — surface the twin's stress forecast and the agent's latest proposals in the Morning Briefing (cheap win, everything shares ChromaDB).
2. **SNN tripwire prototype** (`feature/snn-tripwire`) — leaky integrate-and-fire layer in pure NumPy over message-timestamp streams; proves the wake-the-LLM anomaly trigger before adopting Norse.
3. **Scheduled agent runs** — cron/interval trigger for the agent loop (nightly self-review → morning Telegram wrap-up).
4. **Edge groundwork** — privacy tiering of collections (cloud-ok vs local-only) ahead of the Pi Zero 2 W deployment.

Every component follows the CLAUDE.md workflow: PROGRESS.md → feature branch → PR to `development`.

## 💡 Future suggestions & feature ideas

**Near-term, high value**
- **Budget alerts in Morning Briefing** — surface subscription waste and cash-flow forecast from `/finance/summary` in the existing briefing (cheap win, connectors already share ChromaDB).
- **Telegram briefing delivery** — Atul013's Telegram connector is dual-role; the briefing already exists, only the bot-token wiring is deferred.
- **Tests + CI** — the finance parser has clear input/output contracts; a pytest suite + GitHub Actions would protect all connectors as they multiply.
- **Unified `/ingest` metadata registry** — one place listing every collection (emails, transactions, health, events) with counts and last-sync, for the connectors page.

**Medium-term**
- **Cross-domain correlation engine** — the real differentiator: join health × finance × sentiment × calendar by date ("spending spikes follow low-sleep weeks").
- **On-device embeddings** — swap MiniLM in via `sentence-transformers` ONNX/quantized so mock mode gets true vector search (also the path to Pi deployment).
- **Data export / right-to-delete** — one endpoint that dumps or purges everything; personal data deserves it and it's an expo talking point.
- **Drift ↔ Twin merge** — Drift's goal-deviation alerts become the Twin's training signal; don't build them as silos.

**Long-term (Phases 3–4)**
- **SNN tripwire prototype in pure NumPy first** — a leaky integrate-and-fire layer over message-timestamp streams needs no new deps and proves the wake-the-LLM trigger before adopting Norse.
- **Privacy tiering for edge** — classify collections as cloud-ok vs. local-only, so the Pi Zero migration is a config change, not a rewrite.
- **Assistive mode as a first-class product** — offline Malayalam voice + sign-language interaction could stand alone; keep the STT interface decoupled from the twin.

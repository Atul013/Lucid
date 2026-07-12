# Lucid — Working Plan (Am4l-babu's track)

> What's done, what's next, and where this could go. Vision and phase detail in
> [ROADMAP.md](ROADMAP.md); live team status in [PROGRESS.md](PROGRESS.md).
> Last updated: 2026-07-12

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
| 2026-07-06 | **Agent safety hardening** (PR #47) — per-run cooldown (`AGENT_RUN_COOLDOWN_SECONDS`, restart-safe), append-only action audit log (`agent_actions.log`), input bounds on `/twin/simulate` |
| 2026-07-08 | **Mobile client scaffold** (PR #49, React Native/Expo) — Settings + Archive chat screens, credentials in `expo-secure-store` |
| 2026-07-09 | **Twin × Briefing integration** (PR #50) — stress forecast + latest agent run surfaced as stat cards on `/today` |
| 2026-07-10 | **Agent output formatting** (PR #52) — structured `headline` + `bullets` instead of a prose wall, mirrors the Ego/Drift JSON pattern |
| 2026-07-11 | **Budget alerts in Morning Briefing** (PR #54) — subscription cost + next-month cash-flow forecast surfaced from `/finance/summary` |
| 2026-07-11 | **SNN tripwire** (PR #39) — pure-Python LIF spiking layer over email/meeting/spending/health rhythm streams; a fresh trip wakes the agent loop |
| 2026-07-11 | **LAN auto-config** — frontend derives the API base from the browser hostname, wildcard dev origins, private-LAN CORS regex, so phone testing survives wifi/IP changes |
| 2026-07-12 | **Security hardening** (PR #44) — X-API-Key middleware (constant-time compare), per-IP rate limiting, security headers, request audit log |
| 2026-07-12 | **Tests + CI** (PR #56) — 25 pytest tests (finance parser, twin simulation, agent cooldown) + GitHub Actions, confirmed green on ubuntu-latest |
| 2026-07-12 | **Data protection hardening** (PR #57, in review) — Fernet encryption at rest for every local JSON store holding personal data or a live credential (archive/finance/health/calendar/messages, agent report + audit log, Ego/Drift/Relationships/Graph/Timeline/SNN caches, Telegram bot token + session, Gmail OAuth tokens, WhatsApp paired-owner config, todos); agent prompt-injection guard (delimited, labeled-untrusted tool observations); fixed a live access-control bug where any Telegram sender (including anyone in a group the bot was added to) could seize bot ownership and run todo commands / seed the owner's archive |

Team foundation already in place (Atul013 & ZayedBH): FastAPI + Next.js scaffold, ChromaDB ingestion, Google OAuth, Gmail connector, Archive/Ego/Drift AI layers, dark-console UI — see PROGRESS.md.

## 🔜 Next up (Phase 3, in order)

1. **Scheduled agent runs** — cron/interval trigger for the agent loop (nightly self-review → morning Telegram wrap-up). Needs a real trigger to fire at least once (sends a real Telegram message), so hold for explicit go-ahead.
2. **Telegram briefing delivery** — the briefing and the Telegram connector both exist; only the "push today's briefing to Telegram" wiring is missing. `/today` already has a "Telegram delivery — soon" placeholder.
3. **Data export / right-to-delete** — one endpoint that dumps or purges everything; personal data deserves it, and every store now has one consistent access path (`crypto_store`) to hang it off.
4. **Edge groundwork** — privacy tiering of collections (cloud-ok vs local-only) ahead of the Pi Zero 2 W deployment.

Every component follows the CLAUDE.md workflow: PROGRESS.md → feature branch → PR to `development`.

## 💡 Future suggestions & feature ideas

**Near-term, high value**
- **Unified `/ingest` metadata registry** — one place listing every collection (emails, transactions, health, events) with counts and last-sync, for the connectors page.
- **On-device LLM for mobile** — `llama.rn` binding, Phi-3-mini/TinyLlama quantized; scoped but needs Android Studio/Xcode to actually build.
- **Encryption-at-rest for the real ChromaDB path** — `crypto_store.py` only covers the JSON mock stores; the real (non-mock) ChromaDB backend manages its own SQLite file with no pluggable encryption hook, so that path still needs OS-level disk encryption on deploy.

**Medium-term**
- **Cross-domain correlation engine** — the real differentiator: join health × finance × sentiment × calendar by date ("spending spikes follow low-sleep weeks").
- **On-device embeddings** — swap MiniLM in via `sentence-transformers` ONNX/quantized so mock mode gets true vector search (also the path to Pi deployment).
- **Drift ↔ Twin merge** — Drift's goal-deviation alerts become the Twin's training signal; don't build them as silos.

**Long-term (Phases 3–4)**
- **Privacy tiering for edge** — classify collections as cloud-ok vs. local-only, so the Pi Zero migration is a config change, not a rewrite.
- **Assistive mode as a first-class product** — offline Malayalam voice + sign-language interaction could stand alone; keep the STT interface decoupled from the twin.
- **ESP32 environment sensors + Pi Zero 2 W edge deployment** — BME680 + mic dB via MQTT correlated with productivity; FastAPI + ChromaDB tuned for low RAM.

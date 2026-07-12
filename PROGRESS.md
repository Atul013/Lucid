# Lucid — Project Progress

> Single source of truth for what's being built, who's on it, and where things stand.
> Update this file directly on `main` before starting or finishing any component.

---

## Status Legend

| Symbol | Meaning |
|---|---|
| 📋 Todo | Not started |
| 🔄 Ongoing | Someone is actively working on this right now |
| 👀 In Review | PR open, waiting for merge |
| ✅ Done | Merged into `development` |
| 🚫 Blocked | Waiting on something else |

---

## Core Infrastructure

| Component | Status | Assigned To | Branch | Notes |
|---|---|---|---|---|
| Project setup & folder structure | ✅ Done | Atul013 | feature/project-setup | Next.js + FastAPI scaffold |
| ChromaDB setup | ✅ Done | Atul013 | feature/chromadb-ingestion | Local vector DB (PersistentClient) |
| Ingestion pipeline (chunk + embed) | ✅ Done | Atul013 | feature/chromadb-ingestion | Embeds via MiniLM, stores in ChromaDB |
| Google OAuth | ✅ Done | Atul013 | feature/gmail-connector | Needed for Gmail, Keep, Calendar |
| Deployment — Vercel (FE) + Azure (BE) | 📋 Todo | — | — | Split deploy: FE free on Vercel, BE on Azure B1s. Budget: ₹9,569 Azure credit must last until Apr 2027. FE reads NEXT_PUBLIC_API_URL; BE CORS via ALLOWED_ORIGINS |
| Dockerization | 📋 Todo | — | — | Deferred. backend/Dockerfile + compose exist but unused for split deploy; revisit if BE needs containerizing on Azure |
| Tests + CI | 👀 In Review | Am4l-babu | feature/backend-tests-ci | 25 pytest tests (finance parser, twin simulation, agent cooldown) + GitHub Actions workflow. First push failed CI for real (sys.path issue), fixed with pytest.ini, confirmed green on ubuntu-latest (PR #56) |
| Security hardening (API auth + rate limiting) | ✅ Done | Am4l-babu | feature/security-hardening | X-API-Key middleware, per-IP rate limit, security headers, audit log — architecture adapted from secure_os_layer review (PR #44 merged) |

---

## Data Connectors

| Component | Status | Assigned To | Branch | Notes |
|---|---|---|---|---|
| WhatsApp (`whatsapp-web.js`) | 👀 In Review | Atul013 | feature/whatsapp-ingestion | PR #43 — **working end to end**: node bridge, pairing-code ownership, agent replies (todo commands + archive Q&A). Survived WhatsApp's LID migration (identity keyed on chat id, not phone number) |
| Gmail | ✅ Done | Atul013 | feature/gmail-connector | Gmail API + Google OAuth + sync |
| WhatsApp — reply formatting + context | 📋 Todo | — | — | Bot replies are plain prose and stateless. Needs WhatsApp-native formatting (*bold*, line breaks) and conversation context so follow-ups make sense |
| Real data over demo data | 📋 Todo | — | — | **Archive is mostly synthetic**: calendar (211 events) and health (91 records) are seeded mock; Telegram messages = 0. Purge the seed data, sync real Google Calendar, and run the Telegram history import (PR #42) so the AI layers reason over the user's actual life, not `evt_0000` |
| Telegram — run the history import | 📋 Todo | — | — | PR #42 shipped `/telegram/history/*` (Telethon) but it has never been run — needs api_id/api_hash from my.telegram.org. Until then the archive holds zero Telegram messages |
| Telegram | ✅ Done | Am4l-babu | feature/telegram-command-menu | Bot API connector + live bot (todo commands, reminders) + web todos page (PR #28); tappable command menu (PR #35 merged) |
| Telegram — chat history import | ✅ Done | Atul013 | feature/telegram-history | Telethon user-account session reads existing chats → same `messages` archive as the bot (dedup by message id). Complements PR #28: bot = live commands + delivery, history = past conversations |
| Connectors UI — easy connect + guides | ✅ Done | Am4l-babu | feature/telegram-connector | Live credential forms on /connectors (Telegram token, Calendar sync, Finance/Health upload) + docs/connect guides (PR #28 merged) |
| Financial data (mock CSV) | ✅ Done | Am4l-babu | feature/financial-ingestion | Bank-statement CSV parser → categorize spending → ChromaDB (PR #23) |
| Health data (mock smartwatch JSON) | ✅ Done | Am4l-babu | feature/health-ingestion | Sleep, HRV, steps → ChromaDB + sentiment correlation (PR #25) |
| Google Keep | 📋 Todo | — | — | Google API |
| Notion | 📋 Todo | — | — | Notion API |
| Discord | 📋 Todo | — | — | Discord bot API |
| Google Calendar | ✅ Done | Am4l-babu | feature/calendar-connector | Event ingestion + weekly workload analysis (PR #27) |
| Local Notes (Obsidian etc.) | 📋 Todo | — | — | Watch local folder for .md files |

---

## AI Layers

| Component | Status | Assigned To | Branch | Notes |
|---|---|---|---|---|
| Archive — semantic search | 🔄 Ongoing | Atul013 | feature/archive-llm-chat | RAG: vector search + NVIDIA NIM (minimax-m3) |
| Archive — chat UI | 🔄 Ongoing | Atul013 | feature/archive-llm-chat | Ask-mode answers w/ sources |
| Archive — voice interface | 🔄 Ongoing | Atul013 | feature/archive-voice | Browser-native speech → Archive query (no key) |
| Ego — analysis job | 🔄 Ongoing | Atul013 | feature/ego-insights | On-demand LLM pattern finder over archive |
| Ego — insights dashboard | 🔄 Ongoing | Atul013 | feature/ego-insights | Renders Ego analysis output |
| Ego — emotion timeline | 🔄 Ongoing | Atul013 | feature/emotion-timeline | LLM sentiment per day → SVG timeline |
| Drift — goals input | 🔄 Ongoing | Atul013 | feature/drift-goals | User sets goals once |
| Drift — deviation alerts | 🔄 Ongoing | Atul013 | feature/drift-goals | LLM aligns goals vs archive activity |
| Relationship Intelligence | 🔄 Ongoing | Atul013 | feature/relationship-intelligence | LLM over top senders → relationship notes |
| Morning Briefing | 🔄 Ongoing | Atul013 | feature/morning-briefing | LLM briefing (Archive+Ego+Drift) + Today view; Telegram delivery deferred (needs bot token) |

---

## Digital Twin Track

> Long-range phases from [ROADMAP.md](ROADMAP.md); working plan in [PLAN.md](PLAN.md). Software phases first — hardware waits.

| Component | Status | Assigned To | Branch | Notes |
|---|---|---|---|---|
| Malayalam/Manglish sentiment | ✅ Done | Am4l-babu | feature/malayalam-sentiment | Code-mixed lexicon engine + optional Indic transformer (PR #26) |
| Digital Twin — simulation engine | ✅ Done | Am4l-babu | feature/twin-simulation | simulate_workload(): stress probability from calendar + health, what-if sliders + risk curves on /twin (PR #30 merged) |
| Agent loop — safety hardening | ✅ Done | Am4l-babu | feature/agent-safety-hardening | Phase 2 gap the generic API-key middleware doesn't cover: per-run cooldown to protect the LLM/Azure budget, persistent append-only audit trail of agent actions (drafts/proposals/todos/Telegram sends), input bounds on /twin/simulate (PR #47 merged) |
| Agent — output formatting | ✅ Done | Am4l-babu | feature/agent-output-formatting-clean | finish()/send_telegram() now take (headline, bullets) instead of free text, mirroring Ego/Drift's structured pattern; /agent Wrap-up + Telegram action cards render headline+bullets (PR #52 merged) |
| Autonomous agent loop | ✅ Done | Am4l-babu | feature/agent-loop | Tool-use loop: investigates twin/calendar/health/archive → drafts, calendar proposals, todos, Telegram wrap-up; /agent UI (PR #32 merged); reliability fix in PR #34 |
| SNN tripwire | ✅ Done | Am4l-babu | feature/snn-tripwire | Pure-Python LIF layer over 6 life-rhythm streams; /tripwire UI; wake=true launches the agent on fresh trips (PR #39 merged) |
| Edge deployment (Pi Zero 2 W) | 📋 Todo | — | — | FastAPI + ChromaDB on Pi, low-RAM tuning |
| ESP32 environment nodes | 📋 Todo | — | — | BME680 + mic dB via MQTT → productivity correlation |
| FOV camera + assistive interaction | 📋 Todo | — | — | MediaPipe posture/presence; faster-whisper offline STT; sign language |
| Twin × Briefing integration | ✅ Done | Am4l-babu | feature/twin-briefing-integration | Surfaces the twin's stress forecast and the agent's latest run as structured fields on /briefing, plus two stat cards on /today (PR #50 merged). Visually verified with Playwright — both cards render correctly, zero console errors |
| Budget alerts in Morning Briefing | ✅ Done | Am4l-babu | feature/budget-briefing | Same pattern as Twin x Briefing: surface subscription waste + next-month cash-flow forecast from /finance/summary as a third stat card on /today (PR #54 merged) |

---

## Frontend

| Component | Status | Assigned To | Branch | Notes |
|---|---|---|---|---|
| UI Redesign — dark console theme | 👀 In Review | ZayedBH | feature/ui-dark-console | PR #36: todos ripple grid, lamp hero, landing scroll fix, CORS patch |
| Dashboard layout | 🔄 Ongoing | Atul013 | feature/dashboard-layout | Shared nav across Archive · Ego · Drift |
| Connectors page | 👀 In Review | Atul013 | feature/connectors-onboarding | Connect Gmail + sync flow (first-run onboarding) |
| Archive chat page | ✅ Done | Atul013 | feature/archive-search-ui | Editorial minimalist search UI over /gmail/search |
| Ego insights page | 🔄 Ongoing | Atul013 | feature/ego-insights | /ego route |
| Drift goals page | 🔄 Ongoing | Atul013 | feature/drift-goals | /drift route |
| Relationship Intelligence page | 🔄 Ongoing | Atul013 | feature/relationship-intelligence | /relationships route |
| Emotion Timeline page | 🔄 Ongoing | Atul013 | feature/emotion-timeline | /timeline route |
| Visual Knowledge Graph | 🔄 Ongoing | Atul013 | feature/knowledge-graph | Animated force-directed constellation (canvas) |
| Mobile app (React Native/Expo) | ✅ Done | Am4l-babu | feature/mobile-client-rn | New client surface, not a rebuild: Archive chat screen against the hardened backend (X-API-Key) (PR #49 merged). Web target verified working; Android/iOS device launch still unverified — needs testing on a machine with native tooling |
| Mobile — on-device LLM (local+cloud hybrid) | 📋 Todo | — | — | Follow-up scoped in mobile/README.md: llama.rn binding, Phi-3-mini/TinyLlama quantized, route to backend for anything heavier. Needs Android Studio/Xcode + a real device/emulator to build and test |

---

## Final

| Component | Status | Assigned To | Branch | Notes |
|---|---|---|---|---|
| UI polish | 🔄 Ongoing | Atul013 | feature/ui-polish | Mobile-safe nav, consistency pass |
| Expo demo prep | 🔄 Ongoing | Atul013 | feature/expo-prep | Demo script + mock-data seed + deployment guide |

---

## Activity Log

| Date | User | Action |
|---|---|---|
| 2026-06-15 | Atul013 | Project initialized |
| 2026-06-16 | Atul013 | Started project setup & folder structure |
| 2026-06-16 | Atul013 | Started Gmail connector |
| 2026-06-16 | Atul013 | Started ChromaDB setup + ingestion pipeline |
| 2026-06-28 | Atul013 | Opened PR #22 (connectors page) → development |
| 2026-06-28 | Atul013 | Started Telegram connector |
| 2026-06-20 | Atul013 | Decided split deploy (Vercel FE + Azure BE); dockerization deferred |
| 2026-06-20 | Atul013 | UI polish — mobile-safe nav |
| 2026-06-20 | Atul013 | Started Connect Gmail + sync onboarding flow |
| 2026-06-20 | Atul013 | Started Archive LLM (RAG via NVIDIA NIM) + chat/ask UI |
| 2026-06-20 | Atul013 | Started Ego analysis job + insights page |
| 2026-06-20 | Atul013 | Started Drift goals input + alignment check |
| 2026-06-20 | Atul013 | Started Dashboard layout (shared nav) |
| 2026-06-20 | ZayedBH | Started UI redesign — dark console theme (feature/ui-dark-console) |
| 2026-06-20 | Atul013 | Batch: voice, knowledge graph, relationships, emotion timeline, briefing, expo prep |
| 2026-06-21 | Atul013 | Started WhatsApp connector (Node.js bridge, Business account on spare SIM) |
| 2026-07-02 | Am4l-babu | Started financial data connector (mock CSV ingestion) |
| 2026-07-02 | Am4l-babu | Opened PR #23 (financial ingestion) → development |
| 2026-07-02 | Am4l-babu | Added digital-twin roadmap: ROADMAP.md, PLAN.md + new planned components |
| 2026-07-02 | Am4l-babu | Started health data connector (mock smartwatch JSON) |
| 2026-07-02 | Am4l-babu | Opened PR #25 (health ingestion) → development |
| 2026-07-02 | Am4l-babu | Started Malayalam/Manglish sentiment module |
| 2026-07-02 | Am4l-babu | Opened PR #26 (malayalam sentiment) → development |
| 2026-07-02 | Am4l-babu | Started Google Calendar connector |
| 2026-07-11 | Am4l-babu | Started security hardening (API key auth + rate limiting) |
| 2026-07-11 | Am4l-babu | Opened PR #44 (security hardening) → development |
| 2026-07-12 | Am4l-babu | PR #44 merged — security hardening done |
| 2026-07-12 | Am4l-babu | Started agent loop safety hardening (run cooldown, action audit trail, twin input bounds) |
| 2026-07-12 | Am4l-babu | Opened PR #47 (agent loop safety hardening) → development |
| 2026-07-12 | Am4l-babu | PR #47 merged — agent loop safety hardening done |
| 2026-07-12 | Am4l-babu | Started mobile app (React Native/Expo) — Archive chat screen against hardened backend; on-device LLM scoped as follow-up |
| 2026-07-12 | Am4l-babu | Opened PR #49 (mobile client scaffold) → development — device/emulator launch needs verification on a machine with Android Studio/Xcode |
| 2026-07-12 | Am4l-babu | Fixed SecureStore web-target crash (found by running expo start --web), pushed to PR #49 |
| 2026-07-12 | Am4l-babu | PR #49 merged — mobile app scaffold done; logged on-device LLM as the next scoped TODO |
| 2026-07-12 | Am4l-babu | Started Twin × Briefing integration — surfacing stress forecast + latest agent run in the Morning Briefing |
| 2026-07-12 | Am4l-babu | Opened PR #50 (twin x briefing) → development, then visually verified with Playwright and merged |
| 2026-07-12 | Am4l-babu | Started agent output formatting — structure agent replies for /agent, Telegram, WhatsApp |
| 2026-07-12 | Am4l-babu | Opened PR #52 (agent output formatting) → development. Caught an accidental direct commit to main before pushing, recovered via cherry-pick onto a clean branch — main unaffected |
| 2026-07-12 | Am4l-babu | PR #52 merged — agent output formatting done |
| 2026-07-12 | Am4l-babu | Started budget alerts in Morning Briefing — subscription waste + cash-flow forecast on /today |
| 2026-07-12 | Am4l-babu | Opened PR #54 (budget alerts) → development |
| 2026-07-12 | Am4l-babu | PR #54 merged — budget alerts done |
| 2026-07-12 | Am4l-babu | Started tests + CI — pytest for finance parser + twin simulation, GitHub Actions workflow |
| 2026-07-12 | Am4l-babu | Opened PR #56 (tests + CI). CI caught a real sys.path bug on first run; fixed and confirmed green |
| 2026-07-02 | Am4l-babu | Opened PR #27 (calendar connector) → development |
| 2026-07-02 | Am4l-babu | PRs #23, #25, #26, #27 merged — finance, health, sentiment, calendar done |
| 2026-07-02 | Am4l-babu | Took over Telegram connector (Atul013 had it marked, no branch pushed) + connectors UI easy-connect rework + setup guides |
| 2026-07-02 | Am4l-babu | Opened PR #28 (telegram connector + connectors UI + docs/connect guides) → development |
| 2026-07-03 | Am4l-babu | PR #28 merged — telegram, connectors UI, todos + reminders done |
| 2026-07-03 | Am4l-babu | Started Digital Twin simulation engine (feature/twin-simulation) |
| 2026-07-03 | Am4l-babu | Opened PR #29 (todos web page + reminders — commit that missed the PR #28 merge) → development |
| 2026-07-03 | Am4l-babu | Opened PR #30 (twin simulation engine + /twin what-if UI) → development |
| 2026-07-03 | Am4l-babu | PRs #29, #30 merged — todos system + twin simulation done; PR #31 cut development → main |
| 2026-07-03 | Am4l-babu | Started autonomous agent loop (feature/agent-loop) |
| 2026-07-03 | Am4l-babu | Opened PR #32 (autonomous agent loop + /agent UI) → development |
| 2026-07-05 | Am4l-babu | PR #32 merged; live-tested agent runs against NVIDIA NIM surfaced 429s and step-budget exhaustion |
| 2026-07-05 | Am4l-babu | Opened PR #34 (agent reliability fix — 429 backoff, longer budget, wrap-up nudge — commit that missed the PR #32 merge) → development |
| 2026-07-05 | Am4l-babu | Added Telegram tappable command menu (setMyCommands); opened PR #35 → development |
| 2026-07-06 | ZayedBH | Todos ripple grid, lamp hero, landing scroll fix, CORS patch; opened PR #36 → development |
| 2026-07-07 | Am4l-babu | PRs #34, #35, #36 merged; PR #37 cut development → main |
| 2026-07-07 | Am4l-babu | Opened PR #38 (LAN auto-config — API base from browser hostname, wildcard dev origins, private-LAN CORS) → development |
| 2026-07-07 | Am4l-babu | Started SNN tripwire (feature/snn-tripwire) |
| 2026-07-07 | Am4l-babu | Opened PR #39 (SNN tripwire + /tripwire UI) → development; live wake test launched a real agent run |
| 2026-07-11 | Atul013 | Cut PR #41 (LAN auto-config) development → main |
| 2026-07-11 | Atul013 | Started Telegram chat-history import (Telethon) — pairs with the bot connector |
| 2026-07-11 | Atul013 | Opened PR #42 (Telegram chat-history import via Telethon) → development |
| 2026-07-11 | Atul013 | Opened PR #43 (WhatsApp — Node bridge + shared-archive ingest) → development |
| 2026-07-11 | Am4l-babu | PRs #38, #39 merged — LAN auto-config + SNN tripwire done |
| 2026-07-12 | Atul013 | WhatsApp connector working end to end (pairing code + agent replies); fixed WhatsApp LID migration breakage |
| 2026-07-12 | Atul013 | Logged: archive is mostly seeded demo data (calendar/health synthetic, Telegram empty) — AI layers are reasoning over fake inputs |

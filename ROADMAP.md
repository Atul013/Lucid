# Lucid — Roadmap

> *You already know yourself. You just can't see it yet.*
>
> This is the **living roadmap**: where Lucid is, where it's going, and the full
> idea backlog with honest impact/effort calls. Day-to-day status lives in
> [PROGRESS.md](PROGRESS.md) · the working plan in [PLAN.md](PLAN.md) · a styled
> browsable version of this file is at [docs/roadmap.html](docs/roadmap.html).
>
> **Last updated:** 2026-07-18 · This file replaces the 2026-07-02 phase roadmap —
> every idea from it is preserved below (most of its Phases 1–3 have shipped).

**How this roadmap works (solo-friendly):** no assignments, no dates. Ideas live
in **horizons** — *Now → Next → Later → Edge*. An idea "graduates" by getting a
row in PROGRESS.md and a `feature/*` branch. One rule survives from the old
roadmap unchanged: **do not jump to hardware until the software foundation is solid.**

---

## Where Lucid stands — July 2026

| Pillar | State |
| --- | --- |
| **Connectors** | Gmail ✅ · Telegram bot + history ✅ · Calendar ✅ · Finance ✅ · Health ✅ · Local Notes 👀 · WhatsApp bridge 👀 (working end-to-end) · Keep / Notion / Discord 📋 |
| **Intelligence** | Twin simulation ✅ · Autonomous agent ✅ (safety-hardened, structured output) · SNN tripwire ✅ · Malayalam/Manglish sentiment ✅ · Archive RAG / Ego / Drift / Relationships / Briefing 🔄 |
| **Surfaces** | Web dashboard (dark console) 🔄 · Mobile (Expo) ✅ scaffold · Telegram live bot ✅ · WhatsApp replies 👀 |
| **Trust** | API-key auth + rate limiting ✅ · Encryption at rest (all stores) ✅ · Export / right-to-delete ✅ · Prompt-injection guard ✅ |
| **Infra** | Tests + CI ✅ (70 pytest) · Oracle ARM deploy 🔄 · Dockerization deferred |

The uncomfortable truth driving Horizon 1: **the archive is still mostly synthetic**
(seeded calendar/health, zero Telegram history imported). The intelligence layers
are real; the life they reason about isn't yet.

```mermaid
flowchart LR
    H1["🔴 NOW<br/>Make it real"] --> H2["🟡 NEXT<br/>Close the loop"] --> H3["🟢 LATER<br/>The twin grows up"] --> H4["🔵 EDGE<br/>A physical body"]
```

---

## 🔴 Horizon 1 — NOW · *Make it real*

*Theme: Lucid must reason about a real life, not `evt_0000`. Everything here is
unblocking, not new surface area.*

| # | Item | Why it's first |
| --- | --- | --- |
| 1.1 | **Real data over demo data** — purge seeds, sync real Calendar, run the Telegram history import (PR #42 shipped, never executed) | Every AI layer's output is currently a demo of itself. This single item upgrades *all* of them at once |
| 1.2 | **Oracle ARM deployment** — FastAPI + Chroma + WhatsApp bridge + Caddy HTTPS on Always Free ARM; FE on Vercel | Always-on is what makes a "passive twin" honest — briefings, tripwire and bots can't run on a laptop that sleeps. Keeps the ₹9,569 credit untouched |
| 1.3 | **Land the in-review train** — WhatsApp ingestion (#43), reply formatting (#63), Local Notes (#64), dark console UI (#36), connectors onboarding | Six open PRs is inventory, not progress |
| 1.4 | **Scheduler** — cron-style nightly jobs: ego refresh, drift check, morning briefing at 7am, SNN feed | The layers exist but are on-demand; "it just shows up" is the product promise |
| 1.5 | **Data-freshness panel** — per-connector last-sync + record counts on /connectors | Makes stale/synthetic data *visible* so 1.1 never regresses silently |

## 🟡 Horizon 2 — NEXT · *Close the loop*

*Theme: from "answers questions about you" to "tells you things you didn't ask."*

| # | Item | Notes |
| --- | --- | --- |
| 2.1 | **Weekly Review** — auto Sunday retro: wins, drift deltas, relationship changes, spend vs. forecast, next-week risk from the twin | The natural sibling of Morning Briefing; highest insight-per-token feature available |
| 2.2 | **Memory resurfacing** — "one year ago today", resurfaced abandoned threads/intentions | Ego already finds "mentioned learning design 6×, zero action" — this closes the loop by bringing it back at the right moment |
| 2.3 | **Relationship nudges** — "you haven't replied to X in 12 days; you usually reply within 1" | Relationship Intelligence exists; nudges make it actionable |
| 2.4 | **Remaining connectors** — Google Keep, Notion, Discord | From the original README table |
| 2.5 | **New connector candidates** — browser history/screen-time (productivity ground truth), Spotify (mood signal), photos EXIF (location/timeline) | Each is a cheap, high-signal stream; screen-time pairs directly with the life-coach idea (3.2) |
| 2.6 | **Eval harness** — golden-question set per AI layer, run in CI against mock archive | The only defense against silent quality regressions as prompts/models change |
| 2.7 | **Cost telemetry** — NIM token usage + per-feature spend on a /system page | The agent already has cooldowns; this makes the budget visible before it's a problem |
| 2.8 | **Mobile on-device LLM** — llama.rn + quantized Phi-3-mini/TinyLlama, hybrid routing to backend | Scoped in mobile/README.md; blocked on native tooling (NDK/Xcode) |
| 2.9 | **Secret auto-redaction** — scrub OTPs, account numbers, passwords at ingestion time | The archive ingests everything; some things shouldn't be remembered even encrypted |

## 🟢 Horizon 3 — LATER · *The twin grows up*

*Carried forward from the old roadmap's Phases 1–2 (unshipped items), deepened.*

| # | Item | Notes |
| --- | --- | --- |
| 3.1 | **Predictive analytics** — Prophet/ARIMA forecasts: workload, stress peaks, goal-miss probability | Old 1.8; the twin's simulate_workload() is the foundation |
| 3.2 | **Personal life coach** — peak-productivity windows from calendar + screen-time; protect them (DND, app blocking) | Old 1.5; needs connector 2.5 first |
| 3.3 | **Smart home bridge** — Home Assistant API: stress level / calendar status → IoT routines (lights, phone DND) | Old 1.7; also the natural bridge to the DOMORA-style home-twin work |
| 3.4 | **Agent maturity** — auto-draft follow-ups, calendar reordering proposals, meeting scheduling | Old 2.2 second half; agent loop + safety rails already shipped |
| 3.5 | **Cultural nuance deepening** — grow the Malayalam/Manglish module beyond lexicon + Indic transformer | Old 2.3 |
| 3.6 | **Team memory (enterprise mode)** — multi-tenant vector DB over Slack/Teams/transcripts | Old 1.6; the only B2B-shaped idea — park until a real user asks |
| 3.7 | **Health APIs** — Apple Health / Google Fit replacing mock smartwatch JSON | Old 1.2 second half |
| 3.8 | **Financial APIs** — Plaid / Razorpay replacing mock CSV | Old 1.1 second half |

## 🔵 Horizon 4 — EDGE · *A physical body*

*The old Phase 3–4, preserved intact. Enters only when Horizons 1–2 are done —
the hardware rule stands.*

| # | Item | Notes |
| --- | --- | --- |
| 4.1 | **SNN wake-the-LLM at the edge** | Tripwire ✅ shipped in software; the edge version makes it a 24/7 sub-watt sentinel |
| 4.2 | **Edge node** — Pi Zero 2 W running FastAPI + Chroma, low-RAM tuned; memory bank never touches the cloud | Ultimate privacy posture |
| 4.3 | **3D-printed enclosure** — vented desk "Home Intelligence Hub" | |
| 4.4 | **ESP32 environment nodes** — BME680 + mic dB → MQTT → *"coding errors up 40% when CO2 > 1000 ppm"* | |
| 4.5 | **FOV camera** — MediaPipe presence/posture | |
| 4.6 | **Offline assistive interaction** — faster-whisper local STT; sign-language-to-speech | |

---

## Suggestions & upgrades — rated backlog

New ideas beyond the horizons above, rated ⭐ impact / 🔨 effort (1–3). Pull from
here when a horizon feels thin.

| Idea | ⭐ | 🔨 | Why / honest caveat |
| --- | --- | --- | --- |
| **Encrypted off-device backup** — /privacy/export → scheduled encrypted snapshot to Drive/S3 | ⭐⭐⭐ | 🔨 | One laptop dying currently erases the twin's entire memory. Export endpoint exists; this is a cron + cipher away |
| **Archive search filters** — `from:`, `source:`, date-range operators in chat + UI chips | ⭐⭐ | 🔨 | RAG answers improve dramatically when the user can scope; cheap win |
| **Voice journal quick-capture** — hold-to-record note → whisper STT → archive | ⭐⭐ | 🔨🔨 | The one place manual input is worth it: thoughts that never hit any messenger |
| **Notification digest discipline** — one daily Telegram digest instead of per-event pings | ⭐⭐ | 🔨 | Alert fatigue is how personal-AI apps get uninstalled; budget notifications like money |
| **Twin webhooks** — outbound events (stress spike, drift alert) as webhooks for IFTTT/HA | ⭐⭐ | 🔨 | Makes Lucid composable before 3.3 builds the full bridge |
| **Yearly "Lucid Wrapped"** — annual self-portrait: patterns, people, drift arc | ⭐⭐⭐ | 🔨🔨 | Weekly Review's big sibling; the shareable-moment feature (share by choice — it's private data) |
| **Multi-model routing** — cheap/local model for classification & summaries, NIM only for deep analysis | ⭐⭐ | 🔨🔨 | Extends mock-mode's fastembed pattern upward; protects budget as usage grows |
| **Conversation memory for the web chat** | ⭐⭐ | 🔨 | WhatsApp got a rolling window in PR #63 — port the same pattern to /archive chat |
| **Ego confidence + evidence links** — every insight cites the messages it derived from | ⭐⭐⭐ | 🔨🔨 | Trust feature: "3× more agreeable after 11pm" should be clickable to proof. Also catches hallucinated insights |
| **Streaks & habit detection** — recurring behaviors auto-detected, tracked without manual habit entry | ⭐⭐ | 🔨🔨 | Fits the no-manual-input philosophy; Drift's data can power it |
| **Docs site** — publish docs/ as GitHub Pages (roadmap.html is the first page) | ⭐ | 🔨 | Free, and the expo demo can link to it |

---

## Principles (solo guardrails)

1. **Vertical slices** — every branch ships something visible end-to-end; no layer-only work.
2. **Mock-first, real-second** — every connector works keyless in mock mode so demos never depend on credentials.
3. **Privacy is a feature, not a section** — encryption, export, purge, redaction ship *with* features, not after them.
4. **The archive is the product** — connectors and AI layers are both replaceable; the accumulated, owned memory is not.
5. **Hardware waits** — the rule that opened the old roadmap still closes this one.
6. **PROGRESS.md discipline** — an idea isn't real until it has a row and a branch; this file is for ideas, that file is for truth.

---

## Stack notes

- Python 3.10 · FastAPI · Next.js · ChromaDB (fastembed ONNX MiniLM mock fallback — real cosine search without a C++ toolchain)
- LLM: NVIDIA NIM (minimax-m3) with keyless mock mode; multi-model routing planned (see backlog)
- ML: NumPy · scikit-learn / Prophet (forecasting) · pure-Python LIF SNN (Norse if the edge version needs it)
- Deploy: Vercel (FE) + Oracle Always Free ARM (BE, 4 OCPU/24 GB) + Caddy HTTPS; ₹9,569 Azure credit held in reserve until Apr 2027
- Mobile: Expo/React Native; llama.rn planned for on-device inference
- Hardware targets (Horizon 4): Raspberry Pi Zero 2 W · ESP32 + BME680 · FOV camera module

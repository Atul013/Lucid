# Lucid — Deployment

Split deploy: **frontend on Vercel (free), backend on Azure (B1s)**. Chosen so the
₹9,569 Azure credit lasts past April and the frontend stays fast/global.

---

## Frontend → Vercel (free)

1. Push the repo to GitHub (done).
2. On Vercel: **New Project** → import the repo → set **Root Directory** to `frontend`.
3. Add env vars:
   - `NEXT_PUBLIC_API_URL` = `https://<your-azure-backend-url>`
   - `NEXT_PUBLIC_LUCID_API_KEY` = same value as the backend's `LUCID_API_KEY`
4. Deploy. Vercel auto-builds on every push to the branch you select.

No Dockerfile needed — Vercel detects Next.js.

---

## Backend → Azure (B1s VM)

The backend is plain FastAPI + a local ChromaDB folder. Simplest reliable path is a
small Linux VM.

1. Create a **B1s** Ubuntu VM (~$8/mo; fits the credit for a year). Open ports 22 and 443 (or 8000 for a quick start).
2. SSH in, install Python 3.11 and the deps:
   ```bash
   sudo apt update && sudo apt install -y python3.11 python3.11-venv git
   git clone <repo> && cd lucid/backend
   python3.11 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. Create `.env` on the server (never committed):
   ```
   ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app
   FRONTEND_URL=https://<your-vercel-app>.vercel.app
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://<your-backend-domain>/auth/google/callback
   NVIDIA_API_KEY=...
   LUCID_API_KEY=<long random string — python -c "import secrets; print(secrets.token_urlsafe(32))">
   ```
4. Run it (behind a process manager so it survives reboots):
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   For production, put it behind **Caddy** (auto-HTTPS in ~3 lines) and run uvicorn via `systemd`.

### Three things that MUST change for production

- **Google OAuth needs HTTPS.** Add the new `https://<backend>/auth/google/callback`
  to the GCP OAuth client's authorized redirect URIs, and update `GOOGLE_REDIRECT_URI`.
- **CORS:** `ALLOWED_ORIGINS` must list the Vercel URL exactly.
- **API key:** set `LUCID_API_KEY` on the backend and the same value as
  `NEXT_PUBLIC_LUCID_API_KEY` on Vercel. Without it the API is open to anyone
  who finds the URL — it guards personal archive data. Rate limiting
  (`RATE_LIMIT_PER_MINUTE`, default 300/min/IP), a 5 MB payload cap and an
  audit log are always on; see `backend/app/security.py`.

---

## Memory note (B1s is 1GB RAM)

FastAPI + the MiniLM embedding model + ChromaDB fit on 1GB for a demo with curated
data. If it OOMs under real volume, either size up to B1ms (~$15/mo) or move embeddings
to **Qdrant Cloud** (free tier) so the VM only runs the API. See `PROGRESS.md` notes.

---

## Persisted state on the backend

These files live next to the backend and hold runtime state (all gitignored):
`tokens.json`, `chroma_data/`, `ego_insights.json`, `goals.json`, `graph.json`,
`relationships.json`, `timeline.json`, `briefing.json`, `telegram_config.json`,
`whatsapp_config.json`, `whatsapp_service/.wwebjs_auth/`. Back up `chroma_data/` if the
indexed archive matters; the rest regenerate — **except the two configs and
`.wwebjs_auth/`, which hold live sessions and ownership. Losing `.wwebjs_auth/`
unlinks WhatsApp and forces a QR re-scan.**

---

## WhatsApp bridge → always-on host

The bridge is the one component that **cannot** go on a serverless platform. It is not
an API client: `whatsapp-web.js` drives a **headless Chromium** via Puppeteer, so it
needs a long-running process, ~1GB RAM, and a persistent disk for the session.

That rules out Vercel, Netlify, and Cloudflare Workers (no long-running process), and
Render's free tier (spins down when idle + ephemeral disk → the session dies and you
re-scan the QR constantly).

**It also cannot be deployed alone.** The bridge POSTs every message to `FASTAPI_URL`,
so it must be able to reach the backend. Simplest: run the bridge **on the same host as
the backend** and point it at `http://localhost:8000`.

### Recommended: Oracle Cloud Always Free (ARM Ampere A1)

Free forever (not a trial), up to 4 cores / 24GB RAM, persistent block storage — far
more headroom than Chromium needs, and it leaves the Azure credit untouched.

Caveats worth knowing up front:
- Popular regions often return **"out of host capacity"** for ARM. Retry, or pick a
  quieter region.
- **ARM needs the system Chromium.** Puppeteer's bundled build is x86-only and will not
  start. Install it and point the bridge at it (the bridge reads
  `PUPPETEER_EXECUTABLE_PATH`).

```bash
sudo apt update
sudo apt install -y nodejs npm chromium-browser
cd lucid/backend/whatsapp_service && npm install --omit=dev
```

`.env` on the server:

```
FASTAPI_URL=http://localhost:8000
WA_SERVICE_PORT=3001
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser   # ARM: required
WA_AUTH_PATH=/var/lib/lucid/wwebjs_auth               # persistent volume
```

Run it under systemd so it survives reboots — `/etc/systemd/system/lucid-wa.service`:

```ini
[Unit]
Description=Lucid WhatsApp bridge
After=network.target

[Service]
WorkingDirectory=/opt/lucid/backend/whatsapp_service
EnvironmentFile=/opt/lucid/.env
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
User=lucid

[Install]
WantedBy=multi-user.target
```

```bash
sudo mkdir -p /var/lib/lucid/wwebjs_auth && sudo chown lucid /var/lib/lucid/wwebjs_auth
sudo systemctl enable --now lucid-wa
sudo journalctl -u lucid-wa -f     # the QR prints here on first run
```

### Linking the account (once)

Scan the QR from `journalctl` with the **Lucid Business** number. This is an
**operator** step, done once on the server — users never scan anything. Because
`WA_AUTH_PATH` is on a persistent volume, the session survives restarts and redeploys.

Users connect by messaging Lucid a **pairing code** from `/connectors`, which binds
their chat as the archive owner. See `docs/connect/WHATSAPP_CONNECT.md`.

### Do not expose port 3001

The bridge's `/send` has no auth — anything that can reach it can send WhatsApp messages
as Lucid. Keep it bound to localhost / closed in the security list; only the backend on
the same host should talk to it.

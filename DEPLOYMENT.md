# Lucid — Deployment

**Frontend on Vercel (free). Everything else on one Oracle Cloud "Always Free" ARM VM.**

Oracle's Always Free ARM tier (4 OCPU / 24GB RAM) is genuinely free forever — not a
trial — and it is the only free option that can host the WhatsApp bridge, which needs a
long-running process, ~1GB RAM for headless Chromium, and a persistent disk. This also
leaves the ₹9,569 Azure credit untouched.

```
                    ┌──────────────────────── Oracle ARM VM (free) ─────────┐
Browser ─── HTTPS ──┤  Caddy (TLS)                                          │
   │                │    └── https://lucid.duckdns.org → 127.0.0.1:8000     │
   │                │                                                        │
   └── Vercel (FE)  │  uvicorn/FastAPI :8000 ── ChromaDB (local disk)       │
                    │  WhatsApp bridge :3001 (loopback only) ── Chromium    │
                    └────────────────────────────────────────────────────────┘
```

---

## HTTPS is not optional

Three separate things break without it, so do the domain + TLS step first:

- **Google OAuth rejects non-HTTPS redirect URIs** → Gmail and Calendar connectors die.
- **Browser speech (Archive voice) requires a secure context** → the mic never opens.
- **Vercel serves the frontend over HTTPS**, so a call to `http://<vm-ip>:8000` is
  **mixed content and the browser blocks it outright.**

Free path: a **DuckDNS** subdomain + Caddy (Let's Encrypt in three lines).

---

## 1. Create the VM

Oracle Cloud → **Compute → Instances → Create instance**

- **Image:** Ubuntu 22.04
- **Shape:** `VM.Standard.A1.Flex` — **4 OCPU, 24 GB RAM**
  (that's the entire Always Free ARM allowance; take it all, it costs nothing)
- **Networking:** assign a public IPv4
- Save the SSH private key.

> **"Out of host capacity"** is common for ARM in busy regions. Retry, or create in a
> quieter region. Hyderabad is usually fine.

### Open ports — *both* places

This is the classic Oracle trap. The VCN security list is only half of it; **Ubuntu
images also ship with iptables blocking everything**, and people lose hours here.

**a) VCN:** Networking → your VCN → Security Lists → add **Ingress** rules for
TCP **80** and **443** from `0.0.0.0/0`.

**b) On the host:**

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

**Do not open 8000 or 3001.** Both stay on loopback behind Caddy — see the security
notes at the bottom.

---

## 2. Point a domain at it (DuckDNS, free)

1. [duckdns.org](https://duckdns.org) → sign in → create e.g. `lucid`.
2. Set the IP to the VM's public IPv4.
3. You now have `https://lucid.duckdns.org` (once Caddy issues the cert below).

---

## 3. Base setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv git nodejs npm chromium-browser

# Caddy (TLS + reverse proxy)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

sudo useradd -r -m -d /opt/lucid -s /bin/bash lucid
sudo -u lucid git clone https://github.com/Atul013/Lucid.git /opt/lucid/app
```

Backend deps:

```bash
cd /opt/lucid/app/backend
sudo -u lucid python3.11 -m venv .venv
sudo -u lucid .venv/bin/pip install -r requirements.txt
```

Bridge deps:

```bash
cd /opt/lucid/app/backend/whatsapp_service
sudo -u lucid npm install --omit=dev
```

---

## 4. Secrets

Generate both — **neither is optional in production.** The app boots without them and
logs a warning, which is easy to miss:

```bash
python3 -c "import secrets; print('LUCID_API_KEY=' + secrets.token_urlsafe(32))"
python3 -c "from cryptography.fernet import Fernet; print('LUCID_ENCRYPTION_KEY=' + Fernet.generate_key().decode())"
```

- **`LUCID_API_KEY`** — without it, **your personal archive API is open to anyone who
  finds the URL.** Every route except the public ones requires `X-API-Key`.
- **`LUCID_ENCRYPTION_KEY`** — without it, `telegram_config.json` (your bot token) and
  `whatsapp_config.json` (archive ownership) sit in **plaintext on disk**. With it, both
  are Fernet-encrypted. Existing plaintext files are read fine and re-encrypted on the
  next write, so turning this on is safe.

`/opt/lucid/.env` (owned by `lucid`, `chmod 600`):

```bash
# --- public URLs ---
ALLOWED_ORIGINS=https://<your-app>.vercel.app
FRONTEND_URL=https://<your-app>.vercel.app

# --- secrets (generated above) ---
LUCID_API_KEY=...
LUCID_ENCRYPTION_KEY=...

# --- Google (Gmail + Calendar) ---
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://lucid.duckdns.org/auth/google/callback

# --- LLM ---
NVIDIA_API_KEY=...

# --- WhatsApp bridge ---
FASTAPI_URL=http://localhost:8000
WA_SERVICE_PORT=3001
WA_SERVICE_HOST=127.0.0.1
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser   # ARM: required
WA_AUTH_PATH=/var/lib/lucid/wwebjs_auth               # persistent session
```

> **ARM gotcha:** Puppeteer's bundled Chromium is x86-only and will not start. The
> `PUPPETEER_EXECUTABLE_PATH` line above is what makes the bridge work on Ampere.

Also update the **Google Cloud OAuth client**: add
`https://lucid.duckdns.org/auth/google/callback` to its authorized redirect URIs, or
Gmail/Calendar will fail on first connect.

---

## 5. systemd

`/etc/systemd/system/lucid-api.service`:

```ini
[Unit]
Description=Lucid API
After=network.target

[Service]
User=lucid
WorkingDirectory=/opt/lucid/app/backend
EnvironmentFile=/opt/lucid/.env
ExecStart=/opt/lucid/app/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/lucid-wa.service`:

```ini
[Unit]
Description=Lucid WhatsApp bridge
After=network.target lucid-api.service

[Service]
User=lucid
WorkingDirectory=/opt/lucid/app/backend/whatsapp_service
EnvironmentFile=/opt/lucid/.env
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo mkdir -p /var/lib/lucid/wwebjs_auth && sudo chown -R lucid /var/lib/lucid
sudo systemctl daemon-reload
sudo systemctl enable --now lucid-api lucid-wa
```

---

## 6. Caddy

`/etc/caddy/Caddyfile`:

```
lucid.duckdns.org {
    reverse_proxy 127.0.0.1:8000
}
```

```bash
sudo systemctl restart caddy
curl https://lucid.duckdns.org/health     # -> {"status":"ok"}
```

Caddy fetches and renews the Let's Encrypt cert automatically. That's the whole TLS setup.

---

## 7. Frontend → Vercel

1. Vercel → **New Project** → import the repo → **Root Directory** = `frontend`.
2. Env vars:
   - `NEXT_PUBLIC_API_URL` = `https://lucid.duckdns.org`
   - `NEXT_PUBLIC_LUCID_API_KEY` = the same value as the backend's `LUCID_API_KEY`
3. Deploy. Auto-builds on every push.

Then set `ALLOWED_ORIGINS` on the VM to the exact Vercel URL and
`sudo systemctl restart lucid-api`.

---

## 8. Link WhatsApp (once)

```bash
sudo journalctl -u lucid-wa -f     # the QR prints here on first run
```

Scan it with the **Lucid Business** number (`+91 99952 65115`). This is an **operator**
step, done once on the server — **users never scan a QR.** Because `WA_AUTH_PATH` is on
a persistent path, the session survives restarts and redeploys.

Users connect by messaging Lucid a **pairing code** from `/connectors`, which binds
their chat as the archive owner. See `docs/connect/WHATSAPP_CONNECT.md`.

---

## Security notes

- **Never expose 3001.** The bridge's `/send` has **no auth** — anything that can reach
  it can send WhatsApp messages as Lucid. It binds `127.0.0.1` by default; keep it that
  way, and keep the port out of the VCN security list.
- **Never expose 8000.** Caddy is the only public entry point.
- Rate limiting (`RATE_LIMIT_PER_MINUTE`, default 300/min/IP), a 5 MB payload cap and an
  audit log are always on — see `backend/app/security.py`.

## Persisted state — back this up

All gitignored, all on the VM:
`chroma_data/` (the archive), `tokens.json`, `telegram_config.json`,
`whatsapp_config.json`, `/var/lib/lucid/wwebjs_auth/`, plus the generated
`ego_insights.json`, `goals.json`, `graph.json`, `relationships.json`, `timeline.json`,
`briefing.json`.

The generated ones regenerate. **The configs and `wwebjs_auth/` do not** — they hold
live sessions and ownership. Lose `wwebjs_auth/` and WhatsApp unlinks, forcing a QR
re-scan.

## Free-tier limits

4 OCPU / 24GB RAM, 200GB block storage, 10TB egress/month — far more than Lucid needs.
Idle ARM instances can be reclaimed by Oracle; a always-on bridge + API keeps it active.

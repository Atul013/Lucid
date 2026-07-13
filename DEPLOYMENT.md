# Lucid — Deployment

**Frontend on Vercel (free). Everything else on one DigitalOcean droplet.**

Use the **$200 DigitalOcean credit** from the GitHub Student Developer Pack. A 4GB
droplet is $24/month, so the credit covers ~8 months — well past the expo.

> **Why not Oracle / Heroku / Render?**
> - **Oracle Always Free ARM** — free forever and technically ideal, but capacity in
>   Hyderabad is chronically exhausted ("Out of capacity for shape VM.Standard.A1.Flex")
>   and the Pay-As-You-Go upgrade that would fix it requires a *credit* card. The retry
>   script (`scripts/oracle-grab-arm.ps1`) is still there if you want to chase it.
> - **Heroku / Render** — **no persistent disk**, and dynos cycle daily. That deletes
>   `.wwebjs_auth` (the WhatsApp session) and `chroma_data/` (the whole archive) every
>   24 hours. Non-starter, at any price.

```
                    ┌───────────────── DigitalOcean droplet (Ubuntu) ────────┐
Browser ─── HTTPS ──┤  Caddy (TLS)                                          │
   │                │    └── https://lucid.duckdns.org → 127.0.0.1:8000     │
   │                │                                                        │
   └── Vercel (FE)  │  uvicorn/FastAPI :8000 ── ChromaDB (local disk)       │
                    │  WhatsApp bridge :3001 (loopback only) ── Chrome      │
                    └────────────────────────────────────────────────────────┘
```

---

## HTTPS is not optional

Three separate things break without it, so do the domain + TLS step early:

- **Google OAuth rejects non-HTTPS redirect URIs** → Gmail and Calendar connectors die.
- **Browser speech (Archive voice) requires a secure context** → the mic never opens.
- **Vercel serves the frontend over HTTPS**, so a call to `http://<droplet-ip>:8000` is
  **mixed content and the browser blocks it outright.**

Free path: a **DuckDNS** subdomain + Caddy (Let's Encrypt in three lines).

---

## 1. Create the droplet

DigitalOcean → **Create → Droplets**

- **Region:** Bangalore (`BLR1`) — lowest latency from India
- **Image:** Ubuntu **24.04 LTS**
- **Size:** Basic → Regular → **$24/mo (4 GB RAM / 2 vCPU / 80 GB SSD)**
- **Authentication:** **SSH key** → paste the contents of your public key
  (`C:\Users\Icarus\.ssh\lucid.pub`; generate with
  `ssh-keygen -t ed25519 -f $HOME\.ssh\lucid` if you don't have one)
- **Hostname:** `lucid`

> **Why 4 GB?** Headless Chrome for the WhatsApp bridge is ~1 GB on its own, on top of
> FastAPI + ChromaDB + the embedding model. 2 GB ($12/mo) can work with swap, but it's
> tight and you'll feel it on ingest. 4 GB is the comfortable floor.

The droplet is live in ~60 seconds. Copy its **public IPv4**.

---

## 2. Point a domain at it (DuckDNS, free)

1. [duckdns.org](https://duckdns.org) → sign in → create a subdomain, e.g. `lucid`.
2. Set the IP to the droplet's public IPv4.
3. You now have `lucid.duckdns.org` (HTTPS arrives with Caddy in step 6).

---

## 3. SSH in

```powershell
ssh -i $HOME\.ssh\lucid root@<droplet-ip>
```

> **Windows gotcha:** if you get `UNPROTECTED PRIVATE KEY FILE`, Windows has the key
> readable by too many accounts. Fix it:
> ```powershell
> icacls "$HOME\.ssh\lucid" /inheritance:r /grant:r "$($env:USERNAME):R"
> ```

---

## 4. Base setup

```bash
apt update && apt upgrade -y
apt install -y python3.12 python3.12-venv python3-pip git curl

# Node 20 (Ubuntu's default is older than whatsapp-web.js likes)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Chrome for the WhatsApp bridge. Installing the real .deb lets apt resolve the
# ~40 shared libraries headless Chrome needs — far less painful than hunting them
# down one "error while loading shared libraries" at a time.
wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt install -y ./google-chrome-stable_current_amd64.deb
rm google-chrome-stable_current_amd64.deb

# Caddy (TLS + reverse proxy)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Firewall: only SSH + HTTP(S). 8000 and 3001 stay private — see Security notes.
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

App user + code:

```bash
useradd -m -s /bin/bash lucid
sudo -u lucid git clone https://github.com/Atul013/Lucid.git /home/lucid/app

cd /home/lucid/app/backend
sudo -u lucid python3.12 -m venv .venv
sudo -u lucid .venv/bin/pip install -r requirements.txt

cd /home/lucid/app/backend/whatsapp_service
sudo -u lucid npm install --omit=dev
```

---

## 5. Secrets and `.env`

Generate both — **neither is optional in production.** The app boots without them and
only logs a warning, which is easy to miss:

```bash
python3 -c "import secrets; print('LUCID_API_KEY=' + secrets.token_urlsafe(32))"
python3 -c "from cryptography.fernet import Fernet; print('LUCID_ENCRYPTION_KEY=' + Fernet.generate_key().decode())"
```

- **`LUCID_API_KEY`** — without it, **your personal archive API is open to anyone who
  finds the URL.** Every route except the public ones requires `X-API-Key`.
- **`LUCID_ENCRYPTION_KEY`** — without it, `telegram_config.json` (your bot token) and
  `whatsapp_config.json` (archive ownership) sit in **plaintext on disk**. With it, both
  are Fernet-encrypted. Existing plaintext files are read fine and re-encrypted on the
  next write, so switching it on is safe.

Write `/home/lucid/.env` (`chown lucid`, `chmod 600`):

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
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
WA_AUTH_PATH=/var/lib/lucid/wwebjs_auth
```

Also update the **Google Cloud OAuth client**: add
`https://lucid.duckdns.org/auth/google/callback` to its authorized redirect URIs, or
Gmail/Calendar fail on first connect.

---

## 6. systemd

`/etc/systemd/system/lucid-api.service`:

```ini
[Unit]
Description=Lucid API
After=network.target

[Service]
User=lucid
WorkingDirectory=/home/lucid/app/backend
EnvironmentFile=/home/lucid/.env
ExecStart=/home/lucid/app/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
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
WorkingDirectory=/home/lucid/app/backend/whatsapp_service
EnvironmentFile=/home/lucid/.env
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
# SIGTERM (systemd's default) is load-bearing here — see "Keeping WhatsApp linked".
# Never set KillSignal=SIGKILL.
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

```bash
mkdir -p /var/lib/lucid/wwebjs_auth && chown -R lucid /var/lib/lucid
systemctl daemon-reload
systemctl enable --now lucid-api lucid-wa
```

---

## 7. Caddy

`/etc/caddy/Caddyfile`:

```
lucid.duckdns.org {
    reverse_proxy 127.0.0.1:8000
}
```

```bash
systemctl restart caddy
curl https://lucid.duckdns.org/health     # -> {"status":"ok"}
```

Caddy fetches and renews the Let's Encrypt certificate automatically. That's the whole
TLS setup.

---

## 8. Frontend → Vercel

**You do not need a separate repo.** Vercel handles the monorepo with one setting.

1. Vercel → **New Project** → import the repo → **Root Directory** = `frontend`.
2. Env vars:
   - `NEXT_PUBLIC_API_URL` = `https://lucid.duckdns.org`
   - `NEXT_PUBLIC_LUCID_API_KEY` = the same value as the backend's `LUCID_API_KEY`
3. Deploy. Auto-builds on every push.

**Then close the loop** — this is easy to forget and looks like a totally broken app:
set `ALLOWED_ORIGINS` on the droplet to the exact Vercel URL and
`systemctl restart lucid-api`. Skip it and every API call dies on CORS.

---

## 9. Link WhatsApp (once)

```bash
journalctl -u lucid-wa -f     # the QR prints here on first run
```

Scan it with the **Lucid Business** number. This is an **operator** step, done once on
the server — **users never scan a QR.** They connect by messaging Lucid a **pairing
code** from `/connectors`, which binds their chat as the archive owner. See
`docs/connect/WHATSAPP_CONNECT.md`.

Prefer the browser? `/connectors` → WhatsApp card → *"Service offline — operator setup"*
→ **Show link QR**.

Then take a snapshot immediately (see below).

---

## Keeping WhatsApp linked (read this before you deploy)

The session is **not a token** — it is a whole ~130MB Chrome profile, backed by LevelDB,
living in `WA_AUTH_PATH`. If it's lost *or corrupted*, whatsapp-web.js can't tell the
difference: both look like "not logged in", and the bridge comes back demanding a QR. On
a server that means SSHing in and scanning a code that **rotates every ~20s**, with the
business-SIM phone in hand — on every restart. In practice the bridge just goes quietly
offline and messages are lost until someone notices.

Three things prevent that, all already in place:

**1. Persistent absolute path.** `WA_AUTH_PATH=/var/lib/lucid/wwebjs_auth` — a real
disk, outside the git checkout, so redeploys don't touch it. (The default
`./.wwebjs_auth` is relative to the *working directory*; under systemd that can silently
resolve elsewhere and create a fresh, empty profile while the real one sits untouched.)

**2. Graceful shutdown.** The bridge traps SIGTERM/SIGINT and calls `client.destroy()`
so Chrome flushes LevelDB and releases its locks. Without it, **even a routine
`systemctl restart` can corrupt the profile and unlink the account** — Node's default is
to exit immediately.

**3. A snapshot.** Take one right after linking:

```bash
cd /home/lucid/app/backend/whatsapp_service
sudo -u lucid WA_AUTH_PATH=/var/lib/lucid/wwebjs_auth npm run session:backup
```

If it ever unlinks, restore rather than hunting for the phone:

```bash
systemctl stop lucid-wa
sudo -u lucid WA_AUTH_PATH=/var/lib/lucid/wwebjs_auth npm run session:restore
systemctl start lucid-wa
```

> **If it still unlinks repeatedly**, the escalation is whatsapp-web.js's `RemoteAuth`,
> which stores the session in MongoDB/S3 instead of local disk. It is deliberately *not*
> used here: it puts a database in the critical path and is slow with a 130MB profile.
> Reach for it only if the above proves insufficient.

---

## Security notes

- **Never expose 3001.** The bridge's `/send` has **no auth** — anything that can reach
  it can send WhatsApp messages as Lucid. It binds `127.0.0.1` by default; keep it that
  way and keep the port out of `ufw`.
- **Never expose 8000.** Caddy is the only public entry point.
- Rate limiting (`RATE_LIMIT_PER_MINUTE`, default 300/min/IP), a 5 MB payload cap and an
  audit log are always on — see `backend/app/security.py`.

## Persisted state — back this up

All gitignored, all on the droplet:
`chroma_data/` (the archive), `tokens.json`, `telegram_config.json`,
`whatsapp_config.json`, `/var/lib/lucid/wwebjs_auth/`, plus the generated
`ego_insights.json`, `goals.json`, `graph.json`, `relationships.json`, `timeline.json`,
`briefing.json`.

The generated ones regenerate. **The configs and `wwebjs_auth/` do not** — they hold
live sessions and ownership.

DigitalOcean snapshots ($1.20/mo for this droplet) are the cheapest insurance; take one
once WhatsApp is linked and everything is synced.

## Cost

$24/month against the **$200 GitHub Student credit** → free for ~8 months. Set a billing
alert in DO so the credit running out doesn't surprise you.

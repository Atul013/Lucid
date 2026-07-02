# Connect WhatsApp to Lucid

WhatsApp works differently from the other connectors: instead of you giving Lucid credentials, **Lucid has its own WhatsApp number** (+91 99952 65115, a Business account on a spare SIM) running through a `whatsapp-web.js` bridge.

---

## For users

1. Open the **Connectors** page → WhatsApp card → **Message Lucid on WhatsApp →**.
2. That opens a chat with Lucid's number, pre-filled with a greeting. Send it.
3. Your messages land in the archive, and Lucid replies with AI-generated responses.

That's the whole setup — the connection is per-conversation, no tokens needed.

---

## For developers (running the bridge)

The bridge is a Node.js microservice in `backend/whatsapp_service/`:

```bash
cd backend/whatsapp_service
npm install
npm start
```

- First run shows a **QR code** in the terminal — scan it with the Lucid phone's WhatsApp (Linked devices → Link a device).
- The session persists in `.wwebjs_auth/` (gitignored), so the QR scan is one-time.
- The FastAPI backend talks to the bridge at `WA_SERVICE_URL` (default `http://localhost:3001`) — set in `backend/.env` along with `LUCID_WA_NUMBER`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Card shows Not connected | The Node bridge isn't running, or `WA_SERVICE_URL` is wrong. |
| Bridge asks for QR again | Session expired or `.wwebjs_auth/` was deleted — rescan. |
| Messages not archived | Check the bridge terminal for errors; confirm the backend is reachable from the bridge. |

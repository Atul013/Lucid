require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const express = require("express");

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";
const PORT = parseInt(process.env.WA_SERVICE_PORT ?? "3001");
// Lucid's WhatsApp Business number (no + prefix, with country code)
const LUCID_NUMBER = process.env.LUCID_WA_NUMBER ?? "919995265115";

// ── WhatsApp client ──────────────────────────────────────────────────────────

const client = new Client({
  // dataPath must be a persistent volume in production — lose it and the
  // account unlinks, forcing a QR re-scan on every restart.
  authStrategy: new LocalAuth({
    dataPath: process.env.WA_AUTH_PATH ?? "./.wwebjs_auth",
  }),
  puppeteer: {
    headless: true,
    // On ARM (e.g. Oracle Ampere) Puppeteer's bundled Chromium is x86-only and
    // won't start — point at the system browser instead:
    //   sudo apt install -y chromium-browser
    //   PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
    ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    }),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // Chromium's default /dev/shm is tiny on small VMs and crashes the tab.
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  },
});

// The most recent QR, held as a data-URL so /connectors can render it in the
// browser instead of making you read it off a terminal. WhatsApp rotates the
// code every ~20s, so this is always overwritten with the live one.
let currentQR = null;

client.on("qr", (qr) => {
  console.log("\n[Lucid WA] Scan this QR with WhatsApp Business:\n");
  qrcode.generate(qr, { small: true });
  QRCode.toDataURL(qr, { margin: 1, width: 320 })
    .then((dataUrl) => {
      currentQR = dataUrl;
    })
    .catch((err) => console.error("[Lucid WA] QR render failed:", err.message));
});

client.on("authenticated", () => {
  console.log("[Lucid WA] Authenticated ✓");
});

client.on("ready", () => {
  currentQR = null; // linked — nothing left to scan
  console.log("[Lucid WA] Client ready — connected as", LUCID_NUMBER);
});

client.on("disconnected", (reason) => {
  console.warn("[Lucid WA] Disconnected:", reason, "— restarting...");
  client.initialize();
});

// Incoming message → forward to FastAPI for archiving
client.on("message", async (msg) => {
  if (msg.fromMe) return; // ignore echoes of our own sends

  const contact = await msg.getContact();

  // Identity is the chat id (`6837…@lid` or `9199…@c.us`), never a phone number.
  // Since WhatsApp's LID migration, contact.number is often empty and msg.from
  // is a LID — so any attempt to derive a phone number is unreliable. The chat
  // id is stable per contact AND is exactly the address a reply must go to, so
  // we key ownership off it and treat the number as display metadata only.
  const chatId = msg.from;
  const number = contact.number || null;

  const payload = {
    from: contact.pushname || number || chatId,
    number,
    chat_id: chatId,
    body: msg.body,
    timestamp: msg.timestamp,
    type: "whatsapp",
  };

  try {
    const res = await fetch(`${FASTAPI_URL}/whatsapp/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error("[Lucid WA] Ingest failed:", await res.text());
  } catch (err) {
    console.error("[Lucid WA] Ingest error:", err.message);
  }
});

client.initialize();

// ── Express API (called by FastAPI to send outbound messages) ────────────────

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ready: client.info != null });
});

// Live QR for the browser connect flow. Null once the account is linked.
app.get("/qr", (_req, res) => {
  res.json({ ready: client.info != null, qr: currentQR });
});

// Send a message to a recipient
// POST /send  { to: "919876543210", message: "Good morning..." }
app.post("/send", async (req, res) => {
  const { to, chatId, message } = req.body;
  if (!message || (!to && !chatId)) {
    return res.status(400).json({ error: "message and one of chatId/to are required" });
  }
  if (!client.info) {
    return res.status(503).json({ error: "WhatsApp not ready yet" });
  }
  try {
    // Replying to the chat id we received the message on is the only reliable
    // path: it needs no lookup and works for both LID and c.us chats. `to` (a
    // raw phone number) is the fallback for outbound messages we initiate,
    // where WhatsApp has to resolve the id for us.
    let target = chatId;
    if (!target) {
      const numberId = await client.getNumberId(to);
      if (!numberId) {
        return res.status(404).json({ error: `${to} is not on WhatsApp` });
      }
      target = numberId._serialized;
    }
    await client.sendMessage(target, message);
    res.json({ ok: true, chatId: target });
  } catch (err) {
    console.error("[Lucid WA] Send error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Bind to loopback by default: /send has no auth, so anything that can reach
// this port can send WhatsApp messages as Lucid. Only the backend (same host)
// should talk to it. Override with WA_SERVICE_HOST if you know what you're doing.
const HOST = process.env.WA_SERVICE_HOST ?? "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`[Lucid WA] Bridge listening on http://${HOST}:${PORT}`);
});

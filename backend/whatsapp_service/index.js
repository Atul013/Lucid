require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";
const PORT = parseInt(process.env.WA_SERVICE_PORT ?? "3001");
// Lucid's WhatsApp Business number (no + prefix, with country code)
const LUCID_NUMBER = process.env.LUCID_WA_NUMBER ?? "919995265115";

// ── WhatsApp client ──────────────────────────────────────────────────────────

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("\n[Lucid WA] Scan this QR with WhatsApp Business:\n");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("[Lucid WA] Authenticated ✓");
});

client.on("ready", () => {
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
  const payload = {
    from: contact.pushname || contact.number,
    number: msg.from.replace("@c.us", ""),
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

// Send a message to a recipient
// POST /send  { to: "919876543210", message: "Good morning..." }
app.post("/send", async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: "to and message are required" });
  }
  if (!client.info) {
    return res.status(503).json({ error: "WhatsApp not ready yet" });
  }
  try {
    const chatId = `${to}@c.us`;
    await client.sendMessage(chatId, message);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Lucid WA] Send error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Lucid WA] Bridge listening on http://localhost:${PORT}`);
});

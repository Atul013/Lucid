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
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
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

  // WhatsApp now addresses chats by LID (`6837…@lid`), not `<number>@c.us`, so
  // stripping "@c.us" off msg.from can hand back a LID instead of a phone
  // number — which silently breaks the owner allowlist and the reply path.
  // contact.number is the real phone number; fall back to stripping either suffix.
  const number = contact.number || msg.from.replace(/@(c\.us|lid|s\.whatsapp\.net)$/, "");

  const payload = {
    from: contact.pushname || number,
    number,
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
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: "to and message are required" });
  }
  if (!client.info) {
    return res.status(503).json({ error: "WhatsApp not ready yet" });
  }
  try {
    // Let WhatsApp resolve the chat id rather than assuming `<number>@c.us`.
    // Newer WhatsApp Web addresses chats by LID, and hand-built c.us ids blow
    // up inside the client ("Invariant Violation ... getChatRecordByAccountLid").
    const numberId = await client.getNumberId(to);
    if (!numberId) {
      return res.status(404).json({ error: `${to} is not on WhatsApp` });
    }
    await client.sendMessage(numberId._serialized, message);
    res.json({ ok: true, chatId: numberId._serialized });
  } catch (err) {
    console.error("[Lucid WA] Send error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Lucid WA] Bridge listening on http://localhost:${PORT}`);
});

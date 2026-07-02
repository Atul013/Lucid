# Connect Telegram to Lucid

Telegram plays a **dual role** in Lucid:

1. **Data source** — messages you (or a group) send to your bot are synced into the archive, searchable and sentiment-analyzed like everything else.
2. **Delivery channel** — Lucid pushes your morning briefing and drift alerts back to your chat.

Total setup time: about 60 seconds. No developer account, no API approval, free forever.

---

## Step 1 — Create your bot with @BotFather

BotFather is Telegram's official bot for making bots.

1. Open Telegram (phone or desktop) and search for **@BotFather** — verified with a blue check.
2. Press **Start**.
3. Send the command:
   ```
   /newbot
   ```
4. BotFather asks for a **display name** — anything you like, e.g. `Lucid`.
5. Then it asks for a **username** — must be unique and end in `bot`, e.g. `amal_lucid_bot`.
6. BotFather replies with your **bot token**. It looks like:
   ```
   8123456789:AAFxk3lQ9dW-EXAMPLE-TOKEN-uY2vZq1mNo4
   ```

> ⚠️ **Treat the token like a password.** Anyone who has it controls your bot. Lucid stores it locally in `telegram_config.json` (gitignored) — it never leaves your machine.

---

## Step 2 — Paste the token into Lucid

1. Open the Lucid web app → **Connectors** page.
2. On the **Telegram** card, paste the token into the input field.
3. Click **Connect**. Lucid validates it against the Telegram API and shows your bot's @username when it succeeds.

If you get an error:
- `Unauthorized` → the token is wrong or was revoked. Get a fresh one with `/token` in BotFather.
- `Could not reach Telegram` → backend has no internet, or Telegram is blocked on your network.

---

## Step 3 — Say hi to your bot

Telegram bots can't message you first. One-time handshake:

1. In Telegram, search for your bot's username (e.g. `@amal_lucid_bot`).
2. Press **Start** and send it any message — `hi` works.
3. Back in Lucid, click **Sync messages** on the Telegram card.

That sync does two things: archives your message, and **learns your chat ID** so Lucid can reply. From now on **Send test** (and briefings/alerts) will land in that chat.

---

## Step 4 — (Optional) Add the bot to a group

To archive a group chat (e.g. your project group):

1. Open the group → **Add members** → add your bot.
2. By default bots only see messages that start with `/` or mention them. To capture everything, disable privacy mode:
   - In BotFather: `/mybots` → pick your bot → **Bot Settings** → **Group Privacy** → **Turn off**.
   - Remove and re-add the bot to the group after changing this.
3. Click **Sync messages** in Lucid — group messages now flow into the archive (and the Malayalam/Manglish sentiment engine, if they're in Manglish).

---

## API endpoints (for testing without the UI)

```bash
# Connect
curl -X POST http://localhost:8000/telegram/connect \
  -H "Content-Type: application/json" \
  -d '{"bot_token": "8123456789:AAF..."}'

# Status
curl http://localhost:8000/telegram/status

# Pull new messages into the archive
curl -X POST http://localhost:8000/telegram/sync

# Send yourself a message
curl -X POST http://localhost:8000/telegram/send \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from Lucid"}'

# Search archived messages
curl "http://localhost:8000/telegram/search?q=launch"

# Pin a specific chat for outgoing messages (e.g. a group)
curl -X POST http://localhost:8000/telegram/chat-id \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "-1001234567890"}'

# Disconnect (deletes the stored token)
curl -X DELETE http://localhost:8000/telegram/disconnect
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sync says "no new messages" | You haven't messaged the bot yet, or you already synced those messages. Send a new one. |
| Send test fails with "No chat_id yet" | Do Step 3 — message the bot once, then Sync. |
| Group messages don't appear | Privacy mode is on — see Step 4. |
| Token stopped working | Someone ran `/revoke` in BotFather. Generate a new token and reconnect. |
| Two people want to use the same bot | Don't — each person creates their own bot (30 seconds) so archives stay separate. |

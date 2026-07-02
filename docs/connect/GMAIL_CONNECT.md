# Connect Gmail to Lucid

Gmail is Lucid's primary data source: emails are fetched read-only, embedded locally, and become the archive that Ego, Drift and the Briefing reason over. **Nothing leaves your machine** — the OAuth tokens and the email index are stored locally.

---

## For users (bot credentials already set up)

1. Open the Lucid web app → **Connectors** page.
2. On the **Gmail** card, click **Connect Gmail →**.
3. You're sent to Google's consent screen. Pick your account and approve:
   - *Read your email* (`gmail.readonly`)
   - *See your calendars* (`calendar.readonly`) — shared with the Calendar connector
4. Google redirects you back to Lucid. The card now shows **Connected**.
5. Click **Sync now** — the latest 50 emails are fetched and indexed.

Re-run **Sync now** any time to pull newer mail. Re-ingestion is idempotent — no duplicates.

> If you connected before the Calendar scope was added, click **Reconnect** once so the new permission is granted.

---

## For developers (setting up OAuth credentials)

One person per deployment does this once; everyone else just clicks Connect.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project (e.g. `lucid`).
2. **APIs & Services → Library** → enable **Gmail API** and **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**, publishing status: **Testing**.
   - Add every teammate's Gmail address under **Test users** (max 100).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URI: `http://localhost:8000/auth/google/callback`
5. Copy the client ID and secret into `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
   ```
6. Restart the backend.

Tokens are saved to `tokens.json` (gitignored) after the first successful login.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Error 403: access_denied` on consent screen | Your address isn't in the project's Test users list — ask whoever owns the Google Cloud project to add it. |
| `redirect_uri_mismatch` | The redirect URI in `.env` must exactly match the one registered in Cloud Console. |
| Calendar sync fails after Gmail works | Reconnect Gmail once — the calendar scope was added later. |
| Status shows Error | Backend isn't running or `NEXT_PUBLIC_API_URL` points to the wrong host. |

# Connect Google Calendar to Lucid

Calendar events feed the **Digital Twin's workload history**: weekly meeting hours, overload weeks, after-hours creep. Phase 2's `simulate_workload()` trains on this series.

Calendar **reuses the Gmail OAuth connection** — there is no separate login.

---

## Steps

1. Connect Gmail first (see [GMAIL_CONNECT.md](GMAIL_CONNECT.md)). The consent screen already includes the `calendar.readonly` scope.
   - Connected Gmail *before* the calendar scope existed? Click **Reconnect** on the Gmail card once.
2. On the **Google Calendar** card, click **Sync Google Calendar** — pulls up to 250 events from your primary calendar.
3. No Google account handy? Click **Load demo events** — 211 mock events (3 months of Maya Chen's calendar, including the June launch crunch) so every downstream feature works.

---

## What Lucid computes from it

- `GET /calendar/summary` — weekly workload series, overload weeks (>1.3× median), busiest day, after-hours meeting creep, top recurring meetings.
- `GET /calendar/search?q=standup` — semantic/keyword search over events.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sync → `401 Google not connected` | Connect Gmail first. |
| Sync → `Calendar API error: ... insufficient scopes` | Reconnect Gmail so the calendar scope is granted. |
| Summary → `No calendar data` | Seed or sync first. |

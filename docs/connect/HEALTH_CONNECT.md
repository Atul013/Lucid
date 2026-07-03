# Connect Smartwatch Health Data to Lucid

The health connector ingests a smartwatch JSON export — sleep, HRV, resting heart rate, steps, stress — and correlates it with your mood timeline. This is the Digital Twin's body-signal history.

---

## Steps

1. Export your data from your watch app (most apps: Profile → Settings → Export data → JSON).
2. **Connectors** page → **Smartwatch Export** card → **Upload JSON**.
3. Or **Load demo export** — 91 days of mock data including a launch-crunch rough patch.

## Supported JSON shapes

Both of these work:

```json
{ "records": [ { "date": "2026-06-01", "sleep_hours": 7.4, "hrv": 62, ... } ] }
```

```json
[ { "date": "2026-06-01", "sleep_hours": 7.4, "hrv": 62, ... } ]
```

Recognized per-day fields (all optional except `date`): `sleep_hours`, `sleep_score`, `bedtime`, `hrv`, `resting_hr`, `steps`, `stress`, `active_minutes`. Nested `{"sleep": {"hours": ...}}` shapes are flattened automatically.

## What Lucid computes

- `GET /health-data/summary` — averages, monthly trend, last-7-days vs. baseline, sleep debt, **rough-patch detection** (3+ consecutive days of <6h sleep or depressed HRV)
- `GET /health-data/correlation` — Pearson correlation of sleep/HRV/steps/stress against your daily sentiment (build the emotion timeline first: `POST /ego/timeline/build`)
- `GET /health-data/search?q=bad sleep`

## Troubleshooting

| Symptom | Fix |
|---|---|
| `400: No usable daily records found` | No objects with a parseable `date` field — check the export format. |
| Correlation → `Emotion timeline not built yet` | Run the timeline build on the Ego page (or `POST /ego/timeline/build`) first. |
| Upload fails with a JSON error | The file isn't valid JSON — re-export, don't hand-edit. |

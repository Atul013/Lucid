# Connect your Bank Statement to Lucid

The finance connector turns a bank-statement CSV into categorized spending, subscription detection, and a cash-flow forecast. Parsing happens entirely on your machine.

---

## Steps

1. Export a statement as **CSV** from your bank's site or app.
2. Open the **Connectors** page → **Bank Statement** card → **Upload CSV**.
3. Or click **Load demo statement** to try it with 3 months of mock data first.

## Supported CSV shapes

The parser is deliberately forgiving. It accepts:

- **Debit/credit columns** — `Date, Description, Debit, Credit`
- **Signed amount column** — `Date, Description, Amount` (negative = spend)
- 14 date formats (`2026-06-01`, `01/06/2026`, `Jun 1, 2026`, …)
- Currency symbols and thousands separators (`₹1,299.00`, `$12.99`)

Header names are matched loosely (`Transaction Date`, `Narration`, `Withdrawal Amt` all work).

## What Lucid computes

- **Categories** — 13 keyword-based buckets (rent, groceries, food delivery, subscriptions, transport, …)
- **Subscriptions** — recurring merchants with stable amounts (±5%) across 2+ months, plus annualized cost
- **Cash flow** — monthly income vs. spend, next-month forecast
- Endpoints: `GET /finance/summary`, `GET /finance/search?q=uber`

Re-uploading the same statement is safe — transaction IDs are stable hashes, so nothing duplicates.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `400: could not detect columns` | The CSV has no recognizable date/description/amount headers — open it and check the first row is a header row. |
| Amounts look inverted | Your bank exports spend as positive with a type column — file an issue with a sample row (redact real data). |
| Upload does nothing | Check the backend is running and `NEXT_PUBLIC_API_URL` is right. |

"""Finance connector: CSV parsing, categorization, subscription detection,
summary math. Pure functions, no I/O beyond the CSV text — no fixtures or
mocking needed, per PLAN.md's "clear input/output contract" starting point
for the test suite.
"""
import pytest

from app.connectors.finance import (
    categorize,
    detect_subscriptions,
    parse_statement_csv,
    summarize,
)


def test_categorize_matches_first_rule_in_order():
    # "payroll" hits the salary rule, not the generic "income" fallback.
    assert categorize("Payroll Deposit", "credit") == "salary"
    assert categorize("WHOLE FOODS MARKET #1234", "debit") == "groceries"
    assert categorize("NETFLIX.COM", "debit") == "subscriptions"


def test_categorize_falls_back_to_income_or_other():
    assert categorize("Acme Consulting LLC", "credit") == "income"
    assert categorize("Some Unknown Merchant", "debit") == "other"


DEBIT_CREDIT_CSV = """Date,Description,Debit,Credit
2026-01-05,Whole Foods Market #1234,45.20,
2026-01-10,Payroll Deposit,,3000.00
"""

SIGNED_AMOUNT_CSV = """Date,Description,Amount
2026-01-05,Whole Foods Market #1234,-45.20
2026-01-10,Payroll Deposit,3000.00
"""


def test_parse_statement_csv_debit_credit_columns():
    txns = parse_statement_csv(DEBIT_CREDIT_CSV)
    assert len(txns) == 2
    debit, credit = txns
    assert debit["type"] == "debit" and debit["amount"] == 45.20 and debit["category"] == "groceries"
    assert credit["type"] == "credit" and credit["amount"] == 3000.00 and credit["category"] == "salary"


def test_parse_statement_csv_signed_amount_column_equivalent():
    """The debit/credit-column and signed-amount-column CSVs describe the
    same two transactions and must parse to the same normalized shape
    (modulo the id, which embeds a hash of the source key)."""
    a = parse_statement_csv(DEBIT_CREDIT_CSV)
    b = parse_statement_csv(SIGNED_AMOUNT_CSV)
    for t1, t2 in zip(a, b):
        assert t1["date"] == t2["date"]
        assert t1["amount"] == t2["amount"]
        assert t1["type"] == t2["type"]
        assert t1["category"] == t2["category"]


def test_parse_statement_csv_missing_required_columns_raises():
    with pytest.raises(ValueError):
        parse_statement_csv("Foo,Bar\n1,2\n")


def test_parse_statement_csv_skips_rows_with_bad_date_or_zero_amount():
    csv_text = (
        "Date,Description,Amount\n"
        "not-a-date,Whole Foods,-10.00\n"  # bad date -> skipped
        "2026-01-05,,-10.00\n"  # empty description -> skipped
        "2026-01-06,Whole Foods,0\n"  # zero amount -> skipped
        "2026-01-07,Whole Foods,-10.00\n"  # kept
    )
    txns = parse_statement_csv(csv_text)
    assert len(txns) == 1
    assert txns[0]["date"] == "2026-01-07"


SUBSCRIPTION_CSV = """Date,Description,Amount
2026-01-05,NETFLIX.COM,-15.99
2026-02-05,NETFLIX.COM,-15.99
2026-03-05,NETFLIX.COM,-15.99
2026-01-12,AMAZON.COM*AB12CD,-83.47
"""


def test_detect_subscriptions_flags_recurring_fixed_charge():
    txns = parse_statement_csv(SUBSCRIPTION_CSV)
    subs = detect_subscriptions(txns)
    assert len(subs) == 1
    assert subs[0]["merchant"] == "netflix.com"
    assert subs[0]["monthly_cost"] == 15.99
    assert subs[0]["months_seen"] == 3


def test_detect_subscriptions_ignores_one_off_purchase():
    txns = parse_statement_csv(SUBSCRIPTION_CSV)
    subs = detect_subscriptions(txns)
    # Only the 3x-recurring Netflix charge qualifies; the single Amazon
    # purchase (1 month seen) must not be flagged as a subscription.
    assert len(subs) == 1
    assert not any("amazon" in s["merchant"] for s in subs)


def test_summarize_totals_and_forecast():
    txns = parse_statement_csv(DEBIT_CREDIT_CSV)
    s = summarize(txns)
    assert s["transactions"] == 2
    assert s["total_in"] == 3000.00
    assert s["total_out"] == 45.20
    assert s["net"] == round(3000.00 - 45.20, 2)
    # Single month in the fixture -> forecast is just that month's net.
    assert s["monthly"] == [
        {"month": "2026-01", "in": 3000.00, "out": 45.20, "net": round(3000.00 - 45.20, 2)}
    ]
    assert s["forecast"]["next_month_net"] == round(3000.00 - 45.20, 2)


def test_summarize_empty_transactions():
    s = summarize([])
    assert s == {
        "transactions": 0,
        "total_in": 0,
        "total_out": 0,
        "net": 0,
        "by_category": [],
        "monthly": [],
        "subscriptions": {"items": [], "monthly_cost": 0, "annual_cost": 0},
        "forecast": {"next_month_net": 0.0},
    }

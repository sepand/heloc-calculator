# HELOC Amortization Calculator

A standalone HTML, CSS, and JavaScript calculator focused on HELOC-style amortization with variable rates.

## Features

- Input original mortgage principal, start date, term, and billing cycle day count.
- Enter rate changes over time using:
  - APR (%), and/or
  - Daily Periodic Rate (DPR)
  - effective Rate Date.
- Uses daily accrual logic and reports:
  - Average Daily Principal Balance (ADPB),
  - Daily Periodic Rate per cycle,
  - Interest by cycle.
- Supports two extra-principal mechanisms:
  - Monthly additional principal amount, which can be changed over time via scheduled effective-date rows (e.g. start at $200/month, bump to $500/month starting a later date).
  - Unlimited one-time additional principal payments by date.
- Import/export scenario JSON files for future updates.
- Payoff Comparison: automatically compares your plan (with extra payments) against a minimum-payments-only baseline on the same rate schedule, showing interest saved and time saved.
- Includes visualizations:
  - Remaining principal trend, plan vs. minimum-payments baseline.
  - Interest vs principal paid by cycle.

## How to run

1. Open index.html in a browser.
2. Fill in loan inputs.
3. Add rate-change rows and extra-payment rows.
4. Click Calculate.
5. Use Export Scenario to save your data, and Import Scenario to restore it later.

## Notes

- This tool is for planning and estimation, not financial advice.
- Lender-specific rules (rounding, posting order, fees, and statement cutoffs) may differ.

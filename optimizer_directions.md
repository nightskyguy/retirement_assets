# Retirement Optimizer — Future Directions

Brainstormed 2026-05-18. Items lettered as originally raised; priority order at bottom.

---

## A — Additional Withdrawal Methods

Add a **fixed % of IRA** strategy: withdraw a set percentage of the IRA balance each year, supplement any shortfall from brokerage/cash. This mirrors how many retirees actually manage drawdown.

Other candidates worth considering:
- **Guyton-Klinger guardrails**: cut spending if portfolio drops X%, resume when it recovers.
- **Spend from dividends only**: draw only dividend/interest income, preserve principal.

The fixed-% strategy is the clearest win and fits naturally into the existing `calculateWithdrawals` architecture.

---

## B — Rethink Bracket / IRMAA Withdrawal Limits

**Problem:** The current model asks "how much IRA do I need to cover my spend goal?" — the bracket acts as a cap but spend overrides it. This makes bracket and IRMAA strategies non-functional when desired spend exceeds the bracket room.

**Fix:** Invert the logic. The bracket (or IRMAA threshold) sets the *maximum* IRA withdrawal. If that's less than what's needed to fund spending, the shortfall draws from brokerage/cash first, then Roth. This is the architecturally correct model and unblocks IRMAA work entirely. Requires rethinking how `gapAmount` flows into `calculateWithdrawals`.

---

## C — Mark/Save Multiple Scenarios and Compare Side by Side

Save/load infrastructure already exists. Needed: a comparison view.

**Approach:** Summary-first — a side-by-side table of key stats (lifetime tax rate, total tax, funded years, final wealth) for 2–3 saved scenarios. Chart overlay (same axes, one line per scenario) is feasible with Chart.js and useful for the top wealth chart. Start with summary table, add chart overlay later.

---

## D — Track Marginal State, Federal, and IRMAA Brackets Per Year

**Pure display work** — bracket calculations already happen, they just aren't surfaced per row. Add columns to Annual Details for:
- Federal marginal bracket %
- State marginal bracket %
- IRMAA tier

Row-level color coding by IRMAA tier would make bracket-jump years visually obvious. Should be implemented together with K (Annual Details reorganization).

---

## E — Click on Annual Detail / Chart Point to Launch Tax Analyzer

Use Chart.js `onClick` (and a click handler on table rows) to open the Tax Analyzer tool in a new window, pre-populated with that year's values.

**Prerequisite:** Map out what parameters the Tax Analyzer accepts in its URL/input format. Once that's known, it's a URL-construction function per row/point.

---

## F — Monte Carlo Analysis

Run the simulation 500–1000× with growth rate randomized (e.g., sampled from a normal distribution around the mean, or resampled from historical return sequences). Display results as probability bands (10th / 50th / 90th percentile) on the wealth chart, plus a summary: "X% of scenarios remain solvent through age Y."

**Scope:** Implement as a separate "Risk Analysis" tab with its own run button — not wired into the main simulation flow. The simulation already runs fast enough for this in-browser.

---

## G — Withdrawal Timing (Month of Year)

**Original framing:** Choose which month withdrawals/conversions occur; the Optimizer could compare March vs. November. Deprioritized as a general feature due to complexity-vs-value ratio.

**However — Roth conversion timing is a real effect worth modeling separately:**

Converting in February means ~10 months of gains accrue tax-free in Roth. Waiting until November means those same gains grew inside the IRA, increasing the account balance, future RMDs, and the compounding tax obligation. The asymmetry is meaningful over a 20-year horizon, not just a rounding effect.

**Suggested approach:** Model this in a focused spreadsheet first — isolate one year, two conversion dates, trace the difference in Roth vs. IRA balance at year-end and projected RMD impact. If the effect is significant (likely yes), bring a simplified "conversion month" parameter into the optimizer for Roth conversion strategies only.

---

## H — Lumpy Spending (One-Time Expenses)

Allow a per-year spending override table: year → extra one-time spend (e.g., $60k kitchen renovation in 2027, $40k car in 2030). The simulation checks for an override and adds it to `spendGoal` for that year.

**Scope:** Small input table in the sidebar or a dedicated sub-section. Clean, bounded, high practical value.

---

## I — QCDs (Qualified Charitable Distributions)

After age 70½, up to ~$105k/year can be distributed directly from an IRA to a qualified charity. Counts toward RMD, excluded from AGI — reduces IRMAA exposure and taxable income.

**Implementation:** One new input (annual QCD amount, or a per-year table). Logic: subtract QCD from IRA before computing taxable income. The tax benefit is automatic via the AGI reduction.

---

## J — "Next 5 Years" Actionable Report

Generate a clean one-page (print/export) view of years 1–5 from simulation results:
- Account balances at start of year
- Withdrawals by account (IRA, brokerage, Roth, cash)
- Roth conversion amount
- Estimated federal + state taxes
- Net spendable

**Scope:** Pure reporting on already-computed data. Defer until Annual Details (K) is in good shape, since it's the same data formatted for action rather than analysis.

---

## K — Annual Details: Reorganization and Clarity

Current table has too many columns at equal visual weight. Proposed grouping:

| Section | Columns |
|---|---|
| **Income** | SS, pension, RMD, dividends |
| **Withdrawals** | IRA, brokerage, Roth, cash, Roth conversion |
| **Taxes** | Fed bracket %, state bracket %, IRMAA tier, total tax |
| **Balances** | IRA, brokerage, Roth, cash, net worth |

Add subtle header-group colors. Add bracket/IRMAA columns from D here. Should be done as a paired task with D.

---

## Priority Order

1. **K + D** — reorganize Annual Details and surface bracket/IRMAA columns. High impact, low risk, makes everything else more debuggable.
2. **B** — fix bracket/IRMAA strategy logic. Unblocks correct strategy comparisons.
3. **H** — lumpy spending. Practical and contained.
4. **A** — fixed-% IRA withdrawal strategy.
5. **I** — QCDs.
6. **C** — scenario comparison (summary table first, chart overlay later).
7. **F** — Monte Carlo (separate tab, own scope).
8. **E** — Tax Analyzer click-through (scope the URL format first).
9. **J** — 5-year report (after K is done).
10. **G** — Roth conversion timing (model in spreadsheet first; bring into optimizer if effect is confirmed significant).

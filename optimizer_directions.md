# Retirement Optimizer — Future Directions

Brainstormed 2026-05-18; updated 2026-05-20. Items lettered as originally raised; priority order at bottom.

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

## L — Tax Payment Optimization Model

For each of the next 5 years, produce a step-by-step order of operations for *how* to execute the year's tax plan — not just what the numbers are, but when and in what sequence to act:

1. **RMD timing** — when to take the RMD, and whether to withhold taxes from it.
2. **Roth conversion** — when to execute the conversion; whether to withhold from the conversion or pay separately.
3. **60-day rollover** — if the state allows it, use a 60-day IRA rollover to "replace" taxes withheld from the conversion (effectively borrowing tax-free for 60 days). Flag states where this is restricted or disallowed.
4. **Quarterly estimated payments** — compute and schedule Q1–Q4 safe-harbor or actual-liability payments.
5. **Year-end true-up** — if a shortfall remains after estimated payments, cover it by withholding from a final IRA distribution before Dec 31 (withholding is treated as paid evenly throughout the year, avoiding underpayment penalties).

**Goal:** Minimize underpayment penalties and cash-flow disruption while legally deferring as much tax payment as late in the year as possible.

**Related to:** J (5-year actionable report) — this is the *execution* layer that J's report should link into.

---

## M — Multi-Strategy Optimizer (Mixed Withdrawal Methods)

Allow the optimizer to switch withdrawal strategies mid-simulation rather than applying one strategy for the entire retirement horizon.

**Motivation:** The truly optimal plan may be "Withdraw Fixed N years → then Proportional" or "Bracket through age 72 → Fixed % thereafter." No single strategy dominates across all phases.

**Approach:**
- **Brute-force phase combinations:** Define a set of phase breakpoints (e.g., every 3–5 years) and try all permutations of strategy × phase. Computationally heavier but tractable in-browser for reasonable phase counts.
- **Greedy/dynamic programming alternative:** At each year, pick the locally optimal strategy given current account balances and tax situation — faster but may miss globally optimal sequences.
- Surface the best N combinations in the Optimizer table with a "phases" column showing the strategy sequence used.

**Scope note:** Start with brute-force over 2-phase combinations (strategy A for years 1–N, strategy B for years N+1–end); extend to 3 phases if performance allows.

---

## N — Monthly or Quarterly Calculation Model

Replace the current annual simulation step with monthly or quarterly granularity.

**Why it matters:**
- Growth compounding is more accurate (monthly compounding vs. annual lump-sum).
- Intra-year cash-flow events (RMD in January vs. December, conversion in February vs. November) become directly modelable rather than approximated.
- Enables L (tax payment timing) and G (conversion timing) to be computed natively rather than estimated.

**Trade-offs:**
- 12× or 4× more simulation steps — likely still fast enough in-browser, but the Optimizer's brute-force runs will feel it.
- Annual Details display must aggregate back up to yearly rows for readability; monthly detail available on drill-down.

**Suggested approach:** Build monthly as an optional "high-fidelity mode" toggle; keep annual as the default for speed. Validate that annual and monthly agree on simple cases before enabling the optimizer on monthly mode.

---

## P — Per-Account Asset Mix and Historically-Based Growth Rates

Allow Roth, IRA, and Brokerage accounts to each specify an asset allocation (e.g., 60% US equity / 30% bonds / 10% international) and derive a historically-grounded expected return and volatility from that mix.

**Implementation:**
- Embed a lookup table of historical real returns and standard deviations by asset class (e.g., US large-cap ~7% real, bonds ~1.5% real, international ~5% real).
- Weighted-average the mix to produce a per-account expected return and σ for use in the simulation and Monte Carlo (F).
- UI: a small allocation grid per account (percentages must sum to 100%).
- Optionally surface the derived expected return so the user can see and override it.

**Related to:** F (Monte Carlo) — per-account σ feeds directly into the Monte Carlo draw for each account independently, which is more realistic than a single portfolio-wide rate.

---

## Q — Variable Growth and Inflation Rates in the Optimizer

Allow the optimizer to run scenarios across a range of growth and/or inflation rate assumptions, not just a single point estimate.

**Two modes:**

1. **Sensitivity grid:** Run the optimizer at each combination of (growth rate, inflation rate) from a small grid (e.g., growth: 4%, 6%, 8%; inflation: 2%, 3%, 4%). Show which strategy ranks #1 under each combination — highlights strategies that are robust vs. those that only win under favorable assumptions.

2. **Monte Carlo integration (with F):** Rather than a fixed rate per simulation run, draw growth and inflation from their respective distributions each year. This is the full stochastic model; combine with P (per-account asset mix) for maximum realism.

**Scope:** Mode 1 (sensitivity grid) is self-contained and high-value; implement it independently of F. Mode 2 is the natural extension once F exists.

---

## Priority Order

1. **K + D** — reorganize Annual Details and surface bracket/IRMAA columns. High impact, low risk, makes everything else more debuggable.
2. **B** — fix bracket/IRMAA strategy logic. Unblocks correct strategy comparisons.
3. **H** — lumpy spending. Practical and contained.
4. **A** — fixed-% IRA withdrawal strategy.
5. **I** — QCDs.
6. **C** — scenario comparison (summary table first, chart overlay later).
7. **P** — per-account asset mix and historically-based growth rates. Feeds F and Q.
8. **F** — Monte Carlo (separate tab, own scope; use per-account σ from P).
9. **Q** — variable growth/inflation in optimizer: sensitivity grid first (Mode 1), Monte Carlo integration (Mode 2) after F exists.
10. **M** — multi-strategy optimizer (mixed withdrawal methods); start with 2-phase brute force.
11. **L** — tax payment optimization model (order-of-operations for RMD, conversion, rollovers, estimated payments, year-end true-up).
12. **J** — 5-year actionable report (after K is done; L provides the execution layer).
13. **N** — monthly/quarterly calculation model (optional high-fidelity mode; enables L and G natively).
14. **E** — Tax Analyzer click-through (scope the URL format first).
15. **G** — Roth conversion timing (model in spreadsheet first; bring into optimizer if effect is confirmed significant; N makes this native).

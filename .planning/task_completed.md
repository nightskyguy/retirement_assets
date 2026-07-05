# Completed Phases — Retirement Optimizer

All phases below are shipped and merged to main.

---

## Phase 0: Planning & Context
- Read BootstrapPlan.md, optimizer_directions.md; consolidated into actionable phases; identified blockers.
- **Status:** complete

---

## Phase 0b: Remove Orphaned Files
- Deleted `calculateTaxes.js` (orphan).
- **Status:** complete

---

## Phase 1: Fix Bracket/IRMAA Strategy Logic (Priority B)
Inverted constraint: bracket limits IRA withdrawal (not spend). Binary search per bracket for max feasible spend. Real-time UI feedback. Shortfall draws from brokerage/cash first, then Roth.
- **Status:** complete

---

## Phase 2: Historical Bootstrap for Monte Carlo
Embedded historical annual returns 1928–2024 (S&P, bonds, intl). `bootstrapScenarioBank()` with block-size=3. GBM vs Bootstrap toggle in nerd panel. Range −43.8% to +52.6%.
- **Status:** complete

---

## Phase 4: QCDs — Qualified Charitable Distributions (Priority I)
After-70½ QCD amount input. QCD subtracted from IRA before AGI. As-Needed/Always toggle. 2026 limit $111k. Chart bar + summary stat. PR merged, v11.fee.
- **Status:** complete

---

## Phase 6: Per-Account Asset Mix (Priority P)
Allocation grid per account. `bootstrapMultiAssetBank()` — synchronized block bootstrap equity/bonds/intl (1970–2024). Per-account growth rates in `simulate()`. "Est. Rtn" advisory column. MC metrics shows per-asset-class ranges.
- **Status:** complete

---

## Phase 7: Historical Inflation Bootstrap + CAGR Stats
Extended history from 1970–2024 → full 1928–2024 (97 years). `inflationSequence` per MC path. CAGR (geometric mean) for all asset stats. Fixed Current Dollars toggle; fixed bootstrap mode not graying out μ/σ after scenario load.
- **Status:** complete

---

## Phase 8: Variable Growth/Inflation Optimizer (Priority Q)
Superseded/deprioritized — Bootstrap MC (correlated historical sequences) + Stress mode (worst-N sequences) + GBM wired to Assumptions growth rate cover the use case. Sensitivity grid not specifically requested.
- **Status:** superseded — no implementation needed

---

## Phase 12: Withdrawal Timing — Auto Early/Late (replaces Quarterly)
Each simulation year auto-selects Early (January) or Late (December) timing. Conversion years → Early (max Roth compounding). Spending-only years → Late (full portfolio compounds before withdrawal). New `Timing` Annual Details column shows `Early(Conv)` / `Late(Spend)`. No manual toggle — algorithm tracks prior-year conversion activity. Shipped v11.ecb.
- **Status:** complete
- **Note:** Individual phase detail block in plan had stale "pending" status; auto-timing shipped without updating that block.

---

## Phase 18: MC Input Transparency — Return & Inflation Fan Charts
Per-year percentile fan charts (min/p10/med/p90/max) for equity returns and inflation across all MC paths. "Input Distributions" collapsible section in MC tab. Separate charts for returns and inflation. Shaded p10–p90 band, solid median, thin dashed min/max.
- **Status:** complete
- **Depends on:** Phase 7 ✓

---

## Phase 19: URL Parameter Compression (Cross-Tool)
Short alias map for all optimizer URL params. `loadFromURL` accepts both short and long keys (backward compat). `generateShareURL` emits short keys. 57% URL reduction (1100→468 chars). Applied to `IncomeTaxPlanner.html` and `RetirementTaxPlanner.html`. Share panel popup standardized; ITP→RTP button added.
- **Status:** complete

---

## Phase 20: Roth Conversion Opportunity Cost Accounting
Shadow accounts (`iraShadow`/`taxableShadow`) track no-conversion counterfactual. Annual `convNetValue`/`excessNetValue`. "Future IRA Tax %" input. Annual Details columns: `convOC`, `excessOC`, `convTax`, `excessTax`. `totals.convBEYear`/`excessBEYear` stats. v11.e4f.
- **Status:** complete

---

## Phase 21: Vanguard BETR (Break-Even Tax Rate) for Roth Conversions
Kitces formula: `BETR = t_now × (1+r_taxable)^n / (1+r_ira)^n`. Per-year `betr` column in Annual Details (Opp. Cost category) with ▲/▼ flag. Summary stat `stat-betr-avg` (nerd-gated). Collapsible sensitivity table (5/10/15/20/25 yr). v11.e64.
- **Status:** complete
- **Depends on:** Phase 20 ✓, Phase 1 ✓

---

## Phase 22: Guyton-Klinger Guardrails Withdrawal Strategy
Four GK rules: base, Inflation, Capital Preservation, Prosperity. Sub-inputs when GK selected (IWR display, guardrail %, cut/raise %). Annual Details: `gkSpend` + `gkAdj` columns. URL aliases: gku/gkl/gkc/gkr. `buildVariations()` GK row. GK uses raw portfolio balance for IWR/WR comparisons. v11.1042.
- **Status:** complete (commit 4a7fec5, 2026-06-22)

---

## Phase 23: Roth Conversion Amount Optimizer (core)
`extraConversionAmount` in `simulate()`. `optimizeConversionAmount()` $25k sweep. Conv Optimizer toggle in optimizer (top-5 strategies). Projected RMD stat (`stat-proj-rmd1/2` per SECURE 2.0). BETR avg column in optimizer table. v11.e64.
- **Status:** complete (core). Greedy DP per-year schedule → Phase 23b (remaining tasks).
- **Depends on:** Phase 21 ✓, Phase 20 ✓, Phase 1 ✓

---

## Phase 27: Withdrawal Rate — Fix Label, Formula, Add Inflows/Outflows Columns
Correct formula: `wdRate = (netOut − inflows) / prevTotalWealth`. New log fields `grossOut`, `netOut`, `inflows`, `wdRate%`. `totals.avgWdRate` replaces `avgSpendRate`. HTML label "Avg Withdrawal Rate". Tests: SS covers spending → wdRate ≤ 0. v11.ecc (2026-06-11). Node 18/18; browser 207/207.
- **Status:** complete

---

## Phase 28: Bad Markets / Sequence-of-Return Risk Stress Mode
`buildStressBank()` scores all 1928–2024 start years by first-decade equity CAGR → takes worst N (default 10) → runs deterministic spaghetti lines with per-scenario labels. Worst 10: 1929, 1999, 2000, 1930, 1928, 1931, 1965, 2001, 2002, 1969. Legend click isolation. Multi-strategy colors.
Bear-Start bootstrap (Option A) and CAPE-adjusted preset (Option C) deprioritized — Stress mode covers stated need.
- **Status:** complete (Option B)

---

## Phase 30: Verify GBM Statistical Mode Uses User Growth Rate
`mc-mu` was hardcoded at 7%. Fix: `syncMCMuFromGrowth()` in mc_tab.js — syncs mc-mu from growth on page load, on growth oninput, when switching to GBM mode. `updateMCGrowthWarning()` added. Label clarified. 2026-06-09.
- **Status:** complete

---

## Phase 31a: State Tax Bracket Inflation Indexing Audit & Fix
`INFLATION_INDEXED: false` added to MT, ND, AL, OH, SC in `taxengine.js`. `calculateProgressive()` uses `effectiveInflation=1` for non-indexed states. Tests: MT/ND tax same at inflation=1.1 as 1.0; CA inflation=1.1 lowers tax vs 1.0.
- **Status:** complete

---

## Phase 31b: Baseline Accounting for Strategy Comparison
Fixed `totalWealth` — brokerage gains × (1−capGainsRate), IRA × (1−nominalTaxRate). `afterTaxNetWorth()` helper. No-conversion sweep → baseline = max-afterTaxNW successful no-conv row. Per-row `afterTaxNW` + `_dNW`/`_dTax`. Pinned ⚓ BASELINE row. Sort fix: failed plans rank below successful. v11.1000.
- **Status:** complete

---

## Phase 32: Share-URL Compression + Default-Omission
`compactNum()` shortest-form. `OPT_DEFAULTS` + `captureDefaults()`. `buildShareURL()` omits defaults + compresses; booleans 1/0. `loadFromURL()` accepts 1/0 + legacy true/false. 4 node round-trip tests. v11.1048.
- **Status:** complete (v11.1048, 2026-06-22)

---

## Phase 33: Inflation-Aware Stress Test Scoring
`buildStressBank()` now scores by real CAGR (Fisher equation: `(1+eq)/(1+max(-0.005,inf))−1`) not nominal equity. Labels show 3-part: "1970 (eq: +6.0% inf: +7.0% real: -1.0%)". `applyBearStartOverlay()` uses same scoring. MC chart legend shows both nominal and real CAGR. 2026-06-23.
- **Status:** complete

---

## Phase 36: Soft/Strict Withdrawal Caps — Large-Shortfall Fix
Soft caps (Federal bracket/IRMAA/fixedpct) now draw IRA above ceiling to fund mandatory spending (`forcedIRA`/`BracketOverage` columns). Strict ACA pulled into internal `strategy='aca'` that never breaches FPL cap (`acaBreach`/⚠️). Fixes $2M-IRA-stranded shortfall after spouse death halves bracket. v11.1090.
- **Status:** complete

---

## Phase 37: GK Optimize-Spend Fix + Spendable-Aware Baseline
(a) GK Optimize-Spend floor: `optimizeSpend().passes()` requires worst REAL delivered spend ≥ initial real × (1−gkGuard). (b) MC Total Spendable column: median `totals.spendCurrentDollars` (real), 8th MC col. (c) Baseline score: `afterTaxNWCurrentDollars + 1.10×spendCurrentDollars` (real $, SPENDABLE_WEIGHT=1.10). Baseline flips GK→IRA Draw. (d) Nerd-only Score column in optimizer (`?nerdknob`). v11.1097–1099.
- **Status:** complete

---

## Phase 38: UX/Charts Batch — Punch-List
6 of 10 punch-list items:
1. **MC deflation floor** — `INFLATION_FLOOR=-0.01` in `montecarlo/prng.js`; applied in `buildStressBank` and `bootstrapMultiAssetBank`.
2. **Annual Details mirror top scrollbar** — `#tbl-scroll` + sticky `#tbl-top-scroll` strip (16px explicit height). `syncTopScroll()`/`setupTopScrollSync()`.
3. **Share bar left-aligned.**
4. **Avg BETR hidden unless `?nerdknob`** — `#stat-betr-wrap`.
7. **Chart milestone overlay** — `milestonePlugin`; dashed verticals for first death / first underfunded / IRMAA onset on both charts; default ON.
8. **Income chart split into 5 selectable views** — combined, tax, net, flows, assetflows. Taxation view: stacked tax components on primary axis; MAGI + crossed bracket/IRMAA thresholds on secondary; "Show thresholds" toggle; chart-only log fields `-capGainsTax`, `-cpiFactor`, `-iraG`. v11.10a2.

Deferred from this batch → now tracked as open tasks: #9 Cash Reserve enforcement, #10 Suggest Spend Goal, #5 Onboarding, #6 Annual-table presets.
- **Status:** complete (shipped PR #96)

---

## Phase R (partial): Structural Refactoring
- **R1a:** Extracted 4 helpers from `simulate()` → module level. `simulate()` 1095 → 987 lines. (commit 7366f1f)
- **R2:** Replaced 6 `window.optimizer*` globals with single `OptimizerState` const. (commit 293077f)
- R1-remainder, R3, R4 → tracked as open tasks.
- **Status:** R1a + R2 complete; remainder pending (see task_plan.md)

# Task Plan: Retirement Optimizer — Feature Implementation Roadmap

Goal: Implement remaining features from optimizer_directions.md priority list (items B through R), focused on core functionality gaps and Monte Carlo improvements.

## Current Phase
**Complete:** 0, 0b, 1, 2, 4, 6, 7, 12, 18, 19, 20, 21, 22, 23, 27, 28, 30, 31, 32, 33, 36, 37 + MC UX fixes (CSS grid tables, mode selector, CAGR stats, SoRR Stress mode, legend isolation, GBM growth sync, real-CAGR stress scoring).

**Phase 37 (GK Optimize-Spend fix + spendable-aware baseline, v11.1097–1099, 2026-06-26):**
Three GK/baseline fixes. (a) **GK Optimize-Spend stability floor** — GK mutates `spendGoal` via
guardrails so the survival-only search ran to the +50% ceiling (reported ~$210k holdable only ~2yr).
`optimizeSpend().passes()` now adds a GK-only floor: worst REAL delivered spend
(`spendGoal/inflationFactor`) must stay ≥ initial real × (1 − gkGuard). (b) **MC Total Spendable
column** — median `totals.spendCurrentDollars` (real) threaded via `spendPerPath`/`medianSpend`
(worker.js + mc_controller.js), rendered as 8th MC col. (c) **Baseline ranking reworked** — was
`max(afterTaxNW)` among no-conv successes (let GK win by hoarding), now
`_baselineScore = afterTaxNWCurrentDollars + 1.10*spendCurrentDollars` (real $; SPENDABLE_WEIGHT=1.10
favors spend over bequest). Baseline flips GK→IRA Draw in default scenario. (d) Nerd-only **Score**
column in optimizer table (`?nerdknob`). Confirmed Reduce-N does NOT underspend (flat $3,111k all N;
only NW varies). node 47/47, in-page 212/212.

**Phase 36 (Soft/Strict withdrawal caps — large-shortfall fix, v11.1090, 2026-06-25):** soft caps
(Federal bracket / IRMAA / fixedpct) now draw IRA above the ceiling to fund mandatory spending
(new `forcedIRA`/`BracketOverage` columns); strict ACA pulled into its own internal `strategy='aca'`
that never breaches the FPL cap (flags untenable via `acaBreach`/⚠️). Fixes the $2M-IRA-stranded
shortfall after a spouse's death halves the bracket. Survivor-SS step-up confirmed already correct.
node 45/45, in-page 212/212.
**Superseded/deprioritized:** Phase 8 (Variable Growth sensitivity grid — bootstrap + stress MC covers the use case; grid not needed).
**Partial:** Phase 9 (ACA — Medicare age gate done; MAGI/subsidy calculation not yet implemented).
**Pending (unblocked):** Phase 3 (Lumpy Spending), Phase 23b (Greedy DP per-year schedule + MC Stage 2 top-K), Phase 29 (Creeping Tax Rate).
**Pending (blocked):** Phase 9 remainder (ACA MAGI/subsidy), Phase 5 (Scenario Comparison), Phase 10 (Multi-Strategy), Phase 11 (Regime-Switching), Phase 17 (FF equity data).
**Refactoring (Phase R):** R1a + R2 shipped (simulate() helper extraction, OptimizerState). R1-remainder, R3, R4 pending.
**As of:** 2026-06-26 (Phase 37 GK Optimize-Spend floor + spendable-aware baseline + MC Total Spendable — v11.1099).

### Phase 32: Share-URL Compression + Default-Omission
**Why:** Share URL too long. Compress numeric values (1000000→1m, 100000→1e5) + booleans
(true/false→1/0) and omit any param left at its default. Measured: compression alone ≈13%;
default-omission ≈71–100% (scales with customization); they compose.
- [x] `compactNum()` self-validating shortest-form (k/m/b/scientific, no DisplayHelpers dep)
- [x] `OPT_DEFAULTS` + `captureDefaults()` pristine snapshot before loadFromURL
- [x] `buildShareURL()` omits defaults + compresses; booleans 1/0
- [x] `loadFromURL()` checkbox accepts 1/0 + legacy true/false; dollar/absent-key decode unchanged
- [x] `captureDefaults()` wired before `loadFromURL()` in html init
- [x] 4 node round-trip tests (33 pass); browser-verified (212 in-page pass, exact round-trip,
      legacy URLs load, default scenario → empty query)
- [x] Version 11.1048 + changelog
- **Status:** complete (v11.1048, 2026-06-22)
- **Caveat:** omitted fields adopt loader's current default — keep markup defaults stable to
  avoid silent drift of old shared URLs. Optional later: `v=` stamp; extend to RTP/ITP.

### Phase 33: Inflation-Aware Stress Test Scoring
**Why:** Current Stress mode scores worst decades by first 10-year equity CAGR only. Ignores inflation persistence — a decade with flat equity returns (0% CAGR) but 7% inflation is far worse for retirees (real returns −7%) than equity CAGR alone captures. Worst-case retirement sequence = bad market + high inflation together. Bear-start overlay also uses equity-only scoring. Both should account for combined nominal+inflation erosion.

**Current findings:**
- `buildStressBank()` in montecarlo/prng.js (line 44) scores all 1928–2024 start years by `Math.log1p(eq[i+y])` sum over scoreYears (default 10)
- Sorts ascending (worst CAGR first); takes bottom N (default 10)
- **Current worst 10 years (by nominal equity 10-yr CAGR):** 1929, 1999, 2000, 1930, 1928, 1931, 1965, 2001, 2002, 1969
- Labels show start year only: "1929", "1999", etc.
- `applyBearStartOverlay()` uses same `buildStressBank()` to sample worst tercile for first 10 years of bootstrap paths

**Scoring formula — Real Combined Annual Growth Rate (RCAGR):**
- Current: `score = equityCAGR[decade]` (0-10yr nominal return only)
- **New:** `rcagr = (1 + equityCAGR) / (1 + Math.max(-0.005, inflationCAGR)) − 1` (Fisher equation with −0.5% deflation floor)
  
Deflation clamped to −0.5% floor removes only 1930s extremes (< −0.5%); preserves modern modest deflation (2009, etc.).

Example: 1970s had ~+6% nominal equity CAGR, ~7% inflation → rcagr = (1.06)/(1.07)−1 = −0.93% ≈ −1%

**Implementation:**
- [x] Modify `buildStressBank()` in montecarlo/prng.js: compute both equity CAGR and inflation CAGR over scoreYears window
- [x] Score by real CAGR (Fisher equation), not nominal equity only
- [x] Update labels to show 3-part: "1970 (eq: +6.0% inf: +7.0% real: -1.0%)"
- [x] `applyBearStartOverlay()` automatically uses inflation-weighted scoring to identify worst-start tercile
- [x] MC chart legend: show both nominal and real CAGR per scenario (real CAGR in chart legend)
- [x] Test: real CAGR scoring orders decades correctly; 1970s-era high-inflation sequences rank higher in worst list
- [x] Browser verified: stress mode runs, chart displays 10 worst sequences with new real-CAGR labels

- **Status:** complete (2026-06-23, 2 commits)
- **Depends on:** Phase 7 ✓ (inflation sequences), Phase 28 ✓ (stress mode exists)
- **Note:** Backward-compatible — rerank worst decades, no API change to user-facing controls
- **Files:** montecarlo/prng.js (buildStressBank, applyBearStartOverlay), retirement_optimizer.html (tooltip, changelog)

## Dependency Graph
```
0b (Cleanup)
├─→ 1 (Bracket/IRMAA)
│   ├─→ 5 (Scenario Comparison)
│   └─→ 9 (ACA Refinement)
│       └─→ 10 (Multi-Strategy)
├─→ 2 (Bootstrap MC)
│   ├─→ 7 (Correlated MC) [also needs 6]
│   └─→ 11 (Regime-Switching)
├─→ 3 (Lumpy Spending) [independent]
├─→ 4 (QCDs) [independent]
├─→ 6 (Per-Account Asset Mix)
│   └─→ 7 (Correlated MC)
├─→ 8 (Variable Growth/Inflation) [independent]
├─→ 12 (Quarterly Mode) [independent]
├─→ 20 (Roth Conv. Opp. Cost) [needs Phase 1]
│   └─→ 21 (BETR) [also needs Phase 20]
│       └─→ 23 (Conversion Amount Optimizer) [also needs Phase 20]
└─→ 22 (Guyton-Klinger) [independent, integrates with Phase 10]

EXECUTION ORDER: 0b → 1,2,3,4,6,8 (parallel) → 5,7,9,11,12,20,22 → 21 → 23,10
```

**Critical Path:** 0b → 1 → 9 → 10 (longest chain; Phase 10 deprioritized — see decisions)
**Unblocked quickwins:** 3, 4, 8, 12 (can start anytime after cleanup)
**New critical path for conversion work:** 1 → 20 → 21 → 23

## Phases

### Phase 0: Planning & Context
- [x] Read BootstrapPlan.md (Monte Carlo improvements)
- [x] Read optimizer_directions.md (feature priority list)
- [x] Consolidate ideas into actionable phases
- [x] Identify blockers and dependencies
- **Status:** complete

### Phase 0b: Remove Orphaned Files (Code Cleanup)
**Why:** Clean up unused files before implementing new features.

**Orphaned Files:**
- ~~`calculateTaxes.js`~~ — DELETED

**Status:** complete

### Phase 1: Fix Bracket/IRMAA Strategy Logic (Priority B)
**Why:** Currently bracket acts as cap but spend overrides it, making strategies non-functional when desired spend > bracket room. Need to invert logic: bracket/IRMAA sets *maximum* IRA withdrawal.

**Approach:** Binary search all bracket options to find max feasible spend per bracket. Show constraints inline (no modals). User can override constraints; calculation shows impact.

- [x] Review current calculateWithdrawals() logic
- [x] Invert bracket/IRMAA constraint: bracket limits IRA withdrawal, not spend goal
- [x] Shortfall draws from brokerage/cash first, then Roth
- [x] Implement `calculateMaxSpendPerBracket(bracket, assets, income, years)` using binary search
- [x] When spend goal changes, recalculate max spend for ALL bracket options (real-time)
- [x] **UI:** Bracket selector shows each option: "Bracket 22% — max $85k"
- [x] **UI:** Spend input field next to brackets
- [x] **UI:** Below brackets, feedback line: "Bracket 22% allows up to $85k; you want $100k (gap: -$15k)"
- [x] **UI:** Status indicator: Green checkmark if spend ≤ max; Yellow warning if over
- [x] **UI:** Real-time updates as user changes bracket or spend
- [x] Annual Details shows constraint violations (e.g., "Withdrew $50k but bracket allows $35k")
- [x] Test with IRMAA scenarios; verify calculation respects constraint
- [x] Test with spend > bracket; verify shortfall draws from brokerage/cash first, then Roth
- [x] Test real-time feedback updates
- **Status:** complete
- **Blocks:** Better strategy comparisons, IRMAA work, ACA age-gating (Phase 9)

### Phase 2: Historical Bootstrap for Monte Carlo (BootstrapPlan Phase 1)
**Why:** Current GBM produces unrealistic single-year returns (60%+) and consecutive-loss runs (8+ years). Bootstrap captures true return distribution with realistic caps.

- [x] Embed historical annual returns by asset class (S&P 1928–2024, bonds, intl) → `montecarlo/historical_returns.js`
- [x] Implement bootstrapScenarioBank() in montecarlo/prng.js with block size=3
- [x] Modify worker.js and mc_controller.js to accept simulationMode parameter
- [x] Add mode toggle to nerd panel (GBM vs Historical Bootstrap)
- [x] Test that bootstrap results are more realistic — range −43.8% to +52.6% (vs GBM 60%+); μ/σ correctly disabled
- **Status:** complete
- **Blocks:** Phase 7 (correlated asset classes)

### Phase 3: Lumpy Spending (Priority H)
**Why:** Users have one-time expenses (home renovation, car, etc.). Currently no way to model them.

- [ ] Add per-year spending override table (year → amount)
- [ ] Modify spendGoal calculation to check for overrides
- [ ] Add small input table to sidebar or sub-section
- [ ] Test with sample one-time expenses
- **Status:** pending

### Phase 4: QCDs — Qualified Charitable Distributions (Priority I)
**Why:** After age 70½, QCDs exclude from AGI, reduce IRMAA exposure and taxable income.

- [x] Add annual QCD amount input
- [x] Modify tax calculation: subtract QCD from IRA before computing AGI
- [x] Verify tax benefit is automatic (AGI reduction only)
- [x] Test with sample QCD amounts
- **Status:** complete — shipped v11.fee (commits 60fc49a..d1fa30f). As-Needed/Always toggle, 2026 limit $111k, chart bar, summary stat. PR merged.

### Phase 5: Scenario Comparison (Priority C)
**Why:** Users want to compare 2–3 saved scenarios side by side (lifetime tax rate, total tax, funded years, final wealth).

- [ ] Create summary comparison table (stats only, no charts yet)
- [ ] Link to existing save/load infrastructure
- [ ] Test with multiple saved scenarios
- **Status:** pending

### Phase 6: Per-Account Asset Mix (Priority P)
**Why:** Different accounts (Roth, IRA, Brokerage) have different allocations. Need to derive historically-grounded growth rates per account.

- [x] Embed historical real returns by asset class (US equity, bonds, intl) — already in historical_returns.js (Phase 2)
- [x] Add allocation grid per account — already in HTML (aspirational)
- [x] Weighted-average allocations to compute per-account expected return (bootstrapMultiAssetBank)
- [x] Surface derived return as "Est. Rtn" advisory column in Account Composition table
- [x] bootstrapMultiAssetBank() — synchronized block bootstrap equity/bonds/intl (1970-2024 window)
- [x] simulate() accepts returnSequencePerAccount; per-account growthRates use it with baseReturn fallback
- [x] worker.js and mc_controller.js build returnSequencePerAccount per path in bootstrap mode
- [x] MC metrics shows per-asset-class ranges (equity/bonds/intl) when in bootstrap mode
- **Status:** complete
- **Blocks:** Correlated MC (Phase 7) — now superseded (Phase 6 bootstrap achieves historical correlation naturally)

### Phase 7: Historical Inflation Bootstrap + CAGR Stats
**Why:** `HISTORICAL_RETURNS.inflation` existed but wasn't sampled — all MC paths used fixed inflation. Also per-account asset-mix growth needed real per-path returns.

- [x] Extend `bootstrapMultiAssetBank()` to return inflation bank (prng.js)
- [x] Expand history window from 1970–2024 to full 1928–2024 (97 years); proxy pre-1970 intl with equity
- [x] Build `inflationSequence` per path in worker.js and mc_controller.js
- [x] Consume `inflationSequence` in simulate() year loop (yearInflation)
- [x] Replace arithmetic median with CAGR (geometric mean) for all asset stats
- [x] Show CAGR column in bootstrap metrics table; expose inflationStats
- [x] Fix Current Dollars toggle in MC chart; fix path-count ID mismatch
- [x] Fix bootstrap mode not graying out μ/σ fields after scenario load
- **Status:** complete

### Phase 8: Variable Growth/Inflation Optimizer (Priority Q)
**Why:** Single-point estimates hide assumptions. Need sensitivity grid (multiple growth/inflation combos).

- [ ] Build Mode 1: Sensitivity grid (e.g., growth: 4%, 6%, 8%; inflation: 2%, 3%, 4%)
- [ ] Show which strategy ranks best under each combo
- [ ] Mode 2 (Monte Carlo integration) after Phase 2 complete
- **Status:** superseded/deprioritized — Bootstrap MC (correlated historical sequences) + Stress mode (worst-N sequences) + GBM now wired to Assumptions growth rate (Phase 30) cover the use case. Historical inflation already synced with bootstrap blocks (Phase 7). Sensitivity grid not specifically requested.

### Phase 9: ACA Limit Strategy Refinement
**Why:** ACA subsidies only matter until age 65. At 65+ (both spouses), Medicare replaces ACA, so ACA limits become irrelevant. Should not offer/enforce ACA limits in strategy after age 65.

- [x] Add age-gating logic: `updateACAWarning()` — disables ACA options + shows warning when both persons ≥65 at retirement start; advisory-only when one ≥65
- [x] Update UI: `#aca-age-warn` div in `#ui-bracket`; triggered from birthyear/startAge inputs and hasSpouse toggle
- [ ] Verify strategy comparison doesn't include ACA limits for 65+ scenarios (Optimizer not yet gated)
- [ ] Test: mixed ages (one 65+, one younger) and both 65+ — UI verified in browser; Optimizer/MC not validated
- [ ] Full Phase 9 remainder: ACA MAGI calculation, premium estimate, subsidy cliff warning in Annual Details
- **Status:** partial — UI age gate done (2026-06-09); Optimizer/MC gating + MAGI/subsidy calculation pending
- **Depends on:** Phase 1 (bracket fix, withdrawal logic works) ✓
- **Blocks:** Phase 10 (multi-strategy needs clean ACA handling)

### Phase 10: Multi-Strategy Optimizer (Priority M)
**Why:** Optimal plan may switch strategies mid-retirement (e.g., ACA limit pre-65 → Bracket 22% → RMD-only post-73). Per-year free choice is intractable (42^40); segment-based search over natural breakpoints is not.

**Architecture: Segment-based search, NOT per-year**

Natural breakpoints define segments (not arbitrary year boundaries):
| Breakpoint | Reason |
|------------|--------|
| Retirement start | Segment 0 begins |
| Age 65 | Medicare → ACA strategies invalid |
| Age 73 | RMDs begin → IRA withdrawal dynamics change |
| (optional) User-defined | e.g. spouse retires, pension starts |

With 3 segments × 42 strategies = 42³ = 74,088 max combos. After filtering invalid combos (e.g. ACA post-65 eliminated by Phase 9), realistic search space ~10,000 combos.

**Timing as a 3rd optimization axis (from Phase 12 insight):** Add `timingSequence[]` per segment (4 options: BOY/Early/Mid/Late). Conversion-heavy segments → BOY maximizes Roth growth. Spending-only segments → Late/EOY preserves portfolio. Search space with timing: 4 timings × ~10,000 strategy combos = ~40,000 Stage 1 evals (still fast, deterministic). This should be the default sweep — "Early conversion + Late spending" combos are expected to dominate all single-timing runs.

**2-Stage execution to keep MC cost manageable:**
- Stage 1: Deterministic sweep over all valid segment combos → score each → pick top-K (e.g. 10)
- Stage 2: Run full MC (500 paths) on top-K only → 10 × 500 = 5,000 paths
- Net cost less than current optimizer (42 × 500 = 21,000 paths already)

**Output format:** Human-readable segment descriptions, not a 40-year policy table.
- Example: "Phase 1 (age 60–65): ACA limit $68k. Phase 2 (65–73): Bracket 22% $85k. Phase 3 (73+): RMDs only."

**DP alternative:** O(years × strategies²) ≈ 70k evals, finds global optimum, but output is a per-year policy table — hard for users to reason about. Deprioritized.

**Tasks:**
- [ ] Modify simulate() to accept `strategySequence[]` (strategy per segment) instead of single strategy
- [ ] Define natural breakpoints from user inputs (ages, RMD trigger age)
- [ ] Filter invalid strategy-segment combos (Phase 9 age-gating feeds directly here)
- [ ] Stage 1: Cartesian product of valid strategies per segment; run deterministic simulate() for each
- [ ] Score each combo (lifetime tax paid, funded years, final wealth — use same scoring as optimizer)
- [ ] Stage 2: Run MC on top-K combos; rank by median outcome / 10th-percentile survival
- [ ] Surface top-N composite strategies in optimizer table with "Phases" column showing segment breakdown
- [ ] Test: verify ACA-only strategy never appears in post-65 segments
- [ ] Test: verify top combo beats any single-strategy result on same inputs
- **Status:** pending
- **Depends on:** Phase 9 (ACA age-gating eliminates invalid combos)

### Phase 11: Regime-Switching MC (BootstrapPlan Phase 3)
**Why:** Markets trend (bull/bear persistence). Regime-switching captures this without requiring historical data.

- [ ] Implement 2-state Markov model (Bull: μ=+14%, σ=11%; Bear: μ=−8%, σ=22%)
- [ ] Add as third simulation mode option in nerd panel
- [ ] Test that regime persistence produces realistic multi-year trends
- **Status:** pending
- **Depends on:** Phase 2 (historical bootstrap) for comparison

### Phase 12: Withdrawal Timing Model — Early / Mid / Late (replaces Quarterly)
**Why:** No good quarterly data source exists. Instead, model *when in the year* withdrawals/RMDs/conversions occur — this meaningfully changes growth compounding outcomes and is more tractable to implement.

**Three modes (all sandwiching withdrawals between two growth phases):**
| Mode | Pre-withdrawal growth | Post-withdrawal growth | Description |
|------|-----------------------|------------------------|-------------|
| Early | 1 month (January) | 11 months (Feb–Dec) | Liquidate/convert soon after Jan; run rest of year |
| Mid | 6 months (Jan–Jun) | 6 months (Jul–Dec) | Midyear transactions; best model for spread-out monthly spending |
| Late | 11 months (Jan–Nov) | 1 month (December) | Maximize growth before year-end transactions |

**Current model (BOY):** Withdraw first, then grow full 12 months = f=0 (deductions at very start of year). This is the existing behavior; will be preserved as `"current"` option.

**Critical asymmetry — conversions vs spending withdrawals have OPPOSITE optimal timing:**

| Transaction type | BOY (Early) better? | EOY (Late) better? | Why |
|-----------------|--------------------|--------------------|-----|
| Roth conversion | ✓ YES | | Converted D enters Roth at t=0, grows tax-free all year. IRA base reduced earlier → lower future RMDs. Net: earlier conversion = more Roth growth compounded. |
| Pure spending withdrawal | | ✓ YES | D exits portfolio entirely. With BOY: portfolio starts at (B−D) and grows from smaller base. With EOY: B grows full year, then D leaves. EOY wins because full portfolio compounded the whole year. |
| RMDs (forced, then possibly converted) | Depends | Depends | If RMD is re-invested elsewhere: EOY. If RMD is converted to Roth: BOY. |

**Implication for optimization:** Timing mode is not a single best answer — it depends on the *strategy phase*:
- **Conversion-heavy phase** (early retirement, age 60–72): BOY maximizes Roth growth, minimizes future RMDs. Aggressive conversion + BOY = best IRA depletion path.
- **Spending-preservation phase** (post-conversion, age 73+): EOY maximizes portfolio longevity. Once IRA is depleted or conversions complete, late timing preserves remaining assets longer.
- **Optimal hybrid:** BOY during conversion segment, Late/EOY during spending-only segment. This is a timing strategy analogous to the withdrawal strategy segments in Phase 10.

**Possible extension (Phase 12b or merge into Phase 10):** Add `timingSequence[]` as a per-segment parameter alongside `strategySequence[]`. Optimizer sweeps both dimensions for top-K combos. Search space: 4 timings × 3 segments × strategies. The combo "Early conversions + Late spending" should outperform any single timing assumption.

**Mathematical summary** — end-of-year balance = B×(1+r) − D×(1+r)^(1−f):
For spending (D exits): higher f → larger D×(1+r)^(1-f) reduction → worse. But:
For conversions (D moves IRA→Roth): Roth gains D×(1+r)^(1-f) additional growth vs IRA losing the same. Net Roth advantage = (D×(1+r)^(1-f) − D) = D×((1+r)^(1-f) − 1). **Lower f = more Roth growth from conversion.** BOY conversion is always better than EOY conversion.

At r=7%, D=$50k over 30 years: Early vs Late difference ≈ ~$100k–200k final wealth. Not trivial.

**Why simple-interest approximation is fine:** `applyGrowth()` already uses `balance * rate * (months/12)`. For sub-year splits, compound vs simple differs by <0.1% at typical retirement growth rates — negligible.

**Key finding from code audit:** `applyGrowth()` at line 478 already accepts a `months` param. The withdrawal block (lines ~800–1128) already ends with `applyWithdrawals()` at line 1128. The comment at line 1164 literally anticipates this feature. Implementation is ~20 lines of changes to `simulate()`.

**Implementation plan:**

*In `simulate()` year loop:*
```javascript
// Resolve timing fractions from inputs.growthTiming
const preMonths  = { early: 1, mid: 6, late: 11, current: 0 }[inputs.growthTiming ?? 'current'];
const postMonths = 12 - preMonths;

// --- Phase 1: pre-withdrawal growth ---
let preGains = preMonths > 0 ? applyGrowth(balance, growthRates, preMonths) : {};

// [EXISTING: tax calc → applyWithdrawals() block, lines ~800–1128 — unchanged]

// --- Phase 2: post-withdrawal growth (replaces the single applyGrowth at line 1169) ---
let gains = applyGrowth(balance, growthRates, postMonths);

// Merge preGains into gains for reporting (so gain column in Annual Details reflects full year)
for (const k of Object.keys(preGains)) gains[k] = (gains[k] ?? 0) + preGains[k];
```

*Note:* Tax calculation block uses withdrawal amounts (not post-growth balances) — stays correct regardless of timing split. RMD calculation uses prior-year-end balance — also unaffected (calculated before the loop body).

**UI:**
- Add radio/select in sidebar (near growth rate input): `Withdrawal Timing: ○ Current (BOY) ○ Early ○ Mid ○ Late`
- Tooltip: "When in the year are RMDs, withdrawals, and conversions taken? Mid is most realistic for monthly spending; Late maximizes growth before transactions."
- Default: `current` (preserves existing behavior)

**Tasks:**
- [ ] Read `simulate()` year-loop structure (lines ~800–1200) to confirm withdrawal block boundaries before touching
- [ ] Add `inputs.growthTiming` param ('current'|'early'|'mid'|'late') to `simulate()` and optimizer call
- [ ] Split `applyGrowth` at line 1169: replace with pre/post calls around existing withdrawal block
- [ ] Merge preGains + postGains into `gains` object for Annual Details reporting
- [ ] Add UI selector to sidebar; persist to URL hash
- [ ] Add to optimizer: run same strategy under all 4 timings? Or honor global setting only? → **Global setting only** (user picks their assumption; optimizer respects it)
- [ ] Test: `current` mode produces identical results to pre-change output (regression baseline)
- [ ] Test: Late mode produces higher final wealth than Early mode on same inputs (sanity check)
- [ ] Test: Mid mode result between Early and Late (monotonicity check)
- [ ] Update version + changelog

- **Status:** pending
- **Note:** Replaces original "Quarterly Mode" concept. No external data source needed.

---
## CSS / Layout Makeover — All HTML Tools

### Phase 16: Global CSS/Layout Overhaul (All 7 Tools)
**Why:** Tools share two systemic layout problems: (A) fixed-px sidebars and missing breakpoints make them unusable on small screens; (B) poor space utilization — tables/containers either overflow or wastefully cap width on wide screens.

**Tools in scope:**
| File | Layout pattern | Known issues |
|------|---------------|--------------|
| `retirement_optimizer.html` | inline table styles, `width:100%` | Tables fill full width; no sidebar grid; minimal responsiveness |
| `Retirement_Projection.html` | `290px 1fr` grid, breakpoint @740px | Fixed sidebar overflows <740px; single breakpoint insufficient |
| `IncomeTaxPlanner.html` | `272px 1fr` grid, max-width 1300px | Fixed sidebar; no small-screen breakpoint found |
| `RetirementTaxPlanner.html` | `400px 1fr` grid, max-width 1280px | 400px sidebar very wide on mobile; only print media query |
| `AfterTaxRealGrowth.html` | `max-width:720px`, breakpoint @540px | Too narrow on wide screens; sidebar cols fixed |
| `FutureCost.html` | `max-width:720px`, breakpoint @540px | Same as AfterTaxRealGrowth |
| `irmaa_and_rmds.html` | `max-width:1000px` | Need audit for sidebar/table behavior |

**Goal A — Responsiveness:**
- Replace all fixed-px sidebar widths with `clamp(min, preferred, max)` (e.g. `clamp(220px, 25vw, 320px)`)
- Add breakpoints: ≤480px (phone portrait), ≤768px (tablet/phone landscape), ≤1024px (small laptop)
- At ≤768px: sidebars collapse below content (single-column); nav/header wraps gracefully
- Font sizes use `clamp()` or `min()` so labels/values stay legible at any width
- Sliders: ensure `width:calc(100% - 16px)` doesn't break in collapsed layout
- Touch targets ≥44px for sliders, buttons, toggle rows

**Goal B — Space utilization:**
- Tables: use `width: fit-content; max-width: 100%` instead of `width:100%` for narrow-content tables
- Wide-content tables (multi-column data): use `overflow-x: auto` wrapper + `min-width` on table
- Metric grids: cap column count at viewport width (don't stretch 3-col metrics across 2400px screen)
- Containers: tools capped at `max-width:720px` should expand to `max-width: min(900px, 100%)` or similar — no reason to cap narrow on large screens
- Sidebar panels: content should not stretch to fill full sidebar height; `align-items:start` on grid

**Shared CSS patterns to standardize (consider `shared.css` or per-file):**
- Fluid sidebar mixin: `clamp(220px, 25vw, 320px) 1fr`
- Responsive breakpoint set: 480 / 768 / 1024
- Table wrapper: `<div class="tbl-wrap">` with `overflow-x:auto`
- Metric grid: `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`

**Per-tool tasks:**
- [ ] **Audit phase:** Screenshot each tool at 375px, 768px, 1440px — document overflow/cramping issues
- [ ] `Retirement_Projection.html` — fluid sidebar, breakpoints (supersedes Phase 13 scope A)
- [ ] `IncomeTaxPlanner.html` — fluid sidebar, add breakpoints
- [ ] `RetirementTaxPlanner.html` — fluid 400px→clamp sidebar, add mobile breakpoints
- [ ] `AfterTaxRealGrowth.html` — expand max-width cap, improve space utilization
- [ ] `FutureCost.html` — expand max-width cap, improve space utilization
- [ ] `irmaa_and_rmds.html` — audit + fix
- [ ] `retirement_optimizer.html` — fix table width/overflow, add responsive behavior
- [ ] Cross-tool: standardize breakpoints and fluid sidebar pattern (DRY where feasible)
- [ ] Re-test all tools at 375px / 768px / 1440px after changes

- **Status:** pending
- **Note:** Phase 13 (Retirement_Projection responsive) is a subset of this phase. Execute together or absorb Phase 13 here.

---
## Retirement_Projection.html — Standalone Fixes

### Phase 13: Small-Screen Responsive Layout (Retirement_Projection.html)
**Why:** On small screens, the 290px fixed sidebar + right panel grid overflows; sliders and values are cut off. Input panel should fill available width at a readable font size.

- [ ] Audit current CSS: `.shell` uses `grid-template-columns:290px 1fr`; single breakpoint at `max-width:740px` collapses to `1fr`
- [ ] Verify slider width calculation (`width:calc(100% - 16px)`) renders correctly at narrower widths
- [ ] Replace fixed `290px` sidebar with `min(290px, 100%)` or fluid `clamp(240px, 30vw, 320px)`
- [ ] Ensure font-size scales legibly on mobile (consider `font-size: clamp(12px, 2vw, 14px)` for `.ctrl-header label`)
- [ ] Add breakpoint ≤480px: stack metrics to single column, reduce panel padding
- [ ] Test at 375px (iPhone SE), 414px (iPhone 14), 768px (iPad portrait)
- **Status:** pending
- **Files:** `Retirement_Projection.html` (CSS only, no logic changes)

### Phase 14: Simple Mode (Retirement_Projection.html)
**Why:** Tool has too many controls for basic use-case (single-account growth modeling). `IRA_Projection` was removed; need lightweight replacement.

**Simple mode scope:** Single account type (IRA, Roth, or Brokerage), balance + growth rate + years + withdrawal rate → balance/value over time chart. No SS, no RMDs, no tax engine, no multi-account complexity.

**Implementation approach:** Toggle button in header ("Simple / Advanced"). Simple mode hides all `<details>` sections except the selected account sub-section; shows a stripped metric set (final balance, depletion year, total withdrawn). Advanced mode = current behavior unchanged.

- [ ] Add "Simple / Advanced" toggle to header (persisted to URL hash)
- [ ] Determine which controls survive in Simple mode: account selector (IRA/Roth/Brokerage), balance, growth rate, annual withdrawal, years. Hide everything else.
- [ ] Simple mode hides: SS section, filing status, second spouse, IRMAA details, brokerage tax details, threshold editor, most metrics
- [ ] Simple mode shows: account balance, growth rate, withdrawal, projection chart, 3 key metrics (final balance, depletion year, CAGR)
- [ ] Ensure URL-sharing works in both modes (hash encodes mode flag)
- [ ] Test: Simple mode produces same numbers as Advanced mode with equivalent single-account inputs
- **Status:** pending
- **Files:** `Retirement_Projection.html`

### Phase 15: Link to RetirementTaxPlanner (Retirement_Projection.html)
**Why:** User wants to click a specific year row in the projection table and open/link to RetirementTaxPlanner pre-populated with that year's values.

**What to pass:** Year's AGI (or IRA withdrawal amount), filing status, SS income for that year → URL hash params on RetirementTaxPlanner.

- [ ] Identify what RetirementTaxPlanner.html accepts as URL params / hash
- [ ] Add clickable year column to projection table (or row click handler)
- [ ] On click: build URL with year's key values (withdrawal, SS, filing status, age) → open in new tab
- [ ] Add visual affordance: row hover shows link cursor + subtle highlight
- [ ] Test: clicking year opens RetirementTaxPlanner with correct pre-filled values
- **Status:** pending
- **Files:** `Retirement_Projection.html`, possibly `RetirementTaxPlanner.html` (if it needs new param support)
- **Depends on:** Understanding RetirementTaxPlanner.html's existing URL param schema

### Phase 17: Upgrade Equity Data — S&P 500 → Total US Market (Priority: Research → Implement)
**Why:** Current `equity` array in `historical_returns.js` is Damodaran's S&P 500 proxy (large-cap only, ~500 stocks). S&P 500 ≈ 80% of US market cap by weight but excludes ~3,500 mid/small-cap stocks. The Fama-French small-cap premium shows small caps historically outperform large caps by ~1–2%/yr. Using S&P 500 understates both volatility and expected long-run returns for a diversified investor.

**Research findings:**
| Source | Coverage | Years | Free? | Notes |
|--------|----------|-------|-------|-------|
| **Fama-French Market Portfolio** | All NYSE/AMEX/NASDAQ, value-weighted | 1926–present | Yes | `Mkt-RF + RF` = total market return; gold standard in academic finance |
| **CRSP US Total Market** | ~4,000 stocks, same universe | 1926–present | Subscription | Used internally by VTSAX; not freely accessible |
| **Wilshire 5000** | Total US market | 1971–present (back-extended) | Partial | Only ~55 years direct data |
| **Damodaran S&P 500** | Large-cap 500 | 1928–present | Yes | **Current source** |

**Recommended replacement:** Fama-French Market Portfolio (`Mkt-RF + RF`) — freely downloadable from [Ken French's data library](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html). Covers 1926–present, value-weighted over all NYSE/AMEX/NASDAQ stocks. This IS "total US stock market."

**Practical impact of the change:**
- Long-run CAGR likely slightly higher (~0.5–1%/yr) vs S&P 500 due to small-cap premium
- Slightly higher volatility (small caps are more volatile)
- Distribution of bad years similar — crashes affect all caps; 1929/1931/2008 still dominate worst-year list
- S&P 500 and total market move very similarly year-to-year (correlation ~0.99 post-1970)

**Decision:** Add as a **selectable toggle** — keep both, let user compare. Rationale: user wants to visually compare outcomes between the two sources (Phase 18 fan chart will make this comparison meaningful).

**Tasks:**
- [ ] Download `F-F_Research_Data_Factors_annual.CSV` from French's site (1926–2024)
- [ ] Compute annual total return = `(1 + Mkt-RF/100) * (1 + RF/100) - 1` for 1926–2024
- [ ] Add `equityFF` array to `historical_returns.js` alongside existing `equity` (S&P 500 proxy)
- [ ] Add equity-source toggle to nerd panel: `"S&P 500 (Damodaran)" | "Total Market (Fama-French)"` — default S&P 500 to preserve existing behavior
- [ ] Worker/prng: use `HISTORICAL_RETURNS.equityFF` when FF mode selected, else `HISTORICAL_RETURNS.equity`
- [ ] MC metrics panel: label equity series by source name (not just "Equity")
- [ ] Update tests to cover both modes (CAGR ranges differ — FF slightly higher)

- **Status:** pending
- **Depends on:** Phase 7 ✓, Phase 18 (fan chart makes the comparison useful to show)

### Phase 18: MC Input Transparency — Return & Inflation Fan Charts
**Why:** Simulation is a black box: users see output (survival rate, final balance) but not what return/inflation sequences were actually sampled. Making the input distributions visible lets users verify the simulation is plausible, compare S&P vs Fama-French data sources, and understand why outcomes vary.

**What to show:** For each simulation year (year 0 to N), across all paths, show the distribution of:
1. **Equity return** (or weighted portfolio return if per-account allocations differ)
2. **Inflation rate**

Plot per year: min, p10, median, p90, max → 5-line fan (or shaded band with median line).

**UI placement:** New sub-tab or collapsible section within the MC tab, labeled "Input Distributions". Separate chart for returns, separate chart for inflation. X-axis = simulation year. Y-axis = annual rate (%).

**Data already available:** `worker.js` builds `returnSequencePerAccount` and `inflationSequence` per path. These need to be aggregated at the controller level and returned with MC results.

**Architecture:**
- `mc_controller.js`: after all paths complete, compute per-year percentiles for equity return (use equity weight from first account, or weighted average) and inflation. Add `inputFan: { equity: [{min,p10,med,p90,max},...], inflation: [...] }` to results object.
- `mc_tab.js`: render two Chart.js fan charts from `inputFan`. Reuse existing chart patterns (shaded band = fill between p10/p90, solid line = median, thin lines for min/max).
- Toggle off/on (collapsed by default) to avoid cluttering main MC view.

**Tasks:**
- [ ] `mc_controller.js`: aggregate per-year equity return and inflation percentiles across all paths; add `inputFan` to results
- [ ] `mc_tab.js`: add "Input Distributions" collapsible section with two fan charts (equity, inflation)
- [ ] Chart: shaded p10–p90 band, median solid, min/max thin dashed — match existing chart palette
- [ ] X-axis label: "Year N (age X)" using retirement start age; Y-axis: percentage
- [ ] Add source label in chart title: "Equity Returns (S&P 500 proxy)" or "Equity Returns (Fama-French Total Market)" based on Phase 17 toggle
- [ ] Test: fan chart updates correctly when simulation mode changes (GBM vs Bootstrap)
- [ ] Test: fan chart updates when equity source toggle changes (Phase 17)

- **Status:** complete
- **Depends on:** Phase 7 ✓ (inflation sequences exist), Phase 17 (equity source toggle feeds chart label)

### Phase 19: URL Parameter Compression (Cross-Tool)
**Why:** The share URL for `retirement_optimizer.html` currently has ~50 full-name params (e.g. `birthyear1=`, `BrokerageBasis=`, `comp_IRA1_ratio=`, etc.), producing URLs 800–1200 chars long — hard to share, over SMS limits, and visually opaque. Goal: ≥50% shorter URL without breaking existing bookmarks.

**Approach — short-key aliasing with backward compat:**
Define a compact alias map (e.g. `birthyear1` → `by1`, `BrokerageBasis` → `bb`, `spendGoal` → `sg`, `comp_IRA1_ratio` → `c1r`, etc.). On read: accept both long and short keys. On write (Share): emit short keys only.

This preserves all existing bookmarks (long keys still decode), while new shares are ~50–60% shorter.

**Alias design principles:**
- Person suffixes: `1`/`2` for person 1/person 2
- Account prefixes: `i`=IRA, `r`=Roth, `b`=Brokerage, `ca`=Cash, `cr`=CashReserve
- Composition: `c` prefix + account + field initial (e.g. `c_i1_r`=comp_IRA1_ratio, `c_i1_x`=comp_IRA1_intl)
- Boolean flags: 1–2 chars (e.g. `mc`=maxConversion, `hs`=hasSpouse, `dr`=dividendReinvest)
- Numeric params: 2–4 chars (e.g. `sg`=spendGoal, `sc`=spendChange, `ny`=nYears, `sr`=stratRate)

**Estimate:** Current URL ~1100 chars → target ~500 chars (55% reduction).

**Cross-tool applicability:** `IncomeTaxPlanner.html` and `RetirementTaxPlanner.html` also use URL sharing. The alias approach is identical; apply after `retirement_optimizer.html` pattern is established.

**Tasks:**
- [ ] Audit all URL params used by `loadFromURL` / `generateShareURL` in `retirement_optimizer_core.js`
- [ ] Design alias map (short-key → element id); verify no collisions
- [ ] Update `loadFromURL`: accept both short and long keys (long for compat, short for new shares)
- [ ] Update `generateShareURL` (or equivalent): emit short keys
- [ ] Write tests: round-trip encode/decode produces identical inputs for both key sets
- [ ] Verify existing long-key bookmarks still load correctly after change
- [ ] Apply same alias map to IncomeTaxPlanner and RetirementTaxPlanner share functions
- [ ] Measure before/after URL length on the sample URL above

- **Status:** complete — short alias maps implemented in optimizer_core.js + RetirementTaxPlanner.html; share panel popup standardized across all tools; ITP→RTP button added; 57% URL reduction (1100→468 chars); backward compat verified.
- **Independent:** can start anytime (no phase dependencies)

### Phase 20: Roth Conversion Opportunity Cost Accounting
**Why:** Conversions pay taxes now from real assets (taxable or IRA) that could have grown. Current model shows net worth but not whether conversion was a net gain vs the "no-conversion" counterfactual. Shadow accounts track what portfolio would hold had no conversion (or over-withdrawal) occurred.

**Core formula (annual):**
```
NetValue    = (RothActual + TaxableActual) − (TradShadow + TaxableShadow − TaxLiability)
TaxLiability = TradShadow × TaxFuture
```
- `RothActual`, `TaxableActual` — real balances after conversion + tax payment
- `TradShadow` — IRA if no conversion outflow this year (same growth rate, no conversion drawn)
- `TaxableShadow` — taxable account if conversion taxes not paid from it
- `TaxFuture` — expected marginal rate when `TradShadow` eventually distributed (user input or bracket estimate)
- **NetValue > 0** → conversion net positive; **NetValue < 0** → net negative this period

**Same regime for over-withdrawal:**
`TradShadow` = IRA if only minimum required withdrawal taken. `TaxableShadow` = taxable if no excess withdrawal taxes paid. NetValue formula identical — measures whether extra withdrawal was worth lost growth.

**Implementation in simulate():**
- Track `iraShadow` / `taxableShadow` in parallel with real accounts each year
- Conversion year: `iraShadow` skips conversion outflow; `taxableShadow` skips tax payment
- Over-withdrawal: same shadow treatment
- Year-end: compute `annualNetValue`; accumulate `cumulativeNetValue[]`
- `conversionBEYear` = first year `cumulativeNetValue > 0` (break-even)

**TaxFuture options (priority order):**
1. User input: "Expected future IRA tax rate" field (default: current bracket rate)
2. Auto-estimate from highest bracket rate in strategy (future work)

**Tasks:**
- [x] Add `convShadowDeltaIRA/Taxable` + `excessShadowDeltaIRA/Taxable` before year loop
- [x] Conversion year: compute incremental conv tax via shadow `calculateTaxes()` call; update `convShadowDeltaIRA`
- [x] Excess withdrawal year: same treatment for `surplus.Cash`; `excessShadowDeltaTaxable -= excessCashOC`
- [x] Grow shadow deltas at IRA/taxable blended rates each year (after `applyGrowth`)
- [x] Compute `convNetValue` and `excessNetValue` after Roth credited each year
- [x] Add "Future IRA Tax %" input; wired via `inputs.futureIRATaxRate` (defaults to current marginal rate)
- [x] Annual Details: `convOC`, `excessOC`, `convTax`, `excessTax` columns (Opp. Cost category + checkbox)
- [x] `totals.convBEYear` / `totals.excessBEYear` — first year NetValue >= 0; shown in `stat-conv-be`
- [x] Version bumped to 11.e4f with changelog entry
- **Status:** complete

### Phase 21: Vanguard BETR (Break-Even Tax Rate) for Roth Conversions
**Why:** Phase 20 computes shadow-account opportunity cost. BETR answers a different question: "What future tax rate must I face to justify converting today?" Directly complements the existing `stat-conv-be` break-even year metric — BETR is the *rate* break-even, break-even year is the *time* break-even.

**What BETR measures:** The future marginal rate at which the user is indifferent between converting now vs leaving in IRA. If expected future rate > BETR → convert. If expected future rate < BETR → don't convert.

**Core formula (Kitces/standard — taxes paid from outside the IRA, e.g. from taxable account):**
```
BETR = t_now × (1 + r_taxable)^n / (1 + r_ira)^n

where:
  t_now       = current marginal tax rate on the conversion amount
  r_taxable   = after-tax annual return on taxable account (r × (1 − effective_drag))
  r_ira       = IRA growth rate (same as r_taxable if tax-equivalent, often r itself)
  n           = years until withdrawal (retirement horizon)
```

If `r_taxable ≈ r_ira` (no taxable drag), BETR = t_now — trivially break-even at the current rate. The value of the metric emerges when taxable drag (`r_taxable < r_ira`) reduces BETR below t_now, meaning conversion is advantageous even at a *lower* future rate.

**Vanguard's tool note:** Vanguard has not published their exact formula. Their tool at [advisors.vanguard.com/tax-center/tools/roth-betr-calculator](https://advisors.vanguard.com/tax-center/tools/roth-betr-calculator/#/) is black-box to advisors. The formula above is the standard academic version (Kitces, Reichenstein). Vanguard's version likely adds:
- **RMD drag:** forced IRA distributions reinvested taxably create cumulative tax friction that Roth avoids; this lowers BETR (makes conversion more attractive)
- **State tax differential:** if state taxes differ between now and future (e.g., moving states)
- **SECURE Act heir factor:** beneficiaries face 10-year distribution rule on inherited IRA; Roth avoids this drag; extends BETR benefit for estate planning scenarios

**Recommended approach:** Implement Kitces standard formula first (well-validated, fully public). Note Vanguard adds RMD drag and heir factors — add those as Phase 21b if desired.

**Revised exposure (2026-06-02):** BETR is a per-year signal, best surfaced three ways:
1. **Annual Details column** (`betr`) in the Opp. Cost category — each row shows BETR % + ▲ (future rate > BETR = beneficial) or ▼ (below = detrimental). Primary display.
2. **Summary stat** `stat-betr-avg` near `stat-conv-be` — average BETR across all conversion years.
3. **Collapsible sensitivity table** near max-conversion input — BETR at n = 5/10/15/20/25 yr horizons.

**Inputs:**
- `t_now` — derives from `calculateTaxes()` marginal rate at conversion bracket boundary
- `r_taxable` — auto-derive: `r_ira × (1 − dividendYield × dividendTaxRate)` from brokerage allocation
- `n` — years to RMD onset (or user-specified horizon)
- `t_expected_future` — existing `futureIRATaxRate` input (Phase 20)

**Tasks:**
- [ ] Implement `computeBETR(tNow, rIRA, rTaxable, n)` in `retirement_optimizer_core.js`
- [ ] Derive `r_taxable` from brokerage allocation (dividend yield × cap gains drag)
- [ ] Compute BETR each year inside `simulate()` year loop when conversion occurs; store in log
- [ ] Annual Details: add `betr` column (Opp. Cost category); ▲/▼ flag vs `futureIRATaxRate`
- [ ] Stats bar: add `stat-betr-avg` element; `updateStats()` populates from log averages
- [ ] UI: collapsible BETR sensitivity table (5/10/15/20/25 yr) near max-conversion input
- [ ] Test: `r_taxable = r_ira` → BETR = t_now (identity)
- [ ] Test: `r_taxable < r_ira` → BETR < t_now (drag lowers break-even rate)
- [ ] Test: increasing n with drag → BETR decreases (longer horizon, more drag accumulates)
- [ ] Update version + changelog

- **Status:** complete — v11.e64
- **Depends on:** Phase 20 ✓ (futureIRATaxRate input exists), Phase 1 ✓ (bracket/marginal rate correct)
- **Blocks:** Phase 23 (BETR column data feeds Phase 23 optimizer table)
- **Reference:** Kitces (2013) "Roth Conversion Analysis: The True Marginal Tax Rate Equivalency Principle"
- **Formula correction:** plan had `1 − t_now×(...)` — wrong; correct formula is `t_now × (1+r_taxable)^n / (1+r_ira)^n`

---

### Phase 22: Guyton-Klinger Guardrails Withdrawal Strategy
**Why:** All current strategies use fixed annual spend (possibly inflation-adjusted). Guyton-Klinger (GK) uses dynamic spending: adjust up when portfolio outperforms, adjust down when it underperforms. Published research (Guyton 2004, Guyton & Klinger 2006) shows GK supports materially higher initial withdrawal rates (~5.2–5.5%) than static SWR (~4%) with comparable ruin probability, because spending flexibility absorbs sequence-of-returns risk.

**Four GK Rules (from Guyton & Klinger 2006):**

| Rule | Condition | Action |
|------|-----------|--------|
| **Withdrawal Rule (base)** | Every year | Take previous year's spend, adjusted per rules below |
| **Inflation Rule** | Prior year portfolio return was negative AND current WR > IWR | Skip inflation adjustment this year |
| **Capital Preservation Rule** | Current WR > IWR × (1 + upper_guard) | Reduce spending by `cut_pct` (e.g. 10%) |
| **Prosperity Rule** | Current WR < IWR × (1 − lower_guard) | Increase spending by `raise_pct` (e.g. 10%) |

Where:
- `IWR` = initial withdrawal rate = first year spend / initial portfolio at retirement
- `current WR` = current annual spend / current portfolio value
- `upper_guard` = default 0.20 (20% above IWR triggers cut)
- `lower_guard` = default 0.20 (20% below IWR triggers raise)
- `cut_pct` / `raise_pct` = default 10%

**Interaction with existing strategies:** GK is a spending-adjustment layer, not a tax/withdrawal-account strategy. It determines *how much* to spend each year; the existing bracket/IRMAA/RMD logic then determines *how* to source that spend. GK strategy = "Guyton-Klinger" as the top-level strategy choice, then per-existing-logic for account sourcing.

**Key constraint — "no adjustment in final years" rule (optional):** Some implementations disable the Prosperity Rule within 15 years of plan end to prevent excessive late-life spending increases. Make configurable.

**Implementation in `simulate()`:**
```javascript
// GK state (persisted across years)
let gkSpend = inputs.spendGoal; // initial spend at retirement
const iwr = gkSpend / totalPortfolio_at_retirement;

// Each year:
const currentWR = gkSpend / totalPortfolio;
const priorReturn = totalPortfolio / priorPortfolio - 1;

// Inflation Rule: skip CPI adjustment if negative return year AND over-withdrawn
if (priorReturn < 0 && currentWR > iwr) {
  // no inflation adjustment
} else {
  gkSpend *= (1 + inflation);
}

// Capital Preservation Rule
if (currentWR > iwr * (1 + upperGuard)) {
  gkSpend *= (1 - cutPct);
}

// Prosperity Rule
if (currentWR < iwr * (1 - lowerGuard)) {
  gkSpend *= (1 + raisePct);
}

inputs.spendGoal = gkSpend; // override spend for this year
```

**UI inputs** (collapsible sub-section when GK strategy selected):
- Initial withdrawal rate % (or derive from spendGoal / initial portfolio — show derived IWR)
- Upper guardrail % (default 20%)
- Lower guardrail % (default 20%)
- Cut % (default 10%)
- Raise % (default 10%)
- Disable Prosperity Rule in final N years (default: 0 / off)

**Annual Details additions:**
- `gkSpend` column (actual GK spending target that year)
- `gkAdjustment` column: "−10% cap. pres." / "+10% prosperity" / "inflation skipped" / "—"
- Filter checkbox: "GK Adjustments" category

**MC compatibility:** GK is inherently Monte Carlo-friendly — the dynamic adjustments are the mechanism for sequence-of-returns resilience. Running GK in MC mode (Phase 2 bootstrap) should show meaningfully better survival rates vs fixed spending at same IWR. This comparison is a key validation test.

**Tasks:**
- [x] Add "Guyton-Klinger" to strategy selector in UI
- [x] Add GK sub-inputs (IWR display, guardrail %, cut/raise %) that appear when GK selected
- [x] Add GK state variables to `simulate()`: `gkIWR`, `gkPriorReturn`, `gkPrevPortfolio`
- [x] Implement four GK rules in year loop (Inflation Rule first, then guardrail checks)
- [x] Annual Details: `gkSpend` and `gkAdj` columns (Income category)
- [x] Test: stable market → no guardrail triggers
- [x] Test: catastrophic bear (-80%) → Capital Preservation fires
- [x] Test: strong bull (+200%) → Prosperity fires
- [x] Test: Inflation Rule fires with mild negative return + inflation
- [x] Test: non-GK strategy → null gkSpend/gkAdj (regression)
- [x] URL encoding: gku/gkl/gkc/gkr short aliases
- [x] buildVariations() GK row
- [x] Update version (11.1042) + changelog
- **Key design decision:** GK uses raw portfolio balance (not tax-discounted totalWealth) for IWR/WR comparisons — avoids CA-tax apples-vs-oranges mismatch that caused spurious CP triggers.

- **Status:** complete (commit 4a7fec5, 2026-06-22)
- **Independent:** no phase dependencies (GK is a new strategy type; bracket logic from Phase 1 already works)
- **Integrates with:** Phase 10 (GK as one of the segment strategy options), Phase 12 (timing model applies to GK withdrawals)
- **Reference:** Guyton (2004) "Decision Rules and Portfolio Management for Retirees", Guyton & Klinger (2006) "Decision Rules and Maximum Initial Withdrawal Rates"

---

### Phase 23: Roth Conversion Amount Optimizer
**Why:** Current tool converts surplus only — whatever IRA withdrawal exceeds spending need. This couples two independent decisions: (1) where to source spending, (2) how much to convert. A user spending from Roth/brokerage this year has no way to also convert $80k from IRA. The optimal conversion amount is different every year (IRA balance, bracket inflation, SS phase-in, RMD proximity all change), so the tool must compute a per-year schedule, not a single bracket choice. BETR answers "should I?" — Phase 23 answers "how much?"

**Research basis:** MaxiFi (Kotlikoff) uses full iterative DP to maximize lifetime discretionary spending; "go big" conversions above bracket limits can win by eliminating decades of RMD compounding. Phase 23 approximates this via greedy DP using the existing `simulate()` as the evaluation function.

**Core architecture: `simulate()` gets `inputs.extraConversionAmount`**

New input (scalar $ or per-year array) — after the spending/withdrawal block (after line 1120), withdraw this amount from IRA and route directly to Roth, independent of spending strategy. Additive and independent; tax recalculation pass captures incremental tax on the extra IRA withdrawal. Array form: `inputs.extraConversionAmount[y] ?? scalar ?? 0`.

**Finding the optimal amount — $10k sweep (not pure binary search)**

The objective function (final wealth) is non-convex (converting more helps then hurts). Binary search can miss the global optimum. Instead: sweep `extraConversionAmount` from $0 to totalIRA in $10k increments (~100–200 `simulate()` calls per strategy, fast). Pick the amount with best score.

```
optimizeConversionAmount(baseInputs, strategyOverrides, metric='finalNW'):
  for conv in range(0, totalIRA, 10000):
    res = simulate({...base, ...overrides, extraConversionAmount: conv})
    score = res.finalNW (or totals.spend, or totals.tax)
  return conv with best score
```

**Greedy DP per-year schedule**

For each year t from retirement to max(RMD ages):
1. Run conversion sweep for year t (holding prior years fixed at their already-determined amounts)
2. Lock in optimal C_t; advance to year t+1 with updated balance state
3. Result: array `convSchedule[y]` — per-year optimal conversion amounts

Output table (stored in log, shown in Annual Details):
```
Year | Age | Opt Conv  | Bracket | BETR | Beneficial?
2025 | 60  | $62,400   | 22%     | 19%  | ▲
2026 | 61  | $58,900   | 22%     | 19%  | ▲
2033 | 68  |      $0   | —       | —    | — ← SS fills bracket
```

**Optimizer integration — "Include conversion optimization" checkbox**

When enabled (opt-in), for each strategy row in `buildVariations()`, run `optimizeConversionAmount()` → add new rows showing the strategy + optimized conversion. New optimizer table columns:
| Column | Shows |
|--------|-------|
| **Opt Conv $/yr** | Average optimal annual conversion for this strategy |
| **Conv Savings $** | Lifetime tax saved vs same strategy with zero conversion |
| **MC Survival (conv)** | Stage 2 MC survival at optimal conversion (top-K only) |
| **BETR avg** | Average BETR across conversion years |

**MC validation (Stage 2)**

Stage 1 deterministic sweep → top-K (strategy + optimal conversion amount) pairs → Stage 2 MC (500 paths) runs those K pairs with the deterministic conversion schedule locked in. Adds MC survival column. Deterministic winner vs MC winner shown if they differ.

**Projected RMD stat (always shown)**

Add to stats bar:
- `stat-proj-rmd1`: "Person 1 RMD (age 73 in 2031): est. $28k/yr"
- `stat-proj-rmd2`: "Spouse RMD (age 75 in 2036): est. $14k/yr"

RMD age per SECURE 2.0: born 1951–1959 → 73, born 1960+ → 75. If already past RMD age: show actual current-year RMD from simulation log. Both lines always shown; spouse line hidden if no spouse. Computed in `updateStats()`:
1. `rmdStartAge` per birth year
2. `projIRA = balance × (1 + iraRate)^yearsToRMD`
3. `firstRMD = projIRA ÷ IRS_ULT_factor[rmdStartAge]` (Uniform Lifetime Table)

**Tasks:**
- [ ] Add `extraConversionAmount` param to `simulate()` (scalar or array); conversion top-up block after line 1120 with 4th tax-recalculation pass
- [ ] Implement `optimizeConversionAmount(baseInputs, overrides, metric)` — $10k sweep
- [ ] Implement `buildConversionSchedule(baseInputs, overrides)` — greedy DP year-by-year
- [ ] `buildVariations()`: when `includeConvOpt` flag set, run `optimizeConversionAmount()` per strategy row; add results as new rows
- [ ] `renderOptimizerTable()`: add Opt Conv $/yr, Conv Savings $, MC Survival (conv), BETR avg columns
- [ ] MC Stage 2: identify top-K from conversion-optimized rows; run MC with locked schedule
- [ ] `updateStats()`: compute + display `stat-proj-rmd1/2` per SECURE 2.0 rules; use IRS ULT table
- [ ] Annual Details: show `convSchedule` amounts as a log column (Opp. Cost category)
- [ ] `retirement_optimizer.html`: "Include conversion optimization" checkbox near optimizer; `stat-proj-rmd1/2` in stats bar; new optimizer columns
- [ ] Test: `extraConversionAmount = 0` → bit-identical to pre-change baseline (regression)
- [ ] Test: conversion sweep — "opt conv" row beats surplus-only row on Final NW for large-IRA ($800k+) scenario
- [ ] Test: greedy DP schedule tapers to $0 near RMD onset (sanity)
- [ ] Test: projected RMD stat updates when IRA balance changes; spouse line hidden if no spouse
- [ ] Update version + changelog

- **Status:** complete (core) — v11.e64. Greedy DP per-year schedule (Phase 23b) pending.
- **Depends on:** Phase 21 ✓ (BETR data for avg column), Phase 20 ✓ (shadow tracking context), Phase 1 ✓ (bracket logic correct)
- **Note:** Subsumes most of Phase 10's conversion dimension. Phase 10 remains but is deprioritized — its remaining unique value is spending-source segmentation (which accounts fund spending per segment), not conversion optimization.
- **What's implemented:** extraConversionAmount in simulate(), optimizeConversionAmount() $25k sweep, Conv Optimizer toggle in optimizer (top-5 strategies), projected RMD stat, BETR avg column in optimizer table.
- **What's deferred (Phase 23b):** Greedy DP per-year conversion schedule; MC Stage 2 validation of top-K conversion strategies.

---

## Key Questions
1. Should Phase 1 (bracket/IRMAA fix) be done before strategy comparisons work correctly?
2. ~~For Phase 2 (bootstrap), which years of historical data?~~ **Resolved:** Full 1928–2024 (97 years), pre-1970 intl proxied by equity.
3. ~~For Phase 6 (per-account asset mix), should allocation grids be per-account or global?~~ **Resolved:** Per-account, done in Phase 6.
4. What is the user's order of implementation preference for remaining phases (3, 4, 9, 10)?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Execute 0b → {1,2,3,4,6,8} in parallel (except 0b) | Cleanup is 1 file, fast. Bracket fix (1) critical path. Bootstrap (2) unblocks MC work. Three quickwins (3,4,8) independent. Asset mix (6) needed for Phase 7. |
| Phase 1 (bracket) before Phase 9 (ACA) | Bracket fix inverts withdrawal logic; ACA refinement depends on working bracket/IRMAA logic. Critical path: 1 → 9 → 10. |
| Bootstrap (Phase 2) before correlated MC (Phase 7) | Bootstrap is simpler, captures distribution shape. Phase 7 (Cholesky correlation) builds on Phase 2 framework. Regime-switching (11) also references bootstrap for comparison. |
| Phase 6 (per-account asset mix) before Phase 7 | Correlated MC needs per-account allocation grids. Phase 6 defines allocation framework. |
| Phases 3,4,8,12 can start anytime after 0b | Lumpy spending, QCDs, variable growth optimizer, and quarterly mode are all independent. Schedule per team capacity. |
| Phase 9 (ACA) before Phase 10 (multi-strategy) | Multi-strategy optimizer needs clean ACA constraint handling to avoid generating invalid 2-phase combos where both phases use deprecated ACA limits post-65. |
| Phase 23 before Phase 10 | Phase 23 (greedy DP conversion optimizer) subsumes Phase 10's conversion dimension. Phase 10's remaining unique value is spending-source segmentation only. Deprioritize Phase 10 until Phase 23 is shipped. |
| Phase 21 before Phase 23 | BETR data (per-year `betr` log column) feeds Phase 23's optimizer table BETR avg column. Implement BETR first. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

### Phase 25: Simulation Sanity-Check Tests
**Why:** Complex financial simulation accumulates subtle math errors that are invisible in normal use. A portfolio may show "correct-looking" numbers while quietly mis-compounding, double-counting, or mis-routing cash. Deterministic edge cases with known exact answers expose these bugs. The netSpend%, IRMAA tier, and BETR columns added in recent sessions make this more urgent — incorrect underlying data produces incorrect derived metrics.

**Core test: zero-growth, zero-inflation portfolio depletion**

With no growth and no inflation, a portfolio of $X drawing $S/year (all from one account type, no taxes) must deplete at exactly year `floor(X/S)`. Any deviation exposes a compounding or routing error.

Specific cases to add to `retirement_optimizer_core.test.js`:

| Test | Setup | Expected result |
|------|-------|-----------------|
| **Linear depletion** | growth=0, inflation=0, Roth-only portfolio $1M, spend $50k/yr, no SS | Depletes at year 20; years 1–19 fully funded; netSpend% = 5.0% each year |
| **SS covers all spend** | SS=$60k, spend=$50k, zero portfolio | Portfolio unchanged across all years; netSpend%=0; no shortfall |
| **Roth conversion identity** | extraConversionAmount=$X, growth=0, inflation=0 | `rothConv` log column sums to exactly X × years; IRA reduced by gross conv; Roth increased by net conv |
| **RMD accuracy** | IRA=$1M at age 73, zero growth | First RMD = $1M ÷ 26.5 (Uniform Lifetime Table factor) ± 1 (rounding); `RMD1-` matches |
| **netSpend% identity** | zero growth, zero inflation, single-account spend | netSpend% = spend / startingWealth each year (exact, no surplus, no conversion) |
| **Surplus reinvestment** | income > spendGoal | surplusCash > 0; netSpend% reflects only actual consumption; total wealth increases |

**Implementation:**
- Tests go in `retirement_optimizer_core.test.js` (existing Jest/Vitest file)
- Use `simulate(inputs)` directly; assert on `log[y]` fields and `totals.*`
- Helper: `makeZeroBaseInputs()` — zeroed growth/inflation/taxes, single account

**Status:** pending
**Priority:** high — catches regressions before they reach users
**Depends on:** nothing (uses existing simulate() interface)

---

### Phase 26: Retire the Optimizer Tab → MC-Driven Strategy Comparison
**Why:** The Optimizer tab runs every strategy deterministically and ranks them. Deterministic wins are misleading — the "best" strategy in a single market path may be fragile under real market variance. Monte Carlo (Phase 2 bootstrap) already gives the honest answer: survival probability, median/p10 outcomes across hundreds of realistic return sequences. Maintaining a separate deterministic optimizer creates false confidence and doubles the UI surface.

**What the optimizer does today:**
- Sweeps 42+ strategy/param combos; ranks by tax, spend, wealth, RMD tax
- Useful for: quick strategy discovery, bracket comparison
- Limitation: single deterministic path; can crown a winner that fails badly in poor sequence-of-returns

**What MC does today:**
- One strategy at a time, 500+ paths, survival %, fan charts, p10 final wealth
- Better question ("will I run out of money?") but no cross-strategy comparison

**Proposed replacement: MC Strategy Sweep**
- New MC sub-feature: "Compare strategies" checkbox (or separate mode)
- Runs the top 5–6 candidate strategies through full MC (same 500 paths)
- Comparison table: strategy | survival % | median final wealth | p10 wealth | median lifetime tax
- This is the Phase 10 Stage 1+2 concept but without the multi-segment complexity — keep it simple first
- Remove Optimizer tab entirely (or hide behind a `?nerdknob` URL flag for power users)

**Migration path:**
1. Add MC strategy comparison table (run selected strategies side-by-side in MC)
2. Move bracket feedback / strategy selector to main input panel (already there partially)
3. Gate existing optimizer behind `?optimizer=1` URL param — don't hard-delete yet
4. After MC comparison ships and is validated, remove optimizer code

**What to keep from optimizer:**
- `getOptimizerColumns()` and `buildVariations()` can feed the MC strategy sweep
- Conversion optimizer (`optimizeConversionAmount`) remains useful — hook into MC mode
- Infeasibility detection (bracket strategies that can't work) — surface as inline warnings on strategy selector

**Tasks:**
- [ ] Design MC comparison table: which strategies to include, how to surface winner
- [ ] Add "Compare in MC" mode to mc_tab.js that runs top-N strategies and aggregates results
- [ ] Move bracket feedback to main strategy selector (already partially done via `bracket-feedback` div)
- [ ] Gate optimizer tab behind URL param `?optimizer=1`
- [ ] Update How to Use docs: remove optimizer section, explain MC comparison
- [ ] Test: MC comparison table ranks strategies by survival % consistently with intuition

**Status:** pending — pre-design
**Note:** Deprioritize optimizer-only phases (Phase 5 Scenario Comparison, Phase 8 Sensitivity Grid) until this architectural question resolves. They may be superseded by MC comparison.

---

### Phase 27: Withdrawal Rate — Fix Label, Formula, and Add Inflows/Outflows Columns
**Why:** "Average Spend Rate" is a misleading label. The metric should be called "Withdrawal Rate" and should equal (Outflows − Inflows) / starting assets. Currently `_netAssetDraw` excludes conversions and surplus reinvestment but does NOT subtract SS/pension inflows — so it overstates the portfolio draw in income-heavy years.

**Current formula (core.js ~L1435):**
```javascript
_netAssetDraw = (IRA + RMD + extraConv + Brokerage + Cash + Roth1 + Roth2) − totalConverted − reinvestedSurplus
_netSpendPct  = _netAssetDraw / prevTotalWealth
```
Missing: subtract SS income, pension, and any other income-side inflows (money that covered spending WITHOUT touching portfolio).

**Correct formula:**
```
Outflows = gross portfolio withdrawals (IRA+RMD+Brokerage+Cash+Roth) that fund spending/taxes
Inflows  = SS income + pension + any non-portfolio income applied to spending this year
Withdrawal Rate = (Outflows − Inflows) / prevTotalWealth
```
Note: Roth conversion = IRA→Roth reallocation, neither outflow nor inflow. Already excluded. ✓

**New Annual table columns (checkbox categories):**
- `outflows` — gross portfolio withdrawals this year (IRA+RMD+Brokerage+Cash+Roth, before conversion netting)
- `inflows` — SS + pension + other non-portfolio income applied to spending

**Stats bar change:** rename `stat-avg-spend-rate` element label/tooltip to "Avg Withdrawal Rate".

**Implementation tasks:**
- [x] Compute `_grossOutflows`, `_netOutflows`, `_yearInflows` in simulate() year loop; `_wdRate = (netOut − inflows)/prevTotalWealth`
- [x] Log fields `grossOut`, `netOut`, `inflows`, `wdRate%` (replaces `netSpend%`); column maps + groups + tooltips wired
- [x] User decision: BOTH gross and net outflow columns (gross incl. conversion-funding draws; net reconciles with rate)
- [x] `totals.avgWdRate` (replaces `avgSpendRate`); HTML label "Avg Withdrawal Rate" + new tooltip; element id unchanged
- [x] Test: SS covers spending → wdRate ≤ 0 (verified negative at SS start in browser: −1.87%)
- [x] Test: no SS → wdRate = netOut/prevWealth (regression); reconciliation netOut ≤ grossOut − rothConv; pension lowers rate; conversion year grossOut−netOut ≥ conv
- **Status:** complete — v11.ecc (2026-06-11). Node suite 18/18; browser suite 207/207.
- **Independent:** no phase dependencies

---

### Phase 28: Bad Markets / Sequence-of-Return Risk Stress Mode
**Why:** Both MC modes (GBM and bootstrap) produce paths that on average show historical returns. SoRR risk means bad returns in the *first 5–10 years* of retirement are disproportionately damaging — but with 500 random paths, only ~16% will happen to start in a bad sequence. Most paths look fine. The distribution masks the tail risk that matters most for retirement decisions.

**User observation:** "I am not seeing any Sequence of Return Risk in most of my analysis."

**Root cause:** Bootstrap samples randomly from all 97 years. Even if some paths start with -30%, they're diluted by 84% of paths that don't. The *average* looks rosy because most paths are fine. The p10 outcome is visible in fan charts but not intuitively communicated as "what happens if you retire into a bear market."

**Three complementary solutions (recommended: implement all three):**

**A. Bear-Start Mode (most direct SoRR fix)**
Force the first 3-year block of every path to sample from the worst historical tercile (roughly: first-3yr CAGR < −5%). Implementation: in `bootstrapMultiAssetBank()`, for blocks at position 0, restrict the draw pool to blocks where `equity[b] + equity[b+1] + equity[b+2] < threshold`. All subsequent blocks sample freely. This guarantees every path experiences a bad opening sequence — tests pure SoRR resilience. Toggle in nerd panel: "Bear Start" checkbox.

**B. Historical Worst-Decade Scenarios (deterministic stress tests)**
Run 3–4 deterministic paths using actual historical sequences as "stress test" overlays:
- 1966 start: stagflation decade, 15yr of negative real returns
- 1929 start: Great Depression (−43% yr 1, −35% yr 2, etc.)
- 2000 start: double-crash (tech bust + GFC within 8 yrs)
Show these as colored overlays on the fan chart (thin dashed lines) and a separate "Stress Test" row in MC summary table: "1966 scenario: depleted in year X."
Implementation: add `HISTORICAL_SEQUENCES` constant with named arrays; run `simulate()` with those as forced return sequences.

**C. CAPE-Adjusted Pessimistic Preset (most "current market" realistic)**
Current CAPE-Shiller ratio (~35+) implies forward 10-yr real returns ~2–4% vs the historical ~7% assumed by default bootstrap. Add a "Pessimistic (CAPE-adjusted)" GBM preset button that sets: μ = 5% (vs ~10.7% historical nominal), σ = 17% (unchanged). Rationale: Jeremy Grantham, Research Affiliates, and the Fed model all suggest lower expected equity returns over the next decade given elevated valuations. This is the "realistic for current conditions" option.

**Recommendation to user:** Bear-Start Mode for SoRR specifically; Historical Scenarios for visual stress testing; CAPE preset for "what if returns disappoint" sensitivity.

**Implementation tasks:**
- [ ] `prng.js`: add `bearStartBootstrap()` variant — same as `bootstrapMultiAssetBank()` but first block drawn from worst-tercile subset; expose `bearStart: bool` param
- [ ] `worker.js`: pass `bearStart` param through; route to `bearStartBootstrap()` when set
- [ ] `mc_controller.js`: accept `bearStart` in cfg; pass to worker
- [ ] `mc_tab.js`: add "Bear Start" checkbox in nerd panel (only visible in bootstrap mode)
- [x] Option B implemented as "Stress (worst sequences)" mode: `buildStressBank()` scores all historical start years by first-decade equity CAGR, takes worst N (default 10), runs deterministic spaghetti lines with per-scenario labels (eq/inf CAGR). Worst 10: 1929, 1999, 2000, 1930, 1928, 1931, 1965, 2001, 2002, 1969.
- [x] Legend click isolation (click to isolate one line/group, click again to restore)
- [x] Multi-strategy colors (family hue + rank-based opacity)
- [ ] Option A (Bear-Start bootstrap): not implemented — deprioritized, Stress mode covers the user's stated need
- [ ] Option C (CAPE-adjusted pessimistic preset): not implemented — deprioritized
- **Status:** complete (Option B as implemented per user direction; A and C not requested)
- **Independent:** no hard phase dependencies (builds on Phase 2 bootstrap infrastructure ✓)

---

### Phase 29: Creeping Tax Rate Model
**Why:** US federal debt-to-GDP ~120%+. Tax rates are historically low. TCJA was made permanent in 2025, so no imminent automatic sunset — but Congress can always change rates. Future rate increases remain plausible given fiscal trajectory. Tool assumes today's brackets persist forever — optimistic for a 30-year simulation.

**Two modeling options:**

**A. Rate Escalation (primary feature)**
Add input: "Annual tax rate increase: __% per year starting in year ___". Each year after the start year, multiply all marginal rates by `(1 + annualIncrease)^yearsElapsed`. E.g., 0.5%/yr → by year 20, marginal rates ~10% higher. Apply to income tax brackets. Optionally apply to capital gains rates (toggle).

Example: 22% bracket → 24.2% in year 10 at 0.5%/yr. 32% → 35.2%.

**B. Pre-TCJA Rate Schedule (stress test scenario)**
TCJA is permanent now, but modeling a return to pre-TCJA rates (25/28/33/35/39.6%) is still a valid "what if Congress acts" stress test. Earliest realistic year: 2027+. Model as a one-time bracket schedule swap at a user-specified year (default: off, no suggested default since TCJA is now permanent). Two bracket tables: `BRACKETS_CURRENT` and `BRACKETS_PRE_TCJA`; switch at `taxRateChangeYear`.

**Framing in UI:** Label option as "Pre-TCJA rates (what if rates rise?)" not "TCJA expiration" — TCJA was extended; this is a hypothetical stress test.

**Interaction with IRMAA:** IRMAA thresholds are CPI-adjusted per law. If income tax rates rise but IRMAA thresholds hold, IRMAA becomes more prevalent. May not need special treatment — note in tooltip.

**Implementation tasks:**
- [ ] Add inputs: `taxRateEscalation` (% per year, default 0), `taxEscalationStartYear` (default 0 = off), `taxRateChangeYear` (default 0 = off)
- [ ] `calculateTaxes()`: apply rate multiplier `= (1 + escalation)^max(0, currentYear − startYear)` to all bracket rates before computing tax
- [ ] Pre-TCJA cliff: if `taxRateChangeYear > 0 && currentYear >= taxRateChangeYear`, switch to `BRACKETS_PRE_TCJA` tables
- [ ] Add `BRACKETS_PRE_TCJA` constant with pre-TCJA rates (25/28/33/35/39.6 + MFJ thresholds)
- [ ] UI label: "Hypothetical rate increase year" (not "TCJA expiration"); tooltip explains TCJA is now permanent but future changes are possible
- [ ] Annual Details: add `taxRateMultiplier` column (Debug or "Tax Policy" category)
- [ ] Test: escalation=0 → bit-identical to current output (regression)
- [ ] Test: pre-TCJA switch year set → taxes jump that year matching pre-TCJA bracket changes
- [ ] Test: escalation=1%/yr over 20 yrs → 22% bracket becomes ~26.8% in year 20
- **Status:** pending
- **Independent:** no phase dependencies (modifies `calculateTaxes()` which is already isolated)
- **Note:** TCJA made permanent 2025. Pre-TCJA scenario is a hypothetical stress test, not an expected event. Default all options off. User opts in explicitly.

---

### Phase 31: State Tax Bracket Inflation Indexing Audit & Fix
**Why:** Engine currently inflates ALL state brackets by the `inflation` multiplier each projection year. Some states have brackets set by statute (not CPI-indexed), so projecting higher nominal brackets for those states is incorrect — it understates future tax for residents of non-indexed states.

**Research findings (from taxengine.js comments):**
| State | Indexed? | Evidence |
|-------|----------|----------|
| CA | ✓ YES | "Thresholds inflation-adjusted by CA FTB (~2.971% CCPI)" |
| ME | ✓ YES | "brackets inflation-adjusted annually by Maine Revenue Services" |
| MN | ✓ YES | "brackets inflation-adjusted ~4%/yr by MN DOR" |
| WI | ✓ YES | "brackets inflation-adjusted annually by WI DOR" |
| NJ | ✓ YES | "Lower bracket thresholds indexed for inflation annually" |
| MT | ✗ NO  | "brackets NOT inflation-indexed — unchanged through 2026" |
| ND | ✗ NO  | "brackets NOT inflation-indexed — unchanged through 2026" |
| AL | ✗ NO  | "brackets/rates unchanged since 2006" |
| OH | ✗ NO  | Statutory fixed thresholds from HB 96 (2024); Ohio doesn't CPI-index brackets |
| SC | ✗ NO  | Act 47 phase-down: fixed statutory thresholds, not CPI-adjusted |
| Flat-rate states (AZ/CO/IN/KY/NC/PA/GA/IL/MA/MI) | N/A | No progressive brackets; flat rate × income |

**Approach:** Add `INFLATION_INDEXED: false` property to state objects in TAXData for non-indexed states. Engine checks flag in two places: (1) `calculateProgressive()` uses `inflation=1` when entity has `INFLATION_INDEXED: false`; (2) std deduction in `taxengine.js:calculateTaxes()` also uses `1` not `inflation` for non-indexed states.

**Implementation tasks:**
- [x] Add `INFLATION_INDEXED: false` to MT, ND, AL, OH, SC objects in `taxengine.js`
- [x] `retirement_optimizer_core.js:calculateProgressive`: check `TAXData[entity]?.INFLATION_INDEXED === false`; if so, use `effectiveInflation = 1`
- [x] Tests: MT/ND tax same at inflation=1.1 as 1.0; CA inflation=1.1 lowers tax vs 1.0 (brackets widen)
- Note: std deduction inflation (taxengine.js:905) left unchanged — ND/SC stds follow federal (should inflate); AL/OH/MT std fix is separate future work if desired
- **Status:** complete
- **Independent:** no phase dependencies

---

### Phase 30: Verify GBM Statistical Mode Uses User Growth Rate
**Why:** User reports GBM mode may not reflect their supplied growth rate. The GBM worker receives `mu` from the controller. Need to verify: (1) where `mu` is populated in `mc_controller.js` / `mc_tab.js`, (2) whether it defaults to the user's growth rate input or a hardcoded value, (3) whether there's a disconnect between the main inputs panel growth rate and the nerd panel μ.

**Expected behavior:** In GBM mode, μ should default to the user's growth rate input. The nerd panel should pre-populate μ from the user's growth rate whenever GBM mode is selected, so results are consistent with the deterministic simulation assumptions. User should be able to override μ in nerd panel, but it should start from their stated assumption.

**Investigation tasks:**
- [ ] Read `mc_controller.js`: find where `mu` is populated; trace to UI source
- [ ] Read `mc_tab.js`: find the nerd panel μ input element; check if it's linked to main growth rate
- [ ] Check `mc_controller.js` `runMC()` call: what value does `mu` receive when user hasn't changed nerd panel?
- [ ] If gap found: auto-populate nerd panel μ from `inputs.growthRate` when GBM mode selected (not bootstrap mode)
- [ ] If already wired: document that GBM μ = user growth rate, update tooltip to confirm
- [x] Investigation: mc-mu was hardcoded at 7%, not reading from Assumptions growth
- [x] Fix: `syncMCMuFromGrowth()` in mc_tab.js — syncs mc-mu from growth on page load, on growth oninput, and when switching to GBM mode
- [x] `updateMCGrowthWarning()`: same >10%/<3% range warnings near mc-mu as in Assumptions section
- [x] Label "Expected Return μ %" → "GBM Return μ %"; tooltip clarified; "replaces Growth %" → "synced from Growth %"
- [x] Test: set growth to 8% → mc-mu auto-populates 8%; change growth to 11% → mc-mu = 11% + warning shown
- **Status:** complete (2026-06-09)
- **Independent:** no phase dependencies

---

### Phase 31: Baseline Accounting for Strategy Comparison
**Why:** Strategy comparison lacked a sound reference. "Strategy A beats B" only means something
relative to the best plan that uses NO Roth conversions and NO brokerage maneuvering. Also, the
terminal-wealth metric overvalued IRA-heavy strategies (discounted IRA + brokerage gains both by
the final-year ordinary marginal rate).

- [x] Fix `totalWealth` (`simulate` `:1476`): brokerage gains × (1−capGainsRate), IRA × (1−nominalTaxRate)
- [x] Expose `totals.terminal`, `totals.capGainsRate`, `totals.futureIRARate`
- [x] `afterTaxNetWorth(terminal, futureIRARate, capGainsRate)` helper (IRA at shared future rate)
- [x] No-conversion / no-cyclic sweep over same families; baseline = max-afterTaxNW successful no-conv row
- [x] Per-row `afterTaxNW` + `_dNW`/`_dTax`; After-Tax NW + Δ NW + Δ Tax columns; winner `w6`; default sort afterTaxNW
- [x] Pinned ⚓ BASELINE row + `#opt-best` entries
- [x] Sort fix: failed plans always rank below successful ones
- [x] Tests: 6 new node tests (24 total); in-page 209/209; browser-verified
- **Status:** complete — v11.1000
- **Decisions:** baseline = best no-conv/no-cyclic; show both raw + after-tax NW (rank by after-tax); pinned row + Δ columns
- **Deferred:** staged-liquidation valuation (single-rate approximation used); state tax at terminal liquidation

---

### Phase R: Structural Refactoring (engineering, not features)
**Why:** Codebase grew to ~8k lines over 22 phases. Four structural smells compound: `simulate()`
god function (1095 lines), `window.optimizer*` global pollution, no module system (script-tag load
order is the only dependency contract), mixed concerns in core.js (sim math + 114 DOM calls in one
file). Roadmap: `.claude/plans/elegant-hopping-squirrel.md`.

- [x] **R1a:** Extract 4 helpers from `simulate()` → module level: `resolveOrderedSeq(seq, rates)`,
  `runOrderedWithdrawal(...)`, `computeYearGrowthRates(inputs, y)`, `buildSimYearLogRecord(p)`.
  `simulate()` 1095 → 987 lines. Closure-captured tax-rate vars now passed explicitly. (commit 7366f1f)
- [x] **R2:** Replace 6 `window.optimizer*` globals with single `OptimizerState` const. Pure rename,
  no behavior change. All refs internal to core.js (verified — zero external callers). (commit 293077f)
- [ ] **R1-remainder:** Extract 3-pass tax+gap-fill block (~150 lines) and surplus-routing (~80 lines).
  Each needs a fat param bundle — deferred.
- [ ] **R3:** Move ~114 `getElementById()` DOM calls out of core.js into displayhelpers.js. Medium risk.
- [ ] **R4:** ES module migration. Blocked: worker.js `importScripts()` + test harness `vm.runInContext()`
  both need rewrites. Do last.
- **Tests:** 29 pass, 0 fail. Verified compatible with merged PR #86 (share-URL compress) — disjoint
  regions, clean auto-merge, 33/33 on merged tree.
- **Status:** R1a + R2 complete; R1-remainder / R3 / R4 pending.

---

---

### Phase 34: RealReturns — Additional Assets (International + TIPS)
**Why:** User wants to track BND, TIPS, and international equity alongside existing Equity/Bonds/Cash/Mix.

**Analysis (2026-06-24):**
- **International (MSCI EAFE):** `HISTORICAL_RETURNS.intl` already in codebase (1970–2024, 55 obs). Not wired into RealReturns.html. Needs 2025 data point added. Limits full chart start to 1970 when intl is visible — either hard-cap the start-year slider when intl is shown, or plot N/A (null) for pre-1970. Easiest add.
- **TIPS:** US TIPS introduced January 1997; only ~28 years of market data. Not in codebase — would need FRED/Bloomberg Barclays US TIPS index data sourced and added to `real_returns_data.js`. Very short history limits usefulness for long-range comparison. Lower priority.
- **BND (total bond market):** Current "Bonds" = 10-yr Treasury, not same as BND (blended maturities). Bloomberg US Aggregate Bond Index available ~1976+. Not in codebase — would need external data. Different duration/risk profile than 10-yr Treasury. Adding would require new data file + Damodaran/Bloomberg sourcing. Medium complexity.
- **Custom Mix slider** already supports any equity/bond/cash blend — users can approximate BND-like profiles by adjusting bond weight.

**Recommended scope:**
- [ ] Add `HISTORICAL_RETURNS.intl` (MSCI EAFE) to RealReturns as 5th selectable asset: "Intl Equity". Wire into `computeSeries()`, stat cards, legend, custom mix allocation, URL (`iso=4`). Add 2025 intl data point to historical_returns.js.
- [ ] Cap start-year slider at 1970 when intl dataset is visible (or render null/gap for pre-1970).
- [ ] TIPS: defer — requires external data sourcing, only 28yr history, marginal value.
- [ ] BND/Agg: defer — requires Bloomberg Agg data sourcing from 1976; consider if user wants this vs current 10-yr Treasury.
- **Status:** pending

---

### Phase 35: RealReturns — Annual Real Returns Mode
**Why:** Current chart shows cumulative $10k growth only. User wants year-by-year real returns view (like HYSA.html "Annual Returns" tab) to see which individual years were good/bad for each asset.

**Analysis (2026-06-24):**
- `annualData[]` already stores `{rEq, rBd, rCa, rMix}` per year — data is ready.
- HYSA uses separate tabs (Annual / Cumulative) with separate Chart instances. RealReturns could use simpler approach: a Mode toggle button (Cumulative | Annual) that reconfigures the existing chart.
- In Annual mode: switch dataset `type` to `'bar'`, data becomes real-return % per year (not cumulative $). Each bar colored by asset color (green-ish for positive, red for negative, or just use asset color throughout). Y-axis becomes % (not $k log scale).
- `buildShareURL` would add `md=ann` param (default = cumulative, omitted).
- Stat cards remain unchanged (they show full-period stats, relevant in both modes).
- Legend isolation still works — hide other assets' bars.
- Nominal overlay in Annual mode: overlay bar would show nominal return alongside real bar for that asset (grouped bars or separate line).

**Implementation sketch:**
- Add `viewMode = 'cumulative'` state variable; `loadFromURL` reads `md`; `buildShareURL` emits `md=ann` if non-default.
- Add "Mode" toggle button group (Cumulative | Annual) alongside Log/Linear in controls area.
- `switchMode(mode)` function: rebuilds chart datasets and y-axis config (% linear scale for annual, $k log/linear for cumulative). Calls `chart.update()`.
- In Annual mode dataset: `data = annualData.map(d => +(d.rEq * 100).toFixed(2))`, type `'bar'`, `backgroundColor` array per bar (positive = asset color at 0.7 opacity, negative = red at 0.7).
- Scale: `y.type = 'linear'`, `ticks.callback = v => v + '%'`, add `y.suggestedMin = -50`, `y.suggestedMax = 50`.
- **Status:** pending

---

## Notes
- BootstrapPlan.md provides detailed implementation sketches for Phases 2, 7, 10
- optimizer_directions.md priority list shows items already DONE (K+D, A, F, L, G)
- PR #48 (v11 features) likely covers some of these items
- Check MEMORY.md for known TODOs: Roth1/Roth2 table columns, survivor SS bug

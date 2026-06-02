# Task Plan: Retirement Optimizer — Feature Implementation Roadmap

Goal: Implement remaining features from optimizer_directions.md priority list (items B through R), focused on core functionality gaps and Monte Carlo improvements.

## Current Phase
Phases 18, 19, 20 complete. Next candidates: Phase 21 (BETR — unblocked by 20), Phase 3 (Lumpy Spending), Phase 4 (QCDs), Phase 8 (Variable Growth), Phase 9 (ACA Refinement), Phase 12 (Withdrawal Timing), Phase 22 (Guyton-Klinger).
Retirement_Projection fixes added: Phase 13 (responsive layout), Phase 14 (Simple mode), Phase 15 (Tax Planner linkage)

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
└─→ 22 (Guyton-Klinger) [independent, integrates with Phase 10]

EXECUTION ORDER: 0b → 1,2,3,4,6,8 (parallel) → 5,7,9,11,12,20,22 → 21,10
```

**Critical Path:** 0b → 1 → 9 → 10 (longest chain)
**Unblocked quickwins:** 3, 4, 8, 12 (can start anytime after cleanup)

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

- [ ] Add annual QCD amount input
- [ ] Modify tax calculation: subtract QCD from IRA before computing AGI
- [ ] Verify tax benefit is automatic (AGI reduction only)
- [ ] Test with sample QCD amounts
- **Status:** pending

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
- [ ] **TODO:** Add "Historical inflation" as an MC option — sample CPI annual changes (1928–2024) synchronized with the bootstrap return blocks so inflation correlates with market regimes (high inflation often aligns with poor real returns). Deflate each path's spend goal by sampled inflation rather than the fixed inflation rate.
- **Status:** pending

### Phase 9: ACA Limit Strategy Refinement
**Why:** ACA subsidies only matter until age 65. At 65+ (both spouses), Medicare replaces ACA, so ACA limits become irrelevant. Should not offer/enforce ACA limits in strategy after age 65.

- [ ] Add age-gating logic: if earliest spouse age >= 65, disable ACA limit strategies
- [ ] Update UI to hide ACA limit option for retirees age 65+
- [ ] Verify strategy comparison doesn't include ACA limits for 65+ scenarios
- [ ] Test with mixed ages (one 65+, one younger) and both 65+
- **Status:** pending
- **Depends on:** Phase 1 (bracket fix, withdrawal logic works)
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
BETR = 1 − t_now × (1 + r_taxable)^n / (1 + r_ira)^n

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

**Where it fits:** BETR is a *per-conversion-decision* metric, not an annual simulator metric. Best shown:
1. In the Roth conversion section alongside max conversion input — "BETR for this conversion: 28.4%" with annotation "your expected future rate is X% — conversion is [advantageous / not advantageous]"
2. Optionally: table showing BETR sensitivity across time horizons (n = 5, 10, 15, 20, 25 years) to show how BETR evolves

**Inputs needed:**
- `t_now` — derives from `calculateTaxes()` on the conversion amount (marginal rate at conversion bracket boundary)
- `r_taxable` — user-configurable "taxable drag rate" or auto-derive: `r_ira × (1 − dividendTaxRate × dividendYield)` from brokerage allocation
- `n` — years to expected withdrawal onset (e.g., retirement year − current year, or RMD onset)
- `t_expected_future` — user inputs their expected future marginal rate (existing `futureIRATaxRate` input from Phase 20)

**Output:**
- `BETR` as a % shown near max conversion input
- Comparison: "BETR: 24.3% — your expected future rate (28%) exceeds BETR → conversion advantageous"
- Color-coded: green if future rate > BETR (convert), amber if within 2pp (marginal), red if future rate < BETR (don't convert)

**Tasks:**
- [ ] Research: find Kitces' most recent published BETR formula (verify formula handles partial-year RMD drag optionally)
- [ ] Implement `computeBETR(tNow, rIRA, rTaxable, n)` in `retirement_optimizer_core.js`
- [ ] Derive `r_taxable` from brokerage allocation (dividend yield × dividend tax rate drag) or let user override
- [ ] Compute BETR live whenever conversion amount, horizon, or tax rate changes
- [ ] UI: display BETR near max conversion input with comparison to `futureIRATaxRate`
- [ ] UI: optional BETR-by-horizon table (n = 5/10/15/20/25 yr columns)
- [ ] Test: when `r_taxable = r_ira`, BETR = t_now (verify trivial identity)
- [ ] Test: when `r_taxable < r_ira` (taxable drag), BETR < t_now (verify drag lowers break-even rate)
- [ ] Test: increasing n with drag → BETR decreases (longer horizon, more drag cumulates → conversion more compelling)
- [ ] Update version + changelog

- **Status:** pending
- **Depends on:** Phase 20 ✓ (futureIRATaxRate input exists), Phase 1 ✓ (bracket/marginal rate correct)
- **Reference:** Kitces (2013) [Roth Conversion Analysis: The True Marginal Tax Rate Equivalency Principle](https://www.kitces.com/blog/roth-conversion-analysis-value-calculate-timing-true-marginal-tax-rate-equivalency-principle/)
- **Note:** Research phase needed first — confirm Kitces formula variant, check if Vanguard has published methodology since this plan was written

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
- [ ] Add "Guyton-Klinger" to strategy selector in UI
- [ ] Add GK sub-inputs (IWR display, guardrail %, cut/raise %) that appear when GK selected
- [ ] Add GK state variables to `simulate()`: `gkSpend`, `iwr`, `priorPortfolio`
- [ ] Implement four GK rules in year loop (order matters: Inflation Rule first, then guardrail checks)
- [ ] Annual Details: `gkSpend` and `gkAdjustment` columns
- [ ] Test: fixed market returns → verify no guardrail triggers (stable scenario)
- [ ] Test: sustained bear market → verify Capital Preservation triggers at correct WR threshold
- [ ] Test: strong bull run → verify Prosperity triggers at correct WR threshold
- [ ] Test: Inflation Rule — verify skip fires only when both conditions true simultaneously
- [ ] MC test: GK at 5.2% IWR vs fixed 4% SWR — GK should show comparable or better MC survival rate
- [ ] Test: GK integrates with existing bracket/IRMAA account-sourcing logic (GK sets spend level; bracket picks IRA split)
- [ ] Phase 10 integration note: GK should be a valid strategy option in multi-strategy segment optimizer (Phase 10)
- [ ] Update version + changelog

- **Status:** pending
- **Independent:** no phase dependencies (GK is a new strategy type; bracket logic from Phase 1 already works)
- **Integrates with:** Phase 10 (GK as one of the segment strategy options), Phase 12 (timing model applies to GK withdrawals)
- **Reference:** Guyton (2004) "Decision Rules and Portfolio Management for Retirees", Guyton & Klinger (2006) "Decision Rules and Maximum Initial Withdrawal Rates"

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

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- BootstrapPlan.md provides detailed implementation sketches for Phases 2, 7, 10
- optimizer_directions.md priority list shows items already DONE (K+D, A, F, L, G)
- PR #48 (v11 features) likely covers some of these items
- Check MEMORY.md for known TODOs: Roth1/Roth2 table columns, survivor SS bug

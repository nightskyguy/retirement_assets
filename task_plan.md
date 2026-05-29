# Task Plan: Retirement Optimizer — Feature Implementation Roadmap

Goal: Implement remaining features from optimizer_directions.md priority list (items B through R), focused on core functionality gaps and Monte Carlo improvements.

## Current Phase
Phase 7 — complete; next: Phase 3 (Lumpy Spending), Phase 4 (QCDs), Phase 9 (ACA Refinement), or Phase 10 (Multi-Strategy)

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
└─→ 12 (Quarterly Mode) [independent]

EXECUTION ORDER: 0b → 1,2,3,4,6,8 (parallel) → 5,7,9,11,12
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

### Phase 12: Quarterly Calculation Mode (Priority N)
**Why:** Monthly/quarterly granularity enables intra-year cash-flow events and L/G natively.

- [ ] Build monthly as optional "high-fidelity mode" toggle
- [ ] Validate monthly and annual agree on simple cases first
- [ ] Aggregate back up to yearly rows for readability
- [ ] Drill-down to monthly detail
- **Status:** pending

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

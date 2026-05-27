# Task Plan: Retirement Optimizer — Feature Implementation Roadmap

Goal: Implement remaining features from optimizer_directions.md priority list (items B through R), focused on core functionality gaps and Monte Carlo improvements.

## Current Phase
Phase 0 — Planning

## Phases

### Phase 0: Planning & Context
- [x] Read BootstrapPlan.md (Monte Carlo improvements)
- [x] Read optimizer_directions.md (feature priority list)
- [ ] Consolidate ideas into actionable phases
- [ ] Identify blockers and dependencies
- **Status:** in_progress

### Phase 1: Fix Bracket/IRMAA Strategy Logic (Priority B)
**Why:** Currently bracket acts as cap but spend overrides it, making strategies non-functional when desired spend > bracket room. Need to invert logic: bracket/IRMAA sets *maximum* IRA withdrawal.

**Approach:** Binary search all bracket options to find max feasible spend per bracket. Show constraints inline (no modals). User can override constraints; calculation shows impact.

- [ ] Review current calculateWithdrawals() logic
- [ ] Invert bracket/IRMAA constraint: bracket limits IRA withdrawal, not spend goal
- [ ] Shortfall draws from brokerage/cash first, then Roth
- [ ] Implement `calculateMaxSpendPerBracket(bracket, assets, income, years)` using binary search
- [ ] When spend goal changes, recalculate max spend for ALL bracket options (real-time)
- [ ] **UI:** Bracket selector shows each option: "Bracket 22% — max $85k"
- [ ] **UI:** Spend input field next to brackets
- [ ] **UI:** Below brackets, feedback line: "Bracket 22% allows up to $85k; you want $100k (gap: -$15k)"
- [ ] **UI:** Status indicator: Green checkmark if spend ≤ max; Yellow warning if over
- [ ] **UI:** Real-time updates as user changes bracket or spend
- [ ] Annual Details shows constraint violations (e.g., "Withdrew $50k but bracket allows $35k")
- [ ] Test with IRMAA scenarios; verify calculation respects constraint
- [ ] Test with spend > bracket; verify shortfall draws from brokerage/cash first, then Roth
- [ ] Test real-time feedback updates
- **Status:** pending
- **Blocks:** Better strategy comparisons, IRMAA work, ACA age-gating (Phase 9)

### Phase 2: Historical Bootstrap for Monte Carlo (BootstrapPlan Phase 1)
**Why:** Current GBM produces unrealistic single-year returns (60%+) and consecutive-loss runs (8+ years). Bootstrap captures true return distribution with realistic caps.

- [ ] Embed historical annual returns by asset class (S&P 1926–2024, bonds, intl)
- [ ] Implement bootstrapScenarioBank() in montecarlo/prng.js with block size=3
- [ ] Modify worker.js and mc_controller.js to accept simulationMode parameter
- [ ] Add mode toggle to nerd panel (GBM vs Historical Bootstrap)
- [ ] Test that bootstrap results are more realistic (no 60%+ years, no 8+ loss runs)
- **Status:** pending
- **Blocks:** Phase 3 (correlated asset classes)

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

- [ ] Embed historical real returns by asset class (US equity, bonds, intl)
- [ ] Add allocation grid per account (percentages sum to 100%)
- [ ] Weighted-average allocations to compute per-account expected return and σ
- [ ] Surface derived return so user can see/override
- **Status:** pending
- **Blocks:** Improved MC (Phase 2 + P), Variable Growth/Inflation (Phase 7)

### Phase 7: Correlated Multi-Asset MC (BootstrapPlan Phase 2)
**Why:** Single σ cannot model both 100% equity and 60/40 portfolios. Need stocks and bonds separately with correlation matrix.

- [ ] Implement Cholesky decomposition for correlated returns
- [ ] Modify mc_controller.js to accept per-account (r_stocks, r_bonds) pairs
- [ ] Recompute account returns as stockPct × r_stocks + bondPct × r_bonds
- [ ] Test correlation structure (negative correlation between stocks/bonds)
- **Status:** pending
- **Depends on:** Phase 6 (per-account asset mix)

### Phase 8: Variable Growth/Inflation Optimizer (Priority Q)
**Why:** Single-point estimates hide assumptions. Need sensitivity grid (multiple growth/inflation combos).

- [ ] Build Mode 1: Sensitivity grid (e.g., growth: 4%, 6%, 8%; inflation: 2%, 3%, 4%)
- [ ] Show which strategy ranks best under each combo
- [ ] Mode 2 (Monte Carlo integration) after Phase 2 complete
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
**Why:** Optimal plan may switch strategies mid-retirement (e.g., Bracket → Fixed % at age 72).

- [ ] Start with 2-phase combinations (strategy A for years 1–N, B for years N+1–end)
- [ ] Brute-force all permutations over phase breakpoints
- [ ] Extend to 3+ phases if performance allows
- [ ] Surface top N combos in optimizer table with "phases" column
- **Status:** pending
- **Depends on:** Phase 9 (clean ACA handling)

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
2. For Phase 2 (bootstrap), which years of historical data? Full history (1926+) or post-1970?
3. For Phase 6 (per-account asset mix), should allocation grids be per-account or global?
4. What is the user's order of implementation preference (v11 features in PR #48)?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Phase 1 before Phase 3 | Bracket fix unblocks correct strategy comparisons |
| Bootstrap Phase 2 before correlated multi-asset | Bootstrap is simpler, lower-risk drop-in; Phase 7 requires simulate() changes |
| Phases 2-4 before complex features | Core functionality (bootstrap, lumpy spend, QCDs) before multi-strategy or regime-switching |
| ACA limits age-gate at 65+ | Medicare replaces ACA at 65, making ACA subsidies irrelevant; disable strategy option for retirees 65+ |
| Phase 9 (ACA) before Phase 10 (multi-strategy) | Multi-strategy needs clean ACA handling to avoid invalid strategy combos |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- BootstrapPlan.md provides detailed implementation sketches for Phases 2, 7, 10
- optimizer_directions.md priority list shows items already DONE (K+D, A, F, L, G)
- PR #48 (v11 features) likely covers some of these items
- Check MEMORY.md for known TODOs: Roth1/Roth2 table columns, survivor SS bug

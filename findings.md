# Findings & Decisions

## Requirements (from optimizer_directions.md)

### High Priority (Next to implement)
- **B:** Fix bracket/IRMAA withdrawal logic (inverted constraint model)
- **H:** Lumpy spending table (one-time expenses per year)
- **A:** Fixed % IRA withdrawal strategy — DONE
- **I:** QCDs (Qualified Charitable Distributions)

### Medium Priority (After core fixes)
- **C:** Scenario comparison (summary table, chart overlay later)
- **P:** Per-account asset mix with historically-based growth rates
- **F:** Monte Carlo analysis — DONE (Session 6, basic GBM)
- **Q:** Variable growth/inflation optimizer (sensitivity grid Mode 1 first)

### Lower Priority (Complex, longer-term)
- **M:** Multi-strategy optimizer (mixed withdrawal methods, 2-phase then 3+)
- **L:** Tax payment optimization — DONE (RetirementTaxPlanner.html)
- **J:** 5-year actionable report — Not needed (L solved this)
- **N:** Quarterly calculation model (optional high-fidelity mode)
- **E:** Tax Analyzer click-through (scope URL format first)
- **G:** Roth conversion timing — DONE (RetirementTaxPlanner.html)

## Research Findings (BootstrapPlan.md)

### Current MC Simulation Limitations
- **Single σ implicitly blends portfolio** — can't separate equity/bond risk
- **Unrealistic returns:** 60%+ single-year returns (historical max ~54%, 1954)
- **Pathological loss runs:** 8+ consecutive losing years (historical max 4, 1929–1932)
- **No serial correlation:** Each year is i.i.d., missing momentum/mean reversion

### Historical Bootstrap Solution (Phase 1)
| Mode | Mechanism | Pros | Cons |
|------|-----------|------|------|
| Simple | Sample one year at a time | Easy, unbiased | Breaks multi-year trends |
| **Block (recommended)** | Draw overlapping 3-year blocks | Preserves serial structure | Slightly more complex |

**Implementation:** ~99 historical S&P returns (1926–2024), ~49 for bonds/intl. Embed as JS constant in `historical_returns.js`.

### Correlated Multi-Asset (Phase 2)
- Use Cholesky decomposition of 2×2 correlation matrix
- Derive per-account return = `stockPct × r_stocks + bondPct × r_bonds`
- Historical parameters: US Equity μ=11% σ=17%, US Bonds μ=5% σ=7%, corr ≈ −0.10 to +0.10

### Regime-Switching Model (Phase 3)
- 2-state Markov: Bull (μ=+14%, σ=11%, P(stay)=0.85), Bear (μ=−8%, σ=22%, P(stay)=0.65)
- Captures market persistence without historical data
- More transparent than bootstrap; easily parameterizable

### Files to Change (BootstrapPlan)
| File | Phase | Change |
|------|-------|--------|
| `montecarlo/prng.js` | 1 | Add `bootstrapScenarioBank()` function |
| `montecarlo/worker.js` | 1,2 | Accept `simulationMode`; call bootstrap or GBM path |
| `montecarlo/mc_controller.js` | 1,2 | Same fallback path |
| `montecarlo/mc_tab.js` | 1 | Add mode toggle to nerd panel |
| `retirement_optimizer_core.js` | 2 | Add per-account `stockPct` inputs |
| `retirement_optimizer.html` | 2 | Asset allocation inputs per account |
| `montecarlo/historical_returns.js` | 1 | New: embed annual return arrays by asset class |

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Bootstrap before correlated multi-asset | Lower risk drop-in, faster to deliver; Phase 7 requires simulate() changes |
| Block bootstrap size=3 | Captures short-term momentum without over-fitting historical sequences |
| Bracket/IRMAA fix first | Unblocks all strategy comparisons; currently strategies break when spend > bracket |
| Binary search all brackets per spend goal (Phase 1) | Finds max feasible spend for each bracket option; greying infeasible options guides user choice |
| Per-account asset mix (P) before multi-asset MC (Phase 7) | P feeds the σ values needed for Phase 7 |
| Mode 1 sensitivity grid before MC integration (Q) | Self-contained, high-value; Mode 2 depends on Phase 2 complete |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| MC simulation unrealistic | Bootstrap Phase 2 solves single-year return caps; Phase 7 solves correlated risk |
| Can't model different allocations per account | P (per-account asset mix) + Phase 7 (correlated returns) solves this |
| Bracket strategies don't work when spend > bracket | Phase 1: Invert constraint logic + binary search shows user max feasible spend per bracket |
| User doesn't know what spend is achievable with a given bracket | Phase 1: `calculateMaxSpendPerBracket()` + UI feedback shows feasible spend; user can adopt it |
| No way to model one-time expenses | Phase 3 (lumpy spending table) solves this |

## Phase 21: BETR Research Notes

**Vanguard formula status:** Not publicly published. Tool at advisors.vanguard.com is advisor-facing black box. No white paper found as of plan date.

**Best public source:** Michael Kitces — [Roth Conversion Analysis: The True Marginal Tax Rate Equivalency Principle](https://www.kitces.com/blog/roth-conversion-analysis-value-calculate-timing-true-marginal-tax-rate-equivalency-principle/). Standard formula:
```
BETR = 1 − t_now × (1 + r_taxable)^n / (1 + r_ira)^n
```
When `r_taxable = r_ira`: BETR = t_now (trivial). Taxable drag (`r_taxable < r_ira`) lowers BETR below current rate — makes conversion advantageous at a lower future rate than intuition suggests.

**Vanguard additions (inferred from tool behavior):** RMD drag (forced IRA distributions compound taxably vs Roth growing tax-free), heir/SECURE Act factor (10-year rule on inherited IRA vs no beneficiary RMDs for Roth), state tax differentials.

**Action before Phase 21 implementation:** Search for any Vanguard methodology paper published since this plan date. If none, implement Kitces standard formula; document the delta from Vanguard's tool.

## Phase 22: Guyton-Klinger Research Notes

**Primary sources:** Guyton (2004) "Decision Rules and Portfolio Management for Retirees: Is the 'Safe' Initial Withdrawal Rate Too Safe?", Guyton & Klinger (2006) "Decision Rules and Maximum Initial Withdrawal Rates". Both published in Journal of Financial Planning — accessible.

**Key finding from literature:** GK supports initial WR ~5.2–5.5% with ruin probability similar to 4% static rule, because guardrail adjustments absorb sequence-of-returns risk. The cuts in bad sequences prevent catastrophic depletion.

**Standard guardrail parameters from original paper:** ±20% from IWR triggers ±10% spending adjustment. These are defaults — make configurable.

**Rule ordering matters:** Apply Inflation Rule (skip/apply CPI) *before* guardrail checks. Guardrails check post-inflation-adjusted spend vs current portfolio.

## Resources

- **BootstrapPlan.md** — Detailed plan for MC improvements (Phases 1–3)
- **optimizer_directions.md** — Full feature brainstorm with priority order (A–R)
- **MEMORY.md** — Project state: PR #48 (v11 features), known TODOs: Roth1/Roth2 table columns, survivor SS bug
- **retirement_optimizer.html** — Main UI
- **retirement_optimizer_core.js** — Core simulation engine

## Phase 28: SoRR Research Notes

**Why bootstrap looks rosy:** 500 random paths from 97 years → ~16% of paths happen to start with a bad first-3yr block. The median and even p10 outcome are dominated by the ~84% of paths that started normally. The *tail* is visible in the chart but not front-of-mind. SoRR is specifically about early-retirement bad sequences; equal probability sampling dilutes this.

**Recommended SoRR mitigation (in priority order):**
1. **Bear-Start Mode** — force first block to worst-tercile (hardest directly tests SoRR; every path suffers the bad start). Most direct answer to "I don't see SoRR."
2. **Historical Scenarios** — 1966 (stagflation), 1929 (depression), 2000 (double crash). Deterministic, visually compelling, grounded.
3. **CAPE-adjusted GBM preset** — μ=5% reflects current valuation-based expected returns. More relevant for "what if the next 10 yrs disappoint" than historical bootstrap.

**SoRR magnitude (from literature):** Same 4% WR, 60/40 portfolio, 30yr retirement: 1966 starter runs out ~year 27. Average starter succeeds. Difference is purely sequencing. This is the story Bear-Start mode tells.

**CAPE background:** Shiller CAPE ~35 (2024–2025). Historically, CAPE > 25 predicts median 10yr real annualized equity return ~2–4%. Bootstrap uses 1928–2024 data with CAGR ~10.7% nominal. Gap is ~6–7%. Using bootstrap without CAPE adjustment may overstate expected returns by 2–3%/yr over next decade.

## Phase 29: Tax Policy Research Notes

**TCJA Status (updated 2026-06-08):** TCJA was made permanent in 2025 — no automatic sunset. Pre-TCJA rates are NOT the expected near-term scenario. However, Congress can still change rates; fiscal pressure (debt-to-GDP ~120%+) makes future increases plausible. Phase 29 models this as an opt-in hypothetical stress test, not a default assumption. Earliest realistic legislated rate change: 2027+.

**Pre-TCJA brackets (MFJ, 2017 levels, not inflation-adjusted):**
| Rate | Pre-TCJA | Post-TCJA (current) |
|------|----------|---------------------|
| 10%  | $0–$18,650 | $0–$23,200 |
| 15%→12% | $18,650–$75,900 | $23,200–$94,300 |
| 25%→22% | $75,900–$153,100 | $94,300–$201,050 |
| 28%→24% | $153,100–$233,350 | $201,050–$383,900 |
| 33%→32% | $233,350–$416,700 | $383,900–$487,450 |
| 35%  | same | same |
| 39.6%→37% | $416,700+ | $751,600+ |

Note: for implementation, use current inflation-adjusted thresholds but with pre-TCJA *rates* applied (the key change is the rate steps, not the threshold amounts).

**Long-term fiscal pressure:** CBO projects debt-to-GDP reaching ~180% by 2054 under current law. Historical pattern: major revenue increases have come from rate changes (WWII, Korean War). A 0.5%/yr escalation over 20 years puts a 22% rate at ~24.4% — plausible but uncertain. Default escalation = 0 (off). Users who worry about this can toggle it on.

## Open Questions

1. **Data years for bootstrap:** Use full history (1926–present) or post-1970 (more relevant)?
2. **Block bootstrap:** Overlap or non-overlap blocks? Overlapping gives more coverage.
3. **Default mode preference:** Bootstrap (more realistic, no tuning) or GBM (faster, transparent) in non-nerd mode?
4. **Asset classes:** Just stocks/bonds, or include international as 3rd class? (MSCI EAFE only post-1970)
5. **v11 features in PR #48:** Which of these priorities are already addressed?
6. **Roth1/Roth2 table columns TODO:** What are these? Check Annual Details implementation.
7. **Survivor SS bug:** What's the issue? Test with spouse scenarios.

## Phase 1 UI Approach: Inline Bracket Feedback (No Modals)

**Design:** Show bracket constraints inline with spend input. User can override; system shows impact.

**Layout:**
```
Bracket:  ◉ Bracket 22% — max $85k
          ○ Bracket 24% — max $72k
          ○ Bracket 32% — max $100k

Spend Goal: [100,000]

Feedback:  Bracket 22% allows up to $85k; you want $100k (gap: -$15k)
           Status: ⚠ Warning (over-spend)
```

**Real-time updates:**
- When user changes spend, recalc max for all brackets, update feedback
- When user picks bracket, show max spend for that bracket
- Status indicator: Green ✓ (feasible), Yellow ⚠ (over-spend but allowed)

**Annual Details impact:**
- Show constraint violations per year: "IRA withdrawal $50k exceeds bracket limit $35k"
- User sees downstream impact in results; can adjust if desired

**Advantage:** No blocking flow, transparent constraints, user agency. Spend or bracket change immediately updates feedback.

## ACA Limit Strategy Constraint

**New finding:** ACA subsidies only apply pre-Medicare (before age 65). At age 65+, Medicare covers health insurance, making ACA limits irrelevant.

**UI Impact:**
- Hide ACA limit strategy option when *both* spouses age 65+
- When mixed ages (one 65+, one younger), handle case-by-case or disable ACA limits
- Don't force ACA limits into multi-strategy optimizer combos for 65+ retirees

**Implementation:**
- Phase 9 (new): Age-gate ACA logic, disable UI option at 65+
- Prerequisite: Phase 1 (bracket fix, withdrawal logic)
- Blocker for: Phase 10 (multi-strategy must skip invalid ACA combos for 65+)

## Visual/Browser Findings
- None yet (no exploration phase done)

---
*Update this file after every 2 view/browser/search operations*

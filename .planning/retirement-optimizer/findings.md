# Findings & Decisions

## PF10 Research Notes: Roth conversion mechanics + cash funding (2026-07-16)

**The two conversion mechanisms are structurally different, and conflating them produces wrong designs.** This cost a full discarded design pass, so it's worth stating precisely:
- `routeSurplusAndConvert()`'s `conv1`/`conv2` (the flag formerly named `maxConversion`, now `convertExcessToRoth`) is a **pure reallocation**. The IRA money is already being withdrawn by the spending strategy, its tax is already fully inside `yr.totalTax` regardless of destination, and `yr.surplus.Total` is already an after-tax figure. `conv1`/`conv2` only decides Cash-vs-Roth for the leftover. **Nothing is netted out for tax, so there is no gross/net haircut here and nothing for cash-funding to "cover."**
- `applyExtraConversion()` (the `extraConversionAmount` field) is a **genuinely new withdrawal**. It pulls gross from the IRA that the strategy did not ask for, computes that slice's true marginal tax via its own `calculateTaxes()` call, and credits `gross - tax` to Roth. This is the real gross/net haircut a user sees ($20,000 entered → ~$13,700 landed at a 31% marginal rate).
- **The stale "TAX GAP" comment (`routeSurplusAndConvert`, pre-PF10) misled a planning agent into treating the first as if it were the second.** The comment described a conversion-sizing approximation, not money evaporating to tax. Rewritten in PF10 to say plainly that the path is a reallocation. If you find yourself about to apply gross-up math to `conv1`/`conv2`, stop: trace whether a tax is actually being subtracted first.

**The gross-up formula (user-supplied, verified against the live engine to the dollar).** To make the reallocation path *also* deliver more to Roth, `applyConversionGrossUp()` pulls an ADDITIONAL gross `increase = conversion × t/(1-t)` from the IRA, funds that increment's own tax (`increase × t`) from Cash, and credits the full `increase` to Roth. `t` = the conv1+conv2 slice's true marginal rate. Algebraically `conversion + increase == conversion/(1-t)` (the flat-`t` gross-equivalent), confirmed exactly in-engine. Closed-form and single-shot -- no fixed-point iteration needed, unlike `cfRefundIRA`.

**Shadow-tax calcs come in two directions, and picking the wrong one silently corrupts the result.** Both appear in `optimizer_core.js`:
- **Additive** (`applyExtraConversion`): the slice is NOT yet in `yr.totalTax`, so compute `tax(base + slice) - yr.totalTax`.
- **Subtractive** (`cfRefundIRA`, `attributeIncrementalTaxes`, `applyConversionGrossUp`): the slice IS already inside `yr.totalTax` (it's part of `netWithdrawals.IRA`), so remove it and measure the drop: `yr.totalTax - tax(base - slice)`.
Using the additive shape where the subtractive one belongs compares a baseline that already contains the slice's tax against a shadow that doesn't. **Check which side of `yr.totalTax` your slice is on before copying a nearby `calculateTaxes()` call.**

**Any mechanism that mutates `yr.totalTax` must also publish the income that caused it (`yr._extraIRAIncome`).** A real bug (found only by driving the browser, missed by two planning passes): `applyConversionGrossUp` does `yr.totalTax += taxCost` but its `increase` is applied straight to `balance.IRA1/2` and never enters `yr.netWithdrawals.IRA`. `applyExtraConversion`, running after, isolates its own marginal tax by subtracting `yr.totalTax` -- so it subtracted a baseline containing the gross-up's tax from a shadow calc whose income basis excluded the gross-up's income. Understated itself by ~43% ($3,635 vs. the correct $6,346). Fixed with a shared `yr._extraIRAIncome` accumulator that both mechanisms add to and later consumers include in their basis. **General rule for this engine: `yr.totalTax` and the income basis used to derive it must move together, and phase order determines who has to account for whom.**

**Optimizer row fields must record EFFECTIVE `inputs`, never raw `overrides`.** Two separate instances of this bug class now (PF8 Issue 1, PF10 round-2). `addResult()` does `inputs = Object.assign({}, base, overrides)` -- any flag not explicitly overridden is inherited from the sidebar. Recording `overrides.someFlag` therefore reports `undefined`/`false` for a row whose simulation actually ran with the sidebar's `true`, and `loadOptimizerResult()` then restores a plan that differs from the row the table displayed. **Record `inputs.someFlag`.** Same applies to any label glyph derived from a flag (the ✓ marker had it too).

**Cost intuition is unreliable here; measure before assuming a path is too expensive.** `diagnoseConvBreakEvenFailure` looked like an obvious "on-demand only" candidate (up to k `simulate()` calls, each with an internal counterfactual). Measured worst case (k=25 conversion years, no early exit): **43ms, versus 53ms for one plain `runSimulation()`** -- the truncated runs suppress most conversion work and are individually much cheaper than the full run. It now computes eagerly in `updateStats()`. Conversely `buildVariations()`'s 💵 expansion IS worth gating (`base.Cash > 0`), because Monte Carlo multiplies it by `numPaths` (500 default → ~18,000 extra `simulate()` calls).

**Case-sensitive tooltip lookup silently kills tooltips.** `optimizer_ui.js`'s header tooltip map is keyed by the literal log-record key and looked up as `if (tooltips[key])` -- a case mismatch fails silently, no error, column just has no tooltip. Found `'RothConv'` vs `'rothConv'`; **an audit script comparing the tooltip map's keys against `buildSimYearLogRecord`'s keys immediately found a second one (`'RothG'` vs `'rothG'`)**. Cheap to re-run whenever a log key is added or renamed; both are fixed and the audit now reports zero orphans.

**Moving a control out of `.sidebar` breaks Share silently.** `captureDefaults()`/`buildShareURL()` iterate `.sidebar input, .sidebar select`, but `loadFromURL()` resolves by element id and doesn't care where the element lives. So relocating a URL-shareable control (`optimizeSpend`/`includeConvOpt`, short codes `opt`/`copt`) out of the sidebar makes Share stop EMITTING it while still RESTORING it -- an asymmetric round-trip with no error. Fixed via `SHARE_INPUT_SELECTOR` (sidebar + `#opt-search-options`) plus `data-no-share` for genuinely derived controls. **Check both selectors any time a shareable input moves.** Corollary: flipping a checkbox's markup default (Optimize Conversions → `checked`) inverts which state gets omitted from the URL; verify the non-default state still emits (`copt=0`), or shared links silently re-enable it.

## PF8 Research Notes: Optimizer/single-scenario Break Even discrepancies (2026-07-13)

**`extraConversionAmount` is structurally invisible outside the sweep machinery.** This engine field (flat annual $ IRA-to-Roth conversion) is read by `applyExtraConversion()`/`optimizeConversionAmount()` and set by the Optimizer's Phase-23 sweep and Monte Carlo's baseline pass -- but has zero presence in `retirement_optimizer.html` (no input), `getInputs()` (not read), or `OPT_LONG_TO_SHORT` (not URL-shareable). Any UI path that shows a result computed WITH this field (e.g. the Optimizer's ⇌ rows) but then lets the user "load"/reproduce that result elsewhere silently drops it, since there's nowhere for it to land. Worth checking for this same class of gap if other engine-only fields ever get surfaced in optimizer-only computed values.

**`sim.nominalTaxRate` is a discrete bracket-table step function, not continuous.** It's the `nr` field from `taxengine.js`'s bracket tables (via `calculateProgressive()`/`findUpperLimitByAmount()`), looked up fresh each year based on whichever bracket that year's top marginal dollar falls into. Used to discount an ENTIRE remaining IRA balance in `totalWealth`/`convOC` valuation. Because it's a step function, two simulate() runs with slightly different income trajectories (e.g. an actual run vs. its conversion-suppressed counterfactual) can cross the same bracket boundary in different years, producing a one-year valuation "jump" in their relative comparison that has nothing to do with that specific year's dollar amounts -- pure timing-mismatch noise. This was originally described here as "the same underlying gap" as the pre-existing "TAX GAP" comment in `routeSurplusAndConvert` -- **PF10 disproved that and the comment is now gone** (that path is a pure reallocation with no tax netted out of it; see the PF10 notes above). The step-function noise described in this paragraph is real and independent of that comment. PF6's sustained-crossing Break Even definition already absorbs/suppresses this noise at the stat level (a lone blip surrounded by negative years correctly reports "never breaks even") -- but the per-year convOC column itself can still show this noise, which is fine/expected once understood, not a bug.

**`_convSavings` (realized lifetime tax $ saved) and `convOC`/`convBEYear` (after-tax wealth, deferred-tax-aware) are different metrics that can disagree.** `_convSavings` only sums `totals.tax` actually paid during the simulated horizon; it never reserves for tax still owed on whatever IRA balance a counterfactual/lesser-conversion plan has left standing. `totalWealth`/`convOC` explicitly discount remaining IRA balance by the applicable tax rate every year, so they're the more complete "did this actually pay off" answer. A strategy can look great on Conv Savings while never reaching Break Even. General pattern to watch for in this codebase: any metric summing `totals.tax` alone (realized-only) vs. any metric built from `totalWealth` (after-tax, deferred-liability-aware) are not directly comparable and can point opposite directions.

**Top-N-by-finalNW selection pools are orthogonal to conversion-specific outcomes.** The Optimizer's Phase-23 "top 5 successful strategies" is chosen by each family's BASE (non-extra-conversion) finalNW -- a criterion unrelated to whether THAT family's conversions specifically would break even. A lower-finalNW family could be the true best converter and never get evaluated for it. Relevant if extending Break Even search to a smarter/broader pool later (see task_plan.md Phase PF8 issue 3 tiers).
> **Confirmed empirically 2026-07-16 (PF10), now tracked as PF11.** No longer hypothetical. On a $2M-IRA/$90k-spend scenario the top-5 were all cyclic `fixedpct` rows whose sweep correctly returns `optConv: 0` (extra conversion strictly hurts them: $9,266,756 at $0 → $8,635,273 at $150k), while `propwd` at rank **6** returns **$125,000** and never gets considered. Result: zero ⇌ rows for a plan that genuinely has a good conversion answer. PF10 defaulted Optimize Conversions ON, so this now fires for everyone rather than only for users who opted in.

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

## PF11 + PF13 Findings: conversion candidate pool + optimizer ranking (2026-07-20)

**Ranking by ending wealth is orthogonal to "who benefits from converting."** The Optimize Conversions candidate pool was `results.filter(success).sort(finalNW desc).slice(0,5)`. Measured on a $2M-IRA/$90k-spend scenario, all five slots went to cyclic `fixedpct` rows that correctly return `optConv: 0` (extra conversion strictly hurts them), while `propwd` at rank 6 returns a real conversion and was never considered. **A flat top-N over a homogeneous metric lets one strategy family monopolize every seat.** Fix: pick the best row per FAMILY (`selectConversionCandidates`), which guarantees structural diversity instead of hoping a scalar surfaces it.

**`finalNW` is not comparable across plans and must not be used to rank them.** `finalNW` = terminal `totalWealth`, which discounts each run's remaining IRA at *that run's own* `sim.nominalTaxRate`. Two plans are therefore valued with two different tax rates, and it ignores spendable entirely (the hoarding bias v11.1098 already removed from baseline ranking). Anything comparing plans must use a SHARED rate: `afterTaxNetWorth(terminal, sharedRate, capGainsRate)`. PF11 moved the conversion sweep's own objective onto `_baselineScore` for the same reason. **Rule: a per-run rate belongs inside a run, never in a cross-run comparison.**

**Family keys need more than `_strategy`.** IRMAA Ceil rows carry `strategy:'bracket'` with `stratIRMAATier` 0-4, while Fill Bracket carries `strategy:'bracket'` with tier -1. Keying a family map on `_strategy` alone silently merges two sweeps that answer different questions and drops one. Cyclic must also be its own dimension, since the observed failure was exactly cyclic rows crowding out the non-cyclic champion of the *same* strategy.

**Equality objectives need a wealth floor or they reward poverty.** "Tax Flexibility" (equal after-tax buckets) is degenerate on its own: a plan that drains every bucket to near-zero is perfectly "equal" and would win. Implemented as two-stage instead: take plans within 10% of the best after-tax net worth, then rank those by smallest bucket spread `(max-min)/total`. The cutoff `maxNW - 0.10*|maxNW|` (not `maxNW*0.9`) is required so a negative maxNW still produces a cutoff BELOW it. **General: any "minimize dispersion" metric needs a quality gate, since dispersion is trivially minimized at zero.**

**Two separate `⚠️` mechanisms on ACA rows produced a contradictory display.** One was a hardcoded literal in the 400%-FPL parameter label string; the other the dynamic `_isACAUntenable` flag. Because the dynamic flag scales with the FPL cap (lower multiples breach MORE) and untenable rows are hidden by default, the ONE visible ACA row was the dynamically-feasible 400% row wearing a static warning, while the genuinely-untenable rows were invisible. **When a status glyph can come from two sources, one static and one computed, the static one will eventually contradict the computed one.** Fixed by deleting the static literal and adding the missing semantic check (`eitherOnMedicareAtStart`): once one spouse is on Medicare their RMDs/SS push household MAGI past any FPL cap, so every ACA row is untenable, not just some.

**Sorting and ranking were two different orders shown at once.** The objective drove the ⚓ baseline pick and the Rank column, but the table body stayed sorted on `afterTaxNW` regardless — so Rank numbers appeared shuffled down the page. Unified with a `sortState.colKey === '__objective__'` sentinel: the default body order IS the objective order, and a column-header click is an explicit user override that the next objective change resets. **If you render a rank number, the default row order must be that rank, or the UI is telling two stories.**

**GOTCHAS (both cost real time):**
- Driving inputs from the console requires `DisplayHelpers.setDollarValue(id, v)`. `val()` reads `el.dataset.numVal`, not `el.value`, so a raw `.value =` assignment — even with `input`/`change` events dispatched — is silently ignored by `getInputs()`.
- `el.style.display = ''` does not mean "visible", it means "remove the inline value and fall back to the stylesheet." For an element whose layout came from an inline `display:flex`, that silently downgrades it to `block`. Set the literal (`'flex'`) when un-gating something that was inline-styled.

**A "filter the winners" fix is incomplete if a second code path also nominates rows.** PF13 item 2 filtered the per-metric winner pool (`feasibleSuccesses`) so an infeasible row could not win a metric. But the "Best" summary has a SECOND source: the ⚓ baseline row, chosen by `recomputeBaselineForObjective`, which had no feasibility filter at all. An infeasible `Fill Bracket (no conv) ⚠️` was still being pinned on top of the table and listed in the Best summary. Caught only by looking at a screenshot, after the programmatic check ("does the winner pool exclude infeasible rows?") had already passed. **When auditing "X should never appear in Y", enumerate every writer into Y, not just the one the bug report named.** The fix prefers feasible rows but falls back to the unfiltered set when every candidate is infeasible, so the Δ columns still have a reference.

## The Break Even diagnostic names a year that is actually ACTIONABLE, not just explanatory (2026-07-21, v11.12fd)

**Scenario** (user-supplied, reproduced and verified in the browser):
`?sg=220k&sc=-1.000&str=bracket&ny=4&sr=IRMAA2&pw=20.000&iwp=5.000&gkg=20.000&gka=10.000&mc=1&fcc=1&eca=33k&ibg=851132&d1=91&i1=3.3m&i2=240k&ro=240k&bk=1m&bb=2e5&dr=1&c1r=65&c2r=65&cbr=100&ca=1e5&cr=25k&ss1=60k&ss2=29k&psa=65&sfp=100.000&g=8.500&div=1.390&inf=4.200&cpi=2.800&cy=3.000&fitr=33.000`

Break Even shows `—`; the ⓘ diagnosis reads, verbatim:
> "Conversions through 2043 would have broken even in 2051. The 2044 conversion ($64,879) is the one that erases the lead for good."

`diagnoseConvBreakEvenFailure` returns `{outcome:'boundary', breakingYear:2044, breakingAmount:64879.09, lastSustainableYear:2043, lastSustainableBEYear:2051, futureIRATaxRateUnset:false}`. Plan runs 2026-2051, 26 conversion years, $1,858,960 converted in total.

**The finding: truncating conversions at exactly the year the diagnostic names produces the best plan of every variant tested.** Measured with `afterTaxNetWorth(terminal, 0.33, capGainsRate)` — a shared heirs rate, so the four are comparable:

| variant | after-tax NW | lifetime tax | converted | end IRA | Break Even |
|---|---|---|---|---|---|
| stop after 2043 (`_cfSuppressConversionsFromYear: 18`) | **$23,192,547** | **$3,367,165** | $1,414,421 | $3.26M | **2051** |
| no conversions at all | $23,161,241 | $4,788,561 | $0 | $9.42M | — |
| no EXTRA conversions (`eca=0`, strategy's own bracket-fill only) | $22,884,593 | $3,482,440 | $1,372,988 | $4.60M | — |
| the plan as configured (all 26 years) | $22,809,307 | $3,601,204 | $1,858,960 | $1.99M | — |

Spend is identical ($8,668,149) across all four, so this is a clean wealth/tax comparison.

Three things follow:

1. **The configured plan is over-converting past the point of harm.** Converting everything is $352k WORSE than converting nothing. Break Even showing `—` was not a display quirk or a strict-rule artifact; it was correctly reporting a real loss.
2. **The diagnostic's boundary year is a decision boundary, not just an explanation.** Stopping there beats the current plan by $383k, beats no-conversions by $31k, and pays the lowest lifetime tax of all four. That is a stronger claim than the feature was built to make — it was built to answer "why is Break Even blank," and it turns out to also answer "where should I stop."
3. **There is no user-facing way to act on it.** The truncation above was done with `_cfSuppressConversionsFromYear`, an internal counterfactual flag. A user reading the diagnosis has no input that says "stop converting after year X" — the closest lever is `extraConversionAmount`, and zeroing it (`noExtra`) is a *worse* plan than stopping at 2043, because it also throws away the good early conversions. **The right knob is a conversion END YEAR, not a smaller amount.**

**Caveats, both load-bearing before generalizing:**
- `lastSustainableBEYear` (2051) is the FINAL year of this plan. Even the winning truncation only breaks even on the last year, so the margin is thin and sensitive to `die1`/growth. A scenario whose best truncation breaks even mid-plan would be a much stronger case; this one is near the edge.
- n=1. This is one scenario with an aggressive 8.5% growth rate and a 33% heirs rate. The mechanism (late conversions convert at a rate at or above the heirs rate, so they subtract) is general, but the size of the effect is not established.

**Follow-up:** see Phase P24 in `task_plan.md`.

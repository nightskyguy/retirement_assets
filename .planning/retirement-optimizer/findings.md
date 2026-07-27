# Findings & Decisions

## "Optimize Conversions found nothing" on the default scenario is correct, and why (2026-07-26, v11.1370)

Investigated the complaint that the Optimizer reports "examined the best 12 strategies and found none where converting more improves the result" on stock default inputs. **The feature is answering correctly.** Everything below was measured against the real engine, not reasoned from the code.

**The pool is fine — PF11's fix holds.** 10 of the 12 selected candidates carry $700k-$1.3M of terminal IRA (gk, fixedpct, ordered, bracket, propwd; only the two `fixed` rows drain to zero). The pool is not selecting away from convertible plans, and running `optimizeConversionAmount` directly on the IRA-heavy rows returns `optConv: 0` on its own. There is no candidate-selection bug here.

**The real lever is the assumed future/heirs rate, and it was invisible.** On a candidate holding $1.29M of terminal IRA: rate 24% → $0; 32% → $0; **40% → $250k converted, +$42,355**; 50% → +$105,620; 65% → +$200,516. The default scenario assumes ~24-30%, which sits below the threshold, so "don't convert" is the honest answer at the user's own assumption. This is what `breakEvenHeirsRate` / `lowestBreakEvenHeirsRate` now surface.

**Conv Savings is actively misleading here, exactly like BETR.** At defaults, conversions cut lifetime tax from $642,042 to $445,062 — a $197k "saving" — while the plan's after-tax score falls from $4,230,494 to $4,084,898. A user reading that column alone would convert and end up worse off. Renamed to `Tax Paid Δ` with a tooltip that leads with the limitation.

**The apparent "conversions help at lower spend" result is a cash-drag artifact, not tax arbitrage.** At spend $100k with Cash Reserve OFF the sweep finds +$20,539. The same scenario with `CashReserve: 0` + DRIP (the recommended settings) finds **$0**. This is the P2 surplus-routing confound resurfacing: with the reserve off, surplus idles at the 3% cash yield, so anything that moves money out of that drag looks like a conversion win. Always control for the reserve setting before concluding a conversion pays.

**Search-shape gap, now fixed.** `optimizeConversionAmount` only ever tested a flat amount applied for the whole plan, so "convert hard for a few years, then stop" was inexpressible and such plans could only be told to convert nothing. `bestTimeLimitedConversion` adds that shape. Measured rescues on candidates the flat sweep left empty: **10 of 12 on a $3.3M-IRA scenario, 5 at a 45% future rate, 5 at 9% growth, 2 at low spend, and 0 on the default scenario** — where nothing to find is, again, the true answer.

### Two traps this work fell into, both caught only by cross-validating against brute force

1. **A coarse probe grid silently invents wrong answers.** The first `breakEvenHeirsRate` used 8 evenly-spaced conversion amounts across the IRA instead of the real $25k sweep. It reported "never pays up to 75%" for the default scenario (true answer: 48%) and overstated the low-spend threshold as 25% (true: 15%). The paying amounts are small relative to the IRA (~16%), so an even grid steps straight over them. Both errors pushed the reported rate *up*, which would talk a user out of a conversion that does pay. The fix was to use the same $25k grid as the sweep, exiting on the first improvement.
2. **"No IRA left at the end" does NOT mean "no conversion opportunity."** A filter skipping drained-IRA candidates looked obviously safe and lost the right answer on a $3.3M scenario (reported 25% against a true 5%). A plan that spends its IRA down still gains from converting *earlier*, because that moves growth into the Roth — it is not only about a terminal tax bill.

Neither was visible from reading the code or from a green test run; both surfaced only by scoring the fast path against an exhaustive scan on the same fixtures. **Anything that replaces a full sweep with a heuristic grid must be diffed against the sweep it replaces, on several scenarios, before it is trusted.**

### Latent engine inconsistency worth a separate look (not fixed here)

A per-year `extraConversionAmount` **array** of `[amount × N years, then 0]` and the equivalent scalar `extraConversionAmount` + `convEndYear` + `convEndMode:'extra'` produce **identical per-year conversion dollars but different simulations**. Measured on the default scenario at $87,500 for 5 years: opening-year `RMDwd` 16,620.92 (array) vs 15,771.24 (scalar+stop-year), diverging from log row 0, with `finalNW` 679,867 vs 639,182. The array path also reported time-limited conversion "gains" that vanish under the scalar form, so those gains appear to be an artifact of that path rather than real opportunities.

`bestTimeLimitedConversion` sidesteps this by scoring the **loadable** representation (scalar + `convEndYear`), so a ⇌ row and the plan a user gets when they click it are the same plan by construction — the PF8 failure mode. But the divergence itself is unexplained and one of the two paths is presumably wrong. Worth root-causing on its own.

### Rate-axis monotonicity (the binary search precondition)

`breakEvenHeirsRate` binary-searches the rate axis, which is only valid because "conversions pay" never switches back off as the assumed rate rises. Measured at 2.5pp steps across default / low-spend / large-IRA / reserve-on / high-growth: monotonic in all five. This is **measured, not assumed** — `nominalTaxRate` is a bracket step function, the same hazard that forced `bestConversionStopYear` to scan linearly. A test pins the property so a future change can't break the search silently.

## Analytics reads `document.title` before any body script runs — don't JS-derive `<title>` (2026-07-25, v11.1340)

**The bug:** deriving `<title>` from the changelog's first entry via a `<script>` placed near the changelog (deep in `<body>`) silently broke Google Analytics pageview tagging. `retirement_optimizer.html`'s `gtag('config', 'G-...')` call sits in a `<script>` in `<head>`, lines 4-9, and fires essentially immediately as the page parses — the automatic `page_view` hit captures `document.title` at that moment, which is whatever the static `<title>` tag says at parse time. A body script that rewrites `document.title` later (however early in body order) runs after GA has already queued/sent the hit, so every pageview gets logged under the un-updated title. This is not a race that resolves itself; the ordering is structural (head parses and executes before body).

**Caught by the user from the GA dashboard, not from anything visible on the page itself.** The page looked and worked correctly; there was no console error, no visual glitch, nothing a browser-based verification pass would catch. This is a class of regression that only shows up in an external system days later.

**Fix / rule:** if a value needs to be correct in an analytics/head-level context, it must be **static HTML present at parse time**, not JS-computed, no matter how early in `<body>` the script runs. Anything that wants to avoid duplicating that value can read it back OUT of the static source at runtime (e.g., a UI stat reading `document.title` via regex) — that direction is safe, since by the time ANY body script runs, `<title>`'s static content is already fully available. The unsafe direction is head-level external systems (GA, `<meta>` scrapers, social-preview crawlers that only see the initial HTML) reading a value that a script would only set later.

**General lesson:** before consolidating a duplicated value into "derive it from one source via JS," check who else reads the ORIGINAL value and when. A value read by another `<head>`-level `<script>` (analytics, meta tags) needs to stay static; a value only read by other body-level JS or by a human looking at the rendered page is safe to derive at runtime instead.

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

## P24 evidence sweep: the Break Even boundary year is NOT the year to stop converting (2026-07-23, v11.12fd)

The previous entry recorded a single measured truncation (stop after 2043, the year the ⓘ
diagnostic names) and found it beat every other variant tried. It did, but only because the
right answer was never tried. Sweeping EVERY cutoff instead of the four hand-picked ones
overturns the conclusion.

Harness: `.test_harnesses/stopyear_harness.js` (browser console, research only,
not shipped). It re-runs the plan once per cutoff and scores each on
`afterTaxNetWorth(terminal, heirs, capGainsRate)` at a SHARED heirs rate. One 27-cutoff sweep of
a 26-year plan is ~46ms, so the whole scenario matrix below is a few seconds.

Same recorded scenario, reproduced exactly first (`atnw 22,809,307`, `spend 8,668,149`,
`conv 1,858,960`, `convBEYear null`).

### 1. The optimum is 2031, not 2043. The diagnostic is off by 12 years and $662k.

| stop after | after-tax NW | lifetime tax | Break Even | converted | end IRA |
|---|---|---|---|---|---|
| no conversions | $23.161M | $4.789M | -- | $0 | $9.42M |
| **2031 (the true optimum)** | **$23.855M** | $3.751M | **2046** | $585k | $6.59M |
| 2043 (the ⓘ boundary year) | $23.193M | $3.367M | 2051 | $1,414k | $3.26M |
| 2051 (as configured) | $22.809M | $3.601M | -- | $1,859k | $1.99M |

The curve rises to cut=6 then falls monotonically. Break Even at the true optimum lands on
2046, five years before plan end, which retires the "thin margin, breaks even only on the
final year" caveat from the previous entry: that caveat was an artifact of measuring the wrong
cutoff.

**Why the diagnostic cannot find this.** `diagnoseConvBreakEvenFailure` answers "which
conversion erases the lead for good," i.e. the LAST cutoff that still produces any Break Even
year at all. That is the right answer to the question it was built for and the wrong answer to
"where should I stop." Existence of a Break Even is a much weaker condition than maximum
after-tax wealth: every cutoff from 2026 through 2043 breaks even, and they differ by $662k.

### 2. Delivered spend is identical across every cutoff, in every scenario measured.

`spendRange` (max minus min total spend over all 27 cutoffs) is **$0** in all 18 scenarios
checked, and no truncation flipped `totals.success`. Truncating conversions is a pure
wealth/tax comparison with nothing else moving. That is what makes a stop-year search safe to
rank on after-tax NW alone.

### 3. Larger-and-shorter beats smaller-and-longer. The stop year is worth more than the amount.

Joint (Extra Conversion amount x stop year) grid, $0-$400k in $25k steps x every cutoff:

| policy | after-tax NW | amount | stop |
|---|---|---|---|
| A. plan as configured | $22.809M | $33k | none |
| B. best stop year, configured amount | $23.855M | $33k | 2031 |
| D. best amount, no stop (**what the ⇌ optimizer searches today**) | $23.192M | $50k | none |
| C. best amount AND stop year jointly | **$24.228M** | $200k | 2031 |

Stop-year alone (B-A, +$1.045M) is worth slightly MORE than amount alone (D-A, +$383k), and
the two are close to additive. C-D, the value the stop-year axis would add on top of today's
optimizer, is **+$1.036M** here and was positive in all 11 scenarios tested (+$228k to
+$1.887M, median ~$1.0M). Converting $200k/yr for six years then stopping beats every
amount-only plan, and beats converting nothing by $1.07M.

### 4. Stopping only the EXTRA conversion (what a user would expect the knob to do) is much worse.

Mode `'extra'` keeps the strategy's own bracket-fill running to plan end and caps only
`extraConversionAmount`. Best result over the same amount grid: **$23.465M**, versus $24.228M
for stopping all conversion activity. And `convBEYear` is **null at every cutoff and every
amount** in extra-only mode. The conversions doing the damage in the late years are the
strategy's own bracket-fill, not the Extra. A stop-year control wired to the Extra only would
look like it was working and would leave most of the money on the table.

No engine change was needed to measure this: `extraConversionAmount` already accepts a per-year
ARRAY, so extra-only truncation is a zero tail.

### 5. Generality: stopping early never hurt, but the size of the win varies enormously.

23 scenarios across growth 3-12%, `die1` 80-100, spend $120k-$400k, IRA $0.8M-$8M, states
CA/TX/NY/PA, heirs rate 0-50%.

- **`gainVsFull` (best cutoff vs converting to the end) was >= 0 in every single scenario.**
  Never negative. Range $0 to $2.97M.
- **In 7 of 23, the best cutoff is "convert nothing at all"**: growth <= 3%, `die1` 80, spend
  $300k, IRA1 $0.8M and $1.5M. Low growth, short horizon, or a small IRA means conversions
  never pay, and the sweep says so cleanly.
- **The payoff scales hard with growth and longevity.** vs-never-converting: $0 at 3% growth,
  $37k at 6%, $693k at 8.5%, $1.32M at 10%, $2.97M at 12%. And $0 at die 80, $218k at die 88,
  $2.11M at die 95, $5.86M at die 100.
- **The diagnostic's boundary year never equaled the optimum in any scenario.** In 10 of 23 the
  diagnostic does not fire at all (Break Even is non-null, so the ⓘ never appears) and yet
  stopping early still gained $99k to $2.97M. The actionable quantity exists independently of
  whether Break Even is blank.

### 6. No heuristic substitutes for the search. Four candidate rules all failed.

- **Marginal-rate crossing** ("stop when the conversion's marginal rate reaches the heirs
  rate"): the bracket-fill strategy pins the combined marginal rate at 33.3% (24% fed + 9.3%
  CA) in EVERY year of this plan. The rule cannot discriminate at all, yet the optimum is a
  sharp six years in. The real driver is paying conversion tax out of a portfolio compounding
  at 8.5%, not a rate comparison.
- **Portfolio-mix trigger** ("stop when the IRA falls below X% of the portfolio"): the IRA
  share at the optimal stop year ranges from 4% to 78% across scenarios. No usable threshold.
- **Age / RMD-onset rule**: age at stop clustered at 70-75 until birth year was varied, which
  exposed it as an artifact of the fixed 1960/1952 birth years. Sweeping birth year 1948-1968
  gives stop-minus-RMD-year offsets from -15 to +14.
- **Terminal-mix target** (the user's "is there an optimum pre-tax/taxable/tax-free ratio to
  drive toward?"): the taxable share at the optimum is fairly stable at 43-48% of after-tax NW
  in the mainstream cases, but pre-tax net ranges 3-71% and Roth 0-68%. Nothing tight enough to
  drive toward. The optimal MIX is an output of the search, not an input to it.

Conclusion: the stop year has to be searched per plan. That is the argument for building the
search rather than shipping a rule of thumb.

### 7. The search must stay a linear scan, and the peak can be sharp.

- **Not unimodal.** First-difference sign flips over the cutoff curve: 1 to 7 across scenarios
  (7 at growth 10%, 5 at Extra $200k). Bracket and IRMAA tables are step functions, so ternary
  or binary search converges on the wrong cutoff undetectably. Same reasoning
  `diagnoseConvBreakEvenFailure` already documents for its own linear scan. Cost is not the
  issue anyway: k+1 runs, ~46ms.
- **Precision matters most exactly where the win is smallest.** Fraction of the gain retained
  if the stop year is off by +/- N years: baseline keeps 94% at +/-1 and 48% at +/-5, but
  low-tax states, where the gain is only $99k-$113k, go NEGATIVE at +/-2 (TX: -10%) and +/-3
  (TX: -117%, PA: +1%). In those plans a mis-set stop year is worse than not stopping at all.
  Any UI that suggests a year must show the size of the win next to it.

**Follow-up:** Phase P24 in `task_plan.md`, rewritten against this evidence.

## Surplus routing (Cash Reserve, P2) is upstream of every conversion metric — it flips the verdict (2026-07-23, v11.1330)

Closing the BETR audit's Q2. The non-cyclic default banked ALL surplus (dominated by forced RMDs)
into Cash at `cashYield` (~3%). Phase P2 implements the dormant `CashReserve` input as a target cash
buffer: blank/negative = OFF (legacy, all-to-cash); 0 = reinvest all surplus to Brokerage; positive
$Y = keep $Y (today's dollars, inflated), reinvest the overflow, protect $Y on withdrawal
(breakable last resort). Re-running the harnesses with surplus reinvested overturns the conversion
conclusions the OFF default produced.

**BETR harness (`node .test_harnesses/betr_harness.js`), empirical break-even heirs rate t*:**

| scenario | reserve OFF | reserve 0 / 200k | code BETR |
|---|---|---|---|
| lump $500k, g6% | t* ≤0 (convert always), gain@0% +$581k | **t* 209%** (never convert), gain@0% **−$952k** | 24.6% |
| annual $80k, g8% | t* 6%, gain@0% −$144k | **t* 84%**, gain@0% **−$2.0M** | 29.6% |

**P24 stop-year search (`bestConversionStopYear`), same flip:**

| reserve | best stop | gain vs converting-to-end | gain vs never-converting |
|---|---|---|---|
| OFF | 2046 | +$100k | **+$914k (convert)** |
| 0 / 200k | none — **convert nothing is best** | +$1,698k | **+$0** |

Three conclusions:

1. **The cash-drag was the artifact.** With surplus left in 3% cash, the no-conversion world was
   starved of growth, making conversions look great (t* ≤0, P24 says convert). Reinvest that surplus
   at market and the no-conversion world compounds instead, and conversions LOSE at every plausible
   rate. The OFF default systematically biased Break Even, opportunity cost, BETR, and the P24
   stop-year all toward conversions.
2. **BETR is wrong in BOTH regimes, in opposite directions.** OFF: code BETR ~25% overstates the
   threshold (true ≤0) → understates benefit. ON: code BETR ~25-30% understates it (true 84-209%)
   → overstates benefit. The closed form ignores surplus routing AND the RMD/IRMAA/SS second-order
   cascade, which together dominate the simulator's actual outcome. The years-to-RMD horizon is a
   minor error either way. **BETR as shown is not a reliable signal**; the honest replacement is the
   empirical break-even t* computed from two full sims (what the harness does).
3. **`0` and a positive buffer often coincide in legacy plans** because the forced-RMD surplus dwarfs
   any few-hundred-k buffer, so nearly everything reinvests either way. The buffer only bites when
   surplus is comparable to it (modest-IRA plans).

Reserve OFF stays byte-identical to pre-P2 (regression-locked). The default is OFF, so existing
scenarios/URLs are unchanged until a user opts in; a load-time warning fires for any scenario/URL
that carries an active Cash Reserve.

# Progress Log

## Session: 2026-07-17 (worktree mystifying-babbage-559d99) — PF12: accurate IRA-withdrawal accounting + prefer-larger conversion sourcing (v11.129d)

User reported (URL with `eca=150k` + `fcc=1`): Annual Details showed a 150k Roth conversion in a year with $0 strategy IRA draw, and later years "converted more than was withdrawn." Empirically root-caused (browser, deployed v11.1287): engine math conserves (per-year IRA balance reconciles to $0 residual, conversion tax genuinely paid) — the defect was **incomplete per-account accounting**. `applyExtraConversion`/`applyConversionGrossUp` mutated only aggregates (`totalTax`, `balance.IRA`, `totalConverted`) and never the granular log fields, so (1) `IRAwd`/`IRA1-`/`IRA2-` omitted conversion pulls and (2) `FedTax`/`StateTax` omitted the conversion tax (added to `totalTax` only). Accuracy is load-bearing because clicking a year passes these to RetirementTaxPlanner.html for tax-payment planning.

Planned in plan mode across 4 clarifying rounds; the plan evolved from "display-only" to a real behavior change per the user: **conversions now source from the larger IRA** (spill to the smaller only when the larger can't cover). Scope landed on the additional pulls (extraConversion + gross-up) via a new `splitPreferLarger()` helper; `convertExcessToRoth` reallocation stays proportional (already ~larger-weighted; its attribution must match its proportional debit).

Implemented:
- **optimizer_core.js:** `splitPreferLarger()`; extra-conversion + gross-up now source prefer-larger and accumulate per-account `yr.iraConvGross1/2`; `routeSurplusAndConvert` sets `yr.iraVolSpend1/2` (spending draw) + seeds `iraConvGross` from conv1/conv2. `buildSimYearLogRecord`: `IRA1-/IRA2-` = voluntary total (spending + conversion gross, excl RMD), `IRAwd` = their sum, plus hidden `-iraVolSpend1/2`, `-iraConvGross1/2`, `-iraSpend`, `-iraConvGrossTot`. Fed/State attribution: extra conversion sets `yr.tax.federalTax/stateTax = _exTaxCalc.*` (exact); gross-up splits `taxCost` by marginal-rate proportion. `logYear` threads the new fields. **Only readers of `yr.tax.federalTax/stateTax` are the log record (714-715), so no simulation feedback — combined `totalTax` unchanged; only the IRA1-vs-IRA2 split (→ per-spouse RMDs → long-run totals) shifts.**
- **optimizer_ui.js:** `openTaxPlanner` passes true per-IRA voluntary (`-iraVolSpend*`) + conversion gross (`-iraConvGross*`), replacing the dump-onto-larger-balance hack and the imprecise `IRA1- − RMD1-`. Income-composition views (`visibleSum`, 'IRA WD' bar) switched from `max(0, IRAwd − rothConv)` to `-iraSpend`. **Inflows/Outflows ('flows') chart left as-is** — its 'IRA draw' bar already intends conversion-inclusive IRA draw and `_acctScale` keeps up=down balanced (verified up 429,200 = down −429,200); the deeper redesign the user flagged is deferred. Tooltips for `IRAwd`/`IRA1-`/`IRA2-`/`extraConv` updated.
- **retirement_optimizer.html:** changelog + version 11.1287→11.129d, both `optimizer_core.js`/`optimizer_ui.js` cache tokens → `?v=11129d`.
- **optimizer_core.test.js:** +4 tests (prefer-larger sourcing incl. spill; per-account identity + IRA balance reconciliation `IRA_end = prev + iraG − RMD − IRAwd`; conversion-gross conservation; Fed+State+IRMAA == totalTax for extra-conversion and gross-up-only years). All expected values empirically derived from the real engine first.

Verify: node **77/77**. Browser (local server, user's exact URL): year 2026 `IRAwd` 0→150,000, all sourced from the larger IRA (`IRA1-`=150,000, `IRA2-`=0), `rothConv ≤ IRAwd`; `FedTax 5,770→46,300`, `StateTax 5,156→18,934`, Fed+State+IRMAA==totalTax (65,234); Taxation chart Federal bar 42,071 (was ~1,541), Cap Gains flat; RTP handoff accurate per-IRA; all 5 income-chart views build, no non-finite, flows balanced; no console errors, badge 🟢. Not yet committed.

## Session: 2026-07-14 (worktree mystifying-babbage-559d99) — PF8 implemented (v11.1253)

User asked to implement the PF8 plan (issue 1 fix + issue 2 tooltips; issues 3/4 stay informational, no code). Implemented all 9 steps plus the 2 tooltip rewrites, then version/changelog/cache-bust (both `optimizer_core.js` and `optimizer_ui.js` cache tokens bumped since both files changed).

Verification exceeded the plan's checklist. Live end-to-end repro of the original GK bug: optimizer row `optConvAmt:$550,000, convBEYear:2037` (today's date shifted this slightly from the earlier $525k figure -- expected, not a regression); loading that row now sets the sidebar field to $550,000 and the single-scenario Break Even stat reads **2037**, matching exactly (was "--" before this fix). Plain-row load resets the field to $0, confirmed. Both contamination guards proven directly: `runOptimizer()` gives byte-identical plain-row totals with vs. without a stray $300k sidebar value; `buildVariations()` shows 0 of 108 variations contaminated with a stray $777k `base.extraConversionAmount`, while the real value survives in the caller's own `base` reference (required since `mc_tab.js` reuses that exact object as `_mcBase`). Share-URL and scenario save/load round-trips both confirmed (the scenario round-trip needed a redo after I called `saveScenario()`/`loadScenario()` with a name argument they don't accept -- correct functions are `saveScenario()` (reads `#scenarioName`) and `loadScenarioByName(name)`; my own test-script error, not an app bug, caught and corrected before drawing any conclusion).

Cyclic-row branch (bug 1b's `cyclicEnabled`/`cyclicOrder` fix) didn't get a live top-5 repro -- no cyclic variant happened to win top-5 in the scenarios tried. Verified instead via direct code re-read (matches the established conditional-spread pattern for the other fields in the same object) plus a materiality check (`cyclicEnabled` only changed finalNW by ~$174 on this scenario's data, so the omission's practical impact was scenario-dependent, but the code path is real and the fix is mechanically correct). Flagging this honestly rather than claiming a full live repro I didn't get.

node 62/62 throughout (no engine logic changed, only a new pass-through field + zero-guards). Not yet committed.

## Session: 2026-07-13 (worktree mystifying-babbage-559d99, cont. 2) — PF8 investigation: 4 issues after PF7 (PROPOSED, not implemented)

User tested PF7 and reported 4 issues, entered Plan Mode. Investigated via 2 parallel Explore agents + my own live browser reproduction (same local-server-plus-JS-eval workflow as PF6) + 1 Plan agent for the fix design -- every load-bearing citation from the Plan agent spot-checked directly against source before trusting it (all confirmed exact: `runOptimizer()`'s `base=getInputs()` at line 368, `buildVariations()`'s `push()` helper, HTML placement lines, `DisplayHelpers.setDollarValue`).

**Issue 1 (real bug, confirmed by both Explore agent and my own repro):** clicking "load this strategy" on an Optimizer ⇌ row never carries over `extraConversionAmount` -- confirmed this field has ZERO presence anywhere in the single-scenario tab (no HTML input, not in `getInputs()`, not URL-shareable, exhaustive grep). Reproduced live: optimizer showed GK ⇌ row with `optConvAmt:$525,000, convBEYear:2037`; loading GK manually (maxConversion checked, no way to set the $525k) produces only trickle RMD-driven conversions and correctly shows all-negative convOC. Not a math bug -- the optimizer and single-scenario tab silently evaluate two different plans under one label. Plan agent found 2 additional related gaps I hadn't asked about: the Phase-23 `overrides` builder also drops `cyclicEnabled`/`cyclicOrder`/`stratIRMAATier`/`stratACAMultiple` (same silent-mismatch bug for cyclic/IRMAA-Ceil/ACA-Cliff top-5 winners), and -- more importantly -- once a new sidebar field for this exists, BOTH `runOptimizer()`'s main 176-192-row sweep AND `buildVariations()` (used by Monte Carlo) would silently leak a leftover nonzero value into every other strategy/variation unless explicitly zero-guarded. Full 9-step fix designed, not yet implemented.

**Issue 2 (doc-only, confirmed):** `_convSavings` (optimizer_ui.js:610ish, realized lifetime tax $ saved) and `convOC`/`convBEYear` (after-tax wealth, prices in deferred tax on whatever's left un-taxed in the counterfactual's IRA) are structurally different metrics -- both correct, can point opposite directions. Empirically demonstrated during PF7 verification: one scenario showed `_convSavings:+$191,620` alongside `convBEYear:null` and `convOCFinal:-$154,370`. User's intuition (should be at least one BE year for it to represent a real win) confirmed correct for "total wealth impact" specifically; Conv Savings answers a narrower "realized tax paid so far" question. Tooltip rewrite proposed, not implemented.

**Issue 3 (effort estimate only, as asked):** top-5-by-finalNW pool is orthogonal to which family's conversions specifically would break even. 3 tiers scoped (cheap betrAvg-broadened pool ~2-3x cost / expensive full-sweep opt-in "Deep Search" ~500-2000+ calls / full variant space) -- no implementation proposed, informational.

**Issue 4 (explained, no code needed):** reproduced exact reported shape locally (default inputs, strategy=fixed/nYears=10 = "Reduce"): 2033/2034 both runs' blended tax rate = 17.00%; 2035 actual drops to 11.51% (crosses a bracket boundary) while counterfactual stays 17.00% that year, converging in 2036. `sim.nominalTaxRate` is a discrete per-bracket step function (`taxengine.js` `nr` field) applied to each run's full remaining IRA balance in `totalWealth` -- not continuous. The two runs cross the same threshold in different years because years of prior conversions diverged their income trajectories, producing a one-year valuation blip unrelated to that year's actual (tiny, $69) conversion. Same root mechanism as the pre-existing self-documented "TAX GAP" comment found during the original PF6 investigation. PF6's sustained-crossing fix already correctly returns `convBEYear:null` for this scenario -- no false positive reaches the user-facing stat. Cross-verified against Reduce-strategy Explore agent's independent static-code trace (agent found the same dominant mechanism via `.nr` bracket-snap divergence, plus confirmed the amortization-schedule hard-cliff at `nYears` explains WHY only 2035 has any conversion, and IRMAA's 2-year lookback as a real but later-only contributing factor).

Full write-up, exact code for issues 1-2, and all supporting investigation detail in `~/.claude/plans/i-think-there-is-jazzy-dawn.md` (Round 3 section). **Nothing implemented yet** -- user interrupted the ExitPlanMode approval request to ask for a plain-language summary + alternatives first, given the volume of findings.

## Session: 2026-07-13 (worktree mystifying-babbage-559d99, cont.) — PF7: Break Even in the Optimizer (v11.1247)

Follow-up to PF6 in the same session. User asked two questions: impact of ranking the Optimizer by earliest Break Even year when Optimize Conversions is selected, and whether a cheap existing signal could pre-filter likely-to-break-even strategies before running the expensive counterfactual on all of them.

Investigated via 1 Explore agent (empirically verified against real code, some counts cross-checked in a Node vm sandbox): `runOptimizer()` sweeps 176/192 rows at 1 `simulate()` call each -- adding a full convOC counterfactual to every row would roughly double sweep cost. The existing Phase 23 "Optimize Conversions" pipeline (`includeConvOpt`) already narrows to the top 5 successful strategies before doing anything expensive, which is exactly the "cheap filter then bounded expensive work" pattern the user was asking about in Q2 -- it already existed in this codebase, just wasn't wired to convOC. `totals.betrAvg` (Kitces BETR) also confirmed as a free, already-computed, already-displayed signal that answers the same "likely to pay off" question with zero extra simulate() calls.

Wrote the analysis + a scoped recommendation into the plan file (explicitly framed as "confirm direction before implementation-ready plan," since the user's questions read as exploratory) and called ExitPlanMode; came back approved. Implemented the narrow, clearly-recommended option only: wired `computeOC:true` into the Phase 23 top-5 pipeline (each candidate's already-known winning `optConv` re-run once more, +1 simulate() call plus its internal counterfactual per candidate -- negligible next to that pipeline's existing ~11-41+ call sweep per candidate). New "Break Even" optimizer table column, new `earliestbe` nerd-mode objective ranking ascending by BE year with non-qualifying rows tied at the bottom (`?? 9999`) rather than a raw unguarded earliest-year sort -- deliberately avoided reintroducing the same "reward a trivial/tiny blip" distortion PF6 had just fixed. Did NOT extend this to the full 176-192-row main sweep (flagged as a possible expensive follow-up, not requested).

Verify: node 62/62 (no engine changes, purely optimizer_ui.js/HTML). Browser, two scenarios: (1) the user's original PF6 bug-report scenario -- 1 conversion-optimized row, `convBEYear:null` correctly (that $100k/yr conversion strategy never sustains a lead: `convOCFinal:-$154k` despite `$191k` of raw tax savings, a concrete demonstration that the pre-existing tax-savings-only `conveffect` objective can recommend a strategy that loses money in wealth terms); (2) a smaller/more typical scenario -- 4 conversion-optimized rows, all real `convBEYear:2049` with $265k-$315k final gains, correctly sorted above all null rows under the new objective. No console errors either run. Not yet committed.

## Session: 2026-07-13 (worktree mystifying-babbage-559d99) — PF6: Break Even sustained-crossing fix (v11.1240)

User reported Break Even firing on year 1 of a real scenario (URL with fixedpct strategy, uncapped maxConversion, futureIRATaxRate=34% override, 10%/yr IRA drawdown, both spouses on Medicare), with every year after showing negative Opp. Cost -- user's own hypothesis was "the calculation is correct but year-1 is an outlier."

Investigation: 2 parallel Explore agents (engine convOC/BE logic with exact file:line citations; URL short-param decode + fixedpct/IRMAA2/maxConversion mechanics) + direct reads of the critical code (`routeSurplusAndConvert`, `cfRefundIRA`, `evaluateYearOutcome`, taxengine.js `nr`/nominalRate machinery) + live empirical reproduction: replayed the user's exact URL against a local static server on the current worktree code (60/60 node baseline first), inspected `lastSimulationLog`/`lastTotals` directly via browser JS eval. Confirmed: 29 years (2026-2054), convOC = +$1,485 in 2026 only, negative every year after through -$107k at 2054 (never recovers, only 1 of 29 rows non-negative). Root cause confirmed as user suspected: `.find()`-based "first touch" BE-year selection with no persistence check -- same bug class PF5 fixed, one failure mode PF5 missed.

Design: 1 Plan agent independently validated the fix direction (rejected "N consecutive years", "last crossing regardless of trailing dips", and "gate on final row only" as inferior alternatives) and empirically pre-verified the proposed code via `node -e` against the real engine for all 6 existing PF5 OC tests (zero regressions, including the highest-risk Test 2) plus 2 new regression tests, before any file was touched.

Implementation: new `_sustainedBEYear(key, actionAmount)` helper in `optimizer_core.js` (replaces the two `.find()` calls) -- backward scan for the earliest start of the trailing non-negative run reaching the log's last row, forward scan for the action-occurred gate, `Math.max` of the two cutoffs. Updated 6 doc/tooltip/comment locations (optimizer_ui.js x2 + comment, retirement_optimizer.html stat tile + Docs paragraph, README.md) from "first non-negative year" to "permanently pulls ahead and stays ahead" -- caught and corrected em-dashes in the Plan agent's drafted text per standing style preference before applying. Changelog v11.1240 (`hex(194*24+16)`), cache-bust `optimizer_core.js?v=111240`.

Verify: node 62/62 (60 existing + 2 new, zero regressions). Browser: reloaded user's exact URL post-fix -- `convBEYear` now null, stat tile DOM shows "--", "Roth Break Even" chart milestone correctly absent, zero console errors. Cross-checked the PF5-era known-good case ("$50k/yr conversions -> +$314k gain") by replaying the exact `OC_BASE`+`extraConversionAmount:50000` test fixture via browser JS eval against the loaded engine -- confirmed `convBEYear=2041` unchanged, gain $313,866, all years from 2041 onward non-negative. Not yet committed.

## Session: 2026-07-09 — PF5: Break Even dual-sim counterfactual + small-screen UX (v11.11dc)

Review session (branch worktrees/retirement-optimizer-review-c4e406). Three analyses: architecture (findings recorded in task_plan.md for P15), Break Even accuracy, small-screen UX. Break Even proven broken empirically: reported a BE year with ZERO conversions (Roth-heavy: year 0; IRA-heavy: 2045), and reported no BE for conversions that gained +$314k after-tax. Root cause: shadow-delta formula mixed the baseline portfolio into the comparison and never charged the no-conversion world its larger RMD taxes/IRMAA.

Shipped PF5 per user direction ("financially responsible model"): convOC/excessOC now come from a full counterfactual re-simulation (suppress conversions/excess, `_cfRefundIRA()` fixed-point tax refund of discretionary IRA over-withdrawals; RMD surplus still flows out). Break Even gated on conversions occurring; counterfactual only when `computeOC` set (runSimulation) — optimizer/MC untouched (their rankings never used convOC). Identity verified: final convOC == finalNW difference vs independent no-conversion run, exact. CF pays larger RMDs (+$549k in test case) and more lifetime tax — the RMD counter-effect is now priced, as is conversion-caused IRMAA. Small-screen batch: tap tooltips (`?touchtips` hook), 3-col stat grid, single-row scrollable tabs, folded sidebar + ⇅ jump button, sticky Year column, has-tooltip wrap. Docs/tooltips/changelog rewritten; v11.11dc. node 60/60 (6 new OC tests), browser suite green, preview-verified at 375px (screenshot tool flaky — pane 0x0 — verified via snapshot + computed styles; added innerWidth>0 guard so hidden contexts don't fold the desktop sidebar).

## Session: 2026-07-08 (cont. 5) — PF4: changelog consolidation + docs polish (v11.11c8)

Follow-up requests after PF/PF2/PF3: (1) avoid em-dash in user-facing writing going forward (saved as a feedback memory), (2) consolidate the two most recent changelog entries (11.11c1 + 11.11c7) into a single 11.11c8 entry using user-provided wording verbatim, (3) gate the ACA Cliff strategy-discussion doc paragraph behind the nerd-knob (it's a nerd-only strategy), (4) rewrite the Break Even stat tooltip to plain language + point to Documentation, (5) add a new Docs-tab paragraph explaining the Break Even shadow-portfolio mechanism, positioned above "1. Profile & Ages" but outside the "Detailed Strategy Discussion" fold per instruction.

Hit the core.js cache-bust gotcha (documented in memory now) a second time mid-session: bumped `?v=` after the ACA-gating JS edit, browser served fresh code fine once actually reloaded. Verified via direct DOM/JS inspection: `#doc-aca-cliff` starts `display:none`, toggles to `''` on `setNerdKnob(true)` and back to `'none'` on `setNerdKnob(false)`; new Break Even doc `<li>` found immediately before the "1. Profile & Ages" `<li>` in DOM order; changelog list's first 3 entries are `11.11c8`/`11.11ae`/`11.11ad` (confirms the 11.11c1 entry is gone, not duplicated). node 54/54, browser 240/240, no console errors. Committed + pushed to PR #111.

## Session: 2026-07-08 (cont. 4) — PF2: bar-chart legend hover finally fixed + click-to-isolate

Planned in Plan Mode (approved), then user gave one correction after approval: restore trigger is **double-click**, not "click the same item again" — implemented per the correction, not the original plan text.

**Root cause of the "still broken" hover bug:** `chart.update('none')` is a documented Chart.js bug ([#11507](https://github.com/chartjs/Chart.js/issues/11507)) — skips redrawing bar fill colors even though `dataset.backgroundColor` updates correctly in the data model. Every prior "fix" this session only ever touched the caching logic around it, never the actual `'none'` mode call, so the visual bug survived two rounds. Switched to plain `chart.update()`.

**New behavior:** bar legend click now isolates (dim others, keep clicked full-color) instead of removing; double-click (`MouseEvent.detail === 2` — native browser double-click detection, no manual timestamp/distance tracking needed) restores all. Lines are untouched — hover-dim and click-to-remove both work exactly as before, per explicit user confirmation ("lines... can be kept").

Implementation: `dimColor()` extracted to module scope; new `makeChartLegendInteraction()` factory shares one `isolatedKey` closure across hover/leave/click (critical — an earlier draft used two separate factory calls for hover vs click and would have had disconnected state); rewired only the 4 mixed bar+line chart configs (tax/flows/assetflows/combined).

**Verification hit a real gotcha:** after implementing, the FIRST browser test showed the OLD default Chart.js click behavior still active — `core.js`'s `?v=1111c1` cache-bust token (added earlier this session) hadn't been bumped after these new edits, so the browser was serving a stale cached copy missing `makeChartLegendInteraction` entirely (confirmed via `typeof makeChartLegendInteraction === 'undefined'` in the live page vs `fetch(..., {cache:'no-store'})` showing the fresh source). Bumped to `?v=1111c7`. **Lesson for future sessions:** every core.js edit now needs its cache-bust token bumped before browser verification, not just once per session.

**Verify (all via direct handler invocation with fake MouseEvent-shaped args, since Chart.js legend items are canvas-drawn, not real DOM elements to click):** single click on a bar → isolates correctly; hover a different item while isolated → correctly suppressed (no change); double-click → full restore to original colors; line item (MAGI) click → still toggles hide/show exactly as before; `'│'` combined-view separator click → correctly a no-op; Medicare hover tooltip still composes correctly on tax/combined views. Also visually confirmed via screenshot that bars now actually dim on canvas (not just legend swatches) — the core bug. node 54/54, browser 240/240. Committed + pushed to PR #111.

## Session: 2026-07-08 (cont. 3) — PF3: MC Stress pass now runs current strategy only

Implemented and shipped Phase PF3 (planned in Plan Mode, approved, then implemented same session). Stress pass (folded into Historical per Item 7) was sweeping the FULL `variations` array (100+ strategies in typical scenarios) even though only checkbox-selected ones ever got plotted — wasted compute. Now runs against exactly 1 variation: whichever matches the user's current sidebar settings (`findCurrentStrategyIdx`), with a wrapped-`base` fallback if no exact match exists.

Changes: `runPass()` in both `worker.js` and `mc_controller.js` gained a 4th `runVariations` param (falls back to the full array if `cfg.stressVariations` is missing, so a stale-cached deploy degrades gracefully rather than erroring); `mc_tab.js`'s `runMonteCarlo()` builds the single-variation `stressVariations` array; `renderStressChart()` simplified — dropped the now-meaningless `_mcSelected`/multi-strategy-hue logic, just plots `stress.variations[0]` directly (no more `[Family]` legend prefix).

**Verify:** Browser — `_mcResults.stress.variations.length === 1` confirmed (main sweep was 108 variations in the test run, so this is a real compute reduction, not just a display change). Switched sidebar strategy `propwd`→`fixed`, re-ran, confirmed `stress.variations[0].strategy` updated to `'fixed'` — not stale. No console errors either run. node 54/54, browser in-page suite 240/240. Committed + pushed to PR #111 (same branch as Phase PF).

## Session: 2026-07-08 (cont. 2) — Session wrap-up: PR opened, Item 6 round 2 deferred

**Shipped this session (committed + PR opened):** Phase PF (9-item UX batch) + the round-1 Item 6 fix (permanent-staining bug + missing core.js cache-bust). node 54/54, browser 240/240.

**Found but NOT implemented — deferred to next session:** user reported round-1's Item 6 fix didn't fully work — bar charts' legend swatches dim on hover but the bars themselves never visually redraw (confirmed via Chart.js issue #11507: `chart.update('none')` is known-buggy for skipping per-element redraws). User also requested a behavior change while diagnosing: bar-chart legend clicks should isolate (dim others, sticky) instead of toggle-hide; line clicks keep toggle-hide. Full design written and reviewed (2 clarifying questions resolved with user) in Plan Mode at `~/.claude/plans/add-the-following-to-swift-backus.md` ("Follow-up: Item 6 round 2" section) and mirrored into `task_plan.md`'s new **Phase PF2**. Not implemented — user said "will continue later."

**Next session start point:** read Phase PF2 in task_plan.md + the linked plan file section, then implement: (1) `update('none')`→`update()` in `datasetHoverHighlight()`, (2) new `makeChartLegendInteraction()` combining hover-dim + click-isolate, rewired onto the 4 mixed bar+line chart configs only.

## Session: 2026-07-08 (cont.) — Item 6 bug fix: legend hover permanently dimmed bar charts

User caught a real bug right after PF shipped: on bar charts (Taxation, Inflows vs Outflows, Earnings vs W/D), hovering a legend item dimmed the others but they **never restored** on mouse-leave, so every subsequent hover looked like "no effect" (everything was already stuck dim). Line charts worked fine.

**Root cause:** `datasetHoverHighlight()`'s cache/restore guard used `ds._origBorder !== undefined` to mean "have I cached this dataset's original colors yet." Bar datasets built via `mkTax`/`mkUp`/`mkDn`/`mkE` never set a `borderColor` at all — so their *real* original `borderColor` is legitimately `undefined`. The guard couldn't tell "never cached" apart from "cached, and the original happened to be undefined," so `onLeave` silently skipped restoring any bar dataset, permanently baking in the dimmed color. Line charts always set `borderColor`, so they never hit this path.

**Fix:** replaced the ambiguous `_origBorder !== undefined` sentinel with an explicit `ds._hoverHighlightCached` boolean marker (core.js, `datasetHoverHighlight()`). Verified via direct `onHover`/`onLeave` invocation on the Taxation chart's bar datasets — dim-then-restore now round-trips exactly back to original colors across repeated hover/leave cycles on different legend items.

**Bonus fix surfaced during verification:** `retirement_optimizer.html`'s `<script src="retirement_optimizer_core.js">` tag had **no cache-busting `?v=` token at all** (every other script — taxengine.js, montecarlo/*.js — already had one). This meant browsers could serve a stale cached copy of the single largest, most-frequently-edited file in the app indefinitely. Added `?v=1111c1` to match. This isn't cosmetic — it's the same class of staleness bug that historically motivated adding `?v=` tokens to the other scripts (see `taxengine.js` cache-bust history in earlier sessions).

**Verify:** node 54/54 (unchanged, this was pure browser/DOM logic no node test covers), browser in-page suite 240/240, no new console errors (the 4 shown are the existing intentional bad-input test fixtures). Manually confirmed on Taxation view: hover "Federal" → Cap Gains/State/IRMAA/Medicare/MAGI/threshold lines all dim to 15% opacity; leave → all restore to exact original hex/rgba values; repeat on "State" → same round-trip, no permanent staining.

## Session: 2026-07-08 — Phase PF: UX Polish Batch, 9 items (v11.11c1, worktree mystifying-babbage-559d99)

User punch-list of 9 items, planned via Plan Mode (3 parallel Explore agents + 1 Plan agent, `~/.claude/plans/add-the-following-to-swift-backus.md`), implemented + browser-verified in one session.

1. **Terminology:** "Bootstrap"→"Historical", "GBM"→"Synthetic" across retirement_optimizer.html + mc_tab.js user-facing text.
2. **IRMAA year-0 bug (real fix, not just cosmetic):** `magiHistory` seed ran *after* year 0's lookback read (core.js ~993), so year 0 always saw `magiLookback=undefined` → IRMAA forced to `$0`/`-none-` regardless of actual income. Fixed by computing year-0's IRMAA/tier retroactively inside the same seed block, once `tax.MAGI` is known. New node test (`54/54` total). Browser-verified: high-income 65+ scenario now shows Tier 2/4 in year 0 (was `-none-`).
3. **Income chart note:** bolder (font-weight 600) + now mentions the Inflows vs Outflows view.
4. **Cycle Brokerage — max out target LTCG bracket:** new nerd-knob `#cycleLTCGTarget` (0.15="target 0% bracket" default / 0.20="target 15% bracket"). Always harvests to the full target-bracket room regardless of spend need; when spend forces beyond it, tops off whichever bracket the forced realization lands in — capped by the active bracket/minlimit/aca strategy's own ceiling (extracted into new `computeBracketCeiling()` helper, reused by both the original ceiling branch and the new Cycle-Brokerage logic — pure refactor, verified byte-identical behavior via 54/54 before/after). **Found and fixed a real latent bug** in `getLTCGBracketRoom()` during implementation: it only returned room within the *first* bracket the ordinary income fell into, not the combined span across multiple sub-`maxRate` brackets — meant `cycleLTCGTarget=0.20` produced the *identical* result as `0.15` until fixed (caught via a failing new test, root-caused by hand-tracing bracket-walk logic). New tests: max-out-even-when-spend-small, 0.20-harvests-more-than-0.15.
5. **Untaxed tooltip:** own array line now, not string-concatenated onto "Total Income".
6. **Legend hover highlight:** new `composeLegendHover()` + `datasetHoverHighlight(groupSize)` helpers (core.js, near `medicareLegendHover`) — hovering a legend item dims all other chart series to ~15% opacity via `chart.update('none')`. Applied to all 8 chart configs (Assets, 4 Income&Expenses views, combined view — 6 in core.js; MC main chart + Input Distribution fan charts — 2 in mc_tab.js). Composes with the existing Medicare tooltip-hint handler where both are needed (avoids the object-spread key collision that would've silently dropped one).
7. **MC: fold Stress into Historical (highest risk item).** worker.js/mc_controller.js: extracted the bank-build+variations-sweep body into a `runPass(mode, progressOffset, progressWeight)` inner function (mirrored identically in both files); Historical mode now calls it twice (bootstrap pass + stress pass) in one message cycle, weighted by path-count share so the progress bar doesn't jump to 100% and restart. Stress dropdown option removed. New `renderStressChart()` in mc_tab.js renders the stress pass into a new `#mc-stress-chart-wrap` canvas below the main chart; `renderMCChart()` trimmed to percentile-bands-only (no more `isStress` branch). Gave the stress chart its own `_legendIsolatedKeyStress` (previously a shared `_legendIsolatedKey` would've let isolating one chart's legend desync the other's restore toggle).
   - **7b:** Input Distribution fan charts now label the x-axis with actual calendar years (`_mcStartYear + i`), matching the main chart — was "Yr 1"/"Yr 2".
   - **8:** Split `renderMCMetrics()` into `renderMCMainMetrics()` (next to the main chart) + `renderMCStressMetrics()` (next to the stress chart), sharing a new `buildAssetRangeTable()` helper — confirmed via browser inspection the two grids show genuinely different CAGR numbers (not accidentally sharing data).
   - No automated test coverage exists for worker.js/mc_controller.js — verified entirely via live browser eval: Historical mode → both charts render (30 + 60 datasets), calendar-year labels on both, distinct Min/CAGR/Max stats, correct table title; Synthetic mode → stress section hides (`display:none`), table title shows "Synthetic", median-growth summary line shown instead of the asset-range table.
9. **MC Strategy table click-to-sort:** mirrors the Optimizer table's `sortOptimizerBy` pattern exactly — new `mcSortState`, `getMCColumns()` (7 sortable columns, checkbox excluded), `sortMCTableBy()`. Static header `<div>`s replaced with dynamic `#mc-table-header`. Default (unclicked) sort preserves the original 3-key tiebreak (survival desc → final balance desc → tax asc). Browser-verified: click "Total Taxes" → ascending dollar sort with arrow ▲; click again → descending ▼; checkboxes still map to the correct (reordered) row.

**Verify:** node **54/54** (52 baseline + 2 new: IRMAA year-0, Cycle-Brokerage max-out). Browser in-page suite **240/240**, no console errors. Version 11.11ae→**11.11c1**, changelog added, montecarlo/mc_controller.js + mc_tab.js cache tokens bumped `111091→1111c1` (worker.js self-cache-busts via `Date.now()` fallback already, no token needed).

**Not done / out of scope for this batch (flagged, not blocking):** QCD "As Needed" sizing still estimates `provisionalMAGI` excluding capital gains — pre-existing approximation whose error grows with Item 4's larger harvests, not tested here. `_mcMsPerSim` calibration will be slightly inflated for future GBM-time-estimates since `totalMs` now includes the stress pass — cosmetic, not fixed.

## Session: 2026-07-07 (cont. 5) — After-tax note on Income & Expenses chart (v11.11ae)
Added `#income-aftertax-note` below the chart-view buttons, shown only for the `combined` view (`setIncomeChartView()`, core.js:4249-4253 — mirrors the existing `chk-thresholds-wrap` show/hide pattern), text: "Incomes shown are After Taxes - See Annual Details for pre-tax amounts." Directly addresses the SS-chart question from the prior session — clarifies in-app that combined-view income bars are tax-scaled. Browser-verified: visible on combined, hidden on tax/net/flows/assetflows, visible again when switching back. Changelog + version reviewed with user before commit (user approved as-is): v11.11ad→11.11ae, "Income & Expenses chart: added a note that shown incomes are after-tax (pre-tax figures are in Annual Details)." node 51/51, badge 🟢.

## Session: 2026-07-07 (cont. 4) — P21 rename + SS chart investigation (v11.11ad)
Renamed "Spend by Account"/"Account Spend" → "Spending" throughout: category tag string, `cat-acctspend`→`cat-spending` checkbox id, `showAccountSpendOnly()`→`showSpendingOnly()`, button/checkbox labels. Changelog updated to user's exact wording ("Added Spending to Annual Details to focus on spending."), version bumped 11.11ab→11.11ad (this time WITH changelog/version, per user request — supersedes the "no changelog" instruction from the prior polish-only commit). Browser-verified rename end-to-end (old ids/fn gone, new ones work, badge 🟢), node 51/51.

**Investigated:** user reported Income & Expenses chart showing SS=$20,460 for 2026 instead of expected $24,000 (default scenario: spouse SS $24k @ age 70, spouse age 74 in 2026; primary SS $48k @ age 70 not yet claimed at age 66). **Not a bug.** `lastSimulationLog[0].SSincome` = exactly $24,000 (confirmed via preview_eval) — Annual Details table is correct. The Income & Expenses chart's combined view deliberately scales every income-source bar (SS, pension, RMD, etc.) by that year's effective tax rate `(vsum - totalTax) / vsum` (`mkInc()`, core.js:4487-4494, documented in the comment above it at 4466-4471) so stacked bars sum to net spendable income, with a Taxes band drawn separately on top to gross total. Computed scale for year 1 = 0.8525 (totalTax=$27,191, vsum=$184,332) → $24,000 × 0.8525 = $20,459.73 ≈ $20,460, exact match. No code change made — reported finding to user only.

## Session: 2026-07-07 (cont. 3) — P21 polish pass (no version bump)
User testing surfaced 6 issues, all fixed: (1) pre-existing bug — `year` column missing under 5 of 10 category checkboxes (IRA Δ/Roth Δ/Brokerage Δ/Cash Δ/Opp. Cost) system-wide, now fixed for all 10; (2) preset button restyled from default (huge, `.tab-btn` blue) to existing small `.tog` class; (3) dropped `age1`/`age2` from Account Spend; (4) swapped combined `RMDwd` for per-account `RMD1-`/`RMD2-`; (5) swapped separate `SSincome`+`pension` columns for the existing combined `inflows` field; (6) added missing `surplusCash` tooltip. Browser-verified each fix individually via preview tools (year-visibility loop across 5 categories, preset-button field-set check, computed-style check on button at desktop width vs mobile, tooltip text check). node 51/51, in-page badge 🟢. User explicitly asked for no changelog/version bump — stayed at v11.11ab.

## Session: 2026-07-07 (cont. 2) — Phase P21 shipped (v11.11ab)
"Spend by Account" view for Annual Details. New `'Account Spend'` tag on 15 log fields in `columnCategories` (core.js:3139-3236: year/age1/age2/SSincome/pension/IRA1-/IRA2-/RMDwd/QCD1/QCD2/RothWD/Brokerage-/CashWD/rothConv/surplusCash), `cat-acctspend` checkbox wired into `getActiveCategories()`, new `showAccountSpendOnly()` preset function (unchecks all other cat-* + show-all, checks only cat-acctspend) bound to a new button in `.column-controls` (retirement_optimizer.html:749-786). Browser-verified via preview tools: checkbox alone unions with Summary correctly; preset button isolates to exactly the 15 fields (11 visible by default, all 15 with Show Zero); no balance/growth columns leak in; no console errors. node 51/51, in-page badge 🟢. Version 11.1133→11.11ab, changelog entry added.

## Session: 2026-07-07 (cont.) — Added Phases P20-P23 (planning only, no app code)
User requested 4 new backlog items, researched via 3 parallel Explore agents + 1 Plan agent, 2 design questions resolved via AskUserQuestion (plan mode):
- **P20** README Table of Contents — inline ToC + heading-level fix, no docs/ split (user chose low-risk option).
- **P21** Annual Spending-by-Account View — new `'Account Spend'` category tag reusing existing checkbox/category-filter system (core.js:3139-3303), not a new page, not an extension of RetirementTaxPlanner.html (confirmed too narrow — single-year tax tool).
- **P22** Export Annual Details to CSV — CSV-only v1 (no xlsx lib), reuses `exportScenario()`'s Blob+`<a download>` idiom, filters through live `isColumnVisible()` so export matches on-screen state; XLSX explicitly deferred.
- **P23** MC arithmetic-mean returns + AR(1) variable inflation for GBM mode — user confirmed: (a) plain normal walk `mu + sigma*boxMuller(rng)` clamped at **RETURN_FLOOR = -0.85** (user-specified during plan review), replacing log-space/Itô GBM entirely; (b) AR(1) inflation (`computeNextInflation()`) default-ON for all GBM users, only persistence/shock-stddev knobs nerd-gated. Formula triplicated across worker.js + mc_controller.js×2 — flagged as footnote risk, not restructured.

All 4 written into task_plan.md priority table + full `## Phase PXX` sections + dependency graph. No app code touched this session — purely a planning/backlog update.

## Session: 2026-07-07 — Context restore, new worktree `mystifying-babbage-559d99`
- Branch `worktrees/mystifying-babbage-559d99`, clean, matches main post-PR#108.
- Old worktree `silly-hellman-b5d326` gone (deleted post-merge) — plan files recovered from committed `.planning/retirement-optimizer/` (not gitignored, survives worktree deletion).
- PR#108 (3b5a7e2): b27078c (restore accidentally-deleted tool headers in README) + 92814b3 (this same doc-refresh) + 8ee8f34 (README other-tools reorg) — all docs-only, no app code changed. App version still v11.1133 (confirmed in retirement_optimizer.html title), matching P19 taxengine work (PR #105).
- No pending uncommitted code. Next unblocked priority-list item: **P2 Cash Reserve enforcement**.

## Session: 2026-07-04 — Context restore, new worktree `silly-hellman-b5d326`
- Branch `worktrees/silly-hellman-b5d326`, clean, matches main post-PR#107.
- Since last plan update (PR#104): PR#105 (324447f taxengine circular-dep fix, now committed — P19 status line updated), PR#106 (d930139 RealReturns sweepable period + inflation/CAGR context — side feature, not on P-list), PR#107 (16c75d9 HYSA share/URL-state UX + moved root tools into `standalone/` + 3a3188a/6d09da8 planning-layout fixes — also side features, not on P-list).
- `.planning/` layout now scoped at `.planning/retirement-optimizer/` per 3a3188a (hooks expect this; flat layout from 16c75d9 was invisible to hooks).
- task_plan.md "As of" line + P19 status refreshed. No code changes yet this session.

## Session: 2026-07-02 — Context restore, new worktree `cranky-mcclintock-9fa806`
- Branch `worktrees/cranky-mcclintock-9fa806`, clean, matches main post-PR#103.
- PR #103 merged (f46fb67): 97cb319 MC milestone-filter fix + Sim Mode label size — was UNCOMMITTED per the entry below, now confirmed shipped as part of that PR.
- Version confirmed v11.1125 in retirement_optimizer.html title. session-catchup.py found no unsynced context. No code changes yet this session.
- task_plan.md "As of" line refreshed (was stale at 2026-06-29/priceless-turing-9a5ad3).

## Session: 2026-07-01 (cont. 4) — MC milestone filter + Simulation Mode label size (now COMMITTED via PR #103)
1. `milestonePlugin` now filters by canvas id: `chartAssets`/`chartIncomeSources` = all milestones; `mc-chart` = death markers only (label contains 'Passing') — MC fan mixes strategies so IRMAA/GK/shortfall/Roth-BE markers don't apply; all other canvases (mc-input fans) = none. Plugin was globally registered so it previously drew stale single-run milestones on every chart.
2. MC "Simulation Mode" label 0.9em→1.1em (12.6→15.4px), select 0.9→0.95em (retirement_optimizer.html ~416).
Verified: main charts keep all milestones, mc-chart update clean w/ plugin active, badge 🟢, no console errors.

## Session: 2026-07-01 (cont. 3) — COMMITTED e62e270, pushed, PR #103 opened (v11.1125 batch: age gate + colors + Medicare B+D)

## Session: 2026-07-01 (cont. 2) — Medicare un-gated + Part D + legend hover (v11.1125, UNCOMMITTED)
1. NERD_KNOBS gate removed from Medicare everywhere: log key always `Medicare` (no more `-Medicare`), chart series unconditional in Taxation + Income&Expenses.
2. `medicareBase` now includes Part D: `(standardPartB 202.90 + standardPartD 38.99) × 12 × count × medicareRate`. New `TAXData.IRMAA.standardPartD: 38.99` (2026 CMS base beneficiary premium, IRA 6% cap).
3. Legend hover on 'Medicare': `medicareLegendHover` (onHover/onLeave set `canvas.title`) const next to the color consts; spread into tax-view + combined-view legend configs. Tip text (user-specified verbatim): "Base Cost for Medicare B+D - not deducted from spendable. Illustration only."
4. Version stays 11.1125 (same hour hash, user approved); changelog Medicare bullet shortened per user; taxengine cache token 1124→1125 in all 4 HTMLs.
Tests: node 51/51, browser 240/240, badge 🟢. Medicare sample 2026 = $5,805 (2 × 241.89 × 12 ✓).

## Session: 2026-07-01 (cont.) — IRMAA/Medicare chart colors (v11.1125, UNCOMMITTED)
User: IRMAA + Medicare shared near-identical pinks. New single-source consts above `computeMilestones()` in core.js: `IRMAA_COLOR='#E75480'` (deep pink, user-approved via swatch), `MEDICARE_COLOR='#008080'` (teal, darker than Gains+Div `#1abc9c`). Bars = const+`'C0'` alpha in Taxation + Income&Expenses; IRMAA milestone marker now pink (was blue `#2980b9`). Tier-threshold blue ramp + table tints unchanged (user choice). Version 11.1124→11.1125, changelog sub-bullet added. node 51/51, badge 🟢 (240/240), colors verified via dataset inspection. NOTE: preview_screenshot tool wedged (timeouts) though page responsive — verified programmatically.

## Session: 2026-07-01 — IRMAA Medicare age gate (v11.1124, worktree focused-dewdney-a79975, UNCOMMITTED)
User bug: "IRMAA" milestone fired at age 61/62. Fixes:
1. **Age-65 per-spouse gate**: `calcIRMAA(..., onMedicareCount)` new 5th param (null = legacy household total; else per-person = rate/(MFJ?2:1) × count). core.js computes `onMedicare` from alive+age≥65 per spouse.
2. **Tier off-by-one fixed**: log-row `IRMAATier` used to recompute from magiHistory AFTER the year's push (1-yr lag vs 2-yr charge). Now computed once at charge time (`irmaaTier`), passed through log params. Shows `-none-` pre-65 → milestone auto-gated.
3. **IRMAA Ceil / minlimit strategy gate**: pre-63 (`maxAliveAge < 65 + LOOKBACK`) the IRMAA tier ceiling relaxes to top of federal bracket CONTAINING it (verified: MFJ tier-0 218k ceiling → ~403k target at 60–62, exact ceiling from 63).
4. **Medicare base premium tracked**: `medicareBase = onMedicare × standardPartB × 12 × medicareRate`; logged as `Medicare` (nerd) / `-Medicare` (hidden); chart series in Taxation + Income & Expenses gated by NERD_KNOBS; `totals.medicare`; NOT in totalTax (assumed inside spend goal — no double count, sim results independent of nerd flag).
Verified NOT bugs (user concerns 2&3): threshold inflation correct (Y−2 MAGI vs year-Y CPI-inflated thresholds = real SSA indexing); surcharge $ grows at ANNUAL_INCREASE 5.6%/yr ≈ CPI+3%.
Tests: node 51/51; browser 240/240 (14 new: 6 unit per-person calcIRMAA + sim age-gate suite; sim test needs `hasSpouse:true` or spouse zeroed at simulate() entry!). Version 11.1119→11.1124, changelog added, taxengine cache token 1119→1124 in all 4 HTMLs.

## Session: 2026-06-30 (cont.) — CA note fix + 2026 data refresh for stale states (UNCOMMITTED, no changelog)
- **CA NOTE**: now states the omitted SDI/personal-exemption credits cause California tax to be slightly **over-calculated** (actual lower).
- **Checked the 4 states dated YEAR:2025** (ME, MN, OH, WI) via WebSearch for real 2026 changes:
  - **Ohio — STRUCTURAL fix**: HB 96 moved OH to a **flat 2.75%** above $26,050 for 2026 (3.5% top bracket repealed). Model had 3 tiers incl. 3.5% → corrected to `[{26050:0},{Infinity:0.0275}]` (both filings), YEAR→2026, NOTE updated. Verified: $200k MFJ → $4,652 = (200000−4800−26050)×2.75%.
  - **Maine — inflation refresh**: 2026 brackets (rates unchanged 5.8/6.75/7.15%): MFJ 54,850/129,750, SGL 27,400/64,850. YEAR→2026, NOTE updated. (Source: maine.gov 2026 rate schedule.)
  - **Minnesota — inflation refresh**: 2026 brackets (+2.369%, rates unchanged): MFJ 46,330/184,040/321,450, SGL 31,690/104,090/193,240. YEAR→2026, NOTE updated. (Source: MN DOR 2025-12-16 release.)
  - **Wisconsin — left at 2025**: only the top bracket ($315,310 single) was available, not the full 2026 thresholds; rates unchanged. Kept YEAR:2025 so the staleness banner discloses it.
- Cache token bumped `111103→111104` (taxengine changed again). node 51/51; browser badge 🟢, no console errors. No version/changelog bump (per request).

## Session: 2026-06-30 (cont.) — Assumptions layout + state-note UI + oddball-state notes (UNCOMMITTED, no changelog)
Follow-up UI batch (user, no changelog requested):
1. **Growth + Dividend Rate now share one row** (assumptions). 2. **Cash Interest moved down**, now paired with Marginal Heirs Tax Rate. 3. **State Taxation = full-width row** (single-child `.row`, full-width at the breakpoint like Withdrawal Strategy). 4. **`#state-note` div** added below State picker; new `updateStateNote()` (defined inline in retirement_optimizer.html, called on `STATEname` onchange + init) renders the selected state's caveat like IncomeTaxPlanner.
5. **Oddball-state NOTEs added/extended in taxengine.js** describing how the model differs from actual: GA, NY, CO, KY, MI (new NOTE); AL, MD, ME, MT, OH, WI, CT, VA (retirement caveat prepended to existing NOTE). IL/PA already done. Each says the model over-taxes (or AL: pension-vs-IRA) and by how much.
6. **All note displays show the tax-data year + staleness** ("📅 Tax data: 2026 rules" or, when curYear>data YEAR, "— {curYear} figures not yet published; {dataYear} rules applied until updated"). Implemented in retirement_optimizer `updateStateNote`, Retirement_Projection `updateStateNote` (textContent→innerHTML), and IncomeTaxPlanner `buildStateNotes` modal (per-li year prefix).
7. **Ordered-strategy `#orderedSeq`**: confirmed already full-width (436px = container); no change needed.
- **Cache:** bumped taxengine `?v=111102→111103` in all 3 HTMLs (taxengine content changed again).
- Verified (http.server :8767): optimizer layout (Growth|Dividend, Cash|Heirs, State full-width+note), notes render with year (CA 2026; ME/OH show 2025-stale), GA/NY/IL/PA caveats; RP PA/NY/OH notes; ITP modal 19 notes with year prefix. node 51/51. Badge 🟢, no console errors. Title stays v11.1102 (no version bump per request).

## Session: 2026-06-30 — State retirement-income exclusion (v11.1102, worktree heuristic-panini-6da3e1, UNCOMMITTED)
Plan: `~/.claude/plans/sharded-bouncing-squirrel.md`. New task (not on the P-list): user reported IL taxes IRA withdrawals though IL exempts retirement income.

**Root cause:** `calculateTaxes()` folded all retirement distributions into `earnedIncome` → every state taxed them; only `SSTaxation` exempted SS. No retirement-income lever.

**Engine (taxengine.js):** added `pensionIncome`/`iraIncome` params (default 0 → regression-safe) and per-state `RETIREMENT_EXCLUSION:{mode:'full',types:['pension','ira']}`. STEP 4 subtracts the qualifying buckets from `stateAGI` (ordinary side; cap-gains recompute inherits it). Coded **IL** and **PA** full exemptions (+ NOTE text). Kept pension/ira split separate to support future oddballs (AL pension-only, NY govt-vs-private).

**Callers updated (all taxengine.js consumers):**
- core.js — 4 main calls + 3 shadow/incremental (conv/excess OC) + `computeSuggestedSpend`: pass `pensionIncome:pension, iraIncome:taxableRMD+netWithdrawals.IRA`. (worker.js covered via core.js; worker cache-busts via Date.now().)
- Retirement_Projection.html:1311 — `iraIncome: actualWd + spouseRmd` only (fixedIncome is a mixed pension+interest+div bucket, can't split → left taxed; matches existing approximation note).
- IncomeTaxPlanner.html — new `cfg.retirementIncome` $ input (`#num-retinc`/`updRetInc`) + checkbox `#chk-retinc-swept` ("swept income is retirement distributions"); `calcAt` passes `iraIncome`; URL keys `ri`/`rw`. Default off → unchanged.
- **Cache-bust:** `taxengine.js` had NO `?v=` token on its `<script>` tag (unlike MC scripts) → returning users would get stale tax logic. Added `?v=111102` to the taxengine tag in all 3 HTMLs.

**Tests:** +4 in core.test.js (IL/PA exempt; IL still taxes dividends; CA params inert). node 51/51 + taxPaymentPlanner 12/12.
**Browser-verified (http.server :8767):** IL/PA state tax → $0 on retirement income (IL was $5650), IN/CA unaffected, IL still taxes dividends; ITP swept-on→$0 / fixed-$100k-of-$150k→$2185 / CA inert; RP PA→$0 (was $3377). Optimizer badge 🟢, no console errors, title v11.1102.
**PENDING DECISION (oddball partial states):** AL (pension-exempt/IRA-taxed), GA $65k/65+, NY $20k+govt-exempt, CO/KY/MD/ME caps, MI cohort phase-in, CT/VA income-tested, WI/OH minor. Spelled out in the plan file; not implemented. Also MS/IA (full-exempt, not yet coded as states).

## Session: 2026-06-29 — UX batch (13 items, worktree pedantic-cohen-5dfe27, NO changelog/version bump yet)
Plan: `~/.claude/plans/1-lets-add-pension-lexical-flurry.md`. All 13 items implemented + verified in browser (212 tests pass; node suites 47+12 pass).
- **PA Pension Start Age** — `#pensionStartAge` input in Income section; `getInputs` (1939), gate at core.js:1000 (`age1 >= pensionStartAge`), URL key `psa`, label map. Verified: $0 before age, full after.
- **#1 rename** "3. Income (annual)" → "**3. Annual Income & QCDs**" (summary + How-To doc line). No .md refs needed ("Income chart" is a different feature).
- **#2** Folded "Charitable Giving (QCD)" `<details>` into bottom of Income section as a bold sub-heading (kept `#qcdHHMax`/`#qcdAlways`).
- **#3** "Withdrawal Strategy" → "**5. Withdrawal Strategy**" (strategy-container div).
- **#4** Added tooltips: Inflation, CPI/COLA (+ #7 audit extras: ss1/ss1Age/ss2/ss2Age/pensionAnnual/survivorPct).
- **#5** "Future IRA Tax %" → "**Marginal Heirs Tax Rate %**" (id `futureIRATaxRate` unchanged) + new tooltip (heirs' all-in rate, 0% if donated).
- **#8** Optimizer "Symbols:" legend row (✓✦✦+▼🗘🔄⇌⚠️🟢🚨⚓) added beside Row-colors.
- **#9 Objective selector** (nerd-only) `#opt-objective`: Balanced/Legacy/Spend/MinTax/Roth/ConvEffectiveness → `OPT_OBJECTIVES` + `rankRowsByObjective`. Conv Effectiveness = `_convSavings`. Choosing objective re-picks ⚓ baseline via `recomputeBaselineForObjective()` (runOptimizer refactored to call it); "Balanced" restores default. Verified baseline moves (spend→IRA Draw vs GK).
- **#10** Nerd table keeps **Score** + adds **Rank** column (`OptimizerState._rankMap` built per render).
- **#11 Failed list** — `OptimizerState.showFailed=false`; hide `success===false` by default; `#opt-legend-failed` toggle + `toggleFailedRows()`; light-red tint. Verified 6→167 rows.
- **#12 ACA nerd-gated** — sweep loop `if (NERD_KNOBS && !acaDisabled)`; `generateStratRateOptions` aca entries gated; `updateACAWarning` no-ops with no aca opts. Verified 0↔4 options.
- **#13 Hidden runtime nerd toggle** — `const`→`let NERD_KNOBS`; `setNerdKnob()`/`applyNerdKnobVisibility()` (re-runs BETR stat, objective wrap, initMCTab, toggleStrategyUI, refreshStratRateOptions, opt re-render); unlabeled `#secret-nerdknob` at bottom of Docs tab w/ black-hole tooltip; init calls applyNerdKnobVisibility(). NOT URL-persisted. Verified runtime on/off.
- **#6** No changelog/version bump (deferred to end per request).

### Follow-up (same session)
- **7 audit tooltips added:** `#strategy` + `#orderedSeq` selects; all 6 tab buttons (`btn-tbl/cht/opt/mc/fileio/docs`).
- **Brokerage color unified to `#4F4FDC`** across ALL charts (was `#0000CC` in Income/Expenses, `#2980b9` in Assets/flows/assetflows) — fixes Guaranteed(`#3498db`) vs Brokerage-draw clash on Inflows-vs-Outflows. Edited 4 datasets in core.js (assets line, combined mkInc, flows mkUp, assetflows mkE). Verified via Chart dataset inspection: assets `#4F4FDC`, others `#4F4FDCB0`.
- **Nerdknob checkbox now visible** — was `opacity:0.18;cursor:default` (user couldn't see it) → `cursor:pointer` plain checkbox, still unlabeled with black-hole tooltip, bottom of Docs tab.
- Re-verified: in-page 212/212 (🟢 badge), node 47/47, no console errors.

### Follow-up batch 5 — Milestone overhaul (no changelog)
Rewrote `computeMilestones(log)` (core.js ~4082). Was first-only death/underfunded/IRMAA; now:
1. Death labelled **"Your Passing"/"Spouse Passing"** (deceased's `age1/age2` shows '—' at the status flip).
2. **"GK cut"** every year `r.gkAdj` contains "cap" (guardrail spending cut).
3. **"IRMAA Tier N"** every year the numeric tier (`tierNum(r.IRMAATier)`, strings "-none-"/"Tier N") INCREASES over prior year (not same/decrease).
4. **"Shortfall"** every year `netIncome < spendGoal*0.90` (>10% short).
5. **"Roth Break Even"** at `lastTotals.convBEYear` (reuses the existing Break Even stat's year).
Refinement: a shortfall year SUPPRESSES the GK-cut marker (shortfall computed first; GK cut pushed only when `!isShort`) — verified GK 400k: 12 both-years all show only "Shortfall".
Verified in browser: default → Your Passing + IRMAA Tier 1 + Roth Break Even; GK 220k → 8 GK cuts + tier increase; propwd 900k → 24 Shortfall + IRMAA Tier 5 + Roth Break Even. node 47/47, in-page 212/212 (🟢), no console errors.

### Follow-up batch 4 — Brokerage color + changelog (v11.10ee)
- **Brokerage color unified to solid `#4F4FDC`** across all 4 charts. Balances line was already solid; dropped the `B0` alpha on the 3 bar-chart series (core.js flows ~4378, assetflows ~4405, combined ~4533). Verified all four datasets = `#4F4FDC`.
- **Changelog + version bump → 11.10ee** (`hex(180*24+14)`; title html:17 + new top `<li>` in Change Log). User-selected entries only: Pension start age, Optimizer symbol legend, Guyton-Klinger sustainable-spend fix. (Other candidates intentionally omitted this pass.)
- Verified: node 47/47, in-page 212/212 (🟢), no console errors.

### Bug fix — GK guard/adj scenario round-trip (pre-existing, exposed by visible nerdknob)
- Symptom: optimizer GK row showed "Grd:0 Adj:0" (non-nerd) / fields showed 0.2,0.1 (nerd).
- Root cause: `saveScenario` stores `getInputs()` (gkGuard as DECIMAL 0.2); `applyScenario` (core.js:5078) multiplies percentage fields ×100 on load but its list OMITTED `gkGuard`/`gkAdjPct` (added in Phase 22, never added here) → field set to 0.2 → next `getInputs` does 0.2/100=0.002 → GK reads guard≈0; label `round(0.002*100)=0`. Auto-loaded `default` scenario triggered it every load. Not caused by my edits — the visible secret-nerdknob just revealed the ui-gk panel.
- Fix: added `gkGuard`, `gkAdjPct`, `futureIRATaxRate` (same latent gap) to the ×100 list in `applyScenario`. Verified: applyScenario({gkGuard:0.2}) → field 20.000, getInputs 0.2, GK label "Grd:20 Adj:10". Existing buggy saved scenarios now load correctly (no migration needed).

### Follow-up batch 3 — label rename + GK reverse-search floor + banner fix
- **Renames (visible only; identifiers unchanged):** "Spend-optimized"→"Optimize Spend", "Conv-Optimizer"/"Conv Optimizer"→"Optimize Conversions" in optimizer legend/symbols (html ~840/849/850/854) + column tooltips (core.js ~2802/2814/2886/2892). Toggle labels were already correct. Changelog (592/610) + the `_isSpendOptimized`/`_isConvOptimized` identifiers left alone.
- **GK reverse-search floor:** extracted the forward `passes()` GK stability check into shared `gkSpendStable(res, overrides, baseInputs)` (core.js ~2242). Forward `optimizeSpend.passes()` now calls it; reverse `optimizeSpendDown.bestPassingStrategy()` now gates `res.totals.success && gkSpendStable(...)` (was success-only → GK self-cut → inflated "sustainable" spend). Repro (defaults, spend 900k, Optimize Spend on): reverse banner was GK $283,289 (held via cuts) → now honest **$155,813 IRA Draw ▼**.
- **Banner fix:** `renderSpendOptimizerBanner` reverse + increase branches now use `el.innerHTML` (was `textContent`, rendered the `<span style=color:#cc0000>🗘</span>` literally) and wrap the strategy label in a clickable `<span onclick="loadOptimizerResult(_id)">` → suggested strategy loads (verified: click → spendGoal 155813, strategy fixedpct). Symbols render as glyphs.
- Verified: node 47/47, in-page 212/212 (🟢), no console errors.

### Bug fix — stale derived displays after scenario load
- Symptom: loading a scenario that changes Assumptions:Growth left the "Real growth" line (`#growth-info`) stale.
- Root cause: `applyScenario` sets `.value` programmatically, which does NOT fire the `oninput` handlers that compute derived displays. It called runSimulation but not the display refreshers.
- Fix: after `applyScenario` sets fields, call the same refreshers the init sequence runs — `updateGrowthDisplay`, `syncMCMuFromGrowth`, `updateProfileAgeDisplay`, `refreshStratRateOptions`, `updateBracketFeedback`, `updateSuggestSpendTooltip`, `updateIRAGoalHint`, `updateCompAdvisory` (all typeof-guarded). Verified: applyScenario({growth:0.09}) → Real growth line updates 3.4%→6.4%. 212/212, no errors.

---

## Session: 2026-06-29 — Plan cleanup (worktree priceless-turing-9a5ad3)
Archived all completed phases into `task_completed.md`. Rewrote `task_plan.md` with only remaining work, renumbered P1–P18. Verified Phase 12 (withdrawal timing) complete via grep (`growthTiming` → v11.ecb auto early/late). Current: v11.10cf, branch main, clean worktree.

---

## Session: 2026-06-26 — Phase 38 UX/Charts batch (complete, v11.10a2, UNCOMMITTED, worktree epic-lalande-01685c)

User punch-list of 10 UX/logic items; scope chosen interactively (AskUserQuestion). Implemented 6,
deferred 4 (with design decisions captured). Plan: `~/.claude/plans/i-notice-a-few-dazzling-shamir.md`.

**Shipped (#1,2,3,4,7,8):**
- **#1 MC deflation floor** — `INFLATION_FLOOR=-0.01` const in `montecarlo/prng.js`; applied in
  `buildStressBank` (line ~97, was raw `infSrc[idx]` → leaked 1932's −9.9% into Stress mode AND the
  bootstrap bear-start overlay which copies the stress bank) and reused in `bootstrapMultiAssetBank`
  (already had the clamp). Verified all 3 bank builders now floor at −0.01.
- **#2 Mirror top scrollbar (Annual Details)** — table wrapped in `#tbl-scroll`; sticky `#tbl-top-scroll`
  strip with `#tbl-top-scroll-inner` spacer above it; `syncTopScroll()` sizes the spacer to
  `table.scrollWidth` + hides strip when nothing overflows; `setupTopScrollSync()` wires bidirectional
  scrollLeft sync; called from updateTable / updateColumnVisibility / showTab('tab-tbl') + init.
  GOTCHA found in browser: strip needs explicit CSS `height:16px` or browser suppresses its scrollbar
  and `scrollWidth` collapses to clientWidth.
- **#3** top Share bar `flex-end`→`flex-start`. **#4** Avg BETR wrapper `#stat-betr-wrap` hidden at init
  unless `NERD_KNOBS` (`?nerdknob`).
- **#7 Milestone overlay** — custom `milestonePlugin` (registered beside `crosshairPlugin`); draws
  dashed vertical + label for first death (status flip), first underfunded (delivered income < spend
  goal), IRMAA onset (IRMAA>0); `computeMilestones(log)`; checkbox `#chk-milestones`/`toggleMilestones`;
  DEFAULT ON (`showMilestones=true`).
- **#8 Income chart → 5 selectable views** (`setIncomeChartView` + `buildAltIncomeChart`): combined
  (existing inline), net (Income/Net/Spend-Goal lines), flows (household: SS+pension+draw up vs
  taxes+spend down), **tax**, **assetflows**.
  - *tax*: stacked components on LEFT primary axis (Federal=FedTax−capGainsTax, Cap Gains, State, IRMAA);
    MAGI + crossed thresholds on RIGHT axis. `computeTaxThresholdSeries(log,adj)` plots ONLY
    federal-bracket / IRMAA-tier boundaries MAGI CROSSES (below some year, ≥ another), inflated per year
    by cumulative CPI (`-cpiFactor`), per-year filing status, labeled `"22% bracket"` / `"IRMAA Tier 1"`.
    DEFAULT ON; `#chk-thresholds`/`toggleTaxThresholds` (shown only in tax view). Lines `order:0/1` over
    bars `order:3` so they're not hidden.
  - *assetflows* ("Earnings vs W/D"): per-account investment earnings stacked up (IRA via new `-iraG` =
    gains.IRA1+IRA2; Roth/Brokerage/Cash from existing *G fields), `netOut` withdrawals down, black
    "Net change" line = earnings − netOut. Roth conversions excluded (internal).
  - New chart-only log fields `-capGainsTax`(=p.tax.capitalGainsTax), `-cpiFactor`(=cpiRate cumulative),
    `-iraG`; leading-`-` so BOTH table header+body filters skip them → no stray Annual column (verified).
  - GOTCHA: in a `type:'bar'` chart, type-less `mkLine` datasets render as bars — needed explicit
    `type:'line'`.
  - Removed redundant lower-chart `<h4>Income and Expenses</h4>` (duplicated the first-tab label).

**Data references (Taxation thresholds):** `TAXData.FEDERAL[status].brackets[{l,r}]`,
`TAXData.IRMAA[status].brackets[{l,tier}]`; year value = `base.l * cpiFactor`; status ∈ {MFJ,SGL};
`p.tax.capitalGainsTax` separate from `federalTax` (ord+CG+NIIT); `applyGrowth` returns per-account
gains incl. IRA1/IRA2.

**Deferred (design decisions captured in plan + task_plan.md):** #6 keep checkbox column model for now;
#9 Cash Reserve = portion of Cash, breakable last-resort floor, refill from surplus; #10 Suggest Spend
Goal = guaranteed income + 5% assets; #5 first-run onboarding stepper.

**Verify:** node 47/47 + taxPaymentPlanner 12/12; in-page 212/212 🟢. Browser: all 5 views render,
threshold crossing filter correct (default MAGI 172–239k → only 22% bracket + IRMAA Tier 1 plot),
milestones+thresholds default on, lines over bars, no stray columns, no console errors. Files:
`montecarlo/prng.js`, `retirement_optimizer.html`, `retirement_optimizer_core.js`,
`retirementopt_styles_responsive.css`. NOT committed.
**Preview gotcha:** screenshot subsystem wedged mid-session (page stayed responsive to eval); recovered
after preview_stop/preview_start. Launch port bumped 8767→8771 in `.claude/launch.json` (untracked).

**NEXT:** commit + open PR for Phase 38; then deferred #9 (Cash Reserve) / #10 (Suggest Spend Goal) /
#5 (onboarding); #6 redesign later.

## Session: 2026-06-25 (cont.) — GK Optimize-Spend stability floor + MC Total Spendable (complete, v11.1097)

**Problem:** With Optimize Spend + Guyton-Klinger, optimizer reported an unnaturally high initial
spend (~$210k) sustainable only ~2 yrs before GK guardrails slash it. Root cause: GK mutates
`spendGoal` dynamically, and both gates the search relies on (`optimizeSpend().passes()` core.js:2131,
`totals.success` core.js:1723) measure the portfolio against that **already-cut** value → moving
goalpost → GK trivially passes at any initial → binary search runs to +50% ceiling.

**Fix A (GK stability floor):** Extended `passes()` (core.js ~2131) with a GK-only check
(`overrides.strategy==='gk'`): worst REAL delivered spend across horizon (`spendGoal/inflationFactor`)
must stay ≥ initial real × (1 − gkGuard). Rejects runaway initials. Non-GK untouched.

**Fix B (MC Total Spendable col):** Threaded `spendPerPath = totals.spendCurrentDollars` (real) →
`medianSpend` through worker.js + mc_controller.js (mirrors taxPerPath/medianTax); added 8th column
`Total Spendable` to MC table (mc_tab.js renderSurvivalTable + html grid template/header).

**Verify:** node 47/47 (+2 new GK optimize tests). In-page 212/212 🟢. Browser MC: 8 cols, Total
Spendable renders current-$ values. Browser optimizer w/ Optimize Spend: GK rows stay at baseline
$140k, **no $210k ceiling row** — runaway gone. Files: core.js, montecarlo/{worker,mc_controller,
mc_tab}.js, retirement_optimizer.html, core.test.js.

**Baseline ranking rework (v11.1098, same session):** baseline-pick (core.js ~2588) was `max(afterTaxNW)`
among no-conv successes → let GK win by hoarding (under-spend → bigger estate). Reworked to a blended
real-$ score `_baselineScore = afterTaxNWCurrentDollars + 1.10*spendCurrentDollars`
(SPENDABLE_WEIGHT const = 1.10; spendable favored +10%). Tried subtracting taxCurrentDollars then
removed it (both terms already after-tax → double-count; user pulled it). Browser: baseline flipped
GK→**IRA Draw** (4040k vs GK 4039k) — the +10% spend weight tips it since GK spends 140k less.
Deltas (_dNW/_dTax) unchanged. node 47/47, in-page 212/212.

**Reduce-N hypothesis checked + Score column (v11.1099):** User suspected aggressive low-N Reduce
underspends → demoted by new score. **Not confirmed** — Reduce-N spend is FLAT $3,111k for all N
(2→25); only terminal NW varies (N=2 → $342k, N=25 → $615k; low N pays drawdown/conv tax earlier).
So low-N ranks low on NW, not spend; +10% spend weight is neutral across Reduce-N. Baseline change
only re-pins ⚓, doesn't reorder the strategy table (still sorts by afterTaxNW). Added nerd-only
**Score** column to optimizer table (getOptimizerColumns, spliced after afterTaxNW when NERD_KNOBS;
grid auto-sizes via `columns.map(()=>'max-content')` — no manual count). Browser: nerd on → Score
present (IRA Draw 4,040,316); nerd off → absent. in-page 212/212.

## Session: 2026-06-25 (cont.) — GK label + Intl-CAGR NaN fix (complete, v11.1091)

Two small fixes after Phase 36:
- **GK label:** MC + Optimizer showed the Guyton-Klinger row param as generic `"guardrails"`. Now
  shows the actual knobs, e.g. `Grd:15 Adj:15`, built from `base.gkGuard`/`gkAdjPct` at both
  `push()` (MC variations, core.js ~:2256) and `addResult()` (optimizer ~:2419).
- **Intl CAGR = NaN% (MC bootstrap):** root cause = data-length mismatch. `HISTORICAL_RETURNS`
  equity/bonds/inflation were extended to **2025 (98 entries)** but `intl` still ends **2024 (55)**.
  A sampled block hitting idx 97 (year 2025) computed `intlSrc[55]` → `undefined` → `log1p(NaN)`.
  Strategy (`str=gk`) was incidental — bug is in `montecarlo/prng.js`, mode-independent. Fix: extend
  the existing pre-1970 equity-proxy to ALSO cover recent years with no intl data yet — guard
  `idx - intlOff < intlSrc.length` in both `bootstrapMultiAssetBank` and `buildStressBank`. No
  fabricated data. (Real 2025 MSCI EAFE point belongs to Phase 34.)
- **Cache-busting (so the fix reaches returning users):** `montecarlo/worker.js` now appends its own
  `?v=…` token (`self.location.search`) to every `importScripts` so prng.js/core.js refresh with the
  worker; HTML MC `<script>` tags bumped `?v=11eca`→`?v=111091` for the main-thread fallback path.
- **Files:** retirement_optimizer_core.js (2 GK labels), montecarlo/prng.js (2 intl-proxy guards),
  montecarlo/worker.js (importScripts cache-bust), retirement_optimizer.html (v11.1091 + changelog +
  script `?v=` bump).
- **Verified:** node **45/45**. Browser (http.server :8773, URL `?str=gk&gkg=15&gka=15`): bootstrap MC
  via worker → **Intl CAGR +8.3%, zero NaN**, completed 30s, no console errors; MC + Optimizer GK rows
  show **"Grd:15 Adj:15"**. Main-thread `bootstrapMultiAssetBank` also NaN-free (8.48%).

## Session: 2026-06-25 — Phase 36: Soft vs Strict Withdrawal Caps / large-shortfall fix (complete, v11.1090)

User repro: `?sg=160k&str=bracket&sr=22&d1=74&by2=1959&i1=2m&i2=1e5&ro=0&ro2=0` showed a shortfall
starting 2039 growing to ~$75k/yr by 2043 despite a $2M+ IRA. Root cause: `bracket`/`fixedpct`
capped IRA at the bracket ceiling and only gap-filled Cash→Brokerage→Roth — no IRA fallback — so
after person 1's death halved the bracket (MFJ→single, `:953`), the abundant IRA was stranded.
Survivor-SS step-up + filing switch were already correct (not an SS bug).

**Decision (user):** soft caps for tax-based ceilings, strict for ACA.
- **Soft (`bracket` Federal, `minlimit`/IRMAA, `fixedpct`):** new bounded convergence loop in
  `simulate()` (after the 3rd pass) draws extra IRA ABOVE the ceiling to fund mandatory spending
  when Cash/Brokerage/Roth are exhausted. Recorded in new `forcedIRA` (+`totals.forcedIRATotal`)
  and the recomputed `BracketOverage`. `fixed`/`propwd`/`baseline`/`gk` left unchanged.
- **Strict ACA → its own internal strategy id `aca`:** `getInputs()` derives `strategy='aca'` when
  `stratACAMultiple>0` (UI keeps ACA as a stratRate sub-option; legacy URLs/scenarios still load).
  ACA never breaks the FPL cap (subsidy cliff); leftover spending stays a shortfall, flagged via
  `acaBreach`/`totals.acaBreachYears`. Optimizer ACA rows now `strategy:'aca'`, marked untenable
  (`_isACAUntenable`, ⚠️) and hidden-by-default like infeasible bracket rows. `loadOptimizerResult`
  + `applyScenario` map `aca`→`bracket`+stratRate for the (option-less) strategy dropdown.

**Files:** retirement_optimizer_core.js (flags, convergence loop, getInputs derivation, log field
`ForcedIRA`, column/group/tooltip maps, optimizer flag+filter+row mapping); retirement_optimizer.html
(How-to split soft/strict, shortfall-row note, changelog, v11.1060→11.1090); README.md (ACA strict
rewrite, wishlist item resolved, Recent-Fixes entry); retirement_optimizer_core.test.js (+6 tests).

**Verified:** node **45 pass / 0 fail**; browser (http.server :8773) in-page **212 pass / 0 fail**,
no console errors. Repro: 2039-2045 shortfall→0 (forced IRA funds, overage flags); remaining
late-life shortfall is genuine full depletion (IRA=Cash=Brokerage=0 by ~2052 at age 93-98),
correctly `success=false`. ACA 400% FPL: forcedIRA=0, breachYears>0, untenable. Optimizer (startAge
60) shows "ACA Cliff … ⚠️" rows.

## Session: 2026-06-23 — Phase 33: Inflation-Aware Stress Test Scoring (complete, v11.1048+)

Stress mode was scoring worst decades by 10-year equity CAGR alone, missing the compounding effect of inflation. A decade with flat equity (+0% CAGR) but 7% inflation is retiree-devastating (real −7%), yet ranked better than it should. Fisher equation fixes this.

- **montecarlo/prng.js `buildStressBank()`:**
  - Changed scoring from nominal equity CAGR → real CAGR via Fisher equation: `rcagr = (1 + eqCagr) / (1 + Math.max(-0.005, infCagr)) − 1`
  - Deflation floor (−0.5%) excludes only 1930s extremes; preserves modern modest deflation (2009 etc)
  - Labels now 3-part format: `"1970 (eq: +6.0% inf: +7.0% real: -1.0%)"` instead of just year
  - Added `decadeRealCAGRs[]` to return object (mirrors existing `decadeInflCAGRs`)
  - `applyBearStartOverlay()` automatically uses new real-CAGR-based worst-sequence selection
- **montecarlo/{worker,mc_controller}.js:**
  - Added `stressRealCAGRs` to message payload alongside existing equity/inflation CAGRs
- **montecarlo/mc_tab.js `_renderStressChart()`:**
  - Chart legend now shows 4-part label: `"1970 (eq: +6.0% inf: +7.0% real: -1.0%)"`
  - Constructed from stressStartYears + stressDecadeCAGRs + stressInflationCAGRs + stressRealCAGRs
- **Tests:** 33 pass, 0 fail (no regressions)
- **Verified:** 
  - Real CAGR scoring orders decades correctly (Fisher equation)
  - 1970s-era high-inflation sequences rank higher in worst list (real purchasing-power loss captured)
  - Browser test: MC stress mode runs, chart displays 10 worst sequences with new labels
- **Status:** complete (ready for production)

---

## Session: 2026-06-22 (cont.) — Phase 32: Share-URL compression + default-omission (v11.1048)

New goal (user): reduce share-URL length. Measured: number/bool compression alone ≈13%;
default-omission ≈71–100% (scales with how customized the shared scenario is). Shipped both.

- **retirement_optimizer_core.js:**
  - `compactNum(numStr)` — shortest of {raw, k, m, b, scientific} that round-trips via
    parseShorthand (self-validating, no DisplayHelpers dep → node-testable as `ctx.compactNum`).
  - `OPT_DEFAULTS` + `captureDefaults()` — pristine snapshot of all `.sidebar input/select`,
    dollars normalized via `DisplayHelpers.parseShorthand`. Single source of truth for omission.
  - `buildShareURL()` — omits any field equal to its captured default; compresses dollar fields
    (numVal) via compactNum; booleans `true`/`false` → `1`/`0`.
  - `loadFromURL()` — checkbox accepts `'1'||'true'` (new + legacy). Dollar/absent-key decode
    unchanged (attachNumericDollarInput→parseShorthand handles `k`/`m`/`b`/`1e5`; absent⇒default).
- **retirement_optimizer.html:** `captureDefaults?.()` added before `loadFromURL?.()` (fields
  still at markup defaults). Version 11.1042 → **11.1048** + changelog entry.
- **retirement_optimizer_core.test.js:** load displayhelpers.js into vm ctx; 4 compactNum
  round-trip/length/spot/edge tests. **33 pass, 0 fail** (was 29).
- **Browser-verified** (http.server :8766): default scenario share query = **0 chars** (all 61
  params omitted, 61 defaults captured); 8-field customization → `?sg=120k&str=gk&sa=62&hs=0&i1=1.5m&ro=3e5&bk=650k&g=5`
  (52 chars), reloads to exact values; legacy raw URL (`i1=1000000&hs=true&dr=false`) loads
  identically. In-page suite **212 pass, 0 fail**, no console errors (4 errors are intentional
  bad-input test fixtures).
- **Caveat (documented):** omitted fields adopt the loader's current default — a future markup
  default change would silently shift old shared URLs for that field. Keep defaults stable.

---

## Session: 2026-06-22 (cont.) — Phase R (structural refactoring)

### Worktree `jolly-swirles-091689` (base af7841a / PR #85)
Critical look at program structure → refactoring roadmap (`.claude/plans/elegant-hopping-squirrel.md`).
Four smells targeted: `simulate()` god function (1095 lines), `window.*` pollution, no module system,
mixed concerns in core.js (sim math + 114 DOM calls).

### R1a — decompose simulate() (commit 7366f1f)
- Extracted 4 functions to module level: `resolveOrderedSeq(seq, rates)`, `runOrderedWithdrawal(...)`,
  `computeYearGrowthRates(inputs, y)`, `buildSimYearLogRecord(p)` (88-line log snapshot).
- `simulate()` shrank **1095 → 987 lines**.
- Gotcha: `resolveOrderedSeq`/`runOrderedWithdrawal` were nested closures reading 6 tax-rate vars
  implicitly → now passed via explicit `rates` object. `baseReturn` still needed in loop scope for GK
  `gkPriorReturn` — caught by 4 failing GK tests, re-added.

### R2 — OptimizerState (commit 293077f)
- 6 `window.optimizer*` globals → single module-level `OptimizerState` const. Pure rename, zero
  behavior change. All refs internal to core.js (verified — no external callers).

### Compatibility vs merged PR #86 (share-URL compress)
- #86 touched core.js ~4017–4125 (`compactNum`/`buildShareURL`/`loadFromURL`); my edits ~20, 626–1751,
  2007–2889. Disjoint. Clean auto-merge (exit 0). Tests on merged tree: **33/33** (my 29 + #86's 4).

### Tests: 33 pass, 0 fail post-rebase (29 mine + 4 from #86; behavior preserved). No version bump (no user-facing change).
### Pending (Phase R): R1-remainder (tax/gap-fill + surplus extraction), R3 (DOM→displayhelpers), R4 (ES modules).

## Session: 2026-06-22

### Phase 22 (Guyton-Klinger Guardrails) — complete (v11.1042, commit 4a7fec5)

Four GK rules in `simulate()`: Inflation Rule (skip CPI when prior return < 0 AND WR > IWR),
Capital Preservation (cut 10% when WR > IWR×1.2), Prosperity (raise 10% when WR < IWR×0.8),
default inflation advance. GK uses raw portfolio balance (`gkPrevPortfolio`) not tax-discounted
`totalWealth` — key design decision to avoid CA-tax apples-vs-oranges mismatch.

Files changed: `retirement_optimizer_core.js` (+66 lines), `retirement_optimizer.html` (+29 lines),
`retirement_optimizer_core.test.js` (+61 lines).

5 new tests (all passing, 29/29 total): stable market, CP rule, Prosperity rule, Inflation skip,
regression. Tests use CA state; check years 0-2 for stable (year 3+ natural depletion can approach
upper guard). CP/Prosperity tests use -80%/+200% return sequences.

URL: `gku=20&gkl=20&gkc=10&gkr=10`. Optimizer: 3 GK variations. Annual Details: gkSpend/gkAdj.

---

## Session: 2026-06-19 (cont.)

### Phase 31 (Baseline accounting for strategy comparison) — complete (v11.1000)

User concern: strategy comparison lacked a sound reference. "Strategy A beats B" is
meaningless without anchoring to the best plan that uses NO Roth conversions and NO brokerage
maneuvering. Also found the terminal-wealth valuation was biased.

- **retirement_optimizer_core.js:**
  - `simulate()` `totalWealth` (`:1476`) fixed: IRA × (1−nominalTaxRate), brokerage gains
    above basis × (1−**capitalGainsRate**) — previously both discounted at the ordinary rate.
  - Exposed `totals.terminal` {ira,roth,cash,brokerage,basis}, `totals.capGainsRate`,
    `totals.futureIRARate` (year-0 resolved).
  - New `afterTaxNetWorth(terminal, futureIRARate, capGainsRate)` helper.
  - `runOptimizer`: snapshot `baseFamilies`; after main+cyclic+spend+conv passes, a
    no-conversion sweep (`maxConversion:false, cyclicEnabled:false, extraConversionAmount:0`,
    tagged `(no conv)`). Baseline = max-afterTaxNW successful no-conv row → `window.optimizerBaseline`.
    Per-row `afterTaxNW`/`afterTaxNWCurrentDollars`/`_dNW`/`_dTax`.
  - `addResult` gained a `noConv` flag.
  - Columns: **After-Tax NW** (ranking metric), **Δ NW vs Base**, **Δ Tax vs Base**
    (signed, green/red). Winner `w6` = most after-tax NW. Default sort → afterTaxNW desc.
  - **Pinned ⚓ BASELINE row** (blue tint, sticky) at top of `#opt-table`; `#opt-best` gains
    "💎 Most After-Tax NW" + "⚓ Best w/o Conv".
  - **Sort fix:** failed plans now always rank below successful ones (a plan that runs out of
    money shows inflated terminal wealth). Found during browser verification.
- **retirement_optimizer.html:** version 11.fed → **11.1000**; changelog entry; column tooltips.
- **retirement_optimizer_core.test.js:** 6 new tests (afterTaxNetWorth math, terminal export,
  totalWealth cap-gains fix, zero-conversion run, baseline ordering). 24 pass, 0 fail.
- **Verified in browser** (python http.server :8766): in-page suite 209/209, no console errors;
  optimizer renders pinned baseline + After-Tax NW + Δ columns; default scenario baseline =
  "IRA Draw (no conv)" $1.26M, conversion strategies show signed deltas vs it.

### Phase 31 UX refinements — complete (v11.1001)

User feedback on the baseline-accounting UI:
- Dropped raw **Final Wealth** column (redundant with after-tax); renamed **After-Tax NW → NetWealth**,
  **Δ NW vs Base → ΔNetWorth**, **Δ Tax vs Base → ΔTax**. Removed the `nw`/finalNW winner ("Most Wealth")
  and the `simms` (⏱ms) column; opt-best winner now "💎 Most NetWealth".
- Added `title` tooltips to **every** optimizer column header.
- Pinned baseline row recolored blue → **light green (#d4f7dd)** so the dark ⚓ anchor stands out;
  added a baseline swatch to the Row-colors legend.
- **Infeasible rows hidden by default**; the legend's "Infeasible" item is now a click toggle
  (`toggleInfeasibleRows()`, `window.optimizerShowInfeasible`, `#opt-legend-infeasible`).
- **opt-perf** (sim time + run count) no longer nerdknob-gated — always shown, restyled from a loud
  yellow box to a subtle gray note ("⏱ Xms · N runs"); per-run ms dropped.
- Browser-verified: in-page 209/209, node 24/24, no console errors. Headers/tooltips/baseline tint/
  infeasible toggle (24 hidden → show/hide) all confirmed via DOM + screenshot.

### Phase 31 corrections — complete (v11.1001)

- **Baseline disables QCDs:** no-conversion sweep override now also sets `qcdHHMax: 0` — a true
  do-nothing reference. Verified: base qcd 1.25M (maxConv row) vs 0 (baseline).
- **ACA gating in optimizer:** new pure helper `bothOnMedicareAtStart(by1, startAge, hasSpouse, by2)`
  (shared with `updateACAWarning`). `runOptimizer` skips the ACA Cliff sweep when both persons are
  65+ at retirement start. Verified: 0 ACA rows (default both-65) vs 16 (startAge 60).
- **Baseline row color reverted** light-green → light-blue (#dbeafe); legend swatch reverted too.
- **opt-best "Best" column lightened:** label cells #4CAF50/white → #A5D6A7/#14532d (dark text) so the
  ⚓ shows; the per-metric data cells keep their brighter green.
- Verified: node 24/24, no console errors; both-65 baseline pinned blue, run count 176→160 (ACA gated).

### Plan sync to git — new worktree `goofy-chaplygin-27e560`
- Branch: `worktrees/goofy-chaplygin-27e560` (clean, no uncommitted changes)
- Reconciled plan with git log: **Phase 4 (QCDs) complete** — was marked pending but shipped.
  - Commits: 60fc49a (Phase 4 QCDs + summary bar fix, v12), 647c871/8f73707 (toggle polish), d1fa30f (2026 limit $111k, As-Needed tier fix), aba84f3/b6d8812 (docs, v11.fee).
  - PRs #79, #80 merged since last session. Also #76/#77/#78 (taxengine dynamic state dropdowns, Portfolio rename, withdrawal-rate fix).
- Current version: v11.fee.
- task_plan.md updated: Phase 4 → complete; Current Phase block refreshed; "As of" → 2026-06-19.
- Remaining unblocked: Phase 3 (Lumpy Spending), Phase 22 (Guyton-Klinger), Phase 29 (Creeping Tax), Phase 23b.
- No code changes this session yet.

## Session: 2026-06-11

### Phase 27 (Withdrawal Rate Fix + Inflows/Outflows) — complete

- **retirement_optimizer_core.js:** `_netAssetDraw`/`_netSpendPct` → `_grossOutflows`/`_netOutflows`/`_yearInflows`/`_wdRate`. Inflows = `fixedInc + pension` now subtracted from rate numerator. Log fields: `grossOut`, `netOut`, `inflows`, `wdRate%` (replaces `netSpend%`). `totals.avgWdRate` (replaces `avgSpendRate`). Column category map (`Summary`+`Withdrawals`), group defs, tooltips added. updateStats reads `avgWdRate` (element id `stat-avg-spend-rate` kept).
- **retirement_optimizer.html:** Label "Avg Spend Rate" → "Avg Withdrawal Rate"; new tooltip; version 11.ecc + changelog.
- **retirement_optimizer_core.test.js:** 5 Phase 27 tests (identity, SS-covers-spend, reconciliation, pension inflow, regression avg). 18 pass, 0 fail. Fix during dev: reconciliation test needed `extraConversionAmount` (bracket strategy w/o maxConversion produces no conversions).
- Browser verified: 207/207 in-page tests pass, no console errors; stat shows "Avg Withdrawal Rate 1.2%"; default scenario wdRate ~6.5% pre-SS, flips to −1.9% when SS starts (correct new behavior); grossOut/netOut/inflows/wdRate% columns render and reconcile.

### Context restore — new worktree `frosty-goldwasser-112138`
- Branch: `worktrees/frosty-goldwasser-112138` (clean, no uncommitted changes)
- Since last session: PR #77 merged (rename "Portfolio" field), PR #76 (taxengine.js dynamic state dropdowns + per-state notes across all tools)
- No new code changes this session yet

## Session: 2026-06-10

### Phase 12 (Withdrawal Timing) — complete

- **retirement_optimizer_core.js:** `growthRates` definition moved to top of year loop. Per-year timing auto-selection: `_stratImpliesConversion` flag (year 0) + `log[y-1].rothConv > 1000` look-back (year 1+) → `yearTiming = 'early' | 'late'`. `applyGrowth(balance, growthRates, preMonths)` before withdrawal block; `applyGrowth(balance, growthRates, postMonths)` after. `preGains` merged into `gains` for display stats. `timing` field added to `log.push()` → `'Early(Conv)'` or `'Late(Spend)'`.
- **Column groups:** `'timing'` added to `columnCheckboxMap` (`['Summary', 'Withdrawals']`) and `columnGroupDefs` (`'Withdrawals'`). Tooltip added to `updateTable()`.
- **retirement_optimizer.html:** Version 11.ecb. Changelog entry for Phase 12.
- **retirement_optimizer_core.test.js:** 5 new Phase 12 tests (bracket→Early, propwd→Late, extraConv propagation, IRA-depletion transition, format validation). 13 total tests pass.
- Verified in browser: `Late(Spend)` for propwd, `Early(Conv)` for extraConversionAmount runs, correct transition after IRA depletes.
- Timing column at TD index 66 in Annual Details.

---

## Session: 2026-06-09

### Phase 28 (SoRR Stress Mode) + UX polish — complete (PR #74)

- **mc_tab.js:** `_makeLegendClick()` — click isolates one line/band group; second click restores all. `_stressColorMulti()` — per-family hue + rank-based opacity for multi-strategy stress. Stress labels now `1929 (eq: -1.7% inf: -2.0%)`. Chart description updated.
- **prng.js:** `decadeInflCAGRs` added to `buildStressBank` return.
- **worker.js / mc_controller.js:** `stressInflationCAGRs` in postMessage/onComplete.
- **retirement_optimizer.html:** changelog 11.ec9 + version bump.

### Phase 9 (ACA Refinement, partial) — in progress

- **retirement_optimizer_core.js:** `updateACAWarning()` — computes both persons' ages at retirement start; disables ACA FPL options + shows "both on Medicare" message when both ≥65; shows advisory-only warning when exactly one ≥65. Triggered from `updateProfileAgeDisplay()`, `refreshStratRateOptions()`, and `startAge` oninput.
- **retirement_optimizer.html:** `#aca-age-warn` div inside `#ui-bracket`; `updateACAWarning()` added to `startAge` oninput.
- Browser-verified: all three cases (both Medicare, one Medicare, neither) work correctly.
- Next: full Phase 9 (ACA MAGI calculation, premium estimate, subsidy cliff warning in Annual Details).

### Phase 30 (GBM mu sync from Assumptions growth) — complete

- **mc_tab.js:** `syncMCMuFromGrowth()` one-way sync on page load + growth oninput + mode switch to GBM. `updateMCGrowthWarning()` mirrors >10%/<3% warnings from Assumptions section.
- **retirement_optimizer.html:** mc-mu label "GBM Return μ %"; tooltip clarified; note "synced from Growth %"; `<div id="mc-mu-warn">` added. `syncMCMuFromGrowth()` + `updateGrowthDisplay()` called in DOMContentLoaded.
- Cache bust: added `?v=11ec9` to all 4 MC `<script src>` tags (was necessary — browser served stale mc_tab.js despite on-disk fix).
- Supersedes Phase 8 investigation phase for this sub-case.

### Growth rate UX (nominal/real display + warnings) — complete

- **retirement_optimizer_core.js:** `updateGrowthDisplay()` — Fisher equation real rate inline below growth/inflation inputs; >10% optimistic warning; <3% pessimistic warning.
- **retirement_optimizer.html:** growth input tooltip (nominal rate, US historical ranges, don't subtract inflation); `oninput="updateGrowthDisplay(); syncMCMuFromGrowth()"`; inflation `oninput="updateGrowthDisplay()"`; `<div id="growth-info">` inserted between growth and inflation rows. How To item 4 expanded with nominal vs real explanation, Fisher equation, historical ranges, Current $ toggle.

### Phase 28 (SoRR Stress Mode) — complete

- **prng.js:** `buildStressBank(count, years)` — deterministic worst-N sequences scored by first 10yr equity CAGR; wraps history for long plans.
- **worker.js / mc_controller.js:** stress mode branch (mirrors bootstrap); overrides numPaths = stressCount; per-path trace capture (`stressPaths`); returns `stressLabels`, `stressStartYears`, `stressDecadeCAGRs`.
- **mc_tab.js:** stress chart = spaghetti of labeled individual lines (dark red → amber gradient); single variation selected by default; updated metrics bar + table title + chart description.
- **retirement_optimizer.html:** "Stress (worst sequences)" option in mode dropdown; nerd panel "Stress sequences" input (3–20, default 10); added `mc-chart-desc` id.
- **retirement_optimizer_core.js:** guarded `document.addEventListener` — fixes pre-existing worker crash (all MC was falling back to main thread).
- Worst 10 sequences (default): 1929, 1999, 2000, 1930, 1928, 1931, 1965, 2001, 2002, 1969.
- Tests: 207 pass, 0 fail.
- Phase 8 (Variable Growth): largely covered by existing bootstrap MC; sensitivity grid (Mode 1) deprioritized.

---

## Session: 2026-06-08

### Plan updated — 4 new phases added (user direction)
- Added Phase 27: Withdrawal Rate Fix + Inflows/Outflows columns in Annual table
- Added Phase 28: Bad Markets / SoRR Stress Mode (Bear-Start bootstrap + historical scenarios + CAPE preset)
- Added Phase 29: Creeping Tax Rate (TCJA expiration cliff + annual rate escalation)
- Added Phase 30: Verify GBM uses user growth rate (investigation first)
- Added SoRR and tax policy research notes to findings.md
- No code changes this session yet

---

## Session: 2026-05-27

### Phase 0: Planning & Context
- **Status:** in_progress
- **Started:** 2026-05-27 (initial)
- Actions taken:
  - Read BootstrapPlan.md (Monte Carlo improvements framework)
  - Read optimizer_directions.md (feature priority list A–R)
  - Created consolidated task_plan.md (11 phases total, later expanded to 12)
  - Created findings.md (research + decisions)
  - Identified blockers: Phase 1 (bracket fix) unblocks strategy comparisons
  - Added Phase 9 (ACA limit age-gating at 65+) — requires Phase 1, blocks Phase 10
  - Updated Phase numbering: Multi-strategy is now Phase 10, regime-switching Phase 11, quarterly Phase 12
  - **Brainstormed Phase 1 bracket fix approach:** Binary search all bracket options to find max feasible spend per bracket
  - **Expanded Phase 1 tasks:** Added `calculateMaxSpendPerBracket()`, real-time bracket UI feedback, adopt-spend flow
  - **Refined Phase 1 UI:** Replaced modal approach with inline feedback (brackets + spend input + real-time status). User can override constraints; Annual Details shows impact
- Files created/modified:
  - task_plan.md (created, updated with Phase 9, expanded Phase 1 details)
  - findings.md (created, added ACA constraint section, Phase 1 binary search approach)
  - progress.md (created, this file)

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Planning files exist | Check cwd | task_plan.md, findings.md, progress.md | Created | ✓ |
| BootstrapPlan.md readable | Read file | 208 lines, phases 1–3 defined | Read OK | ✓ |
| optimizer_directions.md readable | Read file | 229 lines, priorities A–R | Read OK | ✓ |

## Session: 2026-05-28

### Phase 7: Historical Inflation Bootstrap + CAGR Stats — complete

- **prng.js:** `bootstrapMultiAssetBank()` extended to return 4th bank (inflation). Expanded history window from 55 years (1970–2024) to full 97 years (1928–2024). Pre-1970 intl proxied with equity return.
- **worker.js / mc_controller.js:** Build `inflationSequence` per path from `multiAssetBank.inflation`; pass to `simulate()`. Replaced arithmetic median sort with single-pass CAGR (`exp(mean(log(1+r))) - 1`) for all 4 asset classes. `inflationStats` now uses `.cagr` key.
- **retirement_optimizer_core.js:** `yearInflation = inputs.inflationSequence?.[y] ?? inputs.inflation`; used in spend-goal escalation and inflation accumulator. GBM/file:// fallback unchanged.
- **mc_tab.js:** Column header "Median" → "CAGR". `iS.median` → `iS.cagr` in inflation row. `deflate()` uses `inflationStats?.cagr`. Fixed Current Dollars toggle (`renderMCChart` call in `updateCurrentDollarsView`). Fixed path-count ID (`mc-path-count-tbl`). Fixed bootstrap mode gray-out (`updateMCModeUI()` in `mcTabActivated()`).
- **retirement_optimizer.html:** "GBM (parametric)" → "Synthetic (parametric)". Updated mode description note.

### MC UX + Optimizer fixes — complete

- **mc_tab.js:** Strategy table: removed colgroup/fixed widths, all columns right-aligned, Max Conv moved before Strategy, Survival moved to rightmost, "Funds Exhausted" → "Exhausted", "Max Conv" header → "Max". Chart default changed to best-per-family (one line per strategy family, highest survival+balance tiebreak); current strategy's family overrides to exact current-settings variation.
- **retirement_optimizer.html:** `optimizeSpend` checkbox now has `onchange` — re-runs optimizer immediately if tab visible, else clears hash so next tab click re-runs.
- **retirement_optimizer_tests.js:** 3 `inflationSequence` regression tests added (inf-1/2/3).
- **retirement_optimizer.html:** Version bumped to 11.df0 with changelog entry.

## Session: 2026-06-01

### Phase 20: Roth Conversion Opportunity Cost — complete

- **retirement_optimizer_core.js:** Shadow delta vars (`convShadowDeltaIRA/Taxable`, `excessShadowDeltaIRA/Taxable`) init before year loop.
- **retirement_optimizer_core.js:** After `surplus.Cash` set each year — compute incremental taxes via shadow `calculateTaxes()` calls (true marginal method, not proportional). Update shadow deltas.
- **retirement_optimizer_core.js:** After `applyGrowth` — grow shadow deltas at IRA rate (conv/excess) and blended Brokerage+Cash rate (taxable).
- **retirement_optimizer_core.js:** After Roth credited — compute `convNetValue` / `excessNetValue` using user formula. Find `convBEYear` / `excessBEYear` after loop.
- **retirement_optimizer_core.js:** Log fields: `convOC`, `excessOC`, `convTax`, `excessTax`. Column category map + group defs + `getActiveCategories()` updated for `'Opp. Cost'`.
- **retirement_optimizer_core.js:** `getInputs()` now reads `futureIRATaxRate` (% → decimal; blank → undefined → defaults to current marginal rate).
- **retirement_optimizer_core.js:** `updateStats()` populates `stat-conv-be`.
- **retirement_optimizer.html:** `futureIRATaxRate` input near Max Conversion. `cat-oppcost` checkbox in column filter. `stat-conv-be` in summary stats bar. Version 11.e4f + changelog.
- **Verified:** 186 tests pass, 0 fail. `convOC`, `excessOC`, break-even years all computed live (conv BE=2047, excess BE=2049 on default inputs).

## Session: 2026-06-02

### Phase 19: URL Parameter Compression — complete
- **retirement_optimizer_core.js + retirement_optimizer.html:** Short-key alias map implemented; `loadFromURL` accepts both long + short keys (backward compat). `generateShareURL` emits short keys. 57% URL reduction (1100 → 468 chars).
- **RetirementTaxPlanner.html + IncomeTaxPlanner.html:** Same alias approach applied. Share panel popup standardized across all tools.
- **ITP → RTP cross-link:** Button in IncomeTaxPlanner opens RetirementTaxPlanner pre-populated with matching values.
- **Tax planner bug fixes:** included in commit 440665f (v11.e52).
- **Plan items 21 + 22 added to roadmap:** BETR (Phase 21) and Guyton-Klinger (Phase 22) documented in task_plan.md.

## Session: 2026-06-02 (continued)

### Phase 21 (BETR) + Phase 23 (Conversion Optimizer) — complete (core)

- **computeBETR():** Kitces formula `t_now × (1+r_taxable)^n / (1+r_ira)^n`. Formula correction: plan had `1 − t_now×(...)` — wrong.
- **BETR in simulate():** per-year `BETR%` and `betrFlag` (▲/≈/▼) in log; `totals.betrAvg`; displayed as `stat-betr-avg` in stats bar.
- **extraConversionAmount in simulate():** scalar or per-year array; IRA→Roth extra conversion after spending block; marginal tax recalculated.
- **optimizeConversionAmount():** $25k sweep finds optimal extra conversion per strategy (67ms; $150k/yr adds $773k wealth on $2M IRA scenario).
- **Conv Optimizer toggle:** opt-in checkbox; sweeps top-5 strategies; adds 🔁 rows with Opt Conv/yr + Conv Savings + Avg BETR columns.
- **Projected RMD stat:** `updateProjectedRMDStat()` with SECURE 2.0 ages and IRS ULT table; `stat-proj-rmd1/2` in scrollable stats bar.
- **Tests:** 199 pass, 0 fail (13 new).
- **Deferred (Phase 23b):** greedy DP per-year schedule; MC Stage 2 top-K validation.

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| | | | |

## Session: 2026-06-06

### Context restore — new worktree `hardcore-wozniak-4c1c7d`
- Branch: `worktrees/hardcore-wozniak-4c1c7d` (clean, no uncommitted changes)
- Last merged: PR #67 (MC tables → CSS grid), PR #65 (MC mode selector always visible + auto re-run)
- Tests: 199 pass, 0 fail (last confirmed 2026-06-02)
- No new code changes this session yet

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | At v11.1287 (PR #122 open: PF9 + PF10; PR #121 landed the orphaned RealReturns gold wiring). P15 refactor complete. node 73/73, browser 240/240. |
| Where am I going? | PF11 (Optimize Conversions candidate pool — top-5-by-finalNW misses the families that convert well; 3 tiers scoped, needs a tier decision). Then P2 Cash Reserve, PB Lumpy Spending, PC Auto-Persist, P16 responsive, P19 state coverage (13 states). |
| What's the goal? | Implement remaining features from optimizer_directions.md priority list |
| What have I learned? | Roth conversion mechanics are two structurally different things: surplus routing is a pure reallocation (no tax netted), Extra Conversion is a real new withdrawal (gross minus its own marginal tax). Cash-funding only applies to the latter, or via an explicit gross-up (`conversion × t/(1-t)`) for the former. Shadow tax calcs are additive vs subtractive depending on whether the slice is already inside `yr.totalTax` — picking wrong silently corrupts results. Optimizer row fields must record effective `inputs`, never raw `overrides`. |
| What have I done? | All core Roth conversion work done (20→21→23), plus PF5–PF10 Break Even/conversion corrections. MC engine mature. URL sharing polished. Quickwins (3,4,8,12,22) still open. |

---
*Update after completing each phase or encountering errors*

## Session: 2026-07-10 (worktree mystifying-babbage-559d99)
- Audited P19 against code: commit d52ffac (2026-07-07) completed 5 of 6 remaining items (findBracketIndex dedup, return-alias unification, computeIrmaaInline deleted, irmaa_and_rmds.html reuse + 12x surcharge fix, load order). Only state coverage (13 states) still open. task_plan.md updated.
- Assessed P15: all three items (R1b/R3/R4) still open. simulate() regrew to ~1,110 lines (core.js:884-1994); core.js 6,132 lines / 139 getElementById; displayhelpers.js a 163-line stub; worker.js still importScripts. Recommended order R3 -> R1b -> R4. task_plan.md P15 section updated with fresh counts. Next session: start P15 work.

## Session: 2026-07-10 (worktree planning-with-files-328afe)
- Context restore: PR #114 merged (P15 R3 complete, v11.11f3). Files renamed (dropped retirement_ prefix); optimizer_core.js now pure engine (0 getElementById, ~2,170 lines, simulate :778-1894), optimizer_ui.js holds all 139 getElementById (3,588 lines). task_plan.md P15 updated: R3 checked off, remaining R1b (simulate ~1,117 lines) + R4 (worker.js:8 importScripts).

## Session: 2026-07-10 (worktree planning-with-files-328afe, continued) — P15 R4 + R1b
- PR #115 (branch planning-with-files-328afe): R4 dual-mode exports. UMD guards in taxengine.js (12 symbols engine references), optimizer_core.js (adds optimizeSpend/compactNum/afterTaxNetWorth), displayhelpers.js; test harness vm.runInContext -> require() with Object.assign(globalThis, taxengine) before requiring the engine. Worker importScripts untouched, zero HTML changes.
- PR #116 (branch planning-with-files-328afe-r1b, stacked): R1b full phase decomposition, v11.11f8 -> v11.11ff. simulate() 1,117 -> ~215 lines; loop = 16-line phase-call sequence over sim/yr state objects. 12 commits (2 rename-only conversions via scripted string/comment-aware identifier transform + shorthand pre-expansion; 9 bottom-up verbatim extractions; 1 dead-code removal: currentTaxableGuess, marginalTaxRate, shadowed outer tax).
- Verification: 22-fixture golden harness (scratchpad golden_diff.js, JSON byte-compare, perf stubbed) green after EVERY commit; node 60/60 + 12/12 each commit; browser 240/240, runSimulation, optimizer, MC worker (identical sampled stats), Retirement_Projection/IncomeTaxPlanner/irmaa_and_rmds zero console errors.
- Gotchas hit: \r line endings break JS regex `$` with `.+` (split(/\r?\n/)); destructuring ASSIGNMENT at computeBracketCeiling call needed renamed-target form; withdrawals/netWithdrawals alias preserved as yr.netWithdrawals = yr.withdrawals; resolveHousehold break -> boolean return.
- P15 now fully complete pending merges. Remaining plan work: P2 Cash Reserve, PB Lumpy Spending, PC Auto-Persist, P16 responsive, P19 state coverage.

## Session: 2026-07-15/16 (worktree mystifying-babbage-559d99) — PF9 + PF10, PR #121/#122
- **PF9 (v11.1271, PR #122):** user reported 4 issues testing PF8. (1) GK + Optimize Conversions suggested a $575k/yr conversion -> `optimizeConversionAmount()` never applied `gkSpendStable()`, the guard `optimizeSpend`/`optimizeSpendDown` already use; GK "affords" any amount by slashing future spend and finalNW rewards the under-spending. Gated the sweep. (2) Extra Conversion ignores IRA Goal -> user chose docs-only (a conversion moves money IRA-to-Roth, not out of the household). (3) Break Even hard to hit -> kept PF6's strict definition (user's call), added `diagnoseConvBreakEvenFailure()` pinpointing WHICH conversion year breaks the lead. (4) RealReturns gold "gone" -> git archaeology: `gh pr view 119` showed PR #119 merged only `fcf4161` (data); the UI-wiring commit `0de2d5d` was pushed AFTER the merge and never landed. Cherry-picked as PR #121.
- **PF10 (v11.1287, PR #122):** user asked why a $20k Extra Conversion only converts $13,740. Their hypothesis (enable Maximize Conversions) was wrong -- traced phase order, the two mechanisms never interact. Real cause: the field is a GROSS withdrawal whose marginal tax is netted out. Bigger insight the user drove: **neither mechanism actually "maximized" anything**. Split `maxConversion` -> `convertExcessToRoth` + new `fundConversionWithCash`; new `applyConversionGrossUp()` implements the user's formula `increase = conversion × t/(1-t)`.
- **Two planning passes produced wrong designs; hand-tracing and browser testing caught both.** (a) First Plan agent proposed `cfRefundIRA`-style gross-up on `conv1`/`conv2` as a "TAX GAP fix" -- false premise, that path nets out no tax at all. Discarded, comment rewritten. (b) A real interaction bug survived both agents: both mechanisms mutate `yr.totalTax`, so the second subtracted a baseline containing the first's tax while its shadow calc excluded the first's income -> understated ~43% ($3,635 vs $6,346). Fixed via shared `yr._extraIRAIncome`; regression test verified to FAIL when the fix is reverted (not just pass).
- **Round-2 (user testing):** nerd-mode Optimizer sweeps `fundConversionWithCash` independently (176->220 rows, base rows forced false or the arms collapse); "Use Cash" label (old one broke the toggle knob); Break Even ⓘ auto-computes (measured 43ms worst case vs 53ms for one runSimulation -- eager is free); Optimize Conversions defaults ON; docs/changelog corrected.
- **Second instance of the PF8 load-strategy bug class, self-inflicted:** optimizer rows recorded `overrides.fundConversionWithCash`, but outside nerd mode the flag is inherited from `base`, so rows claimed false while their sim used true. Record `inputs.*` (post-merge), never `overrides.*`.
- **Verification:** node 67/67 -> 73/73; browser 240/240 throughout; the user's exact $13,740 reproduced then $20,000 with the flag on (totalTax identical -- funding source only). Share round-trip, legacy `maxConversion` migration, and optimizer-row round-trip all verified live.
- **Gotchas worth remembering:** moving a shareable control out of `.sidebar` breaks Share silently (buildShareURL stops emitting, loadFromURL keeps restoring) -> `SHARE_INPUT_SELECTOR`; flipping a checkbox default inverts which state is URL-omitted (verify `copt=0` still emits); tooltip map lookup is case-sensitive and fails silently (an audit script found a 2nd dead tooltip beyond the reported one); `sed -i` on this repo is safe for renames (git autocrlf normalizes) but verify diff sizes stay proportional.
- **Left open -> PF11:** Optimize Conversions' top-5-by-finalNW candidate pool misses the families that benefit from converting. Empirically: top-5 all returned `optConv: 0` (correctly -- conversions hurt them) while `propwd` at rank 6 returns $125k and is never considered. Defaulting the feature ON made this everyone's problem; changelog/docs now disclose it, but the pool limitation is real and unfixed. Three tiers scoped in task_plan.md PF11.

# Task Plan: Retirement Optimizer — Remaining Work

Goal: Complete open features from the original priority list plus deferred items from the UX batch. All completed phases archived in `task_completed.md`.

**As of:** 2026-07-17 (worktree mystifying-babbage-559d99, v11.129d)

---

## Phase PF13 (DONE, v11.12ea): Optimizer ranking rework + Annual Details / feasibility fixes
**7-item batch, 2026-07-20.** User decisions collected via AskUserQuestion before implementing.
- [x] **Item 5+6 — objective-driven ranking (the big one):** the "Optimize for" selector now re-orders the whole table body (was: only re-picked the ⚓ baseline + Rank column; body stayed on afterTaxNW). Implemented via a `sortState.colKey === '__objective__'` sentinel (default) that orders the body through `rankRowsByObjective`; a header click switches to that column; changing the objective resets to the sentinel. Ranking engine moved to `optimizer_core.js` (`OPTIMIZER_OBJECTIVES` + `rankRowsByObjective(rows, objKey, rate)`, pure/testable, rate-parameterized); labels stay in UI (`OPT_OBJECTIVE_LABELS`). **Selector now visible to ALL users** (un-gated from nerd). **New objective set, default = Tax Flexibility:** taxflex (two-stage: among plans within 10% of best after-tax NW, the one whose 3 after-tax buckets — pre-tax IRA net / Roth / taxable net — are closest to equal; a drained-to-zero plan fails the wealth cutoff), networth, widowrmd (min `rmdTax + terminal.ira × rate`), mintax, maxspend, maxroth, balanced, conveffect, earliestbe. `OptimizerState.sharedFutureIRARate` stored each run for the rate-dependent metrics.
- [x] **Item 1:** `rothConv` added to the `'Opp. Cost'` column category — shows in Annual Details when the Opp. Cost view is on.
- [x] **Item 2:** `#opt-best` "Best" winners now picked from `feasibleSuccesses` (excludes `_isBracketInfeasible`/`_isACAUntenable`) — a ⚠️ row can no longer win a metric / show green in the Best table.
- [x] **Item 3:** new pure `eitherOnMedicareAtStart` in core (OR sibling of `bothOnMedicareAtStart`); ACA rows flagged untenable when either spouse is on Medicare at start (their RMDs/SS blow past any FPL cap) — so all four FPL levels flag, not just the hardcoded 400%. Static `⚠️` removed from the 400% label; untenable tooltip covers the Medicare reason.
- [x] **Item 4:** removed the redundant nerd-mode Score column (row order conveys the ranking); Rank column kept.
- [x] **Item 7:** shortened the PF11 empty-conversion banner.
- [x] **Round 2 (user follow-up):** two controls promoted out of nerd-knob gating because they are not experimental — the **Optimizer Rank column** (it is the readout for the "Optimize for" choice, which every user can now set) and the **Maximize Conversions sub-switches** (`#convAdvanced-wrap`: Convert Excess to Roth / Use Cash — two financially distinct decisions, not a preview knob). Both un-gated in `applyNerdKnobVisibility` (set to a literal display, so a runtime nerd toggle can't hide them) plus the HTML default. **All nerd-knob references removed from the changelog** (nerd knob is a pre-release preview control for experimental features and should not appear in release notes); the tooltip/Docs text that un-gating made false was rewritten ("Turn on nerd knobs to control the two independently" -> "Use the two switches below it"). Remaining nerd references live only outside the changelog and describe features that ARE still gated (MC Simulation Parameters panel, the 💵 optimizer sweep dimension).
- **Verify:** node 90/90 (+6: rankRowsByObjective per objective incl. taxflex two-stage + negative-NW cutoff, widowrmd, eitherOnMedicareAtStart), taxPaymentPlanner 12/12. Browser (v11.12ea): selector visible without nerd + default Tax Flexibility; each objective reorders the body (DOM ids matched `rankRows` exactly for mintax); nerd → no Score, Rank present; ACA scenario (self 62, spouse 74) → all 20 ACA rows ⚠️ untenable; Best table has zero ⚠️; rothConv category includes Opp. Cost; Medicare trigger true here / false for a young couple; only the 4 pre-existing intentional bad-input console fixtures.
- **Not byte-identical:** default table order + ⚓ baseline change for everyone (objective default balanced→taxflex). Engine `simulate()` untouched → single-scenario/Annual/MC/TaxPlanner bit-identical.
- **Status:** DONE, PR opened (PF11 + PF13 together). **Files:** `optimizer_core.js`, `optimizer_ui.js`, `optimizer_core.test.js`, `retirement_optimizer.html`.

---

## Phase PF12 (DONE, v11.129d): Accurate IRA-withdrawal accounting + prefer-larger conversion sourcing
**Why:** User's `eca=150k`+`fcc=1` scenario showed a 150k Roth conversion in a $0-strategy-draw year and "converted more than withdrawn." Engine math conserves (per-year IRA balance reconciles to $0); the defect was incomplete per-account accounting — `applyExtraConversion`/`applyConversionGrossUp` mutated aggregates but not the granular log fields, so IRA WD columns omitted conversion pulls and Fed/State tax omitted conversion tax. Load-bearing because year-click feeds RetirementTaxPlanner.html.
- [x] **Behavior change (user decision):** conversions now source from the **larger IRA** first (spill to smaller only when it can't cover), via new `splitPreferLarger()` in `optimizer_core.js`. Applied to the additional pulls (extraConversion + gross-up); `convertExcessToRoth` reallocation stays proportional (already ~larger-weighted, attribution must match its proportional debit). **Not byte-identical:** combined yearly `totalTax` unchanged, but IRA1-vs-IRA2 split → per-spouse RMDs → long-run totals shift.
- [x] **Data:** engine logs per-account decomposition (`iraVolSpend1/2` spending draw, `iraConvGross1/2` gross converted). `IRA1-/IRA2-` = voluntary total (spending + conversion gross, excl RMD); `IRAwd` = sum; hidden `-iraVolSpend*`/`-iraConvGross*`/`-iraSpend`/`-iraConvGrossTot`. RMD stays involuntary in its own columns.
- [x] **Tax:** conversion tax attributed into `yr.tax.federalTax/stateTax` (extra conv exact from `_exTaxCalc`; gross-up marginal-proportional). Only readers are the log record → no sim feedback. `Fed+State+IRMAA == totalTax`; Taxation chart auto-fixed.
- [x] **Handoff:** `openTaxPlanner` passes true per-IRA voluntary + conversion gross + accurate Fed/State (removed dump-onto-larger hack and `IRA1- − RMD1-` imprecision).
- [x] **Charts:** income-composition views use `-iraSpend`; Inflows/Outflows left as-is (already conversion-inclusive + balanced; deeper redesign deferred per user).
- **Verify:** node 77/77 (+4). Browser (user's URL): `IRAwd` 0→150k all from larger IRA, `rothConv≤IRAwd`, tax reconciles (65,234), Taxation chart correct, handoff accurate, all chart views build, badge 🟢, no errors.
- **Status:** MERGED (PR #123, commits `7956b76` + `1fa2043` tooltip follow-up, v11.129e). **Files:** `optimizer_core.js`, `optimizer_ui.js`, `retirement_optimizer.html`, `optimizer_core.test.js`.

---

## Phase PF11 (DONE, v11.12e5): Optimize Conversions candidate pool — family-diversified, _baselineScore-ranked
**Implemented 2026-07-20.** User chose (AskUserQuestion): pool rule = **best-per-strategy-family** (not a broadened top-N); scoring metric = **`_baselineScore`** for both the pool ranking AND the sweep's internal objective; cost = **measure first**.
- [x] **Step 0 (measured, node, JIT-warmed):** sweep cost = `ceil(totalIRA/25000)+1` sims/candidate, prediction confirmed exactly (17 / 81 / 201 at $400k / $2M / $5M). At the $2M benchmark, 12 candidates ≈ 835 ms / ~1184 runs — under both triggers (2.5 s, 1500 runs), so NO coarse-to-fine built. **Follow-up trigger recorded:** $5M+ IRAs cross the run budget (~2624 runs) → open a coarse-to-fine ($100k coarse then $25k refine) phase if a user hits it.
- [x] **`optimizer_core.js`:** hoisted `SPENDABLE_WEIGHT=1.10` to a module const (single source shared with the UI table); new pure `baselineScoreOf(res, futureIRARate, spendableWeight)` (= afterTaxNW/inflationFactor + weight×spendCurrentDollars, algebraically identical to the UI's `_baselineScore`); new pure `selectConversionCandidates(rows, maxPool=12)` (best row per `strategyKey|cyclicKey` family, ranked, capped — `bracket` splits on `_stratIRMAATier` sign into bracket-rate vs bracket-irmaa; cyclic is its own dimension; ✦/no-conv/infeasible/untenable excluded); `optimizeConversionAmount` gained a 4th `opts` arg + `'baselineScore'` metric (existing 3 modes + 3-arg callers untouched). Exports updated.
- [x] **`optimizer_ui.js`:** extracted `_scoreRows(rows, sharedRate)`; hoisted `sharedFutureIRARate` above Phase 23 and score rows before the pool selects; replaced the flat top-5 with `selectConversionCandidates`; sweep now called with `'baselineScore'` + the shared rate; second `_scoreRows` after Phase 23 for the new ⇌/no-conv rows; run-scoped `convOptCandidateCount`/`convOptRowsAdded` counters (reset each run).
- [x] **Empty-state:** new `#opt-conv-banner` + `renderConvOptBanner()` — when candidates>0 but 0 rows improved, states plainly that converting more doesn't help this plan (was a silently-empty table).
- [x] **Tests:** 7 new (84/84 total). T2 is the required regression guard (a fixture where 5 cyclic-fixedpct rows outrank a 6th propwd row; asserts the pool keeps propwd and ≤1 cyclic — a flat top-N fails both). T6 encodes the defect at engine level (a scenario where `finalNW`→$0 but `baselineScore`→$50k). Expected values derived from the real engine first, then hard-coded.
- **Verify:** node 84/84 + taxPaymentPlanner 12/12. Browser (v11.12e5, $2M/$90k): 12 candidates → 3 ⇌ rows from 3 DIFFERENT families incl. **Proportional (propwd)** — the ticket's rank-6 family that was never previously considered; perf 847 ms / 1155 runs; empty-state banner verified on a no-benefit scenario; toggle off resets + hides / on restores; propwd ⇌ row click-loads faithfully (strategy=propwd, extraConversionAmount=75000); all 3 objectives (balanced/conveffect/earliestbe) run clean; only the 4 pre-existing intentional bad-input console fixtures.
- **Not byte-identical:** ⇌ row set and `_optConvAmt` change (objective moved finalNW→baselineScore); `_id` values shift (session-only, Share URLs unaffected). Engine untouched → single-scenario/Annual/MC/TaxPlanner bit-identical.
- **Left open (separate phase):** thread `spendGoal` through so ✦ spend-optimized rows become pool-eligible (currently excluded because their rebuilt overrides drop spendGoal + tier/cyclic/cash fields).
- **Status:** DONE, not yet committed. **Files:** `optimizer_core.js`, `optimizer_ui.js`, `optimizer_core.test.js`, `retirement_optimizer.html`.

## Phase PF11 (SUPERSEDED — original OPEN writeup, kept for context): Optimize Conversions candidate pool — top-5-by-finalNW misses the families that benefit
**Why now:** PF10 made Optimize Conversions default-ON (user request). That turns a long-known design limitation into a visible, everyday one: the feature is on for everyone, and for many scenarios it correctly produces **zero ⇌ rows**, which reads as broken. Originally scoped as "PF8 Issue 3" (informational only, not implemented); default-ON is the event that makes it worth doing.

**The defect, empirically confirmed 2026-07-16 (browser, default scenario + a $2M-IRA/$90k-spend variant):**
`optimizer_ui.js`'s Phase-23 block picks candidates as `results.filter(success).sort(finalNW desc).slice(0,5)` and then sweeps `optimizeConversionAmount()` on each. **Ranking by finalNW is orthogonal to "would this family benefit from converting more."** Measured on the $2M/$90k scenario:
- Top-5 were all cyclic `fixedpct` (IRA Draw) rows, ~$9.2M finalNW. Their sweep correctly returns `optConv: 0` — extra conversion strictly *hurts* them (top row: $9,266,756 at $0 → $9,146,129 at $50k → $8,635,273 at $150k, monotonically down). So 0 ⇌ rows is the honest answer for the pool it was given.
- Meanwhile `propwd` ranks **6th** and its sweep returns **$125,000**; non-cyclic `fixedpct 5%` returns $100,000; `gk` returns $175,000. All three would have produced real ⇌ rows and none were ever considered.
- Net effect: the feature most likely to answer "how much should I convert?" silently answers "nothing" precisely because the strategies that convert well rank below the ones that don't.
- Independent contributing factor: PF9's `gkSpendStable` gate legitimately zeroes GK candidates whose conversions are only affordable via continuous guardrail cuts. Correct, but it means a GK-dominated top-5 (seen on the default scenario: 4 of 5 rows GK, all `optConv: 0`) also yields nothing. Two different causes, same empty table.

**Tiers scoped in PF8 (unchanged, pick one):**
1. *Cheap:* broaden the pool using `totals.betrAvg` (already computed free on every row, already a table column) — e.g. union of top-5-by-finalNW and top-N-by-betrAvg, so likely-converters get a seat.
2. *Expensive:* opt-in "Deep Search" that sweeps conversions across the full 176-220 row space.
3. *Full:* make `extraConversionAmount` a real sweep dimension in `buildVariations()`.

**Interim mitigation already shipped (PF10):** the v11.1287 changelog states plainly that ⇌ rows only appear where an extra conversion actually improves a top-ranked strategy, so an empty result reads as a real finding rather than a bug. Docs updated to match. **This is disclosure, not a fix — the pool limitation is real and unaddressed.**
- **Status:** OPEN, not started. Needs a tier decision before implementation.
- **Files (expected):** `optimizer_ui.js` (Phase-23 candidate selection, ~line 580), possibly `optimizer_core.js` (`buildVariations`) for tier 3.

---

## Phase PF10: Cash-funded conversions + Maximize Conversions restructuring (v11.1287)
**Why:** User asked why a $20,000 "Extra Annual Roth Conversion $" only converted $13,740, hypothesizing that enabling Maximize Conversions would fix it. Traced the phase order: the hypothesis is wrong (the two mechanisms never interact -- `applyExtraConversion`'s tax calc reads only fields finalized before `routeSurplusAndConvert` runs). The real cause is `applyExtraConversion` treating the entry as a GROSS IRA withdrawal and netting out its own marginal tax. That's financially correct but was undocumented, and the conversation surfaced a deeper gap: **neither mechanism actually "maximized" anything** -- `routeSurplusAndConvert` only opportunistically redirects money already leaving the IRA; `applyExtraConversion` loses money to tax by design. Real practice is to pay the conversion tax from Cash so the intended amount lands in Roth.

- [x] **Engine, two independent flags:** `maxConversion` renamed to `convertExcessToRoth` (same mechanism, honest name); new `fundConversionWithCash`. Rejected bundling into one flag: they're financially different decisions (opportunistic reallocation vs. a real liquidity call), and this codebase's pattern is independent, sweepable booleans.
- [x] **Engine, new `applyConversionGrossUp(sim, yr)`** (main loop, between `routeSurplusAndConvert` and `applyExtraConversion`). Implements the user's own formula: `t` = the conv1+conv2 slice's true marginal rate (subtractive shadow `calculateTaxes()`, same technique as `cfRefundIRA`/`attributeIncrementalTaxes`), `increase = conversion * t/(1-t)`, pull `increase` additionally from the IRA, fund its tax (`increase*t`) from Cash, credit the full `increase` to Roth. Verified against the live engine: formula holds to the dollar, `conversion+increase == conversion/(1-t)` exactly.
  - **A first design pass was wrong and was discarded:** it proposed `cfRefundIRA`-style iterative gross-up applied to `conv1`/`conv2` as a fix for the function's "TAX GAP" comment. Traced by hand: `conv1`/`conv2` is a pure reallocation with nothing netted out (the withdrawal and its tax are already fixed by the strategy), so there was no haircut for Cash to cover and no gross/net decomposition to "fix." Comment rewritten to say so.
- [x] **Engine, `applyExtraConversion` cash-funding:** simpler path -- it already knows its gross, so it funds the known tax from Cash (capped at availability, blends gracefully) and credits the full gross.
- [x] **Real bug found via browser testing, not by either planning agent:** both mechanisms mutate `yr.totalTax`, and `applyExtraConversion` isolates its marginal tax by subtracting `yr.totalTax`. With the gross-up running first, that baseline included the gross-up's tax while the shadow calc's income basis didn't include the gross-up's income -- apples-to-oranges, understating the extra conversion's tax by ~43% ($3,635 vs. the correct $6,346). Fixed with a shared `yr._extraIRAIncome` basis field. Regression test verified to actually fail when the fix is reverted.
- [x] **UI:** one visible "Maximize Conversions" checkbox (`data-no-share`, never read by `getInputs()`) writes both flags and displays their combined state (indeterminate when they diverge); nerd-gated `#convAdvanced-wrap` sub-panel exposes them independently. New `onMaximizeConversionsChange()`/`onConvSubFlagChange()`; the latter is called from every programmatic restore path (`loadFromURL`, `applyScenario`, `loadOptimizerResult`, `loadMCVariation`, init) since `.checked =` fires no event.
- [x] **Optimizer-only controls relocated (user request):** Optimize Spend / Optimize Conversions moved from the sidebar into `#tab-opt` (`#opt-search-options`) since they only drive `runOptimizer()`. **Gotcha caught:** they are URL-shareable (`opt`/`copt`), and `captureDefaults`/`buildShareURL` iterate `.sidebar input` -- moving them would have silently broken Share while `loadFromURL` kept restoring them (asymmetric round-trip). Introduced `SHARE_INPUT_SELECTOR` covering both regions, plus `data-no-share` support.
- [x] **Break Even affordance (user: "the Diagnose is a bit obnoxious"):** standing text button replaced with a compact ⓘ next to the year; click computes, result renders inline and into `title` for hover re-read.
- [x] **Dead tooltip bug (pre-existing):** the visible Roth Conv column had NO tooltip -- map key `'RothConv'` vs. actual log key `'rothConv'`, and the lookup is case-sensitive. Fixed and rewritten to explain the tax treatment. **Wrote a key-audit script rather than fixing just the reported instance -- it found a second dead tooltip (`'RothG'` vs `'rothG'`).** Both fixed; audit now reports zero.
- [x] **Sweep:** `buildVariations()` adds 💵 `fundConversionWithCash` clones of non-cyclic rows only, gated on `base.Cash > 0` (the mechanism is a hard no-op without Cash, so those clones would be bit-identical -- wasted `simulate()` calls, and MC runs `numPaths × variations.length`). Verified live: 108 → 144 rows (+33%), 0 added at Cash=$0. `findCurrentStrategyIdx` extended so Stress mode doesn't pair a cash-funding user with the non-cash-funded twin.
- [x] **Back-compat:** `'mc'` short code reused for `convertExcessToRoth` (every historical Share URL keeps working for free); long-form aliases in `loadFromURL`/`applyScenario`. `fundConversionWithCash` deliberately NOT implied by the migration, so old scenarios stay numerically identical. Verified live.
- [x] **Round-2 fixes (user testing, same version):**
  - **Nerd-mode Optimizer sweeps `fundConversionWithCash` as its own dimension** (user request) -- 💵 rows per non-cyclic family, gated on `base.Cash > 0`; 176 -> 220 rows. Base rows are FORCED to `false` in nerd mode (`addResult` normalizes when the override is undefined), otherwise a user who already had the sidebar flag on would get two identical arms instead of an A/B. Outside nerd mode rows still inherit the sidebar, so the table reflects the plan you configured.
  - **Second load-strategy gap found while verifying the above (same bug class as PF8 Issue 1, newly introduced by PF10):** `addResult` recorded `_fundConversionWithCash: overrides.fundConversionWithCash`, but outside nerd mode the flag is INHERITED from `base` rather than overridden -- so rows claimed `false` while their own `simulate()` ran with `true`, and `loadOptimizerResult()` restored the wrong plan. Fixed by recording the EFFECTIVE value (`inputs.*`, i.e. base+overrides) for both flags and the ✓ label. Round-trip verified live. **Lesson: any new row field must record post-merge `inputs`, never raw `overrides`, or it lies whenever the value comes from the sidebar.**
  - **"Fund Conversion Taxes with Cash" -> "Use Cash"** -- the label was long enough to break the toggle's knob rendering. Tooltip also reworded off the overly optimistic "pays conversion taxes from Cash" to "uses available Cash to land more of your conversion in Roth", which is honest about the Cash-is-short case.
  - **Break Even ⓘ now auto-computes** (user: the click-first prompt was pointless) -- diagnosis runs in `updateStats()`, so hover reads the real reason; click pins it inline, click again collapses. **Measured before committing to the hot path: worst case (k=25 conversion years, no early exit) is 43ms vs. 53ms for one `runSimulation()`** -- the truncated runs are cheaper than the full one, so eager is free. Would have been wrong to assume either way.
  - **Optimize Conversions defaults ON** (user request). Share-URL symmetry re-verified: ON is now omitted as the default, OFF emits `copt=0` -- without that, a link shared with it off would silently re-enable it for the recipient.
  - Docs/changelog corrected: "four toggles in the strategy panel" was wrong on two counts; split into strategy-panel controls vs. a new *Optimizer search options* section; `Extra Annual Roth Conversion $` documented (gross vs. what lands, and why it ignores IRA Goal).
- **Verification:** node 73/73 (67 prior + 6 new: full-gross-lands, the `t/(1-t)` formula + dollar conservation, cash-constrained scaling, Cash=$0 no-op, the both-mechanisms interaction regression, flag-off inertness). Browser: 240/240 in-page, no new console errors, the user's exact $13,740 reproduced and now $20,000 with the flag on (totalTax identical -- only the funding source moved), ⓘ diagnostic end-to-end, Share round-trip, legacy migration, nerd sweep 176->220 with sidebar-on not collapsing the arms.
- **Status:** MERGED-PENDING -- pushed to PR #122 (commits `f62cf58` feature, `bec536d` round-2 fixes, `c9fc5ff` default-on). Branch also carries PF9.
- **Files:** `optimizer_core.js`, `optimizer_ui.js`, `retirement_optimizer.html`, `optimizer_core.test.js`, `optimizer_tests.js`, `montecarlo/{worker,mc_controller,mc_tab}.js`.
- **Left open by this phase:** see **PF11** above (Optimize Conversions candidate pool) -- made materially more visible by defaulting the feature ON.

---

## Phase PF9: GK conversion-sweep stability gate + Break Even diagnostic + orphaned RealReturns gold commit (v11.1271)
**Why:** User tested PF8 (merged as commit `393cf7e`, PR #120) and reported 4 issues: (1) Maximize Conversion suggested a Guyton-Klinger strategy with a $575k/yr Extra Annual Roth Conversion, (2) unclear whether that amount is bound to anything (e.g. the IRA Goal floor), (3) hard to find scenarios where Break Even reports a real year instead of "--", and (4) the earlier RealReturns gold/small-cap/growth/dividend tracking work appeared to have vanished. Root-caused all 4 (2 parallel background Explore agents + a Plan agent for the Break Even diagnostic design + direct spot-checks of every load-bearing citation against live source), with 2 clarifying decisions collected from the user before implementation: leave Extra Conversion unbound by IRA Goal (docs-only fix, since a conversion moves money IRA-to-Roth rather than out of the household), and keep Break Even's strict sustained-crossing definition as-is but add a diagnostic that pinpoints which specific conversion year erases an otherwise-sustained lead.

- [x] **Issue 4 root cause (git archaeology, not a runtime bug):** PR #119 was believed to ship gold/small-cap tracking in `standalone/RealReturns.html`, but GitHub confirms the merged PR contained only the data-layer commit (`fcf4161`, "pass 1"). The UI-wiring commit (`0de2d5d`, "pass 2" -- the actual checkboxes + chart series) was pushed to the same branch *after* the PR merged and never reached `main`. Fixed by cherry-picking `0de2d5d` onto a fresh branch off `main` (clean, zero conflicts, confirmed via `git merge-tree` dry run beforehand) and opening a new PR -- no code changes, purely a "land the orphaned commit" fix. Browser-verified: Gold/Small Cap/Growth/Dividend/International checkboxes render, toggling Gold plots its line, no console errors, pre-existing sweepable-period slider + CPI summary + per-card Market CAGR (`d930139`, already on main) unaffected.
- [x] **Issue 1 (real bug, fixed):** `optimizeConversionAmount()`'s $25k-step sweep (`optimizer_core.js`) picked whichever `extraConversionAmount` maximized raw `finalNW`, with no check on whether a GK strategy could actually sustain that spend path -- the same runaway-optimization trap `gkSpendStable()` already guards against for `optimizeSpend()`/`optimizeSpendDown()`, just never wired into this sibling function. Fixed by gating the sweep's score update on `gkSpendStable(res, strategyOverrides, baseInputs)` (no-op for non-GK strategies). Empirically confirmed the fix changes real output: a constructed scenario where $425k/yr out-scores $175k/yr on raw finalNW alone now correctly picks $175k (the largest GK-stable candidate) instead.
- [x] **Issue 2 (docs-only, per user decision):** `applyExtraConversion()` clamps only to the remaining IRA balance, never to `iraGoalNominal` -- unlike every other withdrawal path. User chose to leave this unbound (a conversion isn't money leaving the household) rather than add a clamp. Tooltip on the "Extra Annual Roth Conversion $" field rewritten to say so explicitly instead of implying the remaining-balance clamp is a safety floor.
- [x] **Issue 3 (new diagnostic, per user decision):** added `diagnoseConvBreakEvenFailure(inputs, actualLog)` (`optimizer_core.js`) -- linear scan over conversion years only, re-testing the plan truncated at each successive conversion year (new `_cfSuppressConversionsFromYear` input + shared `_convSuppressedThisYear()` helper wired into the 3 existing suppress-check call sites, purely additive) to find the first truncation that still fails to sustain a Break Even lead. Deliberately linear, not binary search, since `nominalTaxRate`'s discrete bracket-step behavior (documented in PF8's own findings) means the sustains(j) sequence isn't guaranteed monotonic. On-demand only, triggered by a new "Diagnose ›" link next to the Break Even stat (only shown when `convBEYear` is null and conversions occurred) -- `optimizer_ui.js` caches the actual `simulate()` inputs (`lastSimInputs`, didn't exist before) so the diagnostic re-runs against exactly what produced the displayed result. Not nerd-gated.
- **Verification:** node 67/67 (62 prior + 5 new: GK-gate regression test proving the fix changes the sweep's answer, a non-GK-strategy-unaffected test, a "boundary" diagnostic test whose scenario naturally reproduces the user's own "5 conversions sustain, 6th breaks it" narrative with full invariant re-simulation checks, a "neverSustains" test, and a no-conversions-in-log precondition test). Every new test's expected values empirically derived by running the real engine in a scratch script before being hard-coded as assertions, matching this project's established practice.
- **Status:** Issue 4 shipped as PR #121 (separate branch/worktree, merged independently of issues 1-3). Issues 1-3 on this branch, pending commit.
- **Files:** `optimizer_core.js` (`optimizeConversionAmount`, `applyExtraConversion`, `routeSurplusAndConvert`, new `_convSuppressedThisYear`/`diagnoseConvBreakEvenFailure`, `module.exports`), `optimizer_ui.js` (`runSimulation`, `updateStats`, new `runBreakEvenDiagnosis`/`formatBreakEvenDiagnosis`), `retirement_optimizer.html` (tooltip, stat tile markup, Docs paragraph, changelog, version), `optimizer_core.test.js`. Separately: `standalone/RealReturns.html` (Issue 4, PR #121, different branch).

## Phase PF8: Round 3 fixes -- optimizer load-strategy gap + Conv Savings doc (v11.1253)
**Why:** After PF7 shipped, user reported 4 issues while testing. All 4 root-caused (2 parallel Explore agents + my own live browser reproduction + 1 Plan agent for the fix design, every load-bearing citation spot-checked against actual source). Two are real pre-existing bugs (not introduced by PF7, but made visible/consequential by it); one is a documentation gap; one needs no code change at all.

- [x] **Issue 1 (real bug, fixed):** `extraConversionAmount` had zero presence anywhere outside the Optimizer's Phase-23 sweep -- no sidebar input, not in `getInputs()`, not URL-shareable. `loadOptimizerResult()` never carried it over, so loading a ⇌ row ran a materially smaller-conversion plan than what the optimizer table evaluated. Same code path also dropped `cyclicEnabled`/`cyclicOrder`/`stratIRMAATier`/`stratACAMultiple` for some top-5 winners, same bug class.
  - **Fix implemented (9 steps):** new always-visible sidebar field "Extra Annual Roth Conversion $" (`retirement_optimizer.html`, not nerd-gated); wired into `getInputs()`/`OPT_LONG_TO_SHORT` (`eca`)/`DOLLAR_INPUT_IDS`; `loadOptimizerResult()` sets it from `_optConvAmt` (explicitly zeroes it for non-⇌ rows); Phase-23 `overrides` builder gained `stratIRMAATier`/`stratACAMultiple`/`cyclicEnabled`/`cyclicOrder`; `runOptimizer()` zero-guards `base.extraConversionAmount` right after `getInputs()` (mutating, function-local, safe); `buildVariations()` (Monte Carlo) zero-guards non-mutating inside its `push()` helper since `mc_tab.js` reuses the same `base` object reference elsewhere.
- [x] **Issue 2 (doc-only, fixed):** `Conv Savings` and `Break Even` column tooltips rewritten to clarify they measure different things (realized tax paid vs. after-tax wealth with deferred-tax pricing) and can legitimately disagree. No calculation change.
- **Issue 3 (no code, effort estimate only):** today's top-5-by-finalNW candidate pool for Optimize Conversions is orthogonal to "this family's conversions are likely to break even" -- a lower-finalNW family could be the true best converter and never get considered. 3 tiers of possible follow-up scoped (cheap betrAvg-broadened pool / expensive full-sweep opt-in "Deep Search" / full variant space) -- none implemented, informational only per what was asked.
- **Issue 4 (no code needed):** "Reduce" strategy's isolated positive-then-negative convOC swing fully explained -- root cause is `sim.nominalTaxRate` being a discrete bracket-table step function applied to each run's full remaining IRA balance, crossed in different years by the actual vs. counterfactual runs. PF6's sustained-crossing fix already correctly suppresses this from being reported as a false Break Even. Purely explanatory.
- **Verification:** node 62/62 unchanged. Browser end-to-end: user's original GK repro -- optimizer showed `optConvAmt:$550,000, convBEYear:2037`; loading that ⇌ row now populates the sidebar field to $550,000 and the single-scenario Break Even stat now reads **2037**, exactly matching (previously showed "--"). Plain-row load confirmed resets the field to $0. `runOptimizer()` contamination guard confirmed: identical plain-row finalNW/tax with a stray $300k sidebar value vs. clean. `buildVariations()` guard confirmed directly: 0 of 108 variations contaminated with a stray $777k base value, while the real value is preserved in the caller's `base` reference (needed by MC's `_mcBase`/stress fallback). Share-URL round-trip confirmed (`eca=550k` param, fresh navigation reproduces field + BE stat identically). Scenario save/load round-trip confirmed (field + strategy both restore via `loadScenarioByName()`). Cyclic-row live repro didn't trigger naturally in test scenarios (no cyclic row won top-5), verified instead via direct code review (matches established pattern) + passing tests; a direct `cyclicEnabled` materiality check on this scenario's data showed only a ~$174 difference, so low residual risk either way. No console errors beyond 4 pre-existing intentional bad-input test fixtures.
- **Status:** MERGED (commit `393cf7e`, PR #120).
- **Files:** `retirement_optimizer.html`, `optimizer_ui.js`, `optimizer_core.js` (contamination guard only, no logic change).

## Phase PF7: Break Even in the Optimizer (Optimize Conversions rows) (v11.1247)
**Why:** Follow-up to PF6. User asked: (1) impact of ranking the Optimizer by earliest Break Even year when "Optimize Conversions" is on, (2) whether a cheap existing signal could pre-filter which strategies are likely to break even before spending a full counterfactual re-simulation on each.

- **Cost analysis (Explore agent, empirically verified):** `runOptimizer()` sweeps 176 (default) / 192 (nerd+ACA) rows, 1 `simulate()` call each; naively adding a convOC counterfactual to all of them would roughly double sweep cost. The existing Phase 23 "Optimize Conversions" pipeline already narrows to the top 5 successful strategies before doing anything expensive (~11-41+ calls each in its own $25k sweep) -- the natural low-cost integration point. `totals.betrAvg` (Kitces BETR) is already computed for free on every row regardless of `computeOC` and was flagged as the existing cheap "likely to pay off" signal Q2 asked about, already surfaced as a table column.
- **Engine:** no changes -- reused `simulate({...,computeOC:true})` exactly as the single-scenario tab does.
- **UI (`optimizer_ui.js`):** Phase 23 block (~572-606) now re-runs each top-5 candidate's already-known winning `optConv` once more with `computeOC:true` (one extra `simulate()` call + its internal counterfactual per candidate, not a repeat of the $25k sweep) to populate `_convBEYear`/`_convOCFinal`. New "Break Even" table column next to Avg BETR/Conv Savings. New `earliestbe` OPT_OBJECTIVES entry ("Earliest Break Even", nerd-mode only, ranks ascending by `_convBEYear ?? 9999` so non-conversion-optimized rows tie at the bottom). Deliberately did NOT touch the main 176-192-row sweep (flagged as a possible expensive follow-up, not implemented) or use a raw earliest-year-only ranking without the null-for-never-sustains gate (avoids rewarding trivial/tiny conversions the way the old PF5/PF6 bug did).
- **Docs/UI:** changelog entry 11.1247, cache-bust `optimizer_ui.js?v=111247`, new `<option>` in `#opt-objective` select.
- **Verification:** node 62/62 (no engine changes, unaffected). Browser: user's original bug-report scenario now shows exactly 1 conversion-optimized row with `convBEYear:null` (correctly -- that strategy's $100k/yr conversion never sustains a lead, `convOCFinal:-$154k` despite `$191k` in raw tax savings, a real demonstration of why the tax-savings-only `conveffect` objective can mislead). A second, more typical scenario produced 4 conversion-optimized rows all with real `convBEYear:2049` and $265k-$315k final gains, correctly ranked above all "--" rows when sorted by the new objective. No console errors either scenario.
- **Status:** complete, not yet committed.
- **Files:** `optimizer_ui.js`, `retirement_optimizer.html`.

## Phase PF6: Break Even sustained-crossing fix (v11.1240)
**Why:** User reported Break Even firing on the very first modeled year for a real scenario (fixedpct + uncapped maxConversion + futureIRATaxRate=34% override, high 10%/yr IRA drawdown), with every subsequent year showing negative Opp. Cost. Reproduced empirically: convOC was +$1,485 in year 0 (a coincidental blip), then negative in all 28 remaining years through the end of the plan (final year -$107k, never recovers). Root cause: `totals.convBEYear`/`excessBEYear` were selected via `.find()` -- first row where cumulative action > $1 and that row's OC >= 0 ("first touch"), with no requirement the crossing be sustained. Same bug class PF5 was built to fix, one failure mode PF5 left unaddressed.

- **Engine (`optimizer_core.js:1933-1969`):** new `_sustainedBEYear(key, actionAmount)` helper replaces the two `.find()` calls. Backward scan finds the earliest start of the trailing non-negative run reaching the log's last row; forward scan finds when cumulative action first exceeds $1; result is the row at `Math.max` of the two cutoffs (both conditions are "upward-closed" so this is the exact intersection). Returns null if the plan's final year is negative (no sustained crossing) or the action never occurred. Removed now-unused `_cumConv`/`_cumExcess` locals.
- **Docs/UI:** convOC/excessOC column tooltips (optimizer_ui.js), Break Even stat tile tooltip, Docs-tab "What is Break Even?" paragraph, `computeMilestones` comment, README.md -- all updated from "first non-negative year" to "permanently pulls ahead and stays ahead." Changelog entry v11.1240, cache-bust `optimizer_core.js?v=111240`.
- **Tests:** 2 new node tests (brief positive blip then sustained negative through plan end -> null; excess-withdrawal double-dip -> sustained crossing, not first touch). Both empirically validated against the real engine before implementation. All 6 existing PF5 OC tests confirmed to produce identical convBEYear/excessBEYear values under the new algorithm (zero regressions).
- **Verification:** node 62/62. Browser-verified against the user's exact reported URL scenario: convBEYear now null, stat tile shows "--", "Roth Break Even" chart milestone correctly absent, no console errors. Cross-checked a known-good profitable scenario (PF5-era "$50k/yr conversions -> +$314k gain" case) still correctly reports convBEYear=2041 with all years from 2041 onward non-negative.
- **Investigation method:** 2 parallel Explore agents (engine logic; URL param + strategy decode) + direct code reads + live empirical repro in-browser (local static server against worktree code) + 1 Plan agent that independently validated the fix direction and pre-verified all tests against the real engine before any file was edited.
- **Status:** complete, not yet committed.
- **Files:** `optimizer_core.js`, `optimizer_core.test.js`, `optimizer_ui.js`, `retirement_optimizer.html`, `README.md`.

## Phase PF5: Break Even rework (dual-sim counterfactual) + small-screen UX (v11.11dc)
**Why:** Review found the Break Even / Opp. Cost shadow-delta formula reported break-even with zero conversions (baseline portfolio mixed into the comparison) and missed break-even for clearly profitable conversions; it also never charged the no-conversion world its larger RMD taxes/IRMAA. User requested a financially responsible model: two complete plans, each paying its own taxes when due.

- **Engine (`retirement_optimizer_core.js`):** convOC/excessOC now = after-tax wealth of the actual run minus a full counterfactual re-simulation. `_cfSuppressConversions`/`_cfSuppressExcess` flags make the counterfactual refund discretionary IRA over-withdrawals back into the IRA via `_cfRefundIRA()` (fixed-point tax recompute); extraConversionAmount zeroed (also for the early-timing trigger at ~line 1038); RMD-driven surplus still flows out (can't legally stay). Break Even gated on conversions actually occurring. Counterfactual runs only when `computeOC` set (runSimulation only — optimizer/MC unaffected; optimizer rankings never used convOC). Valuation = row totalWealth, or Marginal Heirs Tax override on both runs' IRAs when provided. Shadow-delta code deleted; per-year convTax/excessTax attribution kept; BETR untouched.
- **Docs/UI:** Break Even stat tooltip, convOC/excessOC column tooltips, Docs-tab "What is Break Even?" rewritten (fixed broken `<strong>` markup); changelog entry 11.11dc; cache-busts to `?v=1111dc`.
- **Small-screen batch (partial P16):** tap-to-show tooltip popover on touch devices (`setupSmallScreenUX()`, `?touchtips` test hook); stat bar → 3-col grid <768px (inline style moved to CSS); tab bar single scrollable row <768px; sidebar sections default-folded on phones + floating ⇅ inputs/results jump button (≤1024px); sticky Year column on `#main-table`; `.has-tooltip` popover now wraps.
- **Tests:** 6 new node tests (no-conversion → null BE; profitable conversions → BE year + finalNW identity; counterfactual pays larger RMDs/taxes; recursion guard; excess gating; computeOC-unset skip). node 60/60, browser suite green.
- **Empirical proof cases:** Roth-heavy no-conversion (was BE year 0 → now "—"); IRA-heavy no-conversion (was BE 2045 → now "—"); $50k/yr conversions gaining +$314k (was never → now BE 2041).
- **Files:** `retirement_optimizer_core.js`, `retirement_optimizer.html`, `retirementopt_styles_responsive.css`, `retirement_optimizer_core.test.js`.

## Architecture review findings (2026-07-09) — for P15
- core.js is 6,012 lines / 133 functions mixing engine + DOM (139 getElementById); split into pure engine + UI file (drops test stubs, lets Retirement_Projection reuse the engine).
- `simulate()` is ~1,050 lines; decompose per-year phases (income → withdrawals → conversions → growth → logging).
- Retirement_Projection.html: 2,477 lines / 53 inline functions duplicating chart/table patterns (overlaps P18).

---

## Phase PF4: Changelog consolidation + docs polish (v11.11c8)
**Why:** Follow-up requests after PF/PF2/PF3 shipped: user-facing writing style (avoid em-dash), consolidate the two PF/PF2 changelog entries into one, gate a nerd-only doc paragraph, clarify the Break Even tooltip, and add a fuller Break Even explanation to the Docs tab.

- Changelog: removed the separate 11.11c1 entry; single **11.11c8** entry now covers the whole PF/PF2/PF3 batch, using user-provided wording verbatim (light typo cleanup only).
- ACA Cliff strategy-discussion paragraph (Docs tab, `#doc-aca-cliff`) now hidden unless `NERD_KNOBS` — wired into `applyNerdKnobVisibility()`.
- Break Even stat tooltip (`#stat-conv-be`'s parent `title=`) rewritten to plain language, references "See Documentation for details."
- New Docs-tab paragraph ("What is 'Break Even'?") inserted directly above "1. Profile & Ages", outside the "Detailed Strategy Discussion" fold — explains the shadow-portfolio mechanism, the tax rate used, the "widow penalty" effect, and points to Annual Details → Opp. Cost for the underlying numbers.
- **Status:** complete. node 54/54, browser 240/240. Browser-verified: ACA Cliff paragraph hidden by default, shown when nerd-knob toggled on and back off; Break Even tooltip text confirmed; new doc paragraph confirmed positioned immediately before "1. Profile & Ages"; changelog confirmed to show exactly one new entry (11.11c8), no duplicate 11.11c1/11.11c7.
- **Files:** `retirement_optimizer.html` (changelog, tooltip, doc paragraph, ACA gating markup + cache-bust bump to `?v=1111c8`), `retirement_optimizer_core.js` (`applyNerdKnobVisibility()` toggle).

---

## Priority Order (rough)

| # | Phase | Description | Status | Blocked by |
|---|-------|-------------|--------|-----------|
| — | **PF** | UX Polish Batch (9 items, IRMAA fix + MC restructure) | **complete*** | — |
| — | **PF2** | Item 6 round 2 — bar-chart legend hover/click | **complete** | — |
| — | **PF3** | MC Stress pass should run current strategy only, not all variations | **complete** | — |
| — | **PF5** | Break Even dual-sim counterfactual + small-screen UX batch | **complete** | — |
| — | **PF6** | Break Even sustained-crossing fix (first-touch bug) | **complete** | — |
| — | **PF7** | Break Even in the Optimizer (Optimize Conversions top-5) | **complete** | — |
| — | **P1** | Suggest Spend Goal (38#10) | **complete** | — |
| 1 | **P2** | Cash Reserve enforcement (38#9) | pending | — |
| 2 | **PA** | Pension Start Age | **complete** | — |
| 3 | **PB** | Lumpy Spending (no URL encoding) | pending | — |
| 4 | **PC** | Auto-Persist + Restore Offer | pending | — |
| 5 | **P4** | Creeping Tax Rate Model | pending | — |
| 6 | **P5** | Conversion Schedule — Greedy DP (23b) | pending | — |
| 7 | **P6** | Simulation Sanity-Check Tests | pending | — |
| 8 | **PD** | Onboarding Interview (replaces P7 stepper) | pending | — |
| 9 | **PE** | Insights / Feedback Panel | pending | — |
| 10 | **P8** | Annual-table View Presets (38#6) | pending | — |
| 11 | **P9** | ACA Refinement (remainder) | partial | — |
| 12 | **P10** | Upgrade Equity Data (Fama-French) | pending | — |
| 13 | **P11** | RealReturns — Intl Asset + Annual Mode | pending | — |
| 14 | **P12** | Retire Optimizer Tab → MC Strategy Compare | pending | — |
| 15 | **P13** | Multi-Strategy Segment Optimizer | pending | P9 |
| 16 | **P14** | Regime-Switching MC | pending | — |
| 17 | **P15** | Refactoring Remainder (R1b, R3, R4) | pending | — |
| 18 | **P16** | Responsive Layout (all tools) | partial (PF5 covered optimizer phone UX) | — |
| 19 | **P17** | Retirement_Projection — Simple Mode | pending | — |
| 20 | **P18** | Retirement_Projection → RetirementTaxPlanner link | pending | — |
| 21 | **P19** | taxengine.js Architectural Cleanup | mostly complete (d52ffac 2026-07-07); only state coverage (13 states) remains | — |
| 22 | **P20** | README Table of Contents | **complete** | — |
| 23 | **P21** | Annual Spending-by-Account View | **complete** | — |
| 24 | **P22** | Export Annual Details to CSV | pending | — |
| 25 | **P23** | MC Arithmetic-Mean Returns + AR(1) Variable Inflation | pending | — |

---

## Phase PF: UX Polish Batch (v11.11c1)
**Status note (\*):** all 9 original items complete and shipped; Item 6 (legend hover) needed two follow-up fixes — see Phase PF2 below, now complete.

**Why:** User punch-list of 9 items — terminology cleanup, a real IRMAA bug, chart/tooltip polish, a brokerage-harvest sizing change, and an MC tab restructure. Planned via 3 parallel Explore agents + 1 Plan agent (see `~/.claude/plans/add-the-following-to-swift-backus.md`), implemented in a single session.

- **Item 1 — Terminology:** "Bootstrap"→"Historical", "GBM"→"Synthetic" in all user-facing tooltips/labels (retirement_optimizer.html, mc_tab.js). Internal `simulationMode` values/comments untouched.
- **Item 2 — IRMAA year-0 bug (real fix):** `magiHistory` was seeded *after* year 0's lookback read, forcing IRMAA to `$0`/`-none-` in year 0 regardless of income. Fixed by retroactively computing year-0's IRMAA/tier once `tax.MAGI` is known, in the same seed block (core.js). New node test added.
- **Item 3:** After-tax income-chart note is now bold and mentions the Inflows vs Outflows view.
- **Item 4 — Cycle Brokerage:** new nerd-knob `#cycleLTCGTarget` (0%/15% target bracket). Always maxes out the target bracket (not just spend-need); when spend forces more, tops off whichever LTCG bracket it lands in, capped by the active bracket/minlimit/aca strategy's own ceiling. Required fixing a latent bug in `getLTCGBracketRoom()` (only returned room in the *first* bracket income fell into, not the combined span across multiple sub-maxRate brackets) and extracting `computeBracketCeiling()` out of the strategy-ceiling branch so Cycle years can reuse it.
- **Item 5:** "Untaxed: ..." tooltip line now its own array entry (own line), not string-concatenated onto Total Income.
- **Item 6:** New `datasetHoverHighlight()`/`composeLegendHover()` helpers — hovering a chart legend item dims all other series to ~15% opacity. Applied to all 8 chart configs (6 in core.js, 2 in mc_tab.js).
- **Item 7 (highest risk) — MC Stress folded into Historical:** worker.js/mc_controller.js restructured so selecting Historical auto-runs both the bootstrap pass AND a stress pass (shared `runPass(mode, progressOffset, progressWeight)` inner function in both files, weighted progress bar). Stress dropdown option removed. New `#mc-stress-chart-wrap` renders a second chart below the main one via new `renderStressChart()`; `renderMCChart()` trimmed to percentile-bands-only. Separate `_legendIsolatedKeyStress` so the two charts' legend-click-to-isolate don't interfere.
- **Item 7b:** Input Distribution fan charts now label the x-axis with actual calendar years (matching the main chart), not "Yr 1"/"Yr 2".
- **Item 8:** `#mc-metrics` split into `renderMCMainMetrics()` (next to the main chart) and `renderMCStressMetrics()` (next to the new stress chart), sharing a `buildAssetRangeTable()` helper.
- **Item 9:** MC strategy table columns are now click-to-sort (mirrors the Optimizer table's `sortOptimizerBy` pattern) — new `mcSortState`, `getMCColumns()`, `sortMCTableBy()` in mc_tab.js; static header `<div>`s replaced with a dynamic `#mc-table-header`.
- **Status:** complete. node 54/54 (52 baseline + 2 new IRMAA/Cycle-Brokerage tests), browser 240/240. Browser-verified live: IRMAA Tier 2/4 now shows in year 0 for high-income scenarios; legend hover dims non-hovered series; MC Historical mode renders both charts with distinct Min/CAGR/Max stats and calendar-year labels; MC Synthetic mode hides the stress chart; MC table sorts correctly on click with arrow indicator and preserved checkbox→row mapping.
- **Files:** retirement_optimizer.html, retirement_optimizer_core.js, retirement_optimizer_core.test.js, montecarlo/worker.js, montecarlo/mc_controller.js, montecarlo/mc_tab.js.
- **Independent:** no phase dependencies.

**Item 6 follow-up #1 (shipped same session):** first bug found — permanent staining. `datasetHoverHighlight()`'s restore guard used `_origBorder !== undefined` to mean "cached" — but bar datasets never set `borderColor` at all, so their real original value legitimately IS `undefined`, making the guard indistinguishable from "never cached." `onLeave` silently skipped restoring bar datasets forever after the first hover. Fixed with an explicit `_hoverHighlightCached` boolean marker. Also found `retirement_optimizer.html`'s `<script src="retirement_optimizer_core.js">` had **no cache-busting `?v=` token** at all (every other script did) — added `?v=1111c1`, which is what let this exact fix go unverified for a round (browser kept serving stale cached core.js).

---

## Phase PF2: Item 6 round 2 — bar-chart hover still broken + click-to-isolate
**Why:** After follow-up #1 shipped, user reported the fix still didn't work: legend swatch color changed on hover, but **the bars themselves never visually dimmed** — confirmed via live testing that `dataset.backgroundColor` correctly updated in JS but the canvas never redrew for bars until some unrelated redraw forced one.

**Root cause (confirmed via [chartjs/Chart.js#11507](https://github.com/chartjs/Chart.js/issues/11507)):** `chart.update('none')` is a known-buggy Chart.js mode — skips re-resolving/redrawing bar fill colors even though the data model updates correctly. Fixed by dropping `'none'` mode, calling plain `chart.update()`.

**Behavior change (user-clarified, superseding the earlier "click-same-item-to-restore" design):** for the 4 mixed bar+line charts (Taxation, Inflows vs Outflows, Earnings vs W/D, combined Income & Expenses view), clicking a **bar** legend item isolates it (dims every other dataset, keeps the clicked bar full-color) instead of removing it — sticky until a **double-click** (any bar item) restores everyone. **Lines are completely unchanged**: hover-dim still applies normally to them, and a single click still removes/restores that line series exactly as before (this was explicitly reconfirmed — no line behavior was touched). While a bar is isolated, hover-dim is suppressed.

**Implementation:**
- `dimColor()` extracted to module scope (was private inside `datasetHoverHighlight()`); that function now also uses `chart.update()` instead of `'none'`.
- New `makeChartLegendInteraction(groupSize)` factory (core.js, next to `datasetHoverHighlight()`) — single closure sharing `isolatedKey` across `onHover`/`onLeave`/`onClick`. `onClick` checks `dataset.type !== 'bar'` → delegates to `Chart.defaults.plugins.legend.onClick` for lines (untouched default toggle-hide); for bars, checks `e.native?.detail === 2` (native browser double-click detection — resets to 1 if clicks land on different legend positions, so no accidental cross-item false-positives) to restore-all, else isolates the clicked bar.
- Rewired the 4 mixed bar+line chart configs (`'tax'`, `'flows'`, `'assetflows'`, `'combined'`) to use `makeChartLegendInteraction()` via a single shared `li` instance per chart (`legend: (() => { const li = makeChartLegendInteraction(); return {...}; })()`) so hover/leave/click all read the same `isolatedKey`. Composed with `medicareLegendHover` at `'tax'`/`'combined'`. `combined` view's existing `'│'` separator-skip guard runs before delegating to `li.onClick`. Assets chart, `'net'` view, MC charts untouched (still plain `datasetHoverHighlight()`, unaffected by the click-isolate change).
- **Gotcha hit during verification:** `retirement_optimizer.html`'s `core.js` cache-bust token (`?v=1111c1`, added during the PF2-round-1 fix) wasn't bumped after these new edits — browser kept serving a stale cached copy with no `makeChartLegendInteraction` at all, so the first verification pass showed the OLD default Chart.js `onClick` still active. Bumped to `?v=1111c7` (title also bumped to v11.11c7) — this cache-bust discipline needs to happen on every edit to core.js now that it has one, not just once.
- **Status:** complete. Browser-verified via direct handler invocation (fake `MouseEvent`-shaped args): single click isolates (only clicked bar full-color, rest dimmed); hover on a different item while isolated → no change (suppressed); double-click (`detail:2`) → full restore; line item (MAGI) click still toggles visibility on/off exactly as before; `'│'` separator click → no-op; Medicare hover-tooltip compose still fires on `'tax'`/`'combined'`. node 54/54, browser 240/240.
- **Files:** `retirement_optimizer_core.js`, `retirement_optimizer.html` (cache-bust + changelog).

---

## Phase PF3: MC Stress pass should run current strategy only, not all variations
**Why:** Stress pass (folded into Historical per Item 7) was running the SAME `variations` array as the main bootstrap pass — sweeping every strategy variation (`buildVariations(base)`, often 100+) against the worst-decade historical sequences — even though `renderStressChart()` only ever plotted the checkbox-selected ones. Wasted compute, conceptually mismatched with "test my current plan against history."

**Fix implemented:**
- `montecarlo/worker.js` / `montecarlo/mc_controller.js`: `runPass(mode, progressOffset, progressWeight, runVariations)` — new 4th param, `const varsToUse = runVariations || variations;` replaces all `variations.length`/`variations[vi]` refs inside. Call site: `const stressVars = cfg.stressVariations?.length ? cfg.stressVariations : variations;` (fallback preserves old full-sweep behavior if the field is ever missing).
- `montecarlo/mc_tab.js` `runMonteCarlo()`: after building `variations`, `const currentIdx = findCurrentStrategyIdx(variations, base); const stressVariations = currentIdx >= 0 ? [variations[currentIdx]] : [{ ...base, _label: 'Current Plan', _strategyFamily: '', _paramLabel: '' }];` — added to the `runMCWorker(...)` cfg.
- `renderStressChart()`: dropped the `_mcSelected`/multi-strategy loop (now meaningless — stress always has exactly 1 variation) — plots `stress.variations[0]` directly, no `[Family]` prefix needed. Description text now says "For your current plan — ...".

**Status:** complete. Browser-verified: `_mcResults.stress.variations.length === 1` (main sweep was 108 variations in the test scenario — big compute win); switching sidebar strategy (`propwd`→`fixed`) and re-running correctly updated `stress.variations[0].strategy` to match; legend labels clean (no family prefix); no console errors. node 54/54, browser 240/240.
- **Files:** `montecarlo/worker.js`, `montecarlo/mc_controller.js`, `montecarlo/mc_tab.js`.

---

## Phase P1: Suggest After-Tax Spend Goal (was 38#10)
- **Status:** complete — `computeSuggestedSpend()`, `applySuggestSpend()`, `#suggest-spend-icon` all implemented in core.js:5453–5502. Toggle button beside spend goal; shows suggested $, restores prior goal on second click.

---

## Phase PA: Pension Start Age
**Why:** `#pensionAnnual` flows from retirement year 1 with no age gate. Users with deferred pensions (e.g., a pension that starts at 65 while retiring at 60) can't model the gap.

**Code pattern:** Mirror SS age gate at `core.js:996–997`. Existing pension line at ~1000:
```javascript
// current:
let pension = inputs.pensionAnnual * (inputs.pensionCola ? inflation : 1);
// new:
let pension = (age1 >= inputs.pensionStartAge)
    ? inputs.pensionAnnual * (inputs.pensionCola ? inflation : 1)
    : 0;
```

- [ ] Add `#pensionStartAge` input (number, default blank = startAge) near `#pensionAnnual` in HTML
- [ ] `readInputs()`: `pensionStartAge: +val('pensionStartAge') || inputs.startAge`
- [ ] `simulate()` ~line 1000: apply age gate as above
- [ ] `computeSuggestedSpend()` (core.js:5453): only include pension in guarantee income if `currentAge >= pensionStartAge`
- [ ] URL alias: add `psa` → `pensionStartAge` in `OPT_SHORT_TO_LONG` map (~line 4571)
- [ ] Survivor logic at line 1011 applies after age gate — no change needed
- [ ] Test: `pensionStartAge=65`, `startAge=60` → pension=0 years 60–64, full pension from 65
- **Status:** pending
- **Independent:** no phase dependencies

---

## Phase PB: Lumpy Spending — No URL Encoding (replaces P3 spec)
**Why:** Users have one-time/irregular expenses (renovation, car, medical). Current P3 plan included URL encoding; user revised: not needed. Store in memory + named scenarios + auto-persist only.

**Storage:** Global `let lumpyEvents = []` — array of `{year, amount, label}`. Included in `saveScenario()` / auto-persist; NOT URL-encoded.

- [ ] Global `lumpyEvents = []` init in html
- [ ] UI: collapsible sub-section near `#spendGoal` — repeating rows (year number, amount $, label text, × remove). "Add expense" appends row; each row triggers `recalc()` on change
- [ ] `simulate()` year loop: `const lumpyThisYear = lumpyEvents.filter(e=>e.year===currentYear).reduce((s,e)=>s+e.amount,0); const yearSpendGoal = inputs.spendGoal + lumpyThisYear;` — use `yearSpendGoal` in withdrawal/gap logic for that year
- [ ] Annual Details: `lumpySpend` log field (0 in non-lumpy years; existing all-zero column hiding applies)
- [ ] `saveScenario()` (~core.js:4854): include `lumpyEvents` in scenario object before stringify
- [ ] `restoreScenario()`: restore `lumpyEvents` and rebuild UI rows
- [ ] Phase PC auto-persist: include `lumpyEvents` in autosave payload
- [ ] Test: add `{year:2028, amount:15000}` → Annual Details shows lumpySpend=15000 in 2028; save/reload scenario preserves it
- **Status:** pending
- **Independent:** no phase dependencies

---

## Phase PC: Auto-Persist + Restore Offer
**Why:** Named scenarios require explicit save/load. No auto-persist exists. Users lose work on accidental close or page refresh.

**New storage key** (alongside `STORAGE_KEY` at core.js:8):
```javascript
const AUTOSAVE_KEY = 'SLCRetireOptimizeAutoSave';
```

**Payload:** `{ ts: Date.now(), params: {elementId: value, ...}, lumpy: lumpyEvents }`

**On page load** (after `captureDefaults()` and `loadFromURL()`):
- If `location.search` is empty (no URL params) AND autosave exists AND age < 30 days → show restore banner
- If URL params present: skip entirely (URL always wins)

**Restore banner:** Slim dismissible bar above sidebar:
`"Restore your last session from [date]?  [Restore]  [Dismiss]"`
- Restore: apply saved params + lumpyEvents; trigger recalc; hide banner
- Dismiss: hide banner; mark dismissed so same autosave doesn't re-offer

- [ ] Add `AUTOSAVE_KEY` constant
- [ ] `autoSaveState()`: iterate all form elements with IDs, collect values + lumpyEvents + timestamp; `localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload))`
- [ ] Debounce 600ms: `document.addEventListener('input', debouncedAutoSave)` after init
- [ ] On page load: check for autosave + offer restore logic
- [ ] Restore banner HTML + show/hide logic
- [ ] `applyAutoSave(saved)`: sets element values + lumpyEvents + triggers recalc
- [ ] `restoreScenario()` (named scenario load) also triggers `autoSaveState()` so named-scenario state becomes new autosave baseline
- [ ] Test: change any input → 600ms → check localStorage has autosave; reload clean (no URL) → banner appears; Restore → inputs match; Dismiss → no re-offer on next reload
- **Status:** pending
- **Independent:** no phase dependencies; PB (lumpy) should ship first so lumpy is included in autosave

---

## Phase PD: Onboarding Interview (replaces P7 stepper concept)
**Why:** Original P7 was a stepper walkthrough of app features after load. User revised concept: a **pre-page interview** that gathers goals + rough numbers → pre-populates inputs → suggests where to focus. More useful than touring features.

**UX Flow (3 screens in modal overlay):**

**Screen 1 — Goals** (checkboxes, pick any):
- Maximize lifetime after-tax spending
- Leave a financial legacy / maximize estate
- Plan for stability in bad markets (sequence of return risk)
- Optimize Roth conversions to reduce lifetime taxes
- Qualify for ACA premium subsidies (pre-Medicare)
- Bridge income between retirement and Social Security start

**Screen 2 — Quick Numbers** (rough ballpark; all editable later):
- IRA/401k balance, Roth balance, Brokerage/taxable, Cash/savings
- Annual Social Security per person, Annual pension (0 if none)
- Planned retirement age + target annual spending (can leave blank)

**Screen 3 — Your Priorities** (generated from goal checkboxes):
- Short narrative + bullets. Examples:
  - "ACA subsidies" → "Set strategy to ACA limit until age 65"
  - "Roth conversions" → "Run the Optimizer to find optimal conversion strategy"
  - "Bad markets" → "Run Monte Carlo Stress mode to test your plan"
  - "Bridge to SS" → "Set SS start to 70; model gap years with IRA draws"
- [Finish]: pre-populates inputs, closes modal, sets `optimizer_onboarded`
- [Skip for now]: closes without pre-populating or setting gate

**Trigger:**
- First visit: `!localStorage.getItem('optimizer_onboarded')`
- "New Plan" button (top of sidebar): re-shows modal; clears current inputs on confirm

- [ ] HTML: modal markup `#onboarding-modal` (hidden) with 3 screen divs
- [ ] Goal checkboxes + screen navigation (Next/Back/Skip)
- [ ] Screen 3 suggestion map: JS object `{goalId → bullet string}`
- [ ] Quick numbers → pre-populate specific input IDs on Finish
- [ ] `showOnboarding()`, `onboardingNext()`, `onboardingFinish()` functions
- [ ] "New Plan" button in sidebar header area
- [ ] `localStorage` gate: show on first visit; set on Finish
- [ ] Test: clear `optimizer_onboarded` → modal shows; select goals → Screen 3 shows matching bullets; Finish → inputs pre-filled; reload → no modal
- **Status:** pending (concept revised 2026-06-29)
- **Independent:** no phase dependencies

---

## Phase PE: Insights / Feedback Panel
**Why:** Users get numbers but no interpretation. A dedicated panel that reads simulation results and surfaces conditions the user should know about (RMD risk, longevity, survivor impact, Roth effectiveness) closes the "so what?" gap.

**Existing placeholder:** `#tab-insight` exists with empty `#insights-table` in `retirement_optimizer.html:711–719`. No code populates it.

**Architecture:**
- `computeInsights(totals, log, inputs)` → `Insight[]` where each insight is `{id, severity, title, body, suggestion}`
  - `severity`: `'info'` (blue) | `'warn'` (yellow) | `'alert'` (red)
- `renderInsights(insights)` → replaces `#insights-table` with flex card grid
- Called in `runSimulation()` after `updateStats()`
- Empty state: "Run a simulation to see personalized insights."

**6 Insight Rules (initial set):**

| ID | Trigger | Severity | Title |
|----|---------|----------|-------|
| `rmd-growth` | Projected IRA at RMD age → est. first RMD pushes income into higher bracket | warn | "IRA may force large RMDs" |
| `longevity-fail` | `totals.yearsfunded < totals.yearstested` | alert | "Plan runs short" |
| `longevity-tight` | All years funded but `finalNW < 10% startWealth` | info | "Plan funded but tight" |
| `survivor` | `inputs.hasSpouse === true` | info | "Survivor income impact" |
| `roth-effectiveness` | Conversion years exist (any `log[y].rothConv > 0`) | info/warn | "Roth conversion assessment" |
| `ltc-buffer` | `finalNW > 0 && IRA portion > $50k` | info | "IRA as LTC buffer" |

**Projection formulas (no extra simulate() calls):**
- IRA at RMD age: `lastLoggedIRABalance * (1 + iraRate)^yearsToRMD`
- First RMD est: projected IRA ÷ IRS ULT factor (table already embedded for `stat-proj-rmd1/2`)
- Survivor income drop: `(ss1 + ss2 + pension) − survivor_ss − pension*(survivorPct/100)`
- Roth effectiveness: compare `totals.betrAvg` vs `inputs.futureIRATaxRate`

- [ ] `computeInsights(totals, log, inputs)` function in core.js — evaluate all 6 rules; return non-null insights only
- [ ] `renderInsights(insights)` — flex card grid in `#tab-insight`; each card: severity icon + title + body + suggestion (smaller)
- [ ] Replace `#insights-table` markup with card container div
- [ ] Wire call in `runSimulation()` after `updateStats()`
- [ ] Empty state when no simulation run yet
- [ ] Test: large IRA ($2M) → rmd-growth insight appears; plan that depletes → longevity-fail alert; hasSpouse=false → no survivor card
- **Status:** pending
- **Independent:** no phase dependencies; reads from existing `totals` + `log` data

---

## Phase P2: Cash Reserve Enforcement (was 38#9)
**Why:** `CashReserve` input captured in `core.js` but never enforced. Reserve = portion of Cash balance (not additional funds); breakable hard floor of last resort; refill from surplus years.

**Design decision (made in Phase 38 session):**
- Effective drawable Cash = `max(0, Cash − CashReserve)` in normal years
- Last-resort: can break below reserve (flag year with `cashBreach=true`)
- Surplus years: reinvest into Cash until `Cash ≥ CashReserve`

- [ ] Read `core.js` around CashReserve capture (line ~1923) and withdrawal routing block
- [ ] Apply `effectiveCash = max(0, Cash − cashReserve)` in withdrawal candidate calculation
- [ ] Last-resort: if all accounts near zero AND spend unfunded, allow drawing from reserve; log `cashBreach=true`
- [ ] Surplus refill: if `surplus.Cash > 0 && Cash < cashReserve`, route surplus to fill reserve first
- [ ] Annual Details: add `cashBreach` flag column (Debug category)
- [ ] Test: CashReserve=$50k, Cash=$60k → only $10k drawable normally
- [ ] Test: fully depleted scenario → reserve breakable as last resort
- **Status:** pending

---

## Phase P3: Lumpy Spending (Priority H)
**Why:** Users have one-time expenses (home renovation, car, etc.). No current mechanism.

- [ ] Add per-year spending override table in sidebar (year → extra amount)
- [ ] Small repeating-row input (year, amount, label) with add/remove buttons
- [ ] `simulate()`: each year, `spendGoal += lumpySpending[y] ?? 0`
- [ ] Annual Details: `lumpySpend` column
- [ ] URL encoding: compact array format (e.g. `ls=2028:15000,2032:8000`)
- [ ] Test: lumpy year withdraws correct additional amount; non-lumpy years unaffected
- **Status:** pending
- **Independent:** no phase dependencies

---

## Phase P4: Creeping Tax Rate Model (was Phase 29)
**Why:** Tool assumes today's brackets persist forever. Future rate increases plausible. TCJA is now permanent but Congress can change rates. Default: off.

**Two options:**

**A. Rate Escalation:** input `taxRateEscalation` (% per year) + `taxEscalationStartYear`. Applies rate multiplier `(1+escalation)^max(0,year−startYear)` to all bracket rates in `calculateTaxes()`.

**B. Pre-TCJA Cliff:** `taxRateChangeYear` → swap to `BRACKETS_PRE_TCJA` (25/28/33/35/39.6%) at that year. Label: "Pre-TCJA rates (hypothetical stress test)" — NOT "TCJA expiration" since TCJA is permanent.

- [ ] Add `BRACKETS_PRE_TCJA` constant (25/28/33/35/39.6 + MFJ thresholds)
- [ ] Inputs: `taxRateEscalation`, `taxEscalationStartYear`, `taxRateChangeYear` (all default 0 = off)
- [ ] `calculateTaxes()`: apply rate multiplier and/or bracket swap per year
- [ ] Annual Details: `taxRateMult` column (Debug/Tax Policy category)
- [ ] Test: escalation=0 → bit-identical to current (regression)
- [ ] Test: pre-TCJA switch year set → taxes jump matching pre-TCJA bracket rates
- [ ] Test: escalation=1%/yr × 20 yrs → 22% bracket becomes ~26.8%
- **Status:** pending
- **Independent:** modifies `calculateTaxes()` which is already isolated

---

## Phase P5: Greedy DP Conversion Schedule (was Phase 23b)
**Why:** Phase 23 implemented `optimizeConversionAmount()` as a scalar sweep. Per-year optimal conversion schedule (greedy DP) is deferred.

**Core algorithm:**
For each year t from retirement to max(RMD ages):
1. Sweep `extraConversionAmount` from $0 to totalIRA in $10k steps
2. Lock in optimal C_t; advance year t+1 with updated state
3. Result: `convSchedule[y]` array

**Output:** Annual Details `convSchedule` column + optimizer table "Conv $/yr" column.

**MC Stage 2 (stretch):** Top-K strategies with their locked schedules → 500 MC paths each → add MC Survival column to optimizer.

- [ ] Implement `buildConversionSchedule(baseInputs, overrides)` — greedy DP year-by-year
- [ ] `buildVariations()`: when `includeConvOpt` set, use schedule (not scalar) for optimized rows
- [ ] Optimizer table: "Conv $/yr" column (avg), "Conv Savings $" column
- [ ] Annual Details: `convSched` column (Opp. Cost category)
- [ ] Test: greedy DP schedule tapers toward $0 near RMD onset (sanity check)
- [ ] Test: schedule rows beat scalar optimizer on same inputs (if not identical)
- **Status:** pending
- **Depends on:** Phase 23 ✓ (scaffold in place)

---

## Phase P6: Simulation Sanity-Check Tests (was Phase 25)
**Why:** Complex simulation accumulates subtle math errors. Deterministic edge cases with known exact answers expose regressions.

Tests go in `retirement_optimizer_core.test.js`. Helper: `makeZeroBaseInputs()` — zeroed growth/inflation/taxes, single account.

| Test | Setup | Expected |
|------|-------|----------|
| Linear depletion | growth=0, inflation=0, Roth-only $1M, spend $50k | Depletes year 20; netSpend%=5% each year |
| SS covers all spend | SS=$60k, spend=$50k, zero portfolio | Portfolio unchanged; wdRate≤0 |
| Roth conv identity | extraConvAmount=$X, growth=0, inflation=0 | `rothConv` sums to X×years; IRA reduced by gross conv |
| RMD accuracy | IRA=$1M at age 73, zero growth | First RMD = $1M ÷ 26.5 ± $1 |
| Surplus reinvestment | income > spendGoal | surplusCash > 0; total wealth increases |

- [ ] Add `makeZeroBaseInputs()` helper
- [ ] Implement 5 sanity tests listed above
- [ ] Run full node test suite; target zero failures
- **Status:** pending
- **Independent:** uses existing `simulate()` interface

---

## Phase P7: Onboarding Stepper (was 38#5)
**Why:** First-time users have no guidance on the 4 sidebar sections.

**Design:** First-run dismissible "Start here" stepper overlay covering the 4 sidebar sections sequentially. Persist "seen" in `localStorage` under key `optimizer_onboarded`. Dismiss button + "Don't show again" checkbox.

- [ ] Build stepper modal/overlay: 4 steps (Assumptions, Accounts, Strategy, Results)
- [ ] Show on first load if `localStorage.optimizer_onboarded` not set
- [ ] "Next" / "Skip all" / "Don't show again" controls
- [ ] Set `localStorage.optimizer_onboarded = '1'` on complete or skip
- [ ] Test: localStorage key absent → stepper shows; key present → no stepper
- **Status:** pending
- **Lower priority** — nice-to-have after core features ship

---

## Phase P8: Annual-Table View Presets (was 38#6)
**Why:** Current checkbox method for showing/hiding Annual Details columns is cumbersome. User wants navigable presets.

**Decision from Phase 38:** Keep checkbox method for now; redesign to be more navigable. No concrete design yet.

- [ ] Design preset groups (e.g., "Tax View", "Income View", "Conversion View") as button tabs above the column checkboxes
- [ ] Each preset activates its checkbox group; user can then fine-tune
- [ ] Persist selected preset to URL hash
- **Status:** pending (design phase — implement after P1–P6 ship)

---

## Phase P9: ACA Refinement Remainder (partial, was Phase 9)
**Why:** Age-gate UI done (v?). Optimizer/MC gating + MAGI/subsidy calculation not yet done.

**What's done:** `updateACAWarning()` — disables ACA options + shows `#aca-age-warn` when both ≥65.

**What's pending:**
- [ ] Optimizer: skip ACA strategy rows when both persons ≥65 at retirement start
- [ ] MC: pass age-gate flag through; don't evaluate ACA strategy past Medicare age
- [ ] ACA MAGI calculation: estimate silver-plan premium, subsidy cliff, net premium; show in Annual Details
- [ ] Annual Details: `acaSubsidy`, `acaPremium` columns when ACA strategy active
- [ ] Test: both ≥65 → ACA rows absent from optimizer table
- [ ] Test: mixed ages → ACA rows present only for pre-65 segment
- **Status:** partial
- **Depends on:** Phase 1 ✓
- **Blocks:** Phase P13 (multi-strategy segment optimizer needs clean ACA handling)

---

## Phase P10: Upgrade Equity Data — S&P 500 → Fama-French Total Market (was Phase 17)
**Why:** Current `equity` array = Damodaran S&P 500 proxy (large-cap only). Fama-French Market Portfolio (`Mkt-RF + RF`) covers all NYSE/AMEX/NASDAQ stocks 1926–present. Small-cap premium historically ~1–2%/yr higher.

**Decision:** Add as selectable toggle — keep both, let user compare. Default: S&P 500 (preserve existing behavior).

- [ ] Download `F-F_Research_Data_Factors_annual.CSV` from Ken French's data library (1926–2024)
- [ ] Compute annual total return = `(1 + Mkt-RF/100) × (1 + RF/100) − 1` for each year
- [ ] Add `equityFF` array to `historical_returns.js` alongside existing `equity`
- [ ] Add equity-source toggle in nerd panel: "S&P 500 (Damodaran)" | "Total Market (Fama-French)"
- [ ] Worker/prng: use `HISTORICAL_RETURNS.equityFF` when FF mode selected
- [ ] MC metrics panel: label equity series by source name
- [ ] Update tests: both modes produce plausible CAGR ranges (FF slightly higher)
- **Status:** pending
- **Depends on:** Phase 7 ✓; Phase 18 ✓ (fan chart makes comparison useful)

---

## Phase P11: RealReturns — Intl Asset + Annual Returns Mode (was Phases 34 + 35)

### Part A: International Equity Asset (was Phase 34)
`HISTORICAL_RETURNS.intl` (MSCI EAFE, 1970–2024) already in codebase but not wired into `RealReturns.html`. Add as 5th selectable asset.
- [ ] Add 2025 intl data point to `historical_returns.js`
- [ ] Wire `intl` into `RealReturns.html`: `computeSeries()`, stat cards, legend, custom mix allocation, URL (`iso=4`)
- [ ] Cap start-year slider at 1970 when intl visible (or render null for pre-1970)
- TIPS and BND deferred — require external data sourcing, short history.

### Part B: Annual Real Returns Mode (was Phase 35)
`annualData[]` already stores per-year real returns. Toggle: Cumulative | Annual. Annual mode switches to bar chart showing real-return % per year.
- [ ] Add `viewMode` state (`'cumulative'` | `'annual'`); `md=ann` URL param
- [ ] Add Mode toggle button group alongside Log/Linear
- [ ] `switchMode()`: rebuild chart datasets and y-axis (% linear for annual, $k log for cumulative)
- [ ] Annual mode: bars colored green (positive) / red (negative)
- [ ] Stat cards unchanged in both modes
- **Status:** pending (both parts)

---

## Phase P12: Retire Optimizer Tab → MC Strategy Comparison (was Phase 26)
**Why:** Deterministic optimizer crowns a winner that may be fragile. MC gives the honest answer: survival %, median/p10 outcomes. Goal: replace optimizer with MC strategy sweep.

**Proposed approach:**
1. Add "Compare strategies" mode to MC tab: runs top 5–6 strategies through full MC (same 500 paths)
2. Comparison table: strategy | survival % | median final wealth | p10 wealth | median lifetime tax
3. Gate existing optimizer behind `?optimizer=1` URL param
4. After MC comparison ships and validated, remove optimizer code

**What to keep from optimizer:** `getOptimizerColumns()` + `buildVariations()` feed the MC sweep. `optimizeConversionAmount()` hooks into MC mode. Infeasibility detection → inline strategy selector warnings.

- [ ] Design MC comparison table: which strategies, how to surface winner
- [ ] Add "Compare in MC" mode to `mc_tab.js` running top-N strategies
- [ ] Move bracket feedback to main strategy selector
- [ ] Gate optimizer tab behind `?optimizer=1`
- [ ] Update docs: remove optimizer section, explain MC comparison
- [ ] Test: MC comparison ranks strategies consistently with intuition
- **Status:** pending — pre-design
- **Note:** Deprioritizes Phase 5 (Scenario Comparison) and Phase 8 (Sensitivity Grid) — likely superseded by this.

---

## Phase P13: Multi-Strategy Segment Optimizer (was Phase 10)
**Why:** Optimal plan may switch strategies mid-retirement. Natural breakpoints: retirement start, age 65 (Medicare), age 73 (RMDs).

**Architecture:**
- 3 segments × ~42 strategies → ~74k combos max; filter invalid → ~10k realistic
- Add timing dimension (4 options per segment): 4 × 10k = ~40k Stage 1 evals
- Stage 1: deterministic sweep → pick top-K (10)
- Stage 2: full MC (500 paths) on top-K only

- [ ] Modify `simulate()` to accept `strategySequence[]` (strategy per segment)
- [ ] Define natural breakpoints from user inputs
- [ ] Filter invalid strategy-segment combos (P9 age-gating feeds here)
- [ ] Stage 1 Cartesian sweep; score each combo
- [ ] Stage 2 MC on top-K; rank by median / p10 survival
- [ ] Surface top-N composite strategies with "Phases" column
- [ ] Test: ACA strategy never in post-65 segments
- [ ] Test: top combo beats any single-strategy result
- **Status:** pending
- **Depends on:** Phase P9 (ACA age-gating)

---

## Phase P14: Regime-Switching MC (BootstrapPlan Phase 3)
**Why:** Markets trend (bull/bear persistence). Regime-switching captures this without requiring historical data.

2-state Markov model:
- Bull: μ=+14%, σ=11%
- Bear: μ=−8%, σ=22%
- Transition probabilities calibrated to historical bull/bear run lengths

- [ ] Implement 2-state Markov model in `montecarlo/prng.js`
- [ ] Add as third simulation mode option in nerd panel (alongside GBM and Bootstrap)
- [ ] Test: regime persistence produces realistic multi-year trends (no single-year reversals every year)
- **Status:** pending
- **Depends on:** Phase 2 ✓ (bootstrap framework)

---

## Phase P15: Structural Refactoring Remainder (was Phase R)
**Why:** `simulate()` still too large. `getElementById()` DOM calls in core.js violate separation of concerns. ES module migration blocked by `importScripts()`.

**All three items done (2026-07-10):**
- [x] **R3:** Split core.js into pure engine + UI file — DONE (PR #114, v11.11f3): `optimizer_core.js` (engine) + `optimizer_ui.js` (DOM).
- [x] **R4:** Pragmatic dual-mode instead of full ES modules (full migration would cascade into 8 consumer HTML pages with no build step) — DONE (PR #115): UMD export guards in taxengine.js (12 symbols) / optimizer_core.js / displayhelpers.js; optimizer_core.test.js harness rewritten from vm.runInContext to require() with taxengine exports mirrored onto globalThis. Worker keeps importScripts; zero HTML changes.
- [x] **R1b:** Full phase decomposition of `simulate()` — DONE (PR #116, v11.11ff): 1,117 → ~215 lines. Year loop = 16-line sequence of phase functions (beginYear, resolveHousehold, computeIncome, resolveSpendTarget, planPrimaryWithdrawals, applyPrimaryAndTaxPass1, fillSpendingGap, resolveResidualAndForcedIRA, routeSurplusAndConvert + cfRefundIRA helper, applyExtraConversion, attributeIncrementalTaxes, growAndSettle, evaluateYearOutcome, logYear, endYear) sharing explicit `sim` (loop-carried) and `yr` (per-year, ~76 fields) state objects. 12 commits: rename-only field conversion first, then bottom-up verbatim cut-paste moves, then dead-code removal. Every commit verified: node 60/60 + 22-fixture golden-run harness byte-identical (all strategies, cyclic, maxConversion, extraConversion, computeOC both paths, spouse death both orders, QCDs, ssFailYear).
- **Status:** complete pending merge of PRs #115 (R4) and #116 (R1b, stacked on #115). Browser-verified at v11.11ff: 240/240, optimizer, MC worker, other consumer pages clean. Archive to task_completed.md after merge.

---

## Phase P16: Responsive Layout — All Tools (was Phase 16)
**Why:** Fixed-px sidebars and poor space utilization. Systemic across all 7 tools.

**Tools in scope:**
- `retirement_optimizer.html` — fix table overflow, add responsive behavior
- `Retirement_Projection.html` — fluid sidebar (clamp), add breakpoints (was Phase 13)
- `IncomeTaxPlanner.html` — fluid sidebar, breakpoints
- `RetirementTaxPlanner.html` — fluid 400px→clamp, mobile breakpoints
- `AfterTaxRealGrowth.html` — expand max-width cap
- `FutureCost.html` — expand max-width cap
- `irmaa_and_rmds.html` — audit + fix

**Pattern:** Replace fixed-px sidebar with `clamp(220px, 25vw, 320px)`. Breakpoints: ≤480px / ≤768px / ≤1024px. At ≤768px: sidebars collapse below content. Touch targets ≥44px.

- [ ] Audit each tool at 375px / 768px / 1440px
- [ ] Apply fluid sidebar + breakpoints per tool
- [ ] Tables: `width: fit-content; max-width: 100%` + `overflow-x: auto` wrapper
- [ ] Re-test all tools at 3 breakpoints after changes
- **Status:** pending
- **Note:** Phase 13 (Retirement_Projection responsive) is a subset — execute together.

---

## Phase P17: Retirement_Projection — Simple Mode (was Phase 14)
**Why:** Tool has too many controls for basic use-case. `IRA_Projection` was removed; need lightweight replacement.

**Simple mode:** Single account (IRA/Roth/Brokerage), balance + growth + years + withdrawal → chart. "Simple / Advanced" toggle in header (persisted to URL hash).

- [ ] Add "Simple / Advanced" toggle
- [ ] Simple mode hides: SS section, second spouse, IRMAA details, brokerage tax details, threshold editor, most metrics
- [ ] Simple mode shows: account balance, growth rate, withdrawal, projection chart, 3 key metrics
- [ ] Test: Simple mode same numbers as Advanced with equivalent single-account inputs
- **Status:** pending

---

## Phase P18: Retirement_Projection → RetirementTaxPlanner Link (was Phase 15)
**Why:** User wants to click a year row and open RetirementTaxPlanner pre-populated with that year's values.

- [ ] Identify RetirementTaxPlanner.html URL params (AGI, filing status, SS income, age)
- [ ] Add clickable year column to projection table (or row click handler)
- [ ] On click: build URL with year's key values → open in new tab
- [ ] Add row hover affordance (link cursor + subtle highlight)
- [ ] Test: clicking year opens RetirementTaxPlanner with correct pre-filled values
- **Status:** pending
- **Depends on:** understanding RetirementTaxPlanner.html's existing URL param schema

---

## Phase P19: taxengine.js Architectural Cleanup
**Why:** A full review of taxengine.js (2026-07-02, see `~/.claude/plans/review-taxengine-js-for-1-groovy-balloon.md`) found the circular core.js↔taxengine.js dependency — **fixed same session**: `getRateBracket`, `findLimitByRate`, `findUpperLimitByAmount`, `calculateProgressive` moved from core.js into taxengine.js (new "Bracket utilities" section right after `RMD_TABLE`), so taxengine.js no longer depends on core.js while core.js still depends on taxengine.js (one-directional now). Also fixed as part of that pass: dead `Retirement_Projection.html` polyfill removed (it now transparently uses the real taxengine.js functions), 5 low-risk comment/dead-code fixes in taxengine.js, and a live CPI-inflation-drift bug in `Retirement_Projection.html` (AL/MT/ND/OH/SC brackets were incorrectly inflating). node 51/51 + browser 240/240 verified after each change. The items below are the findings from that review NOT yet addressed.

- [x] **Bracket-walk consolidation:** DONE (d52ffac, 2026-07-07). `findBracketIndex()` helper added; `calculateProgressive()` gained a `startPosition` param so the capital-gains split reuses it (verified byte-identical output).
- [x] **Return-object alias cleanup:** DONE (d52ffac). `calculateTaxes()` duplicate names (`state`/`stateTax`, `fedRate`/`federalMarginalRate`, `stRate`/`stateMarginalRate`, `irmaaMagi`/`MAGI`, `stagi`/`stateAGI`) unified onto one canonical name each; all consumers updated. Bonus: repo-wide IRMAA identifier casing normalized with backward-compatible `?stratRate=irmaa2` URL parsing.
- [x] **Unify `computeIrmaaInline()` with `calcIRMAA()`:** DONE (d52ffac). `computeIrmaaInline()` deleted; Retirement_Projection.html now calls `calcIRMAA()` directly with `onMedicareCount` (fixes missing per-spouse Medicare-age gate).
- [x] **`irmaa_and_rmds.html` duplicate bracket math:** DONE (d52ffac). Now reuses new `calculateTaxableSocialSecurity()` extracted into taxengine.js; also fixed its "Annual IRMAA Surcharge" column (was showing monthly value, understated 12x).
- [x] **Script load-order normalization:** DONE (d52ffac). taxengine.js now loads before core.js in retirement_optimizer.html.
- [ ] **State coverage (13 of 51 jurisdictions uncoded):** LA/UT (flat, easy). 11 graduated states (AR/DE/HI/KS/MO/NJ/NM/OK/RI/VT/WV) — MO/WV need year-keyed rate tables (active phase-downs, same pattern as GA/NE/KY); AR/DE/MO/NJ/NM/RI/VT/WV need per-state partial-SS-taxation thresholds; NJ needs a >$1M surtax bracket; VT needs a low-income exemption rule. RI/VT CPI-indexing is actually free (already the default). See the review plan file for the full per-state breakdown.
- **Status:** mostly complete. Round 1 (circular-dependency fix + 5 low-risk items): 324447f, PR #105. Round 2 (bracket-walk dedup, alias unification, IRMAA fixes, load order, plus Medicare growth now uses user CPI inputs instead of hardcoded 5.6%): d52ffac, 2026-07-07, node 51/51 + browser 240/240. Only state coverage (13 states) remains — verified 2026-07-10 (taxengine.js header still "38 of 51 jurisdictions included").
- **Independent:** no phase dependencies for the remaining items

---

## Phase P20: README Table of Contents
**Why:** README.md is 356 lines / ~9,779 words with no H1 and no navigation — headings jump inconsistently from `##` straight to `####` (e.g. README.md:71 `## The Retirement Optimizer` then README.md:88 `#### Features in the Works`). A first-time visitor has to scroll past ~190 lines of prose before reaching "What about Other Tools." There is no `docs/` folder anywhere in the repo today.

**Design decision:** Add an inline Table of Contents with anchor links at the top of README.md — do **not** split content into `docs/*.md`. This is a public GitHub landing page; splitting content out risks losing discoverability for the tax-education and tool-comparison content that currently reads as part of the main page, for a project with no existing `docs/` precedent. A ToC is zero-risk (pure addition, no content moves) and directly fixes the "hard to scan" problem.

**Code pattern:** GitHub auto-generates anchor slugs from heading text, so the ToC just needs matching links — no HTML anchor tags required:
```markdown
## Table of Contents
- [Who Are These Tools For? What Can They Do?](#who-are-these-tools-for--what-can-they-do)
- [Standalone Calculator Tools](#standalone-calculator-tools)
- [The Retirement Optimizer](#the-retirement-optimizer)
  - [Why This Tool?](#why-this-tool)
  - [Key Features](#key-features)
  - [What the Tool IGNORES](#what-the-tool-ignores-no-plans-to-implement)
  - [Limitations and Restrictions](#limitations-and-restrictions)
- [What about Other Tools](#what-about-other-tools)
- [Ramblings and Observations](#ramblings-and-observations)
```

- [ ] Add a short H1 title above the existing `> [!WARNING & DISCLAIMER]` block at README.md:1 (currently the file has no H1 at all)
- [ ] Insert a `## Table of Contents` section directly after the intro/"Who Are These Tools For" paragraphs (README.md:1-28) and before README.md:30 `## Standalone Calculator Tools`, linking the 5 top-level sections at README.md:5, 30, 71, 193, 269
- [ ] Add nested sub-links for "The Retirement Optimizer" (README.md:71-190), pointing at its subsections: Features in the Works (88), Recent Fixes (99), Why This Tool? (116), Key Features (134), What the Tool IGNORES (155), Limitations and Restrictions (177)
- [ ] Normalize heading levels inside "The Retirement Optimizer" so nesting is consistent (currently jumps `##` → `####` skipping `###`) — promote README.md:88,99,116,134,155,177 to nest correctly under the `##` parent; same check for "What about Other Tools" (README.md:193-266) and "Ramblings and Observations" (README.md:269-357)
- [ ] Do not create a `docs/` folder or move any content — all changes are additive within README.md
- **Test:** Open the rendered README on GitHub and click through every ToC link, confirming each lands on the correct section; confirm heading-level changes didn't alter rendered text, only nesting/size
- **Status:** complete — H1 added, ToC inserted at README.md:32-46, all headings normalized to consistent ## → ### → #### nesting (verified via grep of all heading lines).
- **Independent:** no phase dependencies

---

## Phase P21: Annual Spending-by-Account View
**Why:** Users want to see, per year, how much spending came from each account (IRA1/IRA2, Brokerage, Roth, Cash, SS, pension) without wading through the full Annual Details table's ~50 columns across 9 categories. Every field needed already exists in each log row (`buildSimYearLogRecord`, retirement_optimizer_core.js:706-805): `IRAwd`, `IRA1-`, `IRA2-`, `RMD1-`, `RMD2-`, `RMDwd`, `QCD1`/`QCD2`, `Brokerage-`, `RothWD`, `CashWD`, `rothConv`, `surplusCash`, `SSincome`, `pension`. `RetirementTaxPlanner.html` is a single-year quarterly-tax tool, not a multi-year table — not a fit for extension.

**Design decision:** Add this as a new category within the **existing** checkbox/category-filter system (`columnCategories` map, core.js:3139-3236 + `getActiveCategories()`/`isColumnVisible()`, core.js:3270-3303), rather than building a new UI paradigm. The existing categories don't isolate cleanly — e.g. checking "IRA Δ" also pulls in `IRA1`/`IRA2`/`TotalIRA` *balance* columns because those keys are tagged `['Balances', 'IRA Δ']` (core.js:3160-3162). A true account-spend-only view needs its own category tag. This phase is independent of and can ship before Phase P8 (button-preset redesign of the whole checkbox UI) — when/if P8 lands, "Account Spend" becomes one more preset group for free since it's just another category on the same underlying map.

**Code pattern:**
```javascript
// core.js:3139 columnCategories — add 'Spending' alongside existing tags
'year': ['Summary', 'Taxation', 'Balances', 'Income', 'Spending'],
'age1': ['Summary', 'Spending'],
'age2': ['Summary', 'Spending'],
'SSincome': ['Summary', 'Income', 'Spending'],
'pension': ['Summary', 'Income', 'Spending'],
'IRA1-': ['IRA Δ', 'Spending'],
'IRA2-': ['IRA Δ', 'Spending'],
'RMDwd': ['IRA Δ', 'Income', 'Spending'],
'QCD1': ['IRA Δ', 'Spending'],
'QCD2': ['IRA Δ', 'Spending'],
'RothWD': ['Roth Δ', 'Income', 'Spending'],
'Brokerage-': ['Brokerage Δ', 'Income', 'Spending'],
'CashWD': ['Cash Δ', 'Income', 'Spending'],
'rothConv': ['IRA Δ', 'Roth Δ', 'Spending'],
'surplusCash': ['Cash Δ', 'Income', 'Spending'],
```

- [ ] Add `'Spending'` to the category arrays above in `columnCategories` (core.js:3139-3236) — every other array on those lines keeps its existing tags, this just appends one more
- [ ] Add a `cat-acctspend` checkbox to the `.column-controls` div (retirement_optimizer.html:748-783), labeled "Spend by Account", `onchange="updateColumnVisibility()"`, matching the style of the existing `cat-*` checkboxes at 756-782
- [ ] `getActiveCategories()` (core.js:3270-3282): add `if (document.getElementById('cat-acctspend')?.checked) categories.push('Spending');`
- [ ] Add a one-click "Spend by Account" preset button that unchecks all other `cat-*` boxes, checks only `cat-acctspend`, and calls `updateColumnVisibility()` — avoids making users manually toggle 8 checkboxes to get an isolated view
- **Test:** Run a simulation, check only `cat-acctspend` (uncheck default `cat-summary`), confirm the table shows exactly `year, age1, age2, SSincome, pension, IRA1-, IRA2-, RMDwd, QCD1, QCD2, RothWD, Brokerage-, CashWD, rothConv, surplusCash` and no balance/growth columns (`Roth1`, `Brokerage`, `Cash`, `rothG`, `brokerageG`, `cashG` must stay hidden)
- **Status:** complete — `columnCategories` tagged (core.js:3139-3236), `cat-acctspend` checkbox + `getActiveCategories()` wired (core.js:3280), `showAccountSpendOnly()` preset button added (core.js after `updateColumnVisibility()`; button in retirement_optimizer.html:749-786). Browser-verified: isolated view shows exactly the 15 expected fields (11 with content by default, all 15 with Show Zero checked), no balance/growth columns leak in, no console errors.
  - **Polish pass (same session):** fixed a pre-existing bug (not P21-specific) where `year` was only tagged into 5 of 10 categories — selecting IRA Δ/Roth Δ/Brokerage Δ/Cash Δ/Opp. Cost alone lost the year column; now `year` is tagged into all 10. Also: button restyled from default huge blue (matched `.tab-btn`) to the existing small `.tog` class; dropped `age1`/`age2` from Account Spend (not useful in this view); swapped combined `RMDwd` for per-account `RMD1-`/`RMD2-`; swapped separate `SSincome`+`pension` for the existing combined `inflows` field (already tooltipped "Social Security + pension"); added a missing `surplusCash` tooltip. Final field set (13): `year, inflows, IRA1-, IRA2-, RMD1-, RMD2-, QCD1, QCD2, RothWD, Brokerage-, CashWD, rothConv, surplusCash`. Browser-verified all 6 fixes; node 51/51, badge 🟢. No changelog/version bump (user's call — too minor).
- **Independent:** no phase dependencies; complements but does not block/depend on Phase P8

---

## Phase P22: Export Annual Details to CSV
**Why:** No CSV/XLSX export exists anywhere in the app today. The only export precedent, `exportScenario()`/`exportAllScenarios()` (core.js:5324-5433), exports saved-scenario *input* params as JSON — not the simulation log table. Users want to get the Annual Details table (including P21's new Account Spend columns) into Excel/Sheets for their own analysis.

**Design decision:** CSV-only for v1, using the existing zero-dependency Blob+`<a download>` idiom already established by `exportScenario()` — no SheetJS/xlsx library added. XLSX is an explicit future stretch item, not blocking, since it would be the first external client-side dependency in the app. Build the export from `lastSimulationLog` (raw numbers, populated at core.js:2082) rather than scraping the rendered DOM, but filter columns through the *same* `isColumnVisible()` + `analyzeColumnContent()` logic `updateTable()` already uses (core.js:3306-3335, 3507-3533, 3572-3573) — export matches what's on screen.

**Code pattern:**
```javascript
// core.js, near exportScenario()/exportAllScenarios() (5324-5433)
function exportAnnualDetailsCSV() {
    const log = lastSimulationLog;
    if (!log || log.length === 0) {
        showMessage('No data to export. Run a simulation first.', 'warning');
        return;
    }
    const columnContentStatus = analyzeColumnContent(log);            // core.js:3306
    const showEmpty = document.getElementById('show-empty-columns')?.checked ?? false;

    // Mirrors updateTable()'s header filter exactly (core.js:3507-3508, 3572-3573)
    const keys = Object.keys(log[0]).filter(k => !k.startsWith('-') && k !== 'inflationFactor');
    const visibleKeys = keys.filter(k => {
        const displayKey = k.endsWith('!') ? k.slice(0, -1) : k;
        return isColumnVisible(displayKey) && (columnContentStatus[k] || showEmpty);
    });

    const esc = v => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = visibleKeys.map(k => esc(k.endsWith('!') ? k.slice(0, -1) : k)).join(',');
    const rows = log.map(row => visibleKeys.map(k => esc(row[k])).join(','));
    const csv = [header, ...rows].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `annual-details-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showMessage('Annual Details exported as CSV.', 'success');
}
```

- [ ] Add `exportAnnualDetailsCSV()` to core.js near `exportScenario()`/`exportAllScenarios()` (5324-5433), using the pattern above
- [ ] Add an "Export CSV" button to the `.column-controls` div (retirement_optimizer.html:748-783), `onclick="exportAnnualDetailsCSV()"`
- [ ] Apply the same `row.inflationFactor` division the on-screen table currently uses for its nominal/real ("current dollars") toggle (`inCurrentDollars`, core.js:3609, 4390), so the CSV matches what the user is looking at
- [ ] CSV field escaping per RFC 4180 (quote fields containing comma/quote/newline, double internal quotes) — as shown above
- [ ] Date-stamped filename `annual-details-YYYY-MM-DD.csv`, consistent with `exportAllScenarios()`'s naming (core.js:5425)
- [ ] Note: Phase P21's new `'Spending'` category columns flow through automatically since this reads `isColumnVisible()` live — no special-casing needed regardless of ship order
- [ ] XLSX: explicitly out of scope for this phase; flag as a future stretch item requiring a SheetJS-class dependency — revisit only on user request
- **Test:** Run a simulation, toggle a couple of category checkboxes and the Show-Zero checkbox, click Export CSV, confirm the downloaded file's columns exactly match the currently-visible table columns and open cleanly in Excel/Sheets
- **Test:** With no simulation run yet (`lastSimulationLog` unset/empty), clicking Export CSV shows the warning message and does not throw
- **Status:** pending
- **Independent:** no phase dependencies; benefits from (but does not require) shipping after P21

---

## Phase P23: MC Arithmetic-Mean Returns + AR(1) Variable Inflation (GBM mode)
**Why:** GBM mode currently draws returns in log-space with an Itô correction (`logDrift = mu - 0.5*sigma*sigma; shock = logDrift + sigma*boxMuller(rng); annualReturn = Math.exp(shock) - 1`), duplicated in 3 places: `montecarlo/worker.js:95-109` (canonical), `montecarlo/mc_controller.js:170-182` (`_runMCMainThread`, file:// fallback), and `montecarlo/mc_controller.js:66-84` (`calibrateMCMs`, timing probe). Separately, GBM-mode inflation is a flat constant — `inflationSequence` stays `null` for GBM (worker.js:152-158 only builds it for bootstrap/stress), and core.js:956 falls back to the fixed rate: `inputs.inflationSequence?.[y] ?? inputs.inflation`. UI documents this today at retirement_optimizer.html:456 ("Synthetic: ... inflation is fixed"). User wants GBM to use an arithmetic mean instead of log-mean, and GBM inflation to follow a mean-reverting AR(1) model instead of being flat.

**Decisions confirmed with user:**
1. **Arithmetic mean = plain normal walk**, not a re-derived lognormal correction: `annualReturn = Math.max(RETURN_FLOOR, mu + sigma*boxMuller(rng))`, dropping log-space/Itô correction entirely. This technically leaves GBM for a normal-return walk, matching the user's literal framing. Clamped at `RETURN_FLOOR = -0.85` (new const in prng.js, alongside `INFLATION_FLOOR`) per user instruction, closing the theoretical <-100% tail risk of an unclamped normal draw.
2. **AR(1) variable inflation is default-on for all GBM users** (not nerd-knob gated) — only the persistence/shock-stddev tuning knobs are nerd-gated, mirroring how `mc-mu`/`mc-sigma` already default-drive GBM without requiring the nerd panel.

**Code pattern — new consts + helper (montecarlo/prng.js, after `boxMuller()` at line 23):**
```javascript
const RETURN_FLOOR = -0.85; // clamp for arithmetic-normal GBM draws (alongside INFLATION_FLOOR)

// AR(1) mean-reverting inflation draw for GBM mode: reverts toward `target` at rate
// `persistence` (0 = no memory, near 1 = highly persistent), plus a random shock.
function computeNextInflation(prev, target, persistence, shockStdDev, rng) {
    const shock = shockStdDev * boxMuller(rng);
    const next = target + persistence * (prev - target) + shock;
    return Math.max(INFLATION_FLOOR, next);
}
```

**Code pattern — GBM branch, worker.js:95-109 (mc_controller.js:170-182 mirrors this exactly):**
```javascript
} else {
    // GBM (default): arithmetic-normal return walk (Phase P23), clamped at RETURN_FLOOR.
    // scenarioBank now stores the FINAL return directly (not a log-space shock).
    const inflationTarget      = cfg.inflationRate ?? 0.03;
    const inflationPersistence = cfg.inflationPersistence ?? 0.65;
    const inflationShockSd     = cfg.inflationShockSd ?? 0.012;
    medianAnnualReturn = mu;   // symmetric normal pre-clamp: mean === median, no exp() needed
    scenarioBank = new Float64Array(numPaths * years);
    gbmInflationBank = new Float64Array(numPaths * years);
    for (let p = 0; p < numPaths; p++) {
        let prevInflation = inflationTarget;
        for (let y = 0; y < years; y++) {
            const r = Math.max(RETURN_FLOOR, mu + sigma * boxMuller(rng));
            scenarioBank[p * years + y] = r;
            if (r < minAnnualReturn) minAnnualReturn = r;
            if (r > maxAnnualReturn) maxAnnualReturn = r;
            prevInflation = computeNextInflation(prevInflation, inflationTarget, inflationPersistence, inflationShockSd, rng);
            gbmInflationBank[p * years + y] = prevInflation;
        }
    }
}
```

**Code pattern — downstream conversion + inflation wiring, worker.js:123-158 (mc_controller.js:200-238 mirrors):**
```javascript
// worker.js:127 — scenarioBank now stores GBM's final value directly, not log-space; skip exp()
returnSeq[y] = (simulationMode === 'bootstrap' || simulationMode === 'gbm') ? raw : Math.exp(raw) - 1;

// worker.js:152-158 — add a GBM branch alongside the existing bootstrap/stress one
let inflationSequence = null;
if ((simulationMode === 'bootstrap' || simulationMode === 'stress') && multiAssetBank?.inflation) {
    inflationSequence = new Float64Array(years);
    for (let y = 0; y < years; y++) inflationSequence[y] = multiAssetBank.inflation[p * years + y];
} else if (gbmInflationBank) {
    inflationSequence = new Float64Array(years);
    for (let y = 0; y < years; y++) inflationSequence[y] = gbmInflationBank[p * years + y];
}
```

**Code pattern — `calibrateMCMs` (mc_controller.js:66-84), drops the Itô correction (no inflation change needed — this function only probes timing):**
```javascript
function calibrateMCMs(cfg) {
    const { mu, sigma, seed, years, variations } = cfg;
    const rng = mulberry32(seed ?? 42);
    const returnSeq = new Float64Array(years);
    for (let y = 0; y < years; y++) {
        returnSeq[y] = Math.max(RETURN_FLOOR, mu + sigma * boxMuller(rng));   // was: Math.exp(logDrift + sigma*boxMuller(rng)) - 1
    }
    ...
```

- [ ] Add `RETURN_FLOOR` const + `computeNextInflation(prev, target, persistence, shockStdDev, rng)` to montecarlo/prng.js, next to `boxMuller()` (line 23)
- [ ] Update GBM branch in worker.js:95-109 per pattern above; add `gbmInflationBank` to the top-of-function `let` declarations (worker.js:16, alongside `scenarioBank, multiAssetBank, medianAnnualReturn, logDrift` — drop now-unused `logDrift` from this GBM path)
- [ ] Mirror the identical change in `_runMCMainThread`'s GBM branch, mc_controller.js:170-182, and its `let` declarations at mc_controller.js:98
- [ ] Update worker.js:127 and mc_controller.js:204 (`returnSeq[y] = ...`) to skip `Math.exp()` for `simulationMode === 'gbm'` as shown above (scenarioBank now stores final clamped values for GBM, same as bootstrap)
- [ ] Add the GBM `inflationSequence` branch to worker.js:152-158 and mc_controller.js:228-238 (`else if (gbmInflationBank)` pattern above)
- [ ] Update `calibrateMCMs` (mc_controller.js:66-84) to drop `logDrift`/Itô correction and apply `RETURN_FLOOR` per pattern above
- [ ] Add two new nerd-knob inputs to `#mc-nerd-panel` (retirement_optimizer.html:427-457), near `mc-sigma` (439-441): `mc-inflation-persistence` (number, default `0.65`, min `0`, max `0.95`, step `0.05`, unitless AR(1) coefficient — not a `%` field) and `mc-inflation-shock-sd` (number, default `1.2`, min `0`, max `10`, step `0.1`, treated as `/100` like `mc-sigma`), each with a `title=` tooltip following the existing convention
- [ ] Wire both new knobs into `_buildMCHash()` (mc_tab.js:108-120, so cache invalidates on change) and into the cfg object built in `runMonteCarlo()` (mc_tab.js:124-154, passed to `runMCWorker(...)` as `inflationPersistence`/`inflationShockSd`)
- [ ] Update stale UI copy that will become incorrect: retirement_optimizer.html:456 ("Synthetic: ... inflation is fixed") and mc_tab.js:282 ("Inflation ... (fixed)") — both need to describe the new AR(1) behavior; also mc_tab.js:276 label "(geometric)" → "(arithmetic)" since `medianAnnualReturn` now equals `mu` directly
- [ ] Optional/stretch: compute `inflationStats` (min/CAGR/max, same shape as bootstrap's, worker.js:66) from `gbmInflationBank` so the existing Input Distribution chart (mc_tab.js:792-810, `_inputInflationChart`) can render GBM's realized inflation spread instead of just the flat target — not required for correctness, only for parity with bootstrap's richer display
- [ ] Note (footnote only, not in scope): the GBM formula is duplicated across 3 sites (worker.js, mc_controller.js×2); a shared helper would reduce future duplication-drift risk but is a larger refactor — do not restructure as part of this phase
- [ ] Add node unit tests in retirement_optimizer_core.test.js (or a new small test file) for `computeNextInflation()`: reversion behavior (large deviation from target decays toward target over repeated calls with shock=0), floor enforcement (`INFLATION_FLOOR`), a statistical check that many draws of `mu + sigma*boxMuller(rng)` have sample mean/stddev close to `mu`/`sigma`, and a `RETURN_FLOOR` clamp test — load montecarlo/prng.js into the existing vm test context alongside taxengine.js/core.js (retirement_optimizer_core.test.js:38-40)
- **Test:** In the browser, enable nerd knobs, run GBM-mode MC, confirm `msg.medianAnnualReturn` ≈ `mu` and the per-path `inflationSequence` passed into `simulate()` actually varies year-to-year (not constant) — spot-check via `console.log` in a manual run or a new browser-test-suite case in retirement_optimizer_tests.js
- **Test:** Confirm bootstrap/stress mode output is byte-identical before/after this change (their code paths are untouched)
- **Status:** pending
- **Independent:** no phase dependencies

---

## Dependency Graph (remaining)

```
P1 (Suggest Spend) — independent
P2 (Cash Reserve) — independent
P3 (Lumpy Spending) — independent
P4 (Creeping Tax) — independent
P5 (Conv Schedule DP) — needs Phase 23 ✓
P6 (Tests) — independent
P7 (Onboarding) — independent
P8 (Table Presets) — independent
P9 (ACA remainder) — needs Phase 1 ✓
  └─→ P13 (Multi-Strategy)
P10 (Fama-French) — independent
P11 (RealReturns) — independent
P12 (MC Strategy Compare) — independent; supersedes Phases 5,8
P14 (Regime-Switching) — needs Phase 2 ✓
P15 (Refactoring) — independent
P16 (Responsive) — independent
P17 (Simple Mode) — independent
P18 (RP→RTP Link) — independent
P20 (README ToC) — independent
P21 (Account Spend View) — independent; complements P8
P22 (CSV Export) — independent; benefits from P21 (not required)
P23 (MC Arithmetic Mean + AR1 Inflation) — independent
```

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Phase 8 (Variable Growth grid) superseded | Bootstrap MC + Stress mode cover the use case |
| Phase 10 (Multi-Strategy) deprioritized | Phase 23 conversion optimizer covers conversion dimension; Phase P13 for spending segments later |
| Phase 12 (Timing) auto-implementation | Auto early/late beat manual toggle; shipped without updating individual status block |
| Baseline = best no-conv no-cyclic row | Avoids IRA-hoarding strategies winning on raw NW; spendable-weighted score in Phase 37 |
| GK uses raw portfolio balance for IWR/WR | Avoids CA-tax apples-vs-oranges mismatch that caused spurious CP triggers |
| Cash Reserve = portion of Cash (not addl) | Reserve already inside Cash balance; breakable last-resort floor; refill from surplus |
| Annual-table presets: redesign pending | Current checkbox method kept until navigable design decided |
| TCJA is now permanent | Pre-TCJA scenario in P4 is hypothetical stress test, not expected event; default off |

## Known TODOs (verify in code before assuming incomplete)
- Roth1/Roth2 columns may be missing from Annual Details (column-registration class of bug)
- IRMAA surcharge may not render as Annual-table column

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | — | — |

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

---

# Archived 2026-08-07 from task_plan.md

Forty-one sections lifted out of `task_plan.md` in one pass, all of them fully complete, superseded,
or duplicates. Bodies are verbatim; nothing was summarised away. `progress.md` carries a one-line
stub per section. Two were archived as **superseded, not shipped**: the old `P3` (Lumpy Spending),
replaced by the `PB` spec now numbered `P42`, and the old `P7` (Onboarding Stepper), replaced by the
`PD` concept now numbered `P44`. The old `Priority Order (rough)` table went too, replaced by the
Open Task Index at the top of `task_plan.md`.

---

## Phase P38: The baseline/proportional strategies cannot fund their own tax bill (2026-08-05) — COMPLETE

**PR 3 `p38-pr3-size-draw-net-of-tax`, v11.146a, behavior change. The sizing fix.**
`yr.additionalSpendNeeded` (`optimizer_core.js:1303`) is now
`targetSpend + IRMAA - (possibleIncome - guaranteedIncomeTax)`, where `guaranteedIncomeTax` is a
`calculateTaxes` call on the guaranteed-income base alone (no discretionary IRA draw, no cap gains).
Computed, not rate-multiplied: the flat-rate shortcut overstates the tax **3.67x** on an SS-heavy
MFJ household ($3,831 computed vs $14,042 at `nominalRate`), so it would have over-drawn every year
while looking plausible.

- **Scope is narrower than this plan predicted.** `additionalSpendNeeded` has only three consumers:
  the cyclic Brokerage-harvest branch (`:1371`/`:1377`/`:1394`), `propwd` (`:1460`), and the
  baseline `else` (`:1480`, which is also `gk`, lapsed `aca`, and any unrecognized strategy).
  `bracket`, `minlimit`, `fixedpct`, `fixed` and `ordered` size their draw by their own rule and
  never read it, so they are **byte-identical**. The prediction that "every strategy including
  bracket moves" was wrong. 46 of 76 probed fixture x strategy cases unchanged.
- **The backstop went back to being a backstop.** `CAP_BASE` `propwd` 0%: spend unchanged at
  4,567,609, `ForcedIRA` **395,109 -> 43,816**, terminal wealth 202,859 -> 195,000. PR 2 was
  treating the symptom; that 351k was the tax on SS and RMDs being rediscovered every year.
- **Direction of the tax/wealth move is plan-dependent**, because a differently sized draw lands in
  different brackets. `CAP_BASE` gk: tax **-29,575**, terminal **+89,827**, spend -16,143 (GK sets
  spending from the portfolio, so its spending path moves too). `CREEP_BASE` propwd 0%: tax
  **+17,677**, terminal **-8,648**.
- **Cost measured, not estimated.** The 4th `calculateTaxes` per year costs **+3.9%**
  (0.398 -> 0.413 ms/simulate, best of 5 over 108 strategy rows). Not material; the
  reuse-last-year's-tax fallback was not needed.
- **Three test decisions, all made with the user rather than re-pinned sight-unseen:**
  - GK totals (`:487-489`) re-pinned: spend 7,935,798.156165 -> .157290, tax 2,141,499.763082 ->
    **2,169,137.836607**, finalNW 9,924,288.129575 -> **9,913,213.043789**. Adjustment count still 4.
  - The drain guard's bar changed rather than its arm list. `propwd 10%` and `gk` now finish solvent
    with Cash to spare (min Cash 51,002 and 27,263) instead of scraping to zero, so an arm that does
    not drain Cash must now be asserted **fully funded** instead. Naming those two would have
    rebuilt the same stale exemption list that caused P38.
  - `PF11_BASE` `spendGoal` 90,000 -> **92,000**. The fix cost the no-conversion run 15,146 of
    finalNW and the $50k run only 240, so both metrics landed on $50k and the T6 fixture stopped
    separating them. 92k (also 95k, Cash 80k, ss1 38k) restores finalNW $0 vs baselineScore $50k.
- Two new tests: the backstop-is-idle pin, and the flat-rate trap as an explicit `calculateTaxes`
  comparison so the reason for the extra call cannot be optimized away by someone who reads only the
  code.
- Verified: node **208**/32/22, `sweep_golden.gen.js` content-identical, in-page **245/245** without
  `?nerdknob`, and the browser reproduces the node numbers to the dollar.

---

### PR 1 + PR 2 (merged as PR #152)

**STATUS 2026-08-05, branch `p38-pr2-widen-forced-ira-gate` (stacked on `p38-pr1-shortfall-invariant`):**

- **PR 1 `e8d28d6` — the funding invariant, pinned as a characterization recording.** Test-only, no
  version bump. 189 -> 205 tests. Probing all 12 strategy arms separated **three** failure classes
  where the diagnosis had assumed one, so the invariant is scoped to the IRA leg:
  - **P38** shortfall with the IRA still funded: `propwd` 0% (13 yrs / worst $28,400), `fixed`
    (14 / $45,827), `gk` (6 / $15,540), baseline `else` (13), lapsed `aca` (13), `propwd` 10%
    (7 / $964).
  - **P32** IRA empty, Brokerage funded: **`minlimit` only**, and NOT fixed by anything in P38 -
    nine consecutive years 2041-2049, **$71,382** total, the first with **$945,376** of Brokerage
    untouched. Pinned as its own tripwire so P32 starts from measurement.
  - **convergence** money still reachable: `ordered` CBIR (2 / $93) and RIBC (2 / $73). RIBC strands
    $73 while holding **$58,597 of Cash** because Cash is last in its order and the third pass never
    runs a second time. Tagged, not fixed.
- **PR 2 `f592c31` — the gate widened, v11.1468, behavior change.** Gate is now
  `!yr.isACAStrategy && !yr.isOrderedStrategy`. All six P38 pins drop to 0. Byte-identical:
  `bracket`, `minlimit`, `fixedpct`, `propwd` 50%, both `ordered`, **and both pinned-number fixtures
  (GK totals at `:444`, `OC_BASE` at `:1138`/`:1422`)** - the plan expected those two to move and
  they do not, their fixtures never reach the backstop, so no re-derivation was needed.
- **Two tests moved for stale fixtures, not engine faults.** `avgWdRate`'s 4-15% band only held
  while the engine under-withdrew (`BASE` has $850k against $1.2M of spending; it now depletes fully
  and the mean is ~22.9%). `CREEP_BASE` had $1.45M against $1.8M, so once the IRA is actually spent
  `optimizeSpend` correctly returns null at its baseline gate; fixture made solvent.
- **ACA verified end to end.** Live cap: 7 years, `ForcedIRA` **0** in every one, all 7 flagged,
  shortfall stands. Lapse at 2033: 21 funded years. 2054-2057: honest ruin, all accounts at 0.
  Two whole-log assertions rescoped to live-cap years via a new `_capLiveRows` helper, and a new
  test pins the lapsed tail directly so the decision is asserted rather than merely permitted.
  **Total spend DROPS $144,193 on `aca live 400%`** - fully funding 21 lapsed years burns the IRA by
  2054 where the old code limped along partially funded for 25. Greedy year-by-year funding is the
  engine's existing contract (identical to `bracket`), but it is a visible number change.
- **`BracketOverage` confirmed 0** across all 13 forced-IRA years, in node and in the browser. That
  was work item 2's "verify, do not assume"; `forcedIRA` is reused, no new counter, and `fixedpct`
  was already precedent for `ForcedIRA > 0` with `bracketTarget === 0`.
- **Golden captures untouched**, as predicted - they record enumeration, never `simulate()`.
  `sweep_golden.gen.js` regenerates content byte-identical (line endings only).
- Verified: node 206/32/22, in-page 245/245 without `?nerdknob`.

**PR 3 is DONE** and is written up at the top of this section.

---

### Original diagnosis (retained; superseded above where they disagree)

**This is a shipped correctness defect, not a research phase.** Diagnosis is done, mechanism traced,
numbers measured, counterfactual fix measured. What remains is a build-and-ship decision. Read the
findings.md entry first (2026-08-05, "The baseline/proportional strategy family cannot fund its own
tax bill"); do not re-derive it. Diagnosed at v11.1447 and **re-verified at v11.1464** after PR #150
merged; every number reproduces to the dollar and the line cites below are post-merge.

**The defect in one line:** for every strategy outside the bracket / ordered set, the primary IRA draw
is sized against **pre-tax** income, and none of the three correction passes that follow can go back
to the IRA — so once Cash, Brokerage and Roth empty, spending goes unfunded next to a seven-figure IRA.

**Reproduce** (`CAP_BASE`, `optimizer_core.test.js:782`) with
`{ strategy: 'propwd', propWithdraw: 0, stratRate: 0, stratACAMultiple: 0 }`:
`success: false`, `totals.shortfall` **-304,331** across 13 of 24 years, end-of-plan IRA **893,920**,
`forcedIRATotal` **0**. The same fixture on shipped `bracket` 22% funds the plan to the dollar by
forcing **708,183** of extra IRA.

**Mechanism, already traced to lines:**
1. `yr.additionalSpendNeeded` (`optimizer_core.js:1281`) = `targetSpend + IRMAA - possibleIncome`,
   and `possibleIncome` (`:1226`) is **gross** — SS plus taxable RMD, pre-tax. The draw is grossed up
   only for tax on its own dollars, at last year's **effective** rate (`:1760`). Both understatements
   are deliberate first approximations; the correction passes exist to fix them.
2. Gap fill for this family (`:1593-1607`) draws Brokerage+Cash then Roth. **No IRA leg.**
3. Third pass (`:1665-1677`) is Cash then Roth. **Brokerage deliberately excluded** (`:1649-1653`),
   no IRA leg.
4. Forced-IRA convergence loop (`:1702`) is gated `yr.isBracketStrategy && !yr.isACAStrategy`, so it
   never runs. The comment at `:1696-1701` justifies excluding `fixed/propwd/baseline/gk` as
   "already draw IRA for spending" — **that justification is the bug**, because sizing the draw
   against pre-tax income is exactly what fails.

The gap is ~$27.6k-$28.2k in *every* year of the run, not just the late ones. Taxable buffers absorb
it silently until they empty, which is why it presents as a depletion failure rather than a modeling
error.

**Blast radius (same fixture):** `gk` strands **1,616,166**; `fixed` strands **689,774**; any
unrecognized strategy string falls to the baseline `else` (`:1451`) and strands **893,920**.
`propwd` 10% passes **by accident** — its +10% boost over-draws the IRA and the after-tax surplus
lands in Cash, which the gap fill then spends. Solvency in this family currently depends on a knob
that has nothing to do with funding.

**Proposed fix, already measured on a scratch copy of the engine:** widen the gate at `:1702` from
`yr.isBracketStrategy && !yr.isACAStrategy` to `!yr.isACAStrategy && !yr.isOrderedStrategy`. ACA keeps
its subsidy cliff, `ordered` keeps its own sequence.

| | today | patched |
|---|---|---|
| `propwd` 0% success | false | **true** |
| `totals.shortfall` | -304,331 | **0** |
| `totals.spend` | 4,263,278 | **4,567,608** (= sum of `targetSpend`) |
| forcedIRA | 0 | 395,109 |
| terminal after-tax wealth | 684,010 | **202,859** (-481,152) |

`bracket`, `fixedpct`, `ordered` and `propwd` 50% come out **byte-identical**. `gk` moves -13,316,
`propwd` 10% -6,110, `fixed` -344,704. The wealth drop is the point, not a regression: the money is
spent instead of stranded.

**Work items:**
1. **Confirm the one-line gate change is the right shape** before writing it. The alternative is to
   fix the *sizing* instead — make `additionalSpendNeeded` net of the tax on guaranteed income — which
   is more honest but changes the first-pass draw for every strategy and therefore every saved plan,
   including `bracket`. Recommend the gate change: it is a backstop, it leaves the bracket family
   byte-identical, and it reuses a convergence loop already proven in this engine.
2. **Naming / telemetry decision.** `yr.forcedIRA` and `BracketOverage` are bracket-strategy
   vocabulary. Decide whether the baseline family reuses `forcedIRA` (simplest, but the Annual Details
   column then means two things) or gets its own counter. `yr.bracketOverage` must stay 0 for these
   strategies — `yr.bracketTarget` is 0 for them, so `:1746` already yields 0; verify, do not assume.
3. **Tests.** Add to `optimizer_core.test.js` beside the existing soft-cap block: `propwd` 0% on
   `CAP_BASE` funds the plan and reports `success: true`; the genuine-ruin case (`propwd` 50%, every
   account at 0) still reports a shortfall and `success: false`; `bracket` / `fixedpct` / `ordered`
   stay byte-identical. The suite ran **189 green with this defect live**, so a test that only asserts
   "no shortfall" on a buffered fixture proves nothing — the fixture must drain.
4. **Version bump + changelog entry.** This moves numbers on every saved `propwd` / `fixed` / `gk`
   plan and on shared URLs. It cannot ride along in another PR.
5. **README/docs check.** Whatever the docs say about Proportional and Reduce funding spending needs
   to match the new behavior.

**Relationship to neighboring phases — settle P38 first:**
- **P32** re-examines the *same* forced-IRA loop, exclusion #2 ("the loop never considers Brokerage").
  P38 changes *who may enter* that loop; P32 changes *which accounts it draws*. Doing P32 first means
  measuring an account order on a loop half the strategies cannot reach. P32's exclusion #1 (Brokerage
  out of the third pass) is also visible here: in 2037 and 2038 the run strands $2,196 and $2,752 while
  Brokerage still holds $39,428 and $8,783.
- **P30** sweeps the gap-fill constants on the very code path that is failing to reach the IRA. Its
  `[40, 60]` results would be measured against a broken funding path.
- **P6** (Simulation Sanity-Check Tests) is the phase that should have caught this. Feed it the
  invariant this defect violates: **no year may report a shortfall while any account still holds a
  drawable balance.**

**Constraint carried from the diagnosis pass:** no engine change was made while diagnosing, on
purpose. Do the fix as its own PR against a clean tree.

---

## Phase P39: Make the node-only tests visible in the browser (2026-08-05) — COMPLETE (2026-08-06)

**Count drift, noticed on pickup 2026-08-06.** The measured table below says `optimizer_core.tests.js`
= 206 tests; the OBBBA fix and the dividend fix added 8, so node is **214/32/22** at `main` =
`10f6f2a`. The 2466 ms / 1792 ms timing split is still directionally right (nothing added was a
binary search), but **the staleness guard's expected count must be measured fresh, never copied from
this table.** That is the phase's own lesson arriving early.

**The problem, in the user's words.** Release gating relies on the **Red X**: load the page, see
`#testsFailed` render `🟢` or `❌ tests failed` (`optimizer_tests.js:2187-2194`), and do not publish
on a red. That badge only covers `optimizer_tests.js`. **268 tests in three node-only suites never
run in the browser at all**, so a change that breaks them is invisible at the moment of release and
can be published by accident. The competing constraint is equally real: browser load must not grow
by seconds.

Both constraints are satisfiable, and the measurements say so clearly.

### Measured 2026-08-05 (do not re-derive)

| suite | tests | wall time | browser today |
|---|---|---|---|
| `optimizer_tests.js` (in-page) | 245 | **55 ms** | yes, blocking at load |
| `optimizer_core.tests.js` | 206 | 2466 ms | **no** |
| `taxPaymentPlanner.tests.js` | 32 | ~320 ms | **no** |
| `doclinks.tests.js` | 22 | ~10 ms | **no** |

**The finding that makes this cheap: 3 tests are 1792 ms of that 2466 ms — 73%.** All three are
`breakEvenHeirsRate` binary searches:

- `optimizer_core.tests.js:2590` `breakEvenHeirsRate: the predicate is monotonic...` — **1438 ms**
- `optimizer_core.tests.js:2604` `lowestBreakEvenHeirsRate: finds a threshold...` — **195 ms**
- `optimizer_core.tests.js:2580` `breakEvenHeirsRate: the rate/amount pair...` — **159 ms**

  Line numbers re-measured 2026-08-06 (was `:2290`/`:2304`/`:2280` on 2026-08-05). The OBBBA and
  dividend fixes inserted ~300 lines above them. **Locate these by test NAME, not by line** — the
  names have been stable, the offsets have not.

The remaining **203 tests run in 674 ms combined**; 193 of them in 243 ms. So "multiple seconds of
tests" is really three tests, and excluding them changes the picture entirely.

Second enabling fact: `optimizer_core.js`, `taxengine.js`, `taxPaymentPlanner.js` and `doclinks.js`
**already carry dual-mode export guards** (`typeof module !== 'undefined' && module.exports`). The
sources already load in a browser. Only the four **test** files are node-bound, and only through
their `require()` headers — **4** calls in `optimizer_core.tests.js` (`:29`, `:32`, `:35`, `:66`), 1
each in the others. (An earlier count of 5 here came from a `grep -c 'require('` that also matched
the comment at `:18`.)

Also confirmed: `requestIdleCallback` and `Worker` are both available in the target browser, and
**no git hooks are currently installed** (`.git/hooks` has only samples).

### Design: three tiers

**Tier 1 — blocking, at load. Unchanged.** `optimizer_tests.js`, 245 tests, 55 ms. The Red X behaves
exactly as it does today. Nothing is added to the critical path.

**Tier 2 — deferred, after first paint.** Port `optimizer_core.tests.js` and
`taxPaymentPlanner.tests.js` to dual mode and run their fast subsets (203 + 32 tests, ~1 s) from
`requestIdleCallback`. The badge starts neutral, then resolves to 🟢 or ❌ about a second in. Load
time is unaffected because the work happens after paint. **This tier is what closes the gap.**

**Tier 3 — node and pre-commit only.** The 3 heavy searches above, tagged `slow`, plus
`doclinks.tests.js`. **CORRECTED 2026-08-06:** the stated reason — that it reads files from disk and
would need a fetch shim — is **false**. Verified: its only I/O is `require('./doclinks.js')` at
`:21`; zero `fs`, zero `__dirname`, zero `readFileSync`. The `.md` paths inside it are assertion
data, never opened. It is the **cheapest** of the three to dual-mode, not the impossible one, so
item 3 should port it too unless a different reason is found.

### The part that actually prevents the accident

The browser badge only helps when someone is looking at it. **A `pre-commit` hook running all three
node suites is the real safety net** and should land first — it is a few lines, has no page cost,
and blocks the failure mode the user described (introducing a breaking change by accident) at the
moment it would enter history rather than at the moment of release.

Tier 2 is then a convenience that restores confidence in the badge; the hook is the guarantee.

### Staleness guard, so Tier 3 cannot rot

Tier 3 is the dangerous tier: tests that live outside the badge tend to be forgotten. The in-page
suite must therefore assert **the count of node-only tests it knows it is skipping**. Add a slow
test without tagging it, or add a whole node suite, and the in-page suite goes red with a message
naming the discrepancy. Without this, P39 recreates the exact problem it is fixing, one tier down.
Note the parallel with P38's own lesson: a gate that names what it *serves* silently excludes
everything added later.

### Work items

1. **Pre-commit hook first, on its own.** — **DONE 2026-08-06, committed `ad9529f`** on branch
   `p39-pr1-precommit-hook`; the completeness check followed in `475a2c4` on
   `p39-pr4-hook-completeness`. `.githooks/pre-commit`
   (committed, real logic) + `.githooks/install` (writes a delegating shim) + `.githooks/README.md`,
   documented in `ARCHITECTURE.md` and `FILE_DIRECTORY.md`. Nothing user-visible, so **no version
   bump and no changelog entry**, same precedent as P35 PR 1 + PR 2.

   **The chosen mechanism did not survive contact and the reason is worth keeping.** The plan said
   "a `core.hooksPath` directory committed to the repo", and the repo was believed to have "no hook
   convention yet". Both were wrong: `core.hooksPath` is **already** set, to the absolute path
   `C:\Users\starc\source\retirement_assets\.git\hooks`, in `.git/config` **and** — because
   `extensions.worktreeConfig` is on — separately in **every** worktree's `config.worktree`, which
   **outranks** the repo config. `git config core.hooksPath .githooks` would therefore have been
   silently ignored inside every worktree, i.e. a no-op in the place most work happens, while
   looking installed. **That is this phase's own failure mode, one tier up.** The installer writes
   one shim at the pinned path instead; every worktree already points there, including future ones.

   Second trap, same class: `core.autocrlf` is true system-wide and the repo had **no**
   `.gitattributes`, so a fresh clone would have materialised the hook with CRLF and `sh` cannot
   execute a shebang ending in CR. Added `.gitattributes` pinning `.githooks/** text eol=lf`,
   **scoped to that directory on purpose** — a repo-wide `* text=auto` would renormalise every
   tracked file and is a separate, measured pass if it is ever wanted.

   Also added beyond the spec: the hook blocks on a **missing** suite, not only a failing one. A
   renamed or deleted suite would otherwise produce output indistinguishable from a green run.

   Verified, each as its own run: green tree exits 0 (214/32/22 in ~3.5 s); a genuine failed
   assertion blocks with exit 1 and names the suite; a crashing suite blocks; a missing suite blocks
   with a different message; `git commit` really fires it (proved via an empty commit message, which
   aborts *after* the hook runs, so no commit was created); and `rm` + `git checkout` round-trips the
   hook with zero CR bytes.
2. **Tag the 3 slow tests.** A `test.slow(name, fn)` variant, or a `SLOW` prefix the browser runner
   filters. Keep them running in node unconditionally.
3. **Dual-mode the ~~two~~ THREE portable test files.** Mechanical: replace the `require()` header
   with a node/browser branch resolving the same symbols off `globalThis` in the browser. Roughly 60
   lines at the top of `optimizer_core.tests.js`; the ~~174~~ **182** `test(...)` bodies do not
   change (re-counted 2026-08-06). **Scope grew on 2026-08-06:** `doclinks.tests.js` was excluded on
   the false premise that it reads the filesystem — it does not, so all three node suites are
   portable and it is the cheapest of them.
4. **Idle runner + badge protocol.** Extend `#testsFailed` to a three-state badge (pending / pass /
   fail) so a deferred failure is distinguishable from "still running". Do not let a pending state
   look like a pass — that is the same false-green this phase exists to remove.
5. **Staleness guard** as described above.
6. **`?runtests=all`** to force everything synchronously, including slow tests, for a deliberate
   full check.

### Constraints and traps

- **Do not let Tier 2 block paint.** The point is coverage without load cost; a synchronous port
  would trade one problem for the other.
- **A pending badge must not read as green.** Neutral, visibly distinct from 🟢.
- ~~**`doclinks.tests.js` stays in node.** Its filesystem reads are the thing it tests.~~
  **WITHDRAWN 2026-08-06 — the premise was false.** It performs no filesystem reads at all. This
  constraint was load-bearing for item 3's scope and is now removed; decide the port on its merits.
- **Test count is load-bearing** once the staleness guard exists: adding a test now means updating
  the expected count, deliberately. That friction is the feature.
- Watch the `'—'` sentinels if any test-harness text is touched; 31 of them are functional
  (see the em-dash sweep, `6771bb2`).

### Sequencing

Independent of P38 and of everything in P29-P37. Should **not** ride a behavior-change PR. Work item
1 alone delivers most of the value and could land at any time.

---

## README Audit Round 3 (2026-07-30) — COMPLETE, committed `838a870`, PR #140 MERGED

User asked for a README review after PRs #135-#139. Full claim-by-claim audit is in `findings.md`
under "README audit round 3"; every item below was checked against code, not against the changelog.

Scope decision: fix what is **wrong or self-contradictory** first, then close the coverage gap for
features that shipped in #135-#139. Do not rewrite prose that is merely opinionated - the voice of
this README is the author's and it is not a defect.

| # | Item | Fix | Status |
|---|------|-----|--------|
| A1 | `:258` "(The *Cash Reserve* is ignored currently)" - false since v11.1340, and it sits in **What the Tool IGNORES** contradicting `:185` and 3 FAQ entries | delete the parenthetical, restate what the tool really does not do (hold a brokerage/cash floor *other than* the reserve) | **DONE** |
| A2 | `:135` planner "Version 1.13b9" - actual `<title>` is 1.13c3; paragraph misses all of PR #138 | bump number, add the #138 items (`?runtests`, sticky Compute, deduped notes, brokerage handoff) | **DONE** |
| A3 | `:127` Income Tax Planner "state (14 options currently)" - dropdown is built from TAXData and holds 38 | correct the count, say it is data-driven so it stops going stale | **DONE** |
| A4 | `:233` three wrong sweep facts: Reduce is 2-15/20/25 not "1 to 30"; IRA Draw is 5-20% not 5-10%; "× Max Conversion on/off" does not exist (`convOn = true`) | correct all three; note ACA arms are advanced-only | **DONE** |
| A5 | `:181` federal-standard-deduction states omit MS and IA | list all 8 | **DONE** |
| A6 | `:499` points at `retirement_optimizer_taxdata.js`, which does not exist | point at `taxengine.js` / `TAXData` | **DONE** |
| A7 | `:642-646` FAQ lists 4 of 9 "Optimize for" objectives; mislabels and misdefines widowrmd | list all 9, fix the label and the definition | **DONE** |
| A8 | Nothing in the README covers ⚖ compare, the Stress Failure tile, SS birth-month proration, real-FRA survivor math, Guyton-Klinger, cyclic rows, 💵 cash-funded rows, or ⚓/📍 + Rank | add to **Recent Fixes / Improvements** and **Key Features** | **DONE** |
| A9 | `retirement_optimizer.html:1119` comment still claims the objective selector is nerdknob-gated (PF13 un-gated it) | one-line comment fix, found in passing | **DONE** |

Verified correct, leave alone: the AL/MT/OH standard-deduction inflation bug (still real -
`INFLATION_INDEXED:false` guards brackets at `taxengine.js:1089` but the std is inflated
unconditionally at `:1349`), the 23% SS reduction, RealReturns 1928-2025, and every relative link
and in-page anchor (all 30 resolve).

RESOLVED (was an open question): GitHub Pages renders the README at `/` through kramdown, whose
heading ids are not guaranteed to match GitHub.com's. Checked against the live page with
`curl https://tools.netcitizen.us/` - all 30 Table of Contents anchors match the ids kramdown
actually emits, including the awkward ones (`who-are-these-tools-for--what-can-they-do`,
`combined-tax-torpedo-examples-during-85-ss-phase-out`). No TOC change needed.

Verification: node 148/32/16, in-page 242/242, console clean apart from the 4 known TEST fixtures.
Live UI confirms the 9 objective labels the FAQ now lists, the selector visible without nerdknob,
and the 💵 legend still hidden without it (which is what the new Key Features bullet says).
No version bump: docs plus one comment, no behavior change.

---

## Link labels follow the href (2026-07-30, v11.13d0) — COMPLETE, committed `838a870`, PR #140 MERGED

User: the live 11.13a1 "Details" link and the "Every earlier release is written up in
optimizer_changelog.md" sentence still name the `.md`, though v11.13c5 claimed that was fixed.

Diagnosis split in two. The **href half is genuinely fixed** - the live DOM has zero `.md` hrefs and
all eight changelog links are `.html`, `#11.13a1` included. The user's page listed 11.13a1 FIRST
while live lists 11.13c5 first, so that tab was a cached copy predating `doclinks.js`. Nothing to
change there; hard reload. The **label half was never addressed**: `doclinks.js` rewrote `href`
attributes only, so a current page reads `optimizer_changelog.md` while opening
`optimizer_changelog.html`. Naming one file and opening another reads as a bug from either end.

Fix: new pure `docLabel(text, oldHref, newHref)` in `doclinks.js`, wired into `rewriteLinks()` behind
a `childElementCount === 0` guard (relabelling rewrites textContent, which would flatten markup
inside an anchor). Swaps only when the href moved, the old text is exactly the old basename, and the
new href ends `.html`. README falls through by construction (`docHref('README.md')` is `'./'`, no
`.html` basename to swap in). Descriptive labels never match a basename, so "Details" and the theme's
"Improve this page" are untouched. 6 new tests, 16 -> 22.

Version 11.13d0 computed from the clock, not incremented, per the collision note above.

---

## Nerdknob graduation: Stop-Year + Tax Creep (2026-07-29, v11.13bd) — COMPLETE, PR #137 MERGED

User: "remove the nerdknob control from the Stop conversions settings, it seems robust enough."
Asked whether to include the tax-creep row, which sat as an open question at the P4 phase below
citing the same PF13 precedent; user said un-gate both, and asked for a regression test.

Gating in this codebase is inline `element.style.display` only, set from `applyNerdKnobVisibility()`
(`optimizer_ui.js:80`). No CSS class exists for it. So un-gating = delete `display:none` from the
markup AND delete the JS branch, per the PF13 pattern at `optimizer_ui.js:88-92`.

- `retirement_optimizer.html` — dropped `display:none` from `#convEndYear-wrap` and
  `#taxRateCreep-wrap`; rewrote the creep comment that explained the gate.
- `optimizer_ui.js` — deleted both branches from `applyNerdKnobVisibility()`. Also deleted the two
  call sites that existed ONLY to un-hide the stop-year row after writing into it:
  `loadOptimizerResult()` and `applyConvStopYear()`.
- `optimizer_tests.js` — new `assertUngated()` asserting computed display for both wraps.
- `README.md:191` said tax creep was "only currently accessible via a special switch" — now false.
  `README.md:632-648` already described Stop-Year as visible, so un-gating made the docs correct.

STILL GATED, deliberately: `cycleLTCGTarget-wrap`, `opt-legend-cashfund`, `doc-aca-cliff`, MC nerd
panels, GK strategy params, ACA FPL dropdown options, ACA-cliff + 💵 optimizer sweep arms.

**Closes** the open question at "Phase P4: Creeping Tax Rate Model" below.

---

## PR-E/F/G Round 2: user-testing fixes (2026-07-28, v11.13a1) — COMPLETE

Found by the user testing Round 1 on `?mc=1&fcc=1&nerdknob`. Round 1's four PRs were re-versioned from v11.1391 to **v11.13a1** and ship together.

**PR-E — the nerdknob guard was too broad (my bug).** `mcInputsChanged()` opened with `if (_mcNerdMode()) return;`. The intent was "nerd mode owns the cadence of the expensive sweep"; the effect was that in nerd mode nothing refreshed the stress pass and nothing marked the sweep out of date. `mcTabActivated()` had the same over-broad wrapper. Only `runMonteCarlo()` is gated now. Verified: nerdknob on, spend 140k -> 90k, stress went 7 of 10 -> 0 of 10, banner appeared, main sweep untouched.

**PR-F — the stress result was buried.**
- [x] **Summary-bar `Stress Test` tile** (`#stat-stress`), reading e.g. `7 of 10 fail`, coloured on `renderSurvivalTable`'s bands. Written by `updateStressStat()` in `mc_tab.js`, deliberately NOT by `updateStats()` — that runs on every `runSimulation()` and would blank it between passes.
- [x] **Stress now runs from page load**, not only after the MC tab is opened: `_mcStress` is standalone state (`_mcResults.stress` kept in sync when a full run exists), and `scheduleRecalc` calls `mcInputsChanged()` on **every** tab, since the tile it feeds is global. One primed call 600ms after `setupAutoRecalc`. Verified: the tile reads `7 of 10 fail` 303ms after load with Monte Carlo never opened, and follows an edit made on the Chart tab.
- [x] **Stress section moved above the percentile chart** and wrapped in `<details open>` (the `#mc-input-dist` idiom), with `renderStressHeadline()` drawing a large coloured `7 / 10` plus a plain sentence, mirrored into the `<summary>` so the number survives collapsing.
- [x] Synthetic mode reads a dash with an explaining tooltip, since it has no stress pass.
- **Byte-identical** (PR-E and PR-F both): engine untouched, 8-scenario harness unchanged vs PR-D.

**PR-G commit 1 — death-year Social Security (behavior change).** `alive` is `age <= die`, so the first survivor year is `age === die + 1`. The death is now treated as falling in the **deceased's** birth month: `s1 = survivorPay x afterDeath + (1 - afterDeath) x (own1 + own2)`, reusing `ssFirstYearFraction`. The old model paid the survivor amount for all twelve months, which **understated** the year, since the survivor benefit is the higher of the two and never their sum.
- The milestone latch reads a new `yr._survivorPay`, not `yr.s1`: in a death year `s1` can be non-zero purely from the before-death months while the survivor benefit has not started, and that is not a survivor start.
- `birthyear2 > 0` keeps single filers out, whose notional spouse is "not alive" from year one.
- **Verified against the engine:** June-born decedent 2038 = $51,998 = 0.5 x (39,996 + 24,000) + 0.5 x 39,996; December-born decedent pays $64,000 for the whole year and the survivor benefit starts 2039; a survivor who has not claimed yet gets $12,000 (the decedent's half alone, no double count) with the marker correctly on 2031. Reverting the blend fails 5 tests.
- **Not byte-identical:** all 8 scenarios up, net wealth +0.50% (cyclic) to +0.89% (scalarEca), tax -0.59% (bracket) to +0.93% (propwd/noconv). Three existing expectations re-derived (GK regression, FRA end-to-end, and the survivor test rewritten as a death-year blend test).

**PR-G commit 2 — changelog split.** New `optimizer_changelog.md` at the repo root holds the full write-up of every release, newest first. `#changelog-list` keeps only the **5 most recent**, cut to two or three sentences each with a "Details" link. The top entry went from 4,640 to 595 characters, so the always-visible banner (which copies the first `<li>` verbatim) shrank with it. `data-flag="behavior"` and the title/`<li>` version pairing are preserved, and the maintenance comment now documents where detail lives and what to do when adding a release. Also repaired a sentence mangled by an earlier scripted edit ("The chart also gained markers, and for the year a survivor benefit begins").

- **Verify:** node **148/148** + taxPaymentPlanner 12/12; console clean apart from the 4 known fixtures; `optimizer_changelog.md` serves 200.
- **Files:** `montecarlo/mc_tab.js`, `optimizer_ui.js`, `optimizer_core.js`, `optimizer_core.test.js`, `retirement_optimizer.html`, `optimizer_changelog.md` (new).

---

## PR-D ⚖ head-to-head strategy compare (2026-07-27, v11.1391 -> shipped as v11.13a1) — COMPLETE

**Status: COMPLETE**, node 146/146 (+1) + taxPaymentPlanner 12/12, browser verified, engine untouched so byte-identical (8-scenario harness confirms).

**Why:** the two Δ columns were hard-wired to the single `OptimizerState.baseline`, so the table could answer "is this better than the anchor" but never "is this better than THAT one".

- [x] **Reused the existing Δ machinery instead of building a second diff surface.** `recomputeBaselineForObjective()` split: baseline *selection* stays put, the delta *write* moved to `recomputeDeltasAgainst(referenceRow)`, and `deltaReferenceRow()` returns `compareRow ?? baseline`. Pinning any row turns every other row's existing Δ column into an A-vs-B answer, with no new columns.
- [x] **Durable pin identity.** `_id` is `results.length` at build time, so it does not survive a re-run; the pin is stored as `compareSelection = row._selection` and re-found via `sameStrategySelection` — the same matcher the 📍 CURRENT PLAN row uses. `compareIsCurrentPlan` disambiguates the current-plan row from its swept twin (they share a selection but not a conversion setup). A pin whose strategy leaves the table is dropped, not left dangling.
- [x] **The change in meaning is never silent:** `#opt-compare-banner` names the reference with a "Back to ⚓ baseline" button, the two column headers gain " vs ⚖", and both Δ tooltips are built from `deltaRefDescription()`.
- [x] **The ⚓ BASELINE pinned row no longer prints a hard-coded `0`** in its Δ cells when a compare row is pinned — with a different reference it has a real Δ like everything else, and printing 0 would have been a lie.
- [x] ⚖ carries `event.stopPropagation()` so it does not also fire the row's load-this-strategy click.
- **Verify:** browser — pinning Proportional ✓ set its own Δ to 0 and the ⚓ baseline to +554,876, exactly `baseNW - pickNW`; header read "ΔNetWealth vs ⚖" and the dTax tooltip named the row; a full re-sweep at a different spend goal kept the pin on a **new row object** (`sameObject: false`, Δ still 0); a selection matching nothing cleared the pin, hid the banner, restored the baseline Δ to 0 and reverted the header; a real DOM click on ⚖ pinned without touching the sidebar (strategy/param/years all unchanged), and a second click unpinned; 160 ⚖ affordances for 160 displayed rows. Console clean apart from the 4 known fixtures.
- **Files:** `optimizer_ui.js`, `optimizer_core.test.js`, `retirement_optimizer.html`.

---

## PR-C Full Retirement Age from birth year (2026-07-27) — COMPLETE, merged in PR #135 as v11.13a1

**Status: COMPLETE**, node 145/145 (+4) + taxPaymentPlanner 12/12, browser verified.

**Why:** `FRA_MONTHS = 67 * 12` was hard-coded (`optimizer_core.js:510` before this change) and did **three** jobs belonging to **two** people: unwinding the DECEASED's benefit back to their PIA, testing the SURVIVOR's own early claim, and sizing the 60-to-FRA span the 28.5% reduction is spread across. FRA is 66 for 1943-1954 and steps up two months per birth year through 1959.

- [x] **`fraMonthsForBirthYear(birthYear)`** (pure, exported). Pre-1943 clamped to 66 with the reason documented (the real schedule steps to 65 for 1937 and earlier, but that person is over 89 today and cannot be a plan's starting spouse).
- [x] `calculateSurvivorBenefit` gained `userBirthYear` / `spouseBirthYear`, each defaulting to 1960 so an omitted argument reproduces the old constant exactly. Both call sites pass `birthyear1`/`birthyear2` in the correct order for who died.
- [x] **Error direction confirmed, not assumed:** deceased born 1952 claiming early at 62 on $2,000/mo, survivor born 1955 claiming at 67 -> **$2,857/mo before, $2,666/mo after**. The hard-code paid the survivor MORE than they are due, which is the wrong direction for a tool shipping a `widowrmd` objective. This reproduces the appendix's measured 6.7% ($68,568 vs $63,996 at $4,000/mo).
- [x] End-to-end on a pre-1955 couple (born 1950/1952, higher earner claims at 62, dies at 80): first survivor year **$51,076 -> $49,148**, final NW $3,467,750 -> $3,426,064 (-1.2%), tax $775,770 -> $765,463 (-1.3%).
- **Byte-identical for anyone born 1960 or later** — asserted as a test, and the 8-scenario harness is unchanged because every fixture in it is born 1960+. **The app's own default scenario is also unchanged**, because both defaults claim at 70: a late claimer's baseline is `max(PIA, benefit)` = the benefit, so FRA drops out. Only early claimers move.
- **Files:** `optimizer_core.js`, `optimizer_core.test.js`, `retirement_optimizer.html`.

---

## PR-B Social Security claim-year proration + start milestones (2026-07-27) — COMPLETE, merged in PR #135 as v11.13a1

**Status: COMPLETE**, node 141/141 (+8) + taxPaymentPlanner 12/12, browser verified. **Not byte-identical, by design** — see the measured table below.

**Why:** SS was gated all-or-nothing on integer age (`optimizer_core.js:966`), so a December claimant booked a full year of benefits in the year they turned their claiming age. `birthmonth1`/`birthmonth2` already existed, already reached the engine and already round-tripped in share URLs; only `isQCDEligible()` read them.

- [x] **`ssFirstYearFraction(birthMonth)`** (pure, exported): `(12 - bm) / 12`, anything missing or out of range treated as December. Applied at the normal-claim gate and at the survivor gate, in each case only in the year `age === Math.ceil(claimAge)`.
- [x] **The survivor branch is not only for survivors.** A single filer has `alive2 === false` from year one, so `!yr.alive1 || !yr.alive2` is true for them every year and their own benefit is computed through `calculateSurvivorBenefit`'s higher-of rule. Flagging that as a survivor start would have told every single filer their survivor benefit had begun; `yr.isSurvivorSS` is therefore gated on `birthyear2 > 0`.
- [x] **`-ssStart1` / `-ssStart2` / `-ssStartSurvivor`** hidden log fields (leading `-` keeps them out of Annual Details, the `-fedRateCreep` idiom) + `Your SS begins` / `Spouse SS begins` / `Survivor SS begins` markers in `computeMilestones`, in a new green `SS_MILESTONE_COLOR`. Added to the `mc-chart` filter too: SS start years are deterministic across MC paths for the same reason death and RMD start are.
- [x] **Two latch bugs, both caught by running it rather than reading it.** (1) A boolean latch marked the row on `computeIncome`'s first call and cleared it on a later one, so nothing ever reached the log; the latch stores the YEAR instead. (2) Found in the browser on the app's OWN defaults: the default spouse (born 1952, claiming at 70) started in 2022, four years before the 2026 start year, and the chart announced "Spouse SS begins" in year 0. The flag now means "was zero last year, is positive now" — a plain first-positive-year test just relocates the wrong marker to year 1. Both cases are now tests.
- [x] **Disclosure** (per the user's "unconditional, disclosed" decision): both Start Age tooltips and both birth-month tooltips name the proration and the December consequence; changelog entry carries `data-flag="behavior"`. December default deliberately kept — moving it to June would silently shift QCD 70.5 eligibility via `taxengine.js:1512-1515`.
- **Not modelled (stated in the changelog, not half-built):** the mirror case at the other end, where benefits stop the month of death rather than at year end.
- **Verify:** node 141/141; reverting only the three `ssFrac` expressions fails exactly 5 of the 8 new tests (the two pure-helper tests correctly still pass). Browser v11.1391 on the app's defaults: 2030 SS $26,803 (spouse only, user prorated to zero), 2031 $82,661 (both); switching the user to a June birth month moved the marker to 2030 and paid $53,606 there, exactly spouse $26,803 + half of the user's $53,606. No `ssStart` columns leaked into Annual Details. Console clean apart from the 4 known fixtures.
- **Not byte-identical** — 8-scenario harness, both fixture people December-born so each loses a full claim year:

| scenario | final NW | tax | | scenario | final NW | tax |
|---|---|---|---|---|---|---|
| fixed | -2.10% | -2.05% | | gk | -1.88% | -4.24% |
| bracket | -4.54% | -4.39% | | cyclic | -5.50% | -0.78% |
| aca | -0.28% | -4.69% | | scalarEca | -4.39% | -3.38% |
| propwd | -3.87% | -4.96% | | noconv | -4.54% | -7.46% |

  Direction is consistent here only because every fixture is December-born; magnitude is not proportional between wealth and tax (cyclic -5.50% NW but -0.78% tax; noconv -4.54% NW but -7.46% tax), which is the provisional-income threshold effect the plan predicted.
- **One existing test re-derived:** the GK prevPortfolio regression test (January + June birth months, claiming at 70) — spend 7,969,501.955988 -> 7,935,798.156794, tax 2,154,586.451134 -> 2,140,785.745597, final NW 9,955,429.693910 -> 9,920,517.469072. Its actual subject, the guardrail-adjustment count, is unchanged at 4.
- **Files:** `optimizer_core.js`, `optimizer_ui.js`, `optimizer_core.test.js`, `retirement_optimizer.html`.

---

## PR-A MC stress auto-run + Stress Failure tile + dead-code delete (2026-07-27) — COMPLETE, merged in PR #135 as v11.13a1

**Status: COMPLETE**, node 133/133 + taxPaymentPlanner 12/12, browser verified, engine files untouched so byte-identity is guaranteed by construction.

**Why:** editing an input while the Monte Carlo tab was open left every chart, the survival table and the stress pass silently describing the PREVIOUS plan until the tab was re-activated. `mcTabActivated()` was only ever called from the tab button.

- [x] **The plan's first design was wrong and the measurement caught it.** The plan proposed calling `mcTabActivated()` from `scheduleRecalc`, mirroring the `tab-opt` branch. Measured on the default scenario: **27.4s** for a full run (500 paths x 144 variations = 72,000 sims), so an edit-triggered full run costs half a minute of CPU per blur. User chose (AskUserQuestion) the split: refresh the cheap pass, flag the expensive one.
- [x] **`cfg.stressOnly`** in BOTH `montecarlo/worker.js` and `montecarlo/mc_controller.js` (the main-thread `file://` fallback mirrors the worker and the two must not drift): skips the main pass, gives stress the whole progress weight, posts `{ stressOnly:true, stress }`. The stress message shape was extracted to a shared `buildStressMsg()` / `_buildStressMsg()` in each file so the two exit paths cannot diverge.
- [x] **`mcInputsChanged()`** (`mc_tab.js`), called from `scheduleRecalc`'s new `tab-mc` branch. Guards: no-op in nerd mode, no-op when nothing has been run yet, no-op when the hash is unchanged. Then `markMCStale(true)` + `refreshMCStressOnly()`.
- [x] **`refreshMCStressOnly()`** re-runs stress only (stressCount x 1 sims) and swaps `_mcResults.stress`. Deliberately does NOT call `setMCRunning()` (the progress bar would flash for a sub-second run), returns early in Synthetic mode (no stress pass exists), and checks the new **`_mcWorkerBusy()`** so it never terminates a full run in flight — `runMCWorker` kills any live worker on entry.
- [x] **`#mc-stale-banner`** with a Re-run button; text is rewritten by `markMCStale()` per mode, because in Synthetic mode the "Stress Failure result is current" half would describe something not on screen. Cleared by `runMonteCarlo`'s completion and by `mcTabActivated`'s cache-hit branch.
- [x] **Calibration guard:** `runMCWorker` fed `msg.totalMs / (numPaths * variations)` into `_mcMsPerSim`. A stress-only run is a handful of sims and would have wrecked the time estimate; now skipped when `msg.stressOnly`.
- [x] **Stress Failure tile** (`buildStressFailureTile`, `mc_tab.js`) above the existing asset-range table. Reads `stress.variations[0].survivalRate` (since PF3 the stress pass runs exactly one variation, the current plan) and `stress.numPaths`. Same colour bands as `renderSurvivalTable`.
- [x] **Dead code deleted:** `updateProjectedRMDStat()` and its only call site. It wrote to `stat-proj-rmd1`/`stat-proj-rmd2`, which have not existed in the HTML for some time. `RMD_TABLE` is used elsewhere and stays.
- **Verify:** browser v11.1391 — full run 45.1s / stress 7 of 10 sequences (median ruin year 2040); spend goal 140k -> 200k then blur: stress refreshed in **306ms** to 10 of 10 (median ruin 2034), stale banner appeared, and the main sweep was untouched to the dollar (same `totalMs`, 144 variations, identical `variations[0].survivalRate`). Synthetic banner text verified; `mcInputsChanged()` with no prior results does not start a run; console clean apart from the 4 known intentional bad-input fixtures.
- **Byte-identical:** yes, trivially — `optimizer_core.js` and `taxengine.js` are untouched (`git diff --stat` empty).
- **Files:** `montecarlo/mc_tab.js`, `montecarlo/mc_controller.js`, `montecarlo/worker.js`, `optimizer_ui.js`, `retirement_optimizer.html`.

---

## PR3 CURRENT PLAN row in the Optimizer + Earliest Break Even winner (2026-07-27, v11.1387) — COMPLETE, merged PR #133 (`5ceda24`)

**Status: COMPLETE**, node 133/133 (+8) + taxPaymentPlanner 12/12, browser verified. User decisions via AskUserQuestion: real simulated row + inline marker; mirror `buildVariations`' off-grid rule into the Optimizer's own sweep; rank the current plan AND let it win metrics.

**Why:** the table ranked ~180 swept strategies but never contained the user's own plan, so "is the optimizer's pick better than what I'm doing?" was unanswerable. Three causes: every swept row forces `convertExcessToRoth: true` and `runOptimizer` strips the sidebar's `extraConversionAmount`/`convEndYear` (correct for the sweep, but it means no row is the user's plan); off-grid parameters produced no row at all; and no "current" marker existed.
- [x] **`sameStrategySelection(a, b)`** (pure, core): full strategy identity on plain engine field names. Replaces MC's local `findCurrentStrategyIdx` matcher, which returned `false` for **gk and ordered** (those users silently got the synthetic "Current Plan" fallback in Stress mode) and ignored `stratIRMAATier` (an IRMAA-ceiling user paired with a plain bracket row). `findCurrentStrategyIdx` now delegates. **MC behavior change for gk/ordered users.**
- [x] **`offGridParamFor(base, grids)`** (pure, core): the "push the user's value when it is off the grid" rule, extracted from `buildVariations` and now used by both sweeps so they cannot drift. Grids are passed in because they genuinely differ (Optimizer sweeps IRA Draw to 20%, MC to 10%).
- [x] **`_selection` on every row** (effective `inputs`, never `overrides`): what the matcher consumes, and it closes a **pre-existing round-trip bug** — `orderedSeq` was never recorded nor restored, so clicking "Ordered RIBC" left the sidebar's own sequence (PF8 bug class). GK guardrails restore from it too.
- [x] **📍 CURRENT PLAN row:** simulated from a `userPlan` snapshot taken before `runOptimizer` strips the conversion fields; added last so it is never cloned into 🗘/🔄/💵/(no conv)/✦ variants; pinned sticky under ⚓ BASELINE (amber `#fff3cd`, offset measured from the rendered rows since `display:contents` wrappers report height 0); also ranked in the body and eligible to win metrics. Excluded from `selectConversionCandidates`. **Trap:** `currentHash` is computed from the already-stripped `base`, so `extraConversionAmount`/`convEndYear`/`convEndMode` had to be hashed separately or a cached table returns a stale current row.
- [x] **📍 inline marker** on exactly one swept row (prefers the match whose conversion switch also agrees with the sidebar).
- [x] **⏱ Earliest Break Even Best winner**, plus the latent defect behind it: `_convBEYear` was set only on ⇌ rows, so the `earliestbe` objective sorted every row on the same 9999 sentinel and did nothing. `addResult` now runs `computeOC: true` (measured 1.96x / +74ms on a 144-row sweep; live table 1337ms / 1711 runs, inside the 2.5s budget). Winner picks only rows that HAVE a break-even; ties break on `afterTaxNWCurrentDollars`, and `OPTIMIZER_OBJECTIVES.earliestbe` got the identical rule so ordering and winner cannot disagree.
- **Verify:** node 133/133 (+8: matcher per family incl. gk/ordered, bracket tier identity, cyclic/💵 identity, MC regression, off-grid on/off-grid, +3 variations for an off-grid user, earliestbe tie order, computeOC precondition). All 8 engine hashes byte-identical (engine untouched). Browser v11.1387: CURRENT row == `simulate(getInputs())` to the dollar ($813,254) and differs from its swept twin ($1,201,165); it won 📉 Lowest Tax on its own merits; off-grid 7% row present and marked; clicking the pinned row left the sidebar intact; changing only the Extra Conversion re-ran and updated the row ($564,869 → $983,705); Earliest Break Even reorders the body (BE 2049 rows on top, net wealth descending within the tie); Ordered CBIR → clicking an RIBC row now sets RIBC; MC matches gk (idx 35) and ordered RIBC (idx 33); only the 4 known console fixtures.
- **Not byte-identical:** the table gains 2 rows (current + off-grid) and the Break Even column fills in; MC Stress changes for gk/ordered users; MC variation order shifts for off-grid users (the row moved from mid-list to after IRA Draw).
- [x] **Follow-up (user-reported): the Summary Header went stale on the Optimizer tab.** Flipping Maximize Conversions there appeared to do nothing to Break Even. Not the hash (the table recomputed correctly, 813,254 -> 805,737): `setupAutoRecalc`'s `scheduleRecalc` branched `tab-opt -> runOptimizer()` only, and the always-visible Summary Header (Break Even + its ⓘ, End Wealth, taxes, Withdrawal Rate) is rendered by `runSimulation()`. Clicking Chart / Annual Details "fixed" it only because those tab buttons call `runSimulation()` themselves. Now `runSimulation()` always runs and `runOptimizer()` is additive. Cost: 79ms against a 1185ms sweep (~6%). Pre-existing, predates this session.
- **Files:** `optimizer_core.js`, `optimizer_ui.js`, `montecarlo/mc_tab.js`, `optimizer_core.test.js`, `retirement_optimizer.html`.

---

## PR2 Conversion-schedule representation divergence (2026-07-26, v11.137f) — COMPLETE, merged PR #133 (`a2fb3f8`)

**Status: COMPLETE**, node 125/125 (+3) + taxPaymentPlanner 12/12, browser verified. Root-cause and the general rule in findings.md.

**The bug (one expression, `optimizer_core.js:868`):** the year-0 Early(Conv)/Late(Spend) withdrawal-timing trigger read `(inputs.extraConversionAmount ?? 0) > 0`. A multi-element array coerces to `NaN`, so array-driven plans silently ran Late(Spend); the same test ignored suppression, so a stop year already in the past still claimed a conversion year. This is the divergence PR1 left open.
- [x] New pure `_extraConvAmountFor(inputs, y)` next to the existing suppression helpers: array-or-scalar element, zeroed by `_extraConvSuppressedThisYear`. Now the single accessor for BOTH `applyExtraConversion` and the timing predicate; the bracket/aca half of the predicate also gained `!_convSuppressedThisYear(inputs, 0)`.
- [x] `bestConversionStopYear` mode `'extra'` cuts via the public `convEndYear`/`convEndMode` pair instead of a zero-tail array, so no production path builds the divergent representation. Array branch kept (and now correct) for a caller that passes one.
- [x] 3 new tests: array ≡ scalar+convEndYear at cut 0 / interior / n; full array ≡ plain scalar with `timing === 'Early(Conv)'`; a suppressed year 0 (past `convEndYear` and `_cfSuppressConversionsFromYear: 0`) ≡ converting nothing. All three verified to FAIL when the one-line predicate change alone is reverted.
- [x] Two hard-coded expectations re-derived in the array-driven `diagnoseConvBreakEvenFailure` boundary test (`breakingAmount` 355,478 → 355,562; `lastSustainableBEYear` 2041 → 2042). `breakingYear` 2031 and `lastSustainableYear` 2030 unchanged.
- **Impact:** the two ⓘ stop-scope modes used to report different gains for the same cutoff ($59,706 vs $57,549 `gainVsFull`) and `gainVsNone` was overstated by $8,916 (STOP_BASE fixture). Both now agree, and the one-click "Stop after YYYY ▸" reproduces the searched score to the dollar (browser: promised = actual = $17,342,828, both modes).
- **Not byte-identical:** the ⓘ suggested stop year / gains; scenarios with `convEndYear` at or before the start year; anything driven by a per-year array. **Verified byte-identical** across 8 scenarios (fixed/bracket/aca/propwd/gk/cyclic/scalar-eca/no-conv) — the strategy sweep, MC, Annual Details and the Tax Planner handoff are untouched.
- **Files:** `optimizer_core.js`, `optimizer_core.test.js`, `retirement_optimizer.html` (title + core `?v=` + changelog `data-flag="behavior"`).

---

## PR1 Roth Conversion Diagnostics (2026-07-26, v11.1370) — COMPLETE, merged PR #132

**Status: COMPLETE**, merged as [PR #132](https://github.com/nightskyguy/retirement_assets/pull/132) at `9d3ed21`, node 122/122, browser verified. Full detail in progress.md and findings.md.
- [x] **A.** `Avg BETR` column + `#stat-betr-wrap` tile removed; kept in Annual Details (`BETR%`/`betrFlag`, Opp. Cost) with a reliability caveat added to its tooltip.
- [x] **B.** `Conv Savings` → `Tax Paid Δ`; tooltip leads with the limitation.
- [x] **C.** New pure `breakEvenHeirsRate()` / `lowestBreakEvenHeirsRate()` in `optimizer_core.js`; banner names the assumed future rate and offers an on-demand threshold search.
- [x] **D.** New pure `bestTimeLimitedConversion()` (convert-then-stop). Fires only for candidates the flat sweep left empty, capped at 6 by terminal IRA. Rows tagged `⏹YYYY`, `_convEndYear` round-trips through `loadOptimizerResult`.
- [x] Docs: findings.md investigation writeup, README FAQ entry + Recent Fixes, changelog `data-flag="behavior"`.
- **Not byte-identical:** the ⇌ row set and suggested amounts change (D). A/B are display-only.
- **Left open → CLOSED by PR2 above (v11.137f):** the array-vs-`convEndYear` engine divergence. The array path was the wrong one; root cause was the year-0 withdrawal-timing predicate, not the conversion math.
- **Deferred → ALL CLOSED 2026-07-27** by PR-A/PR-B/PR-C/PR-D above (SS first-year proration + milestones + birth-year FRA, head-to-head strategy compare, MC stress auto-run + "Stress Failure X of Y" tile). The original design notes remain in the plan file appendix at `C:\Users\starc\.claude\plans\not-sure-where-it-eventual-gray.md`; the appendix's dead-code note (`updateProjectedRMDStat`) was actioned in PR-A.

---

## README Audit Round 2 + AiRA Tool Review (2026-07-25): PR #131 — COMPLETE

**Status: COMPLETE**, merged [PR #131](https://github.com/nightskyguy/retirement_assets/pull/131). Doc-only (README.md, .gitignore, .planning/FILE_DIRECTORY.md new). Full detail in progress.md. Summary: ToC rebuild (missing FAQ + 3 Free Tools + misfiled entry), broken link fix, duplicate-heading anchor collision fix, 2 new quick-launch entries documented, ~20 typo/grammar fixes, new AiRA Retirement Application review entry, dead Anonymous Reddit Tool entry dropped, `.planning/FILE_DIRECTORY.md` added, `netcitizen.us.*` gitignored.

---

## Documentation Polish (2026-07-24/25, v11.1340): Post-P2 clarifications, FAQ, changelog refactor, Cash Reserve "Off"

**Status: COMPLETE** (tooltip + BETR section + ToC rebuild + FAQ + changelog refactor + Cash Reserve default)
- [x] **Cash Reserve tooltip revision:** Removed redundant "blank or -1" mention, replaced with recommendation to turn on Dividend Reinvestment for best benefit. Verified in-browser.
- [x] **Dividend + reserve + growth rate interaction:** Documented how DRIP off routes dividends to Cash at cashYield; reserve fills buffer first, overflow to Brokerage at market growth. Clarified per-account growth rates.
- [x] **README "How Reliable Is the Break-Even Tax Rate?" section:** Added under "Some Things I Learned About Taxation" — non-technical explanation of BETR (closed-form heuristic), finding (unreliable in practice), and recommendation (treat as conversation-starter, not decision rule). One paragraph.
- [x] **README ToC rebuild:** Promoted bold subtopic labels to real `####` headings, added Standalone Calculator Tools subtopics and full Taxation subsections so table of contents reflects all navigable sections.
- [x] **README FAQ section:** 6 Q&A entries (Cash Reserve/dividend interaction, depletion scenarios, cash interest routing, brokerage-vs-cash distinction, Roth conversion efficiency / Stop-Year, BETR reliability), matching the Taxation section's conversational-precise tone.
- [x] **Changelog restructure (PR #129):** inline changelog trimmed to the 5 most recent entries; older entries (v11.12e5 and back) moved to new `optimizer_history.js`, lazy-loaded on "Older changes…" expand instead of shipping on every page load. Version stat added to Summary Header, sourced at runtime from `<title>` (title itself stays hardcoded — see findings.md "GA title-timing" entry for why). "Latest Change" banner added above the collapsible Change Log (always visible, can't be hidden), plus a `data-flag="behavior"` convention to flag entries that alter computed results.
- [x] **Cash Reserve now defaults to "Off"** (was a blank box). Blank and `-1` still work silently for old saved scenarios/shared links but are no longer advertised in tooltip/placeholder. Capture-phase blur listener normalizes case and bypasses the shared dollar-formatting helper so the value isn't reformatted or reverted. See findings.md for the full investigation (getInputs()/DOLLAR_INPUT_IDS/share-URL implications).
- [x] Small wording fix: "Even the first conversion…" → "The first conversion…" in the Break-Even diagnosis message (`optimizer_ui.js`).

**Files:** `retirement_optimizer.html`, `optimizer_ui.js`, `optimizer_history.js` (new), `README.md`.
**Status:** merged as [PR #129](https://github.com/nightskyguy/retirement_assets/pull/129).

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
- [x] **Round 3 (user follow-up, v11.12f7):** terminology normalized — every "nerd knob(s)" / "nerd-knob" / "nerd mode" / "nerd-mode" variant renamed to **`nerdknob`** (the switch's actual name) across HTML + all JS; the surviving references are only for features that ARE still gated, so they were renamed not deleted. Objective labels made **parallel** (Maximum Net Wealth / Avoiding Widow & RMD Tax / Minimum Lifetime Taxes), updated in both the `<option>` list and `OPT_OBJECTIVE_LABELS`. **"Optimize for" moved to the top of the Optimizer tab**, directly under the two search switches, in its own prominent panel (14px vs the 11.9px search row, bold label, tinted background). **New Documentation entry** "What does 'Optimize for' do?" with a sub-bullet per objective. **Bug caught by screenshot:** the ⚓ "Best w/o Conv" row still showed an infeasible `Fill Bracket (no conv) ⚠️` — the round-1 item-2 fix filtered only the per-metric winner pool, while `recomputeBaselineForObjective` had no feasibility filter, so an infeasible no-conv row could be pinned as baseline and listed in the Best summary. Fixed by preferring feasible no-conv rows (falling back only if all are infeasible, so Δ columns survive); verified feasible under all 7 non-conversion objectives.
- **Status:** DONE, PR #124 (PF11 + PF13 together). **Files:** `optimizer_core.js`, `optimizer_ui.js`, `optimizer_core.test.js`, `retirement_optimizer.html`, `montecarlo/mc_tab.js`.

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
| — | **P38** | **Baseline/proportional strategies cannot fund their own tax bill — shipped defect** | **complete** (PR 1 + PR 2 merged as #152, PR 3 = v11.146a) | — |
| — | **PF** | UX Polish Batch (9 items, IRMAA fix + MC restructure) | **complete*** | — |
| — | **PF2** | Item 6 round 2 — bar-chart legend hover/click | **complete** | — |
| — | **PF3** | MC Stress pass should run current strategy only, not all variations | **complete** | — |
| — | **PF5** | Break Even dual-sim counterfactual + small-screen UX batch | **complete** | — |
| — | **PF6** | Break Even sustained-crossing fix (first-touch bug) | **complete** | — |
| — | **PF7** | Break Even in the Optimizer (Optimize Conversions top-5) | **complete** | — |
| — | **P1** | Suggest Spend Goal (38#10) | **complete** | — |
| 1 | **P2** | Cash Reserve — surplus routing + reserve floor | **done** (v11.1340) | — |
| 2 | **PA** | Pension Start Age | **complete** | — |
| 3 | **PB** | Lumpy Spending (no URL encoding) | pending | — |
| 4 | **PC** | Auto-Persist + Restore Offer | pending | — |
| 5 | **P4** | Creeping Tax Rate Model | Option A done and **un-gated** (PR #137, v11.13bd); Option B not started | — |
| 6 | **P5** | Conversion Schedule — Greedy DP (23b) | pending | — |
| 7 | **P6** | Simulation Sanity-Check Tests | pending | — |
| 8 | **PD** | Onboarding Interview (replaces P7 stepper) | pending | — |
| 9 | **PE** | Insights / Feedback Panel | pending | — |
| 10 | **P8** | Annual-table View Presets (38#6) | pending | — |
| 11 | **P9** | ACA Refinement (remainder) | partial | — |
| 12 | **P10** | Upgrade Equity Data (Fama-French) | pending | — |
| 13 | **P11** | RealReturns — Intl Asset + Annual Mode | pending | — |
| 14 | **P12** | Retire Optimizer Tab → MC Strategy Compare | pending | — |
| 15 | **P13** | Multi-Strategy Segment Optimizer | pending — **see P35**, which answers the same need for ~4 rows instead of ~10,000 combos; decide whether P13 is superseded once P35 ships | P9 |
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
| 26 | **P24** | Conversion End Year — searched stop-year + one-click | **implemented** (v11.1330, sweep dim deferred) | — |
| 27 | **P25** | Markdown docs render in a browser | **complete** (v11.13c5; Jekyll already did it, no viewer built) | — |
| 28 | **P26** | README/FAQ cross-references from tooltips | pending | P25 done, unblocked |
| 29 | **P27** | Assumption Sensitivity tornado (growth / inflation / lifespan / SS / tax drift) | scoped 2026-07-30, not started | — |
| 30 | **P28** | Every voluntary IRA withdrawal as a Roth conversion | **research done** 2026-07-30 (routing inert, Roth-first is the lever); feature decision open | — |
| 31 | **P33** | Insights panel — sources of spend, earnings, terminal mix | not started, **build-first** | shares a surface with PE |
| 32 | **P34** | Conversion search cost — profile, cache, worker | not started; **measure before other phases add sweep arms** | — |
| 33 | **P30** | Withdrawal policy — gap-fill constants + orderings + decoupling | not started, research-first | P28 ship decision |
| 34 | **P32** | Brokerage draws + gain harvesting | not started, research-first | prefer after P30 |
| 35 | **P31** | Asset mix reverse mapping | not started, research-first | prefer after P30/P32 |
| 36 | **P29** | Hebeler Autopilot spend rule | not started, research-first | — |
| 37 | **P35** | "Phased" withdrawal strategy (8 PRs, staged) + basis step-up | not started, **build-first**; PR 1-2 are pure scaffolding | — |
| 38 | **P36** | Phased efficiency study — do any strategies never win? | not started; **runs between P35 PR 6 and PR 8** | P35 PR 2 (enumeration extraction) |
| 39 | **P37** | LEGACY / heir 10-year drawdown | **deferred by the user**, recorded only | — |

**Rows 37-39 are the 2026-08-03 batch.** P35 is staged internally (its own PR table below) and its
PR 7 *is* P36, so the three do not run in row order. P35's PR 2 extracts the sweep enumeration into
`optimizer_core.js`, which **also unblocks P36** and would benefit P29/P30/P31/P32, all of which
currently plan to copy P28's ladder by hand.

**Rows 31-36 are the current batch, and their ROW ORDER IS THE RECOMMENDED RUN ORDER** (so the phase
numbers deliberately run out of sequence). P33 first: build-first, no research, no dependencies, and
it produces the instrumentation — earnings/inflows accumulators, Brokerage-drawn total, cash-breach
count — that P31 and P32 both want to read. It is also the only one of the six that visibly improves
the tool this round. P34's MEASUREMENT half runs alongside it, because a baseline profile has to be
captured before any other phase adds a sweep arm. P30 next: it settles two constants sitting on the
code path P28 valued at up to $3.5M. P32 follows on that same path. P31 after both, because running
it earlier risks describing a mix the tool is about to change. P29 is fully self-contained and fits
wherever there is slack. P34's BUILD half goes last, so its budget numbers reflect whatever arms the
other phases added.

**Cross-cutting saving:** P29, P30, P31 and P32 all want P28's 5-mix x 3-spend-rate ladder. Factor it
once — a shared fixture module under `.test_harnesses/`, or copy it with a comment naming the source.
Largest schedule saving available across the six.

**Upstream item:** P28's own open ship decision (see P28 below) sits above P30 and P32. Settle it in
the same batch or hold both explicitly.

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

## Phase P2: Cash Reserve — surplus routing + reserve floor (DONE, v11.1340, was 38#9)
**Why:** `CashReserve` was captured but inert. The BETR/DRIP audit (findings.md 2026-07-23) showed the non-cyclic default banked ALL surplus (mostly forced RMDs) into 3% Cash and left it, starving the no-conversion world and biasing Break Even / opportunity cost / BETR / the P24 stop-year toward converting. Implementing CashReserve as a target cash buffer fixes both the routing and the (planned) floor, and is the largest single lever over the tool's conversion verdict (it flips the empirical break-even; see findings.md P2 entry).

**Semantics (user-specified, three-way):** blank or negative -> `undefined` = OFF (legacy: all surplus to Cash, no floor; the revert switch). `0` = zero buffer, reinvest ALL surplus to Brokerage. positive $Y = keep $Y (today's dollars, inflated by `sim.inflation`) in Cash, reinvest the overflow to Brokerage (basis step-up), and protect $Y on withdrawal as a breakable last resort.

- [x] **Surplus routing** — `routeSurplusAndConvert` tail: OFF/Cyclic unchanged (Cyclic subsumes); active -> `toCash = clamp(0, reserveNominal - Cash, surplus)`, overflow to Brokerage + basis step-up. New hidden log `-surplusToBrokerage`.
- [x] **Reserve floor** — `resolveSpendTarget` hides the buffer from `curBalances.Cash` (via `yr._reserveHidden`); `resolveResidualAndForcedIRA` restores it and, only if spending is still unfunded after Cash/Brokerage/Roth/forced-IRA, draws it and sets `yr.cashBreach` (hidden log `-cashBreach`). Both new log fields wired into `logYear`'s record object (they are NOT auto-picked from `yr`).
- [x] **UI** — `getInputs` three-way parse (blank/neg -> undefined; 0/positive pass through); markup default `value=""` + tooltip rewrite; URL `cr` already mapped; no `runOptimizer` leak-guard (a uniform assumption, applied to all strategies).
- [x] **Load warning** — `maybeWarnCashReserveActive()` fires from `loadFromURL`/`applyScenario` when the incoming value is active (>= 0), naming blank/-1 as the revert. Not on recalc.
- [x] Tests (`optimizer_core.test.js`, +6, 114/114): OFF byte-identical + never reinvests/breaches; 0 reinvests all (basis step-up, far less terminal Cash); 0 != OFF; positive buffer reinvests overflow; floor protected early + breaks as last resort when depleted; healthy plan never breaches.
- [x] Harness re-run captured in findings.md (`.test_harnesses/betr_harness.js` gained a reserve-sensitivity table). Reserve flips both BETR's empirical t* and the P24 stop-year recommendation.
- **GOTCHA:** `logYear` builds its record from an EXPLICIT param object, not `yr` — a new `yr.<field>` logs as 0/undefined until added there (cost ~15 min chasing a "floor not firing" ghost that was really an unlogged flag).
- **Status:** DONE and MERGED (v11.1340, confirmed present on `origin/main`). node 114/114 + taxPaymentPlanner 12/12 at the time.
- **Follow-up (separate):** BETR itself is unreliable in both reserve regimes (findings.md); consider replacing the closed-form signal with the empirical break-even from two sims.

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

## Phase P15: Structural Refactoring Remainder (was Phase R)
**Why:** `simulate()` still too large. `getElementById()` DOM calls in core.js violate separation of concerns. ES module migration blocked by `importScripts()`.

**All three items done (2026-07-10):**
- [x] **R3:** Split core.js into pure engine + UI file — DONE (PR #114, v11.11f3): `optimizer_core.js` (engine) + `optimizer_ui.js` (DOM).
- [x] **R4:** Pragmatic dual-mode instead of full ES modules (full migration would cascade into 8 consumer HTML pages with no build step) — DONE (PR #115): UMD export guards in taxengine.js (12 symbols) / optimizer_core.js / displayhelpers.js; optimizer_core.test.js harness rewritten from vm.runInContext to require() with taxengine exports mirrored onto globalThis. Worker keeps importScripts; zero HTML changes.
- [x] **R1b:** Full phase decomposition of `simulate()` — DONE (PR #116, v11.11ff): 1,117 → ~215 lines. Year loop = 16-line sequence of phase functions (beginYear, resolveHousehold, computeIncome, resolveSpendTarget, planPrimaryWithdrawals, applyPrimaryAndTaxPass1, fillSpendingGap, resolveResidualAndForcedIRA, routeSurplusAndConvert + cfRefundIRA helper, applyExtraConversion, attributeIncrementalTaxes, growAndSettle, evaluateYearOutcome, logYear, endYear) sharing explicit `sim` (loop-carried) and `yr` (per-year, ~76 fields) state objects. 12 commits: rename-only field conversion first, then bottom-up verbatim cut-paste moves, then dead-code removal. Every commit verified: node 60/60 + 22-fixture golden-run harness byte-identical (all strategies, cyclic, maxConversion, extraConversion, computeOC both paths, spouse death both orders, QCDs, ssFailYear).
- **Status:** complete pending merge of PRs #115 (R4) and #116 (R1b, stacked on #115). Browser-verified at v11.11ff: 240/240, optimizer, MC worker, other consumer pages clean. Archive to task_completed.md after merge.

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

## Phase P25: Markdown docs render in a browser (2026-07-29, v11.13c5) — COMPLETE, premise was wrong

Solved WITHOUT the viewer specced below. The spec assumed nothing rendered these files except
github.com. **That was never true.** GitHub Pages runs Jekyll over this repo on every push to
`main` (default theme `jekyll-theme-primer`) and publishes every `.md` as themed HTML at its
`.html` URL. Verified by HTTP on 2026-07-29, before writing any code:

| URL | Status | Content-Type |
|---|---|---|
| `/optimizer_changelog.md` | 200 | `text/markdown` (browser downloads it) |
| `/optimizer_changelog.html` | **200** | **`text/html`, 57,564 bytes, fully rendered** |
| `/ARCHITECTURE.html` | **200** | **`text/html`**, tables + ToC anchors working |
| `/README.html` | 404 | README maps to `/` instead |

Served markup proves it: `<meta name="generator" content="Jekyll v3.10.0" />` plus primer's
`<div class="container-lg px-3 my-5 markdown-body">`. All 58 explicit `<a id="11.13a1"></a>`
anchors survive kramdown intact, so the per-version deep links already worked at the `.html` URL.
The 5 mermaid fences become `<pre><code class="language-mermaid">`.

So the fix was to point the links at pages that already existed, not to build a renderer. Nothing
below got built: no `docs.html`, no `?f=` parameter, no markdown parser, no sanitizer, no CDN. The
`file://` constraint that the spec called "the whole problem" evaporated with the `fetch()`.

**What shipped:**
- `doclinks.js` + `doclinks.test.js` (16 tests) — `docHref()` maps a relative `*.md` href to the
  Jekyll page, preserving `#hash`/`?query`. Hrefs in the markup STAY `.md` (true on disk, so
  `file://` and localhost keep working) and are upgraded at runtime only when the origin is not
  local. `window.__DOCLINKS_FORCE_RENDERED` overrides the origin check for testing. Guards:
  absolute URLs untouched (the theme's "Improve this page" edit link is an absolute `.md`),
  `README.md` -> the directory index not `README.html`, dot-directories left alone.
- `_includes/head-custom.html` — the theme's one documented customization hook. Inline CSS plus the
  `doclinks.js` tag. No `_config.yml`, deliberately: if Jekyll ever ignores the include, the docs
  pages just look the way they did before it existed.
- Mermaid: no library, per the user's choice of "style the code block only". `doclinks.js` captions
  each fence and links to GitHub's blob view, which draws it. Nearest-preceding-heading id is used
  so the link lands on the right section.
- Back link on rendered doc pages (they had no navigation at all), suppressed on the index.
- `README.md:177` fix found in passing: the three "CURRENT PLANS / findings / progress" links were
  **404 on the live site** because Jekyll skips dot-directories. Repointed at GitHub blob URLs.

**Accepted trade-off:** this leans on GitHub Pages default behavior we do not control. Written into
`ARCHITECTURE.md` Conventions, including the load-bearing warning: **never add `.nojekyll`** - it
would 404 every docs URL on the site.

**GOTCHA:** `doclinks.js` must keep `defer` and must sweep the whole document. The inline script at
`retirement_optimizer.html:~669` copies the newest changelog `<li>`'s innerHTML into the LATEST
CHANGE banner during parse, so there are TWO copies of that Details link by the time the sweep runs.
Scoping to `#changelog-list` would leave the banner pointing at the raw `.md`.

**Unblocks P26** below: the "where does the reader land" question is answered, README FAQ anchors
resolve at `/#is-it-a-fools-errand...`.

---

## Phase P25 (original spec, superseded 2026-07-29) — kept for the reasoning, do not build

**Why:** the changelog now lives in `optimizer_changelog.md`, and the Documentation tab links straight to it. A raw `.md` is served as `text/markdown`, which some browsers **download instead of rendering**, and an anchor into plain text does nothing. So the per-version anchors (`optimizer_changelog.md#11.13a1`) only pay off where something renders the file. Today that means GitHub, which is exactly the dependency worth removing: the repo is self-hosted at tools.netcitizen.us and should not need github.com to display its own documentation.

**Shape (user's preference):** not a single-purpose `optimizer_changelog.html`, but **one generic viewer** that renders whichever `.md` it is pointed at, defaulting to `optimizer_changelog.md`. Something like `docs.html?f=optimizer_changelog.md#11.13a1`, so the same page serves the README, the changelog and any future `.md` without another file per document.

**Design notes to carry in:**
- **The `file://` constraint is the whole problem.** A viewer has to `fetch()` the `.md`, and `fetch()` is blocked on `file://` URLs. That is precisely what broke the old `optimizer_history.js` lazy loader (see Round 8). A viewer that only works over http is a regression for anyone opening the tool from disk, and this project is routinely opened that way. Options to weigh: accept it and show a clear "open over http, or read it on GitHub" message with a working link; or keep the plain `.md` link as the file:// fallback and use the viewer only when `location.protocol !== 'file:'`.
- **No CDN.** Everything in this repo is self-contained and loads from the same origin, so a `marked.js`/`markdown-it` CDN tag would be out of character and adds a third-party dependency to documentation. Either vendor a small parser into the repo or write a deliberately limited one: the `.md` files here only use headings, bold, links, inline code, bullet lists, tables and paragraphs.
- **Anchors already exist.** `optimizer_changelog.md` carries explicit `<a id="11.13a1"></a>` before every heading (markdown's generated ids drop the dot), so a viewer that emits that HTML verbatim gets working deep links for free. Duplicated versions use `-2`/`-3` suffixes.
- **Sanitize.** The `.md` files are repo-authored, not user input, so this is a low risk, but a viewer that injects fetched text as `innerHTML` should still strip `<script>`/event handlers rather than trusting the source blindly.
- Scope check before building: `README.md` is ~95KB and already the site's front page via GitHub Pages. Decide whether the viewer is meant to replace that or only serve the smaller docs.

**Files (expected):** new `docs.html` (or similar), `retirement_optimizer.html` (link targets).

**Independent:** no phase dependencies. Pairs naturally with P26 below, which wants to link tooltips at README FAQ anchors and has the same "where does the reader land" question.

---

---

## P35 PR 3 replan (2026-08-04) — per-PR write-ups for P35c/P35d/P35e

### PR 3a — DONE, v11.1447, not byte-identical

`findBracketIndex` returns -1 below every bracket, and `findUpperLimitByAmount` turned that into
`limit: 0` — which the consumers read as "no room" rather than "no limit". A single-row table
`[{l: Infinity}]` hit it on every lookup, and 21 of 38 modelled jurisdictions have one. Full writeup
and the measured before/after in `findings.md`, "A lookup that returned 0 for no limit".

- [x] Fix at `taxengine.js:1051`; both meanings of the 0 sentinel documented in place
- [x] 7 new tests, 4 of which fail without the fix (the other 2 are regression guards). node 148 -> 155
- [x] Per-state A/B over all 38 jurisdictions: `bracket` and `propwd` move in exactly the 21
      single-row states and **0 of 17** graduated ones; `minlimit` moves in all 38
- [x] Browser: title/version/behavior-change banner, in-page suite green, console at the known
      4-fixture baseline, **zero `Infinity` or `NaN` in the rendered page**, and NV at Fill Bracket
      22% now converts $215,100 against CA's $168,128 with the federal ceiling ($223,404) intact
- [x] `taxengine.js?v=` bumped in all four HTML files that load it. Only `IncomeTaxPlanner.html`
      mentions the function and only in a comment, so no other tool changes behavior
- **Status:** committed, PR open. **Unblocks** PR 3c and makes any state-general study legitimate.

### PR 3b — DONE, byte-identical, tokens `111448`

Medicare eligibility was a literal `65` in ten places across three files. PR 3c has to ask "are all
living spouses past Medicare age?", and writing an eleventh literal to answer it is what this PR
removes. `TAXData.IRMAA.ELIGIBILITY_AGE` is now the single source.

- [x] `TAXData.IRMAA.ELIGIBILITY_AGE = 65` (`taxengine.js`), documented in place as **not** the same
      65 as the federal standard-deduction age bump (`FEDERAL.*.age`) or a state `ageGate` — separate
      statutes that share a number today, and a test pins them apart so a future change to one is not
      "fixed" by pointing it at the other
- [x] Seven engine sites in `optimizer_core.js`: the two `ELIGIBILITY_AGE + LOOKBACK` relevance gates
      in `computeBracketCeiling`, `yr.onMedicare`, and both `*OnMedicareAtStart` helpers
- [x] `optimizer_ui.js`: the ACA-warning age test, and the four user-facing strings that state the
      age (three Annual Details tooltips + the both-on-Medicare warning) now interpolate it, so the
      copy cannot drift from the gate
- [x] `Retirement_Projection.html`'s `onMedicareCount` — its own copy of the gate, sourced from
      `TAXData` with the file's existing `?? 65` defensive style
- [x] 5 new tests, and they **move the constant** rather than asserting it equals 65: a hardcoded
      literal passes an `=== 65` check. Mutation-checked by restoring the literals — exactly the 3
      behavioral tests fail, the 2 pins stay green. node 180 -> 185
- [x] BYTE-IDENTITY PROVEN, not assumed: 144 scenarios (4 states x 3 birth years x 6 strategy arms x
      single/couple, 25 years each) run against the `HEAD` engine and this one in separate processes
      and JSON-compared — 9,120,262 bytes, zero diff
- [x] Browser at `localhost:8770`: in-page suite 242/242, console at the known 4-fixture baseline,
      all three `?v=` tokens confirmed `111448` in the live DOM. Data-drivenness verified live, not
      just in node — at `ELIGIBILITY_AGE = 80` a 71/70 couple loses the ACA warning and an 85/84
      couple gains it reading "(age 80+)"; the tooltips re-render at 67; the projection tool's IRMAA
      charge drops from 29 years to 11 at 95 and returns to 29
- **No title bump and no changelog entry**, following PR 1+2: the output is provably identical, so
  there is nothing to tell a user. Only the `?v=` tokens move (`taxengine.js` in all four pages that
  load it, plus `optimizer_core.js` / `optimizer_ui.js`). `standalone/IncomeTaxPlanner.html` was
  pinned at a stale `optimizer_core.js?v=1111f3` and is now current.
- **Status:** MERGED as [PR #149](https://github.com/nightskyguy/retirement_assets/pull/149)
  (commit `735a8ee`, merge `494ed43`). **Unblocks** PR 3c, which is the next review point.

### PR 3c — DONE, v11.1462, behavior change confined to `aca` rows

`computeBracketCeiling`'s ACA branch had no age test at all, so an ACA strategy enforced its FPL cap
at 65, 80 and 95 — protecting a subsidy that ends at Medicare eligibility. Full prediction-then-
measurement writeup in `findings.md`, "PR 3c: the ACA cap that never ended". Two of the four
predictions were wrong and the correction is recorded there rather than quietly dropped.

- [x] `acaCapLapsed(age1, age2, alive1, alive2)` — pure, shared. **Every LIVING person** past
      `TAXData.IRMAA.ELIGIBILITY_AGE`, and deliberately **no `LOOKBACK`**: ACA eligibility is a
      current-year test where IRMAA charges this year off MAGI from two years ago. The two age gates
      look alike and are not the same gate; documented at both
- [x] `yr.acaLapsed` (resolveHousehold) -> `yr.isACAStrategy` (resolveSpendTarget). The lapsed year
      matches NO branch in `planPrimaryWithdrawals` and falls through to the baseline `else`, which
      is Proportional 0% line for line. **Releasing the ceiling outright stays rejected**, and the
      reason is now a comment at the branch: every ACA row carries `stratRate: 0`, so the federal
      branch would return the 10% bracket, tighter than the cap it lifted
- [x] **A SECOND SITE, not in the plan and found only by the test.** `beginYear`'s
      `_stratImpliesConversion` named `'aca'` literally, so a lapsed plan still took January
      ("conversion year") withdrawal timing while its Proportional twin took December — 34 log
      columns diverged in year 0. A totals-only equivalence test would have passed
- [x] `-acaBreach` added to the log row: it was passed into `buildSimYearLogRecord` and never
      emitted, so a breach year was only ever visible as a total. Leading `-` = no table column;
      verified live that no column leaked
- [x] `_isACAUntenable` narrowed `eitherOnMedicareAtStart` -> `bothOnMedicareAtStart`. The either-case
      is now **measured** through `acaBreachYears` instead of assumed, which stops a 66/62 couple's
      four real ACA years being erased on day one. `eitherOnMedicareAtStart` is now unused in
      production — deliberately NOT deleted here, see the follow-up note below
- [x] `#aca-age-warn` one-Medicare copy was wrong in both directions ("limits apply only to the other
      person"): the cap is measured on HOUSEHOLD income and does not lift for anyone until both
      cross. Rewritten, and verified live in all four age cases
- [x] Docs: `doc-aca-cliff` in the page and the README caveat both state the lapse, the household
      basis, and — new — that the tool models the cap and **zero dollars of the subsidy**, so an ACA
      row is a constraint study and not a recommendation
- [x] 4 new tests (node 185 -> 189), and **both gates mutation-checked in isolation**: reverting the
      `isACAStrategy` gate fails exactly the 4 lapse tests; reverting only the `beginYear` timing
      gate fails exactly the equivalence test. The pre-existing `strict ACA` test was retargeted to a
      new `ACA_LIVE` fixture, because `CAP_BASE` is 66/67 in year 0 and was passing by enforcing the
      very defect
- [x] A/B vs `HEAD` in separate processes: `propwd` and `bracket` controls **byte-identical**, only
      `aca` arms move. Live page reproduces every node number, including the lapsed arm equalling the
      Proportional 0% control to the dollar
- [x] Browser at `localhost:8771`: in-page suite 242/242, console at the known 4-fixture baseline,
      title/version stat/amber BEHAVIOR CHANGE banner all `11.1462`, `?v=` tokens `111462` on the two
      changed files only (`taxengine.js` did not change and stays `111448`),
      `standalone/IncomeTaxPlanner.html` clean on the new core. Data-drivenness verified live: at
      `ELIGIBILITY_AGE = 80` a 66/59 couple loses the warning entirely and an 86/87 couple gains one
      reading "(age 80+)"
- **Follow-up, DONE separately (see the PR 3c-cleanup entry below):** `eitherOnMedicareAtStart` was
  left in place by PR 3c deliberately — dead in production but exported, tested, and half of PR 3b's
  constant-mobility pin from one PR earlier. Deleted in its own commit rather than inside a behavior
  change.
- **Follow-up, separate defect, NOT caused here:** Proportional 0% strands $304,331 on `CAP_BASE`
  with $894k still in the IRA and reports `success: false`. Identical on `HEAD`, so pre-existing.
  Surfaced only because the lapsed ACA arm now inherits it.
- **Status:** DONE, open as [PR #150](https://github.com/nightskyguy/retirement_assets/pull/150).
  Deliberately NOT recorded by commit hash: a plan file that names its own commit goes stale the
  moment that commit is amended or rebased, which happened twice here before the hash was dropped
  for good. The PR number is the stable reference. **Unblocks** PR 3d.

### PR 3c-cleanup — `eitherOnMedicareAtStart` deleted, byte-neutral

The OR-sibling had no production caller once PR 3c narrowed `_isACAUntenable` to
`bothOnMedicareAtStart`. Removed as its own commit: no version bump, no changelog entry, and the
`?v=` tokens stay at `111462` because the clock is still inside the same hour, so by the repo's own
`hex(dayOfYear*24 + hour)` scheme this **is** the 11.1462 build. A stale cached copy is harmless
here in a way it was not for PR 3b, because the output is provably unchanged rather than merely
expected to be.

- [x] Grep first: zero production call sites. The only non-test hits were the definition, the
      `module.exports` entry, and two comments
- [x] Function, export entry, and the `optimizer_core.test.js:52` binding removed
- [x] The three tests handled individually rather than deleted wholesale. The OR-semantics test went
      with the function. **The two survivors both lost their only AND-vs-OR contrast**, so each now
      asserts the one-of-two case directly — otherwise nothing in the suite would catch
      `bothOnMedicareAtStart` silently becoming an OR, which is the exact regression the deleted twin
      used to make visible. PR 3b's move-the-constant pin is preserved, retargeted to the one helper
- [x] `ARCHITECTURE.md:208` sweep feasibility-flags node, and the stale "beside its
      eitherOnMedicareAtStart twin" comment at `optimizer_ui.js:4666`
- [x] The surviving helper's header comment now records why the twin is gone and says not to bring
      it back: the either-case is measured through `acaBreachYears`, which is better evidence than
      the predicate was
- [x] BYTE-IDENTITY PROVEN, not assumed: **528 scenarios** (8 states x 3 age configs x 11 strategy
      arms x single/couple, 20 years each) run against `HEAD` and the working tree in separate node
      processes — **34,057,133 bytes each, identical SHA-256**. `buildVariations` (144 rows) and
      `buildStrategyFamilies` (192 rows) identical. The export surface differs by exactly one key,
      the deleted one, and nothing else
- [x] node 189 -> 188 (one test removed), planner 32/32, doclinks 22/22. Browser at
      `localhost:8771`: in-page suite 242/242, console at the known 4-fixture baseline,
      `eitherOnMedicareAtStart` confirmed absent from global scope, `bothOnMedicareAtStart` still
      resolves and still follows a moved `ELIGIBILITY_AGE`, and a live sweep enumerates 192 rows with
      all 16 ACA arms present

---


---

# Archived 2026-09-02 from task_plan.md

Thirty-nine fully-complete phase sections lifted out of `task_plan.md` in one pass. Bodies are
verbatim; nothing was summarised away, and `[x]` boxes and stale `**Status:**` lines are left as
they stood. **Unlike the 2026-08-07 and 2026-08-31 passes, the headings did NOT go with the**
**bodies** - each phase keeps a one-line stub in `task_plan.md` marked COMPLETE and pointing here,
so a reader of the plan still sees what shipped without opening this file, and a grep for a phase ID
still finds it in both places.

One item was rescued rather than archived: `P91d` - the Monte Carlo controls are in neither the
saved scenario nor the share URL - sat inside a phase whose status reads DONE. It stays live under
`P91`’s stub in `task_plan.md`. Same rescue rule as the 2026-08-31 pass.

| was at | phase |
|---|---|
| 1134 | P98: the Documentation tab reported a test failure that was not one  *(2026-08-31, user-reported, DONE v11.16cf)* |
| 1177 | P94: remove the `minlimit` strategy entirely  *(2026-08-29, user-decided, DONE v11.16aa)* |
| 1286 | P97: the limit warning blamed spending for RMDs  *(2026-08-30, user-reported, DONE v11.16b0)* |
| 1315 | P96: the ACA note told a household past 65 to change something that cannot help  *(2026-08-29, user-reported, DONE v11.16ab)* |
| 1363 | P93: name the year the assets belong to  *(2026-08-29, user-decided, DONE v11.16a9)* |
| 1391 | P92: a chosen limit is the limit - no silent min, and say so when it cannot be met  *(NEW 2026-08-29, user-decided, O0)* |
| 1529 | P91: the Stress Test's first result is computed on a stale plan horizon  *(NEW 2026-08-29, user-reported, O0, NOT a regression)* |
| 1619 | P90b: the Cash Reserve warning named a value the field cannot hold  *(2026-08-29, user-reported, DONE)* |
| 1633 | P90: two chart fixes  *(2026-08-29, user-reported, DONE v11.16a4)* |
| 1676 | P89: the ACA age gate read a year the plan does not start in  *(2026-08-29, user-reported, DONE v11.16a4)* |
| 1731 | P88: an Extra Roth Conversion never reaches MAGI, so IRMAA never charges it  *(NEW 2026-08-29, user-raised, O0)* |
| 2084 | P86: the Current-$ basis - a lifetime total is the SUM OF DEFLATED YEARS, not a deflated total  *(DONE 2026-08-28, user-raised; b-f shipped v11.1690, commits bd2c875..976452e)* |
| 2181 | P74: Monte Carlo lost half the strategy identity in transit  *(fixed v11.1642 2026-08-25, user-reported)* |
| 2492 | P23: MC Arithmetic-Mean Returns + AR(1) Variable Inflation (GBM mode) |
| 2599 | P69: Replay - walk one Monte Carlo or Stress sequence through the main model |
| 2720 | P82: replay and chart follow-ups  *(user-reported 2026-08-27, COMPLETE v11.1670)* |
| 2789 | P78: Edit the plan against a pinned replay path  *(planned 2026-08-26, build later)* |
| 2839 | P79: Draw the 10 captured paths on the survival chart  *(planned 2026-08-26, build later)* |
| 2881 | P80: Nerdknob - the historical years behind each bootstrap block  *(COMPLETE v11.1671)* |
| 2928 | P81: the inflation floor guards the DRAW, not the derived index  *(user-raised 2026-08-26, O0)* |
| 3005 | P70: Do high-inflation paths overstate tax? |
| 3246 | P71: Dedup the Monte Carlo engine - one runPass instead of two hand-kept mirrors |
| 3519 | P73: sorting the Optimizer by Strategy sorts the LABEL, not the strategy  *(NEW 2026-08-24, user-raised, O2)* |
| 3686 | P24: Conversion END YEAR — a searched stop-year, NOT the diagnostic's boundary year |
| 3718 | P28: "Every voluntary IRA withdrawal is a Roth conversion" (2026-07-30) — RESEARCH DONE, feature decision open |
| 4032 | P84: annual advisor / AUM fee, and RMDs off the prior December 31 balance  *(COMPLETE, SHIPPED v11.168c + v11.168d, 2026-08-28)* |
| 4478 | P30: Withdrawal policy — the constants nobody chose, and whether strategy should imply order at all |
| 4818 | P32: Brokerage is barely drawn — why, and is the third-pass exclusion still right? |
| 5454 | P67 — "Optimize for" drives the columns, plus a relative (delta) view |
| 5811 | P41: Pension Start Age  *(was PA)* |
| 6016 | P49: Horizon-aware suggested spend  *(SHIPPED v11.14c6, 2026-08-09)* |
| 6057 | P57: Tax Payment Planner - stop describing one plan while recommending another, and stop implying free money  *(NEW 2026-08-18, user-approved, all four groups, follows P56)* |
| 6165 | P58: the withholding a taken draw is ASSUMED to have carried  *(PROPOSED 2026-08-18, found while reviewing P57, NOT approved, no code written)* |
| 6250 | P64: SALT deductibility — the Optimizer never passes `propTax`  *(NEW 2026-08-19, user-approved, O0, STUDY FIRST)* |
| 6396 | P66: IRMAA - the tier ceiling aimed two years of inflation too low  *(COMPLETE 2026-08-20, v11.15cf, PR #182/#183)* |
| 6497 | P52: Monte Carlo run scope, plan-of-record vs compare-all  *(DONE 2026-08-12, shipped in v11.150b)* |
| 6557 | P53: Monte Carlo Stress Test suite  *(DONE 2026-08-13, shipped v11.1521-v11.152f, PR #170)* |
| 6596 | P54: `?montecarlo` teaching demo + mode-aware paths floor  *(DONE 2026-08-15, shipped v11.1553, PR #173)* |
| 6628 | P56: Tax Payment Planner — five-plan matrix (A/B/C/D/Q) + one unified cost table  *(NEW 2026-08-17, plan APPROVED by user, O0, no code written)* |

---

## P98: the Documentation tab reported a test failure that was not one  *(2026-08-31, user-reported, DONE v11.16cf)*

**Shipped defect, on `main` at v11.16b0.** Every load of the page put `Documentation ❌ tests
failed` on the tab button, over exactly one assertion at `optimizer_tests.js:2551`:

    the menu's 24% limit is the one the engine uses for a plan starting this year

The user's own observation is what pointed at the mechanism: **the same page with `?runtests` was
green.** A check that passes or fails on the URL flag is not measuring what it claims to measure.

### The mechanism

`dropdownLimitsMatchTheEngine` read `#stratRate` live. `runTests()` is called at TOP LEVEL from
`retirement_optimizer.html`, which is before the `DOMContentLoaded` handler that fills that control,
so what it read was the markup placeholder - one option, no `data-limit`:

    <option value="24" selected>24% : 40300 MFJ / 201000 SGL</option>

`Number(undefined)` is `NaN` against the engine's `403550`. Hence exactly ONE failure, and `24%` is
simply the value that placeholder happens to carry - nothing about the menu, the builder or the
engine was ever wrong.

`?runtests` hid it by accident of ordering: `acaOptionsUngated`, an unsafe suite gated behind that
flag, sits ABOVE this one in the file and calls `refreshStratRateOptions()`, so by the time the check
ran the real list existed. The same trap is documented at `optimizer_tests.js:2205` for that suite;
this check was written later and did not inherit the lesson.

### The fix, and the rule it carries

Build a detached copy from `generateStratRateOptions()` instead of reading the live control. The
builder is pure, so the check is now about the BUILDER rather than about when the suite happened to
run, and it needs no `unsafeTest()` gate - the live page is untouched. On load this goes from 1
assertion (the placeholder) to 6 (fed rates 10/12/22/24/32/35; 37 is skipped, its `l` is the Infinity
sentinel).

**Rule for any future in-page test that reads a BUILT control:** `runTests()` runs at parse time. A
control filled by `DOMContentLoaded` is not filled yet. Build it, detached, or the test measures run
order. `#stratRate` and `#STATEname` are both in that class.

Commit `92f2d1e` on `worktrees/optimizer-menu-limit-test-04e131`, pushed, no PR opened yet. Suites
371/61/22 unchanged - `TestTiers.EXPECTED` pins node counts only, not the in-page count, so nothing
to reconcile there. Badge: 753 on load (302 in-page + 451 node), 934 with `?runtests` (480 + 454).

---

## P94: remove the `minlimit` strategy entirely  *(2026-08-29, user-decided, DONE v11.16aa)*

**Goal: simplify the logic and the architecture.** Per the user's standing rule, accuracy and
comprehensibility outweigh byte-identity - this removal is expected to change nothing for any
reachable plan, but that is a consequence, not the point.

**To be done as its OWN step**, on the user's instruction, because extirpating it may break
something: not folded into P92 or any other phase.

### Why it goes

`minlimit` ("Lesser of") predates the tool's IRMAA modelling. It meant *the lesser of the chosen
federal bracket and a nearby IRMAA threshold*, and partly guarded against a runaway taxation spiral.
**Both reasons are gone:** IRMAA tiers are modelled directly (the `IRMAA Ceil` family sweeps tiers
0-4 through `strategy: 'bracket'`), and the spiral was measured and REFUTED in P32 - 0 capped years
in 3,960 armed runs.

It is unreachable, measurably:

| surface | result |
|---|---|
| strategy dropdown | 6 options; `minlimit` is not one |
| Optimizer sweep | **0 of 111** families emit it |
| Monte Carlo sweep | **0 of 156** variations emit it |
| `?str=minlimit` URL | **already broken** - select goes blank (`selectedIndex: -1`), `getInputs().strategy` is `""`, plan computes **$0** |
| `sweep_golden.js` | 0 references |
| README / ARCHITECTURE | 0 references |

It has also drifted out of step with the strategy it shadows: `_stratImpliesConversion`
(`optimizer_core.js:1339`) lists `'bracket'` and omits `'minlimit'`, so an otherwise identical plan
picks a different year-0 withdrawal month. Nobody noticed because nobody can run it.

- [x] **P94a** - Delete the arm. The ceiling clamp in `computeBracketCeiling` (`:984`) is the only
      place the strategy DOES anything; then drop `|| inputs.strategy === 'minlimit'` from
      `yr.isBracketStrategy` (`:1716`), the withdrawal dispatch (`:2007`) and the cyclic-coexist
      conditions (`:1923`, `:1938`, `:1946`), plus the comments at `:854`, `:1458`, `:1497`, `:1499`,
      `:1881`, `:1888`, `:1891`, `:2346`, `:3541` and one in `taxengine.js`. UI: three sites -
      the ACA/bracket guard (`optimizer_ui.js:494`), `extraConvCeilingKind`'s "the Min Limit ceiling"
      branch (`:4836`, added by P88e and dead on arrival) and the `ui-bracket` toggle (`:4877`).
- [x] **P94b** - **THE CASCADE, and the actual simplification.** `yr.IRMAALimit` has EXACTLY ONE
      consumer - the clamp being deleted. So it takes with it the `IRMAALimit` parameter of
      `computeBracketCeiling` (**all three call sites shorten**: `:1930`, `:1942`, `:2009`),
      `yr.IRMAALimit` (`:1472`), `_irmaaEffCpi`, `IRMAABracket`, `_irmaaMargin` (`:1468`-`:1471`), and
      the 15-line comment block at `:1458`-`:1467` explaining why the field is provably inert.
      `computeBracketCeiling` drops from three branches to two.
      **DO NOT remove `yr.goalLimit` / `goalFedBracketLimit` / `goalStateBracketLimit`.** They look
      orphaned and are not: `goalLimit` caps `targetSpend` for non-bracket strategies at `:1749`, and
      the two `.rate` fields set the marginal rates at `:1778`-`:1779`. Checked before writing this.
      `irmaaMarginDollars` / `irmaaFwdFactor` also stay - the IRMAA-tier branch still uses them.
- [x] **P94c** - **Unknown strategy -> silent fallback to the default**, which is `propwd` with
      `propWithdraw` 20 (first `<option>`, no `selected`; the input carries `value="20"`).
      **Reuse the existing precedent rather than inventing one:** `applyScenario` already maps
      `'aca'` back to `'bracket'` because the dropdown has no option for it. Add a GENERIC guard
      immediately after that - the user asked for "`minlimit` OR ANY non-named strategy", and a name
      list would need maintaining. If the select matches no option (`selectedIndex === -1`), reset to
      the first option and restore its parameter default from `OPT_DEFAULTS`
      (`optimizer_ui.js:4941`). **Silent, per the instruction.** Must run AFTER the `aca` mapping so
      that deliberate case is not swallowed. Same guard on the URL path via one shared helper.
      **This is a user-visible IMPROVEMENT:** a legacy scenario naming `minlimit` currently loads as a
      blank strategy and a $0 plan; it will load as a working default plan.
- [x] **P94d** - Tests. Most references are incidental: fixtures passing `stratIRMAATier: 1` take the
      IRMAA branch, so the clamp never executes - the suite already says so at
      `optimizer_core.tests.js:4331`, and it was confirmed empirically (on that path `minlimit` and
      `bracket` differ in exactly ONE column, `timing`, with every money field identical).
      **Re-point to `strategy: 'bracket'`**, expecting no money change: `:388`, `:424`, `:1952`,
      `:2671`, `:2687`, `:2734`, `:2736`. **Delete** `minlimit: the IRMAA ceiling is a real limit
      below the first tier` (`:6124`, the only test that genuinely exercises the clamp) and
      `yr.IRMAALimit is inert` (`:4327`, whose subject ceases to exist). **Add one** for the unknown
      strategy falling back to the default. Reconcile counts in all three places.
- [x] **P94e** - Changelog: ONE bullet, for the FALLBACK only - "a saved plan naming a strategy this
      version does not have now loads as the default instead of coming up blank". The `minlimit`
      removal itself is invisible and, by the in-page rule added this session, has no reader.

### Verification

`sweep_golden.js` is untouched, so the strategy-enumeration goldens must still reproduce - **that is
the guard proving neither sweep ever emitted `minlimit`.** Then:
`grep -rn "minlimit" --include=*.js --include=*.html .` returns nothing outside `.planning/` and
`research/`. In the browser: `?str=minlimit` and `?str=totalNonsense` both land on Proportional
Withdraw +% at 20 with a real plan (today: blank, $0); a normal `?str=bracket` plan is unchanged; and
`?str=aca` still maps to `bracket`, proving the guard did not swallow the deliberate case.

- **Status:** DONE, v11.16aa. Suites 364/61/22 and the browser badge green at 850. The enumeration
  goldens were left untouched and still reproduce, which is the proof that neither sweep ever emitted
  it. Approved plan kept at `~/.claude/plans/abundant-noodling-barto.md`.
- **Three corrections to the plan above, from building it.** (1) `computeBracketCeiling` did NOT drop
  a branch: its three are IRMAA tier / ACA / federal, and the clamp was inside the federal one. (2)
  The fallback cannot sit "immediately after the `aca` mapping" - `applyScenario`'s generic loop
  writes `#strategy` after that point, so the guard runs after the loop, and separately on the URL
  path. (3) Money DID move on one fixture: re-pointing the P32h tripwire to `bracket` at tier 1 flips
  year 0 to a month-1 withdrawal, because `_stratImpliesConversion` lists `bracket` and never listed
  `minlimit` - total stranded 27,529 -> 29,368, re-pinned with the reason in the test. The fixture now
  measures a plan a user can reach, which is the improvement.
- **Beyond the plan, once:** `?str=aca` needed the same `aca` -> `bracket` mapping on the URL path
  that `applyScenario` already had, or the new guard would have swallowed a deliberate internal name.
- `.test_harnesses/` still names `minlimit` on purpose: those are dated research records, and
  re-pointing them would change what they measured.
- **Answers `P92b`**, which asked whether `Min Limit` survives once its `min` is removed. It does not
  need to: there is no user-facing strategy to delete, only dead code, so P92's "strategy deletion
  with migration" worry was mis-scoped.

### Found while exploring, OUT OF SCOPE

`targetSpend` caps non-bracket strategies at `goalLimit` (`optimizer_core.js:1749`), so
**Proportional's spending is silently limited by a tax bracket top.** Live and load-bearing.
Recorded rather than folded in.

---

---

## P97: the limit warning blamed spending for RMDs  *(2026-08-30, user-reported, DONE v11.16b0)*

**User-reported against a real shared plan**, and the user's own diagnosis was right: "the spend goal
is 130k, and I think what may be popping is the RMDs."

Measured on that plan - $2.5M + $1.5M IRAs, IRMAA Tier 1, TX, person 1 dying 2046 - **all 15 flagged
years have `IRAwd` = 0, `ForcedIRA` = 0 and `rothConv` = 0.** The plan withdraws nothing beyond its
required distribution and is still over: by 2061 an RMD of **$455,636** against a Tier 1 ceiling of
$370,371, every flagged year a SGL survivor year. P92c's warning nonetheless said "The plan withdraws
past it to pay for spending... Lower the Spend Goal", which is advice that cannot work.

- [x] **P97a** - `limitWarningText(rows, kind, totalYears)` split out of
      `updateLimitFeasibilityWarning()` as a PURE function, and the flagged years split by cause.
      The test is exact, not estimated: `IRAwd` is the voluntary draw plus conversion gross and
      `ForcedIRA` is the third pass's, so a year with neither is one where the plan chose nothing
      that could have put it over. **Estimating by subtracting draws from MAGI would err the unsafe
      way** - IRA income also raises the taxable share of Social Security, so removing it takes more
      out of MAGI than the draw itself.
- [x] **P97b** - Opposite advice per cause, and both counts when a plan has both. The structural
      branch names the required distribution and says plainly that lowering the Spend Goal cannot
      change it; it points at converting before RMDs begin, a QCD, or a higher limit.
- [x] **P97c** - Six assertions on synthetic rows, no DOM driving, including that the spend-advice
      string never appears in the structural branch. Badge 934 (480 in-page + 454 node).

**Found while checking the other branch:** the shipped 12% default plan reported "22 of 25 years" as
one undifferentiated count and blamed spending for all of it. **6 of those 22 were structural.**

---

---

## P96: the ACA note told a household past 65 to change something that cannot help  *(2026-08-29, user-reported, DONE v11.16ab)*

The gate greys out the ACA rows once everyone in the plan is on Medicare at retirement start, and the
note explaining it ended **"Lower Retirement Start Age to model pre-Medicare years."** For a
household ALREADY past 65 this calendar year that is unfollowable: `planFirstYear` clamps a start
year in the past up to the current one, so every start age yields the same first year and the same
ages in it. The sentence named a control that could not change the outcome it described.

- [x] **P96a** - `updateACAWarning()` splits the `bothMedicare` branch on whether Medicare age is
      already past THIS year, computed from `planFirstYear(by1, 0)` - the clamp's own floor, so
      there is no second age calculation to drift. Already past: options greyed, box silent, on the
      user's instruction. Not yet past, i.e. the START AGE is what carries them over: unchanged,
      because there the advice works.
- [x] **P96b** - Four in-page assertions, both branches, disabled-state and message-state each.
      Browser badge 864 (414 in-page + 450 node); node suites untouched at 367/61/22.

**The tradeoff, recorded because the code comment it overrides names it.** The `bothMedicare` branch
was deliberately not gated on the selection so that a user who cannot pick an ACA row could still
find out why. The already-past-65 case now loses that explanation entirely. That is the instruction,
and it is defensible - the options are visibly greyed and nothing could be done about it either way -
but if greyed-with-no-reason reads badly, the fix is a short statement of fact with no advice in it,
not the old sentence back.

---

---

## P93: name the year the assets belong to  *(2026-08-29, user-decided, DONE v11.16a9)*

**Raised as a modelling gap, resolved as a labelling one, and the user's framing is the right one.**
I reported that the portfolio does not grow between today and a future retirement year - typed $1M
gives a year-0 IRA of $1,050,154 starting 2026 and $1,046,082 starting 2030, where four years at 6%
would be about $1.26M. The user's answer: the section is titled **"Assets at Retirement Age"**, so
the balances were never meant to be today's. **This tool has no accumulation phase, and the reader is
responsible for forecasting the assets to that year.** The defect is that the year was nowhere on
screen.

- [x] **P93a** - The heading now names it: `2. Assets at Retirement Age (2035)`. Computed from
      `planFirstYear` (P89), the SAME definition the engine's `startInYear` uses, so the label cannot
      drift from the year actually simulated.
- [x] **P93b** - Wired to both inputs that move it. `updateProfileAgeDisplay()` already fired on
      birth year and month; `startAge` had its own inline `oninput` that only refreshed the ACA
      warning, so it needed adding there too. Verified across four cases: born 1958 with start age
      72 -> (2030), 75 -> (2033), 60 (already passed) -> (2026, clamped), and born 1975 with 60 ->
      (2035). Every one matches `planFirstYear`.
- [x] **P93c** - The documentation entry said "Enter balances in today's dollars", which is the exact
      misreading this phase exists to stop. It now says the balances are the ones expected in the
      year the plan starts, that there is no accumulation phase, and that forecasting to that year is
      the reader's job.
- **Status:** DONE, shipped v11.16a9 in the branch's single changelog entry. No calculation changed.
- **Not done, and not a defect:** the tool still models no accumulation. That is the design, now
  stated rather than implied.

---

---

## P92: a chosen limit is the limit - no silent min, and say so when it cannot be met  *(NEW 2026-08-29, user-decided, O0)*

**Supersedes the open half of P87.** `P87a` measured the federal ceiling's basis and `P88` fixed the
conversion/MAGI defect; this phase is the user's decision about what a ceiling MEANS, which settles
`P87b` and reframes `P87f`.

### The decisions, as given

1. **The target is whatever limit the user chose. Full stop.** No `min` against anything else.
2. **Fed brackets target the TOP of the bracket as listed**, in TAXABLE-income terms. Stopping one
   deduction short is not correct and is to be corrected. This is `P87b`, now decided rather than
   open: form **(i)**, raise the ceiling by the year's deduction.
3. **IRMAA targets MAGI**, forward-projected two years. Already correct (P66/P83); nothing to do.
4. **Deductions computed as accurately as reasonable**, with the understanding that OBBBA and other
   special deductions expire and some phase out. The engine already models the senior deduction and
   its phase-out and sunsets it at 2028 - `P88b`'s `TAX_BASIS_FIELDS` work confirmed all of that
   reconciles to the cent, so the accuracy requirement is already met. What was missing is only that
   the CEILING never used it.
5. **When the chosen limit is INFEASIBLE** - the spend goal cannot be met inside it - **warn the user
   that the selected limit is infeasible, and fall back to satisfying the Spend Goal only.** Today
   the third pass forces the draw silently and only `BracketOverage` records it; there is no warning,
   and `_isBracketInfeasible` is a >50%-of-years heuristic in the Optimizer, not a per-plan message.
6. **When there is NO explicit limit:** use the chosen spend + conversion and ignore any limit.
7. **Extra Conversions remain incompatible with a Fill strategy** - already shipped as the P88e input
   warning and the P88f `⤴` marker. Warn, do not block. No further work.

### What this changes, and why it is not a small edit

`Min Limit n%` becomes the federal bracket top and nothing else, which makes it **arithmetically
identical to `Fill Bracket n%`**. That is a strategy deletion, not a tweak: the dropdown should lose
one of the two rather than ship twins, and `buildStrategyFamilies`, the MC and Optimizer grids, the
golden captures and `sameStrategySelection` all enumerate it.

**The `goalLimit` term is the thing being removed**, and it is worth naming because it is not
obvious: `yr.IRMAALimit = min(goalLimit, IRMAA tier ceiling - margin)` where `goalLimit` is the
bracket top containing the SPENDING GOAL. Measured: it made `Min Limit 24%` target $211,399 where
`Fill Bracket 24%` targets $403,550, so the percentage the user picked was close to decorative.

- [x] **P92a** - DONE v11.16aa. The federal-mode ceiling is raised by the year's deduction,
      unconditionally; the `bracketCeilingAddDeduction` flag is gone from the engine.
      **The instruction "read the SAME deduction `calculateTaxes()` charges" could not be followed
      literally and measuring said what to do instead.** That deduction does not exist when the
      ceiling is placed - the senior deduction phases out against the AGI the ceiling determines - so
      the question was how wrong each obtainable one is. Over 3,960 plan-years
      (`.test_harnesses/ceilded_harness.js`): last year's charged deduction re-indexed is exact in
      the median and wrong by the whole **$35,505** in a filing-status-change year; asking
      `calculateTaxes()` about a provisional year, TWICE, is median $0 / p90 $0 / worst $6,000 and
      exact in those years. Shipped. The second pass is load-bearing: one pass overshoots the bracket
      top by $1,338 of taxable income. `-ceilDedAddBack` is logged beside `-fedDeduction` so the
      residual is auditable. Cost measured at 0.813 ms/sim against main's 0.820 - noise.
      **Disclosed:** 71 clean cells, net worth up in 18 and down in 49, median **-$47,549**, best
      +$1,517,175, worst -$2,589,357; 12% +$157,572, 22% -$200,350, 24% -$12,741; median conversion
      change $0. Changelog says saved plans will not reproduce. `research/BRACKET_CEILING_BASIS.md`
      section 8 carries the whole measurement.
      **Four tests failed and not one was a pinned constant** - every one a fixture whose assumption
      the change invalidated. Notable: a Fill Bracket ceiling on the true bracket top drains
      `STEPUP_BASE`'s IRA to zero, which drops the survivor into the **0% LTCG band**, and a step-up
      on gains taxed at 0% is worth nothing. That is a real consequence, not only a fixture artifact.
- [x] **P92b** - Drop the `goalLimit` and IRMAA `min` from `minlimit`, then decide whether the
      strategy survives at all. If it is identical to Fill Bracket, remove it and migrate saved
      plans and share URLs rather than leaving a twin in the dropdown.
- [x] **P92c** - DONE v11.16ab. `#limit-warn` under the Limit dropdown, filled from the last run by
      `updateLimitFeasibilityWarning()`, counting only the FORCED half (`BracketOverage` less
      `-overageFromConv`), with ACA counted off `-acaBreach` and worded as a cap rather than a target.
      **No threshold, and that is the decision.** Measured on the P87a grid, both ends are common -
      IRMAA Tier 1 breaches in 1 to 50% of years in 24 of 40 cells while Fill Bracket 12% breaches in
      all 40, 36 of them past half - so the COUNT is the message and only the opening sentence
      hardens past half. Seven in-page assertions; browser badge 860.
      **Found and fixed on the way, shipped broken since v11.16a4:** `extraConvCeilingKind()` read
      `val('stratIRMAATier')` and `val('stratACAMultiple')`, neither of which is a form field - both
      are derived in `getInputs()` from the Limit dropdown - so both were `undefined`, every NaN
      comparison was false, and the P88e warning named "the federal bracket ceiling" for every plan
      in the family including IRMAA and ACA ones. Now asks `getInputs()`.
- [x] **P92d** - Tests, and the three-site count reconciliation.
- [x] **P92e** - DONE v11.16af, and larger than "label it" once the user reframed it. Each entry now
      names its position on the OTHER ladder (`22% Fed - $211k (IRMAA Tier 1)`,
      `IRMAA Tier 1 - $274k (24% Fed)`), a sentence under the menu adds what a label cannot carry -
      **an IRMAA tier SPANS a bracket boundary** - and `Show me` opens a static picture of both
      ladders on one income axis. New `DisplayHelpers.formatDollarShort` (3 significant figures,
      k/M/B) makes room; it is NOT `compactNum`, which is lossless and for URLs.
      **A display defect the user found while reviewing this:** `TAX_DATA_BASE_YEAR` was hardcoded
      2025 against tables that declare 2026, so every limit in the menu was aged one extra year -
      `$217,319` where the engine used `$211,400`. Now read off `TAXData.FEDERAL.YEAR`; the ACA rows
      were off by that year plus one more and now mirror the engine's own formula. Pinned by a test
      against `findLimitByRate`.
      **Sorting on the comparable axis was tried and REVERTED** - it fixes `24% Fed` vs `IRMAA Tier 3`
      and moves `10% Fed - $24.8k` between the $63k and $84k ACA rows, which reads as broken. The
      annotation and the ladder carry the ranking instead. Do not re-attempt without solving that.
      `updateBracketFeedback()` stopped parsing the option's display text for its number; a
      `data-limit` attribute carries it, and two old tests that did the same thing were re-pointed.

### Needs modeling before it can be built - NOT part of P92

**A dynamic limit.** The user's idea: when spend + conversion makes the chosen limit infeasible,
instead of only falling back, choose a limit that pushes the plan down to the next LOWER IRMAA tier
(with a warning), or up to the lower of the next tiers. That is a search over ceilings with a cost
function, not a rule, and it needs measuring the way `P87a` and `P88a` were. Opened as a successor,
unnumbered until scoped.

### Answered from the code, so it is not re-litigated

**"What does Extra Conversion actually mean?"** Today it is the user's second reading: the amount is
the **GROSS withdrawn from the IRA**, capped only by the IRA balance, and the tax is netted out of it
- so LESS lands in Roth than the number entered ($20,000 lands about $13,700 at a 31% marginal rate).
The field's tooltip already says this.

`fundConversionWithCash` ("Use Cash") moves it toward the first reading by paying that tax from Cash
instead, but it **does not gate on whether the cash exists** - it blends, funding what Cash allows and
netting the uncovered remainder. And **Brokerage is never used to pay conversion tax**; both funding
paths read `balance.Cash` only (`optimizer_core.js:2869`, `:3113`). So "iff there is cash OR
brokerage to pay the tax" is not implemented for Brokerage at all, and the "iff" is a blend rather
than a condition. If either should change, that is a decision, not a defect.

- **Status:** COMPLETE. `P92a` v11.16aa, `P92c` v11.16ab, `P92e` v11.16af; `P92b` answered by P94
  (no `minlimit` left to delete) and `P92d`'s count reconciliation was done by each step as it
  landed.
- **`P87g` AS WRITTEN IS WRONG, corrected 2026-08-30 after the user challenged it.** It claimed
  nothing sizes a conversion against the ceiling. Measured: on a Fill Bracket 22% plan with Convert
  Excess to Roth, MAGI lands on `BracketTarget` to the dollar and the conversion is its residual
  after spending ($243,600 ceiling, $238,179 drawn, $145,721 to spending, **$92,458 converted**). The
  conversion IS governed by the limit, exactly as a user expects. P92a's "median conversion change
  $0" is not counter-evidence either: AT years are the minority, so the ceiling was not binding in
  the median cell. `research/BRACKET_CEILING_BASIS.md` section 7 carries the correction.
- **MEASURED 2026-08-30, and it is `P87c`: the plan stops exactly 15% of its Social Security benefit
  short of the ceiling.** `short / SSincome` is `0.150000` in every affected year, min equal to max,
  on Fill Bracket 22% and 24% and on IRMAA Tiers 1 and 2 alike. The sizing aggregate subtracts the
  FULL benefit (`yr.fixedInc`) from the ceiling while only the taxable share, at most 85%, reaches
  MAGI - so the untaxed 15% is treated as consuming ceiling it never occupies. On one $2.8M fixture
  that is **$168,500 of headroom never used** across 17 years at Fill Bracket 22%, $97,380 at IRMAA
  Tier 1. Identified by three arms: remove SS and the short vanishes; claim at 62 and it starts
  sooner. Same shape as the deduction error P92a fixed, and NOT fixed by it - it sits under every
  ceiling, federal and IRMAA. `research/BRACKET_CEILING_BASIS.md` section 9, harness
  `.test_harnesses/underfill_harness.js`. **My earlier claim that 2031 is before that plan's SS
  starts was wrong** - person 2 claims at 67 in 2031; I had only checked person 1.
  **This is the next O0 candidate.**

---

---

## P91: the Stress Test's first result is computed on a stale plan horizon  *(NEW 2026-08-29, user-reported, O0, NOT a regression)*

**How it surfaced.** The user reported the Stress Test "used to find 36 paths, now 40" after loading
a saved plan, and suspected this branch.

**IT IS NOT THIS BRANCH.** Measured directly: `main` (11.1691) and this branch (11.16a4) staged side
by side and given the identical shared URL both report **`8 / 36`** on first load, and both report
**`0 / 40`** once the stress pass is re-run against the current plan. The engine is bit-identical for
that plan too - `simulate()` on both builds returns the same success, years funded (36), lifetime tax,
IRMAA, conversions and terminal wealth; the only log differences are the three fields P88/P88c added,
which were `undefined` before. `buildStressBank` is identical on both builds at every plan length and
window mode.

**The real defect is worse than the one reported, and it is on `main`.** The sequence count is a pure
function of `(stressCount, plan years, window mode)`. Measured mapping in `combined` mode at count 20:

| plan years | sequences |
|---|---|
| 20 - 25 | **36** |
| 26 | 37 |
| 27 - 28 | 39 |
| 29 | 41 |
| 30+ | **40** |

On first load of that plan the run used **`years = 25`** while the plan on screen is **36 years**
(`mcPlanYears(getInputs())` returns 36; `_mcResults.years` reads 25). 25 years is the horizon of the
saved *default* scenario, which `loadScenarioByName('default')` applies before `loadFromURL()`
replaces it - so the stress pass is answering about a plan the user is not looking at.

**The consequence is a flipped verdict, not a cosmetic count.** Same plan, same build, same session:

- stale horizon: **"runs out of money in 8 of the 36 worst historical periods, typically around 2046"**
- correct horizon: **"survives all 40 of the worst historical periods on record"**

A false alarm, and the number the whole pass exists to produce.

- [x] **P91a** - **DONE.** Not a stale variable, as predicted - a **dropped request**.
      `refreshMCStressOnly` opened with `if (_mcStressRefreshing) return;` and
      `if (_mcWorkerBusy()) return;`. Both are correct guards (two in-flight passes would race to
      render) and both DISCARDED the request rather than remembering it. The page primes the pass
      once on load; a share URL or saved scenario lands while that prime is running; the refresh it
      asks for hits a guard and is forgotten; nothing else ever asks. `mcInputsChanged` cannot
      recover it either - it reads `_lastMCHash` but never writes it, so there is no retry path.
      **Two earlier fixes in this same file came from this same guard** (`runMonteCarlo` and
      `cancelMC`, both commented in place) and both cleared the stuck FLAG rather than rescuing the
      lost REQUEST. That is why this was a third visit.
- [x] **P91b** - **DONE.** Coalesce instead of drop. `_mcStressPending` remembers a displaced
      request and `_drainStressPending()` runs it when the in-flight pass finishes - on error too,
      since an errored pass is still a reason to go back for what it displaced. The flag is cleared
      BEFORE re-entering so a persistently failing refresh runs once more and stops rather than
      spinning. `runMonteCarlo` clears it at entry (its own stress pass satisfies anything pending
      at that moment) and drains at completion (a request that arrived DURING the run is not
      satisfied); `cancelMC` clears it, deliberately - the user cancelled, so do not start another
      pass on their behalf.
- [x] **P91e** - **FOUND WHILE FIXING, same class, worse in one way.** The FULL sweep was silently
      stale too. `markMCStale(false)` ran unconditionally at completion, asserting the result
      matches the plan on screen. The staleness check lives in `mcInputsChanged`, which skips it
      while `_mcResults` is still null - exactly the case during load - so a sweep started against
      the pre-URL plan finished, CLEARED the banner, and left a 25-year answer under a 36-year plan
      with nothing saying so. Now re-checked at completion, where `_mcResults` finally exists,
      against the same hash `mcInputsChanged` uses. The banner's own text was already right: "The
      chart and survival table below were run before your latest changes. The Stress Test result is
      current."
- [x] ~~**P91a-old** - Find why the first stress pass captures the pre-URL horizon.~~ All three entry points
      (`runMonteCarlo`, the demo pass, the stress-only refresh at `mc_tab.js:815`) call `getInputs()`
      fresh and `mcPlanYears(base)` at call time, so the base is not stale where it is READ - the run
      is being STARTED too early, or its result is not invalidated when the plan then changes.
      `setupAutoRecalc`'s debounce and `applyTabFromUrl` are the two suspects.
- [x] **P91c** - **No node test, and the repo already says why.** `optimizer_core.tests.js:5446`
      records that this code "lives in montecarlo/mc_tab.js, which needs a DOM and is covered in the
      browser tier". `mcPlanYears`, `refreshMCStressOnly` and `_drainStressPending` are all inside
      that file and none is exported. Browser verification is the evidence, same as P90. Suites
      unchanged at 366/61/22.
- [ ] **P91d** *(the one live item in this otherwise DONE phase; kept here rather than parked because it is a REAL gap, not a plan)* - **the Monte Carlo controls are in neither the saved scenario nor the
      share URL.** No `mc-*` key appears in `OPT_LONG_TO_SHORT` or the scenario field list, and
      `mc_tab.js` uses no `localStorage`. So paths, seed, stress count and stress window reset to
      their defaults on every load and cannot be shared. That is a separate gap and may be
      deliberate; it is recorded here because it is the first thing a reader will suspect when two
      runs of "the same plan" disagree, and it is NOT the cause of this one.
- **Status:** **DONE, shipped v11.16a5.** Verified on the user's own URL, fresh load, cache busted:
  headline now `0 / 40` with the stress horizon (36) matching the plan (36), where before the fix the
  same load gave `8 / 36` on a 25-year horizon. The full sweep genuinely did run early and is still
  on 25 years - that is by design for the expensive pass - but it now RAISES the "Out of date" banner
  instead of clearing it, which is the contract the banner text always claimed.
- **Still true and still not the cause:** the Monte Carlo controls are in neither the saved scenario
  nor the share URL and `mc_tab.js` uses no `localStorage`, so paths, seed, stress count and window
  reset every load (`P91d`, open).

---

---

## P90b: the Cash Reserve warning named a value the field cannot hold  *(2026-08-29, user-reported, DONE)*

The warning shown when a scenario carries a Cash Reserve said "Set Cash Reserve blank (or -1) to
restore the original all-cash behavior". **`-1` is not typeable.** The field is attached with
`min: 0`, so `-1` is clamped to `0` on blur - and `0` is a DIFFERENT mode: keep no buffer and
reinvest ALL surplus into Brokerage. A user following that sentence landed in a third behavior
without being told.

Negative values are still accepted from old saved scenarios and shared links, which is why the
parser keeps handling them. But `Off` is the only value a user can type, and it is already what the
field's own tooltip and placeholder say. The message now says `Off`.

---

---

## P90: two chart fixes  *(2026-08-29, user-reported, DONE v11.16a4)*

Both small, both user-reported, both shipped inside the branch's single changelog entry.

**A. The Market Return chart's source year was behind the nerdknob.** `replaySourceYear`
(`optimizer_ui.js`) returned `null` for anyone without it, so the "(from 1974)" suffix on a replayed
path's tooltip only ever appeared for nerdknob readers. Ungated. The reasoning is the rule already
written beside the advisor fee and the forward IRMAA projection: **which historical year a bootstrap
block came from is a FACT about the path on screen, not a diagnostic.** A reader looking at a
replayed 1974 return is better served knowing it is 1974.

**B. The Income & Expenses tooltip reported the scaled bar height, not the income.** That chart
shrinks every income source by ONE year-wide rate so the stack lands exactly on the Net Income line,
which is a presentation device. The tooltip printed the shrunk number, so a $15,000 pension read
$12,886 with nothing on screen explaining the gap.

Now: the raw amount first, with the attributed tax beside it - `Pension: 15,000 - ~2,114 tax`.

**The `~` and the `taxed` flag are the part worth keeping.** The scale is UNIFORM, so it shaves Roth
withdrawals, Cash withdrawals and return of basis by the same fraction as an IRA draw, and none of
those three is taxable. Printing "- $392 tax" beside a return of basis would invent a charge that
does not exist, so those sources report their amount and stop; the title line already flags them as
untaxed. And even where tax IS borne, the attribution is the year's average rate applied
proportionally rather than a per-source calculation - Social Security is taxed on at most 85% of
itself - which is what the `~` admits to.

Measured on one year to confirm the books balance: attributed tax across the taxed sources came to
$26,733, the untaxed Brokerage bar was shaved $392, and Fed + State tax that year was $27,126.
26,733 + 392 = 27,125. The uniform scale is fully accounted for and only the taxable part is called
tax.

The note under the chart said "Incomes shown are After Taxes - See Annual Details for pre-tax
amounts". Half of that was made stale by this change - the tooltip is now where the pre-tax amount
lives - so it was rewritten rather than left pointing elsewhere.

- **Status:** DONE, shipped v11.16a4. Both verified in the browser: the tooltip callback returns
  `SS: 26,073 - ~3,674 tax` for a taxed source and `Brokerage: 2,779` for an untaxed one, and
  `replaySourceYear` returns 1974 with `NERD_KNOBS` false.
- **No tests added.** Both are Chart.js callback wiring with no node-reachable seam; the suites are
  unchanged at 366/61/22 and the browser check is the evidence.

---

---

## P89: the ACA age gate read a year the plan does not start in  *(2026-08-29, user-reported, DONE v11.16a4)*

**How it surfaced.** The user selected `Below IRMAA` and got a paragraph about the ACA FPL cap.

**Three defects, stacked, and the third is the root of the other two.**

- **A. The advisory was never gated on the selection.** `updateACAWarning` (`optimizer_ui.js:5978`)
  checked only whether the dropdown CONTAINS ACA options, plus the ages. It never read `sel.value`,
  so the FPL advisory fired for every choice - federal bracket, IRMAA tier, anything.
- **B. Its year and both ages were wrong.** It computed `startYear = by1 + startAge`. On the reported
  plan that is 1958 + 65 = 2023, and the message said "you will be 65 and your spouse 54". The plan
  actually runs from **2026** with them at **68 and 57**. The block carries a comment saying that
  naming the start year is "the whole point of this block rather than a flourish", added because
  ages-today beside a claim about another year "reads as a stale control, and it was reported as
  one". It then did the same thing one layer down.
- **C. The same expression gated real behavior.** `bothOnMedicareAtStart` carried its own
  `by1 + startAge`, and it decides `acaNeverApplies` (`optimizer_ui.js:1158`) and `acaDisabled`
  (`:1221`) - whether ACA rows appear in the Optimizer at all.

**The root cause is that the plan's first year had TWO definitions.** `getInputs()` built
`startInYear` as `max(by1 + startAge, currentYear)` - clamped, because a simulation cannot start in
the past - and that is what the engine runs on. The ACA gate re-derived the same year without the
clamp. `startAge` is not vestigial, which was the first wrong guess: it drives the start year
THROUGH that clamp, and the clamp was the missing piece.

**Measured before the fix**, over a 6,396-combination grid of birth years, start ages and spouse
ages: the clamped and unclamped answers disagree in **22.2%** of them, **1,423 flips to "both on
Medicare" and 0 the other way.** The direction is provable rather than incidental - the clamp only
moves the year forward, so ages at start only rise - and a test now pins it, so a later change that
produces a backwards flip fails rather than ships.

- [x] **P89a** - `planFirstYear(by1, startAge, currentYear)` in `optimizer_core.js`, exported. One
      definition. `getInputs().startInYear` and `bothOnMedicareAtStart` both call it; the second
      also stopped asking `startAge >= medAge`, which was the same unclamped assumption in a second
      place - the question is whether they have reached Medicare age BY THE YEAR THE PLAN BEGINS,
      not whether the age they typed reaches it. `currentYear` is a parameter, not a `new Date()`
      call, so the function stays pure and a test can pin a year.
- [x] **P89b** - The advisory is gated on `sel.value.startsWith('aca')`. The `bothMedicare` branch
      is deliberately NOT gated the same way: it explains why the ACA options are greyed out, and a
      user who cannot select them could otherwise never find out why.
- [x] **P89c** - The warning's year and BOTH ages now come from the clamped start year.
- [x] **P89d** - 3 tests; suites **366**/61/22, `TestTiers.EXPECTED` and `.githooks/README.md`
      reconciled. **Three existing call sites in the suite were pinned to an explicit year**, because
      the new default parameter would otherwise have made them time-dependent - including the golden
      strategy-capture reproduction, which would have broken in some later calendar year with no code
      change behind it. One existing comment was also WRONG and is corrected: `both(1960, 60, ...)`
      was labelled "neither 65 at start", but the plan starts in 2026 when person 1 is 66 and IS on
      Medicare. The row still returns false, on the spouse rather than on the filer, which is how the
      mislabel survived.
- **Status:** DONE, shipped v11.16a4 with a changelog entry naming the Optimizer consequence.
- **Follow-up, not opened as work:** `startAge` is labelled "Retirement Start Age" but behaves as
  "your age now, unless it is still ahead of you". Worth a label pass one day; it is not a defect.

---

---

## P88: an Extra Roth Conversion never reaches MAGI, so IRMAA never charges it  *(NEW 2026-08-29, user-raised, O0)*

**How it surfaced.** The user observed that `extraConversionAmount` and Fill Bracket are
antagonistic - an extra conversion stacked on a draw already sized to fill the ceiling must break
the ceiling - and proposed a UI warning plus excluding bracket families from the Optimizer's
conversion search. Both observations are correct. Chasing them found the reason the tool has never
shown the conflict, and the reason is a bigger defect than the conflict.

**`applyExtraConversion` charges the income tax and never updates MAGI.** It recomputes the year's
federal and state tax from its own `calculateTaxes` call and writes them back
(`optimizer_core.js:2832-2833`), so income tax is right. It does not write `yr.tax.MAGI`,
`yr.tax.AGI` or `yr.tax.federalTaxableIncome`. `applyConversionGrossUp` has the same shape
(`:3062-3063`).

### The measurement

One plan, Fill Bracket 22%, MFJ 64/62, CA, $2.5M IRA, 4 conversion sizes. Straight off the log:

| extraConversionAmount | ceiling | logged MAGI | logged BracketOverage |
|---|---|---|---|
| $0 | $211,400 | $211,400 | $0 |
| $25,000 | $211,400 | $211,400 | $0 |
| $50,000 | $211,400 | $211,400 | $0 |
| $100,000 | $211,400 | $211,400 | $0 |

**MAGI does not move at all across a $100,000 conversion.** Reproduce with any bracket plan: run
`simulate()` twice, once with `extraConversionAmount: 0` and once with `100000`, and compare
`log[0].MAGI`.

Two independent blindnesses stack, and either alone would hide it:

1. `bracketOverage` is computed at `:2276` and `:2518`, both inside the withdrawal phases, while
   `applyExtraConversion` runs at `:3534`. The overage is decided before the conversion exists.
2. The MAGI it would have read is stale anyway, per the above.

### What it costs, and it is not confined to bracket strategies

`growAndSettle` pushes `yr.tax.MAGI` into `balance.magiHistory` (`:3139`), and `beginYear` charges
IRMAA off `magiHistory[len-2]` (`:1435-1441`). **The stale figure is what gets charged, two years
later.** For the year-0 plan above with a $100,000 extra conversion:

| | MAGI | tier | annual surcharge |
|---|---|---|---|
| what the engine records | $211,400 | `-none-` | **$0** |
| what actually happened | $311,400 | **Tier 2** | **$7,166** |

Every strategy uses this conversion path. Proportional and Ordered are bracket-agnostic, as the user
notes, but they under-report IRMAA identically. Also wrong by the conversion gross: the MAGI column
in Annual Details, and the RetirementTaxPlanner handoff.

**And it biases the Optimizer.** The `⇌` rows call `optimizeConversionAmount`, and
`selectConversionCandidates` (`:4122`) deliberately keeps bracket families - it splits `bracket` into
`bracket-irmaa` and `bracket-rate` so each gets a champion. Those rows are scored on numbers that
omit the IRMAA cost of the very conversion being optimized, so the search is biased toward LARGER
conversions everywhere, not only on bracket rows.

### Why the fix comes before the UI warning

Until MAGI is right, a warning would be telling users about a conflict the tool's own numbers deny.
Once MAGI includes the conversion, the antagonism becomes visible on its own: the overage fires, the
IRMAA charge lands, and the Optimizer starts pricing those rows honestly. The exclusion the user
proposed may then be unnecessary - a correctly priced search should reject a large conversion on a
bracket row by itself - but that is a measurement, not a conviction.

- [x] **P88a** - **DONE 2026-08-29.** `.test_harnesses/extraconv_magi_harness.js` +
      `research/EXTRA_CONVERSION_MAGI.md`, rows in `research/README.md` and `HARNESSES.md`. 172 sims.
      Predictions M1-M6 registered before the fix and all six HOLD after it. The pre-fix numbers are
      recorded IN the harness, so it scores the fix itself rather than needing two pasted tables.
- [x] **P88b** - **DONE, v11.16a3.** New `adoptTaxBasis(yr, calc)` + `TAX_BASIS_FIELDS`
      (`optimizer_core.js`, above `applyExtraConversion`). `applyExtraConversion` adopts the basis
      from the `_exTaxCalc` it already had; `applyConversionGrossUp` had no with-gross-up calc to
      copy, so it makes one - adding `increase` to MAGI by hand would have been wrong, because extra
      IRA income can push more Social Security into the taxable share and lift AGI by MORE than the
      draw. The field list is EXPLICIT rather than an `Object.assign`: the recomputed calc carries
      `IRMAAAnnualCost: 0`, so its `IRMAARate`, `nominalRate` and `totalTax` are wrong for the year
      and copying them would trade one bug for another.
- [x] **P88c** - **DONE.** `recomputeBracketOverage(yr)` runs in the year loop after BOTH conversion
      paths. **Two causes kept apart:** the visible `BracketOverage` is the total, and the new hidden
      `-overageFromConv` carries the part a voluntary conversion caused. The Optimizer's
      `isBracketInfeasible` heuristic subtracts it, so "this ceiling cannot fund this plan" keeps its
      meaning - without that, typing a conversion would flag every bracket row infeasible and empty
      the table for exactly the users P88 is for. `acaBreach` is deliberately NOT re-decided: it is
      set off the spending-driven figure and means "the strict cap could not fund spending".
- [x] **P88d** - **DONE.** 5 tests added, suites **363**/61/22, `TestTiers.EXPECTED` and
      `.githooks/README.md` both reconciled; badge green in-browser at 845 total.
      **Three existing tests re-baselined, each checked rather than accepted (risk R12):** the GK
      conversion sweep 150000 -> 100000 (its finalNW argmax moved because IRMAA is now charged -
      $0 at every candidate before, $29k-$39k now; the test's own two assertions, that $425k
      out-scores everything and is still refused by the stability gate, are untouched), and
      `breakEvenHeirsRate` 0.57 -> 0.65 twice (converting carries the surcharge it always owed, so it
      takes a higher heirs rate to justify; the fixture is 74 and on Medicare, lifetime IRMAA $6,001
      with no conversion and $35,704 at $100,000).
      **Two of the NEW tests were wrong first and both faults are recorded in the file.** The IRMAA
      test's fixture drew $250,000 a year, and the single-filer bands run 109k/137k/174k/205k/500k -
      so $250,000 and $350,000 are the SAME tier and the test could not fail. A threshold test needs
      a fixture that straddles a threshold. The regression guard asserted
      `MAGI == taxableIncome + deduction` over every year, which stops holding once the portfolio is
      spent out and taxable income floors at zero.
- [x] **P88e** - **DONE.** Visible warning under Extra Annual Roth Conversion, shown only when the
      strategy targets a ceiling (Fill Bracket, IRMAA Tier, Min Limit, ACA) and the amount is
      non-zero. Visible text rather than a tooltip, per the repo rule - a phone cannot hover. It
      WARNS, it does not block: converting past a ceiling on purpose is a reasonable plan, since a
      ceiling paces ORDINARY withdrawals while a conversion moves money inside the household. Once a
      run exists it names the measured years, the worst overage and the surcharge years. Browser
      verified: hidden on Proportional, shown on Fill Bracket, hidden again at a zero amount.
- [x] **P88f** - **DONE 2026-08-29.** `convopt_ceiling_harness.js` +
      `research/CONVERSION_SEARCH_CEILINGS.md`, 270 cells. **Answer: the user's instinct is right and
      their remedy is not - mark the rows, do not drop them.**
      The search does NOT exclude them by itself: **61 of 180** ceiling cells pick a non-zero
      conversion, and production drops only `$0` picks. **Every one of the 61 breaches its own
      ceiling** - several in EVERY year they have one, including a `Fill Bracket 12%` row over its
      bracket 33 of 33 years. But excluding them costs a **median $53,990, up to $1,546,930, with
      not one of the 61 gaining less than $1,000** - there are no marginal rows to discard cheaply.
      Shipped: **`⤴`** in the Strategy column on any conversion-optimized row whose conversion lands
      above its ceiling, plus a legend entry. It reads `-overageFromConv` specifically, so it never
      fires on a row that went over because SPENDING could not be funded inside the ceiling - the
      distinction `P88c` was built to make. Browser verified on a live sweep: 7 `⇌` rows, 2 marked
      (`Fill Bracket ✓ ⇌ ⤴`, `ACA Cliff ✓ ⇌ ⤴`), all five agnostic rows unmarked at zero breach.
      **C5 BROKEN, and usefully:** the heirs rate is NOT the lever (spread 3); the SPEND rate is
      (spread 25). It was nearly scored on "flips at least once", which 3-of-60 would have passed -
      the third time this session a prediction needed scoring against an alternative rather than
      against zero.
      Deliberately NOT done: the rows are not excluded, not demoted in the ranking, and not withheld
      from the Best table. They score what they score; the marker says what they gave up to score it.
- **Status:** **COMPLETE.** `P88a`-`P88f` all DONE 2026-08-29, shipped v11.16a4. The branch carries
  ONE consolidated changelog entry covering P88 and P89, per the one-entry-per-branch rule - the two
  per-release entries written earlier were merged back into it.
  Measured headline: lifetime IRMAA +69% / +30% / +69% / +132% at a $100,000 conversion across Fill
  Bracket 22%, IRMAA Tier 1, Proportional and Ordered - and BEFORE the fix it FELL as the conversion
  grew ($1.41M to $0.63M), so the tool was presenting a large conversion as a way to REDUCE the
  Medicare surcharge.
- **Depends on:** nothing. **UNBLOCKS `P87g`** as of the fix - conversions now reach the ceiling's
  own income measure, so sizing them against it is finally a meaningful thing to build.
- **Changelog:** written, v11.16a3, and it says plainly that IRMAA rises and saved plans will not
  reproduce. The in-page list was over its documented five-entry ceiling, so the two oldest were
  dropped when this was added; their detail is preserved in `optimizer_changelog.md`.

---

---

## P86: the Current-$ basis - a lifetime total is the SUM OF DEFLATED YEARS, not a deflated total  *(DONE 2026-08-28, user-raised; b-f shipped v11.1690, commits bd2c875..976452e)*

**The rule, stated once because everything here follows from it:**

| kind | correct Current-$ form | example |
|---|---|---|
| **stock** - a balance at a point in time | divide by THAT DATE's factor | terminal net worth, any account balance |
| **flow accumulated over time** | `SUM(flow_y / factor_y)` | lifetime tax, lifetime spend, lifetime fees, lifetime RMDs |

Deflating an accumulated nominal total by the FINAL year's factor is wrong, and wrong in a way that
looks plausible: it charges the whole stack the last year's inflation. It can make a running total
**fall**, which is what surfaced this - the user reported `SumAUMfees` dropping from 80,672 to 79,371
between 2049 and 2050 on `?af=0.8&afs=rothira`. Reproduced exactly.

**Most of the app is ALREADY on the right basis, and that is worth stating so this phase is not
mis-scoped into a rewrite.** `totals.taxCurrentDollars` and `totals.spendCurrentDollars`
(`optimizer_core.js:3107-3108`) are built as the sum of deflated years. The summary bar's All Taxes,
Spendable and Advisor Fees read those. End Wealth reads a stock deflated at its own date. The
Optimizer's ranking objectives already use the Current-$ variants - `mintax` ->
`totals.taxCurrentDollars`, `maxspend` -> `totals.spendCurrentDollars`, `networth` ->
`afterTaxNWCurrentDollars`. **The comparison basis is consistent where it has been thought about.**

### The two confirmed defects

**D1. "All RMDs" ignores the Current-$ toggle entirely.** `optimizer_ui.js:3188` writes
`totals.rmd` unconditionally; there is no `rmdCurrentDollars` anywhere in the engine. So in Current-$
mode a NOMINAL lifetime flow sits directly beside All Taxes, which is deflated. Not a wrong basis -
**no** basis, adjacent to a correct one. The QCD figure in the same tile's sub-label has the same
problem. **This is the one that matters most, because it is on the summary bar and it is the number
a reader compares against the tax tile.**

**D2. The two running-total COLUMNS in Annual Details.** `SumTaxes` and `SumAUMfees` are divided by
the row's own factor by the generic renderer (`optimizer_ui.js:3014`), which is correct for every
other column and wrong for these two, because they are accumulations rather than stocks.

**Measured, not eyeballed:** every numeric log column was tested for nominal monotonicity and then
for decline under the renderer's per-row division. Exactly two columns are genuine running totals
that break: `SumTaxes` and `SumAUMfees`.

### The trap a "clever" fix walks into

The same measurement flags `spendGoal` and `netIncome` as declining under Current-$. **Those are
correct** - they are per-year flows genuinely losing real value, and "fixing" them would be a
regression. **So the fix MUST be a named list of accumulator columns, never a monotonicity
heuristic.** A heuristic here would silently rebase two legitimate columns.

### Scope expansion (user, 2026-08-28 session 2) and locked decisions

The audit (P86a, in findings.md "P86a audit") widened the defect list: `Spendable` is a THIRD broken
running-total column; the Advisor /yr sub-label, Break Even (i) dollars and the Optimizer Conv Tax
column ignore the toggle; and the whole Monte Carlo tab is worse - nominal Total Taxes sits beside
always-real Total Spendable, table+headline never re-render on toggle, and the charts deflate every
path by ONE flat cross-path CAGR while each path's true factor is discarded at the engine boundary.

User decisions, locked: (1) ONE displayed column per accumulator; if on-demand costs <0.5% of calc
time, DROP the stored sum columns and compute displayed running totals on demand in the toggle's
basis (any kept stored sum would have been Current-$). (2) MC gets EXACT per-path deflation.
(3) `Spendable` column renamed `SumSpendable`. Approved plan: `~/.claude/plans/hazy-doodling-whisper.md`.

### Tasks

- [x] **P86a** - audit DONE 2026-08-28: full inventory in findings.md "P86a audit - every displayed
      dollar, classified". Counters behind the three sum columns have ZERO readers outside the log
      builder; delivered spend = `spendGoal + shortfall` (shortfall <= 0); no CSV export and no
      column-name persistence, so the rename is safe. Perf baseline captured (114.0 ms median /
      106.7 best per 200 simulate() runs).
- [x] **P86b** - drop the stored running totals from the engine log (`SumTaxes` :1125,
      `SumAdvisorFees` :1081, `Spendable` :1147 + their counters); UI computes displayed running
      totals on demand via a named `ANNUAL_RUNNING_TOTALS` map (never a heuristic - `spendGoal` and
      `netIncome` legitimately decline), spliced at the old positions so group banners hold;
      Future-$ = running nominal sum, Current-$ = running sum of deflated years; rename
      `Spendable` -> `SumSpendable`. Tests: P84e rework, :5914, new running-total identities; perf
      gate <0.5% recorded in progress.md + commit message.
- [x] **P86c** - `totals.rmdCurrentDollars` + `totals.qcdCurrentDollars` (same idiom, :3111/:3114);
      All RMDs tile + QCD sub-label (ui:3189-3196) and Optimizer `rmd` column (ui:1807-1812) honor
      the toggle. Tests: twins equal sums of deflated per-year columns; tile/column move with toggle.
- [x] **P86d** - small toggle fixes: Advisor /yr sub-label uses dispFees (ui:3186); Conv Tax gets
      `_convSavingsCurrent` from taxCurrentDollars (ui:1495, 1825-1842); Break Even (i) dollars
      deflated by the TERMINAL factor at format time (they are terminal-wealth differences = stocks;
      decision thresholds stay nominal so the suggestion never flips).
- [x] **P86e** - MC engine dual basis (mc_engine.js): per-path factor array (engine-side only, not
      shipped), `percentilesReal` via existing computePercentiles, `medianTaxReal`,
      `medianSpendNominal`, `capturedTracesReal`, `stressPathsReal`; crashed paths keep factor 1;
      years past the log extend by the path's own inflationSequence. Node tests via _mcEngine.runJob.
- [x] **P86f** - MC UI wiring (mc_tab.js + updateCurrentDollarsView): charts/traces/stress use the
      real sets when toggled (flat-CAGR only as stale-worker fallback); survival table renders AND
      sorts on the selected basis; headline follows; median-line tooltip reads ctx.parsed.y; fix the
      'Total Spendable' tooltip that claims always-real; wire renderSurvivalTable + renderPlanHeadline
      into updateCurrentDollarsView with typeof guards.

**Why O0 rather than a quick patch:** the arithmetic is easy and the audit is not. A wrong basis
produces a plausible number, so nothing fails loudly, and this tool's entire purpose is comparing
dollar figures against each other. One number on the summary bar is already on no basis at all.

**Explicitly NOT in scope:** changing what the Current-$ toggle MEANS, or its default. This phase
makes every figure honor the existing definition.

---

## P74: Monte Carlo lost half the strategy identity in transit  *(fixed v11.1642 2026-08-25, user-reported)*

**Symptom, as reported:** run Compare with Ordered CIBR selected; the chart emphasized **CBRI**.

**Cause:** the variation summary `mc_engine.js` posts back to the page carried a HAND-WRITTEN subset
of the strategy fields - `strategy`, `propWithdraw`, `nYears`, `stratRate`, `iraWithdrawPct`, the
cyclic pair and `fundConversionWithCash`. `sameStrategySelection()` reads five more:
`orderedSeq`, `stratIRMAATier`, `stratACAMultiple`, `gkGuard`, `gkAdjPct`. Missing on one side, each
fell through to its `?? default`, so **every** Ordered row compared equal to CBIR - a CBIR user
matched whichever Ordered row came first, and anyone else matched none - and every IRMAA, ACA and
Guyton-Klinger plan matched nothing at all. Nothing threw; the comparison just quietly agreed with
the wrong row. Pre-existing on `main`; the six-sequence menu only made it visible, by moving CBRI
to the front of the grid.

**Fix, three parts:**
1. `selectionOf()` + `STRATEGY_SELECTION_FIELDS` in `optimizer_core.js` - ONE list of the fields the
   comparison reads. `mc_engine.js` spreads it instead of listing fields by hand.
2. `loadMCVariation()` restores the sequence, tier, cliff, guardrails and Roth position. It set only
   the numeric four, so clicking an Ordered row ran whatever the sidebar already held - the same
   PF8 class the Optimizer's `loadOptimizerResult` was fixed for.
3. `withCurrentPlan()` in `mc_tab.js` appends the sidebar's own plan to the Compare sweep when no
   swept row matches it, and the existing pin logic then marks it. MC sweeps no IRMAA ceiling and no
   ACA cliff at all, and `offGridParamFor` has no case for Ordered or GK, so those plans could not
   be in the run however the matching behaved. One extra row, only when it is needed.

**Guarded by** two node tests: `selectionOf` round-trips every family and never matches a neighbour,
and an end-to-end run through `mc_engine.runJob()` asserts each of the six Ordered sequences matches
exactly its own returned variation. The second fails on the pre-fix engine, naming the wrong row.

**Not addressed:** MC still does not sweep the IRMAA or ACA families, so those plans are a single
appended row rather than a ladder. That is the sweep's scope, not this defect.

---
---

---

## P23: MC Arithmetic-Mean Returns + AR(1) Variable Inflation (GBM mode)
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

- [x] **P23a** — Add `RETURN_FLOOR` const + `computeNextInflation(prev, target, persistence, shockStdDev, rng)` to montecarlo/prng.js, next to `boxMuller()` (line 23)
- [x] **P23b** — Update GBM branch in worker.js:95-109 per pattern above; add `gbmInflationBank` to the top-of-function `let` declarations (worker.js:16, alongside `scenarioBank, multiAssetBank, medianAnnualReturn, logDrift` — drop now-unused `logDrift` from this GBM path)
- [x] **P23c** — Mirror the identical change in `_runMCMainThread`'s GBM branch, mc_controller.js:170-182, and its `let` declarations at mc_controller.js:98
- [x] **P23d** — Update worker.js:127 and mc_controller.js:204 (`returnSeq[y] = ...`) to skip `Math.exp()` for `simulationMode === 'gbm'` as shown above (scenarioBank now stores final clamped values for GBM, same as bootstrap)
- [x] **P23e** — Add the GBM `inflationSequence` branch to worker.js:152-158 and mc_controller.js:228-238 (`else if (gbmInflationBank)` pattern above)
- [x] **P23f** — Update `calibrateMCMs` (mc_controller.js:66-84) to drop `logDrift`/Itô correction and apply `RETURN_FLOOR` per pattern above
- [x] **P23g** — Add two new nerd-knob inputs to `#mc-nerd-panel` (retirement_optimizer.html:427-457), near `mc-sigma` (439-441): `mc-inflation-persistence` (number, default `0.65`, min `0`, max `0.95`, step `0.05`, unitless AR(1) coefficient — not a `%` field) and `mc-inflation-shock-sd` (number, default `1.2`, min `0`, max `10`, step `0.1`, treated as `/100` like `mc-sigma`), each with a `title=` tooltip following the existing convention
- [x] **P23h** — Wire both new knobs into `_buildMCHash()` (mc_tab.js:108-120, so cache invalidates on change) and into the cfg object built in `runMonteCarlo()` (mc_tab.js:124-154, passed to `runMCWorker(...)` as `inflationPersistence`/`inflationShockSd`)
- [x] **P23i** — Update stale UI copy that will become incorrect: retirement_optimizer.html:456 ("Synthetic: ... inflation is fixed") and mc_tab.js:282 ("Inflation ... (fixed)") — both need to describe the new AR(1) behavior; also mc_tab.js:276 label "(geometric)" → "(arithmetic)" since `medianAnnualReturn` now equals `mu` directly
- [x] **P23j** — Optional/stretch: compute `inflationStats` (min/CAGR/max, same shape as bootstrap's, worker.js:66) from `gbmInflationBank` so the existing Input Distribution chart (mc_tab.js:792-810, `_inputInflationChart`) can render GBM's realized inflation spread instead of just the flat target — not required for correctness, only for parity with bootstrap's richer display
- [x] **P23k** — Note (footnote only, not in scope): the GBM formula is duplicated across 3 sites (worker.js, mc_controller.js×2); a shared helper would reduce future duplication-drift risk but is a larger refactor — do not restructure as part of this phase
- [x] **P23l** — Add node unit tests in `optimizer_core.test.js` (or a new small test file) for `computeNextInflation()`: reversion behavior (large deviation from target decays toward target over repeated calls with shock=0), floor enforcement (`INFLATION_FLOOR`), a statistical check that many draws of `mu + sigma*boxMuller(rng)` have sample mean/stddev close to `mu`/`sigma`, and a `RETURN_FLOOR` clamp test — `require` montecarlo/prng.js alongside taxengine.js/core.js in the header (`optimizer_core.test.js:29-35`). **Two stale details corrected 2026-08-06:** the file is no longer `retirement_optimizer_core.test.js` (renamed in `d0f4a00`), and there is no "vm test context" — the suite has loaded via `require()` since `86e26fa`.
- **Test:** In the browser, enable nerd knobs, run GBM-mode MC, confirm `msg.medianAnnualReturn` ≈ `mu` and the per-path `inflationSequence` passed into `simulate()` actually varies year-to-year (not constant) — spot-check via `console.log` in a manual run or a new browser-test-suite case in `optimizer_tests.js`
- **Test:** Confirm bootstrap/stress mode output is byte-identical before/after this change (their code paths are untouched)
- **Status:** **COMPLETE 2026-08-23, v11.160F.** Shipped differently from this spec in one
  important way: AAM is a **third mode**, not a replacement for GBM, so the two models can be run
  against each other. Both synthetic modes gained the AR(1) inflation. Three of the planning claims
  were wrong and the measurement corrected them, recorded in findings.md under P23m:
  the guessed shock sd of 1.20% was about half the fitted 2.12%; the planned model was NOT incapable
  of a 1970s (8.7% of paths, four times too rare rather than impossible); and the record's longest
  run above 5% is FIVE years, not eight. Defaults now come from a least-squares AR(1) fit to the
  in-repo CPI-U record for 1948-2025, pinned by a node test that re-runs the fit.
  Inflation draws use their **own PRNG stream**, so GBM's returns are bit-identical to the pre-P23
  code whatever the inflation knobs say - the invariant that makes "GBM is unchanged" a measurement.
  P23q result (findings.md): GBM against AAM is 0.2pp of survival and an identical median ruin year,
  while variable inflation against the old flat rate is **4.8pp of survival and $117,047 of median
  terminal wealth**. The returns half was a labeling fix; the inflation half was a correction.
  Also fixed in passing: `returnSeq` exponentiated stress mode's already-decimal returns, feeding a
  wrong `yr.baseReturn` into every stress scenario's log. No balance changed, because
  `returnSequencePerAccount` overrides every account, but P69 would have displayed it.
- **Independent:** no phase dependencies

---

---

## P69: Replay - walk one Monte Carlo or Stress sequence through the main model

**Plumbing already in place (2026-08-23, v11.161G, user-requested):** Annual Details now carries
`infl%`, `inflCum%` and `return%` - the inflation applied to spending, the compounded rise since the
plan started, and the year's market return before dividends and the per-account mix. They sit behind
**Show All** (category `Market`, which has no checkbox of its own) because a deterministic run
repeats the same two numbers on every row. They are what makes a replayed path readable, so P69 does
not need to add them; it needs to give them something interesting to say.

**Why:** The Monte Carlo and Stress tabs report survival rates, median ruin years and percentile
bands. There is no way to take one bad sequence and walk it through the Annual Details table and the
Charts next to your own plan. Design and sub-items are in the approved plan at
`C:/Users/starc/.claude/plans/cryptic-wondering-wren.md`; the load-bearing findings are:

- `runSimulation()` (optimizer_ui.js:675) is already a clean three-step pipeline, and
  `loadMCVariation()` (mc_tab.js:1175) is the precedent for writing an MC row into the main model.
- **The percentile bands are not paths.** `computePercentiles` (stats.js:41-52) sorts each year
  independently, so the p50 line is a synthetic envelope no simulation ever lived. A "p50 sample"
  has to be defined by ranking paths on one whole-run outcome and picking the one at that rank.
- Ship the captured sequences in the results message (20 x 40yr x 4 assets x 8B = 26KB). Do NOT
  regenerate them from the seed on the main thread: it works today and breaks silently the first
  time bank-build code changes.
- User decision 2026-08-23: capture a SPREAD, not only failures, and the headline is the overlay
  against the user's own plan. Year-by-year scrubbing inside a path is out of scope.
### Plan of record 2026-08-25 (fresh worktree `mc-path-replay`, branched at `f29b40a`)

Design is the approved plan at `C:/Users/starc/.claude/plans/cryptic-wondering-wren.md`; the items
below are that design re-anchored on the code as it stands AFTER P71 and P74, which moved every
line the original plan cited. `montecarlo/worker.js` is 42 lines now and holds nothing to extract;
the engine is `montecarlo/mc_engine.js`.

- [x] **P69a** - shared per-path input bundle. **DONE, no work left**: `buildPathInputs(banks, p,
      years, baseInputs, mode)` at `montecarlo/mc_engine.js:44`, called from the one `runPass` at
      `:294` and exported at `:538`. Shipped as part of P71 (v11.161C-F, `b7f8808`).
- [x] **P69b** - **DONE v11.1643** - `selectCapturePaths()` + `CAPTURE_WORST_N`/`CAPTURE_RANK_PCTS`
      in `mc_engine.js`, exported; `metricPerPath` computed in the path loop off the row the loop
      already holds; every varResult (main AND stress pass) now carries `captured` rows
      `{ pathIndex, rank, rankPct, ruinYear, metric }`, worst-first, no sequences. Three node tests.
      Suites 320/61/22, badge green at 696. Original notes: `ruinYears` is already computed in EVERY mode
      (`mc_engine.js:273`) and already survives for stress as `ruinYearsPerPath` (`:395`); the main
      pass discards it at the collapse to `medianRuinYear` (`:344`). Keep it, and rank every path on
      **one** whole-run metric so a percentile sample is unambiguous.
  - Metric: `afterTaxWealthOfLogRow(log[log.length-1], futureIRATaxRate)` (`optimizer_core.js:3271`),
    the same basis Break Even and the stop-year search score on. Ruined paths sort below all
    survivors, ordered earliest-ruin-worst. Read it off `result` in the existing path loop
    (`mc_engine.js:296-336`) - it is one call per path, no second simulate.
  - Returns `{ pathIndex, ruinYear, rankPct, metric, sequences }`. Count and the sampled ranks are
    constants in ONE place, named, not scattered literals - the `[40,60]` complaint from P30.
  - **User decision 2026-08-25:** capture the **worst 5 plus ranks 5/25/50/75/95** = 10 rows. A row
    that is both (a worst-5 path that also lands on a sampled rank) appears once, and the list stays
    ordered worst-first so prev/next reads as a walk from failure to success.
- [x] **P69c** - **DONE v11.1644.** `sliceBankRowsForPath()` / `pathInputsFromBankRows()` in
      `mc_engine.js` - one path's draws out as plain arrays (~2KB), back in through the SAME
      `buildPathInputs`, so replayed inputs cannot drift from the run's. Main pass ships rows for
      the captured paths of ONE variation - the sidebar plan, `cfg.captureVariationIndex`, computed
      in `runMonteCarlo()` via `findCurrentStrategyIdx` (withCurrentPlan guarantees a match) - NOT
      the union across ~150 Compare variations. Stress msg ships `pathBankRows` for every path,
      index-aligned with `labels`/`startYears` which were already in the message. Node: round-trip
      exact in all four modes; e2e asserts shipped keys == captured pathIndexes, 36/36 stress
      bundles, and a replayed path's simulate() reproduces the captured metric EXACTLY. Browser:
      plan-scope run through the real worker carries all fields. Seed-regeneration still forbidden.
- [x] **P69d** - **DONE v11.1645.** One injection point in `runSimulation()`, no parallel
      pipeline: an active `_replayState` overlays the run variation's plan fields plus the path's
      sequences onto the inputs just read from the sidebar; sidebar CONTROLS never touched. Banner
      under the tab bar names rank, survival/ruin year, mode and seed; `Exit replay` button.
      Controls: `🎬 Replay worst path` on the plan headline (works in BOTH scopes - plan scope
      never renders the survival table, which is where the first attempt put it), a pinned-row
      button in the compare table, and a 🎬 per stress row in the swatch cell. `startReplay()`
      refuses a replay whose sequence length no longer matches `mcPlanYears(getInputs())`.
      **Design correction, measured mid-build:** replaying the RAW sidebar put the stress ruin year
      off by one (2041 vs table 2042) because swept rows are not the raw plan - conversions are
      forced on. `_replayPlanFields(v)` now injects the run variation's strategy/conversion fields
      (via `selectionOf`) with the sequences, so the replayed year-by-year agrees with the numbers
      the run reported. Verified exact: stress balances match the engine trace to the dollar, ruin
      2042==2042, and a survivor path's replayed after-tax wealth equals the captured metric to the
      float ($12,125,940.416580342). Original decision stands: control on both tables, one pass.
- [x] **P69e** - **DONE (same session as P69d).** ◀ ▶ in the banner; captured paths step in the
      engine's worst-to-best order, stress scenarios step in the stress table's CURRENT display
      order (rebuilt via `sortStressRows(buildStressRows())` at step time, so the walk matches
      what the reader sees). Ends disable. Entry control became a **picker** (user call: worst
      alone is not the goal, and the boxed 🎬 buttons were unreadable) - a compact `<select>` on
      the headline listing all ten captured paths by outcome, ▶️ everywhere instead of 🎬, and
      the pinned-row duplicate button removed as clutter.
- [x] **P69f** - **DONE v11.1657.** One dashed gray "Plan (steady assumptions)" Total Wealth line
      (user's readability call: not a second full set). Baseline = the SAME plan the replay runs
      (sidebar + planFields) on flat assumptions, so the gap is purely the path's market story;
      cached on `_replayState` itself, so prev/next and every exit invalidate it for free. Under
      Current $ it deflates by its OWN fixed-inflation factors, never the path's. Same commit: new
      **Market** income-chart view (return bars + inflation line, percent axis, Current-$-immune),
      auto-shown on replay entry with the prior view restored on every exit; the tab-leave exit now
      re-renders, closing the stale-bannerless-chart quirk. Stress swatch cell went flex/tight and
      the 46px indent dropped to 14px (second round of the space complaint).
- [x] **P69g** - **DONE v11.1657.** Under replay the FIRST year the portfolio cannot cover its
      required draw - the engine's own ruin rule - gets a dark red line across its row, one row
      only, with the ruin-year explanation folded into the year cell's Tax Planner tooltip (which
      would otherwise overwrite it, set later in the same loop). Later underfunded years keep their
      pink; the mark distinguishes the year the banner names. Deflation already read the log's own
      inflationFactor and infl%/return% already sat behind Show All, verified 2026-08-25. Browser:
      marked row = 2035 = the captured ruinYear, zero marks after exit.
- [x] **P69h** - **DONE with P69d (v11.1645), the simplest defensible answer as approved:**
      replay is confined to Charts and Annual Details. `showTab()` to any other tab clears it, a
      sidebar input event (capture-phase delegated listener) clears it, and the Optimizer and Tax
      Planner therefore never see a replayed state - they read the sidebar, which replay never
      writes.

**The percentile trap, restated because it is the one thing that makes this phase wrong if missed:**
`computePercentiles` (`montecarlo/stats.js:41`) sorts each year independently, so the p50 BAND is an
envelope no path ever lived. Captured rows are labeled by their **rank percentile**, never "the p50
path".

**Verification** (from the approved plan): node - `buildPathInputs` reproduces the inline result for
a fixed bank and path index; the selector returns the requested count, the worst path really is the
earliest ruin, and the sampled ranks land where they claim. Browser - replay a known stress row and
confirm the Annual Details ruin year matches that row's ruin year in the stress table, then confirm
exiting restores the user's own plan unchanged.

- **Status:** **COMPLETE 2026-08-26, v11.1657** - all eight sub-items shipped on branch `worktree-mc-path-replay`
- **Independent:** no phase dependencies

---

---

## P82: replay and chart follow-ups  *(user-reported 2026-08-27, COMPLETE v11.1670)*

Six items, all raised after using P78/P79 for real.

- [x] **P82a DONE** - one line, never a list. `interaction` moved from `{mode:'index',
      intersect:false}` to `{mode:'nearest', intersect:true}`, medians given a `hitRadius` (a
      zero-radius point has nothing to intersect), and the tooltip filter keeps only the FIRST
      element that passes - `nearest` returns every element tied at the nearest distance, and two
      overlapping hairlines are still two rows. **Measured at the same pixel: 11 tooltip lines
      before, 1 after.** Verified on overlapping traces, on a separated trace and on a median.
      Clicking still works with the tooltip up: the tooltip is painted on the canvas, not an
      element, so it never had the chance to swallow the click.
- [x] **P82b DONE** - the three banner buttons at 0.85em / 2px 7px, measured at 10.71px.
- [x] **P82c DONE** - `replayRing()`: captured Monte Carlo paths then stress scenarios in the stress
      table's CURRENT display order, wrapping both ways. **46 stops at the defaults, exactly the
      figure the report predicted.** Verified in all three directions: last captured -> first stress
      (rank 16), last stress (rank 3) -> first captured, and back from the first captured -> rank 3.
      Neither arrow is ever disabled, which answers the grey-out question by removing it. `ringStep`
      is pure and tested, including the double-modulo that a plain `%` gets wrong on a backward step
      from position 0.
- [x] **P82d DONE** - the checkbox is gone and the behavior is unconditional. The handoff therefore
      moved to replay ENTRY, and `replayCarryOnStep` lost its now-dead lock parameter: entry is
      "no prev", not "the flag is off".
- [x] **P82e DONE** - Exit replay keeps the edits. It already did once the handoff had happened,
      because the sidebar IS the plan by then; verified rather than assumed - $82,000 survived the
      exit and the sequence was gone.
- [x] **P82f DONE** - `scheduleRecalc` returns before the Optimizer and Monte Carlo refreshes while
      a replay is on screen. Verified by counting: both call counts were **0** across an edit that
      did re-run the path. This matters beyond the wasted seconds - the Monte Carlo refresh would
      have aged out the very run the replay came from.
- [x] **P82g DONE** - two parts. The legend swatch: Chart.js builds it from `backgroundColor[0]`,
      so a per-point green/red array showed whatever the FIRST year happened to be - a red key
      beside mostly green bars. `generateLabels` pins it to the up color and the label names the
      convention. And a new "Return after inflation" line, COMPOUNDED not subtracted: at 6% against
      3% it reads 2.91%, where a subtraction would say 3.00%. `realReturnOf` is pure and tested.
- [x] **P82h (user-reported, second round)** - two things the first round left on screen.
      - **The three banner buttons rendered as blank pale boxes.** Mine, introduced by P82b: the
        global `button` rule sets `color: white`, `width: 100%` and a 44px min-height, and an inline
        `background` alone loses to all three - white text on a cream background, stretched wide.
        Replaced with a `.replay-btn` CLASS that overrides each of those explicitly (and can carry a
        :hover, which an inline style cannot). Measured after: 53 / 55 / 70px wide, text `#6b5310`
        on `#fffaf0`. The arrows now read **"◀ Prev"** and **"Next ▶"** rather than bare glyphs.
      - **Input Distributions had no disclosure marker.** PRE-EXISTING on main, confirmed against
        `git show main:` before claiming it: `.mc-fold > summary` suppresses the native marker
        because the two headline folds draw their own `.mc-fold-chev`, and this static summary never
        got one. Given one.
- [x] **P82i (user-reported, third round)** - two more.
      - **The Stress Test headline tooltip closed with "See the Monte Carlo tab for the full stress
        chart" while being read ON the Monte Carlo tab.** PRE-EXISTING on main (`stressTooltip()`
        there has no placement argument and both callers get the same string). One text is shared by
        the summary-bar tile, which is visible from EVERY tab and for which the sentence is right,
        and by the headline, for which it is a dead end. `stressTooltip(s, where)` now closes with
        the tile's sentence or the headline's "Expand this header to see the detailed chart", the
        reader's own wording; an unnamed placement adds no destination rather than guessing.
      - **The banner buttons were readable but still cream on cream.** Now blue. Not the page's
        standard `#2980b9`: at 0.85em that carries white text at only **4.3:1**, so the darker
        `#1f6391` of the same family is used - **6.46:1** on the text and **5.83:1** against the
        banner, both measured in the page rather than eyeballed. Hover lifts to the standard blue,
        so the lighter shade reads as the active state.
- **KNOWN, pre-existing, NOT fixed here:** `.mc-fold[open] > summary .mc-fold-chev` sets
      `transform: rotate(90deg)` and it does not take - computed transform is `none` on all three
      folds, open or closed, including on main. The rule is loaded and the selector matches. The
      chevron marks the control either way, and chasing it is not what was reported. Its own item
      if it ever matters.
- **Status:** COMPLETE, v11.1670. Twenty more tier-1 assertions (381 in-page).
- **Independent:** built on P78/P79 in this branch

---

---

## P78: Edit the plan against a pinned replay path  *(planned 2026-08-26, build later)*

**Ask:** someone replaying a bad sequence wants to change their plan and see whether the change
survives THAT sequence, not exit replay and lose the path.

**Design:**
- A banner control, "Keep path while editing" (off by default). While on, the sidebar-edit
  auto-exit (`optimizer_ui.js`, the capture-phase `.sidebar` listener) is suppressed; every edit
  re-runs `runSimulation()` with the sequences still injected.
- **planFields are DROPPED the moment the first locked edit lands.** They exist to reproduce the
  run's row; once the user edits, THEIR settings are the plan, and planFields silently overriding
  the strategy fields they just changed would be the PF8/P74 class again from the other side.
  Practical shape: on the first locked edit, write the planFields into the sidebar controls once
  (the loadMCVariation pattern) so what runs is what the sidebar shows, then stop injecting them.
- **The banner must stop claiming the run's outcome.** "Rank 5%, ruined 2035" described the run's
  row; a modified plan has neither. Relabel to name only the path identity ("the worst captured
  path's sequence", "the 1973 sequence") plus "modified plan". The dashed baseline recomputes per
  edit (drop `baselineLog` on each locked re-run) so overlay = current plan on steady assumptions.
- Date edits still force an exit via the existing length guard in `startReplay`/`runSimulation`.
- [x] **P78a DONE (v11.1670)** - "Keep path while editing" on the replay banner, off by default.
      While on, the capture-phase `.sidebar` listener marks the state modified instead of ending the
      replay, and the input's own blur/change handler re-runs against the same sequences.
      **DEVIATION, deliberate: the planFields handoff happens when the LOCK GOES ON, not on the
      first edit.** The plan said first edit; that is unimplementable as written. The capture-phase
      listener fires with `el.value` ALREADY updated, so writing the run's `strategy` over the
      control the user just changed is exactly the PF8 / P74 bug from the other side - the thing the
      plan's own note was trying to prevent. Handing off at lock time also stops the sidebar
      disagreeing with what is being replayed the moment the reader opts in. Verified in the
      browser: ticking the box flipped `convertExcessToRoth` false -> true, which is the swept row's
      own setting and was previously invisible.
- [x] **P78b DONE (v11.1670)** - `replayBannerText()`, pure and unit-tested. Once modified the
      banner names the path and says MODIFIED, and does NOT repeat the run's ruin year. A state
      with no `pathName` (an older cached mc_tab.js) falls back to its full label rather than going
      blank.
- [x] **P78c DONE (v11.1670)** - `baselineLog` dropped on every locked edit, so the dashed overlay
      is the CURRENT plan on steady assumptions rather than the plan the run scored.
- [x] **P78d DONE (v11.1670), browser-verified end to end.** Worst path (ruin 2034) replayed, lock
      on, spend $140,000 -> $70,000: the replay survived the edit, the same 25-year sequence stayed
      injected, and the path that ruined in 2034 ended at **$1,564,443** - which is the whole point
      of the feature. Stepping to the #2 worst kept the edited $70,000 and kept saying MODIFIED.
      Lock off then edit ended the replay the old way. Date edits still exit through `startReplay`'s
      existing length guard, untouched.
- [x] **P78e (new)** - `replayCarryOnStep()`: prev/next under the lock must not re-impose the run's
      plan over the edited one. Not in the original plan and not optional - without it the first
      step silently reverted every edit. Pure, and unit-tested including the before-handoff case.
- **Status:** COMPLETE, v11.1670. Ten tier-1 assertions cover the two pure rules.
- **Independent:** built on P69 (merged in PR #194)

---

---

## P79: Draw the 10 captured paths on the survival chart  *(planned 2026-08-26, build later)*

**Ask:** cost of drawing the captured paths on the Historical/Synthetic survival chart.

**Cost answer: small.** Transport: the engine's `runPass` already holds the full `paths`
Float64Array; slicing the capture variation's 10 traces is 10 x years x 8B (~3KB) into its
varResult (`capturedTraces`), same shape `stressPaths` already uses for stress. Chart: 10 extra
thin line datasets on `renderMCChart` (~40 points each) - rendering cost negligible; the REAL cost
is legend/tooltip clutter, so they ship with no legend entries, no points, low alpha, and a single
tooltip label of their rank ("Rank 25% path"). Worst-block paths red-tinted, sampled ranks gray.
- [x] **P79a DONE (v11.1670)** - `capturedTraces` on the capture variation's varResult, sliced from
      the `paths` array that variation already holds. `captureVariationIndex` is clamped BEFORE the
      variation loop so the loop can recognise its own variation while it still has those paths;
      the post-loop clamp that did the same job for the replay rows is gone. `selectCapturePaths()`
      is now called once and shared, so the traces and the replay rows cannot describe different
      paths. **Stress does NOT get them** - it already ships every path as `stressPaths`, and the
      test asserts it is not paying twice. ~3KB.
- [x] **P79b DONE (v11.1670)** - drawn for the pinned variation, five worst red, samples gray, no
      legend entries, hairline width, `order: 0.5` so they sit above the bands and below the
      medians. **The `% 5` grouping was the hazard**: the legend filter, the tooltip filter and the
      isolate handler all indexed on "five datasets per variation", so an appended trace whose index
      landed on 4 mod 5 would have appeared in the legend as a phantom strategy. Traces go after all
      blocks and every one of those filters is now bounded by `nBlockDs`; isolate maps a trace to
      `_mcTraceGroup`, the block it was captured from, so isolating the pinned strategy keeps its
      own paths instead of hiding them. Default follows scope, verified both ways in the browser:
      10 traces at plan scope, 0 at compare, 10 at compare once the reader ticks the box.
- [x] **P79c DONE (v11.1670)** - a click replays that path. **Chart.js's own `options.onClick`
      never fired for these**: hit detection resolves the dataset correctly, so the listener is on
      the canvas instead, hooked ONCE (renderMCChart destroys and rebuilds the chart on the same
      canvas element, so a per-render listener would stack a replay trigger onto every click).
      `hitRadius: 6` makes a hairline clickable.
- **KNOWN LIMIT, measured not assumed:** the click resolves to the NEAREST trace point, so where
      several ruined paths run within a few pixels of each other - the early years, before they
      separate - the reader can get a neighbour. Verified both ways in the browser: clicking at year
      4, where five ruined paths are bunched, replayed the #3 worst rather than the worst; clicking
      the Rank 95% survivor at year 18, 143px clear of its nearest neighbour, replayed exactly it.
      Nearest is the only answer available for overlapping lines; worth a note, not a fix.
- **Status:** COMPLETE, v11.1670. One node test (338) covers the transport.
- **Independent:** transport rode P69's capture plumbing

---

---

## P80: Nerdknob - the historical years behind each bootstrap block  *(COMPLETE v11.1671)*

**Ask:** for the Historical (bootstrap) survival run, show which historical years each block of a
path was drawn from.

**Mechanism:** Historical mode is a block bootstrap - `bootstrapMultiAssetBank` (`prng.js:515`)
draws 3-year contiguous blocks at random start indices from the 1928-2025 record. The bank stores
only the VALUES; the source indices are known at draw time and thrown away. Record them: a
parallel `srcYears` Int16Array (1928+idx per cell) built in the same loop - **no new rng draws, so
CRN and every existing output stay byte-identical; assert that**. Thread through `buildBanks`,
ship per captured path via `sliceBankRowsForPath` (+~80B/path), and for stress paths the start
years are already labels.
- [x] **P80a DONE (v11.1671)** - `srcYears` Int16Array in `bootstrapMultiAssetBank` AND in
      `buildStressBank`, filled from the index already in hand, so **zero extra rng draws** and
      every existing output unchanged. Guarded by a test that runs a whole job in two modes rather
      than by the reasoning alone.
      **`applyBearStartOverlay` needed the same line and it was not optional:** it rewrites the
      OPENING years of a quarter of the paths after the bank is built, which is exactly where a
      reader looks first, so without it those cells would have been labelled with the block the
      bootstrap drew and then threw away.
- [x] **P80b DONE (v11.1671)** - the Market Return tooltip's heading, nerdknob-gated, at the
      reader's own wording: `2029  |  You: 69  Spouse: 77  |  Tax: 13.1%  (from 1972)`. On the
      HEADING rather than per series, because one source year covers the return bar, the inflation
      line and the real-return line alike - saying it three times adds nothing. `marketTooltipTitle`
      is pure and tested; the lookup is separate and returns null three ways, all normal: no replay,
      a synthetic path, or no nerdknob. Verified in the page that all three fall back to the
      identical year-free heading.
- [x] **P80c DECIDED: the multi-asset bank's years ARE the honest answer, and the question was
      built on a false premise.** `bootstrapScenarioBank` is not used in Historical mode at all -
      `buildBanks` sets `scenarioBank = multiAssetBank.equity`, so the return sequence and the
      inflation sequence come from the SAME synchronized block draw. That is what makes one year
      per path-year honest for both series, and it is why the label went on the heading rather than
      on each line.
- **VERIFIED, not assumed:** the claim the tooltip makes is "this number came from that year", so
      the test compares the bank's VALUE against the historical record at the year named, for every
      cell of every path - 0 mismatches over 40 bootstrap paths with the bear overlay armed and the
      whole stress bank. Cross-checked live in the page too: 1930 -> -25.12%, 1931 -> -43.84%,
      1972 -> +18.98%, each matching the record exactly.
- **The wrap is why the years are RECORDED and not derived.** A stress sequence that runs off the
      end of the record wraps to 1928, and a 2007 start on a 25-year plan reads
      2007..2025 then 1928..1933 - where `startYear + y` would have invented 2026..2031. Pinned by
      a test that first asserts the fixture actually contains a wrapped scenario.
- **Status:** COMPLETE, v11.1671. Suite 340, tier 1 389, page 812.
- **Independent:** Historical and Stress only; synthetic paths have no source years

---

---

## P81: the inflation floor guards the DRAW, not the derived index  *(user-raised 2026-08-26, O0)*

**User's two conditions, checked:**

| condition | holds? |
|---|---|
| Medicare/IRMAA growth is ADDITIVE | **YES.** `sim.medicareRate *= (1 + cpi_t + inputs.inflation)` (`optimizer_core.js:3076`) - the statutory index plus a constant excess-medical spread. |
| Nothing goes below `INFLATION_FLOOR` (-0.01) | **NO.** The floor is applied to the DRAWN inflation only. |

**Where the floor IS applied**, correctly, to every drawn series:
`computeNextInflation` (`prng.js:61`, synthetic AR(1)), the stress bank (`:360`), the multi-asset
bootstrap bank (`:502`) and the bootstrap inflation bank (`:531`). So `i_t >= -0.01` always, and the
historical record's real -10.3% years are clamped before they ever reach the engine.

**Where it is NOT applied**, and this is a defect P70c introduced: the statutory index is DERIVED,
not drawn. `cpi_t = i_t + spread` (`advanceYear`), and the shipped default spread is NEGATIVE
(-0.2 points, inflation 3.0 against cpi 2.8). So a year already sitting at the floor is pushed
through it.

Measured over the stress bank, 780 path-years:

| typed rates | spread | min `i_t` | min `cpi_t` | years at floor | **years BELOW floor** |
|---|---|---|---|---|---|
| 3.0 / 2.8 (shipped defaults) | -0.20pt | -1.00% | **-1.20%** | 27 | **27** |
| 3.5 / 2.0 | -1.50pt | -1.00% | **-2.50%** | 27 | **43** |
| 2.0 / 3.5 (inverted) | +1.50pt | -1.00% | +0.50% | 27 | 0 |

It only bites when CPI sits below Inflation, which is the normal configuration and the default.

**Three quantities take the un-floored value:**
- `sim.cpiRate *= (1 + cpi_t)` - brackets, the standard deduction, LTCG, IRMAA thresholds, the ACA
  multiple, the QCD limit and Social Security COLA all deflate faster than the floor allows.
- `sim.medicareRate *= (1 + cpi_t + inputs.inflation)` - small, since the excess spread dominates.
- `sim.pensionFactor *= (1 + Math.min(cap, cpi_t))` - a capped pension is CUT below the floor.

- [x] **P81a DONE (v11.1662)** - took reading (1), the literal one: `cpi_t = Math.max(CPI_INDEX_FLOOR, i_t + spread)`. Re-measured over the stress bank at three spreads: **0 of 650 index steps below the floor**, and it genuinely clamps (20 steps land exactly on it at the defaults, 31 at a 1.5pt spread). Original decision text: Two readings, and they are not equivalent:
      1. floor the derived index: `cpi_t = Math.max(INFLATION_FLOOR, i_t + spread)`. Simple, and
         guarantees the user's stated invariant everywhere downstream.
      2. floor the spread application so the gap cannot push a floored year further down:
         `cpi_t = i_t + spread` only while `i_t > FLOOR`, pinning `cpi_t = i_t` at the floor.
      (1) is the literal reading of "nothing below that number" and is recommended.
- [x] **P81b DONE (v11.1662), and the first attempt broke the Monte Carlo tab.** Applied once where `cpi_t` is computed, so cpiRate, medicareRate and pensionFactor all inherit it. The constant is DUPLICATED in optimizer_core.js, because the engine has no montecarlo dependency and prng.js loads after it - importing would drag the MC data tables into the engine's load path. **Named `CPI_INDEX_FLOOR`, not `INFLATION_FLOOR`:** `montecarlo/worker.js` importScripts() taxengine, optimizer_core, prng, stats and mc_engine into ONE shared scope, so two top-level `const INFLATION_FLOOR` was a SyntaxError that killed the worker before it ran a single path. Node cannot see that - separate module scopes - and the in-page suite caught it. A new test scans all five files for top-level name collisions so the class cannot recur. Original text: so every consumer inherits it rather than
      each one flooring separately. `INFLATION_FLOOR` lives in `prng.js` and the engine does not
      currently import it; decide whether it moves or is duplicated with a pointer comment.
- [x] **P81c DONE (v11.1667). Taken for BOTH, and they got DIFFERENT floors, because they are
      different instruments.** Measured first: at the shipped defaults the statutory index rate is
      negative in **8.6% of bootstrap path-years**, and 87.4% of paths carry at least one such year,
      so this was never a corner case. The Depression blocks in the 1928-2025 pool are what put it
      there.
      - **Social Security: the running MAX of `cpiRate`, in a new `sim.ssFactor`.** 42 U.S.C. 415(i)
        measures each increase from the last quarter that PRODUCED one, so deflation is absorbed on
        the way back up - CPI-W fell in 2009, benefits held through 2010 and 2011, and the 3.6% paid
        in 2012 was measured against 2008 rather than the trough. A high-water mark is exactly that
        rule. It is also the CHEAPER reading, by a factor of 15: a naive per-year `max(0, .)` raises
        the end-of-plan SS factor **+2.07% mean / +10.57% worst** over 1,000 bootstrap paths, the
        high-water rule **+0.14% / +4.31%**. SS could not stay on `cpiRate` because that factor also
        indexes brackets, the standard deduction, LTCG, IRMAA, ACA and the QCD limit, none of which
        have a statutory floor.
      - **A capped pension: a per-year `Math.max(0, Math.min(cap, cpi_t))`, no absorption.** The cap
        has already severed it from the index LEVEL - that is what makes a capped COLA fall
        permanently behind (P70i) - and plan language grants an adjustment of the lesser of the cap
        and the year's increase, then never claws back.
      - **Measured end to end** on 400 bootstrap paths and the 26-sequence stress bank: SS +0.12%,
        pension +0.99%, tax +0.21%, after-tax wealth +0.19%, failure COUNT unchanged, and 4 failing
        paths now last one year longer. **Not monotone in wealth: 9 of 400 paths end POORER**, worst
        -$20,735, and the cause is named rather than guessed - the extra COLA breaches an IRMAA tier.
        On the worst of them a single 2043 breach costs $14,477 of surcharge against $1,174 of
        lifetime SS gain, and the gap then compounds. That is the cliff behaving like a cliff, not a
        defect in the floor.
- [x] **P81d DONE (v11.1662)** - two tests: the engine floor equals prng's (which is what makes the duplicate safe), and no logged index step falls below it at any spread, with an assertion that the floor actually CLAMPS in the negative-spread cases so the test cannot pass vacuously. Original text: for any (cpi, inflation) pair including a negative
      spread, no logged `-cpiFactor` step is below `1 + INFLATION_FLOOR`.
- **Status:** COMPLETE. `P81a`/`b`/`d` shipped in PR #195 at v11.1662; `P81c` at **v11.1667**.
  Suites 337 / 61 / 22, page 771 green, and both new guards were checked against the pre-change
  engine first - SS fell in 4 years and the pension in 4 years there, so neither test is vacuous.
- **Blocks:** nothing.

---

## P70: Do high-inflation paths overstate tax?
**Why:** `sim.inflation` advances at the per-path `yr.yearInflation`, but `sim.cpiRate` - which
indexes federal and state brackets, IRMAA thresholds, the ACA FPL multiple and the IRA goal -
advances at the **fixed** `inputs.cpi` (optimizer_core.js:2870-2873). A path escalating spending at
11% indexes its brackets at 2.5%. That is artificial real bracket creep, overstating tax in exactly
the paths that matter.

**Live today** in Historical and Stress mode, which have carried per-path inflation for some time;
v11.160F extends it to both synthetic modes. optimizer_core.js:73 documents a deliberate "tax policy
must not differ per path" rule, but that comment was written about the IRMAA lookback factor, not
about indexation - re-read it before assuming it settles this.

**Verified again 2026-08-26 (user asked directly whether brackets follow cumulative path
inflation):** they do not. `sim.cpiRate *= (1 + inputs.cpi)` at `optimizer_core.js:2915` while
`sim.inflation *= (1 + yr.yearInflation)` tracks the path. Everything bracket-shaped rides
`cpiRate`: federal and state bracket limits, the LTCG brackets, IRMAA thresholds and tiers, the
ACA FPL multiple, the IRA goal, QCD sizing - AND Social Security COLA (`inputs.ss1 * sim.cpiRate`,
`:1331`), so a high-inflation path understates SS income too, which partially offsets the
overstated bracket creep. Real-world note for the eventual default decision: the IRS indexes
brackets annually by realized chained CPI and SSA indexes COLA by realized CPI-W, so
path-following is the realistic model, not the exotic one. `taxCreepFactor`'s "tax policy must not
differ per path" comment (`:71-74`) is about RATE creep, not indexation - it does not settle this.
P70a stays measure-first: stress scenarios with `cpiRate` (and therefore SS) following realized
inflation vs today's fixed rate; per-scenario lifetime-tax and ruin-year deltas; no default change
in the measuring phase.

- [x] **P70a DONE 2026-08-26** - measured. `cpiFollowsPath` (opt-in input, default OFF, in
      `advanceYear`) plus `.test_harnesses/cpi_index_harness.js`: the Stress Test's own scenario set
      (`buildStressBank` + `buildPathInputs`, not a new one), 30 plans x 26 scenarios x 2 arms.
      Full tables in [`BRACKET_INDEXATION.md`](../../research/BRACKET_INDEXATION.md).

      **The gate opened: this is an engine fix, not a NOTE.** Lifetime tax is **8.32% lower** under
      path-following across 780 pairs; **38 scenarios go from ruined to surviving and 0 go the other
      way**. Worst single scenario -36.7%. The sign tracks realized-minus-assumed CPI monotonically
      over five buckets (+1.4% cold, -11.9% when the path ran >3pt hot), and the drift is the
      mechanism: a 1966 start reaches cpiFactor 4.70 on the path against 1.78 fixed, 2.65x.

      Three things worth carrying into P70b:
      1. **The lower the CPI a user types, the worse the distortion** - every family's delta shrinks
         monotonically from cpi 2.0% to 3.0%. Typing a conservative rate buys the most distorted answer.
      2. **IRMAA dollars moved only half as far as IRMAA tier-years** (-6.5% vs -10.6%), because
         `medicareRate` follows the same clock in the test arm and reprices the surcharges that remain.
         Do not quote the tier-year saving as a dollar saving.
      3. **Zero ACA breaches in either arm** across 78 ACA-capped runs, and those plans still carry the
         largest mean delta (-12.3%). The ACA effect is a moved ceiling, not a breach count.

      Forecasting (`irmaaFwdFactor`, the ACA one-year lookahead) stayed on `inputs.cpi` in BOTH arms
      and is a separate question: a plan cannot know next year's CPI.
      Suites 324 / 61 / 22 (`slowInCore` 3); `TestTiers.EXPECTED` and `.githooks/README.md` updated.
### The frame: THREE clocks, and every defect is a quantity reading the wrong one

The audit (2026-08-26) found the bug class is not "inflation is fixed". It is that the engine has
three distinct time-varying factors and no vocabulary separating them, so quantities read whichever
was in scope.

| clock | what it is | what rides it | should follow |
|---|---|---|---|
| `sim.cpiRate` | the **statutory index** | federal + state bracket limits, standard deduction, LTCG brackets, IRMAA thresholds, ACA FPL multiple, QCD limit, Social Security COLA | REALIZED inflation MINUS the CPI spread - see P70h. IRS indexes by realized chained CPI, SSA by CPI-W, and both run BELOW felt inflation |
| `sim.inflation` | the **price level** | spendGoal, Cash Reserve, property tax, pension COLA, deflation to today's dollars | REALIZED inflation. Already does |
| forecast factors | the plan's **assumption about a year it cannot see** | `irmaaFwdFactor` (2 years forward), the ACA one-year lookahead, `gapYears` pre-compounding | `inputs.cpi`, permanently. A plan does not get clairvoyance |

The third row is the user's caveat, and it is the one that must NOT be "fixed". Under fixed
inflation a forward projection is exact by construction, so today it is always right and looks like
realized indexation. Under a variable path it is a genuine forecast that can miss in both
directions. That is correct behavior, but it changes what the IRMAA safety margin is for (P70e).

**Rule for the whole phase:** anything doing `Math.pow(1 + <a rate>, <years>)` inside the loop is
suspect, because a compounding factor already exists for every clock and recomputing one from a
scalar rate is exactly how a quantity ends up on the wrong clock, or on no path at all.

Deliberately OUT of scope, each for a stated reason: `taxCreepFactor` (calendar-year tax POLICY, not
indexation - its own comment says so); `saltIndex` in taxengine (a statutory 1%/yr step-up written
into the law, not CPI); `computeBETR` and the amortization helpers (returns, not indexation).

- [x] **P70b DONE (v11.165D, `d0f27d0`) - the two clocks on ONE bracket table. Shipped, deterministic, no Monte Carlo needed.**
      `computeBracketCeiling` is handed `sim.inflation` as its `inflation` argument
      (`optimizer_core.js:1740`, `:1752`, `:1819`) and passes it to `calculateProgressive`, which
      indexes bracket limits with it. The ACTUAL tax call passes `sim.cpiRate` for the same purpose.
      So the strategy prices its accounts against brackets placed on the spending clock and is then
      taxed on brackets placed on the statutory clock.

      Invisible whenever `cpi === inflation`, which is why it survived. But the two are separate BY
      DESIGN (user, 2026-08-26): CPI-W/chained-CPI indexes brackets and SS COLA and runs BELOW felt
      inflation, which for seniors carries medical weight CPI-E was invented to track. Defaults are
      inflation 3.0 / cpi 2.8, so the gap is live for EVERY user, not only those who edit the fields.

      **Corrected 2026-08-26.** An earlier draft of this entry quoted -31%, measured at cpi 2.0 /
      inflation 5.0 - a 3-point gap nobody types. At the SHIPPED DEFAULTS the average rate at a 24%
      ceiling is off by:

      | year | correct | shipped | error |
      |---|---|---|---|
      | 10 | fed 0.20332 | 0.20260 | -0.35% |
      | 30 | fed 0.20332 | 0.20111 | **-1.08%** |
      | 30 | state 0.07586 | 0.07483 | **-1.36%** |

      So: a real defect, monotone and one-directional, but a correctness cleanup at ~1% rather than
      an emergency. The correct column is constant across every year, which is the proof - a fixed
      ceiling is the same REAL position in the bracket table every year, so its average rate cannot
      drift. The shipped column drifts only because the two clocks disagree.
      Fix: pass `sim.cpiRate` at all three call sites; rename the parameter so the next reader cannot
      repeat it; add a test asserting the average rate at a fixed ceiling is invariant across years
      for any (cpi, inflation) pair. That one invariant catches the whole class.

- [x] **P70c DONE (v11.165D) - built as the P70h SPREAD model instead, which dissolved the fallback question rather than deciding it: with no path, cpi_t IS inputs.cpi, so deterministic runs are byte-identical by construction. Flag renamed `fixedTaxIndexing`, default off.** P70a measured the
      case: -8.32% lifetime tax over 780 pairs, 38 scenarios rescued from ruin, 0 broken. The
      fallback is the trap recorded below: with no `inflationSequence`, `yr.yearInflation` falls back
      to `inputs.inflation`, NOT `inputs.cpi`, so flipping the default silently reindexes every
      deterministic plan whose two rates differ. **Recommend `inputs.cpi` as the no-sequence
      fallback** - `cpi` is the user's stated indexation rate, `inflation` is their spending rate -
      which confines the change to paths and leaves P70b as the only thing that moves a deterministic
      plan. Decide explicitly; do not patch it quietly.

- [x] **P70d DONE (v11.165D) - propTaxFor reads sim.inflation; getQCDLimit takes the factor and its misleading parameter name is gone; the pension COLA moved to cpiRate; the IRA goal stays on cpiRate with the reasoning written down.**
      - `propTaxFor` (`:108`) does `base * Math.pow(1 + inputs.inflation, years)`. Property tax is a
        today's-dollars input like spendGoal, and spendGoal follows the path; this does not. Should
        read `sim.inflation`. Its `flat` and `custom` growth modes are user policy and stay.
      - `getQCDLimit(sim.currentYear, inputs.cpi)` (`taxengine.js:1598`) does
        `AMOUNT * Math.pow(1 + cpi, simYear - YEAR)` instead of reading `sim.cpiRate`. Its parameter
        is NAMED `cpiRate` but receives a RATE, while `cpiRate` everywhere else in this codebase is a
        cumulative FACTOR. The arithmetic is right today and the name is a live trap; fix both.
      - `yr.iraGoalNominal = inputs.iraBaseGoal * sim.cpiRate` (`:1160`). The IRA Goal is a WEALTH
        target in today's dollars, not a tax threshold. Its comment justifies the statutory clock on
        the grounds that the goal exists to manage indexed thresholds, which is arguable. Decide it
        explicitly rather than leaving it implicit; if it stays on `cpiRate`, say why.

- [x] **P70e DONE (v11.1661, `a27aaea`). IRMAA_MARGIN_DEFAULT = 'halfcpi' CONFIRMED.** Re-running the harness as it stood answered nothing - it never feeds a path, so its output is byte-identical to main. Its header premise (decisions are deterministic) stopped being true in general, so a native section was added: halfcpi prevents 8.5% of tier breaches under fixed indexation and **21.1% under path-following**. But surcharge DOLLARS move -0.09%; the wealth ranking is still driven by conversion sizing, the same P6 finding as before. The default holds for the reason it always did, not for the breach protection. `irmaaFwdFactor`
      and the ACA lookahead stay on `inputs.cpi`. But once indexation follows the path, the plan's
      two-year forward projection stops being exact, and that changes a decision already taken:
      `irmaa_margin_harness.js` measured the margin's benefit as **exactly zero**, correctly, because
      under a constant CPI the engine hits its ceiling to the dollar and there is no error to absorb.
      `irmaa_cpi_risk_harness.js` then showed the answer REVERSES once realized CPI can differ: only
      undershoots breach, overshoots are free, and the rate-shaped modes (`halfcpi`, `cpiminus1`)
      beat the dollar-shaped ones. **The current default was chosen in the regime where the margin
      could not matter.** Re-run `irmaa_default_harness.js` with `cpiFollowsPath` on and revisit
      `IRMAA_MARGIN_DEFAULT`. This is the concrete consequence of the caveat the user raised.

- [x] **P70f DONE (v11.165D) - one guard test for the whole class, plus the lag and the Medicare excess pinned separately.** A single test that, for several (cpi, inflation)
      pairs including unequal ones, asserts each indexed quantity tracks its declared clock: bracket
      limits, standard deduction, IRMAA thresholds, ACA multiple, QCD limit and SS COLA move with
      `cpiRate`; spendGoal, Cash Reserve, property tax and pension COLA move with `inflation`;
      forecast factors move with neither. The clock table above is the specification. Without it the
      next quantity added picks a clock by whatever is in scope, which is how every defect here
      arrived.

- [x] **P70g DONE (v11.165D) - release. NOTE: the v11.1657 caveat lives only inside that RELEASED changelog entry, which is history and was left alone; the new entry sits above it and supersedes it. No standing caveat exists elsewhere in README, optimizer_text.js or the page.** Behavior change touching every plan: changelog entry with a "your saved
      plan will not reproduce" consequence line, and the README caveat added in v11.1657 ("taxes and
      Social Security are not yet adjusted for variable inflation") retired, since it stops being
      true.

- [x] **P70i DONE (v11.1661). Five-way selector: no increase / 1% / 2% / 3% cap / full COLA, paying min(cap, that year's index rate) PER YEAR via its own compounding factor. `pensionColaCap()` accepts the old booleans so the golden, the tests and saved plans need no migration; `applyScenario` maps a stored boolean, since the generic loop would set a `<select>` to "true" and silently strip the COLA. Deflation left as a genuine min, noted in code, to be decided alongside Social Security or not at all.** ~~capped and reduced pension COLAs (raised 2026-08-26, after P70d moved the pension to
      CPI).** `pensionCola` is a plain on/off, so ON now means FULL CPI every year. That is right for
      federal CSRS and military, and wrong for the two commonest cases: FERS pays a reduced "diet"
      COLA above 2%, and most state and municipal plans cap at 2-3% or pay a flat contractual
      percent. A high-inflation path now OVERSTATES those pensions.

      This gap was created by making the model more realistic - under the old spending-clock code the
      error ran the other way for some plans and the two partly cancelled. Private defined-benefit
      plans usually have no COLA at all, which the OFF position already covers.

      Smallest honest fix: a cap percentage beside the checkbox, defaulting to uncapped so nothing
      changes for anyone who does not set it. A NOTE is the alternative if the input is not wanted.

### P70h - the CPI/inflation SPREAD is the model, not a discrepancy  *(user, 2026-08-26; supersedes how P70a's flag works)*

CPI and Inflation are two inputs on purpose, and the tooltips already say so:

> Cost-of-living index. Drives federal & IRMAA bracket indexing and Social Security COLA
> adjustments. Often differs from general inflation, so it is entered separately. **Medicare/IRMAA
> dollar amounts grow at CPI + Inflation combined, not CPI alone.**

The statutory index (CPI-W for COLA, chained CPI-U for brackets since TCJA) runs BELOW felt
inflation, and for a senior household the gap is mostly medical weighting - the thing CPI-E was
invented to track. Defaults are `inflation 3.0` / `cpi 2.8`. The user expects the drift to widen
under current congressional plans.

**This breaks `cpiFollowsPath` as P70a wrote it.** That flag sets `idxRate = yr.yearInflation`,
collapsing the spread to zero, which would hand a default user thresholds about 6% higher by year 30
- `(1.03/1.028)^30` - purely as an artifact, in the SAME direction as the effect being measured.
P70a's published numbers survive only because its harness set `inflation: cpi` in every plan, so the
spread was zero by construction there. That is a configuration no default user runs, so **P70a must
be re-run carrying the 0.2 point gap** before its -8.32% is quoted again.

**The formulation to build instead:**

```
spread = inputs.cpi - inputs.inflation      // -0.002 by default; a POLICY assumption, not a draw
i_t    = the drawn general inflation for year t
cpi_t  = i_t + spread

sim.inflation    *= (1 + i_t)
sim.cpiRate      *= (1 + cpi_t)
sim.medicareRate *= (1 + cpi_t + i_t)       // matches the tooltip exactly
```

The property that settles it: in a deterministic run `i_t = inputs.inflation`, so
`cpi_t = inputs.cpi` **exactly**. Byte-identical by construction, with no special case. That
dissolves P70c's fallback fork entirely - the `inputs.cpi` vs `inputs.inflation` question was a
symptom of the wrong model, not a real decision.

**Three open details, each a deliberate call rather than a detail to discover later:**

1. **Provenance.** `historical_returns.js:3` says the series is BLS **CPI-U**, Dec-over-Dec
   1928-2025, and the AR(1) synthetic is calibrated to it. So the drawn path IS CPI-U, not general
   felt inflation. Anchoring the offset at `inputs.inflation` declares the drawn CPI-U series to be
   the felt path, which misplaces both ends: felt senior inflation sits above CPI-U, chained CPI-U
   sits below it. Three real series, two inputs. Not worth a third input - the CPI-U/CPI-E gap is
   well under a 30-year bootstrap's sampling noise - but it must be DOCUMENTED that way rather than
   implying CPI-E is modeled.
2. **Additive vs multiplicative.** Additive preserves the point gap the two boxes literally mean and
   the tooltips describe. Multiplicative (`i_t * 0.9333`) preserves the proportion, which better
   matches the chained-CPI substitution effect (it bites harder when prices move more): in a 12%
   year, 11.8% vs 11.2%. Recommend additive; record that the choice was made.
3. **Floor.** Drawn inflation is already clamped at `INFLATION_FLOOR = -0.01`, and the record itself
   reaches -10.3%. Decide whether the spread applies before or after that clamp. Only matters in
   deflation years, but should be deliberate.

**Follow-on worth considering:** make `spread` a visible input rather than the silent difference of
two boxes. Someone who believes chained-CPI drift will widen currently has no way to say so except
by nudging two fields in opposite directions and hoping they remember why.
- [x] **The no-sequence fallback, measured 2026-08-26. This is what P70c must decide.** A deterministic run has no
      `inflationSequence`, so `yr.yearInflation` falls back to `inputs.inflation` - **not** to
      `inputs.cpi`. Measured on a plain sidebar run with no path at all:

      | typed rates | flag on vs off | lifetime tax |
      |---|---|---|
      | cpi 2.5% = inflation 2.5% | byte-identical | 1,641,473 both |
      | cpi 2.0% < inflation 3.5% | **differs** | 1,832,405 -> 1,665,452 (-9.1%) |
      | cpi 3.5% > inflation 2.0% | **differs** | 1,535,319 -> 1,630,461 (+6.2%) |

      Different CPI and inflation rates is a legal, ordinary sidebar state. So flipping the default
      would silently reindex every such deterministic plan, not only Monte Carlo runs. P70b must
      decide explicitly whether the no-sequence fallback is `inputs.inflation` (what the flag does
      today) or `inputs.cpi` (which would leave deterministic plans untouched and confine the change
      to paths). The second is probably right - `cpi` is the user's stated indexation rate and
      `inflation` is their spending rate - but it is a decision, not an oversight to patch quietly.
- **Status:** P70a done and committed (89c26d7). P70b..P70g planned 2026-08-26 from a full audit of every inflation-linked quantity. **P70b is a shipped bug needing no Monte Carlo and can ship on its own.**
- **Independent:** no phase dependencies

---

---

## P71: Dedup the Monte Carlo engine - one runPass instead of two hand-kept mirrors
**Why:** `mc_controller.js`'s `_runMCMainThread` is a hand-maintained mirror of `worker.js`'s
`runPass` - its own comment says "Mirrors worker.js logic exactly". About 250 lines each. The P23
session proved the cost: every substantive edit was applied twice as textually identical hunks (the
synthetic branch, the returnSeq conversion, the inflationSequence branch, the input fan, the
inflationStats block, the mode pass-through - six paired edits in one session). The two copies have
already diverged once before P23 (the controller gained yield/cancel machinery the worker lacks),
and the P23k footnote flags the synthetic draw loop as triplicated once `calibrateMCMs` is counted.
A fourth near-copy lives in `optimizer_core.tests.js`: `_p23NewSynth` reimplements the bank build
because worker.js cannot be loaded in node (it opens with `importScripts` and `self.onmessage`).

**Plan approved as plan-only 2026-08-23; user asked for the design, not the implementation.**

### Design

New file `montecarlo/mc_engine.js`, loadable three ways like prng.js already is (module.exports for
node, window for the page, bare globals under importScripts). It owns:

- `runPass(cfg, mode, hooks)` - **async**, the single implementation. `hooks` is
  `{ onProgress, shouldCancel, yieldIfDue }`, all optional and defaulting to no-ops.
  The worker calls it with defaults (awaiting an already-resolved promise once per path is noise
  next to a `simulate()` call); the controller supplies its 16ms-frame `yieldIfDue` and the
  `_mcCancelled` check. Async in a worker is fine; the worker's outer try/catch containment and
  postMessage shell stay exactly as they are.
- `buildPathInputs(bank, synthBank, p, years, baseInputs, mode)` - the per-path bundle
  (returnSeq conversion, returnSequencePerAccount, inflationSequence), extracted verbatim.
  **This subsumes P69a**, and P69's replay imports it from here.
- `buildStressMsg(stress)` - moves from worker.js; the controller's return shape stops being a
  by-hand match.
- `INFLATION_STREAM_XOR = 0x5F356495` - today that constant appears in worker.js,
  mc_controller.js and the test file as a bare literal.

`prng.js` gains `drawSyntheticReturn(mode, mu, sigma, logDrift, z)` so `calibrateMCMs` and the
engine share the one formula the P23k footnote complained about.

Load order: worker adds `mc_engine.js` to its importScripts list after prng.js; the page adds a
`<script>` tag before mc_controller.js. The file:// fallback improves for free - fallback and
worker literally run the same code instead of two texts believed identical.

### The invariant that makes it safe

**CRN discipline: the rng call order must not change.** Every seed's entire result set is downstream
of the exact sequence of `boxMuller(rng)` calls; reordering one draw changes every number. Two
existing guards catch it: `MC_GOLDEN` in sweep_golden.js pins full MC results, and the P23 suite pins
GBM's bank against a verbatim copy of the pre-P23 build. The refactor must leave both untouched -
byte-identical, not approximately equal.

**Correction, 2026-08-23 (P71a).** The paragraph above is wrong about `MC_GOLDEN`. It records
`buildVariations()` row counts, labels and base-row strategy selections - the sweep ENUMERATION -
and never a simulated return. The only automated guard on the draw is the P23 suite pinning GBM's
bank against `_p23OldGbmShocks`, and it reaches that bank through `_p23NewSynth`, a hand copy.
**No suite executes worker.js or mc_controller.js at all**, so no suite would have noticed if this
refactor had changed every number on the page.

The replacement guard is `p71_probe/` beside this file: two node harnesses that load the real
worker.js and the real mc_controller.js into a `vm` context under a shim and hash a fixed-seed run
in all three modes. Run both against a HEAD staging copy and against the working tree; identical
hashes is the pass. P71b and P71c must clear it the same way.

### Sub-items

- [x] **P71a** - **DONE v11.161C 2026-08-23.** `INFLATION_STREAM_XOR`, `drawSyntheticBank()`,
      `syntheticReturnFromBank()` and `drawSyntheticReturn()` now live in prng.js and are exported
      from both tails; `calibrateMCMs`, both runPass copies and the two test XOR literals point at
      them. Split in two rather than the single `drawSyntheticReturn()` the design named, because
      the hot loop needs the bank value AND the return and neither is free from the other; the
      one-call convenience form is kept for `calibrateMCMs`, which wants only the return.
      Suites unmoved at 300 / 61 / 22. **Byte-identity measured, not assumed** - see
      `p71_probe/`, and the correction below about what MC_GOLDEN actually pins.
- [x] **P71b** - **DONE v11.161D 2026-08-23.** `montecarlo/mc_engine.js` (522 lines) now holds
      `runPass`, `buildPathInputs`, `buildStressMsg` and, beyond the plan, `runJob` - the whole job:
      seed the rng once, main pass, stress pass, results message. The job level was duplicated too
      (mainMode, the progress weights, `stressOnly`, the message shape), and leaving it behind would
      have left the next model change a paired edit again. worker.js is a **42-line shell**, down
      from 455: importScripts, one throttled progress callback, onmessage.
      **Deviations, both forced by merging two copies that had drifted:**
      (1) `runPass` takes the rng as an argument - both passes of a job draw from ONE stream, and
      seeding per pass would change every number of the second one.
      (2) The engine takes the RICHER of the two behaviors, so the worker now reports progress
      inside a variation (every 16 paths) as the main thread already did. At 10,000 paths x 144
      variations that would be 90,000 `postMessage` calls, so the shell throttles to one per 60ms,
      with the terminal update exempt so the bar still reaches full.
      Byte-identity re-measured with `p71_probe/` (probe made async-aware first, then re-baselined
      against HEAD): same three hashes as P71a. Suites 300 / 61 / 22, badge green at 669.
- [x] **P71c** - **DONE v11.161E 2026-08-23.** `_runMCMainThread` is now 30 lines: build the three
      hooks, `await runJob(cfg, hooks)`, record timing, hand the message back. mc_controller.js went
      **567 -> 203 lines**; `_buildStressMsg` is gone with the rest of the mirror. mc_engine.js has
      its `<script>` tag on the page, before mc_controller.js. Both probes byte-identical against
      the staged HEAD, all three modes, and `probe_controller.js` now skips mc_engine.js when the
      root predates it so the A/B still runs.
      **The file:// pass was done by calling `_runMCFallback()` directly over http**, which is the
      exact function the `location.protocol === 'file:'` branch calls - the preview pane renders a
      `file://` URL as a static snapshot and cannot run scripts in it. Bootstrap, 50 paths: 60ms,
      survival 0.82, stress pass present, no error. Untested remainder is the one-line protocol
      check itself. **Cancel re-verified** end to end: `cancelMCWorker()` mid-run leaves onComplete
      unfired and reports no error, which is the contract that keeps the previous results on screen.
- [x] **P71d** - **DONE v11.161F 2026-08-23.** Four new tests drive `mc_engine.js` directly - a
      whole job end to end in all three modes (20 paths, 1 variation, 25 years), CRN determinism
      (same seed agrees, different seed does not, so the first half is not vacuous), stress banking
      one path per selected scenario, and a cancelled job resolving to null. `_p23NewSynth` is now a
      six-line adapter over the real `buildBanks()`; `_p23OldGbmShocks` stays a verbatim copy, as
      planned. Suite **300 -> 304**; `TestTiers.EXPECTED` and `.githooks/README.md` updated in the
      same pass, badge green at 673.
      **Three things the plan did not anticipate:**
      (1) `buildBanks(cfg, rng, mode)` had to be split out of `runPass` first. Driving the bank
      through `runPass` would have meant a `simulate()` over the 40,000-year series two P23 tests
      use. It is also the better seam: the bank build is where every draw happens.
      (2) `runOptimizerCoreTests` is **async** now - `runJob` is a promise by construction, and the
      old runner called `fn()` and ignored the return, so an async body would have "passed" without
      asserting anything. Both call sites await it (node entry, and the page's tier-2 loader).
      (3) `montecarlo/stats.js` gained the same three-host export tail as prng.js: node needs
      `computePercentiles`/`computeInputFan` on globalThis before the engine can be required.
- [x] **P71e** - **DONE, absorbed by a-d.** importScripts list (`P71b`), page script tag and the
      mc_engine/mc_controller tokens (`P71c`), stats.js + optimizer_tests.js + tier-2 `V` tokens and
      both test-count sites (`P71d`). **No changelog entry**, as planned - nothing here is visible to
      a reader. One token was missed on the first pass and the badge caught it exactly as designed:
      `optimizer_tests.js` still served a cached copy expecting 300 tests, and the page went red
      with "304 tests on disk, 300 expected" rather than green-with-a-warning.

### Not in scope, noted

The four version-bump sites are a separate consolidation problem (they span HTML, JS and md; a
build step is against the repo's no-build ethos). The mc_tab.js chart-rendering overlap between the
stress chart and the main chart was not measured this session and is not claimed here.

- **Status: COMPLETE.** `P71a`-`P71e` shipped 2026-08-23 as v11.161C through v11.161F, squashed into
  one commit `b7f8808` with all three suites green from the pre-commit hook, and merged to `main`.
  **`P71e` finished as a side effect**: the importScripts list, the page script tag, every `?v=`
  token, `TestTiers.EXPECTED` and `.githooks/README.md` all moved with the item that needed them.
  The two maps P71 forgot - `ARCHITECTURE.md` and `.planning/FILE_DIRECTORY.md` - followed in
  `fb6675c` on 2026-08-24.
- **Not covered, on the record:** the one-line `location.protocol === 'file:'` check was never run
  under a real `file://` URL - the preview pane renders such a URL as a static snapshot - though
  `_runMCFallback()`, the function that branch calls, was verified directly over http. The mc_tab.js
  chart-rendering overlap was never measured and is not claimed. The four version-bump sites remain
  a separate consolidation problem.
- **Blocks:** nothing. P69 is free to build on `buildPathInputs()`; P70 was always independent - it
  measures the engine, does not restructure it.

---

---

## P73: sorting the Optimizer by Strategy sorts the LABEL, not the strategy  *(NEW 2026-08-24, user-raised, O2)*

**Why:** clicking the **Strategy** header sorts on `_strategyLabel`
(`optimizer_ui.js:1501`, `getSortValue: r => r._strategyLabel`), which is the string the cell
RENDERS. That string carries every marker the table paints - the modifier prefix from
`MODIFIER_PREFIX` (`optimizer_core.js`), the `CURRENT_PLAN_MARK`, a trailing `✓`, ` (no conv)`,
` ⚠️` - and for the cyclic IRA-first arm the prefix is not even a symbol but raw HTML,
`<span style="color:#cc0000">🗘</span> `. So the comparison is `localeCompare` over markup and
emoji, and the column does not order by strategy at all.

**Measured on the stock plan, v11.162J, ascending** (block = run of consecutive rows sharing a
first character):

| block | rows | why it lands there |
|---|---|---|
| ⚓ baseline, 📍 your plan | 1, 1 | their own marks |
| **🗘 cyclic IRA-first** | **28** | label starts `<`, which sorts below every letter and every emoji |
| **🔄 cyclic brokerage-first** | **28** | emoji codepoint |
| Fill Bracket, Guyton-Klinger, IRA Draw, IRMAA Ceil, Ordered, Proportional | 8, 1, 20, 6, 9 | the actual alphabet, F through P |
| **🅡 Roth before Brokerage** | **25** | U+1F161 sorts between "Proportional" and "Reduce" |
| Reduce | 10 | the alphabet, resumed |

Two things a reader would call wrong. Every clone is torn away from the family it clones, so
comparing "Fill Bracket" against "🗘 Fill Bracket" means scrolling past 50 unrelated rows. And the
alphabet is **interrupted**: F, G, I, O, P, then 25 🅡 rows, then R. A sort that stops halfway
through the alphabet reads as a broken table rather than as a sort by symbol.

Within a family the parameter order is incidental, not sorted: every `Reduce ✓` row has an
identical label, so `localeCompare` returns 0 and `Array.sort`'s stability leaves them in whatever
order the sweep emitted. `(no conv)` sorts before `✓` because `(` precedes `✓`, so the baseline
variants separate from their own family too.

**The material is already on the row.** `_paramSortVal` exists for the Param column, the family is
recoverable from `_strategy` (with the Fill-Bracket / IRMAA-Ceil split needing the same treatment
`buildStrategyFamilies` gives it), and the modifier is `cyclicEnabled`/`cyclicOrder`,
`fundConversionWithCash` and `rothGapFill`. Nothing needs measuring - this is a sort key that reads
the data instead of the rendering.

**Open design question, for the user:** what SHOULD the order be? Two defensible answers, and they
are different products:
1. **Family, then modifier, then parameter** - every clone sits with the family it clones. Reads as
   "show me this family's arms together".
2. **Family, then parameter, then modifier** - each parameter's arms sit together. Reads as "show me
   what the modifiers do at 7%".
Ascending/descending should reverse the family, not scramble the rest.

**Tasks:**
- [x] **P73a** - **DONE v11.1640 2026-08-25.** User chose **family, then parameter**. `strategySortKey()`
      in `optimizer_core.js` (pure, exported, node-tested) builds a fixed-width key from `_family`,
      `_paramSortVal`, the modifier and the variant; the Strategy column's `getSortValue` returns it
      and declares `rawSort: true`, which makes the table comparator compare by CODE POINT instead of
      `localeCompare` - locale collation treats the key's padding as ignorable and would reorder its
      own fields. Rows now carry `_family` and `_modifier` as the ENUMERATION named them, set in
      `addResult` and copied onto the derived rows, so nothing reads the family back off the label.
      Within a parameter: the plain row, its no-conversion reference, then the clones - a derived row
      stays with the arm it derives from.
- [x] **P73b** - **DONE, and it needed no decision.** The question assumed the pinned rows sort to the
      top by accident of their marks. They do not sort at all: `display` filters out both the
      ⚓ baseline and the 📍 current plan before the comparator runs, because each is already rendered
      once, sticky, above the table. Verified in the browser under both directions.
- [x] **P73c** - **DONE.** `strategySortKey: families stay contiguous, whatever the label starts with`
      in `optimizer_core.tests.js` (suite 314 -> 315): one run per family, numeric parameters ordered
      as numbers (3 before 23, which the old text sort got backwards), a negative parameter (IRMAA
      tier -0.5) that still keys below a positive one, and two rows differing ONLY in label markup
      producing an identical key.
- **Status:** **COMPLETE v11.1640.** No engine behavior change - a sort key and the row fields it
      reads. No changelog entry, by the user's call.
- **Independent:** no phase dependencies. Touches the same column P67 relabelled.

---

---

## P24: Conversion END YEAR — a searched stop-year, NOT the diagnostic's boundary year
**Why:** Stopping Roth conversions partway through a plan can beat both converting to the end and converting nothing. The 2026-07-23 evidence sweep (`findings.md`, harness `stopyear_harness.js`) established the shape of the win across 23 scenarios: `gainVsFull >= 0` in every one, up to +$2.97M, scaling hard with growth and longevity; delivered spend is identical across every cutoff (`spendRange` $0), so it is a clean wealth/tax comparison. The tool currently gives the user no way to act on this, and the closest existing lever (zeroing `extraConversionAmount`) is worse than the right answer because it also throws away the profitable early conversions.

**CORRECTION — the diagnostic's boundary year is NOT the answer.** The original P24 (2026-07-21, n=1) assumed the ⓘ boundary year was the year to stop. Sweeping every cutoff overturned it: in the recorded scenario the true optimum is **2031**, not the diagnostic's 2043 — off by 12 years and **$662k**. `diagnoseConvBreakEvenFailure` answers "which conversion erases the lead for good" (the last cutoff that still breaks even at all), which is a much weaker condition than max after-tax wealth. In no scenario did the boundary year equal the optimum, and in 10 of 23 the diagnostic never fires while stopping early still gained $99k–$2.97M. **So P24 is a searched stop-year feature, and the ⓘ boundary year must NOT be presented as a "stop here" suggestion — it would be systematically wrong.**

**Design consequences locked by the evidence:**
- **Search, don't heuristic.** Four candidate shortcut rules all failed (marginal-rate crossing, IRA-share threshold, RMD/age rule, terminal-mix target — see finding §6). The stop year must be searched per plan.
- **Linear scan only.** The cutoff curve is not unimodal (up to 7 sign flips; step-function brackets/IRMAA). Cost is a non-issue: k+1 runs, ~46ms for a 26-year plan.
- **Stop ALL conversions by default.** Extra-only truncation is much worse ($23.47M vs $24.23M) and never breaks even at any cutoff — the late damage is the strategy's own bracket-fill, not the Extra. Per user decision, ALSO model extra-only (the user notes it is what a naive user expects), but label clearly that it is the weaker of the two.
- **The gain must be shown next to any suggested year.** In low-tax states the win is only ~$100k and a stop year off by ±2 goes NEGATIVE — worse than not stopping. A bare year suggestion with no dollar figure is a trap.

**Tasks:**
- [x] **P24a** — New input, **nerdknob-gated** (per user, until fully investigated): conversion END year (`#convEndYear`). Accepts BOTH forms in one field — <4 digits = age of person 1, ≥4 digits = calendar year (e.g. "2044" or "75"); blank = convert for the whole plan. Engine reads a public calendar-year `convEndYear`, OR'd into `_convSuppressedThisYear` / new `_extraConvSuppressedThisYear` (kept the internal `_cfSuppressConversionsFromYear` index flag as the counterfactual/search mechanism — one gate, two feeders). Nerd-gate follows the tax-creep pattern: hidden unless nerdknob OR a value is set (a shared URL must never hide a live cutoff). `getInputs` parses age→`birthyear1 + age`.
- [x] **P24b** — Scope selector (`#convEndMode`, nerd-gated): "all conversions" (default) vs "extra only". Engine: `convEndMode !== 'extra'` suppresses both surplus + extra past the cutoff; `'extra'` suppresses only the Extra path (`_extraConvSuppressedThisYear`). No per-year array needed for the single-run path.
- [x] **P24c** — URL param + `OPT_LONG_TO_SHORT` entries (`cey`/`cem`); leak-guard in `runOptimizer` (`base.convEndYear = undefined; base.convEndMode = 'all'`, mirroring the existing `base.extraConversionAmount = 0`).
- [x] **P24d** — **Engine search** `bestConversionStopYear(inputs, {mode})` (pure, exported): linear scan over cutoffs scored on the shared `afterTaxWealthOfLogRow` basis (factored out of the Break Even block so the two can't drift). Returns `{stopYearCalendar, stopIndex, atnwStop, atnwNoStop, atnwNoConv, gainVsFull, gainVsNone, beAtStop, convertsNothingIsBest, neverStopIsBest}`. Strips any pre-set stop year so it always searches from full conversions.
- [x] **P24e** — **Diagnostic rewired** (`updateStats` + `formatStopYearMessage` + `applyConvStopYear` + `toggleBreakEvenDiagnosis`): the ⓘ now leads with the SEARCHED year + dollar gain (never the boundary year), surfaces whenever conversions occur (not just when Break Even is blank), and the expanded panel offers a one-click "Stop after YYYY ▸" that fills the field and re-runs. Boundary-year sentence demoted to secondary color, shown only when Break Even is blank. Always shows the dollar gain (findings §7).
- [x] **P24f** — Tests (`optimizer_core.test.js`, 6 new, 108/108): unset → bit-identical; all-mode cutoff == internal `_cfSuppressConversionsFromYear` and zeroes conversions after Y with earlier years untouched; extra-mode leaves strategy bracket-fill running past Y; `bestConversionStopYear` finds the interior optimum, dominates full+none, self-consistent when applied through the public input; search strips a pre-set stop year; `afterTaxWealthOfLogRow` matches the BE formula.
- [x] **P24g** — **DEFERRED — Optimizer sweep dimension over the stop year** (user chose "measure cost first"). No per-row stop-year column ships this round because the leak guard strips `convEndYear` from every optimizer row; the calendar-year display contract is already met in the single-scenario surfaces (diagnostic message + one-click apply). When wired: measured cost is one k+1 linear scan per plan; the concern is multiplying it across the ⇌ candidate pool × the amount grid — the joint (amount × stop) grid is where the real value is (finding §3: C−D was +$228k to +$1.887M). Optimizer table then displays the stop as a **calendar year** even when entered as an age.
- **Status:** IMPLEMENTED and MERGED (v11.1330, confirmed present on `origin/main`). Node 108/108 + taxPaymentPlanner 12/12 at the time. Only the optimizer sweep dimension deferred.
- **Independent:** no phase dependencies; the diagnostic (PF6/PF5) and the counterfactual engine flag both already existed.

---

---

## P28: "Every voluntary IRA withdrawal is a Roth conversion" (2026-07-30) — RESEARCH DONE, feature decision open

**Why:** user proposal — a nerdknob that models every voluntary (non-RMD) IRA withdrawal as a Roth
conversion, spending then drawn out of Roth. Asked whether it simplifies the logic, whether it is
provably better, and which strategies would have to change.

Built as a harness first rather than a feature, because static reading of the engine said the switch
was a no-op and P24's history says not to ship that kind of conclusion on theory. Both halves of the
call turned out right and wrong in useful ways.

**Delivered:** `.test_harnesses/unifiedconv_harness.js` (node, registered in the harness README), two
engine flags defaulting off and set by nothing in the UI, and two hidden log keys.

| flag | what it does | verdict |
|---|---|---|
| `unifiedConvRouting` | the voluntary draw is reported as conversion gross; spending round-trips via Roth | **inert** — 0 money fields move in any of 6 families |
| `rothGapFill` | Roth promoted from LAST to FIRST resort in the gap fill (`ordered` excluded) | **the real lever** — up to +$269k / -$137k |

**Answers to the three questions asked:**
- **A. Simplify or complicate?** Simplifies the decision space (one lever per year, not two);
  changes nothing in the tax math, because the engine already taxes the whole voluntary draw as
  ordinary income wherever the dollars land (`optimizer_core.js:1711-1716`). Complicates the engine
  only if Roth-first comes with it.
- **B. Provably better?** No. Provably NEUTRAL, and now measured neutral. The proposal as written
  would ship a switch that changes no number in the tool.
- **C. Which strategies change?** Only the ones that leave a spending gap for `fillSpendingGap`.
  **Proportional is unreachable** — it funds spending inside `planPrimaryWithdrawals`. `ordered` is
  excluded by instruction and verified identical in all seven arms.

**The presumption ("reduction past some point becomes counterproductive") was already proven**, in
this repo, by the P24 evidence sweep: `gainVsFull >= 0` in all 23 scenarios, up to +$2.97M. The
shipped lever is `convEndYear`. That is a step function; the taper generalization is P5.

**Found in passing, and the most reusable result:** `rothConv` and `yr.totalConverted` are engine
state, not display fields — `beginYear` reads `log[y-1].rothConv > 1000` to choose withdrawal
timing. See `findings.md`, "A log field the next iteration reads is engine state, not a label".

- [x] **P28a** — Harness with identity / degeneracy / divergence / mechanism sections and scored predictions
- [x] **P28b** — Two engine flags, default off, `ordered` excluded from both
- [x] **P28c** — `-unifiedConvGross` / `-unifiedRothSpend` hidden log keys (do NOT reuse `rothConv`)
- [x] **P28d** — Verified: node 148/32/22, in-page 242/242, browser A/B confirms routing 0 diffs / Roth-first 627
- [x] **P28e** — **ROUND 2 (2026-07-30):** second scenario set run — 5-scenario ladder x 6 families x 7 arms.
      Explains round 1's inconsistent sign and fixes it. `rothGapFill` now takes a POSITION:
      `true`/`fillRothThenCash` (ahead of everything) or `fillCashThenRoth` (Cash, then Roth, then Brokerage).
      `fillCashThenRoth` never destroys value in any of 20 comparable cells, where `fillRothThenCash` lost up to
      $137,062. Full detail in `findings.md`, "P28 round 2".
- [x] **P28f** — **DECISION OPEN:** ship `rothGapFill: 'fillCashThenRoth'` as a real option, drop the routing
      flag (inert in all 30 scenario x family cells), or delete both. The routing flag earns its
      keep only if the Annual Details reframe is wanted as a *view*, which `-unifiedConvGross`
      already makes possible.
- [x] **P28g** — If shipping: it is a per-family effect, not a global one. Proportional draws Brokerage in
      `planPrimaryWithdrawals` so the gap-fill order is not its lever, and Guyton-Klinger is not
      comparable at all (its guardrails re-cut spending). Ship it for the gap-filling families or
      as an optimizer sweep dimension, not as one global switch.
- [x] **P28h** — No heuristic predicts the payoff from the account mix — both candidate shortcuts were scored
      and failed. If it ships, the tool has to RUN it, the same conclusion P24 reached about the
      stop year.
- [x] **P28i** — **ROUND 3 (2026-07-30):** answered "does `convertExcessToRoth` ever lose on its own?" — **yes,
      13 of 25 cells, worst -$1,095,454**, for the same Cash-buffer reason plus a hidden
      withdrawal-timing flip. Added `forceWithdrawTiming` (research input, default off) to separate
      the two. Full write-up now lives at `research/CONVERSION_ROUTING.md`.
- [x] **P28j** — **SPUN OFF, see its own phase below:** `convertExcessToRoth` is a DEFAULT-FACING switch that can
      cost >$1M in plausible account mixes, and part of that is the early/late withdrawal-timing rule
      keying off `rothConv` — invisible and uncontrollable from the UI. Decide whether timing should
      key off conversion at all. This is a live product question, not a research curiosity.
- [x] **P28k** — **ROUND 4 (2026-07-30):** spend rate added as a CONTROLLED AXIS (4/6/8% of assets) after the
      user spotted the goals were high. Round 2 had confounded mix with strain (defaults sat at 8.6%,
      the rest near 4.4%). 630 sims, ~1.2s. **Three earlier conclusions overturned** — payoff peaks
      at 6% spend rather than growing with Brokerage share, "IRA Draw is unreachable" was
      strain-specific (+$1,200,484 at 6%), and `fillCashThenRoth` DOES have one negative cell. Mechanism
      came out sharper: every cell whose control never drew Brokerage returns exactly $0.
- [x] **P28f/g/h SETTLED 2026-08-24, shipped v11.162B.** `unifiedConvRouting` DELETED from the engine
      (inert in 90 cells; the two-leg view it existed for is already `-iraSpend` + `-iraConvGrossTot`),
      and its harness arm A1 removed with it so no arm can set a flag nothing reads. `rothGapFill`
      shipped twice: the *Roth before Brokerage* switch (under Cycle Brokerage, greyed under
      Ordered) and a 🅡 clone pass in `buildStrategyFamilies` gated on Roth > 0, both covering every
      strategy but `ordered`. Only
      `fillCashThenRoth` is swept - `fillRothThenCash` is the dominated position. `P28h` needed no
      code: "the tool has to RUN it" IS the sweep dimension.
- **Corrected the same day, before merge.** The first cut shipped an ALLOW-list of four families
  (`fixed`/`bracket`/`aca`/`fixedpct`), excluding Proportional and Guyton-Klinger on the strength of
  P28g's note that neither is comparable. The user asked what in GK already does this. Nothing does:
  GK's only special handling is the spend adjustment at `optimizer_core.js:1489`, it has no ordering
  logic, and it falls into the same default gap-fill branch. Measured, it is the family that gains
  most reliably - positive in **all 15** harness cells, +$8,683 to +$195,107 - and the gain arrives as
  delivered SPENDING (+$73,080 at balanced-thirds 6%) rather than terminal wealth, which
  `baselineScoreOf` counts on purpose. Proportional also reached +$11,959. The rule is now the
  engine's own: exclude `ordered`, nothing else. **The lesson: a note about whether a research cell
  can be READ cleanly is not a statement about whether the lever REACHES the strategy, and it must
  not become a shipping gate.**
- **⚠ THE 2026-07-30 NUMBERS NO LONGER REPRODUCE.** Re-running the harness on the v11.162B engine
  gives `fillCashThenRoth` a range of **+$470,977 to -$633,605, negative in 26 of 60 cells**, against
  the recorded +$3,559,596 / 1-of-60. P32 (v11.15e3) letting the third pass draw Brokerage is the
  likely cause - displacing a Brokerage draw is the entire mechanism, so changing when Brokerage is
  drawn changes size and sign. What survives: `fillCashThenRoth` is still the better of the two
  positions (54 of 60), and the zero-predicate still holds. What does not: "worth $3.56M and almost
  never loses". Warning box added to `CONVERSION_ROUTING.md` and `HARNESSES.md`; the shipped copy quotes the
  re-run. **The lesson is general: a research document is only true against the engine that produced
  it, and this repo changes that engine often.**
- **Status:** research complete (4 rounds); `P28f`/`g`/`h` shipped 2026-08-24. **`P28j` now HAS its
  own phase**, scoped 2026-08-27 - see `## P28j` immediately below. Nothing else in P28 is open.
- **Independent:** no phase dependencies

---

---

## P84: annual advisor / AUM fee, and RMDs off the prior December 31 balance  *(COMPLETE, SHIPPED v11.168c + v11.168d, 2026-08-28)*

**STATUS: COMPLETE.** `P84k/l/m/n/o` (the RMD basis) shipped as v11.168c; `P84a`-`P84j` (the fee
itself) shipped as v11.168d. Suites **353 / 61 / 22**, `slowInCore` 3, `TestTiers.EXPECTED` and
`.githooks/README.md` reconciled.

**What the fee ended up being.** TWO controls, not three - an amount and a scope. `applyAUMFee(sim,
yr)` between `resolveHousehold` and `computeIncome`, six billing scopes plus `none` over a frozen
basis/source/spill table, brokerage debited pro-rata against basis so `capGainsPercentage` is
unchanged, unpayable remainder dropped to `yr.aumFeeUnpaid`. Eleven node tests including two
`test.critical` non-taxability guards and the no-`_cfRun`-guard proof.

**The %/$ dropdown was REPLACED by inference, user request 2026-08-28.** One field: a `%` suffix or
`$` prefix wins outright, otherwise `>= AUM_FEE_PCT_MAX` (20) is dollars and below it is percent.
**The boundary belongs to FLAT deliberately** - a bare `20` read as $20/yr is harmless, read as 20%
it destroys a plan, and the asymmetry of being wrong picks the side. `inferAUMFeeMode` lives in the
ENGINE, not the UI, so a link carrying `af=20000` with no `afm` cannot be read as a 20,000% fee.
A line under the field says which way it read what you typed.

**And it fixed a real defect the dropdown was hiding.** `aumFeeAmount` is `data-plain`, so
`el.dataset.numVal` is never set and `val()` returns the literal text - `+val('aumFeeAmount')` on
`"20k"` was `NaN`, fell through `|| 0`, and charged NOTHING while looking like it had been accepted.
The field now runs through `parseShorthand` like every other dollar input on the page.

**`aumFeeMode` stopped being an element, which broke the URL round trip in both directions**, since
`buildShareURL` iterates elements and `loadFromURL` does `getElementById`. Fixed without hidden
state: the share URL pins the RESOLVED mode, and an incoming `afm` is folded back into the amount's
own TEXT as `$15` or `15%` - exactly what a user would have typed to mean the same thing, so one
field stays the single source of truth.

**Renamed AUM -> Advisor throughout, user request 2026-08-28.** "AUM" (assets under management)
describes the percentage arrangement only, and this models a flat annual fee just as happily. The
log columns are `AdvisorFee` and `SumAdvisorFees`; every identifier, element id and stat-tile id
moved with them. URL short keys `af`/`afs` are unchanged, so links keep working.

**UNGATED from the nerdknob, user request 2026-08-28.** It sat behind the knob only while it was
being proven out. It is a fact about the plan rather than a diagnostic - the rule at
`optimizer_ui.js:141-149` - and ungating costs nobody a number because the scope defaults to `none`.
The leak-guard argument that made gating awkward is now moot.

**`afm` is no longer emitted in the share URL, and pinning it was over-engineering.**
`buildShareURL` emits each field's own TEXT, so an explicit `$15` or `15%` already travels in `af`
verbatim; a bare `15` means what the inference says, which is what the user typed and saw. A second
parameter carrying the same fact could only ever disagree with it. Incoming `afm` is still ACCEPTED,
so links generated during development keep working - verified.

**`none` is the DEFAULT scope, added on the user's request 2026-08-28 after the first fee build.**
It is the off switch for a comparison: leave the amount typed and flip one dropdown, rather than
clearing and retyping a number. Unset and unrecognized scopes both fail safe to it, so a plan that
never mentions a scope charges nothing instead of silently billing every account. The engine RETURNS
on `none` rather than leaning on an empty basis array - flat mode never reads the basis, so an empty
array alone would not have stopped it. Verified in the browser that the round trip is exact:
finalNW 638,557 -> 205,067 -> 638,557.

**The base is `sim.priorYearEnd`, the SAME snapshot the RMD uses**, widened from two IRA fields to
all five billable accounts. That was not tidiness: anything read off `balance` between `beginYear`'s
growth call and `growAndSettle` inherits the 1-vs-11 `preMonths` dependency, so a fee struck at its
own call site would have moved with whether last year converted - the exact defect `P84l` removed
from the RMD. One snapshot, captured once, read by both.

**R11 is retired and PINNED by a test**: a mid-year fee no longer moves the same year's RMD, only
later ones, which is the legally correct answer.

**Two things found while verifying, both corrected before shipping.** The stat tile first carried a
sub-label reading "% of end wealth" while computing `fees / (fees + finalNW)`, which is neither.
Worse, the honest number is bigger than either: on the shipped defaults a 1% fee CHARGES $212,267
and lowers the ending balance by **$433,490**, because the money it removed would have compounded.
Any single-number ratio in a tile understates that by roughly half while looking authoritative, so
the sub-label is now the average annual fee and the real figure is left to a future phase that can
afford the second simulation Break Even already runs. And the Annual Details banner was checked for
shearing by counting VISIBLE header cells only - a first pass counted hidden ones and appeared to
show a 21-against-82 mismatch that did not exist.

**Open, deliberately:** the true lifetime cost of the fee (charged plus foregone compounding) is not
reported anywhere. It needs a counterfactual run. Candidate for its own phase.

**STATUS 2026-08-28: `P84k`, `P84l`, `P84m`, `P84n` and `P84o` are DONE and shipped as v11.168c.**
The RMD now keys off the prior December 31 balance. `rmdbasis_harness.js` + `RMD_BASIS.md`
carry the characterization and the scoring; four new node tests (340 -> **344**), `TestTiers.EXPECTED`
and `.githooks/README.md` reconciled; three GK pins and one P38 pin re-baselined, **each checked
against the characterization's predicted direction rather than accepted because it moved** (R12).
**Risk R11 and placement reason 3 are RETIRED**, exactly as this plan predicted they would be: a
mid-year fee can no longer move the same year's RMD. **`P84a` through `P84j`, the fee itself, are
untouched.**

Measured before: **22 of 30 plans had a timing-dependent RMD**, median 6.21%, max 58.62% - far above
the 5.49% an 11-month growth stub explains, because an inflated RMD forces out more, which re-bases
every later RMD. After: **0 of 30**, to 7e-18.

**The P84k prediction R2 was written wrong twice and both wrong versions are recorded** in
`rmdbasis_harness.js`'s header, because the first one - "the two timing arms give identical LIFETIME
RMDs" - condemns a CORRECT fix. Timing legitimately changes the balance path; the regulation
constrains the basis, not the trajectory.


**Why:** the tool models every drag on a portfolio except the one most retirees actually pay. A 1%
advisory fee on a $2M portfolio is ~$20,000 in year one, compounding for the whole horizon. That is
larger than most of the levers this tool argues about and larger than the gap between several of the
strategies it ranks, so a plan that ignores it is wrong by more than the margins it reports.

**Ask, as raised:** an annual fee typed either as a percentage or a flat dollar amount, with a
dropdown naming which accounts it applies to - Brokerage, Roths, IRAs, All, Roth and IRAs, All from
IRA. The percentage comes out of the impacted accounts; a flat fee is CPI-indexed. Cumulative cost
tracked. **Fee dollars taken from an IRA are NOT taxable distributions.** "All from IRA" charges
against every account but pays out of the larger IRA.

**Decided with the user 2026-08-27, do not re-litigate:**

| decision | chosen | why |
|---|---|---|
| timing and basis | start of year, pre-withdrawal | the Jan-1 balance; reconciles against the Annual Details balance columns |
| does "All" include Cash | **no**, All = IRA1+IRA2+Roth1+Roth2+Brokerage | Cash is the spending buffer P2's reserve protects; billing it fights the reserve refill every year |
| brokerage fee realizes gain | **no**, cut value and basis pro-rata, discard the gain | keeps the fee out of every tax pass, so it cannot perturb an IRMAA/ACA/LTCG cliff or trigger the third pass |
| flat mode and the dropdown | dropdown drives the withdrawal SOURCE | keeps the non-taxable-IRA benefit for flat fees, and one meaning for the dropdown in both modes |
| flat-fee index clock | `sim.cpiRate` | user said "indexed by CPI" and the sidebar field is labeled CPI/COLA. Alternative on the record: the purpose test at `optimizer_core.js:1231-1238` puts prices the household PAYS on `sim.inflation`, as `CashReserve` does at `:1693`. One-token change if revisited |
| counts toward `wdRate%` | **no** | `wdRate%` keeps meaning "portfolio draws that funded spending and taxes" and stays comparable to the 4% rule; PF14's definition holds. `totals.avgNetDepletion` already reflects the fee, being computed off `portfolioBalance` deltas |
| nerd-gated | **YES - user decision 2026-08-28, reversing the row below. Do not re-litigate.** | the fee input sits behind the nerdknob |
| ~~nerd-gated~~ | ~~no~~ | *superseded.* The argument was: it is a fact about the plan, not a diagnostic - the rule written at `optimizer_ui.js:141-149`; default 0 costs nobody a number, and gating it would strand a shared `?af=` link the recipient cannot see or clear. **The leak-guard problem it names is real and does not go away by gating: it becomes a REQUIREMENT.** Follow the `convEndYear` precedent (`P24b`) - a gated input whose URL key still loads, so a shared link reproduces its own numbers whether or not the recipient has the nerdknob on. `P84h` owns this; a plan carrying a nonzero fee must never silently drop it for a reader who cannot see the field |

**Three inputs keys**, element id === engine key so `applyScenario`'s generic loop
(`optimizer_ui.js:5028-5070`) round-trips them for free: `aumFeeAmount` (number, **raw as typed,
never `/100`**, default `0` = OFF), `aumFeeMode` (`'pct'`|`'flat'`, default `'pct'`), `aumFeeScope`
(one of `AUM_FEE_SCOPES`, default `'all'`).

**Storing the amount raw is load-bearing, not a style choice.** A field whose meaning switches
between `%` and `$` cannot live in `applyScenario`'s x100 list (`optimizer_ui.js:5043-5046`) or in
`DOLLAR_INPUT_IDS` (`:4970-4974`), because which list applies would depend on a SECOND field. It is
a `data-plain` text input, the `convEndYear` precedent (`retirement_optimizer.html:168`), and the
engine does the `/100`.

**Placement: a new `applyAUMFee(sim, yr)` called between `resolveHousehold` and `computeIncome`**
in the year loop (`optimizer_core.js:3266-3286`). Three reasons, all load-bearing:
1. The balance there is byte-identical to the end of `beginYear` (`:1292`) - `resolveHousehold`
   moves only `BrokerageBasis`, for the IRC-1014 step-up (`:1361`). So this IS the Jan-1
   post-pre-withdrawal-growth balance the fee is defined against.
2. `resolveHousehold` can `return false` and break the loop (`:1306`, both spouses dead). Charging
   inside `beginYear` would debit a year that never gets a log row.
3. It is BEFORE `computeIncome`, so the fee lands on the IRA before RMDs are computed
   (`:1554-1557`). **A 1% fee therefore shrinks the RMD by 1%.** Small, conservative in direction,
   and a real consequence of the chosen timing - it gets a docblock sentence and a test that pins it.

**The non-taxability mechanism, stated once:** `applyAUMFee` writes `balance` and `yr.aumFeeBy` and
**never `yr.netWithdrawals`**. Every `calculateTaxes()` call site reads `yr.netWithdrawals.IRA` as
both `earnedIncome` and `iraIncome` (`:1980, :2173, :2394, :2698, :2842, :2857`), so a debit that
never enters that accumulator cannot reach any tax pass, any MAGI, or the TaxPlanner handoff. Same
technique the QCD already uses at `:1576-1577`.

**Scope tables**, frozen and exported next to `splitPreferLarger` (`:2746`) so the UI validates
against the engine's own list rather than a second copy:

- BASIS - what it is charged on. Cash is in no row. `brokerage`->[Brokerage]; `roths`->[Roth1,Roth2];
  `iras`->[IRA1,IRA2]; `rothira`->[IRA1,IRA2,Roth1,Roth2]; `all` and `allfromira`->all five.
- SOURCE - identical to BASIS for five of six. `allfromira` -> `splitPreferLarger(IRA1, IRA2)`.
- SPILL once the source is dry: Brokerage, IRA1, IRA2, Roth1, Roth2. Roth last, matching
  `fillSpendingGap`'s own order. **Cash never.**
- In flat mode BASIS is simply unused: `want` comes from the mode, `paid` from the source. No
  special-casing.

Brokerage debit cuts value and `BrokerageBasis` by the same fraction, then `clampBrokerageBasis`
(`:394`) re-establishes the P35f invariant. The ratio is unchanged, so `yr.capGainsPercentage`
(`:1696`) prices identically. An unpayable remainder lands in `yr.aumFeeUnpaid`, dropped rather than
carried and never turned into a shortfall - the floor-at-0 posture `applyWithdrawals` takes (`:645`).

**NO `_cfRun` guard, deliberately.** The counterfactual runs (`:3302-3343`) spread the whole inputs
object, so both arms pay the same fee and the Opportunity Cost comparison stays purely about the
CONVERSION. Adding a guard later would make every OC number nonsense; the docblock forbids it and
`P84f` exists to catch it.

**Tracking:** `sim.cumulativeAUMFees` beside `cumulativeTaxes` (`:3171`, `sim` literal `:3254`);
`totals.aumFees` + `totals.aumFeesCurrentDollars` in `growAndSettle` beside `totals.qcd` (`:2904`),
same defensive `(totals.x || 0) +` idiom; four row keys in `buildSimYearLogRecord` (`:1036`)
inserted **adjacently** after `'CashWD'` (`:1071`) - `AUMfee`, `SumAUMfees`, `-aumFeeBasis`,
`-aumFeeFromIRA`. Adjacency is required, not cosmetic: `rebuildGroupRow` (`optimizer_ui.js:2739`)
colSpans runs of consecutive same-group columns, so a visible key dropped mid-run shears the banner.
Emit all four **unconditionally** with `?? 0` or the `_logSansTiming` identity tests
(`optimizer_core.tests.js:1775`) break. Neither visible key contains `%`, `yr` or `year`, so the
name-driven formatter (`optimizer_ui.js:2976-2978`) prints both as dollars and deflates both under
Current-$.

**UI:** sidebar section 2 (Assets), after the Cash Balance / Cash Reserve row
(`retirement_optimizer.html:335-338`) - every dropdown option names a balance typed in that section.
Amount + `$`/`%` mode on line one, accounts dropdown on line two, one `input-group`, one `<label>`,
wrapper id `aumFeeAmount-wrap`. URL short keys `af`/`afm`/`afs`, checked against
`OPT_LONG_TO_SHORT` (`:4594-4617`) and the hand-set `ptx`/`ptxm`/`ptxr` (`:4667-4671`); no change to
`buildShareURL` or `loadFromURL` needed. One self-hiding stat tile, shown only when
`totals.aumFees > 0`.

### Fee timing: end-of-year and quarterly were considered and rejected  *(user asked 2026-08-28)*

**Rejected: charge at the END of the year.** It fixes one real thing and breaks a bigger one.

- **What it would fix, and this is a genuine defect in the start-of-year design as first written.**
  Charging between `resolveHousehold` and `computeIncome` means the fee is struck off a balance that
  already carries `preMonths` of this year's growth (`beginYear:1288`), and `preMonths` is **1 or 11**
  depending on whether last year converted. **The fee base inherited exactly the coupling the RMD
  goal exists to remove.** The generalization is worth stating once: *anything* computed off `balance`
  between `beginYear` and `growAndSettle` picks up the 1-vs-11 conversion dependency. That window now
  has two known casualties, the RMD and the fee base.
- **What it would break.** At start-of-year the fee debits `balance` before `resolveSpendTarget`
  snapshots `yr.curBalances` (`:1685`), so every downstream pass sees a portfolio already net of the
  fee and the engine RESPONDS to it - draws more, records a shortfall, or trips `totals.success`. At
  end-of-year the fee lands after `applyWithdrawals` (`:2578`) and all three tax passes, so the year's
  spending was planned against money the fee was about to take. **The fee could no longer cause a
  shortfall in the year it is charged.** It would shrink the closing balance silently and surface a
  year late. `evaluateYearOutcome` reads `yr.portfolioBalance` at `:2950-2952`: debit before it and a
  plan is failed for a fee it was never given a chance to fund; debit after and failure detection runs
  a year stale. Neither is right, and for a planning tool "the model notices the fee broke the plan"
  is most of the point of modeling the fee at all.
- **Two smaller ones.** The Cash Reserve refill at `:2601-2604` would run against a pre-fee surplus
  and over-refill every year, systematically. And terminal wealth (`:2943`) plus the IRC-1014 step-up
  would absorb a final-year fee with no offsetting year of service, shifting every terminal-scored
  comparison - Break Even, `finalNW`, the `networth` objective.

**Rejected: quarterly.** The engine has exactly two growth applications per year, `preMonths`
(`:1288`) and `postMonths` (`:2877`), split 1/11 or 11/1. There is no quarterly grid to hang four
debits on; building one would touch `applyGrowth`, the early/late rule, and every test that pins a
balance. The prize does not justify it: annual-vs-quarterly on a percent fee is second order, on the
order of `rate^2 * 3/8 * balance`, which at 1% on $2M is roughly **$75/yr against a $20,000 fee**.
Rounding error on the fee itself. *(Order-of-magnitude estimate, not a measurement.)*

**ADOPTED instead: keep the charge at the start of the year, and take the BASE from the same prior
December 31 snapshot `P84l` builds for the RMD.** This is strictly better than either alternative and
costs nothing extra:

- No timing coupling. The anchor is captured before `:1288` runs, so it predates `preMonths` entirely.
- The fee stays inside the withdrawal cascade, so solvency detection keeps working.
- It matches how advisors actually bill, on prior-period value.
- Next year's RMD is struck off a December 31 balance that already reflects this year's fee, which is
  what really happens.

One snapshot, captured once, read by both goals. **This is why the two goals share a branch.**

### Second goal, added by the user 2026-08-28: RMDs must key off the PRIOR YEAR December 31 balance

**The rule:** 26 CFR 1.401(a)(9)-5 sets the year's required distribution as the **prior December 31**
account balance divided by the life-expectancy factor. Nothing that happens during the year - growth,
a fee, a conversion, a withdrawal - can change the amount required for that year.

**The engine does not do this.** `optimizer_core.js:1557-1558`:

```js
yr.rmd1 = yr.alive1 ? balance.IRA1 * yr.rmd1Pct || 0 : 0;
```

`balance.IRA1` at that moment has already had **this year's** pre-withdrawal growth applied, at
`beginYear:1288` (`applyGrowth(balance, yr.growthRates, preMonths)`). So the RMD is struck off a
mid-year balance.

**That is two errors, and the second is the serious one.**
1. A systematic overstatement of `preMonths/12 x growth`. Directionally: RMDs are too big, taxable
   income is too high, IRMAA breaches slightly too frequent, terminal IRA slightly too small.
2. **The RMD is coupled to the withdrawal-timing rule.** `preMonths` is **1 or 11**, chosen at
   `:1284` from `yr._useEarly`, which is set at `:1275` from whether last year converted more than
   $1,000. At 6% growth that is a ~5% swing in the RMD base. **Two otherwise identical plans get
   different RMDs because one of them converted** - a dependency with no basis in the regulation.
   This is the same coupling `P28j` is scoped against, surfacing in a second place, and it is why
   this belongs in a phase rather than a one-line fix.

**The correct anchor already exists and costs nothing to capture.** At the TOP of `beginYear`,
before `:1288`, `balance` **is** the prior December 31 position: last year's `growAndSettle` applied
`postMonths` and nothing has moved since. Year 0's prior-Dec-31 balance is the number the user typed.
So: snapshot `sim.priorYearEndIRA1` / `priorYearEndIRA2` at the top of `beginYear`, and read those at
`:1557-1558` instead of `balance.IRA1/IRA2`.

**This SIMPLIFIES the fee work rather than complicating it.** Placement reason 3 above, and risk R11,
both dissolve: once the RMD keys off the prior Dec 31 balance, a fee paid in year Y **cannot** shrink
year Y's RMD, which is the legally correct answer. The fee keeps placement reasons 1 and 2. **Strike
R11 and reason 3 when `P84k` lands.**

**One edge case the fee newly makes reachable.** The RMD debits floor at zero (`:1582-1583`), but
`yr.totalRMD` and `yr.taxableRMD` (`:1586-1587`) are computed from the requirement, not from what
actually moved. If the fee - or a large QCD, which is the latent path today - drains the IRA below
the required amount, the engine taxes money that never left the account. Cap both at the realized
outflow.

### Two follow-on questions the user raised 2026-08-28, and the answers

**Q1. The actual timing of the RMD withdrawal is variable. Does that need modeling?**

**No, and the P84l fix is what makes it safe to say so.** Under 26 CFR 1.401(a)(9)-5 the required
AMOUNT is fixed by the prior December 31 balance and the divisor. It does not matter whether the money
comes out in January or December - the obligation is identical. So once the basis is right, the
withdrawal date has **zero** effect on the amount, and the question separates cleanly from the defect.

What is left is pure growth attribution: dollars leaving in January miss the year's return, dollars
leaving in December do not. That is roughly `RMD x growth x monthsHeld/12` - on a $40,000 RMD at 6%,
about $2,400 between the two extremes. Real, but it is the SAME question the engine already answers
once, globally, with the `preMonths`/`postMonths` split, and `P28j` is already scoped to settle that
one rule. **Recommendation: let the RMD ride the existing timing split; do not give it a third knob.**
A separate RMD-timing input would multiply the state space against a rule that is itself under review.

**One genuine lever deliberately left out of scope:** the first RMD year may be deferred to April 1 of
the following year, taking two distributions in year two. That is a real planning choice with a real
tax consequence, it is not modeled, and it is not in `P84`. Named here so it is a decision rather than
an omission. Candidate for its own phase.

**Q2. A plan launched after January does not know its prior December 31 balance. What then?**

**This is `P72`'s problem, not `P84`'s, and the seam is clean.** For every year after the first, the
simulation knows its own December 31 balance exactly - `P84l` is correct with no help from anywhere.
The gap is year 0 only, and it exists only when the plan starts mid-year, which is precisely the
condition `P72` introduces `startMonth` to describe.

The failure is specific: a plan opened in September types a SEPTEMBER IRA balance, and `P84l` would
use it as the prior-December-31 anchor. That overstates year-0's RMD by roughly eight months of
growth - **reintroducing, in year 0, the exact error the phase exists to remove.** `P72` already
records why reconstructing the January figure by hand is impractical: the change since January mixes
growth, taxable events, withdrawals and deposits.

**Recommended fix, and it is better than asking for the December 31 balance: ask for the year's RMD
DOLLAR AMOUNT directly, year 0 only.**

- **The custodian already computed it.** Fidelity, Schwab and Vanguard all state the year's RMD on the
  January statement and on an account page. It is one of the easiest retirement numbers to obtain -
  far easier than a December 31 balance, which the user would have to dig a statement out for.
- **It is exact.** No divisor lookup, no balance reconstruction, no growth assumption layered on top.
- **It absorbs cases the engine cannot model anyway** - inherited IRAs on their own schedules, accounts
  aggregated differently than the tool's two-IRA shape, the still-working exception.
- **It degrades gracefully.** Blank falls back to a derived estimate,
  `priorDec31 ~= typedBalance / (1 + growth x elapsedMonths/12)`, sized by `P72`'s `startMonth`. At
  `startMonth = 1` the correction is the identity and nothing changes for the common case.

**This REFINES `P72`'s existing "RMD is NOT prorated" decision rather than contradicting it.** That
row is right: the RMD is a full-year obligation and owes nothing to the stub fraction. What `P72`
should add is that the year-0 RMD **basis** is not the typed balance either. Recorded as `P72k`.

**Blast radius: this changes EVERY plan, not only plans that use the fee.**
- The fee-OFF byte-identity test (`P84a`) is scoped to *fee-off vs field-absent under the new RMD
  basis*. It is **not** an identity against `main`, and must not be written as one.
- `optimizer_core.tests.js:259` (cyclic, beyond-RMD) and `:2658` (OC counterfactual RMD
  counter-effect) are the likely re-baseline candidates. **Measure; do not guess which.**
- The changelog entry must tell the reader a saved plan will not reproduce - stated as consequence,
  not as history, per the repo's changelog rule.

**Tasks:**
- [x] **P84a** *(S)* - scope tables, `_debitFee`/`_debitProRata`, `applyAUMFee`, the one-line
      year-loop call, exports. No log, no totals, no UI. Ships behind a `0` default, so the OFF
      byte-identity test is the whole safety net for this step.
- [x] **P84b** *(M)* - basis x source matrix, one test per scope: `brokerage`, `roths`, `iras`,
      `rothira`, `all` (proves the Cash exclusion), `allfromira` (charges All, pays from the larger
      IRA). Asymmetric balances throughout, so pro-rata cannot pass as 50/50.
- [x] **P84c** *(M)* - non-taxability invariants, two of them `test.critical`: a percent fee moves
      no tax, no MAGI and no RMD in year 0; the IRA debit never enters `netWithdrawals`; a brokerage
      fee realizes no capital gain and cuts basis pro-rata.
- [x] **P84d** *(S)* - flat-mode CPI indexing (`cpi: 0.03, inflation: 0.06`; assert `1.03^10` and
      explicitly NOT `1.06^10`), depletion/spill order, `aumFeeUnpaid`, no negative balance, no NaN.
- [x] **P84e** *(S)* - tracking: cumulative scalar, the totals pair, `logYear` params, four row
      keys, and the reconciliation test (`SumAUMfees` == sum of `AUMfee` == `totals.aumFees`).
- [x] **P84f** *(S)* - counterfactual proof. No engine change; the test exists to forbid a future
      `_cfRun` guard.
- [x] **P84g** *(S)* - Annual Details wiring: `columnCategories` (`~:2495`), `columnGroupDefs`
      (`:2556`), header `tooltips` (`:2809`). Both columns auto-hide at zero via
      `analyzeColumnContent` (`:2653`).
- [x] **P84h** *(M)* - sidebar markup, `getInputs()`, `LABELS` (`:4453-4472`), URL keys. Needs a
      real narrow-width look and a manual save -> reload -> share-link -> reload round trip.
      **NOT** added: the dollar-input array (`retirement_optimizer.html:1347`), `DOLLAR_INPUT_IDS`,
      the x100 list, the `_runOptimizerNow` strip list, `STRATEGY_SELECTION_FIELDS` - each for a
      reason recorded below.
- [x] **P84i** *(S)* - stat tile markup and the `updateStats` writer, including Current-$.
- [x] **P84j** *(M)* - docs and counts: the `applyAUMFee` node in the `ARCHITECTURE.md:156`
      pipeline; `TestTiers.EXPECTED` `optimizer_tests.js:2725` **all four numbers**; the suite table
      `.githooks/README.md:16-20`; one `optimizer_changelog.md` entry plus the matching `<li>`; four
      version-bump sites. Mechanical, and the step most often half-done.

**ORDER:** `P84k` through `P84n` run **FIRST**, before `P84a`, despite the letters. They are lettered
in the order they were added to the phase, per the file's convention; they execute first because the
RMD basis change moves every number the fee tests would otherwise be baselined against, and because
it retires placement reason 3 and risk R11 before the fee code is written to depend on them.

- [x] **P84k** *(S)* - characterize BEFORE changing anything. Dump `totalRMD`, `taxableRMD`,
      `MAGI`, IRMAA breach count and terminal IRA across a spread of plans, both timing arms, and
      record the size of the error and of the convert/no-convert RMD split. **This is the number the
      changelog sentence is written from**, and a null result here would mean the fix is invisible
      and the re-baseline risk is not worth taking. Gate for `P84l`.
- [x] **P84l** *(S)* - `sim.priorYearEndIRA1` / `priorYearEndIRA2` snapshotted at the top of
      `beginYear` before the growth call (`:1288`), read at `:1557-1558`. The same snapshot is the
      AUM fee's base, per the timing decision above - captured once, read twice.
      **Year 0 is NOT clean, and an earlier draft of this task wrongly said it was.** The snapshot
      seeds from the typed IRA balance, which is only a December 31 balance for a plan that starts in
      January. See the year-0 section below; `P84o` puts a guard on it and `P72` owns the fix.
- [x] **P84m** *(S)* - cap `yr.totalRMD` and `yr.taxableRMD` at the realized IRA outflow, so a
      drained IRA cannot be taxed on a distribution that never happened. Reachable today via a large
      QCD; the fee widens the path.
- [x] **P84n** *(M)* - tests and re-baseline: RMD equals prior-Dec-31 balance over the divisor to the
      penny; **the RMD is identical across the two timing arms** (this is the coupling test, and it
      is the one that fails on `main`); a mid-year fee does not move the same year's RMD; the drained
      IRA case. Then re-run all three suites, re-baseline whatever moved, and reconcile **all four**
      numbers in `TestTiers.EXPECTED` plus `.githooks/README.md`.
- [x] **P84o** *(S)* - **year-0 honesty guard, and the `P72` handoff.** `P84l` is exact for every year
      after the first and for any January-start plan; year 0 of a mid-year plan uses a balance that is
      not a December 31 balance. Until `P72k` lands: assert in a test that year 0's RMD basis is the
      typed input (so the limitation is pinned, not drifting), and say plainly in the RMD column
      tooltip and the changelog that the first year's RMD is estimated from the balance as entered.
      **Do not paper over it with a growth-based back-out here** - that guess belongs with `startMonth`,
      which only `P72` has. Declaring the limitation is the deliverable; fixing it is `P72k`.

**Risks, and the specific mechanism each one breaks through:**

| # | what silently breaks | mechanism | mitigation |
|---|---|---|---|
| R1 | Break Even `convBEYear` moves | not a leak; the fee rides both counterfactual arms. But it shrinks both portfolios, so the RMD/IRMAA cascade shifts non-linearly. Correct, not a bug | `P84f`; one changelog sentence |
| R2 | BETR is fee-blind | `computeBETR` (`:2932`) is closed-form over growth and marginal rates and reads no balance | deliberate; say so in the commit message |
| R3 | a future `_cfRun` guard | would diverge the arms by the whole fee stream and make every OC number nonsense | docblock forbids it, `P84f` fails loudly |
| R4 | Optimizer sweep | the fee must **NOT** join the `_runOptimizerNow` strip list (`optimizer_ui.js:1035-1043`). It is plan-wide and biases no comparison; stripping it makes every swept row a fee-free fiction while the CURRENT PLAN row pays, ranking strategies above the user's own plan on the fee alone | comment beside the three existing strips |
| R5 | Monte Carlo hashing | the fee is constant across every variation, so it does **NOT** belong in `STRATEGY_SELECTION_FIELDS` (`optimizer_core.js:4097`). Adding it on one side only is exactly P74. MC gets it free through `simulate({...baseInputs, ...pathInputs})` | explicit non-change, recorded here |
| R6 | TaxPlanner year-click handoff | if the fee ever entered `yr.netWithdrawals.IRA1/IRA2`, `-iraVolSpend*` inflates and the planner taxes a non-taxable debit | `P84c` |
| R7 | Annual Details banner shears | `rebuildGroupRow` colSpans consecutive same-group columns | adjacent insertion + `columnGroupDefs` |
| R8 | `_logSansTiming` identity tests | they `JSON.stringify` whole rows; a conditionally-emitted key breaks them | emit all four keys unconditionally with `?? 0` |
| R9 | `applyScenario` drops the fee | the generic loop matches `getElementById(key)`; any id/key mismatch loads a plan without its fee | ids are exactly `aumFeeAmount`/`aumFeeMode`/`aumFeeScope` |
| R10 | reserve breaches in plans that never breached | a fee draining Brokerage makes a breach likelier. Second-order only: the fee touches Cash in no basis, source or spill row | changelog sentence |
| R11 | ~~RMDs shrink by the fee rate~~ **RETIRED by `P84l`** | was a consequence of charging before `computeIncome`. Once the RMD keys off the prior Dec 31 balance, a mid-year fee cannot move the same year's RMD at all | `P84n` pins it; delete this row and placement reason 3 when `P84l` lands |
| R12 | the re-baseline hides a real regression | `P84l` moves numbers in almost every suite, so a genuinely broken assertion can be "fixed" by accepting the new value | `P84k` characterizes the expected direction and size FIRST, so each moved number is checked against a prediction rather than accepted because it moved |

- **Status:** filed 2026-08-28, not started. Second goal (RMD basis) added by the user the same day.
  **Estimate: 8 files, ~21 new tests (`optimizer_core` 340 -> ~361), 15 sub-tasks - 10 S, 5 M, no L.**
  The fee half is additive and hides behind a `0` default; **the RMD half is a behavior change for
  every existing plan** and carries the only re-baseline risk in the phase, which is why `P84k`
  measures before `P84l` moves anything. Nearest shipped comparable for the fee: **P2 Cash Reserve**.
  Nearest for the RMD correction: **P58**, where an assumption about money already moved was
  corrected and saved plans stopped reproducing.
- **Two goals, one branch, one changelog entry.** They ship together because `P84l` retires the fee's
  third placement reason and risk R11: writing the fee first would bake in a rationale that the RMD
  fix then deletes. If they are ever split, **the RMD half goes first** and the fee half rebases onto
  it, never the reverse.
- **Test fixture:** a local `AUM_BASE = {...BASE, growth: 0, inflation: 0, cpi: 0, ...}` with a
  non-zero balance in every account, so each scope has something to bite and the arithmetic is
  checkable by hand.
- **Independent, with one declared seam:** no blocking dependency. Touches `beginYear`'s
  neighbourhood only, so it does not collide with `P35i`'s `fillSpendingGap` arm. **`P72k` finishes
  year 0** for a mid-year plan - `P84o` declares that limitation rather than hiding it, and nothing
  in `P84` waits on `P72`. **`P28j` is the other neighbour:** it owns the `preMonths` 1-vs-11 rule
  whose contamination of this window is what `P84l` routes around, and the RMD withdrawal-timing
  question in Q1 above resolves to "let `P28j` settle it", not to a knob here.

---

---

## P30: Withdrawal policy — the constants nobody chose, and whether strategy should imply order at all

**Why:** the gap fill has three mutually exclusive orderings (`optimizer_core.js:1516-1556`) and which
one a user gets is a **side effect of the spend strategy they picked**, not a choice they made. Fill
Bracket gets Cash, then Brokerage, then Roth, strictly sequential (`optimizer_core.js:1520-1534`).
Proportional / Reduce / GK get Brokerage+Cash blended at a hardcoded `[40, 60]`
(`optimizer_core.js:1543` — verified a bare literal with no comment justifying it) then Roth. Ordered
gets the user's own sequence. Nobody chose the 40/60. Nobody chose that the bracket family drains Cash
to zero before touching Brokerage. Both constants sit directly on the code path P28 measured at up to
+$3,559,596.

**Scope — the user chose the FULL withdrawal-policy review (2026-08-01).** Three parts, in this order:
1. The two unchosen constants.
2. The orderings beyond the three shipped ones. `resolveOrderedSeq` (`optimizer_core.js:709-719`)
   implements CBIR (default), RIBC and BIRC. 24 orderings of four accounts exist. Harness-only;
   shipping any subset is a separate decision.
3. The structural question: **should strategy choice keep implying gap-fill order at all?** Today
   `yr.isBracketStrategy` / `yr.isOrderedStrategy` route the gap fill, so picking a *spend* strategy
   silently picks a *sourcing* policy. Decoupling them is the largest change in this phase and is
   design work rather than a sweep — cost it before committing to it.

**Falsifiable questions:**
- **Q1.** Is `[40, 60]` better than any other weight? Sweep w in {0, 20, 40, 60, 80, 100}. A flat curve
  is a real result: "the constant is not load-bearing" ends part 1 and is worth recording.
- **Q2.** Is Cash-before-Brokerage right for the bracket family? The two are not symmetric — Cash earns
  `cashYield` taxed as ordinary income, Brokerage realizes LTCG and steps up basis. P28's mechanism
  settles Roth-vs-X and says nothing about Cash-vs-Brokerage.
- **Q3 (prediction to state up front and score).** P28's "no Brokerage draw, no lever"
  (`research/HARNESSES.md`) predicts the weight is inert wherever Brokerage is never touched.
  If the prediction holds, Q1's answer is conditional, not global.
- **Q4.** Does any of the 21 unimplemented orderings beat all three shipped ones?
- **Q5.** How many rows would change if gap-fill order became independent of spend strategy?

**Design decisions forced by the evidence:**
- The weight must become a research **input** before it can be swept: `gapFillWeights`, default
  `[40, 60]` so unset is bit-identical. Same shape as P28's research inputs.
- Score on `baselineScoreOf` (`optimizer_core.js:2799`), not `finalNW` — PF11 established `finalNW` is
  orthogonal to "would this change help."
- Exclude `ordered` from the weight sweep, for the reason P28 excludes it (`optimizer_core.js:1511`):
  it has its own order.
- **Do not touch `resolveResidualAndForcedIRA` in this phase.** That is P32.

**Already ruled out — do not re-derive:**
- Roth's position in the gap fill. `fillCashThenRoth` is the better of the two positions and
  **shipped 2026-08-24** as the *Roth before Brokerage* switch plus the 🅡 sweep rows.
- **RE-BASELINED 2026-08-24, `CONVERSION_ROUTING.md` section 15.** The ladder was re-run on today's engine
  before P30 was allowed to reuse it. Quote section 15, never the 2026-07-30 tables.
  - **Still true:** the **zero-predicate** - a control arm that never drew Brokerage returns exactly
    $0. Both such cells in the grid still do. And the ranking: `fillCashThenRoth` beats
    `fillRothThenCash` in 54 of 60, losing only on Proportional.
  - **No longer true, and this is the one that bites P30:** "Roth pays when it displaces a Brokerage
    draw" **no longer predicts the sign**. The largest Brokerage draws in the grid now produce the
    largest LOSSES (brokerage-heavy, $7.4M drawn, -$146,374; balanced thirds at 6%, -$633,605),
    where the same cells used to produce the largest gains. What predicts the sign now is the pair
    (spend rate, brokerage share). The payoff also FALLS with spend rate (+$470,977 / +$117,615 /
    +$40,597 at 4/6/8%) where it used to peak at 6%.
  - **Untested hypothesis:** P32 letting the third pass draw Brokerage means Roth spent early in the
    gap fill is Roth the third pass can no longer reach. Settle it by re-running the grid with
    `thirdPassBrokerage: 'off'` and seeing whether the old shape returns. Cheap; do it as part of
    `P30b` rather than guessing.
  - **The ladder is still a good SCENARIO SET** - the five mixes and three rates span the space. It
    is the numbers, and the directional mechanism, that may not be carried forward. **A weight sweep
    must not assume that moving a draw from Brokerage to Cash is directionally good.**
- Whether the three shipped `orderedSeq` sequences matter — already swept (`optimizer_ui.js:841`).
- The unified-conversion reframe — measured inert, 0 money fields moved in 90 cells.

**Tasks:**
- [x] **P30a** — **DONE v11.162K 2026-08-24.** `gapFillWeights` research input at the default gap-fill
      branch, replacing the bare `[40, 60]`. Weights are RELATIVE (the normalizer divides by the sum),
      so `[4,6]` is `[40,60]`; percentages only because that is how the literal read. Validated to a
      SHAPE - two finite non-negative numbers with a positive sum - so anything malformed means
      "leave today's behavior alone", the discipline the `rothGapFill` `|| null` bug bought.
      `[0,0]` is the one that had to be caught: it divides by zero in the normalizer and puts NaN
      through every balance. No UI, no URL param, absent from `getInputs()` - confirmed in the
      browser. `ordered` and the bracket family never reach this branch, so they are excluded by
      construction rather than by a guard.
      **Endpoints verified before anything is read into them:** `[0,100]` asks the gap fill for no
      Brokerage at all, `[100,0]` still spills into Cash through the shortfall cascade, and the split
      moves monotonically across 0/20/40/60/80/100. That is what makes a 0-to-100 sweep a sweep of
      one policy rather than of two. Suite 308 -> 310.
- [x] **P30 re-baseline** — DONE 2026-08-24, `CONVERSION_ROUTING.md` section 15. See the block above.
- [x] **P30b** — **DONE 2026-08-24.** `.test_harnesses/gapfill_harness.js`, 2,430 sims in ~2s, full
      write-up in `GAPFILL_SPLIT.md`. **Q1 is answered: the constant IS load-bearing and 40 is not
      the number.** 227 of 360 cells move by more than $1,000 (widest $616,919), and among the 82
      cells that are clean wealth comparisons - delivered spend unchanged, every weight funding the
      plan - **w=40 is best in ZERO of them** and w=0 in 65. Blast radius is three families only
      (Proportional, Reduce, GK); the bracket family and Ordered are bit-identical at every weight
      across 270 guard runs. **Cash Reserve damps the whole effect by an order of magnitude** (CA
      widest $534,525 reserve-off vs $33,358 reserve-on) and is the bigger lever; state matters much
      less. The `thirdPassBrokerage: 'off'` arm came back with the SAME shape, so **P32 does not
      explain this result** and the separate P28 inversion hypothesis stays open.
- [x] **P30c** — **DONE v11.1637 2026-08-25. Q2 is answered: today's order is RIGHT.**
      `bracketGapOrder` research input at the bracket branch, which was rewritten from nested ifs
      into a sequence so the arm is the order of a list; the control path is bit-identical. Swapping
      to Brokerage-first **loses in 21 of 23 clean cells**, by up to **$587,970**, and in every cell
      of the CA / reserve-off slice. Predictions F/G/H all held.
      **The headline of P30 is now that the two constants DISAGREE and the bracket branch is the one
      that got it right.** Both results say the same thing - fill a spending gap from Cash before
      Brokerage - and the bracket branch already does, while the default branch's 40% Brokerage does
      not. That is the defect, and it is a one-line default change if `P30g` wants it.
      Caveats on the record: only 23 of 105 live cells are clean; prediction G held on a **5% margin**
      (CA $587,970 vs TX $561,127), which is not evidence of a state-tax mechanism but of state
      barely mattering, the same conclusion `P30b` reached; and the lifetime Cash/Brokerage totals
      move in DIFFERENT directions between mixes, so only the score comparison means anything.
      Cash Reserve damps this one too - 87 live cells reserve-off vs 18 reserve-on, the third time
      the reserve has proved the bigger lever. Suite 310 -> 312.
- [x] **P30d** — **DONE v11.1638 2026-08-25. Q4 is answered: yes, and two shipped codes are dead.**
      `resolveOrderedSeq` generalized from a three-entry map to a generator over the letters, so a
      permutation now means what it names instead of silently becoming CBIR. The three shipped codes
      are byte-identical and nothing ships - `grids.ordered` still sweeps the same three.
      **RIBC and BIRC never win a single cell of 60.** CBIR wins 14. The outright best is **CBRI**
      (Cash, Brokerage, Roth, IRA) with 22 wins, and it is not on the menu. An unshipped ordering
      beats every shipped one in 15 clean cells, widest **+$858,316** (CIBR).
      **24 orderings are only ~15 plans**: median 21 distinct per cell, minimum 5, because the tail
      of a sequence past the point the gap is filled is irrelevant and empty accounts are skipped.
      **And the P30 story stops here.** "Cash before Brokerage" - which `P30b` and `P30c` both found
      on their own branches - wins exactly **30 of 60** cells under Ordered, a coin flip. A
      four-account sequence also places the IRA and Roth and those swamp the Brokerage/Cash pair. The
      narrower "Cash FIRST" does survive, 46 of 60. Recorded as a BROKEN prediction with the narrower
      reading printed beside it rather than substituted for it. Suite 312 -> 313.
- [x] **P30e** — **DONE 2026-08-25, design only, nothing built. Recommendation: DO NOT decouple.**
      Full costing in the "P30e: costing the decoupling" section below.
- [x] **P30f** — **DONE 2026-08-24, and it is an honest MISS.** The zero-predicate was scored
      **VACUOUS**: not one cell in the grid had a control arm that never drew Brokerage, so the
      prediction could not fire. It is neither confirmed nor refuted here. A prediction that cannot
      fire on the grid it is written for should be caught when it is written, not when it is scored -
      if it is wanted, `P30d` or a follow-up needs a low-spend / Cash-rich cell built for it
- [x] **P30g** — **DONE v11.163F 2026-08-25. The MENU changed; neither constant did.**
      - **Shipped:** `ORDERED_SEQS` - one list shared by the sidebar dropdown, `MC_GRIDS.ordered` and
        `OPTIMIZER_GRIDS.ordered`, so a sequence a user can pick is always a sequence the sweeps
        score. Six entries in the order they earned: **CBRI, CBIR, CIBR, BCIR, RIBC, BIRC** - by
        outright wins, ties broken by summed margin over the best shipped ordering
        (`GAPFILL_SPLIT.md` section 15: CIBR $1,851,441 over BCIR's $1,666,683 at 8 wins each).
        CBIR stays the pre-selected option and the resolver fallback. Cost: MC 144 -> 156 rows,
        Optimizer 117 -> 126.
      - **NOT shipped, and this is the decision, not an omission:** the default branch's `[40,60]`.
        `w=0` wins 65 of 82 clean cells and 40 wins none, but that is `baselineScoreOf` only - not
        the other Optimizer objectives, and not the liquidity cost of a plan left holding no cash,
        which the harness cannot see. Cash Reserve damps the whole question ~16x, so the people most
        exposed to a wrong default are the ones with no reserve. Changing it moves every existing
        Proportional, Reduce and GK plan silently. `gapFillWeights` stays a research input, unset.
      - **NOT shipped, measured right:** the bracket family's Cash-first (`bracketGapOrder` stays
        unset - `P30c` found the swap loses 21 of 23 clean cells).
      - **Follow-up filed, not started:** re-run the weight against every `OPTIMIZER_OBJECTIVES` key
        and against a liquidity measure before any default change. Until then the answer to "is 40
        right" is "no, and we are not changing it yet", which is a different thing from inert.
- [x] **P30h** - **DONE 2026-08-27, user question: is the blend a candidate for deletion, replaced by
      the shortfall cascade? ANSWER: NO, and the current default is not defensible either.**
      `.test_harnesses/gapfill_objectives_harness.js`, 540 sims, results in
      `GAPFILL_CASCADE_VS_BLEND.md`. Closes the two gaps `P30g` named.
      **Reframing that made it worth running:** `w=0` is not "Cash only" - `calculateWithdrawals`
      cascades the shortfall, so `[0,100]` drains Cash then draws Brokerage, which IS the bracket
      branch's sequence. Verified in the log, not argued. So the question was "should the blend
      exist", not "which weight".
      **The seven objectives split 3-3 AT THE ENDPOINTS.** `networth`, `balanced`, `maxroth` want
      w=0; `taxflex`, `mintax`, `widowrmd` want w=100; `maxspend` is genuinely inert (tied in all 31
      clean cells, which is also the construction guard). **`w=40` wins ZERO cells on every
      objective.** Every winner is a boundary - no interior weight wins more than one cell of
      anything - so this is not "40 is close to right", it is "there is no single right number".
      **Liquidity, the measure `P30g` could not build:** cash-zero years run 31.9% at w=0 against
      29.8% at the shipped w=40 and 19.9% at w=100. Monotone, real, and SMALL at the margin that
      matters - 2.1 points to go from 40 to 0.
      **Reserve damps 3.9x, not 16x - not a contradiction:** `P30b`'s 16x was the WIDEST cell, this
      is the MEAN. Direction and magnitude-class survive.
      **TWO SCORING DEFECTS FOUND MID-RUN, both of which flipped the recommendation.** (1) Ties were
      awarded to the first weight, so two objectives with $0 spread printed as landslides for w=0.
      (2) A shared $1 tie epsilon was applied to `taxflex`, which returns a FRACTION - making it
      mechanically tied whatever the data said. Fixed: ties counted separately, per-objective
      epsilon. **The first version of this would have recommended a default change on a tie-breaking
      artifact.** Third scoring-predicate defect in one session; see also `P83`'s P1 and `P30f`.
      **Open, not started:** `conveffect` and `breakeven` unscored - they read row fields the
      Optimizer computes around `simulate()`, and a reimplemented metric that disagrees with the
      product's is worse than an absent one.
      **The uncosted option:** make the weight follow the selected objective. The split is clean and
      the "Optimize for" selector already exists. Design work, not a sweep.
- **Status:** **PHASE COMPLETE, `P30a`-`P30h` (2026-08-24/25, `P30h` 2026-08-27), shipped through v11.163F.** What
  shipped is the Ordered menu; both `[40,60]`-family constants were measured and deliberately left
  alone, with the reasons recorded in `P30g` above so they are not re-derived. **Harness:** `.test_harnesses/gapfill_harness.js` (node — a
  new file, NOT an extension of `unifiedconv_harness.js`, which is already a four-round document with
  `CONVERSION_ROUTING.md` as its reference)
- **Depends on:** no code dependency. Its *ship* decision was downstream of P28's, which is now
  settled and shipped (v11.162B), so P30's research runs against a fixed baseline. The 🅡 rows are
  part of that baseline: a weight sweep must state which Roth position it holds fixed.

### P30i: CLOSING THE 40/60 PERMANENTLY  *(2026-08-31, user: "tell me how we put this one to bed")*

**The measurement is finished and it will never produce "the number." Stop sweeping it.**

### What `w` means, because every table below uses it  *(added 2026-08-31 after the notation confused a reader, which it should not have)*

`gapFillWeights` is a PAIR, `[Brokerage, Cash]`, and it is the split the default gap fill uses when
a year needs more than the strategy withdrew (`optimizer_core.js:2318`):

    yr.withdrawStrategy.order  = ['Brokerage', 'Cash'];
    yr.withdrawStrategy.weight = [40, 60];          // the shipped default

**`w` is a single percentage - Brokerage's share - and the pair is always `[w, 100 - w]`.** That is
how the harness sweeps it (`gapfill_harness.js:159`) and what its own legend says at `:209`:
"Weights are Brokerage's share; w=40 is today."

| shorthand | pair `[Brokerage, Cash]` | what the gap fill does |
|---|---|---|
| `w=0` | `[0, 100]` | take the gap **all from Cash**, spilling to Brokerage only once Cash runs out |
| `w=40` | `[40, 60]` | **today's default** - 40% of the gap from Brokerage, 60% from Cash |
| `w=100` | `[100, 0]` | take the gap **all from Brokerage**, spilling to Cash once Brokerage runs out |

**Neither endpoint is "that account only."** `calculateWithdrawals` cascades the shortfall, so
`[0,100]` drains Cash and THEN draws Brokerage - which is exactly the bracket family's own sequence.
That is what makes a 0-to-100 sweep a dial on one policy rather than a comparison of two, and it is
why `P30h` could say `w=0` is not "Cash only".

**Read `w` as the Cash share and every table below inverts.** It counts Brokerage.

Three independent studies asked which weight is right and all three came back with the same shape:

| study | result |
|---|---|
| `P30b` | `w=40` best in **0** of 82 clean cells; `w=0` best in 65 |
| `P30c` | the bracket branch's Cash-first is RIGHT - swapping loses 21 of 23 clean cells |
| `P30h` | across all seven objectives, `w=40` wins **zero** cells. Every winner is an ENDPOINT, and the objectives split **3-3**: `networth`/`balanced`/`maxroth` want `w=0`, `taxflex`/`mintax`/`widowrmd` want `w=100`, `maxspend` is inert |

**`w=40` is not a compromise between two good answers. It is a number that wins nothing, anywhere,
under any objective.** But `w=0` is not the fix either, because it is worse than today for the three
objectives that want `w=100`. A fourth sweep would re-derive exactly this. That is why the question
keeps coming back: **it is being asked as a measurement when it is a policy choice, and measurement
cannot answer it.**

**THE CLOSE: ship `gapFillWeights` as a real control and retire the constant.**

`P30a` already did the hard part - the input exists, is shape-validated, rejects `[0,0]`, and its
endpoints were verified monotone across 0/20/40/60/80/100. What is missing is a label. Three
positions, named for what they do rather than for a weight:

| control | pair | `w` | who it suits |
|---|---|---|---|
| Cash first | `[0,100]` | `w=0` | the bracket family's own rule, which `P30c` measured as right. Best for End Wealth / balanced / max-Roth |
| Blend (today) | `[40,60]` | `w=40` | preserved so **every saved plan and share URL reproduces**; no migration |
| Brokerage first | `[100,0]` | `w=100` | best for tax flexibility / minimum tax / widow RMD |

Why this ends it, where another sweep would not:
- **The complaint in this phase's own title is "the constants nobody chose."** A control means
  somebody chooses. The question stops being answerable-in-principle and becomes answered-per-plan.
- **The evidence becomes the tooltip.** `P30h`'s 3-3 objective split is exactly the guidance text.
- **Default unchanged means no behavior change**, no changelog warning, no re-baselined harnesses,
  and no silent movement of every Proportional / Reduce / GK plan - the thing `P30g` balked at.
- Blast radius is already known and small: three families. Bracket and Ordered are bit-identical at
  every weight across 270 guard runs.

**Remaining work is UI only:** a three-position control near Cycle Brokerage, a URL short-key, the
save/share field, the tooltip carrying the 3-3 split, and a test that each position round-trips. No
engine change - `P30a` shipped that.

**RULE, so this does not reopen.** `[40,60]` is not to be re-swept. Any future work here needs a NEW
QUESTION, not a new grid: the two genuinely unanswered ones are `conveffect` and `breakeven`, unscored
in `P30h` on purpose because reimplementing a metric the Optimizer already computes would be worse
than leaving it absent. **"Is 40 the best weight" is answered: no, and neither is any other single
number.** Cite this section instead of re-running.

**If even the UI is not wanted:** keep `[40,60]`, and the phase still closes - the honest statement
is then "an arbitrary constant on a small, reserve-damped effect, deliberately retained." What is NOT
acceptable is leaving it open as though a sweep might still settle it.

- [x] **P30i** - **CLOSED 2026-09-01 by `P102`, and it is neither of the two options below.**
      The question was reframed: the weight is not decided by the user (one more knob) and not
      decided by the objective (`P30h` §5.3) either, because a fixed per-objective map is wrong on
      **26 of the 84 cells `P30h` decides, 31%**, and for `mintax` it is wrong more often than right
      (7 right, 9 wrong of 16 decided). It becomes an entry in a declared search budget's priority
      queue - `P102e1` - with the three-position control as the LANDING PAD the row-click adopt path
      needs, exactly as `rothGapFill` shipped. **`[40,60]` is not to be re-swept**, unchanged.

---

### P30e: costing the decoupling  *(2026-08-25, design only)*

**Q5 asked: should picking a SPEND strategy keep picking a SOURCING policy, and what would it cost
to separate them? Answer: it should not, in principle, and it is not worth separating now.**

**The coupling is 9 reads, and only 6 of them are about sourcing.** `yr.isBracketStrategy` and
`yr.isOrderedStrategy` are each set once (`optimizer_core.js:1485-1486`). Classified:

| site | what it decides | sourcing? |
|---|---|---|
| `:1518` `targetSpend` | whether the strategy's own ceiling caps spend | **No - spend targeting.** Stays with the strategy under any design |
| `:1936` | may the Roth pre-draw run (`!ordered`) | yes |
| `:1954` | the bracket family's sequential Cash->Brokerage->Roth | yes |
| `:1994` | the Ordered branch | yes |
| `:2096` | third pass, Ordered branch | yes |
| `:2176` | P32c Brokerage re-draw excludes Ordered | yes |
| `:2239` | forced-IRA backstop excludes ACA **and** Ordered | **mixed.** Ordered's half is sourcing; ACA's half is about the income cap, i.e. eligibility |
| `:2476` | surplus banking follows the draw order | yes, though it is the INVERSE - where surplus goes, not where draws come from |

So a decoupling is not "move nine reads". It is: move six, split one, leave one alone. `:2239` is the
awkward one and `:2476` is the subtle one - any sourcing policy has to say where surplus is BANKED as
well as where draws come from, or the two halves disagree and money strands in an account the policy
will not reach.

**New input vs derived.** Three shapes:

1. **Derived with an override.** `sourcingPolicy` defaults to a pure function of `strategy` - today's
   mapping, written down - and an input may override it. Unset is bit-identical. Cheapest, and it
   makes the mapping visible, which is most of what Q5 was complaining about.
2. **Independent input.** Strategy selects spend targeting only; sourcing is always explicit. This
   still needs a per-strategy default, so it is shape 1 plus a mandatory UI surface, a URL param, a
   share/save field, a `sameStrategySelection` term and a sweep dimension.
3. **Do not decouple.** Expose the constants, not the structure.

**Row cost, measured not guessed** (shipped default scenario, from the current `OPT_GOLDEN` capture:
**30 base rows, 117 total**; Ordered is 3 of the 30, and is ineligible by definition because the
sequence IS its policy, leaving **27 eligible**):

| design | optimizer rows | MC variations |
|---|---|---|
| today | 117 | 144 |
| sourcing as a clone pass, 1 extra policy | 144 (+23%) | 177 (+23%) |
| sourcing as a clone pass, 2 extra policies | 171 (+46%) | 210 (+46%) |
| sourcing crossed with the existing clone passes | 234 / 351 (+100% / +200%) | worse |

The clone-pass shape is the affordable one; crossing is not. And MC pays `numPaths x variations`, so
+23% there is 23% of a Monte Carlo run, on a tab the user just asked to make faster.

**Recommendation: do not decouple, and close Q5 rather than leaving it open.** Three reasons, in
order:

1. **The measured defect does not need it.** `P30b` and `P30c` between them found ONE thing wrong -
   the default branch's 40% Brokerage - and the fix is a one-line default change, not a structure.
   Decoupling would be building a mechanism to solve a problem that turned out to be a number.
2. **The blast radius is small and asymmetric.** The weight reaches three families; the bracket
   order reaches four. A general sourcing policy would be a large, cross-cutting abstraction over
   two branches that measurement says want the SAME answer (Cash before Brokerage). Converging the
   two defaults gets most of the benefit for a fraction of the cost.
3. **Cash Reserve is the bigger lever anyway.** Three separate measurements now say so - it damped
   the weight by an order of magnitude and the bracket order by ~5x. A user who wants control over
   sourcing already has a stronger one than any of this.

**If it is ever revisited**, shape 1 is the one to build, and the two traps are recorded above:
`:2239` needs splitting rather than moving, and `:2476` means a policy has to define surplus banking
as well as draw order.

---

---

## P32: Brokerage is barely drawn — why, and is the third-pass exclusion still right?

**Why:** three observations converge on one place. (1) The user reports Brokerage draws not occurring
as expected. (2) The repo has already measured that this is load-bearing: every cell whose control arm
never touched Brokerage returns exactly $0 (`research/HARNESSES.md`, findings.md:1057-1062).
(3) **Gain harvesting already exists and most users never see it** — the cyclic modifier maxes out the
LTCG bracket *on purpose* even when spend does not need the money (`optimizer_core.js:1301-1303`, a
deliberate basis step-up), and its target-bracket knob `cycleLTCGTarget` (default 0.15 = target the 0%
bracket) is nerdknob-gated (`optimizer_ui.js:86`).

This phase is **both** halves of the framing question, because they are one investigation: "why so
little Brokerage" is a list of five draw sites and three exclusions, and "why isn't harvesting
selected" is whether cyclic ever wins. Splitting them would make each half read the same code.

**The three exclusions — design decisions to re-examine, not bugs:**
1. **The third pass excludes Brokerage deliberately** (`optimizer_core.js:1596-1600` — verified). The
   stated reason is a cap-gains spiral: more gains → higher SS taxation → bigger residual → repeat.
   The reasoning is sound and it is **unmeasured** — the comment asserts a spiral and cites no run.
   Falsifiable: with a Brokerage leg allowed and a bounded iteration count (the forced-IRA loop at
   `optimizer_core.js:1649-1672` already establishes the 4-iteration convergence pattern in this
   engine), does it actually diverge, and on how many scenarios? If it converges, this exclusion is
   costing the tool the exact lever P28 valued at up to $3.5M.
2. **The forced-IRA convergence loop never considers Brokerage** (`optimizer_core.js:1649-1672`) — it
   forces IRA *above the ceiling* while a Brokerage balance may sit untouched. The counterfactual is
   starker here: forced IRA is ordinary income at the marginal rate, a Brokerage draw may be LTCG at 0%.
3. **The Cash-Reserve breach** (`optimizer_core.js:1677-1688`, sets `yr.cashBreach`) fires before
   Brokerage is reconsidered.

**Two accounting facts to check BEFORE concluding anything about behavior:**
- Brokerage growth **excludes** the dividend rate (`optimizer_core.js:743`) while IRA and Roth include
  it (`:740-746`); dividends are then accrued separately on the **pre-withdrawal** balance
  (`optimizer_core.js:1152`, whose own comment at `:1150` calls it "APPROXIMATE worst case"). Brokerage's
  total return is assembled differently from every other account. A systematic understatement here
  would suppress Brokerage draws everywhere with no strategy logic being wrong.
- Basis is a **single aggregate scalar** with proportional consumption (`optimizer_core.js:165-182`):
  `basisChange = basis * (withdrawal/balance)`. No lot selection, so the tool cannot model HIFO or
  specific-ID — the single largest real-world lever on "raise cash without raising gains." That is a
  **modeling ceiling** bounding what this phase can honestly claim. Name it; do not build lots.

**Falsifiable questions:**
- **Q1.** In the shipped sweep, what fraction of rows ever draw Brokerage, by family? Predict from the
  five draw sites first, then measure, then score the prediction.
- **Q2.** Does allowing Brokerage in the third pass diverge, converge, or improve? Three arms: off /
  bounded / unbounded-with-a-counter — the last exists to prove the spiral is real or is not.
- **Q3.** Does cyclic ever *win* the sweep? It is already a x2 dimension (132 of ~177 rows), so this is
  a scan of existing results, not a new run. If it never wins, that is the answer to "why isn't
  harvesting used."
- **Q4.** Is `cycleLTCGTarget` correctly defaulted and correctly gated? If the 0.20 arm (target 15%)
  ever wins materially, a nerdknob is hiding a real lever.
- **Q5.** Does "max the bracket out anyway" (`optimizer_core.js:1301-1303`) pay? It costs nothing at 0%
  LTCG but raises MAGI, which feeds IRMAA and SS taxation. A/B against a spend-only harvest.

**Already ruled out — do not re-derive:**
- Brokerage share as a ranking heuristic (findings.md:962-966), non-monotone. Do not build "draw
  Brokerage when share > X."
- The zero-test "no Brokerage draw, no lever" is established and is a *prune*, not a ranking. Reuse it;
  do not re-measure it.
- Whether Roth belongs before Cash — P28.

**Tasks:**
- [x] **P32a** — Q1 scan FIRST — it may reframe everything that follows. **DONE, and it did.** 5 scenarios x 11
  arms, 55 rows, **zero rows never draw Brokerage**; baseline 90.4% of years from year 0, bracket
  61.1%, cyclic 57.5%, ordered 44.7%. Prediction P3 scored WRONG (BIRC draws Brokerage first and so
  has none left later). **"Brokerage is barely drawn" is false as a general claim.**
- [x] **P32b** — Audit the two accounting facts before running any behavior arm. **DONE, and it paid for the
  whole phase.** Not an understatement, an **over**-credit: `yr.taxableDividends` counted as income
  *and* credited to the balance with nothing debiting it back. Fixed in `e9a3c8b` (v11.146f).
- [x] **P32c** — Research inputs, default off, P28 pattern. **DONE.** First half 2026-08-10:
  `cycleHarvestMode` ('maxbracket'|'spendonly') and `cycleCoexist` ('off'|'bracketfill') in the
  `:1432` branch. Second half **2026-08-17 (v11.1582, UNCOMMITTED)**: `thirdPassBrokerage`
  ('off'|'bounded'|'unbounded') in the third pass and `forcedIRAAllowBrokerage`
  ('off'|'brokerageFirst') in the funding backstop, both in `resolveResidualAndForcedIRA`.
  A third value, `'unbounded'`, was added beyond the two the task named because Q2 asks for an
  unbounded-with-a-counter arm and P32d would otherwise have to add it itself.
  6 new tests, suite 263 -> **269/269**, browser badge green at 570 (245 in-page + 325 node).
- [x] **P32d** - Q2 with an explicit iteration counter, so "spiral" becomes a measured claim either
  way. **COMPLETE 2026-08-21** (d-1/d-2/d-3/d-5 done, d-4 moot). Full numbers in findings.md
  2026-08-21. Headline: **zero capped years in 3,960 armed runs - the spiral the exclusion comment
  asserts does not exist on this grid** - and the two arms point OPPOSITE ways, which the 8-scenario
  preliminary could not have shown.
  - [x] **P32d-1 - repair the dead `q2()`. DONE.** It probed `tpBrokIters` and the engine ships
        `thirdPassBrokerIters` / `thirdPassBrokerCapped` / `thirdPassBrokerStalled`
        (`optimizer_core.js:2138-2140`), so it printed SKIPPED on every run from v11.1582 to
        2026-08-21 and the question sat inert while looking answered. Also fixed the arm table's
        `forcedIRAAllowBrokerage: true` -> `'brokerageFirst'`. The probe now names the shipped
        counters and its failure message says to check BOTH causes, not just the flags.
  - [x] **P32d-2 - capped and stalled in separate columns. DONE.** Never summed anywhere. Iters
        printed as total and max, not mean. **Read `max iters` as a RUN TOTAL** (it sums across the
        plan's years), not a per-year depth - the bounded/unbounded identity is what proves no
        single year exceeded 6. Added a per-arm funded-year better/WORSE table, which is what
        separated the two arms.
  - [x] **P32d-3 - widen the grid. DONE.** basis 0.2/0.5/0.8 x state CA/NY/TX x dividendRate
        0/0.02 x 5 scenarios x 11 strategy arms x 5 Q2 arms = **4,950 runs**, ~0.7ms each. Kept on
        `q2()`'s own `SCENARIOS x ARMS` grid rather than `s1Cells()`, which re-enumerates every
        strategy family per cell and would have made this combinatorial. Ordered arms are reported
        **inert by design**, not zero, and a check confirms 0 ordered rows moved.
  - [x] **P32d-4 - MOOT, not skipped.** The cap-artifact worry was that a `bounded` year consuming
        all 6 draws is counted Capped without a final convergence test. There are **zero capped
        years at all**, and `bounded` is identical to `unbounded` on every counter across the whole
        grid - so no year ever wanted a 7th pass and there is nothing to re-check. If a future grid
        ever produces a capped year, the re-check is still the right move and the reasoning is in
        findings.md.
  - [x] **P32d-5 - written up. DONE 2026-08-21.** New Q2 section in
        `research/BROKERAGE_DRAW.md` (title, run header, predictions table, Coverage and Scope
        Limits all updated); `research/HARNESSES.md` now records that q2 printed SKIPPED for
        months and why. **P5 RIGHT**, **P6 RIGHT** - P6 named the third-pass arm, so it is scored
        per arm instead of on the pooled total, which had let `brokFirst` print "MIXED" for an arm
        P6 never mentioned. Arm labels renamed at the user's request: `fib` -> `brokFirst`,
        `bnd+fib` -> `bnd+brokFirst`.
  - **Q2's answer, in one line:** there is no spiral, and `brokFirst`'s 9 winning cells are
    **set-identical** to `bounded`'s 9, so the third-pass arm strictly dominates it on funded years.
  - **Do NOT re-run Q1.** `P32e` already re-measured it post-dividend-fix ("three families UP,
    cyclic -0.8pt, never-draw still 0/55").
- [x] **P32e** — Q3/Q4 DONE 2026-08-10 (`research/BROKERAGE_DRAW.md`). Q3: cyclic wins 26/45
  cells as shipped but HALF is the surplus-routing confound — a `CashReserve: 0` control still wins
  23/45 at half the magnitude ($891k max). Q4 INVERTED: `cycleLTCGTarget 0.20` moves 898/2,576
  pairs and wins 53 — the nerdknob gate is protecting users, not hiding a lever; 0.15 confirmed.
  Q1 re-run post-fix: three families UP, cyclic −0.8pt, never-draw still 0/55.
- [x] **P32f** — Q5 DONE 2026-08-10 (q5, `BROKERAGE_DRAW.md`). **INVERTED**: maxbracket wins only
  108/2,514 pairs (4%); spendonly gains to +$396k. Post-§1014 (v11.1499) a held-to-death harvest
  has no terminal payoff, only MAGI costs — the top-off is a pre-step-up design.
- [x] **P32g** - **DONE 2026-08-21.** New item in README "Limitations and Restrictions", after the
  §1014 step-up item: cost basis is one aggregate number consumed proportionally
  (`calculateBrokerageWithdrawal`, `optimizer_core.js:304-321` - verified, not cited from the old
  note, whose line numbers had rotted), so the tool cannot model specific-ID or HIFO lot selection.
  States the direction as the README's other limitations do: for anyone who does select lots the
  tool **overstates** the capital-gains tax on a Brokerage withdrawal and therefore **understates**
  both the spendable income it produces and the terminal wealth of a Brokerage-leaning plan, so such
  a household should read the tool as too **pessimistic** about Brokerage draws. Also names the
  consequence for lot-level tax-loss harvesting, which is absent for the same reason.
- [x] **P32h** - **COMPLETE 2026-08-21. Four calls settled by evidence, the fifth shipped at
  v11.15e3 on the user's go-ahead.** All five were being carried as a single
  undifferentiated "decision", which is how the two Brokerage arms nearly got treated as one thing.

  1. **`forcedIRAAllowBrokerage` (`brokFirst`): DO NOT SHIP. Settled.** It is **dominated**, not
     merely riskier. Its 9 winning cells are set-identical to the third-pass arm's, and it buys them
     at **$27,860,186** of newly unfunded spending against that arm's **$1,711**. There is no
     household this helps that the third-pass arm does not already help. Keep the input as a
     research flag, default off, so the measurement stays reproducible; add no UI.
  2. **`cycleLTCGTarget`: keep the nerdknob gate, keep the 0.15 default. Settled by Q4.** The 0.20
     arm moves 898 of 2,576 pairs and wins 53 of them; the gate is protecting users, not hiding a
     lever. Verdict strengthens at low basis (worst loss -$540k at 20% basis).
  3. **`cycleCoexist`: stays research-only. Settled by Q6.** Median NEGATIVE (-0.73%); the harvest
     skip is accidentally protective for aggressive ceilings (Fill Bracket 35% -$2.1M) while
     measured arms genuinely gain (IRA Draw 5-8%, up to +$808k). Shipping needs arm-aware gating,
     which is its own phase, not a line in this one.
  4. **`cycleHarvestMode` default flip to `spendonly`: NOT folded in here.** Q5 says the maxbracket
     top-off wins only 108 of 2,514 pairs post-§1014, so the default looks wrong - but flipping it
     is a behavior change on a different code path from anything Q2 touched, and bundling it would
     make one ship decision unfalsifiable against another. Give it its own item when someone picks
     it up.
  5. **`thirdPassBrokerage`: RE-SCOPE THE EXCLUSION. Recommended, but USER CALL** - it changes
     default behavior for every existing scenario and shared link.

  **The case for (5).** The exclusion's stated reason is a cap-gains spiral, and Q2 measured **zero
  capped years in 3,960 armed runs**, with `bounded` identical to `unbounded` everywhere - so no
  year ever wanted a 7th pass. What the arm buys: **$372,455** of previously unpayable spending
  funded, for **$1,711** of new unfunded (385 runs at about $4 each, rounding dust). 218:1. Every
  one of the 9 winners is a `minlimit` row, which is the defect this phase opened with: the pinned
  fixture stranding $71,382 across nine consecutive years with Brokerage untouched and every other
  account at zero. On the sharpest cell it takes failed years from **10 to 1** and unfunded dollars
  from **$68,792 to $6**.

  **The cost, stated plainly.** Terminal wealth falls (-$103,847 on that cell) because the money is
  spent instead of left to heirs. Anyone ranking on final net worth sees a loss; anyone ranking on
  "does my plan actually pay for my retirement" sees a large win. That is the whole trade, and it is
  a much smaller ambiguity than the first write-up of this result claimed (see the CORRECTION in
  findings.md - the shortfall sign was read backwards).

  **What shipping it costs, so the estimate is not a surprise:** it is a default behavior change, so
  every saved scenario and shared link on a `minlimit` plan moves. Needs `bounded` promoted from
  research flag to default (`'off'` -> `'bounded'`), the `optimizer_core.js:2044` comment rewritten
  to record that the spiral was measured and refuted rather than deleted silently, new pinned tests
  including the stranding fixture, `TestTiers.EXPECTED` reconciled in the same commit along with
  `.githooks/README.md`, a version bump in all four sites, and a changelog entry. `unbounded` and
  `brokFirst` stay research-only either way.

  - [x] **P32h-1** - **USER SAID SHIP, 2026-08-21.**
  - [x] **P32h-2** - **SHIPPED at v11.15e3.** `_tpBrokArm` default `'off'` -> `'bounded'`; the
        exclusion comment rewritten to record that the spiral was measured and refuted (kept as
        HISTORY rather than deleted, so nobody re-derives it); the `forcedIRAAllowBrokerage` comment
        now records that it was measured and rejected, with the $27,860,186-vs-$1,711 figure in the
        code itself. Five tests moved, all of them by design and none re-pinned lazily:
        - The old **tripwire flipped into a regression guard**. `P32 (not fixed here): minlimit
          strands spending...` asserted the defect was present with the count 10; it now asserts
          **0**, keeps the full five-attempt history verbatim, and adds a `thirdPassBrokerage: 'off'`
          control that must still reproduce all 10 stranded years with the same pinned amounts.
          Without that control a future refactor could zero the count for an unrelated reason and
          still pass. It also now asserts the PRICE: funded years up, spend up, **finalNW down**, so
          the change can never be read as free.
        - `absent = off` became `absent = bounded`, with explicit `off` still pinned as reachable,
          and the absent-equals-off contract kept for `forcedIRAAllowBrokerage`, which did not ship.
        - The `bounded draws Brokerage` test inverted its control to explicit `'off'`.
        - `brokerageFirst spends Brokerage before forcing IRA` now pins `thirdPassBrokerage: 'off'`.
          It had started failing 131,780 -> 131,780, which looked like a regression and was really an
          OVERLAP: the shipped third pass already spends the Brokerage that arm wanted. Isolating it
          measures the backstop alone, which is all the test was ever about.
        - `P38` forced-IRA total 20,381 -> 18,719, because the third pass now funds from Brokerage
          part of what used to be forced out of the IRA. Down is the intended direction.
        **Counts did not move** (280 / 61 / 22, `slowInCore` 3), so `TestTiers.EXPECTED` and
        `.githooks/README.md` needed no edit - checked rather than assumed. Version bumped at the
        three sites this release touches (title, `optimizer_core.js?v=`, the tier-2 loader's own
        `const V`); `taxengine.js`, `optimizer_ui.js` and the CSS were deliberately left alone since
        none of them changed.
        **The page's own test caught a defect in my changelog entry**: I wrote
        `<b>Behavior change:</b>`, and a tier-1 test asserts every changelog `<b>` is a version stamp
        in its own `<li>`. Badge went red at 610/611. Changed to `<strong>`; that is exactly what
        the test exists for. Browser verified after the fix: tier-1 **248/0**, core 280, TPP 61,
        doclinks 22, slow 3, **Documentation 🟢**, console clean apart from the usual unrelated
        Cloudflare RUM CORS error.
  - [x] **P32h-3** - decisions (1)-(4) recorded above. No code, deliberately: three of them are
        "keep what ships" and the fourth is explicitly deferred to its own item.

- [x] **P32i** — Q6 DONE 2026-08-10 (q6, `BROKERAGE_DRAW.md`). Median NEGATIVE (−0.73%): the harvest
  skip was accidentally protective for aggressive ceilings (Fill Bracket 35% −$2.1M) while measured
  arms genuinely gain (IRA Draw 5-8% up to +$808k). The money-on-the-table is real but reclaiming
  it blindly loses; shipping would need arm-aware gating (axis-property + pinned-test bar applies).
- [x] **P32j** - **the one deferred item, filed 2026-08-27, UNPRIORITIZED.** `P32h` decision (4):
      flip the `cycleHarvestMode` DEFAULT from `maxbracket` to `spendonly`. Q5 measured maxbracket
      winning **108 of 2,514 pairs (4%)** post-§1014, with spendonly gaining to **+$396k**, because a
      held-to-death harvest has no terminal payoff once the step-up lands - only MAGI costs through
      IRMAA and SS taxation. The top-off is a pre-§1014 design that outlived its reason.
      `P32h` deliberately did NOT fold this in: it is a behavior change on a different code path
      from anything Q2 touched, and bundling it would make one ship decision unfalsifiable against
      another. It carries the same shipping cost `P32h-2` paid - a default change moves every saved
      scenario and shared link on a cyclic plan, so it needs pinned tests, `TestTiers.EXPECTED` and
      `.githooks/README.md` reconciled in the same commit, four version sites, and a changelog entry.
      **Re-baseline first.** Q5 is 2026-08-10 numbers and the engine has moved twice since
      (v11.15e3 third pass, P30 ordering). P28 and P30 both found their tables stopped reproducing.
- **Status:** **PHASE COMPLETE.** `P32a`-`P32i` all done; Q1-Q6 all answered; the build and decision
  tail shipped at **v11.15e3, PR #185**. Merged: PR #155 (third-pass state tax), PR #156 (brokerage
  research + the dividend over-credit fix), PR #185 (the third-pass re-scope). The only thing carried
  forward is `P32j` above, which `P32h` deferred on purpose rather than left undone.
  **Harness:** `.test_harnesses/brokerage_harness.js` (node), results in `research/BROKERAGE_DRAW.md`
- **Depends on:** shares the gap-fill path with P30. Sequencing preference, not a hard dependency: run
  P30 first so the `[40,60]` question is settled before the third-pass arms move the same numbers.

---

---

## P67 — "Optimize for" drives the columns, plus a relative (delta) view

The results table rendered **all 21 columns to everyone under every goal**, so the columns that
answered your question sat off the right edge next to eighteen that did not. Three of the nine goals
also ranked on a number the table never showed: `maxroth` on `terminal.roth`, `widowrmd` partly on
`terminal.ira`, `taxflex` (the default) on a bucket spread that lived only inside its own ranker.

### P67a — objective-driven column sets. **DONE, v11.15fa**, 6 commits, unmerged

- [x] **P67a-1** `169ae2c` — de-hazard the column array. Four traps, each live the moment any column
      became optional: the Rank `splice(findIndex(...) + 1)` that lands at index 0 when findIndex
      misses; the Best table's `columns.slice(1)` + `i === 0 ? 'Best'` index assumption; the sort
      tiebreakers read from the *filtered* array; and a vanished sort column leaving `col` undefined,
      which rendered rows in **build order under a header with no arrow**, silently. New pure
      `normalizeSortState()` at the one render choke point. Rank moved after Param.
- [x] **P67a-2** `04da630` — the data. `afterTaxBucketSpread()` **extracted** from the taxflex ranker
      and exported (not copied, so column and ranking cannot drift); `finalIRA` / `finalRoth` /
      `mixSpread` descriptors; `rowDetailTip()` hooked into `cellActionAttrs` (not `rowTitle`, which
      misses both pinned rows and the compare-zone cells). Renames: NetWealth → **FinalWealth**,
      Tax Paid Δ → **Conversion Tax Saved**.
- [x] **P67a-3** `45dd6ee` — the filter, the escape hatch, the legend fold, all copy, all tests.

**Kept, and worth not re-litigating:**
- `OPT_OBJECTIVE_COLUMNS` lives in `optimizer_core.js`, not the UI file: `optimizer_ui.js` has no
  `module.exports` and no `window.*` block, and no node suite loads it, so data placed there is
  unassertable outside a browser. The keys↔descriptors pairing is pinned by the ONE tier-1 test that
  can see both files.
- **Every goal shows the column its own ranking metric reads.** Enforced by a node test against
  `OPT_OBJECTIVE_METRIC_COLUMN`, not by convention.
- `dNW`/`dTax` are in no goal's set; they appear only when a ⚖ row is pinned.
- A winner whose column the goal hid is not shown as a winner (the legend promises a highlighted
  cell explains the green row, and there would be no cell). `colWinners` stays complete.

**Defect found while verifying, now guarded:** Chrome fires `toggle` when it **parses** a
`<details open>`, before any init runs. Both legend strips carry `open`, so two toggles landed first,
the inline handler wrote "both open" to storage, and `restoreFoldState()` read back the value it had
just clobbered. Nothing persists until the stored preference has been read (`_foldsRestored`).

- [x] **P67a-4** `bd75a56` — seven review cleanups. Duplicate "Your plan" symbol removed. Row
      colours, symbols and the compare hint merged into ONE fold (the compare BANNER stays outside:
      it reports live state, not explanation). **The table adopted the summary bar's names** - End
      Wealth, All Taxes, All RMDs, Spendable - which REVERTS the FinalWealth rename from `45dd6ee`.
      "Infeasible" and "target unreachable" were proven to be one condition (`optimizer_ui.js`
      renders ⚠️ on exactly the flag that drives the row colour and the filter) and are now
      **unreachable target** everywhere. ✦ rows lost their shading so blue means one thing.
      `Conversion Tax Saved` → **`Conv Tax`**, with Break Even ahead of it. Only Best keeps a colour
      legend line. One ⚖, on the reference row only, which now wears the baseline blue; the empty
      cells stay the click target, with a `(hover: hover)` CSS reveal.
- [x] **P67a-5** `1eef3b2` — the 💵 legend entry, deleted by a-4's own merge script (it kept only
      spans opening `<span title=`; that one opens `<span id=` because `optimizer_ui.js:116` toggles
      it by id), restored. ⚠️ and 🚨 dropped from the symbol list: both already have a permanent
      chip carrying a live count and a click-to-toggle. 🟢 kept, having no chip.

**GOTCHA worth more than the feature: a goal's column list does NOT set display order.** The filter
preserves `OPT_COLUMN_KEYS`, so moving Break Even ahead of Conv Tax meant editing the canonical array
AND the descriptor literal. Editing `OPT_OBJECTIVE_COLUMNS` alone changes nothing visible.

**Second GOTCHA: `sed -i` on Git Bash rewrites a CRLF file as LF.** It flattened
`retirement_optimizer.html` and `.githooks/README.md`. Git normalises on commit so the blob is fine,
but `.gitattributes` pins `.githooks/**` to `eol=lf` and a CR in a shebang breaks the hook, so the
"restore CRLF everywhere" reflex is wrong for that one path. Use Python with `newline=''`.

### P67b — the relative (delta) view, nerdknob-gated. **DONE, v11.15fd** (`a98c94a`), refined through v11.1601

Every numeric column reads as a signed difference from a reference row; the reference row shows the
absolute the rest are measured against. User's words: "the pin column shows the number, all other
columns show the delta", so `ΔFinalWealth`/`ΔTax` stop existing as separate columns.

- [x] **P67b-1** reference = ⚖ pinned row, falling back to the ⚓ baseline (the existing
      `deltaReferenceRow()` rule), so the mode always has a reference
- [x] **P67b-2** format: signed, same units, colored better/worse **per column** (a negative on
      Lifetime Tax is green). Percent columns in percentage points, Break Even in years
- [x] **P67b-3** wrap `col.getValue` at the body-cell emit, NOT 21 edited descriptors. Sorting keeps
      using `getSortValue` on absolutes, so order is identical in both modes
- [x] **P67b-4** `Conversion Tax Saved` stays absolute (`absolute: true`): it is not measured against
      the reference row but against the same row's own conversion search
- [x] **P67b-5** drop `dNW`/`dTax` while the mode is on; nerdknob gate + "Show relative view" control
- [x] **P67b-6** open question: what a delta cell shows where the row has no value. Today `'—'`;
      the delta renderer must not turn that into `+0`
- **Status:** DONE. Built as a wrapper over `getSortValue` at the body-cell emit, not 21 edited
  descriptors, so the Future $ / Current $ handling comes free and a column's display cannot drift
  from its delta. Row order is provably identical in both modes (sorting still uses the absolutes;
  a difference from a common reference is monotonic in it) and that was VERIFIED, not argued.
- **Five review rounds followed (v11.15fe → v11.1601), all shipped.** Switches instead of text links;
  the Δ columns dropped in relative view on BOTH paths (showing all columns had brought them back);
  both PINNED rows routed through the delta wrapper (they were built by their own code paths and
  stayed absolute); percent deltas lost the "pp" suffix; the reference row moves to a converting row
  under the two conversion goals (`OPT_BASELINE_REQUIRES`); Conv Tax colored by sign with no `$`;
  the ⏹ stop-year mark explained; Version column dropped from the scenario list; `?tab=` added;
  **End Wealth and All Taxes pinned for every goal**; US spelling normalized.
- **GOTCHA retired:** display order now comes from `OPT_COLUMN_KEYS`, not from the order the
  descriptors are written in. That coupling caused two separate incidents - a reorder that did
  nothing visible, and a scripted block move that relocated a descriptor into an unrelated Chart.js
  helper. Reordering is now a one-line edit in core.
- **Still NOT verified live:** the Roth Conversion Effectiveness half of `OPT_BASELINE_REQUIRES`.
  Neither the default scenario nor the user's own URL produced ⇌ rows, so only the fallback ran.
  Covered by a node test, not by a browser check.
- **Open call for later:** under the two conversion goals the ⚓ baseline never converts, so it has
  no break-even year and the whole Break Even column reads as dashes until a ⚖ row is pinned.
  Correct - there is no difference to state - but it makes the mode much less useful there.


---

---

## P41: Pension Start Age  *(was PA)*
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

**Five of the seven items shipped in v11.10ee and were never checked off here.** Audited against
the code 2026-08-07; the two that remain are real, not bookkeeping.

- [x] **P41a** — `#pensionStartAge` input. **DONE v11.10ee**, `retirement_optimizer.html:339`
      (number, `value="0"`, `placeholder="ret."`)
- [x] **P41b** — `getInputs()` reads it. **DONE v11.10ee**, `optimizer_ui.js:350`. Shipped as
      `+val('pensionStartAge') || 0`, not the `|| inputs.startAge` written above: 0 means "no gate",
      which reaches the same behaviour by a different route since `age1 >= 0` is always true
- [x] **P41c** — engine age gate. **DONE v11.10ee**, `optimizer_core.js:1154`
- [x] **P41d** — `computeSuggestedSpend()` gate. **DONE v11.14bf.** The three unconditional
      pension counts (`gross` `:4716`, `earnedIncome` `:4727`, `pensionIncome` `:4728`) now read one
      `pension` local gated by a shared helper `DisplayHelpers.pensionAtAge(amount, startAge, age)`
      (in `displayhelpers.js`), evaluated at `retireAge`. `startAge` 0/blank = no gate, so existing
      plans are byte-identical; a pension deferred past retirement is now excluded. Browser-verified:
      start age 75 vs retirement 65 drops suggested gross from $168k to $153k (the $15k pension),
      after-tax falls in step. The engine (`optimizer_core.js:1154`) stays inline and self-contained,
      as designed
- [x] **P41e** — URL alias `psa`. **DONE v11.10ee**, `optimizer_ui.js:3777`
- [x] **P41f** — survivor logic needs no change. **CONFIRMED**, still true
- [x] **P41g** — tests added. **DONE v11.14bf**, both in `optimizer_core.tests.js` (after the PA
      test at `:1622`): (1) a `pensionAtAge` helper unit test (below/at/after start age, `startAge`
      0/blank = no gate, blank amount = 0); (2) `test.critical` engine test that runs `simulate()`
      with a pension deferred to age 80 and asserts `yr.pension === 0` before the start age, `> 0`
      after — this closes the exact gap the audit named: reverting `optimizer_core.js:1154` now fails
      that guard (proven: temporarily ungated → 1 critical guard failed, restored → 224/224).
      Suite count 222 → 224; `optimizer_tests.js` `EXPECTED.optimizer_core` bumped to 224
- **Status:** DONE, 7 of 7. Shipped in v11.14bf, separate from the P35g basis-step-up PR as planned.
  node 224/224 (11/11 critical guards); browser-verified on the served page
- **Independent:** no phase dependencies

---

---

## P49: Horizon-aware suggested spend  *(SHIPPED v11.14c6, 2026-08-09)*
**Why:** the suggested After-Tax Spend was a flat 5% of every account plus SS+pension, taxed once,
with **no regard for plan length**. That contradicts the whole withdrawal-rate literature (Bengen,
Trinity): the safe starting rate is chiefly a function of horizon. The tool already models the
horizon (death-driven, `= r.log.length`), so a horizon-blind suggestion was leaving its own best
input on the floor. Sibling to [[P30]] — same "constants nobody chose" theme, different constant
(the `0.05` in the UI vs the engine's gap-fill order).

**User decisions (2026-08-09):** built Option B (PMT over the invested portfolio) as the *seed*, with
the haircut found by **live per-plan engine search** (not a baked constant), success defined as the
last modeled year holding **≥ `SUGGEST_BUFFER_YEARS` (3, embedded)** years of **portfolio-funded
need** (`spend − guaranteedIncome`), against the **deterministic** path (SoRR stays on Monte Carlo).

- [x] **P49a** — `suggestSustainableSpend(baseInputs, opts)` in `optimizer_core.js` (before
      `optimizeSpend`). PMT seed via the existing `calculateAmortizedWithdrawal` over invested =
      IRA+Roth+Brokerage (Cash excluded as a buffer); coarse scan (`SUGGEST_SCAN_STEPS`, never breaks
      early — same non-unimodal hazard `bestConversionStopYear` documents) then bisect on the existing
      `SPEND_SEARCH_TOLERANCE`. Predicate = `totals.success && last.portfolioBalance ≥ K·need`, i.e.
      `optimizeSpend`'s 1-year terminal test generalized to K years. Returns `{spend, horizon,
      naivePMT, haircut}`. Exported in both lists.
- [x] **P49b** — UI rewire in `optimizer_ui.js`: deleted the flat-5% `computeSuggestedSpend`; added
      `refreshSuggestedSpend()` (caches the solve) called once per recalc from `runSimulation()`;
      `updateSuggestSpendTooltip`/`applySuggestSpend` now read the cache. The solve is
      spendGoal-independent, so the per-keystroke path stays cheap. Tooltip surfaces the horizon and
      the haircut and names the deterministic-path caveat.
- [x] **P49c** — 3 tests in `optimizer_core.tests.js` (boundary: its spend passes, +15% fails;
      buffer monotone; horizon monotone — shorter horizon suggests more). Count 224 → 227;
      `optimizer_tests.js` `EXPECTED.optimizer_core` bumped.
- **Verified:** node 227/227; browser default scenario suggests $146,475 over a 25-yr horizon (71% of
  the naive amortization), apply/restore toggle works, badge green. Horizon monotone in eyeball runs
  (9yr→$67k, 17yr→$41k, 27yr→$27k); SS now gated by the engine, so the old SS-not-gated asymmetry in
  the snapshot is gone.
- **Deferred / notes:** `DisplayHelpers.pensionAtAge` (shipped [[P41]] for the old snapshot) is now
  unused by production but retained as a tested pure utility — the engine is the live gate.
  `gkSpendStable` is NOT in the predicate (kept strategy-agnostic); revisit if a GK suggestion looks
  too high. MC-percentile calibration (SoRR-aware) is the future upgrade if the deterministic buffer
  proves too optimistic.
- **Independent:** no phase dependencies.

---

---

## P57: Tax Payment Planner - stop describing one plan while recommending another, and stop implying free money  *(NEW 2026-08-18, user-approved, all four groups, follows P56)*

**Scope:** `taxPaymentPlanner.js` + `RetirementTaxPlanner.html`. No Optimizer engine change.

Two adversarially-verified audits (29 agents / 12 confirmed, and 19 agents / 10 confirmed) off two
user reports. The unifying defect: P56 gave the page five plans but left several surfaces still
describing the PARENT computation, which is Plan A, and left several statements that imply a cost of
zero where the real cost is simply unmodelled.

### Group 1 - copy that misstates a consequence (the two user reports)

- [x] **P57a** - The comparison footnote said voluntary draws "are not free to move". The engine moves
  every one of them to December in B, C, D and Q, and prices the move at zero. **Measured**: plan A
  hands the household $63,000 net in February; plan C, starred as the winner, hands the same $63,000
  in **December**. Replace the reasoning: the planner does not know when spending happens, so a
  December draw either funds next year or assumes another source until it lands. Both renderers.
- [x] **P57b** - Per-plan line naming that plan's own December net cash, so the consequence is a
  number rather than a caution.
- [x] **P57c** - Brokerage footnote prices $3,826 of capital gains tax and never says it is OUTSIDE
  the liability the five plans are sized against. `paid` = the entered tax exactly, on all five plans;
  the string "4956" appears once in the whole result object, in `comparison.brokerage`. The engine
  already holds the principle internally at line ~940 ("must never add a supplemental draw, because
  that would create taxable income the pre-calculated tax inputs do not include").
- [x] **P57d** - New `CONCEPT_NOTES` entry, tag `Tax figures are inputs`, cited from P57c and from the
  shortfall estimates. Safe-harbor nuance included: extra tax is a balance due in April, and carries
  an underpayment charge only where the prior-year safe harbor is not the binding test.
- [x] **P57e** - Rewrite the "Note on income variation": it calls selling-brokerage side effects
  "typically small second-order effects", which contradicts a $4,957 line item on the same page.
- [x] **P57f** - Relabel the "RMD deferral given up" row. **Measured confound**: A and D take the RMD
  in the SAME month and the row reads $276 vs $350, because its basis is net of withholding while its
  label names timing. No double count (withheld dollars sit in `withholdOC`), so this is a label fix.
- [x] **P57g** - The December-draw step note claims "maximises IRA tax-deferred growth" with no
  mention of what the household lives on, and contradicts the footnote 780 lines below it.
- [x] **P57h** - Shortfall estimates say "from cash or HYSA" with no funding-source disclosure at all.

### Group 2 - surfaces still describing Plan A

- [x] **P57i** - Strip the plan-specific values from both headers (Strategy, IRA Coverage, per-IRA
  draw/conversion months, Effective withhold, the `yeIraWins` banner). Keep tax year, state and its
  exemption flags, the three tax figures, and Winner + first-year cost. **Chosen over re-pointing at
  the winner**, because re-pointing relocates wrong values: `planARmdMonth` reads the same in all five
  plans in the divergent case, `plans.D.summary.ira1.rmdMonth` says September on a December-only plan,
  `bestSet` can hold two plans with different strategies, and `comparison` is null when only one plan
  exists - which is exactly where the banner's second defect lives.
- [x] **P57j** - The winner line and the First-year cost badge drop the sign: **measured** "first-year
  cost $15,394" twelve lines above the table's own "-$15,394 star". `fmt$` is `Math.abs` by design, so
  the two quoting sites need the sign the TOTAL row already applies.
- [x] **P57k** - "YE-IRA withholding is retroactive, NO penalty applies" is gated on Plan A's strategy
  and prints above the winner's own PAST DUE actions. Fired in 4,200 of 11,880 swept scenarios, and in
  51% of those the winner really did carry past-due installments. Gate on the winner and on
  `fedTimelyByWithholding` / `stateTimelyByWithholding`, which are closure locals and must be surfaced.
- [x] **P57l** - The Tax Coverage Summary is Plan A's (`r.summary === r.plans.A.summary` is literally
  true) and is read as a pay checklist. **Measured**: it shows conversion $7,000 / quarterly $0 while
  the winner shows conversion $0 / quarterly $7,000 across **seven** estimate payments a reader would
  skip. Render it per plan.
- [x] **P57m** - Labels B and D are built from Plan A's months, and B hard-codes "December" for draws
  and withholding while measured doing $19,000 of withholding on January 4. Read each label off that
  plan's own actions.
- [x] **P57n** - **Plan D can keep no early draw at all** and still be offered as "Split". Measured:
  draws $20,000 against $57,000 of tax, D's whole list is one December tranche, label says "spending
  draws in January", the tranche note says "held back from the early distribution", cost identical to
  C at $1,563, same nine actions. P56c guarded the empty end (`dDegenerate`) and never guarded the
  full end.

### Group 3 - the second model nobody labelled

- [x] **P57o** - `RetirementTaxPlanner.html:773-813` is an independent model of the same decision that
  never calls `computePaymentPlan`, is bound only to input events so it is never re-run after Compute,
  and sits on screen contradicting the results. Its verdict disagreed with the priced table in
  **1,231 of 7,128** swept scenarios; its coverage percentage counts draws only and ignores conversion
  withholding capacity; its OC factor reads `new Date()` and never consults `p.taxYear`, so it showed
  58.3% where no plan's factor was (A 125%, the rest 33.3%). Related: `yeIraWins` no longer affects
  plan selection at all - all three branches at ~1096 resolve identically - so a dead heuristic drives
  only display.

### Group 4 - pre-existing safe-harbor wording  *(P46 backlog, folded in by user request)*

- [x] **P57p** - CA prints "110% of prior-year (high-income filer)" above a 100% number; MD prints
  "110% (MD rule, always)" above a 90% number, because the corrective clause is appended only when
  `priorYearStateTax` is truthy while the federal line has an explicit else; and the threshold note
  says "AGI" while the code compares a state **tax** amount.

### Release chores

- [x] **P57q** - Tests for every behavioral change, then reconcile `TestTiers.EXPECTED` **and** the
  `.githooks/README.md` table, version bump both pages, changelog with no em-dash.

**Status:** **COMPLETE 2026-08-18**, a through q, folded with P56 into ONE release, planner
**v1.1599** / Optimizer **v11.1599**, UNCOMMITTED. Suites **269 / 51 / 22**; `?runtests` full
synchronous run green at **587 (245 in-page + 342 node)**. Adversarial diff review running at the
time of writing.

**Verified in the browser** on the reported URL: the header no longer contains the word January at
all, carries no Strategy or IRA Coverage badge, and reads "Winner: Plan C ... Plan C - Late: draws in
December, conversions in December". Plan C's own coverage table now lists **Quarterly estimated taxes
$4,298 / $2,702 / $7,000**, the seven payments the single page-level table used to omit. Every section
carries its own cost line and cash-delivery sentence: A/B/C "none. Every dollar of the $50,000 drawn
is withheld for tax, so this plan funds no spending", D "January $15,000", Q "December $50,000.
Anything you spend before December comes from somewhere else." The input panel reads "From your
inputs" and no longer prints a verdict, a coverage percentage or an opportunity-cost factor. Console
clean apart from the Cloudflare RUM CORS error localhost always throws.

**Changelog decision:** 11.1598 was written but never committed or published, so P56 and P57 are ONE
entry at 11.1599 rather than a release plus a hotfix for defects no user ever saw. The entry separates
what is new from what was fixed from earlier shipped releases.

---

---

## P58: the withholding a taken draw is ASSUMED to have carried  *(PROPOSED 2026-08-18, found while reviewing P57, NOT approved, no code written)*

**Found by self-review during P57, verified, out of P57's approved scope.**

The cross-IRA withholding optimizer sorts every draw group by month descending and assigns
withholding to the latest first. That set includes groups flagged **already taken**, so a plan can
assign withholding to a distribution the user received months ago. Measured (CA, tax year 2027, run
2027-07-10, `ira1Rmd: 8000` with `ira1RmdTaken: true`, `ira1Voluntary: 20000`, tax 57,000): plans A
and C both put **$8,000 of withholding on the June draw that was already taken**.

**It is not simply a bug.** Section 11a-w emits an "already-taken withholding reminder" that presents
those dollars as an ESTIMATE of what the user already elected, and asks them to confirm. So the design
intends the assumption. Two problems remain:

1. **The reminder is parent-only** (`if (!isChild)`), so it renders in Plan A's section alone, while
   every plan leans on the same assumption. That is precisely the defect class P57 closed everywhere
   else: a disclosure attached to one plan and relied on by five.
2. **The direction of the error is not stated.** A retiree who took the RMD with the default 10%
   election, or with none, has a plan whose coverage is overstated by the difference, and the page
   reports `✓ Fully covered` anyway. That understates what they still owe.

**Options, for the user to choose:** (a) render the reminder in every plan section that assumes
withholding on a taken draw, stating the direction of the error; (b) stop assigning withholding to
taken groups altogether and route that share to estimates, which is conservative and changes numbers;
(c) collect the withholding actually elected on a taken draw as an input. (a) is the smallest honest
fix, (c) is the correct one.

### Second item, found the same way: `forceStrategy: 'quarterly'` makes a plan OVERPAY

Self-review swept 22 scenarios through the engine asserting that every plan pays exactly the entered
liability. One case fails: with `forceStrategy: 'quarterly'` and a conversion early enough for the
gap-fill to fire, the gap-fill withholds on the conversion AND the forced strategy then schedules the
**whole** liability as estimates on top of it. Measured: plans A and B pay **$64,000 against $57,000**
of tax, a 12% overpayment.

**Not from P56 or P57.** The identical scenario at `HEAD` pays the same $64,000, so this predates the
five-plan work.

**Not reachable from either page.** `grep -rn forceStrategy --include=*.html --include=*.js` returns
nothing outside `taxPaymentPlanner.js` and its suite: no input, no URL parameter, three test call
sites. A programmatic caller is the only way in.

One defensive change WAS made in P57's release, because it guards an invariant P57 itself introduced:
the parent now offers Plan D only when its December tranche exists as an **action**, not merely as a
dollar figure. Without it, a caller-level `forceStrategy` suppressed the child's draw actions and the
page offered a "Split" plan with nothing split. That guard cannot change reachable behavior.

**Fix, when approved:** when a plan is forced to all-quarterly, size the estimates at the liability
LESS whatever the plan already withholds, or refuse to apply gap-fill withholding at all under a
forced-quarterly strategy. The second is cleaner and matches Plan Q, which already skips the gap-fill.

### Third item, found while fixing the first two: a COMPLETED conversion could be withheld on

Same reasoning applied to `ira*ConvDone` turned up a worse instance. The gap fill's `convSlots`
filter never checked whether the conversion had already happened, and because the gap fill sizes
itself off the shortfall it could take the WHOLE conversion: measured, a $40,000 conversion marked
done was assigned **$40,000** of withholding, which would leave nothing in the Roth at all. The
explicit `ira*RothWithhold: true` override had the same hole.

### P58 COMPLETE 2026-08-18, shipped as v1.159d / v11.159d

- [x] **P58a** - taken draws are locked: an action already completed carries only what the user
  reports. New optional inputs `ira1RmdWithheld` / `ira1VolWithheld` / `ira1ConvWithheld` and the
  IRA 2 equivalents, blank meaning "not stated", with URL keys `i1rw`/`i1vw`/`i1cw`/`i2rw`/`i2vw`/`i2cw`.
  Blank credits nothing, which OVERSTATES what is still owed rather than understating it, and the
  note says so.
- [x] **P58b** - the disclosure renders in EVERY plan, not just the parent, and distinguishes a
  figure the user supplied from an assumption the planner made.
- [x] **P58c** - a completed conversion is locked the same way, and the override cannot re-elect it.
- [x] **P58d** - `forceStrategy: 'quarterly'` no longer stacks estimates on top of gap-fill
  withholding: it pays $57,000 of $57,000, where it used to pay $64,000.
- [x] **P58e** - 4 test groups, suite 51 -> **55**, both pinned homes plus the tier-2 prose count
  342 -> 346, version bump, changelog entry calling the behavior change out.

**Verified in the browser.** With `i1rt=1` and no figure the plan reads "no withholding assumed ...
OVERSTATES what you still owe" and schedules the estimates; adding `i1rw=1600` flips the heading to
"Already completed this year" and the note to "you reported $1,600 withheld ($982 federal + $618
California)". The field appears only once its checkbox is ticked, and it survives a share link.
**GOTCHA found doing it:** a new numeric input does not load from a URL until its id is added to the
`NUM_FIELDS` allowlist in `loadFromUrl`; the SHORT_TO_LONG map alone is not enough.

**Status:** COMPLETE. The 22-scenario self-review sweep is clean.

---

---

## P64: SALT deductibility — the Optimizer never passes `propTax`  *(NEW 2026-08-19, user-approved, O0, STUDY FIRST)*

### The defect

The Optimizer computes federal tax with **SALT = state income tax only**. Property and other local
taxes are never in the figure, so any household that would itemize is charged too much federal tax in
every simulated year, and Break Even, the conversion schedule, lifetime tax, final net worth and every
"Optimize for" ranking inherit it.

The machinery is already there and already right. `taxengine.js` ~1429-1435 computes
`saltItemized = min(stateTax + propTax, saltCap)`, picks `useItemized` against the standard deduction,
applies the OBBBA $40k cap with its 30c-per-$1 phase-down above $500k MAGI, and reverts to $10k after
2029. **`propTax` is simply never passed.** It defaults to 0 at all **14** `calculateTaxes` call sites
in `optimizer_core.js`, at `Retirement_Projection.html` ~1274, and at the `standalone/irmaa_and_rmds.html`
site. Only `standalone/IncomeTaxPlanner.html` supplies it (~396, input `num-prop`, URL param `pt`).

**This defect class has already bitten this repo once.** `optimizer_core.js` ~1049-1052 records that
`obbaOn` and `saltHigh` were "implemented and unit-tested but never reached a single simulated year"
because no caller passed them, which "made federal tax too HIGH for anyone 65+ (or itemizing in a
high-tax state)". `propTax` is the same bug, still open, and the guard test written to stop the
recurrence (`optimizer_core.tests.js` ~2066) does not cover it.

### Why it is a study before it is a build

**The user's framing, 2026-08-19:** the elevated cap is high now but falls to $10k in 2029, and past
that it is not clear modeling it helps. Correct - and at $10k the standard deduction beats it for
nearly every retiree. For a plan starting in 2026 the entire deductible window is **four years**, and
only for households whose capped SALT clears the standard deduction at all. So Phase 1 measures, and
Phase 2 is contingent on the measurement.

**The reason it may still matter a lot.** Those four years are the prime conversion window, and the
phase-down makes the cap itself conversion-sensitive: `saltMagi = federalAGI + taxExemptInterest`, so
a conversion lifting MAGI from $400k to $600k erases up to $30,000 of deduction - roughly $9,600 of
federal tax, about 4.8 points of extra effective marginal rate across that band, invisible today. At
`propTax: 0` most households never itemize, so the cliff never fires; give them real property tax and
it becomes reachable. **If that shows up it resizes conversions, not just the tax total**, and that
alone would justify the input.

### Assumption, stated because it changes results

`spendGoal` is "Annual after-tax spending the plan must deliver" (`retirement_optimizer.html` ~78).
Property tax is an after-tax expense, so a correctly-filled plan **already includes it there**. The
new input is therefore **deduction-only** and must NOT also be added to spending. The help text has to
say so, or users will enter it twice.

### Tasks

- [x] **P64a** - **DONE v11.15b6.** Thread the parameter, behaviour-neutral at the default. `inputs.propTax` (today's
  dollars, default 0), `inputs.propTaxGrowthMode` (`'cpi' | 'flat' | 'custom'`, default `'cpi'`),
  `inputs.propTaxGrowthRate` (percent, read only in custom mode). Compute `yr.propTax` in the same
  per-year block as `yr.obbaOn` / `yr.saltHigh` (~1058), then pass `propTax: yr.propTax` at all 14
  sites. Three-way growth is the user's call: custom covers California Prop 13's 2% assessment cap and
  the reassessment-heavy states, and because the cap is a threshold the CPI-vs-2% difference is a step
  function over 30 years, not a smooth one. **Acceptance: byte-identical run at `propTax: 0`.**
- [x] **P64b** - **DONE v11.15b6.** Extend the existing guard test at `optimizer_core.tests.js` ~2066 to assert `propTax`
  on every observed call, rather than writing a new one. That is the test that would have caught the
  original bug and it is the one that must catch the next. Prove it: drop `propTax` from one site,
  watch it go red, restore.
- [x] **P64c** - **DONE 2026-08-19, and the answer is "almost never" - see findings.md.** The harness, node-only, not shipped, modeled on the P51 oracle. Sweep propTax
  `0 / 5k / 12k / 25k` x states `CA, NY, PA, TX, FL` (TX and FL are the band where property tax is the
  ENTIRE SALT figure) x one mid and one large case chosen so MAGI straddles $500k in the conversion
  years, plus `cpi` vs `custom 2%` on CA. Per cell report: delta federal tax per year 2026-2029 and how
  many years `useItemized` flips; delta lifetime tax and final net worth; **whether the Break Even
  verdict or the conversion schedule changes**; the effective marginal rate on the conversion band with
  and without propTax, to confirm or kill the cliff; and how much survives the 2030 revert.
  **"Almost nothing survives and no decision moved" is a legitimate result** - it would mean documenting
  the omission instead of building the input.
- [x] **P64d** - **DONE v11.15b7, and both were real.** Verify two suspected constant defects against primary sources, research only.
  `taxengine.js` ~1010 comments `capHigh: 40000 // increases 1%/yr through 2029` while the code is flat,
  and `phaseoutThreshold: 500000` is believed to index the same way under P.L. 119-21. **Do not fix
  either inside P64a.** Unlike `propTax: 0` these are NOT behaviour-neutral: a CA household whose state
  income tax alone exceeds the standard deduction already itemizes today, so changing the cap moves its
  numbers immediately. Cite in `findings.md`, ship as its own commit with its own before/after.
- [x] **P64e** - **DONE v11.15b7 as URL-entry-only, the user's call at the checkpoint.** `?ptx=` amount, `?ptxm=inflation|flat|custom`, `?ptxr=` percent; read once at load, re-emitted by `buildShareURL` so a shared link keeps them, no control on the page. Original scope was the UI. Amount field plus the three-way growth
  control following the `num-prop` pattern at `standalone/IncomeTaxPlanner.html` ~218; help text saying
  do not also add it to the spending goal; a URL param on a free short key (`pt` is taken by
  IncomeTaxPlanner). Default-visible vs nerd-gated is decided by the P64c numbers, not now.
  `Retirement_Projection.html` and `standalone/irmaa_and_rmds.html` are a follow-up, not part of this.

### P64f - the bug the study found: the elevated cap died a year early  *(FIXED v11.15b6)*

- [x] **P64f** - `taxengine.js` read `saltBaseCap = obbaOn ? (saltHigh ? capHigh : capLow) : capLow`.
  Both callers derive `obbaOn` from `SENIOR_DED.sunsetYear` (2028) and `saltHigh` from
  `SALT.sunsetYear` (2029), so in tax year **2029** obbaOn was already false and the $40,000 cap
  collapsed to $10,000 a full year early. `IncomeTaxPlanner.html` states the intent in its own comment
  - "SALT elevated cap continues through 2029" - while passing flags that line then ignored. One flag
  cannot carry two sunsets. `saltHigh` is now the sole gate on both the cap and its phase-down;
  `obbaOn` gates only the senior deduction. **Not behaviour-neutral**: it lowers 2029 federal tax for
  any itemizer, in the Optimizer and in IncomeTaxPlanner, which has always had a property-tax input.

### What the measurement found

Full numbers in `findings.md`. The short version:

- **Upper bound is about $4,000 of lifetime federal tax, for any household.** The gain is only the
  excess of capped SALT over the standard deduction, `(40,000 - stdDed) x marginal rate`, for four
  years. Measured maximum across every cell was **-$2,179** of lifetime tax and **+$18,810** of final
  after-tax net worth on a $32M terminal balance, i.e. **0.06%**.
- **It saturates.** $40,000 and $60,000 of property tax give identical results; the cap binds.
- **It is dead from 2030.** Every 2030 delta measured exactly zero, confirming the user's premise
  rather than assuming it.
- **It shrinks every year inside the window** (-1476, -867, -649, -424): the standard deduction is
  inflation-indexed and the cap is not, so the indexed deduction outruns the flat cap.
- **No decision moved.** Best bracket-fill target was 12% in 17 of 18 cells regardless of property
  tax; the single flip was a 0.01% margin that reversed at the next propTax value.
- **The phase-down cliff is refuted.** Moving the target from 24% to 32% costs $2,926,207 at
  propTax 0 and $2,945,017 at propTax 25,000 - the SALT part is 0.6% of the cost of that decision.
- **No-income-tax states are NOT the sweet spot**, which was the pre-measurement guess and was
  backwards: TX and FL must clear the entire standard deduction on property tax alone, so they show
  exactly zero at $30,000 and only start at $40,000.

### P64d outcome, and the one place it moved a decision

Both suspected defects were real. `capHigh` and `phaseoutThreshold` are 2025 BASE figures that step up
**1% per year applied to the prior year's figure** through 2029, so 2026 is $40,400 / $505,000 - the
tool froze both at the 2025 numbers, i.e. the CURRENT tax year was already priced wrong. Now indexed,
clamped at the sunset, with `taxYear` passed from both callers and asserted by the guard test.

**This one is not always small.** The threshold decides how much of the elevated cap survives a
conversion that lifts MAGI past it, so a plan converting hard in a high-tax state can land elsewhere.
The `bestTimeLimitedConversion` fixture moved from **$250,000/yr for 5 years to $300,000/yr for 4**,
and the new plan scores **167,787 against 166,002** - under the frozen threshold $300,000 scored only
140,173, so the ranking genuinely inverted rather than a tie being broken differently. The golden
values in that test were updated with the reasoning recorded inline. This qualifies the P64c headline:
*property tax* moved no decision, but correcting the *cap indexation* did.

Open rounding question: 2026 is exactly 40000 x 1.01 so plain compounding matches at the first step;
the convention for 2027-2029 is unconfirmed and worth a few dollars of deduction at most.

- [x] **P64g** - **DONE 2026-08-20, shipped in PR #184.** `Retirement_Projection.html` passed NO `obbaOn`,
  `saltHigh`, `propTax` or `taxYear`, so it priced the pre-OBBBA world forever - no senior deduction, $10k SALT
  cap, 2025 figures. It now derives `obbaOn`/`saltHigh` from `TAXData.OBBBA.*.sunsetYear` per projection year and
  passes an inflation-adjusted `propTax` (its own slider, `#propTax`), so both tools price the same law.

**Status:** **PHASE COMPLETE 2026-08-20.** `P64a/b/c/f` shipped v11.15b6, `P64d/e` v11.15b7, the Save/Load drop of `?ptx=` fixed at v11.15c8, `P64g` in PR #184. Original status text follows. Phase 0 DONE.
271 / 61 / 22, browser badge green at 607, console clean. **P64e is now a user decision** and the
measurement argues against it: see the recommendation below. **P64d still open** and is now more
interesting than it looked, because the missing 1%/yr cap indexation is part of why the window closes
so fast.

**Recommendation put to the user:** the Optimizer input is not justified by these numbers. The
parameter is threaded and guarded, so the model is no longer knowingly wrong, and IncomeTaxPlanner
already has the input for the single-year question where it actually matters. The options offered
were: no input at all (document the omission), a URL-parameter-only entry with no visible control, or
the full field plus growth-mode control.

---

## P66: IRMAA - the tier ceiling aimed two years of inflation too low  *(COMPLETE 2026-08-20, v11.15cf, PR #182/#183)*

Recorded after the fact: the work shipped without a phase ID, so this section exists so the change is
findable from the plan and not only from the changelog.

**The defect.** IRMAA bills a given year's premium against the MAGI reported **two years earlier**,
compared against the thresholds published for the **billing** year. The engine had the billing half
right (MAGI from two years back, thresholds inflated to the current year, which is what SSA does).
The **targeting** half was wrong: every ceiling that caps *this* year's MAGI to stay inside a tier
used *this* year's threshold, when that MAGI will be judged against the threshold published two years
later. At 3% inflation that aims about 6% low - roughly **$13,300/yr** of unused IRA spending or Roth
conversion room on the MFJ Tier 1 floor of $218,000, every year of a plan. At 0% inflation nothing
moves, which is what makes it an indexing fix and not a new policy.

**Two paths changed:** the IRMAA Ceiling strategy ("Fill Fed/IRMAA Bracket" with a tier selected),
and QCD "As Needed" (donates only as much as it takes to drop two tiers) - the second is where the
correction is worth the most. Behavior change is real: a Ceiling plan converts more, a QCD "As
Needed" plan donates less, and saved scenarios and shared links both move.

- [x] **P66a** - aim the ceiling at the projected **future** threshold rather than the current one.
- [x] **P66b** - a selectable **IRMAA safety margin**, nerd-gated because it is still being measured,
      not because it is dangerous. Default **half the next-tier surcharge** (scales the setback to
      the size of the cliff); also None / $1,000 / $2,000 fixed setbacks, and two rate-based options
      (half the expected inflation, 1% less than expected inflation).
- [x] **P66c** - the margin applies to the **ceiling only, never to QCDs**. Measured: the money
      leaving as a QCD to stay under a future threshold exceeded the value of the surcharge avoided,
      so "As Needed" always aims straight at the projected threshold with no margin. Risking an IRMAA
      penalty and money permanently leaving for charity are not the same decision.
- [x] **P66d** - three node harnesses under `.test_harnesses/` with their results checked in:
      `irmaa_default_harness.js`, `irmaa_margin_harness.js`, `irmaa_cpi_risk_harness.js`.

**Merge note.** This branch was rebased onto P64 (SALT); the pre-merge prediction "SALT and IRMAA
cannot interact" held for the merge but is **stated too strongly** - see
`.planning/retirement-optimizer/MERGE_PR182_IRMAA.md`. Property tax cannot move MAGI *directly*, but
the engine is a feedback loop: a lower tax bill changes what has to be withdrawn, and by 2029 the
measured dMAGI reached **$5,791 (3.74%)**. Any future "feature X cannot affect Y" claim in this repo
needs that caveat.

**Test counts after:** 280 / 61 / 22 (`slowInCore` 3).

---

---

## P52: Monte Carlo run scope, plan-of-record vs compare-all  *(DONE 2026-08-12, shipped in v11.150b)*

**Why:** the Monte Carlo tab runs `numPaths x buildVariations(base).length` simulations - about 144
strategy arms - every single time, because its purpose has always been to RANK strategies. On the
default scenario that is 72,000 simulations and roughly 1.8 million simulated years, measured at
27-42s. Almost none of that answers the question most people arrive with, which is "will MY plan hold
up". That answer needs 500 simulations, not 72,000. Making the sweep opt-in turns a 30 second wait
into roughly a fifth of a second for the common case, and it turns the tab's auto-run on activation
(normal mode) from a page-freezing event into something instant.

**Shape:** the primary Run button runs the plan of record alone. A second control, nerdknob-gated,
runs the full cross-strategy sweep exactly as today. Everything downstream already handles a single
variation, because the stress pass has always been a one-variation run.

- [x] **P52a** DONE. - Give `runMonteCarlo()` a scope argument (`'plan' | 'compare'`). In `'plan'` scope
      pass a one-element `variations` array built exactly the way `stressVariations` already is
      (`findCurrentStrategyIdx` with the synthetic `_label: 'Current Plan'` fallback), so the worker
      contract, `mc_controller.js` and `worker.js` are untouched. Add the scope to `_buildMCHash()`
      so switching scope re-runs rather than showing the other scope's results.
- [x] **P52b** DONE. - UI: keep "Run Monte Carlo" as the always-visible primary; add "Compare All
      Strategies" beside it, shown only under nerdknob. The existing `#mc-nerd-panel` cannot host it
      as-is: the primary button lives inside that panel and is therefore already hidden from normal
      users, who reach a run only through auto-activation. Either lift both buttons out of the panel
      or add a separate gated wrapper.
- [x] **P52c** DONE. - Presentation in `'plan'` scope: a one-row survival table is not a ranking, so hide
      `#mc-table-wrap` and its shading legend, keep the plan headline and the percentile chart, and
      short-circuit the best-per-family default-selection block in `renderMCResults` (a single
      variation is trivially the selection, `_mcPinIdx` is 0). The click-a-row-to-load and
      "Optimize for" affordances only mean anything in `'compare'` scope.
- [x] **P52d** DONE. - `updateMCTimeEstimate()` already takes a variation count, so pass 1 in plan scope;
      the readout should then read "500 paths, 12,500 simulated years" rather than naming a strategy
      multiplier of one.
- [x] **P52e** DONE. - Tests: scope `'plan'` produces exactly one varResult whose label matches
      `sameStrategySelection` against the sidebar; scope `'compare'` is byte-identical to today's
      output; the hash changes with scope.

**Estimated cost: about half a day, low risk.** No engine change at all - `worker.js`,
`mc_controller.js` and `prng.js` are untouched, which is what keeps the risk down. Roughly 60-100
lines in `mc_tab.js`, ~15 lines of markup, 4-6 assertions, plus changelog and README. It is this
cheap because the one-variation path is already proven in production by the stress pass, which has
run exactly this way since PF3.

**DECISION (user, 2026-08-12): compare stays the default so current users lose nothing.** The
plan-only path is the nerdknob EXTRA, not the new default. That inverted P52b's harder half: the
two buttons both live inside `#mc-nerd-panel`, which is already hidden from normal users, so no
gating work was needed and the auto-run on tab activation still runs the full comparison.

**Measured:** plan scope 1.76s vs compare 37s on the default scenario, and plan scope reproduces
the compare run's pinned figure exactly (66.6%, 333/500) - a useful cross-check that the
one-variation path is the same computation.

~~Original open question:~~ whether NON-nerdknob users get the fast
plan-only path by default. That is the whole UX win, but it is a visible behavior change - today a
normal user landing on the tab eventually sees the full 144-strategy comparison table, and after
this they would see only their own plan unless they turn on nerdknob. The alternative, defaulting
everyone to compare and making plan-only the nerd option, preserves today's behavior but delivers
none of the speed benefit to the people most affected by the wait.

---

---

## P53: Monte Carlo Stress Test suite  *(DONE 2026-08-13, shipped v11.1521-v11.152f, PR #170)*

**Phased retroactively 2026-08-15** during the git resync - the work shipped un-phased and lived only
in the changelog until now. Recorded here so the feature is discoverable and its one behavior-reversal
(below) is not lost.

**Why:** a single historical stress window hides what the other four would have caught - a short sharp
crash and a long grinding one flag different start years - and the shipped panel had five reported
defects, two of them crashes.

**Tasks (all DONE, `montecarlo/{mc_controller,mc_tab,prng,worker}.js` + `retirement_optimizer.html` +
README + `optimizer_core.tests.js`):**
- [x] **P53a** — Fix five reported Stress Test defects, two crashes: `buildStressBank` sliced its ranked
  candidates to `count` then looped to `count` and destructured **past the end** (the pool is only
  `98 - window + 1` start years, so 85 sequences overran the 15/20/30yr windows); the worker's `onerror`
  swallowed the throw; blank-Paths produced `NaN`. **v11.1521** (`733cc47`).
- [x] **P53b** — Combine-all-windows / run-all-windows: split ranking out of bank-filling with
  `scoreStartYears(sLen)` over the 5/10/15/20/30yr windows; grade on plan length. **v11.1521a** (`3292d11`).
- [x] **P53c** — Stale "Out of date" banner no longer fires when the only edit was a Stress window/
  sequence control (its Re-run swept ~144 strategies to refresh a chart that had already refreshed).
  **v11.1521b** (`83ac77e`).
- [x] **P53d** — Memoize `scoreStartYears` per window length; pure fn of `HISTORICAL_RETURNS` (a static
  table), so `combined`/`all` stop re-deriving the identical ranking every debounced edit.
  **v11.1521c** (`05b2277`).
- [x] **P53e** — **BEHAVIOR CHANGE:** bear-start overlay draws 3/5/10yr openings, not worst-decades
  (1930 is worst over 3yr at -26.9%/yr real but only 13th worst over 10yr at -0.4%/yr because the decade
  contains 1933's +54% rebound). Moves Historical MC results. **v11.1521d** (`d751eb3`).
- [x] **P53f** — **Plan-only is the default run**, both buttons priced and moved outside the Advanced
  panel. **v11.152d** (`49d4560`). **This REVERSED the P52 decision** ("compare stays the default", user
  2026-08-12) two days later. The P52 section above is now historical on that point; P53f is the live
  behavior.
- [x] **P53g** — In-page changelog trimmed to what a normal user sees; bear-start detail moved out.
  **v11.152e / v11.152f** (`c8725d7`, `60fa0fe`).

**Status:** DONE, merged as [PR #170](https://github.com/nightskyguy/retirement_assets/pull/170).
Node-core test additions here are part of the path to the current 263.

---

---

## P54: `?montecarlo` teaching demo + mode-aware paths floor  *(DONE 2026-08-15, shipped v11.1553, PR #173)*

**Phased retroactively 2026-08-15** during the git resync - shipped un-phased.

**Why:** the Monte Carlo mechanism (why more paths narrow the band, what mu/sigma do) was explained only
in prose; a reader could not watch it happen. A reported bug ("1 path still shows wide bands") turned out
to share a root cause with that gap.

**Tasks (all DONE, `montecarlo/mc_tab.js` +145, `retirement_optimizer.html`, `optimizer_ui.js`, README,
changelog):**
- [x] **P54a** — URL-triggered demo `?montecarlo`: lands on the Monte Carlo tab in **Synthetic** mode,
  exposes Seed / Paths / Input Distributions, and auto-runs an **Experiment** - the sidebar plan
  simulated with 3 random seeds at each of 4 path counts (5/10/25/100). The table shows the sampled
  equity range jump around at 5 paths and settle by 100. Every cell reuses the same engine and payload
  fields a normal "My Plan Only" run reports, so the numbers match by construction; the box glosses
  mu/sigma and links the README Monte Carlo section. **v11.1553** (`52c9b03`).
- [x] **P54b** — **Mode-aware paths floor** (root cause of the "1 path still shows wide bands" report):
  the floor stays **100** normally so survival rate and percentile bands stay meaningful, but drops to
  **3** under nerdknob or the demo. The value was previously clamped to 100 before the run regardless.
  **v11.1553** (`52c9b03`).
- [x] **P54c** — Experiment box is a `<details>` fold (open by default) so it can be collapsed; same
  native-details mechanism as the Input Distributions / FAQ folds. Shipped alongside the optimizer-table
  pinned-row relabel (`⚓ <label>` / `📍 <label>`, dropping redundant BASELINE/CURRENT). `8ca6d42`.
- [x] **P54d** — README: replaced the manual nerdknob walkthrough in the "Monte Carlo and Chance of
  Success" note with a link to the Experiment feature; fixed a broken tool URL (missing `.html`) and
  grammar nits. `4113414` / `52c9b03`.

**Status:** DONE, merged as [PR #173](https://github.com/nightskyguy/retirement_assets/pull/173).
Tests at ship: node core **263/263**, doclinks 22, TPP 32; **browser self-test 559**.

---

---

## P56: Tax Payment Planner — five-plan matrix (A/B/C/D/Q) + one unified cost table  *(NEW 2026-08-17, plan APPROVED by user, O0, no code written)*

**Scope:** `RetirementTaxPlanner.html` + `taxPaymentPlanner.js` only. The Optimizer engine is not
touched. Design was researched and approved in the 2026-08-17 session; **nothing was implemented**,
this section is the whole specification.

### Starting state — READ FIRST

**Resynced 2026-08-18: the prerequisite work is MERGED.** This block used to say the v1.1580 fix was
uncommitted on branch `worktrees/retirement-tax-planner-payment-582cdf` and had to be preserved. It no
longer does: the fix shipped in [PR #178](https://github.com/nightskyguy/retirement_assets/pull/178)
(`c3bd384`) and rides at `main` = `02eaf2b`. **P56a starts from a clean tree, nothing to re-derive.**

- The early-vs-December comparison used to be gated behind `hasAnyConversion`, so a **draw-only**
  scenario silently computed exactly ONE plan and never showed the December alternative. It is now
  gated on `hasAnyConversion || hasDeferrableDraw`, where a draw is deferrable only if it is not
  already taken. Draw-only renders a two-plan (early vs December) comparison with the Roth-specific
  column, pill and growth row suppressed.
- Test count went 32 -> **34** (node and browser both green), version 1.13c3 -> **1.1580**. Both live
  on `main`.
- The stale `taxPaymentPlanner: 32` pin is **FIXED on `main`** (PR #179 corrected it to 34), which is
  **P56j, done by someone else**. P56i must move that number again when it adds its 8 test groups, and
  per the `CLAUDE.md` rule `main` brought in, the same count is pinned a second time in the
  `.githooks/README.md` suite table.

### Why (the defect this phase closes)

The planner grew **two cost models that never met**, and they can print opposite verdicts:

1. **Timing comparison** (`buildConvComparison`, ~line 1919): first-year advantage measured to
   **Dec 31**, portfolio-rate deltas only, no cash-carry term.
2. **Cost Analysis table** (`buildAnalysis`, ~line 1856): absolute opportunity cost to an
   **April 15** reference, with an HYSA cash-carry term.

They share no numbers, and the second one is anchored wrong: its YE-IRA row is priced at the
**main (early) plan's** `effectiveWithholdMonth` even when the December plan wins. Reported by the
user on this scenario (CA, tax year 2028, fed 18,286 + CA 6,545, draws 139,182 of which RMD 15,657,
no conversions, r=6%, hysaGross=3%, ord=30%):

- Timing table: **December withholding wins** (early costs 1,578 more).
- Cost Analysis table, same run: **YE-IRA 1,862 vs All-Quarterly-Cash 656**, implying quarterly wins.
- Priced at the month the winning plan actually uses, YE-IRA is **~497** and genuinely beats
  quarterly's ~656. The table was contradicting itself, not the user.

Two further user complaints, both fixed here: it is not discoverable **why a plan column disappears**
when there is no conversion, and the **withholding-vs-quarterly** cost comparison is buried at the
bottom of the page in a table nobody connects to the plan choice.

### User goals this phase must satisfy (stated 2026-08-17)

1. Calculate different methods to draw spending funds **and** to withhold/pay taxes.
2. Determine relative cost of each method and present the options clearly.
3. RMDs must be drawn before conversions in that same IRA.
4. Every proposed plan must satisfy IRS/state payment timing.
5. Draws for spending and withholding for taxation may be considered **separately**.
6. Methods must include: **A** early draws+payments, **B** hybrid, **C** late draws+payments,
   **D** early draws + late payments, and **Q** quarterly payments instead of A/B/C/D.
7. For the current year, "early" is timed to the current date or later.
8. Any plan should make full use of the IRA draws that are already happening; where draws are
   insufficient, quarterly payments must be included.
9. Inputs stay unchanged unless there is a strong reason.
10. Output is a clear comparison of each plan with detailed steps for withdrawal, conversion, payment.

### The plan matrix — user lettering REPLACES today's letters

| Plan | Draws | Conversions | Tax payment | Maps to today |
|---|---|---|---|---|
| **A** Early | nextMonth | nextMonth | withheld at the draw | main computation (shown as "Plan B") |
| **B** Hybrid | December | nextMonth | withheld in December | `_planC` object (shown as "Plan A") |
| **C** Late | December | December | withheld in December | `_baseline` object (shown as "Plan C") |
| **D** Split *(NEW)* | spending part early, tax part December | nextMonth | December tranche withheld up to 100% | none |
| **Q** Quarterly *(NEW)* | December | December | quarterly cash estimates, zero withholding | none |

B is omitted when there is no conversion (it degenerates to C) and a **one-line note explains why** -
this is the user's "why did Plan A vanish" complaint. Q converts in December like C so it isolates
exactly one lever against C (payment mechanism); B already isolates conversion timing.

### Four decisions the user confirmed (do not re-litigate)

1. **D mechanics = holdback split.** The spending portion of each input draw is taken early with **no**
   withholding; the tax portion is held back as a **separate December draw tranche withheld up to
   100%** (Form W-4R permits a 0-100% federal election), still credited pro-rata across all four due
   dates under IRC 6654(g)(1). Total draws equal the input amounts exactly - it must NOT add a
   supplemental draw, which would create taxable income the pre-calculated tax inputs do not include.
2. **Q pairs with December draws**, isolating the payment method against C.
3. **Unified April-15 frame** for every plan, so the timing table and the Cost Analysis table become
   **one** table. This is what structurally kills the contradiction.
4. **Brokerage-sales survives as a footnote row** under the merged table (a funding-source variant of
   Q, carrying its capital-gains warning), not as a full plan with steps.

### Design — engine

**Variant plumbing.** Replace the `_baseline` / `_planC` booleans with a single
`_variant: 'A'|'B'|'C'|'D'|'Q'` param (unset = parent = A semantics); `isChild = _variant != null`
suppresses recursion, sibling computation and text/html rendering. Then:

- `convTargetMonth = (v === 'C' || v === 'Q') ? 12 : nextMonth`
- `drawTargetMonth = (v === 'A' || v === 'D') ? nextMonth : 12` - D's December tax tranche is
  synthesized separately, so `resolveIraOrdering` still sees early months and the RMD-before-conversion
  invariant is preserved with no extra work.
- Fix stale letter labels now embedded in note strings (~1103, ~1309, ~1376, ~1522).

**Q variant.** Force `strategy = 'all_quarterly'`; `drawWithholdCap = 0`; skip the conversion gap-fill
and the `ira*RothWithhold === true` override blocks. **Critical trap:** the draw-action block 11d
(~line 1450) is gated on `usesIraWithholding`, so a forced-quarterly plan with draws currently emits
**no draw actions at all**. Widen that gate to `usesIraWithholding || (v === 'Q' && allDrawsTotal > 0)`;
every draw then renders as a zero-withholding December action and the shortfall block builds the full
federal + state estimate schedule through the existing `splitExact` / `dueDateFor` / IRC 7503 machinery.
Q needs its own shortfall wording ("this plan takes draws without withholding; the full liability is
paid as quarterly estimates") because the existing sentence reads wrong at 0% coverage.

**D variant (the new algorithm), inside section 6 (~898-927) plus 11d:**

1. Tax portion `TP = stateIraExempt ? min(eligibleDraws, federal remainder) : min(eligibleDraws, taxAfterConvW)`.
2. **Eligibility** to host the December tranche: the group is not already taken (taken flags lock a
   group to `prevMonth`), and it is **not the RMD of an IRA that has a conversion** - that RMD must
   complete before the early conversion. Voluntary groups of any IRA, and RMDs of conversion-free
   IRAs, qualify.
3. Source **largest-first** (mirrors the gap-fill `convSlots` convention; month-descending is
   meaningless here since every holdback is month 12): `dec_g = min(g.total, TP_remaining)`.
4. `drawGroups` becomes up to 8 entries: an early part `{month: early, total: g.total - dec_g,
   withheld: 0, tranche: 'spend'}` and a December part `{month: 12, total: dec_g, withheld: dec_g,
   tranche: 'tax'}`, dropping zero-amount parts, and skipping the generic withholding-assignment loop.
5. Gap-fill unchanged: if eligible draws cannot cover the tax, the early conversions pass
   `_gapFillAllowed` and the remainder flows to quarterly estimates, exactly like A.
6. Carry the `tranche` tag into the emitted actions. The December tax action reads "December
   tax-holdback draw of $X from IRA n, withheld 100%" and cites the new Form W-4R rule plus the
   existing IRC 6654(g) pro-rata note. Early spend actions state that the tax share is held back to
   December and that net spending cash matches Plan A.
7. **Invariants to assert:** per (IRA, tag), early + December equals the input amount exactly; early
   net cash equals Plan A's net; December withholding never exceeds 100% of its own tranche.
8. Parent computes D only when `hasDeferrableDraw && totalTax > 0 && TP > 0`; a degenerate D (nothing
   eligible, e.g. a single IRA whose RMD is locked ahead of a conversion) is omitted with a note like B's.

**Return shape.** Parent builds `plans = { A (self-reference), B?, C, D?, Q? }` where each entry is
`{ actions, summary, strategy }` or null, plus `comparison`. Children return `text: ''`, `html: ''`
(they currently waste a full render each, and child-rendered letters would be stale anyway). The old
`planB` / `planC` / `analysis` / `convComparison` return fields are **deleted** - their only consumers
are `RetirementTaxPlanner.html` and `taxPaymentPlanner.tests.js` (verified by grep; hits elsewhere are
`planBtn` false positives). The current `planB` = December and `planC` = hybrid naming is exactly the
letter soup this rename exists to kill; do not patch it, replace it.

### Design — the one unified cost model

Delete `buildAnalysis`, `buildConvComparison`, and `summary.opportunityCost` / `savingsVsWorst`.
Keep `iraOcFactor` exported (the HTML live preview reads it).

`buildPlanCost(planObj, ...)` walks **each plan's own action list**, so there are no month
approximations and CA's 30/40/30, VA's May 1 and OR's Dec 15 schedules are handled with no special
cases:

- withholding action at month m: `withheld * r * (16 - m) / 12`
- quarterly estimate at effective month m (January of year+1 counts as **13**):
  `amount * (r - hysaNet) * (16 - m) / 12`
- conversion at month m: benefit `conv * r * (16 - m) / 12` (keep the shipped no-tax-rate convention
  so plan-to-plan deltas match the old calendar-frame deltas)
- RMD portion drawn early at month m: `rmdNet * r * marginalOrdRate * (12 - m) / 12` (Dec-31 cap, an
  RMD cannot defer past year end). Voluntary draws stay **un-costed** - they serve spending needs and
  are not free to move; keep the existing footnote saying so. This requires exposing `rmdAmount` /
  `volAmount` on draw actions in 11d.
- `total = withholdOC + estimateOC + rmdDeferral - rothGrowth`; the star goes to the **minimum** total.

`buildComparison(p, plans, ...)` returns
`{ perPlan, best, labels, bNote, brokerage, hysaNet, breakeven, yeIraWins }`. The brokerage footnote
re-prices Q's estimate schedule at full `r` and adds `extraCg(totalTax)` (lift `extraCg` out of the
deleted `buildAnalysis`).

**Sanity anchors to assert (±$5).** User scenario above, run in Aug 2026 so nextMonth = September:
**A ≈ 940** (withhold 24,831 x 6% x 7/12 = 869, plus RMD deferral 70), **C ≈ 497** (star),
**D ≈ 567** (December holdback 497 + early RMD deferral 70), **Q ≈ 656** (fed 18,286 x 3.9% x 8/12
= 475, CA 6,545 x 3.9% x 8.5/12 = 181), B absent, brokerage footnote ≈ 3,169. This agrees with the
existing `yeIraWins` test (hysaNet 2.1% < r/2 = 3.0%, so withholding beats quarterly cash).
Reconciliation identity for every plan: withholding + estimates = tax due, within $1.

### Design — output

**buildText:** one comparison table (rows Roth growth / Withholding OC / Estimate carry / RMD
deferral / Total / vs best; columns = the letters present; star on the minimum), the B-absence note,
the brokerage footnote line, then plan sections in order A, B?, C, D?, Q with the winner marked.
Delete the old COST ANALYSIS section. Keep safe harbor, RULE_CITES, concepts, scheduling note.

**buildHtml:** header badges swap opportunity-cost/saves-vs-brokerage for `Winner: Plan X` and
`First-year cost $N`. The comparison box becomes the unified table with up to five pills (new colors:
D teal `#00695C`, Q orange `#E65100`), a `compRow` generalized over present letters, Total and
vs-best rows, the B-absence note and the brokerage footnote row. Delete the old Cost Analysis table.
Five `makePlanSection` calls with ids `plan-section-a` .. `plan-section-q`; wrap each section body in
`<details>` with `open` on the winner only, and give the .ics/Print buttons
`event.preventDefault(); event.stopPropagation()` so clicking them does not toggle the disclosure.
Add a **Form W-4R** RULE_CITE (0% to 100% election on IRA distributions,
`https://www.irs.gov/forms-pubs/about-form-w-4r`) and cite it from D's December tranche.

**HTML driver:** `_planData` becomes `{ taxYear, actions: { A..Q } }` (nullable, with a fallback to
`{ A: plan.actions }` when no comparison was built); `downloadPlanIcs` indexes that map instead of its
A/B/C ternary; `printPlan`'s `allIds` covers a/b/c/d/q; the print-button label counts non-null plans.
Add `beforeprint` / `afterprint` listeners that force every `#plan-html details` open and restore
afterward, because a collapsed `<details>` otherwise prints collapsed. `updateComputed` is unchanged.

### Tasks

- [x] **P56a** — Variant plumbing: `_variant` replaces `_baseline`/`_planC`; target-month selection;
  stale letter labels in note strings fixed. No behavior change for A/B/C yet. **DONE 2026-08-18.**
  `variant`/`isChild` derived once at the top; `convTargetMonth` keys off `C|Q`, `drawTargetMonth`
  off `A|D`; siblings spawn as `_variant:'C'` (late) and `_variant:'B'` (hybrid); the parent's
  locals renamed `planLate`/`planHybrid` while the return keys `planB`/`planC` stay until P56d.
  Four note strings fixed: "Plan C fallback" -> "Plan B fallback", "(Plan A hybrid)" ->
  "(Plan B hybrid)", and two "two-plan comparison" cross-references made count-neutral.
  **Equivalence proven, not assumed**: a probe ran HEAD's planner against the new one over 7
  scenarios (draw-only, one conversion, two conversions, IL IRA-exempt, already-taken, a December
  run, zero tax) and `text`, `html` and the full action/summary/comparison structure are identical
  once those four intended strings are normalized. Suite 34/34.
- [x] **P56b** — Q variant, including the 11d `usesIraWithholding` gate widening (without it Q renders
  no draw actions at all) and Q-specific shortfall wording. **DONE 2026-08-18.** `isQ` forces
  `all_quarterly` **ahead of** `forceStrategy`, so a user-level `forceStrategy:'ye_ira'` propagating
  into this child cannot turn the quarterly plan into a withholding plan; `drawWithholdCap` is 0, the
  gap-fill and both `ira*RothWithhold === true` overrides are skipped. Wording: the shortfall headline,
  the funding clause, the per-draw notes and the estimate labels all branch for Q, and the IRC 6654(g)
  pro-rata note is **suppressed** there because Q has no withholding for it to describe. Verified by
  probe over 5 scenarios (draw-only, two conversions, IL, `forceStrategy` propagation, an
  `ira1RothWithhold:true` override): strategy all_quarterly, every draw in December at zero
  withholding, draw dollars complete, 4 federal + 3 CA estimates summing to the liability.
  **Probe gotcha worth keeping:** estimate actions carry `federalWithholding`/`stateWithholding`
  equal to their own amount, so a naive sum over all actions double-counts and reads as if Q withheld.
- [x] **P56c** — D variant: eligibility rule, largest-first sourcing, split draw groups, tranche-tagged
  actions, Form W-4R RULE_CITE, degenerate-D omission note. **DONE 2026-08-18** (the omission NOTE
  itself belongs to the parent and lands in P56d; the child now reports `summary.dDegenerate` /
  `summary.dTaxPortion` for it to read). The four input groups became `baseGroups`; D splits them into
  an early `tranche:'spend'` part and a December `tranche:'tax'` part withheld 100%, sourced
  largest-first from the eligible set (not already taken, and not the RMD of a converting IRA).
  Non-D variants keep the original single-entry path and withholding loop. `tranche` rides the
  (num, month) merge into the emitted action and is **cleared to null when a spend part and a tax part
  merge**, which is what happens on a November/December run where "early" already IS December.
  Form W-4R added to `RULE_CITES` and cited from the tranche.
  **Correctness catch:** the first draft tagged EVERY early part `'spend'`, so an IRA the
  largest-first pass never touched printed "the tax share of this draw is held back to December"
  when none of it was. Only a group that actually gave up a share is tagged now.
  Probe over 7 scenarios (incl. IL, a converting IRA whose RMD is locked ahead of it, all-draws-taken
  and zero-tax degenerates) proves all four invariants: draws equal the input exactly, tranche
  withholding never exceeds its own amount, net cash out of the IRAs equals Plan A's, and
  withholding + estimates reconcile to the liability.
- [x] **P56d** — New return shape `plans` + `comparison`; children skip rendering; delete `planB` /
  `planC` / `analysis` / `convComparison`. **DONE 2026-08-18.** `plans` is the A/B/C/D/Q map with
  nulls for omitted letters; A is the parent itself. Spawn gates: B only with a conversion, D only
  when `hasDeferrableDraw && totalTax > 0` and it did not degenerate, Q only when `totalTax > 0`.
  Children return `text: ''` / `html: ''` instead of rendering output nobody reads.
- [x] **P56e** — `buildPlanCost` + `buildComparison` on the April-15 frame; delete `buildAnalysis` and
  `buildConvComparison`; expose `rmdAmount`/`volAmount` on draw actions. **DONE 2026-08-18.** Both old
  functions deleted along with `summary.opportunityCost` / `savingsVsWorst`; `iraOcFactor` stays
  exported for the HTML live preview. `buildPlanCost` walks each plan's own actions with
  `carry(m) = (16 - m)/12` and January of the next year as month 13.
  **Anchors hit exactly** (A 940 / C 497 star / D 567 / Q 656, run in August OF the tax year).
  **One spec anchor does NOT reconcile and was not bent to fit:** the brokerage footnote computes
  **$4,836**, not the ~3,169 in the phase text. Its two parts are $1,010 of forgone growth
  (18,286 x 6% x 8/12 + 6,545 x 6% x 8.5/12) and $3,826 of capital gains tax
  ((24,831 / (1 - 0.5805 x 0.23)) x 0.5805 x 0.23), which is exactly what the shipped `all_brokerage`
  row computed before this change. 3,169 happens to equal 3,826 - 657, so the spec number looks like
  a delta against Q's carry rather than an absolute. **Open question for the user:** absolute (now) or
  extra-cost-vs-Q.
- [x] **P56f** — buildText restructure: unified table, B-absence note, five plan sections, COST
  ANALYSIS section deleted. **DONE 2026-08-18.** Header now prints the winner and its cost instead of
  the OC factor and the savings-vs-brokerage line. Both absence notes (B and D) render.
- [x] **P56g** — buildHtml restructure: unified table, five pills/sections, `<details>` collapse,
  brokerage footnote, old Cost Analysis table deleted. **DONE 2026-08-18.** Each plan keeps the colour
  its CONCEPT had before the remap (early green, hybrid blue, December purple) so only the letter
  moved, with D teal and Q orange as specced. Buttons sit in the `<summary>` with
  `preventDefault`/`stopPropagation`.
- [x] **P56h** — HTML driver: `_planData` map, ics/print for five letters, print-button label,
  beforeprint/afterprint `<details>` handling. **DONE 2026-08-18.** `_planData.actions` is the A..Q
  map (the old three-way ternary silently fell through to Plan C for any letter it did not know);
  print label counts non-null plans. Verified in the browser: `beforeprint` opens all five sections
  and `afterprint` restores exactly the one that was open.
- [x] **P56i** — Tests. **Breaking (8):** #14 coverage invariant, #15 draw-only comparison (rewrite -
  "Plan A" now legitimately exists under the new lettering, so its `!/Plan A/` assertion is wrong),
  #16 already-taken, #29 pays-100% (iterate `Object.entries(plans)`, which extends the invariant to D
  and Q for free), #30, #31, #33 brokerage. **New (8 groups):** D tranche math and invariants; D
  ordering (an RMD locked ahead of a conversion never hosts the tranche; degenerate D omitted); D in an
  IRA-exempt state (IL: December tranche is federal only, state rides estimates); Q variant shape
  (all_quarterly, December zero-withholding draws, 4 federal + 3 CA estimates summing to the
  liability); unified-comparison sanity anchors + reconciliation identity; B-absence note in text and
  html; brokerage footnote present once and absent from the plan columns; extend the non-business-day
  sweep (#21) across `plans.*.actions` so D's synthesized December date and Q's estimate dates are covered.
  **DONE 2026-08-18. Suite 34 -> 42.** All six breaking tests rewritten (only 6 of the 8 predicted
  actually broke). Two real defects were found by the new tests rather than by review:
  1. **The extended sweep immediately failed on ten dates.** A draw group with no RMD in it was
     dated the 15th with no business-day nudge at all, and D's December tranche reused a day chosen
     for a different month. `Sat Aug 15 2026`, `Sun Dec 17 2028` and eight more. The old sweep passed
     only because no shape it ran produced a voluntary-only group; D's split produces them
     constantly. Fixed in `11d` for every plan, forward to the next business day and backward when
     forward would leave December (an RMD cannot cross year end).
  2. **`fmt$` takes `Math.abs` of everything it is given**, which is right for an amount and wrong
     for a signed total. A $40,000 January conversion drives every total NEGATIVE (the Roth growth
     outweighs the timing costs), and the winning plan printed as `$2,503 ★` - the most expensive
     number on the row appearing to win. Totals now carry their sign and both outputs explain that a
     negative total is a net gain.
  The coverage invariant also had to split: an all-quarterly plan has no withholding *shortfall* by
  construction, so Q is held to `withheld === 0` plus the payment reconciliation every plan satisfies.
- [x] **P56j** — Fix the stale `optimizer_tests.js:2220` `taxPaymentPlanner` EXPECTED count.
  **DONE by someone else**: shipped on `main` as v11.1581 in [PR #179](https://github.com/nightskyguy/retirement_assets/pull/179)
  (32 -> 34). P56i will still have to move it again when it adds its 8 test groups.
- [x] **P56k** — **DONE 2026-08-18, planner v1.1598 / Optimizer v11.1598** (dayOfYear 230 x 24 + 8 =
  0x1598). The Optimizer release is not optional here: `optimizer_tests.js` holds the pinned suite
  counts, so its cache buster had to move, which is a release of that page too - the same coupling
  that forced 11.1581 into existence. Counts updated in **both** homes (`TestTiers.EXPECTED` 34 -> 42
  and the `.githooks/README.md` table), plus the tier-2 loader prose count 325 -> 333.
  Original task text: Version bump (title + all three `?v=` cache busters, `hex(dayOfYear*24 + hour)`) and an
  `optimizer_changelog.md` entry. Lead with the correctness win: because every plan is now priced from
  its own action list, the cost table can no longer contradict the timing verdict. Call out the
  **BEHAVIOR CHANGE** explicitly - plan letters are remapped, so old shared links and printouts
  re-letter (old "Plan A hybrid" is now B, old "Plan B early" is now A). **No em-dashes** in the
  changelog prose, per the standing style rule.

### Risks and edge cases

- **The letter remap is user-visible.** Shared links and saved printouts re-letter. Changelog must say so.
- **November/December runs**: nextMonth is already 12, so A, C and D collapse to the same plan and B
  collapses to C. Star every plan within $1 and annotate ("plans are identical this late in the year");
  do not suppress the columns, the action lists are still what the user executes.
- **Zero tax**: D and Q are gated off; the comparison degrades to A vs C on RMD deferral alone.
- **`ira*RothWithhold` overrides** are honored by A/B/C/D (they shrink D's `TP` through
  `taxAfterConvW`); Q ignores them by definition, which must be stated in Q's section text. A
  user-level `forceStrategy` propagates to all children and makes the matrix mostly degenerate;
  acceptable, document it.
- **IRA-exempt states** in D: state tax cannot be withheld from an IRA distribution, so the December
  tranche covers federal only and the state portion rides quarterly estimates (existing `wStFrac` logic).
- **State factor drift**: action-based pricing reproduces CA's 8.5 weighted months exactly but differs
  from VA's tuned 7.875 by month granularity (7.75), so totals move a few dollars against the deleted
  table. Use tolerances in tests.
- **Perf**: five engine runs per compute instead of three, more than offset by children skipping the
  text/html render they currently throw away.

### Verification

1. `node taxPaymentPlanner.tests.js` green (expect roughly 42+).
2. Browser via the launch.json `retirement-optimizer` preview server, on the reported scenario
   `RetirementTaxPlanner.html?taxYear=2028&federalTax=18286&stateTax=6545&priorYearFedTax=18188&priorYearStateTax=6566&ssIncome=25363&pensionIncome=15000&interest=2783&qualifiedDivs=527&capitalGains=3788&ira1Rmd=0&ira2Rmd=15657&ira1Voluntary=91288&ira2Voluntary=32237&ira1RothConversion=0&ira2RothConversion=0&marginalOrdRate=30.0&bv=99398&bb=41696&cgr=23.0&hi=1&state=CA&portfolioRate=6&hysaGross=3`:
   four columns A/C/D/Q plus the B-absence note, C starred near 497, Q near 656, consistent with the
   live preview's "YE-IRA wins" toggle. Then append `&ira1RothConversion=40000` and confirm five
   columns with B present. `?runtests` badge green at the updated count.
3. Print: Ctrl+P and the per-plan Print buttons - every `<details>` opens in the output.
4. `.ics` download for D and Q - December tranche and estimate dates present.
5. Console clean in both scenarios.

**Status:** **COMPLETE 2026-08-18** (a through k), shipped as planner **v1.1598** / Optimizer
**v11.1598**, UNCOMMITTED on worktree `context-e73361`. Suites 269 / 42 / 22, browser badge green at
575 (245 in-page + 330 node, 3 slow skipped), console clean.

**Verified in the browser** on the reported scenario, worktree-rooted server: four columns A/C/D/Q
with the B-absence note, C starred, C $497 and Q $656 (A reads $2,121 rather than the spec's $940
because that URL is a FUTURE tax year, so "early" is January, not September; the spec anchors assume
a run in August of the tax year and are asserted at those months in the suite). Adding
`&ira1RothConversion=40000` gives all five columns with B present and winning at -$2,503.
`_planData` carries all five action lists for .ics; print opens and restores every section.

**Two open items for the user:**
1. The brokerage footnote is absolute ($4,836) and the spec's ~3,169 anchor does not reconcile with
   its own formula (see P56e). Absolute, or extra-cost-vs-Q?
2. Nothing is committed and no PR was requested.

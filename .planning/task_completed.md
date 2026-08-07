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

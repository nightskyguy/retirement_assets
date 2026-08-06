# Task Plan: Retirement Optimizer — Remaining Work

Goal: Complete open features from the original priority list plus deferred items from the UX batch. All completed phases archived in `task_completed.md`.

**As of:** 2026-08-05, later in the day. P38 PR 1 (`e8d28d6`, tests only) and PR 2 (`f592c31`, the gate widening, **v11.1468, behavior change**) are COMMITTED but NOT PUSHED, on branch `p38-pr2-widen-forced-ira-gate` stacked on `p38-pr1-shortfall-invariant`, both off `53e8ccf`. Working tree clean. See the P38 section below for measured results. Earlier state: branch `p38-baseline-funding-defect`, at `main` = `fe72bef`, v11.1464, P38's diagnosis-only planning files merged as [PR #151](https://github.com/nightskyguy/retirement_assets/pull/151). **P35 PR 1 + PR 2 MERGED as [PR #146](https://github.com/nightskyguy/retirement_assets/pull/146)** (nothing user-visible, so no version or changelog entry).
**P35 PR 3a MERGED as [PR #147](https://github.com/nightskyguy/retirement_assets/pull/147)** (v11.1447, behavior change). **P35 PR 3b MERGED as [PR #149](https://github.com/nightskyguy/retirement_assets/pull/149)** (v11.1448 tokens, byte-identical, plus the doc file-reference gaps); the duplicate attempt PR #148 on branch `worktrees/medicare-age-data-7b2e91` is **CLOSED, not merged** — verified, nothing to do about it.
**P35 PR 3c MERGED as [PR #150](https://github.com/nightskyguy/retirement_assets/pull/150)** (v11.1462 -> v11.1464 on merge, behavior change confined to `aca` rows, proven against `propwd`/`bracket` controls), four commits: the behavior change, the `eitherOnMedicareAtStart` deletion it made possible, the plan record, and the ACA Cliff un-gating. Next review point after it is **PR 3d** (`Basis <= Brokerage` invariant).
Everything through PR #146 is merged: #135 (PR-A..PR-G, v11.13a1), #136 (planner rollover math), #137 (nerdknob graduation, v11.13bd), #138 (TPP-3/4/5 + brokerage handoff, v11.13c3 / planner v1.13be), #139 (P25 docs rendering, v11.13c5), #140 (README audit round 3 + doc-link labels, v11.13d0), #141 (P28 unified-conversion harness + P27 assumption-sweep scoping), #142 (README caveats for uncovered tax situations, BETR/conversion-order revisions, Stonewood/ThunderHarbor reviews), #143 (P29-P34 phases added to this file), #144 (`assertUngated` no longer fails on pages without the control), #145 (P35/P36/P37 phases added to this file, `6f94c82`). Next work starts from a clean base.

**Current batch (added 2026-08-01):** six new phases P29-P34 from a user punch-list — Hebeler Autopilot, withdrawal policy, asset-mix reverse mapping, brokerage draws, an Insights statistics panel, and conversion-search cost. Four of the six touch questions this repo has ALREADY partly answered, two of them answered NO, so every one of those phases carries an explicit "already ruled out, do not re-derive" block. Read that block before designing anything in the phase; it is there to stop a re-derivation of P24 and P28.

**Added 2026-08-03:** three phases P35/P36/P37 from a user design proposal — a new **"Phased"** withdrawal strategy that switches behavior by life phase, its efficiency study, and a deferred LEGACY heir-drawdown phase. P35 is an alternative answer to the long-pending **P13**, and it carries a ten-item engine survey in `findings.md` ("P35 engine survey", 2026-08-03) that must be read before any code is written: several of its items are traps where the natural implementation produces a plausible wrong answer rather than an error. **Work is to be performed in stages**, PR by PR, with a review point between each.

VERSION COLLISION HAZARD, seen for real here: the minor is `hex(dayOfYear*24 + hour)`, so two branches worked on in the same afternoon produce ADJACENT numbers, and whichever merges first is not necessarily the lower one. P25 was built as v11.13c2 (hour 18) but PR #138 merged v11.13c3 (hour 19) ahead of it, so P25 was renumbered to v11.13c5 on merge. When resolving a version conflict, recompute from the clock rather than taking either side.

**Added 2026-08-05:** **P38, a shipped correctness defect, is now the top-priority item and jumps the queue.** `propwd`, `fixed`, `gk` and the baseline `else` branch report `success: false` with hundreds of thousands of dollars of unfunded spending while the IRA still holds seven figures. Pre-existing and byte-identical before P35 PR 3c (`d68d27f`, landed as `f71e0bf`); that PR only made it visible, because a lapsed ACA plan now falls through to the same path. Diagnosis is complete and measured — see findings.md, "The baseline/proportional strategy family cannot fund its own tax bill once the taxable accounts run dry" (2026-08-05). Re-verified to the dollar after PR #150 merged (v11.1464), so it is orthogonal to the whole ACA batch. Its section sits at the top of this file rather than in the P29-P37 block, on purpose. It overlaps P30 and P32 and must be settled before either.

**Added 2026-08-05 (later):** **P39, make the node-only tests visible in the browser.** Release gating relies on the Red X badge at page load, and that badge covers only the 245 in-page tests; **260 tests in three node-only suites never run in the browser**, so breaking them is invisible at release time. Measured, not estimated: 3 tests account for 1792 ms of the core suite's 2466 ms, and the other 203 run in 674 ms, so the "tests are too slow for page load" objection dissolves once those three are tagged. Section sits after P38. Independent of every other phase; its first work item (a pre-commit hook) delivers most of the value on its own and can land any time.

MAINTENANCE NOTE: this heading and the per-phase status lines are injected into every turn by the planning hook, so a stale "uncommitted" here reads as a live claim about the working tree. Update them in the same turn you commit, not later.

---

## Phase P38: The baseline/proportional strategies cannot fund their own tax bill (2026-08-05) — PR 1 + PR 2 DONE (committed, unpushed), PR 3 remaining

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

**REMAINING — PR 3, the sizing fix.** Make `additionalSpendNeeded` net of tax on guaranteed income
at `:1281`, so the first-pass draw stops under-sizing for **every** strategy including `bracket`.
The trap is unchanged and is the reason this is its own PR: `possibleIncome` mixes SS (0-85%
taxable), ordinary pension/RMD, and qualified dividends, so a flat `sim.nominalTaxRate` overstates
the tax and over-draws. Call `calculateTaxes` on the guaranteed-income base alone and subtract its
`totalTax`; watch the cost of a 4th tax call per year.

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

## Phase P39: Make the node-only tests visible in the browser (2026-08-05) — not started

**The problem, in the user's words.** Release gating relies on the **Red X**: load the page, see
`#testsFailed` render `🟢` or `❌ tests failed` (`optimizer_tests.js:2187-2194`), and do not publish
on a red. That badge only covers `optimizer_tests.js`. **260 tests in three node-only suites never
run in the browser at all**, so a change that breaks them is invisible at the moment of release and
can be published by accident. The competing constraint is equally real: browser load must not grow
by seconds.

Both constraints are satisfiable, and the measurements say so clearly.

### Measured 2026-08-05 (do not re-derive)

| suite | tests | wall time | browser today |
|---|---|---|---|
| `optimizer_tests.js` (in-page) | 245 | **55 ms** | yes, blocking at load |
| `optimizer_core.test.js` | 206 | 2466 ms | **no** |
| `taxPaymentPlanner.test.js` | 32 | ~320 ms | **no** |
| `doclinks.test.js` | 22 | ~10 ms | **no** |

**The finding that makes this cheap: 3 tests are 1792 ms of that 2466 ms — 73%.** All three are
`breakEvenHeirsRate` binary searches:

- `optimizer_core.test.js:2290` `breakEvenHeirsRate: the predicate is monotonic...` — **1438 ms**
- `optimizer_core.test.js:2304` `lowestBreakEvenHeirsRate: finds a threshold...` — **195 ms**
- `optimizer_core.test.js:2280` `breakEvenHeirsRate: the rate/amount pair...` — **159 ms**

The remaining **203 tests run in 674 ms combined**; 193 of them in 243 ms. So "multiple seconds of
tests" is really three tests, and excluding them changes the picture entirely.

Second enabling fact: `optimizer_core.js`, `taxengine.js`, `taxPaymentPlanner.js` and `doclinks.js`
**already carry dual-mode export guards** (`typeof module !== 'undefined' && module.exports`). The
sources already load in a browser. Only the four **test** files are node-bound, and only through
their `require()` headers — 5 calls in `optimizer_core.test.js`, 1 each in the others.

Also confirmed: `requestIdleCallback` and `Worker` are both available in the target browser, and
**no git hooks are currently installed** (`.git/hooks` has only samples).

### Design: three tiers

**Tier 1 — blocking, at load. Unchanged.** `optimizer_tests.js`, 245 tests, 55 ms. The Red X behaves
exactly as it does today. Nothing is added to the critical path.

**Tier 2 — deferred, after first paint.** Port `optimizer_core.test.js` and
`taxPaymentPlanner.test.js` to dual mode and run their fast subsets (203 + 32 tests, ~1 s) from
`requestIdleCallback`. The badge starts neutral, then resolves to 🟢 or ❌ about a second in. Load
time is unaffected because the work happens after paint. **This tier is what closes the gap.**

**Tier 3 — node and pre-commit only.** The 3 heavy searches above, tagged `slow`, plus
`doclinks.test.js`, which reads files from disk and cannot run in a browser without a fetch shim
that would be testing the shim rather than the code.

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

1. **Pre-commit hook first, on its own.** Runs `optimizer_core.test.js`, `taxPaymentPlanner.test.js`
   and `doclinks.test.js`; non-zero exit blocks the commit. Must be installable (hooks are not
   version-controlled) — either a `core.hooksPath` directory committed to the repo, or a documented
   one-line install. Decide which; the repo has no hook convention yet.
2. **Tag the 3 slow tests.** A `test.slow(name, fn)` variant, or a `SLOW` prefix the browser runner
   filters. Keep them running in node unconditionally.
3. **Dual-mode the two portable test files.** Mechanical: replace the `require()` header with a
   node/browser branch resolving the same symbols off `globalThis` in the browser. Roughly 60 lines
   at the top of `optimizer_core.test.js`; the 174 `test(...)` bodies do not change.
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
- **`doclinks.test.js` stays in node.** Its filesystem reads are the thing it tests.
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

## README Caveats Audit (2026-07-30) — DEFERRED by the user, corrections done

A separate read-only session audited what belongs in **What the Tool IGNORES** and **Limitations and
Restrictions**. Its full evidence, with file:line citations, is preserved at
`.planning/retirement-optimizer/readme_caveats_findings.md` (that session never wrote it into this
worktree). Five citations were spot-checked here before accepting it.

User decision: **corrections only now, caveats deferred.** All 5 of its factual corrections are done
(3 landed in Round 3; Account Composition and the duplicate Roth sentence landed with v11.13d0).

Deferred, in three clusters:

1. **16 limitations** for the two caveat sections - no capital losses, no basis step-up at death, ACA
   models the MAGI cap but never subsidy dollars, no healthcare or LTC costs, state fixed for the
   whole plan, MC never varies mortality, dividends assumed 100% qualified, abridged
   Uniform-Lifetime-only RMD table, no QSS window, flat national Medicare premiums, and more.
2. **State coverage** - 38 of 51 modeled; missing AR, DE, HI, KS, LA, MO, NJ, NM, OK, RI, UT, VT, WV.
   Sharpest point: README's own Tax Torpedo table names NM, RI, UT and VT as SS-taxing states the
   tool cannot model. Also no local or city income tax anywhere in the engine (NYC ~3.1-3.9% is the
   largest unacknowledged understatement), and each person's entered SS gets no actuarial reduction
   or delayed-retirement credit for claim age - changing the claim age moves only WHEN, never HOW MUCH.
3. **~10 features** still absent from the feature list - QCD modeling, Future $ / Current $ toggle,
   nerdknob gating and how to reveal it, Marginal Heirs Tax Rate, the full milestones overlay, MC
   input-distribution charts, the Tax Planner handoff mechanics, share URLs omitting defaults.

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

## TPP-1..5 Tax Payment Planner backlog (2026-07-29) — TPP-3/4/5 DONE, TPP-1/TPP-2 OPEN

**Sequencing decided 2026-07-29** (plan file `C:\Users\starc\.claude\plans\calm-snacking-newt.md`):
three PRs, cheap and independent first. PR 1 = TPP-3 + TPP-4 + TPP-5, **MERGED as PR #138**
at v1.13be. PR 2 = TPP-1 (not started). PR 3 = TPP-2 (not started).
User decisions: TPP-2 output is a **priced menu with no winner named** (keeps the tool clear of
personalized tax advice); TPP-4 is a **single sticky footer button**, not a duplicate at the top.


Requested by the user after testing `RetirementTaxPlanner.html` v1.13b9 on branch
`worktrees/roth-conversion-withhold-replace-a9c195` (PR #136). That branch corrected the
Roth rollover rules, the replacement economics, business-day scheduling, IRC 7503 due-date
shifting, the 497%-over-withholding bug, and the two displayed plans that were not paying
the full liability. Everything below is new work on top of it.

Engine is `taxPaymentPlanner.js`; the HTML is a thin shell. Tests are `taxPaymentPlanner.test.js`
(**30 passing** as of v1.13c0, and runnable from the browser via `?runtests`).

**Sequencing and status.** An earlier session on `worktrees/planning-with-files-453213` proposed a
four-PR split (PR-T1..T4) and re-verified the specs against `e1ddb71`. The user then chose a
**three-PR** split, which is what shipped; that table is superseded by this one. The line counts and
the 27-test baseline from that session are also now stale.

| Item | Status | Ships as |
|------|--------|----------|
| TPP-3 run tests from browser | **DONE** v1.13be | PR 1 (#138) |
| TPP-4 compute button reachable | **DONE** v1.13be | PR 1 (#138) |
| TPP-5 dedupe note text | **DONE** v1.13be | PR 1 (#138) |
| Plan C legibility (found in testing) | **DONE** v1.13c0 | PR 1 (#138) |
| `T.NOTE` sub-notes never render (found in testing) | pending | PR 2 prep |
| `shFed`/`shState` miss the 6654(d)(1)(B) lesser-of | pending | PR 2 commit 1 |
| TPP-1 IRC 6654 penalty estimate | pending | PR 2 |
| TPP-2 priced remedies | pending | PR 3 |

Order rationale: TPP-2 prices remedies against "penalty avoided", so it cannot be built before
TPP-1 computes a penalty. TPP-3 landed first on purpose — a browser-runnable suite is the
verification surface for everything after it. The two items found while testing PR 1 are sequenced
ahead of the penalty engine because TPP-1's arithmetic depends on the safe-harbor rule being right,
and because the `T.NOTE` fix is what makes some of TPP-5's shortened notes visible at all.

Current plan file: `C:\Users\starc\.claude\plans\calm-snacking-newt.md`.

### TPP-1 — Estimate the penalty when the user is already late

`detectMissed()` already flags past-due installments and the UI says "PAST DUE", but never
says what it will cost. Quantify it.

IRC 6654 is interest-like, not a flat fee: per installment period, on the amount by which
that period's required installment exceeded what was credited by its due date, running from
the due date to the earlier of the date paid or the following April 15. Simple, not
compounded. Rate is the §6621(a)(2) federal short-term rate plus 3 points, redetermined
quarterly.

Pieces the engine already has: `dueDateFor` (IRC 7503 shifted dates), `shFed`/`shState`
(required annual payment via safe harbor), `FED_Q` weights, and the IRC 6654(g)(1) ratable
withholding credit, which must be applied here or the estimate will be far too high for
anyone using year-end withholding.

Missing, and the main design decision: **the rate table.** Rates are announced quarterly, so
hardcode the announced ones with an explicit documented fallback for quarters not yet
announced, cite the IRS quarterly-interest-rate page in `RULE_CITES`, and label the output an
estimate. Do not silently extrapolate.

Also implement the §6654(e) exceptions or the tool will invent penalties that do not exist:
no penalty where tax minus withholding is under $1,000, or where the prior year showed no
liability over a full 12-month year.

Scope: federal only in the first pass. State penalty regimes differ per state and the
`STATE_DB` has no rate data; say plainly that the state figure is not modeled rather than
implying the federal number covers it.

### TPP-2 — Remedies that actually reduce the penalty

Given the same facts, rank what the user can still do. The important asymmetry, which the
engine already understands but does not exploit for this purpose:

- **Extra withholding retroactively cures elapsed quarters** (IRC 6654(g)(1) credits it
  ratably across all four due dates). This is the strong remedy.
- **A larger quarterly payment does not.** Estimates are credited when paid, so front-loading
  helps future periods only and cannot repair Q1 in November.
- **Form 2210 Schedule AI** re-cuts each period against income actually received by then,
  which can erase the early-quarter underpayment outright when the income was genuinely
  late-year. Already narrated by the tool; here it becomes a scored option.
- **Reaching safe harbor** caps exposure regardless of the shape of the year.

For "take an extra IRA withdrawal and withhold it": model the self-defeat. Withdrawing `W`
and withholding all of it pays `W` toward the liability but adds `m·W` of new tax at the
marginal rate, so net progress is `W(1-m)` and closing a gap `G` needs `G/(1-m)` gross. That
is the same gross-up shape as `applyConversionGrossUp()` in `optimizer_core.js:1930`; reuse
the approach rather than deriving it again. Compare the grossed-up cost against the penalty
avoided and only recommend it when it actually wins.

### TPP-3 — Run the tests from the browser — DONE (v1.13be, merged PR #138)

`taxPaymentPlanner.test.js` is node-only: bare `require` at the top, `process.exitCode` at the
bottom. Make it dual-mode so `RetirementTaxPlanner.html?runtests` runs it.

Follow the existing pattern rather than inventing one: `optimizer_tests.js` defines a global
`runTests()` that logs to console and writes a pass/fail glyph into a `#testsFailed` element,
called from `retirement_optimizer.html:1129`. Differences to handle here: guard the `require`
for the browser, replace `process.exitCode` with a return value, and gate on the `?runtests`
param instead of running unconditionally. Render results on the page as well as the console,
since the request was to see them directly.

### TPP-4 — Compute button reachable without scrolling — DONE (v1.13be, merged PR #138)

`#compute` sits at `RetirementTaxPlanner.html:446`, at the bottom of a long input panel.
Duplicate it at the top. IDs must stay unique, so use a shared class or `compute-top` /
`compute-bottom` bound to one handler. Note the panel is collapsible (`.inputs.collapsed`
hides `.inputs-body` entirely), so check both states; a sticky button may serve better than
two copies.

### TPP-5 — Deduplicate the long-form note text — DONE (v1.13be, merged PR #138)

Measured on a dual-IRA dual-conversion scenario: **174 notes across the three plans, 69 of
them over 200 characters, 26,184 characters total.** Each boilerplate block repeats six times
(once per IRA per plan), and "Sooner is better" twelve times, since it rides both the
conversion and the restore action.

Move the long form into `RULE_CITES` entries and leave a short inline pointer. Candidates,
all in `taxPaymentPlanner.js`: the "IF YOU MISS THE 60 DAYS" block, "Relief is narrow", "This
completes a traditional-to-Roth conversion rollover", "The exclusion covers the CONVERSION
only", and "Sooner is better".

Constraint: the plain-text tab has no clickable anchors, so the pointer must name the tag in
a form that is findable by eye, e.g. `[see IRC 4973 in Rules and sources]`. Both `buildText`
and `buildHtml` need the treatment. Keep whatever is genuinely per-scenario (dollar amounts,
dates, the capped-withholding explanation) inline, since that is not boilerplate.

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
| **!** | **P38** | **Baseline/proportional strategies cannot fund their own tax bill — shipped defect** | **not started, HIGH — jumps the queue** | — |
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

**Existing placeholder:** `#tab-insight` exists with empty `#insights-table` at `retirement_optimizer.html:787` (line reference corrected 2026-08-01; it was cited as 711-719 and the markup has since moved). No code populates it.

**SURFACE COLLISION with P33.** P33 (Insights panel — statistics) claims the same `#tab-insight` surface for a *statistics* section. Recommendation on record: one surface, two sections — P33's numbers ship first because they have no rule-authoring risk, PE's narrative cards land above them later. Do not build a second panel.

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

## Phase P4: Creeping Tax Rate Model (was Phase 29)
**Why:** Tool assumes today's brackets persist forever. Future rate increases plausible. TCJA is now permanent but Congress can change rates. Default: off.

**Two options were scoped; only Option A shipped:**

**A. Rate Escalation — IMPLEMENTED, not yet found by user because it's nerdknob-gated.** Discovered 2026-07-26 via code grep (`Creep`) after the user flagged "implemented but not exposed." Built as `taxRateCreep` (% per year, federal) + `taxCreepStartYear` (calendar year, blank = plan's first year). Engine: `taxCreepFactor(rate, currentYear, startYear)` returns `(1+rate)^max(0,year-startYear)`; multiplies federal AND state bracket rates via `fedRateCreep`/`stateRateCreep` params threaded through `calculateTaxes()`/`computeBracketCeiling()`. **State creep is plumbed end-to-end in the engine but pinned at `taxRateCreepState: 0` in `getInputs()` (`optimizer_ui.js:249`) — no UI control exists for it yet**, per an explicit comment at line 245-246 ("Federal is the only knob today"). UI: "Fed Tax Creep" / "Creep Starts" row (`retirement_optimizer.html:378-380`, `#taxRateCreep-wrap`), hidden by default — `applyNerdKnobVisibility()` (`optimizer_ui.js:90-96`) shows it only when `NERD_KNOBS` is on OR a nonzero creep value is already loaded (leak-guard, same pattern as the conversion Stop-Year feature — a shared URL/scenario with creep set must never hide the control that explains it). Short URL keys `trc`/`tcy` wired (`optimizer_core.js:759-760`, `optimizer_ui.js:3235`). Sweep pass-through confirmed (`buildVariations` carries the fields). Logged per-year as `-fedRateCreep`/`-stateRateCreep` (log record).
- [x] Inputs: `taxRateCreep`, `taxCreepStartYear` (federal). `taxRateCreepState` exists in the engine, no UI input yet.
- [x] `calculateTaxes()`/`computeBracketCeiling()`: apply rate multiplier per year
- [x] Test: creep=0 → bit-identical to current (regression) — `optimizer_core.test.js:1652-1656`
- [x] Test: escalation compounding, before/after start year, fed-only vs state-only isolation, sweep pass-through, path-independence — `optimizer_core.test.js:1642-1754` (11 assertions total)
- [ ] Annual Details `taxRateMult`-style column (Debug/Tax Policy category) — not added; only the hidden `-fedRateCreep`/`-stateRateCreep` log fields exist, no visible column
- [ ] State-rate creep UI control (input + tooltip + short-key)
- **B. Pre-TCJA Cliff — NOT implemented.** No `BRACKETS_PRE_TCJA` constant, no `taxRateChangeYear`, no bracket-swap logic anywhere in the codebase (grepped clean). Original spec's second option, never started.
- **Status:** Option A done and NOW UN-GATED (2026-07-29, v11.13bd — see the nerdknob-graduation phase at the top of this file). The row is plain markup with no `display:none` and `applyNerdKnobVisibility()` no longer touches it. The two open sub-items above (Annual Details creep column, state-creep UI control) are still open and did NOT block un-gating: the federal control is finished and tested on its own. Option B untouched.
- **Independent:** modifies `calculateTaxes()` which is already isolated

---

## Phase P5: Greedy DP Conversion Schedule (was Phase 23b)
**Why:** Phase 23 implemented `optimizeConversionAmount()` as a scalar sweep. Per-year optimal conversion schedule (greedy DP) is deferred.

**UNBLOCKED — verified 2026-07-30, and it does not depend on P28.** The per-year lever already
exists: `_extraConvAmountFor` (`optimizer_core.js:1677`) reads `inputs.extraConversionAmount[y]`
whenever the input is an array, so a per-year schedule is expressible against today's engine with no
representation change. An earlier claim in the P28 discussion that the "unified conversion" reframe
was the precondition for a 1-D per-year search was wrong; the 1-D search is already available.

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
P24 (Conversion End Year) — independent; diagnostic + engine flag already exist
P27 (Assumption Sensitivity) — independent; every axis is already a getInputs() field
  └─→ (deferred) winner-stability grid — needs the MC worker
P28 (Unified conversion routing) — independent; research done, does NOT gate P5
```

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| ~~Phase 8 (Variable Growth grid) superseded~~ **REVERSED 2026-07-30, see P27** | The original rationale ("Bootstrap MC + Stress mode cover the use case") does not hold. MC randomizes returns AROUND an assumed mean and Stress varies the historical SEQUENCE; neither varies the mean itself, and neither varies lifespan or inflation at all. The use case was never covered. P27 rebuilds it as a current-plan tornado rather than the original grid |
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

---

## Phase P24: Conversion END YEAR — a searched stop-year, NOT the diagnostic's boundary year
**Why:** Stopping Roth conversions partway through a plan can beat both converting to the end and converting nothing. The 2026-07-23 evidence sweep (`findings.md`, harness `stopyear_harness.js`) established the shape of the win across 23 scenarios: `gainVsFull >= 0` in every one, up to +$2.97M, scaling hard with growth and longevity; delivered spend is identical across every cutoff (`spendRange` $0), so it is a clean wealth/tax comparison. The tool currently gives the user no way to act on this, and the closest existing lever (zeroing `extraConversionAmount`) is worse than the right answer because it also throws away the profitable early conversions.

**CORRECTION — the diagnostic's boundary year is NOT the answer.** The original P24 (2026-07-21, n=1) assumed the ⓘ boundary year was the year to stop. Sweeping every cutoff overturned it: in the recorded scenario the true optimum is **2031**, not the diagnostic's 2043 — off by 12 years and **$662k**. `diagnoseConvBreakEvenFailure` answers "which conversion erases the lead for good" (the last cutoff that still breaks even at all), which is a much weaker condition than max after-tax wealth. In no scenario did the boundary year equal the optimum, and in 10 of 23 the diagnostic never fires while stopping early still gained $99k–$2.97M. **So P24 is a searched stop-year feature, and the ⓘ boundary year must NOT be presented as a "stop here" suggestion — it would be systematically wrong.**

**Design consequences locked by the evidence:**
- **Search, don't heuristic.** Four candidate shortcut rules all failed (marginal-rate crossing, IRA-share threshold, RMD/age rule, terminal-mix target — see finding §6). The stop year must be searched per plan.
- **Linear scan only.** The cutoff curve is not unimodal (up to 7 sign flips; step-function brackets/IRMAA). Cost is a non-issue: k+1 runs, ~46ms for a 26-year plan.
- **Stop ALL conversions by default.** Extra-only truncation is much worse ($23.47M vs $24.23M) and never breaks even at any cutoff — the late damage is the strategy's own bracket-fill, not the Extra. Per user decision, ALSO model extra-only (the user notes it is what a naive user expects), but label clearly that it is the weaker of the two.
- **The gain must be shown next to any suggested year.** In low-tax states the win is only ~$100k and a stop year off by ±2 goes NEGATIVE — worse than not stopping. A bare year suggestion with no dollar figure is a trap.

**Tasks:**
- [x] New input, **nerdknob-gated** (per user, until fully investigated): conversion END year (`#convEndYear`). Accepts BOTH forms in one field — <4 digits = age of person 1, ≥4 digits = calendar year (e.g. "2044" or "75"); blank = convert for the whole plan. Engine reads a public calendar-year `convEndYear`, OR'd into `_convSuppressedThisYear` / new `_extraConvSuppressedThisYear` (kept the internal `_cfSuppressConversionsFromYear` index flag as the counterfactual/search mechanism — one gate, two feeders). Nerd-gate follows the tax-creep pattern: hidden unless nerdknob OR a value is set (a shared URL must never hide a live cutoff). `getInputs` parses age→`birthyear1 + age`.
- [x] Scope selector (`#convEndMode`, nerd-gated): "all conversions" (default) vs "extra only". Engine: `convEndMode !== 'extra'` suppresses both surplus + extra past the cutoff; `'extra'` suppresses only the Extra path (`_extraConvSuppressedThisYear`). No per-year array needed for the single-run path.
- [x] URL param + `OPT_LONG_TO_SHORT` entries (`cey`/`cem`); leak-guard in `runOptimizer` (`base.convEndYear = undefined; base.convEndMode = 'all'`, mirroring the existing `base.extraConversionAmount = 0`).
- [x] **Engine search** `bestConversionStopYear(inputs, {mode})` (pure, exported): linear scan over cutoffs scored on the shared `afterTaxWealthOfLogRow` basis (factored out of the Break Even block so the two can't drift). Returns `{stopYearCalendar, stopIndex, atnwStop, atnwNoStop, atnwNoConv, gainVsFull, gainVsNone, beAtStop, convertsNothingIsBest, neverStopIsBest}`. Strips any pre-set stop year so it always searches from full conversions.
- [x] **Diagnostic rewired** (`updateStats` + `formatStopYearMessage` + `applyConvStopYear` + `toggleBreakEvenDiagnosis`): the ⓘ now leads with the SEARCHED year + dollar gain (never the boundary year), surfaces whenever conversions occur (not just when Break Even is blank), and the expanded panel offers a one-click "Stop after YYYY ▸" that fills the field and re-runs. Boundary-year sentence demoted to secondary color, shown only when Break Even is blank. Always shows the dollar gain (findings §7).
- [x] Tests (`optimizer_core.test.js`, 6 new, 108/108): unset → bit-identical; all-mode cutoff == internal `_cfSuppressConversionsFromYear` and zeroes conversions after Y with earlier years untouched; extra-mode leaves strategy bracket-fill running past Y; `bestConversionStopYear` finds the interior optimum, dominates full+none, self-consistent when applied through the public input; search strips a pre-set stop year; `afterTaxWealthOfLogRow` matches the BE formula.
- [ ] **DEFERRED — Optimizer sweep dimension over the stop year** (user chose "measure cost first"). No per-row stop-year column ships this round because the leak guard strips `convEndYear` from every optimizer row; the calendar-year display contract is already met in the single-scenario surfaces (diagnostic message + one-click apply). When wired: measured cost is one k+1 linear scan per plan; the concern is multiplying it across the ⇌ candidate pool × the amount grid — the joint (amount × stop) grid is where the real value is (finding §3: C−D was +$228k to +$1.887M). Optimizer table then displays the stop as a **calendar year** even when entered as an age.
- **Status:** IMPLEMENTED and MERGED (v11.1330, confirmed present on `origin/main`). Node 108/108 + taxPaymentPlanner 12/12 at the time. Only the optimizer sweep dimension deferred.
- **Independent:** no phase dependencies; the diagnostic (PF6/PF5) and the counterfactual engine flag both already existed.

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

## Phase P26: README/FAQ cross-references from tooltips (pending, deferred 2026-07-28)

**Why:** several tooltips and banners restate material that already exists under `## Frequently Asked Questions` in `README.md` (anchored headings such as "Is It a Fool's Errand to Make Multi-Decade Projections?", "Is the Break-Even Tax Rate Trustworthy?", "Why does the Optimizer say converting never helps?"). Pointing at those anchors keeps one source of truth and shortens the in-app text.

**Needs:** a pass to decide which existing text has a matching FAQ entry, which needs one written, and where the link should land. The "where does the reader land" question is settled by P25: link at `README.md#<anchor>` and `doclinks.js` maps it to `/#<anchor>` on the live site while leaving the file link intact locally. Note kramdown's generated ids, not GitHub's: check the rendered `/` for the exact id before hardcoding one.

---

## Phase P27: Assumption Sensitivity, a tornado over the guesses (scoped 2026-07-30)

**Why:** every number this tool reports rests on three values the user typed into the sidebar and
cannot verify: `growth`, `inflation`, and how long they live. Nothing in the tool asks what happens
if those guesses are wrong. Monte Carlo randomizes returns *around* an assumed mean and the Stress
pass varies the historical *sequence*; neither varies the mean itself, and neither touches lifespan
or inflation at all (GBM inflation is a flat constant, `optimizer_core.js:921`). This phase reverses
the `Decisions Made` row that retired the old Variable Growth grid as "covered by Bootstrap MC" -
it was not covered, and the row has been rewritten to say so.

**Shape (settled with the user, 2026-07-30):** the CURRENT PLAN only, one axis at a time, rendered
as a tornado. Explicitly NOT the full winner-stability grid, and NOT a robustness column bolted onto
all 144 optimizer rows. Growth and inflation are INDEPENDENT axes: the real return is allowed to
move, because inflation does more in this engine than deflate (see below).

**Fixed plan:** the sidebar's own plan, captured the way `_runOptimizerNow()` captures `userPlan`
(`optimizer_ui.js:674`) - conversion switch, Extra Conversion and stop year all intact, none of the
three stripped the way swept rows strip them. Named with the existing `describeSelection()` so the
panel reads "Proportional 7%" like any table row.

**Axes.** Each is swept alone with every other field at its sidebar value.

| Axis | Field(s) | Grid |
|---|---|---|
| Asset growth | `growth` | base -3 .. +3 pp, 1 pp steps, floored at 0 |
| General inflation | `inflation` | base -1.5 .. +1.5 pp, 0.5 pp steps, floored at 0 |
| Medical inflation | `cpi` | base +/- 1 pp. Its own axis because `sim.medicareRate *= (1 + cpi + inflation)` (`optimizer_core.js:2192`) compounds it separately from everything else |
| Lifespan, person 1 | `die1` | base +/- 5, +/- 10 yrs |
| Lifespan, person 2 | `die2` | base +/- 5, +/- 10 yrs |
| Death ORDER | swap `die1`/`die2` | who goes first, at matched ages. Flips the household to Single filing at a different point, which is the largest single driver of conversion value in this engine |
| SS haircut | `ssFailPct`, `ssFailYear` | 0 / 23% / 30%, plus the year pulled 5 yrs earlier |
| Tax policy drift | `taxRateCreep`, `taxCreepStartYear` | 0 / 0.5 / 1.0 pp per yr |

Every one is already a plain `getInputs()` field (`optimizer_ui.js:339-407`) and `simulate()` is
pure, so a cell is literally `simulate({ ...base, growth: r })`. No engine change is required for
any axis. Two axes the user considered and declined, recorded so they are not re-proposed as new:
`futureIRATaxRate` (it is the SCORING assumption, not a world assumption) and state-of-residence.

**Scoring - the part that must not be got wrong.** Cells are not comparable in dollars; see the
findings entry "An assumption sweep cannot be scored in dollars". Each cell therefore runs the plan
TWICE - as configured, and again with `convertExcessToRoth:false` / `extraConversionAmount:0` - and
the tornado bar is the WITHIN-CELL difference in `baselineScoreOf()` (`optimizer_core.js:2703`),
the same after-tax, inflation-deflated, spendable-weighted measure the optimizer table already ranks
on. Secondary per-cell readouts: whether `totals.success` flips, and whether the plan's rank inside
its own family moves. Raw ending-wealth deltas ACROSS cells are out of scope and must not be drawn.

**Guards:**
- Clamp `die1`/`die2` to at least the person's current age. `maxYears` is derived from them
  (`optimizer_core.js:2220`) and must never go non-positive.
- Skip the `die2` and death-order axes when `hasSpouse` is false. `simulate()` already zeroes
  person 2 at `optimizer_core.js:2198`, so those cells would be silent duplicates.
- AL, MT and OH have `INFLATION_INDEXED:false`. Their brackets are frozen at `taxengine.js:1089`
  while their standard deduction inflates unconditionally at `taxengine.js:1349-1351`, so the inflation
  axis amplifies that known bug into a visible trend line. Disclose it in a NOTE on the axis, or
  suppress the axis for those three states. Do not ship it silently.

**Placement and cost:** new pure `sweepAssumptions(base, axes)` in `optimizer_core.js`, added to
the UMD export list at `optimizer_core.js:3328` so it is node-testable the way
`bestConversionStopYear` is. Rendering in `optimizer_ui.js`. About 45 grid points x 2 runs is ~90
`simulate()` calls, against the ~150 the optimizer already runs synchronously in ~1.3s. Reuse the
`_optBusy*` indicator (`optimizer_ui.js:596-666`) and stay on the main thread: no worker, no
chunking, no progress bar.

**Reuse, do not rebuild:** `baselineScoreOf`, `afterTaxWealthOfLogRow` (`optimizer_core.js:2499`),
`describeSelection`, `rankRowsByObjective`, the `_optBusy*` helpers. The ⚖ compare and 📍 pin
machinery is NOT needed - this panel has exactly one plan, so there is nothing to pin against.

- [ ] `sweepAssumptions(base, axes)` in optimizer_core.js, pure, UMD-exported
- [ ] Axis definitions + the two guards (age clamp, no-spouse skip)
- [ ] Within-cell paired scoring (configured vs no-conversion) on `baselineScoreOf`
- [ ] Tornado render in optimizer_ui.js, reusing `_optBusy*`
- [ ] AL/MT/OH inflation NOTE or axis suppression
- [ ] node tests: age clamp, no-spouse skip, and that a zero-width axis returns a zero bar
- **Status:** scoped, not started
- **Independent:** no phase dependencies

**DEFERRED follow-on, named here so it is not lost:** the winner-stability GRID - run the whole
strategy sweep at each of 3x3 assumption corners and report which family wins per cell. That is the
question the tornado cannot answer ("is my winner an artifact of my guesses?"), it costs ~9 x 150
simulations so it needs the worker, and it is the natural successor to this phase.

---

## Phase P28: "Every voluntary IRA withdrawal is a Roth conversion" (2026-07-30) — RESEARCH DONE, feature decision open

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

- [x] Harness with identity / degeneracy / divergence / mechanism sections and scored predictions
- [x] Two engine flags, default off, `ordered` excluded from both
- [x] `-unifiedConvGross` / `-unifiedRothSpend` hidden log keys (do NOT reuse `rothConv`)
- [x] Verified: node 148/32/22, in-page 242/242, browser A/B confirms routing 0 diffs / Roth-first 627
- [x] **ROUND 2 (2026-07-30):** second scenario set run — 5-scenario ladder x 6 families x 7 arms.
      Explains round 1's inconsistent sign and fixes it. `rothGapFill` now takes a POSITION:
      `true`/`fillRothThenCash` (ahead of everything) or `fillCashThenRoth` (Cash, then Roth, then Brokerage).
      `fillCashThenRoth` never destroys value in any of 20 comparable cells, where `fillRothThenCash` lost up to
      $137,062. Full detail in `findings.md`, "P28 round 2".
- [ ] **DECISION OPEN:** ship `rothGapFill: 'fillCashThenRoth'` as a real option, drop the routing
      flag (inert in all 30 scenario x family cells), or delete both. The routing flag earns its
      keep only if the Annual Details reframe is wanted as a *view*, which `-unifiedConvGross`
      already makes possible.
- [ ] If shipping: it is a per-family effect, not a global one. Proportional draws Brokerage in
      `planPrimaryWithdrawals` so the gap-fill order is not its lever, and Guyton-Klinger is not
      comparable at all (its guardrails re-cut spending). Ship it for the gap-filling families or
      as an optimizer sweep dimension, not as one global switch.
- [ ] No heuristic predicts the payoff from the account mix — both candidate shortcuts were scored
      and failed. If it ships, the tool has to RUN it, the same conclusion P24 reached about the
      stop year.
- [x] **ROUND 3 (2026-07-30):** answered "does `convertExcessToRoth` ever lose on its own?" — **yes,
      13 of 25 cells, worst -$1,095,454**, for the same Cash-buffer reason plus a hidden
      withdrawal-timing flip. Added `forceWithdrawTiming` (research input, default off) to separate
      the two. Full write-up now lives at `.test_harnesses/P28_RESULTS.md`.
- [ ] **SPUN OFF, needs its own phase:** `convertExcessToRoth` is a DEFAULT-FACING switch that can
      cost >$1M in plausible account mixes, and part of that is the early/late withdrawal-timing rule
      keying off `rothConv` — invisible and uncontrollable from the UI. Decide whether timing should
      key off conversion at all. This is a live product question, not a research curiosity.
- [x] **ROUND 4 (2026-07-30):** spend rate added as a CONTROLLED AXIS (4/6/8% of assets) after the
      user spotted the goals were high. Round 2 had confounded mix with strain (defaults sat at 8.6%,
      the rest near 4.4%). 630 sims, ~1.2s. **Three earlier conclusions overturned** — payoff peaks
      at 6% spend rather than growing with Brokerage share, "IRA Draw is unreachable" was
      strain-specific (+$1,200,484 at 6%), and `fillCashThenRoth` DOES have one negative cell. Mechanism
      came out sharper: every cell whose control never drew Brokerage returns exactly $0.
- **Status:** research complete (4 rounds), feature not started
- **Independent:** no phase dependencies

---

# Batch added 2026-08-01: P29-P34

Six phases from a user punch-list. **Four of them touch questions this repo has already partly
answered, and two were answered NO.** Each carries an explicit "Already ruled out" block; that block
is as much the deliverable as the task list, and it exists to stop a re-derivation of P24 and P28.
Recommended run order is rows 31-36 of the Priority Order table above (P33, P34, P30, P32, P31, P29),
not phase-number order.

---

## Phase P29: Hebeler Autopilot — is a second dynamic-spend rule worth a strategy slot?

**Why:** Guyton-Klinger is the only dynamic-spend rule in the tool (`optimizer_core.js:1203-1228`)
and it has exactly one shape: a deadband against a **frozen** initial withdrawal rate. `sim.gkIWR` is
derived once at y=0 (`optimizer_core.js:1205`) and never re-based, so an unlucky year-0 portfolio pins
the rate for the whole plan, and GK never consults age. Hebeler Autopilot is a 50/50 blend of an
**age-driven** RMD-method divisor and last year's inflation-adjusted spend — self-correcting, with no
memory of the initial rate. Structurally the opposite of GK, so on paper the two are not redundant.

Every piece of state a Hebeler branch needs already exists: `sim.prevPortfolio`
(`optimizer_core.js:2271`) is the denominator, `sim.spendGoal` carries prior-year spend, and
`yr.yearInflation` (`optimizer_core.js:930`) is the CPI leg. It slots into `resolveSpendTarget` beside
the GK block. GK's 4th classic rule (portfolio management / withdrawal sourcing) is **not**
implemented — GK falls through to the baseline proportional branch
(`optimizer_core.js:1398-1406`) — so a Hebeler branch inherits identical sourcing and gives a clean
spend-rule A/B with no confound.

**OPEN DECISION, must be settled IN THIS PHASE before any code is written (user chose to leave it
open, 2026-08-01).** The divisor. `RMD_TABLE` (`taxengine.js:976-983`, labelled "Uniform Lifetime
Table (Simplified)") runs ages **72 to 120 with no gaps** — verified. `getRMDPercentage`
(`optimizer_core.js:55-62`) returns 0 below the RMD start age and clamps above 120. There is no
single-life table, no Table I, and no pre-72 extension anywhere in the repo. A plan starting at 60 has
no divisor for its first 12-15 years, which is exactly the window this tool exists for. The three
options, to be decided rather than discovered mid-implementation:

- **(a) Extend the table downward.** Means adopting a *different* IRS table — Uniform Lifetime starts
  at 72 by construction. Owns a new data source and compounds "abridged Uniform-Lifetime-only RMD
  table", already on the deferred README caveats list (see the caveats phase above).
- **(b) Derive from the plan's own `die1`/`die2`:** `divisor = max(1, plannedDeathYear - currentYear + 1)`.
  Self-consistent with `maxYears` (`optimizer_core.js:2220`), no new tax data, no false precision, and
  the user already told the tool when they die.
- **(c) CPI leg only until RMD age.** Simplest, but it makes Hebeler identical to inflation-indexed
  fixed spend for 12-15 years and therefore measures nothing in the window that matters.

**Falsifiable questions:**
- **Q1.** Does the Hebeler spend path differ from GK by more than noise, sourcing held fixed? Metric:
  max per-year `|spendGoal_H - spendGoal_GK|`, plus the count of years differing by >1%.
- **Q2.** Does the difference move the score the tool actually ranks on? Metric: `baselineScoreOf`
  (`optimizer_core.js:2799`) and `totals.success`, within scenario.
- **Q3.** Is any advantage the *age term* or the *50/50 damping*? Third arm at 100% RMD leg (pure RMD
  method). If pure-RMD equals Hebeler, the blend is decoration.
- **Q4.** Does divisor choice (a/b/c) change the ranking? If yes, the phase cannot ship without
  settling the data question first.

**Scoring rule that must not be got wrong.** A spend rule changes delivered spend, so wealth alone is
meaningless — a rule that ends richer by spending less has won nothing. P24's stop-year sweep was a
clean wealth comparison *only because* delivered spend was identical across every cutoff (`spendRange`
$0, findings.md §2). That does not hold here. Report spend and wealth as a **pair**, within scenario,
and apply P27's rule that assumption-style sweeps are not comparable in raw dollars across cells.

**Already ruled out — do not re-derive:**
- "Does dynamic spending beat static" in general. Not the question; GK already ships.
- Any sourcing rule as part of Hebeler. GK's 4th rule is deliberately absent, and sourcing belongs to
  P30/P32. This phase touches `resolveSpendTarget` only.

**Tasks:**
- [ ] **Settle the divisor decision (a/b/c)**; write the choice AND the rejected options into this phase
- [ ] Research input `spendRule: 'gk' | 'hebeler' | 'rmdpure'`, default unset = bit-identical, no UI (the P28 research-flag pattern)
- [ ] Hebeler branch in `resolveSpendTarget` beside `optimizer_core.js:1203`; log keys mirroring `gkSpend`/`gkAdj` (`optimizer_core.js:883-884`)
- [ ] Harness with predictions stated up front and scored
- [ ] Scenario ladder: reuse P28's 5-mix x 3-spend-rate ladder
- [ ] Paired spend/wealth reporting; never a bare wealth delta
- [ ] Add as a sweep arm next to the single GK arm (`optimizer_ui.js:846`); check whether it ever outranks GK
- [ ] Decision: ship as a strategy, ship nerdknob-gated, or record and drop
- **Status:** not started, research-first. **Harness:** `.test_harnesses/hebeler_harness.js` (node)
- **Independent:** no phase dependencies. Adds one sweep arm, so it interacts with P34's run budget.

---

## Phase P30: Withdrawal policy — the constants nobody chose, and whether strategy should imply order at all

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
  (`.test_harnesses/README.md:79-81`) predicts the weight is inert wherever Brokerage is never touched.
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
- Roth's position in the gap fill. P28 rounds 2+4, 630 sims, `fillCashThenRoth` established. What
  remains there is a **ship** decision (P28's open checkbox), not research.
- Whether the three shipped `orderedSeq` sequences matter — already swept (`optimizer_ui.js:841`).
- The unified-conversion reframe — measured inert, 0 money fields moved in 90 cells.

**Tasks:**
- [ ] `gapFillWeights` research input, default `[40,60]`, no UI, `ordered` excluded
- [ ] Harness: weight sweep x P28 mix/spend ladder x gap-filling families; predictions scored
- [ ] Q2 arm: bracket-family order Brokerage-before-Cash as an explicit alternative
- [ ] Q4 arm: the remaining orderings of four accounts, harness-only
- [ ] Q5: cost the decoupling (new input vs derived), count affected rows, do NOT build yet
- [ ] Report against P28's zero-predicate: split cells by "did the control ever draw Brokerage"
- [ ] Decision: change the default, expose a control, decouple, or record that the constant is inert
- **Status:** not started, research-first. **Harness:** `.test_harnesses/gapfill_harness.js` (node — a
  new file, NOT an extension of `unifiedconv_harness.js`, which is already a four-round document with
  `P28_RESULTS.md` as its reference)
- **Depends on:** no code dependency. Its *ship* decision is downstream of P28's open decision —
  settle both in one batch or the weight question shifts underneath it.

---

## Phase P31: Asset mix is an OUTPUT — the reverse mapping, asked honestly

**Why — and this phase must lead with the prior finding.** The question as literally posed ("what asset
mix target is ideal for a given spend level") **was already asked in this repo and answered NO.** P24
§6 (findings.md:515-533) tested a terminal-mix target as a stop-year heuristic and it failed: taxable
share is fairly stable at 43-48% of after-tax net worth, but pre-tax net ranges 3-71% and Roth 0-68%.
The recorded conclusion is that the optimal mix is an **output of the search, not an input to it**.
Re-running that is forbidden.

The user's *actual* question is the **reverse mapping**, and it has never been asked: given a mix you
want, which strategies get you there? That is descriptive, over a sweep the tool already runs. Every
one of the ~177 rows already carries its terminal mix — `totals.terminal`
(`optimizer_core.js:2535-2541`) holds `{ira, roth, cash, brokerage, basis}`, and `_afterTaxBuckets`
(`optimizer_core.js:2855-2862`) already collapses it to the three tax buckets. The only consumer is
the `taxflex` objective (`optimizer_core.js:2863-2884`), which sorts on `spread()` and **never
displays it**. The tool computes this for every row and shows the user none of it.

**Bound on any possible answer — state it out loud in the deliverable.** There are **no contributions**
in this engine. No wage, salary or savings input exists; the only money in is SS + pension
(`yr._yearInflows`, `optimizer_core.js:2232`). A user cannot "get to" a mix by saving differently
inside this tool. The only levers on the terminal mix are conversions, withdrawal sourcing, and spend
level.

**Falsifiable questions:**
- **Q1 (make-or-break).** Is the terminal mix predictable from the strategy family? For each family,
  compare the spread of its terminal mix **across** scenarios against the spread **between** families
  at a fixed scenario. If within > between, "pick strategy X to get mix Y" is unanswerable and the
  deliverable is a disclosure, not a control.
- **Q2.** Which input moves the mix most — family, conversion amount, or stop year? The prior from P24
  §6 (Roth share 0-68%) says conversion amount. If conversions dominate, the honest answer is "your
  conversion policy sets your mix, and the tool already searches that," and the deliverable is a
  *display*.
- **Q3.** Does spend level change the answer? The user asked "for a given spend level," and P28 round 4
  overturned three conclusions once spend rate was controlled. Spend rate is a controlled axis **from
  the start here**, not added in a later round.
- **Q4.** Is any mix *unreachable*? A negative result ("nothing in the reachable set exceeds X% Roth at
  8% spend") is directly useful and cheap to extract.

**Already ruled out — do not re-derive:**
- Terminal-mix-as-target (findings.md:515-533). Do not propose a target-mix objective or any mix-based
  heuristic.
- Two account-mix shortcuts, both scored and both failed to *rank* (findings.md:962-966): Brokerage
  share, and `min(Brokerage drawn, Roth held)`. The payoff is **non-monotone** in Brokerage share — it
  peaks at balanced thirds ($1,757,386) and falls at 62% ($778,677).
- The one rule that survived is a **zero-test, not a ranking**: every cell whose control never touched
  Brokerage returns exactly $0. It prunes; it cannot order.

**Tasks:**
- [ ] Harness reusing P28's mix x spend-rate ladder wholesale
- [ ] Per-row terminal mix extracted via `_afterTaxBuckets` — reuse, do not recompute
- [ ] Q1 within-vs-between variance test, reported as a number
- [ ] Q2 attribution across family / conversion amount / stop year
- [ ] Q4 reachable-set boundary per spend rate
- [ ] **If Q1 is yes:** Mix column in the optimizer table plus a mix readout in P33's Insights panel.
      **If Q1 is no:** publish the finding and, at most, surface `taxflex`'s `spread()` so the user can
      see what that objective already optimizes silently
- **Status:** not started, research-first. **Harness:** `.test_harnesses/assetmix_harness.js` (node)
- **Independent:** no research dependency. Its display half lands on P33's surface.

---

## Phase P32: Brokerage is barely drawn — why, and is the third-pass exclusion still right?

**Why:** three observations converge on one place. (1) The user reports Brokerage draws not occurring
as expected. (2) The repo has already measured that this is load-bearing: every cell whose control arm
never touched Brokerage returns exactly $0 (`.test_harnesses/README.md:79-81`, findings.md:1057-1062).
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
- [ ] Q1 scan FIRST — it may reframe everything that follows
- [ ] Audit the two accounting facts (`:743` dividend-rate exclusion, `:1152` pre-withdrawal accrual) before running any behavior arm
- [ ] Research inputs, default off, P28 pattern: `thirdPassBrokerage` ('off'|'bounded'), `forcedIRAAllowBrokerage`, `cycleHarvestMode` ('maxbracket'|'spendonly')
- [ ] Q2 with an explicit iteration counter, so "spiral" becomes a measured claim either way
- [ ] Q3/Q4 as scans over existing sweep output
- [ ] Record the aggregate-basis modeling ceiling as a README limitation regardless of outcome
- [ ] Decision: re-scope the third-pass exclusion, un-gate `cycleLTCGTarget`, or record and keep
- **Status:** not started, research-first with a likely build tail. **Harness:**
  `.test_harnesses/brokerage_harness.js` (node), results to a sibling `.md` if large
- **Depends on:** shares the gap-fill path with P30. Sequencing preference, not a hard dependency: run
  P30 first so the `[40,60]` question is settled before the third-pass arms move the same numbers.

---

## Phase P33: Insights panel — where the money came from

**Why:** the stats bar answers "how much" and never "from where." All ten tiles
(`retirement_optimizer.html:419-433`) are a level or a rate — taxes, spend, end wealth, funded years,
withdrawal rate, break even, stress. None is a decomposition. The user's example (share of lifetime
spend from growth vs starting assets) is exactly the missing axis, and the raw material is already
computed and thrown away: `applyGrowth` returns per-account gains (`optimizer_core.js:468-483`), the
two per-year calls are merged at `optimizer_core.js:2135` so `yr.gains` is full-year earnings per
account, and the asset-flows chart already sums them (`optimizer_ui.js:3275`) — per year, chart-only,
never accumulated to a lifetime total, never in `totals`.

**This is the only build-first item of the six.** Nothing here is a question about the world; it is
arithmetic over fields that already exist. The risk is not correctness, it is labelling and surface.

**Surface (user decision, 2026-08-01): a separate Insights panel, NOT the stats bar.** The stats bar
already holds ten tiles and a slate this size would not fit.

**SURFACE COLLISION — resolve before building.** `Phase PE: Insights / Feedback Panel` (above,
pending) already claims that surface for *narrative* cards with severity levels. The placeholder is
live: `#tab-insight` with an empty `#insights-table` at `retirement_optimizer.html:787`.
Recommendation on record: **one surface, two sections** — P33 ships the statistics section, PE later
adds narrative cards above it. P33 goes first because it has no rule-authoring risk. If a true modal
is wanted instead of the existing tab, that is a one-line change to where `renderInsightStats()`
mounts, not a second panel.

**Labelling decision, to be made before anything ships.** "Growth" as logged is **not** appreciation.
`yr.gains` includes dividends (`optimizer_core.js:2139` when DRIP is on, `:2143` to Cash when off) and
`cashG` includes cash yield. Decision: name the headline **Earnings** and define it, then break
dividends and interest out separately in the panel, which has no character limit. `yr.taxableDividends`
and `yr.taxableInterest` are both already per-year fields.

**Second decision, which is what makes the user's statistic well-defined.** There are **no
contributions** in this engine — no wage, salary or savings input exists. So a sources-of-lifetime-spend
decomposition has exactly three terms and they close: **starting balances**
(`optimizer_core.js:2301-2305`) + **investment earnings** (sum of `yr.gains`) + **guaranteed income**
(sum of `yr._yearInflows`, `optimizer_core.js:2232`). Conversions and reinvested surplus are internal
transfers and must not appear as sources. Say so in the panel.

**The slate.** The panel is its own surface, so the full set is in scope.

| Statistic | Definition | Computed from |
|---|---|---|
| **Growth-funded %** (the user's ask) | earnings / (earnings + starting balances + inflows) | new `totals.earnings` from `yr.gains`; starting balances `:2301-2305`; new `totals.inflows` from `yr._yearInflows` |
| Lifetime earnings | sum of per-account gains, broken out per account | `yr.gains.{IRA1,IRA2,Roth1,Roth2,Brokerage,Cash}` — mirrors log keys `-iraG`/`rothG`/`brokerageG`/`cashG` (`:852-856`) so panel and chart cannot disagree |
| Guaranteed-income share of spend | inflows / `totals.spend` | `totals.spend` (`:2150`), new `totals.inflows` |
| Terminal mix | preTax / Roth / taxable as three percentages | `_afterTaxBuckets` (`:2855-2862`) — exists, is correct, currently only sorts `taxflex` |
| Realized LTCG | sum of `yr.capitalGains`, plus the share realized at 0% | **accumulate at ONE point only, after the last recompute** — it is recomputed at `:1417`, `:1560`, `:1630`, `:1660` and naive accumulation double-counts |
| Converted total / share of starting IRA | sum of `yr.totalConverted` / starting IRA | accumulate on the `totals` side. **Do not add a log key** — P28 established `rothConv` is engine state, `beginYear` reads `log[y-1].rothConv > 1000` to pick withdrawal timing |
| Brokerage drawn (zero is meaningful) | sum of Brokerage withdrawals | P28's zero-predicate made user-facing: "this lever is inert for you" |
| Cash-reserve breaches | count of years with `yr.cashBreach` | `optimizer_core.js:1677-1688` — a real failure signal with no surface today |
| Forced IRA total | `totals.forcedIRATotal` | **already in `totals` at `:2317`, displayed nowhere** |
| ACA breach years | `totals.acaBreachYears` | **already in `totals` at `:2317`, displayed nowhere** |

The last two are the cheapest win available and are task #1 — zero engine change.

**Optional extras the user named (2026-08-01):**
- **Per-asset computed log column** in Annual Details. Cheapest useful one: a per-year `Earnings`
  column (the four `*G` fields summed), and/or making `-iraG` visible. Costs **four** registration
  points and getting fewer than all four is how a column silently vanishes: emit in
  `buildSimYearLogRecord` (`optimizer_core.js:750-889`), `columnCategories`
  (`optimizer_ui.js:1838-1935`), `columnGroupDefs` (`optimizer_ui.js:1938-1966`), tooltips
  (`optimizer_ui.js:2171-2222`). This file's own Known TODOs already lists two suspected
  column-registration bugs, so it is a live failure mode.
- **New chart.** Five views exist — combined, tax, net, flows, assetflows (`optimizer_ui.js:3133`). A
  sources-of-spend stacked area would be a sixth, reusing `earn()` at `optimizer_ui.js:3275`. Global
  `Chart.defaults` rules apply: no per-chart tooltip colours, no per-chart `labelColor`.

**Bit-identity guarantee.** Every item is accumulate-only. `simulate()` behavior must not change; the
regression is that a fixed scenario's log and existing totals are unchanged apart from the new keys.
Initialize new `totals.*` keys in the literal at `optimizer_core.js:2317`, not lazily — the lazy
`totals.medicare` at `:2148` is the exception, not the model. Check `montecarlo/mc_tab.js` for
`undefined` handling first.

**Tasks:**
- [ ] Resolve the PE surface collision (recommendation: one surface, two sections)
- [ ] Surface `forcedIRATotal` + `acaBreachYears` — already computed, zero engine change
- [ ] `totals.earnings` + `totals.inflows` accumulators, plus a node test asserting `totals.earnings`
      equals the sum of the chart's per-year `earn()` (`optimizer_ui.js:3275`) — the two must agree by
      construction
- [ ] `computeInsightStats(totals, log, inputs)` in core (pure, UMD-exported, node-testable) +
      `renderInsightStats()` in UI
- [ ] Growth-funded % with the dividends/interest caveat stated in the panel
- [ ] Terminal mix via `_afterTaxBuckets` (reuse, do not recompute)
- [ ] Realized-LTCG accumulator at a single site; test against a scenario with a known harvest
- [ ] Brokerage-drawn total and cash-breach count
- [ ] Optional: per-year `Earnings` column — all four registration points
- [ ] Optional: sources-of-spend chart as a sixth view
- [ ] Empty state before the first run; no MC coupling, `#stat-stress` untouched
- **Status:** not started, **build-first**, no harness
- **Independent:** no phase dependencies. Shares a surface with PE; P31's mix display lands here if it
  ships.

---

## Phase P34: The cost of finding a profitable conversion — where the time actually goes

**Why — the honest answer up front:** the search itself probably cannot be shortened safely. Every
heuristic tried in this repo has failed, several of them *silently*. But the search is also not where
most of the wall clock goes. The two largest structural costs are not algorithmic: the optimizer sweep
runs **entirely on the main thread** and blocks it for 0.8-2.5s (only Monte Carlo uses a worker), and
the cache is a **single all-or-nothing hash** (`optimizer_ui.js:692-701`, key state
`_lastOptimizerHash` at `:541`) — one character in any sidebar field re-runs all ~177 rows. There is no
per-row memo, no `simulate()` memo, no shared-prefix reuse across cutoffs, no incremental
re-simulation. Those two are worth more than any heuristic and **neither can produce a wrong answer**.

**Tier 1 — zero risk of a wrong answer. These change WHEN work happens, not WHAT is computed:**
1. **Move the sweep to a Web Worker.** `optimizer_core.js` is DOM-free by contract (`:4-9`), so it is
   portable in principle. **One real blocker, named:** `simulate()` mutates two module globals —
   `simulationCount` (`:2306`) and `STATEname` (`:2307`). `STATEname` is a genuine hidden dependency;
   two workers on two states would race. Also `new Date().getFullYear()` is read when `startInYear` is
   unset (`:1715`, `:2309`, `:2322`), so a worker must be pinned to the same year or results differ
   across midnight. Payoff: the UI stops freezing. Total CPU unchanged.
2. **Split the cache in two.** The hash is *already* computed in two pieces — `base` is hashed AFTER
   the conversion fields are stripped, with a `;cur=` tail re-adding them. That is one step from a
   two-level cache: the 44-arm no-conversion sweep does not depend on conversion fields at all, so
   typing in Extra Conversion should not re-run it. **Risk to control:** cache-key omission — a field
   not in the key but read by `simulate()` yields a stale row, the silent-wrongness class. Mitigation
   is mechanical and is a required task: assert the key covers every field `getInputs()` produces, with
   a test that fails when a new input is added. This exact mechanism already caused a near-miss
   (findings.md:65, verified live $564,869 → $983,705).
3. **Stop calling `bestConversionStopYear` eagerly.** It runs on every `updateStats()` whenever
   conversions occurred (`optimizer_ui.js:2509-2513`) — a per-keystroke-debounce path — at n+2 sims
   (~46ms for a 26-year plan), to fill a tooltip the user may never hover. Make it lazy on
   hover/expand, or reuse the last result when the input hash is unchanged. Zero risk.
4. **Memoize `simulate()` on an input hash.** None exists anywhere. Within one sweep the same inputs
   recur (no-conv baseline arm, OC re-runs, counterfactuals). **Measure the hit rate before building**
   — it may be near zero, and that measurement is the deliverable.

**Tier 2 — bounded risk, must be diffed against the sweep it replaces:**
5. **Coarse-to-fine on `optimizeConversionAmount`** (`optimizer_core.js:3016-3049`). This is the **one
   pre-authorized** optimization already on record in this file (PF11: "$5M+ IRAs cross the run budget
   (~2624 runs) → open a coarse-to-fine ($100k coarse then $25k refine) phase if a user hits it").
   Cost today is `ceil(totalIRA/25000)+1`, measured exactly 17 / 81 / 201 sims at $400k / $2M / $5M.
   **The risk is real and already documented:** findings.md:85 is exactly this failure — a coarse
   8-point evenly-spaced amount grid **silently invented wrong answers**, reporting "never pays up to
   75%" when the true answer was 48%, and 25% against a true 15%, because paying amounts are only ~16%
   of the IRA and an even grid steps straight over them. $100k coarse on a $5M IRA is a 50-point grid,
   not an 8-point one, and the refine window must be wide enough to recover the *neighbors* of the
   coarse winner, not merely bracket it. Acceptance is not "it is faster" — it is a **diff against the
   full sweep on several scenarios** (findings.md:88), including both known traps.
6. **Early exit on a declining score in `optimizeConversionAmount`.** There is none today. Tempting,
   and dangerous for the same reason P24 §7 recorded on the cutoff axis (findings.md:535-546: 1-7
   first-difference sign flips, 7 at growth 10%). **Whether the AMOUNT axis is unimodal has never been
   measured.** That measurement is a legitimate task and a hard prerequisite: no early exit ships
   without it, and if the axis is not unimodal the answer is no.

**Tier 3 — ruled out, do not propose:**
- Binary or ternary search on the **cutoff** axis (findings.md:535-546) — not unimodal, converges on
  the wrong answer **undetectably**. Cost was never the argument for the linear scan; it is 46ms.
- Any stop-year heuristic (P24 §6, findings.md:515-533): marginal-rate crossing **pins at 33.3% in
  every year and cannot discriminate at all**; IRA share ranges 4-78%; age/RMD offsets run -15 to +14;
  terminal-mix target failed.
- "No IRA left at the end" as a skip filter (findings.md:86) — "looked obviously safe and lost the
  right answer on a $3.3M scenario (reported 25% against a true 5%)."
- Any account-mix ranking heuristic (findings.md:962-966).
- BETR as a screen (findings.md:559-585) — wrong in both regimes in opposite directions; the column and
  tile were already removed.

**The bar any Tier-2 item must clear, stated as a template.** `breakEvenHeirsRate()`
(`optimizer_core.js:3093-3126`) uses binary search **legally**, and only because monotonicity in the
rate axis was *measured* across five scenarios (findings.md:123-125) and is *pinned by a test*
(`optimizer_core.test.js:1856-1868`). Measure the axis property, then pin it with a test that fails if
the property stops holding. Nothing else qualifies.

**Two costs nobody has on a list, worth pricing here.** `bestTimeLimitedConversion`
(`optimizer_core.js:3141-3209`) at ~148 sims per candidate is **already capped at 6 candidates**
(`optimizer_ui.js:1047-1049`) because all 12 pushed one run to 2,216 sims past the 1,500-run budget —
that cap is a silent quality reduction, and Tier-1 wins may buy the budget back to restore it. And the
Break Even dual-sim (`optimizer_core.js:2455-2498`) is +1 sim per converting row (measured 1.96x /
+74ms on a 144-row sweep) whose second counterfactual `cfExcess` (`:2494`) fired on **0 of 144 rows**
(findings.md:53) — a candidate for removal or a cheap guard.

**Falsifiable questions:**
- **Q1.** Where does the time actually go? Predict the split from the inventory (~177 sweep sims, +12
  candidates x `ceil(IRA/25k)`, +6 x ~148 time-limited, +1 per converting row for BE), then
  instrument, then score the prediction.
- **Q2.** Is the conversion **amount** axis unimodal? (gate for Tier-2 item 6)
- **Q3.** What is the `simulate()` memo hit rate within one sweep? (gate for Tier-1 item 4)
- **Q4.** Does a two-level cache change any displayed number? The answer must be zero.

**Tasks:**
- [ ] **Baseline profile FIRST**, before P29/P31/P32 add sweep arms, so later phases have a comparison
- [ ] Q1 instrumentation with scored predictions
- [ ] Tier-1 #3 (lazy stop-year) — smallest, zero-risk, ship it standalone
- [ ] Tier-1 #2 two-level cache + the key-coverage test that fails when a new input is added
- [ ] Q3 memo hit-rate measurement; build the memo only if the rate justifies it
- [ ] Tier-1 #1 worker: resolve the `STATEname` / `simulationCount` module-global mutation and pin the
      current year, or record why it is deferred
- [ ] Q2 unimodality measurement on the amount axis; pin with a test if it holds
- [ ] Tier-2 #5 coarse-to-fine, **only** with a full-sweep diff on several scenarios including the
      findings.md:85 and :86 traps
- [ ] Re-check the 6-candidate cap on `bestTimeLimitedConversion` after Tier-1 lands
- **Status:** not started. **Research-first** on Q1-Q3 (harness `.test_harnesses/searchcost_harness.js`,
  node), **build-first** on Tier-1 items 1-3, which need no research
- **Depends on:** its measurement half should run **before** P29/P31/P32 add sweep arms; its build half
  last.

---

# Batch added 2026-08-03: P35-P37

A user design proposal for a **"Phased"** withdrawal strategy, its study, and one deferred phase.
Full design in the session plan file `C:\Users\starc\.claude\plans\composed-marinating-garden.md`;
the engine evidence is in `findings.md` under **"P35 engine survey"** (2026-08-03).

**Read the survey first.** It contains ten verified facts, several of which are traps where the
natural implementation lands on the wrong side and produces a plausible wrong answer rather than an
error. The sharpest one is item 1, restated here because it will otherwise be rediscovered the hard
way: **the engine's `isDeathYear` (`optimizer_core.js:1103`) is the FIRST SINGLE year, not the last
MFJ year.** `alive = age <= die`, so `age === die` is the last year both spouses live and the last
`'MFJ'` year; `age === die + 1` is what `isDeathYear` tests. A feature wanting the married window
needs the earlier year and a differently-named flag.

**Work is staged.** Each PR below is a review point. Nothing that moves numbers lands before the
harness that can measure it.

---

## P35 PR 3 REPLANNED as PR 3a-3d (2026-08-04) — user corrections plus a blocker found underneath them

Four corrections from the user reshaped the rest of P35. Investigating the third exposed a shipped
defect larger than any of them, so the single "PR 3" in the table below became four PRs.

| # | PR | Byte-identical | Status |
|---|---|---|---|
| 3a | `findUpperLimitByAmount` below the first bracket | **No** — 21 states + `minlimit` everywhere | **DONE 2026-08-04, v11.1447**, merged PR #147 |
| 3b | Medicare age -> `TAXData.IRMAA.ELIGIBILITY_AGE` | Yes — proven over 144 scenarios | **DONE 2026-08-04**, tokens `111448`, merged PR #149 |
| 3c | ACA cap lapses at 65 -> Proportional 0% | No — `aca` rows only, proven by control | **DONE 2026-08-05, v11.1462** |
| 3d | `Basis <= Brokerage` invariant | Yes for non-negative brokerage returns; no for MC | not started |
| 4 | `deathBasisStepUp: 'auto'` + `COMMUNITY_PROPERTY` + `survivorSpendPct` | **No, by decision** | blocked on 3d |

**The user's four corrections, and what each changed:**

1. **Step-up is per STATE law.** Community-property states get a FULL step-up on first death, and it
   should follow the existing spousal-IRA-takeover template at `optimizer_core.js:1035-1036`. This
   **replaces the recorded `deathBasisStepUp: 'half'` default** in P35's decision table below.
   Decided: `'auto'|'none'|'half'|'full'`, default `'auto'` -> `'full'` in a `COMMUNITY_PROPERTY`
   state, `'half'` elsewhere. **The cheap part nobody saw:** `'half'` and `'full'` ARE the ownership
   model (common-law joint tenancy vs community property), so no per-person brokerage attribution is
   needed at all. The 7 modelled CP states are AZ, CA, ID, NV, TX, WA, WI; LA and NM are CP states
   TAXData does not model; AK is excluded on purpose (opt-in by agreement, not default).
2. **100%-basis brokerage draws tax-free**, so gap-fill could order it like Cash or Roth. **Decided:
   observability only.** Ship `yr.capGainsPercentage` as a hidden `-` log key with PR 4 and change no
   ordering. The inference is isomorphic to P28's Roth-vs-Cash question, where reasoning cost
   $137,062 of terminal value once: zero tax on the *withdrawal* says nothing about the opportunity
   cost of the asset *retained*. Not committed to P30 either — left open, with the prevalence number
   now measurable.
3. **ACA should fall back to Proportional 0%** when all living spouses are 65+, and the 65 should come
   from TAXData. This **reverses the recorded "the constraint lifts outright" decision** below.
   Releasing outright makes the crossing year's draw depend on `curIRA`, an unbounded quantity — a
   cliff, not a policy. `propwd` at 0% is line-for-line the engine's fallback `else`, so the fallback
   is three conjunctions and no new branch.
4. **Run P36 before Phased lands.** Decided: run it **twice**. P36a now on the 8 shipped incumbents
   (no step-up, no `survivorSpendPct`, death timing dropped — it detects nothing without them); P36b
   after PR 4 with the full factor set and the Phased arms. Framing that must be written into the
   results file: frequency **cannot** justify deleting a shipped arm, only the zero test can, and any
   "ACA never wins" verdict is a measurement artifact because the tool prices the cap's cost and none
   of its benefit.

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

## Phase P35: "Phased" withdrawal strategy — one strategy that switches by life phase

**Why:** P13 (Multi-Strategy Segment Optimizer, row 15, pending since before the current batch)
proposes sweeping strategy-per-segment: 3 segments x ~42 strategies ~= 74k combos filtered to ~10k.
P35 answers the same need from the other direction — **one strategy that switches internally**, so the
search space grows by ~4 rows instead of ~10,000. If P35 ships and ranks well, P13 should be
explicitly retired rather than left pending.

**The user's design, and the refinement that makes it cheap.** Phases: 0 ACA (to 65), 1 IRA_CONTROL,
2 BALANCED, 3 FIRST_DEATH, 4 SURVIVOR, 5 LEGACY. The user then merged 1 and 2: *"for the portion of
the IRA above the target, do IRA control; if any shortfall still exists, use BALANCED."* That removes
the state machine, the two-way switch and the hysteresis question entirely — and it maps onto
machinery that **already exists**:

- `yr.curIRA = Math.max(0, IRA1 + IRA2 - yr.iraGoalNominal)` (`optimizer_core.js:1181`), computed every
  year after RMDs, before `planPrimaryWithdrawals`. This *is* "the portion above the target."
- `yr.iraGoalNominal = inputs.iraBaseGoal * sim.cpiRate` (`:920-921`) — the IRA Goal input already
  exists (`#iraBaseGoal`, `retirement_optimizer.html:189-192`, default $750,000, today's dollars,
  ungated, round-trips as `ibg`). **No new target input is to be invented.**
- `yr.additionalSpendNeeded` (`:1232`) is the BALANCED budget.

**IRA_CONTROL rules A and B collapse to one expression:**
`iraControlTarget = Math.abs(sim.prevIRAGain) * (1 + inputs.phasedControlPct)`.
The `Math.abs()` is load-bearing: a naive `prevIRAGain * (1+pct)` goes negative in a down year and
clamps to zero, the exact opposite of rule B. With the absolute value, a -$200k year and a +$200k year
both target $220k at 10%, so the IRA is drawn hardest precisely when conversion is cheapest. One knob
satisfies both rules and is the smallest thing that can be swept. **`sim.prevIRAGain` is new** —
`sim.gkPriorReturn` is assigned only inside the GK branch (`:2276-2277`) and is unreachable; but
`'-iraG'` (`:856`) already logs the quantity.

### Settled decisions (user, 2026-08-03)

| Decision | Value |
|---|---|
| Bundling | Phased **+ basis step-up together**; LEGACY split out as P37 |
| IRA target | Use the existing `#iraBaseGoal`; how it is *suggested* may change later, deferred |
| Phase 1/2 | **Merged** — per-year split on `yr.curIRA`, no hysteresis |
| ACA ceiling after 65 | ~~**None.** The constraint lifts outright~~ **REVERSED 2026-08-04** — it falls back to Proportional 0%. See the PR 3a-3d replan above |
| FIRST_DEATH ceiling | **None** — convert everything above the IRA Goal. No `phasedDeathBracket` input |
| `deathBasisStepUp` default | ~~**`'half'`**~~ **REPLACED 2026-08-04** by `'auto'` (state-driven: `'full'` in a `COMMUNITY_PROPERTY` state, `'half'` elsewhere). Still moves numbers. See the replan above |
| `survivorSpendPct` default | Ships at `100`; real default decided by P36 (80% flagged reasonable) |
| Sweep arm count | Decided by P36's evidence, not up front |
| Enumeration | **Extract** to `optimizer_core.js`, shared with `buildVariations()` |

### PR sequence

| PR | What | Byte-identical? |
|---|---|---|
| 1 | Characterization tests for both enumerations | Yes (tests only) |
| 2 | Extract `buildStrategyFamilies` + `OPTIMIZER_GRIDS`/`MC_GRIDS` to core | Yes — proven by PR 1 |
| 3 | ~~ACA post-65 cap release~~ **SPLIT into 3a/3b/3c/3d 2026-08-04**, see the replan above. 3a DONE | **No** — see the replan |
| 4 | `deathBasisStepUp` (default `'half'`), `survivorSpendPct`, `yr.isLastMFJYear`, `sim.prevIRAGain` | **No** — step-up default |
| 5 | Phased engine | Yes for every existing strategy |
| 6 | Phased UI + identity/matcher sites | Yes — nothing selects Phased yet |
| 7 | **= P36**, the efficiency study | Yes — no shipped code |
| 8 | Phased sweep arms, scoped by P36's evidence | Per-row yes; table gains rows |

**PR 1-2 rationale.** The optimizer's 44-family enumeration is inline in `_runOptimizerNow()`
(`optimizer_ui.js:797-896`) — not exported, not tested, unreachable from node — while
`buildVariations()` is exported but sweeps a **different, smaller space** (36 families, no IRMAA arm,
no ACA arm, IRA Draw capped at 10% vs 20%). Goldens must be captured before the extraction or the
extraction cannot be proven behavior-preserving. Ship `OPTIMIZER_GRIDS`/`MC_GRIDS` as pinned
constants so the divergence is declared rather than accidental.

**PR 3 is a bug fix that stands alone.** The ACA branch has no age test at all. Release the ceiling
outright rather than falling through — every ACA sweep row sets `stratRate: 0` (`optimizer_ui.js:832`),
so a fall-through lands on the 10% bracket, *tighter* than the cap it replaced. **State the
consequence in the changelog:** for the standalone `aca` strategy, unbounded room collapses
`IRAwd = Math.min(yr.curIRA, iRAbracketRoom)` (`:1366`) to `IRAwd = yr.curIRA`, draining the whole
above-goal IRA in the year the younger spouse turns 65. Real consequence, not a bug. **Phased does not
have this problem** — its IRA_CONTROL target stays in the `Math.min`.

**PR 4 is not byte-identical, by decision.** `deathBasisStepUp` is a three-value enum
(`'none'`/`'half'`/`'full'`, unrecognized means `'none'`, the `rothGapFill` convention) defaulting to
`'half'`. Fires in `resolveHousehold` after `yr.status` (`:986`), on the **first Single year** — which
is deliberately *not* Phase 3's year. `'half'` over `'full'` because 41 states are common-law;
community-property handling is explicitly not modelled (`STATEname` is knowable at `:2307` but no
table exists). `survivorSpendPct` multiplies **`yr.targetSpend`, never `sim.spendGoal`** (GK reads
`spendGoal` as its own state at `:1205`, so scaling it would rebase the guardrails permanently), and
**`routeSurplusAndConvert:1755` must see the factor too** or the freed dollars vanish from surplus.
Guard on `birthyear2 > 0` or single filers get the reduction for their whole plan.

**PR 5 dispatch: additive disjunction, not a `yr.effectiveStrategy`.** `inputs.strategy` stays scalar.
Resolve `yr.phase` above `:1198`, then extend the three existing flags with `|| 'phased'`, add one new
`else if` in `planPrimaryWithdrawals` before the bracket branch, and two `|| 'phased'` guards at `:945`
and `:1314`. Five additive sites; every existing strategy is bit-identical **by construction**. A
re-pointed `effectiveStrategy` was rejected: 15 edits is 15 chances to change a shipped strategy
silently, and it would lie at `:2276` (GK spend advance) and `:694` (`minlimit` IRMAA clamp).

**PR 5 gap fill: one new arm, do not flip `isBracketStrategy` off.** Phase 5 emits only the IRA draw;
a second `calculateWithdrawals` there would be sized against a stale tax number and *is* the
double-draw risk. Add an `else if (yr.phasedBalancedFill)` arm to `fillSpendingGap` between the
bracket and ordered arms, ordering `['Brokerage','Cash','Roth']` weighted by current balance. **IRA is
deliberately excluded** — its share is already handled by IRA_CONTROL, and including it is the
double-draw. Flipping `isBracketStrategy` off instead would hand the plan the hardcoded `[40,60]`
(`:1543`) *and* disable the forced-IRA fallback (`:1649`), so a Phased plan would starve rather than
break its own ceiling for mandatory spending.

**PR 6: 12 identity/matcher sites, every one a silent failure if missed.** The sharpest is
`sameStrategySelection` (`optimizer_core.js:2914-2938`) whose `default: return false` would make the
📍 current-plan pin, the ⚖ compare and MC's stress-vs-your-plan all fail quietly. Full table in the
plan file. Also pin with a test that `getInputs`'s `bracket`+ACA rewrite (`optimizer_ui.js:300-306`)
does not catch Phased.

**PR 8 budget reality.** The sweep **already exceeds its own budget**: 1,711 runs measured against a
1,500 cap, absorbed by silently halving `bestTimeLimitedConversion`'s candidate pool from 12 to 6
(`optimizer_ui.js:1043-1049`). 4 Phased families add ~16 rows / ~150 runs. Whatever ships, **make the
cut visible** in the `#opt-perf` readout. This is the concrete argument for doing P34's worker and
per-row memo next.

### Already ruled out — do not re-derive

- **Gain harvesting.** It already exists as the Cyclic modifier, which maxes the LTCG bracket on
  purpose even when spend does not need it (`optimizer_core.js:1301-1303`) with `cycleLTCGTarget`
  nerdknob-gated (`optimizer_ui.js:86`). Whether it is worth selecting is **P32's Q3**, already scoped
  as a scan of existing sweep output. Phased gets 🗘/🔄 twins like every family and adds nothing here.
- **"Use the weightier assets more heavily."** That is `calculateWithdrawals` with
  `order: ['IRA','Brokerage','Cash']`, i.e. exactly what `propwd` (`:1379-1391`) and the baseline
  branch (`:1398-1406`) already do. BALANCED ~= propwd plus the IRA_CONTROL term. Do not rebuild it.
- **A new IRA-target input.** `#iraBaseGoal` exists and `yr.curIRA` is already computed.
- **Terminal-mix-as-target** (P24 §6, `findings.md:515-533`) — the optimal mix is an output of the
  search. Do not add a mix-based phase trigger.
- **Frequency-based pruning of sweep arms.** See P36's framing block; the bar is `task_plan.md`'s
  measure-then-pin rule, and four heuristics have already failed here.

### Tasks

- [x] PR 1 — characterization goldens, `NERD_KNOBS` off and on, plus 4 `buildVariations` bases.
      **DONE 2026-08-03**, node 148 -> 167. `sweep_golden.js` (data, dual-mode) + `sweep_golden.gen.js`
      (regenerates the MC half from source) + `sweep_golden.import.js` (folds a browser capture into
      the Optimizer half, capture recipe in its header). One observation-only line in
      `optimizer_ui.js` exposes `OptimizerState.lastEnumeration`, since the enumeration is otherwise
      unreachable. Four captures, not two: the nerdknob is NOT in the sweep's cache key, and the stock
      scenario has both people on Medicare so `nerdknob` alone yields zero ACA rows — see
      `findings.md` "Two things found while RECORDING the Optimizer sweep". Both sweeps' divergences
      (IRA Draw 10% vs 20%, no IRMAA/ACA family in MC) are now pinned from both sides on purpose, so
      PR 2 cannot collapse them onto one grid. Mutation-checked: perturbing `MC_GRIDS.fixedpct` fails
      9 tests and names the row index.
- [x] PR 2 — `buildStrategyFamilies(base, opts)` returning overrides only; grid constants pinned.
      **DONE 2026-08-03**, node 167 -> 173, v11.1437. `buildStrategyFamilies` + `OPTIMIZER_GRIDS` +
      `MC_GRIDS` now in `optimizer_core.js` and exported; `bothOnMedicareAtStart` moved there too
      (was `optimizer_ui.js`, uncovered) beside its `eitherOnMedicareAtStart` twin. BOTH callers use
      it: `_runOptimizerNow()` lost ~100 inline lines and `buildVariations()` is now a `.map()` over
      the shared list. Seven opts, one per real divergence — `grids`, `irmaaFamily`, `acaFamily`,
      `bracketResetsIRMAATier`, `markCashFunding`, `cashClones`, `offGridLast` — so each call site
      states what its sweep covers. Rows carry `family` + `modifier` (null/'ira-first'/
      'brokerage-first'/'cash') plus the decorated `strategyLabel`, because MC needs a PLAIN-text
      prefix for `_label` where the Optimizer needs the HTML one. PROVEN: all four `OPT_GOLDEN`
      captures re-run in the live page byte-identical, key order included, and regenerating
      `MC_GOLDEN` after the extraction produces a zero diff. One bug the node tests could not have
      caught and the browser did: the no-conversion baseline sweep still referenced the deleted
      `baseFamilies` (`optimizer_ui.js:1073`).
- [x] PR 3a — bracket-lookup floor. **DONE**, v11.1447, merged PR #147
- [x] PR 3b — Medicare age becomes `TAXData.IRMAA.ELIGIBILITY_AGE`. **DONE**, merged PR #149,
      byte-identical over a 144-scenario A/B; the write-up is in the PR 3a-3d replan above
- [x] PR 3c — ACA age gate falling back to Proportional 0%. **DONE**, v11.1462; only `aca` rows move
      (proven against `propwd`/`bracket` controls). The direction WAS predicted first and two of the
      predictions were wrong; both corrections are in `findings.md`
- [ ] PR 3d — `Basis <= Brokerage` invariant
- [ ] PR 4 — `deathBasisStepUp` enum defaulting `'half'`; `survivorSpendPct` at 100;
      `yr.isLastMFJYear` + `yr.isFirstSingleYear` (hoisted); `sim.prevIRAGain`/`prevBaseReturn`
- [ ] PR 4 — README: **add** a step-up entry to the uncovered-tax-situations section (there is no
      existing "no step-up" caveat to edit), and note the second death is still unmodelled
- [ ] PR 5 — `yr.phase` resolver; additive flags; `planPrimaryWithdrawals` branch; `fillSpendingGap` arm
- [ ] PR 5 — test that Phased never draws more than `Fill Bracket` at the same ceiling
- [ ] PR 6 — all 12 identity sites; URL keys `pcp`/`pam`/`dsu`/`ssp`
- [ ] PR 7 — see P36
- [ ] PR 8 — arms scoped by P36; surface the stop-year cap reduction
- **Status:** IN PROGRESS. PR 1 and PR 2 merged as
  [PR #146](https://github.com/nightskyguy/retirement_assets/pull/146); PR 3a merged as
  [PR #147](https://github.com/nightskyguy/retirement_assets/pull/147) and it **already moves
  numbers** — the old "PR 3 is the first one that moves numbers" note is superseded by the PR 3a-3d
  replan above. PR 3b merged as
  [PR #149](https://github.com/nightskyguy/retirement_assets/pull/149) (byte-identical). PR 3c built
  here (v11.1462, `aca` rows only). Next at the review point: **PR 3d**, the `Basis <= Brokerage`
  invariant. **Depends on:** nothing hard. Its PR 2 unblocks P36 and
  helps P29/P30/P31/P32. Its PR 8 budget problem is P34's argument.
- **Touches the same gap-fill code as:** P28's open ship decision (`rothGapFill`) and P30's `[40,60]`
  question. Settling P28 and P30 first would mean PR 5's new arm is written against a settled ordering
  rather than one about to change.

---

## Phase P36: Phased efficiency study — do any strategies never win?

**Why:** the user asked two things the repo cannot currently answer. (A) Across a dozen or more wealth
and asset-mix points, are any shipped strategies *inefficient* — never appearing in the top ranks under
any objective? (B) How many swept variations never produce a top result, and could more variations be
worth adding? Neither is answerable today: the enumeration is unreachable from node (see the P35 PR 2
extraction), and **there is no "top 10" in the code** — the Best table is 7 fixed slots keyed on
`colWinners` (`optimizer_ui.js:1655-1662`), and the Rank column is 1..N.

**Framing, which is as much the deliverable as the numbers.** This produces **evidence for DEFAULT
ORDERING and for P35's shipped defaults — not for deleting arms.** The repo's rule
(`task_plan.md`, P34 Tier 3) is that a search shortcut is legal only if the axis property is *measured*
then *pinned by a test*. "IRA Draw 5% seldom wins" is a frequency observation, not an axis property,
and frequency shortcuts are exactly what has failed here four times — including the "no IRA left" skip
filter that "looked obviously safe and lost the right answer on a $3.3M scenario, reported 25% against
a true 5%" (`findings.md:86`). **The only result justifying deletion is a zero test:** an arm
bit-identical to another in *every* cell, the standard that already justifies skipping 💵 clones when
`Cash === 0` (`optimizer_core.js:3336-3341`).

**Grid — crossed, not hand-picked.** P28 round 2 confounded mix with strain by setting spend per
scenario (`unifiedconv_harness.js:72-78`); round 4 overturned three conclusions once spend rate became
a controlled axis. Control everything from the start:

- **Mix (5)** — copy P28's ladder verbatim (`unifiedconv_harness.js:84-106`). Copy, do not import.
- **Wealth (3)** — x0.5, x1, x3 on every mix.
- **Spend rate (3)** — 4/6/8% of total assets.
- **Death timing (2)** — `die1=88/die2=98` (10 survivor years) and `die1=96/die2=98` (2 survivor
  years). **Mandatory:** without it, P35's phases 3 and 4 never execute and the study reports
  Phased ≈ Fill Bracket *by construction*.

= **90 cells** x ~12 arms ≈ 1,080 sims, ~2s in node.

**Arms:** incumbents at best-known parameters (`Fill Bracket 22%`, `Fill Bracket 24%`,
`IRMAA Ceil Tier 1`, `IRA Draw 6%`, `Reduce 20 yrs`, `Proportional 10%`, `GK`, `Ordered CBIR`) plus
Phased at 4 control percentages. Cross `deathBasisStepUp ∈ {none, half, full}` over **every** arm —
that is why P35 PR 4 made it strategy-agnostic. Run `survivorSpendPct ∈ {100, 80}` as a separate
declared factor; **its result decides the shipped default.**

**Scoring.** Use the exported `rankRowsByObjective` (`optimizer_core.js:2984-2996`), the same ranker
the UI uses, so findings transfer. Two of the nine objectives are degenerate and must be handled
openly, not dropped: `conveffect` reads `_convSavings`, which is UI-computed and absent from a bare
`simulate()` result — **declare it out of scope with the reason**; `earliestbe` reads `_convBEYear`,
which *can* be populated from `res.totals.convBEYear` under `computeOC: true` — populate it and report
the no-break-even count alongside so the 9999 sentinel is visible rather than laundered. So **7 core
objectives + `earliestbe` with a coverage count.**

**Three tables, never one** — PF11's failure was top-K on a single metric returning five rows from one
family (`findings.md:170`):
1. Per-objective x per-family **mean rank**. A monopolist is low in every column; a niche winner is low
   in one. This is what answers "what should the default ordering be."
2. Per-cell winner counts, **one vote per cell per objective**, so no family takes two seats from one cell.
3. Per-arm **zero test** — count of cells where an arm's money fields are byte-identical to another's.
   Only 100% is a deletion candidate.

**Non-negotiable:** rank on `baselineScoreOf` / `afterTaxNetWorth` with a **shared** rate, never
`finalNW` (`findings.md:377` — "a per-run rate belongs inside a run, never in a cross-run
comparison"). And **score predictions before running**, P28's discipline: Phased vs Fill Bracket at
equal ceiling; step-up `half` vs `none`; survivor spend 80 vs 100; and rule B — does drawing harder on
down years actually pay?

**Two questions here are not about Phased at all** and would otherwise be settled by taste: whether
P35's FIRST_DEATH full-drain bet pays (a one-year MFJ spike, possibly at 37% + IRMAA Tier 4, against
the survivor's permanent Single-bracket penalty — the 2-survivor-year arm should show it losing; if it
does not lose even there, suspect the measurement), and whether `survivorSpendPct: 80` is defensible
as a default.

**Artifact of the design to call out, not misread:** `totals.spend` accumulates `yr.targetSpend`
(`:2149`), so a `survivorSpendPct: 80` run scores lower on `maxspend` **by construction**.

- [ ] Harness `.test_harnesses/phased_harness.js` (node), calling `buildStrategyFamilies` from P35 PR 2
- [ ] 90-cell crossed grid; predictions written and scored first
- [ ] The three reporting tables; `conveffect` exclusion stated with its reason
- [ ] `.test_harnesses/PHASED_RESULTS.md` + a row in `.test_harnesses/README.md`
- [ ] Decide P35's shipped arm count and `survivorSpendPct` default from the output
- **Status:** not started. **Depends on:** P35 PR 2. Runs as P35's PR 7.

---

## Phase P37: LEGACY / heir 10-year drawdown — DEFERRED by the user

Recorded so P35's phase resolver having no phase-5 branch reads as a decision rather than an oversight.

**What it would be.** The user's original Phase 5: a post-death drawdown for heirs that must reach zero
within 10 years, modelled against heir withdrawal rates. Today none of that exists — see `findings.md`
"P35 engine survey" item 5. The simulation **ends at the last death year, inclusive**
(`maxYears`, `optimizer_core.js:2316`); terminal value is one line, `afterTaxWealthOfLogRow`
(`:2595-2600`), haircutting the IRA by a flat `futureIRATaxRate`. No SECURE Act 10-year rule exists
anywhere in the repo, no heir age, no bracket stacking, no time-value discount.

**Why it was split out.** It is not a phase of a withdrawal strategy at all — it is a **replacement for
the terminal scoring function**, so it re-scores every row, every objective, and every measured finding
in `findings.md`. Largest blast radius of anything in the backlog. It is also better modelling: the
flat haircut is exactly the assumption the BETR work found unreliable, and a real 10-year drawdown
against heir brackets would change what terminal IRA is worth, hence the value of every conversion the
tool recommends.

**If it is picked up:** it must land alone, with the 8-scenario harness re-derived deliberately and a
declared list of which prior findings its numbers invalidate.

- **Status:** deferred, not started. **Independent:** no dependencies, but should not share a release
  with anything else.

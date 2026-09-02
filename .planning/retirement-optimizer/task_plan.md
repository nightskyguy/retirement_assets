# Task Plan: Retirement Optimizer — Remaining Work

**As of 2026-08-24:** **P71 COMPLETE and MERGED** (`b7f8808`) - the Monte Carlo model now lives in one `montecarlo/mc_engine.js` behind a 42-line worker and a 203-line controller, with `ARCHITECTURE.md` and `.planning/FILE_DIRECTORY.md` brought along in `fb6675c`. Shipped through **v11.1629**; PR #188 carried P23, then #189 and #190 merged after it. Working tree clean, nothing uncommitted. Suites **305 / 61 / 22** (`slowInCore` 3), `TestTiers.EXPECTED` pinned to match.
**P23 COMPLETE and MERGED**, plus seven addenda: the Monte Carlo tab now offers a third mode, Synthetic-AAM, beside Historical and Synthetic-GBM, and both synthetic modes give every path its own AR(1) inflation calibrated to the 1948-2025 CPI record and correlated with returns. GBM's return draws are bit-identical to before. The addenda added reset-to-defaults, a Pessimistic and a Fixed Inflation preset, Input Distributions for every reader, a fan caption that names every parameter of its run, and moved the preset row out from behind the nerdknob as "Mode presets". P67 shipped v11.1601 in PR #186; P32 in #185; P64/P66 in #182/#183/#184.
Completed phases live in `.planning/task_completed.md`. Full index, ID migration table and
the recency trail are below, in that order.

## NOW — O0 and O1 only

Priority buckets are **O0..O3** so they cannot be mistaken for phase IDs, which all start `P`.

| Pri | ID | Task | Next item |
|---|---|---|---|
| **O0** | P103 | `P103a`+`P103b1` DONE: gap 4.35% -> 1.58% (2.03% routing-controlled); **nothing beats the ceiling once routing is held constant** | `P103b2` |
| **O0** | P87 | Ceiling basis; **`P87c` SHIPPED** v11.16d4, MAGI now lands on the limit | `P87d` |
| **O1** | P95 | An ACA share link does not round-trip; it loads as Fill Bracket 10% | `P95a` |
| **O1** | P100 | **O1 from O0, 2026-09-01**: SELECTION not RESULT - the ranking defect is real, the frontier is not a better plan | `P100b2` |
| **O1** | P35 | Phased is the CARRIER for whatever rules `P103d` picks; `P35i` waits on that evidence | `P35i` |
| **O1** | P36 | round 2 measures against the `P103a` ceiling, not rank-among-arms | `P36b` |
| **O1** | P34 | NOT a P103 prerequisite (a-d are node harnesses); still the whole slow-machine story | `P34a` |
| **O1** | P28j | `P28jf` is the one RESULT item here: the timing rule moves every converting row | `P28jb` |

**P86 COMPLETE on this branch, v11.1690, commits bd2c875..976452e.** Every displayed dollar honors the Future-$/Current-$ toggle: running totals are UI-computed sums of deflated years (Spendable renamed SumSpendable), RMD/QCD/fee-average/ConvTax/BreakEven follow, and the whole MC tab deflates each path by its OWN inflation (flat-CAGR kept only as stale-worker fallback). Suites **358**/61/22.
**P81, P78, P79, P82 and P80 all COMPLETE on this branch, v11.1667-v11.1671.** Social Security and a capped pension survive a deflationary year; a replay survives editing; the survival chart draws the ten captured paths; prev/next is one 46-stop ring; the Market Return chart names the year replayed.
**P84 COMPLETE, SHIPPED v11.168d** - advisor/AUM fee + RMDs off the prior Dec 31 balance; suites **353**/61/22. **P85 RE-RUN**: earlier still wins 353 of 499, but the RMD claim BROKE (124 counterexamples, all bracket at a live IRA Goal). O0 stays `P35i`; `P72` still pending.

**P32 COMPLETE, v11.15e3, MERGED in PR #185.** The cap-gains spiral measured 0 capped years in 3,960 armed runs; exclusion re-scoped, `forcedIRAAllowBrokerage` rejected. Open call in P56: the brokerage footnote prints an absolute cost, not extra-vs-Plan-Q.
**P88, P89, P90 COMPLETE v11.16a4** - conversions reach MAGI so IRMAA charges them (+30% to +132% at $100k); warnings name the ceilings they break; the ACA gate reads the plan's real first year; two chart fixes. Suites **366**/61/22. **P91 DONE v11.16a5: the Stress Test's first result was computed on a STALE horizon (8/36 where the truth is 0/40) because a refresh displaced by an in-flight one was DROPPED, never retried; now coalesced. The full sweep was silently stale the same way and now raises its Out-of-date banner. Was on `main` too - never a regression from this branch.**
User 2026-08-07: P28 and P40 demoted to **O3**, P37 and P48 raised to **O2**. 2026-08-29: P19 demoted to **O2**; P88 and P89 opened and closed. 2026-08-31: P98 opened and closed - an in-page test read the Limit menu before `DOMContentLoaded` built it. **2026-08-31 CLEANUP (user):** P35 to **O1** (cannot be "ideal" until P75/P36 land), leaving P87 the sole O0; 34 stale boxes closed under phases already shipped; **29 never-started phases moved to `.planning/retirement-optimizer/task_parked.md`** (nothing deleted); P28f/g/h confirmed shipped v11.162B; the 40/60 closed for good in **`P30i`**. **P101 opened** (2026-08-31, user): worked examples served from `examples/` and loadable by name, with notes - O2. **P102 opened and Stage B SHIPPED** (2026-09-01, user): goal-first mode, an ALTERNATIVE nerdknob-gated surface that drives the classic controls and never replaces them; `P30i` closed inside it. **P103 opened, O0** (2026-09-01, user: "reorder as you proposed"): the ceiling then the rules - `P75` and parked `P5` merged into it, `P100` to O1 as SELECTION not RESULT, `P102` Stages C/D deferred behind `P103d`. **`P103a` DONE same day**: oracle re-run on `1b7b366`, median gap 4.35% -> 1.58%, dominant lever flipped to the withdrawal split, `P51d` closed at <=0.013%. Full index next.
<!-- LINE-30 BOUNDARY. The planning hook injects `head -30` of this file on EVERY tool call
     and `head -50` on every prompt. A line added above here silently drops a table row out
     of that window, with no error. Keep this marker on line 30. -->

## P103: the ceiling, then the rules  *(NEW 2026-09-01, user-raised, O0, MEASURE FIRST)*

**The user's question, 2026-09-01:** *"Ultimately what I think is best is to exhaustively solve for the
'ideal' solution - determine what that cost is and then decide how to change the UI/search/tool. The
problem is that I am not confident the engine has the right plumbing to begin with. It is imbued with
several specific withdrawal strategies, and I'm fairly convinced that no single strategy really is most
effective. Is there anything in the proposed steps ahead that will actually produce a better financial
plan as opposed to tweaking around the current architecture and UI?"*

**The answer, verified by seven independent readers and three adversarial passes (2026-09-01;
session-local transcripts, summarized in the six lines below):** the
study already exists and priced the gap; the plumbing mostly exists with two named holes; no single
strategy is optimal though one is often close; and as previously sequenced almost nothing planned
would move a computed number. This phase reorders around the result. `P75` and parked `P5` are merged
into it; `P51` is its origin.

### Reading guide - every term used below, defined once  *(added because "oracle" was never explained)*

| term | meaning |
|---|---|
| **oracle** | a search that is allowed to CHEAT: it is handed the entire future return path (the assumed 6% / 2.5% every year) before it chooses anything, then picks, year by year, how much to convert and which accounts to draw from, re-running the whole multi-decade simulation for every candidate. Because it knows the future, what it finds is a CEILING no honest strategy can beat on that path. It is not a strategy anyone can follow - real retirees do not know next year's returns - so it is research-only and default-off. Its one product is the GAP. The name is the computer-science sense: a hypothetical machine that answers a question you cannot otherwise answer, used to bound what is possible |
| **gap** | how far a shipped strategy's best row sits below the oracle, as a percentage of real after-tax wealth, and which lever the shortfall is made of (conversion timing vs draw mix) |
| **lower bound** | the oracle's search is coordinate descent over a fixed menu - local and coarse - so the TRUE ceiling is at least as high as what it reports. Every gap number is therefore conservative: the real gap is >= the printed one. Cyclic rows beating the oracle in one cell (`defaults @6%`) is the proof |
| **cell** | one complete scenario: one household, one account mix, one spend rate, simulated over its WHOLE horizon (33 years, 2026-2058, in the harness). A cell is a plan, not a year |
| **sim** | one full-horizon run of `simulate()`, ~1.2 ms on the dev box. Every oracle candidate is a full re-simulation, because year t's choice changes every later year's state |
| **regime** | a region of (mix, wealth, basis, spend, life-phase) where one fixed rule wins. `P35n` found the endgame regime; the tail rule flips at roughly $2M of endgame assets |
| **arm** | one row of the Optimizer sweep. A rule ships as an arm, marked, so the table can find it; it never ships as a silent default |
| **`to_brokerage`** | withdraw more than spending needs and DEPOSIT the excess into the taxable brokerage account. A year's surplus has three possible homes - Cash, Roth, Brokerage - and the engine reaches all three, but Brokerage only BY RULE: `convertExcessToRoth` sends IRA-sourced surplus to Roth, `surplusToBrokerage` reinvests Cash Reserve overflow, cyclic banks its harvest there, and anything left lands in Cash. **The hole is per-year CHOICE, not the destination**: no hook lets a schedule decide, year by year, to over-withdraw and bank the excess in Brokerage. e-ORP calls this `to_aTax` (its name for the after-tax account); renamed here 2026-09-01 (user) because "aTax" reads as a tax, not an account |

### What the evidence says, in six lines  *(sources: `research/PERFECT_FORESIGHT_ORACLE.md`, `research/ENDGAME_DRAW_ORDER.md`)*

1. **The gap is priced, and `P103a` re-priced it DOWN.** Best shipped row vs oracle on engine
   `1b7b366`: median **1.58%** at default basis (1.13% at 20% basis, 0.90% at 80%); 0-1.58% in non-GK
   cells, 0.35-20.9% under GK strain. Dollars: **+$856k** (brokheavy @6% b20, split) and +$331k
   (defaults3x @6% b20, conversions); the old **+$1.078M** headline cell is now +$122k. Mix-dependent:
   IRA-heavy is still conversion timing (96% at defaults3x @4%); **everywhere else the withdrawal
   split is now the larger lever**, which is the reverse of the first run.
2. **The yardstick is re-baselined** (`P103a`, 2026-09-01). Both halves re-run on engine `1b7b366`:
   418,289 sims, 373 s, 45 cells. `S3-P2` flipped WRONG -> RIGHT, `B-P4` RIGHT -> WRONG. `P51d` is
   closed in the same file: an equally-costed search of a different shape beats the descent by at most
   **0.013%**, so "lower bound" is near-tight on the conversion axis and the split axis is uncovered.
3. **The plumbing exists with two holes that matter.** `oracleWithdrawalPlan[y]` and per-year
   `extraConversionAmount[y]` are on `main`, default-off, node-only. Monte Carlo already spreads
   inputs into every path (`mc_engine.js:402`). Not expressible: `to_brokerage` (surplus to brokerage
   by per-year choice rather than by cyclic's rule) and converting LESS than the base family's own rule - the per-year amount is
   EXTRA on top. Against e-ORP's six decision families the engine covers two.
4. **No single strategy is optimal; one is often close.** Winners differ by cell; Ordered CBRI sits AT
   the ceiling in brokheavy @4% (gap 0.00%); a cyclic row still beats the oracle in defaults @6%.
   Re-measured 2026-09-01: across the six non-GK default-basis cells the best family is **Ordered in 3,
   IRA Draw in 2, Reduce in 1** - the old "IRA Draw wins 5 of 6" no longer holds.
5. **Three unconnected attacks on one problem.** `P51` (research, done, drifted), `P75` (planned; never
   references `P51`; a different control variable; proposes plumbing that already exists - `P75d`'s
   "withdrawals do not [accept per-year arrays]" is FALSE), and parked `P5` (the phase `P51`'s own
   record names as "the shipping phase if a schedule column is ever productized").
6. **This produced a better plan exactly once, and that is the template.** `P35n`: oracle as ceiling,
   four static rules as candidates, 108 cells, 27k sims, 11 s. Cash->Roth->Brokerage won 88 of 108,
   **+$222,745 median**; the oracle added only +$26-29k over it; the oracle's whole-life shape was the
   WRONG guess for that regime. It shipped as the 🅡 arm (v11.1642). **A fixed rule captured ~90% of
   the expressible ceiling. The exhaustive solve is the yardstick, not the product.**

### What the ideal costs, stated so it cannot be misread

One cell = one whole plan, all 33 years. The oracle optimizes that plan by running about **9,300
full-horizon simulations** (measured 2026-09-01: 418,289 sims / 45 cells; 373.4 s / 45 = 8.3 s per cell;
0.89 ms per sim). Why ~9,300: 33 years x ~25
conversion candidates per year x up to 6 passes x 3 seeds for the conversion axis, plus 10 draw
archetypes x 33 years x 4 rounds for the split. **So: ~8.3 s for a whole 33-year plan on the dev box
(Ryzen AI 9 HX 370), ~29-50 s at the 3.5x-6x slower single-core target. Per PLAN, not per year.** And
what comes out is not "the ideal plan": it is the best schedule IF the future is exactly the assumed
path, and a lower bound on even that. Sixty seconds buys the yardstick for one plan. Not interactive;
a research instrument and a ship-time check.

### Stages - gated, in order

- [x] **P103a DONE 2026-09-01** - the oracle re-run on engine `1b7b366` (418,289 sims, 373 s) and the
      "lower bound" sized. `PERFECT_FORESIGHT_ORACLE.md` is now the second run throughout, with a
      before/after table. **Three results that change what comes next:**
      **(a) the gap closed by itself** - median best-family gap 4.35% -> **1.58%** at default basis,
      and the +$1.078M headline cell is now +$122k. Three shipped fixes landed between the engines and
      all push the same way (`P84` RMD/fee basis, `P88` conversions into MAGI, `P87c` ceiling fill);
      attributing the collapse to any one of them is NOT measured and would need a bisect.
      **(b) the dominant lever flipped** from conversion timing to the **withdrawal split** in most
      cells; the four largest single gains in the run are all split.
      **(c) `P51d` is closed** by a new harness, `.test_harnesses/oracle_crosscheck.js`: Arm A re-runs
      the descent in-process, Arm B is a random-restart search with block/shift/scale/swap moves at $1k
      grain on the SAME measured sim count. Arm B never finds materially more - max **+0.013%** at 3x
      budget, and it is WORSE in one cell. `X-P1` RIGHT 5/5, `X-P2` and `X-P3` WRONG. One-directional:
      it shows an equally-costed different search cannot beat the descent, not that the descent is
      optimal, and it says nothing about the split axis.
- [ ] **P103b** - **RESTRUCTURED 2026-09-01 (user).** Was "close the two plumbing holes". Two user
      corrections reshaped it, both right, both measured before being written down:
      **(i) surplus ROUTING to Brokerage is already shipped three ways** - `cyclicEnabled`,
      `CashReserve != null` (a buffer of 0 sends all of it), and an Ordered brokerage-first sequence
      (`optimizer_core.js:2774`). `P103a` armed none of them, so it compared Brokerage-banking arms
      against Cash-banking ones. Probe on `defaults @6%`: `CashReserve: 0` hands the best non-cyclic
      row **+$84,322** and collapses cyclic's edge from **$98,770 (2.98%) to $14,448 (0.42%)**.
      **(ii) over-withdrawal is already shipped too** - `IRA Draw x%`, any bracket fill whose limit
      sits above the spend need, and `Reduce N yrs` all draw more than the year needs. What is
      missing is not the ability but the FREEDOM: one `x`, one limit, one `N` for the whole plan,
      with the year-to-year shape imposed by the rule. Never an arbitrary per-year magnitude.
      **User, 2026-09-01:** *"if the goal is a strategy with ultimate flexibility perhaps that should
      be built (even if only used internally)."* Agreed, and scoped **measure-first** at the user's
      choice.
- [x] **P103b1 DONE 2026-09-01** - the measurement, and it CLOSED hole (i). `oracle_harness.js
      --full --reserve0` over all 45 cells (391,160 sims, 359.6 s; flag is opt-in so a bare run still
      reproduces the published report). **Negative gaps 1 -> 0**: hold surplus routing constant and no
      shipped row beats the ceiling, so "routing is outside the oracle's menu" was a harness confound,
      not an engine hole. **`surplusTo` therefore drops out of `P103b2`/`P103b3`.**
      **Three results that outrank the one it was run for:**
      **(a) the routing setting is worth more than the gaps this study measures.** Arming the reserve
      moves the base row +$100,653 / +$84,322 / +$120,124 / +$86,332 in four of the six headline
      cells, and **changes which strategy wins in four of six** (`defaults @4%` Reduce 17 -> IRA Draw
      11%; `thirds @4%` IRA Draw 5% -> Ordered CBRI).
      **(b) the gap gets WIDER, not narrower** - median 1.58% -> **2.03%** at default basis - because
      the oracle exploits Brokerage banking better than the rules do. Per cell it moves both ways:
      `defaults @4%` 0.64% -> 2.03%, but `defaults3x @4%` 1.58% -> **0.28%** and `thirds @4%` 0.49% ->
      **0.00%**.
      **(c) `P103a`'s attribution claim is retired.** `defaults3x @4%` was the one cell where
      conversions carried 96% of the gain; with routing equalized its conversions-only gain falls from
      +$14,297 (0.19%) to **$825 (0.01%)** and its decomposition flips to split-dominant. **With
      surplus free to compound in Brokerage the withdrawal split dominates in all six headline
      cells.** The b20 conversion prizes are untouched (`defaults3x @8% b20` still 13.49%).
      **Which run is the yardstick depends on the question, so both are kept.** The bare run is what a
      user actually gets (the reserve is unset by default); `--reserve0` is the only control that
      holds routing constant, so **`P103d`'s bake-offs use it** and anything phrased as "what a plan
      leaves on the table" uses the bare run and says so.
- [ ] **P103b1x** - **NEW, user-visible, NOT decided here.** Leaving Cash Reserve blank costs
      **$84k-$120k** of real after-tax wealth in four of six headline cells and changes which strategy
      the tool would recommend. Whether the shipped default should change from blank (legacy
      all-to-cash) is a product question with a changelog entry attached, not a research one. Needs
      its own measurement across the wider Stage-1 grid before anyone proposes a new default.
- [ ] **P103b2** - **`strategy: 'schedule'`, the flexible carrier.** A research strategy, default-off
      and node-only, on the `oracleWithdrawalPlan` discipline. One per-year entry:
      `{ ordTarget, ltcgTarget, split, convert, surplusTo }` - gross ordinary income to realize,
      long-term gains to realize, the account split (reusing the existing
      `{IRA,Brokerage,Cash,Roth}` / `{seq}` / `{prop}` entry forms), the TOTAL conversion, and where
      the year's surplus lands. Engine keeps enforcing the RMD floor, the spend need and
      non-negative balances; an infeasible entry produces a shortfall and the candidate is discarded,
      which is the rule the oracle already uses.
      **Targets, NOT dollars, and the reason is already in the file.** `optimizer_core.js:1849`:
      *"Fractions, not dollars: dollar plans desync from endogenous taxes/growth; weights are always
      feasible."* A per-year dollar amount is chosen against the previous iteration's tax outcome and
      taxes are endogenous, so it stops being feasible. An income target is solved INSIDE the year
      against that year's realized taxes. That is exactly `P75`/`P103c`'s control variable, so the
      flexible strategy and the unified search are **the same object** - they had been planned as
      separate work.
      **Acceptance is a replay-identity test, not a gap number:** compile each shipped family's
      realized decisions into a schedule, re-run, assert **bit-identical**. A family that cannot
      reproduce itself proves the representation is wrong, and it fails in a test rather than in a
      gap table. Plus: malformed input throws or no-ops, and every existing test is bit-identical.
- [ ] **P103b3** - **total-conversion control** as the schedule's `convert` field. Today
      `extraConversionAmount[y]` is EXTRA on top of the arm's own fill (`optimizer_core.js:2849`), and
      the only suppressions are whole-plan cutoffs - `convEndYear`/`convEndMode` and the
      `_cfSuppressConversions*` internals (`optimizer_core.js:2647`). So a schedule can convert MORE
      than the rule, never LESS, and "convert $40k in 2031, nothing in 2032, $90k in 2033" on a Fill
      Bracket arm is inexpressible. This matters directly to `P103a`'s finding that conversion timing
      is the whole game in the IRA-heavy mixes: **the oracle is searching a one-sided axis there**,
      so its ceiling is understated by whatever WITHHOLDING a conversion would have been worth.
      **`surplusTo` is OUT of scope**: `P103b1` measured routing as a harness confound, and the
      engine already reaches all three destinations. The schedule's `surplusTo` field is dropped;
      a schedule inherits routing from `CashReserve` like every other arm.
- [ ] **P103b4** - re-run `P103a`'s table on the schedule representation and report whether anything
      still beats the ceiling.
      **The cost that decides how far this goes, stated up front:** ~33 years x 4 knobs is ~130 search
      axes against today's ~33. At the current ~25 candidates per axis per pass the oracle already
      costs 8.3 s per plan, so this is 10-30x that - minutes per cell, not seconds. **That is why
      e-ORP is an LP and not a descent.** Building the representation does not oblige us to search it
      exhaustively; its first jobs are as a carrier and a verifier. Whether the search becomes an LP
      is its own decision, deferred to `P103c`.
- [ ] **P103c** - **the unified search** (was `P75a`-`P75c`; absorbs parked `P5`). `P75`'s control
      variable - two per-year income targets, ordinary income realized and LTCG realized, searched
      over the ~12-edge MAGI menu - on the oracle's plumbing and in the oracle's role as ceiling.
      `P75a` stays the gate (edge residency of the best swept rows' realized MAGI; "mostly interior"
      means stop and redesign). `P75b`'s descent, `P75c`'s cliff-margin pricing, `P5`'s greedy
      forward pass as the cheap first seed. Build `magiEdgesForYear()` as its first artifact.
- [ ] **P103d** - **regime bake-offs, the `P35n` template, across regimes.** `P103a` has now NAMED the
      fat regimes and they are not the ones this bullet guessed: **the GK-strain cells at 6-8% spend
      (0.35-20.9%) and the 20%-basis arm**, not `defaults3x @4%`, which was fat under the old numbers
      and is now 1.58%. For each such regime: oracle as ceiling, a handful of STATIC rules as candidates, a crossed grid,
      predictions registered before the run. Winners ship as marked sweep arms, regime-gated, never
      as silent defaults. `P35`'s Phased engine becomes the CARRIER for whichever rules win, so its
      phases are chosen by this evidence rather than designed by hand.
- [ ] **P103e** - **score under many paths before calling anything ideal.** A schedule or rule that
      wins on the one assumed path is a point estimate. Run the `P103d` winners and the oracle's own
      schedule through Monte Carlo (the plumbing accepts it today, `mc_engine.js:402`; `P69` replay
      is done) and report survival and median wealth bands, not the argmax. Extends `P100e3` from
      frontier ROWS to schedules. This is the step that turns a one-path optimum into a policy.

### What merged in, and what this changes elsewhere

| phase | disposition |
|---|---|
| `P51` | ORIGIN. Research complete 2026-08-10, harness drifted; `P103a` re-baselines it |
| `P75` | MERGED: `a`-`c` -> `P103c`; `d` (product carrier) -> after `P103e`; `e` (LP certificate) stays a stretch item under `P103c`. **Its `P75d` claim that withdrawals do not accept per-year arrays is corrected**: `oracleWithdrawalPlan` does |
| `P5` | UN-PARKED into `P103c` as the greedy first seed. Its own text already records the per-year lever exists |
| `P35` | Phased = CARRIER for `P103d`'s rules. `P35i` waits on `P103d` evidence, which is what "cannot be ideal until P75/P36 land" meant |
| `P36` | round 2 measures against the `P103a` ceiling. Its "gap near 0 -> families are complete; fat gap -> names the missing family" certification is `P103d`'s trigger |
| `P100` | O0 -> O1. SELECTION: a better-chosen plan from the same set. The ranking defect (`P100b2`) is real and stays; the frontier is not a better plan |
| `P102` | Stages C/D (worker, search budget) DEFERRED behind `P103d` - until there are arms worth buying time for. Stage E's `e1`/`e2` (gap-fill and stop-year as swept arms) are `P103d` candidates |
| `P34` | unchanged at O1; NOT a `P103` prerequisite - `a`-`d` are node harnesses |

- **Status:** **`P103a` and `P103b1` COMPLETE 2026-09-01.** `P103b2` (the `schedule` strategy) is
  next; `P103b3`, `P103b4`, `P103c`-`e` behind it. `P103b1x` is a separate product question.
- **Depends on:** nothing. `P103e` needs `P103d`; `P103d` needs `P103a` and `P103b`.

---

## P102: a goal-first alternative UI, and a search budget that replaces three hidden ones  *(NEW 2026-09-01, user-raised, Stage B SHIPPED)*

**The user's reframe, which supersedes `P30i` and rewrites `P100` Stage F.** Twelve sidebar
controls shape the outcome; only a handful encode something the user actually knows. Four inputs
matter to them: what they want to spend, what their objective is, whether to do Roth conversions
at all, and whether to stop them. Everything else, the withdrawal strategy included, they would
rather have decided for them on evidence. `P34` supplies the missing mechanism: let the user buy
search TIME, the way Monte Carlo already does, instead of paying for search with knobs.

### The governing constraint (user, 2026-09-01)

**ADDITION, never replacement.** The goal-first orientation is an alternative UI gated behind
**`?nerdknob=goal`** - one notch deeper than the plain knob, which some users know (`P102b7`,
2026-09-01: "keep the current work, but make it not accidentally findable"); nothing in the
existing sidebar is removed, replaced, renamed or demoted. **The
worker-thread separation is NOT gated** - it changes when work happens, never what is computed,
which is the rule `applyNerdKnobVisibility` already states for the IRMAA forward projection.
**The fallback is to re-enable the existing UI**, and the Stage B design makes that free.

### The finding that makes the budget cheap: it already exists, three times, invisibly

| existing budget | site | what it silently drops |
|---|---|---|
| clone passes are **additive, never crossed** | `optimizer_core.js:5188`, whose own comment says *"crossing all three dimensions would balloon the row count"* | crossing the four policy dimensions already swept is 37 x 3 x 2 x 2 = **444 rows**. It ships 179 |
| 1,500-run budget, enforced as `.slice(0, 6)` | `optimizer_ui.js:1462-1467` | half the time-limited conversion candidates. `P34` calls this cap *"a silent quality reduction"* |
| `selectConversionCandidates(results, 12)` | `optimizer_ui.js:1438` | 124 of 136 rows never evaluated under `conveffect`. `P100e1`: *"the pool cap of 12 IS the instability"* |

### Monte Carlo is not an analogy, it is a port

`montecarlo/worker.js:9` already `importScripts`es `optimizer_core.js`. Reuse, do not rewrite: the
worker plus its `file://` chunked fallback (`mc_controller.js:10-51`, `:173-203`, already an anytime
loop yielding on a **16 ms** budget); the self-calibrating cost model (`:97-137`,
`wall = fixed + msPerSim x sims`, **both terms learned from real runs on this machine**, with the
one-equation-two-unknowns trap found and documented at `:110-125`); cancel, progress, and buttons
that state their cost before the click. That model is also the answer to the reference-box versus
old-laptop problem: `P34`'s "usable at 3.5x to 6x slower" stops being a profiling assumption and
becomes a runtime measurement.

### Two hard constraints on the budget, both from measurements already in this repo

**C1. A budget may reduce COVERAGE and must say so on screen. It may never apply a heuristic that
predicts a winner.** "We ran 179 of 444, here is what was skipped" is legal. "We skipped arms we
predicted would lose" is the failure mode that has hit this repo four times, silently
(`findings.md:85`, `findings.md:86`, plus the cutoff-axis and account-mix heuristics in `P34`
Tier 3). `P36`'s standard is unchanged: **only a zero test justifies dropping an arm.**

**C2. Truncation order must be deterministic and plan-independent.** Truncating in build order
re-creates `P100`'s H2 exactly - *"POSITION IN A 133-ROW TIE, which is input-array order"* - and the
`RS` acceptance test would then fail by construction.

**Sequencing consequence.** The budget's entire output is MORE ROWS and 66.2% of rows are already
dominated, so **`P100` Stage D must land before Stage D here**, or this ships a bigger table nobody
can read.

### Stages

- [ ] **P102a1** - classify every sidebar input FACT / GOAL / POLICY. Promotes `P100f1`; the list IS
      the deliverable and it will be argued over.
- [ ] **P102a2** - record the three budgets above as one list, so their replacement can be scored
      against what it replaced.

**Stage B - SHIPPED 2026-09-01. Goal-first mode: additive, nerdknob-gated, NO ENGINE CHANGE.**

The panel DRIVES the classic controls rather than reaching the engine. Nothing in it is read by
`getInputs()`, added to a share URL, or written into a saved scenario, and that is what makes the
fallback free: knob-off leaves the sidebar holding exactly the plan the panel built, populated and
editable, so "what did it decide?" is answered by looking down the page.

- [x] **P102b1** - the panel (`#goalfirst-panel`), a **SIBLING of `#strategy-container`, above it,
      never a child of it.** Nested (as it first shipped) it inherited that box's orange border and
      read as part of "5. Withdrawal Strategy", which is the one thing it is not: it asks what you
      want, where the box below asks how to get it. Being outside also keeps it clear of the
      `#strategy-container .input-group` override that strips borders and padding from anything
      nested there. Pinned by a structural test, since nothing else would catch a re-nesting.
      `display:none` in its own markup as well as in
      `applyNerdKnobVisibility()`, plus `goalFirstReset()`. **Reset does NOT hand the borrowed
      values back** - it drops the panel's own memory and leaves the classic controls holding what
      the panel wrote. Restoring would silently move a plan at the moment its UI disappeared, which
      is the one failure of the two a reader could not notice.
- [x] **P102b2** - the stop year, and **REDESIGNED 2026-09-01 after the first cut shipped wrong.**
      v1 put "Stop conversions when they stop paying" in the panel as its own toggle, which read as
      live even while the conversions question directly above it said "Never convert". It is now a
      THIRD POSITION of the existing scope menu - `all conversions` / `extra only` /
      **`when they stop paying`** - which is what it always was: the answer is still a stop year,
      the only difference is who works it out. The year box goes read-only, because the tool owns it.
      - The option is nerdknob-gated the way the ACA entries in the Limit menu are, and **the engine
        never sees it**: `getInputs()` already maps anything that is not `'extra'` to `'all'`
        (`optimizer_ui.js:605`), which is the scope this position implies anyway - `P24` measured
        extra-only stopping as much weaker.
      - It adopts `_beStopSuggestion` through `applyConvStopYear()`, the same object and the same
        function behind the Break Even icon's "Stop after YYYY" link, so the two agree by
        construction rather than by test.
      - The apply is DEFERRED out of the `updateStats()` call stack: applying inline lets the inner
        run paint the new numbers and then lets the outer run paint its stale totals back over them.
        It converges because `bestConversionStopYear()` strips any stop year the plan already
        carries. **Verified: 0 re-applies across three further runs.**
      - **BUG found by looking at a screenshot, not by a test.** `applyConvStopYear()` writes the
        SCOPE as well as the year, and the scope it carries is `'all'`, so adopting through it
        deselected the very position that asked for it: the menu snapped back to "all conversions"
        the instant it found an answer. Fixed by re-asserting `auto` after the apply. Sharing that
        function is still right - it is what makes this position and the icon agree - and the engine
        never saw the difference. **NOT covered by a test:** reproducing it needs a real
        `runSimulation()` plus the deferred timer, and the in-page suite runs at parse time before
        the page has a plan. The comment at the fix carries the failure mode instead.
      - **`Never convert` disables the whole stop-conversions row** (both controls, greyed), because
        a stop year is a question about conversions and stops being a live one when there are none.
- [x] **P102b3** - "Roth conversions: let the tool decide / never", driving the five controls
      through their own handlers. The resync in `onConvSubFlagChange()` is **ONE DIRECTION ONLY**:
      "never" is cleared when conversions reappear and is never SET automatically, because all
      flags off is also the shipped default of a plan whose Optimizer is still searching for a
      conversion - inferring "never" from it would answer a question the user was never asked.
- [x] **P102b6** - **"Optimize for" moved INTO the panel**, as a mirror rather than a second
      setting. Asking the goal on the Optimizer tab and the conversions question in the sidebar made
      a dance out of one decision. Both selects call `setOptObjective()`, which now writes the value
      back to whichever one did not raise it, so they cannot disagree; the mirror's options are
      BUILT from `OPT_OBJECTIVE_ORDER`/`OPT_OBJECTIVE_LABELS` rather than a second hand-kept
      `<option>` list that would drift the first time a goal is added, and the objective blurb
      renders into both places. The panel now holds two of the four goals and points at the third.
- [x] **P102b4** - the inconsistency, recorded rather than fixed: `buildStrategyFamilies` writes
      `convertExcessToRoth: convOn` with `convOn = true` onto every swept row, so the sweep never
      varies a switch the sidebar offers.
- [ ] **P102b5** - **DEFERRED, with the reason, because the plan's own acceptance test for it was
      wrong.** "Never convert" does not change what the Optimizer TABLE lists, so it still shows
      strategies that convert (stated in visible text under the control). Filtering to the
      `_isNoConv` rows was the planned test and is REJECTED on inspection: those rows also force
      `cyclicEnabled:false` and `qcdHHMax:0`, so filtering to them would silently remove Cycle
      Brokerage from anyone who declined conversions - a loss with nothing to do with their choice.
      The real fix is core-side (stop forcing `convOn` when the user opted out) and belongs with
      `P102b4`.

**Measured on the shipped Stage B** (reference box, Ryzen AI 9 HX 370; minima of three alternated
runs). "Never convert" is the cheapest budget lever there is:

| scenario | let the tool decide | never convert | saved | conversion-optimized rows lost |
|---|---|---|---|---|
| default | 2,395 ms, 193 rows | 732 ms, 193 rows | **70%** | **0** |
| $3M IRA, 32% heirs rate | 3,231 ms, 195 rows | 682 ms, 193 rows | **79%** | 2 |

At the 3.5x-6x slower single-core target `P34` names, that is **8.4-14.4 s down to 2.6-4.4 s** on
the default scenario. **And on that scenario the conversion-optimization pass spends 1.7 s
searching 12 candidates to add ZERO rows** - a budget argument in its own right, and a `P34` datum.

- [ ] **P102c1/c2 - the enabler, UNGATED.** Move the sweep into a worker reusing
      `montecarlo/worker.js`'s pattern; pin `startInYear` against the midnight problem; port
      `recordMCTiming`/`estimateMCMs`, fed by the wall time `setOptimizerBusy` already measures.
      Acceptance is a zero test: every displayed number identical before and after.
- [ ] **P102d1/d2/d3 - the declared budget.** Needs C and `P100` Stage D. A **Search depth**
      control (Quick / Standard / Exhaustive) labelled with its measured estimate on this machine,
      plus Cancel and progress. Ungated, because **Standard is today's sweep exactly**, so the
      control removes three hidden constants without moving anybody's numbers. Plus the on-screen
      statement of what was skipped (**C1**) and the plan-independent priority (**C2**).
- [ ] **P102e1** - `gapFillWeights` as a swept dimension: a `gapClones` pass mirroring `rothClones`
      (`optimizer_core.js:5210-5231`), cloning `unmodified` only, both endpoints `[0,100]` and
      `[100,0]`, `[40,60]` left as the un-cloned row. **+22 rows on ~179.** Gate it as the
      COMPLEMENT of bracket and ordered (computed, never a hardcoded family list -
      `ROTH_GAP_EXCLUDED`'s own comment records that lesson) so `P35`'s Phased family is covered
      automatically. Prerequisite zero test per `P36`: confirm the arms are bit-identical when
      `Brokerage === 0` or `Cash === 0`, then gate on it the way `cashClones` gates on `Cash > 0`.
      Carry it into `STRATEGY_SELECTION_FIELDS`/`sameStrategySelection` with a **pair-aware**
      comparison, not the string helper `rothGapFill` uses; add a `gfw` URL key; make the row-click
      adopt path write it. The `P30i` three-position sidebar control is its landing pad.
- [ ] **P102e2** - the stop year as a swept dimension, which is what makes `P102b2`
      objective-aware. Today it answers one question only, after-tax wealth, and its label says so.
- [ ] **P102e3** - cross the clone passes instead of adding them: the 179 to 444 step.
- [ ] **P102f1/f2** - `P100f2`'s flow inside goal-first mode, then graduate it out of the nerdknob
      following the documented pattern (`optimizer_ui.js:148-150`). **The classic sidebar is not
      removed even then** - the two become selectable surfaces over one engine.

### `conveffect` is no longer array-ordered, and a claim made here on 2026-09-01 was stale

`P100`'s write-up says only 3 of 136 rows are evaluated under `Roth Conversion Effectiveness` and
"the other 133 are scored `-Infinity` and displayed in input-array order". **That was fixed on this
branch and the phase text was not updated.** `optimizer_core.js:4699` is
`(sign * (metric(a) - metric(b))) || compareByTiebreakChain(a, b, rate, chain)`: two unevaluated rows
both return `-Infinity`, so the subtraction is `NaN`, `NaN` is falsy, and the chain runs. The 133
rows now sort `finalRoth -> breakEven -> netWealth -> remainIRA -> spread -> lifeTax -> spend`.

Consequence for `P102`: **auto-adopting the top-ranked row is not the hazard it was described as.**
Rank 1 under any goal is a measured winner. The residual concerns are `P100c1` (`_convSavings`
scores tax saved, not outcome) and `P100e1` (only 12 rows get a twin at all) - both real, neither
about array order.

- **Status:** Stage B COMPLETE and verified. Node suites **382 / 61 / 22 UNCHANGED** (no engine
  change, which was the design tripwire), in-page **525**, all **990 green under all four**
  combinations of `?nerdknob` and `?runtests`. **CACHE GOTCHA, hit once here:** the `?v=` token has
  to move on EVERY edit to a stamped file, not once per session. Editing `optimizer_tests.js`
  after it was already stamped `1116e9` meant the browser kept the old copy and the badge reported
  a green that was three assertions short - green on stale code reads exactly like green on fresh
  code. Caught only because the test COUNT did not move. Now `1116ed`.
  **What Stage B did NOT do, stated plainly: the
  withdrawal strategy is still the user's to pick, and the sweep still runs on the main thread.**
  Those are `P102e`/`P102c`, and the "tool decides the strategy" step is small, because the sweep
  already ranks every row by the chosen goal and `loadOptimizerResult()` already adopts one. **No changelog entry and no `<title>` bump**: the
  whole change is nerdknob-gated, so nothing shows in `git diff main...HEAD` that an ungated user
  can see or feel, and the `<title>` is pinned to the first changelog `<li>` by the maintenance note
  in the page. The `?v=` cache tokens moved anyway, because they follow the FILE, not the release.
- **Depends on:** Stage D needs `P34` and `P100` Stage D. Stages A, B and C depend on nothing.
  **2026-09-01: Stages C and D DEFERRED behind `P103d`** - a worker and a search budget buy time
  for arms, and the arms worth buying time for are the ones `P103d` has not found yet.

---

## P101: worked examples, served from the site and loadable by name  *(NEW 2026-08-31, user-raised, O2, not started)*

**The user's idea:** *"Maintaining a list of worked examples that can be loaded from the server via
Load. For that each example will also need a notes/description."*

**Where it came from, and it is the strongest argument for it.** The scenario that reproduced `P100`
was a worked example from a YouTuber's video, sent as a file. Two things followed: nothing in the
tool could load it except a manual import, and it could not be committed, because it arrived under a
real surname and this repository is public. A curated example set fixes both - the examples are
publishable by construction, and they arrive with the tool.

### What it is worth beyond the obvious

- **A test corpus that pays for itself.** Every worked example is a regression fixture. `P100`
  needed exactly this and had to fall back on a gitignored local file, so the reproduction cannot be
  re-run by anyone else or by CI.
- **Teaching surface.** "IRMAA tier plan for a $4M IRA couple" is a better on-ramp than an empty
  form, and the notes field is where the *why* lives.
- **Comparison against published advice.** A worked example from a video can be loaded and then
  argued with, which is a use the tool currently makes hard.

### Design notes - the parts that are not obvious

- **Directory must NOT start with an underscore.** This site is served by Jekyll (`_includes/`
  exists), which treats `_`-prefixed directories as source and does not publish them. `examples/`,
  not `_examples/`.
- **A manifest, not a directory listing.** GitHub Pages serves no index, so the page cannot discover
  files. `examples/index.json` carries one entry per example: id, title, one-line summary, the
  longer notes, and the scenario filename. The scenario files themselves stay PLAIN `saveScenario`
  output so an example can be produced by saving one, with nothing hand-edited.
- **Notes live in the MANIFEST, not in the scenario.** Keeping `data` byte-compatible with
  `saveScenario`/`applyScenario` means no new field to thread through `getInputs`, the URL, or the
  version check.
- **`SCENARIO_VERSION` is the rot risk, and it is not hypothetical.** It is 4 today and
  `loadScenario` filters on EXACT equality (`optimizer_ui.js:5598`), so every shipped example dies
  silently the next time the schema moves. **The mitigation is a test, not discipline:** a node
  suite that loads every file in `examples/` and asserts it parses, matches `SCENARIO_VERSION`, and
  round-trips through `applyScenario`. A stale example must fail the build, not the user.
- **One dialog, two sources.** Examples belong in the existing Load dialog under their own heading,
  beside the user's saved scenarios - not behind a second button. Loading one must not overwrite a
  saved scenario, and the user should be told the load replaced their current inputs.
- **Attribution, and it is a requirement rather than a courtesy.** An example reproducing published
  material names the source and links it. It does not use anyone's name as an identifier, does not
  imply endorsement, and carries a line saying the figures are a reconstruction for comparison.
- **NEVER a real private user's plan.** The `*.local.json` gitignore rule added 2026-08-31 exists for
  exactly this. An example is publishable only if its numbers are published already, or invented.

### Open questions to settle before building

- Does an example load into the inputs only, or also switch tab / auto-run the Optimizer?
- Should a loaded example be shareable? Its `?`-URL would carry the inputs anyway, so probably yes
  and nothing extra is needed - confirm rather than assume.
- Is there an "example" marker in the UI after loading, so a reader does not mistake it for their own
  plan? A saved scenario has a name; an example needs at least as much.

- [ ] **P101a** - `examples/index.json` schema plus two examples, one of them the `P100` scenario
      reconstructed from published figures with attribution. Schema first, because everything else
      keys off it.
- [ ] **P101b** - node test: every entry in the manifest resolves, parses, matches
      `SCENARIO_VERSION`, and round-trips. **This is the item that keeps the feature alive**; without
      it the set rots at the next schema bump.
- [ ] **P101c** - Load dialog: an Examples section listing title + summary, with the longer notes
      shown on selection. Reuses `applyScenario`; no engine change.
- [ ] **P101d** - after-load affordance: name the loaded example on screen so it is not mistaken for
      the user's own plan.
- [ ] **P101e** - `examples/README.md`: how to add one (save a scenario, drop the file in, add the
      manifest row), and the attribution and privacy rules stated where an author will see them.
- **Status:** NOT STARTED, O2. No dependency on any other phase; `P100` would have used it.
- **Depends on:** nothing.

---

## P100: the Optimizer recommends unstably, scores the wrong thing, and asks the user the wrong question  *(NEW 2026-08-31, user-raised, O0, MEASURE FIRST)*

**Origin.** Two user observations on 2026-08-31, and the second is a shipped defect:

1. *"A user may not KNOW what direction makes the most of their assets. They may want a compromise
   between End Net Worth, Roth value, Spendable, safety and conversion effectiveness."*
2. *"When I choose Roth Conversion Effectiveness, Conv Tax savings is less important than Net Worth,
   Roth Account Value and Break Even. My strategy may rank 105th; at 85th I see something with
   HIGHER net worth, HIGHER final Roth, a slightly later break even, so I select THAT. Then the
   optimizer runs again and the strategy that was 105th is now 24th. It's unstable!"*

### Reading guide - the codes this phase uses, defined before first use

| code | meaning |
|---|---|
| **row** | one line of the Optimizer table: a strategy plus its parameters, already simulated |
| **`⇌` row / twin** | a row added by the conversion-optimization pass, carrying `_isConvOptimized: true` and a `_convSavings` |
| **pool** | the <=12 rows `selectConversionCandidates()` picks to receive a `⇌` twin (`optimizer_ui.js:1438`) |
| **objective** | one of the nine `OPTIMIZER_OBJECTIVES` keys; today a VIEW control that ranks rows and picks columns and changes no number |
| **dominated** | row X is dominated by row Y when Y is at least as good on EVERY reported metric and strictly better on one. A dominated row is the right answer to no question |
| **frontier** | the non-dominated set. Usually a handful of rows out of ~126 |
| **RS** | rank stability: re-running the sweep after adopting one of its own recommendations must not reshuffle the table |

### The mechanism behind the instability, traced in code, not theorized

1. `_convSavings` is set ONLY on `⇌` rows (`optimizer_ui.js:1546`). Every other row has it `null`.
2. `conveffect` ranks on `r._convSavings ?? -Infinity` (`optimizer_core.js:4357`). A row with no twin
   is not ranked low - **it is dumped below every row that has one**.
3. Only 12 rows get a twin: `selectConversionCandidates(results, 12)`, one champion per family,
   chosen by `_baselineScore`.
4. `_baselineScore` is computed with `sharedFutureIRARate`, which is
   `base.futureIRATaxRate ?? results[0].totals.futureIRARate` (`optimizer_ui.js:1428`) - **the user's
   own plan, or, when the heirs rate is unset, whichever row happens to be FIRST.**

So changing the user's own plan changes the shared rate, which changes every `_baselineScore`, which
changes **which families win pool seats**, which changes **which rows get a twin at all** - and under
`conveffect` a twin is the whole difference between being ranked and being `-Infinity`. **105th to
24th is a pool-membership flip, not a scoring wobble.**

### Falsifiable predictions, stated before the harness runs, to be scored by `P100a2`

| id | prediction |
|---|---|
| **H1** | **REFUTED.** Re-running with only the user's selected strategy changed moves >=1 row into or out of the pool - measured, the pool is IDENTICAL (same 3 labels) |
| **H2** | **REFUTED.** Large jumps are explained by pool membership - they are not. They are explained by POSITION IN A 133-ROW TIE, which is input-array order |
| **H3** | **NOT FIRED.** The fallback was active (rate 0.12 from `results[0]`) but produced the same rate in both runs, so it cannot be the cause here. Still worth fixing as a fragility (`P100b2`); it is not this defect |
| **H4** | **CONFIRMED, and not marginally.** >50% dominated was the prediction; measured 61.8% on the loosest metric set and 86.8% on the tightest. 136 successful rows -> a 46-row frontier on the four core metrics |
| **H5** | **SPLIT: first clause CONFIRMED, second REFUTED.** The user's plan IS non-dominated. But so is the nominal `conveffect` winner (`Ordered ✓ ⇌`) - it was never a bad plan, it just said nothing about the other 133 rows |

**H4 and H5 are the ones that decide whether the Pareto work is worth building.** If the frontier is
80 rows wide, it is not a simplification and this phase stops after Stage C.

### Order of work: dependency first, payoff second within each stage

Stages are gated. Nothing in a later stage is started before the earlier one reports.

#### Stage A - CHARACTERIZE. No code change. Everything else is unverifiable without it.

- [x] **P100a1** - **DONE 2026-08-31.** `.test_harnesses/fixtures_rankstability.local.json` (gitignored - real personal data, public repo). Capture the user's actual scenario as a fixture (`.test_harnesses/fixtures/`), the
      one where their plan sits at 105th. **Ask the user for it; do not invent one.** A reproduction
      on a fabricated scenario proves nothing about the reported behavior.
- [x] **P100a2** - **DONE 2026-08-31, in the browser on v11.16d4; H1-H3 all REFUTED, and the real cause is simpler and worse. See `research/OPTIMIZER_RANK_STABILITY.md`.** Reproduced 103 -> 20 exactly. **Only 3 of 136 successful rows carry a `_convSavings`; 133 are tied at `-Infinity` and displayed in INPUT-ARRAY ORDER** (verified, not inferred). The pool was byte-identical across both runs and `sharedFutureIRARate` was 0.12 both times, so pool churn - the predicted mechanism - is not what the user saw. The plan moved 103 -> 20 with NOTHING about it re-measured: it had no `_convSavings` either time. Original text: `.test_harnesses/rankstability_harness.js`. Run the sweep, record the pool
      membership and the full ranking; adopt the row the user would adopt; re-run; diff. Score
      **H1-H3**. Instrument pool membership explicitly - the answer is a SET DIFFERENCE, not a rank
      correlation.
- [x] **P100a3** - **DONE 2026-08-31. `H4` CONFIRMED, `H5` split. `research/OPTIMIZER_RANK_STABILITY.md` Part 2.**
      66.2% of successful rows are dominated on the four core metrics (46-row frontier of 136);
      86.8% on net-worth-plus-Roth alone (18 rows). **The metric SET is the real knob** - 18 rows on
      two metrics, 52 on five - so "show the frontier" moves the choice from *which objective* to
      *which metrics count* rather than removing it. A weaker choice than the one it replaces
      (metrics are columns the table already prints, and widening the set is always safe, since a
      row on the frontier for a set stays on it for any superset), but the phase must say so.
      **Do not call a 46-row frontier "a handful".** Recommended default: the four core metrics.
      Break-even stays OUT of the default - 133 rows have no break-even year, so including it mostly
      measures whether a row was evaluated, which is Part 1's defect leaking into a second place.

#### Stage B - CHEAP CORRECTNESS. No engine change, no ranking redesign. Each shippable alone.

Ordered by payoff per line of code. All three are live defects today, independent of the redesign.

- [x] **P100b1** - **DONE and SHIPPED v11.16d5, 2026-08-31.** Four sites, the `propTax` precedent for a non-DOM field: seeded from `?obj=` at the `OptimizerState` declaration, emitted by `buildShareURL` only when non-default (so links made before this are byte-identical), saved as `optObjective` beside the engine inputs - NOT inside `getInputs()`, which feeds `simulate()` and the MC cache hash and has no business carrying a ranking preference - restored by `applyScenario`, and `setOptObjective` now writes the `<select>` back so the control cannot show one goal while the table is ranked by another. Four in-page assertions; badge 960 (502 in-page + 458 node). Original text: persist the objective. `OptimizerState.objective` is in neither
      `OPT_LONG_TO_SHORT` nor the scenario fields, so a share link silently loses it and two people
      on "the same plan" are shown different winners. URL short-key + scenario field + round-trip
      test. **Highest payoff per line in the phase.** Same class as `P91d`.
- [ ] **P100b2** - **make `sharedFutureIRARate` order-independent.** The `?? results[0]` fallback
      makes every score depend on sweep ORDER when the heirs rate is unset. Replace with an explicit,
      documented default. Pin with a test that shuffles the row array and asserts the rate is
      unchanged.
- [ ] **P100b3** - **NOW THE PRIMARY FIX OF THE WHOLE PHASE, promoted by `P100a2`, and RESHAPED
      2026-08-31 by the user: "wouldn't a better strategy be to evaluate all rows using perhaps a
      second generic system (e.g. Net Wealth) so that there is still some meaning to the ordering?"
      They are right, and the original "mark them and stop" is the weaker half of the answer.**
      Marking is honest but leaves 133 of 136 rows ungraded, which does not help anyone CHOOSE - and
      a table that refuses to order itself has traded one problem for another.
      **The measured breakdown of the 133 (`P100a2` run, same scenario):**
      **9 of them WERE evaluated** and the answer was "conversions do not pay here" - a real result,
      currently thrown away, because `optimizer_ui.js` does `continue` on `optConv === 0` and never
      records the zero. **124 were never evaluated at all.** Those are different facts and the table
      shows both as blank.
  - [ ] **P100b3a** - **record the zero.** A pool candidate that comes back with `optConv === 0` has
        been MEASURED: its conversion effectiveness is $0. Set it on the base row instead of
        skipping. Nearly free, and it takes the graded set from **3 to 12** on this scenario. "$0"
        and "not evaluated" must then render differently - `$0` vs `-`.
  - [x] **P100b3b** - **SHIPPED v11.16d6, 2026-08-31, EXACT-TIE form. Bands NOT built - see below.**
        BANDED LEXICOGRAPHIC ordering over all metrics, in a per-objective priority order. Superseded the two-key fallback on 2026-08-31 when the user generalized it:
        *"evaluate all rows by ALL known facts - what changes is the weight/priority. Roth Conversion
        Effectiveness might rank first by conversion tax savings, second by final Roth, third by
        break even, fourth by net wealth, fifth by remaining RMD, sixth by account spread, seventh by
        lifetime taxes, eighth by total spendable."* The two-key version was a 2-level case of this
        with a group label; this is the general form and it orders the whole table meaningfully.
        **Name it precisely: this is LEXICOGRAPHIC, not Pareto.** Pareto FILTERS (drops rows beaten
        on every metric, 136 -> 46); lexicographic ORDERS. They compose in that order and neither
        replaces the other.
        **BANDS ARE REQUIRED, not a refinement - measured.** A tie-break only fires when the higher
        key ties, and continuous dollar metrics essentially never do: net wealth has **118 distinct
        values in 133 rows**, so priorities 2-8 would decide 15 rows and an eight-level list would be
        seven levels of decoration. With a band of **1% of the metric's range**, priority 2 decides
        for **118 of 133** and the top group holds **10 plans** - which is precisely the shortlist
        the user was assembling by hand. Band is one number with a defensible default and no
        per-user tuning; it is a knob, and by far the smallest one in play.
        **`spend` is a poor leading key** (3 groups at every band - nearly every plan funds the goal)
        and a good late tie-break. Per-metric facts like that belong in the table, encoded once.
        **A single blended score stays rejected**: conversion savings top out at $2.28M here while
        net wealth runs ~$10M, so a blend sorts by scale and "rank 40" would silently mean "40th by
        net wealth" under a column headed effectiveness - a new lie replacing the old one.
  - [x] **P100b3c** - **SHIPPED v11.16d6 with `b3b`.** ONE shared default priority order, per-objective OVERRIDES only. Nine
        objectives x ~8 metrics is 72 ordering decisions to author and defend, which is exactly the
        kind of table that rots. Each objective overrides its leading metric or two and inherits the
        rest. Nine short overrides instead of seventy-two choices, and a new objective costs a line.
  - **This also fixes the instability**, which marking alone would not have: a row's net wealth does
        not depend on which plan is currently selected. **Caveat, and it is a real dependency:**
        `afterTaxNWCurrentDollars` is computed with `sharedFutureIRARate`, which falls back to
        `results[0]` when the heirs rate is unset - measured identical (0.12) across both runs, but
        not guaranteed by construction. **`P100b2` must therefore land with or before `P100b3`**, or
        the fallback ordering inherits the very instability it is there to remove.
  - **Why not simply evaluate everything - measured, not guessed.** Base sweep 1,535 ms; with the
        pool of 12, 6,238 ms; **392 ms per candidate**; so grading all 136 projects to **~55
        seconds**. That is the honest cost of the obviously-right answer, and it is why `P34` gates
        it. `P100b3` is what makes the table truthful at today's cost; `P100e1` is what eventually
        makes the question go away.
      Original text: Stop ranking unevaluated rows. `?? -Infinity` conflates "converting does not
      help this plan" with "this plan was never offered the chance". Rows outside the pool are NOT
      EVALUATED and must be shown as such - a distinct marker, sorted into their own group, never
      silently ordered as though measured. **This alone removes most of the reported confusion**,
      because **133 of 136 successful rows** are currently ranked on a value nobody computed for them - measured, not estimated. **Raising the pool cap alone does NOT fix this**: 9 of the 12 candidates returned `optConv === 0` and produced no row, so a bigger pool shrinks the tie without closing it - unless `P100b3a` also records those zeros, after which a bigger pool does convert directly into a bigger graded set.

  - **WHAT SHIPPED, and what did NOT.** `OPT_TIEBREAK_KEYS` + `OPT_TIEBREAK_DEFAULT` in
        `optimizer_core.js`, with an optional `tiebreak` array on any objective. Default order
        (user-approved 2026-08-31, option C): net wealth, final Roth, spend, lifetime tax, remaining
        IRA, break-even, then `_id` as a total-order backstop. **`conveffect` overrides it with the
        user's own order** - final Roth, break-even, net wealth, remaining IRA, account spread,
        lifetime tax, spend - because when two plans save the same tax by converting, more Roth is
        the better answer and net-wealth-first is a poor lead for a question about conversions.
        `taxflex` and `earliestbe` are untouched: they have custom rankers with their own tie
        handling and a blanket re-sort would undo what makes them custom.
        **EXACT ties only. Tolerance bands are NOT built** - that is the remaining half of `b3b`,
        and on the measured scenario it is not the urgent half, because `conveffect`'s 133 rows tie
        EXACTLY. Bands matter for objectives whose leading metric already discriminates.
  - **Verified on the user's own scenario, not inferred.** 151 of 152 rows are common to a run
        before and after adopting `IRA Draw 9%`, and **their relative order is identical - zero
        positions differ.** Only the current-plan row itself changes, which it should. Under
        v11.16d4 the same action moved a row from 103rd to 20th. Badge 967 (502 in-page + 465 node).
  - **A test caught a real weakness in the backstop.** `_id` was inside the subtracting chain, so a
        non-numeric id produced NaN, which is falsy, and the total-order guarantee silently
        evaporated - re-introducing array-order ranking one level down. It is now compared with
        `<`/`>` outside the chain. The test that found it ranked rows keyed `'x'/'y'/'z'`.

#### Stage C - SCORE THE RIGHT THING. Depends on Stage A only.

- [ ] **P100c1** - **`conveffect` measures an input cost, not effectiveness.** `_convSavings` is
      `baseRow.totals.tax - beResult.totals.tax`: TAX SAVED. The user says plainly that tax saved
      matters less than net worth, final Roth and break-even, which is a statement that the metric
      does not match its own name. Rank on OUTCOME instead: the after-tax wealth delta between a
      strategy and the same strategy without conversions. **Both operands are already in scope at
      `optimizer_ui.js:1546`** (`baseRow` and `beResult`), so the metric change is small; the column
      rename and the changelog entry are the real work. **Behavior change - ranking moves.**
      Keep the tax figure as its own column; it is still worth seeing, just not worth ranking on.

#### Stage D - THE PAYOFF. Answers complication 1. Gated on `H4`/`H5` from `P100a3`.

- [ ] **P100d1** - `dominatedBy(rows, metrics)` in `optimizer_core.js`: pure, UMD-exported,
      node-testable, no DOM. Metric set is the reported ones - after-tax NW, final Roth, spend,
      lifetime tax, break-even year, plus a safety measure once Stage E has one.
- [ ] **P100d2** - **hide dominated rows by default**, with a count and a "show all" escape. A row
      beaten on every metric by some other row is the right answer to no question and should not be
      in a table the user is scrolling. Cheapest large reduction in what the user reads.
- [ ] **P100d3** - **the frontier as the primary surface.** Every row on it is the best answer for
      SOME direction; everything off it is the best answer for none. This answers "I do not know my
      direction" **without asking the user anything**, which is the whole objective of `P100`.
      A weighted blend is explicitly REJECTED: it replaces one choice with five and nobody can
      defend their weights.
- [ ] **P100d4** - **cost-of-choice line** under the winner: "Best for Minimum Lifetime Taxes. Costs
      $X against Maximum Net Wealth." `P30h`'s 3-3 objective disagreement becomes information rather
      than a knob.

#### Stage E - NEEDS `P34`. Do not start before it lands.

- [ ] **P100e1** - **the pool cap of 12 IS the instability.** Either raise it until it stops binding,
      or make membership deterministic and independent of the user's own plan. **Acceptance test
      (`RS`):** change only the user's selected strategy and assert the set of `⇌` rows is unchanged.
- [ ] **P100e2** - `gapFillWeights` as a sweep dimension. Now `P102e1`; see that phase for the
      design. **The 378 figure was WRONG and it was the whole objection** - it assumed the dimension
      crosses every row. Only 3 of 8 families can feel it (Proportional, Reduce, Guyton-Klinger),
      and the clone passes clone `unmodified` only, so both endpoints cost **+22 rows on ~179**, not
      378. ~~126 rows x 3 positions = 378 before `P75`/`P35` add an arm.~~
- [ ] **P100e3** - **re-score the frontier under Monte Carlo before calling anything best.** A winner
      on one deterministic projection is a point estimate. "The tool does all the work" must not
      become "the tool overfit to a point forecast, confidently." Report near-optimal bands, not the
      argmax alone: a plan 0.5% behind on the goal and ahead on three other metrics is the better
      recommendation, which is the user's own "almost as good may be better" instinct.

#### Stage F - DESIGN. No dependency, but worth nothing until B-D land.

- [ ] **P100f1** - classify every sidebar input as **FACT** (only the user knows it: ages, balances,
      basis, spend goal, state, SS, pension, assumptions) or **POLICY** (the tool should decide it:
      strategy, limit, conversion switches, extra conversion, stop year, ordered sequence,
      Roth-before-Brokerage, gap-fill weight, cycle brokerage). The list IS the deliverable and it
      will be argued over. Today they are one undifferentiated sidebar, which is the "12 values"
      complaint in its concrete form.
- [ ] **P100f2** - the reorganized flow: enter facts -> pick one goal -> read the answer. Policy
      fields become OUTPUTS shown as "the plan we found", editable only behind an explicit override.

### What was considered and rejected, so it is not re-derived

| rejected | why |
|---|---|
| **weighted blend of objectives** | replaces one choice with five; the weights are undefendable and the user asked for LESS fuss |
| **objective becomes a strategy** (the user's option B) | an objective is a SCORING rule, not a withdrawal rule. Crosses 9 objectives x 12 strategies and rebuilds this problem one level down with 108 menu entries |
| **pick one objective and fix it** (option C) | right for the DEFAULT - it is what `balanced` already is - but it discards the evidence and does not help the user who wants a compromise |
| **`P30i`'s three-position gap-fill control** | ~~superseded by `P100e2`~~. **HALF WRONG, corrected 2026-09-01 (`P102`).** `rothGapFill` shipped BOTH a sidebar control and the sweep clone, and needed both: the row-click adopt path writes into a real control, so a swept dimension with no input is not adoptable. The control is the LANDING PAD for the swept row; `P102f` demotes it |

- **Status:** NOT STARTED. Stage A is the gate and `P100a1` needs the user's scenario.
- **Depends on:** Stages A-D depend on nothing outside this phase. Stage E depends on `P34`.
- **Priority note:** if this phase is accepted, **`P34` moves to O0** - it gates Stage E, and Stage E
  is where "the tool does all the work" actually becomes affordable.

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

## P95: an ACA share link does not round-trip  *(NEW 2026-08-29, found while verifying P94, O1, NOT A REGRESSION)*

`buildShareURL` emits an ACA plan as `?str=bracket&sr=aca400`. Loading that link lands the ceiling
dropdown on `10`, not `aca400`, so `getInputs().stratACAMultiple` reads **0** and the plan comes up
as **Fill Bracket 10%** - a different, much tighter strategy than the one shared, with no message.

Measured in the browser at v11.16aa, and **pre-existing on `main`**: `git diff main` on the P94
branch touches no `stratRate` code at all. `loadFromURL` sets the select correctly and something
after it rebuilds the option list - `refreshStratRateOptions()` is the obvious suspect, since
`applyScenario` calls it deliberately at `optimizer_ui.js:5429` and has a comment (`:5384`) about
exactly this failure mode on the SCENARIO path, where it was already found and fixed once.

- [ ] **P95a** - Find what rebuilds the list after `loadFromURL` and reapply the selection the way
      `applyScenario` does, or capture and restore it around the rebuild. Then check the IRMAA
      values (`IRMAA0`..`IRMAA4`) the same way - they are rebuilt by the same function and may have
      the same defect.
- [ ] **P95b** - A browser-tier test: every value the ceiling dropdown offers survives a share-URL
      round trip. A per-value loop, not one case, because the defect is per-option-family.

- **Status:** measured, nothing built. The user has not been asked about priority yet.

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

## P87: the "Limit" dropdown mixes two income bases - IRMAA is MAGI, the federal brackets are not  *(NEW 2026-08-29, user-raised, measure before building)*

**The question, as asked:** the tax-bracket limits in the strategy "Limit" dropdown are income
thresholds, but the IRMAA limits should be MAGI thresholds - are they?

**Answer: the IRMAA half is right. The federal half is the one on the wrong basis.** Both come out
of the same dropdown (`generateStratRateOptions`, `optimizer_ui.js:5995`), both land in the same
variable, and both are then spent by the same line of engine code - which treats every one of them
as a MAGI ceiling.

### The three ceiling kinds, and what each one actually is

| dropdown entry | table it reads | that table's true basis | what the engine compares to it | verdict |
|---|---|---|---|---|
| `IRMAA Tier n` | `TAXData.IRMAA.*.brackets` | **MAGI** = AGI + tax-exempt interest | MAGI-shaped aggregate | **right** |
| `n% Fed` | `TAXData.FEDERAL.*.brackets` | **taxable income**, i.e. AFTER the standard deduction (`std: 32200` is a separate field on the same object) | MAGI-shaped aggregate | **wrong by one deduction** |
| `n% FPL` (ACA) | FPL multiple | **ACA MAGI** = AGI + tax-exempt interest + ALL Social Security, taxable or not | MAGI-shaped aggregate | ceiling right, the overage check is wrong (below) |

### Where each claim comes from

- The IRMAA branch (`optimizer_core.js:912-937`) reads the IRMAA table, forward-indexes it by the
  two-year lookback (`irmaaFwdFactor`, `:214`), subtracts the `irmaaMarginMode` margin and then 1,
  so the ceiling lands strictly inside the tier. The charge itself uses
  `yr.tax.MAGI = federalAGI + taxExemptInterest` (`taxengine.js:1516`), which is SSA's definition.
  Nothing to fix here; P66 and P83 already did this work.
- The federal branch (`:957-967`) takes `findLimitByRate(...).limit` - the raw bracket top,
  `211400` for the 22% MFJ ceiling. That is an after-deduction number. Nothing adds the deduction
  back anywhere on the path.
- Both then reach the same sizing line, `optimizer_core.js:1964`:
  `iRAbracketRoom = yr.limit - yr.taxableInc - yr.fixedInc - yr.taxableInterest - yr.taxableDividends`
  Gross components, no deduction subtracted. And `bracketOverage = max(0, yr.tax.MAGI - bracketTarget)`
  (`:2233`, `:2475`) judges the result against MAGI **for every mode**, federal included.
- The function's own header already states the intent: "MAGI ceiling for bracket/minlimit/aca
  strategies" (`:854`). The intent is coherent; the federal numbers poured into it are not MAGI
  numbers.

### What it costs

"Fill the 22% bracket" stops when **MAGI** reaches the 22% top, so taxable income stops one standard
deduction short of it - about $32,200 MFJ in 2026, more with the two $1,650 age-65 bumps and the
$6,000-per-filer senior deduction (`optimizer_core.js:1359`). That is conversion and withdrawal room
the strategy was asked for and never used, every year, silently. Direction is always the same: the
plan under-fills. No cliff is ever crossed, which is why this has never announced itself.

### Second, smaller basis gap, and it points opposite ways in the two modes

`yr.fixedInc = yr.s1 + yr.s2` (`:1586`) is the FULL Social Security benefit. Which is correct depends
on the ceiling:

- **IRMAA and federal** want the TAXABLE portion, at most 85%. Using the full benefit overstates
  income by up to 15% of SS, so sizing undershoots the tier it is aimed at - conservative, and in
  the same direction as the deduction gap above.
- **ACA** wants the full benefit; the statute adds non-taxable SS back. Here the current code is
  right by accident of sharing the line.
- The mirror image shows up on the measurement side: `yr.tax.MAGI` has no non-taxable-SS add-back,
  so ACA's `bracketOverage` understates how far over the FPL cap a year actually went.

Interest and dividends in the same aggregate are beginning-of-year estimates, flagged in-code as
"APPROXIMATE worst case" (`:1589`). Same direction again.

### Why this is `measure first` and not a one-line fix

Every candidate fix MOVES the ceiling, so every bracket / minlimit / ACA row changes: withdrawals,
conversions, lifetime tax, the Optimizer ranking, the Break Even verdict. Nothing here will be
byte-identical, and P85's lesson applies - a "this cannot affect that" claim does not survive the
withdrawal feedback loop. Budget for a re-run of the sweeps that quote bracket rows, and for a
changelog entry saying saved plans will not reproduce.

- [x] **P87a** - **DONE 2026-08-29, and it inverted the phase.** `bracketbasis_harness.js`,
      `research/BRACKET_CEILING_BASIS.md`, 240 cells x 2 arms.
      **The defect is confirmed exactly:** a Fill Bracket 22% plan aims at $211,400, lands MAGI on
      $211,400 and federal TAXABLE income on $179,200, against a $32,200 deduction. To the dollar,
      every year, growing with indexation and the age-65 bumps to $70,876 by 2054. **Neither operand
      is wrong** - the bracket top is the right edge of the right bracket, and the deduction
      reconciles to the cent including the OBBBA senior deduction and its phase-out (2027 = $33,005
      std + $1,691 age bump + $1,999 senior, sunsetting to $0 in 2029). The defect is a UNITS
      MISMATCH: `iRAbracketRoom` subtracts GROSS income from a POST-deduction threshold and
      `bracketOverage` measures MAGI against it, so a pre-deduction quantity is capped at a
      post-deduction number and nothing in between converts one to the other.
      **Correcting it costs money in 51 of 74 clean cells, median -$47,092** - but see the user
      correction below, because that is a fact about the STRATEGY and NOT a verdict on the fix.
      The sign is set by the BRACKET: 12%
      gains (median +$159,278, best +$1,201,973), 22% loses (-$173,437, worst -$2,523,647), 24%
      loses (-$14,583). The separator is OVER years and nothing else - a cell that gains was already
      breaching its ceiling every year, so the ceiling was not governing it and lifting it turns a
      forced draw into an ordinary one (lifetime tax -$53,590); a cell that loses had ZERO OVER
      years, and lifting a ceiling that genuinely governed just draws more, earlier, for $314 of tax.
      **`minlimit` is out of the phase entirely:** 0 of 40 cells move, because its ceiling is
      `yr.IRMAALimit` built from the bracket top containing the SPENDING GOAL ($211,399 where Fill
      Bracket 24% aims at $403,550), so the federal side of the min is never selected. That also
      makes the "24%" in `Min Limit 24%` close to decorative - a separate question, not P87's.

      **USER CORRECTION, same day, and it overturns the verdict this task first drew.** The first
      reading was "the fix loses money, so the premise is refuted, so do not build `P87b`". That
      judges a CORRECTNESS question with a WEALTH metric. When a user picks `22% Fed` or `IRMAA
      Tier 2` the contract is FILL TO THAT LIMIT: fund the spending, convert or bank the rest. They
      are not asking the tool to minimize tax - if they were they would not have named a ceiling.
      Stopping one deduction short fails that contract whether or not stopping short leaves them
      richer. The 51-of-74 result stays TRUE and stays REPORTABLE; what it measures is that filling
      the 22% and 24% brackets is often a worse strategy than under-filling them, which is the
      Optimizer ranking's job to surface, not a licence for the engine to under-deliver the strategy
      that was selected. An accidental hedge is not a design.

      **TARGETS AND CAPS ARE DIFFERENT CONTROLS and one `yr.limit` carries both.** `n% Fed` and
      `IRMAA Tier n` are TARGETS - reaching them is success, stopping short is the defect. `n% FPL`
      is a CAP - staying under is success and a breach is the risk. The engine already splits them
      on BREACH behavior (soft cap with third-pass forced draws vs strict ACA with `acaBreach`); it
      does not split them on FILL behavior, and the target case is the one being let down.

      **AND NOTHING SIZES A CONVERSION AGAINST THE CEILING - measured, and larger than the deduction
      gap.** Over the same 74 clean cells, total voluntary draw rose in only 18, and of the extra
      draw only **32% became conversion**; the other 68% became IRA-sourced spending displacing
      Brokerage and Cash draws (delivered spend is identical by the CLEAN filter, so it is not new
      spending). Conversions were UNCHANGED in 29 of 74 cells. The code says why: the only two
      claimants on the headroom are `iRAbracketRoom` (`:1964`), which sizes the IRA WITHDRAWAL with
      spending funded first, and `extraConversionAmount`, which the user types and which is not
      ceiling-derived. `convertExcessToRoth` (`:2636`) calls itself "a pure REALLOCATION" of
      whatever after-tax surplus remains, capped by `netWithdrawals.IRA`; `applyConversionGrossUp`
      (`:3016`) grosses up that existing surplus and never reads `yr.limit`; "Maximize Conversions"
      is just those two flags together (`optimizer_ui.js:4705`), not "convert up to the limit".
      **User model: limit minus needed spending = conversion headroom. Engine model: the limit sizes
      a WITHDRAWAL and conversion is a downstream by-product of surplus routing.** They agree 32% of
      the time by dollars.

      Priority verdict: **P87 stays O2**, `P87b` is reclassified from optional optimization to
      correctness fix, and a new `P87g` carries the conversion-sizing gap.
- [ ] **P87b** - DECIDE the federal fix. **A CORRECTNESS fix, not an optimization** (see the user
      correction in `P87a`): a named ceiling is a contract to fill, and the engine fills one
      deduction short of it. The measured wealth cost is a CONSEQUENCE TO DISCLOSE, not a reason to
      decline - the changelog entry must say plainly that bracket rows will withdraw and convert
      more and that saved plans will not reproduce. The two forms, unchanged:
      **(i)** raise the federal ceiling to `bracket top + the year's deduction`, keeping the MAGI
      comparison. Must read the SAME deduction `calculateTaxes()` uses (std + age bumps + senior
      deduction with its phase-out), or the ceiling and the tax disagree - a second source of truth
      for the deduction is the failure mode to avoid.
      **(ii)** compare federal-mode ceilings against taxable income instead of MAGI. Narrower blast
      radius in the sizing line, but it forks `bracketOverage` by mode.
- [x] **P87c** - **DONE and SHIPPED v11.16d4, 2026-08-31.** The SS term in the sizing
      aggregate: taxable portion for IRMAA/federal, full benefit for ACA. Measured shape is in
      `research/BRACKET_CEILING_BASIS.md` section 9 - `short / SSincome` is `0.150000` exactly, min
      equal to max, in every affected year on every ceiling family, worth $168,500 of unused headroom
      on one $2.8M Fill Bracket 22% fixture. Harness `.test_harnesses/underfill_harness.js`, re-run
      2026-08-31 and reproduces to the dollar.
      **The circularity is real but may be inert in the binding regime.** `calculateTaxableSocialSecurity`
      (`taxengine.js:1290`) is monotone non-decreasing in provisional income and CAPPED at
      `0.85 * totalSS`. A plan filling a 22% bracket or an IRMAA tier is far above the second
      threshold ($44,000 MFJ, never indexed), so the cap binds and the taxable share does not move
      with the draw at all - which is exactly why the measured ratio is a constant. Whether that
      holds at the LOW ceilings (10%/12% Fed, low FPL multiples) is the open question, and it decides
      the fix.
  - [x] **P87c1** - DONE. MEASURE the regime split before building, `P87a` precedent. Across the grid, in
        years where a ceiling binds: is `taxableSS` pinned at `0.85 x SS`, in the 50% tier, or 0?
        Needs `-taxableSS` in the log (hidden field, same precedent as `-fedTaxableInc` /
        `-fedDeduction`). If the cap binds everywhere a ceiling does, a closed-form subtraction is
        enough; if the sloped tiers appear, `P87c2` must solve the fixed point.
  - [x] **P87c2** - DONE. BUILD behind a default-off research input, two-arm harness, cost measured on the
        same grid `P87a` used. MAGI is piecewise-linear in the draw with slope 1, 1.5, 1.85 or 1
        (capped), so the fixed point is exactly solvable and iteration is a fallback, not the design.
        **ACA keeps the full benefit** - the statute adds non-taxable SS back, so the fork is by
        ceiling KIND, not one global change. Read the SAME taxable-SS function `calculateTaxes()`
        uses; a second source of truth for the SS split is the failure mode `P92a` warned about for
        the deduction.
  - [x] **P87c3** - DONE. SHIP: default on, tests (`P87e` shape), `TestTiers.EXPECTED` reconciled across
        all three suites, changelog entry saying bracket and IRMAA rows draw and convert more and
        saved plans will not reproduce.
  - [ ] **P87c4** - **NEW, found while shipping `P87c`, NOT fixed.** The SAME full-benefit
        subtraction survives in the brokerage-harvest branch (`optimizer_core.js`, the
        `isBrokerageYear` arm): `_baseOrdinaryInc` includes `yr.fixedInc`, and it is compared against
        a MAGI ceiling in the LTCG top-off guard. That branch runs INSTEAD of the sizing line, so a
        harvest year still stops short. Left out of `P87c` on purpose - the same aggregate also
        feeds `getLTCGBracketRoom`, where the right basis is a different question, so correcting it
        needs its own measurement rather than a copied line. No fixture in the `P87c` grid enables a
        harvest cycle, so nothing in section 10 measures it either way.
  - **Cost is a consequence to disclose, not a reason to decline** - the `P87a` user correction
        applies unchanged. A named ceiling is a contract to fill.
- [ ] **P87d** - ACA overage: either add the non-taxable-SS add-back to a separate `acaMAGI`, or
      state in the tooltip that the ACA overage reads low. Do not change `tax.MAGI` itself - IRMAA
      and NIIT read it and their definition is the current one.
- [ ] **P87e** - Tests: a fixed plan on `22% Fed` lands federal TAXABLE income on the bracket top,
      not MAGI; a plan on `IRMAA Tier 1` keeps `tax.MAGI` inside the tier (already covered, keep it
      green); an ACA plan with large SS is measured against the add-back definition.
- [ ] **P87f** - The dropdown prints `22% Fed  ·  $211,400` and never says WHICH income that is;
      the honest answer today is "MAGI, though the number came from a taxable-income table". Label
      it, and say the same in the README's strategy section. **Valuable but not the whole answer** -
      naming the basis helps a reader understand the ceiling; it does not deliver the headroom they
      asked for. If `P87b` ships, this label changes with it.
- [ ] **P87g** - **NEW 2026-08-29, user-raised, and larger than the deduction gap.** Nothing in the
      engine converts INTO the ceiling on purpose. A user who picks a limit expects the room between
      their spending and that limit to become a Roth conversion (or to be banked); the engine sizes
      a WITHDRAWAL against the limit and lets conversion fall out of surplus routing, which delivers
      32% of the extra draw as conversion. Design decision, not a bug fix, and the shape is not
      obvious: it interacts with the Cash Reserve (P2), the gap-fill order (P30), and
      `fundConversionWithCash`. That last one was flagged here as "grosses up a conversion without
      checking `yr.limit`, worth confirming separately" - it was confirmed, and it is worse: see
      **`P88`**, where neither additional-conversion path reaches `yr.tax.MAGI` at all, so nothing
      downstream can see the breach.
      Measure before building, same as `P87a`: how much conversion would a "fill the headroom" rule
      actually add, and what does it cost. **BLOCKED ON `P88`** - sizing conversions against a
      ceiling is meaningless while conversions are invisible to that ceiling's own income measure -
      and `P87b` should land before it too, or the basis error gets baked into a second place.
- **Status:** `P87a` DONE 2026-08-29; its first verdict was overturned by the user the same day; `P87b` reframed from
  `P87b` reclassified as a correctness fix with a disclosable cost, `P87f` kept but demoted from
  "the whole answer", `minlimit` dropped from scope, and `P87g` opened for the conversion-sizing
  gap. `P87c`/`P87d` are untouched by the measurement - it armed the deduction leg only, not the
  Social Security basis and not the ACA add-back. `P87d` gains weight from the target/cap split:
  ACA is the one entry in the dropdown whose job is to stay UNDER, so its overage reading is the
  number that matters for it.
- **Depends on:** nothing. P66/P83 already settled the IRMAA indexing and margin.
- **Left in the engine by `P87a`:** the research-only input `bracketCeilingAddDeduction`, default
  off and set by no UI (`optimizer_core.js:980`), and two hidden log fields, `-fedTaxableInc` and
  `-fedDeduction`. All three are inert unless the harness arms them.

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

## Open Task Index — edit the **User Priority** column

Buckets: **O0** do next, **O1** soon, **O2** queued, **O3** someday. Lettered `O`, not `P`,
because every phase ID starts with `P` and a bare `P2` would be ambiguous. Ties inside a bucket are broken
by the order of the rows. This table is the only place priority is recorded; the phase sections below
stay in numeric order so links do not move when you re-prioritise.

Sub-item IDs are `<phase><letter>` in the order the items appear in that phase, e.g. `P36a` is P36's
first task. Every open item in the file now carries one.

| User Priority | ID | Phase | Next open item | Blocked by |
|---|---|---|---|---|
| ~~DONE~~ | ~~P64~~ | ~~SALT deductibility - `propTax` never reached the engine, elevated cap died a year early~~ - **COMPLETE, a-f v11.15b7 (`49509e9`) + `P64g` in PR #184** | - | - |
| ~~DONE~~ | ~~P66~~ | ~~IRMAA tier ceiling aimed two years of inflation too low~~ - **COMPLETE, v11.15cf (PR #182/#183)**, plus a hidden selectable safety margin | - | - |
| **O0** | P35 | Phased strategy; **basis step-up shipped v11.1499** | `P35i` (the Phased engine) | nothing hard |
| ~~DONE~~ | ~~P32~~ | ~~Brokerage barely drawn; is the third-pass exclusion still right?~~ - **COMPLETE 2026-08-21.** Premise refuted (Q1), dividend double-credit fixed, the cap-gains spiral measured and REFUTED (Q2, 0 capped years in 3,960 armed runs), and the exclusion re-scoped at **v11.15e3** | - | - |
| ~~DONE~~ | ~~P58~~ | ~~Withholding assumed on money already moved, plus the forced-quarterly double payment~~ — **COMPLETE, v11.159d (`0bc7ba0`)** | — | — |
| ~~DONE~~ | ~~P56~~+~~P57~~ | ~~Five-plan matrix, one cost table, and every statement attributed to one plan~~ — **COMPLETE, v11.1599 (`6e74f1f`)** | — | — |
| ~~DONE~~ | ~~P67~~ | ~~Optimizer table columns + relative view~~ — **COMPLETE v11.15fd**, PR #186 | — | — |
| **O1** | P36 | Phased efficiency study — **round 1 DONE 2026-08-10** | `P36b` round 2 | `P35i` |
| **O1** | P51 | Perfect-foresight oracle — **a-c,e-g DONE 2026-08-10**, gap table delivered | `P51d` cross-check | nothing |
| ~~DONE~~ | ~~P30~~ | ~~Withdrawal policy — the `[40,60]` constants nobody chose~~ - **COMPLETE, `P30a`-`P30g`, v11.163F**; the menu shipped, both constants measured and left alone | - | - |
| **O2** | P19 | taxengine.js — 13 of 51 jurisdictions still uncoded | `P19f` | nothing |
| **O1** | P34 | Cost of finding a profitable conversion; worker + per-row memo | `P34a` | nothing |
| **O1** | P84 | Annual advisor / AUM fee, **plus RMDs off the prior Dec 31 balance** (today they key off a mid-year balance whose growth depends on whether the plan converted) *(new 2026-08-28)* | `P84k` (the RMD half; runs before `P84a`) | nothing |
| ~~DONE~~ | ~~P93~~ | ~~Name the year the assets belong to~~ - **COMPLETE v11.16a9.** "Assets at Retirement Age" now names its year, from the same `planFirstYear` the engine uses. The tool has no accumulation phase and now says so instead of implying it | - | - |
| ~~DONE~~ | ~~P91~~ | ~~Stress Test's first result used a stale plan horizon~~ - **COMPLETE v11.16a5.** A displaced stress refresh was dropped and never retried, so the headline settled on the pre-load plan: `8 / 36` where the truth is `0 / 40`. Coalesced; the full sweep's silent staleness fixed with it | - | - |
| ~~DONE~~ | ~~P90~~ | ~~Two chart fixes~~ - **COMPLETE v11.16a4.** The Market Return chart's historical source year is no longer nerdknob-only, and the Income & Expenses tooltip reports what a source actually paid instead of its scaled bar height | - | - |
| ~~DONE~~ | ~~P89~~ | ~~The ACA age gate read a year the plan does not start in~~ - **COMPLETE v11.16a4.** The advisory fired for every Limit choice, named a year and two ages the plan never used, and the same unclamped expression decided whether ACA rows reach the Optimizer. One shared `planFirstYear` now; measured at 22.2% disagreement, one-way | - | - |
| ~~DONE~~ | ~~P88~~ | ~~An Extra Roth Conversion never reaches `yr.tax.MAGI`, so the IRMAA lookback charges a figure that omits it - measured at a whole tier ($0 recorded where $7,166/yr was owed). Hits every strategy, not just the ceiling families, and biases the Optimizer's conversion search toward larger conversions *(new 2026-08-29, user-raised)* - **COMPLETE, SHIPPED v11.16a4.** MAGI now carries both conversion paths, the overage column sees them, 8 tests added (suites 366), a warning names the conflict at the input and a `⤴` marks it in the Optimizer. Lifetime IRMAA +30% to +132% at a $100k conversion; the Optimizer offers 61 ceiling rows that all breach, worth a median $53,990 each, so they are marked rather than dropped | - | - |
| **O2** | P87 | The "Limit" dropdown mixes two income bases: IRMAA tiers are MAGI thresholds (right), federal brackets are taxable-income thresholds spent as MAGI ceilings (wrong by one standard deduction) *(new 2026-08-29, user-raised)* - **`P87a` MEASURED 2026-08-29: the gap is exactly one deduction, and closing it LOSES money in 51 of 74 clean cells. Premise refuted; `P87f`, labelling the income basis, is what survives** | `P87f` | nothing |
| **DONE** | P52 | MC run scope: nerdknob "Run My Plan Only" *(default later flipped by P53f)* | shipped v11.150b | - |
| **DONE** | P53 | Monte Carlo Stress Test suite (5 windows, bear-start, plan-only default) | shipped v11.1521-152f (#170) | - |
| **DONE** | P54 | `?montecarlo` teaching demo + mode-aware paths floor | shipped v11.1553 (#173) | - |
| **O2** | P33 | Insights panel — where the money came from | `P33a` | nothing |
| **O2** | P29 | Hebeler Autopilot — worth a strategy slot? | `P29a` | nothing |
| **O2** | P31 | Asset mix is an OUTPUT — the reverse mapping | `P31a` | nothing |
| **O2** | P24 | Conversion stop-year as an Optimizer sweep dimension | `P24g` | P34 cost work |
| **O2** | P27 | Assumption sensitivity, a tornado over the guesses | `P27a` | nothing |
| **O2** | P4 | Creeping tax rate — Annual Details column + state-creep UI | `P4e` | nothing |
| **O2** | P22 | Export Annual Details to CSV | `P22a` | nothing |
| **O2** | P12 | Retire Optimizer tab -> MC strategy comparison | `P12a` | nothing |
| **O2** | P13 | Multi-Strategy Segment Optimizer — **retire this if P35 ships** | `P13a` | P35 outcome |
| ~~DONE~~ | ~~P23~~ | ~~MC arithmetic-mean returns + AR(1) variable inflation~~ - **COMPLETE 2026-08-23, v11.160F, merged with 7 addenda through v11.161B in PR #188.** Shipped as a THIRD mode (Synthetic-AAM) rather than a GBM replacement, both synthetic modes given calibrated AR(1) inflation correlated with returns. Suite 300 | - | - |
| ~~DONE~~ | ~~P71~~ | ~~Dedup the MC engine: one runPass instead of two mirrors~~ - **COMPLETE 2026-08-23, v11.161C-F, committed `b7f8808` and merged.** 455+567 lines of mirror -> 42+203 lines of shell around one `mc_engine.js`; suite 300 -> 304. Maps caught up in `fb6675c` | - | - |
| ~~DONE~~ | ~~P69~~ | ~~Replay: walk one MC or Stress sequence through the main model~~ - **COMPLETE 2026-08-26, v11.1657**, all of `P69a`-`P69h` | - | - |
| ~~DONE~~ | ~~P70~~ | ~~Do high-inflation paths overstate tax? Brackets index at the fixed CPI rate while spending inflates per path~~ - **COMPLETE 2026-08-26, `P70a`-`P70i`, v11.165D-11.1662, merged in PR #195.** Measured at -8.3% lifetime tax and 38 invented failures, then fixed with the two-clock spread model (`fixedTaxIndexing`, default off) and a five-way pension COLA cap | - | - |
| ~~DONE~~ | ~~P81~~ | ~~The inflation floor guards the DRAW, not the derived index~~ - **COMPLETE.** `a`/`b`/`d` v11.1662 (PR #195) clamped `cpi_t` where it is computed; **`P81c` v11.1667** gave Social Security the statutory high-water rule and a capped pension a per-year zero floor | - | - |
| **O1** | P75 | Year-by-year withdrawal/conversion optimization - income-target reframe, edge menu, coordinate descent *(new 2026-08-25)* | `P75a` (measure first, gates the phase) | nothing |
| ~~DONE~~ | ~~P78~~ | ~~Edit the plan against a pinned replay path~~ - **COMPLETE v11.1670.** "Keep path while editing" on the banner; the handoff lands at lock time rather than on the first edit, for a reason the plan had not seen | - | - |
| ~~DONE~~ | ~~P79~~ | ~~Draw the 10 captured paths on the survival chart~~ - **COMPLETE v11.1670**, click one to replay it; the `% 5` dataset grouping had to be bounded first | - | - |
| **O1** | P80 | Nerdknob: the historical years behind each bootstrap block *(new 2026-08-26)* | `P80a` | nothing (P69 merged in PR #194) |
| **O2** | P37 | LEGACY / heir 10-year drawdown | — | **deferred by you** |
| **O2** | P48 | README caveats backlog | — | **deferred by you** |
| **O2** | P63 | State safe harbor generically — DEFERRED, but it exposed two live bugs *(section existed since 2026-08-18 with no index row)* | `P63a` (dead pro-rata flag) | `P63b` blocked on P63 proper |
| **O2** | P68 | `optimizer_changelog.md` brevity pass over the recent entries *(new 2026-08-22)* | `P68a` | nothing |
| **O2** | P72 | First-year stub — year 1 always accrues 12 months of growth, spending, pension and premiums however late in the year the plan starts *(new 2026-08-24)* | `P72a` | nothing |
| ~~DONE~~ | ~~P73~~ | ~~Sorting the Optimizer by **Strategy** sorts the rendered label~~ - **COMPLETE v11.1640 2026-08-25**, family then parameter then modifier, off the data | - | - |
| **O2** | P65 | Rest of Schedule A — engine itemizes on SALT alone; medical is the piece that likely qualifies *(new 2026-08-19)* | `P65a` (measure first) | nothing |
| **O2** | P55 | MCP server — let an AI run the engine over a customer's scenario *(new 2026-08-16, set priority)* | `P55a` | nothing (engine is DOM-free) |
| **O2** | P28 | "Every voluntary IRA withdrawal is a conversion" - **`P28f`/`g`/`h` SETTLED and SHIPPED v11.162B**: routing flag deleted as measured-inert, `rothGapFill` shipped as a control plus the 🅡 sweep rows. `P28j` is the remainder | `P28j` (needs its own phase) | nothing |
| **O3** | P40 | Test-file layout — the `tests/` subfolder move | decision, then the move | nothing |
| **O3** | P5 | Per-year conversion schedule - greedy forward search, one year at a time | `P5a` | nothing |
| **O3** | P6 | Simulation sanity-check tests | `P6a` | nothing |
| **O3** | P8 | Annual-table view presets | `P8a` | design after P22 |
| **O3** | P9 | ACA refinement remainder | `P9a` | nothing |
| **O3** | P10 | Equity data -> Fama-French total market | `P10a` | nothing |
| **O3** | P11 | RealReturns — intl asset + annual-returns mode | `P11a` | nothing |
| **O3** | P14 | Regime-switching MC | `P14a` | P23 |
| **O3** | P16 | Responsive layout, all tools | `P16a` | nothing |
| **O3** | P17 | Retirement_Projection simple mode | `P17a` | nothing |
| **O3** | P18 | Retirement_Projection -> RetirementTaxPlanner link | `P18a` | nothing |
| **O3** | P26 | README/FAQ cross-references from tooltips | — | nothing |
| ~~DONE~~ | ~~P41~~ | ~~Pension start age *(was PA)*~~ — **7 of 7 done, v11.14bf** | — | — |
| **O3** | P42 | Lumpy spending, no URL encoding *(was PB)* | `P42a` | nothing |
| **O3** | P43 | Auto-persist + restore offer *(was PC)* | `P43a` | nothing |
| **O3** | P44 | Onboarding interview *(was PD)* | `P44a` | nothing |
| **O3** | P45 | Insights / feedback panel *(was PE)* | `P45a` | nothing |
| **O3** | P46 | Tax Payment Planner backlog, TPP-1 + TPP-2 *(was TPP-1..5)* | TPP-1 (prose, no checklist yet) | nothing |
| ~~DONE~~ | ~~P49~~ | ~~Horizon-aware suggested spend~~ — **SHIPPED v11.14c6** | — | — |

**Why P35, P32 and P56 are the O0s.** P35 carries the brokerage basis step-up, which is not a feature
but a correction: the terminal valuation taxes heirs on gains §1014 steps up in full, and because Roth
and Cash are unaffected the error runs one way, **in favor of Roth conversions**, through Break Even
and every "Optimize for" ranking. Nothing measured on top of it is trustworthy until it lands. P32 is
O0 for the same reason at smaller scale — its audit found a real defect and its own premise was
refuted, so the section is currently half true. P56 is the same species of problem in the Tax Payment
Planner: two cost tables built on different clocks can print opposite verdicts for the same scenario,
and one of them is anchored to the wrong month, so the advice on screen can be simply wrong.

---

## ID migration table

| Old | New | Note |
|---|---|---|
| `PA` | `P41` | |
| `PB` | `P42` | supersedes the old `P3`, which is archived |
| `PC` | `P43` | |
| `PD` | `P44` | supersedes the old `P7`, which is archived |
| `PE` | `P45` | |
| `TPP-1`, `TPP-2` | `P46a`, `P46b` | TPP-3/4/5 shipped and are archived |
| README Caveats Audit | `P48` | |
| P35 `PR 1`..`PR 8` | `P35a`..`P35m` | see the alias in each P35 task line |
| P35 `PR 3a`/`3b`/`3c`/`3d` | `P35c`/`P35d`/`P35e`/`P35f` | cited by these old names in merged PRs #147/#149/#150 |
| P35 `PR 4` (code) | `P35g` | the brokerage basis step-up |
| P35 `PR 4` (README) | `P35h` | was a **duplicate `PR 4`**; now its own ID |
| P36 `PR 1`.. | `P36a`.. | |
| P36 "run it twice" `P36a`/`P36b` | `P36 round 1` / `P36 round 2` | renamed to stop colliding with the new sub-item letters |
| `P20` + `Table of Contents` | — | duplicate pair, both complete, archived |
| `PF11` (two headings) | — | the DONE one and its SUPERSEDED original, both archived |

---

---

## Recent state and trail

Goal: Complete open features from the original priority list plus deferred items from the UX batch. All completed phases archived in `task_completed.md`.

**As of 2026-08-15 (resync).** `main` = `310b23d`, shipped **v11.1553**, working tree clean, nothing
in flight. The last planning-doc update was **PR #166** (v11.14e1, 2026-08-10); **PRs #167-#173 shipped
without touching these files**, so this block catalogues them. The open queue did **not** change: none
of #167-#173 completed an O0/O1 item (P35/P32/P51/P30/P19/P34 all still open). Test counts moved:
**node core 263 / TPP 32 / doclinks 22 / slowInCore 3** (`TestTiers.EXPECTED`, `optimizer_tests.js:2220`);
**browser self-test 559** at v11.1553 (per PR #173; was 529 at v11.14dd).

Shipped since the last sync, newest first:
- **#173** (v11.1553, 08-15): fold the Experiment box, drop redundant BASELINE/CURRENT words; add
  `?montecarlo` teaching demo + mode-aware paths floor; adopt author's updated README Monte Carlo section.
  **Phased retroactively as P54.**
- **#172** (08-14): GA + Cloudflare analytics on the Jekyll-rendered pages. **Un-phased.**
- **#171** (08-14): Income Tax Planner visual bugs - NIIT line follows MAGI, chart NIIT dollars, SS cap,
  ordinary scrubber. **Un-phased.**
- **#170** (v11.1521-v11.152f, 08-13): Monte Carlo **Stress Test** feature batch - bear-start 3/5/10yr
  windows, memoized start-year ranking, plan-only default run, combine-all-windows, NaN/blank-Paths
  fixes. **Phased retroactively as P53** (note: P53f's plan-only default reversed the P52 decision).
- **#169** (v11.150b, 08-12): **P52** MC "Run My Plan Only" nerdknob + 6 Stress Test refinements.
  P52 is DONE - see its section (line ~2325) and the index row.
- **#168** (v11.1508, 08-12): sync the staleness guard to the tests on disk (244 then; 263 now) + doc refs.
- **#167** (08-11): Roth + tax info README revamp for clarity. Docs.
- **#166** (v11.14e1, 08-10): brokerage research program - the last planning-doc update; closed
  P32e/f/i and P35n, added the P51 oracle phase. Already reflected in the sections below.
- **#160-#165** (v11.1499 and earlier, 08-07..08-10): P35f/g §1014 step-up (#160), tool-eval FAQ (#161),
  P49 + P41d/g suggested-spend (#162, v11.14bf/14c6), spend-goal-restore bug (#163), Ordered surplus-fill
  (#164, v11.14dd), and the progress log of all of it (#165). All reflected in the NOW block and index.

**Prior snapshot, kept for the trail:**

**As of:** 2026-08-07, morning. **Working tree clean, `main` = `28a3395`, shipped version v11.147c.**
Everything below is merged; nothing is in flight.

- **P39 is COMPLETE.** All six items shipped, plus the hook-completeness follow-up as
  [PR #157](https://github.com/nightskyguy/retirement_assets/pull/157). The three node suites now
  run in the browser after paint behind a three-state badge (`4983e7a`, `bc2e063`), the three slow
  tests are tagged (`4d76d51`), `?runtests` forces a full synchronous 513-test check (`e4949a4`), a
  staleness guard pins the per-suite counts (`238f5ef`), and ten shipped-defect regression guards
  are marked `★ CRITICAL` in the console (`dedc944`). Pre-commit hook blocks a failing suite
  (`ad9529f`) and an unlisted `*.tests.js` suite (`475a2c4`).
- **P40 is HALF DONE and its second half is now UNBLOCKED.** The rename `.test.js` -> `.tests.js`
  landed (`db363ba`). The `tests/` subfolder move was deferred **until after P39 items 2-6**, and
  those are now merged, so the stated blocker no longer exists. The move is a decision waiting to be
  made, not a blocked item. `.tests/` and renaming `optimizer_tests.js` stay REJECTED.
- **README / docs, [PR #158](https://github.com/nightskyguy/retirement_assets/pull/158):** there is
  no basis step-up at death, at either death, and the terminal valuation taxes heirs who in reality
  owe nothing (`99fc632`, `8d47e3e`). Documented in **Limitations and Restrictions** with the
  direction of the bias stated (overstates survivor capital gains tax, understates survivor spending
  power and terminal wealth, net effect systematically **favors** Roth conversions) plus a
  cross-reference from the DRIP basis FAQ. Not a code change; the README itself says the code fix is
  planned.
- **ARCHITECTURE.md corrected twice:** nine measured defects (`a03d353`), and the claim that the
  node suites never run in the browser, which P39 items 3-6 made false (`f9352a5`).
- Test counts at `main`: **node 214/32/22** (pinned in `TestTiers.EXPECTED`, `optimizer_tests.js:2220`),
  **in-page 245**, **513 total in the browser**, `sweep_golden` content-identical.

Prior state, 2026-08-06 (`main` = `10f6f2a`, v11.1478), kept for the trail:

- **P38 is COMPLETE**, all three PRs merged: PR 1 + PR 2 (funding invariant + gate widening,
  v11.1468) as [PR #152](https://github.com/nightskyguy/retirement_assets/pull/152) (`f524105`), and
  PR 3 (size the draw net of tax on guaranteed income, v11.146a, `018baa9`) as
  [PR #153](https://github.com/nightskyguy/retirement_assets/pull/153).
- **P32 is PARTIALLY DONE**, research half landed as
  [PR #155](https://github.com/nightskyguy/retirement_assets/pull/155) and
  [PR #156](https://github.com/nightskyguy/retirement_assets/pull/156). Q1 measured, the mandated
  accounting audit found a real defect, and **the phase premise is refuted**: Brokerage is drawn
  constantly. See the P32 section and findings.md (2026-08-06) for what is now open.
- **Two engine correctness fixes shipped in that batch**, both of the same class - a function that
  was unit-tested directly while its *use* was not:
  1. **Dividends and interest were credited twice** (`e9a3c8b`, v11.146f). The dollar both reduced
     the needed withdrawal and stayed on the balance sheet. Moves everyone's numbers, downward.
  2. **The OBBBA senior deduction and elevated SALT cap were never switched on** (`c9e356a`). Both
     flags default false and no call site in `optimizer_core.js` ever passed them, so federal tax
     was too HIGH for anyone 65+ in 2025-2028 and for high-tax-state itemizers in 2025-2029. Gate is
     now resolved once per year in `resolveHousehold` and passed to all 10 `calculateTaxes` sites.
     Forced-IRA iteration cap 4 -> 6 (the lower tax bill lengthened the convergence path).
     **This fix had no plan phase of its own**; it was found while verifying a user report.
- Changelog consolidated: 11.146b/146e/146f + OBBBA merged into one **v11.1478** release entry
  (`05350e0`), and 11.1462/11.1468 folded into their neighbours (`912fd13`).
- Test counts at `main`: **node 214/32/22, in-page 245/245**, `sweep_golden` content-identical.

Earlier state, kept for the trail: **P35 PR 1 + PR 2 MERGED as [PR #146](https://github.com/nightskyguy/retirement_assets/pull/146)** (nothing user-visible, so no version or changelog entry); P38's diagnosis-only planning files merged as [PR #151](https://github.com/nightskyguy/retirement_assets/pull/151) off `main` = `fe72bef`, v11.1464.
**P35 PR 3a MERGED as [PR #147](https://github.com/nightskyguy/retirement_assets/pull/147)** (v11.1447, behavior change). **P35 PR 3b MERGED as [PR #149](https://github.com/nightskyguy/retirement_assets/pull/149)** (v11.1448 tokens, byte-identical, plus the doc file-reference gaps); the duplicate attempt PR #148 on branch `worktrees/medicare-age-data-7b2e91` is **CLOSED, not merged** — verified, nothing to do about it.
**P35 PR 3c MERGED as [PR #150](https://github.com/nightskyguy/retirement_assets/pull/150)** (v11.1462 -> v11.1464 on merge, behavior change confined to `aca` rows, proven against `propwd`/`bracket` controls), four commits: the behavior change, the `eitherOnMedicareAtStart` deletion it made possible, the plan record, and the ACA Cliff un-gating. Next review point after it is **PR 3d** (`Basis <= Brokerage` invariant).
Everything through PR #146 is merged: #135 (PR-A..PR-G, v11.13a1), #136 (planner rollover math), #137 (nerdknob graduation, v11.13bd), #138 (TPP-3/4/5 + brokerage handoff, v11.13c3 / planner v1.13be), #139 (P25 docs rendering, v11.13c5), #140 (README audit round 3 + doc-link labels, v11.13d0), #141 (P28 unified-conversion harness + P27 assumption-sweep scoping), #142 (README caveats for uncovered tax situations, BETR/conversion-order revisions, Stonewood/ThunderHarbor reviews), #143 (P29-P34 phases added to this file), #144 (`assertUngated` no longer fails on pages without the control), #145 (P35/P36/P37 phases added to this file, `6f94c82`). Next work starts from a clean base.

**Current batch (added 2026-08-01):** six new phases P29-P34 from a user punch-list — Hebeler Autopilot, withdrawal policy, asset-mix reverse mapping, brokerage draws, an Insights statistics panel, and conversion-search cost. Four of the six touch questions this repo has ALREADY partly answered, two of them answered NO, so every one of those phases carries an explicit "already ruled out, do not re-derive" block. Read that block before designing anything in the phase; it is there to stop a re-derivation of P24 and P28.

**Added 2026-08-03:** three phases P35/P36/P37 from a user design proposal — a new **"Phased"** withdrawal strategy that switches behavior by life phase, its efficiency study, and a deferred LEGACY heir-drawdown phase. P35 is an alternative answer to the long-pending **P13**, and it carries a ten-item engine survey in `findings.md` ("P35 engine survey", 2026-08-03) that must be read before any code is written: several of its items are traps where the natural implementation produces a plausible wrong answer rather than an error. **Work is to be performed in stages**, PR by PR, with a review point between each.

VERSION COLLISION HAZARD, seen for real here: the minor is `hex(dayOfYear*24 + hour)`, so two branches worked on in the same afternoon produce ADJACENT numbers, and whichever merges first is not necessarily the lower one. P25 was built as v11.13c2 (hour 18) but PR #138 merged v11.13c3 (hour 19) ahead of it, so P25 was renumbered to v11.13c5 on merge. When resolving a version conflict, recompute from the clock rather than taking either side.

**P38 and P39 both SHIPPED and are archived** (`.planning/task_completed.md`). P38 was the shipped correctness defect where `propwd`, `fixed`, `gk` and the baseline `else` branch reported `success: false` with hundreds of thousands of dollars of unfunded spending while the IRA still held seven figures; its diagnosis is in findings.md, "The baseline/proportional strategy family cannot fund its own tax bill once the taxable accounts run dry" (2026-08-05). It overlapped P30 and P32, so read it before starting either.

**P39** made the 268 node-only tests visible in the browser, so a broken node suite is no longer invisible at release time. Its GOTCHA is still live: cache tokens must move with any engine file the test tier depends on, and a warm tab keeps requesting the old token regardless. That cost is now part of P40's `tests/` move.

MAINTENANCE NOTE: a stale "uncommitted" in this trail reads as a live claim about the working tree, so update it in the same turn you commit, not later. **This section is no longer what the hook injects** - measured 2026-08-07, the hook is `head -50` of this file on UserPromptSubmit and `head -30` on *every* PreToolUse, so the injected window is now the **NOW** block at the top and nothing here. That is the point of the reordering: the per-tool-call window carries the live queue instead of finished-work narrative.

## P19: taxengine.js Architectural Cleanup
**Why:** A full review of taxengine.js (2026-07-02, see `~/.claude/plans/review-taxengine-js-for-1-groovy-balloon.md`) found the circular core.js↔taxengine.js dependency — **fixed same session**: `getRateBracket`, `findLimitByRate`, `findUpperLimitByAmount`, `calculateProgressive` moved from core.js into taxengine.js (new "Bracket utilities" section right after `RMD_TABLE`), so taxengine.js no longer depends on core.js while core.js still depends on taxengine.js (one-directional now). Also fixed as part of that pass: dead `Retirement_Projection.html` polyfill removed (it now transparently uses the real taxengine.js functions), 5 low-risk comment/dead-code fixes in taxengine.js, and a live CPI-inflation-drift bug in `Retirement_Projection.html` (AL/MT/ND/OH/SC brackets were incorrectly inflating). node 51/51 + browser 240/240 verified after each change. The items below are the findings from that review NOT yet addressed.

- [x] **P19a** — **Bracket-walk consolidation:** DONE (d52ffac, 2026-07-07). `findBracketIndex()` helper added; `calculateProgressive()` gained a `startPosition` param so the capital-gains split reuses it (verified byte-identical output).
- [x] **P19b** — **Return-object alias cleanup:** DONE (d52ffac). `calculateTaxes()` duplicate names (`state`/`stateTax`, `fedRate`/`federalMarginalRate`, `stRate`/`stateMarginalRate`, `irmaaMagi`/`MAGI`, `stagi`/`stateAGI`) unified onto one canonical name each; all consumers updated. Bonus: repo-wide IRMAA identifier casing normalized with backward-compatible `?stratRate=irmaa2` URL parsing.
- [x] **P19c** — **Unify `computeIrmaaInline()` with `calcIRMAA()`:** DONE (d52ffac). `computeIrmaaInline()` deleted; Retirement_Projection.html now calls `calcIRMAA()` directly with `onMedicareCount` (fixes missing per-spouse Medicare-age gate).
- [x] **P19d** — **`irmaa_and_rmds.html` duplicate bracket math:** DONE (d52ffac). Now reuses new `calculateTaxableSocialSecurity()` extracted into taxengine.js; also fixed its "Annual IRMAA Surcharge" column (was showing monthly value, understated 12x).
- [x] **P19e** — **Script load-order normalization:** DONE (d52ffac). taxengine.js now loads before core.js in retirement_optimizer.html.
- [ ] **P19f** — **State coverage (13 of 51 jurisdictions uncoded):** LA/UT (flat, easy). 11 graduated states (AR/DE/HI/KS/MO/NJ/NM/OK/RI/VT/WV) — MO/WV need year-keyed rate tables (active phase-downs, same pattern as GA/NE/KY); AR/DE/MO/NJ/NM/RI/VT/WV need per-state partial-SS-taxation thresholds; NJ needs a >$1M surtax bracket; VT needs a low-income exemption rule. RI/VT CPI-indexing is actually free (already the default). See the review plan file for the full per-state breakdown.
- [x] **P19g** — **Local (county / city / school-district) income-tax disclosure NOTES:** DONE 2026-08-15.
  The engine models **zero** sub-state income tax anywhere. Added or strengthened per-state `NOTE` flags for
  every supported state whose local income tax reaches the income this tool computes — retirement
  distributions **plus interest, dividends, and capital gains** (the key discriminator: earned-income-only
  local taxes miss retirees). Full income base, effectively unavoidable: **MD** (all 23 counties + Baltimore
  City, 2.25-3.3%; note strengthened), **IN** (all 92 counties, ~0.5-3%; note strengthened). Big-city or
  partial base, notes new: **NY** (NYC 3.08-3.88% + Yonkers, full base), **OH** (school-district income tax,
  "traditional"-base districts only — Ohio cities tax wages, not a retiree's investment/retirement income, so
  they are correctly out of scope), **MI** (city tax exempts pension/SS but taxes interest/dividends/cap-gains),
  **OR** (Portland-metro SHS + Multnomah PFA, threshold-gated; state had no NOTE at all before), **PA**
  (Philadelphia School Income Tax on dividends + certain non-bank interest only; PA's EIT/wage taxes miss
  retirees), **IA** (school-district + EMS surtax on the investment-income portion). **Deliberately NOT flagged**
  (verified no gap for this tool's income types, per the state-NOTE style rule): **KY** and **AL** local
  occupational taxes, and the **PA/OH** wage/municipal taxes, fall on **earned income only**; **CA** and **CO**
  have no personal local income tax (CO's is a flat head tax). Scope is income tax only — property, parcel, and
  business taxes are out of scope by design. `node optimizer_core.tests.js` 263/263; `taxengine.js` parses;
  Oregon NOTE render verified in-browser, console clean.
  **DECISION (user, 2026-08-15): NO version bump, NO changelog.** No taxation changed, only the information
  shown about states. The state-tax documentation gets folded into the changelog the next time a material
  (behavior-affecting) change ships, not on its own.
- [ ] **P19h** — **Optional local-income-tax modeling — thumbnail plan, prioritized by expected retirees affected.**
  Four mechanisms, each matched to how that state's local tax actually behaves. **Modeling ceiling to state up
  front:** ~4,000 US municipalities levy some income tax; the tool will never enumerate them, so the honest
  target is "cover the largest affected retiree populations with a preset or kicker, and disclose the rest via
  P19g," not completeness.
  - **A. Big city = its own jurisdiction.** When a city's rate is high, progressive, and hits the full income
    base, add a dropdown entry parallel to the state. **NYC first** — a huge resident/retiree population pays
    3.08-3.88% on IRA distributions and investment income; add NYC resident brackets, then **Yonkers** as a
    surcharge on NY tax.
  - **B. Tiered county "kicker" rate.** Where every/most counties tax the full base at similar magnitude, offer
    2-3 presets instead of dozens of counties. **MD**: low 2.25% / median ~3.0% / high 3.2%, defaulting to a
    population-weighted median (Montgomery, Prince George's, Baltimore County/City). **IN**: median ~1.5-2%.
    One optional "local rate %" input with presets serves both.
  - **C. School-district / city kicker for earned-base-exempt states.** **OH** school-district income tax
    (traditional-base districts) and **MI** city tax (investment income only) as an opt-in add-on rate — coverage
    is a minority of districts/cities and the base differs (OH full income; MI interest/dividends/cap-gains only).
  - **D. Threshold-gated metro surtax.** **OR** Portland-metro (Metro SHS 1% + Multnomah PFA 1.5-3% above
    $125k single / $200k joint) as an optional toggle; only bites higher-income Portland residents.
  - **Note-only (lowest priority):** **PA** Philadelphia SIT (dividends only, one city) and **IA** school-district
    surtax (small % of a shrinking base) — leave at the P19g NOTE level.
  - **Priority order (by retirees affected):** 1) NYC own-jurisdiction, 2) MD tiered kicker, 3) IN tiered kicker,
    4) OH SDIT kicker, 5) MI city kicker, 6) OR Portland toggle, 7) PA/IA note-only.
  - **Engine hook:** one per-year `localRate` (+ optional `localBase` = full vs investment-only) threaded into
    `calculateTaxes()` beside the existing state math; **UI:** a single "Local income tax" row, nerdknob-gated,
    default off. Sweep/URL pass-through same pattern as `taxRateCreep` (P4).
- **Status:** mostly complete. Round 1 (circular-dependency fix + 5 low-risk items): 324447f, PR #105. Round 2 (bracket-walk dedup, alias unification, IRMAA fixes, load order, plus Medicare growth now uses user CPI inputs instead of hardcoded 5.6%): d52ffac, 2026-07-07, node 51/51 + browser 240/240. Only state coverage (13 states) remains — verified 2026-07-10 (taxengine.js header still "38 of 51 jurisdictions included").
- **Independent:** no phase dependencies for the remaining items

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

## P72: first-year stub - the model always runs a full year 1  *(NEW 2026-08-24, user-raised, full build spec approved, O2)*

**Why:** the first simulated year always accrues **twelve months** of everything, no matter what day
of the year it is when you open the page. `applyGrowth(balances, growthRates, months)`
(optimizer_core.js:626) is proportional and already takes a month count, but
`preMonths = early ? 1 : 11; postMonths = 12 - preMonths` (optimizer_core.js:1168) **always sums to
12**, in year 0 as in every other year - the 1/11 split only positions the withdrawal before or
after growth inside the year, it is not a calendar offset. There is no month input anywhere:
`currentYear = inputs.startInYear || new Date().getFullYear()` (optimizer_core.js:2904), and
`startInYear` is derived from `startAge` and clamped to `>= this calendar year`
(optimizer_ui.js:558).

So a plan opened in late August with $1M in Cash at 4% books a full year of interest instead of four
months - about $27k too much - and the same overstatement applies to portfolio growth, spending,
pension, dividends and Medicare premiums. It is not a one-year rounding error: it compounds forward
over the whole run and biases every conversion verdict that depends on terminal wealth.

The only calendar-partial thing modeled today is Social Security claim-year proration by birth
month, `ssFirstYearFraction(birthMonth)` (optimizer_core.js:693). That helper is the precedent this
phase generalizes.

### The load-bearing decision: auto-detection lives in the UI, never in the engine

`optimizer_core.js` must stay deterministic. `optimizer_core.tests.js` and `sweep_golden.js` call
`simulate()` directly with fixed inputs (`startInYear: 2026` in every golden fixture). If the engine
read `new Date()` the goldens would change value on the first of every month and the suites would
fail by calendar.

- **Engine contract:** new input `startMonth`, integer 1-12, **defaulting to 1**. `startMonth: 1` is
  a full 12-month first year, bit-identical to today. No golden regenerated, no fixture edited.
- **UI contract:** `gatherInputs()` resolves the month and passes an explicit number.
  - `startInYear === current calendar year` -> auto-detect, `startMonth = new Date().getMonth() + 1`.
    This is the already-retired case, and it is the case the user asked for: looking up January-1
    balances by hand is impractical, because the change since January mixes growth, taxable events,
    withdrawals and deposits.
  - `startInYear > current calendar year` -> `startMonth = 1` (January), overridable by the input.
    This is the future-retirement case.
- **Reproducibility:** the resolved `startMonth` is written to the URL (`sm`) on save or share, so a
  link opened three months later still reproduces its recorded numbers. Only a fresh load with no
  `sm` auto-detects.

Stub fraction: `stubMonths = 13 - startMonth`, `f = stubMonths / 12`. `startMonth = 1` gives `f = 1`
and every formula below collapses to today's arithmetic.

### What prorates and what does not

| Quantity | Year-1 treatment | Where |
|---|---|---|
| Portfolio growth, all accounts | **x f** | `preMonths`/`postMonths` scaled to sum to `stubMonths`, not 12 (optimizer_core.js:1168) |
| Cash interest | **x f** | `yr.taxableInterest = balance.Cash * inputs.cashYield` (optimizer_core.js:1429) - a separate full-year line, NOT covered by `applyGrowth` |
| Brokerage dividends | **x f** | `yr.taxableDividends` (optimizer_core.js:1430) - same, separate line |
| Spending goal | **x f** | `yr.targetSpend` (optimizer_core.js:1522) |
| Pension | **x f** | `yr.pension` (optimizer_core.js:1329) |
| Social Security | **combined fraction** | see below |
| Medicare base premium + IRMAA | **x f** | monthly charges: `yr.medicareBase` (optimizer_core.js:1266), `yr.IRMAA` (optimizer_core.js:1258) |
| **RMD** | **NOT prorated** | the whole year's RMD is due however late in the year the plan starts (optimizer_core.js:1436) |
| **Standard deduction, brackets, ACA FPL** | **NOT prorated** | annual by statute. A stub year genuinely faces full brackets against partial income - correct, not a bug |
| **Roth conversion room** | **NOT prorated**, but see the wage caveat | falls out of the two rows above |
| **Property tax / SALT** | **decision, recommend NOT prorated** | `propTaxFor` (optimizer_core.js:101). It is an annual bill and it feeds the SALT deduction, so halving it quietly shrinks itemization. Whichever way this lands, write the reason down |

**Social Security.** The claim-year fraction and the stub fraction overlap; the months actually paid
are the intersection of "on or after the claim month" and "on or after the start month". Generalize
the existing helper rather than adding a second one:
`monthsPaid = max(0, 12 - max(birthMonth, startMonth - 1))`, over 12. At `startMonth = 1` this is
identical to today's expression, which is what keeps the existing SS tests green.

**Inflation advance.** `endYear()` (optimizer_core.js:2861) compounds `spendGoal`, `cpiRate`,
`inflation` and `medicareRate` by a full year. After a stub year it must advance by `(1 + rate)^f`
only, or year 2's dollars sit a full year ahead of a four-month year 1. `f = 1` leaves the line
unchanged.

**Horizon.** Row count is unchanged and ages stay integers. A stub means the run covers e.g. 11.67
elapsed years instead of 12. Do not try to add a row.

### The wage caveat, which is a first-class item and not a footnote

A stub year exists precisely because the user is mid-year, and that year almost always carries
January-August W-2 or self-employment income plus tax already withheld. The model knows about
neither. Left alone, the stub year reports a near-empty tax return and therefore invents **a large
amount of Roth conversion room that does not exist** - the one number in this app people act on.
Proration without this makes the tool confidently wrong in a new way, so two inputs ship alongside
the month, both defaulting to 0:

- **Income already received this year** (ordinary, added to year-1 taxable income before brackets).
- **Federal and state tax already withheld this year** (credited against year-1 tax).

### Blast radius

- **Goldens and node suites: zero change, by construction.** Any drift in `sweep_golden` during
  implementation is a bug in the default path, not an expected update.
- **Monte Carlo** needs no special case - `returnSequence[0]` flows through the same proportional
  `applyGrowth` - but confirm `buildPathInputs` in `montecarlo/mc_engine.js` passes `startMonth`
  through to every path.
- **RetirementTaxPlanner handoff** receives a stub year-1 row; check the year-click handoff does not
  annualize it.
- **Changelog** must warn that a saved plan will not reproduce its old numbers once a start month is
  auto-detected, stated as consequence rather than history.

### Sub-items

- [ ] **P72a** - engine input `startMonth` (default 1) and the derived stub fraction, threaded into `sim`
- [ ] **P72b** - scale `preMonths`/`postMonths` to `stubMonths`; scale the standalone interest and dividend lines
- [ ] **P72c** - scale spending and pension; leave RMD, brackets and the standard deduction alone
- [ ] **P72d** - generalize `ssFirstYearFraction` to compose claim month with start month
- [ ] **P72e** - prorate Medicare base premium and IRMAA; settle the property-tax call and record the reason
- [ ] **P72f** - `endYear` advances inflation by the stub fraction
- [ ] **P72g** - income-already-received and tax-already-withheld inputs, and their effect on year-1 tax and conversion room
- [ ] **P72h** - UI: start-month input, auto-detect on fresh load when the plan starts this calendar year, `sm` URL param, save/share pins the resolved month
- [ ] **P72i** - Annual Details marks the first row as a partial year and names the months; tooltip says what is and is not prorated
- [ ] **P72j** - tests (`startMonth = 1` reproduces a known run exactly; `startMonth = 9` scales growth/spend/pension/dividends by 4/12; RMD and the standard deduction unchanged at `startMonth = 9`; SS claim-year and stub-year fractions compose; `endYear` advances by `f`), then `TestTiers.EXPECTED` across all three suites, the `.githooks/README.md` table, the changelog entry and the four version-bump sites
- [ ] **P72k** *(added 2026-08-28 from `P84`, user-raised)* - **the year-0 RMD BASIS, which is a
      different question from whether the RMD is prorated.** The table row above is right and stands:
      the RMD is a full-year obligation and owes nothing to the stub fraction. But `P84l` makes the
      RMD key off the prior December 31 balance, and in year 0 that balance is seeded from the typed
      IRA input - which is a December 31 figure only when `startMonth = 1`. A plan opened in September
      types a September balance and overstates year-0's RMD by roughly eight months of growth,
      reintroducing in year 0 the exact error `P84` exists to remove. `P84o` pins and declares the
      limitation; the fix is here, because only this phase has `startMonth`.
      **Recommended: a year-0-only "this year's RMD, as your custodian stated it" dollar input.**
      Better than asking for the December 31 balance - the custodian already computed it and puts it
      on the January statement, it is exact with no divisor or growth assumption, and it absorbs
      inherited-IRA schedules and aggregation shapes this tool cannot model. Blank falls back to
      `priorDec31 ~= typedBalance / (1 + growth x elapsedMonths/12)`, which is the identity at
      `startMonth = 1`, so nothing changes for a January plan.
      **Out of scope, named so it is a decision:** the first RMD year may be deferred to April 1 of
      the following year, taking two distributions in year two. Real lever, real tax consequence, not
      modeled anywhere. Its own phase if it is ever wanted.
- **Status:** pending
- **Independent:** no phase dependencies

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

## P75: Year-by-year withdrawal mix - income-target optimization  *(2026-08-25, user-raised; **MERGED INTO `P103` 2026-09-01**)*

**MERGED.** `P75a`-`P75c` are now `P103c`; `P75d` follows `P103e`; `P75e` stays a stretch item under
`P103c`. Kept below as the design record. **One correction:** `P75d` says "withdrawals do not"
accept per-year arrays. They do - `inputs.oracleWithdrawalPlan[y]`, `optimizer_core.js:1860`,
shipped with `P51b` and on `main`. This phase never referenced `P51`; the two were unconnected
attacks on the same problem, which is the reason `P103` exists.

**Why:** every strategy family picks ONE rule and holds it for the whole horizon; the true optimum
is a per-year schedule. The engine's own evidence says analytic shortcuts fail here (BETR wrong in
both regimes, findings.md:1544; Break Even boundary year off by 12 years and $662k from the
searched optimum, findings.md:1405), so this phase treats it as numerical optimal control over
full simulations, gated by a cheap measurement (P75a) before anything expensive is built.

**The reframe.** The control is not "which account each year" (4 accounts x horizon, intractable);
it is TWO numbers per year: ordinary income realized (IRA withdrawal + conversion) and LTCG
realized. Spending is funded by whatever mix hits those targets; Roth and Cash are tax-transparent
residuals. The engine already half-thinks this way: `computeBracketCeiling`
(optimizer_core.js:805) returns MAGI ceilings for its three modes (federal-bracket top, IRMAA tier
via `cpiRate * irmaaFwdFactor`, ACA FPL multiple - `FPL_2025` hardcoded at optimizer_core.js:842).
The per-year schedule generalizes one global ceiling to one ceiling per year.

**Time value of money:** final after-tax wealth from a full simulation embodies TVM endogenously -
each tax dollar's foregone compounded growth is charged by the sim itself. No explicit
discounting; adding one would double-count.

**Edge/vertex structure.** Within a tax regime, tax is piecewise-linear and convex in ordinary
income, so optima sit at vertices; cliffs are concave drops - never optimal to sit just above one.
Candidate menu per year (~12): std-deduction top, 10/12/22/24/32 bracket tops
(`TAXData.FEDERAL.*.brackets`, taxengine.js:36-58), IRMAA tier edges (taxengine.js:85-101, MAGI
basis, 2-year lookback), ACA cliff, RMD floor, spend-need floor, zero-extra; for LTCG the 0%-stack
top (`getLTCGBracketRoom`, optimizer_core.js:775). **No unified edge list exists today** - each
mode inflates its own threshold at its own call site with its own factor (IRMAA uses
`cpiRate * irmaaFwdFactor`, federal plain `cpiRate`). First engine artifact:
`magiEdgesForYear(inputs, year)`.

**State collapse (DP rung only):** a dollar in Roth or Cash never touches future taxes - its
marginal value is a year-indexed constant, so both factor out of DP state. Remaining state is
roughly (year, IRA, Brokerage, basis ratio, IRMAA lookback tier, filing/widow flag). Note: no
one-year step API exists; the yearly loop is inlined in `simulate()` (optimizer_core.js:3053-3073)
over 15 non-exported phase functions - the DP rung would need either an extracted step or
memoized-prefix full sims. Coordinate descent (P75b) needs neither.

**Stochastic layer:** optimize the deterministic path, re-solve annually (receding horizon) - not
a feedback policy. Robustness via P69 path replay when it lands, plus cliff-margin pricing (P75c).

**Certification payoff:** descent/DP optimum minus best family row = the gap P36 exists to
measure. Gap near 0 across the scenario battery -> families are effectively complete. Fat gap in
some regime (likely candidate: big IRA + ACA years + widow transition) -> names the missing
family.

**Prior art:** findings.md:2752 - i-ORP (Welch) ran this as LP in production for two decades; the
archived ModelDescriptionK.pdf describes the model (read 2026-08-25: equations NOT included -
e-ORP's solver.py and Ragsdale/Seila/Little 1994 carry explicit formulations). e-ORP
(github.com/dcurrie/e-ORP,
findings.md:2781) is the living MILP re-implementation. DiLellio & Ostrov the academic line;
wscott/fplan and mdlacasse/Owl adjacent open-source MILP planners. None carry this engine's
state-tax/ACA/widow fidelity - the expensive part is already built here. **LP, MILP, SCIP, DP and
PWL are defined at findings.md:2842**, with the cliff-as-binary encoding and why this phase needs
no solver.

**Falsifiable questions:**
- **Q1.** Do the best swept rows' realized MAGIs already sit on edge-menu points? If mostly
  interior, the vertex argument misses an engine coupling (IRMAA lookback, SS-torpedo interior
  kinks) and the phase stops for redesign before any optimizer is built.
- **Q2.** Does per-year freedom beat the best one-rule family by more than noise? Gap in $ and %,
  per scenario.
- **Q3.** Is the knife-edge plan fragile? Price the safety margin below each binding cliff; does
  the margin-hardened plan still win?

**Tasks:**
- [ ] **P75a** - measure first, log side only: dump realized MAGI + CapGains per year for top-N
      sweep rows (MAGI is on the log row, optimizer_core.js:1009; ordinary income is NOT logged,
      and MAGI is the edge-relevant variable anyway - IRMAA and ACA key on it). Build
      `magiEdgesForYear()` in a `.test_harnesses/` harness; classify each year-row as on-edge /
      interior / just-above-cliff; report residency rates. **GATE for the rest of the phase.**
- [ ] **P75b** - coordinate-descent harness: seed with the best family row's realized MAGI path;
      loop years x edge menu, one full `simulate()` per trial (~12 x horizon x passes, 1-2k sims
      per scenario - same order as one optimizer sweep), score `afterTaxWealthOfLogRow` of the
      last row (optimizer_core.js:3271), multi-seed from the top-5 rows. Non-unimodality
      precedent: `bestConversionStopYear` header (optimizer_core.js:3278-3304) - exhaustive scan
      only, no bisection.
- [ ] **P75c** - fragility pricing: re-run the optimum with $1-5k margins below each binding
      cliff; report the cost-of-margin curve.
- [ ] **P75d** *(contingent on a material P75b gap)* - product surface: the per-year plan needs a
      carrier. Extra conversions already accept per-year arrays (`_extraConvAmountFor`,
      optimizer_core.js:2371); withdrawals do not. Worker via the `montecarlo/worker.js`
      importScripts pattern; P34 shares that groundwork.
- [ ] **P75e** *(stretch)* - LP-relaxation upper bound (convexify the cliffs) -> "best family is
      within X% of the ceiling" certificate; feeds P36 directly.
- **Status:** MERGED INTO `P103` (2026-09-01). Was: pending; P75a is the gate
- **Independent:** no phase dependencies; results feed P36 (the gap) and use P69 (replay) when it
      lands

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

## P26: README/FAQ cross-references from tooltips (pending, deferred 2026-07-28)

**Why:** several tooltips and banners restate material that already exists under `## Frequently Asked Questions` in `README.md` (anchored headings such as "Is It a Fool's Errand to Make Multi-Decade Projections?", "Is the Break-Even Tax Rate Trustworthy?", "Why does the Optimizer say converting never helps?"). Pointing at those anchors keeps one source of truth and shortens the in-app text.

**Needs:** a pass to decide which existing text has a matching FAQ entry, which needs one written, and where the link should land. The "where does the reader land" question is settled by P25: link at `README.md#<anchor>` and `doclinks.js` maps it to `/#<anchor>` on the live site while leaving the file link intact locally. Note kramdown's generated ids, not GitHub's: check the rendered `/` for the exact id before hardcoding one.

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

## P28j: withdrawal timing keys off conversion, and nobody chose the $1,000  *(spun off from P28, scoped 2026-08-27)*

**Why, AS RE-MEASURED 2026-08-27 (`P28ja`).** The phase was opened because `convertExcessToRoth` is a
DEFAULT-FACING checkbox that P28 round 3 measured losing over $1M. **That is no longer the finding.**
On today's engine the conversion's own worst case is **-$8,658**, and 15 of 17 losing cells stop
losing once withdrawal timing is held still. What is left is bigger than a stale number: converting
flips the FOLLOWING year's withdrawal to Early, the flip **never once pays** in 39 live cells, and
**late beats early 35 of 39**. The phase is now about the timing rule, not the checkbox.

*Original framing, kept because it is why the phase exists: round 3 measured `convertExcessToRoth`
losing in 13 of 25 cells at -$1,095,454 (the phase's own round-3 grid; `CONVERSION_ROUTING.md` section 9
carries the round-4 75-cell version at 28 of 75 / -$1,411,488). Both are pre-P32 numbers.*

**The rule, verbatim** (`optimizer_core.js:1274-1275`):
```js
const _prevConv = y > 0 ? (log[y - 1].rothConv ?? 0) : 0;
yr._useEarly    = y === 0 ? _stratImpliesConversion : (_prevConv > 1000);
```
Early means `preMonths = 1` - the withdrawal exits in January and the rest compounds for 11 months.
Late means `preMonths = 11`. One dollar of conversion either side of **$1,000** moves a whole year's
withdrawal by ten months, and keeps moving it for every year the flag stays flipped.

**Three separate defects. Do not merge them:**
1. **The trigger.** Should timing key off *whether a conversion happened* at all? A conversion year
   wants the money out early so the Roth compounds. A year that converted $1,001 to top up a bracket
   is not obviously that year.
2. **The constant.** `1000` is a bare literal, the same species as P30's `[40,60]` and
   `resolveOrderedSeq`'s three-entry map. Nobody chose it. P30 made the weight a research input
   before sweeping it; this needs the same.
3. **The control.** `forceWithdrawTiming` (`optimizer_core.js:1280-1281`) exists but has no UI, no URL
   key and is absent from `getInputs()`. A user who can SEE the timing cannot set it.

**Correction to `P28j` as originally written: it is NOT invisible.** The `timing` column ships in
Annual Details as `Early(Conv)` / `Late(Spend)` (`optimizer_core.js:1168`) with a tooltip that
explains both legs (`optimizer_ui.js:2862`). Visible-and-uncontrollable is a different product problem
from invisible, and the fix for it is different too.

**WARNING - CONFIRMED 2026-08-27, the 2026-07-30 numbers do not carry.** They were re-run and they
moved: worst-with-timing-pinned went from -$297,195 to -$8,658. Quote **section 16**, never section 9.
That is now the third time in this repo a research table stopped reproducing after an engine change
(P28 round 2, P30's ladder, and this).

**Falsifiable questions:**
- **Q1. ANSWERED by `P28ja`:** essentially all of it is timing. 15 of 17 losing cells stop losing when
  timing is pinned; the timing leg is never positive in 39 live cells. Remaining work is confirmation
  in the harness proper (`P28jc`), not discovery.
- **Q2. ANSWERED by `P28ja`:** no. Late beats early **35 of 39** live cells (90-cell: 44 of 54), zero
  ties. The shipped rule is on the wrong side about nine times in ten.
- **Q3.** Is $1,000 load-bearing? Sweep the threshold. A flat curve ends part 2 and is a real result -
  `P30b` found the opposite for its constant, so neither answer is the expected one.
- **Q4.** How many years does one flip touch? Count the run length of `_useEarly` after a single
  conversion year. A one-year effect and a twenty-year effect are different products.
- **Q5. SCORED BROKEN by `P28ja`.** Predicted a zero-return arm collapses the timing leg to ~$0. It
  shrinks ~15x (median -$250,887 -> -$16,480) but stays negative in **all 49** live cells and never
  reaches $0. A non-compounding residual exists. New sub-question, not yet asked of the engine: is it
  the dividend accrual on the PRE-withdrawal balance (`optimizer_core.js:1152`, comment calls itself
  an approximate worst case)? Unproven - do not assert it without a run.

**Already ruled out - do not re-derive:**
- Whether `rothConv` is a display field. It is engine state (`optimizer_core.js:1075-1080`, `2581`); a
  reframed value written there flipped IRA Draw 6% from late to early and moved 780 money fields.
- Whether `convertExcessToRoth` can lose. P28i answered yes. The open question is the SPLIT, not the sign.
- The gap-fill ordering. P30 is complete and both `[40,60]`-family constants were deliberately left alone.

**Tasks:**
- [x] **P28ja** - **DONE 2026-08-27, and it reframed the phase.** `CONVERSION_ROUTING.md` section 16, new
      section, section 9 left intact with a SUPERSEDED pointer. 75 cells / 450 sims on the v11.1671
      engine. **The >$1M framing this phase opened with is gone: the conversion's own worst case is
      -$8,658.** 15 of 17 losing cells stop losing the moment `forceWithdrawTiming: 'late'` is held
      on both sides, and the 2 survivors are Ordered CBIR at -$8,658 and -$221. Section 9's 28-of-75
      / -$1,411,488 / 7-surviving is now 17 / -$616,067 / **2**.
      **Q1 is therefore answered by the re-baseline itself:** the split is roughly all timing. The
      timing leg, `Δfree - Δpinned`, is **never positive in any of 39 live cells** - median
      -$341,771, min -$919,444 - and in 29 of 54 cells it is larger than the conversion leg it rides
      on. **Q2 fell out with it: late beats early 35 of 39** (90-cell: 44 of 54), so the shipped
      Early-on-conversion rule is on the wrong side about nine times in ten.
      **Q5 scored BROKEN**, informatively: the zero-growth arm shrinks the timing leg ~15x
      (median -$250,887 -> -$16,480) but does NOT collapse it - still negative in all 49 live cells,
      never $0. Something beyond compounding charges for a month-1 withdrawal; the dividend accrual
      on the PRE-withdrawal balance (`optimizer_core.js:1152`) is the suspect and is unproven.
- [ ] **P28jb** - `timingConvThreshold` research input replacing the bare `1000`, default `1000` so
      unset is bit-identical; shape-validated (finite, `>= 0`) the way `gapFillWeights` is
- [ ] **P28jc** - harness arms: pinned-early / pinned-late / auto, crossed with `convertExcessToRoth`
      on/off, on the re-baselined 5-mix x 3-rate ladder
- [ ] **P28jd** - answer Q1 as a PAIRED split. Timing moves delivered spend, so wealth alone is
      meaningless here - same rule P29 carries. `P28ja` scored 59 of 90 cells clean (delivered spend
      equal in both arms at both timings), so a third of the grid needs the paired report before its
      dollar figures mean anything
- [ ] **P28je** - sweep the threshold (Q3) and measure the flip run length (Q4)
- [ ] **P28jf** - **DECISION:** ship `forceWithdrawTiming` as a real control, change the trigger,
      change the constant, or record and leave alone. `P30g` is the template for "measured, and
      deliberately not shipped, with the reason written down"
- **Status:** `P28ja` DONE 2026-08-27, Q1/Q2 answered and Q5 scored by it; `P28jb`-`P28jf` open.
  **The phase's premise changed and its priority should be re-decided:** it is no longer "a checkbox
  costing >$1M", it is "the Early-on-conversion rule never pays and nobody can turn it off". **Harness:** extend `.test_harnesses/unifiedconv_harness.js`
  section 5, which already carries the arm shape (`forceWithdrawTiming` crossed with `convertExcessToRoth`)
- **Independent:** no phase dependencies. Touches `beginYear` only, so it does not collide with
  `P35i`'s `fillSpendingGap` arm.

---

## P83: which IRMAA safety margin is best against Monte Carlo inflation?  *(user-raised 2026-08-27, RESEARCH COMPLETE same day)*

**Ask, as raised:** now that Monte Carlo varies inflation in all three modes, re-run the IRMAA margin
analysis against those paths and find which safety margin produces the best results.

**The premise checked out, and the existing documents were wrong about it.**
`IRMAA_MARGIN_FIXED_CPI.md` section 5, "The limit no sweep can lift", says the analysis is impossible
and quotes `sim.cpiRate *= (1 + inputs.cpi)` as proof. That line no longer exists - P70 replaced it
with `cpi_t = yr.yearInflation + (inputs.cpi - inputs.inflation)`, so the IRMAA threshold follows each
path while `irmaaFwdFactor()` deliberately stays on the scalar `inputs.cpi`. Realized and assumed CPI
diverge. That is the exact "engine change, not a harness one" the old section 7 listed as a
follow-up, and it shipped in P70 without the margin documents being revisited.

**Answer: `halfcpi` - the shipped default - and it is not close.** Identical five-way ordering in all
four path sources: `halfcpi`, `cpiminus1`, `flat2000`, `halfstep`, `none`.

| path source | halfcpi breach drop | surcharge vs none | wealth vs none |
|---|---|---|---|
| Historical (block bootstrap) | **-17.5%** | -0.51% | +0.39% |
| Synthetic-GBM | **-20.1%** | -0.61% | +0.36% |
| Synthetic-AAM | **-20.3%** | -0.66% | +0.38% |
| Stress (P70e continuity) | **-21.4%** | -0.12% | +0.47% |

**The default does not change. What changes is why it is defensible.** P70e confirmed it on the
conversion-sizing side effect and explicitly not on breach protection. It now wins on the thing it is
named for: the `fixedTaxIndexing` control - where the forward projection is exact by construction and
no benefit can be forecast absorption - shows roughly HALF the effect, 2.4-2.5x smaller in every one
of the four sources.

**Why halfcpi wins is a size argument, not a shape one.** The error to absorb is the threshold times
the CPI miss, about $9,200 at the p10 and ~$5,700 typically. Setbacks: halfcpi **$5,518**, halfstep
$2,435, cpiminus1 $2,180, flat2000 $2,000. Only halfcpi is sized to the error. `halfstep` is the
exception that kills a pure size ranking - second largest setback, smallest benefit, a third of what
`flat2000` buys for $435 less. **Unexplained, and recorded as unexplained.**

**Full write-up:** `research/IRMAA_MARGIN_MONTE_CARLO.md`. Old document's sections 5 and 7
marked SUPERSEDED in place, the P28/P30 pattern.

- [x] **P83a** - `.test_harnesses/irmaa_margin_paths_harness.js`. Banks from
      `mc_engine.buildBanks()` and paths from `buildPathInputs()` - the REAL builders, so a change to
      how the product draws inflation surfaces here instead of being reproduced wrong in a copy.
      CRN: banks built once per (MC mode, CPI) and every margin scored on the same paths.
      **GOTCHA:** `mc_engine.js` reads the bank builders as bare globals the way `importScripts`
      supplies them, so `Object.assign(globalThis, prng)` is required before the require or bootstrap
      mode throws `bootstrapMultiAssetBank is not defined`.
- [x] **P83b** - the size-of-the-prize section, reported BEFORE any margin number so a null result
      would have been readable. Only an undershoot can breach, so the undershoot distribution is the
      ceiling on what any margin can buy.
      **Two properties worth keeping:** GBM and AAM produce IDENTICAL inflation, correctly - the AR(1)
      correlates with `z1`, and `drawSyntheticBank` turns the same `z1` into different returns without
      touching `z1`. If they ever diverge, the inflation stream has been made mode-dependent and GBM's
      bit-identity guarantee is gone. And the -7.62% worst case shared by all four sources is
      `0.99^2 / 1.03^2 - 1` exactly, the `CPI_INDEX_FLOOR` against a 3% assumption; nothing can go below it.
- [x] **P83c** - predictions scored. P2, P4, P5 HELD; **P1 and P3 BROKEN**.
      **P1 broke backwards and it is the finding.** Bootstrap leads the undershoot RATE (47.2% vs
      46.4%) but the synthetic modes show the LARGER benefit. Depth beats frequency: bootstrap's p10
      undershoot is -3.66% against the AR(1)'s -4.99%, because the 1970-2025 record runs hot against a
      2-3% assumption (mean error +1.85%, usually an OVERshoot) so its undershoots are shallow.
      **P3 broke narrowly, 0.66% against a 0.5% line, but the SIGN is the result:** path-following, every
      margin REDUCES surcharge dollars; fixed-indexation, every margin INCREASES them. The margin flips
      from cost to saving when the threshold becomes uncertain - the reversal
      `irmaa_cpi_risk_harness.js` predicted from hand-built CPI worlds, now seen on generated paths.
- [ ] **P83d** - **OPEN, UNPRIORITIZED. Is the menu truncated below its own optimum?** The curve has
      not turned: `cpiminus1` -> `halfcpi` more than doubles the breach reduction, and halfcpi's
      $5,518 setback is still BELOW the $9,200 p10 error. Same shape as P30's `[40,60]` - the constant
      that wins is the biggest one on offer, which is not the same as the right one. Needs a
      continuous forward-factor knob (`irmaaFwdFactor` switches on a fixed list), so it is an engine
      change, plus a decision on whether breaches or dollars are the thing being optimized. They do
      not disagree today and nothing guarantees that further out.
- [ ] **P83e** - **OPEN, and it is a product call, not research.** `halfstep` buys the least of any
      margin in every source measured, for a setback larger than `flat2000`'s. It is the deletion
      candidate the old document nominated `halfcpi` and `cpiminus1` for. Deleting a mode is only
      worth doing if the knob leaves the nerdknob.
- [x] **P83f** - **DONE 2026-08-27, user question: how does the plan forecast the threshold two years
      out under variable inflation, and what margin is right if that forecast is as good as it can be?**
      **Answer to the first half:** the TYPED `inputs.cpi`, a constant, at all three call sites. No sim
      state reaches `irmaaFwdFactor` - not the current year, not a trailing average, not the realized
      history. A path running 9% inflation for six years still projects forward at 2.8%.
      **Answer to the second half, and it inverts the question:** the constant is already the best
      practical forecast. Five rules compared analytically on the FORWARD window - typed, lastyear,
      lastyear-lag, trailing3, trailing5, oracle. **Every adaptive rule is WORSE on the downside tail
      in all four path sources**; the p10 undershoot roughly doubles under `lastyear` on bootstrap
      (-3.60% -> -7.42%) and on stress (-2.91% -> -9.16%).
      **Mechanism:** the constant is biased in the SAFE direction (mean error +1.86% bootstrap, +3.70%
      stress - realized growth usually EXCEEDS the projection, so the plan aims low and the ceiling
      turns out conservative). Every adaptive rule is conditionally unbiased (+0.12% to +0.32%), and
      removing that bias necessarily fattens the downside tail. **An unbiased forecast is the wrong
      objective when the loss function is one-sided.** AR(1) persistence 0.67 also helps less than it
      looks: the forecast is of a TWO-year compounded value against a 3.1% shock SD, so fresh shocks
      dominate the carried signal, and a block bootstrap resets the regime at every block boundary.
      **Recommended setting under a reasonable forecast: `halfcpi`, and the menu is still short.** The
      p10 undershoot needs a $6,338-$10,890 setback; halfcpi supplies $5,518. Under-sized everywhere.
      **A forecast hook was scoped and NOT built** - research input, default off, bit-identical when
      unset - because the three rules it would have tested all lose to the constant already shipping.
      Cheap analytic pass making an engine change unnecessary.
      **Correction folded in:** section 1's window was described as ending at year y; the forecast is
      FORWARD (y+1, y+2). Verified the pooled distributions agree to within noise rather than assuming
      it, so section 1's numbers stand and only the wording moved.
- **Status:** research COMPLETE 2026-08-27. No engine change, no version bump, no changelog - nothing
  a user can see. **`IRMAA_MARGIN_DEFAULT = 'halfcpi'` re-confirmed, on better evidence than before**,
  and re-confirmed a second way by `P83f`: no better forecast exists to shrink the need for it.
  **Harness:** `.test_harnesses/irmaa_margin_paths_harness.js` (node, ~31s), results in
  `IRMAA_MARGIN_MONTE_CARLO.md`.
- **Related:** supersedes parts of `IRMAA_MARGIN_FIXED_CPI.md` (P66b round 2); extends P70e, whose
  stress-bank figure reproduces here at 21.4% against its recorded 21.1%.

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

# Batch added 2026-08-01: P29-P34

Six phases from a user punch-list. **Four of them touch questions this repo has already partly
answered, and two were answered NO.** Each carries an explicit "Already ruled out" block; that block
is as much the deliverable as the task list, and it exists to stop a re-derivation of P24 and P28.
Recommended run order is rows 31-36 of the Priority Order table above (P33, P34, P30, P32, P31, P29),
not phase-number order.

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

## P34: The cost of finding a profitable conversion — where the time actually goes

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
   portable in principle. **CORRECTED 2026-09-01 (`P102`): it is not portable in principle, it is
   ALREADY PORTED.** `montecarlo/worker.js:9` does `importScripts('../optimizer_core.js')`, so the
   engine runs inside a worker on every Monte Carlo run. This item is smaller than priced below.
   **One real blocker, named:** `simulate()` mutates two module globals —
   `simulationCount` (`:2306`) and `STATEname` (`:2307`). `STATEname` is a genuine hidden dependency;
   two workers on two states would race — but the sweep is one worker at a time, exactly like MC, so
   this bites only if two sweeps are ever allowed to run concurrently. Also `new Date().getFullYear()` is read when `startInYear` is
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
   **REVERSED 2026-09-01 by `P102b2`, which shipped.** The result is no longer discarded: goal-first's
   "Stop conversions when they stop paying" adopts that exact object, so the call is load-bearing
   whenever that toggle is on. Keep it eager while the toggle is on; laziness may still be right when
   it is off, but the two cases now differ and this item can no longer be done blind.
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
### The target, set 2026-08-31 after a user correction, and it is what this phase was missing

**The user's point:** *"the user running this tool may have a much slower system than what is being
tested on, so efficiency does matter."* Every timing in this repo was taken on an **AMD Ryzen AI 9
HX 370** - a 2025 flagship - and none of them said so. Scaled by single-core speed, because the sweep
is single-threaded, which is exactly what the worker item here is for:

| device | x | full sweep | conversion search / candidate |
|---|---:|---:|---:|
| reference, 2025 flagship | 1 | 6.2 s | 392 ms |
| mid laptop ~2020 | 2 | 12.5 s | 784 ms |
| older laptop ~2016 | 3.5 | **21.8 s** | 1.4 s |
| budget Chromebook / tablet | 6 | **37.4 s** | 2.4 s |
| very old or throttled | 10 | **62.4 s** | 3.9 s |

**The audience is people planning retirement, so a ten-year-old laptop is an ordinary machine, not an
edge case.** At 22 to 62 seconds a user concludes the page has hung.

**Measured decomposition:** base sweep 1,535 ms, with the pool of 12 candidates 6,238 ms. **The
conversion search is 75.4% of the sweep**, at every device tier, because a ratio does not change with
clock speed. Everything else is noise by comparison - `nonSSIncomeForMAGI`, the phase's most recently
questioned inner loop, is 0.021% and stays 13 ms even at 10x.

**SO THE TARGET IS NOT "make it faster".** It is: **the sweep stays usable at 3.5x to 6x slower
single-core speed**, which means the conversion search has to stop being three quarters of it. Pick
a number before building - a sweep under ~10 s at 3.5x implies under ~3 s at reference, a 2x cut -
and profile against it rather than against a stopwatch on a fast machine.

**And state the reference machine on every timing this phase records.** A relative figure is
machine-invariant and stays true everywhere, but it is only a verdict once the ABSOLUTE is shown
acceptable on the slowest machine that matters.

- [ ] **P34a** — **Baseline profile FIRST**, before P29/P31/P32 add sweep arms, so later phases have a comparison
- [ ] **P34b** — Q1 instrumentation with scored predictions
- [ ] **P34c** — Tier-1 #3 (lazy stop-year) — smallest, zero-risk, ship it standalone
- [ ] **P34d** — Tier-1 #2 two-level cache + the key-coverage test that fails when a new input is added
- [ ] **P34e** — Q3 memo hit-rate measurement; build the memo only if the rate justifies it
- [ ] **P34f** — Tier-1 #1 worker: resolve the `STATEname` / `simulationCount` module-global mutation and pin the
      current year, or record why it is deferred
- [ ] **P34g** — Q2 unimodality measurement on the amount axis; pin with a test if it holds
- [ ] **P34h** — Tier-2 #5 coarse-to-fine, **only** with a full-sweep diff on several scenarios including the
      findings.md:85 and :86 traps
- [ ] **P34i** — Re-check the 6-candidate cap on `bestTimeLimitedConversion` after Tier-1 lands
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

## P35: "Phased" withdrawal strategy — one strategy that switches by life phase

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
| `deathBasisStepUp` default | ~~`'half'`~~ ~~`'auto'`~~ **THE INPUT DOES NOT EXIST, 2026-08-07.** No enum, no URL key, no `'none'`: step-up follows state law, so it is derived from a per-state `BasisStepUp` field, not chosen. See `P35g` |
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

### Tail-policy question (user, 2026-08-10) — settle BEFORE or WITH `P35i`, evidence exists

The PR-5 spec's BALANCED fill (`['Brokerage','Cash','Roth']` weighted by balance) is
**proportional over the non-IRA accounts, and the 2026-08-10 program produced evidence against
that shape**: (a) P28 (settled, 630 sims) — Roth pays only when it displaces a BROKERAGE draw
and LOSES when it displaces Cash, while a balance-proportional fill draws Roth alongside Cash
every year; (b) the P51 oracle's recurring end-game is a Roth-spending TAIL with appreciated
Brokerage ridden to the §1014 step-up — i.e. the best ordering is PHASE-DEPENDENT
(Cash→Brokerage→Roth mid-plan, Roth-before-Brokerage late when the gain fraction is high);
(c) proportional-as-strategy was refuted twice (never top-3 in 135 cells; gap-to-oracle >2% at
every basis). Candidate tail policies for a bake-off: specced balance-proportional /
Cash→Brok(spend-only)→Roth sequenced / gain-aware late flip (flip condition = measurable state,
gain fraction x heirs rate — a LEGAL rule if the axis property is measured then test-pinned,
unlike oracle foresight). An "endgame grid" (scenarios STARTING at IRA=goal, RMD age, varying
Brok/Roth/Cash mix x basis 20/50/80 x spend) can measure this TODAY without `P35i`, using the
existing ordered arms + the oracle for the ceiling. → new sub-item `P35n`.

- [x] **P35n** — DONE 2026-08-10 (`research/ENDGAME_DRAW_ORDER.md`, endgame_harness.js,
      144 cells). **The PR-5 BALANCED fill spec is refuted: balance-proportional is the WORST
      arm (median −$223k, wins 1/108). Winner: the SEQUENCE Cash → Roth → Brokerage with IRA as
      last-resort backstop (88/108 cells; conversions-insensitive 36/36).** Mechanism: §1014
      makes held Brokerage nearly free to heirs while drawing it realizes taxed gains — P28's
      "Roth pays when it displaces a Brokerage draw", live from endgame year 0. Below ~$1.3M
      totals the 0% LTCG bracket erases the CRB-vs-CBR difference (16/15 tie) but proportional
      still wins zero. **`P35i`'s PR-5 gap-fill arm should ship the sequence, not the
      balance-weighted order** — with the taxflex caveat (CRB empties Roth; a flexibility
      objective may disagree with the wealth verdict) and the no-SECURE-heirs ceiling stated.

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

Sub-item IDs are `P35a`..`P35m`. The old `PR n` labels are kept in parentheses because merged PR
bodies, `findings.md` and `progress.md` cite them; see the ID migration table at the top of this file.

- [x] **P35a** *(PR 1)* — characterization goldens for both enumerations. **DONE 2026-08-03**,
      node 148 -> 167. Full write-up archived in `.planning/task_completed.md`.
- [x] **P35b** *(PR 2)* — extract `buildStrategyFamilies` + `OPTIMIZER_GRIDS`/`MC_GRIDS` to
      `optimizer_core.js`. **DONE 2026-08-03**, node 167 -> 173, v11.1437, byte-identical over all
      four `OPT_GOLDEN` captures. Full write-up archived in `.planning/task_completed.md`.
- [x] **P35c** *(PR 3a)* — bracket-lookup floor. **DONE**, v11.1447, merged
      [PR #147](https://github.com/nightskyguy/retirement_assets/pull/147)
- [x] **P35d** *(PR 3b)* — Medicare age becomes `TAXData.IRMAA.ELIGIBILITY_AGE`. **DONE**, merged
      [PR #149](https://github.com/nightskyguy/retirement_assets/pull/149), byte-identical over a
      144-scenario A/B
- [x] **P35e** *(PR 3c)* — ACA age gate falling back to Proportional 0%. **DONE**, v11.1462, merged
      [PR #150](https://github.com/nightskyguy/retirement_assets/pull/150); only `aca` rows move.
      Two of the three predictions were wrong; both corrections are in `findings.md`
- [x] **P35f** *(PR 3d)* — `Basis <= Brokerage` invariant. **DONE 2026-08-07, v11.1499.** Spec
      written at last: basis may never exceed the account, at input and in every simulated year.
      New `clampBrokerageBasis()` called after both `applyGrowth` points. Byte-identical for
      non-negative brokerage returns (every ordinary path moves value and basis together); a real
      correction under MC, where a down year shrinks value while basis stands still. The input-side
      half was a **dead line**: `optimizer_ui.js:288` read `if (Brokerage <= 0.01) basis = 0;` and
      assigned an undeclared global named `basis`, never `BrokerageBasis`, so it had never once
      fired. Deleted rather than repaired - the clamp below it already handles a zero balance and
      warns, which the silent version did not. **Limitation recorded, not fixed:** the clamp writes
      the unrealized loss down immediately; there is no capital-loss carryforward, so a dip-then-
      recover plan is taxed on the recovery. That can only overstate tax, never understate it
- [x] **P35g** *(PR 4, code)* — **THE BROKERAGE BASIS STEP-UP. DONE 2026-08-07, v11.1499.** Four
      decisions from the user reshaped the recorded spec before it was built:
      1. **No enum, no knob, no `'none'`.** Step-up is a function of state and federal law, not a
         preference, so `deathBasisStepUp` was dropped entirely. Modeling correct behavior outranks
         preserving past numbers; goldens were rebaselined rather than kept green behind a switch.
      2. **Not a `COMMUNITY_PROPERTY` list** either - that is a second place to forget when P19 adds
         a jurisdiction. Every one of the 38 modelled jurisdictions carries its own numeric
         `BasisStepUp` (0.50 / 1.00) in `taxengine.js`, with a test asserting all 38 declare one.
         `NO_TAX_SHELL` holds 0.50 and `NV`/`TX`/`WA` override AFTER the spread (the `NH` `NOTE`
         precedent); `AK` needs no special case, opt-in CP falls out of the shell default.
      3. **Terminal row only**, not every year: wealth at death is not wealth now. The chart kink
         is explained by a milestone rather than smoothed away.
      4. **Scope cut to the step-up.** `survivorSpendPct` deferred (new input + UI + URL key,
         orthogonal); `sim.prevIRAGain` deferred with it. Both belong to `P35i`.
      **Two plan steps dissolved.** Writing the terminal fix as `Basis := Brokerage` on the log row
      rather than "drop the haircut" made `max(0, Brokerage - Basis)` zero for every downstream
      consumer, so `bestConversionStopYear` needed no `atDeath` flag and `afterTaxNetWorth` /
      `_afterTaxBuckets` needed no arithmetic change. Removing their term anyway would have broken
      a legitimate test of the general helper. Both are documented as inert instead.
      **The trap.** A counterfactual run completes fully, so without a guard its last row reaches
      the Break Even block already stepped up while the main log's has not, and the final year's
      `convOC` differences two valuations. Needs BOTH the post-pass sitting after the BE block and
      an `inputs._cfRun` skip. Proved by isolation, not argument: a build with the terminal step-up
      disabled produces a bit-identical `convOC` series
- [x] **P35h** *(PR 4, docs half)* — README caveat, shipped **ahead of the code** 2026-08-07,
      doc-only, no version bump. Landed in `### Limitations and Restrictions` (README:294) plus a
      cross-reference from the brokerage FAQ's DRIP "Gotcha" (README:723). Both deaths covered, each
      with its direction of error named. There is no "uncovered-tax-situations section"; the item as
      originally written named one that does not exist
- [ ] **P35i** *(PR 5)* — `yr.phase` resolver; additive flags; `planPrimaryWithdrawals` branch;
      `fillSpendingGap` arm
- [ ] **P35j** *(PR 5, test)* — Phased never draws more than `Fill Bracket` at the same ceiling
- [ ] **P35k** *(PR 6)* — all 12 identity sites; URL keys `pcp`/`pam`/`dsu`/`ssp`
- [ ] **P35l** *(PR 7)* — = **P36 round 2**, the efficiency study with the full factor set
- [ ] **P35m** *(PR 8)* — Phased sweep arms scoped by P36; surface the stop-year cap reduction
- **Status:** **2026-09-01: Phased is the CARRIER for whatever rules `P103d`'s regime bake-offs pick;
  `P35i` waits on that evidence rather than on a hand-designed state machine.** IN PROGRESS. `P35a`/`P35b` merged as
  [PR #146](https://github.com/nightskyguy/retirement_assets/pull/146); `P35c` as
  [PR #147](https://github.com/nightskyguy/retirement_assets/pull/147), which **already moves
  numbers**, superseding the old "PR 3 is the first one that moves numbers" note; `P35d` as
  [PR #149](https://github.com/nightskyguy/retirement_assets/pull/149) (byte-identical); `P35e` as
  [PR #150](https://github.com/nightskyguy/retirement_assets/pull/150). `P35h` shipped 2026-08-07
  ahead of its code half; `P35f`+`P35g` landed together as v11.1499, closing the gap `P35h` had
  documented. **Next: `P35i`.** **Depends on:** nothing hard. `P35b` unblocked P36 and helps
  P29/P30/P31/P32. `P35m`'s budget problem is P34's argument. P36 round 2 now waits on `P35i`
  alone, `P35g` having landed.
- **Touches the same gap-fill code as:** P28's open ship decision (`rothGapFill`) and P30's `[40,60]`
  question. Settling P28 and P30 first would mean `P35i`'s new arm is written against a settled
  ordering rather than one about to change.

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
## P35 PR 3 replan (2026-08-04) — kept as the record behind P35c/P35d

Four corrections from the user reshaped the rest of P35. Investigating the third exposed a shipped
defect larger than any of them, so the single "PR 3" in the table below became four PRs.

| # | PR | Byte-identical | Status |
|---|---|---|---|
| 3a | `findUpperLimitByAmount` below the first bracket | **No** — 21 states + `minlimit` everywhere | **DONE 2026-08-04, v11.1447**, merged PR #147 |
| 3b | Medicare age -> `TAXData.IRMAA.ELIGIBILITY_AGE` | Yes — proven over 144 scenarios | **DONE 2026-08-04**, tokens `111448`, merged PR #149 |
| 3c | ACA cap lapses at 65 -> Proportional 0% | No — `aca` rows only, proven by control | **DONE 2026-08-05, v11.1462** |
| 3d | `Basis <= Brokerage` invariant | Yes for non-negative brokerage returns; no for MC | **DONE 2026-08-07, v11.1499** |
| 4 | ~~`deathBasisStepUp: 'auto'` + `COMMUNITY_PROPERTY`~~ per-state `BasisStepUp`, no enum, no `survivorSpendPct` | **No, by decision** | **DONE 2026-08-07, v11.1499** |

**Absence validated against a live run, 2026-08-07** (user report on `?bk=2e5`), so do not re-derive
it. Reproduced at the page defaults (`birthyear1=1960`/`die1=88` -> first death 2049;
`birthyear2=1952`/`die2=98`): `status` flips `MFJ` -> `SGL` in 2049 and `Basis` keeps falling
monotonically straight through it - 2048 $148,013/$9,630, 2049 $128,542/$7,888, 2050
$106,082/$6,139. Confirmed by grep as well: `balance.BrokerageBasis` is mutated in exactly three
places, none death-related - proportional reduction on withdrawal (`optimizer_core.js:292`), surplus
reinvestment (`:2018`), DRIP (`:2282`). `computeIncome`'s death block (`:1088-1089`) moves the **IRA
only**. The user's own figures are self-consistent with pro-rata reduction and no reset:
$8,419/$13,920 = 0.6048 against $72,739/($113,423 x 1.06) = 0.6050.

**IN SCOPE FOR PR 4 AND NOT PREVIOUSLY LISTED - the terminal valuation.** The recorded PR 4 spec
below covers only the first-death `resolveHousehold` hook. But `afterTaxNetWorth`
(`optimizer_core.js:3626-3627`) and `_afterTaxBuckets` (`:3001`) both value terminal brokerage as
`basis + max(0, brokerage - basis) * (1 - capGainsRate)`, i.e. they tax the heirs on gains §1014
steps up in full. **This is the larger of the two distortions** because it feeds Break Even, the
"Optimize for" ranking, and every cross-strategy comparison, and it is one-sided: Roth and Cash are
unaffected, so the bias runs consistently in favor of Roth conversions. Note it is NOT simply
"drop the discount" - the second death is the plan's end for a couple, but a single filer's terminal
row is also a death, so the same reasoning applies there and the change is not confined to MFJ runs.

**`'auto'` re-confirmed by the user 2026-08-07.** `'full'` in a `COMMUNITY_PROPERTY` state, `'half'`
elsewhere. No `COMMUNITY_PROPERTY` constant exists in `taxengine.js` yet; PR 4 adds one following the
`TAXData.IRMAA.ELIGIBILITY_AGE` precedent from PR 3b (single source, interpolated into any
user-facing copy so the two cannot drift).

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
4. **Run P36 before Phased lands.** Decided: run it **twice**. **P36 round 1** now on the 8 shipped incumbents
   (no step-up, no `survivorSpendPct`, death timing dropped — it detects nothing without them); P36b
   after PR 4 with the full factor set and the Phased arms. Framing that must be written into the
   results file: frequency **cannot** justify deleting a shipped arm, only the zero test can, and any
   "ACA never wins" verdict is a measurement artifact because the tool prices the cap's cost and none
   of its benefit.

The per-PR DONE write-ups for `P35c`/`P35d`/`P35e` and the `eitherOnMedicareAtStart` cleanup that
followed them are archived in `.planning/task_completed.md` under this same heading. What stays here
is only what `P35f` and `P35g` still need.

---
## P36: Phased efficiency study — do any strategies never win?

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

- [x] **P36a** — Harness `.test_harnesses/phased_harness.js` (node) BUILT 2026-08-10, calling
  `buildStrategyFamilies` — round 1 runs the sweep's own 192-arm enumeration, not the hand-picked
  incumbent list, so question B is answered against the real table.
- [ ] **P36b** — Round 1 DONE on a 45-cell grid (mix x wealth x spend; predictions scored, S1-P1a
  WRONG — propwd never top-3 anywhere). The FULL 90-cell grid with the death-timing axis,
  `deathBasisStepUp` cross and `survivorSpendPct` factor is ROUND 2 and waits on `P35i`.
- [x] **P36c** — The three reporting tables produced; `conveffect` exclusion stated with its reason.
  GK caveat mandatory when reading them: survivorship (eligible arms 160→37 across spend rates) +
  spend drift (+38%/−12%) inflate every GK number.
- [x] **P36d** — `research/STRATEGY_FAMILY_RANKING.md` + a row in `research/HARNESSES.md`
- [ ] **P36e** — Decide P35's shipped arm count and `survivorSpendPct` default from the output
  (needs round 2)
- **Status:** round 1 DONE (2026-08-10); round 2 waits on `P35i`. Runs as P35's PR 7. **2026-09-01:**
  round 2's yardstick is the `P103a` ceiling, not rank-among-arms; its certification ("gap near
  0 -> families complete; fat gap -> names the missing family") is what triggers each `P103d` bake-off.

---

## P37: LEGACY / heir 10-year drawdown — DEFERRED by the user

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

## P40: Test-file layout — naming convention and a `tests/` subfolder (2026-08-06) — rename DONE, `tests/` move UNBLOCKED and undecided

Raised by the user as two proposals before continuing P39: enforce a test naming convention
(`XXXX.tests.js`), and move tests into `tests/` or `.tests/`. Costed against a reference inventory of
**189 occurrences across 25 files** and against this repo's own last rename, `d0f4a00` (5 files:
**11 files changed, 20 insertions, 18 deletions**).

| option | edits outside `.planning/` | files | judgment lines | silent-failure sites |
|---|---|---|---|---|
| rename 3 node suites `.test.js` -> `.tests.js` | ~29 | ~10 | 0 | 0 |
| also rename `optimizer_tests.js` | +10 | +2 | 0 | **2** |
| move all 7 files to `tests/` | ~55 | ~13 | ~18 | **2** |
| both at once | ~75 | ~15 | ~20 | **2** |

### `.tests/` is REJECTED PERMANENTLY — do not re-propose it

Not because it 404s, but because **the 404 is invisible to every check runnable before merge.**

- Jekyll excludes dot-directories. This repo deliberately has **no `_config.yml`**
  (`_includes/head-custom.html:6`), so no `include:` directive can exist to re-add one. Already
  proven empirically for `.planning/` (`progress.md:1208`, both `.md` and `.html` return 404).
- The one escape hatch is forbidden three times over: **never add `.nojekyll`**
  (`ARCHITECTURE.md:376`) — it would 404 every rendered docs URL on the site.
- **`python -m http.server` (`.claude/launch.json`) and `file://` both serve dot-directories.** So
  `.tests/` is green in 100% of local checks and red only on `main`, in production, on the flagship
  page.
- What then breaks is silent: `retirement_optimizer.html:1136` is `runTests?.();`, and optional-call
  does **not** guard an *undeclared* identifier — a 404 throws `ReferenceError`, aborting the inline
  block so `runSimulation?.()` at `:1138` never runs.

`tests/` (no dot) is fine on all of the above; `montecarlo/` is the working precedent in this repo.

### `optimizer_tests.js` is NOT renamed, and must stay out of any filename glob

Verified 2026-08-06: 2197 lines, a lone `function runTests()` at `:3`, **no top-level call, no
`module.exports`**. So **`node optimizer_tests.js` exits 0 having run nothing.** The pre-commit hook
prints `ok` for anything that exits 0 (`.githooks/pre-commit:49-52`), so pulling the release gate
into a `*test*` glob manufactures a permanent false green on the one file that cannot afford one.
The `*.tests.js` suffix is safe precisely because `_tests.js` does not match it.

### Decisions

- **DONE (PR 3 of this batch):** rename the three node suites `.test.js` -> `.tests.js` (`db363ba`).
- **UNBLOCKED as of 2026-08-07, still undecided:** the `tests/` move. It was deferred until after
  P39 items 2-6, because item 3 dual-modes `optimizer_core.tests.js` into the browser and moving
  first would commit to served paths for files about to gain browser exposure — two new-path risks
  stacked in one window — and would rewrite `require()` headers that item 3 then restructures
  anyway. **Those items are now merged**, so that reason has expired. The move is now a plain
  cost/benefit call: ~55 edits, ~13 files, ~18 judgment lines, 2 silent-failure sites. One new
  consideration the deferral did not have: the three suites are now `<script>`-loaded by
  `retirement_optimizer.html`, so the move must carry their `?v=` cache tokens as well as their
  paths, and a stale warm tab will keep requesting the old path (see the P39 GOTCHA in
  `progress.md`).
- **REJECTED:** `.tests/`, and renaming `optimizer_tests.js`.

### If the `tests/` move is later taken up

- Move **all seven** files together (the three suites + `sweep_golden.js` + its two generators +
  nothing else). A split along "node-only vs browser-loaded" is defined by a property P39 is about
  to invert.
- `sweep_golden.gen.js:24-25` are the only `path.join(here, ...)` calls that reach out to repo root;
  `:26`/`:56` and `import.js:95` keep working because `sweep_golden.js` moves alongside.
- The GENERATED/IMPORTED marker strings (`gen.js:53` vs `sweep_golden.js:118`, `import.js:74` vs
  `:792`) are a **rename** hazard only — a move preserves filenames.
- `ARCHITECTURE.md:305-318` and `research/HARNESSES.md` ("What does not belong here") both state a "where a test file
  belongs" rule that the move would repeal. Budget those ~18 lines as design work, not `sed`.
- Manual browser pass is irreducible: three pages, over both `http://localhost:8767` and `file://`,
  and specifically re-test Escape-closes-modal (`standalone/IncomeTaxPlanner.html:1194`) and the
  click handler (`:1276`), which die silently.

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

## P46: Tax Payment Planner backlog  *(was TPP-1..5; TPP-3/4/5 shipped and are archived)*

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

## P48: README caveats backlog  *(deferred by the user 2026-07-30, corrections already done)*

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

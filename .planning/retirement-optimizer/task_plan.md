# Task Plan: Retirement Optimizer — Remaining Work

**As of 2026-09-03**, v11.1718 in **PR #211** (open, base `main`; #209/#210 merged). Suites **411 / 61 / 22**, `TestTiers.EXPECTED` pinned to match.
**Planning files pruned 2026-09-02.** Every completed phase keeps a one-line stub below; the bodies are in `.planning/task_completed.md`. Phases nobody is working on are in `task_parked.md`. Findings that are no longer live - fixed defects, superseded claims, the pre-`Pnn` legacy block - are in `findings_archive.md`, and the rules they earned sit at the top of `findings.md` under "Rules earned the hard way".
The ID migration table is still below. The Open Task Index and the second recency trail were deleted as stale: **the NOW table here is the only priority list.**
Citations into `findings.md` are by HEADING, never by line number - about half the old line cites were already dead. Keep it that way.

## NOW — O0 and O1 only

Priority buckets are **O0..O3** so they cannot be mistaken for phase IDs, which all start `P`.

| Pri | ID | Task | Next item |
|---|---|---|---|
| **O0** | P103 | **`a`-`e` DONE, 3 MC modes.** GK spend + bracket-fill draw wins 12/18 mode-cells at 95-100% survival; ordered seqs hit **0%** and are out | `P103c` / ship |
| **O0** | P87 | Ceiling basis; **`P87c` SHIPPED** v11.16d4, MAGI now lands on the limit | `P87d` |
| **O1** | P95 | An ACA share link does not round-trip; it loads as Fill Bracket 10% | `P95a` |
| **O1** | P100 | **O1 from O0, 2026-09-01**: SELECTION not RESULT - the ranking defect is real, the frontier is not a better plan | `P100b2` |
| **O0** | P35 | **`P104b1` + `P104b1x` DONE 09-02, v11.1701: the phantom-gap fix. `P104a`/`P103a` re-baselined (gap 1.94% -> 1.29%; constants win 8/10, blends x7). `b2` unblocked** | `P104b2` |
| **O1** | P36 | round 2 measures against the `P103a` ceiling, not rank-among-arms | `P36b` |
| **O1** | P34 | NOT a P103 prerequisite (a-d are node harnesses); still the whole slow-machine story | `P34a` |
| **O1** | P28j | `P28jf` is the one RESULT item here: the timing rule moves every converting row | `P28jb` |

**Live carry-overs from finished phases** - the rest of what those phases did is in their stubs below:
- `P85` RE-RUN: converting earlier still wins 353 of 499, but **the RMD claim BROKE** - 124 counterexamples, all bracket strategies at a live IRA Goal. `P72` is still pending.
- `P56` open call: the brokerage footnote prints an absolute cost, not extra-vs-Plan-Q.
- `P91` was on `main` too - never a regression from this branch.
- `P91d` is the one open item left inside a phase marked DONE: the Monte Carlo controls are in neither the saved scenario nor the share URL.

User 2026-08-07: P28 and P40 demoted to **O3**, P37 and P48 raised to **O2**. 2026-08-29: P19 demoted to **O2**; P88 and P89 opened and closed. 2026-08-31: P98 opened and closed - an in-page test read the Limit menu before `DOMContentLoaded` built it. **2026-08-31 CLEANUP (user):** P35 to **O1** (cannot be "ideal" until P75/P36 land), leaving P87 the sole O0; 34 stale boxes closed under phases already shipped; **29 never-started phases moved to `.planning/retirement-optimizer/task_parked.md`** (nothing deleted); P28f/g/h confirmed shipped v11.162B; the 40/60 closed for good in **`P30i`**. **P101 opened** (2026-08-31, user): worked examples served from `examples/` and loadable by name, with notes - O2. **P102 opened and Stage B SHIPPED** (2026-09-01, user): goal-first mode, an ALTERNATIVE nerdknob-gated surface that drives the classic controls and never replaces them; `P30i` closed inside it. **P103 opened, O0** (2026-09-01, user: "reorder as you proposed"): the ceiling then the rules - `P75` and parked `P5` merged into it, `P100` to O1 as SELECTION not RESULT, `P102` Stages C/D deferred behind `P103d`. **`P103a` DONE same day**: oracle re-run on `1b7b366`, median gap 4.35% -> 1.58%, dominant lever flipped to the withdrawal split, `P51d` closed at <=0.013%. Full index next.
<!-- LINE-30 BOUNDARY. The planning hook injects `head -30` of this file on EVERY tool call
     and `head -50` on every prompt. A line added above here silently drops a table row out
     of that window, with no error. Keep this marker on line 30. -->

## P105: a survivor's RMD basis - DONE, v11.1718  *(NEW 2026-09-03, user-reported)*

User, from a share link: *"In 2049 it looks like it does not calculate the correct IRA RMD. It
appears it's only calculating the RMD for 'Spouse' not 'You' because it's the year 'You' dies."*

- [x] **P105 DONE 2026-09-03, v11.1718.** `computeIncome` moves the decedent's IRA to the survivor
      at the top of the year while `P84l`'s basis reads the prior December 31 SPLIT, so for exactly
      one year per death the inherited balance was in nobody's basis - `yr.rmd1` is zeroed by its
      own `alive1` guard. Fixed by adding the decedent's prior year-end balance to the SURVIVOR's
      basis at the survivor's own percentage (the treat-as-own election, so a survivor under their
      RMD age still takes nothing). The term self-extinguishes once the decedent's account has been
      empty a full year, so no double count. Evidence, arms and the A/B table: findings.md, "One
      year of RMD went missing at every first death" (2026-09-03).
      **Measured:** user's plan 2049 RMD $10,148 -> $283,315; spend IDENTICAL in every arm, tax and
      ending wealth move. Single filers show zero differing years. Two pins re-derived with their
      direction argued (`GK` tax +$49,329; `P38` forced-IRA 30,943 -> 20,309 - DOWN is right, the
      backstop reaches less far), two tests added, one `test.critical` **verified to fail against a
      pre-fix copy** ($3,151 charged where $73,834 is required). Suites 411/61/22, 17 critical
      guards. The user's framing was one year off: `alive1 = age1 <= die1` is inclusive, so the
      DEATH year's RMD was always taken and the first SURVIVOR year was the broken one.
      **Open:** nothing. `P72` (start month) still owns the year-0 basis limitation `P84o` pins,
      which is a different approximation in the same neighborhood.

## P104: how much per-year freedom does the draw split need?  *(NEW 2026-09-02, user-raised)*

**The user's question:** *"the real question is whether Proportional itself should be improved (or
replaced). I suspect a winning draw strategy will require strategic choice of assets to draw from on
a per-annum basis - not an 'IRA then fill' or ordered strategy."*

Opened because the first half was already answered and the second half was not. `P51c/e` had shown
the **withdrawal split** is the oracle's dominant lever and that Proportional is not default-optimal.
What nobody had measured is the thing that decides what to BUILD: per-year freedom, or a few phases?

- [x] **P104a DONE 2026-09-02** - harness `.test_harnesses/split_expressiveness_harness.js`, 38,721
      sims, 10 cells. Expressiveness ladder over the oracle's own archetype menu: `k=1` (one
      archetype, exhaustive), `k=2` (one switch, exhaustive over pairs and switch year), `k=free`
      (the oracle's per-year descent). Base is Proportional +0%, which fixes spend by construction
      and is also GK's draw. Full table in `research/PERFECT_FORESIGHT_ORACLE.md` under `P104`.
      **`X-P3` RIGHT 10/10 and it is the cheapest result: one better CONSTANT beats Proportional in
      every cell, $139,928 to $1,155,056.** The shipped default is the wrong constant, not wrong for
      being constant.
      **`X-P1` RIGHT 7/10: one switch captures 85-100% of the entire per-year optimum.** So the
      answer to the question is "mostly phases, not per-annum".
      **RE-BASELINED 2026-09-02 on the corrected engine (v11.1701, after `P104b1x`):** `X-P3` is
      RIGHT in **8 of 10**, $112,096 to $642,131; Proportional is itself the best constant in both
      brokerage-heavy cells. `X-P1` unchanged at 7/10, and one switch now BEATS the per-year descent
      in five cells. Winners moved from `Cash` x5 to `I5C5` x3 / `B4C6` x3 / `I4B3C3` / `Cash` /
      `family` x2 - blends 7 of 10, so the SPLIT field is needed more. The numbers in the lines
      above are the old engine's; the report's "P104 on the corrected engine" subsection supersedes
      them.
      **The three exceptions are all brokerage-heavy and they are large** - `brokheavy @6%` gets
      $938,307 from two phases against $1,603,960 per-year, a $665,653 increment (42%).
      **The blend surprise:** the best CONSTANT is a blend in 4 of 10 cells (`B4C6` x3, `prop` x1),
      and no shipped family can express a blend. Cash-dominant wins 8 of 10, agreeing independently
      with `GAPFILL_SPLIT.md`'s `w=0` winning 65 of 82. **The account SPLIT field is needed even for
      a constant.**
      `X-P2` WRONG (median 5 distinct / 7 switches vs 4 / 6). `X-P4`'s blip-collapse operator is bad
      - negative in two cells - and nothing rests on it; `k=2` measures the same thing soundly.
      **Trust boundary:** every rung has perfect foresight, and the k=2-to-k=free increment is by
      construction the MOST hindsight-fitted number in the table. `P103e` is the standing proof that
      fitted complexity dies out of sample (ordered sequences: 0% survival under bootstrap).

- [ ] **P104b** - let a family state a fixed account-weight vector (the constant split). Smallest
      possible version of the `P103b2` SPLIT field: one vector, not 33. Worth $140k-$1.16M on this
      grid. Needs a sweep-grid decision (which vectors) and a UI label.
      **PLANNED 2026-09-02** in three PRs with a review point after `b2`, on the `P35` convention.
      Evidence and file:line for everything below: findings.md, "The constant split is a plug, not a
      solver" (2026-09-02). Codes: *vector* = `[IRA, Brokerage, Cash, Roth]` relative weights;
      *replay identity* = two runs agree to the dollar on every column (the `P103b2` bar).

      **Design, settled from the code, not open:**
      - The field is `inputs.splitWeights`, a 4-vector of non-negative finite numbers with a
        positive sum, normalized by `calculateWithdrawals` (`optimizer_core.js:464`). Relative
        weights, never dollars, for the reason the `oracleWithdrawalPlan` comment gives: a dollar
        draw is chosen against last iteration's tax and desyncs.
      - The family is `strategy: 'split'`: a branch in `planPrimaryWithdrawals` beside `propwd`
        that sets `order/weight/taxrate` exactly as the oracle hook does (`:2192-2196`), and the
        same weights at the oracle's mirror in `fillSpendingGap` (`:2587`). It binds where the
        oracle bound and nowhere else, because `P104a` was measured on that path and its numbers
        transfer only if the family reproduces it.
      - Everything else is the baseline's: `isBracketStrategy` false (so the forced-IRA fallback
        stays on and the `[40,60]` branch is never reached), IRA Goal ignored, no `+%` boost.
        Cyclic composes as with `propwd` (harvest years preempt). `'split'` joins
        `ROTH_GAP_EXCLUDED`: Roth is in the vector, so a Roth-gap clone would be a twin.
      - A malformed vector (share link, hand edit) falls back to balance weights AND raises a
        warning the page shows - the `gapFillWeights` convention plus a visible flag. A research
        input may throw; a family reachable from a URL may not.
      - `STRATEGY_SELECTION_FIELDS` gains `splitWeights` with an element-wise compare, not the
        scalar compare that silently matched every Ordered row once already (`:4875-4878`).

      **Acceptance, before any row exists:** `strategy: 'split'` with vector `V` replays
      `propwd 0 + oracleWithdrawalPlan.fill(V)` to the dollar, pinned over at least three vectors
      (one single-account, two blends) and two mixes, with cyclic off; a test that strips the field
      re-breaks the replay (the `rateBasis` pattern); the malformed-vector fallback is pinned.

      - [x] **P104b1 DONE 2026-09-02** *(PR 1, engine only, nothing user-visible - no version, no
            changelog; committed 2026-09-02 on `worktrees/planning-with-files-a83df3`)* - `inputs.splitWeights`, `_splitWeightsFor`, the `'split'`
            branch, the gap mirror (harvest years excepted), `totals.splitWeightsInvalid`,
            `ROTH_GAP_EXCLUDED` (exported), `STRATEGY_SELECTION_FIELDS` with an element-wise compare.
            Eight tests; suites **405**/61/22; counts reconciled. **Replay identity holds to the
            dollar** over four vectors and two mixes: the family IS the oracle path.
      - [x] **P104b1x DONE 2026-09-02, v11.1701.** The acceptance test found a shipped defect
            (findings.md 2026-09-02, "The gap fill funds a Cash- or Roth-funded year twice"): pass 2
            sizes its gap from an income sum that omits pass 1's Cash and Roth draws, so those
            draws are made twice and the surplus is refunded, and with Max Conversion on it is
            CONVERTED - Proportional +0% converts $7.8k, $7.2k, $6.2k, $3.5k a year in
            `defaults3x @6%` and should convert nothing. Sized on a one-line scratch copy, ten
            cells, real after-tax wealth, spend identical: **Proportional +$241,868 mean (up 8 of
            10), Guyton-Klinger +$103,349**; Fill Bracket, IRA Draw, IRA-only split and Ordered
            exactly $0. `P104a`'s `Cash` winner LOSES in 7 of 10 on the corrected engine, and the
            `P51`/`P103a` gap tables were measured on the distorted path in both arms.
            **Path, revised 2026-09-02 after the user's policy** (*"anything that provably improves
            outcomes and/or run-time performance, or correctness is acceptable. Maintaining backward
            compatibility is nowhere on the list of objectives"*): the three-step staging behind a
            research flag was compatibility caution and is withdrawn. **Fix it directly** - the one
            line in `fillSpendingGap`, the `P104b1` pinned-defect test updated to the corrected
            numbers, golden fixtures regenerated, a changelog entry telling users their Proportional
            and Guyton-Klinger numbers moved and why, version bump - then re-run `P104a` and the
            `P103a` headline cells so the yardstick is measured on a correct engine. A harness in
            `.test_harnesses/` still ships with it, because the A/B is the proof, not because old
            plans need sparing.
            **DONE 2026-09-02 (user: "Go ahead with the fix"):** the one line, Ordered's comment
            rewritten as history, three pins re-derived (`P35n` sequence premise, GK triple, `P38`
            forced-IRA), two `test.critical` guards, suites **406**/61/22, changelog + page entry
            marked behavior change, v11.1701. Goldens untouched - they pin enumeration, not results.
            Findings: "The phantom-gap fix landed" (2026-09-02). **Re-baselines DONE 2026-09-02:**
            `P104a` (constants beat Proportional in 8 of 10, blends win 7, Proportional itself best
            in both brokheavy cells) and the `P103a` yardstick (controlled declining run: median gap
            1.94% -> 1.29%, basis extremes 2.23%, cells >=5% 17 -> 13, max conversions-only gain
            9.55% -> 2.34%, zero negative gaps), both in `PERFECT_FORESIGHT_ORACLE.md` with the old
            tables kept and an engine note at the top. **Still open:** the A/B harness in
            `.test_harnesses/` (the proof lived in the session scratchpad), and `P103d`/`P103e`
            re-runs on v11.1701 before their arm ships - GK's draw is the draw the defect distorted
            most.
      - [ ] **P104b2** *(PR 2, research, GATES b3; runs on the `P104b1x` engine or its winners
            inherit the confound)* - four measurements, predictions first.
            (i) Recover `P104a`'s per-cell `k=1`/`k=2` winners: the harness prints them and the
            report kept only aggregates (re-run 2026-09-02, results in progress.md).
            (ii) Fine `k=1`: the 3-simplex at 10% steps is 286 vectors; 286 x 10 cells is ~3.5 s.
            Add basis arms (b20/b80): `P104a` had none, and the split's whole cost is basis.
            (iii) Monte Carlo selection, new `.test_harnesses/split_mc_harness.js` on
            `gk_drawrule_mc_harness.js`'s structure: the archetype menu + the top fine-`k=1`
            candidates + Proportional `+0%` as incumbent, GBM / bootstrap / AAM, 100 paths, same
            seed and paths per arm, `CashReserve: 0` controlled. Median, 10th percentile, lifetime
            spend and survival - not an argmax. This DISCHARGES `P104d` for the constant split.
            (iv) Report `research/CONSTANT_SPLIT.md` + its `research/README.md` row, named for the
            subject; codes defined up top. Output: a recommended grid of 3-4 vectors with the
            survival that justifies each, and the row/run cost it adds.
            **Predictions, recorded before any of it runs:**
            `V-P1` `{Cash:1}` - single-path winner in 5 of 10 - fails survival under bootstrap in
            at least one cell where Ordered CIBR did, and is not median-best there. Its phase-2
            spill is Cash then IRA, Brokerage, Roth: CIBR's shape (`:593-600`).
            `V-P2` the fine simplex beats the 10-archetype menu in most cells, by under 10% of the
            `k=1` gain - the menu was close enough.
            `V-P3` the MC median-best vector is a blend (two or more non-zero accounts) in most
            cells, never a single account.
            `V-P4` at least one vector beats Proportional `+0%` at the median with no worse survival
            in every mode in 4 or more of 6 cells. **If `V-P4` is WRONG, `b3` does not proceed and
            `P104b` closes as "no robust constant".**
      - [ ] **REVIEW POINT (user)** - two decisions, both with the `b2` numbers in hand: the grid
            (which vectors ship as rows) and the family label. Label candidates: **"Fixed Split"**
            (recommended: plain words, no acronym), "Set Split", "Custom Mix". The panel is four
            fields, IRA / Brokerage / Cash / Roth, relative, any scale.
      - [ ] **P104b3** *(PR 3, product)* - rows in `OPTIMIZER_GRIDS` and `MC_GRIDS` (`:5378`,
            `:5384`), labels and `paramSortVal`, `offGridParamFor` for the user's own vector, the
            `#ui-split` panel + `toggleStrategyUI`, `getInputs`, share key (`sw`), `applyScenario`,
            the row-click adopt path (`optimizer_ui.js:2509`), MC `_label`, golden regen (MC via
            `sweep_golden.gen.js`; Optimizer via the four-state browser capture in
            `sweep_golden.import.js`), README strategy paragraph, `ARCHITECTURE.md` section 3a, one
            changelog entry (~150 words), the four version sites, the three count sites.
            **Budget:** the Optimizer is at 1,711 runs against its 1,500 cap already; `G` vectors
            cost ~`4G` rows over the clone passes (3 vectors = ~12 rows, +7% on 179). Rule `C1`: if
            anything is trimmed to pay for it, the page says so; no arm is dropped on a predicted
            winner. Rule `C2`: deterministic truncation order.
      - **Out of scope here, named so it is not re-derived:** the `+%` boost on a split; a per-year
        vector (that is `P103b2`'s field, gated by `P104e`); the switch, which `P104c` adds as
        `splitAfter: { year, weights }` on top of this field, additive.

- [ ] **P104c** - extend it to ONE switch (archetype A until year t, B after). This is `P35`'s
      phased carrier, and `P104a` says it reaches 85-100% of the ceiling in most regimes.

- [ ] **P104d** - Monte Carlo pass on whatever `P104b`/`P104c` pick, BEFORE anything ships. Not
      optional: this is the exact shape `P103e` caught, where the single-path winner reached 0%
      survival. Reuse `gk_drawrule_mc_harness.js`'s structure.

- [ ] **P104e** - only after the above, and only for brokerage-heavy mixes: is the per-year increment
      real out of sample, or is it hindsight? If hindsight, the per-year SPLIT field is not worth
      building and `P103b2`'s hole can be closed as "constant + one switch is enough".

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
- [x] **P103b COMPLETE 2026-09-01** - all of `b1`-`b5c` done; `strategy: 'schedule'` exists and
      carries every shipped family's spend and IRA draw. **One field never built: the account SPLIT**,
      which is what still stops Proportional and Ordered from being carried. `P103e` made that less
      urgent - the shippable result uses existing families and needs no schedule at all - so the split
      is now only needed if `P103c` proceeds. `P103b1x` below is a separate PRODUCT question.
      ORIGINAL SCOPE, kept for the record: **RESTRUCTURED 2026-09-01 (user).** Was "close the two plumbing holes". Two user
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
- [x] **P103b1x** - **DONE v11.1702.** Was: NEW, user-visible, NOT decided here. Leaving Cash Reserve blank costs
      **$84k-$120k** of real after-tax wealth in four of six headline cells and changes which strategy
      the tool would recommend. Whether the shipped default should change from blank (legacy
      all-to-cash) is a product question with a changelog entry attached, not a research one. Needs
      its own measurement across the wider Stage-1 grid before anyone proposes a new default.
      **MEASURED 2026-09-02 on v11.1701** (user asked for a default proposal): 12 cells (six mixes
      including a $790k `small` plan, 4%/6%) x 5 families x 8 reserve sizes, 480 sims, plus Monte
      Carlo (100 paths, GBM + bootstrap, six cells, Proportional and GK, 12,000 sims). **`0` is
      never worse than blank in any of the 60 family-cells (worst delta $0) and is best or tied in
      every family: mean +$243k (GK) to +$1.06M (Ordered) real after-tax; survival unchanged.**
      Every dollar of buffer costs: `$10k` gives up $8k (GK) to $135k (Ordered) of that gain on
      average with worst cases of -$29k to -$53k; `0.5x` and `1x spend` are the worst choices
      tested. **Proposal: default `0` - routing on, no floor - "Off" kept for the legacy behavior,
      the "Cash Reserve active" warning retired.** Not measured: DRIP off, cyclic, 8% spend, and
      any real-world liquidity preference the engine does not model. Findings 2026-09-02, "A Cash
      Reserve of 0 beats blank everywhere".
      **DONE 2026-09-02, v11.1702 (user: "setting the default to 0 is fine").** Default 0, the
      load-time warning retired, a `CashReserve` column in Annual Details (the field the user
      remembered was `-cashBreach`, a hidden flag; the held amount was never logged). The user's
      "larger unspent Brokerage" intuition checked before approval: composition yes, cost no - the
      step-up erases terminal gains and lifetime realized gains are identical. Stance recorded: Cash
      Reserve is one vehicle, Roth is the backup; no emergency-spending feature.
      **Follow-ups shipped same day:** `DRIP` + `SurplusBrok` + `SumBrokIn` columns and the
      BrokerageG tooltip (the reconciliation identity is now a test); Balances chart Scale
      linear / log10 / log2. **Open:** a gains-attributable-to-contributions column needs a
      shadow sub-balance (modeling choice: pro-rata draw attribution), not built.
- [x] **P103b2 DONE 2026-09-01** - `strategy: 'schedule'` is built, and the acceptance bar is met
      for the families it covers. Research input, default-off, node-only, on the
      `oracleWithdrawalPlan` discipline. Per-year entry `{ ordTarget, kind, rateBasis? }`; suites
      **389**/61/22 with every pre-existing test bit-identical. Harness:
      `.test_harnesses/schedule_replay_harness.js`. Report: `PERFECT_FORESIGHT_ORACLE.md`, `P103b2`.
      **Replay identity, measured:** Fill Bracket 12/22/24% and IRMAA tier 0/2 reproduce themselves
      **to the dollar, $0 on every column**. IRA Draw, Proportional, Ordered, Guyton-Klinger and
      Reduce compile to **nothing** - their per-year decision is a quantity, a sequence or the spend
      itself, not an income target.
      **`rateBasis` exists because the replay found a real asymmetry.** IRMAA and ACA ceilings derive
      marginal rates at the final limit; a federal bracket ceiling derives them at the STATUTORY top,
      before the `P92a` add-back and the state min. Deriving at the target made Fill Bracket 22%
      replay at the 24% rate: $0.34 adrift in year 8, **$121 over 33 years**. Now returned by
      `computeBracketCeiling`, logged as `RateBasis`, and pinned by a test that asserts stripping it
      re-breaks the replay.
      **Prediction `R-P1` WRONG, and the counterexample redraws the boundary.** ACA is partial, 3 of
      33 years: its cap lapses at Medicare eligibility and a lapsed year falls through to baseline
      Proportional. An absent entry currently means "draw nothing voluntarily", not "do what the
      family would have done". So the limit is not ceiling-versus-quantity - it is that **the schedule
      cannot state what happens when there is no ceiling.**
      **Three fields the evidence names for `P103b3`, in rank order:** a **quantity** lever (share of
      IRA / amortization / boost); a **fallback** for unscheduled years; an account **sequence**,
      which `oracleWithdrawalPlan` already expresses and the schedule has not absorbed.
      **Scope, stated plainly:** a representation, not a search. Nothing here optimizes anything.
- [x] **P103b3 DONE 2026-09-01** - four fields added, and **8 of 11 shipped arms now replay to the
      dollar** (was 5). Suites **394**/61/22. Report: `PERFECT_FORESIGHT_ORACLE.md`, `P103b3`.
      **The fields:** `iraDraw` (an explicit voluntary IRA draw in nominal dollars - the quantity
      lever, mutually exclusive with `ordTarget`); `gapFill` per year (`cascade`/`baseline`, because
      WHICH cascade fills the gap is the other thing a family decides); `scheduleFallback` (what an
      unscheduled year means); `convert` (a cap on the surplus routed to Roth).
      **Now exact:** ACA across its mid-plan lapse (was −$841,327), IRA Draw 5% (was −$1,182,054),
      Reduce 17 yrs (was −$1,469,870), plus the five ceiling arms already exact at `b2`.
      **"Total conversion control" was two levers and only one was missing.** The family conversion
      is a REALLOCATION of an already-taxed surplus, so converting less does not withdraw less.
      Converting less GROSS was already solved at `b2` by lowering `ordTarget`; what was absent is
      the destination, which `convert` caps. Both directions now exist.
      **Three wrong compilers before the right one.** Reconstructing the voluntary IRA draw from
      logged outcomes failed three times ($39,117 short, then $191,737 short, then $39,117 again),
      because downstream the decision is merged with the RMD, split across IRA1/IRA2, netted against
      conversions and adjusted by the shortfall cascade. Fixed by LOGGING the decision (`-volIRAwd`,
      captured at the one point where it is still a decision) - the same move that produced
      `rateBasis`. **A carrier compiles from recorded decisions, not reconstructed outcomes.**
      **And one boolean was worth a whole plan:** with every year correctly scheduled, IRA Draw was
      still $39,117 adrift because a year-0 entry was read as implying a conversion, which flips the
      withdrawal month Late -> Early for the entire plan. A ceiling implies one; a quantity draw does
      not. Pinned by a test comparing `timingReason`.
      **What remains is a coherent boundary, not leftovers:** the schedule says how much to take from
      the IRA, but not how to SPLIT a spending draw across accounts (Proportional, Ordered) and not
      what to SPEND (Guyton-Klinger). The split is `oracleWithdrawalPlan`'s, which already exists but
      PREEMPTS the strategy branch rather than composing - carrying Ordered means using that hook.
      **GK correction (user, 2026-09-01):** I wrote "outside the vocabulary by construction", and that
      is wrong. GK's per-year decision is the SPEND, and spend is a decision like any other - one a
      better draw strategy can improve, not a constant handed to the plan. The true statement is
      narrower and bigger: **this study PINS spend by choice**, so every ceiling in `P103a` is a
      ceiling at fixed spend, and that is why GK rows are excluded from the gap tables rather than
      compared in them. The oracle has never searched the spend axis. Opened as `P103b5`.
- [x] **P103b5a DONE 2026-09-01** - **the spend axis cannot be searched with a weight.** Harness
      `.test_harnesses/spend_objective_harness.js`; report `PERFECT_FORESIGHT_ORACLE.md` `P103b5a`.
      Sweeping the spend goal on a fixed base row, the model gives up **1.38 to 3.31** dollars of real
      terminal wealth per extra dollar of lifetime spending, against `SPENDABLE_WEIGHT = 1.10`. Below
      the technical rate everywhere measured, so the scalarized optimum sits at **minimum** spend in
      3/3 cells. `O-P1` WRONG and in the OPPOSITE direction from the prediction (I expected "spend
      everything"; it hoards). `O-P2`/`O-P3` RIGHT - and the rate varies 1.38-3.31 within one cell, so
      no single weight agrees with the model at both ends. **`P103b5` therefore needs a FRONTIER, not
      a weight**: report the (spend, wealth) pairs and let a human pick, the shape `P100` reached for
      row ranking.
      **`SPENDABLE_WEIGHT` is not wrong at its actual job** - ties between plans at equal spend (the
      term cancels) or equal wealth (it correctly prefers more spending). It just cannot price a real
      trade-off. Now documented in `optimizer_core.js` with both facts, at the user's request.
      **Side finding that constrains any spend search: feasibility is NOT monotone in the spend goal.**
      `round1 @4%` is feasible at 0.70, infeasible at 0.80, feasible again at 0.90-1.10.
      `totals.success` is a per-year `netIncome < targetSpend * 0.99` test, so a plan can dip under
      and recover. **No bisection for the maximum sustainable spend.**
- [x] **P103b4 DONE 2026-09-01** - **the representation is worth money, and this is the first item in
      `P103` to MOVE a computed number rather than describe one.** Harness:
      `.test_harnesses/schedule_oracle_harness.js`. Report: `PERFECT_FORESIGHT_ORACLE.md`, `P103b4`.
      No engine change; suites stay 394/61/22.
      **Arm A** = today's oracle (per-year `extraConversionAmount`, EXTRA on top of the base rule, so
      it can convert more and never less). **Arm S** = per-year `ordTarget`/`iraDraw` on the same base
      row, same objective, same spend pin, same MEASURED sim budget.
      **Arm S wins 6 of 6 cells: +$30,053 / +$11,259 / +$90,248 / +$22,195 / +$198,508 / +$197,877,
      i.e. +0.25% to +1.82%.** `S-P1` RIGHT. In the two cells where the conversion oracle finds
      NOTHING, the schedule finds ~$198k - those cells do not want more conversion, they want the base
      rule's draw moved year by year, which is exactly what the old axis could not say.
      **It also wins on an eighth of the compute** (1,021 sims vs 9,575 in `defaults @4%`), because a
      multiplicative candidate set is scale-free where a $25k grid over $0-400k is not. That is a
      direct input to `P34`'s slow-machine target and to the `P103c` search-cost question.
      **The first version of this harness was confidently wrong** and the shape is worth remembering:
      it chose the best non-cyclic base regardless of family, so five of seven cells handed Arm S an
      EMPTY plan (Ordered and GK compile to nothing per `b3`), which funds no spending, fails the pin
      and scores null after ONE simulation. It printed Arm S losing by the whole conversion gain and
      `S-P1` WRONG. **A null result that arrives after one simulation is a harness bug, not a
      finding.** The base is now the best row whose compiled schedule replays it exactly, verified per
      cell; `defaults3x @8% b20` is skipped honestly because no row there qualifies.
      **What it does NOT license:** these are perfect-foresight artifacts on one path, and the base
      rows differ from `P103a`'s champions because a carryable row is required. Whether a FIXED rule
      captures most of it - the `P35n` template - is `P103d`.
- [x] **P103b5 DONE 2026-09-01** - **spend is a schedule decision, and the schedule BEATS
      Guyton-Klinger.** Suites **397**/61/22. Report: `PERFECT_FORESIGHT_ORACLE.md` `P103b5`.
      **Two fields.** `spend` sets a year's goal in nominal dollars, applied where GK already adjusts
      spend and restored before the year-end carry-forward so it cannot compound. **`spendRule: 'gk'`
      runs the GK adjustment for ANY strategy**, which is the one that matters: a schedule owns the
      DRAW while GK keeps owning the SPEND.
      **The rule, never the recorded numbers** (user: *"the only rule it should follow is to use the
      GK spend goal adjustment strategy faithfully"*). Replaying GK's realized spend path under a
      different draw is a hindsight artifact - GK's own dynamics would have reacted to that draw.
      The rule, re-evaluated each year against the plan's own portfolio, is followable. My first pass
      did the former and the framing was corrected.
      **GK is DOMINATED in 10 of 12 cells: more lifetime spending AND more terminal wealth.** At the
      user's typical -1%/yr spend decline: +$26,285 spend / +$2,611 wealth at 4%, and +$91,655 /
      +$95,758 at 6%. Best case +$43,934 / +$198,581. **The two non-dominating cells are a RISING
      spend goal**, where it buys spending at the cost of wealth - a real trade, correctly not
      labelled dominance.
      **What it does NOT mean:** not $198k a user can have. It means **GK's account split is costing
      it this much at its own spending rule**, so the draw rule is what is worth replacing - `P103d`,
      now with a measured prize. Second thing in `P103` to move a number, and unlike `P103b4` it
      needs no perfect foresight.
      **One field left: the account SPLIT.** Proportional and Ordered still carry nothing.
- [x] **P103b5c DONE 2026-09-01, FIRST RESULT CORRECTED SAME DAY** - the spend path matters less
      than it first looked, and the correction is the finding. Report: `PERFECT_FORESIGHT_ORACLE.md`
      `P103b5c`.
      **What I published first, and withdrew hours later.** Running `--spendchange -1` ALONE, with
      routing left uncontrolled, the median gap went 1.58% -> 3.44% and I scored `D-P1` RIGHT "by six
      times the predicted margin". Crossing it with `--reserve0` for `P103d`'s map showed that was an
      INTERACTION with the routing confound, not a spend-path effect:
      | median gap, default basis | routing uncontrolled | routing CONTROLLED |
      | flat spend | 1.58% | **2.03%** |
      | -1%/yr | 3.44% | **1.94%** |
      **`D-P1` is WRONG.** Controlled, the gap does not widen at all. Negative gaps: 1 in each
      uncontrolled run, **0 in both controlled runs**.
      **Two claims withdrawn.** "The flat scalar's $0 in 45/45 is a flat-path artifact" - NO, under
      routing control it is **$0 in 44 of 44 on BOTH paths**; the 3 cells that appeared to break it
      were routing artifacts and **the original headline stands**. And "the gap roughly doubles" - no.
      **What survives, measured under control:** max conversions-only gain 0.57% -> **9.55%**;
      `S3-P4` flips WRONG (45/45 clean -> 44/45); and the basis arms CONVERGE on the declining path
      (all three medians 1.94%), so basis stops mattering to the median.
      **The lesson, and it is why the 2x2 was worth the extra run: these two fixtures INTERACT.**
      Correcting one fixture at a time moved the confound instead of removing it, and produced two
      false positives that survived a full write-up and a commit. A fixture nobody chose deliberately
      has to be crossed with the others, not fixed in isolation.
- [ ] **P103c1 GATE RUN 2026-09-01, verdict PROVISIONAL - NEEDS THE USER'S CALL.** Harness
      `.test_harnesses/magi_edge_gate_harness.js`. `P75a` asks whether the best rows' realized MAGI
      lands ON the MAGI menu, because `P103c`'s whole control variable is a search over that menu;
      "mostly interior" means stop and redesign.
      **Measured: 4.2% of 990 best-row plan-years sit within $1,000 of an edge** (1.3% at $250, 29.2%
      at $10,000). By family: ACA Cliff 9.1%, GK 4.9%, Fill Bracket 3.4%, Ordered 1.5%. In the fat
      8%-spend regimes, 4.2%. `U-P1` and `U-P2` WRONG, `U-P3` RIGHT.
      **WHY IT IS ONLY PROVISIONAL.** The first version of this measurement was WRONG: it rebuilt the
      statutory tables by hand and scaled them by the SPENDING inflation factor rather than the CPI
      indexation factor (the log carries both, and `P70` gives indexation a one-year lag), and it
      reported 1.1% for Fill Bracket - a family that fills a ceiling BY CONSTRUCTION. The
      impossibility of that is what exposed it. Edges now come off the log (`FedCap`, `StateCap`,
      `BracketTarget`, `-cpiFactor`), and a direct check confirms Fill Bracket 22% sits at **exactly
      $0** from its own `BracketTarget` in the years the ceiling binds - **6 of 33** in the cell
      tested.
      **So the low number now looks real, for a reason that is itself interesting:** a ceiling binds
      in a MINORITY of years even for the family built to fill it, and the best rows are mostly GK,
      which has no ceiling at all. **But this verdict would send `P103c` back to the drawing board,
      and it should not rest on a measurement whose first version was wrong.** Next step before
      acting: count binding years per family directly and confirm 6/33 generalizes.
- [ ] **P103c** - **the unified search** (was `P75a`-`P75c`; absorbs parked `P5`). **GATE: see
      `P103c1` above - PROVISIONALLY FAILING.** Do not build until that is confirmed. `P75`'s control
      variable - two per-year income targets, ordinary income realized and LTCG realized, searched
      over the ~12-edge MAGI menu - on the oracle's plumbing and in the oracle's role as ceiling.
      `P75a` stays the gate (edge residency of the best swept rows' realized MAGI; "mostly interior"
      means stop and redesign). `P75b`'s descent, `P75c`'s cliff-margin pricing, `P5`'s greedy
      forward pass as the cheap first seed. Build `magiEdgesForYear()` as its first artifact.
      **The search-cost question, and `P103b4` shrank it.** The worry this phase carried from the
      start: ~33 years x 4 schedule knobs is ~130 axes against today's ~33, which at ~25 candidates
      per axis per pass would be 10-30x the oracle's 8.3 s per plan - minutes per cell, and the
      reason e-ORP is an LP rather than a descent. **`P103b4` measured the opposite on the axes it
      actually searched:** the schedule descent converged on roughly an EIGHTH of the conversion
      oracle's compute (1,021 sims against 9,575), because multiplicative candidates are scale-free
      where a $25k absolute grid is not. So the cost has to be re-derived per axis rather than
      assumed from the axis COUNT, and whether an LP is needed at all is now an open measurement
      instead of a foregone conclusion.
- [x] **P103d DONE 2026-09-01** - **map derived AND bake-off run.** Report:
      `PERFECT_FORESIGHT_ORACLE.md` `P103d`. Harness `.test_harnesses/gk_drawrule_harness.js`.
      **The map**, from the only fully-controlled run (`--reserve0 --spendchange -1`, 409,277 sims,
      0 negative gaps): of the 17 cells with a gap >= 5%, **13 are at 8% spend** (4 at 6%, ZERO at
      4%) and **13 have Guyton-Klinger as the best family**. Fattest `round1 @8% b20` **22.78%**.
      The map RELOCATED rather than growing - `P103a`'s "6-8% and the b20 arm" is half right: the
      spend RATE is the axis and it is 8%; basis is not (all three basis medians 1.94%).
      **The bake-off.** Incumbent `strategy: 'gk'` (GK decides both) against each SHIPPED family run
      with `spendRule: 'gk'` (GK decides spend, the family decides the draw). A candidate wins only by
      delivering **no less lifetime spend AND more real terminal wealth**.
      **GK's draw is beaten in 24 of 30 cells (80%), including 15 of 15 at 6% spend.** Total left on
      the table **$6,564,797**, median gain per beaten cell **$231,345**, largest **$713,401**
      (`brokheavy @6% b20`, IRA Draw 5%). The 6 unbeaten cells are all at 8%.
      **`G-P1` WRONG, and how it fails is the point:** no single rule wins a majority (best is Ordered
      CIBR, dominating 14/30), but SOME rule wins 80% of cells. The replacement is regime-dependent,
      not absent. **`G-P2` RIGHT** - six distinct per-cell winners: Ordered CIBR 8, Fill Bracket 22%
      6, IRA Draw 5% 5, Ordered CBIR 2, IRA Draw 9% 2, Fill Bracket 24% 1. **`G-P3` WRONG** -
      IRA-first rules win 14 of the per-cell bests against 10 cash/brokerage-first, the OPPOSITE of
      `P35n`'s endgame result and worth understanding before anything ships.
      **What it licenses:** a regime-gated marked arm, "GK spend rule + a named draw rule", offered where the
      map says it wins and never as a silent default. Every candidate is a shipped family, so this is
      a sweep-table change rather than an engine one.
      **Caveat, stated in the report:** it measures the best rule PER CELL, and a user picks one up
      front. The shippable form is the sweep doing this search - which is what the Optimizer table
      already is. Still one deterministic path; `P103e` scores a survivor under many.
- [x] **P103e DONE 2026-09-01** - **uncertainty OVERTURNS `P103d`'s ranking, which is the whole
      reason this stage exists.** Harness `.test_harnesses/gk_drawrule_mc_harness.js`, 100 GBM paths
      x 33 years x 5 rules x 6 cells. Every rule sees the same banks, seed and path index. Built on
      `buildBanks`/`buildPathInputs` from `mc_engine.js` - the shipped machinery, not a fourth copy.
      **`E-P3` RIGHT 6/6, and it is the headline: the rule chosen on ONE path is NEVER the
      median-best rule under uncertainty.** Not a minority - every cell.
      **`P103d`'s crowned rule is the worst here.** Ordered CIBR won 8 of 30 single-path cells, more
      than any other, and survives **3% to 21%** of paths in four of the six MC cells (round1 @6%
      17%, thirds @6% 21%, brokheavy @6% 3%, thirds @8% 21%) against GK's 100%. A draw order that is
      best when every year returns exactly 6% is fatal when returns vary.
      **`E-P1` RIGHT 6/6** - some rule still beats GK's median everywhere, +$56,674 to +$620,781.
      **`E-P2` WRONG**, and it caught what it was for: in `defaults3x @6%` the median-best rule
      (Ordered CBIR) survives 57% of paths against GK's 100%. Wealth bought with survival.
      **The robust winner is Fill Bracket 22%** - median-best in **5 of 6 cells at 100% survival**,
      +$600,128 / +$211,074 / +$107,493 / +$99,743 / +$56,674, and it was ranked SECOND by the
      single-path bake-off.
      **P103's conclusion after five stages:** GK's spend rule is good, its DRAW is not, and pairing
      it with a bracket-filling draw is worth roughly $57k-$600k of median real terminal wealth at no
      cost to survival or spending. Shippable as a regime-gated marked arm from existing families -
      and **the selection must be made under Monte Carlo**, because the single-path ranking picked a
      rule that fails 80% of futures.
      **MODE SWEEP DONE same day** (`--mode bootstrap` / `--mode aam`), and it NARROWS the claim.
      **Both ordered sequences are disqualified outright on survival in every mode** - Ordered CIBR
      reaches **0% under bootstrap**, funding not one historical path in a cell, having been the
      single-path bake-off's most frequent winner. Fill Bracket 22% wins **12 of 18 mode-cells** at
      95-100% survival, but loses in `defaults3x @6%` in ALL THREE modes (GK's draw is right there)
      and flips +$107k -> **-$381k** in `thirds @6%` between GBM and bootstrap, which is the sequence
      risk GBM cannot show. `IRA Draw 5%` is the other safe candidate: **100% survival in every mode
      and every cell**, smaller gains.
      **So the recommendation is narrower:** pair GK's spend rule with a bracket-filling draw *in the
      regimes where it is measured to win*, never with an ordered sequence.
      **Every narrowing of the evidence flattered the answer** - one path picked a rule that fails
      most futures, one mode overstated how broadly the replacement wins. Remaining caveats: 100
      paths, 6 cells, one household profile.
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

- **Status:** **`P103a` through `P103e` ALL COMPLETE 2026-09-01.** The phase has a shippable result:
  **GK spend rule + Fill Bracket 22% draw**, median-best in 5 of 6 MC cells at 100% survival,
  worth +$57k to +$600k. Remaining in this phase: `P103c` (the unified search) and the account
  SPLIT field from `P103b2`; `P103b1x` is a product question for the user, not research.
  **Old-engine caveat (2026-09-02):** `P103d`, `P103e` and this shippable result were measured
  before the `P104b1x` gap-fill fix. On v11.1701 the map's shape survives (GK champions 10 of the
  13 fat cells, 8% spend dominates) but every number is old-engine, and GK's draw is the draw the
  defect distorted most. Re-run `gk_drawrule_harness.js` and `gk_drawrule_mc_harness.js` before
  the arm ships. See the report's "What changed with v11.1701".
  PRIOR NOTE:  The schedule now carries every
  shipped family's spend and IRA draw; the one remaining field is the ACCOUNT SPLIT, which is what
  stops Proportional, Ordered and Guyton-Klinger reproducing. `P103c`-`e` behind it. `P103b1x` is a
  separate product question.
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
(findings.md, "Two traps this work fell into", plus the cutoff-axis and account-mix heuristics in `P34`
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
**COMPLETE.** v11.16cf, 2026-08-31. Full body in `.planning/task_completed.md`.

## P94: remove the `minlimit` strategy entirely  *(2026-08-29, user-decided, DONE v11.16aa)*
**COMPLETE.** v11.16aa, 2026-08-29. Full body in `.planning/task_completed.md`.

## P97: the limit warning blamed spending for RMDs  *(2026-08-30, user-reported, DONE v11.16b0)*
**COMPLETE.** v11.16b0, 2026-08-30. Full body in `.planning/task_completed.md`.

## P96: the ACA note told a household past 65 to change something that cannot help  *(2026-08-29, user-reported, DONE v11.16ab)*
**COMPLETE.** v11.16ab, 2026-08-29. Full body in `.planning/task_completed.md`.

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
**COMPLETE.** v11.16a9, 2026-08-29. Full body in `.planning/task_completed.md`.

## P92: a chosen limit is the limit - no silent min, and say so when it cannot be met  *(NEW 2026-08-29, user-decided, O0)*
**COMPLETE.** v11.16aa + v11.16ab + v11.16af, 2026-08-29. Full body in `.planning/task_completed.md`.

## P91: the Stress Test's first result is computed on a stale plan horizon  *(NEW 2026-08-29, user-reported, O0, NOT a regression)*
**COMPLETE.** Shipped v11.16a5. Full body in `.planning/task_completed.md`. One item stays
live - a real gap, not a plan:

- [ ] **P91d** *(the one live item in this otherwise DONE phase; kept here rather than parked because it is a REAL gap, not a plan)* - **the Monte Carlo controls are in neither the saved scenario nor the
      share URL.** No `mc-*` key appears in `OPT_LONG_TO_SHORT` or the scenario field list, and
      `mc_tab.js` uses no `localStorage`. So paths, seed, stress count and stress window reset to
      their defaults on every load and cannot be shared. That is a separate gap and may be
      deliberate; it is recorded here because it is the first thing a reader will suspect when two
      runs of "the same plan" disagree, and it is NOT the cause of this one.

## P90b: the Cash Reserve warning named a value the field cannot hold  *(2026-08-29, user-reported, DONE)*
**COMPLETE.** 2026-08-29. Full body in `.planning/task_completed.md`.

## P90: two chart fixes  *(2026-08-29, user-reported, DONE v11.16a4)*
**COMPLETE.** v11.16a4, 2026-08-29. Full body in `.planning/task_completed.md`.

## P89: the ACA age gate read a year the plan does not start in  *(2026-08-29, user-reported, DONE v11.16a4)*
**COMPLETE.** v11.16a4, 2026-08-29. Full body in `.planning/task_completed.md`.

## P88: an Extra Roth Conversion never reaches MAGI, so IRMAA never charges it  *(NEW 2026-08-29, user-raised, O0)*
**COMPLETE.** v11.16a4, 2026-08-29. Full body in `.planning/task_completed.md`.

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
**COMPLETE.** v11.1690, 2026-08-28. Full body in `.planning/task_completed.md`.

## P74: Monte Carlo lost half the strategy identity in transit  *(fixed v11.1642 2026-08-25, user-reported)*
**COMPLETE.** v11.1642, 2026-08-25. Full body in `.planning/task_completed.md`.

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
**COMPLETE.** v11.160F, 2026-08-23. Full body in `.planning/task_completed.md`.

## P69: Replay - walk one Monte Carlo or Stress sequence through the main model
**COMPLETE.** v11.1657, 2026-08-26. Full body in `.planning/task_completed.md`.

## P82: replay and chart follow-ups  *(user-reported 2026-08-27, COMPLETE v11.1670)*
**COMPLETE.** v11.1670, 2026-08-27. Full body in `.planning/task_completed.md`.

## P78: Edit the plan against a pinned replay path  *(planned 2026-08-26, build later)*
**COMPLETE.** v11.1670, PR #194, 2026-08-26. Full body in `.planning/task_completed.md`.

## P79: Draw the 10 captured paths on the survival chart  *(planned 2026-08-26, build later)*
**COMPLETE.** v11.1670, 2026-08-26. Full body in `.planning/task_completed.md`.

## P80: Nerdknob - the historical years behind each bootstrap block  *(COMPLETE v11.1671)*
**COMPLETE.** v11.1671. Full body in `.planning/task_completed.md`.

## P81: the inflation floor guards the DRAW, not the derived index  *(user-raised 2026-08-26, O0)*
**COMPLETE.** v11.1662 + v11.1667, PR #195, 2026-08-26. Full body in `.planning/task_completed.md`.

## P70: Do high-inflation paths overstate tax?
**COMPLETE.** 2026-08-26. Full body in `.planning/task_completed.md`.

## P71: Dedup the Monte Carlo engine - one runPass instead of two hand-kept mirrors
**COMPLETE.** v11.161C + v11.161F, 2026-08-23. Full body in `.planning/task_completed.md`.

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
**COMPLETE.** v11.1640, 2026-08-24. Full body in `.planning/task_completed.md`.

## P75: Year-by-year withdrawal mix - income-target optimization  *(2026-08-25, user-raised; **MERGED INTO `P103` 2026-09-01**)*

**MERGED.** `P75a`-`P75c` are now `P103c`; `P75d` follows `P103e`; `P75e` stays a stretch item under
`P103c`. Kept below as the design record. **One correction:** `P75d` says "withdrawals do not"
accept per-year arrays. They do - `inputs.oracleWithdrawalPlan[y]`, `optimizer_core.js:1860`,
shipped with `P51b` and on `main`. This phase never referenced `P51`; the two were unconnected
attacks on the same problem, which is the reason `P103` exists.

**Why:** every strategy family picks ONE rule and holds it for the whole horizon; the true optimum
is a per-year schedule. The engine's own evidence says analytic shortcuts fail here (BETR wrong in
both regimes, findings.md, "Surplus routing (Cash Reserve, P2) is upstream"; Break Even boundary year off by 12 years and $662k from the
searched optimum, findings.md, "1. The optimum is 2031, not 2043"), so this phase treats it as numerical optimal control over
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

**Prior art:** findings.md, "P75 prior art: i-ORP, e-ORP" - i-ORP (Welch) ran this as LP in production for two decades; the
archived ModelDescriptionK.pdf describes the model (read 2026-08-25: equations NOT included -
e-ORP's solver.py and Ragsdale/Seila/Little 1994 carry explicit formulations). e-ORP
(github.com/dcurrie/e-ORP,
findings.md, "e-ORP - the successor") is the living MILP re-implementation. DiLellio & Ostrov the academic line;
wscott/fplan and mdlacasse/Owl adjacent open-source MILP planners. None carry this engine's
state-tax/ACA/widow fidelity - the expensive part is already built here. **LP, MILP, SCIP, DP and
PWL are defined at findings.md, "Method glossary"**, with the cliff-as-binary encoding and why this phase needs
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
**COMPLETE.** v11.1330. Full body in `.planning/task_completed.md`.

## P26: README/FAQ cross-references from tooltips (pending, deferred 2026-07-28)

**Why:** several tooltips and banners restate material that already exists under `## Frequently Asked Questions` in `README.md` (anchored headings such as "Is It a Fool's Errand to Make Multi-Decade Projections?", "Is the Break-Even Tax Rate Trustworthy?", "Why does the Optimizer say converting never helps?"). Pointing at those anchors keeps one source of truth and shortens the in-app text.

**Needs:** a pass to decide which existing text has a matching FAQ entry, which needs one written, and where the link should land. The "where does the reader land" question is settled by P25: link at `README.md#<anchor>` and `doclinks.js` maps it to `/#<anchor>` on the live site while leaving the file link intact locally. Note kramdown's generated ids, not GitHub's: check the rendered `/` for the exact id before hardcoding one.

---

## P28: "Every voluntary IRA withdrawal is a Roth conversion" (2026-07-30) — RESEARCH DONE, feature decision open
**COMPLETE.** 2026-07-30. Full body in `.planning/task_completed.md`.

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
**COMPLETE.** v11.168c + v11.168d, 2026-08-28. Full body in `.planning/task_completed.md`.

# Batch added 2026-08-01: P29-P34

Six phases from a user punch-list. **Four of them touch questions this repo has already partly
answered, and two were answered NO.** Each carries an explicit "Already ruled out" block; that block
is as much the deliverable as the task list, and it exists to stop a re-derivation of P24 and P28.
Recommended run order is P33, P34, P30, P32, P31, P29 (P33, P31 and P29 are now in task_parked.md),
not phase-number order.

---

## P30: Withdrawal policy — the constants nobody chose, and whether strategy should imply order at all
**COMPLETE.** v11.163F, 2026-08-24. Full body in `.planning/task_completed.md`.

## P32: Brokerage is barely drawn — why, and is the third-pass exclusion still right?
**COMPLETE.** v11.15e3, PR #185, PR #155. Full body in `.planning/task_completed.md`.

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
   (findings_archive.md, "Two strategy-matching gaps", verified live $564,869 → $983,705).
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
   **The risk is real and already documented:** findings.md, "Two traps this work fell into" is exactly this failure — a coarse
   8-point evenly-spaced amount grid **silently invented wrong answers**, reporting "never pays up to
   75%" when the true answer was 48%, and 25% against a true 15%, because paying amounts are only ~16%
   of the IRA and an even grid steps straight over them. $100k coarse on a $5M IRA is a 50-point grid,
   not an 8-point one, and the refine window must be wide enough to recover the *neighbors* of the
   coarse winner, not merely bracket it. Acceptance is not "it is faster" — it is a **diff against the
   full sweep on several scenarios** (findings.md, "Two traps this work fell into"), including both known traps.
6. **Early exit on a declining score in `optimizeConversionAmount`.** There is none today. Tempting,
   and dangerous for the same reason P24 §7 recorded on the cutoff axis (findings.md, "7. The search must stay a linear scan": 1-7
   first-difference sign flips, 7 at growth 10%). **Whether the AMOUNT axis is unimodal has never been
   measured.** That measurement is a legitimate task and a hard prerequisite: no early exit ships
   without it, and if the axis is not unimodal the answer is no.

**Tier 3 — ruled out, do not propose:**
- Binary or ternary search on the **cutoff** axis (findings.md, "7. The search must stay a linear scan") — not unimodal, converges on
  the wrong answer **undetectably**. Cost was never the argument for the linear scan; it is 46ms.
- Any stop-year heuristic (P24 §6, findings.md, "6. No heuristic substitutes for the search"): marginal-rate crossing **pins at 33.3% in
  every year and cannot discriminate at all**; IRA share ranges 4-78%; age/RMD offsets run -15 to +14;
  terminal-mix target failed.
- "No IRA left at the end" as a skip filter (findings.md, "Two traps this work fell into") — "looked obviously safe and lost the
  right answer on a $3.3M scenario (reported 25% against a true 5%)."
- Any account-mix ranking heuristic (findings_archive.md, "The account mix decides").
- BETR as a screen (findings.md, "Surplus routing (Cash Reserve, P2) is upstream") — wrong in both regimes in opposite directions; the column and
  tile were already removed.

**The bar any Tier-2 item must clear, stated as a template.** `breakEvenHeirsRate()`
(`optimizer_core.js:3093-3126`) uses binary search **legally**, and only because monotonicity in the
rate axis was *measured* across five scenarios (findings.md, "Rate-axis monotonicity") and is *pinned by a test*
(`optimizer_core.test.js:1856-1868`). Measure the axis property, then pin it with a test that fails if
the property stops holding. Nothing else qualifies.

**Two costs nobody has on a list, worth pricing here.** `bestTimeLimitedConversion`
(`optimizer_core.js:3141-3209`) at ~148 sims per candidate is **already capped at 6 candidates**
(`optimizer_ui.js:1047-1049`) because all 12 pushed one run to 2,216 sims past the 1,500-run budget —
that cap is a silent quality reduction, and Tier-1 wins may buy the budget back to restore it. And the
Break Even dual-sim (`optimizer_core.js:2455-2498`) is +1 sim per converting row (measured 1.96x /
+74ms on a 144-row sweep) whose second counterfactual `cfExcess` (`:2494`) fired on **0 of 144 rows**
- a candidate for removal or a cheap guard.

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
      findings.md, "Two traps this work fell into"
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
- **Terminal-mix-as-target** (P24 §6, findings.md, "6. No heuristic substitutes for the search") — the optimal mix is an output of the
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
**COMPLETE.** v11.15fa + v11.15fd, refined through v11.1601, PR #186. Full body in `.planning/task_completed.md`.

## P35 PR 3 replan (2026-08-04) — kept as the record behind P35c/P35d
**COMPLETE.** The per-PR write-ups for `P35c`/`P35d`/`P35e` live in `.planning/task_completed.md`
under this same heading. The duplicate that stood here disagreed with `P35`’s own settled-decisions
table about `deathBasisStepUp`, so it was removed rather than archived a second time.

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
a true 5%" (findings.md, "Two traps this work fell into"). **The only result justifying deletion is a zero test:** an arm
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
family (findings.md, "PF11 + PF13 Findings"):
1. Per-objective x per-family **mean rank**. A monopolist is low in every column; a niche winner is low
   in one. This is what answers "what should the default ordering be."
2. Per-cell winner counts, **one vote per cell per objective**, so no family takes two seats from one cell.
3. Per-arm **zero test** — count of cells where an arm's money fields are byte-identical to another's.
   Only 100% is a deletion candidate.

**Non-negotiable:** rank on `baselineScoreOf` / `afterTaxNetWorth` with a **shared** rate, never
`finalNW` (findings.md, "PF11 + PF13 Findings" — "a per-run rate belongs inside a run, never in a cross-run
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
**COMPLETE.** v11.14bf. Full body in `.planning/task_completed.md`.

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
**COMPLETE.** v11.14c6, 2026-08-09. Full body in `.planning/task_completed.md`.

## P57: Tax Payment Planner - stop describing one plan while recommending another, and stop implying free money  *(NEW 2026-08-18, user-approved, all four groups, follows P56)*
**COMPLETE.** v1.1599 + v11.1599, 2026-08-18. Full body in `.planning/task_completed.md`.

## P58: the withholding a taken draw is ASSUMED to have carried  *(PROPOSED 2026-08-18, found while reviewing P57, NOT approved, no code written)*
**COMPLETE.** 2026-08-18. Full body in `.planning/task_completed.md`.

## P64: SALT deductibility — the Optimizer never passes `propTax`  *(NEW 2026-08-19, user-approved, O0, STUDY FIRST)*
**COMPLETE.** v11.15b6 + v11.15b7 + v11.15c8, PR #184, 2026-08-19. Full body in `.planning/task_completed.md`.

## P66: IRMAA - the tier ceiling aimed two years of inflation too low  *(COMPLETE 2026-08-20, v11.15cf, PR #182/#183)*
**COMPLETE.** v11.15cf, PR #182, 2026-08-20. Full body in `.planning/task_completed.md`.

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

## P52: Monte Carlo run scope, plan-of-record vs compare-all  *(DONE 2026-08-12, shipped in v11.150b)*
**COMPLETE.** v11.150b, 2026-08-12. Full body in `.planning/task_completed.md`.

## P53: Monte Carlo Stress Test suite  *(DONE 2026-08-13, shipped v11.1521-v11.152f, PR #170)*
**COMPLETE.** v11.1521 + v11.152f, PR #170, 2026-08-13. Full body in `.planning/task_completed.md`.

## P54: `?montecarlo` teaching demo + mode-aware paths floor  *(DONE 2026-08-15, shipped v11.1553, PR #173)*
**COMPLETE.** v11.1553, PR #173, 2026-08-15. Full body in `.planning/task_completed.md`.

## P56: Tax Payment Planner — five-plan matrix (A/B/C/D/Q) + one unified cost table  *(NEW 2026-08-17, plan APPROVED by user, O0, no code written)*
**COMPLETE.** v1.1598 + v11.1598, 2026-08-17. Full body in `.planning/task_completed.md`.

# Perfect-foresight oracle: how much a plan leaves on the table  *(phases P51, P103a)*

**Run:** **2026-09-01, engine at `1b7b366`**, suites 382/61/22. Supersedes the 2026-08-10 run at
engine `5e1075e`; **[what moved between the two runs](#what-changed-between-the-2026-08-10-and-2026-09-01-runs)**
has the before/after, and it moved a lot.
**Harness:** `node .test_harnesses/oracle_harness.js` (P51a) / `--full` (P51c-g).
45 cells (5 mixes x spend 4/6/8% x basis default/20%/80%, wealth x1), 33-year horizon.
**418,289 sims, 373.4s** sequential node on the reference box (Ryzen AI 9 HX 370); the P51a half is
175,695 sims / 141.4s. Per cell: **~8.3s**, so roughly **29-50s per plan on a 3.5x-6x slower
single-core machine**.
**Objective:** wealth-only real after-tax NW at the cell's shared heirs rate, **spend pinned**
(candidates with shortfall > $1 or delivered spend != base +- $1 are discarded). Backstops
instrumented, never bypassed.
**Cross-check:** `P51d` is answered below, in [the cross-check section](#p51d---is-the-ceiling-really-a-ceiling-independent-search-cross-check).

## Reading guide - every label used below, defined once

**Where this file sits.** The user asked three questions on 2026-08-10: **(A)** how hard
whole-horizon asset-utilization optimization is on this engine, **(B)** whether Cyclic leaves money
on the table in its harvest years, **(C)** whether Proportional's optimality can be proven. Those
were answered by a three-stage program: **Stage 1** and **Stage 2** are the scans and A/Bs in
[`BROKERAGE_DRAW.md`](BROKERAGE_DRAW.md) and [`STRATEGY_FAMILY_RANKING.md`](STRATEGY_FAMILY_RANKING.md); **Stage 3** is this
oracle, allocated as phase P51. So "question A" and "question C" below are the user's, and
"Stage 1's q3" points into `BROKERAGE_DRAW.md`.

**What "oracle" means here.** A search allowed to CHEAT: it is handed the entire future return path
(6% growth, 2.5% inflation, every year) before it chooses anything, then picks, year by year, how
much to convert and which accounts to draw from, re-simulating the whole 33-year plan for every
candidate. Because it knows the future, what it finds is a CEILING no honest strategy can beat on
that path. Nobody can follow it - real retirees do not know next year's returns - so it is
research-only, default-off, node-only. **Its one product is the GAP.**

**The predictions, `S3-P1` to `S3-P4`, `B-P4`, and `X-P1` to `X-P3`.** All registered in their
harness before the numbers were looked at; verdicts are in **Predictions scored**, below. `S3-` is
the Stage-3 batch, `B-P4` the basis-axis extension, `X-` the P51d cross-check:

| id | prediction |
|---|---|
| **S3-P1** | the conversions-only oracle beats the best FLAT scalar conversion by <3% in most cells, and the win concentrates in the pre-SS / pre-RMD window - timing, not total volume |
| **S3-P2** | the median gap to the oracle of each cell's best family row is <4% |
| **S3-P3** | oracle trajectories show harvest-like alternation - Brokerage-dominant years alternating with IRA-dominant ones - in the thirds / brokheavy mixes |
| **S3-P4** | accepted oracle solutions show ~zero backstop activity (forced IRA in <5% of years) |
| **B-P4** | the best-family gap GROWS at 20% basis, and Proportional's gap stays >1% at both basis extremes |
| **X-P1** | at equal sim budget an independent search beats the oracle's coordinate descent by <1% in most cells |
| **X-P2** | the cross-check's residual is largest where the descent's own prize is largest |
| **X-P3** | tripling the cross-check's budget moves it by less than the descent-to-cross-check difference itself |

**Grid labels.** The five mixes are `defaults`, `defaults3x`, `round1`, `thirds`, `brokheavy`; the
Coverage section below gives each one's balances. `b20` / `b80` name the basis arm - cost basis as a
share of the Brokerage balance, so low basis means highly appreciated. `CBIR` is an ordered-strategy
draw sequence, one letter per account (**C**ash, **B**rokerage, **I**RA, **R**oth). `GK` is
Guyton-Klinger guardrails, and a "GK-base cell" is one where GK is the only family that survives at
the base row's delivered spend. A bracketed modifier - `[ira-first]`, `[brokerage-first]` - is a
**cyclic** clone of the row (`cyclicEnabled` plus that `cyclicOrder`); `[cash]` is the
conversion-funded-from-cash clone.

---

## What the oracle IS and IS NOT (read first)

Perfect foresight on ONE deterministic path: an upper-bound **diagnostic**, never a policy.
And it is a ceiling only over what its two levers control - per-year `extraConversionAmount[]`
and the per-year `oracleWithdrawalPlan` split across IRA/Brokerage/Cash/Roth. **It does NOT
control surplus routing**, and this still shows up in the data: in `defaults @6%` the cyclic row
`IRA Draw 5% [ira-first]` BEATS the oracle by $6,597 (gap −0.19%), because cyclic's
surplus-to-Brokerage routing is a mechanism the withdrawal menu cannot express, and the hook
refuses to compose with cyclic by design (`optimizer_core.js:1908` throws). Two honest
consequences:

1. Coordinate descent over a 10-archetype menu is local and coarse, so every oracle number is a
   LOWER bound on the true ceiling. **`P51d` now sizes that phrase: at most 0.013% of after-tax
   NW on the conversion axis** (below). The withdrawal-split axis is still un-cross-checked.
2. The negative gap is itself the attribution: **cyclic's residual edge lives in surplus routing,
   not in draw order** - consistent with the Q3 surplus-routing confound in [`BROKERAGE_DRAW.md`](BROKERAGE_DRAW.md).
   It is now 1 row in 1 cell of 45, down from 2 rows in the 2026-08-10 run. **And `P103b1`, below,
   shows it is a HARNESS artifact: hold surplus routing constant with `--reserve0` and no row beats
   the ceiling at all.** The engine reaches Brokerage three ways; this grid armed none of them.

## P51a - conversions-only (champion base, 45/45 cells)

| finding | number |
|---|---|
| Oracle gain over the champion row, **default basis** | **0 - 0.57%** (max +$19,501, `defaults @6%`) |
| Oracle gain, **basis 20%** | **0 - 13.49%** (max +$201,368, `defaults3x @8% b20`) |
| Oracle gain, **basis 80%** | **0 - 2.67%** (max +$40,810, `defaults3x @8% b80`) |
| Best flat scalar (core's own `optimizeConversionAmount`) | **$0 in 45 of 45 cells** |
| `S3-P1` (oracle beats flat by <3% in most cells) | **RIGHT**, 15/15 default basis; 14/15 at b20 |

The flat sweep still finds nothing anywhere, so **per-year conversion shapes remain genuinely
inexpressible to the flat sweep** - the same conclusion `bestTimeLimitedConversion` reached from
the other direction. What HAS changed is the size of the prize: on today's engine the per-year
shape is worth at most $19.5k at default basis, where the 2026-08-10 run measured up to $241k.
The exception is the highly-appreciated brokerage arm, where it is worth far more than before
(+$201k at `defaults3x @8% b20`, 13.49%).

Timing still clusters mid-plan rather than in one early burst: `defaults @6%` converts in years
6-14 and 16 of 33 (SS starts around year 4-6, RMDs around year 11), `defaults @4%` in years
1-4, 8, 9 and 14.

Two methodology fixes remain load-bearing and are pinned in the harness comments: champion
selection must use `baselineScore` (wealth-only lets GK buy the slot by cutting spend), and every
candidate must pin delivered spend to the base row (without the pin, a GK base showed a fake
+81% that was pure spend-shifting).

## P51c/e - full oracle and the gap-to-oracle table (non-cyclic base per cell)

Per-cell decomposition (base -> +conversions -> +withdrawal-split), the six cells the earlier run
headlined, so the two are directly comparable:

| cell | base row | +conv | +split | best-family gap | Proportional gap |
|---|---|---|---|---|---|
| defaults @4% | Reduce 17 yrs [cash] | +$11.8k | +$26.1k | 0.64% (Reduce) | 1.19% |
| defaults @6% | Ordered BCIR | +$91.5k | +$0.7k | **−0.19%** (cyclic IRA Draw) | 5.23% |
| defaults3x @4% | Ordered BCIR | +$117.6k | +$4.6k | 1.58% (Ordered) | 7.13% |
| round1 @4% | Ordered CIBR | +$0.5k | +$0.4k | 0.01% (Ordered) | not eligible |
| thirds @4% | IRA Draw 5% | $0 | +$57.7k | 0.49% (IRA Draw) | not eligible |
| brokheavy @4% | Ordered CBRI | $0 | $0 | **0.00%** | not eligible |

**Median best-family gap: 1.58% at default basis, 1.13% at b20, 0.90% at b80.** The
2026-08-10 figures were 4.35 / 4.47 / 1.83%.

GK-base cells (6/8% spend, where only GK survives at the base's delivered spend - their gap tables
contain only GK itself) are where the money now is: +split reaches **+$856,425** (`brokheavy @6%
b20`) and **+$655,976** (`thirds @6%`); +conv reaches **+$331,152** (`defaults3x @6% b20`). Oracle
gains over the GK base run **0.35% - 20.9%**.

**Attribution, and it has FLIPPED since 2026-08-10.** The withdrawal split is now the larger lever
in most cells; conversion timing dominates only in the IRA-heavy `defaults` / `defaults3x` families
(`defaults3x @4%`: 96% of the gain is conversions, the one place the old 97% claim survives). The
four largest single gains in the run are all split, not conversions. `brokheavy @4%` remains the
boundary case in both directions: at default and 80% basis Ordered CBRI already sits AT the
expressible ceiling and the oracle changes nothing, while at b20 the same mix leaves +$394,657 on
the table. **`P103b1` retires even the conversion exception** - `defaults3x @4%`'s 96% is a
surplus-routing artifact, and with routing held constant the split dominates in all six.

**Answer to question C (the absolute half):** "Proportional is default-optimal" stays **REFUTED**,
but by a smaller margin than before - where Proportional has an eligible row its gap runs
**1.2% - 7.1%** (was 2.3% - 11.6%), and IRA Draw or Ordered dominates it in every cell where both
are eligible. (The comparative half was already refuted by Stage 1's rankings.)

**Answer to question A:** difficulty as measured - conversions-only needs ZERO engine change at
~3.1s/cell; the full dance needs one default-off hook pair (~40 lines) plus this harness at
~8.3s/cell. Whole-horizon optimization on this engine is cheap enough to be a standard research
instrument; it is only its POLICY use that is out of bounds. **What it is NOT cheap enough for is
interactive use:** ~8.3s per plan on the reference box is ~29-50s on the machines the tool's
audience actually owns.

## P51d - is the ceiling really a ceiling? Independent search cross-check

Open since 2026-08-10 and now answered. **Harness:** `node .test_harnesses/oracle_crosscheck.js`
(`--budget 3` for the 3x arm). It re-runs the oracle's own coordinate descent **in the same
process** as Arm A, then hands Arm B - a search of a different shape - the SAME measured sim count.

| | Arm A (the oracle) | Arm B (the cross-check) |
|---|---|---|
| shape | cyclic coordinate descent, one year at a time | random restarts, greedy on random moves |
| starts | 3 fixed seeds (zero / flat scalar / champion replay) | those 3, then random sparse vectors |
| moves | per-year full scan of the menu | block add over a run of years, shift between years, whole-vector scale, swap, nudge |
| grain | $25k grid + $5k refinement | $1k |
| budget | whatever it spends | exactly that, measured (or 3x) |

Five cells, one per mix. **Arm B never finds materially more:**

| cell | descent gain | B − A, equal budget | B − A, 3x budget |
|---|---|---|---|
| defaults @6% | $19,501 | +$38 (0.001%) | +$451 (0.013%) |
| defaults3x @4% | $14,297 | **−$4,397** | **−$10,250** |
| round1 @4% | $531 | +$82 (0.001%) | +$82 (0.001%) |
| thirds @4% | $0 | +$12 | +$256 (0.002%) |
| brokheavy @4% | $0 | $0 | $0 |

- **`X-P1` RIGHT, 5/5.** Max residual **0.001%** of after-tax NW at equal budget, **0.013%** at 3x.
  So on the conversion axis the phrase "lower bound" is worth about one part in ten thousand, and
  every published gap-to-oracle above is near-tight rather than wildly conservative.
- **`X-P2` WRONG.** The residual does not track the size of the prize: the two cells with the
  largest descent gains produced +0.013% and a NEGATIVE result.
- **`X-P3` WRONG in 3 of 5** (scored by hand across the two runs; the harness scores `X-P1` and
  `X-P2` only). Tripling the budget moved Arm B by more than the A-to-B difference itself in
  `defaults @6%`, `defaults3x @4%` and `thirds @4%`, so Arm B is NOT converged.

**Read the negative cells correctly, because they are the limit of this evidence.** A negative
B − A means Arm B is the WEAKER searcher there, and it got weaker at 3x budget (−$4,397 ->
−$10,250) because more restarts bought exploration instead of depth. In those cells the
cross-check bounds nothing; it only fails to find more. **What P51d establishes is therefore
one-directional: an equally-costed search of a different shape cannot beat the descent by a
meaningful margin. It is not a proof of optimality**, and it says nothing at all about the
withdrawal-split axis, which needs the `oracleWithdrawalPlan` hook and a menu of its own.

## P103b1 - the surplus-routing confound, and what it costs

**Run:** 2026-09-01, same engine, `node .test_harnesses/oracle_harness.js --full --reserve0`.
391,160 sims, 359.6s. The flag is opt-in; a bare run still reproduces every number above.

**Why it exists.** The published grid leaves `CashReserve` unset, which is the shipped default and
the legacy all-surplus-to-Cash behavior. Cyclic rows bank surplus in Brokerage instead, and an
Ordered brokerage-first sequence does too. So the default grid compares arms that differ in **where
surplus lands** as well as in how it is drawn. `--reserve0` sets `CashReserve: 0`, which routes
every arm's surplus to Brokerage (`optimizer_core.js:2774`: overflow above the buffer is reinvested,
and a buffer of zero means all of it), isolating draw order from routing.

**Result 1: no shipped row beats the ceiling any more.** Negative gaps go **1 -> 0**. The cyclic
`IRA Draw 5% [ira-first]` row that beat the oracle by $6,597 in `defaults @6%` does not beat it once
the non-cyclic arms can bank where it banks. **The "surplus routing is outside the oracle's menu"
hole is a harness confound, not an engine limitation** - the engine already reaches Brokerage three
ways, and the harness armed none of them.

**Result 2: the routing setting is worth more than the ceiling gap.** Base row, reserve unset ->
`CashReserve: 0`:

| cell | base row (unset -> reserve 0) | base score | change |
|---|---|---|---|
| defaults @4% | Reduce 17 yrs [cash] -> **IRA Draw 11% [cash]** | $5,892,838 -> $5,993,491 | **+$100,653** |
| defaults @6% | Ordered BCIR -> **IRA Draw 5%** | $3,316,566 -> $3,400,888 | **+$84,322** |
| defaults3x @4% | Ordered BCIR -> **Ordered CIBR** | $7,610,436 -> $7,730,560 | **+$120,124** |
| thirds @4% | IRA Draw 5% -> **Ordered CBRI** | $11,621,135 -> $11,707,467 | +$86,332 |
| round1 @4% | Ordered CIBR (same) | $8,790,819 -> $8,801,596 | +$10,777 |
| brokheavy @4% | Ordered CBRI (same) | unchanged | $0 |

**The winning STRATEGY changes in four of six cells.** That is a larger effect than most of the
gaps this report measures, and it is driven by an input most users never touch.

**Result 3: the gap gets WIDER, because the oracle exploits routing better than the rules do.**
Median best-family gap at default basis **1.58% -> 2.03%**; `S3-P2` stays RIGHT. Per cell it moves
both ways - `defaults @4%` 0.64% -> 2.03% and `defaults @6%` −0.19% -> 1.97%, but `defaults3x @4%`
1.58% -> **0.28%** and `thirds @4%` 0.49% -> **0.00%**. `B-P4` stays WRONG (b20's median is 2.03%,
equal to default basis, not above it); its Proportional half still holds and gets stronger, 3.9% at
b20 and 3.8% at b80. `S3-P3` 1/6 and `S3-P4` 45/45 are unchanged.

**Result 4, and it retires this report's own attribution claim: conversion timing was mostly a
routing artifact.** `defaults3x @4%` was the one cell where conversions carried 96% of the gain.
With routing equalized its conversions-only gain falls from **+$14,297 (0.19%) to $825 (0.01%)**,
and its decomposition flips to +$825 conversions against +$21,171 split. **With surplus free to
compound in Brokerage, the withdrawal split dominates in every one of the six headline cells,
including the IRA-heavy mix.** The flat scalar still finds $0 in 45/45, and the b20 conversion
prizes are untouched (`defaults3x @8% b20` remains 13.49%).

**Which run is the right yardstick depends on the question, so both are kept.** The bare run is what
a user actually gets, because the reserve is unset by default. The `--reserve0` run is the correct
control for comparing draw STRATEGIES, since it is the only one that holds routing constant.
`P103d`'s bake-offs should use `--reserve0`; anything reported as "what a plan leaves on the table"
should use the bare run and say so.

**One open item this raises, outside `P103`:** leaving Cash Reserve blank costs $84k-$120k of real
after-tax wealth in four of these six cells, and changes which strategy wins. Whether the shipped
default should change is a user-visible question and is NOT decided here.

## P103b2 - what a flexible schedule can actually carry

**Run:** 2026-09-01, `node .test_harnesses/schedule_replay_harness.js`. Engine change:
`strategy: 'schedule'`, a research input, default-off and node-only, on the `oracleWithdrawalPlan`
discipline. Node suites **389/61/22** (7 new tests), every pre-existing test bit-identical.

**What it is.** A per-year decision vector instead of a named rule. Each entry is
`{ ordTarget, kind, rateBasis? }`: the year's ceiling on realized ordinary income, which income
definition it is spent against (`federal` / `irmaa` / `aca`, because ACA MAGI counts the whole Social
Security benefit and the other two count at most 85%), and optionally the income level the marginal
rate lookups are keyed on.

**Targets, not dollars, and the reason was already in the file.** From the `oracleWithdrawalPlan`
comment: *"Fractions, not dollars: dollar plans desync from endogenous taxes/growth."* A per-year
dollar withdrawal is chosen against the previous iteration's tax outcome, and taxes are endogenous,
so it stops being feasible. An income target is solved inside the year. **That makes `ordTarget` the
same control variable `P75`/`P103c` proposed for the unified search** - the flexible carrier and the
search were planned as separate work and are one object.

**The acceptance bar is replay identity, not a gap number.** Compile a shipped family's realized
decisions into a schedule, re-run, require agreement to the dollar:

| arm | what it decides per year | scheduled yrs | delta NW | verdict |
|---|---|---|---|---|
| Fill Bracket 12% / 22% / 24% | ceiling | 33 / 33 | **$0** | **EXACT** |
| IRMAA tier 0 / tier 2 | ceiling | 33 / 33 | **$0** | **EXACT** |
| ACA 400% FPL | ceiling, until it lapses | 3 / 33 | −$841,327 | partial |
| IRA Draw 5% | a share of the IRA | 0 | −$1,182,054 | carries nothing |
| Proportional +10% | a spending boost | 0 | −$823,742 | carries nothing |
| Ordered CBIR | an account sequence | 0 | −$477,380 | carries nothing |
| Guyton-Klinger | the spend itself | 0 | +$216,996 | carries nothing |
| Reduce 17 yrs | an amortization | 0 | −$1,469,870 | carries nothing |

**`rateBasis` exists because the replay found a real asymmetry in the engine.** IRMAA and ACA
ceilings derive their marginal rates at the final limit; a federal bracket ceiling derives them at
the STATUTORY bracket top, before the `P92a` deduction add-back lifts the limit and before the state
min can pull it down. Two different numbers, correctly. Deriving at the target instead made a Fill
Bracket 22% replay pick the 24% marginal rate: **$0.34 adrift in year 8, compounding to $121 over 33
years.** Nothing had ever needed the distinction named until a schedule had to reproduce a decision
exactly. It is now returned by `computeBracketCeiling`, logged as `RateBasis`, and pinned by a test
that asserts stripping it re-breaks the replay.

**Prediction `R-P1` (a family is either fully expressible or not at all) - WRONG**, and the
counterexample is the useful part. ACA is partial: 3 of 33 years. Its cap lapses at Medicare
eligibility, and a lapsed year has no ceiling and falls through to baseline Proportional. The
schedule can say "fill to X" and can say nothing at all, but an absent entry currently means "draw
nothing voluntarily", not "do what the family would have done". So the coverage boundary is not
ceiling-versus-quantity; it is **that the schedule has no way to state what happens when there is no
ceiling.**

**What the gaps name, which is the point of running it.** Three fields, in the order the evidence
ranks them: a **quantity** lever (a share of the IRA, an amortization, a boost - none of them income
targets); a **fallback** for unscheduled years (the ACA case); and an account **sequence**, which
`oracleWithdrawalPlan` already expresses and the schedule has not absorbed. `P103b3` adds
total-conversion control on top of these.

**Scope, stated plainly:** this is a representation, not a search. Nothing here optimizes anything,
and the search-cost problem in `P103b4` is untouched - ~130 axes against today's ~33.

**Superseded by `P103b3` below**, which added four fields and took the exact count from 5 arms to 8.

## P103b3 - four more fields, and 8 of 11 families now replay exactly

**Run:** 2026-09-01, same harness. Suites **394**/61/22 (5 more tests). `P103b2`'s table above is the
record of that stage; this is the current state.

| arm | decides per year | scheduled | delta NW | b2 | b3 |
|---|---|---|---|---|---|
| Fill Bracket 12/22/24%, IRMAA tier 0/2 | ceiling | 33/33 | $0 | EXACT | **EXACT** |
| ACA 400% FPL | ceiling until it lapses | 3/33 | $0 | −$841,327 | **EXACT** |
| IRA Draw 5% | a share of the IRA | 33/33 | $0 | −$1,182,054 | **EXACT** |
| Reduce 17 yrs | an amortization | 33/33 | $0 | −$1,469,870 | **EXACT** |
| Proportional +10% | a split, then a boost | 0 | −$823,742 | nothing | nothing |
| Ordered CBIR | an account sequence | 0 | −$477,380 | nothing | nothing |
| Guyton-Klinger | the SPEND itself | 0 | +$216,996 | nothing | nothing |

**The four fields.** `iraDraw` - an explicit voluntary IRA draw in nominal dollars, the quantity
lever, mutually exclusive with `ordTarget`. `gapFill` - per year, `cascade` or `baseline`, because
which cascade fills the gap is the *other* thing a family decides. `scheduleFallback` - what an
unscheduled year means, `none` or `baseline`. `convert` - a cap on the surplus routed to Roth.

**Dollars are safe for `iraDraw` and not for a split, which is the distinction the earlier warning
was really drawing.** `oracleWithdrawalPlan` refuses dollar plans because a *spending* draw's size
depends on the tax it is trying to cover, so a dollar figure desyncs. A voluntary IRA draw above
spending has no such loop: it is handed to the tax passes at face value, exactly as the `fixedpct`
and `fixed` branches hand theirs over.

**"Total conversion control" decomposed into two levers, and only one was missing.** The family
conversion is a pure REALLOCATION of an already-taxed surplus - the IRA dollars were withdrawn and
taxed whatever their destination - so converting less does not withdraw less. **Converting less
GROSS was already solved by `P103b2`**: lower `ordTarget` or `iraDraw`. What was genuinely absent is
the destination choice, which is what `convert` caps. Both directions now exist: less gross via the
draw, more gross via `extraConversionAmount`, destination via `convert`.

**Three wrong compilers before the right one, and the lesson generalizes.** Reconstructing the
voluntary IRA draw from logged outcomes failed three times - gross draw ($39,117 short), gross minus
RMDs ($191,737 short), and gross again. Downstream the decision is merged with the forced
withdrawal, split across IRA1/IRA2, netted against conversions and adjusted by the shortfall cascade.
The fix was to **log the decision** (`-volIRAwd`, captured at the one point where it is still a
decision) rather than infer it, which is the same move that produced `rateBasis`. **A carrier
compiles from recorded decisions, not from reconstructed outcomes.**

**And one boolean was worth a whole plan.** With every year correctly scheduled, IRA Draw was still
$39,117 adrift because a year-0 schedule entry was treated as implying a conversion, which flips the
withdrawal month from Late to Early for the entire plan. A ceiling implies a conversion; a quantity
draw does not. The fix is one condition and the test that pins it compares `timingReason`.

**What remains.** The schedule now says how much to take from the IRA - as a ceiling or as a
quantity - but not **how to split a spending draw across accounts** (Proportional, Ordered) and not
**what to spend** (Guyton-Klinger). The split is `oracleWithdrawalPlan`'s job and it already exists;
note that it PREEMPTS the strategy branch rather than composing with it, so carrying Ordered means
using that hook, not this one.

**On Guyton-Klinger, a correction (user, 2026-09-01).** An earlier draft of this section called GK
"outside the vocabulary by construction", which is wrong and hides something bigger. GK's per-year
decision is the SPEND, and spend is a decision like any other - one that a better draw strategy can
improve, not a constant the plan is handed. What is true is narrower: **this study pins spend by
choice**, so every ceiling in it is a ceiling AT FIXED SPEND, and that is why GK rows are excluded
from the gap tables rather than compared in them. The oracle has never searched the spend axis at
all. Adding `spendGoal` to the schedule is `P103b5`; it is the field that would let GK be carried,
and it would also widen what "the ideal" means in this report.

**So read every gap number here as conditional.** "How much a plan leaves on the table" means at the
delivered spend the base row already achieves. A strategy that would deliver MORE lifetime spending
for the same wealth, or the same spending with a higher floor under a bad sequence, is not visible
anywhere in these tables. That is a scope limit of the measurement, not a property of the engine.

## P103b4 - the representation is worth money, and this is the number

**Run:** 2026-09-01, `node .test_harnesses/schedule_oracle_harness.js`. 45,475 sims, 34.2 s. No
engine change; suites stay 394/61/22.

**The question P103 was opened to answer.** The oracle's conversion axis is
`extraConversionAmount[]`, which is EXTRA on top of whatever the base arm's own rule decided: it can
convert more than the rule and never less, because the rule's ceiling was not a variable.
`strategy: 'schedule'` makes that ceiling a per-year number. **Is the missing direction worth
anything?**

Both arms get the same base row, the same objective, the same spend pin and the same measured sim
budget, so the only difference is the representation.

| cell | base row | Arm A (conversions) | Arm S (schedule) | S − A | |
|---|---|---|---|---|---|
| defaults @4% | Reduce 17 yrs | +$11,781 | +$41,834 | **+$30,053** | 0.509% |
| defaults @6% | IRA Draw 7% | +$108,753 | +$120,012 | **+$11,259** | 0.339% |
| defaults3x @4% | IRA Draw 5% | +$488,702 | +$578,951 | **+$90,248** | 1.209% |
| round1 @4% | IRA Draw 5% | +$147,994 | +$170,190 | **+$22,195** | 0.254% |
| thirds @4% | IRA Draw 5% | $0 | +$198,508 | **+$198,508** | 1.708% |
| brokheavy @4% | IRA Draw 5% | $0 | +$197,877 | **+$197,877** | 1.819% |

**`S-P1` RIGHT, 6 of 6 cells, +0.25% to +1.82%.** In the two cells where the conversion oracle finds
NOTHING at all, the schedule finds ~$198k. That is the direction the old axis could not express:
those cells do not want more conversion, they want the base rule's draw moved year by year.

**And it wins on less compute.** Arm S converged inside its budget in every cell - 1,021 sims against
Arm A's 9,575 in `defaults @4%`, 1,201 against 9,260 in `defaults3x @4%`. Roughly an eighth of the
work for more result. The multiplicative candidate set (10 values per year) is simply a better-shaped
search than a $25k grid over a $0-400k range, because a ceiling and a draw live on different scales
and a ratio is scale-free.

**The first version of this harness was wrong, and the way it was wrong is worth keeping.** It took
the best non-cyclic row as the base regardless of family, so five of seven cells handed Arm S an
EMPTY schedule - Ordered and Guyton-Klinger compile to nothing (`P103b3`) - which funds no spending,
fails the pin and scores null after one simulation. It printed Arm S losing by the entire conversion
gain in five cells and `S-P1` WRONG. That was the b3 coverage boundary being re-measured, not an
answer. The base is now the best-scoring row whose compiled schedule **replays it exactly**, verified
per cell before either arm runs, and `defaults3x @8% b20` is skipped honestly because no row there
qualifies. **A null result that arrives after one simulation is a harness bug, not a finding.**

**What this does and does not license.** It says the wider representation reaches higher on the same
budget, which is the first thing in this phase to move a computed number rather than describe one. It
does NOT say these schedules are shippable: they are perfect-foresight artifacts on one deterministic
path, and the base rows here differ from `P103a`'s champions because this harness must choose a
carryable row. The rule-shaped question - can a FIXED rule capture most of this, the `P35n` template -
is `P103d`.

**Spend is still pinned.** Every number above is more wealth at the same delivered spend. See
`P103b5`.

## P103b5a - the spend axis cannot be searched with a weight

**Run:** 2026-09-01, `node .test_harnesses/spend_objective_harness.js`. 258 sims. No engine change.

**Why this came before any field.** `P103b5` wants `spendGoal` to become a schedule decision, because
Guyton-Klinger's per-year decision IS the spend. But the spend pin is not an oversight: without it a
spend-adaptive arm wins by cutting spending. So the question is the OBJECTIVE, and it had to be
measured.

**What the engine already has.** `baselineScoreOf` = real terminal after-tax net worth +
`SPENDABLE_WEIGHT` x lifetime spend in current dollars, with `SPENDABLE_WEIGHT = 1.10`. It decides
champion selection in every harness here and the Optimizer's own ranking. `spendCurrentDollars`
ACCUMULATES, so this multiplies LIFETIME spend - about $2.1M against $5.9M of terminal wealth on the
defaults cell, a third of the score rather than a nudge.

**The measurement.** Sweep a constant spend multiplier on a fixed base row and trace the achievable
(spend, wealth) frontier. `defaults @4%`, base Reduce 17 yrs:

| mult | lifetime spend | real terminal NW | d(NW)/d(spend) |
|---|---|---|---|
| 0.60 | $1,283,040 | $7,628,564 | - |
| 1.00 | $2,138,400 | $5,892,838 | −2.208 |
| 1.50 | $3,207,600 | $3,045,197 | −2.695 |
| 2.00 | $4,276,800 | $425,495 | −2.240 |

**`O-P1` WRONG, and in the opposite direction from the prediction.** I predicted the argmax under
1.10 would sit at the MAXIMUM feasible spend, reasoning that a dollar spent late costs about a dollar
of terminal wealth and is credited 1.10. It sits at the **minimum spend tested, in all three cells**.
The objective prefers hoarding, not spending.

**`O-P2` RIGHT.** The model gives up **1.38 to 3.31** dollars of real terminal wealth per extra dollar
of lifetime spending - above 1.10 everywhere measured. A dollar not spent compounds for the rest of
the horizon, so the technical rate is far above the weight.

**`O-P3` RIGHT.** The rate is not constant: it ranges 1.80-2.70 in `defaults @4%`, 1.38-3.31 in
`round1 @4%`, 1.95-2.66 in `thirds @4%`. **No single weight agrees with the model at both ends of one
frontier**, let alone across cells.

**What this decides for `P103b5`.** A scalarized objective cannot SEARCH the spend axis. Its optimum
sits at a boundary - the minimum one, at 1.10 - so the search would answer "spend as little as the
grid allows" in every cell, and the answer would be the weight rather than the plan. **`P103b5` needs
a frontier, not a weight**: report the (spend, wealth) pairs and let a human choose the point, the
same shape `P100` reached for row ranking.

**This does NOT make `SPENDABLE_WEIGHT` wrong at its actual job.** For two plans delivering the same
spend the term is identical and cancels; for two plans at the same wealth it correctly prefers the
one that spends more. Its stated purpose is settling ties between otherwise-equal plans and it does
that. What it cannot do is price a real trade-off, because 1.10 is below the technical rate
everywhere measured. The constant is now documented in `optimizer_core.js` with both facts.

**A side finding that constrains any spend search: feasibility is NOT monotone in the spend goal.**
`round1 @4%` is feasible at 0.70, infeasible at 0.80, feasible again at 0.90-1.10, then infeasible
from 1.20. `totals.success` is a PER-YEAR test (`netIncome < targetSpend * 0.99`), so a plan can dip
under the threshold in a narrow band and recover above it. **A spend search may not assume that
everything below a feasible spend is also feasible**, which rules out a simple bisection for the
maximum sustainable spend.

## P103b5 - spend becomes a schedule decision, and the schedule beats Guyton-Klinger

**Run:** 2026-09-01, `node .test_harnesses/schedule_replay_harness.js`. Suites **397**/61/22.

**Two fields, and the second one is the point.** `spend` sets a year's goal in nominal dollars.
`spendRule: 'gk'` runs the Guyton-Klinger adjustment for ANY strategy, so a schedule can own the
DRAW while GK keeps owning the SPEND.

**Why the rule and not the numbers, which is the whole difference between evidence and an artifact.**
Compiling GK's *recorded* spend path and replaying it under a different draw produces a lovely number
and means nothing: GK's own dynamics would have reacted to that draw, so the path is a hindsight
artifact nobody could follow. Carrying the RULE - re-evaluated each year against whatever portfolio
the plan actually has - is followable. The first pass here did the former and the framing had to be
corrected (user, 2026-09-01: *"the only rule it should follow is to use the GK spend goal adjustment
strategy faithfully"*).

**The result: GK is dominated.** Same rule, its own draw handed to the schedule, and the schedule
delivers **more lifetime spending AND more terminal wealth**:

| spendChange | @4% spend | @6% spend |
|---|---|---|
| 0.0% | +$14,320 spend, +$17,373 wealth | +$43,934 spend, +$198,581 wealth |
| −0.5% | +$8,756, +$57,038 | +$53,564, +$177,720 |
| **−1.0%** | +$26,285, +$2,611 | +$91,655, +$95,758 |
| −1.5% | +$11,748, +$42,114 | +$65,329, +$125,078 |
| −2.0% | +$23,270, +$5,144 | +$48,266, +$150,473 |
| +1.0% | **NOT dominated** (+$56,207 spend, −$56,859 wealth) | −$0, +$312,710 |

**Ten of twelve cells dominate, and the two that do not are informative rather than noise.** At a
RISING spend goal the schedule buys more spending at the cost of wealth - a genuine trade, not a
free win - which is what a dominance test should show when there is no dominance to find.

**What it means, stated so it is not oversold.** GK's account split is costing it this much at its
own spending rule. It does not mean a user can have $198k: it means the draw rule under GK is worth
replacing, which is `P103d`'s bake-off, and now with a measured prize rather than a hunch. This is
the second thing in `P103` to move a number, and unlike `P103b4` it does not need perfect foresight -
the combination is one a plan could actually adopt.

**Replay coverage after the field.** Eight arms still reproduce EXACTLY. Proportional and Ordered
still carry nothing. GK moved from "carries nothing" to DOMINATES.

**The one field left is the account split.** Proportional draws proportionally across
IRA/Brokerage/Cash and Ordered runs a sequence; neither is an IRA draw, so `ordTarget` and `iraDraw`
are both silent. `oracleWithdrawalPlan` already expresses a split but PREEMPTS the strategy branch
rather than composing with it, so absorbing it is a design decision, not wiring.

### A correction to language used throughout this report: spend is PINNED, not FLAT

"Spend is fixed" appears in several places above and it conflates two different things (user,
2026-09-01: *"usually it is declined by -1% per year of plan"*).

- **Pinned** is the COMPARISON rule: candidates that deliver a different spend are discarded, so a
  spend-cutting arm cannot win by cutting. That is a methodology choice and it is real.
- **Flat** is a FIXTURE choice, and an unrepresentative one. Every harness in this study sets
  `spendChange: 0`, while a typical plan declines around **1% a year**. Nothing in the oracle grid
  exercises a declining spend path.

The `P103b5` sweep above is the first thing here to vary it, which is why it spans −2.0% to +1.0%.
**Every gap number elsewhere in this report is measured on a flat spend path and should be read that
way.** Re-running the grid at a realistic decline is open work.


## P51f - trajectory post-mortem (observation only, ships nothing)

- **No harvest-like alternation** (prediction `S3-P3` WRONG again: 1/6 thirds/brokheavy cells with
  >=3 IRA<->Brok flips). The oracle does not rediscover cyclic's rhythm through the withdrawal menu.
- The recurring shape instead: **family-default or IRA-led years through mid-plan, then a
  solid Roth-spending tail** in the final ~5-10 years, with Brokerage held to the §1014
  step-up. Visible directly in the printed archetype strings - `brokheavy @6% b20` runs
  `Roth` for fourteen consecutive years before four `Brok` years at the end. Rational in-model:
  Roth compounds tax-free longest, terminal brokerage gains are erased anyway. This is a
  perfect-foresight artifact to NOTICE, not a rule to ship.
- Backstops stayed near-silent: forced-IRA years = 0 in **44 of 45** accepted solutions, and 1 of
  33 years in the 45th (`defaults3x @8% b80`), so `S3-P4`'s <5% threshold holds everywhere.

## P51g - heirs-rate sensitivity (full re-optimization at 0.15 / 0.35)

- `defaults @6%`: gain $106,827 at rate 0.15 -> $174,437 at 0.35, conversion years 5 -> 12.
  Conversions are worth more when the heirs rate is higher - correct direction, and the oracle
  responds by converting MORE.
- `thirds @6%`: gain **$586,219 at both rates**, with 1 conversion year. The gain here is the
  Roth-tail split and is now exactly rate-insensitive (2026-08-10: $755k / $670k).

## Predictions scored

Statements are in the reading guide at the top.

| id | prediction | verdict | 2026-08-10 verdict |
|---|---|---|---|
| S3-P1 | conv-only oracle beats flat scalar by <3% in most cells | **RIGHT** (15/15 default basis, max 0.57%) | RIGHT (15/15) |
| S3-P2 | median best-family gap < 4% | **RIGHT** - median **1.58%** | WRONG - median 4.35% |
| S3-P3 | harvest-like alternation in brokerage-heavy mixes | **WRONG** - 1/6 | WRONG - 1/6 |
| S3-P4 | backstops quiet (<5% forced-IRA years) | **RIGHT** - 44/45 at zero, 45th at 1/33 | RIGHT - 0 forced years, 15/15 |
| B-P4 | best-family gap grows at b20; Proportional > 1% at both extremes | **WRONG** - gap b20 **1.13%** < default 1.58%; the Proportional half holds (1.2% at both) | RIGHT |
| X-P1 | independent search beats the descent by < 1% in most cells | **RIGHT** - 5/5, max 0.013% | not run |
| X-P2 | residual largest where the prize is largest | **WRONG** | not run |
| X-P3 | 3x budget moves Arm B less than the A-to-B difference | **WRONG** in 3/5 | not run |

## What changed between the 2026-08-10 and 2026-09-01 runs

The engine moved from `5e1075e` to `1b7b366`. Everything below is a re-run of the same harness on
the same grid, so the differences are the engine's, not the method's.

| | 2026-08-10 (`5e1075e`) | 2026-09-01 (`1b7b366`) |
|---|---|---|
| median best-family gap, default basis | 4.35% | **1.58%** |
| median best-family gap, b20 / b80 | 4.47% / 1.83% | **1.13% / 0.90%** |
| largest single decomposition gain | **+$1,078k** conversions (`defaults3x @4%`) | **+$856k** split (`brokheavy @6% b20`) |
| conv-only gain, default basis | 0 - 2.87% (max +$241k) | **0 - 0.57%** (max +$19.5k) |
| conv-only gain, b20 | max 9.00% | **max 13.49%** (+$201k) |
| dominant lever | conversion timing in IRA-heavy mixes | **the withdrawal split**, in most cells |
| rows beating the oracle | 2 cyclic rows, 1 cell | 1 cyclic row, 1 cell |
| champion in `defaults @4%` | Reduce 20 yrs | Reduce 17 yrs |
| S3-P2 / B-P4 | WRONG / RIGHT | **RIGHT / WRONG** |
| runtime | 511k sims / 562s | 418k sims / 373s |

**The headline the old file carried - "+$1.078M left on the table by conversion timing" - is
gone.** That cell now measures +$122k in total, 96% of it still conversions. Three changes landed
between the two engines that all push the same way, by making the SHIPPED arms better rather than
the oracle worse: RMDs and the advisor fee now compute off the prior Dec 31 balance (`P84`),
conversions reach MAGI so IRMAA prices them (`P88`), and a ceiling-filling year now lands ON the
limit instead of under it (`P87c`). **Attributing the collapse to any one of those has not been
measured** and would need a bisect over those three commits; what is measured is that the gap
closed.

**What this means for the phases that consume this file.** `P103d`'s regime bake-offs should be
aimed where the gap still is - the GK-strain cells at 6-8% spend and the b20 arm - and NOT at
`defaults3x @4%`, which was the fat cell under the old numbers and is now 1.58%. `P36`'s round-2
certification measures against these numbers, not the old ones.

## Open

- **The withdrawal-split axis has no cross-check.** `P51d` covers conversions only. A split-axis
  equivalent needs a second menu shape run against `oracleWithdrawalPlan`.
- **Arm B is not converged** (`X-P3` WRONG in 3/5). A stronger cross-check - annealing, or restarts
  that keep depth as budget grows - would tighten the bound; the current one only shows that a
  different equally-costed search does not beat the descent.
- The GK-base cells need a fixed-spend base to produce family gap tables at 6-8% spend
  (candidate: run those cells at the highest spend a fixed-spend arm survives). This is where the
  largest gains now live, and it is exactly where the gap tables have one row.
- **The two plumbing holes are unclosed** and are `P103b`: surplus routing (`to_brokerage`) and
  total-conversion control. The first is why a cyclic row still beats the ceiling.

## Coverage - what was actually varied (guard against extrapolating past it)

The oracle grid is the Stage-1 ladder at **wealth x1 only** - NARROWER than the Stage-1/2
scans. 45 cells = 5 mixes x spend 4/6/8% of assets x 3 basis arms:

| mix | total | IRA share | Roth share | Brok share | basis/Brok | spend range |
|---|---|---|---|---|---|---|
| defaults | $1.62M | 86.4% | 4.3% | 6.2% | 50% | $64.8k - $129.6k |
| defaults3x | $4.86M | 86.4% | 4.3% | 6.2% | 50% | $194.4k - $388.8k |
| round1 | $3.90M | 64.1% | 9.0% | 23.1% | 55.6% | $156k - $312k |
| thirds | $4.35M | 32.2% | 32.2% | 32.2% | 50% | $174k - $348k |
| brokheavy | $4.55M | 22.0% | 13.2% | 61.5% | 42.9% | $182k - $364k |

So: totals **$1.62M - $4.86M**, IRA share 22-86%, Brokerage share 6-62%, annual spend
**$64,800 - $388,800**, basis fraction **20% / mix default (43-56%) / 80%**. The x0.5 and x3 wealth
points of the Stage-1 grid were NOT run through the oracle (runtime); every oracle conclusion is
untested below $1.6M and above $4.9M, where bracket-absolute effects (IRMAA cliffs, 0%-LTCG ceiling
vs portfolio size) shift.

**Held fixed:** couple 64/62, die 92/94 (deaths 2054/2058, only 4 survivor years), SS
$45k+$24k, no pension, CA, growth 6% / inflation 2.5% / dividends 2%, spend flat, CashReserve
off. Family gap tables additionally require rows at the base row's exact delivered spend, which
at 6-8% strain excludes most fixed-spend families in GK-base cells (counted per cell in the raw
output).

**One artifact worth knowing before reading the b20/b80 rows.** In `defaults @4%` and `round1 @4%`
the three basis arms return byte-identical scores, because the champion in those cells
(`Reduce 17 yrs [cash]`, `Ordered CIBR`) never sells brokerage, so the basis it would sell at never
enters the arithmetic. Those rows are not evidence about basis in either direction.

## Scope limits

One deterministic path (6%/2.5%), CA only, one age/SS profile, wealth x1 only, aggregate basis
(no lots), one-sided ACA, no SECURE 10-yr heirs, §1014 at terminal row. The oracle overfits
the known path by construction; nothing here ships without the axis-property + pinned-test bar.
Every number in this file is a point estimate on ONE path - `P103e` is the step that runs the
winners through Monte Carlo and reports bands instead.

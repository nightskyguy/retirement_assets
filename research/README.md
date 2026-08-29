# Research reports

Every measured study of the retirement optimizer engine. Each report is a **reference record**: it
names the harness that produced it, the grid it ran over, the predictions registered before the run,
and what those predictions turned out to be worth. A report is written to be readable on its own,
so each one defines its own codes before using them.

The scripts themselves live in `.test_harnesses/` and are indexed by
[HARNESSES.md](HARNESSES.md), which also records which findings each one is still load-bearing for.

## Conversions and withdrawals

| report | what it covers |
|---|---|
| [CONVERSION_TIMING.md](CONVERSION_TIMING.md) | Front-loading conversions against spreading them evenly or leaving them late, at equal lifetime gross. Earlier wins about two to one, but the "smaller IRA means smaller RMDs" reasoning behind that preference breaks in 124 cells, every one a bracket strategy with a live IRA Goal. |
| [CONVERSION_ROUTING.md](CONVERSION_ROUTING.md) | Whether every voluntary IRA withdrawal should route as a conversion, whether Roth should fill spending gaps first, and what the intra-year withdrawal-timing switch costs. Includes the re-baseline that showed the shipped timing rule is on the wrong side about nine times in ten. |
| [PERFECT_FORESIGHT_ORACLE.md](PERFECT_FORESIGHT_ORACLE.md) | An upper-bound diagnostic: give the engine perfect foresight over one path and let it choose per-year conversions and per-year draw splits. Measures how much any shipped strategy leaves on the table, and refutes "Proportional is default-optimal". |
| [ENDGAME_DRAW_ORDER.md](ENDGAME_DRAW_ORDER.md) | Once the IRA has reached its target, which account the plan should spend next. Cash, then Roth, then Brokerage wins 88 of 108 cells; the balance-proportional fill the spec called for is the worst candidate tested. |

## Where spending comes from

| report | what it covers |
|---|---|
| [BROKERAGE_DRAW.md](BROKERAGE_DRAW.md) | Why the Brokerage account is barely drawn, and whether the rule excluding it from the third withdrawal pass still holds. The capital-gains spiral that rule cites was measured and does not exist; the exclusion was stranding real money. Also carries the cyclic-harvest A/Bs. |
| [GAPFILL_SPLIT.md](GAPFILL_SPLIT.md) | The hard-coded `[40, 60]` Brokerage / Cash blend used to fill a spending gap, plus the ordered strategy's 24 draw permutations. Measures a constant nobody chose. |
| [GAPFILL_CASCADE_VS_BLEND.md](GAPFILL_CASCADE_VS_BLEND.md) | Follow-up: should that blend be deleted and everything unified on a Cash-first cascade? Answer is no, and the current default is not defensible either. Seven objectives split evenly between the two extremes, and the shipped middle wins zero cells on any of them. |
| [STRATEGY_FAMILY_RANKING.md](STRATEGY_FAMILY_RANKING.md) | Ranks the whole shipped strategy enumeration over a 45-cell grid using the UI's own scoring recipe. Which families lead, which never place, and which wins are really a delivered-spend change wearing a wealth win. |

## Taxes, inflation and Medicare

| report | what it covers |
|---|---|
| [BRACKET_INDEXATION.md](BRACKET_INDEXATION.md) | The engine indexes the entire tax code by a fixed typed CPI while spending follows the path's realized inflation. Measures what happens when the brackets follow the path instead: less lifetime tax, and stress scenarios that change outcome band. |
| [RMD_BASIS.md](RMD_BASIS.md) | The required distribution was struck off a mid-year balance rather than the prior December 31 one, which both overstated it and made it depend on whether the plan converted. The fix, and the three re-baselined assertions it forced. |
| [IRMAA_MARGIN_FIXED_CPI.md](IRMAA_MARGIN_FIXED_CPI.md) | First IRMAA safety-margin round, under a constant CPI. In that world a margin provably prevents nothing and only costs. Sections 5 and 7 are superseded by the two files below; the cost measurements still stand. |
| [IRMAA_FORECAST_ERROR.md](IRMAA_FORECAST_ERROR.md) | The same question once realized CPI is allowed to differ from the assumed one. Reverses the previous round's recommendation: a margin does prevent breaches, and the two rate-shaped modes that round wanted deleted are the only correctly shaped ones. |
| [IRMAA_MARGIN_DEFAULT.md](IRMAA_MARGIN_DEFAULT.md) | Which margin setting to ship as the default, and the finding that most of any margin's apparent wealth advantage is a conversion-sizing artifact rather than an IRMAA effect. |
| [IRMAA_MARGIN_MONTE_CARLO.md](IRMAA_MARGIN_MONTE_CARLO.md) | The margin question against Monte Carlo inflation paths rather than a single assumed rate. `halfcpi` wins on every metric in all three modes, and for the first time it wins for the reason it is named after. |

## Index of the scripts

| report | what it covers |
|---|---|
| [HARNESSES.md](HARNESSES.md) | One entry per investigative script in `.test_harnesses/`: what question it answers, what it still pins, and which report it produced. |

---

## Adding a report

Three rules, each here because it was broken at least once:

1. **Name the file for its subject, not for the phase that raised it.** `P32_RESULTS.md` told a
   reader nothing about brokerage draws. Phase IDs belong inside the file, as a parenthetical on the
   title and in the body; treat them as information the reader does not have. The `_RESULTS` suffix
   is dropped too, since every file in this directory is one.
2. **Define every code before its first use.** Prediction ids, normalization ids, arm names, mix
   names, grid knobs. A report that scores `C2` in section 4 and states `C2` in section 8 is not
   readable on its own. Put a reading guide near the top and keep the verdict tables pointing at it.
3. **Add the report to this README in the same commit** that adds it, with a one or two sentence
   summary of what it covers and what it found. An index nobody updates is worse than no index.

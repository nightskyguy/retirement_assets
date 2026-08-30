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
| [BRACKET_CEILING_BASIS.md](BRACKET_CEILING_BASIS.md) | A "fill the 22% bracket" strategy fills it to $179,200 of $211,400, because the ceiling is a taxable-income threshold spent as a MAGI one. The gap is exactly one deduction, confirmed to the dollar. Closing it costs money in 51 of 74 clean cells - but a named ceiling is a contract to fill, so that is a finding about the strategy rather than a reason to under-deliver it. Section 7 carried a claim that nothing sizes a conversion against the ceiling; that was CORRECTED on 2026-08-30 - measured, the draw reaches the ceiling and the conversion is its residual after spending - and what survives is an under-fill in later years. Section 8 covers the shipped fix (v11.16aa) and measures which obtainable deduction the ceiling can use, since the year's own is circular. **Section 9 finds a SECOND basis error of the same shape, still shipped:** a plan stops exactly 15% of its Social Security benefit short of the ceiling it was told to fill - 0.150000 in every affected year, on federal brackets and IRMAA tiers alike, $168,500 of headroom never used on one fixture. |
| [CONVERSION_SEARCH_CEILINGS.md](CONVERSION_SEARCH_CEILINGS.md) | Should the Optimizer stop offering conversion-optimized rows for strategies that target a ceiling? Every such row does break its own ceiling - 61 of 61 - but excluding them would discard a median $53,990 and up to $1.5M of gain, so they are marked rather than dropped. Also finds the spend rate, not the heirs rate, is what decides whether a ceiling strategy wants a conversion. |
| [EXTRA_CONVERSION_MAGI.md](EXTRA_CONVERSION_MAGI.md) | A plan could convert $100,000 to Roth every year and never pay the Medicare surcharge that income earns: the conversion was taxed correctly but never reached the MAGI the IRMAA lookback reads. Measured at a whole tier, on every strategy rather than only the ones targeting a bracket, and worse than under-billing - before the fix the tool showed a large conversion as a way to REDUCE the surcharge. |
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

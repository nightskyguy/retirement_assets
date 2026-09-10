# Research reports

Every measured study of the retirement optimizer engine. Each report is a **reference record**: it
names the harness that produced it, the grid it ran over, the predictions registered before the run,
and what those predictions turned out to be worth. A report is written to be readable on its own,
so each one defines its own codes before using them.

The scripts themselves live in `.test_harnesses/` and are indexed by
[HARNESSES.md](HARNESSES.md), which also records which findings each one is still load-bearing for.

**Sixteen reports were retired on 2026-09-10 (`P116`)**, together with the twenty-eight harnesses
that produced them. Each documented a decision that has since shipped and is pinned by a test or the
changelog, or a subject the engine no longer has - and every one of them predated at least one
engine change, so none of their numbers reproduced any more. They are in the repository history;
the commit messages are the record. Nothing here is kept as a historical record.

## Conversions and withdrawals

| report | what it covers |
|---|---|
| [CONVERSION_TIMING.md](CONVERSION_TIMING.md) | Front-loading conversions against spreading them evenly or leaving them late, at equal lifetime gross. Earlier still wins head-to-head, 284 of 474, but it is no longer the best of the three shapes in a majority of cells - and the "smaller IRA means smaller RMDs" reasoning behind the preference now breaks in every bracket-strategy cell with a live IRA Goal, 118 of 118. |
| [CONVERSION_VALUE.md](CONVERSION_VALUE.md) | Does converting pay, measured on the plan bank's `age-gap-ira-heavy-ca` as "more Roth for the smallest reduction in net worth, spending fixed" - the metric that replaces `_convSavings`. Finds first that **"conversions off" is ambiguous and the verdict flips with the baseline**: against the same draw routed to the Brokerage the conversions are DOMINANT (+$484k net worth AND +$2.5M Roth), against never withdrawing at all they cost $49,121. Decomposing the two-variable comparison that prompted it, **all of the Roth gain is the conversion leg and 92% of the cost is the strategy leg**, so the conversion LEVER is 50.1 Roth dollars per dollar given up - but the CHOICE of that plan over the highest-net-worth plan on the board is 4.23:1, and section 3 explains why both numbers are right and which to quote when. Converting also more than halves the survivor's tax bill, $708,658 to $328,198, on a survivor window only two years long. |
| [CONVERSION_FRONTIER.md](CONVERSION_FRONTIER.md) | What the lost net worth actually buys, priced against the **highest-net-worth plan on the whole board** rather than against the same strategy with conversions off. That is the choice a person actually faces, and it answers a different question from `CONVERSION_VALUE.md`'s attribution - by a factor of twelve on the same household ($582,049 and 4.23:1, against $49,121 and 50.08:1). Across five households the give-up runs 2.07% to 14.69% of net worth at 2.36 to 32.74 Roth dollars per dollar. **Cheapest by far on a long widowhood** (2.07%, 32.74:1); **a bad trade on an IRA-light household** (0.50:1, the only one under 1). The best-net-worth plan is non-converting in all five, and only three of ten strategies convert anything at all - the rest leave no surplus to route, which is why converting plans cluster low on a net-worth ranking. |
| [CONVERSION_VALUE_HOUSEHOLDS.md](CONVERSION_VALUE_HOUSEHOLDS.md) | Whether the P106b conversion result is about conversions or about one plan, over four deliberately varied households plus the canonical one, reported separately and never averaged. **It generalizes, and more strongly than the canonical scenario showed**: converting pays in every household that converts at all, and the prediction registered to catch a reversal found none. The widow mechanism is confirmed and scales with the window - a 24-year widowhood saves **$3,227,336** of survivor tax, drops the survivor's marginal rate 10.6 points, and makes converting DOMINANT. A single filer with no survivor transition still gains 17.5:1, so compressed brackets and the widow penalty are separate and additive sources. Two households differ in kind: an IRA-light one converts **nothing** because the strategy leaves no surplus, and a modest one gives up 13.16% of its surplus over need against the canonical's 2.36%, which is the quantified form of the stated rule "if my assets were smaller, I would be less aggressive". |
| [CONVERSION_STOP_YEAR.md](CONVERSION_STOP_YEAR.md) | Whether the suggested **Stop Conversion year** can be trusted, after an observation that it "seems unstable". The search itself is sound - idempotent, deterministic, and the linear scan is genuinely necessary - and the optimum is not flat either. It is a **moving peak**: sharp for any one set of inputs, but relocated across 2027-2030 by input changes of 1% or less, and those years differ by 4.5x in lifetime conversions and $3.7M in ending Roth, costing 1.3% to 4.6% of net worth. Also finds, separately, that the default valuation basis scores each candidate at **that run's own** final-year marginal rate (34.21% against 26.89% between two candidates here, $277k of pure valuation), so it is the only basis that picks the year it picks. Records a mechanism proposed and then refuted by its own test: a shared heirs rate is MORE sensitive, not less. **Re-baselined 2026-09-04 (v11.1733):** the valuation defect it found is now fixed, the two-peak bistability is gone (the curve is unimodal), and the default basis agrees with every explicit heirs rate. The answer still moves, but between adjacent years rather than across three. Sections before "What P106g changed" are old-engine and say so. |
| [PERFECT_FORESIGHT_ORACLE.md](PERFECT_FORESIGHT_ORACLE.md) | An upper-bound diagnostic: give the engine perfect foresight over one path and let it choose per-year conversions and per-year draw splits. Measures how much any shipped strategy leaves on the table, and refutes "Proportional is default-optimal". **Re-baselined 2026-09-01 on engine `1b7b366`:** the median gap fell from 4.35% to 1.58%, the dominant lever flipped from conversion timing to the withdrawal split, and a cross-check (`P51d`) shows the ceiling is near-tight - a different search of equal cost beats it by at most 0.013%. **Re-baselined again 2026-09-02 on v11.1701** after the gap-fill fix (`P104b1x`): on the routing-controlled declining-spend run the median gap fell 1.94% -> 1.29%, the basis extremes rose to 2.23%, cells at or above 5% fell 17 -> 13, and the best case for conversion timing fell 9.55% -> 2.34%. Sections before "What changed with v11.1701" are old-engine and say so. |
| [BETR_RELIABILITY.md](BETR_RELIABILITY.md) | Whether the displayed **Break-Even Tax Rate** puts its hurdle in the right place, measured across the plan bank instead of one household. On the eight households where the measure is even defined it is **too high in all eight**: it names a hurdle of 10.1% to 34.8% while converting already wins at a 0% heirs rate. The horizon explains at most 3.1 points of that; the rest is the second-order taxes the closed form omits. Finds a sign trap that inverts one household's reading (`t*` means "exceed" only while converting SHRANK the IRA), and finds that the answer depends on **surplus routing**: a cash-drag control could run on three of the eight, held the sign on all three but cut the advantage by up to 80%, and on the single household this harness always used it flips every scenario outright. That is why one household could not settle it. |

## Where spending comes from

| report | what it covers |
|---|---|
| [CONSTANT_SPLIT.md](CONSTANT_SPLIT.md) | Whether a FIXED account mix beats the proportional default, and whether it survives an uncertain future. The oracle's ten-archetype menu turns out to leave a median 76.4% of the achievable gain unclaimed, so an exhaustive 286-vector search was needed. Six of six Monte Carlo cells have a vector that beats the default at the median in all three models with survival held; `B9C1` (90% Brokerage, 10% Cash) does it in all six for a median $747,009. The single-path cover's top pick wins only 1 of 6 out of sample. Every vector tested lowers the 10th percentile somewhere. |

## The Optimizer's own ranking

| report | what it covers |
|---|---|
| [OPTIMIZER_RANK_STABILITY.md](OPTIMIZER_RANK_STABILITY.md) | A reported plan ranked 103rd under `Roth Conversion Effectiveness`, then 22nd after they adopted a different row. Reproduced on a reported saved scenario: **only 3 of 136 successful rows are ever evaluated for that objective** - the other 133 are scored `-Infinity` and displayed in input-array order, so the rank is not a measurement and the plan moved without anything about it being re-measured. **Refutes P100's own H1-H3** (pool churn), which the data does not support: the pool and the heirs rate were identical across both runs. The fix is to mark unevaluated rows as unevaluated rather than rank them. **Part 2 is the dominance census:** 66.2% of successful rows are beaten on every core metric by some other row (86.8% on net worth + Roth alone), so hiding them is a large free simplification - but the frontier is 18 rows on two metrics and 52 on five, which means the METRIC SET is the real knob and "show the frontier" moves the choice rather than removing it. The user's hand-picked plan is on the frontier; so, contrary to prediction, is the objective's own winner. **Part 3 revises Part 1's conclusion after a user challenge:** marking rows unevaluated is only half an answer. Of the 133 unranked rows, 9 were fully searched and found to have $0 effectiveness - a measured result the code discards - and only 124 are genuinely unknown. Evaluating all 136 costs ~55 s (392 ms/candidate, measured), which is the concrete case for P34. The answer is two-key ordering: effectiveness for evaluated rows, net wealth for the rest, labelled - not a blended score, which would sort by scale and lie in a new way. **Part 4 generalizes that to the user's priority-list proposal (LEXICOGRAPHIC ordering, which composes with Pareto rather than replacing it) and measures its failure mode:** with net wealth leading, 118 of 133 rows have distinct values, so priorities 2-8 would decide 15 rows and an eight-level list would be seven levels of decoration. **Tolerance bands fix it** - at 1% of range, priority 2 decides for 118 of 133 rows and the top group holds 10 plans, which is the shortlist the user was building by hand. |

## Index of the scripts

| report | what it covers |
|---|---|
| [HARNESSES.md](HARNESSES.md) | One entry per investigative script in `.test_harnesses/`: what question it answers, what it still pins, and which report it produced. |

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

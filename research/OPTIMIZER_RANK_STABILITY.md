# The Optimizer's "Roth Conversion Effectiveness" rank is not a measurement

*(P100 Stage A, 2026-08-31. Reproduced in the browser on the user's own saved scenario, v11.16d4.)*

A user reported that their plan ranked **103rd** under `Roth Conversion Effectiveness`; that after
adopting a different strategy from the same table the original plan reappeared at **22nd**; and that
this made the tool feel unstable.

**It is worse than unstable. For 133 of the 136 plans in that table, the rank is not measuring
anything at all.**

## Reading guide

| code | meaning |
|---|---|
| **row** | one line of the Optimizer table: a strategy plus its parameters, already simulated |
| **`⇌` row / twin** | a row added by the conversion-optimization pass, carrying `_isConvOptimized: true` and a `_convSavings` |
| **pool** | the rows `selectConversionCandidates(results, 12)` picks to receive a `⇌` twin (`optimizer_ui.js:1438`) |
| **`conveffect`** | the `Roth Conversion Effectiveness` objective (`optimizer_core.js:4357`) |
| **tied block** | the successful rows with no `_convSavings`, all scored `-Infinity` and therefore mutually tied |
| **run 1 / run 2** | before and after adopting `IRA Draw 9%` from the table |

## The scenario

The user's own saved plan, not a fixture invented for this report: TX, `Fill Fed/IRMAA Bracket` at
**IRMAA Tier 2**, $2.5M + $1.5M IRAs, **$0 Roth**, **$0 Cash**, $200k brokerage on $100k basis, two
Social Security claims at 67, a $35k non-COLA pension, $130k spend goal declining 1.5%/yr, an IRA
Goal of $859,723, conversions on and funded from cash, conversions stopping after 2039. Saved locally as `.test_harnesses/fixtures_rankstability.local.json` - **not committed.** It is a real user's saved plan, and this repository is public, so the file is gitignored (`*.local.json`). The scenario is described below in full so the run is reproducible without it.

## What was measured

| quantity | run 1 (plan = IRMAA Tier 2) | run 2 (plan = IRA Draw 9%) |
|---|---:|---:|
| rows produced | 152 | 152 |
| successful rows | 136 | 136 |
| **rows carrying a `_convSavings`** | **3** | **3** |
| **rows tied at `-Infinity`** | **133** | **133** |
| pool membership | 3 labels | **identical 3 labels** |
| `sharedFutureIRARate` | 0.12 | **0.12** |
| rank of the IRMAA Tier 2 plan | **103** | **20** |
| its `_convSavings` | none | **none** |

The three rows that were actually evaluated: `Ordered ✓ ⇌` ($2,279,795), `🗘 Guyton-Klinger ✓ ⇌ ⏹2028`
($201,869), `🗘 Ordered ✓ ⇌ ⏹2028` ($67,485).

## The mechanism

1. `_convSavings` is written **only** on `⇌` rows (`optimizer_ui.js:1546`).
2. `conveffect` ranks on `r._convSavings ?? -Infinity` (`optimizer_core.js:4357`). A row without a
   twin is not scored badly - **it is scored with a value nobody computed for it**, and every such
   row gets the SAME value.
3. Only the pool gets a twin, and here only 3 of the 12 candidates produced one at all (the other 9
   found no conversion that paid, so `optConv === 0` and the row is skipped at `optimizer_ui.js:1495`).
4. **The tied block is therefore displayed in input-array order.** Verified directly, not inferred:
   filtering the ranked output down to the tied rows returns them in exactly their `results` order
   (`tieOrderIsArrayOrder: true`). The sort is stable and every key is equal, so it cannot do
   anything else.

**So "rank 103" means "position 100 of 133 in a block where every row scored identically."** Rank 20
means position 17 of the same block. Between the two runs, **nothing about the IRMAA Tier 2 plan was
re-measured**: it had no `_convSavings` in either run. It moved because its position in the `results`
array moved - in run 1 it was the pinned current-plan row (`📍 IRMAA Ceil ✓`), in run 2 an ordinary
swept row (`IRMAA Ceil ✓ ⚠️`).

## The hypothesis this refutes, including one of the report author's own

`P100` predicted the churn came from **pool membership** changing with the user's plan (H1), that
every large jump would be explained by it (H2), and that pinning `futureIRATaxRate` would damp but
not remove it (H3).

**H1, H2 and H3 are REFUTED on this scenario.** The pool is byte-identical across the two runs and so
is `sharedFutureIRARate` (0.12 both times, from the `?? results[0]` fallback). The pool-churn story
was a plausible reading of the code that the measurement did not support. The real cause is one link
earlier in the same chain and much simpler: **almost nothing is ever evaluated, and the unevaluated
rows are ordered by array position.**

Pool churn remains a real hazard - the code path for it exists - but it is not what the user saw, and
fixing it would not have fixed this.

## What follows

- **The rank column is honest only for 3 rows out of 136.** Showing 1..136 implies a measurement that
  exists for 2% of the table.
- **`-Infinity` is the defect, not the cap.** It conflates "conversions do not help this plan" with
  "this plan was never offered the chance". Those are different answers and only one was computed.
- **Raising the pool cap does not fix it either.** Nine of the twelve candidates here returned
  `optConv === 0` and produced no row. A bigger pool yields more *evaluated* rows, not a complete
  table; the tie shrinks but never closes.
- **The stability test is cheap and the tool fails it today:** adopt one of the table's own
  recommendations, re-run, and no row's rank may move unless a quantity it was scored on changed.

## The narrow fix, and why it is small

Rows outside the pool should be reported as **not evaluated** - excluded from the ranked ordering and
shown in their own group - rather than sorted as though they had lost. That is a display and
comparator change, not an engine change, and on this scenario it turns a 136-row ranking into an
honest 3-row one with 133 rows plainly marked unmeasured.

The user's own instinct - reading net worth, final Roth and break-even off the table and picking a
plan by hand - was the correct response to a column that could not answer their question.

---

# Part 2: the dominance census  *(P100a3, same scenario, same run)*

If most rows are beaten on every metric by some other row, then most of the table is noise no matter
which objective is selected, and hiding them is a free simplification. This measures that.

## Method

**Dominance:** row Y dominates row X when Y is at least as good as X on **every** metric and strictly
better on at least one. A dominated row is the right answer to no question, under any weighting of
those metrics. Only successful rows are compared - 136 of the 152.

Metrics, all read off fields the table already reports: after-tax net worth (current $), final Roth,
lifetime spend (current $), lifetime tax (current $, lower better), break-even year (lower better,
absent = 9999).

## Result: H4 CONFIRMED at every metric set

| metric set | dominated | frontier | % dominated |
|---|---:|---:|---:|
| net worth + Roth | 118 | **18** | **86.8%** |
| net worth + Roth + tax | 109 | **27** | **80.1%** |
| net worth + Roth + spend + tax | 90 | **46** | **66.2%** |
| net worth + Roth + spend + tax + break-even | 84 | **52** | 61.8% |

`P100` predicted **">50% dominated"** before the harness existed. **Confirmed, and not marginally**:
the loosest set still discards 62% of the table and the tightest discards 87%.

## H5: half confirmed, half refuted

| clause | verdict |
|---|---|
| "the row the user picked by hand is ON the frontier" | **CONFIRMED.** Their `IRMAA Ceil` plan is non-dominated on all four core metrics |
| "the nominal `conveffect` winner is NOT on the frontier" | **REFUTED.** `Ordered ✓ ⇌` is non-dominated too |

The refuted half is worth stating plainly: **the objective's winner is not a bad plan.** The failure
was never that `conveffect` picked something dominated - it is that it said nothing at all about the
other 133 rows, and the user had to do the comparison by hand. Both plans are on the frontier; the
tool just could not show that.

## The finding that shapes the design: the metric set IS the knob

The frontier is 18 rows on two metrics and 52 on five. **"Show the frontier" is not a
parameter-free simplification** - it moves the choice from "which objective" to "which metrics
count", and the phase should say so rather than implying the trade disappeared.

It is still a much weaker choice than the one it replaces. Metrics are the columns the table already
prints, not a preference the user has to hold; and a plan that is on the frontier for a superset of
metrics is on it for every subset, so widening the set is always safe and only ever costs brevity.

**Recommended default: the four core metrics (net worth, Roth, spend, tax), giving 46 of 136.** A
3x reduction, honestly reported. Break-even is deliberately left out of the default because 133 of
these rows have no break-even year at all, so including it mostly measures whether a row was
evaluated - the same defect Part 1 documents, leaking into a second place.

**Do not describe the frontier as "a handful".** On this scenario it is 46 rows. It is a large
improvement over 136 and it is not a shortlist.

## Two properties worth pinning as tests

- **The argmax of any single reported metric is never dominated.** So hiding dominated rows can
  never hide the winner of any objective that ranks on one of those metrics. That is the safety
  argument for turning suppression on by default, and it is a one-line test.
- **Widening the metric set only ever grows the frontier.** A row on the frontier for a set stays on
  it for any superset. Also a cheap test, and it is what makes the default defensible.

---

# Part 3: why "mark them unevaluated" is only half an answer  *(2026-08-31, user challenge)*

Part 1 concluded that unevaluated rows should be marked rather than ranked. The user pushed back:
*"What's the point of marking unevaluated rows? Wouldn't a better strategy be to evaluate all rows
using perhaps a second generic system (e.g. Net Wealth) so that there is still some meaning to the
ordering?"*

**They are right, and the conclusion has been revised.** Marking is honest but leaves 133 of 136 rows
ungraded, which does not help anyone CHOOSE. A table that refuses to order itself has swapped one
problem for another.

## The 133 are not one group - they are two, and the table shows both as blank

| | count | what is actually known |
|---|---:|---|
| evaluated, conversions found to pay | 3 | a measured dollar figure |
| **evaluated, conversions found NOT to pay** | **9** | **measured: the answer is $0** |
| never evaluated | 124 | nothing |

The 9 are the interesting ones. `optimizer_ui.js` does `continue` when `optConv === 0`, so a
candidate that was fully searched and came back "converting does not help this plan" **has its result
discarded**. That is a real answer to the user's question, already paid for, and thrown away.
Recording it takes the graded set from **3 to 12** on this scenario at no computational cost.

## Cost of the obviously-right answer, measured

| | ms |
|---|---:|
| sweep with the conversion optimizer OFF | 1,535 |
| sweep with the shipped pool of 12 | 6,238 |
| **per candidate** | **392** |
| **projected, all 136 rows** | **~54,800 (55 s)** |

So "just evaluate everything" costs about **55 seconds** on this scenario today. That is the honest
reason the pool cap exists, and it is the concrete case for `P34` - not a preference for a smaller
table.

## The revised answer: two-key ordering, not a blended score

1. **Record the zeros** (`P100b3a`). `$0` and `not evaluated` render differently.
2. **Order in two labelled groups** (`P100b3b`): evaluated rows by conversion effectiveness, then the
   rest **by net wealth, labelled as such**.

**A single blended number is rejected.** Conversion savings top out at $2.28M on this scenario while
net wealth runs ~$10M; a naive blend sorts by scale, and "rank 40" would silently mean "40th by net
wealth" under a column headed *effectiveness* - a new lie replacing the old one. Two labelled groups
say the true thing in both regions of the table and leave no gap.

## The side effect that matters: this fixes the instability too

A row's net wealth does not depend on which plan is currently selected, so the fallback ordering does
not move when the user adopts a recommendation - which marking alone would not have achieved.

**One caveat, and it is a real dependency rather than a footnote.** `afterTaxNWCurrentDollars` is
computed with `sharedFutureIRARate`, which falls back to `results[0]` when the heirs rate is unset.
It measured identical (0.12) across both runs here, but that is an observation, not a guarantee.
**`P100b2` must land with or before `P100b3`**, or the fallback ordering inherits the very
instability it exists to remove.

---

# Part 4: rank by ALL metrics in priority order  *(2026-08-31, user proposal, measured)*

The user's refinement: *"evaluate all rows by ALL known facts - and what changes is the
weight/priority. Roth Conversion Effectiveness might rank first by conversion tax savings, second by
final Roth value, third by break even, fourth by net wealth, fifth by remaining RMD, sixth by account
spread, seventh by lifetime taxes, eighth by total spendable."*

## First, name it: this is LEXICOGRAPHIC ordering, not Pareto

They are different tools and the difference matters, because the phase now uses both:

| | what it does | what it produces |
|---|---|---|
| **Pareto** (Part 2) | removes rows beaten on EVERY metric | a set, no order - 46 of 136 |
| **Lexicographic** (this proposal) | sorts by metric 1, ties broken by metric 2, and so on | a total order, no filtering |

**They compose, and in that order:** Pareto discards the 90 rows that are the right answer to no
question, then lexicographic orders the 46 that survive. Neither replaces the other.

## The failure mode of pure lexicographic, measured on this scenario

A tie-break only fires when the higher-priority key actually TIES. Distinct values among 133 rows:

| metric | distinct values | exact ties |
|---|---:|---:|
| net wealth | 118 | 15 |
| lifetime tax | 117 | 16 |
| remaining IRA (RMD exposure) | 102 | 31 |
| final Roth | 78 | 55 |
| spend | 39 | 94 |
| break-even year | 15 (+67 with none) | 51 |

**With net wealth as the first key, priorities 2 through 8 would decide 15 rows out of 133.** An
eight-level priority list would be seven levels of decoration. Continuous dollar metrics essentially
never tie, so strict lexicographic collapses to its first key.

## Banded lexicographic works, and the measurement says by how much

Treat two rows as tied when their leading-key values fall within a band, then let priority 2 decide.
Band expressed as a fraction of the metric's range across the table:

| leading key | band | groups | rows where priority 2 decides | top group |
|---|---:|---:|---:|---:|
| net wealth | 0.5% | 52 | 108 | 5 |
| **net wealth** | **1%** | **39** | **118 of 133** | **10** |
| net wealth | 2% | 27 | 124 | 14 |
| net wealth | 5% | 15 | 130 | 34 |
| lifetime tax | 1% | 51 | 115 | 7 |
| final Roth | 1% | 34 | 111 | 4 |
| spend | 1% | 3 | 133 | 2 |

**At a 1% band, priority 2 decides for 118 of 133 rows and the top group holds 10 plans.** That top
group is the thing the user was assembling by hand: ten plans effectively tied on net wealth, ordered
by whatever they care about next.

`spend` collapses to 3 groups at every band - almost every plan funds the same goal - which makes it
a poor leading key and a good late tie-break. That is a per-metric fact worth encoding once.

## What this changes in the design

1. **Adopt it.** It supersedes the two-key fallback in Part 3, which was a 2-level lexicographic with
   a group label. This generalizes it to N levels and orders the whole table meaningfully.
2. **Bands are required, not optional.** Without them the proposal degenerates to its first key. The
   band is a new parameter - honestly, a knob - but it is ONE number with a defensible default (1% of
   range), it needs no per-user tuning, and it is far smaller than the choice it replaces.
3. **The evaluated / not-evaluated partition SURVIVES.** `conveffect`'s leading key exists for 12 rows
   of 136. Lexicographic cannot order rows on a key they do not have. So `P100b3a` (record the zeros)
   is still needed, and the priority list orders WITHIN each partition.
4. **Authoring cost, and the mitigation.** Nine objectives x ~8 metrics is 72 ordering decisions to
   justify, which is exactly the kind of thing that rots. **Define ONE shared default priority order
   and let each objective override only its leading metric or two.** Nine short overrides instead of
   seventy-two authored choices, and a new objective costs one line.

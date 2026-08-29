# Should the conversion search skip the ceiling strategies? (P88f)

A user pointed out that an Extra Annual Roth Conversion and a Fill Bracket strategy pull against
each other: the strategy fills income up to a ceiling, the conversion is stacked on top, so the
ceiling breaks. They proposed that the Optimizer stop offering conversion-optimized rows for those
families.

**The instinct is right and the remedy is not.** Every such row does break its own ceiling - 61 of
61 measured. But excluding them would throw away a median of $53,990 and up to $1,546,930 of real
gain. The answer is to mark the rows, not to drop them.

Harness:
[`.test_harnesses/convopt_ceiling_harness.js`](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/convopt_ceiling_harness.js)

```sh
node .test_harnesses/convopt_ceiling_harness.js
```

## Reading guide

| term | meaning |
|---|---|
| **CEILING family** | a strategy that targets a limit: Fill Bracket, Min Limit, IRMAA Tier. Section 0 of the harness verifies this against the engine's own `BracketTarget` rather than trusting the label |
| **AGNOSTIC family** | Proportional, Ordered, IRA Draw. No ceiling, so nothing to break |
| **optConv** | what `optimizeConversionAmount` picks, on the production metric (`baselineScore` at a shared heirs rate). **$0 means the Optimizer drops the row entirely** - so $0 is the proposed exclusion happening by itself |
| **score gain** | `baselineScore` at `optConv` minus the same at $0. What excluding the row would cost |
| **breach years** | years where the **conversion** put income over that row's own ceiling. Counted from `-overageFromConv`, which P88c added specifically so a chosen breach is distinguishable from spending that could not be funded inside the ceiling |
| **heirs rate** | assumed future tax rate on inherited IRA dollars. "auto" is whatever the plan itself reports, which is what the Optimizer uses |
| **C1..C5** | predictions, registered before the run |

### The grid

5 account mixes x 3 heirs rates (auto / 0.35 / 0.45) x 2 spend rates (4% / 6%) x 9 families =
**270 cells**, of which 180 are ceiling families. Each cell runs the production search. The mixes,
ages and economic assumptions are copied verbatim from `rmdbasis_harness.js`.

### Why this could not be asked until now

Until P88b an extra conversion never reached MAGI, so the search scored these rows on numbers that
omitted the conversion's own IRMAA and was biased toward larger conversions everywhere. "Does the
search behave sensibly on ceiling families" was unanswerable while it was reading the wrong numbers.

---

## 1. The search does not exclude them by itself

`selectConversionCandidates` deliberately splits `bracket` into `bracket-rate` and `bracket-irmaa`
so both ceiling kinds get a seat, and a candidate whose search returns $0 is dropped. If the search
returned $0 on ceiling families, the user's exclusion would already be in effect. It does not.

| family | kind | cells | picks > $0 | median pick | largest pick | median gain |
|---|---|---|---|---|---|---|
| Fill Bracket 12% | CEILING | 30 | 12 | $75,000 | $175,000 | $700,930 |
| Fill Bracket 22% | CEILING | 30 | 5 | $350,000 | $350,000 | $28,919 |
| Fill Bracket 24% | CEILING | 30 | 21 | $25,000 | $150,000 | $21,457 |
| Min Limit 24% | CEILING | 30 | 7 | $100,000 | $150,000 | $630,088 |
| IRMAA Tier 1 | CEILING | 30 | 10 | $225,000 | $275,000 | $12,698 |
| IRMAA Tier 2 | CEILING | 30 | 6 | $137,500 | $150,000 | $99,744 |
| Proportional 10% | agnostic | 30 | 16 | $100,000 | $475,000 | $478,111 |
| Ordered CBRI | agnostic | 30 | 12 | $137,500 | $250,000 | $1,167,523 |
| IRA Draw 6% | agnostic | 30 | 9 | $50,000 | $100,000 | $221,460 |

**61 of 180 ceiling cells pick a non-zero conversion.** Those rows reach the table.

## 2. Every one of them breaks its own ceiling

**61 of 61.** Not a tendency - all of them. The largest by score gain:

| scenario | family | spend | heirs | pick | score gain | breach yrs | worst breach |
|---|---|---|---|---|---|---|---|
| shipped defaults | Min Limit 24% | 4% | 0.45 | $100,000 | $1,546,930 | 16/33 | $100,000 |
| shipped defaults | Min Limit 24% | 4% | 0.35 | $100,000 | $1,394,832 | 16/33 | $100,000 |
| defaults x3 | Fill Bracket 12% | 4% | 0.45 | $175,000 | $1,209,395 | **33/33** | $175,000 |
| shipped defaults | Fill Bracket 12% | 4% | 0.45 | $75,000 | $1,199,925 | 17/33 | $75,000 |
| shipped defaults | Min Limit 24% | 4% | auto | $100,000 | $1,105,847 | 16/33 | $100,000 |
| defaults x3 | Fill Bracket 12% | 4% | 0.35 | $175,000 | $821,755 | 33/33 | $175,000 |

The `33/33` rows are the clearest statement of the problem: a plan labelled "Fill Bracket 12%" that
is over its bracket in **every single year it has one**. The label describes a limit the row does
not keep.

That is expected rather than surprising - the conversion is added on top of a draw already sized to
fill the ceiling - but "expected" is not the same as "disclosed", and until now it was neither
shown nor marked.

## 3. Excluding them is the expensive answer

Median gain across the 61 rows is **$53,990**, the largest is **$1,546,930**, and **zero of them
gain less than $1,000**. There are no marginal rows here to discard cheaply. A blanket
family-level exclusion removes 61 rows of which none is noise.

## 4. And a family-level rule is the wrong shape anyway

The prediction was that the **heirs rate** drives whether a ceiling family picks a conversion. It
does not, and the harness scores that honestly rather than on a bar it could not fail:

| axis | picks > $0 | spread |
|---|---|---|
| heirs rate: auto / 0.35 / 0.45 | 19 / 20 / 22 | **3** |
| spend rate: 4% / 6% | 43 / 18 | **25** |

The **spend rate** is the lever. That does not rescue the exclusion, though - it moves the argument
sideways. Whether a ceiling family wants a conversion turns on the plan, not on the family's
identity, so a rule keyed on family identity is the wrong shape either way.

## 5. Predictions

| id | prediction | verdict |
|---|---|---|
| **C1** | the search does not self-correct to $0 | **HOLDS.** 61 of 180 ceiling cells pick non-zero |
| **C2** | every non-zero ceiling pick breaches its own ceiling | **HOLDS.** 61 of 61, none exempt |
| **C3** | the gain is material, so exclusion is costly | **HOLDS.** Median $53,990, largest $1,546,930, none under $1,000 |
| **C4** | ZERO TEST: agnostic families record no conversion-caused overage | **HOLDS.** 0 of 90 cells |
| **C5** | the heirs rate is the lever | **BROKEN.** Spread 3 against the spend rate's 25 |

### C5 was nearly scored on a bar it could not fail

Its first form asked only whether the heirs rate flips the answer in *at least one* combination. It
flips 3 of 60 - which would have passed, and would have been noise wearing a verdict. Scored against
the alternative axis instead, so a wrong answer can actually lose, it fails and the spend rate wins.
The same mistake, on the same kind of threshold, is recorded in
[`BRACKET_CEILING_BASIS.md`](BRACKET_CEILING_BASIS.md) and
[`EXTRA_CONVERSION_MAGI.md`](EXTRA_CONVERSION_MAGI.md).

## 6. What shipped

**Answer (c): keep the rows, mark them.** A conversion-optimized row whose conversion puts income
above its own ceiling now carries **`⤴`** in the Strategy column, beside the existing `⇌`. The
Strategy legend gains an entry saying what it means and that the row is no longer respecting the
limit in its name.

The marker reads `-overageFromConv` specifically, not total overage, so it never appears on a row
that went over because spending could not be funded inside the ceiling. That is a different cause,
the user chose nothing, and P88c separated the two precisely so this distinction could be drawn.

Verified in the browser on a live sweep: 7 conversion-optimized rows, 2 marked - `Fill Bracket ✓ ⇌ ⤴`
and `ACA Cliff ✓ ⇌ ⤴` - and all five agnostic rows unmarked with zero breach years.

**Not done, deliberately.** The rows are not excluded, not demoted in the ranking, and not withheld
from the Best table. They score what they score; the marker tells the reader what they gave up to
score it.

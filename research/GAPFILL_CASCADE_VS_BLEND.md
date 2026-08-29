# Should the `[40, 60]` gap-fill blend be deleted and unified on the Cash-first cascade?  *(phase P30h)*

Reference record for `gapfill_objectives_harness.js`. Reproducible with:

```bash
node .test_harnesses/gapfill_objectives_harness.js
```

2026-08-27, engine v11.1671. 5 mixes x 3 spend rates x 3 families x 2 reserve settings = 90 cells,
6 weights each, 540 simulations, ~0.6s. `w` is the **Brokerage** weight; the order is
`['Brokerage', 'Cash']`, so the shipped `[40, 60]` is 40% Brokerage / 60% Cash.

> **The answer: NO, not on this evidence - but the current default is not defensible either.**
> The seven objectives split **3 to 3 between the two ENDPOINTS**, w=0 and w=100. `w=40` wins
> **zero cells on every single objective**. So the constant is wrong in the narrow sense P30b found,
> and "delete the blend and always fill Cash first" is *also* wrong for half the objectives the
> product ranks on.

## 0. What P30g left open, and why this is a different question

`P30b` answered "is 40 the right number" with no - w=0 won 65 of 82 clean cells and 40 won none.
`P30g` then declined to change the default, naming three gaps:

1. it was `baselineScoreOf` only, not the other `OPTIMIZER_OBJECTIVES`;
2. there was no liquidity measure, and the harness could not see one;
3. Cash Reserve damps the effect ~16x, so the exposed users are the ones with no reserve.

This closes 1 and 2 and re-measures 3.

**It also reframes the target.** `w=0` is not "Cash only". `calculateWithdrawals` cascades the
shortfall, so `[0, 100]` draws Cash until it is gone and then draws Brokerage. Verified in the log
rather than argued:

```
  year       Cash draw     Brok draw    Cash bal end
  2026        $154,125        $6,824              $0
  2027              $0      $187,718              $0
  2028              $0      $193,296              $0
```

Cash covers year 1 in full, hits zero, Brokerage carries every year after. **That is exactly the
sequence `yr.isBracketStrategy` already runs two branches up.** So the real question was never
"which weight" - it was "does the proportional blend deserve to exist", because if w=0 won outright
the two branches would collapse to one policy and one could be deleted.

## 1. The objectives disagree, and they disagree at the endpoints

Over the 31 clean cells - delivered spend identical at every weight AND every weight funding the
plan:

| objective | w=0 | w=20 | w=40 | w=60 | w=80 | w=100 | tied | winner |
|---|---|---|---|---|---|---|---|---|
| networth | **14** | 1 | 0 | 1 | 0 | 0 | 15 | w=0 |
| balanced | **14** | 1 | 0 | 1 | 0 | 0 | 15 | w=0 |
| maxroth | **8** | 0 | 0 | 1 | 0 | 3 | 19 | w=0 |
| taxflex | 4 | 0 | 0 | 0 | 0 | **7** | 20 | w=100 |
| mintax | 5 | 0 | 0 | 1 | 3 | **7** | 15 | w=100 |
| widowrmd | 4 | 0 | 0 | 1 | 0 | **8** | 18 | w=100 |
| maxspend | 0 | 0 | 0 | 0 | 0 | 0 | 31 | none - genuinely inert |

**Three objectives want all-Cash-first, three want all-Brokerage, and the shipped 40 wins nothing
anywhere.** Every winner is an endpoint; no interior weight wins more than one cell of any objective.

That pattern - the optimum always at a boundary - says the metric is monotone in the weight within a
cell and the objectives simply disagree about the direction. It is not a case of "40 is close to
right"; it is a case of there being no single right number.

`maxspend` tying in all 31 cells is a construction guard, not a finding: clean cells are *defined*
by equal delivered spend, so anything else would mean the filter is broken.

## 2. Liquidity: the cost P30g named, now measured

Years the household holds no Cash at all, across all 90 cells:

| weight | cash-zero years | % of plan-years | cells at 100% zero |
|---|---|---|---|
| w=0 | 946 | **31.9%** | 4 / 90 |
| w=20 | 918 | 30.9% | 3 / 90 |
| w=40 (shipped) | 886 | 29.8% | 2 / 90 |
| w=60 | 820 | 27.6% | 0 / 90 |
| w=80 | 709 | 23.9% | 0 / 90 |
| w=100 | 592 | 19.9% | 0 / 90 |

Monotone, as expected - drawing Cash first empties Cash. **But the cost at the margin that matters
is small:** moving from the shipped w=40 to w=0 costs **2.1 percentage points** of cash-zero years,
and takes plans that spend their entire horizon with no cash from 2 to 4 out of 90.

So the liquidity objection is real and it is not large. It does not by itself justify keeping 40 -
w=60 and above buy far more liquidity, and 40 is not even the midpoint of the trade.

## 3. Cash Reserve damps it 3.9x, not 16x

| reserve | clean cells | mean spread, `balanced` | w=0 wins `balanced` |
|---|---|---|---|
| off | 14 | $32,924 | 7 / 14 |
| on ($100k) | 17 | $8,511 | 7 / 17 |

**This does not contradict `P30b`.** That figure was the WIDEST cell (CA, $534,525 off against
$33,358 on = 16x); this is the MEAN across cells. A mean and a maximum are different statistics and
the ratio between them is not expected to match. What survives is the direction and that it is
large: a reserve substantially reduces how much the weight matters, so the households most exposed
to a wrong default remain the ones with no reserve.

## 4. Scored predictions

| | prediction | outcome |
|---|---|---|
| **W1** | w=0 wins most objectives | **BROKEN** - 3 of 6 live, an even split |
| **W2** | w=0 is worst on liquidity | **HELD** - 31.9% vs 19.9% at w=100 |
| **W3** | maxspend flat inside clean cells | **HELD** - construction guard |
| **W4** | reserve-on damps ~an order of magnitude | **BROKEN** - 3.9x on the mean (see section 3) |
| **W5** | the objectives disagree | **HELD** - and this is the finding |

**W5 was written as the escape hatch and became the headline.** It was phrased as "if they all agree
on w=0, the case for deleting the blend is much stronger than P30g assumed". They do not agree. P30g
declined to change the default for reasons it could not check; those reasons turn out to have been
right, for a reason it did not state.

### Two scoring defects found and fixed mid-run, both of which changed the answer

Recorded because in both cases the harness printed a confident, wrong verdict first.

1. **Ties were awarded to the first weight in the list.** The initial run reported
   `taxflex: w=0 wins 31 of 31` and `maxspend: w=0 wins 30 of 31` - for two objectives whose spread
   across all six weights was **$0**. A winner column that cannot tell "wins everywhere" from "moves
   nothing" is not evidence. Ties are now returned as null and counted in their own column.
2. **A shared $1 tie threshold was applied to a metric measured in fractions.** `taxflex` returns a
   spread in [0, 1], so a $1 epsilon made it tie in all 31 cells *mechanically, whatever the data
   said* - and after fix 1 that read as "the weight does not move it". Each objective now carries an
   epsilon in its own units. `taxflex` is in fact one of the objectives that prefers w=100.

Between them these two flipped W1 from HELD to BROKEN, W5 from BROKEN to HELD, and the
recommendation from "delete the blend" to "do not". **The first version of this document would have
recommended a default change on a tie-breaking artifact.**

## 5. What to do

1. **Do not delete the blend, and do not unify the two branches** on this evidence. The unification
   is only justified if Cash-first is right, and it is right for exactly half the objectives.
2. **Do not keep 40 on the grounds that it was measured, either.** It wins nothing, on any
   objective, in any cell. What is defensible is "no single weight is right", which is a different
   claim and should be recorded as the reason rather than the number.
3. **The interesting option nobody has costed: make the weight follow the selected objective.** The
   Optimizer already has an "Optimize for" selector, and the split here is clean - `networth`,
   `balanced` and `maxroth` want Cash first; `taxflex`, `mintax` and `widowrmd` want Brokerage first.
   That is a real design question and out of scope here.
4. **Open:** `conveffect` and `breakeven` were not scored. They read row fields the Optimizer
   computes around `simulate()` rather than inside it, and a reimplemented metric that disagrees with
   the product's is worse than an absent one. Two of eight objectives remain unmeasured.

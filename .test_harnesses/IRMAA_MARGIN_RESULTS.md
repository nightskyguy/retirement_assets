# IRMAA safety margin - measured

> **SECTION 7 IS SUPERSEDED.** Everything here holds a CONSTANT CPI, which is the only world this
> engine can build, and in that world the margin provably prevents nothing. Once the realized CPI is
> allowed to differ from the assumed one, the margin does prevent breaches and the two rate-haircut
> modes this file recommends deleting turn out to be the only correctly shaped ones. See
> [IRMAA_CPI_RISK_RESULTS.md](IRMAA_CPI_RISK_RESULTS.md). The cost measurements below remain valid.

`node .test_harnesses/irmaa_margin_harness.js`. Round 2: 3 arms x 7 portfolio shapes x 3 CPI rates
= 84 cells x 7 modes = **588 simulations**, Cycle Brokerage **off** in every one. Wealth is
after-tax final net worth with the IRA discounted at 22%. `legacy` is the **pre-fix** ceiling,
reproduced by forcing `LOOKBACK` to 0 so the forward factor collapses to 1.

Round 1 (36 cells, one household shape, tier ceiling only) is superseded. Three things it got wrong
or could not see are recorded in section 6, because two of them were mistakes in the harness rather
than findings about the engine.

---

## 1. Only TWO of the three sites can change a number. The third is provably inert.

The change was described as fixing three sites. That was wrong, and the sweep is what caught it.

```
yr.goalLimit  = min(federal band top, state band top) containing sim.spendGoal
IRMAABracket  = findUpperLimitByAmount('IRMAA', status, yr.goalLimit, effCpi)
yr.IRMAALimit = min(yr.goalLimit, IRMAABracket.limit)
```

`findUpperLimitByAmount` returns the top of the band **containing** its amount, so its result is
`>= yr.goalLimit` by construction and the `min()` always selects `yr.goalLimit`. Checked over
**7,216** (goal, filing status, inflation) combinations: **0 violations**. `yr.IRMAALimit` has
always equalled `yr.goalLimit`, before the forward projection and after it. `minlimit` therefore
cannot be an arm, and the projection at that site is harmless and pointless.

The projection is kept rather than deleted, so all three sites stay written the same way and this
one starts behaving correctly the moment the ladder changes. A test pins the inertness so that day
announces itself instead of passing silently.

**Live sites: the IRMAA tier ceiling, and QCD "As Needed".**

## 2. Where the forecast bites, by arm

**IRMAA Ceil, below-tier** (21 cells)

| mode | mean vs none | worst | best | won | CLEAN breach | soft | IRMAA paid |
|---|---|---|---|---|---|---|---|
| halfstep | +0.497% | -0.033% | +4.014% | 1 | 2/2 100% | 266 | $5,056,169 |
| none | +0.000% | - | - | 0 | 6/6 100% | 259 | $5,029,901 |
| flat1000 | +0.171% | -0.064% | +1.121% | 0 | 6/6 100% | 260 | $5,045,467 |
| flat2000 | +0.257% | -0.070% | +1.628% | 1 | 6/6 100% | 261 | $5,061,084 |
| halfcpi | +1.047% | -0.073% | +7.103% | 17 | 2/2 100% | 278 | $5,276,027 |
| cpiminus1 | +0.744% | -0.073% | +5.202% | 7 | 2/2 100% | 271 | $5,126,876 |
| legacy | +1.488% | -0.386% | +9.218% | - | 0/0 | 285 | $5,395,649 |

**IRMAA Ceil, Tier 2** (21 cells)

| mode | mean vs none | worst | best | won | CLEAN breach | soft | IRMAA paid |
|---|---|---|---|---|---|---|---|
| halfstep | +0.118% | -0.714% | +1.019% | 3 | 0/279 0% | 56 | $4,983,176 |
| none | +0.000% | - | - | 1 | 2/284 1% | 53 | $4,963,053 |
| flat1000 | +0.073% | -0.110% | +0.748% | 0 | 1/282 0% | 54 | $4,959,436 |
| flat2000 | +0.131% | -0.714% | +1.004% | 2 | 1/281 0% | 55 | $4,969,170 |
| halfcpi | +0.572% | -1.029% | +3.995% | 14 | 1/271 0% | 68 | $5,174,668 |
| cpiminus1 | +0.357% | -0.770% | +2.427% | 6 | 1/278 0% | 63 | $5,085,767 |
| legacy | +0.699% | -2.234% | +4.432% | - | 2/280 1% | 73 | $5,372,076 |

**QCD "As Needed", no ceiling at all** (21 cells) - `propwd` never consults an IRMAA ceiling, so the
QCD target is the only forward-projected mechanism in this arm. That isolation is the point.

| mode | mean vs none | +given | won | QCD given | vs none |
|---|---|---|---|---|---|
| none | +0.000% | +0.000% | 20 | $16,747,696 | - |
| flat1000 | -0.108% | -0.046% | 2 | $16,829,976 | +$82,280 |
| flat2000 | -0.215% | -0.087% | 2 | $16,922,578 | +$174,882 |
| halfstep | -0.395% | -0.127% | 2 | $17,184,076 | +$436,379 |
| cpiminus1 | -0.514% | -0.176% | 2 | $17,284,571 | +$536,875 |
| halfcpi | -0.836% | -0.250% | 2 | $17,670,344 | +$922,648 |
| legacy | -1.740% | -0.503% | - | $18,643,295 | +$1,895,598 |

## 3. The QCD hypothesis is confirmed

**A more generous threshold does reduce the QCD needed.** "As Needed" donates
`provisionalMAGI - (tierTarget - margin)`, so raising the target shrinks the gap it has to close.
Every mode donates more than `none`, monotonically in setback size, and the **forward projection
alone saves $1,895,598 of donation** across these 21 cells versus the pre-fix target.

Two qualifications on reading that as a win:

- **Wealth alone scores this dishonestly.** A QCD leaves the household, so any setting that donates
  less looks richer. On `household+given` the spread collapses by roughly 3x: `halfcpi` goes from
  -0.836% to -0.250%, `legacy` from -1.740% to -0.503%. Most of the apparent cost of a margin here
  is money going to charity, not money destroyed. The genuine efficiency loss is the remainder.
- **A smaller QCD is only a gain if you did not want to give it.** In "As Needed" mode the donation
  is a means of dodging a surcharge, so shrinking it is a real saving. For anyone with a giving
  target, the number that matters is `household+given`, not wealth.

## 4. The margin still prevents nothing. Every breach is the widow-status gap.

Round 1 found all 10 clean breaches were the survivor transition. Round 2, on a grid nearly twice
the size and with the arms narrowed, reproduces it exactly:

```
none      clean breaches: status-change 8  | same-status 0
halfstep  clean breaches: status-change 2  | same-status 0
halfcpi   clean breaches: status-change 3  | same-status 0
```

**Zero same-status breaches in every mode.** MAGI is sized while MFJ and billed after a death
against Single thresholds roughly half as high. The counts differ between modes only because a
tighter ceiling pushes years across the clean/soft boundary near the death year - bookkeeping, not
protection. There was never a same-status breach for a margin to prevent, because with constant CPI
the ceiling hits its target to the dollar.

The fix remains a status-aware projection: ask what the filing status will be at charge time, not
what it is now. `die1`/`die2` are already inputs. Still out of the approved scope, still the
follow-up this work has earned twice over.

## 5. The limit no sweep can lift

[optimizer_core.js:2774](../optimizer_core.js#L2774):

```js
sim.cpiRate *= (1 + inputs.cpi);        // constant, every run, every path
sim.inflation *= (1 + yr.yearInflation); // path-varying
```

Monte Carlo gives each path its own `inflationSequence`, but that drives **spending** inflation. The
CPI that indexes IRMAA thresholds never varies. **There is no run in this codebase where the
threshold two years out is uncertain**, so a safety margin has nothing to be safe against and this
harness can only ever measure its cost. Every "which margin is best" number above is a statement
about ceiling tuning, never about protection. Validating protection needs a realized-vs-assumed CPI,
which is an engine change.

## 6. What round 1 got wrong

Recorded because two of the three were defects in the measurement, not findings about the engine.

1. **Cycle Brokerage swamped the signal.** A hand run with `cyc=1` made `cpiminus1` look worth
   +0.68% of final wealth. Patching the margin into a continuous dollar knob showed wealth is a
   smooth function of the **setback in dollars alone**, peaking near $5,750 for that plan;
   `cpiminus1` won only because its setback ($5,606) landed nearest the peak and `halfcpi` ($7,833)
   lost only because it overshot. The peak moved between $1,000 and beyond $9,000 across seven
   portfolio variants, and with cyclic **off** the whole effect fell to **+0.002%**. The gain was
   harvest timing, not IRMAA. Left with P32, deliberately.
2. **The QCD monotonicity check hardcoded the mode order** and reported a false NO. `halfstep` holds
   back half the tier *step*, which at the Tier 1 to Tier 2 boundary exceeds a flat $2,000, so its
   position is not fixed. Now sorted by measured donation.
3. **Breaches were compared as counts.** A margin moves years between the clean and soft buckets, so
   the denominator moves too. Now reported as a rate, and attributed in section 4.

## 7. What to do

1. **Keep the forward projection.** It is a correctness fix, and on the QCD arm it is worth real
   money in the right direction.
2. **The margin cannot be chosen on this evidence, and no wider sweep will change that.** It
   prevents nothing measurable here by construction (section 5). Judge it on cost: the two dollar
   modes are nearly free, the two CPI modes are the most expensive and buy the same nothing.
3. **`halfcpi` and `cpiminus1` should go** if the knob ever graduates out of nerdknob. They win
   "cells" only by tightening the ceiling, which is a conversion-sizing decision wearing a
   safety-margin label, and the user already has a direct control for that: pick a lower tier.
4. **Two follow-ups, in order.** Project the filing status forward (section 4). Then, if the margin
   is to be kept at all, give CPI a realized-vs-assumed split so it can be evaluated (section 5).

# Which IRMAA safety margin is best against Monte Carlo inflation paths  *(phase P83)*

Reference record for `irmaa_margin_paths_harness.js`. Reproducible with:

```bash
node .test_harnesses/irmaa_margin_paths_harness.js
```

2026-08-27, engine v11.1671. 5 margin modes x 4 path sources x 3 household shapes x 3 CPI
assumptions, 30-year plans aimed at IRMAA Tier 1, seed 42, 150 paths per synthetic mode. ~31s.

> **The headline: `halfcpi` wins on every metric in all three Monte Carlo modes, and for the first
> time it wins for the reason it was named after.** It prevents 17.5% to 20.3% of tier breaches,
> and the fixed-indexation control says roughly half of that is genuine forecast absorption rather
> than ceiling tuning. The default does not change. What changes is why it is defensible.

## Reading guide - the five modes and the five predictions

**The five margin modes**, all of them `irmaaMarginMode` settings, are what this run sweeps. A margin
is safety room held back below the tier ceiling, so that a year whose realized CPI comes in under the
plan's assumption does not breach the tier anyway. Two shape it as a rate, two as dollars:

| mode | shape | what it holds back |
|---|---|---|
| **`halfcpi`** | rate | projects the threshold forward by **half** the two-year CPI increase (3% CPI: +3.045% instead of +6.09%) |
| **`cpiminus1`** | rate | the full increase **less one point** (3% CPI: +5.09%) |
| **`halfstep`** | dollars | half of what crossing this exact tier boundary costs, so the setback scales with the cliff |
| **`flat2000`** | dollars | a flat $2,000 |
| **`none`** | - | no margin. The control every column below is measured against |

**The five predictions, `P1` to `P5`**, were registered in the harness before the numbers were looked
at, and are scored in **section 6**:

| id | prediction |
|---|---|
| **P1** | bootstrap generates the largest two-year forecast error, so the largest margin benefit |
| **P2** | the rate-shaped modes beat the dollar-shaped ones |
| **P3** | surcharge dollars stay noise, under ±0.5% between modes |
| **P4** | the fixed-indexation control shows a materially smaller benefit than the path arm |
| **P5** | `halfcpi` leads on wealth in every mode |

> `P1` to `P5` here are PREDICTIONS. `task_plan.md` also numbers its phases `P1`, `P2`, and so on,
> and they are unrelated; a phase referenced in this file is written `P70`, `P83f` and the like.

---

## 0. Why this run is possible, when the earlier one said it was not

`IRMAA_MARGIN_FIXED_CPI.md` section 5 is titled "The limit no sweep can lift" and rests on this line:

```js
sim.cpiRate *= (1 + inputs.cpi);        // constant, every run, every path
```

**That line no longer exists.** P70 replaced it:

```js
cpi_t = max(CPI_INDEX_FLOOR, yr.yearInflation + (inputs.cpi - inputs.inflation))
sim.cpiRate *= (1 + cpi_t)
```

so the threshold now moves with each path, while `irmaaFwdFactor()` deliberately stayed on the
scalar `inputs.cpi` - a plan forecasting the index two years out is not clairvoyant. Realized and
assumed CPI diverge. That is precisely the "engine change, not a harness one" that the old
document's section 7 listed as its second follow-up, and it has since shipped.

P70e then measured `halfcpi` against `none` across the Stress bank and found breach prevention rising
from 8.5% (fixed indexation) to 21.1% (path-following). This run extends that to **all five margin
modes across all three Monte Carlo modes**, and reproduces P70e's stress figure at **21.4%** - close
enough to call it the same measurement, and the small gap is not chased here.

## 1. The size of the prize

> **Window correction, 2026-08-27.** This section originally described the lookback window as the
> one *ending* at year y. The forecast is FORWARD - the plan caps year y's MAGI, charged in year
> y+2 against the threshold published for y+2, so it must project years y+1 and y+2. Checked rather
> than assumed: pooled over a stationary process the two windows agree to within noise (GBM, typed
> forecast - forward mean +0.72% / p10 -5.02% / undershoot 46.5%, backward +0.74% / -4.96% / 46.0%),
> so the numbers below stand. Section 8 uses the forward window throughout.

A margin can only ever pay out of forecast error, and only an **undershoot** can breach: if realized
CPI comes in above assumption the threshold moved further than the plan expected and the ceiling was
merely conservative. (`irmaa_cpi_risk_harness.js` section 3: the asymmetry is total.) So before any
margin number, how much error do these paths actually generate over a 2-year lookback window?

| path source | windows | undershoot rate | mean error | p10 error | worst |
|---|---|---|---|---|---|
| Historical (block bootstrap) | 12,600 | 47.2% | **+1.85%** | −3.66% | −7.62% |
| Synthetic-GBM | 12,600 | 46.4% | +0.71% | **−4.99%** | −7.62% |
| Synthetic-AAM | 12,600 | 46.4% | +0.71% | **−4.99%** | −7.62% |
| Stress bank | 2,184 | 32.1% | +3.73% | −3.00% | −7.62% |

**GBM and AAM produce identical inflation, and that is correct.** The AR(1) draws from its own
stream keyed by `INFLATION_STREAM_XOR`, correlated with `z1` - the standard normal behind the return
draw. `drawSyntheticBank` turns that same `z1` into different *returns* under the two modes but never
changes `z1` itself, so the inflation sequence is untouched. Any future divergence here means the
inflation stream has been made mode-dependent, which would break GBM's bit-identity guarantee.

**The identical −7.62% worst case in all four sources is the floor, not a coincidence.** Two years at
`CPI_INDEX_FLOOR` (−1%) against an assumed 3% is `0.99² / 1.03² − 1 = −7.62%` exactly. Every source
reaches it; none can go below it.

## 2. Margin sweep, indexation following the path

Breaches are years charged **above** the targeted tier. Delivered spend moved 0.00% in every cell of
every mode, so the wealth column is a clean comparison and not a stinginess ranking.

### Historical (block bootstrap)

| margin | breaches | vs none | surcharge | vs none | wealth vs none |
|---|---|---|---|---|---|
| **halfcpi** | 12,231 | **−17.5%** | $463,598,173 | −0.51% | +0.39% |
| cpiminus1 | 13,723 | −7.4% | $464,383,502 | −0.34% | +0.17% |
| flat2000 | 13,936 | −6.0% | $464,539,470 | −0.31% | +0.13% |
| halfstep | 14,511 | −2.1% | $465,472,203 | −0.11% | +0.07% |
| none | 14,821 | 0.0% | $465,974,376 | 0.00% | 0.00% |

### Synthetic-GBM

| margin | breaches | vs none | surcharge vs none | wealth vs none |
|---|---|---|---|---|
| **halfcpi** | 12,179 | **−20.1%** | −0.61% | +0.36% |
| cpiminus1 | 13,985 | −8.2% | −0.35% | +0.15% |
| flat2000 | 14,218 | −6.7% | −0.35% | +0.11% |
| halfstep | 14,870 | −2.4% | −0.04% | +0.05% |
| none | 15,238 | 0.0% | 0.00% | 0.00% |

### Synthetic-AAM

| margin | breaches | vs none | surcharge vs none | wealth vs none |
|---|---|---|---|---|
| **halfcpi** | 12,048 | **−20.3%** | −0.66% | +0.38% |
| cpiminus1 | 13,873 | −8.2% | −0.31% | +0.15% |
| flat2000 | 14,102 | −6.7% | −0.33% | +0.12% |
| halfstep | 14,750 | −2.4% | −0.04% | +0.05% |
| none | 15,119 | 0.0% | 0.00% | 0.00% |

### Stress bank (P70e continuity)

| margin | breaches | vs none | surcharge vs none | wealth vs none |
|---|---|---|---|---|
| **halfcpi** | 1,622 | **−21.4%** | −0.12% | +0.47% |
| cpiminus1 | 1,877 | −9.0% | −0.12% | +0.19% |
| flat2000 | 1,901 | −7.9% | −0.35% | +0.16% |
| halfstep | 2,008 | −2.7% | −0.11% | +0.08% |
| none | 2,063 | 0.0% | 0.00% | 0.00% |

**The ordering is identical in all four sources**: halfcpi, cpiminus1, flat2000, halfstep, none. Four
independently generated inflation processes agreeing on a five-way ranking is the strongest result
here.

## 3. The control arm says about half of it is real

`fixedTaxIndexing: true` pins both statutory clocks to the typed rates while spending still follows
the path, so the forward projection is exact by construction and **no benefit there can be forecast
absorption**.

| path source | halfcpi breach drop, path-following | same, fixed indexation | ratio |
|---|---|---|---|
| Historical | −17.5% | −7.1% | 2.5x |
| Synthetic-GBM | −20.1% | −8.3% | 2.4x |
| Synthetic-AAM | −20.3% | −8.3% | 2.4x |
| Stress | −21.4% | −8.5% | 2.5x |

Roughly 60% of the benefit is genuine absorption of forecast error and roughly 40% is the ceiling
tuning the old harness identified - a tighter ceiling converts less and so crosses fewer boundaries
for reasons that have nothing to do with CPI. **Both halves are real; only the first is what a
"safety margin" claims to do.** That the ratio is 2.4-2.5x across four unrelated path sources is
what makes it worth quoting.

## 4. Why halfcpi wins: it is the only mode sized to the error

Setback at CPI 2.5% against the Tier 1 MFJ threshold:

| margin | fwd factor | rate setback | dollar setback | TOTAL | breach drop (bootstrap) |
|---|---|---|---|---|---|
| halfcpi | 1.02531 | $5,518 | $0 | **$5,518** | −17.5% |
| halfstep | 1.05062 | $0 | $2,435 | $2,435 | −2.1% |
| cpiminus1 | 1.04062 | $2,180 | $0 | $2,180 | −7.4% |
| flat2000 | 1.05062 | $0 | $2,000 | $2,000 | −6.0% |
| none | 1.05062 | $0 | $0 | $0 | 0.0% |

The typical error to absorb is the threshold times the CPI miss: about $230,000 x 4% ≈ **$9,200** at
the p10, and around $5,700 at more ordinary misses. **Only `halfcpi` has a setback of that order.**
The other three sit at $2,000-$2,400, less than half the error they would need to cover, which is why
they recover only a third to a half as much.

**`halfstep` is the exception that rules out "bigger setback always wins".** It has the second largest
year-0 setback and the *smallest* benefit - a third of what `flat2000` buys for $435 less. Size alone
does not order this list. No mechanism is offered here; it is recorded as unexplained rather than
given a plausible story, and it is the reason prediction `P2` is stated as shape-vs-size rather
than as a size ranking.

## 5. The open question this run raises and cannot answer

**The curve has not turned.** Going from `cpiminus1` ($2,180) to `halfcpi` ($5,518) more than doubles
the breach reduction, and `halfcpi`'s setback is still **below the p10 forecast error** of $9,200. On
this evidence the optimum lies somewhere beyond the largest option the menu offers, and the menu is
truncated below its own best point.

That cannot be settled here: `irmaaFwdFactor()` switches on a fixed list, so there is no continuous
knob to sweep and adding one is an engine change. It is the same shape as P30's `[40, 60]` - the
constant that wins is the biggest one available, which is not the same as the right one.

## 6. Scored predictions

Registered before the run; the statements are also in the reading guide at the top.

| | prediction | outcome |
|---|---|---|
| **P1** | bootstrap generates the largest error, so the largest margin benefit | **BROKEN**, and backwards |
| **P2** | rate-shaped modes beat dollar-shaped ones | **HELD** in all four sources |
| **P3** | surcharge dollars stay noise, under ±0.5% | **BROKEN**, 0.66%, and the sign flips |
| **P4** | fixed-indexation control shows a smaller benefit than the path arm | **HELD**, 2.4-2.5x everywhere |
| **P5** | halfcpi leads on wealth in every mode | **HELD** |

**P1 is broken in the interesting direction.** Bootstrap does lead on undershoot *rate* (47.2% vs
46.4%), but the synthetic modes show the **larger** benefit (−20.1% / −20.3% vs −17.5%). Depth beats
frequency: bootstrap's p10 undershoot is −3.66% where the AR(1)'s is −4.99%. The 1970-2025 record
runs hot relative to a 2-3% assumption (mean error **+1.85%**, i.e. usually an overshoot), so its
undershoots are shallow. A mean-reverting AR(1) around the plan's own target overshoots less on
average (+0.71%) but wanders further below it when it does.

The reasoning behind the prediction - "historical has regime shifts, AR(1) is mean-reverting, so
historical must generate more error" - was sound and produced the wrong answer, because it reasoned
about the *frequency* of error and the margin is paid out of its *depth*.

**A scoring note, recorded because it nearly went the other way.** P1's first predicate tested only
the undershoot rate, which bootstrap leads, and printed **HELD** for a prediction the benefit numbers
refute. A predicate that tests the nearest convenient statistic instead of the claim will confirm
whatever it is pointed at. It now scores the claim.

**P3 is broken narrowly but the sign matters more than the size.** The largest swing is 0.66%, just
over the ±0.5% line. But under path-following every margin *reduces* surcharge dollars (halfcpi
−0.51% to −0.66%), while under fixed indexation every margin *increases* them (+0.54% to +0.82%).
**The margin flips from a cost to a saving when the threshold becomes uncertain**, which is the same
reversal `irmaa_cpi_risk_harness.js` predicted from hand-built CPI worlds, now seen on generated
paths. P70e's −0.09% on the stress bank reproduces here at −0.12%.

## 7. What to do

1. **Keep `halfcpi` as `IRMAA_MARGIN_DEFAULT`.** It now wins on breaches, on surcharge dollars and on
   wealth, in all three Monte Carlo modes plus stress. Previously it was defensible only on the
   conversion-sizing side effect; it is now defensible on the thing it is named for.
2. **`IRMAA_MARGIN_FIXED_CPI.md` sections 5 and 7 are superseded** and are marked so. Section 5 quotes
   a line of engine code that no longer exists, and its conclusion - "a safety margin has nothing to
   be safe against" - is now false. Section 7's recommendation 3, that `halfcpi` and `cpiminus1`
   should be deleted if the knob ever leaves the nerdknob, is **reversed**: they are the two best
   modes.
3. **`halfstep` is the deletion candidate**, not the CPI modes. It buys the least of any margin in
   every source measured, for a setback larger than `flat2000`'s.
4. **Open, and filed rather than guessed:** whether the optimum lies beyond `halfcpi` (section 5).
   Section 8 sharpens this: the p10 undershoot needs a $6,338-$10,890 setback and halfcpi supplies
   $5,518, so it is under-sized in every path source measured.
   Needs a continuous forward-factor knob, which is an engine change, and a decision on whether the
   breach metric or the dollar metric is the thing being optimized - they do not currently disagree,
   but nothing guarantees that further out.

## 8. Could the forecast itself be better? (P83f, user question 2026-08-27)

**How the forecast works today.** `irmaaFwdFactor(inputs)` reads `inputs.cpi` - the number typed in
the CPI box - and projects the threshold forward two years at that constant rate:

```js
const cpi = (inputs && inputs.cpi) || 0;
const increase = Math.pow(1 + cpi, -TAXData.IRMAA.LOOKBACK) - 1;   // LOOKBACK = -2, so (1+cpi)^2
```

All three call sites pass the static `inputs` object. **No simulation state reaches it** - not the
current path year, not a trailing average, not the realized history. On a path where inflation has
run 9% for six years, the plan still projects the threshold forward at 2.8%.

**So: is the constant actually a bad forecast?** Five rules compared on the forward window, analytic,
no `simulate()` call. `lastyear` uses `c[y]`, which the engine does have in hand when the ceiling is
computed; `lastyear-lag` uses `c[y-1]`, which is what a household would actually know, since CPI for
year y is not published until it ends. Both reported, because the generous one is the fair test and
it still loses.

### Historical (block bootstrap)

| rule | undershoot | mean err | sd | p10 err | setback needed |
|---|---|---|---|---|---|
| **typed (today)** | 47.0% | +1.86% | 5.70% | **−3.60%** | **$7,839** |
| lastyear | 51.5% | +0.26% | 7.06% | −7.42% | $16,173 |
| lastyear-lag | 48.5% | +0.32% | 7.98% | −9.42% | $20,536 |
| trailing3 | 51.7% | +0.20% | 6.61% | −7.29% | $15,886 |
| trailing5 | 53.4% | +0.16% | 6.36% | −7.21% | $15,721 |
| oracle | 0.0% | 0.00% | 0.00% | 0.00% | $0 |

### Synthetic-GBM and Synthetic-AAM (identical, see section 1)

| rule | undershoot | mean err | sd | p10 err | setback needed |
|---|---|---|---|---|---|
| **typed (today)** | 46.5% | +0.72% | 4.42% | **−5.00%** | **$10,890** |
| lastyear | 48.3% | +0.12% | 4.33% | −5.35% | $11,661 |
| lastyear-lag | 49.4% | +0.18% | 5.23% | −6.56% | $14,303 |
| trailing3 | 50.5% | +0.14% | 4.40% | −5.32% | $11,591 |
| trailing5 | 50.5% | +0.16% | 4.49% | −5.33% | $11,617 |
| oracle | 0.0% | 0.00% | 0.00% | 0.00% | $0 |

### Stress bank

| rule | undershoot | mean err | sd | p10 err | setback needed |
|---|---|---|---|---|---|
| **typed (today)** | 32.1% | +3.70% | 6.51% | **−2.91%** | **$6,338** |
| lastyear | 51.8% | +0.15% | 6.05% | −9.16% | $19,976 |
| lastyear-lag | 46.3% | +0.23% | 7.44% | −11.27% | $24,562 |
| trailing3 | 51.8% | +0.14% | 6.10% | −7.93% | $17,280 |
| trailing5 | 51.5% | +0.11% | 5.53% | −7.53% | $16,412 |

### The answer: the typed constant is the best practical forecast, and it is not close

**Every adaptive rule is WORSE on the downside tail, in all four path sources.** The p10 undershoot
roughly doubles under `lastyear` on bootstrap (−3.60% to −7.42%) and on stress (−2.91% to −9.16%).

**The mechanism is that the constant is deliberately biased in the safe direction.** Look at the mean
error column: `typed` sits at **+1.86%** on bootstrap and **+3.70%** on stress, meaning realized index
growth usually EXCEEDS what the plan projected. The plan aims low, the threshold rises past it, and
the ceiling turns out to have been conservative - the harmless direction. Every adaptive rule is
conditionally unbiased, mean error +0.12% to +0.32%, and **removing that bias necessarily fattens the
downside tail**. An unbiased forecast is the wrong objective here, because the loss function is
one-sided: an overshoot costs nothing and an undershoot triggers a surcharge cliff.

**The predictable component is also smaller than it looks.** AR(1) persistence is 0.67, which sounds
like it should help, but the forecast is of a TWO-YEAR compounded value against a shock SD of 3.1%.
Two years of fresh shocks dominate the one year of carried-over signal: `lastyear` cuts the standard
deviation on GBM only from 4.42% to 4.33%, and on bootstrap it makes it worse (5.70% to 7.06%),
because a block bootstrap resets the regime at every block boundary, so last year's value predicts
next year's only inside a block.

**What the oracle row is for.** Perfect foresight leaves zero error, so the margin would be pure cost
and the correct setting would be `none` - which is exactly the old constant-CPI regime that
`IRMAA_MARGIN_FIXED_CPI.md` measured. The distance between the `oracle` row and every other row is the
entire value a safety margin can have. It is large, and no forecast rule tested closes any of it.

### So what is the recommended setting, given a reasonable forecast?

**`halfcpi`, and the menu is still short.** Under today's forecast the p10 undershoot needs a setback
of **$6,338 to $10,890** depending on path source. `halfcpi` supplies **$5,518**. It is the largest
mode on the menu and it is still under-sized for the error it is meant to absorb, in every one of the
four sources.

Two caveats on that number, both of which matter:

1. **"Setback needed" is an upper bound on what is required.** It covers the p10 undershoot at the
   threshold, but a breach also needs MAGI to be sitting near the ceiling that year. Most years are
   not near it. The simulated breach counts in section 2 are the real measure; this section explains
   *why* halfcpi wins and why the curve in section 5 has not turned.
2. **p10 is a choice, not a fact.** Covering the median undershoot instead would give a much smaller
   number. Nothing here decides how much protection is the right amount - only that whatever that
   answer is, no available forecast reduces the requirement.

**The practical conclusion is that improving the forecast is not the lever.** A forecast hook -
research input, default off, bit-identical when unset - was scoped and is NOT worth building on this
evidence: the three candidate rules it would have tested all lose to the constant already in place.
That is a cheap analytic pass making an engine change unnecessary, which is the outcome worth having.

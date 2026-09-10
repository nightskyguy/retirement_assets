# Is the Break-Even Tax Rate reliable? Measured across a real mix of households

*(`P116`, 2026-09-10. Harness `.test_harnesses/betr_harness.js`. Measured on the engine at
v11.17b1, after the Split timing default, the ACA-MAGI measurement, the LTCG floor and the
cash-interest true-up.)*

The tool shows a **Break-Even Tax Rate** for every year that converts: the future marginal rate your
heirs would have to pay for that conversion to have been worth doing. It is displayed as a hurdle.
Convert if you expect to be above it, do not if you expect to be below.

This report asks whether that hurdle is in the right place, and it asks it across nineteen
reference households rather than one.

## Reading guide

Define these before reading any table below.

| code | what it is |
|---|---|
| **codeBETR** | what the tool actually shows: `totals.betrAvg`, the average of the per-year Break-Even Tax Rate over every converting year |
| **CF@RMD** | the same closed form recomputed with the horizon the code uses, years until required distributions begin |
| **CF@full** | the same closed form recomputed over the full remaining life of the plan, which is the horizon the formula was published with |
| **t\*** | the **empirical** break-even: the heirs rate at which converting and not converting end in a dead heat in a full simulation, second-order taxes included |
| **the gain curve** | after-tax ending wealth with conversions minus the same plan without them, evaluated at heirs rates of 0%, 15%, 24% and 32% |

Two arms, and the difference between them is the whole comparison.

| arm | what it does |
|---|---|
| **convert** | the household exactly as its plan card defines it |
| **never convert** | the same household with both conversion mechanisms off, so no extra withdrawal happens at all. The most literal reading of "did not convert" |

## Why one household was not enough

`betr_harness.js` has always run on a single household with six overrides on it: a single filer,
long horizon, large IRA. Six variations of one shape cannot separate a property of the metric from a
property of that household, and the claim on the table is about the metric.

It matters here more than usual, because that household turns out to be the unrepresentative one.
See the last section.

## What was measured

Every household in the plan bank, on **its own inputs**, with no override ladder. The point is the
spread of real shapes: state, filing status, horizon, IRA-to-taxable ratio, survivor window.

**Eleven of nineteen are excluded, and each exclusion is printed with its reason rather than
dropped.** The Break-Even Tax Rate is a legacy measure. It answers "what future rate on the
*remaining* IRA justifies this", so it has no finite answer once the IRA is gone at the horizon, and
no answer at all in a plan that never converts.

| excluded because | count |
|---|---|
| the plan converts nothing, so the rate is undefined | 7 |
| the IRA is drained at the horizon, so there is no remaining IRA to tax | 3 |
| the plan does not fund every year, so it is not a plan to rank | 1 |

That leaves **eight scored households**.

## The result: the hurdle is too high in eight of eight

| household | converted | codeBETR | CF@RMD | CF@full | converting at 0-32% | verdict |
|---|---|---|---|---|---|---|
| `aca-gap-years-texas` | $5k | 10.1% | 12.0% | 12.0% | wins at every rate | overstated |
| `age-gap-ira-heavy-ca` | $1,008k | 34.8% | 40.1% | 37.7% | wins at every rate | overstated |
| `bracket-filler-texas-cyclic` | $974k | 20.1% | 21.3% | 20.0% | wins at every rate | overstated |
| `bracket-filler-texas` | $2,780k | 20.5% | 21.3% | 20.0% | wins at every rate | overstated |
| `ira-heavy-couple` | $462k | 21.8% | 20.0% | 20.0% | wins at every rate | overstated |
| `long-widowhood` | $1,609k | 23.5% | 23.9% | 20.8% | wins at every rate | overstated |
| `modest-balances-little-surplus` | $202k | 22.2% | 18.0% | 18.0% | wins at every rate | overstated |
| `single-filer-no-survivor` | $463k | 29.9% | 32.4% | 30.7% | wins at every rate | overstated |

The tool named a hurdle between 10.1% and 34.8%. In every one of the eight, converting was already
ahead at a heirs rate of **zero**, and stayed ahead at 15%, 24% and 32%. A person following the
displayed number would decline a conversion that wins.

The after-tax gain from converting, at each sampled rate:

| household | @0% | @15% | @24% | @32% |
|---|---|---|---|---|
| `aca-gap-years-texas` | +$15k | +$15k | +$15k | +$15k |
| `age-gap-ira-heavy-ca` | +$1,871k | +$1,682k | +$1,569k | +$1,468k |
| `bracket-filler-texas-cyclic` | +$536k | +$630k | +$687k | +$737k |
| `bracket-filler-texas` | +$9,167k | +$9,370k | +$9,492k | +$9,601k |
| `ira-heavy-couple` | +$959k | +$1,002k | +$1,028k | +$1,051k |
| `long-widowhood` | +$4,065k | +$4,084k | +$4,096k | +$4,106k |
| `modest-balances-little-surplus` | +$130k | +$132k | +$134k | +$135k |
| `single-filer-no-survivor` | +$888k | +$898k | +$903k | +$909k |

**The error is one-sided on this bank.** That is worth stating plainly, because the published
write-up says the displayed rate is unreliable "in both directions". Both directions are reachable
in principle, and the next section shows what decides which one you get, but nothing on this bank
came out understated.

The horizon explains only a little of it. `CF@RMD` and `CF@full` differ by at most 3.1 points, so
recomputing the closed form over the right horizon would not close a gap that runs from the named
rate all the way past zero. What the closed form leaves out is the rest of the plan: a smaller
pre-tax IRA also means smaller required distributions, and therefore less Medicare surcharge, less
of the Social Security benefit taxed, and less bracket stacking, every year, for the rest of the
plan. None of that is in a formula that models "money grows, then is taxed once".

## A sign trap that inverts one household, and how it is avoided

`t*` is computed as

```
t* = (netWorth_noconvert - netWorth_convert) / (IRA_noconvert - IRA_convert)
```

and it only means "the rate you must **exceed**" while that denominator is positive, which is to say
while converting **shrank** the terminal IRA. That is the normal case and it is what the harness
header assumed for its whole life.

It is not universal. On `age-gap-ira-heavy-ca` the converting run ends with the **larger** IRA, the
denominator flips sign, and "exceed t\*" silently becomes "stay below t\*". Read without noticing,
that household scores `t* = 148.8%` and looks like a plan that must never convert. Its actual gain
is **+$1.87M at a 0% heirs rate**.

So the verdict in the table above is read off the sign of the gain at each sampled rate, which
cannot invert. `t*` is still printed, with its direction stated beside it.

## The confound: how much of this is the cash drag?

The "never convert" arm banks its surplus, forced distributions included, into low-yield cash.
That drag alone makes converting look good, and it is the confound this repo has been caught by
before. The control is to re-run with a cash reserve set, which reinvests the overflow into the
brokerage instead.

| household | @0%, surplus to cash | @0%, reinvested | did the control bite? |
|---|---|---|---|
| `aca-gap-years-texas` | +$15k | +$14k | bit, sign holds, 3% smaller |
| `bracket-filler-texas` | +$9,167k | +$1,805k | bit, sign holds, 80% smaller |
| `ira-heavy-couple` | +$959k | +$384k | bit, sign holds, 60% smaller |
| `age-gap-ira-heavy-ca` | +$1,871k | +$1,871k | no-op, Cyclic already reinvests |
| `bracket-filler-texas-cyclic` | +$536k | +$536k | no-op, Cyclic already reinvests |
| `long-widowhood` | +$4,065k | +$4,065k | no-op, Cyclic already reinvests |
| `modest-balances-little-surplus` | +$130k | +$130k | no-op, Cyclic already reinvests |
| `single-filer-no-survivor` | +$888k | +$888k | no-op, Cyclic already reinvests |

**The control ran on three of the eight.** Five households have Cycle Brokerage on, which already
sends every surplus dollar to the brokerage, so the reserve arm is the identical run. Counting those
as "the verdict survived a control" would be reporting a control that never executed, so they are
marked no-op instead. The harness detects this from the outcome rather than by reading the flag.

Where it did run, the sign held in all three, but the **size** fell by up to 80%. So the routing
inflates the magnitude of the conversion advantage even where it does not decide it.

## Why the original single household was the wrong one to generalize from

Run the same control on the household this harness has always used, and it does not merely shrink
the gain. It **flips every scenario**:

| scenario | surplus to cash | reinvested |
|---|---|---|
| lump $500k year 0, 6% | wins, +$1,306k | t\* 25%, **loses $117k at 0%** |
| lump $500k year 0, 8% | wins, +$2,964k | t\* 18%, **loses $96k at 0%** |
| lump $500k year 0, 6%, shorter life | wins, +$578k | t\* 39%, **loses $215k at 0%** |
| annual $80k extra, 6% | wins, +$1,515k | t\* 24%, **loses $520k at 0%** |
| annual $80k extra, 8% | wins, +$3,308k | t\* 20%, **loses $487k at 0%** |

On that household, with surplus reinvested, the displayed hurdle of 24.6% to 33.3% is roughly where
the truth is. The metric looked broken there only because the comparison was against a plan parking
its money in cash.

That is the finding this report exists for: **whether the Break-Even Tax Rate reads high, low or
about right depends on where the plan puts a surplus, and the single household the harness used
happens to be the one where the two effects cancel.** One household could not have told you that.

## Verdict

- On eight households measured as their plan cards define them, the displayed Break-Even Tax Rate is
  **too high in all eight**, and converting wins at every heirs rate from 0% to 32%.
- The gap is not the horizon. It is the second-order taxes the closed form does not model.
- Part of the gap is surplus routing rather than the formula. Where the control could run, correcting
  the routing cut the conversion advantage by up to 80% without changing its sign.
- **What this does not support**: "always convert". Three of the eight scored households needed the
  cash-drag control and none of the five Cyclic ones could take it, and on a household outside this
  bank the same control reverses the answer outright.
- The standing advice stands, and is now measured rather than asserted: treat the displayed rate as a
  conversation-starter, and trust the plan's own after-tax ending balances instead.

## Reproducing

```sh
node .test_harnesses/betr_harness.js
```

The household sweep is the second half of the output. The first half is the original
single-household study, kept because the contrast between the two is the point.

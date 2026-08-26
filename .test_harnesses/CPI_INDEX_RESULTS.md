# P70a: bracket indexation under variable inflation

Harness: [`cpi_index_harness.js`](cpi_index_harness.js). Run `node .test_harnesses/cpi_index_harness.js`.
Measured 2026-08-26. 30 plans x 26 stress scenarios x 2 arms = 1,560 simulations, about 1 second.

## The question

`simulate()` runs two inflation clocks:

```
sim.inflation *= (1 + yr.yearInflation);   // the PATH's realized inflation. Drives spending.
sim.cpiRate   *= (1 + inputs.cpi);         // a FIXED scalar. Indexes the whole tax code.
```

Everything bracket-shaped rides `cpiRate`: federal and state bracket limits, the LTCG brackets,
IRMAA thresholds and tiers, the ACA FPL multiple, the IRA goal, QCD sizing, and Social Security
COLA. A path escalating spending at 11% indexes its brackets at 2.5%.

Whether that overstates tax was not answerable by inspection, because the Social Security term
pushes the other way: the same path understates SS income. So this is a measurement.

## Answer

**Fixed indexation overstates tax on high-inflation paths, and the overstatement is large enough to
change whether a plan survives.** It is not a rounding effect and it is not confined to extremes.

| | |
|---|---|
| Lifetime tax across the whole sweep | **-8.32%** under path-following |
| Scenarios where a ruined plan now survives | **38 of 780** |
| Scenarios where a surviving plan now ruins | **0 of 780** |
| Worst single scenario | **-36.7%** tax (MFJ 6.0M, 1973 start, 4.94% realized inflation) |

The asymmetry is the headline. Path-following never broke a plan that had survived. Every outcome
change ran one way: the fixed clock was inventing failures.

## The sign tracks realized-minus-assumed CPI, monotonically

The one number that predicts the delta is how far the realized path came in above the CPI the plan
typed. Nothing else in the ladder matters as much.

| realized minus assumed | n | mean tax delta | n cheaper | n dearer |
|---|---|---|---|---|
| under by >1pt | 10 | **+1.27%** | 1 | 9 |
| under by 0-1pt | 100 | **+1.38%** | 33 | 67 |
| over by 0-1pt | 100 | **-0.97%** | 60 | 40 |
| over by 1-3pt | 460 | **-9.09%** | 407 | 53 |
| over by >3pt | 110 | **-11.92%** | 107 | 3 |

Monotone across all five buckets, sign flip exactly where it should be, and the tails are nearly
unanimous: 107 of 110 cheaper when the path ran more than 3 points hot, 9 of 10 dearer when it came
in more than a point cold.

The mechanism is visible in the drift: on a 1966 start, the fixed clock reaches a cumulative CPI
factor of 1.78 by the last plan year while the path reaches 4.70. **2.65x.** Every threshold in the
tax code was sitting at 38% of where the path's own price level would have put it.

## Which plans it moves

| plan | mean tax delta | median | IRMAA surcharge years |
|---|---|---|---|
| MFJ 3.0M, IRMAA tier 1, cpi 2.0% | **-14.36%** | -10.81% | -105 |
| MFJ early, ACA 400% FPL, cpi 2.0% | **-14.27%** | -9.47% | -204 |
| MFJ 6.0M, bracket-fill 24%, cpi 2.0% | **-12.95%** | -8.97% | -9 |
| single 2M, IRMAA tier 1, cpi 2.0% | -8.76% | -8.72% | -9 |
| MFJ 1.2M, bracket-fill 24%, cpi 3.0% | **-1.25%** | -0.73% | -17 |

Two readings:

- **The lower the assumed CPI, the worse the distortion.** Every family's delta shrinks
  monotonically as the typed cpi rises from 2.0% to 3.0%, because a higher assumption leaves less
  room between the two clocks. A user who types a conservative 2% inflation gets the most distorted
  answer, which is the opposite of what "conservative" is supposed to buy.
- **Cliff-shaped ceilings move more than ramp-shaped ones**, in percentage terms, at the same asset
  level: MFJ 3.0M loses 14.4% aiming at an IRMAA tier and 6.6% doing bracket-fill. Falling off a
  tier costs a whole step; overshooting a bracket top costs the rate difference on the last slice.

The dollar effect is still largest on the biggest portfolio (MFJ 6.0M, mean -$480,242) - it has the
most income to push through creeping brackets - and smallest on MFJ 1.2M (mean -$6,142), which
spends much of the plan below the first threshold that moves.

## Where the rescued scenarios are

All 38 sit in high-inflation windows: **realized inflation CAGR 4.71% to 5.38%**, which is the
1962-1974 band of the record. Thirty-five of the 38 are the early-retiree household, which has the
longest exposure - a 30-year horizon with five pre-Medicare years and no Social Security until 70,
so more of its life is spent with the two clocks far apart.

Three more scenarios ruined under both arms but ruined **8 years later** under path-following
(MFJ early, 1966 start: 2046 to 2054).

## Two findings that were not predicted

**IRMAA dollars moved less than IRMAA years.** Surcharge years fell 10.56%, but surcharge dollars
fell only 6.51%. The tier ladder is indexed by `cpiRate`, so path-following lifts the thresholds and
fewer years land on a surcharge - but `medicareRate` follows the same clock in this arm, so the
premium each remaining surcharge is priced against inflates faster too. The two partly cancel. Any
future default change should expect the IRMAA saving to be roughly half what the tier counts suggest.

**Zero ACA breaches, in both arms, across all 78 ACA-capped runs** - and the ACA plans still carry
the largest mean tax delta in the study (-12.31%). The cap was never breached because the plan
tracked it. That is the point: the ACA effect is a moved *ceiling*, not a breach count, and a study
that reported only breaches would have concluded indexation does not reach the ACA cap.

## Predictions, scored

Recorded in the harness header before any number was looked at.

| | prediction | outcome |
|---|---|---|
| P1 | sign tracks realized-minus-assumed CPI | **confirmed**, monotone over five buckets |
| P2 | net direction in the windows that matter is less tax | **confirmed**; the SS offset never reverses it |
| P3 | IRMAA tier-years move more, proportionally, than total tax | **confirmed** on years (-10.6% vs -8.3%), **refuted on dollars** (-6.5%), for the `medicareRate` reason above |
| P4 | at least one window changes its outcome band | **confirmed**, 38 of them |
| P5 | largest effect on 6.0M, smallest on 1.2M | **split**: largest in dollars on 6.0M, but largest in percent on the tier-1 and ACA plans; smallest on 1.2M as predicted |

## What this does not settle

- **No default was changed.** `cpiFollowsPath` is off everywhere in the product. This phase measured.
- **Forecasting stayed fixed in both arms.** `irmaaFwdFactor()` and the ACA one-year lookahead still
  project at the typed `cpi`, because those are the plan predicting an index it cannot know.
  Path-aware indexation is not clairvoyance. A separate question is whether a plan should forecast
  from its own realized history.
- **`medicareRate` follows the path in the test arm**, carrying `inputs.inflation` as a fixed
  excess-medical spread. The IRMAA-dollar finding above is a direct consequence, and an arm that
  froze the premium clock would report a larger IRMAA saving and a slightly different tax total.
- **One state (CA), one stress mode (`combined`, 26 windows), one horizon (30 years).** The sign
  test is strong enough that the direction is not in doubt, but the magnitudes are this ladder's.

## The trap waiting for whoever changes the default

A deterministic run has no `inflationSequence`, so `yr.yearInflation` falls back to
`inputs.inflation` - **not** to `inputs.cpi`. With the flag on, that makes the indexation clock
follow the user's *spending* rate. Measured on a plain sidebar run with no path at all:

| typed rates | flag on vs off | lifetime tax |
|---|---|---|
| cpi 2.5% = inflation 2.5% | byte-identical | 1,641,473 both |
| cpi 2.0% < inflation 3.5% | **differs** | 1,832,405 -> 1,665,452 (-9.1%) |
| cpi 3.5% > inflation 2.0% | **differs** | 1,535,319 -> 1,630,461 (+6.2%) |

Typing different CPI and inflation rates is ordinary and legal. So turning path-following on by
default would silently reindex those plans too, not just Monte Carlo and Stress runs. Whether the
no-sequence fallback should be `inputs.inflation` or `inputs.cpi` is a decision to take explicitly:
`cpi` is the user's stated indexation rate and `inflation` is their spending rate, which argues for
`cpi` and for confining the change to paths.

## Incidental: a degenerate config returns NaN rather than throwing

`strategy: 'bracket'` with `stratRate: 0`, no `stratIRMAATier` and no `stratACAMultiple` gives
`computeBracketCeiling` no rate to find a limit for. The run completes and returns `NaN` totals and
a log full of nulls, silently. The first version of this harness inherited that config from
`irmaa_cpi_risk_harness.js`'s `BASE` - which never meets it, because every plan there overrides it
with a tier - and produced a full page of plausible-looking zero deltas before the NaN was spotted.
The harness now asserts every arm's totals are finite. The engine behavior is unchanged and out of
scope for P70.

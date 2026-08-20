# IRMAA margin under CPI forecast error

`node .test_harnesses/irmaa_cpi_risk_harness.js`. 12 plans x 6 modes = 72 simulations, each
re-billed in 68 realized CPI worlds = **4,896 plan-world pairs**. Plan assumes CPI 2.5%.

This is the measurement [IRMAA_MARGIN_RESULTS.md](IRMAA_MARGIN_RESULTS.md) could not make. It
**reverses that round's recommendation**, and the reversal is the point of the file.

---

## 1. Why Monte Carlo and the Stress Test cannot do this

They vary the wrong inflation.

```js
sim.cpiRate   *= (1 + inputs.cpi);        // CONSTANT, every run, every path
sim.inflation *= (1 + yr.yearInflation);  // path-varying, from inputs.inflationSequence
```

`inflationSequence` drives **spending** inflation. The CPI that indexes the IRMAA ladder is a scalar
and never varies. Verified directly: feeding the 1971-2000 CPI record (peaking at 12.3%) as an
`inflationSequence` changes `spendGoal` and `MAGI` in every year and leaves `BracketTarget`
**byte-identical** to a flat-3% run.

## 2. The trick that avoids touching the simulator

Decide under the assumed CPI, bill under a realized one.

1. Run `simulate()` once with `cpi = assumed`. That is the plan deciding in good faith: the MAGI it
   chose each year and the tier it aimed at.
2. Re-bill those same MAGIs in post against thresholds indexed by a **realized** CPI path, using the
   pure exported lookups. No engine change, and the realized paths can be the actual CPI-U record.

Step 1 does not depend on the realized path, so N realized worlds cost one simulation rather than N.
72 sims cover 4,896 pairs.

**Not modeled: feedback.** A larger realized surcharge is a larger real bill, which would slightly
move later balances and hence later MAGI. Second-order for counting breaches, and capturing it is
exactly the engine change this avoids. Breach counts are exact; dollar totals are first-order.

## 3. Only an undershoot hurts, and the asymmetry is total

Breaching years, summed over 12 plans. Plan assumed 2.5%:

| realized CPI | halfstep | none | flat1000 | flat2000 | halfcpi | cpiminus1 |
|---|---|---|---|---|---|---|
| 0.0% | 100 | 105 | 104 | 99 | **89** | 92 |
| 1.0% | 87 | 92 | 92 | 85 | **71** | 74 |
| 1.5% | 71 | 82 | 73 | 71 | **51** | 60 |
| 2.0% | 40 | 49 | 45 | 42 | **23** | 26 |
| 2.5% (as assumed) | 0 | 0 | 0 | 0 | 0 | 0 |
| 3.0% | 0 | 0 | 0 | 0 | 0 | 0 |
| 4.0% | 0 | 0 | 0 | 0 | 0 | 0 |
| 6.0% | 0 | 0 | 0 | 0 | 0 | 0 |

**Zero breaches at or above the assumed rate, in every mode.** An overshoot runs the threshold away
upward and leaves the plan with unused room. Only a shortfall bites. That single fact is the entire
case for an IRMAA safety margin, and it also says what shape the margin should have.

Extra IRMAA paid versus what the plan assumed, same worlds:

| realized CPI | none | halfcpi | saved by halfcpi |
|---|---|---|---|
| 0.0% | $707,395 | $645,107 | $62,288 |
| 1.0% | $457,079 | $386,441 | $70,638 |
| 1.5% | $358,782 | $261,774 | $97,008 |
| 2.0% | $177,302 | $108,299 | $69,003 |
| 3.0% | -$71,602 | -$86,066 | (both save) |

## 4. The historical record: 60 rolling 40-year CPI-U windows, 1928 onward

| mode | breach yrs | of eligible | rate | windows hit | extra IRMAA |
|---|---|---|---|---|---|
| none | 1551 | 9600 | **16.16%** | 29/60 | -$12,631,518 |
| flat1000 | 1497 | 9600 | 15.59% | 28/60 | -$13,189,553 |
| flat2000 | 1420 | 9480 | 14.98% | 28/60 | -$13,234,308 |
| halfstep | 1415 | 9480 | 14.93% | 28/60 | -$13,330,454 |
| cpiminus1 | 1180 | 9240 | 12.77% | 27/60 | -$14,862,209 |
| **halfcpi** | 1089 | 9180 | **11.86%** | 27/60 | -$15,541,123 |

Extra IRMAA is negative overall because most historical windows run **above** 2.5%, so the ladder
outruns the plan and it pays less than it budgeted. The risk is concentrated in the minority of
windows that undershoot: 29 of 60 produce any breach at all.

## 5. This reverses the constant-CPI recommendation

[IRMAA_MARGIN_RESULTS.md](IRMAA_MARGIN_RESULTS.md) section 7 said to drop `halfcpi` and `cpiminus1`
as "the most expensive modes that buy the same nothing". That was correct **for a world with no CPI
uncertainty**, which is the only world that harness could build. With uncertainty admitted:

- **They are the only correctly shaped settings.** A CPI forecast error is proportional, so the
  setback that absorbs it must be proportional too. A rate haircut stays the same relative size for
  the whole plan; a flat dollar setback decays to irrelevance as thresholds inflate.
- **The dollar settings barely work.** At realized 1%: `flat1000` prevents 0 of 92 breaches,
  `flat2000` prevents 7.
- **The current default is nearly useless.** `halfstep` prevents 5 of 92 at realized 1% (87 vs 92).
  A half-tier-step setback is $1,000 to $2,500; two years of a 1.5-point CPI miss on the $274,000
  MFJ Tier 2 floor is about $8,300. It is undersized by roughly 4x.

Honest limit: even the best mode only cuts breaches by about 23%. `halfcpi`'s setback at 2.5%
assumed CPI is around $6,900 on that same threshold, still short of a large miss. **No offered
setting is sized for a serious undershoot.**

## 6. What to do

1. **Consider changing the default from `halfstep` to `cpiminus1`.** It is the right shape, it cuts
   breaches ~20%, and it is the milder of the two rate haircuts. Not done here: the default moves
   every existing plan's numbers and that is the maintainer's call, not a measurement's.
2. **Keep `halfcpi` and `cpiminus1`.** The previous round's advice to remove them was drawn from a
   model that had no uncertainty in it.
3. **Reconsider `flat1000` / `flat2000`.** They cost ceiling room and prevent almost nothing, and
   their relative bite decays every year of the plan.
4. **A margin only insures the undershoot.** Worth saying in the UI: the setting buys nothing if
   inflation meets or beats your assumption, which is what 31 of 60 historical windows did.
5. **Still ahead of all of this: the widow gap.** Both constant-CPI rounds found every breach there
   was the MFJ-to-Single transition, which no margin can close and which is larger than any CPI
   error measured here. Project the filing status forward first.

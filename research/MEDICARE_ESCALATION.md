# How fast do Medicare premiums grow, and which model should the tools use?

*(Measured 2026-09-24. No engine version: this study reads a data series, not a plan.)*

Five tools in this repository project Medicare premiums and IRMAA surcharges forward, and each one
grows them a different way. Nobody decided that; it accumulated.

| tool | how it grows Medicare dollars | rate on defaults |
|---|---|---|
| `retirement_optimizer.html` (via `optimizer_core.js`) | `cpi + inflation`, compounded yearly | 5.8% |
| `Retirement_Projection.html` | `TAXData.IRMAA.ANNUAL_INCREASE`, its only live reader | 5.6% |
| `standalone/IncomeTaxPlanner.html` | its own slider, applied alone | 2.5% |
| `standalone/FutureCost.html` | its own two sliders, `inflation + extra` | 5.0% |
| `standalone/irmaa_and_rmds.html` | passes 1, deliberately no growth | none |

This report answers three questions, in the order they have to be answered:

1. **Which growth model fits the record?** A fixed rate wins every window, but the win is narrow and
   the fitted value is hostage to the window: 6.60% over five years, 5.36% over ten, 4.45% over
   twenty. The more useful finding is that **CPI carries no signal at all**, and the mechanism that
   destroys it runs in the opposite direction from what a CPI-linked model assumes.
2. **Can the 8.5% figure be accommodated?** No, and it should not be. It is aggregate Part B
   *spending*, not a premium. The Trustees' own premium path over the same window grows **5.93%**.
3. **Which model should ship?** Not a flat rate. The officially projected future has two phases, so
   a one-phase model is wrong at one end or the other by construction. Even the **best possible**
   flat rate carries a path error of 6.94%, against 2.96% for a two-phase model.

Harness:
[`medicare_escalation_harness.js`](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/medicare_escalation_harness.js).
It loads neither the engine nor a household; the only repository file it reads is the CPI series
that the Monte Carlo tab already ships.

---

## Reading guide

Everything below is written in these codes. None of them appear before this point.

### The models

`g` is the growth rate of the Part B standard premium in a year. `cpi` is the CPI-U rate. Each model
has one free parameter or none, so no model wins on flexibility.

| code | form | what it assumes | who computes it today |
|---|---|---|---|
| **M1** | `g = a` | premiums grow at a constant rate, unrelated to prices | `ANNUAL_INCREASE`; IncomeTaxPlanner |
| **M2** | `g = cpi + b` | premiums grow a constant amount faster than prices | Optimizer `cpi + inflation`; FutureCost |
| **M3** | `g = k * cpi` | premiums are a fixed multiple of price growth | nobody; included as the third shape |
| **M4** | `g = 0` | premiums do not grow | `irmaa_and_rmds`, on purpose |
| **TP** | `g(t) = gLong + (g0 - gLong) * d^t` | a near-term ramp converging on a long-run rate | nobody yet; this report's recommendation |

**M2 is the same model whether it is written as "a fixed rate above inflation" or as "cpi plus
inflation".** Both compute `cpi + b`. They differ only in where `b` comes from, so there are three
distinct shapes among the tools, not four.

### The windows and the two questions they answer

| code | what it is |
|---|---|
| **fit window** | the trailing 5, 10 or 20 years of actual premiums, used to fit each model |
| **RMSE(rate)** | root mean squared error of predicted against actual annual growth. Answers "does this model describe the past?" |
| **benchmark** | the forward series each model is scored against: the Trustees' own published premium path for 2027 to 2035, then their long-run Part B assumption of 3.8% out to 2056 |
| **30y total** | total premium dollars one person pays over 30 years under the model, against the same total under the benchmark. Answers "does this model get a retirement right?" |
| **RMSE(path)** | root mean squared relative error of the yearly premium level against the benchmark |

**RMSE(rate) and 30y total are different questions and they have different answers.** A retirement
projection does not need to reproduce 2016. It needs the dollars.

### Timing

The premium for year *t* is announced in the autumn of *t-1*, and the hold-harmless cap is that
year's Social Security COLA, computed from CPI-W through the third quarter of *t-1*. So growth in
year *t* is paired with **CPI(t-1)** throughout. Pairing it with CPI(t) would test a relationship
that cannot exist.

### Sources

All verified 2026-09-24.

| series | source |
|---|---|
| Part B standard premium, 2003 to 2026 | [SSA POMS HI 01001.014](https://secure.ssa.gov/poms.nsf/lnx/0601001014), the "Base" row |
| Part B premium projected, 2027 to 2035 | [2026 Medicare Trustees Report](https://www.cms.gov/oact/tr/2026), Table V.E2 |
| Part B long-run per-capita growth | 2026 Trustees: GDP per capita plus 0.1 to 0.3 points, about 3.8% |
| Part B aggregate spending, 2026 to 2030 | 2026 Trustees: 8.5% a year ([CRFB analysis](https://www.crfb.org/papers/analysis-2026-medicare-trustees-report)) |
| CPI-U, December over December | `montecarlo/historical_returns.js`, the repository's own BLS series |

---

## 1. The record, and why CPI is not in it

Twenty-three years of Part B standard premium growth beside the CPI that set it:

| year | premium | growth | CPI(t-1) | year | premium | growth | CPI(t-1) |
|---|---|---|---|---|---|---|---|
| 2004 | 66.60 | 13.46% | 1.90% | 2016 | 121.80 | **16.11%** | **0.70%** |
| 2005 | 78.20 | 17.42% | 3.30% | 2017 | 134.00 | 10.02% | 2.10% |
| 2006 | 88.50 | 13.17% | 3.40% | 2018 | 134.00 | 0.00% | 2.10% |
| 2007 | 93.50 | 5.65% | 2.50% | 2019 | 135.50 | 1.12% | 1.90% |
| 2008 | 96.40 | 3.10% | 4.10% | 2020 | 144.60 | 6.72% | 2.30% |
| 2009 | 96.40 | 0.00% | 0.10% | 2021 | 148.50 | 2.70% | 1.40% |
| 2010 | 110.50 | 14.63% | 2.70% | 2022 | 170.10 | 14.55% | 7.00% |
| 2011 | 115.40 | 4.43% | 1.50% | 2023 | 164.90 | **-3.06%** | **6.50%** |
| 2012 | 99.90 | -13.43% | 3.00% | 2024 | 174.70 | 5.94% | 3.40% |
| 2013 | 104.90 | 5.01% | 1.70% | 2025 | 185.00 | 5.90% | 2.90% |
| 2014 | 104.90 | 0.00% | 1.50% | 2026 | 202.90 | 9.68% | 2.70% |
| 2015 | 104.90 | 0.00% | 0.80% | | | | |

### Fit, by window

| window | M1 fixed | M2 CPI + excess | M3 multiple | M4 flat |
|---|---|---|---|---|
| 5 years, 2021 to 2026 | **5.78%** | 6.17% | 6.42% | 8.77% |
| 10 years, 2016 to 2026 | **5.02%** | 5.06% | 5.32% | 7.34% |
| 20 years, 2006 to 2026 | **6.64%** | 6.75% | 6.96% | 8.00% |

M1 wins all three, and by almost nothing at ten years (5.02 against 5.06). Two things matter more
than the ranking.

**The fitted value depends entirely on the window.** Fitted `a` is 6.60%, 5.36% and 4.45% over five,
ten and twenty years; the realized CAGRs are 6.44%, 5.24% and 4.24%. There is no such thing as "the"
historical rate, and a shorter window gives a higher one. Anyone quoting a single historical figure
is quoting their choice of window.

**No model fits the path.** RMSE of 5 to 7 percentage points, on a series whose mean growth is about
5%, means every model is only estimating a level. The year-to-year movement is policy, not economics.

### CPI carries no signal in any window

Regressing `g = alpha + beta * cpi(t-1)`. M2 assumes `beta = 1`; M1 assumes `beta = 0`.

| window | beta | standard error | t | R-squared |
|---|---|---|---|---|
| 5 years | **-0.18** | 1.79 | -0.10 | 0.003 |
| 10 years | 0.44 | 0.95 | 0.46 | 0.026 |
| 20 years | 0.24 | 0.93 | 0.26 | 0.004 |

`beta = 1` is not supported in any window. `beta = 0` is never rejected in any window. Over five
years the point estimate is **negative**.

**The mechanism explains the sign, and it runs backwards from what M2 assumes.** Hold harmless caps
a beneficiary's premium increase at their Social Security COLA. When the COLA is small, most
beneficiaries are protected, so the entire cost increase must be recovered from the minority who are
not, and the *standard* premium rises steeply. Low CPI produces a high standard premium increase.

- **2016**: CPI 0.70%, premium **+16.11%**
- **2023**: CPI 6.50%, premium **-3.06%**

This is not noise around a positive relationship. It is a negative mechanical link that a CPI-plus-
excess model has the wrong sign on. That the Optimizer's `cpi + inflation` lands near a defensible
number is a coincidence of its default inputs, not a model that holds.

---

## 2. The 8.5% is not a premium figure

The 2026 Trustees Report projects **aggregate Part B spending** to grow 8.5% a year from 2026 to
2030. The 2025 report said 8.8%; the 8.5% supersedes it.

Over that same window, the Trustees' own **premium** path grows **5.93%**. The gap of 2.57 points a
year is enrollment growth plus the general-revenue share of Part B financing. A retiree pays neither.

| what | rate | window |
|---|---|---|
| aggregate Part B spending | 8.50% | 2026 to 2030 |
| standard premium | 5.93% | 2026 to 2030 |
| standard premium | 6.60% | 2026 to 2035 |
| standard premium | 7.02% | 2027 to 2035, excluding the unusually flat 2027 |

Used as a premium escalator, 8.5% reaches **$2,345 a month by 2056** and overstates the 30-year
premium bill by **92%**. Any future pass tempted to "correct" a premium rate toward a published cost
growth figure should read this section first.

---

## 3. Forward: no flat rate can carry both ends

Every model fitted on 20 years of history and projected to 2035 undershoots the Trustees badly:
M1 reaches $300 against their $360.60, which is **-16.7%**. To match them you need 6.60%, above even
the five-year record.

Scored on the benchmark, one person, 2027 to 2056:

| model | 2035 | error | 2056 | error | 30y total | error | RMSE(path) |
|---|---|---|---|---|---|---|---|
| **TP, 6.6% to 3.8%, d = 0.90** | $334 | -7.3% | $803 | **+1.7%** | $169,210 | **-0.8%** | **3.0%** |
| TP, d = 0.92 | $339 | -6.1% | $845 | +7.0% | $174,736 | +2.5% | 4.0% |
| flat 4.84%, the 2010 to 2035 blend | $310 | -13.9% | $838 | +6.2% | $165,008 | -3.2% | 7.2% |
| flat 5.24%, the 10-year record | $321 | -10.9% | $939 | +19.0% | $177,427 | +4.1% | 8.6% |
| CPI + 2.13% excess | $302 | -16.2% | $766 | -2.9% | $156,060 | -8.5% | 9.9% |
| **flat 5.60%, `ANNUAL_INCREASE` today** | $331 | -8.1% | $1,040 | **+31.8%** | $189,514 | **+11.1%** | 13.9% |
| flat 4.24%, the 20-year record | $295 | -18.2% | $705 | -10.6% | $148,189 | -13.1% | 13.4% |
| **flat 5.80%, the Optimizer's default** | $337 | -6.5% | $1,101 | **+39.5%** | $196,627 | **+15.3%** | 17.6% |
| flat 6.60%, fits 2035 exactly | $361 | 0.0% | $1,380 | +74.9% | $228,217 | +33.8% | 35.1% |
| **flat 2.50%, IncomeTaxPlanner today** | $253 | -29.7% | $426 | -46.1% | $109,567 | **-35.7%** | 34.1% |
| flat 8.50%, aggregate spending | $423 | +17.3% | $2,345 | +197.2% | $328,145 | +92.4% | 93.2% |

A flat rate fitted to the near term overshoots 2056 by 75%. A flat rate fitted to the long run
undershoots the next decade, which is where a conversion decision is actually made.

**The best possible flat rate is still twice as wrong as the two-phase.** Solving for the single rate
that fits the benchmark best gives **5.02%** to match the 30-year total exactly, or **4.95%** to
minimize path error, and that best case still carries **RMSE(path) 6.94%** against **2.96%** for the
two-phase at its own optimum of `d = 0.903`. The two-phase does not win because a lucky decay was
picked; it wins because it has the right shape.

### The objection, and the answer

**Objection:** the benchmark is itself two-phase, so of course a two-phase model wins.

**Answer:** the benchmark is not invented. Its first nine years are the Trustees' published
projections and its tail is the Trustees' published long-run assumption. If the officially projected
future has two phases, then a one-phase model is wrong at one end or the other, and the size of that
error is what the table measures. The asymmetry is the finding, not an artifact of it.

---

## 4. The result that decides it

Section 3 scores models against a benchmark whose tail is an assumption. If the ranking only holds
at 3.8%, it is worthless. It does not depend on it.

**30-year total error as the long-run assumption moves:**

| model | tail 3.0% | 3.8% | 4.5% | 5.0% | 5.6% |
|---|---|---|---|---|---|
| **TP, d = 0.90** | **-1.2%** | **-0.8%** | **-0.5%** | **-0.3%** | **-0.1%** |
| TP, d = 0.92 | +2.9% | +2.5% | +2.0% | +1.6% | +1.1% |
| flat 4.84% | +4.5% | -3.2% | -9.7% | -14.2% | -19.4% |
| flat 5.24% | +12.4% | +4.1% | -2.9% | -7.7% | -13.3% |
| flat 5.60% | +20.1% | +11.1% | +3.7% | -1.5% | -7.4% |
| flat 5.80% | +24.6% | +15.3% | +7.6% | +2.2% | -3.9% |
| flat 6.60% | +44.6% | +33.8% | +24.8% | +18.7% | +11.5% |
| CPI + 1.91% | -4.9% | -12.0% | -17.9% | -22.0% | -26.7% |

The two-phase model stays within **1.2%** across the whole range. Every flat rate swings 25 points or
more, and each one is only right at the single tail value that happens to suit it: 4.84% needs a 3.4%
tail, 5.60% needs 4.8%, 5.80% needs 5.2%.

**This robustness is structural, not empirical, and that is the point.** A two-phase model takes the
long-run rate as a parameter, so it converges on whatever is assumed and the assumption becomes a
visible input instead of being baked invisibly into a single number. A flat rate has to be the ramp
and the tail at once, and cannot be both.

---

## 5. What this means for the code

**The number is worth changing, not only the plumbing.** An earlier read of this question concluded
that 5.6% and 5.8% were defensible and the work was unification. That was right about the historical
windows, where both sit inside the range, and wrong about the forward bill: both overstate the
30-year premium stream by 11% to 15% and the 2056 premium by 32% to 40%, because a flat rate cannot
decay. The two claims are about different questions and only the second one governs a projection.

| finding | consequence |
|---|---|
| CPI carries no signal, and hold harmless gives it the wrong sign | `cpi + inflation` is not a model. Keep it as the Optimizer's default for continuity if saved plans require it, but do not describe it as one. |
| the shape is two-phase | the shared constant should be `gLong + (g0 - gLong) * d^t`, with `gLong` the exposed knob |
| `g0 = 6.6%`, `d = 0.90`, `gLong = 3.8%` | published 2026 to 2035 CAGR; decay fitted to the benchmark at 0.903; Trustees' long-run assumption |
| if one flat rate must be kept | **5.02%**, not 5.6% and not 5.8% |
| IncomeTaxPlanner's 2.5% | understates the 30-year bill by 35.7%. It is also applied alone while its own label promises "bracket inflation plus this rate". |
| 8.5% is aggregate spending | never a premium escalator, in code or in a comment |

### What this report does not establish

- **`d` is not measured against data.** No published year-by-year premium path exists past 2035, so
  the decay constant is fitted to a benchmark that is itself part projection and part assumption
  beyond that year. What is measured is that the *shape* matters more than the constant: every
  reasonable `d` from 0.85 to 0.95 beats every flat rate on path error.
- **The long-run 3.8% is an assumption**, the Trustees' own. Section 4 exists precisely because this
  report should not rest on it, and shows the recommendation does not.
- **Nothing here is about IRMAA thresholds**, which index at CPI and are a separate axis. The two are
  separate arguments to `calcIRMAA` for that reason.
- **Hold harmless is not modeled anywhere in this repository.** It is the mechanism behind the
  largest single-year moves in section 1, it compresses what an individual actually pays relative to
  the standard premium, and no tool here represents it.

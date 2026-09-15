# Risk-based spending guardrails

Whether the guardrail rule published by Derek Tharp and Justin Fitzpatrick - spend to a target
**probability of success**, adjust when that probability crosses a rail - can be computed on this
engine, what it costs, and where it disagrees with the Guardrails rule the tool already ships.

Section 6 answers a question the comparison kept raising and the article did not ask: how far the
shipped rule is from **Guyton-Klinger as published**. Four divergences, and the first one - the rate
it tests - is what makes the hatchet invisible to it.

Produced by [`.test_harnesses/rbg_harness.js`](../.test_harnesses/rbg_harness.js) on engine
v11.1823 (`1842270`), 2026-09-15. Every number below is printed by that script; nothing here is
estimated by hand.

---

## Reading guide

### The source

Derek Tharp and Justin Fitzpatrick, *"The Retirement Distribution 'Hatchet': Using Risk-Based
Guardrails To Project Sustainable Cash Flows"*, Kitces.com, 24 November 2021. Two claims matter
here.

The **hatchet** is the shape of a real retiree's portfolio draw: high in the years between
retirement and a deferred Social Security benefit (the blade), a permanent drop when the benefit
starts, then a slow decline as real spending falls with age (the handle). The article's own example
household draws 6.7% initially and $10,500/year at 90.

The **rule** replaces the withdrawal rate with the risk of the whole plan, and the article states it
as a four-step recipe: solve for the spending that hits a target probability of success; choose an
upper and a lower rail; find the portfolio values that would put the plan on those rails *today*, so
the rails can be given to the household in dollars rather than percentages; solve for the spending
that returns the plan to target at each rail. The article names two parameter sets and invents no
others; both are used here, unchanged.

### Codes

| code | meaning |
|---|---|
| **PoS** | probability of success: the share of Monte Carlo paths in which `totals.success` is true, i.e. every year of the plan is funded |
| **the shipped rule** | `spendRule: 'gk'`, the Guyton-Klinger spend adjustment the tool labels **Guardrails** (`optimizer_core.js:2037`). Trigger: `spendGoal / start-of-year portfolio` against that same ratio in year 0, band `1 ± gkGuard` (0.20), step `gkAdjPct` (10%) |
| **rails A** | the article's implementation recipe: target **90%** PoS, raise at **99%**, cut at **70%** |
| **rails B** | the article's income-risk framing: "target an initial income risk of 20% … increase at 0% … decrease at 60%", read as PoS: target **80%**, raise at **100%**, cut at **40%** |
| **at its target** | the rail measured from the spending that rule would have the household on - the target-PoS number, not the plan's own |
| **at the plan's own spend** | the same rail measured from the spending the household already has, which is what the shipped rule judges. The controlled comparison |
| **first-year return** | the single market return in year 1 at which a rule first acts, found by bisection. One number that both rules can be asked for |
| **published GK** | Guyton-Klinger as published - Guyton 2004, and Guyton and Klinger, "Decision Rules and Maximum Initial Withdrawal Rates", *Journal of Financial Planning*, March 2006. Four rules: a portfolio-management rule for where withdrawals come from, an inflation rule that skips the CPI raise after a negative-return year while the current rate is above the initial one, a capital-preservation rule cutting 10% when the rate rises 20% above its initial value (suspended in the final 15 years), and a prosperity rule raising 10% when it falls 20% below |
| **the published ratio** | the rate published GK tests: **portfolio withdrawals** divided by the portfolio, against that same ratio in year 0. Distinct from the shipped rule's ratio, which divides **total spending** by the portfolio. The engine computes both; `yr._wdRate` (`optimizer_core.js:4447`), the `wdRate%` column, is the published one |
| **re-plan** | a plan restarted mid-run: `startInYear`/`startYear` moved forward, balances replaced with the ones the realized year produced, real spending unchanged. Ages and horizon follow from the birth years |

### The households

Four from the plan bank, all with the hatchet's shape - retirement years before a deferred benefit.

| household | retires | benefits at | portfolio | plan spend | plan years | draw | state |
|---|---|---|---|---|---|---|---|
| [`bracket-filler-texas`](../plans/bracket-filler-texas.js) | 64 | 70 / 67 | $3,100,000 | $110,000 | 33 | bracket | TX |
| [`mixed-portfolio-couple`](../plans/mixed-portfolio-couple.js) | 64 | 70 / 67 | $3,900,000 | $234,000 | 33 | propwd | CA |
| [`long-widowhood`](../plans/long-widowhood.js) | 65 | 70 / 67 | $3,620,000 | $150,000 | 38 | fixed, Cycle Brokerage on | TX |
| [`age-gap-ira-heavy-ca`](../plans/age-gap-ira-heavy-ca.js) | 65 | 70 / 70 | $4,414,000 | $220,000 | 25 | fixed, Cycle Brokerage on | CA |

The four differ in draw strategy and state as well as in shape, which is deliberate: both rules sit
on top of whatever draw the plan already uses, and a result that held only under one strategy would
be a result about that strategy.

`age-gap-ira-heavy-ca` is the only one carrying a planned real-spending decline (`spendChange`
-1%/year), which is the handle of the hatchet. Every spending comparison below is scored against
each household's **own planned real path**, year by year, so that decline is never counted as a
rule's doing.

### The grid

| knob | value |
|---|---|
| model | synthetic GBM, mu 7%, sigma 12% - the page's own `#mc-mu` / `#mc-sigma` defaults |
| paths | 200 per probability estimate, one seed (42), common random numbers across every arm of a household |
| bisection | 9 steps, which puts a spending answer inside ~0.4% of its bracket |
| the shock | -22% then -13% in years 2-3 (the 2000-2002 shape), then the plan's own growth |

---

## What it found

### 1. The recipe runs on this engine unchanged, at a measurable price

All four steps are already available: `simulate()` scores a path, `buildBanks` / `buildPathInputs`
(`montecarlo/mc_engine.js:198`, `:45`) produce the paths, and bisection over spending or over
starting balances does the rest - the same shape as `optimizeSpend` (`optimizer_core.js:5436`),
against a probability instead of a pass/fail. Nothing new had to be added to the engine to produce
every table in this report.

| household | plan years | engine runs | seconds | ms/run |
|---|---|---|---|---|
| `bracket-filler-texas` | 33 | 18,400 | 22.6 | 1.23 |
| `mixed-portfolio-couple` | 33 | 22,000 | 26.7 | 1.21 |
| `long-widowhood` | 38 | 22,000 | 32.0 | 1.45 |
| `age-gap-ira-heavy-ca` | 25 | 20,200 | 19.9 | 0.99 |

The run count is exact and the seconds are not: seed 42 reproduces every probability in this report
run for run, while wall clock moved **0.99 to 2.15 ms/run across four repeats** on the same machine.
Plan against the run count, not the clock.

One probability estimate is 200 engine runs; one spending or rail answer is 9 estimates. The harness
runs about 100 estimates per household because it also measures things a product would not - two
rail sets, five spending targets, a controlled column. **The four-step recipe itself is 1 estimate
plus 5 bisections = 46 estimates = 9,200 runs, 9-20 seconds per household** at these speeds, which
is the same order as the Monte Carlo runs the tab already performs (400 paths x ~123 strategies).

### 2. The shipped rule is BLIND to the hatchet, not tripped by it

This was predicted the other way round (`G-P1`), and the prediction was wrong. The article's
critique is about a rule that mistakes the hatchet's high early *withdrawal rate* for overspending.
The rule this tool ships does not measure that rate: its ratio is **total spending over the
portfolio**, not the portfolio draw over the portfolio, so a benefit starting at 70 changes the
numerator not at all and the denominator only slowly.

On a path with the market held perfectly still, the ratio's peak in the pre-benefit years:

| household | peak ratio, years 1-6 | band | rule fired |
|---|---|---|---|
| `bracket-filler-texas` | 1.000 | 1.20 | no |
| `mixed-portfolio-couple` | 1.179 | 1.20 | no |
| `long-widowhood` | 1.006 | 1.20 | no |
| `age-gap-ira-heavy-ca` | 1.098 | 1.20 | no |

So the defect here is not a false alarm during the blade. It is that **the rule's one reference
number is set in year 0 and never learns anything** - not that the benefit arrived, not that the
horizon shortened, not that the plan is now funded from a different mix. Everything in section 3
follows from that, and section 6 has the reason: the rate it tests is not the rate Guyton-Klinger
publishes, and the substituted one is the one the hatchet leaves alone.

### 3. It acts on smaller market moves than either rail, and cuts much harder than the plan's risk calls for

The first-year market return at which each rule first acts:

| household | shipped rule | rails A, at its target | rails B, at its target | rails A, at the plan's own spend |
|---|---|---|---|---|
| `bracket-filler-texas` | **-14.4%** | -17.1% | -33.0% | -44.7% |
| `mixed-portfolio-couple` | **-11.7%** | -17.4% | -34.4% | +24.1% |
| `long-widowhood` | **-15.5%** | -22.4% | -31.7% | -25.4% |
| `age-gap-ira-heavy-ca` | **-14.1%** | -22.1% | -30.0% | -32.0% |

The shipped rule cuts on a first-year drop of 12-16% in every household, and the article's own rails
want 17-22% (A) or 30-34% (B). Read as portfolio balances - the form the article asks for - the
`bracket-filler-texas` household is told to cut at $2,584,564 by the shipped rule and at $2,470,162
(A) or $1,980,506 (B) by the rails.

What that early trigger costs, on the -22%/-13% shock, scored against each household's own planned
real spending path:

| household | trough real spend | vs plan path | years below plan | lifetime real spend, rule on | rule off | did the un-adjusted plan fund every year? |
|---|---|---|---|---|---|---|
| `bracket-filler-texas` | $76,326 | **-30.6%** | 24/33 | $3,025,281 | $3,630,000 | yes |
| `mixed-portfolio-couple` | $131,517 | -43.8% | 31/33 | $4,779,073 | $4,932,387 | **no** |
| `long-widowhood` | $103,073 | **-31.3%** | 35/38 | $4,439,592 | $5,700,000 | yes |
| `age-gap-ira-heavy-ca` | $118,198 | **-38.2%** | 23/25 | $3,539,735 | $4,887,930 | yes |

On three of the four households the shipped rule gives up **17% to 28% of lifetime real spending, on
a path where the plan needed no protection at all**: the un-adjusted run funds every year of the
plan. The cut is not brief, either - real spending sits below the plan's own path for 23 of 25, 24
of 33 and 35 of 38 years.

At the same moment, with spending never having been cut, the risk-based read:

| household | year | portfolio | PoS | rails A says | rails B says |
|---|---|---|---|---|---|
| `bracket-filler-texas` | 2030 | $1,999,135 | 82.0% | no change, $110,000 | no change, $110,000 |
| `mixed-portfolio-couple` | 2032 | $1,677,238 | 0.0% | cut to $109,402 | cut to $115,686 |
| `long-widowhood` | 2030 | $2,452,349 | 39.5% | cut to $103,162 | cut to $115,247 |
| `age-gap-ira-heavy-ca` | 2031 | $2,539,995 | 41.0% | cut to $160,757 | no change, $220,000 |

(All in 2026 dollars, against the shipped rule's $76,326 / $131,517 / $103,073 / $118,198.)

### 4. Risk-based is not simply GENTLER - it is aimed differently

The second half of `G-P2` is wrong, and the exception is the interesting household.
`mixed-portfolio-couple` spends $234,000 against a 55% probability of success: the risk-based rule
says **cut today, before any market move at all** (its "cut at +24.1%" in section 3's controlled
column means the household would need a 24% first-year gain merely to get back above the 70% rail),
and after the shock it cuts to $109,402 where the shipped rule stopped at $131,517 - deeper, on the
one household whose un-adjusted plan genuinely fails. Meanwhile it leaves `bracket-filler-texas`
alone entirely at 82% PoS where the shipped rule took a third of its spending away.

That is the whole difference in one line: **the shipped rule reacts to a market move, the rails
react to the plan.**

### 5. Rails cluster only because the target normalizes the households

Prediction `G-P3` expected the rails to vary household by household while the shipped trigger stayed
put. Measured at each rule's own starting point, both are flat: the shipped trigger spans 3.8 points
across the four households and rails A span 5.3 (B: 4.3). The reason is in the recipe - resetting
every household to the same probability of success *is* the normalization, so afterwards they all sit
the same distance from the rail.

The variation reappears the moment the rails are asked about the spending a household actually has:
**-44.7%, +24.1%, -25.4%, -32.0%** - a 69-point spread on the same rail. That is the column to quote
when the question is "how different are these households", and the "at its target" column is the one
to quote when the question is "what would the rule do".

---

### 6. The rule this tool ships is not Guyton-Klinger as published

Four divergences, measured. The first one decides sections 2 and 3, because it is the reason the
hatchet is invisible to the rule.

**a. It tests a different rate.** Published GK compares portfolio withdrawals to the portfolio. The
shipped rule compares **total spending** to the portfolio (`optimizer_core.js:2061`) - including the
part Social Security and pensions pay for. The engine computes the published quantity already,
`yr._wdRate` (`:4447`), and the rule does not use it.

Both ratios, read off one run with the rule off, at the plan's own deterministic growth and CPI, as
multiples of their own year-0 values against a 0.80-1.20 band:

| household | shipped ratio | years outside | published ratio | years outside | first divergence |
|---|---|---|---|---|---|
| `bracket-filler-texas` | 0.43-1.00 | 18/33 | 0.21-1.02 | 27/33 | **2032 raise** - published 0.77, shipped 0.96 |
| `mixed-portfolio-couple` | 1.00-3.59 | 26/33 | 0.91-2.30 | 15/33 | 2044 cut - published 1.20, shipped 1.57 |
| `long-widowhood` | 0.54-1.01 | 16/38 | 0.50-1.27 | 34/38 | **2027 cut** - published 1.27, shipped 0.99 |
| `age-gap-ira-heavy-ca` | 0.74-1.10 | 3/25 | 0.45-1.24 | 22/25 | **2027 cut** - published 1.24, shipped 1.00 |

The two ratios disagree about the direction and the timing of the first adjustment on every
household, and neither is uniformly the earlier one: the published ratio acts in year 2 on two
households where the shipped rule sits at 0.99 and 1.00, and the shipped rule reaches 3.59 on
`mixed-portfolio-couple` where the published ratio has not yet left the band.

That is the article's critique, reproduced: **under the published numerator these households behave
exactly as the hatchet predicts** - a cut in the blade years on two of them, and a raise on
`bracket-filler-texas` in 2032, the year both benefits are running. The shipped rule escapes that by
testing a rate the hatchet does not move, and pays for it with the year-0 anchor of section 2.

*What the last column is not:* the first year the published ratio leaves the band on a path where no
adjustment is ever applied. A real published-GK run would adjust at that point and move its own ratio
afterwards, so this is the first **divergence**, not a simulation of the published rule.

**b. The inflation freeze reads the wrong return.** `sim.gkPriorReturn = yr.baseReturn` (`:4508`) is
the scenario's base (equity) return; published GK freezes on the portfolio's total return. Identical
where every account gets the base return, and not otherwise:

| mode | equity-negative path-years | sign disagreement with the blended account return |
|---|---|---|
| Historical (bootstrap) | 27.1% | **7.7%** |
| Synthetic (GBM) | 29.9% | 0.0% |

So in Historical mode roughly one year in thirteen freezes the CPI raise on an equity loss the
portfolio did not actually take. (The blend here is the average of the per-account sequences the
engine hands the accounts, which is the closest stand-in this harness has for a portfolio return.)

**c. The capital-preservation cut is never suspended.** Published GK stops applying it in the final
15 years of the plan; this one applies it to the last year. Latent on the paths measured - on the
-22%/-13% shock, every cut lands early:

| household | plan years | cuts | of those, in the final 15 | raises |
|---|---|---|---|---|
| `bracket-filler-texas` | 33 | 3 | 0 | 6 |
| `mixed-portfolio-couple` | 33 | 5 | 0 | 1 |
| `long-widowhood` | 38 | 3 | 0 | 4 |
| `age-gap-ira-heavy-ca` | 25 | 4 | 0 | 3 |

Early clustering is itself a consequence of (a) and of the year-0 anchor, not evidence that the
suspension would never matter: a 33-year plan spends 15 of those years inside the window published
GK exempts.

**d. There is no 6% cap on the inflation raise.** Published GK (2006) caps it. Inert on a
deterministic 2.5% CPI run; under the Monte Carlo inflation model **11.1% of path-years draw
inflation above 6%**, worst 11.6%.

**Three more things that are not GK, and are not defects.** The portfolio-management rule - where
withdrawals come from - is deliberately out of scope: the draw belongs to whichever strategy the
plan selected, documented at `optimizer_core.js:4607` and in the release that made Guardrails a
switch rather than a strategy. `spendDelta` compounds on the goal every year (`:4507`), which the
page discloses as "Spend Delta still applies on top". And `gkSpendStable` (`:5261`) rejects plans the
rule only holds together by slashing - a guard the Optimizer's searches apply, not a rule a retiree
follows.

**What to do about it is a decision, not a fix.** The in-page copy describes the implemented
mechanism accurately - "what you spend for each dollar you have saved" - so the overclaim is the
label, not the explanation. Switching the numerator to `yr._wdRate` would move the numbers of every
saved plan that has Guardrails on, and on the evidence above it would make the rule act in the blade
years, which is the behavior the source article was written to argue against. The cheapest honest
options are to stop calling it Guyton-Klinger, or to say in the help text which rate it tests.

---

## Predictions

Registered before the first run, against a 25% lower rail - the number the second-hand summaries
available at the time gave, since kitces.com is unreachable from this environment. The source
document arrived afterwards and carries two parameter sets, neither of them that one, so each
prediction is scored against both of the article's sets rather than re-aimed.

| id | prediction | verdict |
|---|---|---|
| `G-P1` | the shipped rule fires in the pre-benefit years on a benign path | **REFUTED**. Closest approach 1.179 against a 1.20 band; it fires on none of the four. Section 2 is what replaced it |
| `G-P2` | the shipped rule cuts earlier AND deeper than a risk rail, on every household | **PARTLY**, both rail sets. Earlier: yes, all four. Deeper: no - `mixed-portfolio-couple` reverses it |
| `G-P3` | the shipped trigger is household-independent; the rail moves 20+ points | **REFUTED**, both sets. 3.8 points against 5.3 (A) and 4.3 (B). Section 5 explains why, and where the variation actually lives |
| `G-P4` | a full guardrail set costs under 30s per household at 200 paths | **REFUTED** as the harness runs it - 32 to 47s on the longest household across repeats - but the harness measures about twice the recipe. The recipe alone is 9,200 runs, 9-20s |

---

## What shipping it would take

Three scopes, smallest first. Only the first is priced by anything in this report.

1. **A guardrail readout.** Target-PoS spending, the two rail balances, and the adjusted spending at
   each rail, for the plan as it is. Every piece exists; the work is a panel, a worker call and a
   progress bar, on the pattern the Monte Carlo tab already uses. ~9,200 engine runs per plan.
2. **A `spendRule: 'rbg'` beside `'gk'`.** A simulated run that follows the rails year by year. The
   rails cannot be re-solved inside every path-year - that is 200 estimates x 30 years x 200 paths -
   so it needs the article's own device: solve the rails once as *balances*, compare the running
   balance against them each year, and re-solve only when one is crossed. Whether that approximation
   holds up under Monte Carlo is not measured here and would need its own harness.
3. **The hatchet itself.** Nothing is missing: benefit ages and `spendChange` already produce the
   blade and the handle. What is missing is the reporting that would make the shape visible.

### Open questions this report does not settle

- **Which probability.** `totals.success` is all-or-nothing over the whole plan; the article's
  income-risk framing is the chance that the *income* is not sustainable. They are close but not the
  same measure, and the rails were chosen for theirs.
- **Sampling noise sets the precision of a rail.** At 200 paths a PoS estimate near 90% carries a
  standard error of about 2.1 points, so a rail placed at 70% is really a band. That is an argument
  for more paths in a shipped feature, and it multiplies the cost directly.
- **One model, one seed.** GBM only. `research/CONSTANT_SPLIT.md` is the standing reminder that a
  rule can look fine under GBM and fail under bootstrap, which carries real crashes in real order.
- **The re-plan is exact here and would not be in life.** It restarts the plan from realized
  balances with every other assumption unchanged. A household also re-plans its horizon, its
  benefits and its spending, which is the article's whole point about longevity.

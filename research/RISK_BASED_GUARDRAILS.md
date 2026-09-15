# Risk-based spending guardrails

Whether the guardrail rule published by Derek Tharp and Justin Fitzpatrick - spend to a target
**probability of success**, adjust when that probability crosses a rail - can be computed on this
engine, what it costs, and where it disagrees with the Guardrails rule the tool already ships.

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
run for run, while wall clock moved 1.05 to 1.61 ms/run across repeats on the same machine.

One probability estimate is 200 engine runs; one spending or rail answer is 9 estimates. The harness
runs about 100 estimates per household because it also measures things a product would not - two
rail sets, five spending targets, a controlled column. **The four-step recipe itself is 1 estimate
plus 5 bisections = 46 estimates = 9,200 runs, 11-15 seconds per household** at these speeds, which
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
follows from that.

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
| `G-P4` | a full guardrail set costs under 30s per household at 200 paths | **REFUTED** as the harness runs it - 32.0s on the longest household - but the harness measures about twice the recipe. The recipe alone is 9,200 runs, 11-15s |

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

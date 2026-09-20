# Risk-based spending guardrails

Whether the guardrail rule published by Derek Tharp and Justin Fitzpatrick - spend to a target
**probability of success**, adjust when that probability crosses a rail - can be computed on this
engine, what it costs, and where it disagrees with the Guardrails rule the tool already ships.

Sections 6 to 8 answer questions the comparison kept raising and the article did not ask: how far the
shipped rule is from **Guyton-Klinger as published**. Four divergences, and the first one - the rate
it tests - is what makes the hatchet invisible to it. Section 7 answers a second: how the rule
composes with **Spend Delta**, which turns out to break a filter the Optimizer relies on, and which
is where the `gkShapeCeiling` prototype came from. Section 8 re-scores every spending total on the
page for the fact that **early spending is worth more than late spending**, which moves the rule and
the ceiling in opposite directions.

Produced by [`.test_harnesses/rbg_harness.js`](../.test_harnesses/rbg_harness.js), first on engine
v11.1823 (`1842270`, 2026-09-15) and again on v11.1854 (2026-09-16). Every number below is printed
by that script; nothing here is estimated by hand.

**What the 2026-09-16 re-run changed, and why.** Two things moved under this report, and every
table was re-read against the re-run.

- **The rule itself (P127).** Three of the divergences section 6 measured were then closed or
  narrowed on the user's call: the inflation freeze reads the portfolio's return, the raise is
  capped at 6%, and the capital-preservation cut is suspended in a plan's final 8 years (the paper
  says 15). The search filter of section 7a now judges spending against the plan's own path, and the
  ceiling of section 7b became a switch behind the nerdknob. Sections 6 and 7 say which numbers
  describe the rule before those changes.
- **A defect in this harness.** Its mid-plan re-plan passed spending as `spend x inflationFactor`,
  but the engine treats the goal as today's dollars and inflates it again for every year the start
  lies ahead - so a re-plan k years in was asked about k years of extra inflation: exact at k = 1,
  +10% real by year 5, +25% by year 10. Section 3's second table re-planned at years 4 to 6, so its
  probabilities were taken at 10-15% more real spending than it said. The re-plan also restarted
  the N-year amortization, the brokerage cycle and the IRMAA income history. The harness now
  **resumes** the plan instead (`snapshotResume` / `resumeInputs` in `optimizer_core.js`), which
  continues it exactly - pinned by a test on all 19 bank households. That table's numbers changed a
  lot and its conclusions changed with them; sections 2 and 5 moved slightly for the two households
  whose strategy carries state.

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
| **the shipped rule** | `spendRule: 'gk'`, the Guyton-Klinger spend adjustment the tool labels **Guardrails** (`resolveSpendTarget` in `optimizer_core.js`). Trigger (as measured here, through 11.18b1): `spendGoal / start-of-year portfolio` against that same ratio in year 0; since 11.18b2 (P132j) the ratio is net of Social Security and pension and is compared with the plan's own ratio for the year, so a plan on its own assumptions never adjusts, band `1 ± gkGuard` (0.20), step `gkAdjPct` (10%). Since P127 (2026-09-16) it also never cuts in a plan's final 8 years, caps the inflation raise at 6%, and freezes the raise on the portfolio's return rather than the market's |
| **rails A** | the article's implementation recipe: target **90%** PoS, raise at **99%**, cut at **70%** |
| **rails B** | the article's income-risk framing: "target an initial income risk of 20% … increase at 0% … decrease at 60%", read as PoS: target **80%**, raise at **100%**, cut at **40%** |
| **at its target** | the rail measured from the spending that rule would have the household on - the target-PoS number, not the plan's own |
| **at the plan's own spend** | the same rail measured from the spending the household already has, which is what the shipped rule judges. The controlled comparison |
| **first-year return** | the single market return in year 1 at which a rule first acts, found by bisection. One number that both rules can be asked for |
| **published GK** | Guyton-Klinger as published - Guyton 2004, and Guyton and Klinger, "Decision Rules and Maximum Initial Withdrawal Rates", *Journal of Financial Planning*, March 2006. Four rules: a portfolio-management rule for where withdrawals come from, an inflation rule that skips the CPI raise after a negative-return year while the current rate is above the initial one, a capital-preservation rule cutting 10% when the rate rises 20% above its initial value (suspended in the final 15 years), and a prosperity rule raising 10% when it falls 20% below |
| **the published ratio** | the rate published GK tests: **portfolio withdrawals** divided by the portfolio, against that same ratio in year 0. Distinct from the shipped rule's ratio, which divides **total spending** by the portfolio. The engine computes both; `yr._wdRate` (`optimizer_core.js:4447`), the `wdRate%` column, is the published one |
| **the shape** | the plan's own spending path: the year-0 goal carried forward by **Spend Delta** (`spendChange`, the household's planned real drift) and CPI, and by nothing else. What spending would have been with no rule running |
| **`gkSpendStable`** | the filter the Optimizer's spend and conversion searches apply (`optimizer_core.js`): reject a candidate whose run lets real spending fall more than `gkGuard` below its **year-0** value - below **the shape**, since P127b. Not a rule a household follows - a guard against a search "affording" a spend the rule only reaches by slashing |
| **`gkShapeCeiling`** | the P127 prototype added by this report: an engine input, default **off**, that holds the rule's goal at the shape. Since 2026-09-16 the **Never above plan** switch behind the nerdknob (P127a) |
| **discounted real spend** | the same delivered real spending, with year *y* weighted `1 / (1 + d)^y`. Section 8 reports d = 0%, 3% and 5%, because the rate is a statement of preference and not a measurement. Per-year real spending is `(spendGoal + shortfall) / inflationFactor`, which sums to `totals.spendCurrentDollars` to the dollar - the engine's own accumulator (`optimizer_core.js:4386`) decomposed, not a second definition |
| **re-plan** | a plan continued from the end of one of its own years with a different future: the run's `-resume` record handed to a new run (`resumeInputs`), which carries the balances, the plan-year index, the inflation clocks and every other year-to-year state, and the spending the plan had. Before the 2026-09-16 re-run this was a hand-built restart - see the note at the top |

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
| `bracket-filler-texas` | 33 | 18,400 | 14.2 | 0.77 |
| `mixed-portfolio-couple` | 33 | 22,000 | 19.0 | 0.86 |
| `long-widowhood` | 38 | 20,200 | 21.7 | 1.07 |
| `age-gap-ira-heavy-ca` | 25 | 18,400 | 14.8 | 0.81 |

The run count is exact and the seconds are not: seed 42 reproduces every probability in this report
run for run, while wall clock moved **0.99 to 2.15 ms/run across four repeats** of the first run on
the same machine (the table is the 2026-09-16 re-run; two households run 1,800 fewer engine runs
than they did, because section 3 no longer bisects a spend the rails leave unchanged). Plan against
the run count, not the clock.

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
| `long-widowhood` | **-15.5%** | -22.1% | -31.4% | -25.1% |
| `age-gap-ira-heavy-ca` | **-14.1%** | -23.1% | -30.4% | -32.7% |

The shipped rule cuts on a first-year drop of 12-16% in every household, and the article's own rails
want 17-23% (A) or 30-34% (B). Read as portfolio balances - the form the article asks for - the
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
| `bracket-filler-texas` | 2030 | $1,999,135 | 92.0% | no change, $110,000 | no change, $110,000 |
| `mixed-portfolio-couple` | 2032 | $1,677,238 | 2.0% | cut to $125,741 | cut to $134,539 |
| `long-widowhood` | 2030 | $2,452,349 | 55.0% | cut to $116,052 | no change, $150,000 |
| `age-gap-ira-heavy-ca` | 2031 | $2,539,995 | 74.0% | no change, $207,126 | no change, $207,126 |

(All in 2026 dollars, against the shipped rule's $76,326 / $131,517 / $103,073 / $118,198. The year
is the one the shipped rule stopped cutting; the probability is the plan's from the end of that
year on. `age-gap-ira-heavy-ca`'s "no change" is its own planned spending for 2032, which its
-1%/year Spend Delta has already taken below $220,000.)

**This table was wrong in the first run, and the correction strengthens the section rather than
weakening it.** The first run asked each household about 10-15% more real spending than it had (see
the note at the top), which read 82%, 0%, 39.5% and 41%. At the spending they actually have, the
rails leave two of the four households alone entirely - `bracket-filler-texas` at 92% and
`age-gap-ira-heavy-ca` at 74% - where the shipped rule took 31% and 38% out of their spending, and
rails B leaves `long-widowhood` alone too.

### 4. Risk-based is not simply GENTLER - it is aimed differently

The second half of `G-P2` fails under rails A, and the exception is the interesting household.
`mixed-portfolio-couple` spends $234,000 against a 55% probability of success: the risk-based rule
says **cut today, before any market move at all** (its "cut at +24.1%" in section 3's controlled
column means the household would need a 24% first-year gain merely to get back above the 70% rail),
and after the shock rails A cut it to $125,741 where the shipped rule stopped at $131,517 - deeper,
on the one household whose un-adjusted plan genuinely fails (rails B stop at $134,539). Meanwhile
both rail sets leave `bracket-filler-texas` alone entirely at 92% PoS where the shipped rule took a
third of its spending away, and `age-gap-ira-heavy-ca` at 74% where it took 38%.

That is the whole difference in one line: **the shipped rule reacts to a market move, the rails
react to the plan.**

### 5. Rails cluster only because the target normalizes the households

Prediction `G-P3` expected the rails to vary household by household while the shipped trigger stayed
put. Measured at each rule's own starting point, both are flat: the shipped trigger spans 3.8 points
across the four households and rails A span 6.0 (B: 4.0). The reason is in the recipe - resetting
every household to the same probability of success *is* the normalization, so afterwards they all sit
the same distance from the rail.

The variation reappears the moment the rails are asked about the spending a household actually has:
**-44.7%, +24.1%, -25.1%, -32.7%** - a 69-point spread on the same rail. That is the column to quote
when the question is "how different are these households", and the "at its target" column is the one
to quote when the question is "what would the rule do".

---

### 6. The rule this tool ships is not Guyton-Klinger as published

Four divergences, measured on the rule as it stood on 2026-09-15. The first one decides sections 2
and 3, because it is the reason the hatchet is invisible to the rule. **The other three were acted on
the next day (P127, user):** b and d now follow the paper, and c follows it with 8 years in place of
15. Section a is the one that stays, by the user's choice.

**a. It tests a different rate.** Published GK compares portfolio withdrawals to the portfolio. The
shipped rule compares **total spending** to the portfolio (`resolveSpendTarget` in
`optimizer_core.js`) - including the part Social Security and pensions pay for. The engine computes
the published quantity already, `yr._wdRate`, and the rule does not use it.

Both ratios, read off one run with the rule off, at the plan's own deterministic growth and CPI, as
multiples of their own year-0 values against a 0.80-1.20 band:

| household | shipped ratio | years outside | published ratio | years outside | first divergence |
|---|---|---|---|---|---|
| `bracket-filler-texas` | 0.43-1.00 | 18/33 | 0.21-1.02 | 27/33 | **2032 raise** - published 0.77, shipped 0.96 |
| `mixed-portfolio-couple` | 1.00-3.59 | 26/33 | 0.91-2.30 | 15/33 | 2044 cut - published 1.20, shipped 1.57 |
| `long-widowhood` | 0.54-1.01 | 16/38 | 0.50-1.27 | 34/38 | **2027 cut** - published 1.27, shipped 0.99 |
| `age-gap-ira-heavy-ca` | 0.74-1.10 | 3/25 | 0.45-1.24 | 22/25 | **2027 cut** - published 1.24, shipped 1.00 |

**Why the two move apart, in one household's arithmetic.** The rates are not independent - they are
related by exactly one factor:

    published rate = shipped rate x (portfolio draw / total spending)

and a deferred benefit is a thing that moves that factor. `bracket-filler-texas`, rule off so neither
rate is being reacted to:

| year | age | portfolio | spend | SS + pension | portfolio draw | draw ÷ spend | shipped rate | published rate |
|---|---|---|---|---|---|---|---|---|
| 2026 | 64 | $3,100,000 | $110,000 | $0 | $145,710 | 132% | 3.55% | 4.70% |
| 2030 | 68 | $3,503,291 | $121,419 | $0 | $166,862 | 137% | 3.47% | 4.76% |
| 2031 | 69 | $3,611,341 | $124,455 | $16,971 | $154,203 | 124% | 3.45% | 4.27% |
| 2032 | 70 | $3,740,659 | $127,566 | $40,589 | $135,011 | 106% | 3.41% | **3.61%** |
| 2033 | 71 | $3,899,518 | $130,755 | $59,434 | $120,710 | 92% | 3.35% | **3.10%** |
| 2037 | 75 | $4,715,529 | $144,330 | $65,604 | $133,961 | 93% | 3.06% | 2.84% |

Before the benefits the portfolio funds **everything**, and more: the draw is 132-137% of spending,
because it also funds the tax on its own withdrawal. Once both benefits are running it funds 92%.
That collapse is the whole divergence - the published rate falls by a third, 4.70% to 3.10%, while
the shipped rate drifts from 3.55% to 3.35%.

The reason the shipped rate barely moves is worth stating plainly, because it is the intuition the
numerator breaks: **a benefit does not reduce spending, it changes who pays for it.** The shipped
rate's numerator is the spending, so the benefit never enters it; the denominator is the portfolio,
which is only indirectly affected (it is drawn on more gently, so it grows a little faster). The
published rate's numerator IS the draw, so the benefit lands on it in full, the year it starts.

Which means the adjustment in the normalized table is not a near miss. On this household the
published rate reads **0.768 of its year-0 value in 2032 and 0.659 in 2033** - through the 0.80
prosperity trigger - so published GK calls for a 10% raise, twice, on a household where nothing
unexpected has happened at all: the benefit starting at 70 was in the plan from the first day. That
is the article's complaint stated as arithmetic rather than as an opinion, and it is what "a rule
that judges a rate cannot tell a planned change in that rate from an unplanned one" means.

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

**b. The inflation freeze read the wrong return - follows the paper since P127.** The rule froze on
`yr.baseReturn`, the scenario's base (equity) return; published GK freezes on the portfolio's total
return, and since 2026-09-16 so does this one (`portfolioReturnOf`: the accounts' returns weighted by
their start-of-year balances, cash yield and brokerage dividends included). The two were identical
where every account gets the base return, and not otherwise:

| mode | equity-negative path-years | sign disagreement with the blended account return |
|---|---|---|
| Historical (bootstrap) | 27.1% | **7.7%** |
| Synthetic (GBM) | 29.9% | 0.0% |

So in Historical mode roughly one year in thirteen froze the CPI raise on an equity loss the
portfolio did not actually take. (The blend here is the average of the per-account sequences the
engine hands the accounts, which is the closest stand-in this harness has for a portfolio return. The
engine's own blend also counts cash yield and dividends, so it can disagree with the equity return
under GBM too, in a year the market loses less than the cash earns.)

**c. The capital-preservation cut was never suspended - suspended in the final 8 years since P127.**
Published GK stops applying it in the final 15 years of the plan; this one applied it to the last
year, and now stops in the final 8 (the user's number). Latent on the shock paths measured - every
cut lands early, before either window:

| household | plan years | cuts | of those, in the final 15 | held back in the final 8 | raises |
|---|---|---|---|---|---|
| `bracket-filler-texas` | 33 | 3 | 0 | 0 | 6 |
| `mixed-portfolio-couple` | 33 | 5 | 0 | 0 | 1 |
| `long-widowhood` | 38 | 3 | 0 | 0 | 4 |
| `age-gap-ira-heavy-ca` | 25 | 4 | 0 | 0 | 3 |

Early clustering is itself a consequence of (a) and of the year-0 anchor, not evidence that the
suspension never matters. Where it does matter is a plan that spends more than its savings carry.
One number from outside this harness, because it is the case: on the Optimize Spend fixture in
`optimizer_core.tests.js`, the late cuts the rule now holds back were what stopped the search, and its
answer rose from $64,829 to $78,687 with every year still funded (the test's comment records it).

**d. There was no 6% cap on the inflation raise - applied since P127.** Published GK (2006) caps it.
Inert on a deterministic 2.5% CPI run; under the Monte Carlo inflation model **11.1% of path-years
draw inflation above 6%**, worst 11.6%.

**Three more things that are not GK, and are not defects.** The portfolio-management rule - where
withdrawals come from - is deliberately out of scope: the draw belongs to whichever strategy the
plan selected, as `simulate()`'s strategy notes and the release that made Guardrails a switch rather
than a strategy both say. `spendDelta` compounds on the goal every year (`endYear`), which the page
discloses as "Spend Delta still applies on top". And `gkSpendStable` rejects plans the rule only
holds together by slashing - a guard the Optimizer's searches apply, not a rule a retiree follows.

**What to do about (a) was a decision, not a fix, and it has been made.** The in-page copy describes
the implemented mechanism accurately - "what you spend for each dollar you have saved" - so the
overclaim was the label, not the explanation. Switching the numerator to `yr._wdRate` would move the
numbers of every saved plan that has Guardrails on, and on the evidence above it would make the rule
act in the blade years, which is the behavior the source article was written to argue against. The
switch was relabelled GK-style in 11.1824, and on 2026-09-16 the user chose to keep the numerator.

---

### 7. How the rule composes with Spend Delta

The rule does not run alone. `spendChange` - Spend Delta on the page - shapes the goal the rule is
adjusting, and the two compose in a way nobody chose: one defect in a filter, and one thing worth
adding, prototyped here.

#### a. The search filter could not tell a planned decline from a rule-driven slash - fixed, P127b

`gkSpendStable` read the finished run's minimum **real** `spendGoal` against its year-0 value, and
`spendGoal` carries the delta. So the shape breached the floor on its own: at -1%/year, real spending
is below `1 - gkGuard` of year 0 from **year 23**, with no market move and no cut. Since 2026-09-16 it
compares each year against the shape, `spend0 x (1 + spendChange)^y`, which at a flat delta is the
same test it always was. Measured at each household's own growth, so every run below is a plan doing
exactly what it planned; the verdict is shown from the first run and from the re-run:

| household | delta | GK cuts | min real ÷ year 0 | against year 0 (first run) | against the shape (re-run) |
|---|---|---|---|---|---|
| `bracket-filler-texas` | 0 | 0 | 1.000 | accepted | accepted |
| `bracket-filler-texas` | -1%/yr | 0 | 0.914 | accepted | accepted |
| `mixed-portfolio-couple` | 0 | 2 | 0.810 | accepted | accepted |
| `mixed-portfolio-couple` | -1%/yr | **0** | **0.725** | **REJECTED** | accepted |
| `long-widowhood` | 0 | 0 | 1.000 | accepted | accepted |
| `long-widowhood` | -1%/yr | 0 | 0.878 | accepted | accepted |
| `age-gap-ira-heavy-ca` | 0 | 1 | 0.900 | accepted | accepted |
| `age-gap-ira-heavy-ca` | -1%/yr | 0 | 0.810 | accepted | accepted |

Under the old baseline one household was rejected for its own planned shape with zero cuts on the
path, and the other three survived for a reason no better than the failure: the rule's **prosperity
raises** happened to offset the decline. That made the verdict depend on how the portfolio
performed, which is not something a filter over candidate spending levels should be sensitive to -
and it was not scale-invariant either. On `mixed-portfolio-couple` at -1%/year the old filter
accepted $93,600, $140,400 and $187,200 and rejected $234,000 and $280,800: the smaller goals earned
raises, the larger ones did not.

What it did to the search it guards. `optimizeSpend` drives its binary search on `passes()`, which
fails whenever this filter does:

| household | delta | Guardrails on, first run | Guardrails on, re-run | Guardrails off |
|---|---|---|---|---|
| `bracket-filler-texas` | 0 | $188,311 | $188,311 | $195,723 |
| `bracket-filler-texas` | -1%/yr | $168,652 | $222,471 | $223,760 |
| `mixed-portfolio-couple` | 0 | $235,371 | $240,855 | $241,541 |
| `mixed-portfolio-couple` | -1%/yr | **no viable spend** | $281,303 | $271,705 |
| `long-widowhood` | 0 | $208,887 | $217,676 | $213,281 |
| `long-widowhood` | -1%/yr | $195,703 | $256,787 | $242,725 |
| `age-gap-ira-heavy-ca` | 0 | $269,629 | $278,008 | $287,031 |
| `age-gap-ira-heavy-ca` | -1%/yr | $225,801 | $317,324 | $316,035 |

On the first run, a declining shape - a plan that is **cheaper**, and whose rule-off answer therefore
rises by 10-17% - made the Guardrails answer fall by 8-16%, or disappear, widening the gap from about
4% to 25-29% for no reason the household would recognize.

The re-run carries all of P127, not only the filter: the flat-delta rows moved too, where the filter
is unchanged, so those moves are the rule's own - chiefly that it no longer cuts in a plan's final 8
years. With a declining shape the Guardrails answer now follows the rule-off answer, and on four rows
exceeds it: a plan that may still cut earlier on, within the floor, can start higher than one that
never adjusts.

#### b. `gkShapeCeiling`: the prototype, default off - now a nerdknob switch, P127a

The rule can spend a household **above** its own plan: a prosperity raise lifts the goal whenever the
portfolio grows faster than the plan assumed, and nothing stops it. If the shape is read as "what we
would have spent", those raises are spending the household never asked for. The prototype holds the
goal at the shape:

- only a prosperity raise can breach the shape, so the clamp is a **ceiling, not a band**: CPI moves
  goal and shape by the same factor, and the inflation freeze and the capital-preservation cut both
  move the goal *down* against it;
- the rule keeps its cuts, so it becomes deliberately asymmetric - **cuts react to the portfolio,
  raises can do no more than walk the goal back up to the plan**;
- it was an engine input only when this was written, because turning it on changes the spending of
  every plan with Guardrails on. Since 2026-09-16 it is the **Never above plan** switch beside the
  Guardrails band and step, behind the nerdknob and off by default; it travels in the share link and
  the saved plan like any other input, and the rows the Optimizer and Monte Carlo sweep follow it.
  Three tests in `optimizer_core.tests.js` pin its contract: the premise (without it, raises outrun
  the shape), what it does (spending never exceeds the shape, lifetime spend falls, ending wealth
  rises), and what it must never do (clamp a year the rule did not try to raise, or change anything
  before it binds).

What it costs and returns, on each household's own deterministic path and on the -22%/-13% shock:

| household | path | peak real ÷ shape | clamped years | lifetime real spend | ending wealth |
|---|---|---|---|---|---|
| `bracket-filler-texas` | benign | 1.772 → **1.000** | 18 | $4,340,533 → **$3,630,000** | $14,846,622 → **$17,075,004** |
| `bracket-filler-texas` | shock | 1.229 → 1.000 | 5 | $3,025,281 → $2,956,046 | $10,230,520 → $10,397,129 |
| `mixed-portfolio-couple` | benign | 1.000 → 1.000 | 0 | $6,797,700 → $6,797,700 | $6,071,086 → $6,071,086 |
| `mixed-portfolio-couple` | shock | 1.000 → 1.000 | 0 | $4,779,073 → $4,779,073 | $6,437,720 → $6,437,720 |
| `long-widowhood` | benign | 1.464 → **1.000** | 16 | $6,285,015 → **$5,700,000** | $18,471,164 → **$20,812,089** |
| `long-widowhood` | shock | 1.006 → 1.000 | 1 | $4,439,592 → $4,438,683 | $12,597,671 → $12,600,402 |
| `age-gap-ira-heavy-ca` | benign | 1.100 → 1.000 | 3 | $4,940,308 → $4,887,927 | $8,962,648 → $9,080,064 |
| `age-gap-ira-heavy-ca` | shock | 1.000 → 1.000 | 0 | $3,539,735 → $3,539,735 | $6,872,188 → $6,872,188 |

Three things to read off it. **The whole effect is in good markets** - on the shock path the ceiling
takes 2.3% of lifetime spending at most, and on two households nothing at all. **When it binds it
binds hard**: `bracket-filler-texas` gives up 16.4% of lifetime real spending for 15.0% more ending
wealth, and `long-widowhood` 9.3% for 12.7%. And **a household the rule never raises never notices
it**: `mixed-portfolio-couple` is identical to the cent on both paths, which is the same property
the third test pins.

One side effect worth knowing. The rule's anchor is still the year-0 ratio, so once the portfolio
outgrows it the rule tries to raise **every remaining year** and is clamped every time: 18 of 33 years
on `bracket-filler-texas`. The `ruleAdj` column reads `+10%pros @shape` for all of them. That is honest -
the rule wanted more and the plan said no - but it means the ceiling is a permanent state rather than
an occasional event; the column's help text says what `@shape` means.

And it composed badly with (a), in the direction you would expect: with the ceiling on, real
spending can never exceed the shape, so the minimum could only fall further below a year-0 baseline.
That is why the filter's baseline was fixed first (P127b), before the switch reached the page.

---

### 8. Early spending is worth more, and every total above prices it at par

Sections 3 and 7 add year 1 and year 33 at the same value. A household does not: a cut at 65 and a
raise at 92 are not the same event (user, 2026-09-15). Re-scoring the same runs with the year's real
spending discounted at 0%, 3% and 5% moves the two rules in **opposite directions**, so this is not a
presentational nicety.

| household | path | comparison | 0% | 3% | 5% | first 10 years |
|---|---|---|---|---|---|---|
| `bracket-filler-texas` | benign | the rule vs no rule | +19.6% | +14.0% | +11.0% | **0.0%** |
| `bracket-filler-texas` | benign | the ceiling vs not | -16.4% | **-12.3%** | **-9.9%** | **0.0%** |
| `bracket-filler-texas` | shock | the rule vs no rule | -16.7% | **-18.9%** | **-19.8%** | **-21.9%** |
| `bracket-filler-texas` | shock | the ceiling vs not | -2.3% | -1.5% | -1.1% | 0.0% |
| `mixed-portfolio-couple` | benign | the rule vs no rule | -12.0% | -10.0% | -8.8% | -3.0% |
| `mixed-portfolio-couple` | shock | the rule vs no rule | **-3.1%** | **-12.1%** | **-16.1%** | **-27.8%** |
| `long-widowhood` | benign | the rule vs no rule | +10.3% | +6.7% | +4.9% | 0.0% |
| `long-widowhood` | benign | the ceiling vs not | -9.3% | -6.3% | -4.6% | 0.0% |
| `long-widowhood` | shock | the rule vs no rule | -22.1% | -23.1% | -23.3% | -22.4% |
| `age-gap-ira-heavy-ca` | shock | the rule vs no rule | -27.6% | -27.1% | -26.6% | -25.4% |

**The rule's gains are late and its cuts are early.** On a benign path the rule delivers
`bracket-filler-texas` 19.6% more lifetime spending and **none of it in the first ten years** - every
dollar of that gain is a prosperity raise that compounds from the middle of the plan onward, so at a
3% discount it is worth 14.0% and at 5% it is worth 11.0%. On the shock path the cuts land in the
blade years and discounting makes them worse, not better: -16.7% becomes -19.8%.

**`mixed-portfolio-couple` is the case to read twice.** On the shock its undiscounted cost is -3.1%,
which reads as almost free. The same run takes **27.8% out of the first ten years** and -16.1% at a 5%
discount. A number that says "the rule cost this household 3%" is describing a plan nobody lives:
the household gets its money back in its eighties.

**The ceiling is the mirror image**, which is the argument for it that section 7 could not make: it
gives up *late* raises and takes **0.0% out of the first ten years** on every household measured. Its
headline -16.4% on `bracket-filler-texas` is -9.9% to a household discounting at 5%, and nothing at
all to one that spends most of what it values before 75.

Three limits on all of this. A discount rate is a **preference**, not a fact, and picking one is the
household's business - which is why three are reported and none is called correct. Real discounting is
also not exponential: survival probability falls with age and would steepen every number here, while a
late-life health shock works the other way. And a fixed discount says nothing about *variability* -
`age-gap-ira-heavy-ca` loses about 27% at every rate because its cuts are spread evenly, which a
utility measure with risk aversion would score quite differently from the same loss concentrated in
two years.

**What it means for the rest of this report.** Every "lifetime real spend" column in sections 3 and 7
is the 0% column here. On the evidence above it **understates what the shipped rule costs** (its cuts
cluster early) and **overstates what the ceiling costs** (its givebacks cluster late). Any future
comparison of spending rules in this repo should carry at least the first-decade share beside the
total; it is one line of arithmetic and it changed the sign of the argument twice on this page.

---

## Predictions

Registered before the first run, against a 25% lower rail - the number the second-hand summaries
available at the time gave, since kitces.com is unreachable from this environment. The source
document arrived afterwards and carries two parameter sets, neither of them that one, so each
prediction is scored against both of the article's sets rather than re-aimed.

| id | prediction | verdict |
|---|---|---|
| `G-P1` | the shipped rule fires in the pre-benefit years on a benign path | **REFUTED**. Closest approach 1.179 against a 1.20 band; it fires on none of the four. Section 2 is what replaced it |
| `G-P2` | the shipped rule cuts earlier AND deeper than a risk rail, on every household | **PARTLY** under rails A: earlier on all four, deeper on three - `mixed-portfolio-couple` reverses it. **CONFIRMED** under rails B on the re-run; the first run's PARTLY there came from the re-plan defect noted at the top |
| `G-P3` | the shipped trigger is household-independent; the rail moves 20+ points | **REFUTED**, both sets. 3.8 points against 6.0 (A) and 4.0 (B) on the re-run (5.3 and 4.3 on the first). Section 5 explains why, and where the variation actually lives |
| `G-P4` | a full guardrail set costs under 30s per household at 200 paths | **REFUTED** as the first run measured it - 32 to 47s on the longest household across repeats - though the re-run took 21.7s, and the harness measures about twice the recipe. The recipe alone is 9,200 runs, 9-20s |

---

## What shipping it would take

Three scopes, smallest first. Only the first is priced by anything in this report.

1. **A guardrail readout.** Target-PoS spending, the two rail balances, and the adjusted spending at
   each rail, for the plan as it is. Every piece exists; the work is a panel, a worker call and a
   progress bar, on the pattern the Monte Carlo tab already uses. ~9,200 engine runs per plan.
   **Built as P128 (2026-09-16), and on the page for everyone since the same day**: solved at a
   cadence along the whole plan rather than once, drawn on the live charts, and reporting its own
   cost with a projection for other settings. The first solver, measured in the page rather than by
   this harness on its default plan at 60 paths: every 5 years, 13,800 runs in 5 seconds; every
   year, 66,240 runs in 16 seconds, against 18 projected from the first.
   [RISK_BASED_RAILS_PRECISION.md](RISK_BASED_RAILS_PRECISION.md) times the per-path solver that
   replaced it.
2. **A `spendRule: 'rbg'` beside `'gk'`.** A simulated run that follows the rails year by year. The
   rails cannot be re-solved inside every path-year - that is 200 estimates x 30 years x 200 paths -
   so it needs the article's own device: solve the rails once as *balances*, compare the running
   balance against them each year, and re-solve only when one is crossed. Whether that approximation
   holds up under Monte Carlo is not measured here and would need its own harness.
3. **The hatchet itself.** Nothing is missing: benefit ages and `spendChange` already produce the
   blade and the handle. What is missing is the reporting that would make the shape visible.
4. **A spending metric that weights early years** (section 8). The totals this report and the
   Optimizer's *Maximum Spending* objective use price year 1 and year 33 the same. Carrying the
   first-decade share, or a discounted total, beside the lifetime figure is arithmetic, not
   modelling, and it changes which rule looks better.
5. **The two things section 7 left on the table**, neither of which needs the rails: the
   `gkSpendStable` baseline and `gkShapeCeiling`. **Both done 2026-09-16 (P127b, P127a)**, the
   baseline first because it was the prerequisite.

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

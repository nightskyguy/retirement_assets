# Risk-based rails: how precise, how reachable, how costly (P128k)

The risk-based rails panel (`?nerdknob=rails`, [RISK_BASED_GUARDRAILS.md](RISK_BASED_GUARDRAILS.md))
solves Tharp and Fitzpatrick's probability-of-success guardrails along a live plan. Before building
anything more on it - an After-Tax Spend answer from the same run (`P129`), a "higher precision"
button, 100 paths every 3 years as the default - the user asked for heavy testing, with one worry
named: *"if the MC synthetic testing invariably produces a number below 100% the 99% and 100% success
rates may need adjustment."*

**What it found, in five lines:**

1. **Every rail can be reached.** No market path, in any of the three methods, fails at every level of
   wealth. The synthetic methods do not stop short of 100%; they need more wealth to get there.
2. **But "99%" and "100%" mean different things at different path counts.** From 100 paths, a 99% raise
   rail is really a 98% one, and a 100% raise rail a 99% one. With more paths the 100% rail keeps
   climbing: a 1,000-path run puts it about 37% to 44% higher than a 100-path run of the same plan, so
   a higher-precision run changes that answer rather than just steadying it.
3. **Everything at or below 95% is well behaved at 100 paths.** The cut rails, the target spend and the
   After-Tax Spend answer move about 2% to 8% from run to run, with a bias under 2%. The raise rails
   move 7% to 27%.
4. **Every 3 years is close enough.** The lines drawn between solved years sit within about 1% of an
   every-year solve (median), well inside a 100-path solve's own noise.
5. **It is not cheap.** 100 paths every 3 years took 12 to 26 seconds per household on a fast machine,
   which is 45 seconds to nearly 3 minutes on the ten-year-old laptops the page is written for. The
   After-Tax Spend answer adds 3% to 5% to that.

Produced by [`.test_harnesses/rails_precision_harness.js`](../.test_harnesses/rails_precision_harness.js)
on engine v11.1857 (unchanged in 11.1858), 2026-09-16: 10.7 million engine runs for the pools plus the
jobs, 51 minutes on 16 processes. Every number below is printed by that script (`--from` re-prints
the tables from the saved results in seconds) or is arithmetic on its printed numbers and says so,
except section 7, which was measured on the page. The harness also ran one household read from a file outside the repository - a user's own
plan; its rows are left out of this report and it changed no conclusion.

---

## Reading guide

### Codes

| code | meaning |
|---|---|
| **PoS** | probability of success: the share of market paths on which the plan funds every remaining year, by the Monte Carlo tab's own test (`yearIsRuined`: a year is ruined when its year-end portfolio cannot cover that year's spending less guaranteed income) |
| **solve** | one run of the live rails job (`runRailsJob`, `montecarlo/rails_engine.js`): at each solved year, PoS as planned, the target spend, the raise rail, the cut rail, and the spend back on target at each rail |
| **raise rail / cut rail** | the wealth at which the plan's own spending reaches the preset's raise PoS (99% for Tight and Normal, 100% for Loose) or falls to its cut PoS (80% / 70% / 40%). Reported here as a multiple of the TotalNetWealth the plan actually has |
| **target spend** | the spending that puts the plan exactly at the preset's target PoS (95% / 90% / 80%), as a multiple of the plan's own spending |
| **start solve** | the After-Tax Spend answer `P129` proposes: the spending, from the plan's own first year, at which PoS is 90% |
| **`s` of a path** | the smallest wealth multiple at which that one market path survives, the plan's spending held |
| **`m` of a path** | the largest spending multiple at which that one market path survives, the plan's wealth held |
| **pool** | 6,000 market paths for one household and one method, seed 42, each with its `s` and `m` found by a 12-step bisection between 0.05x and 64x (`s`) or 0.02x and 16x (`m`) |
| **N** | the number of paths behind one PoS estimate - the panel's *Paths* box |
| **slice** | N paths taken from a pool without overlap. A Historical slice holds the same quarter of bear-start paths a real N-path run holds |
| **bias** | the mean of the slices' answers over the whole pool's answer, less 1 |
| **spread** | the standard deviation of the answers over their reference - the pool's answer for slices, the mean for seeds. How far one run's answer typically sits from another's |
| **lands on** | for a raise rail answered from N paths: the share of the whole pool that needs no more wealth than that answer. Which percentile "99%" actually turned out to mean |
| **clamped** | an answer the live solve reports at the edge of its search: wealth beyond 4x or below 0.05x, spending beyond 4x or below 0.1x |
| **as solved / corrected** | the count of surviving paths a q% answer demands: the solver's rule is the least c with c / N >= q; the corrected rule is c = q x (N + 1), capped at N (section 3) |
| **cadence** | years between solved years; the years between are interpolated in today's dollars |
| **Historical** | the Monte Carlo tab's block bootstrap of 1928-2025, with 25% of paths opening on one of history's worst starts |
| **Synth GBM / Synth AAM** | the tab's two synthetic methods: lognormal and arithmetic returns from the plan's Growth with 12% volatility, inflation from the fitted model |

The pool method rests on one assumption - that a path which survives at some wealth also survives at
any higher wealth, and one that fails at some spending also fails at any higher spending. It was
checked, not assumed: 10,800 path checks along a 13-point grid, **no exceptions**. Given that, a
solve's answer from N paths is an order statistic of those paths' `s` or `m`, so disjoint slices of a
pool are independent N-path runs and their spread is the run-to-run spread a person would see.

### The households

Eight from the plan bank, chosen for range: two that fail often, two that almost never do, a long
widowhood, a lean plan, a large IRA, a single filer.

| household | plan years | PoS, first full year: Historical | Synth GBM |
|---|---|---|---|
| [`bracket-filler-texas`](../plans/bracket-filler-texas.js) | 33 | 99.9% | 97.2% |
| [`mixed-portfolio-couple`](../plans/mixed-portfolio-couple.js) | 33 | 64.9% | 43.5% |
| [`long-widowhood`](../plans/long-widowhood.js) | 38 | 94.4% | 79.7% |
| [`age-gap-ira-heavy-ca`](../plans/age-gap-ira-heavy-ca.js) | 25 | 97.2% | 92.7% |
| [`modest-balances-little-surplus`](../plans/modest-balances-little-surplus.js) | 29 | 90.9% | 73.7% |
| [`high-spend-large-ira`](../plans/high-spend-large-ira.js) | 26 | 93.5% | 80.7% |
| [`single-filer-long-horizon`](../plans/single-filer-long-horizon.js) | 30 | 100.0% | 99.6% |
| [`soft-cap-underfunded`](../plans/soft-cap-underfunded.js) | 24 | 64.6% | 37.5% |

Synth AAM tracks Synth GBM within about a point on every household (1.1 at most). **Historical is
kinder than both on every one**, by 0.4 to 28 points - it samples real 1928-2025 returns, where the
synthetic methods use the plan's own Growth assumption.

### The grid

| part | what ran |
|---|---|
| pools | 6,000 paths x 8 households x 3 methods, at the plan's start, its first full year and a mid-plan year |
| slices | N = 100, 200, 500 and 1,000 |
| jobs | the Normal preset (90% target, raise 99%, cut 70%), 100 paths, every 3 years, seeds 1-10, each with a start solve at 100 and at 500 paths |
| cadence | the Normal preset solved every year at 400 paths, seed 42, Historical and Synth GBM |
| cost | one job at a time on an idle process, Historical, AMD Ryzen AI 9 HX 370, node v26.2.0 |

---

## What it found

### 1. Every rail can be reached; none of the three methods stalls below 100%

At the first full year, the wealth each share of paths needs, as a multiple of what the plan has
(Historical / Synth GBM):

| household | 90% at | 99% at | 99.9% at | all 6,000 at |
|---|---|---|---|---|
| `bracket-filler-texas` | 0.60x / 0.78x | 0.81x / 1.18x | 1.00x / 1.65x | 1.55x / 1.89x |
| `mixed-portfolio-couple` | 1.33x / 1.74x | 1.82x / 2.63x | 2.25x / 3.69x | 3.46x / 4.28x |
| `long-widowhood` | 0.87x / 1.24x | 1.56x / 2.18x | 2.56x / 3.40x | 4.10x / 4.37x |
| `age-gap-ira-heavy-ca` | 0.78x / 0.94x | 1.20x / 1.42x | 1.84x / 2.09x | 2.69x / 3.13x |
| `modest-balances-little-surplus` | 0.98x / 1.33x | 1.52x / 2.18x | 2.22x / 3.54x | 4.62x / 5.00x |
| `high-spend-large-ira` | 0.93x / 1.19x | 1.30x / 1.83x | 1.83x / 3.03x | 2.12x / 3.62x |
| `single-filer-long-horizon` | 0.46x / 0.58x | 0.62x / 0.86x | 0.80x / 1.22x | 1.09x / 1.46x |
| `soft-cap-underfunded` | 1.33x / 1.87x | 1.80x / 3.02x | 2.34x / 4.58x | 3.18x / 5.49x |

**No path, in any method, fails at every wealth up to 64x.** The share that needs more than the live
solve's 4x bracket is at most 0.25% (`soft-cap-underfunded`, Synth AAM). So the synthetic methods do
not invariably stop below 100%. They report a lower PoS at the plan's own wealth, and they need more
wealth to reach any rail - 1.46x to 5.58x for every one of 6,000 paths, against 1.09x to 4.62x on
Historical - but every rail is there to be found.

What stops short of 100% is the **sample**, and that is the next section.

### 2. "99%" and "100%" drift with the path count; everything at 95% and below does not

Wealth rails at the first full year, Historical, bias / spread (Synth GBM in brackets where it differs
materially):

| survive | N = 100 | N = 200 | N = 500 | N = 1,000 |
|---|---|---|---|---|
| 40% (Loose cut) | -0.3% / 3.9% | -0.2% / 2.7% | -0.0% / 1.4% | 0.0% / 1.0% |
| 70% (Normal cut) | -0.4% / 3.7% | -0.2% / 2.4% | -0.1% / 1.7% | 0.0% / 1.4% |
| 80% (Tight cut) | -0.6% / 3.8% | -0.2% / 3.0% | -0.0% / 1.8% | -0.0% / 1.4% |
| 90% | -0.6% / 4.7% | -0.2% / 3.6% | -0.1% / 2.1% | -0.1% / 1.3% |
| 95% | -1.3% / 6.7% | -0.8% / 4.9% | -0.6% / 3.0% | -0.2% / 2.1% |
| **99%** (Tight, Normal raise) | **-5.0% / 10.0%** (-6.6% / 15.3%) | -2.4% / 7.7% (-3.3% / 11.2%) | -0.9% / 5.3% | -0.5% / 4.0% |
| **100%** (Loose raise) | **-43.6% / 10.9%** (-39.9% / 13.4%) | -38.4% / 12.0% | -31.0% / 13.3% | -22.5% / 13.8% |

The 100% row is measured against the pool's own 100% - the worst of 6,000 paths - which is itself a
moving target: it only rises as paths are added. What the answers *mean* is clearer as the percentile
of the pool each lands on (all three methods agree to 0.03 points):

| asked | N = 100 | N = 200 | N = 500 | N = 1,000 |
|---|---|---|---|---|
| 99% | 98.05% | 98.56% | 98.85% | 98.93% |
| 100% | 98.98% | 99.56% | 99.81% | 99.93% |

**Why.** A 99% answer from 100 paths is decided by the second-worst path, and the second-worst of 100
sits, on average, at the 98th percentile of the paths it was drawn from. A 100% answer is decided by
the worst path, which sits at the 99th. More paths push both toward what was asked - and push 100%
past 99.9%, without limit. So Loose's 100% raise rail at the default 100 paths is, in practice, a 99%
rail. Read from the bias row (arithmetic, not a printed number): against a 100-path run of the same
plan, a 500-path run puts it 22% to 32% higher and a 1,000-path run 37% to 44% higher, depending on
the method.

The target spend behaves like the low rails: at 100 paths a bias of +0.5% to +1.5% and a spread of
2.8% to 4.5%, falling to 0.9% to 1.5% at 1,000 paths, on all three methods and at both the first full
year and the plan's start.

### 3. A path-count correction fixes what "99%" means, not how much it moves

Demanding c = q x (N + 1) survivors instead of q x N centres the answer on q at every path count
(Historical; the synthetic methods agree to 0.05 points on where it lands):

| asked | rule | N = 100 lands / spread | N = 200 | N = 500 | N = 1,000 |
|---|---|---|---|---|---|
| 99% | as solved | 98.05% / 10.4% | 98.56% / 7.9% | 98.85% / 5.3% | 98.93% / 4.1% |
| 99% | corrected | 98.98% / 18.2% | 99.01% / 9.6% | 99.05% / 6.1% | 99.05% / 4.0% |
| 99.5% | corrected | cannot be met | 99.56% / 17.7% | 99.62% / 10.8% | 99.54% / 5.3% |
| 100% | corrected | cannot be met at any N | | | |

The cost is noise at small N: at 100 paths the corrected 99% rail IS the worst path, and it moves
18.2% run to run on Historical, 23.4% to 24.2% on the synthetic methods. Two things follow from the
arithmetic rather than from a preference: **99.5% needs at least 199 paths**, and **100% cannot be
asked of a finite sample at all** - "every path survived" is a statement about the sample, not the
plan. Applied to the target spend, the correction only swaps a small upward bias for a small downward
one (-0.2% to -1.0% at 100 paths) with about the same spread, so it is not worth doing there.

### 4. The job a person would run: steady except at the raise rail

Normal, 100 paths, every 3 years, ten seeds. Spread across seeds at the first full year (and the
median over every solved year):

| household | PoS year 1 | raise rail | cut rail | target spend | spend at raise | spend at cut |
|---|---|---|---|---|---|---|
| `bracket-filler-texas` | 99.9% +/- 0.3 | 8.9% (7.8%) | 4.1% (3.4%) | 3.4% (2.4%) | 6.2% (5.0%) | 2.8% (2.4%) |
| `mixed-portfolio-couple` | 62.2% +/- 4.8 | 8.1% (7.0%) | 3.9% (3.2%) | 2.7% (1.8%) | 6.2% (5.2%) | 3.3% (2.5%) |
| `long-widowhood` | 94.2% +/- 2.3 | 26.5% (21.5%) | 4.9% (4.7%) | 6.5% (6.3%) | 14.4% (14.4%) | 5.3% (4.8%) |
| `age-gap-ira-heavy-ca` | 97.1% +/- 1.3 | 7.8% (8.4%) | 5.1% (4.4%) | 3.6% (3.9%) | 4.9% (4.9%) | 2.9% (2.4%) |
| `modest-balances-little-surplus` | 91.7% +/- 2.8 | 14.6% (11.8%) | 5.7% (4.9%) | 2.3% (2.4%) | 6.2% (5.9%) | 1.8% (2.3%) |
| `high-spend-large-ira` | 93.5% +/- 2.2 | 11.3% (7.7%) | 2.6% (2.5%) | 3.2% (3.0%) | 6.9% (5.8%) | 2.2% (1.9%) |
| `single-filer-long-horizon` | 100.0% +/- 0.0 | 7.5% (6.1%) | 3.0% (2.4%) | 2.8% (2.6%) | 4.5% (3.0%) | 1.9% (1.3%) |
| `soft-cap-underfunded` | 65.0% +/- 4.2 | 11.3% (9.4%) | 3.6% (2.6%) | 1.7% (1.5%) | 6.5% (5.9%) | 1.3% (1.3%) |

That is Historical. On the synthetic methods the raise rail moves 9.7% to 26.6% at the first full year,
the cut rail 2.5% to 8.1%, the target spend 2.8% to 6.6%. **The spend at the raise rail inherits the
raise rail's noise** (4.4% to 15.9%), because it is measured at wherever that rail landed.

The raise rail hit the edge of its search in 0% to 10% of solved years - households so far above
target late in the plan that even a twentieth of their wealth would stay above the rail.

### 5. The After-Tax Spend answer (`P129`) is cheap, and about as steady as the target spend

From the plan's own start, spending for a 90% chance, mean and spread across the ten seeds:

| household | plan's goal | N = 100 | range over seeds | N = 500 |
|---|---|---|---|---|
| `bracket-filler-texas` | $110,000 | $153,248 +/- 3.3% | $144,482 - $161,885 | $151,637 +/- 2.1% |
| `mixed-portfolio-couple` | $234,000 | $196,034 +/- 2.8% | $186,903 - $206,235 | $194,060 +/- 1.7% |
| `long-widowhood` | $150,000 | $169,507 +/- 6.1% | $147,759 - $187,354 | $162,129 +/- 2.8% |
| `age-gap-ira-heavy-ca` | $220,000 | $253,645 +/- 3.5% | $237,402 - $268,340 | $249,004 +/- 1.2% |
| `modest-balances-little-surplus` | $105,000 | $106,006 +/- 2.3% | $101,585 - $109,614 | $103,822 +/- 2.1% |
| `high-spend-large-ira` | $240,000 | $250,413 +/- 3.1% | $235,148 - $260,391 | $245,063 +/- 1.0% |
| `single-filer-long-horizon` | $90,000 | $148,271 +/- 2.8% | $141,943 - $153,018 | $144,316 +/- 2.2% |
| `soft-cap-underfunded` | $160,000 | $137,078 +/- 2.0% | $133,984 - $142,422 | $136,741 +/- 1.0% |

(Historical.) On the synthetic methods the 100-path spread is 2.8% to 6.3% and the 500-path spread
1.7% to 4.0%. No answer hit the edge of its search. On Historical the 100-path answers sit 0.3% to
4.6% above the 500-path ones (-1.0% to +3.1% on the synthetic methods; arithmetic on the table), in
line with the pool's small upward bias for this answer, +0.7% to +0.9% at 100 paths.

Two checks the plan relied on held: scaling the plan-start record's goal and typing the scaled goal
agreed on **60 of 60** path runs, so the answer needs no conversion; and the solve costs
**1,000 engine runs at 100 paths** - 0.59 to 0.89 seconds on an idle process (section 6), 3% to 5% of
the rails job it would ride with.

### 6. Every 3 years is close enough; the cost is what matters

Interpolated lines against solving that year, Normal, 400 paths, seed 42 - median / 90th percentile of
the error, as a share of that row's TotalNetWealth (rails) or of the plan's spending (spend lines):

| method | cadence | raise rail | cut rail | target spend | spend at raise | spend at cut |
|---|---|---|---|---|---|---|
| Historical | every 2 | 0.5% / 3.4% | 0.2% / 1.7% | 0.3% / 1.8% | 0.6% / 2.1% | 0.3% / 0.7% |
| Historical | every 3 | 0.8% / 4.1% | 0.3% / 1.9% | 0.6% / 3.9% | 0.8% / 2.5% | 0.3% / 1.0% |
| Historical | every 5 | 0.9% / 4.6% | 0.4% / 2.6% | 1.3% / 9.4% | 0.8% / 3.2% | 0.4% / 1.0% |
| Synth GBM | every 2 | 0.6% / 5.1% | 0.2% / 2.1% | 0.3% / 2.1% | 0.6% / 2.6% | 0.3% / 0.7% |
| Synth GBM | every 3 | 0.7% / 4.6% | 0.3% / 2.3% | 0.5% / 4.3% | 0.8% / 2.3% | 0.3% / 0.9% |
| Synth GBM | every 5 | 1.0% / 8.2% | 0.3% / 3.0% | 1.3% / 9.3% | 0.9% / 3.0% | 0.3% / 0.9% |

Rows whose own solve or either end of their interpolation hit a search edge are left out. The
raise-rail column barely improves from every 3 to every 2, which says most of its "error" is the
400-path solve's own noise rather than the straight line. The job at cadence 3 was checked to be
exactly the every-year job's every third year, which is what makes this comparison exact.

Cost, one job at a time on an idle process (Historical):

| household | plan years | solves | runs | every 3, 100 paths | + start solve | every 5, 200 (proj.) | every 3, 500 (proj.) | every 3, 1,000 (proj.) |
|---|---|---|---|---|---|---|---|---|
| `bracket-filler-texas` | 33 | 11 | 50,600 | 20.27 s | 702 ms | 25.8 s | 101.3 s | 202.7 s |
| `mixed-portfolio-couple` | 33 | 11 | 50,600 | 22.25 s | 789 ms | 28.3 s | 111.2 s | 222.5 s |
| `long-widowhood` | 38 | 13 | 59,800 | 26.04 s | 894 ms | 32.9 s | 130.2 s | 260.4 s |
| `age-gap-ira-heavy-ca` | 25 | 8 | 36,800 | 12.20 s | 619 ms | 15.8 s | 61.0 s | 122.0 s |
| `modest-balances-little-surplus` | 29 | 10 | 46,000 | 15.88 s | 740 ms | 20.4 s | 79.4 s | 158.8 s |
| `high-spend-large-ira` | 26 | 9 | 41,400 | 15.18 s | 738 ms | 19.5 s | 75.9 s | 151.8 s |
| `single-filer-long-horizon` | 30 | 10 | 46,000 | 16.07 s | 623 ms | 20.5 s | 80.4 s | 160.7 s |
| `soft-cap-underfunded` | 24 | 8 | 36,800 | 13.49 s | 589 ms | 17.5 s | 67.4 s | 134.9 s |

Three runs of the first household took 20.27, 21.03 and 20.76 seconds. The projection is the page's
own (`railsProjectMs`), priced from the 100-path run; for 500 paths it said 102.06 s and the run took
107.13 s. **On a machine 3.5 to 6 times slower** - single-core speed is what matters to a browser -
100 paths every 3 years plus the start solve is **44.9 to 161.6 seconds** (the harness's own
slower-machine column), and a 500-path run is 3.6 to 13 minutes (arithmetic on the 500-path column).
Every 3 years at 100 paths is about 20% cheaper than today's default of every 5 at 200.

### 7. Measured on the page, not by this harness: what runs beside what

Default page plan (25 years), Normal, every 3 years, 100 paths, Historical, over http on the same
machine, with the browser pane hidden - so Chrome deferred some drawing, which these numbers do not
count:

| case | rails | Stress Test refresh | My Plan Only (400 paths) | main-thread tasks over 50 ms |
|---|---|---|---|---|
| each alone | 8.8 - 8.9 s (7.6 s solving) | 1.30 - 1.55 s (45 - 47 ms of it work) | 1.73 - 1.90 s | none |
| rails, and a Stress Test refresh 1 s in | 8.9 - 11.3 s | 1.49 - 1.53 s | | one, 50 ms |
| My Plan Only, and rails 0.5 s in | 9.1 - 10.8 s | | 1.75 - 1.79 s | none |
| file:// (everything on the page's thread): rails alone | 13.3 - 16.2 s | 29 ms | | none |
| file://: rails, and a Stress Test refresh 1 s in | 12.9 s | 36 - 44 ms | | none |

Each case ran twice; the ranges are the two runs, and the long-task column is from the second, which
watched for them. Over http the three are separate workers: neither the Stress Test nor My Plan Only
waited on a rails solve, the solve itself ran 0% to 28% longer when the others overlapped it, and the
page stayed free. A Stress Test refresh is under 50 ms of work and over a second of starting a worker;
on file://, with no worker to start, it takes 29 to 44 ms. On file:// the rails solve shares the
page's thread in 16 ms slices, which kept every task under 50 ms but made the solve 45% to 85% longer.

---

## What this means for the decisions it was run for

These are measurements, not decisions; the choices stay with the user.

- **100 paths every 3 years** is enough for the target spend, the cut rails and the After-Tax Spend
  answer (a few percent run to run), and every 3 years is close enough to solving every year. It is
  not enough for the 99% and 100% raise rails, which move 7% to 27% run to run and mean 98% and 99%.
- **The 99% and 100% thresholds** are where the user's worry lands, for a different reason than the
  one named: the synthetic methods reach 100%, but no finite sample can say what 100% means, and 99%
  at 100 paths is decided by one path. Measured options: keep them and label them; correct the count
  (fixes the meaning, adds noise at 100 paths); solve the raise rail alone with more paths; or lower
  the raise threshold, where 95% moves 6.7% to 7.9% at 100 paths with a bias under 2%.
- **The After-Tax Spend answer** costs about 5% of the job and is steady to about 3% at 100 paths and
  about 2% at 500. A higher-precision pass for that one number is 5,000 runs: a few seconds here.
- **A higher-precision button for the whole job** is minutes, not seconds, on the audience's machines,
  and on the 100% rail it changes the answer rather than refining it.

## Open questions this report does not settle

- **A per-path solve.** Finding each path's `s` once costs 14 runs a path, and gives every wealth rail
  of every preset at once; bisecting PoS costs 9 x N runs per rail. At 100 paths that is 1,400 runs
  against 1,800 for the two rails. It would not reduce noise - that is set by N - but it would make a
  preset switch free and allow a smoothed estimate between paths. Not built; not measured beyond this
  arithmetic.
- **Mid-plan and late years.** The pools were solved at the first full year (and the start); the job
  and cadence parts cover every year, but the reach and correction tables do not.
- **Other presets in the job.** Only Normal was run seed after seed; Tight and Loose were measured
  through the pools.

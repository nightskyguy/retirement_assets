# The risk-based spend rule against re-solving the chance every year (P132)

Whether the cheap risk-based spend rule - `spendRule: 'rbg'`, the **Risk-based** setting of the
Guardrails switch - follows the same spending path a household would follow if it re-solved its
chance of success at the start of every year. The cheap rule never solves a probability: it reads a
table the rails solver produced once for the plan and applies it to whatever wealth a path has, which
is what lets Monte Carlo and the Optimizer run it at the cost of one comparison a year. This report
measures what that approximation costs, and finds the one setting under which it costs almost nothing.

Produced by [`.test_harnesses/rbg_playback_harness.js`](../.test_harnesses/rbg_playback_harness.js)
on engine v11.18b2 (2026-09-20; first run 2026-09-19 on v11.189d), two runs:
`node .test_harnesses/rbg_playback_harness.js` and the same with `--ceiling`. Every number below is
printed by that script; the two summary tables in the appendix are its output unedited. The presets
are named as the harness prints them: `normal` is the page's Normal, `paper` its More Risk.

**What it found, in four lines (re-run of 2026-09-20):**

1. **With Never above plan on, the cheap rule IS the exact rule on a plan the rails never cut**
   (`bracket-filler-texas`: 12 of 12 cases identical to the dollar) **and within 0% to 6% of it on
   average elsewhere** but one case (`mixed-portfolio-couple`, 1929, More Risk: 12.8%), with every
   one of 60 cases funded under both rules. The largest single-year gaps, 10% to 28%, are the years
   of a cut, where the two land at different levels.
2. **Without it, both rules drift**: the exact rule raises spending to several times the plan by the
   2050s on the long plans, the cheap rule's table was solved near the plan and is 30% to 66% off out
   there, and about one case in five FAILS TO FUND under the exact rule itself (11 of 60) or the
   cheap one (12 of 60) - the record wraps from 2025 back into 1929-1932 after two decades of raises.
3. **Four approximations were measured and three were closed on the way.** Spending net of Social
   Security and pensions (a fixed-dollar offset a ratio cannot see), the rule's inflation timing (a
   year's lag against the plan's own path), a rail under the solver's floor, and - found after the
   first run - the interpolation between solved years across a benefit start, which now works in
   dollars, and the landing line beyond a rail, which now holds the rail's own ratio (section 3).
   What is left is the landing at a cut, and it is what the single-year gaps are.
4. **More Risk is gentler and later on every household**, as its article claims - and on six of
   the thirty no-ceiling cases the exact More Risk rule is the one that fails to fund, because a
   cut that waits for a 25% chance and returns only to 45% can come too late.

Decided on the strength of it: **Never above plan is recommended when Risk-based is chosen** (the
page turned it on by itself at first; since 2026-09-19 it never touches the switch, on the user's
instruction, and says so under the Guardrails switch when it is off).

---

## Reading guide

### Codes

| code | meaning |
|---|---|
| **the rule** / **cheap** | `spendRule: 'rbg'` in `simulate()` (`resolveSpendTarget`, `optimizer_core.js`), reading `inputs.rbgRails` - the table `railsRuleTable` (`montecarlo/rails_engine.js`) builds from one rails job |
| **exact** | the same rule followed to the letter along one sequence: at the start of each year, the plan's chance of success on N fresh market paths from its state as it actually is; on a crossing, the spending that returns the chance to the preset's level found by bisection; then the year lived on the real record. N runs a year plus about 11N on a crossing |
| **cheap, every year** | the cheap rule with a table solved every year instead of every 3, to separate the cadence's interpolation from the rest |
| **no rule** | the same plan on the same sequence with no spend rule: the plan's own path, and the **shape** every spending figure is measured against |
| **GK-style** | the same plan with the Guyton-Klinger-style Guardrails rule, for scale |
| **Paper** | in sections 1 to 5, the preset the page now calls **More Risk** (key `paper`); the harness prints the key |
| **CoS** / chance | probability of success by the Monte Carlo tab's own test (`yearIsRuined`): the share of paths on which the plan funds every remaining year |
| **table** | per plan year: the ratio of net spending to wealth at which the chance falls to the cut rail (`cutAt`) or reaches the raise rail (`raiseAt`), and for each a line through the two solved points of that chance curve giving the net spend to land on as a function of wealth; net of that year's Social Security and pension, in today's dollars |
| **the spine** | the plan as configured, deterministic growth, no rule: what the table is solved on |
| **ceiling** | Never above plan (`gkShapeCeiling`): a raise can take spending no higher than the shape. Applied identically to the exact rule (its landing capped at the no-rule spend for the year) and to the cheap one |
| **matched** | an exact adjustment with a cheap adjustment in the same year or one either side |
| **gap** | cheap spending over exact spending for the year, less 1 |
| **near plan** | years in which the exact rule's spending is within 1.5x of the shape |
| **trough** | the lowest real spending against the shape, over the plan |
| **lifetime real** | real spending summed over the plan; the exact and cheap totals differ from the shape's only through the rule |
| **funded** | no year ruined by the tab's test |

### The presets

Two of the page's presets, by key. **Normal** (`normal`): target 90%, raise at 99%, cut at 70%, a cut returning
to 90%. **More Risk** (`paper`): target 80%, raise at 99.5%, cut at 25%, a cut returning to 45% - the 2024
article's own numbers (Tharp and Fitzpatrick, *Why Guyton-Klinger Guardrails Are Too Risky For Most
Retirees*, Kitces.com, 2024-03-27), read with 100% as 99.5% for the reason
[RISK_BASED_RAILS_PRECISION.md](RISK_BASED_RAILS_PRECISION.md) gives.

### The households

Five from the plan bank, chosen to span the rule's reach: one it never cuts, two it cuts hard, one
long widowhood, one underfunded.

| household | plan years | plan spend | shape |
|---|---|---|---|
| [`bracket-filler-texas`](../plans/bracket-filler-texas.js) | 33 | $110,000 | flat |
| [`modest-balances-little-surplus`](../plans/modest-balances-little-surplus.js) | 29 | $105,000 | flat |
| [`long-widowhood`](../plans/long-widowhood.js) | 38 | $150,000 | flat |
| [`soft-cap-underfunded`](../plans/soft-cap-underfunded.js) | 24 | $160,000 | -1%/year |
| [`mixed-portfolio-couple`](../plans/mixed-portfolio-couple.js) | 33 | $234,000 | flat |

### The grid

| knob | value |
|---|---|
| sequences | the real record from 1929, 1937, 1966, 1973, 2000 and 2007: equity, bonds, international (equity before 1970) and CPI, blended per account through the plan's own mix the way the Stress Test does, wrapping to 1928 past 2025 |
| chance model | the page's default: Synthetic GBM at the plan's Growth, 12% volatility, seed 42, 100 paths - the same paths, by seed, for the table and for every exact solve |
| table | every 3 years (the panel's default), and every year for the comparison column |
| bisection | 9 steps on the spending multiple, about 0.4% |
| arms | exact, cheap, cheap every year, no rule, GK-style; each once without the ceiling and once with it |
| cost | 5 households as 5 processes, both runs at once on the same machine (AMD Ryzen AI 9 HX 370, node v26.2.0), so the timings are contended |

**The criterion registered before the run** (the P132 plan): ship the cheap rule if its adjustments
land in the same year as the exact rule's, plus or minus one, and its spending sits within the
solve's own run-to-run noise - 3% to 5% at 100 paths (RISK_BASED_RAILS_PRECISION.md, section 4).

---

## What it found

Sections 1, 2, 4 and 5 quote the first run (v11.189d, 2026-09-19); the four lines above and the
appendix are the re-run of 2026-09-20 on v11.18b2, and where a figure differs the appendix is the
current one. The direction of every finding is the same in both runs.

### 1. With the ceiling on, the cheap rule meets the criterion

Mean gap over every year of the plan, the two rules' adjustment counts, and how many of the exact
rule's adjustments the cheap rule matched within a year (Normal / Paper), read off the ceiling table
in the appendix:

| household | mean gap, Normal | mean gap, Paper | matched, Normal | matched, Paper | funded |
|---|---|---|---|---|---|
| `bracket-filler-texas` | 0.0% on all six starts | 0.0% on all six | 23-28 of 22-31 | 14-26 of 17-30 | 12 / 12 |
| `modest-balances-little-surplus` | 1.6% to 7.5% | 0.0% to 4.1% | 11-21 of 11-21 | 9-16 of 9-17 | 12 / 12 |
| `long-widowhood` | 0.3% to 3.4% | 0.0% to 0.2% | 19-31 of 21-33 | 15-27 of 17-30 | 12 / 12 |
| `soft-cap-underfunded` | 1.3% to 6.1% | 0.3% to 10.3% | 7-13 of 7-14 | 4-10 of 6-10 | 12 / 12 |
| `mixed-portfolio-couple` | 0.9% to 3.4% | 0.1% to 6.6% | 16-24 of 16-24 | 9-14 of 10-14 | 12 / 12 |

`bracket-filler-texas` is the clean case: the rails never call for a cut on any of the six starts,
every raise is capped at the shape by both rules, and the two spending paths are identical to the
dollar. The unmatched adjustments there are re-raises the ceiling clamps at the shape every year,
which the cheap rule stops labelling once its ratio is inside the rails and the exact one keeps
labelling while its chance stays at the raise rail - a label, not a dollar.

Where the rules cut, the mean gap is a few percent and the largest single-year gap is the year of a
cut: 13% to 33% on `modest-balances-little-surplus` (Normal), 10% to 35% on `soft-cap-underfunded`.
The two rules cut in the same year and land at different levels, and the level is where what is left
of the approximation lives (section 3). The trough against the shape agrees to a few points in most
cases and by ten or more in a few (`long-widowhood` 1973 Normal: -19% exact, -35% cheap;
`modest-balances-little-surplus` 1937 Normal: -25% against -14%).

### 2. Without the ceiling, both rules drift, and one in five fails

Without the ceiling the exact rule does what the article's rule does: on a 1937 or 1966 start it
raises spending on `bracket-filler-texas` to $1.4M to $1.9M a year by the 2050s against a $290,000
shape, and on `long-widowhood` to lifetime real spending of $12.6M to $19.2M against $5.7M. Out
there the table, solved at the plan's own spending, is 30% to 66% off at the tail, and the cheap
rule follows it. Mean gaps run 2% to 14%, twice to four times the ceiling run's.

The record wraps: a 33-year plan starting in 2000 lives 2025 and then 1928-1932. A household that
has raised spending fourfold meets that crash with the horizon nearly gone, and **11 of the 60 exact
runs fail to fund** - five of them the Paper preset, whose cut waits for a 25% chance - as do 13 of
the cheap ones. With the ceiling on, 60 of 60 fund under both.

That is the argument for the default. The article's rule, followed exactly, spends good markets up
to the hilt and takes the consequences; the ceiling is what makes it a rule about protecting a plan
rather than about consuming everything a plan turns out to allow. And it is where the cheap rule is
exact, because it is where a path's spending is the spending the rails were solved for.

### 3. What the cheap rule approximates, and what was fixed on the way

The table is dimensionless, in the sense that lets a path with any wealth read it: the rails solver
finds every rail by scaling the plan's balances by one factor, so a rail is a spend-to-wealth ratio.
Three things break that scaling, and the harness's first quick run showed all three.

**Social Security and pensions are fixed dollars.** A path that has raised its spending fourfold has
the same benefits, so a ratio on gross spending misplaces both its triggers and its landings. The
table and the rule now work in spending NET of the year's guaranteed income - the same
reason the `_wdRate` column of Annual Details exists - and the landing is a LINE through the two
solved points of each chance curve (the rail's own spend, and the spend at the plan's wealth), which
is the first-order answer to an offset. On the spine the rule lands exactly on the solver's answer,
which `optimizer_core.tests.js` pins.

**Inflation timing.** The rule applied the year's inflation at the start of the year, as the
GK-style rule does; the plan without a rule applies the year's inflation at its end. Under a real
sequence those differ by a year of inflation, and in 1946 (18%) that read as a 15% gap in a year
neither rule adjusted. The rule now takes inflation where the plan does.

**Interpolation across a Social Security start (found 2026-09-19, after this run).** Between two
solved years the table used to interpolate the RATIOS. Where a benefit starts between two solves,
total spending capacity is smooth across the start (the solve before it already priced the benefit
in) but spending net of the benefit halves, so a net ratio interpolated across the step was wrong
for every year between - and a plan on the page raised in its first Social Security year on a raise
rail it had not reached (chance 78%, raise level 90%), then cut two years later. The job now hands
the table every plan year of its spine, the dollars are interpolated in today's terms, and each
year's row is netted at that year's own guaranteed income. The households above all have Social
Security running from the plan's start, which is why this run did not see it; a re-run of the quick
case (bracket-filler-texas, 1937 and 2000, ceiling) after the change is unchanged: exact and cheap
identical, 0.0% gap.

**A rail under the solver's floor is $0.** The panel draws it that way (user, 2026-09-18). For the
RAISE rail that means the plan reaches the raise chance at any wealth the search looked at, which
the rule first read as "no rail, never fire" and now reads as "fires at any ratio, landing through
the plan-wealth point". For the CUT rail it means the chance never falls to the cut level at any
such wealth, and that side never fires. Late in a plan both rails are often under the floor, which
is why the earliest run's cheap rule stopped raising while the exact rule kept going.

What is left is the landing at a cut on a path whose state is not the spine's: a different account
mix, a different tax position, a spending level the two solved points bracket loosely. That is the
single-year gap of section 1. A third solved point on the cut side (pass 2 of the rails job at a
lower wealth) would narrow it and cost about a third more per solved year; not built, because the
mean gap is already inside the criterion and the trough differences are the noise of a 100-path
solve as often as they are the landing.

### 4. Paper is later and gentler, and sometimes too late

On every household and start the Paper preset adjusts fewer times than Normal (3 to 30 against 6 to
33 in the ceiling run) and, where both cut, cuts less deep: `modest-balances-little-surplus` on a
1929 start troughs at -15% under Paper and -31% under Normal, `soft-cap-underfunded` on 1937 at -18%
against -35%, `long-widowhood` on 1937 at 0% against -26%. That is the article's claim reproduced on
this engine, with GK-style at -33% to -53% on the same rows for scale.

The price shows without the ceiling: of the 11 exact runs that fail to fund, 5 are Paper
(`bracket-filler-texas` 2007, `modest-balances-little-surplus` 2000 and 2007, `long-widowhood` 1929
and 2007), where waiting for a 25% chance and returning to 45% left too little for a crash that came
with the horizon nearly gone. With the ceiling, Paper funds every case too.

### 5. Cost

One task is one household: two table jobs (every 3 years and every year), then for each of six
starts and two presets an exact walk, a cheap run with its chance measured every year, and a cheap
run at cadence 1. Both runs at once, five processes each, so every figure is contended and about
twice what an idle process would show (RISK_BASED_RAILS_PRECISION.md section 6 has the idle numbers
for the table job: 7 to 14 seconds).

| household | plan years | table job (every 3) | table job (every year) | exact walk per sequence, no ceiling / ceiling | task total, no ceiling / ceiling |
|---|---|---|---|---|---|
| `bracket-filler-texas` | 33 | 33 s, 31,894 runs | 87 s, 82,860 runs | 9.6 s / 22.5 s (12,092 / 27,875 runs) | 273 s / 424 s |
| `modest-balances-little-surplus` | 29 | 28 s, 29,096 runs | 77 s, 79,461 runs | 8.9 s / 12.4 s | 244 s / 284 s |
| `long-widowhood` | 38 | 44 s, 35,814 runs | 118 s, 99,713 runs | 12.4 s / 19.9 s | 355 s / 442 s |
| `soft-cap-underfunded` | 24 | 17 s, 25,012 runs | 47 s, 59,294 runs | 6.8 s / 7.8 s | 169 s / 183 s |
| `mixed-portfolio-couple` | 33 | 31 s, 34,249 runs | 87 s, 87,390 runs | 11.5 s / 14.8 s | 295 s / 336 s |

The exact walk is 10,000 to 28,000 engine runs a sequence - fine for a harness, and the reason the
rule inside the page is the cheap one. The ceiling run's walks cost more because the exact rule then
sits at the raise rail year after year, bisecting a landing it will cap.

---

## Appendix: the two summary tables, as printed

### With the ceiling (`--ceiling`)

| household | start | preset | exact adjusts | cheap adjusts | matched +/-1 yr | first: exact / cheap | largest spend gap (year) | mean |gap| | mean |gap| near plan (years) | trough: exact / cheap / every-year / GK | lifetime real 0%: exact / cheap / off | funded: exact / cheap |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bracket-filler-texas | 1929 | normal | 26 | 22 | 23 | 2033 / 2033 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -28% | $3,630,000 / $3,630,000 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1929 | paper | 23 | 19 | 20 | 2034 / 2034 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -28% | $3,630,000 / $3,630,000 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1937 | normal | 26 | 22 | 23 | 2033 / 2033 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -32% | $3,630,000 / $3,630,000 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1937 | paper | 21 | 17 | 18 | 2035 / 2035 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -32% | $3,630,000 / $3,630,000 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1966 | normal | 27 | 21 | 24 | 2029 / 2029 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -35% | $3,630,000 / $3,630,000 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1966 | paper | 17 | 13 | 14 | 2033 / 2033 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -35% | $3,630,000 / $3,630,000 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1973 | normal | 22 | 18 | 19 | 2037 / 2037 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -29% | $3,630,000 / $3,630,000 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1973 | paper | 20 | 16 | 17 | 2039 / 2039 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -29% | $3,630,000 / $3,630,000 / $3,630,000 | yes / yes |
| bracket-filler-texas | 2000 | normal | 29 | 25 | 26 | 2030 / 2030 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -17% | $3,630,000 / $3,630,000 / $3,630,000 | yes / yes |
| bracket-filler-texas | 2000 | paper | 25 | 21 | 22 | 2033 / 2033 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -17% | $3,630,000 / $3,630,000 / $3,630,000 | yes / yes |
| bracket-filler-texas | 2007 | normal | 31 | 27 | 28 | 2027 / 2027 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -6% | $3,630,000 / $3,630,000 / $3,630,000 | yes / yes |
| bracket-filler-texas | 2007 | paper | 30 | 25 | 26 | 2027 / 2030 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -6% | $3,630,000 / $3,630,000 / $3,630,000 | yes / yes |
| modest-balances-little-surplus | 1929 | normal | 13 | 16 | 13 | 2027 / 2027 | -15.8% (2028) | 4.5% | 4.5% (28) | -31% / -34% / -34% / -28% | $2,764,498 / $2,797,859 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 1929 | paper | 9 | 10 | 9 | 2029 / 2029 | -0.4% (2029) | 0.2% | 0.2% (28) | -15% / -16% / -15% / -28% | $2,819,595 / $2,814,362 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 1937 | normal | 17 | 16 | 15 | 2027 / 2027 | -15.9% (2028) | 5.4% | 5.4% (28) | -25% / -37% / -37% / -26% | $2,796,187 / $2,782,412 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 1937 | paper | 10 | 10 | 10 | 2045 / 2045 | +0.0% (-) | 0.0% | 0.0% (28) | +0% / +0% / +0% / -26% | $3,045,000 / $3,045,000 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 1966 | normal | 11 | 12 | 11 | 2027 / 2027 | +19.3% (2043) | 3.9% | 3.9% (28) | -16% / -21% / -21% / -32% | $2,756,387 / $2,694,849 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 1966 | paper | 9 | 9 | 9 | 2042 / 2042 | +1.6% (2046) | 0.3% | 0.3% (28) | -14% / -12% / -12% / -32% | $2,973,398 / $2,980,861 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 1973 | normal | 19 | 19 | 18 | 2027 / 2027 | +21.9% (2030) | 6.3% | 6.3% (28) | -30% / -41% / -40% / -28% | $2,733,087 / $2,793,923 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 1973 | paper | 14 | 14 | 14 | 2028 / 2028 | +11.3% (2041) | 1.0% | 1.0% (28) | -10% / -11% / -13% / -28% | $2,895,862 / $2,891,234 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 2000 | normal | 17 | 18 | 16 | 2027 / 2027 | +16.9% (2032) | 4.4% | 4.4% (28) | -22% / -24% / -16% / -18% | $2,828,998 / $2,864,006 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 2000 | paper | 11 | 11 | 11 | 2044 / 2044 | +0.0% (-) | 0.0% | 0.0% (28) | +0% / +0% / +0% / -18% | $3,045,000 / $3,045,000 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 2007 | normal | 21 | 22 | 20 | 2027 / 2027 | +13.4% (2030) | 2.9% | 2.9% (28) | -18% / -26% / -24% / -15% | $2,937,447 / $2,933,104 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 2007 | paper | 17 | 16 | 16 | 2037 / 2039 | +0.0% (-) | 0.0% | 0.0% (28) | +0% / +0% / +0% / -15% | $3,045,000 / $3,045,000 / $3,045,000 | yes / yes |
| long-widowhood | 1929 | normal | 22 | 21 | 20 | 2028 / 2028 | -11.4% (2039) | 1.9% | 1.9% (37) | -36% / -36% / -35% / -35% | $5,354,492 / $5,345,480 / $5,700,000 | yes / yes |
| long-widowhood | 1929 | paper | 18 | 14 | 15 | 2029 / 2029 | +15.8% (2034) | 3.9% | 3.9% (37) | -14% / -14% / -13% / -35% | $5,413,593 / $5,592,771 / $5,700,000 | yes / yes |
| long-widowhood | 1937 | normal | 26 | 25 | 24 | 2027 / 2027 | -14.3% (2031) | 2.6% | 2.6% (37) | -26% / -26% / -25% / -25% | $5,520,310 / $5,428,922 / $5,700,000 | yes / yes |
| long-widowhood | 1937 | paper | 22 | 19 | 20 | 2042 / 2042 | +0.0% (-) | 0.0% | 0.0% (37) | +0% / +0% / +0% / -25% | $5,700,000 / $5,700,000 / $5,700,000 | yes / yes |
| long-widowhood | 1966 | normal | 21 | 18 | 19 | 2035 / 2035 | +15.6% (2044) | 2.7% | 2.7% (37) | -32% / -32% / -31% / -39% | $5,442,707 / $5,387,202 / $5,700,000 | yes / yes |
| long-widowhood | 1966 | paper | 17 | 14 | 15 | 2047 / 2047 | +0.0% (-) | 0.0% | 0.0% (37) | +0% / +0% / +0% / -39% | $5,700,000 / $5,700,000 / $5,700,000 | yes / yes |
| long-widowhood | 1973 | normal | 26 | 25 | 24 | 2027 / 2027 | +24.1% (2037) | 2.1% | 2.1% (37) | -19% / -34% / -20% / -35% | $5,350,302 / $5,371,274 / $5,700,000 | yes / yes |
| long-widowhood | 1973 | paper | 22 | 19 | 20 | 2042 / 2042 | +0.0% (-) | 0.0% | 0.0% (37) | +0% / +0% / +0% / -35% | $5,700,000 / $5,700,000 / $5,700,000 | yes / yes |
| long-widowhood | 2000 | normal | 26 | 25 | 23 | 2029 / 2028 | -20.6% (2028) | 3.7% | 3.7% (37) | -24% / -21% / -24% / -26% | $5,457,683 / $5,487,199 / $5,700,000 | yes / yes |
| long-widowhood | 2000 | paper | 23 | 19 | 21 | 2041 / 2041 | +0.0% (-) | 0.0% | 0.0% (37) | +0% / +0% / +0% / -26% | $5,700,000 / $5,700,000 / $5,700,000 | yes / yes |
| long-widowhood | 2007 | normal | 33 | 30 | 31 | 2028 / 2028 | -5.2% (2028) | 0.3% | 0.3% (37) | -19% / -24% / -19% / -15% | $5,609,126 / $5,596,868 / $5,700,000 | yes / yes |
| long-widowhood | 2007 | paper | 30 | 27 | 28 | 2034 / 2034 | +0.0% (-) | 0.0% | 0.0% (37) | +0% / +0% / +0% / -15% | $5,700,000 / $5,700,000 / $5,700,000 | yes / yes |
| soft-cap-underfunded | 1929 | normal | 11 | 11 | 11 | 2027 / 2027 | -10.2% (2041) | 2.5% | 2.5% (23) | -39% / -36% / -28% / -29% | $2,857,566 / $2,880,021 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1929 | paper | 6 | 6 | 6 | 2028 / 2028 | -17.9% (2041) | 2.3% | 2.3% (23) | -26% / -25% / -24% / -29% | $2,922,167 / $2,910,880 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1937 | normal | 10 | 12 | 10 | 2027 / 2027 | -13.3% (2040) | 3.9% | 3.9% (23) | -35% / -35% / -35% / -26% | $2,816,942 / $2,865,841 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1937 | paper | 7 | 8 | 7 | 2027 / 2027 | +21.7% (2042) | 4.6% | 4.6% (23) | -18% / -21% / -21% / -26% | $2,985,967 / $2,957,768 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1966 | normal | 7 | 8 | 7 | 2027 / 2027 | +5.6% (2032) | 3.0% | 3.0% (23) | -29% / -30% / -30% / -36% | $2,698,796 / $2,751,771 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1966 | paper | 6 | 7 | 6 | 2030 / 2030 | +11.3% (2045) | 3.1% | 3.1% (23) | -28% / -32% / -33% / -36% | $2,871,249 / $2,905,007 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1973 | normal | 12 | 12 | 12 | 2027 / 2027 | -2.7% (2038) | 0.2% | 0.2% (23) | -32% / -32% / -32% / -27% | $2,857,895 / $2,853,750 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1973 | paper | 10 | 10 | 10 | 2027 / 2027 | -1.3% (2033) | 0.7% | 0.7% (23) | -24% / -25% / -23% / -27% | $2,982,673 / $2,963,388 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 2000 | normal | 13 | 12 | 12 | 2027 / 2027 | -8.6% (2040) | 2.5% | 2.5% (23) | -27% / -27% / -27% / -9% | $2,970,561 / $2,961,582 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 2000 | paper | 8 | 8 | 8 | 2029 / 2028 | -12.5% (2041) | 3.4% | 3.4% (23) | -16% / -12% / -15% / -9% | $3,143,956 / $3,172,333 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 2007 | normal | 14 | 15 | 14 | 2027 / 2027 | +12.1% (2032) | 1.6% | 1.6% (23) | -26% / -26% / -26% / -5% | $3,133,596 / $3,155,953 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 2007 | paper | 9 | 12 | 9 | 2041 / 2028 | -13.3% (2028) | 6.3% | 6.3% (23) | +0% / -13% / +0% / -5% | $3,429,150 / $3,211,468 / $3,429,150 | yes / yes |
| mixed-portfolio-couple | 1929 | normal | 16 | 17 | 16 | 2027 / 2027 | +14.9% (2048) | 3.4% | 3.4% (32) | -43% / -42% / -42% / -31% | $6,427,760 / $6,465,766 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1929 | paper | 11 | 10 | 9 | 2028 / 2028 | +22.0% (2034) | 12.8% | 12.8% (32) | -30% / -39% / -40% / -31% | $6,386,648 / $6,623,413 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1937 | normal | 20 | 20 | 19 | 2027 / 2027 | -11.9% (2040) | 2.4% | 2.4% (32) | -38% / -38% / -38% / -32% | $6,545,024 / $6,558,362 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1937 | paper | 11 | 13 | 11 | 2027 / 2027 | +22.9% (2045) | 4.9% | 4.9% (32) | -19% / -23% / -23% / -32% | $6,806,767 / $6,767,366 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1966 | normal | 16 | 17 | 15 | 2027 / 2027 | -10.2% (2044) | 1.6% | 1.6% (32) | -39% / -38% / -38% / -41% | $6,253,669 / $6,256,343 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1966 | paper | 10 | 11 | 10 | 2030 / 2030 | +25.5% (2047) | 3.4% | 3.4% (32) | -30% / -31% / -31% / -41% | $6,458,090 / $6,523,487 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1973 | normal | 21 | 19 | 20 | 2027 / 2027 | -12.4% (2030) | 3.4% | 3.4% (32) | -43% / -41% / -42% / -35% | $6,558,616 / $6,540,385 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1973 | paper | 14 | 17 | 13 | 2027 / 2027 | +28.3% (2040) | 7.5% | 7.5% (32) | -27% / -35% / -35% / -35% | $6,748,581 / $6,620,395 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 2000 | normal | 18 | 21 | 17 | 2027 / 2027 | +9.9% (2039) | 3.3% | 3.3% (32) | -28% / -34% / -34% / -18% | $6,872,155 / $6,896,959 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 2000 | paper | 14 | 14 | 14 | 2029 / 2029 | +21.7% (2044) | 2.8% | 2.8% (32) | -18% / -20% / -21% / -18% | $7,013,344 / $7,007,884 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 2007 | normal | 24 | 24 | 24 | 2027 / 2027 | -15.5% (2032) | 1.8% | 1.8% (32) | -27% / -31% / -31% / -6% | $7,269,855 / $7,201,973 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 2007 | paper | 13 | 13 | 13 | 2046 / 2046 | +0.0% (-) | 0.0% | 0.0% (32) | +0% / +0% / +0% / -6% | $7,722,000 / $7,722,000 / $7,722,000 | yes / yes |

Cost, ceiling run:

| household | plan years | table job (every 3) | table job (every year) | exact walk per sequence | runs per exact walk | task total |
|---|---|---|---|---|---|---|
| bracket-filler-texas | 33 | 22.3 s, 32,212 runs | 54.2 s, 83,754 runs | 20.8 s | 27,875 | 355 s |
| modest-balances-little-surplus | 29 | 18.6 s, 29,390 runs | 47.3 s, 80,283 runs | 7.9 s | 17,675 | 181 s |
| long-widowhood | 38 | 30.0 s, 36,299 runs | 76.7 s, 101,214 runs | 18.9 s | 26,542 | 370 s |
| soft-cap-underfunded | 24 | 12.5 s, 25,192 runs | 29.7 s, 59,869 runs | 5.5 s | 12,658 | 125 s |
| mixed-portfolio-couple | 33 | 21.1 s, 34,783 runs | 54.3 s, 88,942 runs | 10.5 s | 20,358 | 229 s |

### Without the ceiling

| household | start | preset | exact adjusts | cheap adjusts | matched +/-1 yr | first: exact / cheap | largest spend gap (year) | mean |gap| | mean |gap| near plan (years) | trough: exact / cheap / every-year / GK | lifetime real 0%: exact / cheap / off | funded: exact / cheap |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bracket-filler-texas | 1929 | normal | 10 | 5 | 7 | 2033 / 2033 | -51.5% (2058) | 8.4% | 1.7% (19) | +0% / +0% / +0% / -28% | $7,158,306 / $6,148,207 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1929 | paper | 5 | 3 | 3 | 2034 / 2034 | -36.6% (2058) | 7.1% | 0.8% (23) | +0% / +0% / +0% / -28% | $6,811,173 / $6,532,883 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1937 | normal | 12 | 8 | 10 | 2033 / 2033 | -32.2% (2058) | 3.3% | 0.2% (17) | +0% / +0% / +0% / -32% | $8,700,160 / $8,050,483 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1937 | paper | 4 | 3 | 3 | 2035 / 2035 | -28.9% (2055) | 4.3% | 0.0% (8) | +0% / +0% / +0% / -32% | $8,167,940 / $7,488,435 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1966 | normal | 11 | 8 | 7 | 2029 / 2029 | -65.8% (2058) | 9.8% | 2.3% (19) | -2% / -2% / -3% / -35% | $7,582,257 / $6,145,009 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1966 | paper | 5 | 3 | 3 | 2033 / 2033 | -64.6% (2058) | 5.0% | 0.0% (22) | +0% / +0% / +0% / -35% | $7,055,554 / $6,069,816 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1973 | normal | 10 | 8 | 8 | 2037 / 2037 | -31.1% (2058) | 3.1% | 0.2% (15) | +0% / +0% / +0% / -29% | $11,086,186 / $10,471,227 / $3,630,000 | yes / yes |
| bracket-filler-texas | 1973 | paper | 5 | 4 | 5 | 2039 / 2039 | +31.0% (2052) | 3.4% | 0.0% (12) | +0% / +0% / +0% / -29% | $11,137,633 / $10,878,023 / $3,630,000 | yes / yes |
| bracket-filler-texas | 2000 | normal | 11 | 9 | 8 | 2030 / 2030 | +44.9% (2056) | 4.3% | 0.1% (13) | +0% / +0% / +0% / -17% | $8,377,329 / $8,547,959 / $3,630,000 | yes / yes |
| bracket-filler-texas | 2000 | paper | 5 | 4 | 4 | 2033 / 2033 | +53.1% (2056) | 6.9% | 0.3% (14) | +0% / +0% / +0% / -17% | $8,394,167 / $9,084,746 / $3,630,000 | yes / NO |
| bracket-filler-texas | 2007 | normal | 13 | 9 | 9 | 2027 / 2027 | -34.6% (2058) | 8.0% | 1.0% (7) | +0% / +0% / +0% / -6% | $9,804,085 / $9,150,621 / $3,630,000 | yes / yes |
| bracket-filler-texas | 2007 | paper | 6 | 5 | 1 | 2027 / 2030 | +58.0% (2047) | 21.1% | 12.5% (8) | +0% / +0% / +0% / -6% | $9,801,952 / $10,199,318 / $3,630,000 | NO / NO |
| modest-balances-little-surplus | 1929 | normal | 10 | 13 | 10 | 2027 / 2027 | -25.5% (2054) | 7.4% | 6.4% (23) | -31% / -34% / -34% / -26% | $3,730,685 / $3,751,882 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 1929 | paper | 4 | 3 | 3 | 2029 / 2029 | +18.0% (2052) | 2.8% | 1.1% (25) | -15% / -16% / -15% / -26% | $3,444,743 / $3,501,730 / $3,045,000 | yes / NO |
| modest-balances-little-surplus | 1937 | normal | 11 | 8 | 9 | 2027 / 2027 | +41.8% (2053) | 12.6% | 11.5% (17) | -25% / -37% / -37% / -26% | $5,018,312 / $5,082,352 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 1937 | paper | 4 | 2 | 2 | 2045 / 2045 | +41.8% (2051) | 4.8% | 1.3% (22) | +0% / +0% / +0% / -26% | $3,868,740 / $3,906,457 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 1966 | normal | 9 | 8 | 9 | 2027 / 2027 | +42.9% (2052) | 9.7% | 6.3% (20) | -16% / -21% / -21% / -32% | $3,852,128 / $4,062,843 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 1966 | paper | 4 | 4 | 3 | 2042 / 2042 | +48.8% (2052) | 4.3% | 4.2% (26) | -14% / -12% / -12% / -32% | $3,387,101 / $3,457,442 / $3,045,000 | yes / NO |
| modest-balances-little-surplus | 1973 | normal | 12 | 11 | 11 | 2027 / 2027 | -37.7% (2054) | 10.3% | 11.9% (16) | -30% / -41% / -40% / -28% | $5,503,357 / $5,238,744 / $3,045,000 | yes / yes |
| modest-balances-little-surplus | 1973 | paper | 6 | 7 | 6 | 2028 / 2028 | +53.1% (2052) | 8.4% | 4.7% (19) | -10% / -11% / -13% / -28% | $4,736,155 / $4,837,939 / $3,045,000 | yes / NO |
| modest-balances-little-surplus | 2000 | normal | 13 | 9 | 11 | 2027 / 2027 | -27.5% (2054) | 10.9% | 10.9% (18) | -22% / -24% / -16% / -18% | $4,741,435 / $4,627,304 / $3,045,000 | NO / yes |
| modest-balances-little-surplus | 2000 | paper | 4 | 3 | 3 | 2044 / 2044 | -37.1% (2053) | 5.9% | 1.1% (20) | +0% / +0% / +0% / -18% | $4,115,612 / $4,042,388 / $3,045,000 | NO / NO |
| modest-balances-little-surplus | 2007 | normal | 13 | 11 | 11 | 2027 / 2027 | +32.9% (2053) | 10.9% | 12.8% (14) | -18% / -26% / -24% / -15% | $5,703,207 / $5,836,964 / $3,045,000 | NO / NO |
| modest-balances-little-surplus | 2007 | paper | 6 | 4 | 4 | 2037 / 2039 | +51.5% (2053) | 13.1% | 8.0% (17) | +0% / +0% / +0% / -15% | $5,299,664 / $5,415,754 / $3,045,000 | NO / NO |
| long-widowhood | 1929 | normal | 16 | 13 | 12 | 2028 / 2028 | -42.4% (2063) | 6.9% | 5.1% (21) | -36% / -36% / -35% / -34% | $14,531,307 / $13,343,981 / $5,700,000 | yes / yes |
| long-widowhood | 1929 | paper | 7 | 7 | 4 | 2029 / 2029 | -43.7% (2063) | 14.6% | 17.0% (25) | -14% / -14% / -13% / -34% | $12,579,823 / $11,227,674 / $5,700,000 | NO / yes |
| long-widowhood | 1937 | normal | 13 | 10 | 10 | 2027 / 2027 | -31.5% (2062) | 6.5% | 6.6% (17) | -26% / -26% / -25% / -25% | $19,159,416 / $18,236,049 / $5,700,000 | NO / yes |
| long-widowhood | 1937 | paper | 5 | 4 | 4 | 2042 / 2042 | -16.5% (2061) | 2.2% | 0.0% (15) | +0% / +0% / +0% / -25% | $16,317,596 / $16,020,233 / $5,700,000 | NO / yes |
| long-widowhood | 1966 | normal | 12 | 12 | 11 | 2035 / 2035 | +29.9% (2046) | 8.7% | 7.0% (20) | -32% / -32% / -31% / -39% | $14,308,039 / $14,805,106 / $5,700,000 | yes / yes |
| long-widowhood | 1966 | paper | 5 | 5 | 5 | 2047 / 2047 | -20.7% (2059) | 2.4% | 0.0% (20) | +0% / +0% / +0% / -39% | $12,663,861 / $12,893,234 / $5,700,000 | yes / NO |
| long-widowhood | 1973 | normal | 11 | 13 | 8 | 2027 / 2027 | +26.6% (2038) | 8.3% | 8.8% (15) | -19% / -34% / -20% / -35% | $18,326,707 / $17,856,792 / $5,700,000 | yes / yes |
| long-widowhood | 1973 | paper | 5 | 4 | 4 | 2042 / 2042 | -25.5% (2057) | 3.8% | 0.0% (15) | +0% / +0% / +0% / -35% | $15,535,869 / $14,817,428 / $5,700,000 | yes / yes |
| long-widowhood | 2000 | normal | 14 | 12 | 10 | 2029 / 2028 | -29.2% (2061) | 10.8% | 12.0% (17) | -24% / -21% / -24% / -26% | $12,951,375 / $12,404,976 / $5,700,000 | yes / yes |
| long-widowhood | 2000 | paper | 8 | 5 | 6 | 2041 / 2041 | -27.6% (2061) | 3.0% | 1.1% (20) | +0% / +0% / +0% / -26% | $11,690,075 / $11,351,165 / $5,700,000 | yes / yes |
| long-widowhood | 2007 | normal | 19 | 15 | 16 | 2028 / 2028 | -58.2% (2063) | 9.9% | 3.0% (10) | -19% / -24% / -19% / -15% | $15,660,845 / $14,468,035 / $5,700,000 | yes / yes |
| long-widowhood | 2007 | paper | 7 | 8 | 6 | 2034 / 2034 | -56.2% (2063) | 9.4% | 0.4% (13) | +0% / +0% / +0% / -15% | $14,498,991 / $14,058,295 / $5,700,000 | NO / yes |
| soft-cap-underfunded | 1929 | normal | 11 | 11 | 11 | 2027 / 2027 | -10.2% (2041) | 2.9% | 2.8% (22) | -39% / -36% / -28% / -25% | $3,070,875 / $3,080,203 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1929 | paper | 4 | 5 | 4 | 2028 / 2028 | +20.1% (2048) | 6.0% | 6.0% (23) | -26% / -25% / -24% / -25% | $3,026,010 / $3,020,645 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1937 | normal | 8 | 9 | 8 | 2027 / 2027 | -20.5% (2049) | 6.6% | 5.6% (18) | -35% / -35% / -35% / -26% | $3,419,382 / $3,413,591 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1937 | paper | 4 | 4 | 3 | 2027 / 2027 | +22.6% (2042) | 7.5% | 6.7% (21) | -18% / -21% / -21% / -26% | $3,259,979 / $3,337,604 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1966 | normal | 6 | 7 | 6 | 2027 / 2027 | -13.7% (2049) | 3.7% | 3.3% (22) | -29% / -30% / -30% / -36% | $2,917,914 / $2,944,469 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1966 | paper | 5 | 6 | 4 | 2030 / 2030 | -16.7% (2049) | 4.1% | 4.1% (23) | -28% / -32% / -33% / -36% | $2,924,635 / $2,923,104 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1973 | normal | 9 | 9 | 9 | 2027 / 2027 | -16.6% (2049) | 3.9% | 2.0% (18) | -32% / -32% / -32% / -27% | $3,577,020 / $3,642,034 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 1973 | paper | 7 | 6 | 7 | 2027 / 2027 | +11.9% (2046) | 4.1% | 3.9% (21) | -24% / -25% / -23% / -27% | $3,455,398 / $3,508,693 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 2000 | normal | 10 | 10 | 9 | 2027 / 2027 | -12.8% (2040) | 5.2% | 4.9% (19) | -27% / -27% / -27% / -9% | $3,666,906 / $3,716,189 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 2000 | paper | 5 | 5 | 5 | 2029 / 2028 | +22.1% (2045) | 7.0% | 6.8% (21) | -16% / -12% / -15% / -9% | $3,556,290 / $3,581,760 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 2007 | normal | 11 | 11 | 10 | 2027 / 2027 | -13.5% (2049) | 5.0% | 4.0% (16) | -26% / -26% / -26% / -5% | $4,326,629 / $4,350,995 / $3,429,150 | yes / yes |
| soft-cap-underfunded | 2007 | paper | 3 | 6 | 2 | 2041 / 2028 | +33.7% (2039) | 16.0% | 14.5% (20) | +0% / -13% / +0% / -5% | $4,144,212 / $4,286,581 / $3,429,150 | NO / NO |
| mixed-portfolio-couple | 1929 | normal | 13 | 13 | 13 | 2027 / 2027 | +14.9% (2048) | 5.0% | 4.9% (25) | -43% / -42% / -42% / -34% | $8,498,233 / $8,476,173 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1929 | paper | 7 | 5 | 4 | 2028 / 2028 | -26.0% (2050) | 15.9% | 17.3% (25) | -30% / -39% / -40% / -34% | $8,139,544 / $7,940,991 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1937 | normal | 13 | 12 | 12 | 2027 / 2027 | +12.8% (2056) | 3.6% | 3.4% (24) | -38% / -38% / -38% / -32% | $9,813,827 / $9,797,004 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1937 | paper | 4 | 6 | 3 | 2027 / 2027 | +44.3% (2045) | 10.9% | 9.7% (24) | -19% / -23% / -23% / -32% | $8,599,711 / $9,199,672 / $7,722,000 | yes / NO |
| mixed-portfolio-couple | 1966 | normal | 13 | 13 | 12 | 2027 / 2027 | +13.6% (2056) | 2.8% | 2.4% (25) | -39% / -38% / -38% / -41% | $8,916,302 / $8,934,585 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1966 | paper | 6 | 7 | 5 | 2030 / 2030 | +25.5% (2047) | 7.1% | 7.0% (29) | -30% / -31% / -31% / -41% | $7,898,226 / $8,014,312 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1973 | normal | 14 | 12 | 13 | 2027 / 2027 | -12.4% (2030) | 5.7% | 5.9% (22) | -43% / -41% / -42% / -35% | $11,740,389 / $11,985,546 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 1973 | paper | 6 | 8 | 5 | 2027 / 2027 | +35.5% (2058) | 15.2% | 16.2% (22) | -27% / -35% / -35% / -35% | $10,705,013 / $11,380,417 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 2000 | normal | 11 | 14 | 9 | 2027 / 2027 | +12.1% (2041) | 6.6% | 8.0% (24) | -28% / -34% / -34% / -18% | $9,483,820 / $9,520,362 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 2000 | paper | 5 | 7 | 3 | 2029 / 2029 | +38.1% (2044) | 8.0% | 8.8% (24) | -18% / -20% / -21% / -18% | $8,887,517 / $8,988,596 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 2007 | normal | 13 | 13 | 13 | 2027 / 2027 | -15.5% (2032) | 4.9% | 4.6% (21) | -27% / -31% / -31% / -6% | $11,223,969 / $11,383,059 / $7,722,000 | yes / yes |
| mixed-portfolio-couple | 2007 | paper | 4 | 3 | 3 | 2046 / 2046 | -21.0% (2053) | 3.4% | 0.2% (23) | +0% / +0% / +0% / -6% | $10,053,208 / $10,115,465 / $7,722,000 | NO / NO |

Cost, no-ceiling run:

| household | plan years | table job (every 3) | table job (every year) | exact walk per sequence | runs per exact walk | task total |
|---|---|---|---|---|---|---|
| bracket-filler-texas | 33 | 22.0 s, 32,212 runs | 54.3 s, 83,754 runs | 6.3 s | 12,092 | 178 s |
| modest-balances-little-surplus | 29 | 18.8 s, 29,390 runs | 47.6 s, 80,283 runs | 5.9 s | 11,600 | 159 s |
| long-widowhood | 38 | 29.5 s, 36,299 runs | 75.5 s, 101,214 runs | 9.7 s | 14,883 | 257 s |
| soft-cap-underfunded | 24 | 12.6 s, 25,192 runs | 29.9 s, 59,869 runs | 4.8 s | 9,908 | 117 s |
| mixed-portfolio-couple | 33 | 21.4 s, 34,783 runs | 54.2 s, 88,942 runs | 7.4 s | 13,192 | 189 s |

## Open questions this report does not settle

- **The cut landing.** One solved point at the cut rail plus the plan-wealth point. A third point,
  solved lower, would narrow the single-year gaps of section 1; its cost is one more pass-2 bracket
  per solved year.
- **One chance model.** GBM at the plan's Growth. A table solved on Historical paths would put the
  rails elsewhere, and the exact walk would move with them; the comparison was not run.
- **The exact rule's own noise.** At 100 paths a landing moves 3% to 5% from one seed to the next.
  Some of the trough differences in section 1 are that, not the approximation; ten seeds would say
  which.
- **The record wraps.** A 2000 start lives 2025 and then 1928. That is how the Stress Test walks it
  and it is severe on purpose; a plan that ends before the wrap would show fewer failures in section 2.

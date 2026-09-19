# Risk-based spend rule: what each Target / Raise / Cut / Cut-returns-to setting delivers (P132e)

What the risk-based spend rule (`spendRule: 'rbg'`, the **Risk-based** setting of the Guardrails
switch) delivers at the four presets and at a grid of custom settings, on the households most likely
to be cut, through five historical starts and under Monte Carlo - beside the same plan with no rule
and with the GK-style rule. The question behind it (user, 2026-09-19): the 2024 article lets the
chance of success fall to 25% before cutting; is a floor that low sensible on a worst-case plan?

Produced by [`.test_harnesses/rbg_grid_harness.js`](../.test_harnesses/rbg_grid_harness.js) on
engine v11.189d (2026-09-19). Every number below is printed by that script; the four appendix
tables are its output unedited.

**What it found, in five lines:**

1. **Every risk-based setting funds every historical start on all four households** - 22 settings
   x 5 starts x 4 households, no failure - where the plan with no rule fails 4 of 5 starts on
   `soft-cap-underfunded` and 5 of 5 on `mixed-portfolio-couple`. GK-style funds them all too, at
   troughs of -33% to -63% against -8% to -46% for the risk-based settings.
2. **Under Monte Carlo the cut level is what decides the funded share.** Cut at 50%: 92% to 97% of
   paths funded; at 35%: 84% to 98%; at 25%: 62% to 96%. Returning to a level BELOW the target after
   a cut costs more paths still: the Paper set (cut 25%, back to 45%) funds 72% on the underfunded
   household where the same cut returning to 80% funds 89%. GK-style funds 100% everywhere, by
   cutting 10% a year for as long as it takes.
3. **The trade is funded share against depth of cut, and it is steep at the top.** On
   `soft-cap-underfunded`: GK 100% funded at a -46% median trough; Tight 98.5% at -33%; Normal
   97.3% at -30%; Loose 95.5% at -26%; Paper 72% at -20%. The bad-path experience (10th-percentile
   lifetime real spending) is $2.47M to $2.63M for every risk-based set against $1.88M for GK.
4. **On a plan the rails rarely cut** (`modest-balances-little-surplus`, `long-widowhood`) every
   setting but Tight and Normal leaves the median path untouched (+0% trough, full lifetime), and
   the settings differ only in the funded share (85% to 98%) - the price of the loose ones is paid
   entirely on the bad paths.
5. **One defect candidate.** On `mixed-portfolio-couple`, the three "cut at 50%, back to 55%" sets
   show a -70% and a -76% trough on the 1966 and 1973 starts with lifetime spending like their
   neighbours: one year cut far too deep. That is the cut-side landing line extrapolated well below
   the cut rail (RBG_RULE_VALIDATION.md, section 3); a third solved point on that side would bound
   it. Not fixed here.

**Read with the 2024 article's claim:** its Great Depression retiree cuts 8% under risk-based
guardrails against 45% under Guyton-Klinger. On this engine, on a 1937 start, the risk-based
settings trough at -17% to -38% (Paper: -18%) on the underfunded household and at 0% to -30% on the
others, against -37% to -53% for GK-style. The direction reproduces; the size depends on the
household, and the article's household is not in the bank.

---

## Reading guide

### Codes

| code | meaning |
|---|---|
| **set** | one Target / Raise at / Cut at / Cut-returns-to. The four presets by name; a grid set as `t80c25b45`: target 80%, cut at 25%, a cut returning to 45%, raise at 99.5% |
| **no rule** | the plan on its planned path: the **shape** everything is measured against |
| **GK-style** | the Guardrails rule the page shipped first (Guyton-Klinger in style), with Never above plan on like every other arm |
| **funded** | historical: no year ruined by the Monte Carlo tab's test. Monte Carlo: the share of paths with no ruined year |
| **trough** | the lowest real spending against the shape over the plan; Monte Carlo columns are medians across paths |
| **years below** | years with real spending under the shape |
| **first decade** | real spending in the first ten years (section 8 of RISK_BASED_GUARDRAILS.md: early spending is worth more) |
| **lifetime real 0% / 3%** | real spending summed over the plan, undiscounted and at 3% a year |
| **p10 lifetime** | the 10th percentile across paths of undiscounted lifetime real spending: the bad-path experience |
| **adjustments** | years the rule changed spending (a raise held at the shape counts) |

### The households

Four from the plan bank, chosen because their chance of success starts low or their horizon is long.

| household | plan years | plan spend | chance at the first full year, GBM |
|---|---|---|---|
| [`soft-cap-underfunded`](../plans/soft-cap-underfunded.js) | 24 | $160,000, -1%/yr | 37.5% |
| [`mixed-portfolio-couple`](../plans/mixed-portfolio-couple.js) | 33 | $234,000 | 43.5% |
| [`modest-balances-little-surplus`](../plans/modest-balances-little-surplus.js) | 29 | $105,000 | 73.7% |
| [`long-widowhood`](../plans/long-widowhood.js) | 38 | $150,000 | 79.7% |

### The grid

| knob | value |
|---|---|
| sets | Tight, Normal, Loose, Paper; then cut 25 / 35 / 50 x target 70 / 80 / 90, each returning to its target and to 35 points under it (floored at the cut plus 5), raise at 99.5%. 22 distinct sets (`t80c25b45` is Paper) |
| table | one rails job per household solves every set at once: 100 paths, every 3 years, Synthetic GBM at the plan's Growth, 12%, seed 42 - the page's defaults |
| historical | the real record from 1929, 1937, 1966, 1973 and 2000, per account through the plan's mix, wrapping past 2025 |
| Monte Carlo | 400 GBM paths (seed 43), the same paths for every arm |
| ceiling | Never above plan ON for every rule arm, the page's default with the risk-based rule |
| cost | 4 households on 4 processes, about 10 minutes; the table job 12 to 28 seconds contended |

---

## What it found

### 1. Funded share under Monte Carlo, by cut level

The share of 400 paths funded, read off the appendix (grid sets returning to their target; the
"back to" sets in brackets):

| household | cut 25% | cut 35% | cut 50% | Paper (25, back to 45) | GK-style | no rule |
|---|---|---|---|---|---|---|
| `soft-cap-underfunded` | 89% to 94% (62% to 79%) | 84% to 97% (72% to 74%) | 92% to 97% (82% to 86%) | 72% | 100% | 39% |
| `mixed-portfolio-couple` | 92% to 96% (84% to 90%) | 93% to 96% (86% to 92%) | 94% to 98% (92% to 95%) | 87% | 100% | 42% |
| `modest-balances-little-surplus` | 93% to 95% (85% to 92%) | 93% to 95% (87% to 92%) | 96% to 97% (94%) | 88% | 100% | 72% |
| `long-widowhood` | 94% to 96% (90% to 94%) | 95% to 98% (92% to 96%) | 96% to 98% (96%) | 93% | 100% | 80% |

The cut level moves the funded share by 3 to 8 points; returning below the target moves it by 4 to
27, most on the household that needs the cuts most. A rule that waits for a 25% chance and then
returns only to 45% has, on the underfunded household, a 28% chance of running out: that is the
article's own set, and the plan-bank household closest to its "worst case".

### 2. Depth of cut, by set

Median trough against the shape under Monte Carlo, and the range across the five historical starts:

| set | `soft-cap-underfunded` MC / history | `mixed-portfolio-couple` | `modest-balances` | `long-widowhood` |
|---|---|---|---|---|
| GK-style | -46% / -34% to -63% | -42% / -33% to -59% | -25% / -26% to -45% | -25% / -26% to -44% |
| Tight | -33% / -31% to -38% | -36% / -39% to -46% | -23% / -26% to -35% | -21% / -30% to -40% |
| Normal | -30% / -27% to -36% | -31% / -33% to -42% | -14% / -14% to -30% | -17% / -25% to -36% |
| Loose | -26% / -23% to -37% | -29% / -26% to -42% | 0% / 0% to -33% | 0% / 0% to -31% |
| Paper | -20% / -12% to -31% | -21% / -17% to -31% | 0% / 0% to -17% | 0% / 0% to -14% |

Every risk-based set cuts less deep than GK-style on every household and every start, by 10 to 30
points. Among the risk-based sets the ordering is the cut level's: the lower the cut, the shallower
the trough and the fewer the paths funded. The first decade moves the same way - on
`soft-cap-underfunded` GK-style delivers $1.33M in the first ten years, Normal $1.28M, Paper $1.48M
against a $1.53M shape.

### 3. The bad paths

The 10th percentile of lifetime real spending is the number a household that fears the downside
should read. Every risk-based set beats GK-style on it by 25% to 35%: $2.47M to $2.69M against
$1.88M on `soft-cap-underfunded`, $5.35M to $5.53M against $4.31M on `mixed-portfolio-couple`,
$2.55M to $2.63M against $2.02M on `modest-balances-little-surplus`, $4.79M to $4.96M against $3.69M
on `long-widowhood`. GK-style's 100% funded share is bought by cutting the bad paths hardest and
longest (22 to 30 median years below the shape against 0 to 20), and by ending with the most
wealth: $1.8M to $17.5M against $0.2M to $15.4M.

### 4. The cut-side landing can overshoot

`mixed-portfolio-couple`, sets `t70c50b55`, `t80c50b55`, `t90c50b55`, 1966 and 1973 starts: trough
-70% and -76%, while lifetime real spending ($6.31M to $6.62M) sits with the sets around them. One
year's spending was cut to a quarter of the plan's. The cut lands on a line through the spend the
solver found at the cut rail and the spend it found at the plan's own wealth, both for the "back
to" chance; a path far below the cut rail is beyond both points, and a steep line lands low.
RBG_RULE_VALIDATION.md section 3 names this as what remains of the approximation. A third solved
point below the rail would bound it, at about a third more per solved year. Left open.

---

## Appendix: the four households, as printed

### soft-cap-underfunded (24 years; table job 12.4 s, 33,707 runs)

Monte Carlo, 400 paths: medians across paths

| set | funded | trough vs shape | years below | first decade | lifetime real 0% | 3% | p10 lifetime | ending wealth | adjustments |
|---|---|---|---|---|---|---|---|---|---|
| no rule | 39.3% | +0% | 0 | $1,529,887 | $3,429,150 | $2,527,613 | $3,429,150 | $0 | 0 |
| GK-style | 100.0% | -46% | 22 | $1,326,065 | $2,505,097 | $1,904,008 | $1,880,051 | $1,813,073 | 13 |
| tight: 95% / 99.0% / 80% back to 95% | 98.5% | -33% | 16 | $1,253,015 | $2,972,794 | $2,166,271 | $2,469,111 | $730,901 | 15 |
| normal: 90% / 99.0% / 70% back to 90% | 97.3% | -30% | 16 | $1,284,977 | $3,020,566 | $2,204,859 | $2,480,829 | $632,990 | 13 |
| loose: 80% / 99.5% / 40% back to 80% | 95.5% | -26% | 13 | $1,278,421 | $3,038,299 | $2,210,893 | $2,504,829 | $575,432 | 8 |
| paper: 80% / 99.5% / 25% back to 45% | 72.0% | -20% | 12 | $1,476,527 | $3,155,751 | $2,340,390 | $2,627,083 | $238,182 | 7 |
| t70c25b70: 70% / 99.5% / 25% back to 70% | 89.0% | -23% | 11 | $1,439,660 | $3,114,036 | $2,294,625 | $2,535,362 | $318,119 | 6 |
| t70c25b35: 70% / 99.5% / 25% back to 35% | 62.3% | -20% | 13 | $1,501,742 | $3,168,116 | $2,355,595 | $2,687,532 | $213,191 | 9 |
| t70c35b70: 70% / 99.5% / 35% back to 70% | 83.5% | -21% | 13 | $1,345,360 | $3,066,170 | $2,247,602 | $2,567,732 | $406,051 | 9 |
| t70c35b40: 70% / 99.5% / 35% back to 40% | 71.8% | -20% | 15 | $1,430,248 | $3,132,381 | $2,317,607 | $2,566,864 | $258,862 | 9 |
| t70c50b70: 70% / 99.5% / 50% back to 70% | 92.3% | -21% | 14 | $1,314,547 | $3,058,211 | $2,230,482 | $2,522,907 | $564,881 | 8 |
| t70c50b55: 70% / 99.5% / 50% back to 55% | 82.3% | -20% | 16 | $1,380,668 | $3,103,819 | $2,274,754 | $2,539,383 | $418,341 | 10 |
| t80c25b80: 80% / 99.5% / 25% back to 80% | 88.8% | -27% | 10 | $1,449,032 | $3,109,521 | $2,287,643 | $2,531,467 | $372,973 | 6 |
| t80c25b45: 80% / 99.5% / 25% back to 45% | 72.0% | -20% | 12 | $1,476,527 | $3,155,751 | $2,340,390 | $2,627,083 | $238,182 | 7 |
| t80c35b80: 80% / 99.5% / 35% back to 80% | 95.5% | -24% | 12 | $1,322,393 | $3,069,737 | $2,247,229 | $2,515,360 | $523,562 | 7 |
| t80c35b45: 80% / 99.5% / 35% back to 45% | 84.5% | -23% | 15 | $1,427,258 | $3,117,995 | $2,304,265 | $2,542,445 | $343,433 | 8 |
| t80c50b80: 80% / 99.5% / 50% back to 80% | 96.0% | -24% | 14 | $1,264,826 | $3,022,306 | $2,200,245 | $2,496,744 | $623,081 | 8 |
| t80c50b55: 80% / 99.5% / 50% back to 55% | 83.8% | -20% | 16 | $1,380,668 | $3,099,028 | $2,274,754 | $2,542,095 | $418,341 | 10 |
| t90c25b90: 90% / 99.5% / 25% back to 90% | 94.0% | -32% | 11 | $1,427,789 | $3,080,056 | $2,274,398 | $2,506,210 | $434,114 | 7 |
| t90c25b55: 90% / 99.5% / 25% back to 55% | 79.0% | -20% | 13 | $1,466,906 | $3,139,348 | $2,322,330 | $2,573,747 | $267,826 | 7 |
| t90c35b90: 90% / 99.5% / 35% back to 90% | 97.3% | -29% | 14 | $1,287,679 | $3,019,891 | $2,192,962 | $2,498,606 | $576,846 | 8 |
| t90c35b55: 90% / 99.5% / 35% back to 55% | 73.8% | -19% | 15 | $1,403,403 | $3,124,841 | $2,302,048 | $2,608,693 | $277,067 | 10 |
| t90c50b90: 90% / 99.5% / 50% back to 90% | 96.8% | -28% | 14 | $1,215,658 | $2,971,934 | $2,148,664 | $2,478,048 | $739,176 | 9 |
| t90c50b55: 90% / 99.5% / 50% back to 55% | 86.0% | -20% | 17 | $1,380,668 | $3,086,651 | $2,272,530 | $2,536,145 | $434,363 | 10 |

Historical starts: trough vs shape / lifetime real 0% / funded

| set | 1929 | 1937 | 1966 | 1973 | 2000 |
|---|---|---|---|---|---|
| no rule | +0% / $3,429,150 / NO | +0% / $3,429,150 / NO | +0% / $3,429,150 / NO | +0% / $3,429,150 / NO | +0% / $3,429,150 / yes |
| GK-style | -57% / $2,147,749 / yes | -53% / $2,348,667 / yes | -63% / $2,123,940 / yes | -56% / $2,385,766 / yes | -34% / $2,637,049 / yes |
| tight: 95% / 99.0% / 80% back to 95% | -32% / $2,879,774 / yes | -38% / $2,846,162 / yes | -35% / $2,714,734 / yes | -35% / $2,867,872 / yes | -31% / $2,986,012 / yes |
| normal: 90% / 99.0% / 70% back to 90% | -28% / $2,921,779 / yes | -36% / $2,877,285 / yes | -34% / $2,755,878 / yes | -32% / $2,862,683 / yes | -27% / $3,041,695 / yes |
| loose: 80% / 99.5% / 40% back to 80% | -24% / $2,892,962 / yes | -37% / $2,929,909 / yes | -27% / $2,755,960 / yes | -31% / $2,859,374 / yes | -23% / $2,991,324 / yes |
| paper: 80% / 99.5% / 25% back to 45% | -18% / $2,978,062 / yes | -18% / $2,992,886 / yes | -31% / $2,911,626 / yes | -26% / $3,021,447 / yes | -12% / $3,214,582 / yes |
| t70c25b70: 70% / 99.5% / 25% back to 70% | -24% / $2,946,866 / yes | -26% / $2,888,409 / yes | -24% / $2,887,319 / yes | -22% / $3,000,861 / yes | -21% / $3,118,012 / yes |
| t70c25b35: 70% / 99.5% / 25% back to 35% | -23% / $2,981,887 / yes | -17% / $3,053,769 / yes | -32% / $2,917,419 / yes | -20% / $3,045,519 / yes | -8% / $3,284,157 / yes |
| t70c35b70: 70% / 99.5% / 35% back to 70% | -27% / $2,898,698 / yes | -29% / $2,933,855 / yes | -20% / $2,888,697 / yes | -24% / $2,956,968 / yes | -16% / $3,149,177 / yes |
| t70c35b40: 70% / 99.5% / 35% back to 40% | -28% / $2,914,292 / yes | -19% / $2,977,908 / yes | -38% / $2,911,125 / yes | -25% / $3,017,338 / yes | -13% / $3,180,824 / yes |
| t70c50b70: 70% / 99.5% / 50% back to 70% | -24% / $2,917,973 / yes | -25% / $2,902,455 / yes | -26% / $2,854,972 / yes | -26% / $2,983,519 / yes | -16% / $3,098,621 / yes |
| t70c50b55: 70% / 99.5% / 50% back to 55% | -28% / $2,898,838 / yes | -21% / $2,959,317 / yes | -28% / $2,880,108 / yes | -23% / $2,998,683 / yes | -14% / $3,172,836 / yes |
| t80c25b80: 80% / 99.5% / 25% back to 80% | -27% / $2,910,277 / yes | -30% / $2,913,132 / yes | -29% / $2,827,326 / yes | -27% / $2,913,195 / yes | -26% / $3,081,691 / yes |
| t80c25b45: 80% / 99.5% / 25% back to 45% | -18% / $2,978,062 / yes | -18% / $2,992,886 / yes | -31% / $2,911,626 / yes | -26% / $3,021,447 / yes | -12% / $3,214,582 / yes |
| t80c35b80: 80% / 99.5% / 35% back to 80% | -22% / $2,929,418 / yes | -29% / $2,904,095 / yes | -24% / $2,812,236 / yes | -26% / $2,919,055 / yes | -19% / $3,090,063 / yes |
| t80c35b45: 80% / 99.5% / 35% back to 45% | -20% / $3,009,221 / yes | -33% / $2,961,939 / yes | -33% / $2,886,833 / yes | -21% / $3,022,074 / yes | -11% / $3,231,617 / yes |
| t80c50b80: 80% / 99.5% / 50% back to 80% | -23% / $2,924,901 / yes | -30% / $2,906,567 / yes | -24% / $2,804,983 / yes | -27% / $2,905,589 / yes | -22% / $3,007,755 / yes |
| t80c50b55: 80% / 99.5% / 50% back to 55% | -28% / $2,890,030 / yes | -21% / $2,959,317 / yes | -28% / $2,876,000 / yes | -23% / $2,998,683 / yes | -14% / $3,172,836 / yes |
| t90c25b90: 90% / 99.5% / 25% back to 90% | -31% / $2,847,075 / yes | -34% / $2,840,324 / yes | -33% / $2,761,542 / yes | -31% / $2,835,396 / yes | -31% / $3,021,187 / yes |
| t90c25b55: 90% / 99.5% / 25% back to 55% | -19% / $2,994,951 / yes | -20% / $2,963,780 / yes | -29% / $2,904,256 / yes | -28% / $2,972,001 / yes | -15% / $3,185,131 / yes |
| t90c35b90: 90% / 99.5% / 35% back to 90% | -28% / $2,826,627 / yes | -34% / $2,843,045 / yes | -29% / $2,715,138 / yes | -31% / $2,840,123 / yes | -24% / $3,032,429 / yes |
| t90c35b55: 90% / 99.5% / 35% back to 55% | -23% / $2,948,008 / yes | -18% / $2,997,151 / yes | -36% / $2,901,830 / yes | -20% / $3,009,705 / yes | -14% / $3,205,756 / yes |
| t90c50b90: 90% / 99.5% / 50% back to 90% | -28% / $2,817,458 / yes | -36% / $2,829,242 / yes | -30% / $2,697,084 / yes | -33% / $2,816,147 / yes | -27% / $2,919,894 / yes |
| t90c50b55: 90% / 99.5% / 50% back to 55% | -28% / $2,869,216 / yes | -21% / $2,938,385 / yes | -28% / $2,871,912 / yes | -23% / $2,976,861 / yes | -14% / $3,172,836 / yes |

### mixed-portfolio-couple (33 years; table job 21.2 s, 48,718 runs)

Monte Carlo, 400 paths: medians across paths

| set | funded | trough vs shape | years below | first decade | lifetime real 0% | 3% | p10 lifetime | ending wealth | adjustments |
|---|---|---|---|---|---|---|---|---|---|
| no rule | 41.5% | +0% | 0 | $2,340,000 | $7,722,000 | $5,004,971 | $7,722,000 | $0 | 0 |
| GK-style | 100.0% | -42% | 30 | $2,124,741 | $6,191,889 | $4,094,445 | $4,305,158 | $7,383,063 | 17 |
| tight: 95% / 99.0% / 80% back to 95% | 99.3% | -36% | 18 | $1,725,862 | $6,803,031 | $4,265,276 | $5,468,664 | $6,194,438 | 20 |
| normal: 90% / 99.0% / 70% back to 90% | 98.3% | -31% | 18 | $1,814,185 | $6,895,398 | $4,347,109 | $5,505,168 | $5,219,975 | 16 |
| loose: 80% / 99.5% / 40% back to 80% | 95.0% | -29% | 15 | $1,877,515 | $6,946,872 | $4,408,277 | $5,526,552 | $4,121,159 | 11 |
| paper: 80% / 99.5% / 25% back to 45% | 87.0% | -21% | 14 | $2,252,590 | $7,062,199 | $4,577,603 | $5,388,602 | $2,153,216 | 9 |
| t70c25b70: 70% / 99.5% / 25% back to 70% | 91.5% | -26% | 11 | $2,206,389 | $7,057,764 | $4,542,012 | $5,461,633 | $2,593,935 | 8 |
| t70c25b35: 70% / 99.5% / 25% back to 35% | 84.3% | -21% | 16 | $2,278,716 | $7,107,596 | $4,611,101 | $5,362,478 | $1,878,230 | 10 |
| t70c35b70: 70% / 99.5% / 35% back to 70% | 93.3% | -23% | 14 | $2,025,299 | $7,011,772 | $4,481,537 | $5,484,941 | $3,413,537 | 10 |
| t70c35b40: 70% / 99.5% / 35% back to 40% | 86.0% | -21% | 18 | $2,179,722 | $7,062,347 | $4,564,618 | $5,393,382 | $2,371,938 | 12 |
| t70c50b70: 70% / 99.5% / 50% back to 70% | 93.5% | -23% | 17 | $1,970,957 | $6,964,109 | $4,425,852 | $5,351,659 | $4,025,862 | 14 |
| t70c50b55: 70% / 99.5% / 50% back to 55% | 92.3% | -26% | 18 | $2,029,245 | $7,007,773 | $4,467,233 | $5,506,442 | $3,866,299 | 14 |
| t80c25b80: 80% / 99.5% / 25% back to 80% | 91.5% | -32% | 14 | $2,182,568 | $7,016,610 | $4,503,486 | $5,488,009 | $3,059,480 | 9 |
| t80c25b45: 80% / 99.5% / 25% back to 45% | 87.0% | -21% | 14 | $2,252,590 | $7,062,199 | $4,577,603 | $5,388,602 | $2,153,216 | 9 |
| t80c35b80: 80% / 99.5% / 35% back to 80% | 93.3% | -30% | 15 | $1,953,724 | $6,965,164 | $4,451,763 | $5,532,865 | $3,798,731 | 11 |
| t80c35b45: 80% / 99.5% / 35% back to 45% | 88.5% | -22% | 17 | $2,148,535 | $7,048,549 | $4,543,593 | $5,469,289 | $2,663,667 | 11 |
| t80c50b80: 80% / 99.5% / 50% back to 80% | 95.8% | -27% | 15 | $1,860,327 | $6,898,279 | $4,357,478 | $5,450,722 | $4,686,199 | 13 |
| t80c50b55: 80% / 99.5% / 50% back to 55% | 93.0% | -26% | 19 | $2,029,245 | $6,976,094 | $4,462,064 | $5,514,752 | $3,912,433 | 14 |
| t90c25b90: 90% / 99.5% / 25% back to 90% | 96.3% | -35% | 14 | $2,168,138 | $6,956,532 | $4,449,592 | $5,458,559 | $3,406,428 | 10 |
| t90c25b55: 90% / 99.5% / 25% back to 55% | 89.5% | -21% | 15 | $2,227,194 | $7,019,288 | $4,526,050 | $5,387,185 | $2,512,497 | 9 |
| t90c35b90: 90% / 99.5% / 35% back to 90% | 96.3% | -32% | 16 | $1,919,640 | $6,901,174 | $4,387,582 | $5,475,453 | $4,297,218 | 12 |
| t90c35b55: 90% / 99.5% / 35% back to 55% | 91.5% | -23% | 17 | $2,089,860 | $6,991,995 | $4,500,117 | $5,425,807 | $2,994,776 | 11 |
| t90c50b90: 90% / 99.5% / 50% back to 90% | 97.5% | -30% | 18 | $1,805,245 | $6,865,599 | $4,335,688 | $5,473,740 | $5,050,406 | 13 |
| t90c50b55: 90% / 99.5% / 50% back to 55% | 94.5% | -26% | 20 | $2,029,245 | $6,953,043 | $4,450,844 | $5,459,210 | $3,912,433 | 14 |

Historical starts: trough vs shape / lifetime real 0% / funded

| set | 1929 | 1937 | 1966 | 1973 | 2000 |
|---|---|---|---|---|---|
| no rule | +0% / $7,722,000 / NO | +0% / $7,722,000 / NO | +0% / $7,722,000 / NO | +0% / $7,722,000 / NO | +0% / $7,722,000 / NO |
| GK-style | -47% / $5,573,612 / yes | -48% / $6,169,296 / yes | -59% / $5,600,313 / yes | -51% / $6,115,568 / yes | -33% / $6,665,374 / yes |
| tight: 95% / 99.0% / 80% back to 95% | -46% / $6,380,643 / yes | -42% / $6,479,734 / yes | -41% / $6,186,413 / yes | -46% / $6,524,699 / yes | -39% / $6,788,330 / yes |
| normal: 90% / 99.0% / 70% back to 90% | -41% / $6,467,301 / yes | -38% / $6,552,094 / yes | -38% / $6,269,179 / yes | -42% / $6,537,650 / yes | -33% / $6,899,467 / yes |
| loose: 80% / 99.5% / 40% back to 80% | -42% / $6,503,966 / yes | -41% / $6,722,833 / yes | -31% / $6,327,844 / yes | -35% / $6,609,742 / yes | -26% / $6,929,970 / yes |
| paper: 80% / 99.5% / 25% back to 45% | -29% / $6,579,953 / yes | -26% / $6,751,668 / yes | -31% / $6,465,577 / yes | -27% / $6,741,095 / yes | -17% / $7,033,845 / yes |
| t70c25b70: 70% / 99.5% / 25% back to 70% | -36% / $6,527,848 / yes | -29% / $6,583,443 / yes | -27% / $6,535,490 / yes | -35% / $6,693,374 / yes | -27% / $6,965,216 / yes |
| t70c25b35: 70% / 99.5% / 25% back to 35% | -26% / $6,474,217 / yes | -23% / $6,860,626 / yes | -34% / $6,492,081 / yes | -30% / $6,787,315 / yes | -11% / $7,255,894 / yes |
| t70c35b70: 70% / 99.5% / 35% back to 70% | -37% / $6,464,384 / yes | -28% / $6,600,700 / yes | -34% / $6,448,061 / yes | -34% / $6,701,565 / yes | -21% / $6,974,837 / yes |
| t70c35b40: 70% / 99.5% / 35% back to 40% | -31% / $6,691,939 / yes | -26% / $6,782,610 / yes | -32% / $6,506,889 / yes | -28% / $6,735,572 / yes | -15% / $7,102,520 / yes |
| t70c50b70: 70% / 99.5% / 50% back to 70% | -34% / $6,544,324 / yes | -30% / $6,679,742 / yes | -33% / $6,569,996 / yes | -33% / $6,733,870 / yes | -25% / $6,955,881 / yes |
| t70c50b55: 70% / 99.5% / 50% back to 55% | -34% / $6,533,884 / yes | -29% / $6,611,703 / yes | -70% / $6,482,388 / yes | -76% / $6,617,304 / yes | -21% / $6,969,162 / yes |
| t80c25b80: 80% / 99.5% / 25% back to 80% | -33% / $6,579,406 / yes | -36% / $6,502,978 / yes | -33% / $6,369,734 / yes | -32% / $6,639,635 / yes | -34% / $6,836,371 / yes |
| t80c25b45: 80% / 99.5% / 25% back to 45% | -29% / $6,579,953 / yes | -26% / $6,751,668 / yes | -31% / $6,465,577 / yes | -27% / $6,741,095 / yes | -17% / $7,033,845 / yes |
| t80c35b80: 80% / 99.5% / 35% back to 80% | -42% / $6,506,928 / yes | -36% / $6,500,017 / yes | -29% / $6,375,535 / yes | -32% / $6,638,453 / yes | -29% / $6,900,186 / yes |
| t80c35b45: 80% / 99.5% / 35% back to 45% | -30% / $6,576,534 / yes | -27% / $6,733,270 / yes | -30% / $6,524,559 / yes | -32% / $6,655,090 / yes | -17% / $7,026,018 / yes |
| t80c50b80: 80% / 99.5% / 50% back to 80% | -40% / $6,665,474 / yes | -34% / $6,502,565 / yes | -28% / $6,413,836 / yes | -39% / $6,526,959 / yes | -25% / $6,901,247 / yes |
| t80c50b55: 80% / 99.5% / 50% back to 55% | -34% / $6,406,113 / yes | -29% / $6,611,703 / yes | -70% / $6,433,798 / yes | -76% / $6,590,207 / yes | -21% / $6,969,162 / yes |
| t90c25b90: 90% / 99.5% / 25% back to 90% | -35% / $6,359,392 / yes | -38% / $6,619,284 / yes | -36% / $6,276,265 / yes | -34% / $6,574,464 / yes | -36% / $6,768,352 / yes |
| t90c25b55: 90% / 99.5% / 25% back to 55% | -31% / $6,503,992 / yes | -22% / $6,808,930 / yes | -31% / $6,462,813 / yes | -28% / $6,699,738 / yes | -20% / $7,012,240 / yes |
| t90c35b90: 90% / 99.5% / 35% back to 90% | -43% / $6,555,213 / yes | -39% / $6,644,848 / yes | -32% / $6,245,458 / yes | -35% / $6,563,618 / yes | -32% / $6,771,800 / yes |
| t90c35b55: 90% / 99.5% / 35% back to 55% | -33% / $6,483,292 / yes | -28% / $6,682,818 / yes | -29% / $6,469,405 / yes | -28% / $6,681,640 / yes | -15% / $7,098,861 / yes |
| t90c50b90: 90% / 99.5% / 50% back to 90% | -42% / $6,578,876 / yes | -38% / $6,614,592 / yes | -32% / $6,251,144 / yes | -42% / $6,512,438 / yes | -29% / $6,841,254 / yes |
| t90c50b55: 90% / 99.5% / 50% back to 55% | -34% / $6,367,014 / yes | -29% / $6,611,703 / yes | -70% / $6,307,605 / yes | -76% / $6,581,136 / yes | -21% / $6,969,162 / yes |

### modest-balances-little-surplus (29 years; table job 19.6 s, 42,423 runs)

Monte Carlo, 400 paths: medians across paths

| set | funded | trough vs shape | years below | first decade | lifetime real 0% | 3% | p10 lifetime | ending wealth | adjustments |
|---|---|---|---|---|---|---|---|---|---|
| no rule | 71.5% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $3,045,000 | $2,442,856 | 0 |
| GK-style | 100.0% | -25% | 24 | $1,000,491 | $2,776,188 | $1,899,863 | $2,021,813 | $4,038,795 | 17 |
| tight: 95% / 99.0% / 80% back to 95% | 99.0% | -23% | 10 | $937,492 | $2,904,675 | $1,953,528 | $2,553,916 | $3,393,008 | 17 |
| normal: 90% / 99.0% / 70% back to 90% | 98.8% | -14% | 7 | $986,291 | $2,955,163 | $2,005,499 | $2,561,987 | $3,145,070 | 16 |
| loose: 80% / 99.5% / 40% back to 80% | 96.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,615,983 | $2,662,146 | 12 |
| paper: 80% / 99.5% / 25% back to 45% | 87.8% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,612,927 | $2,560,806 | 12 |
| t70c25b70: 70% / 99.5% / 25% back to 70% | 93.3% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,634,628 | $2,560,806 | 12 |
| t70c25b35: 70% / 99.5% / 25% back to 35% | 85.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,605,631 | $2,560,806 | 12 |
| t70c35b70: 70% / 99.5% / 35% back to 70% | 93.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,613,727 | $2,658,815 | 12 |
| t70c35b40: 70% / 99.5% / 35% back to 40% | 86.8% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,606,238 | $2,580,658 | 12 |
| t70c50b70: 70% / 99.5% / 50% back to 70% | 96.8% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,620,297 | $2,807,930 | 13 |
| t70c50b55: 70% / 99.5% / 50% back to 55% | 93.8% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,603,705 | $2,679,587 | 13 |
| t80c25b80: 80% / 99.5% / 25% back to 80% | 94.5% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,618,001 | $2,630,988 | 12 |
| t80c25b45: 80% / 99.5% / 25% back to 45% | 87.8% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,612,927 | $2,560,806 | 12 |
| t80c35b80: 80% / 99.5% / 35% back to 80% | 95.3% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,615,548 | $2,644,310 | 12 |
| t80c35b45: 80% / 99.5% / 35% back to 45% | 88.8% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,617,380 | $2,630,988 | 12 |
| t80c50b80: 80% / 99.5% / 50% back to 80% | 95.5% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,616,850 | $2,870,183 | 13 |
| t80c50b55: 80% / 99.5% / 50% back to 55% | 93.5% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,603,705 | $2,679,587 | 13 |
| t90c25b90: 90% / 99.5% / 25% back to 90% | 94.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,606,625 | $2,630,988 | 12 |
| t90c25b55: 90% / 99.5% / 25% back to 55% | 91.5% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,608,294 | $2,560,806 | 12 |
| t90c35b90: 90% / 99.5% / 35% back to 90% | 95.3% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,603,296 | $2,666,763 | 12 |
| t90c35b55: 90% / 99.5% / 35% back to 55% | 92.3% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,618,201 | $2,630,988 | 12 |
| t90c50b90: 90% / 99.5% / 50% back to 90% | 97.3% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,607,664 | $2,870,183 | 13 |
| t90c50b55: 90% / 99.5% / 50% back to 55% | 94.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,603,705 | $2,679,587 | 13 |

Historical starts: trough vs shape / lifetime real 0% / funded

| set | 1929 | 1937 | 1966 | 1973 | 2000 |
|---|---|---|---|---|---|
| no rule | +0% / $3,045,000 / yes | +0% / $3,045,000 / yes | +0% / $3,045,000 / yes | +0% / $3,045,000 / yes | +0% / $3,045,000 / yes |
| GK-style | -33% / $2,484,710 / yes | -39% / $2,612,053 / yes | -45% / $2,467,706 / yes | -44% / $2,517,866 / yes | -26% / $2,731,512 / yes |
| tight: 95% / 99.0% / 80% back to 95% | -30% / $2,792,579 / yes | -30% / $2,789,836 / yes | -26% / $2,753,791 / yes | -35% / $2,763,923 / yes | -29% / $2,821,990 / yes |
| normal: 90% / 99.0% / 70% back to 90% | -30% / $2,816,829 / yes | -14% / $2,860,192 / yes | -23% / $2,740,144 / yes | -25% / $2,822,590 / yes | -15% / $2,865,161 / yes |
| loose: 80% / 99.5% / 40% back to 80% | -29% / $2,876,136 / yes | +0% / $3,045,000 / yes | -23% / $2,821,140 / yes | -33% / $2,849,919 / yes | +0% / $3,045,000 / yes |
| paper: 80% / 99.5% / 25% back to 45% | -15% / $2,823,188 / yes | +0% / $3,045,000 / yes | -12% / $2,982,251 / yes | -17% / $2,831,034 / yes | +0% / $3,045,000 / yes |
| t70c25b70: 70% / 99.5% / 25% back to 70% | -27% / $2,905,517 / yes | +0% / $3,045,000 / yes | -22% / $2,951,852 / yes | -31% / $2,897,706 / yes | +0% / $3,045,000 / yes |
| t70c25b35: 70% / 99.5% / 25% back to 35% | -10% / $2,863,296 / yes | +0% / $3,045,000 / yes | -8% / $3,002,328 / yes | -12% / $2,887,559 / yes | +0% / $3,045,000 / yes |
| t70c35b70: 70% / 99.5% / 35% back to 70% | -27% / $2,905,827 / yes | +0% / $3,045,000 / yes | -19% / $2,863,376 / yes | -30% / $2,898,672 / yes | +0% / $3,045,000 / yes |
| t70c35b40: 70% / 99.5% / 35% back to 40% | -12% / $2,875,827 / yes | +0% / $3,045,000 / yes | -9% / $2,975,393 / yes | -13% / $2,874,980 / yes | +0% / $3,045,000 / yes |
| t70c50b70: 70% / 99.5% / 50% back to 70% | -25% / $2,933,291 / yes | -17% / $2,817,251 / yes | -19% / $2,862,496 / yes | -29% / $2,840,124 / yes | -16% / $2,843,032 / yes |
| t70c50b55: 70% / 99.5% / 50% back to 55% | -18% / $2,784,546 / yes | -8% / $2,909,110 / yes | -12% / $2,901,513 / yes | -22% / $2,795,056 / yes | -6% / $2,969,852 / yes |
| t80c25b80: 80% / 99.5% / 25% back to 80% | -29% / $2,875,859 / yes | +0% / $3,045,000 / yes | -25% / $2,954,363 / yes | -33% / $2,850,146 / yes | +0% / $3,045,000 / yes |
| t80c25b45: 80% / 99.5% / 25% back to 45% | -15% / $2,823,188 / yes | +0% / $3,045,000 / yes | -12% / $2,982,251 / yes | -17% / $2,831,034 / yes | +0% / $3,045,000 / yes |
| t80c35b80: 80% / 99.5% / 35% back to 80% | -29% / $2,876,165 / yes | +0% / $3,045,000 / yes | -23% / $2,830,323 / yes | -33% / $2,850,188 / yes | +0% / $3,045,000 / yes |
| t80c35b45: 80% / 99.5% / 35% back to 45% | -15% / $2,826,081 / yes | +0% / $3,045,000 / yes | -6% / $2,973,087 / yes | -17% / $2,833,956 / yes | +0% / $3,045,000 / yes |
| t80c50b80: 80% / 99.5% / 50% back to 80% | -23% / $2,853,627 / yes | -21% / $2,871,925 / yes | -23% / $2,820,583 / yes | -33% / $2,849,424 / yes | -20% / $2,962,991 / yes |
| t80c50b55: 80% / 99.5% / 50% back to 55% | -18% / $2,784,546 / yes | -8% / $2,909,110 / yes | -12% / $2,901,513 / yes | -22% / $2,795,056 / yes | -6% / $2,969,852 / yes |
| t90c25b90: 90% / 99.5% / 25% back to 90% | -32% / $2,819,170 / yes | +0% / $3,045,000 / yes | -29% / $2,957,148 / yes | -36% / $2,801,227 / yes | +0% / $3,045,000 / yes |
| t90c25b55: 90% / 99.5% / 25% back to 55% | -20% / $2,767,002 / yes | +0% / $3,045,000 / yes | -16% / $2,978,311 / yes | -23% / $2,780,043 / yes | +0% / $3,045,000 / yes |
| t90c35b90: 90% / 99.5% / 35% back to 90% | -32% / $2,819,102 / yes | +0% / $3,045,000 / yes | -27% / $2,805,265 / yes | -36% / $2,801,148 / yes | +0% / $3,045,000 / yes |
| t90c35b55: 90% / 99.5% / 35% back to 55% | -20% / $2,771,285 / yes | +0% / $3,045,000 / yes | -12% / $2,906,791 / yes | -23% / $2,783,572 / yes | +0% / $3,045,000 / yes |
| t90c50b90: 90% / 99.5% / 50% back to 90% | -28% / $2,811,526 / yes | -25% / $2,823,520 / yes | -27% / $2,807,842 / yes | -37% / $2,800,475 / yes | -25% / $2,920,032 / yes |
| t90c50b55: 90% / 99.5% / 50% back to 55% | -18% / $2,784,546 / yes | -8% / $2,909,110 / yes | -12% / $2,901,513 / yes | -22% / $2,795,056 / yes | -6% / $2,969,852 / yes |

### long-widowhood (38 years; table job 28.1 s, 49,543 runs)

Monte Carlo, 400 paths: medians across paths

| set | funded | trough vs shape | years below | first decade | lifetime real 0% | 3% | p10 lifetime | ending wealth | adjustments |
|---|---|---|---|---|---|---|---|---|---|
| no rule | 79.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $5,700,000 | $12,058,545 | 0 |
| GK-style | 100.0% | -25% | 30 | $1,444,613 | $5,291,354 | $3,234,154 | $3,689,012 | $17,547,329 | 24 |
| tight: 95% / 99.0% / 80% back to 95% | 98.8% | -21% | 6 | $1,415,020 | $5,573,586 | $3,365,321 | $4,792,607 | $15,358,567 | 23 |
| normal: 90% / 99.0% / 70% back to 90% | 98.8% | -17% | 3 | $1,500,000 | $5,636,878 | $3,417,031 | $4,863,009 | $14,229,921 | 21 |
| loose: 80% / 99.5% / 40% back to 80% | 95.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,928,907 | $13,116,634 | 19 |
| paper: 80% / 99.5% / 25% back to 45% | 92.5% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,957,270 | $12,248,076 | 18 |
| t70c25b70: 70% / 99.5% / 25% back to 70% | 93.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,933,314 | $12,248,076 | 18 |
| t70c25b35: 70% / 99.5% / 25% back to 35% | 90.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,940,193 | $12,248,076 | 18 |
| t70c35b70: 70% / 99.5% / 35% back to 70% | 95.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,951,293 | $12,609,946 | 18 |
| t70c35b40: 70% / 99.5% / 35% back to 40% | 92.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,938,254 | $12,248,076 | 18 |
| t70c50b70: 70% / 99.5% / 50% back to 70% | 96.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,928,005 | $13,162,451 | 19 |
| t70c50b55: 70% / 99.5% / 50% back to 55% | 95.5% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,920,070 | $13,011,771 | 19 |
| t80c25b80: 80% / 99.5% / 25% back to 80% | 94.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,941,621 | $12,248,076 | 18 |
| t80c25b45: 80% / 99.5% / 25% back to 45% | 92.5% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,957,270 | $12,248,076 | 18 |
| t80c35b80: 80% / 99.5% / 35% back to 80% | 96.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,927,493 | $12,879,624 | 19 |
| t80c35b45: 80% / 99.5% / 35% back to 45% | 94.0% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,930,808 | $12,248,076 | 18 |
| t80c50b80: 80% / 99.5% / 50% back to 80% | 97.0% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,909,180 | $13,234,317 | 19 |
| t80c50b55: 80% / 99.5% / 50% back to 55% | 95.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,914,132 | $13,011,771 | 19 |
| t90c25b90: 90% / 99.5% / 25% back to 90% | 96.0% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,893,560 | $12,341,938 | 18 |
| t90c25b55: 90% / 99.5% / 25% back to 55% | 93.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,924,567 | $12,306,160 | 18 |
| t90c35b90: 90% / 99.5% / 35% back to 90% | 98.0% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,905,370 | $12,609,946 | 19 |
| t90c35b55: 90% / 99.5% / 35% back to 55% | 95.5% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,916,123 | $12,609,946 | 18 |
| t90c50b90: 90% / 99.5% / 50% back to 90% | 97.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,881,636 | $13,307,463 | 19 |
| t90c50b55: 90% / 99.5% / 50% back to 55% | 96.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,914,132 | $13,011,771 | 19 |

Historical starts: trough vs shape / lifetime real 0% / funded

| set | 1929 | 1937 | 1966 | 1973 | 2000 |
|---|---|---|---|---|---|
| no rule | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| GK-style | -33% / $4,925,008 / yes | -37% / $5,172,106 / yes | -44% / $4,998,033 / yes | -44% / $4,910,573 / yes | -26% / $5,273,075 / yes |
| tight: 95% / 99.0% / 80% back to 95% | -40% / $5,258,327 / yes | -31% / $5,411,792 / yes | -39% / $5,316,937 / yes | -39% / $5,309,037 / yes | -30% / $5,403,800 / yes |
| normal: 90% / 99.0% / 70% back to 90% | -36% / $5,332,055 / yes | -25% / $5,411,999 / yes | -36% / $5,363,887 / yes | -35% / $5,317,060 / yes | -25% / $5,470,419 / yes |
| loose: 80% / 99.5% / 40% back to 80% | -31% / $5,375,752 / yes | +0% / $5,700,000 / yes | -31% / $5,503,006 / yes | -29% / $5,487,573 / yes | +0% / $5,700,000 / yes |
| paper: 80% / 99.5% / 25% back to 45% | -14% / $5,403,428 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t70c25b70: 70% / 99.5% / 25% back to 70% | -26% / $5,543,615 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t70c25b35: 70% / 99.5% / 25% back to 35% | -8% / $5,529,375 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t70c35b70: 70% / 99.5% / 35% back to 70% | -26% / $5,543,463 / yes | +0% / $5,700,000 / yes | -27% / $5,619,628 / yes | -23% / $5,395,572 / yes | +0% / $5,700,000 / yes |
| t70c35b40: 70% / 99.5% / 35% back to 40% | -11% / $5,472,176 / yes | +0% / $5,700,000 / yes | -8% / $5,574,311 / yes | -6% / $5,585,143 / yes | +0% / $5,700,000 / yes |
| t70c50b70: 70% / 99.5% / 50% back to 70% | -25% / $5,549,667 / yes | -13% / $5,528,696 / yes | -26% / $5,620,636 / yes | -22% / $5,407,015 / yes | -10% / $5,527,583 / yes |
| t70c50b55: 70% / 99.5% / 50% back to 55% | -19% / $5,486,510 / yes | -4% / $5,626,619 / yes | -18% / $5,452,508 / yes | -15% / $5,446,449 / yes | -2% / $5,662,832 / yes |
| t80c25b80: 80% / 99.5% / 25% back to 80% | -32% / $5,344,904 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t80c25b45: 80% / 99.5% / 25% back to 45% | -14% / $5,403,428 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t80c35b80: 80% / 99.5% / 35% back to 80% | -31% / $5,375,678 / yes | +0% / $5,700,000 / yes | -31% / $5,502,625 / yes | -28% / $5,487,853 / yes | +0% / $5,700,000 / yes |
| t80c35b45: 80% / 99.5% / 35% back to 45% | -15% / $5,393,948 / yes | +0% / $5,700,000 / yes | -12% / $5,507,372 / yes | -10% / $5,520,670 / yes | +0% / $5,700,000 / yes |
| t80c50b80: 80% / 99.5% / 50% back to 80% | -32% / $5,344,919 / yes | -20% / $5,580,283 / yes | -31% / $5,503,119 / yes | -29% / $5,487,744 / yes | -19% / $5,588,045 / yes |
| t80c50b55: 80% / 99.5% / 50% back to 55% | -19% / $5,486,510 / yes | -4% / $5,626,619 / yes | -18% / $5,452,508 / yes | -15% / $5,446,449 / yes | -2% / $5,662,832 / yes |
| t90c25b90: 90% / 99.5% / 25% back to 90% | -37% / $5,492,909 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t90c25b55: 90% / 99.5% / 25% back to 55% | -20% / $5,553,445 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t90c35b90: 90% / 99.5% / 35% back to 90% | -38% / $5,492,607 / yes | +0% / $5,700,000 / yes | -38% / $5,374,182 / yes | -35% / $5,332,996 / yes | +0% / $5,700,000 / yes |
| t90c35b55: 90% / 99.5% / 35% back to 55% | -19% / $5,557,380 / yes | +0% / $5,700,000 / yes | -19% / $5,447,903 / yes | -15% / $5,449,836 / yes | +0% / $5,700,000 / yes |
| t90c50b90: 90% / 99.5% / 50% back to 90% | -38% / $5,492,791 / yes | -26% / $5,541,534 / yes | -37% / $5,374,740 / yes | -35% / $5,333,129 / yes | -26% / $5,499,123 / yes |
| t90c50b55: 90% / 99.5% / 50% back to 55% | -19% / $5,486,510 / yes | -4% / $5,626,619 / yes | -18% / $5,452,508 / yes | -15% / $5,446,449 / yes | -2% / $5,662,832 / yes |

## Open questions this report does not settle

- **The cut-side overshoot** (section 4): a third solved point below the cut rail, and whether the
  -70% years vanish with it.
- **Why the risk-based sets are not 100% funded under Monte Carlo when GK-style is.** The rule's cut
  lands on a level solved from 100 paths; on the paths that fail it either landed too high or the
  cut came too late for a horizon nearly gone. Which of the two, path by path, was not measured.
- **One chance model and one seed** for the table; the Monte Carlo pass uses a second seed of the
  same model. Historical (bootstrap) tables were not run.

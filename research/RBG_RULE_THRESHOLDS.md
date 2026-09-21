# Risk-based spend rule: what each preset and custom setting delivers (P132e)

What the risk-based spend rule (`spendRule: 'rbg'`, the **Risk-based** setting of the Guardrails
switch) delivers at the page's five presets - High Safety, Normal, More Tolerant, More Risk and the
prefilled Custom - and at a grid of custom settings, on the households most likely to be cut, through
five historical starts and under Monte Carlo, beside the same plan with no rule and with the GK-style
rule. The question behind it (user, 2026-09-19): the 2024 article lets the chance of success fall to
25% before cutting; is a floor that low sensible on a worst-case plan?

Produced by [`.test_harnesses/rbg_grid_harness.js`](../.test_harnesses/rbg_grid_harness.js) on
engine v11.18b2 (2026-09-20; first run 2026-09-19 on v11.189d, re-run after the preset renames, the
rule table's held ratio beyond a rail and the GK-style correction of the same day). Every number
below is printed by that script; the four appendix tables are its output unedited.

**What it found, in six lines:**

1. **Every risk-based setting funds every historical start on all four households** - 23 settings
   x 5 starts x 4 households, no failure - where the plan with no rule fails 4 of 5 starts on
   `soft-cap-underfunded` and 5 of 5 on `mixed-portfolio-couple`. GK-style funds them all too, at
   troughs of -9% to -41% against -8% to -49% for the risk-based settings.
2. **Under Monte Carlo the cut level is what decides the funded share.** Cut at 50%: 94% to 99% of
   paths funded; at 35%: 94% to 98%; at 25%: 92% to 97%. Returning to a level BELOW the target
   after a cut costs more paths still: 2 to 12 points, most on the household that needs the cuts
   most. More Risk (cut 25%, back to 45%) funds 87% on the underfunded household where the same
   cut returning to 80% funds 94%; the prefilled Custom (70 / 90 / 40 back to 50) funds 83% there.
3. **GK-style no longer rescues a plan that fails on its own assumptions.** Since the P132j
   correction it measures the household's draw against the plan's own path, so on
   `soft-cap-underfunded` - a plan 39% funded with no rule - it funds 51% of paths, against 99% for
   High Safety. Where the plan is sound on its own assumptions it still funds every path (100% on
   the two well-funded households, 95% on `mixed-portfolio-couple`), by cutting 10% a year for as
   long as the path runs under the plan.
4. **The trade is funded share against depth of cut, and it is steep at the top.** On
   `soft-cap-underfunded`: High Safety 99% funded at a -32% median trough; Normal 98.5% at -29%;
   More Tolerant 95% at -23%; More Risk 87% at -19%; Custom 83% at -20%. The bad-path experience
   (10th-percentile lifetime real spending) is $2.45M to $2.56M for every risk-based set.
5. **On a plan the rails rarely cut** (`modest-balances-little-surplus`, `long-widowhood`) every
   setting but High Safety and Normal leaves the median path untouched (+0% trough, full lifetime),
   and the settings differ only in the funded share (91% to 99%) - the price of the looser ones is
   paid entirely on the bad paths. GK-style cuts the median path 18% to 30% on the same households.
6. **The single-year overshoot of the first run is gone.** The first run's -70% and -76% years on
   `mixed-portfolio-couple` were the cut-side landing line extrapolated far below the cut rail; the
   rule now holds the rail's own spend-to-wealth ratio beyond a rail (v11.18b2), and the deepest
   single year in this run is -49% (More Tolerant, 1929 start, that household).

**Read with the 2024 article's claim:** its Great Depression retiree cuts 8% under risk-based
guardrails against 45% under Guyton-Klinger. On this engine, on a 1937 start, the risk-based
settings trough at -21% to -38% (More Risk: -21%) on the underfunded household and at 0% to -42% on
the others, against -25% to -32% for the corrected GK-style. The direction reproduces for the looser
sets; the size depends on the household, and the article's household is not in the bank.

---

## Reading guide

### Codes

| code | meaning |
|---|---|
| **set** | one Target / Raise at / Cut at / Back to. The five presets by name; a grid set as `t80c25b45`: target 80%, cut at 25%, a cut returning to 45%, raise at 99.5% |
| **High Safety / Normal / More Tolerant / More Risk** | the page's presets: 95 / 99 / 80 back to 95; 90 / 99 / 70 back to 90; 80 / 99.5 / 40 back to 70; 80 / 99.5 / 25 back to 45. The appendix prints them by key: `tight`, `normal`, `loose`, `paper` |
| **Custom** | the page's Custom preset as prefilled: 70 / 90 / 40 back to 50 |
| **no rule** | the plan on its planned path: the **shape** everything is measured against |
| **GK-style** | the Guardrails rule the page shipped first (Guyton-Klinger in style), as corrected in v11.18b2: the household's draw (spending net of Social Security and pension) over its portfolio, against the plan's own ratio for the year, with Never above plan on like every other arm |
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
| sets | the five presets; then cut 25 / 35 / 50 x target 70 / 80 / 90, each returning to its target and to 35 points under it (floored at the cut plus 5), raise at 99.5%. 23 distinct sets (`t80c25b45` is More Risk) |
| table | one rails job per household solves every set at once: 100 paths, every 3 years, Synthetic GBM at the plan's Growth, 12%, seed 42 - the page's defaults |
| historical | the real record from 1929, 1937, 1966, 1973 and 2000, per account through the plan's mix, wrapping past 2025 |
| Monte Carlo | 400 GBM paths (seed 43), the same paths for every arm |
| ceiling | Never above plan ON for every rule arm |
| cost | 4 households on 4 processes, about 2 minutes; the table job 13 to 28 seconds contended |

---

## What it found

### 1. Funded share under Monte Carlo, by cut level

The share of 400 paths funded, read off the appendix (grid sets returning to their target; the
"back to" sets in brackets), then the presets:

| household | cut 25% | cut 35% | cut 50% | More Risk | Custom | GK-style | no rule |
|---|---|---|---|---|---|---|---|
| `soft-cap-underfunded` | 92% to 97% (80% to 90%) | 94% to 98% (84% to 94%) | 94% to 98% (89% to 94%) | 87% | 83% | 51% | 39% |
| `mixed-portfolio-couple` | 92% to 97% (84% to 92%) | 94% to 97% (88% to 94%) | 95% to 98% (93% to 95%) | 89% | 89% | 95% | 42% |
| `modest-balances-little-surplus` | 95% to 96% (91% to 95%) | 96% to 97% (91% to 95%) | 97% to 99% (96% to 97%) | 92% | 93% | 100% | 72% |
| `long-widowhood` | 95% to 96% (91% to 95%) | 95% to 98% (93% to 95%) | 96% to 98% (95% to 96%) | 93% | 94% | 100% | 80% |

High Safety funds 99% to 99.5% on every household, Normal 98% to 99%, More Tolerant 95% to 96%.
The cut level moves the funded share by 2 to 6 points; returning below the target moves it by 2 to
12, most on the household that needs the cuts most. A rule that waits for a 25% chance and then
returns only to 45% has, on the underfunded household, a 13% chance of running out: that is the
article's own set, and the plan-bank household closest to its "worst case". The prefilled Custom,
which raises at 90% and cuts at 40% back to 50%, sits with it at 83%.

### 2. Depth of cut, by set

Median trough against the shape under Monte Carlo, and the range across the five historical starts:

| set | `soft-cap-underfunded` MC / history | `mixed-portfolio-couple` | `modest-balances` | `long-widowhood` |
|---|---|---|---|---|
| GK-style | -19% / -9% to -36% | -26% / -18% to -41% | -18% / -18% to -32% | -30% / -25% to -39% |
| High Safety | -32% / -31% to -40% | -36% / -39% to -46% | -21% / -21% to -40% | -21% / -24% to -39% |
| Normal | -29% / -27% to -36% | -31% / -34% to -42% | -18% / -21% to -41% | -18% / -21% to -36% |
| More Tolerant | -23% / -17% to -33% | -26% / -31% to -49% | 0% / 0% to -28% | 0% / 0% to -26% |
| More Risk | -19% / -12% to -32% | -22% / -20% to -39% | 0% / 0% to -16% | 0% / 0% to -14% |
| Custom | -20% / -14% to -27% | -24% / -24% to -43% | 0% / 0% to -20% | 0% / 0% to -18% |

Among the risk-based sets the ordering is the cut level's: the lower the cut, the shallower the
trough and the fewer the paths funded. The corrected GK-style cuts less deep than High Safety and
Normal on the two underfunded households - it no longer cuts a plan for failing on its own
assumptions, only for falling under it - and pays for that in the funded share of section 1. The
first decade moves the same way: on `soft-cap-underfunded` GK-style delivers $1.48M in the first
ten years, Normal $1.23M, More Risk $1.45M, Custom $1.41M, against a $1.53M shape.

### 3. The bad paths

The 10th percentile of lifetime real spending is the number a household that fears the downside
should read. Every risk-based set beats GK-style on it where the plan is sound: $5.42M to $5.53M
against $5.27M on `mixed-portfolio-couple`, $2.53M to $2.62M against $2.31M on
`modest-balances-little-surplus`, $4.79M to $4.96M against $3.75M on `long-widowhood`. On
`soft-cap-underfunded` GK-style's p10 ($2.59M) sits above the risk-based sets ($2.45M to $2.56M)
because half its paths are not funded at all: it did not cut them, so they spent until they ran
out. GK-style's median path is below the shape for 19 to 32 years against 0 to 18 for the
risk-based sets, and it ends with the most wealth on the sound households: $2.6M to $18.0M against
$2.0M to $15.4M.

### 4. The cut-side overshoot, closed

The first run (2026-09-19) showed -70% and -76% single years on `mixed-portfolio-couple` for the
"cut at 50%, back to 55%" sets: the cut landing on a line through two solved points, extrapolated
far below the cut rail. A re-run the next day, after the rule table began interpolating dollars
between solved years, was worse: six years at -100%, where the interpolated rail and the
interpolated spend at it no longer described one solve and the line inverted. The rule now holds
the rail's own spend-to-wealth ratio beyond a rail, and reads a rail within 5% of the plan's
wealth, or a line that would fall with wealth, as the ratio through the origin. In this run no set
has a single year under -49%.

---

## Appendix: the four households, as printed

### soft-cap-underfunded (24 years; table job 12.8 s, 37,914 runs)

Monte Carlo, 400 paths: medians across paths

| set | funded | trough vs shape | years below | first decade | lifetime real 0% | 3% | p10 lifetime | ending wealth | adjustments |
|---|---|---|---|---|---|---|---|---|---|
| no rule | 39.3% | +0% | 0 | $1,529,887 | $3,429,150 | $2,527,613 | $3,429,150 | $0 | 0 |
| GK-style | 51.0% | -19% | 19 | $1,478,912 | $3,221,617 | $2,377,130 | $2,588,463 | $163,146 | 15 |
| tight: 95% / 99.0% / 80% back to 95% | 99.0% | -32% | 16 | $1,198,149 | $2,935,684 | $2,126,376 | $2,447,688 | $858,869 | 14 |
| normal: 90% / 99.0% / 70% back to 90% | 98.5% | -29% | 16 | $1,231,806 | $2,979,676 | $2,164,295 | $2,461,178 | $726,553 | 11 |
| loose: 80% / 99.5% / 40% back to 70% | 95.3% | -23% | 14 | $1,308,672 | $3,033,615 | $2,211,568 | $2,509,288 | $582,681 | 8 |
| paper: 80% / 99.5% / 25% back to 45% | 86.8% | -19% | 13 | $1,448,809 | $3,122,000 | $2,301,510 | $2,548,287 | $306,257 | 6 |
| custom: 70% / 90.0% / 40% back to 50% | 83.0% | -20% | 15 | $1,410,336 | $3,143,467 | $2,311,321 | $2,545,728 | $296,127 | 11 |
| t70c25b70: 70% / 99.5% / 25% back to 70% | 92.0% | -23% | 12 | $1,416,246 | $3,055,307 | $2,248,850 | $2,529,145 | $372,328 | 5 |
| t70c25b35: 70% / 99.5% / 25% back to 35% | 79.8% | -18% | 14 | $1,465,831 | $3,139,170 | $2,325,525 | $2,555,248 | $267,961 | 7 |
| t70c35b70: 70% / 99.5% / 35% back to 70% | 94.5% | -22% | 13 | $1,297,166 | $3,034,863 | $2,209,338 | $2,508,343 | $549,135 | 7 |
| t70c35b40: 70% / 99.5% / 35% back to 40% | 83.8% | -19% | 16 | $1,413,974 | $3,108,423 | $2,287,220 | $2,549,547 | $359,952 | 8 |
| t70c50b70: 70% / 99.5% / 50% back to 70% | 94.0% | -21% | 15 | $1,299,444 | $3,042,835 | $2,218,832 | $2,509,778 | $617,906 | 8 |
| t70c50b55: 70% / 99.5% / 50% back to 55% | 88.8% | -20% | 17 | $1,368,778 | $3,082,834 | $2,261,561 | $2,525,652 | $463,592 | 10 |
| t80c25b80: 80% / 99.5% / 25% back to 80% | 94.3% | -27% | 11 | $1,401,730 | $3,053,987 | $2,250,307 | $2,508,326 | $487,306 | 6 |
| t80c25b45: 80% / 99.5% / 25% back to 45% | 86.8% | -19% | 13 | $1,448,809 | $3,122,000 | $2,301,510 | $2,548,287 | $306,257 | 6 |
| t80c35b80: 80% / 99.5% / 35% back to 80% | 96.0% | -26% | 12 | $1,252,698 | $2,987,382 | $2,170,880 | $2,488,068 | $666,147 | 7 |
| t80c35b45: 80% / 99.5% / 35% back to 45% | 88.5% | -19% | 15 | $1,394,075 | $3,095,996 | $2,276,132 | $2,540,799 | $404,690 | 8 |
| t80c50b80: 80% / 99.5% / 50% back to 80% | 96.5% | -24% | 14 | $1,251,559 | $2,994,557 | $2,175,581 | $2,495,860 | $682,837 | 8 |
| t80c50b55: 80% / 99.5% / 50% back to 55% | 92.0% | -20% | 17 | $1,368,778 | $3,083,017 | $2,260,873 | $2,522,280 | $463,592 | 10 |
| t90c25b90: 90% / 99.5% / 25% back to 90% | 97.3% | -32% | 12 | $1,382,506 | $3,004,200 | $2,203,760 | $2,475,939 | $582,681 | 7 |
| t90c25b55: 90% / 99.5% / 25% back to 55% | 89.8% | -19% | 13 | $1,436,121 | $3,096,686 | $2,277,009 | $2,536,275 | $332,534 | 6 |
| t90c35b90: 90% / 99.5% / 35% back to 90% | 97.8% | -30% | 14 | $1,220,954 | $2,952,849 | $2,146,390 | $2,470,104 | $761,849 | 8 |
| t90c35b55: 90% / 99.5% / 35% back to 55% | 93.8% | -20% | 15 | $1,375,827 | $3,080,039 | $2,257,805 | $2,526,180 | $479,575 | 7 |
| t90c50b90: 90% / 99.5% / 50% back to 90% | 98.3% | -28% | 15 | $1,195,909 | $2,930,284 | $2,119,918 | $2,463,221 | $814,496 | 9 |
| t90c50b55: 90% / 99.5% / 50% back to 55% | 93.8% | -20% | 17 | $1,368,778 | $3,071,490 | $2,256,076 | $2,518,757 | $492,465 | 10 |

Historical starts: trough vs shape / lifetime real 0% / funded

| set | 1929 | 1937 | 1966 | 1973 | 2000 |
|---|---|---|---|---|---|
| no rule | +0% / $3,429,150 / NO | +0% / $3,429,150 / NO | +0% / $3,429,150 / NO | +0% / $3,429,150 / NO | +0% / $3,429,150 / yes |
| GK-style | -29% / $3,035,651 / yes | -26% / $3,033,002 / yes | -36% / $2,932,854 / yes | -27% / $2,962,668 / yes | -9% / $3,302,835 / yes |
| tight: 95% / 99.0% / 80% back to 95% | -40% / $2,829,604 / yes | -38% / $2,819,357 / yes | -34% / $2,690,468 / yes | -39% / $2,801,398 / yes | -31% / $2,932,991 / yes |
| normal: 90% / 99.0% / 70% back to 90% | -36% / $2,880,021 / yes | -35% / $2,865,841 / yes | -30% / $2,751,771 / yes | -32% / $2,853,750 / yes | -27% / $2,961,582 / yes |
| loose: 80% / 99.5% / 40% back to 70% | -22% / $2,928,501 / yes | -33% / $2,904,229 / yes | -22% / $2,835,607 / yes | -27% / $2,904,902 / yes | -17% / $3,072,311 / yes |
| paper: 80% / 99.5% / 25% back to 45% | -25% / $2,910,880 / yes | -21% / $2,957,768 / yes | -32% / $2,904,980 / yes | -25% / $2,963,388 / yes | -12% / $3,172,333 / yes |
| custom: 70% / 90.0% / 40% back to 50% | -25% / $3,003,023 / yes | -26% / $2,965,531 / yes | -27% / $2,893,481 / yes | -26% / $3,017,617 / yes | -14% / $3,205,347 / yes |
| t70c25b70: 70% / 99.5% / 25% back to 70% | -24% / $2,935,032 / yes | -29% / $2,858,490 / yes | -24% / $2,886,642 / yes | -23% / $2,960,078 / yes | -22% / $3,042,345 / yes |
| t70c25b35: 70% / 99.5% / 25% back to 35% | -23% / $2,950,630 / yes | -17% / $3,003,121 / yes | -32% / $2,904,487 / yes | -22% / $2,991,511 / yes | -8% / $3,241,786 / yes |
| t70c35b70: 70% / 99.5% / 35% back to 70% | -30% / $2,835,164 / yes | -33% / $2,873,670 / yes | -30% / $2,841,795 / yes | -26% / $2,918,510 / yes | -21% / $3,046,110 / yes |
| t70c35b40: 70% / 99.5% / 35% back to 40% | -24% / $2,935,875 / yes | -22% / $2,932,833 / yes | -30% / $2,889,935 / yes | -23% / $2,958,152 / yes | -15% / $3,130,467 / yes |
| t70c50b70: 70% / 99.5% / 50% back to 70% | -26% / $2,886,313 / yes | -25% / $2,902,455 / yes | -32% / $2,790,884 / yes | -24% / $2,959,258 / yes | -21% / $3,016,826 / yes |
| t70c50b55: 70% / 99.5% / 50% back to 55% | -28% / $2,893,860 / yes | -21% / $2,959,317 / yes | -28% / $2,854,064 / yes | -31% / $2,953,825 / yes | -15% / $3,123,364 / yes |
| t80c25b80: 80% / 99.5% / 25% back to 80% | -28% / $2,868,445 / yes | -33% / $2,903,643 / yes | -28% / $2,825,540 / yes | -27% / $2,903,004 / yes | -27% / $2,956,939 / yes |
| t80c25b45: 80% / 99.5% / 25% back to 45% | -25% / $2,910,880 / yes | -21% / $2,957,768 / yes | -32% / $2,904,980 / yes | -25% / $2,963,388 / yes | -12% / $3,172,333 / yes |
| t80c35b80: 80% / 99.5% / 35% back to 80% | -23% / $2,915,239 / yes | -37% / $2,833,975 / yes | -26% / $2,766,805 / yes | -31% / $2,869,342 / yes | -26% / $2,964,437 / yes |
| t80c35b45: 80% / 99.5% / 35% back to 45% | -24% / $2,913,271 / yes | -24% / $2,889,564 / yes | -30% / $2,890,982 / yes | -24% / $2,967,237 / yes | -16% / $3,108,398 / yes |
| t80c50b80: 80% / 99.5% / 50% back to 80% | -31% / $2,812,815 / yes | -30% / $2,826,595 / yes | -24% / $2,798,037 / yes | -27% / $2,905,589 / yes | -22% / $3,007,755 / yes |
| t80c50b55: 80% / 99.5% / 50% back to 55% | -28% / $2,884,539 / yes | -21% / $2,959,317 / yes | -28% / $2,846,521 / yes | -31% / $2,953,825 / yes | -15% / $3,123,364 / yes |
| t90c25b90: 90% / 99.5% / 25% back to 90% | -33% / $2,891,344 / yes | -38% / $2,773,009 / yes | -33% / $2,761,134 / yes | -32% / $2,828,097 / yes | -31% / $2,905,976 / yes |
| t90c25b55: 90% / 99.5% / 25% back to 55% | -18% / $2,992,677 / yes | -23% / $2,903,965 / yes | -29% / $2,894,877 / yes | -27% / $2,919,522 / yes | -15% / $3,121,596 / yes |
| t90c35b90: 90% / 99.5% / 35% back to 90% | -28% / $2,810,681 / yes | -41% / $2,812,955 / yes | -31% / $2,668,785 / yes | -35% / $2,778,742 / yes | -31% / $2,907,603 / yes |
| t90c35b55: 90% / 99.5% / 35% back to 55% | -26% / $2,877,193 / yes | -26% / $2,857,052 / yes | -29% / $2,866,210 / yes | -26% / $2,921,218 / yes | -15% / $3,129,408 / yes |
| t90c50b90: 90% / 99.5% / 50% back to 90% | -28% / $2,812,335 / yes | -36% / $2,783,578 / yes | -30% / $2,688,999 / yes | -33% / $2,816,147 / yes | -27% / $2,919,894 / yes |
| t90c50b55: 90% / 99.5% / 50% back to 55% | -28% / $2,864,042 / yes | -21% / $2,938,385 / yes | -28% / $2,835,174 / yes | -31% / $2,935,816 / yes | -15% / $3,123,364 / yes |

### mixed-portfolio-couple (33 years; table job 21.7 s, 53,974 runs)

Monte Carlo, 400 paths: medians across paths

| set | funded | trough vs shape | years below | first decade | lifetime real 0% | 3% | p10 lifetime | ending wealth | adjustments |
|---|---|---|---|---|---|---|---|---|---|
| no rule | 41.5% | +0% | 0 | $2,340,000 | $7,722,000 | $5,004,971 | $7,722,000 | $0 | 0 |
| GK-style | 94.8% | -26% | 27 | $2,253,445 | $7,083,295 | $4,615,206 | $5,268,389 | $2,593,907 | 18 |
| tight: 95% / 99.0% / 80% back to 95% | 99.5% | -36% | 18 | $1,732,742 | $6,803,389 | $4,272,446 | $5,448,125 | $6,207,420 | 20 |
| normal: 90% / 99.0% / 70% back to 90% | 98.3% | -31% | 18 | $1,817,633 | $6,887,939 | $4,343,461 | $5,489,294 | $5,223,352 | 16 |
| loose: 80% / 99.5% / 40% back to 70% | 96.3% | -26% | 16 | $1,971,284 | $6,973,859 | $4,438,566 | $5,508,599 | $4,021,382 | 11 |
| paper: 80% / 99.5% / 25% back to 45% | 88.5% | -22% | 14 | $2,253,846 | $7,053,977 | $4,565,437 | $5,445,412 | $2,465,242 | 8 |
| custom: 70% / 90.0% / 40% back to 50% | 88.8% | -24% | 16 | $2,107,727 | $7,181,833 | $4,616,529 | $5,481,096 | $2,579,350 | 13 |
| t70c25b70: 70% / 99.5% / 25% back to 70% | 92.0% | -26% | 12 | $2,212,423 | $7,040,981 | $4,533,821 | $5,528,143 | $2,790,537 | 8 |
| t70c25b35: 70% / 99.5% / 25% back to 35% | 83.5% | -23% | 15 | $2,283,652 | $7,076,829 | $4,594,418 | $5,430,726 | $2,038,007 | 9 |
| t70c35b70: 70% / 99.5% / 35% back to 70% | 94.3% | -25% | 14 | $2,017,727 | $7,000,684 | $4,470,173 | $5,508,702 | $3,413,805 | 10 |
| t70c35b40: 70% / 99.5% / 35% back to 40% | 88.3% | -22% | 17 | $2,167,029 | $7,054,195 | $4,550,092 | $5,495,842 | $2,672,177 | 11 |
| t70c50b70: 70% / 99.5% / 50% back to 70% | 95.0% | -23% | 17 | $1,963,333 | $6,965,065 | $4,428,351 | $5,504,871 | $4,317,916 | 12 |
| t70c50b55: 70% / 99.5% / 50% back to 55% | 92.5% | -22% | 19 | $2,038,620 | $6,999,173 | $4,475,361 | $5,499,304 | $3,758,694 | 13 |
| t80c25b80: 80% / 99.5% / 25% back to 80% | 93.5% | -32% | 14 | $2,188,389 | $7,000,708 | $4,495,070 | $5,482,864 | $3,260,192 | 9 |
| t80c25b45: 80% / 99.5% / 25% back to 45% | 88.5% | -22% | 14 | $2,253,846 | $7,053,977 | $4,565,437 | $5,445,412 | $2,465,242 | 8 |
| t80c35b80: 80% / 99.5% / 35% back to 80% | 96.3% | -31% | 15 | $1,942,556 | $6,962,366 | $4,422,990 | $5,485,849 | $4,017,830 | 10 |
| t80c35b45: 80% / 99.5% / 35% back to 45% | 91.0% | -23% | 17 | $2,133,599 | $7,015,491 | $4,515,939 | $5,455,337 | $2,993,796 | 10 |
| t80c50b80: 80% / 99.5% / 50% back to 80% | 97.5% | -27% | 15 | $1,858,980 | $6,895,990 | $4,361,995 | $5,519,835 | $4,863,359 | 12 |
| t80c50b55: 80% / 99.5% / 50% back to 55% | 94.0% | -22% | 20 | $2,038,620 | $6,993,659 | $4,475,361 | $5,494,027 | $3,862,710 | 13 |
| t90c25b90: 90% / 99.5% / 25% back to 90% | 96.8% | -35% | 14 | $2,173,335 | $6,947,490 | $4,446,976 | $5,450,225 | $3,440,862 | 10 |
| t90c25b55: 90% / 99.5% / 25% back to 55% | 92.0% | -22% | 15 | $2,243,440 | $7,014,400 | $4,514,411 | $5,415,783 | $2,634,158 | 8 |
| t90c35b90: 90% / 99.5% / 35% back to 90% | 97.0% | -33% | 16 | $1,912,182 | $6,880,052 | $4,357,729 | $5,458,904 | $4,494,948 | 11 |
| t90c35b55: 90% / 99.5% / 35% back to 55% | 94.0% | -24% | 17 | $2,078,134 | $6,971,633 | $4,475,091 | $5,440,367 | $3,363,387 | 10 |
| t90c50b90: 90% / 99.5% / 50% back to 90% | 97.5% | -30% | 18 | $1,808,617 | $6,866,766 | $4,334,831 | $5,474,454 | $5,058,440 | 12 |
| t90c50b55: 90% / 99.5% / 50% back to 55% | 94.8% | -22% | 21 | $2,038,620 | $6,971,482 | $4,451,122 | $5,452,615 | $3,893,211 | 13 |

Historical starts: trough vs shape / lifetime real 0% / funded

| set | 1929 | 1937 | 1966 | 1973 | 2000 |
|---|---|---|---|---|---|
| no rule | +0% / $7,722,000 / NO | +0% / $7,722,000 / NO | +0% / $7,722,000 / NO | +0% / $7,722,000 / NO | +0% / $7,722,000 / NO |
| GK-style | -31% / $6,523,788 / yes | -32% / $6,843,428 / yes | -41% / $6,451,797 / yes | -35% / $6,610,024 / yes | -18% / $7,217,757 / yes |
| tight: 95% / 99.0% / 80% back to 95% | -46% / $6,378,845 / yes | -42% / $6,486,045 / yes | -41% / $6,191,862 / yes | -45% / $6,524,807 / yes | -39% / $6,785,898 / yes |
| normal: 90% / 99.0% / 70% back to 90% | -42% / $6,465,766 / yes | -38% / $6,558,362 / yes | -38% / $6,256,343 / yes | -41% / $6,540,385 / yes | -34% / $6,896,959 / yes |
| loose: 80% / 99.5% / 40% back to 70% | -49% / $6,488,868 / yes | -36% / $6,515,393 / yes | -35% / $6,333,873 / yes | -46% / $6,564,647 / yes | -31% / $6,831,411 / yes |
| paper: 80% / 99.5% / 25% back to 45% | -39% / $6,623,413 / yes | -23% / $6,767,366 / yes | -31% / $6,523,487 / yes | -35% / $6,620,395 / yes | -20% / $7,007,884 / yes |
| custom: 70% / 90.0% / 40% back to 50% | -43% / $6,767,605 / yes | -28% / $6,825,663 / yes | -30% / $6,514,661 / yes | -40% / $6,733,033 / yes | -24% / $7,090,391 / yes |
| t70c25b70: 70% / 99.5% / 25% back to 70% | -46% / $6,633,269 / yes | -32% / $6,599,928 / yes | -29% / $6,556,189 / yes | -43% / $6,526,484 / yes | -30% / $6,952,745 / yes |
| t70c25b35: 70% / 99.5% / 25% back to 35% | -35% / $6,503,584 / yes | -25% / $6,763,458 / yes | -34% / $6,494,300 / yes | -31% / $6,700,886 / yes | -14% / $7,134,365 / yes |
| t70c35b70: 70% / 99.5% / 35% back to 70% | -48% / $6,638,654 / yes | -33% / $6,602,860 / yes | -36% / $6,419,254 / yes | -44% / $6,504,989 / yes | -23% / $6,980,614 / yes |
| t70c35b40: 70% / 99.5% / 35% back to 40% | -39% / $6,674,745 / yes | -27% / $6,709,460 / yes | -32% / $6,553,805 / yes | -35% / $6,708,953 / yes | -19% / $7,017,320 / yes |
| t70c50b70: 70% / 99.5% / 50% back to 70% | -36% / $6,545,732 / yes | -34% / $6,624,178 / yes | -36% / $6,393,395 / yes | -38% / $6,646,102 / yes | -25% / $6,922,665 / yes |
| t70c50b55: 70% / 99.5% / 50% back to 55% | -36% / $6,535,390 / yes | -30% / $6,593,734 / yes | -32% / $6,487,621 / yes | -34% / $6,771,240 / yes | -22% / $6,980,515 / yes |
| t80c25b80: 80% / 99.5% / 25% back to 80% | -34% / $6,413,935 / yes | -39% / $6,728,396 / yes | -36% / $6,315,433 / yes | -33% / $6,647,874 / yes | -36% / $6,790,429 / yes |
| t80c25b45: 80% / 99.5% / 25% back to 45% | -39% / $6,623,413 / yes | -23% / $6,767,366 / yes | -31% / $6,523,487 / yes | -35% / $6,620,395 / yes | -20% / $7,007,884 / yes |
| t80c35b80: 80% / 99.5% / 35% back to 80% | -36% / $6,368,088 / yes | -41% / $6,720,851 / yes | -29% / $6,370,679 / yes | -34% / $6,622,018 / yes | -30% / $6,866,450 / yes |
| t80c35b45: 80% / 99.5% / 35% back to 45% | -41% / $6,634,098 / yes | -24% / $6,759,155 / yes | -30% / $6,487,011 / yes | -37% / $6,586,813 / yes | -22% / $6,980,878 / yes |
| t80c50b80: 80% / 99.5% / 50% back to 80% | -42% / $6,504,629 / yes | -34% / $6,500,866 / yes | -28% / $6,413,836 / yes | -38% / $6,547,691 / yes | -25% / $6,901,247 / yes |
| t80c50b55: 80% / 99.5% / 50% back to 55% | -36% / $6,406,414 / yes | -30% / $6,593,734 / yes | -32% / $6,449,925 / yes | -34% / $6,646,739 / yes | -22% / $6,980,515 / yes |
| t90c25b90: 90% / 99.5% / 25% back to 90% | -36% / $6,318,256 / yes | -41% / $6,624,574 / yes | -38% / $6,265,547 / yes | -35% / $6,563,055 / yes | -39% / $6,823,105 / yes |
| t90c25b55: 90% / 99.5% / 25% back to 55% | -42% / $6,525,700 / yes | -26% / $6,690,233 / yes | -34% / $6,487,764 / yes | -38% / $6,532,034 / yes | -24% / $6,993,105 / yes |
| t90c35b90: 90% / 99.5% / 35% back to 90% | -39% / $6,543,238 / yes | -43% / $6,444,039 / yes | -32% / $6,239,004 / yes | -37% / $6,521,478 / yes | -33% / $6,750,610 / yes |
| t90c35b55: 90% / 99.5% / 35% back to 55% | -44% / $6,547,581 / yes | -28% / $6,605,823 / yes | -34% / $6,416,768 / yes | -40% / $6,491,507 / yes | -16% / $7,034,410 / yes |
| t90c50b90: 90% / 99.5% / 50% back to 90% | -43% / $6,578,052 / yes | -38% / $6,613,076 / yes | -32% / $6,247,963 / yes | -41% / $6,451,081 / yes | -29% / $6,836,789 / yes |
| t90c50b55: 90% / 99.5% / 50% back to 55% | -36% / $6,367,215 / yes | -30% / $6,593,734 / yes | -32% / $6,410,995 / yes | -34% / $6,628,449 / yes | -22% / $6,980,515 / yes |

### modest-balances-little-surplus (29 years; table job 20.0 s, 46,299 runs)

Monte Carlo, 400 paths: medians across paths

| set | funded | trough vs shape | years below | first decade | lifetime real 0% | 3% | p10 lifetime | ending wealth | adjustments |
|---|---|---|---|---|---|---|---|---|---|
| no rule | 71.5% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $3,045,000 | $2,442,856 | 0 |
| GK-style | 100.0% | -18% | 24 | $1,017,312 | $2,863,299 | $1,957,019 | $2,309,909 | $3,374,765 | 16 |
| tight: 95% / 99.0% / 80% back to 95% | 99.5% | -21% | 10 | $915,432 | $2,893,234 | $1,944,424 | $2,525,850 | $3,542,451 | 17 |
| normal: 90% / 99.0% / 70% back to 90% | 98.8% | -18% | 8 | $955,483 | $2,928,636 | $1,973,264 | $2,569,922 | $3,261,968 | 15 |
| loose: 80% / 99.5% / 40% back to 70% | 95.8% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,612,657 | $2,662,146 | 12 |
| paper: 80% / 99.5% / 25% back to 45% | 91.5% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,612,164 | $2,556,657 | 12 |
| custom: 70% / 90.0% / 40% back to 50% | 93.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,616,921 | $2,630,988 | 18 |
| t70c25b70: 70% / 99.5% / 25% back to 70% | 95.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,622,885 | $2,560,806 | 12 |
| t70c25b35: 70% / 99.5% / 25% back to 35% | 90.5% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,609,344 | $2,556,657 | 12 |
| t70c35b70: 70% / 99.5% / 35% back to 70% | 95.5% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,615,815 | $2,660,457 | 12 |
| t70c35b40: 70% / 99.5% / 35% back to 40% | 91.3% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,606,003 | $2,581,280 | 12 |
| t70c50b70: 70% / 99.5% / 50% back to 70% | 96.8% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,619,928 | $2,762,608 | 13 |
| t70c50b55: 70% / 99.5% / 50% back to 55% | 96.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,610,800 | $2,662,146 | 13 |
| t80c25b80: 80% / 99.5% / 25% back to 80% | 96.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,608,942 | $2,560,806 | 12 |
| t80c25b45: 80% / 99.5% / 25% back to 45% | 91.5% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,612,164 | $2,556,657 | 12 |
| t80c35b80: 80% / 99.5% / 35% back to 80% | 95.8% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,609,182 | $2,646,337 | 12 |
| t80c35b45: 80% / 99.5% / 35% back to 45% | 92.3% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,593,172 | $2,630,988 | 12 |
| t80c50b80: 80% / 99.5% / 50% back to 80% | 97.8% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,608,648 | $2,782,663 | 13 |
| t80c50b55: 80% / 99.5% / 50% back to 55% | 96.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,609,480 | $2,662,146 | 13 |
| t90c25b90: 90% / 99.5% / 25% back to 90% | 95.3% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,595,803 | $2,662,146 | 12 |
| t90c25b55: 90% / 99.5% / 25% back to 55% | 94.5% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,597,288 | $2,560,806 | 12 |
| t90c35b90: 90% / 99.5% / 35% back to 90% | 97.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,594,929 | $2,666,763 | 12 |
| t90c35b55: 90% / 99.5% / 35% back to 55% | 95.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,603,439 | $2,630,988 | 12 |
| t90c50b90: 90% / 99.5% / 50% back to 90% | 98.5% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,597,662 | $2,786,362 | 13 |
| t90c50b55: 90% / 99.5% / 50% back to 55% | 97.0% | +0% | 0 | $1,050,000 | $3,045,000 | $2,075,231 | $2,598,303 | $2,662,146 | 13 |

Historical starts: trough vs shape / lifetime real 0% / funded

| set | 1929 | 1937 | 1966 | 1973 | 2000 |
|---|---|---|---|---|---|
| no rule | +0% / $3,045,000 / yes | +0% / $3,045,000 / yes | +0% / $3,045,000 / yes | +0% / $3,045,000 / yes | +0% / $3,045,000 / yes |
| GK-style | -28% / $2,625,678 / yes | -26% / $2,762,336 / yes | -32% / $2,652,342 / yes | -28% / $2,684,253 / yes | -18% / $2,848,696 / yes |
| tight: 95% / 99.0% / 80% back to 95% | -40% / $2,764,749 / yes | -30% / $2,769,048 / yes | -26% / $2,751,043 / yes | -30% / $2,750,013 / yes | -21% / $2,814,340 / yes |
| normal: 90% / 99.0% / 70% back to 90% | -34% / $2,797,859 / yes | -37% / $2,782,412 / yes | -21% / $2,694,849 / yes | -41% / $2,793,923 / yes | -24% / $2,864,006 / yes |
| loose: 80% / 99.5% / 40% back to 70% | -28% / $2,897,646 / yes | -18% / $2,852,817 / yes | -19% / $2,862,655 / yes | -28% / $2,778,951 / yes | +0% / $3,045,000 / yes |
| paper: 80% / 99.5% / 25% back to 45% | -16% / $2,814,362 / yes | +0% / $3,045,000 / yes | -12% / $2,980,861 / yes | -11% / $2,891,234 / yes | +0% / $3,045,000 / yes |
| custom: 70% / 90.0% / 40% back to 50% | -20% / $2,932,739 / yes | -8% / $2,966,309 / yes | -10% / $2,939,301 / yes | -18% / $2,917,481 / yes | +0% / $3,045,000 / yes |
| t70c25b70: 70% / 99.5% / 25% back to 70% | -27% / $2,901,146 / yes | +0% / $3,045,000 / yes | -22% / $2,951,753 / yes | -25% / $2,785,355 / yes | +0% / $3,045,000 / yes |
| t70c25b35: 70% / 99.5% / 25% back to 35% | -10% / $2,851,186 / yes | +0% / $3,045,000 / yes | -8% / $3,001,241 / yes | -6% / $2,953,777 / yes | +0% / $3,045,000 / yes |
| t70c35b70: 70% / 99.5% / 35% back to 70% | -28% / $2,900,098 / yes | +0% / $3,045,000 / yes | -19% / $2,863,047 / yes | -27% / $2,793,899 / yes | +0% / $3,045,000 / yes |
| t70c35b40: 70% / 99.5% / 35% back to 40% | -13% / $2,853,891 / yes | +0% / $3,045,000 / yes | -9% / $2,973,953 / yes | -10% / $2,895,123 / yes | +0% / $3,045,000 / yes |
| t70c50b70: 70% / 99.5% / 50% back to 70% | -28% / $2,874,060 / yes | -21% / $2,872,184 / yes | -19% / $2,860,879 / yes | -31% / $2,873,365 / yes | -16% / $2,858,664 / yes |
| t70c50b55: 70% / 99.5% / 50% back to 55% | -22% / $2,763,029 / yes | -12% / $2,863,547 / yes | -13% / $2,899,572 / yes | -24% / $2,769,588 / yes | -7% / $2,958,828 / yes |
| t80c25b80: 80% / 99.5% / 25% back to 80% | -30% / $2,827,094 / yes | +0% / $3,045,000 / yes | -25% / $2,947,836 / yes | -27% / $2,789,004 / yes | +0% / $3,045,000 / yes |
| t80c25b45: 80% / 99.5% / 25% back to 45% | -16% / $2,814,362 / yes | +0% / $3,045,000 / yes | -12% / $2,980,861 / yes | -11% / $2,891,234 / yes | +0% / $3,045,000 / yes |
| t80c35b80: 80% / 99.5% / 35% back to 80% | -30% / $2,826,753 / yes | +0% / $3,045,000 / yes | -23% / $2,829,916 / yes | -29% / $2,815,025 / yes | +0% / $3,045,000 / yes |
| t80c35b45: 80% / 99.5% / 35% back to 45% | -16% / $2,805,448 / yes | +0% / $3,045,000 / yes | -6% / $2,971,915 / yes | -14% / $2,873,799 / yes | +0% / $3,045,000 / yes |
| t80c50b80: 80% / 99.5% / 50% back to 80% | -30% / $2,819,365 / yes | -24% / $2,844,324 / yes | -23% / $2,826,495 / yes | -34% / $2,848,532 / yes | -19% / $2,843,526 / yes |
| t80c50b55: 80% / 99.5% / 50% back to 55% | -22% / $2,763,029 / yes | -12% / $2,863,547 / yes | -13% / $2,899,572 / yes | -24% / $2,769,588 / yes | -7% / $2,958,828 / yes |
| t90c25b90: 90% / 99.5% / 25% back to 90% | -32% / $2,783,722 / yes | +0% / $3,045,000 / yes | -29% / $2,953,510 / yes | -30% / $2,805,398 / yes | +0% / $3,045,000 / yes |
| t90c25b55: 90% / 99.5% / 25% back to 55% | -21% / $2,783,193 / yes | +0% / $3,045,000 / yes | -16% / $2,978,102 / yes | -17% / $2,828,698 / yes | +0% / $3,045,000 / yes |
| t90c35b90: 90% / 99.5% / 35% back to 90% | -33% / $2,783,062 / yes | +0% / $3,045,000 / yes | -27% / $2,799,156 / yes | -33% / $2,805,940 / yes | +0% / $3,045,000 / yes |
| t90c35b55: 90% / 99.5% / 35% back to 55% | -21% / $2,777,775 / yes | +0% / $3,045,000 / yes | -12% / $2,906,267 / yes | -19% / $2,822,320 / yes | +0% / $3,045,000 / yes |
| t90c50b90: 90% / 99.5% / 50% back to 90% | -21% / $2,823,338 / yes | -28% / $2,752,575 / yes | -27% / $2,800,542 / yes | -38% / $2,799,320 / yes | -24% / $2,843,876 / yes |
| t90c50b55: 90% / 99.5% / 50% back to 55% | -22% / $2,763,029 / yes | -12% / $2,863,547 / yes | -13% / $2,899,572 / yes | -24% / $2,769,588 / yes | -7% / $2,958,828 / yes |

### long-widowhood (38 years; table job 28.4 s, 54,047 runs)

Monte Carlo, 400 paths: medians across paths

| set | funded | trough vs shape | years below | first decade | lifetime real 0% | 3% | p10 lifetime | ending wealth | adjustments |
|---|---|---|---|---|---|---|---|---|---|
| no rule | 79.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $5,700,000 | $12,058,545 | 0 |
| GK-style | 100.0% | -30% | 32 | $1,451,250 | $5,097,741 | $3,154,826 | $3,753,390 | $18,039,283 | 20 |
| tight: 95% / 99.0% / 80% back to 95% | 99.0% | -21% | 7 | $1,416,524 | $5,579,902 | $3,366,866 | $4,790,160 | $15,358,567 | 23 |
| normal: 90% / 99.0% / 70% back to 90% | 98.8% | -18% | 3 | $1,500,000 | $5,635,785 | $3,419,290 | $4,846,100 | $14,047,464 | 21 |
| loose: 80% / 99.5% / 40% back to 70% | 95.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,915,874 | $13,116,634 | 19 |
| paper: 80% / 99.5% / 25% back to 45% | 93.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,918,354 | $12,380,501 | 18 |
| custom: 70% / 90.0% / 40% back to 50% | 93.5% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,939,096 | $12,248,076 | 26 |
| t70c25b70: 70% / 99.5% / 25% back to 70% | 94.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,964,959 | $12,248,076 | 18 |
| t70c25b35: 70% / 99.5% / 25% back to 35% | 91.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,942,334 | $12,058,545 | 18 |
| t70c35b70: 70% / 99.5% / 35% back to 70% | 95.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,933,318 | $12,609,946 | 19 |
| t70c35b40: 70% / 99.5% / 35% back to 40% | 93.0% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,938,163 | $12,248,076 | 19 |
| t70c50b70: 70% / 99.5% / 50% back to 70% | 96.0% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,915,664 | $13,085,514 | 19 |
| t70c50b55: 70% / 99.5% / 50% back to 55% | 95.0% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,932,743 | $12,983,781 | 19 |
| t80c25b80: 80% / 99.5% / 25% back to 80% | 94.5% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,932,303 | $12,386,019 | 18 |
| t80c25b45: 80% / 99.5% / 25% back to 45% | 93.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,918,354 | $12,380,501 | 18 |
| t80c35b80: 80% / 99.5% / 35% back to 80% | 96.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,924,503 | $12,609,946 | 19 |
| t80c35b45: 80% / 99.5% / 35% back to 45% | 94.0% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,928,239 | $12,380,624 | 19 |
| t80c50b80: 80% / 99.5% / 50% back to 80% | 96.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,897,527 | $13,219,895 | 19 |
| t80c50b55: 80% / 99.5% / 50% back to 55% | 95.5% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,920,091 | $12,983,781 | 19 |
| t90c25b90: 90% / 99.5% / 25% back to 90% | 96.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,902,863 | $12,346,670 | 18 |
| t90c25b55: 90% / 99.5% / 25% back to 55% | 95.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,914,680 | $12,339,237 | 18 |
| t90c35b90: 90% / 99.5% / 35% back to 90% | 97.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,900,817 | $12,609,946 | 19 |
| t90c35b55: 90% / 99.5% / 35% back to 55% | 95.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,933,460 | $12,609,946 | 19 |
| t90c50b90: 90% / 99.5% / 50% back to 90% | 97.8% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,869,169 | $13,193,153 | 19 |
| t90c50b55: 90% / 99.5% / 50% back to 55% | 96.3% | +0% | 0 | $1,500,000 | $5,700,000 | $3,475,085 | $4,929,925 | $12,983,781 | 19 |

Historical starts: trough vs shape / lifetime real 0% / funded

| set | 1929 | 1937 | 1966 | 1973 | 2000 |
|---|---|---|---|---|---|
| no rule | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| GK-style | -35% / $4,899,724 / yes | -25% / $5,297,897 / yes | -39% / $5,025,312 / yes | -35% / $5,053,426 / yes | -26% / $5,331,285 / yes |
| tight: 95% / 99.0% / 80% back to 95% | -39% / $5,273,072 / yes | -30% / $5,429,734 / yes | -33% / $5,357,247 / yes | -38% / $5,317,240 / yes | -24% / $5,414,661 / yes |
| normal: 90% / 99.0% / 70% back to 90% | -36% / $5,345,480 / yes | -26% / $5,428,922 / yes | -32% / $5,387,202 / yes | -34% / $5,371,274 / yes | -21% / $5,487,199 / yes |
| loose: 80% / 99.5% / 40% back to 70% | -26% / $5,536,637 / yes | +0% / $5,700,000 / yes | -21% / $5,410,076 / yes | -22% / $5,396,523 / yes | +0% / $5,700,000 / yes |
| paper: 80% / 99.5% / 25% back to 45% | -14% / $5,592,771 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| custom: 70% / 90.0% / 40% back to 50% | -18% / $5,593,649 / yes | +0% / $5,700,000 / yes | -8% / $5,590,239 / yes | -14% / $5,514,132 / yes | +0% / $5,700,000 / yes |
| t70c25b70: 70% / 99.5% / 25% back to 70% | -26% / $5,543,215 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t70c25b35: 70% / 99.5% / 25% back to 35% | -8% / $5,524,933 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t70c35b70: 70% / 99.5% / 35% back to 70% | -26% / $5,543,567 / yes | +0% / $5,700,000 / yes | -22% / $5,409,580 / yes | -23% / $5,393,348 / yes | +0% / $5,700,000 / yes |
| t70c35b40: 70% / 99.5% / 35% back to 40% | -11% / $5,463,270 / yes | +0% / $5,700,000 / yes | -2% / $5,657,688 / yes | -7% / $5,578,519 / yes | +0% / $5,700,000 / yes |
| t70c50b70: 70% / 99.5% / 50% back to 70% | -25% / $5,547,882 / yes | -15% / $5,609,984 / yes | -21% / $5,412,920 / yes | -22% / $5,401,779 / yes | -11% / $5,523,686 / yes |
| t70c50b55: 70% / 99.5% / 50% back to 55% | -19% / $5,488,200 / yes | -7% / $5,599,924 / yes | -13% / $5,482,859 / yes | -15% / $5,446,423 / yes | -2% / $5,658,415 / yes |
| t80c25b80: 80% / 99.5% / 25% back to 80% | -32% / $5,509,798 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t80c25b45: 80% / 99.5% / 25% back to 45% | -14% / $5,592,771 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t80c35b80: 80% / 99.5% / 35% back to 80% | -31% / $5,511,474 / yes | +0% / $5,700,000 / yes | -26% / $5,621,798 / yes | -29% / $5,487,678 / yes | +0% / $5,700,000 / yes |
| t80c35b45: 80% / 99.5% / 35% back to 45% | -15% / $5,589,691 / yes | +0% / $5,700,000 / yes | -6% / $5,595,067 / yes | -10% / $5,530,975 / yes | +0% / $5,700,000 / yes |
| t80c50b80: 80% / 99.5% / 50% back to 80% | -31% / $5,512,147 / yes | -22% / $5,567,090 / yes | -26% / $5,623,026 / yes | -28% / $5,487,942 / yes | -19% / $5,587,034 / yes |
| t80c50b55: 80% / 99.5% / 50% back to 55% | -19% / $5,488,200 / yes | -7% / $5,599,924 / yes | -13% / $5,482,859 / yes | -15% / $5,446,423 / yes | -2% / $5,658,415 / yes |
| t90c25b90: 90% / 99.5% / 25% back to 90% | -37% / $5,486,013 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t90c25b55: 90% / 99.5% / 25% back to 55% | -20% / $5,552,832 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes | +0% / $5,700,000 / yes |
| t90c35b90: 90% / 99.5% / 35% back to 90% | -37% / $5,486,267 / yes | +0% / $5,700,000 / yes | -32% / $5,380,603 / yes | -35% / $5,388,130 / yes | +0% / $5,700,000 / yes |
| t90c35b55: 90% / 99.5% / 35% back to 55% | -19% / $5,556,400 / yes | +0% / $5,700,000 / yes | -13% / $5,479,413 / yes | -15% / $5,446,499 / yes | +0% / $5,700,000 / yes |
| t90c50b90: 90% / 99.5% / 50% back to 90% | -37% / $5,487,378 / yes | -29% / $5,502,688 / yes | -32% / $5,381,124 / yes | -35% / $5,388,631 / yes | -27% / $5,490,805 / yes |
| t90c50b55: 90% / 99.5% / 50% back to 55% | -19% / $5,488,200 / yes | -7% / $5,599,924 / yes | -13% / $5,482,859 / yes | -15% / $5,446,423 / yes | -2% / $5,658,415 / yes |

## Open questions this report does not settle

- **Why the risk-based sets are not 100% funded under Monte Carlo.** The rule's cut lands on a level
  solved from 100 paths; on the paths that fail it either landed too high or the cut came too late
  for a horizon nearly gone. Which of the two, path by path, was not measured.
- **One chance model and one seed** for the table; the Monte Carlo pass uses a second seed of the
  same model. Historical (bootstrap) tables were not run.
- **GK-style on a plan that fails on its own assumptions.** Since P132j it measures against the
  plan's own path and so funds 51% of paths on the underfunded household; whether a rule should
  also cut a plan for failing on its own assumptions is a design question this report only exposes.

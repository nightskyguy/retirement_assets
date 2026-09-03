# The constant account split: is there one better than Proportional, and does it survive?

*(`P104b2`. Measured 2026-09-03 on engine v11.1718.)*

Every withdrawal strategy in the tool decides *how much* to draw. None of them lets you say *from
where*, as a fixed mix. The shipped default draws in proportion to account balances, and
[PERFECT_FORESIGHT_ORACLE.md](PERFECT_FORESIGHT_ORACLE.md) already refuted "Proportional is
default-optimal" and found the withdrawal **split** to be the oracle's dominant lever. This report
answers the two questions that decide whether a fixed-mix field is worth building:

1. **Is the oracle's ten-archetype menu good enough to pick shipping rows from?** No. It leaves a
   median **76.4%** of the achievable constant-split gain unclaimed, and in three of thirty cells it
   finds nothing at all where an exhaustive search finds $355k-$636k.
2. **Does any fixed mix beat the default once the future is uncertain?** Yes, and this is the part
   that matters: **six of six cells** have at least one vector that beats the default at the median,
   in all three Monte Carlo models, without giving up survival. One vector, `B9C1`, does it in all
   six.

The catch is in the floor, and it is stated in full below: **not one of the eleven vectors tested
keeps the 10th percentile at or above the default in every mode-cell.**

Harnesses:
[`split_fine_harness.js`](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/split_fine_harness.js)
(part 1) and
[`split_mc_harness.js`](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/split_mc_harness.js)
(part 2).

---

## Reading guide

Everything below is written in these codes. None of them appear before this point.

### Vectors

A **vector** is a fixed set of relative weights over the four account types, in the order
`[IRA, Brokerage, Cash, Roth]`. It is normalized by the engine, so `[7,2,1,0]` and `[70,20,10,0]` are
the same plan. Named as letters plus tenths:

| name | means | note |
|---|---|---|
| `B9C1` | 90% Brokerage, 10% Cash | the most robust vector in this study |
| `I5C4R1` | 50% IRA, 40% Cash, 10% Roth | the IRA-leaning alternative |
| `B6C2R2` | 60% Brokerage, 20% Cash, 20% Roth | |
| `Cash` | 100% Cash | a vertex, written as the account name |
| `prop` | equal thirds IRA / Brokerage / Cash | the oracle's archetype, off any 10% grid |

**A weight of 100% is not an exclusive draw.** Phase 2 of `calculateWithdrawals` walks the account
order for whatever the weighted phase could not fund, so `Cash` means "Cash first, then IRA,
Brokerage, Roth". This is why a single-account vector behaves like an ordered sequence, and it is the
premise of prediction `V-P1`.

### The two searches

| code | what it is |
|---|---|
| **base** | Proportional +0%, the shipped default. Also Guyton-Klinger's own draw, so a result about the base is a result about GK's draw. |
| **menu** | the oracle's ten hand-written archetypes, exactly as `P104a` used them. Eight land on the 10% grid and are read from the same results, so menu-vs-fine is one run. |
| **fine** | all 286 vectors on the 3-simplex at 10% steps: every mix in whole tenths. |
| **headroom** | `(fine gain - menu gain) / menu gain`. How much the menu left unclaimed, as a fraction of what it did claim. |
| **capture** | `(score(v) - base) / (fine best - base)` for one vector in one cell. `1.0` = as good as perfect per-cell hindsight, `0` = no better than the default, **negative = worse than the default**. |

### Cells

A **cell** is one household, one spending rate, one brokerage basis. Five account mixes
(`defaults`, `defaults3x`, `round1`, `thirds`, `brokheavy`), spending at 4% or 6% of assets, and
basis `b20` / `b50` / `b80` meaning the brokerage basis is 20%, 50% or 80% of its value. Part 1 runs
30 cells; part 2 runs six, at `b50`, plus `thirds @8%`.

All fixtures are the controlled ones per `P103b5c`: `CashReserve: 0` and spending declining 1% a
year in real terms. Conversions are left at the family default and never searched, so the whole
difference between arms is the split.

### Monte Carlo models

| mode | what it does |
|---|---|
| `gbm` | each year drawn from one lognormal: no sequence risk beyond independence |
| `bootstrap` | real historical blocks replayed, so real crashes in real order |
| `aam` | arithmetic-average model |

100 paths, seed 42, and **the same banks and the same path index for every arm**, so a difference is
the vector and not the draw of the dice. A claim is only as good as its worst mode.

### Predictions

Registered in `task_plan.md` before each run and scored after.

| code | claim | verdict |
|---|---|---|
| `F-P1` | fine beats the menu in most cells, but by **under 10%** of the menu's own gain | **WRONG** |
| `F-P2` | the fine winner is a blend of 2+ accounts in most cells | **RIGHT**, 30/30 |
| `F-P3` | basis moves the size of the gain, not the identity of the winner | **RIGHT** |
| `F-P4` | no single vector wins a majority of the 30 cells | **RIGHT**, top is 5/30 |
| `V-P1` | `Cash` fails survival under bootstrap somewhere, and is not median-best there | **RIGHT** |
| `V-P3` | the Monte Carlo median-best vector is a blend in most cells, never a single account | **RIGHT**, 18/18 |
| `V-P4` | some vector beats the default at the median with no worse survival, in every mode, in **4+ of 6** cells. **Kill switch: if wrong, no product work.** | **RIGHT**, 6/6 |

`V-P2` predicted the same thing as `F-P1` and is scored with it.

---

## Part 1: the menu was not close enough

286 vectors x 30 cells, 8,640 sims, 6.4 s. Spend drift across all arms was at most **$11** against
lifetime spending of millions, so every arm delivers the same spending and the wealth comparison
stands.

| cell | menu best | menu gain | fine best | fine gain | headroom |
|---|---|---|---|---|---|
| defaults @4% b20 | `I5C5` | $166,735 | `I4C5R1` | $203,299 | 22% |
| defaults @6% b20 | `I5C5` | $159,993 | `I5C4R1` | $257,236 | 61% |
| defaults @4% b50 | `I5C5` | $165,812 | `I4C5R1` | $202,375 | 22% |
| defaults @6% b50 | `I5C5` | $157,039 | `I5C4R1` | $254,272 | 62% |
| defaults @4% b80 | `I5C5` | $164,839 | `I4C5R1` | $201,403 | 22% |
| defaults @6% b80 | `I5C5` | $154,128 | `I5C4R1` | $251,353 | 63% |
| defaults3x @4% b20 | `B4C6` | $498,631 | `I4C5R1` | $582,522 | 17% |
| defaults3x @6% b20 | `I4B3C3` | $543,555 | `I1B5C2R2` | $1,136,528 | 109% |
| defaults3x @4% b50 | `B4C6` | $500,056 | `I4C5R1` | $522,403 | 4% |
| defaults3x @6% b50 | `I4B3C3` | $536,863 | `I2B3C3R2` | $980,081 | 83% |
| defaults3x @4% b80 | `B4C6` | $459,002 | `B4C6` | $459,002 | 0% |
| defaults3x @6% b80 | `prop` | $542,144 | `I3B3C2R2` | $1,004,948 | 85% |
| round1 @4% b20 | `Cash` | $559,517 | `I6C4` | $595,780 | 6% |
| round1 @6% b20 | `B4C6` | $594,852 | `B6C2R2` | $1,057,549 | 78% |
| round1 @4% b50 | `Cash` | $460,735 | `I6C4` | $495,600 | 8% |
| round1 @6% b50 | `B4C6` | $596,992 | `I1B6C2R1` | $1,053,321 | 76% |
| round1 @4% b80 | `Cash` | $392,376 | `I6C4` | $426,043 | 9% |
| round1 @6% b80 | `B4C6` | $863,708 | `B5C5` | $1,105,180 | 28% |
| thirds @4% b20 | `B4C6` | $268,294 | `I2B4C2R2` | $524,942 | 96% |
| thirds @6% b20 | `I5C5` | $302,619 | `B5C2R3` | $1,358,228 | 349% |
| thirds @4% b50 | `B4C6` | $126,438 | `B6C4` | $383,447 | 203% |
| thirds @6% b50 | `I5C5` | $190,302 | `I1B6C1R2` | $1,049,625 | 452% |
| thirds @4% b80 | `B4C6` | $116,556 | `B7C3` | $366,837 | 215% |
| thirds @6% b80 | **none** | $0 | `B6C2R2` | $636,049 | - |
| brokheavy @4% b20 | `I4B3C3` | $112,467 | `B5C1R4` | $791,291 | 604% |
| brokheavy @6% b20 | `Cash` | $168,391 | `B7C1R2` | $1,015,139 | 503% |
| brokheavy @4% b50 | **none** | $0 | `B9C1` | $410,612 | - |
| brokheavy @6% b50 | `Brok` | $220,475 | `B7C1R2` | $793,429 | 260% |
| brokheavy @4% b80 | **none** | $0 | `B9C1` | $354,823 | - |
| brokheavy @6% b80 | `Brok` | $166,224 | `B9C1` | $632,360 | 280% |

**`F-P1` is wrong and it is wrong by a lot.** The fine grid beats the menu in 26 of the 27 cells
where the menu found any gain, headroom is under 10% in only 5 of 27, and the median headroom is
**76.4%**. In the three `none` rows the menu's best choice was to leave the default alone while an
exhaustive search found between $354,823 and $636,049. The menu is not a grid: it is the oracle's
hand-written list, chosen to span shapes, not to be optimal. Shipping rows cannot be read off it.

**`F-P2`: all 30 fine winners are blends.** No shipped strategy family can express any of them.

**`F-P3`: basis moves size, not identity.** Across the ten mix-and-rate pairs the winner's Brokerage
share is non-decreasing from `b20` to `b80` in 8, and the dominant account is unchanged in 9. A
higher basis means a cheaper brokerage draw, and the winner leans further into Brokerage
accordingly - but it stays the same *kind* of vector. **A shipping grid therefore does not need
per-basis rows**, which is the cheap half of the row-budget problem.

**`F-P4`: 18 distinct winners over 30 cells**, the most frequent appearing in only 5. The
replacement for the default is regime-dependent, the same shape `P103d` found for draw rules.

### The greedy cover

A per-cell argmax names 30 winners and says nothing about what a household outside that cell gets. A
shippable grid is three or four rows, so vectors were added greedily by whichever most improved the
per-cell best capture:

| grid | mean capture | worst cell |
|---|---|---|
| `B7C2R1` | 64.9% | 20.2% |
| `+ I5C4R1` | 83.6% | 37.8% |
| `+ B6C2R2` | 89.0% | 49.0% |
| `+ B9C1` | 93.3% | 59.7% |

All 286 vectors are feasible in every cell, so nothing here is disqualified for stranding spending.
Two of the eight best single vectors do have **negative** worst-cell capture (`I2B5C2R1` -27.7%,
`I1B5C3R1` -37.5%): worse than today's default somewhere, which a shipped row must not be.

**This greedy cover is a candidate generator, not a recommendation.** Every number in part 1 has
perfect foresight over one return path. Part 2 is what decides, and it disagrees.

---

## Part 2: what survives an uncertain future

21,600 sims: 6 cells x 3 modes x 100 paths x 12 arms. Median spend is within a few dollars across
arms in every cell, so these are wealth comparisons at equal spending.

### Robustness by vector

"Cells won" means the vector beat the default's **median in all three modes with survival held**.
"Worst p10" and "worst survival" are that vector's worst single mode-cell, so a negative number is a
real cost somewhere even when the median is up everywhere.

| vector | cells won | median gain | worst p10 | worst survival |
|---|---|---|---|---|
| `B9C1` | **6/6** | $747,009 | -$144,762 | 0pp |
| `B7C1R2` | 5/6 | $784,269 | -$123,599 | 0pp |
| `B6C2R2` | 5/6 | $677,832 | -$341,155 | 0pp |
| `I5C4R1` | 4/6 | $261,694 | -$211,284 | -1pp |
| `I4C5R1` | 4/6 | $257,599 | -$204,806 | -1pp |
| `B4C6` | 3/6 | $259,747 | -$452,150 | -1pp |
| `Cash` | 3/6 | $248,133 | -$516,573 | -1pp |
| `I5C5` | 3/6 | $221,220 | -$505,002 | -1pp |
| `I6C4` | 3/6 | $190,228 | -$426,493 | -1pp |
| `B7C2R1` | **1/6** | $55,047 | -$456,465 | -1pp |
| `Brok` | 1/6 | $23,225 | -$340,300 | -2pp |

**`V-P4` is right in 6 of 6 cells**, so the kill switch does not fire: between 4 and 10 of the eleven
vectors clear the default in every mode in every cell.

**The single-path greedy winner is the worst pick in the table.** `B7C2R1`, the first vector the
part-1 cover chose, wins **1 of 6** cells for a median $55,047 - against `B9C1`'s 6 of 6 for
$747,009. Part 1 ranked it first because it was the best compromise across cells *fitted to their
own realized paths*; out of sample that ranking inverts. This is `P103e`'s lesson arriving on
schedule, and the reason `b3`'s grid must come from this table and not from the one above.

**`V-P3`: the median-best arm is a blend in all 18 mode-cells**, never a single account.

**`V-P1` is right.** `Cash` gives up survival in one of six bootstrap cells (89% against the
default's 90%) and is not median-best in any of the six. Its shape is Ordered CIBR's, the family
`P103e` measured at 0% survival, and it behaves accordingly: 3 of 6 cells won, the second-worst
floor in the table at -$516,573.

### One cell in full, bootstrap

`round1 @6%`, the hardest cell for the IRA-leaning vectors:

| vector | median wealth | p10 wealth | success | vs default |
|---|---|---|---|---|
| **prop +0% (default)** | $8,583,933 | $1,767,433 | 90% | - |
| `B9C1` | $9,828,522 | $2,134,274 | 90% | **+$1,244,589**, survival held, floor **up** |
| `B4C6` | $9,823,703 | $2,168,494 | 90% | +$1,239,770, survival held, floor up |
| `B6C2R2` | $9,667,356 | $2,341,830 | 90% | +$1,083,423, survival held, floor up |
| `B7C1R2` | $9,397,184 | $2,241,163 | 90% | +$813,251, survival held, floor up |
| `I4C5R1` | $8,818,114 | $1,562,626 | 89% | +$234,181 median, **worse survival** |
| `I5C4R1` | $8,802,237 | $1,556,148 | 89% | +$218,305 median, worse survival |
| `B7C2R1` | $8,773,186 | $1,693,488 | 89% | +$189,254 median, worse survival |
| `Brok` | $8,453,906 | $1,427,133 | 89% | -$130,027 |
| `I5C5` | $8,369,683 | $1,262,430 | 89% | -$214,249 |
| `I6C4` | $8,366,532 | $1,340,939 | 89% | -$217,401 |
| `Cash` | $8,327,289 | $1,250,860 | 89% | -$256,644 |

Two things read straight off this. A brokerage-weighted vector here raises the median by over a
million **and lifts the 10th percentile**, which is the profile a shipped row wants. And four of the
eleven vectors are outright worse than the default in this cell, so "add a split field" is not a
free option: the wrong vector loses real money.

---

## What this recommends

**For the `P104b3` grid**, in order of evidence:

1. **`B9C1`** - 6 of 6 cells, median $747,009, survival never worse. The only vector that clears the
   default everywhere.
2. **`B7C1R2`** - 5 of 6, median $784,269, the smallest floor damage in the table (-$123,599).
3. **`B6C2R2`** - 5 of 6, median $677,832.
4. **`I5C4R1`** - 4 of 6, median $261,694, and the only IRA-leaning vector that clears four cells.
   Worth a row for the households where brokerage-first is wrong rather than for its size.

**Do not ship `B7C2R1`** despite it topping the single-path cover, and do not ship `Cash`, `Brok` or
`I5C5`: 1, 1 and 3 cells won, with three of the four worst floors in the study.

**One caveat belongs on the feature, not in a footnote.** Every vector tested, including all four
recommended, lowers the 10th percentile in at least one mode-cell - between $123,599 and $516,573.
A fixed split raises the median and holds survival; it does not improve the bad case, and in the bad
case it can cost. That is a statement about a *shipped row a user may pick*, so it belongs in the UI
copy.

## Limits of this study

- **Constants only.** One switch (`P104c`) and per-year freedom (`P104e`) are not measured here.
  `P104a` found one switch reaching 85-100% of the full per-year optimum in 7 of 10 cells, on the
  pre-v11.1701 engine.
- **Part 1 has perfect foresight**, and its ranking is demonstrably not the out-of-sample ranking.
  Read part 1 for the *size of the prize* and part 2 for *which vector to ship*.
- **Six cells, 100 paths, one seed** in part 2. The direction is consistent across three models, but
  a 1pp survival difference on 100 paths is one path.
- **Basis was measured in part 1 only.** `F-P3` is the justification for holding part 2 at `b50`, and
  it is an inference from 10 mix-rate pairs, not a proof.
- **Engine v11.1718.** The `P105` survivor-RMD fix shipped the same day and every fixture has a
  death inside the plan: it moves single-path scores by up to $110,611, arm-dependently. Numbers
  here belong with each other and **not** with `P104a`'s `k=2` / `k=free` columns, which predate it.

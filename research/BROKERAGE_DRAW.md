# Why Brokerage is barely drawn, and whether the exclusion keeping it out is still right  *(phase P32)*

**Run:** Q1/Q3-Q6 on 2026-08-10, engine at `5e1075e` (post dividend fix `e9a3c8b`, post basis
step-up v11.1499). **Q2 on 2026-08-21**, engine at `0b4d5b5` (v11.15cf, post SALT/IRMAA).
**Harness:** `node .test_harnesses/brokerage_harness.js`. Q3/Q4 run the Optimizer's own enumeration
(192 arms, nerdknob configuration) over the Stage-1 45-cell grid (P28 5-mix ladder x wealth
x0.5/1/3 x spend 4/6/8%), scored with the UI's recipe: shared per-cell heirs rate, `baselineScore`
/ real after-tax NW.

**Q2 did not run at all until 2026-08-21.** Its probe tested for `totals.tpBrokIters`, a name that
never existed - the shipped counters are `thirdPassBrokerIters` / `thirdPassBrokerCapped` /
`thirdPassBrokerStalled`. From v11.1582 (when the arms shipped) until the repair, every run printed
`SKIPPED` and the question looked answered. Anything written before 2026-08-21 that cites a Q2
number came from a separate scratch script, not from this file.

## Reading guide - every label used below, defined once

Sections after this one use these codes without re-introducing them.

### Where this file sits

The user asked three questions on 2026-08-10: **(A)** how hard whole-horizon asset-utilization
optimization is on this engine, **(B)** whether Cyclic leaves money on the table in its harvest
years, **(C)** whether Proportional's optimality can be proven. The answer was planned as a
three-stage program:

| stage | what it did | where it landed |
|---|---|---|
| **Stage 1** | scans - Q1 re-run, Q3, Q4 | this file, plus `STRATEGY_FAMILY_RANKING.md` |
| **Stage 2** | the `cycleHarvestMode` / `cycleCoexist` A/Bs - Q5, Q6 | this file |
| **Stage 3** | perfect-foresight oracle, became phase P51 | [`PERFECT_FORESIGHT_ORACLE.md`](PERFECT_FORESIGHT_ORACLE.md) |

So "question B" below is the user's B, and "Stage 2's q6" means **Q6 in this file**, which is
where B gets its causal answer rather than a descriptive one.

### The six questions

| id | question | asked because |
|---|---|---|
| **Q1** | how often is Brokerage drawn at all, by strategy family? | re-run after the dividend double-credit fix |
| **Q2** | does letting the third pass draw Brokerage cause a cap-gains spiral? | the exclusion at `optimizer_core.js:2044` cites no run |
| **Q3** | does cyclic harvesting ever beat its non-cyclic twin? | |
| **Q4** | is `cycleLTCGTarget` 0.20 better than the shipped 0.15? | |
| **Q5** | does `cycleHarvestMode: maxbracket` - top the harvest off to fill the 0% LTCG bracket - pay? | |
| **Q6** | does `cycleCoexist: bracketfill` - let a harvest year also run the family's IRA sizing - reclaim the money question B is about? | |

### The four prediction families, and a name collision to watch

Every prediction was registered in the harness before the numbers were looked at. They come in four
batches with different prefixes, and **all verdicts are in the "Predictions scored" section near the
end**:

| ids | registered for | stated where |
|---|---|---|
| **P1 - P4** | Q1, the draw-frequency question | harness header |
| **P5, P6** | Q2, the spiral question | harness header |
| **S1-P2 - S1-P4** | Stage 1: Q3, Q4, and the Q1 re-run | harness, `q3/q4` section |
| **S2-P1 - S2-P3** | Stage 2: Q5 and Q6 | harness, `q5/q6` section |
| **B-P1 - B-P3** | the basis-axis extension | harness, basis section |

> **`P5` and `P6` here are PREDICTIONS, not phases.** `task_plan.md` also has a phase P5 (per-year
> conversion schedule) and a phase P6 (simulation sanity tests), and they are unrelated. Everywhere
> in this file a bare `P1`-`P6` is a prediction; a phase is written `P32d`, `P36`, `P51` and so on.

The statements, so a verdict below can be read without jumping:

| id | prediction |
|---|---|
| **P1** | baseline / propwd / gk / fixed draw Brokerage most often and earliest - their gap fill is proportional, not sequential |
| **P2** | bracket / minlimit / fixedpct draw it less and later - Cash comes first in their chain |
| **P3** | ordered BIRC ~100% from year 0, CBIR high, RIBC lowest and latest |
| **P4** | rows that never draw Brokerage are rare outside RIBC and Brokerage-poor plans |
| **P5** | the spiral does not diverge: SS inclusion caps at 85% and LTCG at 20%, so the feedback is convergent |
| **P6** | allowing Brokerage in the third pass eliminates the pinned `minlimit` stranding |
| **S1-P2** | cyclic beats its non-cyclic twin in <15% of cells, wins concentrated in the brokerage-heavy mixes |
| **S1-P3** | `cycleLTCGTarget` 0.20 moves the result <1%, except in 8%-spend cells |
| **S1-P4** | every family's draw frequency rises vs the pre-fix engine; never-draw rows stay at 0 |
| **S2-P1** | `bracketfill` does no harm in >=80% of pairs, median gain <2% |
| **S2-P2** | coexist gains scale with harvest frequency - largest in thirds / brokheavy |
| **S2-P3** | `maxbracket` beats `spendonly` in >=70% of pairs |
| **B-P1** | the 0.20-target losses GROW at 20% basis and shrink toward inert at 80% |
| **B-P2** | coexist's median is more negative at 20% basis; the IRA Draw 5-8% gains persist at both extremes |
| **B-P3** | `spendonly`'s win share grows at 20% basis and falls toward parity at 80% |

### Grids, mixes and arm labels

Two different grids feed this file; the **Coverage** section near the end carries both in full.

- **The Q1 / Q2 ladder** - five scenarios named `capbase`, `brokPoor`, `brokThird`, `brokHalf`,
  `brokRich`, walking Brokerage-poor to Brokerage-rich with total investable held at $2.25M so that
  "how often is Brokerage drawn" is not confounded with how much of it there is.
- **The Stage-1 45-cell grid** - mixes named `defaults`, `round1`, `thirds`, `brokheavy`, crossed
  with wealth x0.5/1/3 and spend 4/6/8%. Full mix table in `STRATEGY_FAMILY_RANKING.md`.

**Strategy families** name which gap-fill branch an arm lands in: `baseline` (proportional
Brokerage+Cash), `bracket` (Cash then Brokerage then Roth - covers `bracket22`, `minlimit`,
`fixedpct2`), `ordered` (the user's own sequence), `cyclic` (the harvest branch).

**`CBIR` / `RIBC` / `BIRC`** are the ordered strategy's draw sequences, one letter per account:
**C**ash, **B**rokerage, **I**RA, **R**oth. `BIRC` draws Brokerage first; `RIBC` reaches it third,
behind Roth and the whole IRA.

**Basis fraction** (`b20` / `b50` / `b80` in cell names) is cost basis as a share of the Brokerage
balance. Low basis = highly appreciated, so each harvested dollar realizes more gain.

---

## Q1 re-run on the corrected engine (P32d precondition)

Share of years drawing Brokerage, by gap-fill family, vs the 2026-08-06 numbers measured on the
double-crediting engine:

| family | pre-fix | now | direction |
|---|---|---|---|
| baseline | 90.4% | 92.7% | UP |
| bracket | 61.1% | 62.2% | UP |
| cyclic | 57.5% | 56.7% | DOWN 0.8pt |
| ordered | 44.7% | 45.8% | UP |

Never-draw rows: still **0 of 55**. Ordered sub-order: CBIR 51.7% > BIRC 46.7% > RIBC 39.2%
(same ordering conclusion as pre-fix; prediction P3's BIRC-first ordering stays WRONG).

**S1-P4 scored WRONG on a technicality:** three of four families rose as predicted, but cyclic
fell 0.8pt. The premise refutation stands unchanged — Brokerage is drawn constantly.

## Q2 — does a third-pass Brokerage leg spiral? **No. And the two arms are not one decision.**

`optimizer_core.js:2044` excludes Brokerage from the third pass and gives a reason: selling
Brokerage realizes gains, gains raise the taxable share of Social Security, that raises the
shortfall, repeat. The comment cites no run. Two engine arms (default off, no UI) make it
falsifiable, and a third question rides along: the funding backstop next door has the same
exclusion for a different reason.

| arm | what is on |
|---|---|
| `off` | neither — today's shipped behavior, the control |
| `bounded` | third pass may draw Brokerage, then re-draw against the residual its own gains re-open, **cap 6** |
| `unbounded` | same, **cap 200**, so a real spiral shows up as a run that keeps needing passes |
| `brokFirst` | third pass untouched; the **funding backstop** spends Brokerage before forcing IRA above the strategy's ceiling |
| `bnd+brokFirst` | both |

Grid: 3 basis fractions x 3 states x 2 dividend rates x the 5-scenario ladder x 11 strategy arms x
5 Q2 arms = **4,950 runs**, 3,960 of them armed. ~0.7ms per `simulate()`.

### The spiral is not there

| arm | runs w/ iters | total iters | max iters | **CAPPED yrs** | stalled yrs |
|---|---|---|---|---|---|
| `off` | 0/990 | 0 | 0 | **0** | 0 |
| `bounded` | 461/990 | 12,732 | 74 | **0** | 892 |
| `unbounded` | 461/990 | 12,732 | 74 | **0** | 892 |
| `brokFirst` | 0/990 | 0 | 0 | **0** | 0 |
| `bnd+brokFirst` | 461/990 | 12,601 | 74 | **0** | 761 |

**Zero capped years in 3,960 armed runs**, and `bounded` is identical to `unbounded` on every
counter. That identity is the load-bearing evidence, not the zero: `bounded` stops at 6 passes and
`unbounded` at 200, so if any single year had ever wanted a 7th the two rows would differ. They do
not, anywhere on the grid. **Prediction P5 RIGHT.**

Three readings that are easy to get wrong:

- **`max iters = 74` is a RUN TOTAL**, summed over a 24-year plan, not a per-year depth. The
  bounded/unbounded identity is what bounds the per-year figure, at ≤6.
- **The 2,545 stalled years are not a counter-finding.** Stalled means the residual stopped
  improving while Brokerage still held a balance — dust, or a draw whose own tax eats the draw. The
  engine's first draft had no stall guard, burned all 200 passes on dust balances while lifetime
  Brokerage drawn did not move a dollar, and would have been written up as divergence. Capped and
  stalled are printed in separate columns and are never summed.
- **`brokFirst` shows 0 armed runs by design.** It is the funding backstop, a different loop with no
  counter of its own. Absent ≠ zero; if that arm ever needs iteration evidence it needs a counter
  added first.

### Axis readings — and the axis picked as the amplifier did not amplify

| axis | total iters | CAPPED | stalled | armed runs |
|---|---|---|---|---|
| basis 20% / 50% / 80% | 13,088 / 12,652 / 12,325 | 0 / 0 / 0 | 827 / 874 / 844 | 453 / 465 / 465 |
| state CA / NY / TX | 12,362 / 15,718 / 9,985 | 0 / 0 / 0 | 950 / 889 / 706 | 480 / 480 / 423 |
| dividend 0% / 2% | 20,873 / 17,192 | 0 / 0 | 1,796 / 749 | 771 / 612 |

Basis is the spiral's amplitude in theory — a 20%-basis account realizes four times the gain per
dollar raised that an 80%-basis one does — and it moves the iteration count by 6%. NY works the
third pass hardest (15,718 vs TX 9,985), which is state tax feeding `_brokTaxRate` exactly as
expected. Dividends **suppress** the arm rather than feed it: at 2% there are fewer armed runs and
under half the stalled years, because dividend income closes part of the gap before the Brokerage
leg fires at all.

### The finding worth more than the spiral answer

Funded-year movers, armed vs `off` in the same cell:

| arm | movers | better | **WORSE** |
|---|---|---|---|
| `bounded` | 11 | 9 | 2 |
| `unbounded` | 11 | 9 | 2 |
| `brokFirst` | 97 | 9 | **88** |
| `bnd+brokFirst` | 101 | 9 | **92** |

**`brokFirst`'s 9 winning cells are the SAME 9 cells `bounded` wins — set-identical, verified, not
eyeballed.** It therefore buys nothing the third-pass arm does not already deliver, and pays 88
losses for it. On funded years the third-pass arm **strictly dominates** it.

Worst case, `capbase/fixedpct2 b20 CA d0` under `brokFirst`: **24 funded years → 5**, forced IRA
$2,238,492 → $270,857, final net worth **+$1,343,512**. Judged on the tax column or the wealth
column alone that is a $1.3M win. It is nineteen unfunded years. This is the P32a shape again —
spend Brokerage early, have none left later — which is why the funded-years column was put beside
the forced-IRA column before the grid was run rather than after.

### Every third-pass winner is `minlimit`, which is the defect this phase opened with

All 9 winning cells are IRMAA Ceiling rows: `capbase/minlimit` 19→23 funded (CA), 14→23 (NY), 19→24
(TX), at all three basis fractions. That is the pinned defect in the harness header — `minlimit`
stranding $71,382 across nine consecutive years with Brokerage untouched and every other account at
zero. **Prediction P6 RIGHT** for the arm it actually named.

The 2 losers are both `brokPoor/minlimit` NY, 24→23 funded, shortfall better by $6, final net worth
−$9,108.

### The unfunded DOLLARS, which is what the funded-year count could not say

| arm | runs where unfunded fell | rose | **$ newly funded** | **$ newly unfunded** |
|---|---|---|---|---|
| `bounded` | 9 | 385 | **$372,455** | **$1,711** |
| `unbounded` | 9 | 385 | **$372,455** | **$1,711** |
| `brokFirst` | 9 | 120 | $372,455 | **$27,860,186** |
| `bnd+brokFirst` | 9 | 432 | $372,455 | $27,892,739 |

The third-pass arm funds **$372,455** of spending the plan had promised and could not pay, and costs
**$1,711** of newly unfunded spending across 385 runs — about $4 a run, which is rounding dust. That
is a **218:1** ratio. `brokFirst` buys the identical $372,455 and costs **$27.9 million**.

Per-year detail on the sharpest cell, `capbase/minlimit b20 NY d0`:

| | `off` | `bounded` |
|---|---|---|
| funded years | 14 / 24 | **23 / 24** |
| failed years | 10 (2040-2049) | **1** (2049) |
| unfunded dollars | $68,792 | **$6** |
| lifetime spend | $4,498,817 | **$4,567,603** |
| final net worth | $181,986 | $78,139 |

**A CORRECTION, and the reason this table exists.** The first write-up of this result (2026-08-21,
same day) reported "funded more years while *raising* total shortfall", and treated it as an
unresolved trade-off for [P32h]. That was wrong, and it was wrong for one reason:
`totals.shortfall` accumulates `Math.min(0, netIncome - spendGoal)` (`optimizer_core.js:2310`,
`:2726`) and is therefore **negative or zero**. A raw delta of `+$68,786` is $68,786 of previously
unpaid spending **now being paid**, not new shortfall. The engine agrees: lifetime spend rises by
exactly that $68,786 and `failedInYear` drops from ten years to one. The harness now prints unfunded
dollars as positive magnitudes, `off -> armed`, so the direction is on the page and cannot be
misread again.

What remains true is the cost: **terminal wealth falls** (−$103,847 on that cell) because the money
is spent instead of left. That is the actual trade, and it is a much easier one than "more years but
more shortfall" suggested. The plan pays for the retirement it promised and leaves less behind.

### Inert, not zero

`ord-CBIR` / `ord-RIBC` / `ord-BIRC` are excluded from both arms by design
(`optimizer_core.js:2107` and `:2169` — ordered runs the user's own sequence in the third pass, and
strict ACA is excluded from the backstop for the FPL-cliff reason). The harness reports them as
INERT and separately checks that 0 ordered rows moved anyway. They did not.

## Q3 — does cyclic ever win? YES, and about half the headline is a confound

Family-level best cyclic clone vs best non-cyclic row, success required, spend equal within $1,
Δ real after-tax NW at the cell's shared heirs rate.

**Shipped behavior (legacy CashReserve — non-cyclic surplus parks in Cash):**
- Cyclic wins in **26/45 cells (58%)**. S1-P2 (<15%) scored **WRONG**.
- Wins are NOT concentrated in brokerage-heavy mixes (9/26 in thirds+brokheavy; `defaults` leads
  at 7/9) — the annex prediction had the geography backwards.
- Largest wins: **+$1.9M** (Ordered CBIR ira-first, defaults x0.5 @4%), +$1.7M, +$1.6M — all
  4%-spend IRA-heavy cells.

**Confound control (`CashReserve: 0` — BOTH arms reinvest surplus into Brokerage):** a cyclic
clone differs from its twin in three ways: harvest-year branch preemption, surplus routed to
Brokerage instead of Cash (`optimizer_core.js:2065`), forced DRIP (inert here, base already
reinvests). Under legacy rules the non-cyclic arm suffers exactly the surplus-cash-drag P2
documented, so the legacy A/B attributes the bundle, not the harvest. With the routing equalized:
- Cyclic still wins **23/45 cells** — the effect is real, not just routing.
- But the magnitude halves: max win **$890,626** (Proportional 0% brokerage-first, brokheavy x3
  @4%), and the winner geography flips to what the annex predicted: x3-wealth, brokerage-heavier
  cells, mostly **[brokerage-first]** clones.
- Reading: roughly half the shipped-behavior delta is surplus routing; the remainder is genuine
  harvest value (0% LTCG basis step-up + the cheaper draws it enables later).

Note: `Proportional 0%` and `Guyton-Klinger` post identical deltas in several control cells — on
a smooth deterministic path GK never triggers a guardrail and degenerates to the engine fallback,
so those rows are twins. ACA rows are not excluded here (untenability hits both sides of the pair
equally), but ACA family wins inherit the one-sided-pricing caveat.

**Harvest-year money-on-the-table (descriptive; the causal number is Q6 below):** pooled over
successful cyclic rows, 28,390 harvest years drew only $4.1M of IRA (and $8.7k of conversions —
the surplus-conversion cap at `:1984-1988` zeroes them). Forgone IRA draw per harvest year,
using each arm's own IRA-year mean: **~$111,700**. Median per-row forgone equals **57.1%** of the
row's lifetime voluntary IRA draws. Question B is very much alive.

## Q4 — `cycleLTCGTarget` 0.20 vs 0.15: a real lever pointing the WRONG way

2,576 cyclic pairs (every cyclic arm x 45 cells, 0.15 vs 0.20):
- **898 pairs move** more than $1 — the knob is live, S1-P3 (<1% off 8% spend) scored **WRONG**
  (max 6.08% in a 6%-spend cell).
- But 0.20 **wins only 53 of 2,576**. The largest moves are all LOSSES: −$380k, −$373k, −$332k
  (brokheavy x0.5, Fill Bracket cyclic arms).
- Mechanism: harvesting into the 15% LTCG bracket pays real tax today on gains the terminal
  §1014 step-up would have erased at death. Target-the-0%-bracket (0.15, the shipped default) is
  the correct default by a wide margin.

**Feeds P32h:** default 0.15 CONFIRMED; un-gating the knob would mostly hand users a footgun.
If it stays nerdknob-gated, nothing is being hidden that helps.

## Q5 — `cycleHarvestMode`: does "max the bracket anyway" pay? NO, mostly

Research input `cycleHarvestMode: 'maxbracket'(default) | 'spendonly'` (P32c, default off =
today's behavior, bit-identical test pinned). A/B over every successful cyclic arm x 45 cells,
spend equal within $1 (2,514 pairs):

- **maxbracket wins only 108 pairs (4%)**; spendonly wins the bulk, median gains $0-$6.4k by mix,
  max **+$395,892** (brokheavy x0.5 @4%, IRA Draw 15% cyclic).
- Mechanism: with the IRC §1014 step-up firing at both deaths (v11.1499), gains held to death are
  erased anyway — so a 0%-bracket harvest's basis step-up has no terminal payoff, while its MAGI
  side effects (SS taxation, IRMAA) and the sell/re-buy churn remain. The deliberate top-off at
  `optimizer_core.js` (`_targetNetRoom` when spend fits) is a pre-step-up design.
- spendonly's worst losses are thin and high-strain (−$107,822, thirds x0.5 @8%).
- **S2-P3 (maxbracket wins >=70%) scored WRONG — inverted.**

## Q6 — `cycleCoexist`: harvest-year IRA draws reclaim money… only for measured arms

Research input `cycleCoexist: 'off'(default) | 'bracketfill'` (P32c): a harvest year ALSO runs
the family's IRA sizing (v1: bracket/minlimit/aca + fixedpct), IRA sized first, harvest re-sized
against the raised ordinary floor, MAGI ceilings via a two-pass fixed point. With
`netWithdrawals.IRA > 0` the surplus-conversion cap un-zeroes automatically — harvest years
regain conversions with no second edit (test-pinned).

1,232 successful equal-spend pairs (v1-family cyclic arms x 45 cells):

- **Median is NEGATIVE**: bracketfill loses 804 pairs, wins 217. By-mix medians: defaults $0,
  round1 −$31k, thirds −$100k, brokheavy −$99k.
- **The skip was accidentally protective for aggressive ceilings.** Worst: Fill Bracket 35%
  cyclic −$2,086,801, IRMAA Tier 4 −$1,940,161 (round1 x3 @4%). Coexist makes an arm MORE
  itself — a harvest year that draws-and-converts to a 35% ceiling is simply another year of the
  arm's own value-destroying medicine, and skipping ~1-in-N years was dampening it.
- **For measured draw rates it genuinely pays**: IRA Draw 5-8% [brokerage-first] gains up to
  **+$807,715 (15.7%)** at defaults3x x3 @4%. The "money on the table" from Stage 1's descriptive
  stat is real, but only where the reclaimed draw is itself well-sized.
- **S2-P1 (no-harm >=80%) WRONG** (35%); **S2-P2 (gains scale with harvest frequency) WRONG** —
  frequency scales the effect's MAGNITUDE in both directions, not its sign.

**Answer to the user's question B:** yes, cyclic harvest years leave money on the table — but
reclaiming it blindly with the family's own sizing is net-negative on median. The lever is real
(+$808k best case), conditional on the arm's ceiling being moderate. A shipped version would need
arm-aware gating, which is exactly the kind of heuristic this repo requires an axis-property +
pinned test for.

## Predictions scored

All four batches, every one registered in the harness before the numbers were looked at. The
statements are in the reading guide at the top; P1, P2 and P4 were scored in the pre-fix 2026-08-06
run and are not re-scored here.

| id | prediction | verdict |
|---|---|---|
| S1-P2 | cyclic beats its twin in <15% of cells, concentrated brokerage-heavy | **WRONG** — 58%, and concentration only appears after the routing confound is removed |
| S1-P3 | 0.20 inert (<1%) outside 8%-spend cells | **WRONG** — up to 6.08%, but as losses |
| S1-P4 | all families' draw frequency rises post-fix; never-draw stays 0 | **WRONG** (cyclic −0.8pt; never-draw did stay 0) |
| S2-P1 | bracketfill no-harm in >=80% of pairs, median gain <2% | **WRONG** — no-harm 35%, median −0.73% |
| S2-P2 | coexist gains scale with harvest frequency | **WRONG** — frequency scales magnitude both ways, not sign |
| S2-P3 | maxbracket beats spendonly in >=70% of pairs | **WRONG — inverted**: maxbracket wins 4% |
| P5 | the spiral does not diverge; SS inclusion caps at 85% and LTCG at 20%, so the feedback is convergent | **RIGHT** — 0 capped years in 3,960 armed runs; bounded ≡ unbounded on every counter |
| P6 | allowing Brokerage in the third pass eliminates the pinned `minlimit` stranding | **RIGHT** — 9 of 11 movers better, every one of them a `minlimit` row |
| B-P1 | 0.20-target losses grow at 20% basis, shrink at 80% | **RIGHT** — worst loss −$540k at b20, −$380k at default basis, −$232k at b80 |
| B-P2 | coexist median more negative at 20% basis; IRA Draw gains persist at both extremes | **RIGHT** — median −$39k at b20 vs −$4.8k at b80; IRA Draw gains at every basis |
| B-P3 | spendonly win share grows at 20% basis, falls toward parity at 80% | **RIGHT** in direction — 58% / 58% / 56%, but the share barely moves |

Prediction P6 named the **third-pass** arm. Scoring it against the pooled funded-year total would have let
`brokFirst` — an arm P6 never mentions — decide the verdict and print "MIXED". It is scored per arm
instead, and `brokFirst`'s own record (9 better / 88 worse) is reported beside it as a separate
decision.

## Coverage — what was actually varied (guard against extrapolating past it)

Two DIFFERENT grids feed this file:

**Q1 / audit / Q2 — the original P32 ladder** (5 scenarios, total investable held at $2.25M so
"how often is Brokerage drawn" is not confounded with how much of it there is). **Q1 runs it as
below; Q2 (2026-08-21) crosses the same ladder with basis 20/50/80%, states CA/NY/TX and
dividendRate 0/2%**, so the "single state, 50% basis, dividend 0" limits below apply to Q1 only:

| scenario | Brokerage (share) | IRA | Roth | Cash |
|---|---|---|---|---|
| capbase | $100k (4.4%) | $2.1M | $0 | $50k |
| brokPoor | $100k (4.4%) | $2.05M | $50k | $50k |
| brokThird | $750k (33%) | $1.3M | $100k | $100k |
| brokHalf | $1.125M (50%) | $875k | $125k | $125k |
| brokRich | $1.5M (67%) | $500k | $125k | $125k |

Basis = 50% of Brokerage throughout. Household: couple 66/67 at start (born 1960/1959),
**die at 74/90 (deaths 2034/2049) — ~15 survivor years, 24-year horizon**, spend $160k
declining 1%/yr (7.1% of assets), SS $48k+$24k @67, CA, growth 5%, dividendRate 0 (pinned so
the dividend defect could not contaminate Q1), x 11 strategy arms = 55 rows.

**Q3/Q4/Q5/Q6 — the Stage-1 crossed grid** (45 cells x 192 arms): 5 mixes x wealth x0.5/1/3 x
spend 4/6/8% of assets. Full mix table in `STRATEGY_FAMILY_RANKING.md` (Coverage section). Ranges:
total assets **$810k – $14.58M**; IRA share 22–86%; Brokerage share 6–62%; Roth 4–32%; annual
spend **$32,400 – $1,166,400**; basis fraction 43–56%. Held fixed: couple 64/62 die 92/94
(deaths 2054/2058 — only 4 survivor years, 33-yr horizon; note this DIFFERS from the Q1
ladder's ~15), SS $45k+$24k, CA, 6%/2.5% path, dividendRate 2%.

**Basis-axis extension (2026-08-10, closes the 43-56% gap for the 45-cell A/Bs).** The Stage-1
grid was rebuilt at basis = 20% (highly appreciated) and 80% (mostly contributions) and Q3-Q6
re-run. Predictions B-P1 to B-P3 (stated in the reading guide) pre-registered; **all three
RIGHT** — every conclusion holds at
both extremes, with magnitudes scaling exactly as the §1014 mechanism predicts:

| question | basis 20% | mix default (43-56%) | basis 80% |
|---|---|---|---|
| Q3 (control) cyclic wins | 20/45 | 23/45 | 22/45 — **basis-stable** |
| Q4: 0.20-target wins / worst loss | 9 of 2,467 / **−$540k** | 53 of 2,576 / −$380k | 83 of 2,643 / −$232k |
| Q5: spendonly win share / max win | 58% / **+$561k** | 58% / +$396k | 56% / +$237k |
| Q6: coexist median / IRA Draw max gain | **−$39k** / +$649k | −$27k / +$808k | −$4.8k / **+$980k** |

Readings: (a) the anti-lever verdicts (Q4 gate-protective, Q5 top-off harmful) STRENGTHEN at
low basis and soften-but-hold at high basis — harm scales with the gain fraction each harvested
dollar carries; (b) coexist's dual character is basis-stable: aggressive ceilings lose $1.8-2.3M
at every basis, measured IRA Draw arms gain at every basis and gain MOST at 80% (the reclaimed
draw is cheapest when the harvest it displaces carries little gain); (c) B-P3's direction held
but the win-share barely moves (58/58/56%) — basis bites through magnitude, not frequency.

**Remaining coverage gaps:**
- The Q1 ladder itself stays at 50% basis, CA, dividend 0 (deliberate: comparability with the
  pre-fix record). **Q2 no longer does** — it crosses that ladder with basis 20/50/80%, CA/NY/TX and
  dividend 0/2%, so the spiral verdict is not a single-configuration result even though Q1's
  draw-frequency numbers still are.
- The two grids disagree on survivor exposure (~15 survivor years vs 4), so any
  survivor-sensitive effect (widow brackets, IRMAA single thresholds) is mostly probed by Q1's
  ladder, only weakly by the 45-cell A/Bs.
- Single state (CA), single return path, no pension, one SS profile per grid.

## Scope limits

One deterministic return path (6%/2.5%), CA only **for Q1 and Q3-Q6** (Q2 covers CA/NY/TX), one
age/SS profile, 45-cell grid, spend rates are % of total assets. Aggregate basis (no lot selection/HIFO), one-sided ACA pricing, no SECURE
10-yr heirs, IRC §1014 step-up at terminal row. Q3/Q4 compare within cells only. Q1 runs on the
original P32 5-scenario ladder (CAP_BASE derivative), unchanged from the pre-fix run for
comparability. **Q2's verdict is bounded by its own grid**: no capped year appeared in 3,960 armed
runs across three basis fractions, three states and two dividend rates, which refutes the spiral as
a general reason for the exclusion but is not a proof that no scenario anywhere can produce one. A
future capped year should be re-checked against the `unbounded` arm before being called a spiral —
the convergence test sits at the TOP of the loop body (`optimizer_core.js:2118`), so a year that
consumes all 6 bounded draws is counted Capped without a final test.

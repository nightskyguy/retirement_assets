# The withdrawal-timing trigger (P28jf)

Does the rule that moves a year's spending withdrawal from November to January, because last year
converted, ever pay for itself?

Script:
[`.test_harnesses/timingtrigger_harness.js`](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/timingtrigger_harness.js)

---

## Reading guide

Everything below uses these, and none of them is defined anywhere else in this file.

| term | meaning |
|---|---|
| **Early** | `preMonths = 1`. The whole year's spending withdrawal leaves the portfolio in January, and what remains compounds for eleven months |
| **Late** | `preMonths = 11`. The withdrawal leaves in November; the money was invested for ten more months first |
| **the trigger** | `yr._useEarly = (y === 0) ? strategyImpliesConversion : (prevConv > 1000)`. Last year's conversion decides this year's withdrawal month |
| **AUTO** | the shipped arm: the trigger decides, year by year |
| **EARLY / LATE** | `forceWithdrawTiming` pinned for every year. EARLY and LATE are policies; AUTO is a rule that picks between them |
| **fires** | a cell where AUTO produced at least one Early year. Where it does not, AUTO *is* LATE and the cell carries no information about the trigger |
| **NW** | terminal after-tax net worth, deflated to current dollars by the final row's own `inflationFactor` |

Three arms, one axis. Every other input is identical within a cell.

## Why it was re-measured rather than looked up

`P28ja` asked this in August and found Late beating Early in 35 of 39 live cells, with the flip never
once paying. Those numbers no longer describe the engine. `P28jg` (v11.1734) fixed a converted dollar
earning **no growth at all in its conversion year** - surplus routed to Cash or Brokerage was credited
before the growth call and surplus routed to Roth was credited after it, so the same surplus grew or
did not purely by destination.

That fix matters here for a reason beyond staleness: **it removed the trigger's own justification.**
The trigger exists so a conversion year gets money out early and the Roth compounds. Post-`P28jg` the
conversion month is growth-neutral deterministically - the IRA and the Roth carry the same rate and
`preMonths + postMonths = 12` - verified to the cent on a conversion-only fixture. If the upside is
gone, all that is left is the cost of moving the **spending** draw, which is a different leg
entirely.

Three research tables in this repo have stopped reproducing after an engine change (P28 round 2,
P30's ladder, and P28j itself), which is why this is a re-run and not a citation.

## Grid

5 mixes x 3 wealth multiples x 3 spend rates x 6 strategies x 3 arms = 810 simulations per pass,
run twice. Mixes and wealth/spend ladders are copied verbatim from `unifiedconv_harness.js`.

**The strategy axis is not decoration.** Whether the trigger fires at all is a property of the
strategy, not of the household: Fill Bracket's conversions are far above the $1,000 constant so it
flips every year, while Proportional's are typically below it so that plan never flips. A grid
without both would look decisive or flat for reasons unconnected to the trigger.

**The IRA Goal is set explicitly, and the grid is run twice because of it.** `P85` turned a
186-of-186 claim into 124 counterexamples on nothing more than `iraBaseGoal: 0` inherited from
another harness against a shipped default of $750,000. The `COMMON` block copied here carries that
same 0. So the headline runs at the shipped default and the whole grid is re-run at 0.

## Predictions, registered before the run

| id | claim | result |
|---|---|---|
| **T1** | AUTO never beats LATE where the trigger fires | **BROKEN**, 1 cell of 79, and see below |
| **T2** | LATE beats EARLY in the large majority of cells | **HELD**, 79 of 79 |
| **T3** | where the trigger never fires, AUTO equals LATE to the cent (plumbing; failure voids the run) | **HELD**, 30 of 30 |
| **T4** | the AUTO-minus-LATE gap grows with the number of Early years | **HELD** directionally |

## Result

Headline pass, IRA Goal at the shipped $750,000. 270 cells: 107 failed in at least one arm, 32
excluded because delivered spend moved, 30 inert, **101 scorable** (79 non-GK, 22 Guyton-Klinger).

| measure | non-GK, trigger fires |
|---|---|
| AUTO beats LATE | **1 of 79** |
| AUTO - LATE, median | **-$115,103**, -2.963% of NW |
| AUTO - LATE, worst | -$2,148,117 |
| AUTO - LATE, best | +$4,662 |
| LATE beats EARLY | **79 of 79** |
| EARLY - LATE, median | -$365,794, -7.343% of NW |

**T1's single counterexample does not carry the weight its label suggests.** `reduce11` on the
smallest household wins **+$4,662, which is 0.176% of a $2,644,957 plan**, against a median cost of
about 3% of net worth and a worst case of $2.1M. The robustness pass produces exactly one win as
well, also `reduce11`, at +$12,000 = 0.208% of a $5,780,413 plan. One cell in eighty, worth a fifth
of a percent, is not a rule paying for itself.

### T4: the cost tracks how often the rule fires

| Early years | n | median AUTO - LATE |
|---|---|---|
| 1 | 9 | -0.633% of NW |
| 5 | 4 | -2.214% |
| 8 | 3 | -4.095% |
| 11 | 9 | -3.846% |
| 18 | 3 | -6.968% |
| 32 (every year) | 15 | -4.352% |

Directional and noisy. The extreme percentages in the tail (one cell at -56.591%) are small
denominators on near-failing plans, not large dollar moves; the dollar medians are the safer figure.

## Three checks that could have rescued the trigger, and did not

**Survival.** Cells where the arms disagree about whether the plan works at all are the strongest
evidence the grid can carry, so they are counted rather than dropped.

| | headline | robustness |
|---|---|---|
| AUTO fails where LATE survives | 1 | 2 |
| EARLY fails where LATE survives | **17** | **16** |
| LATE fails where another arm survives | 1 | 1 |

Late is not universally safer - `ordered/brokheavy/x0.5/8%` fails Late and survives otherwise - but
the asymmetry is 17 to 1.

**Spend.** 32 cells were excluded from wealth scoring because delivered spend moved (timing does move
it - `P28jd`). Of those, AUTO is worse on **both** spend and wealth in 4 and better on both in **0**.
The remaining 28 are labelled "trades" by the scorer and mostly are not: they read
`+$1,985 spend / -$175,225 wealth` and `+$1 spend / -$59,000 wealth`. Rounding-level spend against
six-figure wealth is not a trade anyone would take.

**Guyton-Klinger.** GK is the one place AUTO appears to win, 7 of 22 on wealth. **All 7 delivered
less spend than LATE**, median -$58,086. Those are the guardrails cutting spending, not the timing
helping - which is exactly why a spend-adaptive family carries delivered spend as a reported column
instead of being ranked on wealth alone.

## Robustness across the IRA Goal

The verdict is identical at $750,000 and at $0: 1 of 74, median -$137,657 (-3.120% of NW), LATE
beating EARLY 74 of 74. The `P85` hazard did not bite here, which is worth stating precisely because
it could have.

## T5: the trigger on its own terms

**Added after the first version of this report recommended removal on wealth evidence alone.** The
trigger is a CONVERSION-motivated rule and the first pass never scored a conversion outcome - the
same species of error this repo keeps cataloguing, scoring the nearest convenient statistic. Ending
Roth and lifetime conversion gross, both added, both deflated:

| comparison | median | direction |
|---|---|---|
| AUTO - LATE, ending Roth | -$17,334 | AUTO higher in **32 of 79** |
| AUTO - LATE, lifetime conversion gross | -$6,294 | AUTO higher in 22 of 79 |
| EARLY - LATE, ending Roth | -$98,002 | EARLY higher in 23 of 79 |

**So it is not a pure cost. In 31 of 79 cells AUTO buys MORE Roth at LESS net worth** - a genuine
trade in the `P106` sense, and one that wealth-only scoring erased completely.

Priced on `P106`'s own yardstick, Roth gained per dollar of net worth given up:

| | |
|---|---|
| median exchange rate | **0.24 : 1** |
| best / worst | 2.05 : 1 / 0.00 : 1 |
| at or above 1:1 (`P106`'s bad-trade line) | **3 of 31** |
| dominated - worse on BOTH Roth and net worth | **47 of 79** |

`P106` measured the user's own conversion decision at **50.08 : 1** and called the single sub-1:1 arm
it found a bad trade. So the trigger buys Roth at about a fiftieth of that rate, in fewer than half
its cells, and simply destroys both quantities in 47 of 79.

## What this supports, and what it does NOT

**Supported: AUTO is dominated by a pinned LATE on the engine as it exists today**, on net worth
decisively and on Roth in most cells.

**NOT supported, and this is the limitation that matters most:**

- **This could not test the idea behind the trigger, because the engine could not express it - and
  that has since been fixed.** When this grid ran there was one flag, `_useEarly`, and one
  `preMonths` for the whole year, so "early conversion with a LATE spending withdrawal" was not a
  state the engine had and every cell above bundles the two.
  **`P28jk` (v11.1766) made the conversion month independent. Its first measurement showed the
  unbundled cell dominant - and that result was VOID and is retracted.** The build was missing the
  rule that **an RMD is first money out**: in a year an RMD is due, the first dollars distributed
  satisfy it and an RMD may not be converted, so a conversion cannot precede it. With that floor
  added the same comparison returns **$0.00** on the page defaults. The apparent +$7,436 was
  entirely conversions jumping ahead of the RMD.
  **So this table still cannot be read as evidence against early conversion - but there is no
  evidence for it yet either.** The legal room is confined to pre-RMD years, and this household
  converts nothing in its three.
  What the table does still show is that the AUTOMATIC rule - keying the SPENDING month off last
  year's conversion - is a poor way to pursue that intent.
- **An earlier draft of this section claimed the unbundled version is "provably worth $0
  deterministically". That was wrong** (user, 2026-09-06) and the error is worth keeping because it
  is a species: a one-year BALANCE IDENTITY was promoted to a plan-level neutrality.

  What is exactly true, with `a = 1 + g/12`, `b = 1 + 11g/12` and conversion `X` (`applyGrowth` is
  simple proportional, `optimizer_core.js:701`):

  | | combined IRA+Roth at year end | Roth alone |
  |---|---|---|
  | Early | `(B·a − X)·b + X·b = B·a·b` | `X·b` |
  | Late | `(B·b − X)·a + X·a = B·b·a` | `X·a` |

  The combined balance is identical and `X` cancels. **The SPLIT does not**: Early leaves the Roth
  larger by `X·(10g/12)` and the IRA smaller by the same. **The December 31 IRA balance is the next
  year's RMD basis** (`P84l`), so the plan diverges from the following year onward through forced
  income and tax - **deterministically, at perfectly flat growth**. Growth escalation amplifies that
  channel through bracket and IRMAA nonlinearity; it does not create it.
- **The scaling result, and it is the useful part.** Per conversion year the unbundled conversion
  benefit is about `τ · X · 10g/12` - the IRA-to-Roth shift is free pre-tax, so its worth is the tax
  never paid, plus the RMD knock-on - while the spending leg costs `W · 10g/12` in full pre-tax
  dollars. The sign is therefore decided by roughly **`τ·X` against `W`**. Large conversions with
  modest spending favor Early; small conversions with large spending lose. **This grid sampled mostly
  the second regime and never controlled the ratio**, which explains its result without the trigger
  being worthless.
- **Three axes held flat here that the mechanism says are load-bearing:** future tax escalation
  (`taxRateCreep` / `taxRateCreepState`, unset in `COMMON`, and creep raises `τ` directly), variable
  growth, and how OFTEN the plan converts - the benefit accrues per conversion year, and the number
  of those is itself a plan decision the tool influences through the stop year and Maximize
  Conversions. `T4` measured cost against firing count and never benefit against conversion count.
- **Per-account return divergence remains a separate channel**, where the Roth and IRA draw different
  rates in the same year. `P28ji` priced it: exactly $0 under GBM, bootstrap median +$5,364 (0.057%
  of NW), p10 -$157,608, p90 +$399,582. A coin flip, and a first-order estimate that omits the
  feedback T5 shows is worth six figures.
- *A threshold value.* `P28je` sweeps `timingConvThreshold` and this grid does not.
- *That removing it is free.* It changes shipped behavior for every converting plan, so it moves
  goldens and belongs in the changelog.

**Conclusion, corrected: this report does not support removing the trigger.** It supports pinning
LATE as the better of the two settings the engine can currently express, and it identifies the
single flag serving two legs as the actual defect - a coupling nobody chose, which forecloses the
question rather than answering it. Making the conversion month and the spending-withdrawal month
independently settable turns an unanswerable question into a measurable one; that is the next step,
not deletion.

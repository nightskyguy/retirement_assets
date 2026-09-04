# When to stop converting, and whether the tool's answer can be trusted  *(P106a)*

The Optimizer suggests a **Stop Conversion year**: the last year it will run Roth conversions, chosen
to maximize terminal wealth. This report starts from an observation that the suggestion "changes the
answer" and "seems unstable".

This report measures that. It matters beyond the suggestion itself, because `P106` is a study of
whether converting pays, and a study that rests on "the optimal stop year" needs to know first
whether that year means anything.

**Verdict: the search is not broken, the optimum is not flat, and the suggestion still should not be
used as a single number.** The peak is sharp for any one set of inputs and it MOVES by up to three
years when an input a planner would call immaterial changes by 1% or less. Across the years those
moves actually reach, lifetime conversions range over 4.5x and ending Roth over $3.7M.

---

## Reading guide

Everything below uses these. None of it requires knowing what `P106` is.

### The two things that could have been wrong

| | |
|---|---|
| **flat optimum** | Many stop years score about the same. The reported year jumps around, but any of them is nearly as good, so the jumping is cosmetic. |
| **moving peak** | One stop year is clearly best for a given set of inputs, but WHICH year that is changes sharply when the inputs barely change. The jumping is real and costly. |

They are distinguished by measuring the score of the neighbors, not by watching the answer move.

### Cutoffs

A **cutoff** truncates the conversion schedule. `cut = k` means conversions run for the first `k`
years and stop. `cut = 0` is "convert nothing"; `cut = n` is "never stop", the plan as configured.
The **stop year** is the last calendar year conversions were still allowed, so `cut = 7` on a plan
starting in 2026 is a stop year of 2032. The production search
(`bestConversionStopYear`, `optimizer_core.js`) scans every cutoff linearly and takes the argmax.

### Valuation bases

Every cutoff is scored by `afterTaxWealthOfLogRow`, and it has two branches:

| basis | what it does |
|---|---|
| **NOT SET** | No Marginal Heirs Tax Rate entered. Returns the row's own `totalNetWealth`, which discounts the IRA at **`sim.nominalTaxRate`, that run's OWN final-year ordinary marginal rate**. |
| **a shared rate** (12%, 24%, ...) | Discounts every cutoff's IRA at the same rate, supplied as an input. |

The distinction carries a finding of its own; see [The default basis compares plans at different
discount rates](#the-default-basis-compares-plans-at-different-discount-rates). **NOT SET is the
default and is what the canonical scenario uses.**

### Predictions

`A1`-`A8`, registered in the harness header and committed unrun in `cf2eb15` before the first
execution, scored as written in [Predictions](#predictions-scored-as-written). They are named in the
text only where the result is theirs.

---

## The scenario

One hypothetical household, used as the reference scenario throughout. CA, married, both born
before 1961, $3.44M across two IRAs, $274k Roth, $600k brokerage on $200k basis, $100k cash, $220k spending declining 1%/yr real, Fixed
strategy, cyclic gain harvesting on, conversion taxes funded from cash, **no Marginal Heirs Tax Rate
set**, and a Stop Conversion year of 2032 already applied.

Inputs are `.test_harnesses/fixtures/p106_canonical.json`, captured as the verbatim output of the
page's own `getInputs()` rather than re-decoded in node. The live page at v11.171f suggests **2032**
with `gainVsFull $375,544` and `gainVsNone $308,733`; the harness reproduces all three exactly.

Harness: `.test_harnesses/stopyear_stability_harness.js`. Plan runs 2026-2050, 26 cutoffs.

---

## The search itself is sound

Three things it was reasonable to suspect, all cleared:

- **It is idempotent** (`A3`). Applying the winning year and re-searching returns that same year, as
  does searching from a deliberately different stop year. The strip-first logic in
  `bestConversionStopYear` works and `syncAutoStopYear`'s convergence assumption holds. This is not a
  feedback loop between the applied year and the next suggestion.
- **The linear scan is necessary** (`A4`). The curve has 2 local maxima in the default basis, so a
  binary or ternary search would converge on the wrong one undetectably. The function header already
  claimed this; it had never been shown on a real scenario.
- **It is deterministic.** Same inputs, same answer, every time.

The instability is in the objective, not in the code that searches it.

---

## The curve, default basis

Conversions on this plan exhaust themselves after 2036; every cutoff from 2036 on is the identical
plan, which is why the tail is flat. The live search space is 2026-2036.

| cut | stop year | score | gap vs best | conversions | ending Roth |
|---:|---:|---:|---:|---:|---:|
| 0 | convert nothing | $9,011,152 | -$308,733 | $0 | $1,906,744 |
| 2 | 2027 | $9,199,110 | -$120,775 | $218,800 | $3,210,468 |
| 3 | 2028 | $9,214,721 | -$105,164 | $429,221 | $4,370,651 |
| 4 | **2029** | **$9,312,936** | **-$6,949** | $598,223 | $5,232,886 |
| 5 | 2030 | $9,267,066 | -$52,819 | $751,194 | $5,955,060 |
| 7 | **2032** | **$9,319,885** | **best** | $986,721 | $6,907,134 |
| 8 | 2033 | $9,166,700 | -$153,185 | $1,183,129 | $7,422,382 |
| 11+ | 2036 and later | $8,944,341 | -$375,544 | $1,566,237 | $7,734,709 |

Two peaks, 2029 and 2032, **$6,949 apart, which is 0.075% of net worth**. That is the whole margin
by which the tool prefers 2032.

## It is a moving peak, not a flat optimum

Both halves of this were measured, and the second one is what settles it.

**Small input changes move the answer** (`A2`). Eleven perturbations, none larger than 1%:

| perturbation | default basis | at 24% | at 32% |
|---|---:|---:|---:|
| baseline | 2032 | 2029 | 2029 |
| spendGoal -0.5% | **2029** | 2029 | 2029 |
| spendGoal +0.5% | 2032 | **2027** | **2030** |
| growth +0.10pp | 2032 | **2027** | **2030** |
| growth +0.25pp | 2032 | **2030** | **2030** |
| inflation +0.10pp | 2032 | **2027** | **2030** |
| IRA1 -1% | **2029** | 2029 | 2029 |
| IRA1 +1% | 2032 | **2027** | **2030** |
| Brokerage +1% | 2032 | **2027** | **2030** |

A $1,000 change to a $220,000 spending goal moves the suggested year by three. So does a 1% change
to the IRA balance, in the other direction.

**But the neighbors are not tied.** Measuring the 0.1% band in each basis:

| basis | local maxima | cutoffs within 0.1% of best | year span |
|---|---:|---:|---:|
| NOT SET | 2 | 2 | 3 years |
| 12% | 2 | 1 | 0 |
| 22% | 2 | 1 | 0 |
| 24% | 2 | 1 | 0 |
| 32% | 1 | 1 | 0 |
| 37% | 1 | 1 | 0 |

Under any shared heirs rate the peak is **sharp** - exactly one cutoff within 0.1% - and it still
relocates across 2027, 2029 and 2030 under the perturbations above. Sharp and mobile is the worst of
both: the tool is entitled to report one confident year, and that year is not reproducible.

Counting it directly: perturbations that moved the default answer, **3 of 11**; perturbations that
moved a shared-rate answer, **7 of 11**.

## What being on the wrong year costs

The perturbations reach four stop years. Anyone who nudges any of those inputs can be handed any of
them. Scored within each basis:

| basis | 2027 | 2029 | 2030 | 2032 | spread | worst as % of NW |
|---|---:|---:|---:|---:|---:|---:|
| NOT SET | $9,199,110 | $9,312,936 | $9,267,066 | $9,319,885 | $120,775 | 1.30% |
| 12% | $10,212,279 | $10,154,032 | $10,035,157 | $9,740,221 | $472,058 | 4.62% |
| 22% | $9,739,180 | $9,775,326 | $9,696,273 | $9,457,932 | $317,393 | 3.25% |
| 24% | $9,644,560 | $9,699,585 | $9,628,497 | $9,401,475 | $298,110 | 3.07% |
| 32% | $9,266,080 | $9,396,620 | $9,357,390 | $9,175,644 | $220,976 | 2.35% |
| 37% | $9,029,531 | $9,207,267 | $9,187,948 | $9,034,500 | $177,736 | 1.93% |

**1.3% to 4.6% of net worth.** And in plan terms the four years are not near neighbors at all:

| stop year | conversions | ending Roth | ending IRA | ending Brokerage |
|---:|---:|---:|---:|---:|
| 2027 | $218,800 | $3,210,468 | $4,730,991 | $2,786,945 |
| 2029 | $598,223 | $5,232,886 | $3,787,059 | $1,588,534 |
| 2030 | $751,194 | $5,955,060 | $3,388,836 | $1,097,921 |
| 2032 | $986,721 | $6,907,134 | $2,822,885 | $348,948 |

**4.5x in lifetime conversions and $3.7M in ending Roth**, across answers separated by a 1% input
change. Whatever else is true, these are not four ways of saying the same thing.

`A6` predicted it would be cheap to be wrong, and `A6` HELD - but only on the question it asked,
which was the worst cutoff inside the 0.1% band in the default basis, $6,949. That band contains two
years. The table above is the same question asked over the years perturbation actually reaches, and
the answer there is 17x to 68x larger. `A6` is left scored as written; it should not be read as
having established that the instability is cheap.

## The default basis compares plans at different discount rates

Found while explaining the 2029/2032 pair, and it stands on its own as a correctness issue.

`totalNetWealth` (`evaluateYearOutcome`, `optimizer_core.js:3801`) is already an after-tax figure: the
IRA is discounted at `sim.nominalTaxRate`, **the run's own final-year ordinary marginal rate**. Every
cutoff ends in a different tax situation, so every cutoff is scored with a different discount rate.

| | 2029 | 2032 | difference |
|---|---:|---:|---:|
| ending IRA | $3,787,059 | $2,822,885 | -$964,174 |
| ending Roth | $5,232,886 | $6,907,134 | +$1,674,248 |
| ending Brokerage | $1,588,534 | $348,948 | -$1,239,586 |
| gross wealth | $10,608,479 | $10,078,967 | -$529,512 |
| **IRA discount rate applied** | **34.21%** | **26.89%** | **-7.32pp** |
| score the search sees | $9,312,936 | $9,319,885 | +$6,949 |

7.32pp on $3.79M of IRA is **$277,192 of pure valuation difference**, decided by which bracket the
final year happens to land in, against a margin of $6,949. 2029 holds more gross wealth and 2032
holds more Roth, so this is a real trade; the default basis resolves it with a number that is an
artifact of the plan being scored. Head to head, **NOT SET is the only basis that picks 2032** - every
shared rate from 12% to 37% picks 2029, by 25x to 60x the margin the default decides on.

**This is a defect worth fixing on its own** and it is separate from the instability. It was not the
cause: see below.

## One mechanism proposed and refuted

Worth recording, because the refutation was a measurement and not a second opinion.

Having found the inconsistent discount rate, the obvious conclusion was that it caused the
instability, and the report nearly said so. The test is direct: if the per-run rate is the cause,
re-running the same perturbations under a shared rate should calm the answer down.

It does the opposite. **3 of 11 perturbations move the default answer; 7 of 11 move a shared-rate
answer.** A shared rate is more sensitive, not less. The inconsistent discount rate is real, it
explains which of the two peaks the default prefers, and it is not why the answer wanders.

What remains is the plainest reading: the terminal-wealth objective genuinely has a sharp optimum
whose position is highly sensitive to inputs, in every basis. Nothing measured here explains why the
position is that sensitive, and that is the open question this report ends on.

## What P106g changed, and what it did not  *(added 2026-09-04, v11.1733)*

**Everything above is the pre-P106g engine and stands as the record.** The defect the section before
this one identifies has since been fixed: the terminal IRA is no longer discounted at the final
year's own marginal rate but at a trailing average over the years sharing the terminal filing status.
Re-running the same harness on the new engine scores the same predictions against different code,
which is a re-baseline rather than a re-aiming. Both sets are below.

**The bistability that this whole report is about is gone.**

| | pre-P106g | post-P106g |
|---|---|---|
| local maxima in the curve | **2** (2029 and 2032, $6,949 apart) | **1** (2029) |
| cutoffs within 0.1% of best | 2, spanning 3 years | 1, spanning 0 |
| default basis picks | 2032 | **2029** |
| 24% and 32% shared rates pick | 2029 | 2029 |
| largest move on a +/-1% spend-goal change | **3 years** | **1 year** |
| cost spread across the reachable years | 1.296% of NW | 1.230% of NW |

The default and the explicit heirs rates now **agree**. Before, `NOT SET` was the only basis that
picked 2032; every shared rate from 12% to 37% picked 2029, and the disagreement came entirely from
one year's marginal rate being an outlier. Averaging over the two widow years moves that plan's rate
from 26.89% to 30.94% and the ranking follows.

**What did not improve, stated plainly: the answer still moves.** Under perturbation the default now
changes in 8 of 11 cases where it changed in 3 of 11 before. Counting moves alone reads that as a
regression and it is not, because the moves became much smaller: pre-P106g the default swung between
2029 and 2032, post-P106g almost every move is 2029 to 2030, an adjacent year. `A2` breaking is the
cleanest single statement of it - the largest spend-goal-driven move fell from 3 years to 1.

The count rose because the default now behaves like a shared rate, and `P106a` had already measured
shared rates as the more perturbation-sensitive of the two (7 of 11 against 3 of 11). That was
predicted in advance and it is the price of the correction: the old default's steadiness came from
being anchored to a noisy number that happened to keep choosing the same year, which is not a
property worth keeping.

**Section 9's comparison is no longer controlled** and the harness now says so instead of printing a
verdict. It contrasted a per-run rate against a shared one; since P106g the default is itself a
smoothed rate, so the two columns are no longer a treatment and a control.

Re-scored on the new engine, for the record and clearly separate from the original scoring below:
`A1` BROKEN (1 cutoff within 0.1%, now because the peak is sharp rather than because there are two),
`A2` BROKEN (1 year, was 3), `A3` HELD, `A4` **BROKEN and this is the win** (the curve is unimodal,
so the multi-modality that forced a linear scan is not present on this scenario any more - the scan
stays, because one scenario is not a proof), `A5` HELD, `A6` HELD, `A7` BROKEN (the two bases agree
exactly now, 0 years apart, where the prediction expected 3), `A8` HELD.

## Predictions, scored as written

| id | claim | verdict | evidence |
|---|---|---|---|
| `A1` | flat top: >=3 cutoffs within 0.1% | **BROKEN** | 2 cutoffs within 0.1% |
| `A2` | argmax moves >=2y on +/-1% spendGoal | HELD | moved 3 years |
| `A3` | idempotent (failure would be a defect) | HELD | same answer from every starting stop year |
| `A4` | not unimodal: >=2 local maxima | HELD | 2 local maxima |
| `A5` | modes `all` and `extra` disagree | HELD (vacuous) | 2032 vs none, but `extraConversionAmount` is 0 on this scenario so mode `extra` has nothing of its own to truncate. Scored HELD; carries no information. |
| `A6` | cheap to be wrong: <0.5% NW in the 0.1% band | HELD | 0.075%, and see the caveat above |
| `A7` | heirs rate moves the answer >=3y | HELD | not set 2032 vs 24% 2029 |
| `A8` | no heirs rate -> argmax in first third | HELD | cut 7 of 25 |

`A1` broken and `A6` held is the pair that misdirects if read alone: together they say "not flat, and
cheap anyway", which is wrong. `A1` was right for the wrong reason - the top is not flat because the
peak is sharp, not because the optimum is well determined.

## What this means for the rest of P106

1. **No headline claim may rest on "the optimal stop year".** The stop year is a controlled variable:
   hold it fixed across arms and say what it was fixed at, or report a band and the cost of the band.
   Comparing an arm at its own optimal stop year against another arm at its own is comparing two
   argmaxes that a 1% input change would relocate.
2. **Set a heirs rate for any ranking**, per groundrule 2. The default basis is not a neutral choice;
   it is the one basis that scores different candidates at different discount rates.
3. **The sensitivity itself is unexplained** and is the first candidate for follow-up work.

## Related

- `P24` established that the Break Even diagnostic's boundary year is NOT the optimal stop year,
  $662k and 12 years apart in the scenario recorded there. That is a different failure from this one
  and both are live.
- `CONVERSION_TIMING.md` covers the intra-year timing rule, which is on the wrong side about nine
  times in ten and can move any converting row.

# The bracket ceiling's income basis (P87a)

The strategy **Limit** dropdown lets a plan say "fill the 22% bracket". The engine turns that into a
ceiling and stops drawing when income reaches it. This report answers two questions about that
ceiling: is the number on the right basis, and what does being on the wrong one cost?

Harness:
[`.test_harnesses/bracketbasis_harness.js`](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/bracketbasis_harness.js)

```sh
node .test_harnesses/bracketbasis_harness.js
```

## Reading guide

Everything below uses these; none of them appear in the tool's own vocabulary.

### The two arms

| arm | what it is |
|---|---|
| **CONTROL** | the shipped engine, unchanged |
| **ARMED** | `bracketCeilingAddDeduction` on: the federal-mode ceiling is raised by the year's deduction, so the plan fills the bracket in taxable-income terms instead of MAGI terms. A research-only input, default off, reachable from no UI |

### How a year is classified

Off the control arm's log, per year, comparing the year's MAGI against the ceiling it was aiming at:

| code | meaning |
|---|---|
| **AT** | MAGI landed on the ceiling, within $2. The ceiling is what stopped the draw, so this is the only kind of year that can be leaving money behind |
| **SLACK** | MAGI came in under the ceiling. Something else stopped the draw first: the spending goal was met, the IRA Goal throttled it, or the IRA was empty |
| **OVER** | MAGI went past the ceiling. The third-pass fallback forced a draw above it to fund mandatory spending |

### How a cell is judged

| code | meaning |
|---|---|
| **CLEAN** | both arms funded the plan and delivered identical spending. Only in a clean cell is a wealth difference a comparison rather than a spending change wearing one |
| **dNW** | armed minus control, terminal after-tax net worth, both scored at the **control** arm's `futureIRARate` |
| **hidden room** | sum of the year's deduction over that cell's AT years. An upper bound on what the ceiling could have released |
| **ceil yrs** | years in which the arm actually moved the ceiling. A family with 0 here cannot be touched by a federal basis fix, whatever its dropdown label says |

### The predictions

`B1`-`B5`, registered before the run and scored in the harness output. Stated where they are scored,
in "What was predicted, and what it was worth" below.

### The grid

5 account mixes x 2 IRA-Goal settings (off, $750,000) x 2 states (CA, TX) x 6 strategy families x 2
spend rates (4%, 6%) = **240 cells, 480 simulations**, about two seconds. The mixes, the ages and
the economic assumptions are copied verbatim from `rmdbasis_harness.js`.

The six families are three federal-bracket rows (Fill Bracket 12 / 22 / 24%), Min Limit 24%, and two
controls whose ceilings do not come from the federal bracket table at all: IRMAA Tier 1 and ACA 400%
FPL.

---

## 1. The defect is real, and it is exactly one deduction

Three kinds of ceiling leave the dropdown; `computeBracketCeiling` returns all three as one number,
and every caller spends that number as a MAGI ceiling.

| dropdown entry | table it reads | that table's real basis | verdict |
|---|---|---|---|
| `IRMAA Tier n` | `TAXData.IRMAA` | MAGI = AGI + tax-exempt interest | correct |
| `n% Fed` | `TAXData.FEDERAL` | **taxable income**, i.e. after the deduction | **wrong by one deduction** |
| `n% FPL` | an FPL multiple | ACA MAGI, which adds back non-taxable Social Security | ceiling right |

Year 0 of a Fill Bracket 22% plan, straight off the log:

| | |
|---|---|
| ceiling the plan aimed at | $211,400 |
| MAGI it landed on | $211,400 |
| federal **taxable** income it landed on | $179,200 |
| the year's deduction | $32,200 |

$211,400 - $179,200 = $32,200, to the dollar. The plan asked to fill the 22% bracket and filled it
to $179,200 of a $211,400 bracket - inside the 22% band, but one deduction short of its top.

The gap is the whole federal deduction, so it grows with indexation, the age-65 bumps and the OBBBA
senior deduction: **$32,200 in 2026 to $70,876 by 2054** on this plan, still MFJ. It then falls to
$37,142 in 2055, and that fall is a **filing-status change** - spouse 1 dies and the plan becomes
Single, halving the bracket table and the deduction together - not a narrowing of the defect.

**Year 0 is exactly clean for a reason worth naming.** Social Security has not started yet, so
`yr.fixedInc` is zero and the sizing aggregate and MAGI agree on every term. Once benefits begin,
the aggregate uses the FULL benefit while MAGI uses the taxable portion, at most 85% - a second gap,
pointing the other way, and the subject of `P87c` rather than of this measurement.

This happens every year a bracket strategy runs, always in the same direction, and no cliff is
crossed, which is why it never announced itself.

### Which of the three things it could have been

The number on each side of the comparison is correct. The comparison is not.

| candidate | verdict |
|---|---|
| the wrong ceiling is picked | **No.** `findLimitByRate('FEDERAL','MFJ',0.22)` returns `211400` off a 2026 table reading `24800 / 100800 / 211400 / 403550 / 512450 / 768700`. Right bracket, right edge, correctly indexed by `cpiRate` |
| the deduction is wrong, e.g. OBBBA missed | **No.** 2027's $36,695 is std $32,200 x 1.025 = $33,005, plus one age-65 bump $1,691, plus a senior deduction of $6,000 - ($216,685 - $150,000) x 0.06 = $1,999. The OBBBA senior deduction is applied with its phase-out and correctly drops to $0 in 2029 at the `sunsetYear: 2028` boundary |
| something else | **Yes: a units mismatch at the comparison.** `iRAbracketRoom` subtracts GROSS income components from a POST-deduction threshold, and `bracketOverage` measures MAGI against that same threshold. A pre-deduction quantity is capped at a post-deduction number, and nothing between the lookup and the comparison converts one to the other |

The function's own header states the intent - "MAGI ceiling for bracket/minlimit/aca strategies"
(`optimizer_core.js:854`) - and the intent is coherent. The label and the number come out of the
same lookup, but only the number reaches the engine, and it is then used on a basis the label does
not describe. That is why `P87f` and not `P87b` is what survived this report.

## 2. Where the ceiling actually binds

The defect can only cost something in an **AT** year. Control arm, all 240 cells:

| family | cells | AT yrs | SLACK | OVER | hidden room |
|---|---|---|---|---|---|
| Fill Bracket 12% | 40 | 56 | 94 | 1,170 | $2,050,199 |
| Fill Bracket 22% | 40 | 118 | 452 | 750 | $4,262,641 |
| Fill Bracket 24% | 40 | 128 | 1,181 | 11 | $4,518,035 |
| Min Limit 24% | 40 | 162 | 650 | 508 | $5,915,502 |
| IRMAA Tier 1 | 40 | 129 | 862 | 329 | $4,534,965 |
| ACA 400% FPL | 40 | 32 | 0 | 88 | $1,135,825 |

**AT years are the minority everywhere.** A Fill Bracket 12% plan spends most of its life OVER its
ceiling, because a 12% ceiling cannot fund the spending and the third pass forces the draw anyway. A
24% plan spends most of its life SLACK, because the ceiling is above anything the plan needed.

$22.4M of hidden room across the grid is the **upper bound**, and section 3 is why that number should
not be quoted on its own.

## 3. Correcting the basis is not free money

The headline, and it was not the expected one. Read it as a statement about the STRATEGY, not as a
verdict on the fix - section 7 explains why those are different questions and why an earlier version
of this report got that wrong.

| family | cells | clean | ceil yrs | moved | median dNW | best dNW | worst dNW | median dTax |
|---|---|---|---|---|---|---|---|---|
| Fill Bracket 12% | 40 | 18 | 1,320 | 40 | **$159,278** | $1,201,973 | -$130,082 | -$53,590 |
| Fill Bracket 22% | 40 | 25 | 1,320 | 40 | **-$173,437** | $35,039 | -$2,523,647 | $2,057 |
| Fill Bracket 24% | 40 | 31 | 1,320 | 36 | **-$14,583** | $198,266 | -$517,206 | -$110 |
| Min Limit 24% | 40 | 36 | 64 | **0** | $0 | $0 | $0 | $0 |
| IRMAA Tier 1 | 40 | 38 | 0 | **0** | $0 | $0 | $0 | $0 |
| ACA 400% FPL | 40 | 38 | 0 | **0** | $0 | $0 | $0 | $0 |

Over the 74 clean federal-bracket cells: terminal after-tax net worth **rises in 19 and falls in 51**,
median **-$47,092**, best +$1,201,973, worst -$2,523,647.

**The sign depends on the bracket.** 12% gains; 22% and 24% lose. Filling a cheap bracket further is
worth doing, and filling an expensive one further is not.

### Where the sign comes from

Clean federal-bracket cells split by which way they went. All figures are medians of the control arm
except the two delta columns.

| cells | n | AT yrs | SLACK | OVER | ctrl lifetime tax | median dTax | median dConv |
|---|---|---|---|---|---|---|---|
| gained | 19 | 1 | 8 | **20** | $893,087 | **-$53,590** | $13,952 |
| lost | 51 | 3 | 28 | **0** | $894,274 | $314 | $0 |
| unchanged | 4 | 0 | 31.5 | 1.5 | $1,364,805 | $0 | $0 |

The separation is on OVER years and nothing else. Lifetime tax before the change is the same in both
groups, to within $1,200 of $894,000.

- **A cell that gains was already breaching its ceiling every year.** The third pass was forcing the
  draw regardless, so the ceiling was not governing the plan. Raising it lets the same money leave
  the IRA as an ordinary draw instead of a forced one, and lifetime tax falls $53,590.
- **A cell that loses had no OVER years at all.** There the ceiling genuinely governed, and lifting
  it makes the plan draw more than it needed to, earlier, for a lifetime tax bill that barely moves
  ($314). The money leaves the IRA and stops compounding.

So the shipped under-fill is **accidentally conservative**, and in three quarters of the clean cells
the accident is worth more than the correction would be.

## 4. Min Limit never sees the federal number at all

The largest surprise after the sign. `minlimit` was expected to move, since that branch reads the
federal bracket top before mining it against the IRMAA ceiling. **It moves in 0 of 40 cells.**

Its ceiling is `yr.IRMAALimit`, which is built from `goalLimit` - the bracket top containing the
**spending goal**, not the one the user picked. Measured on one cell: Fill Bracket 24% aims at
$403,550 in year 0 where Min Limit 24% aims at $211,399. The min never selects the federal side.

The arm did lift Min Limit's ceiling in 64 of 1,320 years, and not one of those years changed a
result. So the zero test in this report covers **four** families, not the two it was written for.

**Consequence beyond P87.** The "24%" in `Min Limit 24%` is close to decorative in this grid. That
belongs to whatever phase owns the minlimit strategy, not to P87, but it should not be lost.

## 5. What was predicted, and what it was worth

| id | prediction | verdict |
|---|---|---|
| **B1** | in a year sitting on the ceiling, the armed arm's MAGI is higher by that year's deduction | **HOLDS.** Higher in 98 of 98 cells, above the deduction in 0. Exactly the deduction in 86; the other 12 ran out of IRA first |
| **B2** | the gain is largest where the spend rate is low | **BROKEN.** -$46,534 at 4% against -$47,432 at 6%. Both negative, so there is no pooled gain for the spend rate to order. The split is by bracket, not by spend rate |
| **B3** | lifetime tax rises and terminal after-tax net worth rises with it | **BROKEN, and this is the finding.** Net worth up in 19 clean cells, down in 51. Median lifetime tax barely moves (-$3,198) |
| **B4a** | zero test: IRMAA Tier and ACA rows bit-identical across the arms | **HOLDS.** 80 of 80 |
| **B4b** | `minlimit` rows do move, since that branch reads the federal limit first | **BROKEN.** 0 of 40. See section 4 |
| **B5** | a live IRA Goal damps the effect, because `curIRA` throttles the draw first | **HOLDS.** Median absolute dNW $123,147 with the Goal against $159,999 without |

### B1 was first written wrong, and the wrong form is the instructive one

It first said "armed never draws LESS than control" and scored that on **lifetime** totals. Against a
perfectly working arm it reported 70 of 120 cells reversed. Drawing more early leaves a smaller IRA
to draw from later, so a lifetime sum is not monotone in the ceiling and never could be. The claim
was about a year, so it had to be scored on a year - and on the **first** AT year specifically, the
last point at which the two arms still describe the same plan. The same mistake, on the same kind of
quantity, is recorded in [`RMD_BASIS.md`](RMD_BASIS.md) as its R2.

## 6. What the arm approximates, and which way each approximation points

Both of these push the measured effect toward zero, so the real effect of a proper fix is somewhat
larger than what is reported here - in both directions, since the sign is not uniform.

1. **The deduction used is last year's, re-indexed.** The senior deduction phases out against
   federal AGI, which is the quantity the ceiling is about to determine, so the year's own deduction
   is not knowable when the ceiling is placed. Year 0 falls back to the statutory standard deduction
   plus age bumps, with no senior deduction and no itemizing. **This circularity is the whole
   difficulty of P87b(i)** and the arm steps around it rather than solving it.
2. **Only the federal ceiling is lifted.** The state bracket top carries the same basis error and is
   left alone, so in a state whose table binds first the reading is low.

## 7. The wealth verdict answers a different question than the one P87 asks

**This section replaces an earlier conclusion that was wrong, and the error is worth naming because
it is a whole class of error.** The first version of this report read section 3 as a verdict on the
fix: net worth falls in 51 of 74 clean cells, therefore the premise is refuted, therefore do not
build `P87b`. That reasoning judges a **correctness** question with a **wealth** metric, and the two
are not the same question.

When a user picks `22% Fed` or `IRMAA Tier 2`, the contract is **fill to that limit**. What they
expect back is: fund the spending, and convert or bank everything between the spending and the
ceiling. They are not asking the tool to minimize their tax - if they were, they would not have
named a ceiling. So a ceiling that stops one deduction short has not done what it was asked,
whether or not stopping short happens to leave them richer.

The 51-of-74 result is still true and still worth disclosing. What it measures is that **filling the
22% and 24% brackets is often a worse strategy than under-filling them** - a finding about the
strategy, which the Optimizer's ranking is the right place to surface. It is not a licence for the
engine to quietly under-deliver the strategy the user selected. An accidental hedge is not a design.

### Targets and caps are not the same control

The dropdown emits both and the engine runs them through one `yr.limit`:

| entry | what the user means | what "correct" looks like |
|---|---|---|
| `n% Fed`, `IRMAA Tier n` | a **target**. Fill the headroom above spending | reaching the ceiling is success; stopping short is the defect |
| `n% FPL` (ACA) | a **cap**. Keep spending under it | staying under is success; the risk is a breach, not a shortfall |

The engine already separates the two on BREACH behavior - bracket and IRMAA are soft caps that let
the third pass force a draw above the ceiling, ACA is strict and records `acaBreach` instead. It
does not separate them on FILL behavior, and that is where the target case is being let down.

### And nothing sizes a conversion against the ceiling at all

Measured on the same 74 clean cells, this turns out to be the larger gap.

| family | n | conversions up | unchanged | down | largest conversion gain |
|---|---|---|---|---|---|
| Fill Bracket 12% | 18 | 6 | 12 | 0 | $843,827 |
| Fill Bracket 22% | 25 | 5 | 12 | 8 | $345,501 |
| Fill Bracket 24% | 31 | 15 | 5 | 11 | $113,052 |

Total voluntary draw rose in only **18 of 74** cells, and of the extra draw that did happen only
**32% became conversion**; the other 68% became IRA-sourced spending. Since delivered spend is
identical across arms by the CLEAN filter, that 68% is the IRA displacing Brokerage and Cash draws,
not new spending.

The code says why. Only two things consume the headroom, and neither is a conversion:

- `iRAbracketRoom` (`optimizer_core.js:1964`) sizes the IRA **withdrawal**, and spending is funded
  from it first.
- `extraConversionAmount` is a figure the user types. It is not derived from the ceiling.

`convertExcessToRoth` (`:2636`) describes itself as "a pure REALLOCATION" of whatever after-tax
surplus happens to remain, capped by `netWithdrawals.IRA`. `applyConversionGrossUp` (`:3016`) grosses
up that existing surplus and never reads `yr.limit`. "Maximize Conversions" in the UI is those two
flags together (`optimizer_ui.js:4705`), not "convert up to the limit".

So two models are in play and they coincide only by accident:

| | |
|---|---|
| what a user picking a limit expects | limit minus needed spending = conversion headroom |
| what the engine does | the limit sizes the IRA WITHDRAWAL; spending is funded first; the after-tax leftover becomes surplus; surplus is reallocated to Roth, capped by the IRA draw |

They agree only when the extra draw actually leaves a surplus. Measured: 32% of the time, by dollars.

### What follows for the phase

- **The basis error is confirmed and is exactly one deduction.** Section 1, unchanged.
- **`P87b` is a correctness fix, not an optimization.** The wealth cost is a consequence to disclose
  in the changelog, not a reason to decline. If it is built, the changelog should say plainly that
  bracket rows will convert and withdraw more, and that saved plans will not reproduce.
- **`P87f` stays valuable but is no longer the whole answer.** Labelling which income the ceiling is
  helps a reader; it does not deliver the headroom they asked for.
- **The conversion-sizing gap deserves its own item**, and it is larger than the deduction. Nothing
  today converts into the ceiling on purpose. A "convert the remaining headroom" behavior is a
  design decision, not a bug fix, and it interacts with the Cash Reserve, the gap-fill order and
  `fundConversionWithCash`.
- **`minlimit` is out of scope for P87 entirely** (section 4), and carries a separate question of
  its own.
- **P87c, P87d unchanged.** This measured the deduction leg only. The Social Security basis
  (`yr.fixedInc` is the full benefit where IRMAA and federal want the taxable portion) and the ACA
  overage add-back were not armed here. P87d gains weight from the target/cap split above: the ACA
  entry is the one control in the dropdown whose job is to stay UNDER, so its overage reading is
  the number that matters for it.

---

## 8. It shipped (P92a), and WHICH deduction turned out to be the hard part

The fix landed in v11.16aa. Section 3's cost held on the shipped implementation, measured the same
way against the release before it: 71 clean cells, terminal after-tax net worth up in 18 and down in
49, median **-$47,549** (this report's arm said -$47,092), best +$1,517,175, worst -$2,589,357, and
the same split by bracket - 12% gains a median $157,572, 22% loses $200,350, 24% is near flat at
-$12,741. Median conversion change: **$0**, which is section 7's last finding surviving intact.

The open question this report left was section 6's first approximation: the arm used LAST year's
charged deduction, re-indexed, because the senior deduction phases out against the AGI the ceiling is
about to determine. That circularity does not go away, so the shipped question was not "use the right
deduction" but "how wrong is each obtainable one".

Harness:
[`.test_harnesses/ceilded_harness.js`](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/ceilded_harness.js).
3,960 plan-years on this report's grid, every candidate scored against `-fedDeduction`, the deduction
`calculateTaxes()` actually charged that year.

| candidate | what it is | median err | p90 | worst |
|---|---|---:|---:|---:|
| **PRIOR** | last year's charged deduction, re-indexed - this report's arm | $0 | $763 | **$35,505** |
| **STAT** | statutory standard deduction plus age bumps, re-derived | $0 | $4,300 | $6,000 |
| **DIRECT** | ask `calculateTaxes()` about a provisional year, twice - **shipped** | **$0** | **$0** | $6,000 |

Against a median charged deduction of $47,744.

- **PRIOR is exact in the median and catastrophic in one kind of year.** In the 120 plan-years where
  the filing status changes it is wrong by $35,505 - the whole difference between the MFJ deduction
  it carried forward and the Single one now charged. DIRECT is exact in those years, because it asks
  about THIS year's status.
- **STAT re-derives the deduction, which is the failure mode to avoid** - a second source of truth
  that can drift from the tax engine - and it is no more accurate for it.
- **DIRECT is asked TWICE, and the second pass is not polish.** The first asks at the bracket top,
  which is about one deduction below where the plan will land, so the senior deduction is
  under-phased-out and comes back too large. On one plan that overshot the bracket top by $1,338 of
  taxable income. Asking again at the ceiling the first pass implies turns that into an $80
  undershoot. The phase-out rate is 6%, so a third pass is not worth its call.
- **The residual is $6,000 - one senior deduction - and only in years the plan never reaches its
  ceiling**, where the realized AGI is nowhere near the provisional one. It is logged rather than
  argued: `-ceilDedAddBack` (what the ceiling used) sits beside `-fedDeduction` (what was charged) in
  every row, so the gap is recoverable from any finished run.

The measured cost of the whole two-pass estimate is zero: 0.813 ms/sim against 0.820 on the release
before it, on a 40-year Fill Bracket plan, alternating runs.

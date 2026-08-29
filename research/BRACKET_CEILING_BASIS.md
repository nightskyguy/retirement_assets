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
to $179,200 of a $211,400 bracket. The gap widens with the age-65 bumps and the senior deduction: by
2058 the same plan's deduction is $39,998.

This happens every year a bracket strategy runs, always in the same direction, and no cliff is
crossed, which is why it never announced itself.

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

The headline, and it was not the expected one.

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

## 7. What this says about P87b

- **The basis error is confirmed and is exactly one deduction.** Section 1. Nothing about the
  measurement disputes it.
- **It should not be framed as money left on the table.** Correcting it loses in 51 of 74 clean
  cells. Any release note or tooltip promising recovered room would be wrong three times in four.
- **The strongest case for changing anything is the label, not the number.** The dropdown prints
  `22% Fed  ·  $211,400` and never says which income that is - and the answer turns out to be
  "MAGI, though the number came from a taxable-income table". `P87f` was already scoped for this and
  is now the best-supported item in the phase.
- **If a ceiling change is built anyway, it belongs behind a choice, not a fix.** The 12% row wants
  it and the 22% row does not.
- **`minlimit` is out of scope for P87 entirely** (section 4), and carries a separate question of
  its own.
- **P87c, P87d unchanged.** This measured the deduction leg only. The Social Security basis
  (`yr.fixedInc` is the full benefit where IRMAA and federal want the taxable portion) and the ACA
  overage add-back were not armed here.

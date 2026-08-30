# An Extra Roth Conversion never reached MAGI (P88)

A plan could convert $100,000 to Roth every year and never pay a cent of the Medicare surcharge that
income earns. The conversion was taxed correctly; it simply never reached the income figure Medicare
reads. This report characterizes that, records the numbers before the fix, and scores the fix
against them.

Harness:
[`.test_harnesses/extraconv_magi_harness.js`](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/extraconv_magi_harness.js)

```sh
node .test_harnesses/extraconv_magi_harness.js
```

## Reading guide

Everything below uses these.

| term | meaning |
|---|---|
| **MAGI** | modified adjusted gross income. Medicare reads it from **two years earlier** to set the IRMAA surcharge, so a conversion made today shows up in a premium the year after next |
| **the gross** | the dollars actually pulled out of the IRA for the conversion, after the IRA-balance cap. The `extraConv` column |
| **MAGI sensitivity** | the year's MAGI at $X of conversion minus the same at $0, as a percentage of the gross. A correct engine reads about 100%. A stale one reads about 0% |
| **CEILING family** | a strategy targeting a limit: Fill Bracket, IRMAA Tier. **AGNOSTIC family**: Proportional, Ordered, which target no limit |
| **the two paths** | `extraConversionAmount`, the amount typed into Extra Annual Roth Conversion; and the cash-funded **gross-up**, which pulls extra IRA so the tax can be paid from Cash. Both had the defect |
| **BEFORE / AFTER** | two runs of the same harness on two builds. There is no research flag to A/B here: this is a defect, not a candidate behavior, so the fix is unconditional |
| **M1..M6** | predictions, registered before the fix and scored in section 5 |

### The grid

5 account mixes x 4 strategy families x 4 conversion sizes ($0 / $25k / $50k / $100k) x cash-funding
off and on, plus a young-household arm = **172 simulations**, about a second. The mixes, ages and
economic assumptions are copied verbatim from `rmdbasis_harness.js`.

---

## 1. The defect

Two functions pull IRA dollars *after* the year's main tax pass has run. Both recomputed the year's
tax correctly and copied `federalTax` and `stateTax` back onto the year. Neither copied any
**income-basis** field, so `MAGI`, `AGI` and taxable income all kept their pre-conversion values.

That is not a display problem. The year's MAGI is pushed into the plan's MAGI history, and the
Medicare surcharge two years later is charged against that history. The stale figure is the one that
gets billed.

One plan, Fill Bracket 22%, year 0:

| | BEFORE | AFTER |
|---|---|---|
| ceiling the plan aimed at | $211,400 | $211,400 |
| MAGI with no conversion | $211,400 | $211,400 |
| MAGI with a $100,000 conversion | **$211,400** | **$311,400** |
| logged overage | $0 | $100,000 |
| IRMAA tier that MAGI earns | `-none-`, $0 | **Tier 2, $7,166/yr** |

A whole tier, invisible.

**Two blindnesses stacked, and either alone would have hidden it.** The stale MAGI is one. The other
is that the bracket-overage column is computed inside the withdrawal phases, long before either
conversion path runs, so it was deciding whether the plan broke its ceiling before the thing that
broke it existed.

## 2. It moves with the conversion now, and it did not before

MAGI sensitivity at $100,000, as a percentage of the gross. 100% is correct.

| family | kind | BEFORE | AFTER |
|---|---|---|---|
| Fill Bracket 22% | ceiling | 0.0% | **100.0%** |
| IRMAA Tier 1 | ceiling | 0.0% | **100.0%** |
| Proportional 10% | agnostic | -3.6% | **96.4%** |
| Ordered CBRI | agnostic | -1.0% | **99.0%** |

The ceiling families read exactly 0% before, because their MAGI is pinned to the ceiling by
construction. The agnostic families read slightly **negative**, which is second-order and worth
naming so it is not mistaken for a partial credit: a larger conversion changes how surplus is routed
and therefore changes the ordinary draw. That drift is also why they land a little under 100% after
the fix rather than exactly on it.

## 3. What it cost

Lifetime IRMAA, summed over the 5 account mixes, cash-funding off.

| family | kind | BEFORE @ $100k | AFTER @ $100k | change | @ $0, both builds |
|---|---|---|---|---|---|
| Fill Bracket 22% | ceiling | $628,518 | $1,062,261 | **+69%** | $1,409,139 |
| IRMAA Tier 1 | ceiling | $778,871 | $1,011,958 | **+30%** | $1,249,360 |
| Proportional 10% | agnostic | $435,339 | $734,920 | **+69%** | $1,501,543 |
| Ordered CBRI | agnostic | $502,349 | $1,167,418 | **+132%** | $1,852,918 |

**This was never a ceiling-strategy problem.** Proportional and Ordered target no bracket at all and
were under-billed by as much or more.

**Read the BEFORE column carefully, because it says something worse than "too low".** Before the
fix, lifetime IRMAA *fell* as the conversion grew: $1.41M at no conversion down to $0.63M at
$100,000. That is the conversion shrinking the IRA, and so shrinking later required distributions,
with none of the conversion's own cost charged against it. The tool was presenting a large Roth
conversion as a way to **reduce** your Medicare surcharge. It does reduce the RMD-driven part; it
also has a cost of its own, and only one of those two was in the arithmetic.

## 4. What did not change

The `@ $0` column above is identical on both builds, to the dollar, for all four families. So is the
year-0 income tax at every conversion size, and so is a fingerprint over 20 cells that use neither
conversion path. The fix reaches the two conversion paths and nothing else.

Income tax was never the problem and did not move: on the probe plan, year-0 federal plus state tax
reads $39,238 / $47,063 / $55,322 / $73,125 at $0 / $25k / $50k / $100k, before and after.

## 5. Predictions

| id | prediction | verdict |
|---|---|---|
| **M1** | BEFORE the gross is absent from MAGI; AFTER it is present | **HOLDS both ways.** Absent in 120/120 converting cells before; present in 120/120 after, exact to within 5% in 101 (the rest is the routing drift of section 2) |
| **M2** | AFTER, lifetime IRMAA rises where a conversion happens and is unchanged where none does | **HOLDS.** Rose in 4/4 families at $100,000; unchanged in 4/4 at $0 |
| **M3** | ZERO TEST: a plan with no extra conversion and no cash-funding is bit-identical | **HOLDS.** Fingerprint $39,920,984 on both builds |
| **M4** | a household that never reaches Medicare age shows moved MAGI and unmoved IRMAA | **HOLDS.** MAGI moved $96,785, IRMAA $0 on both arms |
| **M5** | year-0 federal + state income tax is unchanged by the fix | **HOLDS.** $39,238 and $73,125, recorded and re-measured |
| **M6** | the cash-funded gross-up carries the same defect and the same fix | **HOLDS.** 98.8% of gross with cash-funding off, 98.9% with it on |

### M1 was first written too strongly, and the wrong form is instructive

It said "MAGI is IDENTICAL at $0 and at $100,000". That is exactly true for the ceiling families and
false for the agnostic ones, whose routing drift reaches -14.6% of a $25,000 conversion. Scored that
way it condemned a working measurement in 20 of 120 cells. The claim being made is that the gross is
**absent**, so the test has to be one-sided and stated against the gross: a -14.6% drift is nowhere
near +100% and must not read as a partial fix. The same correction applies to the AFTER form.

## 6. Consequences beyond the arithmetic

- **The Optimizer's conversion search was biased toward larger conversions.** Its `⇌` rows search
  for the conversion amount that maximizes a chosen metric, scored on numbers that omitted the
  conversion's own IRMAA. On one pinned fixture the search moved from $150,000 to $100,000 once the
  cost was priced.
- **Break-even got harder, correctly.** The heirs tax rate at which converting pays moved from 0.57
  to 0.65 on a pinned fixture: converting now carries the surcharge it always owed, so it takes a
  higher rate to justify.
- **A conversion and a ceiling strategy pull against each other, and now the tool says so.** The
  overage column is re-decided after both conversion paths, and the part a voluntary conversion
  caused is tracked separately from the part spending forced. Keeping those apart matters: the
  Optimizer's "this ceiling cannot fund this plan" heuristic must not fire merely because someone
  typed a conversion.
- **Not yet done.** Whether the Optimizer should skip ceiling families in its conversion search is a
  separate question, and now that conversions are priced correctly the answer may be no. Measure it
  rather than assume it.

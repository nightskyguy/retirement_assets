# Archived findings

Moved out of `findings.md` on 2026-09-02. **Nothing here was deleted and nothing here was judged
wrong** - every entry was either a defect the code no longer has, a claim a later entry in the same
file superseded, or undated legacy planning material that predates the `Pnn` scheme. Sections are
verbatim, in the order they appeared.

The rules these entries earned did not come with them: they live in `findings.md` under **"Rules
earned the hard way"**, each one naming the test that now enforces it. Read that section first; come
here only for the narrative behind a rule, or to check what a superseded claim actually said.

**To revive one:** move its section back into `findings.md`. Headings are unchanged, so every
citation elsewhere still resolves by name.

| was at | heading |
|---|---|
| 63 | Stage 3 oracle: conversion timing is the real lever, proportional is refuted twice, and cyclic's edge is ROUTING (2026-08-10) |
| 263 | Dividends are counted twice, and that is why Brokerage looks under-drawn (2026-08-06, v11.146e) |
| 398 | Two OBBBA provisions were implemented, tested, and never switched on (2026-08-06, `c9e356a`) |
| 433 | A hardcoded ⚠️, a gate nobody could see, and two age bases side by side (2026-08-05, v11.1464) |
| 491 | PR 3c: the ACA cap that never ended — prediction, then measurement (2026-08-05, v11.1462) |
| 578 | The baseline/proportional strategy family cannot fund its own tax bill once the taxable accounts run dry (2026-08-05, diagnosed at v11.1447, re-verified at v11.1464) |
| 769 | A lookup that returned 0 for "no limit" made the flagship strategy inert in 21 states (2026-08-04, v11.1447) |
| 967 | Self-consistent arithmetic is not a correct model, and an invariant can lock in the bug it was meant to catch (2026-07-29, Tax Payment Planner v1.13b9) |
| 996 | User-facing text can carry a legal claim nobody ever checked (2026-07-29, Tax Payment Planner v1.13b9) |
| 1013 | A feature can be fully wired and still do nothing, if nobody populates its input (2026-07-27, v11.1387) |
| 1021 | Two strategy-matching gaps, and why the current plan was invisible (2026-07-27, v11.1387) |
| 1033 | "Optimize Conversions found nothing" on the default scenario is correct, and why (2026-07-26, v11.1370) |
| 1054 | Latent engine inconsistency (ROOT-CAUSED AND FIXED 2026-07-26, v11.137f — see below) |
| 1058 | A predicate must read its input through the same accessor the behavior uses (2026-07-26, v11.137f) |
| 1091 | Analytics reads `document.title` before any body script runs — don't JS-derive `<title>` (2026-07-25, v11.1340) |
| 1136 | Requirements (from optimizer_directions.md) |
| 1240 | Resources |
| 1280 | Open Questions |
| 1357 | The Break Even diagnostic names a year that is actually ACTIONABLE, not just explanatory (2026-07-21, v11.12fd) |
| 1628 | The coverage test has to be cumulative |
| 1880 | P28 round 2: Roth-first pays only when it displaces BROKERAGE, and the account mix decides (2026-07-30) |
| 2041 | The Red X covers 245 tests and misses 260, and three tests are why nobody moved them (2026-08-05, v11.1468) |
| 2217 | 2026-08-10 follow-up — user asked for (b) surplus-fill + (c) harness. Both DONE. |
| 2256 | 2026-08-17 — P32c second half: the two Brokerage-exclusion arms, and a preliminary Q2 reading |
| 2307 | What was wrong before the measurement |
| 2593 | Every third-pass mover is `minlimit`, which is the defect the phase opened with |
| 2913 | P86a audit - every displayed dollar, classified (2026-08-28, three-agent sweep, all file:line verified) |
| 3045 | P88 - an Extra Roth Conversion never reaches MAGI (2026-08-29, user-raised) |
| 3242 | P94 - `minlimit` is unreachable, and the evidence (2026-08-29) |
| 3544 | P87c2: three arms, and the exact inversion dominates on every axis  *(2026-08-31)* |
| 3626 | `nonSSIncomeForMAGI`: how often it runs, and what the bisection actually costs  *(2026-08-31, user-challenged)* |
| 3816 | `strategy: 'schedule'` and the shape of what the engine cannot say  *(2026-09-01, `P103b2`)* |
| 4032 | The flat spend fixture was understating every gap by about half  *(2026-09-01, `P103b5c`)* |
| 4334 | The gap fill funds a Cash- or Roth-funded year twice, and the surplus becomes a Roth conversion nobody asked for  *(2026-09-02, found building `P104b1`)* |

---

## Stage 3 oracle: conversion timing is the real lever, proportional is refuted twice, and cyclic's edge is ROUTING (2026-08-10)

P51 ran end-to-end (`research/PERFECT_FORESIGHT_ORACLE.md`; harness `oracle_harness.js`, engine
hook `oracleWithdrawalPlan` default-off, suite 242/242, 165k sims / 196s). Five conclusions:

**1. The flat conversion sweep leaves per-year money on the table, and only per-year timing can
reach it.** Core's own `optimizeConversionAmount` found $0 on the champion arm in 15 of 15
cells; the per-year oracle found up to +$241k (conv-only) and up to **+$1.08M** on a non-cyclic
base (defaults3x @4%). Conversion timing dominates the withdrawal split everywhere IRA-heavy;
the split's best contribution is +$461k in a GK cell, usually far less.

**2. "Proportional is default-optimal" is now refuted on BOTH halves.** Comparative (Stage 1):
never top-3 in 45 cells. Absolute (Stage 3): gap-to-oracle 2.3-11.6% where measurable, IRA Draw
ahead of it in every cell.

**3. The oracle is a ceiling only over what it controls — and cyclic rows BEAT it in
defaults @6% (gaps −0.31%, −0.19%).** The withdrawal menu cannot express cyclic's
surplus-to-Brokerage routing (and the hook refuses to compose with cyclic by design). So:
treat every oracle number as a lower bound on the true ceiling (P51d cross-check sharpened,
still open), and read the negative gaps as attribution — **cyclic's residual edge is surplus
routing, not draw order**, converging with Stage 1's confound finding from the opposite side.

**4. The oracle does NOT rediscover harvest alternation** (S3-P3 WRONG, 1/6 cells). Its
recurring shape is IRA-led mid-plan then a **Roth-spending tail** (last ~5-10 years) with
Brokerage ridden to the §1014 step-up. Perfect-foresight artifact to notice, not a rule to
ship. Backstops silent in 15/15 accepted solutions (forced-IRA years = 0).

**5. Methodology rules that made the numbers honest, worth reusing:** champion selection must
use `baselineScore` (wealth-only let GK buy the slot by cutting spend), and every oracle
candidate must pin delivered spend to its base row within $1 — before the pin a GK base showed
a fake +81% that was pure spend-shifting. GK-base cells at 6-8% spend exclude every fixed-spend
row from their gap tables; those cells need a survivable fixed-spend base in a follow-up.

Question A's answer, as measured: whole-horizon optimization on this engine costs one ~40-line
default-off hook + a minutes-long node harness. It is cheap enough to be a standard research
instrument; only its POLICY use is out of bounds.

---

## Dividends are counted twice, and that is why Brokerage looks under-drawn (2026-08-06, v11.146e)

**P32 asked "why is Brokerage barely drawn, and is the third-pass exclusion to blame". The premise
is wrong on both halves.** Brokerage is drawn constantly, and the reason it looks otherwise is an
accounting defect three passes upstream of the exclusion the phase suspected. Found by the
accounting audit the phase itself mandated **before** running any behavior arm; that instruction is
what stopped a wasted measurement.

**The defect.** `yr.taxableDividends` (`optimizer_core.js:1191`) is `balance.Brokerage x dividendRate`.
It is then used in both of these places and never reconciled:

- as **income** - it sits in `yr.possibleIncome` (`:1226`, `:1543`) and in every later income sum
  (`:1662`, `:1750`, `:1778`, `:1800`), so it reduces the withdrawal the plan needs to make; and
- as **balance** - `growAndSettle` credits it to Cash (`:2243`) or, under DRIP, to Brokerage
  (`:2239-2240`).

Nothing debits it back out. The only Cash debits in the file are the Cash Reserve hide (`:1328`) and
conversion-tax funding (`:2065`, `:2157`). **The same dollar funds spending and stays on the balance
sheet.**

**Proof that does not depend on reading the code.** Hold TOTAL return fixed and move it between
growth and dividends. Dividends are taxed annually and unrealized growth is not, so the
dividend-bearing plan must finish BEHIND. Brokerage-only $1M, basis = value so capital gains cannot
interfere, 20 years:

| spendGoal | A: growth 8% / div 0% | B: growth 6% / div 2% | B - A | A tax | B tax |
|---|---|---|---|---|---|
| $0 | $4,703,357 | $4,764,613 | **+$61,256** | $0 | $16,153 |
| $40,000 | $2,835,288 | $3,603,293 | **+$768,005** | $4,367 | $13,767 |
| $80,000 | $956,925 | $1,530,603 | **+$573,678** | $20,228 | $20,564 |

B wins by 27% at $40k of spending while paying three times the tax. The year-by-year trace shows the
mechanism with no inference required: the dividend lands in Cash, `CashWD` stays **$0 forever**, and
Cash climbs $21,100 -> $746,286 over the 20 years while Brokerage draws fall to zero by year 14. The
plan is spending money it never removes from any account.

**This is the reported symptom.** Holding total return at 5% on a $600k Brokerage and moving the
split:

| dividend | growth | lifetime Brokerage withdrawals | finalNW |
|---|---|---|---|
| 0% | 5.0% | $1,108,006 | $1,649,844 |
| **0.5% (shipped default)** | 4.5% | **$896,765** (-19%) | **$1,895,840** (+$245,996) |
| 1% | 4.0% | $597,763 (-46%) | $2,143,248 (+$493,404) |
| 2% | 3.0% | $27,004 (-98%) | $2,570,484 (+$920,640) |

A higher dividend share at identical total return suppresses Brokerage withdrawals and inflates net
worth. **`retirement_optimizer.html:380` ships `dividendRate` defaulting to 0.5**, so this is not an
edge case, it is every plan that has not zeroed the field.

**Consequences for the phase.** Q2 (does a third-pass Brokerage leg spiral) is **moot until this is
fixed**: it would measure whether an extra Brokerage draw helps, on an engine where dividends already
remove the need to sell Brokerage at all. The phase's own note anticipated exactly this - "a
systematic understatement here would suppress Brokerage draws everywhere with no strategy logic
being wrong, which would make Q2 moot". The direction is the only thing it got wrong: this is an
**over**-credit, not an understatement.

**Q1, measured, on shipped behavior** (5 scenarios x 11 arms, 55 rows): **zero rows never draw
Brokerage.** By gap-fill family, share of years drawing Brokerage: baseline 90.4% starting in year 0,
bracket 61.1% starting year 5.1, cyclic 57.5%, ordered 44.7%. Lifetime draws routinely exceed the
starting balance several times over (`minlimit` on CAP_BASE: 1,422%), because surplus routing keeps
refilling it. "Brokerage is barely drawn" is false as a general claim.

Predictions scored: **P1 right** (baseline highest and earliest, proportional gap fill touches it in
year 0), **P2 right** (bracket later, Cash comes first in its chain), **P3 WRONG** - predicted
BIRC > CBIR > RIBC by sequence position, measured CBIR 49.2% > BIRC 45.8% > RIBC 39.2%. BIRC drains
Brokerage first and therefore has none left to draw later, so "Brokerage first" produces *fewer*
drawing years, not more. **P4 understated** - predicted never-drawing rows would be rare, they are
absent entirely.

**Also settled, and it removes a worry from the phase list.** `capGainsPercentage` is computed once
from the start-of-year balance (`:1330`) and the phase flagged it as a hazard for a second draw in
the same year. It is not: basis is consumed **proportionally**
(`calculateBrokerageWithdrawal`, `:165-183`), so the gain fraction is invariant under withdrawal -
$1M/$500k basis is 50% before a $400k draw and 50% after. The frozen value is correct under this
basis model. It would only be wrong under lot selection, which the engine does not model, and that
modeling ceiling (no HIFO, no specific-ID) still bounds every P32 conclusion.

Harness: `.test_harnesses/brokerage_harness.js` (node), reproduces all of the above.

### Why 209 tests did not catch it (asked for explicitly, 2026-08-06)

**Not an input-coverage gap.** The code path ran constantly: `CAP_BASE` carries `cashYield: 0.02`,
and other fixtures run `0.03`/`0.02` and `0.02`/`0.015`. Plenty of tests executed the defect.

**Three things had to line up, and they did:**

1. **Dividends and interest have no assertion anywhere.**
   `grep -c "cashDividends\|taxableInterest\|CashWD" optimizer_core.test.js` returns **0**. Not one
   test in the suite ever looked at either quantity, in any form.
2. **The reconciliation tests that exist are all IRA-shaped.** The suite does have good balance
   reconciliation - `optimizer_core.test.js:1881` rebuilds the IRA balance from its withdrawal
   columns each year, and there are sibling reconciliations for the tax columns and the conversion
   gross-up. Every one of them is about the IRA or about tax. **Cash and Brokerage have none.**
3. **Characterization pins recorded the inflated numbers as correct.** GK totals, `OC_BASE`,
   `PF11_BASE` and the funding-invariant arms all pinned values produced by the double-credit, so
   the defect was not merely unnoticed, it was *enshrined* - and every later change was measured for
   byte-identity against it.

**The trap worth remembering: the obvious test would have been vacuous.** The natural fix-test is a
per-year Cash reconciliation in the shape of the IRA one:
`endCash = prevCash + cashG + surplusCash - CashWD`. That identity holds to **0.0000 both before and
after the fix**. The balance sheet was never inconsistent. The defect lived on the income statement -
the dividend legitimately entered Cash *and* separately shrank the withdrawal the plan needed. In
year 0 of one fixture `CashWD` is 1,829 before and 3,222 after; both reconcile perfectly.

So the guard has to be an **economic or flow invariant**, not an accounting one. The three added:

- *a dividend cannot create wealth* - same total return split as growth vs dividend+DRIP; the
  dividend arm pays tax the other does not, so it can never finish ahead. Fails at **+21.7%** unfixed.
- *interest leaves Cash only by being spent or taxed* - lifetime `CashWD` must equal lifetime spend
  plus lifetime tax. Unfixed: expected $972,167, got **$2,449**.
- *interest cannot compound faster than its own yield* - hard ceiling at `start x (1+y)^n`.
  Unfixed: $4,254,946 against a $2,191,123 ceiling.

**Generalizable lesson:** this engine's tests check that money is *accounted for* but not that it is
*conserved*. A dollar can be recorded correctly in two places at once and every reconciliation still
passes. Conservation needs same-total-return equivalence tests, and there is currently no such test
for the Roth or IRA growth paths either - a natural follow-up for P6.

### A side effect: the PF11 / T6 metric divergence was itself an artifact

`optimizeConversionAmount` had a pinned scenario where `finalNW` picked $0 while `baselineScore`
picked $50k/yr - the case that justified adding `baselineScore` at all. That gap **disappears** once
the double-credit is fixed, and the mechanism is clear: the no-conversion arm banked phantom Cash
every year, and `finalNW` values Cash at face while discounting the IRA, so phantom money made "do
not convert" look better than it was.

Searched before re-pinning: **64 variants over six levers** (spendGoal 88k-105k, futureIRATaxRate
0.24-0.50, Brokerage 150k-800k, basis 100k-290k, Roth 0-300k, IRA1 400k-1.5M, plus a combined
IRA x rate x Brokerage x spend pass). **Zero divergent.** The tests were re-pinned to agreement
rather than tuned until the old gap reappeared. The consequence is recorded in the test file: the
defect those two tests documented currently has **no regression guard**. `baselineScore` may still
be the better metric on other grounds, but the scenario that motivated it no longer reproduces.

---

## Two OBBBA provisions were implemented, tested, and never switched on (2026-08-06, `c9e356a`)

**Found while verifying a user report** that federal tax looked too low on a brokerage-only Alaska
plan. That tax was correct; checking it surfaced this. **No plan phase covers it** - it is recorded
here because it is the second instance of one failure mode in a single week.

`taxengine.js` implements both OBBBA provisions (P.L. 119-21) and `optimizer_tests.js` unit-tests
both. **The tests pass `obbaOn: true` themselves, and no call site in `optimizer_core.js` ever did.**
Both flags default to `false`, so the senior deduction never reached a single simulated year and the
SALT cap always used the $10k TCJA floor. Federal tax was too **HIGH** for anyone 65+ in 2025-2028,
and for itemizers in high-tax states in 2025-2029.

- **The caller has to own the gate.** `calculateTaxes` cannot decide this itself: it receives
  `inflation` but never a tax year, and the `sunsetYear` values in `TAXData.OBBBA` are declarative,
  referenced by no code. `yr.obbaOn` / `yr.saltHigh` are now computed once per year in
  `resolveHousehold` and passed to all **10** `calculateTaxes` call sites.
- **Sizes.** Senior deduction $6,000 per filer 65+, phasing out above $150k MFJ / $75k single,
  2025-2028. SALT $40k cap, 2025-2029, phasing down above $500k MAGI. Both revert the year after
  sunset. Measured on the reported scenario (MFJ, both 65+, Alaska): federal tax 2026-2028 drops to
  $0 (was $144/$106/$63). **The SALT half is real but narrow** - it only bites between roughly $465k
  and $515k of MAGI in a high-tax state, worth up to ~$959 there and nothing outside it.
- **Second-order effect worth remembering:** lowering the tax bill lengthened the forced-IRA
  convergence path. `fixedpct` 2% began finishing 2027 with **$21 unfunded while the IRA held
  $2.16M** - the 4th iteration was one short. Cap raised 4 -> 6; 8 is identical, so it converged
  rather than being papered over. Costs nothing when already converged (the loop breaks under $1).
- `ordered` CBIR went 2 -> 3 stranded years and RIBC 1 -> 2, amounts $10-$161. Known class: `ordered`
  is the one family excluded from the forced-IRA loop, so it gets no second chance and any tax-path
  change reshuffles which years end a few dollars short.

**The generalizable lesson, same as the dividend double-credit above:** this suite tests functions
directly and does not test that the engine *calls them correctly*. The guard added here is
accordingly a use-site guard, not another unit test - spy on the global the engine resolves and
assert every `calculateTaxes` call in a run is handed both flags, and that the gate actually varies
with the year.

---

## A hardcoded ⚠️, a gate nobody could see, and two age bases side by side (2026-08-05, v11.1464)

A user reported the ACA options staying disabled after changing birth years, and suspected the age
gate was only evaluated at load. Three separate things turned out to be involved and only one of
them was the thing reported.

**The reported bug does not exist.** Driving `startAge`, `birthyear1` and `birthyear2` with real
input events across 9 transitions, the gate re-ran correctly every time. `birthyear1` was checked in
isolation (hold `startAge` at 60 and `birthyear2` at 1990, so only `birthyear1` moves the verdict)
because a first attempt changed it without flipping the outcome, which proves nothing.

**What actually happened is a two-age-bases collision.** `#age-display-1` and `#age-display-2` show
ages **today** and never move when Retirement Start Age changes — verified by moving `startAge` from
65 to 55 and watching them sit still. The ACA gate is about ages at **retirement start**. On the
reported scenario those are 59/73 and 65/79, in 2026 and 2031. The page showed the first pair and
the warning talked about the second without naming a year. Being told you are on Medicare beside a
field reading "Age 59" is indistinguishable from a stale control. The warning now names the start
year and both ages in it.

**The ⚠️ the user was actually looking at was a string literal.** `optimizer_ui.js` built the ACA
dropdown entries as `{ pct: 400, label: 'ACA 400% FPL ⚠️' }` — only the 400% entry, computed from
nothing. So it fired on every scenario, including ones where 400% was the only feasible arm, and
stayed silent on a 200% cap that could not fund a single year. PF13 noticed it ("not just the
hardcoded 400% label") and worked around it in the results table instead of removing it. Removed.

**The flag that IS computed was checked and is correct.** The question asked was whether the ⚠️ on
Optimizer rows is arbitrary. Measured over **1008 scenarios** (7 spend goals x 4 IRA sizes x 2 cash
levels x 3 states x 3 age pairs x single/couple), flagging FPL 200/250/300/400 by
`totals.acaBreachYears > 0`:

| flagged set | scenarios |
|---|---|
| none | 460 |
| `{200}` | 44 |
| `{200,250}` | 12 |
| `{200,250,300}` | 94 |
| all four | 398 |
| **a looser cap flagged while a tighter one is not** | **0** |

Every partial set is downward-closed, and when exactly one arm is flagged it is **always 200%** —
the tightest cap. That is the invariant that makes the flag readable, and it is now pinned by a test
rather than left as an emergent property. Getting the test to exercise the partial case needed
Social Security in the sweep: `CAP_BASE`'s $72k of combined benefits already exceeds the 300% cap on
its own, so every arm breaches on unavoidable income and the interesting middle never appears.

**Un-gating the ACA family from the nerdknob was safe for the goldens, and that was checked before
the gate came out, not after.** Of the four `OPT_GOLDEN` captures only `default` was recorded with
`nerdKnobs: false`, and its base has both people on Medicare at start — so its ACA rows were
suppressed by age, not by the flag. All four still reproduce.

**One test I wrote failed for a reason worth recording.** The in-page assertion that four ACA
options are offered failed while a live DOM read showed all four present. `retirement_optimizer.html`
calls `runTests?.()` at top level, which runs BEFORE the `DOMContentLoaded` handler that builds the
dropdown. The test was asserting on bootstrap timing rather than on the builder; it now calls
`refreshStratRateOptions()` itself.

---

---

## PR 3c: the ACA cap that never ended — prediction, then measurement (2026-08-05, v11.1462)

The plan requires the direction to be predicted first, because the only ACA fixture in the suite is
one whose ages make the bug invisible-by-passing. Recorded here so the measurement can contradict it.

**The fixture is inside the defect.** `CAP_BASE` (`optimizer_core.test.js:783`) has
`birthyear1: 1960`, `birthyear2: 1959`, `startYear: 2026` — ages **66 and 67 in year 0**, and it runs
30 years. Both people are past Medicare eligibility before the simulation's first row. The
`strict ACA` test at `:821` therefore asserts the behavior of an FPL cap being enforced from age 66
to age 96, which is exactly what PR 3c removes.

**Predicted, per assertion:**

| assertion | now | after | why |
|---|---|---|---|
| `_sumForcedIRA === 0` | passes | **still passes** | `forcedIRA` is written only by the soft-cap loop at `:1651`, gated `isBracketStrategy && !isACAStrategy`. With the lapse, `isACAStrategy` goes false, and `isBracketStrategy` is `bracket\|minlimit\|fixedpct\|isACAStrategy` — `'aca'` is in none of those, so it goes false too. The loop still never runs. Passing for a **different reason** than before. |
| `_sumAbsShortfall > 1000` | passes | **FAILS** | the lapsed year takes the baseline `else`, which draws proportionally from IRA/Brokerage/Cash to meet spend. $2.1M of IRA against a $160k goal funds it. Shortfall -> ~0. |
| `acaBreachYears > 0` | passes | **FAILS -> 0** | `yr.acaBreach` is set only under `yr.isACAStrategy` (`:1630`, `:1696`). Never true in this fixture after the change. |

Two of the three assertions are predicted to break, and **breaking is the correct outcome** — they
pin the defect. The fix is not to relax them: it is to move the strict-ACA fixture to birth years
where ACA is actually live, and add a separate test that pins the lapse at these ages.

**Predicted direction of the `aca` arm overall:** final net worth **up**, shortfall **to zero**,
`acaBreachYears` **to zero**, for any scenario whose people are already 65+. An ACA row that was
ranked untenable on a 66/67 household will now rank as an ordinary Proportional 0% row — which is
what it always was in reality.

**Predicted to NOT move:** every scenario where at least one living spouse is under 65. The lapse
requires **all** living spouses past the age, so a 66/62 couple keeps the cap for four more years,
and the older spouse's RMDs/SS still push household MAGI through it. Those rows should stay
untenable, and now by measurement (`acaBreachYears`) rather than by the
`eitherOnMedicareAtStart` assumption.

**Not predicted, deliberately:** whether any ACA row starts *winning* a sweep. It cannot be read as
a recommendation either way — item 3 of the engine survey stands. The tool prices the cap's cost and
zero dollars of the subsidy it buys.

### MEASURED (2026-08-05, v11.1462). Two of the predictions above were WRONG.

Per-assertion, the prediction held: `forcedIRA` stayed 0, and both the shortfall and breach
assertions failed exactly as called. The two directional claims did not.

**Wrong #1: "shortfall -> ~0".** It went to **$304,331**, not zero. The reason is the thing the
prediction did not check: **Proportional 0% has a $304,331 shortfall of its own on this fixture**,
and it is byte-identical on `HEAD` and on the working tree. The lapse does not fund the plan; it
hands the plan to its successor, warts included. Confirmed by running the same three arms against
both engines in separate processes:

| arm | HEAD | v11.1462 |
|---|---|---|
| `propwd` 0% @66/67 (control) | 304,331 short / $4,263,278 spend / $684,010 NW | **identical** |
| `bracket` 22% @66/67 (control) | 1 short / $4,567,608 spend / $196,871 NW | **identical** |
| `aca` 400% @66/67 | 24 breach yrs / 735,010 short / $3,832,599 spend / $1,888,543 NW | 0 breach / 304,331 / $4,263,278 / $684,010 |
| `aca` 400% @58/59 | 32 breach yrs / 1,463,587 short / $5,019,726 spend / $1,929,570 NW | 7 breach / 790,504 / $5,692,809 / $117,427 |

**Only the `aca` arms move.** That is the scope proof, and it is a measurement rather than a reading
of the diff. The lapsed arm's four numbers are the propwd control's four numbers exactly.

**Wrong #2, and this one was a reasoning error rather than a missing fact: "final net worth up".**
It went **DOWN**, $1,888,543 -> $684,010. Predicting terminal wealth as the success direction was
backwards. The old behavior looked $1.2M richer *because* it refused to fund the spend goal and left
the money in the IRA — the wealth was the symptom of the defect, not a benefit being lost. The
direction that actually says the fix worked is **spend**, which rose $3,832,599 -> $4,263,278, and
**breach years**, 24 -> 0. Any future "did this help?" question on a strategy that can decline to
spend has to be asked about funded spending first; terminal wealth alone will rank starvation as
success. That is the same trap as the survey's item 3 in a different coat.

**The @58/59 arm is the one that proves the gate is a gate and not a switch.** 7 breach years, and
7 is exactly the count of pre-Medicare years (born 1968, plan opens 2026 at 58, crosses at 2033).
Every pre-lapse year breaches; no post-lapse year does.

**Found while building this, not predicted at all: a SECOND site needed the gate.** `beginYear` picks
the year-0 withdrawal month from `_stratImpliesConversion`, which named `'aca'` literally
(`optimizer_core.js:957`). A lapsed ACA plan was still taking January timing — the "this is a
conversion year" schedule — while its Proportional twin took December, so the two diverged in year 0
on 34 log columns. Caught only because the equivalence test compared the whole log rather than a few
totals. A totals-only test would have passed with the wrong withdrawal month shipped. The gate is now
a shared pure helper, `acaCapLapsed(age1, age2, alive1, alive2)`, called from both sites.

**Also found: `acaBreach` was passed into `buildSimYearLogRecord` and never emitted**, so the year a
cap actually bound had never been observable per-year — only as `totals.acaBreachYears`. Now logged
as `'-acaBreach'` (leading `-` = no table column, same convention as `'-iraG'`). Verified in the live
page that it does not leak a column: 87 headers, none matching.

---

---

## The baseline/proportional strategy family cannot fund its own tax bill once the taxable accounts run dry (2026-08-05, diagnosed at v11.1447, re-verified at v11.1464)

**FIXED. PR 2 (v11.1468, merged as #152) widened the backstop gate; PR 3 (v11.146a) fixed the sizing
itself.** `yr.additionalSpendNeeded` is now net of a `calculateTaxes` call on the guaranteed-income
base, so the primary draw stops under-sizing by the tax on Social Security, pensions and RMDs. Three
results worth keeping, because each one contradicts something this entry or the build plan assumed:

1. **The bracket family never used this code path at all.** `additionalSpendNeeded` has exactly
   three consumers (cyclic harvest, `propwd`, baseline `else`). `bracket`, `minlimit`, `fixedpct`,
   `fixed` and `ordered` set their draw by their own rule, so they are byte-identical. The plan
   predicted "every strategy including bracket moves"; 46 of 76 probed cases did not move.
2. **The flat-rate shortcut would have been a disaster, and now there is a number for it.** On an
   SS-heavy MFJ household (80k SS, 30k RMD, 12k qualified dividends) the real tax is $3,831 while
   `possibleIncome * nominalRate` is $14,042 - **3.67x** too high. Pinned as a test so the extra
   `calculateTaxes` call cannot be "simplified" back into a rate multiply.
3. **The 4th tax call costs 3.9%** (0.398 -> 0.413 ms/simulate). The feared cost was not real.

PR 3 also showed that PR 2's backstop had been doing ordinary work: on `CAP_BASE` `propwd` 0% the
`ForcedIRA` total falls from 395,109 to 43,816 with spending unchanged. Fixing a symptom made the
plan succeed; fixing the cause made the withdrawals right.

**Original verdict, retained: a defect, not the strategy working as designed.** Pre-existing and byte-identical before
P35 PR 3c (`d68d27f`, landed on `main` as `f71e0bf`); that PR only made it visible, because a lapsed
ACA plan now falls through to this code path. Recorded here only. **No engine change made in this
pass** — `propwd`, `fixed` and `gk` are shipped strategies and any fix moves numbers on every saved
plan that uses them.

**Re-verified after merging PR #150** (which brought PR 3c, the ACA un-gating and the `acaCapLapsed`
helper onto `main`, v11.1464). Every measured number below reproduces **to the dollar**; the line
cites are the post-merge ones (`optimizer_core.js` shifted uniformly +51). So the defect is
orthogonal to the whole ACA batch, which is what "pre-existing" should mean and is worth having
checked rather than assumed.

**Repro** (`CAP_BASE`, `optimizer_core.test.js:782`), overrides
`{ strategy: 'propwd', propWithdraw: 0, stratRate: 0, stratACAMultiple: 0 }`:

| | `propwd` 0% | `bracket` 22% (same fixture) |
|---|---|---|
| `totals.success` | **false** | true |
| `totals.shortfall` | **-304,331** over 13 of 24 years (2037-2049) | -1 |
| end-of-plan IRA | **893,920** | 259,853 |
| `totals.forcedIRATotal` | **0** | 708,183 |

### 1. Where the shortfall originates

Not in `calculateWithdrawals` and not in the `['IRA','Brokerage','Cash']` order. The primary draw
is fine. The defect is that the two **correction** passes that follow it have no path back to the
IRA, and the third safety net is gated off for this strategy family.

`yr.additionalSpendNeeded` (`optimizer_core.js:1281`) is `targetSpend + IRMAA - possibleIncome`,
and `possibleIncome` (`:1226`) is **gross** income — SS plus taxable RMD, pre-tax. So the primary
draw is sized to cover the spend goal *as if the guaranteed income arrived tax-free*. It is grossed
up only for tax on **its own** dollars, at `sim.nominalTaxRate` — last year's *effective* rate
(`:1760`, `taxengine.js:1122-1125` calls `nr` "the EFFECTIVE rate at this bracket's top"), not the
marginal rate the draw actually lands in. Both understatements are by design a first approximation;
the gap fill (`:1517`) and the third pass (`:1635`) exist to correct them. They cannot, here.

Measured ledger, 2040 (Cash, Brokerage and Roth all at 0; IRA at $1,679,275):

| step | value | line |
|---|---|---|
| `targetSpend` | 196,402 | `:1280` |
| `+ IRMAA` | 7,094 | |
| `- possibleIncome` (GROSS: SS 67,823 + RMD 94,213) | 162,035 | `:1226` |
| `= additionalSpendNeeded` | **41,461** | `:1281` |
| primary IRA draw, grossed up at 2039's `nominalTaxRate` 0.2356 | 54,239 (= 41,461 / 0.7644) | `:1438` |
| tax pass 1 `totalTax` (incl. IRMAA) | 48,097 | `:1482` |
| `netSpendable = possibleIncome - totalTax` | 168,178 | `:1524` |
| **`gap = targetSpend - netSpendable`** | **28,224** | `:1525` |
| gap fill: Brokerage 40 / Cash 60, then Roth. All three are 0 | draws **0** | `:1593-1607` |
| `residualGap` | 28,224 | `:1642` |
| third pass: **Cash only, then Roth**. Brokerage deliberately excluded (cap-gains spiral, `:1649-1653`) | draws **0** | `:1665-1677` |
| forced-IRA convergence loop, gate `yr.isBracketStrategy && !yr.isACAStrategy` | **SKIPPED** | `:1702` |
| unfunded | **28,224**, next to an IRA holding **1,679,275** | |

The $28,224 is exactly the unfunded tax: `48,097 totalTax - 12,778 tax assumed on the draw
- 7,094 IRMAA (already inside additionalSpendNeeded) = 28,225`. The gap is **not** a late-plan
artifact — it is ~$27.6k-$28.2k in *every* year of the run. Until 2039 the taxable buffers silently
absorb it (2036: gap 27,582, filled from Cash 20,348 + Brokerage, residual 415, no shortfall). The
shortfall appears the year the buffers empty, which is why it reads as a depletion failure.

Two sub-mechanisms, both visible in the trace:

**(a) 2037-2038, buffers not yet empty.** The gap fill funds `gap` in full, the recomputed tax opens
a small residual, and the third pass may use only Cash and Roth. 2037: `residualGap` 2,196 stranded
while **Brokerage still held 39,428** and the IRA held 1,847,396. 2038: 2,752 stranded against
Brokerage 8,783.

**(b) 2039 onward, buffers empty.** Nothing is reachable at all. The full gap strands.

The exclusion is deliberate and documented (`:1696-1701`: *"Excluded: strict ACA (subsidy cliff),
ordered (own sequence), and fixed/propwd/baseline/gk (already draw IRA for spending — left
unchanged)"*). **The stated rationale is the bug.** These strategies do draw IRA for spending, but
they size that draw against pre-tax income, so they under-draw by the tax on the guaranteed income
and have no route back. `bracket` survives the identical fixture only because its soft-cap loop
forces **708,183** of extra IRA across the same years.

### 2. The `resolveSpendTarget` clamp is inert — ruled out with numbers

`yr.targetSpend = ... : Math.min(sim.spendGoal, yr.goalLimit)` (`:1280`) never fires in this run,
and structurally almost never can:

- **Measured:** `targetSpend === sim.spendGoal` in all 24 years. Minimum per-year headroom
  `goalLimit - spendGoal` = **+46,803**.
- **Structural:** `findUpperLimitByAmount` (`taxengine.js:1053`) returns the top of the bracket
  *containing* the amount, so `limit >= amount - 1` by construction. Swept 9 entities (FEDERAL +
  8 states) x 2 statuses x 8 amounts: min slack **+489**. The clamp can shave at most $1.
- The one way it could bite was the prior finding below: flat/no-tax states returned `limit: 0`,
  zeroing `goalLimit` and hence `targetSpend`. Fixed in v11.1447 — `TX`/`FL`/`IL`/`PA` now return
  `Infinity`.

So the clamp is not depressing `targetSpend` in the single-filer years, and it is not the source of
the shortfall.

### 3. `success: false` is honest about the simulation, and the simulation is wrong

Not a repeat of the negative-`totals.spend` artifact:

- **Sign convention.** `Shortfall: Math.min(0, netIncome - sim.spendGoal)` (`:1812`) — negative *is*
  the magnitude of unfunded spending, and it nets out correctly:
  `sum(targetSpend) 4,567,609 + totals.shortfall (-304,331) = 4,263,278 = totals.spend` to the
  dollar (`:2203`). No sign error, no double count.
- **The success test measures the right thing.** `netIncome < targetSpend * 0.99` (`:2257`) is
  comparing against the *unclamped* goal, since the clamp is inert. Its 1% tolerance is why the
  first failure lands in 2037 (netIncome 185,766 vs 186,082 required, missing by **317**) even
  though the structural gap exists from year 0.
- **But:** the household really did receive $168,178 against a $196,402 goal in 2040, and the
  terminal $893,920 IRA is precisely the money never withdrawn. A real household would take a larger
  distribution. So the verdict honestly describes a withdrawal plan the engine got wrong, and the
  user-visible claim "Proportional 0% fails on this plan" is false.

**Latent, not live:** `totals.spend += yr.targetSpend + yr.surplus.Shortfall` (`:2203`) mixes a
`targetSpend`-based term with a `spendGoal`-based `Shortfall`. Equal today only because the clamp is
inert. If the clamp ever binds, spend is discounted twice.

### Blast radius: the whole else-branch family, not just `propwd` 0%

Same fixture, same overrides pattern:

| strategy | success | `totals.shortfall` | end IRA | forcedIRA |
|---|---|---|---|---|
| `bracket` 22% | true | -1 | 259,853 | 708,183 |
| `fixedpct` 2% | true | -0 | 263,569 | 2,245,832 |
| `ordered` CBIR | true | -119 | 242,835 | 0 |
| `propwd` 0% | **false** | **-304,331** | **893,920** | 0 |
| `propwd` 10% | true | -4,247 | 183,441 | 0 |
| `propwd` 50% | false | -47,879 | **0** | 0 |
| `gk` | **false** | **-34,050** | **1,616,166** | 0 |
| `fixed` | **false** | **-234,643** | **689,774** | 0 |
| unknown string -> baseline `else` (`:1451`) | **false** | **-304,331** | **893,920** | 0 |

`gk` and any unrecognized strategy fall through to the baseline `else` (`:1451`) and inherit this.
`propwd` 50% is the one honest failure in the table: it really does drain every account to 0.
**`propwd` 10% passes by accident** — the +10% IRA boost over-draws, the after-tax surplus lands in
Cash, and the gap fill spends it. Solvency in this family currently depends on a knob that has
nothing to do with funding.

### Proposed fix (separate PR — not applied here)

Widen the gate at `:1702` from `yr.isBracketStrategy && !yr.isACAStrategy` to
`!yr.isACAStrategy && !yr.isOrderedStrategy`, so the bounded forced-IRA convergence loop also
backstops `propwd` / `fixed` / `gk` / baseline. ACA keeps its cliff, `ordered` keeps its sequence.
Measured on a scratch copy of the engine (repo untouched):

| | today | patched |
|---|---|---|
| `propwd` 0% success | false | **true** |
| `totals.shortfall` | -304,331 | **0** |
| `totals.spend` | 4,263,278 | **4,567,608** (= sum of `targetSpend`) |
| forcedIRA | 0 | 395,109 |
| end IRA | 893,920 | 267,756 |
| terminal after-tax wealth | 684,010 | **202,859** (-481,152) |

The $481k wealth drop is the point, not a regression: that money is now spent instead of stranded.
`bracket`, `fixedpct`, `ordered` and `propwd` 50% come out **byte-identical**; `gk` moves -13,316,
`propwd` 10% -6,110, `fixed` -344,704.

Open questions for that PR: `yr.forcedIRA` and `BracketOverage` are bracket-strategy vocabulary and
would need a name or a separate counter for the baseline family; and every saved `propwd`/`fixed`/
`gk` plan changes, so it needs a version bump and a changelog entry, which is why it is not bundled
with anything else.

**The lesson worth keeping.** A safety net whose gate names the strategies it *serves*
(`isBracketStrategy`) silently excludes everything added later. The comment at `:1696-1701` states a
justification for each exclusion, which is the right instinct, but nobody re-tested the
justification — "already draws IRA for spending" was true and irrelevant, because *sizing* that draw
against pre-tax income is what fails. Suite context: 189 tests green with this defect live, because
every non-bracket fixture has taxable buffers deep enough to hide it.

---

---

## A lookup that returned 0 for "no limit" made the flagship strategy inert in 21 states (2026-08-04, v11.1447)

Found while checking a different question — whether flipping `isBracketStrategy` off would clip
spending — so it was never looked for. It had been shipped for as long as the flat-rate states have
been modelled.

**The mechanism.** `findBracketIndex` (`taxengine.js:1006`) returns the highest `i` with
`brackets[i].l * mult <= amount`, or `-1`. `findUpperLimitByAmount` (`:1051`) turned `-1` into
`{limit: 0}`. A **single-row** table `[{l: Infinity, r: 0}]` therefore matched `-1` on *every* lookup,
because `Infinity <= amount` is never true. Multi-row tables only escape because their terminal
`{l: Infinity}` row is never *selected* — it is only ever `nextB`.

**The 0 was overloaded, and that is why it survived review.** The same function's last-bracket path
(`nextB ? … : 0`) uses 0 to mean the opposite thing, "no upper limit". One sentinel, two contradictory
meanings, and the consumers all take the pessimistic reading:
`limit = Math.min(stateLimit, limit)` (`optimizer_core.js:692`) and
`yr.goalLimit = Math.min(fed.limit, state.limit)` (`:1008`).

**Measured across all 38 modelled jurisdictions, before vs after, three strategies:**

| strategy | single-row states changed | graduated states changed |
|---|---|---|
| `bracket` (Fill Bracket) | **21 of 21** | **0 of 17** |
| `propwd` | **21 of 21** | **0 of 17** |
| `minlimit` | 21 of 21 | **17 of 17** |

The 21: AK, AZ, CO, FL, GA, IA, IL, IN, KY, MA, MI, NC, NE, NH, NV, PA, SD, TN, TX, WA, WY — the 9
no-tax states plus 12 flat-rate ones.

Single filer, $600k IRA, $60k goal, Fill Bracket 22%: NV/TX/FL **$465 -> $163,686**, IL
$6,740 -> $163,686, PA $4,047 -> $163,686, AZ $775 -> $151,101. CA ($131,832) and NY ($141,348)
unchanged to the dollar.

**`minlimit` is the one that reaches every state**, because it also clamps with
`yr.IRMAALimit = Math.min(goalLimit, IRMAABracket.limit)` (`:1011`) and the IRMAA table's first
threshold (~$218k MFJ) sits above an ordinary spend goal — so that lookup returned 0 too, in every
state. Single filer above: CA **$0 -> $13,698**, NV **$465 -> $163,686**.

**CORRECTION TO AN EARLIER CLAIM IN THIS SESSION, worth recording because the overstatement was
mine.** "minlimit converts nothing anywhere" is too strong. On a couple aged 66/64 with a $750k IRA
goal it converts $0 in CA both before *and* after — CA's brackets are narrow enough that the state
bracket top binds legitimately. The defensible claim is the mechanism, not a universal outcome: the
IRMAA clamp was zeroed whenever the spend goal sat below the first tier. First measurement of it also
omitted `stratRate`, which zeroes the ceiling for an entirely unrelated reason; a `minlimit` scenario
without a named bracket proves nothing.

**The second failure is worse than the first and would never have been reported as a bug.** With
`goalLimit` at 0, `yr.targetSpend = Math.min(spendGoal, 0)` (`:1232`) for every strategy outside the
bracket/ordered/GK exempt set. `totals.spend` then accumulates `0 + Shortfall` (`:2150`) and goes
**negative**, while the success test `netIncome < targetSpend * 0.99` (`:2204`) can never fail against
a zero target. Measured in NV: total spend **-$649,857 with `success: true`**, against $810,921 and
`success: false` after. A plan that funds nothing reported itself as working.

**The lesson worth keeping.** A sentinel that means "none" and a sentinel that means "unbounded"
cannot be the same value, and 0 is the natural spelling of both. Nothing caught this because every
test fixture in the repo uses `STATEname: 'CA'` — the suite was 148 green tests over a single
jurisdiction, and the bug lives in the other 21.

---

---

## Self-consistent arithmetic is not a correct model, and an invariant can lock in the bug it was meant to catch (2026-07-29, Tax Payment Planner v1.13b9)

Two user-reported defects in one session, both in `taxPaymentPlanner.js`, both sitting under a green suite, both the same shape.

**One.** A $5,000 Roth conversion was told to withhold $24,851 federal (**497%**) and $12,149 state. The gap fill sized conversion withholding entirely off the shortfall and never looked at the conversion: `shortfall * share * fedFrac`, where `share` was that IRA's share of total *conversions*. It looked proportional, so it read as reasonable. Nothing bounded it by what the distribution could physically carry. Withholding comes out of the distribution; 100% of the gross is the ceiling.

**Two.** With 25k of draws and a 10k conversion against a 72k liability, the displayed Plan A and Plan C paid 35k and scheduled **no estimated tax at all**. Cause, written in the code:

```js
// Baseline and planC are comparison plans — skip quarterly estimates so the
// summary.shortfall accurately reflects uncovered IRA-draw gap for invariant checks.
if (shortfall > 0 && !isBaseline && !isPlanC) {
```

The `_baseline` and `_planC` variants are not scratch work. They are rendered as the displayed Plan C and Plan A, complete action lists a user is meant to follow. Their estimates were suppressed so an old test could read the withholding gap off `summary.totalCovered`.

**Why 26 tests never caught either.** The suite had a coverage invariant, `totalCovered + shortfall === totalTaxDue`. It passed throughout both bugs.

- For the 497% case it passed because the arithmetic *was* self-consistent. $37,000 of withholding plus $0 of shortfall does equal $37,000 of tax. It simply was not a thing that can happen.
- For the underpayment case it passed **because of** the bug: `covered + shortfall` only summed to the liability while the estimates were missing. Adding them made it double-count and the test went red. The invariant had been written against the broken behavior, so it could never have flagged it.

**Two distinct failure modes worth naming.** A consistency check confirms the books balance; it says nothing about whether the quantities are possible. And a test whose assertion depends on an internal convenience will defend that convenience, not the user-facing behavior.

**What replaced them.** Property tests over grids, asserting things that must be true of the world rather than of the arithmetic: withholding never exceeds the conversion (36 cells; reports 42 violations against the pre-fix engine), and every displayed plan pays 100% of the liability to within $1 (40 scenarios x 3 plans = 120 checks; reports 58 of 104 underpaying pre-fix). The old invariant was restated on the correct decomposition, `withholding + shortfall === tax`, since `totalCovered` now legitimately includes estimates.

A third defect fell out of writing the $1 assertion: each installment was rounded independently, so a schedule could drift several dollars off target (72001 and 66999 both observed and both previously dismissed as harmless). `splitExact()` gives the last installment the remainder.

**Rule:** when an invariant survives a bug report, suspect the invariant. Ask what it would look like if the model were impossible rather than merely unbalanced, and prefer assertions about physical limits (a part cannot exceed its whole, a plan must pay what it owes) over assertions about internal bookkeeping. If a comparison variant is ever rendered to the user, it is not internal and must not be simplified for a test's benefit.

---

## User-facing text can carry a legal claim nobody ever checked (2026-07-29, Tax Payment Planner v1.13b9)

The tool warned, in two action notes and in `README.md`, that the withhold-then-replace maneuver on a Roth conversion was limited to **once every 365 days**. The user suspected this was wrong. It was.

IRC 408(d)(3)(B)'s one-per-12-months limit applies to **IRA-to-IRA** 60-day rollovers. The IRS lists what is excluded and conversions are on the list ("rollovers from traditional IRAs to Roth IRAs (conversions)"), and IR-2014-107 / Ann. 2014-32 adds that conversions "are not subject to the one-per-year limit and **are disregarded in applying the limit to other rollovers**". So it is repeatable per conversion, in the same year, in both IRAs, and it does not consume the one ordinary rollover.

The claim had propagated into engine *behavior*, not just prose: a policy comment justified draw-first withholding as avoiding "unnecessary 60-day cash rollovers" (a scarcity argument for a thing that is not scarce), December conversion withholding was skipped outright, and the restore deadline was capped at Dec 22.

**Two neighbouring rules the same review surfaced, both load-bearing and both previously unmodeled:**

- **IRC 6654(g)(1)** is why the whole withholding strategy works: withholding is "deemed paid on each due date" in equal parts regardless of when it happened. A December withholding cures a Q1 shortfall; a December *estimate* does not. This is also the strongest remedy when a user is already late (see TPP-2 in `task_plan.md`).
- **IRC 7503** shifts a deadline landing on a weekend or holiday to the next business day. The tool printed raw statutory dates and compared them to today, so it could flag an installment past due while the real deadline was still ahead. 13 collisions in the next 8 years.

**A precision that generic advice gets wrong.** Sources commonly say the withheld amount "becomes taxable" if you miss the 60 days. For a *conversion* that is misleading: you converted the gross and the whole gross is taxable this year either way (replace, and it is all conversion income; do not, and it is conversion income plus an ordinary distribution — same total). Income tax does not change. What you lose is the Roth space permanently, the 10% §72(t) tax under 59½ on the unconverted part, and, if you deposit late anyway, it is not a rollover at all: at best a regular contribution against the annual limit, with anything that does not fit drawing 6% per year under §4973 until corrected. The shipped note says this, and a test asserts it does **not** say "becomes taxable".

**Rule:** treat a legal or tax assertion in user-facing text as unverified until it has a citation attached, and check whether it has leaked into behavior as well as prose. Rules the tool relies on but never names (6654(g) here) are the ones most likely to be silently wrong. The tool now carries a `RULE_CITES` panel so every rule it applies is traceable to a source.

---

## A feature can be fully wired and still do nothing, if nobody populates its input (2026-07-27, v11.1387)

The Optimizer shipped an **Earliest Break Even** entry in its "Optimize for" selector, a `Break Even` column, and `OPTIMIZER_OBJECTIVES.earliestbe` to sort on it. All three were correct. The feature still did nothing, because **`_convBEYear` was only ever set on ⇌ Optimize-Conversions rows** — they were the only rows that re-ran with `computeOC: true`, and `simulate()` computes `totals.convBEYear` solely inside `if (inputs.computeOC && !inputs._cfRun)`. So every swept row fell back to the same `9999` sentinel, the column showed "—" table-wide, and selecting the objective reordered nothing. No error, no empty state, no test failure: a green suite and a rendered column that is honestly reporting "no data" look identical to a working feature.

**Cost was the reason it was never turned on, and the cost was never measured.** Measured now (node, JIT-warmed, 144-variation sweep): 78 ms → 152 ms, **1.96× / +74 ms**; the live 181-row table runs 1337 ms / 1711 runs, inside the 2.5 s budget. The second counterfactual (`excessOC`) fired on **0 of 144** rows and is separately guarded, so the real cost is one extra `simulate()` on converting rows only. **The feature was withheld for a price nobody had checked.**

**Rule:** when a column or a sort option is present but universally empty, treat that as a defect to investigate, not as "this scenario has no data". And when a cost concern is the reason something is off, measure it before accepting it — this one was affordable the whole time.

---

## Two strategy-matching gaps, and why the current plan was invisible (2026-07-27, v11.1387)

Adding the 📍 CURRENT PLAN row surfaced three separate reasons the user's own plan could not appear in the Optimizer, worth separating because only one of them is about the table:

1. **The sweep cannot represent it.** Every swept row forces `convertExcessToRoth: true`, and `runOptimizer` deliberately clears `extraConversionAmount` / `convEndYear` / `convEndMode` off `base` (they would otherwise contaminate every family). Both are correct — but together they mean no swept row is ever the user's plan, even when strategy and parameter match exactly. Measured on a conversions-off plan with a $60k Extra Conversion: current $813,254 vs its swept twin $1,201,165.
2. **`findCurrentStrategyIdx` (MC) silently failed for two families.** Its per-family chain had no branch for `gk` or `ordered`, so both fell through to `return false` and those users got the synthetic "Current Plan" fallback in Stress mode instead of their own strategy. It also ignored `stratIRMAATier`, pairing an IRMAA-ceiling user with a plain bracket row. Now one shared pure `sameStrategySelection()` in core, used by both MC and the Optimizer.
3. **`orderedSeq` never round-tripped.** Third instance of the PF8 bug class: the row recorded no sequence and `loadOptimizerResult` restored none, so clicking "Ordered RIBC" set `strategy: 'ordered'` and left whatever the sidebar had. Fixed by recording a complete `_selection` (from effective `inputs`, never `overrides`) and restoring from it.

**The trap this change nearly walked into:** `currentHash`, the optimizer's result cache key, is computed from the already-stripped `base`, so it is blind to the three conversion fields. Correct for the sweep, wrong the moment a row depends on them — a user changing only their Extra Conversion would get the cached table back with a stale current row. **When you add a row that depends on inputs a cache key deliberately ignores, the key has to change with it.** Verified live: $564,869 → $983,705.

**Rendering gotcha:** the table's row wrappers are `display: contents`, so they have no box and report `offsetHeight` 0. Stacking a second sticky row under the ⚓ baseline required measuring a *cell*, not the wrapper, or the two pinned rows overlap.

---

## "Optimize Conversions found nothing" on the default scenario is correct, and why (2026-07-26, v11.1370)

Investigated the complaint that the Optimizer reports "examined the best 12 strategies and found none where converting more improves the result" on stock default inputs. **The feature is answering correctly.** Everything below was measured against the real engine, not reasoned from the code.

**The pool is fine — PF11's fix holds.** 10 of the 12 selected candidates carry $700k-$1.3M of terminal IRA (gk, fixedpct, ordered, bracket, propwd; only the two `fixed` rows drain to zero). The pool is not selecting away from convertible plans, and running `optimizeConversionAmount` directly on the IRA-heavy rows returns `optConv: 0` on its own. There is no candidate-selection bug here.

**The real lever is the assumed future/heirs rate, and it was invisible.** On a candidate holding $1.29M of terminal IRA: rate 24% → $0; 32% → $0; **40% → $250k converted, +$42,355**; 50% → +$105,620; 65% → +$200,516. The default scenario assumes ~24-30%, which sits below the threshold, so "don't convert" is the honest answer at the user's own assumption. This is what `breakEvenHeirsRate` / `lowestBreakEvenHeirsRate` now surface.

**Conv Savings is actively misleading here, exactly like BETR.** At defaults, conversions cut lifetime tax from $642,042 to $445,062 — a $197k "saving" — while the plan's after-tax score falls from $4,230,494 to $4,084,898. A user reading that column alone would convert and end up worse off. Renamed to `Tax Paid Δ` with a tooltip that leads with the limitation.

**The apparent "conversions help at lower spend" result is a cash-drag artifact, not tax arbitrage.** At spend $100k with Cash Reserve OFF the sweep finds +$20,539. The same scenario with `CashReserve: 0` + DRIP (the recommended settings) finds **$0**. This is the P2 surplus-routing confound resurfacing: with the reserve off, surplus idles at the 3% cash yield, so anything that moves money out of that drag looks like a conversion win. Always control for the reserve setting before concluding a conversion pays.

**Search-shape gap, now fixed.** `optimizeConversionAmount` only ever tested a flat amount applied for the whole plan, so "convert hard for a few years, then stop" was inexpressible and such plans could only be told to convert nothing. `bestTimeLimitedConversion` adds that shape. Measured rescues on candidates the flat sweep left empty: **10 of 12 on a $3.3M-IRA scenario, 5 at a 45% future rate, 5 at 9% growth, 2 at low spend, and 0 on the default scenario** — where nothing to find is, again, the true answer.

---

### Latent engine inconsistency (ROOT-CAUSED AND FIXED 2026-07-26, v11.137f — see below)

A per-year `extraConversionAmount` **array** of `[amount × N years, then 0]` and the equivalent scalar `extraConversionAmount` + `convEndYear` + `convEndMode:'extra'` produce **identical per-year conversion dollars but different simulations**. Measured on the default scenario at $87,500 for 5 years: opening-year `RMDwd` 16,620.92 (array) vs 15,771.24 (scalar+stop-year), diverging from log row 0, with `finalNW` 679,867 vs 639,182. The array path also reported time-limited conversion "gains" that vanish under the scalar form. Resolution below.

---

## A predicate must read its input through the same accessor the behavior uses (2026-07-26, v11.137f)

The divergence above was **one expression**, `optimizer_core.js:868`, the year-0 half of the Early(Conv)/Late(Spend) withdrawal-timing rule:

```js
const _stratImpliesConversion = inputs.strategy === 'bracket' || inputs.strategy === 'aca' || (inputs.extraConversionAmount ?? 0) > 0;
```

Two independent defects in it:

1. **Not array-safe.** `[87500, 87500, …] > 0` coerces the array to the string `"87500,87500,…"` → `NaN > 0` → **false**. A multi-element array never trips the trigger, so an array-driven plan ran year 0 with 11 months of pre-withdrawal growth instead of 1, moving the RMD basis and every downstream balance. A *single*-element array coerces to a number and accidentally works, which is part of why this survived.
2. **Ignores suppression.** A scalar `> 0` claims "converting" even when year 0's conversion is zeroed by `convEndYear`, `_cfSuppressConversions` or `_cfSuppressConversionsFromYear`.

Measured before the fix (OC fixture, $87,500/yr):

| run | year-0 timing | year-0 conv | finalNW |
|---|---|---|---|
| scalar full | Early(Conv) | 59,235 | 1,565,702 |
| array full (should equal it) | **Late(Spend)** | 59,235 | 1,577,361 |
| scalar + `_cfSuppressConversionsFromYear: 0` | **Early(Conv)** | **0** | 1,197,684 |
| true no-conversion (`eca: 0`) | Late(Spend) | 0 | 1,201,283 |
| scalar + `convEndYear: 2020` | **Early(Conv)** | **0** | 1,197,684 |

**Both defects were on the live ⓘ path.** `bestConversionStopYear` cut `mode:'extra'` with a zero-tail array (every cutoff mis-timed) and `mode:'all'` with `_cfSuppressConversionsFromYear` on a still-positive scalar (its `cut === 0` "convert nothing" endpoint mis-timed). Measured on the STOP_BASE fixture: the two modes reported **different gains for the same cutoff** ($59,706 vs $57,549 `gainVsFull`), and `gainVsNone` was overstated by **$8,916** because "converting nothing" was scored as a January-withdrawal year. After the fix both modes return identical numbers, and clicking the suggested year reproduces the searched score to the dollar (browser-verified: promised $17,342,828, actual $17,342,828, in both modes).

**Fix:** one accessor, `_extraConvAmountFor(inputs, y)` — array-or-scalar, zeroed by suppression — used by BOTH `applyExtraConversion` and the timing predicate; the bracket/aca half now also checks `!_convSuppressedThisYear(inputs, 0)`. `bestConversionStopYear` mode `'extra'` cuts via `convEndYear`/`convEndMode` instead of building arrays, so no production path constructs the divergent representation any more.

**The general rule this earns:** *a predicate that gates behavior on an input must read that input through the same accessor the behavior itself uses.* `x > 0` on a field that may be a scalar or an array, and that three flags can suppress, is not one check — it is two silent bugs. Whenever a field has more than one shape or an override path, give it a single named accessor and route every reader through it. A corollary specific to JS: a truthiness/comparison test against a field that *might* be an array fails silently and asymmetrically (single-element arrays coerce and pass, longer ones become `NaN` and fail), so it cannot be caught by spot-checking one fixture.

---

## Analytics reads `document.title` before any body script runs — don't JS-derive `<title>` (2026-07-25, v11.1340)

**The bug:** deriving `<title>` from the changelog's first entry via a `<script>` placed near the changelog (deep in `<body>`) silently broke Google Analytics pageview tagging. `retirement_optimizer.html`'s `gtag('config', 'G-...')` call sits in a `<script>` in `<head>`, lines 4-9, and fires essentially immediately as the page parses — the automatic `page_view` hit captures `document.title` at that moment, which is whatever the static `<title>` tag says at parse time. A body script that rewrites `document.title` later (however early in body order) runs after GA has already queued/sent the hit, so every pageview gets logged under the un-updated title. This is not a race that resolves itself; the ordering is structural (head parses and executes before body).

**Caught by the user from the GA dashboard, not from anything visible on the page itself.** The page looked and worked correctly; there was no console error, no visual glitch, nothing a browser-based verification pass would catch. This is a class of regression that only shows up in an external system days later.

**Fix / rule:** if a value needs to be correct in an analytics/head-level context, it must be **static HTML present at parse time**, not JS-computed, no matter how early in `<body>` the script runs. Anything that wants to avoid duplicating that value can read it back OUT of the static source at runtime (e.g., a UI stat reading `document.title` via regex) — that direction is safe, since by the time ANY body script runs, `<title>`'s static content is already fully available. The unsafe direction is head-level external systems (GA, `<meta>` scrapers, social-preview crawlers that only see the initial HTML) reading a value that a script would only set later.

**General lesson:** before consolidating a duplicated value into "derive it from one source via JS," check who else reads the ORIGINAL value and when. A value read by another `<head>`-level `<script>` (analytics, meta tags) needs to stay static; a value only read by other body-level JS or by a human looking at the rendered page is safe to derive at runtime instead.

---

## Requirements (from optimizer_directions.md)

### High Priority (Next to implement)
- **B:** Fix bracket/IRMAA withdrawal logic (inverted constraint model)
- **H:** Lumpy spending table (one-time expenses per year)
- **A:** Fixed % IRA withdrawal strategy — DONE
- **I:** QCDs (Qualified Charitable Distributions)

### Medium Priority (After core fixes)
- **C:** Scenario comparison (summary table, chart overlay later)
- **P:** Per-account asset mix with historically-based growth rates
- **F:** Monte Carlo analysis — DONE (Session 6, basic GBM)
- **Q:** Variable growth/inflation optimizer (sensitivity grid Mode 1 first)

### Lower Priority (Complex, longer-term)
- **M:** Multi-strategy optimizer (mixed withdrawal methods, 2-phase then 3+)
- **L:** Tax payment optimization — DONE (RetirementTaxPlanner.html)
- **J:** 5-year actionable report — Not needed (L solved this)
- **N:** Quarterly calculation model (optional high-fidelity mode)
- **E:** Tax Analyzer click-through (scope URL format first)
- **G:** Roth conversion timing — DONE (RetirementTaxPlanner.html)

## Research Findings (BootstrapPlan.md)

### Current MC Simulation Limitations
- **Single σ implicitly blends portfolio** — can't separate equity/bond risk
- **Unrealistic returns:** 60%+ single-year returns (historical max ~54%, 1954)
- **Pathological loss runs:** 8+ consecutive losing years (historical max 4, 1929–1932)
- **No serial correlation:** Each year is i.i.d., missing momentum/mean reversion

### Historical Bootstrap Solution (Phase 1)
| Mode | Mechanism | Pros | Cons |
|------|-----------|------|------|
| Simple | Sample one year at a time | Easy, unbiased | Breaks multi-year trends |
| **Block (recommended)** | Draw overlapping 3-year blocks | Preserves serial structure | Slightly more complex |

**Implementation:** ~99 historical S&P returns (1926–2024), ~49 for bonds/intl. Embed as JS constant in `historical_returns.js`.

### Correlated Multi-Asset (Phase 2)
- Use Cholesky decomposition of 2×2 correlation matrix
- Derive per-account return = `stockPct × r_stocks + bondPct × r_bonds`
- Historical parameters: US Equity μ=11% σ=17%, US Bonds μ=5% σ=7%, corr ≈ −0.10 to +0.10

### Regime-Switching Model (Phase 3)
- 2-state Markov: Bull (μ=+14%, σ=11%, P(stay)=0.85), Bear (μ=−8%, σ=22%, P(stay)=0.65)
- Captures market persistence without historical data
- More transparent than bootstrap; easily parameterizable

### Files to Change (BootstrapPlan)
| File | Phase | Change |
|------|-------|--------|
| `montecarlo/prng.js` | 1 | Add `bootstrapScenarioBank()` function |
| `montecarlo/worker.js` | 1,2 | Accept `simulationMode`; call bootstrap or GBM path |
| `montecarlo/mc_controller.js` | 1,2 | Same fallback path |
| `montecarlo/mc_tab.js` | 1 | Add mode toggle to nerd panel |
| `retirement_optimizer_core.js` | 2 | Add per-account `stockPct` inputs |
| `retirement_optimizer.html` | 2 | Asset allocation inputs per account |
| `montecarlo/historical_returns.js` | 1 | New: embed annual return arrays by asset class |

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Bootstrap before correlated multi-asset | Lower risk drop-in, faster to deliver; Phase 7 requires simulate() changes |
| Block bootstrap size=3 | Captures short-term momentum without over-fitting historical sequences |
| Bracket/IRMAA fix first | Unblocks all strategy comparisons; currently strategies break when spend > bracket |
| Binary search all brackets per spend goal (Phase 1) | Finds max feasible spend for each bracket option; greying infeasible options guides user choice |
| Per-account asset mix (P) before multi-asset MC (Phase 7) | P feeds the σ values needed for Phase 7 |
| Mode 1 sensitivity grid before MC integration (Q) | Self-contained, high-value; Mode 2 depends on Phase 2 complete |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| MC simulation unrealistic | Bootstrap Phase 2 solves single-year return caps; Phase 7 solves correlated risk |
| Can't model different allocations per account | P (per-account asset mix) + Phase 7 (correlated returns) solves this |
| Bracket strategies don't work when spend > bracket | Phase 1: Invert constraint logic + binary search shows user max feasible spend per bracket |
| User doesn't know what spend is achievable with a given bracket | Phase 1: `calculateMaxSpendPerBracket()` + UI feedback shows feasible spend; user can adopt it |
| No way to model one-time expenses | Phase 3 (lumpy spending table) solves this |

## Phase 21: BETR Research Notes

**Vanguard formula status:** Not publicly published. Tool at advisors.vanguard.com is advisor-facing black box. No white paper found as of plan date.

**Best public source:** Michael Kitces — [Roth Conversion Analysis: The True Marginal Tax Rate Equivalency Principle](https://www.kitces.com/blog/roth-conversion-analysis-value-calculate-timing-true-marginal-tax-rate-equivalency-principle/). Standard formula:
```
BETR = 1 − t_now × (1 + r_taxable)^n / (1 + r_ira)^n
```
When `r_taxable = r_ira`: BETR = t_now (trivial). Taxable drag (`r_taxable < r_ira`) lowers BETR below current rate — makes conversion advantageous at a lower future rate than intuition suggests.

**Vanguard additions (inferred from tool behavior):** RMD drag (forced IRA distributions compound taxably vs Roth growing tax-free), heir/SECURE Act factor (10-year rule on inherited IRA vs no beneficiary RMDs for Roth), state tax differentials.

**Action before Phase 21 implementation:** Search for any Vanguard methodology paper published since this plan date. If none, implement Kitces standard formula; document the delta from Vanguard's tool.

---

## Resources

- **BootstrapPlan.md** — Detailed plan for MC improvements (Phases 1–3)
- **optimizer_directions.md** — Full feature brainstorm with priority order (A–R)
- **MEMORY.md** — Project state: PR #48 (v11 features), known TODOs: Roth1/Roth2 table columns, survivor SS bug
- **retirement_optimizer.html** — Main UI
- **retirement_optimizer_core.js** — Core simulation engine

## Phase 28: SoRR Research Notes

**Why bootstrap looks rosy:** 500 random paths from 97 years → ~16% of paths happen to start with a bad first-3yr block. The median and even p10 outcome are dominated by the ~84% of paths that started normally. The *tail* is visible in the chart but not front-of-mind. SoRR is specifically about early-retirement bad sequences; equal probability sampling dilutes this.

**Recommended SoRR mitigation (in priority order):**
1. **Bear-Start Mode** — force first block to worst-tercile (hardest directly tests SoRR; every path suffers the bad start). Most direct answer to "I don't see SoRR."
2. **Historical Scenarios** — 1966 (stagflation), 1929 (depression), 2000 (double crash). Deterministic, visually compelling, grounded.
3. **CAPE-adjusted GBM preset** — μ=5% reflects current valuation-based expected returns. More relevant for "what if the next 10 yrs disappoint" than historical bootstrap.

**SoRR magnitude (from literature):** Same 4% WR, 60/40 portfolio, 30yr retirement: 1966 starter runs out ~year 27. Average starter succeeds. Difference is purely sequencing. This is the story Bear-Start mode tells.

**CAPE background:** Shiller CAPE ~35 (2024–2025). Historically, CAPE > 25 predicts median 10yr real annualized equity return ~2–4%. Bootstrap uses 1928–2024 data with CAGR ~10.7% nominal. Gap is ~6–7%. Using bootstrap without CAPE adjustment may overstate expected returns by 2–3%/yr over next decade.

---

## Open Questions

1. **Data years for bootstrap:** Use full history (1926–present) or post-1970 (more relevant)?
2. **Block bootstrap:** Overlap or non-overlap blocks? Overlapping gives more coverage.
3. **Default mode preference:** Bootstrap (more realistic, no tuning) or GBM (faster, transparent) in non-nerd mode?
4. **Asset classes:** Just stocks/bonds, or include international as 3rd class? (MSCI EAFE only post-1970)
5. **v11 features in PR #48:** Which of these priorities are already addressed?
6. **Roth1/Roth2 table columns TODO:** What are these? Check Annual Details implementation.
7. **Survivor SS bug:** What's the issue? Test with spouse scenarios.

## Phase 1 UI Approach: Inline Bracket Feedback (No Modals)

**Design:** Show bracket constraints inline with spend input. User can override; system shows impact.

**Layout:**
```
Bracket:  ◉ Bracket 22% — max $85k
          ○ Bracket 24% — max $72k
          ○ Bracket 32% — max $100k

Spend Goal: [100,000]

Feedback:  Bracket 22% allows up to $85k; you want $100k (gap: -$15k)
           Status: ⚠ Warning (over-spend)
```

**Real-time updates:**
- When user changes spend, recalc max for all brackets, update feedback
- When user picks bracket, show max spend for that bracket
- Status indicator: Green ✓ (feasible), Yellow ⚠ (over-spend but allowed)

**Annual Details impact:**
- Show constraint violations per year: "IRA withdrawal $50k exceeds bracket limit $35k"
- User sees downstream impact in results; can adjust if desired

**Advantage:** No blocking flow, transparent constraints, user agency. Spend or bracket change immediately updates feedback.

## ACA Limit Strategy Constraint

**New finding:** ACA subsidies only apply pre-Medicare (before age 65). At age 65+, Medicare covers health insurance, making ACA limits irrelevant.

**UI Impact:**
- Hide ACA limit strategy option when *both* spouses age 65+
- When mixed ages (one 65+, one younger), handle case-by-case or disable ACA limits
- Don't force ACA limits into multi-strategy optimizer combos for 65+ retirees

**Implementation:**
- Phase 9 (new): Age-gate ACA logic, disable UI option at 65+
- Prerequisite: Phase 1 (bracket fix, withdrawal logic)
- Blocker for: Phase 10 (multi-strategy must skip invalid ACA combos for 65+)

## Visual/Browser Findings
- None yet (no exploration phase done)

---
*Update this file after every 2 view/browser/search operations*

---

## The Break Even diagnostic names a year that is actually ACTIONABLE, not just explanatory (2026-07-21, v11.12fd)

**Scenario** (user-supplied, reproduced and verified in the browser):
`?sg=220k&sc=-1.000&str=bracket&ny=4&sr=IRMAA2&pw=20.000&iwp=5.000&gkg=20.000&gka=10.000&mc=1&fcc=1&eca=33k&ibg=851132&d1=91&i1=3.3m&i2=240k&ro=240k&bk=1m&bb=2e5&dr=1&c1r=65&c2r=65&cbr=100&ca=1e5&cr=25k&ss1=60k&ss2=29k&psa=65&sfp=100.000&g=8.500&div=1.390&inf=4.200&cpi=2.800&cy=3.000&fitr=33.000`

Break Even shows `—`; the ⓘ diagnosis reads, verbatim:
> "Conversions through 2043 would have broken even in 2051. The 2044 conversion ($64,879) is the one that erases the lead for good."

`diagnoseConvBreakEvenFailure` returns `{outcome:'boundary', breakingYear:2044, breakingAmount:64879.09, lastSustainableYear:2043, lastSustainableBEYear:2051, futureIRATaxRateUnset:false}`. Plan runs 2026-2051, 26 conversion years, $1,858,960 converted in total.

**The finding: truncating conversions at exactly the year the diagnostic names produces the best plan of every variant tested.** Measured with `afterTaxNetWorth(terminal, 0.33, capGainsRate)` — a shared heirs rate, so the four are comparable:

| variant | after-tax NW | lifetime tax | converted | end IRA | Break Even |
|---|---|---|---|---|---|
| stop after 2043 (`_cfSuppressConversionsFromYear: 18`) | **$23,192,547** | **$3,367,165** | $1,414,421 | $3.26M | **2051** |
| no conversions at all | $23,161,241 | $4,788,561 | $0 | $9.42M | — |
| no EXTRA conversions (`eca=0`, strategy's own bracket-fill only) | $22,884,593 | $3,482,440 | $1,372,988 | $4.60M | — |
| the plan as configured (all 26 years) | $22,809,307 | $3,601,204 | $1,858,960 | $1.99M | — |

Spend is identical ($8,668,149) across all four, so this is a clean wealth/tax comparison.

Three things follow:

1. **The configured plan is over-converting past the point of harm.** Converting everything is $352k WORSE than converting nothing. Break Even showing `—` was not a display quirk or a strict-rule artifact; it was correctly reporting a real loss.
2. **The diagnostic's boundary year is a decision boundary, not just an explanation.** Stopping there beats the current plan by $383k, beats no-conversions by $31k, and pays the lowest lifetime tax of all four. That is a stronger claim than the feature was built to make — it was built to answer "why is Break Even blank," and it turns out to also answer "where should I stop."
3. **There is no user-facing way to act on it.** The truncation above was done with `_cfSuppressConversionsFromYear`, an internal counterfactual flag. A user reading the diagnosis has no input that says "stop converting after year X" — the closest lever is `extraConversionAmount`, and zeroing it (`noExtra`) is a *worse* plan than stopping at 2043, because it also throws away the good early conversions. **The right knob is a conversion END YEAR, not a smaller amount.**

**Caveats, both load-bearing before generalizing:**
- `lastSustainableBEYear` (2051) is the FINAL year of this plan. Even the winning truncation only breaks even on the last year, so the margin is thin and sensitive to `die1`/growth. A scenario whose best truncation breaks even mid-plan would be a much stronger case; this one is near the edge.
- n=1. This is one scenario with an aggressive 8.5% growth rate and a 33% heirs rate. The mechanism (late conversions convert at a rate at or above the heirs rate, so they subtract) is general, but the size of the effect is not established.

**Follow-up:** see Phase P24 in `task_plan.md`.

---

### The coverage test has to be cumulative

Withholding is credited as if an equal part were paid on each due date [IRC 6654(g)(1)] — a
**uniform** credit. State schedules are not always uniform: California is 30/40/30. So withholding
equal to the full annual requirement can still miss an early date. On 30/40/30, two dates in, a
uniform credit has delivered two thirds while 70% was required. A total-versus-total comparison
returns "covered" and is wrong. `withholdingCoversSchedule()` walks the schedule and compares
cumulative credit against cumulative requirement at each date, with a $1-per-date tolerance to match
`splitExact` rounding.

### Reassurance has to be earned, not inferred

The missed-payment alert branched on `usesIraWithholding` — "is this plan using withholding at
all" — and concluded "No action is required ... penalty-free". A plan can withhold heavily and still
be short: federal 30,702 against 31,500 misses by 798. Meanwhile the same plan's own installments
said "PAST DUE — pay immediately to minimise underpayment penalty", so the tool contradicted itself
inside one plan. The renderer made it worse independently, choosing the green "Calendar Notice" box
from the strategy and the red PAST DUE badge from the date, neither of which knows whether a penalty
accrues.

**Rule:** a claim that no penalty applies is a computation, not a category. Federal and state must be
tested separately, because they routinely disagree — in the scenario above California was covered
while federal was not. Anything that renders an alarm or a reassurance needs a flag set where the
check happened, not a heuristic re-derived at draw time.

---

---

## P28 round 2: Roth-first pays only when it displaces BROKERAGE, and the account mix decides (2026-07-30)

Round 1 left Roth-first with an inconsistent sign (Fill Bracket +$269k, IRA Draw -$137k). Round 2
explains it, fixes it, and answers whether the shipped defaults are a fair place to measure it.
Harness rebuilt as a 5-scenario ladder x 6 families x 7 arms.

### The mechanism, and why the first implementation was half wrong

Roth and Cash are both tax-free to withdraw, so trading one for the other looks free. It is not:
Roth compounds at the growth rate tax-free, while Cash earns `cashYield` and pays tax on the
interest. In the round-1 scenario, IRA Draw 6%'s gap fill only ever touched Cash - $60,541 lifetime,
$0 Brokerage. Roth-first swapped that for $58,000 of Roth and cost **$137,062** of terminal value.
Spending the best asset to preserve the worst.

So the rule is directional:
- displacing a **Brokerage** draw with Roth avoids realizing capital gains -> **gain**
- displacing a **Cash** draw with Roth spends the better asset -> **loss**

`rothGapFill` therefore now takes a position rather than a boolean:
`true`/`fillRothThenCash` (ahead of everything, the literal proposal) or `fillCashThenRoth` (Cash, then Roth, then
Brokerage). The third pass is already Cash-then-Roth, so `fillCashThenRoth` leaves it alone.

**`fillCashThenRoth` never destroys value in any of the 20 comparable cells** (worst case $0), where
`fillRothThenCash` posted -$137,062, -$66,182, -$10,208, -$4,995 and -$2,081. It also wins outright almost
everywhere - round-1 Fill Bracket goes +$269,145 -> **+$466,289**, and round-1 IRA Draw's loss goes
to exactly **$0** because the arm reverts to the control's Cash draw.

Two exceptions, both `Proportional`, both explainable: propwd draws Brokerage in
`planPrimaryWithdrawals` rather than leaving it to the gap fill, so the gap-fill ordering is not its
Brokerage lever. Guyton-Klinger is excluded from the comparison entirely - its guardrails re-cut
spending, so its deltas mix a wealth change with a spending change.

### The account mix decides, and the shipped defaults understate it badly

| scenario | Brokerage share | best family payoff (fillCashThenRoth) |
|---|---|---|
| shipped defaults | 6% | $188,644 |
| defaults x3 (same mix) | 6% | $17,189 |
| round-1 | 23% | $466,289 |
| balanced thirds | 32% | **$1,757,386** |
| brokerage-heavy | 62% | $778,677 |

Mechanism confirmed in the withdrawal columns: at balanced thirds, Fill Bracket's control realizes
**$3,342,257** of capital gains funding its gap; under `fillCashThenRoth` that goes to **$0** and Brokerage
survives. The effect is an order of magnitude larger than at the shipped defaults.

**But it is not monotone in Brokerage share** - it peaks at balanced thirds and falls at 62%,
because the win needs a Brokerage draw to displace AND enough Roth to displace it with, and the
brokerage-heavy scenario holds only $0.6M of Roth. Two candidate shortcuts were scored and both
fail to rank the scenarios: Brokerage share, and `min(Brokerage drawn, Roth held)`. Same conclusion
P24 reached about the stop year - **no heuristic substitutes for running the scenario.**

Also worth flagging: the shipped defaults are a *stressed* plan ($140k spend on a $1.62M portfolio),
so most effects there land as changed spending rather than changed wealth, and those rows are not
like-for-like comparisons. That is a poor place to evaluate any of this.

### "Use Cash" (fundConversionWithCash) compounds with it, and is often harmful alone

For Fill Bracket, cash-funded conversions alone are **negative** in three of five scenarios
(-$218,645 / -$162,569 / -$201,097) - but combined with `fillCashThenRoth` the pair beats the sum of the
parts by +$302,425 (round-1), +$115,058 (thirds), +$158,209 (brokerage-heavy). Most other cells are
merely additive, and Proportional cancels. So "Use Cash" should not be judged on its own.

### Roth-first and convertExcessToRoth are near opposites, not the same thing

They sound alike and are the reverse of each other:

- `convertExcessToRoth` acts in `routeSurplusAndConvert` on the **surplus left after spending** and
  moves IRA -> Roth. It **fills** Roth.
- `rothGapFill` acts in `fillSpendingGap` on the **gap still needed** and moves Roth ->
  spending. It **drains** Roth.

A year has a surplus or a gap, never both, so they cannot even fire in the same year. Counted on
balanced-thirds Fill Bracket over 33 years: Roth received a conversion in 4 years, was drawn for
spending in 28, and **both happened in 0**.

They are not substitutes and not additive either. Against a both-off baseline in that scenario:
`convertExcessToRoth` alone **-$1,095,454**, `fillCashThenRoth` alone **+$784,418**, both together
**+$661,933** - less than Roth-first alone. They interfere.

## convertExcessToRoth loses on its own in 13 of 25 cells (2026-07-30, P28 round 3)

Asked whether the tool's main "should I convert" switch could ever be worse than off. It looks like a
free win: the surplus is after-tax either way, so ON merely routes it to Roth (compounds tax-free at
growth) rather than Cash (`cashYield`, and the interest is taxed). It is not a free win. Measured
across the 5-scenario ladder x 5 families (GK excluded, its guardrails drift the spend):
**ON loses in 13 of 25 cells, worst -$1,095,454.** Two separate causes.

**1. It silently changes withdrawal timing.** Converting sets `rothConv > 1000`, and `beginYear`
reads that to pick the NEXT year's timing: a month-1 draw instead of month-11. So any naive A/B of
this switch compares two different withdrawal schedules on top of the routing difference. Added
`inputs.forceWithdrawTiming` ('early'/'late', default off, no UI) purely so the two can be separated.
Pinning timing to late flips most of the losses into wins, but **5 of the 13 survive** - so timing is
a large part of the raw gap and not all of it.

**2. It starves the Cash buffer, and the gap fill lands on Brokerage instead.** This is the P28
Roth-first mechanism seen from the other side. Cash is the FIRST account `fillSpendingGap` draws;
Roth is the LAST. Routing the surplus into Roth means the Cash buffer is never rebuilt, so later
gaps fall on Brokerage and realize gains. Balanced thirds / Fill Bracket 24%, timing pinned late,
terminal in today's dollars:

| | Roth | Brokerage | spend | lifetime tax | realized LTCG |
|---|---|---|---|---|---|
| OFF | $7,938,152 | **$5,144,518** | $6,600,000 | $964,454 | $2,076,968 |
| ON | $9,742,461 | **$2,537,057** | $6,600,000 | $908,000 | **$3,076,599** |

ON holds $1.80M more Roth and $2.61M less Brokerage, on identical delivered spend and LOWER tax. It
bought the Roth balance by liquidating Brokerage and paying $1.0M more of realized gains.

**The pattern is regime-dependent, not random.** Converting the excess wins where Brokerage is
modest (round-1, 23% Brokerage: +$1,060,370 Reduce, +$1,162,212 Fill Bracket) and loses where Roth
and Brokerage are both large (balanced thirds -$1,095,454, brokerage-heavy -$711,851) - exactly the
regimes where starving the Cash buffer is expensive because there is a lot of Brokerage to be forced
into.

Consequences worth acting on: this is a default-facing switch that can cost more than a million
dollars in plausible account mixes, and part of that cost is a withdrawal-timing side effect the user
cannot see or control. Worth deciding separately whether the early/late rule should key off
conversion at all. Full tables in `research/CONVERSION_ROUTING.md` §7.

---

## The Red X covers 245 tests and misses 260, and three tests are why nobody moved them (2026-08-05, v11.1468)

Measured while answering a user concern: releases are gated on the in-page Red X, so any test that
does not run at page load can be broken and published without anyone noticing. Recorded here so P39
starts from numbers.

**Coverage today.** `optimizer_tests.js` runs at load and drives `#testsFailed`
(`optimizer_tests.js:2187-2194`, `🟢` or `❌ tests failed`). Three suites do not run in the browser
at all: `optimizer_core.test.js` (206), `taxPaymentPlanner.test.js` (32), `doclinks.test.js` (22).

| suite | tests | wall time |
|---|---|---|
| `optimizer_tests.js` | 245 | **55 ms** |
| `optimizer_core.test.js` | 206 | 2466 ms |
| `taxPaymentPlanner.test.js` | 32 | ~320 ms |
| `doclinks.test.js` | 22 | ~10 ms |

**The whole objection rests on three tests.** Per-test instrumentation of the core suite:

| ms | test |
|---|---|
| 1438 | `:2290` `breakEvenHeirsRate: the predicate is monotonic in the rate` |
| 195 | `:2304` `lowestBreakEvenHeirsRate: finds a threshold the best-scoring candidate does not have` |
| 159 | `:2280` `breakEvenHeirsRate: the rate/amount pair it reports is self-consistent` |

That is **1792 ms of 2466, or 73%, in 3 of 206 tests**. Cut at 20 ms: 13 slow tests hold 2223 ms
while **193 tests share 243 ms**. Cut at 100 ms: 3 slow tests hold 1792 ms, **203 share 674 ms**.
All three heavy tests are binary searches over a rate, which is why they dominate. So the framing
"the node suite is too slow to run at page load" is false of the suite and true of three tests.

**The port is cheaper than it looks.** `optimizer_core.js`, `taxengine.js`, `taxPaymentPlanner.js`
and `doclinks.js` **already have dual-mode export guards**, so the sources load in a browser today.
Only the test files are node-bound, through `require()` alone: 4 calls in `optimizer_core.test.js`,
1 in each of the others. The 174 `test(...)` bodies in the core suite need no change.

~~`doclinks.test.js` is the exception and should stay in node: it reads files from disk, which is the
thing it is testing.~~ **FALSE, corrected 2026-08-06.** It reads nothing from disk. Its only I/O is
`require('./doclinks.js')` at `:21`; zero `fs`, zero `__dirname`, zero `readFileSync`. The `.md`
paths inside it are assertion data, never opened. It is the cheapest of the three to port.

**Environment checks:** `requestIdleCallback` and `Worker` are both available, so a deferred
after-paint run is possible without a worker if desired. ~~**No git hooks are installed** - the
repo's `.git/hooks` contains only samples, so there is no existing convention to follow and one must
be chosen (committed `core.hooksPath` directory, or a documented install step).~~ **HALF FALSE,
corrected 2026-08-06.** No hook *files* are installed, true — but a hook *convention* very much
exists: `core.hooksPath` is pinned to an absolute path in `.git/config` and again in every
worktree's `config.worktree` (`extensions.worktreeConfig` is on), and the worktree scope outranks
the repo scope. A committed `core.hooksPath` directory was therefore **not** an available choice; it
would have been silently ignored in every worktree. See the P39 item 1 record in `task_plan.md`.

**The conclusion worth keeping.** The browser badge only helps when someone is looking at it; a
pre-commit hook is what actually stops a breaking change entering history. The badge work is a
confidence restoration, the hook is the guarantee, and they should be judged on that basis rather
than as one task. And whatever stays outside the badge needs a **count assertion** inside it, or
P39 recreates its own problem one tier down - the same shape as P38's lesson, where a gate naming
the strategies it served silently excluded everything added later.

---

---

### 2026-08-10 follow-up — user asked for (b) surplus-fill + (c) harness. Both DONE.

**(c) Harness:** `.test_harnesses/ordered_fill_harness.js` (`node .test_harnesses/ordered_fill_harness.js`).
Q_C proves the restart: on a deficit-early / surplus-later fixture, CBIR drains Cash to $552 in 2026,
skips it while empty 2027-2036, refills it to ~$487k during the SS+RMD window, then RE-DRAWS it in
2052-2053. Since `runOrderedWithdrawal` is one shared stateless function, that proves the yearly restart
for all three sequences (RIBC/BIRC draw Cash last so it doesn't oscillate there - expected, not a gap).
`runOrderedWithdrawal`/`resolveOrderedSeq` are NOT exported, so the proof runs through full `simulate()`
rather than a unit call - deliberately did not widen the public surface for a demo.

**(b) Surplus fill follows draw order** - added an `else if (yr.isOrderedStrategy)` branch in
`routeSurplusAndConvert` (optimizer_core.js, the surplus-landing block ~2063). Banks surplus in whichever
FUNDABLE account (Cash or Brokerage) the sequence draws first; Roth/IRA are contribution-limited so they
are never fill targets. Resolves to: CBIR->Cash (unchanged), RIBC->Brokerage, BIRC->Brokerage. Precedence
is Cyclic > CashReserve > ordered-fill > legacy-all-to-cash, so an explicit Cash Reserve still wins.

Harness before -> after (30yr fixture, TX, deferred SS, rising real spend):
| seq | surplus->Cash | surplus->Brok | totalWealth |
|---|---|---|---|
| CBIR | 368,408 -> 368,408 | 0 -> 0 | 2,534,286 -> 2,534,286 (IDENTICAL) |
| RIBC | 144,368 -> 0 | 0 -> 151,483 | 2,614,172 -> 2,710,331 (+96,159) |
| BIRC | 282,874 -> 0 | 0 -> 322,353 | 2,452,970 -> 2,626,189 (+173,219) |

CBIR byte-identical is the safety signal: anything pinned to the default ordered seq is untouched.
RIBC/BIRC gain because surplus in Brokerage grows at market (5%) not cashYield (3%) AND is drawn earlier.

Verification: node optimizer_core.tests.js 233/233 (incl. the RIBC stranded-IRA characterization @1305
and the buildVariations MC_GOLDEN enumeration - golden pins the row inventory, not dollar amounts, so a
surplus-routing change cannot touch it), TPP 32/32, doclinks 22/22. Browser engine (default UI scenario)
confirms same direction: CBIR toCash>0/toBrok=0, RIBC+BIRC toCash=0/toBrok>0. Console clean.

SHIPPED as PR #164 (branch fix/ordered-surplus-fill off main, commit 9e5ad6f, v11.14dd). User chose
"PR + docs + changelog". Included: engine change, new harness, title/?v= bump to 11.14dd, in-page
changelog `<li>` (data-flag=behavior), optimizer_changelog.md write-up, and the Ordered help text
(retirement_optimizer.html ~L722) now describing the surplus-fill rule. Browser self-test 529/529 green
with ?v=1114dd loaded. .planning/* changes deliberately left out of the code PR.

---

---

## 2026-08-17 — P32c second half: the two Brokerage-exclusion arms, and a preliminary Q2 reading

**Shipped (v11.1582, uncommitted).** Both live in `resolveResidualAndForcedIRA`, default off, no UI:

| Input | Values | What it does |
|---|---|---|
| `thirdPassBrokerage` | `'off'` (default) / `'bounded'` / `'unbounded'` | Brokerage leg in the third pass, drawn after Cash and before the Roth fallback, then re-drawn against whatever residual the realized gains re-open. Cap 6 / 200. Ordered excluded. |
| `forcedIRAAllowBrokerage` | `'off'` (default) / `'brokerageFirst'` | The funding backstop spends Brokerage before forcing IRA above the ceiling. Also widens the loop's break so an empty IRA does not end it while Brokerage remains. |

Gross-up for both mirrors the second-pass gap fill: `capGainsPercentage * (capitalGainsRate + nominalStateTaxAtLimit)`, guarded `?? 0` because non-bracket families never set `nominalStateTaxAtLimit`.

**The counter trap, found by running it.** The first loop had a cap and no progress guard. On the plain
fixed-strategy fixture it burned all 200 passes in 10 separate years while lifetime Brokerage drawn did
not move a dollar and the shortfall changed by $7 over the whole plan: the account was down to dust, each
pass drew a rounding error, and the residual never closed. Read naively that is 10 divergent years, and
P32d would have written up a spiral that is not there. Exit reasons are now counted apart:

- `totals.thirdPassBrokerCapped` — kept needing another pass. **The only spiral evidence.**
- `totals.thirdPassBrokerStalled` — residual stopped improving while Brokerage still had a balance. That
  is the account's own arithmetic, not a spiral.
- `totals.thirdPassBrokerIters` — passes consumed. All three attach lazily, so an off run's `totals`
  keeps today's exact shape and stays byte-identical.

**Preliminary Q2 signal — 8 scenarios, NOT the answer, P32d still has to run properly.**

| Scenario | third-pass iters | capped | stalled | funded yrs off -> tpb | forcedIRA off -> brokerageFirst |
|---|---|---|---|---|---|
| BASE fixed | 10 | 0 | 10 | 12 -> 12 | 253,802 -> 0 (funded 12 -> **7**) |
| low cash / big brok / SS | 56 | 0 | 0 | 15 -> 15 | 233,295 -> 131,780 |
| propwd 6% | 4 | 0 | 0 | 10 -> 10 | 243 -> 0 |
| fixedpct 2% | 40 | 0 | 0 | 9 -> 10 | 118,442 -> 0 |
| minlimit tier 1 | 34 | 0 | 0 | **6 -> 11** | 12,450 -> 0 |
| IRA empties, brok remains | 69 | 0 | 4 | 8 -> 12 | 96,521 -> 0 |
| ordered CBIR | 0 | 0 | 0 | inert (excluded) | inert (excluded) |

Three readings, all provisional:

1. **No year hit the cap anywhere, and bounded is byte-identical to unbounded.** Nothing here supports the
   spiral. It also does not refute it: 8 hand-picked scenarios, one state, zero growth.
2. **The third-pass arm can be worth a lot.** minlimit tier 1 funds 5 more years, IRA-empties funds 4 more.
   That is the exclusion costing real money in exactly the years it was supposed to protect.
3. **`brokerageFirst` is not a free win, and its failure mode is the P32a finding again.** On BASE fixed it
   eliminates all $253,802 of forced IRA and funds **five fewer years** - spending Brokerage early leaves
   none later, the same shape as BIRC drawing Brokerage first and having none left. Any ship decision from
   this arm needs the funded-years column next to the forced-IRA column, never the tax saving alone.

---

### What was wrong before the measurement

`calculateTaxes` has always accepted `propTax` and always computed
`min(stateTax + propTax, saltCap)` against the standard deduction correctly. No caller in
`optimizer_core.js` ever passed it - 0 of 11 call sites - so SALT was state income tax alone in every
simulated year. `Retirement_Projection.html` and `standalone/irmaa_and_rmds.html` are the same. Only
`standalone/IncomeTaxPlanner.html` supplied it. Identical in shape to the `obbaOn`/`saltHigh` defect
this repo already found and guard-tested; the guard did not cover `propTax`.

### A real bug the work exposed: the elevated cap died a year early (P64f)

`taxengine.js` read `saltBaseCap = obbaOn ? (saltHigh ? capHigh : capLow) : capLow`. Both callers
derive `obbaOn` from `SENIOR_DED.sunsetYear` (2028) and `saltHigh` from `SALT.sunsetYear` (2029), so
in tax year **2029** `obbaOn` was already false and the $40,000 cap silently collapsed to $10,000
while the statute still allowed it. `IncomeTaxPlanner.html` says the intent in its own comment - "SALT
elevated cap continues through 2029" - while passing flags that line then ignored. One flag cannot
carry two sunsets. Fixed: `saltHigh` is now the sole gate on both the elevated cap and its phase-down,
`obbaOn` gates only the senior deduction. Worth roughly $424 of federal tax in 2029 for the measured
household, and it affects IncomeTaxPlanner, where users really do enter property tax.

---

### Every third-pass mover is `minlimit`, which is the defect the phase opened with

All 11 are IRMAA Ceiling rows: `capbase/minlimit` 19->23 (CA), 14->23 (NY), 19->24 (TX), at all three
basis fractions. That is precisely the pinned defect in the harness header - `minlimit` stranding
$71,382 across nine years with Brokerage untouched and every other account at zero. Prediction **P6**
(the arm ends the stranding) named the THIRD-PASS arm, and is now scored per arm rather than on the
pooled total - **RIGHT** (9 better / 2 worse), with `brokFirst`'s own 9/88 record printed beside it
as the separate decision it is.

**CORRECTED same day - the sign was read backwards the first time.** This paragraph originally said
the winners "fund more years while *raising* total shortfall", and called it an unresolved trade-off.
`totals.shortfall` accumulates `Math.min(0, netIncome - spendGoal)` (`optimizer_core.js:2310`,
`:2726`), so it is **negative or zero** and a delta of `+$68,786` is that much previously unpaid
spending **now paid**. Confirmed against the engine, not just re-read: on `capbase/minlimit b20 NY
d0` the arm takes unfunded dollars from **$68,792 to $6**, `failedInYear` from **ten years to one**,
and lifetime spend UP by exactly $68,786.

Per-arm unfunded dollars, which is the number the funded-year count could not give:

| arm | $ newly funded | $ newly unfunded |
|---|---|---|
| `bounded` / `unbounded` | **$372,455** | **$1,711** (385 runs, ~$4 each - rounding dust) |
| `brokFirst` | $372,455 | **$27,860,186** |

218:1 for the third-pass arm. The real cost is **terminal wealth** (-$103,847 on that cell), because
the money gets spent rather than left. That is a far easier trade than the one first written down.

The 2 "worse" third-pass rows are trivial: `brokPoor/minlimit` NY, 24->23 funded, shortfall better by
$6, finalNW -$9,108.

---

## P86a audit - every displayed dollar, classified (2026-08-28, three-agent sweep, all file:line verified)

**The rule.** Stocks (balances) deflate by their own date's factor. Accumulated flows are
`SUM(flow_y / factor_y)`. Deflating a nominal running total by one row's factor is wrong and can
make the total FALL (the reported SumAdvisorFees 80,672 -> 79,371 on `?af=0.8&afs=rothira`).

### Engine totals (optimizer_core.js, init :3362)

| field | line | kind | CD twin? |
|---|---|---|---|
| tax | 3105 | flow acc | YES taxCurrentDollars :3109 |
| spend | 3108 | flow acc | YES spendCurrentDollars :3110 |
| advisorFees | 3115 | flow acc | YES advisorFeesCurrentDollars :3116 |
| gross | 3107 | flow acc | no (only used in nominal/nominal ratio) |
| medicare | 3106 | flow acc | no (not displayed as $) |
| rmd | 3111 | flow acc | **no - DEFECT D1** |
| rmdTax | 3113 | flow acc | no (ratio only) |
| qcd | 3114 | flow acc | **no - DEFECT D1** |
| shortfall :3119, forcedIRATotal :2480 | | flow acc | no (not displayed as $) |
| terminal.* :3644-3650, finalNW :3654 | | stocks | UI derives finalNWCurrentDollars (ui:871) - correct idiom for a stock |

Deflator: `sim.inflation`, advanced :3315 AFTER logging, so every log row's `inflationFactor`
(:1191) is the START-of-year price level; consistent with the totals accrual (:3105-3119).
Distinct clocks: cpiRate (statutory), medicareRate, ssFactor, pensionFactor - never deflators.

### The three broken Annual Details running totals

`SumTaxes` (core:1125 <- sim.cumulativeTaxes), `SumAdvisorFees` (core:1081 <-
sim.cumulativeAdvisorFees), `Spendable` (core:1147 <- totals.spend via :3209). All nominal
sums-to-date; the generic renderer (ui:3014-3015) divides EVERY numeric cell by that row's factor.
Right for flows and stocks, wrong for these three. **Counters have zero readers outside the log
builder** (verified whole repo): accrues :2482/:2953, adjusts :2724/:2797/:3028, inits :3385/:3468,
pass-throughs :3207/:3209/:3214 - all removable. Invariant holds today:
`log[y].SumTaxes === SUM(i<=y) log[i].totalTax`.

**Trap:** `spendGoal` and `netIncome` legitimately DECLINE under Current-$ (real value of a nominal
flow). Fix must be a NAMED map, never a monotonicity heuristic.
**Delivered spend from log columns:** `spendGoal + shortfall` (shortfall <= 0 by construction,
core:2570 `Math.min(0, ...)`); matches totals.spend accrual exactly, GK included.

### Summary bar (updateStats ui:3156-3302)

| tile | source | honors CD? |
|---|---|---|
| All Taxes / Spendable / End Wealth / Advisor Fees | CD-twin picks :3158-3160, :3174 | yes |
| **All RMDs + QCD sub-label** | totals.rmd/.qcd unconditional :3189-3196 | **NO - D1** |
| **Advisor /yr sub-label** | nominal fees/yrs :3184-3186 even in CD | **NO** |
| **Break Even (i) dollars** | nominal strings, _fmt :3309, _m :3331 | **NO** (terminal-wealth DIFFS = stocks; terminal-factor deflation correct) |
| Tax Rate, Withdrawal Rate, Funded Yrs | ratios/counts | n/a, correct |

### Optimizer table (getOptimizerColumns ui:1654-1877)

Correct: tax/spend/afterTaxNW/finalIRA/finalRoth + deltas all pick CD twins. **Defects:** `rmd`
column nominal unconditional (:1807-1812); `convSaved` = `_convSavings` (ui:1495, nominal diff of
nominal lifetime taxes) ignores toggle. `spendGoal` column is today's-$ input by definition.
Ranking objectives (core:4143-4182) are FIXED-basis deliberately (mostly Current-$); ranking must
not flip with a display toggle; deterministic runs make nominal-vs-real stock ranking identical
anyway. NOT a defect. `opt-note` "all Spendable identical" reads nominal spend (:2235) - harmless
(same inflation path across rows), leave.

### Monte Carlo

- Survival table: **nominal** medianTax (mc_engine:406 totals.tax) beside **always-real**
  medianSpend (:407 totals.spendCurrentDollars); Final Balance + plan headline nominal always;
  none re-rendered on toggle (updateCurrentDollarsView :894-912 only calls renderMCChart /
  renderStressChart).
- Fan + stress charts deflate by ONE flat cross-path CAGR (`inflationStats.cagr`,
  mc_tab:1871-1876, 2088-2093). Each path's true `inflationFactor` exists inside simulate() and is
  **discarded** at the engine boundary (mc_engine:406-439) - only the rate sequences survive.
- Median-line tooltip (mc_tab:1999-2002) reads raw nominal percentiles under a deflated line;
  trace tooltip (:1998) reads ctx.parsed.y and is right.
- Replay/Main Path: fully correct - re-runs simulate(), all single-plan renderers use the path's
  own inflationFactor and honor the toggle.

### Misc verified

- No CSV export of Annual Details; column visibility NOT persisted by name anywhere (only fold
  state + scenarios in localStorage) - renaming Spendable is safe.
- No shared output money formatter exists; each surface inlines `'$'+Math.round(x).toLocaleString()`.
- Known consumers of the three log keys needing edits: columnCategories ui:2495/:2505/:2539,
  columnGroupDefs :2585+, tooltips :2864/:2866, core.tests P84e :2216-2228, :5914.
- mc_engine IS node-testable (`_mcEngine.runJob`, core.tests:6164+).

---

## P88 - an Extra Roth Conversion never reaches MAGI (2026-08-29, user-raised)

Full write-up in `task_plan.md` under P88. The three things worth carrying without opening it:

1. **`applyExtraConversion` charges the income tax and never updates `yr.tax.MAGI`.** It copies
   `federalTax` and `stateTax` out of its own `calculateTaxes` result (`optimizer_core.js:2832`) and
   copies nothing else. `applyConversionGrossUp` has the same shape (`:3062`). Measured on one
   Fill Bracket 22% plan: logged MAGI is **$211,400 at every one of $0 / $25k / $50k / $100k of
   `extraConversionAmount`**. It does not move at all.
2. **The stale figure is what IRMAA charges.** `growAndSettle` pushes `yr.tax.MAGI` into
   `balance.magiHistory` (`:3139`) and `beginYear` charges off `magiHistory[len-2]` (`:1435`). On
   that plan the engine records `-none-` / $0 where the true $311,400 MAGI earns **Tier 2, $7,166 a
   year**. This is NOT confined to ceiling strategies - Proportional and Ordered use the same
   conversion path and under-report IRMAA identically.
3. **`bracketOverage` is blind twice over.** It is computed at `:2276` and `:2518`, inside the
   withdrawal phases, while `applyExtraConversion` runs at `:3534`. So even a corrected MAGI leaves
   the overage measuring the strategy's own draw only.

Consequence for the Optimizer: `selectConversionCandidates` (`:4122`) deliberately keeps bracket
families and splits `bracket` into `bracket-irmaa` / `bracket-rate` so each gets a champion. Those
`⇌` rows are scored on numbers that omit the IRMAA cost of the conversion being optimized, biasing
`optimizeConversionAmount` toward larger conversions everywhere.

**Do not build P87g before P88.** Sizing conversions against a ceiling is meaningless while the
conversions are invisible to the ceiling's own income measure.

### P88a-e DONE, shipped v11.16a3 (2026-08-29)

Report: `research/EXTRA_CONVERSION_MAGI.md`. Harness:
`.test_harnesses/extraconv_magi_harness.js` (pre-fix numbers recorded inside it, so it scores the
fix itself). M1-M6 all HOLD.

- **Lifetime IRMAA at a $100,000 conversion rose +69% (Fill Bracket 22%), +30% (IRMAA Tier 1), +69%
  (Proportional), +132% (Ordered).** Bracket-agnostic families were under-billed as much or more
  than the ceiling families, so this was never a ceiling problem.
- **The BEFORE column is worse than "too low": IRMAA FELL as the conversion grew**, $1.41M to
  $0.63M. The shrinking IRA lowered later RMDs while the conversion's own cost was never charged, so
  the tool presented a large Roth conversion as a way to REDUCE the Medicare surcharge.
- **The fix is confined.** IRMAA at a $0 conversion is identical to the dollar on both builds for
  all four families; year-0 income tax is unchanged at every size; a 20-cell fingerprint over plans
  using neither conversion path matches exactly.
- **The Optimizer was biased toward larger conversions.** Its GK sweep fixture moved $150,000 ->
  $100,000 once IRMAA was priced. `breakEvenHeirsRate` moved 0.57 -> 0.65 on its fixture: converting
  needs a higher heirs rate now that it carries the surcharge.

Two implementation notes worth keeping:

1. `applyConversionGrossUp` could NOT be fixed by adding its draw to MAGI by hand. Extra IRA income
   raises provisional income, which can push more Social Security into the taxable share, so AGI
   rises by MORE than the draw whenever that share is under its 85% cap. It needs a real recompute.
2. The copied field list is explicit, not an `Object.assign`. The recomputed calc carries
   `IRMAAAnnualCost: 0`, so its `IRMAARate`, `nominalRate` and `totalTax` are wrong for the year.

`P88f` (should the Optimizer skip ceiling families in its conversion search?) is the only item left,
and the GK re-baseline is the evidence it is worth asking. **P88 unblocks `P87g`.**

## P89 - the plan's first year had two definitions (2026-08-29, DONE v11.16a4)

Carry this one because it is a shape, not a one-off: **`startInYear` was computed in two places and
only one of them clamped.** `getInputs()` built it as `max(by1 + startAge, currentYear)` - the
engine's basis - while `bothOnMedicareAtStart` and the ACA warning re-derived `by1 + startAge`
without the clamp. `startAge` is NOT vestigial (my first guess was wrong): it drives the start year
through that clamp, and the clamp was the missing piece.

- Measured over 6,396 combinations: the two answers disagree **22.2%** of the time, **1,423 flips
  one way, 0 the other.** Provable direction - the clamp only moves the year forward, so ages at
  start only rise, so "both on Medicare" only becomes more true. Pinned by a test.
- The unclamped year reached real behavior, not just text: it gates `acaNeverApplies` and
  `acaDisabled`, i.e. whether ACA rows appear in the Optimizer.
- The engine itself was always right - `acaCapLapsed` uses each year's real ages. Only the UI gate
  was on the wrong basis.
- `planFirstYear(by1, startAge, currentYear)` is now the single definition, exported, pure, with
  `currentYear` a parameter so tests can pin it.

**Test-rot note worth reusing:** adding a `currentYear = new Date().getFullYear()` default made
three existing suite call sites time-dependent, including a golden strategy-capture reproduction
that would have broken in a later calendar year with no code change behind it. Any helper that
defaults to "now" needs its test call sites pinned in the same commit.

### P88f DONE - the ceiling rows are worth keeping, and worth marking (2026-08-29)

Report: `research/CONVERSION_SEARCH_CEILINGS.md`. Harness: `.test_harnesses/convopt_ceiling_harness.js`,
270 cells.

The user proposed excluding ceiling families from the Optimizer's conversion search. **Right
instinct, wrong remedy.**

- **The search does not exclude them by itself.** 61 of 180 ceiling cells pick a non-zero
  conversion; production drops only `$0` picks, so those 61 rows reach the table.
- **All 61 breach their own ceiling.** Several in every year they have one - a `Fill Bracket 12%`
  row is over its bracket 33 of 33 years.
- **Excluding costs a median $53,990, up to $1,546,930, and NOT ONE of the 61 gains under $1,000.**
  No marginal rows to discard cheaply, so answer (a) is the expensive one.
- **Shipped answer: mark, do not drop.** `⤴` in the Strategy column, reading `-overageFromConv`
  specifically so it never fires on a row that went over because spending could not be funded.
- **The lever is the SPEND rate, not the heirs rate** (spread 25 vs 3). So a rule keyed on strategy
  family is the wrong shape whichever way the exclusion question is answered.

**Third time this session a prediction needed scoring against an ALTERNATIVE rather than against
zero.** C5's first form asked whether the heirs rate flips the answer at least once; it flips 3 of
60, which would have passed as HOLDS and meant nothing. Same failure as B2 in
`BRACKET_CEILING_BASIS.md` and M1 in `EXTRA_CONVERSION_MAGI.md`. Worth treating as a standing rule:
**a prediction that cannot lose is not a prediction.**

## P91 - the Stress Test's first result is computed on a STALE horizon (2026-08-29)

**Not a regression.** `main` (11.1691) and this branch (11.16a4), staged side by side and given the
same shared URL, BOTH report `8 / 36` on first load and BOTH report `0 / 40` after the stress pass is
re-run against the current plan. `simulate()` is bit-identical between the builds for that plan, and
`buildStressBank` is identical at every plan length and window mode.

**The sequence count is a pure function of (stressCount, plan years, window mode).** Combined mode at
count 20: plan years 20-25 -> 36 sequences; 26 -> 37; 27-28 -> 39; 29 -> 41; 30+ -> 40. So the count
moving 36 -> 40 means the PLAN HORIZON moved, nothing else.

**And it moved because the first run used the wrong one.** `mcPlanYears(getInputs())` returns 36 for
the plan on screen while `_mcResults.years` reads 25 - the horizon of the saved *default* scenario,
applied by `loadScenarioByName('default')` before `loadFromURL()` replaces it.

**The consequence is a flipped verdict, not a cosmetic number.** Same plan, same build, same session:
stale horizon says "runs out of money in 8 of the 36 worst historical periods, typically around
2046"; correct horizon says "survives all 40". A false alarm on the one number that pass exists to
produce.

Two things worth carrying:

- **All three stress entry points read `getInputs()` fresh** (`runMonteCarlo`, the demo pass, and the
  stress-only refresh at `mc_tab.js:815`), so the base is not stale where it is READ. The run is
  being STARTED too early, or its result is not invalidated when the plan then changes. Do not go
  looking for a stale variable.
- **The Monte Carlo controls are in neither the saved scenario nor the share URL**, and `mc_tab.js`
  uses no `localStorage` - so paths, seed, stress count and stress window reset every load and cannot
  be shared. That is the first thing a reader will blame when two runs of "the same plan" disagree,
  and it is NOT the cause here. Recorded so the next investigation does not start there.

### P91 DONE, v11.16a5 - it was a DROPPED REQUEST, not a stale variable

The prediction in the write-up held: all three entry points read `getInputs()` fresh, so nothing was
stale where it was read. **The request itself was thrown away.**

`refreshMCStressOnly` opened with `if (_mcStressRefreshing) return;` and `if (_mcWorkerBusy()) return;`.
Both guards are correct - two in-flight passes would race to render - and both DISCARDED the request
instead of remembering it. The page primes the pass once on load; a share URL or saved scenario lands
while that prime is running; the refresh it asks for hits a guard and is forgotten; nothing asks
again. `mcInputsChanged` cannot recover it: it READS `_lastMCHash` and never writes it, so there is
no retry path anywhere.

**The shape worth carrying: this guard has now caused three bugs, and the first two fixes treated the
wrong half.** `runMonteCarlo` and `cancelMC` both carry comments about clearing `_mcStressRefreshing`
so later refreshes are not frozen out. Both fixed the stuck FLAG. Neither noticed that a request
dropped while the flag was legitimately set is gone for good. **A guard that drops work needs a place
to put the work, not just a reliable way to clear itself.**

Fix: `_mcStressPending` + `_drainStressPending()`, drained on every completion including errors,
flag cleared before re-entry so a failing refresh runs once more rather than spinning.

**Found while fixing, same class:** the FULL sweep was silently stale too. `markMCStale(false)` ran
unconditionally at completion, asserting the result matches the plan on screen. The staleness check
lives in `mcInputsChanged`, which skips it while `_mcResults` is null - exactly the case during load -
so a sweep started against the pre-URL plan finished, CLEARED the banner, and left a 25-year answer
under a 36-year plan with nothing saying so. Now re-checked at completion. The banner's own text was
already correct and had simply never been shown in the case it described.

Verified on the reported URL, fresh load, cache busted: `0 / 40` with stress horizon 36 matching the
plan's 36, where the same load previously gave `8 / 36` on a 25-year horizon. No node test is
possible and the repo already says so at `optimizer_core.tests.js:5446` - mc_tab.js needs a DOM and
is covered in the browser tier.

---

## P94 - `minlimit` is unreachable, and the evidence (2026-08-29)

Measured before proposing removal, because "nobody uses it" is the kind of claim that is usually
wrong:

| surface | result |
|---|---|
| strategy dropdown | 6 options; `minlimit` is not one |
| Optimizer sweep | **0 of 111** families emit it |
| Monte Carlo sweep | **0 of 156** variations emit it |
| `?str=minlimit` URL | **already broken** - select goes blank (`selectedIndex: -1`), `getInputs().strategy` is `""`, plan computes **$0** |
| `sweep_golden.js` | 0 references |
| README / ARCHITECTURE | 0 references |

**The URL result is the one that settles it.** A share link or saved scenario naming `minlimit` does
not silently fall back today - it produces no plan at all. So there are no working plans to migrate,
and removal costs nothing.

**It has drifted out of step with the strategy it shadows.** `_stratImpliesConversion`
(`optimizer_core.js:1339`) lists `'bracket'` and omits `'minlimit'`, so an otherwise identical plan
picks a different year-0 withdrawal month. On the IRMAA-tier path `minlimit` and `bracket` differ in
exactly ONE log column, `timing`, with every money field identical - that is unmaintained code, and
it is the concrete instance.

**Two corrections to my own earlier statements, both from not checking which term of a `min` binds:**

1. I told the user that fixing the ceiling basis (P87b) and the conversion sizing (P87g) would fix
   `Min Limit` being decorative. It would not - `goalLimit` is an independent term and dominates.
2. I then said "a user choosing 24% vs 12% here may be changing nothing." **No user can choose it at
   all.** The finding was real but the framing implied a reachable control.

**The cascade, verified rather than assumed.** `yr.IRMAALimit` has exactly one consumer, so it dies
with the clamp along with `_irmaaEffCpi`, `IRMAABracket`, `_irmaaMargin`, the `IRMAALimit` parameter
(three call sites) and a 15-line comment block. **But `yr.goalLimit` SURVIVES** - it caps
`targetSpend` for non-bracket strategies at `:1749`, and `goalFedBracketLimit.rate` /
`goalStateBracketLimit.rate` set the marginal rates at `:1778`-`:1779`. I nearly wrote that the whole
chain was orphaned; checking is what stopped it.

**Noted, out of scope:** `targetSpend` capping non-bracket strategies at `goalLimit` means
Proportional's spending is silently limited by a tax bracket top.

## 2026-08-29 - P94: what the `minlimit` removal actually measured

**The strategy-enumeration goldens are a removal proof, not just a regression test.** `sweep_golden.js`
was not touched by this change and both `MC_GOLDEN` and `OPT_GOLDEN` still reproduce, which is a
direct measurement that neither the Optimizer sweep nor the Monte Carlo sweep ever emitted
`minlimit`. That is stronger than the 0-of-111 / 0-of-156 counts recorded when the phase was opened,
because it is checked on every run from here on.

**`minlimit` and `bracket` are NOT interchangeable, even on the IRMAA-tier path where the deleted
clamp never executed.** The suite's earlier note said the two differ in one column, `timing`, with
every money field identical. On a fixture that drains every account, that timing difference IS a
money difference: `_stratImpliesConversion` (`optimizer_core.js:1330`) lists `bracket` and never
listed `minlimit`, so year 0 flips from a month-11 withdrawal to a month-1 one, and one year of
growth on one year's draw compounds. Measured on the P32h fixture, thirteen years out: total
stranded 27,529 -> 29,368, Brokerage headline 1,027,282 -> 1,016,150, over the same ten years, worst
single year unmoved. **This is the P28j coupling arriving on its own**, and it is the first
measurement of its size on a real fixture rather than a synthetic one.

**`yr.IRMAALimit` had exactly one consumer and that consumer was the clamp.** Deleting the clamp took
`_irmaaEffCpi`, `IRMAABracket`, `_irmaaMargin`, the field itself, the `IRMAALimit` parameter of
`computeBracketCeiling` and all three call sites' arguments with it. `yr.goalLimit`,
`goalFedBracketLimit` and `goalStateBracketLimit` survive and are load-bearing, as the phase plan
warned: `goalLimit` caps `targetSpend` for non-bracket strategies and the two `.rate` fields set the
marginal rates.

**Correction to the plan's own structural claim:** `computeBracketCeiling` did not go from three
branches to two. Its three branches are IRMAA tier / ACA / federal, and the clamp lived inside the
federal one. The function got shorter, not structurally simpler.

**An unknown value in a `<select>` is silent and total.** `selectedIndex` goes to -1, `.value` reads
`""`, `getInputs().strategy` matches no withdrawal branch, and the plan computes $0 with no message.
Verified before the fix on `?str=minlimit`, and after it on `?str=minlimit` and `?str=totalNonsense`,
both of which now load Proportional Withdraw +% at 20 and a real plan (finalNW $638,557).

**Pre-existing and unrelated, found while verifying: an ACA share link does not round-trip.**
`?str=bracket&sr=aca400` - which is exactly what `buildShareURL` emits for an ACA plan - lands the
ceiling dropdown on `10`, so `stratACAMultiple` reads 0 and the plan loads as Fill Bracket 10%.
Confirmed pre-existing: the P94 diff against `main` touches no `stratRate` code. Opened as P95.

## 2026-08-29 - P92a: which deduction can a ceiling actually use, and what filling costs

**The circularity is not solvable, so the question changes.** A federal bracket top is a
taxable-income threshold and the ceiling built from it is spent as a MAGI ceiling; the gap is the
year's deduction. But the OBBBA senior deduction phases out against federal AGI, which is exactly
what the ceiling is about to determine, so the year's own deduction cannot be known when the ceiling
is placed. The useful question is not "use the right one" but "how wrong is each obtainable one".

Measured over 3,960 plan-years on the P87a grid (`.test_harnesses/ceilded_harness.js`), scored
against `-fedDeduction`, the deduction `calculateTaxes()` actually charged:

| candidate | median | p90 | worst | fails where |
|---|---:|---:|---:|---|
| last year's charged, re-indexed | $0 | $763 | **$35,505** | every filing-status change: an MFJ number carried into a Single year |
| statutory std + age bumps, re-derived | $0 | $4,300 | $6,000 | a second source of truth, and no more accurate for it |
| **ask `calculateTaxes()` twice, at a provisional year** | **$0** | **$0** | $6,000 | only years the plan never reaches its ceiling |

**The second pass is load-bearing and the reason is general.** Asking at the bracket top evaluates
the phase-out about one deduction too low, so the deduction comes back too LARGE and the ceiling
overshoots - $1,338 of taxable income into the next bracket on one plan. Asking again at the ceiling
the first pass implies gives an $80 undershoot. The phase-out rate is 6%, so each pass cuts the
error by that factor and a third is not worth its call. **Any fixed point evaluated at the input
rather than the output has this bias**; it is not specific to deductions.

**Two extra `calculateTaxes()` calls a year cost nothing measurable**: 0.813 ms/sim against 0.820 on
the release before, alternating runs on a 40-year Fill Bracket plan. The engine already makes four to
six a year.

**The shipped cost, measured against `main` on the P87a grid** - 71 clean cells, same delivered
spending both sides: net worth up in 18, down in 49, median **-$47,549**, best +$1,517,175, worst
-$2,589,357. By bracket: 12% **+$157,572**, 22% **-$200,350**, 24% -$12,741. This reproduces P87a's
arm (-$47,092) closely enough to say the arm was measuring the right thing.

**Median conversion change: $0.** P87a section 7's largest finding survives untouched - nothing sizes
a conversion against the ceiling, so the extra headroom becomes IRA-funded spending displacing
Brokerage and Cash draws, not conversion. That gap is still open and is larger than the one just
closed.

**A consequence worth carrying forward, found through a test fixture.** A Fill Bracket ceiling on the
true bracket top drains `STEPUP_BASE`'s IRA to zero by the terminal year, which drops the survivor's
income into the **0% long-term capital-gains band**. An IRC 1014 step-up on gains that would be taxed
at 0% is worth exactly nothing, so `finalNW` and the pre-step-up liquidation value become equal. Two
step-up tests went vacuously false on that alone. A user filling a 22% bracket can reach the same
state, and nothing on screen says the step-up stopped being worth anything.

## 2026-08-29 - P92e: two income ladders, one axis, and what the display was quietly adding

**The display was aging the tax tables by a year that had already happened.** `TAX_DATA_BASE_YEAR`
was hardcoded `2025` in `optimizer_ui.js` while `TAXData.FEDERAL.YEAR` and `TAXData.IRMAA.YEAR` both
declare `2026`, so the Limit dropdown compounded one extra year of CPI over figures already current:
`$217,319` displayed where the engine built the same plan's ceiling on `$211,400`, which is
211,400 x 1.028 to the dollar. The ACA rows were worse by one more year again, compounding
`currentYear - FPL_BASE_YEAR + 1`. **A constant that restates something the data already says will
drift the moment the data moves**; both now derive from the table's own declared year.

**`sim.cpiRate` does NOT open at 1.** It compounds from the table year to the plan's FIRST year, so a
plan starting 2035 logs `-cpiFactor` 1.282 in year 0 and a deduction inflated by the same. Anything
reading a year-0 log field as "table-year dollars" has to divide by that factor. Measured, not
assumed, and it is the difference between a correct cross-ladder conversion and one that is 28% out
for anyone retiring in the future.

**The two ladders can share an axis only after the deduction is added to the federal side.** On MFJ
2026 figures: the 22% bracket ends at $243,600 of total income, IRMAA Tier 1 runs $218,000 to
$274,000, and the 24% bracket ends at $435,750. So **Tier 1 opens inside 22% and closes inside 24%** -
filling it is a 24% decision - and `24% Fed` sits above Tier 3 and above Tier 4's start.

**Sorting the menu on that comparable axis fixes one inversion and creates a worse-looking one.**
`24% Fed - $404k` correctly moves after `IRMAA Tier 3 - $410k`, and `10% Fed - $24.8k` moves between
the $63k and $84k ACA rows, because its MAGI equivalent is $57k. A visible column reading
42k, 52.5k, 63k, 24.8k, 84k reads as a bug on sight, on every load, where the inversion is subtle and
can be stated in words. **A list of numbers on different bases has no ordering that is both correct
and legible**; the choice is which of the two failures to take, and the annotation plus the picture
are what make the legible one honest.

**Two tests broke, both because they read a display string for a number.** The reference-entry checks
recovered `$769,001` out of an option label to prove a one-dollar relationship, which is invisible at
three significant figures. `updateBracketFeedback()` did the same thing for the ceiling it feeds off.
Numbers now travel on a `data-limit` attribute. **A label is a thing to read, not an API.**

**Two formatter bugs that only showed up by running it**, both in code that reads as obviously
correct: carrying a rounded value up into the next unit by recursion never terminates above the
largest unit (stack overflow at a billion), and searching a descending unit table from the end
returns the SMALLEST unit that fits, so a billion formatted as "k". Neither was visible in the
source; both were the first thing a printed table of outputs showed.

## 2026-08-30 - P87c CONFIRMED: a plan leaves exactly 15% of its Social Security unused

**The user rejected a claim of mine and was right, and chasing why turned up a live defect.** I had
repeated P87a's "nothing sizes a conversion against the ceiling" as though it described the
mechanism. It does not: on a Fill Bracket 22% plan with Convert Excess to Roth, MAGI lands on
`BracketTarget` to the dollar and the conversion is its residual after spending ($243,600 ceiling,
$238,179 drawn, $145,721 to spending, **$92,458 converted**). The conversion is governed by the limit,
exactly as the user said. Corrected in the report, the index and the task plan.

**What the challenge exposed.** Looking at that same run properly, the plan reaches its ceiling every
year until 2031 and never again. `short / SSincome` = **0.150000**, minimum equal to maximum, in
every affected year and on every ceiling family:

| ceiling | under-filled years | headroom never used |
|---|---:|---:|
| Fill Bracket 22% | 17 | **$168,500** |
| IRMAA Tier 1 | 11 | $97,380 |
| IRMAA Tier 2 | 5 | $36,054 |

The sizing aggregate subtracts the FULL benefit (`yr.fixedInc`) from the ceiling while at most 85% of
the benefit reaches MAGI, so the untaxed 15% is treated as consuming ceiling it never occupies. **The
same shape as the deduction error P92a fixed** - a quantity on one income basis measured against a
threshold on another - and NOT fixed by it, because this one sits under every ceiling rather than in
the federal ceiling's own value.

**Three arms identify it beyond argument:** remove Social Security and the persistent short vanishes
entirely; claim at 62 and it starts sooner; keep it and it starts in the first year any benefit is
paid.

**Two regimes had to be separated first, and conflating them is what made it look mysterious.** Once
the IRA empties the short jumps to $170k-$390k because there is nothing left to draw. That is not a
defect. The defect is the small persistent short - $2,546 rising to $12,597 - while the IRA still
holds millions. A raw table of shortfalls shows both and looks like noise.

**A wrong statement of mine, corrected:** I said 2031 was before that plan's Social Security started.
It is not - person 2 claims at 67 in 2031. I had checked only person 1, whose benefit starts in 2032.
The 2031 short is the first SS year, not a counter-example, and treating it as one nearly sent this
after the wrong mechanism.

---

## P87c2: three arms, and the exact inversion dominates on every axis  *(2026-08-31)*

`.test_harnesses/ssbasis_arms_harness.js`, same 720-cell grid as `P87c1`, three arms of the research
input `ceilingSSTaxableBasis`:

| arm | under-filled years | headroom never used | breach $ | summed final NW | summed lifetime tax | summed conversions |
|---|---:|---:|---:|---:|---:|---:|
| OFF (today, full benefit) | 1,670 | $16,777,935 | $2,466,897,543 | $9,635,380,505 | $2,195,213,324 | $602,941,620 |
| `flat85` (subtract 0.85 x SS) | 144 | $3,586,302 | $2,452,011,992 | $9,645,177,584 | $2,190,857,792 | $612,592,921 |
| **`exact`** (invert MAGI) | **0** | **$0** | **$2,447,324,881** | **$9,648,225,425** | **$2,189,662,668** | **$613,746,844** |

**There is no trade to make.** `exact` fills every ceiling-bound year to the dollar, and it does so
while breaching LESS than today ($2.4473B against $2.4669B), ending richer, paying less lifetime tax
and converting more. `flat85` recovers 79% of the unused headroom and is strictly safe, so it is a
legitimate fallback - but it leaves $3.59M on the table across the grid for no gain anywhere.

**Why the breach total FALLS when the plan draws MORE.** Same mechanism `P87a` found: voluntary draws
taken inside the ceiling shrink the IRA, so the forced RMDs that later blow through the ceiling are
smaller. The breach column is dominated by those forced years, not by the sizing line, which is what
makes it a useful control here - the fix could not have hidden a new breach behind it.

**Read the year counts as a caveat, not a result.** Ceiling-bound years fall 5,182 -> 5,154 -> 5,124
across the arms, because the filter requires the IRA to still hold money and the fuller draws empty
it marginally sooner in a few cells. The three columns are therefore not over an identical year set.
The direction is unaffected - `exact` reaches zero short on its own year set, and the OFF arm's
$16.8M is measured on the largest set of the three.

**It also closed the `P87c1` loose end.** Six ZERO-regime years carried $213k of short that the SS
term alone did not explain. Under `exact` they land on the ceiling exactly, so the residual was the
same basis error read through a tier where the taxable share is 0 rather than 0.85.

---

## `nonSSIncomeForMAGI`: how often it runs, and what the bisection actually costs  *(2026-08-31, user-challenged)*

The user read `for (let i = 0; i < 60; i++)` and called it lazy. It was. The measurement is worth
keeping because most of it is counter-intuitive.

**HOW OFTEN.** One call site (`optimizer_core.js`, the bracket/IRMAA branch), once per ceiling-bound
year - 36 calls per `simulate()` on the measured scenario.

**HALF OF THEM NEVER ENTER THE LOOP, and on the reported scenario NONE do.** The guard
`if (magiOf(lo) >= magiTarget) return lo` catches every year where the 85% cap binds, because there
`lo = target - 0.85 x SS` IS the answer, exactly: `taxableSS <= 0.85 x SS` always, so
`magiOf(lo) <= magiTarget` always, and with the `>=` test it can only be equal. It cannot overshoot.
Across 14,994 synthetic cases, 50.5% returned before the loop; on the IRMAA Tier 2 scenario, 36 of 36.

**HOW MANY PASSES ARE ACTUALLY NEEDED.** The interval starts at `0.85 x totalSS` and halves. Worst
error over 4,000 sloped-tier cases:

| passes | worst error on N | worst on MAGI |
|---:|---:|---:|
| 16 | $1.94 | $3.58 |
| 18 | $0.48 | $0.88 |
| 20 | $0.12 | $0.22 |
| 24 | $0.008 | $0.014 |

So **18 for dollar accuracy, 20 for half a dollar, 24 for a cent** - against the 60 that shipped.

**CUTTING IT MOVED NO ENGINE RESULT.** At 18 and at 20 passes the ONLY failing assertion in 382 was
this function's own unit test at its `0.01` tolerance. No ceiling-fill test, no breach guard, no
`P32h` pin. That is the distinction to hold on to: a suite failure can be a test's tolerance rather
than a behavior change, and the two demand different responses.

**WHAT SHIPPED: an interval break, not a smaller count.** `hi - lo > 0.005`, capped at 40. A fixed
count silently loses precision as the benefit grows - 20 passes are half a cent on a $40k benefit and
eight cents on a $1M one - where stopping on the interval holds the same accuracy at every size.
Measured after: 21 to 26 passes, median 25, worst error $0.005 on N and $0.009 on MAGI.

**THE SPEED RESULT IS THE SURPRISE, AND IT IS NEARLY NOTHING.** Best of 7 ALTERNATED rounds:
fixed-60 0.253 us/call, fixed-25 0.243, interval 0.243. **Cutting 60 passes to 25 buys 3.8%**, not
the 2.4x the pass count suggests, because the per-call cost is dominated by the bracket lookup, the
closure and the initial `magiOf(lo)` - not by the loop body.

**AND I MISMEASURED IT FIRST.** A single un-alternated run reported the interval version 20% SLOWER.
`feedback_mc_bench_paths` already says to alternate arms and compare minima, and I did not, on a
difference of a few percent. The rule earns its keep on small deltas, which is exactly when it is
tempting to skip.

---

## `strategy: 'schedule'` and the shape of what the engine cannot say  *(2026-09-01, `P103b2`)*

**Codes:** *schedule* = `strategy: 'schedule'`, a per-year decision vector replacing a named rule.
*ordTarget* = that year's ceiling on realized ordinary income, in nominal dollars. *rateBasis* = the
income level the marginal-rate lookups are keyed on. *replay identity* = compile a family's realized
decisions into a schedule, re-run, require agreement to the dollar. *R-P1* = the prediction that a
family is either fully expressible as a schedule or not at all.

Built, tested (suites **389**/61/22, every pre-existing test bit-identical), and measured by
`.test_harnesses/schedule_replay_harness.js`.

**Targets, not dollars, and the engine had already written down why.** From the
`oracleWithdrawalPlan` comment: *"Fractions, not dollars: dollar plans desync from endogenous
taxes/growth."* A per-year dollar withdrawal is chosen against the previous iteration's tax outcome
and taxes are endogenous, so it stops being feasible; an income target is solved inside the year.
**This makes `ordTarget` identical to the control variable `P75`/`P103c` proposed for the unified
search.** The flexible carrier and the search were two plans for one object.

**Replay identity: the ceiling families reproduce themselves exactly.** Fill Bracket 12/22/24% and
IRMAA tier 0/2 all land at **$0** on final net worth and on every year's wealth. IRA Draw,
Proportional, Ordered, Guyton-Klinger and Reduce compile to **zero scheduled years** - their per-year
decision is a quantity, a sequence, or the spend itself.

**`rateBasis` is a real asymmetry the replay surfaced, not a workaround.** IRMAA and ACA ceilings
derive marginal rates at their final limit; a federal bracket ceiling derives them at the STATUTORY
bracket top, before the `P92a` deduction add-back lifts the limit and before the state min pulls it
down. Both correct, and nothing had needed the distinction named until a schedule had to reproduce a
decision exactly. Deriving at the target instead picked the next bracket up: **$0.34 adrift in year
8, compounding to $121 over 33 years.**

**`R-P1` WRONG, and the counterexample is worth more than the prediction.** ACA is partial - 3 of 33
years - because its cap lapses at Medicare eligibility and a lapsed year falls through to baseline
Proportional. An absent schedule entry means "draw nothing voluntarily", which is a different
statement. **The coverage boundary is not ceiling-versus-quantity. It is that the schedule can say
"fill to X" and can say nothing, but cannot say what to do when there is no ceiling.**

**The generalizable lesson, and it is the reason to build a carrier at all.** "The engine is imbued
with specific withdrawal strategies" was an impression until something tried to restate every
strategy in one vocabulary. Replay identity converted it into a list: an income target, a quantity,
a fallback, a sequence. **A representation that must reproduce the thing it replaces is a
measurement instrument, not just plumbing** - it fails loudly and names the missing concept, where a
gap table would have shown a number and no reason.


## The schedule carrier, widened: what four fields bought  *(2026-09-01, `P103b3`)*

**Codes:** as in the `P103b2` section above, plus *iraDraw* = an explicit voluntary IRA withdrawal in
nominal dollars; *gapFill* = which cascade fills a spending shortfall (`cascade` = Cash -> Brokerage
-> Roth, `baseline` = the [40,60] default branch); *scheduleFallback* = what an unscheduled year
means; *convert* = a cap on the surplus reallocated to Roth.

**8 of 11 shipped arms now replay to the dollar**, up from 5. Newly exact: ACA across its mid-plan
lapse, IRA Draw 5%, Reduce 17 yrs. Suites **394**/61/22.

**"Total conversion control" decomposed, and only half of it was missing.** The family conversion is
a pure REALLOCATION of an already-taxed surplus - the IRA dollars were withdrawn and taxed whatever
their destination - so converting less does not withdraw less. **Converting less GROSS was already
solved by `P103b2`**: lower `ordTarget` or `iraDraw`. The genuinely absent lever was the destination,
which `convert` caps. Worth recording because the phase had carried "the engine cannot convert less
than the family rule" as a single hole for weeks, and it was two things with different answers.

**Dollars are safe for a DRAW and not for a SPLIT, which is what the old warning was really about.**
`oracleWithdrawalPlan` refuses dollar plans because a spending draw's size depends on the tax it is
trying to cover - a feedback loop. A voluntary IRA draw ABOVE spending has no such loop and is handed
to the tax passes at face value, exactly as `fixedpct` and `fixed` hand theirs over.

**Three wrong compilers, and the rule that ends them.** Reconstructing the voluntary IRA draw from
logged outcomes failed three times - gross draw ($39,117 short), gross minus RMDs ($191,737 short),
gross again - because downstream the decision is merged with the forced withdrawal, split across
IRA1/IRA2, netted against conversions and adjusted by the shortfall cascade. The fix was to LOG the
decision (`-volIRAwd`, captured at the one point where it is still a decision) rather than infer it -
the same move that produced `rateBasis` one stage earlier. **A carrier compiles from recorded
decisions, not from reconstructed outcomes.** Two independent instances in two stages is enough to
call it a rule.

**One boolean was worth a whole plan.** With every year correctly scheduled, IRA Draw was STILL
$39,117 adrift, because a year-0 schedule entry was read as implying a conversion - and that flips
the withdrawal month from Late to Early for the entire horizon. A ceiling implies a conversion; a
quantity draw does not. Generalizable: **when a replay is right everywhere and wrong by a constant
proportion, look for a whole-plan MODE the fixture sets differently, not for a per-year arithmetic
error.**

**What remains is a coherent boundary rather than a list of leftovers.** The schedule states how much
to take from the IRA - as a ceiling or as a quantity - but not **how to split a spending draw across
accounts** (Proportional, Ordered) and not **what to spend** (Guyton-Klinger). The split is
`oracleWithdrawalPlan`'s job and already exists, but it PREEMPTS the strategy branch instead of
composing with it, so carrying Ordered means using that hook rather than extending this one.
Guyton-Klinger is outside the vocabulary by construction: a schedule takes `spendGoal` as given.

---

## The flat spend fixture was understating every gap by about half  *(2026-09-01, `P103b5c`)*

**Codes:** *flat path* = `spendChange: 0`, the fixture every harness in this study used. *declining
path* = `spendChange: -1%`, roughly what a typical plan does. *gap* = how far the best shipped row
sits below the oracle, in percent of real after-tax net worth.

`oracle_harness.js --full --spendchange -1`, 424,399 sims, 407.9 s, opt-in flag.

**The gap roughly DOUBLES on the realistic path.** Median best-family gap, default basis
**1.58% -> 3.44%**; b20 1.13% -> 3.30%; b80 0.90% -> 3.23%. Max conversions-only gain at default
basis 0.57% -> **9.55%**. Prediction `D-P1` said "widens by more than 0.3pp" and was right by six
times that margin.

**Why, and it is not subtle in hindsight.** A declining spend leaves more wealth in the plan every
year: more balance to manage, more RMD pressure, more conversion room late. None of the shipped rules
knows the spend is falling, so they fall further behind a searcher that does.

**The attribution survives but narrows.** The withdrawal split stays the dominant lever - 27 of 45
cells on both paths - yet conversions nearly double in total value ($2,042,009 -> $3,800,777) while
the split falls ($5,468,972 -> $4,848,706). `D-P2` RIGHT.

**One published headline breaks outright.** "The best flat scalar conversion finds $0 in 45 of 45
cells" was among this study's most-repeated results. On the declining path the flat sweep finds money
in **3 of 45** cells, up to **$86,640**. So "per-year conversion shapes are genuinely inexpressible
to the flat sweep" holds on a flat path and only mostly holds on a realistic one.

**`S3-P4` flips to WRONG.** Backstops were silent in 45/45 cells on the flat path; on the declining
path `brokheavy @6% b20` runs 2 forced-IRA years of 33, over the prediction's 5% threshold.

**The lesson, and it is the third time this session a fixture turned out to be the finding.**
`P103b1` found surplus routing confounding the grid; `P103b5` found spend pinning conflated with
spend flatness; this found the flat path itself worth a factor of two. **A fixture value nobody chose
deliberately is a finding waiting to happen.** The three defaults that did the damage here -
`CashReserve` unset, `spendChange: 0`, one deterministic return path - were all inherited from the
first harness and never revisited. Everything downstream inherited them too.

**Consequence: every other gap number in `PERFECT_FORESIGHT_ORACLE.md` is a flat-path number** and
understates the realistic gap by roughly 2x. Which lever matters survives; the sizes do not. `P103d`
has to re-derive its regime map on the declining path before aiming at anything.

---

## The gap fill funds a Cash- or Roth-funded year twice, and the surplus becomes a Roth conversion nobody asked for  *(2026-09-02, found building `P104b1`)*

**Codes:** *pass 1* = `planPrimaryWithdrawals`, the strategy's own draw. *pass 2* = `fillSpendingGap`,
the shortfall cascade. *pass 3* = `resolveResidualAndForcedIRA`, the tax-residual top-up. *phantom
gap* = the part of pass 2's gap that pass 1 already funded. *live* = the engine at `c67744f` plus
`P104b1`. *fixed* = a scratch copy of it with ONE line changed, used only to size the effect; nothing
on the branch is changed by this entry.

**The mechanism, in one line of code.** Pass 2 sizes its gap as `targetSpend - (possibleIncome -
totalTax)` with `possibleIncome = taxableInc + fixedInc + netWithdrawals.IRA + capitalGains +
BrokerageBasis` (`optimizer_core.js:2583-2587`). IRA and Brokerage draws from pass 1 are in that
sum. Cash and Roth draws are not. So a year that pass 1 funded from Cash or Roth is funded AGAIN in
pass 2, from whatever pass 2's branch draws. Pass 3 counts all four accounts (`incomeAfterGapFill`,
`:2790`) and is right. The Ordered branch's own comment names it - "Cash draws in the main block
don't reduce possibleIncome, causing overdraw + refund loops" (`:2496`, in the tree since at least
the 2026-07-10 rename) - and Ordered sidesteps it by drawing nothing in pass 1 at all. The oracle
weight path (`P51b`) draws in pass 1 with any vector, so it is exposed in full, and so is every
family whose pass-1 order contains Cash: Proportional, Guyton-Klinger and the baseline.

**Traced, not inferred.** BASE, `strategy: 'split'`, `[0, 0, 1, 0]`, year 0: need $36,717; pass 1
draws Cash $36,717 (correct); pass 2 computes a $36,717 gap again, drains the remaining $13,283 of
Cash and spills $29,292 into the IRA; the year-end surplus routine refunds $38,233 to Cash. The
plan ends the year having withdrawn and taxed $29,292 of IRA with $38k of Cash in hand. The oracle's
own `{seq: ['Cash','IRA','Brokerage','Roth']}` entry produces the identical row, which is how the
`P51b` sequence test came to assert `CashWD > 10000` on a $50k balance.

**Where the money goes decides the size.** With Max Conversion on, the over-draw is a surplus and
`convertExcessToRoth` converts it. `defaults3x @6%`, Proportional +0% - a family with no boost that
should convert nothing - converts $7,813, $7,168, $6,195 and $3,480 in its first years on the live
engine and $0 on the fixed one, and its Cash reaches $0 by 2036 where the fixed run still holds
$14,785. The gap also has a REAL part: pass 1 prices IRA tax at the nominal rate, and in that
cell's year 0 the $28,258 gap is about $19k of genuine tax shortfall plus the $9,027 phantom Cash
draw. The fix removes only the phantom part; the real part is pass 2 doing its job.

**Sized on ten cells, real after-tax wealth at the incumbent's `futureIRARate`, spend delivered
identical to the dollar in every cell** (fixture: the replay harness household, the five `P104a`
mixes at 4% and 6%, `CashReserve: 0`, Max Conversion on):

| cell | Proportional +0% (incumbent) | Guyton-Klinger | split `Cash` | split `I4B3C3` |
|---|---|---|---|---|
| defaults @4% | $0 | +$11,359 | -$59,964 | -$34,235 |
| defaults @6% | -$6,743 | +$5,683 | -$42,351 | -$23,480 |
| defaults3x @4% | +$250,059 | +$56,783 | -$157,479 | -$38,540 |
| defaults3x @6% | +$473,338 | -$89,576 | +$114,775 | +$203,295 |
| round1 @4% | +$133,602 | +$94,454 | -$156,592 | -$81,815 |
| round1 @6% | +$322,248 | +$262,214 | +$12,130 | +$77,807 |
| thirds @4% | +$226,308 | +$113,873 | -$92,127 | +$45,823 |
| thirds @6% | +$367,405 | +$203,172 | -$9,334 | +$161,056 |
| brokheavy @4% | +$275,947 | +$100,709 | -$118,083 | +$148,186 |
| brokheavy @6% | +$376,516 | +$274,824 | +$20,259 | +$144,689 |
| **mean** | **+$241,868** (up 8, down 1, same 1) | **+$103,349** (up 9, down 1) | **-$48,876** (up 3, down 7) | **+$60,279** (up 6, down 4) |

Four controls move by exactly $0 in all ten cells: Fill Bracket 22%, IRA Draw 6%, the IRA-only
split and Ordered CBIR - the families whose pass-1 draw never touches Cash or Roth. That is the
signature of the mechanism, not of a fixture.

**The confound this puts on finished work.** `P104a`'s `k=1` winner `Cash` (5 of 10 cells) is
WORSE on the fixed engine in 7 of 10; the involuntary conversion was part of its win. `B4C6` and
`Roth` lose in 7 of 10 as well; the IRA-inclusive blend `I4B3C3` gains in 6. Every Cash- or
Roth-weighted year in `P51`/`P103a`'s oracle descents and every `{prop: true}` entry ran through
the phantom gap, and so did the incumbent row they were measured against, by its Cash share. The
gap numbers in `PERFECT_FORESIGHT_ORACLE.md` are therefore measured on a distorted path in both
arms; the direction of the distortion on the GAP is not known without a re-run.

**Settings change the size, not the mechanism.** Max Conversion off turns the surplus into a Cash
refund and leaves the Brokerage churn (40% of the phantom gap sold every year in the default
branch). The shipped Cash Reserve default (blank, all surplus to Cash) grows the Cash balance and
with it the Cash share of a balance-weighted draw, so the phantom gap GROWS over a plan under the
defaults. Neither is measured here.

**Not fixed on this branch, on purpose.** The correction is one line - credit pass 1's Cash and
Roth draws in pass 2's gap - but it moves every Proportional and Guyton-Klinger plan and every
saved scenario that uses them, which makes it a product decision with a changelog entry, not a
research edit. The pattern the repo already uses for exactly this (`gapFillWeights`,
`thirdPassBrokerage`) is the right one: ship the correction as a research input defaulting to
today's behavior, harness it in `.test_harnesses/`, then flip the default in its own PR with the
golden fixtures regenerated. The `P104b1` test suite pins the defect the way `FUNDING_ARMS` pins
its residuals, so the fix announces itself when it lands.

# Findings & Decisions

## P35n endgame: the Phased tail should be a SEQUENCE, Cash -> Roth -> Brokerage - the PR-5 proportional spec is refuted (2026-08-10)

The endgame bake-off (`.test_harnesses/ENDGAME_RESULTS.md`, 144 cells starting AT the
IRA-target state, couple 75/73, RMDs live) answers the user's tail question, and the answer
inverted the pre-registered expectation (E-P3 decisively WRONG - the wrong prediction is the
output):

**1. Cash -> Roth -> Brokerage (`seq-CRB`, IRA dead-last backstop) wins 88/108 cells; the PR-5
"BALANCED = ['Brokerage','Cash','Roth'] weighted by balance" spec is the WORST candidate**
(median -$222,745 vs CRB, wins 1 cell). Winner is stable on every axis slice (deaths, IRA
level, mix, basis, spend) and conversions-insensitive (36/36 sensitivity cells).

**2. Roth-early is P28 + §1014 composed, not a contradiction of either.** Cash still drains
first (P28's "never displace Cash with Roth" honored). Second position is Roth-vs-Brokerage,
and P28's other half - "Roth pays when it displaces a BROKERAGE draw" - now applies every year
because §1014 (v11.1499) makes HELD brokerage nearly free to heirs while DRAWING it realizes
taxed gains. Draw-cost dominates holding-cost. The P51 oracle's whole-life "Roth tail" was this
same logic gated by mid-life IRA management; the endgame has no IRA lever, so it fires from
year 0. My E-P3 misread the tail shape as "Roth last".

**3. Wealth boundary mapped**: below ~$1.3M endgame totals the 0% LTCG bracket swallows the
Brokerage draw, drawing it is free, and CRB/CBR tie (16/15) - but proportional STILL wins zero.
Robust statement: **sequenced beats proportional at every wealth level; WHICH sequence matters
only above ~$2M**, where realized LTCG is actually taxed.

**4. Per-year cleverness buys little in the tail**: the light oracle beats the best static
sequence by only ~$27k median. A fixed CRB order captures nearly everything expressible. The
gain-aware "flip" arm just imitates CRB (flips land at the scan's earliest allowed k).

**5. Ship-decision caveats recorded with the verdict**: wealth-maximizing at a shared heirs
rate - `taxflex` disagrees by construction (CRB empties Roth); no SECURE 10-yr heir modeling;
one path, CA, aggregate basis. Feeds `P35i` PR 5: the `phasedBalancedFill` arm should be the
sequence, not balance-weights.

## Basis axis (20%/80%): every brokerage conclusion is basis-STABLE in sign, basis-SCALED in size (2026-08-10)

User asked whether the 43-56% basis-fraction band was too narrow to trust. All three grids
rebuilt at basis 20% (highly appreciated) and 80% (mostly contributions); five predictions
pre-registered (B-P1..B-P5), **all five RIGHT** - the first clean sweep of predictions in this
program, which itself says the mechanism is now understood. Numbers in the three results files;
the transferable rules:

**1. Sign is basis-stable, magnitude scales with gain fraction.** Q4's anti-lever verdict
strengthens at b20 (0.20 wins 9/2,467, worst -$540k) and softens-but-holds at b80 (83/2,643,
-$232k). Q5's spendonly advantage: max +$561k at b20 -> +$237k at b80, win share flat
(58/58/56%) - basis bites through MAGNITUDE, not frequency. Rankings (P36): same leader, ACA
still zero-vote, propwd still never top-3, at both extremes (B-P5).

**2. Coexist's best case moves AGAINST intuition: largest gains at HIGH basis** (IRA Draw
+$980k at b80 vs +$649k at b20) - the reclaimed IRA draw is cheapest when the harvest it
displaces carries little gain. Median still negative at every basis (-$39k/-$27k/-$4.8k).

**3. Oracle gap grows with embedded gain** (median best-family gap 4.47% b20 / 4.35% default /
1.83% b80) and conv-only alpha grows OFF the default basis in both directions (max 2.87%
default -> 9.0% b20, 6.45% b80). Propwd min gap stays >2% everywhere - refutation basis-stable.

**4. Coverage now: basis 20-80% swept for the 45-cell grid analyses and the oracle; Q1 ladder
deliberately stays at 50%** (comparability with the pre-fix record). Remaining single-point
axes: household shape/survivor years, state (CA), return path, pension.

## Stage 3 oracle: conversion timing is the real lever, proportional is refuted twice, and cyclic's edge is ROUTING (2026-08-10)

P51 ran end-to-end (`.test_harnesses/ORACLE_RESULTS.md`; harness `oracle_harness.js`, engine
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

## Stage 2 cyclic A/Bs: the harvest top-off is a pre-step-up design, and "money on the table" cuts both ways (2026-08-10)

Two research inputs shipped in the `:1432` harvest branch (`cycleHarvestMode`, `cycleCoexist`),
default off, absent≡off byte-identical + leak-guard + MAGI-tier tests, suite 238/238. A/Bs in
`.test_harnesses/P32_RESULTS.md` (q5/q6). All three S2 predictions WRONG:

**1. "Max the bracket anyway" LOSES post-§1014.** `cycleHarvestMode: 'spendonly'` beats the
shipped maxbracket top-off in the overwhelming majority of 2,514 cyclic pairs (maxbracket wins
4%), gains to +$396k. Since v11.1499 the step-up erases held-to-death gains anyway, so a
0%-bracket harvest buys nothing at death while paying MAGI costs (SS taxation, IRMAA) today. The
top-off was designed before the step-up correction; its rationale no longer holds in-model. Any
default flip is a ship decision for P32h, not this research.

**2. Harvest-year coexist is net-NEGATIVE on median (−0.73%) — the skip was protective.**
`cycleCoexist: 'bracketfill'` makes an arm more itself: aggressive ceilings (Fill Bracket 35%,
IRMAA Tier 4) lose up to −$2.1M because the reclaimed draw-and-convert was the arm's own
value-destroying behavior, and skipping 1-in-N years dampened it. Measured arms (IRA Draw 5-8%)
genuinely gain, up to +$808k. So question B's answer: the table money is real, but blind
reclamation loses; shipping needs arm-aware gating and therefore the axis-property + pinned-test
bar. Frequency (harvest cadence) scales the effect's magnitude in BOTH directions, not its sign.

**3. Mechanism note pinned by test:** with a harvest-year IRA draw > 0, the surplus-conversion
cap (`netWithdrawals.IRA`, :1984-1988) un-zeroes automatically — no second edit was needed to
give harvest years conversions back.

## Stage 1 brokerage scans: the cyclic advantage is half confound, and the nerdknob points the wrong way (2026-08-10)

Full tables: `.test_harnesses/PHASED_RESULTS.md` (P36 round 1) and `.test_harnesses/P32_RESULTS.md`
(Q1 re-run, Q3, Q4). Both run the Optimizer's own 192-arm enumeration over a 45-cell grid (P28
mix ladder x wealth x0.5/1/3 x spend 4/6/8%), UI scoring recipe, shared per-cell heirs rate.
Eight results, several inverting the obvious reading:

**1. "Does cyclic ever win" is YES — but the shipped A/B overstates it two-fold.** Cyclic beats
its own non-cyclic family twin (spend equal within $1) in 26/45 cells with deltas to +$1.9M. A
`CashReserve: 0` control — putting the NON-cyclic arm on reinvest-surplus-to-Brokerage too —
still wins 23/45 but the max delta halves to $891k, and the winner geography flips from IRA-heavy
4% cells to brokerage-heavy x3 cells, mostly [brokerage-first]. Half the headline is the
surplus-cash-drag P2 documented, not harvest value. **Any future cyclic A/B must equalize surplus
routing or it measures the bundle.**

**2. `cycleLTCGTarget: 0.20` is a live ANTI-lever.** It moves 898 of 2,576 cyclic pairs, up to
6.1% of real after-tax NW — and wins only 53. Worst cells lose $380k. Mechanism: harvesting into
the 15% LTCG bracket pays tax today that the terminal IRC 1014 step-up erases at death. P32 Q4's
hypothesis ("a nerdknob is hiding a real lever") is inverted: the gate is protecting users from a
footgun. Default 0.15 confirmed; feeds P32h.

**3. GK's ranking dominance is survivorship + spend drift, not efficiency.** In P36 round 1 GK
famKeys take 178/360 winner votes — but vote-eligible arms fall 160 -> 37 as spend goes 4% -> 8%
(GK cuts spend and survives; fixed-spend arms fail and are ineligible), and GK's delivered spend
drifts +38%/-12% vs a fixed-spend twin. At 4% strain GK takes zero leading votes. Also: on a
smooth deterministic path GK never triggers a guardrail and is bit-identical to the engine
fallback (`propwd 0%`) — several control cells post the same delta for both.

**4. Proportional is never top-3 on `networth`/`balanced` in ANY of 45 cells** (S1-P1a predicted
>=60%, scored WRONG). Overall mean rank 15.9 of 24 famKeys; its one strength is `maxspend` (11.8).
The comparative half of "proportional may be default-optimal" is refuted inside the current menu;
the absolute half waits on P51's gap-to-oracle.

**5. Harvest years leave measurable money on the table** (question B, descriptive): pooled over
successful cyclic rows, 28,390 harvest years drew $4.1M of IRA total while the same arms' IRA-year
mean implies ~$111,700 forgone per harvest year; median row forgoes 57% of its lifetime voluntary
IRA draws. Conversions in harvest years: $8.7k across all 28,390 — empirically confirming the
:1984-1988 cap-to-zero reading. Causal value of reclaiming this = Stage 2's `cycleCoexist` q6().

**6. Q1 re-run on the corrected engine:** baseline 90.4->92.7%, bracket 61.1->62.2%, ordered
44.7->45.8%, cyclic 57.5->56.7%. Never-draw rows still 0/55. Premise refutation stands.

**7. Zero test over the real sweep:** exactly two always-identical pairs — `Fill Bracket 10%` ==
its 💵 clone and `Ordered CBIR` == its 💵 clone (45/45 cells). 118/192 arms never win anywhere,
recorded as a frequency observation, not deletion evidence.

**8. ACA Cliff never wins any objective — by construction** (one-sided ACA pricing prices the cap's
cost, never the subsidy). Do not read it as an efficiency result.

Predictions S1-P1..P4 all scored; three of five sub-claims WRONG — the wrong ones are the output.

## Five things about the basis step-up that will mislead the next reader (2026-08-07)

Measured while building P35f/P35g. Each one inverts an obvious-looking conclusion.

**1. The terminal step-up is worth $0 whenever the final year sits in the 0% capital-gains bracket.**
Its value is `gain x sim.capitalGainsRate`, and `sim.capitalGainsRate` is the LAST YEAR'S LTCG
bracket rate (assigned from `yr.tax.capitalGainsRate` in `optimizer_core.js`). A plan that drains its
IRA and leaves a low-income survivor lands in the 0% bracket, so the correction buys nothing. This is
CORRECT - the old code applied that same 0% haircut - but it means a fixture chosen for "has a big
terminal brokerage" can still measure a zero effect. Anything measuring this needs terminal INCOME,
not just terminal assets. Two fixtures were discarded on this before one worked.

**2. Conversions consume the brokerage, so the step-up accrues almost entirely to the arm that does
NOT convert.** This is the mechanism behind the "one-sided bias" the whole phase rests on, and it is
sharper than expected. On `CONV_BASE` the entire `baselineScoreOf` curve was bit-identical for every
non-zero conversion amount and ONLY the amt=0 point moved, by +$28,551. A converting plan has spent
its brokerage paying conversion tax, so there is no unrealized gain left for IRC 1014 to reach.

**3. The T6 divergence is back, and it was not recoverable by fixture tuning.** `optimizer_core.tests.js`
recorded that the finalNW-vs-baselineScore divergence vanished with the dividend double-credit fix,
that a 64-variant search over six levers failed to reproduce it, and that its regression guard was
therefore lost. The step-up restores it exactly: same shape of mechanism (an asset the no-conversion
arm holds more of, valued at face), a real one this time instead of phantom cash. `finalNW` discounts
the IRA at the run's OWN terminal nominal rate and picks $0; `baselineScore` discounts at the stated
heirs rate and picks $50k. `baselineScore` is the honest measure - the question is what the heirs
net, so the heirs' rate is the right discount. The lost guard is a guard again.

**4. A `_cfRun` completes fully, including anything appended after the loop.** So a post-loop step
added to `simulate()` still runs on the counterfactual, whose `.log` the Break Even block then
differences against the main log - which has NOT reached that code yet. Any future post-loop mutation
must both sit after the BE block AND skip on `inputs._cfRun`, or it silently corrupts the final year
of `convOC` while every test that checks only `convBEYear` keeps passing. Verify by isolation: build
the variant with the step disabled and diff the whole series. Do not verify by reading the code.

**5. Unicode has no same-size half/full circle pair.** At `600 10px sans-serif`, U+25D0 half-circle
inks 9x7 while U+25CF black-circle inks 6x4 - so "full" renders a third SMALLER than "half" and reads
backwards. U+25C9 (fisheye) and U+25D5 (three-quarter) match the half circle at 9x7 but mean the
wrong thing, and the U+25D0..U+25D7 family has no fully-black member. There is nothing to switch to:
glyphs like this must be DRAWN from a shared radius. Measured while at it: a 0.75 outline leaves 42%
less ink on the discriminating side than a 1.25 one, because the outline itself fills the empty half.

Related, found in the same file: the milestone label stagger was `row = i % 3`, indexed by position
in the list rather than position on the axis. Two markers one year apart could collide while two
twenty years apart shared a row harmlessly. Replaced with real pixel-extent testing.

## The release gate exits 0 under node, and dot-directories cannot hold anything a page fetches (2026-08-06)

Two durable facts about this repo's test layout, both measured while costing a proposed
`tests/` move. Recorded because each one silently inverts an obvious-looking decision.

**1. `node optimizer_tests.js` exits 0 having run nothing.** The file is 2197 lines, declares
`function runTests()` at `:3`, and **never calls it**; there is no `module.exports`, and it touches
DOM globals. The browser pages call `runTests()` themselves
(`retirement_optimizer.html:1136`, `standalone/IncomeTaxPlanner.html:1189`).

Why it matters: the pre-commit hook reports success for anything that exits 0
(`.githooks/pre-commit:49-52`). So **any filename glob that sweeps the release gate into a node test
runner produces a permanent, cheerful green on the one file publishing is checked against.** The
gate's odd name (`optimizer_tests.js`, not `optimizer_core.test.js`) is load-bearing information,
not an inconsistency to tidy away. A `*.tests.js` glob is safe only because `_tests.js` does not
match it.

Related doc defect fixed the same day: `.planning/FILE_DIRECTORY.md:68` described this file as an
"Older/legacy in-browser unit test runner", which invites exactly the rename that would break it.

**2. A dot-directory cannot hold anything a served page fetches, and the failure is unobservable
locally.** Jekyll excludes dot-directories; this repo deliberately has no `_config.yml`
(`_includes/head-custom.html:6`) so no `include:` can re-add one, and `.nojekyll` is forbidden
(`ARCHITECTURE.md:376`) because it would 404 every rendered docs URL.

The part that is easy to miss: **`python -m http.server` and `file://` both serve dot-directories.**
So a `.tests/` layout passes every pre-merge check and fails only in production. `.test_harnesses/`
works as a dot-directory *only* because nothing fetches it — every harness is node-run or
console-pasted. The rule is "dot-directory is fine for code nothing fetches", not "dot-directory is
fine".

What a 404 there actually does is silent, not loud: `retirement_optimizer.html:1136` is
`runTests?.();`, and optional-call does **not** guard an *undeclared* identifier, so the missing
script throws `ReferenceError`, aborting the inline block and skipping `runSimulation?.()` at
`:1138`. On `standalone/IncomeTaxPlanner.html` the unguarded `runTests()` at `:1189` skips the
Escape-closes-modal listener at `:1194` and a document click handler at `:1276`. Nothing on screen
says why.

**Also worth keeping: `?v=` cache-busting cannot protect a rename or a move.** It guards stale JS
under fresh HTML; a moved script is the opposite case — fresh JS under stale HTML. A warm tab
requests the old URL until reload. This repo already has a recorded incident of that cache class.

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

## P35 engine survey: ten things about the engine that are not what a reader would assume (2026-08-03)

Read-only survey done while designing the "Phased" strategy (P35). Every item is verified against
code, not against docs or the changelog. Several are traps: the natural implementation lands on the
wrong side of them and produces a plausible-looking wrong answer rather than an error.

**1. `isDeathYear` is the FIRST SINGLE year, not the last MFJ year.** `yr.alive1 = yr.age1 <= inputs.die1`
(`optimizer_core.js:974`), so both spouses are alive through the whole year `age === die`, and
`yr.status` is `'MFJ'` that year (`:986`). The existing `isDeathYear` local (`:1103`) tests
`deceasedAge === deceasedDie + 1` — the year *after*, already `'SGL'`. The engine's own comment at
`:1091-1092` states the derivation. **Anything wanting "the last married-filing-jointly year" needs
`age === die`, one year earlier.** Reusing `isDeathYear` for that inverts the feature silently, because
both years exist and both produce numbers. The two need distinct names.

**2. The ACA MAGI cap has no age test.** `computeBracketCeiling`'s ACA branch (`optimizer_core.js:667-676`)
is gated only on `stratACAMultiple > 0`. Select an ACA strategy and the FPL cap is enforced at 65, 80,
95, forever — protecting a subsidy that ended decades earlier. The IRMAA branch immediately above it
(`:653-657`) *does* have an age test; ACA never got one. The UI papers over it rather than fixing it:
rows are suppressed when both spouses start on Medicare (`optimizer_ui.js:824-826`) and flagged
`_isACAUntenable` when either does (`:743-746`).

**3. ACA models the MAGI cap and ZERO subsidy dollars.** Grepped the repo for
`premium|subsidy|healthcare|insurance`: no PTC calculation, no applicable-percentage table, no
second-lowest-cost-silver-plan, no health premium in spend. Breaching the cap costs the plan nothing
but a boolean (`yr.acaBreach`, `:1628`/`:1694`). **Consequence for any comparison: the tool can price
the COST of staying under the cap and not the BENEFIT.** An arm that ignores ACA will always look
better on every metric the tool computes. Say so wherever ACA rows are ranked.

**4. No basis step-up at death exists anywhere.** Grepped `step-?up|stepUp|community property|basis reset|inherit`
— every hit is DRIP reinvestment (`README.md:646, 659`; `optimizer_core.js:1877, 2141`) or a planning
TODO. Basis is a **single aggregate scalar**, `balance.BrokerageBasis` (`:2303`), consumed
proportionally: `basisChange = basis * (withdrawal / balance)` (`:165-183`). No lots, no HIFO, no
specific-ID, no owner attribution — so any step-up is necessarily a joint-tenancy proxy, not a computed
share.

**5. The simulation ends AT the last death year, inclusive. There are zero post-death years.**
`maxYears = max(by1+die1, by2+die2) - currentYear + 1` (`:2316`). In the final iteration the
longer-lived person has `age === die`, so the household is still simulated as living. Terminal value is
one line: `afterTaxWealthOfLogRow` (`:2595-2600`) haircuts the IRA by a flat `futureIRATaxRate`, gives
Roth face value, and haircuts unrealized brokerage gain. **No SECURE Act 10-year inherited-IRA rule
exists** (grepped `SECURE Act|10-year rule|inherited IRA|stretch IRA`; the sole `SECURE` hit is the QCD
limit at `taxengine.js:100`). No heir age, no bracket stacking, no time-value discount.

**6. Survivor spend does not drop.** `yr.targetSpend` (`:1232`) reads `sim.spendGoal`, which advances
only by `spendDelta × inflation` in `endYear` (`:2276-2281`). No reference to `alive1`, `alive2` or
`status` anywhere in `resolveSpendTarget` or `endYear`. The **only** thing that changes on death is the
pension: `yr.pension *= inputs.survivorPct/100` (`:1065`) — and that line sits **only inside the
`if (!yr.alive1)` branch**, not the mirror `else`. The widow's-penalty model in its entirety is: full
household spend retained, one SS benefit lost, 25% of pension lost by default, filing Single.

**7. The Optimizer and Monte Carlo sweep DIFFERENT grids, and neither knows it.** The optimizer's
44-family enumeration is inline in `_runOptimizerNow()` (`optimizer_ui.js:797-896`) — not exported, not
tested, unreachable from node. `buildVariations()` (`optimizer_core.js:3246-3354`) *is* exported but
covers 36 families: **no IRMAA-tier arm, no ACA arm, and IRA Draw capped at 10%** (`:3291-3293`) versus
the optimizer's 20% (`optimizer_ui.js:835-837`). They share `offGridParamFor` and
`sameStrategySelection` so identity cannot drift, but the value lists can and have. No test pins any
row count — the only `buildVariations` assertions are `length > 0` (`optimizer_core.test.js:1781`).

**8. The sweep already exceeds its own run budget, and the overrun is a silent quality reduction.**
Budget is 1,500 runs (`optimizer_ui.js:1043`) and 2.5s (`:730`); the live 181-row table measures
**1,337 ms / 1,711 runs**. `addResult` passes `computeOC: true` on every row (`:730`), so each
converting row costs a second `simulate()`. The overrun is absorbed by shrinking
`bestTimeLimitedConversion`'s candidate cap, **already cut from 12 to 6** for exactly this reason
(`:1043-1049` records 2,216 sims on the default scenario). Nothing surfaces that cut to the user. Any
phase adding sweep arms makes this worse invisibly — the concrete argument for P34's worker and
per-row memo.

**9. `sim.gkPriorReturn` is unreachable from any strategy but GK.** Assigned only inside
`if (inputs.strategy === 'gk')` at `endYear:2276-2277`. Any other strategy wanting a prior-year return
needs its own unconditionally-assigned field. Related and useful: **`'-iraG'` already exists**
(`optimizer_core.js:856`, `(p.gains.IRA1||0) + (p.gains.IRA2||0)`) — per-year IRA earnings are already
computed and already logged under the hidden `-` prefix convention.

**10. The IRA Goal governs half the strategies and the in-app doc says it governs most.**
`yr.iraGoalNominal = inputs.iraBaseGoal * sim.cpiRate` (`:920-921`) and
`yr.curIRA = max(0, IRA1 + IRA2 - iraGoalNominal)` (`:1181`) are computed every year, after RMDs. But
`curIRA` is consulted by only `bracket`/`minlimit`/`aca` (`:1366`) and `fixedpct` (`:1376`); `fixed`
uses its own `reduceFloor` variant (`:1352-1353`); and **`propwd`, `ordered`, `gk` and the baseline
branch ignore the goal entirely.** `retirement_optimizer.html:709` tells the user "most strategies draw
from the IRA only until it reaches this balance" — true of four, false of four.

**Bonus, deferred by the user but recorded:** the ⓘ IRA-Goal suggestion (`optimizer_ui.js:450-494`)
discounts the age-84 target back to today at **`growth`**, while the goal itself is inflated forward by
**`cpiRate`** (`:920`). Two different rates on the same round trip, so the suggested number and the
enforced number do not describe the same purchasing power. It also compares a nominal age-84 RMD
requirement against a today's-dollars spend goal.

### What this means for anything built on this code path

- A "last MFJ year" feature and a "first survivor year" feature are **different years** and need
  different flags. Item 1.
- Releasing the ACA ceiling at 65 has no defined successor: every ACA sweep row sets `stratRate: 0`
  (`optimizer_ui.js:832`), so a fall-through to the federal-bracket branch lands on the **10% bracket,
  tighter than the cap it replaced**. Items 2 and 3.
- With the ceiling released outright, `IRAwd = Math.min(yr.curIRA, iRAbracketRoom)` (`:1366`) collapses
  to `IRAwd = yr.curIRA` — the whole above-goal IRA drains in one year. A real consequence, not a bug,
  but it must be predicted before it is measured.
- Any study of "which strategies never win" must run in node, which means item 7's enumeration has to
  be extracted first, and it must not repeat PF11's failure where one family took every seat.

---

## Two things found while RECORDING the Optimizer sweep, either of which would have produced a wrong golden (2026-08-03, P35 PR 1)

Both surfaced only because the enumeration was captured from a live page rather than read off the
source. Both would have silently corrupted the recording that P35 PR 2 is going to be proved against.

**1. The sweep's result cache is keyed on the inputs and NOT on `NERD_KNOBS`.** `_runOptimizerNow()`
early-returns on `currentHash` (`optimizer_ui.js:692-701`), built from `JSON.stringify(base)` plus the
two checkbox states plus the current plan's conversion fields. The nerdknob is in none of them. So
`setNerdKnob(true)` followed by a re-run hands back the **cached non-nerdknob table** — no ACA family,
no 💵 clones — with no indication anything was skipped. It is also a live (if small) UI defect for the
hidden Documentation-page checkbox, which is the only way to flip the flag without a reload. The
capture recipe works around it by reloading with `?nerdknob` rather than toggling, and by changing a
sidebar field between every other scenario.

**2. The stock scenario can never produce an ACA row, and the reason is not the nerdknob.** Defaults
are `birthyear1: 1960, startAge: 65, birthyear2: 1952`, so `bothOnMedicareAtStart()`
(`optimizer_ui.js:4714`) is true and the ACA family is suppressed at `:824-826` independently of the
flag. A capture taken as "nerdknob on, therefore ACA covered" records 176 rows with zero ACA arms and
looks complete. Getting the family to appear needs a younger start — the golden uses `startAge: 60`
with `birthyear2: 1962`, which yields 48 base rows against the nerdknob run's 44.

Measured base-row counts, which are the numbers the plan file calls "families":

| capture | NERD_KNOBS | Cash | base rows | total | what it pins |
|---|---|---|---|---|---|
| `default` | off | 50k | 44 | 132 | no 💵, no ACA, and `fundConversionWithCash` absent from the overrides entirely |
| `nerdknob` | on | 50k | 44 | 176 | 💵 clones appear; ACA still does not, for reason 2 above |
| `nerdknobACA` | on | 50k | 48 | 192 | the four FPL arms, 200/250/300/400 |
| `nerdknobNoCashOffGrid` | on | 0 | 49 | 147 | Cash 0 kills the 💵 clones; an off-grid IRA Draw 9% is appended LAST, after Guyton-Klinger, not sorted into its family |

MC's `buildVariations()` for comparison: 36 base rows, 108 without Cash and 144 with. The 8-row gap
is the IRMAA-ceiling family (5) plus IRA Draw's 12/15/20% (3), and both sweeps are now pinned so PR 2
cannot quietly collapse them onto one grid.

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

## User-facing text can carry a legal claim nobody ever checked (2026-07-29, Tax Payment Planner v1.13b9)

The tool warned, in two action notes and in `README.md`, that the withhold-then-replace maneuver on a Roth conversion was limited to **once every 365 days**. The user suspected this was wrong. It was.

IRC 408(d)(3)(B)'s one-per-12-months limit applies to **IRA-to-IRA** 60-day rollovers. The IRS lists what is excluded and conversions are on the list ("rollovers from traditional IRAs to Roth IRAs (conversions)"), and IR-2014-107 / Ann. 2014-32 adds that conversions "are not subject to the one-per-year limit and **are disregarded in applying the limit to other rollovers**". So it is repeatable per conversion, in the same year, in both IRAs, and it does not consume the one ordinary rollover.

The claim had propagated into engine *behavior*, not just prose: a policy comment justified draw-first withholding as avoiding "unnecessary 60-day cash rollovers" (a scarcity argument for a thing that is not scarce), December conversion withholding was skipped outright, and the restore deadline was capped at Dec 22.

**Two neighbouring rules the same review surfaced, both load-bearing and both previously unmodeled:**

- **IRC 6654(g)(1)** is why the whole withholding strategy works: withholding is "deemed paid on each due date" in equal parts regardless of when it happened. A December withholding cures a Q1 shortfall; a December *estimate* does not. This is also the strongest remedy when a user is already late (see TPP-2 in `task_plan.md`).
- **IRC 7503** shifts a deadline landing on a weekend or holiday to the next business day. The tool printed raw statutory dates and compared them to today, so it could flag an installment past due while the real deadline was still ahead. 13 collisions in the next 8 years.

**A precision that generic advice gets wrong.** Sources commonly say the withheld amount "becomes taxable" if you miss the 60 days. For a *conversion* that is misleading: you converted the gross and the whole gross is taxable this year either way (replace, and it is all conversion income; do not, and it is conversion income plus an ordinary distribution — same total). Income tax does not change. What you lose is the Roth space permanently, the 10% §72(t) tax under 59½ on the unconverted part, and, if you deposit late anyway, it is not a rollover at all: at best a regular contribution against the annual limit, with anything that does not fit drawing 6% per year under §4973 until corrected. The shipped note says this, and a test asserts it does **not** say "becomes taxable".

**Rule:** treat a legal or tax assertion in user-facing text as unverified until it has a citation attached, and check whether it has leaked into behavior as well as prose. Rules the tool relies on but never names (6654(g) here) are the ones most likely to be silently wrong. The tool now carries a `RULE_CITES` panel so every rule it applies is traceable to a source.

## A feature can be fully wired and still do nothing, if nobody populates its input (2026-07-27, v11.1387)

The Optimizer shipped an **Earliest Break Even** entry in its "Optimize for" selector, a `Break Even` column, and `OPTIMIZER_OBJECTIVES.earliestbe` to sort on it. All three were correct. The feature still did nothing, because **`_convBEYear` was only ever set on ⇌ Optimize-Conversions rows** — they were the only rows that re-ran with `computeOC: true`, and `simulate()` computes `totals.convBEYear` solely inside `if (inputs.computeOC && !inputs._cfRun)`. So every swept row fell back to the same `9999` sentinel, the column showed "—" table-wide, and selecting the objective reordered nothing. No error, no empty state, no test failure: a green suite and a rendered column that is honestly reporting "no data" look identical to a working feature.

**Cost was the reason it was never turned on, and the cost was never measured.** Measured now (node, JIT-warmed, 144-variation sweep): 78 ms → 152 ms, **1.96× / +74 ms**; the live 181-row table runs 1337 ms / 1711 runs, inside the 2.5 s budget. The second counterfactual (`excessOC`) fired on **0 of 144** rows and is separately guarded, so the real cost is one extra `simulate()` on converting rows only. **The feature was withheld for a price nobody had checked.**

**Rule:** when a column or a sort option is present but universally empty, treat that as a defect to investigate, not as "this scenario has no data". And when a cost concern is the reason something is off, measure it before accepting it — this one was affordable the whole time.

## Two strategy-matching gaps, and why the current plan was invisible (2026-07-27, v11.1387)

Adding the 📍 CURRENT PLAN row surfaced three separate reasons the user's own plan could not appear in the Optimizer, worth separating because only one of them is about the table:

1. **The sweep cannot represent it.** Every swept row forces `convertExcessToRoth: true`, and `runOptimizer` deliberately clears `extraConversionAmount` / `convEndYear` / `convEndMode` off `base` (they would otherwise contaminate every family). Both are correct — but together they mean no swept row is ever the user's plan, even when strategy and parameter match exactly. Measured on a conversions-off plan with a $60k Extra Conversion: current $813,254 vs its swept twin $1,201,165.
2. **`findCurrentStrategyIdx` (MC) silently failed for two families.** Its per-family chain had no branch for `gk` or `ordered`, so both fell through to `return false` and those users got the synthetic "Current Plan" fallback in Stress mode instead of their own strategy. It also ignored `stratIRMAATier`, pairing an IRMAA-ceiling user with a plain bracket row. Now one shared pure `sameStrategySelection()` in core, used by both MC and the Optimizer.
3. **`orderedSeq` never round-tripped.** Third instance of the PF8 bug class: the row recorded no sequence and `loadOptimizerResult` restored none, so clicking "Ordered RIBC" set `strategy: 'ordered'` and left whatever the sidebar had. Fixed by recording a complete `_selection` (from effective `inputs`, never `overrides`) and restoring from it.

**The trap this change nearly walked into:** `currentHash`, the optimizer's result cache key, is computed from the already-stripped `base`, so it is blind to the three conversion fields. Correct for the sweep, wrong the moment a row depends on them — a user changing only their Extra Conversion would get the cached table back with a stale current row. **When you add a row that depends on inputs a cache key deliberately ignores, the key has to change with it.** Verified live: $564,869 → $983,705.

**Rendering gotcha:** the table's row wrappers are `display: contents`, so they have no box and report `offsetHeight` 0. Stacking a second sticky row under the ⚓ baseline required measuring a *cell*, not the wrapper, or the two pinned rows overlap.

## "Optimize Conversions found nothing" on the default scenario is correct, and why (2026-07-26, v11.1370)

Investigated the complaint that the Optimizer reports "examined the best 12 strategies and found none where converting more improves the result" on stock default inputs. **The feature is answering correctly.** Everything below was measured against the real engine, not reasoned from the code.

**The pool is fine — PF11's fix holds.** 10 of the 12 selected candidates carry $700k-$1.3M of terminal IRA (gk, fixedpct, ordered, bracket, propwd; only the two `fixed` rows drain to zero). The pool is not selecting away from convertible plans, and running `optimizeConversionAmount` directly on the IRA-heavy rows returns `optConv: 0` on its own. There is no candidate-selection bug here.

**The real lever is the assumed future/heirs rate, and it was invisible.** On a candidate holding $1.29M of terminal IRA: rate 24% → $0; 32% → $0; **40% → $250k converted, +$42,355**; 50% → +$105,620; 65% → +$200,516. The default scenario assumes ~24-30%, which sits below the threshold, so "don't convert" is the honest answer at the user's own assumption. This is what `breakEvenHeirsRate` / `lowestBreakEvenHeirsRate` now surface.

**Conv Savings is actively misleading here, exactly like BETR.** At defaults, conversions cut lifetime tax from $642,042 to $445,062 — a $197k "saving" — while the plan's after-tax score falls from $4,230,494 to $4,084,898. A user reading that column alone would convert and end up worse off. Renamed to `Tax Paid Δ` with a tooltip that leads with the limitation.

**The apparent "conversions help at lower spend" result is a cash-drag artifact, not tax arbitrage.** At spend $100k with Cash Reserve OFF the sweep finds +$20,539. The same scenario with `CashReserve: 0` + DRIP (the recommended settings) finds **$0**. This is the P2 surplus-routing confound resurfacing: with the reserve off, surplus idles at the 3% cash yield, so anything that moves money out of that drag looks like a conversion win. Always control for the reserve setting before concluding a conversion pays.

**Search-shape gap, now fixed.** `optimizeConversionAmount` only ever tested a flat amount applied for the whole plan, so "convert hard for a few years, then stop" was inexpressible and such plans could only be told to convert nothing. `bestTimeLimitedConversion` adds that shape. Measured rescues on candidates the flat sweep left empty: **10 of 12 on a $3.3M-IRA scenario, 5 at a 45% future rate, 5 at 9% growth, 2 at low spend, and 0 on the default scenario** — where nothing to find is, again, the true answer.

### Two traps this work fell into, both caught only by cross-validating against brute force

1. **A coarse probe grid silently invents wrong answers.** The first `breakEvenHeirsRate` used 8 evenly-spaced conversion amounts across the IRA instead of the real $25k sweep. It reported "never pays up to 75%" for the default scenario (true answer: 48%) and overstated the low-spend threshold as 25% (true: 15%). The paying amounts are small relative to the IRA (~16%), so an even grid steps straight over them. Both errors pushed the reported rate *up*, which would talk a user out of a conversion that does pay. The fix was to use the same $25k grid as the sweep, exiting on the first improvement.
2. **"No IRA left at the end" does NOT mean "no conversion opportunity."** A filter skipping drained-IRA candidates looked obviously safe and lost the right answer on a $3.3M scenario (reported 25% against a true 5%). A plan that spends its IRA down still gains from converting *earlier*, because that moves growth into the Roth — it is not only about a terminal tax bill.

Neither was visible from reading the code or from a green test run; both surfaced only by scoring the fast path against an exhaustive scan on the same fixtures. **Anything that replaces a full sweep with a heuristic grid must be diffed against the sweep it replaces, on several scenarios, before it is trusted.**

### Latent engine inconsistency (ROOT-CAUSED AND FIXED 2026-07-26, v11.137f — see below)

A per-year `extraConversionAmount` **array** of `[amount × N years, then 0]` and the equivalent scalar `extraConversionAmount` + `convEndYear` + `convEndMode:'extra'` produce **identical per-year conversion dollars but different simulations**. Measured on the default scenario at $87,500 for 5 years: opening-year `RMDwd` 16,620.92 (array) vs 15,771.24 (scalar+stop-year), diverging from log row 0, with `finalNW` 679,867 vs 639,182. The array path also reported time-limited conversion "gains" that vanish under the scalar form. Resolution below.

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

### Rate-axis monotonicity (the binary search precondition)

`breakEvenHeirsRate` binary-searches the rate axis, which is only valid because "conversions pay" never switches back off as the assumed rate rises. Measured at 2.5pp steps across default / low-spend / large-IRA / reserve-on / high-growth: monotonic in all five. This is **measured, not assumed** — `nominalTaxRate` is a bracket step function, the same hazard that forced `bestConversionStopYear` to scan linearly. A test pins the property so a future change can't break the search silently.

## Analytics reads `document.title` before any body script runs — don't JS-derive `<title>` (2026-07-25, v11.1340)

**The bug:** deriving `<title>` from the changelog's first entry via a `<script>` placed near the changelog (deep in `<body>`) silently broke Google Analytics pageview tagging. `retirement_optimizer.html`'s `gtag('config', 'G-...')` call sits in a `<script>` in `<head>`, lines 4-9, and fires essentially immediately as the page parses — the automatic `page_view` hit captures `document.title` at that moment, which is whatever the static `<title>` tag says at parse time. A body script that rewrites `document.title` later (however early in body order) runs after GA has already queued/sent the hit, so every pageview gets logged under the un-updated title. This is not a race that resolves itself; the ordering is structural (head parses and executes before body).

**Caught by the user from the GA dashboard, not from anything visible on the page itself.** The page looked and worked correctly; there was no console error, no visual glitch, nothing a browser-based verification pass would catch. This is a class of regression that only shows up in an external system days later.

**Fix / rule:** if a value needs to be correct in an analytics/head-level context, it must be **static HTML present at parse time**, not JS-computed, no matter how early in `<body>` the script runs. Anything that wants to avoid duplicating that value can read it back OUT of the static source at runtime (e.g., a UI stat reading `document.title` via regex) — that direction is safe, since by the time ANY body script runs, `<title>`'s static content is already fully available. The unsafe direction is head-level external systems (GA, `<meta>` scrapers, social-preview crawlers that only see the initial HTML) reading a value that a script would only set later.

**General lesson:** before consolidating a duplicated value into "derive it from one source via JS," check who else reads the ORIGINAL value and when. A value read by another `<head>`-level `<script>` (analytics, meta tags) needs to stay static; a value only read by other body-level JS or by a human looking at the rendered page is safe to derive at runtime instead.

## PF10 Research Notes: Roth conversion mechanics + cash funding (2026-07-16)

**The two conversion mechanisms are structurally different, and conflating them produces wrong designs.** This cost a full discarded design pass, so it's worth stating precisely:
- `routeSurplusAndConvert()`'s `conv1`/`conv2` (the flag formerly named `maxConversion`, now `convertExcessToRoth`) is a **pure reallocation**. The IRA money is already being withdrawn by the spending strategy, its tax is already fully inside `yr.totalTax` regardless of destination, and `yr.surplus.Total` is already an after-tax figure. `conv1`/`conv2` only decides Cash-vs-Roth for the leftover. **Nothing is netted out for tax, so there is no gross/net haircut here and nothing for cash-funding to "cover."**
- `applyExtraConversion()` (the `extraConversionAmount` field) is a **genuinely new withdrawal**. It pulls gross from the IRA that the strategy did not ask for, computes that slice's true marginal tax via its own `calculateTaxes()` call, and credits `gross - tax` to Roth. This is the real gross/net haircut a user sees ($20,000 entered → ~$13,700 landed at a 31% marginal rate).
- **The stale "TAX GAP" comment (`routeSurplusAndConvert`, pre-PF10) misled a planning agent into treating the first as if it were the second.** The comment described a conversion-sizing approximation, not money evaporating to tax. Rewritten in PF10 to say plainly that the path is a reallocation. If you find yourself about to apply gross-up math to `conv1`/`conv2`, stop: trace whether a tax is actually being subtracted first.

**The gross-up formula (user-supplied, verified against the live engine to the dollar).** To make the reallocation path *also* deliver more to Roth, `applyConversionGrossUp()` pulls an ADDITIONAL gross `increase = conversion × t/(1-t)` from the IRA, funds that increment's own tax (`increase × t`) from Cash, and credits the full `increase` to Roth. `t` = the conv1+conv2 slice's true marginal rate. Algebraically `conversion + increase == conversion/(1-t)` (the flat-`t` gross-equivalent), confirmed exactly in-engine. Closed-form and single-shot -- no fixed-point iteration needed, unlike `cfRefundIRA`.

**Shadow-tax calcs come in two directions, and picking the wrong one silently corrupts the result.** Both appear in `optimizer_core.js`:
- **Additive** (`applyExtraConversion`): the slice is NOT yet in `yr.totalTax`, so compute `tax(base + slice) - yr.totalTax`.
- **Subtractive** (`cfRefundIRA`, `attributeIncrementalTaxes`, `applyConversionGrossUp`): the slice IS already inside `yr.totalTax` (it's part of `netWithdrawals.IRA`), so remove it and measure the drop: `yr.totalTax - tax(base - slice)`.
Using the additive shape where the subtractive one belongs compares a baseline that already contains the slice's tax against a shadow that doesn't. **Check which side of `yr.totalTax` your slice is on before copying a nearby `calculateTaxes()` call.**

**Any mechanism that mutates `yr.totalTax` must also publish the income that caused it (`yr._extraIRAIncome`).** A real bug (found only by driving the browser, missed by two planning passes): `applyConversionGrossUp` does `yr.totalTax += taxCost` but its `increase` is applied straight to `balance.IRA1/2` and never enters `yr.netWithdrawals.IRA`. `applyExtraConversion`, running after, isolates its own marginal tax by subtracting `yr.totalTax` -- so it subtracted a baseline containing the gross-up's tax from a shadow calc whose income basis excluded the gross-up's income. Understated itself by ~43% ($3,635 vs. the correct $6,346). Fixed with a shared `yr._extraIRAIncome` accumulator that both mechanisms add to and later consumers include in their basis. **General rule for this engine: `yr.totalTax` and the income basis used to derive it must move together, and phase order determines who has to account for whom.**

**Optimizer row fields must record EFFECTIVE `inputs`, never raw `overrides`.** Two separate instances of this bug class now (PF8 Issue 1, PF10 round-2). `addResult()` does `inputs = Object.assign({}, base, overrides)` -- any flag not explicitly overridden is inherited from the sidebar. Recording `overrides.someFlag` therefore reports `undefined`/`false` for a row whose simulation actually ran with the sidebar's `true`, and `loadOptimizerResult()` then restores a plan that differs from the row the table displayed. **Record `inputs.someFlag`.** Same applies to any label glyph derived from a flag (the ✓ marker had it too).

**Cost intuition is unreliable here; measure before assuming a path is too expensive.** `diagnoseConvBreakEvenFailure` looked like an obvious "on-demand only" candidate (up to k `simulate()` calls, each with an internal counterfactual). Measured worst case (k=25 conversion years, no early exit): **43ms, versus 53ms for one plain `runSimulation()`** -- the truncated runs suppress most conversion work and are individually much cheaper than the full run. It now computes eagerly in `updateStats()`. Conversely `buildVariations()`'s 💵 expansion IS worth gating (`base.Cash > 0`), because Monte Carlo multiplies it by `numPaths` (500 default → ~18,000 extra `simulate()` calls).

**Case-sensitive tooltip lookup silently kills tooltips.** `optimizer_ui.js`'s header tooltip map is keyed by the literal log-record key and looked up as `if (tooltips[key])` -- a case mismatch fails silently, no error, column just has no tooltip. Found `'RothConv'` vs `'rothConv'`; **an audit script comparing the tooltip map's keys against `buildSimYearLogRecord`'s keys immediately found a second one (`'RothG'` vs `'rothG'`)**. Cheap to re-run whenever a log key is added or renamed; both are fixed and the audit now reports zero orphans.

**Moving a control out of `.sidebar` breaks Share silently.** `captureDefaults()`/`buildShareURL()` iterate `.sidebar input, .sidebar select`, but `loadFromURL()` resolves by element id and doesn't care where the element lives. So relocating a URL-shareable control (`optimizeSpend`/`includeConvOpt`, short codes `opt`/`copt`) out of the sidebar makes Share stop EMITTING it while still RESTORING it -- an asymmetric round-trip with no error. Fixed via `SHARE_INPUT_SELECTOR` (sidebar + `#opt-search-options`) plus `data-no-share` for genuinely derived controls. **Check both selectors any time a shareable input moves.** Corollary: flipping a checkbox's markup default (Optimize Conversions → `checked`) inverts which state gets omitted from the URL; verify the non-default state still emits (`copt=0`), or shared links silently re-enable it.

## PF8 Research Notes: Optimizer/single-scenario Break Even discrepancies (2026-07-13)

**`extraConversionAmount` is structurally invisible outside the sweep machinery.** This engine field (flat annual $ IRA-to-Roth conversion) is read by `applyExtraConversion()`/`optimizeConversionAmount()` and set by the Optimizer's Phase-23 sweep and Monte Carlo's baseline pass -- but has zero presence in `retirement_optimizer.html` (no input), `getInputs()` (not read), or `OPT_LONG_TO_SHORT` (not URL-shareable). Any UI path that shows a result computed WITH this field (e.g. the Optimizer's ⇌ rows) but then lets the user "load"/reproduce that result elsewhere silently drops it, since there's nowhere for it to land. Worth checking for this same class of gap if other engine-only fields ever get surfaced in optimizer-only computed values.

**`sim.nominalTaxRate` is a discrete bracket-table step function, not continuous.** It's the `nr` field from `taxengine.js`'s bracket tables (via `calculateProgressive()`/`findUpperLimitByAmount()`), looked up fresh each year based on whichever bracket that year's top marginal dollar falls into. Used to discount an ENTIRE remaining IRA balance in `totalWealth`/`convOC` valuation. Because it's a step function, two simulate() runs with slightly different income trajectories (e.g. an actual run vs. its conversion-suppressed counterfactual) can cross the same bracket boundary in different years, producing a one-year valuation "jump" in their relative comparison that has nothing to do with that specific year's dollar amounts -- pure timing-mismatch noise. This was originally described here as "the same underlying gap" as the pre-existing "TAX GAP" comment in `routeSurplusAndConvert` -- **PF10 disproved that and the comment is now gone** (that path is a pure reallocation with no tax netted out of it; see the PF10 notes above). The step-function noise described in this paragraph is real and independent of that comment. PF6's sustained-crossing Break Even definition already absorbs/suppresses this noise at the stat level (a lone blip surrounded by negative years correctly reports "never breaks even") -- but the per-year convOC column itself can still show this noise, which is fine/expected once understood, not a bug.

**`_convSavings` (realized lifetime tax $ saved) and `convOC`/`convBEYear` (after-tax wealth, deferred-tax-aware) are different metrics that can disagree.** `_convSavings` only sums `totals.tax` actually paid during the simulated horizon; it never reserves for tax still owed on whatever IRA balance a counterfactual/lesser-conversion plan has left standing. `totalWealth`/`convOC` explicitly discount remaining IRA balance by the applicable tax rate every year, so they're the more complete "did this actually pay off" answer. A strategy can look great on Conv Savings while never reaching Break Even. General pattern to watch for in this codebase: any metric summing `totals.tax` alone (realized-only) vs. any metric built from `totalWealth` (after-tax, deferred-liability-aware) are not directly comparable and can point opposite directions.

**Top-N-by-finalNW selection pools are orthogonal to conversion-specific outcomes.** The Optimizer's Phase-23 "top 5 successful strategies" is chosen by each family's BASE (non-extra-conversion) finalNW -- a criterion unrelated to whether THAT family's conversions specifically would break even. A lower-finalNW family could be the true best converter and never get evaluated for it. Relevant if extending Break Even search to a smarter/broader pool later (see task_plan.md Phase PF8 issue 3 tiers).
> **Confirmed empirically 2026-07-16 (PF10), now tracked as PF11.** No longer hypothetical. On a $2M-IRA/$90k-spend scenario the top-5 were all cyclic `fixedpct` rows whose sweep correctly returns `optConv: 0` (extra conversion strictly hurts them: $9,266,756 at $0 → $8,635,273 at $150k), while `propwd` at rank **6** returns **$125,000** and never gets considered. Result: zero ⇌ rows for a plan that genuinely has a good conversion answer. PF10 defaulted Optimize Conversions ON, so this now fires for everyone rather than only for users who opted in.

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

## Phase 22: Guyton-Klinger Research Notes

**Primary sources:** Guyton (2004) "Decision Rules and Portfolio Management for Retirees: Is the 'Safe' Initial Withdrawal Rate Too Safe?", Guyton & Klinger (2006) "Decision Rules and Maximum Initial Withdrawal Rates". Both published in Journal of Financial Planning — accessible.

**Key finding from literature:** GK supports initial WR ~5.2–5.5% with ruin probability similar to 4% static rule, because guardrail adjustments absorb sequence-of-returns risk. The cuts in bad sequences prevent catastrophic depletion.

**Standard guardrail parameters from original paper:** ±20% from IWR triggers ±10% spending adjustment. These are defaults — make configurable.

**Rule ordering matters:** Apply Inflation Rule (skip/apply CPI) *before* guardrail checks. Guardrails check post-inflation-adjusted spend vs current portfolio.

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

## Phase 29: Tax Policy Research Notes

**TCJA Status (updated 2026-06-08):** TCJA was made permanent in 2025 — no automatic sunset. Pre-TCJA rates are NOT the expected near-term scenario. However, Congress can still change rates; fiscal pressure (debt-to-GDP ~120%+) makes future increases plausible. Phase 29 models this as an opt-in hypothetical stress test, not a default assumption. Earliest realistic legislated rate change: 2027+.

**Pre-TCJA brackets (MFJ, 2017 levels, not inflation-adjusted):**
| Rate | Pre-TCJA | Post-TCJA (current) |
|------|----------|---------------------|
| 10%  | $0–$18,650 | $0–$23,200 |
| 15%→12% | $18,650–$75,900 | $23,200–$94,300 |
| 25%→22% | $75,900–$153,100 | $94,300–$201,050 |
| 28%→24% | $153,100–$233,350 | $201,050–$383,900 |
| 33%→32% | $233,350–$416,700 | $383,900–$487,450 |
| 35%  | same | same |
| 39.6%→37% | $416,700+ | $751,600+ |

Note: for implementation, use current inflation-adjusted thresholds but with pre-TCJA *rates* applied (the key change is the rate steps, not the threshold amounts).

**Long-term fiscal pressure:** CBO projects debt-to-GDP reaching ~180% by 2054 under current law. Historical pattern: major revenue increases have come from rate changes (WWII, Korean War). A 0.5%/yr escalation over 20 years puts a 22% rate at ~24.4% — plausible but uncertain. Default escalation = 0 (off). Users who worry about this can toggle it on.

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

## PF11 + PF13 Findings: conversion candidate pool + optimizer ranking (2026-07-20)

**Ranking by ending wealth is orthogonal to "who benefits from converting."** The Optimize Conversions candidate pool was `results.filter(success).sort(finalNW desc).slice(0,5)`. Measured on a $2M-IRA/$90k-spend scenario, all five slots went to cyclic `fixedpct` rows that correctly return `optConv: 0` (extra conversion strictly hurts them), while `propwd` at rank 6 returns a real conversion and was never considered. **A flat top-N over a homogeneous metric lets one strategy family monopolize every seat.** Fix: pick the best row per FAMILY (`selectConversionCandidates`), which guarantees structural diversity instead of hoping a scalar surfaces it.

**`finalNW` is not comparable across plans and must not be used to rank them.** `finalNW` = terminal `totalWealth`, which discounts each run's remaining IRA at *that run's own* `sim.nominalTaxRate`. Two plans are therefore valued with two different tax rates, and it ignores spendable entirely (the hoarding bias v11.1098 already removed from baseline ranking). Anything comparing plans must use a SHARED rate: `afterTaxNetWorth(terminal, sharedRate, capGainsRate)`. PF11 moved the conversion sweep's own objective onto `_baselineScore` for the same reason. **Rule: a per-run rate belongs inside a run, never in a cross-run comparison.**

**Family keys need more than `_strategy`.** IRMAA Ceil rows carry `strategy:'bracket'` with `stratIRMAATier` 0-4, while Fill Bracket carries `strategy:'bracket'` with tier -1. Keying a family map on `_strategy` alone silently merges two sweeps that answer different questions and drops one. Cyclic must also be its own dimension, since the observed failure was exactly cyclic rows crowding out the non-cyclic champion of the *same* strategy.

**Equality objectives need a wealth floor or they reward poverty.** "Tax Flexibility" (equal after-tax buckets) is degenerate on its own: a plan that drains every bucket to near-zero is perfectly "equal" and would win. Implemented as two-stage instead: take plans within 10% of the best after-tax net worth, then rank those by smallest bucket spread `(max-min)/total`. The cutoff `maxNW - 0.10*|maxNW|` (not `maxNW*0.9`) is required so a negative maxNW still produces a cutoff BELOW it. **General: any "minimize dispersion" metric needs a quality gate, since dispersion is trivially minimized at zero.**

**Two separate `⚠️` mechanisms on ACA rows produced a contradictory display.** One was a hardcoded literal in the 400%-FPL parameter label string; the other the dynamic `_isACAUntenable` flag. Because the dynamic flag scales with the FPL cap (lower multiples breach MORE) and untenable rows are hidden by default, the ONE visible ACA row was the dynamically-feasible 400% row wearing a static warning, while the genuinely-untenable rows were invisible. **When a status glyph can come from two sources, one static and one computed, the static one will eventually contradict the computed one.** Fixed by deleting the static literal and adding the missing semantic check (`eitherOnMedicareAtStart`): once one spouse is on Medicare their RMDs/SS push household MAGI past any FPL cap, so every ACA row is untenable, not just some.

**Sorting and ranking were two different orders shown at once.** The objective drove the ⚓ baseline pick and the Rank column, but the table body stayed sorted on `afterTaxNW` regardless — so Rank numbers appeared shuffled down the page. Unified with a `sortState.colKey === '__objective__'` sentinel: the default body order IS the objective order, and a column-header click is an explicit user override that the next objective change resets. **If you render a rank number, the default row order must be that rank, or the UI is telling two stories.**

**GOTCHAS (both cost real time):**
- Driving inputs from the console requires `DisplayHelpers.setDollarValue(id, v)`. `val()` reads `el.dataset.numVal`, not `el.value`, so a raw `.value =` assignment — even with `input`/`change` events dispatched — is silently ignored by `getInputs()`.
- `el.style.display = ''` does not mean "visible", it means "remove the inline value and fall back to the stylesheet." For an element whose layout came from an inline `display:flex`, that silently downgrades it to `block`. Set the literal (`'flex'`) when un-gating something that was inline-styled.

**A "filter the winners" fix is incomplete if a second code path also nominates rows.** PF13 item 2 filtered the per-metric winner pool (`feasibleSuccesses`) so an infeasible row could not win a metric. But the "Best" summary has a SECOND source: the ⚓ baseline row, chosen by `recomputeBaselineForObjective`, which had no feasibility filter at all. An infeasible `Fill Bracket (no conv) ⚠️` was still being pinned on top of the table and listed in the Best summary. Caught only by looking at a screenshot, after the programmatic check ("does the winner pool exclude infeasible rows?") had already passed. **When auditing "X should never appear in Y", enumerate every writer into Y, not just the one the bug report named.** The fix prefers feasible rows but falls back to the unfiltered set when every candidate is infeasible, so the Δ columns still have a reference.

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

## P24 evidence sweep: the Break Even boundary year is NOT the year to stop converting (2026-07-23, v11.12fd)

The previous entry recorded a single measured truncation (stop after 2043, the year the ⓘ
diagnostic names) and found it beat every other variant tried. It did, but only because the
right answer was never tried. Sweeping EVERY cutoff instead of the four hand-picked ones
overturns the conclusion.

Harness: `.test_harnesses/stopyear_harness.js` (browser console, research only,
not shipped). It re-runs the plan once per cutoff and scores each on
`afterTaxNetWorth(terminal, heirs, capGainsRate)` at a SHARED heirs rate. One 27-cutoff sweep of
a 26-year plan is ~46ms, so the whole scenario matrix below is a few seconds.

Same recorded scenario, reproduced exactly first (`atnw 22,809,307`, `spend 8,668,149`,
`conv 1,858,960`, `convBEYear null`).

### 1. The optimum is 2031, not 2043. The diagnostic is off by 12 years and $662k.

| stop after | after-tax NW | lifetime tax | Break Even | converted | end IRA |
|---|---|---|---|---|---|
| no conversions | $23.161M | $4.789M | -- | $0 | $9.42M |
| **2031 (the true optimum)** | **$23.855M** | $3.751M | **2046** | $585k | $6.59M |
| 2043 (the ⓘ boundary year) | $23.193M | $3.367M | 2051 | $1,414k | $3.26M |
| 2051 (as configured) | $22.809M | $3.601M | -- | $1,859k | $1.99M |

The curve rises to cut=6 then falls monotonically. Break Even at the true optimum lands on
2046, five years before plan end, which retires the "thin margin, breaks even only on the
final year" caveat from the previous entry: that caveat was an artifact of measuring the wrong
cutoff.

**Why the diagnostic cannot find this.** `diagnoseConvBreakEvenFailure` answers "which
conversion erases the lead for good," i.e. the LAST cutoff that still produces any Break Even
year at all. That is the right answer to the question it was built for and the wrong answer to
"where should I stop." Existence of a Break Even is a much weaker condition than maximum
after-tax wealth: every cutoff from 2026 through 2043 breaks even, and they differ by $662k.

### 2. Delivered spend is identical across every cutoff, in every scenario measured.

`spendRange` (max minus min total spend over all 27 cutoffs) is **$0** in all 18 scenarios
checked, and no truncation flipped `totals.success`. Truncating conversions is a pure
wealth/tax comparison with nothing else moving. That is what makes a stop-year search safe to
rank on after-tax NW alone.

### 3. Larger-and-shorter beats smaller-and-longer. The stop year is worth more than the amount.

Joint (Extra Conversion amount x stop year) grid, $0-$400k in $25k steps x every cutoff:

| policy | after-tax NW | amount | stop |
|---|---|---|---|
| A. plan as configured | $22.809M | $33k | none |
| B. best stop year, configured amount | $23.855M | $33k | 2031 |
| D. best amount, no stop (**what the ⇌ optimizer searches today**) | $23.192M | $50k | none |
| C. best amount AND stop year jointly | **$24.228M** | $200k | 2031 |

Stop-year alone (B-A, +$1.045M) is worth slightly MORE than amount alone (D-A, +$383k), and
the two are close to additive. C-D, the value the stop-year axis would add on top of today's
optimizer, is **+$1.036M** here and was positive in all 11 scenarios tested (+$228k to
+$1.887M, median ~$1.0M). Converting $200k/yr for six years then stopping beats every
amount-only plan, and beats converting nothing by $1.07M.

### 4. Stopping only the EXTRA conversion (what a user would expect the knob to do) is much worse.

Mode `'extra'` keeps the strategy's own bracket-fill running to plan end and caps only
`extraConversionAmount`. Best result over the same amount grid: **$23.465M**, versus $24.228M
for stopping all conversion activity. And `convBEYear` is **null at every cutoff and every
amount** in extra-only mode. The conversions doing the damage in the late years are the
strategy's own bracket-fill, not the Extra. A stop-year control wired to the Extra only would
look like it was working and would leave most of the money on the table.

No engine change was needed to measure this: `extraConversionAmount` already accepts a per-year
ARRAY, so extra-only truncation is a zero tail.

### 5. Generality: stopping early never hurt, but the size of the win varies enormously.

23 scenarios across growth 3-12%, `die1` 80-100, spend $120k-$400k, IRA $0.8M-$8M, states
CA/TX/NY/PA, heirs rate 0-50%.

- **`gainVsFull` (best cutoff vs converting to the end) was >= 0 in every single scenario.**
  Never negative. Range $0 to $2.97M.
- **In 7 of 23, the best cutoff is "convert nothing at all"**: growth <= 3%, `die1` 80, spend
  $300k, IRA1 $0.8M and $1.5M. Low growth, short horizon, or a small IRA means conversions
  never pay, and the sweep says so cleanly.
- **The payoff scales hard with growth and longevity.** vs-never-converting: $0 at 3% growth,
  $37k at 6%, $693k at 8.5%, $1.32M at 10%, $2.97M at 12%. And $0 at die 80, $218k at die 88,
  $2.11M at die 95, $5.86M at die 100.
- **The diagnostic's boundary year never equaled the optimum in any scenario.** In 10 of 23 the
  diagnostic does not fire at all (Break Even is non-null, so the ⓘ never appears) and yet
  stopping early still gained $99k to $2.97M. The actionable quantity exists independently of
  whether Break Even is blank.

### 6. No heuristic substitutes for the search. Four candidate rules all failed.

- **Marginal-rate crossing** ("stop when the conversion's marginal rate reaches the heirs
  rate"): the bracket-fill strategy pins the combined marginal rate at 33.3% (24% fed + 9.3%
  CA) in EVERY year of this plan. The rule cannot discriminate at all, yet the optimum is a
  sharp six years in. The real driver is paying conversion tax out of a portfolio compounding
  at 8.5%, not a rate comparison.
- **Portfolio-mix trigger** ("stop when the IRA falls below X% of the portfolio"): the IRA
  share at the optimal stop year ranges from 4% to 78% across scenarios. No usable threshold.
- **Age / RMD-onset rule**: age at stop clustered at 70-75 until birth year was varied, which
  exposed it as an artifact of the fixed 1960/1952 birth years. Sweeping birth year 1948-1968
  gives stop-minus-RMD-year offsets from -15 to +14.
- **Terminal-mix target** (the user's "is there an optimum pre-tax/taxable/tax-free ratio to
  drive toward?"): the taxable share at the optimum is fairly stable at 43-48% of after-tax NW
  in the mainstream cases, but pre-tax net ranges 3-71% and Roth 0-68%. Nothing tight enough to
  drive toward. The optimal MIX is an output of the search, not an input to it.

Conclusion: the stop year has to be searched per plan. That is the argument for building the
search rather than shipping a rule of thumb.

### 7. The search must stay a linear scan, and the peak can be sharp.

- **Not unimodal.** First-difference sign flips over the cutoff curve: 1 to 7 across scenarios
  (7 at growth 10%, 5 at Extra $200k). Bracket and IRMAA tables are step functions, so ternary
  or binary search converges on the wrong cutoff undetectably. Same reasoning
  `diagnoseConvBreakEvenFailure` already documents for its own linear scan. Cost is not the
  issue anyway: k+1 runs, ~46ms.
- **Precision matters most exactly where the win is smallest.** Fraction of the gain retained
  if the stop year is off by +/- N years: baseline keeps 94% at +/-1 and 48% at +/-5, but
  low-tax states, where the gain is only $99k-$113k, go NEGATIVE at +/-2 (TX: -10%) and +/-3
  (TX: -117%, PA: +1%). In those plans a mis-set stop year is worse than not stopping at all.
  Any UI that suggests a year must show the size of the win next to it.

**Follow-up:** Phase P24 in `task_plan.md`, rewritten against this evidence.

## Surplus routing (Cash Reserve, P2) is upstream of every conversion metric — it flips the verdict (2026-07-23, v11.1330)

Closing the BETR audit's Q2. The non-cyclic default banked ALL surplus (dominated by forced RMDs)
into Cash at `cashYield` (~3%). Phase P2 implements the dormant `CashReserve` input as a target cash
buffer: blank/negative = OFF (legacy, all-to-cash); 0 = reinvest all surplus to Brokerage; positive
$Y = keep $Y (today's dollars, inflated), reinvest the overflow, protect $Y on withdrawal
(breakable last resort). Re-running the harnesses with surplus reinvested overturns the conversion
conclusions the OFF default produced.

**BETR harness (`node .test_harnesses/betr_harness.js`), empirical break-even heirs rate t*:**

| scenario | reserve OFF | reserve 0 / 200k | code BETR |
|---|---|---|---|
| lump $500k, g6% | t* ≤0 (convert always), gain@0% +$581k | **t* 209%** (never convert), gain@0% **−$952k** | 24.6% |
| annual $80k, g8% | t* 6%, gain@0% −$144k | **t* 84%**, gain@0% **−$2.0M** | 29.6% |

**P24 stop-year search (`bestConversionStopYear`), same flip:**

| reserve | best stop | gain vs converting-to-end | gain vs never-converting |
|---|---|---|---|
| OFF | 2046 | +$100k | **+$914k (convert)** |
| 0 / 200k | none — **convert nothing is best** | +$1,698k | **+$0** |

Three conclusions:

1. **The cash-drag was the artifact.** With surplus left in 3% cash, the no-conversion world was
   starved of growth, making conversions look great (t* ≤0, P24 says convert). Reinvest that surplus
   at market and the no-conversion world compounds instead, and conversions LOSE at every plausible
   rate. The OFF default systematically biased Break Even, opportunity cost, BETR, and the P24
   stop-year all toward conversions.
2. **BETR is wrong in BOTH regimes, in opposite directions.** OFF: code BETR ~25% overstates the
   threshold (true ≤0) → understates benefit. ON: code BETR ~25-30% understates it (true 84-209%)
   → overstates benefit. The closed form ignores surplus routing AND the RMD/IRMAA/SS second-order
   cascade, which together dominate the simulator's actual outcome. The years-to-RMD horizon is a
   minor error either way. **BETR as shown is not a reliable signal**; the honest replacement is the
   empirical break-even t* computed from two full sims (what the harness does).
3. **`0` and a positive buffer often coincide in legacy plans** because the forced-RMD surplus dwarfs
   any few-hundred-k buffer, so nearly everything reinvests either way. The buffer only bites when
   surplus is comparable to it (modest-IRA plans).

Reserve OFF stays byte-identical to pre-P2 (regression-locked). The default is OFF, so existing
scenarios/URLs are unchanged until a user opts in; a load-time warning fires for any scenario/URL
that carries an active Cash Reserve.

## Two classic scripts cannot both declare the same top-level `const` (2026-07-29, v1.13be)

Making `taxPaymentPlanner.test.js` dual-mode for TPP-3 failed in a way worth recording, because the
failure mode gives you almost nothing to go on. The test file opened with

```js
const TaxPaymentPlanner = (typeof module !== 'undefined' && module.exports)
  ? require('./taxPaymentPlanner.js') : window.TaxPaymentPlanner;
```

and the engine, already on the page, opens with `const TaxPaymentPlanner = (() => { ... })();`.
Two classic `<script>` elements share ONE global lexical scope, so that is a duplicate `const`
declaration and a **SyntaxError for the whole file**. Nothing in it runs.

The symptoms: the network panel showed `200 OK` for the test file, the loading glyph stayed on ⏳
because `script.onload` fired (the fetch succeeded) while `window.runTaxPlannerTests` was never
defined, `script.onerror` never fired (it is for load failures, not parse failures), and
`read_console_messages` reported nothing. A 200 and an `onload` are not evidence that a script
executed.

Fix: wrap the test file in an IIFE. That also keeps `test`, `assert`, `BASE`, `TODAY` and the
business-day helpers out of the app's global scope, which matters now that a test file loads into a
live application page.

Two related facts from the same session:

- **A top-level `const` is not a `window` property.** `const X = ...` at script scope creates a
  global lexical binding, so the bare identifier `X` resolves from any later script, but
  `window.X` is `undefined`. Code that has to find a module without knowing how it was loaded needs
  an explicit `window.X = X` in the browser branch of the export tail.
- **TDZ across a module's own top level.** `RULE_CITES` and `CONCEPT_NOTES` interpolate
  `ROLLOVER_DEADLINE_DAYS` / `RESTORE_TARGET_DAYS` rather than hardcoding 60 and 45. Those arrays
  are evaluated at module init, so the constants had to be MOVED above them. Quoting a constant
  inside a data table is the right instinct, but it silently imposes a declaration order.

## `T.NOTE` actions render their description and drop their notes (2026-07-29)

Found while verifying TPP-5. In `taxPaymentPlanner.js`, `buildHtml`'s `if (isNote)` branch returns
after emitting `a.description`, before the `a.notes` loop every other action type gets, and
`buildText`'s `T.NOTE` branch pushes only the description. So sub-notes on advisory actions have
never been rendered in either output.

Two are lost today, both on the RMD-ordering advisory that fires whenever an IRA has both an RMD and
a conversion, six occurrences each in a dual-IRA scenario: "Only the balance beyond the RMD can be
converted", and the QCD alternative. The QCD one is real guidance and is invisible.

Left unfixed in PR 1 because rendering them ADDS visible output, and that PR's remit was
byte-identical numbers with note text only. Spawned as a separate task.

## Safe harbor is TWO different numbers in this engine, and only one of them is right (2026-07-29, v1.13c0)

`shFed`/`shState` in `taxPaymentPlanner.js` are computed as

```js
const shFed = p.priorYearFedTax != null ? p.priorYearFedTax * sfFedMult : p.federalTax * 0.90;
```

which uses the prior year **whenever it is supplied**. IRC 6654(d)(1)(B) makes the required annual
payment the **lesser** of 90% of the current year and 100% (110% for a high earner) of the prior
year. With current federal tax 35,000 and prior year 33,000, `shFed` returns 33,000 where the real
requirement is 31,500 — it overstates by 1,500.

These are displayed figures AND they drive the `_gapFillAllowed` gate, so correcting them in place
changes withholding decisions and every Safe Harbor readout. v1.13c0 therefore added
`reqAnnualFed`/`reqAnnualState` with the correct minimum, used **only** to decide whether
withholding alone makes the taxpayer timely. Two notions of the same concept now coexist on purpose.
**TPP-1 must unify them** — the required annual payment is the direct input to the penalty
computation, so the wrong one cannot be allowed to feed it. Do not collapse the variables without
doing that work.

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

## README audit round 3 (2026-07-30) — what the code actually says

Read of `README.md` (685 lines) checked claim-by-claim against the tree at `main` = `2537135`
(everything through PR #139). Each item below was verified in code, not inferred from the changelog.

### Contradictions — the README argues with itself

- **`README.md:258` says the Cash Reserve is ignored.** Exact text: "The tool doesn't try to
  maintain a brokerage balance or a cash balance. It will deplete those accounts to zero if required
  to meet your spend goal.  (The *Cash Reserve* is ignored currently)." That parenthetical has been
  false since P2 landed at v11.1340. It sits in **What the Tool IGNORES (No Plans to Implement)**,
  the one section a skeptical reader trusts most, and it directly contradicts `README.md:185`
  ("Cash Reserve has been implemented") plus three whole FAQ entries that explain the routing order.
  Engine proof: `optimizer_core.js:1235` (reserve floor, `cashBreach` flag) and `:1765` (surplus
  tops Cash to target, overflow to Brokerage).

### Numbers that no longer match the code

- **Tax Payment Planner version.** `README.md:135` opens "**Version 1.13b9.**"; the tool's own
  `<title>` at `RetirementTaxPlanner.html:11` reads **1.13c3**. The paragraph describes PR #136 work
  only and never mentions PR #138: the browser-runnable suite (`?runtests`), the sticky Compute
  button, the deduplicated notes with "Rules and sources" pointers, or the Optimizer handing the
  brokerage position across.
- **Income Tax Planner state count.** `README.md:127` says "state (14 options currently)". The
  dropdown is built at runtime from every `TAXData` entry that has a `STATE` key
  (`standalone/IncomeTaxPlanner.html:1157-1168`), which is **38** today: 29 taxing jurisdictions
  including DC, plus 9 no-tax states added via `NO_TAX_SHELL`.
- **Optimizer sweep grids** (`README.md:233`), all three wrong:
  - "Optimizer 🎯 checks years 1 to 30 automatically" — the Reduce grid is
    `[2,3,4,5,6,7,8,9,10,11,12,13,14,15,20,25]` (`optimizer_ui.js:805`). 16 values, never 1, never 30.
  - "📉IRA Draw % ... (5–10% in the Optimizer)" — the grid is `[5,6,7,8,10,12,15,20]`
    (`optimizer_ui.js:834`), so the range is 5–20%.
  - "The Optimizer tests this at 0/5/10/20/50% × Max Conversion on/off" — **the on/off half does not
    exist.** `optimizer_ui.js:797` sets `const convOn = true;` and every `addResult` in the sweep
    passes `convertExcessToRoth: convOn`. `buildVariations()` in `optimizer_core.js:3172` does the
    same for Monte Carlo. The 0/5/10/20/50 percentages are right.
  - The same sentence offers ACA FPL ceilings (200/250/300/400%) as if they were ordinary sweep
    arms; `optimizer_ui.js:825` gates them behind `NERD_KNOBS` and skips them when both people are
    on Medicare at plan start.
- **States that borrow the federal standard deduction** (`README.md:181`) are listed as
  "AZ, CO, ME, MN, ND, SC". There are **8**: `MS, IA, AZ, CO, ME, MN, ND, SC` (`std: 'FEDERAL'`).
- **`retirement_optimizer_taxdata.js` does not exist** (`README.md:499` tells readers to ask an AI to
  add their state to it). The data is `var TAXData` at the top of `taxengine.js`; the README also
  spells it *TAXdata*, which matches only the closing comment `}; // TAXdata`, not the identifier.

### Claims that survived the audit — do not "fix" these

- **The AL/MT/OH standard-deduction inflation bug at `README.md:181` is still real.**
  `INFLATION_INDEXED: false` (set on AL, MT, ND, OH, SC) is honoured only for *brackets*, at
  `taxengine.js:1089`. The standard deduction is multiplied by inflation unconditionally at
  `taxengine.js:1349-1351`. ND and SC escape because their std is `'FEDERAL'`, which leaves exactly
  AL, MT, OH overstating the deduction — the three the README names.
- SS depletion "23% reduction" vs the field default `ssFailPct = 77.3`
  (`retirement_optimizer.html:376`): 22.7%, correctly rounded.
- Every relative link and every one of the 30 in-page anchors in the README resolves. The root-level
  `FutureCost.html` / `IncomeTaxPlanner.html` / `AfterTaxRealGrowth.html` / `irmaa_and_rmds.html` are
  ~500-byte redirect stubs pointing at `standalone/`, and the README already links `standalone/`.
- RealReturns "98 years of data (1928–2025)" matches `standalone/real_returns_data.js`.

### Features shipped since the last README pass that the README never mentions

Greps for each term across `README.md` returned zero hits, or hits only inside the *reviews of other
people's tools*:

| Feature | Shipped | README status |
|---|---|---|
| Guyton-Klinger strategy family in the sweep | Phase 22 | only ever mentioned as a NestWise/AiRA feature |
| Cyclic rows (🗘 IRA-first, 🔄 brokerage-first) | Phase 24 | absent |
| 💵 cash-funded conversion rows | PF10 | absent |
| ⚓ BASELINE / 📍 CURRENT pinned rows + Rank column | PR3, PF13 | "Current Plan" appears once, in unrelated prose |
| ⚖ head-to-head strategy compare | PR-D (v11.13a1) | absent |
| Stress Failure tile + auto-rerun, stress in Synthetic mode | PR-A (v11.13a1) | absent |
| Social Security paid from the birth month in the claim year | PR-B (v11.13a1) | absent |
| Survivor benefit from the real FRA, not a flat 67 | PR-C (v11.13a1) | absent |
| "Optimize for" ranking selector | PF13 | FAQ only, and only 4 of its 9 objectives |

### FAQ specifics

`README.md:642-646` lists four objectives; the selector at `retirement_optimizer.html:923-931` has
nine (`taxflex, networth, widowrmd, mintax, maxspend, maxroth, balanced, conveffect, earliestbe`).
Two are described wrongly:

- Label is **"Avoiding Widow & RMD Tax"**, not "Avoid Widow & RMD Tax".
- It is not "taxes your heirs will pay". `OPTIMIZER_OBJECTIVES.widowrmd`
  (`optimizer_core.js:2789`) scores `totals.rmdTax + terminal.ira * rate` — RMD tax paid *during the
  plan* plus the deferred tax still owed on whatever pre-tax IRA is left. Lower is better.

### Found in passing, not README

`retirement_optimizer.html:1119` still comments that `applyNerdKnobVisibility()` gates the
"optimizer objective selector". PF13 un-gated that selector; the comment outlived the code.

## An assumption sweep cannot be scored in dollars (2026-07-30, P27 scoping)

Sweeping `growth`, `inflation` or `die1`/`die2` moves the ruler at the same time as the thing being
measured, so a raw ending-wealth comparison across cells is meaningless. Two independent mechanisms:

- **Horizon.** `maxYears` is derived from the death ages -
  `Math.max(birthyear1 + die1, birthyear2 + die2) - currentYear + 1` (`optimizer_core.js:2220`).
  A +10-year lifespan cell compounds ten more years AND accumulates ten more years of
  `spendCurrentDollars`, which `baselineScoreOf` sums into the score at `optimizer_core.js:2708`.
  It will always "win", and the win says nothing about the plan.
- **Scale.** `growth` multiplies every balance, and `inflation` scales every nominal figure.
  `baselineScoreOf` already deflates by `last.inflationFactor` (`optimizer_core.js:2706`), which
  handles the second, but nothing handles the first.

Rule, and it is the same discipline the P24 evidence sweep landed on (§ "P24 evidence sweep" above,
where spend was held identical across cutoffs precisely so the wealth comparison stayed clean):
**compare WITHIN a cell, never across cells.** P27's tornado bar is therefore a paired difference -
the plan as configured minus the same plan with conversions off, both run at the same assumption -
not a cross-cell delta.

## Monte Carlo does not cover the "what if my assumption is wrong" question (2026-07-30, P27 scoping)

The `Decisions Made` table retired the old Variable Growth grid on the grounds that "Bootstrap MC +
Stress mode cover the use case". They do not, and the row has been rewritten.

- MC draws returns around `mu` from the nerd panel. `mu` is an input, never varied within a run.
  Randomizing around a wrong mean does not discover that the mean is wrong.
- The Stress pass varies the historical SEQUENCE (worst-decade orderings, `runPass` in
  `montecarlo/worker.js`), which is sequence-of-returns risk - a different question.
- Neither varies lifespan at all. Neither varies inflation in Synthetic mode either: `inflationSequence`
  is only built for bootstrap/stress, and the engine falls back to the flat sidebar value at
  `optimizer_core.js:921` (`inputs.inflationSequence?.[y] ?? inputs.inflation`).

So the three knobs the user cannot verify are the three the tool never questions.

## Inflation is not a discounting knob in this engine, and 3 states will draw a wrong trend line (2026-07-30, P27 scoping)

`inflation` is threaded into `calculateProgressive(entity, status, amount, inflation, ratecreep)`
and indexes federal brackets, the IRMAA tiers and the ACA thresholds. A high-inflation cell
therefore changes the TAX answer, not merely the deflator - which is why P27 keeps growth and
inflation as independent axes instead of collapsing them into one real-return axis.

The catch: states with `INFLATION_INDEXED:false` (AL, MT, OH) have their brackets guarded at
`taxengine.js:1089` (`effectiveInflation = ... ? 1 : inflation`) while their standard deduction is
inflated unconditionally at `taxengine.js:1349-1351` (`rawStateStd * inflation`). This is the known bug
the round-3 README audit confirmed and deliberately left alone. A single run shows it as a small
error; an inflation SWEEP amplifies it into a visible, monotonic, wrong trend. P27 must either
disclose it on the axis or suppress the axis for those three states - not ship it silently.

## A log field the next iteration reads is engine state, not a label (2026-07-30, P28)

The single most useful thing to come out of the P28 harness, and it was found by disbelieving a
"reporting-only" change that measurably moved money.

P28's routing flag re-tells a year as "the whole voluntary IRA draw was converted, then spending came
out of Roth". That is arithmetic, not a model change: draw a gross X, pay tax T on it, fund spending
S, and today Roth gains the leftover `L = X - T - S`; routed through Roth it gains `(X - T)` and
immediately returns `S`, which is the same `L`. So the first implementation reported the reframed
figure through the obvious channel: `yr.totalConverted`, and from there the `rothConv` log field.

That moved **780 money fields** on the IRA Draw 6% family - and only that family. Bisecting the flag
one assignment at a time (`iraConvGross` vs `iraVolSpend` vs the new `unifiedRothSpend`) pinned it on
`iraConvGross`, which nothing reads except the log. The log was the path:

```javascript
// optimizer_core.js, beginYear()
const _prevConv = y > 0 ? (log[y - 1].rothConv ?? 0) : 0;
yr._useEarly    = y === 0 ? _stratImpliesConversion : (_prevConv > 1000);
const preMonths = yr._useEarly ? 1 : 11;
```

`rothConv` is read back out of the previous year's log record to choose **withdrawal timing** - a
month-1 draw in conversion years, month-11 otherwise - which changes how much growth accrues before
the money leaves. IRA Draw 6% converts nothing in most years, so it ran late; the reframe pushed its
`rothConv` over the 1000 threshold and flipped every year to early. Every other family already
converted enough to be on the early branch either way, which is exactly why only one family moved and
why a smaller test set would have called the change clean.

Rules this leaves behind:

- **`rothConv` and `yr.totalConverted` are not display fields.** Do not overload them. P28 reports
  through `-unifiedConvGross` / `-unifiedRothSpend`, and the harness deliberately keeps `rothConv` in
  its *money* set so a regression of this mistake fails loudly.
- **`log` is loop-carried state.** Anything written into a log record can be read by a later year, so
  "it only changes a column" is not a safe claim about this engine until `log[...]` is grepped.
- Same family as the 2026-07-26 finding that a predicate must read its input through the same
  accessor the behavior uses: both are cases where a value that looked like output was input.

## P28 measured: the reframe is a relabel; the Roth-first half is the real lever (2026-07-30)

Harness `.test_harnesses/unifiedconv_harness.js`, six strategy families x seven arms. Two separable
flags, both default off: `unifiedConvRouting` (call the draw a conversion, spend from Roth) and
`rothGapFill` (promote Roth from last resort to first in the gap fill). `ordered` excluded from
both by instruction.

**1. Routing alone is provably inert, and now measured inert.** Zero money fields move in any of the
six families. Only the `-ira*` attribution keys change. So the nerdknob as originally proposed would
ship a switch that changes no number in the tool - worth knowing before building UI for it.

**2. Roth-first can only reach families that leave a spending gap.** The strategy sizes the primary
IRA draw first; `fillSpendingGap` only runs on what is left over. Ceiling families (bracket, fixed,
fixedpct) size the draw to a tax target and routinely leave a gap, so Roth-first reaches them.
**Proportional is unreachable** - `planPrimaryWithdrawals` funds the spending need directly
(`order: ['IRA','Brokerage','Cash']`), so there is no gap to redirect and the arm is bit-identical.
This overturned the prediction that proportional would get *worse*; it does not get anything.

**3. Where it reaches, the effect is large and signed both ways.** Today's dollars, same delivered
spend, `baselineScoreOf`:

| family | Roth-first | + cash-funded | realized LTCG, control -> Roth-first |
|---|---|---|---|
| Fill Bracket 24% | **+$269,145** | +$524,793 | $1,676,706 -> $0 |
| Reduce 20 yrs | -$4,540 | +$242,546 | $536,651 -> $0 |
| IRA Draw 6% | **-$137,062** | +$129,255 | $0 -> $0 |
| Proportional 10% | $0 (unreachable) | +$101,172 | unchanged |

The mechanism is visible in the last column: Roth-first stops the gap fill from harvesting Brokerage,
so realized capital gains go to zero and the Brokerage balance survives ($6.34M -> $11.79M on Fill
Bracket). That helps when the family was realizing gains it did not need to, and hurts IRA Draw 6%,
which was already realizing none and simply loses its tax-free Roth balance early.

**4. No degeneracy.** The stated worry was that promoting Roth everywhere would make families
indistinguishable. Across all seven arms, all six families kept distinct money paths. The worry was
reasonable and the data does not support it *in this scenario*; it is a one-scenario result and the
matrix is still printed on every run.

**5. Guyton-Klinger is not comparable in this table.** Its guardrails re-cut spending (delivered
spend moved $103,150 under Roth-first), so its delta mixes a wealth change with a spending change -
the same reason the optimizer gates GK behind `gkSpendStable()`.

Read together: the feature worth building is **not** the conversion reframe. It is Roth-first gap
filling, as a per-family option, on the families that leave a gap.

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
conversion at all. Full tables in `.test_harnesses/P28_RESULTS.md` §7.

## Spend rate was a hidden confound, and controlling it overturned three P28 conclusions (2026-07-30, round 3)

User noticed the harness spend goals looked high and asked for a sweep at 4/6/8% of assets. That was
right, and the reason is worse than "high": round 2 set spend per scenario BY HAND, and the two
default mixes landed at 8.6% of assets while the other three sat near 4.4%. Account mix and spending
strain were entangled, so "the shipped defaults show small effects" could have been either. Spend is
now a controlled axis crossed with every mix: 5 mixes x 3 rates x 6 families x 7 arms = 630
simulations, ~1.2s.

Three conclusions did not survive:

1. **"The payoff grows with Brokerage share" -> it peaks at 6% SPEND and is not monotone in either
   axis.** Live cells (|Δ| > $1k) go 13/20 at 4%, 19/20 at 6%, 19/20 at 8%; best cell $1.06M ->
   $3.56M -> $2.48M. At 4% Social Security ($69k combined) covers most of the spend so there is
   barely a gap to redirect. At 8% plans strain and the deltas start mixing with changed spending.
2. **"IRA Draw 6% is unreachable" was strain-specific.** Inert at round 2's ~4.2% spend, worth
   **+$1,200,484** at 6% in the same mix.
3. **"'fillCashThenRoth' never destroys value" is false.** Negative in 1 of 60 cells (-$12,466, balanced
   thirds / Proportional / 6%). Round 2 checked 20 cells at a single spend rate and found none. It
   still wins or ties 53/60 with a worst case of -$12,466 against `fillRothThenCash`'s -$244,689.

**The mechanism came out cleaner than before, though.** Section 6 of the results doc tabulates
lifetime Brokerage draws in the CONTROL arm against the payoff: **every cell where the control never
touched Brokerage returns exactly $0**. `fillCashThenRoth` can only convert a Brokerage draw into a Roth
draw, so a plan funding its gap from Cash alone has nothing to gain and nothing to lose. That is a
sharper statement than any portfolio-ratio heuristic, and it explains both the 4% flatness (no gap)
and the family split (Proportional draws Brokerage in `planPrimaryWithdrawals`, not the gap fill).

**convertExcessToRoth got a real correction too.** Round 2 said "loses 13 of 25, 5 surviving timing".
With strain controlled it is **28 of 75 raw, but only 7 survive pinning withdrawal timing** - and at
4% spend it is a very large WIN in the IRA-heavy mixes (+$2,051,465 Reduce, +$1,792,983 Fill
Bracket). So the switch is not "often harmful"; it is strain-dependent, and most of its apparent
downside is the invisible month-1/month-11 timing flip rather than tax. The 7 genuine losses
concentrate in Fill Bracket at high Brokerage share, which is the Cash-buffer mechanism.

Method note worth repeating: this is the second time in P28 that a conclusion drawn from a single
slice of a parameter space was overturned by sweeping that parameter (the first was round 1's
one-scenario sign flip). Both times the fix was cheap - the whole grid runs in about a second.

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

## P50 suggested-spend menu — engine-calibrated, but rate-based and target-based options cross by horizon (2026-08-09, WIP uncommitted)

Context: after P49 shipped a single engine-solved suggested spend, the user found the default plan's
"Withdrawal Rate" tile reading 12.8% at the suggested $146,475. Investigating produced three findings
and a half-built P50 (a three-option menu). **The user paused work here** to record findings before
building the UI. All code below is UNCOMMITTED in the worktree.

### 1. A real units bug in P49's `suggestSustainableSpend` (fixed in the working tree)

The terminal buffer test computed `need = searchSpend - last.guaranteedIncome`, mixing **today's-dollars**
`searchSpend` with the **inflated** terminal-row `guaranteedIncome`. On the default plan that understated
need by ~$87k, so the solver returned $146,475 even though that spend's own terminal buffer FAILS
(port $226,101 vs required $452,104). Fixed to `need = last.spendGoal - last.guaranteedIncome` (both
inflated) - exactly `optimizeSpend`'s terminal test. Default suggestion dropped to $143,082, buffer now
holds. BASE's `inflation:0` hid it (today's == terminal dollars); added an inflation-bearing units-guard
test. This fix is correct regardless of the P50 menu decision and should be kept.

### 2. "Terminal buffer" is a spend-DOWN posture -> high, rising withdrawal rate (by design, not a bug)

Even corrected, the default suggestion's withdrawal rate climbs 6.5% (age 66) -> 7.9% (bridge to SS at
70) -> 6.4% (SS relieves it) -> 32.8% (final year), averaging 10.5%. This is inherent: "spend down to a
K-year cushion" plans to nearly empty the account, and the rate is portfolio-relative, so it rises as the
balance drains. It is NOT comparable to Bengen's 4.7%, which is a NON-depleting initial rate (portfolio
meant to last/grow). The tile and the solver answer different questions.

### 3. Rate-based and target-based options have NO fixed rank - they cross with horizon

P50 built a 3-option menu: A = Bengen rate on invested portfolio (research benchmark, closed form
`guar1 + bengenRate(horizon)*invested`); D = engine-solve leaving >=50% real principal; B = engine-solve
ending with 5 full years of spending. Observed:
- 35yr couple: A $80,940 < D $112,323 < B $115,222  (A lowest, expected)
- 17yr single: D $63,155 < B $66,894 < **A $72,400** (A HIGHEST)
The Bengen rate hedges a bad return SEQUENCE over ~30yr; on this DETERMINISTIC average-return engine that
rate is not especially safe, and a short horizon makes "leave 50%" a stricter (lower-spend) target than
the Bengen rate. So a Conservative/Middle/Aggressive ladder that mixes a rate option with target options
is not monotone. **Open decision (unresolved):** (a) keep the mix, drop rank words, label by method, sort
the popover by dollar amount; or (b) make all three keep-fraction targets (e.g. 80%/50%/5yr) for a
guaranteed gradient with Bengen shown as a reference note. User did not choose.

### 4. Deeper: a deterministic engine cannot express Bengen's real meaning

Bengen's safety margin exists precisely for sequence-of-returns risk, which the single deterministic path
does not model. A Bengen-FAITHFUL conservative option would calibrate against a low percentile of the
**Monte Carlo tab** (SoRR-aware), not the deterministic path. That is the real follow-up if the menu is to
carry a genuinely "safe" number rather than a rate-times-portfolio benchmark.

### What shipped into the working tree (uncommitted, tests green 233/233)

- `optimizer_core.js`: `solveMaxSpend(baseInputs, {strategy, terminalOk})` (generalized scan+bisect);
  `bengenRate(years)` (horizon table, interpolated); `suggestSpendMenu(baseInputs)` (returns A/D/B against a
  FIXED `propwd` reference so the numbers are strategy-independent - a `★ CRITICAL` test guards this);
  `suggestSustainableSpend` refactored onto `solveMaxSpend` (+ the units fix). Constants
  `SUGGEST_REFERENCE_STRATEGY='propwd'`, `SUGGEST_MIDDLE_KEEP_REAL=0.5`, `SUGGEST_RISKY_BUFFER_YEARS=5`.
  Exports updated.
- `optimizer_core.tests.js`: +6 over P49 (units guard; menu strategy-independence [critical]; A=Bengen rate;
  B=5yr terminal; D=50% terminal; bengenRate monotone). `optimizer_tests.js` EXPECTED 222 -> 233.
- **NOT wired to the UI**: the ⓘ still calls `suggestSustainableSpend` (single value), NOT `suggestSpendMenu`.
  No popover built. The strategy-dependence concern is only resolved for the menu path, which is dormant.
- **Version desync to clean up**: `<title>` and core/ui/tests `?v=` were bumped to 11.14c8, but NO changelog
  entry (in-page `<li>` or optimizer_changelog.md) was added for c8, so the title does not match the first
  changelog entry (still 11.14bf/c6 content). PR #162 is open on this branch (P41 + P49); this WIP sits on
  top of it, uncommitted.

### Decisions still open for a future session
- The ordering/presentation question in finding 3 (user to pick a or b).
- Whether to wire `suggestSpendMenu` to a popover UI, or ship only the P49 units fix and defer the menu.
- Whether "5 full years of remaining assets" (B) means 5x full spend [implemented] vs 5x portfolio-funded
  gap - user's wording implied full spend; confirm.
- MC-percentile calibration for a genuinely SoRR-aware conservative option (finding 4).

---

## 2026-08-10 — Ordered strategy: does each year restart the sequence? (investigation, no edit)

**User question:** for an Ordered sequence (e.g. Cash→IRA→Brokerage), confirm that every year re-funds
from the TOP of the sequence — if Cash refills and IRA has a small remainder next year, it draws Cash
then IRA first again — rather than getting "stuck" past exhausted accounts.

**Verdict: CONFIRMED correct on the draw side. No stuck-pointer defect.**

Evidence (optimizer_core.js):
- `runOrderedWithdrawal(balances, need, seq, ...)` @754 is **stateless**: `for (const [acct] of seq)`
  with `if (rem <= 1 || (balances[acct] ?? 0) <= 0) continue;`. The skip test reads the LIVE balance
  each call — no persistent "exhausted" flag. A refilled account (balance > 0) is drawn again.
- Called fresh each simulated year against `yr.curBalances` (the running portfolio) at two points:
  gap-fill @1687 and residual third pass @1743. Both iterate the seq from the top. So within a year,
  and across years, the fill always restarts at position 1 and reads current balances.
- Main withdrawal block sets `yr.withdrawals = {}` for ordered (@1542-1545): all spend is handled in
  the ordered gap-fill passes, nothing pre-drawn.
- The IRA funding backstop (@1822 `if (!yr.isACAStrategy && !yr.isOrderedStrategy)`) is deliberately
  SKIPPED for ordered — so ordered never draws IRA outside its own sequence. Matches the help text
  ("Ordered is the only strategy that will not draw extra IRA outside it, so it can leave a small
  residual shortfall"). This is by design, not the reported defect.
- RMDs are forced from the IRA first every year regardless of sequence (legally required; tooltip
  already says so). Not a defect.

**Naming caveat:** the offered sequences are **CBIR / RIBC / BIRC** (optimizer_core.js:747-749, and the
dropdown grid @3667). "CIBR" (Cash→IRA→Brokerage→Roth) as the user described is NOT selectable. CBIR is
Cash→**Brokerage**→**IRA**→Roth. So the mechanism is correct, but the exact order the user wants may not
be on the menu.

**The "order dictates fill" half is genuinely NOT implemented (separate enhancement, not a bug):**
surplus routing @2055-2078 ignores the Ordered sequence entirely — surplus always lands in **Cash**
(default / Cash-Reserve-off), or **Brokerage** (Cyclic, or Cash-Reserve overflow). It never fills the
first-in-sequence account. Consequences:
- CBIR (Cash first): surplus→Cash is already consistent — banked surplus is the first thing drawn next
  year. No issue.
- RIBC / BIRC (Cash drawn LAST): surplus piles into Cash, which the sequence then won't touch until
  Brokerage/IRA/Roth are exhausted. Mild inconsistency with "fill in priority order," but it does NOT
  break the per-year restart-in-order draw the user asked about — next year still reads balances and
  draws in sequence.

**Bottom line:** the behavior the user wanted (yearly restart in sequence, using whatever Cash/IRA
exist that year) IS what occurs. If they want surplus to also refill the top-priority account, that is a
new feature, and only matters for non-Cash-first sequences. A node harness could demonstrate numerically
if desired (runOrderedWithdrawal is requireable like the tests).

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

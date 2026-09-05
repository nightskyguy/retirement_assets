# Findings & Decisions

## Rules earned the hard way

Each line is a defect that already happened, compressed to the rule it produced and the thing that
now enforces it. The narrative behind every one is in `findings_archive.md` under the heading named
in parentheses. Read this section before adding a guard, a test or an invariant.

**On tests and invariants**

- *Money must be conserved, not merely accounted for.* A dollar can be recorded correctly in two
  places at once and every reconciliation still balances - which is how dividends and interest were
  credited to a balance AND counted as income for months. Guards must be economic or flow
  invariants, never accounting ones. Enforced by the three `no free money` tests at
  `optimizer_core.tests.js:4117`, `:4144`, `:4166`. ("Dividends are counted twice")
- *When an invariant survives a bug report, suspect the invariant.* A coverage check
  (`totalCovered + shortfall === totalTaxDue`) passed throughout a 497% withholding bug: it
  confirmed the books balanced and said nothing about whether the quantities were possible. Replaced
  by property tests over grids. ("Self-consistent arithmetic is not a correct model")
- *Test the USE of a function, not only the function.* Two OBBBA provisions were implemented,
  tested, and never switched on because no test asserted the engine passed the flags. The guard is a
  use-site spy - `optimizer_core.tests.js:2880` asserts every `calculateTaxes` call in a run is
  handed its flags. ("Two OBBBA provisions were implemented, tested, and never switched on")
- *A prediction that cannot lose is not a prediction.* Score against a stated alternative, not
  against nothing. ("P88f DONE - the ceiling rows are worth keeping")
- *A `new Date()` default in a test fixture rots.* Pin the year. ("P89 - the plan's first year had
  two definitions")
- *The SCORER is where the bugs live, not the measurement.* Nine scoring-predicate defects over two
  days (2026-08-27/28), every one caught by a number disagreeing with the one printed beside it and
  not one by review, because a wrong scorer still prints a confident verdict. The species: a
  predicate reading a field that does not exist (`r.useEarly`, false on every row, so the pin the
  whole phase rested on could never fail); ties awarded to the first entry in the list; a $1 epsilon
  applied to a metric measured in fractions, so it tied in every cell mechanically; comparing two
  different samples; assuming the sign of your own metric. Two of them flipped a recommendation, and
  one would have shipped a default behavior change on a tie-breaking artifact.
- *A prediction with no data is UNTESTED, not BROKEN.* Scoring it broken lets an empty table read as
  a refutation of the thing it failed to measure. Keep a floor below which no direction is claimed.
- *A fixture inherited without being read is its own failure mode*, distinct from a scorer bug: the
  scorer was right about the data it was given. `iraBaseGoal: 0` copied wholesale from another
  harness against a shipped default of $750,000 broke a 186-of-186 claim into 124 counterexamples.

**On engine code**

- *A predicate that gates behavior on an input must read that input through the same accessor the
  behavior uses.* `x > 0` against a scalar silently mis-reads an array. One accessor,
  `_extraConvAmountFor` (`optimizer_core.js:3096`), is used by both the behavior and its gate.
  ("A predicate must read its input through the same accessor")
- *A sentinel meaning "none" and a sentinel meaning "unbounded" cannot be the same value.* `0` was
  both, which made the flagship strategy inert in 21 flat-tax and no-tax states and could drive
  spend negative without failing the success test. ("A lookup that returned 0 for no limit")
- *A guard that drops work needs a place to put the work, not just a reliable way to clear itself.*
  Three bugs came from the same in-flight guard; the first two fixes both repaired the stuck flag
  and left the dropped request gone for good. ("P91 DONE - it was a DROPPED REQUEST")
- *Anything computed off `balance` between `beginYear`'s growth call and `growAndSettle` inherits the
  `preMonths` 1-vs-11 dependency* - which is set by whether LAST year converted more than $1,000. Two
  known casualties: the RMD basis (fixed in `P84l`), and an advisor fee that would have moved with
  whether last year converted had it been struck at its own call site. Use the prior-Dec-31 snapshot.
- *A regulation constrains the BASIS, not the trajectory.* An invariant demanding identical lifetime
  RMDs across two timing arms is simply false - timing legitimately changes the balance path - and the
  first version of it would have condemned a correct fix.

**On the browser, the build and the worker**

- *The page is not the file, and a fresh tab is not a reload.* Browser findings have twice been
  reported from a tab whose page predated the file on disk.
- *Never cache-bust this page with a short query param.* The share scheme owns the short names - `g`
  is Growth and `s` is State, so `?g=1` silently sets growth to 1% and the plan then "fails".
- *Any new top-level `const`/`function` in `optimizer_core.js`, `taxengine.js` or the montecarlo files
  must be unique across all five*, because the worker shares one scope. **Node will never tell you.**
  Guarded by a scan of the five worker-imported files; written against the broken state it found
  exactly one collision, which is the only way to know a guard works.
- *A cache token must move with any engine file the test tier depends on*, and stale HTML is the
  harder half - a warm tab keeps requesting the old token regardless.

**On measurement**

- *A coarse probe grid invents answers, and a drained IRA is not the absence of an opportunity.*
  Both traps were caught only by cross-validating against brute force. Kept live above under "Two
  traps this work fell into".
- *Do not report a claim before its alternative has been run.* Several claims in this file were
  scored RIGHT and later withdrawn when a second fixture moved - see "Correcting P103b5c: the two
  fixtures INTERACT" and "Every narrowing of the evidence flattered the answer".
- *An unbiased forecast is the wrong objective when the loss function is one-sided.* Every adaptive
  IRMAA-threshold rule beat the shipped constant on average and was WORSE on the downside tail in all
  four path sources. The constant wins because it is biased in the safe direction: an overshoot costs
  nothing, an undershoot hits a surcharge cliff.
- *A prose deferral is invisible to every check the repo has.* A checkbox is greppable and a status
  line is read; "give it its own item when someone picks it up" inside a sub-bullet is neither, and
  sat unnoticed until a sweep went looking for that exact shape.

## The suggested Stop Conversion year is a MOVING PEAK, and `totalNetWealth` is not a shared basis (2026-09-03, P106a)

Full report `research/CONVERSION_STOP_YEAR.md`; harness
`.test_harnesses/stopyear_stability_harness.js`. On the user's own plan, the canonical `P106`
scenario. Four things worth carrying forward.

1. **"Unstable" was right, and neither of the two obvious explanations is what it is.** The search is
   sound - idempotent from any starting stop year, deterministic, genuinely multi-modal so the linear
   scan is required. The optimum is not flat either: under a shared heirs rate exactly one cutoff
   sits within 0.1% of best. It is a **sharp peak that relocates**, moving across 2027-2030 under
   input changes of 1% or less. Sharp and mobile is the bad combination: the tool is entitled to
   report one confident year and that year is not reproducible.
   **When an answer wanders, measure the neighbors' scores, not just the answer.** Watching the
   argmax move cannot tell a flat optimum from a moving peak, and the two call for opposite
   responses.
2. **A stop year quoted without the inputs it was derived from means very little.** The years a 1%
   nudge reaches differ by 4.5x in lifetime conversions and $3.7M in ending Roth, at 1.3-4.6% of net
   worth. Any comparison of arms "each at its own optimal stop year" is a comparison of two argmaxes
   that a rounding-scale input change would move. Hold it fixed, or report the band and its cost.
3. **`totalNetWealth` is already after-tax, and NOT on a shared basis.** `evaluateYearOutcome`
   (`optimizer_core.js:3801`) discounts the IRA at `sim.nominalTaxRate`, **that run's own final-year
   ordinary marginal rate**. So anything that ranks several runs by `totalNetWealth` - which is what
   `afterTaxWealthOfLogRow` returns whenever no Marginal Heirs Tax Rate is set, the default - is
   comparing plans valued at different discount rates. Measured at 34.21% against 26.89% between two
   candidates, $277,192 of pure valuation against a $6,949 margin. **Anywhere a metric ranks runs,
   check whether its valuation rate is shared across them.** This is separable from (1) and is a
   defect on its own.
4. **The refutation is the part to imitate.** (3) was found while explaining (1) and looked exactly
   like its cause; the report nearly shipped saying so. The test is direct - if the per-run rate
   causes the wandering, a shared rate should calm it - and it says the opposite: 7 of 11
   perturbations move a shared-rate answer against the default's 3 of 11. **A mechanism that explains
   the observation is not thereby its cause.** The sensitivity is still unexplained.

Also: `A6` predicted being wrong is cheap and HELD at 0.075%, because it asked about the 0.1% band.
The same question over the years perturbation actually reaches gives 17x to 68x more. A prediction
can hold and still mislead if its scope is narrower than the decision it is quoted for.

## P35n endgame: the Phased tail should be a SEQUENCE, Cash -> Roth -> Brokerage - the PR-5 proportional spec is refuted (2026-08-10)

The endgame bake-off (`research/ENDGAME_DRAW_ORDER.md`, 144 cells starting AT the
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

## Stage 2 cyclic A/Bs: the harvest top-off is a pre-step-up design, and "money on the table" cuts both ways (2026-08-10)

Two research inputs shipped in the `:1432` harvest branch (`cycleHarvestMode`, `cycleCoexist`),
default off, absent≡off byte-identical + leak-guard + MAGI-tier tests, suite 238/238. A/Bs in
`research/BROKERAGE_DRAW.md` (q5/q6). All three S2 predictions WRONG:

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

Full tables: `research/STRATEGY_FAMILY_RANKING.md` (P36 round 1) and `research/BROKERAGE_DRAW.md`
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

## Two traps this work fell into, both caught only by cross-validating against brute force

1. **A coarse probe grid silently invents wrong answers.** The first `breakEvenHeirsRate` used 8 evenly-spaced conversion amounts across the IRA instead of the real $25k sweep. It reported "never pays up to 75%" for the default scenario (true answer: 48%) and overstated the low-spend threshold as 25% (true: 15%). The paying amounts are small relative to the IRA (~16%), so an even grid steps straight over them. Both errors pushed the reported rate *up*, which would talk a user out of a conversion that does pay. The fix was to use the same $25k grid as the sweep, exiting on the first improvement.
2. **"No IRA left at the end" does NOT mean "no conversion opportunity."** A filter skipping drained-IRA candidates looked obviously safe and lost the right answer on a $3.3M scenario (reported 25% against a true 5%). A plan that spends its IRA down still gains from converting *earlier*, because that moves growth into the Roth — it is not only about a terminal tax bill.

Neither was visible from reading the code or from a green test run; both surfaced only by scoring the fast path against an exhaustive scan on the same fixtures. **Anything that replaces a full sweep with a heuristic grid must be diffed against the sweep it replaces, on several scenarios, before it is trusted.**

## Rate-axis monotonicity (the binary search precondition)

`breakEvenHeirsRate` binary-searches the rate axis, which is only valid because "conversions pay" never switches back off as the assumed rate rises. Measured at 2.5pp steps across default / low-spend / large-IRA / reserve-on / high-growth: monotonic in all five. This is **measured, not assumed** — `nominalTaxRate` is a bracket step function, the same hazard that forced `bestConversionStopYear` to scan linearly. A test pins the property so a future change can't break the search silently.

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

**`sim.nominalTaxRate` is a discrete bracket-table step function, not continuous.** It's the `nr` field from `taxengine.js`'s bracket tables (via `calculateProgressive()`/`findUpperLimitByAmount()`), looked up fresh each year based on whichever bracket that year's top marginal dollar falls into. Used to discount an ENTIRE remaining IRA balance in `totalNetWealth`/`convOC` valuation. Because it's a step function, two simulate() runs with slightly different income trajectories (e.g. an actual run vs. its conversion-suppressed counterfactual) can cross the same bracket boundary in different years, producing a one-year valuation "jump" in their relative comparison that has nothing to do with that specific year's dollar amounts -- pure timing-mismatch noise. This was originally described here as "the same underlying gap" as the pre-existing "TAX GAP" comment in `routeSurplusAndConvert` -- **PF10 disproved that and the comment is now gone** (that path is a pure reallocation with no tax netted out of it; see the PF10 notes above). The step-function noise described in this paragraph is real and independent of that comment. PF6's sustained-crossing Break Even definition already absorbs/suppresses this noise at the stat level (a lone blip surrounded by negative years correctly reports "never breaks even") -- but the per-year convOC column itself can still show this noise, which is fine/expected once understood, not a bug.

**`_convSavings` (realized lifetime tax $ saved) and `convOC`/`convBEYear` (after-tax wealth, deferred-tax-aware) are different metrics that can disagree.** `_convSavings` only sums `totals.tax` actually paid during the simulated horizon; it never reserves for tax still owed on whatever IRA balance a counterfactual/lesser-conversion plan has left standing. `totalNetWealth`/`convOC` explicitly discount remaining IRA balance by the applicable tax rate every year, so they're the more complete "did this actually pay off" answer. A strategy can look great on Conv Savings while never reaching Break Even. General pattern to watch for in this codebase: any metric summing `totals.tax` alone (realized-only) vs. any metric built from `totalNetWealth` (after-tax, deferred-liability-aware) are not directly comparable and can point opposite directions.

**Top-N-by-finalNW selection pools are orthogonal to conversion-specific outcomes.** The Optimizer's Phase-23 "top 5 successful strategies" is chosen by each family's BASE (non-extra-conversion) finalNW -- a criterion unrelated to whether THAT family's conversions specifically would break even. A lower-finalNW family could be the true best converter and never get evaluated for it. Relevant if extending Break Even search to a smarter/broader pool later (see task_plan.md Phase PF8 issue 3 tiers).
> **Confirmed empirically 2026-07-16 (PF10), now tracked as PF11.** No longer hypothetical. On a $2M-IRA/$90k-spend scenario the top-5 were all cyclic `fixedpct` rows whose sweep correctly returns `optConv: 0` (extra conversion strictly hurts them: $9,266,756 at $0 → $8,635,273 at $150k), while `propwd` at rank **6** returns **$125,000** and never gets considered. Result: zero ⇌ rows for a plan that genuinely has a good conversion answer. PF10 defaulted Optimize Conversions ON, so this now fires for everyone rather than only for users who opted in.

## Phase 22: Guyton-Klinger Research Notes

**Primary sources:** Guyton (2004) "Decision Rules and Portfolio Management for Retirees: Is the 'Safe' Initial Withdrawal Rate Too Safe?", Guyton & Klinger (2006) "Decision Rules and Maximum Initial Withdrawal Rates". Both published in Journal of Financial Planning — accessible.

**Key finding from literature:** GK supports initial WR ~5.2–5.5% with ruin probability similar to 4% static rule, because guardrail adjustments absorb sequence-of-returns risk. The cuts in bad sequences prevent catastrophic depletion.

**Standard guardrail parameters from original paper:** ±20% from IWR triggers ±10% spending adjustment. These are defaults — make configurable.

**Rule ordering matters:** Apply Inflation Rule (skip/apply CPI) *before* guardrail checks. Guardrails check post-inflation-adjusted spend vs current portfolio.

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

## PF11 + PF13 Findings: conversion candidate pool + optimizer ranking (2026-07-20)

**Ranking by ending wealth is orthogonal to "who benefits from converting."** The Optimize Conversions candidate pool was `results.filter(success).sort(finalNW desc).slice(0,5)`. Measured on a $2M-IRA/$90k-spend scenario, all five slots went to cyclic `fixedpct` rows that correctly return `optConv: 0` (extra conversion strictly hurts them), while `propwd` at rank 6 returns a real conversion and was never considered. **A flat top-N over a homogeneous metric lets one strategy family monopolize every seat.** Fix: pick the best row per FAMILY (`selectConversionCandidates`), which guarantees structural diversity instead of hoping a scalar surfaces it.

**`finalNW` is not comparable across plans and must not be used to rank them.** `finalNW` = terminal `totalNetWealth`, which discounts each run's remaining IRA at *that run's own* `sim.nominalTaxRate`. Two plans are therefore valued with two different tax rates, and it ignores spendable entirely (the hoarding bias v11.1098 already removed from baseline ranking). Anything comparing plans must use a SHARED rate: `afterTaxNetWorth(terminal, sharedRate, capGainsRate)`. PF11 moved the conversion sweep's own objective onto `_baselineScore` for the same reason. **Rule: a per-run rate belongs inside a run, never in a cross-run comparison.**

**Family keys need more than `_strategy`.** IRMAA Ceil rows carry `strategy:'bracket'` with `stratIRMAATier` 0-4, while Fill Bracket carries `strategy:'bracket'` with tier -1. Keying a family map on `_strategy` alone silently merges two sweeps that answer different questions and drops one. Cyclic must also be its own dimension, since the observed failure was exactly cyclic rows crowding out the non-cyclic champion of the *same* strategy.

**Equality objectives need a wealth floor or they reward poverty.** "Tax Flexibility" (equal after-tax buckets) is degenerate on its own: a plan that drains every bucket to near-zero is perfectly "equal" and would win. Implemented as two-stage instead: take plans within 10% of the best after-tax net worth, then rank those by smallest bucket spread `(max-min)/total`. The cutoff `maxNW - 0.10*|maxNW|` (not `maxNW*0.9`) is required so a negative maxNW still produces a cutoff BELOW it. **General: any "minimize dispersion" metric needs a quality gate, since dispersion is trivially minimized at zero.**

**Two separate `⚠️` mechanisms on ACA rows produced a contradictory display.** One was a hardcoded literal in the 400%-FPL parameter label string; the other the dynamic `_isACAUntenable` flag. Because the dynamic flag scales with the FPL cap (lower multiples breach MORE) and untenable rows are hidden by default, the ONE visible ACA row was the dynamically-feasible 400% row wearing a static warning, while the genuinely-untenable rows were invisible. **When a status glyph can come from two sources, one static and one computed, the static one will eventually contradict the computed one.** Fixed by deleting the static literal and adding the missing semantic check (`eitherOnMedicareAtStart`): once one spouse is on Medicare their RMDs/SS push household MAGI past any FPL cap, so every ACA row is untenable, not just some.

**Sorting and ranking were two different orders shown at once.** The objective drove the ⚓ baseline pick and the Rank column, but the table body stayed sorted on `afterTaxNW` regardless — so Rank numbers appeared shuffled down the page. Unified with a `sortState.colKey === '__objective__'` sentinel: the default body order IS the objective order, and a column-header click is an explicit user override that the next objective change resets. **If you render a rank number, the default row order must be that rank, or the UI is telling two stories.**

**GOTCHAS (both cost real time):**
- Driving inputs from the console requires `DisplayHelpers.setDollarValue(id, v)`. `val()` reads `el.dataset.numVal`, not `el.value`, so a raw `.value =` assignment — even with `input`/`change` events dispatched — is silently ignored by `getInputs()`.
- `el.style.display = ''` does not mean "visible", it means "remove the inline value and fall back to the stylesheet." For an element whose layout came from an inline `display:flex`, that silently downgrades it to `block`. Set the literal (`'flex'`) when un-gating something that was inline-styled.

**A "filter the winners" fix is incomplete if a second code path also nominates rows.** PF13 item 2 filtered the per-metric winner pool (`feasibleSuccesses`) so an infeasible row could not win a metric. But the "Best" summary has a SECOND source: the ⚓ baseline row, chosen by `recomputeBaselineForObjective`, which had no feasibility filter at all. An infeasible `Fill Bracket (no conv) ⚠️` was still being pinned on top of the table and listed in the Best summary. Caught only by looking at a screenshot, after the programmatic check ("does the winner pool exclude infeasible rows?") had already passed. **When auditing "X should never appear in Y", enumerate every writer into Y, not just the one the bug report named.** The fix prefers feasible rows but falls back to the unfiltered set when every candidate is infeasible, so the Δ columns still have a reference.

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

## P64 — SALT / property tax: measured 2026-08-19, and the answer is "almost never"

**Question the user asked:** the SALT limit is high now but falls to $10k in 2029/2030; is modelling
property and local taxes worth an input at all? Measured before building anything.

### The measurement

Harness: `salt_study.js`, `salt_conv.js`, `salt_bound.js` (scratchpad, node-only, not shipped).
Grid: propTax 0 / 5k / 12k / 25k / 30k / 40k / 60k x states CA, NY, PA, TX, FL x a mid household
(~$3.4M, $160k spend) and a large one (~$9.4M, $300k spend, $120k pension) x bracket-fill targets
12 / 22 / 24 / 32 / 35%.

**Upper bound, large household, $60,000 of property tax:**

| state | d lifetime federal tax | d final after-tax NW | fed delta 2026..2030 |
|---|---|---|---|
| TX | **-1,843** | +7,202 | -1476, -867, -649, -424, **0** |
| FL | **-1,843** | +7,202 | -1476, -867, -649, -424, **0** |
| CA | **-2,179** | +18,810 | -1476, -867, -649, -424, **0** |
| NY | **-1,575** | +6,765 | -1476, -867, -649, -424, **0** |

- **It saturates.** $40,000 and $60,000 give identical results: the cap binds.
- **It is entirely 2026-2029.** Every 2030 delta is exactly zero, which is the user's own point,
  confirmed rather than assumed.
- **It shrinks every year inside the window** - 1476, 867, 649, 424 - because the standard deduction
  is inflation-indexed and the cap is not. The indexed deduction outruns the flat cap and closes the
  itemizing gap before the sunset even arrives.
- **Final net worth moves 0.02% to 0.06%** on a $32M terminal balance.

**Analytic ceiling, which the measurements match.** The gain is only the excess of capped SALT over
the standard deduction: `(40,000 - federalStdDeduction) x marginal rate`, for four years only. At 2.5%
inflation with both filers 65+, that gap runs about 4,500 / 3,600 / 2,700 / 1,800 and then stops. So
**no household can gain more than roughly $4,000 of lifetime federal tax from this**, whatever its
property tax bill and whatever state it lives in.

### Does it change a DECISION? No.

Best bracket-fill target across 18 (scale x state x propTax) cells: **12% in 17 of them**, unchanged
by property tax. The single flip - big/CA at $12,000 choosing 24% over 12% - is $32,197k vs $32,194k,
a 0.01% margin that flips back at $25,000. That is noise, not a decision.

**The phase-down cliff hypothesis is refuted.** The theory was that a conversion lifting MAGI from
$400k to $600k erases up to $30,000 of cap and adds ~4.8 points of effective marginal rate. Measured
on the large CA household, moving the bracket target from 24% to 32% costs $2,926,207 of final wealth
at propTax 0 and $2,945,017 at propTax 25,000 - a difference of $18,810, or 0.6% of the cost of that
decision. The cliff is real arithmetic but it is dominated by everything else in the run.

### Why no-income-tax states are NOT the sweet spot

The pre-measurement guess was that TX and FL matter most, since property tax is their entire SALT
figure. Wrong, and backwards: property tax alone must clear the whole standard deduction (~$32,200
plus age bumps) before it buys anything, so **TX and FL show exactly zero at $30,000** and only start
at $40,000. CA and NY reach the cap on state income tax alone, so property tax adds nothing beyond it.
The band where it does anything is narrow at both ends.

### Recommendation

Keep the threaded parameter and the 2029 fix; both are corrections. **The full Optimizer UI input is
not justified by these numbers** - it would add a field, a growth-mode control and its help text to
buy at most ~$4,000 of lifetime tax and no decision change, on a model where the effect is
structurally dead from 2030. See task_plan P64 for the shipped/deferred split.

### P64d — the SALT cap and its phase-out threshold are both indexed, and the code has neither

Researched 2026-08-19. Sources are secondary summaries of P.L. 119-21 (Sec. 164 as amended), not the
statute itself; treat as research notes, not citations of record.

| tax year | cap (single/MFJ/HoH) | MAGI phase-out threshold |
|---|---|---|
| 2025 | $40,000 | $500,000 |
| 2026 | **$40,400** | **$505,000** |
| 2027-2029 | prior year x 1.01 | prior year x 1.01 |
| 2030+ | $10,000 (TCJA floor) | n/a |

- The 1% is a **statutory step applied to the prior year's figure**, not a CPI adjustment.
- Phase-down is **30 cents per dollar** of MAGI above the threshold and **stops at $10,000** - it
  never falls below the TCJA floor.
- MFS is half of each figure throughout. This engine does not model MFS, so nothing to do.

**What the code had:** `capHigh: 40000` flat with a comment claiming "increases 1%/yr through 2029"
that nothing implemented, and `phaseoutThreshold: 500000` flat with no comment at all. So **tax year
2026 - the current year - was already being priced $400 low on the cap and $5,000 low on the
threshold**, and the gap widens every year to 2029.

**Why it matters more than $400 sounds.** The P64c measurement found the deduction window closes
early because the standard deduction is inflation-indexed while the cap was modelled as frozen. The
cap is not frozen; it is indexed, just at 1% rather than at CPI. So the real closing is slower than
measured - but 1% still loses to 2.5% inflation, so the direction of the P64c finding is unchanged and
its conclusion stands.

**Rounding is the one open question.** 2026 is exactly $40,400 = $40,000 x 1.01, so the statute is
consistent with plain compounding at the first step. Whether 2027-2029 round to the dollar, to $50, or
to $100 is not established by these sources. The implementation compounds without rounding, which can
differ from the published figure by a few dollars of DEDUCTION - at most a dollar or two of tax. Worth
correcting if an IRS revenue procedure states the convention.

## P65 — the rest of Schedule A, and why medical is the only piece that likely matters

Raised by the user 2026-08-19, immediately after P64 shipped, from the question of whether the SALT
cap is additive to the standard deduction. **It is not** - SALT is a Schedule A itemized deduction, so
it is strictly either/or against the standard deduction. The user's instinct was right about the OBBBA
**senior deduction**, which IS additive: it sits above the line on Schedule 1-A and applies whether you
itemize or not. `taxengine.js` already models both correctly - `useItemized ? saltItemized :
federalStdDeduction`, then `federalDeduction += seniorDeduction` unconditionally.

### The gap the question exposed

**`calculateTaxes` treats SALT as the ONLY itemized deduction.** There is no parameter for mortgage
interest, charitable contributions, or medical expenses above the 7.5%-of-AGI floor. So the engine
asks "does SALT alone beat the standard deduction", which is a much harder bar than the one a real
filer faces, and a household that genuinely itemizes is told it takes the standard deduction and is
charged too much federal tax.

**This directly qualifies the P64c measurement.** The ">=$4,000 of lifetime tax, no decision moved"
result was measured on a model that under-itemizes. Once a household is over the itemizing line for
any reason, the marginal property-tax dollar is worth its full marginal rate up to the cap, instead of
being worth nothing until SALT alone clears ~$32,200. The P64 conclusion is sound for the model as it
stands; it is not a statement about real filers with a full Schedule A.

### Which line items actually matter for THIS tool's users, per the user

- **Mortgage interest - unlikely.** Significant mortgage deductions are less likely for retirees. Not
  worth an input on its own.
- **Charitable - mostly routed around Schedule A, but not entirely.** A well-advised retiree gives
  through a QCD or by donating appreciated assets rather than cash. **The QCD genuinely bypasses
  Schedule A**: it is an exclusion from income, not a deduction, and the engine already models it
  correctly in `computeAnnualQCDs`. **A gift of appreciated stock does NOT bypass it** - that is an
  itemized deduction at fair market value, subject to the 30%-of-AGI limit, so it lands on Schedule A
  like any other charitable contribution. It also stays available to retirees who are not yet QCD-
  eligible, and to anyone giving above the annual QCD limit. So charitable is smaller than a naive
  model would assume, but it is not zero.
- **Medical above 7.5% of AGI - the one that likely qualifies, and it can be large.** Retiree medical
  is lumpy: most years nothing clears the floor, and then a year of long-term care, a nursing home, or
  a major procedure can run well into six figures and dominate Schedule A by itself. That is exactly
  the year a household itemizes, and exactly the year the SALT figure suddenly becomes worth its full
  marginal rate. It is also the year a Roth conversion is cheapest, which makes it a strategy question
  and not only an accuracy question.

### Shape, if it is ever built

The lumpiness is the whole difficulty. A flat annual medical figure would be wrong in both directions:
it would create itemizing in years that would not have it and miss the spike year that matters. This
belongs with the Lumpy Spending work (P42) rather than as a scalar input, or as an explicit
"high-medical years" range. **Not scoped, not measured, and it should be measured the way P64 was
before any input is built** - the same discipline caught P64's answer being "no".

**Note the interaction to check first:** a big medical year raises itemized deductions AND is usually a
big withdrawal year, so AGI rises too, which raises the 7.5% floor. The two move against each other
and the net is not obvious without measuring.


## 2026-08-21 - P32d scoping: the harness `q2()` has been silently skipping, and the cap counter can false-positive

**Measured, not read.** Ran `node .test_harnesses/brokerage_harness.js` in full. Line 89 of the output:

```
  SKIPPED: engine does not expose totals.tpBrokIters, so the research flags
  are not wired in yet. Q1 above still stands on shipped behavior.
```

**`q2()` was written before the arms existed and guessed their names wrong.** It probes
`probe.totals.tpBrokIters` (`brokerage_harness.js:207`) and reads `t.tpBrokMaxIters` /
`t.tpBrokNonConverged`. The engine ships `totals.thirdPassBrokerIters`,
`totals.thirdPassBrokerCapped` and `totals.thirdPassBrokerStalled` (`optimizer_core.js:2138-2140`).
Nothing matches, so `supported` is false and the whole question prints SKIPPED. It has been
green-looking and inert since v11.1582. Its arm table is wrong too:
`forcedIRAAllowBrokerage: true` (`:203`), where the engine wants the string `'brokerageFirst'`
(`:2027`) - a boolean is neither `'off'` nor `'brokerageFirst'`, so that arm would silently take the
`_fibArm !== 'off'` path and read as enabled by luck rather than by contract.

**Consequence for the preliminary numbers.** The 8-scenario table in the 2026-08-17 entry was NOT
produced by this harness - it cannot have been. It came from a separate scratch run, which is why it
is 8 hand-picked scenarios instead of the harness's 5 x 11 grid.

**A second trap, found by reading the loop rather than running it.** The Capped counter can
false-positive at the `bounded` cap. The loop is `for (; _it < _cap; _it++)` with the convergence
test `if (_res <= 1 ...) break;` at the TOP of the body (`optimizer_core.js:2118`). A year that
consumes all `_cap` draws exits on the loop condition without ever running the test again, so `_it
=== _cap` and it is counted as Capped - even if the residual it just closed would have tested `<= 1`
on the next pass. At `bounded`'s cap of 6 that is a live risk; at `unbounded`'s 200 it is not.
**Therefore: no Capped year in the bounded arm is spiral evidence on its own. It has to be re-checked
against the same scenario under `unbounded` before the word "spiral" is used.** This is the same
species of mistake the stall guard already fixed once.

**Where the Brokerage leg actually sits.** Confirmed against the code, since the ordering decides
what the arm can possibly do: the third pass draws Cash (`:2059`), then the arm's Brokerage leg
(`:2066-2072`), then the Roth fallback (`:2074`). The re-draw loop (`:2107-2137`) runs after the
tax recalc and re-prices realized gains each pass. Ordered strategies are excluded from both, so
`ord-CBIR` / `ord-RIBC` / `ord-BIRC` are inert arms in Q2 and should be reported as inert, not as
zero.

**One stale instruction in the task.** `P32d` says "Re-run Q1's numbers first, since they were
measured on the double-crediting engine." That was already done - `P32e` records "Q1 re-run post-fix:
three families UP, cyclic -0.8pt, never-draw still 0/55". Do not re-run it a third time.


## 2026-08-21 - P32d-1/2/3 built and run: no spiral anywhere, and the TWO arms point opposite ways

`q2()` repaired, widened, and run. Grid: 3 basis x 3 states x 2 dividend rates x 5 scenarios x 11
strategy arms x 5 Q2 arms = **4,950 runs**, of which 3,960 are armed. ~0.7ms per `simulate()`, so the
whole thing is a few seconds - cost was never the reason this went unmeasured.

### The spiral does not exist on this grid

```
SPIRAL VERDICT: capped years = 0   (the ONLY spiral evidence);  stalled years = 2545
arm          runs w/ iters    total iters      max iters      CAPPED yrs     stalled yrs
bounded           461/990          12732             74               0             892
unbounded         461/990          12732             74               0             892
bnd+fib           461/990          12601             74               0             761
```

**Zero capped years in 3,960 armed runs**, and `bounded` is byte-identical to `unbounded` on every
counter. That identity is the load-bearing part: `bounded` caps at 6 passes and `unbounded` at 200,
so if any year had ever wanted a 7th pass the two columns would differ. They do not, anywhere on the
grid. **`P32d-4`'s cap-artifact re-check is therefore moot - there is nothing to re-check.**

The comment at `optimizer_core.js:2044` asserts a cap-gains spiral as the reason Brokerage is
excluded from the third pass. On this grid that reason is **not supported**. Prediction **P5** (no
divergence, bounded feedback because SS inclusion caps at 85% and LTCG tops out at 20%) scores
**RIGHT**.

`max iters = 74` is a **run total**, not a per-year depth - it sums `thirdPassBrokerIters` across
every year of a 24-year plan. Do not read it as "74 passes in one year"; the bounded/unbounded
identity already proves no single year exceeded 6.

**The 2,545 stalled years are not a counter-finding.** Stalled means the residual stopped improving
while Brokerage still held a balance - dust, or a draw whose own tax eats the draw. Without the stall
guard those years would have consumed the whole cap and read as divergence, which is exactly the
mistake the guard was added to prevent.

### Axis readings, and why widening was worth it

| axis | total iters | capped | stalled | armed runs |
|---|---|---|---|---|
| basis 20% / 50% / 80% | 13,088 / 12,652 / 12,325 | 0 / 0 / 0 | 827 / 874 / 844 | 453 / 465 / 465 |
| state CA / NY / TX | 12,362 / 15,718 / 9,985 | 0 / 0 / 0 | 950 / 889 / 706 | 480 / 480 / 423 |
| dividend 0% / 2% | 20,873 / 17,192 | 0 / 0 | 1,796 / 749 | 771 / 612 |

Basis barely moves the iteration count, which is itself the finding: the axis chosen as the spiral's
*amplitude* does not amplify it. NY works the third pass hardest (15,718 iters vs TX's 9,985), which
is the state tax rate feeding `_brokTaxRate` exactly as expected. Dividends **suppress** the arm
rather than feed it - at 2% there are fewer armed runs and less than half the stalled years, because
the dividend income closes part of the gap before the Brokerage leg ever fires.

### The finding that actually matters: the two arms are not one decision

```
funded-year movers BY ARM
arm                movers      better       WORSE
bounded               11           9           2
unbounded             11           9           2
brokFirst             97           9          88
bnd+brokFirst        101           9          92
```

**`brokFirst`'s 9 winning cells are set-identical to `bounded`'s 9** (checked as a set, not
eyeballed). It buys nothing the third-pass arm does not already deliver and pays 88 losses for it,
so on funded years the third-pass arm **strictly dominates** it. All 9 are `minlimit` rows; both of
`bounded`'s 2 losers are `brokPoor/minlimit` NY.

- **`thirdPassBrokerage` rarely fires and mostly helps** - 11 movers out of 990, 9 of them better.
- **`forcedIRAAllowBrokerage` (`brokFirst`) fires constantly and mostly hurts** - 97 movers, **88 of
  them worse**, and `bnd+brokFirst` is dominated by the `brokFirst` half. The preliminary 8-scenario run saw this shape once
  (BASE fixed, five fewer funded years); at grid scale it is the rule, not an outlier.

Worst cases are severe, not marginal: `capbase/fixedpct2 b20 CA d0` under `brokFirst` goes **24 funded
years -> 5** while erasing $2,238,492 of forced IRA down to $270,857 and *raising* final net worth by
$1,343,512. A ship decision made on the forced-IRA column or the net-worth column alone would read
that as a $1.3M win. It funds nineteen fewer years of the plan.

### Corrections to earlier notes in this file

- The 2026-08-17 entry's grid claim was repeated in my own scoping note as "one state, zero growth,
  zero dividends". **`CAP_BASE` growth is 0.05, not zero** - `dividendRate: 0.0` is the part that was
  right. The preliminary run was a separate scratch script, not this harness, so its exact fixture is
  not recoverable from the repo.
- `brokFirst` never sets `thirdPassBrokerIters` (0/990 runs). Correct and not a bug: it is the
  funding backstop, a different loop, and it has no counter of its own. If it ever needs iteration
  evidence, one has to be added.
- **Arm labels renamed 2026-08-21** at the user's request: `fib` -> `brokFirst`, `bnd+fib` ->
  `bnd+brokFirst`. `fib` read as Fibonacci and hid which of the two exclusions was under test.

## P23m: the AR(1) inflation constants, fitted against the in-repo CPI-U record (2026-08-23)

The planned P23 defaults (persistence 0.65, shock sd 1.20%) were guessed. `historical_returns.js`
already carries BLS CPI-U December-over-December for 1928-2026, so the fit is a repo fact, not a
literature citation. OLS of `cpi_t` on `cpi_{t-1}`, three windows:

| window | n | persistence | shock sd | implied target | stationary sd | half-life | actual sd |
|---|---|---|---|---|---|---|---|
| 1928-2025 | 98 | 0.609 | **3.09%** | 3.21% | 3.89% | 1.40y | 3.89% |
| 1948-2025 | 78 | 0.670 | **2.12%** | 3.46% | 2.85% | 1.73y | 2.81% |
| 1990-2025 | 36 | 0.274 | **1.31%** | 2.54% | 1.37% | 0.53y | 1.46% |
| *planned* | - | *0.650* | *1.20%* | - | *1.58%* | *1.61y* | - |

**The persistence guess was good; the shock sd guess was not.** 0.65 sits between the 1928 and 1948
fits. 1.20% is roughly half the 1948-2025 residual sd, and the planned stationary sd of 1.58% is
about 55% of the record's 2.81%.

### Three claims made while planning this, and what the measurement did to them

**1. "The planned AR(1) can never produce a 1970s." False.** 20,000 simulated 40-year paths at the
planned constants produce a five-year run above 5% inflation in **8.7%** of paths, with a worst-path
peak of 10.28%. Tame, not impossible. The correct statement is that it is roughly four times too rare
and never reaches the record's 13.30% peak.

| constants | P(5-yr run >5%) | P(4-yr run) | worst-path peak |
|---|---|---|---|
| planned 0.650 / 1.20% | 8.7% | 17.8% | 10.28% |
| fit 1990-2025 0.274 / 1.31% | 0.1% | 0.9% | 9.42% |
| **fit 1948-2025 0.670 / 2.12%** | **39.6%** | 57.3% | 16.14% |
| fit 1928-2025 0.609 / 3.09% | 49.8% | 69.1% | 21.10% |

**2. "Eight consecutive years above 5%." False.** The record's longest such run, 1948-2025, is
**five** years, and the peak is 13.30%. The 1948-2025 fit's 39.6% is therefore close to right rather
than excessive: one five-year episode in 78 years means a random 40-year window contains it about 56%
of the time.

**3. "rho around -0.25 against the equity draw." Not supported as stated.** Equity's correlation with
the inflation shock is -0.026 (1928-2025), -0.183 (1948-2025), +0.095 (1990-2025) - near zero.
**Bonds carry the inflation sensitivity**: -0.247, -0.339, -0.384. The synthetic modes draw one
*blended* portfolio return, so the number rho multiplies is the blend's:

| window | 40/60 | 50/50 | 60/40 | 70/30 | 80/20 |
|---|---|---|---|---|---|
| 1928-2025 | -0.164 | -0.129 | -0.100 | -0.075 | -0.055 |
| 1948-2025 | -0.363 | -0.332 | **-0.296** | -0.262 | -0.231 |
| 1990-2025 | -0.200 | -0.125 | -0.059 | -0.006 | +0.036 |

-0.25 happens to land near the 1948-2025 60/40 blend, but the reasoning behind it was wrong: the
correlation lives in the bond sleeve, and it is a function of the user's asset mix, which the
synthetic modes do not model per account.

### Decision

**Default to the 1948-2025 fit: persistence 0.670, shock sd 2.12%, rho -0.30.** Reasons:

- 1928-2025 is inflated by Depression deflation and WWII price controls, regimes with no forward
  relevance, and it doubles the shock sd on that basis alone.
- 1990-2025 is the anchored-expectations era; persistence 0.274 and a 0.53-year half-life make
  sustained inflation essentially unreachable, which is the failure the whole change exists to fix.
- 1948-2025 reproduces the record's persistence episodes at close to the right rate, and its
  persistence is within 0.02 of the value already guessed.

rho is a single blended number standing in for a mix-dependent quantity. Document that limit rather
than pretending to more precision; a per-account synthetic mode would be the honest fix and is not
in scope here.

## P23q: GBM against AAM, and what variable inflation actually costs (2026-08-23)

Three runs of the real worker from the browser, default scenario, plan-only scope, 2,000 paths,
25-year horizon, seed 42, mu 7%, sigma 15%. GBM and AAM consume the same shock stream, so this is a
paired comparison rather than two samples.

| | GBM | AAM | GBM, inflation shock 0 |
|---|---|---|---|
| median annual return reported | **6.051%** | **7.000%** | 6.051% |
| worst / best single year | -47.06% / +105.71% | -62.47% / +73.26% | -47.06% / +105.71% |
| survival | 57.55% | 57.35% | **62.35%** |
| median ruin year | 2042 | 2042 | **2044** |
| median lifetime tax | $447,808 | $450,750 | $442,494 |
| median delivered spend | $3,110,501 | $3,110,501 | $3,110,501 |
| final p50 balance | $620,582 | $583,997 | **$737,629** |
| inflation | -1.00% to 13.77%, CAGR 3.18% | identical | flat 3.00% |

### The model swap is almost nothing; the inflation change is not

**GBM against AAM: 0.2 points of survival, an identical median ruin year, and identical delivered
spend to seven figures.** The reported centre moves a full point, from 6.051% to 7.000%, and the
outcome does not follow it. This is the prediction from the planning table holding up in the engine:
AAM changes what mu *means*, not what the plan is worth.

AAM in fact finishes slightly *lower* (final p50 $583,997 against $620,582), which is the right
direction and worth stating because it reads backwards. GBM's arithmetic mean return is
`e^0.07 - 1 = 7.25%`, above AAM's 7.00%; GBM's *median* draw is the one that sits below. Reporting a
higher centre and delivering a lower balance is exactly the confusion the two-mode comparison exists
to make visible.

The tail shapes differ as expected: GBM's lognormal reaches +105.71% in a good year and floors around
-47%, while AAM's normal is symmetric, -62.47% to +73.26%. Neither hit RETURN_FLOOR at sigma 15%.

**Variable inflation costs 4.8 points of survival, two years of median ruin, and $117,047 of median
terminal wealth**, against the flat rate the tab used to run. That is more than twenty times the
GBM/AAM difference. The returns half of this phase is a labeling fix; the inflation half is a
correction to what the tab was reporting.

Note that delivered spend is identical across all three runs, so this is a clean wealth and tax
comparison, the same property the P24 stop-year sweep had.

### Verification that the separate inflation PRNG stream works

`medianAnnualReturn`, `minAnnualReturn` and `maxAnnualReturn` are bit-identical between the GBM run
with default inflation and the GBM run with the shock set to 0. The inflation model cannot move a
return draw, which is what makes "GBM is unchanged" checkable rather than asserted. A node test
pins this against a verbatim copy of the pre-P23 bank build.

The simulated inflation range, -1.00% to 13.77%, brackets the real record's 13.30% peak (1979)
without being tuned to it.

## P75 prior art: i-ORP, e-ORP, and the LP/MILP retirement-optimization lineage (2026-08-25)

Gathered for P75 (year-by-year withdrawal mix). The point of the list: the LP formulation of
exactly this problem - per-year withdrawal and conversion amounts as decision variables, taxes as
piecewise-linear constraints - is proven tractable, ran in production for two decades, and has one
actively maintained open-source MILP descendant. None of the tools below carry this engine's
state-tax, ACA or widow fidelity, which is the differentiator and the expensive part. All URLs
verified 2026-08-25.

### i-ORP (James S. Welch Jr.) - the original. i-orp.com is DEAD (NXDOMAIN); archive-only.

| What | URL |
|---|---|
| Site root (last good, Oct 2021) | https://web.archive.org/web/20211015194156/https://i-orp.com/ |
| Main planner input form | https://web.archive.org/web/20201111233257/https://www.i-orp.com/Spend/extended.html |
| Docs/papers index | https://web.archive.org/web/20230321202349/https://www.i-orp.com/Spend/articles.html |
| **ORP Model Description - 2008 overview paper; READ 2026-08-25, see note below: equations NOT included** | https://web.archive.org/web/20200710001724/https://www.i-orp.com/ModelDescription/ModelDescriptionK.pdf |
| Validating the Optimal Retirement Planner | https://web.archive.org/web/20190131144141/https://www.i-orp.com/ModelDescription/validation.pdf |
| Full user manual | https://web.archive.org/web/20220330074804/https://i-orp.com/Plans/help/ORPHelp.html |

**Welch papers** (titles from the site's own articles page):

| Paper | Venue | URL / status |
|---|---|---|
| Mitigating the Impact of Personal Income Taxes on Retirement Savings Distribution | J. Personal Finance 14(1), 2015 | archive-only: https://web.archive.org/web/20221205051603/http://www.i-orp.com/modeldescription/mitigatedtaxes.pdf |
| Measuring the Financial Consequences of IRA to Roth IRA Conversions | J. Personal Finance 15(1), 2016, pp.47-55 | archive-only, full issue: https://web.archive.org/web/20200920211020/https://www.i-orp.com/ModelDescription/Vol15Issue1.pdf |
| A 3-Step Procedure for Computing Sustainable Retirement Savings Withdrawals | J. Financial Planning 30(8), Aug 2017 | LIVE: https://www.onefpa.org/journal/Pages/AUG17-A-3-Step-Procedure-for-Computing-Sustainable-Retirement-Savings-Withdrawals.aspx |
| A Quantitative Evaluation of Four Retirement Spending Models | J. Personal Finance 14(2), 2015 | archive-only: https://web.archive.org/web/20221205035107/http://www.i-orp.com/modeldescription/4spend.pdf |

### e-ORP - the successor the user had heard of and could not find. FOUND.

https://github.com/dcurrie/e-ORP - Doug Currie. Python + Jupyter, created 2025-07, pushes through
2026-03: actively maintained. A **genuine MILP re-implementation**, not a mirror or scrape:
`solver.py` builds a `pyscipopt.Model()` (SCIP) with per-year continuous and binary decision
variables and maximizes year-0 discretionary spend. README: "Inspired by the now unmaintained
(and unavailable?) i-ORP by James S. Welch Jr." Covers federal tax MFJ/SGL/HoH, the OBBBA senior
deduction, IRMAA Part B/D, RMDs, Roth conversions, cap gains, survivor benefits, and smile-curve
spending. Does NOT cover Monte Carlo, state tax, or the ACA cliff.

### DiLellio & Ostrov - the academic line

| Paper | Venue | URL / status |
|---|---|---|
| Optimal Strategies for Traditional versus Roth IRA/401(k) Consumption During Retirement | Decision Sciences 48(2):356-384, 2017, DOI 10.1111/deci.12222 | free PDF, LIVE: https://etfmathguy.com/wp-content/uploads/2022/03/DiLellio-and-Ostrov2017-Optimal-Strategies-Dec-Sci.pdf |
| Toward constructing tax efficient withdrawal strategies for retirees with traditional 401(k)/IRAs, Roth 401(k)/IRAs, and taxable accounts | Financial Services Review 28(2):67-95, 2020 | open access, LIVE: https://openjournals.libs.uga.edu/fsr/article/view/3419 |
| Optimal decisions under price dynamics for Roth conversions (DiLellio solo) | Financial Planning Review, 2023, DOI 10.1002/cfp2.1174 | live, bot-blocked; open in a browser |

Predecessor ORP's own paper cites as the only earlier LP retirement calculator, and the closest
thing to a PUBLISHED equation set in this lineage: Ragsdale, Seila & Little, "An Optimization
Model for Scheduling Withdrawals from Tax Deferred Retirement Accounts", Financial Services
Review, March 1994 (author names transcribed from the paper's reference list; its OCR garbles
them - verify before formal citation). Research-only implementation, never public.

### Adjacent open-source LP/MILP planners

- https://github.com/wscott/fplan - Python LP; README cites Welch directly ("similar to the ideas
  of James Welch at www.i-orp.com"); active, push 2026-08.
- https://github.com/mdlacasse/Owl - Python MILP via HiGHS/MOSEK; co-optimizes the Social Security
  claiming age; the most active of the group, push 2026-08-25.
- https://github.com/willauld/rplanlib - Go LP library, `willauld/fplan` front-end; stale since
  2019.

### Honesty notes

- Welch's death is UNCONFIRMED. The Bogleheads thread (July 2022,
  https://www.bogleheads.org/forum/viewtopic.php?t=379689) says only that he could no longer
  maintain the site and was seeking a successor. Say "unmaintained/offline since ~2022", nothing
  stronger.
- The DiLellio & Ostrov 2020 abstract describes all-years global optimization "in contrast to
  most previous approaches that chronologically generate a suboptimal strategy" but does not name
  the technique. Verify inside the PDF before citing it as "DP-based".
- SSRN, Wiley and bogleheads.org return 403 to automated fetchers but load in a browser; that is
  bot-blocking, not link rot.
- ModelDescriptionK.pdf READ in full 2026-08-25 (28 pp, Welch 2008, "Optimal Distributions from
  Tax-Advantaged Retirement Accounts"). It is the model DESCRIPTION, not the formulation: no
  decision variables, constraint equations or objective are ever written out (the only equations
  in the paper are Appendix B's two compound-interest identities). What it does pin down:
  objective = maximize one level inflation-adjusted after-tax annual spending, with the desired
  estate as a constraint (dual of this repo's fix-spending-maximize-wealth objective); per-account
  balance recursions with exact timing in Appendix C (withdraw at start of year, contributions and
  growth at end, return = rate x (begin - withdrawal)); taxes linearized by splitting income into
  per-bracket slice variables - Table 6 prints those slices as columns (0/10/15/25%), the clearest
  evidence of the encoding; RMDs by the recalculation method; brackets inflation-indexed (the 2008
  model already did what P70 is auditing). The glossary says the system is solved "iteratively" -
  the only hint at how nonconvex pieces were handled; nothing is elaborated. Scope of the 2008
  model: no IRMAA, no ACA, no NIIT, no LTCG/basis distinction (After-tax account taxed annually on
  returns), no state tax in the base scenario; the site's later release directories (IRMAA,
  GOPtax, APenalty, bequest) show those grew afterward. For explicit formulations use e-ORP's
  solver.py and Ragsdale/Seila/Little 1994 above.

### Method glossary - the acronyms this entry and P75 use

**LP, linear programming.** Choose continuous variables x to maximize a linear objective c.x
subject to linear constraints Ax <= b, x >= 0. Solvers (simplex, interior-point) return the
GLOBAL optimum in polynomial time, and that optimum always sits on a VERTEX of the feasible
region. "Programming" means schedule, 1940s logistics usage, not source code - Welch's glossary
makes the same point. In the retirement mapping: variables are per-account per-year withdrawals,
transfers and per-bracket income slices plus the spending level; constraints are the balance
recursions, each year's cash requirement, RMD floors, bracket-slice widths and the estate floor.

**Why LP can price graduated brackets without integers.** Split taxable income into one variable
per bracket, each bounded by that bracket's width, and set tax = sum of rate x slice. Because
marginal rates never DECREASE, the solver fills the cheap slices first out of self-interest and
the encoding is exact. This is convexity doing the work, and it is the property Table 6 of the
2008 paper is printing. It is also what the P75 edge-menu argument rests on: optimum at a vertex
means optimum at a bracket or threshold boundary.

**Where pure LP breaks.** A cliff is nonconvex - the IRMAA tier edge (one dollar of MAGI buys a
fixed premium jump), the ACA subsidy cliff, the Social Security taxability hump where the
marginal rate spikes and then falls back. LP would happily take a fractional "30% crossed" and
pay 30% of a penalty that reality only sells whole. Two escapes: integer variables (MILP), or
iterate LPs with the nonconvex piece frozen at each pass - the latter is probably what ORP's
glossary means by solving "iteratively", though the paper never elaborates.

**MILP, mixed-integer linear program.** An LP in which SOME variables must be integers, usually
binary 0/1, while the rest stay continuous - "mixed" because both kinds appear in one model.
Binaries encode discrete logic that LP cannot express: if/then, either/or, which side of a
threshold. The cliff pattern, with M a large constant, z the binary "crossed" flag and S the
surcharge:

    MAGI <= threshold + M*z        z = 0 forces MAGI under the edge
    surcharge = S*z                crossing buys the whole penalty, never a fraction

Cost of the power: LP is polynomial, MILP is NP-hard. Solvers use branch-and-bound - solve the
LP relaxation with binaries allowed fractional, and when one comes back at 0.4, split into two
subproblems (z = 0, z = 1), recurse, and prune any subtree whose bound is already worse than the
best complete solution found. Add cutting planes and it is branch-and-cut. Worst case is
exponential, but a retirement model - a few dozen years, a few binaries each - is trivial scale;
modern solvers finish in well under a second. The property that matters: MILP is EXACT, it
terminates with a proven optimality bound rather than a heuristic's assertion.

**SCIP, Solving Constraint Integer Programs.** A specific solver, not a technique. From Zuse
Institute Berlin; among the fastest non-commercial MILP solvers, and it also handles constraint
programming and nonlinear extensions. Academic-license for years, Apache 2.0 since 2022.
`pyscipopt` is its Python binding, and it is the dependency that proves e-ORP genuinely solves a
MILP rather than mirroring i-ORP's output.

**Solver landscape**, for orientation: Gurobi and CPLEX are the commercial leaders; SCIP the top
open academic one; HiGHS is open, used by Owl, and notable here because it ships a WebAssembly
build that runs in a browser - the only candidate that could live inside this tool without a
server; CBC is the older COIN-OR workhorse.

**DP, dynamic programming.** Optimize by working BACKWARD from the horizon, computing a value
function over a discretized state, so each year's decision is scored against the exact optimal
continuation rather than a guess. Handles nonconvexity natively, unlike LP. Cost is the curse of
dimensionality - the state grid grows multiplicatively per dimension, which is why the P75 state
collapse (Roth and Cash factor out, since a dollar in either never touches a future tax) is what
would make a DP rung feasible at all.

**PWL, piecewise linear.** A function built from straight segments. Bracket tax is PWL and convex
in ordinary income; a cliff is PWL and NOT convex. The whole method choice in P75 turns on which
of those two a given tax feature is.

**Relevance to this repo.** P75's main line needs NO solver: the edge menu is the vertex set an LP
would have landed on, and coordinate descent over it keeps `simulate()`'s nonconvex fidelity -
cliffs, the Social Security torpedo, the widow transition, the state engine - which an LP cannot
represent honestly. Only the P75e stretch (convexify the cliffs to get a provable ceiling) would
pull in a solver, and HiGHS-WASM is then the only browser-compatible candidate.

---

## Perf gate baseline (pre-change, node 26.2.0, the reference machine)

The machine is the Ryzen AI 9 HX 370 named under "Perf claims must name the machine" below;
every timing here is a best case and scales 3.5-6x slower on the audience hardware.

simulate() 40yr couple, fee armed, growth+inflation on: 5 batches x 200 runs after warm-up:
106.7 / 110.7 / **114.0 median** / 121.6 / 135.2 ms; per-run 0.570 ms; totals.totalTime 0.511 ms.
Bench script: scratchpad `bench_simulate.js` (batch noise ~10x the 0.5% gate, so compare BEST-of-5
too: baseline best 106.7 ms).

## P87a - the bracket ceiling's income basis (2026-08-29)

Full report: `research/BRACKET_CEILING_BASIS.md`. Harness:
`.test_harnesses/bracketbasis_harness.js`.

The three sentences worth carrying without opening the report:

1. **The federal Limit entries are taxable-income thresholds spent as MAGI ceilings, and the gap is
   exactly one deduction.** Fill Bracket 22%: ceiling $211,400, MAGI $211,400, federal taxable
   income $179,200, deduction $32,200. Confirmed to the dollar, every year, growing to $70,876 by
   2054. **NEITHER OPERAND IS WRONG** - the bracket top is the right edge of the right bracket, and
   the deduction reconciles to the cent, OBBBA senior deduction and phase-out included. The defect
   is a UNITS MISMATCH: `iRAbracketRoom` subtracts GROSS income from a POST-deduction threshold and
   `bracketOverage` measures MAGI against it. Do not go looking for a bad number; there isn't one.
2. **Closing that gap COSTS money in 51 of 74 clean cells, median -$47,092 - and that is a fact
   about the STRATEGY, not a verdict on the fix.** A named ceiling is a contract to fill: the user
   picking `22% Fed` or `IRMAA Tier 2` wants the room between their spending and the limit
   converted or banked, and is not asking the tool to minimize their tax. The first version of this
   entry read the wealth result as a reason not to fix the defect. That judges a correctness
   question with a wealth metric. What the 51-of-74 actually says is that FILLING the 22% and 24%
   brackets is often a worse strategy than under-filling them - the Optimizer ranking's job to
   surface, and a changelog disclosure if the fix ships. An accidental hedge is not a design.
   The sign is set by the bracket (12% gains, 22% and 24% lose) and the separator is whether the
   plan was already breaching its ceiling to fund spending.

   Corollary worth carrying: **targets and caps are different controls sharing one `yr.limit`.**
   `n% Fed` and `IRMAA Tier n` are targets (reaching them is success); `n% FPL` is a cap (staying
   under is success). The engine splits them on BREACH behavior already, not on FILL behavior.

2b. ~~**Nothing sizes a conversion against the ceiling, and this gap is larger than the deduction
   one.**~~ **HEADLINE RETRACTED 2026-08-30 (user), and the retraction finished 2026-09-03 in
   `P106d`. The measurement below stands; the claim drawn from it did not.** Picking the limit IS
   the ceiling: `iRAbracketRoom` sizes the withdrawal to it and `convertExcessToRoth` turns the room
   above spending into the conversion, so the composition of the two sizes the CONVERSION against
   the ceiling by construction. Measured at a binding year: ceiling $243,600, MAGI landing on
   $243,600 to the dollar, $238,179 drawn, $145,721 to spending, **$92,458 converted**. The two
   models in the struck sentence below do not diverge in the ordinary case.
   **What the 74 cells actually measured is a statement about the MARGIN**, not the mechanism: when
   the ceiling MOVED by one deduction, total voluntary draw rose in only 18 cells and just 32% of
   the extra draw became conversion, the other 68% becoming IRA-sourced spending that displaced
   Brokerage and Cash. Conversions were unchanged in 29 of 74 - which is what a minority of binding
   years predicts, not a missing mechanism. Still true as mechanism description: `applyConversionGrossUp`
   never reads `yr.limit` (that thread ended in `P88`, COMPLETE), and "Maximize Conversions" is just
   those two flags. ~~User model: limit minus spending = conversion headroom. Engine model: limit
   sizes a withdrawal, conversion falls out of surplus routing.~~
   `P87g` is CLOSED, not open: `P88` and `P87c` settled everything it was waiting on.
3. **`minlimit` is governed entirely by `yr.IRMAALimit`, which is built from the SPENDING GOAL, not
   from the federal rate the user picked.** 0 of 40 cells respond to a federal ceiling change. Any
   claim about what `Min Limit n%` targets should be measured before it is believed.

## P92 decisions, and two corrections worth keeping (2026-08-29)

**Correction to my own summary.** I told the user that fixing the ceiling BASIS (P87b) and the
conversion SIZING (P87g) would also fix `Min Limit n%` being decorative. **It would not.** Those are
independent terms. `minlimit`'s ceiling is
`min(federal top, state top, min(goalLimit, IRMAA tier - margin))`, and the term that dominates is
`goalLimit` - the bracket top containing the SPENDING GOAL. Raising the federal side by a deduction
takes $403,550 to about $440,000; the min still selects $211,399 and nothing moves. Always check
which term of a `min` is binding before claiming a fix reaches it.

**`TAXData.SOCIALSECURITY` already carries the 85% figure** as the top bracket rate
(`SGL`/`MFJ` brackets ending `{l: 34000, r: 0.85}` / `{l: 44000, r: 0.85}`). So the P87c "SS should be
reduced to its taxable share, and the constant must come from tax data" requirement needs no new
field - read the last bracket's rate.

**Extra Conversion semantics, settled from the code so it is not re-argued.** The amount is the GROSS
withdrawn from the IRA, capped only by the IRA balance; tax is netted out of it, so less lands in
Roth than the number entered. `fundConversionWithCash` pays that tax from Cash instead but **does not
gate on the cash existing** - it blends, funding what Cash allows and netting the remainder. **Both
funding paths read `balance.Cash` only; Brokerage is never used to pay conversion tax**
(`optimizer_core.js:2869`, `:3113`).

**Verified: `startAge` behaves as intended.** Past it, no-op (plan starts now); ahead of it, the plan
starts in that later year. `planFirstYear(1958,65,2026)=2026`, `planFirstYear(1958,72,2026)=2030`,
engine first rows 2026/2030 at ages 68/72. **But the portfolio does NOT grow between today and a
future start year** - typed $1M gives a year-0 IRA of $1,050,154 starting 2026 and $1,046,082
starting 2030, where four years at 6% would be ~$1.26M. Balances are treated as AT RETIREMENT, not
today. Defensible for a drawdown model; a decision rather than a defect, and unrecorded until now.

## 2026-08-31 - P98: in-page tests run at PARSE time, and three controls are empty then

**The finding is a rule, not a number.** `retirement_optimizer.html` calls `runTests?.()` at TOP
LEVEL. Three controls on that page are filled by the `DOMContentLoaded` handler and are therefore
EMPTY (or holding a markup placeholder) while the whole in-page suite runs:

| control | filled by | what a test reads instead |
|---|---|---|
| `#stratRate` | `generateStratRateOptions()` | one `<option value="24">` with no `data-limit` |
| `#STATEname` | `generateStateOptions()` | whatever the markup ships |
| nerdknob visibility | `applyNerdKnobVisibility()` | the markup default only |

A test that reads one of these live is measuring WHEN IT RAN, not what it claims. The failure mode is
silent in the direction that matters: `Number(undefined)` is `NaN`, and `assertEqual(NaN, x)` fails
with a message that names the data rather than the emptiness.

**`?runtests` can mask it, and did.** Unsafe suites gated behind that flag may BUILD the control as a
side effect - `acaOptionsUngated` calls `refreshStratRateOptions()` - so a check placed after one of
them is green with the flag and red without it. **A check whose verdict depends on the URL is the
signature of this defect.** That asymmetry is the diagnostic; look for it first.

**Two safe patterns, and which to pick:**

- The builder is PURE (`generateStratRateOptions`, `generateStateOptions`): build a detached copy -
  `const sel = document.createElement('select'); sel.innerHTML = generateStratRateOptions();` - and
  assert on that. No `unsafeTest()` gate needed, so the check still runs on plain loads, which is
  where a reader sees the badge.
- The builder MUTATES the live page (`refreshStratRateOptions`, which ends in
  `clampStratRateSelection()`): gate with `unsafeTest()` and accept that it only runs with
  `?runtests`. This is what `acaOptionsUngated` does, and its comment at `optimizer_tests.js:2205`
  already stated the parse-time trap - the later `dropdownLimitsMatchTheEngine` simply did not
  inherit it.

Prefer the first. The badge a user sees is the plain-load one.

**Counting note:** `TestTiers.EXPECTED` pins the NODE suite totals only. Changing how many assertions
an in-page suite makes (here 1 -> 6 on load) needs no reconciliation there, and neither does
`.githooks/README.md`. That is the opposite of the repo's usual test-count rule, so it is worth
stating rather than assuming.


## P87c1: which taxable-SS regime a ceiling-filling year sits in  *(2026-08-31)*

**The question that decides the fix.** `underfill_harness.js` found the short is `0.150000` of the
benefit, min equal to max. A constant ratio means the taxable share was pinned at its **85% cap** in
every one of those years, so it did not move with the draw and the P87c circularity was inert there.
If that held everywhere, the fix would be a closed-form subtraction of `0.85 x SS`.

**It does not hold.** `.test_harnesses/ssbasis_harness.js`, 720 cells (10 ceiling families x 4
benefit sizes x 3 IRA sizes x 3 spend levels x 2 filing statuses), 5,182 ceiling-bound years - years
where Social Security is paid, the IRA still holds money, and a ceiling was computed:

| regime | years | share | under-filled | headroom never used |
|---|---:|---:|---:|---:|
| ZERO (`taxableSS` = 0) | 6 | 0.1% | 6 | $213,043 |
| **SLOPED** (0 < `taxableSS` < 0.85 SS) | **184** | **3.6%** | **144** | **$4,359,006** |
| CAPPED (`taxableSS` = 0.85 SS) | 4,992 | 96.3% | 1,520 | $12,205,886 |

SLOPED appears in **31 of 270 populated cells** and is concentrated exactly where predicted: the LOW
ceilings. Every one of the top 15 is `Fed 10%` or `Fed 12%`.

**A WRONG CLAIM WAS MADE HERE AND THE USER CORRECTED IT, SAME DAY.** The first version of this note
said a flat `0.85 x SS` subtraction would OVERSHOOT the ceiling in those sloped years. It cannot, and
the algebra is one line: with `N = L - 0.85 SS`, MAGI is `N + taxableSS`, and `taxableSS <= 0.85 SS`
by statute, so `MAGI <= L` in every tier, always. **85% is the MAXIMUM taxable share, so assuming it
is the CONSERVATIVE assumption, not an aggressive one.** Flat 85% under-fills in the lower tiers; it
never breaches. The user's framing is the right one: start from 85% and raise the ceiling only where
the taxable share is demonstrably lower.

That correction changes what `P87c2` has to prove. Both candidate forms are safe, so the question is
not safety but how much headroom each one recovers - which is a measurement, not an argument.

### The inversion, and why it is one line of algebra and not a case analysis

Read out of `taxengine.js:1404-1413`, MAGI and provisional income differ by exactly two terms:

    MAGI        = federalAGI + taxExemptInterest
    provisional = (MAGI - taxableSS) + 0.5 x SS

So with `N` = the non-SS part of MAGI, the whole relation is `MAGI = N + taxableSS(N + 0.5 SS)`.
Call that `f(N)`. It is **monotone non-decreasing** with slope in {1, 1.5, 1.85, 1} - the four
segments of the statutory formula - and sizing a draw to a ceiling `L` is just `N = f-inverse(L)`,
after which the room is `N` minus the non-SS base the year already has. The engine's current line
uses `N = L - fullSS`, which is the defect stated in inverse form.

**Invert by bisection on `f`, calling `calculateTaxableSocialSecurity` itself.** A hand-derived
closed form is available (the knots are at `P = T1`, `P = T2`, and the two `min()` saturations) but
it would be a SECOND SOURCE OF TRUTH for the SS split - precisely the failure mode `P92a` named for
the deduction, where the ceiling and the tax must not be able to disagree. Monotonicity makes
bisection exact to floating point and immune to the case analysis being wrong. Cost is ~50 evaluations
of a 10-line pure function per ceiling-bound year; measure it against `P34` rather than assuming it
free.

**Watch the ZERO row.** Six years, but $213k of short - about $35k a year against a $30k single
benefit, so something beyond the SS term contributes there. Not diagnosed; it is 0.1% of years and
does not change the fix, but it is not fully explained either.

## The `w` notation in the gap-fill weight sweeps, defined once  *(2026-08-31, after it confused a reader)*

Every P30 table uses a bare `w`. It was never defined in any of them, and it is ambiguous in the one
way that matters: read it as the Cash share and every result inverts.

`gapFillWeights` is a PAIR, ordered `[Brokerage, Cash]` (`optimizer_core.js:2318` sets
`order = ['Brokerage','Cash']` and `weight = [40,60]` by default). **`w` is a single percentage -
Brokerage's share - and the pair is always `[w, 100 - w]`.** The harness sweeps exactly that
(`gapfill_harness.js:159`) and prints its own legend at `:209`: "Weights are Brokerage's share;
w=40 is today."

| `w` | pair | gap fill draws |
|---|---|---|
| 0 | `[0, 100]` | all from Cash, spilling to Brokerage once Cash is gone |
| 40 | `[40, 60]` | today: 40% Brokerage, 60% Cash |
| 100 | `[100, 0]` | all from Brokerage, spilling to Cash once Brokerage is gone |

**Neither endpoint is "that account only",** because `calculateWithdrawals` cascades the shortfall.
`[0,100]` drains Cash then draws Brokerage, which IS the bracket family's sequence - the reframing
that made `P30h` worth running, since it turned "which weight" into "should the blend exist at all".

**The lesson, and it is the same one `research/README.md` already carries for report codes:** a
single-letter parameter that appears in every table has to be defined where the tables are, not only
in the harness that emitted them. This one survived three studies and a shipped decision before
anyone asked what it meant.


## Lexicographic vs Pareto, and why a priority list needs tolerance bands  *(2026-08-31, P100)*

**They are different tools and the phase uses both.** Pareto FILTERS - it drops rows beaten on every
metric, 136 -> 46 on the measured scenario - and produces a set with no order. Lexicographic ORDERS -
sort by metric 1, ties broken by metric 2 - and filters nothing. Compose them in that order.

**A strict priority list degenerates to its first key.** A tie-break only fires when the higher key
actually ties, and continuous dollar metrics essentially never do. Measured over 133 rows: net wealth
118 distinct values, lifetime tax 117, remaining IRA 102, final Roth 78, spend 39, break-even year 15
(plus 67 rows with none). **With net wealth leading, priorities 2 through 8 would decide 15 rows.**

**Tolerance bands are what make it work.** Treat rows within a band of the leading key as tied. At
**1% of the metric's range**: 39 groups, **priority 2 decides 118 of 133 rows**, top group 10 plans.
At 0.5%: 108 rows. At 5%: 130 rows but the top group swells to 34.

**Per-metric shape matters and should be encoded once.** `spend` collapses to 3 groups at every band,
because nearly every plan funds the same goal - a poor leading key, a good late tie-break.
`breakEven` is an integer year with heavy ties and 67 rows missing it entirely.

**Authoring cost is the trap.** Nine objectives x eight metrics is 72 ordering decisions. Define ONE
default priority order and let each objective override only its leading metric or two.


## Perf claims must name the machine, and "% of the total" is not a verdict  *(2026-08-31, user correction)*

**The user's point:** *"the user running this tool may have a much slower system than what is being
tested on, so efficiency does matter."* Correct, and it corrects the SHAPE of the argument I used,
not just one figure.

**The reference machine for every timing in this file is an AMD Ryzen AI 9 HX 370** (12 cores / 24
threads, 2025 flagship mobile). That is close to best-case consumer hardware, and it was never stated
alongside the numbers. Scaled by single-core speed - the Optimizer sweep is single-threaded, which is
exactly what `P34`'s worker item is for:

| device | x | full sweep | conversion search / candidate |
|---|---:|---:|---:|
| reference (Ryzen AI 9 HX 370, 2025) | 1 | **6.2 s** | 392 ms |
| mid laptop ~2020 (i5-1035G1) | 2 | 12.5 s | 784 ms |
| older laptop ~2016 (i5-6200U) | 3.5 | **21.8 s** | 1.4 s |
| budget Chromebook / low-end tablet | 6 | **37.4 s** | 2.4 s |
| very old or thermally throttled | 10 | **62.4 s** | 3.9 s |

**The tool's audience is people planning retirement.** A ten-year-old laptop is an ordinary machine
for that audience, not an edge case. A 22-to-62 second sweep is not slow, it is broken - a user will
conclude the page has hung.

**The rule this establishes.** A relative figure like "0.02% of the sweep" is machine-INVARIANT and
stays true at every tier - but it is not a verdict on its own. It only becomes one after the ABSOLUTE
total is shown to be acceptable on the slowest machine that matters. I used the ratio to mean "not
worth caring about", and that inference does not survive a device where the thing it is a percentage
OF has become unusable. **State the reference machine, then state the absolute on the slow target.**

**Where it points, and it is not the bisection.** `nonSSIncomeForMAGI` stays at 0.021% of the sweep
on every tier - 13 ms even at 10x. The conversion search is **75.4%** of the sweep at every tier.
So the slow-machine problem is entirely `P34`, and this gives `P34` the target it has been missing:
not "make it faster" but **a sweep that stays usable at 3.5x to 6x slower single-core speed**.


## The oracle gap closed by itself, and the dominant lever flipped  *(2026-09-01, `P103a`)*

**Codes used here, defined first.** *oracle* = a search handed the whole future return path before
it chooses, so its result is a ceiling no honest strategy can beat on that path. *gap* = how far a
shipped strategy's best row sits below that ceiling, as a percent of real after-tax net worth.
*cell* = one whole plan (one household, one account mix, one spend rate, 33 years). *b20 / b80* =
cost basis at 20% / 80% of the Brokerage balance. *GK-strain cell* = a 6-8%-spend cell where
Guyton-Klinger is the only family that survives at the base row's delivered spend.

`oracle_harness.js --full` re-run on engine `1b7b366`: 45 cells, **418,289 sims, 373.4 s**, ~8.3 s
per plan on the reference box (Ryzen AI 9 HX 370), so ~29-50 s per plan at the 3.5x-6x slower
single-core target. Full report: `research/PERFECT_FORESIGHT_ORACLE.md`.

**Three results, in the order they change decisions.**

**1. The gap closed on its own.** Median best-family gap **4.35% -> 1.58%** at default basis
(4.47% -> 1.13% at b20, 1.83% -> 0.90% at b80). The `+$1.078M` headline that opened `P103` is gone:
that cell (`defaults3x @4%`) now measures **+$122k**. Three shipped fixes landed between engine
`5e1075e` and `1b7b366` that all push the same way, by making the SHIPPED arms better rather than
the oracle worse - `P84` (RMDs and the advisor fee off the prior Dec 31 balance), `P88`
(conversions reach MAGI so IRMAA prices them), `P87c` (a ceiling-filling year lands ON the limit).
**Which one did it is NOT measured** and would need a bisect over those three commits. What is
measured is that the gap closed.

**2. The dominant lever flipped.** The withdrawal split now carries most of the gain in most cells;
conversion timing dominates only in the IRA-heavy `defaults`/`defaults3x` family (96% of the gain
at `defaults3x @4%`, the one place the old 97% claim survives). The four largest single gains in
the run are all split: **+$856k** (`brokheavy @6% b20`), +$656k (`thirds @6%`), +$519k
(`round1 @6% b20`), +$395k (`brokheavy @4% b20`).

**3. `P51d` is answered: the ceiling is near-tight on the conversion axis.** New harness
`.test_harnesses/oracle_crosscheck.js`. Arm A re-runs the oracle's own coordinate descent in the
same process; Arm B is a random-restart search - block add over a run of years, shift between
years, whole-vector scale, swap - at $1k grain, handed the **measured** sim count Arm A spent on
that cell. Across five cells Arm B beats Arm A by at most **+0.013%** of after-tax NW at 3x budget
(+0.001% at equal budget), and is **worse** in one cell.

**The limit of that evidence, stated because it is easy to overclaim.** A negative B-A means Arm B
is the weaker searcher there, so in that cell the cross-check bounds nothing - it only fails to
find more. And `X-P3` was WRONG in 3 of 5: tripling the budget still moved Arm B, so Arm B is not
converged. **What P51d establishes is one-directional: an equally-costed search of a different
shape cannot beat the descent by a meaningful margin.** It is not a proof of optimality, and the
withdrawal-split axis - now the dominant lever - has no cross-check at all.

**Where this points `P103d`.** The fat regimes are now named by measurement rather than guessed:
**the GK-strain cells at 6-8% spend (0.35-20.9%) and the 20%-basis arm**. `defaults3x @4%`, fat
under the old numbers, is 1.58% and is no longer a bake-off candidate.

**Two prediction flips worth carrying.** `S3-P2` (median gap < 4%) went WRONG -> **RIGHT**.
`B-P4` (the gap GROWS at 20% basis) went RIGHT -> **WRONG**: b20's median 1.13% is now BELOW
default basis 1.58%. The half of `B-P4` about Proportional survives - its gap stays above 1% at
both extremes (1.2% each).

**One artifact to know before reading any b20/b80 row.** In `defaults @4%` and `round1 @4%` all
three basis arms return byte-identical scores, because those champions never sell brokerage, so
the basis they would sell at never enters the arithmetic. Those rows are not evidence about basis
in either direction.


## Surplus routing was confounding the whole oracle grid  *(2026-09-01, `P103b1`)*

**Codes:** *reserve0* = `CashReserve: 0`, which routes every arm's surplus to Brokerage instead of
Cash. *base row* = the non-cyclic row the full oracle optimizes from. Other terms are defined in the
`P103a` section above.

Run: `oracle_harness.js --full --reserve0`, 45 cells, 391,160 sims, 359.6 s, engine `1b7b366`. The
flag is opt-in, so a bare run still reproduces `research/PERFECT_FORESIGHT_ORACLE.md` exactly.

**The question it settles.** The published grid leaves `CashReserve` unset, which is the shipped
default and the legacy all-surplus-to-Cash behavior. Cyclic rows bank surplus in Brokerage; an
Ordered brokerage-first sequence does too. So the grid was comparing arms that differ in **where
surplus lands** as well as in how it is drawn - and that, not a missing engine capability, is why a
cyclic row beat the "ceiling".

**Negative gaps 1 -> 0.** With routing held constant no shipped row beats the oracle. The engine
reaches Brokerage three ways (`cyclicEnabled`, `CashReserve != null`, Ordered brokerage-first) and
the harness armed none of them.

**The routing setting is worth more than the gaps this study measures.** Base row, unset -> reserve0:
`defaults @4%` **+$100,653** (and the winner changes, Reduce 17 yrs -> IRA Draw 11%), `defaults @6%`
**+$84,322**, `defaults3x @4%` **+$120,124**, `thirds @4%` **+$86,332** (winner IRA Draw 5% ->
Ordered CBRI). Four of six headline cells change which strategy wins.

**The gap gets WIDER: median 1.58% -> 2.03%** at default basis. The oracle exploits Brokerage
banking better than the rules do. Per cell it moves both ways - `defaults @4%` 0.64% -> 2.03%, but
`defaults3x @4%` 1.58% -> 0.28% and `thirds @4%` 0.49% -> 0.00%.

**It retires `P103a`'s own attribution claim.** `defaults3x @4%` was the single cell where conversion
timing carried 96% of the gain. Routing-controlled, its conversions-only gain falls from +$14,297
(0.19%) to **$825 (0.01%)** and its decomposition flips to split-dominant. **With surplus free to
compound in Brokerage the withdrawal split dominates in all six headline cells.** The b20 conversion
prizes are unaffected (`defaults3x @8% b20` still 13.49%), so the "conversion timing matters more off
mid-basis" finding survives.

**Both runs are kept, because they answer different questions.** The bare run is what a user gets,
since the reserve is unset by default. `--reserve0` is the only control that holds routing constant,
so it is the right yardstick for comparing draw STRATEGIES and `P103d` uses it.

**The generalizable lesson.** Two arms that differ in more than one respect cannot attribute their
difference to either. The oracle's whole product is an attribution, and it had been reading a
routing difference as a draw-order difference for three weeks. **Before a bake-off, enumerate what
the arms differ in and equalize everything that is not the variable under test.**

**A product question this opens, not decided here:** leaving Cash Reserve blank costs $84k-$120k in
four of six cells and changes the recommended strategy. Whether the shipped default should change is
user-visible and needs its own measurement across the wider Stage-1 grid (`P103b1x`).


## The schedule reaches higher than the conversion axis, on less compute  *(2026-09-01, `P103b4`)*

**Codes:** *Arm A* = the oracle's existing search, per-year `extraConversionAmount`, which is EXTRA on
top of the base rule and therefore one-directional. *Arm S* = per-year `ordTarget`/`iraDraw` on the
same base row. Both take the same objective, the same spend pin and the same measured sim budget.

**Arm S wins 6 of 6 cells**, +$11,259 to +$198,508, or **+0.25% to +1.82%** of real after-tax net
worth. Harness `.test_harnesses/schedule_oracle_harness.js`; 45,475 sims, 34.2 s.

**The two cells that carry the argument** are `thirds @4%` and `brokheavy @4%`, where the conversion
oracle finds **$0** and the schedule finds **~$198k**. Those plans do not want more conversion. They
want the base rule's own draw moved year to year, which is a sentence `extraConversionAmount` cannot
say in any amount. **The one-directional axis was not a small limitation; in some cells it was the
whole gap.**

**It also converged on roughly an eighth of the compute** - 1,021 sims against 9,575 in
`defaults @4%`, 1,201 against 9,260 in `defaults3x @4%`. The reason is candidate SHAPE, not luck: a
multiplicative set (×0.4 … ×2.0) is scale-free, so it works identically on a $400k ceiling and a $40k
draw, while a $25k absolute grid over $0-400k spends most of its evaluations far from any plausible
value. **A search axis measured in ratios beat one measured in dollars at the same budget**, which is
a transferable result for `P34`'s slow-machine target and for the `P103c` search-cost question.

**The harness was confidently wrong first, and the failure has a recognizable shape.** Version 1 chose
the best non-cyclic row as the base regardless of family. Ordered and Guyton-Klinger compile to an
EMPTY schedule (`P103b3`), which funds no spending, fails the spend pin and scores null - after ONE
simulation. Five of seven cells printed Arm S losing by the entire conversion gain, and `S-P1` scored
WRONG. It was re-measuring the b3 coverage boundary and reporting it as a ceiling comparison.
**Generalizable: a null or catastrophic result that arrives after one evaluation is a setup bug, not
a finding - check the evaluation COUNT before believing a verdict.** The fix was to require the base
row's compiled schedule to replay it exactly, verified per cell before either arm runs.

**Scope, because this is the phase's first number that moves.** Perfect foresight on one path; the
base rows differ from `P103a`'s champions because a carryable row is required; and **spend is still
pinned**, so all of it is "more wealth at the same delivered spend". Whether a FIXED rule captures
most of the gain - the `P35n` template that produced the only shipped result in this whole line of
work - is `P103d`, and that is the question that decides whether any of this reaches a user.


## The spend axis needs a frontier, not a weight  *(2026-09-01, `P103b5a`)*

**Codes:** *frontier* = the achievable (lifetime spend, terminal wealth) pairs traced by sweeping the
spend goal on a fixed base row. *technical rate* = how much real terminal wealth the MODEL gives up
per extra dollar of lifetime spending, measured along that frontier. *SPENDABLE_WEIGHT* = the repo's
own 1.10, the coefficient in `baselineScoreOf`.

**The technical rate is 1.38 to 3.31; the weight is 1.10.** Below it everywhere measured, so the
scalarized optimum sits at the **minimum** spend tested in 3 of 3 cells. Prediction `O-P1` was WRONG
and in the opposite direction from what I expected: I reasoned that a dollar spent in the final year
costs about a dollar of wealth and is credited 1.10, so the objective would prefer spending. It
prefers hoarding, because most of the horizon is not the final year and a dollar not spent compounds.

**`O-P3` is the one that decides the design.** The rate is not constant - 1.38 to 3.31 within
`round1 @4%` alone. No single weight agrees with the model at both ends of one frontier, let alone
across cells. **So `P103b5` needs a frontier, not a weight:** report the (spend, wealth) pairs and let
a human pick the point, the same shape `P100` reached for row ranking.

**This does not make `SPENDABLE_WEIGHT` wrong at its job**, and the distinction is worth keeping.
Between two plans delivering the same spend the term cancels exactly; between two plans at the same
wealth it correctly prefers the one that spends more. That is what "settle ties between otherwise
equal plans" means and it does it. What it cannot do is price a REAL trade-off, where one plan
genuinely buys spending with wealth. Documented in `optimizer_core.js` with both facts.

**A constraint on any future spend search: feasibility is NOT monotone in the spend goal.**
`round1 @4%` is feasible at 0.70, infeasible at 0.80, feasible again at 0.90-1.10, infeasible from
1.20. `totals.success` is a PER-YEAR test (`netIncome < targetSpend * 0.99`), so a plan can dip under
the threshold in a narrow band and recover above it. **Bisecting for the maximum sustainable spend is
therefore unsound** - it can land in a hole and report a much lower ceiling than exists. Worth
checking whether `optimizeSpend`, which converges to the highest spend where `success` holds, is
exposed to this.

**The generalizable half.** A scalarized objective is only usable for SEARCH when its optimum is
interior. Before adding a decision variable to any search, sweep it once and look at where the argmax
lands: a boundary answer means the search will return the weight rather than the plan.


## The schedule beats Guyton-Klinger, and the rule is why  *(2026-09-01, `P103b5`)*

**Codes:** *spend field* = a schedule entry's `spend`, the year's goal in nominal dollars.
*`spendRule: 'gk'`* = an input that runs the Guyton-Klinger spend adjustment under ANY strategy.
*dominates* = no worse on delivered lifetime spend, and more terminal wealth, both plans funded.

**GK is dominated in 10 of 12 cells: more lifetime spending AND more terminal wealth.** At the
typical -1%/yr spend decline, +$26,285 spend and +$2,611 wealth at 4%, +$91,655 and +$95,758 at 6%;
best case +$43,934 and +$198,581. The two exceptions are a RISING spend goal, where the schedule buys
spending at the cost of wealth - a genuine trade, correctly not called dominance.

**The rule versus the numbers is the whole methodological point, and I got it wrong first.** My first
pass compiled GK's RECORDED spend path and replayed it under a different draw. That produces a large
number and means nothing: GK's spend responds to the portfolio, so under a different draw it would
have chosen differently. The path is a hindsight artifact nobody could follow. Carrying the RULE -
`spendRule: 'gk'`, re-evaluated each year against whatever portfolio the plan actually has - is a
combination someone could adopt. **Same measurement, and only one of the two versions is evidence.**

**Generalizable: when a harness "carries" an adaptive strategy, ask whether it carries the DECISIONS
or the DECISION RULE.** Decisions are a recording of one history and reproduce nothing when the
environment changes; a rule is portable. The tell is that replaying decisions almost always looks
better than the source, because the recording was made under conditions the replay no longer faces.

**What it licenses and what it does not.** It does NOT mean a user can have $198k. It means **GK's
account split is costing it that much at its own spending rule**, so the draw rule is the thing worth
replacing - which is `P103d`, now with a measured prize instead of a hunch. Unlike `P103b4` it needs
no perfect foresight: the spend rule is GK's own and the draw is a schedule, so the whole combination
is implementable.

**A near-miss worth recording.** I first reported this as a partial replay - "GK does not fully
reproduce, residual $292k" - and filed a strict improvement as a coverage defect. The user caught it:
*"if a draw strategy improves GK it should be used. Indeed, that's the point."* **A replay harness
whose verdicts are only EXACT or BROKEN cannot see an improvement.** The harness now reports the
delivered-spend delta beside the wealth delta and labels the case DOMINATES.

## Spend is PINNED, not FLAT - a correction to language used throughout  *(2026-09-01, user)*

*"You've repeatedly said spend is fixed - it is not. Usually it is declined by -1% per year of plan."*
Correct, and two different things were being run together:

- **Pinned** is the COMPARISON rule: a candidate delivering a different spend is discarded, so a
  spend-cutting arm cannot win by cutting. Real, and a deliberate methodology choice.
- **Flat** is a FIXTURE choice and an unrepresentative one. Every harness in this study sets
  `spendChange: 0`, while a typical plan declines around 1% a year. **Nothing in the oracle grid
  exercises a declining spend path.**

`P103b5`'s sweep is the first thing here to vary it, spanning -2.0% to +1.0%. Every other gap number
in `PERFECT_FORESIGHT_ORACLE.md` is measured on a flat path and has to be read that way; re-running
the grid at a realistic decline is `P103b5c`.


## Correcting P103b5c: the two fixtures INTERACT  *(2026-09-01, same day as the claim)*

**Codes:** *controlled* = `--reserve0`, surplus routing held constant across arms. *declining* =
`--spendchange -1`. The 2x2 crosses them; each cell is a full 45-cell grid run.

| median best-family gap, default basis | routing uncontrolled | routing CONTROLLED |
|---|---|---|
| flat spend | 1.58% | **2.03%** |
| declining -1%/yr | 3.44% | **1.94%** |

**`D-P1` is WRONG and I scored it RIGHT hours earlier.** Running the declining path alone, the median
gap went 1.58% -> 3.44% and I wrote it up as "right by six times the predicted margin". Crossed with
routing control it does not widen at all: 2.03% -> 1.94%. What I measured was the routing confound
behaving differently under a different spend path.

**Two published claims withdrawn.**
- "The flat scalar finding $0 in 45 of 45 cells is a flat-path artifact" - **NO**. Under routing
  control it is $0 in **44 of 44 on both paths**. The 3 cells that appeared to break it were routing
  artifacts. The original headline stands.
- "The gap roughly doubles on a realistic path" - **NO**, as above.

**What survives under control:** max conversions-only gain 0.57% -> **9.55%**; `S3-P4` flips WRONG
(45/45 clean -> 44/45); and the three basis medians CONVERGE on the declining path (all 1.94%), so
the basis fraction stops mattering to the median.

**The rule this establishes, which is stronger than the one it replaces.** Earlier today I wrote
"a fixture value nobody chose deliberately is a finding waiting to happen" after the third such
case. That is true but incomplete. **Fixtures INTERACT, so they cannot be corrected one at a time** -
fixing routing while spend stayed flat, then fixing spend while routing stayed loose, produced a
confident false positive at each step. The correction has to be crossed: vary the new fixture WITH
the previously-controlled one, or the confound simply relocates.

**Cost of learning this: one extra 345-second run.** Cost of not learning it: two withdrawn claims
that had already survived a careful write-up, a prediction scoring, and a commit.


## GK decides the spend well and the draw badly  *(2026-09-01, `P103d`)*

**Codes:** *incumbent* = `strategy: 'gk'`, GK deciding spend and draw. *candidate* =
`strategy: X, spendRule: 'gk'` - GK decides the spend, a shipped family decides the draw. *wins a
cell* = delivers no less lifetime spend AND more real terminal wealth, both plans funded.

Both fixtures controlled (`CashReserve: 0`, spend -1%/yr), because `P103b5c` showed correcting them
one at a time relocates the confound.

**GK's draw is beaten in 24 of 30 cells - 80% - including 15 of 15 at 6% spend.** Total wealth left
on the table **$6,564,797**; median gain in a beaten cell **$231,345**; largest **$713,401**
(`brokheavy @6% b20`, IRA Draw 5%). The six unbeaten cells are all at 8% spend.

**`G-P1` WRONG, and the shape of the failure is the finding.** It asked whether ONE rule beats GK in
a majority of cells; the best single rule (Ordered CIBR) manages 14 of 30. But some rule beats GK in
80% of cells. **"No single winner" is not "no winner" - it is a regime-gated winner**, which is the
standing result of this whole line of work and the reason `P35n`'s arm shipped marked and gated.

**`G-P2` RIGHT: six distinct per-cell winners** - Ordered CIBR 8, Fill Bracket 22% 6, IRA Draw 5% 5,
Ordered CBIR 2, IRA Draw 9% 2, Fill Bracket 24% 1.

**`G-P3` WRONG, in a direction worth chasing.** I predicted rules reaching Brokerage or Cash before
the IRA would win more often - GK's guardrails already cut spending when the portfolio falls, and
§1014 makes held brokerage cheap to heirs. IRA-first rules win 14 of the per-cell bests against 10.
**Under a GK spend rule the IRA is the account worth draining early, the opposite of `P35n`'s endgame
result.** Two rules from the same repo pointing opposite ways is either a regime boundary worth
naming or a mistake in one of them, and it should be settled before either ships.

**The honest limit.** This measures the best rule PER CELL with hindsight over that cell's outcome; a
user picks one up front. The shippable form is a sweep that searches - which is what the Optimizer
table already is. The finding is not "use Ordered CIBR"; it is that **GK's own draw should not be
assumed the right partner for GK's spend rule**, and the sweep should offer the combination.


## A one-path bake-off picked the rule that fails 80% of futures  *(2026-09-01, `P103e`)*

**Codes:** *median-best* = highest median real terminal wealth across paths. *survival* = share of
paths the plan funds to the end. *single-path pick* = the winner `P103d` chose on one deterministic
6%/2.5% path.

100 GBM paths x 33 years x 5 rules x 6 cells, every rule on the SAME banks, seed and path index.

**`E-P3` RIGHT in 6 of 6 cells, and it is the result: the single-path pick is NEVER the median-best
rule.** Not a substantial minority - every cell.

**The rule the single-path bake-off crowned is the worst under uncertainty.** Ordered CIBR won 8 of
30 single-path cells, more than any other rule, and survives **3%, 17%, 21% and 21%** of paths in
four MC cells against GK's 100%. A draw order that is optimal when every year returns exactly 6% is
fatal when returns vary, and a point estimate cannot show that.

**`E-P2` WRONG, and it did its job.** In `defaults3x @6%` the median-best rule survives 57% of paths
against GK's 100% - extra median wealth bought with survival, which disqualifies it for someone
living on the plan. Without a survival column that cell would have read as a win.

**The robust winner was the runner-up.** Fill Bracket 22% is median-best in 5 of 6 cells at **100%
survival**, worth +$56,674 to +$600,128 against GK. The single-path bake-off ranked it second.

**The generalizable rule, and it is the strongest one from this whole phase.** A deterministic path
does not just add noise to a ranking - **it systematically favors rules that are brittle**, because
brittleness has no cost when there is only one future. Any selection among strategies must be made
under uncertainty; a single-path search is for finding CANDIDATES, never for choosing between them.
That is now measured rather than asserted: 6 of 6 cells changed their answer.

**And the NaN that nearly ate the run.** The first execution printed a full table of `$NaN` at 100%
success, because `buildBanks` destructures `cfg.mu` and `cfg.sigma` for the synthetic modes and I
supplied neither - `logDrift` went NaN and every balance followed it silently, all the way to a
terminal of nulls. It was caught by the same reflex as `P103b4`'s one-simulation null: **a clean-
looking table with an impossible uniformity (every rule at exactly 100%) is a setup bug.**


## Every narrowing of the evidence flattered the answer  *(2026-09-01, `P103e` mode sweep)*

Ran the `P103e` comparison under all three Monte Carlo modes rather than GBM alone. GBM draws each
year independently; **bootstrap replays real historical blocks, so it carries real crashes in real
order**.

**Survival, min and median across six cells:**

| rule | GBM | bootstrap | AAM |
|---|---|---|---|
| Ordered CIBR | min 3%, med 21% | **min 0%**, med 20% | min 3%, med 24% |
| Ordered CBIR | min 19%, med 65% | min 15%, med 56% | min 19%, med 69% |
| Fill Bracket 22% | min 100% | min 95% | min 98% |
| IRA Draw 5% | min 100% | min 100% | min 100% |

**Ordered CIBR reaches 0% survival under bootstrap** - it funds not a single historical path in that
cell, having been the single-path bake-off's most frequent winner (8 of 30 cells). Both ordered
sequences are disqualified in every mode.

**Fill Bracket 22% wins 12 of 18 mode-cells**, and the losses are informative rather than noise:
`defaults3x @6%` is negative in ALL three modes, so GK's own draw is right there; and `thirds @6%`
flips from +$107,493 under GBM to **−$380,983 under bootstrap**, which is exactly the sequence risk
GBM cannot represent.

**The pattern across this whole phase, stated once.** One deterministic path picked a rule that fails
most futures. One synthetic mode overstated how broadly the replacement wins. Earlier, one
uncontrolled fixture doubled a gap that does not move when controlled. **Every narrowing of the
evidence flattered the answer, in the same direction, every time.** That is not coincidence: a
narrower evidence base removes the conditions under which a candidate fails, and a search will
happily find whatever the narrowing permits. The working rule is to assume a result is optimistic in
proportion to how little was varied to get it, and to widen the axis you did NOT vary before
believing a margin.


## The MAGI-edge gate: provisionally failing, and one bug already found  *(2026-09-01, `P103c1` / `P75a`)*

**Codes:** *edge* = a MAGI threshold the tax code cares about - a federal bracket top, a state cap, an
IRMAA tier boundary, an LTCG bracket top, an ACA FPL multiple, or the ceiling a family is actively
filling. *residency* = share of plan-years whose realized MAGI is within a tolerance of the nearest
edge. *gate* = `P75a`, which says a search over the MAGI menu is only sensible if good plans land on
it, and "mostly interior" means redesign.

**Measured: 4.2% of 990 best-row plan-years within $1,000 of an edge**; 1.3% at $250, 29.2% at
$10,000. ACA Cliff 9.1%, Guyton-Klinger 4.9%, Fill Bracket 3.4%, Ordered 1.5%. Fat regimes 4.2%.

**Provisional, because the first version of this measurement was wrong.** It rebuilt the statutory
tables by hand and scaled them by `inflationFactor` - the SPENDING inflation - when bracket
indexation uses a different factor with a one-year lag (`P70`), and it ignored the `P92a` deduction
add-back that lifts a federal ceiling above the statutory top. It reported **1.1% residency for Fill
Bracket**, a family that fills a ceiling by construction. **That impossibility is what caught it**, and
it is the third time this session the tell has been an implausibly clean number rather than an error.

**After the fix, a direct check anchors it:** Fill Bracket 22%'s realized MAGI sits at **exactly $0**
from its own logged `BracketTarget` in the years the ceiling binds - **6 of 33** in the cell tested.
So plans DO land on their ceilings; ceilings just do not bind most years.

**Which is the interesting part, if it holds.** A ceiling family is only ON its ceiling when the
ceiling is the binding constraint - the rest of the time spending needs less, or the IRA is spent
down, and MAGI floats free. Add that the best rows in the fat regimes are Guyton-Klinger, which has
no ceiling at all, and the MAGI menu describes a minority of the decisions that matter.

**Not acted on.** This verdict would send `P103c` back to the drawing board, and a measurement whose
first version was wrong has not earned that. The confirming step is small: count binding years per
family directly and check whether 6 of 33 generalizes.


## The constant split is a plug, not a solver - and its single-path winner has CIBR's shape  *(2026-09-02, planning `P104b`)*

**Codes:** *split* = how one year's spending draw is divided across IRA, Brokerage, Cash and Roth.
*constant split* = one relative-weight vector applied every year (`P104a`'s `k=1`). *archetype* = one
of the ten vectors the oracle harness searches over (`split_expressiveness_harness.js:110-121`):
`IRA`, `Brok`, `Cash`, `Roth` (single account), `prop` `{IRA:1, Brokerage:1, Cash:1}`, `I6B4`, `B4C6`,
`I5C5`, `I4B3C3` (blends, digits are tenths), and `family` (no override). *replay identity* = the
`P103b2` acceptance bar: two runs agree to the dollar on every column.

**The engine already does the arithmetic.** `calculateWithdrawals` (`optimizer_core.js:433`) takes a
`weight` array on the withdrawal strategy and only derives weights from balances when it is absent
(`:464-471`); `netTargets = gap * weight` (`:479-483`). Proportional and the baseline `else` (GK's
draw) never pass one, which is the whole of what makes them "proportional". And `oracleWithdrawalPlan`
already carries `{IRA, Brokerage, Cash, Roth}` relative weights per year (`:2136-2149`), binding the
PRIMARY draw (`:2192-2196`) and the GAP FILL (`:2587-2596`) alike. `P104a` measured exactly that path:
`runSim({...cellBase, oracleWithdrawalPlan: new Array(horizon).fill(w)})`. So a shipped constant-split
family is the oracle's weight path given a name, and its acceptance test writes itself: **`strategy:
'split'` with vector `V` must replay `propwd 0 + oracleWithdrawalPlan.fill(V)` to the dollar.** If the
family binds the weights anywhere the oracle did not, or fails to bind them where it did, `P104a`'s
numbers do not transfer to it.

**`{Cash: 1}` is not an all-cash draw, and that changes what the k=1 result says.** Phase 2 of
`calculateWithdrawals` (`:593-600`) walks `order` for whatever the weighted phase left unfunded, and
the oracle's order is `['IRA', 'Brokerage', 'Cash', 'Roth']`. So `Cash` means Cash, then IRA, then
Brokerage, then Roth - the shape of Ordered **CIBR**, the rule `P103e` measured at **0% survival under
bootstrap**. It is not the same code path (Ordered runs `runOrderedWithdrawal`, never takes the
forced-IRA fallback, and reports a shortfall rather than draining), so this is a prediction and not a
finding. But `Cash` is the single-path `k=1` winner in 5 of 10 cells, and the report's own caveat
(`PERFECT_FORESIGHT_ORACLE.md:911-915`) says the coincidence with C-first "must not be assumed" in
either direction. **The grid for a shipped family cannot be read off `P104a`'s single-path winners.**
Three studies now point cash-first - `GAPFILL_SPLIT.md` `w=0` in 65 of 82, `P35n`'s Cash -> Roth ->
Brokerage in 88 of 108, `P104a` cash-dominant in 8 of 10 - and all three are one deterministic path.

**The per-cell winners were never written down.** The harness prints "k=1 winner / k=2 winner" per
cell (`:245-251`); the report kept only aggregates (`Cash` x5, `B4C6` x3, `prop` x1, one unnamed).
Re-running it is the only way to recover them.

**The archetype menu is ten points on a continuum.** A constant split over four accounts is a point
on a 3-simplex; at 10% steps that is 286 vectors, and 286 x 10 cells x ~1.2 ms is about 3.5 s of
single-path search. The menu need not stay a guess. The `P103e` discipline still applies with more
force, not less: a finer single-path search is a MORE hindsight-fitted candidate list, so it finds
candidates and Monte Carlo across all three modes chooses among them, never the reverse.

**What a family must decide that the research input never had to.** (1) Cyclic: the oracle input
throws when composed with `cyclicEnabled` (`:2184`); a family composes the way `propwd` does, harvest
years preempting the split (`:2197`), so replay identity holds only with cyclic off. (2) The 🅡
clone pass (`rothGapFill`) is meaningless when Roth sits in the vector - `ROTH_GAP_EXCLUDED`
(`:5430`) gains a second member, which also saves rows. (3) IRA Goal: ignored, as by `propwd`, `gk`
and the baseline (engine survey item 10). (4) The forced-IRA fallback stays on: `isBracketStrategy`
false, same as Proportional. (5) The `+%` IRA boost is not carried; `P104a`'s base was `+0%`.
(6) A malformed vector from a share link must not crash the page or model something else silently:
fall back to balance weights and raise a warning, the `gapFillWeights` convention (`:2644-2659`)
plus a visible flag.

**Budget, measured before any row is added.** The Optimizer sweep is at **1,711 runs against a
1,500 cap** (engine survey item 8, `optimizer_ui.js:1043`), absorbed today by trimming conversion
candidates 12 -> 6; 179 rows shipped. Every base row is paid for roughly four times over the clone
passes (🗘/🔄 cyclic, 💵), so a family of `G` vectors costs about `4G` Optimizer rows, and Monte
Carlo multiplies its own copy by the path count. Both golden fixtures pin row counts in eight
places (`sweep_golden.js`), and the Optimizer half is regenerated only from a browser capture of
four page states (`sweep_golden.import.js`). `P102e1` priced a comparable two-position dimension at
+22 rows. Rules `C1`/`C2` (task_plan `P102`) bind: a budget may cut coverage and must say so on
screen; it may never drop an arm on a predicted-winner heuristic; truncation order is deterministic.

**One identity trap, already recorded once.** `STRATEGY_SELECTION_FIELDS` (`:4879`) is a scalar list
and `sameStrategySelection` compares by value; a vector field needs an element-wise compare or every
split row silently matches the user's plan. The comment above it records exactly this bug for
`orderedSeq`, the IRMAA tier, the ACA multiple and the GK guardrails.

**Recovered 2026-09-02 by re-running the harness (38,721 sims, bit-identical aggregates).** The
unnamed tenth winner is `Brok`, in `brokheavy @4%`. Two shapes in the `k=2` column are worth
carrying into `P104c`: a switch INTO `Roth` late (years 5, 10, 11, 12 in four cells, a Roth-drain
endgame), and `Cash -> X at year 1`, which is one year of cash and then the blend - a shape a
constant cannot state and a switch states trivially.

| cell | k=1 winner | k=2 winner (A -> B at year t) |
|---|---|---|
| defaults @4% | `Cash` | same as k=1 |
| defaults @6% | `Cash` | `I5C5` -> `Roth` at year 1 |
| defaults3x @4% | `prop` | `Cash` -> `prop` at year 1 |
| defaults3x @6% | `B4C6` | `B4C6` -> `Roth` at year 11 |
| round1 @4% | `Cash` | `Cash` -> `Brok` at year 13 |
| round1 @6% | `B4C6` | `I5C5` -> `Brok` at year 1 |
| thirds @4% | `B4C6` | `Cash` -> `Brok` at year 1 |
| thirds @6% | `Cash` | `B4C6` -> `Roth` at year 5 |
| brokheavy @4% | `Brok` | `Cash` -> `Roth` at year 10 |
| brokheavy @6% | `Cash` | `Brok` -> `Roth` at year 12 |


## The phantom-gap fix landed, and what moved tells you what the defect had been doing  *(2026-09-02, `P104b1x`, v11.1701)*

One line in `fillSpendingGap`: the gap now credits pass 1's Cash and Roth draws. Everything else
in this entry is what the suite reported when the line changed, which is the cleanest description
of the defect available.

**Three pins moved; every other test held, including the golden fixtures.** The goldens pin the
sweep ENUMERATION, not simulation results, so they are indifferent to an engine change - worth
knowing before the next behavior fix.

| pin | before | after | reading |
|---|---|---|---|
| `P35n` `{seq}` test, "Cash $50k < spend need, so the shortfall cascades to Brokerage" | passed | cascade gone | the premise was false: BASE needs $36.7k, Cash covers it alone. The "cascade" it observed for three weeks WAS the phantom second draw. Fixed by giving it a $90k goal so the cascade is real |
| GK fixture (spend / tax / final NW) | 7,423,664 / 1,925,649 / 9,188,057 | 7,447,683 / 1,924,412 / 9,239,367 | +$24,019 spend AND +$51,310 wealth from the same inputs: a withdrawal that was being made and unmade. Guardrail count 3, unchanged |
| `P38` forced-IRA total (Proportional +0% on `CAP_BASE`) | $33,744 | $30,943 | the phantom second draw had been pulling the residual pass into funding tax on money nobody needed |

Two `test.critical` guards now pin the corrected behavior (the Cash-only split funds BASE year 0
once, IRA untouched; Proportional +0% with Max Conversion on converts nothing in the four years the
defect converted $7.8k, $7.2k, $6.2k, $3.5k). Critical guards 14 -> 16, suite 405 -> 406.

**The rule this adds.** A passing test whose assertion is weaker than its fixture's arithmetic
allows is a place a defect can live indefinitely. `CashWD > 10,000` against a $50,000 balance and
a $36,717 need was satisfied by $11,767, and $11,767 was the defect. When a fixture says an
assertion should be tight, make it tight; a loose bound that "passes anyway" is not caution, it is
a blind spot with a green light on it.

**What the fix does NOT settle.** Every number in `PERFECT_FORESIGHT_ORACLE.md` was measured on
the old engine in both arms. `P104a` is being re-run first (cheap); the `P103a` yardstick
(`oracle_harness.js --full --reserve0 --spendchange -1`, ~6 minutes) follows. Until both are
re-baselined, "the gap" and "the k=1 winners" are the old engine's numbers.


**P104a re-baselined on the corrected engine (v11.1701), same harness, same sims.** A better
constant beats Proportional in **8 of 10** cells, $112,096 to $642,131 (was 10 of 10, $139,928 to
$1,155,056); Proportional is the best constant on the menu in both brokerage-heavy cells. One switch
still captures 85%+ in 7 of 10 and now beats the per-year descent outright in five. Winners moved
from `Cash` x5 to `I5C5` x3, `B4C6` x3, `I4B3C3`, `Cash`, `family` x2: blends in 7 of 10. The
`Cash` wins had been carrying the defect's involuntary IRA draw. Full table in
`PERFECT_FORESIGHT_ORACLE.md`, "P104 on the corrected engine".


**The oracle yardstick re-baselined on v11.1701** (`--full --reserve0 --spendchange -1`, 404,511
sims): median best-family gap 1.94% -> **1.29%**; basis extremes 2.23% against 1.29% at default,
so basis matters again; cells at or above 5% 17 -> 13, still 8%-spend and Guyton-Klinger
dominated; **the best case for conversion timing fell 9.55% -> 2.34%** - the defect's involuntary
conversions had been doing part of what the oracle's schedule was credited with; four cells at
exactly zero, all Ordered; zero negative gaps. `P103d`/`P103e` were measured on the old engine and
GK's draw is the draw the defect distorted most: re-run before their arm ships. Report section
"What changed with v11.1701".


## A Cash Reserve of 0 beats blank everywhere and every dollar of buffer costs  *(2026-09-02, `P103b1x`, v11.1701)*

**Codes:** *blank / Off* = the shipped default, legacy routing, all surplus stays in Cash. *0* =
routing on, no buffer, all surplus to Brokerage. *$N* = keep N of today's dollars in Cash as a
breakable floor, route the overflow to Brokerage. *spend* = the cell's first-year spend goal.
Fixture: the replay household, six mixes (the five P104a mixes plus a $790k `small` plan), 4% and
6% spend, `dividendReinvest` on, Max Conversion on, corrected engine. Score: real after-tax wealth
at the cell's `futureIRARate`, delta against blank. 480 single-path sims, then 12,000 Monte Carlo
sims (100 paths, GBM and bootstrap, six 6%-spend cells, Proportional +0% and Guyton-Klinger).

**Single path, mean delta vs blank (worst cell in parentheses):**

| reserve | Proportional +0% | Guyton-Klinger | Fill Bracket 22% | IRA Draw 5% | Ordered CBIR |
|---|---|---|---|---|---|
| 0 | +$657,034 ($0) | +$242,978 ($0) | +$291,804 ($0) | +$525,643 ($0) | +$1,061,233 ($0) |
| $10k | +$638,280 (-$35,541) | +$235,150 (-$29,467) | +$261,959 (-$48,803) | +$495,045 (-$48,171) | +$926,430 (-$53,032) |
| $25k | +$610,563 (-$89,667) | +$217,245 (-$66,610) | +$217,481 (-$122,482) | +$448,337 (-$120,413) | +$797,404 (-$120,892) |
| $50k | +$557,103 (-$191,020) | +$185,716 (-$128,268) | +$144,414 (-$235,340) | +$363,165 (-$240,796) | +$711,555 (-$263,739) |
| 0.5x spend | +$432,067 (-$634,411) | +$100,419 (-$489,707) | +$2,191 (-$727,575) | +$203,619 (-$667,954) | +$622,455 (-$656,120) |
| 1x spend | +$290,317 (-$779,563) | +$3,195 (-$634,859) | -$149,888 (-$819,090) | +$21,743 (-$800,094) | +$457,601 (-$808,771) |

**`0` is never worse than blank in any of the 60 family-cells** - its worst delta is exactly $0,
in the cells where no surplus arises and the setting is inert - and it is best or tied in every
family. The gain is the ROUTING: surplus compounding in Brokerage at the growth rate instead of
sitting in Cash at the cash yield. Every dollar of floor then subtracts from it twice: the buffer
idles, and the breakable floor pushes draws onto taxable accounts. Spend-proportional buffers are
the worst choices tested. Ordered is the one family a buffer helps in a different way: blank and
`0` leave 2 of 12 single-path cells unfunded, `$10k` 1, `$25k` and up 0 - Ordered never draws
outside its sequence, and the floor's last-resort release is a backstop it otherwise lacks.

**Monte Carlo, median real after-tax wealth vs blank, mean over six cells:**

| | Proportional GBM | Proportional bootstrap | GK GBM | GK bootstrap |
|---|---|---|---|---|
| 0 | +$476,016 | +$850,518 | +$244,592 | +$207,237 |
| $10k | +$443,471 | +$848,383 | +$229,787 | +$165,660 |
| $25k | +$394,692 | +$736,078 | +$222,509 | +$155,599 |
| 0.5x spend | +$88,007 | +$327,965 | +$99,985 | +$14,030 |

Survival is unchanged by the setting: Proportional min 66% GBM / 69% bootstrap under blank and
under `0` (the $10k floor costs one path in each mode), Guyton-Klinger 100% throughout. The p10
moves with the median.

**Proposal:** default `0`, with "Off" kept as the typed word for the legacy behavior, and the
"this scenario sets a Cash Reserve" warning retired (it would fire for everyone). A user who wants
a real-life cash cushion can still set one; its cost is now a measured number rather than a guess.
**Not measured:** `dividendReinvest` off (dividends then land in Cash and the routing decides
their fate), cyclic (the reserve is disabled there), 8% spend, and any liquidity preference the
engine does not model - the engine has no emergency spending, so a buffer can only cost it money.
Script lives in the session scratchpad; a `.test_harnesses/` version ships with the change if the
default is changed.


**The "larger unspent Brokerage" intuition, checked** (user, 2026-09-02, before approving the
default). Composition: yes. `defaults @6%`, Proportional +0%: Off ends with $810,571 Brokerage and
$2,785,216 Cash; reserve 0 ends with $5,400,424 Brokerage and $81,329 Cash. Net cost: no. Lifetime
realized capital gains are identical ($28,339 either way; GK $28,910 vs $37,106), lifetime tax is
lower under 0 ($1,199,886 vs $1,166,661), terminal basis equals terminal Brokerage in every row
because the engine's IRC 1014 step-up erases the gain for heirs, and real after-tax wealth is
$857k higher. The money is unspent under BOTH settings, since spend is pinned; the setting only
decides whether it compounds at the growth rate or the cash yield. Where no surplus arises
(`defaults3x`, `round1`, `thirds`, `brokheavy` at 6%) the two settings are byte-identical.

**Shipped 11.1702:** default 0, the load-time "this scenario sets a Cash Reserve" warning retired,
and a `CashReserve` column in Annual Details (Balances and Cash Δ) reporting min(target in nominal
dollars, Cash) per year, hidden when there is no reserve. The user's stance for the record: *"Cash
Reserve is ONE vehicle, but any Roth funds are a backup"* - no emergency-spending feature is wanted.


## What BrokerageG contains, and the identity the balance now has to satisfy on screen  *(2026-09-02, user-raised)*

**Codes:** *BrokerageG* = the Annual Details column fed by `yr.gains.Brokerage`. *DRIP* = dividends
reinvested into Brokerage when Dividend Reinvestment is on. *SurplusBrok* = surplus the Cash
Reserve rule routed into Brokerage (`yr.surplusToBrokerage`, logged since P2 as the hidden
`-surplusToBrokerage` and never shown).

`yr.gains.Brokerage` is `applyGrowth`'s market return on the balance for the pre- and post-withdrawal
periods, PLUS the year's dividends when DRIP is on (`optimizer_core.js:3714-3716`, which adds them
to both gains and balance). The routed surplus is added to balance and basis only (`:3229-3233`).
So the user's question "is the routed amount inside BrokerageG?" has the answer NO, and "is it
only growth?" has the answer NOT QUITE - it carries DRIP too. No column showed either fact, and
`cashDividends`/`cashInterest` were uncategorized keys, i.e. hidden columns.

**Shipped:** tooltips that say exactly this; `DRIP` and `SurplusBrok` columns under Brokerage Δ
(SurplusBrok also under Cash Δ); `SumBrokIn`, a running total of the two through the P86
running-total mechanism so Current $ mode works. BrokerageG's content is unchanged on purpose: the
asset-flow chart sums it as earnings, and pulling DRIP out would have moved that chart. **A test
holds the identity Brokerage(t) = Brokerage(t-1) - Brokerage- + brokerageG + SurplusBrok to $1 in
every year** on a fixture whose RMDs exceed spending (so surplus is routed), with DRIP on and off,
no advisor fee, no conversions. It held on the first run.

**The gains-attributable-to-contributions column the user floated is not built.** It needs a
shadow sub-balance (contributions compounding at the brokerage rate, drawn down pro rata with the
account) - a modeling choice about how draws are attributed, not a logging change. SumBrokIn is the
exact, cheap half: what was put in. Left as an open item.

**Balances chart scale.** Linear / log10 / log2 beside the person buttons. log2 is Chart.js's
logarithmic scale subclassed with a tick generator at powers of two: pixel geometry is inherited,
since log2 and log10 differ by a constant. A zero balance is a gap on a log axis by design, not a
point pinned to a floor that would read as a real balance.

## One year of RMD went missing at every first death, and the README was the spec all along  *(2026-09-03, `P105`, v11.1718)*

**Reported by the user from a share link**, not by any test: *"In 2049 it looks like it does not
calculate the correct IRA RMD. It appears it's only calculating the RMD for 'Spouse' not 'You'
because it's the year 'You' dies."* Right about the defect, one year off about the mechanism, which
matters for the fix.

**What the code did.** `computeIncome` moves the decedent's IRA into the survivor's account at the
top of the year (`optimizer_core.js`, step 1 of that function). `P84l` had correctly moved the RMD
basis to the **prior December 31** balance. Those two facts collide exactly once per death: in the
first survivor year the basis is read from the prior year-end SPLIT, where the money was still the
decedent's, and `yr.rmd1` is zeroed by its own `alive1 ?` guard. The balance was charged to nobody.
The year after recovered on its own, because by then the prior year-end split had the money in the
right account - which is why one year went missing per death and nothing ever looked broken.

**The death year itself was always right.** `alive1 = age1 <= die1` is inclusive, so the year
labelled by the user is the FIRST SURVIVOR year, not the year of death. On their plan person 1 dies
at 88 in 2048 and the 2048 RMD of $154,412 was taken. 2049 is the year that was wrong.

**Size, on the user's own plan** (browser, v11.1718): 2049 RMD $10,148 -> **$283,315**, which is
12.821% x ($2,130,705 inherited + $79,151 own). 2050 unchanged in form at $288,077 = 13.699% x
$2,102,964, prior IRA1 zero, so the added term self-extinguishes and cannot double-count.

**Size, across fixtures** (node A/B against a pre-fix copy, `.test_harnesses` not needed - the
scratch A/B is reproducible from the two-line diff):

| fixture | first death | inheritance-year RMD | later years | spend | tax | final NW |
|---|---|---|---|---|---|---|
| single filer | none | 0 differing years | - | same | same | same |
| GK couple | 2052 | +$242,194 | -$11k..-$14k/yr | **identical** | +$49,329 | -$31,876 |
| `CAP_BASE` | 2034 | +$78,203 | -$0.5k..-$1.4k/yr | **identical** | -$459 | -$4,579 |
| user link | 2048 | +$328,848 | -$45,349 | **identical** | +$106,717 | -$41,896 |

**Spend is identical to the dollar in every arm.** The fix moves ordinary income and therefore tax
and ending wealth, never the plan's spending. The small NEGATIVE drift in the years after the
inheritance year is a knock-on, not a second effect: a larger distribution leaves a smaller balance
for the next year's basis.

**The direction of the two re-pinned tests looks wrong and is not.** `P38`'s forced-IRA total falls
30,943 -> 20,309, because `ForcedIRA` counts the backstop and a bigger RMD means the backstop
reaches less far. That is the same identity the `P84l` re-pin recorded in the other direction:
smaller RMDs and a larger backstop are one fact seen twice.

**README:665 already described the correct model** - *"the most effective way to manage this is for
the survivor to take over the deceased's IRA/401K balance. The now larger balance will be subject to
the survivors RMD requirements"* - so this was never a design choice being revisited. The document
was the spec and the engine did not implement it. Worth remembering when a "is this intended?"
question comes up: the prose in the README is evidence, and here it was decisive.

**A survivor under their own RMD age still takes nothing**, because `getRMDPercentage` returns 0
below the start age and the inherited balance is charged at the SURVIVOR's percentage. That is the
treat-as-own election, and it falls out of the fix rather than needing a branch.

**The guard was verified to fail pre-fix**, not just to pass post-fix: on `CAP_BASE` the old engine
charges $3,151 where the combined basis requires $73,834, so both assertions in the new
`test.critical` fail against it. A test that cannot fail guards nothing.

## The menu was never a grid, and the single-path cover's best pick is the worst one out of sample  *(2026-09-03, `P104b2`, v11.1718)*

Report: `research/CONSTANT_SPLIT.md`. Harnesses `split_fine_harness.js` (8,640 sims, 6.4 s) and
`split_mc_harness.js` (21,600 sims). Codes are defined in that report's reading guide; a vector is
`[IRA, Brokerage, Cash, Roth]` relative weights, named in tenths, so `B9C1` is 90% Brokerage / 10%
Cash.

**1. The ten-archetype menu leaves a median 76.4% of the achievable gain unclaimed.** `F-P1`
predicted under 10% and was WRONG by an order of magnitude. Worst cell `brokheavy @4% b20`: menu
$112,467, exhaustive $791,291. In THREE of thirty cells the menu's best move was to leave the default
alone ($0) while the 286-vector grid found $354,823-$636,049. **The menu is the oracle's
hand-written list of shapes, not a grid anybody optimized**, and every earlier `P104` number that
reads "the best constant is X" means "the best of ten hand-picked constants". Nothing was wrong with
those runs; the scope of their conclusion was narrower than the wording suggested.

**2. Every one of the 30 fine winners is a BLEND**, and no shipped strategy family can express a
blend. That is now measured twice (`P104a` 7 of 10 on the menu, this 30 of 30 exhaustively).

**3. Basis moves the SIZE of the gain, not the identity of the winner.** Brokerage share is
non-decreasing from b20 to b80 in 8 of 10 mix-rate pairs and the dominant account is unchanged in 9
of 10. Cheaper brokerage draws make the winner lean further into Brokerage without changing what
kind of vector it is. **Consequence for the row budget: a shipping grid needs no per-basis rows.**

**4. THE RULE THIS EARNED. A greedy cover fitted to single paths ranks candidates in nearly the
reverse of their out-of-sample order.** The cover's first pick `B7C2R1` had the best mean capture
across 30 hindsight cells (64.9%) and wins **1 of 6** Monte Carlo cells for a median $55,047. `B9C1`,
which the cover added LAST of four, wins **6 of 6** for $747,009. Both facts come from the same
engine and the same fixtures; only the foresight differs. `P103e` had already shown a single-path
winner can reach 0% survival - what is new is that the inversion happens even when every candidate
survives, so "it passed the MC gate" is not a substitute for "it was SELECTED under uncertainty".
Select on the MC table; use the single-path cover only to decide what to put in it.

**5. `V-P4` RIGHT 6 of 6, so the kill switch did not fire.** In every cell, between 4 and 10 of the
eleven vectors beat Proportional +0% at the median in all three MC modes with survival held. A fixed
account split is a real lever and not a hindsight artifact.

**6. No vector holds the 10th-percentile floor everywhere.** All eleven, including all four
recommended, lower p10 in at least one mode-cell, by $123,599 to $516,573. A fixed split raises the
median and holds survival; it does not improve the bad case and can cost there. This is a property of
a row a USER may pick, so it belongs in UI copy - the same argument as `feedback_ui_labels_tooltips`
about essential information never being tooltip-only.

**7. `V-P1` RIGHT, and worth keeping for the reason rather than the verdict.** `Cash` gives up
survival in 1 of 6 bootstrap cells and is median-best in 0 of 6, with the second-worst floor in the
table. A single-account vector is not an exclusive draw - phase 2 of `calculateWithdrawals` spills
into the account order - so `{Cash: 1}` has Ordered CIBR's shape, and CIBR is what `P103e` measured
at 0% survival. **Predictions were scored as written even though the re-baselines had already
displaced `Cash` as the single-path winner twice.** A prediction that is re-aimed after the fact
measures nothing.

## The row's strategy selection is a hand-kept list, and it had already drifted  *(2026-09-03, `P104b3`)*

Building the Fixed Split family surfaced a live defect in code that predates it. `_selection` on an
Optimizer row - the object `loadOptimizerResult()` restores the sidebar from - is a **hand-written
object literal** in `optimizer_ui.js`, while `STRATEGY_SELECTION_FIELDS` in core is the canonical
list that `sameStrategySelection()` compares on. `P104b1` added `splitWeights` to the canonical list
and nothing added it to the literal.

**The symptom, reproduced in the browser before the fix:** clicking a row labelled
`Fixed Split / Brok 60 / Cash 20 / Roth 20` set the strategy and left the sidebar's previous mix
(2/3/4/1) in place. The table showed one plan and the click ran another - the PF8 defect class that
this very object's own comment says it exists to prevent, and which that comment records having
already happened once for `orderedSeq`, the IRMAA tier, the ACA multiple and the GK guardrails.

**The fix is structural, not another entry in the list:** `...selectionOf(inputs)` is spread first
and the explicit fields follow, so a field added to `STRATEGY_SELECTION_FIELDS` is carried
automatically while the existing coercions (`!!`, `?? -1`, `?? ''`) that `sameStrategySelection`
relies on are preserved. No test pins this because the spread is what guarantees it - a test would
only re-check the guarantee - but the hazard is worth remembering: **a duplicated field list beside
a canonical one drifts, and here it drifted silently for a full phase.**

Worth checking next time something is added to `STRATEGY_SELECTION_FIELDS`: the MC worker posts a
summary of each variation back to the page and had the same class of hand-kept list, which the core
comment says already dropped four fields once.

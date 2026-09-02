# Test harnesses

Index of the investigative / audit scripts for the retirement optimizer engine, and of the reports
they produce. These are **not** part of the regular unit-test suite (`optimizer_core.tests.js`); they
are kept so a finding can be re-derived on demand.

This file is a catalog, not an introduction.

**Two directories, and the split is deliberate.** The **scripts** live in `.test_harnesses/` and the
**reports** live here in `research/`, one `<SUBJECT>.md` per study, indexed by
[`README.md`](README.md). Until 2026-08-28 both sat in
`.test_harnesses/`, which was hard to scan and also hid the half worth reading: Jekyll skips
dot-directories, so nothing under `.test_harnesses/` is reachable on the deployed site, and every
report was invisible with it. `research/` is published, so each report is readable at
`/research/<NAME>_RESULTS.html`.

The consequence to remember when writing one: **a link from a report back to its script must be an
absolute GitHub blob URL, not a relative path.** A relative `../.test_harnesses/x.js` resolves fine
in a local checkout and 404s on the site.

A new harness therefore lands as two files: the script in `.test_harnesses/`, its report here, and a
row in the table below.

**What does not belong in either:** anything the suite needs in order to pass. `sweep_golden.js` and its
two regenerators live at the repo root next to `optimizer_core.tests.js`, which `require`s the golden
at load time — they are fixtures, not studies. The rule and the reasoning are in
[`ARCHITECTURE.md`](../ARCHITECTURE.md#where-a-test-file-belongs).

| harness | runs in | what it answers |
|---|---|---|
| `betr_harness.js` | **node** | Is the Break-Even Tax Rate (BETR) signal trustworthy? |
| `stopyear_harness.js` | **browser console** | When should a plan stop Roth conversions? |
| `unifiedconv_harness.js` | **node** | Does modeling every voluntary IRA withdrawal as a Roth conversion change anything? |
| `gapfill_harness.js` | **node** | Is the `[40, 60]` Brokerage/Cash split in the default gap fill load-bearing, and is 40 right? |
| `ordered_fill_harness.js` | **node** | Ordered strategy: does the account sequence restart from the top every year, and where does the year's leftover surplus get banked? |
| `brokerage_harness.js` | **node** | Why is Brokerage barely drawn, and is the third-pass exclusion to blame? |
| `phased_harness.js` | **node** | P36 round 1: which families rank where under every objective, and do any arms never win? |
| `oracle_harness.js` | **node** | P51: how far below the perfect-foresight ceiling does each family sit, and is it conversions or the split? |
| `oracle_crosscheck.js` | **node** | P51d: is the oracle's ceiling really a ceiling? Runs a search of a different shape at the same sim cost and reports how much more it finds. |
| `schedule_replay_harness.js` | **node** | P103b2: what can `strategy: 'schedule'` carry? Compiles each shipped family into a per-year schedule, replays it, and prints where the representation runs out. |
| `schedule_oracle_harness.js` | **node** | P103b4: does the wider representation reach higher? Searches per-year ceilings against the same base row and budget as the conversions-only oracle. |
| `gk_drawrule_harness.js` | **node** | P103d: which DRAW rule belongs under a Guyton-Klinger SPEND rule? Runs every shipped family with `spendRule: 'gk'` against GK deciding both. |
| `gk_drawrule_mc_harness.js` | **node** | P103e: does that survive uncertainty? Re-runs the P103d candidates over Monte Carlo paths and reports medians, p10 and SURVIVAL rather than an argmax. |
| `spend_objective_harness.js` | **node** | P103b5a: can the spend axis be searched, and under what objective? Traces the (spend, wealth) frontier and asks where each candidate objective's optimum lands. |
| `endgame_harness.js` | **node** | P35n: once the IRA sits at its target, what should the tail draw from? |
| `irmaa_margin_harness.js` | **node** | Does an explicit IRMAA safety margin buy anything, now that the tier ceiling is projected forward? |
| `irmaa_cpi_risk_harness.js` | **node** | Same question with the CPI allowed to come out different from the one the plan assumed. Reverses the answer. |
| `irmaa_default_harness.js` | **node** | Which margin setting should be the DEFAULT, and which of the six can be deleted. Separates the IRMAA effect from the conversion-sizing side effect that dwarfs it. |
| `cpi_index_harness.js` | **node** | P70a: does indexing the tax code at a FIXED CPI, while spending follows the path, overstate tax on high-inflation paths? Yes, by 8% overall, and it invents plan failures. |
| `irmaa_margin_paths_harness.js` | **node** | P83: which IRMAA safety margin is best once the threshold is UNCERTAIN? Reruns the margin question against all three Monte Carlo modes, now that realized and assumed CPI diverge. |
| `gapfill_objectives_harness.js` | **node** | P30h: should the `[40,60]` gap-fill blend be deleted and unified on the Cash-first cascade? Scores every OPTIMIZER_OBJECTIVES key plus a liquidity measure. |
| `convtiming_harness.js` | **node** | P85: does it matter WHICH YEARS a conversion program lands in, and is RMD suppression the reason? Front-load vs level vs back-load at equal lifetime gross. |
| `rmdbasis_harness.js` | **node** | P84k/P84n: how wrong was the RMD basis, and did fixing it move what the characterization predicted? Run before and after `P84l`. |
| `bracketbasis_harness.js` | **node** | P87a: the strategy Limit dropdown's federal entries are taxable-income thresholds spent as MAGI ceilings. How much room does that leave unused, and is the room worth anything? |
| `convopt_ceiling_harness.js` | **node** | P88f: should the Optimizer's conversion search skip the families that target a ceiling? Measures what it picks for them, whether those picks break the ceiling, and what excluding them would cost. |
| `extraconv_magi_harness.js` | **node** | P88a/P88b: an Extra Roth Conversion never reached MAGI, so the IRMAA lookback charged a figure that omitted it. How wrong was it, and did fixing it move what the characterization predicted? |
| `ceilded_harness.js` | **node** | P92a: the ceiling cannot ask for the year's own deduction without circularity, so which OBTAINABLE deduction is least wrong? Scores three candidates against the one actually charged. |
| `underfill_harness.js` | **node** | P87c: a Fill Bracket plan stops exactly 15% of its Social Security short of its own ceiling. Which years, and how much headroom goes unused? |
| `ssbasis_harness.js` | **node** | P87c1: in a year where a ceiling binds, is the taxable share of Social Security pinned at its 85% cap, in a sloped tier, or zero? Decides whether the fix can be a flat subtraction or has to solve the fixed point. |
| `ssbasis_arms_harness.js` | **node** | P87c2: three arms over 720 cells - full benefit (the defect), flat 0.85, and inverting the MAGI relation. Neither armed form can breach, so the question is how much headroom each recovers. |

## Re-evaluation status (2026-08-30)

Five engine changes landed between 2026-08-26 and 2026-08-30, after most of the studies below were
measured. This section records which of them a harness can still reproduce. It is a **triage record,
not a re-baseline**: no report's tables have been rewritten, and where a number here disagrees with a
report, the report is the stale one.

### The changes

| id | change | commit | what it moves |
|---|---|---|---|
| `F1` | tax code indexed at each path's own inflation | `d0f27d0` | every CPI-sensitive or Monte Carlo run |
| `F2` | RMD struck off the prior December 31 balance | `4df83b8` | every plan taking an RMD |
| `F3` | an Extra Roth Conversion reaches MAGI | `b34e310` | lifetime IRMAA, by +30% to +132% |
| `F4` | a Fill Fed Bracket ceiling fills the bracket | `4664958` | every bracket-family plan |
| `F5` | the `minlimit` strategy is removed | `46f7bb6` | any grid naming it |

### Verdicts

`BROKEN` the harness can no longer derive its finding. `DRIFTED` it runs, but recorded numbers do not
reproduce. `CURRENT` re-run agrees with the report. Every harness exits 0, so running clean is not
evidence of currency.

| harness | verdict | evidence |
|---|---|---|
| `bracketbasis_harness.js` | **FIXED 2026-08-30** | was BROKEN (`F4`): printed `flag armed: BROKEN` and scored four predictions on a column of zeros. Re-pointed onto `-ceilDedAddBack` as a one-arm audit of the shipped ceiling; `A1`-`A5` all HOLD |
| `convopt_ceiling_harness.js` | **FIXED 2026-08-30** | was BROKEN (`F5`): printed `every result below is suspect` and kept going. Dead family dropped, setup check now stops the run. `C2` restored to **44 of 44** - see the re-run note in the report |
| `phased_harness.js` | **DRIFTED** (not broken) | reads `buildStrategyFamilies()` and self-adapts - it printed **148 arms** at runtime. The harness is sound; the REPORT is stale at 192, so "118 of 192 arms never win" needs re-deriving. Leaders stable (`B-P5` RIGHT) |
| `ordered_fill_harness.js` | **COVERAGE FIXED 2026-08-30** (not broken) | its restart proof is explicitly sequence-independent, so the finding always stood; but it hard-coded 3 of the 6 codes shipped since `dd309bf`. Now reads `core.ORDERED_SEQS`, so all six are exercised |
| `convtiming_harness.js` | **RE-BASELINED 2026-08-30** | was DRIFTED (`F3`,`F4`): clean cells 499 -> 474, FRONT outright wins 304 -> 233. `CONVERSION_TIMING.md` is now the third run throughout |
| `irmaa_default_harness.js` | **DRIFTED** (`F3`,`F4`) | halfcpi -$79,002 -> -$64,043, halfstep -$11,649 -> -$29,203; "four to five times less" is now about 2x. Verdicts on P3/P4/P5 unchanged |
| `brokerage_harness.js` | **FIXED 2026-08-30**, still DRIFTED (`F2`,`F4`) | carried a FIFTH instance of the `F5` defect, found only on the final sweep: its `minlimit` arm returned the `__unrecognized__` baseline arm bit-for-bit while staying filed under the `bracket` family. Re-pointed to bracket @ IRMAA tier 1. Numbers still drifted: cyclic 26/45 -> 25/45 and 23/45 -> 19/45, Q4 pairs 2,576 -> 1,981. The no-spiral headline survives (0 capped years) |
| `gapfill_harness.js` | **DRIFTED** (`F2`,`F4`) | 227/360 -> **242/360** cells move. w=0 still best; the conclusion survives |
| `endgame_harness.js` | **DRIFTED** (`F2`) | seq-CRB 88/108 -> 84/108; Roth-early 100/108 -> 94/101. All five verdicts unchanged |
| `unifiedconv_harness.js` | **DRIFTED** | drifted again past its own 2026-08-24 re-baseline: negative in 26/60 -> 29/60, worst -$633,605 -> -$635,692 |
| `oracle_harness.js` | **RE-BASELINED 2026-09-01** (`P103a`) | was DRIFTED. Both halves re-run on engine `1b7b366`: median best-family gap **4.35% -> 1.58%**, the +$1.08M conversion headline is now +$122k, and the dominant lever flipped from conversion timing to the withdrawal split. `S3-P2` WRONG -> RIGHT, `B-P4` RIGHT -> WRONG. Report is the second run throughout |
| `oracle_harness.js --spendchange` | **CURRENT, first result CORRECTED** | new 2026-09-01 (`P103b5c`). Alone it looked like the median gap DOUBLES on a declining path; crossed with `--reserve0` it does not move at all (2.03% -> 1.94%), and the flat-scalar headline holds ($0 in 44/44 on both paths). **The two fixtures interact - vary them together or the confound just moves.** What survives: max conversions-only gain 0.57% -> 9.55%, `S3-P4` flips WRONG, and the regime map relocates to 8%-spend cells |
| `oracle_harness.js --reserve0` | **CURRENT** | new 2026-09-01 (`P103b1`). Holds surplus routing constant across arms. Negative gaps 1 -> **0**, median gap 1.58% -> 2.03%, and the winning strategy changes in 4 of 6 headline cells |
| `gk_drawrule_mc_harness.js` | **CURRENT** | new 2026-09-01 (`P103e`). **Overturns `P103d`'s ranking.** The single-path winner (Ordered CIBR) survives 3-21% of paths in four cells; the robust winner is Fill Bracket 22%, median-best in 5 of 6 at 100% survival. `E-P1`/`E-P3` RIGHT, `E-P2` WRONG - one candidate bought wealth with survival |
| `gk_drawrule_harness.js` | **CURRENT** | new 2026-09-01 (`P103d`). **GK's draw is beaten in 24 of 30 cells (80%)** - 15/15 at 6% spend - worth a median $231,345 and $6.56M in total. Six distinct winners, so the replacement is regime-gated. `G-P1` and `G-P3` WRONG, `G-P2` RIGHT |
| `spend_objective_harness.js` | **CURRENT** | new 2026-09-01 (`P103b5a`). The model trades **1.38-3.31** dollars of terminal wealth per dollar of lifetime spending, against a `SPENDABLE_WEIGHT` of 1.10, so the scalarized optimum sits at MINIMUM spend in 3/3 cells. `O-P1` WRONG (opposite direction), `O-P2` and `O-P3` RIGHT. Also finds feasibility NON-monotone in the spend goal |
| `schedule_oracle_harness.js` | **CURRENT** | new 2026-09-01 (`P103b4`). Arm S (schedule) beats Arm A (conversions-only) in **6 of 6** cells, +0.25% to +1.82%, on an eighth of the compute in some. `S-P1` RIGHT |
| `schedule_replay_harness.js` | **CURRENT** | new 2026-09-01 (`P103b2`, widened by `P103b3`). **8 of 11 arms replay EXACTLY**: every ceiling family including ACA across its lapse, plus IRA Draw and Reduce via the quantity lever. Proportional, Ordered and Guyton-Klinger carry nothing - they decide a split or the spend, not an IRA draw. `R-P1` WRONG |
| `oracle_crosscheck.js` | **CURRENT** | new 2026-09-01. `X-P1` RIGHT 5/5: an equally-costed search of a different shape beats the oracle's descent by at most **0.013%**, so "lower bound" is near-tight on the conversion axis. `X-P2` and `X-P3` WRONG |
| `rmdbasis_harness.js` | **CURRENT** | 0 of 30 timing-dependent, R2 violated in 0 of 30 - the post-fix column exactly |
| `extraconv_magi_harness.js` | **CURRENT** | self-reports `FIXED BUILD`. Two recorded constants moved under `F4` (M3 $39,920,984 -> $39,693,824; M5 year-0 tax $39,238 -> $49,317) |
| `underfill_harness.js` | **SUPERSEDED by its own fix** | measured the defect P87c then shipped (v11.16d4). It now reads 0.000000 and $0 on the same fixture, which is the check it has become; section 9's numbers are the pre-fix record |
| `ssbasis_harness.js` | **CURRENT** | 2026-08-31, section 10.1. Run against the PRE-fix engine; re-running it post-fix measures the new sizing, not the regime split |
| `ssbasis_arms_harness.js` | **SUPERSEDED by its own fix** | its OFF and flat85 arms were removed from the engine when `exact` shipped unconditionally, so the three-way comparison is no longer reproducible. Section 10.3 is the record |
| `ceilded_harness.js` | **CURRENT** | shipped with `F4` |
| `cpi_index_harness.js` | **CURRENT** | re-run 2026-08-26 carrying the CPI spread |
| `betr_harness.js` | **UNREVIEWED** | 2026-07-23, the oldest finding here; `F2` and `F3` both bear on it |
| `stopyear_harness.js` | **UNREVIEWED** | browser console, not runnable in this sweep |
| `gapfill_objectives_harness.js` | **DRIFTED** | `W4` damping 10x -> 3.0x ($33,203 off vs $10,997 on) |
| `irmaa_margin_harness.js` | **DRIFTED** (`F3`) | P1/P2/P5 all score WRONG against a header that expected them to hold |
| `irmaa_cpi_risk_harness.js` | **DRIFTED** (`F1`,`F3`) | 2026-08-20, predates path-following indexation and the MAGI fix it re-bills against |
| `irmaa_margin_paths_harness.js` | **DRIFTED** (`F3`) | `P1` and `P3` both BROKEN |

### Suggested order

Items 1 and 2 were done on 2026-08-30 and are recorded above; 3 onward are open.

1. ~~`bracketbasis` and `convopt_ceiling`~~ - DONE. Both printed their own alarm and kept printing
   tables underneath it, which is the failure mode worth naming: **an alarm that does not stop the
   run reads as a caveat, and gets quoted past.** Both now exit non-zero instead.
2. ~~`ordered_fill` coverage~~ - DONE, and `phased` needed no code change at all.
3. ~~`convtiming`~~ - DONE 2026-08-30. The headline did change direction: FRONT's outright wins fell
   304 -> 233, below a majority, while `C1` (a head-to-head prediction) went on HOLDING - recorded in
   that report's section 9 as a seventh scorer defect, **a prediction too weak to notice its own
   subject changing.** `README.md` line 15 updated with it.
4. `phased` - re-derive the report against the shipped 148 arms.
5. The four IRMAA harnesses as one pass - they share `F3`, and `irmaa_margin`/`irmaa_cpi_risk` were
   measured before `F1` as well.
6. The rest are safe to quote qualitatively; only their tables have moved.

### The fifth instance, and why grep found what the run did not

`brokerage_harness.js` was classified DRIFTED because it ran clean and its headline held. It also
carried the same dead strategy, and nothing in its output said so: `minlimit` matched no withdrawal
branch and returned the harness's own `__unrecognized__` baseline arm **bit-for-bit** (IRA spend
584,280, Brokerage draw 355,937 on both), while `FAMILY` still counted it as a `bracket` row. So a
baseline run was being averaged into the bracket family, in a harness whose entire subject is which
family draws Brokerage. The arm it was always describing - `stratRate: 0, stratIRMAATier: 1` - is
bracket at IRMAA tier 1, which draws nearly twice as much (1,106,839 / 1,580,968).

It was found by grepping for the retired name after the four fixes were done, not by reading output.
**A silently duplicated arm produces no alarm at all** - it is strictly worse than the two that
announced themselves, and the only defence is checking the names a harness passes to the engine
against the engine.

### What the two genuine breakages had in common

Neither was a crash, and both printed a correct diagnosis of themselves that was then buried under
the output it invalidated. `convopt_ceiling` said `every result below is suspect` and printed 270
cells of results; `bracketbasis` said `flag armed: BROKEN` and scored four predictions anyway. A
harness that detects its own premise has failed should exit, not narrate - that is the one change
made to both.

`research/README.md` carried drifted figures in its own prose at lines 15, 18 and 34; line 34
(`61 of 61`) and line 15 (`two to one`) were corrected on 2026-08-30. Line 18 is still stale.


## betr_harness.js  (node)

```bash
node .test_harnesses/betr_harness.js
```

Self-contained: stubs the DOM globals and `require()`s `taxengine.js` + `optimizer_core.js` the
same way `optimizer_core.tests.js` does. Compares, for several legacy scenarios, the tool's shown
BETR (`totals.betrAvg`) against (a) the Kitces closed form recomputed at years-to-RMD vs the full
horizon, and (b) the **empirical** break-even heirs rate `t*` derived from two full simulations
(convert vs a plain no-conversion run). Also prints the concrete after-tax gain from converting at
several heirs rates so the verdict needs no interpretation.

**Finding (2026-07-23):** the closed-form BETR is algebraically correct but, as used, materially
overstates the rate needed to justify converting. The years-to-RMD horizon is a minor contributor
(~1-2 pts); the dominant gap is that the closed form ignores the RMD/IRMAA/SS/bracket second-order
taxes the full simulation captures. See the audit notes in the header comment and the on-screen
caveats (the cash-drag amplifier / audit Q2).

## stopyear_harness.js  (browser console)

Paste into the retirement optimizer's browser console after loading a scenario (it depends on the
page's `getInputs()` / `simulate()` / `afterTaxNetWorth`). Re-runs the plan at every conversion
cutoff and scores each on after-tax net worth to find the best year to stop converting. This is the
research harness behind Phase P24; the production version of the search now lives in
`optimizer_core.js` as `bestConversionStopYear()`.

```js
// in the page console:
EV2.reportStopYear();        // per-cutoff table for the current sidebar scenario
EV2.reportPolicies();        // best amount vs best stop-year vs joint
```

## gapfill_harness.js  (node)

```bash
node .test_harnesses/gapfill_harness.js
```

**Full results, tables and reasoning live in [`GAPFILL_SPLIT.md`](GAPFILL_SPLIT.md).** This entry
is the index; that file is the reference.

Sweeps `gapFillWeights` (P30a) over 0/20/40/60/80/100 as Brokerage's share of the default gap-fill
branch, crossed with P28's 5-mix x 3-spend-rate ladder, 2 states (CA / TX), 2 Cash-Reserve settings
and both `thirdPassBrokerage` arms, plus 3 guard families = 2,430 simulations in about 2 seconds.
Scores on `baselineScoreOf` against the w=40 arm of the same cell, at the CONTROL arm's
`futureIRARate` rather than each arm's own - `unifiedconv_harness.js` used per-arm rates, which
discounts the two sides of an A/B differently.

Headline findings:

1. **The blast radius is three families.** Proportional, Reduce and Guyton-Klinger. The bracket
   family and Ordered take their own branches and are **bit-identical at every weight across 270
   guard runs**.
2. **The constant is load-bearing.** 227 of 360 cells move by more than $1,000 across the range;
   the widest moves $616,919.
3. **40 is not the number.** Among the 82 cells that are clean wealth comparisons - delivered spend
   unchanged, every weight funding the plan - w=40 is best in **zero**. w=0 is best in 65.
4. **Cash Reserve damps it by an order of magnitude.** CA's widest cell falls from $534,525 with the
   reserve off to $33,358 with it on. The reserve is the bigger lever; state matters much less.
5. **P32 does not explain it.** The weight curve has the same shape with `thirdPassBrokerage` at
   'bounded' and 'off', so the third pass is not why w=0 wins. The separate P28 inversion hypothesis
   stays open.
6. **A prediction that could not fire.** The zero-predicate carried over from P28 was scored
   VACUOUS: no cell in this grid had a control arm that never drew Brokerage.
7. **The bracket family's constant goes the OTHER way (P30c).** That branch drains Cash before
   Brokerage, and it is right to: swapping loses in 21 of 23 clean cells, by up to $587,970, and in
   every cell of the CA / reserve-off slice. So the two constants disagree with each other and the
   bracket branch is the one that got it right - both results say fill a gap from Cash first.
8. **Two of the three shipped Ordered codes are dominated (P30d).** Across 60 cells, RIBC and
   BIRC never win once; CBIR wins 14; the outright best is **CBRI**, which is not offered, winning
   22. An unshipped ordering beats every shipped one in 15 clean cells, by up to $858,316.
9. **And the Cash-first story stops at Ordered.** "Cash before Brokerage" wins exactly 30 of 60
   cells there - a coin flip - because a four-account sequence also places the IRA and Roth, and
   where those sit swamps the pair that governs the two automatic branches. The narrower "Cash
   FIRST" does survive, 46 of 60.
10. **What shipped (P30g, v11.163F).** The menu, not the weight. Ordered now offers six sequences -
    CBRI, CBIR, CIBR, BCIR, RIBC, BIRC - ordered by wins and, on a tie, by the dollars at stake when
    that ordering wins (section 15 of the results). `gapFillWeights` and `bracketGapOrder` stay
    research inputs, unset: the bracket branch is already right, and w=0 has not been checked
    against the other Optimizer objectives or against the liquidity cost of holding no cash.

## unifiedconv_harness.js  (node)

```bash
node .test_harnesses/unifiedconv_harness.js
```

**Full results, tables and reasoning live in [`CONVERSION_ROUTING.md`](CONVERSION_ROUTING.md).** This entry is the
index; that file is the reference.

**Settled 2026-08-24 (P28f).** `unifiedConvRouting` was deleted from the engine after it measured
inert, and its arm (A1) went with it -- an arm setting a flag nothing reads would report as the
control and look like a result. `rothGapFill` shipped, as the *Roth before Brokerage* switch and
the Optimizer's 🅡 rows. The grid is now 6 arms, 540 simulations.

**The recorded numbers no longer reproduce.** Re-running on today's engine gives a
`fillCashThenRoth` range of +$470,977 to -$633,605, negative in 26 of 60 cells, against the
+$3,559,596 / 1-of-60 below. The mechanism inverted too: the largest Brokerage draws in the grid now
produce the largest LOSSES, where they used to produce the largest gains. The zero-predicate still
holds. Full re-baseline in `CONVERSION_ROUTING.md` section 15 - quote that, not the 2026-07-30 tables.

Tests a proposed nerdknob (P28): model every **voluntary** (non-RMD) IRA withdrawal as a Roth
conversion, then spend out of Roth. Runs a 5-mix account ladder (shipped defaults -> balanced thirds
-> brokerage-heavy) x 3 spend rates (4/6/8% of total assets) x 6 strategy families x 6 arms = 540
simulations in about a second, and scores its own predictions so a wrong one is visible rather than
quietly dropped.

Research inputs on the engine, **default off, none set by any UI**:

| input | values | what it does |
|---|---|---|
| ~~`unifiedConvRouting`~~ | ~~bool~~ | **removed 2026-08-24** -- the voluntary draw was CALLED a conversion; spending round-tripped through Roth |
| `rothGapFill` | `'fillCashThenRoth'`, `'fillRothThenCash'` | where Roth sits in the gap fill. Unset = today (Roth last). `ordered` excluded. **Now also a UI control**, and `'fillCashThenRoth'` is swept as the 🅡 rows |
| `forceWithdrawTiming` | `'early'`/`'late'` | pins the month-1 vs month-11 withdrawal rule, which conversions otherwise flip |

Headline findings:

1. **The reframe is inert.** 0 money fields move in 90 mix x rate x family cells. It is arithmetic:
   draw X, tax T, spend S -- today Roth gains X-T-S; routed, it gains X-T then returns S.
2. **`rothConv` is engine state, not a display field** -- `beginYear` reads `log[y-1].rothConv > 1000`
   to pick withdrawal timing. Reporting the reframe through it moved 780 money fields.
3. **The real lever is where Roth sits in the gap fill.** Roth pays when it displaces a *Brokerage*
   draw (avoids realizing gains) and loses when it displaces *Cash* (Roth compounds at growth
   tax-free; Cash earns cashYield and is taxed). Hence `fillCashThenRoth`, the better of the two
   positions in **54 of 60** cells. Its own range has since widened to +$470,977 / -$633,605 -- see the
   re-run warning above; the 2026-07-30 figures were -$12,466 worst and **+$3,559,596** best.
4. **No Brokerage draw, no lever.** Every cell whose control arm never touched Brokerage returns
   exactly $0. That is a sharper rule than any portfolio-ratio heuristic -- two candidate rankings
   were scored and both failed. The payoff peaks at **6% spend**, not at the highest mix or rate.
5. **`fundConversionWithCash` compounds with it** (+$302k of interaction on round-1 Fill Bracket)
   while being *negative* alone there. Do not judge "Use Cash" in isolation.
6. **`convertExcessToRoth` loses on its own in 28 of 75 cells**, worst -$1,411,488 -- but only **7**
   survive pinning withdrawal timing, and at 4% spend it is worth **+$2.1M** in IRA-heavy mixes. Most
   of its apparent downside is the invisible month-1/month-11 timing flip, not tax. The genuine
   losses are the Cash-buffer effect: routing the surplus to Roth starves the buffer and pushes the
   gap fill onto Brokerage.
7. Roth-first and `convertExcessToRoth` are **near opposites** (one drains Roth, one fills it) and
   fire in disjoint years -- 0 overlap in 33. Together they score less than Roth-first alone.

## phased_harness.js  (node)

```bash
node .test_harnesses/phased_harness.js
```

**Full results, tables and reasoning live in [`STRATEGY_FAMILY_RANKING.md`](STRATEGY_FAMILY_RANKING.md).**

P36 round 1. Runs the Optimizer table's OWN enumeration (`buildStrategyFamilies`, nerdknob
configuration, 192 arms) over a crossed 45-cell grid (P28's 5-mix ladder x wealth x0.5/1/3 x spend
4/6/8%) and ranks every cell with the exported `rankRowsByObjective` on 7 core objectives +
`earliestbe` -- the UI's exact scoring recipe, shared heirs rate per cell. 8,640 sims, ~9s.

Headline findings (2026-08-10):

1. **Proportional is never top-3** on `networth`/`balanced` in any of 45 cells (prediction S1-P1a
   scored WRONG -- it expected >=60%). Overall mean rank 15.9 of 24.
2. **Guyton-Klinger's 178/360 votes are survivorship + spend drift, not efficiency**: eligible arms
   fall 160 -> 37 as spend goes 4% -> 8%, and GK's delivered spend drifts +38% to -12% vs a
   fixed-spend arm. At 4% strain GK takes zero leading votes.
3. **Cyclic clones take 141/360 votes** -- P32's Q3 "does cyclic ever win" is YES at the vote level.
4. **ACA Cliff never wins -- measurement artifact by construction** (one-sided ACA pricing).
5. **Zero test:** `Fill Bracket 10%` == its 💵 clone and `Ordered CBIR` == its 💵 clone in ALL 45
   cells -- the only deletion-grade evidence in the run. 118/192 arms never win anywhere, but that
   is a frequency observation, not deletion evidence.

## oracle_harness.js  (node)

```bash
node .test_harnesses/oracle_harness.js          # P51a conversions-only
node .test_harnesses/oracle_harness.js --full   # + P51c-g (needs the oracleWithdrawalPlan hook)
node .test_harnesses/oracle_harness.js --full --reserve0   # P103b1: CashReserve = 0, routing held constant
node .test_harnesses/oracle_harness.js --full --spendchange -1   # P103b5c: spend declines 1%/yr real
```

**Full results live in [`PERFECT_FORESIGHT_ORACLE.md`](PERFECT_FORESIGHT_ORACLE.md).** P51: perfect-foresight
trajectory oracle — per-year `extraConversionAmount[]` + per-year `oracleWithdrawalPlan`
splits, coordinate descent, spend pinned, backstops instrumented. An upper-bound DIAGNOSTIC
for one deterministic path, never a policy. 45 cells, 418k sims, 373s.

Headlines (**2026-09-01, engine `1b7b366`**): flat scalar conversions still find $0 in 45/45
cells, but per-year timing is now worth at most +$19.5k at default basis (+$201k at 20% basis)
where the first run measured +$241k; the **withdrawal split is now the larger lever in most
cells**; median best-family gap **1.58%**; "Proportional is default-optimal" still refuted
(gap 1.2-7.1%); one cyclic row still BEATS the oracle because surplus ROUTING is outside the
menu — cyclic's real residual edge. The 2026-08-10 numbers are superseded; the report's
before/after table says what moved.

## oracle_crosscheck.js  (node)

```bash
node .test_harnesses/oracle_crosscheck.js              # equal sim budget
node .test_harnesses/oracle_crosscheck.js --budget 3   # 3x budget arm
node .test_harnesses/oracle_crosscheck.js --cells all  # all 45 cells, slow
```

**Results live in [`PERFECT_FORESIGHT_ORACLE.md`](PERFECT_FORESIGHT_ORACLE.md), section `P51d`.** Answers the
question the oracle report has carried as open since 2026-08-10: the oracle calls its result a
ceiling, but its search is coordinate descent over a fixed menu, so every published gap is a lower
bound of unknown size. Arm A re-runs that descent IN THIS PROCESS; Arm B is a random-restart search
with block/shift/scale/swap moves at $1k grain, handed the same MEASURED sim count. Equal cost,
different shape.

Headline (2026-09-01): **Arm B never finds materially more — max +0.013% of after-tax NW at 3x
budget, and it does WORSE in one cell.** So the descent is close to its menu's own optimum on the
conversion axis. One-directional evidence only: it shows a different equally-costed search cannot
beat the descent, not that the descent is optimal, and the withdrawal-split axis is uncovered.

## schedule_replay_harness.js  (node)

```bash
node .test_harnesses/schedule_replay_harness.js
```

**Results live in [`PERFECT_FORESIGHT_ORACLE.md`](PERFECT_FORESIGHT_ORACLE.md), section `P103b2`.** Asks what
`strategy: 'schedule'` - the per-year decision vector, research-only and default-off - can actually
express. Compiles each shipped family's realized decisions into a `schedulePlan` via
`compileScheduleFromRun`, re-runs it as a schedule, and requires agreement to the dollar. A family
that cannot reproduce itself proves the representation cannot state what that family decides.

Headline after `P103b5` (2026-09-01): **8 of 11 arms replay EXACTLY, $0 on every column** - Fill
Bracket at three rates, IRMAA at two tiers, ACA across its mid-plan lapse, and IRA Draw and Reduce
through the quantity lever. **Guyton-Klinger's spend and IRA draw now round-trip to the dollar**
since `P103b5` added the spend field, but its run does not reproduce because it also splits its
draw across Brokerage and Cash. So the remaining boundary is a single thing: the schedule cannot
state how to SPLIT a draw across accounts, and that one gap is the whole of what stops
Proportional, Ordered and Guyton-Klinger.

At `P103b2` only 5 arms were exact. Prediction `R-P1` - a family is either fully expressible or not
at all - was WRONG, and the ACA counterexample is what named the missing fallback.

The two exact cases and the two failure modes are pinned as node tests in `optimizer_core.tests.js`;
this harness is the wider table.

## gk_drawrule_harness.js  (node)

```bash
node .test_harnesses/gk_drawrule_harness.js          # the 6% and 8% spend cells
node .test_harnesses/gk_drawrule_harness.js --all    # adds 4%
```

**Results live in [`PERFECT_FORESIGHT_ORACLE.md`](PERFECT_FORESIGHT_ORACLE.md), section `P103d`.** The regime map
put the money in high-spend plans where Guyton-Klinger is the best available family, so the
actionable question is not "what beats GK" but "GK decides the SPEND well - does it also decide the
DRAW well?" Incumbent is `strategy: 'gk'`; each candidate is a shipped family run with
`spendRule: 'gk'`, so GK keeps the spend and something else takes the draw. A candidate wins a cell
only by delivering no less lifetime spend AND more real terminal wealth.

Headline (2026-09-01): **GK's draw is beaten in 24 of 30 cells, including 15 of 15 at 6% spend**,
leaving $6,564,797 on the table in total and a median $231,345 per beaten cell. **Six different rules
win different cells** - Ordered CIBR 8, Fill Bracket 22% 6, IRA Draw 5% 5 - so the replacement is
regime-gated, not a new default. `G-P3` WRONG in an interesting direction: IRA-first rules win more
often than cash/brokerage-first ones here, the opposite of the `P35n` endgame result.

## gk_drawrule_mc_harness.js  (node)

```bash
node .test_harnesses/gk_drawrule_mc_harness.js               # 100 paths
node .test_harnesses/gk_drawrule_mc_harness.js --paths 200
```

**Results live in [`PERFECT_FORESIGHT_ORACLE.md`](PERFECT_FORESIGHT_ORACLE.md), section `P103e`.** Takes
`P103d`'s candidates and scores them over Monte Carlo paths instead of one deterministic path,
reporting median and p10 real terminal wealth, median lifetime spend and SURVIVAL - because a rule
that lifts the median while lowering the floor is not an improvement for someone living on it. Every
rule sees the same banks, seed and path index. Uses `buildBanks`/`buildPathInputs` from
`montecarlo/mc_engine.js` rather than a fourth copy of the model.

Headline (2026-09-01): **it overturns the single-path ranking in all six cells.** Ordered CIBR, which
won more single-path cells than any other rule, survives **3% to 21%** of paths in four of them. The
robust winner is **Fill Bracket 22%**, median-best in 5 of 6 cells at **100% survival**, worth
+$56,674 to +$600,128 of median terminal wealth against GK. `E-P2` WRONG: one candidate's extra
median wealth was bought with survival (57% against GK's 100%), which is exactly the disqualifier it
was written to catch.

NOTE for anyone extending it: the synthetic modes need `cfg.mu` and `cfg.sigma`. `buildBanks`
destructures them straight off `cfg`, so omitting one makes `logDrift` NaN and every balance follows
it silently - the first run of this harness printed a full table of `$NaN` at 100% success.

## spend_objective_harness.js  (node)

```bash
node .test_harnesses/spend_objective_harness.js
```

**Results live in [`PERFECT_FORESIGHT_ORACLE.md`](PERFECT_FORESIGHT_ORACLE.md), section `P103b5a`.** Asks the
question that has to be settled before `spendGoal` can become a schedule field: can the spend axis be
searched at all, and under what objective? Sweeps a constant spend multiplier on a fixed base row,
traces the achievable (spend, wealth) frontier, and reports where the scalarized optimum lands.

Headline (2026-09-01): the model gives up **1.38 to 3.31** dollars of real terminal wealth per extra
dollar of lifetime spending, while `SPENDABLE_WEIGHT` is **1.10**. Below the technical rate
everywhere measured, so the scalarized optimum sits at the MINIMUM spend tested in 3 of 3 cells -
**a weight cannot search this axis, and `P103b5` needs a frontier.** The rate also varies along one
frontier (1.38 to 3.31 in a single cell), so no single weight would fix it.

Two things it found on the way. `SPENDABLE_WEIGHT` is not wrong at its actual job - settling ties
between plans that deliver the same spend, where the term cancels, or the same wealth, where it
correctly prefers more spending; it simply cannot price a real trade-off. And **feasibility is not
monotone in the spend goal**: `totals.success` is a per-year `netIncome < targetSpend * 0.99` test, so
a plan can be feasible at 0.70, infeasible at 0.80 and feasible again at 0.90, which rules out
bisecting for the maximum sustainable spend.

## schedule_oracle_harness.js  (node)

```bash
node .test_harnesses/schedule_oracle_harness.js              # 6 named cells
node .test_harnesses/schedule_oracle_harness.js --cells all  # all 45, slow
```

**Results live in [`PERFECT_FORESIGHT_ORACLE.md`](PERFECT_FORESIGHT_ORACLE.md), section `P103b4`.** The question
P103 was opened to answer: `extraConversionAmount[]` is EXTRA on top of the base rule, so the oracle
can convert more than the rule and never less. `strategy: 'schedule'` makes the rule's own ceiling a
per-year number. Both arms take the same base row, objective, spend pin and MEASURED sim budget.

Headline (2026-09-01): **Arm S beats Arm A in 6 of 6 cells, +$11,259 to +$198,508 (+0.25% to
+1.82%)** - and in the two cells where the conversion oracle finds nothing at all, the schedule finds
~$198k. It also converges on roughly an eighth of the compute, because a multiplicative candidate set
is scale-free where a $25k grid is not.

The base is the best row whose compiled schedule REPLAYS IT EXACTLY, verified per cell. That matters:
an earlier version took the best non-cyclic row regardless, handed Arm S an empty plan in five of
seven cells (Ordered and GK compile to nothing) and printed a confident wrong answer after one
simulation per cell.

## endgame_harness.js  (node)

```bash
node .test_harnesses/endgame_harness.js
```

**Full results live in [`ENDGAME_DRAW_ORDER.md`](ENDGAME_DRAW_ORDER.md).** P35n: scenarios start IN
the endgame (couple 75/73, RMDs active, IRA at target) and bake off tail policies via the P51b
`oracleWithdrawalPlan` `{seq}`/`{prop}` entry forms. 144 cells, ~32k sims, ~13s.

Headline (2026-08-10): **Cash → Roth → Roth-displaces-Brokerage (`seq-CRB`) wins 88/108 cells;
the P35 PR-5 balance-proportional BALANCED spec is the WORST arm (median −$223k, wins 1 cell).**
Roth-early works because §1014 makes held Brokerage nearly free to heirs while drawing it is
taxed today (P28's "Roth pays when it displaces a Brokerage draw", applied from year 0 of the
endgame). Verdict is conversions-insensitive (36/36) and splits into a CRB/CBR tie only below
~$1.3M totals, where the 0% LTCG bracket makes Brokerage draws free. Sequenced beats
proportional at every wealth level tested.

## brokerage_harness.js  (node)

```bash
node .test_harnesses/brokerage_harness.js
```

**Q2/Q3/Q4 results live in [`BROKERAGE_DRAW.md`](BROKERAGE_DRAW.md).** P32's harness: q1 (how often is
Brokerage drawn -- premise refuted, re-run post-fix with three of four families UP), the
accounting audit that found the dividend double-credit (`e9a3c8b`), q2 (third-pass spiral --
**answered 2026-08-21: there is no spiral**, 0 capped years in 3,960 armed runs and `bounded`
identical to `unbounded` everywhere), and as of 2026-08-10 q3/q4 over the Stage-1 45-cell grid:

0. **q2 printed `SKIPPED` on every run from v11.1582 to 2026-08-21** because its probe tested for
   `totals.tpBrokIters`, a counter name that never existed. If a harness question reports SKIPPED,
   check the name it is probing against the engine before believing the question is blocked.

1. **Cyclic wins 26/45 cells (58%) as shipped, 23/45 with the surplus-routing confound
   removed** (`CashReserve: 0` control). About half the headline delta was the non-cyclic arm
   parking surplus in Cash; the genuine harvest value still reaches ~$891k in a cell.
2. **`cycleLTCGTarget: 0.20` is a live knob pointing the wrong way**: moves 898 of 2,576 pairs,
   wins 53, worst losses -$380k -- harvesting into the 15% bracket pays tax the terminal §1014
   step-up would have erased. Default 0.15 confirmed.
3. **Harvest years leave real money on the table** (descriptive): ~$111,700 of forgone IRA draw
   per harvest year; median row forgoes 57% of its lifetime voluntary IRA draws. Stage 2's q6()
   (`cycleCoexist`) measures the causal value of reclaiming it.

## cpi_index_harness.js  (node)

```bash
node .test_harnesses/cpi_index_harness.js
```

**Full results, tables and predictions live in [`BRACKET_INDEXATION.md`](BRACKET_INDEXATION.md).**

P70a. `sim.inflation` follows the path; `sim.cpiRate` - which indexes federal and state brackets,
the LTCG brackets, IRMAA thresholds, the ACA FPL multiple, the IRA goal and Social Security COLA -
advances at the fixed `inputs.cpi`. This harness runs the Stress Test's own scenario set through
both regimes, using the `fixedTaxIndexing` input (default OFF, i.e. path-following - the shipped model).

Unlike `irmaa_cpi_risk_harness.js`, which re-bills decisions in post and drops feedback as
second-order, this one needs the flag inside the loop: creep moves the bracket ceiling, which moves
the withdrawal, which moves the balance, which moves the ruin year.

Headline (2026-08-26, re-run carrying the default 0.2 pt CPI spread): **fixed indexation
overstates tax on high-inflation paths, and invents plan failures.** Lifetime tax across 780 plan-scenario pairs is 7.80% lower under path-following; 36
scenarios go from ruined to surviving and **none** goes the other way. The sign tracks
realized-minus-assumed CPI monotonically (+2.3% where the path's inflation came in BELOW the typed
CPI, -11.4% where it ran more than 3 points ABOVE), and the lower the CPI the user types, the worse
the distortion. Two surprises:
IRMAA surcharge YEARS move further than surcharge DOLLARS (-9.2% against -6.1%),
and the ACA effect shows up as a moved ceiling with zero breaches in either arm.

## convtiming_harness.js  (node)

```bash
node .test_harnesses/convtiming_harness.js
```

**Full results, tables and reasoning live in [`CONVERSION_TIMING.md`](CONVERSION_TIMING.md).**
This entry is the index; that file is the reference.

Answers a user question nothing else here could: converting *earlier* is supposed to beat converting
later, both because the dollars compound tax-free for longer and because a smaller IRA produces
smaller RMDs. `betr_harness.js` asks convert-vs-not; `stopyear_harness.js` asks when to STOP, and a
later stop converts more in total, so a cutoff sweep confounds timing with amount. Neither can
answer it.

Holds the lifetime **gross** conversion fixed and varies only its shape - FRONT (first k years),
LEVEL (every year), BACK (last k years) - across the standing 5-mix x 3-spend-rate ladder, 2 states,
2 Cash Reserve settings and 2 families, at 2 program sizes and 3 block widths. Every arm is pinned
to `forceWithdrawTiming: 'late'`, because P28ja measured the withdrawal-timing leg as larger than
the conversion leg in 29 of 54 cells and an unpinned run measures P28j's defect instead.

This is **not** P28j. P28j is the intra-year withdrawal month; its `Early(Conv)` / `Late(Spend)`
column names invite exactly this confusion.

Headline findings:

**Re-baselined 2026-08-30 (THIRD run), after `P88a-e` charged IRMAA on conversions and `P92a`
corrected the bracket ceiling. The headline changed direction; the numbers below are the third run.**

1. **Earlier wins head-to-head, but is no longer the best of three.** FRONT ahead of BACK in 284 of
   474 clean comparisons (60%); FRONT the outright winner in only **233**, against LEVEL 125 and
   BACK 116 - so the two non-front shapes take 51% of cells between them.
2. **The RMD claim is NOT universal, and inside the bracket family it is now exceptionless the other
   way.** FRONT has lower lifetime RMDs in 356 of 474, with **118 counterexamples - every one the
   bracket family at a live IRA Goal, and now every one of that family's 118 cells.** Front-loading eats
   the above-goal headroom early, `curIRA` throttles the strategy's own withdrawals for the rest of
   the plan, and the bigger surviving IRA throws bigger RMDs. Conversions ignore the goal
   (`_availIRA`, not `curIRA`); withdrawals respect it.
3. **Compounding is what pays.** Zero out growth and the advantage collapses to 4.2% of itself
   (paired on 72: $449,889 -> $18,832). N3, which holds terminal pre-tax IRA equal, has signal
   (17 of 60 usable) and FRONT still leads - so the advantage survives with the RMD stock held flat.
   The IRMAA channel, by contrast, CLOSED: its median was -1 year and is 0 now that a conversion is
   billed for it, so one of the three mechanisms this study credited was an artifact.
4. **At an 8% spend rate the sign flips**, and in 750 of 1,440 comparisons an aggressive front-loaded
   schedule is not even deliverable - the IRA does not hold it. Both are real constraints on the
   phase P5 per-year conversion schedule.
5. **The conversion tax rate is not the lever**: off an identical gross, the net landing in Roth is
   a coin flip (median -$464).

Requires the research-only `_cfSuppressConversionsBeforeYear` flag added to
`_convSuppressedThisYear` for the bracket family's start-year arm. Unset it is a no-op.

## rmdbasis_harness.js  (node)

```bash
node .test_harnesses/rmdbasis_harness.js
```

**Full results in [`RMD_BASIS.md`](RMD_BASIS.md).**

The characterization behind `P84l`, written to be run BEFORE the fix and again after. 26 CFR
1.401(a)(9)-5 sets the year's required distribution from the prior December 31 balance; the engine
struck it off that balance plus this year's pre-withdrawal growth, which overstated every RMD and
coupled it to `preMonths` - 1 or 11 depending on whether last year converted more than $1,000.

Before: **22 of 30 plans had a timing-dependent RMD**, median 6.21% and max 58.62%. After: **0 of
30**, agreeing to 7e-18.

It exists separately from the fix because of risk R12: `P84l` moves numbers in almost every suite, so
a genuinely broken assertion could be "fixed" by accepting whatever new value appeared. Recording the
predicted direction and size first makes each re-baseline a check rather than a shrug.

Its own `R2` prediction - that the RMD BASIS, the RMD divided by the prior year-end balance, is
independent of withdrawal timing - was written wrong twice - once as a lifetime total, which condemns a correct
fix, and once as a two-spouse blended ratio. Both are documented in the file header, because the
wrong versions are more instructive than the right one.

## bracketbasis_harness.js  (node)

```bash
node .test_harnesses/bracketbasis_harness.js
```

**Full results, tables and reasoning live in [`BRACKET_CEILING_BASIS.md`](BRACKET_CEILING_BASIS.md).**
This entry is the index; that file is the reference.

P87a. `computeBracketCeiling` returns three kinds of ceiling as one number and every caller spends
it as a MAGI ceiling. The IRMAA tiers really are MAGI thresholds; the federal bracket tops are
TAXABLE-income thresholds, so "fill the 22% bracket" stops one whole deduction short of filling it.

Runs the standing 5-mix ladder x 2 IRA-Goal settings x 2 states x 6 families x 2 spend rates = 240
cells on two arms, ~2 seconds. Half the harness is a census off the control arm's log alone (how
many years actually sat ON the ceiling); the other half is the A/B behind the research-only
`bracketCeilingAddDeduction`, default off and set by no UI.

Headline findings (2026-08-29):

1. **The defect is exactly one deduction, confirmed to the dollar.** A Fill Bracket 22% plan aims at
   $211,400, lands MAGI on $211,400 and federal taxable income on $179,200, against a $32,200
   deduction. The gap is the whole federal deduction, so it grows with indexation and the age-65
   bumps, $32,200 in 2026 to $70,876 by 2054. Neither operand is wrong: the bracket top is correct
   and the deduction reconciles to the cent, OBBBA senior deduction and its phase-out included. The
   defect is a units mismatch - a pre-deduction quantity capped at a post-deduction threshold.
2. **Correcting it COSTS money in 51 of 74 clean cells**, median -$47,092 - a finding about the
   STRATEGY, not a verdict on the fix. A named ceiling is a contract to fill, so the cost is a
   changelog disclosure rather than a reason to under-deliver the strategy the user selected. The
   report's section 7 records the earlier, wrong reading and why it was wrong.
3. **The sign is set by the bracket, not the plan.** Fill Bracket 12% gains (median +$159,278);
   22% loses (-$173,437) and 24% loses (-$14,583).
4. **The separator is OVER years and nothing else.** Cells that gain were already breaching the
   ceiling every year, so the ceiling was not governing them and lifting it re-times a forced draw
   into an ordinary one (lifetime tax -$53,590). Cells that lose had zero OVER years, and lifting a
   ceiling that genuinely governed just draws more, earlier, for $314 of tax.
5. **`Min Limit 24%` never sees the federal number at all** - 0 of 40 cells move. Its ceiling is
   `yr.IRMAALimit`, built from the bracket top containing the SPENDING GOAL, which sits below the
   federal ceiling the user picked. So the zero test covers four families, not the two it was
   written for, and the "24%" in that row's label is close to decorative.
6. **Nothing sizes a conversion against the ceiling, and that gap is bigger than the deduction
   one.** Total voluntary draw rose in only 18 of 74 cells and just 32% of the extra draw became
   conversion. `iRAbracketRoom` sizes a WITHDRAWAL; `convertExcessToRoth` reallocates leftover
   surplus capped by the IRA draw; `applyConversionGrossUp` never reads `yr.limit`. Tracked as P87g.
7. **A prediction scored on the wrong quantity.** B1's first form asked a per-year claim of a
   LIFETIME total and condemned a working arm in 70 of 120 cells. Same failure as `rmdbasis`'s R2.

## extraconv_magi_harness.js  (node)

```bash
node .test_harnesses/extraconv_magi_harness.js
```

**Full results, both columns and the scored predictions live in [`EXTRA_CONVERSION_MAGI.md`](EXTRA_CONVERSION_MAGI.md).** This entry is the index; that file is
the reference.

P88. Both additional-conversion paths - the typed Extra Annual Roth Conversion and the
cash-funded gross-up - run after the year's main tax pass and used to write back only
`federalTax` and `stateTax`. Every income-basis field kept its pre-conversion value, so the
year's MAGI omitted the conversion. That figure is pushed into the plan's MAGI history and is
what the IRMAA lookback charges two years later.

Run it on the pre-fix engine and again after; section 1 is self-diagnosing and says which build
it is looking at, and the pre-fix numbers are recorded IN the file so it scores the fix itself
rather than needing two pasted tables compared by hand.

Headline findings (2026-08-29):

1. **A whole tier, invisible.** One plan converting $100,000 a year recorded MAGI $211,400 and
   `-none-` / $0 of surcharge where $311,400 earns Tier 2 at $7,166 a year.
2. **Never a ceiling-strategy problem.** Lifetime IRMAA rose +69% (Fill Bracket 22%), +30%
   (IRMAA Tier 1), +69% (Proportional) and +132% (Ordered) at a $100,000 conversion. The two
   bracket-agnostic families were under-billed by as much or more than the two ceiling ones.
3. **The BEFORE column says something worse than "too low".** Lifetime IRMAA used to FALL as the
   conversion grew, $1.41M to $0.63M, because the shrinking IRA lowered later RMDs while the
   conversion's own cost was never charged. The tool presented a large conversion as a way to
   REDUCE the Medicare surcharge.
4. **The fix reaches the two conversion paths and nothing else.** Lifetime IRMAA at a $0
   conversion is identical on both builds to the dollar for all four families, year-0 income tax
   is unchanged at every conversion size, and a 20-cell fingerprint over plans using neither path
   matches exactly.
5. **A prediction written too strongly.** M1 first claimed MAGI was IDENTICAL across conversion
   sizes. True for the ceiling families, false for the agnostic ones, whose surplus-routing drift
   reaches -14.6% of a $25,000 conversion. The claim is that the gross is ABSENT, so the test has
   to be one-sided and stated against the gross.

## convopt_ceiling_harness.js  (node)

```bash
node .test_harnesses/convopt_ceiling_harness.js
```

**Full results live in [`CONVERSION_SEARCH_CEILINGS.md`](CONVERSION_SEARCH_CEILINGS.md).** This
entry is the index; that file is the reference.

P88f. A user proposed that the Optimizer stop offering conversion-optimized rows for strategies
that target a ceiling, since the conversion is stacked on top of a draw already sized to fill it.
The question was unanswerable until P88b, because the search was scoring those rows on numbers that
omitted the conversion's own IRMAA.

270 cells - 5 mixes x 3 heirs rates x 2 spend rates x 9 families - each running the production
search (`optimizeConversionAmount` on `baselineScore`). Section 0 checks the ceiling/agnostic split
against the engine's own `BracketTarget` rather than trusting the harness labels.

Headline findings (2026-08-29):

1. **The search does NOT exclude them by itself.** 61 of 180 ceiling cells pick a non-zero
   conversion, so those rows reach the table. A $0 pick is dropped by production code, so this was
   the first thing worth measuring: if it had been zero everywhere, the phase closed with no change.
2. **Every one of them breaks its own ceiling - 61 of 61.** Several are over in EVERY year they
   have a ceiling, including a row labelled `Fill Bracket 12%` breaching 33 of 33 years.
3. **Excluding them is the expensive answer.** Median gain $53,990, largest $1,546,930, and not one
   of the 61 gains less than $1,000. There are no marginal rows to discard cheaply.
4. **The heirs rate is NOT the lever; the spend rate is** - spread 3 against 25. So a rule keyed on
   strategy family is the wrong shape regardless of which way the exclusion question is answered.
5. **Shipped answer: mark, do not drop.** A `⤴` in the Strategy column. It reads
   `-overageFromConv` specifically, so it never fires on a row that went over because spending could
   not be funded inside the ceiling.
6. **A prediction nearly scored on a bar it could not fail.** C5's first form asked only whether the
   heirs rate flips the answer at least once; it flips 3 of 60, which would have passed as a HOLDS.
   Scored against the competing axis instead, it fails.

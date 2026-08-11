# Test harnesses

Investigative / audit scripts for the retirement optimizer engine. These are **not** part of the
regular unit-test suite (`optimizer_core.tests.js`); they are kept here so a finding can be
re-derived on demand.

**What does not belong here:** anything the suite needs in order to pass. `sweep_golden.js` and its
two regenerators live at the repo root next to `optimizer_core.tests.js`, which `require`s the golden
at load time — they are fixtures, not studies. The rule and the reasoning are in
[`ARCHITECTURE.md`](../ARCHITECTURE.md#where-a-test-file-belongs).

| harness | runs in | what it answers |
|---|---|---|
| `betr_harness.js` | **node** | Is the Break-Even Tax Rate (BETR) signal trustworthy? |
| `stopyear_harness.js` | **browser console** | When should a plan stop Roth conversions? |
| `unifiedconv_harness.js` | **node** | Does modeling every voluntary IRA withdrawal as a Roth conversion change anything? |
| `brokerage_harness.js` | **node** | Why is Brokerage barely drawn, and is the third-pass exclusion to blame? |
| `phased_harness.js` | **node** | P36 round 1: which families rank where under every objective, and do any arms never win? |
| `oracle_harness.js` | **node** | P51: how far below the perfect-foresight ceiling does each family sit, and is it conversions or the split? |
| `endgame_harness.js` | **node** | P35n: once the IRA sits at its target, what should the tail draw from? |

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

## unifiedconv_harness.js  (node)

```bash
node .test_harnesses/unifiedconv_harness.js
```

**Full results, tables and reasoning live in [`P28_RESULTS.md`](P28_RESULTS.md).** This entry is the
index; that file is the reference.

Tests a proposed nerdknob (P28): model every **voluntary** (non-RMD) IRA withdrawal as a Roth
conversion, then spend out of Roth. Runs a 5-mix account ladder (shipped defaults -> balanced thirds
-> brokerage-heavy) x 3 spend rates (4/6/8% of total assets) x 6 strategy families x 7 arms = 630
simulations in about a second, and scores its own predictions so a wrong one is visible rather than
quietly dropped.

Three research inputs on the engine, **all default off, none set by any UI**:

| input | values | what it does |
|---|---|---|
| `unifiedConvRouting` | bool | the voluntary draw is CALLED a conversion; spending round-trips through Roth |
| `rothGapFill` | `'fillCashThenRoth'`, `'fillRothThenCash'` | where Roth sits in the gap fill. Unset = today (Roth last). `ordered` excluded from both |
| `forceWithdrawTiming` | `'early'`/`'late'` | pins the month-1 vs month-11 withdrawal rule, which conversions otherwise flip |

Headline findings:

1. **The reframe is inert.** 0 money fields move in 90 mix x rate x family cells. It is arithmetic:
   draw X, tax T, spend S -- today Roth gains X-T-S; routed, it gains X-T then returns S.
2. **`rothConv` is engine state, not a display field** -- `beginYear` reads `log[y-1].rothConv > 1000`
   to pick withdrawal timing. Reporting the reframe through it moved 780 money fields.
3. **The real lever is where Roth sits in the gap fill.** Roth pays when it displaces a *Brokerage*
   draw (avoids realizing gains) and loses when it displaces *Cash* (Roth compounds at growth
   tax-free; Cash earns cashYield and is taxed). Hence `fillCashThenRoth`, which wins or ties **53 of 60**
   cells with a worst case of -$12,466, against `fillRothThenCash`'s -$244,689. Worth up to **+$3,559,596**.
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

**Full results, tables and reasoning live in [`PHASED_RESULTS.md`](PHASED_RESULTS.md).**

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
```

**Full results live in [`ORACLE_RESULTS.md`](ORACLE_RESULTS.md).** P51: perfect-foresight
trajectory oracle — per-year `extraConversionAmount[]` + per-year `oracleWithdrawalPlan`
splits, coordinate descent, spend pinned, backstops instrumented. An upper-bound DIAGNOSTIC
for one deterministic path, never a policy. Headlines (2026-08-10): flat scalar conversions
find $0 in 15/15 cells while per-year timing finds up to +$1.08M; "Proportional is
default-optimal" refuted on the absolute half (gap-to-oracle 2.3-11.6%); cyclic rows BEAT the
oracle in one cell because surplus ROUTING is outside the menu — cyclic's real residual edge.

## endgame_harness.js  (node)

```bash
node .test_harnesses/endgame_harness.js
```

**Full results live in [`ENDGAME_RESULTS.md`](ENDGAME_RESULTS.md).** P35n: scenarios start IN
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

**Q3/Q4 results live in [`P32_RESULTS.md`](P32_RESULTS.md).** P32's harness: q1 (how often is
Brokerage drawn -- premise refuted, re-run post-fix with three of four families UP), the
accounting audit that found the dividend double-credit (`e9a3c8b`), q2 (third-pass spiral --
waits on the P32c research flags), and as of 2026-08-10 q3/q4 over the Stage-1 45-cell grid:

1. **Cyclic wins 26/45 cells (58%) as shipped, 23/45 with the surplus-routing confound
   removed** (`CashReserve: 0` control). About half the headline delta was the non-cyclic arm
   parking surplus in Cash; the genuine harvest value still reaches ~$891k in a cell.
2. **`cycleLTCGTarget: 0.20` is a live knob pointing the wrong way**: moves 898 of 2,576 pairs,
   wins 53, worst losses -$380k -- harvesting into the 15% bracket pays tax the terminal §1014
   step-up would have erased. Default 0.15 confirmed.
3. **Harvest years leave real money on the table** (descriptive): ~$111,700 of forgone IRA draw
   per harvest year; median row forgoes 57% of its lifetime voluntary IRA draws. Stage 2's q6()
   (`cycleCoexist`) measures the causal value of reclaiming it.

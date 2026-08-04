# Test harnesses

Investigative / audit scripts for the retirement optimizer engine. These are **not** part of the
regular unit-test suite (`optimizer_core.test.js`); they are kept here so a finding can be
re-derived on demand.

**What does not belong here:** anything the suite needs in order to pass. `sweep_golden.js` and its
two regenerators live at the repo root next to `optimizer_core.test.js`, which `require`s the golden
at load time — they are fixtures, not studies. The rule and the reasoning are in
[`ARCHITECTURE.md`](../ARCHITECTURE.md#where-a-test-file-belongs).

| harness | runs in | what it answers |
|---|---|---|
| `betr_harness.js` | **node** | Is the Break-Even Tax Rate (BETR) signal trustworthy? |
| `stopyear_harness.js` | **browser console** | When should a plan stop Roth conversions? |
| `unifiedconv_harness.js` | **node** | Does modeling every voluntary IRA withdrawal as a Roth conversion change anything? |

## betr_harness.js  (node)

```bash
node .test_harnesses/betr_harness.js
```

Self-contained: stubs the DOM globals and `require()`s `taxengine.js` + `optimizer_core.js` the
same way `optimizer_core.test.js` does. Compares, for several legacy scenarios, the tool's shown
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

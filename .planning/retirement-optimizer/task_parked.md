# Parked phases

Moved out of `task_plan.md` on 2026-08-31 at the user's instruction, to stop carrying work nobody
is doing. **Nothing here was deleted and nothing here was judged wrong** - every one of these had a
status of `pending`, `not started`, `deferred` or `unprioritized`, and none is named as a blocker by
a live O0 or O1 phase. Sections are verbatim, in the order they appeared.

**To revive one:** move its `##` section back into `task_plan.md` and give it a row in the NOW
table. The IDs are unchanged, so every cross-reference elsewhere still resolves by name.

| ID | phase |
|---|---|
| `P85` | P85: when conversions happen — earlier wins, but not for the reason it looks like  *(DONE 2026-08-28, user-raised)* |
| `P4` | P4: Creeping Tax Rate Model (was Phase 29) |
| `P5` | P5: Per-Year Conversion Schedule - Greedy Forward Search (was Phase 23b, "greedy DP") |
| `P6` | P6: Simulation Sanity-Check Tests (was Phase 25) |
| `P8` | P8: Annual-Table View Presets (was 38#6) |
| `P9` | P9: ACA Refinement Remainder (partial, was Phase 9) |
| `P10` | P10: Upgrade Equity Data — S&P 500 → Fama-French Total Market (was Phase 17) |
| `P11` | P11: RealReturns — Intl Asset + Annual Returns Mode (was Phases 34 + 35) |
| `P12` | P12: Retire Optimizer Tab → MC Strategy Comparison (was Phase 26) |
| `P13` | P13: Multi-Strategy Segment Optimizer (was Phase 10) |
| `P14` | P14: Regime-Switching MC (BootstrapPlan Phase 3) |
| `P16` | P16: Responsive Layout — All Tools (was Phase 16) |
| `P17` | P17: Retirement_Projection — Simple Mode (was Phase 14) |
| `P18` | P18: Retirement_Projection → RetirementTaxPlanner Link (was Phase 15) |
| `P22` | P22: Export Annual Details to CSV |
| `P27` | P27: Assumption Sensitivity, a tornado over the guesses (scoped 2026-07-30) |
| `P29` | P29: Hebeler Autopilot — is a second dynamic-spend rule worth a strategy slot? |
| `P31` | P31: Asset mix is an OUTPUT — the reverse mapping, asked honestly |
| `P33` | P33: Insights panel — where the money came from |
| `P68` | P68 — changelog brevity pass over the recent entries |
| `P42` | P42: Lumpy Spending, no URL encoding  *(was PB; supersedes the old P3 spec)* |
| `P43` | P43: Auto-Persist + Restore Offer  *(was PC)* |
| `P44` | P44: Onboarding Interview  *(was PD; supersedes the old P7 stepper concept)* |
| `P45` | P45: Insights / Feedback Panel  *(was PE)* |
| `P50` | P50: Suggested-spend menu (3 strategy-independent goals)  *(CORE COMMITTED but DORMANT, UI DEFERRED — 2026-08-09)* |
| `P51` | P51: Perfect-foresight trajectory oracle (research, node-only)  *(NEW 2026-08-10, user-approved, O1)* |
| `P63` | P63: state safe harbor, generically  *(RESEARCHED 2026-08-18, DEFERRED, but it exposed two live bugs)* |
| `P65` | P65: the rest of Schedule A - medical is the only piece likely to qualify  *(NEW 2026-08-19, user-raised, NOT scoped)* |
| `P55` | P55: MCP server — let an AI run the engine over a customer's scenario  *(NEW 2026-08-16, priority unset)* |

---

## P85: when conversions happen — earlier wins, but not for the reason it looks like  *(DONE 2026-08-28, user-raised)*

**Why it exists.** The user asked whether converting earlier beats converting later, reasoning that
(a) the dollars compound tax-free for longer and (b) a smaller IRA grows less, so lifetime RMDs and
their consequences shrink. **Nothing in this repo had tested either half.** `betr_harness.js` asks
convert-vs-not; `stopyear_harness.js` / `bestConversionStopYear()` ask when to STOP, and a later
stop converts MORE in total, so a cutoff sweep confounds timing with amount and cannot answer it.
`RMD` appeared 1-2 times across all twelve existing `research/*.md` reports.

**The question arrived attached to P28j and is NOT P28j.** P28j is the intra-year withdrawal MONTH
(`preMonths` 1 vs 11, `optimizer_core.js:1275-1285`); its `Early(Conv)` / `Late(Spend)` column names
invite exactly this confusion. Orthogonal axes. Worth remembering the next time the two get merged.

**SUPERSEDED IN PART, same day, at the user's prompting.** The run below was measured on the
pre-`P84l` RMD basis and at `iraBaseGoal: 0`. Both were wrong and both mattered. **Re-run headline:
earlier still wins (353 of 499), but the RMD claim is BROKEN - 375 of 499 with 124 counterexamples,
every one of them the bracket family at a live IRA Goal.** Front-loading eats the above-goal
headroom early, `curIRA` (`optimizer_core.js:1584`, gating `:1914`) throttles the strategy's own
withdrawals for the rest of the plan, and the bigger surviving IRA throws bigger RMDs. Measured on
one cell at equal $210,000 gross: FRONT draws $204,656 LESS voluntarily, ends with $218,861 MORE
IRA and takes $229,381 MORE in RMDs than BACK.

**Two things the first run got wrong for the same reason - it inherited a fixture without asking
what was in it.** `iraBaseGoal: 0` came from `gapfill_harness.js`'s COMMON; the shipped page default
is **$750,000** and the page also offers a computed suggestion (`computeSuggestedIraGoal`,
`optimizer_ui.js:665`). At goal 0 the bracket family drains the IRA to nothing and takes **$0 of
lifetime RMDs** - so the first run asked what conversions do to RMDs of plans that have none. It is
also the entire explanation for N3's "flat at zero" failure in 48 of 60 arms; with the goal live,
N3 has signal (18 of 60 usable) and FRONT keeps its lead, which is the decomposition the first run
could not produce.

**Found on the way, and undecided: conversions ignore the IRA Goal.** `applyExtraConversion` caps at
`_availIRA` (`:2694`), never at `curIRA`, so a conversion can drive the IRA below a floor that
voluntary withdrawals may not cross. Either the goal floors the IRA or it does not; today it floors
withdrawals only.

**Original answer, kept because the parts that survived are the useful ones: earlier wins about two
thirds of the time, and the RMD channel is not what pays.**

- FRONT ahead of BACK on after-tax net worth in **125 of 186** clean comparisons; outright winner
  in 109, LEVEL 39, BACK 38. **The extreme is not uniformly best** - relevant to `P5`, which should
  not be seeded with "convert the maximum now".
- **Lifetime RMDs lower under FRONT in 186 of 186**, median gap $548,035, no counterexample.
- **Zero the growth and 96% of the advantage disappears** (paired on 24: $454,700 -> $18,349). The
  RMD gap is the compounding effect seen from the other side, not an independent payoff. A small
  residual survives - FRONT still ahead in 24 of 24 at zero growth - and is pure tax timing.
- **At an 8% spend rate the sign FLIPS** (median -$8,954): the liquidity cost of the early tax bill
  beats the compounding gain. CA's advantage is 9x smaller than TX's.
- **The conversion tax rate is not the lever**: off an identical gross, the net landing in Roth is a
  coin flip (median -$360). "Convert while the bracket is empty" is not what is paying here.
- **522 of 720 comparisons were UNDELIVERED** - the IRA does not hold an aggressive front-loaded
  program. That is a real constraint on front-loading, not a harness limitation.

**Engine change, the only one: `_cfSuppressConversionsBeforeYear`** in `_convSuppressedThisYear`
(`optimizer_core.js`), the mirror of the existing `_cfSuppressConversionsFromYear`. Research-only,
no UI / URL key / `getInputs()` entry. The engine could express "stop converting in year k" but not
"start in year k", so a delayed arm was inexpressible for the bracket and ACA families, whose
conversions come out of the surplus branch rather than `extraConversionAmount`. Unset it is a no-op;
suites unchanged at 340 / 61 / 22.

**Could not be measured, and said so rather than fudged:**
- **N2 (equal lifetime tax): 2 of 30 usable.** Not a bisection failure - **lifetime tax is not
  monotone in the conversion amount and usually FALLS as conversions rise** ($796,324 -> $572,130 ->
  $427,589 at requests of $0 / $420k / $1.68M). An arm that converts nothing carries a bigger IRA
  into RMD age and pays more tax overall.
- **N3 (equal terminal IRA): 6 of 30, split 2/2/2, no signal.** 48 of 60 arms were flat-at-zero -
  the IRA ends empty whether or not you convert, so the target is already equal. **The intended
  decomposition was carried by the zero-growth arm instead, which is a weaker construction.**
  A version that holds the lifetime RMD STREAM equal, not the terminal balance, would answer it
  directly. Open.
- **C4 UNTESTED, not BROKEN** - N2 gave 2 usable cells, and a direction read off 2 cells is not a
  direction.

**FOUR scorer defects, all caught before publication** - the fourth session running where the scorer,
not the measurement, is where the bugs were. Full accounting in `CONVERSION_TIMING.md` section 7.
The two worth carrying forward:
1. **The timing-pin assertion was VACUOUS.** It read `r.useEarly`, which does not exist on a log row
   (the row carries `timing` as a rendered string, `optimizer_core.js:1168`). It was `false`
   everywhere, so it would have reported "pin HELD" whatever the engine did. Caught only because
   self-check F also requires the UNPINNED run to differ. Same species as P30f.
2. **C3 compared two different samples** - median of 29 cells against median of 4. Pairing it moved
   the headline from "17.6% survives" to "4.0% survives", a factor of four, on identical data.

**Files:** `.test_harnesses/convtiming_harness.js` (new), `CONVERSION_TIMING.md` (new),
`HARNESSES.md` (registered), `optimizer_core.js` (one research flag). No version bump, no changelog -
nothing here is user-visible.

**Follow-ups, not scheduled:**
- [ ] **P85a** - hold the lifetime RMD STREAM equal rather than the terminal balance, and settle the
      decomposition N3 could not.
- [ ] **P85b** - the zero-growth residual: FRONT ahead in 24 of 24 with no compounding at all. Which
      tax mechanism? Same open shape as P28ja's Q5.
- [ ] **P85c** - feed the 8% reversal and the delivery cap into `P5`'s objective before the greedy
      search is built.

## P4: Creeping Tax Rate Model (was Phase 29)
**Why:** Tool assumes today's brackets persist forever. Future rate increases plausible. TCJA is now permanent but Congress can change rates. Default: off.

**Two options were scoped; only Option A shipped:**

**A. Rate Escalation — IMPLEMENTED, not yet found by user because it's nerdknob-gated.** Discovered 2026-07-26 via code grep (`Creep`) after the user flagged "implemented but not exposed." Built as `taxRateCreep` (% per year, federal) + `taxCreepStartYear` (calendar year, blank = plan's first year). Engine: `taxCreepFactor(rate, currentYear, startYear)` returns `(1+rate)^max(0,year-startYear)`; multiplies federal AND state bracket rates via `fedRateCreep`/`stateRateCreep` params threaded through `calculateTaxes()`/`computeBracketCeiling()`. **State creep is plumbed end-to-end in the engine but pinned at `taxRateCreepState: 0` in `getInputs()` (`optimizer_ui.js:249`) — no UI control exists for it yet**, per an explicit comment at line 245-246 ("Federal is the only knob today"). UI: "Fed Tax Creep" / "Creep Starts" row (`retirement_optimizer.html:378-380`, `#taxRateCreep-wrap`), hidden by default — `applyNerdKnobVisibility()` (`optimizer_ui.js:90-96`) shows it only when `NERD_KNOBS` is on OR a nonzero creep value is already loaded (leak-guard, same pattern as the conversion Stop-Year feature — a shared URL/scenario with creep set must never hide the control that explains it). Short URL keys `trc`/`tcy` wired (`optimizer_core.js:759-760`, `optimizer_ui.js:3235`). Sweep pass-through confirmed (`buildVariations` carries the fields). Logged per-year as `-fedRateCreep`/`-stateRateCreep` (log record).
- [x] **P4a** — Inputs: `taxRateCreep`, `taxCreepStartYear` (federal). `taxRateCreepState` exists in the engine, no UI input yet.
- [x] **P4b** — `calculateTaxes()`/`computeBracketCeiling()`: apply rate multiplier per year
- [x] **P4c** — Test: creep=0 → bit-identical to current (regression) — `optimizer_core.test.js:1652-1656`
- [x] **P4d** — Test: escalation compounding, before/after start year, fed-only vs state-only isolation, sweep pass-through, path-independence — `optimizer_core.test.js:1642-1754` (11 assertions total)
- [ ] **P4e** — Annual Details `taxRateMult`-style column (Debug/Tax Policy category) — not added; only the hidden `-fedRateCreep`/`-stateRateCreep` log fields exist, no visible column
- [ ] **P4f** — State-rate creep UI control (input + tooltip + short-key)
- **B. Pre-TCJA Cliff — NOT implemented.** No `BRACKETS_PRE_TCJA` constant, no `taxRateChangeYear`, no bracket-swap logic anywhere in the codebase (grepped clean). Original spec's second option, never started.
- **Status:** Option A done and NOW UN-GATED (2026-07-29, v11.13bd — see the nerdknob-graduation phase at the top of this file). The row is plain markup with no `display:none` and `applyNerdKnobVisibility()` no longer touches it. The two open sub-items above (Annual Details creep column, state-creep UI control) are still open and did NOT block un-gating: the federal control is finished and tested on its own. Option B untouched.
- **Independent:** modifies `calculateTaxes()` which is already isolated

---

## P5: Per-Year Conversion Schedule - Greedy Forward Search (was Phase 23b, "greedy DP")
**Why:** Phase 23 implemented `optimizeConversionAmount()` as a scalar sweep: ONE conversion amount,
reused every year. A plan wants a different amount each year - larger in the low-income years before
Social Security and RMDs start, tapering toward $0 once the brackets fill on their own. This phase
searches for that per-year schedule.

### What "greedy DP" means here, and why the name is half wrong

The phrase was carried over from the Phase 23 notes. Only the first word is accurate. Keep the
distinction in mind before anyone sets out to "finish the DP".

**Greedy** - the search fixes year t's conversion before it looks at year t+1, and never revisits
it. Each year is chosen by whatever scores best given the state it inherits, with no lookahead. That
is what makes the run affordable: `years x sweep steps` engine evaluations, roughly 30 x 200,
instead of the `steps ^ years` a true joint optimum would cost.

**DP (dynamic programming)** - is what this is NOT. Real DP would need a state variable (IRA
balance, brokerage basis, filing status, year), a value function over that state, and backward
induction from the terminal year, so that year t's choice is scored against the best achievable
future rather than against the next single step. Nothing here does that: no memo table, no backward
pass, no state discretization.

**Consequence, and it is the thing to test for:** a greedy schedule can be beaten. Filling to the
top of the 22% bracket this year can be locally optimal and still leave too much in the IRA for the
survivor's single-filer years, which a lookahead would have priced in. So `P5f` is not a formality -
the schedule must be scored against the scalar optimizer, and a LOWER score is a real result about
the method, not a bug in the harness.

If greedy proves materially short, the next step is a limited lookahead - score year t by simulating
k years forward, k = 2 or 3 - not full DP. Backward induction over a continuous IRA balance needs
state discretization and is a much bigger piece of work than this phase is scoped for.

**UNBLOCKED — verified 2026-07-30, and it does not depend on P28.** The per-year lever already
exists: `_extraConvAmountFor` (`optimizer_core.js:1677`) reads `inputs.extraConversionAmount[y]`
whenever the input is an array, so a per-year schedule is expressible against today's engine with no
representation change. An earlier claim in the P28 discussion that the "unified conversion" reframe
was the precondition for a 1-D per-year search was wrong; the 1-D search is already available.

**Core algorithm (greedy forward pass):**
For each year t from retirement to max(RMD ages), in order:
1. Sweep `extraConversionAmount` from $0 to totalIRA in $10k steps
2. Lock in optimal C_t; advance year t+1 with updated state
3. Result: `convSchedule[y]` array

**Output:** Annual Details `convSchedule` column + optimizer table "Conv $/yr" column.

**MC Stage 2 (stretch):** Top-K strategies with their locked schedules → 500 MC paths each → add MC Survival column to optimizer.

- [ ] **P5a** — Implement `buildConversionSchedule(baseInputs, overrides)` — greedy forward pass, one year at a time, no lookahead
- [ ] **P5b** — `buildVariations()`: when `includeConvOpt` set, use schedule (not scalar) for optimized rows
- [ ] **P5c** — Optimizer table: "Conv $/yr" column (avg), "Conv Savings $" column
- [ ] **P5d** — Annual Details: `convSched` column (Opp. Cost category)
- [ ] **P5e** — Test: the schedule tapers toward $0 near RMD onset (sanity check)
- [ ] **P5f** — Test: schedule rows vs scalar optimizer on the same inputs — record the measured gap in either direction; greedy is not guaranteed to win
- **Status:** pending
- **Depends on:** Phase 23 ✓ (scaffold in place)

---

## P6: Simulation Sanity-Check Tests (was Phase 25)
**Why:** Complex simulation accumulates subtle math errors. Deterministic edge cases with known exact answers expose regressions.

Tests go in `optimizer_core.test.js` (renamed from `retirement_optimizer_core.test.js` in `d0f4a00`). Helper: `makeZeroBaseInputs()` — zeroed growth/inflation/taxes, single account.

| Test | Setup | Expected |
|------|-------|----------|
| Linear depletion | growth=0, inflation=0, Roth-only $1M, spend $50k | Depletes year 20; netSpend%=5% each year |
| SS covers all spend | SS=$60k, spend=$50k, zero portfolio | Portfolio unchanged; wdRate≤0 |
| Roth conv identity | extraConvAmount=$X, growth=0, inflation=0 | `rothConv` sums to X×years; IRA reduced by gross conv |
| RMD accuracy | IRA=$1M at age 73, zero growth | First RMD = $1M ÷ 26.5 ± $1 |
| Surplus reinvestment | income > spendGoal | surplusCash > 0; total wealth increases |

- [ ] **P6a** — Add `makeZeroBaseInputs()` helper
- [ ] **P6b** — Implement 5 sanity tests listed above
- [ ] **P6c** — Run full node test suite; target zero failures
- **Status:** pending
- **Independent:** uses existing `simulate()` interface

---

## P8: Annual-Table View Presets (was 38#6)
**Why:** Current checkbox method for showing/hiding Annual Details columns is cumbersome. User wants navigable presets.

**Decision from Phase 38:** Keep checkbox method for now; redesign to be more navigable. No concrete design yet.

- [ ] **P8a** — Design preset groups (e.g., "Tax View", "Income View", "Conversion View") as button tabs above the column checkboxes
- [ ] **P8b** — Each preset activates its checkbox group; user can then fine-tune
- [ ] **P8c** — Persist selected preset to URL hash
- **Status:** pending (design phase — implement after P1–P6 ship)

---

## P9: ACA Refinement Remainder (partial, was Phase 9)
**Why:** Age-gate UI done (v?). Optimizer/MC gating + MAGI/subsidy calculation not yet done.

**What's done:** `updateACAWarning()` — disables ACA options + shows `#aca-age-warn` when both ≥65.

**What's pending:**
- [ ] **P9a** — Optimizer: skip ACA strategy rows when both persons ≥65 at retirement start
- [ ] **P9b** — MC: pass age-gate flag through; don't evaluate ACA strategy past Medicare age
- [ ] **P9c** — ACA MAGI calculation: estimate silver-plan premium, subsidy cliff, net premium; show in Annual Details
- [ ] **P9d** — Annual Details: `acaSubsidy`, `acaPremium` columns when ACA strategy active
- [ ] **P9e** — Test: both ≥65 → ACA rows absent from optimizer table
- [ ] **P9f** — Test: mixed ages → ACA rows present only for pre-65 segment
- **Status:** partial
- **Depends on:** Phase 1 ✓
- **Blocks:** Phase P13 (multi-strategy segment optimizer needs clean ACA handling)

---

## P10: Upgrade Equity Data — S&P 500 → Fama-French Total Market (was Phase 17)
**Why:** Current `equity` array = Damodaran S&P 500 proxy (large-cap only). Fama-French Market Portfolio (`Mkt-RF + RF`) covers all NYSE/AMEX/NASDAQ stocks 1926–present. Small-cap premium historically ~1–2%/yr higher.

**Decision:** Add as selectable toggle — keep both, let user compare. Default: S&P 500 (preserve existing behavior).

- [ ] **P10a** — Download `F-F_Research_Data_Factors_annual.CSV` from Ken French's data library (1926–2024)
- [ ] **P10b** — Compute annual total return = `(1 + Mkt-RF/100) × (1 + RF/100) − 1` for each year
- [ ] **P10c** — Add `equityFF` array to `historical_returns.js` alongside existing `equity`
- [ ] **P10d** — Add equity-source toggle in nerd panel: "S&P 500 (Damodaran)" | "Total Market (Fama-French)"
- [ ] **P10e** — Worker/prng: use `HISTORICAL_RETURNS.equityFF` when FF mode selected
- [ ] **P10f** — MC metrics panel: label equity series by source name
- [ ] **P10g** — Update tests: both modes produce plausible CAGR ranges (FF slightly higher)
- **Status:** pending
- **Depends on:** Phase 7 ✓; Phase 18 ✓ (fan chart makes comparison useful)

---

## P11: RealReturns — Intl Asset + Annual Returns Mode (was Phases 34 + 35)

### Part A: International Equity Asset (was Phase 34)
`HISTORICAL_RETURNS.intl` (MSCI EAFE, 1970–2024) already in codebase but not wired into `RealReturns.html`. Add as 5th selectable asset.
- [ ] **P11a** — Add 2025 intl data point to `historical_returns.js`
- [ ] **P11b** — Wire `intl` into `RealReturns.html`: `computeSeries()`, stat cards, legend, custom mix allocation, URL (`iso=4`)
- [ ] **P11c** — Cap start-year slider at 1970 when intl visible (or render null for pre-1970)
- TIPS and BND deferred — require external data sourcing, short history.

### Part B: Annual Real Returns Mode (was Phase 35)
`annualData[]` already stores per-year real returns. Toggle: Cumulative | Annual. Annual mode switches to bar chart showing real-return % per year.
- [ ] **P11d** — Add `viewMode` state (`'cumulative'` | `'annual'`); `md=ann` URL param
- [ ] **P11e** — Add Mode toggle button group alongside Log/Linear
- [ ] **P11f** — `switchMode()`: rebuild chart datasets and y-axis (% linear for annual, $k log for cumulative)
- [ ] **P11g** — Annual mode: bars colored green (positive) / red (negative)
- [ ] **P11h** — Stat cards unchanged in both modes
- **Status:** pending (both parts)

---

## P12: Retire Optimizer Tab → MC Strategy Comparison (was Phase 26)
**Why:** Deterministic optimizer crowns a winner that may be fragile. MC gives the honest answer: survival %, median/p10 outcomes. Goal: replace optimizer with MC strategy sweep.

**Proposed approach:**
1. Add "Compare strategies" mode to MC tab: runs top 5–6 strategies through full MC (same 500 paths)
2. Comparison table: strategy | survival % | median final wealth | p10 wealth | median lifetime tax
3. Gate existing optimizer behind `?optimizer=1` URL param
4. After MC comparison ships and validated, remove optimizer code

**What to keep from optimizer:** `getOptimizerColumns()` + `buildVariations()` feed the MC sweep. `optimizeConversionAmount()` hooks into MC mode. Infeasibility detection → inline strategy selector warnings.

- [ ] **P12a** — Design MC comparison table: which strategies, how to surface winner
- [ ] **P12b** — Add "Compare in MC" mode to `mc_tab.js` running top-N strategies
- [ ] **P12c** — Move bracket feedback to main strategy selector
- [ ] **P12d** — Gate optimizer tab behind `?optimizer=1`
- [ ] **P12e** — Update docs: remove optimizer section, explain MC comparison
- [ ] **P12f** — Test: MC comparison ranks strategies consistently with intuition
- **Status:** pending — pre-design
- **Note:** Deprioritizes Phase 5 (Scenario Comparison) and Phase 8 (Sensitivity Grid) — likely superseded by this.

---

## P13: Multi-Strategy Segment Optimizer (was Phase 10)
**Why:** Optimal plan may switch strategies mid-retirement. Natural breakpoints: retirement start, age 65 (Medicare), age 73 (RMDs).

**Architecture:**
- 3 segments × ~42 strategies → ~74k combos max; filter invalid → ~10k realistic
- Add timing dimension (4 options per segment): 4 × 10k = ~40k Stage 1 evals
- Stage 1: deterministic sweep → pick top-K (10)
- Stage 2: full MC (500 paths) on top-K only

- [ ] **P13a** — Modify `simulate()` to accept `strategySequence[]` (strategy per segment)
- [ ] **P13b** — Define natural breakpoints from user inputs
- [ ] **P13c** — Filter invalid strategy-segment combos (P9 age-gating feeds here)
- [ ] **P13d** — Stage 1 Cartesian sweep; score each combo
- [ ] **P13e** — Stage 2 MC on top-K; rank by median / p10 survival
- [ ] **P13f** — Surface top-N composite strategies with "Phases" column
- [ ] **P13g** — Test: ACA strategy never in post-65 segments
- [ ] **P13h** — Test: top combo beats any single-strategy result
- **Status:** pending
- **Depends on:** Phase P9 (ACA age-gating)

---

## P14: Regime-Switching MC (BootstrapPlan Phase 3)
**Why:** Markets trend (bull/bear persistence). Regime-switching captures this without requiring historical data.

2-state Markov model:
- Bull: μ=+14%, σ=11%
- Bear: μ=−8%, σ=22%
- Transition probabilities calibrated to historical bull/bear run lengths

- [ ] **P14a** — Implement 2-state Markov model in `montecarlo/prng.js`
- [ ] **P14b** — Add as third simulation mode option in nerd panel (alongside GBM and Bootstrap)
- [ ] **P14c** — Test: regime persistence produces realistic multi-year trends (no single-year reversals every year)
- **Status:** pending
- **Depends on:** Phase 2 ✓ (bootstrap framework)

---

## P16: Responsive Layout — All Tools (was Phase 16)
**Why:** Fixed-px sidebars and poor space utilization. Systemic across all 7 tools.

**Tools in scope:**
- `retirement_optimizer.html` — fix table overflow, add responsive behavior
- `Retirement_Projection.html` — fluid sidebar (clamp), add breakpoints (was Phase 13)
- `IncomeTaxPlanner.html` — fluid sidebar, breakpoints
- `RetirementTaxPlanner.html` — fluid 400px→clamp, mobile breakpoints
- `AfterTaxRealGrowth.html` — expand max-width cap
- `FutureCost.html` — expand max-width cap
- `irmaa_and_rmds.html` — audit + fix

**Pattern:** Replace fixed-px sidebar with `clamp(220px, 25vw, 320px)`. Breakpoints: ≤480px / ≤768px / ≤1024px. At ≤768px: sidebars collapse below content. Touch targets ≥44px.

- [ ] **P16a** — Audit each tool at 375px / 768px / 1440px
- [ ] **P16b** — Apply fluid sidebar + breakpoints per tool
- [ ] **P16c** — Tables: `width: fit-content; max-width: 100%` + `overflow-x: auto` wrapper
- [ ] **P16d** — Re-test all tools at 3 breakpoints after changes
- **Status:** pending
- **Note:** Phase 13 (Retirement_Projection responsive) is a subset — execute together.

---

## P17: Retirement_Projection — Simple Mode (was Phase 14)
**Why:** Tool has too many controls for basic use-case. `IRA_Projection` was removed; need lightweight replacement.

**Simple mode:** Single account (IRA/Roth/Brokerage), balance + growth + years + withdrawal → chart. "Simple / Advanced" toggle in header (persisted to URL hash).

- [ ] **P17a** — Add "Simple / Advanced" toggle
- [ ] **P17b** — Simple mode hides: SS section, second spouse, IRMAA details, brokerage tax details, threshold editor, most metrics
- [ ] **P17c** — Simple mode shows: account balance, growth rate, withdrawal, projection chart, 3 key metrics
- [ ] **P17d** — Test: Simple mode same numbers as Advanced with equivalent single-account inputs
- **Status:** pending

---

## P18: Retirement_Projection → RetirementTaxPlanner Link (was Phase 15)
**Why:** User wants to click a year row and open RetirementTaxPlanner pre-populated with that year's values.

- [ ] **P18a** — Identify RetirementTaxPlanner.html URL params (AGI, filing status, SS income, age)
- [ ] **P18b** — Add clickable year column to projection table (or row click handler)
- [ ] **P18c** — On click: build URL with year's key values → open in new tab
- [ ] **P18d** — Add row hover affordance (link cursor + subtle highlight)
- [ ] **P18e** — Test: clicking year opens RetirementTaxPlanner with correct pre-filled values
- **Status:** pending
- **Depends on:** understanding RetirementTaxPlanner.html's existing URL param schema

---

## P22: Export Annual Details to CSV
**Why:** No CSV/XLSX export exists anywhere in the app today. The only export precedent, `exportScenario()`/`exportAllScenarios()` (core.js:5324-5433), exports saved-scenario *input* params as JSON — not the simulation log table. Users want to get the Annual Details table (including P21's new Account Spend columns) into Excel/Sheets for their own analysis.

**Design decision:** CSV-only for v1, using the existing zero-dependency Blob+`<a download>` idiom already established by `exportScenario()` — no SheetJS/xlsx library added. XLSX is an explicit future stretch item, not blocking, since it would be the first external client-side dependency in the app. Build the export from `lastSimulationLog` (raw numbers, populated at core.js:2082) rather than scraping the rendered DOM, but filter columns through the *same* `isColumnVisible()` + `analyzeColumnContent()` logic `updateTable()` already uses (core.js:3306-3335, 3507-3533, 3572-3573) — export matches what's on screen.

**Code pattern:**
```javascript
// core.js, near exportScenario()/exportAllScenarios() (5324-5433)
function exportAnnualDetailsCSV() {
    const log = lastSimulationLog;
    if (!log || log.length === 0) {
        showMessage('No data to export. Run a simulation first.', 'warning');
        return;
    }
    const columnContentStatus = analyzeColumnContent(log);            // core.js:3306
    const showEmpty = document.getElementById('show-empty-columns')?.checked ?? false;

    // Mirrors updateTable()'s header filter exactly (core.js:3507-3508, 3572-3573)
    const keys = Object.keys(log[0]).filter(k => !k.startsWith('-') && k !== 'inflationFactor');
    const visibleKeys = keys.filter(k => {
        const displayKey = k.endsWith('!') ? k.slice(0, -1) : k;
        return isColumnVisible(displayKey) && (columnContentStatus[k] || showEmpty);
    });

    const esc = v => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = visibleKeys.map(k => esc(k.endsWith('!') ? k.slice(0, -1) : k)).join(',');
    const rows = log.map(row => visibleKeys.map(k => esc(row[k])).join(','));
    const csv = [header, ...rows].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `annual-details-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showMessage('Annual Details exported as CSV.', 'success');
}
```

- [ ] **P22a** — Add `exportAnnualDetailsCSV()` to core.js near `exportScenario()`/`exportAllScenarios()` (5324-5433), using the pattern above
- [ ] **P22b** — Add an "Export CSV" button to the `.column-controls` div (retirement_optimizer.html:748-783), `onclick="exportAnnualDetailsCSV()"`
- [ ] **P22c** — Apply the same `row.inflationFactor` division the on-screen table currently uses for its nominal/real ("current dollars") toggle (`inCurrentDollars`, core.js:3609, 4390), so the CSV matches what the user is looking at
- [ ] **P22d** — CSV field escaping per RFC 4180 (quote fields containing comma/quote/newline, double internal quotes) — as shown above
- [ ] **P22e** — Date-stamped filename `annual-details-YYYY-MM-DD.csv`, consistent with `exportAllScenarios()`'s naming (core.js:5425)
- [ ] **P22f** — Note: Phase P21's new `'Spending'` category columns flow through automatically since this reads `isColumnVisible()` live — no special-casing needed regardless of ship order
- [ ] **P22g** — XLSX: explicitly out of scope for this phase; flag as a future stretch item requiring a SheetJS-class dependency — revisit only on user request
- **Test:** Run a simulation, toggle a couple of category checkboxes and the Show-Zero checkbox, click Export CSV, confirm the downloaded file's columns exactly match the currently-visible table columns and open cleanly in Excel/Sheets
- **Test:** With no simulation run yet (`lastSimulationLog` unset/empty), clicking Export CSV shows the warning message and does not throw
- **Status:** pending
- **Independent:** no phase dependencies; benefits from (but does not require) shipping after P21

---

## P27: Assumption Sensitivity, a tornado over the guesses (scoped 2026-07-30)

**Why:** every number this tool reports rests on three values the user typed into the sidebar and
cannot verify: `growth`, `inflation`, and how long they live. Nothing in the tool asks what happens
if those guesses are wrong. Monte Carlo randomizes returns *around* an assumed mean and the Stress
pass varies the historical *sequence*; neither varies the mean itself, and neither touches lifespan
or inflation at all (GBM inflation is a flat constant, `optimizer_core.js:921`). This phase reverses
the `Decisions Made` row that retired the old Variable Growth grid as "covered by Bootstrap MC" -
it was not covered, and the row has been rewritten to say so.

**Shape (settled with the user, 2026-07-30):** the CURRENT PLAN only, one axis at a time, rendered
as a tornado. Explicitly NOT the full winner-stability grid, and NOT a robustness column bolted onto
all 144 optimizer rows. Growth and inflation are INDEPENDENT axes: the real return is allowed to
move, because inflation does more in this engine than deflate (see below).

**Fixed plan:** the sidebar's own plan, captured the way `_runOptimizerNow()` captures `userPlan`
(`optimizer_ui.js:674`) - conversion switch, Extra Conversion and stop year all intact, none of the
three stripped the way swept rows strip them. Named with the existing `describeSelection()` so the
panel reads "Proportional 7%" like any table row.

**Axes.** Each is swept alone with every other field at its sidebar value.

| Axis | Field(s) | Grid |
|---|---|---|
| Asset growth | `growth` | base -3 .. +3 pp, 1 pp steps, floored at 0 |
| General inflation | `inflation` | base -1.5 .. +1.5 pp, 0.5 pp steps, floored at 0 |
| Medical inflation | `cpi` | base +/- 1 pp. Its own axis because `sim.medicareRate *= (1 + cpi + inflation)` (`optimizer_core.js:2192`) compounds it separately from everything else |
| Lifespan, person 1 | `die1` | base +/- 5, +/- 10 yrs |
| Lifespan, person 2 | `die2` | base +/- 5, +/- 10 yrs |
| Death ORDER | swap `die1`/`die2` | who goes first, at matched ages. Flips the household to Single filing at a different point, which is the largest single driver of conversion value in this engine |
| SS haircut | `ssFailPct`, `ssFailYear` | 0 / 23% / 30%, plus the year pulled 5 yrs earlier |
| Tax policy drift | `taxRateCreep`, `taxCreepStartYear` | 0 / 0.5 / 1.0 pp per yr |

Every one is already a plain `getInputs()` field (`optimizer_ui.js:339-407`) and `simulate()` is
pure, so a cell is literally `simulate({ ...base, growth: r })`. No engine change is required for
any axis. Two axes the user considered and declined, recorded so they are not re-proposed as new:
`futureIRATaxRate` (it is the SCORING assumption, not a world assumption) and state-of-residence.

**Scoring - the part that must not be got wrong.** Cells are not comparable in dollars; see the
findings entry "An assumption sweep cannot be scored in dollars". Each cell therefore runs the plan
TWICE - as configured, and again with `convertExcessToRoth:false` / `extraConversionAmount:0` - and
the tornado bar is the WITHIN-CELL difference in `baselineScoreOf()` (`optimizer_core.js:2703`),
the same after-tax, inflation-deflated, spendable-weighted measure the optimizer table already ranks
on. Secondary per-cell readouts: whether `totals.success` flips, and whether the plan's rank inside
its own family moves. Raw ending-wealth deltas ACROSS cells are out of scope and must not be drawn.

**Guards:**
- Clamp `die1`/`die2` to at least the person's current age. `maxYears` is derived from them
  (`optimizer_core.js:2220`) and must never go non-positive.
- Skip the `die2` and death-order axes when `hasSpouse` is false. `simulate()` already zeroes
  person 2 at `optimizer_core.js:2198`, so those cells would be silent duplicates.
- AL, MT and OH have `INFLATION_INDEXED:false`. Their brackets are frozen at `taxengine.js:1089`
  while their standard deduction inflates unconditionally at `taxengine.js:1349-1351`, so the inflation
  axis amplifies that known bug into a visible trend line. Disclose it in a NOTE on the axis, or
  suppress the axis for those three states. Do not ship it silently.

**Placement and cost:** new pure `sweepAssumptions(base, axes)` in `optimizer_core.js`, added to
the UMD export list at `optimizer_core.js:3328` so it is node-testable the way
`bestConversionStopYear` is. Rendering in `optimizer_ui.js`. About 45 grid points x 2 runs is ~90
`simulate()` calls, against the ~150 the optimizer already runs synchronously in ~1.3s. Reuse the
`_optBusy*` indicator (`optimizer_ui.js:596-666`) and stay on the main thread: no worker, no
chunking, no progress bar.

**Reuse, do not rebuild:** `baselineScoreOf`, `afterTaxWealthOfLogRow` (`optimizer_core.js:2499`),
`describeSelection`, `rankRowsByObjective`, the `_optBusy*` helpers. The ⚖ compare and 📍 pin
machinery is NOT needed - this panel has exactly one plan, so there is nothing to pin against.

- [ ] **P27a** — `sweepAssumptions(base, axes)` in optimizer_core.js, pure, UMD-exported
- [ ] **P27b** — Axis definitions + the two guards (age clamp, no-spouse skip)
- [ ] **P27c** — Within-cell paired scoring (configured vs no-conversion) on `baselineScoreOf`
- [ ] **P27d** — Tornado render in optimizer_ui.js, reusing `_optBusy*`
- [ ] **P27e** — AL/MT/OH inflation NOTE or axis suppression
- [ ] **P27f** — node tests: age clamp, no-spouse skip, and that a zero-width axis returns a zero bar
- **Status:** scoped, not started
- **Independent:** no phase dependencies

**DEFERRED follow-on, named here so it is not lost:** the winner-stability GRID - run the whole
strategy sweep at each of 3x3 assumption corners and report which family wins per cell. That is the
question the tornado cannot answer ("is my winner an artifact of my guesses?"), it costs ~9 x 150
simulations so it needs the worker, and it is the natural successor to this phase.

---

## P29: Hebeler Autopilot — is a second dynamic-spend rule worth a strategy slot?

**Why:** Guyton-Klinger is the only dynamic-spend rule in the tool (`optimizer_core.js:1203-1228`)
and it has exactly one shape: a deadband against a **frozen** initial withdrawal rate. `sim.gkIWR` is
derived once at y=0 (`optimizer_core.js:1205`) and never re-based, so an unlucky year-0 portfolio pins
the rate for the whole plan, and GK never consults age. Hebeler Autopilot is a 50/50 blend of an
**age-driven** RMD-method divisor and last year's inflation-adjusted spend — self-correcting, with no
memory of the initial rate. Structurally the opposite of GK, so on paper the two are not redundant.

Every piece of state a Hebeler branch needs already exists: `sim.prevPortfolio`
(`optimizer_core.js:2271`) is the denominator, `sim.spendGoal` carries prior-year spend, and
`yr.yearInflation` (`optimizer_core.js:930`) is the CPI leg. It slots into `resolveSpendTarget` beside
the GK block. GK's 4th classic rule (portfolio management / withdrawal sourcing) is **not**
implemented — GK falls through to the baseline proportional branch
(`optimizer_core.js:1398-1406`) — so a Hebeler branch inherits identical sourcing and gives a clean
spend-rule A/B with no confound.

**OPEN DECISION, must be settled IN THIS PHASE before any code is written (user chose to leave it
open, 2026-08-01).** The divisor. `RMD_TABLE` (`taxengine.js:976-983`, labelled "Uniform Lifetime
Table (Simplified)") runs ages **72 to 120 with no gaps** — verified. `getRMDPercentage`
(`optimizer_core.js:55-62`) returns 0 below the RMD start age and clamps above 120. There is no
single-life table, no Table I, and no pre-72 extension anywhere in the repo. A plan starting at 60 has
no divisor for its first 12-15 years, which is exactly the window this tool exists for. The three
options, to be decided rather than discovered mid-implementation:

- **(a) Extend the table downward.** Means adopting a *different* IRS table — Uniform Lifetime starts
  at 72 by construction. Owns a new data source and compounds "abridged Uniform-Lifetime-only RMD
  table", already on the deferred README caveats list (see the caveats phase above).
- **(b) Derive from the plan's own `die1`/`die2`:** `divisor = max(1, plannedDeathYear - currentYear + 1)`.
  Self-consistent with `maxYears` (`optimizer_core.js:2220`), no new tax data, no false precision, and
  the user already told the tool when they die.
- **(c) CPI leg only until RMD age.** Simplest, but it makes Hebeler identical to inflation-indexed
  fixed spend for 12-15 years and therefore measures nothing in the window that matters.

**Falsifiable questions:**
- **Q1.** Does the Hebeler spend path differ from GK by more than noise, sourcing held fixed? Metric:
  max per-year `|spendGoal_H - spendGoal_GK|`, plus the count of years differing by >1%.
- **Q2.** Does the difference move the score the tool actually ranks on? Metric: `baselineScoreOf`
  (`optimizer_core.js:2799`) and `totals.success`, within scenario.
- **Q3.** Is any advantage the *age term* or the *50/50 damping*? Third arm at 100% RMD leg (pure RMD
  method). If pure-RMD equals Hebeler, the blend is decoration.
- **Q4.** Does divisor choice (a/b/c) change the ranking? If yes, the phase cannot ship without
  settling the data question first.

**Scoring rule that must not be got wrong.** A spend rule changes delivered spend, so wealth alone is
meaningless — a rule that ends richer by spending less has won nothing. P24's stop-year sweep was a
clean wealth comparison *only because* delivered spend was identical across every cutoff (`spendRange`
$0, findings.md §2). That does not hold here. Report spend and wealth as a **pair**, within scenario,
and apply P27's rule that assumption-style sweeps are not comparable in raw dollars across cells.

**Already ruled out — do not re-derive:**
- "Does dynamic spending beat static" in general. Not the question; GK already ships.
- Any sourcing rule as part of Hebeler. GK's 4th rule is deliberately absent, and sourcing belongs to
  P30/P32. This phase touches `resolveSpendTarget` only.

**Tasks:**
- [ ] **P29a** — **Settle the divisor decision (a/b/c)**; write the choice AND the rejected options into this phase
- [ ] **P29b** — Research input `spendRule: 'gk' | 'hebeler' | 'rmdpure'`, default unset = bit-identical, no UI (the P28 research-flag pattern)
- [ ] **P29c** — Hebeler branch in `resolveSpendTarget` beside `optimizer_core.js:1203`; log keys mirroring `gkSpend`/`gkAdj` (`optimizer_core.js:883-884`)
- [ ] **P29d** — Harness with predictions stated up front and scored
- [ ] **P29e** — Scenario ladder: reuse P28's 5-mix x 3-spend-rate ladder
- [ ] **P29f** — Paired spend/wealth reporting; never a bare wealth delta
- [ ] **P29g** — Add as a sweep arm next to the single GK arm (`optimizer_ui.js:846`); check whether it ever outranks GK
- [ ] **P29h** — Decision: ship as a strategy, ship nerdknob-gated, or record and drop
- **Status:** not started, research-first. **Harness:** `.test_harnesses/hebeler_harness.js` (node)
- **Independent:** no phase dependencies. Adds one sweep arm, so it interacts with P34's run budget.

---

## P31: Asset mix is an OUTPUT — the reverse mapping, asked honestly

**Why — and this phase must lead with the prior finding.** The question as literally posed ("what asset
mix target is ideal for a given spend level") **was already asked in this repo and answered NO.** P24
§6 (findings.md:515-533) tested a terminal-mix target as a stop-year heuristic and it failed: taxable
share is fairly stable at 43-48% of after-tax net worth, but pre-tax net ranges 3-71% and Roth 0-68%.
The recorded conclusion is that the optimal mix is an **output of the search, not an input to it**.
Re-running that is forbidden.

The user's *actual* question is the **reverse mapping**, and it has never been asked: given a mix you
want, which strategies get you there? That is descriptive, over a sweep the tool already runs. Every
one of the ~177 rows already carries its terminal mix — `totals.terminal`
(`optimizer_core.js:2535-2541`) holds `{ira, roth, cash, brokerage, basis}`, and `_afterTaxBuckets`
(`optimizer_core.js:2855-2862`) already collapses it to the three tax buckets. The only consumer is
the `taxflex` objective (`optimizer_core.js:2863-2884`), which sorts on `spread()` and **never
displays it**. The tool computes this for every row and shows the user none of it.

**Bound on any possible answer — state it out loud in the deliverable.** There are **no contributions**
in this engine. No wage, salary or savings input exists; the only money in is SS + pension
(`yr._yearInflows`, `optimizer_core.js:2232`). A user cannot "get to" a mix by saving differently
inside this tool. The only levers on the terminal mix are conversions, withdrawal sourcing, and spend
level.

**Falsifiable questions:**
- **Q1 (make-or-break).** Is the terminal mix predictable from the strategy family? For each family,
  compare the spread of its terminal mix **across** scenarios against the spread **between** families
  at a fixed scenario. If within > between, "pick strategy X to get mix Y" is unanswerable and the
  deliverable is a disclosure, not a control.
- **Q2.** Which input moves the mix most — family, conversion amount, or stop year? The prior from P24
  §6 (Roth share 0-68%) says conversion amount. If conversions dominate, the honest answer is "your
  conversion policy sets your mix, and the tool already searches that," and the deliverable is a
  *display*.
- **Q3.** Does spend level change the answer? The user asked "for a given spend level," and P28 round 4
  overturned three conclusions once spend rate was controlled. Spend rate is a controlled axis **from
  the start here**, not added in a later round.
- **Q4.** Is any mix *unreachable*? A negative result ("nothing in the reachable set exceeds X% Roth at
  8% spend") is directly useful and cheap to extract.

**Already ruled out — do not re-derive:**
- Terminal-mix-as-target (findings.md:515-533). Do not propose a target-mix objective or any mix-based
  heuristic.
- Two account-mix shortcuts, both scored and both failed to *rank* (findings.md:962-966): Brokerage
  share, and `min(Brokerage drawn, Roth held)`. The payoff is **non-monotone** in Brokerage share — it
  peaks at balanced thirds ($1,757,386) and falls at 62% ($778,677).
- The one rule that survived is a **zero-test, not a ranking**: every cell whose control never touched
  Brokerage returns exactly $0. It prunes; it cannot order.

**Tasks:**
- [ ] **P31a** — Harness reusing P28's mix x spend-rate ladder wholesale
- [ ] **P31b** — Per-row terminal mix extracted via `_afterTaxBuckets` — reuse, do not recompute
- [ ] **P31c** — Q1 within-vs-between variance test, reported as a number
- [ ] **P31d** — Q2 attribution across family / conversion amount / stop year
- [ ] **P31e** — Q4 reachable-set boundary per spend rate
- [ ] **P31f** — **If Q1 is yes:** Mix column in the optimizer table plus a mix readout in P33's Insights panel.
      **If Q1 is no:** publish the finding and, at most, surface `taxflex`'s `spread()` so the user can
      see what that objective already optimizes silently
- **Status:** not started, research-first. **Harness:** `.test_harnesses/assetmix_harness.js` (node)
- **Independent:** no research dependency. Its display half lands on P33's surface.

---

## P33: Insights panel — where the money came from

**Why:** the stats bar answers "how much" and never "from where." All ten tiles
(`retirement_optimizer.html:419-433`) are a level or a rate — taxes, spend, end wealth, funded years,
withdrawal rate, break even, stress. None is a decomposition. The user's example (share of lifetime
spend from growth vs starting assets) is exactly the missing axis, and the raw material is already
computed and thrown away: `applyGrowth` returns per-account gains (`optimizer_core.js:468-483`), the
two per-year calls are merged at `optimizer_core.js:2135` so `yr.gains` is full-year earnings per
account, and the asset-flows chart already sums them (`optimizer_ui.js:3275`) — per year, chart-only,
never accumulated to a lifetime total, never in `totals`.

**This is the only build-first item of the six.** Nothing here is a question about the world; it is
arithmetic over fields that already exist. The risk is not correctness, it is labelling and surface.

**Surface (user decision, 2026-08-01): a separate Insights panel, NOT the stats bar.** The stats bar
already holds ten tiles and a slate this size would not fit.

**SURFACE COLLISION — resolve before building.** `Phase PE: Insights / Feedback Panel` (above,
pending) already claims that surface for *narrative* cards with severity levels. The placeholder is
live: `#tab-insight` with an empty `#insights-table` at `retirement_optimizer.html:787`.
Recommendation on record: **one surface, two sections** — P33 ships the statistics section, PE later
adds narrative cards above it. P33 goes first because it has no rule-authoring risk. If a true modal
is wanted instead of the existing tab, that is a one-line change to where `renderInsightStats()`
mounts, not a second panel.

**Labelling decision, to be made before anything ships.** "Growth" as logged is **not** appreciation.
`yr.gains` includes dividends (`optimizer_core.js:2139` when DRIP is on, `:2143` to Cash when off) and
`cashG` includes cash yield. Decision: name the headline **Earnings** and define it, then break
dividends and interest out separately in the panel, which has no character limit. `yr.taxableDividends`
and `yr.taxableInterest` are both already per-year fields.

**Second decision, which is what makes the user's statistic well-defined.** There are **no
contributions** in this engine — no wage, salary or savings input exists. So a sources-of-lifetime-spend
decomposition has exactly three terms and they close: **starting balances**
(`optimizer_core.js:2301-2305`) + **investment earnings** (sum of `yr.gains`) + **guaranteed income**
(sum of `yr._yearInflows`, `optimizer_core.js:2232`). Conversions and reinvested surplus are internal
transfers and must not appear as sources. Say so in the panel.

**The slate.** The panel is its own surface, so the full set is in scope.

| Statistic | Definition | Computed from |
|---|---|---|
| **Growth-funded %** (the user's ask) | earnings / (earnings + starting balances + inflows) | new `totals.earnings` from `yr.gains`; starting balances `:2301-2305`; new `totals.inflows` from `yr._yearInflows` |
| Lifetime earnings | sum of per-account gains, broken out per account | `yr.gains.{IRA1,IRA2,Roth1,Roth2,Brokerage,Cash}` — mirrors log keys `-iraG`/`rothG`/`brokerageG`/`cashG` (`:852-856`) so panel and chart cannot disagree |
| Guaranteed-income share of spend | inflows / `totals.spend` | `totals.spend` (`:2150`), new `totals.inflows` |
| Terminal mix | preTax / Roth / taxable as three percentages | `_afterTaxBuckets` (`:2855-2862`) — exists, is correct, currently only sorts `taxflex` |
| Realized LTCG | sum of `yr.capitalGains`, plus the share realized at 0% | **accumulate at ONE point only, after the last recompute** — it is recomputed at `:1417`, `:1560`, `:1630`, `:1660` and naive accumulation double-counts |
| Converted total / share of starting IRA | sum of `yr.totalConverted` / starting IRA | accumulate on the `totals` side. **Do not add a log key** — P28 established `rothConv` is engine state, `beginYear` reads `log[y-1].rothConv > 1000` to pick withdrawal timing |
| Brokerage drawn (zero is meaningful) | sum of Brokerage withdrawals | P28's zero-predicate made user-facing: "this lever is inert for you" |
| Cash-reserve breaches | count of years with `yr.cashBreach` | `optimizer_core.js:1677-1688` — a real failure signal with no surface today |
| Forced IRA total | `totals.forcedIRATotal` | **already in `totals` at `:2317`, displayed nowhere** |
| ACA breach years | `totals.acaBreachYears` | **already in `totals` at `:2317`, displayed nowhere** |

The last two are the cheapest win available and are task #1 — zero engine change.

**Optional extras the user named (2026-08-01):**
- **Per-asset computed log column** in Annual Details. Cheapest useful one: a per-year `Earnings`
  column (the four `*G` fields summed), and/or making `-iraG` visible. Costs **four** registration
  points and getting fewer than all four is how a column silently vanishes: emit in
  `buildSimYearLogRecord` (`optimizer_core.js:750-889`), `columnCategories`
  (`optimizer_ui.js:1838-1935`), `columnGroupDefs` (`optimizer_ui.js:1938-1966`), tooltips
  (`optimizer_ui.js:2171-2222`). This file's own Known TODOs already lists two suspected
  column-registration bugs, so it is a live failure mode.
- **New chart.** Five views exist — combined, tax, net, flows, assetflows (`optimizer_ui.js:3133`). A
  sources-of-spend stacked area would be a sixth, reusing `earn()` at `optimizer_ui.js:3275`. Global
  `Chart.defaults` rules apply: no per-chart tooltip colours, no per-chart `labelColor`.

**Bit-identity guarantee.** Every item is accumulate-only. `simulate()` behavior must not change; the
regression is that a fixed scenario's log and existing totals are unchanged apart from the new keys.
Initialize new `totals.*` keys in the literal at `optimizer_core.js:2317`, not lazily — the lazy
`totals.medicare` at `:2148` is the exception, not the model. Check `montecarlo/mc_tab.js` for
`undefined` handling first.

**Tasks:**
- [ ] **P33a** — Resolve the PE surface collision (recommendation: one surface, two sections)
- [ ] **P33b** — Surface `forcedIRATotal` + `acaBreachYears` — already computed, zero engine change
- [ ] **P33c** — `totals.earnings` + `totals.inflows` accumulators, plus a node test asserting `totals.earnings`
      equals the sum of the chart's per-year `earn()` (`optimizer_ui.js:3275`) — the two must agree by
      construction
- [ ] **P33d** — `computeInsightStats(totals, log, inputs)` in core (pure, UMD-exported, node-testable) +
      `renderInsightStats()` in UI
- [ ] **P33e** — Growth-funded % with the dividends/interest caveat stated in the panel
- [ ] **P33f** — Terminal mix via `_afterTaxBuckets` (reuse, do not recompute)
- [ ] **P33g** — Realized-LTCG accumulator at a single site; test against a scenario with a known harvest
- [ ] **P33h** — Brokerage-drawn total and cash-breach count
- [ ] **P33i** — Optional: per-year `Earnings` column — all four registration points
- [ ] **P33j** — Optional: sources-of-spend chart as a sixth view
- [ ] **P33k** — Empty state before the first run; no MC coupling, `#stat-stress` untouched
- **Status:** not started, **build-first**, no harness
- **Independent:** no phase dependencies. Shares a surface with PE; P31's mix display lands here if it
  ships.

---

## P68 — changelog brevity pass over the recent entries

`optimizer_changelog.md` is **79 entries, 18,459 words**. The convention says entries are
user-facing and brief; in practice they carry the "why", the mechanism, and a per-item breakdown that
repeats what the summary already said. User 2026-08-22, on a 954-word entry: "WAY too long".

The rule was settled and applied to **11.15fc only** (954 -> 183 words), plus its in-page `<li>`
(89 words) and its README bullet. The target is **roughly 150 words per release entry**, recorded in
the `feedback_changelog_conventions` memory with the cut order: the "why" first, then the mechanism,
then any per-item list that restates the summary. Sweeping beats complete.

Deferred by the user on 2026-08-22: "Add changelog brevity improvements to the Task list. Let's not
do now."

**Measured word counts, worst first** (`<a id=...>` anchor to the next anchor):

| entry | words | entry | words |
|---|---|---|---|
| 11.150b | 1717 | 11.1585 | 350 |
| 11.152f | 1474 | 11.1553 | 319 |
| 11.15a2 | 728 | 11.15e3 | 298 |
| 11.15cf | 509 | 11.1508 | 273 |
| | | 11.15c9 | 214 |

- [ ] **P68a** rewrite the top ~12 entries to <=150 words each. Anchors (`<a id="11.15cf"></a>`) and
      `## version` headings MUST survive verbatim: `doclinks.tests.js` resolves links against them and
      the in-page changelog links here. Re-run it after every edit.
- [ ] **P68b** decide whether to keep going past the top 12. Rewriting entries for releases people
      have already read is a different call from fixing an unmerged one, and is the user's to make.
- [ ] **P68c** what NOT to cut: the **behavior-change** warnings. A reader's actual question is "does
      this release move my saved plan?", so those sentences are the one part that earns its length.
- **Status:** NOT STARTED, deferred. **Depends on:** nothing.

---
## P42: Lumpy Spending, no URL encoding  *(was PB; supersedes the old P3 spec)*
**Why:** Users have one-time/irregular expenses (renovation, car, medical). Current P3 plan included URL encoding; user revised: not needed. Store in memory + named scenarios + auto-persist only.

**Storage:** Global `let lumpyEvents = []` — array of `{year, amount, label}`. Included in `saveScenario()` / auto-persist; NOT URL-encoded.

- [ ] **P42a** — Global `lumpyEvents = []` init in html
- [ ] **P42b** — UI: collapsible sub-section near `#spendGoal` — repeating rows (year number, amount $, label text, × remove). "Add expense" appends row; each row triggers `recalc()` on change
- [ ] **P42c** — `simulate()` year loop: `const lumpyThisYear = lumpyEvents.filter(e=>e.year===currentYear).reduce((s,e)=>s+e.amount,0); const yearSpendGoal = inputs.spendGoal + lumpyThisYear;` — use `yearSpendGoal` in withdrawal/gap logic for that year
- [ ] **P42d** — Annual Details: `lumpySpend` log field (0 in non-lumpy years; existing all-zero column hiding applies)
- [ ] **P42e** — `saveScenario()` (~core.js:4854): include `lumpyEvents` in scenario object before stringify
- [ ] **P42f** — `restoreScenario()`: restore `lumpyEvents` and rebuild UI rows
- [ ] **P42g** — Phase PC auto-persist: include `lumpyEvents` in autosave payload
- [ ] **P42h** — Test: add `{year:2028, amount:15000}` → Annual Details shows lumpySpend=15000 in 2028; save/reload scenario preserves it
- **Status:** pending
- **Independent:** no phase dependencies

---

## P43: Auto-Persist + Restore Offer  *(was PC)*
**Why:** Named scenarios require explicit save/load. No auto-persist exists. Users lose work on accidental close or page refresh.

**New storage key** (alongside `STORAGE_KEY` at core.js:8):
```javascript
const AUTOSAVE_KEY = 'SLCRetireOptimizeAutoSave';
```

**Payload:** `{ ts: Date.now(), params: {elementId: value, ...}, lumpy: lumpyEvents }`

**On page load** (after `captureDefaults()` and `loadFromURL()`):
- If `location.search` is empty (no URL params) AND autosave exists AND age < 30 days → show restore banner
- If URL params present: skip entirely (URL always wins)

**Restore banner:** Slim dismissible bar above sidebar:
`"Restore your last session from [date]?  [Restore]  [Dismiss]"`
- Restore: apply saved params + lumpyEvents; trigger recalc; hide banner
- Dismiss: hide banner; mark dismissed so same autosave doesn't re-offer

- [ ] **P43a** — Add `AUTOSAVE_KEY` constant
- [ ] **P43b** — `autoSaveState()`: iterate all form elements with IDs, collect values + lumpyEvents + timestamp; `localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload))`
- [ ] **P43c** — Debounce 600ms: `document.addEventListener('input', debouncedAutoSave)` after init
- [ ] **P43d** — On page load: check for autosave + offer restore logic
- [ ] **P43e** — Restore banner HTML + show/hide logic
- [ ] **P43f** — `applyAutoSave(saved)`: sets element values + lumpyEvents + triggers recalc
- [ ] **P43g** — `restoreScenario()` (named scenario load) also triggers `autoSaveState()` so named-scenario state becomes new autosave baseline
- [ ] **P43h** — Test: change any input → 600ms → check localStorage has autosave; reload clean (no URL) → banner appears; Restore → inputs match; Dismiss → no re-offer on next reload
- **Status:** pending
- **Independent:** no phase dependencies; PB (lumpy) should ship first so lumpy is included in autosave

---

## P44: Onboarding Interview  *(was PD; supersedes the old P7 stepper concept)*
**Why:** Original P7 was a stepper walkthrough of app features after load. User revised concept: a **pre-page interview** that gathers goals + rough numbers → pre-populates inputs → suggests where to focus. More useful than touring features.

**UX Flow (3 screens in modal overlay):**

**Screen 1 — Goals** (checkboxes, pick any):
- Maximize lifetime after-tax spending
- Leave a financial legacy / maximize estate
- Plan for stability in bad markets (sequence of return risk)
- Optimize Roth conversions to reduce lifetime taxes
- Qualify for ACA premium subsidies (pre-Medicare)
- Bridge income between retirement and Social Security start

**Screen 2 — Quick Numbers** (rough ballpark; all editable later):
- IRA/401k balance, Roth balance, Brokerage/taxable, Cash/savings
- Annual Social Security per person, Annual pension (0 if none)
- Planned retirement age + target annual spending (can leave blank)

**Screen 3 — Your Priorities** (generated from goal checkboxes):
- Short narrative + bullets. Examples:
  - "ACA subsidies" → "Set strategy to ACA limit until age 65"
  - "Roth conversions" → "Run the Optimizer to find optimal conversion strategy"
  - "Bad markets" → "Run Monte Carlo Stress mode to test your plan"
  - "Bridge to SS" → "Set SS start to 70; model gap years with IRA draws"
- [Finish]: pre-populates inputs, closes modal, sets `optimizer_onboarded`
- [Skip for now]: closes without pre-populating or setting gate

**Trigger:**
- First visit: `!localStorage.getItem('optimizer_onboarded')`
- "New Plan" button (top of sidebar): re-shows modal; clears current inputs on confirm

- [ ] **P44a** — HTML: modal markup `#onboarding-modal` (hidden) with 3 screen divs
- [ ] **P44b** — Goal checkboxes + screen navigation (Next/Back/Skip)
- [ ] **P44c** — Screen 3 suggestion map: JS object `{goalId → bullet string}`
- [ ] **P44d** — Quick numbers → pre-populate specific input IDs on Finish
- [ ] **P44e** — `showOnboarding()`, `onboardingNext()`, `onboardingFinish()` functions
- [ ] **P44f** — "New Plan" button in sidebar header area
- [ ] **P44g** — `localStorage` gate: show on first visit; set on Finish
- [ ] **P44h** — Test: clear `optimizer_onboarded` → modal shows; select goals → Screen 3 shows matching bullets; Finish → inputs pre-filled; reload → no modal
- **Status:** pending (concept revised 2026-06-29)
- **Independent:** no phase dependencies

---

## P45: Insights / Feedback Panel  *(was PE)*
**Why:** Users get numbers but no interpretation. A dedicated panel that reads simulation results and surfaces conditions the user should know about (RMD risk, longevity, survivor impact, Roth effectiveness) closes the "so what?" gap.

**Existing placeholder:** `#tab-insight` exists with empty `#insights-table` at `retirement_optimizer.html:787` (line reference corrected 2026-08-01; it was cited as 711-719 and the markup has since moved). No code populates it.

**SURFACE COLLISION with P33.** P33 (Insights panel — statistics) claims the same `#tab-insight` surface for a *statistics* section. Recommendation on record: one surface, two sections — P33's numbers ship first because they have no rule-authoring risk, PE's narrative cards land above them later. Do not build a second panel.

**Architecture:**
- `computeInsights(totals, log, inputs)` → `Insight[]` where each insight is `{id, severity, title, body, suggestion}`
  - `severity`: `'info'` (blue) | `'warn'` (yellow) | `'alert'` (red)
- `renderInsights(insights)` → replaces `#insights-table` with flex card grid
- Called in `runSimulation()` after `updateStats()`
- Empty state: "Run a simulation to see personalized insights."

**6 Insight Rules (initial set):**

| ID | Trigger | Severity | Title |
|----|---------|----------|-------|
| `rmd-growth` | Projected IRA at RMD age → est. first RMD pushes income into higher bracket | warn | "IRA may force large RMDs" |
| `longevity-fail` | `totals.yearsfunded < totals.yearstested` | alert | "Plan runs short" |
| `longevity-tight` | All years funded but `finalNW < 10% startWealth` | info | "Plan funded but tight" |
| `survivor` | `inputs.hasSpouse === true` | info | "Survivor income impact" |
| `roth-effectiveness` | Conversion years exist (any `log[y].rothConv > 0`) | info/warn | "Roth conversion assessment" |
| `ltc-buffer` | `finalNW > 0 && IRA portion > $50k` | info | "IRA as LTC buffer" |

**Projection formulas (no extra simulate() calls):**
- IRA at RMD age: `lastLoggedIRABalance * (1 + iraRate)^yearsToRMD`
- First RMD est: projected IRA ÷ IRS ULT factor (table already embedded for `stat-proj-rmd1/2`)
- Survivor income drop: `(ss1 + ss2 + pension) − survivor_ss − pension*(survivorPct/100)`
- Roth effectiveness: compare `totals.betrAvg` vs `inputs.futureIRATaxRate`

- [ ] **P45a** — `computeInsights(totals, log, inputs)` function in core.js — evaluate all 6 rules; return non-null insights only
- [ ] **P45b** — `renderInsights(insights)` — flex card grid in `#tab-insight`; each card: severity icon + title + body + suggestion (smaller)
- [ ] **P45c** — Replace `#insights-table` markup with card container div
- [ ] **P45d** — Wire call in `runSimulation()` after `updateStats()`
- [ ] **P45e** — Empty state when no simulation run yet
- [ ] **P45f** — Test: large IRA ($2M) → rmd-growth insight appears; plan that depletes → longevity-fail alert; hasSpouse=false → no survivor card
- **Status:** pending
- **Independent:** no phase dependencies; reads from existing `totals` + `log` data

---

## P50: Suggested-spend menu (3 strategy-independent goals)  *(CORE COMMITTED but DORMANT, UI DEFERRED — 2026-08-09)*
**Why:** P49's single suggestion (a) depended on the selected strategy — it moved as the user explored
strategies, when a spend goal should be a stable INPUT — and (b) produced an alarming withdrawal rate
(12.8% on the default), which exposed a units bug AND the deeper fact that "spend down to a K-year
buffer" is a spend-down posture, not a Bengen-style sustainable rate. User asked for a small MENU of
goals instead of one number. **Full research + the open decisions are in findings.md (P50 section);
read it before resuming.**

- [x] **P50a** — units bug in `suggestSustainableSpend` fixed (today's-vs-inflated dollar mix in the
      terminal buffer; now `last.spendGoal - last.guaranteedIncome`). **COMMITTED.** Also raised the live
      buffer `SUGGEST_BUFFER_YEARS` 3 -> **5** at the user's request (the ⓘ now requires 5 years of
      support at the end). The user's consolidated 11.14c6 changelog describes exactly this.
- [x] **P50b** — core built + **COMMITTED but DORMANT**: `solveMaxSpend`, `bengenRate`, `suggestSpendMenu`
      (A Bengen rate / D leave 50% real principal / B end with 5 full years), all against a FIXED `propwd`
      reference so the numbers are strategy-independent (`★ CRITICAL` test guards it). node 233/233.
      Nothing in the UI calls `suggestSpendMenu` yet.
- [ ] **P50c** — **BLOCKED on a user decision (finding 3):** the rate-based (A) and target-based (D,B)
      options have no fixed rank — they cross with horizon (35yr: A<D<B; 17yr: D<B<A). Pick the menu
      presentation: (a) keep the mix, label by method, sort the popover by dollar amount; or (b) all
      keep-fraction targets for a guaranteed gradient with Bengen as a reference note. User did not choose.
- [ ] **P50d** — UI NOT built. `suggestSpendMenu` is dormant; the ⓘ still calls `suggestSustainableSpend`
      (single value). Needs a small popover listing the goals, each one-click into `#spendGoal`.
- [x] **P50e** — **Version desync RESOLVED.** The user consolidated everything under **11.14c6** and
      rewrote that changelog entry (combined the P41 + P49 entries, describes the 5-year buffer and the
      fixed cushion). Rolled the stray `<title>`/`?v=` c8 bump back to c6 so title = changelog. Version
      stays 11.14c6.
- [ ] **P50f** — confirm "5 full years" (B menu option) = 5x FULL spend [implemented] vs 5x the
      portfolio-funded gap. (Separate from the live buffer, which is now 5 years of portfolio-funded need.)
- [ ] **P50g** — (stretch) SoRR-aware conservative option calibrated against a Monte Carlo percentile,
      the only way this deterministic engine can carry a genuinely Bengen-faithful "safe" number.
- **State:** units fix + live buffer=5 + P50 dormant core all **COMMITTED** to
  `worktrees/planning-with-files-0cb454` (PR #162), after rebasing onto the user's 4 changelog commits.
  `suggestSpendMenu` is dormant (no caller). Resume points: P50c (menu presentation decision), P50d (UI).
- **Independent:** no phase dependencies.

---

## P51: Perfect-foresight trajectory oracle (research, node-only)  *(NEW 2026-08-10, user-approved, O1)*

**Why:** the user asked (A) how hard whole-horizon optimization of asset utilization would be on
this engine, and (C) whether Proportional's optimality can be proven robustly. Full DP over the
state (7 balances + IRMAA 2-yr lookback + rothConv timing bool) is infeasible; a perfect-foresight
trajectory search on the deterministic sim is the feasible substitute and an UPPER-BOUND
DIAGNOSTIC — it overfits the known return path and is never a shippable policy. Design annex with
grids/predictions/insertion lines:
`~/.claude/plans/let-s-reason-around-brokerage-agile-stearns-agent-af918cff5b7ea950f.md`.
Relationship to P5: P51a subsumes P5a's search as research; P5 stays the shipping phase if a
schedule column is ever productized.

- [x] **P51a** — DONE 2026-08-10: conversions-only oracle in `.test_harnesses/oracle_harness.js`.
      **Result: 0-2.87% over the champion row (max +$241k), 15/15 cells under 3% (S3-P1 RIGHT).**
      Flat scalar found $0 in 15/15 cells while per-year timing found up to $241k — per-year
      shapes ARE inexpressible to the flat sweep. Two-fix history worth keeping: (1) champion
      selection must use baselineScore, not wealth-only, or GK buys the slot by cutting spend;
      (2) candidates must pin delivered spend to the base row within $1 — without the pin a GK
      base showed a fake +81% that was pure spend-shifting.
- [x] **P51b** — DONE 2026-08-10: `oracleWithdrawalPlan` research input (per-year weights
      {IRA,Brokerage,Cash,Roth}, normalized by `calculateWithdrawals`; null/all-zero entry = no
      override), first branch of the `planPrimaryWithdrawals` chain + mirror in `fillSpendingGap`;
      composing with `cyclicEnabled` throws. Tests: absent/null/all-zero byte-identical, IRA-only
      year honors the split, fidelity replay within 2%. Suite 242/242.
- [x] **P51c** — DONE 2026-08-10: 10-archetype coordinate descent, conversion coordinate
      interleaved, non-cyclic base per cell (the hook refuses to compose with cyclic). ~10s/cell.
- [ ] **P51d** — independent-search cross-check, now SHARPENED by the run: cyclic rows BEAT the
      oracle in defaults @6% (menu cannot express surplus routing), so the descent+menu result
      is a lower bound on the true ceiling — the cross-check should bound how far below it sits.
      Also open: GK-base cells at 6-8% spend need a survivable fixed-spend base for family gaps.
- [x] **P51e** — DONE 2026-08-10 → `research/PERFECT_FORESIGHT_ORACLE.md`. **"propwd
      default-optimal" REFUTED on the absolute half too**: gap-to-oracle 2.3-11.6% where
      measurable (pre-declared bar was <1%), IRA Draw ahead in every cell. Attribution:
      conversion timing >> withdrawal split (defaults3x @4%: +$1.08M conv vs +$36k split); flat
      scalar found $0 in 15/15 cells, so per-year shapes are inexpressible to the shipped sweep.
- [x] **P51f** — DONE (observation): NO harvest-like alternation (1/6 cells); recurring shape =
      IRA-led mid-plan then a Roth-spending tail with Brokerage ridden to the §1014 step-up.
      Backstops silent 15/15 (S3-P4 RIGHT). Recorded, nothing ships.
- [x] **P51g** — DONE: defaults @6% gain $183k→$254k as heirs rate 0.15→0.35 (converts MORE at
      higher rates, correct direction); thirds @6% gain ~$700k nearly rate-insensitive (its gain
      is the Roth-tail split, not conversions).
- **Rules:** spend pinned (candidates with shortfall > $1 discarded), objective = shared-rate real
  after-tax NW, backstops instrumented not bypassed (acceptance gate: forcedIRA < $1/yr in >=95%
  of years), sequential node only, results never enter the UI sweep, no oracle pattern ships
  without the axis-property + pinned-test bar.
- **Depends on:** Stage-1 champions (DONE 2026-08-10) for the comparison rows.

---

---

## P63: state safe harbor, generically  *(RESEARCHED 2026-08-18, DEFERRED, but it exposed two live bugs)*

**The user asked for an observation, and a full plan only if it looked reasonably easy. It is not.**
The shape is cheap; the facts behind the shape are not.

### The observation

`STATE_DB` has 57 entries that collapse to 8 distinct shapes. Of the 48 taxing entries, exactly
**three** deviate from the `_s()` builder defaults on any safe-harbor knob (CA threshold, MD
always-110, AS pro-rata) and three on schedule (CA 30/40/30, OR, VA). The other **45 carry the
federal rule as an unresearched default**, which is a guess wearing the costume of data.

A generic shape needs about six scalars per jurisdiction (`currentPct`, `priorPct`, `priorPctHigh`,
`highIncomeThreshold`, `highIncomeMeasure`, `priorYearAvailable`), plus `estimatedTaxRegime` so "no
regime" stops being spelled as an empty `quarterlySchedule`, and `whenPaid` so a state that does not
credit withholding pro-rata can say so. That is roughly 180 to 200 lines across 5 files and is
**behaviour-neutral by construction only if a characterization test pins all 48 entries first** -
today 46 states could change their requirement and the suite would still report green.

**The expensive half is the research**: 47 jurisdictions x 8 fields is about 376 cited facts, each
read off a state underpayment form and its instructions, roughly 16 hours of primary-source reading
before a single number improves, with a maintenance tail because states move these rules. The code
without the research buys nothing. **DEFERRED as a research ticket**, characterization test first.

### Two live bugs it exposed, both worth fixing on their own

- [ ] **P63a** - **`withholdingCreditedProRata` is never consulted.** `scheduleSafeHarbor`
  (taxPaymentPlanner.js ~642) takes no `stateInfo` and credits withholding pro-rata unconditionally,
  so Alabama and American Samoa return byte-identical verdicts across all five plans despite the flag
  differing. Either honour it or delete it; a flag that does nothing is worse than no flag.
  **Not a one-line change**: `stateTimelyByWithholding` also sets `noPenalty` on emitted actions and
  switches text between "[DATE PASSED]" and "[PAST DUE]", so honouring it changes the action plan,
  not just a verdict. Verify the AS flag against a primary source first; it was set in a one-line
  override with no citation.

  **Read 2026-08-19, so it need not be re-derived.** The user redirected to P64 before choosing a
  shape, so P63a is still open, but the facts are settled:
  - The flag is read at **exactly two sites, and both are prose**: taxPaymentPlanner.js ~1409 (the
    benign-alert caveat) and ~1787 (the draw note). Neither `withholdingCoversSchedule` (~698) nor
    `scheduleSafeHarbor` (~661) consults it. Both spread `withheld / n` unconditionally.
  - `withholdingCreditedProRata: false` is live in **one entry, `AS` (~502)**. `_noTax` also sets it
    false (~340), but `hasIncomeTax: false` short-circuits every consumer, so that value is dead.
    Every other taxing entry inherits `true` from `_s()`.
  - **Honouring it is not localized.** `stateTimelyByWithholding` is computed at step 10b (~1279),
    which runs BEFORE the action list is built at step 11, so a date-aware credit has no dates to
    work with there. `scheduleSafeHarbor` at ~2097 does have them.
  - **A separate prose bug, independent of the flag's fate.** ~1409 reads "this planner assumes it
    does not, so the state figure above may be optimistic". The premise is inverted: the math assumes
    it DOES credit pro-rata. The conclusion (optimistic) is right for the wrong stated reason.
  - **Zero test coverage.** No hit anywhere in `taxPaymentPlanner.tests.js` for `AS`, for the flag, or
    for "pro-rata". Nothing pins current behaviour, in either direction.
  - AS is a mirror-code territory (the IRC applies as local law with the territory name substituted),
    which makes IRC 6654(g)(1) pro-rata crediting the likely correct answer - i.e. the flag's one
    meaningful value is probably wrong. Confirm before honouring rather than deleting.
- [ ] **P63b** - **The state 110% gate is dimensionally wrong.** taxPaymentPlanner.js ~1125 compares
  `p.stateTax >= safeHarborHighIncomeThreshold`, a TAX amount against an AGI threshold, so the state
  110% bar effectively never fires. The page already discloses this in the safe-harbor NOTE with the
  direction stated (it UNDERSTATES the requirement).
  **Do not fix it alone.** Applied in a scratchpad copy it flipped **46 states** from
  `required 20000 / "100% of last year"` to `22000 / "110% of last year"`, with all tests still
  green: the failure direction moves from understating-and-disclosed to overstating-and-undisclosed,
  because those 46 states never had their threshold researched. Fix it only once `priorPctHigh: null`
  is the default for unresearched states, i.e. as part of P63 proper.

### Also noted

`0.90` appears as a literal in **seven** places (~1127, 1128, 1143, 1144, 1146, 1147, 2065), so a
generic `currentPct` has seven call sites, not one. And a state whose `quarterlySchedule` is empty
silently drops its liability from the coverage table rather than reporting a regime it cannot model.

**Status:** DEFERRED. P63a and P63b are separable and each is worth a small commit of its own, but
P63b must not ship before the per-state data exists.

## P65: the rest of Schedule A - medical is the only piece likely to qualify  *(NEW 2026-08-19, user-raised, NOT scoped)*

Raised by the user straight after P64 shipped, from asking whether the SALT cap is additive to the
standard deduction. **It is not** - SALT is Schedule A, so it is strictly either/or. The user's
instinct was right about the OBBBA **senior deduction**, which IS additive, and `taxengine.js` already
does both correctly: `useItemized ? saltItemized : federalStdDeduction`, then `federalDeduction +=
seniorDeduction` on either path.

**The gap it exposed:** `calculateTaxes` treats SALT as the ONLY itemized deduction. No mortgage
interest, no charitable, no medical above the 7.5% AGI floor. So the engine asks "does SALT alone beat
the standard deduction", a harder bar than a real filer faces, and genuine itemizers are overtaxed.
**This qualifies the P64c result**: ">=$4k, no decision moved" was measured on a model that
under-itemizes. Over the itemizing line, the marginal property-tax dollar is worth its full marginal
rate instead of nothing.

User's read on which line items matter here, recorded because it narrows the work sharply:

- [ ] **P65a** - **Medical above 7.5% of AGI. The one that likely qualifies.** Retiree medical is
  lumpy: nothing for years, then long-term care or a nursing home runs six figures and dominates
  Schedule A alone. That is the year the household itemizes, the year the SALT figure suddenly pays
  its full marginal rate, and the year a conversion is cheapest - a strategy question, not only an
  accuracy one. **A flat annual figure would be wrong in both directions**, so this belongs with Lumpy
  Spending (P42) or as an explicit high-medical year range, not a scalar. **Measure before building,
  the way P64 was measured.** Check the interaction first: a big medical year is usually a big
  withdrawal year, so AGI rises and the 7.5% floor rises with it; the two move against each other.
- [ ] **P65b** - **Charitable. Smaller than a naive model assumes, but not zero.** A well-advised
  retiree gives via QCD or appreciated assets. The **QCD really does bypass Schedule A** - it is an
  income exclusion, already modelled correctly in `computeAnnualQCDs`. **A gift of appreciated stock
  does NOT** - that is an itemized deduction at fair market value under the 30%-of-AGI limit, so it
  lands on Schedule A, and it stays relevant below QCD age and above the annual QCD limit.
- [ ] **P65c** - **Mortgage interest. Deprioritised by the user**: significant mortgage deductions are
  less likely for retirees. Not worth an input on its own; only in scope if P65a is built and the
  parameter is nearly free at that point.

**Status:** NOT SCOPED. Recorded so the P64 conclusion is never re-read as a statement about real
filers with a full Schedule A.

## P55: MCP server — let an AI run the engine over a customer's scenario  *(NEW 2026-08-16, priority unset)*

**Why:** users asked whether Claude (or any AI) can interact with the optimizer's data. The compute
engine is already MCP-ready; the hard part is not the engine, it is getting a *random customer's*
scenario — which lives only in their browser's memory / `localStorage` on a static host with no
accounts — into a headless, stateless tool. This phase scopes both.

### Engine readiness (grounded, 2026-08-16)

- `simulate(inputs)` at `optimizer_core.js:2624` is a **pure function**: plain params object in, result
  object out. `optimizer_core.js` has **0** `getElementById` — the engine is fully DOM-free.
- `optimizer_core.js` and `taxengine.js` already `module.exports = { simulate, optimizeSpend,
  suggestSpendMenu, rankRowsByObjective, optimizeConversionAmount, calculateTaxes, calcIRMAA, ... }`.
  The node test harness already runs the engine headless (**263/263**). An MCP server is the same trick.
- **The seam:** `getInputs()` at `optimizer_ui.js:5` is "the single DOM-to-params bridge into the
  engine." It reads the form, parses dollar strings, flips checkboxes to bools and derives fields like
  `hasSpouse`, then hands the result to `simulate()`. It is DOM-coupled, so it cannot be reused
  headless as-is. This transform is what an MCP server must replicate — the drift risk lives here.

### The data-bridge problem (the crux)

Customer's primary contact is the hosted static page `https://tools.netcitizen.us/retirement_optimizer.html`.
Their scenario exists as: (1) live form state in browser memory, (2) `localStorage` saved scenarios,
(3) URL params (partial, nerdknob-gated). No server, no account, no server-side copy. Existing bridges
out of the browser:

- **Save/Export scenario → JSON file** (`exportScenario`, `optimizer_ui.js:4480`). Shape is
  `{ version, data: { <fieldId>: <value> } }`, keyed by DOM field IDs — the same map `applyScenario`
  (`optimizer_ui.js:4158`) writes back into the form. This is the clean bridge.
- **URL params** (`optimizer_ui.js:2377/3838/3899`). Partial state only; not a full scenario.

### Customer-work estimate (recommended local-stdio path)

What a non-developer customer must do to get their AI talking to the tool, honestly counted:

1. Install Node.js runtime. *(dev-hostile barrier)*
2. Obtain the MCP package (`npx`, or clone/download). *(softened to near-zero if shipped as `npx`)*
3. Register the server in their MCP client config — `claude_desktop_config.json`, `claude mcp add`,
   or another client's JSON, with an absolute path. *(dev-hostile; the .dxt one-click collapses it)*
4. Restart the MCP client.
5. **Bridge their data out of the browser:** on the hosted page, Save → Export → download
   `myscenario.json`. *(existing feature; friction is "download file, find it, attach it")*
6. Hand that JSON to the AI (attach/paste) and ask it to run the tool.
7. AI calls `run_scenario` with the JSON's `data` map → results.

Friction ranking (worst first): **(a) data bridge**, **(b) MCP client config JSON**, **(c) Node
install**. Mitigations that shrink the list: ship as `npx @netcitizen/retirement-mcp` (kills step 2,
softens 3); a Claude Desktop **`.dxt`** one-click extension (collapses steps 2-4 into a double-click);
a **"Copy scenario for AI" button** on the page that puts the scenario JSON on the clipboard (kills the
step-5 download-and-attach dance — customer clicks once, pastes into chat).

### Engine-distribution decision — pick one of A / B / C (OPEN)

How the engine code reaches the customer and where it runs. The engine is only **3 files** in load
order — `displayhelpers.js` → `taxengine.js` → `optimizer_core.js` (~5.7k lines), wired by globals
(`optimizer_core.js` reaches `calculateTaxes`/`RMD_TABLE` etc. as bare globals; no `require()` between
them) — **not** the whole repo, the UI, or the HTML. A customer never needs a full source checkout.

- **A. Published npm package + `npx` — pinned, local stdio (recommended v1).** Bundle the 3 engine
  files into a package on npm; customer runs `npx @netcitizen/retirement-mcp`, `npx` fetches from the
  registry on demand and caches. No git clone, no manual files, no "keep source updated" chore.
  **Engine is pinned to the published release** — a feature, not a bug: financial analysis stays
  reproducible, formulas cannot silently shift between two runs of the same plan. Republish → next
  `@latest` run pulls it. Build = **P55e**.
- **B. Runtime-fetch the live engine — always-fresh, local stdio (optional).** A tiny stub `fetch`es
  the 3 `.js` from `tools.netcitizen.us` at startup and evaluates them in a `vm` context with an
  injected `module`/globals (clean *because* they are classic scripts with the dual-export guard).
  Zero staleness — always exactly matches the live site. Cost: it is remote-code-eval (same trust
  boundary as visiting the site — identical origin, identical code the browser runs — but corporate
  proxy/AV may block it, and it needs SRI hashes or version pinning so a compromised host cannot feed a
  headless, CSP-less process). Build = **P55h**. Note: for a calculator you *usually want A's pinning*,
  not B; offer B only if "must match live" is a hard requirement.
- **C. Hosted connector — no local anything (v2, most customer-friendly, most owner work).** The engine
  runs on owner infra; the customer adds one connector URL to their AI client — no Node, no files,
  ~3 steps total, and it works on iPad/Chromebook where A and B cannot. Cost lands entirely on the
  owner: the site is static today, so this is a new always-on service to build, host, secure and keep
  in sync. Full build-out below. Build = **P55i**.

**Not-MCP aside (do not build):** a browser-extension route (Claude-in-Chrome / computer-use) makes the
data bridge *free* — the AI reads the live page the customer already has open — but it is vendor-tied,
scrapes the DOM instead of a typed tool schema, and cannot batch headless. Note it; build none of it.

### Option C (hosted connector) — what it takes

The engine is pure DOM-free arithmetic, so it ports to a server cleanly; the work is transport,
hosting, and running a public endpoint safely.

1. **Transport/protocol** — MCP over **Streamable HTTP** (SSE), not stdio. Stand up the MCP server with
   the JS SDK's HTTP transport at e.g. `https://mcp.netcitizen.us/` (or an `/mcp` path). Implement
   `initialize` + capabilities + `tools/list` + `tools/call` for the same tool set as P55b.
2. **Hosting** — the site is static (no server today), so this is net-new. Best fit: **Cloudflare
   Workers** — the engine is pure JS with no filesystem, and Workers already front the domain. Confirm
   the engine touches **no Node-only APIs** first (likely clean; it is arithmetic). Alternative: a small
   Node service on Fly.io/Render/VPS if a Worker's CPU-time cap is too tight for the full optimizer
   sweep (~1.3s).
3. **Server-side engine load + version sync** — bundle the same 3 files into the worker/service from the
   **same repo**, so a site release and the connector deploy from one source and cannot drift. Expose an
   `engine_version` tool/field so a client can confirm it matches the customer's page (`v11.xxxx`).
4. **Stateless by default (privacy)** — hold **no** customer data; every call carries the scenario in
   the request (the exported `data` map). Do not persist scenarios, do not log request bodies (they
   contain dollar amounts). HTTPS mandatory.
5. **Auth** — public endpoint. Since it is a stateless calculator with nothing stored, **no-auth +
   per-IP rate limiting + payload-size caps** is likely enough for v1; MCP OAuth2 / an API key is the
   heavier option if usage must be gated. Decide before launch.
6. **Abuse / cost controls** — the full sweep is ~1.3s of CPU; a public endpoint running sweeps is a DoS
   and cost vector. Rate-limit per IP, cap request size, add per-call timeouts, and consider gating the
   expensive tools (`rank_strategies` / full sweep) behind a cheaper default.
7. **Hosted data bridge** — still needs the customer's scenario in the call; the **"Copy scenario for
   AI"** button (P55d) covers it. *Optional advanced:* a one-time handoff token (page POSTs scenario →
   short-lived token → AI fetches by token) removes the copy step but adds a store, PII surface, and
   expiry logic — **defer**.
8. **Ops** — managed TLS, a health endpoint, monitoring, and a deploy pipeline tied to the site's
   release train so engine versions never diverge.
9. **Client onboarding** — customer adds the URL via Claude Desktop "Add custom connector" or
   `claude mcp add --transport http <url>`. Document it in the P55f runbook.
10. **Disclaimer/ToS** — a public financial-calc endpoint should carry the site's "not advice"
    disclaimer and a usage notice.

### Tasks

- [ ] **P55a** — Refactor `getInputs()` into a **pure `mapFieldsToInputs(fieldMap)`** (no DOM) plus a
  thin DOM reader that gathers the field map and calls it. Single source of truth so the browser and
  the MCP server never drift on dollar-parsing / checkbox / derived-field logic. Prereq for P55b.
- [ ] **P55b** — `optimizer_mcp.js` (stdio server): `require('./optimizer_core.js')` +
  `./taxengine.js` + the pure mapper. Tools: `run_scenario`, `optimize_spend`, `suggest_spend_menu`,
  `rank_strategies` (the "Optimize for" objectives), `analyze_conversion` (break-even / stop-year /
  optimal amount), `calculate_taxes` + `irmaa`.
- [ ] **P55c** — Tool input schema derived from **one shared defaults object**, not hand-maintained, so
  it cannot drift from the engine's real params.
- [ ] **P55d** — Page affordance: **"Copy scenario for AI"** button (clipboard JSON) to remove the
  export-file bridge friction. Nerdknob-gate first if unsure; small, high-leverage UX win.
- [ ] **P55e** — **Option A:** publish the 3-file engine bundle to npm; `npx @netcitizen/retirement-mcp`
  entry point and/or a Claude Desktop `.dxt` one-click extension. Pinned engine version. The v1 default.
- [ ] **P55f** — Customer-facing runbook: "connect your AI to the retirement optimizer" (install,
  config, export-and-run). Cover whichever of A/B/C ship. Link from README.
- [ ] **P55g** — Parity test in the node harness: MCP `run_scenario(exportedJson.data)` output ==
  direct `simulate(getInputs-equivalent)` output, so the tool and the page can never silently diverge.
- [ ] **P55h** — **Option B (optional):** runtime-fetch stub — `fetch` the 3 `.js` from
  `tools.netcitizen.us` at startup, eval in a `vm` context with injected `module`/globals, grab exports.
  Add SRI-hash/version pinning so a compromised host cannot inject code. Ship only if "always match
  live" is required; A's pinning is the safer default.
- [ ] **P55i** — **Option C (v2):** hosted MCP connector — Streamable-HTTP server, Cloudflare Worker (or
  small Node service) hosting the same engine bundle, stateless/no-stored-data, HTTPS, per-IP
  rate-limit + payload caps + sweep timeouts, `engine_version` reporting, deploy pipeline tied to the
  site release, "Add custom connector" onboarding, "not advice" disclaimer. See the Option C build-out
  above. Biggest owner effort; only path that works on iPad/Chromebook.

**Risks:** field-map drift between `getInputs()` and the mapper (P55a kills it); scenario `version`
skew (importer already warns, `optimizer_ui.js:4525`); customers on iPad/Chromebook cannot run a local
Node server at all — for them only the hosted-connector or browser-extension routes work.

**Status:** OPEN, unprioritized. Engine is ready. Open decision: **distribution A / B / C** (A =
pinned `npx` package, recommended v1; B = runtime-fetch live engine, optional; C = hosted connector,
v2, most owner work but only path for iPad/Chromebook), and whether P55d ships with v1. A and C are not
exclusive — A for v1, C later for no-install customers.

---

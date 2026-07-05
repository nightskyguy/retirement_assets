# Task Plan: Retirement Optimizer — Remaining Work

Goal: Complete open features from the original priority list plus deferred items from the UX batch. All completed phases archived in `task_completed.md`.

**As of:** 2026-07-02 (v11.1125, branch main, worktree cranky-mcclintock-9fa806)

---

## Priority Order (rough)

| # | Phase | Description | Status | Blocked by |
|---|-------|-------------|--------|-----------|
| — | **P1** | Suggest Spend Goal (38#10) | **complete** | — |
| 1 | **P2** | Cash Reserve enforcement (38#9) | pending | — |
| 2 | **PA** | Pension Start Age | **complete** | — |
| 3 | **PB** | Lumpy Spending (no URL encoding) | pending | — |
| 4 | **PC** | Auto-Persist + Restore Offer | pending | — |
| 5 | **P4** | Creeping Tax Rate Model | pending | — |
| 6 | **P5** | Conversion Schedule — Greedy DP (23b) | pending | — |
| 7 | **P6** | Simulation Sanity-Check Tests | pending | — |
| 8 | **PD** | Onboarding Interview (replaces P7 stepper) | pending | — |
| 9 | **PE** | Insights / Feedback Panel | pending | — |
| 10 | **P8** | Annual-table View Presets (38#6) | pending | — |
| 11 | **P9** | ACA Refinement (remainder) | partial | — |
| 12 | **P10** | Upgrade Equity Data (Fama-French) | pending | — |
| 13 | **P11** | RealReturns — Intl Asset + Annual Mode | pending | — |
| 14 | **P12** | Retire Optimizer Tab → MC Strategy Compare | pending | — |
| 15 | **P13** | Multi-Strategy Segment Optimizer | pending | P9 |
| 16 | **P14** | Regime-Switching MC | pending | — |
| 17 | **P15** | Refactoring Remainder (R1b, R3, R4) | pending | — |
| 18 | **P16** | Responsive Layout (all tools) | pending | — |
| 19 | **P17** | Retirement_Projection — Simple Mode | pending | — |
| 20 | **P18** | Retirement_Projection → RetirementTaxPlanner link | pending | — |
| 21 | **P19** | taxengine.js Architectural Cleanup | pending | — |

---

## Phase P1: Suggest After-Tax Spend Goal (was 38#10)
- **Status:** complete — `computeSuggestedSpend()`, `applySuggestSpend()`, `#suggest-spend-icon` all implemented in core.js:5453–5502. Toggle button beside spend goal; shows suggested $, restores prior goal on second click.

---

## Phase PA: Pension Start Age
**Why:** `#pensionAnnual` flows from retirement year 1 with no age gate. Users with deferred pensions (e.g., a pension that starts at 65 while retiring at 60) can't model the gap.

**Code pattern:** Mirror SS age gate at `core.js:996–997`. Existing pension line at ~1000:
```javascript
// current:
let pension = inputs.pensionAnnual * (inputs.pensionCola ? inflation : 1);
// new:
let pension = (age1 >= inputs.pensionStartAge)
    ? inputs.pensionAnnual * (inputs.pensionCola ? inflation : 1)
    : 0;
```

- [ ] Add `#pensionStartAge` input (number, default blank = startAge) near `#pensionAnnual` in HTML
- [ ] `readInputs()`: `pensionStartAge: +val('pensionStartAge') || inputs.startAge`
- [ ] `simulate()` ~line 1000: apply age gate as above
- [ ] `computeSuggestedSpend()` (core.js:5453): only include pension in guarantee income if `currentAge >= pensionStartAge`
- [ ] URL alias: add `psa` → `pensionStartAge` in `OPT_SHORT_TO_LONG` map (~line 4571)
- [ ] Survivor logic at line 1011 applies after age gate — no change needed
- [ ] Test: `pensionStartAge=65`, `startAge=60` → pension=0 years 60–64, full pension from 65
- **Status:** pending
- **Independent:** no phase dependencies

---

## Phase PB: Lumpy Spending — No URL Encoding (replaces P3 spec)
**Why:** Users have one-time/irregular expenses (renovation, car, medical). Current P3 plan included URL encoding; user revised: not needed. Store in memory + named scenarios + auto-persist only.

**Storage:** Global `let lumpyEvents = []` — array of `{year, amount, label}`. Included in `saveScenario()` / auto-persist; NOT URL-encoded.

- [ ] Global `lumpyEvents = []` init in html
- [ ] UI: collapsible sub-section near `#spendGoal` — repeating rows (year number, amount $, label text, × remove). "Add expense" appends row; each row triggers `recalc()` on change
- [ ] `simulate()` year loop: `const lumpyThisYear = lumpyEvents.filter(e=>e.year===currentYear).reduce((s,e)=>s+e.amount,0); const yearSpendGoal = inputs.spendGoal + lumpyThisYear;` — use `yearSpendGoal` in withdrawal/gap logic for that year
- [ ] Annual Details: `lumpySpend` log field (0 in non-lumpy years; existing all-zero column hiding applies)
- [ ] `saveScenario()` (~core.js:4854): include `lumpyEvents` in scenario object before stringify
- [ ] `restoreScenario()`: restore `lumpyEvents` and rebuild UI rows
- [ ] Phase PC auto-persist: include `lumpyEvents` in autosave payload
- [ ] Test: add `{year:2028, amount:15000}` → Annual Details shows lumpySpend=15000 in 2028; save/reload scenario preserves it
- **Status:** pending
- **Independent:** no phase dependencies

---

## Phase PC: Auto-Persist + Restore Offer
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

- [ ] Add `AUTOSAVE_KEY` constant
- [ ] `autoSaveState()`: iterate all form elements with IDs, collect values + lumpyEvents + timestamp; `localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload))`
- [ ] Debounce 600ms: `document.addEventListener('input', debouncedAutoSave)` after init
- [ ] On page load: check for autosave + offer restore logic
- [ ] Restore banner HTML + show/hide logic
- [ ] `applyAutoSave(saved)`: sets element values + lumpyEvents + triggers recalc
- [ ] `restoreScenario()` (named scenario load) also triggers `autoSaveState()` so named-scenario state becomes new autosave baseline
- [ ] Test: change any input → 600ms → check localStorage has autosave; reload clean (no URL) → banner appears; Restore → inputs match; Dismiss → no re-offer on next reload
- **Status:** pending
- **Independent:** no phase dependencies; PB (lumpy) should ship first so lumpy is included in autosave

---

## Phase PD: Onboarding Interview (replaces P7 stepper concept)
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

- [ ] HTML: modal markup `#onboarding-modal` (hidden) with 3 screen divs
- [ ] Goal checkboxes + screen navigation (Next/Back/Skip)
- [ ] Screen 3 suggestion map: JS object `{goalId → bullet string}`
- [ ] Quick numbers → pre-populate specific input IDs on Finish
- [ ] `showOnboarding()`, `onboardingNext()`, `onboardingFinish()` functions
- [ ] "New Plan" button in sidebar header area
- [ ] `localStorage` gate: show on first visit; set on Finish
- [ ] Test: clear `optimizer_onboarded` → modal shows; select goals → Screen 3 shows matching bullets; Finish → inputs pre-filled; reload → no modal
- **Status:** pending (concept revised 2026-06-29)
- **Independent:** no phase dependencies

---

## Phase PE: Insights / Feedback Panel
**Why:** Users get numbers but no interpretation. A dedicated panel that reads simulation results and surfaces conditions the user should know about (RMD risk, longevity, survivor impact, Roth effectiveness) closes the "so what?" gap.

**Existing placeholder:** `#tab-insight` exists with empty `#insights-table` in `retirement_optimizer.html:711–719`. No code populates it.

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

- [ ] `computeInsights(totals, log, inputs)` function in core.js — evaluate all 6 rules; return non-null insights only
- [ ] `renderInsights(insights)` — flex card grid in `#tab-insight`; each card: severity icon + title + body + suggestion (smaller)
- [ ] Replace `#insights-table` markup with card container div
- [ ] Wire call in `runSimulation()` after `updateStats()`
- [ ] Empty state when no simulation run yet
- [ ] Test: large IRA ($2M) → rmd-growth insight appears; plan that depletes → longevity-fail alert; hasSpouse=false → no survivor card
- **Status:** pending
- **Independent:** no phase dependencies; reads from existing `totals` + `log` data

---

## Phase P2: Cash Reserve Enforcement (was 38#9)
**Why:** `CashReserve` input captured in `core.js` but never enforced. Reserve = portion of Cash balance (not additional funds); breakable hard floor of last resort; refill from surplus years.

**Design decision (made in Phase 38 session):**
- Effective drawable Cash = `max(0, Cash − CashReserve)` in normal years
- Last-resort: can break below reserve (flag year with `cashBreach=true`)
- Surplus years: reinvest into Cash until `Cash ≥ CashReserve`

- [ ] Read `core.js` around CashReserve capture (line ~1923) and withdrawal routing block
- [ ] Apply `effectiveCash = max(0, Cash − cashReserve)` in withdrawal candidate calculation
- [ ] Last-resort: if all accounts near zero AND spend unfunded, allow drawing from reserve; log `cashBreach=true`
- [ ] Surplus refill: if `surplus.Cash > 0 && Cash < cashReserve`, route surplus to fill reserve first
- [ ] Annual Details: add `cashBreach` flag column (Debug category)
- [ ] Test: CashReserve=$50k, Cash=$60k → only $10k drawable normally
- [ ] Test: fully depleted scenario → reserve breakable as last resort
- **Status:** pending

---

## Phase P3: Lumpy Spending (Priority H)
**Why:** Users have one-time expenses (home renovation, car, etc.). No current mechanism.

- [ ] Add per-year spending override table in sidebar (year → extra amount)
- [ ] Small repeating-row input (year, amount, label) with add/remove buttons
- [ ] `simulate()`: each year, `spendGoal += lumpySpending[y] ?? 0`
- [ ] Annual Details: `lumpySpend` column
- [ ] URL encoding: compact array format (e.g. `ls=2028:15000,2032:8000`)
- [ ] Test: lumpy year withdraws correct additional amount; non-lumpy years unaffected
- **Status:** pending
- **Independent:** no phase dependencies

---

## Phase P4: Creeping Tax Rate Model (was Phase 29)
**Why:** Tool assumes today's brackets persist forever. Future rate increases plausible. TCJA is now permanent but Congress can change rates. Default: off.

**Two options:**

**A. Rate Escalation:** input `taxRateEscalation` (% per year) + `taxEscalationStartYear`. Applies rate multiplier `(1+escalation)^max(0,year−startYear)` to all bracket rates in `calculateTaxes()`.

**B. Pre-TCJA Cliff:** `taxRateChangeYear` → swap to `BRACKETS_PRE_TCJA` (25/28/33/35/39.6%) at that year. Label: "Pre-TCJA rates (hypothetical stress test)" — NOT "TCJA expiration" since TCJA is permanent.

- [ ] Add `BRACKETS_PRE_TCJA` constant (25/28/33/35/39.6 + MFJ thresholds)
- [ ] Inputs: `taxRateEscalation`, `taxEscalationStartYear`, `taxRateChangeYear` (all default 0 = off)
- [ ] `calculateTaxes()`: apply rate multiplier and/or bracket swap per year
- [ ] Annual Details: `taxRateMult` column (Debug/Tax Policy category)
- [ ] Test: escalation=0 → bit-identical to current (regression)
- [ ] Test: pre-TCJA switch year set → taxes jump matching pre-TCJA bracket rates
- [ ] Test: escalation=1%/yr × 20 yrs → 22% bracket becomes ~26.8%
- **Status:** pending
- **Independent:** modifies `calculateTaxes()` which is already isolated

---

## Phase P5: Greedy DP Conversion Schedule (was Phase 23b)
**Why:** Phase 23 implemented `optimizeConversionAmount()` as a scalar sweep. Per-year optimal conversion schedule (greedy DP) is deferred.

**Core algorithm:**
For each year t from retirement to max(RMD ages):
1. Sweep `extraConversionAmount` from $0 to totalIRA in $10k steps
2. Lock in optimal C_t; advance year t+1 with updated state
3. Result: `convSchedule[y]` array

**Output:** Annual Details `convSchedule` column + optimizer table "Conv $/yr" column.

**MC Stage 2 (stretch):** Top-K strategies with their locked schedules → 500 MC paths each → add MC Survival column to optimizer.

- [ ] Implement `buildConversionSchedule(baseInputs, overrides)` — greedy DP year-by-year
- [ ] `buildVariations()`: when `includeConvOpt` set, use schedule (not scalar) for optimized rows
- [ ] Optimizer table: "Conv $/yr" column (avg), "Conv Savings $" column
- [ ] Annual Details: `convSched` column (Opp. Cost category)
- [ ] Test: greedy DP schedule tapers toward $0 near RMD onset (sanity check)
- [ ] Test: schedule rows beat scalar optimizer on same inputs (if not identical)
- **Status:** pending
- **Depends on:** Phase 23 ✓ (scaffold in place)

---

## Phase P6: Simulation Sanity-Check Tests (was Phase 25)
**Why:** Complex simulation accumulates subtle math errors. Deterministic edge cases with known exact answers expose regressions.

Tests go in `retirement_optimizer_core.test.js`. Helper: `makeZeroBaseInputs()` — zeroed growth/inflation/taxes, single account.

| Test | Setup | Expected |
|------|-------|----------|
| Linear depletion | growth=0, inflation=0, Roth-only $1M, spend $50k | Depletes year 20; netSpend%=5% each year |
| SS covers all spend | SS=$60k, spend=$50k, zero portfolio | Portfolio unchanged; wdRate≤0 |
| Roth conv identity | extraConvAmount=$X, growth=0, inflation=0 | `rothConv` sums to X×years; IRA reduced by gross conv |
| RMD accuracy | IRA=$1M at age 73, zero growth | First RMD = $1M ÷ 26.5 ± $1 |
| Surplus reinvestment | income > spendGoal | surplusCash > 0; total wealth increases |

- [ ] Add `makeZeroBaseInputs()` helper
- [ ] Implement 5 sanity tests listed above
- [ ] Run full node test suite; target zero failures
- **Status:** pending
- **Independent:** uses existing `simulate()` interface

---

## Phase P7: Onboarding Stepper (was 38#5)
**Why:** First-time users have no guidance on the 4 sidebar sections.

**Design:** First-run dismissible "Start here" stepper overlay covering the 4 sidebar sections sequentially. Persist "seen" in `localStorage` under key `optimizer_onboarded`. Dismiss button + "Don't show again" checkbox.

- [ ] Build stepper modal/overlay: 4 steps (Assumptions, Accounts, Strategy, Results)
- [ ] Show on first load if `localStorage.optimizer_onboarded` not set
- [ ] "Next" / "Skip all" / "Don't show again" controls
- [ ] Set `localStorage.optimizer_onboarded = '1'` on complete or skip
- [ ] Test: localStorage key absent → stepper shows; key present → no stepper
- **Status:** pending
- **Lower priority** — nice-to-have after core features ship

---

## Phase P8: Annual-Table View Presets (was 38#6)
**Why:** Current checkbox method for showing/hiding Annual Details columns is cumbersome. User wants navigable presets.

**Decision from Phase 38:** Keep checkbox method for now; redesign to be more navigable. No concrete design yet.

- [ ] Design preset groups (e.g., "Tax View", "Income View", "Conversion View") as button tabs above the column checkboxes
- [ ] Each preset activates its checkbox group; user can then fine-tune
- [ ] Persist selected preset to URL hash
- **Status:** pending (design phase — implement after P1–P6 ship)

---

## Phase P9: ACA Refinement Remainder (partial, was Phase 9)
**Why:** Age-gate UI done (v?). Optimizer/MC gating + MAGI/subsidy calculation not yet done.

**What's done:** `updateACAWarning()` — disables ACA options + shows `#aca-age-warn` when both ≥65.

**What's pending:**
- [ ] Optimizer: skip ACA strategy rows when both persons ≥65 at retirement start
- [ ] MC: pass age-gate flag through; don't evaluate ACA strategy past Medicare age
- [ ] ACA MAGI calculation: estimate silver-plan premium, subsidy cliff, net premium; show in Annual Details
- [ ] Annual Details: `acaSubsidy`, `acaPremium` columns when ACA strategy active
- [ ] Test: both ≥65 → ACA rows absent from optimizer table
- [ ] Test: mixed ages → ACA rows present only for pre-65 segment
- **Status:** partial
- **Depends on:** Phase 1 ✓
- **Blocks:** Phase P13 (multi-strategy segment optimizer needs clean ACA handling)

---

## Phase P10: Upgrade Equity Data — S&P 500 → Fama-French Total Market (was Phase 17)
**Why:** Current `equity` array = Damodaran S&P 500 proxy (large-cap only). Fama-French Market Portfolio (`Mkt-RF + RF`) covers all NYSE/AMEX/NASDAQ stocks 1926–present. Small-cap premium historically ~1–2%/yr higher.

**Decision:** Add as selectable toggle — keep both, let user compare. Default: S&P 500 (preserve existing behavior).

- [ ] Download `F-F_Research_Data_Factors_annual.CSV` from Ken French's data library (1926–2024)
- [ ] Compute annual total return = `(1 + Mkt-RF/100) × (1 + RF/100) − 1` for each year
- [ ] Add `equityFF` array to `historical_returns.js` alongside existing `equity`
- [ ] Add equity-source toggle in nerd panel: "S&P 500 (Damodaran)" | "Total Market (Fama-French)"
- [ ] Worker/prng: use `HISTORICAL_RETURNS.equityFF` when FF mode selected
- [ ] MC metrics panel: label equity series by source name
- [ ] Update tests: both modes produce plausible CAGR ranges (FF slightly higher)
- **Status:** pending
- **Depends on:** Phase 7 ✓; Phase 18 ✓ (fan chart makes comparison useful)

---

## Phase P11: RealReturns — Intl Asset + Annual Returns Mode (was Phases 34 + 35)

### Part A: International Equity Asset (was Phase 34)
`HISTORICAL_RETURNS.intl` (MSCI EAFE, 1970–2024) already in codebase but not wired into `RealReturns.html`. Add as 5th selectable asset.
- [ ] Add 2025 intl data point to `historical_returns.js`
- [ ] Wire `intl` into `RealReturns.html`: `computeSeries()`, stat cards, legend, custom mix allocation, URL (`iso=4`)
- [ ] Cap start-year slider at 1970 when intl visible (or render null for pre-1970)
- TIPS and BND deferred — require external data sourcing, short history.

### Part B: Annual Real Returns Mode (was Phase 35)
`annualData[]` already stores per-year real returns. Toggle: Cumulative | Annual. Annual mode switches to bar chart showing real-return % per year.
- [ ] Add `viewMode` state (`'cumulative'` | `'annual'`); `md=ann` URL param
- [ ] Add Mode toggle button group alongside Log/Linear
- [ ] `switchMode()`: rebuild chart datasets and y-axis (% linear for annual, $k log for cumulative)
- [ ] Annual mode: bars colored green (positive) / red (negative)
- [ ] Stat cards unchanged in both modes
- **Status:** pending (both parts)

---

## Phase P12: Retire Optimizer Tab → MC Strategy Comparison (was Phase 26)
**Why:** Deterministic optimizer crowns a winner that may be fragile. MC gives the honest answer: survival %, median/p10 outcomes. Goal: replace optimizer with MC strategy sweep.

**Proposed approach:**
1. Add "Compare strategies" mode to MC tab: runs top 5–6 strategies through full MC (same 500 paths)
2. Comparison table: strategy | survival % | median final wealth | p10 wealth | median lifetime tax
3. Gate existing optimizer behind `?optimizer=1` URL param
4. After MC comparison ships and validated, remove optimizer code

**What to keep from optimizer:** `getOptimizerColumns()` + `buildVariations()` feed the MC sweep. `optimizeConversionAmount()` hooks into MC mode. Infeasibility detection → inline strategy selector warnings.

- [ ] Design MC comparison table: which strategies, how to surface winner
- [ ] Add "Compare in MC" mode to `mc_tab.js` running top-N strategies
- [ ] Move bracket feedback to main strategy selector
- [ ] Gate optimizer tab behind `?optimizer=1`
- [ ] Update docs: remove optimizer section, explain MC comparison
- [ ] Test: MC comparison ranks strategies consistently with intuition
- **Status:** pending — pre-design
- **Note:** Deprioritizes Phase 5 (Scenario Comparison) and Phase 8 (Sensitivity Grid) — likely superseded by this.

---

## Phase P13: Multi-Strategy Segment Optimizer (was Phase 10)
**Why:** Optimal plan may switch strategies mid-retirement. Natural breakpoints: retirement start, age 65 (Medicare), age 73 (RMDs).

**Architecture:**
- 3 segments × ~42 strategies → ~74k combos max; filter invalid → ~10k realistic
- Add timing dimension (4 options per segment): 4 × 10k = ~40k Stage 1 evals
- Stage 1: deterministic sweep → pick top-K (10)
- Stage 2: full MC (500 paths) on top-K only

- [ ] Modify `simulate()` to accept `strategySequence[]` (strategy per segment)
- [ ] Define natural breakpoints from user inputs
- [ ] Filter invalid strategy-segment combos (P9 age-gating feeds here)
- [ ] Stage 1 Cartesian sweep; score each combo
- [ ] Stage 2 MC on top-K; rank by median / p10 survival
- [ ] Surface top-N composite strategies with "Phases" column
- [ ] Test: ACA strategy never in post-65 segments
- [ ] Test: top combo beats any single-strategy result
- **Status:** pending
- **Depends on:** Phase P9 (ACA age-gating)

---

## Phase P14: Regime-Switching MC (BootstrapPlan Phase 3)
**Why:** Markets trend (bull/bear persistence). Regime-switching captures this without requiring historical data.

2-state Markov model:
- Bull: μ=+14%, σ=11%
- Bear: μ=−8%, σ=22%
- Transition probabilities calibrated to historical bull/bear run lengths

- [ ] Implement 2-state Markov model in `montecarlo/prng.js`
- [ ] Add as third simulation mode option in nerd panel (alongside GBM and Bootstrap)
- [ ] Test: regime persistence produces realistic multi-year trends (no single-year reversals every year)
- **Status:** pending
- **Depends on:** Phase 2 ✓ (bootstrap framework)

---

## Phase P15: Structural Refactoring Remainder (was Phase R)
**Why:** `simulate()` still too large. `getElementById()` DOM calls in core.js violate separation of concerns. ES module migration blocked by `importScripts()`.

- [ ] **R1b:** Extract 3-pass tax+gap-fill block (~150 lines) and surplus-routing (~80 lines) from `simulate()`
- [ ] **R3:** Move ~114 `getElementById()` DOM calls from `core.js` to `displayhelpers.js`
- [ ] **R4:** ES module migration — rewrite `worker.js` `importScripts()` + test harness `vm.runInContext()` (do last)
- **Status:** pending (R1a + R2 already complete, see `task_completed.md`)

---

## Phase P16: Responsive Layout — All Tools (was Phase 16)
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

- [ ] Audit each tool at 375px / 768px / 1440px
- [ ] Apply fluid sidebar + breakpoints per tool
- [ ] Tables: `width: fit-content; max-width: 100%` + `overflow-x: auto` wrapper
- [ ] Re-test all tools at 3 breakpoints after changes
- **Status:** pending
- **Note:** Phase 13 (Retirement_Projection responsive) is a subset — execute together.

---

## Phase P17: Retirement_Projection — Simple Mode (was Phase 14)
**Why:** Tool has too many controls for basic use-case. `IRA_Projection` was removed; need lightweight replacement.

**Simple mode:** Single account (IRA/Roth/Brokerage), balance + growth + years + withdrawal → chart. "Simple / Advanced" toggle in header (persisted to URL hash).

- [ ] Add "Simple / Advanced" toggle
- [ ] Simple mode hides: SS section, second spouse, IRMAA details, brokerage tax details, threshold editor, most metrics
- [ ] Simple mode shows: account balance, growth rate, withdrawal, projection chart, 3 key metrics
- [ ] Test: Simple mode same numbers as Advanced with equivalent single-account inputs
- **Status:** pending

---

## Phase P18: Retirement_Projection → RetirementTaxPlanner Link (was Phase 15)
**Why:** User wants to click a year row and open RetirementTaxPlanner pre-populated with that year's values.

- [ ] Identify RetirementTaxPlanner.html URL params (AGI, filing status, SS income, age)
- [ ] Add clickable year column to projection table (or row click handler)
- [ ] On click: build URL with year's key values → open in new tab
- [ ] Add row hover affordance (link cursor + subtle highlight)
- [ ] Test: clicking year opens RetirementTaxPlanner with correct pre-filled values
- **Status:** pending
- **Depends on:** understanding RetirementTaxPlanner.html's existing URL param schema

---

## Phase P19: taxengine.js Architectural Cleanup
**Why:** A full review of taxengine.js (2026-07-02, see `~/.claude/plans/review-taxengine-js-for-1-groovy-balloon.md`) found the circular core.js↔taxengine.js dependency — **fixed same session**: `getRateBracket`, `findLimitByRate`, `findUpperLimitByAmount`, `calculateProgressive` moved from core.js into taxengine.js (new "Bracket utilities" section right after `RMD_TABLE`), so taxengine.js no longer depends on core.js while core.js still depends on taxengine.js (one-directional now). Also fixed as part of that pass: dead `Retirement_Projection.html` polyfill removed (it now transparently uses the real taxengine.js functions), 5 low-risk comment/dead-code fixes in taxengine.js, and a live CPI-inflation-drift bug in `Retirement_Projection.html` (AL/MT/ND/OH/SC brackets were incorrectly inflating). node 51/51 + browser 240/240 verified after each change. The items below are the findings from that review NOT yet addressed.

- [ ] **Bracket-walk consolidation:** taxengine.js has 3 hand-rolled bracket-walk loops (capital gains split in `calculateTaxes()`; IRMAA tier lookup in `getIRMAATier()`; IRMAA target-tier lookup in `getIRMAATierTargetMAGI()`) doing the same "iterate brackets, compare against inflated threshold" pattern — and now that the relocated `getRateBracket`/`findLimitByRate`/`findUpperLimitByAmount`/`calculateProgressive` live in the same file, there are 6 near-duplicate bracket-walk variants in one place. Extract one shared `findBracketIndex(brackets, amount, multiplier)` helper.
- [ ] **Return-object alias cleanup:** `calculateTaxes()` returns several fields under two names with no differentiation — `stateTax`/`state`, `irmaaMagi`/`MAGI`, `federalMarginalRate`/`fedRate`, `stateMarginalRate`/`stRate`. Needs a consumer audit (which callers use which name) before consolidating — don't remove a name a consumer still reads.
- [ ] **Unify `computeIrmaaInline()` with `calcIRMAA()`:** `Retirement_Projection.html`'s `computeIrmaaInline()` is a from-scratch reimplementation of `calcIRMAA()`, not a fallback — it's the only IRMAA path that file ever uses. It lacks the `onMedicareCount` per-spouse Medicare-age-gating parameter added to `calcIRMAA()` in the v11.1124 IRMAA work, so that tool's IRMAA display silently doesn't reflect that feature. Needs a decision: thread the birth-year/age data `computeIrmaaInline`'s caller already has (`project()` already takes `birthYearIn`/`spouseBirthYearIn`) into a direct `calcIRMAA()` call and delete `computeIrmaaInline()` entirely.
- [ ] **`irmaa_and_rmds.html` duplicate bracket math:** reads `TAXData.SOCIALSECURITY`/`TAXData.IRMAA`/`RMD_TABLE` directly and re-implements its own bracket-walk instead of calling `calcIRMAA()`/`getIRMAATier()`/the relocated bracket utilities. Lower risk than the Retirement_Projection.html case (simpler logic, no `INFLATION_INDEXED` interaction) but same pattern — worth revisiting once the bracket-walk consolidation above exists to call into.
- [ ] **Script load-order normalization (cosmetic, optional):** `taxengine.js` is now the base layer with zero dependencies and `core.js` depends on it — the "correct" load order is taxengine.js first. `IncomeTaxPlanner.html` and the test/worker harnesses already do this; `retirement_optimizer.html` loads `core.js` before `taxengine.js` (works fine due to hoisting, confirmed safe, but backwards from the dependency direction). Low priority — reorder only if touching that file's `<script>` block for another reason.
- [ ] **State coverage (13 of 51 jurisdictions uncoded):** LA/UT (flat, easy). 11 graduated states (AR/DE/HI/KS/MO/NJ/NM/OK/RI/VT/WV) — MO/WV need year-keyed rate tables (active phase-downs, same pattern as GA/NE/KY); AR/DE/MO/NJ/NM/RI/VT/WV need per-state partial-SS-taxation thresholds; NJ needs a >$1M surtax bracket; VT needs a low-income exemption rule. RI/VT CPI-indexing is actually free (already the default). See the review plan file for the full per-state breakdown.
- **Status:** pending (circular-dependency fix and 5 low-risk items already shipped this session, uncommitted)
- **Independent:** no phase dependencies for the remaining items

---

## Dependency Graph (remaining)

```
P1 (Suggest Spend) — independent
P2 (Cash Reserve) — independent
P3 (Lumpy Spending) — independent
P4 (Creeping Tax) — independent
P5 (Conv Schedule DP) — needs Phase 23 ✓
P6 (Tests) — independent
P7 (Onboarding) — independent
P8 (Table Presets) — independent
P9 (ACA remainder) — needs Phase 1 ✓
  └─→ P13 (Multi-Strategy)
P10 (Fama-French) — independent
P11 (RealReturns) — independent
P12 (MC Strategy Compare) — independent; supersedes Phases 5,8
P14 (Regime-Switching) — needs Phase 2 ✓
P15 (Refactoring) — independent
P16 (Responsive) — independent
P17 (Simple Mode) — independent
P18 (RP→RTP Link) — independent
```

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Phase 8 (Variable Growth grid) superseded | Bootstrap MC + Stress mode cover the use case |
| Phase 10 (Multi-Strategy) deprioritized | Phase 23 conversion optimizer covers conversion dimension; Phase P13 for spending segments later |
| Phase 12 (Timing) auto-implementation | Auto early/late beat manual toggle; shipped without updating individual status block |
| Baseline = best no-conv no-cyclic row | Avoids IRA-hoarding strategies winning on raw NW; spendable-weighted score in Phase 37 |
| GK uses raw portfolio balance for IWR/WR | Avoids CA-tax apples-vs-oranges mismatch that caused spurious CP triggers |
| Cash Reserve = portion of Cash (not addl) | Reserve already inside Cash balance; breakable last-resort floor; refill from surplus |
| Annual-table presets: redesign pending | Current checkbox method kept until navigable design decided |
| TCJA is now permanent | Pre-TCJA scenario in P4 is hypothetical stress test, not expected event; default off |

## Known TODOs (verify in code before assuming incomplete)
- Roth1/Roth2 columns may be missing from Annual Details (column-registration class of bug)
- IRMAA surcharge may not render as Annual-table column

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | — | — |

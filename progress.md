# Progress Log

## Session: 2026-06-23 — Phase 33: Inflation-Aware Stress Test Scoring

Stress mode was scoring worst decades by 10-year equity CAGR alone, missing the compounding effect of inflation. A decade with flat equity (+0% CAGR) but 7% inflation is retiree-devastating (real −7%), yet ranked better than it should. Fisher equation fixes this.

- **montecarlo/prng.js `buildStressBank()`:**
  - Changed scoring from nominal equity CAGR → real CAGR via Fisher equation: `rcagr = (1 + eqCagr) / (1 + Math.max(-0.005, infCagr)) − 1`
  - Deflation floor (−0.5%) excludes only 1930s extremes; preserves modern modest deflation (2009 etc)
  - Labels now 3-part format: `"1970 (eq: +6.0% inf: +7.0% real: -1.0%)"` instead of just year
  - Added `decadeRealCAGRs[]` to return object (mirrors existing `decadeInflCAGRs`)
  - `applyBearStartOverlay()` automatically uses new real-CAGR-based worst-sequence selection
- **Tests:** 33 pass, 0 fail (no regressions)
- **Verified:** Real CAGR scoring orders decades correctly; 1970s-era inflation peaks now rank higher in worst list
- **Status:** ready for browser verification; no changelog/version bump yet pending full testing

---

## Session: 2026-06-22 (cont.) — Phase 32: Share-URL compression + default-omission (v11.1048)

New goal (user): reduce share-URL length. Measured: number/bool compression alone ≈13%;
default-omission ≈71–100% (scales with how customized the shared scenario is). Shipped both.

- **retirement_optimizer_core.js:**
  - `compactNum(numStr)` — shortest of {raw, k, m, b, scientific} that round-trips via
    parseShorthand (self-validating, no DisplayHelpers dep → node-testable as `ctx.compactNum`).
  - `OPT_DEFAULTS` + `captureDefaults()` — pristine snapshot of all `.sidebar input/select`,
    dollars normalized via `DisplayHelpers.parseShorthand`. Single source of truth for omission.
  - `buildShareURL()` — omits any field equal to its captured default; compresses dollar fields
    (numVal) via compactNum; booleans `true`/`false` → `1`/`0`.
  - `loadFromURL()` — checkbox accepts `'1'||'true'` (new + legacy). Dollar/absent-key decode
    unchanged (attachNumericDollarInput→parseShorthand handles `k`/`m`/`b`/`1e5`; absent⇒default).
- **retirement_optimizer.html:** `captureDefaults?.()` added before `loadFromURL?.()` (fields
  still at markup defaults). Version 11.1042 → **11.1048** + changelog entry.
- **retirement_optimizer_core.test.js:** load displayhelpers.js into vm ctx; 4 compactNum
  round-trip/length/spot/edge tests. **33 pass, 0 fail** (was 29).
- **Browser-verified** (http.server :8766): default scenario share query = **0 chars** (all 61
  params omitted, 61 defaults captured); 8-field customization → `?sg=120k&str=gk&sa=62&hs=0&i1=1.5m&ro=3e5&bk=650k&g=5`
  (52 chars), reloads to exact values; legacy raw URL (`i1=1000000&hs=true&dr=false`) loads
  identically. In-page suite **212 pass, 0 fail**, no console errors (4 errors are intentional
  bad-input test fixtures).
- **Caveat (documented):** omitted fields adopt the loader's current default — a future markup
  default change would silently shift old shared URLs for that field. Keep defaults stable.

---

## Session: 2026-06-22 (cont.) — Phase R (structural refactoring)

### Worktree `jolly-swirles-091689` (base af7841a / PR #85)
Critical look at program structure → refactoring roadmap (`.claude/plans/elegant-hopping-squirrel.md`).
Four smells targeted: `simulate()` god function (1095 lines), `window.*` pollution, no module system,
mixed concerns in core.js (sim math + 114 DOM calls).

### R1a — decompose simulate() (commit 7366f1f)
- Extracted 4 functions to module level: `resolveOrderedSeq(seq, rates)`, `runOrderedWithdrawal(...)`,
  `computeYearGrowthRates(inputs, y)`, `buildSimYearLogRecord(p)` (88-line log snapshot).
- `simulate()` shrank **1095 → 987 lines**.
- Gotcha: `resolveOrderedSeq`/`runOrderedWithdrawal` were nested closures reading 6 tax-rate vars
  implicitly → now passed via explicit `rates` object. `baseReturn` still needed in loop scope for GK
  `gkPriorReturn` — caught by 4 failing GK tests, re-added.

### R2 — OptimizerState (commit 293077f)
- 6 `window.optimizer*` globals → single module-level `OptimizerState` const. Pure rename, zero
  behavior change. All refs internal to core.js (verified — no external callers).

### Compatibility vs merged PR #86 (share-URL compress)
- #86 touched core.js ~4017–4125 (`compactNum`/`buildShareURL`/`loadFromURL`); my edits ~20, 626–1751,
  2007–2889. Disjoint. Clean auto-merge (exit 0). Tests on merged tree: **33/33** (my 29 + #86's 4).

### Tests: 33 pass, 0 fail post-rebase (29 mine + 4 from #86; behavior preserved). No version bump (no user-facing change).
### Pending (Phase R): R1-remainder (tax/gap-fill + surplus extraction), R3 (DOM→displayhelpers), R4 (ES modules).

## Session: 2026-06-22

### Phase 22 (Guyton-Klinger Guardrails) — complete (v11.1042, commit 4a7fec5)

Four GK rules in `simulate()`: Inflation Rule (skip CPI when prior return < 0 AND WR > IWR),
Capital Preservation (cut 10% when WR > IWR×1.2), Prosperity (raise 10% when WR < IWR×0.8),
default inflation advance. GK uses raw portfolio balance (`gkPrevPortfolio`) not tax-discounted
`totalWealth` — key design decision to avoid CA-tax apples-vs-oranges mismatch.

Files changed: `retirement_optimizer_core.js` (+66 lines), `retirement_optimizer.html` (+29 lines),
`retirement_optimizer_core.test.js` (+61 lines).

5 new tests (all passing, 29/29 total): stable market, CP rule, Prosperity rule, Inflation skip,
regression. Tests use CA state; check years 0-2 for stable (year 3+ natural depletion can approach
upper guard). CP/Prosperity tests use -80%/+200% return sequences.

URL: `gku=20&gkl=20&gkc=10&gkr=10`. Optimizer: 3 GK variations. Annual Details: gkSpend/gkAdj.

---

## Session: 2026-06-19 (cont.)

### Phase 31 (Baseline accounting for strategy comparison) — complete (v11.1000)

User concern: strategy comparison lacked a sound reference. "Strategy A beats B" is
meaningless without anchoring to the best plan that uses NO Roth conversions and NO brokerage
maneuvering. Also found the terminal-wealth valuation was biased.

- **retirement_optimizer_core.js:**
  - `simulate()` `totalWealth` (`:1476`) fixed: IRA × (1−nominalTaxRate), brokerage gains
    above basis × (1−**capitalGainsRate**) — previously both discounted at the ordinary rate.
  - Exposed `totals.terminal` {ira,roth,cash,brokerage,basis}, `totals.capGainsRate`,
    `totals.futureIRARate` (year-0 resolved).
  - New `afterTaxNetWorth(terminal, futureIRARate, capGainsRate)` helper.
  - `runOptimizer`: snapshot `baseFamilies`; after main+cyclic+spend+conv passes, a
    no-conversion sweep (`maxConversion:false, cyclicEnabled:false, extraConversionAmount:0`,
    tagged `(no conv)`). Baseline = max-afterTaxNW successful no-conv row → `window.optimizerBaseline`.
    Per-row `afterTaxNW`/`afterTaxNWCurrentDollars`/`_dNW`/`_dTax`.
  - `addResult` gained a `noConv` flag.
  - Columns: **After-Tax NW** (ranking metric), **Δ NW vs Base**, **Δ Tax vs Base**
    (signed, green/red). Winner `w6` = most after-tax NW. Default sort → afterTaxNW desc.
  - **Pinned ⚓ BASELINE row** (blue tint, sticky) at top of `#opt-table`; `#opt-best` gains
    "💎 Most After-Tax NW" + "⚓ Best w/o Conv".
  - **Sort fix:** failed plans now always rank below successful ones (a plan that runs out of
    money shows inflated terminal wealth). Found during browser verification.
- **retirement_optimizer.html:** version 11.fed → **11.1000**; changelog entry; column tooltips.
- **retirement_optimizer_core.test.js:** 6 new tests (afterTaxNetWorth math, terminal export,
  totalWealth cap-gains fix, zero-conversion run, baseline ordering). 24 pass, 0 fail.
- **Verified in browser** (python http.server :8766): in-page suite 209/209, no console errors;
  optimizer renders pinned baseline + After-Tax NW + Δ columns; default scenario baseline =
  "IRA Draw (no conv)" $1.26M, conversion strategies show signed deltas vs it.

### Phase 31 UX refinements — complete (v11.1001)

User feedback on the baseline-accounting UI:
- Dropped raw **Final Wealth** column (redundant with after-tax); renamed **After-Tax NW → NetWealth**,
  **Δ NW vs Base → ΔNetWorth**, **Δ Tax vs Base → ΔTax**. Removed the `nw`/finalNW winner ("Most Wealth")
  and the `simms` (⏱ms) column; opt-best winner now "💎 Most NetWealth".
- Added `title` tooltips to **every** optimizer column header.
- Pinned baseline row recolored blue → **light green (#d4f7dd)** so the dark ⚓ anchor stands out;
  added a baseline swatch to the Row-colors legend.
- **Infeasible rows hidden by default**; the legend's "Infeasible" item is now a click toggle
  (`toggleInfeasibleRows()`, `window.optimizerShowInfeasible`, `#opt-legend-infeasible`).
- **opt-perf** (sim time + run count) no longer nerdknob-gated — always shown, restyled from a loud
  yellow box to a subtle gray note ("⏱ Xms · N runs"); per-run ms dropped.
- Browser-verified: in-page 209/209, node 24/24, no console errors. Headers/tooltips/baseline tint/
  infeasible toggle (24 hidden → show/hide) all confirmed via DOM + screenshot.

### Phase 31 corrections — complete (v11.1001)

- **Baseline disables QCDs:** no-conversion sweep override now also sets `qcdHHMax: 0` — a true
  do-nothing reference. Verified: base qcd 1.25M (maxConv row) vs 0 (baseline).
- **ACA gating in optimizer:** new pure helper `bothOnMedicareAtStart(by1, startAge, hasSpouse, by2)`
  (shared with `updateACAWarning`). `runOptimizer` skips the ACA Cliff sweep when both persons are
  65+ at retirement start. Verified: 0 ACA rows (default both-65) vs 16 (startAge 60).
- **Baseline row color reverted** light-green → light-blue (#dbeafe); legend swatch reverted too.
- **opt-best "Best" column lightened:** label cells #4CAF50/white → #A5D6A7/#14532d (dark text) so the
  ⚓ shows; the per-metric data cells keep their brighter green.
- Verified: node 24/24, no console errors; both-65 baseline pinned blue, run count 176→160 (ACA gated).

### Plan sync to git — new worktree `goofy-chaplygin-27e560`
- Branch: `worktrees/goofy-chaplygin-27e560` (clean, no uncommitted changes)
- Reconciled plan with git log: **Phase 4 (QCDs) complete** — was marked pending but shipped.
  - Commits: 60fc49a (Phase 4 QCDs + summary bar fix, v12), 647c871/8f73707 (toggle polish), d1fa30f (2026 limit $111k, As-Needed tier fix), aba84f3/b6d8812 (docs, v11.fee).
  - PRs #79, #80 merged since last session. Also #76/#77/#78 (taxengine dynamic state dropdowns, Portfolio rename, withdrawal-rate fix).
- Current version: v11.fee.
- task_plan.md updated: Phase 4 → complete; Current Phase block refreshed; "As of" → 2026-06-19.
- Remaining unblocked: Phase 3 (Lumpy Spending), Phase 22 (Guyton-Klinger), Phase 29 (Creeping Tax), Phase 23b.
- No code changes this session yet.

## Session: 2026-06-11

### Phase 27 (Withdrawal Rate Fix + Inflows/Outflows) — complete

- **retirement_optimizer_core.js:** `_netAssetDraw`/`_netSpendPct` → `_grossOutflows`/`_netOutflows`/`_yearInflows`/`_wdRate`. Inflows = `fixedInc + pension` now subtracted from rate numerator. Log fields: `grossOut`, `netOut`, `inflows`, `wdRate%` (replaces `netSpend%`). `totals.avgWdRate` (replaces `avgSpendRate`). Column category map (`Summary`+`Withdrawals`), group defs, tooltips added. updateStats reads `avgWdRate` (element id `stat-avg-spend-rate` kept).
- **retirement_optimizer.html:** Label "Avg Spend Rate" → "Avg Withdrawal Rate"; new tooltip; version 11.ecc + changelog.
- **retirement_optimizer_core.test.js:** 5 Phase 27 tests (identity, SS-covers-spend, reconciliation, pension inflow, regression avg). 18 pass, 0 fail. Fix during dev: reconciliation test needed `extraConversionAmount` (bracket strategy w/o maxConversion produces no conversions).
- Browser verified: 207/207 in-page tests pass, no console errors; stat shows "Avg Withdrawal Rate 1.2%"; default scenario wdRate ~6.5% pre-SS, flips to −1.9% when SS starts (correct new behavior); grossOut/netOut/inflows/wdRate% columns render and reconcile.

### Context restore — new worktree `frosty-goldwasser-112138`
- Branch: `worktrees/frosty-goldwasser-112138` (clean, no uncommitted changes)
- Since last session: PR #77 merged (rename "Portfolio" field), PR #76 (taxengine.js dynamic state dropdowns + per-state notes across all tools)
- No new code changes this session yet

## Session: 2026-06-10

### Phase 12 (Withdrawal Timing) — complete

- **retirement_optimizer_core.js:** `growthRates` definition moved to top of year loop. Per-year timing auto-selection: `_stratImpliesConversion` flag (year 0) + `log[y-1].rothConv > 1000` look-back (year 1+) → `yearTiming = 'early' | 'late'`. `applyGrowth(balance, growthRates, preMonths)` before withdrawal block; `applyGrowth(balance, growthRates, postMonths)` after. `preGains` merged into `gains` for display stats. `timing` field added to `log.push()` → `'Early(Conv)'` or `'Late(Spend)'`.
- **Column groups:** `'timing'` added to `columnCheckboxMap` (`['Summary', 'Withdrawals']`) and `columnGroupDefs` (`'Withdrawals'`). Tooltip added to `updateTable()`.
- **retirement_optimizer.html:** Version 11.ecb. Changelog entry for Phase 12.
- **retirement_optimizer_core.test.js:** 5 new Phase 12 tests (bracket→Early, propwd→Late, extraConv propagation, IRA-depletion transition, format validation). 13 total tests pass.
- Verified in browser: `Late(Spend)` for propwd, `Early(Conv)` for extraConversionAmount runs, correct transition after IRA depletes.
- Timing column at TD index 66 in Annual Details.

---

## Session: 2026-06-09

### Phase 28 (SoRR Stress Mode) + UX polish — complete (PR #74)

- **mc_tab.js:** `_makeLegendClick()` — click isolates one line/band group; second click restores all. `_stressColorMulti()` — per-family hue + rank-based opacity for multi-strategy stress. Stress labels now `1929 (eq: -1.7% inf: -2.0%)`. Chart description updated.
- **prng.js:** `decadeInflCAGRs` added to `buildStressBank` return.
- **worker.js / mc_controller.js:** `stressInflationCAGRs` in postMessage/onComplete.
- **retirement_optimizer.html:** changelog 11.ec9 + version bump.

### Phase 9 (ACA Refinement, partial) — in progress

- **retirement_optimizer_core.js:** `updateACAWarning()` — computes both persons' ages at retirement start; disables ACA FPL options + shows "both on Medicare" message when both ≥65; shows advisory-only warning when exactly one ≥65. Triggered from `updateProfileAgeDisplay()`, `refreshStratRateOptions()`, and `startAge` oninput.
- **retirement_optimizer.html:** `#aca-age-warn` div inside `#ui-bracket`; `updateACAWarning()` added to `startAge` oninput.
- Browser-verified: all three cases (both Medicare, one Medicare, neither) work correctly.
- Next: full Phase 9 (ACA MAGI calculation, premium estimate, subsidy cliff warning in Annual Details).

### Phase 30 (GBM mu sync from Assumptions growth) — complete

- **mc_tab.js:** `syncMCMuFromGrowth()` one-way sync on page load + growth oninput + mode switch to GBM. `updateMCGrowthWarning()` mirrors >10%/<3% warnings from Assumptions section.
- **retirement_optimizer.html:** mc-mu label "GBM Return μ %"; tooltip clarified; note "synced from Growth %"; `<div id="mc-mu-warn">` added. `syncMCMuFromGrowth()` + `updateGrowthDisplay()` called in DOMContentLoaded.
- Cache bust: added `?v=11ec9` to all 4 MC `<script src>` tags (was necessary — browser served stale mc_tab.js despite on-disk fix).
- Supersedes Phase 8 investigation phase for this sub-case.

### Growth rate UX (nominal/real display + warnings) — complete

- **retirement_optimizer_core.js:** `updateGrowthDisplay()` — Fisher equation real rate inline below growth/inflation inputs; >10% optimistic warning; <3% pessimistic warning.
- **retirement_optimizer.html:** growth input tooltip (nominal rate, US historical ranges, don't subtract inflation); `oninput="updateGrowthDisplay(); syncMCMuFromGrowth()"`; inflation `oninput="updateGrowthDisplay()"`; `<div id="growth-info">` inserted between growth and inflation rows. How To item 4 expanded with nominal vs real explanation, Fisher equation, historical ranges, Current $ toggle.

### Phase 28 (SoRR Stress Mode) — complete

- **prng.js:** `buildStressBank(count, years)` — deterministic worst-N sequences scored by first 10yr equity CAGR; wraps history for long plans.
- **worker.js / mc_controller.js:** stress mode branch (mirrors bootstrap); overrides numPaths = stressCount; per-path trace capture (`stressPaths`); returns `stressLabels`, `stressStartYears`, `stressDecadeCAGRs`.
- **mc_tab.js:** stress chart = spaghetti of labeled individual lines (dark red → amber gradient); single variation selected by default; updated metrics bar + table title + chart description.
- **retirement_optimizer.html:** "Stress (worst sequences)" option in mode dropdown; nerd panel "Stress sequences" input (3–20, default 10); added `mc-chart-desc` id.
- **retirement_optimizer_core.js:** guarded `document.addEventListener` — fixes pre-existing worker crash (all MC was falling back to main thread).
- Worst 10 sequences (default): 1929, 1999, 2000, 1930, 1928, 1931, 1965, 2001, 2002, 1969.
- Tests: 207 pass, 0 fail.
- Phase 8 (Variable Growth): largely covered by existing bootstrap MC; sensitivity grid (Mode 1) deprioritized.

---

## Session: 2026-06-08

### Plan updated — 4 new phases added (user direction)
- Added Phase 27: Withdrawal Rate Fix + Inflows/Outflows columns in Annual table
- Added Phase 28: Bad Markets / SoRR Stress Mode (Bear-Start bootstrap + historical scenarios + CAPE preset)
- Added Phase 29: Creeping Tax Rate (TCJA expiration cliff + annual rate escalation)
- Added Phase 30: Verify GBM uses user growth rate (investigation first)
- Added SoRR and tax policy research notes to findings.md
- No code changes this session yet

---

## Session: 2026-05-27

### Phase 0: Planning & Context
- **Status:** in_progress
- **Started:** 2026-05-27 (initial)
- Actions taken:
  - Read BootstrapPlan.md (Monte Carlo improvements framework)
  - Read optimizer_directions.md (feature priority list A–R)
  - Created consolidated task_plan.md (11 phases total, later expanded to 12)
  - Created findings.md (research + decisions)
  - Identified blockers: Phase 1 (bracket fix) unblocks strategy comparisons
  - Added Phase 9 (ACA limit age-gating at 65+) — requires Phase 1, blocks Phase 10
  - Updated Phase numbering: Multi-strategy is now Phase 10, regime-switching Phase 11, quarterly Phase 12
  - **Brainstormed Phase 1 bracket fix approach:** Binary search all bracket options to find max feasible spend per bracket
  - **Expanded Phase 1 tasks:** Added `calculateMaxSpendPerBracket()`, real-time bracket UI feedback, adopt-spend flow
  - **Refined Phase 1 UI:** Replaced modal approach with inline feedback (brackets + spend input + real-time status). User can override constraints; Annual Details shows impact
- Files created/modified:
  - task_plan.md (created, updated with Phase 9, expanded Phase 1 details)
  - findings.md (created, added ACA constraint section, Phase 1 binary search approach)
  - progress.md (created, this file)

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Planning files exist | Check cwd | task_plan.md, findings.md, progress.md | Created | ✓ |
| BootstrapPlan.md readable | Read file | 208 lines, phases 1–3 defined | Read OK | ✓ |
| optimizer_directions.md readable | Read file | 229 lines, priorities A–R | Read OK | ✓ |

## Session: 2026-05-28

### Phase 7: Historical Inflation Bootstrap + CAGR Stats — complete

- **prng.js:** `bootstrapMultiAssetBank()` extended to return 4th bank (inflation). Expanded history window from 55 years (1970–2024) to full 97 years (1928–2024). Pre-1970 intl proxied with equity return.
- **worker.js / mc_controller.js:** Build `inflationSequence` per path from `multiAssetBank.inflation`; pass to `simulate()`. Replaced arithmetic median sort with single-pass CAGR (`exp(mean(log(1+r))) - 1`) for all 4 asset classes. `inflationStats` now uses `.cagr` key.
- **retirement_optimizer_core.js:** `yearInflation = inputs.inflationSequence?.[y] ?? inputs.inflation`; used in spend-goal escalation and inflation accumulator. GBM/file:// fallback unchanged.
- **mc_tab.js:** Column header "Median" → "CAGR". `iS.median` → `iS.cagr` in inflation row. `deflate()` uses `inflationStats?.cagr`. Fixed Current Dollars toggle (`renderMCChart` call in `updateCurrentDollarsView`). Fixed path-count ID (`mc-path-count-tbl`). Fixed bootstrap mode gray-out (`updateMCModeUI()` in `mcTabActivated()`).
- **retirement_optimizer.html:** "GBM (parametric)" → "Synthetic (parametric)". Updated mode description note.

### MC UX + Optimizer fixes — complete

- **mc_tab.js:** Strategy table: removed colgroup/fixed widths, all columns right-aligned, Max Conv moved before Strategy, Survival moved to rightmost, "Funds Exhausted" → "Exhausted", "Max Conv" header → "Max". Chart default changed to best-per-family (one line per strategy family, highest survival+balance tiebreak); current strategy's family overrides to exact current-settings variation.
- **retirement_optimizer.html:** `optimizeSpend` checkbox now has `onchange` — re-runs optimizer immediately if tab visible, else clears hash so next tab click re-runs.
- **retirement_optimizer_tests.js:** 3 `inflationSequence` regression tests added (inf-1/2/3).
- **retirement_optimizer.html:** Version bumped to 11.df0 with changelog entry.

## Session: 2026-06-01

### Phase 20: Roth Conversion Opportunity Cost — complete

- **retirement_optimizer_core.js:** Shadow delta vars (`convShadowDeltaIRA/Taxable`, `excessShadowDeltaIRA/Taxable`) init before year loop.
- **retirement_optimizer_core.js:** After `surplus.Cash` set each year — compute incremental taxes via shadow `calculateTaxes()` calls (true marginal method, not proportional). Update shadow deltas.
- **retirement_optimizer_core.js:** After `applyGrowth` — grow shadow deltas at IRA rate (conv/excess) and blended Brokerage+Cash rate (taxable).
- **retirement_optimizer_core.js:** After Roth credited — compute `convNetValue` / `excessNetValue` using user formula. Find `convBEYear` / `excessBEYear` after loop.
- **retirement_optimizer_core.js:** Log fields: `convOC`, `excessOC`, `convTax`, `excessTax`. Column category map + group defs + `getActiveCategories()` updated for `'Opp. Cost'`.
- **retirement_optimizer_core.js:** `getInputs()` now reads `futureIRATaxRate` (% → decimal; blank → undefined → defaults to current marginal rate).
- **retirement_optimizer_core.js:** `updateStats()` populates `stat-conv-be`.
- **retirement_optimizer.html:** `futureIRATaxRate` input near Max Conversion. `cat-oppcost` checkbox in column filter. `stat-conv-be` in summary stats bar. Version 11.e4f + changelog.
- **Verified:** 186 tests pass, 0 fail. `convOC`, `excessOC`, break-even years all computed live (conv BE=2047, excess BE=2049 on default inputs).

## Session: 2026-06-02

### Phase 19: URL Parameter Compression — complete
- **retirement_optimizer_core.js + retirement_optimizer.html:** Short-key alias map implemented; `loadFromURL` accepts both long + short keys (backward compat). `generateShareURL` emits short keys. 57% URL reduction (1100 → 468 chars).
- **RetirementTaxPlanner.html + IncomeTaxPlanner.html:** Same alias approach applied. Share panel popup standardized across all tools.
- **ITP → RTP cross-link:** Button in IncomeTaxPlanner opens RetirementTaxPlanner pre-populated with matching values.
- **Tax planner bug fixes:** included in commit 440665f (v11.e52).
- **Plan items 21 + 22 added to roadmap:** BETR (Phase 21) and Guyton-Klinger (Phase 22) documented in task_plan.md.

## Session: 2026-06-02 (continued)

### Phase 21 (BETR) + Phase 23 (Conversion Optimizer) — complete (core)

- **computeBETR():** Kitces formula `t_now × (1+r_taxable)^n / (1+r_ira)^n`. Formula correction: plan had `1 − t_now×(...)` — wrong.
- **BETR in simulate():** per-year `BETR%` and `betrFlag` (▲/≈/▼) in log; `totals.betrAvg`; displayed as `stat-betr-avg` in stats bar.
- **extraConversionAmount in simulate():** scalar or per-year array; IRA→Roth extra conversion after spending block; marginal tax recalculated.
- **optimizeConversionAmount():** $25k sweep finds optimal extra conversion per strategy (67ms; $150k/yr adds $773k wealth on $2M IRA scenario).
- **Conv Optimizer toggle:** opt-in checkbox; sweeps top-5 strategies; adds 🔁 rows with Opt Conv/yr + Conv Savings + Avg BETR columns.
- **Projected RMD stat:** `updateProjectedRMDStat()` with SECURE 2.0 ages and IRS ULT table; `stat-proj-rmd1/2` in scrollable stats bar.
- **Tests:** 199 pass, 0 fail (13 new).
- **Deferred (Phase 23b):** greedy DP per-year schedule; MC Stage 2 top-K validation.

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| | | | |

## Session: 2026-06-06

### Context restore — new worktree `hardcore-wozniak-4c1c7d`
- Branch: `worktrees/hardcore-wozniak-4c1c7d` (clean, no uncommitted changes)
- Last merged: PR #67 (MC tables → CSS grid), PR #65 (MC mode selector always visible + auto re-run)
- Tests: 199 pass, 0 fail (last confirmed 2026-06-02)
- No new code changes this session yet

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Phases 0–2, 6–7, 18–21, 23 complete + MC UX fixes shipped (PRs #65, #67). At v11.ec6+ |
| Where am I going? | Phase 3 (Lumpy Spending), Phase 4 (QCDs), Phase 8 (Variable Growth), Phase 12 (Withdrawal Timing), Phase 22 (Guyton-Klinger), Phase 23b (Greedy DP schedule) |
| What's the goal? | Implement remaining features from optimizer_directions.md priority list |
| What have I learned? | Bootstrap MC live; per-account asset allocation; inflation sequences; URL compression; Roth OC shadow tracking; BETR (Kitces formula); Conv Amount Optimizer ($25k sweep); Projected RMD stat; MC CSS grid tables |
| What have I done? | All core Roth conversion work done (20→21→23). MC engine mature. URL sharing polished. Quickwins (3,4,8,12,22) still open. |

---
*Update after completing each phase or encountering errors*

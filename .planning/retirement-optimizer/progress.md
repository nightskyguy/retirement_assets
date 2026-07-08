# Progress Log

## Session: 2026-07-08 (cont. 2) — Session wrap-up: PR opened, Item 6 round 2 deferred

**Shipped this session (committed + PR opened):** Phase PF (9-item UX batch) + the round-1 Item 6 fix (permanent-staining bug + missing core.js cache-bust). node 54/54, browser 240/240.

**Found but NOT implemented — deferred to next session:** user reported round-1's Item 6 fix didn't fully work — bar charts' legend swatches dim on hover but the bars themselves never visually redraw (confirmed via Chart.js issue #11507: `chart.update('none')` is known-buggy for skipping per-element redraws). User also requested a behavior change while diagnosing: bar-chart legend clicks should isolate (dim others, sticky) instead of toggle-hide; line clicks keep toggle-hide. Full design written and reviewed (2 clarifying questions resolved with user) in Plan Mode at `~/.claude/plans/add-the-following-to-swift-backus.md` ("Follow-up: Item 6 round 2" section) and mirrored into `task_plan.md`'s new **Phase PF2**. Not implemented — user said "will continue later."

**Next session start point:** read Phase PF2 in task_plan.md + the linked plan file section, then implement: (1) `update('none')`→`update()` in `datasetHoverHighlight()`, (2) new `makeChartLegendInteraction()` combining hover-dim + click-isolate, rewired onto the 4 mixed bar+line chart configs only.

## Session: 2026-07-08 (cont.) — Item 6 bug fix: legend hover permanently dimmed bar charts

User caught a real bug right after PF shipped: on bar charts (Taxation, Inflows vs Outflows, Earnings vs W/D), hovering a legend item dimmed the others but they **never restored** on mouse-leave, so every subsequent hover looked like "no effect" (everything was already stuck dim). Line charts worked fine.

**Root cause:** `datasetHoverHighlight()`'s cache/restore guard used `ds._origBorder !== undefined` to mean "have I cached this dataset's original colors yet." Bar datasets built via `mkTax`/`mkUp`/`mkDn`/`mkE` never set a `borderColor` at all — so their *real* original `borderColor` is legitimately `undefined`. The guard couldn't tell "never cached" apart from "cached, and the original happened to be undefined," so `onLeave` silently skipped restoring any bar dataset, permanently baking in the dimmed color. Line charts always set `borderColor`, so they never hit this path.

**Fix:** replaced the ambiguous `_origBorder !== undefined` sentinel with an explicit `ds._hoverHighlightCached` boolean marker (core.js, `datasetHoverHighlight()`). Verified via direct `onHover`/`onLeave` invocation on the Taxation chart's bar datasets — dim-then-restore now round-trips exactly back to original colors across repeated hover/leave cycles on different legend items.

**Bonus fix surfaced during verification:** `retirement_optimizer.html`'s `<script src="retirement_optimizer_core.js">` tag had **no cache-busting `?v=` token at all** (every other script — taxengine.js, montecarlo/*.js — already had one). This meant browsers could serve a stale cached copy of the single largest, most-frequently-edited file in the app indefinitely. Added `?v=1111c1` to match. This isn't cosmetic — it's the same class of staleness bug that historically motivated adding `?v=` tokens to the other scripts (see `taxengine.js` cache-bust history in earlier sessions).

**Verify:** node 54/54 (unchanged, this was pure browser/DOM logic no node test covers), browser in-page suite 240/240, no new console errors (the 4 shown are the existing intentional bad-input test fixtures). Manually confirmed on Taxation view: hover "Federal" → Cap Gains/State/IRMAA/Medicare/MAGI/threshold lines all dim to 15% opacity; leave → all restore to exact original hex/rgba values; repeat on "State" → same round-trip, no permanent staining.

## Session: 2026-07-08 — Phase PF: UX Polish Batch, 9 items (v11.11c1, worktree mystifying-babbage-559d99)

User punch-list of 9 items, planned via Plan Mode (3 parallel Explore agents + 1 Plan agent, `~/.claude/plans/add-the-following-to-swift-backus.md`), implemented + browser-verified in one session.

1. **Terminology:** "Bootstrap"→"Historical", "GBM"→"Synthetic" across retirement_optimizer.html + mc_tab.js user-facing text.
2. **IRMAA year-0 bug (real fix, not just cosmetic):** `magiHistory` seed ran *after* year 0's lookback read (core.js ~993), so year 0 always saw `magiLookback=undefined` → IRMAA forced to `$0`/`-none-` regardless of actual income. Fixed by computing year-0's IRMAA/tier retroactively inside the same seed block, once `tax.MAGI` is known. New node test (`54/54` total). Browser-verified: high-income 65+ scenario now shows Tier 2/4 in year 0 (was `-none-`).
3. **Income chart note:** bolder (font-weight 600) + now mentions the Inflows vs Outflows view.
4. **Cycle Brokerage — max out target LTCG bracket:** new nerd-knob `#cycleLTCGTarget` (0.15="target 0% bracket" default / 0.20="target 15% bracket"). Always harvests to the full target-bracket room regardless of spend need; when spend forces beyond it, tops off whichever bracket the forced realization lands in — capped by the active bracket/minlimit/aca strategy's own ceiling (extracted into new `computeBracketCeiling()` helper, reused by both the original ceiling branch and the new Cycle-Brokerage logic — pure refactor, verified byte-identical behavior via 54/54 before/after). **Found and fixed a real latent bug** in `getLTCGBracketRoom()` during implementation: it only returned room within the *first* bracket the ordinary income fell into, not the combined span across multiple sub-`maxRate` brackets — meant `cycleLTCGTarget=0.20` produced the *identical* result as `0.15` until fixed (caught via a failing new test, root-caused by hand-tracing bracket-walk logic). New tests: max-out-even-when-spend-small, 0.20-harvests-more-than-0.15.
5. **Untaxed tooltip:** own array line now, not string-concatenated onto "Total Income".
6. **Legend hover highlight:** new `composeLegendHover()` + `datasetHoverHighlight(groupSize)` helpers (core.js, near `medicareLegendHover`) — hovering a legend item dims all other chart series to ~15% opacity via `chart.update('none')`. Applied to all 8 chart configs (Assets, 4 Income&Expenses views, combined view — 6 in core.js; MC main chart + Input Distribution fan charts — 2 in mc_tab.js). Composes with the existing Medicare tooltip-hint handler where both are needed (avoids the object-spread key collision that would've silently dropped one).
7. **MC: fold Stress into Historical (highest risk item).** worker.js/mc_controller.js: extracted the bank-build+variations-sweep body into a `runPass(mode, progressOffset, progressWeight)` inner function (mirrored identically in both files); Historical mode now calls it twice (bootstrap pass + stress pass) in one message cycle, weighted by path-count share so the progress bar doesn't jump to 100% and restart. Stress dropdown option removed. New `renderStressChart()` in mc_tab.js renders the stress pass into a new `#mc-stress-chart-wrap` canvas below the main chart; `renderMCChart()` trimmed to percentile-bands-only (no more `isStress` branch). Gave the stress chart its own `_legendIsolatedKeyStress` (previously a shared `_legendIsolatedKey` would've let isolating one chart's legend desync the other's restore toggle).
   - **7b:** Input Distribution fan charts now label the x-axis with actual calendar years (`_mcStartYear + i`), matching the main chart — was "Yr 1"/"Yr 2".
   - **8:** Split `renderMCMetrics()` into `renderMCMainMetrics()` (next to the main chart) + `renderMCStressMetrics()` (next to the stress chart), sharing a new `buildAssetRangeTable()` helper — confirmed via browser inspection the two grids show genuinely different CAGR numbers (not accidentally sharing data).
   - No automated test coverage exists for worker.js/mc_controller.js — verified entirely via live browser eval: Historical mode → both charts render (30 + 60 datasets), calendar-year labels on both, distinct Min/CAGR/Max stats, correct table title; Synthetic mode → stress section hides (`display:none`), table title shows "Synthetic", median-growth summary line shown instead of the asset-range table.
9. **MC Strategy table click-to-sort:** mirrors the Optimizer table's `sortOptimizerBy` pattern exactly — new `mcSortState`, `getMCColumns()` (7 sortable columns, checkbox excluded), `sortMCTableBy()`. Static header `<div>`s replaced with dynamic `#mc-table-header`. Default (unclicked) sort preserves the original 3-key tiebreak (survival desc → final balance desc → tax asc). Browser-verified: click "Total Taxes" → ascending dollar sort with arrow ▲; click again → descending ▼; checkboxes still map to the correct (reordered) row.

**Verify:** node **54/54** (52 baseline + 2 new: IRMAA year-0, Cycle-Brokerage max-out). Browser in-page suite **240/240**, no console errors. Version 11.11ae→**11.11c1**, changelog added, montecarlo/mc_controller.js + mc_tab.js cache tokens bumped `111091→1111c1` (worker.js self-cache-busts via `Date.now()` fallback already, no token needed).

**Not done / out of scope for this batch (flagged, not blocking):** QCD "As Needed" sizing still estimates `provisionalMAGI` excluding capital gains — pre-existing approximation whose error grows with Item 4's larger harvests, not tested here. `_mcMsPerSim` calibration will be slightly inflated for future GBM-time-estimates since `totalMs` now includes the stress pass — cosmetic, not fixed.

## Session: 2026-07-07 (cont. 5) — After-tax note on Income & Expenses chart (v11.11ae)
Added `#income-aftertax-note` below the chart-view buttons, shown only for the `combined` view (`setIncomeChartView()`, core.js:4249-4253 — mirrors the existing `chk-thresholds-wrap` show/hide pattern), text: "Incomes shown are After Taxes - See Annual Details for pre-tax amounts." Directly addresses the SS-chart question from the prior session — clarifies in-app that combined-view income bars are tax-scaled. Browser-verified: visible on combined, hidden on tax/net/flows/assetflows, visible again when switching back. Changelog + version reviewed with user before commit (user approved as-is): v11.11ad→11.11ae, "Income & Expenses chart: added a note that shown incomes are after-tax (pre-tax figures are in Annual Details)." node 51/51, badge 🟢.

## Session: 2026-07-07 (cont. 4) — P21 rename + SS chart investigation (v11.11ad)
Renamed "Spend by Account"/"Account Spend" → "Spending" throughout: category tag string, `cat-acctspend`→`cat-spending` checkbox id, `showAccountSpendOnly()`→`showSpendingOnly()`, button/checkbox labels. Changelog updated to user's exact wording ("Added Spending to Annual Details to focus on spending."), version bumped 11.11ab→11.11ad (this time WITH changelog/version, per user request — supersedes the "no changelog" instruction from the prior polish-only commit). Browser-verified rename end-to-end (old ids/fn gone, new ones work, badge 🟢), node 51/51.

**Investigated:** user reported Income & Expenses chart showing SS=$20,460 for 2026 instead of expected $24,000 (default scenario: spouse SS $24k @ age 70, spouse age 74 in 2026; primary SS $48k @ age 70 not yet claimed at age 66). **Not a bug.** `lastSimulationLog[0].SSincome` = exactly $24,000 (confirmed via preview_eval) — Annual Details table is correct. The Income & Expenses chart's combined view deliberately scales every income-source bar (SS, pension, RMD, etc.) by that year's effective tax rate `(vsum - totalTax) / vsum` (`mkInc()`, core.js:4487-4494, documented in the comment above it at 4466-4471) so stacked bars sum to net spendable income, with a Taxes band drawn separately on top to gross total. Computed scale for year 1 = 0.8525 (totalTax=$27,191, vsum=$184,332) → $24,000 × 0.8525 = $20,459.73 ≈ $20,460, exact match. No code change made — reported finding to user only.

## Session: 2026-07-07 (cont. 3) — P21 polish pass (no version bump)
User testing surfaced 6 issues, all fixed: (1) pre-existing bug — `year` column missing under 5 of 10 category checkboxes (IRA Δ/Roth Δ/Brokerage Δ/Cash Δ/Opp. Cost) system-wide, now fixed for all 10; (2) preset button restyled from default (huge, `.tab-btn` blue) to existing small `.tog` class; (3) dropped `age1`/`age2` from Account Spend; (4) swapped combined `RMDwd` for per-account `RMD1-`/`RMD2-`; (5) swapped separate `SSincome`+`pension` columns for the existing combined `inflows` field; (6) added missing `surplusCash` tooltip. Browser-verified each fix individually via preview tools (year-visibility loop across 5 categories, preset-button field-set check, computed-style check on button at desktop width vs mobile, tooltip text check). node 51/51, in-page badge 🟢. User explicitly asked for no changelog/version bump — stayed at v11.11ab.

## Session: 2026-07-07 (cont. 2) — Phase P21 shipped (v11.11ab)
"Spend by Account" view for Annual Details. New `'Account Spend'` tag on 15 log fields in `columnCategories` (core.js:3139-3236: year/age1/age2/SSincome/pension/IRA1-/IRA2-/RMDwd/QCD1/QCD2/RothWD/Brokerage-/CashWD/rothConv/surplusCash), `cat-acctspend` checkbox wired into `getActiveCategories()`, new `showAccountSpendOnly()` preset function (unchecks all other cat-* + show-all, checks only cat-acctspend) bound to a new button in `.column-controls` (retirement_optimizer.html:749-786). Browser-verified via preview tools: checkbox alone unions with Summary correctly; preset button isolates to exactly the 15 fields (11 visible by default, all 15 with Show Zero); no balance/growth columns leak in; no console errors. node 51/51, in-page badge 🟢. Version 11.1133→11.11ab, changelog entry added.

## Session: 2026-07-07 (cont.) — Added Phases P20-P23 (planning only, no app code)
User requested 4 new backlog items, researched via 3 parallel Explore agents + 1 Plan agent, 2 design questions resolved via AskUserQuestion (plan mode):
- **P20** README Table of Contents — inline ToC + heading-level fix, no docs/ split (user chose low-risk option).
- **P21** Annual Spending-by-Account View — new `'Account Spend'` category tag reusing existing checkbox/category-filter system (core.js:3139-3303), not a new page, not an extension of RetirementTaxPlanner.html (confirmed too narrow — single-year tax tool).
- **P22** Export Annual Details to CSV — CSV-only v1 (no xlsx lib), reuses `exportScenario()`'s Blob+`<a download>` idiom, filters through live `isColumnVisible()` so export matches on-screen state; XLSX explicitly deferred.
- **P23** MC arithmetic-mean returns + AR(1) variable inflation for GBM mode — user confirmed: (a) plain normal walk `mu + sigma*boxMuller(rng)` clamped at **RETURN_FLOOR = -0.85** (user-specified during plan review), replacing log-space/Itô GBM entirely; (b) AR(1) inflation (`computeNextInflation()`) default-ON for all GBM users, only persistence/shock-stddev knobs nerd-gated. Formula triplicated across worker.js + mc_controller.js×2 — flagged as footnote risk, not restructured.

All 4 written into task_plan.md priority table + full `## Phase PXX` sections + dependency graph. No app code touched this session — purely a planning/backlog update.

## Session: 2026-07-07 — Context restore, new worktree `mystifying-babbage-559d99`
- Branch `worktrees/mystifying-babbage-559d99`, clean, matches main post-PR#108.
- Old worktree `silly-hellman-b5d326` gone (deleted post-merge) — plan files recovered from committed `.planning/retirement-optimizer/` (not gitignored, survives worktree deletion).
- PR#108 (3b5a7e2): b27078c (restore accidentally-deleted tool headers in README) + 92814b3 (this same doc-refresh) + 8ee8f34 (README other-tools reorg) — all docs-only, no app code changed. App version still v11.1133 (confirmed in retirement_optimizer.html title), matching P19 taxengine work (PR #105).
- No pending uncommitted code. Next unblocked priority-list item: **P2 Cash Reserve enforcement**.

## Session: 2026-07-04 — Context restore, new worktree `silly-hellman-b5d326`
- Branch `worktrees/silly-hellman-b5d326`, clean, matches main post-PR#107.
- Since last plan update (PR#104): PR#105 (324447f taxengine circular-dep fix, now committed — P19 status line updated), PR#106 (d930139 RealReturns sweepable period + inflation/CAGR context — side feature, not on P-list), PR#107 (16c75d9 HYSA share/URL-state UX + moved root tools into `standalone/` + 3a3188a/6d09da8 planning-layout fixes — also side features, not on P-list).
- `.planning/` layout now scoped at `.planning/retirement-optimizer/` per 3a3188a (hooks expect this; flat layout from 16c75d9 was invisible to hooks).
- task_plan.md "As of" line + P19 status refreshed. No code changes yet this session.

## Session: 2026-07-02 — Context restore, new worktree `cranky-mcclintock-9fa806`
- Branch `worktrees/cranky-mcclintock-9fa806`, clean, matches main post-PR#103.
- PR #103 merged (f46fb67): 97cb319 MC milestone-filter fix + Sim Mode label size — was UNCOMMITTED per the entry below, now confirmed shipped as part of that PR.
- Version confirmed v11.1125 in retirement_optimizer.html title. session-catchup.py found no unsynced context. No code changes yet this session.
- task_plan.md "As of" line refreshed (was stale at 2026-06-29/priceless-turing-9a5ad3).

## Session: 2026-07-01 (cont. 4) — MC milestone filter + Simulation Mode label size (now COMMITTED via PR #103)
1. `milestonePlugin` now filters by canvas id: `chartAssets`/`chartIncomeSources` = all milestones; `mc-chart` = death markers only (label contains 'Passing') — MC fan mixes strategies so IRMAA/GK/shortfall/Roth-BE markers don't apply; all other canvases (mc-input fans) = none. Plugin was globally registered so it previously drew stale single-run milestones on every chart.
2. MC "Simulation Mode" label 0.9em→1.1em (12.6→15.4px), select 0.9→0.95em (retirement_optimizer.html ~416).
Verified: main charts keep all milestones, mc-chart update clean w/ plugin active, badge 🟢, no console errors.

## Session: 2026-07-01 (cont. 3) — COMMITTED e62e270, pushed, PR #103 opened (v11.1125 batch: age gate + colors + Medicare B+D)

## Session: 2026-07-01 (cont. 2) — Medicare un-gated + Part D + legend hover (v11.1125, UNCOMMITTED)
1. NERD_KNOBS gate removed from Medicare everywhere: log key always `Medicare` (no more `-Medicare`), chart series unconditional in Taxation + Income&Expenses.
2. `medicareBase` now includes Part D: `(standardPartB 202.90 + standardPartD 38.99) × 12 × count × medicareRate`. New `TAXData.IRMAA.standardPartD: 38.99` (2026 CMS base beneficiary premium, IRA 6% cap).
3. Legend hover on 'Medicare': `medicareLegendHover` (onHover/onLeave set `canvas.title`) const next to the color consts; spread into tax-view + combined-view legend configs. Tip text (user-specified verbatim): "Base Cost for Medicare B+D - not deducted from spendable. Illustration only."
4. Version stays 11.1125 (same hour hash, user approved); changelog Medicare bullet shortened per user; taxengine cache token 1124→1125 in all 4 HTMLs.
Tests: node 51/51, browser 240/240, badge 🟢. Medicare sample 2026 = $5,805 (2 × 241.89 × 12 ✓).

## Session: 2026-07-01 (cont.) — IRMAA/Medicare chart colors (v11.1125, UNCOMMITTED)
User: IRMAA + Medicare shared near-identical pinks. New single-source consts above `computeMilestones()` in core.js: `IRMAA_COLOR='#E75480'` (deep pink, user-approved via swatch), `MEDICARE_COLOR='#008080'` (teal, darker than Gains+Div `#1abc9c`). Bars = const+`'C0'` alpha in Taxation + Income&Expenses; IRMAA milestone marker now pink (was blue `#2980b9`). Tier-threshold blue ramp + table tints unchanged (user choice). Version 11.1124→11.1125, changelog sub-bullet added. node 51/51, badge 🟢 (240/240), colors verified via dataset inspection. NOTE: preview_screenshot tool wedged (timeouts) though page responsive — verified programmatically.

## Session: 2026-07-01 — IRMAA Medicare age gate (v11.1124, worktree focused-dewdney-a79975, UNCOMMITTED)
User bug: "IRMAA" milestone fired at age 61/62. Fixes:
1. **Age-65 per-spouse gate**: `calcIRMAA(..., onMedicareCount)` new 5th param (null = legacy household total; else per-person = rate/(MFJ?2:1) × count). core.js computes `onMedicare` from alive+age≥65 per spouse.
2. **Tier off-by-one fixed**: log-row `IRMAATier` used to recompute from magiHistory AFTER the year's push (1-yr lag vs 2-yr charge). Now computed once at charge time (`irmaaTier`), passed through log params. Shows `-none-` pre-65 → milestone auto-gated.
3. **IRMAA Ceil / minlimit strategy gate**: pre-63 (`maxAliveAge < 65 + LOOKBACK`) the IRMAA tier ceiling relaxes to top of federal bracket CONTAINING it (verified: MFJ tier-0 218k ceiling → ~403k target at 60–62, exact ceiling from 63).
4. **Medicare base premium tracked**: `medicareBase = onMedicare × standardPartB × 12 × medicareRate`; logged as `Medicare` (nerd) / `-Medicare` (hidden); chart series in Taxation + Income & Expenses gated by NERD_KNOBS; `totals.medicare`; NOT in totalTax (assumed inside spend goal — no double count, sim results independent of nerd flag).
Verified NOT bugs (user concerns 2&3): threshold inflation correct (Y−2 MAGI vs year-Y CPI-inflated thresholds = real SSA indexing); surcharge $ grows at ANNUAL_INCREASE 5.6%/yr ≈ CPI+3%.
Tests: node 51/51; browser 240/240 (14 new: 6 unit per-person calcIRMAA + sim age-gate suite; sim test needs `hasSpouse:true` or spouse zeroed at simulate() entry!). Version 11.1119→11.1124, changelog added, taxengine cache token 1119→1124 in all 4 HTMLs.

## Session: 2026-06-30 (cont.) — CA note fix + 2026 data refresh for stale states (UNCOMMITTED, no changelog)
- **CA NOTE**: now states the omitted SDI/personal-exemption credits cause California tax to be slightly **over-calculated** (actual lower).
- **Checked the 4 states dated YEAR:2025** (ME, MN, OH, WI) via WebSearch for real 2026 changes:
  - **Ohio — STRUCTURAL fix**: HB 96 moved OH to a **flat 2.75%** above $26,050 for 2026 (3.5% top bracket repealed). Model had 3 tiers incl. 3.5% → corrected to `[{26050:0},{Infinity:0.0275}]` (both filings), YEAR→2026, NOTE updated. Verified: $200k MFJ → $4,652 = (200000−4800−26050)×2.75%.
  - **Maine — inflation refresh**: 2026 brackets (rates unchanged 5.8/6.75/7.15%): MFJ 54,850/129,750, SGL 27,400/64,850. YEAR→2026, NOTE updated. (Source: maine.gov 2026 rate schedule.)
  - **Minnesota — inflation refresh**: 2026 brackets (+2.369%, rates unchanged): MFJ 46,330/184,040/321,450, SGL 31,690/104,090/193,240. YEAR→2026, NOTE updated. (Source: MN DOR 2025-12-16 release.)
  - **Wisconsin — left at 2025**: only the top bracket ($315,310 single) was available, not the full 2026 thresholds; rates unchanged. Kept YEAR:2025 so the staleness banner discloses it.
- Cache token bumped `111103→111104` (taxengine changed again). node 51/51; browser badge 🟢, no console errors. No version/changelog bump (per request).

## Session: 2026-06-30 (cont.) — Assumptions layout + state-note UI + oddball-state notes (UNCOMMITTED, no changelog)
Follow-up UI batch (user, no changelog requested):
1. **Growth + Dividend Rate now share one row** (assumptions). 2. **Cash Interest moved down**, now paired with Marginal Heirs Tax Rate. 3. **State Taxation = full-width row** (single-child `.row`, full-width at the breakpoint like Withdrawal Strategy). 4. **`#state-note` div** added below State picker; new `updateStateNote()` (defined inline in retirement_optimizer.html, called on `STATEname` onchange + init) renders the selected state's caveat like IncomeTaxPlanner.
5. **Oddball-state NOTEs added/extended in taxengine.js** describing how the model differs from actual: GA, NY, CO, KY, MI (new NOTE); AL, MD, ME, MT, OH, WI, CT, VA (retirement caveat prepended to existing NOTE). IL/PA already done. Each says the model over-taxes (or AL: pension-vs-IRA) and by how much.
6. **All note displays show the tax-data year + staleness** ("📅 Tax data: 2026 rules" or, when curYear>data YEAR, "— {curYear} figures not yet published; {dataYear} rules applied until updated"). Implemented in retirement_optimizer `updateStateNote`, Retirement_Projection `updateStateNote` (textContent→innerHTML), and IncomeTaxPlanner `buildStateNotes` modal (per-li year prefix).
7. **Ordered-strategy `#orderedSeq`**: confirmed already full-width (436px = container); no change needed.
- **Cache:** bumped taxengine `?v=111102→111103` in all 3 HTMLs (taxengine content changed again).
- Verified (http.server :8767): optimizer layout (Growth|Dividend, Cash|Heirs, State full-width+note), notes render with year (CA 2026; ME/OH show 2025-stale), GA/NY/IL/PA caveats; RP PA/NY/OH notes; ITP modal 19 notes with year prefix. node 51/51. Badge 🟢, no console errors. Title stays v11.1102 (no version bump per request).

## Session: 2026-06-30 — State retirement-income exclusion (v11.1102, worktree heuristic-panini-6da3e1, UNCOMMITTED)
Plan: `~/.claude/plans/sharded-bouncing-squirrel.md`. New task (not on the P-list): user reported IL taxes IRA withdrawals though IL exempts retirement income.

**Root cause:** `calculateTaxes()` folded all retirement distributions into `earnedIncome` → every state taxed them; only `SSTaxation` exempted SS. No retirement-income lever.

**Engine (taxengine.js):** added `pensionIncome`/`iraIncome` params (default 0 → regression-safe) and per-state `RETIREMENT_EXCLUSION:{mode:'full',types:['pension','ira']}`. STEP 4 subtracts the qualifying buckets from `stateAGI` (ordinary side; cap-gains recompute inherits it). Coded **IL** and **PA** full exemptions (+ NOTE text). Kept pension/ira split separate to support future oddballs (AL pension-only, NY govt-vs-private).

**Callers updated (all taxengine.js consumers):**
- core.js — 4 main calls + 3 shadow/incremental (conv/excess OC) + `computeSuggestedSpend`: pass `pensionIncome:pension, iraIncome:taxableRMD+netWithdrawals.IRA`. (worker.js covered via core.js; worker cache-busts via Date.now().)
- Retirement_Projection.html:1311 — `iraIncome: actualWd + spouseRmd` only (fixedIncome is a mixed pension+interest+div bucket, can't split → left taxed; matches existing approximation note).
- IncomeTaxPlanner.html — new `cfg.retirementIncome` $ input (`#num-retinc`/`updRetInc`) + checkbox `#chk-retinc-swept` ("swept income is retirement distributions"); `calcAt` passes `iraIncome`; URL keys `ri`/`rw`. Default off → unchanged.
- **Cache-bust:** `taxengine.js` had NO `?v=` token on its `<script>` tag (unlike MC scripts) → returning users would get stale tax logic. Added `?v=111102` to the taxengine tag in all 3 HTMLs.

**Tests:** +4 in core.test.js (IL/PA exempt; IL still taxes dividends; CA params inert). node 51/51 + taxPaymentPlanner 12/12.
**Browser-verified (http.server :8767):** IL/PA state tax → $0 on retirement income (IL was $5650), IN/CA unaffected, IL still taxes dividends; ITP swept-on→$0 / fixed-$100k-of-$150k→$2185 / CA inert; RP PA→$0 (was $3377). Optimizer badge 🟢, no console errors, title v11.1102.
**PENDING DECISION (oddball partial states):** AL (pension-exempt/IRA-taxed), GA $65k/65+, NY $20k+govt-exempt, CO/KY/MD/ME caps, MI cohort phase-in, CT/VA income-tested, WI/OH minor. Spelled out in the plan file; not implemented. Also MS/IA (full-exempt, not yet coded as states).

## Session: 2026-06-29 — UX batch (13 items, worktree pedantic-cohen-5dfe27, NO changelog/version bump yet)
Plan: `~/.claude/plans/1-lets-add-pension-lexical-flurry.md`. All 13 items implemented + verified in browser (212 tests pass; node suites 47+12 pass).
- **PA Pension Start Age** — `#pensionStartAge` input in Income section; `getInputs` (1939), gate at core.js:1000 (`age1 >= pensionStartAge`), URL key `psa`, label map. Verified: $0 before age, full after.
- **#1 rename** "3. Income (annual)" → "**3. Annual Income & QCDs**" (summary + How-To doc line). No .md refs needed ("Income chart" is a different feature).
- **#2** Folded "Charitable Giving (QCD)" `<details>` into bottom of Income section as a bold sub-heading (kept `#qcdHHMax`/`#qcdAlways`).
- **#3** "Withdrawal Strategy" → "**5. Withdrawal Strategy**" (strategy-container div).
- **#4** Added tooltips: Inflation, CPI/COLA (+ #7 audit extras: ss1/ss1Age/ss2/ss2Age/pensionAnnual/survivorPct).
- **#5** "Future IRA Tax %" → "**Marginal Heirs Tax Rate %**" (id `futureIRATaxRate` unchanged) + new tooltip (heirs' all-in rate, 0% if donated).
- **#8** Optimizer "Symbols:" legend row (✓✦✦+▼🗘🔄⇌⚠️🟢🚨⚓) added beside Row-colors.
- **#9 Objective selector** (nerd-only) `#opt-objective`: Balanced/Legacy/Spend/MinTax/Roth/ConvEffectiveness → `OPT_OBJECTIVES` + `rankRowsByObjective`. Conv Effectiveness = `_convSavings`. Choosing objective re-picks ⚓ baseline via `recomputeBaselineForObjective()` (runOptimizer refactored to call it); "Balanced" restores default. Verified baseline moves (spend→IRA Draw vs GK).
- **#10** Nerd table keeps **Score** + adds **Rank** column (`OptimizerState._rankMap` built per render).
- **#11 Failed list** — `OptimizerState.showFailed=false`; hide `success===false` by default; `#opt-legend-failed` toggle + `toggleFailedRows()`; light-red tint. Verified 6→167 rows.
- **#12 ACA nerd-gated** — sweep loop `if (NERD_KNOBS && !acaDisabled)`; `generateStratRateOptions` aca entries gated; `updateACAWarning` no-ops with no aca opts. Verified 0↔4 options.
- **#13 Hidden runtime nerd toggle** — `const`→`let NERD_KNOBS`; `setNerdKnob()`/`applyNerdKnobVisibility()` (re-runs BETR stat, objective wrap, initMCTab, toggleStrategyUI, refreshStratRateOptions, opt re-render); unlabeled `#secret-nerdknob` at bottom of Docs tab w/ black-hole tooltip; init calls applyNerdKnobVisibility(). NOT URL-persisted. Verified runtime on/off.
- **#6** No changelog/version bump (deferred to end per request).

### Follow-up (same session)
- **7 audit tooltips added:** `#strategy` + `#orderedSeq` selects; all 6 tab buttons (`btn-tbl/cht/opt/mc/fileio/docs`).
- **Brokerage color unified to `#4F4FDC`** across ALL charts (was `#0000CC` in Income/Expenses, `#2980b9` in Assets/flows/assetflows) — fixes Guaranteed(`#3498db`) vs Brokerage-draw clash on Inflows-vs-Outflows. Edited 4 datasets in core.js (assets line, combined mkInc, flows mkUp, assetflows mkE). Verified via Chart dataset inspection: assets `#4F4FDC`, others `#4F4FDCB0`.
- **Nerdknob checkbox now visible** — was `opacity:0.18;cursor:default` (user couldn't see it) → `cursor:pointer` plain checkbox, still unlabeled with black-hole tooltip, bottom of Docs tab.
- Re-verified: in-page 212/212 (🟢 badge), node 47/47, no console errors.

### Follow-up batch 5 — Milestone overhaul (no changelog)
Rewrote `computeMilestones(log)` (core.js ~4082). Was first-only death/underfunded/IRMAA; now:
1. Death labelled **"Your Passing"/"Spouse Passing"** (deceased's `age1/age2` shows '—' at the status flip).
2. **"GK cut"** every year `r.gkAdj` contains "cap" (guardrail spending cut).
3. **"IRMAA Tier N"** every year the numeric tier (`tierNum(r.IRMAATier)`, strings "-none-"/"Tier N") INCREASES over prior year (not same/decrease).
4. **"Shortfall"** every year `netIncome < spendGoal*0.90` (>10% short).
5. **"Roth Break Even"** at `lastTotals.convBEYear` (reuses the existing Break Even stat's year).
Refinement: a shortfall year SUPPRESSES the GK-cut marker (shortfall computed first; GK cut pushed only when `!isShort`) — verified GK 400k: 12 both-years all show only "Shortfall".
Verified in browser: default → Your Passing + IRMAA Tier 1 + Roth Break Even; GK 220k → 8 GK cuts + tier increase; propwd 900k → 24 Shortfall + IRMAA Tier 5 + Roth Break Even. node 47/47, in-page 212/212 (🟢), no console errors.

### Follow-up batch 4 — Brokerage color + changelog (v11.10ee)
- **Brokerage color unified to solid `#4F4FDC`** across all 4 charts. Balances line was already solid; dropped the `B0` alpha on the 3 bar-chart series (core.js flows ~4378, assetflows ~4405, combined ~4533). Verified all four datasets = `#4F4FDC`.
- **Changelog + version bump → 11.10ee** (`hex(180*24+14)`; title html:17 + new top `<li>` in Change Log). User-selected entries only: Pension start age, Optimizer symbol legend, Guyton-Klinger sustainable-spend fix. (Other candidates intentionally omitted this pass.)
- Verified: node 47/47, in-page 212/212 (🟢), no console errors.

### Bug fix — GK guard/adj scenario round-trip (pre-existing, exposed by visible nerdknob)
- Symptom: optimizer GK row showed "Grd:0 Adj:0" (non-nerd) / fields showed 0.2,0.1 (nerd).
- Root cause: `saveScenario` stores `getInputs()` (gkGuard as DECIMAL 0.2); `applyScenario` (core.js:5078) multiplies percentage fields ×100 on load but its list OMITTED `gkGuard`/`gkAdjPct` (added in Phase 22, never added here) → field set to 0.2 → next `getInputs` does 0.2/100=0.002 → GK reads guard≈0; label `round(0.002*100)=0`. Auto-loaded `default` scenario triggered it every load. Not caused by my edits — the visible secret-nerdknob just revealed the ui-gk panel.
- Fix: added `gkGuard`, `gkAdjPct`, `futureIRATaxRate` (same latent gap) to the ×100 list in `applyScenario`. Verified: applyScenario({gkGuard:0.2}) → field 20.000, getInputs 0.2, GK label "Grd:20 Adj:10". Existing buggy saved scenarios now load correctly (no migration needed).

### Follow-up batch 3 — label rename + GK reverse-search floor + banner fix
- **Renames (visible only; identifiers unchanged):** "Spend-optimized"→"Optimize Spend", "Conv-Optimizer"/"Conv Optimizer"→"Optimize Conversions" in optimizer legend/symbols (html ~840/849/850/854) + column tooltips (core.js ~2802/2814/2886/2892). Toggle labels were already correct. Changelog (592/610) + the `_isSpendOptimized`/`_isConvOptimized` identifiers left alone.
- **GK reverse-search floor:** extracted the forward `passes()` GK stability check into shared `gkSpendStable(res, overrides, baseInputs)` (core.js ~2242). Forward `optimizeSpend.passes()` now calls it; reverse `optimizeSpendDown.bestPassingStrategy()` now gates `res.totals.success && gkSpendStable(...)` (was success-only → GK self-cut → inflated "sustainable" spend). Repro (defaults, spend 900k, Optimize Spend on): reverse banner was GK $283,289 (held via cuts) → now honest **$155,813 IRA Draw ▼**.
- **Banner fix:** `renderSpendOptimizerBanner` reverse + increase branches now use `el.innerHTML` (was `textContent`, rendered the `<span style=color:#cc0000>🗘</span>` literally) and wrap the strategy label in a clickable `<span onclick="loadOptimizerResult(_id)">` → suggested strategy loads (verified: click → spendGoal 155813, strategy fixedpct). Symbols render as glyphs.
- Verified: node 47/47, in-page 212/212 (🟢), no console errors.

### Bug fix — stale derived displays after scenario load
- Symptom: loading a scenario that changes Assumptions:Growth left the "Real growth" line (`#growth-info`) stale.
- Root cause: `applyScenario` sets `.value` programmatically, which does NOT fire the `oninput` handlers that compute derived displays. It called runSimulation but not the display refreshers.
- Fix: after `applyScenario` sets fields, call the same refreshers the init sequence runs — `updateGrowthDisplay`, `syncMCMuFromGrowth`, `updateProfileAgeDisplay`, `refreshStratRateOptions`, `updateBracketFeedback`, `updateSuggestSpendTooltip`, `updateIRAGoalHint`, `updateCompAdvisory` (all typeof-guarded). Verified: applyScenario({growth:0.09}) → Real growth line updates 3.4%→6.4%. 212/212, no errors.

---

## Session: 2026-06-29 — Plan cleanup (worktree priceless-turing-9a5ad3)
Archived all completed phases into `task_completed.md`. Rewrote `task_plan.md` with only remaining work, renumbered P1–P18. Verified Phase 12 (withdrawal timing) complete via grep (`growthTiming` → v11.ecb auto early/late). Current: v11.10cf, branch main, clean worktree.

---

## Session: 2026-06-26 — Phase 38 UX/Charts batch (complete, v11.10a2, UNCOMMITTED, worktree epic-lalande-01685c)

User punch-list of 10 UX/logic items; scope chosen interactively (AskUserQuestion). Implemented 6,
deferred 4 (with design decisions captured). Plan: `~/.claude/plans/i-notice-a-few-dazzling-shamir.md`.

**Shipped (#1,2,3,4,7,8):**
- **#1 MC deflation floor** — `INFLATION_FLOOR=-0.01` const in `montecarlo/prng.js`; applied in
  `buildStressBank` (line ~97, was raw `infSrc[idx]` → leaked 1932's −9.9% into Stress mode AND the
  bootstrap bear-start overlay which copies the stress bank) and reused in `bootstrapMultiAssetBank`
  (already had the clamp). Verified all 3 bank builders now floor at −0.01.
- **#2 Mirror top scrollbar (Annual Details)** — table wrapped in `#tbl-scroll`; sticky `#tbl-top-scroll`
  strip with `#tbl-top-scroll-inner` spacer above it; `syncTopScroll()` sizes the spacer to
  `table.scrollWidth` + hides strip when nothing overflows; `setupTopScrollSync()` wires bidirectional
  scrollLeft sync; called from updateTable / updateColumnVisibility / showTab('tab-tbl') + init.
  GOTCHA found in browser: strip needs explicit CSS `height:16px` or browser suppresses its scrollbar
  and `scrollWidth` collapses to clientWidth.
- **#3** top Share bar `flex-end`→`flex-start`. **#4** Avg BETR wrapper `#stat-betr-wrap` hidden at init
  unless `NERD_KNOBS` (`?nerdknob`).
- **#7 Milestone overlay** — custom `milestonePlugin` (registered beside `crosshairPlugin`); draws
  dashed vertical + label for first death (status flip), first underfunded (delivered income < spend
  goal), IRMAA onset (IRMAA>0); `computeMilestones(log)`; checkbox `#chk-milestones`/`toggleMilestones`;
  DEFAULT ON (`showMilestones=true`).
- **#8 Income chart → 5 selectable views** (`setIncomeChartView` + `buildAltIncomeChart`): combined
  (existing inline), net (Income/Net/Spend-Goal lines), flows (household: SS+pension+draw up vs
  taxes+spend down), **tax**, **assetflows**.
  - *tax*: stacked components on LEFT primary axis (Federal=FedTax−capGainsTax, Cap Gains, State, IRMAA);
    MAGI + crossed thresholds on RIGHT axis. `computeTaxThresholdSeries(log,adj)` plots ONLY
    federal-bracket / IRMAA-tier boundaries MAGI CROSSES (below some year, ≥ another), inflated per year
    by cumulative CPI (`-cpiFactor`), per-year filing status, labeled `"22% bracket"` / `"IRMAA Tier 1"`.
    DEFAULT ON; `#chk-thresholds`/`toggleTaxThresholds` (shown only in tax view). Lines `order:0/1` over
    bars `order:3` so they're not hidden.
  - *assetflows* ("Earnings vs W/D"): per-account investment earnings stacked up (IRA via new `-iraG` =
    gains.IRA1+IRA2; Roth/Brokerage/Cash from existing *G fields), `netOut` withdrawals down, black
    "Net change" line = earnings − netOut. Roth conversions excluded (internal).
  - New chart-only log fields `-capGainsTax`(=p.tax.capitalGainsTax), `-cpiFactor`(=cpiRate cumulative),
    `-iraG`; leading-`-` so BOTH table header+body filters skip them → no stray Annual column (verified).
  - GOTCHA: in a `type:'bar'` chart, type-less `mkLine` datasets render as bars — needed explicit
    `type:'line'`.
  - Removed redundant lower-chart `<h4>Income and Expenses</h4>` (duplicated the first-tab label).

**Data references (Taxation thresholds):** `TAXData.FEDERAL[status].brackets[{l,r}]`,
`TAXData.IRMAA[status].brackets[{l,tier}]`; year value = `base.l * cpiFactor`; status ∈ {MFJ,SGL};
`p.tax.capitalGainsTax` separate from `federalTax` (ord+CG+NIIT); `applyGrowth` returns per-account
gains incl. IRA1/IRA2.

**Deferred (design decisions captured in plan + task_plan.md):** #6 keep checkbox column model for now;
#9 Cash Reserve = portion of Cash, breakable last-resort floor, refill from surplus; #10 Suggest Spend
Goal = guaranteed income + 5% assets; #5 first-run onboarding stepper.

**Verify:** node 47/47 + taxPaymentPlanner 12/12; in-page 212/212 🟢. Browser: all 5 views render,
threshold crossing filter correct (default MAGI 172–239k → only 22% bracket + IRMAA Tier 1 plot),
milestones+thresholds default on, lines over bars, no stray columns, no console errors. Files:
`montecarlo/prng.js`, `retirement_optimizer.html`, `retirement_optimizer_core.js`,
`retirementopt_styles_responsive.css`. NOT committed.
**Preview gotcha:** screenshot subsystem wedged mid-session (page stayed responsive to eval); recovered
after preview_stop/preview_start. Launch port bumped 8767→8771 in `.claude/launch.json` (untracked).

**NEXT:** commit + open PR for Phase 38; then deferred #9 (Cash Reserve) / #10 (Suggest Spend Goal) /
#5 (onboarding); #6 redesign later.

## Session: 2026-06-25 (cont.) — GK Optimize-Spend stability floor + MC Total Spendable (complete, v11.1097)

**Problem:** With Optimize Spend + Guyton-Klinger, optimizer reported an unnaturally high initial
spend (~$210k) sustainable only ~2 yrs before GK guardrails slash it. Root cause: GK mutates
`spendGoal` dynamically, and both gates the search relies on (`optimizeSpend().passes()` core.js:2131,
`totals.success` core.js:1723) measure the portfolio against that **already-cut** value → moving
goalpost → GK trivially passes at any initial → binary search runs to +50% ceiling.

**Fix A (GK stability floor):** Extended `passes()` (core.js ~2131) with a GK-only check
(`overrides.strategy==='gk'`): worst REAL delivered spend across horizon (`spendGoal/inflationFactor`)
must stay ≥ initial real × (1 − gkGuard). Rejects runaway initials. Non-GK untouched.

**Fix B (MC Total Spendable col):** Threaded `spendPerPath = totals.spendCurrentDollars` (real) →
`medianSpend` through worker.js + mc_controller.js (mirrors taxPerPath/medianTax); added 8th column
`Total Spendable` to MC table (mc_tab.js renderSurvivalTable + html grid template/header).

**Verify:** node 47/47 (+2 new GK optimize tests). In-page 212/212 🟢. Browser MC: 8 cols, Total
Spendable renders current-$ values. Browser optimizer w/ Optimize Spend: GK rows stay at baseline
$140k, **no $210k ceiling row** — runaway gone. Files: core.js, montecarlo/{worker,mc_controller,
mc_tab}.js, retirement_optimizer.html, core.test.js.

**Baseline ranking rework (v11.1098, same session):** baseline-pick (core.js ~2588) was `max(afterTaxNW)`
among no-conv successes → let GK win by hoarding (under-spend → bigger estate). Reworked to a blended
real-$ score `_baselineScore = afterTaxNWCurrentDollars + 1.10*spendCurrentDollars`
(SPENDABLE_WEIGHT const = 1.10; spendable favored +10%). Tried subtracting taxCurrentDollars then
removed it (both terms already after-tax → double-count; user pulled it). Browser: baseline flipped
GK→**IRA Draw** (4040k vs GK 4039k) — the +10% spend weight tips it since GK spends 140k less.
Deltas (_dNW/_dTax) unchanged. node 47/47, in-page 212/212.

**Reduce-N hypothesis checked + Score column (v11.1099):** User suspected aggressive low-N Reduce
underspends → demoted by new score. **Not confirmed** — Reduce-N spend is FLAT $3,111k for all N
(2→25); only terminal NW varies (N=2 → $342k, N=25 → $615k; low N pays drawdown/conv tax earlier).
So low-N ranks low on NW, not spend; +10% spend weight is neutral across Reduce-N. Baseline change
only re-pins ⚓, doesn't reorder the strategy table (still sorts by afterTaxNW). Added nerd-only
**Score** column to optimizer table (getOptimizerColumns, spliced after afterTaxNW when NERD_KNOBS;
grid auto-sizes via `columns.map(()=>'max-content')` — no manual count). Browser: nerd on → Score
present (IRA Draw 4,040,316); nerd off → absent. in-page 212/212.

## Session: 2026-06-25 (cont.) — GK label + Intl-CAGR NaN fix (complete, v11.1091)

Two small fixes after Phase 36:
- **GK label:** MC + Optimizer showed the Guyton-Klinger row param as generic `"guardrails"`. Now
  shows the actual knobs, e.g. `Grd:15 Adj:15`, built from `base.gkGuard`/`gkAdjPct` at both
  `push()` (MC variations, core.js ~:2256) and `addResult()` (optimizer ~:2419).
- **Intl CAGR = NaN% (MC bootstrap):** root cause = data-length mismatch. `HISTORICAL_RETURNS`
  equity/bonds/inflation were extended to **2025 (98 entries)** but `intl` still ends **2024 (55)**.
  A sampled block hitting idx 97 (year 2025) computed `intlSrc[55]` → `undefined` → `log1p(NaN)`.
  Strategy (`str=gk`) was incidental — bug is in `montecarlo/prng.js`, mode-independent. Fix: extend
  the existing pre-1970 equity-proxy to ALSO cover recent years with no intl data yet — guard
  `idx - intlOff < intlSrc.length` in both `bootstrapMultiAssetBank` and `buildStressBank`. No
  fabricated data. (Real 2025 MSCI EAFE point belongs to Phase 34.)
- **Cache-busting (so the fix reaches returning users):** `montecarlo/worker.js` now appends its own
  `?v=…` token (`self.location.search`) to every `importScripts` so prng.js/core.js refresh with the
  worker; HTML MC `<script>` tags bumped `?v=11eca`→`?v=111091` for the main-thread fallback path.
- **Files:** retirement_optimizer_core.js (2 GK labels), montecarlo/prng.js (2 intl-proxy guards),
  montecarlo/worker.js (importScripts cache-bust), retirement_optimizer.html (v11.1091 + changelog +
  script `?v=` bump).
- **Verified:** node **45/45**. Browser (http.server :8773, URL `?str=gk&gkg=15&gka=15`): bootstrap MC
  via worker → **Intl CAGR +8.3%, zero NaN**, completed 30s, no console errors; MC + Optimizer GK rows
  show **"Grd:15 Adj:15"**. Main-thread `bootstrapMultiAssetBank` also NaN-free (8.48%).

## Session: 2026-06-25 — Phase 36: Soft vs Strict Withdrawal Caps / large-shortfall fix (complete, v11.1090)

User repro: `?sg=160k&str=bracket&sr=22&d1=74&by2=1959&i1=2m&i2=1e5&ro=0&ro2=0` showed a shortfall
starting 2039 growing to ~$75k/yr by 2043 despite a $2M+ IRA. Root cause: `bracket`/`fixedpct`
capped IRA at the bracket ceiling and only gap-filled Cash→Brokerage→Roth — no IRA fallback — so
after person 1's death halved the bracket (MFJ→single, `:953`), the abundant IRA was stranded.
Survivor-SS step-up + filing switch were already correct (not an SS bug).

**Decision (user):** soft caps for tax-based ceilings, strict for ACA.
- **Soft (`bracket` Federal, `minlimit`/IRMAA, `fixedpct`):** new bounded convergence loop in
  `simulate()` (after the 3rd pass) draws extra IRA ABOVE the ceiling to fund mandatory spending
  when Cash/Brokerage/Roth are exhausted. Recorded in new `forcedIRA` (+`totals.forcedIRATotal`)
  and the recomputed `BracketOverage`. `fixed`/`propwd`/`baseline`/`gk` left unchanged.
- **Strict ACA → its own internal strategy id `aca`:** `getInputs()` derives `strategy='aca'` when
  `stratACAMultiple>0` (UI keeps ACA as a stratRate sub-option; legacy URLs/scenarios still load).
  ACA never breaks the FPL cap (subsidy cliff); leftover spending stays a shortfall, flagged via
  `acaBreach`/`totals.acaBreachYears`. Optimizer ACA rows now `strategy:'aca'`, marked untenable
  (`_isACAUntenable`, ⚠️) and hidden-by-default like infeasible bracket rows. `loadOptimizerResult`
  + `applyScenario` map `aca`→`bracket`+stratRate for the (option-less) strategy dropdown.

**Files:** retirement_optimizer_core.js (flags, convergence loop, getInputs derivation, log field
`ForcedIRA`, column/group/tooltip maps, optimizer flag+filter+row mapping); retirement_optimizer.html
(How-to split soft/strict, shortfall-row note, changelog, v11.1060→11.1090); README.md (ACA strict
rewrite, wishlist item resolved, Recent-Fixes entry); retirement_optimizer_core.test.js (+6 tests).

**Verified:** node **45 pass / 0 fail**; browser (http.server :8773) in-page **212 pass / 0 fail**,
no console errors. Repro: 2039-2045 shortfall→0 (forced IRA funds, overage flags); remaining
late-life shortfall is genuine full depletion (IRA=Cash=Brokerage=0 by ~2052 at age 93-98),
correctly `success=false`. ACA 400% FPL: forcedIRA=0, breachYears>0, untenable. Optimizer (startAge
60) shows "ACA Cliff … ⚠️" rows.

## Session: 2026-06-23 — Phase 33: Inflation-Aware Stress Test Scoring (complete, v11.1048+)

Stress mode was scoring worst decades by 10-year equity CAGR alone, missing the compounding effect of inflation. A decade with flat equity (+0% CAGR) but 7% inflation is retiree-devastating (real −7%), yet ranked better than it should. Fisher equation fixes this.

- **montecarlo/prng.js `buildStressBank()`:**
  - Changed scoring from nominal equity CAGR → real CAGR via Fisher equation: `rcagr = (1 + eqCagr) / (1 + Math.max(-0.005, infCagr)) − 1`
  - Deflation floor (−0.5%) excludes only 1930s extremes; preserves modern modest deflation (2009 etc)
  - Labels now 3-part format: `"1970 (eq: +6.0% inf: +7.0% real: -1.0%)"` instead of just year
  - Added `decadeRealCAGRs[]` to return object (mirrors existing `decadeInflCAGRs`)
  - `applyBearStartOverlay()` automatically uses new real-CAGR-based worst-sequence selection
- **montecarlo/{worker,mc_controller}.js:**
  - Added `stressRealCAGRs` to message payload alongside existing equity/inflation CAGRs
- **montecarlo/mc_tab.js `_renderStressChart()`:**
  - Chart legend now shows 4-part label: `"1970 (eq: +6.0% inf: +7.0% real: -1.0%)"`
  - Constructed from stressStartYears + stressDecadeCAGRs + stressInflationCAGRs + stressRealCAGRs
- **Tests:** 33 pass, 0 fail (no regressions)
- **Verified:** 
  - Real CAGR scoring orders decades correctly (Fisher equation)
  - 1970s-era high-inflation sequences rank higher in worst list (real purchasing-power loss captured)
  - Browser test: MC stress mode runs, chart displays 10 worst sequences with new labels
- **Status:** complete (ready for production)

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

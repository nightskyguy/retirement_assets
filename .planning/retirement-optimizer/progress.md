# Progress Log

## Session: 2026-08-03 (worktree context-ab498f) — P35/P36/P37 planning, no code

User asked to summarize the backlog with a focus on withdrawal strategy, then proposed a new
**"Phased"** strategy: phases for ACA (to 65), IRA control, balanced, first death, survivor, and a
post-death legacy period, plus a modeling study to find inefficient strategies and prunable
variations. Planned in plan mode. **No product code touched.**

**Design outcome.** The proposal contained four separable products, and two of them change results for
every existing row independent of Phased. Split per the user: Phased + basis step-up ship together
(P35), the efficiency study is P36, the LEGACY heir drawdown is deferred as P37.

The user's own refinement is what made P35 cheap: **IRA_CONTROL and BALANCED are not sequential phases**
needing a state machine, they are a per-year split on `yr.curIRA` (`optimizer_core.js:1181`), which the
engine already computes. That removed the hysteresis question entirely, and the IRA target turned out
to be an input that already ships (`#iraBaseGoal`) — I had proposed inventing one and the user
corrected it.

**Ten engine facts surveyed and written to `findings.md`** ("P35 engine survey"), several of them
traps. The sharpest, caught only by reading the code after a plan agent contradicted an earlier
exploration: **`isDeathYear` (`optimizer_core.js:1103`) is the FIRST SINGLE year, not the last MFJ
year.** `alive = age <= die`, so `age === die` is the last `'MFJ'` year and `isDeathYear` tests
`age === die + 1`. Phase 3 wants the earlier year. Reusing the existing flag would have inverted the
feature silently, since both years exist and both produce plausible numbers. Others: the ACA cap has
no age test at all and models zero subsidy dollars; no basis step-up exists anywhere; the sim ends at
the last death year with terminal value as a one-line flat haircut; survivor spend never drops (only
pension does, and only in the `!alive1` branch); the Optimizer and Monte Carlo sweep **different grids**
(44 families vs 36, IRA Draw 20% vs 10%) with the optimizer's enumeration unexported and untested; and
**the sweep already exceeds its own 1,500-run budget at 1,711 runs**, absorbed by silently halving the
stop-year candidate pool from 12 to 6.

**User decisions.** ACA ceiling after 65: none, released outright — with the consequence recorded that
for the standalone `aca` strategy this drains the whole above-goal IRA in one year, since unbounded
room collapses `Math.min(curIRA, room)` to `curIRA`. FIRST_DEATH ceiling: none, convert everything
above the IRA Goal (same principle, so no new bracket input). `deathBasisStepUp` defaults to `'half'`
now, making that PR deliberately non-byte-identical. `survivorSpendPct` ships at 100 with the real
default decided by the study. Sweep arm count decided by the study rather than guessed — which
reordered the study ahead of sweep integration, since it runs in node where there is no budget.

**Recorded:** `task_plan.md` header refreshed (was stale at PR #141 / `4272eb8`; main is `34feeb8`
with #142/#143/#144 merged), Priority Order rows 37-39 added, P13 annotated as possibly superseded by
P35, and the three phase sections appended with "already ruled out" blocks in the P29-P34 house style.
`findings.md` gained the engine survey. Full 8-PR design lives at
`C:\Users\starc\.claude\plans\composed-marinating-garden.md`.

**Process failure, repeated from 2026-07-25 and worth a guard.** All three files were first written to
the **main checkout** (`C:\Users\starc\source\retirement_assets\`) instead of this worktree — the exact
mistake the 2026-07-25 entry below already records, and the reason the global CLAUDE.md carries a
worktree-path rule. It was caught only because `git status` in the worktree came back **empty** after
three successful-looking edits. Recovered without loss: `git diff` in main confirmed all 432 insertions
were mine and nothing pre-existing was entangled, the diff was exported as a patch, `git apply --check`
proved it applied cleanly here, then main's three files were reverted individually — leaving main's own
uncommitted work (a staged `README.md` on branch `20260803_Readme`, plus two untracked files)
untouched. **The cheap guard: an empty `git status` right after editing is a failure signal, not a
clean tree.** Check the path before the first edit, not after the last one.

**Next:** P35 PR 1 (characterization goldens for both enumerations). Work proceeds in stages with a
review point per PR.

## Session: 2026-07-26 (worktree readme-review-updates-c9df11) — PR1 Roth conversion diagnostics (v11.1370)

User asked why the Optimizer reports "found none where converting more improves the result" on default inputs, plus four follow-on tasks. Planned in plan mode; user chose to do PR1 only (Roth conversion batch + BETR removal) and re-plan SS timing / head-to-head compare / MC stress auto-run later.

**Investigation first, in the real engine.** Established that the feature is correct: the candidate pool is properly diversified (10 of 12 hold $700k-$1.3M terminal IRA, so PF11 holds), the sweep honestly returns `optConv: 0`, and the actual lever is the assumed future/heirs rate (24% → $0, 40% → +$42,355, 65% → +$200,516 on a $1.29M-IRA candidate). Also confirmed the apparent "conversions help at lower spend" effect is the P2 cash-drag confound: +$20,539 with Cash Reserve off, **$0** with reserve on + DRIP. Full detail in findings.md.

**Shipped:**
- **A.** `Avg BETR` column and the `#stat-betr-wrap` summary tile removed (the tile had only been nerd-gated, never removed, despite README:183 claiming otherwise). `computeBETR`/`totals.betrAvg`/Annual Details `BETR%` untouched; added a caveat to the Annual Details BETR tooltip, which still asserted the metric was decisive.
- **B.** `Conv Savings` → **`Tax Paid Δ`**, tooltip rewritten to lead with the limitation. Worked example: +$197k "saved" alongside a ~$145k after-tax loss at defaults. Key/sort/objective untouched.
- **C.** New pure `breakEvenHeirsRate()` + `lowestBreakEvenHeirsRate()`; banner now names the assumed rate and offers an on-demand "What rate would change that?" link (click-triggered, ~0.5-1.2s — same affordance as the Break Even ⓘ).
- **D.** New pure `bestTimeLimitedConversion()` — convert-then-stop, a shape the flat sweep cannot express. Runs only for candidates the flat sweep left empty, capped at 6 by terminal IRA to stay in budget. Rows tagged `⏹YYYY`; `_convEndYear` restored by `loadOptimizerResult`.

**Three real bugs caught by cross-validating the fast paths against brute force, none visible from code review or a green test run:**
1. A coarse 8-point probe grid reported "never pays" where the true answer was 48%, and 25% where the truth was 15% — paying amounts are ~16% of the IRA and an even grid steps over them. Replaced with the real $25k grid, early-exiting on first improvement.
2. A "skip candidates with no IRA left" filter looked obviously safe and lost the right answer (25% vs a true 5%): a plan that drains its IRA still gains from converting *earlier*.
3. Float rounding let the snapped rate land just below threshold, printing a rate next to a $0 conversion. Now nudges up one step and returns null if the sweep still disagrees.

**Latent engine inconsistency found, not fixed (logged in findings.md):** a per-year `extraConversionAmount` array and the equivalent scalar + `convEndYear` produce identical per-year conversion dollars but *different* simulations (opening-year `RMDwd` 16,620.92 vs 15,771.24; `finalNW` 679,867 vs 639,182). The array path also reported time-limited "gains" that vanish under the scalar form. `bestTimeLimitedConversion` scores the **loadable** form so rows and loaded plans agree by construction (the PF8 lesson), but one of the two paths is presumably wrong.

**Verification:** node **122/122** (114 + 8 new, all expected values derived from the engine first, incl. a monotonicity tripwire pinning the binary-search precondition). Browser (v11.1370, port 8768): BETR gone from tile + table, retained in Annual Details under Opp. Cost; `Tax Paid Δ` renders; banner names the 30% assumed rate; diagnostic reports 43%; **setting Future IRA Tax % to 45% produces 2 ⇌ rows, both time-limited (⏹2026/⏹2027) — plans the old flat sweep could not express**; clicking one reproduces the row exactly ($1,168,707 / $580,176). Cost 1240ms / 1538 runs (was 2216 runs before the 6-candidate cap). Console clean apart from the 4 known intentional bad-input fixtures.

**Note:** `.claude/launch.json` preview port moved 8767 → 8768; a stale `python3.12.exe` holds 8767 without serving.

## Session: 2026-07-25 (cont.) — README audit round 2 + AiRA tool review (PR #131)

Follow-up README pass after PF129/PR #130 planning-notes merge. Three commits, all doc-only (`README.md`, `.gitignore`, new `.planning/FILE_DIRECTORY.md`):

1. **`9ca111c` README audit fixes:** rebuilt ToC (was missing the whole FAQ section, 3 Free Tools entries, misfiled NumberCrunch Nerds), fixed a broken chatgpt.com link (stray trailing quote), renamed a duplicate BETR heading (GitHub anchor collision), added Retirement Tax Planner + IRMAA-and-RMDs quick-launch entries (existed but were undocumented), added a missed Recent Fixes bullet, ~20 spelling/grammar fixes. Plus: `.gitignore` entry for `netcitizen.us.*` (personal-email DNS notes file), and new `.planning/FILE_DIRECTORY.md` mapping every repo file to its purpose (documents that root-level `*.html` + `HYSA_*` files are intentional redirect stubs, not stale dupes).
2. **`18ce139` AiRA tool review:** new "AiRA Retirement Application" entry under Free Tools (announced 2026-07-25 on r/DIYRetirement) with first-look notes (bucket strategy, missing tooltips, a D-Day/retirement-date discrepancy found during testing); linked to the "Is It a Fool's Errand…" FAQ entry. Dropped "Anonymous Reddit Tool" (dead — tool no longer exists). Fixed a few mechanical hand-edit issues (empty ToC anchor, a link split across two lines, typos, stray divider).
3. **`1a99fd3` polish:** rejoined a link split across two lines, subject-verb agreement fix, cleaned up bucket-strategy sentence, expanded the McQuarrie closing note (present-value/inflation reasoning for why early tax payment is a real hurdle for Roth conversions).
4. **`a04f1d8` misc fixes:** wrong references + typos.

Merged as [PR #131](https://github.com/nightskyguy/retirement_assets/pull/131) (`c9c6b57`). Working tree clean at `c9c6b57` in worktree `readme-review-updates-c9df11`. No code/engine changes — README + repo-hygiene only.

## Session: 2026-07-25 (worktree context-ab498f) — README FAQ + changelog refactor + Cash Reserve "Off" (v11.1340, PR #129)

User asked for a README FAQ section, then iteratively for a changelog restructure (the inline changelog had grown to bloat every page load), a single source of truth for the version number, and finally for Cash Reserve to default to an explicit "Off" instead of a blank/`-1` sentinel.

**README FAQ:** 6 Q&A entries added after the Taxation section (Cash Reserve/dividend interaction, depletion scenarios, cash interest routing, brokerage-vs-cash distinction, Roth conversion efficiency pointing at the Stop-Year feature, BETR reliability). Matched the existing Taxation section's conversational-precise tone (real dollar examples, "However"/"But" gotchas).

**Changelog restructure:** Inline changelog trimmed to the 5 most recent entries; older entries (v11.12e5 and back, ~90 entries) moved to new `optimizer_history.js`, fetched via `fetch()` only when "Older changes…" is expanded. Added a "Version" stat to the Summary Header and an always-visible "Latest Change" banner above the collapsible Change Log (with a `data-flag="behavior"` convention for entries that change computed results, applied to the existing Cash Reserve P2 entry).

**Two real bugs found only by live browser testing, not by static file review** (both are why "read the diff" isn't sufficient verification for anything touching `<script>`/`<details>` structure):
1. An unclosed HTML comment (`<!-- ORIGINAL ENTRY (REPLACED): ...` with no closing `-->`) silently swallowed everything from the changelog through the entire "How to Use" section as invisible comment text — the page rendered truncated. Root cause: an Edit tool call's `old_string` only matched a single `<li>` line, so the "replacement" comment-open tag got prepended before it while everything downstream of that line (the rest of the changelog, "How to Use", etc.) stayed in the file unchanged but now inside the never-closed comment. Fixed by deleting the dead duplicate block (content was already preserved in `optimizer_history.js`).
2. The lazy-load's expand handler listened for `click` on `<summary>` and read `this.parentElement.open` — but that reads `open` BEFORE the browser applies the toggle on a native `<details>`/`<summary>`, so it was always stale-`false` and the fetch never fired. Fixed by listening for the `toggle` event on `<details>` itself, which fires reliably after the state change.

**Version single-sourcing, with a real regression along the way:** first pass derived both `<title>` and the Version stat from the changelog's first entry via JS. That broke Google Analytics — `gtag('config', ...)` fires from a `<script>` in `<head>`, essentially immediately, long before any body script runs, so GA was logging every pageview under an unversioned title. User caught this from GA's dashboard (not from anything visible in the page itself). Fixed by reverting `<title>` to hardcoded (as it always was) and having the Version stat read the number back OUT of `document.title` at runtime instead — cutting one duplicate (the stat) while leaving two hardcoded values (`<title>`, changelog's first `<li>`) that must be bumped together, per user direction ("keep them in sync via comments, don't over-automate it"). Cross-referencing comments added at both spots.

**Cash Reserve defaults to "Off":** was `value=""` with tooltip text "LEAVE BLANK (or enter -1)"; now `value="Off"`, tooltip says only "Enter Off". Blank and `-1` still parse identically to `undefined` (OFF) in `getInputs()`/`maybeWarnCashReserveActive()` for backward compatibility with old saved scenarios/shared links, but are no longer advertised anywhere in the UI. A capture-phase `blur` listener on `#CashReserve` intercepts before the shared `attachNumericDollarInput` helper's bubble-phase handler runs, so typing "Off"/"OFF"/"off " normalizes cleanly instead of being reformatted to `$0` or reverted — verified this bypass is genuinely necessary (not just cosmetic): without it, switching from a real number back to "Off" would get silently reverted to the old number by the shared helper's null-parse fallback. User explicitly rejected offering "(or leave blank)" as an alternative in the tooltip, and rejected a changelog entry/version bump for this change (default-value/labeling, not a behavior change).

**Verification:** `node optimizer_core.test.js` 114/114 throughout (engine layer never touched — the whole design constraint was that `optimizer_core.js` must only ever see `undefined`/number for `CashReserve`, never a string). Browser: fresh-load default is "Off"; "Off"/"OFF"/"off "/blank all produce identical simulation results (`-1` reproduces a separate, pre-existing, out-of-scope blur-clamp-to-`$0` quirk); realistic scenario save/load round-trip preserves "Off"; legacy scenarios with a raw `-1` still parse as Off (cosmetic "$-1" display artifact, also pre-existing); share URL omits the Cash Reserve param when "Off", identical to how it's always omitted blank; changelog shows 5 inline + lazy-loads ~90 more via real XHR (200 OK); no new console errors beyond the 4 pre-existing intentional bad-input test fixtures.

**Process note:** edits were made in the main repo path (`C:\Users\starc\source\retirement_assets\`) rather than this worktree, and had to be synced across by hand after the fact (`cp`) before each browser verification pass — worth an explicit `pwd`/path check at the start of an editing session inside a worktree.

Committed + pushed as [PR #129](https://github.com/nightskyguy/retirement_assets/pull/129).

## Session: 2026-07-17 (worktree mystifying-babbage-559d99) — PF12: accurate IRA-withdrawal accounting + prefer-larger conversion sourcing (v11.129d)

User reported (URL with `eca=150k` + `fcc=1`): Annual Details showed a 150k Roth conversion in a year with $0 strategy IRA draw, and later years "converted more than was withdrawn." Empirically root-caused (browser, deployed v11.1287): engine math conserves (per-year IRA balance reconciles to $0 residual, conversion tax genuinely paid) — the defect was **incomplete per-account accounting**. `applyExtraConversion`/`applyConversionGrossUp` mutated only aggregates (`totalTax`, `balance.IRA`, `totalConverted`) and never the granular log fields, so (1) `IRAwd`/`IRA1-`/`IRA2-` omitted conversion pulls and (2) `FedTax`/`StateTax` omitted the conversion tax (added to `totalTax` only). Accuracy is load-bearing because clicking a year passes these to RetirementTaxPlanner.html for tax-payment planning.

Planned in plan mode across 4 clarifying rounds; the plan evolved from "display-only" to a real behavior change per the user: **conversions now source from the larger IRA** (spill to the smaller only when the larger can't cover). Scope landed on the additional pulls (extraConversion + gross-up) via a new `splitPreferLarger()` helper; `convertExcessToRoth` reallocation stays proportional (already ~larger-weighted; its attribution must match its proportional debit).

Implemented:
- **optimizer_core.js:** `splitPreferLarger()`; extra-conversion + gross-up now source prefer-larger and accumulate per-account `yr.iraConvGross1/2`; `routeSurplusAndConvert` sets `yr.iraVolSpend1/2` (spending draw) + seeds `iraConvGross` from conv1/conv2. `buildSimYearLogRecord`: `IRA1-/IRA2-` = voluntary total (spending + conversion gross, excl RMD), `IRAwd` = their sum, plus hidden `-iraVolSpend1/2`, `-iraConvGross1/2`, `-iraSpend`, `-iraConvGrossTot`. Fed/State attribution: extra conversion sets `yr.tax.federalTax/stateTax = _exTaxCalc.*` (exact); gross-up splits `taxCost` by marginal-rate proportion. `logYear` threads the new fields. **Only readers of `yr.tax.federalTax/stateTax` are the log record (714-715), so no simulation feedback — combined `totalTax` unchanged; only the IRA1-vs-IRA2 split (→ per-spouse RMDs → long-run totals) shifts.**
- **optimizer_ui.js:** `openTaxPlanner` passes true per-IRA voluntary (`-iraVolSpend*`) + conversion gross (`-iraConvGross*`), replacing the dump-onto-larger-balance hack and the imprecise `IRA1- − RMD1-`. Income-composition views (`visibleSum`, 'IRA WD' bar) switched from `max(0, IRAwd − rothConv)` to `-iraSpend`. **Inflows/Outflows ('flows') chart left as-is** — its 'IRA draw' bar already intends conversion-inclusive IRA draw and `_acctScale` keeps up=down balanced (verified up 429,200 = down −429,200); the deeper redesign the user flagged is deferred. Tooltips for `IRAwd`/`IRA1-`/`IRA2-`/`extraConv` updated.
- **retirement_optimizer.html:** changelog + version 11.1287→11.129d, both `optimizer_core.js`/`optimizer_ui.js` cache tokens → `?v=11129d`.
- **optimizer_core.test.js:** +4 tests (prefer-larger sourcing incl. spill; per-account identity + IRA balance reconciliation `IRA_end = prev + iraG − RMD − IRAwd`; conversion-gross conservation; Fed+State+IRMAA == totalTax for extra-conversion and gross-up-only years). All expected values empirically derived from the real engine first.

Verify: node **77/77**. Browser (local server, user's exact URL): year 2026 `IRAwd` 0→150,000, all sourced from the larger IRA (`IRA1-`=150,000, `IRA2-`=0), `rothConv ≤ IRAwd`; `FedTax 5,770→46,300`, `StateTax 5,156→18,934`, Fed+State+IRMAA==totalTax (65,234); Taxation chart Federal bar 42,071 (was ~1,541), Cap Gains flat; RTP handoff accurate per-IRA; all 5 income-chart views build, no non-finite, flows balanced; no console errors, badge 🟢. Not yet committed.

## Session: 2026-07-14 (worktree mystifying-babbage-559d99) — PF8 implemented (v11.1253)

User asked to implement the PF8 plan (issue 1 fix + issue 2 tooltips; issues 3/4 stay informational, no code). Implemented all 9 steps plus the 2 tooltip rewrites, then version/changelog/cache-bust (both `optimizer_core.js` and `optimizer_ui.js` cache tokens bumped since both files changed).

Verification exceeded the plan's checklist. Live end-to-end repro of the original GK bug: optimizer row `optConvAmt:$550,000, convBEYear:2037` (today's date shifted this slightly from the earlier $525k figure -- expected, not a regression); loading that row now sets the sidebar field to $550,000 and the single-scenario Break Even stat reads **2037**, matching exactly (was "--" before this fix). Plain-row load resets the field to $0, confirmed. Both contamination guards proven directly: `runOptimizer()` gives byte-identical plain-row totals with vs. without a stray $300k sidebar value; `buildVariations()` shows 0 of 108 variations contaminated with a stray $777k `base.extraConversionAmount`, while the real value survives in the caller's own `base` reference (required since `mc_tab.js` reuses that exact object as `_mcBase`). Share-URL and scenario save/load round-trips both confirmed (the scenario round-trip needed a redo after I called `saveScenario()`/`loadScenario()` with a name argument they don't accept -- correct functions are `saveScenario()` (reads `#scenarioName`) and `loadScenarioByName(name)`; my own test-script error, not an app bug, caught and corrected before drawing any conclusion).

Cyclic-row branch (bug 1b's `cyclicEnabled`/`cyclicOrder` fix) didn't get a live top-5 repro -- no cyclic variant happened to win top-5 in the scenarios tried. Verified instead via direct code re-read (matches the established conditional-spread pattern for the other fields in the same object) plus a materiality check (`cyclicEnabled` only changed finalNW by ~$174 on this scenario's data, so the omission's practical impact was scenario-dependent, but the code path is real and the fix is mechanically correct). Flagging this honestly rather than claiming a full live repro I didn't get.

node 62/62 throughout (no engine logic changed, only a new pass-through field + zero-guards). Not yet committed.

## Session: 2026-07-13 (worktree mystifying-babbage-559d99, cont. 2) — PF8 investigation: 4 issues after PF7 (PROPOSED, not implemented)

User tested PF7 and reported 4 issues, entered Plan Mode. Investigated via 2 parallel Explore agents + my own live browser reproduction (same local-server-plus-JS-eval workflow as PF6) + 1 Plan agent for the fix design -- every load-bearing citation from the Plan agent spot-checked directly against source before trusting it (all confirmed exact: `runOptimizer()`'s `base=getInputs()` at line 368, `buildVariations()`'s `push()` helper, HTML placement lines, `DisplayHelpers.setDollarValue`).

**Issue 1 (real bug, confirmed by both Explore agent and my own repro):** clicking "load this strategy" on an Optimizer ⇌ row never carries over `extraConversionAmount` -- confirmed this field has ZERO presence anywhere in the single-scenario tab (no HTML input, not in `getInputs()`, not URL-shareable, exhaustive grep). Reproduced live: optimizer showed GK ⇌ row with `optConvAmt:$525,000, convBEYear:2037`; loading GK manually (maxConversion checked, no way to set the $525k) produces only trickle RMD-driven conversions and correctly shows all-negative convOC. Not a math bug -- the optimizer and single-scenario tab silently evaluate two different plans under one label. Plan agent found 2 additional related gaps I hadn't asked about: the Phase-23 `overrides` builder also drops `cyclicEnabled`/`cyclicOrder`/`stratIRMAATier`/`stratACAMultiple` (same silent-mismatch bug for cyclic/IRMAA-Ceil/ACA-Cliff top-5 winners), and -- more importantly -- once a new sidebar field for this exists, BOTH `runOptimizer()`'s main 176-192-row sweep AND `buildVariations()` (used by Monte Carlo) would silently leak a leftover nonzero value into every other strategy/variation unless explicitly zero-guarded. Full 9-step fix designed, not yet implemented.

**Issue 2 (doc-only, confirmed):** `_convSavings` (optimizer_ui.js:610ish, realized lifetime tax $ saved) and `convOC`/`convBEYear` (after-tax wealth, prices in deferred tax on whatever's left un-taxed in the counterfactual's IRA) are structurally different metrics -- both correct, can point opposite directions. Empirically demonstrated during PF7 verification: one scenario showed `_convSavings:+$191,620` alongside `convBEYear:null` and `convOCFinal:-$154,370`. User's intuition (should be at least one BE year for it to represent a real win) confirmed correct for "total wealth impact" specifically; Conv Savings answers a narrower "realized tax paid so far" question. Tooltip rewrite proposed, not implemented.

**Issue 3 (effort estimate only, as asked):** top-5-by-finalNW pool is orthogonal to which family's conversions specifically would break even. 3 tiers scoped (cheap betrAvg-broadened pool ~2-3x cost / expensive full-sweep opt-in "Deep Search" ~500-2000+ calls / full variant space) -- no implementation proposed, informational.

**Issue 4 (explained, no code needed):** reproduced exact reported shape locally (default inputs, strategy=fixed/nYears=10 = "Reduce"): 2033/2034 both runs' blended tax rate = 17.00%; 2035 actual drops to 11.51% (crosses a bracket boundary) while counterfactual stays 17.00% that year, converging in 2036. `sim.nominalTaxRate` is a discrete per-bracket step function (`taxengine.js` `nr` field) applied to each run's full remaining IRA balance in `totalWealth` -- not continuous. The two runs cross the same threshold in different years because years of prior conversions diverged their income trajectories, producing a one-year valuation blip unrelated to that year's actual (tiny, $69) conversion. Same root mechanism as the pre-existing self-documented "TAX GAP" comment found during the original PF6 investigation. PF6's sustained-crossing fix already correctly returns `convBEYear:null` for this scenario -- no false positive reaches the user-facing stat. Cross-verified against Reduce-strategy Explore agent's independent static-code trace (agent found the same dominant mechanism via `.nr` bracket-snap divergence, plus confirmed the amortization-schedule hard-cliff at `nYears` explains WHY only 2035 has any conversion, and IRMAA's 2-year lookback as a real but later-only contributing factor).

Full write-up, exact code for issues 1-2, and all supporting investigation detail in `~/.claude/plans/i-think-there-is-jazzy-dawn.md` (Round 3 section). **Nothing implemented yet** -- user interrupted the ExitPlanMode approval request to ask for a plain-language summary + alternatives first, given the volume of findings.

## Session: 2026-07-13 (worktree mystifying-babbage-559d99, cont.) — PF7: Break Even in the Optimizer (v11.1247)

Follow-up to PF6 in the same session. User asked two questions: impact of ranking the Optimizer by earliest Break Even year when Optimize Conversions is selected, and whether a cheap existing signal could pre-filter likely-to-break-even strategies before running the expensive counterfactual on all of them.

Investigated via 1 Explore agent (empirically verified against real code, some counts cross-checked in a Node vm sandbox): `runOptimizer()` sweeps 176/192 rows at 1 `simulate()` call each -- adding a full convOC counterfactual to every row would roughly double sweep cost. The existing Phase 23 "Optimize Conversions" pipeline (`includeConvOpt`) already narrows to the top 5 successful strategies before doing anything expensive, which is exactly the "cheap filter then bounded expensive work" pattern the user was asking about in Q2 -- it already existed in this codebase, just wasn't wired to convOC. `totals.betrAvg` (Kitces BETR) also confirmed as a free, already-computed, already-displayed signal that answers the same "likely to pay off" question with zero extra simulate() calls.

Wrote the analysis + a scoped recommendation into the plan file (explicitly framed as "confirm direction before implementation-ready plan," since the user's questions read as exploratory) and called ExitPlanMode; came back approved. Implemented the narrow, clearly-recommended option only: wired `computeOC:true` into the Phase 23 top-5 pipeline (each candidate's already-known winning `optConv` re-run once more, +1 simulate() call plus its internal counterfactual per candidate -- negligible next to that pipeline's existing ~11-41+ call sweep per candidate). New "Break Even" optimizer table column, new `earliestbe` nerd-mode objective ranking ascending by BE year with non-qualifying rows tied at the bottom (`?? 9999`) rather than a raw unguarded earliest-year sort -- deliberately avoided reintroducing the same "reward a trivial/tiny blip" distortion PF6 had just fixed. Did NOT extend this to the full 176-192-row main sweep (flagged as a possible expensive follow-up, not requested).

Verify: node 62/62 (no engine changes, purely optimizer_ui.js/HTML). Browser, two scenarios: (1) the user's original PF6 bug-report scenario -- 1 conversion-optimized row, `convBEYear:null` correctly (that $100k/yr conversion strategy never sustains a lead: `convOCFinal:-$154k` despite `$191k` of raw tax savings, a concrete demonstration that the pre-existing tax-savings-only `conveffect` objective can recommend a strategy that loses money in wealth terms); (2) a smaller/more typical scenario -- 4 conversion-optimized rows, all real `convBEYear:2049` with $265k-$315k final gains, correctly sorted above all null rows under the new objective. No console errors either run. Not yet committed.

## Session: 2026-07-13 (worktree mystifying-babbage-559d99) — PF6: Break Even sustained-crossing fix (v11.1240)

User reported Break Even firing on year 1 of a real scenario (URL with fixedpct strategy, uncapped maxConversion, futureIRATaxRate=34% override, 10%/yr IRA drawdown, both spouses on Medicare), with every year after showing negative Opp. Cost -- user's own hypothesis was "the calculation is correct but year-1 is an outlier."

Investigation: 2 parallel Explore agents (engine convOC/BE logic with exact file:line citations; URL short-param decode + fixedpct/IRMAA2/maxConversion mechanics) + direct reads of the critical code (`routeSurplusAndConvert`, `cfRefundIRA`, `evaluateYearOutcome`, taxengine.js `nr`/nominalRate machinery) + live empirical reproduction: replayed the user's exact URL against a local static server on the current worktree code (60/60 node baseline first), inspected `lastSimulationLog`/`lastTotals` directly via browser JS eval. Confirmed: 29 years (2026-2054), convOC = +$1,485 in 2026 only, negative every year after through -$107k at 2054 (never recovers, only 1 of 29 rows non-negative). Root cause confirmed as user suspected: `.find()`-based "first touch" BE-year selection with no persistence check -- same bug class PF5 fixed, one failure mode PF5 missed.

Design: 1 Plan agent independently validated the fix direction (rejected "N consecutive years", "last crossing regardless of trailing dips", and "gate on final row only" as inferior alternatives) and empirically pre-verified the proposed code via `node -e` against the real engine for all 6 existing PF5 OC tests (zero regressions, including the highest-risk Test 2) plus 2 new regression tests, before any file was touched.

Implementation: new `_sustainedBEYear(key, actionAmount)` helper in `optimizer_core.js` (replaces the two `.find()` calls) -- backward scan for the earliest start of the trailing non-negative run reaching the log's last row, forward scan for the action-occurred gate, `Math.max` of the two cutoffs. Updated 6 doc/tooltip/comment locations (optimizer_ui.js x2 + comment, retirement_optimizer.html stat tile + Docs paragraph, README.md) from "first non-negative year" to "permanently pulls ahead and stays ahead" -- caught and corrected em-dashes in the Plan agent's drafted text per standing style preference before applying. Changelog v11.1240 (`hex(194*24+16)`), cache-bust `optimizer_core.js?v=111240`.

Verify: node 62/62 (60 existing + 2 new, zero regressions). Browser: reloaded user's exact URL post-fix -- `convBEYear` now null, stat tile DOM shows "--", "Roth Break Even" chart milestone correctly absent, zero console errors. Cross-checked the PF5-era known-good case ("$50k/yr conversions -> +$314k gain") by replaying the exact `OC_BASE`+`extraConversionAmount:50000` test fixture via browser JS eval against the loaded engine -- confirmed `convBEYear=2041` unchanged, gain $313,866, all years from 2041 onward non-negative. Not yet committed.

## Session: 2026-07-09 — PF5: Break Even dual-sim counterfactual + small-screen UX (v11.11dc)

Review session (branch worktrees/retirement-optimizer-review-c4e406). Three analyses: architecture (findings recorded in task_plan.md for P15), Break Even accuracy, small-screen UX. Break Even proven broken empirically: reported a BE year with ZERO conversions (Roth-heavy: year 0; IRA-heavy: 2045), and reported no BE for conversions that gained +$314k after-tax. Root cause: shadow-delta formula mixed the baseline portfolio into the comparison and never charged the no-conversion world its larger RMD taxes/IRMAA.

Shipped PF5 per user direction ("financially responsible model"): convOC/excessOC now come from a full counterfactual re-simulation (suppress conversions/excess, `_cfRefundIRA()` fixed-point tax refund of discretionary IRA over-withdrawals; RMD surplus still flows out). Break Even gated on conversions occurring; counterfactual only when `computeOC` set (runSimulation) — optimizer/MC untouched (their rankings never used convOC). Identity verified: final convOC == finalNW difference vs independent no-conversion run, exact. CF pays larger RMDs (+$549k in test case) and more lifetime tax — the RMD counter-effect is now priced, as is conversion-caused IRMAA. Small-screen batch: tap tooltips (`?touchtips` hook), 3-col stat grid, single-row scrollable tabs, folded sidebar + ⇅ jump button, sticky Year column, has-tooltip wrap. Docs/tooltips/changelog rewritten; v11.11dc. node 60/60 (6 new OC tests), browser suite green, preview-verified at 375px (screenshot tool flaky — pane 0x0 — verified via snapshot + computed styles; added innerWidth>0 guard so hidden contexts don't fold the desktop sidebar).

## Session: 2026-07-08 (cont. 5) — PF4: changelog consolidation + docs polish (v11.11c8)

Follow-up requests after PF/PF2/PF3: (1) avoid em-dash in user-facing writing going forward (saved as a feedback memory), (2) consolidate the two most recent changelog entries (11.11c1 + 11.11c7) into a single 11.11c8 entry using user-provided wording verbatim, (3) gate the ACA Cliff strategy-discussion doc paragraph behind the nerd-knob (it's a nerd-only strategy), (4) rewrite the Break Even stat tooltip to plain language + point to Documentation, (5) add a new Docs-tab paragraph explaining the Break Even shadow-portfolio mechanism, positioned above "1. Profile & Ages" but outside the "Detailed Strategy Discussion" fold per instruction.

Hit the core.js cache-bust gotcha (documented in memory now) a second time mid-session: bumped `?v=` after the ACA-gating JS edit, browser served fresh code fine once actually reloaded. Verified via direct DOM/JS inspection: `#doc-aca-cliff` starts `display:none`, toggles to `''` on `setNerdKnob(true)` and back to `'none'` on `setNerdKnob(false)`; new Break Even doc `<li>` found immediately before the "1. Profile & Ages" `<li>` in DOM order; changelog list's first 3 entries are `11.11c8`/`11.11ae`/`11.11ad` (confirms the 11.11c1 entry is gone, not duplicated). node 54/54, browser 240/240, no console errors. Committed + pushed to PR #111.

## Session: 2026-07-08 (cont. 4) — PF2: bar-chart legend hover finally fixed + click-to-isolate

Planned in Plan Mode (approved), then user gave one correction after approval: restore trigger is **double-click**, not "click the same item again" — implemented per the correction, not the original plan text.

**Root cause of the "still broken" hover bug:** `chart.update('none')` is a documented Chart.js bug ([#11507](https://github.com/chartjs/Chart.js/issues/11507)) — skips redrawing bar fill colors even though `dataset.backgroundColor` updates correctly in the data model. Every prior "fix" this session only ever touched the caching logic around it, never the actual `'none'` mode call, so the visual bug survived two rounds. Switched to plain `chart.update()`.

**New behavior:** bar legend click now isolates (dim others, keep clicked full-color) instead of removing; double-click (`MouseEvent.detail === 2` — native browser double-click detection, no manual timestamp/distance tracking needed) restores all. Lines are untouched — hover-dim and click-to-remove both work exactly as before, per explicit user confirmation ("lines... can be kept").

Implementation: `dimColor()` extracted to module scope; new `makeChartLegendInteraction()` factory shares one `isolatedKey` closure across hover/leave/click (critical — an earlier draft used two separate factory calls for hover vs click and would have had disconnected state); rewired only the 4 mixed bar+line chart configs (tax/flows/assetflows/combined).

**Verification hit a real gotcha:** after implementing, the FIRST browser test showed the OLD default Chart.js click behavior still active — `core.js`'s `?v=1111c1` cache-bust token (added earlier this session) hadn't been bumped after these new edits, so the browser was serving a stale cached copy missing `makeChartLegendInteraction` entirely (confirmed via `typeof makeChartLegendInteraction === 'undefined'` in the live page vs `fetch(..., {cache:'no-store'})` showing the fresh source). Bumped to `?v=1111c7`. **Lesson for future sessions:** every core.js edit now needs its cache-bust token bumped before browser verification, not just once per session.

**Verify (all via direct handler invocation with fake MouseEvent-shaped args, since Chart.js legend items are canvas-drawn, not real DOM elements to click):** single click on a bar → isolates correctly; hover a different item while isolated → correctly suppressed (no change); double-click → full restore to original colors; line item (MAGI) click → still toggles hide/show exactly as before; `'│'` combined-view separator click → correctly a no-op; Medicare hover tooltip still composes correctly on tax/combined views. Also visually confirmed via screenshot that bars now actually dim on canvas (not just legend swatches) — the core bug. node 54/54, browser 240/240. Committed + pushed to PR #111.

## Session: 2026-07-08 (cont. 3) — PF3: MC Stress pass now runs current strategy only

Implemented and shipped Phase PF3 (planned in Plan Mode, approved, then implemented same session). Stress pass (folded into Historical per Item 7) was sweeping the FULL `variations` array (100+ strategies in typical scenarios) even though only checkbox-selected ones ever got plotted — wasted compute. Now runs against exactly 1 variation: whichever matches the user's current sidebar settings (`findCurrentStrategyIdx`), with a wrapped-`base` fallback if no exact match exists.

Changes: `runPass()` in both `worker.js` and `mc_controller.js` gained a 4th `runVariations` param (falls back to the full array if `cfg.stressVariations` is missing, so a stale-cached deploy degrades gracefully rather than erroring); `mc_tab.js`'s `runMonteCarlo()` builds the single-variation `stressVariations` array; `renderStressChart()` simplified — dropped the now-meaningless `_mcSelected`/multi-strategy-hue logic, just plots `stress.variations[0]` directly (no more `[Family]` legend prefix).

**Verify:** Browser — `_mcResults.stress.variations.length === 1` confirmed (main sweep was 108 variations in the test run, so this is a real compute reduction, not just a display change). Switched sidebar strategy `propwd`→`fixed`, re-ran, confirmed `stress.variations[0].strategy` updated to `'fixed'` — not stale. No console errors either run. node 54/54, browser in-page suite 240/240. Committed + pushed to PR #111 (same branch as Phase PF).

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
| Where am I? | At v11.1287 (PR #122 open: PF9 + PF10; PR #121 landed the orphaned RealReturns gold wiring). P15 refactor complete. node 73/73, browser 240/240. |
| Where am I going? | PF11 (Optimize Conversions candidate pool — top-5-by-finalNW misses the families that convert well; 3 tiers scoped, needs a tier decision). Then P2 Cash Reserve, PB Lumpy Spending, PC Auto-Persist, P16 responsive, P19 state coverage (13 states). |
| What's the goal? | Implement remaining features from optimizer_directions.md priority list |
| What have I learned? | Roth conversion mechanics are two structurally different things: surplus routing is a pure reallocation (no tax netted), Extra Conversion is a real new withdrawal (gross minus its own marginal tax). Cash-funding only applies to the latter, or via an explicit gross-up (`conversion × t/(1-t)`) for the former. Shadow tax calcs are additive vs subtractive depending on whether the slice is already inside `yr.totalTax` — picking wrong silently corrupts results. Optimizer row fields must record effective `inputs`, never raw `overrides`. |
| What have I done? | All core Roth conversion work done (20→21→23), plus PF5–PF10 Break Even/conversion corrections. MC engine mature. URL sharing polished. Quickwins (3,4,8,12,22) still open. |

---
*Update after completing each phase or encountering errors*

## Session: 2026-07-10 (worktree mystifying-babbage-559d99)
- Audited P19 against code: commit d52ffac (2026-07-07) completed 5 of 6 remaining items (findBracketIndex dedup, return-alias unification, computeIrmaaInline deleted, irmaa_and_rmds.html reuse + 12x surcharge fix, load order). Only state coverage (13 states) still open. task_plan.md updated.
- Assessed P15: all three items (R1b/R3/R4) still open. simulate() regrew to ~1,110 lines (core.js:884-1994); core.js 6,132 lines / 139 getElementById; displayhelpers.js a 163-line stub; worker.js still importScripts. Recommended order R3 -> R1b -> R4. task_plan.md P15 section updated with fresh counts. Next session: start P15 work.

## Session: 2026-07-10 (worktree planning-with-files-328afe)
- Context restore: PR #114 merged (P15 R3 complete, v11.11f3). Files renamed (dropped retirement_ prefix); optimizer_core.js now pure engine (0 getElementById, ~2,170 lines, simulate :778-1894), optimizer_ui.js holds all 139 getElementById (3,588 lines). task_plan.md P15 updated: R3 checked off, remaining R1b (simulate ~1,117 lines) + R4 (worker.js:8 importScripts).

## Session: 2026-07-10 (worktree planning-with-files-328afe, continued) — P15 R4 + R1b
- PR #115 (branch planning-with-files-328afe): R4 dual-mode exports. UMD guards in taxengine.js (12 symbols engine references), optimizer_core.js (adds optimizeSpend/compactNum/afterTaxNetWorth), displayhelpers.js; test harness vm.runInContext -> require() with Object.assign(globalThis, taxengine) before requiring the engine. Worker importScripts untouched, zero HTML changes.
- PR #116 (branch planning-with-files-328afe-r1b, stacked): R1b full phase decomposition, v11.11f8 -> v11.11ff. simulate() 1,117 -> ~215 lines; loop = 16-line phase-call sequence over sim/yr state objects. 12 commits (2 rename-only conversions via scripted string/comment-aware identifier transform + shorthand pre-expansion; 9 bottom-up verbatim extractions; 1 dead-code removal: currentTaxableGuess, marginalTaxRate, shadowed outer tax).
- Verification: 22-fixture golden harness (scratchpad golden_diff.js, JSON byte-compare, perf stubbed) green after EVERY commit; node 60/60 + 12/12 each commit; browser 240/240, runSimulation, optimizer, MC worker (identical sampled stats), Retirement_Projection/IncomeTaxPlanner/irmaa_and_rmds zero console errors.
- Gotchas hit: \r line endings break JS regex `$` with `.+` (split(/\r?\n/)); destructuring ASSIGNMENT at computeBracketCeiling call needed renamed-target form; withdrawals/netWithdrawals alias preserved as yr.netWithdrawals = yr.withdrawals; resolveHousehold break -> boolean return.
- P15 now fully complete pending merges. Remaining plan work: P2 Cash Reserve, PB Lumpy Spending, PC Auto-Persist, P16 responsive, P19 state coverage.

## Session: 2026-07-15/16 (worktree mystifying-babbage-559d99) — PF9 + PF10, PR #121/#122
- **PF9 (v11.1271, PR #122):** user reported 4 issues testing PF8. (1) GK + Optimize Conversions suggested a $575k/yr conversion -> `optimizeConversionAmount()` never applied `gkSpendStable()`, the guard `optimizeSpend`/`optimizeSpendDown` already use; GK "affords" any amount by slashing future spend and finalNW rewards the under-spending. Gated the sweep. (2) Extra Conversion ignores IRA Goal -> user chose docs-only (a conversion moves money IRA-to-Roth, not out of the household). (3) Break Even hard to hit -> kept PF6's strict definition (user's call), added `diagnoseConvBreakEvenFailure()` pinpointing WHICH conversion year breaks the lead. (4) RealReturns gold "gone" -> git archaeology: `gh pr view 119` showed PR #119 merged only `fcf4161` (data); the UI-wiring commit `0de2d5d` was pushed AFTER the merge and never landed. Cherry-picked as PR #121.
- **PF10 (v11.1287, PR #122):** user asked why a $20k Extra Conversion only converts $13,740. Their hypothesis (enable Maximize Conversions) was wrong -- traced phase order, the two mechanisms never interact. Real cause: the field is a GROSS withdrawal whose marginal tax is netted out. Bigger insight the user drove: **neither mechanism actually "maximized" anything**. Split `maxConversion` -> `convertExcessToRoth` + new `fundConversionWithCash`; new `applyConversionGrossUp()` implements the user's formula `increase = conversion × t/(1-t)`.
- **Two planning passes produced wrong designs; hand-tracing and browser testing caught both.** (a) First Plan agent proposed `cfRefundIRA`-style gross-up on `conv1`/`conv2` as a "TAX GAP fix" -- false premise, that path nets out no tax at all. Discarded, comment rewritten. (b) A real interaction bug survived both agents: both mechanisms mutate `yr.totalTax`, so the second subtracted a baseline containing the first's tax while its shadow calc excluded the first's income -> understated ~43% ($3,635 vs $6,346). Fixed via shared `yr._extraIRAIncome`; regression test verified to FAIL when the fix is reverted (not just pass).
- **Round-2 (user testing):** nerd-mode Optimizer sweeps `fundConversionWithCash` independently (176->220 rows, base rows forced false or the arms collapse); "Use Cash" label (old one broke the toggle knob); Break Even ⓘ auto-computes (measured 43ms worst case vs 53ms for one runSimulation -- eager is free); Optimize Conversions defaults ON; docs/changelog corrected.
- **Second instance of the PF8 load-strategy bug class, self-inflicted:** optimizer rows recorded `overrides.fundConversionWithCash`, but outside nerd mode the flag is inherited from `base`, so rows claimed false while their sim used true. Record `inputs.*` (post-merge), never `overrides.*`.
- **Verification:** node 67/67 -> 73/73; browser 240/240 throughout; the user's exact $13,740 reproduced then $20,000 with the flag on (totalTax identical -- funding source only). Share round-trip, legacy `maxConversion` migration, and optimizer-row round-trip all verified live.
- **Gotchas worth remembering:** moving a shareable control out of `.sidebar` breaks Share silently (buildShareURL stops emitting, loadFromURL keeps restoring) -> `SHARE_INPUT_SELECTOR`; flipping a checkbox default inverts which state is URL-omitted (verify `copt=0` still emits); tooltip map lookup is case-sensitive and fails silently (an audit script found a 2nd dead tooltip beyond the reported one); `sed -i` on this repo is safe for renames (git autocrlf normalizes) but verify diff sizes stay proportional.
- **Left open -> PF11:** Optimize Conversions' top-5-by-finalNW candidate pool misses the families that benefit from converting. Empirically: top-5 all returned `optConv: 0` (correctly -- conversions hurt them) while `propwd` at rank 6 returns $125k and is never considered. Defaulting the feature ON made this everyone's problem; changelog/docs now disclose it, but the pool limitation is real and unfixed. Three tiers scoped in task_plan.md PF11.

## Session: 2026-07-18 (worktree mystifying-babbage-559d99) — context restore
- Restored planning files. Working tree clean, branch `worktrees/planning-with-files-18d693` at `0a0d2d9`.
- PF12 has landed since last entry: PR #123 merged (`7956b76` IRA WD accounting + prefer-larger conversion sourcing, `1fa2043` tooltip wording fix, v11.129e). task_plan.md PF12 status updated DONE-uncommitted -> MERGED.
- No open code work in progress. Next candidates: PF11 (Optimize Conversions candidate pool, needs tier decision), P2 Cash Reserve, PB Lumpy Spending, P4 Creeping Tax, P5 conversion schedule DP.

## Session: 2026-07-20 (worktree mystifying-babbage-559d99) — PF11 implemented (v11.12e5)
- User picked (AskUserQuestion): pool = best-per-strategy-family; scoring metric = _baselineScore for BOTH the pool ranking and optimizeConversionAmount's internal objective; cost = measure-first (no coarse-to-fine unless a trigger is hit).
- Step 0 measured (node, JIT-warmed): sweep cost ceil(totalIRA/25k)+1 confirmed exactly (17/81/201 sims per candidate at $400k/$2M/$5M). $2M @ 12 candidates ~835ms/~1184 runs, under the 2.5s/1500-run triggers -> shipped without coarse-to-fine. $5M+ crosses the run budget (~2624) -> recorded as the follow-up trigger.
- Core: SPENDABLE_WEIGHT hoisted to a shared const; new pure baselineScoreOf() + selectConversionCandidates() (family key strategyKey|cyclicKey; bracket splits on _stratIRMAATier sign; cyclic own dimension; ✦/no-conv/infeasible/untenable excluded); optimizeConversionAmount +4th opts arg + 'baselineScore' metric (legacy 3 modes + 3-arg callers untouched).
- UI: _scoreRows() extracted; sharedFutureIRARate hoisted above Phase 23; flat top-5 replaced by selectConversionCandidates(...,12); sweep called with 'baselineScore'+shared rate; run-scoped conv counters; #opt-conv-banner + renderConvOptBanner() for the honest empty state.
- Tests: +7 (84/84). T2 = required regression guard (flat top-N would drop the propwd family / keep 5 cyclic; pool keeps propwd + <=1 cyclic). T6 = engine-level defect encoding (finalNW->$0 vs baselineScore->$50k). Values derived from real engine first.
- Browser (v11.12e5, python http.server :8767): $2M/$90k -> 12 candidates, 3 ⇌ rows from 3 families incl. Proportional (the rank-6 family the ticket said was never considered); 847ms/1155 runs; empty-state banner verified; toggle off resets+hides / on restores; propwd ⇌ click-loads faithfully; balanced/conveffect/earliestbe all clean; only the 4 pre-existing intentional error fixtures. (screenshot tool itself timed out on frame capture; DOM label extraction confirmed the ⇌ rows render.)
- GOTCHA: driving inputs in-browser must use DisplayHelpers.setDollarValue(id,v) -- val() reads el.dataset.numVal, not el.value, so a raw .value= (even with input/change events) is ignored by getInputs().
- Status: DONE, not committed. Files: optimizer_core.js, optimizer_ui.js, optimizer_core.test.js, retirement_optimizer.html.

## Session: 2026-07-20 (worktree mystifying-babbage-559d99) — PF13 implemented (v11.12ea)
- 7-item optimizer batch. Decisions via AskUserQuestion: selector visible to all + default Tax Flexibility; taxflex = balance-among-top-wealth-plans; widowrmd = rmdTax + IRA tax-bomb; ACA = flag all rows when a spouse is on Medicare.
- Items 5+6: objective now re-orders the whole table (sortState '__objective__' sentinel → rankRowsByObjective; header click overrides; objective change resets). Ranking engine moved to optimizer_core.js (OPTIMIZER_OBJECTIVES + rankRowsByObjective(rows,objKey,rate), pure); labels in UI (OPT_OBJECTIVE_LABELS). 9 objectives, default taxflex. OptimizerState.sharedFutureIRARate stored per run.
- Items 1/2/3/4/7: rothConv += Opp.Cost category; Best winners from feasibleSuccesses (no ⚠️); eitherOnMedicareAtStart flags all ACA rows + static 400 ⚠️ removed; Score column removed (Rank kept); conv banner shortened.
- node 90/90 (+6) + taxPaymentPlanner 12/12. Browser v11.12ea: selector visible non-nerd, each objective reorders body (DOM ids == rankRows for mintax), nerd no-Score/Rank-present, ACA scenario all 20 rows untenable, Best has no ⚠️, rothConv in Opp.Cost, Medicare trigger true/young-couple false, only 4 pre-existing console fixtures.
- GOTCHA: applyNerdKnobVisibility must set objWrap.style.display='flex' not '' (='' wipes the inline flex → renders block).
- Status: DONE, not committed. Files: optimizer_core.js, optimizer_ui.js, optimizer_core.test.js, retirement_optimizer.html.

## Session: 2026-07-20 (cont) — PF13 round 2: un-gate two controls, scrub nerd from changelog
- User: Rank column and the Maximize Conversions sub-switches should always appear (nerd knob is a pre-release preview control for experimental features only), and the changelog must not reference it.
- Un-gated the Optimizer **Rank** column (removed the `if (NERD_KNOBS)` wrapper in getOptimizerColumns; dropped "Nerd-mode column." from its tooltip) and **#convAdvanced-wrap** (Convert Excess to Roth / Use Cash) in both applyNerdKnobVisibility (literal display, so a runtime toggle can't hide them) and the HTML default style.
- Changelog scrubbed: 4 entries reworded (11.12ea x2, 11.1287, 11.1247, 11.e1a). Verified zero "nerd" matches in the changelog block. Tooltip + Docs text that un-gating made false rewritten ("Turn on nerd knobs to control the two independently" -> "Use the two switches below it"). Left the nerd references that are still accurate and outside the changelog (MC Simulation Parameters panel, 💵 optimizer sweep dimension).
- Verified in browser with nerd OFF: conv switches visible (offsetParent non-null), Rank column present in the rendered header with real values, Score absent; toggling nerd on->off does not hide either; zero console errors. node 90/90.

## Session: 2026-07-20 (cont) — PF13 round 3: terminology, labels, docs, control placement (v11.12f7)
- Terminology: normalized EVERY variant ("nerd knob(s)", "nerd-knob", "nerd mode", "nerd-mode") to "nerdknob", the switch's actual name, across retirement_optimizer.html / optimizer_ui.js / optimizer_core.js / montecarlo/mc_tab.js. Verified zero remaining variants in the rendered DOM. The surviving nerdknob references are all for features that ARE still gated (MC Simulation Parameters panel, 💵 optimizer sweep dimension), so they were renamed rather than deleted.
- Objective labels made parallel (noun/gerund phrases): Maximize Net Wealth -> Maximum Net Wealth; Avoid Widow & RMD Tax -> Avoiding Widow & RMD Tax; Minimize Lifetime Taxes -> Minimum Lifetime Taxes. Updated in BOTH the HTML <option> list and OPT_OBJECTIVE_LABELS; verified the two match exactly at runtime.
- "Optimize for" control moved to the top of the Optimizer tab, directly below the two search switches (DOM order verified: opt-search-options -> opt-objective-wrap -> opt-perf...), and made prominent: own panel with light-blue background/border, 14px vs the 11.9px search row, bold 1.05em label, larger select.
- New Documentation entry "What does 'Optimize for' do?" placed after the Break Even explainer: explains that it changes ranking only (not the underlying numbers), that the ⚓ baseline and Rank column follow it, that a column click overrides until the goal changes, plus a sub-bullet per objective including why Tax Flexibility needs the wealth gate and why Minimum Lifetime Taxes and Avoiding Widow & RMD Tax can disagree.
- **Real bug caught by screenshot, not by the earlier item-2 fix:** the ⚓ "Best w/o Conv" row was still showing an infeasible `Fill Bracket (no conv) ⚠️`. Item 2 had filtered only the per-metric winner pool; `recomputeBaselineForObjective` had no feasibility filter, so an infeasible no-conv row could be pinned as the baseline AND listed in the Best summary. Fixed by preferring feasible no-conv rows, falling back to the unfiltered set only if every one is infeasible (so Δ columns still work). Verified the baseline is feasible under all 7 non-conversion objectives.
- v11.12f7 (title + both ?v= tokens + changelog entry). node 90/90 + 12/12, zero console errors.

## Session: 2026-07-26 (worktree context-e73361) — PR2: conversion-schedule representation divergence (v11.137f)
- Picked up the one item PR1 left open (findings.md "Latent engine inconsistency"): a per-year `extraConversionAmount` array and the equivalent scalar + `convEndYear`/`convEndMode:'extra'` scheduled the same dollars but produced different simulations.
- **Root cause, found by measuring not reading: `optimizer_core.js:868`.** The year-0 Early(Conv)/Late(Spend) withdrawal-timing trigger tested `(inputs.extraConversionAmount ?? 0) > 0`. A multi-element array coerces to the string "87500,87500,..." -> `NaN > 0` -> false, so array plans ran Late(Spend): 11 months of pre-withdrawal growth instead of 1, which moves the RMD basis and every balance after it. The same expression ignored suppression, so a stop year already in the past (or `_cfSuppressConversionsFromYear: 0`) still claimed a conversion year. A single-element array coerces to a number and accidentally works, which is why spot checks missed it.
- Measured pre-fix (OC fixture, $87,500/yr): scalar full Early/finalNW 1,565,702; array full **Late**/1,577,361; `_cfSuppressConversionsFromYear:0` **Early with zero conversions**/1,197,684 vs true no-conv 1,201,283; `convEndYear:2020` **Early with zero conversions**/1,197,684.
- **Both defects were live.** `bestConversionStopYear` (run on every converting simulation for the Break Even ⓘ) cut mode 'extra' with a zero-tail array and mode 'all' with a still-positive scalar. On STOP_BASE the two modes reported different gains for the SAME cutoff ($59,706 vs $57,549 gainVsFull) and gainVsNone was overstated by $8,916. Post-fix both modes return identical numbers.
- **Fix:** new pure `_extraConvAmountFor(inputs, y)` (array-or-scalar, zeroed by `_extraConvSuppressedThisYear`) used by BOTH `applyExtraConversion` and the timing predicate; bracket/aca half gained `!_convSuppressedThisYear(inputs, 0)`. `bestConversionStopYear` mode 'extra' now cuts via public `convEndYear`/`convEndMode` (user decision: retire the array representation from production), array branch kept for a caller that passes one.
- Tests: +3 representation guards (array === scalar+convEndYear at cut 0/interior/n; full array === plain scalar and year 0 is Early(Conv); suppressed year 0 === converting nothing, both via past convEndYear and via `_cfSuppressConversionsFromYear:0`). **All three verified to FAIL when the one-line predicate change alone is reverted** (temporarily reverted, 4 failures, restored). Two hard-coded values re-derived in the array-driven diagnoseConvBreakEvenFailure boundary test: breakingAmount 355,478 -> 355,562, lastSustainableBEYear 2041 -> 2042 (breakingYear 2031 and lastSustainableYear 2030 unchanged). node 125/125 + taxPaymentPlanner 12/12.
- Byte-identity: 8 scenarios hashed before and after (fixed/bracket/aca/propwd/gk/cyclic/scalar-eca/no-conv) — all IDENTICAL, so the strategy sweep, MC, Annual Details and the Tax Planner handoff are untouched.
- Browser (v11.137f, file:// — port 8767 was occupied by another python server): built an interior-optimum scenario ($3M IRA, 8% growth, 12% heirs rate, $120k extra conv) -> ⓘ "Stopping conversions after 2040 keeps about $5,003 more..."; clicked "Stop after 2040 ▸" and the loaded plan's after-tax wealth equalled the searched score **to the dollar** ($17,342,828 promised = actual, delta $0) in BOTH 'all' and 'extra' modes. Stop year 2020 -> year 0 Late(Spend), 0 conversions, identical finalNW to the true no-conversion plan ($14,520,285). In-page suite 240/240, only the 4 known intentional bad-input error fixtures in console.
- GOTCHA: the app's own `javascript_tool` calls share a scope across invocations — `const` names collide between calls; wrap each snippet in an IIFE.
- Status: DONE, uncommitted. Files: optimizer_core.js, optimizer_core.test.js, retirement_optimizer.html.

## Session: 2026-07-27 (worktree context-e73361) — PR3: CURRENT PLAN row + Earliest Break Even (v11.1387)
- User ask: the Optimizer should include the currently selected withdrawal strategy AND its parameters, highlighted as "current", so the current plan can be compared against the optimizer's picks. Follow-up ask: add an "Earliest Break Even" entry to the Best table, ties broken by higher net wealth.
- Investigation found THREE independent reasons the current plan was absent, not one: (a) every swept row forces `convertExcessToRoth: true` and `runOptimizer` strips `extraConversionAmount`/`convEndYear` from `base`, so no row is the user's plan even when strategy+param match; (b) `buildVariations` adds the user's off-grid parameter but the Optimizer's own parallel sweep never did, so Proportional 7% / Reduce 18 yrs had no row at all; (c) no current marker existed anywhere in the Optimizer (MC had `findCurrentStrategyIdx`, but MC-scoped).
- Decisions (AskUserQuestion): real simulated row + inline marker (not marker-only); mirror the off-grid rule into the Optimizer sweep; rank the current plan among the others AND let it win metrics.
- **Two pre-existing bugs found while reading, both fixed here.** (1) `orderedSeq` was never recorded on a row nor restored by `loadOptimizerResult`, so clicking "Ordered RIBC" set strategy=ordered and left the sidebar's own sequence — the table showed one plan and clicking it ran another (PF8 bug class, third instance). (2) MC's `findCurrentStrategyIdx` returned false for **gk and ordered** (no branch matched, fell through to `return false`), so those users silently got the synthetic "Current Plan" fallback in Stress mode; it also ignored `stratIRMAATier`, pairing an IRMAA-ceiling user with a plain bracket row.
- **The latent defect behind the new Best winner:** `_convBEYear` was set ONLY on ⇌ rows (only they re-ran with computeOC), so `OPTIMIZER_OBJECTIVES.earliestbe` sorted all ~180 rows on the same 9999 sentinel — selecting "Earliest Break Even" under Optimize for did literally nothing. Fixed by running the whole sweep with `computeOC: true`. Cost measured first, not assumed: 144-row sweep 78ms -> 152ms (1.96x, +74ms); live table 1337ms / 1711 runs, inside the 2.5s budget. The second counterfactual (excessOC) fired on 0 of 144 rows and is separately guarded.
- Core (pure, exported): `sameStrategySelection(a,b)` full strategy identity incl. ordered/gk and the IRMAA tier; `offGridParamFor(base, grids)` shared by both sweeps (grids passed in — the Optimizer sweeps IRA Draw to 20%, MC to 10%); `earliestbe` converted from a bare metric to a `rank` with the net-wealth tie-break; `selectConversionCandidates` excludes `_isCurrentPlan`.
- UI: `_selection` recorded on every row from EFFECTIVE inputs (feeds the matcher AND fixes the ordered/gk restore); `userPlan` snapshot captured before the three conversion-field guards; 📍 CURRENT row built through `addResult` (explicit `fundConversionWithCash` so the nerdknob guard can't force false) and appended after every clone pass; sticky pinned row under ⚓ BASELINE; one inline 📍 marker preferring the match whose conversion switch agrees; `colWinners.convBE` + `⏱ Earliest Break Even` in the Best table; Break Even column tooltip rewritten (no longer ⇌-only).
- **GOTCHA (the trap in this change):** `currentHash` is built from the already-stripped `base`, so it is blind to `extraConversionAmount`/`convEndYear`/`convEndMode` — correct for the sweep, fatal for the current row. Without hashing them separately, changing only the Extra Conversion returns the cached table with a stale current row. Verified live: $564,869 -> $983,705 after the fix.
- **GOTCHA:** the row wrappers are `display:contents`, so they report `offsetHeight` 0 — measuring the second sticky row's offset must measure a CELL, not the wrapper, or the pinned rows overlap.
- Verify: node 133/133 (+8) + taxPaymentPlanner 12/12; all 8 engine hashes byte-identical (engine untouched). Browser v11.1387: CURRENT row equals `simulate(getInputs())` to the dollar ($813,254) and differs from its swept twin ($1,201,165); it won 📉 Lowest Tax on merit; off-grid 7% row present + marked; clicking the pinned row left eca/conv/param intact; Earliest Break Even reorders the body (BE 2049 on top, net wealth descending within the tie); Ordered CBIR -> clicking an RIBC row now sets RIBC; MC matches gk (idx 35) and ordered RIBC (idx 33), -1 for an absent strategy; only the 4 known console fixtures.
- GOTCHA: repeated `javascript_tool` calls share one scope, so `const` names collide between calls — wrap each snippet in an IIFE.
- Status: DONE, uncommitted. Files: optimizer_core.js, optimizer_ui.js, montecarlo/mc_tab.js, optimizer_core.test.js, retirement_optimizer.html.
- **Follow-up same session (user-reported):** flipping Maximize Conversions while on the Optimizer tab did not re-run the Break Even analysis. User suspected the optimizer hash; it was not. Measured: the table DID recompute (current-plan row 813,254 -> 805,737, hash fine). The stale part was the Summary Header, which is rendered by `runSimulation()` and is visible on every tab: `setupAutoRecalc`'s `scheduleRecalc` branched `tab-opt -> runOptimizer()` ONLY, so `lastSimInputs.convertExcessToRoth` stayed true across both flips. Clicking Chart or Annual Details appeared to fix it only because those tab buttons have `runSimulation()` in their own onclick. Fix: always `runSimulation()`, then `runOptimizer()` when on the optimizer tab. 79ms against a 1185ms sweep (~6%). Verified: header now follows the flip, the ⓘ analysis recomputes ($444,708 -> $586,092), the table still recomputes, and the tab does not switch. Pre-existing bug, predates this session's work.
- GOTCHA: a same-hour rebuild collides with the version scheme (minor = hex(dayOfYear*24+hour)), so the browser served the cached optimizer_ui.js and the fix looked like it had not landed. Token given a letter suffix (`?v=111387a`) to bust it; drop the suffix at the next version bump.

## Session: 2026-07-27 (worktree context-e73361) — plan restore / next-item selection
- `/plan` invoked with no task. Restored context from `.planning/retirement-optimizer/` (active plan pointer).
- Verified against git rather than trusting the plan text: PR2 (`a2fb3f8`) and PR3 (`5ceda24`) are BOTH merged in PR #133 (`920337f`); PR1 in #132 (`9d3ed21`); ARCHITECTURE.md in #134 (`cba2e54`). Working tree clean, branch `worktrees/planning-with-files-6d0fed` level with main, nothing uncommitted.
- `session-catchup.py` reported no unsynced context.
- Corrected two stale plan headers: PR3 said "COMPLETE, uncommitted", PR2 said "PR #133" without the commit. **As of** line rewritten.
- Awaiting user choice of next phase from Priority Order. Top pending: PB Lumpy Spending, PC Auto-Persist, P4 Creeping Tax (Option A nerd-gated, un-gate decision open), P5 Greedy DP conversion schedule, P6 sanity-check tests, P22 CSV export.

## Session: 2026-07-27 (worktree context-e73361) — deferred backlog, PR-A (v11.1391)
- User asked to plan the items "recently identified"; they turned out to be the five deferred in PR1's appendix (`~/.claude/plans/not-sure-where-it-eventual-gray.md`, pointed to from task_plan.md:52). All five re-verified against current main before planning: none implemented.
- Approved plan: 4 sequenced PRs. PR-A = MC stress + dead code (cheap, no engine change); PR-B = SS first-year proration + milestones; PR-C = birth-year FRA; PR-D = head-to-head compare. Plan file: `C:\Users\starc\.claude\plans\there-are-several-items-tender-newt.md`. User decision: SS proration ships unconditional and disclosed, no toggle.
- **The plan's PR-A design did not survive measurement, which is the point of measuring.** It proposed calling `mcTabActivated()` from `scheduleRecalc`, mirroring the `tab-opt` branch added in PR3. Measured first: the default scenario's MC run is **27.4s** (500 paths x 144 variations = 72,000 sims). An auto-run on every sidebar blur would be half a minute of CPU per edit. Presented the number to the user, who chose the split design: re-run only the stress pass (stressCount x 1 sims), flag the rest.
- New `cfg.stressOnly` in BOTH `worker.js` and `mc_controller.js`. The controller is the `file://` main-thread mirror of the worker, so anything added to one must be added to the other or the two protocols drift; the stress message shape is now built by a shared helper in each file for the same reason.
- GOTCHA found while wiring it: `runMCWorker` calibrates `_mcMsPerSim` from every completed run. A stress-only run is ~10 sims, so without a `msg.stressOnly` guard it would poison the time estimate the full run's progress display depends on.
- GOTCHA: `runMCWorker` terminates any live worker on entry, so a stress refresh landing mid-sweep would silently kill the sweep. New `_mcWorkerBusy()` guard.
- Stale banner text has to change with the mode: Synthetic runs no stress pass, so "The Stress Failure result is current" would be describing something that is not on screen.
- Measured result of the split: stress refresh completes in **306ms** against the 27.4s full run, and the main sweep is provably untouched (same totalMs, same 144 variations, identical variations[0].survivalRate before and after).
- Dead `updateProjectedRMDStat()` removed (wrote to `stat-proj-rmd1/2`, gone from the HTML). `RMD_TABLE` is used elsewhere and stays.
- Byte-identity: guaranteed by construction, `optimizer_core.js` and `taxengine.js` untouched. A reusable 8-scenario hash harness was written to the scratchpad for PR-B/PR-C, with SS deliberately non-zero so proration will show up in it. Baseline hashes recorded there.
- GOTCHA: port 8767 was held by an unrelated python process that did not answer HTTP; added a `retirement-optimizer-alt` entry on 8768 to `.claude/launch.json` (gitignored).
- Verify: node 133/133 + taxPaymentPlanner 12/12; browser v11.1391 as above; console clean apart from the 4 known fixtures.
- Status: PR-A DONE, uncommitted. Files: montecarlo/mc_tab.js, montecarlo/mc_controller.js, montecarlo/worker.js, optimizer_ui.js, retirement_optimizer.html.

## Session: 2026-07-27 (worktree context-e73361) — PR-B: SS claim-year proration + milestones (v11.1391)
- `ssFirstYearFraction(bm)` = (12-bm)/12, applied at BOTH SS gates (normal claim and survivor) only in the year `age === Math.ceil(claimAge)`. No new plumbing needed: birthmonth1/2 already reach the engine and already round-trip as bm1/bm2.
- **The survivor branch is not only for survivors.** A single filer has `alive2 === false` from year one, so `!yr.alive1 || !yr.alive2` is true every year for them and their own benefit flows through `calculateSurvivorBenefit`'s higher-of rule (the notional spouse's benefit is 0). Without gating `yr.isSurvivorSS` on `birthyear2 > 0`, every single filer's chart would have announced a survivor benefit starting.
- **GOTCHA (cost a debugging round): a boolean latch does not survive the engine's passes.** `if (!sim._ssStarted1 && yr.s1 > 0) { yr['-ssStart1'] = true; ... }` set the flag on one call and cleared it on a later one, so the log always contained `false`. Store the YEAR in the latch and compare (`sim._ssStarted1 === sim.currentYear`) so it is idempotent. Probing had to be done with a temporary console.error inside computeIncome; the symptom (all-false flags with the keys present) looked like a log-plumbing bug and was not.
- **GOTCHA (caught only in the browser, on the app's OWN defaults): "first positive year" is the wrong test.** The default spouse (born 1952, claiming at 70) began collecting in 2022, four years before the 2026 start year, and the chart said "Spouse SS begins" in year 0. Adding a `yr.y > 0` guard just moves the same wrong marker to year 1. The correct test is "was zero last year, is positive this year", which needs `sim._ssPrev1/2/Surv`. This is the same class of guard `rmdCross` already uses (it requires a prior row). Now a test.
- Milestones use hidden `-ssStart1/2/Survivor` log fields; the leading `-` is what keeps them out of Annual Details (`optimizer_ui.js` filters on it, same as `-fedRateCreep`). Verified in the browser that no `ssStart` column appeared.
- SS markers were also added to the `mc-chart` filter: like death and RMD start, SS start years are deterministic across MC paths (fixed birth years, fixed claim ages), unlike IRMAA/GK/shortfall/break-even.
- Reverting only the three `ssFrac` expressions fails exactly 5 of the 8 new tests; the two pure-helper tests correctly keep passing. Worth doing on every behavior change, it is the only proof the tests are actually testing the change.
- Byte-identity: all 8 scenarios move, as expected. NW -0.28% (aca) to -5.50% (cyclic); tax -0.78% (cyclic) to -7.46% (noconv). Wealth and tax deltas do NOT track each other, which is the provisional-income 0/50/85% threshold effect. Direction is uniformly down only because every fixture is December-born.
- One existing expectation re-derived: the GK prevPortfolio regression test (Jan + Jun birth months). Its real subject, the guardrail-adjustment count, is unchanged at 4, so the test still guards what it was written to guard.
- Version note: PR-A and PR-B both landed in hour 17 of day 208, so both are v11.1391 (the scheme is hourly). Folded into ONE changelog entry rather than two `<li>` at the same version; entry carries `data-flag="behavior"` and the page banner correctly shows "⚠️ BEHAVIOR CHANGE".
- Verify: node 141/141 (+8) + taxPaymentPlanner 12/12. Browser: defaults 2030 SS $26,803 / 2031 $82,661; user switched to June -> marker moves to 2030 and pays $53,606 = spouse $26,803 + half the user's $53,606. Console clean apart from the 4 known fixtures.
- Status: PR-B DONE, uncommitted. Files: optimizer_core.js, optimizer_ui.js, optimizer_core.test.js, retirement_optimizer.html.

## Session: 2026-07-27 (worktree context-e73361) — PR-C: FRA from birth year (v11.1391)
- One hard-coded `FRA_MONTHS = 67 * 12` was doing three jobs across two people: unwinding the DECEASED's benefit to their PIA, testing the SURVIVOR's own early claim, and sizing the 60-to-FRA span the 28.5% reduction spreads across (that span shortens with an earlier FRA: 84 months at 67, 72 at 66). New `fraMonthsForBirthYear()`; `calculateSurvivorBenefit` takes both birth years, each defaulting to 1960 so an omitted argument reproduces the old constant exactly.
- Direction measured before claiming it: deceased born 1952 claiming at 62 on $2,000/mo, survivor born 1955 claiming at 67 -> $2,857/mo before, $2,666/mo after. The hard-code paid survivors MORE than due. Matches the appendix's 6.7% figure exactly at $4,000/mo ($68,568 -> $63,996), including the Math.floor at the monthly level.
- **The app's own default scenario does not move**, despite the default spouse being born in 1952. Both defaults claim at 70, and a late claimer's `deceasedBaseline` is `max(PIA, benefit)` = the benefit, so FRA cancels out; the survivor also claims past FRA so takes no reduction. Only EARLY claimers are affected. Worth knowing before hunting for a delta that is not there.
- The 8-scenario harness is unchanged for the same reason (every fixture is born 1960+). A pre-1955 fixture was measured separately: first survivor year $51,076 -> $49,148, final NW -1.2%, tax -1.3%.
- Verify: node 145/145 (+4) + taxPaymentPlanner 12/12; browser confirms FRA 67 for the 1960 user and 66 for the 1952 spouse from the live inputs; console clean apart from the 4 known fixtures.
- Status: PR-C DONE, uncommitted. Files: optimizer_core.js, optimizer_core.test.js, retirement_optimizer.html.

## Session: 2026-07-27 (worktree context-e73361) — PR-D: ⚖ head-to-head compare (v11.1391)
- Built on the existing Δ machinery rather than a second diff surface: `recomputeBaselineForObjective()` split so the delta WRITE became `recomputeDeltasAgainst(referenceRow)`, and `deltaReferenceRow()` returns `compareRow ?? baseline`. Pinning any row makes every other row's existing Δ column an A-vs-B answer; no new columns, no new sort keys.
- The pin has to survive a re-sweep, and `_id` cannot carry it (`results.length` at build time = a build-order index). Stored as `compareSelection = row._selection` and re-found with `sameStrategySelection` — exactly what PR3 built the matcher for. `compareIsCurrentPlan` is needed too: the 📍 current-plan row and its swept twin share a selection but not a conversion setup, so matching on selection alone can pin the wrong one.
- Two things that would have made the table lie, both fixed here: the ⚓ BASELINE pinned row printed a hard-coded `0` in its Δ cells (true only while the baseline IS the reference), and the column headers/tooltips said "baseline" unconditionally. Headers now append " vs ⚖" and both tooltips are built from `deltaRefDescription()`.
- `renderOptimizerTable(results)` gained a `results ?? OptimizerState.results` default, since the compare toggle redraws state rather than a fresh sweep.
- GOTCHA while verifying: a ⚖ count of 4 looked like the affordance was missing from most rows. It was not — the test scenario was at a $165k spend goal where only 4 of 177 plans succeed and the rest are filtered out. At $140k it is 160 ⚖ for 160 displayed rows. Check the filter state before believing a low element count.
- Verify: browser — pinned row Δ = 0 and the ⚓ baseline reads +554,876 = exactly baseNW - pickNW; re-sweep at a different spend keeps the pin on a NEW row object; an unmatchable selection clears the pin, hides the banner, restores the baseline Δ to 0 and reverts the header; a real DOM click on ⚖ pins without touching the sidebar, second click unpins. node 146/146 (+1, the selection round-trip across two sweeps). Byte-identical: engine untouched, 8-scenario harness unchanged vs PR-C.
- Status: PR-D DONE, uncommitted. Files: optimizer_ui.js, optimizer_core.test.js, retirement_optimizer.html.

## Session: 2026-07-28 (worktree context-e73361) — Round 2 user-testing fixes (v11.13a1)
- User tested Round 1 on `?mc=1&fcc=1&nerdknob` and found four things. Round 1 re-versioned 11.1391 -> 11.13a1 (new hour) since it all ships together.
- **PR-E, my bug.** `mcInputsChanged()` opened with `if (_mcNerdMode()) return;`. The guard was meant for the expensive sweep only; it killed the stress refresh AND the stale banner for every nerdknob user. `mcTabActivated()` had the same over-broad wrapper. Lesson: a mode guard belongs on the one expensive call, not at the top of the function. Verified nerdknob on: 140k -> 90k moved stress 7 of 10 -> 0 of 10 with the banner up and the sweep untouched.
- **PR-F.** Stress tile in the summary bar (`#stat-stress`), written by `updateStressStat()` in mc_tab.js and NOT by `updateStats()` — the latter runs on every runSimulation() and would blank it between passes. Stress now runs from page load via standalone `_mcStress` state, and `scheduleRecalc` calls `mcInputsChanged()` on EVERY tab because the tile is global. Tile populated 303ms after load with MC never opened. Stress section moved above the percentile chart in a `<details open>` with the count mirrored into the `<summary>` so collapsing does not hide it.
- **PR-G commit 1, death-year SS.** `s1 = survivorPay x afterDeath + (1 - afterDeath) x (own1 + own2)`, afterDeath from the DECEASED's birth month. The old whole-year-at-survivor-rate model understated the year: the survivor benefit is the higher of the two benefits, never their sum. All 8 harness scenarios rose 0.50-0.89% net wealth.
- GOTCHA worth keeping: the survivor milestone latch could not read `yr.s1` any more. In a death year `s1` is non-zero purely from the before-death months even when the survivor has not reached their own claiming age, so the marker fired a year early. New `yr._survivorPay` carries the survivor portion alone. Caught by the "survivor has not claimed yet" case, which pays $12,000 = half the decedent's benefit and nothing else.
- Empirical checks before hard-coding: June-born decedent 2038 = $51,998; December-born decedent pays $64,000 all year with the survivor benefit starting 2039 (the exact mirror of December claim-year behavior); reverting the blend fails 5 tests.
- **PR-G commit 2, changelog split.** `optimizer_changelog.md` at the repo root holds every release in full, newest first; the HTML keeps 5 short entries with a Details link. Top entry 4,640 -> 595 chars, which also shrinks the always-visible banner since it copies the first `<li>` verbatim. Anchor links to per-version headings were dropped: GitHub's generated anchors are fragile, and the file is newest-first so the plain file link lands on the newest entry anyway.
- Also repaired a sentence an earlier scripted edit of mine had mangled in the 11.1391 changelog text ("The chart also gained markers, and for the year a survivor benefit begins"). Anchoring a replace on a sentence fragment can silently eat the rest of the sentence; anchor on whole sentences.
- Verify: node 148/148 + taxPaymentPlanner 12/12; console clean apart from the 4 known fixtures; optimizer_changelog.md serves 200.
- Deferred: README/FAQ cross-references from tooltips and banners (README has anchored FAQ headings already).

## Session: 2026-07-28 (worktree context-e73361) — Round 3 user-testing fixes (v11.13a1, on PR #135)
- Four more from user testing.
- **Stress skipped in Synthetic mode.** `willRunStress = simulationMode === 'bootstrap'` in both worker.js and mc_controller.js. It never needed to be: the stress pass calls `buildStressBank()` and builds its own worst-historical-decade bank, entirely independent of the main pass mode. It was gated by association, not by dependency. Now unconditional in both files, and the Synthetic-mode guards in `refreshMCStressOnly`, `updateStressStat` and `markMCStale` came out with it.
- **Stress chart empty with nerdknob on.** `renderStressChart` read `_mcResults?.years ?? 0`, and `_mcResults` is null until a full sweep runs, which nerd mode never does automatically. So the headline count appeared over a chart with zero labels. `_mcStartYear` had the same problem (only set by `runMonteCarlo`). Fixed by attaching `msg.years` to the stress payload and setting `_mcStartYear` in `refreshMCStressOnly`.
- **Compare was undiscoverable.** Added a permanent `#opt-compare-hint` line above the table that swaps with `#opt-compare-banner` when a comparison is active; the banner now spells out what the Δ columns mean and its button reads "✕ Stop comparing" instead of "Back to ⚓ baseline". ⚖ opacity 0.35 -> 0.55, and the pinned one renders larger.
- **Optimizer looked frozen.** Sweep is 0.8-2.5s of blocking main-thread work with the previous run still on screen. `runOptimizer()` now shows `#opt-busy` and yields before calling the renamed `_runOptimizerNow()`.
- **GOTCHA that mattered: do not yield with requestAnimationFrame alone.** The first version used a double rAF. It never fired, because a tab that is not compositing does not run rAF at all - the sweep simply never started. Caught because the browser pane was hidden during verification, which is exactly what a user switching browser tabs would do. Now races a double rAF against `setTimeout(start, 60)` and takes whichever lands first: frames when visible, timer when not.
- Verified: nerdknob + no full run -> stress chart draws with 25 labelled years; Synthetic mode -> stress pass runs (10 paths, chart drawn, tile populated); busy banner visible at call time and hidden after, sweep 767ms / 177 rows even with the pane not compositing; hint/banner swap and "✕ Stop comparing" restore the baseline Δ to 0.
- node 148/148 + taxPaymentPlanner 12/12; engine untouched so byte-identical; console clean apart from the 4 known fixtures.

## Session: 2026-07-28 (worktree context-e73361) — Round 4: compare hit zone + baseline semantics (v11.13a1, PR #135)
- **Hit zone.** ⚖ was a small span inside the Strategy cell, so a near miss ran `loadOptimizerResult` and replaced the user's sidebar. Wrong failure mode: a click aimed at a comparison should never load a plan. ⚖ now has its own column, the outcome (🟢/🚨) cell joins the same zone, and an inert `gap` column separates both from the Strategy cell so a slightly-off click does nothing at all rather than the wrong one of two things.
- Implemented as column metadata (`compareZone`, `inert`, `sortable:false`) plus two shared helpers, `cellActionCss(col)` and `cellActionAttrs(col, r, loadTitle)`. All THREE render paths had a hardcoded `onclick="loadOptimizerResult(...)"` on every cell (body rows, the pinned ⚓ baseline row, the pinned 📍 current row); routing them through one pair of helpers is what stops the three drifting apart, which is the PF8 bug class this table has produced before.
- **Baseline semantics.** Previously ⚖ was highlighted only when `compareRow` was explicitly set, so the table opened with nothing highlighted even though the baseline WAS the reference, and clicking the baseline's ⚖ pinned an already-effective reference (a no-op state you then had to un-click). Now the highlight and the toggle both key off `deltaReferenceRow()`, which is `compareRow ?? baseline`. The baseline therefore opens highlighted, and clicking whichever row is already the reference clears the comparison, identical to the Stop comparing button.
- GOTCHA while verifying: `toggleCompareRow` re-renders the table by replacing innerHTML, so any DOM node captured before the click is detached. A stale-node read made the current-plan row look like it was not being highlighted. Re-query after the click.
- Verified: baseline ⚖ 1.2em on load; clicking it is a no-op that leaves the sidebar untouched; clicking a body row's 🟢 pins that row and dims the baseline's ⚖ to 0.55; the current-plan row can be pinned the same way and reads Δ 0; clicking a highlighted ⚖ restores the baseline; the sidebar strategy/param/years are unchanged through all of it. Header cells for ⚖ and the gap are not sortable.
- node 148/148 + taxPaymentPlanner 12/12; engine untouched so byte-identical; console clean apart from the 4 known fixtures.

## Session: 2026-07-28 (worktree context-e73361) — Round 5: Calculating banner hold (v11.13a1, PR #135)
- User: the Calculating banner reads as spurious because it vanishes the moment work ends. Now two states: '⏳ Calculating strategies…' while running, then '✓ Calculating strategies… DONE in N.Ns' held for OPT_BUSY_HOLD_MS (5000) before hiding. Green on done, blue on busy. A new run clears the previous hold timer.
- Wording and colours moved fully into `setOptimizerBusy()`; the HTML div is now empty with a comment pointing at it, so there is one source of truth rather than markup and JS both carrying the text.
- **Found a real bug of my own while verifying: `_optimizerScheduled` could latch true forever.** The guard was `if (_optimizerScheduled) return;` cleared only inside the queued `start()`. Anything that stopped `start()` running left the flag stuck and EVERY later runOptimizer() silently did nothing - the Optimizer was dead for the rest of the session. Reproduced live: banner stuck on "Calculating", `scheduled: true`, `pendingTimer` non-null, no console error.
- Replaced the latch with cancellable handles (`_optPendingTimer` / `_optPendingFrame`): a new call cancels the queued one and re-queues. Cannot wedge, and the newest inputs win on rapid edits. Verified a rapid double call cancels and replaces (timer ids differ), completes, and leaves both handles null.
- Second fix from the same pass: the banner reported `OptimizerState.perfStats.totalMs`, which is only written by a REAL sweep, so a cached re-render showed the previous sweep's duration. Now measured wall time around `_runOptimizerNow()`, which also counts the render. Verified: real sweep "DONE in 2.6s", immediate cached re-run "DONE in 0.1s".
- GOTCHA for future browser verification: polling with setInterval in a hidden pane is throttled, so an observed hold of 6315ms against a 5000ms constant is the observer's error, not the code's. Also, kicking off work and polling for it in the SAME javascript_tool call can hit the 30s tool limit; start the work in one call, stash marks on window, read them in the next.
- node 148/148 + taxPaymentPlanner 12/12; engine untouched so byte-identical; console clean apart from the 4 known fixtures.

## Session: 2026-07-28 (worktree context-e73361) — Round 6: pinned-row marker consistency (v11.13a1, PR #135)
- The pinned current row rendered `CURRENT — 📍 Proportional`: `_strategyLabel` already carries the 📍 prefix, and the row template prepended "CURRENT — " in front of it. Now `📍 CURRENT — Proportional`, matching `⚓ BASELINE — …` word order, by stripping the marker off the label and putting it in front.
- Marker strings became `CURRENT_PLAN_MARK` / `BASELINE_MARK` constants, since the same literal is now both PREPENDED (when labelling rows) and STRIPPED (in the pinned row) and those two must not drift.
- The Best table now prefixes ⚓ on a winning baseline row via new `isBaselineRow(r)`. Identified by `_id` against `OptimizerState.baseline`, NOT by a label prefix: unlike the current plan, the baseline's label is never rewritten, because which row IS the baseline changes with the active objective. 📍 needs no equivalent - it is already part of the current row's `_strategyLabel`, so it carries through the Best table's `col.getValue(r)` unchanged.
- Verified live: pinned rows read "⚓ BASELINE — Guyton-Klinger (no conv)" and "📍 CURRENT — Proportional"; Best table shows "⚓ Guyton-Klinger (no conv)" under Best w/o Conv, and "⚓ Ordered (no conv)" in a second configuration. Could NOT get the current plan to win a metric in three tried configurations, so the 📍 half is verified as a label pass-through (confirmed `_strategyLabel` starts with the marker) rather than observed in the Best table.
- node 148/148 + taxPaymentPlanner 12/12; engine untouched so byte-identical; console clean apart from the 4 known fixtures.

## Session: 2026-07-28 (worktree context-e73361) — Round 7: three 📍 markers at once (v11.13a1, PR #135)
- User screenshot on `?mc=1`: three rows carrying 📍. Reproduced and inspected state rather than guessing: only TWO rows carry the marker in `results` (id 3 = the swept twin `_isCurrentMatch`, id 132 = `_isCurrentPlan`). The third came from RENDERING - the current row is pinned AND was also left in the ranked body, so its single marker appeared twice.
- Two independent causes, both fixed:
  1. **Body copy removed.** PR3 kept the current row in the body so its Rank stayed visible, but the PINNED row renders the Rank column too, so the body copy was pure duplication. `display` now excludes `_isCurrentPlan` exactly as it already excluded the baseline.
  2. **Twin marker suppressed when the twin is the same plan.** A swept row differs from the user's plan only in the conversion fields `runOptimizer` strips: the on/off switch, Extra Annual Conversion, stop year. With `?mc=1` and no extra conversion, none differ, so the twin IS the user's plan re-run and had identical numbers - a second marker on an identical row reads as a bug. Marked now only when `_curDiffersFromSweep`.
- Verified both branches: identical case -> exactly 1 📍 (the pinned row), current row absent from the body, pinned row still shows Rank 106. Differing case (Extra Conversion $40k) -> 2 📍 with genuinely different numbers (current NW 660,268 vs twin 884,164), which is the informative case PR3 built the marker for.
- Added a `📍 Your plan` legend chip explaining both uses.
- Note for future readers: the rank in the user's screenshot (5) and in my repro (106) differ because their session had edited sidebar inputs; the rank map is built from `results` and is untouched by the display filter.
- node 148/148 + taxPaymentPlanner 12/12; engine untouched so byte-identical; console clean apart from the 4 known fixtures.

## Session: 2026-07-28 (worktree context-e73361) — Round 8: changelog archives consolidated (v11.13a1, PR #135)
- **I missed a pre-existing archive.** `retirement_optimizer.html` already carried a documented pattern ("Keep 5 most recent inline. Older entries lazy-load from optimizer_history.js") with a `<details>` that fetched `optimizer_history.js` and regexed `window.optimizerHistoryHTML` out of it. Round-2's split created a SECOND archive (`optimizer_changelog.md`) without noticing, leaving three tiers: 5 inline, the .md (11.13a1..11.12fb), and history.js (11.12f7 and older). Read the surrounding markup for an existing pattern before inventing one.
- The user's "Error loading older changes" was that lazy loader: `fetch()` is blocked on `file://`, and they were opening the page from disk. Pre-existing, not caused by the split, but the split is what made it worth deleting outright.
- Consolidated: 49 history entries converted to markdown and appended, `optimizer_history.js` deleted, the fetch block replaced with a plain link. One archive, 57 entries, contiguous 11.13a1 -> 11.e64.
- GOTCHA in the conversion: splitting on every `<li>` caught nested bullet lists INSIDE an entry and turned each into its own bogus release (86 "entries" from 49 real ones, 10 headed `## ?`). Caught by counting `^## 11\.` against the total. Correct approach: split only on `<li>` whose first content is `<b>version</b>`, and map nested `<li>` to markdown bullets.
- Details links now relative with a per-version anchor (`optimizer_changelog.md#11.13a1`). The GitHub blob URL was 404ing for the user because the file does not exist on `main` until this PR merges; relative also works from file://, localhost and the deployed site without hardcoding a domain. Explicit `<a id="…"></a>` before each heading, because markdown's generated ids drop the dot ("1113a1-behavior-change"). Three releases shipped multiple entries (11.1287 x3), so duplicates get a -2/-3 suffix.
- CAVEAT recorded: a raw .md is served as `text/markdown`, which some browsers download rather than render, and an anchor into plain text does nothing. The anchors pay off where the file IS rendered (GitHub, or a Pages build that renders it).
- Verified: 5 inline entries each linking to its own anchor, loader element gone, `optimizer_changelog.md` serves 200 (48.8KB), `optimizer_history.js` 404s, in-page suite green, console clean apart from the 4 known fixtures.
- node 148/148 + taxPaymentPlanner 12/12; engine untouched so byte-identical.

## Session: 2026-07-29 (worktree context-e73361, branch worktrees/planning-with-files-453213) — TPP backlog planning
- Restored planning state from `.planning/retirement-optimizer/` (active-plan pointer, not project root). `session-catchup.py` returned nothing, so state came from reading the files plus a live re-verify.
- Re-verified every factual claim in the TPP-1..5 specs against the working tree rather than trusting the writeup: `node taxPaymentPlanner.test.js` -> 27 passed / 0 failed; `taxPaymentPlanner.js` 2312 lines with `RULE_CITES` at :138; `RetirementTaxPlanner.html` 989 lines with `#compute` at :446. All still accurate; PR #136 is merged into main (`e1ddb71`) so the specs' base is in place.
- Added a sequencing table + status column to the TPP block. Only real dependency is TPP-2 on TPP-1 (remedies are scored against penalty avoided). Proposed four PRs: PR-T1 = TPP-3+TPP-4 (both small, both HTML-side), PR-T2 = TPP-5 (text-only, engine byte-identical, kept separate so that claim is reviewable), PR-T3 = TPP-1, PR-T4 = TPP-2.
- Awaiting user's pick of scope before implementing.

## Session: 2026-07-29 (worktree context-e73361) — nerdknob graduation: Stop-Year + Tax Creep (v11.13bd)
- User asked to un-gate the conversion Stop-Year ("seems robust enough"). Asked whether to fold in the tax-creep row, which had been sitting as an explicit open question in the P4 phase citing the same PF13 precedent; user said do both, and asked for a regression test.
- Read the gating mechanism before editing rather than assuming: it is inline `element.style.display` set from `applyNerdKnobVisibility()` (`optimizer_ui.js:80`) and NOTHING else. `optimizer_styles_responsive.css` has zero nerdknob rules. So un-gating = delete `display:none` from markup AND delete the JS branch, per PF13 (`optimizer_ui.js:88-92`).
- Deleted the two branches plus the two call sites that existed only to un-hide the stop-year row after writing into it (`loadOptimizerResult`, `applyConvStopYear`). Verified the ⓘ -> "Stop after YYYY" flow still works without them.
- `.input-group` has no display rule (-> block) and `.row` is `display:flex`, so with the inline override gone both rows lay out from CSS alone. That side-steps the PF13 GOTCHA (progress.md:905) where forcing `''` on an element whose flex came from an INLINE style wiped it: neither of these gets its display from an inline style any more.
- New `assertUngated()` in `optimizer_tests.js`. KNOWN LIMIT, written into the test comment: `runTests()` runs at parse time, BEFORE `applyNerdKnobVisibility()` fires in DOMContentLoaded, so it pins the markup default and not the JS path. Do not "fix" that by calling `applyNerdKnobVisibility()` from the test - it calls `initMCTab()`, which has not run yet, so the test would double-init the MC tab. The JS path is covered by the manual knob on->off check instead.
- `README.md:191` claimed tax creep was "only currently accessible via a special switch" - now false, rewritten. `README.md:632-648` already described Stop-Year as visible, so this change made the docs correct rather than needing an edit. Changelog worded per convention (never names the nerdknob), no `data-flag="behavior"` since no computed number moves.
- VERIFIED: node 148/148 + taxPaymentPlanner 27/27. Browser with no `?nerdknob`: convEndYear-wrap `block`, taxRateCreep-wrap `flex`, both `offsetParent` non-null; still-gated set (cycleLTCGTarget, opt-legend-cashfund, doc-aca-cliff, mc-nerd-panel, ui-gk) all `none`. Knob on->off leaves both visible while cycleLTCGTarget correctly flips `none`->`inline`->`none`. `?cey=2031&cem=all` fills `2031` not `$2,031`. Break Even ⓘ -> "Stop after 2040 ▸" click writes the field and re-runs (stat-nw 8,055,455 -> 8,141,627). Suite 🟢 with both new assertions passing; console clean apart from the 4 known fixtures.
- GOTCHA (environment, not code): port 8767 is held by a python3.12 process that refuses connections, so the project's launch.json config cannot bind and `curl` gets 000. Served on 8768 instead. Also: `file://` in the preview pane STRIPS the query string, so URL-param tests must run over HTTP.

## Session: 2026-07-29 (worktree readme-review-updates-c9df11) — plan restore, awaiting task selection
- New worktree, branch `worktrees/planning-with-files-be4b53`, sitting at `e1ddb71` (= `main`). Clean tree, zero commits ahead. PR #135 and PR #136 are both merged into `main`, so nothing from the prior worktrees is outstanding here.
- Planning files restored from `.planning/retirement-optimizer/` (active plan per `.planning/.active_plan`). `session-catchup.py` produced no output, and no code diff exists to reconcile.
- Only OPEN section in `task_plan.md` is the TPP-1..5 Tax Payment Planner backlog, written 2026-07-29 on top of PR #136. No findings or progress entries against it yet, so no work has started.
- Worktree is named `readme-review-updates`, which does not match any open plan phase; asked the user whether that or TPP-1..5 is the intent before planning further. User chose TPP-1..5.

## Session: 2026-07-29 (worktree readme-review-updates-c9df11) — PR 1 of 3: TPP-3 + TPP-4 + TPP-5 (v1.13be)
- Planned as three PRs, cheap and independent first. User picked: priced menu with no winner named for TPP-2, single sticky footer button for TPP-4.
- **TPP-5 note dedup.** `RULE_CITES` entries gained a `long` field; a parallel `CONCEPT_NOTES` array holds the repeated text that has no statutory authority behind it (replacement timing, RMD ordering), rendered under its own CONCEPTS heading in the same panel. Keeping those out of `RULE_CITES` is the point: everything in that array should be something a reader can look up. `seeAlso(tag)` builds the inline pointer, identical in both outputs, because the plain-text tab has no anchors.
- Measured on the dual-IRA dual-conversion scenario (2026/CA, fed 60k, state 18k, RMD 40k/30k, conv 80k/50k, SS 40k): **20,667 → 14,448 note characters, 30% off**, 28 → 19 notes over 200 chars. The plan projected ~13.2k saved; the real figure is 6.2k because the plan ALSO required keeping every scenario-specific dollar and date inline, and those two goals pull against each other. The dollars stayed.
- The existing test `Restore action states the consequences of blowing the deadline` passed unchanged, which was deliberate: the short inline text still names `IRC 408(d)(3)`, `IRC 4973`, `Rev. Proc. 2020-46`, keeps `Your income tax does not change`, and still avoids `becomes taxable`. Those are the guard against implying a converted amount newly becomes taxable, so they stay in the action, not in a cite.
- **GOTCHA (TDZ).** `RULE_CITES` and `CONCEPT_NOTES` quote `ROLLOVER_DEADLINE_DAYS` / `RESTORE_TARGET_DAYS` rather than hardcoding the numbers, but those `const`s were declared 300 lines further down and the arrays are evaluated at module init. Moved the whole four-constant block up above `RULE_CITES`, comment included.
- **TPP-3 browser tests.** `test()` now REGISTERS into a `TESTS` array instead of running on call, so `runTaxPlannerTests()` can be invoked on demand without reindenting 600 lines into a wrapper. Node entry point still sets `process.exitCode`.
- **GOTCHA (the one that actually bit).** Two classic scripts cannot both declare a top-level `const TaxPaymentPlanner` — that is one shared global lexical scope, so it is a SyntaxError and the ENTIRE test file silently failed to parse. Symptom was the badge stuck on ⏳ with a 200 on the network request and nothing in the console. Fixed by wrapping the test file in an IIFE, which also keeps `test`/`assert`/`BASE` out of the app's globals now that the file loads into a live page.
- Related: a top-level `const` is not a `window` property, so the engine's export tail gained an explicit `window.TaxPaymentPlanner = TaxPaymentPlanner` for the browser branch. The page itself reads the bare identifier and never needed it.
- Test file is injected dynamically only on `?runtests`, so the default page loads exactly the code it did before. `loadFromUrl()` now deletes `runtests` before its emptiness test — otherwise a bare `?runtests` looked like pre-filled parameters and auto-collapsed the panel and auto-computed with defaults.
- **TPP-4 sticky footer.** `#compute` moved out of `.inputs-body` into a `position:sticky; bottom:0` footer that is a SIBLING of the body, since `.inputs.collapsed .inputs-body` is `display:none` and was hiding the button outright. Footer is still hidden when collapsed, but now by choice: nothing can be edited while collapsed, so there is nothing to recompute. Print already hides `.inputs` wholesale, so print needed no change.
- **FOUND, NOT FIXED (spawned as a task).** `T.NOTE` actions have their `notes` array dropped by both renderers — `buildHtml`'s `isNote` branch returns before the bullet loop, and `buildText` pushes only the description. Two notes are invisible today, the RMD-conversion eligibility line and the QCD alternative, six occurrences each in a dual-IRA scenario. So part of the TPP-5 dedup shortened text nobody can see. Left alone because fixing it ADDS visible output, which is outside PR 1's byte-identical remit.
- **Verified:** node 27/27 planner + 148/148 optimizer. Engine numbers diffed against `HEAD` across 4 scenarios x 3 plan variants (summary numerics, per-action amounts and withholding, OC strategy table, conv comparison) — **identical**. Browser at v1.13be: `?runtests` shows `🟢 27/27` beside the version with the panel NOT collapsed and no auto-compute; all 8 pointers in the computed scenario resolve to a printed tag in both the Payment Plan and Plain Text tabs, zero orphans; 10 cites + 2 concepts render with one CONCEPTS heading; sticky footer pinned at viewport bottom (panel 1401px tall in a 720px viewport, button 359px wide, in view at scroll 0), collapsed panel back to 36px with the footer hidden. Console clean.
- Preview note: launch.json port 8767 was occupied by an unrelated `python3.12.exe` that did not answer on `/RetirementTaxPlanner.html`, so a second config `planner-8769` was added rather than killing the user's process.

## Session: 2026-07-29 (worktree readme-review-updates-c9df11) — Plan C legibility: two contradictions fixed (v1.13c0, PR #138)
- User could not understand why Plan C used quarterly estimates when A and B funded everything from IRA withholding. Reproduced and inspected internals rather than reading the source and guessing.
- **The behavior is correct and intentional.** The gate is `_gapFillAllowed = monthsRem > 0 || totalCovered < safeHarborTotal`. Plan C converts in December so `monthsRem` is 0, and its 50,000 of draw withholding already exceeded the 44,500 safe-harbor figure, so conversion withholding would have bought neither Roth growth nor penalty relief. The engine declined it and routed the residual 7,000 to estimates. Confirmed by sweeping `priorYearFedTax`: at 33,000 (safe harbor 44,500 < 50,000) Plan C withholds nothing from the conversion; at 40,000 (51,500 > 50,000) it does and the shortfall goes to zero. Economically the estimate route is also the better one - it keeps the full conversion in the Roth and needs no 60-day replacement.
- **Contradiction 1 (fixed).** The conversion step asserted "Taxes covered by December draws" and "Taxes funded by IRA draws" unconditionally, while the same plan printed 7,000 of estimates below it. `noWithholdDesc`/`noWithholdNote` were hardcoded for the case where draws cover everything and never checked `shortfall`. They now state the real split and, for a December conversion, WHY withholding was declined. Three distinct causes are reported separately (user override, the December double-negative, nothing left to fund) rather than collapsing into one sentence, and the safe-harbor clause is checked against `totalCovered >= safeHarborTotal` at note-build time rather than inferred from the gate, because a second conversion in another month can move coverage after the gate ran.
- **Contradiction 2 (fixed).** The missed-payment alert branched on `usesIraWithholding` alone - "am I withholding at all" - then said "No action is required" and "penalty-free", while every elapsed installment underneath said "PAST DUE - pay immediately ... to minimise underpayment penalty". **The installments were right and the alert was wrong:** the federal share of the withholding is 30,702 against a 31,500 required annual payment, 798 short, so a real penalty accrues. California was genuinely covered (19,298 against 11,500). New middle branch names which schedule is short and credits the one that is covered.
- **GOTCHA that made contradiction 2 bigger than a wording fix.** `shFed`/`shState` never take the IRC 6654(d)(1)(B) MINIMUM of 90%-of-current and 100%-of-prior; they use the prior year whenever it is supplied. Here that gives 33,000 where the requirement is 31,500. Correcting them in place would move the gap-fill gate and every displayed Safe Harbor figure, so new `reqAnnualFed`/`reqAnnualState` were added for the penalty test ONLY, with a comment saying the two notions are deliberately separate until TPP-1 unifies them. Do not "tidy" that into one variable without doing the TPP-1 work.
- New `withholdingCoversSchedule(withheld, reqAnnual, schedule)` at module scope, exported as `_withholdingCoversSchedule`. The test has to be CUMULATIVE, not total-versus-total: withholding is credited ratably (uniform) while a state schedule can be weighted, so on California's 30/40/30 an amount equal to the full annual requirement still misses the second date (two thirds credited against 70% required). A whole-plan assertion cannot reach that case, which is why the helper is exported.
- Also followed the flags into the renderer, which was still date-driven: the red PAST DUE badge and the green "Calendar Notice" heading were chosen from the date and the strategy respectively, so a covered installment got a red badge and the short-withholding alert got a reassuring green box. Actions now carry `noPenalty` and `benign`, both defaulting to the cautious reading.
- Tests 27 -> 30. Test 19 asserts no plan claims coverage it does not have and pins Plan C's 7,000 shortfall so the path stays exercised; test 20 asserts the alert only claims penalty-free when checked, and that the per-installment wording agrees with it; test 21 covers the weighted-schedule edge case directly. One of my own new assertions was wrong first time (`covers(999, 1000, even)`) - the $1-per-date tolerance is deliberate and matches `splitExact` rounding, so the test was corrected, not the code.
- **Verified:** node 30/30 planner + 148/148 optimizer. Engine numbers diffed against `main` across 4 scenarios x 3 plan variants - **identical**, since every change is text or a display flag. Browser at v1.13c0 on the reported URL: Plan C shows the red MISSED PAYMENT WARNING with 2 red badges (federal, genuinely late) and 2 grey DATE PASSED badges (California, covered); Plans A and B show the green Calendar Notice with no badges; the old sentences are gone from all three. `?runtests` reads 🟢 30/30. Console clean.

## Session: 2026-07-29 (worktree readme-review-updates-c9df11) — merged main, and T.NOTE sub-notes now render (v1.13c2, PR #138)
- **Step 0, unblocked PR #138.** `gh pr view` reported CONFLICTING: PR #137 (`97b0900`, optimizer Stop-Year + Fed Tax Creep un-gating) landed on main while this branch was open. Checked the overlap before merging rather than assuming the worst - the conflict was `progress.md` ONLY, where both branches appended a session entry to the tail. Zero code overlap: main touched the optimizer files and README, this branch touches only the Tax Payment Planner. Kept both sets of entries, main's first since they came earlier in the day.
- `task_plan.md` auto-merged but arrived self-contradictory: the earlier session's four-PR table (PR-T1..T4, all pending) sitting next to this branch's three-PR split with TPP-3/4/5 done. Reconciled into one status table, marked the four-PR proposal superseded, and dropped that session's now-stale line counts and 27-test baseline. An auto-merge that produces no conflict markers can still produce contradictory prose - read the merged region, do not just trust the exit code.
- Post-merge verify: taxPaymentPlanner 31/31, optimizer_core 148/148 with #137's changes in the tree.
- **Step 1, `T.NOTE` sub-notes render.** `buildHtml`'s `isNote` branch returned before the bullet loop every other action type gets, and `buildText`'s `T.NOTE` branch pushed only the description, so advisory notes were the one action type whose `notes` never reached a reader. Both now render, styled to match the ALERT bullets rather than the per-step ones since a note is not a numbered step.
- Two pieces of guidance became visible for the first time: "Only the balance beyond the RMD can be converted" and the QCD alternative, six occurrences each (2 IRAs x 3 plans), both resolving to their `RULE_CITES` long text via the TPP-5 pointers.
- Proved the new test is not vacuous by running the same assertion against the pre-fix engine out of `git show HEAD:` - PRE-FIX false/false, FIXED true/true. Worth doing whenever a test is written after the fix rather than before it.
- Was the pending task chip; superseded and dismissed rather than left as a duplicate.
- **Verified:** node 31/31 planner + 148/148 optimizer. Engine numbers diffed against `main` across 4 scenarios x 3 plan variants - **identical**, text-only change. Browser at v1.13c2: QCD note visible 6 times, 6 bullet lists under the 6 advisory notes, both new pointers resolve to printed tags. Console clean.

## Session: 2026-07-29 (worktree readme-review-updates-c9df11) - brokerage position now handed to the planner (v1.13c3 / v11.13c3, PR #138)
- User: "default brokerage appreciation is 40%, seems excessively high, should be 5%." Verified before changing, and the premise was wrong in a useful way: `appreciationPct` is the unrealized-gain FRACTION OF VALUE, not an annual growth rate. It feeds exactly one expression, `extraCg()` at taxPaymentPlanner.js:1836, which grosses up a brokerage sale for the capital-gains tax: sell `n/(1 - app*cg)` to net `n`. 5% would model a 95%-basis account and cut the modeled cost of "pay the taxes by selling brokerage" by 8.6x ($4,957 -> $576 on their scenario), making that option look near-free against IRA withholding. Declined the value change and said why.
- User then found the real bug: the optimizer tracks basis, but changing it moved nothing in the planner. Confirmed two ways. Source: `openTaxPlanner` (optimizer_ui.js:2399) contains zero references to appreciationPct/cgRateBlended/ap/cgr. Live: intercepted `window.open`, clicked a year cell, captured 20 URL keys with neither present. The RECEIVING side already worked (SHORT_TO_LONG had `ap` and `cgr`, both in NUM_FIELDS) - the gap was one-sided, sender only.
- Also missing: `highIncomeFiler`, which drives the 110% safe harbor.
- **GOTCHA in my own test harness:** programmatic `DisplayHelpers.setDollarValue` writes to `#BrokerageBasis` did not stick (`dataset.numVal` stayed at the first value), and a basis above the Brokerage balance is rejected outright. So I never actually swept basis; the conclusion rests on the URL keys plus source, which are unambiguous. Said so rather than implying a sweep I did not run.
- User chose two dollar fields over renaming the percent field, and all three missing params.
- **Engine:** new optional `brokerageValue`/`brokerageBasis`. When both present and value > 0 they derive `appreciationPct`, clamped to [0,1]. A basis above value is a loss position with no representation here - `extraCg()` would go negative and start crediting a refund against the cost of selling - so it clamps to 0. Raw `appreciationPct` still honoured, so legacy `?ap=` links work.
- **Planner UI:** "Brokerage Appreciation (%)" deleted; new "Brokerage Position" section with two dollar inputs plus a computed readout of the gain share. New `readNumOrNull` because blank must stay distinct from zero: blank means "no position, use the default", where `readNum`'s `|| 0` would say "an empty account". `bv`/`bb` URL params; legacy `?ap=NN` is converted on load into a $100,000 position with the matching basis, since only the ratio reaches the engine.
- **Handoff:** `set('bv', row.Brokerage)`, `set('bb', row.Basis)`, blended LTCG = `-capGainsRate + StateRate%` clamped to the input's 0-40 max, and `hi` from **prevRow.MAGI > 150000** - prevRow, not row, because IRC 6654(d)(1)(C) tests the PRIOR year's AGI, the same year priorYearFedTax comes from.
- Measured on the default scenario, year 2029: Brokerage $99,378 / Basis $39,318 = **60.4% gain share** against the old hardcoded 40%, and 15% fed LTCG + 8% state = **23%** against the hardcoded 20%. So the previous defaults understated this user's cost, the opposite direction from the change they proposed.
- **Verified:** node 32/32 planner + 148/148 optimizer, optimizer in-page suite 242/242. Planner numbers diffed against `main` - identical, because the default path with no dollars supplied is untouched. Handoff URL now 24 keys carrying bv=99378, bb=39318, cgr=23.0, hi=1; the planner populates both dollar fields, shows "Unrealized gain: 60.4% of value ($60,060 of gain)", derives ap=0.6044, and the all_brokerage capital-gains cost moves $4,957 -> $9,202. Legacy `?ap=60.4` restores as $100,000/$39,600 -> 0.604. Both blank -> 40% with the readout saying so. Share URL emits bv/bb and no ap.
- GOTCHA (verification): `read_console_messages` retains history ACROSS navigations in the same tab, so the 4 known optimizer fixtures appeared to be planner errors. A fresh tab showed the planner console genuinely clean.
- Version note: the hex(dayOfYear*24+hour) scheme has hour resolution, so this landed in the same hour as v1.13c2. Stepped manually to 13c3 to keep one version per commit.

## Session: 2026-07-29 (worktree context-e73361, branch worktrees/markdown-changelog-rendering-a11a86) — P25 markdown docs render (v11.13c5)
- User: "loading tools.netcitizen.us/optimizer_changelog.md in a browser does not render the .md" and asked to investigate the P25 task, offering shared-.js-component or single-generic-viewer shapes.
- INVESTIGATED THE PREMISE BEFORE DESIGNING, and it was wrong. `curl` against the live site: `/optimizer_changelog.md` -> 200 `text/markdown` (browsers download it), but `/optimizer_changelog.html` -> **200 `text/html`, 57,564 bytes, fully rendered**. Same for `/ARCHITECTURE.html` (29,180). GitHub Pages runs Jekyll v3.10 with the default `jekyll-theme-primer` and publishes every `.md` as HTML at its `.html` URL. Proof in the served markup: `<meta name="generator" content="Jekyll v3.10.0" />`, `<div class="container-lg px-3 my-5 markdown-body">`. P25's whole spec (docs.html + hand-written parser + sanitizer, ~350 lines) was for a problem the host already solves.
- Also verified in the rendered output before committing to the approach: all 58 explicit `<a id="11.13a1"></a>` anchors survive kramdown, so per-version deep links ALREADY worked at the `.html` URL; ARCHITECTURE tables and its `#1-module-dependency-graph` ToC render; the 5 mermaid fences become `<pre><code class="language-mermaid">`; and the theme advertises its own hook in a comment: "customize with your own _includes/head-custom.html file".
- `/README.html` is a 404 — README maps to `/`. Special-cased, not guessed.
- Presented the finding and the options; user chose Jekyll-only (no client-side viewer), "style the code block only" for mermaid (no mermaid library), and the runtime link rewriter for the local gap. User asked what Jekyll was first, so the answer explained it is a tool GitHub runs server-side, not something in the repo.
- SHIPPED: `doclinks.js` (IIFE + `window.DocLinks` + CommonJS tail, per the displayhelpers.js pattern), `doclinks.test.js` (16 tests), `_includes/head-custom.html`. Hrefs in the markup STAY `.md` because that is what is true on disk; `docHref()` upgrades them to `.html` at runtime only when the origin is not local. `window.__DOCLINKS_FORCE_RENDERED` overrides the origin check so the rewrite path is testable from localhost.
- GOTCHA (design, load-bearing): `doclinks.js` must keep `defer` AND sweep the whole document. The inline script at `retirement_optimizer.html:~669` copies the newest changelog `<li>`'s innerHTML into the LATEST CHANGE banner during parse, so by sweep time there are TWO copies of that Details link. Scoping to `#changelog-list` would leave the banner on the raw `.md`. Verified: 8 links rewritten, banner copy included.
- GUARDS, each one a real case not a hypothetical: absolute URLs untouched (the theme footer emits an absolute `.../edit/main/optimizer_changelog.md` "Improve this page" link — rewriting it would break it); `README.md` -> directory index not `README.html` (that 404s); dot-directories left alone (Jekyll never publishes them, so `.html` would 404 too).
- FOUND IN PASSING, live bug: `README.md:177`'s three "CURRENT PLANS / findings / progress" links 404 on the site — Jekyll skips dot-directories, so `.planning/**` is not published in ANY form (confirmed: both `.md` and `.html` return 404). Repointed at GitHub blob URLs.
- Mermaid handled without a library: caption + link to GitHub's blob view, which draws it. `precedingHeadingId()` walks previous siblings then up, so the link lands on the section, not the top of the file.
- Back link added to rendered doc pages (they have no navigation at all), suppressed on the index since the rendered README already links every tool.
- Stale docs corrected while in the area: `ARCHITECTURE.md:282` + `:309` and `FILE_DIRECTORY.md:51` all still described `optimizer_history.js`, which is neither on disk nor in `git ls-files`. New **Docs rendering** convention entry records the Jekyll dependency and the load-bearing warning: **never add `.nojekyll`**, it would 404 every docs URL.
- VERIFIED: node doclinks 16/16, optimizer_core 148/148, taxPaymentPlanner 27/27 (engine untouched, so those two had to stay put and did). Browser on localhost:8768 — local path leaves all 8 `.md` hrefs alone (`isRendered()` false); forced-rendered path rewrites exactly those 8 of 35 links and nothing else; in-page suite 242/242, Documentation tab 🟢, console clean apart from the 4 known fixtures; title/first-`<li>`/stat-version all read 11.13c5, 5 entries with 11.1370 dropped; 59 changelog anchors, all unique.
- The Jekyll half (head-custom.html) CANNOT be verified before merge without installing Ruby. Instead of shipping the DOM code unproven, simulated a rendered page in the browser: injected primer's `.markdown-body` with kramdown-shaped mermaid `<pre>` and heading ids, then ran the passes. 2 blocks captioned with correct nearest-heading anchors, non-mermaid `<pre>` untouched, nav prepended and idempotent, `README.md` -> `./`, edit link intact. Failure mode if the include is ignored is benign: pages look as they do today.
- ENVIRONMENT: port 8767 still held by the same refusing python3.12 process, so added a second `retirement-optimizer-8768` config to the gitignored `.claude/launch.json` rather than fighting it.
- MERGE (2026-07-29, same session): PR #138 landed on `main` an hour after this branch forked, so the PR went CONFLICTING. Merged `origin/main` in (repo precedent is merge, not rebase - see `9b72af3`). Three conflicts, all "both inserted at the same spot", zero code conflicts: `doclinks.js` / `doclinks.test.js` / `_includes/` are files main never saw, and main's `optimizer_ui.js` + `taxPaymentPlanner.js` work does not overlap. `task_plan.md` auto-merged.
- VERSION COLLISION, the non-obvious part: the minor is `hex(dayOfYear*24 + hour)`, so two branches touched in one afternoon produce ADJACENT numbers and **the first to merge is not necessarily the lower one**. This branch was v11.13c2 (hour 18); PR #138 merged v11.13c3 (hour 19) first. Resolved by recomputing from the clock rather than taking either side: renumbered to **v11.13c5** (hour 21) across `<title>`, the `<li>`, the `<a id>`/heading in the changelog, and the `?v=` tokens in both `retirement_optimizer.html` and `_includes/head-custom.html`.
- Changelog list resolution: kept BOTH new entries (ours + main's 11.13c3) and dropped 11.137f as well as 11.1370, because the list holds exactly five. `optimizer_ui.js?v=1113c3` took main's value untouched - we never edited that file, and the convention is to bump only the changed file's token.
- `progress.md` resolution: both session blocks kept, main's first since it was committed first.

## Session: 2026-07-30 (worktree readme-review-updates-c9df11, branch worktrees/planning-with-files-f027a2) — README audit round 3

- Session opened with `/plan` and no task. Planning files existed but the header was stale: it claimed P25 was "COMMITTED on this branch and carried by open PR #139". `gh pr list` shows no open PRs at all - #135 through #139 are all merged, tree clean at `main` = `2537135`. Refreshed the "As of" block, flipped PR #137 from "open" to MERGED, corrected three "DONE (v1.13be, uncommitted)" markers to "merged PR #138", and fixed the P4 priority row that still said the un-gate decision was pending (PR #137 decided it). User then chose README review as the task.
- AUDITED CLAIM BY CLAIM AGAINST CODE, not against the changelog. That is what caught the items a changelog read would have missed, and equally what stopped two false alarms.
- The find that mattered most: **`README.md:258` said "(The *Cash Reserve* is ignored currently)" inside the section titled What the Tool IGNORES (No Plans to Implement)** - false since v11.1340, and contradicting `:185` plus three whole FAQ entries. Of every error here, this is the one a skeptical reader would have trusted most.
- Stale numbers, each traced to a line of source: planner version 1.13b9 vs `RetirementTaxPlanner.html:11` = 1.13c3 (and the paragraph never mentioned PR #138 at all); Income Tax Planner "14 states" vs 38 built at runtime from TAXData (`IncomeTaxPlanner.html:1157`); federal-std-deduction states listed 6 of 8 (MS and IA missing); `retirement_optimizer_taxdata.js` does not exist and never did in this tree - the data is `var TAXData` in `taxengine.js`.
- THREE WRONG FACTS IN ONE SENTENCE at `:233`: Reduce is `[2..15,20,25]` not "1 to 30" (`optimizer_ui.js:805`); IRA Draw is `[5,6,7,8,10,12,15,20]` not "5-10%" (`:834`); and "× Max Conversion on/off" **does not exist** - `optimizer_ui.js:797` sets `const convOn = true` and every swept row inherits it, same in `buildVariations()` at `optimizer_core.js:3172`. Also moved ACA Cliff out of the plain list, since those arms are NERD_KNOBS-gated and skipped once both people are on Medicare.
- FALSE ALARMS, both checked before touching anything. (1) The AL/MT/OH standard-deduction inflation bug at `:181` is STILL REAL: `INFLATION_INDEXED:false` is honoured only for brackets (`taxengine.js:1089`), while the std is multiplied by inflation unconditionally at `:1349-1351`. ND and SC escape via `std:'FEDERAL'`, which leaves exactly the three states the README names. (2) "23% SS reduction" against the `ssFailPct = 77.3` default is correctly rounded.
- COVERAGE GAP was the larger half: greps for ⚖, "Full Retirement Age", "cyclic", "Current Plan", "Stress" returned zero hits, or hits only inside the reviews of *other people's* tools (Guyton-Klinger appeared only as a NestWise/AiRA feature). Added five Recent Fixes bullets (⚖ head-to-head compare, ⚓/📍 + Rank, Stress Failure tile, SS paid from the birth month, survivor benefit from the real FRA) and three Key Features bullets (💵 cash-funded taxes as advanced-only, Cycle Brokerage with its 🗘/🔄 sweep rows, the "Optimize for" selector which previously existed only in the FAQ).
- FAQ objective list went from 4 to all 9. Two were wrong, not just missing: the label is "Avoiding Widow & RMD Tax", and it is not "taxes your heirs will pay" - `OPTIMIZER_OBJECTIVES.widowrmd` (`optimizer_core.js:2789`) scores in-plan RMD tax plus the deferred tax on the terminal IRA.
- OPEN QUESTION RESOLVED, and worth recording because it was a real risk: the README renders at `/` through **kramdown**, not GitHub.com's slugger, so the 30-entry Table of Contents could have been silently broken on the live site while passing locally. `curl https://tools.netcitizen.us/` and diffing the emitted ids: all 30 match, including `who-are-these-tools-for--what-can-they-do` (double hyphen from the double space) and `combined-tax-torpedo-examples-during-85-ss-phase-out`. No TOC change needed.
- Found in passing and fixed: `retirement_optimizer.html:1119` still listed the "optimizer objective selector" among the NERD_KNOBS-gated UI. PF13 un-gated it; the comment outlived the code. Comment-only, no behavior change.
- VERIFIED: node optimizer_core 148/148, taxPaymentPlanner 32/32, doclinks 16/16. Browser on localhost:8768, in-page suite 242/242, console clean apart from the 4 known TEST fixtures. Live DOM confirms the exact 9 objective labels the FAQ now lists, the selector visible without nerdknob, and the 💵 legend still hidden without it - which is precisely what the new Key Features bullet claims. Anchor/link sweep re-run after editing: 60 in-page anchors, 7 relative links, none broken. Zero em-dashes added (the 5 in the file are all pre-existing).
- No version bump: documentation plus one code comment. ENVIRONMENT: port 8767 is still held by the same refusing python3.12 process, so added the `retirement-optimizer-8768` entry to this worktree's gitignored `.claude/launch.json` rather than fighting it.

## Session: 2026-07-30 (same worktree) — link labels follow the href (v11.13d0) + deferred caveats audit

- User: the live 11.13a1 "Details" link still goes to `optimizer_changelog.md`, and "Every earlier release is written up in optimizer_changelog.md" is also not the HTML - "11.13c5 claims that was fixed. What am I missing?"
- SPLIT THE REPORT BEFORE FIXING ANYTHING, and the two halves had different answers. Checked the live DOM directly: `DocLinks.isRendered()` true, **zero** `.md` hrefs, all eight changelog links `.html` including `#11.13a1`. So the href half shipped and works. The tell for what the user was seeing: they said 11.13a1 was the FIRST changelog entry, but live's first is 11.13c5 and 11.13a1 is fourth. That page is a cached copy predating `doclinks.js` entirely. `Cache-Control: max-age=600` on the HTML, and nothing version-stamps the HTML itself the way `?v=` stamps the JS. Answer there was a hard reload, not a code change.
- THE SECOND HALF WAS A REAL DEFECT AND NOT A CACHE ARTIFACT: `doclinks.js` rewrote `href` attributes only, never link TEXT. So on a fully current page four anchors read `optimizer_changelog.md` / `README.md` while opening the `.html`. Confirmed in the live DOM: label `optimizer_changelog.md` -> href `optimizer_changelog.html`. Naming one file and opening another looks like the fix never shipped, and anyone who copies the visible name gets a file that downloads instead of displaying.
- FIX: new pure `docLabel(text, oldHref, newHref)` beside `docHref()`, exported for node. Swaps only when the href actually moved, the old text is EXACTLY the old basename, and the new href ends `.html`. Three deliberate non-cases, each a real link on the page: "Details" and "Improve this page" never match a basename; `README.md` falls through because `docHref` returns `'./'` with no `.html` basename to swap in (and "README.md" is still the honest name of what sits at the root); an unchanged href (every local run) returns immediately.
- GOTCHA guarded on purpose: relabelling reads and writes `textContent`, which would flatten markup inside an anchor. Gated on `childElementCount === 0`. The `<strong>` at `retirement_optimizer.html:631` wraps the `<a>` rather than the reverse, so nothing on the page needs the escape hatch today - the guard is for the next author.
- `text.replace(oldBase, newBase)` rather than rebuilding the string, so surrounding whitespace survives; there is a test for exactly that.
- Tests 16 -> 22. The most useful new one is the negative: an unchanged href never relabels, driven through `docHref(href, false)` so it exercises the actual local-run path rather than a hand-made argument.
- VERSION 11.13d0, computed from the clock (`hex(211*24 + 8)`) rather than incremented from c5, per the collision hazard at the top of task_plan. Bumped `<title>`, the `?v=` token on doclinks.js in BOTH `retirement_optimizer.html` and `_includes/head-custom.html`, new changelog entry with its `<a id>`, new summary `<li>`, dropped 11.1387 to keep the list at five.
- CAVEATS AUDIT arrived mid-turn from a separate read-only session (What the Tool IGNORES / Limitations). Spot-checked 5 of its citations before accepting any of it: `grep -c comp_ optimizer_core.js` = 0, `multiAssetBank` gating in `montecarlo/mc_controller.js`, capital gains floored at 0 at `optimizer_core.js:1402`, `RMD_TABLE` self-labeled "Simplified" starting at 72, and the 13 unmodeled states matching an independent enumeration of TAXData. All held.
- Its deliverable was never written into this worktree, so preserved it verbatim at `.planning/retirement-optimizer/readme_caveats_findings.md` with the file:line evidence intact, and added a DEFERRED phase naming the three clusters. User chose corrections-only for now.
- Both remaining corrections applied: Account Composition "WILL affect the Monte Carlo" is true for Historical bootstrap and Stress ONLY (`montecarlo/mc_controller.js:222-241` gates on `(mode === 'bootstrap' || mode === 'stress') && multiAssetBank`) - Synthetic/GBM and the deterministic run both fall back to the single growth rate, and there is no Cash composition row at all. Also trimmed the duplicate two-Roth-balances sentence from Limitations, since Key Features already says it.
- BIGGEST DEFERRED ITEM, worth naming here so it is not lost: README's own Tax Torpedo table lists NM, RI, UT and VT as SS-taxing states, and the engine models none of the four. 38 of 51 jurisdictions are modeled and there is no local/city income tax anywhere (NYC ~3.1-3.9%).
- VERIFIED: node doclinks 22/22, optimizer_core 148/148, taxPaymentPlanner 32/32. Browser localhost:8768, in-page 242/242, `#testsFailed` 🟢, console clean apart from the 4 known TEST fixtures. Local path untouched (8 `.md` hrefs, 4 `.md` labels, `isRendered()` false); forced-rendered rewrote 8 links, 0 `.md` hrefs left, both changelog labels became `.html`, all five "Details" labels untouched. Changelog list reads 11.13d0/c5/c3/bd/a1. README anchor sweep after editing: 60 anchors, 7 relative links, none broken.

## Session: 2026-08-03 (worktree context-ab498f, branch worktrees/planning-with-files-76e427) — plan restore, awaiting task selection

- Session opened with `/plan` and no task. Planning files are under `.planning/retirement-optimizer/` (the `.active_plan` pointer), not at the repo root — `ls task_plan.md` at root fails, which is expected, not a missing plan.
- STATE VERIFIED AGAINST GIT, not against the header: `git fetch` then `git rev-parse HEAD origin/main` both give `ce54356`; `git status` clean; `gh pr list --state open` empty. The header was one commit stale (claimed `main` = `34feeb8` and "through PR #144") because PR #145 — the P35/P36/P37 doc commit `6f94c82` — merged after it was written. It also named the previous worktree's branch. Both corrected.
- GAP WORTH NAMING: `progress.md`'s last entry before this one is 2026-07-30. The two plan-only batches since (P29-P34 on 2026-08-01, P35-P37 on 2026-08-03) were committed to `task_plan.md` without a session log here, so the phase specs exist but the reasoning trail for *why those phases, in that order* lives only in the phase bodies.
- Open work, from the phase status lines: P35 (Phased strategy, build-first, staged PR 1-8) with P36 as its PR 7 and P37 deferred; the research-first batch P29/P30/P31/P32/P34 and build-first P33; P27 scoped-not-started; P28 research done with the ship decision open; and the older pending set P16/P17/P18/P22/P23 plus P19's state-coverage remainder.
- Awaiting the user's pick before any code is written. P35's own note stands: read the "P35 engine survey" in `findings.md` first — several items are traps that produce a plausible wrong answer rather than an error.

## Session: 2026-08-03 (worktree context-ab498f, branch worktrees/planning-with-files-76e427) — P35 PR 1: characterization goldens for both strategy enumerations

- Task chosen from the restored plan: P35 PR 1+2, stopping at the review point before PR 3. This entry covers PR 1 only.
- THE PROBLEM PR 1 EXISTS TO SOLVE: the Optimizer's 44-family enumeration is inline in `_runOptimizerNow()` (`optimizer_ui.js:797-896`) — not exported, never runs in node — while MC's `buildVariations()` is exported but sweeps a smaller space, and the only assertion on it was `length > 0`. PR 2 extracts the Optimizer's copy into core; an extraction is only provably behavior-preserving against a recording made BEFORE it.
- Deliverables: `sweep_golden.js` (data, dual-mode, 4 MC bases + 4 browser captures), `sweep_golden.gen.js` (regenerates the MC half FROM SOURCE), `sweep_golden.import.js` (folds a browser capture into the Optimizer half; the capture recipe is its header comment). One observation-only line in `optimizer_ui.js` publishes `OptimizerState.lastEnumeration` — taken after the cyclic and 💵 passes and before the spend/conversion passes, which append to the same list.
- EVERYTHING IN THE GOLDEN IS A RECORDING, NOT A RESTATEMENT. The MC half is generated by calling the real function; the Optimizer half is POSTed out of a live page. Nothing in either was typed from reading the source, which is the only way a characterization test can catch a transcription error in the thing it is characterizing.
- TWO FINDINGS THAT WOULD HAVE PRODUCED A WRONG GOLDEN, both written up in `findings.md`. (1) The sweep's result cache is keyed on inputs and NOT on `NERD_KNOBS` (`optimizer_ui.js:692-701`), so flipping the knob and re-running silently returns the cached non-nerdknob table — also a live defect for the Documentation-page checkbox, which is the only runtime way to flip it. (2) The stock scenario has `startAge: 65` and `birthyear2: 1952`, so `bothOnMedicareAtStart()` suppresses the ACA family regardless of the nerdknob: a "nerdknob on" capture records 176 rows with zero ACA arms and looks complete. Needed a third capture at `startAge: 60` / `birthyear2: 1962` to get them.
- Four captures rather than the two the plan called for: `default` 132 rows / 44 base, `nerdknob` 176 / 44 (💵 appear, ACA still absent), `nerdknobACA` 192 / 48, `nerdknobNoCashOffGrid` 147 / 49 (Cash 0 kills the 💵 clones; the off-grid IRA Draw 9% is appended LAST, after Guyton-Klinger, not sorted into its family). Between them every gate the enumeration has is opened and closed at least once, and each gate is isolated from the others.
- The divergence between the two sweeps is now pinned FROM BOTH SIDES on purpose — MC's IRA Draw grid stops at 10% and it sweeps neither IRMAA ceilings nor ACA; the Optimizer runs to 20% and sweeps both. Declared rather than accidental, so PR 2 cannot collapse them onto one grid without failing one side.
- Transfer note worth keeping: routing a capture through the agent's context costs ~20KB per scenario. A 40-line local POST sink (scratchpad, port 8769, CORS-limited to the preview origin) writes each capture straight to disk instead. Four scenarios cost about one tool call each.
- MUTATION-CHECKED, because a golden that cannot fail is decoration: perturbing `MC_GRIDS.fixedpct` from `[5,6,7,8,10]` to `[5,6,7,8,11]` fails 9 tests and the message names the differing index (31) and prints golden vs actual. Reverted with `git checkout`.
- Found in PR 1 and recorded against PR 2: `bothOnMedicareAtStart` lives in `optimizer_ui.js:4714`, not in core beside its `eitherOnMedicareAtStart` twin. It is pure, so PR 2 should move it rather than pass a boolean through `opts`.
- VERIFIED: node optimizer_core 167/167 (was 148, +19), taxPaymentPlanner 32/32, doclinks 22/22. Browser on localhost:8768 — in-page suite 🟢, console clean apart from the 4 known TEST fixtures, sweep runs at 1235ms / 1703 runs, `#tab-opt` renders with IRMAA Ceil / Proportional / Guyton-Klinger all present. Re-captured `default` after the reload and diffed it against the committed golden: rows and base byte-identical.
- NO VERSION OR CHANGELOG BUMP: nothing user-visible ships here. Did bump `optimizer_ui.js?v=1113c3` to `?v=111437` (clock, `hex(215*24+15)`) so a returning browser actually loads the capture hook — a stale copy behaves identically for users but would make a future capture read `undefined`.
- ENVIRONMENT: port 8767 still held by the same refusing python3.12 process; added the `retirement-optimizer-8768` entry to this worktree's gitignored `.claude/launch.json`, same workaround as the last two sessions.

## Session: 2026-08-03 (same worktree) — P35 PR 2: the enumeration moves to core, proved against PR 1's recording (v11.1437)

- `buildStrategyFamilies(base, opts)` + `OPTIMIZER_GRIDS` + `MC_GRIDS` now live in `optimizer_core.js` and are exported. `_runOptimizerNow()` lost about 100 inline lines and calls it; `buildVariations()` became a `.map()` over the same list. The enumeration is reachable from node for the first time, which is the thing P36 was blocked on.
- SEVEN OPTIONS, ONE PER REAL DIVERGENCE: `grids`, `irmaaFamily`, `acaFamily`, `bracketResetsIRMAATier`, `markCashFunding`, `cashClones`, `offGridLast`. Chosen over a single "mode" flag so each call site reads as a statement of what that sweep does and does not cover. Two of them were differences nobody had written down anywhere: MC does NOT reset `stratIRMAATier` on its Fill Bracket rows (so a sidebar tier selection leaks in — left alone here, PR 2 is byte-identical by contract), and the off-grid row sits after IRA Draw in MC but last, after Guyton-Klinger, in the Optimizer.
- Row shape is `{family, modifier, strategyLabel, paramLabel, paramSortVal, overrides}`. The `modifier` (null / 'ira-first' / 'brokerage-first' / 'cash') exists because the two callers decorate differently: `_strategyFamily` and the Optimizer's label want the HTML `<span>` 🗘, while MC's `_label` wants the PLAIN-text one, since it is read into chart legends and CSV where markup would show through. Returning the decorated label AND the raw parts avoids either caller parsing a prefix back off.
- `bothOnMedicareAtStart` moved from `optimizer_ui.js` to core, beside its `eitherOnMedicareAtStart` twin. It had no test at all; it has one now. The pair differ only in AND vs OR and the whole ACA family hangs off which one is used.
- PROOF, and it is the reason PR 1 existed: all four `OPT_GOLDEN` captures were re-run in the live page after the extraction and diffed with a raw `JSON.stringify` — rows and base byte-identical, key order included, on 132 / 176 / 192 / 147 rows. Regenerating `MC_GOLDEN` from source produces a zero diff. `OptimizerState.results` is 177 before and after, and the perf readout still reports 1703 runs.
- The node test does normalise key ORDER inside an overrides object before comparing, because that order is an artifact of how the old block happened to spread its literals rather than a behavior. The live-page diff above is the strict one and it passed unnormalised, so nothing is being hidden by that.
- ONE BUG THE NODE TESTS COULD NOT HAVE CAUGHT, and the browser did on the first load: the no-conversion baseline sweep at `optimizer_ui.js:1073` still referenced `baseFamilies`, deleted with the inline block. `_runOptimizerNow()` never runs in node, so 173 green tests said nothing about it. Re-added as `families.filter(f => f.modifier === null)`, which is what the old snapshot was.
- VERIFIED: node optimizer_core 173/173 (+6), taxPaymentPlanner 32/32, doclinks 22/22. Browser on localhost:8768 — in-page suite 🟢, console clean apart from the 4 known TEST fixtures, both `?v=` tokens confirmed at 111437 in the live DOM. MC checked separately at its integration points: `buildVariations` returns 111 rows with `_label` "🗘 Proportional 0% ✓" (plain) against `_strategyFamily` "<span…>🗘</span> Proportional" (HTML), which is exactly the old split; `montecarlo/` reads only `_label`, `_strategyFamily`, `_paramLabel` and all three are preserved.
- VERSION: `?v=` tokens on both `optimizer_core.js` and `optimizer_ui.js` bumped to `111437` (clock, `hex(215*24+15)`). No title bump and no changelog entry across PR 1 and PR 2 together: the output is provably identical, so there is nothing to tell a user about.
- STOPPING HERE. PR 3 (release the ACA ceiling after 65) is the first one that moves numbers, and the plan calls for a review point before it.

## Session: 2026-08-04 (worktree context-ab498f, branch worktrees/bracket-limit-fix-a41f0c) — P35 PR 3a: the bracket-lookup floor (v11.1447)

- User sent four corrections to the remaining P35 plan: step-up is per state law, 100%-basis brokerage draws tax-free, ACA should fall back to Proportional 0% with the 65 coming from TAXData, and P36 should run before Phased lands. Planned all four; PR 3 split into 3a-3d. This entry covers 3a only.
- THE FOURTH THING, WHICH NOBODY ASKED FOR AND WAS THE BIGGEST: verifying whether the ACA fallback would clip spending led to `findUpperLimitByAmount` returning `limit: 0` below the first bracket. A single-row `[{l: Infinity}]` table matches that on EVERY lookup, and 21 of 38 modelled jurisdictions have one. Full mechanism and measurements in `findings.md`.
- MEASURED, NOT INFERRED, and the split is clean: `bracket` and `propwd` change in exactly the 21 single-row states and **0 of 17** graduated ones; `minlimit` changes in all 38, because it also clamps with the IRMAA lookup and the first tier (~$218k MFJ) sits above an ordinary spend goal. Fill Bracket 22% on a single filer: NV/TX/FL $465 -> $163,686, IL $6,740 -> $163,686, AZ $775 -> $151,101, CA and NY unchanged to the dollar.
- The worse half is the one that would never have been filed as a bug: with `goalLimit` zeroed, `targetSpend` went to 0 for every non-bracket strategy, `totals.spend` accumulated negatives, and the success test `netIncome < targetSpend * 0.99` could not fail against a zero target. NV reported **total spend -$649,857 with `success: true`**. Now $810,921 and correctly `false`.
- WROTE THE TESTS FIRST AND RAN THEM BEFORE THE FIX, which is the only reason I can claim they bite: 4 of the 7 failed with the exact predicted messages, the other 2 are deliberate regression guards (the in-ladder path unchanged, the 21-state list pinned) and passed both before and after. node 148 -> 155.
- TWO OF MY OWN CLAIMS WERE WRONG AND ARE CORRECTED IN `findings.md` RATHER THAN QUIETLY DROPPED. (1) "minlimit converts nothing anywhere" was overstated: on a couple with a $750k IRA goal it converts $0 in CA both before and after, because CA's narrow brackets bind legitimately. (2) My first minlimit measurement omitted `stratRate`, which zeroes the ceiling for an unrelated reason — a minlimit scenario without a named bracket proves nothing. The defensible claim is the mechanism, not a universal outcome.
- The 0 sentinel was overloaded: the same function's last-bracket path uses 0 to mean "no upper limit", the opposite. Both meanings are now documented in place. The last-bracket branch is left alone deliberately — it is unreachable, since FEDERAL, every state and IRMAA all terminate at `{l: Infinity}` and the one table that does not (SOCIALSECURITY) is never passed to this function.
- CHECKED BEFORE ASSUMING A BUG: the in-app changelog list is missing 11.13c5 and 11.13d0. `git show b11fb0a` proves that was deliberate ("Link details are unimportant to the user. Remove from changelog, but keep in the .md"). Left alone; my entry went on top and the list now holds five.
- VERIFIED: node optimizer_core 155/155, taxPaymentPlanner 32/32, doclinks 22/22. Browser on localhost:8768 — title/version stat/amber BEHAVIOR CHANGE banner all read 11.1447, in-page suite green, console at the known 4-fixture baseline, **zero `Infinity` and zero `NaN` anywhere in the rendered page** (the specific risk of returning Infinity from the lookup), and NV at Fill Bracket 22% converts $215,100 against CA's $168,128 with the federal ceiling $223,404 intact.
- `taxengine.js?v=` bumped in all four HTML files that load it, not just the optimizer's. Only `IncomeTaxPlanner.html` even mentions the function, and only in a comment, so no other tool's behavior changes — but a stale cached engine would have been a real hazard given this is a behavior change.

## Session: 2026-08-04 (worktree readme-review-updates-c9df11, branch worktrees/next-on-list-55379e) — doc file-reference gaps, the golden-file question, and P35 PR 3b rebuilt from scratch

- User asked for three things: the file-reference sections were never updated for files recent PRs added; it was unclear whether the `sweep_golden.*` files are harnesses that belong in `.test_harnesses/` or interim profiling artifacts; and PR 3b was to be **started over**, abandoning [PR #148](https://github.com/nightskyguy/retirement_assets/pull/148) rather than continuing a branch whose edits had produced conflicts. Built fresh on `main` = `9014c81`. **#148 should be closed, not merged — the same change now exists here.**
- ANSWERED THE GOLDEN QUESTION WITH A RULE, not a one-off placement: **would the node suite fail without this file?** `optimizer_core.test.js:67` `require`s `sweep_golden.js` at the top level, so it is a fixture — 18 named tests assert against it, and deleting it does not lose 18 tests, it stops the suite from loading at all. `.test_harnesses/` is for scripts that answer a research question once (BETR, stop-year, unified-conversion): not run by any `.test.js`, several browser-only, output is prose in `findings.md` / `P28_RESULTS.md`. Neither `gen` nor `import` is interim or profiling — `gen` rewrites `sweep_golden.js` in place by `__dirname`, so all three stay together at root. Rule written into `ARCHITECTURE.md` §6 and cross-linked from `.test_harnesses/README.md`, which is where someone about to drop a new file will actually look.
- FOUND A SECOND, OLDER DEFECT WHILE IN THE FILE REFERENCE: `ARCHITECTURE.md`'s dependency graph still had an `optimizer_history.js` node with a "fetch on expand" edge. That file was deleted back in the changelog consolidation; a previous pass corrected two prose references and missed the diagram. Node, edge, and its `classDef` entry all removed. `FILE_DIRECTORY.md:11` still listed it too, and its `retirement_optimizer.html` row was missing `optimizer_tests.js` and `doclinks.js`, both of which the page does load.
- Nine rows added to `ARCHITECTURE.md` §6 (the three `sweep_golden.*`, `taxPaymentPlanner.js` + its test, `RetirementTaxPlanner.html`, `optimizer_styles_responsive.css`, `optimizer_changelog.md`, `.test_harnesses/`); `sweep_golden.js` and `doclinks.test.js` added to the graph's node subgraph. Six added to `FILE_DIRECTORY.md`, plus a new **Docs** section for `README.md` / `ARCHITECTURE.md` / `optimizer_changelog.md` — none of the three was listed anywhere in the repo's own file index.
- P35 PR 3b: Medicare eligibility was a literal `65` in ten places across `optimizer_core.js`, `optimizer_ui.js`, and `Retirement_Projection.html`. PR 3c has to ask the same question an eleventh time, which is the reason this goes first. Now `TAXData.IRMAA.ELIGIBILITY_AGE`.
- THE TRAP I DELIBERATELY DID NOT WALK INTO: the federal standard-deduction age bump (`TAXData.FEDERAL.*.age`), Georgia's `ageGate`, Maryland's `ageGate` and Virginia's are all **also** 65 and are all a different statute. Pointing them at the Medicare constant would look like tidying and would silently couple unrelated law. Left alone, documented at the constant, and pinned by a test so a future edit cannot "fix" one by aliasing the other.
- THE TESTS MOVE THE CONSTANT RATHER THAN ASSERTING IT: `=== 65` passes against a hardcoded literal and proves nothing. Each test sets `ELIGIBILITY_AGE` to 67/70/80/95 inside a `try/finally` and asserts the behavior followed, with a final test that the constant was restored — a leaked value would otherwise silently change every later scenario in the file instead of failing. Mutation-checked by putting the literals back: exactly the 3 behavioral tests fail, the 2 pins stay green. node 180 -> 185.
- BYTE-IDENTITY PROVEN, NOT ASSERTED. 144 scenarios — 4 states x 3 birth years (ages 74 / 63 / 60 at start) x 6 strategy arms x single/couple, 25 years each — run against the `HEAD` engine and the working tree in separate node processes and JSON-compared: 9,120,262 bytes each, zero diff. The age-63 fixture is deliberate; it sits exactly on the `ELIGIBILITY_AGE + LOOKBACK` boundary that the IRMAA-tier ceiling turns on.
- Four user-facing strings stated the age in prose (three Annual Details tooltips and the both-on-Medicare ACA warning). They now interpolate the constant, so the copy cannot drift from the gate that charges the money. Verified live rather than by reading: at `ELIGIBILITY_AGE = 80` a 71/70 couple loses the warning entirely and an 85/84 couple gains one reading "(age 80+)"; the tooltips re-render at 67.
- `Retirement_Projection.html` keeps its own copy of the gate. Verified through its real `project()` output on a high-MAGI scenario, not by inspection: IRMAA is charged in 29 years at 65, 11 at 95, and 29 again on restore.
- VERIFIED: node optimizer_core 185/185, taxPaymentPlanner 32/32, doclinks 22/22. Browser on localhost:8770 — in-page suite 242/242, console at the known 4-fixture baseline, all three `?v=` tokens confirmed `111448` in the live DOM, and `Retirement_Projection.html` / `standalone/IncomeTaxPlanner.html` / `standalone/irmaa_and_rmds.html` all load clean on the new engine.
- No title bump and no changelog entry, following PR 1+2: output is provably identical, so there is nothing to tell a user. Found in passing: `standalone/IncomeTaxPlanner.html` was pinned at `optimizer_core.js?v=1111f3`, many versions stale, and is now current.
- Port note: 8767 from `launch.json` was held by a python process that answered nothing (`curl` returned `000`), so a second config on 8770 was added rather than killing someone else's server. `.claude/` is gitignored, so that config is worktree-local.

## Session: 2026-08-04 (worktree readme-review-updates-c9df11, branch worktrees/planning-with-files-1492fc) — context restore, plan reconciled with merged PRs

- `/plan` invoked on an existing plan, so this was a restore, not an init. All three planning files
  already live in `.planning/retirement-optimizer/`; `.active_plan` = `retirement-optimizer`.
- RECONCILED THE PLAN AGAINST GIT AND GITHUB rather than trusting the file: `main` = `494ed43`, the
  merge of [PR #149](https://github.com/nightskyguy/retirement_assets/pull/149) (P35 PR 3b + the doc
  file-reference gaps). The plan header still read "PR 3b built here (uncommitted)". Fixed in four
  places — header, the PR 3a-3d table row, the PR 3b status line, and the P35 checklist.
- The duplicate PR #148 is CLOSED (verified via `gh`, not assumed), so the standing "close it rather
  than merging both" instruction is discharged. `gh pr list --state open` returns nothing: no open PRs.
- Working tree clean; branch is level with `main` (0 ahead, 0 behind).
- `session-catchup.py` ran clean with no unsynced context to report (exit 0, no output).
- NEXT REVIEW POINT: **P35 PR 3c** — the ACA cap lapses at Medicare age and falls back to Proportional
  0% rather than releasing outright. Unblocked by 3a and 3b, both merged.


## Session: 2026-08-05 (worktree readme-review-updates-c9df11, branch worktrees/planning-with-files-1492fc) — P35 PR 3c, the ACA cap that never ended

- PREDICTED BEFORE MEASURING, because the plan required it, and it paid for itself twice: **two of
  the four predictions were wrong** and both are recorded in `findings.md` rather than quietly
  fixed. (1) "shortfall -> ~0" — no, $304,331, because Proportional 0% has that shortfall of its own
  on the fixture, identically on `HEAD`. (2) "final net worth up" — no, DOWN $1,888,543 -> $684,010,
  and down is CORRECT: the old behavior looked $1.2M richer because it refused to fund the spend
  goal. Terminal wealth ranks starvation as success; the honest directions are funded **spend**
  ($3,832,599 -> $4,263,278) and **breach years** (24 -> 0).
- THE FIXTURE WAS INSIDE THE DEFECT. `CAP_BASE` is 66 and 67 in year 0, so the one `strict ACA` test
  in the suite was asserting the behavior of a cap enforced from 66 to 96 — it passed *because* of
  the bug. Retargeted to a new `ACA_LIVE` (birth years moved under eligibility, nothing else), and a
  separate test now pins the lapse at the original ages.
- A SECOND SITE NEEDED THE GATE AND WAS NOT IN THE PLAN. `beginYear`'s `_stratImpliesConversion`
  named `'aca'` literally, so a lapsed plan still took January ("conversion year") withdrawal timing
  while its Proportional twin took December — 34 log columns diverged in year 0. Found ONLY because
  the equivalence test compares the whole log; a totals-only test would have shipped the wrong
  withdrawal month. Gate extracted to a shared pure `acaCapLapsed()`.
- THE TRAP I DID NOT WALK INTO: putting the age test inside `computeBracketCeiling` next to the IRMAA
  one. It cannot degrade in place — every ACA row carries `stratRate: 0`, so falling through to the
  federal branch returns the **10% bracket, tighter than the cap it lifted**. The successor to a
  lapsed cap is "no ceiling strategy at all", which only a caller can express. Documented at the
  branch so the next caller does not re-enforce it.
- NO LOOKBACK, ON PURPOSE. The IRMAA gates use `ELIGIBILITY_AGE + LOOKBACK` because IRMAA charges
  this year's premium against MAGI from two years ago. ACA eligibility is a current-year test. Same
  constant, different gate, and they now say so in place.
- `acaBreach` had been passed into `buildSimYearLogRecord` since the strict-ACA strategy shipped and
  never emitted — a breach year was only ever visible as a total. Now `'-acaBreach'` (leading `-` =
  no table column). Verified live: 87 headers, none leaked.
- `_isACAUntenable` narrowed from `eitherOnMedicareAtStart` to `bothOnMedicareAtStart`. The either-
  case is now measured through `acaBreachYears` instead of assumed, which stops a 66/62 couple's four
  real ACA years being erased on day one. `eitherOnMedicareAtStart` is dead in production as a
  result; left in place deliberately — it is half of PR 3b's constant-mobility pin from one PR ago,
  and deleting it is a byte-neutral PR of its own, not a rider on a behavior change.
- BOTH GATES MUTATION-CHECKED IN ISOLATION (the first attempt botched the restore and ran with both
  mutations applied, which proved nothing — redone one at a time): reverting `isACAStrategy` fails
  exactly the 4 lapse tests; reverting only the `beginYear` timing gate fails exactly the equivalence
  test.
- SCOPE PROVEN BY MEASUREMENT, NOT BY READING THE DIFF: `propwd` 0% and `bracket` 22% controls run
  against the `HEAD` engine and the working tree in separate processes are byte-identical. Only `aca`
  arms move. The lapsed arm equals the `propwd` control to the dollar on all four metrics.
- VERIFIED: node optimizer_core 189/189 (was 185), taxPaymentPlanner 32/32, doclinks 22/22. Browser
  on localhost:8771 — in-page suite 242/242, console at the known 4-fixture baseline, title/version
  stat/amber BEHAVIOR CHANGE banner all `11.1462`, `standalone/IncomeTaxPlanner.html` clean on the
  new core. Live data-drivenness: at `ELIGIBILITY_AGE = 80` a 66/59 couple loses the ACA warning
  entirely and an 86/87 couple gains one reading "(age 80+)"; the engine's breach count and terminal
  wealth return to the `HEAD` numbers.
- `?v=` bumped to `111462` on `optimizer_core.js` and `optimizer_ui.js` only, in both pages that load
  them. `taxengine.js` did not change this time and stays at `111448`.
- FOUND, NOT FIXED, NOT CAUSED HERE: Proportional 0% strands $304,331 on `CAP_BASE` with $894k still
  in the IRA and reports `success: false`. Byte-identical on `HEAD`. It only became visible because
  the lapsed ACA arm now inherits it.
- Port note: 8767 from `launch.json` was again held by a python process answering nothing
  (`curl` -> `000`), so a second config on 8771 was added rather than killing someone else's server.


## Session: 2026-08-05 (cont.) — `eitherOnMedicareAtStart` deleted, the follow-up PR 3c refused to carry

- Dead in production the moment PR 3c narrowed `_isACAUntenable` to `bothOnMedicareAtStart`. Grep
  first, delete second: zero production call sites, only the definition, the `module.exports` entry
  and two comments.
- THE PART THAT WAS NOT MECHANICAL. Two surviving tests referenced the deleted twin, and both used
  it the same way — as the OR side of an AND-vs-OR contrast. Deleting the reference would have left
  `bothOnMedicareAtStart` with no test that fails if it silently becomes an OR, which is the exact
  regression the twin made visible. Each now asserts the one-of-two case (66/68 against a moved
  `ELIGIBILITY_AGE = 67`) directly. PR 3b's move-the-constant pin survives, retargeted to one helper.
- The surviving helper's header comment now records why the twin is gone and says not to bring it
  back: the either-case is MEASURED through `totals.acaBreachYears`, which is strictly better
  evidence than a predicate applied on day one.
- BYTE-IDENTITY PROVEN RATHER THAN ARGUED, even though the change is a deletion of unreachable code:
  528 scenarios (8 states x 3 age configs x 11 strategy arms x single/couple, 20 years each) run
  against `HEAD` and the working tree in separate node processes — **34,057,133 bytes each, identical
  SHA-256**. `buildVariations` 144 rows and `buildStrategyFamilies` 192 rows identical. Export
  surface differs by exactly one key, the deleted one.
- NO `?v=` BUMP, and the reason is the version scheme rather than laziness: the minor is
  `hex(dayOfYear*24 + hour)` and the clock is still inside the hour that produced 11.1462, so this
  IS that build. A stale cache is harmless here in a way it was not for PR 3b, because the output is
  proven identical rather than expected to be. No title bump, no changelog entry.
- VERIFIED: node optimizer_core 188/188 (189 minus the deleted OR-semantics test), taxPaymentPlanner
  32/32, doclinks 22/22. Browser on localhost:8771 — in-page suite 242/242, console at the known
  4-fixture baseline, `eitherOnMedicareAtStart` confirmed absent from global scope,
  `bothOnMedicareAtStart` still resolves and still returns false for a 66/68 couple at
  `ELIGIBILITY_AGE = 67`, and a live sweep enumerates 192 rows with all 16 ACA arms present.

- SHIPPED as [PR #150](https://github.com/nightskyguy/retirement_assets/pull/150), two commits kept
  separate at the user's request: the behavior change, then the deletion it made possible. The
  intermediate `docs(plan): name the real PR 3c commit hash` commit was squashed away and the
  self-referential hash removed from the plan file entirely — it had already gone stale twice (once
  from an amend, once from this rewrite). PR number is the stable reference; hashes are not.
- Both commits verified INDEPENDENTLY green so a bisect lands on a working tree either way: commit 1
  node 189/189, commit 2 node 188/188. Code tree after the rewrite diffed against the pre-rewrite
  branch: empty outside `.planning/`.

## Session: 2026-08-05 (cont.) — user bug report on the ACA age gate: three findings, only one of them the reported one (v11.1464)

- REPORTED: ACA options stay disabled after changing birth years; suspected the gate is evaluated
  only at load. DISPROVEN by driving real input events across 9 transitions — `startAge`,
  `birthyear1` and `birthyear2` all re-run the gate live. `birthyear1` was isolated deliberately
  (hold the other two so only it moves the verdict) because the first attempt changed it without
  flipping the outcome, which proves nothing.
- THE REAL CAUSE was `startAge`, still at its default 65 in the reported URL: person 1 starts
  retirement AT Medicare age whatever their birth year, and the spouse is 79 in the 2031 start year.
  Correct behavior, invisible reasoning.
- AND THE REASON IT LOOKED BROKEN is a two-age-bases collision on one screen. `#age-display-1/2`
  show ages TODAY and never move when Retirement Start Age changes (verified by moving startAge
  65 -> 55 and watching them sit still); the gate is about ages at retirement START. The page showed
  59/73 and the warning talked about 65/79 without naming a year. Warning now names the start year
  and both ages in it, and says which field to change.
- THE ⚠️ THE USER WAS LOOKING AT WAS A STRING LITERAL. `{ pct: 400, label: 'ACA 400% FPL ⚠️' }` —
  only that entry, computed from nothing, so it fired even when 400% was the only feasible arm and
  stayed silent on a 200% cap that could fund nothing. PF13 saw it ("not just the hardcoded 400%
  label") and worked around it in the results table rather than removing it. Removed now.
- THE FLAG THAT IS COMPUTED WAS CHECKED, NOT ASSUMED: 1008 scenarios, zero cases where a looser cap
  is flagged while a tighter one is clean. Every partial set is downward-closed and a lone flag is
  always 200%. Pinned by a new test. Getting that test to reach the partial case needed Social
  Security in the sweep — `CAP_BASE`'s $72k of benefits already exceeds the 300% cap alone, so every
  arm breaches on unavoidable income and the middle never appears.
- ACA UN-GATED from the nerdknob: dropdown options, the sweep family, and the documentation
  paragraph (its inline `display:none` removed from the markup rather than switched off in JS, so it
  survives even if the bootstrap does not run). Golden safety CHECKED BEFORE the gate came out: of
  the four captures only `default` was recorded with the nerdknob off, and its base has both people
  on Medicare, so its ACA rows were suppressed by age anyway. All four still reproduce.
- ONE OF MY OWN TESTS FAILED FOR A GOOD REASON: the in-page "four ACA options offered" assertion
  failed while a live DOM read showed all four. `runTests?.()` is called at top level in
  `retirement_optimizer.html` and runs BEFORE the `DOMContentLoaded` handler that builds the
  dropdown — the test was asserting on bootstrap timing, not on the builder. It now calls
  `refreshStratRateOptions()` itself.
- VERIFIED: node optimizer_core 189/189, taxPaymentPlanner 32/32, doclinks 22/22. Browser on
  localhost:8771 WITHOUT `?nerdknob` (the state that used to hide everything) — in-page suite
  245/245, console at the known 4-fixture baseline, all four ACA options present and none carrying a
  triangle, doc paragraph visible, sweep enumerates 16 ACA rows where it previously enumerated zero,
  and all five warning branches read correctly including the singular/plural verb agreement.
- v11.1464, changelog entry added and the sixth-oldest dropped. `?v=` bumped on `optimizer_ui.js`,
  `optimizer_core.js` and `optimizer_tests.js`; `optimizer_tests.js` had been stale at `1111f3`.


## 2026-08-05 (later) — P38 PR 1 + PR 2: the funding backstop

- **PR 1 `e8d28d6`, tests only, no version bump.** Pinned the funding invariant as a
  characterization recording before fixing anything, the same pattern `sweep_golden.js` uses, so the
  fix lands as a diff on existing lines rather than as a test appearing from nowhere. 189 -> 205.
- **THE DIAGNOSIS ASSUMED ONE DEFECT; PROBING ALL 12 ARMS FOUND THREE.** Writing the invariant as
  "no shortfall while ANY account has a balance" would have left it permanently red for reasons P38
  is not allowed to fix:
  - P38 (IRA still funded) - the six arms the fix targets.
  - **P32 (IRA empty, Brokerage funded) - `minlimit` only, and worse than recorded: nine
    consecutive years, $71,382, first one with $945,376 of Brokerage sitting there.** Its IRA is
    already at zero, so widening the gate cannot touch it. Own tripwire, pinned to the dollar.
  - **Convergence - `ordered` strands $73 while holding $58,597 of Cash** (RIBC puts Cash last; the
    third pass funds the gap, recomputes tax, and nothing loops back for the tax that recompute just
    created). Tagged and left alone; `ordered` is deliberately out of the backstop.
- **PR 2 `f592c31`, v11.1468, behavior change.** Gate went to
  `!yr.isACAStrategy && !yr.isOrderedStrategy`. All six pins to 0. propwd 0%: shortfall -304,331 ->
  0, spend +304,330, finalNW 684,010 -> 202,859, forcedIRA 0 -> 395,109.
- **THE PLAN PREDICTED THREE PINNED-NUMBER TESTS WOULD BREAK AND ALL THREE ARE BYTE-IDENTICAL.**
  The GK totals at `:444` and `OC_BASE` at `:1138`/`:1422` never reach the backstop because their
  fixtures are well funded. Measuring beat predicting; no re-derivation was needed.
- **Two tests DID move, and both were stale fixtures rather than engine faults.** `avgWdRate`'s
  4-15% band only ever held because the engine under-withdrew - `BASE` has $850k against $1.2M of
  spending and now depletes fully, so the mean is ~22.9%. `CREEP_BASE` ($1.45M against $1.8M) now
  ends at zero, so `optimizeSpend` correctly returns null at its baseline gate and the creep tests,
  none of which are about solvency, needed a solvent fixture.
- **ACA came out exactly as specified.** Live cap: 7 years, ForcedIRA 0 in every one, all 7 flagged.
  Lapse 2033: 21 funded years. 2054-2057: honest ruin. Two whole-log assertions were silently
  mixing live and lapsed years and are now scoped via `_capLiveRows`; a new test pins the lapsed
  tail so the post-lapse decision is asserted, not merely permitted.
- **WATCH THIS ONE: `aca live 400%` total spend DROPS $144,193.** Fully funding the 21 lapsed years
  burns the IRA out by 2054, where the old code limped along partially funded for 25. Greedy
  year-by-year funding is the engine's existing contract and `bracket` has always behaved this way,
  but it is a real user-visible number moving in the unintuitive direction.
- `BracketOverage` verified 0 across all 13 forced-IRA years in node AND in the browser, so
  `forcedIRA` is reused with no new counter. `fixedpct` was already precedent.
- Docs: ForcedIRA tooltip dropped "ABOVE the bracket/IRMAA ceiling" (meaningless where there is no
  ceiling); Proportional / Reduce / IRA Draw % gap-fill chains gained their IRA tail; the Annual
  Details bullet un-scoped from the Fill Bracket / IRMAA family.
- Changelog states the ACA exclusion as intended behavior in the BODY, per explicit user direction:
  a reader who still sees a shortfall on ACA Cliff must not read their own correct result as a bug.
- Verified: node 206/32/22, in-page 245/245 without `?nerdknob`, served engine reproduces node to
  the dollar, `sweep_golden.gen.js` content byte-identical.
- GOTCHA: `sweep_golden.gen.js` rewrites the file with LF, so it always shows as modified on Windows
  even when the content is unchanged. Check with `git diff --ignore-cr-at-eol` before believing it.
- GOTCHA: `orderedSeq` accepts only `CBIR` / `RIBC` / `BIRC`. Anything else silently falls back to
  CBIR, so two "different" ordered arms can produce identical output and look like a bug.

## Session: 2026-08-06 (worktree context-ab498f, branch worktrees/planning-with-files-f85b48) — context restore, plan reconciled with three merged PRs

Planning files were **stale against git**: `task_plan.md` still read "As of 2026-08-05, evening" with
P38 PR 3 described as an unmerged branch and P32 marked "not started", while `main` had moved to
`10f6f2a` with three PRs merged on top. `progress.md` had no 2026-08-06 entry at all. `findings.md`
was the only file current, and even it had no record of the OBBBA fix. No code touched this session.

**Reconciled from `git log`, not from memory:**

- **PR #153** — P38 PR 3, size the primary draw net of tax on guaranteed income (`018baa9`,
  v11.146a). P38 is now COMPLETE end to end.
- **PR #155** — P32 PR 1, third-pass state tax.
- **PR #156** — P32 PR 2, brokerage research (`52be831`) plus two engine correctness fixes and the
  changelog consolidation.

**Two shipped fixes had no plan section between them.** The dividend/interest double-credit
(`e9a3c8b`, v11.146f) was recorded in `findings.md` but its consequences never propagated to P32's
status; the OBBBA gate fix (`c9e356a`) was recorded **nowhere** — it arrived out of band, from
verifying a user report about low federal tax on an Alaska plan. Both are the same failure mode: a
tax/accounting function unit-tested directly while its *use* went untested. Written up in
`findings.md` as "Two OBBBA provisions were implemented, tested, and never switched on".

**P32's own instruction is what earned the phase.** It mandated auditing the two accounting facts
*before* running any behavior arm; that audit found the double-credit and refuted the phase premise
(Q1: zero rows never draw Brokerage; baseline touches it in 90.4% of years). Q2 was moot before the
fix and is now unblocked — but Q1's percentages were measured on the double-crediting engine and
should be re-run before anything is concluded from them.

**Files updated:** `task_plan.md` (header rewritten to 2026-08-06 state, duplicated P35 paragraph
removed, P32 status and task checkboxes reconciled), `findings.md` (OBBBA section added),
`progress.md` (this entry).

**Open queue after the sync:** P32 Q2-Q5 + build tail; P39 (node-only tests invisible in the
browser, not started, pre-commit hook is the cheap first slice); P36; the long P1-P28 backlog.

## 2026-08-06 (cont.) — P39 work item 1: the pre-commit gate

User picked P39 off the reconciled queue, scoped to **work item 1 only, then review**, and chose the
committed-hooks-directory mechanism. The mechanism had to change; the intent did not.

**Files:** `.githooks/pre-commit` (the logic), `.githooks/install` (one-time, per clone),
`.githooks/README.md`, `.gitattributes` (new file), plus `ARCHITECTURE.md` and
`.planning/FILE_DIRECTORY.md`. **No product code touched, so no version bump and no changelog
entry** — same precedent as P35 PR 1 + PR 2.

**The plan's two premises about hooks were both false, and checking beat assuming:**

1. "The repo has no hook convention yet." It has one. `core.hooksPath` is pinned to the absolute
   path `...\.git\hooks` in `.git/config` **and**, because `extensions.worktreeConfig` is on, again
   in each of the three worktrees' `config.worktree` — which outranks the repo config. The planned
   `git config core.hooksPath .githooks` would have been **silently ignored in every worktree**.
   It would have looked installed and done nothing, which is the exact defect class P39 exists to
   remove. Fixed by writing a delegating shim at the already-pinned path: one install, and it covers
   the main checkout plus every present and future worktree, because the worktree tooling writes the
   same absolute pin each time.
2. Unstated but load-bearing: `core.autocrlf` is true system-wide and the repo had **no**
   `.gitattributes`. A fresh clone would have checked the hook out with CRLF, and `sh` cannot run a
   shebang ending in CR. Added `.gitattributes` with `.githooks/** text eol=lf` only — deliberately
   **not** `* text=auto`, which would renormalise every tracked file in one unmeasured sweep.

**Beyond spec:** the hook blocks on a *missing* suite as well as a failing one. A renamed or deleted
suite would otherwise print nothing and read as green.

**Count drift caught on pickup:** the phase's measured table says `optimizer_core.test.js` has 206
tests; OBBBA and the dividend fix added 8, so it is **214**. Recorded in the phase. The staleness
guard (work item 5) must measure its expected count, never copy that table.

**Verification, each a separate run:** green tree exit 0, 214/32/22 in ~3.5 s; genuine failed
assertion blocks (exit 1, names the suite); crashing suite blocks; missing suite blocks with its own
message; `git commit` really fires the hook — proved with an empty commit message, which aborts
*after* pre-commit runs, so nothing was committed; `rm` + `git checkout` round-trips the hook with
zero CR bytes.

**Still open in P39:** items 2-6 (slow tags, dual-mode port, idle runner + three-state badge,
staleness guard, `?runtests=all`). The hook is the guarantee; those restore confidence in the badge.

## 2026-08-06 (cont.) — P40 costing, and nine doc defects fixed

User proposed two repo-wide changes before P39 continued: a test naming convention (`XXXX.tests.js`)
and a `tests/` or `.tests/` subfolder. Costed against a 189-occurrence / 25-file reference inventory
and against `d0f4a00`, this repo's own last rename (11 files, 20 insertions, 18 deletions).

**Three findings decided the shape of the answer, all measured:**

1. **`.tests/` is disqualified, and not for the obvious reason.** Jekyll skips dot-directories and
   `.nojekyll` is forbidden here — but the decisive fact is that `python -m http.server` and
   `file://` **both serve dot-directories**, so `.tests/` passes every pre-merge check and fails only
   in production. What then breaks is silent, not loud: `runTests?.()` at
   `retirement_optimizer.html:1136` throws `ReferenceError` on an *undeclared* identifier, killing
   `runSimulation?.()` at `:1138`.
2. **`node optimizer_tests.js` exits 0 having run nothing** — 2197 lines, `function runTests()` at
   `:3`, never called, no `module.exports`. The hook prints `ok` for anything exiting 0, so any glob
   that swallows the release gate manufactures a permanent false green. `*.tests.js` is safe only
   because `_tests.js` does not match it.
3. **The cheap win was never the rename.** Proposal 1's real intent is a *completeness* check —
   assert the on-disk suite set equals the hook's list — which catches a newly added suite being
   omitted. A naming rule catches nothing; there is no CI here at all (no `.github/`, no
   `package.json`), so "enforcement" means one opt-in, `--no-verify`-bypassable hook.

**User decisions:** rename the three node suites only (`optimizer_tests.js` untouched); defer the
`tests/` move until after P39 items 2-6; reject `.tests/` permanently. Recorded as **Phase P40**.

**PR 1 committed** (`5f98207`): the P39 hook, `.gitattributes`, docs. Hook fired on its own commit.

**PR 2, this commit — nine doc defects, all verified against source, zero runtime risk:**
`FILE_DIRECTORY.md:68` called the release gate "Older/legacy" · `ARCHITECTURE.md:292` and the mermaid
label at `:52` both claimed `vm.runInContext` **and** "no DOM stubs" (0 hits for `vm`; `window` and
`document` are stubbed at `:23-25`) · `ARCHITECTURE.md:310` cited `:67` for a require at `:66` ·
the "`doclinks.test.js` reads files from disk" claim was **false** in three places and was P39 item
3's stated reason for excluding it · "5 requires" was 4 (the 5th grep hit is a comment at `:18`) ·
"260 tests" was 268 · two open phases (P6, P23) still instructed work in
`retirement_optimizer_core.test.js`, renamed away in `d0f4a00`, and P23 also referenced a "vm test
context" that has not existed since `86e26fa`.

**Deliberately NOT fixed:** the same stale filenames at `task_plan.md:938` and `:1052`. Those sit in
**shipped** phase records (PF5 v11.11dc, PF v11.11c1) where the names were correct when written —
rewriting them would falsify the record. Only live, forward-looking instructions were corrected.
Mechanical name churn across the remaining ~80 `.planning/` mentions stays out of scope.

## 2026-08-06 (cont.) — PR 3: the three node suites renamed to `.tests.js`

`optimizer_core.test.js` -> `optimizer_core.tests.js`, `taxPaymentPlanner.test.js` ->
`taxPaymentPlanner.tests.js`, `doclinks.test.js` -> `doclinks.tests.js`, per the user's P40 decision.
`optimizer_tests.js` deliberately untouched. `git mv` throughout; git scored all three R100.

**The requires did not move.** They point at *source* files (`taxengine.js`, `optimizer_core.js`,
`displayhelpers.js`, `sweep_golden.js`, `doclinks.js`, `taxPaymentPlanner.js`), none of which were
renamed. The plan had flagged the six `./` requires as an edit site for the *move*, not the rename;
for a rename they are inert. The `sweep_golden` marker strings are likewise untouched, since only a
rename of the *generators* would break those.

**One browser fetch:** `RetirementTaxPlanner.html:1083`, plus the two UI strings at `:1081`/`:1094`.
`?v=13c3` left as-is on purpose: the token busts a cached copy of the *same* URL, and the URL just
changed, so there is no stale entry under the new name. Bumping it would buy nothing and would imply
a release that did not happen.

**Three more instances of the PR 2 `vm.runInContext` defect surfaced during the sweep** and are
fixed here: the two mermaid edge labels `CORETEST -->|vm.runInContext|` and the prose "Node via
`vm.runInContext`" in the module-contract paragraph. PR 2 caught the table row and the node label
but not these.

**`.planning/` rule, unchanged from PR 2:** live forward-looking instructions updated (the whole P39
and P40 sections, 14 occurrences); the 28 occurrences in shipped phase records left alone, because
the names were correct when written. `optimizer_changelog.md` never referenced these files at all.

Verified: all three suites green by their new names (214/32/22), the hook green with the updated
`suites=` list, and zero old-name references anywhere outside dated `.planning` records.
Nothing user-visible, so no version bump and no changelog entry.

## 2026-08-06 (cont.) — PR 4: the hook now catches an UNLISTED suite

Proposal 1's real intent, extracted. A naming convention catches nothing on its own; what actually
prevents a suite from being silently skipped is asserting that the set of `*.tests.js` files on disk
equals the `suites=` list. ~20 lines including the comment that keeps it safe.

**The comment is the load-bearing part.** The glob must never widen to `*test*`. `optimizer_tests.js`
declares `runTests()` and never calls it, so `node optimizer_tests.js` exits 0 having run nothing,
and the hook reports success for anything exiting 0 — sweeping the release gate in would print a
permanent green for zero tests run. `_tests.js` not matching `*.tests.js` is exactly why that suffix
was safe to adopt.

**Interaction found while testing, and made explicit rather than left dead:** the completeness check
runs before the missing-suite check, so a deleted or renamed suite now trips the new message
("list is out of date", with both sets printed) rather than the old one. The old check survives as a
backstop for the single case the new one cannot see — a suite listed in `suites=` whose name does
not end in `.tests.js`. Its comment now says so.

Verified as separate runs: green passes (214/32/22); an unlisted `sneaky.tests.js` blocks with both
sets printed, exit 1; a deleted suite blocks; and the glob provably matches only the three suites,
never `optimizer_tests.js`.

## 2026-08-06 (cont.) — P39 items 2-6 COMPLETE, plus critical-guard marking

All five remaining items landed as separate commits on `p39-pr4-hook-completeness`, in
[PR #157](https://github.com/nightskyguy/retirement_assets/pull/157). Version **v11.147c**; changelog
entry deliberately one paragraph, per user direction that improving the self-tests is not a
user-facing feature.

**Item 2 (`4d76d51`) - slow tags.** `test.slow()` records the name; node runs everything
regardless. Re-measured rather than trusting the 08-05 figure: **211 tests in 818 ms without the
three, 214 in 2797 ms with** - they cost 1979 ms, 71% of the suite. The tiering premise holds.

**Item 3 (`bc2e063`) - dual mode.** Three things the plan called "mechanical" were not, and each
would have failed *silently*:
1. The node stubs were hostile to a real page - `document.getElementById` returning null, a
   `performance.now()` frozen at 0, installed unguarded at load. Now behind `IS_NODE`.
2. **Half the engine is invisible to a global lookup.** `function simulate` lands on globalThis;
   `const MC_GRIDS` / `OPTIMIZER_GRIDS` / `RMD_TABLE` do not. Verified live:
   `typeof globalThis.MC_GRIDS === 'undefined'`. Hence explicit `window.TaxEngine` /
   `OptimizerCore` / `SweepGolden` namespaces mirroring the existing `module.exports`.
3. **The engine records wall clock into its own output** (`optimizer_core.js:928` `yr.loopStart`,
   `:2381` loopMs, `:1739` totals.thirdPassTime) and several tests assert byte-identical logs.
   **Six tests failed in the browser while passing in node**, all on the clock. The runner now
   stubs `performance.now` for the duration of the run and restores it in a `finally`.

**Item 4 (`4983e7a`) - after-paint runner + three-state badge.** Measured, not asserted:
`loadEventEnd` 760 ms, tier-2 requests start 3661-3988 ms. Badge is ⏳ / 🟢 / 🟢⚠ / ❌. Opt-in via
`window.TIER2_PENDING` so `standalone/IncomeTaxPlanner.html`, which also loads `optimizer_tests.js`,
keeps its old two-state badge instead of hanging on an hourglass.

**Critical guards (`dedc944`) - user request.** `test.critical()` marks the ten guards for defects
that actually shipped, inline as `✓ ★ CRITICAL <name>` plus a dedicated end-of-run block. Two
families: the three dividend/interest conservation tests, and seven state-tax tests (IL/PA
exemption, third-pass exclusion, the two *complement* tests that fail if a fix over-applies the
exemption, and the two no-income-tax-state tests). Badge tooltip reports the guard count separately
from the bulk count.

**Item 6 (`e4949a4`) - `?runtests`.** Bare or `=all` runs everything synchronously (513 = 245 + 268);
`=fast` skips the slow three. Matches RetirementTaxPlanner's existing bare `?runtests`.

**Item 5 (`238f5ef`) - staleness guard.** `TestTiers.EXPECTED` pins 214/32/22 + 3 slow. Catches a
suite growing, an unregistered suite, a suite that failed to load, and slow-tag drift. Verified end
to end, not by poking the function: a real test appended to `doclinks.tests.js` turned the live badge
red with "doclinks: 23 tests on disk, 22 expected"; removing it returned 🟢 510.

**GOTCHA worth keeping:** during verification the page kept loading `taxengine.js?v=111448` from
cache while the file on disk had the new namespace, producing "Cannot read properties of undefined
(reading 'calculateTaxes')" a long way from the cause. Cache tokens must move with any engine file
the test tier depends on. Stale *HTML* is the harder half - a warm tab keeps requesting the old
token regardless.

---

## Session 2026-08-07 — plan resync, no code change

Invoked `/plan` in worktree `readme-review-updates-c9df11` (branch
`worktrees/planning-with-files-e27396`). Planning files were already present and committed; nothing
to initialize. Chosen scope: resync the planning files to `main`, add no new phase.

**What was stale.** The `As of` header pinned `main` = `10f6f2a` / v11.1478 / 2026-08-06 midday.
`main` is `28a3395` / v11.147c, **18 commits ahead**, and `progress.md` stopped mid-P39.

**Folded in.**

1. **P39 COMPLETE**, items 2-6 plus [PR #157](https://github.com/nightskyguy/retirement_assets/pull/157)
   (hook completeness). The narrative for items 2-6 was already the tail of this file; the header
   just never learned they had merged.
2. **P40 half done.** `db363ba` renamed the three suites. The `tests/` move was deferred *until
   after P39 items 2-6* — that condition is now satisfied, so it is **unblocked, not blocked**, and
   the phase heading and Decisions block now say so. Recorded one new cost the original costing did
   not have: the suites are now `<script>`-loaded, so the move has to carry `?v=` cache tokens too.
3. **[PR #158](https://github.com/nightskyguy/retirement_assets/pull/158)** — no basis step-up at
   death, documented in README **Limitations and Restrictions** plus a cross-reference from the DRIP
   basis FAQ (`99fc632`, `8d47e3e`). Docs only; the README states the code fix is planned.
4. **ARCHITECTURE.md** corrected twice: `a03d353` (nine measured defects) and `f9352a5` (the
   "node suites never run in the browser" claim, which items 3-6 made false).

**Verified rather than assumed:** test counts are unchanged at 214/32/22, read from
`TestTiers.EXPECTED` (`optimizer_tests.js:2220`), not from the older header line; version read from
`<title>` (`retirement_optimizer.html:22`) and confirmed against the changelog's top entry `11.147c`.

**Open, unchanged:** P40 `tests/` move (decision), P32 second half, P29-P34 punch-list, P35/P36
Phased strategy, P37 deferred, and the P1-P28 backlog.


---

## Session 2026-08-07 (later) — task_plan.md restructured

User asked for three things: archive everything fully complete, make the naming consistent and
unique, add a **User Priority** column. Decisions taken with the user first: bodies go to
`.planning/task_completed.md` with a one-line stub here; P35 keeps `PR n` as an alias alongside its
new IDs; legacy letter phases fold into the P-series; priority is buckets P0/P1/P2/P3.

**Size.** `task_plan.md` 3,220 -> 2,062 lines. 83 `##` sections -> 42. `task_completed.md` 174 ->
1,430 lines.

**Naming.** Four schemes collapsed to one. Every open item now carries `<phase><letter>`, assigned in
document order. `PA`-`PE` -> `P41`-`P45`, `TPP-1..5` -> `P46`, README Caveats Audit -> `P48`. An ID
migration table sits at the top of `task_plan.md`; the old names are still cited by merged PR bodies
and by `findings.md`, so nothing was renamed without an alias.

**Duplicates removed.** The double `PR 4` in P35 was a real defect in the checklist — one open (the
`deathBasisStepUp` code) and one closed (the README caveat) sharing a number, which made the phase
read as half-done. They are now `P35g` and `P35h`. Also gone: two `PF11` headings, two `P25`,
`P20` + a stray `Table of Contents`, and the informal `P36a`/`P36b` in the PR 3 replan, which
collided with the new sub-item letters and are now "P36 round 1 / round 2".

**Superseded, not shipped — archived anyway, and this is the judgment call worth checking.** The old
`P3` (Lumpy Spending) says its spec is replaced by `PB`, and the old `P7` (Onboarding Stepper) says
the same of `PD`. Both were archived and their successors kept as `P42` and `P44`. If either old spec
still holds anything the successor does not, it is in `task_completed.md`, not lost.

**Priorities assigned, for the user to edit.** Two P0s: `P35` and `P32`. `P35` because it carries the
brokerage basis step-up (`P35g`), which is a correction rather than a feature — the terminal
valuation taxes heirs on gains §1014 steps up in full, Roth and Cash are unaffected, so the error runs
one way, in favor of Roth conversions, through Break Even and every "Optimize for" ranking. Nothing
measured on top of it is trustworthy until it lands. `P32` because its audit found a real defect and
its own premise was refuted.

**Found while restructuring, not fixed:** `P35f` (`Basis <= Brokerage` invariant) has a one-line
spec and sits in front of `P35g` in the sequence. It needs writing before it can be built, and it is
the only thing between the current state and the step-up.

**Archived sections (bodies in `.planning/task_completed.md`):**

- Phase P38: The baseline/proportional strategies cannot fund their own tax bill (2026-08-05) — COMPLETE
- Phase P39: Make the node-only tests visible in the browser (2026-08-05) — COMPLETE (2026-08-06)
- README Audit Round 3 (2026-07-30) — COMPLETE, committed `838a870`, PR #140 MERGED
- Link labels follow the href (2026-07-30, v11.13d0) — COMPLETE, committed `838a870`, PR #140 MERGED
- Nerdknob graduation: Stop-Year + Tax Creep (2026-07-29, v11.13bd) — COMPLETE, PR #137 MERGED
- PR-E/F/G Round 2: user-testing fixes (2026-07-28, v11.13a1) — COMPLETE
- PR-D ⚖ head-to-head strategy compare (2026-07-27, v11.1391 -> shipped as v11.13a1) — COMPLETE
- PR-C Full Retirement Age from birth year (2026-07-27) — COMPLETE, merged in PR #135 as v11.13a1
- PR-B Social Security claim-year proration + start milestones (2026-07-27) — COMPLETE, merged in PR #135 as v11.13a1
- PR-A MC stress auto-run + Stress Failure tile + dead-code delete (2026-07-27) — COMPLETE, merged in PR #135 as v11.13a1
- PR3 CURRENT PLAN row in the Optimizer + Earliest Break Even winner (2026-07-27, v11.1387) — COMPLETE, merged PR #133 (`5ceda24`)
- PR2 Conversion-schedule representation divergence (2026-07-26, v11.137f) — COMPLETE, merged PR #133 (`a2fb3f8`)
- PR1 Roth Conversion Diagnostics (2026-07-26, v11.1370) — COMPLETE, merged PR #132
- README Audit Round 2 + AiRA Tool Review (2026-07-25): PR #131 — COMPLETE
- Documentation Polish (2026-07-24/25, v11.1340): Post-P2 clarifications, FAQ, changelog refactor, Cash Reserve "Off"
- Phase PF13 (DONE, v11.12ea): Optimizer ranking rework + Annual Details / feasibility fixes
- Phase PF12 (DONE, v11.129d): Accurate IRA-withdrawal accounting + prefer-larger conversion sourcing
- Phase PF11 (DONE, v11.12e5): Optimize Conversions candidate pool — family-diversified, _baselineScore-ranked
- Phase PF11 (SUPERSEDED — original OPEN writeup, kept for context): Optimize Conversions candidate pool — top-5-by-finalNW misses the families that benefit
- Phase PF10: Cash-funded conversions + Maximize Conversions restructuring (v11.1287)
- Phase PF9: GK conversion-sweep stability gate + Break Even diagnostic + orphaned RealReturns gold commit (v11.1271)
- Phase PF8: Round 3 fixes -- optimizer load-strategy gap + Conv Savings doc (v11.1253)
- Phase PF7: Break Even in the Optimizer (Optimize Conversions rows) (v11.1247)
- Phase PF6: Break Even sustained-crossing fix (v11.1240)
- Phase PF5: Break Even rework (dual-sim counterfactual) + small-screen UX (v11.11dc)
- Architecture review findings (2026-07-09) — for P15
- Phase PF4: Changelog consolidation + docs polish (v11.11c8)
- Priority Order (rough)
- Phase PF: UX Polish Batch (v11.11c1)
- Phase PF2: Item 6 round 2 — bar-chart hover still broken + click-to-isolate
- Phase PF3: MC Stress pass should run current strategy only, not all variations
- Phase P1: Suggest After-Tax Spend Goal (was 38#10)
- Phase P2: Cash Reserve — surplus routing + reserve floor (DONE, v11.1340, was 38#9)
- Phase P3: Lumpy Spending (Priority H)
- Phase P7: Onboarding Stepper (was 38#5)
- Phase P15: Structural Refactoring Remainder (was Phase R)
- Phase P20: README Table of Contents
- Table of Contents
- Phase P21: Annual Spending-by-Account View
- Phase P25: Markdown docs render in a browser (2026-07-29, v11.13c5) — COMPLETE, premise was wrong
- Phase P25 (original spec, superseded 2026-07-29) — kept for the reasoning, do not build
- P35 PR 3 replan (2026-08-04) — per-PR write-ups for P35c/P35d/P35e

---

## Session 2026-08-07 (third) — plan reordered for the injection window

User asked whether moving the priority list nearer the top would cost planning efficiency. It does
the opposite, and the numbers are read out of the hook rather than guessed.

**The hook, measured.** `skills/planning-with-files/SKILL.md` frontmatter, plugin cache 2.43.0:
UserPromptSubmit runs `head -50 "$PLAN_FILE"`, PreToolUse runs `head -30 "$PLAN_FILE"`. Line counts,
not character budgets. PreToolUse fires on **every tool call**, so lines 1-30 are the most re-read
text in the whole project.

**What was wrong.** After this morning's restructure the Open Task Index sat at **lines 77-133** -
outside both windows. So the priority table cost a `Read` every time it was needed, while lines 1-30
spent 2,348 chars re-injecting P39/P40/PR #158 narrative about work that is finished and archived.

**Fix.** Two-tier head. Lines 1-30 are now a **NOW** block: title, one-line as-of, the eight P0/P1
rows with their next sub-item IDs, and the one paragraph explaining why P35 leads. It ends on line 30
with an HTML comment marking the boundary, because the window is a hard line count and inserting a
line above it silently drops the last P1 row with no error. The full 37-row index, the ID migration
table, then the recency trail follow in that order.

**Cost of the change:** lines 1-30 went 2,348 -> 1,701 chars, and what they carry changed from
finished-work history to the live queue. The trail did not shrink, it moved below the index.

Integrity re-checked after the move, not assumed: 222 sub-item IDs, no duplicates, 192 open items,
46 `##` sections (44 before, plus the two new headings). The old MAINTENANCE NOTE claimed the header
is what gets injected; that is now false and the note says so.

---

## Session 2026-08-07 (fourth) — priority buckets renamed O0..O3, four re-bucketings

User: the buckets and the phase IDs both started with `P`, so a bare "P2" was ambiguous - bucket or
phase. Buckets are now **O0..O3**. Phase IDs keep `P`. Nothing else about the scheme changed.

**Re-bucketed by the user:** P28 and P40 O1 -> **O3**; P37 and P48 O3 -> **O2**. Index re-sorted, so
the O2 block now ends P37/P48 and the O3 block now starts P28/P40.

**Knock-on the user did not have to ask for:** demoting P28 and P40 emptied two rows out of the NOW
block, which has to stay exactly 30 lines or the PreToolUse `head -30` clips it. The head was re-cut
at 30 with six rows, a line naming the O-bucket convention, and a line recording this re-bucketing.
Verified by assertion in the edit script, not by eye.

**Correction to the previous entry:** the index has **37 rows, not 38**. The earlier count was wrong
and had propagated into progress.md, the commit message and the PR body. Fixed here; the phase
coverage check itself was right both times, index and file sections still match exactly with nothing
on either side unaccounted for.

---

## Session 2026-08-07 (fifth) — P35f + P35g shipped: IRC §1014 basis step-up, v11.1499

Planned `P35g` in plan mode, built it with `P35f` folded in. **222 node tests (was 214), 518 in the
browser, all green.** Not on `main` yet: open as [PR #160](https://github.com/nightskyguy/retirement_assets/pull/160), commit `15396c0`.

**Four user decisions rewrote the recorded spec before any code was written.** No `deathBasisStepUp`
enum, no knob, no `'none'` - step-up is law, not preference, so goldens get rebaselined rather than
kept green behind a switch. Not a `COMMUNITY_PROPERTY` list either: the user rejected it as "a second
place to forget", so all 38 jurisdictions carry their own `BasisStepUp` (0.50/1.00) with a test
asserting every one declares it. Terminal row only, not every year, because "wealth at death is not
wealth now". Scope cut to the step-up; `survivorSpendPct` deferred to `P35i`.

**Two planned steps turned out to be unnecessary.** Writing the terminal fix as `Basis := Brokerage`
on the log row instead of "stop subtracting the haircut" made `max(0, Brokerage - Basis)` zero for
every downstream consumer, so `bestConversionStopYear` needed no `atDeath` parameter and
`afterTaxNetWorth`/`_afterTaxBuckets` needed no arithmetic change. Removing their term anyway would
have broken a legitimate test of the general helper. Documented as inert instead of deleted.

**One trap caught before it shipped.** A `_cfRun` completes fully, so without a guard its last row
arrives at the Break Even block already stepped up while the main log's has not, and the final
year's `convOC` differences two different valuations. Requires BOTH the post-pass sitting after the
BE block AND an `inputs._cfRun` skip. Verified by isolation - a build with the terminal step-up
disabled produces a bit-identical `convOC` series - not by reading the code and believing it.

**A second regression caught the same way.** Renaming the death markers from "Your Passing" to "You"
silently broke the Monte Carlo chart's milestone filter, which matched on `/Passing|.../`. Now
filtered on the structural `stepUp` flag, which a rename cannot break.

**Measured effect.** Default plan $625,885 -> $637,024 ending wealth, $10,513 less lifetime tax,
spending identical to the dollar. Brokerage-heavy plans move ~11.6%. Single filer: wealth up, tax
**unchanged** - proof the two step-ups are correctly separated. TX vs FL (both no-tax, differing
only in `BasisStepUp`): +$184,854 wealth, -$127,539 tax.

**Nine existing tests moved, and two of them were findings rather than rebaselines.** The T6
divergence that `optimizer_core.tests.js` recorded as permanently lost is back (see findings), and
`CONV_BASE`'s time-limited conversion turned out to be an artifact of the bug - worth $1,221-$5,587
against a $28,551 modeling error. Moved those tests to a `TL_BASE` with a larger IRA, deliberately
keeping the brokerage gain so the test clears the correction instead of dodging it.

**Chart markers, four rounds of user iteration.** Ended at: labels "You"/"Spouse"/"Both", a drawn
half/full circle glyph, a second-death marker (single filers previously got **none**), and a legend
that describes only the marks the plan actually has - no half swatch in a community-property state
or for a single filer, where a half step-up cannot occur. Along the way the index-based `i % 3`
label stagger had to be replaced with real overlap testing: it put the default plan's two death
markers, one year apart, on the same row. Overlapping label pairs went 1 -> 0 on the default plan
and on the reported scenario, and 0 on a 17-marker shortfall plan.

**Docs.** README's "there is no basis step-up" limitation replaced with four named residual limits
(LA/NM unmodelled, aggregate basis with no per-spouse attribution, AK opt-in, no loss carryforward),
each with its direction of error. `P35h`'s caveat is now obsolete and was rewritten, not deleted.

---

## Session 2026-08-07 (sixth) — P41 audit: shipped, but not completely

User asked whether P41 (Pension Start Age) was complete, since v11.10ee's changelog announces
"Pension start age". Audited all seven sub-items against the code rather than against the changelog.

**Five shipped and were never checked off** (`P41a` input, `P41b` `getInputs()`, `P41c` engine age
gate, `P41e` URL alias `psa`, `P41f` survivor logic needs nothing). The checklist showed all seven
open, which understated the work as badly as calling the phase done would have overstated it.

**`P41d` is a real remaining defect**, not bookkeeping. `computeSuggestedSpend()` lives in
`optimizer_ui.js:4712`, not core.js where the plan recorded it, and counts the pension
unconditionally in three places while never reading `pensionStartAge`. Confirmed live: start age 75
against retirement age 65 is read correctly as 75 and the suggested spend does not move. So the
After-Tax Spend ⓘ credits a deferred pension for years before it arrives - wrong for precisely the
"retire at 60, pension starts at 65" case the input's own tooltip advertises.

**`P41g` has no test.** The `pensionStartAge: 65` in `optimizer_core.tests.js:1613` belongs to a PA
retirement-income-exclusion test that only sets the field; reverting `P41c` would fail nothing.

**Not fixed, by the user's instruction** - it is unrelated to the basis step-up and would have
muddied PR #160. Left as `P41d` + `P41g`, both small, both in `optimizer_ui.js`.

---

## Session 2026-08-09 (seventh) — P41 completed: `P41d` + `P41g` shipped (v11.14bf)

Closed the two remaining P41 items from the sixth session. P41 is now 7 of 7, shipped separately
from the P35 basis-step-up work as planned.

**`P41d` — suggested spend now respects the gate.** `computeSuggestedSpend()`
(`optimizer_ui.js:4712`) is a single-year snapshot at `retireAge`, not a per-year loop, so it
counted `inp.pensionAnnual` in three spots unconditionally. Replaced all three with one `pension`
local gated at retirement age. The gate itself was extracted to a pure, node-testable helper
`DisplayHelpers.pensionAtAge(amount, startAge, age)` in `displayhelpers.js` (user chose the
"refactor testable helper" option over an engine-only test). `startAge` 0/blank keeps the old
behaviour (`age >= 0` always true), so existing plans are unchanged; a pension deferred past
retirement is excluded.

**Why a helper and not a direct test.** `computeSuggestedSpend()` lives in `optimizer_ui.js`,
which the test harness never loads (DOM-bound `val()`/`getInputs()`, not exported). Only
core/taxengine/displayhelpers are `require()`d. `displayhelpers.js` was already node-loadable and
UI-used, so it is the natural home. The **engine gate stays inline** at `optimizer_core.js:1154` —
core is deliberately self-contained (its own `:3761` comment) and its gate also applies COLA +
survivor pct, which the pure helper does not.

**`P41g` — two tests, one of which bites the engine gap the audit named.** In
`optimizer_core.tests.js` after the PA test: a `pensionAtAge` unit test, and a `test.critical`
that runs `simulate()` with a pension deferred to 80 and asserts `pension === 0` before the start
age. Reverting `optimizer_core.js:1154` to the ungated line was verified to fail exactly that
critical guard (1 failed), and restoring it returns 224/224. This is the first test that would
catch a P41c regression — before today, reverting the engine gate failed nothing.

**Verification.** node 224/224, 11/11 critical guards. Browser (served via `serve.py` on 8767):
title/stat v11.14bf, `DisplayHelpers.pensionAtAge` a function, deferred pension (start 75 vs
retire 65) drops suggested gross $168,000 -> $153,000 (exactly the $15,000 pension), after-tax
$149,589 -> $138,565; self-test badge green; the `[staleness guard]` console error was fixed by
bumping `optimizer_tests.js` `EXPECTED.optimizer_core` 222 -> 224. Only remaining console error is
the Cloudflare-analytics CORS block, present on any local serve and unrelated.

**Not a behavior-change release.** No saved scenario or shared link changes its numbers — only the
one-click suggestion moves, and only for a pension deferred past retirement. Changelog entry is
plain (no `data-flag="behavior"`). Files touched: `displayhelpers.js`, `optimizer_ui.js`,
`optimizer_core.tests.js`, `optimizer_tests.js`, `retirement_optimizer.html` (title +
`optimizer_ui.js`/`displayhelpers.js`/`optimizer_tests.js` `?v=` bumps + changelog `<li>`,
dropped the 11.1464 `<li>` to keep five), `optimizer_changelog.md`.

---

## Session 2026-08-09 (eighth) — P49: horizon-aware suggested spend (v11.14c6)

The suggested After-Tax Spend was a flat 5% of every account plus SS+pension, taxed once, ignoring
plan length entirely - backwards to the whole withdrawal-rate literature (Bengen/Trinity), where the
safe rate is chiefly a function of horizon. Replaced it with an engine-calibrated solver.

**Design (user-driven).** Discussed the options; user chose to build Option B (PMT over the invested
portfolio) as the SEED, with the haircut found by a **live per-plan engine search** rather than a
baked constant, success = the last modeled year still holding **3 years (embedded
`SUGGEST_BUFFER_YEARS`) of portfolio-funded need** (`spend − guaranteedIncome`), on the deterministic
path. Two `AskUserQuestion` forks settled: (1) live-per-plan vs global constant → live; (2) buffer
basis → portfolio-funded need vs full spend → portfolio-funded.

**Realization worth recording.** An engine-calibrated haircut makes this Option C (engine solve) with
a B-shaped seed: the reported number comes from `simulate()`, not the PMT. The PMT still earns its
keep as the search-bracket seed and as the "% of naive amortization" the tooltip reports.

**Reuse found by exploration** (two Explore agents): the repo already had `calculateAmortizedWithdrawal`
(PMT primitive, `optimizer_core.js:116`) and `optimizeSpend` (binary search on spendGoal whose
`passes` is the 1-year terminal-buffer test). `suggestSustainableSpend` generalizes that buffer from
1 to K years and seeds with the PMT. `simulate()` is synchronous ~0.5ms/call, so ~25 calls per solve
is a few ms - fine on recalc. **spendGoal IS after-tax**, so the solved number is the suggestion
directly (no separate tax math). Horizon is death-driven (`r.log.length`), not `nYears`.

**Build.** `suggestSustainableSpend` in core (coarse-scan-then-bisect, never breaks early on a fail -
the ACA/IRMAA-cliff non-monotonicity the `bestConversionStopYear` header warns about). UI: deleted
the flat-5% `computeSuggestedSpend`; `refreshSuggestedSpend()` caches the solve, called once per
recalc from `runSimulation()` (the solve is spendGoal-independent, so the per-keystroke tooltip path
stays cheap). Tooltip surfaces horizon + haircut + the deterministic-path caveat.

**Verified.** node 227/227 (3 new: boundary, buffer-monotone, horizon-monotone). Browser (served,
v11.14c6): default scenario suggests $146,475 over a 25-yr horizon (71% of naive PMT); apply/restore
toggle 140000 -> 146475 -> 140000; badge green; only console error the unrelated Cloudflare CORS.
Eyeball horizon monotonicity: 9yr->$67k, 17yr->$41k, 27yr->$27k. SS is now gated by the engine, so
the SS-not-gated asymmetry the old snapshot had (flagged earlier this session) is gone for free.

**Loose ends.** `DisplayHelpers.pensionAtAge` (shipped P41 for the old snapshot) is now unused by
production, retained as a tested utility. `gkSpendStable` deliberately left out of the predicate
(strategy-agnostic). MC-percentile calibration is the future SoRR-aware upgrade. Files: `optimizer_core.js`,
`optimizer_ui.js`, `optimizer_core.tests.js`, `optimizer_tests.js`, `retirement_optimizer.html`
(title + core/ui/tests `?v=` + changelog `<li>`, dropped 11.146a to keep five), `optimizer_changelog.md`.

---

## Session 2026-08-09 (ninth) — suggested-spend: units bug found + P50 menu core (PAUSED, uncommitted)

User noticed the P49 suggestion ($146,475 default) made the "Withdrawal Rate" tile read 12.8%, all
years >7%. Investigated - three findings, a half-built P50 menu, then the user paused: "do not
proceed/change more code. Record these findings." Full detail in findings.md (P50 section) and the
task_plan P50 section. Short version:

1. **Real units bug (fixed in tree):** P49's terminal buffer subtracted the inflated terminal
   guaranteed income from the today's-dollars search spend, understating need by ~$87k. $146,475
   actually FAILED its own buffer (port $226k vs required $452k). Fixed to `last.spendGoal -
   last.guaranteedIncome`; default now $143,082, buffer holds. Added an inflation units-guard test
   (BASE's inflation:0 hid it). Keep this fix regardless of the menu.
2. **The high rate is the definition, not a bug:** "spend down to a K-year buffer" is a spend-down
   posture; the portfolio-relative rate rises as the account drains (6.5% -> 32.8% on the default).
   Not comparable to Bengen's non-depleting 4.7%.
3. **P50 menu core built + tested (233/233), UI NOT wired:** `suggestSpendMenu` returns A (Bengen
   rate) / D (leave 50% real principal) / B (5 full years left), all against a FIXED propwd reference
   so they are strategy-independent (a ★ CRITICAL test guards it - this resolves the user's
   strategy-dependence complaint). But A (rate) and D/B (targets) CROSS by horizon (35yr: A<D<B;
   17yr: D<B<A), so the Conservative<Middle<Aggressive ladder is not monotone. User was asked to pick
   the presentation (method-labels+sort vs keep-fraction gradient) and instead paused.

**State:** all uncommitted on `worktrees/planning-with-files-0cb454`, stacked on open PR #162 (P41 +
P49). Also a version desync: title/`?v=` bumped to 11.14c8 with no matching changelog entry. Next
session: decide commit-WIP vs revert-P50-keep-units-fix, then the P50c presentation decision. Preview
server (serve.py on 8767) kept dying with exit 127 on cleanup but served correctly while up.

---

## Session 2026-08-09 (tenth) — reconcile: units fix + buffer=5 committed, P50 kept dormant

User updated the changelog directly on the branch (4 commits: combined the P41 + P49 entries into one
consolidated **11.14c6** entry, describing a 5-year cushion). That made the changelog describe behavior
the committed code did NOT have: the branch still shipped `SUGGEST_BUFFER_YEARS = 3` and the units bug.

Reconciled: raised `SUGGEST_BUFFER_YEARS` 3 -> 5 (user request), stashed local WIP, `git pull --rebase`
onto the user's 4 changelog commits (fast-forward, no conflict - they touched only optimizer_changelog.md
+ the in-page `<li>`), popped the stash, and rolled back the stray 11.14c8 `<title>`/`?v=` bump to
**11.14c6** so title = changelog (user consolidated everything under c6, no new version). Committed the
units fix + buffer=5 + the P50 menu core (`solveMaxSpend`/`bengenRate`/`suggestSpendMenu`) as **dormant**
(committed, tested 233/233, but NO UI caller) per the user's "keep P50, remain dormant". Verified the
changelog's claims now match the code: engine-solved, current-strategy, 5-year cushion, units-correct.

Left for a later session: P50c (menu presentation - the rate/target options cross by horizon, user has
not chosen a layout), P50d (build the popover), P50f/g. Two grammar nits in the user's changelog left
untouched (their file): "at least a five years" and "differ from the Optimizer calculates".

---

## Session 2026-08-10 (eleventh) — Stage 1 of the brokerage program: P36 round 1 + P32e, both landed

User asked three questions: (A) how hard is whole-horizon asset-utilization optimization on this
engine, (B) does Cyclic leave money on the table in harvest years, (C) can Proportional's optimality
be proven. Planned a 3-stage program (all approved; plan file
`~/.claude/plans/let-s-reason-around-brokerage-agile-stearns.md`, design annex alongside it):
Stage 1 scans (done this session), Stage 2 `cycleHarvestMode`/`cycleCoexist` research inputs +
A/Bs, Stage 3 = NEW PHASE P51 perfect-foresight oracle (allocated, O1).

Stage 1 shipped: NEW `.test_harnesses/phased_harness.js` (P36 round 1 — 45-cell grid x the sweep's
own 192-arm enumeration, UI scoring recipe, three tables → PHASED_RESULTS.md) and
`brokerage_harness.js` +q3/q4 (P32e → P32_RESULTS.md). Q1 re-run post-dividend-fix folded in.
Headlines (full detail findings.md 2026-08-10): cyclic wins 26/45 cells but HALF is the
surplus-routing confound (CashReserve:0 control still wins 23/45 at half magnitude — future cyclic
A/Bs must equalize routing); cycleLTCGTarget 0.20 is an ANTI-lever (wins 53/2,576, worst −$380k,
§1014 erases what the harvest taxed) so the nerdknob gate is protective; GK's ranking dominance is
survivorship + spend drift; propwd never top-3 anywhere (S1-P1a WRONG); harvest years forgo
~$111,700/year of IRA draws (median row 57% of lifetime voluntary draws) — question B alive,
causal number = Stage 2's q6(). Predictions S1-P1..P4 scored; most WRONG, which is the output.

Bookkeeping: P32e checked off (+P32i added, feeds P32h — Q4 evidence says keep the gate, keep
0.15); P36a/c/d checked, P36b annotated round-1-done/round-2-waits-P35i; P51 section + O1 index
row added; NOW-table P36 row swapped for P51 (line-30 boundary preserved, no net line adds above
it). No engine edits yet — Stage 2 opens with the default-off inputs + bit-identical tests.

---

## Session 2026-08-10 (eleventh, continued) — Stages 2 + 3: engine research inputs + the oracle

**Stage 2 (P32c half, P32f, P32i):** `cycleHarvestMode` ('maxbracket'|'spendonly') and
`cycleCoexist` ('off'|'bracketfill') shipped in the `:1432` harvest branch, default off, harvest
sizing refactored into a `_sizeHarvest(ordFloor)` closure (byte-identical math when off), MAGI
ceilings via a documented two-pass fixed point, coexist IRA draw un-zeroes surplus conversions
automatically. Tests: absent≡off deep-equal x2 scenarios, leak guard, IRMAA-tier invariant,
spendonly<=maxbracket. A/Bs q5/q6 in brokerage_harness -> P32_RESULTS.md. ALL THREE S2 predictions
WRONG: maxbracket wins only 4% of 2,514 pairs (the top-off is a pre-§1014 design); coexist is
median-NEGATIVE (-0.73%) because the skip was protective for aggressive ceilings (FB35 -$2.1M)
while measured arms gain (IRA Draw 5-8% up to +$808k). thirdPassBrokerage/forcedIRAAllowBrokerage
(P32d's flags) still open.

**Stage 3 (P51a-c,e-g):** oracle_harness.js + `oracleWithdrawalPlan` engine hook (default off,
throws on cyclic composition, absent≡off + fidelity-replay tests, suite 242/242). P51a:
conv-only oracle beats champions by 0-2.87%; flat scalar $0 in 15/15 (S3-P1 RIGHT). Full oracle
(non-cyclic base after the compose-throw surfaced mid-run): conversion timing >> split
(defaults3x@4%: +$1.08M vs +$36k), propwd gap-to-oracle 2.3-11.6% -> **default-optimal REFUTED
both halves**, oracle does NOT rediscover harvest alternation (Roth-tail shape instead), cyclic
rows BEAT the oracle in defaults@6% (surplus routing outside the menu = cyclic's true edge),
backstops silent 15/15. P51g: converts more at higher heirs rates. P51d left open, sharpened.
Two methodology traps recorded in findings: baselineScore for champion picks, spend-pin for all
candidates (a GK base faked +81% without it).

**State:** engine + tests + 3 harnesses + 3 results .md all UNCOMMITTED on this worktree branch.
No version bump yet (research inputs are engine-visible -> bump when committing). Next: P51d, or
P32d's two remaining flags, or the P32h decision write-up.

---

## Session 2026-08-10 (eleventh, continued 2) — basis axis closes the coverage gap

User flagged extrapolation risk; coverage sections added to all three results .md with exact
ranges (assets $810k-$14.58M, IRA 22-86%, Brok 6-62%, spend $32.4k-$1.17M) and the held-fixed
list. Then, at the user's request, a basis-fraction axis (20%/80% vs the mixes' 43-56%) was
added to phased_harness (basis-sensitivity summary), brokerage_harness (q3-control/q4/q5/q6 at
both arms), and oracle_harness (45 cells, 511k sims). Predictions B-P1..B-P5 pre-registered,
ALL FIVE RIGHT: every conclusion basis-stable in sign, scaled in magnitude (findings.md
2026-08-10 basis entry). Notable: coexist's IRA Draw gains peak at HIGH basis (+$980k);
conv-only oracle alpha grows off-default-basis in both directions (to 9.0%). Q1 ladder stays at
50% deliberately. Remaining single-point axes named: household/survivor shape, state, path,
pension. All still uncommitted.

---

## Session 2026-08-10 (eleventh, continued 3) — P35n endgame tail study: PR-5 spec refuted

User approved the endgame study with three choices (IRA axis both, death axis 2 profiles,
conversions off+sensitivity). Built: `{prop}`/`{seq}` entry forms added to the P51b
oracleWithdrawalPlan hook (+2 tests, suite 244/244), NEW endgame_harness.js (144 cells starting
AT the IRA-target state, 32k sims/13s), ENDGAME_RESULTS.md. RESULT: **Cash -> Roth -> Brokerage
wins 88/108; the P35 PR-5 balance-proportional BALANCED spec is the worst arm (median -$223k,
wins 1 cell)**. Mechanism = P28 + §1014 composed (Roth displacing the BROKERAGE draw, brokerage
ridden to step-up). E-P3 decisively WRONG (predicted Roth-early loses; it won 100/108). Boundary
mapped: below ~$1.3M totals CRB/CBR tie (0% LTCG bracket), proportional still zero. Light
oracle adds only ~$27k median over static CRB. P35n checked off with the PR-5 amendment note:
`P35i`'s gap-fill arm should ship the sequence. Caveats recorded: taxflex disagrees (CRB
empties Roth), no SECURE heirs, one path/CA. All uncommitted.

---

## Session 2026-08-10 (eleventh) — bug: suggest-spend ⓘ shows stale "Restore" after loading a scenario

User report: loading a saved scenario left the After-Tax Spend ⓘ offering to reset to the DEFAULT spend
goal instead of recalculating and offering to restore the goal loaded from the file.

Root cause: `applyScenario()` (optimizer_ui.js ~4143) sets `spendGoal` via
`DisplayHelpers.setDollarValue` (programmatic), which does NOT fire the field's
`oninput="_priorSpendGoal=null"`. So the module var `_priorSpendGoal` survived the load. If the user had
clicked the ⓘ before loading (which stashes the pre-suggestion value, e.g. the 140000 default, into
`_priorSpendGoal` and flips the icon to "Restore: $X" mode), the icon kept showing that stale default
after the load. `_suggestedSpend` itself already recomputes via runSimulation→refreshSuggestedSpend, so
the ONLY defect was the un-cleared `_priorSpendGoal`.

Fix: one line - `_priorSpendGoal = null;` in `applyScenario`, just before the
`updateSuggestSpendTooltip()` call in the derived-field refresh block (with a comment). Same file-level
scope, so the assignment binds the outer `let`.

Verified in browser (serve.py autoPort, port 3000) by exercising the real functions:
  1. load default → ⓘ = "Suggested goal: $139,087 ... Click to apply"
  2. click ⓘ → spendGoal 139,087, ⓘ = "Restore: $140,000" (pre-load stale state)
  3. applyScenario({spendGoal:200000,...}) → ⓘ = "Suggested goal: ..." (recalculated, NOT Restore) ✓
  4. click ⓘ again → Restore target = **$200,000** (the loaded goal, not the default) ✓
Console clean (only unrelated cloudflareinsights CORS beacon). node optimizer_core.tests.js 233/233.

Also switched `.claude/launch.json` from fixed `python -m http.server 8767` to `serve.py` + autoPort
(the blessed preview config, avoids leaked-port collisions).

SHIPPED as PR #163 (branch fix/spend-goal-restore-after-load, commit 558efc8) - user asked to commit +
PR with NO version bump and NO changelog. Only optimizer_ui.js committed (+6); the .claude/launch.json
serve.py change stayed local since .claude is gitignored. Pre-commit hooks green (core 233, TPP 32,
doclinks 22).

## Session 2026-08-10 (eleventh, cont.) — Ordered strategy: confirm restart + (b) surplus-fill + (c) harness

User asked to confirm the Ordered strategy re-funds in sequence every year (not stuck past an exhausted
account). CONFIRMED correct: runOrderedWithdrawal (optimizer_core.js:754) is stateless, reads live
balances each call, no persistent pointer; called fresh per year on yr.curBalances at gap-fill (:1687)
and third pass (:1743). "CIBR" the user named is not an offered seq (the three are CBIR/RIBC/BIRC).

User then chose (b)+(c):
 (c) New harness .test_harnesses/ordered_fill_harness.js proves restart (CBIR: Cash emptied 2026 ->
     refilled to ~$487k in the SS/RMD window -> re-drawn 2052-53) and shows the fill before/after.
 (b) Added `else if (yr.isOrderedStrategy)` in routeSurplusAndConvert (~2071): surplus banks in the
     first FUNDABLE account (Cash/Brokerage) the sequence draws. CBIR->Cash (unchanged), RIBC/BIRC->
     Brokerage. Precedence Cyclic > CashReserve > ordered-fill > legacy. CBIR byte-identical; RIBC
     +~4% / BIRC +~7% terminal wealth on the 30yr fixture.

Shipped full (user: "PR + docs + changelog") as PR #164 (branch fix/ordered-surplus-fill off main,
commit 9e5ad6f, v11.14dd): engine + harness + title/?v=1114dd + in-page changelog li + changelog.md +
Ordered help text. node core 233/233, TPP 32, doclinks 22; browser self-test 529/529 (12 critical
guards) with the new version loaded. GOTCHA re-confirmed: serve.py preview process died mid-session
(preview_list empty, chrome-error page); preview_start reused/relaunched on port 3000 fine.

---

## Session 2026-08-15 (twelfth) — Resync planning files to git (`/plan`)

User invoked `/plan` and chose **"Resync plan to git"** on finding the files lagged `main` by ~5 days.

State reconciled. `main` = `310b23d`, shipped **v11.1553**, working tree clean. Worktree branch
`worktrees/planning-with-files-e0c3ab` is `0 0` vs main (identical tip); `git diff main -- .planning/`
was empty, so these files WERE main's - the gap was real, not a worktree fork.

Diagnosis: the last planning-doc update was **PR #166** (v11.14e1, 08-10). **PRs #167-#173 shipped
without touching the planning files.** progress.md ended at #164; the index already had P52 as DONE
(added out-of-band) and P51 at O1. Catalogue of the unlogged work, newest first:
- **#173** v11.1553 (08-15): Experiment-box fold, `?montecarlo` teaching demo, mode-aware paths floor,
  README MC section adopt.
- **#172** (08-14): GA + Cloudflare analytics on Jekyll pages. Un-phased.
- **#171** (08-14): Income Tax Planner visual bugs (NIIT follows MAGI, chart NIIT $, SS cap, ordinary
  scrubber). Un-phased.
- **#170** v11.1521-152f (08-13): Monte Carlo Stress Test batch (bear-start 3/5/10yr windows, memoized
  start-year ranking, plan-only default, combine-all-windows, NaN fixes). Un-phased, large.
- **#169** v11.150b (08-12): P52 MC "Run My Plan Only" nerdknob + 6 Stress Test refinements. **P52 DONE.**
- **#168** v11.1508 (08-12): staleness guard synced to tests on disk (244 then) + doc refs.
- **#167** (08-11): Roth + tax README revamp. Docs.

Verified live facts: `<title>Retirement Optimizer 11.1553</title>`; `TestTiers.EXPECTED =
{ optimizer_core: 263, taxPaymentPlanner: 32, doclinks: 22, slowInCore: 3 }` (was 214/32/22 in the
trail - the trail line was a dated snapshot, left as history; current counts recorded in the new
2026-08-15 trail block).

Edits made (docs only, no engine/version change):
1. task_plan.md header (line 3) - `main`/version/PR#, kept to 3 lines to preserve the LINE-30 boundary
   (verified marker still on line 30 after the edit).
2. task_plan.md trail - new "As of 2026-08-15 (resync)" block at the top of "Recent state and trail",
   cataloguing #159-#173 and the new test counts; prior 08-07 snapshot kept below it.
3. progress.md - this entry.

**Open queue UNCHANGED by the resync.** None of #167-#173 completed an O0/O1 item; P35/P32/P51/P30/P19/P34
all still open. NOW block left as-is (still accurate).

**Follow-up (same session, user said yes): the two un-phased MC features were phased retroactively and
marked DONE.**
- **P53** — Monte Carlo Stress Test suite (#170, v11.1521-152f). Seven sub-items P53a-g: two crash fixes
  (`buildStressBank` overran its candidate pool + swallowed worker throw), 5-window ranking with
  memoized `scoreStartYears`, bear-start 3/5/10yr openings (behavior change), and **P53f: plan-only
  became the default run (v11.152d)** which **reversed the P52 "compare stays default" decision** two
  days after P52 shipped. Noted in both sections so the record is not self-contradictory.
- **P54** — `?montecarlo` teaching demo + mode-aware paths floor (#173, v11.1553). P54a-d: URL demo
  auto-runs an Experiment (3 seeds x 4 path counts, 5/10/25/100) reusing the "My Plan Only" engine;
  the mode-aware floor (100 normal / 3 under nerdknob-or-demo) was the root cause of the "1 path still
  shows wide bands" report; Experiment box is a `<details>` fold; README walkthrough replaced by a link.

Index gained two **DONE** rows (P53/P54); phase sections appended after P52 in numeric order. Corrected
the browser self-test figure to **559** at v11.1553 (the resync block had guessed 529 from v11.14dd).
Still docs-only, no engine/version change.

---

## Session 2026-08-15 (thirteenth) — Local (county/city/school) income-tax disclosure NOTES + launch.json fix

User asked which supported states have county/city/school-district income taxes the engine does not model,
then to add disclosure NOTES for the ones that undercount **retirement + investment income** (the key
discriminator: earned-income-only local taxes miss retirees), and to add a prioritized modeling plan to P19.

Engine models **zero** sub-state income tax. Added/strengthened 8 `taxengine.js` NOTE fields:
- Full income base: **MD** (23 counties + Baltimore City, strengthened), **IN** (92 counties, strengthened).
- New: **NY** (NYC 3.08-3.88% + Yonkers), **OH** (school-district income tax, traditional-base districts;
  OH cities tax wages only, out of scope), **MI** (city tax on interest/div/cap-gains, pension+SS exempt),
  **OR** (Portland-metro SHS + Multnomah PFA, threshold-gated; state had NO note before), **PA**
  (Philadelphia School Income Tax on dividends + certain interest; PA EIT/wage taxes miss retirees), **IA**
  (school-district + EMS surtax on the investment-income portion).
- **Deliberately not flagged** (verified no gap, per the state-NOTE style rule): KY/AL occupational,
  PA/OH wage/municipal (earned income only); CA/CO no personal local income tax.

Verified: `taxengine.js` parses, node core 263/263, all 8 NOTEs present in parsed `TAXData`, Oregon NOTE
renders in a `<details>` in-browser (port 51498 via serve.py autoPort), console clean (only the unrelated
Cloudflare analytics beacon from #172).

Plan: **P19g** (DONE, the notes) + **P19h** (open — thumbnail modeling plan, prioritized by retirees:
1) NYC own jurisdiction, 2) MD tiered kicker, 3) IN tiered kicker, 4) OH SDIT kicker, 5) MI city kicker,
6) OR Portland toggle, 7) PA/IA note-only; ~4,000-municipality ceiling stated; engine hook = one
`localRate`+`localBase` into `calculateTaxes()`, nerdknob-gated).

**DECISION (user): NO version bump, NO changelog** — no taxation changed, only the info shown. State-tax
docs fold into the changelog on the next material change.

**launch.json fixed repo-wide.** Every session kept "discovering" a fixed-8767 `python -m http.server`
launch.json and switching it to serve.py autoPort. Root cause: the **main checkout's** launch.json was that
fixed-8767 template, which new worktrees copied. Rewrote main + all three worktree copies (main,
context-ab498f, readme-review-updates-c9df11, this one) to `serve.py` + `"autoPort": true`. Updated the
`feedback-preview-server` memory to record it is DONE so future sessions stop redoing the switch. `.claude`
is gitignored, so none of this is committed - it is local machine config.

Not committed yet: the taxengine.js NOTE edits + task_plan/progress updates are on branch
`worktrees/planning-with-files-e0c3ab`, uncommitted, awaiting user direction (no PR requested this turn).

---

## Session 2026-08-17 (fourteenth) — Tax Payment Planner: draw-only comparison bug FIXED, then P56 specced

**Bug the user reported:** a RetirementTaxPlanner link with `ira1RothConversion=0&ira2RothConversion=0`
showed only ONE plan (early draws) and never evaluated the late/December alternative, which the user
correctly suspected was better.

**Root cause:** `taxPaymentPlanner.js:1804` gated the whole early-vs-December comparison behind
`hasAnyConversion`, so with zero conversions the sibling plans were never computed. But the timing lever
is not conversion-specific: any not-yet-taken draw can be deferred to December.

**FIXED and verified (v1.13c3 -> v1.1580, UNCOMMITTED on worktree `context-e73361`, branch
`worktrees/retirement-tax-planner-payment-582cdf`):** gate is now
`hasAnyConversion || hasDeferrableDraw` (deferrable = amount > 0 AND not already taken, since a taken
draw is locked to its actual month and offers no choice). Draw-only renders a two-plan comparison with
the Roth-specific Plan A column, pill and growth row suppressed; the conversion path still renders all
three. Node 32 -> **34 tests**, browser badge 34/34, console clean. On the user's scenario December wins
by **$1,578** (early costs $1,366 withholding OC + $212 RMD deferral), matching the tool's own
break-even readout (hysaNet 2.10% < r/2 3.00%).

**GOTCHA found:** `optimizer_tests.js:2220` still says `taxPaymentPlanner: 32` while 34 are on disk, so
the tiered browser runner shows a red count-changed badge. Rolled into P56j rather than fixed here.

**Then the user pushed further** and set ten goals for the tool, the key one being that draw timing and
tax-payment timing are **separate levers** and the plan set must cover early / hybrid / late /
early-draws-late-payments / quarterly. Research turned up the deeper defect: the planner has **two cost
models that never met** and can print opposite verdicts. The timing table measures portfolio deltas to
Dec 31; the bottom "Cost Analysis" table measures HYSA-carry cost to April 15 **and prices the YE-IRA
row at the main (early) plan's withhold month even when December wins**. Same run, same screen: timing
table said December withholding wins, Cost Analysis said YE-IRA $1,862 vs quarterly $656. Priced at the
month the winning plan actually uses, YE-IRA is ~$497 and does beat quarterly's ~$656.

**Wrote it up as new phase P56 (O0), plan APPROVED by the user, ZERO code written.** Five-plan matrix
A (early) / B (hybrid, omitted with a note when no conversion) / C (late) / D (early spending draws +
December tax holdback, withheld up to 100% per Form W-4R) / Q (December draws, all quarterly estimates),
all priced in ONE unified April-15 table computed from each plan's own action list, which is what
structurally makes a self-contradiction impossible. Brokerage-sales demoted to a footnote row. Four user
decisions locked in the phase text; 11 tasks P56a..P56k; sanity anchors (A 940 / C 497 star / D 567 /
Q 656) written in so the implementation can assert against them.

**DECISION (user): implementation continues in another session.** Nothing beyond the v1.1580 fix is
coded. Start at **P56a**.

Uncommitted on this worktree: the v1.1580 planner fix + 2 tests, and these task_plan/progress edits.
No PR requested.

---

## Session 2026-08-17 (later) — worktree `context-e73361`, plan re-entry

Ran `/plan` in a **fresh worktree** (`.claude/worktrees/context-e73361`, branch
`worktrees/planning-with-files-7649a2`). Restored context from `task_plan.md` / `progress.md` /
`findings.md`; `session-catchup.py` reported nothing unsynced.

**Correction to the previous entry's closing line.** It said the v1.1580 planner fix, its 2 tests and
the planning edits were *uncommitted*. They are not: this worktree's HEAD is `b8a4dce`, the merge of
[PR #178](https://github.com/nightskyguy/retirement_assets/pull/178), and it carries `c3bd384`
(`fix(taxplanner): compare December timing for draw-only plans`) and `f37e587`
(`docs(planning): add P56`). `git status` is clean, `git diff --stat` empty. Header line 3 of
`task_plan.md` resynced to `b8a4dce` / PR #178.

**State unchanged otherwise.** P56 is O0, spec complete and user-approved, **zero implementation code
written**. Next open item is **P56a** (variant plumbing: `_variant` replaces `_baseline`/`_planC`,
target-month selection, stale letter labels in note strings). Known trap still standing for P56b: the
11d draw-action block is gated on `usesIraWithholding`, so Q emits no draw actions until that gate
widens. `optimizer_tests.js:2220` still says `taxPaymentPlanner: 32` vs 34 on disk (P56j).

No code touched this session.

### Same session, continued — P32c second half BUILT (v11.1582, uncommitted)

User picked **P32c** over P56a/P35i when asked. Implemented the two research inputs the task named,
plus a third value it did not: `thirdPassBrokerage` takes `'unbounded'` as well as `'bounded'`, because
Q2 explicitly wants an unbounded-with-a-counter arm and P32d would otherwise have to build it.

Both arms live in `resolveResidualAndForcedIRA`, default off, no UI, Ordered excluded from both.
**6 new tests, suite 263 -> 269/269**; taxPaymentPlanner 34/34 and doclinks 22/22 unchanged; browser
badge green at **570 (245 in-page + 325 node)**, console clean apart from the usual Cloudflare RUM CORS
error that localhost always throws.

**Caught a defect in my own first draft by probing before writing tests.** The re-draw loop had a cap and
no progress guard, so a year whose Brokerage was down to dust consumed all 200 passes and read as
divergence: BASE fixed showed 2,000 iterations across 10 "capped" years while lifetime Brokerage drawn had
not changed by a dollar. Added a stall break and split the counters, so `Capped` now means what P32d needs
it to mean. Preliminary reading across 8 scenarios: **zero capped years anywhere**, bounded byte-identical
to unbounded. Not the answer, but the arms behave.

**Two surprises that cost the version number.**

1. **`main` had moved.** This worktree is based on `b8a4dce`, but main is now `1c79c29` (PR #179), which
   shipped **v11.1581** and, in it, already fixed the stale `taxPaymentPlanner` EXPECTED count. So **P56j
   is DONE, by someone else**, and my first version pick collided with a released one. Renumbered to
   **v11.1582** and deleted the now-false "corrected 32 to 34" sentence from my changelog entry.
   **This branch must merge `main` before any PR**: both sides touch the changelog head, the `EXPECTED`
   line and the page title.
2. **The preview server was serving the wrong tree.** `serve.py` defaults its root to cwd, and
   `.claude/launch.json` passed no `--root`, so `localhost:8767` served the MAIN checkout while I read the
   badge and believed it. It reported 319 node tests and `EXPECTED.optimizer_core = 263` against a worktree
   holding 269 - numbers that matched no state of my own files, which is what gave it away. Fixed by adding
   `--root <worktree>` to the worktree's own (gitignored) `.claude/launch.json`. **Worth remembering: a
   green badge from a worktree preview proves nothing until the served root is confirmed.**

Changed: `optimizer_core.js`, `optimizer_core.tests.js`, `optimizer_tests.js` (EXPECTED 269),
`retirement_optimizer.html` (title + 3 cache busters + changelog li), `optimizer_changelog.md`, and the
three planning files. Nothing committed, no PR. **Next: P32d**, which is now pure measurement.

### Same session — merged `main` into the branch, conflicts resolved (merge `c4225fc`)

User asked to confirm these changes can merge with `main`. Dry-run first, with no refs touched:
`git merge-tree --write-tree $(git stash create) origin/main` reported **three conflicts** -
`optimizer_changelog.md`, `optimizer_tests.js`, `retirement_optimizer.html`. Resolving needs a real
merge, so committed P32c as `fc45bbf` and merged `origin/main` (`1c79c29`) as `c4225fc`. Local only,
**nothing pushed, no PR**.

Resolutions:

- **`optimizer_tests.js`** - kept main's new comment block above `EXPECTED` (it explains the
  cross-tool trap that reddened the badge) with **our** count: `optimizer_core: 269`.
- **`retirement_optimizer.html`** - ours in all three spots (title `11.1582`, `optimizer_tests.js?v=`,
  tier-2 loader `V`). Main shipped 11.1581 with **no** in-page `<li>`, so the newest entry in
  `#changelog-list` is correctly ours.
- **`optimizer_changelog.md`** - both entries kept, 11.1582 above 11.1581.
- `optimizer_core.tests.js` auto-merged: main's new "counts are pinned outside this file" header sits
  at the top, our tests at line ~378.

**Main brought two obligations this change had to satisfy, both now done.** A new `CLAUDE.md` (and a
matching header in the suite file) says the counts have a **second home** in the `.githooks/README.md`
suite table: updated 263 -> 269 there too. And main had refreshed the tier-2 loader's own prose count,
which our 6 tests made stale again: `319 tests` -> `325`. Also checked the new "hover over, never
hover" rule against the new changelog prose - it does not use the word.

`git merge-tree origin/main HEAD` now exits 0: **a PR would merge clean.** All three suites green
(269 / 34 / 22), pre-commit hook green on both commits, browser badge green at 570 (245 in-page +
325 node) with `EXPECTED` reading 269/34/22/3 and the newest changelog entry showing 11.1582.

### Same session — issue #177 + All-start-years wording (v11.1585)

Two user-reported defects, both in the Stress Test, plus the changelog rewrite the user asked for.
Release renamed **11.1582 -> 11.1585** (11.1582 was never published, and `main` had already taken
11.1581).

**1. Issue #177, stress tile stale after a scenario load.** `applyScenario()` ended with
`runSimulation()` and nothing else; the tile is fed by `mcInputsChanged()`, which rides the sidebar's
blur/change listeners, and `applyScenario` sets `.value`/`.checked` programmatically so neither event
fires. One guarded call added at the end of `applyScenario` (`optimizer_ui.js`), which covers modal
Load, Import and the dead `loadScenario` in one edit. User chose the **minimal** fix, so the two
silent drops in `refreshMCStressOnly` stay.

**The `document.readyState === 'complete'` guard on that call is load-bearing, not defensive noise.**
At DOMContentLoaded `applyScenario` runs BEFORE `loadFromURL`, so an unguarded call starts a stress
pass against the pre-URL plan; if it were still in flight 600ms later the page-load prime would be
dropped by the busy guard and a share URL would settle showing the DEFAULT scenario's numbers.
Verified directly: with `weak` saved as the default scenario and a `strong` share URL (and the
reverse), the tile ends on the URL plan.

**2. All start years wording.** `renderStressHeadline` said "in 13 of the 98 worst historical periods
on record" about a mode that runs every start year there is. Now branches on the existing
`stressModeOf(stress).mode` (which prefers the engine's applied `windowMode` over the live selector),
carried through a new `mode` field on `stressFailureSummary`. `STRESS_TOOLTIP_BASE` split into
`STRESS_TOOLTIP_WORST` / `STRESS_TOOLTIP_ALL` behind `stressTooltipBase(mode)`, since the tile and the
headline share it. GOTCHA recorded in the code: `renderStressHeadline` interpolates the tooltip into
`title="..."` **without** escaping, so those constants must stay free of double quotes.

**3. README.** The Stress Test section claimed six ranking lengths including a 25 year window that does
not exist (code: `STRESS_WINDOWS = [5,10,15,20,30]`) and hardcoded 36 start years four times.

**Verified in the browser**, worktree-rooted server: strong <-> weak round trip flips the tile
13/36 <-> 36/36 with no MC tab visit and no manual edit; share-URL boot beats the saved default;
pristine load (localStorage cleared, no params) still primes; `?montecarlo` renders its 12 rows and
still populates the tile; All mode reads "98 of the 98 start years on record" with the All tooltip on
both surfaces; Combined reverts to "36 ... worst historical periods on record". All five sentence
branches driven directly through the shipped functions. Node 269/34/22, badge green at 570.

**The documented limitation reproduced itself during testing**, which is worth keeping: switching the
window and loading a scenario in the same tick left the tile on the older plan's 36/36, because the
in-flight pass painted last. A second load with nothing in flight corrected it to 13/36. That is
exactly the case the queued trailing re-run would close.

**No test-count edits.** `mc_tab.js` is unreachable from both tiers: it loads at
`retirement_optimizer.html:1350` while the in-page runner fires at `:1272`, and it has no
`module.exports` for node. Zero existing coverage of `montecarlo/*` anywhere.

---

## Session 2026-08-18 (fifteenth) — `/plan` re-entry in worktree `context-e73361`, files resynced

Ran `/plan` in the same worktree, now on branch `worktrees/planning-with-files-38a21e`. Restored
context from `task_plan.md` / `progress.md` / `findings.md`; `session-catchup.py` printed nothing
unsynced.

**What changed since the last entry: [PR #180](https://github.com/nightskyguy/retirement_assets/pull/180)
merged.** `git rev-parse HEAD` and `origin/main` are both `02eaf2b`, with zero commits either side of
that comparison, so **v11.1585 is on `main`** (P32c research arms, the issue #177 stress-tile refresh,
the All-start-years wording, and the earlier `main` merge). Working tree clean.

**Measured, not assumed:** `node optimizer_core.tests.js && node taxPaymentPlanner.tests.js &&
node doclinks.tests.js` -> **269 / 34 / 22**, all green, matching `TestTiers.EXPECTED`
(`optimizer_tests.js:2227`, which also pins `slowInCore: 3`). Page title reads `11.1585`.

**Two stale claims corrected in `task_plan.md`:**

1. Header line 3 said "Pushed, PR open, merges clean" against `main` = `1c79c29`. That PR is merged;
   the line now names `main` = `02eaf2b`, this worktree's branch, and the measured counts. Line count
   preserved, so the LINE-30 hook boundary still lands on the marker.
2. **P56 "Starting state - READ FIRST" was actively misleading.** It told the next session that a
   v1.1580 change sat UNCOMMITTED on branch `worktrees/retirement-tax-planner-payment-582cdf` and
   "must be preserved or re-derived", and that `optimizer_tests.js` still pinned
   `taxPaymentPlanner: 32`. Both were true when written and are false now: the fix merged as PR #178
   (`c3bd384`) and PR #179 corrected the count to 34. Rewritten to say P56a starts from a clean tree,
   with **P56j marked done by someone else** and the note that P56i must move the count in *two*
   places (`TestTiers.EXPECTED` and `.githooks/README.md`) per the `CLAUDE.md` rule `main` brought in.

**Queue unchanged.** O0 is still P56a (five-plan matrix, spec complete and user-approved, zero code),
P35i (the Phased engine) and P32d (measure Q2 with the arms that shipped in v11.1582/1585). No code
touched this session; only the two planning files above were edited.

### Same session — P56a, P56b, P56c BUILT (engine only, uncommitted, nothing user-visible yet)

User picked **P56a** from the O0 menu. Built the first three tasks of P56; the tax planner engine now
knows all five plans, but nothing spawns D or Q yet, so the shipped page is unchanged.

**P56a — variant plumbing.** `_baseline`/`_planC` booleans replaced by one `_variant` param
(`null|A|B|C|D|Q`), with `variant` and `isChild` derived once. `convTargetMonth` keys off `C|Q`,
`drawTargetMonth` off `A|D`. Siblings now spawn as `_variant:'C'` and `_variant:'B'`, and the parent's
locals were renamed `planLate`/`planHybrid` (the old names, `planB` for the December plan and `planC`
for the hybrid, are the letter soup this phase exists to kill). Return keys `planB`/`planC` stay until
P56d deletes them. Four note strings corrected: "Plan C fallback" -> "Plan B fallback" (it was wrong
under the OLD lettering too - the object it describes displayed as Plan A), "(Plan A hybrid)" ->
"(Plan B hybrid)", and two "two-plan comparison" cross-references made count-neutral.

**P56b — Q.** Forces `all_quarterly` **ahead of `forceStrategy`**, zero `drawWithholdCap`, no gap-fill,
no `ira*RothWithhold` override. The 11d gate widened from `usesIraWithholding` to
`usesIraWithholding || (isQ && allDrawsTotal > 0)`; without that Q emitted no draw actions at all, as
the phase spec predicted. Q-specific wording throughout, and the IRC 6654(g) pro-rata note is
suppressed for Q because there is no withholding for it to describe.

**P56c — D.** The four input groups became `baseGroups`; D splits each eligible one into an early
`tranche:'spend'` part and a December `tranche:'tax'` part withheld 100%, sourced largest-first.
Eligible = not already taken and not the RMD of a converting IRA. Form W-4R added to `RULE_CITES`.
`summary.variant`, `summary.dTaxPortion` and `summary.dDegenerate` are exposed for P56d's spawn gate.

**Verification, all measured.** Three throwaway probes in the scratchpad:

1. **Equivalence probe** (old `HEAD` planner vs new, 7 scenarios): `text`, `html` and the full
   action/summary/comparison structure are **identical** for A/B/C once the four intended note strings,
   the new W-4R citation and the three new summary keys are accounted for. That is the guarantee P56a
   claimed and it is now checked rather than asserted.
2. **Q probe**, 5 scenarios: all checks pass.
3. **D probe**, 7 scenarios: all four spec invariants hold.

Suites: taxPaymentPlanner **34/34**, doclinks 22/22. No test-count change, so `TestTiers.EXPECTED` and
`.githooks/README.md` need no edit yet - P56i will move both.

**Two defects caught in my own drafts before they could ship**, both found by probing rather than by
the suite: the Q probe first read $24,831 of "withholding" in a zero-withholding plan (estimate actions
carry `federalWithholding` equal to their own amount, so summing every action double-counts), and D's
first draft tagged **every** early part `'spend'`, so an IRA the largest-first pass never touched
claimed "the tax share of this draw is held back to December" when none of it was.

**Stopping point is deliberate.** P56d deletes `planB`/`planC` and breaks both
`RetirementTaxPlanner.html` and 8 existing tests, which only P56e-P56i restore, so d through i is one
indivisible chunk. a/b/c leave the tool exactly as it shipped apart from the four note strings.
Next: **P56d**.

### Same session, continued — P56d through P56k BUILT: the five-plan matrix ships (v1.1598 / v11.1598)

User chose to push straight through the indivisible half. **P56 is complete, a through k, uncommitted.**

**What landed.** `plans` is an A/B/C/D/Q map (nulls for the omitted letters, A being the parent
itself) plus one `comparison`; `planB` / `planC` / `analysis` / `convComparison` are gone, and so are
`buildAnalysis`, `buildConvComparison` and `summary.opportunityCost` / `savingsVsWorst`. Children
return empty `text`/`html` rather than rendering output that was always thrown away. Every plan is
priced by `buildPlanCost` walking its OWN action list to one April 15 frame, which is the structural
part: there is no second clock left to disagree with. buildText and buildHtml were rebuilt around
that one table, the Cost Analysis table is deleted, plan sections are collapsible `<details>` with
the winner open, and the driver's `_planData` is now a five-letter map.

**The spec's anchors hit exactly**: A 940 / C 497 star / D 567 / Q 656, run in August OF the tax year.

**One anchor does not, and was not bent to fit.** The brokerage footnote computes **$4,836**
($1,010 of forgone growth plus $3,826 of capital gains tax), not the ~3,169 the phase text predicted.
Both components reproduce the shipped `all_brokerage` row exactly, and 3,169 = 3,826 - 657 looks like
a delta against Q's carry rather than an absolute. Left absolute, flagged for the user.

**Two real defects, both found by the new tests rather than by reading the code.**

1. **A draw date could land on a Saturday.** A draw group with no RMD in it was dated the 15th with
   no business-day nudge at all, and D's December tranche reused a day chosen for a different month.
   The extended sweep printed ten of them (`Sat Aug 15 2026`, `Sun Dec 17 2028`, ...). The old sweep
   had passed for years because no shape it ran produced a voluntary-only draw group; D's split
   produces them constantly. Fixed for every plan: forward to the next business day, backward when
   forward would leave December, since an RMD cannot cross year end.
2. **`fmt$` takes `Math.abs` of everything.** Correct for an amount, wrong for a signed total. A
   $40,000 January conversion drives every total negative, and the winning plan printed as
   `$2,503 ★` - the biggest number on the row looking like the winner. Totals now carry their sign
   and both outputs say a negative total is a net gain. Caught in the browser, not by the suite.

Also: "every plan ties" was wrong late in the year. Q differs by payment mechanism, not by timing, so
the tie now covers the timing plans only and every co-winner is starred.

**Counts and versions.** Suite 34 -> **42**. That number is pinned in TWO files, so both moved
(`TestTiers.EXPECTED` and the `.githooks/README.md` table), plus the tier-2 loader's prose count
325 -> 333. The planner is **v1.1598** (title + three cache busters) and the Optimizer is
**v11.1598** - the Optimizer release is not optional, because `optimizer_tests.js` carries the pinned
counts and its cache buster had to move. That is the same coupling that forced 11.1581 into existence
a day earlier. Changelog entry written for both, no em-dashes, leading with the correctness win and
calling out the letter remap as a BEHAVIOR CHANGE.

**Verified in the browser**, worktree-rooted server (`--root` added to this worktree's gitignored
`launch.json`; without it the preview serves the MAIN checkout). Reported scenario: four columns
A/C/D/Q, B-absence note present, C starred at $497, Q $656, D $755, A $2,121 (that URL is a FUTURE
tax year, so "early" is January; the 940/497/567/656 anchors assume a run in August of the tax year
and are asserted at those months in the suite). With `&ira1RothConversion=40000`: five columns, B
wins at -$2,503, Form W-4R cited in D's tranche step, Q shows 7 estimate steps, `_planData` carries
all five action lists, `beforeprint` opens all five sections and `afterprint` restores exactly the one
that was open. Console clean. Optimizer badge green: **575 (245 in-page + 330 node)**.

Suites: **269 / 42 / 22**. Nothing committed, no PR requested.

## Session 2026-08-18 (continued) — P57: two user reports become 22 verified defects, all fixed

The user opened the planner on the default scenario advanced to 2027 and asked why the header said
"IRA 1 draw: January / conv: January | Effective withhold: January" when Plan C, which draws in
December, was the winner. Then, separately, they called out two sentences: the footnote claiming
voluntary draws "are not free to move", and the brokerage footnote pricing capital gains tax that this
tool never adds to anyone's liability.

**Both were right, and both were bigger than the sentence.** Two adversarially-verified audits
(29 agents / 24 candidates / 12 confirmed, and 19 agents / 10 confirmed, several with sweeps in the
thousands of scenarios) turned them into 22 findings. The user approved all four groups.

### What the diagnosis actually was

`plan.summary` at the top level IS Plan A's (`r.summary === r.plans.A.summary` is literally true).
P56 re-pointed the comparison table and the plan sections at `plans`/`comparison` and left every other
surface reading the parent. So the page opened by describing the early plan while crowning another.

Fixed by REMOVING those values from both headers rather than re-pointing them, which was the audit's
recommendation and the right call: re-pointing relocates wrong values instead of correcting them.
`planARmdMonth` reads the same in all five plans in the divergent case, `plans.D.summary.ira1.rmdMonth`
says September on a December-only plan, `bestSet` can hold two plans with different strategies, and
`comparison` is null when only one plan exists, which is exactly where the old banner's second defect
lived.

### The four that cost real money, each reproduced by hand before being trusted

1. **The Tax Coverage Summary is a pay checklist and it was Plan A's.** On the reported scenario it
   listed $7,000 of conversion withholding and no estimates, while the winner withheld nothing on the
   conversion and owed **seven** estimated payments. Now rendered per plan; the browser confirms Plan
   C's own table lists "Quarterly estimated taxes $4,298 / $2,702 / $7,000".
2. **A gain printed as a cost.** `fmt$` is `Math.abs` by design. The winner line and the badge quoted
   the total through it, so a $15,394 net gain read as a $15,394 cost twelve lines above the table
   printing `-$15,394 star`. My own defect from P56.
3. **"No penalty applies" was decided by the wrong plan.** Gated on Plan A's strategy label; fired in
   4,200 of 11,880 swept scenarios and in 51% of those the winner really carried past-due
   installments. Now gated on the winning plan's own `fedTimelyByWithholding` /
   `stateTimelyByWithholding`, which had to be surfaced from closure locals.
4. **Plan D could be Plan C wearing a different name.** Draws $20,000 against $57,000 of tax and the
   whole plan becomes the December tranche: label promising early spending draws, a note describing an
   early distribution that does not exist, cost identical to C at $1,563, same nine actions. P56c
   guarded the empty end and never guarded the full end. Also my defect.

### The user's two sentences

The footnote's reasoning was inverted. A draw that funds spending has to precede the spending, and the
engine moves those draws to December in B, C, D and Q anyway. **Measured**: Plan A hands the household
$63,000 net in February; Plan C, starred, hands the same $63,000 in December. The real reason the
deferral is not priced is that nothing here knows when the money is spent, so the tool now says that,
and every plan states what it delivers and when in its own dollars. On the reported scenario A, B and C
all read "none. Every dollar of the $50,000 drawn is withheld for tax, so this plan funds no spending",
which was true before and never said.

The brokerage footnote priced $4,957 of capital gains tax that appears exactly once in the whole result
object, in `comparison.brokerage`, and never in any plan's schedule: every plan pays the entered
$57,000 exactly. The footnote now says the gain tax is outside the liability the plans are sized
against, a new `CONCEPT_NOTES` entry "Tax figures are inputs" carries the general rule, and the
estimate steps cite it. The engine already held the principle internally at line ~940 for Plan D, so
this extended a stated rule rather than inventing one. The safe-harbor nuance from the verifier is in
the note: a balance due in April, and an underpayment charge only where the prior-year test is not the
binding one.

### Two more, and one dead heuristic

The input-side live preview was a second model of the same decision, never wired to the engine, whose
verdict disagreed with the priced table in **1,231 of 7,128** swept scenarios, whose coverage
percentage ignored conversion-withholding capacity, and whose opportunity-cost factor read
`new Date()` and never consulted `taxYear`. Because it refreshes on typing and not on Compute it sat
on screen contradicting the results. It now shows inputs and the two rates, labelled "From your
inputs", and leaves the verdict to the table. Related: `yeIraWins` no longer affects plan selection
at all, so it was driving display only.

Safe-harbor wording: California printed "110% of prior-year (high-income filer)" over a figure
computed at 100%, and Maryland printed "110%, MD rule, always" over one that was 90% of the current
year. Each line now describes the multiplier its own figure used, and the AGI-threshold note states
the direction of the error, per the state-NOTE style rule.

**A pre-existing date defect surfaced too**: a draw group with no RMD in it was dated the 15th with no
business-day nudge at all. The sweep had passed for years because no shape it ran produced a
voluntary-only group; Plan D's split produces them constantly.

### Release

Suite 42 -> **51**, reconciled in both pinned homes plus the tier-2 prose count 333 -> 342. **11.1598
was never committed or published, so P56 and P57 are ONE changelog entry at 11.1599** rather than a
release plus a hotfix for defects no user ever saw; the entry separates what is new from what was fixed
from earlier shipped releases. `?runtests` full synchronous run: **587 (245 in-page + 342 node)**,
badge green.

Nothing committed. An adversarial review of the whole uncommitted diff was running when this was
written.

## Session 2026-08-18 (continued) — v11.1599 committed, then P58: withholding on money already moved

**Committed the P56+P57 release** as `6e74f1f`, one commit for one changelog entry (the two phases
interleave in `taxPaymentPlanner.js`, so splitting would have meant hunk surgery for no benefit).
Pre-commit hook ran all three suites green.

### P58, all four items, shipped as v1.159d / v11.159d

The seed was a self-review finding: the cross-IRA optimizer sorted EVERY draw group by month and gave
withholding to the latest first, and that set included groups flagged already taken. Measured, plans
A and C each put **$8,000 of withholding on a June draw the user had already received**, then reported
themselves fully covered.

**A third instance turned up while fixing it, and it was worse.** The gap fill's `convSlots` filter
never checked `ConvDone`, and because the gap fill sizes off the shortfall it could take the entire
conversion: a **$40,000 conversion marked done was assigned $40,000 of withholding**, which would
leave nothing in the Roth. The explicit `ira*RothWithhold: true` override had the same hole.

**The model now.** An action already completed carries exactly what the user reports and nothing else.
Six new optional inputs (`ira1RmdWithheld`, `ira1VolWithheld`, `ira1ConvWithheld` and the IRA 2
equivalents), blank meaning not stated. Blank credits nothing and routes the difference to estimates,
which OVERSTATES what is still owed rather than understating it, and the note says exactly that. The
disclosure renders in every plan now, because every plan depends on the answer; it reads as a fact
when the user supplied a figure and as a warning when it is the planner's assumption.

**Fourth item.** `forceStrategy: 'quarterly'` stacked estimates on top of gap-fill withholding and
paid $64,000 against a $57,000 bill. Forcing quarterly now skips the gap fill, which is what Plan Q
already did. No page control reaches this path, so no shared link was affected.

**Verified in the browser.** `i1rt=1` with no figure gives "no withholding assumed ... OVERSTATES what
you still owe"; adding `i1rw=1600` flips the heading to "Already completed this year" and the note to
"you reported $1,600 withheld ($982 federal + $618 California)". Fields appear only once their
checkbox is ticked and survive a share link.

**GOTCHA worth keeping:** a new numeric input does not load from a URL until its id is added to the
`NUM_FIELDS` allowlist inside `loadFromUrl`. Adding it to `SHORT_TO_LONG` is not enough, and the
symptom is silent: the parameter parses, the page ignores it.

Suite 51 -> **55**, both pinned homes plus the tier-2 prose count 342 -> 346. `?runtests` full
synchronous run green at **591 (245 in-page + 346 node)**. The 22-scenario self-review sweep reports
NO PROBLEMS. In-page changelog list trimmed back to its documented five-entry ceiling (it had drifted
to six before this session).

## Session 2026-08-18 (continued) — PR #181 opened, then P59 from three more user questions

**Network was the blocker, not GitHub.** Diagnosed it properly rather than guessing: `curl -6` to
google returned 200 while `curl -4` returned 000 at the same moment, every working host had an AAAA
record and every failing one was IPv4-only, raw IPv4 addresses all timed out, and the machine held
**169.254.93.53** (APIPA) because DHCPv4 never leased. IPv6 kept working because it uses router
advertisements, not DHCP. github.com publishes no AAAA record, so an IPv6-only host cannot reach it
at all. `www.githubstatus.com` failing too was the tell that it was not a GitHub outage, since that
is Atlassian on CloudFront. The user reset the adapter, DHCP handed out 192.168.1.203, and everything
worked. **`gh auth` was fine all along** - it had been reporting a network failure as an invalid token.

**PR [#181](https://github.com/nightskyguy/retirement_assets/pull/181) opened**, MERGEABLE / CLEAN,
three commits, 9 files, +2,466 / -731. `origin/main` had not moved since #180, so none of the
conflict-prone files collided this time.

### P59: what the comparison still did not say

Three questions from the user, one of which was a check on my own arithmetic.

**1. Which plans need quarterly payments, and how much.** Two rows under "vs best": **Withheld from
IRA** and **Quarterly estimates**, per plan, always summing to the liability. On the reported
scenario: A and B are $57,000 withheld / $0 estimated, C is 50/7, D is 45/12, Q is 0/57.

**2. Which plans meet safe harbor, under which rule.** This turned out to be the most valuable of the
three, because the answer is **not the same for every plan**. New `scheduleSafeHarbor` walks each
plan's own actions under both credit rules: withholding is credited in equal parts across every due
date [IRC 6654(g)], an estimate counts only on the day it is paid. Run mid-year, after April and June
have passed, the plans split: **A and B clear safe harbor, C, D and Q miss federal at Q1** by $200,
$967 and $7,875 respectively (Q misses California by $3,450 too). The binding rule is named per
jurisdiction, and they differ on the same run: federal is 90% of this year ($31,500) while California
is last year in full ($11,500).

**A defect in my first draft, caught before showing it.** Past-due estimates keep their statutory
date and are marked PAST DUE, so crediting them at that date let a genuinely late plan report itself
safe. They are now credited at the earliest date the money could actually move, which is today.
Without that fix every plan read "met" and the feature would have been decorative.

**Consequence worth stating:** ranking is by first-year cost, which does not price an underpayment
penalty, so the cheapest plan can be the one that misses. The winner line and a header badge now say
so. On the reported scenario Plan C wins at $1,141 **and** misses federal safe harbor by $200.

**3. The user's question about the quarterly schedule was a check on my arithmetic, and it holds.**
The cost model prices each payment from its real due date, not a uniform quarter: the four federal
payments get 12, 10, 7 and 3 months of carry to the April 15 frame, California's three get 12, 10 and
3. Installments are equal at 25% while the periods are 3, 2, 3 and 4 months long, which is the
statute rather than an approximation. Their weighted averages are exactly the 8 and 8.5 months the
old hardcoded `OC_FACTOR.Q_FED` and `ocWeightedMonths` constants carried, so the action-based model
reproduces them from the dates. Business-day shifting applies (Jan 15 2028 is a Saturday, so the
model prices the 17th).

Suite 55 -> **58**, both pinned homes plus the tier-2 prose count 346 -> 349. v1.159f / v11.159f.
The 22-scenario sweep still reports NO PROBLEMS. Browser-verified both branches: a future tax year
shows every plan meeting safe harbor (nothing is past due yet), the current tax year shows
met/met/MISSED/MISSED/MISSED with the badge and the per-plan shortfalls.

### Same session — P60: which safe-harbor bar was cleared (items 1 and 2 of five)

**Item 1, the sad day.** "met" said nothing about which bar it cleared, and meeting 100% of last year
when 110% was required is the expensive way to be wrong. The verdict row now names it:
`Safe harbor (110%/90%)`, federal and state shown separately when they differ, with the per-plan
lines and the detail block carrying the same tag.

**Item 2, and it folded into item 1.** The 110% bar turns on PRIOR-year AGI over $150,000, which this
planner is never given. It used to fall back to 100% unless the high-income box was ticked. It now
sums the income already entered (`grossIncome`, taxPaymentPlanner.js:908, which is draws +
conversions + SS + pension + interest + dividends + gains) and applies 110% when that clears the
threshold. Measured: $180,000 of income with $20,000 of prior-year federal tax moves the requirement
from $20,000 to $22,000.

**Both directions are stated, per the state-NOTE style rule.** Inferring 110% from this year when
last year was quieter overstates the requirement; resting on 100% when last year was above the
threshold understates it, so a 100% verdict carries a `*` and a line saying the planner cannot check.

**The user's "assume from this year's income" for a missing prior year is a no-op, and the honest
answer was to say so.** The requirement is the LESSER of 90% of this year and 100% or 110% of last
year. Substituting this year for last year gives min(0.90x, 1.00x) = 0.90x either way, so the answer
is unchanged. What it CAN do is overstate, when last year was genuinely lower. The page now says the
90% fallback can only be too high and asks for the real figure instead of inventing one.

**Two defects in my own first draft, both caught before showing it.** The tag repeated in all five
cells overflowed the 11-character column and ran the row together (`met 90%/100%*met 90%/100%*...`);
it belongs in the row LABEL, since the test is the same taxpayer for every plan. And the test fixture
I wrote to prove the inference summed to exactly $140,000, just under the threshold, so it proved
nothing until raised to $170,000.

Suite 58 -> **60**, both pinned homes plus the tier-2 prose count 349 -> 351. v1.15a0 / v11.15a0.
Browser-verified: `Safe harbor (110%/90%)`, `The test: federal $22,000 (110% of last year),
California $19,800 (90% of this year)`, and the inference explained from $180,000 of income.

Items 3, 4 and 5 (generic state safe harbor, clickable rule citations, IncomeTaxPlanner cohesion) are
out with a research workflow and not yet answered.

### Same session — items 3, 4 and 5: research back, two shipped, one deferred

A 7-agent workflow researched all three with adversarial verification. Two of the three proposals
were marked UNSOUND by their verifier and the corrections mattered, which is the point of the pass.

**Item 5, the IncomeTaxPlanner handoff. SHIPPED, and it was the worst of the three.** Verified
myself before touching code: `standalone/RetirementTaxPlanner.html` does not exist, so the button has
404'd since the tools moved. But the important half is that it sent **no tax figures at all**, and the
planner takes tax as an INPUT while its page ships demo defaults. Reproduced in the browser with only
the params the button sends: the planner filled in **$35,000 federal, $22,000 state, a $15,000 RMD
and a $10,000 conversion** and priced a $57,000 plan with a winner. **A path-only fix would have been
strictly worse than the dead button**, which is why both moved in one commit.

Also fixed: `pinnedIncome - cfg.ssIncome` subtracted Social Security from an axis that never included
it (`calcAt(ordInc)` takes ordinary income, `ssIncome` rides separately in `cfg`).

Now sends the tax this page computed (income tax only, IRMAA excluded as a premium rather than
withholdable tax), explicit zeros for everything the planner would otherwise invent, and empty
prior-year fields so `readNum(...) || null` yields null and the planner says "not supplied". Verified
end to end: $6,501 priced, RMD and conversion $0, prior-year fallback honest. Refuses with a message
when nothing is pinned, guarded at click time because `renderSummary()` is not on every pin path.

**Item 4, clickable citations. SHIPPED.** `linkifyCites` at HTML render time only, because the marker
feeds three sinks and two of them cannot carry markup: the text tab prints notes verbatim and the
.ics export copies them into DESCRIPTION. The verifier's correction was real - `renderActionList` has
three branches, not one, so a naive patch would have linkified a third of the markers and left the
rest looking broken. Nine emit sites in total. 61 links on a typical plan, every href resolving,
`plan.text` byte-identical. Delegated listener on `#plan-html` walks ancestor `<details>` open before
scrolling, since a browser will not open a closed disclosure to reach an anchor.

**GOTCHA, again, and it cost a browser round trip:** node showed 58 links while the browser showed
zero, because the JS changed and the `?v=` cache buster had not. Bump it in the same edit.

**Item 3, generic state safe harbor. DEFERRED as P63, with two live bugs recorded.** The shape is
~200 lines; the facts behind it are 47 jurisdictions x 8 fields, about 376 cited figures off state
underpayment forms. 45 of 48 taxing entries currently carry the federal rule as an unresearched
default. Two separable bugs: `withholdingCreditedProRata` is never consulted, so AL and AS return
identical verdicts; and the state 110% gate compares a TAX amount against an AGI threshold, so it
never fires. **The second must not be fixed alone** - applied in isolation it flips 46 unresearched
states from understating-and-disclosed to overstating-and-undisclosed, with the suite still green.

Suite 60 -> **61**. v1.15a1 / v11.15a1. Same-hour collision with 15a0, so incremented, matching the
1598 -> 1599 precedent earlier today.

### Same session — the star moved to the column heading (v11.15a2)

User report: the star on the "Total first-year cost" line messed with the formatting. It did. The
star shared a cell with a right-aligned dollar figure, so that one row ran two characters wider than
every other row and the money column stopped lining up down the page.

Moved to the column heading in both renderers, so the table reads `Plan C★` and every figure below it
stays in its column. The tie case gets a star on each winning heading, which is also clearer than two
marked cells on one row. Footnote reworded from "★ = lowest first-year cost" to "★ marks the column
with the lowest first-year cost".

No number changed. Suite stays at 61; no test pinned the star's position (the only `★` in the suite
is inside a comment describing the old sign defect). v1.15a2 / v11.15a2, third same-hour increment of
the day.

## Session 2026-08-19 (sixteenth) — `/plan` re-entry, P63a researched then set aside, P64 opened

Branch `worktrees/planning-with-files-02d4ce` in worktree `context-e73361`, clean and **0/0 against
`origin/main`** at `4c3e98c`. Everything through PR #181 is merged: P56/P57/P58, the clickable
citations, the IncomeTaxPlanner handoff repair, the star move and the changelog consolidation. Suites
269 / 61 / 22 on disk, matching `TestTiers.EXPECTED`.

### P63a researched, then set aside by the user

Asked which shape P63a should take, honour the flag or delete it. The reading behind the question:
`withholdingCreditedProRata` is consulted at exactly two sites and **both are prose** (~1409, ~1787);
neither `withholdingCoversSchedule` nor `scheduleSafeHarbor` looks at it, so it has never moved a
number. It is live-false in **one** entry, `AS` - `_noTax` also sets false but `hasIncomeTax: false`
short-circuits every consumer. Honouring it is not localized, because `stateTimelyByWithholding` is
computed at step 10b, before the action list that would carry the dates exists. And ~1409's caveat has
an inverted premise: it says the planner assumes NO pro-rata credit when the math assumes there is one.
Zero test coverage of any of it. All of that is now recorded in the P63a bullet so it is not re-derived.

**The user redirected.** Not concerned about American Samoa; concerned about properly reducing state
and local taxes from federal returns, likely needing a "Parcel/Real Estate + Other local taxes" input
with an indicator for whether it is inflation-indexed, and wanting **an evaluation of how much the
needle moves** before deciding.

### P64 opened, and the gap is narrower and sharper than expected

`taxengine.js` already does SALT completely and correctly - `min(stateTax + propTax, cap)`, itemize vs
standard, the OBBBA $40k cap, the 30c/$1 phase-down above $500k MAGI, the 2030 revert to $10k. **The
parameter is just never passed.** Zero of the 14 `calculateTaxes` call sites in `optimizer_core.js`
carry `propTax`, nor does `Retirement_Projection.html` or `standalone/irmaa_and_rmds.html`. Only
`standalone/IncomeTaxPlanner.html` does.

This is the same defect as `obbaOn`/`saltHigh`, which this repo already found and fixed once and wrote
a guard test for - a guard test that does not cover `propTax`. Extending that assertion, rather than
writing a new one, is P64b.

The user's own framing set the shape: the cap dies after 2029, so the deductible window is four years
and the honest question is whether it moves a decision. **Study first, build contingent.** The reason
it might still matter is the phase-down: a conversion lifting MAGI $400k -> $600k erases up to $30,000
of deduction, roughly 4.8 points of extra effective marginal rate, and at `propTax: 0` almost nobody
itemizes so that cliff never fires today. Growth is three-way (CPI / flat / custom %) rather than a
checkbox, because Prop 13's 2% cap and a reassessment-heavy state are not the same plan and the SALT
cap turns the difference into a step function.

Also flagged for verification, not fixed: `capHigh` carries a comment claiming 1%/yr indexation that
the code does not implement, and `phaseoutThreshold` likely indexes the same way. Unlike `propTax: 0`
those are not behaviour-neutral, so they ship separately.

### Phase 0 done

`task_plan.md` header resynced (it still claimed PR #180 and two uncommitted commits), `P63` given the
index row it never had, P63a's research recorded, `P64` written with a-e and indexed at O0. LINE-30
marker re-verified at exactly line 30 after the edits; the NOW table still fits the `head -50` window.
No code touched, no version bump, no test count change.

### Same session — P64a/b/c/f built, measured, and the measurement says stop (v11.15b6)

**Threaded the parameter.** `propTax` now reaches all **11** `calculateTaxes` call sites in
`optimizer_core.js` (the plan said 14; that was a grep counting three comment lines). New
`propTaxFor()` next to `taxCreepFactor`, `yr.propTax` computed beside `yr.obbaOn`/`yr.saltHigh`,
`sim.propTaxBaseYear` so a plan starting in the future inflates over the gap the way spendGoal does.
Growth is three-way per the user: inflation / flat / custom rate. Uses `inputs.inflation`, not
`inputs.cpi` - cpi here indexes brackets and IRMAA, and a property assessment is a household price.

**Byte-identical at the default**, verified by diffing a 4-scenario full-log capture taken before the
change against the same capture after. That was the acceptance gate and it held.

**Extended the existing guard test rather than adding a parallel one**, since `propTax` failed exactly
the way `obbaOn`/`saltHigh` did. Proved it bites: dropping `propTax` from one of the 11 sites turns it
red, restoring it turns it green. Two new tests besides - one pinning that property tax lowers federal
tax 2026-2029 and stops mattering in 2030, one pinning that the three growth modes really are three
different plans. Suite 269 -> **271**, reconciled in `TestTiers.EXPECTED` and `.githooks/README.md`.

**GOTCHA that cost two runs:** rates in this engine are FRACTIONS. The first harness passed
`cpi: 2.5` and `stratRate: 24`, which is 250% inflation and a 2400% bracket target; the first produced
plausible-looking nonsense and the second produced NaN everywhere. `optimizer_ui.js` divides every
percent field by 100 before it reaches `simulate`, so a harness has to as well.

**A real bug fell out of the first failing test (P64f).** The new test asserted property tax reduces
federal tax in each of 2026-2029 and it failed on 2029 alone. Cause: `taxengine.js` had
`saltBaseCap = obbaOn ? (saltHigh ? capHigh : capLow) : capLow`, and both callers derive `obbaOn` from
the SENIOR_DED sunset (2028) while `saltHigh` tracks the SALT sunset (2029) - so the $40k cap died a
year early and `saltHigh` was dead code in 2029. `IncomeTaxPlanner.html` even documents the intended
behaviour in a comment two lines above the call that defeated it. `saltHigh` is now the sole gate on
the cap and its phase-down. Not behaviour-neutral, and it reaches IncomeTaxPlanner, which has had a
property-tax input all along.

**The measurement, which is the deliverable.** Numbers in `findings.md`. Upper bound is about **$4,000
of lifetime federal tax for any household**, ever: the gain is only capped-SALT minus the standard
deduction, for four years. Measured max was **-$2,179** lifetime tax and **+$18,810** of final
after-tax net worth on $32M - **0.06%**. It saturates at the cap, it is exactly zero from 2030, and it
shrinks every year inside the window because the standard deduction is indexed and the cap is not.
**No decision moved**: the best bracket-fill target stayed 12% in 17 of 18 cells, the one flip being a
0.01% margin that reversed at the next value. The phase-down-cliff hypothesis that motivated the study
is **refuted** - it is 0.6% of the cost of the decision it was supposed to distort. And the
pre-measurement guess that TX and FL would be the sweet spot was backwards: with no state income tax,
property tax alone has to clear the entire standard deduction, so they show zero at $30,000.

Shipped v11.15b6: title, tier-2 loader `?v=`, `const V`, plus the `?v=` on `taxengine.js` and
`optimizer_core.js` in all four pages that load them. Changelog entry in both homes. Suites
271 / 61 / 22, browser badge green at **607** (248 in-page + 359 node), console clean apart from the
unrelated Cloudflare RUM CORS error. **Checkpoint put to the user: the input itself is not justified
by these numbers.**

### Same session — P64d and P64e folded in, and P64d moved a decision (v11.15b7)

**P64d: both suspected constant defects were real.** `capHigh` and `phaseoutThreshold` are 2025 BASE
figures that the statute steps up **1% per year applied to the prior year's figure** through 2029, so
2026 is $40,400 / $505,000. The code froze both, with a comment on the cap claiming the indexing that
nothing performed and no comment at all on the threshold - so the CURRENT tax year was already priced
$400 low on the cap and $5,000 low on the threshold. Now indexed, clamped at the sunset, driven by a
new `taxYear` param that both callers pass and the guard test asserts. Research notes and the year
table are in `findings.md`; sources are secondary summaries of P.L. 119-21, not the statute.

**And it moved a real decision, which P64c had not.** The `bestTimeLimitedConversion` fixture went red:
$250,000/yr for 5 years became $300,000/yr for 4. Checked before touching the golden values, because a
flipped optimum is usually a flat optimum and not worth pinning. It is not flat here - the new plan
scores **167,787 vs 166,002**, and under the old frozen threshold the new plan scored only **140,173**.
The threshold governs how much of the elevated cap survives a conversion that lifts MAGI past it, and
this CA fixture converts hard enough to sit in that band. Golden values updated with the reasoning
inline. So the honest summary is: *property tax* moves nothing, *cap indexation* can move the plan.

**P64e shipped as URL entry only**, which is what the user chose at the checkpoint: `?ptx=` amount,
`?ptxm=inflation|flat|custom`, `?ptxr=` percent. Read once at load, re-emitted by `buildShareURL` so a
shared link does not silently drop a figure the recipient has no field to re-enter. No control on the
page, because the measurement does not earn one. **GOTCHA:** the block was first written next to the
share-URL map at the bottom of `optimizer_ui.js` while `getInputs()` at line ~419 reads it - a TDZ
hazard that happens to work only because `getInputs` runs after evaluation. Moved above `getInputs`.

**Verified end to end in the browser**, worktree-rooted server: `?s=TX&ptx=60000&ptxm=custom&ptxr=2`
gives `getInputs()` 60000 / custom / 0.02, the engine sees propTax 60000 at taxYear 2026 rising to
96,506 at 2050 (60000 x 1.02^24 = 96,506), and the share URL round-trips all three. Badge green,
console clean apart from the unrelated Cloudflare RUM CORS error.

**Found in passing, NOT fixed, logged as P64g and spawned as a task:** `Retirement_Projection.html`
passes none of `obbaOn`, `saltHigh`, `propTax`, `taxYear`, so it prices the pre-OBBBA world entirely.
Same defect family, different tool, not behaviour-neutral, so it gets its own commit.

Suites **272 / 61 / 22**, reconciled in both pinned homes. v11.15b7.

### Same session — the user checked the SALT premise, and was half right in a useful way

User: "the 40k SALT increment (or the 10k SALT cap) are not exclusive to standard deduction, but
additive to it". Checked the law and the code rather than answering from memory. **SALT is not
additive** - it is Schedule A, strictly either/or. But the **senior deduction IS**, sitting above the
line on Schedule 1-A and applying on either path, which is what the intuition was actually tracking.
The engine already does both right: `useItemized ? saltItemized : federalStdDeduction`, then
`federalDeduction += seniorDeduction` unconditionally.

**The question exposed a real gap anyway.** `calculateTaxes` treats SALT as the ONLY itemized
deduction - no mortgage, no charitable, no medical over the 7.5% floor - so it asks whether SALT alone
beats the standard deduction, a harder bar than a real filer faces. **That qualifies the P64c
headline**: ">=$4k, no decision moved" is true of this model, which under-itemizes, not necessarily of
a filer with a full Schedule A.

User narrowed the follow-up sharply and correctly: mortgage is unlikely for retirees, charitable is
mostly routed around Schedule A by QCDs, so **medical above 7.5% of AGI is the piece that likely
qualifies**. One refinement recorded in findings: a QCD really does bypass Schedule A (income
exclusion, already modelled in `computeAnnualQCDs`), but **a gift of appreciated stock does not** - it
is an itemized deduction at FMV under the 30%-of-AGI limit, and still matters below QCD age or above
the annual QCD limit.

Logged as **P65** (a medical, b charitable, c mortgage), O2, NOT scoped. The note that matters for
whoever picks it up: retiree medical is lumpy, a flat annual figure would be wrong in both directions,
so it belongs with Lumpy Spending (P42) rather than as a scalar - and a big medical year is usually a
big withdrawal year, so AGI and the 7.5% floor rise together and the net needs measuring, not guessing.

### Same session — code review on PR #182, one real bug found (v11.15c8)

User posted review comments on the PR (six inline, all on `optimizer_changelog.md`) and said "Changes
requested." Pulled them via `gh api repos/.../pulls/182/comments`.

**Five were changelog wording**, and all fair: "anyone who itemizes" overstated what the tool does
(it only ever tests SALT against the standard deduction - no mortgage, no charitable, no medical - so
"itemizes" implied a generality that does not exist, and directly echoes the P65 finding from
yesterday); "the cap" was ambiguous and SALT was never spelled out; the rounding-uncertainty paragraph
was judged unneeded detail for end users; "The Optimizer never handed it that figure..." was internal
implementation history, not user-facing information; and "the amount" needed to say explicitly that
it is PROPERTY and OTHER LOCAL taxes being added, since state tax is already supplied elsewhere and
must not be double-entered. Rewrote the three 11.15b7 sections in both `optimizer_changelog.md` and
the `retirement_optimizer.html` banner `<li>` to fix all five, and in doing so found a leftover
duplicate sentence from an earlier same-session sed edit ("Measurement is the reason... Specifically,
measurement found that\nthe whole effect is small and short-lived:...") - fixed as part of the same
rewrite.

**The sixth was a real bug**, asked as an editor's question: "are these values also being SAVED in
the internal memory or .js?" Checked rather than assumed. `saveScenario()` calls `getInputs()`, which
spreads in the property-tax fields, so YES they were captured into the localStorage JSON on save. But
`applyScenario()` restores every field via `document.getElementById(key)`, and `propTax` /
`propTaxGrowthMode` / `propTaxGrowthRate` have no DOM element - they are URL-only. So the value was
saved correctly and then **silently dropped on every load**, with no warning, which is worse than
never supporting it: the user believes their saved scenario carries it and it quietly does not.

Fixed by converting the frozen `URL_PROP_TAX` const into a mutable `PROP_TAX_STATE`, read from the URL
once at load same as before, but now also writable. `applyScenario()` gained a special case - the same
pattern the file already uses for `qcdMode`/`stratIRMAATier`, which also have no direct DOM element -
that restores it from `data.propTax` when the key is present, and otherwise leaves the current value
alone, matching the convention every other field in that loop already follows. `getInputs()` and
`buildShareURL()` both now read the mutable slot instead of the frozen const.

**Verified in the browser, not just read**, since `optimizer_ui.js` has no node harness (DOM-only,
untouched by the three node suites - confirmed unaffected, still 272/61/22 green). Loaded
`?s=TX&ptx=60000&ptxm=custom&ptxr=2`, called `saveScenario()` programmatically, reloaded the page with
a PLAIN url (no `?ptx` - exactly the state that used to lose the value), called `applyScenario()` with
the saved blob, and confirmed `getInputs()` came back 60000/custom/0.02 and `buildShareURL()` carried
`ptx=60000&ptxm=custom&ptxr=2`. Before the fix this would have silently reverted to 0. Badge green at
600, console clean apart from the same unrelated Cloudflare RUM CORS error as every prior check.

**GOTCHA, port collision.** `~/.claude/preview-servers.json` showed two entries claiming 8767
simultaneously and `curl` kept answering with the OTHER worktree's stale 11.15a2 title even after
starting a fresh worktree-rooted server there - looks like Windows' looser `SO_REUSEADDR` semantics
let a second process bind a port a live listener already holds, so `_free()`'s probe-then-release
check in `serve.py` is not reliable proof of exclusivity on this platform. Fixed by forcing an explicit
`PORT=8791` rather than trusting the fallback scan.

New changelog entry `11.15c8` (own anchor, own `<li>`, since it is a genuine behavior fix on top of an
already-versioned release) rather than folding into 11.15b7's entry; the 11.15b7 prose itself was
edited in place since it was inaccurate, not superseded. `taxengine.js`/`optimizer_core.js` untouched
this round, so only `optimizer_ui.js`'s cache buster and the tier-2 `const V` moved.


---

## Session: 2026-08-20 (worktree readme-review-updates-c9df11) - plan resync, no code

`/plan` invoked with no task. Worktree is clean and level with `main` = `0b4d5b5`; nothing in flight.
The planning files had drifted three ways against reality and this session only closed that gap - no
product file was touched.

**What had drifted.** `task_plan.md` still opened "As of 2026-08-19, `main` = `4c3e98c`, everything
through PR #181", and `progress.md` ended at the P64/SALT session. Since then **PR #182, #183 and
#184** all merged. Corrected, all measured rather than assumed:

- **`P64g` is DONE**, shipped in **PR #184** - verified by reading the file, not the merge message:
  `Retirement_Projection.html:1278-1303` now derives `obbaOn`/`saltHigh` from
  `TAXData.OBBBA.*.sunsetYear` per projection year and passes an inflated `propTax` from its own
  `#propTax` slider. That was P64's last open item, so **P64 is COMPLETE** and its index row is struck.
- **The IRMAA forward-threshold work had no phase ID at all.** It shipped in #182/#183 at
  **v11.15cf** with a full changelog entry, three checked-in harnesses and a merge post-mortem, and
  was invisible from the plan. Written up as new phase **P66** (a-d, all complete) and placed after
  P65 so the sections stay in numeric order.
- **Test counts moved 272 -> 280** core (`TestTiers.EXPECTED`, `optimizer_tests.js:2263`); TPP 61 and
  doclinks 22 unchanged, `slowInCore` still 3. Live version is **v11.15cf**.

**The NOW table kept its 7 rows.** P64's row was replaced by **P65** (Schedule A beyond SALT) rather
than left short, since P65 is P64's direct successor and was already in the index at O2. O0/O1 did
not change: P32, P35, P51, P30, P19, P34 are all still open exactly as before.

**LINE-30 BOUNDARY respected.** The header rewrite was done line-neutrally in Python (8 lines
replaced, 8 written) and the marker was asserted to still be on line 30 both before and after the
write; the file is LF and the em-dash at offset 34 was checked by codepoint (`0x2014`) afterwards,
since a careless rewrite here silently drops a table row out of the hook's `head -30` window.

**One memory correction.** The `project_readme_audit_followup` memory claims P48's evidence is
"preserved in-repo at `.planning/retirement-optimizer/readme_caveats_findings.md`". **That file does
not exist in this worktree** (`find` for `*caveat*` returns nothing) and `task_plan.md:2209` says the
audit session "never wrote it into this worktree". The three-cluster summary in the P48 section is
therefore the only surviving record: 16 limitations, 13 unmodeled states, ~10 undocumented features.

**P32d scoped, same session.** User chose `P32d` (measure Q2) from the four options. Scoping turned up
the blocker by running the harness rather than reading it: `node .test_harnesses/brokerage_harness.js`
prints `SKIPPED: engine does not expose totals.tpBrokIters` - `q2()` was written before the arms
shipped and guessed all three counter names wrong, so the question has been inert since v11.1582.
Second trap found by reading the loop: the Capped counter false-positives at the bounded cap of 6,
because the convergence test sits at the top of the loop body. Both written to findings.md
(2026-08-21) and turned into `P32d-1` .. `P32d-5` in task_plan. Index rows now point at `P32d-1`, not
a general "measure Q2". No code written yet.

**P32d-1/2/3 built and run, same session.** User approved 1-3. `q2()` repaired (it had been probing
counter names that never existed, printing SKIPPED since v11.1582), capped and stalled split into
separate columns, and the grid widened to basis x state x dividend = **4,950 runs**, ~0.7ms each.

**Result: zero capped years in 3,960 armed runs, and `bounded` is identical to `unbounded` on every
counter.** That identity is the proof - bounded caps at 6 passes, unbounded at 200, so if any year
had wanted a 7th they would differ. The cap-gains spiral asserted at `optimizer_core.js:2044` as the
reason for the exclusion does not exist on this grid. Prediction P5 scores RIGHT. **`P32d-4` is
therefore moot rather than skipped** - there is no capped year to re-check against the unbounded arm -
and it is marked that way with the reasoning kept, in case a future grid produces one.

**The finding worth more than the spiral answer: the two arms are not one decision.**
`thirdPassBrokerage` moves 11 rows (9 better), every one of them a `minlimit` row - the exact IRMAA
Ceiling stranding the phase opened with. `forcedIRAAllowBrokerage` moves 97, **88 worse**, the worst
going 24 funded years to 5 while erasing $2.2M of forced IRA and RAISING final net worth $1.3M. Judged
on the tax column or the wealth column alone that reads as a $1.3M win. The funded-years column beside
it is what makes it legible, which is why d-2 put it there before the grid ran rather than after.

Also recorded: the winning third-pass rows fund more years while raising total shortfall and lowering
final net worth, so P32h has a genuine trade-off to settle, not a free win. And a correction to my own
scoping note - I repeated "zero growth" about `CAP_BASE`, which actually runs growth 0.05; only the
zero dividend rate was right.

Harness only (`.test_harnesses/brokerage_harness.js` is node-only, loaded by no page and by none of
the three suites). Suites re-run anyway: **280 / 61 / 22**, unchanged. No shipped file touched, so no
version bump and no changelog entry - correct per the repo's rules, since nothing user-facing moved.

**Arm rename + `P32d-5`, same session.** User asked for `fib` -> `brokFirst` (it read as Fibonacci and
hid which of the two exclusions was under test) and for the write-up. Both done; `P32d` is now
COMPLETE.

**The rename surfaced a scoring bug worth more than the rename.** P6 was being scored on the POOLED
funded-year total, which let `brokFirst` - an arm P6 never mentions - decide the verdict and print
"MIXED". P6's text names the third-pass arm specifically. Scored per arm it is **RIGHT** (9 better,
2 worse), with `brokFirst`'s 9/88 record printed beside it as the separate decision it is.

**New result found while writing up, not just re-reported.** `brokFirst`'s 9 winning cells are
**set-identical** to `bounded`'s 9 - checked as a Python set comparison over the printed table, not
by eye. So `brokFirst` buys nothing the third-pass arm does not already deliver and pays 88 funded-year
losses for it: on this metric it is **dominated**, not merely riskier. That is a stronger statement
than "the two arms disagree" and it goes straight into P32h.

Written: a full Q2 section in `.test_harnesses/P32_RESULTS.md` (with the title line, run header,
predictions table, Coverage and Scope Limits sections all updated - Q2 crosses basis/state/dividend,
so the file's old "single state, 50% basis" limits had to be scoped to Q1 rather than left standing);
`.test_harnesses/README.md` now records that q2 printed SKIPPED from v11.1582 to 2026-08-21 and says
to check a probe's counter names against the engine before believing a question is blocked.

Still harness + docs only. No shipped file touched, no version bump, no changelog. `P32g` (record the
aggregate-basis modeling ceiling as a README limitation) and `P32h` (the ship decision) are what
remain in P32.

**P32g + P32h, same session. And a real error of my own, caught and corrected.**

**The correction first, because it changed the recommendation.** Probing the sharpest cell per-year
before writing any advice showed I had read `totals.shortfall` backwards. It accumulates
`Math.min(0, netIncome - spendGoal)` (`optimizer_core.js:2310`, `:2726`), so it is NEGATIVE or zero
and a delta of `+$68,786` is that much previously unpaid spending **now paid**, not new shortfall.
The engine confirms it three ways: lifetime spend rises by exactly $68,786, unfunded dollars go
$68,792 -> $6, and `failedInYear` goes from ten years to one. So the "unresolved trade-off" I wrote
into P32_RESULTS.md and findings.md that morning was not unresolved and not a trade-off in the
direction stated. Corrected in both files with the mechanism named, and the harness now prints
unfunded dollars as positive magnitudes `off -> armed` so the direction is on the page. Also added a
per-arm unfunded-dollars table, because the pooled version of that number was misleading in exactly
the way the pooled funded-year count had been.

**With the sign right, the arms separate decisively:**

| arm | $ newly funded | $ newly unfunded |
|---|---|---|
| `bounded` / `unbounded` | $372,455 | **$1,711** (385 runs, ~$4 each) |
| `brokFirst` | $372,455 | **$27,860,186** |

218:1 for the third-pass arm. `brokFirst` is dominated - identical wins, four orders of magnitude
more damage.

**P32g DONE.** New README limitation after the §1014 item: basis is one aggregate number consumed
proportionally (`calculateBrokerageWithdrawal`, `optimizer_core.js:304-321` - re-verified, the old
note's line numbers had rotted), so no specific-ID or HIFO. Direction stated as the section's other
items do: the tool **overstates** cap-gains tax on Brokerage withdrawals for anyone who selects
lots, so such a household should read it as too **pessimistic** about Brokerage draws. Also names
why lot-level tax-loss harvesting is absent. doclinks 22/22 still green.

**P32h DONE as a decision record**, split into five calls rather than the one undifferentiated
"decision" it had been - which is precisely how the two Brokerage arms nearly got treated as one
thing. Four are settled by evidence: `brokFirst` never ships; `cycleLTCGTarget` keeps its gate and
0.15; `cycleCoexist` stays research-only; the `cycleHarvestMode` default flip gets its own item
rather than being bundled. The fifth, promoting `thirdPassBrokerage: 'bounded'` to the default, is
recommended but is a **USER CALL** (`P32h-1`) because it moves every saved scenario and shared link
on a `minlimit` plan. The cost of shipping it is written out in the plan so the estimate is not a
surprise later.

**P32h-2 SHIPPED, v11.15e3. P32 is complete.** User said ship, so `thirdPassBrokerage` default went
`'off'` -> `'bounded'`: the third pass may now draw Brokerage after Cash and before the Roth fallback.

**Five tests moved, every one of them for a reason worth reading.** The best of them is the old
tripwire, `P32 (not fixed here): minlimit strands spending with Brokerage still funded`, which had
survived five separate changes over months while its comment accumulated a history of each failed
attempt. It asserted the defect was PRESENT, count 10. It now asserts **0**, keeps that whole history
verbatim, and gains a `thirdPassBrokerage: 'off'` control that must still reproduce all ten stranded
years at the same pinned dollar amounts - because otherwise a future refactor could zero the count for
some unrelated reason and still pass. It also asserts the PRICE now (funded up, spend up, finalNW
DOWN), so nobody can later read this change as free.

The subtlest was `brokerageFirst spends Brokerage before forcing IRA`, failing `131,780 -> 131,780`.
That looks like a regression and is an **overlap**: the shipped third pass already spends the
Brokerage that arm wanted to spend. Pinning `thirdPassBrokerage: 'off'` isolates the backstop, which
is all the test was ever measuring. Re-pinning the number instead would have quietly destroyed the
test.

**Test counts did NOT move** (280 / 61 / 22, slowInCore 3) - checked, not assumed - so
`TestTiers.EXPECTED` and `.githooks/README.md` needed no edit this time.

**The page's own test caught a defect in my changelog entry.** I wrote `<b>Behavior change:</b>`, and
a tier-1 test asserts every `<b>` in the changelog list is a version stamp sitting in its own `<li>`.
Badge went RED at 610/611 and I had to chase it through `TIER1_RESULT` and a console capture to find
it, since the failure text is not in the DOM. Changed to `<strong>`. Precisely what that test is for,
and a good argument for always loading the page rather than trusting three green node suites.

**Verified in the browser after the fix:** tier-1 248/0, core 280, TPP 61, doclinks 22, slow 3,
**Documentation 🟢**, console clean apart from the usual unrelated Cloudflare RUM CORS error. Server
run on an explicit `PORT=8793` with `--root` on the worktree, per the standing GOTCHA about port
collisions serving the MAIN checkout - confirmed by curl'ing the title before trusting anything.

Version bumped at the three sites this release actually touches: the `<title>`,
`optimizer_core.js?v=`, and the tier-2 loader's own `const V`. `taxengine.js`, `optimizer_ui.js` and
the CSS were deliberately left at their old tokens because none of them changed.

## Session: 2026-08-22 (worktree readme-review-updates-c9df11) - `/plan` re-entry, context restore

`/plan` invoked with no task. Planning files already exist under `.planning/retirement-optimizer/`
with `.planning/.active_plan` pointing at it; no root-level `task_plan.md` was created, since that
would have forked the plan.

**State measured, not assumed.** `git rev-parse --abbrev-ref HEAD` =
`worktrees/planning-with-files-2a1f63`; `git rev-list --count origin/main..HEAD` = 0, working tree
clean, `main` = `721653d` (Merge PR #185). `retirement_optimizer.html` `<title>` reads **11.15e3**.

**One drift closed.** The header still called v11.15e3 "P32 complete, unreleased" - it merged in
**PR #185**. Header rewritten line-neutrally (3 lines out, 3 in) with the LINE-30 BOUNDARY marker
asserted before and after the write, and the P32 NOW paragraph now names the PR.

Nothing else had drifted: O0/O1 rows (P35, P36, P51, P30, P19, P34, P65) are unchanged and P32's
index row was already struck. No product file touched, so no version bump and no changelog entry.

## Session 2026-08-22 (continued) - P67a: the "Optimize for" goal now picks the columns

User asked for the Optimizer's goal selector to control which columns show, giving three examples:
Roth Conversion Effectiveness should show the total Roth balance, Spend Goal and Yrs Funded should
leave the table, Total RMDs matters mainly under Avoiding Widow & RMD Tax. Then, answering the
Δ-columns question, asked for something larger: a second **rendering mode** where every numeric column
reads as a delta from the pinned row. Split into PR A (shipped) and PR B (P67b, not started).

**Three explorations first, and the findings shaped everything.** The table is a CSS grid of flat
`<div>`s, not a `<table>`; all 21 columns come from ONE descriptor array, `getOptimizerColumns()`;
**no test anywhere asserts on its columns** and no CSS targets them (`nth-child` appears nowhere in
the repo). So the mechanism was a `filter()`, not a rewrite. What it was NOT free of was index
arithmetic: four separate hazards, each dormant only because no column had ever been optional.

**The fourth hazard was the one nobody listed and the one that mattered.** A sort column that no
longer exists left `col === undefined`, skipped the sort block, and rendered rows in **build order
under a header carrying no arrow**. Not an error, not a blank table - just quietly unsorted. Now
`normalizeSortState()` at the single render choke point. Verified by hand: sort by Yrs Funded with
all columns showing, collapse back to a goal that hides it, and the order falls to goal order.

**Three goals ranked on numbers with no column.** `maxroth` on `terminal.roth`, `widowrmd` partly on
`terminal.ira`, and `taxflex` - the DEFAULT - on a spread computed inline inside its own ranker. New
Final IRA / Final Roth / Mix Spread columns. `afterTaxBucketSpread()` was **extracted** from the
ranker rather than reimplemented in the UI, so the number the column prints and the number the
ranking sorts on are the same number. A node test asserts the column and the ranker agree on order.

**`OPT_OBJECTIVE_COLUMNS` went in core, not the UI.** `optimizer_ui.js` has no `module.exports` and
no `window.*` block and no node suite loads it, so anything placed there cannot be asserted outside a
browser. Cost: core holds string references to identifiers defined in the UI. Paid for with
`OPT_COLUMN_KEYS` as an explicit contract plus the one tier-1 test that can see both files.

**Two defects found while verifying, neither predicted.**

1. The page's own changelog test caught my changelog entry: it asserts every `<b>` in the list is a
   version stamp in its own `<li>`, and I had used `<b>` for emphasis. Badge went red at 655/656.
   The same trap as the `<strong>` incident recorded above, from the other side. The failure text is
   not in the DOM, so it needed a console capture around `runTests()` to name.
2. **Chrome fires `toggle` when it PARSES a `<details open>`.** Both legend strips carry `open`, so
   two toggles fired before any init code ran, the inline `ontoggle` handler wrote "both open" to
   localStorage, and `restoreFoldState()` then read back the value it had just clobbered. A reader
   who folded the strips would find them open again on every visit, with nothing in the console.
   Found by tracing the load order rather than reasoning about it - three wrong theories first.
   Guarded with `_foldsRestored`: nothing persists until the stored preference has been read.

**One deviation from the approved plan, deliberate.** The plan put the Infeasible/Failed chips beside
the "Showing N of 21 columns" link. That link sits by the goal selector, which is where the *cause*
is, while the chips hide *rows* and belong beside the rows. They now sit on their own always-visible
strip directly above the two folds, still outside the fold, which was the actual requirement.

**Counts moved and both pins were reconciled from measured output**: node `optimizer_core` 280 ->
**286**, `slowInCore` unchanged at 3, TPP 61 and doclinks 22 unchanged. `TestTiers.EXPECTED` and
`.githooks/README.md` both edited in the same commit. Tier-1 went 248 -> **287**, which is NOT in
`EXPECTED` (it pins node suites only) and is called out in the commit message for that reason.

**Version bumped at all four sites** to **11.15f9**: `<title>`, the `?v=` on core/ui/tests, and the
tier-2 loader's own `const V`. The stale-token GOTCHA bit mid-branch and is worth repeating: after
commit 2 the browser served a **cached** `optimizer_core.js?v=1115e3` with no `afterTaxBucketSpread`
in it, and the error looked like a missing export rather than a cache hit.

**Browser-verified at 11.15f9**, badge green at 656 (287 in-page + 369 node): all nine goals render
9-10 columns with ⚖ first and the main and Best tables on matching track counts; Δ columns appear
only on pin, labelled `ΔFinalWealth vs ⚖`; the escape hatch reads "Showing 9 of 21 columns", expands
to 21 and back; the density preference survives a goal change; no green row lacks a highlighted cell;
`📋 Lowest RMD Tax%` disappears from the Best table under goals that hide the column while
`⚓ Best w/o Conv` survives under all nine; the fold persists across reload with the chips still
visible and still live-counting ("click to show 8 hidden"). Console clean apart from the usual
unrelated Cloudflare RUM CORS error. **No screenshot** - the Browser pane was not displayed, so all
of the above is DOM-level assertion rather than visual.

**Bookkeeping note:** `git add -A` on commit 2 swept the earlier planning-file resync into a feature
commit. Content correct, commit boundary not. Explicit paths thereafter. Also, P51 was rotated out of
the NOW table to make room for P67 (the table is capped at 7 rows by the LINE-30 BOUNDARY); it keeps
its O1 index row and is not dropped.

## Session 2026-08-22 (continued) - P67a review rounds, v11.15f9 -> v11.15fa

Two rounds of user review on the shipped table, then the PR. Nine items total, all landed.

**Round 1, seven items** (`bd75a56`). Duplicate "Your plan" symbol. Three legend strips merged into
one fold. Naming unified. `Conv Tax` with Break Even ahead of it. Colour legend lines dropped for
every colour whose rows carry a symbol. Compare hint folded. One ⚖ instead of 178.

Two of these were settled by READING rather than by opinion: **"Infeasible" and "target unreachable"
were literally the same flag** (`optimizer_ui.js:836` renders ⚠️ on exactly the condition that drives
the row colour and the hide-rows filter), and the summary bar's four tile names were checkable at
`retirement_optimizer.html:431-434`. The naming answer **reverts FinalWealth**, which the user had
asked for one round earlier - the summary bar won because it is what a reader sees first.

Also flagged before acting, and it changed the plan: item 7 wanted the compare row shaded like the
baseline, but item 3 had just pointed out baseline and Optimize Spend were already both `#dbeafe`.
Three things blue. User chose to strip ✦ of its colour rather than invent a fourth.

**Round 2, two items** (`1eef3b2`). The 💵 entry was not missing an explanation - **round 1 had
deleted it**. The merge script kept only spans opening `<span title=` and that one opens `<span id=`,
because `optimizer_ui.js:116` toggles it by id. A self-inflicted regression, found only because the
user noticed the symbol had no key. ⚠️ and 🚨 removed from the symbol list, both having a permanent
chip that says more (live count, click to toggle). 🟢 kept - no chip of its own.

**Two GOTCHAs, both now in task_plan under P67a.**
1. A goal's column list does NOT set display order; the filter preserves `OPT_COLUMN_KEYS`. Moving
   Break Even ahead of Conv Tax by editing `OPT_OBJECTIVE_COLUMNS` alone did nothing visible.
2. `sed -i` on Git Bash rewrites a CRLF file as LF. It flattened `retirement_optimizer.html` and
   `.githooks/README.md`. Git normalises so the blob survives, but `.gitattributes` pins
   `.githooks/**` to `eol=lf`, so blanket "restore CRLF" is WRONG there - a CR in a shebang breaks
   the hook for every Windows clone. Python with `newline=''` throughout instead.

**One self-inflicted corruption, caught immediately.** Swapping the convBE/convSaved descriptors with
a brace-matching script relocated the `Conv Tax` block into an unrelated Chart.js legend helper 1600
lines away. Caught by a `new Function()` parse check before anything else ran, repaired in place
rather than reverted (a revert would have lost the other six items), and the helper was confirmed
absent from `git diff`. Lesson: for block moves in a large file, anchor on the unique `key:` line and
assert the neighbours, do not trust `rfind` on a brace.

**Recorded, not fixed:** `buildStrategyFamilies` (`optimizer_core.js:4305`) sets `cashClones` on
`base.Cash > 0` with NO nerdknob gate, while the Optimizer's own call site (`optimizer_ui.js:911`)
gates on `NERD_KNOBS && base.Cash > 0`. The ungated path is Monte Carlo's, so MC can label a row 💵
with no legend anywhere on that tab. Pre-existing, outside this change.

**Final state:** v11.15fa, 6 commits, suites 286 / 61 / 22, tier-1 287/0, badge green at 656.
Verified in the browser at every step: Break Even now precedes Conv Tax under both conversion goals;
of 167 compare cells exactly one carries the marker, on a row shaded `rgb(219,234,254)`; the 💵 entry
is present under nerdknob and hidden without it. Still no screenshot - the Browser pane was never
displayed, so all of it is DOM assertion.

**Planning-file near-miss worth recording:** updating the NOW table by line INDEX clobbered the P30
row and duplicated P67, because the assert was written after the assignment and so was vacuous.
Caught by diffing the table against HEAD. Match on row TEXT, not on index, and assert before writing.

## Session 2026-08-22 (continued) - changelog brevity rule, P68 deferred, then P67b built

**The changelog rule got a NUMBER, which is why it will now hold.** The memory already said
"brevity"; it constrained nothing, and a 954-word entry got written under it. User: "WAY too long",
with a ~110-word example. Rewrote 11.15fc to 183 words, the in-page `<li>` to 89, and the README
bullet to match. `feedback_changelog_conventions` now carries a **target of roughly 150 words** and a
cut ORDER: the "why" first, then the mechanism, then any per-item list that restates the summary.

Measured the whole file while there: **79 entries, 18,459 words**, worst offenders 11.150b (1717) and
11.152f (1474). User asked for a pass over the recent ones, then interrupted and deferred it. Written
up as **P68** (a-c) at O2 with the measured table, and the one instruction that matters for it:
**do not cut the behavior-change warnings** - "does this release move my saved plan?" is the reader's
actual question, so those sentences are the part that earns its length.

**P67b, the relative view, built and shipped at v11.15fd** (`a98c94a`), nerdknob-gated.

The mechanism decision that made it small: a wrapper over `col.getSortValue` at the body-cell emit,
NOT 21 edited descriptors. `getSortValue` already bakes in the Future $ / Current $ toggle, so the
mode inherits it, and a column changing how it computes cannot leave the delta reading a stale field.

**Row order is provably identical in both modes** - sorting keeps using the absolutes, and a
difference from a common reference is monotonic in the absolute. Verified rather than asserted: the
first 25 rows come out in the same order either way.

Three judgement calls worth keeping:
- **Direction is per column, and `neutral` is a real option.** A negative on All Taxes is green, a
  negative on End Wealth is red. Final IRA and All RMDs colour NOTHING: a bigger Final IRA is worse
  for a widow and better for a spender, and the table should not pretend to know which one you are.
- **Conv Tax stays absolute**, pinned by a node test rather than by a comment. It is already a
  difference, measured inside one row's own conversion search rather than against another row.
- **A row with nothing to compare keeps its dash.** Turning "no value" into "+0" would read as a tie.

**Turning the nerdknob OFF also forces the mode off**, or a reader who enabled it once would be left
reading a table of differences with no visible way back.

**Known, recorded, not fixed:** under the two conversion goals the ⚓ baseline never converts, so it
has no break-even year and the ENTIRE Break Even column reads as dashes in relative view until a ⚖
row is pinned. Logically right, practically useless there. Flagged to the user.

Tests 287 -> 288 node, both pins reconciled from measured output, badge green at 658. PR #186 now
carries 12 commits. Still no screenshot - the Browser pane was never displayed this session.

## Session 2026-08-22 (continued) - five review rounds, v11.15fe through v11.1601

Rapid review cycles on the shipped Optimizer table. Everything below came from the user looking at
the real page; almost none of it was predicted.

**Two bugs that were MY regressions, both found by the user rather than by me.**
1. The 💵 legend entry vanished. My legend-merge script kept only spans opening `<span title=`, and
   that one opens `<span id=` because `optimizer_ui.js` toggles it by id. The symbol was on screen
   with its explanation deleted.
2. The Δ columns were still there in relative view. I had excluded them from the FILTERED set only,
   so switching "show all columns" on brought them straight back. I had also reported this as done.

**Two gaps found while verifying, not predicted:**
- Both PINNED rows are built by their own code paths calling `col.getValue` directly, so 📍 Your plan
  stayed absolute in relative view while every row beneath it was a difference, in the same columns.
- Chrome fires `toggle` when it PARSES `<details open>`, before init runs, so the fold preference was
  clobbered before it could be read.

**The coupling that caused two incidents is now gone.** Display order came from the order the
descriptors happened to be written in, while `OPT_COLUMN_KEYS` claimed to be the contract. That
caused (a) a Break Even reorder that changed nothing visible, and (b) a scripted block move that
relocated the Conv Tax descriptor into an unrelated Chart.js legend helper 1600 lines away. Order now
comes from `OPT_COLUMN_KEYS`; a descriptor missing from it logs the key instead of vanishing.

**A test found data drift I would not have.** Pinning End Wealth and All Taxes made them RENDER
everywhere via the pinned union, while the nine goal lists still did not name them. The assertion
failed on its first run. Without it the data and the display would have disagreed indefinitely, with
nothing visibly wrong.

**Two style rules earned memories**, both because the existing guidance was too vague to constrain
anything:
- **US spelling** ([[feedback_us_spelling]]). "colour" had reached a `<summary>` a reader sees. It
  lands in comments first, where it looks harmless, then gets copied into a visible string.
- **Do not argue for the change** (added to [[feedback_changelog_conventions]] as 3c). "and it used
  to print in the same black as a gain" is a pitch, not a fact. Cut "previously...", "it used to...".

**Also shipped:** switches instead of text links; percent deltas lost the "pp" suffix (user: "the pp
is the confuser"); the reference row moves to a converting row under the two conversion goals
(`OPT_BASELINE_REQUIRES`, with a node test asserting it covers exactly the goals ranking on a
conversion column); Conv Tax colored by sign with no `$`; the ⏹ stop-year mark explained; the
Version column dropped from the scenario list; `?tab=` added with friendly aliases.

**Answered:** there is no nerdknob control on the Optimizer tab. It is at the bottom of the
Documentation tab, unlabeled and faint, plus `?nerdknob`. It still gates the 💵 sweep arm, its legend
and the relative-view switch, so it is not vestigial.

**Still NOT verified live, and worth saying plainly:** the Roth Conversion Effectiveness half of the
baseline change. Neither the default scenario nor the user's own shared URL produced ⇌ rows, so only
the fallback path ran. Covered by a node test, not by a browser check. The user's URL also swept to
zero rows for me with no JS error, which is itself unexplained.

Final: **v11.1601**, 16 commits on PR #186, suites 289 / 61 / 22, tier-1 289/0, badge green at 661.
No screenshot at any point this session - the Browser pane was never displayed, so every visual claim
rests on DOM and computed-style assertions.

---

## Session 2026-08-23 — P23 shipped as three modes, v11.160F

**Started as a planning session**, three questions from the user. Two were answered from the code and
the record; the third became the work.

**1. Why arithmetic mean rather than geometric?** The reason was never written down — progress.md
records only "user confirmed". Reconstructed: at mu 7% / sigma 15% the Synthetic tab prints 6.05%
because `mu` is a log drift, and the tab labels that "(geometric)". **Correction issued to the
original spec:** the planned copy "mean === median" is true of the one-year return and false of
cumulative growth, so AAM is a change to what the number means, not to how much money you end up
with. The engine later confirmed this: 0.2pp of survival between the models.

**2. A realistic inflation model.** The planned AR(1) constants were guessed. Fitted them against the
CPI-U array already in `historical_returns.js`, three windows, and shipped the 1948-2025 fit.

**3. Replay.** Scoped and deferred to a new phase, P69, per the user's own sequencing.

**The user changed the design mid-plan:** AAM is a THIRD mode beside GBM, not a replacement, so the
two can be compared. That decision produced the strongest guarantee in the change — inflation draws
were given their own PRNG stream, so GBM's returns are bit-identical to the pre-P23 code whatever the
inflation knobs say. A node test asserts it against a verbatim copy of the old bank build.

### Three claims I made while planning, and what measuring did to them

| claim | verdict |
|---|---|
| "The planned AR(1) can never produce a 1970s" | **False.** 8.7% of 40-year paths contain a five-year run above 5%. Four times too rare, not impossible. |
| "Eight consecutive years above 5% in the record" | **False.** Five (1977-81), peak 13.30%. |
| "rho about -0.25 against the equity draw" | **Not as stated.** Equity correlates at -0.18 to +0.10; the sensitivity is in BONDS (-0.25 to -0.38). -0.30 is right for a 60/40 blend, for a different reason than I gave. |

### What shipped

Third dropdown mode `aam`; `RETURN_FLOOR`, `computeNextInflation()` and `correlatedNormal()` in
prng.js with fitted constants; both synthetic modes build an inflation bank and report
`inflationStats`, so the Input Distribution inflation chart works outside Historical for the first
time; three nerd-gated knobs; the "(geometric)" label became mode-dependent; `simulationMode` now
rides on the results message.

**Two live bugs fixed in passing.** `worker.js` and `mc_controller.js` both collapsed every
non-bootstrap mode to `'gbm'` at the call site, which would have run AAM as GBM in silence. And
`returnSeq` exponentiated stress mode's already-decimal returns, feeding a wrong `yr.baseReturn` into
every stress scenario's log — no balance moved, because `returnSequencePerAccount` overrides all five
accounts, but P69's replay would have put that number on screen.

### The result worth remembering

Variable inflation costs **4.8 points of survival, two years of median ruin, and $117,047 of median
terminal wealth** against the flat rate. GBM against AAM is **0.2 points and an identical ruin
year**. The returns half of this phase was a labeling fix; the inflation half was a correction to
what the tab had been reporting. Full table in findings.md under P23q.

### Verification

Suites **299 / 61 / 22**, badge green at 671 (289 in-page + 382 node). `TestTiers.EXPECTED` and
`.githooks/README.md` both reconciled to 299. Ten new tests. Three synthetic runs driven through the
real worker in the browser and read back from the DOM.

**No screenshot.** The Browser pane would not composite in this session, so every visual claim rests
on DOM and computed-value assertions rather than on looking at the page.

**Not done:** P69 and P70 are written up as phases and not started. `.planning` line endings: the
repo is CRLF except `.githooks/**`, and an early edit put 51 bare LF lines into prng.js before that
was caught and normalized.

### Addendum, same session: v11.1615 + the P71 refactor plan

User feedback after PR #188 opened, three items. Two shipped, one planned:

1. **Reset to defaults + Pessimistic buttons** in Advanced Parameters (v11.1615, commit 89924df).
Reset reads MC_PARAMS - the same table the clamped reads fall back to - so it cannot drift from the
real defaults, and re-syncs mu from Growth %. Pessimistic: growth -2pp, sigma 18%, persistence 0.75,
shock 3.1% (full-record residual), corr -0.45; sampling knobs untouched. Driven in the browser:
dirty -> reset -> pessimistic -> reset, all values verified from the DOM.
2. **Mode labels lead with the plain word:** Synthetic - Lognormal (GBM), Synthetic - Arithmetic
(AAM). User: acronym-first was unclear.
3. **P71 written, plan only, per user instruction.** The runPass mirror between worker.js and
mc_controller.js (~250 lines, six paired edits in the P23 session alone) collapses into a shared
montecarlo/mc_engine.js with hook-injected yield/cancel/progress. CRN discipline is the safety
invariant: MC_GOLDEN byte-identical or the refactor is wrong. P69a is subsumed by P71b, so P71
should land before P69. No changelog entry when it ships - user-facing only rule.

Session changelog entry renamed 11.160F -> 11.1615; one entry per session held.

### Addendum 2, same session: Input Distributions for everyone (v11.1616)

User: the panel answers a question every mode raises, so it should not be nerd-gated. Shipped:
shown for all users, folded by default; Min/Max lines start visible (phone users have no hover to
find the legend toggle); and a caption names the run that built the charts, e.g. "Built from the
last full run: Synthetic - Arithmetic (AAM) - 500 paths - seed 42 - mu 6.0% - sigma 12.0%"
(Historical shows bear-start instead of mu/sigma). Mode wording is read from the dropdown option
itself so caption and selector cannot disagree. Meta is stashed at DISPATCH (_mcFanMeta), so the
caption describes the run that produced the fan, not whatever the boxes say now.

Trap caught before shipping: non-demo users now get the fan rendered inside a CLOSED <details>,
where the canvas has no box - the one case Chart.js's resize observer is worst at. The existing
.mc-fold toggle-resize handler now covers the two fan charts, and the details gained the class.

Browser-verified nerd-OFF: panel visible+folded on plain ?tab=mc, caption correct for aam and
bootstrap runs, all five datasets visible, canvas 850x200 after fold-open (not the 300x150
fallback). Console clean. Suites 299 / 61 / 22.

### Addendum 3: caption captures EVERY parameter (v11.1617)

User: seed and inflation parameters were missing. Fix: _mcFanMeta stashes the complete dispatch -
seed, mu, sigma, bear-start, inflation target, persistence, shock sd, return corr - and the
formatter prints all of it for synthetic runs. Stated test in the code: the caption alone should be
enough to re-create the run it describes.

Real bug found while fixing: the ?montecarlo demo dispatched WITHOUT the inflation cfg, so it ran
on the prng.js defaults - which only coincidentally equal the knob defaults. A retuned knob would
have run the demo on numbers its caption then denied. Demo now spreads _mcInflationCfg() like the
main run.

Verified live: aam caption carries all eight fields; Historical stays short (bear-start; its
returns and inflation come from the record and have no other tuning). Version 11.1617 - one past
the clock hex, same-hour collision with 11.1616, matching the 11.1600->11.1601 precedent.

### Addendum 4: Experiment stops stomping AAM (v11.1618)

User: in ?montecarlo, clicking Experiment reset Simulation Mode to GBM even when the reader was
riffing on AAM. The guard was written when GBM was the only synthetic mode, so it tested
value !== 'gbm'. Now it tests !isSyntheticMode(value): Historical still switches away (the
Experiment is a statement about SAMPLING noise, which needs a mode where the seed is what varies),
and either synthetic mode is left alone. The run cfg took simulationMode: 'gbm' as a literal, so
that had to change too or the dropdown would have said AAM while the worker ran GBM.

Browser-verified both branches: AAM stays AAM and the fan caption confirms the run really used it
('Synthetic - Arithmetic (AAM) - 100 paths - seed 896 ...'); bootstrap still flips to gbm.
Console clean. No changelog entry, per user. Version 11.1618, title + mc_tab token only.

### Addendum 5: Fixed Inflation button, and a false changelog claim retracted (v11.1619)

User caught it: the changelog said "Synthetic - GBM is the model that was already there,
unchanged." Not true. Its RETURN draws are bit-identical, but variable inflation applies to GBM
too, so picking GBM does not reproduce a pre-v11.160F result. That is the worst place for the claim
to be wrong, since GBM is exactly the mode a returning user reaches for expecting their old numbers.

Both changelog surfaces corrected to say the market draws are unchanged and the mode as a whole is
not, and a **Fixed Inflation** button added to Advanced Parameters. Name chosen over "Fix
Inflation" (reads as repairing a bug) and "Inflation Fixed"; it parallels "Pessimistic" as an
adjective-preset.

It sets the inflation shock to 0 and touches nothing else. That is exactly enough: the AR(1) step is
target + persistence*(prev-target) + shockSd*z starting at prev === target, so with no shock the
middle term is 0 forever. Persistence and correlation go INERT rather than being reset - nothing to
act on - so the reader keeps their settings for when they turn the shock back on. Verified live:
dirty persistence/corr, click Fixed Inflation, only the shock moves.

New test 300, "Fixed Inflation reproduces the pre-change Synthetic model exactly" - the composed
claim in one place, because the composition is what the changelog now promises to users. It runs
with persistence 0.9 and corr -0.8 deliberately, proving those really are inert. EXPECTED and
.githooks/README reconciled 299 -> 300.

End-to-end browser proof, 400 paths seed 42: returns bit-identical between the variable and fixed
runs (median/min/max all equal to the digit); fixed inflation pinned at exactly the 3.0% Assumptions
rate (min == cagr == max); survival 60% variable against 65% fixed, final p50 65,550 against
81,608 - the cost of variable inflation, visible in one A/B.

### Addendum 6: the presets were unreachable for the readers who needed them (v11.161A)

User caught the hole left by Addendum 5: Reset / Fixed Inflation / Pessimistic all lived INSIDE
#mc-nerd-panel, so the non-nerdknob reader - exactly the person who cannot see the knobs and cannot
guess the old values - still had no way back to their pre-change numbers. Shipping a fix behind a
flag is not shipping it.

User proposed showing the panel with only those buttons. Deviated slightly and said why: a panel
headed "Advanced Parameters" containing zero parameters reads wrong to the majority who would now
see it. Instead the three buttons moved OUT into a new always-visible #mc-preset-row under the mode
selector, labeled "Model presets"; the nerd panel keeps its heading and its knobs.

Second half, and the part that was not in the request: mcInputsChanged() only raises a stale banner.
For a reader whose knobs are invisible that is too quiet - click a button, see nothing. New
_afterMCPreset() re-runs for non-nerd readers on the same rule onMCModeChange already uses (nerd
mode means the reader controls when the expensive sweep happens). All three presets share it.

Browser-verified nerd-OFF end to end: preset row visible with all three buttons, nerd panel hidden,
every knob offsetParent null; click Fixed Inflation -> auto re-run -> survival 54.8% to 58.4%,
inflationStats min==cagr==max==3.0%, caption reads "inflation shock sigma 0.0%". The caption is
what makes an invisible-knob preset legible, which is why it had to land first.

### Addendum 7: "Model presets" -> "Mode presets" (v11.161B)

User: at that point in the page the only name the reader has been taught is "Simulation Mode", so
"model" arrives unexplained and reads as something unrelated. Renamed on all three surfaces (row
label, in-page changelog line, changelog file). The rationale is now a comment beside the row so the
next person does not "correct" it back.

---

## Session 2026-08-23 (continued) — `/plan` re-entry, state resync, no code

Context restore only. The three planning files already existed under
`.planning/retirement-optimizer/` and `.planning/.active_plan` points at that directory, so nothing
was created. `session-catchup.py` reported no unsynced context.

What was stale, and is now corrected in `task_plan.md`:

| Claim in the header | Reality on disk |
|---|---|
| "P23 COMPLETE at v11.160F, **uncommitted**" | committed, and merged in PR #188 |
| latest version v11.160F | v11.161B — seven addenda landed after P23 proper |
| suites 299 / 61 / 22 | **300** / 61 / 22, and `TestTiers.EXPECTED` already pins 300 |

Measured, not assumed: all three node suites re-run green (300 / 61 / 22),
`TestTiers.EXPECTED` reads `{ optimizer_core: 300, taxPaymentPlanner: 61, doclinks: 22, slowInCore: 3 }`,
`<title>` reads `Retirement Optimizer 11.161B`, `git status` clean, HEAD `1e274f3` = the PR #188 merge.

The seven post-P23 addenda, from the commit trail: reset-to-defaults + Pessimistic preset and clearer
mode labels (v11.1615), Input Distributions un-gated and labeled with its run (v11.1616), fan caption
carrying every parameter (v11.1617), Experiment keeping the reader's synthetic mode (v11.1618), the
Fixed Inflation button plus a retracted changelog claim (v11.1619), the preset row moved out from
behind the nerdknob (v11.161A), and the "Model presets" -> "Mode presets" rename (v11.161B).

Nothing else changed. The open queue is untouched: **P35i** is the only O0; P71, P36, P30, P19, P69,
P70, P34 are the O1s, with P69 explicitly blocked behind P71.


---

## Session 2026-08-23 (continued) - P71a, the shared synthetic draw (v11.161C)

You picked P71a off the queue. It is the smallest step of the MC dedup: move the one formula that
three files each spell out for themselves into prng.js, and change nothing a reader can see.

**What moved.** prng.js gains `INFLATION_STREAM_XOR = 0x5F356495` (previously a bare literal in
worker.js, mc_controller.js and twice in optimizer_core.tests.js) and three functions:
`drawSyntheticBank(mode, mu, sigma, logDrift, z)`, `syntheticReturnFromBank(mode, banked)` and
`drawSyntheticReturn(...)`, the two composed. Both export tails carry all four names.

**Where the design changed.** P71's plan named one function, `drawSyntheticReturn()`. One is not
enough: the hot loop banks a value AND needs that year's return for the min/max scan, and under
'gbm' those are different numbers (bank = log-space shock, return = exp(shock) - 1). Deriving one
from the other inside a single call would have meant returning an object - 400,000 allocations on a
10,000-path 40-year run. Two functions plus a convenience wrapper costs nothing and reads the same.
`calibrateMCMs`, which wants only the return, uses the wrapper.

**The guard the plan named does not exist.** P71's "the invariant that makes it safe" section says
`MC_GOLDEN` in sweep_golden.js "pins full MC results". It does not: `MC_GOLDEN` records
`buildVariations()` row counts, labels and base-row strategy selections, which is the sweep
enumeration, and not one simulated return. Worse, **no node suite loads worker.js or
mc_controller.js at all** - worker.js opens with `importScripts`, mc_controller.js is a page script -
so the 300 green tests would have stayed green if this refactor had changed every number on screen.
The one draw-related pin, `_p23OldGbmShocks`, is reached through `_p23NewSynth`, a hand copy of the
new code rather than the code itself.

**So the evidence was built rather than borrowed.** `p71_probe/` (kept beside the plan, with a
README) holds two node harnesses that load the REAL worker.js and the REAL mc_controller.js into a
`vm` context under a minimal shim and hash a fixed-seed 25-path 30-year run in all three modes, every
number at `toPrecision(17)`. Staged HEAD copies of worker.js, prng.js and mc_controller.js, ran both
probes against both roots:

    gbm        6c27ec21931ed71ced3968bdd98e7c0a
    aam        755ab7df0e59624467971c857ec32714
    bootstrap  58fc7d5cd458bf26ae87fc4f7d1bbfac

Six hashes, all identical before and after. A side result worth having: the worker and the
controller print the SAME hashes as each other, so the two mirrors really are in sync today, which
is the premise P71b and P71c rest on.

**Browser.** Page loads at 11.161C with all four new globals present and the arithmetic right
(`aam` at z=1 gives exactly mu + sigma, `gbm` gives exp(logDrift + sigma) - 1). Ran the real Worker
from the page, 200 paths x 30 years, both synthetic modes: `gbm` median return 0.06051 = exp(0.05875)
- 1 as it should be, `aam` median exactly 0.07, and both modes report identical `inflationStats`,
which is the separate inflation stream doing its job. Tier-1 in-page tests 289/289. The tier-2
badge could not fetch the node suites, which this entry first blamed on the preview pane's sandbox.
**Wrong** - see the P71b entry: the preview server had wedged and was refusing new connections.
Restarted, the badge reads a full green 669 (289 in-page + 380 node).

**Version.** 11.161B -> **11.161C**. The clock-derived minor for this hour is 1619, which is BELOW
the 161B already shipped today, so the letter was stepped instead. Four sites: title, the tier-2
loader's `const V`, and the `?v=` tokens on prng.js and mc_controller.js. worker.js needs none (its
URL falls back to `Date.now()`). **No changelog entry** - P71 changes nothing a user can see, which
is what P71e's rule already says.

Suites 300 / 61 / 22, unmoved, so `TestTiers.EXPECTED` and `.githooks/README.md` needed no edit.
Uncommitted. Next: `P71b`, create mc_engine.js and reduce worker.js to a shell.


---

## Session 2026-08-23 (continued) - P71b, one engine instead of two mirrors (v11.161D)

`montecarlo/mc_engine.js` is new and holds the model. `montecarlo/worker.js` went from **455 lines
to 42**: importScripts, a throttled progress callback, onmessage. Nothing a user can see was meant
to change, and the probe says nothing did.

**The engine took the job level too, which the plan did not ask for.** P71b's brief was `runPass`,
`buildStressMsg` and the per-path bundle. But reading the two copies side by side, the duplication
did not stop at `runPass`: `mainMode`, the progress weights, the `stressOnly` early return and the
whole results-message shape were written out twice as well. Extracting only `runPass` would have
left the next model change a paired edit, which is the exact thing P71 exists to end. So the engine
exposes `runJob(cfg, hooks)` - seed the rng once, main pass, stress pass, message - and
`runPass`/`buildPathInputs`/`buildStressMsg` beside it for P69 and for the tests.

**Two deviations from the design, both forced by the code rather than chosen.**

1. `runPass` takes the rng as an ARGUMENT. The design's `runPass(cfg, mode, hooks)` would have had
   to seed its own, and both passes of a job draw from ONE stream - the stress pass continues where
   the main pass stopped. Re-seeding per pass would have changed every stress number.

2. The two copies had drifted more than the plan recorded. A comment-stripped diff of the two
   `runPass` bodies found the controller carrying **per-path progress** (every 16 paths, so a
   one-variation run has a moving bar) and **cancellation** that the worker never had. A merged
   engine has to pick one, and picking the weaker one would be a deliberate regression, so the
   engine reports progress inside a variation for both callers. That is 90,000 `postMessage` calls
   on a 10,000-path 144-variation run, so the shell throttles to one per 60ms. First browser run
   left the bar at 95%: the terminal update had been swallowed by the throttle. The final update is
   now exempt, and the bar reaches 1.

**Evidence.** The `p71_probe/` harnesses needed one fix first - the worker's `onmessage` is async
now, so the probe polls for the result message instead of reading it straight after the call.
Re-baselined the fixed probe against the staged HEAD copy (same three hashes as P71a, so the fix
changed nothing), then ran it against the working tree:

    gbm        6c27ec21931ed71ced3968bdd98e7c0a
    aam        755ab7df0e59624467971c857ec32714
    bootstrap  58fc7d5cd458bf26ae87fc4f7d1bbfac

Identical. Node suites 300 / 61 / 22.

**Browser.** Real Worker, 200 paths x 30 years, all three modes: `gbm` median 0.06051008007643799,
`aam` exactly 0.07, `bootstrap` min -0.4384 / max 0.5256 - digit-for-digit what the P71a build
produced, with the stress pass returning its two variations in each. Progress arrives 9-11 times per
run and ends at exactly 1.

**A correction to the P71a entry.** That entry said the tier-2 badge could not fetch the node suites
because the preview pane's sandbox blocks `fetch`. It does not. The preview server (a leftover from
a `--help` invocation that started a real server) had wedged and was refusing new connections, which
is also why the pane could not navigate at all this session until it was killed. On a fresh server
the badge reads **green at 669 - 289 in-page + 380 node**, with the 3 slow tests skipped and the 12
critical regression guards passing.

**Version** 11.161C -> **11.161D**, title only. mc_engine.js is not on the page yet - the controller
still runs its own copy until `P71c` - so no `?v=` token moved and the tier-2 loader's `V` is
unchanged. No changelog entry, per P71e.

Uncommitted. Next: `P71c`, delete the controller's ~250-line mirror and delegate to `runJob` with
its yield/cancel hooks; that is also where mc_engine.js first gets a `<script>` tag and the file://
fallback needs a manual pass.


---

## Session 2026-08-23 (continued) - P71c, the second mirror deleted (v11.161E)

mc_controller.js **567 -> 203 lines**. `_runMCMainThread` is thirty lines that build three hooks and
await `runJob`; `_buildStressMsg` went with the mirror it belonged to. Counting P71b, the two
hand-kept copies that were 455 + 567 lines are now 42 + 203 around one 522-line engine.

The hooks are the whole difference between the two callers: `onProgress` forwards to the caller's
callback, `shouldCancel` reads `_mcCancelled`, and `yieldIfDue` keeps the 16ms frame budget the
comment has always described. The worker passes none of them and gets no-ops.

`recordMCTiming` stays on this side - it is a main-thread estimator and the worker has its own wall
clock - and it is still skipped for a stress-only refresh, which would teach the estimator a per-sim
cost no full run matches.

**Page wiring.** mc_engine.js now has a `<script>` tag ahead of mc_controller.js, so the file://
fallback and the worker literally run the same text. Tokens: mc_engine.js and mc_controller.js at
`?v=11161e`; prng.js unchanged at `11161c`; the tier-2 loader's `V` unchanged, no test file moved.

**Evidence.** `probe_controller.js` needed one change - it now skips mc_engine.js when the root does
not have one, so the staged pre-P71 copy still loads - and then both probes matched the HEAD
baseline exactly, all three modes:

    gbm        6c27ec21931ed71ced3968bdd98e7c0a
    aam        755ab7df0e59624467971c857ec32714
    bootstrap  58fc7d5cd458bf26ae87fc4f7d1bbfac

Node suites 300 / 61 / 22. Badge green at 669.

**Browser.** Worker path, gbm, 200 paths: median 0.06051008007643799, stress pass present - the same
digits as P71a and P71b. Main-thread path, same config: identical median, 34 progress updates,
last pct exactly 1.

**The file:// pass, and what it did not cover.** The preview pane renders a `file://` URL as a static
snapshot and will not run scripts in it, so the branch was exercised the other way: `_runMCFallback()`
called directly over http, which is precisely what `location.protocol === 'file:'` calls. Bootstrap,
50 paths, one variation: 60ms, survival 0.82, stress pass present, no error. What remains untested is
the one-line protocol check itself.

**Cancel, re-verified because the mechanism moved.** Cancellation used to be a `return null` inside
the controller's own loop; it is now a hook the engine calls. Started a 6-variation 400-path run,
called `cancelMCWorker()` after 300ms: 32 progress updates, then onComplete never fired and no error
was reported - the contract that leaves the previous results on screen.

**One measurement worth not misreading.** A main-thread run of 200 paths x 2 variations took 21
seconds in the pane and 60ms in a foreground tab. That is `setTimeout` clamped to ~1s in a hidden
tab, not the refactor: the yield points and their 16ms budget are unchanged from before P71.

**Version** 11.161D -> **11.161E**. Title, plus the two `?v=` tokens. No changelog entry, per P71e.

Uncommitted. Next: `P71d`, `require('./montecarlo/mc_engine.js')` in optimizer_core.tests.js and run
all three modes end to end at ~20 paths, replacing `_p23NewSynth` with calls to the real engine
(`_p23OldGbmShocks` stays a verbatim copy - being a copy of the OLD code is its whole point). That
one moves the test count, so `TestTiers.EXPECTED` and `.githooks/README.md` move with it.


---

## Session 2026-08-23 (continued) - P71d, the suite finally executes the engine (v11.161F)

Until now no suite ran the Monte Carlo. That is the finding P71a turned up and this item closes:
four new tests drive `mc_engine.js` directly, and the hand copy that stood in for it is gone.

**What the four cover.** A whole job end to end in all three modes (20 paths, 1 variation, 25 years)
asserting shape and coherence, not a golden number: mode echoed back, path count, one variation
returned, 25 percentile years, survival in [0,1], a finite inflation CAGR, an input fan, and a stress
pass carrying the same single variation. Then CRN determinism - the same seed twice must agree
exactly AND a different seed must not, or the first half proves nothing. Then stress banking one path
per selected scenario. Then a cancelled job resolving to `null`, which is the contract that leaves
the previous results on screen.

**`_p23NewSynth` is a six-line adapter now.** It used to reimplement the bank-build loop, so every
P23 assertion was testing a copy of the code rather than the code. It calls `buildBanks()` and hands
back `{bank, inf}`. All ten P23 tests passed unchanged on the first run against the real engine,
which is the best evidence available that the copy had not drifted.

**Three things the plan did not anticipate.**

1. **`buildBanks(cfg, rng, mode)` had to come out of `runPass` first.** Two P23 tests draw a 40,000
   long series; routing that through `runPass` would have run `simulate()` over 40,000 years to get
   at a bank. The bank build is a better seam anyway - it is where every draw happens, and where a
   test asserting something about the draw should be pointed. Both probes stayed byte-identical
   across the extraction.

2. **The test runner is async now.** `runJob` is a promise by construction. The old runner called
   `fn()` and ignored what came back, so an async body would have reported PASS without ever
   asserting, and a failure would have surfaced as an unhandled rejection. `runOptimizerCoreTests`
   is `async`, the loop `await`s each body, and both call sites await it: the node entry point (which
   now exports before running, since the run yields to the event loop) and the page's tier-2 loader.

3. **`montecarlo/stats.js` had no export tail.** It was a plain script for the worker and the page.
   Node needs `computePercentiles` and `computeInputFan` on globalThis before mc_engine.js can be
   required, so it got the same three-host tail prng.js and mc_engine.js already carry. While there,
   corrected a comment that had gone stale at P23: it still said GBM uses fixed inflation and passes
   a null inflation bank.

**The badge did its job.** First browser check went RED: "optimizer_core: 304 tests on disk, 300
expected". `optimizer_tests.js`, which holds `TestTiers.EXPECTED`, was still being served from cache
on its old `?v=11160f` token. That is the fourth version-bump site the repo's own CLAUDE.md warns
about, missed on the first pass and caught in the one place designed to catch it - red, not
green-with-a-warning. Token bumped, badge green at **673 (289 in-page + 384 node)**, which confirms
the four new tests run in the browser tier too.

**Counts.** optimizer_core **300 -> 304**; taxPaymentPlanner 61 and doclinks 22 unchanged;
`slowInCore` still 3. Both homes updated in this pass: `TestTiers.EXPECTED` and the table in
`.githooks/README.md`.

**Version** 11.161E -> **11.161F**. Title, the tier-2 loader's `V`, and tokens on optimizer_tests.js,
stats.js and mc_engine.js.

**P71e is finished too**, without its own release: every wiring item it listed moved with whichever
of a-d needed it. What is left of P71 is a review pass and a commit - five uncommitted versions,
v11.161C through v11.161F, touching prng.js, worker.js, mc_controller.js, mc_engine.js, stats.js,
optimizer_core.tests.js, optimizer_tests.js, .githooks/README.md and the page.


---

## Session 2026-08-23 (continued) - P71 committed, then three Annual Details columns (v11.161G)

**P71 is committed** as `b7f8808`, five versions squashed into one commit with the reasoning in the
message: the two mirrors, what the engine now owns, the deviations, and the probe evidence. The
pre-commit hook ran all three suites green before it landed.

**Then the user asked for plumbing:** annual inflation, cumulative inflation and market return in
Annual Details, hidden behind Show All for now.

Three columns, at the far right of the table: `infl%` (the inflation applied to the spending goal
that year), `inflCum%` (how far the price level has risen since the plan started) and `return%` (the
year's market return before dividends and before each account's own mix). The engine already had
both numbers - `yr.yearInflation` and `yr.baseReturn` - and neither reached the log; `inflationFactor`
was in the log but in no category, so it could never appear.

Two decisions worth recording. Cumulative inflation is reported as the PERCENT risen rather than the
raw multiplier, so it formats like every other `%` column instead of rounding to "1"; the multiplier
stays available as `inflationFactor`. And the category is a new `Market` with **no checkbox**, the
same trick `loopMs`/`Debug` already uses, which is exactly "behind Show All" without inventing a
control for three columns that say nothing in a deterministic run.

**A break I caused and the page caught.** The `inflCum%` hover-over text contained an apostrophe in
"today's money" inside a single-quoted string, which broke `optimizer_ui.js` at parse time - so
`runSimulation`, `showTab` and everything else in that file went undefined and the page was inert.
All three node suites stayed green throughout: none of them loads optimizer_ui.js. What caught it was
opening the page. Reworded to avoid the apostrophe, and while fixing it the text now names the real
control (the **Future $ / Current $** switch above the tabs) instead of a "Current dollars" checkbox
that does not exist under that name.

**Tests.** One new test: the three columns must echo the sequences a Monte Carlo path actually ran
on, year by year, with `inflCum%` compounding and agreeing with `inflationFactor` - and a
deterministic run must fall back to the typed Growth and Inflation rather than to blanks. Suite
**304 -> 305**, reconciled in `TestTiers.EXPECTED` and `.githooks/README.md`.

**Browser.** Columns present, hidden by default, revealed by Show All, grouped under a new **Market**
header. Values check out: 3.00 / 6.00 flat on a deterministic run, and `inflCum%` reads 0.00, 12.55,
75.35 at years 1, 5 and 20, which is 1.03^0, ^4 and ^19. Badge green at **674**.

**Version** 11.161F -> **11.161G**; tokens on optimizer_core.js, optimizer_ui.js, optimizer_tests.js
and the tier-2 loader. This one IS user-visible, so it gets a changelog entry in both homes: the
in-page list and `optimizer_changelog.md`.


---

## Session 2026-08-24 - the two map files P71 forgot

User asked whether `ARCHITECTURE.md` and `.planning/FILE_DIRECTORY.md` were missing changes. They
were. P71 renamed the shape of the whole Monte Carlo layer across four commits and neither map moved,
so both described a `worker.js` that owns `runPass` and a `mc_controller.js` that keeps a copy of it -
the exact arrangement the phase existed to end. Nothing automated would have caught this: the suites
do not read either file, and the doclinks suite only checks that links resolve.

`ARCHITECTURE.md`: `mc_engine.js` added to the module diagram with its real edges (the page loads it,
the worker `importScripts` it, the controller falls back to it), the worker and controller relabeled
as shells, and the Monte Carlo flowchart corrected on three counts - it now routes both protocols
through `runJob`, names all three simulation modes instead of "Synthetic", and shows the stress pass
running in EVERY mode rather than only Historical, which has been true since v11.152d and was never
drawn. Three paragraphs added after the flow: one engine with two shells, why a Monte Carlo refactor
needs the `p71_probe/` harnesses rather than the suites, and the CRN discipline in one place
(separate inflation stream, correlated shock, and why Fixed Inflation still makes the draw it
multiplies by zero). File-reference table updated for all five montecarlo files.

`FILE_DIRECTORY.md`: `mc_engine.js` row added, `worker.js` demoted to "shell around mc_engine.js",
`mc_controller.js` and `prng.js` and `stats.js` rows corrected, and `p71_probe/` documented in the
planning section.

Docs only - no page asset changed, so no version bump and no changelog entry. Suites 305 / 61 / 22.


## Session 2026-08-24 (continued) - README staleness, and the harness catalog gets its own name

Three items, all from the user noticing that "README.md" is two different files.

**A correction first.** I said the root README had "no montecarlo references at all". That was a
claim about source-FILE references (it names only `taxengine.js` and `chart.js`) stated as though it
were a claim about content - the README discusses Monte Carlo at length. Checked properly, it was
stale in three places, all from P23:

- "Model variable inflation in the synthetic Monte Carlo" was still under **Features in the Works**,
  three weeks after it shipped in v11.161B. Moved to Recent Fixes and written out properly: what
  varying inflation buys, what Synthetic - AAM is for, that GBM's market draws are unchanged, and
  that Fixed Inflation reproduces the old model.
- "The other model, Synthetic, is Log-Normal, Geometric Brownian Motion" - there are two synthetic
  models now. Rewritten to name both and say what the growth rate means in each.
- The Account Composition paragraph named "Synthetic (Log-Normal / GBM)" as the mode that ignores
  the per-account mix. Still true, but it now names both synthetic modes.

**`.test_harnesses/README.md` -> `HARNESSES.md`.** It is a catalog of eleven investigative scripts,
not an introduction, and the name collided with the repo's real README in search and in conversation.
Renamed with `git mv`, a line at the top records the old name, and every live inbound reference moved
with it: `ARCHITECTURE.md`, `FILE_DIRECTORY.md`, and five references in `task_plan.md`. Two of those
carried line numbers (`:79-81`, `:7-10`) that the rename invalidated; rather than re-derive numbers
that will rot again, they now cite the file and the section heading.

**Left deliberately stale:** the two references in this file's own older entries. progress.md is a
chronological record and those entries were true when written; rewriting them would be falsifying the
log to tidy a path.

**Also found:** `ordered_fill_harness.js` had no row in the catalog table. Added one, from the
harness's own header: it proves the Ordered strategy restarts its account sequence every year and
shows where the year's leftover surplus is banked.

Docs only. Suites 305 / 61 / 22, no version bump, no changelog entry.


## Session 2026-08-24 (continued) - the README paragraph the first sweep missed

User quoted a line from the "Stress Test vs Monte Carlo Analysis" section that still said Synthetic
"currently does not vary inflation". I had not corrected it, and my "three places" report from an
hour earlier was therefore wrong - there were four, and the fourth was the one a reader is most
likely to hit, because it sits in the section that explains the difference between the modes.

**Why the sweep missed it.** I grepped for `Monte Carlo|montecarlo`. The sentence contains neither -
it opens "Synthetic uses randomized market variations". A grep for the feature name cannot find text
that describes the feature without naming it, which is most prose. Grepping for `Synthetic` (the
thing that changed) instead of `Monte Carlo` (the tab it lives in) returns all four hits plus two
more paragraphs worth checking.

Fixed: that paragraph now says synthetic randomizes inflation as well as returns, describes the
calibration and the clustering in the author's register rather than the changelog's, and a new
paragraph after it explains the GBM/AAM split as a difference in what the growth rate you type
*means* - with the concrete 7% -> 6.05% median - and notes that neither is the more optimistic of the
two. The "TWO Monte Carlo regimens" sentence above it now says synthetic has two flavors.

**Left alone, deliberately.** The competitor section (~line 1004) criticizes GBM as a "drunk man's
walk" that lacks the persistence real markets show. That critique still stands against this tool's
own synthetic RETURNS: P23 gave inflation an AR(1) persistence model, not returns. The paragraph is
the author's argument and remains factually correct, so it is his call whether to note the asymmetry;
flagged to him rather than edited. Also related: P14 (regime-switching MC) is the open phase that
would answer it.

Docs only. Suites 305 / 61 / 22.


## Session 2026-08-24 (continued) - loopMs was empty because the table was off by one column (v11.1628)

User: "why is loopMs always empty? (It's been that way for a while)". It is a real defect, and not
in loopMs.

**What was wrong.** `updateTable()` builds the heading row and the body rows from the same key list
but applied DIFFERENT filters to it. Header: `if (!key.startsWith('-'))`. Body:
`if (!key.startsWith('-') && key !== 'inflationFactor')`. So the body emitted one cell fewer than
there were headings, and from `inflationFactor` rightward every value sat under the heading to its
left. `loopMs` is the last key in the log record, so it got no cell at all - a heading with nothing
under it, in every row, forever.

Measured before the fix: 81 headings, 80 cells per row.

**Why nobody caught it.** Both affected columns are internal and hidden by default -
`inflationFactor` is in no category at all, `loopMs` is category `Debug`, so you only see either
under **Show All**. And the one visibly wrong cell was as good as invisible: under the
`inflationFactor` heading, whose expected value in year 1 is 1.0, sat the loopMs timing for that
year, which also rounds to 1. It dates to at least the P15 file split (`eadb1cc`, 2026-07-10) and
was carried in from the monolith before that.

**Fix.** One predicate, `isTableColumnKey(key)`, used by the header loop, the body loop and
`analyzeColumnContent`. The comment above it says what each exclusion means and why the two must
never diverge again. After: 80 headings, 80 cells, `inflationFactor` no longer emitted as a heading
at all (its reader-facing form is the new `inflCum%` column).

**And loopMs still was not useful.** With cells rendering it read `0` in every row, because a
simulated year costs ~0.2ms and the table rounds non-percent columns to whole numbers. It now prints
two decimals: 0.30, 0.20, 0.00, 0.10 on the default plan.

**Regression guard, and the mistake I nearly shipped in it.** The first version of the in-page test
read `#main-table` and returned early when it was absent - which is ALWAYS, because `runTests()` runs
before the page's first `runSimulation()`. It passed by never running: in-page count stayed at 289.
The test now renders its own table from `simulate(getInputs()).log` and counts cells per row against
headings; `runSimulation()` rebuilds the table moments later, so nothing is left behind. In-page 289
-> 290, and I verified it discriminates by deleting one cell in the live DOM and re-running the
comparison (0 misaligned rows -> 1).

Suites 305 / 61 / 22 unchanged (node), in-page 290, badge green at 675. Version 11.161G -> 11.1628,
changelog entry in both homes.


## Session 2026-08-24 (continued) - Mode presets became stateful, and a load-order bug fell out (v11.162A)

User: a reader cannot tell which regime they are in without opening Input Distributions, and even
then it is numbers they have no way to read. Make the buttons stateful; rename "Reset to defaults"
to "Default" and light it too; clear everything when a knob moves away.

**Built as derived state, not a clicked flag.** `updateMCPresetState()` asks the parameter boxes what
they hold and lights the buttons from that. A click flag would go wrong in both directions: still lit
after the reader edits a box, and dark for a reader who typed the preset's values by hand. Three
predicates, each stating what the preset actually means:

- Default: every `MC_PARAMS` entry at its default, with mu tested against Growth % rather than
  against a number, because mu's default is the behavior "track Growth" that `resetMCParams()` leaves
  in place.
- Fixed Inflation: `mc-inflation-shock-sd === 0`, and nothing else. A zero shock leaves the AR(1)
  middle term with nothing to act on, so this is true whatever persistence and correlation say - it
  can coexist with a reader's own settings, which is why it is tested alone.
- Pessimistic: the four fixed values plus mu two points under Growth. Paths, seed and stress count
  are deliberately excluded, for the reason that button's own comment gives.

Lit via `aria-pressed` with the styling keyed off that attribute, so what is announced and what is
painted cannot disagree. In Historical mode Fixed Inflation and Pessimistic are DISABLED rather than
merely dark: that mode samples real inflation and has no synthetic model to tune, so those buttons
were clickable and inert there. Not asked for; the alternative was lighting a button for a regime the
run is not in.

**Two bugs found by watching the test count.**

1. First load painted Default as false on a page that WAS at its defaults. `initMCTab()` paints
   before `syncMCMuFromGrowth()` runs, so mu still held the MC_PARAMS number rather than Growth.
   `syncMCMuFromGrowth()` now repaints.

2. The six new in-page assertions did not run at all: in-page stayed at 290 when it should have been
   296. The guard `typeof updateMCPresetState !== 'function'` was returning early - because
   **the montecarlo scripts loaded AFTER the page's bootstrap block**. Which meant the load order had
   a live bug of its own: with `?tab=montecarlo` in the URL, `applyTabFromUrl()` reached
   `mcTabActivated?.()` while that name did not yet exist, and an optional call does not protect an
   undeclared identifier - ReferenceError, which aborted the rest of the block, which is where the
   deferred test tier registers. On that one URL the self-check badge sat on its neutral hourglass
   forever. Confirmed in the console before the fix, gone after.

   The six montecarlo `<script>` tags now load above the bootstrap block. Nothing in them has a
   load-time side effect. `?tab=montecarlo`, `?montecarlo` (the demo) and a plain load were all
   checked afterwards.

**Verified in the browser**, per state, not by clicking through and trusting it: fresh load in
Historical shows Default green with the other two greyed; switching to GBM enables them; Fixed
Inflation lights only Fixed; Pessimistic lights only Pessimistic; editing persistence clears all
three; Default lights again after reset. Computed style on the lit button is rgb(47,158,68) on white
text.

In-page 290 -> 296, node suites unchanged at 305 / 61 / 22, badge green at 681. Version 11.1628 ->
11.162A; tokens on the CSS (new `.mc-preset` rules), mc_tab.js and optimizer_tests.js. Changelog in
both homes.


## Session 2026-08-24 (continued) - four changelog entries collapse into one (v11.1629)

User: the ordering buries what matters. The end reader cares about the arithmetic model and about
inflation varying; the preset-button work is part of the SAME change and never shipped separately;
and giving a never-merged internal fix its own release entry is a mistake.

**11.161B, 11.161G, 11.1628 and 11.162A are now one entry, 11.1629**, in both homes. None of the
four was ever merged to main - they were four commits on one branch, and numbering them separately
described the development, not the release. The rule this leaves behind: a changelog entry belongs to
a RELEASE, and a branch that ships once gets one entry however many versions it passed through on the
way.

The detailed entry is the three points the user named, in that order, and nothing else: there is an
arithmetic model; both synthetic models vary inflation; the Mode presets set how much it moves and
show which setting is in force. The behavior-change warning stays, because a Synthetic plan really
will not reproduce an older recorded result until Fixed Inflation is clicked.

**Cut deliberately:** the AR(1) persistence / shock / correlation knobs (nothing in the UI varies them
today - the planned work that will use them can introduce them), the Input Distributions caption
inventory, and the whole column-alignment write-up. loopMs is one line, in the user's own words: the
time spent calculating each year of data was rendering incorrectly and has been fixed.

Version 11.162A -> 11.1629, title and the single entry. No `?v=` token moved: nothing but the HTML
and the changelog file changed. Badge green at 681, in-page 296.

---

## Session: 2026-08-24 (worktree context-ab498f) — P72 filed, first-year stub. No code.

User asked a direct question: with $1M in Cash today, late August, does the Optimizer accrue
September-December in year 1, or a full year?

**Answer, verified in the engine: a full year.** `applyGrowth` (optimizer_core.js:626) is
proportional and already takes a month count, but `preMonths = early ? 1 : 11;
postMonths = 12 - preMonths` (optimizer_core.js:1168) **always sums to 12**, in year 0 as in every
other year. The 1/11 split positions the withdrawal before or after growth inside the year; it is
not a calendar offset. No month input exists anywhere in the model, and `startInYear`
(optimizer_ui.js:558) is derived from `startAge` and clamped to `>= this calendar year`. The only
calendar-partial thing modeled today is Social Security claim-year proration by birth month,
`ssFirstYearFraction` (optimizer_core.js:693).

The overstatement is roughly `(1 - monthsRemaining/12) x rate x balance` and it compounds forward
over the whole run, so it biases every metric that depends on terminal wealth.

**Filed as P72, O2, full build spec** (user chose the build spec over a measure-first item). Two
decisions came out of the conversation and are what the spec hangs on:

1. **Auto-detect the month, but only in the UI layer.** The user does not want to hand-enter
   January-1 balances, because the change since January mixes growth, taxable events, withdrawals
   and deposits. So the page auto-detects when `startInYear` is the current calendar year, and
   assumes January for a future retirement with the month overridable. The engine never reads
   `new Date()`: it takes `startMonth`, defaulting to 1, which is bit-identical to today and leaves
   every golden fixture and node test untouched. The resolved month is pinned into the URL on
   save/share so a link still reproduces months later.
2. **The wage caveat is a first-class item, not a footnote.** A stub year exists because the user is
   mid-year, and that year almost always carries January-August earned income and withheld tax that
   the model knows nothing about. Prorating income without it would invent Roth conversion room that
   does not exist - the one number people act on. P72g adds income-already-received and
   tax-already-withheld inputs for exactly that reason.

The spec also fixes what does NOT prorate: RMD (the whole year's is due however late you start),
the standard deduction, brackets and the ACA FPL (annual by statute), and, recommended, property tax
(an annual bill that feeds SALT). `endYear` must advance inflation by the stub fraction too, or year
2's dollars sit a full year ahead of a four-month year 1.

Files touched: `task_plan.md` (new P72 section after P71, one O2 index row) and this log. No product
code, no version bump, no changelog entry.

---

## Session 2026-08-24/25 (worktree readme-review-updates) - P28 shipped, then all of P30 (v11.162B -> v11.163F)

One branch, one changelog entry, six commits. In order: P28's `rothGapFill` shipped as a switch and
as the circled-R clone pass; `unifiedConvRouting` deleted as provably inert; the Optimizer's Reduce
and IRA Draw grids cut to five steps each with per-strategy run counts added behind the nerdknob;
then P30a-g.

**What the research found, and it is not one answer.** `fillSpendingGap` has three branches and they
disagree. The default branch's `[40,60]` is wrong - `w=0` wins 65 of 82 clean cells, 40 wins none.
The bracket branch's Cash-first is right - swapping it loses 21 of 23. And under Ordered the story
collapses: "Cash before Brokerage" is exactly 30/60, a coin flip, because a four-account sequence
also places the IRA and Roth and that swamps the pair. Full tables in `GAPFILL_RESULTS.md`.

**P30g shipped the menu, not the constants.** Two of the three Ordered codes on offer (RIBC, BIRC)
win nothing in 60 cells, and the most-often-best sequence, CBRI, was not offered at all. The list is
now six - CBRI, CBIR, CIBR, BCIR, RIBC, BIRC - ordered by wins with ties broken on dollars at stake,
and it is ONE constant (`ORDERED_SEQS`) shared by the dropdown and both sweep grids, so a sequence a
user can pick is always one the sweeps score. The `[40,60]` default was deliberately left alone: the
win is measured on `baselineScoreOf` only, and "always drain Cash first" has a liquidity cost the
harness cannot see. That reasoning is written into P30g so it is not re-derived.

**Corrections worth keeping.** P28's 2026-07-30 evidence no longer reproduces on the current engine
and its mechanism has inverted; the ladder was re-baselined (`P28_RESULTS.md` section 15) before P30
reused it. `resolveOrderedSeq` was silently resolving all 21 unshipped permutations to CBIR - they
named one sequence and ran another - which is why P30d had to generalize it before it could measure
anything. And one prediction was scored VACUOUS rather than quietly dropped: no cell in the grid
could make it fire.

Suites 314 / 61 / 22, badge green at 690. Both goldens regenerated: MC in node, OPT re-captured in
the browser (four scenarios), and the diff read row by row rather than accepted.

---

## Session 2026-08-25 (worktree readme-review-updates) - P73, the Strategy column sorts on data now (v11.1640)

User's call on the open design question: **family, then parameter**. So `strategySortKey()` in
`optimizer_core.js` - pure, exported, node-tested - builds a fixed-width key from `_family`,
`_paramSortVal`, the modifier and the variant, and the Strategy column returns that instead of the
rendered label.

Two things this had to get right beyond the ordering itself. The rows had to carry the family and
modifier the ENUMERATION assigned, not ones parsed back off a label that starts with raw HTML for
the cyclic IRA-first arm - so `addResult` records `_family`/`_modifier` and the derived rows copy
them. And the comparator had to stop using `localeCompare` for this column: locale collation treats
the key's padding and field tags as ignorable at primary strength, which would silently reorder the
key's own fields. The column declares `rawSort: true` and the comparator compares by code point.

`P73b` dissolved rather than got decided. It asked whether the pinned rows should keep sorting to
the top; they never sorted at all - `display` filters both out before the comparator runs, because
each is already rendered sticky above the table.

Browser-verified both directions: one contiguous run per family (Fill Bracket, Guyton-Klinger, IRA
Draw, IRMAA Ceil, Ordered, Proportional, Reduce), each parameter's arms clustered as plain, no-conv,
then clones, and descending an exact mirror. Suite 315/61/22, badge green at 691. No changelog entry,
by the user's call. The same commit trims the release entry's Ordered item to name only the three
NEW sequences.

---

## Session 2026-08-25 (worktree readme-review-updates) - P74, Monte Carlo pinned the wrong strategy (v11.1642)

User: run Compare with Ordered CIBR selected, and the chart emphasizes CBRI.

The transport was the defect. `mc_engine.js` posts a summary of each variation back to the page with
a hand-written list of strategy fields, and that list was missing the five that identify the
remaining families - orderedSeq, the IRMAA tier, the ACA multiple, and the two GK guardrails. Both
sides were individually correct: sameStrategySelection() reads all of them, and the page passes the
real sidebar plan. But with a field absent on one side the comparison fell through to `?? default`,
so every Ordered row compared equal to CBIR and every IRMAA, ACA and GK plan matched nothing.
Pre-existing on main - the six-sequence menu only made it visible by putting CBRI first in the grid.

Fixed as one list rather than a longer hand-written one: `selectionOf()` in optimizer_core.js, which
mc_engine spreads. `loadMCVariation()` had the mirror-image gap and now restores the sequence, tier,
cliff, guardrails and Roth position - clicking a row used to run whatever the sidebar already held.

Second half of the request - Monte Carlo should always run YOUR plan - is `withCurrentPlan()`:
Compare appends the sidebar plan when no swept row matches. That is not only a matching problem, it
is coverage: MC sweeps no IRMAA ceiling and no ACA cliff at all, so those plans could not be in the
run however the matching behaved. Verified in the browser: Ordered CIBR pins and draws as itself,
and an IRMAA Tier 2 plan appears as row 157 of 157, pinned and drawn.

Two node tests, one of which fails on the pre-fix engine and names the wrong row. Suite 317/61/22,
badge green at 693. One self-inflicted detour: the changelog `<li>` I wrote used <b> for emphasis,
and an in-page test counts <b> tags to detect a swallowed entry - it caught it, which is the test
doing its job.


---

## Session 2026-08-25 (worktree mc-path-replay) - P69 planning, no code yet

Fresh worktree `mc-path-replay` off `f29b40a`, which is `origin/main` exactly. Target chosen by the
user: **P69**, replay one Monte Carlo or Stress sequence through the main model.

Re-anchored the approved design (`~/.claude/plans/cryptic-wondering-wren.md`) on the code as it
stands after P71 and P74, because both moved every line that plan cites. Three things the read
settled before any code:

- **P69a is already done.** P71 extracted the per-path bundle as `buildPathInputs()` in
  `montecarlo/mc_engine.js:44`, exported at `:538`, and there is no inline block left in
  `worker.js` to extract - the worker is 42 lines. Marked complete, next item is `P69b`.
- **`ruinYears` already survives for stress** as `ruinYearsPerPath` (`mc_engine.js:395`, kept by
  P53). The main pass still collapses it to `medianRuinYear`. So P69b is a smaller change than the
  plan assumed: keep the array, add the ranking metric, add the selector.
- **`runSimulation()` has no injection point** (`optimizer_ui.js:680`) - it builds its inputs from
  `getInputs()` and takes no argument. Replay needs exactly one, not a parallel copy of the
  updateTable/updateStats/updateCharts pipeline. That is the P69d design constraint.

Ranking metric settled as `afterTaxWealthOfLogRow` of the last log row - the basis Break Even and
the stop-year search already score on - with ruined paths below every survivor, earliest ruin worst.
One total order, so a rank percentile is unambiguous.

Open for the user: how many paths to capture and at which ranks. Straw man is worst 5 plus ranks
5/25/50/75/95.

---

## Session 2026-08-25 (worktree mc-path-replay) - P69b, the capture selector (v11.1643)

User decisions first: capture worst 5 plus ranks 5/25/50/75/95 (10 rows, deduped, worst-first), and
the replay control lands on the stress table and the main survival table in the same pass.

`selectCapturePaths()` in `mc_engine.js`, pure and exported, with the count and ranks as the two
named constants beside it. Total order: ruined below all survivors, earliest ruin worst, survivors
by ascending after-tax terminal wealth (`afterTaxWealthOfLogRow` of the last log row - the Break
Even basis), path index as the deterministic tie-break. `runPass` computes `metricPerPath` off the
row it already holds - one function call per path, no second simulate - and every varResult in both
passes now ships `captured` rows (metadata only, ~10 small objects; sequences are P69c's transport
problem). `buildStressMsg` passes varResults through whole, so stress rows got it for free.

Engine gained a dependency: `afterTaxWealthOfLogRow` from optimizer_core, hoisted onto globalThis
in the node test shim beside simulate/selectionOf, already global in page and worker scopes.

Three node tests: hand-built 10-path array where the right order is checkable by eye (ruin-year
ordering, dedup to 8 rows, rankPct 0..100 honest), a 100-survivor run plus a 3-path dedup edge, and
an e2e runJob asserting every variation of both passes carries in-range capture rows whose worst
row agrees with survivalRate. Suites 320/61/22, badge green at 696. No changelog entry - nothing
user-visible until the replay UI; title bumped to 11.1643, first <li> stays 11.1642 deliberately
(that entry belongs to a merged branch; this branch writes its own entry when the UI ships).

---

## Session 2026-08-25 (worktree mc-path-replay) - P69c, replay transport (v11.1644)

Two helpers in mc_engine.js, deliberately symmetric: `sliceBankRowsForPath()` pulls one path's
draws out of the banks as plain arrays (~2KB - scenario row plus the four asset rows for
bootstrap/stress, scenario plus synthInflation for the synthetic modes), and
`pathInputsFromBankRows()` wraps them as a single-path bank and calls the same `buildPathInputs`
the run itself used. No second copy of the blending code, so replayed inputs cannot drift.

Scope decision worth recording: the main pass ships rows for the captured paths of ONE variation,
the sidebar's own plan, not the union across variations. A Compare run has ~150 variations whose
capture sets need not overlap; the union is unbounded in the wrong direction, and replay always
runs the user's plan anyway (P69d injects sequences, never mutates inputs). The page names that
variation via `cfg.captureVariationIndex`, computed in `runMonteCarlo()` with
`findCurrentStrategyIdx` - `withCurrentPlan()` (P74) guarantees the match exists. The stress pass
ships `pathBankRows` for every path, index-aligned with the labels/startYears already in the
message, so any stress row can be replayed and still name its decade.

The test that matters: rebuild a captured path's inputs from the shipped rows, run simulate(), and
the after-tax terminal wealth equals the captured metric EXACTLY - the shipped rows are the run,
not a reconstruction. Round-trip element-exact in all four modes. Browser-verified through the
real worker: plan run carries captureVariationIndex 0, 10 captured rows, 10 bundles, 36/36 stress
bundles. Suites 322/61/22, badge green at 698. Still no changelog entry; UI is P69d.

---

## Session 2026-08-25 (worktree mc-path-replay) - P69d+P69h, the replay UI (v11.1645)

Replay is live. One injection point in runSimulation() - no parallel pipeline - overlaying the
path's sequences onto the inputs just read from the sidebar; the sidebar controls are never
written. A banner under the tab bar names the path (rank, survival or ruin year, mode, seed) with
an Exit button. Entry points: "Replay worst path" on the plan headline, a pinned-row button in the
compare survival table, and a per-row 🎬 on the stress table. Exit: the button, any sidebar input
event (capture-phase delegated listener), or leaving Charts/Annual Details (P69h, the approved
simplest answer - Optimizer and Tax Planner read the sidebar, which replay never writes).

Two things the browser found that the plan did not:

1. Plan scope never renders the survival table (it renders the headline and empties the tbody), so
   the pinned-row control alone was unreachable in the default scope. The headline hosts the
   button now, in both scopes.
2. Replaying the RAW sidebar put the stress ruin year one year off (2041 vs the table's 2042).
   Cause: swept rows are not the raw plan - every sweep row forces conversions on
   (convertExcessToRoth true vs sidebar false, measured $55 apart by year one). The run's survival
   rate and ruin year describe the ROW, so _replayPlanFields() now rides the variation's
   strategy/conversion fields (selectionOf + the four page-read extras + spendGoal) along with the
   sequences. After the fix: replayed stress balances match the engine trace to the dollar, ruin
   2042==2042, and a survivor path's replayed after-tax wealth equals its captured metric to the
   float (12,125,940.416580342).

Also: length guard refuses a replay after the plan's dates change; banner uses inline
display:flex/none because the .hidden class loses to an inline display. Changelog entry written
(11.1645, the branch's one entry) and the in-page list trimmed to its documented five-entry
ceiling. Suites 322/61/22 unchanged, badge green at 698. P69e (prev/next), P69f (overlay), P69g
(ruin-year mark) remain.

---

## Session 2026-08-25 (worktree mc-path-replay) - P69e + replay control rework (v11.1645 refreshed)

User feedback drove both halves. The boxed 🎬 buttons were unreadable at table size, and "worst
path" alone is not the goal - the capture exists to span the spread. So: ▶️ replaces 🎬
everywhere; the headline button became a compact picker listing all ten captured paths by outcome
("Worst path · ruin 2035" ... "Rank 95% · survives", rankPct rounded for display); the stress
rows keep a bare borderless ▶️; the pinned-row duplicate button is gone.

P69e shipped in the same pass: ◀ ▶ in the banner. Captured paths step worst-to-best as the engine
ranked them; stress scenarios step in the stress table's CURRENT display order, rebuilt at step
time from sortStressRows(buildStressRows()), so prev/next walks exactly the list on screen. Ends
disable their button. The picker snaps back to its placeholder after each choice so the same path
can be picked twice.

Browser-verified: pick worst (prev disabled) -> #2 worst -> ... -> rank 95% (next disabled);
stress walk 1973 -> 1969 matches the table; badge green at 698. Changelog li and md entry
reworded for the picker and the arrows.

---

## Session 2026-08-26 (worktree mc-path-replay) - P69f + Market view + stress compaction (v11.1657)

Three user asks, planned in plan mode (approved design at
~/.claude/plans/propose-how-to-overlay-serene-cocke.md), shipped as four commits.

The overlay: ONE dashed gray "Plan (steady assumptions)" line on the replayed balance chart - the
user chose it over a full second set for readability. Baseline is the SAME plan the replay runs
(sidebar + planFields), deterministically, cached on _replayState so every fresh state or exit
invalidates it for free. Under Current $ it deflates by its own steady inflationFactor, never the
path's - deflating by the path's would smuggle the path back into the "expected" line. Verified:
worst path draws expected $793k against replayed $0.

The Market view: new button in the income-chart row - each year's market return as green/red bars,
inflation as a line, percent axis, tooltip overridden to one decimal (the shared callback rounds
to integers). adj() deliberately unused: rates are not dollars, Current $ must not touch them.
Replay auto-switches to it on entry only (prev/next preserves a mid-replay view choice) and every
exit restores the prior view. The tab-leave exit now also re-renders, closing the pre-existing
quirk where replayed lines lingered bannerless.

Stress table: swatch cell went display:flex with a 4px gap (the inline gap was the user's "wasted
space", round two) and the 46px section indent dropped to 14px.

Suites 322/61/22 (UI only), badge green. Version 11.1657; the branch's one changelog entry
refreshed in place. P69 remainder: only P69g's visible ruin-year mark in Annual Details.

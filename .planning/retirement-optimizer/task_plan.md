# Task Plan: Retirement Optimizer — Remaining Work

**As of 2026-08-15:** `main` = `310b23d`, shipped **v11.1553**; through [PR #173](https://github.com/nightskyguy/retirement_assets/pull/173) merged, nothing in flight (resync 2026-08-15).
Completed phases live in `.planning/task_completed.md`. Full index, ID migration table and
the recency trail are below, in that order.

## NOW — O0 and O1 only

Priority buckets are **O0..O3** so they cannot be mistaken for phase IDs, which all start `P`.

| Pri | ID | Task | Next item |
|---|---|---|---|
| **O0** | P35 | Phased strategy; **step-up SHIPPED**, engine work remains | `P35i` |
| **O0** | P32 | Brokerage draws: audit defect open, premise refuted | `P32c` |
| **O1** | P51 | Oracle a-c,e-g DONE 08-10; propwd refuted | `P51d` |
| **O1** | P30 | Withdrawal policy, the `[40,60]` constants nobody chose | `P30a` |
| **O1** | P19 | taxengine.js, 13 of 51 jurisdictions still uncoded | `P19f` |
| **O1** | P34 | Conversion-search cost, worker + per-row memo | `P34a` |

**`P35f` and `P35g` are DONE (v11.1499).** IRC §1014 now fires at both deaths, so terminal
wealth and every "Optimize for" ranking have stopped leaning toward Roth conversions. Break
Even was deliberately left on the old basis and did not move. **P35's O0 was earned by that
correction and is now spent** - re-bucket it if the remaining Phased engine work (`P35i`) is
not what you want next. P36 round 2 now waits on `P35i` alone.

User 2026-08-07: P28 and P40 demoted to **O3**, P37 and P48 raised to **O2**. Full index next.

<!-- LINE-30 BOUNDARY. The planning hook injects `head -30` of this file on EVERY tool call
     and `head -50` on every prompt. A line added above here silently drops a table row out
     of that window, with no error. Keep this marker on line 30. -->

---

## Open Task Index — edit the **User Priority** column

Buckets: **O0** do next, **O1** soon, **O2** queued, **O3** someday. Lettered `O`, not `P`,
because every phase ID starts with `P` and a bare `P2` would be ambiguous. Ties inside a bucket are broken
by the order of the rows. This table is the only place priority is recorded; the phase sections below
stay in numeric order so links do not move when you re-prioritise.

Sub-item IDs are `<phase><letter>` in the order the items appear in that phase, e.g. `P36a` is P36's
first task. Every open item in the file now carries one.

| User Priority | ID | Phase | Next open item | Blocked by |
|---|---|---|---|---|
| **O0** | P35 | Phased strategy; **basis step-up shipped v11.1499** | `P35i` (the Phased engine) | nothing hard |
| **O0** | P32 | Brokerage draws — premise refuted, accounting-audit defect open | `P32c` | nothing |
| **O1** | P36 | Phased efficiency study — **round 1 DONE 2026-08-10** | `P36b` round 2 | `P35i` |
| **O1** | P51 | Perfect-foresight oracle — **a-c,e-g DONE 2026-08-10**, gap table delivered | `P51d` cross-check | nothing |
| **O1** | P30 | Withdrawal policy — the `[40,60]` constants nobody chose | `P30a` | nothing |
| **O1** | P19 | taxengine.js — 13 of 51 jurisdictions still uncoded | `P19f` | nothing |
| **O1** | P34 | Cost of finding a profitable conversion; worker + per-row memo | `P34a` | nothing |
| **DONE** | P52 | MC run scope: nerdknob "Run My Plan Only" *(default later flipped by P53f)* | shipped v11.150b | - |
| **DONE** | P53 | Monte Carlo Stress Test suite (5 windows, bear-start, plan-only default) | shipped v11.1521-152f (#170) | - |
| **DONE** | P54 | `?montecarlo` teaching demo + mode-aware paths floor | shipped v11.1553 (#173) | - |
| **O2** | P33 | Insights panel — where the money came from | `P33a` | nothing |
| **O2** | P29 | Hebeler Autopilot — worth a strategy slot? | `P29a` | nothing |
| **O2** | P31 | Asset mix is an OUTPUT — the reverse mapping | `P31a` | nothing |
| **O2** | P24 | Conversion stop-year as an Optimizer sweep dimension | `P24g` | P34 cost work |
| **O2** | P27 | Assumption sensitivity, a tornado over the guesses | `P27a` | nothing |
| **O2** | P4 | Creeping tax rate — Annual Details column + state-creep UI | `P4e` | nothing |
| **O2** | P22 | Export Annual Details to CSV | `P22a` | nothing |
| **O2** | P12 | Retire Optimizer tab -> MC strategy comparison | `P12a` | nothing |
| **O2** | P13 | Multi-Strategy Segment Optimizer — **retire this if P35 ships** | `P13a` | P35 outcome |
| **O2** | P23 | MC arithmetic-mean returns + AR(1) variable inflation | `P23a` | nothing |
| **O2** | P37 | LEGACY / heir 10-year drawdown | — | **deferred by you** |
| **O2** | P48 | README caveats backlog | — | **deferred by you** |
| **O3** | P28 | "Every voluntary IRA withdrawal is a conversion" — ship decision | `P28f` | nothing |
| **O3** | P40 | Test-file layout — the `tests/` subfolder move | decision, then the move | nothing |
| **O3** | P5 | Greedy DP conversion schedule | `P5a` | nothing |
| **O3** | P6 | Simulation sanity-check tests | `P6a` | nothing |
| **O3** | P8 | Annual-table view presets | `P8a` | design after P22 |
| **O3** | P9 | ACA refinement remainder | `P9a` | nothing |
| **O3** | P10 | Equity data -> Fama-French total market | `P10a` | nothing |
| **O3** | P11 | RealReturns — intl asset + annual-returns mode | `P11a` | nothing |
| **O3** | P14 | Regime-switching MC | `P14a` | P23 |
| **O3** | P16 | Responsive layout, all tools | `P16a` | nothing |
| **O3** | P17 | Retirement_Projection simple mode | `P17a` | nothing |
| **O3** | P18 | Retirement_Projection -> RetirementTaxPlanner link | `P18a` | nothing |
| **O3** | P26 | README/FAQ cross-references from tooltips | — | nothing |
| ~~DONE~~ | ~~P41~~ | ~~Pension start age *(was PA)*~~ — **7 of 7 done, v11.14bf** | — | — |
| **O3** | P42 | Lumpy spending, no URL encoding *(was PB)* | `P42a` | nothing |
| **O3** | P43 | Auto-persist + restore offer *(was PC)* | `P43a` | nothing |
| **O3** | P44 | Onboarding interview *(was PD)* | `P44a` | nothing |
| **O3** | P45 | Insights / feedback panel *(was PE)* | `P45a` | nothing |
| **O3** | P46 | Tax Payment Planner backlog, TPP-1 + TPP-2 *(was TPP-1..5)* | TPP-1 (prose, no checklist yet) | nothing |
| ~~DONE~~ | ~~P49~~ | ~~Horizon-aware suggested spend~~ — **SHIPPED v11.14c6** | — | — |

**Why P35 and P32 are the two O0s.** P35 carries the brokerage basis step-up, which is not a feature
but a correction: the terminal valuation taxes heirs on gains §1014 steps up in full, and because Roth
and Cash are unaffected the error runs one way, **in favor of Roth conversions**, through Break Even
and every "Optimize for" ranking. Nothing measured on top of it is trustworthy until it lands. P32 is
O0 for the same reason at smaller scale — its audit found a real defect and its own premise was
refuted, so the section is currently half true.

---

## ID migration table

| Old | New | Note |
|---|---|---|
| `PA` | `P41` | |
| `PB` | `P42` | supersedes the old `P3`, which is archived |
| `PC` | `P43` | |
| `PD` | `P44` | supersedes the old `P7`, which is archived |
| `PE` | `P45` | |
| `TPP-1`, `TPP-2` | `P46a`, `P46b` | TPP-3/4/5 shipped and are archived |
| README Caveats Audit | `P48` | |
| P35 `PR 1`..`PR 8` | `P35a`..`P35m` | see the alias in each P35 task line |
| P35 `PR 3a`/`3b`/`3c`/`3d` | `P35c`/`P35d`/`P35e`/`P35f` | cited by these old names in merged PRs #147/#149/#150 |
| P35 `PR 4` (code) | `P35g` | the brokerage basis step-up |
| P35 `PR 4` (README) | `P35h` | was a **duplicate `PR 4`**; now its own ID |
| P36 `PR 1`.. | `P36a`.. | |
| P36 "run it twice" `P36a`/`P36b` | `P36 round 1` / `P36 round 2` | renamed to stop colliding with the new sub-item letters |
| `P20` + `Table of Contents` | — | duplicate pair, both complete, archived |
| `PF11` (two headings) | — | the DONE one and its SUPERSEDED original, both archived |

---

---

## Recent state and trail

Goal: Complete open features from the original priority list plus deferred items from the UX batch. All completed phases archived in `task_completed.md`.

**As of 2026-08-15 (resync).** `main` = `310b23d`, shipped **v11.1553**, working tree clean, nothing
in flight. The last planning-doc update was **PR #166** (v11.14e1, 2026-08-10); **PRs #167-#173 shipped
without touching these files**, so this block catalogues them. The open queue did **not** change: none
of #167-#173 completed an O0/O1 item (P35/P32/P51/P30/P19/P34 all still open). Test counts moved:
**node core 263 / TPP 32 / doclinks 22 / slowInCore 3** (`TestTiers.EXPECTED`, `optimizer_tests.js:2220`);
**browser self-test 559** at v11.1553 (per PR #173; was 529 at v11.14dd).

Shipped since the last sync, newest first:
- **#173** (v11.1553, 08-15): fold the Experiment box, drop redundant BASELINE/CURRENT words; add
  `?montecarlo` teaching demo + mode-aware paths floor; adopt author's updated README Monte Carlo section.
  **Phased retroactively as P54.**
- **#172** (08-14): GA + Cloudflare analytics on the Jekyll-rendered pages. **Un-phased.**
- **#171** (08-14): Income Tax Planner visual bugs - NIIT line follows MAGI, chart NIIT dollars, SS cap,
  ordinary scrubber. **Un-phased.**
- **#170** (v11.1521-v11.152f, 08-13): Monte Carlo **Stress Test** feature batch - bear-start 3/5/10yr
  windows, memoized start-year ranking, plan-only default run, combine-all-windows, NaN/blank-Paths
  fixes. **Phased retroactively as P53** (note: P53f's plan-only default reversed the P52 decision).
- **#169** (v11.150b, 08-12): **P52** MC "Run My Plan Only" nerdknob + 6 Stress Test refinements.
  P52 is DONE - see its section (line ~2325) and the index row.
- **#168** (v11.1508, 08-12): sync the staleness guard to the tests on disk (244 then; 263 now) + doc refs.
- **#167** (08-11): Roth + tax info README revamp for clarity. Docs.
- **#166** (v11.14e1, 08-10): brokerage research program - the last planning-doc update; closed
  P32e/f/i and P35n, added the P51 oracle phase. Already reflected in the sections below.
- **#160-#165** (v11.1499 and earlier, 08-07..08-10): P35f/g §1014 step-up (#160), tool-eval FAQ (#161),
  P49 + P41d/g suggested-spend (#162, v11.14bf/14c6), spend-goal-restore bug (#163), Ordered surplus-fill
  (#164, v11.14dd), and the progress log of all of it (#165). All reflected in the NOW block and index.

**Prior snapshot, kept for the trail:**

**As of:** 2026-08-07, morning. **Working tree clean, `main` = `28a3395`, shipped version v11.147c.**
Everything below is merged; nothing is in flight.

- **P39 is COMPLETE.** All six items shipped, plus the hook-completeness follow-up as
  [PR #157](https://github.com/nightskyguy/retirement_assets/pull/157). The three node suites now
  run in the browser after paint behind a three-state badge (`4983e7a`, `bc2e063`), the three slow
  tests are tagged (`4d76d51`), `?runtests` forces a full synchronous 513-test check (`e4949a4`), a
  staleness guard pins the per-suite counts (`238f5ef`), and ten shipped-defect regression guards
  are marked `★ CRITICAL` in the console (`dedc944`). Pre-commit hook blocks a failing suite
  (`ad9529f`) and an unlisted `*.tests.js` suite (`475a2c4`).
- **P40 is HALF DONE and its second half is now UNBLOCKED.** The rename `.test.js` -> `.tests.js`
  landed (`db363ba`). The `tests/` subfolder move was deferred **until after P39 items 2-6**, and
  those are now merged, so the stated blocker no longer exists. The move is a decision waiting to be
  made, not a blocked item. `.tests/` and renaming `optimizer_tests.js` stay REJECTED.
- **README / docs, [PR #158](https://github.com/nightskyguy/retirement_assets/pull/158):** there is
  no basis step-up at death, at either death, and the terminal valuation taxes heirs who in reality
  owe nothing (`99fc632`, `8d47e3e`). Documented in **Limitations and Restrictions** with the
  direction of the bias stated (overstates survivor capital gains tax, understates survivor spending
  power and terminal wealth, net effect systematically **favors** Roth conversions) plus a
  cross-reference from the DRIP basis FAQ. Not a code change; the README itself says the code fix is
  planned.
- **ARCHITECTURE.md corrected twice:** nine measured defects (`a03d353`), and the claim that the
  node suites never run in the browser, which P39 items 3-6 made false (`f9352a5`).
- Test counts at `main`: **node 214/32/22** (pinned in `TestTiers.EXPECTED`, `optimizer_tests.js:2220`),
  **in-page 245**, **513 total in the browser**, `sweep_golden` content-identical.

Prior state, 2026-08-06 (`main` = `10f6f2a`, v11.1478), kept for the trail:

- **P38 is COMPLETE**, all three PRs merged: PR 1 + PR 2 (funding invariant + gate widening,
  v11.1468) as [PR #152](https://github.com/nightskyguy/retirement_assets/pull/152) (`f524105`), and
  PR 3 (size the draw net of tax on guaranteed income, v11.146a, `018baa9`) as
  [PR #153](https://github.com/nightskyguy/retirement_assets/pull/153).
- **P32 is PARTIALLY DONE**, research half landed as
  [PR #155](https://github.com/nightskyguy/retirement_assets/pull/155) and
  [PR #156](https://github.com/nightskyguy/retirement_assets/pull/156). Q1 measured, the mandated
  accounting audit found a real defect, and **the phase premise is refuted**: Brokerage is drawn
  constantly. See the P32 section and findings.md (2026-08-06) for what is now open.
- **Two engine correctness fixes shipped in that batch**, both of the same class - a function that
  was unit-tested directly while its *use* was not:
  1. **Dividends and interest were credited twice** (`e9a3c8b`, v11.146f). The dollar both reduced
     the needed withdrawal and stayed on the balance sheet. Moves everyone's numbers, downward.
  2. **The OBBBA senior deduction and elevated SALT cap were never switched on** (`c9e356a`). Both
     flags default false and no call site in `optimizer_core.js` ever passed them, so federal tax
     was too HIGH for anyone 65+ in 2025-2028 and for high-tax-state itemizers in 2025-2029. Gate is
     now resolved once per year in `resolveHousehold` and passed to all 10 `calculateTaxes` sites.
     Forced-IRA iteration cap 4 -> 6 (the lower tax bill lengthened the convergence path).
     **This fix had no plan phase of its own**; it was found while verifying a user report.
- Changelog consolidated: 11.146b/146e/146f + OBBBA merged into one **v11.1478** release entry
  (`05350e0`), and 11.1462/11.1468 folded into their neighbours (`912fd13`).
- Test counts at `main`: **node 214/32/22, in-page 245/245**, `sweep_golden` content-identical.

Earlier state, kept for the trail: **P35 PR 1 + PR 2 MERGED as [PR #146](https://github.com/nightskyguy/retirement_assets/pull/146)** (nothing user-visible, so no version or changelog entry); P38's diagnosis-only planning files merged as [PR #151](https://github.com/nightskyguy/retirement_assets/pull/151) off `main` = `fe72bef`, v11.1464.
**P35 PR 3a MERGED as [PR #147](https://github.com/nightskyguy/retirement_assets/pull/147)** (v11.1447, behavior change). **P35 PR 3b MERGED as [PR #149](https://github.com/nightskyguy/retirement_assets/pull/149)** (v11.1448 tokens, byte-identical, plus the doc file-reference gaps); the duplicate attempt PR #148 on branch `worktrees/medicare-age-data-7b2e91` is **CLOSED, not merged** — verified, nothing to do about it.
**P35 PR 3c MERGED as [PR #150](https://github.com/nightskyguy/retirement_assets/pull/150)** (v11.1462 -> v11.1464 on merge, behavior change confined to `aca` rows, proven against `propwd`/`bracket` controls), four commits: the behavior change, the `eitherOnMedicareAtStart` deletion it made possible, the plan record, and the ACA Cliff un-gating. Next review point after it is **PR 3d** (`Basis <= Brokerage` invariant).
Everything through PR #146 is merged: #135 (PR-A..PR-G, v11.13a1), #136 (planner rollover math), #137 (nerdknob graduation, v11.13bd), #138 (TPP-3/4/5 + brokerage handoff, v11.13c3 / planner v1.13be), #139 (P25 docs rendering, v11.13c5), #140 (README audit round 3 + doc-link labels, v11.13d0), #141 (P28 unified-conversion harness + P27 assumption-sweep scoping), #142 (README caveats for uncovered tax situations, BETR/conversion-order revisions, Stonewood/ThunderHarbor reviews), #143 (P29-P34 phases added to this file), #144 (`assertUngated` no longer fails on pages without the control), #145 (P35/P36/P37 phases added to this file, `6f94c82`). Next work starts from a clean base.

**Current batch (added 2026-08-01):** six new phases P29-P34 from a user punch-list — Hebeler Autopilot, withdrawal policy, asset-mix reverse mapping, brokerage draws, an Insights statistics panel, and conversion-search cost. Four of the six touch questions this repo has ALREADY partly answered, two of them answered NO, so every one of those phases carries an explicit "already ruled out, do not re-derive" block. Read that block before designing anything in the phase; it is there to stop a re-derivation of P24 and P28.

**Added 2026-08-03:** three phases P35/P36/P37 from a user design proposal — a new **"Phased"** withdrawal strategy that switches behavior by life phase, its efficiency study, and a deferred LEGACY heir-drawdown phase. P35 is an alternative answer to the long-pending **P13**, and it carries a ten-item engine survey in `findings.md` ("P35 engine survey", 2026-08-03) that must be read before any code is written: several of its items are traps where the natural implementation produces a plausible wrong answer rather than an error. **Work is to be performed in stages**, PR by PR, with a review point between each.

VERSION COLLISION HAZARD, seen for real here: the minor is `hex(dayOfYear*24 + hour)`, so two branches worked on in the same afternoon produce ADJACENT numbers, and whichever merges first is not necessarily the lower one. P25 was built as v11.13c2 (hour 18) but PR #138 merged v11.13c3 (hour 19) ahead of it, so P25 was renumbered to v11.13c5 on merge. When resolving a version conflict, recompute from the clock rather than taking either side.

**P38 and P39 both SHIPPED and are archived** (`.planning/task_completed.md`). P38 was the shipped correctness defect where `propwd`, `fixed`, `gk` and the baseline `else` branch reported `success: false` with hundreds of thousands of dollars of unfunded spending while the IRA still held seven figures; its diagnosis is in findings.md, "The baseline/proportional strategy family cannot fund its own tax bill once the taxable accounts run dry" (2026-08-05). It overlapped P30 and P32, so read it before starting either.

**P39** made the 268 node-only tests visible in the browser, so a broken node suite is no longer invisible at release time. Its GOTCHA is still live: cache tokens must move with any engine file the test tier depends on, and a warm tab keeps requesting the old token regardless. That cost is now part of P40's `tests/` move.

MAINTENANCE NOTE: a stale "uncommitted" in this trail reads as a live claim about the working tree, so update it in the same turn you commit, not later. **This section is no longer what the hook injects** - measured 2026-08-07, the hook is `head -50` of this file on UserPromptSubmit and `head -30` on *every* PreToolUse, so the injected window is now the **NOW** block at the top and nothing here. That is the point of the reordering: the per-tool-call window carries the live queue instead of finished-work narrative.

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

## P5: Greedy DP Conversion Schedule (was Phase 23b)
**Why:** Phase 23 implemented `optimizeConversionAmount()` as a scalar sweep. Per-year optimal conversion schedule (greedy DP) is deferred.

**UNBLOCKED — verified 2026-07-30, and it does not depend on P28.** The per-year lever already
exists: `_extraConvAmountFor` (`optimizer_core.js:1677`) reads `inputs.extraConversionAmount[y]`
whenever the input is an array, so a per-year schedule is expressible against today's engine with no
representation change. An earlier claim in the P28 discussion that the "unified conversion" reframe
was the precondition for a 1-D per-year search was wrong; the 1-D search is already available.

**Core algorithm:**
For each year t from retirement to max(RMD ages):
1. Sweep `extraConversionAmount` from $0 to totalIRA in $10k steps
2. Lock in optimal C_t; advance year t+1 with updated state
3. Result: `convSchedule[y]` array

**Output:** Annual Details `convSchedule` column + optimizer table "Conv $/yr" column.

**MC Stage 2 (stretch):** Top-K strategies with their locked schedules → 500 MC paths each → add MC Survival column to optimizer.

- [ ] **P5a** — Implement `buildConversionSchedule(baseInputs, overrides)` — greedy DP year-by-year
- [ ] **P5b** — `buildVariations()`: when `includeConvOpt` set, use schedule (not scalar) for optimized rows
- [ ] **P5c** — Optimizer table: "Conv $/yr" column (avg), "Conv Savings $" column
- [ ] **P5d** — Annual Details: `convSched` column (Opp. Cost category)
- [ ] **P5e** — Test: greedy DP schedule tapers toward $0 near RMD onset (sanity check)
- [ ] **P5f** — Test: schedule rows beat scalar optimizer on same inputs (if not identical)
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

## P19: taxengine.js Architectural Cleanup
**Why:** A full review of taxengine.js (2026-07-02, see `~/.claude/plans/review-taxengine-js-for-1-groovy-balloon.md`) found the circular core.js↔taxengine.js dependency — **fixed same session**: `getRateBracket`, `findLimitByRate`, `findUpperLimitByAmount`, `calculateProgressive` moved from core.js into taxengine.js (new "Bracket utilities" section right after `RMD_TABLE`), so taxengine.js no longer depends on core.js while core.js still depends on taxengine.js (one-directional now). Also fixed as part of that pass: dead `Retirement_Projection.html` polyfill removed (it now transparently uses the real taxengine.js functions), 5 low-risk comment/dead-code fixes in taxengine.js, and a live CPI-inflation-drift bug in `Retirement_Projection.html` (AL/MT/ND/OH/SC brackets were incorrectly inflating). node 51/51 + browser 240/240 verified after each change. The items below are the findings from that review NOT yet addressed.

- [x] **P19a** — **Bracket-walk consolidation:** DONE (d52ffac, 2026-07-07). `findBracketIndex()` helper added; `calculateProgressive()` gained a `startPosition` param so the capital-gains split reuses it (verified byte-identical output).
- [x] **P19b** — **Return-object alias cleanup:** DONE (d52ffac). `calculateTaxes()` duplicate names (`state`/`stateTax`, `fedRate`/`federalMarginalRate`, `stRate`/`stateMarginalRate`, `irmaaMagi`/`MAGI`, `stagi`/`stateAGI`) unified onto one canonical name each; all consumers updated. Bonus: repo-wide IRMAA identifier casing normalized with backward-compatible `?stratRate=irmaa2` URL parsing.
- [x] **P19c** — **Unify `computeIrmaaInline()` with `calcIRMAA()`:** DONE (d52ffac). `computeIrmaaInline()` deleted; Retirement_Projection.html now calls `calcIRMAA()` directly with `onMedicareCount` (fixes missing per-spouse Medicare-age gate).
- [x] **P19d** — **`irmaa_and_rmds.html` duplicate bracket math:** DONE (d52ffac). Now reuses new `calculateTaxableSocialSecurity()` extracted into taxengine.js; also fixed its "Annual IRMAA Surcharge" column (was showing monthly value, understated 12x).
- [x] **P19e** — **Script load-order normalization:** DONE (d52ffac). taxengine.js now loads before core.js in retirement_optimizer.html.
- [ ] **P19f** — **State coverage (13 of 51 jurisdictions uncoded):** LA/UT (flat, easy). 11 graduated states (AR/DE/HI/KS/MO/NJ/NM/OK/RI/VT/WV) — MO/WV need year-keyed rate tables (active phase-downs, same pattern as GA/NE/KY); AR/DE/MO/NJ/NM/RI/VT/WV need per-state partial-SS-taxation thresholds; NJ needs a >$1M surtax bracket; VT needs a low-income exemption rule. RI/VT CPI-indexing is actually free (already the default). See the review plan file for the full per-state breakdown.
- **Status:** mostly complete. Round 1 (circular-dependency fix + 5 low-risk items): 324447f, PR #105. Round 2 (bracket-walk dedup, alias unification, IRMAA fixes, load order, plus Medicare growth now uses user CPI inputs instead of hardcoded 5.6%): d52ffac, 2026-07-07, node 51/51 + browser 240/240. Only state coverage (13 states) remains — verified 2026-07-10 (taxengine.js header still "38 of 51 jurisdictions included").
- **Independent:** no phase dependencies for the remaining items

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

## P23: MC Arithmetic-Mean Returns + AR(1) Variable Inflation (GBM mode)
**Why:** GBM mode currently draws returns in log-space with an Itô correction (`logDrift = mu - 0.5*sigma*sigma; shock = logDrift + sigma*boxMuller(rng); annualReturn = Math.exp(shock) - 1`), duplicated in 3 places: `montecarlo/worker.js:95-109` (canonical), `montecarlo/mc_controller.js:170-182` (`_runMCMainThread`, file:// fallback), and `montecarlo/mc_controller.js:66-84` (`calibrateMCMs`, timing probe). Separately, GBM-mode inflation is a flat constant — `inflationSequence` stays `null` for GBM (worker.js:152-158 only builds it for bootstrap/stress), and core.js:956 falls back to the fixed rate: `inputs.inflationSequence?.[y] ?? inputs.inflation`. UI documents this today at retirement_optimizer.html:456 ("Synthetic: ... inflation is fixed"). User wants GBM to use an arithmetic mean instead of log-mean, and GBM inflation to follow a mean-reverting AR(1) model instead of being flat.

**Decisions confirmed with user:**
1. **Arithmetic mean = plain normal walk**, not a re-derived lognormal correction: `annualReturn = Math.max(RETURN_FLOOR, mu + sigma*boxMuller(rng))`, dropping log-space/Itô correction entirely. This technically leaves GBM for a normal-return walk, matching the user's literal framing. Clamped at `RETURN_FLOOR = -0.85` (new const in prng.js, alongside `INFLATION_FLOOR`) per user instruction, closing the theoretical <-100% tail risk of an unclamped normal draw.
2. **AR(1) variable inflation is default-on for all GBM users** (not nerd-knob gated) — only the persistence/shock-stddev tuning knobs are nerd-gated, mirroring how `mc-mu`/`mc-sigma` already default-drive GBM without requiring the nerd panel.

**Code pattern — new consts + helper (montecarlo/prng.js, after `boxMuller()` at line 23):**
```javascript
const RETURN_FLOOR = -0.85; // clamp for arithmetic-normal GBM draws (alongside INFLATION_FLOOR)

// AR(1) mean-reverting inflation draw for GBM mode: reverts toward `target` at rate
// `persistence` (0 = no memory, near 1 = highly persistent), plus a random shock.
function computeNextInflation(prev, target, persistence, shockStdDev, rng) {
    const shock = shockStdDev * boxMuller(rng);
    const next = target + persistence * (prev - target) + shock;
    return Math.max(INFLATION_FLOOR, next);
}
```

**Code pattern — GBM branch, worker.js:95-109 (mc_controller.js:170-182 mirrors this exactly):**
```javascript
} else {
    // GBM (default): arithmetic-normal return walk (Phase P23), clamped at RETURN_FLOOR.
    // scenarioBank now stores the FINAL return directly (not a log-space shock).
    const inflationTarget      = cfg.inflationRate ?? 0.03;
    const inflationPersistence = cfg.inflationPersistence ?? 0.65;
    const inflationShockSd     = cfg.inflationShockSd ?? 0.012;
    medianAnnualReturn = mu;   // symmetric normal pre-clamp: mean === median, no exp() needed
    scenarioBank = new Float64Array(numPaths * years);
    gbmInflationBank = new Float64Array(numPaths * years);
    for (let p = 0; p < numPaths; p++) {
        let prevInflation = inflationTarget;
        for (let y = 0; y < years; y++) {
            const r = Math.max(RETURN_FLOOR, mu + sigma * boxMuller(rng));
            scenarioBank[p * years + y] = r;
            if (r < minAnnualReturn) minAnnualReturn = r;
            if (r > maxAnnualReturn) maxAnnualReturn = r;
            prevInflation = computeNextInflation(prevInflation, inflationTarget, inflationPersistence, inflationShockSd, rng);
            gbmInflationBank[p * years + y] = prevInflation;
        }
    }
}
```

**Code pattern — downstream conversion + inflation wiring, worker.js:123-158 (mc_controller.js:200-238 mirrors):**
```javascript
// worker.js:127 — scenarioBank now stores GBM's final value directly, not log-space; skip exp()
returnSeq[y] = (simulationMode === 'bootstrap' || simulationMode === 'gbm') ? raw : Math.exp(raw) - 1;

// worker.js:152-158 — add a GBM branch alongside the existing bootstrap/stress one
let inflationSequence = null;
if ((simulationMode === 'bootstrap' || simulationMode === 'stress') && multiAssetBank?.inflation) {
    inflationSequence = new Float64Array(years);
    for (let y = 0; y < years; y++) inflationSequence[y] = multiAssetBank.inflation[p * years + y];
} else if (gbmInflationBank) {
    inflationSequence = new Float64Array(years);
    for (let y = 0; y < years; y++) inflationSequence[y] = gbmInflationBank[p * years + y];
}
```

**Code pattern — `calibrateMCMs` (mc_controller.js:66-84), drops the Itô correction (no inflation change needed — this function only probes timing):**
```javascript
function calibrateMCMs(cfg) {
    const { mu, sigma, seed, years, variations } = cfg;
    const rng = mulberry32(seed ?? 42);
    const returnSeq = new Float64Array(years);
    for (let y = 0; y < years; y++) {
        returnSeq[y] = Math.max(RETURN_FLOOR, mu + sigma * boxMuller(rng));   // was: Math.exp(logDrift + sigma*boxMuller(rng)) - 1
    }
    ...
```

- [ ] **P23a** — Add `RETURN_FLOOR` const + `computeNextInflation(prev, target, persistence, shockStdDev, rng)` to montecarlo/prng.js, next to `boxMuller()` (line 23)
- [ ] **P23b** — Update GBM branch in worker.js:95-109 per pattern above; add `gbmInflationBank` to the top-of-function `let` declarations (worker.js:16, alongside `scenarioBank, multiAssetBank, medianAnnualReturn, logDrift` — drop now-unused `logDrift` from this GBM path)
- [ ] **P23c** — Mirror the identical change in `_runMCMainThread`'s GBM branch, mc_controller.js:170-182, and its `let` declarations at mc_controller.js:98
- [ ] **P23d** — Update worker.js:127 and mc_controller.js:204 (`returnSeq[y] = ...`) to skip `Math.exp()` for `simulationMode === 'gbm'` as shown above (scenarioBank now stores final clamped values for GBM, same as bootstrap)
- [ ] **P23e** — Add the GBM `inflationSequence` branch to worker.js:152-158 and mc_controller.js:228-238 (`else if (gbmInflationBank)` pattern above)
- [ ] **P23f** — Update `calibrateMCMs` (mc_controller.js:66-84) to drop `logDrift`/Itô correction and apply `RETURN_FLOOR` per pattern above
- [ ] **P23g** — Add two new nerd-knob inputs to `#mc-nerd-panel` (retirement_optimizer.html:427-457), near `mc-sigma` (439-441): `mc-inflation-persistence` (number, default `0.65`, min `0`, max `0.95`, step `0.05`, unitless AR(1) coefficient — not a `%` field) and `mc-inflation-shock-sd` (number, default `1.2`, min `0`, max `10`, step `0.1`, treated as `/100` like `mc-sigma`), each with a `title=` tooltip following the existing convention
- [ ] **P23h** — Wire both new knobs into `_buildMCHash()` (mc_tab.js:108-120, so cache invalidates on change) and into the cfg object built in `runMonteCarlo()` (mc_tab.js:124-154, passed to `runMCWorker(...)` as `inflationPersistence`/`inflationShockSd`)
- [ ] **P23i** — Update stale UI copy that will become incorrect: retirement_optimizer.html:456 ("Synthetic: ... inflation is fixed") and mc_tab.js:282 ("Inflation ... (fixed)") — both need to describe the new AR(1) behavior; also mc_tab.js:276 label "(geometric)" → "(arithmetic)" since `medianAnnualReturn` now equals `mu` directly
- [ ] **P23j** — Optional/stretch: compute `inflationStats` (min/CAGR/max, same shape as bootstrap's, worker.js:66) from `gbmInflationBank` so the existing Input Distribution chart (mc_tab.js:792-810, `_inputInflationChart`) can render GBM's realized inflation spread instead of just the flat target — not required for correctness, only for parity with bootstrap's richer display
- [ ] **P23k** — Note (footnote only, not in scope): the GBM formula is duplicated across 3 sites (worker.js, mc_controller.js×2); a shared helper would reduce future duplication-drift risk but is a larger refactor — do not restructure as part of this phase
- [ ] **P23l** — Add node unit tests in `optimizer_core.test.js` (or a new small test file) for `computeNextInflation()`: reversion behavior (large deviation from target decays toward target over repeated calls with shock=0), floor enforcement (`INFLATION_FLOOR`), a statistical check that many draws of `mu + sigma*boxMuller(rng)` have sample mean/stddev close to `mu`/`sigma`, and a `RETURN_FLOOR` clamp test — `require` montecarlo/prng.js alongside taxengine.js/core.js in the header (`optimizer_core.test.js:29-35`). **Two stale details corrected 2026-08-06:** the file is no longer `retirement_optimizer_core.test.js` (renamed in `d0f4a00`), and there is no "vm test context" — the suite has loaded via `require()` since `86e26fa`.
- **Test:** In the browser, enable nerd knobs, run GBM-mode MC, confirm `msg.medianAnnualReturn` ≈ `mu` and the per-path `inflationSequence` passed into `simulate()` actually varies year-to-year (not constant) — spot-check via `console.log` in a manual run or a new browser-test-suite case in `optimizer_tests.js`
- **Test:** Confirm bootstrap/stress mode output is byte-identical before/after this change (their code paths are untouched)
- **Status:** pending
- **Independent:** no phase dependencies

---

## P24: Conversion END YEAR — a searched stop-year, NOT the diagnostic's boundary year
**Why:** Stopping Roth conversions partway through a plan can beat both converting to the end and converting nothing. The 2026-07-23 evidence sweep (`findings.md`, harness `stopyear_harness.js`) established the shape of the win across 23 scenarios: `gainVsFull >= 0` in every one, up to +$2.97M, scaling hard with growth and longevity; delivered spend is identical across every cutoff (`spendRange` $0), so it is a clean wealth/tax comparison. The tool currently gives the user no way to act on this, and the closest existing lever (zeroing `extraConversionAmount`) is worse than the right answer because it also throws away the profitable early conversions.

**CORRECTION — the diagnostic's boundary year is NOT the answer.** The original P24 (2026-07-21, n=1) assumed the ⓘ boundary year was the year to stop. Sweeping every cutoff overturned it: in the recorded scenario the true optimum is **2031**, not the diagnostic's 2043 — off by 12 years and **$662k**. `diagnoseConvBreakEvenFailure` answers "which conversion erases the lead for good" (the last cutoff that still breaks even at all), which is a much weaker condition than max after-tax wealth. In no scenario did the boundary year equal the optimum, and in 10 of 23 the diagnostic never fires while stopping early still gained $99k–$2.97M. **So P24 is a searched stop-year feature, and the ⓘ boundary year must NOT be presented as a "stop here" suggestion — it would be systematically wrong.**

**Design consequences locked by the evidence:**
- **Search, don't heuristic.** Four candidate shortcut rules all failed (marginal-rate crossing, IRA-share threshold, RMD/age rule, terminal-mix target — see finding §6). The stop year must be searched per plan.
- **Linear scan only.** The cutoff curve is not unimodal (up to 7 sign flips; step-function brackets/IRMAA). Cost is a non-issue: k+1 runs, ~46ms for a 26-year plan.
- **Stop ALL conversions by default.** Extra-only truncation is much worse ($23.47M vs $24.23M) and never breaks even at any cutoff — the late damage is the strategy's own bracket-fill, not the Extra. Per user decision, ALSO model extra-only (the user notes it is what a naive user expects), but label clearly that it is the weaker of the two.
- **The gain must be shown next to any suggested year.** In low-tax states the win is only ~$100k and a stop year off by ±2 goes NEGATIVE — worse than not stopping. A bare year suggestion with no dollar figure is a trap.

**Tasks:**
- [x] **P24a** — New input, **nerdknob-gated** (per user, until fully investigated): conversion END year (`#convEndYear`). Accepts BOTH forms in one field — <4 digits = age of person 1, ≥4 digits = calendar year (e.g. "2044" or "75"); blank = convert for the whole plan. Engine reads a public calendar-year `convEndYear`, OR'd into `_convSuppressedThisYear` / new `_extraConvSuppressedThisYear` (kept the internal `_cfSuppressConversionsFromYear` index flag as the counterfactual/search mechanism — one gate, two feeders). Nerd-gate follows the tax-creep pattern: hidden unless nerdknob OR a value is set (a shared URL must never hide a live cutoff). `getInputs` parses age→`birthyear1 + age`.
- [x] **P24b** — Scope selector (`#convEndMode`, nerd-gated): "all conversions" (default) vs "extra only". Engine: `convEndMode !== 'extra'` suppresses both surplus + extra past the cutoff; `'extra'` suppresses only the Extra path (`_extraConvSuppressedThisYear`). No per-year array needed for the single-run path.
- [x] **P24c** — URL param + `OPT_LONG_TO_SHORT` entries (`cey`/`cem`); leak-guard in `runOptimizer` (`base.convEndYear = undefined; base.convEndMode = 'all'`, mirroring the existing `base.extraConversionAmount = 0`).
- [x] **P24d** — **Engine search** `bestConversionStopYear(inputs, {mode})` (pure, exported): linear scan over cutoffs scored on the shared `afterTaxWealthOfLogRow` basis (factored out of the Break Even block so the two can't drift). Returns `{stopYearCalendar, stopIndex, atnwStop, atnwNoStop, atnwNoConv, gainVsFull, gainVsNone, beAtStop, convertsNothingIsBest, neverStopIsBest}`. Strips any pre-set stop year so it always searches from full conversions.
- [x] **P24e** — **Diagnostic rewired** (`updateStats` + `formatStopYearMessage` + `applyConvStopYear` + `toggleBreakEvenDiagnosis`): the ⓘ now leads with the SEARCHED year + dollar gain (never the boundary year), surfaces whenever conversions occur (not just when Break Even is blank), and the expanded panel offers a one-click "Stop after YYYY ▸" that fills the field and re-runs. Boundary-year sentence demoted to secondary color, shown only when Break Even is blank. Always shows the dollar gain (findings §7).
- [x] **P24f** — Tests (`optimizer_core.test.js`, 6 new, 108/108): unset → bit-identical; all-mode cutoff == internal `_cfSuppressConversionsFromYear` and zeroes conversions after Y with earlier years untouched; extra-mode leaves strategy bracket-fill running past Y; `bestConversionStopYear` finds the interior optimum, dominates full+none, self-consistent when applied through the public input; search strips a pre-set stop year; `afterTaxWealthOfLogRow` matches the BE formula.
- [ ] **P24g** — **DEFERRED — Optimizer sweep dimension over the stop year** (user chose "measure cost first"). No per-row stop-year column ships this round because the leak guard strips `convEndYear` from every optimizer row; the calendar-year display contract is already met in the single-scenario surfaces (diagnostic message + one-click apply). When wired: measured cost is one k+1 linear scan per plan; the concern is multiplying it across the ⇌ candidate pool × the amount grid — the joint (amount × stop) grid is where the real value is (finding §3: C−D was +$228k to +$1.887M). Optimizer table then displays the stop as a **calendar year** even when entered as an age.
- **Status:** IMPLEMENTED and MERGED (v11.1330, confirmed present on `origin/main`). Node 108/108 + taxPaymentPlanner 12/12 at the time. Only the optimizer sweep dimension deferred.
- **Independent:** no phase dependencies; the diagnostic (PF6/PF5) and the counterfactual engine flag both already existed.

---

## P26: README/FAQ cross-references from tooltips (pending, deferred 2026-07-28)

**Why:** several tooltips and banners restate material that already exists under `## Frequently Asked Questions` in `README.md` (anchored headings such as "Is It a Fool's Errand to Make Multi-Decade Projections?", "Is the Break-Even Tax Rate Trustworthy?", "Why does the Optimizer say converting never helps?"). Pointing at those anchors keeps one source of truth and shortens the in-app text.

**Needs:** a pass to decide which existing text has a matching FAQ entry, which needs one written, and where the link should land. The "where does the reader land" question is settled by P25: link at `README.md#<anchor>` and `doclinks.js` maps it to `/#<anchor>` on the live site while leaving the file link intact locally. Note kramdown's generated ids, not GitHub's: check the rendered `/` for the exact id before hardcoding one.

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

## P28: "Every voluntary IRA withdrawal is a Roth conversion" (2026-07-30) — RESEARCH DONE, feature decision open

**Why:** user proposal — a nerdknob that models every voluntary (non-RMD) IRA withdrawal as a Roth
conversion, spending then drawn out of Roth. Asked whether it simplifies the logic, whether it is
provably better, and which strategies would have to change.

Built as a harness first rather than a feature, because static reading of the engine said the switch
was a no-op and P24's history says not to ship that kind of conclusion on theory. Both halves of the
call turned out right and wrong in useful ways.

**Delivered:** `.test_harnesses/unifiedconv_harness.js` (node, registered in the harness README), two
engine flags defaulting off and set by nothing in the UI, and two hidden log keys.

| flag | what it does | verdict |
|---|---|---|
| `unifiedConvRouting` | the voluntary draw is reported as conversion gross; spending round-trips via Roth | **inert** — 0 money fields move in any of 6 families |
| `rothGapFill` | Roth promoted from LAST to FIRST resort in the gap fill (`ordered` excluded) | **the real lever** — up to +$269k / -$137k |

**Answers to the three questions asked:**
- **A. Simplify or complicate?** Simplifies the decision space (one lever per year, not two);
  changes nothing in the tax math, because the engine already taxes the whole voluntary draw as
  ordinary income wherever the dollars land (`optimizer_core.js:1711-1716`). Complicates the engine
  only if Roth-first comes with it.
- **B. Provably better?** No. Provably NEUTRAL, and now measured neutral. The proposal as written
  would ship a switch that changes no number in the tool.
- **C. Which strategies change?** Only the ones that leave a spending gap for `fillSpendingGap`.
  **Proportional is unreachable** — it funds spending inside `planPrimaryWithdrawals`. `ordered` is
  excluded by instruction and verified identical in all seven arms.

**The presumption ("reduction past some point becomes counterproductive") was already proven**, in
this repo, by the P24 evidence sweep: `gainVsFull >= 0` in all 23 scenarios, up to +$2.97M. The
shipped lever is `convEndYear`. That is a step function; the taper generalization is P5.

**Found in passing, and the most reusable result:** `rothConv` and `yr.totalConverted` are engine
state, not display fields — `beginYear` reads `log[y-1].rothConv > 1000` to choose withdrawal
timing. See `findings.md`, "A log field the next iteration reads is engine state, not a label".

- [x] **P28a** — Harness with identity / degeneracy / divergence / mechanism sections and scored predictions
- [x] **P28b** — Two engine flags, default off, `ordered` excluded from both
- [x] **P28c** — `-unifiedConvGross` / `-unifiedRothSpend` hidden log keys (do NOT reuse `rothConv`)
- [x] **P28d** — Verified: node 148/32/22, in-page 242/242, browser A/B confirms routing 0 diffs / Roth-first 627
- [x] **P28e** — **ROUND 2 (2026-07-30):** second scenario set run — 5-scenario ladder x 6 families x 7 arms.
      Explains round 1's inconsistent sign and fixes it. `rothGapFill` now takes a POSITION:
      `true`/`fillRothThenCash` (ahead of everything) or `fillCashThenRoth` (Cash, then Roth, then Brokerage).
      `fillCashThenRoth` never destroys value in any of 20 comparable cells, where `fillRothThenCash` lost up to
      $137,062. Full detail in `findings.md`, "P28 round 2".
- [ ] **P28f** — **DECISION OPEN:** ship `rothGapFill: 'fillCashThenRoth'` as a real option, drop the routing
      flag (inert in all 30 scenario x family cells), or delete both. The routing flag earns its
      keep only if the Annual Details reframe is wanted as a *view*, which `-unifiedConvGross`
      already makes possible.
- [ ] **P28g** — If shipping: it is a per-family effect, not a global one. Proportional draws Brokerage in
      `planPrimaryWithdrawals` so the gap-fill order is not its lever, and Guyton-Klinger is not
      comparable at all (its guardrails re-cut spending). Ship it for the gap-filling families or
      as an optimizer sweep dimension, not as one global switch.
- [ ] **P28h** — No heuristic predicts the payoff from the account mix — both candidate shortcuts were scored
      and failed. If it ships, the tool has to RUN it, the same conclusion P24 reached about the
      stop year.
- [x] **P28i** — **ROUND 3 (2026-07-30):** answered "does `convertExcessToRoth` ever lose on its own?" — **yes,
      13 of 25 cells, worst -$1,095,454**, for the same Cash-buffer reason plus a hidden
      withdrawal-timing flip. Added `forceWithdrawTiming` (research input, default off) to separate
      the two. Full write-up now lives at `.test_harnesses/P28_RESULTS.md`.
- [ ] **P28j** — **SPUN OFF, needs its own phase:** `convertExcessToRoth` is a DEFAULT-FACING switch that can
      cost >$1M in plausible account mixes, and part of that is the early/late withdrawal-timing rule
      keying off `rothConv` — invisible and uncontrollable from the UI. Decide whether timing should
      key off conversion at all. This is a live product question, not a research curiosity.
- [x] **P28k** — **ROUND 4 (2026-07-30):** spend rate added as a CONTROLLED AXIS (4/6/8% of assets) after the
      user spotted the goals were high. Round 2 had confounded mix with strain (defaults sat at 8.6%,
      the rest near 4.4%). 630 sims, ~1.2s. **Three earlier conclusions overturned** — payoff peaks
      at 6% spend rather than growing with Brokerage share, "IRA Draw is unreachable" was
      strain-specific (+$1,200,484 at 6%), and `fillCashThenRoth` DOES have one negative cell. Mechanism
      came out sharper: every cell whose control never drew Brokerage returns exactly $0.
- **Status:** research complete (4 rounds), feature not started
- **Independent:** no phase dependencies

---

# Batch added 2026-08-01: P29-P34

Six phases from a user punch-list. **Four of them touch questions this repo has already partly
answered, and two were answered NO.** Each carries an explicit "Already ruled out" block; that block
is as much the deliverable as the task list, and it exists to stop a re-derivation of P24 and P28.
Recommended run order is rows 31-36 of the Priority Order table above (P33, P34, P30, P32, P31, P29),
not phase-number order.

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

## P30: Withdrawal policy — the constants nobody chose, and whether strategy should imply order at all

**Why:** the gap fill has three mutually exclusive orderings (`optimizer_core.js:1516-1556`) and which
one a user gets is a **side effect of the spend strategy they picked**, not a choice they made. Fill
Bracket gets Cash, then Brokerage, then Roth, strictly sequential (`optimizer_core.js:1520-1534`).
Proportional / Reduce / GK get Brokerage+Cash blended at a hardcoded `[40, 60]`
(`optimizer_core.js:1543` — verified a bare literal with no comment justifying it) then Roth. Ordered
gets the user's own sequence. Nobody chose the 40/60. Nobody chose that the bracket family drains Cash
to zero before touching Brokerage. Both constants sit directly on the code path P28 measured at up to
+$3,559,596.

**Scope — the user chose the FULL withdrawal-policy review (2026-08-01).** Three parts, in this order:
1. The two unchosen constants.
2. The orderings beyond the three shipped ones. `resolveOrderedSeq` (`optimizer_core.js:709-719`)
   implements CBIR (default), RIBC and BIRC. 24 orderings of four accounts exist. Harness-only;
   shipping any subset is a separate decision.
3. The structural question: **should strategy choice keep implying gap-fill order at all?** Today
   `yr.isBracketStrategy` / `yr.isOrderedStrategy` route the gap fill, so picking a *spend* strategy
   silently picks a *sourcing* policy. Decoupling them is the largest change in this phase and is
   design work rather than a sweep — cost it before committing to it.

**Falsifiable questions:**
- **Q1.** Is `[40, 60]` better than any other weight? Sweep w in {0, 20, 40, 60, 80, 100}. A flat curve
  is a real result: "the constant is not load-bearing" ends part 1 and is worth recording.
- **Q2.** Is Cash-before-Brokerage right for the bracket family? The two are not symmetric — Cash earns
  `cashYield` taxed as ordinary income, Brokerage realizes LTCG and steps up basis. P28's mechanism
  settles Roth-vs-X and says nothing about Cash-vs-Brokerage.
- **Q3 (prediction to state up front and score).** P28's "no Brokerage draw, no lever"
  (`.test_harnesses/README.md:79-81`) predicts the weight is inert wherever Brokerage is never touched.
  If the prediction holds, Q1's answer is conditional, not global.
- **Q4.** Does any of the 21 unimplemented orderings beat all three shipped ones?
- **Q5.** How many rows would change if gap-fill order became independent of spend strategy?

**Design decisions forced by the evidence:**
- The weight must become a research **input** before it can be swept: `gapFillWeights`, default
  `[40, 60]` so unset is bit-identical. Same shape as P28's research inputs.
- Score on `baselineScoreOf` (`optimizer_core.js:2799`), not `finalNW` — PF11 established `finalNW` is
  orthogonal to "would this change help."
- Exclude `ordered` from the weight sweep, for the reason P28 excludes it (`optimizer_core.js:1511`):
  it has its own order.
- **Do not touch `resolveResidualAndForcedIRA` in this phase.** That is P32.

**Already ruled out — do not re-derive:**
- Roth's position in the gap fill. P28 rounds 2+4, 630 sims, `fillCashThenRoth` established. What
  remains there is a **ship** decision (P28's open checkbox), not research.
- Whether the three shipped `orderedSeq` sequences matter — already swept (`optimizer_ui.js:841`).
- The unified-conversion reframe — measured inert, 0 money fields moved in 90 cells.

**Tasks:**
- [ ] **P30a** — `gapFillWeights` research input, default `[40,60]`, no UI, `ordered` excluded
- [ ] **P30b** — Harness: weight sweep x P28 mix/spend ladder x gap-filling families; predictions scored
- [ ] **P30c** — Q2 arm: bracket-family order Brokerage-before-Cash as an explicit alternative
- [ ] **P30d** — Q4 arm: the remaining orderings of four accounts, harness-only
- [ ] **P30e** — Q5: cost the decoupling (new input vs derived), count affected rows, do NOT build yet
- [ ] **P30f** — Report against P28's zero-predicate: split cells by "did the control ever draw Brokerage"
- [ ] **P30g** — Decision: change the default, expose a control, decouple, or record that the constant is inert
- **Status:** not started, research-first. **Harness:** `.test_harnesses/gapfill_harness.js` (node — a
  new file, NOT an extension of `unifiedconv_harness.js`, which is already a four-round document with
  `P28_RESULTS.md` as its reference)
- **Depends on:** no code dependency. Its *ship* decision is downstream of P28's open decision —
  settle both in one batch or the weight question shifts underneath it.

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

## P32: Brokerage is barely drawn — why, and is the third-pass exclusion still right?

**Why:** three observations converge on one place. (1) The user reports Brokerage draws not occurring
as expected. (2) The repo has already measured that this is load-bearing: every cell whose control arm
never touched Brokerage returns exactly $0 (`.test_harnesses/README.md:79-81`, findings.md:1057-1062).
(3) **Gain harvesting already exists and most users never see it** — the cyclic modifier maxes out the
LTCG bracket *on purpose* even when spend does not need the money (`optimizer_core.js:1301-1303`, a
deliberate basis step-up), and its target-bracket knob `cycleLTCGTarget` (default 0.15 = target the 0%
bracket) is nerdknob-gated (`optimizer_ui.js:86`).

This phase is **both** halves of the framing question, because they are one investigation: "why so
little Brokerage" is a list of five draw sites and three exclusions, and "why isn't harvesting
selected" is whether cyclic ever wins. Splitting them would make each half read the same code.

**The three exclusions — design decisions to re-examine, not bugs:**
1. **The third pass excludes Brokerage deliberately** (`optimizer_core.js:1596-1600` — verified). The
   stated reason is a cap-gains spiral: more gains → higher SS taxation → bigger residual → repeat.
   The reasoning is sound and it is **unmeasured** — the comment asserts a spiral and cites no run.
   Falsifiable: with a Brokerage leg allowed and a bounded iteration count (the forced-IRA loop at
   `optimizer_core.js:1649-1672` already establishes the 4-iteration convergence pattern in this
   engine), does it actually diverge, and on how many scenarios? If it converges, this exclusion is
   costing the tool the exact lever P28 valued at up to $3.5M.
2. **The forced-IRA convergence loop never considers Brokerage** (`optimizer_core.js:1649-1672`) — it
   forces IRA *above the ceiling* while a Brokerage balance may sit untouched. The counterfactual is
   starker here: forced IRA is ordinary income at the marginal rate, a Brokerage draw may be LTCG at 0%.
3. **The Cash-Reserve breach** (`optimizer_core.js:1677-1688`, sets `yr.cashBreach`) fires before
   Brokerage is reconsidered.

**Two accounting facts to check BEFORE concluding anything about behavior:**
- Brokerage growth **excludes** the dividend rate (`optimizer_core.js:743`) while IRA and Roth include
  it (`:740-746`); dividends are then accrued separately on the **pre-withdrawal** balance
  (`optimizer_core.js:1152`, whose own comment at `:1150` calls it "APPROXIMATE worst case"). Brokerage's
  total return is assembled differently from every other account. A systematic understatement here
  would suppress Brokerage draws everywhere with no strategy logic being wrong.
- Basis is a **single aggregate scalar** with proportional consumption (`optimizer_core.js:165-182`):
  `basisChange = basis * (withdrawal/balance)`. No lot selection, so the tool cannot model HIFO or
  specific-ID — the single largest real-world lever on "raise cash without raising gains." That is a
  **modeling ceiling** bounding what this phase can honestly claim. Name it; do not build lots.

**Falsifiable questions:**
- **Q1.** In the shipped sweep, what fraction of rows ever draw Brokerage, by family? Predict from the
  five draw sites first, then measure, then score the prediction.
- **Q2.** Does allowing Brokerage in the third pass diverge, converge, or improve? Three arms: off /
  bounded / unbounded-with-a-counter — the last exists to prove the spiral is real or is not.
- **Q3.** Does cyclic ever *win* the sweep? It is already a x2 dimension (132 of ~177 rows), so this is
  a scan of existing results, not a new run. If it never wins, that is the answer to "why isn't
  harvesting used."
- **Q4.** Is `cycleLTCGTarget` correctly defaulted and correctly gated? If the 0.20 arm (target 15%)
  ever wins materially, a nerdknob is hiding a real lever.
- **Q5.** Does "max the bracket out anyway" (`optimizer_core.js:1301-1303`) pay? It costs nothing at 0%
  LTCG but raises MAGI, which feeds IRMAA and SS taxation. A/B against a spend-only harvest.

**Already ruled out — do not re-derive:**
- Brokerage share as a ranking heuristic (findings.md:962-966), non-monotone. Do not build "draw
  Brokerage when share > X."
- The zero-test "no Brokerage draw, no lever" is established and is a *prune*, not a ranking. Reuse it;
  do not re-measure it.
- Whether Roth belongs before Cash — P28.

**Tasks:**
- [x] **P32a** — Q1 scan FIRST — it may reframe everything that follows. **DONE, and it did.** 5 scenarios x 11
  arms, 55 rows, **zero rows never draw Brokerage**; baseline 90.4% of years from year 0, bracket
  61.1%, cyclic 57.5%, ordered 44.7%. Prediction P3 scored WRONG (BIRC draws Brokerage first and so
  has none left later). **"Brokerage is barely drawn" is false as a general claim.**
- [x] **P32b** — Audit the two accounting facts before running any behavior arm. **DONE, and it paid for the
  whole phase.** Not an understatement, an **over**-credit: `yr.taxableDividends` counted as income
  *and* credited to the balance with nothing debiting it back. Fixed in `e9a3c8b` (v11.146f).
- [ ] **P32c** — Research inputs, default off, P28 pattern. **HALF DONE 2026-08-10:**
  `cycleHarvestMode` ('maxbracket'|'spendonly') and `cycleCoexist` ('off'|'bracketfill') SHIPPED
  in the `:1432` branch with absent≡off byte-identical tests + leak guard + MAGI-tier invariant
  (suite 238/238). STILL OPEN: `thirdPassBrokerage` ('off'|'bounded') and `forcedIRAAllowBrokerage`
  — those serve P32d's Q2, orthogonal to the cyclic pair.
- [ ] **P32d** — Q2 with an explicit iteration counter, so "spiral" becomes a measured claim either way.
  **Was moot pre-fix; now unblocked and worth re-asking on a corrected engine** — but re-run Q1's
  numbers first, since they were measured on the double-crediting engine.
- [x] **P32e** — Q3/Q4 DONE 2026-08-10 (`.test_harnesses/P32_RESULTS.md`). Q3: cyclic wins 26/45
  cells as shipped but HALF is the surplus-routing confound — a `CashReserve: 0` control still wins
  23/45 at half the magnitude ($891k max). Q4 INVERTED: `cycleLTCGTarget 0.20` moves 898/2,576
  pairs and wins 53 — the nerdknob gate is protecting users, not hiding a lever; 0.15 confirmed.
  Q1 re-run post-fix: three families UP, cyclic −0.8pt, never-draw still 0/55.
- [x] **P32f** — Q5 DONE 2026-08-10 (q5, `P32_RESULTS.md`). **INVERTED**: maxbracket wins only
  108/2,514 pairs (4%); spendonly gains to +$396k. Post-§1014 (v11.1499) a held-to-death harvest
  has no terminal payoff, only MAGI costs — the top-off is a pre-step-up design.
- [ ] **P32g** — Record the aggregate-basis modeling ceiling as a README limitation regardless of outcome
- [ ] **P32h** — Decision: re-scope the third-pass exclusion, un-gate `cycleLTCGTarget`, or record and keep.
  Evidence now in: Q4 says keep the gate + keep 0.15; Q5 says the harvest top-off itself is suspect
  post-step-up (a `spendonly` default flip would be a behavior change needing its own ship decision);
  Q6 says coexist must stay research-only absent arm-aware gating. P32d (Q2) still missing.
- [x] **P32i** — Q6 DONE 2026-08-10 (q6, `P32_RESULTS.md`). Median NEGATIVE (−0.73%): the harvest
  skip was accidentally protective for aggressive ceilings (Fill Bracket 35% −$2.1M) while measured
  arms genuinely gain (IRA Draw 5-8% up to +$808k). The money-on-the-table is real but reclaiming
  it blindly loses; shipping would need arm-aware gating (axis-property + pinned-test bar applies).
- **Status:** **research half DONE and merged** (PR #155 third-pass state tax, PR #156 brokerage
  research + the dividend fix). Q1 answered, premise refuted, accounting defect found and shipped.
  **Open: Q2-Q5 and the build/decision tail.** **Harness:** `.test_harnesses/brokerage_harness.js`
  (node), results to a sibling `.md` if large
- **Depends on:** shares the gap-fill path with P30. Sequencing preference, not a hard dependency: run
  P30 first so the `[40,60]` question is settled before the third-pass arms move the same numbers.

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

## P34: The cost of finding a profitable conversion — where the time actually goes

**Why — the honest answer up front:** the search itself probably cannot be shortened safely. Every
heuristic tried in this repo has failed, several of them *silently*. But the search is also not where
most of the wall clock goes. The two largest structural costs are not algorithmic: the optimizer sweep
runs **entirely on the main thread** and blocks it for 0.8-2.5s (only Monte Carlo uses a worker), and
the cache is a **single all-or-nothing hash** (`optimizer_ui.js:692-701`, key state
`_lastOptimizerHash` at `:541`) — one character in any sidebar field re-runs all ~177 rows. There is no
per-row memo, no `simulate()` memo, no shared-prefix reuse across cutoffs, no incremental
re-simulation. Those two are worth more than any heuristic and **neither can produce a wrong answer**.

**Tier 1 — zero risk of a wrong answer. These change WHEN work happens, not WHAT is computed:**
1. **Move the sweep to a Web Worker.** `optimizer_core.js` is DOM-free by contract (`:4-9`), so it is
   portable in principle. **One real blocker, named:** `simulate()` mutates two module globals —
   `simulationCount` (`:2306`) and `STATEname` (`:2307`). `STATEname` is a genuine hidden dependency;
   two workers on two states would race. Also `new Date().getFullYear()` is read when `startInYear` is
   unset (`:1715`, `:2309`, `:2322`), so a worker must be pinned to the same year or results differ
   across midnight. Payoff: the UI stops freezing. Total CPU unchanged.
2. **Split the cache in two.** The hash is *already* computed in two pieces — `base` is hashed AFTER
   the conversion fields are stripped, with a `;cur=` tail re-adding them. That is one step from a
   two-level cache: the 44-arm no-conversion sweep does not depend on conversion fields at all, so
   typing in Extra Conversion should not re-run it. **Risk to control:** cache-key omission — a field
   not in the key but read by `simulate()` yields a stale row, the silent-wrongness class. Mitigation
   is mechanical and is a required task: assert the key covers every field `getInputs()` produces, with
   a test that fails when a new input is added. This exact mechanism already caused a near-miss
   (findings.md:65, verified live $564,869 → $983,705).
3. **Stop calling `bestConversionStopYear` eagerly.** It runs on every `updateStats()` whenever
   conversions occurred (`optimizer_ui.js:2509-2513`) — a per-keystroke-debounce path — at n+2 sims
   (~46ms for a 26-year plan), to fill a tooltip the user may never hover. Make it lazy on
   hover/expand, or reuse the last result when the input hash is unchanged. Zero risk.
4. **Memoize `simulate()` on an input hash.** None exists anywhere. Within one sweep the same inputs
   recur (no-conv baseline arm, OC re-runs, counterfactuals). **Measure the hit rate before building**
   — it may be near zero, and that measurement is the deliverable.

**Tier 2 — bounded risk, must be diffed against the sweep it replaces:**
5. **Coarse-to-fine on `optimizeConversionAmount`** (`optimizer_core.js:3016-3049`). This is the **one
   pre-authorized** optimization already on record in this file (PF11: "$5M+ IRAs cross the run budget
   (~2624 runs) → open a coarse-to-fine ($100k coarse then $25k refine) phase if a user hits it").
   Cost today is `ceil(totalIRA/25000)+1`, measured exactly 17 / 81 / 201 sims at $400k / $2M / $5M.
   **The risk is real and already documented:** findings.md:85 is exactly this failure — a coarse
   8-point evenly-spaced amount grid **silently invented wrong answers**, reporting "never pays up to
   75%" when the true answer was 48%, and 25% against a true 15%, because paying amounts are only ~16%
   of the IRA and an even grid steps straight over them. $100k coarse on a $5M IRA is a 50-point grid,
   not an 8-point one, and the refine window must be wide enough to recover the *neighbors* of the
   coarse winner, not merely bracket it. Acceptance is not "it is faster" — it is a **diff against the
   full sweep on several scenarios** (findings.md:88), including both known traps.
6. **Early exit on a declining score in `optimizeConversionAmount`.** There is none today. Tempting,
   and dangerous for the same reason P24 §7 recorded on the cutoff axis (findings.md:535-546: 1-7
   first-difference sign flips, 7 at growth 10%). **Whether the AMOUNT axis is unimodal has never been
   measured.** That measurement is a legitimate task and a hard prerequisite: no early exit ships
   without it, and if the axis is not unimodal the answer is no.

**Tier 3 — ruled out, do not propose:**
- Binary or ternary search on the **cutoff** axis (findings.md:535-546) — not unimodal, converges on
  the wrong answer **undetectably**. Cost was never the argument for the linear scan; it is 46ms.
- Any stop-year heuristic (P24 §6, findings.md:515-533): marginal-rate crossing **pins at 33.3% in
  every year and cannot discriminate at all**; IRA share ranges 4-78%; age/RMD offsets run -15 to +14;
  terminal-mix target failed.
- "No IRA left at the end" as a skip filter (findings.md:86) — "looked obviously safe and lost the
  right answer on a $3.3M scenario (reported 25% against a true 5%)."
- Any account-mix ranking heuristic (findings.md:962-966).
- BETR as a screen (findings.md:559-585) — wrong in both regimes in opposite directions; the column and
  tile were already removed.

**The bar any Tier-2 item must clear, stated as a template.** `breakEvenHeirsRate()`
(`optimizer_core.js:3093-3126`) uses binary search **legally**, and only because monotonicity in the
rate axis was *measured* across five scenarios (findings.md:123-125) and is *pinned by a test*
(`optimizer_core.test.js:1856-1868`). Measure the axis property, then pin it with a test that fails if
the property stops holding. Nothing else qualifies.

**Two costs nobody has on a list, worth pricing here.** `bestTimeLimitedConversion`
(`optimizer_core.js:3141-3209`) at ~148 sims per candidate is **already capped at 6 candidates**
(`optimizer_ui.js:1047-1049`) because all 12 pushed one run to 2,216 sims past the 1,500-run budget —
that cap is a silent quality reduction, and Tier-1 wins may buy the budget back to restore it. And the
Break Even dual-sim (`optimizer_core.js:2455-2498`) is +1 sim per converting row (measured 1.96x /
+74ms on a 144-row sweep) whose second counterfactual `cfExcess` (`:2494`) fired on **0 of 144 rows**
(findings.md:53) — a candidate for removal or a cheap guard.

**Falsifiable questions:**
- **Q1.** Where does the time actually go? Predict the split from the inventory (~177 sweep sims, +12
  candidates x `ceil(IRA/25k)`, +6 x ~148 time-limited, +1 per converting row for BE), then
  instrument, then score the prediction.
- **Q2.** Is the conversion **amount** axis unimodal? (gate for Tier-2 item 6)
- **Q3.** What is the `simulate()` memo hit rate within one sweep? (gate for Tier-1 item 4)
- **Q4.** Does a two-level cache change any displayed number? The answer must be zero.

**Tasks:**
- [ ] **P34a** — **Baseline profile FIRST**, before P29/P31/P32 add sweep arms, so later phases have a comparison
- [ ] **P34b** — Q1 instrumentation with scored predictions
- [ ] **P34c** — Tier-1 #3 (lazy stop-year) — smallest, zero-risk, ship it standalone
- [ ] **P34d** — Tier-1 #2 two-level cache + the key-coverage test that fails when a new input is added
- [ ] **P34e** — Q3 memo hit-rate measurement; build the memo only if the rate justifies it
- [ ] **P34f** — Tier-1 #1 worker: resolve the `STATEname` / `simulationCount` module-global mutation and pin the
      current year, or record why it is deferred
- [ ] **P34g** — Q2 unimodality measurement on the amount axis; pin with a test if it holds
- [ ] **P34h** — Tier-2 #5 coarse-to-fine, **only** with a full-sweep diff on several scenarios including the
      findings.md:85 and :86 traps
- [ ] **P34i** — Re-check the 6-candidate cap on `bestTimeLimitedConversion` after Tier-1 lands
- **Status:** not started. **Research-first** on Q1-Q3 (harness `.test_harnesses/searchcost_harness.js`,
  node), **build-first** on Tier-1 items 1-3, which need no research
- **Depends on:** its measurement half should run **before** P29/P31/P32 add sweep arms; its build half
  last.

---

# Batch added 2026-08-03: P35-P37

A user design proposal for a **"Phased"** withdrawal strategy, its study, and one deferred phase.
Full design in the session plan file `C:\Users\starc\.claude\plans\composed-marinating-garden.md`;
the engine evidence is in `findings.md` under **"P35 engine survey"** (2026-08-03).

**Read the survey first.** It contains ten verified facts, several of which are traps where the
natural implementation lands on the wrong side and produces a plausible wrong answer rather than an
error. The sharpest one is item 1, restated here because it will otherwise be rediscovered the hard
way: **the engine's `isDeathYear` (`optimizer_core.js:1103`) is the FIRST SINGLE year, not the last
MFJ year.** `alive = age <= die`, so `age === die` is the last year both spouses live and the last
`'MFJ'` year; `age === die + 1` is what `isDeathYear` tests. A feature wanting the married window
needs the earlier year and a differently-named flag.

**Work is staged.** Each PR below is a review point. Nothing that moves numbers lands before the
harness that can measure it.

---

## P35: "Phased" withdrawal strategy — one strategy that switches by life phase

**Why:** P13 (Multi-Strategy Segment Optimizer, row 15, pending since before the current batch)
proposes sweeping strategy-per-segment: 3 segments x ~42 strategies ~= 74k combos filtered to ~10k.
P35 answers the same need from the other direction — **one strategy that switches internally**, so the
search space grows by ~4 rows instead of ~10,000. If P35 ships and ranks well, P13 should be
explicitly retired rather than left pending.

**The user's design, and the refinement that makes it cheap.** Phases: 0 ACA (to 65), 1 IRA_CONTROL,
2 BALANCED, 3 FIRST_DEATH, 4 SURVIVOR, 5 LEGACY. The user then merged 1 and 2: *"for the portion of
the IRA above the target, do IRA control; if any shortfall still exists, use BALANCED."* That removes
the state machine, the two-way switch and the hysteresis question entirely — and it maps onto
machinery that **already exists**:

- `yr.curIRA = Math.max(0, IRA1 + IRA2 - yr.iraGoalNominal)` (`optimizer_core.js:1181`), computed every
  year after RMDs, before `planPrimaryWithdrawals`. This *is* "the portion above the target."
- `yr.iraGoalNominal = inputs.iraBaseGoal * sim.cpiRate` (`:920-921`) — the IRA Goal input already
  exists (`#iraBaseGoal`, `retirement_optimizer.html:189-192`, default $750,000, today's dollars,
  ungated, round-trips as `ibg`). **No new target input is to be invented.**
- `yr.additionalSpendNeeded` (`:1232`) is the BALANCED budget.

**IRA_CONTROL rules A and B collapse to one expression:**
`iraControlTarget = Math.abs(sim.prevIRAGain) * (1 + inputs.phasedControlPct)`.
The `Math.abs()` is load-bearing: a naive `prevIRAGain * (1+pct)` goes negative in a down year and
clamps to zero, the exact opposite of rule B. With the absolute value, a -$200k year and a +$200k year
both target $220k at 10%, so the IRA is drawn hardest precisely when conversion is cheapest. One knob
satisfies both rules and is the smallest thing that can be swept. **`sim.prevIRAGain` is new** —
`sim.gkPriorReturn` is assigned only inside the GK branch (`:2276-2277`) and is unreachable; but
`'-iraG'` (`:856`) already logs the quantity.

### Settled decisions (user, 2026-08-03)

| Decision | Value |
|---|---|
| Bundling | Phased **+ basis step-up together**; LEGACY split out as P37 |
| IRA target | Use the existing `#iraBaseGoal`; how it is *suggested* may change later, deferred |
| Phase 1/2 | **Merged** — per-year split on `yr.curIRA`, no hysteresis |
| ACA ceiling after 65 | ~~**None.** The constraint lifts outright~~ **REVERSED 2026-08-04** — it falls back to Proportional 0%. See the PR 3a-3d replan above |
| FIRST_DEATH ceiling | **None** — convert everything above the IRA Goal. No `phasedDeathBracket` input |
| `deathBasisStepUp` default | ~~`'half'`~~ ~~`'auto'`~~ **THE INPUT DOES NOT EXIST, 2026-08-07.** No enum, no URL key, no `'none'`: step-up follows state law, so it is derived from a per-state `BasisStepUp` field, not chosen. See `P35g` |
| `survivorSpendPct` default | Ships at `100`; real default decided by P36 (80% flagged reasonable) |
| Sweep arm count | Decided by P36's evidence, not up front |
| Enumeration | **Extract** to `optimizer_core.js`, shared with `buildVariations()` |

### PR sequence

| PR | What | Byte-identical? |
|---|---|---|
| 1 | Characterization tests for both enumerations | Yes (tests only) |
| 2 | Extract `buildStrategyFamilies` + `OPTIMIZER_GRIDS`/`MC_GRIDS` to core | Yes — proven by PR 1 |
| 3 | ~~ACA post-65 cap release~~ **SPLIT into 3a/3b/3c/3d 2026-08-04**, see the replan above. 3a DONE | **No** — see the replan |
| 4 | `deathBasisStepUp` (default `'half'`), `survivorSpendPct`, `yr.isLastMFJYear`, `sim.prevIRAGain` | **No** — step-up default |
| 5 | Phased engine | Yes for every existing strategy |
| 6 | Phased UI + identity/matcher sites | Yes — nothing selects Phased yet |
| 7 | **= P36**, the efficiency study | Yes — no shipped code |
| 8 | Phased sweep arms, scoped by P36's evidence | Per-row yes; table gains rows |

**PR 1-2 rationale.** The optimizer's 44-family enumeration is inline in `_runOptimizerNow()`
(`optimizer_ui.js:797-896`) — not exported, not tested, unreachable from node — while
`buildVariations()` is exported but sweeps a **different, smaller space** (36 families, no IRMAA arm,
no ACA arm, IRA Draw capped at 10% vs 20%). Goldens must be captured before the extraction or the
extraction cannot be proven behavior-preserving. Ship `OPTIMIZER_GRIDS`/`MC_GRIDS` as pinned
constants so the divergence is declared rather than accidental.

**PR 3 is a bug fix that stands alone.** The ACA branch has no age test at all. Release the ceiling
outright rather than falling through — every ACA sweep row sets `stratRate: 0` (`optimizer_ui.js:832`),
so a fall-through lands on the 10% bracket, *tighter* than the cap it replaced. **State the
consequence in the changelog:** for the standalone `aca` strategy, unbounded room collapses
`IRAwd = Math.min(yr.curIRA, iRAbracketRoom)` (`:1366`) to `IRAwd = yr.curIRA`, draining the whole
above-goal IRA in the year the younger spouse turns 65. Real consequence, not a bug. **Phased does not
have this problem** — its IRA_CONTROL target stays in the `Math.min`.

**PR 4 is not byte-identical, by decision.** `deathBasisStepUp` is a three-value enum
(`'none'`/`'half'`/`'full'`, unrecognized means `'none'`, the `rothGapFill` convention) defaulting to
`'half'`. Fires in `resolveHousehold` after `yr.status` (`:986`), on the **first Single year** — which
is deliberately *not* Phase 3's year. `'half'` over `'full'` because 41 states are common-law;
community-property handling is explicitly not modelled (`STATEname` is knowable at `:2307` but no
table exists). `survivorSpendPct` multiplies **`yr.targetSpend`, never `sim.spendGoal`** (GK reads
`spendGoal` as its own state at `:1205`, so scaling it would rebase the guardrails permanently), and
**`routeSurplusAndConvert:1755` must see the factor too** or the freed dollars vanish from surplus.
Guard on `birthyear2 > 0` or single filers get the reduction for their whole plan.

**PR 5 dispatch: additive disjunction, not a `yr.effectiveStrategy`.** `inputs.strategy` stays scalar.
Resolve `yr.phase` above `:1198`, then extend the three existing flags with `|| 'phased'`, add one new
`else if` in `planPrimaryWithdrawals` before the bracket branch, and two `|| 'phased'` guards at `:945`
and `:1314`. Five additive sites; every existing strategy is bit-identical **by construction**. A
re-pointed `effectiveStrategy` was rejected: 15 edits is 15 chances to change a shipped strategy
silently, and it would lie at `:2276` (GK spend advance) and `:694` (`minlimit` IRMAA clamp).

**PR 5 gap fill: one new arm, do not flip `isBracketStrategy` off.** Phase 5 emits only the IRA draw;
a second `calculateWithdrawals` there would be sized against a stale tax number and *is* the
double-draw risk. Add an `else if (yr.phasedBalancedFill)` arm to `fillSpendingGap` between the
bracket and ordered arms, ordering `['Brokerage','Cash','Roth']` weighted by current balance. **IRA is
deliberately excluded** — its share is already handled by IRA_CONTROL, and including it is the
double-draw. Flipping `isBracketStrategy` off instead would hand the plan the hardcoded `[40,60]`
(`:1543`) *and* disable the forced-IRA fallback (`:1649`), so a Phased plan would starve rather than
break its own ceiling for mandatory spending.

**PR 6: 12 identity/matcher sites, every one a silent failure if missed.** The sharpest is
`sameStrategySelection` (`optimizer_core.js:2914-2938`) whose `default: return false` would make the
📍 current-plan pin, the ⚖ compare and MC's stress-vs-your-plan all fail quietly. Full table in the
plan file. Also pin with a test that `getInputs`'s `bracket`+ACA rewrite (`optimizer_ui.js:300-306`)
does not catch Phased.

**PR 8 budget reality.** The sweep **already exceeds its own budget**: 1,711 runs measured against a
1,500 cap, absorbed by silently halving `bestTimeLimitedConversion`'s candidate pool from 12 to 6
(`optimizer_ui.js:1043-1049`). 4 Phased families add ~16 rows / ~150 runs. Whatever ships, **make the
cut visible** in the `#opt-perf` readout. This is the concrete argument for doing P34's worker and
per-row memo next.

### Tail-policy question (user, 2026-08-10) — settle BEFORE or WITH `P35i`, evidence exists

The PR-5 spec's BALANCED fill (`['Brokerage','Cash','Roth']` weighted by balance) is
**proportional over the non-IRA accounts, and the 2026-08-10 program produced evidence against
that shape**: (a) P28 (settled, 630 sims) — Roth pays only when it displaces a BROKERAGE draw
and LOSES when it displaces Cash, while a balance-proportional fill draws Roth alongside Cash
every year; (b) the P51 oracle's recurring end-game is a Roth-spending TAIL with appreciated
Brokerage ridden to the §1014 step-up — i.e. the best ordering is PHASE-DEPENDENT
(Cash→Brokerage→Roth mid-plan, Roth-before-Brokerage late when the gain fraction is high);
(c) proportional-as-strategy was refuted twice (never top-3 in 135 cells; gap-to-oracle >2% at
every basis). Candidate tail policies for a bake-off: specced balance-proportional /
Cash→Brok(spend-only)→Roth sequenced / gain-aware late flip (flip condition = measurable state,
gain fraction x heirs rate — a LEGAL rule if the axis property is measured then test-pinned,
unlike oracle foresight). An "endgame grid" (scenarios STARTING at IRA=goal, RMD age, varying
Brok/Roth/Cash mix x basis 20/50/80 x spend) can measure this TODAY without `P35i`, using the
existing ordered arms + the oracle for the ceiling. → new sub-item `P35n`.

- [x] **P35n** — DONE 2026-08-10 (`.test_harnesses/ENDGAME_RESULTS.md`, endgame_harness.js,
      144 cells). **The PR-5 BALANCED fill spec is refuted: balance-proportional is the WORST
      arm (median −$223k, wins 1/108). Winner: the SEQUENCE Cash → Roth → Brokerage with IRA as
      last-resort backstop (88/108 cells; conversions-insensitive 36/36).** Mechanism: §1014
      makes held Brokerage nearly free to heirs while drawing it realizes taxed gains — P28's
      "Roth pays when it displaces a Brokerage draw", live from endgame year 0. Below ~$1.3M
      totals the 0% LTCG bracket erases the CRB-vs-CBR difference (16/15 tie) but proportional
      still wins zero. **`P35i`'s PR-5 gap-fill arm should ship the sequence, not the
      balance-weighted order** — with the taxflex caveat (CRB empties Roth; a flexibility
      objective may disagree with the wealth verdict) and the no-SECURE-heirs ceiling stated.

### Already ruled out — do not re-derive

- **Gain harvesting.** It already exists as the Cyclic modifier, which maxes the LTCG bracket on
  purpose even when spend does not need it (`optimizer_core.js:1301-1303`) with `cycleLTCGTarget`
  nerdknob-gated (`optimizer_ui.js:86`). Whether it is worth selecting is **P32's Q3**, already scoped
  as a scan of existing sweep output. Phased gets 🗘/🔄 twins like every family and adds nothing here.
- **"Use the weightier assets more heavily."** That is `calculateWithdrawals` with
  `order: ['IRA','Brokerage','Cash']`, i.e. exactly what `propwd` (`:1379-1391`) and the baseline
  branch (`:1398-1406`) already do. BALANCED ~= propwd plus the IRA_CONTROL term. Do not rebuild it.
- **A new IRA-target input.** `#iraBaseGoal` exists and `yr.curIRA` is already computed.
- **Terminal-mix-as-target** (P24 §6, `findings.md:515-533`) — the optimal mix is an output of the
  search. Do not add a mix-based phase trigger.
- **Frequency-based pruning of sweep arms.** See P36's framing block; the bar is `task_plan.md`'s
  measure-then-pin rule, and four heuristics have already failed here.

### Tasks

Sub-item IDs are `P35a`..`P35m`. The old `PR n` labels are kept in parentheses because merged PR
bodies, `findings.md` and `progress.md` cite them; see the ID migration table at the top of this file.

- [x] **P35a** *(PR 1)* — characterization goldens for both enumerations. **DONE 2026-08-03**,
      node 148 -> 167. Full write-up archived in `.planning/task_completed.md`.
- [x] **P35b** *(PR 2)* — extract `buildStrategyFamilies` + `OPTIMIZER_GRIDS`/`MC_GRIDS` to
      `optimizer_core.js`. **DONE 2026-08-03**, node 167 -> 173, v11.1437, byte-identical over all
      four `OPT_GOLDEN` captures. Full write-up archived in `.planning/task_completed.md`.
- [x] **P35c** *(PR 3a)* — bracket-lookup floor. **DONE**, v11.1447, merged
      [PR #147](https://github.com/nightskyguy/retirement_assets/pull/147)
- [x] **P35d** *(PR 3b)* — Medicare age becomes `TAXData.IRMAA.ELIGIBILITY_AGE`. **DONE**, merged
      [PR #149](https://github.com/nightskyguy/retirement_assets/pull/149), byte-identical over a
      144-scenario A/B
- [x] **P35e** *(PR 3c)* — ACA age gate falling back to Proportional 0%. **DONE**, v11.1462, merged
      [PR #150](https://github.com/nightskyguy/retirement_assets/pull/150); only `aca` rows move.
      Two of the three predictions were wrong; both corrections are in `findings.md`
- [x] **P35f** *(PR 3d)* — `Basis <= Brokerage` invariant. **DONE 2026-08-07, v11.1499.** Spec
      written at last: basis may never exceed the account, at input and in every simulated year.
      New `clampBrokerageBasis()` called after both `applyGrowth` points. Byte-identical for
      non-negative brokerage returns (every ordinary path moves value and basis together); a real
      correction under MC, where a down year shrinks value while basis stands still. The input-side
      half was a **dead line**: `optimizer_ui.js:288` read `if (Brokerage <= 0.01) basis = 0;` and
      assigned an undeclared global named `basis`, never `BrokerageBasis`, so it had never once
      fired. Deleted rather than repaired - the clamp below it already handles a zero balance and
      warns, which the silent version did not. **Limitation recorded, not fixed:** the clamp writes
      the unrealized loss down immediately; there is no capital-loss carryforward, so a dip-then-
      recover plan is taxed on the recovery. That can only overstate tax, never understate it
- [x] **P35g** *(PR 4, code)* — **THE BROKERAGE BASIS STEP-UP. DONE 2026-08-07, v11.1499.** Four
      decisions from the user reshaped the recorded spec before it was built:
      1. **No enum, no knob, no `'none'`.** Step-up is a function of state and federal law, not a
         preference, so `deathBasisStepUp` was dropped entirely. Modeling correct behavior outranks
         preserving past numbers; goldens were rebaselined rather than kept green behind a switch.
      2. **Not a `COMMUNITY_PROPERTY` list** either - that is a second place to forget when P19 adds
         a jurisdiction. Every one of the 38 modelled jurisdictions carries its own numeric
         `BasisStepUp` (0.50 / 1.00) in `taxengine.js`, with a test asserting all 38 declare one.
         `NO_TAX_SHELL` holds 0.50 and `NV`/`TX`/`WA` override AFTER the spread (the `NH` `NOTE`
         precedent); `AK` needs no special case, opt-in CP falls out of the shell default.
      3. **Terminal row only**, not every year: wealth at death is not wealth now. The chart kink
         is explained by a milestone rather than smoothed away.
      4. **Scope cut to the step-up.** `survivorSpendPct` deferred (new input + UI + URL key,
         orthogonal); `sim.prevIRAGain` deferred with it. Both belong to `P35i`.
      **Two plan steps dissolved.** Writing the terminal fix as `Basis := Brokerage` on the log row
      rather than "drop the haircut" made `max(0, Brokerage - Basis)` zero for every downstream
      consumer, so `bestConversionStopYear` needed no `atDeath` flag and `afterTaxNetWorth` /
      `_afterTaxBuckets` needed no arithmetic change. Removing their term anyway would have broken
      a legitimate test of the general helper. Both are documented as inert instead.
      **The trap.** A counterfactual run completes fully, so without a guard its last row reaches
      the Break Even block already stepped up while the main log's has not, and the final year's
      `convOC` differences two valuations. Needs BOTH the post-pass sitting after the BE block and
      an `inputs._cfRun` skip. Proved by isolation, not argument: a build with the terminal step-up
      disabled produces a bit-identical `convOC` series
- [x] **P35h** *(PR 4, docs half)* — README caveat, shipped **ahead of the code** 2026-08-07,
      doc-only, no version bump. Landed in `### Limitations and Restrictions` (README:294) plus a
      cross-reference from the brokerage FAQ's DRIP "Gotcha" (README:723). Both deaths covered, each
      with its direction of error named. There is no "uncovered-tax-situations section"; the item as
      originally written named one that does not exist
- [ ] **P35i** *(PR 5)* — `yr.phase` resolver; additive flags; `planPrimaryWithdrawals` branch;
      `fillSpendingGap` arm
- [ ] **P35j** *(PR 5, test)* — Phased never draws more than `Fill Bracket` at the same ceiling
- [ ] **P35k** *(PR 6)* — all 12 identity sites; URL keys `pcp`/`pam`/`dsu`/`ssp`
- [ ] **P35l** *(PR 7)* — = **P36 round 2**, the efficiency study with the full factor set
- [ ] **P35m** *(PR 8)* — Phased sweep arms scoped by P36; surface the stop-year cap reduction
- **Status:** IN PROGRESS. `P35a`/`P35b` merged as
  [PR #146](https://github.com/nightskyguy/retirement_assets/pull/146); `P35c` as
  [PR #147](https://github.com/nightskyguy/retirement_assets/pull/147), which **already moves
  numbers**, superseding the old "PR 3 is the first one that moves numbers" note; `P35d` as
  [PR #149](https://github.com/nightskyguy/retirement_assets/pull/149) (byte-identical); `P35e` as
  [PR #150](https://github.com/nightskyguy/retirement_assets/pull/150). `P35h` shipped 2026-08-07
  ahead of its code half; `P35f`+`P35g` landed together as v11.1499, closing the gap `P35h` had
  documented. **Next: `P35i`.** **Depends on:** nothing hard. `P35b` unblocked P36 and helps
  P29/P30/P31/P32. `P35m`'s budget problem is P34's argument. P36 round 2 now waits on `P35i`
  alone, `P35g` having landed.
- **Touches the same gap-fill code as:** P28's open ship decision (`rothGapFill`) and P30's `[40,60]`
  question. Settling P28 and P30 first would mean `P35i`'s new arm is written against a settled
  ordering rather than one about to change.

---
## P35 PR 3 replan (2026-08-04) — kept as the record behind P35c/P35d

Four corrections from the user reshaped the rest of P35. Investigating the third exposed a shipped
defect larger than any of them, so the single "PR 3" in the table below became four PRs.

| # | PR | Byte-identical | Status |
|---|---|---|---|
| 3a | `findUpperLimitByAmount` below the first bracket | **No** — 21 states + `minlimit` everywhere | **DONE 2026-08-04, v11.1447**, merged PR #147 |
| 3b | Medicare age -> `TAXData.IRMAA.ELIGIBILITY_AGE` | Yes — proven over 144 scenarios | **DONE 2026-08-04**, tokens `111448`, merged PR #149 |
| 3c | ACA cap lapses at 65 -> Proportional 0% | No — `aca` rows only, proven by control | **DONE 2026-08-05, v11.1462** |
| 3d | `Basis <= Brokerage` invariant | Yes for non-negative brokerage returns; no for MC | **DONE 2026-08-07, v11.1499** |
| 4 | ~~`deathBasisStepUp: 'auto'` + `COMMUNITY_PROPERTY`~~ per-state `BasisStepUp`, no enum, no `survivorSpendPct` | **No, by decision** | **DONE 2026-08-07, v11.1499** |

**Absence validated against a live run, 2026-08-07** (user report on `?bk=2e5`), so do not re-derive
it. Reproduced at the page defaults (`birthyear1=1960`/`die1=88` -> first death 2049;
`birthyear2=1952`/`die2=98`): `status` flips `MFJ` -> `SGL` in 2049 and `Basis` keeps falling
monotonically straight through it - 2048 $148,013/$9,630, 2049 $128,542/$7,888, 2050
$106,082/$6,139. Confirmed by grep as well: `balance.BrokerageBasis` is mutated in exactly three
places, none death-related - proportional reduction on withdrawal (`optimizer_core.js:292`), surplus
reinvestment (`:2018`), DRIP (`:2282`). `computeIncome`'s death block (`:1088-1089`) moves the **IRA
only**. The user's own figures are self-consistent with pro-rata reduction and no reset:
$8,419/$13,920 = 0.6048 against $72,739/($113,423 x 1.06) = 0.6050.

**IN SCOPE FOR PR 4 AND NOT PREVIOUSLY LISTED - the terminal valuation.** The recorded PR 4 spec
below covers only the first-death `resolveHousehold` hook. But `afterTaxNetWorth`
(`optimizer_core.js:3626-3627`) and `_afterTaxBuckets` (`:3001`) both value terminal brokerage as
`basis + max(0, brokerage - basis) * (1 - capGainsRate)`, i.e. they tax the heirs on gains §1014
steps up in full. **This is the larger of the two distortions** because it feeds Break Even, the
"Optimize for" ranking, and every cross-strategy comparison, and it is one-sided: Roth and Cash are
unaffected, so the bias runs consistently in favor of Roth conversions. Note it is NOT simply
"drop the discount" - the second death is the plan's end for a couple, but a single filer's terminal
row is also a death, so the same reasoning applies there and the change is not confined to MFJ runs.

**`'auto'` re-confirmed by the user 2026-08-07.** `'full'` in a `COMMUNITY_PROPERTY` state, `'half'`
elsewhere. No `COMMUNITY_PROPERTY` constant exists in `taxengine.js` yet; PR 4 adds one following the
`TAXData.IRMAA.ELIGIBILITY_AGE` precedent from PR 3b (single source, interpolated into any
user-facing copy so the two cannot drift).

**The user's four corrections, and what each changed:**

1. **Step-up is per STATE law.** Community-property states get a FULL step-up on first death, and it
   should follow the existing spousal-IRA-takeover template at `optimizer_core.js:1035-1036`. This
   **replaces the recorded `deathBasisStepUp: 'half'` default** in P35's decision table below.
   Decided: `'auto'|'none'|'half'|'full'`, default `'auto'` -> `'full'` in a `COMMUNITY_PROPERTY`
   state, `'half'` elsewhere. **The cheap part nobody saw:** `'half'` and `'full'` ARE the ownership
   model (common-law joint tenancy vs community property), so no per-person brokerage attribution is
   needed at all. The 7 modelled CP states are AZ, CA, ID, NV, TX, WA, WI; LA and NM are CP states
   TAXData does not model; AK is excluded on purpose (opt-in by agreement, not default).
2. **100%-basis brokerage draws tax-free**, so gap-fill could order it like Cash or Roth. **Decided:
   observability only.** Ship `yr.capGainsPercentage` as a hidden `-` log key with PR 4 and change no
   ordering. The inference is isomorphic to P28's Roth-vs-Cash question, where reasoning cost
   $137,062 of terminal value once: zero tax on the *withdrawal* says nothing about the opportunity
   cost of the asset *retained*. Not committed to P30 either — left open, with the prevalence number
   now measurable.
3. **ACA should fall back to Proportional 0%** when all living spouses are 65+, and the 65 should come
   from TAXData. This **reverses the recorded "the constraint lifts outright" decision** below.
   Releasing outright makes the crossing year's draw depend on `curIRA`, an unbounded quantity — a
   cliff, not a policy. `propwd` at 0% is line-for-line the engine's fallback `else`, so the fallback
   is three conjunctions and no new branch.
4. **Run P36 before Phased lands.** Decided: run it **twice**. **P36 round 1** now on the 8 shipped incumbents
   (no step-up, no `survivorSpendPct`, death timing dropped — it detects nothing without them); P36b
   after PR 4 with the full factor set and the Phased arms. Framing that must be written into the
   results file: frequency **cannot** justify deleting a shipped arm, only the zero test can, and any
   "ACA never wins" verdict is a measurement artifact because the tool prices the cap's cost and none
   of its benefit.

The per-PR DONE write-ups for `P35c`/`P35d`/`P35e` and the `eitherOnMedicareAtStart` cleanup that
followed them are archived in `.planning/task_completed.md` under this same heading. What stays here
is only what `P35f` and `P35g` still need.

---
## P36: Phased efficiency study — do any strategies never win?

**Why:** the user asked two things the repo cannot currently answer. (A) Across a dozen or more wealth
and asset-mix points, are any shipped strategies *inefficient* — never appearing in the top ranks under
any objective? (B) How many swept variations never produce a top result, and could more variations be
worth adding? Neither is answerable today: the enumeration is unreachable from node (see the P35 PR 2
extraction), and **there is no "top 10" in the code** — the Best table is 7 fixed slots keyed on
`colWinners` (`optimizer_ui.js:1655-1662`), and the Rank column is 1..N.

**Framing, which is as much the deliverable as the numbers.** This produces **evidence for DEFAULT
ORDERING and for P35's shipped defaults — not for deleting arms.** The repo's rule
(`task_plan.md`, P34 Tier 3) is that a search shortcut is legal only if the axis property is *measured*
then *pinned by a test*. "IRA Draw 5% seldom wins" is a frequency observation, not an axis property,
and frequency shortcuts are exactly what has failed here four times — including the "no IRA left" skip
filter that "looked obviously safe and lost the right answer on a $3.3M scenario, reported 25% against
a true 5%" (`findings.md:86`). **The only result justifying deletion is a zero test:** an arm
bit-identical to another in *every* cell, the standard that already justifies skipping 💵 clones when
`Cash === 0` (`optimizer_core.js:3336-3341`).

**Grid — crossed, not hand-picked.** P28 round 2 confounded mix with strain by setting spend per
scenario (`unifiedconv_harness.js:72-78`); round 4 overturned three conclusions once spend rate became
a controlled axis. Control everything from the start:

- **Mix (5)** — copy P28's ladder verbatim (`unifiedconv_harness.js:84-106`). Copy, do not import.
- **Wealth (3)** — x0.5, x1, x3 on every mix.
- **Spend rate (3)** — 4/6/8% of total assets.
- **Death timing (2)** — `die1=88/die2=98` (10 survivor years) and `die1=96/die2=98` (2 survivor
  years). **Mandatory:** without it, P35's phases 3 and 4 never execute and the study reports
  Phased ≈ Fill Bracket *by construction*.

= **90 cells** x ~12 arms ≈ 1,080 sims, ~2s in node.

**Arms:** incumbents at best-known parameters (`Fill Bracket 22%`, `Fill Bracket 24%`,
`IRMAA Ceil Tier 1`, `IRA Draw 6%`, `Reduce 20 yrs`, `Proportional 10%`, `GK`, `Ordered CBIR`) plus
Phased at 4 control percentages. Cross `deathBasisStepUp ∈ {none, half, full}` over **every** arm —
that is why P35 PR 4 made it strategy-agnostic. Run `survivorSpendPct ∈ {100, 80}` as a separate
declared factor; **its result decides the shipped default.**

**Scoring.** Use the exported `rankRowsByObjective` (`optimizer_core.js:2984-2996`), the same ranker
the UI uses, so findings transfer. Two of the nine objectives are degenerate and must be handled
openly, not dropped: `conveffect` reads `_convSavings`, which is UI-computed and absent from a bare
`simulate()` result — **declare it out of scope with the reason**; `earliestbe` reads `_convBEYear`,
which *can* be populated from `res.totals.convBEYear` under `computeOC: true` — populate it and report
the no-break-even count alongside so the 9999 sentinel is visible rather than laundered. So **7 core
objectives + `earliestbe` with a coverage count.**

**Three tables, never one** — PF11's failure was top-K on a single metric returning five rows from one
family (`findings.md:170`):
1. Per-objective x per-family **mean rank**. A monopolist is low in every column; a niche winner is low
   in one. This is what answers "what should the default ordering be."
2. Per-cell winner counts, **one vote per cell per objective**, so no family takes two seats from one cell.
3. Per-arm **zero test** — count of cells where an arm's money fields are byte-identical to another's.
   Only 100% is a deletion candidate.

**Non-negotiable:** rank on `baselineScoreOf` / `afterTaxNetWorth` with a **shared** rate, never
`finalNW` (`findings.md:377` — "a per-run rate belongs inside a run, never in a cross-run
comparison"). And **score predictions before running**, P28's discipline: Phased vs Fill Bracket at
equal ceiling; step-up `half` vs `none`; survivor spend 80 vs 100; and rule B — does drawing harder on
down years actually pay?

**Two questions here are not about Phased at all** and would otherwise be settled by taste: whether
P35's FIRST_DEATH full-drain bet pays (a one-year MFJ spike, possibly at 37% + IRMAA Tier 4, against
the survivor's permanent Single-bracket penalty — the 2-survivor-year arm should show it losing; if it
does not lose even there, suspect the measurement), and whether `survivorSpendPct: 80` is defensible
as a default.

**Artifact of the design to call out, not misread:** `totals.spend` accumulates `yr.targetSpend`
(`:2149`), so a `survivorSpendPct: 80` run scores lower on `maxspend` **by construction**.

- [x] **P36a** — Harness `.test_harnesses/phased_harness.js` (node) BUILT 2026-08-10, calling
  `buildStrategyFamilies` — round 1 runs the sweep's own 192-arm enumeration, not the hand-picked
  incumbent list, so question B is answered against the real table.
- [ ] **P36b** — Round 1 DONE on a 45-cell grid (mix x wealth x spend; predictions scored, S1-P1a
  WRONG — propwd never top-3 anywhere). The FULL 90-cell grid with the death-timing axis,
  `deathBasisStepUp` cross and `survivorSpendPct` factor is ROUND 2 and waits on `P35i`.
- [x] **P36c** — The three reporting tables produced; `conveffect` exclusion stated with its reason.
  GK caveat mandatory when reading them: survivorship (eligible arms 160→37 across spend rates) +
  spend drift (+38%/−12%) inflate every GK number.
- [x] **P36d** — `.test_harnesses/PHASED_RESULTS.md` + a row in `.test_harnesses/README.md`
- [ ] **P36e** — Decide P35's shipped arm count and `survivorSpendPct` default from the output
  (needs round 2)
- **Status:** round 1 DONE (2026-08-10); round 2 waits on `P35i`. Runs as P35's PR 7.

---

## P37: LEGACY / heir 10-year drawdown — DEFERRED by the user

Recorded so P35's phase resolver having no phase-5 branch reads as a decision rather than an oversight.

**What it would be.** The user's original Phase 5: a post-death drawdown for heirs that must reach zero
within 10 years, modelled against heir withdrawal rates. Today none of that exists — see `findings.md`
"P35 engine survey" item 5. The simulation **ends at the last death year, inclusive**
(`maxYears`, `optimizer_core.js:2316`); terminal value is one line, `afterTaxWealthOfLogRow`
(`:2595-2600`), haircutting the IRA by a flat `futureIRATaxRate`. No SECURE Act 10-year rule exists
anywhere in the repo, no heir age, no bracket stacking, no time-value discount.

**Why it was split out.** It is not a phase of a withdrawal strategy at all — it is a **replacement for
the terminal scoring function**, so it re-scores every row, every objective, and every measured finding
in `findings.md`. Largest blast radius of anything in the backlog. It is also better modelling: the
flat haircut is exactly the assumption the BETR work found unreliable, and a real 10-year drawdown
against heir brackets would change what terminal IRA is worth, hence the value of every conversion the
tool recommends.

**If it is picked up:** it must land alone, with the 8-scenario harness re-derived deliberately and a
declared list of which prior findings its numbers invalidate.

- **Status:** deferred, not started. **Independent:** no dependencies, but should not share a release
  with anything else.

## P40: Test-file layout — naming convention and a `tests/` subfolder (2026-08-06) — rename DONE, `tests/` move UNBLOCKED and undecided

Raised by the user as two proposals before continuing P39: enforce a test naming convention
(`XXXX.tests.js`), and move tests into `tests/` or `.tests/`. Costed against a reference inventory of
**189 occurrences across 25 files** and against this repo's own last rename, `d0f4a00` (5 files:
**11 files changed, 20 insertions, 18 deletions**).

| option | edits outside `.planning/` | files | judgment lines | silent-failure sites |
|---|---|---|---|---|
| rename 3 node suites `.test.js` -> `.tests.js` | ~29 | ~10 | 0 | 0 |
| also rename `optimizer_tests.js` | +10 | +2 | 0 | **2** |
| move all 7 files to `tests/` | ~55 | ~13 | ~18 | **2** |
| both at once | ~75 | ~15 | ~20 | **2** |

### `.tests/` is REJECTED PERMANENTLY — do not re-propose it

Not because it 404s, but because **the 404 is invisible to every check runnable before merge.**

- Jekyll excludes dot-directories. This repo deliberately has **no `_config.yml`**
  (`_includes/head-custom.html:6`), so no `include:` directive can exist to re-add one. Already
  proven empirically for `.planning/` (`progress.md:1208`, both `.md` and `.html` return 404).
- The one escape hatch is forbidden three times over: **never add `.nojekyll`**
  (`ARCHITECTURE.md:376`) — it would 404 every rendered docs URL on the site.
- **`python -m http.server` (`.claude/launch.json`) and `file://` both serve dot-directories.** So
  `.tests/` is green in 100% of local checks and red only on `main`, in production, on the flagship
  page.
- What then breaks is silent: `retirement_optimizer.html:1136` is `runTests?.();`, and optional-call
  does **not** guard an *undeclared* identifier — a 404 throws `ReferenceError`, aborting the inline
  block so `runSimulation?.()` at `:1138` never runs.

`tests/` (no dot) is fine on all of the above; `montecarlo/` is the working precedent in this repo.

### `optimizer_tests.js` is NOT renamed, and must stay out of any filename glob

Verified 2026-08-06: 2197 lines, a lone `function runTests()` at `:3`, **no top-level call, no
`module.exports`**. So **`node optimizer_tests.js` exits 0 having run nothing.** The pre-commit hook
prints `ok` for anything that exits 0 (`.githooks/pre-commit:49-52`), so pulling the release gate
into a `*test*` glob manufactures a permanent false green on the one file that cannot afford one.
The `*.tests.js` suffix is safe precisely because `_tests.js` does not match it.

### Decisions

- **DONE (PR 3 of this batch):** rename the three node suites `.test.js` -> `.tests.js` (`db363ba`).
- **UNBLOCKED as of 2026-08-07, still undecided:** the `tests/` move. It was deferred until after
  P39 items 2-6, because item 3 dual-modes `optimizer_core.tests.js` into the browser and moving
  first would commit to served paths for files about to gain browser exposure — two new-path risks
  stacked in one window — and would rewrite `require()` headers that item 3 then restructures
  anyway. **Those items are now merged**, so that reason has expired. The move is now a plain
  cost/benefit call: ~55 edits, ~13 files, ~18 judgment lines, 2 silent-failure sites. One new
  consideration the deferral did not have: the three suites are now `<script>`-loaded by
  `retirement_optimizer.html`, so the move must carry their `?v=` cache tokens as well as their
  paths, and a stale warm tab will keep requesting the old path (see the P39 GOTCHA in
  `progress.md`).
- **REJECTED:** `.tests/`, and renaming `optimizer_tests.js`.

### If the `tests/` move is later taken up

- Move **all seven** files together (the three suites + `sweep_golden.js` + its two generators +
  nothing else). A split along "node-only vs browser-loaded" is defined by a property P39 is about
  to invert.
- `sweep_golden.gen.js:24-25` are the only `path.join(here, ...)` calls that reach out to repo root;
  `:26`/`:56` and `import.js:95` keep working because `sweep_golden.js` moves alongside.
- The GENERATED/IMPORTED marker strings (`gen.js:53` vs `sweep_golden.js:118`, `import.js:74` vs
  `:792`) are a **rename** hazard only — a move preserves filenames.
- `ARCHITECTURE.md:305-318` and `.test_harnesses/README.md:7-10` both state a "where a test file
  belongs" rule that the move would repeal. Budget those ~18 lines as design work, not `sed`.
- Manual browser pass is irreducible: three pages, over both `http://localhost:8767` and `file://`,
  and specifically re-test Escape-closes-modal (`standalone/IncomeTaxPlanner.html:1194`) and the
  click handler (`:1276`), which die silently.

---

## P41: Pension Start Age  *(was PA)*
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

**Five of the seven items shipped in v11.10ee and were never checked off here.** Audited against
the code 2026-08-07; the two that remain are real, not bookkeeping.

- [x] **P41a** — `#pensionStartAge` input. **DONE v11.10ee**, `retirement_optimizer.html:339`
      (number, `value="0"`, `placeholder="ret."`)
- [x] **P41b** — `getInputs()` reads it. **DONE v11.10ee**, `optimizer_ui.js:350`. Shipped as
      `+val('pensionStartAge') || 0`, not the `|| inputs.startAge` written above: 0 means "no gate",
      which reaches the same behaviour by a different route since `age1 >= 0` is always true
- [x] **P41c** — engine age gate. **DONE v11.10ee**, `optimizer_core.js:1154`
- [x] **P41d** — `computeSuggestedSpend()` gate. **DONE v11.14bf.** The three unconditional
      pension counts (`gross` `:4716`, `earnedIncome` `:4727`, `pensionIncome` `:4728`) now read one
      `pension` local gated by a shared helper `DisplayHelpers.pensionAtAge(amount, startAge, age)`
      (in `displayhelpers.js`), evaluated at `retireAge`. `startAge` 0/blank = no gate, so existing
      plans are byte-identical; a pension deferred past retirement is now excluded. Browser-verified:
      start age 75 vs retirement 65 drops suggested gross from $168k to $153k (the $15k pension),
      after-tax falls in step. The engine (`optimizer_core.js:1154`) stays inline and self-contained,
      as designed
- [x] **P41e** — URL alias `psa`. **DONE v11.10ee**, `optimizer_ui.js:3777`
- [x] **P41f** — survivor logic needs no change. **CONFIRMED**, still true
- [x] **P41g** — tests added. **DONE v11.14bf**, both in `optimizer_core.tests.js` (after the PA
      test at `:1622`): (1) a `pensionAtAge` helper unit test (below/at/after start age, `startAge`
      0/blank = no gate, blank amount = 0); (2) `test.critical` engine test that runs `simulate()`
      with a pension deferred to age 80 and asserts `yr.pension === 0` before the start age, `> 0`
      after — this closes the exact gap the audit named: reverting `optimizer_core.js:1154` now fails
      that guard (proven: temporarily ungated → 1 critical guard failed, restored → 224/224).
      Suite count 222 → 224; `optimizer_tests.js` `EXPECTED.optimizer_core` bumped to 224
- **Status:** DONE, 7 of 7. Shipped in v11.14bf, separate from the P35g basis-step-up PR as planned.
  node 224/224 (11/11 critical guards); browser-verified on the served page
- **Independent:** no phase dependencies

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

## P46: Tax Payment Planner backlog  *(was TPP-1..5; TPP-3/4/5 shipped and are archived)*

**Sequencing decided 2026-07-29** (plan file `C:\Users\starc\.claude\plans\calm-snacking-newt.md`):
three PRs, cheap and independent first. PR 1 = TPP-3 + TPP-4 + TPP-5, **MERGED as PR #138**
at v1.13be. PR 2 = TPP-1 (not started). PR 3 = TPP-2 (not started).
User decisions: TPP-2 output is a **priced menu with no winner named** (keeps the tool clear of
personalized tax advice); TPP-4 is a **single sticky footer button**, not a duplicate at the top.


Requested by the user after testing `RetirementTaxPlanner.html` v1.13b9 on branch
`worktrees/roth-conversion-withhold-replace-a9c195` (PR #136). That branch corrected the
Roth rollover rules, the replacement economics, business-day scheduling, IRC 7503 due-date
shifting, the 497%-over-withholding bug, and the two displayed plans that were not paying
the full liability. Everything below is new work on top of it.

Engine is `taxPaymentPlanner.js`; the HTML is a thin shell. Tests are `taxPaymentPlanner.test.js`
(**30 passing** as of v1.13c0, and runnable from the browser via `?runtests`).

**Sequencing and status.** An earlier session on `worktrees/planning-with-files-453213` proposed a
four-PR split (PR-T1..T4) and re-verified the specs against `e1ddb71`. The user then chose a
**three-PR** split, which is what shipped; that table is superseded by this one. The line counts and
the 27-test baseline from that session are also now stale.

| Item | Status | Ships as |
|------|--------|----------|
| TPP-3 run tests from browser | **DONE** v1.13be | PR 1 (#138) |
| TPP-4 compute button reachable | **DONE** v1.13be | PR 1 (#138) |
| TPP-5 dedupe note text | **DONE** v1.13be | PR 1 (#138) |
| Plan C legibility (found in testing) | **DONE** v1.13c0 | PR 1 (#138) |
| `T.NOTE` sub-notes never render (found in testing) | pending | PR 2 prep |
| `shFed`/`shState` miss the 6654(d)(1)(B) lesser-of | pending | PR 2 commit 1 |
| TPP-1 IRC 6654 penalty estimate | pending | PR 2 |
| TPP-2 priced remedies | pending | PR 3 |

Order rationale: TPP-2 prices remedies against "penalty avoided", so it cannot be built before
TPP-1 computes a penalty. TPP-3 landed first on purpose — a browser-runnable suite is the
verification surface for everything after it. The two items found while testing PR 1 are sequenced
ahead of the penalty engine because TPP-1's arithmetic depends on the safe-harbor rule being right,
and because the `T.NOTE` fix is what makes some of TPP-5's shortened notes visible at all.

Current plan file: `C:\Users\starc\.claude\plans\calm-snacking-newt.md`.

### TPP-1 — Estimate the penalty when the user is already late

`detectMissed()` already flags past-due installments and the UI says "PAST DUE", but never
says what it will cost. Quantify it.

IRC 6654 is interest-like, not a flat fee: per installment period, on the amount by which
that period's required installment exceeded what was credited by its due date, running from
the due date to the earlier of the date paid or the following April 15. Simple, not
compounded. Rate is the §6621(a)(2) federal short-term rate plus 3 points, redetermined
quarterly.

Pieces the engine already has: `dueDateFor` (IRC 7503 shifted dates), `shFed`/`shState`
(required annual payment via safe harbor), `FED_Q` weights, and the IRC 6654(g)(1) ratable
withholding credit, which must be applied here or the estimate will be far too high for
anyone using year-end withholding.

Missing, and the main design decision: **the rate table.** Rates are announced quarterly, so
hardcode the announced ones with an explicit documented fallback for quarters not yet
announced, cite the IRS quarterly-interest-rate page in `RULE_CITES`, and label the output an
estimate. Do not silently extrapolate.

Also implement the §6654(e) exceptions or the tool will invent penalties that do not exist:
no penalty where tax minus withholding is under $1,000, or where the prior year showed no
liability over a full 12-month year.

Scope: federal only in the first pass. State penalty regimes differ per state and the
`STATE_DB` has no rate data; say plainly that the state figure is not modeled rather than
implying the federal number covers it.

### TPP-2 — Remedies that actually reduce the penalty

Given the same facts, rank what the user can still do. The important asymmetry, which the
engine already understands but does not exploit for this purpose:

- **Extra withholding retroactively cures elapsed quarters** (IRC 6654(g)(1) credits it
  ratably across all four due dates). This is the strong remedy.
- **A larger quarterly payment does not.** Estimates are credited when paid, so front-loading
  helps future periods only and cannot repair Q1 in November.
- **Form 2210 Schedule AI** re-cuts each period against income actually received by then,
  which can erase the early-quarter underpayment outright when the income was genuinely
  late-year. Already narrated by the tool; here it becomes a scored option.
- **Reaching safe harbor** caps exposure regardless of the shape of the year.

For "take an extra IRA withdrawal and withhold it": model the self-defeat. Withdrawing `W`
and withholding all of it pays `W` toward the liability but adds `m·W` of new tax at the
marginal rate, so net progress is `W(1-m)` and closing a gap `G` needs `G/(1-m)` gross. That
is the same gross-up shape as `applyConversionGrossUp()` in `optimizer_core.js:1930`; reuse
the approach rather than deriving it again. Compare the grossed-up cost against the penalty
avoided and only recommend it when it actually wins.

### TPP-3 — Run the tests from the browser — DONE (v1.13be, merged PR #138)

`taxPaymentPlanner.test.js` is node-only: bare `require` at the top, `process.exitCode` at the
bottom. Make it dual-mode so `RetirementTaxPlanner.html?runtests` runs it.

Follow the existing pattern rather than inventing one: `optimizer_tests.js` defines a global
`runTests()` that logs to console and writes a pass/fail glyph into a `#testsFailed` element,
called from `retirement_optimizer.html:1129`. Differences to handle here: guard the `require`
for the browser, replace `process.exitCode` with a return value, and gate on the `?runtests`
param instead of running unconditionally. Render results on the page as well as the console,
since the request was to see them directly.

### TPP-4 — Compute button reachable without scrolling — DONE (v1.13be, merged PR #138)

`#compute` sits at `RetirementTaxPlanner.html:446`, at the bottom of a long input panel.
Duplicate it at the top. IDs must stay unique, so use a shared class or `compute-top` /
`compute-bottom` bound to one handler. Note the panel is collapsible (`.inputs.collapsed`
hides `.inputs-body` entirely), so check both states; a sticky button may serve better than
two copies.

### TPP-5 — Deduplicate the long-form note text — DONE (v1.13be, merged PR #138)

Measured on a dual-IRA dual-conversion scenario: **174 notes across the three plans, 69 of
them over 200 characters, 26,184 characters total.** Each boilerplate block repeats six times
(once per IRA per plan), and "Sooner is better" twelve times, since it rides both the
conversion and the restore action.

Move the long form into `RULE_CITES` entries and leave a short inline pointer. Candidates,
all in `taxPaymentPlanner.js`: the "IF YOU MISS THE 60 DAYS" block, "Relief is narrow", "This
completes a traditional-to-Roth conversion rollover", "The exclusion covers the CONVERSION
only", and "Sooner is better".

Constraint: the plain-text tab has no clickable anchors, so the pointer must name the tag in
a form that is findable by eye, e.g. `[see IRC 4973 in Rules and sources]`. Both `buildText`
and `buildHtml` need the treatment. Keep whatever is genuinely per-scenario (dollar amounts,
dates, the capped-withholding explanation) inline, since that is not boilerplate.

---

## P48: README caveats backlog  *(deferred by the user 2026-07-30, corrections already done)*

A separate read-only session audited what belongs in **What the Tool IGNORES** and **Limitations and
Restrictions**. Its full evidence, with file:line citations, is preserved at
`.planning/retirement-optimizer/readme_caveats_findings.md` (that session never wrote it into this
worktree). Five citations were spot-checked here before accepting it.

User decision: **corrections only now, caveats deferred.** All 5 of its factual corrections are done
(3 landed in Round 3; Account Composition and the duplicate Roth sentence landed with v11.13d0).

Deferred, in three clusters:

1. **16 limitations** for the two caveat sections - no capital losses, no basis step-up at death, ACA
   models the MAGI cap but never subsidy dollars, no healthcare or LTC costs, state fixed for the
   whole plan, MC never varies mortality, dividends assumed 100% qualified, abridged
   Uniform-Lifetime-only RMD table, no QSS window, flat national Medicare premiums, and more.
2. **State coverage** - 38 of 51 modeled; missing AR, DE, HI, KS, LA, MO, NJ, NM, OK, RI, UT, VT, WV.
   Sharpest point: README's own Tax Torpedo table names NM, RI, UT and VT as SS-taxing states the
   tool cannot model. Also no local or city income tax anywhere in the engine (NYC ~3.1-3.9% is the
   largest unacknowledged understatement), and each person's entered SS gets no actuarial reduction
   or delayed-retirement credit for claim age - changing the claim age moves only WHEN, never HOW MUCH.
3. **~10 features** still absent from the feature list - QCD modeling, Future $ / Current $ toggle,
   nerdknob gating and how to reveal it, Marginal Heirs Tax Rate, the full milestones overlay, MC
   input-distribution charts, the Tax Planner handoff mechanics, share URLs omitting defaults.

---

---

## P49: Horizon-aware suggested spend  *(SHIPPED v11.14c6, 2026-08-09)*
**Why:** the suggested After-Tax Spend was a flat 5% of every account plus SS+pension, taxed once,
with **no regard for plan length**. That contradicts the whole withdrawal-rate literature (Bengen,
Trinity): the safe starting rate is chiefly a function of horizon. The tool already models the
horizon (death-driven, `= r.log.length`), so a horizon-blind suggestion was leaving its own best
input on the floor. Sibling to [[P30]] — same "constants nobody chose" theme, different constant
(the `0.05` in the UI vs the engine's gap-fill order).

**User decisions (2026-08-09):** built Option B (PMT over the invested portfolio) as the *seed*, with
the haircut found by **live per-plan engine search** (not a baked constant), success defined as the
last modeled year holding **≥ `SUGGEST_BUFFER_YEARS` (3, embedded)** years of **portfolio-funded
need** (`spend − guaranteedIncome`), against the **deterministic** path (SoRR stays on Monte Carlo).

- [x] **P49a** — `suggestSustainableSpend(baseInputs, opts)` in `optimizer_core.js` (before
      `optimizeSpend`). PMT seed via the existing `calculateAmortizedWithdrawal` over invested =
      IRA+Roth+Brokerage (Cash excluded as a buffer); coarse scan (`SUGGEST_SCAN_STEPS`, never breaks
      early — same non-unimodal hazard `bestConversionStopYear` documents) then bisect on the existing
      `SPEND_SEARCH_TOLERANCE`. Predicate = `totals.success && last.portfolioBalance ≥ K·need`, i.e.
      `optimizeSpend`'s 1-year terminal test generalized to K years. Returns `{spend, horizon,
      naivePMT, haircut}`. Exported in both lists.
- [x] **P49b** — UI rewire in `optimizer_ui.js`: deleted the flat-5% `computeSuggestedSpend`; added
      `refreshSuggestedSpend()` (caches the solve) called once per recalc from `runSimulation()`;
      `updateSuggestSpendTooltip`/`applySuggestSpend` now read the cache. The solve is
      spendGoal-independent, so the per-keystroke path stays cheap. Tooltip surfaces the horizon and
      the haircut and names the deterministic-path caveat.
- [x] **P49c** — 3 tests in `optimizer_core.tests.js` (boundary: its spend passes, +15% fails;
      buffer monotone; horizon monotone — shorter horizon suggests more). Count 224 → 227;
      `optimizer_tests.js` `EXPECTED.optimizer_core` bumped.
- **Verified:** node 227/227; browser default scenario suggests $146,475 over a 25-yr horizon (71% of
  the naive amortization), apply/restore toggle works, badge green. Horizon monotone in eyeball runs
  (9yr→$67k, 17yr→$41k, 27yr→$27k); SS now gated by the engine, so the old SS-not-gated asymmetry in
  the snapshot is gone.
- **Deferred / notes:** `DisplayHelpers.pensionAtAge` (shipped [[P41]] for the old snapshot) is now
  unused by production but retained as a tested pure utility — the engine is the live gate.
  `gkSpendStable` is NOT in the predicate (kept strategy-agnostic); revisit if a GK suggestion looks
  too high. MC-percentile calibration (SoRR-aware) is the future upgrade if the deterministic buffer
  proves too optimistic.
- **Independent:** no phase dependencies.

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
- [x] **P51e** — DONE 2026-08-10 → `.test_harnesses/ORACLE_RESULTS.md`. **"propwd
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
P20 (README ToC) — independent
P21 (Account Spend View) — independent; complements P8
P22 (CSV Export) — independent; benefits from P21 (not required)
P23 (MC Arithmetic Mean + AR1 Inflation) — independent
P24 (Conversion End Year) — independent; diagnostic + engine flag already exist
P27 (Assumption Sensitivity) — independent; every axis is already a getInputs() field
  └─→ (deferred) winner-stability grid — needs the MC worker
P28 (Unified conversion routing) — independent; research done, does NOT gate P5
```

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| ~~Phase 8 (Variable Growth grid) superseded~~ **REVERSED 2026-07-30, see P27** | The original rationale ("Bootstrap MC + Stress mode cover the use case") does not hold. MC randomizes returns AROUND an assumed mean and Stress varies the historical SEQUENCE; neither varies the mean itself, and neither varies lifespan or inflation at all. The use case was never covered. P27 rebuilds it as a current-plan tornado rather than the original grid |
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

---

---

## P52: Monte Carlo run scope, plan-of-record vs compare-all  *(DONE 2026-08-12, shipped in v11.150b)*

**Why:** the Monte Carlo tab runs `numPaths x buildVariations(base).length` simulations - about 144
strategy arms - every single time, because its purpose has always been to RANK strategies. On the
default scenario that is 72,000 simulations and roughly 1.8 million simulated years, measured at
27-42s. Almost none of that answers the question most people arrive with, which is "will MY plan hold
up". That answer needs 500 simulations, not 72,000. Making the sweep opt-in turns a 30 second wait
into roughly a fifth of a second for the common case, and it turns the tab's auto-run on activation
(normal mode) from a page-freezing event into something instant.

**Shape:** the primary Run button runs the plan of record alone. A second control, nerdknob-gated,
runs the full cross-strategy sweep exactly as today. Everything downstream already handles a single
variation, because the stress pass has always been a one-variation run.

- [x] **P52a** DONE. - Give `runMonteCarlo()` a scope argument (`'plan' | 'compare'`). In `'plan'` scope
      pass a one-element `variations` array built exactly the way `stressVariations` already is
      (`findCurrentStrategyIdx` with the synthetic `_label: 'Current Plan'` fallback), so the worker
      contract, `mc_controller.js` and `worker.js` are untouched. Add the scope to `_buildMCHash()`
      so switching scope re-runs rather than showing the other scope's results.
- [x] **P52b** DONE. - UI: keep "Run Monte Carlo" as the always-visible primary; add "Compare All
      Strategies" beside it, shown only under nerdknob. The existing `#mc-nerd-panel` cannot host it
      as-is: the primary button lives inside that panel and is therefore already hidden from normal
      users, who reach a run only through auto-activation. Either lift both buttons out of the panel
      or add a separate gated wrapper.
- [x] **P52c** DONE. - Presentation in `'plan'` scope: a one-row survival table is not a ranking, so hide
      `#mc-table-wrap` and its shading legend, keep the plan headline and the percentile chart, and
      short-circuit the best-per-family default-selection block in `renderMCResults` (a single
      variation is trivially the selection, `_mcPinIdx` is 0). The click-a-row-to-load and
      "Optimize for" affordances only mean anything in `'compare'` scope.
- [x] **P52d** DONE. - `updateMCTimeEstimate()` already takes a variation count, so pass 1 in plan scope;
      the readout should then read "500 paths, 12,500 simulated years" rather than naming a strategy
      multiplier of one.
- [x] **P52e** DONE. - Tests: scope `'plan'` produces exactly one varResult whose label matches
      `sameStrategySelection` against the sidebar; scope `'compare'` is byte-identical to today's
      output; the hash changes with scope.

**Estimated cost: about half a day, low risk.** No engine change at all - `worker.js`,
`mc_controller.js` and `prng.js` are untouched, which is what keeps the risk down. Roughly 60-100
lines in `mc_tab.js`, ~15 lines of markup, 4-6 assertions, plus changelog and README. It is this
cheap because the one-variation path is already proven in production by the stress pass, which has
run exactly this way since PF3.

**DECISION (user, 2026-08-12): compare stays the default so current users lose nothing.** The
plan-only path is the nerdknob EXTRA, not the new default. That inverted P52b's harder half: the
two buttons both live inside `#mc-nerd-panel`, which is already hidden from normal users, so no
gating work was needed and the auto-run on tab activation still runs the full comparison.

**Measured:** plan scope 1.76s vs compare 37s on the default scenario, and plan scope reproduces
the compare run's pinned figure exactly (66.6%, 333/500) - a useful cross-check that the
one-variation path is the same computation.

~~Original open question:~~ whether NON-nerdknob users get the fast
plan-only path by default. That is the whole UX win, but it is a visible behavior change - today a
normal user landing on the tab eventually sees the full 144-strategy comparison table, and after
this they would see only their own plan unless they turn on nerdknob. The alternative, defaulting
everyone to compare and making plan-only the nerd option, preserves today's behavior but delivers
none of the speed benefit to the people most affected by the wait.

---

## P53: Monte Carlo Stress Test suite  *(DONE 2026-08-13, shipped v11.1521-v11.152f, PR #170)*

**Phased retroactively 2026-08-15** during the git resync - the work shipped un-phased and lived only
in the changelog until now. Recorded here so the feature is discoverable and its one behavior-reversal
(below) is not lost.

**Why:** a single historical stress window hides what the other four would have caught - a short sharp
crash and a long grinding one flag different start years - and the shipped panel had five reported
defects, two of them crashes.

**Tasks (all DONE, `montecarlo/{mc_controller,mc_tab,prng,worker}.js` + `retirement_optimizer.html` +
README + `optimizer_core.tests.js`):**
- [x] **P53a** — Fix five reported Stress Test defects, two crashes: `buildStressBank` sliced its ranked
  candidates to `count` then looped to `count` and destructured **past the end** (the pool is only
  `98 - window + 1` start years, so 85 sequences overran the 15/20/30yr windows); the worker's `onerror`
  swallowed the throw; blank-Paths produced `NaN`. **v11.1521** (`733cc47`).
- [x] **P53b** — Combine-all-windows / run-all-windows: split ranking out of bank-filling with
  `scoreStartYears(sLen)` over the 5/10/15/20/30yr windows; grade on plan length. **v11.1521a** (`3292d11`).
- [x] **P53c** — Stale "Out of date" banner no longer fires when the only edit was a Stress window/
  sequence control (its Re-run swept ~144 strategies to refresh a chart that had already refreshed).
  **v11.1521b** (`83ac77e`).
- [x] **P53d** — Memoize `scoreStartYears` per window length; pure fn of `HISTORICAL_RETURNS` (a static
  table), so `combined`/`all` stop re-deriving the identical ranking every debounced edit.
  **v11.1521c** (`05b2277`).
- [x] **P53e** — **BEHAVIOR CHANGE:** bear-start overlay draws 3/5/10yr openings, not worst-decades
  (1930 is worst over 3yr at -26.9%/yr real but only 13th worst over 10yr at -0.4%/yr because the decade
  contains 1933's +54% rebound). Moves Historical MC results. **v11.1521d** (`d751eb3`).
- [x] **P53f** — **Plan-only is the default run**, both buttons priced and moved outside the Advanced
  panel. **v11.152d** (`49d4560`). **This REVERSED the P52 decision** ("compare stays the default", user
  2026-08-12) two days later. The P52 section above is now historical on that point; P53f is the live
  behavior.
- [x] **P53g** — In-page changelog trimmed to what a normal user sees; bear-start detail moved out.
  **v11.152e / v11.152f** (`c8725d7`, `60fa0fe`).

**Status:** DONE, merged as [PR #170](https://github.com/nightskyguy/retirement_assets/pull/170).
Node-core test additions here are part of the path to the current 263.

---

## P54: `?montecarlo` teaching demo + mode-aware paths floor  *(DONE 2026-08-15, shipped v11.1553, PR #173)*

**Phased retroactively 2026-08-15** during the git resync - shipped un-phased.

**Why:** the Monte Carlo mechanism (why more paths narrow the band, what mu/sigma do) was explained only
in prose; a reader could not watch it happen. A reported bug ("1 path still shows wide bands") turned out
to share a root cause with that gap.

**Tasks (all DONE, `montecarlo/mc_tab.js` +145, `retirement_optimizer.html`, `optimizer_ui.js`, README,
changelog):**
- [x] **P54a** — URL-triggered demo `?montecarlo`: lands on the Monte Carlo tab in **Synthetic** mode,
  exposes Seed / Paths / Input Distributions, and auto-runs an **Experiment** - the sidebar plan
  simulated with 3 random seeds at each of 4 path counts (5/10/25/100). The table shows the sampled
  equity range jump around at 5 paths and settle by 100. Every cell reuses the same engine and payload
  fields a normal "My Plan Only" run reports, so the numbers match by construction; the box glosses
  mu/sigma and links the README Monte Carlo section. **v11.1553** (`52c9b03`).
- [x] **P54b** — **Mode-aware paths floor** (root cause of the "1 path still shows wide bands" report):
  the floor stays **100** normally so survival rate and percentile bands stay meaningful, but drops to
  **3** under nerdknob or the demo. The value was previously clamped to 100 before the run regardless.
  **v11.1553** (`52c9b03`).
- [x] **P54c** — Experiment box is a `<details>` fold (open by default) so it can be collapsed; same
  native-details mechanism as the Input Distributions / FAQ folds. Shipped alongside the optimizer-table
  pinned-row relabel (`⚓ <label>` / `📍 <label>`, dropping redundant BASELINE/CURRENT). `8ca6d42`.
- [x] **P54d** — README: replaced the manual nerdknob walkthrough in the "Monte Carlo and Chance of
  Success" note with a link to the Experiment feature; fixed a broken tool URL (missing `.html`) and
  grammar nits. `4113414` / `52c9b03`.

**Status:** DONE, merged as [PR #173](https://github.com/nightskyguy/retirement_assets/pull/173).
Tests at ship: node core **263/263**, doclinks 22, TPP 32; **browser self-test 559**.

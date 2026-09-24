# Code quality review of `main` (f6783e6, 2026-09-21)

Scope: every tracked `.js`, `.cjs`, `.html`, `.css`, `.md` and hook file on `main`; the five node suites and the in-page suite; the research harnesses only where they duplicate production code. Line numbers are from `main` at `f6783e6`. Every `path:line` below was read or grepped; nothing in this document is quoted from a planning file or from memory.

How the evidence was gathered (tools are in the session scratchpad, not the repo):

- a small JavaScript lexer that separates code from comments, strings and templates (validated on all 96 code files: token gaps and brace balance);
- a numeric-literal inventory of every code file (7,000+ literals classified LOGIC / NAMEDCONST / DATA), a magic-string inventory (601 string comparisons), a comment-block classifier (history words, dates, phase ids, versions, user quotes, measurements, line-number cites, file names that no longer exist, identifiers that exist nowhere);
- an exact and a renamed-identifier clone detector (6- and 8-line windows) over production files, tests and harnesses;
- a UK-English scanner (spelling, doubled consonants, `-ise`, idioms) with zone tagging (string / markup / comment / doc);
- per-test timing of all five node suites, and **mutation testing**: every one of the 5,011 single-token mutation sites in `optimizer_core.js` (and sampled sites in the other engine files) was applied one at a time to a sandbox copy of the repo and the suites re-run, recording which tests, if any, failed. A mutant that no test fails is code whose behavior no test pins. Section 4 is built on that.

---

## 0. Ten findings to decide on first

| # | Finding | Where | Why it matters |
|---|---|---|---|
| 1 | **The FPL table holds the 2024 HHS guidelines, labeled 2025.** `MFJ: 20440, SGL: 15060` are the 2024 figures (HHS: 2024 = $15,060 + $5,380/person; 2025 = $15,650 + $5,500 = $21,150 for two). The `PLAN_YEAR` / `GUIDELINE_YEAR` keys are read by nothing, so nothing could have caught it. | `taxengine.js:1086-1092`; read at `optimizer_core.js:1039-1040`, `optimizer_ui.js:9055-9058, 9484-9493` | **Fixed in 11.18e0; the size stated here at first was wrong.** The engine also added one year of CPI on top of the table (`* (1 + cpi)` in the ACA branch of `computeBracketCeiling`, mirrored by the Limit menu and the limit ladder), which nearly cancelled the stale figures: the 400% MFJ cap for 2026 coverage was $84,049 against a correct $84,600, 0.65% low (single: 1.1% low). The correct fix is the 2025 figures AND no extra year. Swapping in the 2025 figures alone would have put every cap 2.8% high (~$86,970). |
| 2 | **Tax law lives in function bodies and in other pages, not only in `TAXData`.** RMD start age is written four times (plus a fifth, different, rule in `Retirement_Projection.html`); the Social Security FRA, delayed-credit, early-reduction and survivor-reduction rules are literals inside `calculateSurvivorBenefit`; QCD age 70.5 is arithmetic in `isQCDEligible`; `if (state === 'CA')` codes the HSA rule the file's own header says must never be a branch; two standalone pages carry their own copies of the SS thresholds, the federal and IRMAA tables and the RMD divisors. | section 1.1 | **Fixed in the step-3 PR.** RMD start age, the SSA claiming rules, QCD 70½, the CA HSA rule and the estimated-tax threshold are data now; the RMD start age, the Uniform Lifetime Table and the federal/IRMAA tables have one home each, with the page copies deleted. |
| 3 | **Half of `optimizer_core.js` is comment**: 3,435 comment-only lines against 3,429 code lines; 125 blocks of 8+ lines hold 2,199 of them. Across production files, 5,219 comment lines sit in blocks that narrate history (dates, phase ids, "used to", measurements, who asked). Every line-number cite checked (15 of 15) points at the wrong line today; eight comments name harness files that were deleted; three name identifiers that do not exist. | section 3 | The rule the repo already states (comments say what the code does now; history goes in commits) is not what the files contain. |
| 4 | **The share panel is copied into seven pages** (`copyShareURL` byte-identical in 7 files, `toggleSharePanel` in 7, `buildShareURL` / `loadFromURL` re-implemented in 5-6). `escapeHtml` is defined twice and the weaker copy wins at load time. Five `calculateTaxes({...})` call sites in the engine pass a byte-identical 9-line argument object. | section 2 | One fix per copy; the `escapeHtml` collision is a latent attribute-injection hole. |
| 5 | **The in-page suite is not a gate.** `optimizer_tests.js` (595 assertions at run time, incl. the only tests of `calculateWithdrawals`, `applyWithdrawals`, `combineGains`, `calculateAmortizedWithdrawal`, `computeBETR`, `getRMDPercentage`) runs only when a browser opens the page at idle. The pre-commit hook runs the node suites only. So `optimizer_ui.js` (9,538 lines) and `mc_tab.js` (2,768) have no automated gate at all, and several pure engine functions are guarded only by a badge nobody reads before a commit. | section 4 | **Fixed in the step-2 PR.** The engine groups moved to `optimizer_core.tests.js` (28 tests); the 14 `calculateWithdrawals` goldens became rules checked on every scenario, and the node suite now kills 126 of that function's 173 mutants (100 before, 107 for the page goldens; 0 lost). The hook runs the page suite headless (`.githooks/page-suite.js`, `?runtests=page`) and checks the count pins (`check-pins.js`). |
| 6 | **Mutation testing: the node suite misses 41% of single-token changes to `optimizer_core.js`** (5,011 mutants, 2,915 killed, 18 crashed, 2,078 survived), and the misses cluster: 75% of relational-operator swaps survive, 63% of numeric changes, 31% of arithmetic sign swaps, 30% of deleted statements. 812 survivors are high-signal (a deleted balance update, a flipped sign, a negated condition). 85 of the 486 tests killed nothing; 401 took part; a greedy cover of 185 tests kills everything the suite kills, and 60 tests have no kill of their own. Whole functions have no test that reacts to any change: `attributeIncrementalTaxes` (56 of 56 survive), the IRA-inheritance and survivor-pension lines in `computeIncome`, the Roth-first third pass, the QCD "as needed" mode. | section 4 | **Addressed in the step-6 PR, and the headline did not hold.** The ten targets that were never mutated are measured now: 4,079 further mutants, scores from 16% (`montecarlo/stats.js`) to 78% (the feedback Worker's `logic.cjs`). **60 of the 85 "killed nothing" tests kill something once their own subject is mutated**, and seven more were in the run's own `skipTests` and never ran at all. Real dead weight: the ten OPT_GOLDEN fixture tests, now one. Eleven tests added from 4.8, each verified by injecting the mutation it targets. |
| 7 | **`Retirement_Projection.html` computes ages as of May 2026 forever**: `CURRENT_YEAR = 2026; CURRENT_MONTH = 5` (`:878-879`) feed `computeAge`. It also embeds a full copy of the federal and IRMAA tables "as a fallback" and a copy of the RMD table, and still special-cases a `'no'` state key that `TAXData` no longer has. | `Retirement_Projection.html:16-70, 878-905, 2238-2243` | Wrong age after 2026-05, and three tables that drift independently of `taxengine.js`. **The tables are gone in the step-3 PR** (the page reads `taxengine.js`, and its RMD divisors past age 100 are the IRS ones); the dates and the `'no'` branch are still open. |
| 8 | **Dead code and dead data**: 7 functions defined and never referenced (`getEffectiveTaxRate`, `sumAccounts`, `deltaRefDescription`, `exportAllScenarios`, `effectiveStd`, `showToast`, `fmtDiff`); `TAXData` keys read by nothing (`partBDeductible`, `FLAT_RATE` in 13 state rows, `exemption_dependent`, `FPL.PLAN_YEAR`, `FPL.GUIDELINE_YEAR`); a `TEST` fixture state inside the production `TAXData`; a `yeIraWins` branch pair in `taxPaymentPlanner.js` whose both arms equal the `else`. | sections 1.2, 2, 3 | Cheap to delete; each one is a place a reader stops to wonder. |
| 9 | **State tables stamped 2026 carry 2024/2025 figures with a note saying so**: WI `YEAR: 2025`, MT standard deductions "(2024)", NE "approx. 2025 value; verify", KY "(2025)", ME header "2025"; and `SOCIALSECURITY` uses the key `Year` where every other block uses `YEAR`, so a script that checks year stamps skips it. | `taxengine.js:94, 669, 789, 802, 872, 879, 982` | **Mostly wrong as written, and the step-9 PR replaced it.** MT, NE, KY and ME are cited for note TEXT, not year stamps: all four are stamped `YEAR: 2026`. WI was the one block stamped 2025, and honestly so. Nothing in the tree reads a state year stamp at all. The `SOCIALSECURITY` key is real and is fixed. What checking it DID find: (a) Minnesota's brackets were silently reverted by `cc27609` three weeks after `5596e1a` set them, in a commit about something else, and its `std` was pointed at the federal amount although MN publishes its own; (b) eight states cut rates effective 2026-01-01 and the table missed IN, KY, MS and MT; (c) Wisconsin never got 2025 Act 15, which widens the 4.40% band from $29,370 to about $52,000; (d) Virginia carried a 7% bracket over $600,000 that does not exist, with Georgia's standard deduction beside it. Seven jurisdictions corrected against their own revenue departments. **Still open: AZ, GA, NC, ND, NE, SC standard deductions and ND/NE/SC bracket structure** - see the step-9 commit for the evidence on each. |
| 10 | **UK English in user-facing text**: 17 strings/markup sites (`greys out`, `the other way round` x7, `tick`/`untick`, `labelled`, `minimise`, `realises`, `Import cancelled.`), 44 in published docs, 96 in code comments. Full list in section 5. | section 5 | Mechanical; the list is exact. |

---

## 1. Hard-coded constants in logic

Classes: **LAW** (statute or tax-year value, goes stale on a schedule), **MODEL** (a modeling assumption), **SEARCH** (solver grid, tolerance, cap), **ENUM** (a mode or key compared as a bare string), **UI** (timing, default, display threshold). A named constant is listed only when it is law-dependent with no year, or written in more than one place. `+DUP` names the other copies.

What is already right, and should be the pattern for the rest: `TAXData` and `RMD_TABLE` (`taxengine.js`), `OPTIMIZER_GRIDS`, `IRMAA_MARGIN_MODES`, `RAIL_PRESETS`, `SPLIT_VECTORS` (`optimizer_core.js`), `MC_PARAMS` with its clamped reader (`mc_tab.js:44-59`), `INFLATION_AR1_*` with the fit they came from (`prng.js:39-51`), `LIMITS` in both halves of Send feedback with a parity test.

### 1.1 Tax law and statute values outside `TAXData`

| Location | Literal | Meaning | Class | Recommendation |
|---|---|---|---|---|
| `optimizer_core.js:83` `(birthYear >= 1960) ? 75 : 73` | RMD start age | SECURE 2.0 | LAW +DUP `optimizer_core.js:4650`, `optimizer_ui.js:919`, `optimizer_ui.js:4344`; a third rule at `Retirement_Projection.html:890-892` (adds 72 for pre-1951) | `TAXData.RMD = { START_AGE: [[1960, 75], [1951, 73], [0, 72]], TABLE }` and one `rmdStartAge(birthYear)` in `taxengine.js` next to the table; delete the four copies |
| `optimizer_core.js:87` `age > 120`, `optimizer_ui.js:925` `Math.min(age, 120) ?? 2.0`, `:929` `?? 26.5` | table bounds and two fallbacks that repeat table entries | LAW +DUP | derive from `Object.keys(RMD_TABLE)`; never restate a table value as a fallback |
| `optimizer_core.js:796-798` `by <= 1954 → 66*12`, `by >= 1960 → 67*12`, `66*12 + (by-1954)*2` | Social Security full retirement age | LAW (SSA) | `TAXData.SOCIALSECURITY.FRA` table |
| `optimizer_core.js:853` `0.08 / 12`; `:856-858` `36`, `5/9/100`, `5/12/100`; `:847` `Math.max(spouseClaimAge, 60)`; `:878` `0.285` | delayed retirement credit 8%/yr, early-claim reduction 5/9% x 36 months then 5/12%, survivor earliest age 60, survivor early reduction 28.5% | LAW (SSA) | `TAXData.SOCIALSECURITY.RULES = { delayedCreditPerYear: 0.08, earlyReduction: [...], survivorMinAge: 60, survivorMaxReduction: 0.285 }`; `calculateSurvivorBenefit` reads it |
| `optimizer_core.js:1922` `0.85 * (yr.s1 + yr.s2)` | provisional-income proxy for the MAGI ceiling | LAW +DUP `TAXData.SOCIALSECURITY` rate 0.85; re-implemented at `standalone/irmaa_and_rmds.html:252, 260` (`0.5 *`, `0.85 *`) and `standalone/IncomeTaxPlanner.html:1143` (`.5*cfg.ssIncome`) | read the rate from the table; the two pages call `calculateTaxableSocialSecurity` instead of re-deriving it |
| `standalone/IncomeTaxPlanner.html:335` `SS_T = { MFJ:{t1:32_000,t2:44_000}, SGL:{t1:25_000,t2:34_000} }` | SS taxation thresholds | LAW +DUP `taxengine.js:95-96` | delete; the page already loads `taxengine.js` |
| `taxengine.js:1791` `birthYear + 70 + (birthMonth <= 6 ? 0 : 1)` | QCD eligibility age 70.5 | LAW | `TAXData.QCD.ELIGIBILITY_AGE: 70.5` beside `AMOUNT` and `YEAR` |
| `taxengine.js:1577` `if (state === 'CA')` | CA disallows the HSA deduction | LAW as a code branch; `taxengine.js:1285` says "no `if (state === 'XX')` branches here - only dispatch on `rule.mode`" | `TAXData.CA.hsaDeductible: false`, one generic read |
| `taxengine.js:1086-1092` `MFJ: 20440, SGL: 15060` | FPL guidelines | LAW, **wrong year** (finding #1) | correct to the 2025 guideline ($21,150 / $15,650) and make `GUIDELINE_YEAR` load-bearing: a test that fails when `GUIDELINE_YEAR + 1 !== FEDERAL.YEAR`. **Fixed in 11.18e0**, with the extra year of CPI removed as well (finding #1) |
| `taxengine.js:108` `ANNUAL_INCREASE: 0.056, // based on analysis of` | Medicare premium growth assumption | MODEL, truncated source; read by `optimizer_core.js`, `Retirement_Projection.html`, `standalone/irmaa_and_rmds.html` | **Closed 2026-09-23, by saying what it is rather than by finding a source.** The truncated sentence is gone; whatever analysis produced 0.056 is lost, and the comment now says so instead of leaving the number looking official. It also names the two published figures it can be checked against - the actual 2025 to 2026 Part B premium rise of 9.68% ($185.00 to $202.90, CMS) and the 8.8% five-year Part B cost growth the 2025 Trustees Report projects - and records that 0.056 sits below both, so Medicare and IRMAA costs are more likely understated than overstated. **The value is deliberately unchanged:** moving it moves every plan that reaches an IRMAA tier, which is a modeling decision and not a correction. |
| `taxPaymentPlanner.js:1138` `const FED_HIGH_INCOME_AGI = 150000` (inside a function); `:1142-1147, 1162-1166, 2084-2087, 3096` `0.90 / 1.00 / 1.10`; strings `"$150,000"` at `:2450, 2839, 2847`; `optimizer_ui.js:3762` `MAGI > 150000` | estimated-tax safe harbor | LAW +DUP across two files | `TaxPaymentPlanner.SAFE_HARBOR = { highIncomeAGI: 150000, currentYearPct: 0.90, priorYearPct: 1.00, priorYearHighPct: 1.10 }` exported; `optimizer_ui.js:3762` reads it; the three strings interpolate it |
| `taxPaymentPlanner.js:326, 410, 428` `150000`; `:393` `1000000` | per-state high-income thresholds | LAW (data rows, fine) - listed because the federal one above is not a row | move the federal figure into the same shape as the state rows |
| `Retirement_Projection.html:2315` `v > 82500`, `:2320` `v > 165000` | "Based on 2026 limits" contribution warnings | LAW, no source, no year key | **Closed 2026-09-23.** `CONTRIB_WARN_ABOVE` now carries `YEAR: 2026` and says what it is: a DISPLAY threshold set well above any real limit, so it catches an extra zero without nagging someone genuinely maxing out - not an IRS figure, which the old 'Based on 2026 limits' wording implied it was. The 2026 deferral, catch-up and 60-to-63 catch-up figures it was sized against are cited (IRS Notice 2025-67), and the YEAR is what lets a reader tell a deliberately generous threshold from one nobody has looked at since. |
| `Retirement_Projection.html:16-70` | full copy of `TAXData.FEDERAL` and `TAXData.IRMAA` ("Inline fallback ... Keep in sync with taxengine.js") | LAW +DUP of `taxengine.js:9-131`; identical today, by hand | delete; the page loads `taxengine.js` at `:72` (with a stale `?v=1115c9`) |
| `Retirement_Projection.html:896-901` `ULT = { 72:27.4 ... 100:6.4 }`; `:905` `\|\| 6.4` | RMD divisors, ages 72-100 only | LAW +DUP of `RMD_TABLE` (72-120) | read `RMD_TABLE` |
| `Retirement_Projection.html:878-879` `CURRENT_YEAR = 2026`, `CURRENT_MONTH = 5 // May` | "today" | UI, stale monthly (finding #7) | `new Date()` |
| `standalone/IncomeTaxPlanner.html:328` `BASE_YEAR = 2026`; `:1112` `>= 65` x2 | tax year; senior age | LAW +DUP of `TAXData.FEDERAL.YEAR` and `FEDERAL.*.age` | read them |
| `taxengine.js:94` `Year: 2026` | SOCIALSECURITY year stamp | key spelled differently from the 34 `YEAR:` stamps | rename; add a test that every block with brackets has `YEAR === FEDERAL.YEAR` or a `NOTE` saying why not |
| `taxengine.js:982` WI `YEAR: 2025`; `:872, 879` MT `std` "(2024)"; `:669` NE `std` "approx. 2025 value; verify"; `:789` KY "(2025)"; `:802` ME "2025"; `:438` MD "may be slightly higher" | stale state figures inside a 2026 table | LAW (finding #9) | update or stamp each with its real year and let the test above report the list |

### 1.2 Data defects and dead data found while checking

| Location | What | Action |
|---|---|---|
| `taxengine.js:1006-1012` `TEST: { ... }` inside `TAXData` | a test fixture in production data (kept out of menus only by `key.length === 2` at `optimizer_ui.js:8431` and `STATE !== undefined` in the two pages) | move to `taxengine.tests.js`, which is the only reader |
| `taxengine.js:1469` JSDoc "`'no'` for no-tax states"; `Retirement_Projection.html:2238, 2243`; `standalone/IncomeTaxPlanner.html:1270` | `TAXData.no` no longer exists (each no-tax state is its own entry, `:1027-1035`); the doc and the two `k === 'no'` branches are dead | delete |
| `taxengine.js:111` `partBDeductible: 283` | never read | delete or use |
| `taxengine.js` `FLAT_RATE` (13 state rows) | never read anywhere; the flat rate is carried by the single bracket | delete the key |
| `taxengine.js` `exemption_dependent` (2 rows) | never read | delete |
| `taxengine.js:1087-1088` `PLAN_YEAR`, `GUIDELINE_YEAR` | never read (finding #1) | make them load-bearing (test) |
| `taxengine.js:1123` `RMD_TABLE` "Uniform Lifetime Table (Simplified)" | no year, no source; these are the 2022 table values | add `YEAR: 2022` and the IRS publication |
| `taxPaymentPlanner.js:1247-1253` | `else if (yeIraWins && iraWCap >= totalTax) 'ye_ira_full' else if (yeIraWins) 'ye_ira_partial' else (iraWCap >= totalTax ? 'ye_ira_full' : 'ye_ira_partial')` - the `yeIraWins` arms compute exactly the `else` | collapse to the `else`; `yeIraWins` then has no effect here, which is either the bug or the comment's job to explain |
| `taxPaymentPlanner.js:2737` `(t < -0.5 ? '' : '')` | no-op ternary | delete |
| `taxPaymentPlanner.js:95` "hysaGross default 0.045" vs `:820` `hysaGross: 0.038` | header lies about a default | fix the header |
| `optimizer_core.js:5507-5509` `const start = probe.log[0].year; if (n === 0) return null;` | reads `log[0]` before the empty-log guard | swap the two lines |
| `optimizer_core.js:5676` `return 0.045;` in `bengenRate` | unreachable (every path returns inside the knot loop) | delete |
| `optimizer_ui.js:7473` and `montecarlo/mc_tab.js:2762` `escapeHtml` | two global definitions; `mc_tab.js` loads later and its copy escapes `& < >` only, so attribute values built with `escapeHtml` in `optimizer_ui.js` are NOT quote-safe at runtime | one definition in `displayhelpers.js`, the five-entity one. **Fixed in 11.18e0** (`DisplayHelpers.escapeHtml`, plus a test that no two scripts on the page declare the same top-level name) |

### 1.3 Modeling assumptions and fallbacks written more than once

| Location | Literal | Meaning | Recommendation |
|---|---|---|---|
| `optimizer_core.js:2078-2079` `?? 0.20`, `?? 0.10`; `:5638` `?? 0.20`; `:6158` x4; `optimizer_ui.js:783-784` `\|\| 0.20`, `\|\| 0.10`; `:6943` `\|\| 20`, `\|\| 10`; `retirement_optimizer.html` `value="20"`, `value="10"` | Guardrails band and adjustment defaults, 9 sites in 3 files | `GK_DEFAULTS = { guard: 0.20, adjPct: 0.10 }` in `optimizer_core.js`; the HTML `value=` attributes are written from it at load (the page already does this for other controls via `captureDefaults`) |
| `optimizer_core.js:1664`, `:5309` `?? 0.50`; `optimizer_ui.js:4338` `: 0.50` | basis step-up fallback when a state has no `BasisStepUp` | one `TAXData.DEFAULT_BASIS_STEP_UP`, or give every state row the key (34 rows have it) |
| `optimizer_core.js:4644` `?? 0.06`; `optimizer_ui.js:914` `\|\| 0.06`; HTML `value="6.0"` | growth fallback | read the captured default |
| `optimizer_ui.js:8612, 8809, 9058, 9361` `\|\| 2.8` | CPI fallback, 4 sites; HTML `value="2.8"` | same |
| `optimizer_ui.js:8569` `\|\| 140000`; `:8488-8491` `\|\| 1960`, `\|\| 88`, `\|\| 1952`, `\|\| 98` | spend / birth / death fallbacks repeating the HTML defaults | same |
| `optimizer_core.js:5006` `let nominalTaxRate = 0.20; // Just a guess.` | year-0 seed for the tax rate | name it `TAX_RATE_SEED` with the sentence that says it is overwritten by the first `calculateTaxes` |
| `optimizer_core.js:2282-2283` `nominalFedTaxRateAtLimit = 0.14; nominalStateTaxAtLimit = 0.07` | placeholder rates when no ceiling applies | named constants with the reason, or `null` |
| `optimizer_core.js:3329` `[40, 60]` | Brokerage/Cash gap-fill weights fallback | `GAP_FILL_DEFAULT_WEIGHTS` |
| `optimizer_core.js:4670` `* 0.99`; `optimizer_ui.js:3556` `* 0.99`; `optimizer_ui.js:4371` `* 0.90` | "funded" tolerance in the engine, repeated in the table, and a DIFFERENT threshold for the milestone marker | one exported `FUNDED_TOLERANCE`; decide whether the 0.90 milestone is meant to differ and say so |
| `optimizer_core.js:2902` `* 0.5` | cyclic harvest depletion threshold | `CYCLIC_DEPLETION_FRACTION` |
| `optimizer_core.js:2933` `* 0.99` | reduce-floor slack | name it |
| `optimizer_core.js:4655-4656` `± 0.02` | BETR flag band | `BETR_FLAG_BAND` |
| `optimizer_core.js:1747` `ssFailYear > 2000` | sentinel for "no SS failure" | `SS_FAIL_NEVER` or `null` |
| `optimizer_core.js:5591` `Math.max(500, spendGoal * 0.02)`; `optimizer_ui.js:1600` same | minimum-spend floor, twice | export one |
| `optimizer_core.js:51` `SPENDABLE_WEIGHT = 1.10` | ranking weight; exported and referenced by no test | fine as a constant; it needs a test (4.3) |
| `montecarlo/mc_engine.js:77` `?? 60`; `:224` `?? 25`; `:268, 682` `?? 20`; `:309, 675` `?? 42`; `:310` `?? 0.03`; `:422` `?? 2026`; `rails_engine.js:186` `?? 42`; `mc_controller.js:157` `?? 42`; `mc_tab.js:12, 489, 635, 777, 955` `2026` | engine-side fallbacks that repeat `MC_PARAMS` and the plan's start year | the engine reads `MC_PARAMS[...].dflt` (it is loaded in the worker) and `planFirstYear()`; one `DEFAULT_SEED` |
| `montecarlo/prng.js:242, 281, 321, 329, 418, 466` `10` x8 | stress window / count defaults written eight times | `STRESS_DEFAULTS = { count: 10, window: 10 }` |
| `montecarlo/stats.js:16-18, 49-53` `0.05 0.10 0.25 0.50 0.75 0.90 0.95` | percentile list, twice | `PERCENTILES` |
| `montecarlo/mc_tab.js:1378` `0.90 / 0.75` (+ the HTML legend) | survival bands | `SURVIVAL_BANDS`, and the legend renders from it |
| `taxPaymentPlanner.js:525, 2271, 2401` `16 -` | "April of next year is month 16" | `APRIL_NEXT_YEAR = 16` |
| `taxPaymentPlanner.js:755-756, 1724` `15`; `:1591` `day >= 24`; `:1879` `month >= 7` | due-day convention, late-December cutoff, second-half test | named |
| `taxPaymentPlanner.js:614` `86400000` vs `:952` `YEAR_MS` | ms per day inline, ms per year named | `DAY_MS` |

### 1.4 Solver knobs

| Location | Literal | Recommendation |
|---|---|---|
| `optimizer_core.js:6441` `STEP = 25000` and `:6498` `STEP = 25000` (two `const`s with the same name and value); `:6619, 6621, 6623` `25000` x5 inline; `:6619` `/ 16` | conversion search step | `OPTIMIZER_GRIDS.convStep = 25000`, `convRefineSpan = 1/16` |
| `optimizer_core.js:6520-6522` `0.05`, `0.75`, `0.01`; `:6655` `0.01`; `:6572` `coarseSteps ?? 4` | break-even heirs-rate search bounds and resolution | one `BREAK_EVEN_SEARCH` object |
| `optimizer_core.js:569, 615` `iter < 3`; `:3844` `< 3`; `:3486` `unbounded ? 200 : 6`; `:3555` `< 6`; `:5702` `g < 6`, `hi *= 1.6`; `taxengine.js:1446` `i < 40 && hi - lo > 0.005`; `rails_engine.js:270` `round < 80` | fixed-point and bisection caps | named per site; the third-pass caps 6/200 belong in `OPTIMIZER_GRIDS` |
| `optimizer_core.js:509-623` `0.01` x10; `:337` `1e-6`; `:4139` `1e-9`; `:4193` `0.0001`; `:7124` `0.0001`; `:6152, 6193, 6208` `0.001`; `:6244, 6853` `1e-9` | dollar and rate epsilons, six different values | `EPS_DOLLARS = 0.01`, `EPS_RATE = 1e-4`, `EPS_EXACT = 1e-9` |
| `optimizer_core.js:2391` `>= 64` | shape cache size | name it |
| `optimizer_core.js:5979, 6310`; `optimizer_ui.js:2114` `?? 9999` | "no break-even year" sentinel, three sites | `BE_NEVER` |
| `montecarlo/rails_engine.js:83-99` `RAILS_*` | named, fine | - |

### 1.5 Magic strings (mode keys compared as bare literals)

601 string comparisons, 201 distinct values, across the engine and UI. The ones that cross file boundaries:

| Value | Comparisons | Files | Recommendation |
|---|---|---|---|
| `'bracket'` 23, `'aca'` 15, `'fixedpct'` 10, `'ordered'` 9, `'fixed'` 9, `'split'` 9, `'propwd'` 8, `'schedule'` 5 | strategy keys | `optimizer_core.js`, `optimizer_ui.js`, `mc_tab.js`, `Retirement_Projection.html` | `STRATEGY = Object.freeze({ BRACKET: 'bracket', ... })` in `optimizer_core.js`, exported like `IRMAA_MARGIN_MODES`; a typo then throws instead of falling into the baseline `else` |
| `'rbg'` 20, `'gk'` 18 | spend rules | 4 files | `SPEND_RULE` |
| `'bootstrap'` 9, `'aam'` 8, `'gbm'`, `'stress'` 10, `'combined'` 8, `'all'` 7 | Monte Carlo modes and window modes | `mc_tab.js`, `mc_engine.js`, `rails_engine.js`, `prng.js` | `MC_MODE`, `STRESS_WINDOW` |
| `'plan'` 7, `'compare'`; `'rails'` 7 | run scope, worker job kind | `mc_tab.js`; `mc_controller.js`, `worker.js` | `MC_SCOPE`, `JOB_KIND` |
| `'fillCashThenRoth'` 5, `'fillRothThenCash'` | Roth gap-fill positions (validated against the two literals at `optimizer_core.js:3231`) | 3 files | `ROTH_GAP_FILL` |
| `'—'` 12 | empty-cell sentinel compared as a string | `optimizer_ui.js` | `EMPTY_CELL` |
| `'flat'`, `'custom'`, `'early'`, `'late'`, `'never'`, `'auto'`, `'mine'`, `'extra'` | assorted mode keys | `optimizer_ui.js` | one `MODES` block per control |

### 1.6 UI timings, defaults and release tokens

| Location | Literal | Recommendation |
|---|---|---|
| `optimizer_ui.js:1296` `60`, `:1302` `OPT_BUSY_HOLD_MS = 5000`, `:4964` `RAILS_AUTORUN_DEBOUNCE_MS = 900`, `:5078` `250`, `:6308` `400`, `:6321` `600`; `mc_controller.js:208` `< 16`; `worker.js:25` `< 60`; `rails_engine.js:206` `>= 16` | six debounce/throttle intervals, three named | one `TIMING` block; the `400` at `:6308` is the "sidebar recalc debounce" that the comment at `:4963` refers to by value |
| `optimizer_ui.js:612` `-25 / 25`; `:835, 850` `1 / 99.5`; `:826` `RBG_GAP = 5`; `:898` `< 60`; `:8514, 8516` `> 10`, `< 3` (+DUP `mc_tab.js:337, 339`) | input clamps and warning thresholds | put them in the same shape as `MC_PARAMS` (min / max / dflt per input id) |
| `optimizer_ui.js:3779` `minNetWorth = 100000` | stat-tile threshold | name it |
| `retirement_optimizer.html` 15 `?v=` tokens with 10 distinct values, plus `const V = '?v=1118bf'` at `:1895` for the tier-2 loader; `Retirement_Projection.html` `?v=8` and `?v=1115c9`; `RetirementTaxPlanner.html` `?v=15a2` x3 | cache-bust tokens edited by hand each release | one `ASSET_VERSION` in the page head that a 3-line loader appends to every local script/link, so a release edits one line (and the worker's `importScripts` reads the same value) |

---

## 2. Copied code

| Locations | Size | What differs | Refactor |
|---|---|---|---|
| `copyShareURL`: `optimizer_ui.js:7204-7219`, `RetirementTaxPlanner.html:675-690`, `Retirement_Projection.html:2137-2152`, `standalone/IncomeTaxPlanner.html:1369-1384`, `standalone/RealReturns.html:1008-1019`, `standalone/AfterTaxRealGrowth.html:843-850`, `standalone/HYSA.html:644-655` | 7 copies, 79 tokens each | nothing (byte-identical) | `sharepanel.js`: `SharePanel.init({ build: buildShareURL })` owning toggle/copy/status; every page already loads `displayhelpers.js` except HYSA and RealReturns, so `displayhelpers.js` is also a home |
| `toggleSharePanel`: same seven files (`optimizer_ui.js:7193-7202` ...) | 7 copies, 91 tokens | element ids only | same |
| `buildShareURL` x6, `loadFromURL` x5 (`optimizer_ui.js:7152-7191, 7232-7347`; `RetirementTaxPlanner.html:611-662`; `standalone/IncomeTaxPlanner.html:1344-1351, 1459-1529`; `RealReturns.html:978-996, 415-432`; `AfterTaxRealGrowth.html:817-826, 861-867`; `HYSA.html:624-632, 290-295`) | 40-115 lines each | the field list; the encode/decode loop is the same shape | `SharePanel.bind(fieldIds, { encode, decode })` with the field list as data |
| `escapeHtml`: `optimizer_ui.js:7473-7477` (5 entities) vs `montecarlo/mc_tab.js:2762-2767` (3 entities) | 5 lines | the second drops `"` and `'`, and wins at load | one copy in `displayhelpers.js` (finding #8). **Fixed in 11.18e0** |
| `calculateTaxes({...})` argument object: `optimizer_core.js:3124, 3349, 3472, 3505, 3572` | 5 byte-identical 9-line objects (14 call sites, 10 distinct shapes) | nothing; the other nine differ in one or two fields | `taxArgs(sim, yr, overrides)` builder; each site passes only its override |
| Reprice block `yr.capitalGains = ...; yr.tax = calculateTaxes(...); yr.totalTax = ...`: `optimizer_core.js:3346-3355`, `3465-3480`, `3504-3513` | 8-9 lines x3 | a comment | `repriceYear(sim, yr)` |
| Ceiling rate derivation: `optimizer_core.js:1017-1025` and `1041-1047` (`findUpperLimitByAmount` for FEDERAL then state, `nominalRateAtLimit` x2) | 7 lines x2 | the branch it sits in | `ratesAtLimit(limit, ...)` |
| `optimizer_core.js:2982-2988` vs `2995-3028` | 7 units | branch | fold |
| RMD start-age rule (section 1.1) | 4 sites + 1 variant | the variant adds age 72 | one function |
| `Retirement_Projection.html:16-70` vs `taxengine.js:9-131`; `:896-901` vs `RMD_TABLE`; `standalone/IncomeTaxPlanner.html:335` vs `taxengine.js:95-96` | ~60 + 6 + 1 lines | identical today; a manual "keep in sync" | delete the copies (section 1.1) |
| `updateStateNote`: `retirement_optimizer.html:1749-1765` vs `Retirement_Projection.html:2216-2231` | 17 lines, 89% similar | element ids | `stateNoteHtml(state)` in `taxengine.js` or `displayhelpers.js` |
| Quarterly-estimate builders `taxPaymentPlanner.js:1895-1925, 1927-1956, 1961-1982, 1984-2007` (`1898-1905` = `1964-1971`, `1931-1938` = `1988-1995` byte-identical) | 4 x ~25 lines | which IRA, which tranche | one builder with `(ira, tranche)` parameters |
| `taxPaymentPlanner.js:384-397, 401-414, 419-432` (MS/CA/OR/VA rows as literal objects) vs the `_s()` helper the other 40 states use; `:407-412` = `:425-430` | 3 x 14 lines | `ocWeightedMonths` values that are derivable from the schedule | use `_s()`; compute `ocWeightedMonths` from the due dates |
| `optimizer_ui.js:5859-5866` vs `6084-6091` (tooltip `title` callbacks); `mc_tab.js:2198-2203, 2211-2220` vs `2344-2349, 2353-2362` (main vs stress chart options) | 8 + 15 lines | dataset names | shared option factories; the global `Chart.defaults` block already exists for this purpose |
| `standalone/AfterTaxRealGrowth.html` vs `standalone/FutureCost.html`: CSS `:282-323`/`:299-340`, `:234-252`/`:250-268`, `:107-122`/`:135-150`, `:255-270`/`:271-286`, `:14-27`/`:14-27`, `:85-96`/`:111-122`, `:30-41`/`:30-41`, `:212-220`/`:71-79`, `:332-340`/`:358-366`, `:53-60`/`:55-62`, `:65-74`/`:87-96` | ~150 identical lines | nothing | `standalone/tool.css` |
| `standalone/HYSA.html:629-666` vs `standalone/RealReturns.html:993-1030` (share URL), `:7-17`/`:7-17` (head), `:19-30`/`:19-30`, `:255-262`/`:355-362` (`Chart.defaults`), `:121-130`/`:181-190` | 28 + 10 + 10 + 8 + 9 units | nothing | same stylesheet + `sharepanel.js` |
| The 12-line `DOCTYPE`/head block: `Retirement_Projection.html`, `AfterTaxRealGrowth.html`, `FutureCost.html`, `IncomeTaxPlanner.html`, `irmaa_and_rmds.html` `:1-12` | 5 copies | nothing | acceptable for static pages; note only |
| `Retirement_Projection.html:1823-1833` vs `1844-1854`; `syncContribUI :2295-2302` vs `syncRothContribUI :2304-2311` (identical shape, 60 tokens) | 10 + 8 lines | account name | parameterize |
| `feedback.js:49-58` vs `.feedback-worker/src/logic.cjs:17-26` `LIMITS` (`message`, `address`, `tool`, `version` repeated) | 4 values | deployed separately; parity pinned by `feedback.tests.js:390` | keep; the test is the right guard |
| Dual-mode export tail (`if (module) module.exports = {...} else window.X = {...}`): `prng.js:573-581` vs `586-594` and the same pattern in 9 files | 9-12 lines x 2 per file | the name list | keep (each engine file must stand alone under `importScripts`); one line-per-name list instead of two |
| `.test_harnesses/*`: 88 cross-file exact-clone pairs, 1,112 duplicated lines (the `COMMON` household in 24 files) | large | already tracked as `P112c` / `P116` | as planned |
| test suites: 19 within-file clone pairs, 173 lines (`optimizer_core.tests.js` fixture blocks) | small | - | fold into the `BASE` fixture where a test repeats it |

Functions defined and never referenced anywhere (git grep, excluding `.test_harnesses` and `.planning`): `getEffectiveTaxRate` `optimizer_core.js:489-505`, `sumAccounts` `optimizer_core.js:769-771`, `deltaRefDescription` `optimizer_ui.js:449-454`, `exportAllScenarios` `optimizer_ui.js:8401-8424`, `effectiveStd` `Retirement_Projection.html:1027-1030`, `showToast` `Retirement_Projection.html:2163-2170`, `fmtDiff` `standalone/HYSA.html:299`. Exported from `optimizer_core.js` and never named by any test: `compareByTiebreakChain`, `describeSelection`, `snapshotResume`, `SPENDABLE_WEIGHT`, `OPT_TIEBREAK_*`, `SUMMARY_*FIELDS`, `ADVISOR_FEE_*`.

---

## 3. Comments

### 3.1 The numbers

| File | Comment-only lines | Share of non-blank | Blocks of 8+ lines | Lines in those | Lines in blocks with a history marker |
|---|---|---|---|---|---|
| `optimizer_core.js` | 3,435 | 50.0% | 125 | 2,199 | 1,598 history + 318 dated + 1,696 phase-id (overlapping) |
| `optimizer_ui.js` | 2,752 | 30.8% | 68 | 817 | 823 / 246 / 855 |
| `montecarlo/mc_tab.js` | 773 | 30.5% | 14 | 139 | 227 / 34 / 166 |
| `montecarlo/prng.js` | 247 | 44.9% | 12 | 144 | 104 / 0 / 31 |
| `montecarlo/rails_engine.js` | 273 | 35.6% | 7 | 176 | 107 / 123 / 138 |
| `montecarlo/mc_engine.js` | 217 | 31.0% | 5 | 57 | 65 / 0 / 80 |
| `montecarlo/mc_controller.js` | 87 | 42.6% | 2 | 32 | 35 / 0 / 9 |
| `taxengine.js` | 467 | 27.2% | 13 | 245 | 124 / 0 / 55 |
| `taxPaymentPlanner.js` | 648 | 21.5% | 18 | 280 | 265 / 0 / 72 |
| all production files | 9,902 | - | 273 | 4,259 | 5,219 lines sit in a block carrying at least one of: "used to / was / no longer / replaced / shipped", a date, a phase id, a version, a PR, a user quote |
| `optimizer_core.tests.js` | 2,458 | 27.1% | 45 | 620 | 968 / 171 / 837 |
| `optimizer_tests.js` | 744 | 21.6% | 20 | 228 | 250 / 83 / 143 |

"History marker" is a regex over the block text (`used to`, `no longer`, `until P`, `shipped`, `the bug`, `measured`, `2026-0x-xx`, `P\d+[a-z]`, `v11.x`, `user, 20xx`, dollar figures with commas). It over-counts a little (a phase id used as a pointer into `task_plan.md` is legitimate); it is the right order of magnitude.

### 3.2 Verified stale, broken, dead and orphaned comments

Every row below was checked against the code on `main`.

| Location | Kind | What | Action |
|---|---|---|---|
| `optimizer_core.tests.js:9044-9052` and `ARCHITECTURE.md:682` | STALE cite | "`optimizer_core.js:928` sets `yr.loopStart`, `:2381` derives loopMs, `:1739` accumulates thirdPassTime" - today those are `:1483`, `:4706`, `:3522` | drop the numbers; name the fields |
| `optimizer_core.js:2251` `(:1226)`; `:3444` `(:1793)`; `:3469` `(:1504, :1638, :1753)`; `optimizer_core.tests.js:2699, 2727, 2812, 3236, 3615, 3647, 5510` (`optimizer_core.js:1649-1653`, `:1645-1647`, `:2325`, `:1303`, `:1741`, `:1154`, `:2835`) | STALE cite | 15 line-number cites checked, 0 correct | a rule: cite by function name, never by line (`task_plan.md` already has this rule for `findings.md`) |
| `optimizer_core.js:1085-1111` `acamagi_harness.js`; `:1448-1474` `rmdbasis_harness.js`; `:1998-2024` `ceilded_harness.js`; `:2741-2763` `harvestceil_harness.js` (+ `tests:2482-2487`); `:2773-2800` `ltcgroom_harness.js`; `:4325-4364`, `:4400-4459` `growthcredit_check.js`; `tests:4440-4454` `extraconv_magi_harness.js`; `standalone/RealReturns.html:389` `scripts/validate_palette.js` | STALE file ref | none of these files exist (retired in P116) | cut the sentence; where the number matters, point at the commit that retired the harness |
| `optimizer_core.js:1448-1474` `startMonth`; `:1536-1562` `_stratImpliesConversion`; `:3759-3765` `unifiedConvRouting` | STALE identifier | named nowhere in code | rewrite the sentence around what exists |
| `optimizer_core.js:5720` "P49 primitive, kept for its tests" | STALE | `optimizer_ui.js:8635` calls `suggestSustainableSpend` | delete the clause |
| `optimizer_core.js:5821` "try ceiling (50% above baseline)" | STALE | `SPEND_SEARCH_CEILING = 1.50` (150%) | fix |
| `optimizer_core.tests.js:149-151` "Only three tests are tagged ... 1792 ms of this suite's ~2.9 s. The remaining 179 finish in well under a second" | STALE | 4 tagged, 486 tests, 16.7 s; five untagged tests take 0.6-2.3 s each | rewrite from a measurement. **Fixed** (says what the tag does, no measurement) |
| `optimizer_core.tests.js:7404-7411` `// ── Runner ──` ... "a tag must never be" [cut off] then `// -- Synthetic Monte Carlo` | BROKEN | orphaned header for a runner that lives at `:9037`, sentence truncated mid-way | delete the fragment |
| `optimizer_core.js:5646-5649` "Returns the highest-spend simulation result ..." | ORPHAN | describes `optimizeSpend` (`:5805`), sits above the Suggested-spend section header | move or delete |
| `optimizer_core.js:4414-4417` | BROKEN seam | "It used to read `X_i * rate_i * ...`, the first-order term ... / credited to Roth_i at the ROTH's rate" - a history sentence was inserted mid-sentence | delete the inserted sentence |
| `optimizer_core.js:4446-4449` | DUP | "The conversion's target month comes from the MODE when one is set ... / The conversion's month comes from the mode." says it twice | keep one |
| `montecarlo/mc_tab.js:128` "Returns true when NERD_KNOBS is active." | ORPHAN | followed by a different function's comment | delete |
| `montecarlo/mc_tab.js:1369-1372`, `:1632-1633`, `:1947-1949` | ORPHAN | three fused pairs where the first half describes a function that moved; `:1947` describes a legend the next comment says "has no legend any more" | delete the first half of each |
| `montecarlo/mc_tab.js:1351-1352`, `:2257-2258` "`stress` is msg.stress (null in Synthetic mode)" | STALE | `mc_engine.js:677-681`: "Stress runs in BOTH modes" | fix |
| `taxPaymentPlanner.js:647-652` | ORPHAN | describes `withholdingCoversSchedule` (`:699`) but sits over `scheduleSafeHarbor`, fused with a P59 block | move |
| `taxPaymentPlanner.js:95` "hysaGross ... (default 0.045)" | STALE | default is 0.038 (`:820`) | fix |
| `taxengine.js:108` `ANNUAL_INCREASE: 0.056, // based on analysis of` | BROKEN | truncated | finish or cite |
| `taxengine.js:1289` "(taxengine.js ~1135-1136)" | STALE cite | `nSeniors` is ~380 lines lower | name the function |
| `taxengine.js:1469` "`'no'` for no-tax states"; `:1471` "obbaOn (senior deduction + SALT cap)" vs `:1530`; `:1466` "taxExemptInterest ... affects SS/IRMAA/CA" (the CA branch at `:1577` does not read it) | STALE JSDoc | three parameter docs that do not match the body | fix |
| `taxengine.js:142-198` state summary "16 states + DC" with a 16-entry list that already includes DC | STALE | count | fix or derive the list from the table in a test |
| `optimizer_core.js:64-68` | DEAD code in comment | 2 commented-out lines | delete |
| `.githooks/md-html-scan.js:57-75` | code in comment | 5 lines of the measuring script, kept as provenance | fine, it is the recipe |
| `ARCHITECTURE.md:578, 618, 643, 666` "three node suites"; `:623` "513 tests"; `:642` "245 tests, ~55 ms, blocking at page load"; `:644` "3 slow tests"; `:673` "Ten exist today"; `:676` "three tagged" | STALE doc | five suites, 652 node tests + 595 in-page assertions (badge: "All 1247 tests passed", verified in a browser on `main`), 26 critical guards, 4 slow tags, tier 2 is `?runtests`-only since 11.17b0 | rewrite the tier table from `TestTiers.EXPECTED`. **Fixed** in the step-2 PR, with the `:682` line cites |
| `.planning/FILE_DIRECTORY.md:77, 80, 81, 83, 109` | STALE doc | `rmdbasis_harness.js`, `stopyear_harness.js`, `unifiedconv_harness.js`, `research/CONVERSION_ROUTING.md`, `research/RMD_BASIS.md`, `.planning/MERGE_PR182_IRMAA.md` do not exist | delete the rows |

### 3.3 The long blocks

273 comment blocks of 8 or more lines hold 4,259 lines in production code; 3,360 of those lines are in blocks that also carry a history marker. Appendix A lists every one of them with its markers and first line. Reading the largest ones (`optimizer_core.js:4400-4459`, `:3198-3230`, `:5019-5072`, `:2303-2371`, `:4788-4845`; `optimizer_ui.js:35-82`; `taxPaymentPlanner.js:1-105`; `rails_engine.js:1-75`) shows the same shape each time: two to four lines of constraint that must survive ("applied AFTER `applyGrowth`, because this shift IS growth, so adding it before would grow it twice"; "the conversion month is floored at the RMD's month in any year an RMD is distributed") wrapped in twenty to fifty lines of how it was found, what it measured, which phase, and which earlier version got it wrong.

Two worked examples of the target size:

`optimizer_core.js:4400-4459` (60 lines) becomes:

> Conversion month, separate from the withdrawal month. The converted dollars' growth is moved from the IRA to the Roth for the months between the two (`timingShift`), applied AFTER `applyGrowth` because the shift is growth. The amount itself is still decided at the withdrawal point, so balance-sized strategies (`fixedpct`, `fixed`, `bracket` at the IRA Target) are approximate here. In a year an RMD is distributed the conversion cannot precede it (the RMD is first money out and may not be converted), so the month is floored at the RMD's month. `timingConvThreshold` (research only, no UI) pulls the month to January when this year's conversion exceeds it; validated by shape, since 0 is a legal threshold.

`optimizer_core.js:3198-3230` (33 lines) becomes:

> `rothGapFill` moves Roth out of last place in the gap fill: unset = Cash, Brokerage, Roth; `'fillCashThenRoth'` = Cash, Roth, Brokerage; `'fillRothThenCash'` = Roth first. Named for where Roth is inserted, not as a letter code, because the non-bracket branch draws Brokerage and Cash proportionally and has no full order. Excluded for `ordered` (the user's sequence is the whole point). Validated against the two literals: an unknown value leaves the default alone. Measured both ways on the v11.162B engine, which is why it is a swept dimension and not a default (research/CONSTANT_SPLIT.md).

Section 6 turns this into a task with a budget.

### 3.4 What must survive a trim

The comments that stop a future mistake are short and specific, and they are the minority. Keep, in this form: the no-DOM / no-`localStorage` contract at the top of each engine file; `optimizer_core.js:4423-4424` (shift after growth); `:4436-4441` (RMD floor); `:3228-3230` (validate against literals); `:1029-1035` (why the ACA branch has no age test); `taxengine.js:1073-1076` (the FPL year lag, now with the right year); `taxengine.js:1650-1657` (three MAGIs, three statutes); `prng.js` on the separate inflation stream and "never skip a draw"; `mc_engine.js:677-681` (stress runs in both modes); `optimizer_core.tests.js:41-45` (the node-only stubs are load-bearing) and `:9044-9052` (why `performance.now` is stubbed, minus the line numbers); `optimizer_tests.js:11-38` (why mutating tests are opt-in).

The rule that produces that shape, stated once in `CLAUDE.md`: a comment says what the code does now and the one constraint that would break it; it names functions, never lines; what was measured, when, by whom and what it replaced goes in the commit message and in `research/`. Budget: `optimizer_core.js` from 3,435 comment lines to about 1,500; `optimizer_ui.js` from 2,752 to about 1,500; the Monte Carlo files by a third. About 4,000 lines in total, without losing a constraint, if the trim is done block by block against Appendix A.

---

## 4. Tests

### 4.0 What runs, where, and what gates a commit

| Suite | Tests | Wall time | Runs | Gate |
|---|---|---|---|---|
| `optimizer_core.tests.js` | 486 (4 tagged slow, 26 critical) | 16.7 s | node; browser only with `?runtests` | pre-commit hook |
| `taxengine.tests.js` | 32 | 13 ms | node; browser with `?runtests` | hook |
| `taxPaymentPlanner.tests.js` | 61 | 0.66 s | node; browser with `?runtests` | hook |
| `doclinks.tests.js` | 27 | 15 ms | node | hook |
| `feedback.tests.js` | 46 | 51 ms | node | hook |
| `optimizer_tests.js` (in-page) | 595 assertions at run time, from 455 `assertEqual` call sites in one 3,500-line `runTests()` | ~0.5 s | a browser, at idle, after the page has painted | **none** - the badge is repainted when someone opens the page; the hook never runs it |

Seven tests account for 13.6 of the 16.7 s: `P128n: every preset's rails ...` 5.0 s, `breakEvenHeirsRate: the predicate is monotonic` 2.6 s, `P129: the After-Tax Spend answer ...` 2.3 s, `P128: the rails solver solves the cadence ...` 1.4 s, `P132: on its own spine ...` 1.0 s, `P132: a job may bring its own presets` 0.7 s, `P128: a wealth rail under the search's floor` 0.6 s. Only three of those carry `test.slow`. The comment at `optimizer_core.tests.js:149-151` describing the tags ("1792 ms of ~2.9 s") is two releases stale.

Test counts are pinned in `TestTiers.EXPECTED` and `.githooks/README.md`, so adding or removing any test costs two edits in other files. That is deliberate (drift detection), and it is also why consolidation below is stated in numbers: every merge is a pin change.

### 4.0a The in-page suite

- **Lines 111-1324 (133 `assertEqual` sites, 1 touching the DOM) exercise engine functions only**: `combineGains` (:113-180, 8), part-year growth and `applyGrowth` (:182-311), `applyWithdrawals` (:321-411, 10), `calculateWithdrawals` (:423-686, 14, every expectation a literal object recorded from the code), `calculateAmortizedWithdrawal` (:713-724), `getRMDPercentage` (:735-738), `calculateInflationAdjustedWithdrawal` (:742-754), then the sections ACCOUNT GROWTH (:763), FIXED STRATEGY (:863), INFLATION SEQUENCE (:969), SPEND OPTIMIZER (:1015), BETR (:1104), extraConversionAmount (:1150), IRMAA MEDICARE AGE GATE (:1206), BROKERAGE GAP-FILL SPIRAL REGRESSION (:1255). None of these functions is tested anywhere the hook runs: `calculateWithdrawals` 0 references in the node suites, `applyWithdrawals` 0, `combineGains` 0, `calculateAmortizedWithdrawal` 0, `calculateInflationAdjustedWithdrawal` 0, `computeBETR` 0, `getRMDPercentage` 0. **MOVE** them into `optimizer_core.tests.js` as they are (the `assertEqual` helper is 15 lines); 4.6 below measures what the hook gains.
- The 14 `calculateWithdrawals` literal-object expectations are goldens in the sense the owner has already ruled out: a legitimate change to the draw re-baselines all 14 and the re-baselined numbers prove nothing. **REWRITE** as the four invariants they contain: the net delivered equals the request or the shortfall is reported; no account goes below zero; the order given is the order drawn; the weights are respected when balances allow.
- **Lines 1325-3550 (322 sites) read the live page**: gating of controls, the Limit menu and its ladder, share-link and saved-scenario round trips of every limit, column sets per objective, the rails panel, goal-first mode. This is the only automated coverage `optimizer_ui.js` (9,538 lines) and `mc_tab.js` (2,768 lines) have, and it never runs before a commit. Two honest options: run it headless in the hook (a stubbed-DOM runner built for this review passes 274 of its 303 top-level groups under plain node; a real headless browser would run all 595), or accept that the UI is gated by hand and say so in `ARCHITECTURE.md`, which today describes a tier that "injects after first paint" and no longer exists.
- The named groups from :1897 on (`niitDividerDoesNotInflateOnTheLadder`, `railsPanelIsGatedAndOwnsNoPlanInput`, ...) are immediately-invoked functions, so they do run; the pattern is fine and is the one to keep when the engine groups move out.

### 4.0b The other suites, read

- `taxengine.tests.js` is the model: expectations are hand-derived in comments (`TEST CASE 4` :339-372 works the bracket arithmetic out in prose) or written as the statute's own expression (`12 * 202.9`), so a change fails for a reason a reader can check. Gaps: `getIRMAATier`, `getQCDLimit`, `isQCDEligible` have no direct test in any suite; `calculateTaxableSocialSecurity` is named once (in the core suite); `nonSSIncomeForMAGI` twice. The Social Security taxation tiers (50% / 85%, the two thresholds, the MFJ/SGL difference) are exercised only through `calculateTaxes` - one direct table test would pin them.
- `doclinks.tests.js`: 462 lines for a 215-line file. Tests at :92-162 are thirteen one-line `maps()` / `unchanged()` calls - **MERGE** into one table-driven test (13 pins become 1). The four tests that read the page and the README (:286, :321, :360, :403) each guard a mistake that shipped (an invisible toggle, a doc link that navigated away, a dead anchor); **KEEP**, but they are page-structure tests and belong in a suite named for that, beside `feedback.tests.js:352-390`, which does the same for its button and its issue form.
- `optimizer_core.tests.js` has three tests that grep source text: `P81: no top-level name collides across the files the worker shares a scope with` (:5867), `P126: no code outside the load folds still names the retired strategy` (:8220), `the plan bank: every plan file can be loaded ALONGSIDE the others` (:9696). The first and third guard real load-time failures node cannot reproduce; **KEEP**. The second is a tombstone for a rename and can go with the fold.
- One test has no assertion of its own: `P128: a resumed run IS the plan continued - every field of every later row, exactly` (:8282) delegates to a helper; fine, but the inventory flags it because a helper that stops asserting would not show.
- `taxPaymentPlanner.tests.js` (61 tests, 0.66 s) is proportionate to its 3,206-line engine and asserts invariants (`Coverage invariant: totalCovered + shortfall === totalTaxDue`, :364). No change proposed beyond what 4.5 shows.
- `feedback.tests.js` drives the Worker's `handle()` end to end with stand-ins (origin, CORS, size, bot check, rate limit, daily limit, email shape). Proportionate; no change proposed.

### 4.0c How the mutation run reads

A mutant is one token changed in one production file, with every test re-run. "Killed" means at least one test failed or the suite crashed; "survived" means every test passed, so no test pins the behavior that token expresses. A survived mutant is not always a bug (`0.01` to `0.011` in a dollar epsilon changes nothing a test should care about), so the survivor lists in 4.5 are read by function, and the ones worth a test are the ones in money-moving code: sign flips, `<` vs `<=` at a threshold, a swapped `Math.min`, a deleted assignment. The zero-kill list in 4.2 is the direct answer to "which tests are dead weight": a test that failed on none of the thousands of single-token changes to the code it covers is not guarding that code. Each row carries the signals that usually explain it (reads source text; pins recorded literals; returns early outside node; never calls `simulate` or `calculateTaxes`).

### 4.1 Mutation scores by file

| File | Mutants | Killed | Survived | Crash/timeout | Score | Survival by operator (survived/total) |
|---|---|---|---|---|---|---|
| `optimizer_core.js` | 5011 | 2915 | 2078 | 18 | 59% | rel 252/337, num 1014/1605, bool 30/86, arith 364/1171, stmtdel 170/558, logic 121/414, minmax 59/205, eq 30/250, ifneg 38/385 |
| `taxengine.js` | 1358 | 636 | 720 | 2 | 47% | num 631/1007, arith 34/163, ifneg 5/39, rel 23/36, minmax 2/27, logic 11/25, stmtdel 1/24, eq 7/24, bool 6/13 |
| `taxPaymentPlanner.js` | 2112 | 911 | 1197 | 4 | 43% | num 404/561, arith 192/498, stmtdel 233/311, rel 146/169, logic 72/158, ifneg 50/156, eq 56/150, bool 37/71, minmax 7/38 |
| `montecarlo/mc_engine.js` | 485 | 186 | 299 | 0 | 38% | arith 84/134, num 97/119, stmtdel 25/65, ifneg 25/51, rel 40/48, eq 11/32, logic 10/22, bool 3/8, minmax 4/6 |
| `montecarlo/prng.js` | 343 | 231 | 108 | 4 | 67% | arith 31/127, num 40/92, stmtdel 7/40, rel 16/25, minmax 1/19, ifneg 4/17, logic 6/13, eq 3/10 |
| `montecarlo/stats.js` | 83 | 13 | 70 | 0 | 16% | num 28/30, arith 15/21, stmtdel 13/15, minmax 7/8, rel 4/4, ifneg 1/2, eq 1/2, logic 1/1 |
| `montecarlo/rails_engine.js` | 320 | 175 | 142 | 3 | 55% | num 44/80, arith 31/80, logic 14/33, eq 3/31, bool 21/29, rel 19/26, ifneg 5/24, stmtdel 4/12, minmax 1/5 |
| `feedback.js` | 458 | 133 | 325 | 0 | 29% | stmtdel 125/139, logic 49/79, num 52/77, ifneg 35/60, eq 24/48, bool 20/23, arith 10/21, rel 5/6, minmax 5/5 |
| `.feedback-worker/src/logic.cjs` | 332 | 258 | 72 | 2 | 78% | num 22/74, ifneg 1/59, logic 16/55, eq 2/50, stmtdel 6/36, arith 5/24, rel 16/18, bool 3/15, minmax 1/1 |
| `doclinks.js` | 93 | 45 | 48 | 0 | 48% | ifneg 10/22, eq 7/20, num 6/16, logic 6/13, stmtdel 12/13, arith 2/4, bool 3/3, rel 2/2 |
| `displayhelpers.js` | 152 | 69 | 83 | 0 | 45% | num 16/43, ifneg 18/29, stmtdel 18/22, eq 12/21, rel 7/14, logic 7/11, arith 0/7, bool 5/5 |

Operator keys: num = numeric literal changed; rel = `<`/`<=`/`>`/`>=` swapped; eq = `===`/`!==` flipped; logic = `&&`/`||` swapped; arith = `+`/`-`/`*`/`/` swapped; minmax = `Math.min`/`Math.max` swapped; bool = `true`/`false` flipped; ifneg = an `if` condition negated; stmtdel = one assignment or call statement deleted.

### 4.2 Tests that killed no mutant in any run

> **Corrected in the step-6 PR, and the table below is left as it was written so the correction is
> legible.** Two things make most of these rows wrong. First, only `optimizer_core.js` had been
> mutated; the other ten targets are measured now (4.1), and **60 of the 85 kill something once
> their own subject is mutated** - up to 74 prng mutants for one stress-bank test, 41 taxengine
> mutants for the SALT indexing test. Second, the run's own `skipTests` holds seven test names, and
> the sandbox patch removes a skipped name from the TESTS array entirely, so it can appear in
> neither `passed` nor `failed`. **All seven are in this table.** They killed nothing because they
> were switched off. See 4.7 for what that does to the nominations.


**optimizer_core.tests.js**: 486 tests, 85 killed nothing; 2915 mutants were killed by this suite, 401 tests took part, and a greedy cover of **185 tests** kills every one of them.

| Test | Line | Lines | Time (ms) | Signals |
|---|---|---|---|---|
| OPT_GOLDEN [default]: recording is internally consistent | ? | ? | 0 |  |
| OPT_GOLDEN [default]: clone rows carry the modifier their prefix claims | ? | ? | 0 |  |
| OPT_GOLDEN [nerdknob]: recording is internally consistent | ? | ? | 0 |  |
| OPT_GOLDEN [nerdknob]: clone rows carry the modifier their prefix claims | ? | ? | 0 |  |
| OPT_GOLDEN [nerdknobACA]: recording is internally consistent | ? | ? | 0 |  |
| OPT_GOLDEN [nerdknobACA]: clone rows carry the modifier their prefix claims | ? | ? | 0 |  |
| OPT_GOLDEN [nerdknobNoCashOffGrid]: recording is internally consistent | ? | ? | 0 |  |
| OPT_GOLDEN [nerdknobNoCashOffGrid]: clone rows carry the modifier their prefix claims | ? | ? | 0 |  |
| P35g: every TAXData jurisdiction declares a BasisStepUp of 0.50 or 1.00 | 1451 | 19 | 0 | no simulate/calculateTaxes |
| formatDollarShort: three significant figures, and the suffix follows the magnitude | 1722 | 13 | 10 | golden literals, no simulate/calculateTaxes |
| formatDollarShort: rounding up carries into the next unit instead of reading 1000k | 1736 | 8 | 0 | golden literals, no simulate/calculateTaxes |
| formatDollarShort is NOT compactNum: it never emits scientific notation | 1745 | 9 | 0 | no simulate/calculateTaxes |
| formatDollarShort: a non-number is empty, not "$NaN" | 1755 | 5 | 0 | no simulate/calculateTaxes |
| loadFromURL decode: compact dollar values set dataset.numVal (not NaN) | 1813 | 17 | 0 | no simulate/calculateTaxes |
| loadFromURL decode: non-dollar fields (select, number) pass through unchanged | 1831 | 11 | 0 | no simulate/calculateTaxes |
| stress scoring: Fisher equation gives correct real CAGR | 1852 | 7 | 0 | no simulate/calculateTaxes |
| stress scoring: deflation clamped to -0.5% floor | 1860 | 8 | 0 | no simulate/calculateTaxes |
| stress scoring: stagflation decade ranks worse than mild equity bear | 1869 | 8 | 0 | no simulate/calculateTaxes |
| stress scoring: 1999 ranks worse than 1929 by real CAGR | 1878 | 8 | 0 | no simulate/calculateTaxes |
| stress bank: default 10yr window picks the documented worst starts | 1909 | 8 | 1 | no simulate/calculateTaxes |
| stress bank: a longer window selects a different set of start years | 1918 | 7 | 0 | no simulate/calculateTaxes |
| stress bank: window is clamped to the plan horizon | 1926 | 6 | 0 | no simulate/calculateTaxes |
| stress bank: the tail is real history wrapping to 1928, not a random draw | 1933 | 16 | 0 | no simulate/calculateTaxes |
| stress bank: identical arguments give identical banks (no RNG involved) | 1950 | 8 | 0 | no simulate/calculateTaxes |
| stress bank: reports bond and intl CAGR over the whole plan, not the ranking window | 1959 | 28 | 0 | no simulate/calculateTaxes |
| stress bank: worst rolling real CAGR scans the whole horizon, not just the opening | 1988 | 31 | 0 | no simulate/calculateTaxes |
| stress bank: 'combined' is the union of every window's worst, deduped | 2020 | 31 | 1 | no simulate/calculateTaxes |
| scoreStartYears memoizes without letting a caller corrupt the shared ranking | 2052 | 27 | 1 | no simulate/calculateTaxes |
| bear pool draws from three opening lengths, each spliced for its own window | 2080 | 29 | 0 | no simulate/calculateTaxes |
| bear-start overlay splices only its own opening length, and never past the plan | 2110 | 24 | 0 | no simulate/calculateTaxes |
| bear-start overlay does not read the Stress Test sequence count | 2135 | 24 | 2 | no simulate/calculateTaxes |
| stress bank: 'all' runs every start year and marks where the record runs out | 2160 | 19 | 0 | no simulate/calculateTaxes |
| stress bank: a count above the candidate pool caps instead of throwing | 2180 | 20 | 2 | no simulate/calculateTaxes |
| stress bank: a junk count falls back to the default rather than an empty bank | 2201 | 9 | 0 | no simulate/calculateTaxes |
| stressOutcomeBand: the line is half the PLAN, and exactly half counts as late | 2211 | 19 | 0 | no simulate/calculateTaxes |
| P87c: nonSSIncomeForMAGI inverts the MAGI relation it claims to invert | 2330 | 17 | 0 | no simulate/calculateTaxes |
| P38: sizing by a flat nominal rate would badly over-draw an SS-heavy household | 3288 | 17 | 0 |  |
| P64d: the SALT cap and its phase-out threshold are indexed 1%/yr from their 2025 base | 3415 | 23 | 0 |  |
| IL exempts IRA/pension distributions from state tax | 3597 | 8 | 0 | CRITICAL, CRITICAL |
| PA exempts IRA/pension distributions from state tax | 3606 | 8 | 0 | CRITICAL, CRITICAL |
| pensionAtAge helper gates the pension at the start age | 3650 | 9 | 0 | no simulate/calculateTaxes |
| IL still taxes non-retirement income (interest/dividends not exempt) | 3673 | 7 | 0 | CRITICAL, CRITICAL |
| regression: exclusion params are inert for a non-exclusion state (CA) | 3681 | 7 | 0 | CRITICAL, CRITICAL |
| ELIGIBILITY_AGE: the constant exists and ships at 65 | 5302 | 8 | 0 | no simulate/calculateTaxes |
| ELIGIBILITY_AGE: the harness restores the constant | 5503 | 6 | 0 | no simulate/calculateTaxes |
| tax creep: calculateTaxes scales the right walk and nothing else | 5547 | 16 | 0 |  |
| P81: no top-level name collides across the files the worker shares a scope with | 5867 | 25 | 4 | reads source, early return, no simulate/calculateTaxes |
| breakEvenHeirsRate: the predicate is monotonic in the rate (binary search precondition) | 6150 | 13 | 2624 | SLOW, no simulate/calculateTaxes |
| OPT_GOLDEN: the four gates are actually exercised by the captured scenarios | 6865 | 36 | 0 | no simulate/calculateTaxes |
| OPT_GOLDEN: the Optimizer sweeps the two families MC does not, on its own IRA Draw grid | 7055 | 17 | 0 | no simulate/calculateTaxes |
| findUpperLimitByAmount: a single-row table means NO upper limit, not a zero one | 7335 | 6 | 0 | no simulate/calculateTaxes |
| findUpperLimitByAmount: below the first bracket returns the top of that band | 7342 | 11 | 0 | no simulate/calculateTaxes |
| findUpperLimitByAmount: an amount inside the ladder is untouched | 7354 | 8 | 0 | no simulate/calculateTaxes |
| single-row bracket tables: the affected jurisdictions are pinned | 7363 | 9 | 0 | no simulate/calculateTaxes |
| P23: GBM return draws are untouched by the inflation model | 7465 | 15 | 1 | no simulate/calculateTaxes |
| P23: a zero inflation shock leaves inflation flat at the target | 7481 | 7 | 0 | no simulate/calculateTaxes |
| P23: AR(1) inflation reverts toward the target | 7489 | 13 | 0 | no simulate/calculateTaxes |
| P23: inflation cannot fall below INFLATION_FLOOR | 7503 | 4 | 0 | no simulate/calculateTaxes |
| P23: RETURN_FLOOR clamps the arithmetic tail short of -100% | 7508 | 13 | 7 | no simulate/calculateTaxes |
| P23: AAM centers the yearly return distribution on the number typed | 7522 | 13 | 18 | no simulate/calculateTaxes |
| P23: AAM with zero volatility is a deterministic run at mu | 7536 | 6 | 0 | no simulate/calculateTaxes |
| P23: the inflation shock realizes the requested correlation with the return draw | 7543 | 15 | 20 | no simulate/calculateTaxes |
| P23: the shipped AR(1) constants still match a re-fit of the CPI record | 7559 | 26 | 0 | no simulate/calculateTaxes |
| P23: Fixed Inflation reproduces the pre-change Synthetic model exactly | 7586 | 18 | 0 | no simulate/calculateTaxes |
| P23: simulated inflation reaches the persistence the record shows | 7605 | 23 | 2 | no simulate/calculateTaxes |
| P69: capture selector ranks ruined-earliest first, then survivors by wealth | 7724 | 24 | 0 | no simulate/calculateTaxes |
| P69: capture selector on an all-survivor run and a tiny run | 7749 | 16 | 0 | no simulate/calculateTaxes |
| P80: every sampled year is labelled with the year that actually produced it | 7932 | 46 | 1 | no simulate/calculateTaxes |
| P126: no code outside the load folds still names the retired strategy | 8220 | 17 | 14 | reads source, early return, no simulate/calculateTaxes |
| P128: the rails solver solves the cadence it was given, every preset at once, and prices itself | 8349 | 59 | 1428 |  |
| P128n: the count a q answer demands is the Monte Carlo tab's own comparison | 8409 | 13 | 0 | no simulate/calculateTaxes |
| P128n: every preset's rails, targets and rail spends match a direct search on the same paths | 8425 | 53 | 5020 | SLOW |
| P132: a job may bring its own presets, and solves the cut-side spend at each set's cutTo | 8479 | 17 | 681 | no simulate/calculateTaxes |
| P132: the rule table is the job in ratios - both sides at a solved year, interpolated between,  | 8497 | 69 | 1 | no simulate/calculateTaxes |
| P132: between solves the table interpolates DOLLARS and nets each year's own guaranteed income, | 8579 | 29 | 0 | no simulate/calculateTaxes |
| P132: the rails the rule read along a path are its table in that path's dollars, laid out like  | 8646 | 28 | 0 | no simulate/calculateTaxes |
| P132: on its own spine, the rule fires at the first solved year exactly when the chance is outs | 8745 | 28 | 1027 |  |
| P129: the After-Tax Spend answer meets its target, a little more does not, and it ignores the g | 8804 | 29 | 2257 |  |
| P128n: a clamped answer ends its line, and says so on its row | 8834 | 21 | 1 | no simulate/calculateTaxes |
| P128: each solve lands on two rows, and the years between solves are interpolated in today's do | 8879 | 32 | 1 | no simulate/calculateTaxes |
| P128: a wealth rail under the search's floor is $0, drawn, and its spending left unsolved | 8916 | 22 | 604 |  |
| P128: the plan's last year is always solved, whatever the cadence | 8942 | 17 | 0 | no simulate/calculateTaxes |
| P129: the first year's target spend is the After-Tax Spend answer, and nothing else lands there | 8962 | 21 | 0 | no simulate/calculateTaxes |
| the plan bank: every plan file can be loaded ALONGSIDE the others in a page | 9696 | 20 | 1 | reads source, early return, no simulate/calculateTaxes |
| the plan bank: the card fields a chooser relies on are all present and honest | 9717 | 24 | 0 | early return, no simulate/calculateTaxes |

**taxengine.tests.js**: its target was not mutated in this pass.


**taxPaymentPlanner.tests.js**: its target was not mutated in this pass.


**feedback.tests.js**: its target was not mutated in this pass.


**doclinks.tests.js**: its target was not mutated in this pass.


### 4.3 Tests whose every kill is also caught by the cover set


**optimizer_core.tests.js**: 216 tests kill mutants but add no kill beyond the 185-test cover (candidates to MERGE, not to drop blindly: the cover is one of many minimal sets). Unique kills (a mutant no other test caught) are the number to respect.

| Test | Kills | Unique kills | Line |
|---|---|---|---|
| compactNum: round-trips losslessly through parseShorthand | 3 | 0 | 1766 |
| OPT_OBJECTIVE_COLUMNS covers exactly the objectives that exist | 3 | 0 | 5168 |
| every objective's column list names only real columns, with no duplicates | 3 | 0 | 5177 |
| compare is first in every objective, and every pinned column is present | 3 | 0 | 5186 |
| every objective shows the column its own ranking metric reads | 3 | 0 | 5202 |
| every objective has a blurb, and it names the column that objective ranks on | 3 | 0 | 5213 |
| OPT_DELTA_COLUMNS names only real columns, with a usable direction and unit | 3 | 0 | 5235 |
| the goals needing a converting baseline are exactly the ones ranking on a conversion field | 3 | 0 | 5251 |
| breakEvenHeirsRate: no IRA means no threshold | 3 | 0 | 6123 |
| bestTimeLimitedConversion: no IRA means nothing to find | 3 | 0 | 6236 |
| earliestbe shows the balances its ties are decided on | 3 | 0 | 7089 |
| P71: stress mode banks one path per scenario, not numPaths of them | 3 | 0 | 7685 |
| P69: sliced bank rows rebuild the exact per-path inputs, every mode | 3 | 0 | 7786 |
| schedule: refuses to compose with cyclicEnabled | 3 | 0 | 9027 |
| plan scope: compare really is the expensive one — the sweep is far more than one arm | 4 | 0 | 6684 |
| Compare All runs exactly the Optimizer's rows, not more, not fewer | 4 | 0 | 6765 |
| compactNum: never longer than the raw value | 5 | 0 | 1773 |
| rankRowsByObjective: Tax Flexibility cutoff handles negative after-tax NW | 5 | 0 | 5152 |
| P71: the engine runs a whole job end to end in all three modes | 5 | 0 | 7646 |
| P69: every variation of a real run carries its capture rows | 5 | 0 | 7766 |
| P80: recording the source years changes no draw and no number | 5 | 0 | 7979 |
| P71: a cancelled job reports nothing at all | 5 | 0 | 8008 |
| baseline metric: higher after-tax NW ranks a richer terminal portfolio higher | 6 | 0 | 1586 |
| rankRowsByObjective: networth desc, mintax asc | 6 | 0 | 5121 |
| P104b1: splitWeights is a selection field, survives selectionOf, and split is 🅡-excluded | 6 | 0 | 6276 |
| P89: the ACA age gate reads the clamped year, not the typed age | 6 | 0 | 7014 |
| plan scope: a plan absent from the sweep yields no match, so the caller must substitute | 7 | 0 | 6676 |
| P89: planFirstYear clamps a start year that has already passed | 7 | 0 | 7007 |
| FRA: a 1960-or-later couple is completely unaffected | 7 | 0 | 7305 |
| getLTCGBracketRoom: returns 0% bracket room for MFJ below ceiling | 8 | 0 | 220 |
| P51b: oracleWithdrawalPlan + cyclicEnabled is an explicit error, not a precedence rule | 8 | 0 | 573 |
| ORDERED_SEQS: every offered sequence is a real permutation and both sweeps use the list | 8 | 0 | 6564 |
| afterTaxNetWorth: zero gains and zero rates → plain sum of balances | 9 | 0 | 1360 |
| P100b3: the DEFAULT chain leads on net wealth | 9 | 0 | 5071 |
| buildStrategyFamilies: the 🅡 pass clones every family except Ordered | 9 | 0 | 6620 |
| P126: a Monte Carlo job refuses a retired strategy instead of scoring it as ruin | 9 | 0 | 8208 |
| timingShift: reverses sign when the move is later in the year, and is zero at no move | 10 | 0 | 4729 |
| selectConversionCandidates: REGRESSION — a flat top-N would drop the family that benefits | 10 | 0 | 4868 |
| taxCreepFactor: off, before start, and compounding | 10 | 0 | 5529 |
| P104b3: the shipped split grid is four blends, and no single-account vector | 10 | 0 | 6496 |
| P100b3: rows tied on the objective are ordered by the secondary chain, not array order | 11 | 0 | 5033 |
| selectConversionCandidates: bracket-rate and bracket-IRMAA are distinct families | 12 | 0 | 4888 |
| QCD As Needed: MAGI between today's floor and the projected floor needs no QCD | 12 | 0 | 5474 |
| P104b3: the family is OFF by default, in both sweeps | 12 | 0 | 6526 |
| P100b3: conveffect OVERRIDES the default and leads on final Roth | 13 | 0 | 5084 |
| afterTaxBucketSpread: Infinity when nothing is left, and taxflex ranks on this same number | 15 | 0 | 5277 |
| afterTaxNetWorth: Roth/Cash/basis at face; brokerage gains × (1−capG); IRA × (1−futureRate) | 16 | 0 | 1349 |
| P70i: pensionColaCap reads every shape the input can arrive in | 17 | 0 | 6047 |
| compare pin: a selection captured from one sweep re-finds its row in the next | 20 | 0 | 7250 |
| sameStrategySelection: finds Guardrails and Ordered users in buildVariations output (the MC reg | 22 | 0 | 6641 |
| the worker payload keeps each variation identifiable as a strategy | 25 | 0 | 7699 |
| offGridParamFor: buildVariations gains exactly one non-cyclic row for an off-grid user | 32 | 0 | 6705 |
| plan scope: the sidebar plan resolves to exactly one swept variation | 44 | 0 | 6660 |
| buildVariations golden [guardrailsSpouse]: row inventory and order unchanged | 45 | 0 | ? |
| FRA: the old hard-coded 67 over-stated an early-claiming pre-1955 decedent | 45 | 0 | 7292 |
| buildVariations golden [offGridDraw]: row inventory and order unchanged | 46 | 0 | ? |
| buildVariations golden [onGridCash]: row inventory and order unchanged | 52 | 0 | ? |
| buildVariations golden [offGridBracket]: row inventory and order unchanged | 55 | 0 | ? |
| Medicare premiums: the default mode is inert, and names today behavior | 57 | 0 | 4646 |
| OC: counterfactual recursion guard — _cfRun never spawns another counterfactual | 58 | 0 | 3902 |
| ... 156 more | | | |

### 4.4 The tests that do the work


**optimizer_core.tests.js** greedy cover, in order (test: mutants newly covered):

- the plan bank: every card's measured viability still reproduces (1138)
- P132: the rule, its table and its state survive a resume, and the table is not part of the plan's id (99)
- buildStrategyFamilies reproduces the Optimizer capture [nerdknobNoCashOffGrid] (88)
- lowestBreakEvenHeirsRate: finds a threshold the best-scoring candidate does not have (79)
- schedule: replays an ACA plan ACROSS its lapse (67)
- GK optimize-spend: the stability floor rejects a run the rule slashed, and on the plan's own assumpt (63)
- diagnoseConvBreakEvenFailure: boundary — pinpoints the specific conversion year that breaks a sustai (57)
- FRA: end to end, a pre-1955 couple pays a smaller survivor benefit (52)
- P84b: every scope charges the right basis and pays from the right accounts (51)
- accounting: withdrawal columns include conversions, decompose correctly, and reconcile the IRA balan (46)
- P104b1: replay identity - split with V equals propwd 0 + oracleWithdrawalPlan.fill(V), to the dollar (46)
- P104b3: a gated-off family cannot leak back in through the user's own off-grid mix (31)
- avgWdRate: simple mean of the yearly rates, including year 0 (30)
- irmaaMarginMode: every shipped mode is distinct and correctly ordered (30)
- suggestSpendMenu Middle ends holding about half the real starting portfolio (26)
- P132: vsPlan% is the rule's spending against the plan's shape (25)
- compactNum: expected compact forms (24)
- P32c: cycleCoexist bracketfill — harvest years regain the IRA draw and conversions (21)
- sameStrategySelection: matches each family on its own parameter (21)
- bestTimeLimitedConversion: finds a convert-then-stop plan and reports it in calendar years (20)
- P113: summarizeRun snapshots a run, and diffSummaries reports only what moved (20)
- P70i: a capped pension COLA pays the lesser of its cap and CPI, year by year (20)
- P86c: lifetime RMD and QCD carry Current-$ twins built the tax/spend way (18)
- P108b: december tax settlement is opt-in, raises wealth, and leaves spending untouched (18)
- offGridParamFor: returns the user parameter only when it is off the grid (18)
- ... 160 more

### 4.5 Where the survivors are (behavior no test pins)


**optimizer_core.js** - 2078 survivors in 122 functions, 812 of them high-signal (a deleted statement, a flipped sign, comparison, condition or boolean, a swapped min/max; numeric nudges and off-by-one relational swaps excluded). Top 20 functions by high-signal count:

| Function | High-signal / all survivors / mutants | High-signal examples (line: mutation; source) |
|---|---|---|
| `resolveResidualAndForcedIRA` | 49 / 138 / 266 | 3434: stmtdel; `yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, rothFirs` / 3435: stmtdel; `applyWithdrawals(yr.curBalances, rothFirst3);` / 3436: stmtdel; `_thirdGap = rothFirst3.shortfall ?? 0;` |
| `planPrimaryWithdrawals` | 47 / 87 / 234 | 2678: stmtdel; `yr.isBrokerageYear = false;` / 2679: stmtdel; `yr.subCycleLabel = null;` / 2885: arith:/→*; `const _gross1 = _net1 / Math.max(0.01, 1 - yr.capGainsPercentage * sim` |
| `simulate` | 45 / 103 / 234 | 4972: arith:+=→-=; `simulationCount += 1;` / 4972: stmtdel; `simulationCount += 1;` / 4988: minmax:max; `const gapYears = Math.max(0, currentYear - new Date().getFullYear());` |
| `attributeIncrementalTaxes` | 31 / 56 / 56 | 4262: stmtdel; `yr.incrementalConvTax = 0;` / 4263: ifneg; `if (yr.totalConverted > 0) {` / 4264: arith:+→-; `const baseEI = yr.pension + yr.taxableRMD + yr.taxableInterest;` |
| `resolveHousehold` | 29 / 45 / 113 | 1610: bool:false; `if (!yr.alive1 && !yr.alive2) return false;` / 1645: eq:===→!==; `yr.isLastMFJYear = yr.status === 'MFJ'` / 1646: logic:&&→\|\|; `&& (yr.age1 === inputs.die1 \|\| (birthyear2 > 0 && yr.age2 === inputs.d` |
| `solveMaxSpend` | 27 / 52 / 74 | 5685: logic:\|\|→&&; `const strategy   = (opts && opts.strategy) \|\| baseInputs.strategy;` / 5687: bool:false; `const run = (spend) => simulate(Object.assign({}, baseInputs, { strate` / 5690: logic:\|\|→&&; `const probe = run(baseInputs.spendGoal \|\| 0);` |
| `calculateWithdrawals` | 26 / 73 / 173 | 447: stmtdel; `gapAmount == null \|\| (gapAmount <= 0) && errors.push("gapAmount is nul` / 447: logic:\|\|→&&; `gapAmount == null \|\| (gapAmount <= 0) && errors.push("gapAmount is nul` / 447: eq:==→!=; `gapAmount == null \|\| (gapAmount <= 0) && errors.push("gapAmount is nul` |
| `evaluateYearOutcome` | 25 / 56 / 88 | 4636: ifneg; `if (yr.ySeq === 0) totals.futureIRARate = _taxFuture;` / 4632: arith:+→-; `const _taxFuture = inputs.futureIRATaxRate ?? (yr.marginalFedTaxRate +` / 4636: eq:===→!==; `if (yr.ySeq === 0) totals.futureIRARate = _taxFuture;` |
| `resolveSpendTarget` | 24 / 71 / 241 | 1994: eq:!==→===; `: (inputs.scheduleFallback ?? 'none') !== 'baseline';` / 2074: stmtdel; `sim.gkIWR = sim.spendGoal / sim.prevPortfolio;` / 2074: arith:/→*; `sim.gkIWR = sim.spendGoal / sim.prevPortfolio;` |
| `growAndSettle` | 23 / 93 / 244 | 4323: stmtdel; `balance.Roth2 += yr.surplus.Roth2;` / 4368: stmtdel; `inspectForErrors(yr.growthRates, balance, yr.gains);` / 4375: logic:&&→\|\|; `if (_incomeTax > 0 && _drawn > 0) {` |
| `computeAnnualQCDs` | 23 / 48 / 63 | 279: logic:&&→\|\|; `const elig1 = alive1 && isQCDEligible(inputs.birthyear1, inputs.birthm` / 280: logic:&&→\|\|; `const elig2 = alive2 && isQCDEligible(inputs.birthyear2, inputs.birthm` / 287: ifneg; `if (inputs.qcdMode === 'asneeded') {` |
| `computeBracketCeiling` | 23 / 27 / 68 | 998: stmtdel; `kind = 'irmaa';` / 1010: bool:false; `inputs.medicareEnroll1 !== false,` / 1011: eq:!==→===; `inputs.medicareEnroll2 !== false)) - 1;` |
| `bestTimeLimitedConversion` | 22 / 62 / 77 | 6568: arith:+→-; `const totalIRA = (baseInputs.IRA1 \|\| 0) + (baseInputs.IRA2 \|\| 0);` / 6568: logic:\|\|→&&; `const totalIRA = (baseInputs.IRA1 \|\| 0) + (baseInputs.IRA2 \|\| 0);` / 6608: arith:/→*; `const FRACTIONS = [1/16, 1/8, 3/16, 1/4, 3/8, 1/2, 3/4, 1];` |
| `buildSimYearLogRecord` | 21 / 58 / 114 | 1194: arith:+→-; `'cashD+I': p.taxableDividends + p.taxableInterest,` / 1209: arith:+→-; `'-iraConvGrossTot': (p.iraConvGross1 \|\| 0) + (p.iraConvGross2 \|\| 0),` / 1209: logic:\|\|→&&; `'-iraConvGrossTot': (p.iraConvGross1 \|\| 0) + (p.iraConvGross2 \|\| 0),` |
| `fillSpendingGap` | 21 / 53 / 120 | 3193: arith:+→-; `+ (yr.netWithdrawals.Cash ?? 0) + (yr.netWithdrawals.Roth ?? 0);` / 3196: stmtdel; `inspectForErrors({ netSpendable: netSpendable, gap: gap, totalTax: yr.` / 3241: eq:===→!==; `if (_rothPos === 'fillCashThenRoth') gap = _preDraw('Cash', gap);` |
| `suggestSustainableSpend` | 21 / 42 / 51 | 5729: arith:-→+; `const need = Math.max(0, (last.spendGoal \|\| 0) - (last.guaranteedIncom` / 5729: logic:\|\|→&&; `const need = Math.max(0, (last.spendGoal \|\| 0) - (last.guaranteedIncom` / 5734: logic:\|\|→&&; `const invested = (baseInputs.IRA1 \|\| 0) + (baseInputs.IRA2 \|\| 0) + (ba` |
| `computeIncome` | 20 / 50 / 211 | 1743: arith:+=→-=; `if (!yr.alive2 && balance.IRA2 > 0) { balance.IRA1 += balance.IRA2; ba` / 1777: stmtdel; `yr.pension = yr.pension * (inputs.survivorPct / 100);` / 1777: arith:/→*; `yr.pension = yr.pension * (inputs.survivorPct / 100);` |
| `applyAdvisorFee` | 20 / 47 / 93 | 4121: minmax:max; `const before1 = Math.max(0, balance.IRA1 \|\| 0), before2 = Math.max(0, ` / 4121: logic:\|\|→&&; `const before1 = Math.max(0, balance.IRA1 \|\| 0), before2 = Math.max(0, ` / 4125: minmax:max; `const sp = splitPreferLarger(want, Math.max(0, balance.IRA1), Math.max` |
| `cfRefundIRA` | 20 / 45 / 83 | 3839: arith:+→-; `const _cap = Math.max(0, (yr.netWithdrawals.IRA1 ?? 0) + (yr.netWithdr` / 3840: arith:-→+; `- (yr.surplus.Roth1 ?? 0) - (yr.surplus.Roth2 ?? 0));` / 3840: arith:-→+; `- (yr.surplus.Roth1 ?? 0) - (yr.surplus.Roth2 ?? 0));` |
| `applyConversionGrossUp` | 15 / 46 / 101 | 4177: stmtdel; `yr.grossUpIRA = 0;` / 4178: stmtdel; `yr.grossUpTax = 0;` / 4187: arith:+→-; `pensionIncome: yr.pension, iraIncome: yr.taxableRMD + shadowIRA,` |

### 4.6 The in-page suite, measured the same way


**optimizer_core.js** against the 274 in-page assertions that pass under a stubbed DOM: 5011 mutants, 522 killed, 4478 survived; **80** of the kills are mutants the node suite let live, i.e. what the pre-commit hook gains if those assertions move to node.

Assertions with the most kills: IRMAA gate: both-spouse surcharge ≈ 2× single-spouse (after  (194); IRMAA gate: surcharge present at 65 (one spouse on Medicare) (187); IRMAA gate: surcharge present at 67 (both spouses on Medicar (183); extraConversionAmount=0: finalNW identical to no-param basel (180); extraConversionAmount=0: totals.tax identical to no-param ba (177); extraConversionAmount array: year 0 Roth higher with 30k ext (176); Cyclic + reduce: no final-year conversion balloon (max < 4x  (175); BETR% appears in log for years with conversions (175); totals.betrAvg is set when conversions occur (175); extraConversionAmount=50k: Roth balance higher than no-extra (175); optimizeSpendDown: returns null when even MIN_SPEND fails (175); optimizeSpend: returns null when baseline fails the wealth c (173).

Mutants only the in-page suite caught (first 25):

| Line | Function | Mutation | Source |
|---|---|---|---|
| 447 | `calculateWithdrawals` | eq:==→!= | `gapAmount == null \|\| (gapAmount <= 0) && errors.push("gapAmount is null or <= 0"` |
| 447 | `calculateWithdrawals` | stmtdel | `gapAmount == null \|\| (gapAmount <= 0) && errors.push("gapAmount is null or <= 0"` |
| 441 | `calculateWithdrawals` | num:0→1 | `shortfall: 0` |
| 440 | `calculateWithdrawals` | num:0→1 | `netAmount: 0,` |
| 447 | `calculateWithdrawals` | logic:\|\|→&& | `gapAmount == null \|\| (gapAmount <= 0) && errors.push("gapAmount is null or <= 0"` |
| 447 | `calculateWithdrawals` | rel:<=→< | `gapAmount == null \|\| (gapAmount <= 0) && errors.push("gapAmount is null or <= 0"` |
| 449 | `calculateWithdrawals` | num:0→1 | `(balances == null \|\| Object.keys(balances).length === 0) && errors.push("balance` |
| 449 | `calculateWithdrawals` | logic:\|\|→&& | `(balances == null \|\| Object.keys(balances).length === 0) && errors.push("balance` |
| 448 | `calculateWithdrawals` | num:0→1 | `(withdrawStrategy == null \|\| Object.keys(withdrawStrategy).length === 0) && erro` |
| 450 | `calculateWithdrawals` | logic:\|\|→&& | `(withdrawStrategy?.order == null \|\| Object.keys(withdrawStrategy.order).length =` |
| 453 | `calculateWithdrawals` | stmtdel | `result.errors = errors;` |
| 452 | `calculateWithdrawals` | num:0→1 | `if (errors.length > 0) {` |
| 472 | `calculateWithdrawals` | num:0→1 | `const sum = orderBalances.reduce((a, b) => a + b, 0);` |
| 511 | `performWithdrawal` | num:0→1 | `const taxRate = taxrates[accountIndex] ?? 0;` |
| 547 | `calculateWithdrawals` | num:0→1 | `for (let i = 0; i < order.length; i++) {` |
| 583 | `calculateWithdrawals` | num:0→1 | `const taxRate = taxrates[i] ?? 0;` |
| 584 | `calculateWithdrawals` | arith:/→* | `const grossTarget = netTarget / (1 - taxRate);` |
| 585 | `calculateWithdrawals` | arith:/→* | `const grossNeeded = netRemaining / (1 - taxRate);` |
| 584 | `calculateWithdrawals` | arith:-→+ | `const grossTarget = netTarget / (1 - taxRate);` |
| 585 | `calculateWithdrawals` | num:1→0 | `const grossNeeded = netRemaining / (1 - taxRate);` |
| 585 | `calculateWithdrawals` | arith:-→+ | `const grossNeeded = netRemaining / (1 - taxRate);` |
| 602 | `calculateWithdrawals` | num:0→1 | `const alreadyWithdrawn = result[account] ?? 0;` |
| 632 | `calculateWithdrawals` | num:1→0 | `const grossNeeded = netRemaining / (1 - taxRate);` |
| 632 | `calculateWithdrawals` | arith:/→* | `const grossNeeded = netRemaining / (1 - taxRate);` |
| 632 | `calculateWithdrawals` | arith:-→+ | `const grossNeeded = netRemaining / (1 - taxRate);` |

### 4.7 Reading 4.2 honestly: which of the 85 are dead weight

> **Three of the four DROP nominations below did not survive the step-6 PR.**
> - `breakEvenHeirsRate: the predicate is monotonic` was nominated because it "failed on none of the
>   5,011 mutants". It was in that run's `skipTests`, so it ran on none of them. Re-run with nothing
>   skipped over all 53 mutants in the predicate and its search, it kills one, which a sibling also
>   kills - so the numbers do not defend it either. But mutation cannot express what it guards: no
>   single-token change makes the predicate non-monotonic without breaking a sibling, while a
>   rewrite of the scoring could, and the siblings would not notice. KEPT, and made to sample the
>   predicate directly instead of inferring it through a whole binary search per rate - the property
>   its name claims, without the 2.6 s or the `test.slow`.
> - `P126` is a tombstone "that can go with the fold". The folds have not gone: `GK-FOLD-BEGIN` is
>   still in `optimizer_ui.js` twice and in `optimizer_tests.js`. KEPT until they do.
> - `ELIGIBILITY_AGE: the harness restores the constant` is called a test of the test file. Its
>   subject is live: `withEligibilityAge` writes `TAXData.IRMAA.ELIGIBILITY_AGE` and restores it in a
>   `finally`, and a leak would change every later scenario rather than fail anywhere. KEPT, 0 ms.
>   Its sibling `the constant exists and ships at 65` kills 4 taxengine mutants.
>
> The MERGE proposals held and are done: the ten OPT_GOLDEN fixture tests are one, and doclinks is
> 27 pins to 15. **Section 4.8 also asks for one test that cannot be written:** `resolveHousehold`'s
> `if (!yr.alive1 && !yr.alive2) return false` cannot run, because the horizon is
> `max(birthyear1 + die1, birthyear2 + die2)` and `alive` is `age <= die`, so both spouses are alive
> through the last year of it. Flipped to `return true`, all 525 tests still pass. What replaced it
> pins the horizon itself, and records why the guard is unkillable.

Only `optimizer_core.js` was mutated in full. A test whose subject is another file killed nothing here for the wrong reason, and the secondary targets were skipped to keep this review to one day (the configs are ready; each is 2-10 minutes of local CPU). Splitting the 85:

- **Subject is another file, not measured - 65 tests, not nominated.** `prng.js`: the 20 stress-bank, stress-scoring, bear-overlay and `scoreStartYears` tests (:1852-2211) and the 12 `P23` tests (:7465-7605). `mc_engine.js`: `P69` x2, `P80` (:7724-7932). `rails_engine.js`: the 13 `P128` / `P128n` / `P129` / `P132` tests (:8349-8962) - which are also 11 of the suite's 16.7 seconds. `taxengine.js`: the IL / PA / CA critical guards (:3597-3681), `P64d` SALT indexing (:3415), tax creep (:5547), `P87c nonSSIncomeForMAGI` (:2330), `findUpperLimitByAmount` x3 and the single-row tables (:7335-7363), `P35g BasisStepUp` (:1451). `displayhelpers.js`: `formatDollarShort` x4 (:1722-1755), `loadFromURL decode` x2 (:1813, :1831), `pensionAtAge` (:3650).
- **Measured against their subject and killed nothing - nominated:**
  - `OPT_GOLDEN [...]: recording is internally consistent` and `clone rows carry the modifier their prefix claims` (8 tests, generated in a loop), plus `OPT_GOLDEN: the four gates are actually exercised` (:6865) and `the Optimizer sweeps the two families MC does not` (:7055). All ten assert properties of the recorded fixture, never of the code. **MERGE into one fixture-sanity test.** The companions that DO kill - `buildStrategyFamilies reproduces the Optimizer capture` x4 (88 kills, in the cover) and `buildVariations golden` x8 - stay.
  - `ELIGIBILITY_AGE: the constant exists and ships at 65` (:5302) restates a data value; `the harness restores the constant` (:5503) tests the test file. **DROP both.**
  - `breakEvenHeirsRate: the predicate is monotonic in the rate (binary search precondition)` (:6150, 2.6 s, slow-tagged) failed on none of the 5,011 mutants, including every mutant inside `breakEvenHeirsRate` itself; its siblings `the rate/amount pair it reports is self-consistent` (:6134) and `lowestBreakEvenHeirsRate: finds a threshold the best-scoring candidate does not have` (79 kills, 4th in the cover) do the guarding. **DROP**; the suite gets 2.6 s back.
  - `P126: no code outside the load folds still names the retired strategy` (:8220) is a tombstone grep for a rename. **DROP.**
  - `P38: sizing by a flat nominal rate would badly over-draw an SS-heavy household` (:3288) reads as a demonstration of the rejected method rather than a guard on the shipped one; **REWRITE** as an assertion about the shipped sizing, or drop.
  - `P81: no top-level name collides ...` (:5867), `the plan bank: every plan file can be loaded ALONGSIDE the others` (:9696) and `the card fields a chooser relies on are all present and honest` (:9717) kill no engine mutant by construction and **KEEP**: the first two reproduce load-time failures node cannot otherwise show, the third keeps the fixture honest.
- **Killing, but adding nothing beyond the cover - 216 tests (4.3), 60 of them with no unique kill at all.** These are **MERGE** candidates, not drops: same kills, fewer pins. The clearest clusters: the eight `OPT_*` objective / column structure tests (:5168-5251; 3 kills each, 0 unique) into one table test; `compactNum: round-trips losslessly` and `never longer than the raw value` (:1766, :1773) into `compactNum: expected compact forms` (24 kills); the `plan scope` pair (:6676, :6684); the `P89` pair (:7007, :7014); `breakEvenHeirsRate: no IRA means no threshold` (:6123) and `bestTimeLimitedConversion: no IRA means nothing to find` (:6236) into their parents. The rule that produces the same kills with fewer pins: siblings that exercise one function with different inputs become one test with a case table.

Net for the node suite: about 4 drops, 10 tests into 1, and 20-25 sibling merges, none of which loses a kill, plus 2.6 s of runtime. That is the honest size of the dead weight measured here: roughly 8% of the pins, not "many". The larger findings are the in-page suite (4.0a), where the goldens actually live and where the pre-commit hook does not reach, and what is missing (4.8).

### 4.8 Tests to add, from survivors read in the code

Each row is a mutation that survived and was then read at the cited line; the "test" column is the assertion that would have caught it.

| Behavior | Evidence | Test to write |
|---|---|---|
| IRA inheritance when person 2 dies first | `computeIncome` :1743 `balance.IRA1 += balance.IRA2` mutated to `-=` survives; 23 tests set a second death, none checks per-account balances after it | two-person plan with `die2` before `die1`: from the death year IRA1 equals the former sum and IRA2 is 0 |
| Survivor pension when person 1 dies first | :1777 `yr.pension = yr.pension * (inputs.survivorPct / 100)` deleted survives; 16 tests set `survivorPct` | pension after the death equals pension x survivorPct, in that branch |
| The plan ends at the second death | `resolveHousehold` :1610 `return false` flipped to `true` survives | a horizon longer than both lives: the log stops at the second death year |
| The filing-status transition year | :1645-1648 `isLastMFJYear` / `isFirstSingleYear`; 0 tests name either | exactly one year flagged last-MFJ and one first-single around a mid-horizon death |
| QCD "as needed" mode | `computeAnnualQCDs` :287 branch negated survives; 2 mentions in tests | a household one IRMAA tier over the line gives exactly enough to drop below it, and nothing when already below |
| QCD eligibility per person | :279-280 `alive && eligible` swapped to `\|\|` survives | one eligible spouse, one not: only the eligible IRA gives |
| Roth-first third pass | `resolveResidualAndForcedIRA` :3431-3437, three statements deletable | `rothGapFill: 'fillRothThenCash'`, Cash and Brokerage empty, Roth funded: the residual comes from Roth before any forced IRA draw |
| A conversion into the second Roth | `growAndSettle` :4323 `balance.Roth2 += yr.surplus.Roth2` deletable | a conversion sourced from IRA2 lands in Roth2 by year end |
| Tax attribution | `attributeIncrementalTaxes` :4260-4300, 56 of 56 mutants survive; no test names `incrementalConvTax` or `incrementalExcessTax` | `incrementalConvTax` equals the year's tax minus the tax recomputed without the conversion (the test calls `calculateTaxes` itself); likewise for the banked excess; both 0 when nothing was converted or banked |
| The Break Even counterfactual refund | `cfRefundIRA` :3839-3840 sign flips survive | after the refund, IRA = pre-refund + suppressed draws - suppressed conversions, to the dollar |
| Brokerage gross-up for capital gains | `planPrimaryWithdrawals` :2885 `/` to `*` survives | a Brokerage draw with a known gains fraction and rate delivers exactly the net requested |
| Advisor fee sourcing across two IRAs | `applyAdvisorFee` :4121, :4125 `Math.max` swaps survive | fee comes from the larger IRA first and no balance goes below zero |
| The sustainable-spend terminal rule | `suggestSustainableSpend` :5729 `spendGoal - guaranteedIncome` sign flip survives (only monotonicity is tested) | the suggestion leaves at least `bufferYears` x (spend goal - guaranteed income) in the last year, on a fixed household |
| IRMAA ceiling with one person not enrolled | `computeBracketCeiling` :1010-1011 | `medicareEnroll2: false` halves the per-person input to the margin |
| `futureIRARate` is the year-0 rate | `evaluateYearOutcome` :4636 `ySeq === 0` negated survives | `totals.futureIRARate` equals year 0's marginal rate, not the last year's |
| `calculateWithdrawals` validation and gross-up | :447-453, :584-585, :632 - caught only by the browser suite (4.6) | moves to node with 4.0a |
| `taxengine.js` exports with no direct test | `getIRMAATier`, `getQCDLimit`, `isQCDEligible`, `calculateTaxableSocialSecurity`, `nonSSIncomeForMAGI` | `isQCDEligible`: June vs July birth at 70.5; `calculateTaxableSocialSecurity`: both thresholds, both statuses, the 50% and 85% tiers, hand-derived like `TEST CASE 4` |
| Wall clock inside the engine | `simulate` :4988 `Math.max(0, currentYear - new Date().getFullYear())` (also 1.3) | freeze `Date` in the test and show `gapYears` follows the input year |

### 4.9 Verdict in numbers

| Suite | Today | Proposed | Net pins |
|---|---|---|---|
| `optimizer_core.tests.js` | 486 | drop 4, merge 10 into 1, merge 20-25 siblings, move in the engine groups from the page (the 14 `calculateWithdrawals` goldens become 4 invariants), add the 18 rows of 4.8 | about 480, 2.6 s faster, every one of them under the hook |
| `optimizer_tests.js` | 595 assertions | about 450 after the engine groups leave; the rest is UI and needs the gate decision in 4.0a | - |
| `doclinks.tests.js` | 27 | 15 (thirteen one-liners into one table) | -12 |
| `taxengine.tests.js` | 32 | + 5 (the untested exports and the SS table) | +5 |
| `taxPaymentPlanner.tests.js`, `feedback.tests.js` | 61, 46 | unchanged (their targets were not measured; re-run the configs before touching them) | 0 |

`TestTiers.EXPECTED` and `.githooks/README.md` change once per PR, at the end.


---

## 5. UK English

The scanner tagged 990 raw hits; after removing identifiers (code zone), hex colors (`#F8FAFF`), chart "ticks", "used to hand", "in future dollars" and similar false matches, 418 corrections remain, plus 70 optional UK-leaning variants (`towards`, `afterwards`, `backwards`, `tidy`) that many US writers also use and are left to taste. Group A is the user-facing set; B the published documents; C code comments; D tests; E harnesses; F the planning logs by file only (206 occurrences, low value to edit).

Word frequency across all groups: labelled 49 · greyed / greys / grey / greying 71 · ticked / tick / untick / unticked 33 · modelled / modelling 32 · cancelled 20 · way round 20 · behaviour 17 · neighbour* 21 · colour* 16 · honour* 14 · centre* 10 · minimise / maximise / normalise / recognise / analyse and other `-ise` forms 41 · enrolment 5 · licence 2 · artefact 1 · maths 1 · knock-on 3 · fiddly 1 · belt and braces 2.

Two rules the scanner cannot apply and a reviewer must: "analyses" as a plural noun is US English (all remaining hits were checked and are verbs); chart-axis "ticks" and the `ticker` are not checkboxes and were excluded.


#### A. User-facing text in code (strings, templates, HTML markup) - 17 corrections

| Location | Found | US English | Context |
|---|---|---|---|
| `montecarlo/rails_engine.js:143` | cancelled | canceled | const _RAILS_CANCELLED = Symbol('rails-cancelled'); |
| `optimizer_ui.js:8028` | cancelled | canceled | showMessage('Import cancelled.', 'warning'); |
| `optimizer_ui.js:8368` | cancelled | canceled | showMessage('Import cancelled.', 'warning'); |
| `retirement_optimizer.html:401` | greys | grays | d do not use it, with or without Guardrails, and this field greys out when one of those is selected.">&lt;span st |
| `retirement_optimizer.html:910` | way round | way around | ce: as you set it, and with the Guardrails switch the other way round. About 60 times less work than comparing |
| `retirement_optimizer.html:1002` | way round | way around | setting except one: your own plan with the switch the other way round. &lt;span id="mc-path-count-tbl">&lt;/span> |
| `retirement_optimizer.html:1163` | untick | uncheck | &lt;li>Your settings and any page errors go with it unless you untick them: strategy, tax limit, filing status, s |
| `retirement_optimizer.html:1163` | tick | check | plan link and a screenshot of the whole page go only if you tick them, and &lt;i>Show exactly what will be sent&lt;/ |
| `retirement_optimizer.html:1184` | labelled | labeled | &lt;strong>The Guardrails switch is now labelled GK-style.&lt;/strong> |
| `retirement_optimizer.html:1197` | way round | way around | ting, and each adds your own plan with the switch the other way round. Monte Carlo's My Plan Only runs your pl |
| `retirement_optimizer.html:1285` | greys | grays | &lt;/i> and &lt;i>Ordered&lt;/i> do not use it at all, and the field greys out when one of them is selected. |
| `retirement_optimizer.html:1309` | way round | way around | rails setting, plus your own plan with the switch the other way round, so you can see what Guardrails are wort |
| `retirement_optimizer.html:1659` | way round | way around | h. One extra row is your own plan with the switch the other way round, so you can see what Guardrails are wort |
| `retirement_optimizer.html:1659` | way round | way around | �️ Guardrails on / off: your plan with the switch the other way round&lt;/span> |
| `taxPaymentPlanner.js:277` | realises | realizes | ide that calculation. Selling shares from a taxable account realises a ' + |
| `taxPaymentPlanner.js:1921` | minimise | minimize | his installment is past due. Make a catch-up payment now to minimise underpayment penalty.') |
| `taxPaymentPlanner.js:1951` | minimise | minimize | : 'This installment is past due. Pay now to minimise the underpayment penalty.') |

#### B. Published and repo documentation - 44 corrections

| Location | Found | US English | Context |
|---|---|---|---|
| `.gitattributes:3` | renormalises | renormalizes | # it renormalises every tracked file at once. |
| `.githooks/install:28` | normalised | normalized | # are normalised because git reports Windows paths with them and s |
| `ARCHITECTURE.md:306` | way round | way around | ser's own plan is added once more with the switch the other way round |
| `ARCHITECTURE.md:636` | renormalise | renormalize | this repo has no repo-wide EOL policy, and adding one would renormalise every tracked file. |
| `ExperimentalFeatures.md:9` | modelling | modeling | puts** \| a query parameter, no form field anywhere \| a real modelling input that never got a control \| |
| `ExperimentalFeatures.md:64` | ticked | checked | is ticked, and the plan is run again when the solve lands. |
| `ExperimentalFeatures.md:135` | greys | grays | and Ordered, it **never reads the IRA Goal**, so that field greys out when it is selected - a fact that belong |
| `ExperimentalFeatures.md:145` | modelling | modeling | This is the one most easily lost**, because it is a genuine modelling input with no control |
| `optimizer_changelog.md:76` | untick | uncheck | with it.** Your settings and any page errors go unless you untick them: |
| `optimizer_changelog.md:78` | tick | check | plan link and a screenshot of the whole page go only if you tick them. |
| `optimizer_changelog.md:124` | labelled | labeled | **The Guardrails switch is now labelled GK-style.** |
| `optimizer_changelog.md:428` | greys | grays | **The IRA Goal greys out for the strategies that ignore it.** |
| `optimizer_changelog.md:431` | greys | grays | No value you type there changes their result. The field now greys out and says |
| `optimizer_changelog.md:509` | topped up | replenished | It shows the buffer being held, topped up, or broken into, and hides itself when there is n |
| `optimizer_changelog.md:699` | greyed | grayed | has already passed 65, the ACA income-cap options are still greyed out but |
| `optimizer_changelog.md:853` | fiddly | finicky | , and clicking one replays it. Picking one out there can be fiddly in the early years where |
| `optimizer_changelog.md:908` | ticked | checked | saved with the box ticked load as Full COLA; unticked loads as No increase. |
| `optimizer_changelog.md:908` | unticked | unchecked | saved with the box ticked load as Full COLA; unticked loads as No increase. |
| `optimizer_changelog.md:913` | greyed | grayed | IRMAA tier stay listed, greyed, showing the income where they begin. And a saved |
| `optimizer_changelog.md:969` | greys | grays | and the *Ordered* strategy greys the switch out, because it draws in the sequence |
| `optimizer_changelog.md:1435` | behaviour | behavior | - **Compare All Scenarios** is the old behaviour, renamed to say what it actually does. |
| `optimizer_changelog.md:2254` | recognisable | recognizable | tric in the Best table keeps its marker there too, so it is recognisable as the same row without |
| `README.md:198` | ticked | checked | \| Settings and page errors \| ticked \| your state, your choices and assumptions (strat |
| `README.md:199` | unticked | unchecked | \| Full plan link \| unticked \| the same link **Share** makes, which holds your |
| `README.md:200` | unticked | unchecked | \| Screenshot \| unticked \| a picture of the whole page behind the dialog, |
| `README.md:287` | way round | way around | ng, plus your own plan with the Guardrails switch the other way round. Apart from Ordered, and apart from ACA  |
| `README.md:289` | greys | grays | ou chose and therefore has no shortfall rule to change - it greys the switch out rather than hiding it. With * |
| `README.md:294` | tick | check | ch longer on an older computer) and runs in the background; tick *Auto-run* to keep it current as you edit, an |
| `README.md:455` | knock-on | ripple / downstream | pal interest never owes, overstating the tax again. The two knock-on effects come out roughly right that way,  |
| `README.md:652` | focusses | focuses | wyer in Washington DC, I find his pragmatism refreshing. He focusses on retirement topics. |
| `README.md:908` | knock-on | ripple / downstream | money grows, then is taxed once" and ignores the cascade of knock-on effects above. In my tests the true break |
| `README.md:1137` | way round | way around | timizer tests, plus your own plan with Guardrails the other way round. By default, therefore, *Compare All* ru |
| `README.md:1164` | way round | way around | prediction. All start years makes the same point the other way round, by leaving nothing out. Either way it is |
| `research/OPTIMIZER_RANK_STABILITY.md:217` | labelled | labeled | 2. **Order in two labelled groups** ('P100b3b'): evaluated rows by conversio |
| `research/OPTIMIZER_RANK_STABILITY.md:218` | labelled | labeled | rest **by net wealth, labelled as such**. |
| `research/OPTIMIZER_RANK_STABILITY.md:222` | labelled | labeled | aded *effectiveness* - a new lie replacing the old one. Two labelled groups |
| `research/PERFECT_FORESIGHT_ORACLE.md:22` | labelled | labeled | The old tables are kept for the record and are labelled where they are superseded. |
| `research/PERFECT_FORESIGHT_ORACLE.md:935` | neighbour | neighbor | its neighbour keeps a median 51% of the gain, but it went NEGAT |
| `research/RBG_RULE_VALIDATION.md:127` | labelling | labeling | which the cheap rule stops labelling once its ratio is inside the rails and the exact |
| `research/RBG_RULE_VALIDATION.md:128` | labelling | labeling | labelling while its chance stays at the raise rail - a labe |
| `research/README.md:43` | labelled | labeled | effectiveness for evaluated rows, net wealth for the rest, labelled - not a blended score, which would sort by |
| `research/RISK_BASED_GUARDRAILS.md:144` | way round | way around | This was predicted the other way round ('G-P1'), and the prediction was wrong. The artic |
| `research/RISK_BASED_GUARDRAILS.md:575` | modelling | modeling | modelling, and it changes which rule looks better. |
| `research/RISK_BASED_RAILS_PRECISION.md:188` | centres | centers | Demanding c = q x (N + 1) survivors instead of q x N centres the answer on q at every path count |

#### C. Code comments in production files - 96 corrections

| Location | Found | US English | Context |
|---|---|---|---|
| `displayhelpers.js:68` | behaviour | behavior | // Attaches smart numeric behaviour to a &lt;input type="text"> element. |
| `doclinks.js:110` | labelled | labeled | // flatten any markup inside the anchor. Every filename-labelled link here is plain |
| `feedback.js:15` | ticked | checked | settings    (ticked) the page's pinned values (the state), the share- |
| `feedback.js:18` | unticked | unchecked | plan link   (unticked) the whole share link, numbers and all |
| `feedback.js:19` | unticked | unchecked | screenshot  (unticked) a JPEG of what is on screen behind the dialog |
| `feedback.js:154` | ticks | checks | lt means "not included". shareUrl is read only for what the ticks allow. |
| `feedback.js:686` | Reckon | Expect / figure | // downscaled. Reckon on 5 to 9 seconds on a laptop of a few years ago. |
| `feedback.js:725` | unticked | unchecked | if (!el.shot.checked) return;            // unticked while it was being taken |
| `montecarlo/mc_controller.js:136` | amortised | amortized | // the input fan are amortised over few simulations -- real cost, but it does no |
| `montecarlo/mc_controller.js:214` | Cancelled | Canceled | // Cancelled mid-pass. Report nothing, which is what leaves th |
| `montecarlo/mc_engine.js:371` | recognise | recognize | // so the loop can recognise its own variation while it still holds that varia |
| `montecarlo/mc_engine.js:668` | cancelled | canceled | // post or hand back. Returns null if the run was cancelled - the caller reports nothing in that |
| `montecarlo/mc_engine.js:669` | cancelled | canceled | // case, which is what leaves a cancelled run's previous results on screen. |
| `montecarlo/mc_engine.js:699` | cancelled | canceled | if (!stressOnly && main === null) return null;   // cancelled mid-pass |
| `montecarlo/mc_engine.js:708` | cancelled | canceled | if (willRunStress && stress === null) return null;   // cancelled mid-pass |
| `montecarlo/mc_tab.js:22` | way round | way around | plan's Guardrails twin (the plan with the switch the other way round), or -1. |
| `montecarlo/mc_tab.js:246` | greyed | grayed | left clickable with nothing to do. Their knobs are already greyed out in that mode. |
| `montecarlo/mc_tab.js:387` | labelled | labeled | // Seed the timing model before the buttons are labelled, so they arrive carrying a cost rather |
| `montecarlo/mc_tab.js:503` | labelling | labeling | // How the sequences on screen were chosen, for labelling. Prefers what the engine actually applied |
| `montecarlo/mc_tab.js:534` | way round | way around | // The sidebar's plan with the Guardrails switch the other way round (P126). Built from the plan |
| `montecarlo/mc_tab.js:718` | cancelled | canceled | // Same reason runMonteCarlo() clears it: a cancelled run never delivers its callback, and on the |
| `montecarlo/mc_tab.js:722` | cancelled | canceled | // P91: the user cancelled, so do not quietly start another pass on their be |
| `montecarlo/mc_tab.js:888` | cancelled | canceled | // errors, is cancelled or is terminated draws nothing and records nothin |
| `montecarlo/mc_tab.js:1125` | grey | gray | ng is why neither arrow is ever disabled. The alternative - grey them out at the ends - left |
| `montecarlo/mc_tab.js:1318` | centre | center | // The two synthetic models centre the yearly return distribution differently, and t |
| `montecarlo/mc_tab.js:1319` | centre | center | ich one you are looking at. GBM's mu is a log drift, so the centre reported |
| `montecarlo/mc_tab.js:1321` | centre | center | // the centre IS that number. Neither changes how volatility dr |
| `montecarlo/prng.js:464` | labelled | labeled | r, for a reason no reader could have guessed from a control labelled "how many worst |
| `montecarlo/prng.js:508` | belt and braces | belt and suspenders | // them, so this never wraps; the modulo is belt and braces. |
| `optimizer_core.js:813` | modelled | modeled | * Not modelled: the mirror case at the other end, where benefits |
| `optimizer_core.js:1675` | ENROLMENT | ENROLLMENT | // PER-PERSON ENROLMENT. Not everyone 65+ is on Medicare: a person may be |
| `optimizer_core.js:2113` | Labelled | Labeled | / resumed run counts from the same end the whole plan does. Labelled rather than silent, |
| `optimizer_core.js:2761` | licence | license | filling it is the Optimizer ranking's job to surface, not a licence |
| `optimizer_core.js:3229` | modelled | modeled | nRother' fell through to the Roth-first branch and silently modelled the |
| `optimizer_core.js:5555` | greys | grays | // the IRA Goal can change their outcome. The UI greys the IRA Goal field for exactly these. |
| `optimizer_core.js:5568` | greys | grays | // or the field greys out on a control that works. |
| `optimizer_core.js:6201` | neighbouring | neighboring | // family's curve instead of only the neighbouring steps. Returns null when the value is already on |
| `optimizer_core.js:6617` | neighbouring | neighboring | Refine on the real $25k grid around the winner, re-testing neighbouring cutoffs since the |
| `optimizer_core.js:6749` | neighbouring | neighboring | // for a family whose neighbouring years differ by very little, and every row is pai |
| `optimizer_core.js:6777` | way round | way around | // the switch the other way round (planRuleTwin). Plain text, so it serves the HTML |
| `optimizer_core.js:7263` | unsanitised | unsanitized | nk-name path produces a timestamp containing colons, so the unsanitised |
| `optimizer_styles_responsive.css:190` | Greyed | Grayed | /* A knob the current strategy ignores. Greyed rather than hidden, so it does not appear and |
| `optimizer_styles_responsive.css:192` | greyed | grayed | ecause the hover-over is the only thing that says WHY it is greyed. */ |
| `optimizer_ui.js:761` | Enrolment | Enrollment | // the engine would not recognize. Enrolment defaults to TRUE, so the value sent is the |
| `optimizer_ui.js:885` | modelling | modeling | // modelling a smaller portfolio than they will actually have, |
| `optimizer_ui.js:969` | greyed | grayed | // nothing. Hide it rather than let it sit next to a greyed field. |
| `optimizer_ui.js:1261` | Cancelling | Canceling | e flag stuck true and every later click did nothing at all. Cancelling and re-queueing cannot |
| `optimizer_ui.js:1671` | way round | way around | user's own plan - so this adds it with the switch the other way round. Ranked with |
| `optimizer_ui.js:2531` | recognisable | recognizable | rry the pinned rows' markers into this table so a winner is recognisable as |
| `optimizer_ui.js:3210` | tick | check | switch tabs, work out which category the column belongs to, tick that category, then find the |
| `optimizer_ui.js:3258` | Ticking | Checking | / A column of all zeros stays hidden behind its own switch. Ticking the switch - rather than |
| `optimizer_ui.js:3267` | maths | math | // hide the mirror scrollbar and the scroll maths would land on 0. |
| `optimizer_ui.js:3271` | Centre | Center | // Centre the first named column. Centring rather than left |
| `optimizer_ui.js:3271` | Centring | Centering | // Centre the first named column. Centring rather than left-aligning also clears the sticky |
| `optimizer_ui.js:4315` | labelled | labeled | //  1. First death - labelled "You" / "Spouse" (filing status flips; the deceas |
| `optimizer_ui.js:4317` | Labelled | Labeled | nal row, always someone's death since the plan ends at one. Labelled the |
| `optimizer_ui.js:4321` | labelled | labeled | AA tier INCREASES over the prior year (e.g. Tier 1→Tier 2), labelled with |
| `optimizer_ui.js:4359` | neighbours | neighbors | // across its neighbours. The step-up glyph replaces it at a fraction of t |
| `optimizer_ui.js:4374` | labelled | labeled | ck to the plan still moved spending up, and a GK-style year labelled 'no-cut' |
| `optimizer_ui.js:5211` | Ticking | Checking | // Auto-run. Ticking it on solves at once when what is on screen is no |
| `optimizer_ui.js:5263` | ticked | checked | with it on a solve is scheduled whether or not Auto-run is ticked. |
| `optimizer_ui.js:5354` | greyed | grayed | lth, a + b x (wealth / spine wealth). Interpolated rows are greyed. |
| `optimizer_ui.js:5974` | labelled | labeled | // labelled "tax" everywhere. The scale is uniform, so it sha |
| `optimizer_ui.js:6460` | greys | grays | // hiding, the way the Ordered strategy greys out Roth-before-Brokerage. |
| `optimizer_ui.js:7004` | greyed | grayed | // knob is on, greyed until the switch is, and shown without the knob o |
| `optimizer_ui.js:7029` | Greyed | Grayed | // 🅡 rows. Greyed rather than hidden, and the switch is NOT cleared |
| `optimizer_ui.js:7037` | Greyed | Grayed | // Greyed and disabled rather than hidden, and the VALUE IS |
| `optimizer_ui.js:7519` | Normalising | Normalizing | ever. Import could manufacture entries Load would not open. Normalising on the |
| `optimizer_ui.js:7842` | ticks | checks | // A column of green ticks next to every other row was three states of nothi |
| `optimizer_ui.js:7920` | normalise | normalize | ame to be able to store entries Load would refuse. Both now normalise, then preview, then commit. |
| `optimizer_ui.js:8325` | unsanitised | unsanitized | // '${name}.json' was unsanitised, and the blank-name fallback is a timestamp conta |
| `optimizer_ui.js:8360` | Normalise | Normalize | // Normalise FIRST. The old test was 'if (raw.version && ...)' |
| `optimizer_ui.js:8958` | centred | centered | nst mid = y => y + ROW_H / 2 + 4;          // text baseline centred in a row |
| `optimizer_ui.js:9261` | greyed | grayed | // Silent, on instruction. The options are greyed out above and nothing here can be acted |
| `optimizer_ui.js:9274` | greyed | grayed | // the ACA options are greyed out, and a user who cannot select them could othe |
| `optimizer_ui.js:9386` | labelled | labeled | // labelled "no limit", and selecting it produced $NaN for th |
| `optimizer_ui.js:9481` | ageing | aging | // The trailing '(1 + cpi)' is the engine's, ageing a 2025 FPL figure into the plan's first year, |
| `optimizer_ui.js:9521` | Greyed | Grayed | // Greyed the same way updateACAWarning() greys a lapsed AC |
| `optimizer_ui.js:9521` | greys | grays | // Greyed the same way updateACAWarning() greys a lapsed ACA entry, so "listed but not |
| `retirement_optimizer.html:38` | grey | gray | // Prefers borderColor; falls back to backgroundColor; grey if both transparent. |
| `retirement_optimizer.html:643` | Enrolment | Enrollment | behavior so no saved plan or shared link moves. Enrolment is per person because a |
| `retirement_optimizer.html:1788` | behaviour | behavior | // Attach dollar-input behaviour before captureDefaults/loadFromURL so that |
| `retirement_optimizer.html:1964` | ticks | checks | (feedback.js). The share link is read only when the person ticks one of the |
| `RetirementTaxPlanner.html:916` | recognise | recognize | lently fell through to the last one for anything it did not recognise. |
| `standalone/IncomeTaxPlanner.html:550` | neighbour | neighbor | // prevFedTax === null means "no left neighbour", so no marginal rate; h is the difference width. |
| `taxengine.js:1073` | subsidised | subsidized | // THE YEAR LAG IS DELIBERATE. An ACA plan year is subsidised against the guideline published the |
| `taxengine.js:1080` | modelled | modeled | // are NOT modelled, so an ACA ceiling in those states is too strict |
| `taxPaymentPlanner.js:39` | maximise | maximize | *     latest-month draw across both IRAs to maximise tax-deferred growth |
| `taxPaymentPlanner.js:989` | initialised | initialized | // 60-day analysis initialised with zero withholding; updated after gap is known |
| `taxPaymentPlanner.js:1914` | minimise | minimize | // "Pay now to minimise the penalty" is only true if a penalty is actuall |
| `taxPaymentPlanner.js:2208` | Belt and braces | Belt and suspenders | ch would otherwise offer a "Split" plan with nothing split. Belt and braces: D is only |
| `taxPaymentPlanner.js:2329` | labelled | labeled | // a plain falsehood: a conversion-only plan was labelled "draws in December" with no draws. |
| `taxPaymentPlanner.js:2342` | artefact | artifact | // rounding artefact would be noise dressed as advice. |
| `taxPaymentPlanner.js:2391` | realises | realizes | // realises capital gains, so the sale has to be grossed up t |
| `taxPaymentPlanner.js:2903` | totalling | totaling | // conversion and owed seven estimated payments totalling the same $7,000. A reader working |
| `taxPaymentPlanner.js:3003` | grey | gray | // the IRC 6654 sense, so it gets a neutral grey badge and no red border. Only a genuine |

#### D. Test files (test names, assertion messages, comments) - 48 corrections

| Location | Found | US English | Context |
|---|---|---|---|
| `doclinks.tests.js:186` | labelled | labeled | // ── 8. docLabel: a link labelled with a filename must not lie ────────────── |
| `doclinks.tests.js:314` | untick | uncheck | // user to untick something that was not on the screen. A '&lt;label>' |
| `feedback.tests.js:152` | ticked | checked | test('buildPayload leaves the plan link out unless it is ticked', () => { |
| `feedback.tests.js:158` | ticked | checked | tings, withheld names and page errors only when settings is ticked', () => { |
| `feedback.tests.js:188` | unticked | unchecked | eq(FW.buildPayload(dialogState(), cfg).settings, null, 'unticked settings send no state either'); |
| `feedback.tests.js:277` | unticked | unchecked | test('the preview marks every unticked part and shows a screenshot only by its size', () |
| `feedback.tests.js:287` | ticked | checked | rt(full.includes(SHARE), 'the plan link is shown when it is ticked'); |
| `optimizer_core.tests.js:1088` | knock-on | ripple / downstream | // the knock-on and not a second effect - the larger 2053 draw le |
| `optimizer_core.tests.js:4679` | Enrolment | Enrollment | // couple it is often true of one of them. Enrolment decides the premium and the surcharge |
| `optimizer_core.tests.js:5349` | honours | honors | // computeBracketCeiling only honours an IRMAA-tier ceiling once the household is insid |
| `optimizer_core.tests.js:5432` | cancelled | canceled | // the fix is not cancelled out by its own safety belt. |
| `optimizer_core.tests.js:6436` | NEIGHBOUR | NEIGHBOR | // And it must not match a NEIGHBOUR. Every plan above differs from every other one, s |
| `optimizer_core.tests.js:6935` | Normalised | Normalized | // spread its literals, not a behavior. Normalised on both sides so a faithful extraction |
| `optimizer_core.tests.js:6989` | labelled | labeled | // ...)' was labelled "neither 65 at start" - but the plan cannot start |
| `optimizer_core.tests.js:7301` | way round | way around | // which is the wrong way round for a tool that ships a widow-RMD objective. |
| `optimizer_core.tests.js:7331` | modelled | modeled | cause 'Infinity &lt;= amount' is never true — and 21 of the 38 modelled |
| `optimizer_core.tests.js:7408` | honoured | honored | // 'skipSlow' is honoured ONLY by the browser tier. Node always passes fals |
| `optimizer_core.tests.js:7932` | labelled | labeled | test('P80: every sampled year is labelled with the year that actually produced it', () => { |
| `optimizer_core.tests.js:7976` | labelled | labeled | 'a wrapped scenario must NOT be labelled start + y; that is the bug this guards'); |
| `optimizer_core.tests.js:8008` | cancelled | canceled | test('P71: a cancelled job reports nothing at all', async () => { |
| `optimizer_core.tests.js:8009` | cancelled | canceled | // The contract the UI depends on: a cancelled run resolves to null, and the caller reporting |
| `optimizer_core.tests.js:8015` | cancelled | canceled | assert(msg === null, 'a cancelled job returned a results message'); |
| `optimizer_core.tests.js:8254` | labelled | labeled | f Object.entries(labels)) assert(P[k].label === l, '${k} is labelled ${P[k].label}, wanted ${l}'); |
| `optimizer_core.tests.js:8872` | cancelled | canceled | test('P128: a cancelled rails job resolves to nothing', async () => { |
| `optimizer_core.tests.js:9049` | neutralises | neutralizes | // Node neutralises this with a load-time stub. The browser must NOT |
| `optimizer_core.tests.js:9051` | hypothesised | hypothesized | // afterwards. This is measured, not hypothesised: without it exactly six byte-identity tests |
| `optimizer_core.tests.js:9437` | unsanitised | unsanitized | // interpolated unsanitised, and the blank-name fallback is a timestamp conta |
| `optimizer_core.tests.js:9558` | greys | grays | // The UI greys the IRA Goal field for IRA_GOAL_BLIND_STRATEGIES. |
| `optimizer_core.tests.js:9599` | greyed | grayed | 'P107: '${label}' reads the IRA Goal and must not be greyed'); |
| `optimizer_tests.js:992` | behaviour | behavior | tionSequence, spend escalates at inputs.inflation (existing behaviour unchanged). |
| `optimizer_tests.js:1387` | way round | way around | // The control follows the state, not only the other way round - a select showing one goal |
| `optimizer_tests.js:1495` | labelled | labeled | 'no entry is labelled "no limit"'); |
| `optimizer_tests.js:1564` | greys | grays | // The ACA gate greys out the FPL options once every person in the plan |
| `optimizer_tests.js:1568` | grey | gray | same first year and the same ages in it. The options still grey |
| `optimizer_tests.js:1599` | greys | grays | 'a start age past 65 still greys the ACA rows out'); |
| `optimizer_tests.js:1674` | greys | grays | // cap to protect, so the gate greys the ACA rows out and the selection has to move. |
| `optimizer_tests.js:1819` | colour | color | vertical line STYLE has a legend entry. Compared by stroke colour, not by count: |
| `optimizer_tests.js:1852` | labelled | labeled | '"Show ACA/FPL" adds the row, labelled ACA / FPL'); |
| `optimizer_tests.js:2376` | way round | way around | he plan as set, and the same plan with Guardrails the other way round ===== |
| `optimizer_tests.js:2391` | way round | way around | Rule, on ? '' : 'gk', 'rule '${rule}': and has it the other way round'); |
| `optimizer_tests.js:3190` | ticking | checking | assertEqual(jobs.length, 1, 'P128o: ticking Auto-run starts a solve at once, without the debo |
| `optimizer_tests.js:3195` | unticking | unchecking | assertEqual(RailsState.debounce, null, 'P128o: unticking it leaves nothing scheduled'); |
| `taxPaymentPlanner.tests.js:474` | labelled | labeled | 'Both surviving plans should be labelled by what they do'); |
| `taxPaymentPlanner.tests.js:568` | synthesises | synthesizes | // Every plan in the matrix, not only the parent's. D synthesises a December tranche date |
| `taxPaymentPlanner.tests.js:933` | honoured | honored | 0.604, 'the raw fraction is still honoured for legacy ?ap= links', 1e-9); |
| `taxPaymentPlanner.tests.js:1494` | behaviour | behavior | // The old behaviour took the entire conversion, which would have left |
| `taxPaymentPlanner.tests.js:1519` | honour | honor | assert(plan.strategy === 'all_quarterly', 'plan ${k} should honour the forced strategy'); |
| `taxPaymentPlanner.tests.js:1648` | honoured | honored | A.summary.safeHarbor.highIncomeStated, 'an explicit flag is honoured'); |

#### E. Research harnesses - 7 corrections

| Location | Found | US English | Context |
|---|---|---|---|
| `.test_harnesses/convtiming_harness.js:703` | labelled | labeled | ng is not evidence that they agree about anything, so it is labelled as vacuous |
| `.test_harnesses/gk_drawrule_harness.js:26` | Scalarising | Scalarizing | AND ends with more real terminal wealth, both plans funded. Scalarising with SPENDABLE_WEIGHT was |
| `.test_harnesses/schedule_replay_harness.js:21` | labelled | labeled | * spend with more wealth is labelled DOMINATES rather than partial. Same spend, same s |
| `.test_harnesses/split_expressiveness_harness.js:207` | neighbour | neighbor | // its neighbour, re-score, and the difference is what per-YEAR fr |
| `.test_harnesses/split_expressiveness_harness.js:304` | neighbour | neighbor | YEAR churn load-bearing? Collapse every 1-year run into its neighbour:'); |
| `.test_harnesses/stopyear_stability_harness.js:145` | neighbours | neighbors | // A local maximum is a cut scoring strictly above both neighbours. Endpoints count when they beat |
| `.test_harnesses/stopyear_stability_harness.js:146` | neighbour | neighbor | // their single neighbour, since "convert nothing" and "never stop" are bot |

#### F. Planning logs (.planning/) - 206 occurrences, listed by file only

| File | Occurrences |
|---|---|
| `.planning/retirement-optimizer/progress.md` | 50 |
| `.planning/task_completed.md` | 48 |
| `.planning/retirement-optimizer/task_plan.md` | 46 |
| `.planning/retirement-optimizer/progress_archived.md` | 29 |
| `.planning/retirement-optimizer/findings.md` | 12 |
| `.planning/retirement-optimizer/task_parked.md` | 12 |
| `.planning/retirement-optimizer/findings_archive.md` | 7 |
| `.planning/FILE_DIRECTORY.md` | 2 |

#### Word frequency (all groups)

labelled 49 · greyed 36 · ticked 21 · modelled 21 · cancelled 20 · way round 20 · behaviour 17 · greys 17 · modelling 11 · colour 11 · neighbour 11 · unticked 9 · greying 8 · grey 8 · ticking 7 · labelling 7 · honoured 6 · centre 6 · knock-on 6 · neighbouring 6 · minimise 5 · ticks 5 · tick 5 · untick 5 · unsanitised 5 · recognise 4 · honouring 4 · normalise 4 · enrolment 4 · neighbours 3 · materialised 3 · colours 3 · honour 3 · renormalise 3 · normalised 2 · centres 2 · analyses 2 · one-off 2 · catalogues 2 · normalises 2 · licence 2 · optimising 2 · coloured 2 · summarised 2 · belt and braces 2 · recognisable 2 · realises 2 · renormalises 1 · top-up 1 · belt-and-braces 1 · minimising 1 · optimised 1 · catalogue 1 · cataloguing 1 · equalled 1 · unnormalised 1 · deprioritised 1 · top up 1 · the lot 1 · italicised 1 · neighbourhood 1 · equalling 1 · full stop 1 · maximises 1 · scalarising 1 · focusses 1 · reckon 1 · amortised 1 · topped up 1 · fiddly 1 · honours 1 · neutralises 1 · hypothesised 1 · unticking 1 · centred 1 · centring 1 · cancelling 1 · ageing 1 · maths 1 · normalising 1 · totalling 1 · artefact 1 · maximise 1 · initialised 1 · synthesises 1 · subsidised 1

#### Optional: UK-leaning variants that many US writers also use (70)

backwards 28 · afterwards 23 · tidy 6 · forwards 5 · tidied up 2 · 24 november 2 · judgement 1 · 30 august 1 · tidying 1 · tidying up 1


---

## 6. Plan

Seven pieces of work, each one branch and one PR, in the order that keeps every later step safe. Effort is in working days for one person with a Claude session; the ranges are honest. "Byte-identity check" means: run `simulate()`, both optimizers and the four Monte Carlo modes over the 19 `plans/` households before and after, and diff the logs field by field (the method P126 used, 560 of 560 records identical); the existing sweep goldens and the `plan bank ... reproduces` test are the automated half of it.

| # | Branch | What ships | Effort | Risk | Done when |
|---|---|---|---|---|---|
| **A** | `fix/found-by-review` | The defects in sections 1.1-1.2 and 0: FPL 2025 figures plus a test that ties `GUIDELINE_YEAR` to `FEDERAL.YEAR`; one `escapeHtml`; `Retirement_Projection.html` ages from `new Date()`; the dead `'no'` branches and JSDoc; `yeIraWins` collapse and the no-op ternary; `optimizer_core.js:5507-5509` guard order; unreachable `return 0.045`; the seven dead functions; the unread `TAXData` keys; the `TEST` fixture out of production data; `optimizer_core.tests.js:7404-7411` fragment and the other verified stale comments in 3.2 (an hour of deletions). | 1 | low; the FPL change (done in 11.18e0, with `escapeHtml`) moved each ACA ceiling up 0.65% MFJ / 1.1% single, not ~3.4%: see finding #1 | node suites green, badge green, byte-identity check passes except the ACA rows, which move by the documented amount |
| **B** | `tests/engine-under-the-hook` | Move the engine groups of `optimizer_tests.js:111-1324` into `optimizer_core.tests.js`; rewrite the 14 `calculateWithdrawals` goldens as invariants; fold `doclinks.tests.js:92-162` into one table test; drop the zero-kill tests in 4.2 that carry no signal (not the critical guards, not the ones whose kills live in a file that was only sampled); add the tests 4.7 asks for (survivors in money-moving code, the four untested `taxengine.js` exports, an SS taxation table test); tag or speed the four untagged tests over 0.5 s; one edit to `TestTiers.EXPECTED` and `.githooks/README.md` at the end. Decide the UI gate (headless run in the hook, or a sentence in `ARCHITECTURE.md`). | 2 | low; this is the safety net for C-E and should land before them | mutation score on `optimizer_core.js` re-measured with the same tool: survivors in the functions named in 4.5 gone or explained; suite count and time recorded in the PR |
| **C** | `refactor/law-into-taxdata` | Section 1.1: `TAXData.RMD` with `rmdStartAge()`, `SOCIALSECURITY.FRA` and `.RULES`, `QCD.ELIGIBILITY_AGE`, `CA.hsaDeductible`, `TaxPaymentPlanner.SAFE_HARBOR` read by `optimizer_ui.js:3762`, the stale state figures stamped or updated, `Year` to `YEAR` with a year-consistency test, and the two pages reading `taxengine.js` instead of their copies (delete `Retirement_Projection.html:16-70, 896-905`, `IncomeTaxPlanner.html:335`). | 2-3 | medium: touches money paths; the byte-identity check is the whole acceptance | byte-identical on all 19 households and both pages render the same numbers |
| **D** | `refactor/one-home-per-knob` | Sections 1.3-1.6: `GK_DEFAULTS`, captured-default reads instead of `\|\| 2.8`-style fallbacks, `FUNDED_TOLERANCE`, `BE_NEVER`, `EPS_*`, conversion grid into `OPTIMIZER_GRIDS`, MC engine defaults from `MC_PARAMS`, `STRESS_DEFAULTS`, `PERCENTILES`, `SURVIVAL_BANDS`, `TIMING`, `DAY_MS` and `APRIL_NEXT_YEAR` in the planner; the `STRATEGY` / `SPEND_RULE` / `MC_MODE` / `JOB_KIND` / `ROTH_GAP_FILL` enums (a typo then throws instead of falling into the baseline branch); one `ASSET_VERSION` for the cache tokens. | 2 | low-medium; mechanical, but the enum change touches ~130 comparisons | byte-identical; release procedure edits one line |
| **E** | `refactor/shared-code` | Section 2: `sharepanel.js` for the seven pages, `standalone/tool.css`, `taxArgs()` / `repriceYear()` / `ratesAtLimit()` in the engine, one quarterly-estimate builder and `_s()` rows in the planner, `stateNoteHtml()`, chart option factories, the two `Retirement_Projection.html` twins. | 2 | medium for the engine helpers (the five identical call sites must stay identical), low for the pages | byte-identical; every page's share link round-trips (the in-page suite has this) |
| **F** | `docs/comments-say-what-is` | Section 3: the rule into `CLAUDE.md` (what the code does now and the constraint that breaks it; functions, never lines; history in commits and `research/`); then block by block through Appendix A with the two worked examples as the target size; `ARCHITECTURE.md` tiers, counts and cites; `FILE_DIRECTORY.md` rows. Done after C-E so the same lines are not edited twice. | 3-4, in slices | none to behavior; the risk is deleting a constraint, which is why the "must survive" list in 3.4 exists | `optimizer_core.js` under ~1,500 comment lines, `optimizer_ui.js` under ~1,500, no line-number cites, no names of missing files |
| **G** | `docs/us-english` | Section 5, groups A and B first (61 sites, user-facing and published), then C-E (151) mechanically; one changelog line for the visible wording. Optional: a 10-line grep in the pre-commit hook for the dozen words that account for 80% of the hits. | 0.5 | none | scanner re-run shows only the optional variants |

Two things the plan deliberately does not do: it does not touch the research harnesses (`P112c` / `P116` already own that), and it does not propose a build step or a module system; every fix above works with plain scripts and `importScripts`.

If only one of these can happen this month: **A** (it corrects numbers people see) and then **B** (it is what makes C-E safe). If only one hour: the FPL figures, the `escapeHtml` collision and the stale-comment deletions in 3.2.


---

## Appendix A. Comment blocks of 8+ lines in production code, with markers

Markers: history = "used to / no longer / replaced / shipped / the bug / measured ..."; date = a `2026-xx-xx`; phase-id = a `P\d+` reference; version = `v11.x`; user-quote = "(user, ...)"; measurement = a dollar figure with commas, "n of m", or a millisecond figure; missing file / missing identifier = a name that does not exist on `main`; line cite = a `:NNNN` reference.


**optimizer_core.js** - 125 blocks of 8+ lines, 2199 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 1-16 | 16 | - | ====================================================================== |
| 28-50 | 23 | history, date | Baseline ranking weight: a dollar the household actually spends outran |
| 101-129 | 29 | history, phase-id | P64a. Property + other local taxes for the SALT itemizing test, in the |
| 142-159 | 18 | history, phase-id | P81. The deepest one-year fall the model allows any inflation index to |
| 162-177 | 16 | history, phase-id | P70i. What a pension's cost-of-living adjustment is worth in a given y |
| 186-202 | 17 | history, version | ── IRMAA targeting: this year's MAGI is judged two years from now ──── |
| 217-233 | 17 | history, version | Multiplier that carries a threshold from today's indexing to the premi |
| 288-303 | 16 | history, phase-id, measurement | Target: drop 2 IRMAA tiers (or escape all surcharges), whichever needs |
| 367-381 | 15 | - | Calculate taxable capital gains from a brokerage account withdrawal. |
| 402-416 | 15 | phase-id | Enforces the invariant BrokerageBasis <= Brokerage (P35f). You cannot  |
| 421-435 | 15 | - | Calculates withdrawal amounts from multiple accounts based on strategy |
| 703-723 | 21 | history, measurement | Growth factor for a FRACTION of a year, under the rate the inputs decl |
| 750-763 | 14 | history | The three after-growth timing corrections (December tax settlement, co |
| 780-793 | 14 | history | Full Retirement Age in months, per the SSA schedule. FRA is 66 for any |
| 801-817 | 17 | - | Fraction of a full year's Social Security actually paid in the year th |
| 824-834 | 11 | - | Returns the final monthly SS benefit for a surviving spouse. |
| 885-892 | 8 | - | Phase 21: Break-Even Tax Rate (Kitces formula, taxes paid from outside |
| 924-952 | 29 | history | MAGI ceiling for bracket/aca strategies - shared by the normal per-yea |
| 962-978 | 17 | history, phase-id | P70b. This took a fourth argument, 'inflation', and handed it to the a |
| 1028-1038 | 11 | - | ACA FPL cliff mode: fill MAGI up to a multiple of the Federal Poverty  |
| 1064-1076 | 13 | history, phase-id, measurement | P92a. A federal bracket top is a TAXABLE-income threshold; every calle |
| 1085-1111 | 27 | history, phase-id, measurement, missing file | P87d. The year's MAGI **on the income definition the active ceiling is |
| 1129-1139 | 11 | history, phase-id | Generated from the letters rather than looked up in a three-entry map  |
| 1324-1335 | 12 | phase-id | A real column, as of P99. It was emitted as '-acaBreach', and a leadin |
| 1430-1438 | 9 | - | True when an ACA FPL cap has nothing left to protect: every LIVING per |
| 1448-1474 | 27 | history, phase-id, measurement, missing file, missing identifier | P84l. THE PRIOR DECEMBER 31 IRA BALANCE, captured before anything in t |
| 1484-1492 | 9 | - | Phase 24 interaction fix: cyclic brokerage "harvest" years draw $0 fro |
| 1499-1516 | 18 | phase-id | IRA Goal is entered in today's dollars (matches the today's-dollar "Su |
| 1520-1527 | 8 | history, phase-id | Phase 12: growthRates moved here (from below withdrawal block) to enab |
| 1536-1562 | 27 | history, missing identifier | ── WHEN THE MONEY MOVES: one mode, three months ────────────────────── |
| 1566-1578 | 13 | - | ── ONE MODE, THREE MONTHS ──────────────────────────────────────────── |
| 1616-1626 | 11 | history, measurement | OBBBA (P.L. 119-21) provisions, gated per calendar year. calculateTaxe |
| 1650-1661 | 12 | - | IRC 1014 basis step-up at the FIRST death. The brokerage cost basis re |
| 1691-1701 | 11 | history, measurement | Base Medicare Part B + Part D premiums. Grows at CPI + Inflation (user |
| 1829-1844 | 16 | - | Milestone flags for the charts: the first year money actually ARRIVES, |
| 1862-1881 | 20 | history, phase-id | These will be APPROXIMATE worst case - no Withdrawals have been made. |
| 1891-1908 | 18 | history, phase-id | P84l: struck off the PRIOR DECEMBER 31 balance, not the current mid-ye |
| 1968-1980 | 13 | history | 4. Determine Target Spending amount based on Strategy |
| 1998-2024 | 27 | history, phase-id, measurement, missing file | P92a. The deduction computeBracketCeiling adds back, so that "fill the |
| 2052-2071 | 20 | history, date, phase-id, user-quote | Phase 22: Guyton-Klinger dynamic spend adjustment (runs before targetS |
| 2125-2139 | 15 | date, phase-id, user-quote | P127 PROTOTYPE, 'gkShapeCeiling', DEFAULT OFF. Holds the goal at the p |
| 2149-2165 | 17 | history, phase-id | P132: the risk-based rule (Tharp and Fitzpatrick). Spending takes CPI  |
| 2236-2246 | 11 | history, user-quote, measurement | Medicare premiums as real money out, when the user asked for it ('medi |
| 2250-2261 | 12 | phase-id, line cite | P38: size the primary draw against income the household can actually S |
| 2303-2371 | 69 | phase-id | P51b research input (node-only, no UI, default off): a per-year withdr |
| 2422-2431 | 10 | history, phase-id | P127. The PORTFOLIO's return for the year, which is what the published |
| 2448-2459 | 12 | date, phase-id, user-quote | P128. Risk-based guardrails: four published parameter sets, each a tar |
| 2530-2541 | 12 | history, phase-id | P103b2. Compile a finished run into the schedulePlan that reproduces i |
| 2550-2557 | 8 | phase-id | P103b5. A spend-adaptive family decides the SPEND, so that is what has |
| 2577-2584 | 8 | measurement | Emitted even when the draw is ZERO, and the zero years are the reason. |
| 2635-2663 | 29 | history, phase-id, measurement | P104b1: 'strategy: 'split'' -- the constant account split. The oracle' |
| 2712-2735 | 24 | phase-id | Brokerage harvest year: draw from Brokerage instead of IRA. Always max |
| 2741-2763 | 23 | history, phase-id, measurement, missing file | P87c4. How much room a strategy ceiling still has above an ordinary-in |
| 2773-2800 | 28 | history, phase-id, measurement, missing file | Harvest sizing as a function of the ordinary-income floor. With ordFlo |
| 2923-2931 | 9 | - | Withdraw the fixed amount left after RMDs, or whatever is left in IRAs |
| 2997-3019 | 23 | history, phase-id, measurement | P87c. How much of the Social Security benefit this ceiling's own incom |
| 3134-3142 | 9 | phase-id | P117. Both seeds carry the 3.8% NIIT surtax on top of the statutory ra |
| 3175-3191 | 17 | history, date, measurement | P104b1x. possibleIncome is INCOME - what the tax passes are computed o |
| 3198-3230 | 33 | history, date, phase-id, version, measurement | Move Roth OUT of last place in the gap fill. Shipped at P28f as the "R |
| 3263-3281 | 19 | history, phase-id | Bracket/IRMAA strategies: supplement spending from Cash first, then Br |
| 3307-3324 | 18 | phase-id | Default: Brokerage + Cash proportional, then Roth fallback. |
| 3371-3393 | 23 | history, phase-id, measurement | Two inputs, one SHIPPED and one research-only. Both were added by P32c |
| 3409-3429 | 21 | history, phase-id, measurement | HISTORY, kept because the reasoning was plausible and wrong, and delet |
| 3525-3547 | 23 | history, phase-id, user-quote, line cite | Funding backstop: when Cash/Brokerage/Roth are exhausted but the IRA s |
| 3611-3623 | 13 | history | TWO income figures, and the difference between them is load-bearing. |
| 3647-3660 | 14 | phase-id | Route the year's surplus: refund unneeded Roth draws, convert IRA-sour |
| 3717-3726 | 10 | - | convertExcessToRoth: route the IRA-sourced surplus to Roth instead of  |
| 3791-3798 | 8 | - | If there is STILL a surplus, decide where it lands. Three regimes: |
| 3808-3816 | 9 | - | Ordered: the fill follows the draw order. Bank surplus in whichever FU |
| 3875-3896 | 22 | history, phase-id, measurement | Phase 23: extra conversion - additional IRA→Roth independent of spendi |
| 3908-3922 | 15 | phase-id | P88c. 'bracketOverage' is computed twice inside the WITHDRAWAL phases  |
| 3999-4031 | 33 | history, phase-id, measurement | Prefer-larger IRA sourcing for the additional conversion pulls (extra  |
| 4034-4041 | 8 | - | Percent-vs-dollars is INFERRED from what you typed, not chosen from a  |
| 4160-4174 | 15 | - | Cash-funded gross-up (fundConversionWithCash): pull an ADDITIONAL gros |
| 4230-4240 | 11 | phase-id | P88b. The gross-up's own income basis. Unlike applyExtraConversion thi |
| 4302-4321 | 20 | history, phase-id | P28jg. The conversion is credited HERE, before the post-withdrawal gro |
| 4325-4364 | 40 | history, phase-id, missing file | P108b. TAX SETTLEMENT DATE. 'taxSettlement: 'december'' keeps the tax  |
| 4383-4392 | 10 | history, phase-id | P115b. BASIS DOES NOT MOVE. This used to add the credit to BrokerageBa |
| 4400-4459 | 60 | history, date, phase-id, user-quote, missing file | P28jk. CONVERSION MONTH, independent of the spending-withdrawal month. |
| 4491-4501 | 11 | history, measurement | THE IRA MAY NOT HAVE IT TO GIVE, AND THEN THE ROTH MAY NOT RECEIVE IT. |
| 4514-4550 | 37 | history, phase-id, measurement | ── The RMD's own month ─────────────────────────────────────────────── |
| 4788-4845 | 58 | history, phase-id | Advance the two clocks for the following year. THIS is where P70's one |
| 4859-4866 | 8 | phase-id | P81c. A COLA is an INCREASE, never a decrease, and the two instruments |
| 4892-4912 | 21 | history, phase-id | ── P128: RESUME - continue a plan from the end of one of its own years |
| 5019-5072 | 54 | history, todo | PROCESS: |
| 5160-5171 | 12 | - | Phase 20 (reworked): Opp. Cost via full counterfactual simulation. |
| 5180-5187 | 8 | - | Break-Even year selector: the earliest index that is BOTH (a) the star |
| 5209-5218 | 10 | - | Withdrawal-rate summaries. Walked pairwise so each year can reach the  |
| 5233-5252 | 20 | - | IRC 1014 basis step-up at the SECOND (final) death. The simulation end |
| 5256-5264 | 9 | - | Exactly inverts the cap-gains haircut in the totalNetWealth formula (e |
| 5270-5284 | 15 | history, phase-id | P106g. Re-discount the terminal IRA at a widow-scoped trailing average |
| 5332-5344 | 13 | - | Diagnoses WHY a plan's Roth conversions never sustain a Break Even lea |
| 5374-5386 | 13 | history, phase-id | The SUSTAINED break-even year: the first year after which the opportun |
| 5403-5435 | 33 | history, phase-id, measurement | The rate the TERMINAL IRA is discounted at, estimated from the plan's  |
| 5473-5499 | 27 | history, date | Searches for the year that MAXIMIZES after-tax wealth by stopping Roth |
| 5554-5568 | 15 | history, date, phase-id, measurement | Strategies whose withdrawal branch never reads 'yr.curIRA' or 'yr.iraG |
| 5613-5627 | 15 | phase-id, measurement | Guardrails (the Guyton-Klinger spend rule) self-adjust spendGoal downw |
| 5646-5659 | 14 | history, phase-id | Returns the highest-spend simulation result where the portfolio can st |
| 5748-5756 | 9 | - | The suggested-spend menu: three after-tax goals from conservative to a |
| 5845-5852 | 8 | - | Real-dollar, spendable-weighted score for one simulate() result. Same  |
| 5861-5878 | 18 | history, phase-id | PF11: pick the conversion-sweep candidate pool -- the best (highest _b |
| 5900-5911 | 12 | phase-id | PF13: the optimizer's "Optimize for" objectives. Pure ranking logic (n |
| 5920-5928 | 9 | - | The Tax Flexibility spread, as a fraction of the total: 0 means the th |
| 5966-5978 | 13 | history, date, phase-id | Earliest Break Even: the year a strategy's conversions permanently ove |
| 5983-5996 | 14 | history | ====================================================================== |
| 6026-6033 | 8 | - | objKey -> the columns that answer the question that goal asks. Pure da |
| 6052-6059 | 8 | - | The two conversion goals rank on numbers that only a CONVERTING row ha |
| 6065-6074 | 10 | - | Relative view: which columns can be shown as a difference from the ref |
| 6113-6124 | 12 | - | True when two plans select the SAME withdrawal strategy: same family,  |
| 6252-6265 | 14 | history | ── Strategy-column sort key ────────────────────────────────────────── |
| 6290-6301 | 12 | history, phase-id, measurement | P100b3. The SHARED secondary ranking, applied after whatever the objec |
| 6363-6393 | 31 | history, phase-id, version | True when BOTH people are already on Medicare when the plan opens, whi |
| 6394-6403 | 10 | history | The Retirement Start field takes an AGE or a CALENDAR YEAR, by the sam |
| 6459-6467 | 9 | phase-id, measurement | Guyton-Klinger can "afford" almost any conversion amount by continuous |
| 6477-6488 | 12 | phase-id | Does ANY conversion amount beat converting nothing, at one assumed fut |
| 6506-6518 | 13 | - | The lowest future/heirs tax rate at which converting more starts to im |
| 6554-6566 | 13 | history, measurement | Find a TIME-LIMITED conversion: an amount converted for the first N ye |
| 6637-6653 | 17 | - | Lowest break-even heirs rate across a set of candidate strategies -- t |
| 6669-6679 | 11 | history, phase-id, version | ── Ordered account sequences ───────────────────────────────────────── |
| 6683-6709 | 27 | history, phase-id, measurement | ── Strategy enumeration ────────────────────────────────────────────── |
| 6781-6796 | 16 | phase-id, user-quote, measurement | Strategies the 🅡 clone pass skips. Two, and both are ones 'fillSpendi |
| 6799-6833 | 35 | date, phase-id | Enumerate the strategy arms of a sweep. Pure: no DOM, no simulate(), n |
| 7085-7104 | 20 | - | After-tax terminal net worth for cross-strategy comparison. |
| 7155-7167 | 13 | history, version | ====================================================================== |
| 7194-7203 | 10 | - | Snapshot the numbers a run produced, as plain data. |

**optimizer_ui.js** - 68 blocks of 8+ lines, 817 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 1-8 | 8 | - | ====================================================================== |
| 35-82 | 48 | date, phase-id, user-quote | ====================================================================== |
| 216-231 | 16 | history, phase-id | Tax-rate creep (Assumptions) and Stop-conversions-after (sidebar) are  |
| 266-273 | 8 | history, date, user-quote | Show as Differences is not gated. It is ON by default for everyone (us |
| 396-405 | 10 | history, user-quote | Keep the pinned row itself when it is still one of the rows on screen, |
| 456-475 | 20 | - | The ⚖ glyph. Highlighted on whichever row the Δ columns are CURRENTLY  |
| 573-591 | 19 | history, date, phase-id, measurement | ── P64e. Property / local taxes: URL entry only, deliberately no contr |
| 816-825 | 10 | date, user-quote | What is wrong with the four custom numbers, as a list a reader can act |
| 881-893 | 13 | history, phase-id, measurement | P93. The heading over the balance fields says "Assets at Retirement Ag |
| 1035-1043 | 9 | history, phase-id | P80. Which historical year the replayed path's year 'i' was sampled fr |
| 1224-1233 | 10 | - | Assign afterTaxNW / afterTaxNWCurrentDollars / _baselineScore to every |
| 1266-1274 | 9 | - | The sweep is a few hundred simulations and blocks the main thread for  |
| 1424-1439 | 16 | history, phase-id | ACA is strict: any year its FPL cap can't fund spending makes the plan |
| 1477-1484 | 8 | history, phase-id | P104b3. selectionOf() FIRST, then the explicit fields below. This list |
| 1605-1612 | 8 | - | 📍 CURRENT PLAN - the sidebar's own plan, simulated exactly as configu |
| 1765-1774 | 10 | phase-id, user-quote, measurement | P88f. A conversion is stacked ON TOP of a draw already sized to fill t |
| 2016-2026 | 11 | history, phase-id | Rank column: numbers rows 1 (best) … N by the currently-selected objec |
| 2257-2264 | 8 | history | Earliest Break Even - the year conversions permanently overtake the sa |
| 2987-2994 | 8 | phase-id | P86: the running-total columns are COMPUTED HERE, not stored in the en |
| 3076-3086 | 11 | history | ONE rule for what becomes a column in Annual Details, used by the head |
| 3091-3099 | 9 | date, user-quote | Account BALANCE columns are never treated as empty (user, 2026-09-01). |
| 3207-3221 | 15 | history | ── Sending a reader to a column, from anywhere on the page ─────────── |
| 3841-3848 | 8 | history, date | Break Even ⓘ - now a SEARCHED stop-year suggestion, not just a "why bl |
| 3971-3980 | 10 | history, phase-id | Turns a bestConversionStopYear() result into the ⓘ headline + a one-cl |
| 4078-4088 | 11 | history | Half / full basis step-up mark for a death milestone, DRAWN rather tha |
| 4314-4328 | 15 | - | Compute milestone markers from the simulation log: |
| 4422-4429 | 8 | history | 8. The LAST death. The simulation ends at it, so the final row is alwa |
| 4444-4451 | 8 | - | Keeps the step-up legend under the asset chart in step with the run, a |
| 4895-4902 | 8 | phase-id | Plain legend: the hover-dim helper cannot dim the bars' per-point colo |
| 4917-4936 | 20 | history, date, phase-id, user-quote | ====================================================================== |
| 5627-5640 | 14 | date, user-quote | The rails as chart lines. 'balance' draws the two wealth rails, with t |
| 5964-5978 | 15 | history, phase-id, measurement | scale = (1 - effectiveTaxRate) on post-refund income. Using r.netIncom |
| 6069-6076 | 8 | measurement | The attribution is the year's average rate applied proportionally, not |
| 6362-6370 | 9 | history, phase-id, user-quote | P102b3. The goal-first "Roth conversions" selector is a second conveni |
| 6381-6390 | 10 | history, phase-id | -- P102b: goal-first mode -------------------------------------------- |
| 6508-6521 | 14 | history, phase-id | P102b2. "Stop conversions when they stop paying" adopts the answer the |
| 6557-6567 | 11 | - | Knob off means the panel stops DRIVING. It does NOT mean the plan chan |
| 6598-6617 | 20 | history, phase-id | P88e. An Extra Annual Roth Conversion and a ceiling strategy pull agai |
| 6656-6688 | 33 | history, phase-id, measurement | P92c. A limit the user picked is a contract, and this is the plan sayi |
| 6765-6775 | 11 | history | A saved plan or a shared link can name a strategy this version does no |
| 6802-6811 | 10 | phase-id | P104b3. What the four weights actually mean, in words, under the field |
| 6883-6891 | 9 | history, phase-id | GK-FOLD-BEGIN |
| 7127-7135 | 9 | - | Pristine default snapshot - captured once at init BEFORE loadFromURL m |
| 7170-7180 | 11 | history, phase-id | P84. 'afm' is NOT emitted, and pinning it here was over-engineering on |
| 7255-7272 | 18 | history | The two timing selects became one mode, so a link written before that  |
| 7483-7492 | 10 | version | The changelog release currently running, e.g. "11.1766". |
| 7513-7521 | 9 | history | Bring any entry to the shape the rest of the code expects, whatever it |
| 7802-7814 | 13 | measurement | The Stress Test tile in the summary bar is NOT written by runSimulatio |
| 8130-8137 | 8 | - | Compare what the plan recorded against what it produces now. |
| 8253-8260 | 8 | - | Deletes all scenarios that don't match SCENARIO_VERSION |
| 8337-8344 | 8 | - | Opens file picker to import scenario from JSON file |
| 8469-8478 | 10 | history, phase-id, measurement | Base year of the TAXData bracket values. Used to CPI-adjust displayed  |
| 8523-8535 | 13 | history, phase-id | P70. Shows the gap between the two rate inputs, because that gap IS th |
| 8733-8746 | 14 | - | Moves the ceiling dropdown off an option it must not sit on, to the ne |
| 8896-8903 | 8 | - | The DRAWING is a picture. The interactions are the toggle, the close c |
| 9003-9012 | 10 | - | Capital gains, WITH the NIIT surtax folded in, which is why this is on |
| 9037-9046 | 10 | - | ACA FPL caps, off by default. Four ticks and ONE label: at today's fig |
| 9147-9157 | 11 | history | Report anything a load path SUBSTITUTED, once. Three things can be swa |
| 9215-9223 | 9 | history, phase-id | EVERY MESSAGE BELOW NAMES THE START YEAR AND THE AGES IN IT, and that  |
| 9229-9240 | 12 | history, phase-id, user-quote | P95. A now-disabled ACA option falls back to the menu's own DEFAULT, " |
| 9270-9279 | 10 | history, phase-id | P89: gated on the SELECTION. This advisory describes how the FPL cap b |
| 9291-9299 | 9 | phase-id | ── P92e: reading one income ladder's position on the other ─────────── |
| 9301-9313 | 13 | measurement | The deduction that converts between the two bases. THE PLAN'S OWN, not |
| 9352-9359 | 8 | - | Builds the bracket/IRMAA ceiling dropdown options. |
| 9383-9391 | 9 | history | ── Federal brackets ────────────────────────────────────────────────── |
| 9423-9430 | 8 | - | ── IRMAA tier ceilings ─────────────────────────────────────────────── |
| 9461-9483 | 23 | history, phase-id, measurement | ── ACA FPL cliffs ──────────────────────────────────────────────────── |
| 9502-9511 | 10 | date, phase-id, user-quote | ── Sort all options by the MAGI they cap, lowest → highest ─────────── |

**montecarlo/mc_tab.js** - 14 blocks of 8+ lines, 139 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 36-44 | 9 | history | Every numeric parameter on this tab used to be read as 'parseInt(el?.v |
| 154-165 | 12 | history, version | Reproduce the pre-v11.160F Synthetic model: one flat inflation rate fo |
| 190-197 | 8 | - | ── Which preset is in effect ───────────────────────────────────────── |
| 422-433 | 12 | history | Two hashes, because the tab has two passes with different costs and di |
| 855-870 | 16 | history, phase-id | P91. A stress refresh requested while one is in flight used to be DROP |
| 885-895 | 11 | history, date | The '_buildMCHash()' the Stress Test on screen was computed from: the  |
| 906-915 | 10 | history, date, user-quote | Only a change the SWEEP would have seen makes the sweep out of date, a |
| 917-925 | 9 | history | No nerd-mode guard here on purpose. Nerd mode controls when the expens |
| 1121-1130 | 10 | phase-id | P82c. The captured Monte Carlo paths and the stress scenarios are ONE  |
| 1175-1182 | 8 | history | Returns the index of the variation that matches the user's current str |
| 1369-1376 | 8 | phase-id | The one number this whole pass exists to produce: how many of the wors |
| 1903-1911 | 9 | history | Stress colors encode the OUTCOME, not the ranking. The old gradient ra |
| 2059-2067 | 9 | - | 5 datasets per selected variation (bands + median). Dataset order with |
| 2327-2334 | 8 | - | No legend. Every column of it is already a column of the table below,  |

**montecarlo/rails_engine.js** - 7 blocks of 8+ lines, 176 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 1-75 | 75 | history, date, phase-id, user-quote | Risk-based guardrails, solved along the live plan (P128). |
| 223-234 | 12 | history, todo | Every answer is an order statistic, and only the paths that could stil |
| 506-514 | 9 | - | What a rails job with other settings would cost, priced from one that  |
| 536-557 | 22 | date, user-quote | The rails as Annual Details columns: one object per row of 'log', alig |
| 610-647 | 38 | phase-id | P132. The table the 'rbg' spend rule follows (resolveSpendTarget, opti |
| 695-703 | 9 | history, date | Between two solves. With the job's spine (every plan year's wealth, sp |
| 746-756 | 11 | phase-id | P132. The rails the RULE reads along any log - a replayed Monte Carlo  |

**montecarlo/prng.js** - 12 blocks of 8+ lines, 144 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 30-38 | 9 | history, phase-id | AR(1) inflation defaults, fitted to HISTORICAL_RETURNS.inflation (BLS  |
| 42-50 | 9 | history | Correlation between a synthetic annual return draw and that year's inf |
| 77-91 | 15 | - | The one synthetic draw formula, shared by worker.js, mc_controller.js  |
| 144-156 | 13 | phase-id | International return at a record index, with the domestic-equity proxy |
| 177-187 | 11 | history, measurement | Memo for scoreStartYears, keyed by window length. Cleared only by a pa |
| 190-201 | 12 | - | Score every start index that has a full 'sLen' years of REAL record af |
| 228-239 | 12 | - | Which historical start years the stress pass runs, for a given mode. |
| 286-293 | 8 | history | The minimum real CAGR over any rolling 'w'-year stretch INSIDE this sc |
| 306-320 | 15 | history | Deterministic SoRR stress bank: one path per selected historical start |
| 422-437 | 16 | history, measurement | Outcome class for one stress scenario, used for both the chart line co |
| 443-458 | 16 | history | The opening lengths the bear-start overlay draws from, and how many wo |
| 523-530 | 8 | - | Multi-asset block bootstrap: synchronized draws from equity, bonds, in |

**montecarlo/mc_engine.js** - 5 blocks of 8+ lines, 57 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 1-16 | 16 | history, phase-id | The Monte Carlo engine: ONE implementation of the run, shared by the W |
| 39-46 | 8 | - | THE survival test: a year is ruined when its year-end portfolio cannot |
| 109-117 | 9 | history, phase-id | ── P69 replay: transport for one path's draws ──────────────────────── |
| 165-177 | 13 | - | Ranks every path of one variation on ONE whole-run outcome and returns |
| 200-210 | 11 | history | Builds the return and inflation banks for one mode, plus the headline  |

**montecarlo/mc_controller.js** - 2 blocks of 8+ lines, 32 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 93-108 | 16 | history, measurement | ---- Throughput tracking (for time estimates) ------------------------ |
| 122-137 | 16 | measurement | Fold one completed run into the model. wallMs is the caller's whole ro |

**taxengine.js** - 13 blocks of 8+ lines, 245 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 24-47 | 24 | history, measurement | WHERE NIIT ACTUALLY BITES, and it is not where the old comments here g |
| 142-198 | 57 | version, measurement, todo | ────────────────────────────────────────────────────────────────────── |
| 1039-1046 | 8 | - | ────────────────────────────────────────────────────────────────────── |
| 1070-1085 | 16 | history, measurement | Federal Poverty Level. Not an IRS table: HHS publishes these each Janu |
| 1098-1105 | 8 | history, phase-id, measurement | P64d. BOTH of these are 2025 BASE figures that the statute steps up 1% |
| 1162-1175 | 14 | - | Find the income limit for a specified marginal tax rate within tax bra |
| 1198-1205 | 8 | history | Below every bracket's lower bound. The band runs up to the first brack |
| 1220-1237 | 18 | - | Calculate progressive tax on a given amount using tax brackets from TA |
| 1396-1421 | 26 | phase-id | P87c. The inverse of the line above, in the one direction a ceiling-fi |
| 1436-1445 | 10 | history | Bisect until the interval is settled to half a cent, NOT for a fixed c |
| 1453-1483 | 31 | - | Calculates Federal, State, Capital Gains, NIIT, and IRMAA taxes. |
| 1663-1676 | 14 | - | MARGINAL surtax on the NEXT dollar, by income type. The optimizer's wi |
| 1772-1782 | 11 | history, phase-id | Returns the CPI-adjusted per-person annual QCD limit. |

**taxPaymentPlanner.js** - 18 blocks of 8+ lines, 280 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 1-105 | 105 | history, missing file | taxPaymentPlanner.js — v5 |
| 140-147 | 8 | history | ── Replacing the withheld amount after a Roth conversion ───────────── |
| 159-167 | 9 | history | ── Authorities behind the rules this planner applies ───────────────── |
| 528-535 | 8 | - | ── Business-day arithmetic ─────────────────────────────────────────── |
| 647-660 | 14 | phase-id | IRC 6654(g)(1) credits withholding as if an equal part were paid on ea |
| 737-744 | 8 | history | Day targets. Base is the 15th in every month, nudged forward off weeke |
| 834-843 | 10 | - | appreciationPct is a FRACTION OF VALUE — what share of the brokerage p |
| 853-861 | 9 | history, phase-id | 2. Per-IRA ordering rules |
| 911-926 | 16 | - | 5. Conversion withholding setup — draw-first for ALL plans. |
| 937-946 | 10 | history | Should the withheld W be replaced from outside cash? |
| 1150-1160 | 11 | - | Required annual payment, IRC 6654(d)(1)(B): the LESSER of 90% of this  |
| 1169-1178 | 10 | - | Gap fill — applies to ALL plans. |
| 1181-1191 | 11 | history, measurement | WITHHOLDING COMES OUT OF THE DISTRIBUTION, so it can never exceed the  |
| 1266-1274 | 9 | history | 10b. Does withholding ALONE make each schedule timely? |
| 1714-1723 | 10 | history | RMD groups use the day from resolveIraOrdering (may be day 1 for same- |
| 1832-1843 | 12 | history | ── Shortfall quarterly estimates ───────────────────────────────────── |
| 2256-2267 | 12 | - | ── OC Analysis ─────────────────────────────────────────────────────── |
| 2424-2431 | 8 | phase-id | ── Plain text output ───────────────────────────────────────────────── |

**feedback.js** - 2 blocks of 8+ lines, 32 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 1-23 | 23 | - | feedback.js - the "Send feedback" dialog. |
| 679-687 | 9 | history | The whole page, top to bottom, drawn from the page itself rather than  |

**doclinks.js** - 2 blocks of 8+ lines, 31 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 1-22 | 22 | history, missing file | doclinks.js - bridges the gap between the .md files on disk and the .h |
| 60-68 | 9 | history | A link whose visible text IS the filename has to be relabelled with th |

**displayhelpers.js** - 1 blocks of 8+ lines, 12 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 26-37 | 12 | history, phase-id, measurement | P92e. A SHORT dollar for places that show several amounts side by side |

**retirement_optimizer.html** - 2 blocks of 8+ lines, 33 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 1227-1243 | 17 | - | The Version stat reads the number back out of the &lt;title> tag rather t |
| 1873-1888 | 16 | history, version | ── The test tiers, after first paint ───────────────────────────────── |

**RetirementTaxPlanner.html** - 2 blocks of 8+ lines, 62 lines

| Lines | Size | Markers | Opens with |
|---|---|---|---|
| 823-834 | 12 | history, phase-id, measurement | P57. This panel used to be a SECOND model of the decision the engine m |
| 1014-1063 | 50 | - | ── URL parameter support ───────────────────────────────────────────── |


## Appendix B. Method notes

- Mutation operators: relational swap (`<`/`<=`, `>`/`>=`), equality flip, `&&`/`||` swap, arithmetic swap (`+`/`-`, `*`/`/`), numeric literal +10% (or n+1 below 10, 0/1 flip), boolean flip, `Math.min`/`Math.max` swap, `if` condition negation, deletion of a single-line assignment or call statement. Lines containing `console.*`, `throw`, `assert` were not mutated. Every mutant was syntax-checked before use (40 sampled per file, 0 failures).
- The full node suite takes 16.7 s; the seven tests slower than 0.5 s (13.6 s of it) were skipped during the `optimizer_core.js` run so that 5,011 mutants could be tested (~0.7 s each across 10 sandboxes). They were kept in the `rails_engine.js` run, which is what they test. A mutant "survived" only if every test that ran passed and the suite ran to completion.
- Clone detection normalizes whitespace, strips comments, and for the "abstract" pass replaces identifiers with `$`, numbers with `#` and strings with `S`; a clone is 6 (exact) or 8 (abstract) consecutive matching lines, and only runs of 8 / 12 or more are reported.
- The tools, their configs and the raw outputs are in `.planning/code-quality-review/` (`tools/`, `cfg/`, `out/`, with the mutation records compressed); its README says what each file is. No page, script or suite loads any of it. Nothing else in the repository was modified by the review; the mutation sandboxes were copies under `%TEMP%`.

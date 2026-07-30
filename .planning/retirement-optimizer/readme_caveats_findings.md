# README Caveats Audit — deferred backlog

Produced by a separate read-only session (2026-07-30) that was asked which additional
Caveats/Restrictions belong in README's **What the Tool IGNORES (No Plans to Implement)** and
**Limitations and Restrictions** sections. That session never wrote its deliverable into this
worktree, so this file preserves it. Line numbers for README refer to the file **before** README
Audit Round 3 edited it; re-locate by text, not by number.

**Status: DEFERRED by the user on 2026-07-30** ("corrections only, defer caveats"). The corrections
half is done; everything below is the backlog.

**Spot-checked before accepting** (5 of the citations, in this worktree): `grep -c comp_
optimizer_core.js` returns 0; `multiAssetBank` is where claimed in `montecarlo/mc_controller.js`;
`optimizer_core.js:1402` floors capital gains at 0; `RMD_TABLE` in `taxengine.js:975` is
self-labeled "Simplified" and starts at 72; the 13 unmodeled states match an independent
enumeration of `TAXData`.

---

## A. Five items the user suspected — verdicts

| # | Suspicion | Verdict |
|---|---|---|
| 1 | Not applicable under 59.5 | **Confirmed, under-documented.** README mentions it in passing; the harder facts are missing. |
| 2 | Itemized deductions ignored | **Already covered.** No action. |
| 3 | SS start tied to birth month | **Confirmed and worse than stated** — see A3. |
| 4 | Asset allocation does nothing | **Mostly confirmed** — correct but incomplete, and the in-app disclosure is buried. |
| 5 | Which states unmodeled / known-wrong | **Not documented at all. Biggest gap.** |

### A1. Under 59.5

- No 10% early-distribution penalty modeled anywhere (`optimizer_core.js`, `optimizer_ui.js`,
  `taxengine.js` all clean).
- No Roth 5-year rule; `optimizer_text.js:26` merges Roth funds into one account, which structurally
  precludes per-conversion seasoning.
- `birthyear1`/`birthyear2` (`retirement_optimizer.html:198,218`) and `die1`/`die2` (`:200,220`) have
  **no min/max/step and no JS validation**.
- Only guard is a soft banner (`retirement_optimizer.html:206`, rendered `:208-210`) firing on
  `0 < startAge < 60` — threshold 60, not 59.5 — and it **never fires if Retirement Start Age is
  blank**, because that defaults to current age (`optimizer_ui.js:379`).
- The withdrawal engine has no age gate at all: IRA/Roth draws behave identically at 55 and 75.
- Ages are integer year-subtractions (`optimizer_core.js:959-960`); no half-year concept.

### A2. Itemized deductions

Already covered in **What the Tool IGNORES**. No change needed.

### A3. Social Security timing

- Birth month **is** used in three places: claim-year proration `(12-bm)/12`
  (`optimizer_core.js:535-539`, applied `:1028-1033`), survivor first-year/death-year blending
  (`:1061,1065,1085,1091-1094`), and QCD 70.5 eligibility (`taxengine.js:1512-1514`).
- **Default birth month is December**, paying $0 in the claim year by design
  (`optimizer_core.js:524-528`); a falsy month coerces to 12 (`optimizer_ui.js:315,318`;
  `optimizer_core.js:2216,2218`). A user who never touches the field gets a full-year SS delay they
  did not ask for.
- **Bigger undocumented item: no SSA actuarial reduction or delayed-retirement credit is applied to
  each person's own benefit.** `optimizer_core.js:1032-1033` takes `inputs.ss1` verbatim once
  `age >= ss1Age`, so changing the claim age 62 -> 70 changes only *when* payments start, never the
  amount. The entered figure is implicitly "the benefit at whatever age you typed"
  (tooltip `retirement_optimizer.html:325`).
- The model is **asymmetric**: real FRA/reduction/credit math exists but is used **only** for
  survivor benefits — `optimizer_core.js:552-599` (8%/yr credits `:570`; 5/9 then 5/12 of 1%
  reductions `:573-575`; 28.5% max survivor reduction `:591-595`; `fraMonthsForBirthYear` `:499-514`).
- `ss1Age`/`ss2Age` (`retirement_optimizer.html:326,333`) have no min/max; nothing blocks 45 or 85.
- Entered SS is treated as **today's dollars** and CPI-inflated forward to the claim year
  (`optimizer_core.js:1032`, `:2190`, `:2226-2227`), so it is not the nominal amount received.
- The 2033 trust-fund cut is a **cliff, not a phase-in**, applied on top of the COLA'd amount
  (`optimizer_core.js:1025,1032-1033,1067`; inputs `retirement_optimizer.html:375-376`).

### A4. Account Composition / asset allocation

- Inputs `retirement_optimizer.html:243-313` — `comp_{IRA1,IRA2,Brokerage,Roth1,Roth2}_ratio` +
  `_intl`. **There is no Cash row.**
- Consumed in exactly three places:
  1. `montecarlo/mc_controller.js:222-241` and `montecarlo/worker.js:141-160` build
     `returnSequencePerAccount`, **gated on `(mode === 'bootstrap' || mode === 'stress') &&
     multiAssetBank`** — so composition is ignored in **Synthetic/GBM Monte Carlo too**.
  2. `optimizer_core.js:735-748` falls back to `inputs.growth` whenever that is absent.
  3. `retirement_optimizer.html:1010-1038` — the read-only "Est.Rtn" cell, display only.
- `grep "comp_" optimizer_core.js` returns nothing: zero effect on the deterministic projection.
- They **are** persisted in the share URL (`optimizer_ui.js:3704-3708`) and saved scenarios, which
  reinforces the impression they matter.
- Only in-app disclosure is one sentence buried in the Documentation tab
  (`retirement_optimizer.html:764`). Nothing next to the control.

*(Partially addressed: README Audit Round 3 corrected the "WILL affect the Monte Carlo" sentence to
name Historical-only. The buried-disclosure and no-Cash-row points remain.)*

### A5. State tax coverage — largest gap

- **38 of 51 jurisdictions modeled** (37 states + DC). Engine summary `taxengine.js:105-149`; data
  `:155-924`; no-tax shells `:946-955`; dropdown `optimizer_ui.js:4494-4513`.
- **NOT modeled (13): AR, DE, HI, KS, LA, MO, NJ, NM, OK, RI, UT, VT, WV.** The engine's own table
  (`:130-140`) flags AR, MO, NJ, NM, RI, VT, WV as SS-taxing — the residents most exposed to the
  torpedo cannot model it. **README's own Tax Torpedo table lists NM, RI, UT and VT as SS-taxing
  states the tool cannot model.** Call that contradiction out.
- **No NOTE at all** for ID (`:262`), OR (`:492`), DC (`:573`), ND (`:813`) despite real gaps (OR has
  an $8k+ retiree credit; ND has fixed brackets).
- **No local/city income tax anywhere in the engine.** MD (`:381`) and IN (`:691`) admit it in their
  NOTE. **Unflagged: NYC/Yonkers (~3.1-3.9%), Ohio municipal + school district (1-3%), PA local EIT
  incl. Philadelphia wage tax, Michigan city taxes (Detroit), MO (KC/St. Louis).** NYC is the largest
  unacknowledged understatement.
- **State SS taxation is a flat scalar**: `stateTaxableSS = totalSS * (stateData.SSTaxation || 0)`
  (`taxengine.js:1330`) — no threshold, no provisional-income formula, no phase-in. Only three states
  nonzero, all self-declared approximations: CT 0.25 (`:189`), MN 0.85 (`:767`), MT 0.85 (`:795`).
- **Bracket indexing diverges from real law, unflagged, in 6 states**: MD (`:378`), VA (`:536`),
  CT (`:185`), MS (`:310`), DC (`:573`), NY (`:446`) have statutory/fixed thresholds but the model
  inflates them. The engine's own comment block (`:142-144`) undercounts for the same reason.
- **Dead data:** MD's `CAPITAL_GAINS` 2% surtax block (`taxengine.js:384-387`) is never read; all
  consumers use `TAXData.FEDERAL.CAPITAL_GAINS` (`taxengine.js:1404`,
  `optimizer_core.js:618,633,1294`). No state gets preferential or penalty cap-gains treatment.
- **No AMT, no state credits, no credit phaseouts** in any state.
- Per-state self-declared direction of error, usable verbatim: **overstates tax** — CA, GA, MA, MI,
  NY, NC, VA, NE, AL, AZ, ME, MN, MT, SC; **understates tax** — CT, IL, MD, IN, WI.
- WI is the only state still on `YEAR: 2025` (`taxengine.js:902`), while `TAX_DATA_BASE_YEAR = 2025`
  (`optimizer_ui.js:4516`) conflicts with nearly every state carrying `YEAR: 2026`.
- *(Already fixed by Round 3: the FEDERAL-standard-deduction list now reads AZ, CO, IA, ME, MN, MS,
  ND, SC. The AL/MT/OH wrongly-inflated-fixed-deduction claim was re-verified as still correct —
  bug site `taxengine.js:1349-1352`, `INFLATION_INDEXED` consulted only in `calculateProgressive`
  at `:1088-1089`.)*

---

## B. Additional caveats the user did not list

1. **RMD table is Uniform Lifetime only and abridged** — `taxengine.js:975-988`, ages 72-120;
   `optimizer_core.js:60` clamps >120. No Joint Life and Last Survivor table for a spouse more than
   10 years younger (noted at `optimizer_text.js:24` but not in README), no inherited/10-year tables.
2. **RMD start age hardcoded 75 if born >= 1960 else 73** (`optimizer_core.js:56`, dup `:2087`,
   `optimizer_ui.js:424,2912`). Silently assigns 73 to anyone born <= 1950 whose real age was 70.5 or
   72, and ignores the SECURE 2.0 birth-year-1959 ambiguity.
3. **No Qualifying Surviving Spouse window.** `optimizer_core.js:961-971`: MFJ persists through the
   year the decedent's age equals their life-expectancy input, Single starts the next year. The real
   2-year QSS MFJ-rate window is not modeled.
4. **Dividends assumed 100% qualified** — `optimizer_core.js:1137` passes everything as
   `qualifiedDiv`; `ordDivInterest` is never supplied and defaults to 0 (`taxengine.js:1271`). Cash
   interest is correctly ordinary (`:1417`).
5. **No capital losses, ever** — `optimizer_core.js:1402` floors capital gains at 0. No carryforward,
   no $3,000 ordinary offset, no tax-loss harvesting. (Cycle Brokerage harvests *gains*, `:1274-1316`.)
6. **Brokerage basis is a single pooled proportional pool** — `optimizer_core.js:152-182`,
   `:1245-1246`. No lots, no specific-ID, no holding-period split, **no step-up in basis at death**.
7. **ACA models the MAGI cap only, never subsidy dollars** — `optimizer_core.js:667-670`, hardcoded
   2025 FPL ($20,440 MFJ / $15,060 single) inflated by CPI. No premium tax credit is ever computed.
8. **Medicare premiums are flat national 2026 figures** — `standardPartB 202.90` /
   `standardPartD 38.99` (`taxengine.js:72-73`), applied `optimizer_core.js:986`, inflated at
   `cpi + medicare increment` (`:2192,2229`). No plan-specific premiums, no Medigap, no Part B
   late-enrollment penalty. IRMAA correctly uses the 2-year MAGI lookback (`:978`).
9. **NIIT thresholds are not inflation-indexed** (matches real law, but worth stating) —
   `taxengine.js:1410-1419`, thresholds `:7-16`.
10. **State of residence is fixed for the whole plan** — one `#STATEname` select
    (`retirement_optimizer.html:368`), `STATEname` set once per `simulate()` (`optimizer_core.js:30`).
    README asks "How different might things look if I move to another state?" without saying the move
    cannot be mid-plan.
11. **No healthcare or long-term-care costs of any kind.** Only Medicare. No pre-65 premium input, no
    LTC, no lumpy medical spend.
12. **No mortgage or property-tax inputs** — must be folded into the single After-Tax Spend figure.
13. **Life expectancy is a hard deterministic input** (`die1` default 88, `die2` default 98 —
    `retirement_optimizer.html:200,220`). **Monte Carlo varies returns and inflation only, never
    mortality.**
14. **Engine runs entirely in nominal/future dollars**; "Current $" is a display-layer restatement
    (`optimizer_ui.js:1273,2325,3298`). Growth must be entered nominal, with inflation NOT
    pre-subtracted. Documented in-app (`retirement_optimizer.html:770-772`), not in README.
15. **Fed Tax Creep touches federal ordinary bracket *rates* only.** README already says this; keep it.
16. **Per-account return asymmetry inside the single growth rate**: IRA/Roth effective return is
    `growth + dividendRate`, Brokerage gets bare `growth` (its dividends are split out to cash/DRIP),
    Cash gets `cashYield` (`optimizer_core.js:735-748`, comment `:917`). Not a bug, but "one growth
    rate for all accounts" is not literally true.

---

## C. Features thin or absent in the README feature list

- **RetirementTaxPlanner handoff mechanics.** Trigger: `year` or `totalTax` cell click
  (`optimizer_ui.js:2303-2309`); builder `openTaxPlanner()` `:2399-2461`, ending in
  `window.open('RetirementTaxPlanner.html?…','_blank')` — new tab, relative URL, works from `file://`.
  Passes ~25 fields including `priorYearFedTax/StateTax`, per-IRA RMD/voluntary/conversion splits,
  `marginalOrdRate`, brokerage value+basis, blended LTCG rate, the 110% safe-harbor flag, `state`,
  `portfolioRate`, `hysaGross`. **Not passed:** IRMAA/Medicare amounts, QCDs, Roth balances, Cash
  balance, spend goal, CPI, filing status (re-derived), the "already done" checkboxes. **No version
  handshake** — unknown keys are silently dropped (`RetirementTaxPlanner.html:1024`).
- **Stress Test stat tile** — *(added by Round 3)*.
- **Future $ / Current $ toggle** (`retirement_optimizer.html:443-448`).
- **QCD support** (`qcdHHMax`, `qcdAlways` = Always vs As-Needed-to-drop-IRMAA-tiers; engine
  `optimizer_core.js:74-111`). README discusses QCDs conceptually but never says the tool models them.
- **Guyton-Klinger guardrails** (`gkGuard`/`gkAdjPct`, `retirement_optimizer.html:131-133`) —
  *(added by Round 3; README previously praised NestWise for having them)*.
- **Cyclic brokerage gain harvesting** (`cyclicEnabled`, `cycleLTCGTarget`, `:173-186`) —
  *(added by Round 3)*.
- **Marginal Heirs Tax Rate input** (`:395`) used for after-tax terminal scoring.
- **Milestones overlay on the Balances chart** (RMD start, first death, shortfalls, GK cuts, IRMAA
  tier jumps, break-even year — `:875-878`). README mentions only RMD markers.
- **Monte Carlo Input Distributions charts** (`:579-592`), percentile band chart, stress-sequence
  count, bear-start overlay.
- **Nerd-knob gating** — `?nerdknob` URL param or an unlabeled checkbox at the bottom of the
  Documentation tab (`retirement_optimizer.html:797-801`; `optimizer_ui.js:72-100`). Gates the MC
  advanced panel, Synthetic mode, ACA Cliff options, GK params, Cycle LTCG target, Avg BETR stat, and
  the optimizer's cash-funded-tax sweep. **Nothing in README says advanced controls are hidden or how
  to reveal them.**
- **"Optimize for" has 9 objectives** — *(fixed by Round 3)*.
- **Documentation tab self-test indicator** (`#testsFailed` 🟢/🔴, `retirement_optimizer.html:454`).
- **Share URL omits fields still at default** (`captureDefaults`, `optimizer_ui.js:3730-3742`) and
  honours `data-no-share`, so a shared URL is not a full snapshot.

---

## D. Corrections to existing README text — all resolved

| Item | Status |
|---|---|
| FEDERAL-std list should add IA and MS | **DONE** (Round 3) |
| "(The *Cash Reserve* is ignored currently)" is stale | **DONE** (Round 3) |
| Account Composition affects Historical MC only, not Synthetic/GBM | **DONE** (this pass) |
| "Optimize for" listed 4 of 9 objectives | **DONE** (Round 3) |
| Duplicate two-Roth-balances sentence | **DONE** (this pass, trimmed from Limitations) |

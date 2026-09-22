
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

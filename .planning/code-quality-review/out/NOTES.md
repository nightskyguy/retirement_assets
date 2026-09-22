# Running notes (verified facts only)

## Setup
- HEAD == main == origin/main = f6783e6 (2026-09-21). Worktree boldin-tax-estimation-767848, branch worktrees/code-quality-analysis-5ab684.
- 20 reader agents launched 00:12, ALL died ~00:19 on the account spend limit. Partial files: agents/C03,C06,C08,C09,C10 (small).
- Strategy after reset: mechanical scans + mutation testing locally; few/no agents.

## Inventory (tools/inventory.js -> out/inventory_summary.tsv)
- optimizer_core.js: 7320 lines, 3429 code, 3435 comment-only (50.0%), 671 blocks, 125 blocks >= 8 lines (2199 lines = 64% of comment lines)
- optimizer_ui.js: 9538 lines, 6176 code, 2752 comment-only (30.8%), 68 blocks >= 8
- mc_tab.js 30.5%, prng.js 44.9%, mc_controller 42.6%, rails_engine 35.6%, mc_engine 31.0%, taxengine 27.2%, TPP 21.5%
- tests: optimizer_core.tests.js 9754 lines, 2458 comment-only (27%)

## Suites (baseline, all green)
- optimizer_core 486 tests 16.7 s; 7 tests = 13.6 s of it (P128n 5.0s, breakEvenHeirsRate monotonic 2.6s, P129 2.3s, P128 cadence 1.4s, P132 spine 1.0s, P132 presets 0.7s, P128 floor 0.6s)
- taxengine 32 tests 13 ms; taxPaymentPlanner 61 tests 0.66 s; doclinks 27 tests 15 ms; feedback 46 tests 51 ms
- TestTiers.EXPECTED: { optimizer_core: 486, taxengine: 32, taxPaymentPlanner: 61, doclinks: 27, feedback: 46, slowInCore: 4 } (optimizer_tests.js:3603)
- CLAUDE.md says "three slow tests"/ARCHITECTURE says 3 tagged; actual test.slow count = 4 (grep). ARCHITECTURE.md test counts (245/265/513) are stale.

## Comments (tools/commentscan.js -> out/comment_summary.tsv, comment_detail.json)
- Line-number cites in comments: 15 cites checked, 0 still point at the cited code.
  e.g. tests :9044 cites optimizer_core.js:928 (yr.loopStart) -> now :1483; :2381 -> :4706; :1739 -> :3522. ARCHITECTURE.md repeats the same three.
  optimizer_core.js:2251 cites (:1226); :3444 cites (:1793); :3469 cites (:1504, :1638, :1753) - all wrong now.
- Comments naming files that no longer exist: acamagi_harness.js (core:1085-1111), rmdbasis_harness.js (core:1448-1474), ceilded_harness.js (core:1998-2024),
  harvestceil_harness.js (core:2741-2763, tests:2482), ltcgroom_harness.js (core:2773-2800), growthcredit_check.js (core:4325-4364, 4400-4459), extraconv_magi_harness.js (tests:4440-4454),
  scripts/validate_palette.js (standalone/RealReturns.html:389)
- Comments naming identifiers that exist nowhere in code: startMonth (core:1448-1474), _stratImpliesConversion (core:1536-1562), unifiedConvRouting (core:3759-3765)
- BROKEN: optimizer_core.tests.js:7404-7408 orphaned "Runner" header, sentence cut off mid-way ("a tag must never be"); real runner is at :9037.
- BROKEN: taxengine.js IRMAA.ANNUAL_INCREASE: 0.056 "// based on analysis of " (truncated)

## Duplication (tools/clones.js -> out/clones_*.json)
- Retirement_Projection.html:16-70 embeds a full copy of TAXData.FEDERAL + IRMAA ("Inline fallback ... Keep in sync with taxengine.js"). Values match taxengine.js today (2026). Loads taxengine.js?v=1115c9 (stale token).
- Share panel code (toggleSharePanel/copyShareURL) copied in 6 places: optimizer_ui.js:7193-7217, RetirementTaxPlanner.html:664-695, Retirement_Projection.html:2132-2157, standalone/IncomeTaxPlanner.html:1364-1382, HYSA.html:644-652, RealReturns.html:1008-1016
- standalone/AfterTaxRealGrowth.html <-> FutureCost.html share ~150 lines of CSS (34u+18u+14u+14u+13u+10u+10u+9u+9u+8u+8u)
- HYSA.html:629-666 <-> RealReturns.html:993-1030 share 28 units of share-URL JS
- optimizer_core.js: tax recompute block repeated 3x: 3346-3355, 3465-3480, 3504-3513 (yr.capitalGains = ... calculateTaxes({...}))
- harness clones: 88 cross-file pairs, 1112 duplicated units (COMMON block etc.; already known as P112c/P116)

## UK English (tools/ukscan.js -> out/uk_hits.tsv)
- 990 raw hits: S=348 (clear UK spelling), I=170 (idiom), V=472 (UK-leaning variant, mostly "towards/backwards/afterwards")
- top S: labelled 49, greyed/greys/grey/greying 71, cancelled 23, modelled/modelling 32, behaviour 17, neighbour* 21, colour* 16, honour* 14, centre* 10
- user-facing: "the other way round" x9 in retirement_optimizer.html/README; "tick/untick/ticked" x8; "greys out" x6; "labelled" in changelog; taxPaymentPlanner.js strings "minimise" x2, "realises"; optimizer_ui.js "Import cancelled." x2

## Verified extra findings (2026-09-21 ~04:30)
- FPL DATA LABEL BUG: taxengine.js:1086-1092 TAXData.FPL says GUIDELINE_YEAR 2025 / PLAN_YEAR 2026 but MFJ 20440 / SGL 15060 are the HHS **2024** guidelines
  (HHS prior-years table: 2024 = 15,060 + 5,380/person; 2025 = 15,650 + 5,500 -> 2-person 21,150; 2026 = 15,960 + 5,680 -> 21,640).
  Engine ages it: optimizer_core.js:1040 limit = fplBase * mult/100 * cpiRate * (1 + inputs.cpi) - 1  -> 400% MFJ = ~$84,049 at 2.8% CPI vs true $84,600 for 2026 coverage.
  UI repeats the same aging: optimizer_ui.js:9058 (with `|| 2.8` CPI fallback) and :9493.
- Dead functions (git grep: definition only): getEffectiveTaxRate optimizer_core.js:489-505; sumAccounts optimizer_core.js:769-771; deltaRefDescription optimizer_ui.js:449-454;
  exportAllScenarios optimizer_ui.js:8401-8424; effectiveStd Retirement_Projection.html:1027-1030; showToast Retirement_Projection.html:2163-2170; fmtDiff standalone/HYSA.html:299
- copyShareURL identical (sim=1.0) in 7 files; toggleSharePanel in 7 files; escapeHtml in optimizer_ui.js:7473 AND montecarlo/mc_tab.js:2762 (global collision, later script wins);
  updateStateNote retirement_optimizer.html:1749-1765 vs Retirement_Projection.html:2216-2231 (sim .89)
- RMD start-age rule `birthYear >= 1960 ? 75 : 73` written 4x: optimizer_core.js:83, :4650; optimizer_ui.js:919, :4344
- gkGuard 0.20 / gkAdjPct 0.10 defaults written at core:2078-2079, :5638, :6158(x4); ui:783-784, :6943; html value="20"/"10"
- $25,000 conversion step: const STEP = 25000 at core:6441 AND :6498, plus 6 inline 25000 in bestTimeLimitedConversion :6619-6623
- 0.01 dollar epsilon x10 in performWithdrawal (core:509-623); iteration caps 3 (569, 615, 3844), 6 (3486, 3555, 5702), 200 (3486), 40 (taxengine:1446), 80 (rails:270)
- success tolerance 0.99 in engine (core:4670) duplicated in UI (ui:3556); milestone 'short' marker uses a DIFFERENT threshold 0.90 (ui:4371)
- MIN_SPEND max(500, 2% of goal) at core:5591 and again ui:1600
- CPI fallback `|| 2.8` x4 in optimizer_ui.js (8612, 8809, 9058, 9361); growth fallback 0.06 at core:4644 and ui:914
- $150,000 safe-harbor AGI: taxPaymentPlanner.js:1138 (const inside function) + :326/:410/:428 state rows + optimizer_ui.js:3762 `MAGI > 150000`
- MC defaults: seed `?? 42` x4 (mc_engine:309,675; rails_engine:186; mc_controller:157), stressCount `?? 20` x2, stress window/count default 10 written 8x in prng.js, startYear `?? 2026` mc_engine:422 + 5 sites in mc_tab.js
- Strategy keys are bare strings compared in 4 files: 'bracket' 23x, 'rbg' 20x, 'gk' 18x, 'aca' 15x, 'fixedpct' 10x, 'ordered' 9, 'fixed' 9, 'split' 9, 'propwd' 8; MC modes 'bootstrap' 9, 'aam' 8, 'stress' 10
- Pure engine functions tested ONLY in the browser suite (never by the pre-commit hook): calculateWithdrawals 14, applyWithdrawals 10, combineGains 9, calculateInflationAdjustedWithdrawal 10,
  calculateAmortizedWithdrawal 8, computeBETR 6, getRMDPercentage 3. calculateTaxableSocialSecurity: 1 direct call in core tests, 0 in taxengine.tests.js
- Docs stale: ARCHITECTURE.md "three node suites" (5), "513 tests", "245 tests ~55 ms blocking at page load" (now idle, 1247 asserts), "Ten [critical] exist" (26), "three tagged slow" (4), tier 2 "injected after first paint" (now ?runtests only);
  FILE_DIRECTORY.md lists 6 paths that do not exist (rmdbasis_harness.js, stopyear_harness.js, unifiedconv_harness.js, research/CONVERSION_ROUTING.md, research/RMD_BASIS.md, .planning/MERGE_PR182_IRMAA.md)
- optimizer_core.tests.js:149-151 comment: "Only three tests are tagged ... 1792 ms of this suite's ~2.9 s. The remaining 179 finish in well under a second" -> now 4 tagged, 486 tests, 16.7 s; 5 untagged tests take 0.6-2.3 s each
- Comment mass: production code 9,902 comment-only lines; 5,219 in blocks with a history marker; 4,432 in blocks >= 8 lines; 3,360 both
- Broken seam example: optimizer_core.js:4414-4417 inserted history sentence splits the original sentence; :4446-4449 says the same thing twice

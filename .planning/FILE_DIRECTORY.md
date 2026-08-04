# File Directory

What every file/directory in this repo is and how it's used. Update this when files are added,
renamed, or repurposed — it's a map, not a changelog (changelog-style history lives in
`.planning/NOTES.md`, `.planning/task_completed.md`, and `.planning/retirement-optimizer/progress.md`).

## Live tools (deployed to tools.netcitizen.us)

| File | What it is |
|---|---|
| `retirement_optimizer.html` | The main tool — withdrawal/conversion strategy optimizer, Monte Carlo, Annual Details. Loads `optimizer_core.js`, `optimizer_ui.js`, `optimizer_text.js`, `optimizer_tests.js`, `optimizer_styles_responsive.css`, `taxengine.js`, `displayhelpers.js`, `doclinks.js`, `other_tools.js`, and `montecarlo/*`. |
| `Retirement_Projection.html` | Simpler, chart-forward projection tool (2 IRAs, 1 Brokerage, 1 Cash, 1 Roth). Shares `taxengine.js` with the Optimizer. |
| `RetirementTaxPlanner.html` | Single-year "how do I actually pay this tax bill" planner (withholding vs. quarterly estimates vs. mixed). Opened by the Optimizer's Annual Details table (click a year or the `totalTax` column) with that year's numbers pre-filled. |
| `standalone/RealReturns.html` | Historical Real Returns — inflation-adjusted growth of $10k across equities/bonds/T-bills/gold/etc, 1928–2025. Uses `standalone/real_returns_data.js` and `montecarlo/historical_returns.js`. |
| `standalone/FutureCost.html` | Present value of a growing payment stream (IRMAA-surcharge use case). |
| `standalone/irmaa_and_rmds.html` | What IRA balance triggers which IRMAA tier at a given age. |
| `standalone/AfterTaxRealGrowth.html` | Real (inflation- and tax-adjusted) return across federal tax brackets. |
| `standalone/IncomeTaxPlanner.html` | Federal + state effective-tax-rate sweep across an income range, with IRMAA/NIIT/SS-torpedo curve. Shares `taxengine.js`. |
| `standalone/HYSA.html` | High-yield savings account real returns (annual + cumulative views). Live/current version. |

## Redirect stubs (root-level — NOT duplicates)

These root-level `.html` files are intentional **redirect stubs**, not stale copies. Several tools
were moved into `standalone/` (PR #107, 2026-07-04); these stubs exist at their old root-level URLs
so external links/bookmarks people already have keep working — each is a ~10-line page that does a
`<meta http-equiv="refresh">` + `window.location.replace()` to the real `standalone/` file, preserving
query string and hash. **Do not delete these** — they exist specifically for backward compatibility
with links already in the wild. If you edit a tool, edit the `standalone/` copy; the root stub never
needs touching unless the destination path changes.

| Stub | Redirects to |
|---|---|
| `AfterTaxRealGrowth.html` | `standalone/AfterTaxRealGrowth.html` |
| `FutureCost.html` | `standalone/FutureCost.html` |
| `IncomeTaxPlanner.html` | `standalone/IncomeTaxPlanner.html` |
| `irmaa_and_rmds.html` | `standalone/irmaa_and_rmds.html` |
| `standalone/HYSA_Real_Growth.html` | `standalone/HYSA.html` |
| `standalone/HYSA_v_Inflation.html` | `standalone/HYSA.html` |

(The last two are old pre-consolidation names for what's now the single `HYSA.html` two-tab tool —
same stub pattern, just within `standalone/` rather than at root.)

## Shared engine / support JS (loaded by multiple tools)

| File | What it is |
|---|---|
| `taxengine.js` | Shared Federal + state tax calculation engine (`TAXData`, `calculateProgressive`, IRMAA, NIIT, SS taxation, retirement-income exclusions). Used by the Optimizer, Retirement Projection, and Income Tax Planner. |
| `optimizer_core.js` | Pure simulation engine for the Optimizer — no DOM/localStorage access, so it's independently `node`-testable. Year-by-year withdrawal/conversion/tax simulation, optimizer sweep, Break-Even/Stop-Year diagnostics. |
| `optimizer_ui.js` | All DOM/chart/share-URL/scenario-persistence code for `retirement_optimizer.html`. Depends on `optimizer_core.js` + `taxengine.js` being loaded first; shares global scope (not a module). |
| `optimizer_text.js` | Long-form static content for the Optimizer's Documentation/How-to-Use tab. |
| `optimizer_styles_responsive.css` | Responsive/mobile layout CSS for the Optimizer. |
| `displayhelpers.js` | Shared numeric-input parsing/formatting + tooltip helpers, used across multiple tools. |
| `other_tools.js` | Shared "Other Tools" cross-link widget (the `TOOLS` list) rendered on multiple pages so each tool can link to the others. |
| `doclinks.js` | Rewrites `.md` hrefs to the `.html` pages GitHub Pages/Jekyll generates from them, but only when the page is served from a non-local origin, so `file://` and localhost keep opening the real files. Also decorates the Jekyll-rendered doc pages (mermaid captions, back link). |
| `montecarlo/mc_controller.js` | Main-thread interface to the Monte Carlo run — dispatches to a Web Worker on `http(s)://`, falls back to chunked async on `file://`. |
| `montecarlo/mc_tab.js` | Monte Carlo tab UI controller (charts, tables, strategy selection) in the Optimizer. |
| `montecarlo/worker.js` | The actual Web Worker: runs all strategy variations against a shared Common-Random-Numbers scenario bank, posts progress + final results. |
| `montecarlo/prng.js` | Seeded PRNG (mulberry32) + Box-Muller normal sampling used by the Synthetic (GBM) Monte Carlo mode. |
| `montecarlo/stats.js` | Per-year percentile-band statistics (p5/p25/p50/p75/p95) for Monte Carlo fan charts. |
| `montecarlo/historical_returns.js` | Historical annual return/inflation data (Damodaran, MSCI, BLS CPI-U, 1928–2025) backing the Historical Monte Carlo mode and `standalone/RealReturns.html`. |
| `standalone/real_returns_data.js` | US T-bill historical annual returns (1928–2025), Damodaran source — data-only, used by `standalone/RealReturns.html`. |

## Tests

| File | What it is |
|---|---|
| `optimizer_core.test.js` | Main `node`-run test suite for `optimizer_core.js` (run with `node optimizer_core.test.js`). |
| `optimizer_tests.js` | Older/legacy in-browser unit test runner for the Optimizer. |
| `doclinks.test.js` | `node`-run test suite for `doclinks.js` (run with `node doclinks.test.js`) — the `docHref()` mapping table. |
| `taxPaymentPlanner.js` / `taxPaymentPlanner.test.js` | Standalone tax-payment-strategy engine (dual-IRA withholding optimizer) behind `RetirementTaxPlanner.html`, plus its `node` test suite. |
| `.test_harnesses/betr_harness.js` | `node` investigative script — checks whether the displayed Break-Even Tax Rate (BETR) is trustworthy vs. an empirically-derived break-even rate. Not part of the regular suite; kept so the finding can be re-derived on demand. See `.test_harnesses/README.md`. |
| `.test_harnesses/stopyear_harness.js` | Browser-console investigative script — the research harness behind the Stop-Year feature (`bestConversionStopYear()` in `optimizer_core.js` is the production version). |
| `.test_harnesses/unifiedconv_harness.js` | `node` investigative script for P28 — models every voluntary IRA withdrawal as a Roth conversion across a 630-simulation grid. Findings live in `P28_RESULTS.md`. |
| `.test_harnesses/P28_RESULTS.md` | The P28 reference write-up: tables, reasoning, and the seven headline findings the harness produced. |
| `.test_harnesses/README.md` | Index for the harness directory, plus the rule for what belongs there vs. at the repo root (fixtures the suite needs stay at root). |
| `sweep_golden.js` | Characterization goldens for the **two** strategy enumerations — Monte Carlo's `buildVariations()` and the Optimizer's sweep in `_runOptimizerNow()`. Both now call the shared `buildStrategyFamilies()` in `optimizer_core.js`; the golden is what proved that extraction byte-identical. Data only, dual-mode export, read by `optimizer_core.test.js`. Recorded before the P35 PR 2 extraction so it can be shown to preserve behavior. |
| `sweep_golden.gen.js` | Regenerates the `MC_GOLDEN` half from source (`node sweep_golden.gen.js`). Run only for a **deliberate** `buildVariations()` change, then read the diff. |
| `sweep_golden.import.js` | Folds a browser capture into the `OPT_GOLDEN` half. The Optimizer's enumeration only runs in a live page, so that half is recorded, not generated — the capture recipe is in this file's header. |

## Docs (published by GitHub Pages at their `.html` URL)

| File | What it is |
|---|---|
| `README.md` | The site's landing page (`/`, not `README.html`) — what the tools are, who they are for, the tax-torpedo explainer, FAQ, and the modelling caveats. |
| `ARCHITECTURE.md` | Diagrams and file reference for `retirement_optimizer.html` and everything it loads: dependency graph, runtime data flow, `simulate()` pipeline, optimizer sweep, Monte Carlo, plus the rule for where a test file belongs. |
| `optimizer_changelog.md` | Full release history. The 5 newest entries are duplicated inline in `retirement_optimizer.html`; adding one there means dropping the sixth-oldest `<li>`, whose detail is already here. |

## Planning / notes (this directory)

| File | What it is |
|---|---|
| `.planning/retirement-optimizer/task_plan.md` | Current/open work — priority list, phase write-ups, status. Linked from the README's "Features in the Works" section. |
| `.planning/retirement-optimizer/progress.md` | Chronological session log — what was done, when, and why. |
| `.planning/retirement-optimizer/findings.md` | Investigation write-ups / evidence that informed decisions in `task_plan.md`. |
| `.planning/task_completed.md` | Archive of fully-completed phases (moved out of `task_plan.md` to keep it scannable). |
| `.planning/NOTES.md` | Older, more granular dev-session notes (pre-dates the `retirement-optimizer/` split). |
| `.planning/IRAprojection.spec.txt` | Original spec/requirements notes for the IRA projection logic. |
| `.planning/FILE_DIRECTORY.md` | This file. |

## Config / misc

| File | What it is |
|---|---|
| `CNAME` | GitHub Pages custom domain (`tools.netcitizen.us`). |
| `_includes/head-custom.html` | The one Jekyll customization hook used on this site. GitHub Pages renders every `.md` with the default `jekyll-theme-primer`, and that theme includes this file into the `<head>` of each rendered page: CSS for the mermaid/back-link decorations plus the `doclinks.js` tag. Underscore-prefixed, so Jekyll never serves it. There is no `_config.yml` on purpose, and **a `.nojekyll` file must never be added** — it would 404 every `.html` docs URL. |
| `CODEOWNERS` | GitHub review-routing config (currently just `* @nightskyguy`). |
| `LICENSE` | Repo license. |
| `.gitignore` | Ignores local-only/scratch files (`retirement_optimizer_longtext.js`, `removed_functions.js`, `v6i_retirementopt_styles.css`, `.claude/`, `netcitizen.us.*` — the domain/DNS notes file, which contains personal emails and should never be committed). |
| `.idea/` | JetBrains IDE project settings — not functionally part of the app. |
| `github_black_green_50x.png` | GitHub logo icon used in the README's top link. |

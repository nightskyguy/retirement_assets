# Development Notes

## 2026-05-23 — Monte Carlo tab (Session 6)

### What was done
- Added Monte Carlo simulation as a separate tab (`montecarlo/` module)
- New files: `prng.js` (mulberry32 + Box-Muller), `stats.js` (per-year percentiles), `worker.js` (Web Worker), `mc_controller.js` (main-thread interface), `mc_tab.js` (UI controller)
- 210 strategy variations (Proportional %, Fixed N-yrs, Fill Bracket, Fixed % IRA — each with/without max conversion)
- Common Random Numbers (CRN): all variations see identical market draws for fair comparison
- Failure criterion: `portfolioBalance < max(0, spendGoal − guaranteedIncome)` — replaces old 2× wealth gate
- Web Worker for non-blocking runs on http://; chunked async fallback for file://
- Post-run metrics bar: elapsed ms, median geometric return, fixed inflation rate
- Time estimate hint near Paths input (calibrated from prior run throughput)
- All MC controls hidden behind `NERD_KNOBS` flag (currently hardcoded ON)
- Chart: Chart.js filled-area bands (p5/p25/p50/p75/p95) per selected variation; solid-color tooltips

### Bugs fixed this session
- `SUCCESS_WEALTH_YEARS is not defined` in tests — removed constant, updated test to use new portfolio criterion
- `SecurityError` on file:// — added protocol check, falls back to main-thread simulation
- `SyntaxError: Identifier 'logDrift' has already been declared` (mc_controller.js:168) — duplicate `const` declaration in `_runMCMainThread` prevented entire file from loading, causing `estimateMCMs is not defined` on page load

### Still pending
- Commit and PR
- NERD_KNOBS URL-based activation (deferred)

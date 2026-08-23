// Monte Carlo tab — UI controller.
// Depends on: optimizer_core.js (buildVariations), optimizer_ui.js (getInputs),
//             montecarlo/mc_controller.js (runMCWorker, cancelMCWorker),
//             Chart.js (global Chart)

let _mcChart             = null;
let _mcStressChart       = null;
let _mcResults           = null;
let _legendIsolatedKey   = null;  // tracks legend click-to-isolate state (main chart)
let _legendIsolatedKeyStress = null; // same, for the stress chart (separate — charts render side by side)
let _mcSelected          = new Set(); // indices of variations currently on chart
let _mcStartYear         = 2026;      // cached from getInputs() at run time
let _lastMCHash          = null;
// The sweep-only half of that hash, captured at the same moment. The stale banner keys off this one
// so the two Stress Test controls, which the sweep no longer depends on, cannot raise it.
let _lastSweepHash       = null;
let _mcBase              = null;      // getInputs() snapshot captured at run time
// Index into _mcResults.variations of the row that IS the sidebar plan, or -1 when the exact plan
// is not among the swept strategies. Set once per run by renderMCResults; the survival table, the
// main chart and the plan headline all pin off this one value so they cannot disagree.
let _mcPinIdx            = -1;
// Variation indices in the order renderMCChart drew them (pinned plan first). The chart tooltip
// maps datasetIndex -> variation through this; it must not be re-derived from _mcSelected.
let _mcDrawOrder         = [];
let _inputEquityChart    = null;
let _inputInflationChart = null;

// --- Parameter reads ------------------------------------------------------

// Every numeric parameter on this tab used to be read as `parseInt(el?.value ?? '500')`. Two holes
// in that idiom, both of which shipped as bugs:
//   1. An <input type="number"> reports '' when the user clears it, and `??` only catches null and
//      undefined, so '' reached parseInt and came back NaN. updateMCTimeEstimate() runs on oninput,
//      so the run-size line painted "NaN paths x 144 strategies = NaN simulations" on the very next
//      keystroke, mid-edit.
//   2. The min/max attributes on a number input are advisory. A stress count typed above the number
//      of candidate start years used to walk off the end of the ranked list inside buildStressBank.
// One helper closes both: a non-finite read falls back to the default, and every read is clamped.
const MC_PARAMS = {
    'mc-num-paths':     { dflt: 500, min: 100, max: 5000 },
    'mc-mu':            { dflt: 7,   min: 0,   max: 20, int: false },
    'mc-sigma':         { dflt: 12,  min: 1,   max: 40, int: false },
    'mc-seed':          { dflt: 42,  min: 0,   max: Number.MAX_SAFE_INTEGER },
    // Upper bound is the whole historical record; buildStressBank caps it again at the number of
    // start years the chosen window actually leaves available. On the default Combined window this
    // is per window, so 20 produces a union of roughly 40 distinct start years.
    'mc-stress-count':  { dflt: 20,  min: 3,   max: 98 },
    'mc-bear-fraction': { dflt: 25,  min: 0,   max: 50, int: false },
    // Synthetic inflation. Defaults are the 1948-2025 CPI fit that prng.js ships; see the P23m
    // table in .planning/retirement-optimizer/findings.md for the fit and why that window.
    'mc-inflation-persistence':   { dflt: 0.67, min: 0,     max: 0.95, int: false },
    'mc-inflation-shock-sd':      { dflt: 2.1,  min: 0,     max: 10,   int: false },
    'mc-inflation-return-corr':   { dflt: -0.3, min: -0.95, max: 0.95, int: false },
};

// Clamped read of one MC parameter input, by element id. Ranges live in MC_PARAMS so the run, the
// hash and the time estimate cannot disagree about what a blank or out-of-range box means.
function _mcNum(id) {
    const spec = MC_PARAMS[id];
    if (!spec) return NaN;
    const raw = document.getElementById(id)?.value;
    const n   = (spec.int === false) ? parseFloat(raw) : parseInt(raw, 10);
    if (!Number.isFinite(n)) return spec.dflt;
    // Paths is normally floored at 100 so the survival rate and percentile bands stay meaningful.
    // In nerdknob or the ?montecarlo demo the whole point is to SEE small samples misbehave, so the
    // floor drops to 3 (the Experiment's smallest count is 5). Every other parameter keeps its spec.
    const lo = (id === 'mc-num-paths' && (_mcNerdMode() || _mcDemoMode())) ? 3 : spec.min;
    return Math.min(spec.max, Math.max(lo, n));
}

// --- Initialization -------------------------------------------------------

function initMCTab() {
    const btn = document.getElementById('btn-mc');
    if (!btn) return;
    btn.style.display = '';  // Tab always visible.

    // Show the Simulation Parameters panel only for nerdknob users.
    // Normal users: panel stays hidden and the tab click auto-runs.
    // The ?montecarlo demo exposes the same two panels as nerdknob (so a reader can see Seed, Paths
    // and the Input Distributions the Experiment drives), without unlocking the rest of nerd mode.
    const advanced = _mcNerdMode() || _mcDemoMode();
    const nerdPanel = document.getElementById('mc-nerd-panel');
    if (nerdPanel) {
        nerdPanel.style.display = advanced ? '' : 'none';
    }
    // Input Distributions shows for everyone (folded by default) now that both synthetic modes
    // have a real inflation distribution; only the parameters panel stays nerd-gated.
    const inputDist = document.getElementById('mc-input-dist');
    if (inputDist) inputDist.style.display = '';

    // A canvas first laid out inside a CLOSED <details> has no box to measure, so the chart can end
    // up sized against a fallback. Chart.js watches for resizes and usually recovers on its own, but
    // going from "no layout at all" to visible is the case that observer is least reliable for, and
    // the Stress Test now starts folded. Re-measuring on open costs nothing and removes the doubt.
    document.querySelectorAll('.mc-fold').forEach(fold => {
        if (fold._mcResizeBound) return;      // initMCTab re-runs whenever nerdknob is toggled
        fold._mcResizeBound = true;
        fold.addEventListener('toggle', () => {
            if (!fold.open) return;
            _mcStressChart?.resize();
            _mcChart?.resize();
            // The Input Distributions fold renders its charts while closed for non-demo users.
            _inputEquityChart?.resize();
            _inputInflationChart?.resize();
        });
    });
}

// Returns true when NERD_KNOBS is active.
// Put every Advanced Parameter back to its default. MC_PARAMS is the single source of those
// defaults, so this cannot drift from what the clamped reads fall back to. mu's real default is
// "synced from Growth %", a behavior rather than a number, so it goes through the sync afterwards.
function resetMCParams() {
    for (const [id, spec] of Object.entries(MC_PARAMS)) {
        const el = document.getElementById(id);
        if (el) el.value = spec.dflt;
    }
    syncMCMuFromGrowth();
    _afterMCPreset();
}

// Shared tail for the preset buttons. The stale banner alone is too quiet for these: the boxes a
// preset moves are in the nerd panel, so a reader without it clicks a button and, without this,
// sees nothing change. Re-run for them on the same rule the mode selector already uses - nerd mode
// means the reader controls when the expensive sweep happens, so there we only mark it stale.
function _afterMCPreset() {
    updateMCTimeEstimate();
    mcInputsChanged();
    if (!_mcNerdMode() && !document.getElementById('tab-mc')?.classList.contains('hidden')) {
        runMonteCarlo();
    }
}

// Reproduce the pre-v11.160F Synthetic model: one flat inflation rate for every path and every
// year, at whatever the Assumptions section names.
//
// Setting the shock to 0 is enough, and exactly enough. The AR(1) step is
// target + persistence*(prev - target) + shockSd*z, and it starts at prev === target, so with no
// shock the middle term is 0 forever and the line never leaves the target. Persistence and the
// return correlation go inert rather than being reset - they have nothing to act on - so the two
// knobs keep whatever the reader set, ready for when they turn the shock back on.
//
// The returns are already bit-identical to the old model whatever the inflation settings say
// (inflation draws come from a separate PRNG stream), so this button is the whole difference
// between the current Synthetic modes and the one that shipped before them.
function applyMCFixedInflation() {
    const el = document.getElementById('mc-inflation-shock-sd');
    if (el) el.value = 0;
    _afterMCPreset();
}

// One-click bad-decade parameter set. Not a prediction: a stress-leaning what-if for the synthetic
// modes. Growth drops 2 points below the Assumptions rate, volatility rises to 18%, and inflation
// becomes more persistent (0.75), more volatile (3.1% shock sd - the residual of the full 1928-2025
// record, the window that includes its worst regimes) and more tightly tied to bad return years
// (-0.45). Sampling knobs (paths, seed, stress count) are untouched: pessimism is a claim about the
// world, not about how finely it is sampled. resetMCParams() undoes it.
function applyMCPessimistic() {
    const growth = parseFloat(document.getElementById('growth')?.value);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('mc-mu', (Number.isFinite(growth) ? Math.max(0, growth - 2) : 5).toFixed(1));
    set('mc-sigma', 18);
    set('mc-inflation-persistence', 0.75);
    set('mc-inflation-shock-sd', 3.1);
    set('mc-inflation-return-corr', -0.45);
    updateMCGrowthWarning();
    _afterMCPreset();
}

// The run whose inputFan is on screen: {seed, mu, sigma, bearFraction}, written at dispatch.
let _mcFanMeta = null;

// The dropdown's own wording for a mode value, so the fan caption and the selector can never
// disagree about what a mode is called.
function _mcModeLabel(mode) {
    const opt = document.querySelector(`#mc-sim-mode option[value="${mode}"]`);
    return opt ? opt.textContent.trim() : String(mode ?? '?');
}

// One line naming the run that built the Input Distributions: mode, paths, seed, and EVERY
// parameter that shaped the draws - mu/sigma and the four inflation-model numbers for synthetic
// runs, bear-start for Historical (whose returns and inflation come from the record and have no
// other tuning). The test is reproducibility: the caption alone should be enough to re-create the
// run it describes.
function _fanSourceText(msg, meta) {
    const pct1 = v => (v * 100).toFixed(1) + '%';
    const bits = [_mcModeLabel(msg.simulationMode), `${msg.numPaths} paths`];
    if (meta?.seed != null) bits.push(`seed ${meta.seed}`);
    if (isSyntheticMode(msg.simulationMode)) {
        if (meta?.mu    != null) bits.push(`μ ${pct1(meta.mu)}`);
        if (meta?.sigma != null) bits.push(`σ ${pct1(meta.sigma)}`);
        if (meta?.inflationRate        != null) bits.push(`inflation target ${pct1(meta.inflationRate)}`);
        if (meta?.inflationPersistence != null) bits.push(`persistence ${meta.inflationPersistence}`);
        if (meta?.inflationShockSd     != null) bits.push(`inflation shock σ ${pct1(meta.inflationShockSd)}`);
        if (meta?.inflationReturnCorr  != null) bits.push(`return corr ${meta.inflationReturnCorr}`);
    } else if (meta?.bearFraction != null) {
        bits.push(`bear-start ${meta.bearFraction}%`);
    }
    return 'Built from the last full run: ' + bits.join(' · ');
}

// The two synthetic modes share everything except how a normal draw becomes a return, so almost
// every test in this file wants "is this synthetic", not "is this GBM".
function isSyntheticMode(mode) {
    return mode === 'gbm' || mode === 'aam';
}

// The inflation model is shared by both synthetic modes and ignored by Historical, so one reader
// serves the run, the stress refresh and the hash.
function _mcInflationCfg() {
    return {
        inflationPersistence: _mcNum('mc-inflation-persistence'),
        inflationShockSd:     _mcNum('mc-inflation-shock-sd') / 100,
        inflationReturnCorr:  _mcNum('mc-inflation-return-corr'),
    };
}

function _mcNerdMode() {
    return typeof NERD_KNOBS !== 'undefined' && NERD_KNOBS;
}

// Returns true when the ?montecarlo teaching demo is active (defined in optimizer_ui.js).
function _mcDemoMode() {
    return typeof MONTE_DEMO !== 'undefined' && MONTE_DEMO;
}

// Sync mc-mu from the Assumptions Growth % input (one-way: growth → mc-mu).
// Called on page load, on growth oninput, and when mode switches to GBM.
function syncMCMuFromGrowth() {
    const muEl     = document.getElementById('mc-mu');
    const growthEl = document.getElementById('growth');
    if (!muEl || !growthEl) return;
    muEl.value = growthEl.value;
    updateMCGrowthWarning();
}

// Same high/low range warnings as the Assumptions section, shown near mc-mu.
function updateMCGrowthWarning() {
    const warnEl = document.getElementById('mc-mu-warn');
    if (!warnEl) return;
    const g = parseFloat(document.getElementById('mc-mu')?.value);
    if (isNaN(g)) { warnEl.innerHTML = ''; return; }
    if (g > 10) {
        warnEl.innerHTML = `<span style="color:#b45309;">⚠ Optimistic — S&amp;P 500 long-run nominal CAGR ~10%; diversified portfolios typically 6–9%.</span>`;
    } else if (g < 3) {
        warnEl.innerHTML = `<span style="color:#b45309;">⚠ Pessimistic — below typical equity range (6–10%). Appropriate for mostly-bond allocations.</span>`;
    } else {
        warnEl.innerHTML = '';
    }
}

// Dim the synthetic-only inputs when Historical is selected (unused in that mode; Stress is folded
// into it). Show the bear-start knob only in Historical (bootstrap) mode.
//
// Everything here keys off "is this Historical", never off a specific synthetic mode, so both GBM
// and AAM light up the same controls. The inflation knobs join μ and σ on that list: Historical
// samples real inflation out of the record and has no model to tune.
function updateMCModeUI() {
    const mode = document.getElementById('mc-sim-mode')?.value;
    const isBootstrap = mode === 'bootstrap';
    ['mc-mu', 'mc-sigma', 'mc-inflation-persistence', 'mc-inflation-shock-sd',
     'mc-inflation-return-corr'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = isBootstrap;
        el.closest('label').style.opacity = isBootstrap ? '0.4' : '';
    });
    const bearWrap = document.getElementById('mc-bear-start-wrap');
    if (bearWrap) bearWrap.style.display = mode === 'bootstrap' ? '' : 'none';
    // When switching to GBM, re-sync mu from Assumptions so the two stay aligned.
    if (!isBootstrap) syncMCMuFromGrowth();
}

// Called by the always-visible mode selector onchange.
// Syncs UI state, then re-runs immediately in normal mode.
// In nerdknob the user controls runs manually.
function onMCModeChange() {
    updateMCModeUI();
    _lastMCHash = null;   // force re-run regardless of other inputs
    _lastSweepHash = null;
    if (!_mcNerdMode() && !document.getElementById('tab-mc')?.classList.contains('hidden')) {
        runMonteCarlo();
    }
}

// Called by the Monte Carlo tab button.
// In normal mode, runs immediately with default params (panel stays hidden).
function mcTabActivated() {
    // Always sync mode UI — handles scenario-load case where mc-sim-mode was restored
    // but the tab wasn't visible when applyScenario() ran.
    updateMCModeUI();
    // Seed the timing model before the buttons are labelled, so they arrive carrying a cost rather
    // than filling one in later. This is ~144 simulations, a fraction of the run it is describing,
    // and it only happens until a real run has replaced it.
    if (!mcTimingIsMeasured()) {
        const _b = getInputs();
        calibrateMCMs({ variations: buildVariations(_b), mu: _mcNum('mc-mu') / 100,
                        sigma: _mcNum('mc-sigma') / 100, seed: _mcNum('mc-seed'),
                        years: mcPlanYears(_b) });
    }
    // Label both run buttons with their cost, and fill the "N paths × M strategies" readout. Both
    // used to be written only by the paths field's oninput, so they stayed blank for anyone who
    // never touched that field — which is everyone who just wanted to know how big the run is.
    updateMCTimeEstimate();

    const hash = _buildMCHash();
    if (hash === _lastMCHash && _mcResults) {
        markMCStale(false);
        renderMCResults(_mcResults);
        return;
    }
    // Nerd mode owns the cadence of the EXPENSIVE sweep only. Everything else here -- noticing the
    // results on screen describe an older plan, and refreshing the cheap stress pass -- is
    // mode-independent. Gating the whole function on nerd mode (as this used to) meant a nerdknob
    // user could edit an input, come back to the tab, and be shown stale numbers with nothing
    // saying so.
    if (!_mcNerdMode()) {
        runMonteCarlo();
        return;
    }
    // Same sweep-only test as mcInputsChanged(): coming back to the tab after changing nothing but
    // a Stress Test control must not announce that the sweep is out of date.
    if (_mcResults && _buildSweepHash() !== _lastSweepHash) markMCStale(true);
    refreshMCStressOnly();
}

// Two hashes, because the tab has two passes with different costs and different inputs.
//
// _buildSweepHash covers everything the expensive main sweep depends on. It is what the "Out of
// date" banner is keyed to, and it deliberately does NOT include the two Stress Test controls: the
// stress pass re-runs itself on every edit, so flagging the ~30-second sweep as stale over a change
// only the stress chart consumed offered a Re-run button that re-ran the whole thing for nothing.
// (The Stress sequences count genuinely did feed the main pass until now, through the bear-start
// overlay's sample pool. That coupling is gone - see BEAR_OVERLAY_POOL in prng.js - which is what
// makes leaving it out correct rather than merely convenient.)
//
// _buildMCHash adds the stress controls on top. It answers "did anything change at all", which is
// what decides whether the stress pass needs re-running.
function _buildSweepHash() {
    // Clamped values, not raw .value strings: a half-typed or cleared box would otherwise change the
    // hash and flag the sweep out of date over an edit the run never sees.
    return JSON.stringify({
        inputs:      getInputs(),
        numPaths:    _mcNum('mc-num-paths'),
        mu:          _mcNum('mc-mu'),
        sigma:       _mcNum('mc-sigma'),
        seed:        _mcNum('mc-seed'),
        simMode:     document.getElementById('mc-sim-mode')?.value ?? 'gbm',
        bearFraction: _mcNum('mc-bear-fraction'),
        // Retuning the inflation model changes every synthetic path, so it belongs in the identity
        // of a run exactly as mu and sigma do.
        inflation:    _mcInflationCfg(),
        // Scope is part of the identity of a run: switching between "your plan" and "every
        // strategy" has to invalidate what is on screen, or the stale banner never appears and the
        // page keeps showing the other scope's answer.
        scope:        _mcScope,
    });
}

function _buildMCHash() {
    return JSON.stringify({
        sweep:        _buildSweepHash(),
        stressCount:  _mcNum('mc-stress-count'),
        stressWindow: stressWindowMode(),
    });
}

// The user-entered path count is PER STRATEGY: a Compare run puts it against every variation
// buildVariations() produces (~144 on the default scenario), so "500 paths" is ~72,000 simulations.
// That multiplier used to appear nowhere in the UI, which made the run look far smaller than it is.
// With a single variation there is no multiplier to report, so the sentence drops it rather than
// saying "x 1 strategies".
function simCountText(numPaths, numVariations, years) {
    const total = numPaths * numVariations;
    let txt = numVariations === 1
        ? `${numPaths.toLocaleString()} paths, your plan only`
        : `${numPaths.toLocaleString()} paths × ${numVariations.toLocaleString()} strategies = `
          + `${total.toLocaleString()} simulations`;
    // Each simulation is a full plan run, year by year, with a tax return in every year. The
    // simulation count alone understates that; the year count is what the run time is actually
    // proportional to.
    if (years > 0) txt += `, ${(total * years).toLocaleString()} simulated years`;
    return txt;
}

// Plan horizon in years — the same expression runMonteCarlo() uses to size the banks, pulled out so
// the readouts cannot disagree with the run.
function mcPlanYears(base) {
    if (!base) return 0;
    return Math.max(base.birthyear1 + base.die1, base.birthyear2 + base.die2)
         - (base.startYear ?? 2026) + 1;
}

// The ranking mode the Stress window selector is on: a number, 'combined' or 'all'. The <select>
// value is a string either way, so this is the one place that decides which it is.
function stressWindowMode() {
    const raw = document.getElementById('mc-stress-window')?.value ?? 'combined';
    if (raw === 'combined' || raw === 'all') return raw;
    // The selector offers only Combined and All now, but the engine still ranks on a single window
    // and a saved scenario or a hand-edited URL can still ask for one.
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 'combined';
}

// How the sequences on screen were chosen, for labelling. Prefers what the engine actually applied
// (it clamps windows to the record and the plan length) over the input, which may have moved on.
// Returns { mode, windows } where windows is the list of ranking windows in play.
function stressModeOf(stress) {
    const mode = stress?.windowMode ?? stressWindowMode();
    const windows = stress?.windowsUsed ?? (typeof mode === 'number' ? [mode] : []);
    return { mode, windows };
}

// One sentence naming how the start years were picked. Used by the metrics strip and the caption.
function stressSelectionLabel(stress) {
    const { mode, windows } = stressModeOf(stress);
    const n = stress?.startYears?.length ?? 0;
    if (mode === 'all')      return `all ${n} historical start years, unranked`;
    if (mode === 'combined') return `worst by each of the ${windows.join('/')} year windows, combined`;
    return `worst by ${windows[0] ?? mode} year real CAGR`;
}

// The sidebar's own plan as a one-element variation list. The stress pass has always run exactly
// this way, which is what makes 'plan' scope cheap to offer: the worker contract does not change,
// only the length of the array it is handed. -1 means the exact plan is not among the swept rows
// (every swept row runs with conversions forced on), so fall back to a synthetic entry.
function planOnlyVariations(variations, base) {
    const idx = findCurrentStrategyIdx(variations, base);
    return idx >= 0
        ? [variations[idx]]
        : [{ ...base, _label: 'Current Plan', _strategyFamily: '', _paramLabel: '' }];
}

// --- Run ------------------------------------------------------------------

// 'compare' runs every strategy and ranks them; 'plan' runs only the sidebar's own plan.
//
// PLAN is the default. It answers "how did my plan do", which is the question almost everyone
// arrives with, at about 1/144 of the cost -- roughly 1.5 seconds against 43. Compare was the
// default while it was the only thing the tab did, which meant every reader paid for a full
// strategy ranking on arrival whether or not they wanted one, with no warning of the price.
let _mcScope = 'plan';

// scope: 'plan' (default, the sidebar plan alone) | 'compare' (every strategy, ~144x more work).
function runMonteCarlo(scope) {
    _mcScope = (scope === 'compare') ? 'compare' : 'plan';
    _lastMCHash = _buildMCHash();
    _lastSweepHash = _buildSweepHash();
    // runMCWorker terminates whatever is in flight, so a stress-only refresh started moments ago
    // (a sidebar edit is debounced 400ms, which is easily overtaken by a click on Run) will never
    // deliver its callback. Without this the flag stays true forever and every later stress refresh
    // returns at its own guard, silently freezing the Stress Test on the previous plan.
    _mcStressRefreshing = false;

    const base = getInputs();

    const numPaths       = _mcNum('mc-num-paths');
    const mu             = _mcNum('mc-mu')    / 100;
    const sigma          = _mcNum('mc-sigma') / 100;
    const seed           = _mcNum('mc-seed');
    const simulationMode = document.getElementById('mc-sim-mode')?.value              ?? 'gbm';
    const stressCount    = _mcNum('mc-stress-count');
    const stressWindow   = stressWindowMode();
    const bearFraction   = _mcNum('mc-bear-fraction');

    _mcStartYear = base.startYear ?? 2026;
    _mcBase = base;
    const allVariations = buildVariations(base);
    const years = mcPlanYears(base);

    // Stress (folded into Historical) runs against ONLY the current withdrawal strategy/options,
    // not the full multi-strategy sweep — cheaper, and matches what renderStressChart() plots.
    const stressVariations = planOnlyVariations(allVariations, base);

    // In 'plan' scope the main pass runs that same single variation, so the whole run collapses to
    // numPaths simulations instead of numPaths x ~144.
    const variations = _mcScope === 'plan' ? stressVariations : allVariations;

    // Seed the timing model if no real run has been observed yet, so the buttons and the in-flight
    // estimate have something to say. Calibration always uses the full variation list: one variation
    // is too small a sample to measure throughput from.
    if (!mcTimingIsMeasured()) {
        calibrateMCMs({ variations: allVariations, mu, sigma, seed, years, simulationMode });
    }

    // Captured for the Input Distributions caption: the fan must be labeled with the run that
    // built it, and the input boxes can change between runs. Everything that shaped the draws goes
    // in - the caption's job is to make the run reproducible from what it says.
    _mcFanMeta = { seed, mu, sigma, bearFraction, inflationRate: base.inflation, ..._mcInflationCfg() };

    // UI feedback. The count readout is set here, not in renderSurvivalTable, so the cancel bar
    // describes the run in flight rather than whatever the previous run happened to be.
    const _pcBar = document.getElementById('mc-path-count');
    if (_pcBar) _pcBar.textContent = simCountText(numPaths, variations.length, years);
    setMCRunning(true);

    runMCWorker(
        { variations, stressVariations, numPaths, mu, sigma, seed, years, simulationMode, stressCount,
          stressWindow, bearFraction, inflationRate: base.inflation, ..._mcInflationCfg() },
        (pct) => updateMCProgress(pct),
        (msg) => {
            setMCRunning(false);
            // This run just told the timing model what this machine actually costs, so both button
            // labels are restated from it -- including dropping the "about" once anything real has
            // been measured.
            updateMCTimeEstimate();
            if (msg.error) {
                document.getElementById('mc-error').textContent = 'Error: ' + msg.error;
                document.getElementById('mc-error').style.display = '';
                return;
            }
            _mcResults = msg;
            _mcSelected.clear();
            markMCStale(false);
            renderMCResults(msg);
        }
    );
}

function cancelMC() {
    cancelMCWorker();
    // Same reason runMonteCarlo() clears it: a cancelled run never delivers its callback, and on the
    // file:// path a stress-only refresh can be the thing in flight. Leaving the flag set freezes
    // every later refresh at its own guard.
    _mcStressRefreshing = false;
    setMCRunning(false);
}

// --- ?montecarlo teaching demo (Experiment) -------------------------------
//
// A small fixed grid — 3 seeds x 4 path counts — run as "My Plan Only" in Synthetic mode, so a
// reader can watch the sampled equity range jump around at 5 paths and settle by 100. Every cell
// goes through the SAME engine and reads the SAME payload fields the metrics bar renders, so the
// numbers here are the numbers a manual run produces; there is no parallel math to drift.
const _DEMO_PATH_COUNTS = [5, 10, 25, 100];
const _DEMO_FIXED_SEEDS = [42, 314, 777];   // stable first view; the button reshuffles after.
let _demoSeeds = null;

// Seeds are kept in 0..1000: a bigger seed space teaches the reader nothing, and short numbers read
// cleanly in the table. The seed only picks which random stream is used; its magnitude is meaningless.
function _demoRandSeed() { return Math.floor(Math.random() * 1001); }
function _demoPct(v)     { return (v == null) ? '—' : (v * 100).toFixed(1) + '%'; }

// Promise wrapper over the chunked main-thread runner. Used instead of the worker because the demo
// fires 12 tiny runs back to back and worker startup (~1s each) would dominate. The main-thread
// path yields the identical results payload.
function _mcRunOnce(cfg) {
    return new Promise((resolve) => { _runMCMainThread(cfg, null, (msg) => resolve(msg)); });
}

async function runMCExperiment() {
    const panel = document.getElementById('mc-demo-panel');
    if (!panel) return;

    // First invocation (the auto-run on load) uses the fixed seed set for a stable first view; every
    // later click reshuffles all three, so the reader sees a fresh random draw land in the same grid.
    _demoSeeds = (_demoSeeds === null)
        ? _DEMO_FIXED_SEEDS.slice()
        : [_demoRandSeed(), _demoRandSeed(), _demoRandSeed()];

    const btn = document.getElementById('mc-demo-run-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Running…'; }

    // The Experiment is a statement about SAMPLING noise - the same plan, the same parameters,
    // different seeds and path counts - so it needs a synthetic mode, where the seed is what varies.
    // Historical block-bootstraps the record and answers a different question, so switch away from
    // it. Either synthetic mode is left alone: a reader riffing on Arithmetic should get their
    // Experiment in Arithmetic, and the demo's point holds identically in both.
    const modeEl = document.getElementById('mc-sim-mode');
    if (modeEl && !isSyntheticMode(modeEl.value)) { modeEl.value = 'gbm'; updateMCModeUI(); }
    const demoMode = isSyntheticMode(modeEl?.value) ? modeEl.value : 'gbm';

    const base   = getInputs();
    const mu     = _mcNum('mc-mu')    / 100;
    const sigma  = _mcNum('mc-sigma') / 100;
    const years  = mcPlanYears(base);
    const planVar = planOnlyVariations(buildVariations(base), base)[0];
    _mcStartYear = base.startYear ?? 2026;

    const rows = [];
    let lastMsg = null;
    // Path counts ascending, all seeds within each, so the FINAL cell is a 100-path run. Its richer
    // inputFan is what the Input Distributions charts below then display (req 9).
    for (const paths of _DEMO_PATH_COUNTS) {
        for (const seed of _demoSeeds) {
            const msg = await _mcRunOnce({
                variations: [planVar], stressVariations: [planVar],
                numPaths: paths, mu, sigma, seed, years,
                simulationMode: demoMode,
                stressCount: 0, stressWindow: stressWindowMode(), bearFraction: 0,
                // Same inflation model the main run would use. Without this the worker fell back
                // to the prng.js defaults, which only coincidentally equal the knob defaults - a
                // retuned knob would have run the demo on numbers its caption then denied.
                inflationRate: base.inflation, ..._mcInflationCfg(),
            });
            lastMsg = msg;
            rows.push({ paths, seed, msg });
        }
    }

    renderDemoTable(rows);

    if (lastMsg && lastMsg.inputFan) {
        const dist = document.getElementById('mc-input-dist');
        if (dist) {
            dist.style.display = '';
            // Expand the fold by default in the demo. Open it BEFORE rendering: a canvas laid out
            // inside a closed <details> has no box to measure, so the chart would size against a
            // fallback (same reason initMCTab re-measures .mc-fold charts on open).
            const det = dist.querySelector('details');
            if (det) det.open = true;
        }
        renderInputFanCharts(lastMsg.inputFan, lastMsg.years,
            _fanSourceText(lastMsg, { seed: _demoSeeds[_demoSeeds.length - 1], mu, sigma,
                                      inflationRate: base.inflation, ..._mcInflationCfg() }));
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Experiment ↻'; }
}

// Equity range = the empirical worst/best single-year return over the cell's numPaths x years draws
// (msg.minAnnualReturn / .maxAnnualReturn). The Inflation column was written forward-compatibly for
// the day Synthetic inflation stopped being one fixed rate, and that day has arrived: msg.inflationStats
// is now populated in every mode, so this shows a real range. It still falls back to "(fixed)" when
// min == max, which is what an inflation shock of 0 produces.
function renderDemoTable(rows) {
    const body = document.getElementById('mc-demo-tbody');
    if (!body) return;
    let html = '';
    let prevPaths = null;
    for (const r of rows) {
        const m = r.msg || {};
        const eqLo = _demoPct(m.minAnnualReturn), eqHi = _demoPct(m.maxAnnualReturn);
        const infLoV = m.inflationStats ? m.inflationStats.min : m.inflationRate;
        const infHiV = m.inflationStats ? m.inflationStats.max : m.inflationRate;
        const infLo = _demoPct(infLoV), infHi = _demoPct(infHiV);
        const groupTop = (r.paths !== prevPaths);
        prevPaths = r.paths;
        const bt = groupTop ? 'border-top:2px solid #cbd5e1;' : 'border-top:1px solid #eef0f2;';
        const infCell = (infLo === infHi)
            ? `${infLo} <span style="color:#aaa;font-size:0.85em;">(fixed)</span>`
            : `${infLo} <span style="color:#aaa;">to</span> ${infHi}`;
        html += `<tr style="${bt}">`
              + `<td style="padding:3px 12px;text-align:right;font-weight:${groupTop ? '600' : '400'};color:${groupTop ? '#222' : '#bbb'};font-variant-numeric:tabular-nums;">${groupTop ? r.paths : ''}</td>`
              + `<td style="padding:3px 12px;text-align:right;font-variant-numeric:tabular-nums;color:#555;">${r.seed}</td>`
              + `<td style="padding:3px 12px;text-align:center;white-space:nowrap;">${eqLo} <span style="color:#aaa;">to</span> ${eqHi}</td>`
              + `<td style="padding:3px 12px;text-align:center;white-space:nowrap;">${infCell}</td>`
              + `</tr>`;
    }
    body.innerHTML = html;
}

// --- Reacting to sidebar edits --------------------------------------------

let _mcStressRefreshing = false;
// Latest stress-pass payload, independent of whether a full Monte Carlo run has ever happened.
// The stress pass is ~10 simulations, so it runs from page load and on every input change; that
// makes it the one Monte Carlo number that is always current, which is why it earns a summary-bar
// tile visible from every tab.
let _mcStress = null;

// Called by optimizer_ui.js's scheduleRecalc when an input changes while the MC tab is open.
// Until this existed the whole tab kept showing the PREVIOUS plan until you clicked away and back.
// Re-running everything is not an option: the main sweep is numPaths × variations simulations
// (measured 27.4s / 72,000 sims on the default scenario), so an edit-triggered full run would burn
// half a minute of CPU per keystroke-and-blur. Instead the cheap pass runs and the expensive one is
// labeled: the stress pass is stressCount × 1 sims, so it refreshes silently, and the sweep gets
// the #mc-stale-banner with a Re-run button.
function mcInputsChanged() {
    if (_buildMCHash() === _lastMCHash) return;
    // Only a change the SWEEP would have seen makes the sweep out of date, and _mcResults null means
    // there is nothing on screen to go stale. Editing Stress sequences or Stress window used to raise
    // the banner too, and its Re-run button re-runs everything, so the offer was to spend half a
    // minute on the ~144-strategy sweep to refresh a chart that had already refreshed itself by the
    // time the banner appeared.
    if (_mcResults && _buildSweepHash() !== _lastSweepHash) markMCStale(true);
    // No nerd-mode guard here on purpose. Nerd mode controls when the expensive SWEEP runs, and
    // nothing in this function runs it. Marking the sweep out of date and refreshing the ~10-sim
    // stress pass have to happen in both modes, or a nerdknob user silently reads the previous
    // plan's numbers -- which is exactly what the first version of this shipped with.
    refreshMCStressOnly();
}

function markMCStale(stale) {
    const el = document.getElementById('mc-stale-banner');
    if (!el) return;
    el.style.display = stale ? '' : 'none';
}

// Re-runs ONLY the stress pass against the edited plan and swaps it into the cached results.
// Deliberately does not call setMCRunning(): at ~10 simulations the progress bar would flash.
function refreshMCStressOnly() {
    if (_mcStressRefreshing) return;
    const simulationMode = document.getElementById('mc-sim-mode')?.value ?? 'gbm';
    if (_mcWorkerBusy()) return;                  // never interrupt a full run in flight

    const base = getInputs();
    // The stress chart's x-axis needs these, and a nerdknob user can reach a stress result without
    // ever running the full sweep, so they cannot be left to runMonteCarlo() to set.
    _mcStartYear = base.startYear ?? 2026;
    const stressVariations = planOnlyVariations(buildVariations(base), base);
    const years = mcPlanYears(base);

    _mcStressRefreshing = true;
    runMCWorker(
        {
            stressOnly: true,
            variations: stressVariations, stressVariations,
            numPaths:      _mcNum('mc-num-paths'),
            mu:            _mcNum('mc-mu')    / 100,
            sigma:         _mcNum('mc-sigma') / 100,
            seed:          _mcNum('mc-seed'),
            years, simulationMode,
            stressCount:   _mcNum('mc-stress-count'),
            stressWindow:  stressWindowMode(),
            bearFraction:  _mcNum('mc-bear-fraction'),
            inflationRate: base.inflation,
            ..._mcInflationCfg(),
        },
        null,
        (msg) => {
            _mcStressRefreshing = false;
            if (msg.error || !msg.stress) return;
            // renderStressChart labels its x-axis from the plan length. It used to read that off
            // _mcResults, which is null until a full sweep has run -- so a nerdknob user got the
            // headline count with an empty chart underneath it.
            msg.stress.years = msg.years;
            // Standalone state, so the summary-bar tile works before any full run has happened.
            // _mcResults.stress is kept in step when a full run exists, since renderMCResults and
            // the Current Dollars re-render both read it from there.
            _mcStress = msg.stress;
            if (_mcResults) _mcResults.stress = msg.stress;
            renderStressChart(msg.stress);   // calls renderMCStressMetrics, which updates the tile
        }
    );
}

// --- Rendering ------------------------------------------------------------

// Returns the index of the variation that matches the user's current strategy settings,
// or -1 if no match is found (e.g. the strategy isn't in the variation list).
// Matching lives in optimizer_core.js (sameStrategySelection) so Monte Carlo and the Optimizer
// cannot disagree about which swept row IS the user's plan. That shared version also matches the
// two families this used to miss -- Guyton-Klinger (by guardrails) and Ordered (by sequence), both
// of which previously fell through to `return false` and dropped Stress mode onto the synthetic
// "Current Plan" fallback -- and it treats an IRMAA-ceiling selection as distinct from a
// bracket-rate one rather than pairing them.
function findCurrentStrategyIdx(variations, base) {
    if (!base) return -1;
    return variations.findIndex(v => sameStrategySelection(v, base));
}

function renderMCResults(msg) {
    document.getElementById('mc-error').style.display = 'none';
    renderMCMainMetrics(msg);

    const planOnly = _mcScope === 'plan';

    // Resolve the pinned row FIRST: the survival table renders it on top and the chart draws it
    // emphasized, so both have to be looking at the same index. In plan scope the sole variation IS
    // the plan by construction, including the synthetic fallback that sameStrategySelection would
    // not recognize, so pin it directly rather than searching for it.
    _mcPinIdx = planOnly ? 0 : findCurrentStrategyIdx(msg.variations, _mcBase);
    // A one-row survival table is not a ranking. Hide it and let the headline and chart carry the
    // result; the table comes back with a Compare run.
    const tblWrap = document.getElementById('mc-table-wrap');
    if (planOnly) {
        if (tblWrap) tblWrap.style.display = 'none';
        // Also empty it. Rows left over from an earlier Compare run carry variation indices that no
        // longer exist in this one-element result, and their checkbox handlers would re-render the
        // chart from those stale indices.
        const tbody = document.getElementById('mc-table-body');
        if (tbody) tbody.innerHTML = '';
    } else {
        renderSurvivalTable(msg.variations, msg.numPaths);
    }
    renderPlanHeadline(msg);

    _mcSelected.clear();
    const currentIdx = _mcPinIdx;

    if (planOnly) {
        // Nothing to choose between.
        _mcSelected.add(0);
        finishMCRender(msg);
        return;
    }

    // Default chart: best variation per base strategy family (highest survival, then highest median
    // final balance as tiebreaker). When both Cyclic and non-Cyclic variants exist for a family,
    // pick whichever is better. Exception: always include the exact current-settings variation.
    //
    // Build best-per-BASE-family map. Cyclic variants use "🔄 Family" names; strip the prefix
    // so both variants compete within the same slot.
    const byBaseFamily = {};
    const isBetter = (v, best) => {
        const vFinal    = v.percentiles.p50[v.percentiles.p50.length - 1] ?? 0;
        const bestFinal = best.percentiles.p50[best.percentiles.p50.length - 1] ?? 0;
        return v.survivalRate > best.survivalRate ||
               (v.survivalRate === best.survivalRate && vFinal > bestFinal);
    };
    msg.variations.forEach((v, i) => {
        const baseFamily = _stripHtml(v.strategyFamily).replace(/^[^A-Za-z]+/, '');
        const bestIdx    = byBaseFamily[baseFamily];
        if (bestIdx == null || isBetter(v, msg.variations[bestIdx])) {
            byBaseFamily[baseFamily] = i;
        }
    });

    // Always include the exact current variation (may override the best-of-family slot).
    if (currentIdx >= 0) {
        const baseFamily = _stripHtml(msg.variations[currentIdx].strategyFamily).replace(/^[^A-Za-z]+/, '');
        byBaseFamily[baseFamily] = currentIdx;
    }

    Object.values(byBaseFamily).forEach(i => _mcSelected.add(i));
    finishMCRender(msg);
}

// The part of rendering that is identical in both scopes. Split out so the plan-scope path can skip
// the family-ranking block above without duplicating any of this.
function finishMCRender(msg) {
    const descEl = document.getElementById('mc-chart-desc');
    if (descEl) {
        descEl.textContent = `Shaded areas: outer = p5–p95, inner = p25–p75. Solid line = median (p50). Paths that hit ruin stay at $0.`
            + (_mcScope === 'plan' ? '' : ` Click a legend item to isolate it; click again to restore all.`);
    }

    renderMCChart(msg);
    renderStressChart(msg.stress);
    renderInputFanCharts(msg.inputFan, msg.years, _fanSourceText(msg, _mcFanMeta));
    syncTableCheckboxes();
}

// --- Metrics bar ----------------------------------------------------------

// Signed percent, colored by whether the number is GOOD FOR YOU, not by its sign. For returns that
// means green at or above zero. For inflation it means the opposite: rising prices erode the plan, so
// pass invert = true and a positive number turns red. Coloring inflation on sign would have painted
// every realistic inflation figure the same green as a strong equity year.
// No leading + on an inverted figure. "+2.4%" reads as a gain, and inflation rising is not one; the
// sign is only informative where up means good. A negative value still prints its own -, from toFixed.
function _mcPct(v, invert = false) {
    const s = (v >= 0 && !invert ? '+' : '') + (v * 100).toFixed(1) + '%';
    const bad = invert ? (v > 0) : (v < 0);
    return `<span style="color:${bad ? '#c0392b' : '#1a7a1a'}">${s}</span>`;
}

// Shared asset summary for the main-pass and stress-pass metrics lines.
// ar = {equity:[min,cagr,max], bonds:[...], intl:[...]}; iS = {min,cagr,max} inflation stats or null.
//
// This used to be a four-row Min/CAGR/Max grid, which read as a second table wedged into a line of
// running text and put the least interesting number (the single worst year) first. It is now the
// same "·"-separated sentence Synthetic mode already used, in CAGR then min then max order, so the
// two simulation modes describe themselves the same way.
function buildAssetRangeSummary(ar, iS, srcLabel) {
    const part = (label, range, invert) =>
        `<span style="white-space:nowrap;">${label} <strong>${_mcPct(range[1], invert)}</strong>/yr`
        + `<span style="color:#888;"> (${_mcPct(range[0], invert)} to ${_mcPct(range[2], invert)})</span></span>`;
    const bits = [
        part('Equity', ar.equity),
        part('Bonds',  ar.bonds),
        part('Intl',   ar.intl),
    ];
    // Inflation inverts: a high inflation year is the bad one.
    if (iS) bits.push(part('Inflation', [iS.min, iS.cagr, iS.max], true));
    return `<span style="color:#888;font-size:0.8em;">${srcLabel}</span> &nbsp;·&nbsp; `
         + bits.join(' &nbsp;·&nbsp; ');
}

function renderMCMainMetrics(msg) {
    const el = document.getElementById('mc-main-metrics');
    if (!el) return;

    const ms   = msg.totalMs            != null ? msg.totalMs                                : null;
    const grow = msg.medianAnnualReturn != null ? (msg.medianAnnualReturn * 100).toFixed(1) : null;
    const lo   = msg.minAnnualReturn    != null ? (msg.minAnnualReturn    * 100).toFixed(1) : null;
    const hi   = msg.maxAnnualReturn    != null ? (msg.maxAnnualReturn    * 100).toFixed(1) : null;
    const inf  = msg.inflationRate      != null ? (msg.inflationRate      * 100).toFixed(1) : null;

    const parts = [];
    if (ms != null) {
        const sec = (ms / 1000).toFixed(ms < 10000 ? 1 : 0);
        parts.push(`Completed in <strong>${sec} s</strong>`);
    }

    // Synthetic: one blended return series, so there is nothing per-asset to report. CAGR first,
    // then the range, matching the Historical line below.
    if (!msg.assetRanges) {
        // The two synthetic models centre the yearly return distribution differently, and the label
        // has to say which one you are looking at. GBM's mu is a log drift, so the centre reported
        // here sits below the growth rate typed in Assumptions; AAM's mu is the plain average, so
        // the centre IS that number. Neither changes how volatility drags on compounded growth, so
        // this is a statement about one year, not about where the plan ends up.
        const _centreLabel = (msg.simulationMode === 'aam') ? 'arithmetic' : 'geometric';
        if (grow != null) parts.push(`Median growth <strong>${grow}%/yr</strong> <span style="color:#888;font-size:0.85em;">(${_centreLabel})</span>`);
        if (lo != null && hi != null) parts.push(
            `Equity range <strong style="color:${parseFloat(lo)<0?'#c0392b':'inherit'}">${lo}%</strong>`
            + ` to <strong>${hi}%</strong>`
            + ` <span style="color:#888;font-size:0.85em;">(worst/best yr)</span>`
        );
        // Synthetic inflation now varies per path, so it reports a range like Historical does.
        // The fixed-rate wording is kept for the one case that still produces it: an inflation
        // shock of 0, which is how you ask for the old behavior.
        const _iS = msg.inflationStats;
        if (_iS && _iS.max - _iS.min > 1e-9) {
            parts.push(`Inflation <strong>${_mcPct(_iS.cagr, true)}</strong>/yr`
                + ` <span style="color:#888;font-size:0.85em;">(${_mcPct(_iS.min, true)} to ${_mcPct(_iS.max, true)})</span>`);
        } else if (inf != null) {
            parts.push(`Inflation <strong>${_mcPct(msg.inflationRate, true)}</strong>/yr <span style="color:#888;font-size:0.85em;">(fixed)</span>`);
        }
    }

    // Historical (bootstrap): per-asset CAGR with its worst and best year, same sentence shape.
    if (msg.assetRanges) {
        parts.push(buildAssetRangeSummary(msg.assetRanges, msg.inflationStats, 'Sampled (1928–2025)'));
    }

    el.innerHTML = parts.join(' &nbsp;·&nbsp; ');
    el.style.display = parts.length ? '' : 'none';
}

// Stress-pass metrics — same Min/CAGR/Max grid, sourced from the ~10-20 worst historical decades
// instead of the ~500-path bootstrap sample. `stress` is msg.stress (null in Synthetic mode).
function renderMCStressMetrics(stress) {
    // Always refresh the summary-bar tile from here, including the empty case, so a mode switch to
    // Synthetic blanks it rather than leaving a stale Historical number on every tab.
    updateStressStat(stress);
    const el = document.getElementById('mc-stress-metrics');
    if (!el) return;
    if (!stress || !stress.assetRanges) { el.innerHTML = ''; el.style.display = 'none'; renderStressHeadline(null); return; }
    const n = stress.labels?.length ?? 0;
    const capped = stress.requestedCount > n
        ? `, capped from ${stress.requestedCount} by what the record holds` : '';
    const srcLabel = `Stress: ${n} sequences (${stressSelectionLabel(stress)}${capped})`;
    el.innerHTML = buildAssetRangeSummary(stress.assetRanges, stress.inflationStats, srcLabel);
    el.style.display = '';
    renderStressHeadline(stress);
}

// The one number this whole pass exists to produce: how many of the worst historical sequences the
// current plan does NOT survive. Since PF3 the stress pass runs exactly one variation (the sidebar's
// own plan), so variations[0] is that plan and numPaths is the number of sequences.
// Returns null when there is nothing to report, so every caller can share the same shaping.
// The one place the three survival bands live. The table rows, the stress headline, the summary-bar
// tile and the plan headline all read from here, so a reader who has learned the scale on one of
// them has learned it on all of them. bg is for filled chips and row shading, fg for text on the
// page background. Kept in step with the static swatch legend in retirement_optimizer.html.
function survivalBand(rate) {
    const ok = rate >= 0.90, warn = rate >= 0.75;
    return {
        bg: ok ? '#d4edda' : warn ? '#fff3cd' : '#f8d7da',
        fg: ok ? '#1a7f37' : warn ? '#8a6d00' : '#c0392b',
    };
}

function stressFailureSummary(stress) {
    const v = stress?.variations?.[0];
    const total = stress?.numPaths ?? 0;
    if (!v || !total) return null;
    const failures = Math.round((1 - v.survivalRate) * total);
    return {
        failures, total,
        // How the start years were picked, carried alongside the count because the count alone
        // cannot be described honestly: 'all' runs every start year in the record, good and bad
        // alike, so calling them the worst N is false. From stressModeOf, which prefers what the
        // engine actually applied over the live selector.
        mode: stressModeOf(stress).mode,
        survivalRate: v.survivalRate,
        ruinYear: v.medianRuinYear ?? null,
        ...survivalBand(v.survivalRate),
    };
}

// NOTE for anyone editing these two strings: renderStressHeadline interpolates the finished tooltip
// into a title="..." attribute WITHOUT escaping it, so a double quote here would truncate the
// attribute. Keep them free of " characters.
const STRESS_TOOLTIP_WORST =
      'Of the harshest return periods in the historical record, how many your current plan runs out '
    + 'of money in. These sequences are chosen to be the worst on record, so this is a durability '
    + 'test and not a forecast: failing some of them does not mean the plan is likely to fail.';

// All start years runs the whole record rather than a ranked subset, so the durability point has to
// be made on different grounds: it is not that the sequences were picked to be harsh, it is that
// none were left out.
const STRESS_TOOLTIP_ALL =
      'Of every start year in the historical record, how many your current plan runs out of money '
    + 'in. All start years are run, good and bad alike, rather than only the worst, so this reads as '
    + 'how much of the record the plan survives. It is a durability test and not a forecast.';

// The base sentence for the selection currently on screen. With no run to describe there is nothing
// but the live selector to go on, which is what stressModeOf falls back to.
function stressTooltipBase(mode) {
    return (mode ?? stressWindowMode()) === 'all' ? STRESS_TOOLTIP_ALL : STRESS_TOOLTIP_WORST;
}

// Tooltip text shared by the summary-bar tile and the Monte Carlo headline.
function stressTooltip(s) {
    if (!s) return stressTooltipBase(null);
    return stressTooltipBase(s.mode)
        + `\n\nYour plan survives ${s.total - s.failures} of ${s.total} and fails ${s.failures}.`
        + (s.ruinYear ? `\nIn the runs that fail, the money typically runs out around ${s.ruinYear}.` : '')
        + '\n\nSee the Monte Carlo tab for the full stress chart.';
}

// Headline block at the top of the (foldable) stress section, plus the same number mirrored into
// the <summary> so it stays readable while the section is collapsed.
function renderStressHeadline(stress) {
    const el = document.getElementById('mc-stress-headline');
    if (!el) return;
    const s = stressFailureSummary(stress);
    // The chevron is rotated by the #mc-stress-fold[open] CSS rule, so nothing here has to know
    // whether the section is currently open.
    const chev = `<span class="mc-fold-chev" style="color:#666;font-size:0.9em;">▸</span>`;

    if (!s) {
        // Still the fold control even with nothing to report, so the section never loses its handle.
        el.innerHTML =
            `<div style="display:flex;align-items:center;gap:10px;background:#f1f3f5;border-radius:6px;`
            + `padding:10px 14px;margin-bottom:8px;">${chev}`
            + `<div style="font-weight:600;color:#333;">Stress Test</div></div>`;
        return;
    }

    // All start years is not a selection of the worst, it is the whole record, so it gets its own
    // pair of sentences. Combined and the single-window modes DO rank, and keep the original wording.
    const tail = s.ruinYear ? `, typically around ${s.ruinYear}.` : '.';
    const sentence = s.mode === 'all'
        ? (s.failures === 0
            ? `Your plan survives every one of the ${s.total} start years on record.`
            : `Your plan runs out of money in ${s.failures} of the ${s.total} start years on record` + tail)
        : (s.failures === 0
            ? `Your plan survives all ${s.total} of the worst historical periods on record.`
            : `Your plan runs out of money in ${s.failures} of the ${s.total} worst historical periods on record` + tail);
    el.innerHTML =
        `<div title="${stressTooltip(s)}" style="display:flex;align-items:center;gap:12px;background:${s.bg};`
        + `border-radius:6px;padding:10px 14px;margin-bottom:8px;">${chev}`
        + `<div style="font-size:1.9em;font-weight:700;line-height:1;color:${s.fg};white-space:nowrap;">${s.failures} / ${s.total}</div>`
        + `<div style="font-size:0.92em;color:#333;"><strong>Stress Test.</strong> ${sentence}</div></div>`;
}

// Headline for the user's OWN plan, above the percentile chart. The survival table ranks every
// strategy against every other, which answers "what is best" but never answered "how did MINE do" --
// the plan's own chance of success was a row you had to hunt for. This states it outright, using the
// same three color bands as the table so the number reads on a scale the page has already taught.
function renderPlanHeadline(msg) {
    const el = document.getElementById('mc-plan-headline');
    if (!el) return;
    const v = _mcPinIdx >= 0 ? msg?.variations?.[_mcPinIdx] : null;
    const total = msg?.numPaths ?? 0;
    // Rotated by the .mc-fold[open] CSS rule, so nothing here tracks the open state.
    const chev = `<span class="mc-fold-chev" style="color:#666;font-size:0.9em;">▸</span>`;

    if (!v || !total) {
        // Every strategy the sweep runs has conversions forced on and your own conversion settings
        // set aside, so an exact match is not guaranteed. Say so rather than pinning a near-miss.
        // Either way this stays a usable fold handle, so the section never loses its control.
        const msgTxt = _mcResults
            ? 'Your exact plan is not among the swept strategies, so no row is pinned. The table below ranks the strategies the sweep does cover.'
            : 'Monte Carlo';
        el.innerHTML =
            `<div style="display:flex;align-items:center;gap:10px;background:#f1f3f5;border-radius:6px;`
            + `padding:10px 14px;margin-bottom:8px;font-size:0.9em;color:#555;">${chev}<div>${msgTxt}</div></div>`;
        el.style.display = '';
        return;
    }

    const band     = survivalBand(v.survivalRate);
    const pct      = (v.survivalRate * 100).toFixed(1);
    const survived = Math.round(v.survivalRate * total);
    const finalBal = v.percentiles.p50[v.percentiles.p50.length - 1] ?? 0;
    // Which simulation produced this number. The two modes are not comparable with each other, so a
    // survival rate quoted without naming its mode is a number you cannot check against anything.
    // assetRanges is present only for the bootstrap pass, the same test the table title uses.
    const modeTxt  = msg.assetRanges
        ? 'Historical returns (1928–2025)'
        : 'Synthetic returns (parametric μ/σ)';
    // The synthetic plan-scope fallback carries no family or param, so name it in plain words
    // rather than rendering an empty "(📍 )".
    const name     = (_stripHtml(v.strategyFamily) + (v.paramLabel ? ' ' + v.paramLabel : '')).trim()
                     || 'your current settings';
    const tip      = 'Chance of success for the plan currently in the sidebar: the share of simulated '
                   + 'paths in which it never ran out of money. It is the thick line on the chart'
                   + (_mcScope === 'plan' ? '.' : ', and the row marked 📍 in the table below.');

    el.innerHTML =
        `<div title="${escapeHtml(tip)}" style="display:flex;align-items:center;gap:12px;background:${band.bg};`
        + `border-radius:6px;padding:10px 14px;margin-bottom:8px;">${chev}`
        + `<div style="font-size:1.9em;font-weight:700;line-height:1;color:${band.fg};white-space:nowrap;">${pct}%</div>`
        + `<div style="font-size:0.92em;color:#333;">Chance of success for <strong>your plan</strong> `
        + `(📍 ${escapeHtml(name)}): it survives ${survived.toLocaleString()} of ${total.toLocaleString()} paths. `
        + `Median ending balance $${fmt(Math.round(finalBal))}. `
        + `<span style="color:#666;">${modeTxt}.</span></div></div>`;
    el.style.display = '';
}

// Summary-bar tile. Visible on EVERY tab, which is the point: after the stress pass started
// refreshing on each input change it became the only Monte Carlo number that is always current.
// Deliberately not written by updateStats() in optimizer_ui.js -- that runs on every
// runSimulation() and would blank the tile between stress passes.
function updateStressStat(stress) {
    const el = document.getElementById('stat-stress');
    if (!el) return;
    const cell = el.closest('div[title]') ?? el.parentElement;
    const s = stressFailureSummary(stress);
    if (!s) {
        el.textContent = '—';
        el.style.color = '';
        if (cell) cell.title = stressTooltipBase(null) + '\n\nStill measuring.';
        return;
    }
    el.textContent = `${s.failures} of ${s.total} fail`;
    el.style.color = s.fg;
    if (cell) cell.title = stressTooltip(s);
}

// --- Time estimate --------------------------------------------------------

// Wall time as a button label reads it: "0.4 sec", "43 sec", "2 min 5 sec".
function _mcDuration(ms) {
    const s = ms / 1000;
    // One decimal below 10 seconds: the difference between 1.2 and 1.9 is most of the reason to read
    // the label at all, and rounding both to "1 sec" or "2 sec" throws that away.
    if (s < 10) return s.toFixed(1) + ' sec';
    if (s < 60) return Math.round(s) + ' sec';
    const m = Math.floor(s / 60), rem = Math.round(s - m * 60);
    return rem ? `${m} min ${rem} sec` : `${m} min`;
}

// Each run button states its own expected cost on this machine, so the expensive one announces
// itself before it is clicked rather than after. The estimate is approximate until a real run has
// been observed; the "about" prefix says so, and drops once the model has measured something.
function updateMCTimeEstimate() {
    const totalEl  = document.getElementById('mc-sim-total');
    const planBtn  = document.getElementById('mc-run-plan-btn');
    const cmpBtn   = document.getElementById('mc-run-btn');
    if (!totalEl && !planBtn && !cmpBtn) return;

    const numPaths = _mcNum('mc-num-paths');
    const base     = getInputs();
    const numVar   = buildVariations(base).length;

    // Describes the Compare button alone: the path count is per strategy, so without the multiplier
    // the sweep looks ~144x smaller than it is.
    if (totalEl) {
        totalEl.textContent = `Compare runs ${simCountText(numPaths, numVar, mcPlanYears(base))}`;
    }

    const approx = mcTimingIsMeasured() ? '' : 'about ';
    if (planBtn) planBtn.textContent = `My Plan Only (${approx}${_mcDuration(estimateMCMs(numPaths, 1))})`;
    if (cmpBtn)  cmpBtn.textContent  = `Compare All Scenarios (${approx}${_mcDuration(estimateMCMs(numPaths, numVar))})`;
}

// --- Survival Table -------------------------------------------------------

// Comparison, not subtraction. Several sort keys use Infinity as "none" (no ruin year, no tax
// figure); subtracting two of those gives NaN, which makes the comparator incoherent and leaves
// the affected rows in whatever order the engine's sort happened to produce.
function _cmpSortValues(av, bv) {
    if (typeof av === 'string' || typeof bv === 'string') {
        return String(av ?? '').localeCompare(String(bv ?? ''));
    }
    if (av === bv) return 0;
    return av < bv ? -1 : 1;
}

let mcSortState = { colKey: 'survival', direction: 'desc' };

// Column defs mirror the Optimizer table's click-to-sort pattern (optimizer_ui.js
// getOptimizerColumns/sortOptimizerBy). Checkbox column is excluded — not sortable.
function getMCColumns() {
    return [
        { key: 'strategy', label: 'Strategy', title: null,
            getSortValue: v => _stripHtml(v.strategyFamily) },
        { key: 'param', label: 'Param', title: null,
            getSortValue: v => v.paramLabel ?? '' },
        { key: 'ruin', label: 'Exhausted',
            title: 'Median year across failed paths when the portfolio could no longer cover required spending',
            getSortValue: v => v.medianRuinYear ?? Infinity },
        { key: 'final', label: 'Final Balance',
            title: 'Median portfolio balance in the final plan year across all surviving paths',
            getSortValue: v => v.percentiles.p50[v.percentiles.p50.length - 1] ?? 0 },
        { key: 'survival', label: 'Survival', title: null,
            getSortValue: v => v.survivalRate },
        { key: 'tax', label: 'Total Taxes',
            title: 'Median lifetime taxes paid across all Monte Carlo paths',
            getSortValue: v => v.medianTax ?? Infinity },
        { key: 'spend', label: 'Total Spendable',
            title: "Median lifetime after-tax money actually spent across all Monte Carlo paths, in today's dollars (real). Strategies that cut spending — e.g. Guyton-Klinger — show a lower figure here.",
            getSortValue: v => v.medianSpend ?? -Infinity },
    ];
}

function sortMCTableBy(colKey) {
    if (mcSortState.colKey === colKey) {
        mcSortState.direction = mcSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        mcSortState.colKey = colKey;
        mcSortState.direction = 'asc';
    }
    if (_mcResults) renderSurvivalTable(_mcResults.variations, _mcResults.numPaths);
}

function renderSurvivalTable(variations, numPaths) {
    const tbody = document.getElementById('mc-table-body');
    const thead = document.getElementById('mc-table-header');
    if (!tbody) return;
    tbody.innerHTML = '';

    const columns = getMCColumns();
    const col = columns.find(c => c.key === mcSortState.colKey);

    // Render header cells with click-to-sort + arrow indicator (mirrors optimizer table).
    if (thead) {
        const hCellStyle = 'position:sticky;top:0;background:#f1f3f5;z-index:1;padding:4px 8px;text-align:right;white-space:nowrap;font-weight:600;border-bottom:1px solid #dee2e6;cursor:pointer;user-select:none;';
        const greenCols = new Set(['final', 'tax', 'spend']);
        thead.innerHTML = columns.map(c => {
            const active = mcSortState.colKey === c.key;
            const arrow = active ? (mcSortState.direction === 'asc' ? ' ▲' : ' ▼') : '';
            const tip = c.title ? ` title="${c.title.replace(/"/g, '&quot;')}"` : '';
            const colorCss = greenCols.has(c.key) ? 'color:#1a7a1a;' : '';
            return `<div style="${hCellStyle}${colorCss}"${tip} onclick="sortMCTableBy('${c.key}')">${c.label}${arrow}</div>`;
        }).join('');
    }

    // Sort by the active column. Default (survival, no user override) keeps the original
    // 3-key tiebreak: survival desc → final balance desc → total taxes asc.
    const sorted = variations
        .map((v, i) => ({ ...v, _origIdx: i }))
        .sort((a, b) => {
            if (!col) return 0;
            const cmp = _cmpSortValues(col.getSortValue(a), col.getSortValue(b));
            const primary = mcSortState.direction === 'asc' ? cmp : -cmp;
            if (primary !== 0) return primary;
            if (mcSortState.colKey === 'survival') {
                const aFinal = a.percentiles.p50[a.percentiles.p50.length - 1] ?? 0;
                const bFinal = b.percentiles.p50[b.percentiles.p50.length - 1] ?? 0;
                if (bFinal !== aFinal) return bFinal - aFinal;
                return (a.medianTax ?? Infinity) - (b.medianTax ?? Infinity);
            }
            return primary;
        });

    // Your own plan is lifted out of the ranking and locked to the top, whatever the sort. It is the
    // one row you came to read, and in a 144-row table sorted by somebody else's metric it was
    // effectively unfindable. -1 means the exact sidebar plan is not among the swept strategies
    // (every swept row runs with conversions forced on), in which case nothing is pinned.
    const pinAt = sorted.findIndex(v => v._origIdx === _mcPinIdx);
    if (pinAt > 0) sorted.unshift(sorted.splice(pinAt, 1)[0]);

    sorted.forEach(v => {
        const isPinned = v._origIdx === _mcPinIdx;
        const pct     = (v.survivalRate * 100).toFixed(1);
        const ruinTxt = v.medianRuinYear ? String(v.medianRuinYear) : '—';
        const color   = survivalBand(v.survivalRate).bg;

        const row = document.createElement('div');
        row.style.display = 'contents';
        row.dataset.varIdx = v._origIdx;

        const taxTxt   = v.medianTax != null ? '$' + fmt(Math.round(v.medianTax)) : '—';
        const spendTxt = v.medianSpend != null ? '$' + fmt(Math.round(v.medianSpend)) : '—';
        // The pinned row keeps its survival-band background so it still reads on the same scale as
        // everything else; the rule under it separates it from the ranked body.
        const cellCss = `padding:2px 8px;text-align:right;background:${color};cursor:pointer;`
                      + (isPinned ? 'font-weight:600;border-bottom:2px solid #6c757d;' : '');

        // Checkbox cell: fixed white bg, no hand cursor
        const checkCell = document.createElement('div');
        checkCell.style.cssText = 'padding:2px 6px 2px 4px;text-align:center;background:#fff;border-right:2px solid #dee2e6;'
                                + (isPinned ? 'border-bottom:2px solid #6c757d;' : '');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'mc-var-check';
        cb.dataset.idx = String(v._origIdx);
        checkCell.appendChild(cb);
        row.appendChild(checkCell);

        // Data cells
        [
            (isPinned ? '📍 ' : '') + v.strategyFamily,
            escapeHtml(v.paramLabel),
            ruinTxt,
            '$' + fmt(v.percentiles.p50[v.percentiles.p50.length - 1]),
            `<strong>${pct}%</strong>`,
            taxTxt,
            spendTxt,
        ].forEach(html => {
            const cell = document.createElement('div');
            cell.style.cssText = cellCss;
            cell.innerHTML = html;
            row.appendChild(cell);
        });

        cb.addEventListener('change', (e) => {
            e.stopPropagation();
            const idx = parseInt(cb.dataset.idx);
            if (cb.checked) _mcSelected.add(idx);
            else _mcSelected.delete(idx);
            renderMCChart(_mcResults);
            renderStressChart(_mcResults?.stress);
        });

        row.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return;
            loadMCVariation(v);
        });

        tbody.appendChild(row);
    });

    document.getElementById('mc-table-wrap').style.display = '';
    // Paths are per strategy, so the honest size of the run is the product. Both readouts say so.
    const _pathTxt = simCountText(numPaths, variations.length, _mcResults?.years ?? mcPlanYears(_mcBase));
    const _pcBar = document.getElementById('mc-path-count');
    const _pcTbl = document.getElementById('mc-path-count-tbl');
    if (_pcBar) _pcBar.textContent = _pathTxt;
    if (_pcTbl) _pcTbl.textContent = _pathTxt;

    // Populate table title: Spend Goal + simulation mode
    const titleEl = document.getElementById('mc-table-title');
    if (titleEl && _mcBase) {
        const spendFmt = _mcBase.spendGoal != null
            ? '$' + Math.round(_mcBase.spendGoal).toLocaleString()
            : '—';
        const modeLabel = _mcResults?.assetRanges != null
            ? 'Historical (1928–2025)'
            : 'Synthetic';
        titleEl.textContent = `Spend Goal: ${spendFmt}  ·  ${modeLabel}`;
    }
}

function loadMCVariation(v) {
    if (!v.strategy) return;
    document.getElementById('strategy').value = v.strategy;
    if (v.strategy === 'propwd'    && v.propWithdraw   != null) document.getElementById('propWithdraw').value   = Math.round(v.propWithdraw * 100);
    if (v.strategy === 'fixed'     && v.nYears         != null) document.getElementById('nYears').value          = v.nYears;
    if (v.strategy === 'bracket'   && v.stratRate      != null) document.getElementById('stratRate').value       = Math.round(v.stratRate * 100);
    if (v.strategy === 'fixedpct'  && v.iraWithdrawPct != null) document.getElementById('iraWithdrawPct').value  = Math.round(v.iraWithdrawPct * 100);
    document.getElementById('convertExcessToRoth').checked = !!v.convertExcessToRoth;
    const fccEl = document.getElementById('fundConversionWithCash');
    if (fccEl) fccEl.checked = !!v.fundConversionWithCash;
    onConvSubFlagChange();
    const cyclicEl = document.getElementById('cyclicEnabled');
    if (cyclicEl) { cyclicEl.checked = !!v.cyclicEnabled; onCyclicChange(); }
    const cyclicOrderEl = document.getElementById('cyclicOrder');
    if (cyclicOrderEl) cyclicOrderEl.value = v.cyclicOrder ?? 'ira-first';
    if (v.spendGoal != null) DisplayHelpers.setDollarValue('spendGoal', Math.round(v.spendGoal));
    toggleStrategyUI();
    runSimulation();
    showTab('tab-chart');
}

function syncTableCheckboxes() {
    document.querySelectorAll('.mc-var-check').forEach(cb => {
        cb.checked = _mcSelected.has(parseInt(cb.dataset.idx));
    });
}

// --- Chart ----------------------------------------------------------------

// One color hue per strategy family, semi-transparent fills for bands.
const FAMILY_COLORS = {
    'Proportional': { solid: '#1565C0', band75: 'rgba(21,101,192,0.18)', band95: 'rgba(21,101,192,0.08)' },
    'Reduce':       { solid: '#2E7D32', band75: 'rgba(46,125,50,0.18)',  band95: 'rgba(46,125,50,0.08)'  },
    'Fill Bracket': { solid: '#E65100', band75: 'rgba(230,81,0,0.18)',   band95: 'rgba(230,81,0,0.08)'   },
    'IRA Draw':     { solid: '#6A1B9A', band75: 'rgba(106,27,154,0.18)', band95: 'rgba(106,27,154,0.08)' },
};
// Fallback palette for unexpected family names
const FALLBACK_PALETTE = [
    { solid: '#00695C', band75: 'rgba(0,105,92,0.18)',   band95: 'rgba(0,105,92,0.08)'   },
    { solid: '#AD1457', band75: 'rgba(173,20,87,0.18)',  band95: 'rgba(173,20,87,0.08)'  },
];

function colorFor(familyName, fallbackIdx) {
    return FAMILY_COLORS[familyName]
        ?? FALLBACK_PALETTE[fallbackIdx % FALLBACK_PALETTE.length];
}

// Stress colors encode the OUTCOME, not the ranking. The old gradient ran dark red to amber by how
// bad the starting stretch was, which is the reason a sequence was chosen, not what happened to the
// plan in it -- a scenario that survived comfortably could still be drawn in alarm red.
//   red    ran out of money inside the scoring window (the bad opening stretch)
//   amber  ran out later, after absorbing the opening
//   green  never ran out
// Both failure bands say plainly "Ruin". Early versus late is what the color is for, and the Ruin
// Year and Yrs to Ruin columns give the precise answer, so spelling it out a third time in the
// Outcome cell added width without adding information.
const STRESS_OUTCOME_COLORS = {
    'ruin-early': { line: '#c0392b', row: '#f8d7da', text: 'Ruin'     },
    'ruin-late':  { line: '#e69500', row: '#fff3cd', text: 'Ruin'     },
    'survive':    { line: '#1a7f37', row: '#d4edda', text: 'Survives' },
};

// Same hue, walked slightly lighter down the group, so five red lines are still tellable apart on
// the chart. The table below is the authoritative key; this only keeps the lines from merging.
function _stressLineColor(band, posInBand, bandSize) {
    const hex = STRESS_OUTCOME_COLORS[band]?.line ?? '#666666';
    const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m || bandSize <= 1) return hex;
    const t = posInBand / (bandSize - 1);          // 0 at the head of the group, 1 at the tail
    const [r, g, b] = m.slice(1).map(x => parseInt(x, 16));
    const lift = (c) => Math.round(c + (255 - c) * t * 0.45);
    return `rgb(${lift(r)},${lift(g)},${lift(b)})`;
}

// Above this many scenarios the chart switches to the de-emphasis palette below. Ten distinguishable
// lines is a chart; ninety-eight is a field, and the only thing worth seeing in a field is the
// failures.
const STRESS_DENSE_THRESHOLD = 20;

// Dense mode: survivors recede, failures stay solid. The lightness ramp that keeps ten lines apart
// does nothing useful at ninety-eight, and the question at that density is not "which line is 1966"
// (the table answers that) but "how much of the record breaks this plan".
const STRESS_DENSE_STYLE = {
    'survive':    { color: 'rgba(26,127,55,0.20)',  width: 1,   z: 0 },
    'ruin-late':  { color: 'rgba(230,149,0,0.80)',  width: 1.5, z: 1 },
    'ruin-early': { color: 'rgba(192,57,43,1)',     width: 2,   z: 2 },
};

// Strip HTML tags from a strategy family name (may contain icon spans).
function _stripHtml(s) { return String(s ?? '').replace(/<[^>]+>/g, '').trim(); }

// Legend onClick: click once to isolate that item, click again to restore all.
// For normal (percentile band) mode: "item" = one strategy = 5 consecutive datasets.
// For stress mode: "item" = one scenario dataset.
// Isolate/restore one stress line, from a click on that scenario's table row. The stress chart has
// no legend any more, so this is the only way in; the second click restores all.
function _isolateStressDataset(dsIdx) {
    const chart = _mcStressChart;
    if (!chart) return;
    const total = chart.data.datasets.length;
    const key = `ds${dsIdx}`;
    if (_legendIsolatedKeyStress === key) {
        for (let i = 0; i < total; i++) chart.setDatasetVisibility(i, true);
        _legendIsolatedKeyStress = null;
    } else {
        for (let i = 0; i < total; i++) chart.setDatasetVisibility(i, i === dsIdx);
        _legendIsolatedKeyStress = key;
    }
    // The hover tooltip is only meaningful with exactly one line showing: at interaction mode
    // 'index' it otherwise lists every scenario's balance for the hovered year.
    if (chart.options?.plugins?.tooltip) {
        chart.options.plugins.tooltip.enabled = (_legendIsolatedKeyStress !== null);
    }
    chart.update();
}

// Legend onClick for the MAIN (percentile band) chart: one legend "item" is one strategy, which is
// 5 consecutive datasets. Click once to isolate that strategy, click again to restore all.
// The stress chart used to share this via an isStress flag; it has no legend now, and its isolate
// path is _isolateStressDataset() driven by the scenario table.
function _makeLegendClick() {
    return function (e, legendItem, legend) {
        const chart = legend.chart;
        const clickedDs = legendItem.datasetIndex;
        const total = chart.data.datasets.length;
        const key = `strat${Math.floor(clickedDs / 5)}`;

        if (_legendIsolatedKey === key) {
            // Already isolated this item — restore all
            for (let i = 0; i < total; i++) chart.setDatasetVisibility(i, true);
            _legendIsolatedKey = null;
        } else {
            // Isolate: hide everything except the clicked item's group
            for (let i = 0; i < total; i++) {
                chart.setDatasetVisibility(i, Math.floor(i / 5) === Math.floor(clickedDs / 5));
            }
            _legendIsolatedKey = key;
        }
        chart.update();
    };
}

function renderMCChart(msg) {
    const canvas = document.getElementById('mc-chart');
    if (!canvas || !msg?.variations?.length) return;

    const years  = msg.years;
    const labels = Array.from({ length: years }, (_, i) => _mcStartYear + i);

    const inCurrentDollars = document.getElementById('show-current-dollars')?.checked;
    const inflRate = msg.inflationStats?.cagr ?? msg.inflationRate ?? 0;
    const deflate = (arr) => {
        if (!inCurrentDollars || !arr) return arr;
        return arr.map((v, y) => v / Math.pow(1 + inflRate, y + 1));
    };

    _legendIsolatedKey = null;   // reset on each fresh render
    const datasets = [];

    // 5 datasets per selected variation (bands + median). Dataset order within each block:
    //   base+0: p5   (anchor, hidden line)
    //   base+1: p95  (fill to base+0 → outer band)
    //   base+2: p25  (anchor, hidden line)
    //   base+3: p75  (fill to base+2 → inner band)
    //   base+4: p50  (visible median line)
    // Draw the pinned plan's block FIRST so it is datasets 0-4 and sits at the top of the legend.
    // Blocks must stay contiguous groups of five — the legend and tooltip filters below select the
    // median of each block with `datasetIndex % 5 === 4`.
    let fallbackIdx = 0;
    const selectedIdxs = Array.from(_mcSelected);
    // Kept on the module so the tooltip can map a dataset index back to its variation. It used to
    // read Array.from(_mcSelected) directly, which is the SET's insertion order and no longer
    // matches the drawing order once the pinned plan is hoisted to the front.
    _mcDrawOrder = _mcSelected.has(_mcPinIdx)
        ? [_mcPinIdx, ...selectedIdxs.filter(i => i !== _mcPinIdx)]
        : selectedIdxs;
    _mcDrawOrder.forEach(idx => {
        const v    = msg.variations[idx];
        if (!v) return;
        const isPinned = idx === _mcPinIdx;
        const c    = colorFor(v.strategyFamily, fallbackIdx++);
        const base = datasets.length;
        // One `order` for the whole 5-dataset block. Chart.js draws higher order first (behind), so
        // giving only the median a lower order would sink the OTHER strategies' medians beneath the
        // pinned block's translucent band fills. Blocks move as units instead.
        const ord  = isPinned ? 0 : 1;
        datasets.push({ label: `${v.label} p5`,  data: deflate(v.percentiles.p5),
            borderColor: 'transparent', backgroundColor: 'transparent',
            pointRadius: 0, fill: false, tension: 0.3, order: ord });
        datasets.push({ label: `${v.label} p95`, data: deflate(v.percentiles.p95),
            borderColor: 'transparent', backgroundColor: c.band95,
            pointRadius: 0, fill: base, tension: 0.3, order: ord });
        datasets.push({ label: `${v.label} p25`, data: deflate(v.percentiles.p25),
            borderColor: 'transparent', backgroundColor: 'transparent',
            pointRadius: 0, fill: false, tension: 0.3, order: ord });
        datasets.push({ label: `${v.label} p75`, data: deflate(v.percentiles.p75),
            borderColor: 'transparent', backgroundColor: c.band75,
            pointRadius: 0, fill: base + 2, tension: 0.3, order: ord });
        datasets.push({
            // 📍 and the heavier stroke mark the sidebar's own plan. Chart.js draws lower `order`
            // last, i.e. on top, so the pinned median is never buried under a competing strategy.
            label: (isPinned ? '📍 ' : '') + v.label + ` (${(v.survivalRate * 100).toFixed(0)}%)`,
            data:  deflate(v.percentiles.p50),
            borderColor: c.solid, backgroundColor: 'transparent',
            borderWidth: isPinned ? 4 : 2.5, pointRadius: 0, fill: false, tension: 0.3,
            order: ord,
        });
    });

    if (_mcChart) {
        _mcChart.destroy();
        _mcChart = null;
    }

    const legendLabels = { filter: (item) => item.datasetIndex % 5 === 4, font: { size: 12 }, usePointStyle: true, pointStyle: 'line', boxWidth: 24 };
    const legendClick = _makeLegendClick();

    const tooltipCfg = {
        filter: (item) => item.datasetIndex % 5 === 4,
        callbacks: {
            title: (items) => `Year ${items[0]?.label ?? ''}`,
            label: (ctx) => {
                const v = _mcResults?.variations[_mcDrawOrder[Math.floor(ctx.datasetIndex / 5)]];
                const val = v?.percentiles?.p50?.[ctx.dataIndex];
                const name = v ? v.label : ctx.dataset.label;
                return `  ${name}  $${fmt(val)}`;
            },
        },
    };

    _mcChart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: legendLabels, onClick: legendClick, ...datasetHoverHighlight(5) },
                tooltip: tooltipCfg,
            },
            scales: {
                x: { title: { display: true, text: 'Year' }, ticks: { maxTicksLimit: 10 } },
                y: {
                    title: { display: true, text: inCurrentDollars ? 'Portfolio Balance (Current $)' : 'Portfolio Balance' },
                    ticks: {
                        callback: (v) => '$' + (v >= 1e6
                            ? (v / 1e6).toFixed(1) + 'M'
                            : (v / 1e3).toFixed(0) + 'K'),
                    },
                },
            },
        },
    });

    document.getElementById('mc-chart-wrap').style.display = '';
}

// Stress-test chart — auto-computed alongside Historical mode (Item 7). `stress` is msg.stress
// (the nested stress-pass payload from the worker), or null in Synthetic mode.
function renderStressChart(stress) {
    const wrap   = document.getElementById('mc-stress-chart-wrap');
    const canvas = document.getElementById('mc-stress-chart');
    if (!wrap || !canvas) return;

    if (!stress || !stress.variations?.length) {
        wrap.style.display = 'none';
        const tblWrap = document.getElementById('mc-stress-table-wrap');
        if (tblWrap) tblWrap.style.display = 'none';
        if (_mcStressChart) { _mcStressChart.destroy(); _mcStressChart = null; }
        renderMCStressMetrics(null);   // clears the headline and the summary-bar tile too
        return;
    }

    // stress.years is set by the stress-only refresh, which can happen before any full sweep has
    // run; _mcResults.years covers the full-run path.
    const years  = stress.years ?? _mcResults?.years ?? 0;
    const labels = Array.from({ length: years }, (_, i) => _mcStartYear + i);

    const inCurrentDollars = document.getElementById('show-current-dollars')?.checked;
    const inflRate = stress.inflationStats?.cagr ?? 0;
    // One deflator for both the lines and the table's Final Balance column, so the two cannot show
    // the same quantity on different bases.
    const deflateOne = (v, y) => inCurrentDollars ? v / Math.pow(1 + inflRate, y + 1) : v;
    const deflate = (arr) => (!inCurrentDollars || !arr) ? arr : arr.map(deflateOne);

    _legendIsolatedKeyStress = null;   // reset on each fresh render
    const datasets = [];

    // Stress always runs against exactly one variation now (the current withdrawal
    // strategy/options — see runMonteCarlo()'s stressVariations) — one line per historical
    // scenario. Legend entries are deliberately terse ("1966 ✗2041"): ten copies of the old
    // "1966 (eq: … inf: … real: …)" label crowded out the chart itself. Every statistic that used
    // to live in the label now has a column in the table under the chart.
    const rows  = buildStressRows(stress, deflateOne);
    const dense = rows.length > STRESS_DENSE_THRESHOLD;
    rows.forEach((r, pos) => {
        const ds = STRESS_DENSE_STYLE[r.band] ?? STRESS_DENSE_STYLE['survive'];
        datasets.push({
            label:           stressShortLabel(r),
            data:            deflate(r.path),
            borderColor:     dense ? ds.color : _stressLineColor(r.band, r.posInBand, r.bandSize),
            backgroundColor: 'transparent',
            borderWidth:     dense ? ds.width : 1.8,
            // Chart.js draws lower `order` last, i.e. on top. Failures therefore sit above the
            // survivor haze instead of being buried under ninety-odd green lines.
            order:           dense ? (2 - ds.z) : 0,
            pointRadius:     0,
            fill:            false,
            tension:         0.3,
            // Where the sequence runs off the end of the record and starts replaying 1928, the line
            // goes dashed. Only late start years reach it: a 2015 start on a 30-year plan has 11
            // real years and then 19 of replay, and that is worth seeing rather than inferring.
            segment: (r.realYears != null && r.realYears < r.path.length)
                ? { borderDash: ctx => ctx.p0DataIndex >= r.realYears - 1 ? [4, 3] : undefined }
                : undefined,
        });
        r.dsIdx = pos;   // chart dataset index, so a table row click can isolate its own line
    });

    if (_mcStressChart) {
        _mcStressChart.destroy();
        _mcStressChart = null;
    }

    // No legend. Every column of it is already a column of the table below, with more room and a
    // sort, and one legend entry per scenario crowded out the plot itself. Isolating a line is what
    // the legend was still good for; clicking the matching table row does that.
    //
    // The tooltip starts off. interaction.mode is 'index', so a hover with nothing isolated prints
    // EVERY line's balance for that year -- a wall of text that grows with the scenario count and
    // says nothing the table does not. It is switched on only while exactly one line is isolated,
    // by _isolateStressDataset().
    const tooltipCfg = {
        enabled: false,
        callbacks: {
            title: items => `Year ${items[0]?.label ?? ''}`,
            label: ctx => `  ${ctx.dataset.label}: $${fmt(ctx.parsed.y)}`,
        },
    };

    _mcStressChart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: tooltipCfg,
            },
            scales: {
                x: { title: { display: true, text: 'Year' }, ticks: { maxTicksLimit: 10 } },
                y: {
                    title: { display: true, text: inCurrentDollars ? 'Portfolio Balance (Current $)' : 'Portfolio Balance' },
                    ticks: {
                        callback: (v) => '$' + (v >= 1e6
                            ? (v / 1e6).toFixed(1) + 'M'
                            : (v / 1e3).toFixed(0) + 'K'),
                    },
                },
            },
        },
    });

    const descEl = document.getElementById('mc-stress-chart-desc');
    if (descEl) {
        const anyWrap = rows.some(r => r.realYears != null && r.realYears < r.path.length);
        descEl.textContent = `For your current plan. Each line is one historical starting sequence, ${stressSelectionLabel(stress)}. `
            + `Red ran out of money in the first half of your plan, amber in the second half, green never ran out. `
            + (anyWrap ? `A dashed tail is where that sequence runs past the end of the record and replays it from 1928. ` : '')
            + `The table below names every line and gives the numbers behind it. Click a row to isolate its line and read its balances by hovering over it; click again to restore all.`;
    }

    renderStressTable(stress, rows);
    renderMCStressMetrics(stress);
    wrap.style.display = '';
}

// One row per stress scenario, in display order. Same array backs the chart datasets and the table,
// so the legend and the table can never fall out of step.
// Default order is worst-outcome-first: everything that ran out of money, earliest failure first,
// then the survivors by how much they ended with. Ranking by starting-decade severity (the old
// order) buried a plan-killing scenario below one the plan shrugged off.
function buildStressRows(stress, deflateOne = (v) => v) {
    const v = stress?.variations?.[0];
    if (!v?.stressPaths?.length) return [];
    const startYears = stress.startYears ?? [];
    const ruinYears  = v.ruinYearsPerPath ?? [];
    const planYears  = stress.years ?? _mcResults?.years ?? v.stressPaths[0].length;
    const worst      = stress.worstRealCAGRs ?? {};

    const rows = v.stressPaths.map((path, rank) => {
        const startYear = startYears[rank] ?? null;
        // Older cached workers did not send per-scenario ruin years. Fall back to reading the trace:
        // a ruined path is pinned at $0 from the year it failed.
        const zeroAt    = path.findIndex(b => b <= 0);
        const ruinYear  = ruinYears[rank] || (zeroAt >= 0 ? _mcStartYear + zeroAt : 0);
        const realYears = stress.realYears?.[rank] ?? null;
        return {
            rank, startYear, ruinYear, path, realYears,
            // Both measured from the PLAN's first calendar year, never from startYear. startYear is
            // the historical year the return sequence is taken from (1973, 1929); the money runs out
            // on the plan's own clock, so 1973 → ruin 2037 is 11 years in, not 64.
            band:        stressOutcomeBand(_mcStartYear, ruinYear, planYears),
            yearsToRuin: ruinYear ? ruinYear - _mcStartYear : null,
            finalBalance: deflateOne(path[path.length - 1] ?? 0, path.length - 1),
            // Full-horizon, on the sequence this scenario actually lived through.
            realCAGR:  stress.realCAGRs?.[rank] ?? null,
            eqCAGR:    stress.eqCAGRs?.[rank] ?? null,
            bdCAGR:    stress.bondCAGRs?.[rank] ?? null,
            itCAGR:    stress.intlCAGRs?.[rank] ?? null,
            infCAGR:   stress.inflationCAGRs?.[rank] ?? null,
            // Worst rolling stretch of each length ANYWHERE inside this scenario, not just at its
            // start. A sequence can open calmly and still contain the decade that breaks the plan.
            worstReal: { 5:  worst[5]?.[rank]  ?? null, 10: worst[10]?.[rank] ?? null,
                         15: worst[15]?.[rank] ?? null, 20: worst[20]?.[rank] ?? null },
            nominatedBy: stress.nominatedBy?.[rank] ?? [],
        };
    });

    const sorted = sortStressRows(rows);

    // Position within the color group, for the lightness ramp that keeps same-color lines apart.
    const counts = {};
    sorted.forEach(r => { counts[r.band] = (counts[r.band] ?? 0) + 1; });
    const seen = {};
    sorted.forEach(r => {
        r.posInBand = seen[r.band] = (seen[r.band] ?? -1) + 1;
        r.bandSize  = counts[r.band];
    });
    return sorted;
}

// Row hover text: the per-asset rates behind the Real CAGR column, which windows flagged this start
// year, and where the sequence leaves the real record.
function stressRowDetail(r) {
    const p = (v, invert) => v == null ? 'n/a'
        : (v >= 0 && !invert ? '+' : '') + (v * 100).toFixed(1) + '%';
    const bits = [
        `${r.startYear ?? '?'} sequence, over the whole plan:`,
        `  Equity ${p(r.eqCAGR)}   Bonds ${p(r.bdCAGR)}   Intl ${p(r.itCAGR)}   Inflation ${p(r.infCAGR, true)}`,
        `  Real ${p(r.realCAGR)} after inflation`,
    ];
    if (r.nominatedBy?.length) {
        bits.push(`Flagged as one of the worst by the ${r.nominatedBy.join(', ')} year window`
                + (r.nominatedBy.length > 1 ? 's.' : '.'));
    } else {
        bits.push('Not among the worst by any ranking window; included because you asked for all start years.');
    }
    if (r.realYears != null && r.path && r.realYears < r.path.length) {
        bits.push(`Real record runs out after ${r.realYears} years (${(r.startYear ?? 0) + r.realYears - 1}); `
                + `the dashed tail replays the record from 1928.`);
    }
    return bits.join('\n');
}

function stressShortLabel(r) {
    const yr = r.startYear ?? '?';
    return r.ruinYear ? `${yr} ✗${r.ruinYear}` : `${yr} ✓`;
}

// --- Stress scenario table ------------------------------------------------

// 'ruin' ascending IS the worst-first default: survivors sort as Infinity so they land at the
// bottom, and the shared final-balance tiebreak then orders them richest first.
let stressSortState = { colKey: 'ruin', direction: 'asc' };

const _STRESS_BAND_RANK = { 'ruin-early': 0, 'ruin-late': 1, 'survive': 2 };

function getStressColumns() {
    return [
        { key: 'start', label: 'Start Year',
            title: 'The historical year this scenario begins in. Returns and inflation then follow the real record year by year.',
            getSortValue: r => r.startYear ?? 0 },
        { key: 'outcome', label: 'Outcome', title: null,
            getSortValue: r => _STRESS_BAND_RANK[r.band] ?? 9 },
        { key: 'ruin', label: 'Ruin Year',
            title: 'The year the portfolio could no longer cover required spending. Blank means it never did.',
            getSortValue: r => r.ruinYear || Infinity },
        { key: 'yrs', label: 'Yrs to Ruin',
            title: 'Years from the start of the plan to the year the money ran out.',
            getSortValue: r => r.yearsToRuin ?? Infinity },
        { key: 'real', label: 'Real CAGR',
            title: 'Inflation-adjusted equity CAGR over your WHOLE plan, on the sequence this scenario actually lived through (Fisher equation). This used to be measured over the ranking window instead, which stopped meaning anything once the windows could be combined or skipped. Hover over the row for the equity, bond, international and inflation rates behind it.',
            getSortValue: r => r.realCAGR ?? 0 },
        ...[5, 10, 15, 20].map(w => ({
            key: `w${w}`, label: `Worst ${w}`,
            title: `The worst real CAGR over any ${w} consecutive years anywhere inside this scenario, not just at its start. This is the ${w}-year stretch that did the damage. Blank when your plan is shorter than ${w} years.`,
            getSortValue: r => r.worstReal?.[w] ?? 0,
        })),
        { key: 'final', label: 'Final Balance',
            title: 'Portfolio balance in the final plan year. $0 for a scenario that ran out.',
            getSortValue: r => r.finalBalance ?? 0 },
    ];
}

function sortStressRows(rows) {
    const col = getStressColumns().find(c => c.key === stressSortState.colKey);
    if (!col) return rows;
    return rows.slice().sort((a, b) => {
        const primary = _cmpSortValues(col.getSortValue(a), col.getSortValue(b))
                      * (stressSortState.direction === 'asc' ? 1 : -1);
        if (primary !== 0) return primary;
        return (b.finalBalance ?? 0) - (a.finalBalance ?? 0);   // shared tiebreak: richest first
    });
}

function sortStressTableBy(colKey) {
    if (stressSortState.colKey === colKey) {
        stressSortState.direction = stressSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        stressSortState.colKey = colKey;
        stressSortState.direction = 'asc';
    }
    // Re-render the chart too: the datasets are built from the same ordered array, so the legend
    // follows the table rather than drifting out of step with it.
    renderStressChart(_mcResults?.stress ?? _mcStress);
}

// The statistics that used to be crammed into every chart legend entry, one row per scenario,
// shaded to match its line.
function renderStressTable(stress, rows) {
    const wrap  = document.getElementById('mc-stress-table-wrap');
    const thead = document.getElementById('mc-stress-table-header');
    const tbody = document.getElementById('mc-stress-table-body');
    if (!wrap || !tbody) return;
    if (!rows?.length) { wrap.style.display = 'none'; return; }

    const columns = getStressColumns();
    if (thead) {
        const hCellStyle = 'position:sticky;top:0;background:#f1f3f5;z-index:1;padding:4px 8px;text-align:right;'
                         + 'white-space:nowrap;font-weight:600;border-bottom:1px solid #dee2e6;cursor:pointer;user-select:none;';
        thead.innerHTML = columns.map(c => {
            const active = stressSortState.colKey === c.key;
            const arrow  = active ? (stressSortState.direction === 'asc' ? ' ▲' : ' ▼') : '';
            const tip    = c.title ? ` title="${c.title.replace(/"/g, '&quot;')}"` : '';
            return `<div style="${hCellStyle}"${tip} onclick="sortStressTableBy('${c.key}')">${c.label}${arrow}</div>`;
        }).join('');
    }

    tbody.innerHTML = '';
    rows.forEach(r => {
        const oc = STRESS_OUTCOME_COLORS[r.band] ?? STRESS_OUTCOME_COLORS['survive'];
        const row = document.createElement('div');
        row.style.display = 'contents';

        // Color chip in the leading cell, drawn in this line's exact color, so a line on the chart
        // and its row here are paired without counting legend entries.
        const swatch = document.createElement('div');
        swatch.style.cssText = `padding:2px 6px 2px 8px;background:${oc.row};border-right:2px solid #dee2e6;cursor:pointer;`;
        // Must match the line exactly, dense palette included, or the swatch stops being a key.
        const lineColor = rows.length > STRESS_DENSE_THRESHOLD
            ? (STRESS_DENSE_STYLE[r.band] ?? STRESS_DENSE_STYLE['survive']).color
            : _stressLineColor(r.band, r.posInBand, r.bandSize);
        swatch.innerHTML = `<span style="display:inline-block;width:18px;height:3px;vertical-align:middle;`
                         + `background:${lineColor};"></span>`;
        row.appendChild(swatch);

        const cellCss = `padding:2px 8px;text-align:right;background:${oc.row};cursor:pointer;white-space:nowrap;`;
        const pct = (v, invert) => v != null ? _mcPct(v, invert) : '—';
        // The asset-level detail that used to have its own columns. Four more columns of percentages
        // pushed the table past the width of the chart it explains, and they are supporting evidence
        // for the Real CAGR beside them rather than something you scan down. It goes on every CELL,
        // not on the row: the row is display:contents, so it generates no box and never gets hovered.
        const detail = stressRowDetail(r);
        swatch.title = detail;
        [
            { html: String(r.startYear ?? '—') },
            { html: oc.text },
            { html: r.ruinYear ? String(r.ruinYear) : '—' },
            { html: r.yearsToRuin != null ? String(r.yearsToRuin) : '—' },
            { html: pct(r.realCAGR) },
            { html: pct(r.worstReal?.[5])  },
            { html: pct(r.worstReal?.[10]) },
            { html: pct(r.worstReal?.[15]) },
            { html: pct(r.worstReal?.[20]) },
            { html: '$' + fmt(Math.round(r.finalBalance ?? 0)) },
        ].forEach(({ html, css }) => {
            const cell = document.createElement('div');
            cell.style.cssText = css ?? cellCss;
            cell.innerHTML = html;
            cell.title = detail;
            row.appendChild(cell);
        });

        row.addEventListener('click', () => _isolateStressDataset(r.dsIdx));
        tbody.appendChild(row);
    });

    wrap.style.display = '';
}

// --- Progress / State helpers ---------------------------------------------

function setMCRunning(running) {
    const runBtn     = document.getElementById('mc-run-btn');       // always visible now
    const planBtn    = document.getElementById('mc-run-plan-btn');  // ditto
    const cancelWrap = document.getElementById('mc-cancel-wrap');   // always-accessible cancel
    const progWrap   = document.getElementById('mc-progress-wrap');
    const runEst     = document.getElementById('mc-run-est');

    if (runBtn)     runBtn.disabled  = running;
    if (planBtn)    planBtn.disabled = running;
    // Use flex when showing so the cancel+path-count row lays out correctly.
    if (cancelWrap) cancelWrap.style.display = running ? 'flex' : 'none';
    if (progWrap)   progWrap.style.display   = running ? '' : 'none';
    if (!running) {
        updateMCProgress(0);
        if (runEst) runEst.textContent = '';
    } else if (runEst) {
        const numPaths = _mcNum('mc-num-paths');
        const base     = getInputs();
        // A plan-scope run is one variation, so the estimate has to follow the scope in flight or a
        // 0.2s run would announce half a minute.
        const numVar   = _mcScope === 'plan' ? 1 : buildVariations(base).length;
        runEst.textContent = `May take approximately ${_mcDuration(estimateMCMs(numPaths, numVar))} to complete`;
    }
}

function updateMCProgress(pct) {
    const bar  = document.getElementById('mc-progress-bar');
    const txt  = document.getElementById('mc-progress-txt');
    const pPct = Math.round(pct * 100);
    if (bar) { bar.style.width = pPct + '%'; }
    if (txt) { txt.textContent = pPct + '%'; }
}

// --- Input Distribution Fan Charts ----------------------------------------

function renderInputFanCharts(inputFan, years, sourceText) {
    if (!inputFan) return;
    const labels = Array.from({ length: years }, (_, i) => _mcStartYear + i);

    // Which run these charts describe. Without it, the fan silently kept showing the previous
    // run's draws after a mode or parameter change until the next full sweep.
    const srcEl = document.getElementById('mc-input-dist-src');
    if (srcEl) srcEl.textContent = sourceText ?? '';

    // Min/Max start visible: the extremes are half the point of the display, and a phone user
    // has no hover to discover the legend toggle with. One legend click hides them.
    const showExtremes = true;

    function buildDatasets(fan, solidColor, bandColor) {
        return [
            // [0] p10 anchor — transparent fill target; label shown in tooltip
            { label: 'p10', data: fan.p10, borderColor: 'transparent', backgroundColor: 'transparent',
              pointRadius: 0, fill: false, tension: 0.3 },
            // [1] p90 — fills down to p10 (shaded band); also shown in tooltip
            { label: 'p90', data: fan.p90, borderColor: 'transparent', backgroundColor: bandColor,
              pointRadius: 0, fill: '-1', tension: 0.3 },
            // [2] Median — solid line, always visible
            { label: 'Median', data: fan.p50, borderColor: solidColor,
              backgroundColor: 'transparent', borderWidth: 2,
              pointRadius: 0, fill: false, tension: 0.3 },
            // [3] Min — visible by default; click the legend to hide
            { label: 'Min', data: fan.min, borderColor: solidColor, borderDash: [4, 4],
              borderWidth: 1, backgroundColor: 'transparent',
              pointRadius: 0, fill: false, tension: 0.3, hidden: !showExtremes },
            // [4] Max — visible by default; click the legend to hide
            { label: 'Max', data: fan.max, borderColor: solidColor, borderDash: [4, 4],
              borderWidth: 1, backgroundColor: 'transparent',
              pointRadius: 0, fill: false, tension: 0.3, hidden: !showExtremes },
        ];
    }

    const yPctAxis = {
        ticks: { callback: v => (v * 100).toFixed(0) + '%' },
        grid:  { color: 'rgba(0,0,0,0.06)' },
    };
    const xAxis = { ticks: { maxTicksLimit: 10 } };

    // Legend: skip p10 anchor (idx 0) — the band already represents p10–p90 range visually.
    const legendCfg = {
        filter: item => item.datasetIndex !== 0,
        font: { size: 11 },
        usePointStyle: true,
        pointStyle: 'line',
    };

    // Tooltip: show all 5 values (including hidden Min/Max) formatted as percentages.
    // Dark background and solid label colors come from Chart.defaults (set globally in HTML).
    const tooltipCfg = {
        filter: () => true,  // include hidden datasets (Min/Max)
        callbacks: {
            title: items => `Year ${items[0]?.label ?? ''}`,
            label: ctx => {
                const v = ctx.parsed.y;
                const sign = v >= 0 ? '+' : '';
                return `  ${ctx.dataset.label}: ${sign}${(v * 100).toFixed(1)}%`;
            },
        },
    };

    function chartOpts(title) {
        return {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: legendCfg, ...datasetHoverHighlight() },
                tooltip: tooltipCfg,
                title: { display: true, text: title, font: { size: 12 } },
            },
            scales: { x: xAxis, y: yPctAxis },
        };
    }

    // Equity chart (both GBM and bootstrap)
    if (_inputEquityChart) _inputEquityChart.destroy();
    const eqCtx = document.getElementById('mc-input-equity-chart')?.getContext('2d');
    if (eqCtx) {
        _inputEquityChart = new Chart(eqCtx, {
            type: 'line',
            data: { labels, datasets: buildDatasets(inputFan.equity, '#1565C0', 'rgba(21,101,192,0.15)') },
            options: chartOpts('Equity Return Distribution (per year)'),
        });
    }

    // Inflation chart. Populated in every mode now: the synthetic modes build their own inflation
    // bank, so this is no longer blank outside Historical.
    const inflWrap = document.getElementById('mc-input-inflation-wrap');
    if (inflWrap) inflWrap.style.display = inputFan.inflation ? '' : 'none';
    if (_inputInflationChart) { _inputInflationChart.destroy(); _inputInflationChart = null; }
    if (inputFan.inflation) {
        const infCtx = document.getElementById('mc-input-inflation-chart')?.getContext('2d');
        if (infCtx) {
            _inputInflationChart = new Chart(infCtx, {
                type: 'line',
                data: { labels, datasets: buildDatasets(inputFan.inflation, '#E65100', 'rgba(230,81,0,0.15)') },
                options: chartOpts('Inflation Distribution (per year)'),
            });
        }
    }
}

// --- Utility --------------------------------------------------------------

function fmt(n) {
    if (!n && n !== 0) return '—';
    return Math.round(n).toLocaleString();
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

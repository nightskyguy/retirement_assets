// Main-thread interface to the Monte Carlo simulation.
// Uses a Web Worker on http:// (non-blocking). Falls back to chunked async on file://.
// Fallback requires prng.js and stats.js to be loaded on the main page first.

// ONE WORKER PER KIND OF JOB (P128). The Monte Carlo sweep and the risk-based rails solve
// (`cfg.kind === 'rails'`) run side by side: the rails panel re-solves on plan edits, and starting
// one must never terminate the other. Within a kind a new job still replaces the one in flight,
// which is what every Monte Carlo caller relies on.
const _mcWorkers = { mc: null, rails: null };
function _jobKind(cfg) {
    return cfg && cfg.kind === JOB_KIND.RAILS ? JOB_KIND.RAILS : JOB_KIND.MC;
}

// Launch a Monte Carlo run, or a rails solve.
// Calls onProgress(0..1) during the run, onComplete(resultsMsg) when done.
// cfg: { variations, numPaths, mu, sigma, seed, years } - or { kind: 'rails', base, preset, ... }
function runMCWorker(cfg, onProgress, onComplete) {
    const kind = _jobKind(cfg);
    if (_mcWorkers[kind]) {
        _mcWorkers[kind].terminate();
        _mcWorkers[kind] = null;
    }

    if (window.location.protocol === 'file:') {
        // Web Workers can't load file:// scripts due to browser security policy.
        // Fall back to chunked async execution on the main thread.
        _runMCFallback(cfg, onProgress, onComplete);
        return;
    }

    // Wall clock starts BEFORE the worker exists, because worker startup is the fixed term the
    // estimate needs and nothing inside the worker can see it.
    const _wallT0 = performance.now();
    const w = new Worker('montecarlo/worker.js?v=' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : Date.now()));
    _mcWorkers[kind] = w;

    w.onmessage = function (e) {
        const msg = e.data;
        if (msg.type === 'progress') {
            onProgress?.(msg.pct);
        } else if (msg.type === 'results') {
            if (_mcWorkers[kind] === w) _mcWorkers[kind] = null;
            // A stress-only refresh is a handful of sims against a different code path; folding it
            // into the model would drag the fixed term toward a number the run buttons never pay.
            // A rails job is a different shape of work altogether and prices itself.
            if (kind === 'mc' && !msg.stressOnly && !msg.error) {
                recordMCTiming(performance.now() - _wallT0, msg.totalMs, cfg.numPaths, cfg.variations?.length ?? 1);
            }
            if (kind === JOB_KIND.RAILS) msg.wallMs = performance.now() - _wallT0;
            onComplete?.(msg);
        }
    };

    w.onerror = function (e) {
        console.error('MC Worker error:', e.message, e);
        if (_mcWorkers[kind] === w) _mcWorkers[kind] = null;
        // If worker fails for any reason (e.g. late-detected security issue), retry on main thread.
        _runMCFallback(cfg, onProgress, onComplete);
    };

    w.postMessage(cfg);
}

// _runMCMainThread is async, so anything it throws surfaces as a rejected promise nobody awaits.
// Both call sites above used to drop it on the floor, which meant onComplete never ran: the caller's
// "a run is in flight" flags stayed set, the Cancel bar stayed up, and every later refresh returned
// at its own guard. The callback contract is that it ALWAYS fires, so failures come back as
// { error } the same way the worker reports them.
function _runMCFallback(cfg, onProgress, onComplete) {
    Promise.resolve()
        .then(() => _runMCMainThread(cfg, onProgress, onComplete))
        .catch((err) => {
            console.error('MC main-thread run failed:', err);
            onComplete?.({ type: 'results', kind: cfg && cfg.kind, error: String((err && err.message) || err) });
        });
}

// True while a Monte Carlo worker run is in flight. Callers that want to slip a cheap extra pass in
// (the stress-only refresh) check this first, because runMCWorker terminates any running worker of
// the same kind. A rails solve is a different kind and does not count.
function _mcWorkerBusy() {
    return _mcWorkers.mc !== null;
}

function cancelMCWorker(kind = 'mc') {
    if (_mcWorkers[kind]) {
        _mcWorkers[kind].terminate();
        _mcWorkers[kind] = null;
    }
    _mcCancelledKinds[kind] = true;
}

// ---- Throughput tracking (for time estimates) ------------------------------
//
// The run buttons state their own cost before you click, so the model has to describe WALL time on
// this machine, not simulation count. Two terms:
//
//   wall  =  fixed  +  msPerSim x paths x variations
//
// THE FIXED TERM IS NOT SMALL. Spawning the worker and running importScripts over taxengine.js,
// optimizer_core.js and four more (~370KB) is most of a second on its own, and the stress pass and
// input fan ride along on every run whatever its size. Dropping it tells a short plan run it will
// take under a second when it takes one and a half - fine as a relative hint, useless as the promise
// a button label makes.
//
// Both terms are learned from real runs on the actual machine. The seeds are a mid-range desktop and
// only ever describe the very first estimate, before any run has completed.
let _mcMsPerSim = 0.6;    // ms per (variation x path)
let _mcFixedMs  = 1050;   // worker startup + transfer + render: everything outside the sim loop
let _mcTimingMeasured = false;   // true once a real run has replaced the seeds
let _mcPerSimSims = 0;    // size of the run that produced the current msPerSim

// Estimated wall ms for a run of this shape. Never null: a rough number beats a blank button, and
// mcTimingIsMeasured() lets the caller mark it as approximate until a run has been observed.
function estimateMCMs(numPaths, numVariations) {
    return Math.round(_mcFixedMs + _mcMsPerSim * numPaths * numVariations);
}

function mcTimingIsMeasured() { return _mcTimingMeasured; }

// Fold one completed run into the model. wallMs is the caller's whole round trip; workerMs is what
// the worker reports for its own work.
//
// The two terms are measured SEPARATELY, from two numbers that do not depend on each other. Solving
// for both from wall time alone cannot work - one equation, two unknowns - so it would only
// redistribute the wall clock according to whatever the fixed term already was, and learn nothing.
//
//   fixed   = wall - workerMs. Directly the part no code inside the worker can see: spawning it,
//             importScripts over ~370KB, transferring results back, rendering.
//   perSim  = workerMs / sims. No fixed term involved at all.
//
// The largest run seen wins for perSim. A small run's figure is inflated because the stress pass and
// the input fan are amortized over few simulations - a real cost, but one that does not scale, so
// extrapolating from it over-predicts a big run.
function recordMCTiming(wallMs, workerMs, numPaths, numVariations) {
    const sims = numPaths * numVariations;
    if (!(wallMs > 0) || !(sims > 0)) return;
    if (Number.isFinite(workerMs) && workerMs >= 0) {
        _mcFixedMs = Math.max(0, wallMs - workerMs);
        if (sims >= 200 && workerMs > 0 && sims >= _mcPerSimSims) {
            _mcMsPerSim   = workerMs / sims;
            _mcPerSimSims = sims;
        }
    }
    _mcTimingMeasured = true;
}

// Run 1 path through all variations synchronously to seed _mcMsPerSim before any run has happened.
// Cold main-thread sims come out roughly 2x slower than the warmed worker (measured 1.21ms/sim here
// against 0.59 observed), so this is a starting point that the first real run corrects, not an
// answer. Takes ~1/numPaths of a full run.
function calibrateMCMs(cfg) {
    const { mu, sigma, seed, years, variations } = cfg;
    const rng = mulberry32(seed ?? MC_DEFAULTS.seed);
    const logDrift = mu - 0.5 * sigma * sigma;

    // Draw the way the selected mode draws. This is only a timing probe, so the difference is
    // immaterial to the measurement, but a probe that models something the run will not do is a
    // trap for the next reader.
    const returnSeq = new Float64Array(years);
    for (let y = 0; y < years; y++) {
        returnSeq[y] = drawSyntheticReturn(cfg.simulationMode, mu, sigma, logDrift, boxMuller(rng));
    }

    const t0 = performance.now();
    for (const v of variations) {
        try { simulate({ ...v, returnSequence: returnSeq }); } catch (e) {}
    }
    // probeMs covers 1 path × all variations; normalize to per (variation × path), then halve to
    // undo the cold-start penalty. Left as a seed: _mcTimingMeasured stays false.
    if (variations.length) _mcMsPerSim = (performance.now() - t0) / variations.length / 2;
}

// ---- Synchronous (chunked) fallback ----------------------------------------
// Web Workers cannot load file:// scripts, so on file:// the run happens on the main thread instead,
// chunked so the page keeps a frame to itself. This was a ~370-line hand-kept copy of worker.js and
// is now a set of hooks: since P71 both paths call the one engine in mc_engine.js, and the only
// difference between them is that this one has a UI to keep alive and a Cancel button to answer.

const _mcCancelledKinds = { mc: false, rails: false };
// Rails jobs on the main thread SUPERSEDE each other, the way a new worker replaces the old one: an
// auto-run re-solve must not leave the previous solve grinding on underneath it. The Monte Carlo
// kind keeps its own long-standing behavior here.
let _railsMainThreadGen = 0;

async function _runMCMainThread(cfg, onProgress, onComplete) {
    const kind = _jobKind(cfg);
    _mcCancelledKinds[kind] = false;
    const gen = kind === JOB_KIND.RAILS ? ++_railsMainThreadGen : 0;
    const superseded = () => kind === JOB_KIND.RAILS && gen !== _railsMainThreadGen;
    const t0 = performance.now();

    // Yield on a TIME budget, not on a loop counter. This used to yield once every 5 variations,
    // which was fine while every run swept ~144 of them but blocks the page solid for a run with a
    // single variation and a large path count (plan scope at 10,000 paths): one yield, then the
    // whole inner path loop with nothing giving the UI a turn. Chrome puts up "Page unresponsive".
    // 16ms is one frame, so the progress bar keeps moving and Cancel stays clickable.
    let _lastYield = performance.now();

    const job = kind === JOB_KIND.RAILS ? runRailsJob : runJob;
    const msg = await job(cfg, {
        onProgress:   pct => { if (!superseded()) onProgress?.(pct); },
        shouldCancel: () => _mcCancelledKinds[kind] || superseded(),
        yieldIfDue:   async () => {
            if (performance.now() - _lastYield < 16) return;
            await new Promise(r => setTimeout(r, 0));
            _lastYield = performance.now();
        },
    });

    // Canceled mid-pass. Report nothing, which is what leaves the previous results on screen.
    if (!msg) return;

    if (kind === JOB_KIND.RAILS) {
        msg.wallMs = performance.now() - t0;
        onComplete?.(msg);
        return;
    }

    // Same model as the worker path. On file:// there is no worker to spawn, so wall and worker time
    // are the same clock and the fixed term learns ~0 -- correct, the run really is cheaper to start.
    // The stress-only refresh is not timed: it is one pass over one variation and would teach the
    // estimator a per-sim cost that no full run will match.
    if (!msg.stressOnly) recordMCTiming(msg.totalMs, msg.totalMs, msg.numPaths, cfg.variations.length);

    onComplete?.(msg);
}

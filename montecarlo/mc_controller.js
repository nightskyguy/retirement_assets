// Main-thread interface to the Monte Carlo simulation.
// Uses a Web Worker on http:// (non-blocking). Falls back to chunked async on file://.
// Fallback requires prng.js and stats.js to be loaded on the main page first.

let _mcWorker = null;

// Launch a Monte Carlo run.
// Calls onProgress(0..1) during the run, onComplete(resultsMsg) when done.
// cfg: { variations, numPaths, mu, sigma, seed, years }
function runMCWorker(cfg, onProgress, onComplete) {
    if (_mcWorker) {
        _mcWorker.terminate();
        _mcWorker = null;
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
    _mcWorker = new Worker('montecarlo/worker.js?v=' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : Date.now()));

    _mcWorker.onmessage = function (e) {
        const msg = e.data;
        if (msg.type === 'progress') {
            onProgress?.(msg.pct);
        } else if (msg.type === 'results') {
            _mcWorker = null;
            // A stress-only refresh is a handful of sims against a different code path; folding it
            // into the model would drag the fixed term toward a number the run buttons never pay.
            if (!msg.stressOnly && !msg.error) {
                recordMCTiming(performance.now() - _wallT0, msg.totalMs, cfg.numPaths, cfg.variations?.length ?? 1);
            }
            onComplete?.(msg);
        }
    };

    _mcWorker.onerror = function (e) {
        console.error('MC Worker error:', e.message, e);
        _mcWorker = null;
        // If worker fails for any reason (e.g. late-detected security issue), retry on main thread.
        _runMCFallback(cfg, onProgress, onComplete);
    };

    _mcWorker.postMessage(cfg);
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
            onComplete?.({ type: 'results', error: String((err && err.message) || err) });
        });
}

// True while a worker run is in flight. Callers that want to slip a cheap extra pass in (the
// stress-only refresh) check this first, because runMCWorker terminates any running worker.
function _mcWorkerBusy() {
    return _mcWorker !== null;
}

function cancelMCWorker() {
    if (_mcWorker) {
        _mcWorker.terminate();
        _mcWorker = null;
    }
    _mcCancelled = true;
}

// ---- Throughput tracking (for time estimates) ------------------------------
//
// The run buttons state their own cost before you click, so the model has to describe WALL time on
// this machine, not simulation count. Two terms:
//
//   wall  =  fixed  +  msPerSim x paths x variations
//
// The fixed term is not small and used to be ignored entirely. Spawning the worker and running
// importScripts over taxengine.js, optimizer_core.js and four more (~370KB) measured 938ms on its
// own, and the stress pass and input fan ride along on every run whatever its size. Measured here:
// a 500-path plan run was 1543ms wall against 390ms inside the worker, and a 72,000-sim compare run
// was 43,283ms wall against 42,256ms. Dropping the fixed term told a plan run it would take 0.6s
// when it takes 1.5s -- fine as a relative hint, useless as the promise a button label makes.
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
// for both from wall time alone cannot work: one equation, two unknowns, so it just redistributes
// the wall clock according to whatever the fixed term already was and learns nothing. That is not
// hypothetical -- doing it that way read 0.41ms/sim off a plan run when the true figure was 0.59,
// and told the Compare button 30 seconds for a 43 second run.
//
//   fixed   = wall - workerMs. Directly the part no code inside the worker can see: spawning it,
//             importScripts over ~370KB, transferring results back, rendering.
//   perSim  = workerMs / sims. No fixed term involved at all.
//
// The largest run seen wins for perSim. A small run's figure is inflated because the stress pass and
// the input fan are amortised over few simulations -- real cost, but it does not scale, so
// extrapolating from it over-predicts a big run by about a third.
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
    const rng = mulberry32(seed ?? 42);
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

let _mcCancelled = false;

async function _runMCMainThread(cfg, onProgress, onComplete) {
    _mcCancelled = false;

    // Yield on a TIME budget, not on a loop counter. This used to yield once every 5 variations,
    // which was fine while every run swept ~144 of them but blocks the page solid for a run with a
    // single variation and a large path count (plan scope at 10,000 paths): one yield, then the
    // whole inner path loop with nothing giving the UI a turn. Chrome puts up "Page unresponsive".
    // 16ms is one frame, so the progress bar keeps moving and Cancel stays clickable.
    let _lastYield = performance.now();

    const msg = await runJob(cfg, {
        onProgress:   pct => onProgress?.(pct),
        shouldCancel: () => _mcCancelled,
        yieldIfDue:   async () => {
            if (performance.now() - _lastYield < 16) return;
            await new Promise(r => setTimeout(r, 0));
            _lastYield = performance.now();
        },
    });

    // Cancelled mid-pass. Report nothing, which is what leaves the previous results on screen.
    if (!msg) return;

    // Same model as the worker path. On file:// there is no worker to spawn, so wall and worker time
    // are the same clock and the fixed term learns ~0 -- correct, the run really is cheaper to start.
    // The stress-only refresh is not timed: it is one pass over one variation and would teach the
    // estimator a per-sim cost that no full run will match.
    if (!msg.stressOnly) recordMCTiming(msg.totalMs, msg.totalMs, msg.numPaths, cfg.variations.length);

    onComplete?.(msg);
}

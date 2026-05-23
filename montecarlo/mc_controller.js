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
        _runMCMainThread(cfg, onProgress, onComplete);
        return;
    }

    _mcWorker = new Worker('montecarlo/worker.js');

    _mcWorker.onmessage = function (e) {
        const msg = e.data;
        if (msg.type === 'progress') {
            onProgress?.(msg.pct);
        } else if (msg.type === 'results') {
            _mcWorker = null;
            if (msg.totalMs && msg.numPaths && cfg.variations?.length) {
                _mcMsPerSim = msg.totalMs / (msg.numPaths * cfg.variations.length);
            }
            onComplete?.(msg);
        }
    };

    _mcWorker.onerror = function (e) {
        console.error('MC Worker error:', e.message, e);
        _mcWorker = null;
        // If worker fails for any reason (e.g. late-detected security issue), retry on main thread.
        _runMCMainThread(cfg, onProgress, onComplete);
    };

    _mcWorker.postMessage(cfg);
}

function cancelMCWorker() {
    if (_mcWorker) {
        _mcWorker.terminate();
        _mcWorker = null;
    }
    _mcCancelled = true;
}

// ---- Throughput tracking (for time estimates) ------------------------------

let _mcMsPerSim = null;  // ms per (variation × path), calibrated after each run

// Returns estimated ms for a given number of paths and variations, or null if uncalibrated.
function estimateMCMs(numPaths, numVariations) {
    if (_mcMsPerSim == null) return null;
    return Math.round(_mcMsPerSim * numPaths * numVariations);
}

// Run 1 path through all variations synchronously to calibrate _mcMsPerSim.
// Takes ~1/numPaths of the full run time (imperceptible). Call before the first run.
function calibrateMCMs(cfg) {
    const { mu, sigma, seed, years, variations } = cfg;
    const rng = mulberry32(seed ?? 42);
    const logDrift = mu - 0.5 * sigma * sigma;

    const returnSeq = new Float64Array(years);
    for (let y = 0; y < years; y++) {
        returnSeq[y] = Math.exp(logDrift + sigma * boxMuller(rng)) - 1;
    }

    const t0 = performance.now();
    for (const v of variations) {
        try { simulate({ ...v, returnSequence: returnSeq }); } catch (e) {}
    }
    // probeMs covers 1 path × all variations; normalize to per (variation × path)
    _mcMsPerSim = (performance.now() - t0) / variations.length;
}

// ---- Synchronous (chunked) fallback ----------------------------------------
// Mirrors worker.js logic exactly, calling the globally-loaded simulate(),
// mulberry32(), boxMuller(), and computePercentiles() functions.

let _mcCancelled = false;

async function _runMCMainThread(cfg, onProgress, onComplete) {
    const t0 = performance.now();
    _mcCancelled = false;
    const { numPaths, mu, sigma, seed, years, variations } = cfg;
    const rng = mulberry32(seed ?? 42);

    const logDrift = mu - 0.5 * sigma * sigma;

    // Build shared scenario bank (CRN) — same draws for all variations.
    const scenarioBank = new Float64Array(numPaths * years);
    let minAnnualReturn =  Infinity;
    let maxAnnualReturn = -Infinity;
    for (let p = 0; p < numPaths; p++) {
        for (let y = 0; y < years; y++) {
            const shock = logDrift + sigma * boxMuller(rng);
            scenarioBank[p * years + y] = shock;
            const r = Math.exp(shock) - 1;
            if (r < minAnnualReturn) minAnnualReturn = r;
            if (r > maxAnnualReturn) maxAnnualReturn = r;
        }
    }

    const varResults = [];

    for (let vi = 0; vi < variations.length; vi++) {
        if (_mcCancelled) return;

        // Yield to the UI every 5 variations so the progress bar can update.
        if (vi % 5 === 0) await new Promise(r => setTimeout(r, 0));

        const baseInputs = variations[vi];
        const paths     = new Float64Array(numPaths * years);
        const ruinYears = new Uint16Array(numPaths);
        let ruinCount   = 0;

        for (let p = 0; p < numPaths; p++) {
            const returnSeq = new Float64Array(years);
            for (let y = 0; y < years; y++) {
                returnSeq[y] = Math.exp(scenarioBank[p * years + y]) - 1;
            }

            let result;
            try {
                result = simulate({ ...baseInputs, returnSequence: returnSeq });
            } catch (e) {
                ruinYears[p] = baseInputs.startYear ?? 2026;
                ruinCount++;
                continue;
            }

            const log = result.log;
            let ruined = false;

            for (let y = 0; y < years; y++) {
                if (ruined) { paths[p * years + y] = 0; continue; }
                if (y >= log.length) {
                    paths[p * years + y] = y > 0 ? paths[p * years + y - 1] : 0;
                    continue;
                }
                const row      = log[y];
                const required = Math.max(0, row.spendGoal - (row.guaranteedIncome ?? 0));
                const balance  = row.portfolioBalance ?? 0;
                if (balance < required) {
                    ruined = true;
                    ruinYears[p] = row.year;
                    ruinCount++;
                    for (let yy = y; yy < years; yy++) paths[p * years + yy] = 0;
                    break;
                }
                paths[p * years + y] = balance;
            }
        }

        const failures = [];
        for (let p = 0; p < numPaths; p++) {
            if (ruinYears[p] > 0) failures.push(ruinYears[p]);
        }
        failures.sort((a, b) => a - b);

        const percentiles = computePercentiles(paths, years, numPaths);

        varResults.push({
            label:          baseInputs._label          ?? `Variation ${vi + 1}`,
            strategyFamily: baseInputs._strategyFamily ?? '',
            paramLabel:     baseInputs._paramLabel     ?? '',
            maxConversion:  baseInputs.maxConversion   ?? false,
            spendGoal:      baseInputs.spendGoal       ?? null,
            survivalRate:   (numPaths - ruinCount) / numPaths,
            medianRuinYear: failures.length > 0 ? failures[Math.floor(failures.length / 2)] : null,
            percentiles: {
                p5:  Array.from(percentiles.p5),
                p25: Array.from(percentiles.p25),
                p50: Array.from(percentiles.p50),
                p75: Array.from(percentiles.p75),
                p95: Array.from(percentiles.p95),
            },
        });

        if ((vi + 1) % 5 === 0 || vi === variations.length - 1) {
            onProgress?.((vi + 1) / variations.length);
        }
    }

    const totalMs = performance.now() - t0;
    _mcMsPerSim = totalMs / (numPaths * variations.length);
    onComplete?.({
        type: 'results',
        variations: varResults,
        numPaths,
        years,
        totalMs,
        medianAnnualReturn: Math.exp(logDrift) - 1,
        minAnnualReturn,
        maxAnnualReturn,
        inflationRate: cfg.inflationRate ?? null,
    });
}

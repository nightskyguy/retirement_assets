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
        const z = boxMuller(rng);
        returnSeq[y] = (cfg.simulationMode === 'aam')
            ? Math.max(RETURN_FLOOR, mu + sigma * z)
            : Math.exp(logDrift + sigma * z) - 1;
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
// Mirrors worker.js logic exactly, calling the globally-loaded simulate(),
// mulberry32(), boxMuller(), and computePercentiles() functions.

let _mcCancelled = false;

async function _runMCMainThread(cfg, onProgress, onComplete) {
    const t0 = performance.now();
    _mcCancelled = false;
    const { years, variations } = cfg;
    const simulationMode = cfg.simulationMode;
    const rng = mulberry32(cfg.seed ?? 42);

    // Yield on a TIME budget, not on a loop counter. This used to yield once every 5 variations,
    // which was fine while every run swept ~144 of them but blocks the page solid for a run with a
    // single variation and a large path count (plan scope at 10,000 paths): one yield, then the
    // whole inner path loop with nothing giving the UI a turn. Chrome puts up "Page unresponsive".
    // 16ms is one frame, so the progress bar keeps moving and Cancel stays clickable.
    let _lastYield = performance.now();
    async function yieldIfDue() {
        if (performance.now() - _lastYield < 16) return;
        await new Promise(r => setTimeout(r, 0));
        _lastYield = performance.now();
    }

    // Mirrors worker.js's runPass exactly (see that file for the fold-Stress-into-Historical
    // rationale). progressOffset/progressWeight let two passes share one progress bar.
    async function runPass(mode, progressOffset, progressWeight, runVariations) {
        const varsToUse = runVariations || variations;
        let numPaths = cfg.numPaths;
        let scenarioBank, multiAssetBank, medianAnnualReturn, logDrift;
        let synthInflationBank = null;
        let minAnnualReturn =  Infinity;
        let maxAnnualReturn = -Infinity;
        let assetRanges    = null;
        let inflationStats = null;

        if (mode === 'bootstrap') {
            multiAssetBank = bootstrapMultiAssetBank(rng, numPaths, years);
            const bearFraction = (cfg.bearFraction ?? 25) / 100;
            if (bearFraction > 0) applyBearStartOverlay(multiAssetBank, rng, numPaths, years, bearFraction);
            scenarioBank = multiAssetBank.equity;  // used for equity min/max/median reporting
            let eqMin = Infinity, eqMax = -Infinity, bdMin = Infinity, bdMax = -Infinity,
                itMin = Infinity, itMax = -Infinity, infMin = Infinity, infMax = -Infinity;
            for (let i = 0; i < scenarioBank.length; i++) {
                const eq  = scenarioBank[i];
                const bd  = multiAssetBank.bonds[i];
                const it  = multiAssetBank.intl[i];
                const inf = multiAssetBank.inflation[i];
                if (eq  < eqMin)  eqMin  = eq;   if (eq  > eqMax)  eqMax  = eq;
                if (bd  < bdMin)  bdMin  = bd;   if (bd  > bdMax)  bdMax  = bd;
                if (it  < itMin)  itMin  = it;   if (it  > itMax)  itMax  = it;
                if (inf < infMin) infMin = inf;  if (inf > infMax) infMax = inf;
            }
            minAnnualReturn = eqMin;
            maxAnnualReturn = eqMax;
            let eqLogSum = 0, bdLogSum = 0, itLogSum = 0, infLogSum = 0;
            const bankLen = scenarioBank.length;
            for (let i = 0; i < bankLen; i++) {
                eqLogSum  += Math.log1p(scenarioBank[i]);
                bdLogSum  += Math.log1p(multiAssetBank.bonds[i]);
                itLogSum  += Math.log1p(multiAssetBank.intl[i]);
                infLogSum += Math.log1p(multiAssetBank.inflation[i]);
            }
            const eqCAGR  = Math.exp(eqLogSum  / bankLen) - 1;
            const bdCAGR  = Math.exp(bdLogSum  / bankLen) - 1;
            const itCAGR  = Math.exp(itLogSum  / bankLen) - 1;
            const infCAGR = Math.exp(infLogSum / bankLen) - 1;
            medianAnnualReturn = null;
            assetRanges    = {
                equity: [eqMin, eqCAGR, eqMax],
                bonds:  [bdMin, bdCAGR, bdMax],
                intl:   [itMin, itCAGR, itMax],
            };
            inflationStats = { min: infMin, cagr: infCAGR, max: infMax };
        } else if (mode === 'stress') {
            const stressCount = cfg.stressCount ?? 20;
            multiAssetBank = buildStressBank(stressCount, years, cfg.stressWindow ?? 'combined');
            numPaths = multiAssetBank.labels.length;
            scenarioBank = multiAssetBank.equity;
            let eqMin = Infinity, eqMax = -Infinity, bdMin = Infinity, bdMax = -Infinity,
                itMin = Infinity, itMax = -Infinity, infMin = Infinity, infMax = -Infinity;
            let eqLogSum = 0, bdLogSum = 0, itLogSum = 0, infLogSum = 0;
            const bankLen = scenarioBank.length;
            for (let i = 0; i < bankLen; i++) {
                const eq = scenarioBank[i], bd = multiAssetBank.bonds[i],
                      it = multiAssetBank.intl[i],  inf = multiAssetBank.inflation[i];
                if (eq  < eqMin)  eqMin  = eq;   if (eq  > eqMax)  eqMax  = eq;
                if (bd  < bdMin)  bdMin  = bd;   if (bd  > bdMax)  bdMax  = bd;
                if (it  < itMin)  itMin  = it;   if (it  > itMax)  itMax  = it;
                if (inf < infMin) infMin = inf;  if (inf > infMax) infMax = inf;
                eqLogSum += Math.log1p(eq); bdLogSum += Math.log1p(bd);
                itLogSum += Math.log1p(it); infLogSum += Math.log1p(inf);
            }
            minAnnualReturn = eqMin; maxAnnualReturn = eqMax;
            medianAnnualReturn = null;
            assetRanges = {
                equity: [eqMin, Math.exp(eqLogSum / bankLen) - 1, eqMax],
                bonds:  [bdMin, Math.exp(bdLogSum / bankLen) - 1, bdMax],
                intl:   [itMin, Math.exp(itLogSum / bankLen) - 1, itMax],
            };
            inflationStats = { min: infMin, cagr: Math.exp(infLogSum / bankLen) - 1, max: infMax };
        } else {
            // Synthetic modes -- mirrors worker.js's branch exactly; see that file for why 'gbm'
            // banks a log-space shock while 'aam' banks the final return, and why inflation draws
            // come from their own stream.
            const { mu, sigma } = cfg;
            const isAAM = (mode === 'aam');
            logDrift = mu - 0.5 * sigma * sigma;
            medianAnnualReturn = isAAM ? mu : Math.exp(logDrift) - 1;
            const infRng           = mulberry32((cfg.seed ?? 42) ^ 0x5F356495);
            const inflationTarget  = cfg.inflationRate ?? 0.03;
            const inflationPersist = cfg.inflationPersistence ?? INFLATION_AR1_PERSISTENCE;
            const inflationShockSd = cfg.inflationShockSd     ?? INFLATION_AR1_SHOCK_SD;
            const inflationCorr    = cfg.inflationReturnCorr  ?? INFLATION_RETURN_CORR;
            scenarioBank       = new Float64Array(numPaths * years);
            synthInflationBank = new Float64Array(numPaths * years);
            for (let p = 0; p < numPaths; p++) {
                let prevInflation = inflationTarget;
                for (let y = 0; y < years; y++) {
                    const z1    = boxMuller(rng);
                    const shock = logDrift + sigma * z1;
                    const r     = isAAM ? Math.max(RETURN_FLOOR, mu + sigma * z1)
                                        : Math.exp(shock) - 1;
                    scenarioBank[p * years + y] = isAAM ? r : shock;
                    if (r < minAnnualReturn) minAnnualReturn = r;
                    if (r > maxAnnualReturn) maxAnnualReturn = r;
                    const zInf = correlatedNormal(z1, boxMuller(infRng), inflationCorr);
                    prevInflation = computeNextInflation(prevInflation, inflationTarget,
                                                         inflationPersist, inflationShockSd, zInf);
                    synthInflationBank[p * years + y] = prevInflation;
                }
            }

            // Same shape the Historical pass reports, so every reader downstream -- the metrics
            // line, the demo table, the Input Distribution chart -- treats synthetic inflation as
            // a distribution rather than a single number, with no special case for the mode.
            let infMin = Infinity, infMax = -Infinity, infLogSum = 0;
            for (let i = 0; i < synthInflationBank.length; i++) {
                const v = synthInflationBank[i];
                if (v < infMin) infMin = v;
                if (v > infMax) infMax = v;
                infLogSum += Math.log1p(v);
            }
            inflationStats = { min: infMin, cagr: Math.exp(infLogSum / synthInflationBank.length) - 1, max: infMax };
        }

        const varResults = [];

        for (let vi = 0; vi < varsToUse.length; vi++) {
            if (_mcCancelled) return null;
            await yieldIfDue();

            const baseInputs = varsToUse[vi];
            const paths      = new Float64Array(numPaths * years);
            const ruinYears  = new Uint16Array(numPaths);
            const taxPerPath = new Float64Array(numPaths);
            const spendPerPath = new Float64Array(numPaths);
            let ruinCount    = 0;

            for (let p = 0; p < numPaths; p++) {
                // Check every 16 paths rather than every path: performance.now() in the hot loop is
                // itself measurable. Also lets Cancel take effect mid-variation, which it could not
                // do before when a variation was the smallest interruptible unit. 16 rather than 64
                // because the stress pass now runs up to 98 paths, and at 64 that whole pass got two
                // yields; the yield itself is still gated on a 16ms budget, so the extra checks are
                // a clock read, not a task switch.
                if ((p & 15) === 0) {
                    await yieldIfDue();
                    if (_mcCancelled) return null;
                    // Progress within the variation, so a one-variation run has a moving bar
                    // instead of sitting at its starting percentage until the whole run finishes.
                    onProgress?.(progressOffset
                        + ((vi + p / numPaths) / varsToUse.length) * progressWeight);
                }
                const returnSeq = new Float64Array(years);
                for (let y = 0; y < years; y++) {
                    const raw = scenarioBank[p * years + y];
                    // Only GBM banks a log-space shock -- see worker.js.
                    returnSeq[y] = mode === 'gbm' ? Math.exp(raw) - 1 : raw;
                }

                let returnSequencePerAccount = null;
                if ((mode === 'bootstrap' || mode === 'stress') && multiAssetBank) {
                    const accts = ['IRA1', 'IRA2', 'Brokerage', 'Roth1', 'Roth2'];
                    returnSequencePerAccount = {};
                    for (const acct of accts) {
                        const eqPct   = (baseInputs[`comp_${acct}_ratio`] ?? 60) / 100;
                        const intlPct = (baseInputs[`comp_${acct}_intl`]  ?? 0)  / 100;
                        const domEq   = eqPct * (1 - intlPct);
                        const intl    = eqPct * intlPct;
                        const bond    = 1 - eqPct;
                        const seq = new Float64Array(years);
                        for (let y = 0; y < years; y++) {
                            const i = p * years + y;
                            seq[y] = domEq * multiAssetBank.equity[i]
                                   + intl  * multiAssetBank.intl[i]
                                   + bond  * multiAssetBank.bonds[i];
                        }
                        returnSequencePerAccount[acct] = seq;
                    }
                }

                let inflationSequence = null;
                if ((mode === 'bootstrap' || mode === 'stress') && multiAssetBank?.inflation) {
                    inflationSequence = new Float64Array(years);
                    for (let y = 0; y < years; y++) {
                        inflationSequence[y] = multiAssetBank.inflation[p * years + y];
                    }
                } else if (synthInflationBank) {
                    inflationSequence = new Float64Array(years);
                    for (let y = 0; y < years; y++) {
                        inflationSequence[y] = synthInflationBank[p * years + y];
                    }
                }

                let result;
                try {
                    result = simulate({ ...baseInputs, returnSequence: returnSeq, returnSequencePerAccount, inflationSequence });
                } catch (e) {
                    ruinYears[p] = baseInputs.startYear ?? 2026;
                    ruinCount++;
                    continue;
                }

                taxPerPath[p] = result.totals.tax ?? 0;
                spendPerPath[p] = result.totals.spendCurrentDollars ?? 0;
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

            let stressPaths = null;
            if (mode === 'stress') {
                stressPaths = [];
                for (let p = 0; p < numPaths; p++) {
                    stressPaths.push(Array.from({ length: years }, (_, y) => paths[p * years + y]));
                }
            }

            const taxSorted = Array.from(taxPerPath).sort((a, b) => a - b);
            const spendSorted = Array.from(spendPerPath).sort((a, b) => a - b);
            varResults.push({
                label:          baseInputs._label          ?? `Variation ${vi + 1}`,
                strategyFamily: baseInputs._strategyFamily ?? '',
                paramLabel:     baseInputs._paramLabel     ?? '',
                convertExcessToRoth:    baseInputs.convertExcessToRoth    ?? false,
                fundConversionWithCash: baseInputs.fundConversionWithCash ?? false,
                cyclicEnabled:  baseInputs.cyclicEnabled   ?? false,
                cyclicOrder:    baseInputs.cyclicOrder     ?? 'ira-first',
                spendGoal:      baseInputs.spendGoal       ?? null,
                strategy:       baseInputs.strategy,
                propWithdraw:   baseInputs.propWithdraw,
                nYears:         baseInputs.nYears,
                stratRate:      baseInputs.stratRate,
                iraWithdrawPct: baseInputs.iraWithdrawPct,
                survivalRate:   (numPaths - ruinCount) / numPaths,
                medianRuinYear: failures.length > 0 ? failures[Math.floor(failures.length / 2)] : null,
                medianTax:      taxSorted[Math.floor(taxSorted.length / 2)] ?? null,
                medianSpend:    spendSorted[Math.floor(spendSorted.length / 2)] ?? null,
                percentiles: {
                    p5:  Array.from(percentiles.p5),
                    p25: Array.from(percentiles.p25),
                    p50: Array.from(percentiles.p50),
                    p75: Array.from(percentiles.p75),
                    p95: Array.from(percentiles.p95),
                },
                stressPaths,
                ruinYearsPerPath: mode === 'stress' ? Array.from(ruinYears) : null,
            });

            if ((vi + 1) % 5 === 0 || vi === varsToUse.length - 1) {
                onProgress?.(progressOffset + (vi + 1) / varsToUse.length * progressWeight);
            }
        }

        // Build input fan — mirrors worker.js exactly.
        let equityBankForFan;
        if (mode === 'gbm') {
            equityBankForFan = new Float64Array(numPaths * years);
            for (let i = 0; i < scenarioBank.length; i++) {
                equityBankForFan[i] = Math.exp(scenarioBank[i]) - 1;
            }
        } else {
            equityBankForFan = (mode === 'aam') ? scenarioBank : multiAssetBank.equity;
        }
        const inflationBankForFan = (['bootstrap', 'stress'].includes(mode) && multiAssetBank?.inflation)
            ? multiAssetBank.inflation
            : synthInflationBank;
        const inputFan = computeInputFan(equityBankForFan, inflationBankForFan, numPaths, years);

        return {
            varResults, numPaths, medianAnnualReturn, minAnnualReturn, maxAnnualReturn,
            assetRanges, inflationStats, inputFan,
            stressBank:           mode === 'stress' ? multiAssetBank : null,
        };
    }

    // Stress runs in BOTH modes -- see worker.js for why. It builds its own bank from the worst
    // historical decades and never needed the main pass to be Historical.
    const willRunStress = true;
    const stressCountEstimate = cfg.stressCount ?? 20;
    // See worker.js for why cfg.stressOnly exists: the main pass is ~numPaths × variations sims and
    // is far too expensive to re-run on every input change; the stress pass is stressCount × 1.
    const stressOnly = !!cfg.stressOnly && willRunStress;
    const totalWork = willRunStress ? (cfg.numPaths + stressCountEstimate) : cfg.numPaths;
    const mainWeight = stressOnly ? 0 : (willRunStress ? cfg.numPaths / totalWork : 1);

    // Pass the selected mode through -- see worker.js for why the old ternary was wrong.
    const mainMode = (simulationMode === 'bootstrap' || simulationMode === 'aam') ? simulationMode : 'gbm';
    const main = stressOnly ? null : await runPass(mainMode, 0, mainWeight);
    if (!stressOnly && main === null) return; // cancelled mid-pass
    // Stress runs against ONLY the current withdrawal strategy (mc_tab.js's runMonteCarlo()
    // builds this), not the full variations sweep — falls back to the full array if missing.
    const stressVars = cfg.stressVariations?.length ? cfg.stressVariations : variations;
    const stress = willRunStress ? await runPass('stress', mainWeight, 1 - mainWeight, stressVars) : null;
    if (willRunStress && stress === null) return; // cancelled mid-pass

    if (stressOnly) {
        onComplete?.({
            type: 'results',
            stressOnly: true,
            years,
            totalMs: performance.now() - t0,
            stress: _buildStressMsg(stress),
        });
        return;
    }

    const totalMs = performance.now() - t0;
    // Same model as the worker path. On file:// there is no worker to spawn, so wall and worker time
    // are the same clock and the fixed term learns ~0 -- correct, the run really is cheaper to start.
    recordMCTiming(totalMs, totalMs, main.numPaths, variations.length);
    onComplete?.({
        type: 'results',
        variations: main.varResults,
        numPaths: main.numPaths,
        years,
        simulationMode: mainMode,
        totalMs,
        medianAnnualReturn: main.medianAnnualReturn,
        minAnnualReturn:    main.minAnnualReturn,
        maxAnnualReturn:    main.maxAnnualReturn,
        inflationRate:     cfg.inflationRate ?? null,
        assetRanges:       main.assetRanges,
        inflationStats:    main.inflationStats,
        inputFan:          main.inputFan,
        stress: _buildStressMsg(stress),
    });
}

// Shared so the stress-only refresh and the full run cannot drift in shape (mirrors worker.js).
function _buildStressMsg(stress) {
    if (!stress) return null;
    const b = stress.stressBank;
    return {
        variations:     stress.varResults,
        numPaths:       stress.numPaths,
        assetRanges:    stress.assetRanges,
        inflationStats: stress.inflationStats,
        labels:         b?.labels      ?? null,
        startYears:     b?.startYears  ?? null,
        realYears:      b?.realYears   ?? null,
        nominatedBy:    b?.nominatedBy ?? null,
        eqCAGRs:        b?.fullEqCAGRs   ?? null,
        bondCAGRs:      b?.fullBondCAGRs ?? null,
        intlCAGRs:      b?.fullIntlCAGRs ?? null,
        inflationCAGRs: b?.fullInflCAGRs ?? null,
        realCAGRs:      b?.fullRealCAGRs ?? null,
        worstRealCAGRs: b?.worstRealCAGRs ?? null,
        windowMode:     b?.windowMode  ?? null,
        windowsUsed:    b?.windowsUsed ?? null,
        window:         b?.scoreYears  ?? null,
        requestedCount: b?.requestedCount ?? null,
        candidatePool:  b?.candidatePool  ?? null,
    };
}

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

    _mcWorker = new Worker('montecarlo/worker.js?v=' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : Date.now()));

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
    const { years, variations } = cfg;
    const simulationMode = cfg.simulationMode;
    const rng = mulberry32(cfg.seed ?? 42);

    // Mirrors worker.js's runPass exactly (see that file for the fold-Stress-into-Historical
    // rationale). progressOffset/progressWeight let two passes share one progress bar.
    async function runPass(mode, progressOffset, progressWeight, runVariations) {
        const varsToUse = runVariations || variations;
        let numPaths = cfg.numPaths;
        let scenarioBank, multiAssetBank, medianAnnualReturn, logDrift;
        let minAnnualReturn =  Infinity;
        let maxAnnualReturn = -Infinity;
        let assetRanges    = null;
        let inflationStats = null;

        if (mode === 'bootstrap') {
            multiAssetBank = bootstrapMultiAssetBank(rng, numPaths, years);
            const bearFraction = (cfg.bearFraction ?? 25) / 100;
            if (bearFraction > 0) applyBearStartOverlay(multiAssetBank, rng, numPaths, years, bearFraction, cfg.stressCount ?? 10);
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
            const stressCount = cfg.stressCount ?? 10;
            multiAssetBank = buildStressBank(stressCount, years);
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
            const { mu, sigma } = cfg;
            logDrift = mu - 0.5 * sigma * sigma;
            medianAnnualReturn = Math.exp(logDrift) - 1;
            scenarioBank = new Float64Array(numPaths * years);
            for (let p = 0; p < numPaths; p++) {
                for (let y = 0; y < years; y++) {
                    const shock = logDrift + sigma * boxMuller(rng);
                    scenarioBank[p * years + y] = shock;
                    const r = Math.exp(shock) - 1;
                    if (r < minAnnualReturn) minAnnualReturn = r;
                    if (r > maxAnnualReturn) maxAnnualReturn = r;
                }
            }
        }

        const varResults = [];

        for (let vi = 0; vi < varsToUse.length; vi++) {
            if (_mcCancelled) return null;

            // Yield to the UI every 5 variations so the progress bar can update.
            if (vi % 5 === 0) await new Promise(r => setTimeout(r, 0));

            const baseInputs = varsToUse[vi];
            const paths      = new Float64Array(numPaths * years);
            const ruinYears  = new Uint16Array(numPaths);
            const taxPerPath = new Float64Array(numPaths);
            const spendPerPath = new Float64Array(numPaths);
            let ruinCount    = 0;

            for (let p = 0; p < numPaths; p++) {
                const returnSeq = new Float64Array(years);
                for (let y = 0; y < years; y++) {
                    const raw = scenarioBank[p * years + y];
                    returnSeq[y] = mode === 'bootstrap' ? raw : Math.exp(raw) - 1;
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
            });

            if ((vi + 1) % 5 === 0 || vi === varsToUse.length - 1) {
                onProgress?.(progressOffset + (vi + 1) / varsToUse.length * progressWeight);
            }
        }

        // Build input fan — mirrors worker.js exactly.
        let equityBankForFan;
        if (mode === 'bootstrap' || mode === 'stress') {
            equityBankForFan = multiAssetBank.equity;
        } else {
            equityBankForFan = new Float64Array(numPaths * years);
            for (let i = 0; i < scenarioBank.length; i++) {
                equityBankForFan[i] = Math.exp(scenarioBank[i]) - 1;
            }
        }
        const inflationBankForFan = (['bootstrap', 'stress'].includes(mode) && multiAssetBank?.inflation)
            ? multiAssetBank.inflation : null;
        const inputFan = computeInputFan(equityBankForFan, inflationBankForFan, numPaths, years);

        return {
            varResults, numPaths, medianAnnualReturn, minAnnualReturn, maxAnnualReturn,
            assetRanges, inflationStats, inputFan,
            stressLabels:         mode === 'stress' ? multiAssetBank.labels          : null,
            stressStartYears:     mode === 'stress' ? multiAssetBank.startYears      : null,
            stressDecadeCAGRs:    mode === 'stress' ? multiAssetBank.decadeCAGRs     : null,
            stressInflationCAGRs: mode === 'stress' ? multiAssetBank.decadeInflCAGRs : null,
        };
    }

    const willRunStress = simulationMode === 'bootstrap';
    const stressCountEstimate = cfg.stressCount ?? 10;
    const totalWork = willRunStress ? (cfg.numPaths + stressCountEstimate) : cfg.numPaths;
    const mainWeight = willRunStress ? cfg.numPaths / totalWork : 1;

    const main = await runPass(simulationMode === 'bootstrap' ? 'bootstrap' : 'gbm', 0, mainWeight);
    if (main === null) return; // cancelled mid-pass
    // Stress runs against ONLY the current withdrawal strategy (mc_tab.js's runMonteCarlo()
    // builds this), not the full variations sweep — falls back to the full array if missing.
    const stressVars = cfg.stressVariations?.length ? cfg.stressVariations : variations;
    const stress = willRunStress ? await runPass('stress', mainWeight, 1 - mainWeight, stressVars) : null;
    if (willRunStress && stress === null) return; // cancelled mid-pass

    const totalMs = performance.now() - t0;
    _mcMsPerSim = totalMs / (main.numPaths * variations.length);
    onComplete?.({
        type: 'results',
        variations: main.varResults,
        numPaths: main.numPaths,
        years,
        totalMs,
        medianAnnualReturn: main.medianAnnualReturn,
        minAnnualReturn:    main.minAnnualReturn,
        maxAnnualReturn:    main.maxAnnualReturn,
        inflationRate:     cfg.inflationRate ?? null,
        assetRanges:       main.assetRanges,
        inflationStats:    main.inflationStats,
        inputFan:          main.inputFan,
        stress: stress ? {
            variations:    stress.varResults,
            numPaths:      stress.numPaths,
            assetRanges:   stress.assetRanges,
            inflationStats: stress.inflationStats,
            labels:        stress.stressLabels,
            startYears:    stress.stressStartYears,
            decadeCAGRs:   stress.stressDecadeCAGRs,
            decadeInflationCAGRs: stress.stressInflationCAGRs,
        } : null,
    });
}

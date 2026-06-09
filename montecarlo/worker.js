// Monte Carlo simulation worker.
// Receives a config message, runs all variations against a shared scenario bank (CRN),
// posts progress updates, then posts the final results.

importScripts('../taxengine.js', '../retirement_optimizer_core.js', 'prng.js', 'stats.js', 'historical_returns.js');

self.onmessage = function ({ data: cfg }) {
    const t0 = performance.now();
    let { numPaths, mu, sigma, seed, years, variations, simulationMode } = cfg;
    const rng = mulberry32(seed ?? 42);

    // Build scenario bank — Common Random Numbers so every variation sees identical shocks.
    let scenarioBank, multiAssetBank, medianAnnualReturn, logDrift;
    let minAnnualReturn =  Infinity;
    let maxAnnualReturn = -Infinity;
    let assetRanges    = null;
    let inflationStats = null;

    if (simulationMode === 'bootstrap') {
        // Multi-asset block bootstrap: synchronized draws from equity, bonds, intl, inflation (1970–2024 window).
        multiAssetBank = bootstrapMultiAssetBank(rng, numPaths, years);
        scenarioBank = multiAssetBank.equity;  // used for equity min/max/median reporting
        // Single scan: collect min/max for all asset classes and inflation simultaneously.
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
        // Compute per-asset CAGR (geometric mean = exp(mean(log(1+r))) - 1) from sampled banks.
        // CAGR is the right "center" statistic — matches what investors call "average annual return".
        // Arithmetic median of annual returns is ~16% for S&P (right-skewed), which misleads users
        // who expect CAGR (~10–11%). Single O(n) pass; avoids expensive sort.
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
        // Bootstrap mode: suppress top-level medianAnnualReturn (equity-only, confuses blended portfolios).
        medianAnnualReturn = null;
        assetRanges    = {
            equity: [eqMin, eqCAGR, eqMax],
            bonds:  [bdMin, bdCAGR, bdMax],
            intl:   [itMin, itCAGR, itMax],
        };
        inflationStats = { min: infMin, cagr: infCAGR, max: infMax };
    } else if (simulationMode === 'stress') {
        // Deterministic SoRR stress: N worst historical starting sequences.
        const stressCount = cfg.stressCount ?? 10;
        multiAssetBank = buildStressBank(stressCount, years);
        numPaths = multiAssetBank.labels.length;   // override: one path per stress scenario
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
        // GBM (default): bank[p*years+y] = log-space shock; convert with Math.exp()-1.
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

    for (let vi = 0; vi < variations.length; vi++) {
        const baseInputs = variations[vi];

        // paths[p * years + y] = portfolio balance (0 once ruined, kept at last value after death)
        const paths = new Float64Array(numPaths * years);
        const ruinYears = new Uint16Array(numPaths); // 0 = survived to end of plan
        const taxPerPath = new Float64Array(numPaths); // lifetime taxes for each path
        let ruinCount = 0;

        for (let p = 0; p < numPaths; p++) {
            const returnSeq = new Float64Array(years);
            for (let y = 0; y < years; y++) {
                const raw = scenarioBank[p * years + y];
                returnSeq[y] = simulationMode === 'bootstrap' ? raw : Math.exp(raw) - 1;
            }

            // Build per-account return sequences from multi-asset bank when available.
            let returnSequencePerAccount = null;
            if ((simulationMode === 'bootstrap' || simulationMode === 'stress') && multiAssetBank) {
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
            if ((simulationMode === 'bootstrap' || simulationMode === 'stress') && multiAssetBank?.inflation) {
                inflationSequence = new Float64Array(years);
                for (let y = 0; y < years; y++) {
                    inflationSequence[y] = multiAssetBank.inflation[p * years + y];
                }
            }

            let result;
            try {
                result = simulate({ ...baseInputs, returnSequence: returnSeq, returnSequencePerAccount, inflationSequence });
            } catch (e) {
                // Treat a crashed simulation as immediate ruin
                ruinYears[p] = baseInputs.startYear ?? 2026;
                ruinCount++;
                continue;
            }

            taxPerPath[p] = result.totals.tax ?? 0;
            const log = result.log;
            let ruined = false;

            for (let y = 0; y < years; y++) {
                if (ruined) {
                    paths[p * years + y] = 0;
                    continue;
                }

                if (y >= log.length) {
                    // Both persons deceased before plan horizon — persist last balance.
                    paths[p * years + y] = y > 0 ? paths[p * years + y - 1] : 0;
                    continue;
                }

                const row = log[y];
                const required = Math.max(0, row.spendGoal - (row.guaranteedIncome ?? 0));
                const balance = row.portfolioBalance ?? 0;

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

        // Median ruin year among failed paths only.
        const failures = [];
        for (let p = 0; p < numPaths; p++) {
            if (ruinYears[p] > 0) failures.push(ruinYears[p]);
        }
        failures.sort((a, b) => a - b);
        const medianRuinYear = failures.length > 0
            ? failures[Math.floor(failures.length / 2)]
            : null;

        // Median lifetime taxes across all paths.
        const taxSorted = Array.from(taxPerPath).sort((a, b) => a - b);
        const medianTax = taxSorted[Math.floor(taxSorted.length / 2)] ?? null;

        const percentiles = computePercentiles(paths, years, numPaths);

        // In stress mode, capture individual path traces for per-scenario chart rendering.
        let stressPaths = null;
        if (simulationMode === 'stress') {
            stressPaths = [];
            for (let p = 0; p < numPaths; p++) {
                stressPaths.push(Array.from({ length: years }, (_, y) => paths[p * years + y]));
            }
        }

        varResults.push({
            label:          baseInputs._label          ?? `Variation ${vi + 1}`,
            strategyFamily: baseInputs._strategyFamily ?? '',
            paramLabel:     baseInputs._paramLabel     ?? '',
            maxConversion:  baseInputs.maxConversion   ?? false,
            cyclicEnabled:  baseInputs.cyclicEnabled   ?? false,
            cyclicOrder:    baseInputs.cyclicOrder     ?? 'ira-first',
            spendGoal:      baseInputs.spendGoal       ?? null,
            strategy:       baseInputs.strategy,
            propWithdraw:   baseInputs.propWithdraw,
            nYears:         baseInputs.nYears,
            stratRate:      baseInputs.stratRate,
            iraWithdrawPct: baseInputs.iraWithdrawPct,
            survivalRate:   (numPaths - ruinCount) / numPaths,
            medianRuinYear,
            medianTax,
            percentiles: {
                p5:  Array.from(percentiles.p5),
                p25: Array.from(percentiles.p25),
                p50: Array.from(percentiles.p50),
                p75: Array.from(percentiles.p75),
                p95: Array.from(percentiles.p95),
            },
            stressPaths,
        });

        // Post a progress update every 5 variations and on the last one.
        if ((vi + 1) % 5 === 0 || vi === variations.length - 1) {
            postMessage({ type: 'progress', pct: (vi + 1) / variations.length });
        }
    }

    // Build input fan — per-year return/inflation percentile bands across all paths.
    // Bootstrap: equity bank is already decimal returns. GBM: convert log-normal shocks once.
    let equityBankForFan;
    if (simulationMode === 'bootstrap' || simulationMode === 'stress') {
        equityBankForFan = multiAssetBank.equity;
    } else {
        equityBankForFan = new Float64Array(numPaths * years);
        for (let i = 0; i < scenarioBank.length; i++) {
            equityBankForFan[i] = Math.exp(scenarioBank[i]) - 1;
        }
    }
    const inflationBankForFan = (['bootstrap', 'stress'].includes(simulationMode) && multiAssetBank?.inflation)
        ? multiAssetBank.inflation : null;
    const inputFan = computeInputFan(equityBankForFan, inflationBankForFan, numPaths, years);

    postMessage({
        type: 'results',
        variations: varResults,
        numPaths,
        years,
        totalMs:           performance.now() - t0,
        medianAnnualReturn,
        minAnnualReturn,
        maxAnnualReturn,
        inflationRate:     cfg.inflationRate ?? null,
        assetRanges,
        inflationStats,
        inputFan,
        stressLabels:         simulationMode === 'stress' ? multiAssetBank.labels         : null,
        stressStartYears:     simulationMode === 'stress' ? multiAssetBank.startYears     : null,
        stressDecadeCAGRs:    simulationMode === 'stress' ? multiAssetBank.decadeCAGRs    : null,
        stressInflationCAGRs: simulationMode === 'stress' ? multiAssetBank.decadeInflCAGRs : null,
    });
};

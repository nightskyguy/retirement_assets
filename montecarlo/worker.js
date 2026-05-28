// Monte Carlo simulation worker.
// Receives a config message, runs all variations against a shared scenario bank (CRN),
// posts progress updates, then posts the final results.

importScripts('../taxengine.js', '../retirement_optimizer_core.js', 'prng.js', 'stats.js', 'historical_returns.js');

self.onmessage = function ({ data: cfg }) {
    const t0 = performance.now();
    const { numPaths, mu, sigma, seed, years, variations, simulationMode } = cfg;
    const rng = mulberry32(seed ?? 42);

    // Build scenario bank — Common Random Numbers so every variation sees identical shocks.
    let scenarioBank, multiAssetBank, medianAnnualReturn, logDrift;
    let minAnnualReturn =  Infinity;
    let maxAnnualReturn = -Infinity;
    let assetRanges = null;

    if (simulationMode === 'bootstrap') {
        // Multi-asset block bootstrap: synchronized draws from equity, bonds, intl (1970–2024 window).
        multiAssetBank = bootstrapMultiAssetBank(rng, numPaths, years);
        scenarioBank = multiAssetBank.equity;  // used for min/max/median reporting (equity proxy)
        for (let i = 0; i < scenarioBank.length; i++) {
            if (scenarioBank[i] < minAnnualReturn) minAnnualReturn = scenarioBank[i];
            if (scenarioBank[i] > maxAnnualReturn) maxAnnualReturn = scenarioBank[i];
        }
        const sortedEq = [...HISTORICAL_RETURNS.equity].sort((a, b) => a - b);
        medianAnnualReturn = sortedEq[Math.floor(sortedEq.length / 2)];
        // Compute per-asset-class ranges for metrics display
        let eqMin = Infinity, eqMax = -Infinity, bdMin = Infinity, bdMax = -Infinity, itMin = Infinity, itMax = -Infinity;
        for (let i = 0; i < multiAssetBank.equity.length; i++) {
            if (multiAssetBank.equity[i] < eqMin) eqMin = multiAssetBank.equity[i];
            if (multiAssetBank.equity[i] > eqMax) eqMax = multiAssetBank.equity[i];
            if (multiAssetBank.bonds[i]  < bdMin) bdMin = multiAssetBank.bonds[i];
            if (multiAssetBank.bonds[i]  > bdMax) bdMax = multiAssetBank.bonds[i];
            if (multiAssetBank.intl[i]   < itMin) itMin = multiAssetBank.intl[i];
            if (multiAssetBank.intl[i]   > itMax) itMax = multiAssetBank.intl[i];
        }
        assetRanges = { equity: [eqMin, eqMax], bonds: [bdMin, bdMax], intl: [itMin, itMax] };
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
        let ruinCount = 0;

        for (let p = 0; p < numPaths; p++) {
            const returnSeq = new Float64Array(years);
            for (let y = 0; y < years; y++) {
                const raw = scenarioBank[p * years + y];
                returnSeq[y] = simulationMode === 'bootstrap' ? raw : Math.exp(raw) - 1;
            }

            // Build per-account return sequences from multi-asset bank when available.
            let returnSequencePerAccount = null;
            if (simulationMode === 'bootstrap' && multiAssetBank) {
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

            let result;
            try {
                result = simulate({ ...baseInputs, returnSequence: returnSeq, returnSequencePerAccount });
            } catch (e) {
                // Treat a crashed simulation as immediate ruin
                ruinYears[p] = baseInputs.startYear ?? 2026;
                ruinCount++;
                continue;
            }

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

        const percentiles = computePercentiles(paths, years, numPaths);

        varResults.push({
            label:          baseInputs._label          ?? `Variation ${vi + 1}`,
            strategyFamily: baseInputs._strategyFamily ?? '',
            paramLabel:     baseInputs._paramLabel     ?? '',
            maxConversion:  baseInputs.maxConversion   ?? false,
            spendGoal:      baseInputs.spendGoal       ?? null,
            strategy:       baseInputs.strategy,
            propWithdraw:   baseInputs.propWithdraw,
            nYears:         baseInputs.nYears,
            stratRate:      baseInputs.stratRate,
            iraWithdrawPct: baseInputs.iraWithdrawPct,
            survivalRate:   (numPaths - ruinCount) / numPaths,
            medianRuinYear,
            percentiles: {
                p5:  Array.from(percentiles.p5),
                p25: Array.from(percentiles.p25),
                p50: Array.from(percentiles.p50),
                p75: Array.from(percentiles.p75),
                p95: Array.from(percentiles.p95),
            },
        });

        // Post a progress update every 5 variations and on the last one.
        if ((vi + 1) % 5 === 0 || vi === variations.length - 1) {
            postMessage({ type: 'progress', pct: (vi + 1) / variations.length });
        }
    }

    postMessage({
        type: 'results',
        variations: varResults,
        numPaths,
        years,
        totalMs:           performance.now() - t0,
        medianAnnualReturn,                        // geometric median, annualized
        minAnnualReturn,                           // worst single year across all paths
        maxAnnualReturn,                           // best single year across all paths
        inflationRate:     cfg.inflationRate ?? null,  // fixed rate from user inputs
        assetRanges,                               // { equity, bonds, intl } [min,max] (bootstrap only)
    });
};

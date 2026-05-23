// Monte Carlo simulation worker.
// Receives a config message, runs all variations against a shared scenario bank (CRN),
// posts progress updates, then posts the final results.

importScripts('../taxengine.js', '../retirement_optimizer_core.js', 'prng.js', 'stats.js');

self.onmessage = function ({ data: cfg }) {
    const { numPaths, mu, sigma, seed, years, variations } = cfg;
    const rng = mulberry32(seed ?? 42);

    // GBM: arithmetic expected return = mu, so log-space drift = mu - 0.5*sigma^2.
    const logDrift = mu - 0.5 * sigma * sigma;

    // Generate Common Random Numbers: one shared scenario bank so every variation
    // sees the exact same sequence of market shocks — apples-to-apples comparison.
    // scenarioBank[p * years + y] = log-space shock (drift + sigma*Z) for path p, year y.
    const scenarioBank = new Float64Array(numPaths * years);
    for (let p = 0; p < numPaths; p++) {
        for (let y = 0; y < years; y++) {
            scenarioBank[p * years + y] = logDrift + sigma * boxMuller(rng);
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
            // Convert scenario bank log-shocks to annual fractional return rates.
            // applyGrowth() multiplies balance by rate, so rate=0.07 → +7%.
            const returnSeq = new Float64Array(years);
            for (let y = 0; y < years; y++) {
                returnSeq[y] = Math.exp(scenarioBank[p * years + y]) - 1;
            }

            let result;
            try {
                result = simulate({ ...baseInputs, returnSequence: returnSeq });
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

    postMessage({ type: 'results', variations: varResults, numPaths, years });
};

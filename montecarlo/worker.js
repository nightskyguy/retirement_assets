// Monte Carlo simulation worker.
// Receives a config message, runs all variations against a shared scenario bank (CRN),
// posts progress updates, then posts the final results.

// Propagate the worker's own cache-bust token (?v=… from new Worker(...)) to its imported
// scripts so prng.js / core.js etc. never serve a stale cached copy when the worker refreshes.
const _v = self.location.search || '';
importScripts('../taxengine.js' + _v, '../optimizer_core.js' + _v, 'prng.js' + _v, 'stats.js' + _v, 'historical_returns.js' + _v);

// A throw in here used to escape as a worker `error` event, which mc_controller.js reads as "worker
// unavailable" and answers by retrying the identical config on the main thread -- where it threw
// again, that time as an unhandled promise rejection, so the completion callback never fired. The
// caller's in-flight flags then stayed set and the Stress Test froze for the rest of the session.
// Catching here turns any failure into an ordinary result message with an `error` field, which every
// caller already knows how to display.
self.onmessage = function (e) {
    try {
        runMonteCarloJob(e.data);
    } catch (err) {
        postMessage({ type: 'results', error: String((err && err.message) || err) });
    }
};

function runMonteCarloJob(cfg) {
    const t0 = performance.now();
    const { years, variations } = cfg;
    const simulationMode = cfg.simulationMode;
    const rng = mulberry32(cfg.seed ?? 42);

    // Runs the full bank-build + variations-sweep pipeline for one mode ('bootstrap'|'stress'|'gbm').
    // Historical mode auto-runs BOTH 'bootstrap' and 'stress' passes (folds the former standalone
    // Stress dropdown option into Historical); Synthetic mode runs only 'gbm'. progressOffset/
    // progressWeight let two passes share one progress bar without the second pass restarting it.
    function runPass(mode, progressOffset, progressWeight, runVariations) {
        const varsToUse = runVariations || variations;
        let numPaths = cfg.numPaths;
        let scenarioBank, multiAssetBank, medianAnnualReturn, logDrift;
        let synthInflationBank = null;
        let minAnnualReturn =  Infinity;
        let maxAnnualReturn = -Infinity;
        let assetRanges    = null;
        let inflationStats = null;

        if (mode === 'bootstrap') {
            // Multi-asset block bootstrap: synchronized draws from equity, bonds, intl, inflation (1970–2025 window).
            multiAssetBank = bootstrapMultiAssetBank(rng, numPaths, years);
            const bearFraction = (cfg.bearFraction ?? 25) / 100;
            if (bearFraction > 0) applyBearStartOverlay(multiAssetBank, rng, numPaths, years, bearFraction);
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
        } else if (mode === 'stress') {
            // Deterministic SoRR stress: N worst historical starting sequences.
            const stressCount = cfg.stressCount ?? 20;
            // cfg.stressWindow selects WHICH start years count as worst: a number ranks on that one
            // window, 'combined' unions the worst of every window, 'all' takes the whole record. It
            // is not a splice point, and it no longer decides early vs late - see buildStressBank.
            multiAssetBank = buildStressBank(stressCount, years, cfg.stressWindow ?? 'combined');
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
            // Synthetic modes. Both draw exactly one standard normal per path-year, in the same
            // order, and differ only in how that normal becomes a return:
            //   'gbm' - lognormal. The bank stores a LOG-SPACE shock, converted with Math.exp()-1
            //           downstream. mu is the log drift target, so the centre of the yearly return
            //           distribution lands at exp(mu - sigma^2/2) - 1, below the number typed.
            //   'aam' - arithmetic. The bank stores the FINAL return, as bootstrap's does. mu is the
            //           plain average of the yearly returns, so the centre IS the number typed.
            // Same seed, same shock sequence: the two are a paired comparison, not two independent
            // samples that happen to share a mean.
            const { mu, sigma } = cfg;
            const isAAM = (mode === 'aam');
            logDrift = mu - 0.5 * sigma * sigma;
            medianAnnualReturn = isAAM ? mu : Math.exp(logDrift) - 1;

            // Inflation draws come from their OWN stream. Sharing the return stream would mean that
            // turning inflation variation on, or merely retuning it, shifted every return draw after
            // it, so GBM results would move for a reason having nothing to do with returns. With a
            // separate stream, GBM's returns are bit-identical to what this file produced before
            // variable inflation existed, whatever the inflation knobs say.
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
                    // Correlated with THIS year's return draw: poor returns and rising prices in the
                    // same year is the joint event that breaks a plan, and independent draws erase it.
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
            const baseInputs = varsToUse[vi];

            // paths[p * years + y] = portfolio balance (0 once ruined, kept at last value after death)
            const paths = new Float64Array(numPaths * years);
            const ruinYears = new Uint16Array(numPaths); // 0 = survived to end of plan
            const taxPerPath = new Float64Array(numPaths); // lifetime taxes for each path
            const spendPerPath = new Float64Array(numPaths); // lifetime real (current-$) delivered spend
            let ruinCount = 0;

            for (let p = 0; p < numPaths; p++) {
                const returnSeq = new Float64Array(years);
                for (let y = 0; y < years; y++) {
                    const raw = scenarioBank[p * years + y];
                    // Only GBM banks a log-space shock. bootstrap, stress and aam all bank the
                    // final return. This used to test `mode === 'bootstrap'`, which exponentiated
                    // stress's already-decimal returns: harmless for balances, since
                    // returnSequencePerAccount overrides every account, but it fed a wrong
                    // yr.baseReturn into the log of every stress scenario.
                    returnSeq[y] = mode === 'gbm' ? Math.exp(raw) - 1 : raw;
                }

                // Build per-account return sequences from multi-asset bank when available.
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
                    // Treat a crashed simulation as immediate ruin
                    ruinYears[p] = baseInputs.startYear ?? 2026;
                    ruinCount++;
                    continue;
                }

                taxPerPath[p] = result.totals.tax ?? 0;
                spendPerPath[p] = result.totals.spendCurrentDollars ?? 0;
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

            // Median lifetime real (current-$) delivered spend across all paths.
            const spendSorted = Array.from(spendPerPath).sort((a, b) => a - b);
            const medianSpend = spendSorted[Math.floor(spendSorted.length / 2)] ?? null;

            const percentiles = computePercentiles(paths, years, numPaths);

            // In stress mode, capture individual path traces for per-scenario chart rendering.
            let stressPaths = null;
            if (mode === 'stress') {
                stressPaths = [];
                for (let p = 0; p < numPaths; p++) {
                    stressPaths.push(Array.from({ length: years }, (_, y) => paths[p * years + y]));
                }
            }

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
                medianRuinYear,
                medianTax,
                medianSpend,
                percentiles: {
                    p5:  Array.from(percentiles.p5),
                    p25: Array.from(percentiles.p25),
                    p50: Array.from(percentiles.p50),
                    p75: Array.from(percentiles.p75),
                    p95: Array.from(percentiles.p95),
                },
                stressPaths,
                // Per-scenario ruin years, stress only. The array is built for every mode but was
                // previously collapsed to medianRuinYear and discarded; the stress table needs the
                // individual years to color and sort by. At <= 20 entries the transfer is free.
                ruinYearsPerPath: mode === 'stress' ? Array.from(ruinYears) : null,
            });

            // Post a progress update every 5 variations and on the last one.
            if ((vi + 1) % 5 === 0 || vi === varsToUse.length - 1) {
                postMessage({ type: 'progress', pct: progressOffset + (vi + 1) / varsToUse.length * progressWeight });
            }
        }

        // Build input fan — per-year return/inflation percentile bands across all paths.
        // Bootstrap: equity bank is already decimal returns. GBM: convert log-normal shocks once.
        let equityBankForFan;
        if (mode === 'gbm') {
            // GBM alone banks log-space shocks; convert once for the fan.
            equityBankForFan = new Float64Array(numPaths * years);
            for (let i = 0; i < scenarioBank.length; i++) {
                equityBankForFan[i] = Math.exp(scenarioBank[i]) - 1;
            }
        } else {
            equityBankForFan = (mode === 'aam') ? scenarioBank : multiAssetBank.equity;
        }
        // Both synthetic modes now have a real inflation distribution to show, so the Input
        // Distribution inflation chart is no longer blank outside Historical mode.
        const inflationBankForFan = (['bootstrap', 'stress'].includes(mode) && multiAssetBank?.inflation)
            ? multiAssetBank.inflation
            : synthInflationBank;
        const inputFan = computeInputFan(equityBankForFan, inflationBankForFan, numPaths, years);

        return {
            varResults, numPaths, medianAnnualReturn, minAnnualReturn, maxAnnualReturn,
            assetRanges, inflationStats, inputFan,
            // Everything below is measured over the WHOLE plan horizon on the sequence each
            // scenario actually lived through, not over the ranking window: 'combined' has five
            // windows and 'all' has none, so a window-scoped figure has nothing to be scoped to.
            stressBank:           mode === 'stress' ? multiAssetBank : null,
        };
    }

    // Historical mode auto-runs a stress pass alongside the main bootstrap pass (Item 7 — Stress
    // is no longer a separate selectable mode). Weight the shared progress bar by each pass's
    // share of total path-work so it doesn't jump to 100% and restart for the second pass.
    // Stress runs in BOTH modes. It builds its own bank from the worst historical decades
    // (buildStressBank in runPass), so it never depended on the main pass being Historical -- it was
    // only ever gated that way by association. Choosing Synthetic returns for the projection is not
    // a reason to hide the question "would this plan have survived the worst of the real record".
    const willRunStress = true;
    const stressCountEstimate = cfg.stressCount ?? 20;
    // cfg.stressOnly: refresh just the stress pass against the edited plan and leave the main sweep
    // to the caller. The main pass is ~numPaths × variations sims (measured 27s / 72,000 sims on the
    // default scenario); stress is stressCount × 1, so this is the only pass cheap enough to re-run
    // on every input change. Never set in Synthetic mode, which has no stress pass at all.
    const stressOnly = !!cfg.stressOnly && willRunStress;
    const totalWork = willRunStress ? (cfg.numPaths + stressCountEstimate) : cfg.numPaths;
    const mainWeight = stressOnly ? 0 : (willRunStress ? cfg.numPaths / totalWork : 1);

    // Pass the selected mode straight through. This used to read
    // `simulationMode === 'bootstrap' ? 'bootstrap' : 'gbm'`, which folded every non-bootstrap mode
    // into GBM, so a third mode would have silently run as the second one.
    const mainMode = (simulationMode === 'bootstrap' || simulationMode === 'aam') ? simulationMode : 'gbm';
    const main = stressOnly ? null : runPass(mainMode, 0, mainWeight);
    // Stress runs against ONLY the current withdrawal strategy (mc_tab.js's runMonteCarlo()
    // builds this), not the full variations sweep — cfg.stressVariations falls back to the full
    // array if missing (e.g. a stale cached page mid-deploy), degrading to the old full-sweep behavior.
    const stressVars = cfg.stressVariations?.length ? cfg.stressVariations : variations;
    const stress = willRunStress ? runPass('stress', mainWeight, 1 - mainWeight, stressVars) : null;

    if (stressOnly) {
        postMessage({
            type: 'results',
            stressOnly: true,
            years,
            totalMs: performance.now() - t0,
            stress: buildStressMsg(stress),
        });
        return;
    }

    postMessage({
        type: 'results',
        variations: main.varResults,
        numPaths: main.numPaths,
        years,
        // Which model produced these numbers. The UI labels the reported centre differently for the
        // two synthetic modes, and cannot infer the mode from the payload.
        simulationMode: mainMode,
        totalMs:           performance.now() - t0,
        medianAnnualReturn: main.medianAnnualReturn,
        minAnnualReturn:    main.minAnnualReturn,
        maxAnnualReturn:    main.maxAnnualReturn,
        inflationRate:     cfg.inflationRate ?? null,
        assetRanges:       main.assetRanges,
        inflationStats:    main.inflationStats,
        inputFan:          main.inputFan,
        stress: buildStressMsg(stress),
    });
}

// Shared so the stress-only refresh and the full run cannot drift in shape. The four big return
// banks stay in the worker: the UI never reads them, and structured-cloning 98 x years x 4 Float64
// arrays across the boundary for nothing is the one place this pass could get expensive.
function buildStressMsg(stress) {
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

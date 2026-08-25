// The Monte Carlo engine: ONE implementation of the run, shared by the Web Worker and the
// main-thread fallback.
//
// It used to be two. worker.js held the real thing and mc_controller.js held a hand-kept copy for
// file:// (where a worker cannot load its scripts), and every change to the model meant the same
// edit twice - the P23 mode work was six paired edits in one session. The copies had already
// drifted: the controller grew per-path progress and cancellation that the worker never got, so the
// progress bar behaved differently depending on which one ran. This file is the merge, and it takes
// the RICHER behavior of the two, so the worker now reports progress inside a variation as well.
//
// Loadable three ways, like prng.js: module.exports for node, window for the page, bare globals
// under importScripts in the worker.
//
// Depends on, and does not own: simulate(), selectionOf() and afterTaxWealthOfLogRow()
// (optimizer_core.js), computePercentiles() and computeInputFan() (stats.js), and the bank
// builders in prng.js.

// Everything the caller may hook. All three are optional; the worker supplies only onProgress,
// which is why they default to no-ops rather than being required.
//   onProgress(pct)  - 0..1, called during the sweep.
//   shouldCancel()   - true aborts the run; runJob() then resolves to null.
//   yieldIfDue()     - awaited in the hot loop. The main thread returns a real promise here to give
//                      the UI a frame; the worker has no UI to unblock and leaves it a no-op.
const MC_NO_HOOKS = {
    onProgress:  () => {},
    shouldCancel: () => false,
    yieldIfDue:  () => {},
};

function _hooksOf(hooks) {
    if (!hooks) return MC_NO_HOOKS;
    return {
        onProgress:   hooks.onProgress   || MC_NO_HOOKS.onProgress,
        shouldCancel: hooks.shouldCancel || MC_NO_HOOKS.shouldCancel,
        yieldIfDue:   hooks.yieldIfDue   || MC_NO_HOOKS.yieldIfDue,
    };
}

// The per-path bundle handed to simulate(): the equity return sequence, the per-account sequences
// blended from the asset banks, and the inflation sequence. Split out because the Monte Carlo
// replay (P69) needs to rebuild the exact inputs of one path and must not do it from a second copy
// of this code.
//
// `banks` is { scenarioBank, multiAssetBank, synthInflationBank } as runPass() built them.
function buildPathInputs(banks, p, years, baseInputs, mode) {
    const { scenarioBank, multiAssetBank, synthInflationBank } = banks;

    const returnSequence = new Float64Array(years);
    for (let y = 0; y < years; y++) {
        const raw = scenarioBank[p * years + y];
        // Only GBM banks a log-space shock. bootstrap, stress and aam all bank the final return.
        // This used to test `mode === 'bootstrap'`, which exponentiated stress's already-decimal
        // returns: harmless for balances, since returnSequencePerAccount overrides every account,
        // but it fed a wrong yr.baseReturn into the log of every stress scenario.
        returnSequence[y] = mode === 'gbm' ? Math.exp(raw) - 1 : raw;
    }

    // Build per-account return sequences from the multi-asset bank when there is one.
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

    return { returnSequence, returnSequencePerAccount, inflationSequence };
}

// ── P69 replay: which paths are worth walking through the main model ─────────────────────────────
//
// The capture set is the worst CAPTURE_WORST_N paths plus one sample at each rank percentile in
// CAPTURE_RANK_PCTS, so the set spans failure through success rather than only failures. These two
// constants are the ONE place the count and the sampled ranks live.
const CAPTURE_WORST_N   = 5;
const CAPTURE_RANK_PCTS = [5, 25, 50, 75, 95];

// Ranks every path of one variation on ONE whole-run outcome and returns the capture rows,
// worst-first. The total order: ruined paths below all survivors, earliest ruin worst; survivors by
// ascending metric (after-tax terminal wealth); path index as the deterministic tie-break.
//
// This exists because the percentile BANDS are not paths: computePercentiles() sorts each year
// independently, so the p50 line is an envelope no simulation ever lived. A "p50 sample" is only
// well-defined as the path at that rank of a whole-run ordering - which is what rankPct labels.
// Rows are labeled by rank percentile, never as "the p50 path".
//
// Pure: takes the per-path arrays runPass() already computes, returns
// [{ pathIndex, rank, rankPct, ruinYear, metric }] with no sequences attached - shipping the
// sequences is transport, not selection. Ranks that coincide (a worst-N path that also lands on a
// sampled percentile, inevitable at small numPaths) appear once.
function selectCapturePaths(metricPerPath, ruinYears, numPaths, worstN, rankPcts) {
    worstN   = worstN   ?? CAPTURE_WORST_N;
    rankPcts = rankPcts ?? CAPTURE_RANK_PCTS;
    const order = Array.from({ length: numPaths }, (_, p) => p).sort((a, b) => {
        const ruinedA = ruinYears[a] > 0, ruinedB = ruinYears[b] > 0;
        if (ruinedA !== ruinedB) return ruinedA ? -1 : 1;
        if (ruinedA && ruinYears[a] !== ruinYears[b]) return ruinYears[a] - ruinYears[b];
        if (metricPerPath[a] !== metricPerPath[b]) return metricPerPath[a] - metricPerPath[b];
        return a - b;
    });
    const ranks = new Set();
    for (let i = 0; i < Math.min(worstN, numPaths); i++) ranks.add(i);
    for (const pct of rankPcts) ranks.add(Math.round(pct / 100 * (numPaths - 1)));
    return [...ranks].sort((x, y) => x - y).map(rank => ({
        pathIndex: order[rank],
        rank,
        rankPct:   numPaths > 1 ? +(100 * rank / (numPaths - 1)).toFixed(1) : 0,
        ruinYear:  ruinYears[order[rank]] || null,
        metric:    metricPerPath[order[rank]],
    }));
}

// Builds the return and inflation banks for one mode, plus the headline statistics the UI reports
// about them. Every number a path will ever see is drawn here, in this order, which is what CRN
// reproducibility rests on - so this is also the function the tests should exercise when they want
// to assert something about the draw itself, rather than reproducing the loop a fourth time.
//
// `rng` is passed IN rather than seeded here: both passes of a job draw from the SAME stream, and
// re-seeding per pass would change every number the second pass produces.
//
// Returns { scenarioBank, multiAssetBank, synthInflationBank, numPaths, medianAnnualReturn,
//           minAnnualReturn, maxAnnualReturn, assetRanges, inflationStats }. numPaths comes back
// because the stress mode overrides it: one path per historical scenario, however many that is.
function buildBanks(cfg, rng, mode) {
    const years = cfg.years;
    let numPaths = cfg.numPaths;
    let scenarioBank, multiAssetBank, medianAnnualReturn, logDrift;
    let synthInflationBank = null;
    let minAnnualReturn =  Infinity;
    let maxAnnualReturn = -Infinity;
    let assetRanges    = null;
    let inflationStats = null;

    if (mode === 'bootstrap') {
        // Multi-asset block bootstrap: synchronized draws from equity, bonds, intl, inflation (1970-2025 window).
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
        // CAGR is the right "center" statistic - matches what investors call "average annual return".
        // Arithmetic median of annual returns is ~16% for S&P (right-skewed), which misleads users
        // who expect CAGR (~10-11%). Single O(n) pass; avoids expensive sort.
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
        // Synthetic modes. The draw itself is drawSyntheticBank() in prng.js, which carries the
        // explanation of how one standard normal becomes a return under each mode; this loop only
        // decides the ORDER of the draws, which is what CRN reproducibility rests on.
        const { mu, sigma } = cfg;
        const isAAM = (mode === 'aam');
        logDrift = mu - 0.5 * sigma * sigma;
        medianAnnualReturn = isAAM ? mu : Math.exp(logDrift) - 1;

        // Inflation draws come from their OWN stream, keyed by INFLATION_STREAM_XOR (prng.js, where
        // the reason is written down). With a separate stream, GBM's returns are bit-identical to
        // what this engine produced before variable inflation existed, whatever the knobs say.
        const infRng           = mulberry32((cfg.seed ?? 42) ^ INFLATION_STREAM_XOR);
        const inflationTarget  = cfg.inflationRate ?? 0.03;
        const inflationPersist = cfg.inflationPersistence ?? INFLATION_AR1_PERSISTENCE;
        const inflationShockSd = cfg.inflationShockSd     ?? INFLATION_AR1_SHOCK_SD;
        const inflationCorr    = cfg.inflationReturnCorr  ?? INFLATION_RETURN_CORR;

        scenarioBank       = new Float64Array(numPaths * years);
        synthInflationBank = new Float64Array(numPaths * years);
        for (let p = 0; p < numPaths; p++) {
            let prevInflation = inflationTarget;
            for (let y = 0; y < years; y++) {
                const z1     = boxMuller(rng);
                const banked = drawSyntheticBank(mode, mu, sigma, logDrift, z1);
                const r      = syntheticReturnFromBank(mode, banked);
                scenarioBank[p * years + y] = banked;
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

        // Report the SIMULATED inflation distribution, not the single target rate, so every
        // consumer - the fan caption, the demo table, the Input Distribution chart - treats
        // synthetic inflation as a distribution, with no special case for the mode.
        let infMin = Infinity, infMax = -Infinity, infLogSum = 0;
        for (let i = 0; i < synthInflationBank.length; i++) {
            const v = synthInflationBank[i];
            if (v < infMin) infMin = v;
            if (v > infMax) infMax = v;
            infLogSum += Math.log1p(v);
        }
        inflationStats = { min: infMin, cagr: Math.exp(infLogSum / synthInflationBank.length) - 1, max: infMax };
    }

    return { scenarioBank, multiAssetBank, synthInflationBank, numPaths,
             medianAnnualReturn, minAnnualReturn, maxAnnualReturn, assetRanges, inflationStats };
}

// Runs the full bank-build + variations-sweep pipeline for one mode
// ('bootstrap' | 'stress' | 'gbm' | 'aam'). Historical mode auto-runs BOTH 'bootstrap' and 'stress'
// passes (folds the former standalone Stress dropdown option into Historical); the synthetic modes
// run their own pass plus stress. progressOffset/progressWeight let two passes share one progress
// bar without the second pass restarting it.
//
// Returns null if the caller's shouldCancel() went true mid-pass.
async function runPass(cfg, rng, mode, progressOffset, progressWeight, runVariations, hooks) {
    const h = _hooksOf(hooks);
    const years = cfg.years;
    const varsToUse = runVariations || cfg.variations;

    const banks = buildBanks(cfg, rng, mode);
    const { scenarioBank, multiAssetBank, synthInflationBank, numPaths,
            medianAnnualReturn, minAnnualReturn, maxAnnualReturn, assetRanges, inflationStats } = banks;

    const varResults = [];

    for (let vi = 0; vi < varsToUse.length; vi++) {
        if (h.shouldCancel()) return null;
        await h.yieldIfDue();

        const baseInputs = varsToUse[vi];

        // paths[p * years + y] = portfolio balance (0 once ruined, kept at last value after death)
        const paths        = new Float64Array(numPaths * years);
        const ruinYears    = new Uint16Array(numPaths);    // 0 = survived to end of plan
        const taxPerPath   = new Float64Array(numPaths);   // lifetime taxes for each path
        const spendPerPath = new Float64Array(numPaths);   // lifetime real (current-$) delivered spend
        // P69: one whole-run outcome per path, so the capture selector has a total order to rank
        // on. After-tax terminal wealth, the same basis Break Even and the stop-year search score.
        const metricPerPath = new Float64Array(numPaths);
        let ruinCount = 0;

        for (let p = 0; p < numPaths; p++) {
            // Check every 16 paths rather than every path: performance.now() in the hot loop is
            // itself measurable. Also lets Cancel take effect mid-variation, which it could not do
            // when a variation was the smallest interruptible unit. 16 rather than 64 because the
            // stress pass runs up to 98 paths, and at 64 that whole pass got two yields; the yield
            // itself is still gated on a 16ms budget, so the extra checks are a clock read, not a
            // task switch.
            if ((p & 15) === 0) {
                await h.yieldIfDue();
                if (h.shouldCancel()) return null;
                // Progress within the variation, so a one-variation run has a moving bar instead of
                // sitting at its starting percentage until the whole run finishes.
                h.onProgress(progressOffset
                    + ((vi + p / numPaths) / varsToUse.length) * progressWeight);
            }

            const pathInputs = buildPathInputs(banks, p, years, baseInputs, mode);

            let result;
            try {
                result = simulate({ ...baseInputs, ...pathInputs });
            } catch (e) {
                // Treat a crashed simulation as immediate ruin
                ruinYears[p] = baseInputs.startYear ?? 2026;
                metricPerPath[p] = -Infinity;
                ruinCount++;
                continue;
            }

            taxPerPath[p]   = result.totals.tax ?? 0;
            spendPerPath[p] = result.totals.spendCurrentDollars ?? 0;
            const log = result.log;
            const lastRow = log[log.length - 1];
            metricPerPath[p] = lastRow
                ? afterTaxWealthOfLogRow(lastRow, baseInputs.futureIRATaxRate)
                : -Infinity;
            let ruined = false;

            for (let y = 0; y < years; y++) {
                if (ruined) {
                    paths[p * years + y] = 0;
                    continue;
                }

                if (y >= log.length) {
                    // Both persons deceased before plan horizon - persist last balance.
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

        // Median ruin year among failed paths only.
        const failures = [];
        for (let p = 0; p < numPaths; p++) {
            if (ruinYears[p] > 0) failures.push(ruinYears[p]);
        }
        failures.sort((a, b) => a - b);
        const medianRuinYear = failures.length > 0
            ? failures[Math.floor(failures.length / 2)]
            : null;

        // Median lifetime taxes, and median lifetime real (current-$) delivered spend, across all paths.
        const taxSorted = Array.from(taxPerPath).sort((a, b) => a - b);
        const medianTax = taxSorted[Math.floor(taxSorted.length / 2)] ?? null;
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
            spendGoal:      baseInputs.spendGoal       ?? null,
            // The whole strategy identity, from the one list optimizer_core.js keeps for it. This
            // was a hand-written subset and it was missing four fields, so the page could not tell
            // one Ordered sequence from another, and an IRMAA, ACA or Guyton-Klinger plan matched
            // no row at all - which is how the chart came to emphasize a strategy nobody picked.
            ...selectionOf(baseInputs),
            // Defaults the page reads directly rather than through sameStrategySelection.
            fundConversionWithCash: baseInputs.fundConversionWithCash ?? false,
            cyclicEnabled:  baseInputs.cyclicEnabled   ?? false,
            cyclicOrder:    baseInputs.cyclicOrder     ?? 'ira-first',
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
            // P69: the replay capture rows - worst-N plus rank-percentile samples, worst-first,
            // ~10 small objects per variation. Sequences are NOT attached here; the replay UI
            // gets them separately, for the one variation being replayed, not all of them.
            captured: selectCapturePaths(metricPerPath, ruinYears, numPaths),
        });

        // Progress update every 5 variations and on the last one.
        if ((vi + 1) % 5 === 0 || vi === varsToUse.length - 1) {
            h.onProgress(progressOffset + (vi + 1) / varsToUse.length * progressWeight);
        }
    }

    // Build input fan - per-year return/inflation percentile bands across all paths.
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
    // Both synthetic modes have a real inflation distribution to show, so the Input Distribution
    // inflation chart is not blank outside Historical mode.
    const inflationBankForFan = (['bootstrap', 'stress'].includes(mode) && multiAssetBank?.inflation)
        ? multiAssetBank.inflation
        : synthInflationBank;
    const inputFan = computeInputFan(equityBankForFan, inflationBankForFan, numPaths, years);

    return {
        varResults, numPaths, medianAnnualReturn, minAnnualReturn, maxAnnualReturn,
        assetRanges, inflationStats, inputFan,
        // Everything above is measured over the WHOLE plan horizon on the sequence each scenario
        // actually lived through, not over the ranking window: 'combined' has five windows and
        // 'all' has none, so a window-scoped figure has nothing to be scoped to.
        stressBank: mode === 'stress' ? multiAssetBank : null,
    };
}

// Shared so the stress-only refresh and the full run cannot drift in shape. The four big return
// banks stay behind: the UI never reads them, and structured-cloning 98 x years x 4 Float64 arrays
// across the worker boundary for nothing is the one place this pass could get expensive.
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

// One whole Monte Carlo job: the main pass, the stress pass, and the results message both callers
// post or hand back. Returns null if the run was cancelled - the caller reports nothing in that
// case, which is what leaves a cancelled run's previous results on screen.
async function runJob(cfg, hooks) {
    const h  = _hooksOf(hooks);
    const t0 = performance.now();
    const { years, variations } = cfg;
    const simulationMode = cfg.simulationMode;
    const rng = mulberry32(cfg.seed ?? 42);

    // Stress runs in BOTH modes. It builds its own bank from the worst historical decades
    // (buildStressBank in runPass), so it never depended on the main pass being Historical - it was
    // only ever gated that way by association. Choosing Synthetic returns for the projection is not
    // a reason to hide the question "would this plan have survived the worst of the real record".
    const willRunStress = true;
    const stressCountEstimate = cfg.stressCount ?? 20;
    // cfg.stressOnly: refresh just the stress pass against the edited plan and leave the main sweep
    // to the caller. The main pass is ~numPaths x variations sims (measured 27s / 72,000 sims on the
    // default scenario); stress is stressCount x 1, so this is the only pass cheap enough to re-run
    // on every input change.
    const stressOnly = !!cfg.stressOnly && willRunStress;
    // Weight the shared progress bar by each pass's share of total path-work so it doesn't jump to
    // 100% and restart for the second pass.
    const totalWork = willRunStress ? (cfg.numPaths + stressCountEstimate) : cfg.numPaths;
    const mainWeight = stressOnly ? 0 : (willRunStress ? cfg.numPaths / totalWork : 1);

    // Pass the selected mode straight through. This used to read
    // `simulationMode === 'bootstrap' ? 'bootstrap' : 'gbm'`, which folded every non-bootstrap mode
    // into GBM, so a third mode would have silently run as the second one.
    const mainMode = (simulationMode === 'bootstrap' || simulationMode === 'aam') ? simulationMode : 'gbm';

    const main = stressOnly ? null : await runPass(cfg, rng, mainMode, 0, mainWeight, null, h);
    if (!stressOnly && main === null) return null;   // cancelled mid-pass

    // Stress runs against ONLY the current withdrawal strategy (mc_tab.js's runMonteCarlo() builds
    // this), not the full variations sweep - cfg.stressVariations falls back to the full array if
    // missing (e.g. a stale cached page mid-deploy), degrading to the old full-sweep behavior.
    const stressVars = cfg.stressVariations?.length ? cfg.stressVariations : variations;
    const stress = willRunStress
        ? await runPass(cfg, rng, 'stress', mainWeight, 1 - mainWeight, stressVars, h)
        : null;
    if (willRunStress && stress === null) return null;   // cancelled mid-pass

    if (stressOnly) {
        return {
            type: 'results',
            stressOnly: true,
            years,
            totalMs: performance.now() - t0,
            stress: buildStressMsg(stress),
        };
    }

    return {
        type: 'results',
        variations: main.varResults,
        numPaths: main.numPaths,
        years,
        // Which model produced these numbers. The UI labels the reported center differently for the
        // two synthetic modes, and cannot infer the mode from the payload.
        simulationMode: mainMode,
        totalMs:            performance.now() - t0,
        medianAnnualReturn: main.medianAnnualReturn,
        minAnnualReturn:    main.minAnnualReturn,
        maxAnnualReturn:    main.maxAnnualReturn,
        inflationRate:     cfg.inflationRate ?? null,
        assetRanges:       main.assetRanges,
        inflationStats:    main.inflationStats,
        inputFan:          main.inputFan,
        stress: buildStressMsg(stress),
    };
}

// Same three-host tail as prng.js. Keep the two lists identical: a name missing from one of them
// fails only in that host, which is exactly the kind of drift this file exists to end.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runJob, runPass, buildBanks, buildPathInputs, buildStressMsg, selectCapturePaths, CAPTURE_WORST_N, CAPTURE_RANK_PCTS, MC_NO_HOOKS };
} else if (typeof window !== 'undefined') {
    window.MCEngine = { runJob, runPass, buildBanks, buildPathInputs, buildStressMsg, selectCapturePaths, CAPTURE_WORST_N, CAPTURE_RANK_PCTS, MC_NO_HOOKS };
}

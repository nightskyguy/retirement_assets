// Deflation floor for simulated inflation. Historical worst (1932 ≈ −9.9%) is an outlier that
// distorts results; every path-building routine clamps inflation to this minimum so the reported
// min inflation never drops below −1%.
const INFLATION_FLOOR = -0.01;

// mulberry32: fast, seeded 32-bit PRNG. Returns a closure generating uniform [0, 1).
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Box-Muller: one standard normal variate from two independent uniforms.
// Clamps u1 away from 0 to avoid log(0).
function boxMuller(rng) {
    const u1 = Math.max(1e-10, rng());
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Block bootstrap scenario bank from HISTORICAL_RETURNS.equity.
// Draws overlapping blocks of blockSize years; truncates block if near end of history.
// Returns Float64Array of fractional returns (not log-space), length numPaths × years.
// Depends on HISTORICAL_RETURNS (historical_returns.js) being loaded first.
function bootstrapScenarioBank(rng, numPaths, years, blockSize = 3) {
    const src = HISTORICAL_RETURNS.equity;
    const n   = src.length;
    const bank = new Float64Array(numPaths * years);
    for (let p = 0; p < numPaths; p++) {
        let y = 0;
        while (y < years) {
            const start = Math.floor(rng() * n);
            const len   = Math.min(blockSize, years - y, n - start);
            for (let b = 0; b < len; b++) bank[p * years + (y++)] = src[start + b];
        }
    }
    return bank;
}

// The ranking windows the UI offers. 'combined' scores against every one of them and keeps the
// union; a single number scores against that one alone.
const STRESS_WINDOWS = [5, 10, 15, 20, 30];

// Rolling stretch lengths reported per scenario ("worst 5 years anywhere in this run", etc). Not the
// same list as STRESS_WINDOWS: 30 is a useful ranking window but a 30-year rolling minimum inside a
// 30-year plan has exactly one sample, which is just the full-period figure again.
const STRESS_ROLLING_WINDOWS = [5, 10, 15, 20];

// Deflation floor used when a CAGR is turned into a REAL CAGR. Separate from INFLATION_FLOOR, which
// clamps individual years in the bank; this one clamps an averaged rate.
const REAL_CAGR_INFLATION_FLOOR = -0.005;

// Fisher: what an equity CAGR is worth after an inflation CAGR has eaten into it.
function _realCagr(eqCagr, infCagr) {
    return (1 + eqCagr) / (1 + Math.max(REAL_CAGR_INFLATION_FLOOR, infCagr)) - 1;
}

// International return at a record index, with the domestic-equity proxy rule applied.
//
// The intl series runs 1970 to the end of its own data, which is shorter than the equity series.
// Outside that span domestic equity stands in: before 1970 international markets were not separately
// investable and were highly correlated with US equity, and past the end of the intl data the
// alternative is an out-of-range undefined turning every downstream CAGR into NaN. The distortion is
// small because intl is typically under 10% of a portfolio.
//
// This rule was written out three times, in the stress bank, the bootstrap bank and the bear overlay.
// One copy, so a correction cannot land in two of the three.
function _intlAt(idx) {
    const off = HISTORICAL_RETURNS.intlStartYear - HISTORICAL_RETURNS.equityStartYear;   // 42
    const j   = idx - off;
    return (j >= 0 && j < HISTORICAL_RETURNS.intl.length)
        ? HISTORICAL_RETURNS.intl[j]
        : HISTORICAL_RETURNS.equity[idx];
}

// The windows actually usable for a plan of `years`. A 30-year window on a 25-year plan would rank
// start years on a stretch the plan never lives through, so it clamps to the plan and then dedupes:
// a 25-year plan scores against 5/10/15/20/25, not 5/10/15/20/25/25.
function stressWindowsFor(years) {
    const cap = Math.min(HISTORICAL_RETURNS.equity.length, years || 30);
    return [...new Set(STRESS_WINDOWS.map(w => Math.max(1, Math.min(w, cap))))];
}

// Memo for scoreStartYears, keyed by window length. Cleared only by a page reload, which is the only
// thing that can change its input.
//
// The ranking is a pure function of sLen and HISTORICAL_RETURNS, and that table is a static data file
// nothing ever writes to, so the answer for a given window cannot change within a page load.
// 'combined' asks for five windows and 'all' asks for the same five again, and a stress refresh runs
// on every debounced sidebar edit, so the identical ranking was being re-derived indefinitely.
//
// Be honest about the size of this: measured at ~0.1ms out of a ~2.7s stress refresh. It is here
// because the work is redundant, not because it was slow. Nearly all of that 2.7s is fixed worker
// startup, which no amount of precomputation touches.
const _scoreCache = new Map();

// Score every start index that has a full `sLen` years of REAL record after it, worst real CAGR
// first. Returns [{i, year, eqCagr, infCagr, realCagr}].
//
// The scoring deliberately does NOT wrap, which is why the loop stops at n - sLen. A 2015 start
// scored on a 30-year window would be ranking 11 years of record followed by 19 years of 1928
// replayed, and calling the result one of the worst 30-year stretches in history. The PATH fill
// below does wrap, because a long plan leaves no choice, but a wrapped stretch never gets a vote in
// which start years are worst.
//
// The array and its entries are SHARED with every other caller for the same window, and frozen to
// keep that safe. Callers slice it and build their own objects from it; nothing may write to an
// entry in place.
function scoreStartYears(sLen) {
    const cached = _scoreCache.get(sLen);
    if (cached) return cached;

    const eq     = HISTORICAL_RETURNS.equity;
    const infSrc = HISTORICAL_RETURNS.inflation;
    const n      = eq.length;
    const scored = [];
    for (let i = 0; i <= n - sLen; i++) {
        let eqLogSum = 0, infLogSum = 0;
        for (let y = 0; y < sLen; y++) {
            eqLogSum  += Math.log1p(eq[i + y]);
            infLogSum += Math.log1p(infSrc[i + y]);
        }
        const eqCagr   = Math.exp(eqLogSum / sLen) - 1;
        const infFloor = Math.max(REAL_CAGR_INFLATION_FLOOR, Math.exp(infLogSum / sLen) - 1);
        scored.push(Object.freeze({ i, eqCagr, infCagr: infFloor, realCagr: _realCagr(eqCagr, infFloor),
                                    year: HISTORICAL_RETURNS.equityStartYear + i }));
    }
    scored.sort((a, b) => a.realCagr - b.realCagr);   // ascending: worst real returns first

    Object.freeze(scored);
    _scoreCache.set(sLen, scored);
    return scored;
}

// Which historical start years the stress pass runs, for a given mode.
//
//   a number       the `count` worst by real CAGR over that one window. The original behaviour.
//   'combined'     the worst `count` from EVERY window in STRESS_WINDOWS, unioned and deduped.
//                  The windows overlap heavily, so this is typically far fewer than 5 x count
//                  (about 23 distinct start years at count 10), and it stops a single window's
//                  choice from hiding the start years the other four would have flagged.
//   'all'          every start year in the record, ranked by nobody.
//
// Returns [{i, year, nominatedBy:[windows], worstScore}] where worstScore is the real CAGR of the
// window that ranked this start year worst -- its deepest nomination -- and is what 'combined' sorts
// on. 'all' sorts by start year instead, since nothing is being ranked.
function selectStressStarts(count, years, mode) {
    const n    = HISTORICAL_RETURNS.equity.length;
    const want = (Number.isFinite(count) && count >= 1) ? Math.floor(count) : 10;
    const wins = stressWindowsFor(years);

    // index -> {i, year, nominatedBy, worstScore}. Built the same way for every mode so the caller
    // never has to care which one produced it.
    const picked = new Map();
    const nominate = (s, w) => {
        const cur = picked.get(s.i);
        if (cur) {
            cur.nominatedBy.push(w);
            if (s.realCagr < cur.worstScore) cur.worstScore = s.realCagr;
        } else {
            picked.set(s.i, { i: s.i, year: s.year, nominatedBy: [w], worstScore: s.realCagr });
        }
    };

    if (mode === 'all') {
        for (let i = 0; i < n; i++) {
            picked.set(i, { i, year: HISTORICAL_RETURNS.equityStartYear + i,
                            nominatedBy: [], worstScore: Infinity });
        }
        // Still record which windows would have flagged each year: it is the one piece of ranking
        // information an unranked run can still carry, and the table reports it.
        for (const w of wins) {
            for (const s of scoreStartYears(w).slice(0, want)) {
                const row = picked.get(s.i);
                row.nominatedBy.push(w);
                if (s.realCagr < row.worstScore) row.worstScore = s.realCagr;
            }
        }
        return [...picked.values()].sort((a, b) => a.year - b.year);
    }

    if (mode === 'combined') {
        for (const w of wins) for (const s of scoreStartYears(w).slice(0, want)) nominate(s, w);
        // Worst first by deepest nomination; ties broken by start year so the order is total.
        return [...picked.values()].sort((a, b) => a.worstScore - b.worstScore || a.year - b.year);
    }

    const sLen = Math.max(1, Math.min(Number(mode) || 10, n, years || Number(mode) || 10));
    for (const s of scoreStartYears(sLen).slice(0, want)) nominate(s, sLen);
    return [...picked.values()];   // already worst-first: scoreStartYears sorts, slice preserves
}

// The minimum real CAGR over any rolling `w`-year stretch INSIDE this scenario's own realized
// sequence, or null when the plan is shorter than w. Prefix log-sums make each length one O(years)
// pass instead of O(years * w).
//
// This replaces the old per-window CAGR columns. Those measured the ranking window, which stops
// meaning anything once the windows are combined (there is no single one) or dropped entirely (in
// 'all' nothing is ranked). The worst rolling stretch is a property of the sequence itself, so it
// reads the same in every mode.
function _worstRollingReal(prefixEq, prefixInf, years, w) {
    if (w > years) return null;
    let worst = Infinity;
    for (let o = 0; o + w <= years; o++) {
        const eqCagr  = Math.exp((prefixEq[o + w]  - prefixEq[o])  / w) - 1;
        const infCagr = Math.exp((prefixInf[o + w] - prefixInf[o]) / w) - 1;
        const real    = _realCagr(eqCagr, infCagr);
        if (real < worst) worst = real;
    }
    return worst;
}

// Deterministic SoRR stress bank: one path per selected historical start year, each walking the real
// record forward for the whole plan. Sequences wrap at the end of history for plans longer than the
// remaining record (a 40-year plan starting 1998 continues from 1928).
//
// windowMode is a RANKING device, not a splice point: a number, 'combined' or 'all' (see
// selectStressStarts). It decides WHICH start years run; it does not change what happens after the
// window, and it no longer decides whether a failure counts as early or late -- stressOutcomeBand
// grades that on the plan's own length. Every scenario walks the real record straight through for
// the full `years` horizon (the `% n` wrap below), so there is no randomized, bootstrapped or
// assumed-return tail. That is also why this function takes no rng: the stress pass is a
// deterministic enumeration of history and the seed cannot move it.
//
// Returns the four return banks plus, per scenario: startYears, realYears (how many plan years come
// from the actual record before the wrap), nominatedBy, full-horizon CAGRs, and worstRealCAGRs
// keyed by rolling window length.
function buildStressBank(count = 10, years, windowMode = 10) {
    const eq      = HISTORICAL_RETURNS.equity;
    const bd      = HISTORICAL_RETURNS.bonds;
    const infSrc  = HISTORICAL_RETURNS.inflation;
    const n       = eq.length;   // 98 (1928-2025)

    const isMulti = (windowMode === 'combined' || windowMode === 'all');
    const sLen    = isMulti ? null
                            : Math.max(1, Math.min(Number(windowMode) || 10, n, years || Number(windowMode) || 10));
    const starts  = selectStressStarts(count, years, windowMode);
    // The candidate pool is only (n - window + 1) start years: 94 at a 5-year window, 69 at 30.
    // Asking for more sequences than that used to slice short and then walk off the end of the
    // ranked list here, which threw. The throw was swallowed (the worker's onerror retried on the
    // main thread, where it threw again inside an async function), so the visible symptom was the
    // Stress Test freezing for the rest of the session rather than an error. selectStressStarts
    // caps instead, and the caller sizes numPaths off what came back.
    const nSeq    = starts.length;
    const eqBank  = new Float64Array(nSeq * years);
    const bdBank  = new Float64Array(nSeq * years);
    const itBank  = new Float64Array(nSeq * years);
    const infBank = new Float64Array(nSeq * years);

    const labels        = [];
    const startYears    = [];
    const realYears     = [];
    const nominatedBy   = [];
    const fullEqCAGRs   = [];
    const fullBondCAGRs = [];
    const fullIntlCAGRs = [];
    const fullInflCAGRs = [];
    const fullRealCAGRs = [];
    const worstRealCAGRs = {};
    for (const w of STRESS_ROLLING_WINDOWS) if (w <= years) worstRealCAGRs[w] = [];

    // Reused across scenarios; [k] is the log-sum over plan years [0, k).
    const pEq  = new Float64Array(years + 1);
    const pInf = new Float64Array(years + 1);

    for (let p = 0; p < nSeq; p++) {
        const { i: si, year, nominatedBy: noms } = starts[p];
        let bdLogSum = 0, itLogSum = 0;
        for (let y = 0; y < years; y++) {
            const idx = (si + y) % n;
            const eqY = eq[idx];
            const itY = _intlAt(idx);
            const bdY = bd[idx];
            const infY = Math.max(INFLATION_FLOOR, infSrc[idx]);
            eqBank [p * years + y] = eqY;
            bdBank [p * years + y] = bdY;
            infBank[p * years + y] = infY;
            itBank [p * years + y] = itY;
            pEq [y + 1] = pEq [y] + Math.log1p(eqY);
            pInf[y + 1] = pInf[y] + Math.log1p(infY);
            bdLogSum += Math.log1p(bdY);
            itLogSum += Math.log1p(itY);
        }

        // Every reported CAGR is measured over the WHOLE plan horizon, on the sequence the plan
        // actually lived through, wrapped tail included. The old columns measured the ranking
        // window, which no longer exists in every mode.
        const fullEq   = Math.exp(pEq[years]  / years) - 1;
        const fullInf  = Math.exp(pInf[years] / years) - 1;
        fullEqCAGRs.push(fullEq);
        fullInflCAGRs.push(fullInf);
        fullRealCAGRs.push(_realCagr(fullEq, fullInf));
        fullBondCAGRs.push(Math.exp(bdLogSum / years) - 1);
        fullIntlCAGRs.push(Math.exp(itLogSum / years) - 1);
        for (const w of Object.keys(worstRealCAGRs)) {
            worstRealCAGRs[w].push(_worstRollingReal(pEq, pInf, years, Number(w)));
        }

        startYears.push(year);
        nominatedBy.push(noms);
        // How many plan years follow the ACTUAL record before the sequence wraps back to 1928. A
        // 2015 start on a 30-year plan gets 11; the rest is the record replayed from the beginning.
        realYears.push(Math.min(years, n - si));
        labels.push(String(year));
    }

    return { equity: eqBank, bonds: bdBank, intl: itBank, inflation: infBank,
             labels, startYears, realYears, nominatedBy,
             fullEqCAGRs, fullBondCAGRs, fullIntlCAGRs, fullInflCAGRs, fullRealCAGRs,
             worstRealCAGRs,
             // How the start years were chosen, and the windows that were actually in play after
             // clamping to the plan. The UI labels itself from these rather than re-reading the
             // input, which can have moved on since the run.
             windowMode,
             windowsUsed: isMulti ? stressWindowsFor(years) : [sLen],
             scoreYears: sLen,
             // What was asked for vs what the record could supply, so the UI can say "capped at 84
             // of the 200 you asked for" instead of silently returning a shorter list. In the modes
             // that do not rank, everything available was taken, so the two agree by construction.
             requestedCount: (Number.isFinite(count) && count >= 1) ? Math.floor(count) : 10,
             candidatePool: isMulti ? nSeq : (n - sLen + 1) };
}

// Outcome class for one stress scenario, used for both the chart line color and the row shading
// in the per-scenario table. Pure so the boundary cases are testable in node.
//   'ruin-early'  ran out in the FIRST HALF of the plan
//   'ruin-late'   ran out in the second half
//   'survive'     never ruined
//
// Graded on the plan's own length, not on the ranking window. The window used to draw this line,
// which worked only while there was exactly one of them; 'combined' has five and 'all' has none, so
// there is nothing left to grade against. Halving the plan is also the more useful question: running
// dry at year 8 of 30 and at year 28 of 30 are different kinds of bad, and a fixed 10-year line
// called both of them the same thing on a long plan.
//
// planStartYear is the plan's FIRST CALENDAR YEAR (2026), not the historical year the return
// sequence is drawn from (1973). The money runs out on the plan's clock.
// ruinYear is 0/null for a path that survived (worker.js leaves the slot at 0).
// Exactly half is LATE: on a 30-year plan, year 15 is the first year of the second half.
function stressOutcomeBand(planStartYear, ruinYear, planYears) {
    if (!ruinYear) return 'survive';
    return (ruinYear - planStartYear) < planYears / 2 ? 'ruin-early' : 'ruin-late';
}

// The opening lengths the bear-start overlay draws from, and how many worst start years each one
// contributes.
//
// It used to be a single 10-year window, which biased the overlay toward one shape. Averaging over a
// decade washes a crash out: 1930 is the WORST opening in the record over three years, at -26.9%/yr
// real, and only the 13th worst over ten, at -0.4%/yr, because the decade starting 1930 contains
// 1933's +54% rebound. Ranked on decades the pool came out as 1999, 1965, 2000, 1969, 1968, 1966,
// 1972, 1973, 1970 and 1929: six of ten 1960s-70s stagflation, 1930 absent, and only 1929 opening
// worse than -15%/yr over its first three years. Worse, a 1929 draw was spliced for ten years, so the
// crash arrived with its own 1933-1936 rebound attached -- the overlay could not produce "crash, then
// whatever comes next", which is the sequence-risk shape people mean by a bear start.
//
// Three lengths, because they find genuinely different shapes: only 12 of the worst 20 are shared
// between the 3-year and 10-year rankings. The short windows surface sharp crashes (1930, 1931,
// 2006-2008), the long one surfaces the slow grind (1964-1971) that no individual 3-year stretch
// flags. Same argument as the Stress window's Combined mode.
const BEAR_OVERLAY_WINDOWS = [3, 5, 10];
// Per window, not in total: the pool is 3 x this many (start year, length) pairs.
// Deliberately a CONSTANT and not the user's "Stress sequences" input, which is what it used to read.
// That reuse coupled two unrelated things: the overlay runs in the MAIN bootstrap pass, so a change
// to a Stress Test display setting silently moved every Historical result and raised the "Out of
// date" banner, for a reason no reader could have guessed from a control labelled "how many worst
// sequences the Stress Test chart shows".
const BEAR_OVERLAY_POOL = 10;

// The (start year, opening length) pairs the overlay samples. One entry per window per rank, so a
// year several windows agree on appears several times and is drawn proportionally more often -- and
// appears at each of the lengths that flagged it, since 1930-over-3-years and 1930-over-10-years are
// two different stresses, not one year listed twice.
// Returns [{ i, year, len, realCagr }].
function buildBearPool(countPerWindow = BEAR_OVERLAY_POOL) {
    const pool = [];
    for (const w of BEAR_OVERLAY_WINDOWS) {
        for (const s of scoreStartYears(w).slice(0, countPerWindow)) {
            pool.push({ i: s.i, year: s.year, len: w, realCagr: s.realCagr });
        }
    }
    return pool;
}

// Bear-start overlay: overwrites the opening of the first bearFraction of bootstrap paths with a
// randomly-sampled worst historical opening, then lets the block bootstrap carry on from there.
// Modifies bank in-place. Called immediately after bootstrapMultiAssetBank, before stats scanning.
//
// Draws exactly one rng value per overlaid path, as it always has, so the stream position after this
// function does not depend on the pool or the opening lengths.
function applyBearStartOverlay(bank, rng, numPaths, years, bearFraction) {
    if (bearFraction <= 0) return;
    const bearCount = Math.floor(numPaths * bearFraction);
    if (bearCount === 0) return;
    const pool = buildBearPool();
    if (!pool.length) return;

    const eq     = HISTORICAL_RETURNS.equity;
    const bd     = HISTORICAL_RETURNS.bonds;
    const infSrc = HISTORICAL_RETURNS.inflation;
    const n      = eq.length;

    for (let p = 0; p < bearCount; p++) {
        const pick = pool[Math.floor(rng() * pool.length)];
        // Cap at the plan: a 10-year opening spliced into a 5-year plan used to run off the end of
        // this path's row and overwrite the start of the next one.
        const len = Math.min(pick.len, years);
        for (let y = 0; y < len; y++) {
            // scoreStartYears only ranks start years with a full `len` years of real record after
            // them, so this never wraps; the modulo is belt and braces.
            const idx = (pick.i + y) % n;
            const dst = p * years + y;
            bank.equity[dst]    = eq[idx];
            bank.bonds[dst]     = bd[idx];
            bank.intl[dst]      = _intlAt(idx);
            bank.inflation[dst] = Math.max(INFLATION_FLOOR, infSrc[idx]);
        }
    }
}

// Multi-asset block bootstrap: synchronized draws from equity, bonds, intl, and inflation.
// Sampling range: full equity/bonds/inflation history (1928-2025, 98 years).
// For years before 1970, intl data does not exist — domestic equity return is used as a proxy
// (pre-1970 international markets were not separately investable and were highly correlated
// with US equity; this is a minor distortion since intl is typically ≤10% of total portfolio).
// All four series use the same block start index, preserving historical correlations within blocks
// (e.g., stagflation years keep high inflation aligned with poor real equity returns).
// Returns { equity, bonds, intl, inflation } — each Float64Array of length numPaths × years.
function bootstrapMultiAssetBank(rng, numPaths, years, blockSize = 3) {
    const eqSrc   = HISTORICAL_RETURNS.equity;
    const n       = eqSrc.length;   // 98 (1928-2025) - full history
    const eqBank  = new Float64Array(numPaths * years);
    const bdBank  = new Float64Array(numPaths * years);
    const itBank  = new Float64Array(numPaths * years);
    const infBank = new Float64Array(numPaths * years);
    for (let p = 0; p < numPaths; p++) {
        let y = 0;
        while (y < years) {
            const start = Math.floor(rng() * n);
            const len   = Math.min(blockSize, years - y, n - start);
            for (let b = 0; b < len; b++) {
                const idx = start + b;
                eqBank [p * years + y + b] = eqSrc[idx];
                bdBank [p * years + y + b] = HISTORICAL_RETURNS.bonds[idx];
                infBank[p * years + y + b] = Math.max(INFLATION_FLOOR, HISTORICAL_RETURNS.inflation[idx]);
                // intl available only from 1970 through the last intl data year; use equity as a
                // proxy for years outside that window (pre-1970 AND any recent year not yet in the
                // intl series — e.g. equity/inflation extended to 2025 before intl). Guarding the
                // upper bound prevents an out-of-range undefined → NaN in the intl CAGR.
                itBank [p * years + y + b] = _intlAt(idx);
            }
            y += len;
        }
    }
    return { equity: eqBank, bonds: bdBank, intl: itBank, inflation: infBank };
}

// The worker loads this file with importScripts() and calls everything as bare globals; this tail
// only adds a namespace so optimizer_core.tests.js can assert against the REAL stress selection
// instead of reimplementing the scoring math inline.
if (typeof module !== 'undefined' && module.exports) {
    // HISTORICAL_RETURNS is a bare global under importScripts. In node it is a module-scoped const,
    // so it has to be pulled onto globalThis before buildStressBank() can read it.
    if (typeof globalThis.HISTORICAL_RETURNS === 'undefined') require('./historical_returns.js');
    module.exports = { mulberry32, boxMuller, bootstrapScenarioBank, buildStressBank,
                       stressOutcomeBand, applyBearStartOverlay, bootstrapMultiAssetBank,
                       scoreStartYears, selectStressStarts, stressWindowsFor, buildBearPool,
                       STRESS_WINDOWS, STRESS_ROLLING_WINDOWS,
                       BEAR_OVERLAY_WINDOWS, BEAR_OVERLAY_POOL, INFLATION_FLOOR };
} else if (typeof window !== 'undefined') {
    // Keep this list identical to the module.exports above: optimizer_core.tests.js runs against
    // whichever one its host provides, so a name missing here fails only in the browser tier.
    window.MCPrng = { mulberry32, boxMuller, bootstrapScenarioBank, buildStressBank,
                      stressOutcomeBand, applyBearStartOverlay, bootstrapMultiAssetBank,
                      scoreStartYears, selectStressStarts, stressWindowsFor, buildBearPool,
                      STRESS_WINDOWS, STRESS_ROLLING_WINDOWS,
                      BEAR_OVERLAY_WINDOWS, BEAR_OVERLAY_POOL, INFLATION_FLOOR };
}

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

// Deterministic SoRR stress bank: the `count` worst historical retirement-start sequences,
// scored by first `scoreYears` equity CAGR.  Sequences wrap at end of history for plans
// longer than remaining history (e.g., a 40-yr plan starting 1998 continues from 1928).
// Returns { equity, bonds, intl, inflation, labels, startYears, decadeCAGRs }
// where numPaths == count (deterministic, no RNG needed).
function buildStressBank(count = 10, years, scoreYears = 10) {
    const eq      = HISTORICAL_RETURNS.equity;
    const bd      = HISTORICAL_RETURNS.bonds;
    const infSrc  = HISTORICAL_RETURNS.inflation;
    const intlSrc = HISTORICAL_RETURNS.intl;
    const n       = eq.length;   // 97
    const intlOff = HISTORICAL_RETURNS.intlStartYear - HISTORICAL_RETURNS.equityStartYear;  // 42
    const sLen    = Math.min(scoreYears, n);

    // Score all starting indices that have at least sLen real years remaining.
    const scored = [];
    for (let i = 0; i <= n - sLen; i++) {
        let logSum = 0;
        for (let y = 0; y < sLen; y++) logSum += Math.log1p(eq[i + y]);
        scored.push({ i, cagr: Math.exp(logSum / sLen) - 1,
                      year: HISTORICAL_RETURNS.equityStartYear + i });
    }
    scored.sort((a, b) => a.cagr - b.cagr);   // ascending: worst first

    const worst    = scored.slice(0, count);
    const eqBank   = new Float64Array(count * years);
    const bdBank   = new Float64Array(count * years);
    const itBank   = new Float64Array(count * years);
    const infBank  = new Float64Array(count * years);
    const labels      = [];
    const startYears  = [];
    const decadeCAGRs = [];

    for (let p = 0; p < count; p++) {
        const { i: si, year, cagr } = worst[p];
        labels.push(String(year));
        startYears.push(year);
        decadeCAGRs.push(cagr);
        for (let y = 0; y < years; y++) {
            const idx = (si + y) % n;
            eqBank [p * years + y] = eq[idx];
            bdBank [p * years + y] = bd[idx];
            infBank[p * years + y] = infSrc[idx];
            itBank [p * years + y] = idx >= intlOff ? intlSrc[idx - intlOff] : eq[idx];
        }
    }

    return { equity: eqBank, bonds: bdBank, intl: itBank, inflation: infBank,
             labels, startYears, decadeCAGRs };
}

// Multi-asset block bootstrap: synchronized draws from equity, bonds, intl, and inflation.
// Sampling range: full equity/bonds/inflation history (1928–2024, 97 years).
// For years before 1970, intl data does not exist — domestic equity return is used as a proxy
// (pre-1970 international markets were not separately investable and were highly correlated
// with US equity; this is a minor distortion since intl is typically ≤10% of total portfolio).
// All four series use the same block start index, preserving historical correlations within blocks
// (e.g., stagflation years keep high inflation aligned with poor real equity returns).
// Returns { equity, bonds, intl, inflation } — each Float64Array of length numPaths × years.
function bootstrapMultiAssetBank(rng, numPaths, years, blockSize = 3) {
    const eqSrc   = HISTORICAL_RETURNS.equity;
    const n       = eqSrc.length;   // 97 (1928-2024) — full history
    const intlOff = HISTORICAL_RETURNS.intlStartYear - HISTORICAL_RETURNS.equityStartYear;  // 42
    const intlSrc = HISTORICAL_RETURNS.intl;
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
                infBank[p * years + y + b] = HISTORICAL_RETURNS.inflation[idx];
                // intl available only from 1970; use equity as proxy for earlier years.
                itBank [p * years + y + b] = idx >= intlOff
                    ? intlSrc[idx - intlOff]
                    : eqSrc[idx];
            }
            y += len;
        }
    }
    return { equity: eqBank, bonds: bdBank, intl: itBank, inflation: infBank };
}

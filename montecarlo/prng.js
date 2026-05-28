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

// Multi-asset block bootstrap: synchronized draws from equity, bonds, and intl (all aligned to
// the 1970–2024 overlap window so asset returns within a block remain historically correlated).
// Returns { equity, bonds, intl } — each Float64Array of length numPaths × years.
// Sampling range: intl series (55 years, 1970–2024); equity/bonds use same window via offset.
function bootstrapMultiAssetBank(rng, numPaths, years, blockSize = 3) {
    const intlSrc = HISTORICAL_RETURNS.intl;
    const n       = intlSrc.length;   // 55 (1970-2024)
    const off     = HISTORICAL_RETURNS.intlStartYear - HISTORICAL_RETURNS.equityStartYear;  // 42
    const eqBank  = new Float64Array(numPaths * years);
    const bdBank  = new Float64Array(numPaths * years);
    const itBank  = new Float64Array(numPaths * years);
    for (let p = 0; p < numPaths; p++) {
        let y = 0;
        while (y < years) {
            const start = Math.floor(rng() * n);
            const len   = Math.min(blockSize, years - y, n - start);
            for (let b = 0; b < len; b++) {
                const idx = start + b;
                eqBank[p * years + y + b] = HISTORICAL_RETURNS.equity[idx + off];
                bdBank[p * years + y + b] = HISTORICAL_RETURNS.bonds[idx + off];
                itBank[p * years + y + b] = intlSrc[idx];
            }
            y += len;
        }
    }
    return { equity: eqBank, bonds: bdBank, intl: itBank };
}

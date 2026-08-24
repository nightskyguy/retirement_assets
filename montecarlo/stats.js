// Compute per-year percentile bands for equity returns and (optionally) inflation.
// equityBank[p * years + y] = decimal return (e.g. 0.12 for 12%) for path p, year y.
// inflationBank: same layout, or null. Every mode passes a real bank since P23 gave the synthetic
// modes their own AR(1) inflation; null remains supported and simply leaves the fan's inflation half
// empty.
// Returns { equity: {min,p10,p50,p90,max}, inflation: {min,p10,p50,p90,max} | null }
function computeInputFan(equityBank, inflationBank, numPaths, years) {
    const col = new Float64Array(numPaths);

    function bands(bank) {
        const min = [], p10 = [], p50 = [], p90 = [], max = [];
        for (let y = 0; y < years; y++) {
            for (let p = 0; p < numPaths; p++) col[p] = bank[p * years + y];
            col.sort();
            min.push(col[0]);
            p10.push(col[Math.max(0, Math.floor(numPaths * 0.10) - 1)]);
            p50.push(col[Math.max(0, Math.floor(numPaths * 0.50) - 1)]);
            p90.push(col[Math.max(0, Math.floor(numPaths * 0.90) - 1)]);
            max.push(col[numPaths - 1]);
        }
        return { min, p10, p50, p90, max };
    }

    return {
        equity:    bands(equityBank),
        inflation: inflationBank ? bands(inflationBank) : null,
    };
}

// Compute per-year percentile bands from a flat paths array.
// paths[p * years + y] = portfolio balance for path p at year y (0 if ruined).
// Returns { p5, p25, p50, p75, p95 } as Float32Arrays of length `years`.
function computePercentiles(paths, years, numPaths) {
    const out = {
        p5:  new Float32Array(years),
        p25: new Float32Array(years),
        p50: new Float32Array(years),
        p75: new Float32Array(years),
        p95: new Float32Array(years),
    };
    const col = new Float64Array(numPaths);

    for (let y = 0; y < years; y++) {
        for (let p = 0; p < numPaths; p++) {
            col[p] = paths[p * years + y];
        }
        col.sort();
        // Use Math.floor so indices stay in bounds; clamp to 0.
        out.p5[y]  = col[Math.max(0, Math.floor(numPaths * 0.05) - 1)];
        out.p25[y] = col[Math.max(0, Math.floor(numPaths * 0.25) - 1)];
        out.p50[y] = col[Math.max(0, Math.floor(numPaths * 0.50) - 1)];
        out.p75[y] = col[Math.max(0, Math.floor(numPaths * 0.75) - 1)];
        out.p95[y] = col[Math.max(0, Math.floor(numPaths * 0.95) - 1)];
    }
    return out;
}

// Same three-host tail as prng.js and mc_engine.js. The worker and the page load this file as a
// plain script and call both functions as bare globals; node needs the names on an object before
// the test suite can put them on globalThis for mc_engine.js to find.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeInputFan, computePercentiles };
} else if (typeof window !== 'undefined') {
    window.MCStats = { computeInputFan, computePercentiles };
}

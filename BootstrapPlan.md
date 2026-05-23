# Monte Carlo Simulation — Improvement Plan

Captured 2026-05-23 from design discussion in Session 6.

---

## Current State

The Session 6 Monte Carlo tab uses **log-normal GBM (Geometric Brownian Motion)** with i.i.d. annual draws:

```
r_year = exp((μ − σ²/2) + σ·Z) − 1,   Z ~ N(0,1)
```

Parameters: μ (expected arithmetic return), σ (volatility), both set by the user.

**Known limitations:**
- Each year is drawn independently — no memory of prior years
- Can produce single-year returns of 60%+ (historically almost impossible; best S&P year ~54% in 1954)
- Can produce 8+ consecutive losing years (historically never happened; longest streak was 4 years, 1929–1932)
- Single σ implicitly models a blended portfolio rather than separate asset classes
- Sequence-of-returns risk is not properly modeled unless the user picks a σ appropriate for their allocation

---

## Improvement 1 — Historical Bootstrap (Near-Term, Recommended First)

### What it does

Instead of drawing from a parametric distribution, sample **with replacement** from the actual annual return history of each asset class. The historical dataset is small (~99 data points for S&P going back to 1926) but captures:
- The true shape of the distribution (fat left tail, slight positive skew)
- Realistic caps: no year will exceed the historical maximum (~+54%) or minimum (~−44%)
- Naturally prevents pathological 8-consecutive-loss scenarios

### Simple vs. Block Bootstrap

| Mode | Mechanics | Pros | Cons |
|------|-----------|------|------|
| **Simple** | Draw one year at a time | Easy, unbiased | Breaks multi-year momentum/trends |
| **Block (recommended)** | Draw overlapping 3-year blocks, stitch together | Preserves serial structure (momentum, mean reversion) | Slightly more complex; edges need handling |

Block size of 3 years is a good default — captures short-term momentum without over-fitting to historical sequences.

### Historical data to embed

Suggested embedded dataset (US Large-Cap / S&P 500 annual nominal returns, 1926–2024):

```js
const HISTORICAL_RETURNS = {
  'US Equity': [/* annual returns as decimals, 1926–2024 */],
  'US Bonds':  [/* Barclays Aggregate or similar, 1976–2024 + proxies earlier */],
  'Intl Equity': [/* MSCI EAFE or similar, 1970–2024 */],
};
```

Roughly 99 values for equities, 49 for bonds/international. Small enough to inline as a JS constant.

### Implementation sketch

```js
// prng.js addition
function bootstrapDraw(rng, historicalReturns, numPaths, years, blockSize = 3) {
    const n = historicalReturns.length;
    const bank = new Float64Array(numPaths * years);
    for (let p = 0; p < numPaths; p++) {
        let y = 0;
        while (y < years) {
            // Pick a random starting index, draw blockSize consecutive years
            const start = Math.floor(mulberry32(rng)() * (n - blockSize + 1));
            for (let b = 0; b < blockSize && y < years; b++, y++) {
                bank[p * years + y] = historicalReturns[start + b];
            }
        }
    }
    return bank;
}
```

The worker and mc_controller would accept a `simulationMode` parameter: `'gbm'` (current) or `'bootstrap'`.

### UI change

Add a toggle in the nerd panel (NERD_KNOBS only):
```
Simulation mode:  ● GBM (parametric)  ○ Historical bootstrap
```

In non-nerd mode, default to bootstrap — it's more realistic and requires no parameter tuning.

---

## Improvement 2 — Separate Asset Classes with Correlated Returns (Medium-Term)

### Motivation

A single σ cannot simultaneously model a 100% equity portfolio and a 60/40 portfolio. The key difference between them is not just average return — it's **sequence-of-returns risk**, which is the dominant risk in early retirement.

Modeling stocks and bonds separately allows:
- Each account to have its own stock/bond ratio
- The correlation between assets to reduce portfolio volatility correctly
- A "glide path" (de-risking with age) to be modeled naturally

### Correlated return generation

Use Cholesky decomposition of the 2×2 correlation matrix:

```
Σ = | σ_s²        ρ·σ_s·σ_b |
    | ρ·σ_s·σ_b   σ_b²      |

L = cholesky(Σ)   // lower-triangular, 3 values

[r_stocks, r_bonds] = L · [Z₁, Z₂],   Z₁,Z₂ ~ N(0,1)
```

Historical parameters (nominal, approximate):
| Asset | μ (arith) | σ | Correlation |
|-------|-----------|---|-------------|
| US Equity | 11% | 17% | — |
| US Bonds | 5% | 7% | −0.10 to +0.10 |
| Intl Equity | 9% | 18% | +0.75 with US |

### Per-account return

Each year, account return =  `stockPct × r_stocks + bondPct × r_bonds`

The simulate() function would need to accept a `returnSequence` per account, or a pair of `(stockReturn, bondReturn)` arrays plus per-account allocations.

### UI

Small allocation grid, either global or per-account:

```
           Stocks   Bonds
IRA:        60%      40%
Roth:       80%      20%
Brokerage:  70%      30%
```

Percentages must sum to 100% per account. A global "portfolio split" is a simpler starting point.

---

## Improvement 3 — Regime-Switching Model (Longer-Term)

### What it does

Markets alternate between **Bull** and **Bear** regimes via Markov transitions. This produces realistic multi-year trending without requiring historical data.

| Regime | μ | σ | P(stay) |
|--------|---|---|---------|
| Bull | +14% | 11% | 0.85 |
| Bear | −8% | 22% | 0.65 |

Unconditional moments implied by these parameters roughly match historical US equity statistics.

### Why it matters

- Bull markets persist longer than random chance (captures momentum)
- Bear markets are shorter but more volatile (captures crash dynamics)
- Prevents consecutive-loss runs that are unrealistically long
- More transparent to explain than bootstrap: "the model knows markets trend"

### Implementation sketch

```js
// Each path has a hidden state: 0=bull, 1=bear
let state = rng() < 0.8 ? 0 : 1;  // ~80% chance to start in bull
for (let y = 0; y < years; y++) {
    const { mu, sigma, pStay } = REGIMES[state];
    shock = (mu - 0.5*sigma*sigma) + sigma * boxMuller(rng);
    // Transition
    if (rng() > pStay) state = 1 - state;
}
```

---

## Recommended Implementation Order

1. **Historical bootstrap** (drop-in replacement for the GBM scenario bank; add `simulationMode` switch; no changes to simulate() needed)
2. **Global stock/bond split** with correlated GBM (2 new parameters: stockPct, bondCorrelation; still one return per year but blended)
3. **Per-account allocation** (requires simulate() changes for per-account growth rates)
4. **Regime-switching** as a third simulation mode option in the nerd panel

---

## Files to Change

| File | Change |
|------|--------|
| `montecarlo/prng.js` | Add `bootstrapScenarioBank()` function |
| `montecarlo/worker.js` | Accept `simulationMode`; call bootstrap or GBM path |
| `montecarlo/mc_controller.js` | Same (fallback path) |
| `montecarlo/mc_tab.js` | Add mode toggle to nerd panel; pass mode in cfg |
| `retirement_optimizer_core.js` | Add per-account `stockPct` inputs to `getInputs()` (phase 2) |
| `retirement_optimizer.html` | Asset allocation inputs per account (phase 2) |
| New: `montecarlo/historical_returns.js` | Embedded annual return arrays by asset class |

---

## Open Questions

- What years to include in the historical dataset? 1926–present (full history) or 1970–present (post-Bretton-Woods, arguably more relevant)?
- For block bootstrap: overlap or non-overlap blocks? Overlapping gives more coverage of the small dataset.
- Should the non-nerd default be bootstrap (more realistic, no tuning needed) or GBM (faster, more transparent parameter meaning)?
- International equities as a third asset class? MSCI EAFE data only goes back to 1970, which limits the historical bootstrap sample.

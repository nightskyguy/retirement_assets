// Monte Carlo tab — UI controller.
// Depends on: retirement_optimizer_core.js (getInputs, buildVariations),
//             montecarlo/mc_controller.js (runMCWorker, cancelMCWorker),
//             Chart.js (global Chart)

let _mcChart             = null;
let _mcResults           = null;
let _mcSelected          = new Set(); // indices of variations currently on chart
let _mcStartYear         = 2026;      // cached from getInputs() at run time
let _lastMCHash          = null;
let _mcBase              = null;      // getInputs() snapshot captured at run time
let _inputEquityChart    = null;
let _inputInflationChart = null;

// --- Initialization -------------------------------------------------------

function initMCTab() {
    const btn = document.getElementById('btn-mc');
    if (!btn) return;
    btn.style.display = '';  // Tab always visible.

    // Show the Simulation Parameters panel only for nerd-knob users.
    // Normal users: panel stays hidden and the tab click auto-runs.
    const nerdPanel = document.getElementById('mc-nerd-panel');
    if (nerdPanel) {
        nerdPanel.style.display = _mcNerdMode() ? '' : 'none';
    }
    const inputDist = document.getElementById('mc-input-dist');
    if (inputDist) inputDist.style.display = _mcNerdMode() ? '' : 'none';
}

// Returns true when NERD_KNOBS is active.
function _mcNerdMode() {
    return typeof NERD_KNOBS !== 'undefined' && NERD_KNOBS;
}

// Dim μ/σ inputs when bootstrap is selected (they're unused in that mode).
function updateMCModeUI() {
    const isBootstrap = (document.getElementById('mc-sim-mode')?.value === 'bootstrap');
    ['mc-mu', 'mc-sigma'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = isBootstrap;
        el.closest('label').style.opacity = isBootstrap ? '0.4' : '';
    });
}

// Called by the Monte Carlo tab button.
// In normal mode, runs immediately with default params (panel stays hidden).
function mcTabActivated() {
    // Always sync mode UI — handles scenario-load case where mc-sim-mode was restored
    // but the tab wasn't visible when applyScenario() ran.
    updateMCModeUI();

    if (!_mcNerdMode()) {
        const hash = _buildMCHash();
        if (hash === _lastMCHash && _mcResults) {
            renderMCResults(_mcResults);
            return;
        }
        runMonteCarlo();
    }
}

function _buildMCHash() {
    const base = getInputs();
    return JSON.stringify({
        inputs:   base,
        numPaths: document.getElementById('mc-num-paths')?.value  ?? '500',
        mu:       document.getElementById('mc-mu')?.value         ?? '7',
        sigma:    document.getElementById('mc-sigma')?.value      ?? '12',
        seed:     document.getElementById('mc-seed')?.value       ?? '42',
        simMode:  document.getElementById('mc-sim-mode')?.value   ?? 'gbm',
    });
}

// --- Run ------------------------------------------------------------------

function runMonteCarlo() {
    _lastMCHash = _buildMCHash();

    const base = getInputs();

    const numPaths       = parseInt(document.getElementById('mc-num-paths')?.value  ?? '500');
    const mu             = parseFloat(document.getElementById('mc-mu')?.value       ?? '7')  / 100;
    const sigma          = parseFloat(document.getElementById('mc-sigma')?.value    ?? '12') / 100;
    const seed           = parseInt(document.getElementById('mc-seed')?.value       ?? '42');
    const simulationMode = document.getElementById('mc-sim-mode')?.value ?? 'gbm';

    _mcStartYear = base.startYear ?? 2026;
    _mcBase = base;
    const variations = buildVariations(base);
    const years = Math.max(
        base.birthyear1 + base.die1,
        base.birthyear2 + base.die2
    ) - (base.startYear ?? 2026) + 1;

    // Calibrate timing on first run so the estimate shown during the run is meaningful.
    if (estimateMCMs(numPaths, variations.length) == null) {
        calibrateMCMs({ variations, mu, sigma, seed, years });
    }

    // UI feedback
    setMCRunning(true);

    runMCWorker(
        { variations, numPaths, mu, sigma, seed, years, simulationMode, inflationRate: base.inflation },
        (pct) => updateMCProgress(pct),
        (msg) => {
            setMCRunning(false);
            if (msg.error) {
                document.getElementById('mc-error').textContent = 'Error: ' + msg.error;
                document.getElementById('mc-error').style.display = '';
                return;
            }
            _mcResults = msg;
            _mcSelected.clear();
            renderMCResults(msg);
        }
    );
}

function cancelMC() {
    cancelMCWorker();
    setMCRunning(false);
}

// --- Rendering ------------------------------------------------------------

// Returns the index of the variation that matches the user's current strategy settings,
// or -1 if no match is found (e.g. the strategy isn't in the variation list).
function findCurrentStrategyIdx(variations, base) {
    if (!base) return -1;
    return variations.findIndex(v => {
        if (v.strategy !== base.strategy) return false;
        if (!!v.cyclicEnabled !== !!base.cyclicEnabled) return false;
        if (v.cyclicEnabled && (v.cyclicOrder ?? 'ira-first') !== (base.cyclicOrder ?? 'ira-first')) return false;
        if (base.strategy === 'propwd')   return Math.abs((v.propWithdraw   ?? 0) - (base.propWithdraw   ?? 0)) < 0.001;
        if (base.strategy === 'fixed')    return v.nYears === base.nYears;
        if (base.strategy === 'bracket')  return Math.abs((v.stratRate      ?? 0) - (base.stratRate      ?? 0)) < 0.001;
        if (base.strategy === 'fixedpct') return Math.abs((v.iraWithdrawPct ?? 0) - (base.iraWithdrawPct ?? 0)) < 0.001;
        return false;
    });
}

function renderMCResults(msg) {
    document.getElementById('mc-error').style.display = 'none';
    renderMCMetrics(msg);
    renderSurvivalTable(msg.variations, msg.numPaths);

    // Default chart: best variation per base strategy family (highest survival, then highest median
    // final balance as tiebreaker). When both Cyclic and non-Cyclic variants exist for a family,
    // pick whichever is better. Exception: always include the exact current-settings variation.
    _mcSelected.clear();
    const currentIdx = findCurrentStrategyIdx(msg.variations, _mcBase);

    // Build best-per-BASE-family map. Cyclic variants use "🔄 Family" names; strip the prefix
    // so both variants compete within the same slot.
    const byBaseFamily = {};
    const isBetter = (v, best) => {
        const vFinal    = v.percentiles.p50[v.percentiles.p50.length - 1] ?? 0;
        const bestFinal = best.percentiles.p50[best.percentiles.p50.length - 1] ?? 0;
        return v.survivalRate > best.survivalRate ||
               (v.survivalRate === best.survivalRate && vFinal > bestFinal);
    };
    msg.variations.forEach((v, i) => {
        const baseFamily = v.strategyFamily.replace(/^🔄B?\s*/, '');
        const bestIdx    = byBaseFamily[baseFamily];
        if (bestIdx == null || isBetter(v, msg.variations[bestIdx])) {
            byBaseFamily[baseFamily] = i;
        }
    });

    // Always include the exact current variation (may override the best-of-family slot).
    if (currentIdx >= 0) {
        const baseFamily = msg.variations[currentIdx].strategyFamily.replace(/^🔄B?\s*/, '');
        byBaseFamily[baseFamily] = currentIdx;
    }

    Object.values(byBaseFamily).forEach(i => _mcSelected.add(i));

    renderMCChart(msg);
    if (_mcNerdMode()) renderInputFanCharts(msg.inputFan, msg.years);
    syncTableCheckboxes();
}

// --- Metrics bar ----------------------------------------------------------

function renderMCMetrics(msg) {
    const el = document.getElementById('mc-metrics');
    if (!el) return;

    const ms   = msg.totalMs            != null ? msg.totalMs                                : null;
    const grow = msg.medianAnnualReturn != null ? (msg.medianAnnualReturn * 100).toFixed(1) : null;
    const lo   = msg.minAnnualReturn    != null ? (msg.minAnnualReturn    * 100).toFixed(1) : null;
    const hi   = msg.maxAnnualReturn    != null ? (msg.maxAnnualReturn    * 100).toFixed(1) : null;
    const inf  = msg.inflationRate      != null ? (msg.inflationRate      * 100).toFixed(1) : null;
    const infS = msg.inflationStats;   // { min, cagr, max } — bootstrap mode only

    const pct = (v, decimals = 1) => (v >= 0 ? '+' : '') + (v * 100).toFixed(decimals) + '%';

    const parts = [];
    if (ms != null) {
        const sec = (ms / 1000).toFixed(ms < 10000 ? 1 : 0);
        parts.push(`Completed in <strong>${sec} s</strong>`);
    }

    // Bootstrap mode: all return/inflation data is in the compact table — no redundant text lines.
    // Synthetic (GBM) mode: no table, show the summary lines instead.
    if (!msg.assetRanges) {
        if (grow != null) parts.push(`Median growth <strong>${grow}%/yr</strong> <span style="color:#888;font-size:0.85em;">(geometric)</span>`);
        if (lo != null && hi != null) parts.push(
            `Equity range <strong style="color:${parseFloat(lo)<0?'#c0392b':'inherit'}">${lo}%</strong>`
            + ` to <strong>${hi}%</strong>`
            + ` <span style="color:#888;font-size:0.85em;">(worst/best yr)</span>`
        );
        if (inf != null) parts.push(`Inflation <strong>${inf}%/yr</strong> <span style="color:#888;font-size:0.85em;">(fixed)</span>`);
    }

    // Bootstrap: compact min/CAGR/max table — includes inflation as 4th row.
    // assetRanges values are [min, cagr, max] tuples.
    if (msg.assetRanges) {
        const ar  = msg.assetRanges;
        const iS  = msg.inflationStats;
        const td  = 'style="padding:1px 5px;text-align:right;"';
        const tdL = 'style="padding:1px 6px 1px 0;color:#555;white-space:nowrap;"';
        const thS = 'style="padding:0 5px;font-weight:normal;color:#888;text-align:right;"';
        const fmtV = (v) => {
            const s = (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
            return `<span style="color:${v < 0 ? '#c0392b' : '#1a7a1a'}">${s}</span>`;
        };
        const row = (label, range) =>
            `<tr><td ${tdL}>${label}</td>`
            + `<td ${td}>${fmtV(range[0])}</td>`
            + `<td ${td}><strong>${fmtV(range[1])}</strong></td>`
            + `<td ${td}>${fmtV(range[2])}</td></tr>`;
        let tbl =
            `<table style="display:inline-table;border-collapse:collapse;font-size:0.8em;vertical-align:middle;margin-left:4px;">`
            + `<tr><th></th><th ${thS}>Min</th><th ${thS}>CAGR</th><th ${thS}>Max</th></tr>`
            + row('Equity',    ar.equity)
            + row('Bonds',     ar.bonds)
            + row('Intl',      ar.intl);
        if (iS) tbl += row('Inflation', [iS.min, iS.cagr, iS.max]);
        tbl += `</table>`;
        parts.push(`<span style="color:#888;font-size:0.8em;">Sampled (1928–2024)</span>${tbl}`);
    }

    el.innerHTML = parts.join(' &nbsp;·&nbsp; ');
    el.style.display = parts.length ? '' : 'none';
}

// --- Time estimate --------------------------------------------------------

function updateMCTimeEstimate() {
    const el        = document.getElementById('mc-time-est');
    if (!el) return;
    const numPaths  = parseInt(document.getElementById('mc-num-paths')?.value ?? '500');
    const base      = getInputs();
    const numVar    = buildVariations(base).length;
    const estMs     = estimateMCMs(numPaths, numVar);
    if (estMs == null) { el.textContent = ''; return; }
    el.textContent = estMs < 1000
        ? `~${estMs} ms`
        : `~${(estMs / 1000).toFixed(1)} s`;
}

// --- Survival Table -------------------------------------------------------

function renderSurvivalTable(variations, numPaths) {
    const tbody = document.getElementById('mc-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Sort: primary = survival rate desc, secondary = median final balance desc
    const sorted = variations
        .map((v, i) => ({ ...v, _origIdx: i }))
        .sort((a, b) => {
            if (b.survivalRate !== a.survivalRate) return b.survivalRate - a.survivalRate;
            const aFinal = a.percentiles.p50[a.percentiles.p50.length - 1] ?? 0;
            const bFinal = b.percentiles.p50[b.percentiles.p50.length - 1] ?? 0;
            return bFinal - aFinal;
        });

    sorted.forEach(v => {
        const pct     = (v.survivalRate * 100).toFixed(1);
        const ruinTxt = v.medianRuinYear ? String(v.medianRuinYear) : '—';
        const color   = v.survivalRate >= 0.90 ? '#d4edda'
                      : v.survivalRate >= 0.75 ? '#fff3cd'
                      : '#f8d7da';

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.title = `${v.strategyFamily} ${v.paramLabel}${v.maxConversion ? ' ✓' : ''} — click to load`;
        tr.dataset.varIdx = v._origIdx;

        const spendTxt  = v.spendGoal  != null ? '$' + fmt(v.spendGoal)  : '—';
        const taxTxt    = v.medianTax  != null ? '$' + fmt(Math.round(v.medianTax)) : '—';
        const tdR = 'style="padding:2px 4px;text-align:right;"';
        tr.innerHTML = `
            <td style="padding:2px 6px 2px 4px;text-align:center;background:#fff;border-right:2px solid #dee2e6;">
                <input type="checkbox" class="mc-var-check" data-idx="${v._origIdx}">
            </td>
            <td ${tdR}>${escapeHtml(v.strategyFamily)}</td>
            <td ${tdR}>${escapeHtml(v.paramLabel)}</td>
            <td ${tdR}>${spendTxt}</td>
            <td ${tdR}>${ruinTxt}</td>
            <td ${tdR}>$${fmt(v.percentiles.p50[v.percentiles.p50.length - 1])}</td>
            <td ${tdR} style="padding:2px 4px;text-align:right;font-weight:bold;">${pct}%</td>
            <td ${tdR}>${taxTxt}</td>
        `;
        // Apply row shading to data cells only (not the checkbox column)
        Array.from(tr.querySelectorAll('td')).slice(1).forEach(td => td.style.background = color);

        tr.querySelector('.mc-var-check').addEventListener('change', (e) => {
            e.stopPropagation();
            const idx = parseInt(e.target.dataset.idx);
            if (e.target.checked) {
                _mcSelected.add(idx);
            } else {
                _mcSelected.delete(idx);
            }
            renderMCChart(_mcResults);
        });

        tr.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return;
            loadMCVariation(v);
        });

        tbody.appendChild(tr);
    });

    document.getElementById('mc-table-wrap').style.display = '';
    const _pathTxt = `${numPaths.toLocaleString()} paths`;
    const _pcBar = document.getElementById('mc-path-count');
    const _pcTbl = document.getElementById('mc-path-count-tbl');
    if (_pcBar) _pcBar.textContent = _pathTxt;
    if (_pcTbl) _pcTbl.textContent = _pathTxt;
}

function loadMCVariation(v) {
    if (!v.strategy) return;
    document.getElementById('strategy').value = v.strategy;
    if (v.strategy === 'propwd'    && v.propWithdraw   != null) document.getElementById('propWithdraw').value   = Math.round(v.propWithdraw * 100);
    if (v.strategy === 'fixed'     && v.nYears         != null) document.getElementById('nYears').value          = v.nYears;
    if (v.strategy === 'bracket'   && v.stratRate      != null) document.getElementById('stratRate').value       = Math.round(v.stratRate * 100);
    if (v.strategy === 'fixedpct'  && v.iraWithdrawPct != null) document.getElementById('iraWithdrawPct').value  = Math.round(v.iraWithdrawPct * 100);
    document.getElementById('maxConversion').checked = !!v.maxConversion;
    const cyclicEl = document.getElementById('cyclicEnabled');
    if (cyclicEl) { cyclicEl.checked = !!v.cyclicEnabled; onCyclicChange(); }
    const cyclicOrderEl = document.getElementById('cyclicOrder');
    if (cyclicOrderEl) cyclicOrderEl.value = v.cyclicOrder ?? 'ira-first';
    if (v.spendGoal != null) DisplayHelpers.setDollarValue('spendGoal', Math.round(v.spendGoal));
    toggleStrategyUI();
    runSimulation();
    showTab('tab-chart');
}

function syncTableCheckboxes() {
    document.querySelectorAll('.mc-var-check').forEach(cb => {
        cb.checked = _mcSelected.has(parseInt(cb.dataset.idx));
    });
}

// --- Chart ----------------------------------------------------------------

// One color hue per strategy family, semi-transparent fills for bands.
const FAMILY_COLORS = {
    'Proportional': { solid: '#1565C0', band75: 'rgba(21,101,192,0.18)', band95: 'rgba(21,101,192,0.08)' },
    'Reduce':       { solid: '#2E7D32', band75: 'rgba(46,125,50,0.18)',  band95: 'rgba(46,125,50,0.08)'  },
    'Fill Bracket': { solid: '#E65100', band75: 'rgba(230,81,0,0.18)',   band95: 'rgba(230,81,0,0.08)'   },
    'IRA Draw':     { solid: '#6A1B9A', band75: 'rgba(106,27,154,0.18)', band95: 'rgba(106,27,154,0.08)' },
};
// Fallback palette for unexpected family names
const FALLBACK_PALETTE = [
    { solid: '#00695C', band75: 'rgba(0,105,92,0.18)',   band95: 'rgba(0,105,92,0.08)'   },
    { solid: '#AD1457', band75: 'rgba(173,20,87,0.18)',  band95: 'rgba(173,20,87,0.08)'  },
];

function colorFor(familyName, fallbackIdx) {
    return FAMILY_COLORS[familyName]
        ?? FALLBACK_PALETTE[fallbackIdx % FALLBACK_PALETTE.length];
}

function renderMCChart(msg) {
    const canvas = document.getElementById('mc-chart');
    if (!canvas || !msg?.variations?.length) return;

    const years  = msg.years;
    const labels = Array.from({ length: years }, (_, i) => _mcStartYear + i);

    // Current-dollar deflation: divide each year's balance by cumulative inflation factor.
    // Uses median sampled inflation (bootstrap) or fixed user rate (GBM) as the deflator.
    const inCurrentDollars = document.getElementById('show-current-dollars')?.checked;
    const inflRate = msg.inflationStats?.cagr ?? msg.inflationRate ?? 0;
    const deflate = (arr) => {
        if (!inCurrentDollars || !arr) return arr;
        return arr.map((v, y) => v / Math.pow(1 + inflRate, y + 1));
    };

    const datasets = [];
    let fallbackIdx = 0;

    // Build 5 datasets per selected variation (p5 anchor, p95 fill, p25 anchor, p75 fill, p50 median).
    // Dataset order within each variation block:
    //   base+0: p5   (anchor, hidden line)
    //   base+1: p95  (fill: base+0  → outer band)
    //   base+2: p25  (anchor, hidden line)
    //   base+3: p75  (fill: base+2  → inner band)
    //   base+4: p50  (visible median line)

    Array.from(_mcSelected).forEach(idx => {
        const v    = msg.variations[idx];
        if (!v) return;
        const c    = colorFor(v.strategyFamily, fallbackIdx++);
        const base = datasets.length;

        datasets.push({
            label: `${v.label} p5`,
            data:  deflate(v.percentiles.p5),
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            fill: false,
            tension: 0.3,
        });
        datasets.push({
            label: `${v.label} p95`,
            data:  deflate(v.percentiles.p95),
            borderColor: 'transparent',
            backgroundColor: c.band95,
            pointRadius: 0,
            fill: base,   // fill down to the p5 dataset
            tension: 0.3,
        });
        datasets.push({
            label: `${v.label} p25`,
            data:  deflate(v.percentiles.p25),
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            fill: false,
            tension: 0.3,
        });
        datasets.push({
            label: `${v.label} p75`,
            data:  deflate(v.percentiles.p75),
            borderColor: 'transparent',
            backgroundColor: c.band75,
            pointRadius: 0,
            fill: base + 2,   // fill down to the p25 dataset
            tension: 0.3,
        });
        datasets.push({
            label: v.label + ` (${(v.survivalRate * 100).toFixed(0)}%)`,
            data:  deflate(v.percentiles.p50),
            borderColor: c.solid,
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 0,
            fill: false,
            tension: 0.3,
        });
    });

    if (_mcChart) {
        _mcChart.destroy();
        _mcChart = null;
    }

    _mcChart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    // Only show the p50 "median" entry per variation (every 5th dataset).
                    labels: {
                        filter: (item) => item.datasetIndex % 5 === 4,
                        font: { size: 12 },
                        usePointStyle: true,
                        pointStyle: 'line',
                        boxWidth: 24,
                    },
                },
                tooltip: {
                    filter: (item) => item.datasetIndex % 5 === 4,
                    callbacks: {
                        title: (items) => {
                            const year = items[0]?.label ?? '';
                            return `Year ${year}`;
                        },
                        label: (ctx) => {
                            const selArray = Array.from(_mcSelected);
                            const v = _mcResults?.variations[selArray[Math.floor(ctx.datasetIndex / 5)]];
                            const p = ctx.dataIndex;
                            const val = v?.percentiles?.p50?.[p];
                            // Build name without survival rate (shown in legend + table already).
                            const name = v
                                ? `${v.strategyFamily} ${v.paramLabel}${v.maxConversion ? ' ✓' : ''}`
                                : ctx.dataset.label;
                            return `  ${name}  $${fmt(val)}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    title: { display: true, text: 'Year' },
                    ticks: { maxTicksLimit: 10 },
                },
                y: {
                    title: { display: true, text: inCurrentDollars ? 'Portfolio Balance (Current $)' : 'Portfolio Balance' },
                    ticks: {
                        callback: (v) => '$' + (v >= 1e6
                            ? (v / 1e6).toFixed(1) + 'M'
                            : (v / 1e3).toFixed(0) + 'K'),
                    },
                },
            },
        },
    });

    document.getElementById('mc-chart-wrap').style.display = '';
}

// --- Progress / State helpers ---------------------------------------------

function setMCRunning(running) {
    const runBtn     = document.getElementById('mc-run-btn');      // inside nerd panel
    const cancelWrap = document.getElementById('mc-cancel-wrap');  // always-accessible cancel
    const progWrap   = document.getElementById('mc-progress-wrap');
    const runEst     = document.getElementById('mc-run-est');

    if (runBtn)     runBtn.disabled = running;
    // Use flex when showing so the cancel+path-count row lays out correctly.
    if (cancelWrap) cancelWrap.style.display = running ? 'flex' : 'none';
    if (progWrap)   progWrap.style.display   = running ? '' : 'none';
    if (!running) {
        updateMCProgress(0);
        if (runEst) runEst.textContent = '';
    } else if (runEst) {
        const numPaths = parseInt(document.getElementById('mc-num-paths')?.value ?? '500');
        const base     = getInputs();
        const numVar   = buildVariations(base).length;
        const estMs    = estimateMCMs(numPaths, numVar);
        if (estMs != null) {
            const sec = (estMs / 1000).toFixed(1);
            runEst.textContent = `May take approximately ${sec} seconds to complete`;
        } else {
            runEst.textContent = 'May take up to 20 seconds to complete';
        }
    }
}

function updateMCProgress(pct) {
    const bar  = document.getElementById('mc-progress-bar');
    const txt  = document.getElementById('mc-progress-txt');
    const pPct = Math.round(pct * 100);
    if (bar) { bar.style.width = pPct + '%'; }
    if (txt) { txt.textContent = pPct + '%'; }
}

// --- Input Distribution Fan Charts ----------------------------------------

function renderInputFanCharts(inputFan, years) {
    if (!inputFan) return;
    const labels = Array.from({ length: years }, (_, i) => `Yr ${i + 1}`);

    function buildDatasets(fan, solidColor, bandColor) {
        return [
            // [0] p10 anchor — transparent fill target; label shown in tooltip
            { label: 'p10', data: fan.p10, borderColor: 'transparent', backgroundColor: 'transparent',
              pointRadius: 0, fill: false, tension: 0.3 },
            // [1] p90 — fills down to p10 (shaded band); also shown in tooltip
            { label: 'p90', data: fan.p90, borderColor: 'transparent', backgroundColor: bandColor,
              pointRadius: 0, fill: '-1', tension: 0.3 },
            // [2] Median — solid line, always visible
            { label: 'Median', data: fan.p50, borderColor: solidColor,
              backgroundColor: 'transparent', borderWidth: 2,
              pointRadius: 0, fill: false, tension: 0.3 },
            // [3] Min — hidden by default; click legend to enable
            { label: 'Min', data: fan.min, borderColor: solidColor, borderDash: [4, 4],
              borderWidth: 1, backgroundColor: 'transparent',
              pointRadius: 0, fill: false, tension: 0.3, hidden: true },
            // [4] Max — hidden by default; click legend to enable
            { label: 'Max', data: fan.max, borderColor: solidColor, borderDash: [4, 4],
              borderWidth: 1, backgroundColor: 'transparent',
              pointRadius: 0, fill: false, tension: 0.3, hidden: true },
        ];
    }

    const yPctAxis = {
        ticks: { callback: v => (v * 100).toFixed(0) + '%' },
        grid:  { color: 'rgba(0,0,0,0.06)' },
    };
    const xAxis = { ticks: { maxTicksLimit: 10 } };

    // Legend: skip p10 anchor (idx 0) — the band already represents p10–p90 range visually.
    const legendCfg = {
        filter: item => item.datasetIndex !== 0,
        font: { size: 11 },
        usePointStyle: true,
        pointStyle: 'line',
    };

    // Tooltip: show all 5 values (including hidden Min/Max) formatted as percentages.
    // Dark background and solid label colors come from Chart.defaults (set globally in HTML).
    const tooltipCfg = {
        filter: () => true,  // include hidden datasets (Min/Max)
        callbacks: {
            title: items => `Year ${(items[0]?.dataIndex ?? 0) + 1}`,
            label: ctx => {
                const v = ctx.parsed.y;
                const sign = v >= 0 ? '+' : '';
                return `  ${ctx.dataset.label}: ${sign}${(v * 100).toFixed(1)}%`;
            },
        },
    };

    function chartOpts(title) {
        return {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: legendCfg },
                tooltip: tooltipCfg,
                title: { display: true, text: title, font: { size: 12 } },
            },
            scales: { x: xAxis, y: yPctAxis },
        };
    }

    // Equity chart (both GBM and bootstrap)
    if (_inputEquityChart) _inputEquityChart.destroy();
    const eqCtx = document.getElementById('mc-input-equity-chart')?.getContext('2d');
    if (eqCtx) {
        _inputEquityChart = new Chart(eqCtx, {
            type: 'line',
            data: { labels, datasets: buildDatasets(inputFan.equity, '#1565C0', 'rgba(21,101,192,0.15)') },
            options: chartOpts('Equity Return Distribution (per year)'),
        });
    }

    // Inflation chart (bootstrap only — null in GBM)
    const inflWrap = document.getElementById('mc-input-inflation-wrap');
    if (inflWrap) inflWrap.style.display = inputFan.inflation ? '' : 'none';
    if (_inputInflationChart) { _inputInflationChart.destroy(); _inputInflationChart = null; }
    if (inputFan.inflation) {
        const infCtx = document.getElementById('mc-input-inflation-chart')?.getContext('2d');
        if (infCtx) {
            _inputInflationChart = new Chart(infCtx, {
                type: 'line',
                data: { labels, datasets: buildDatasets(inputFan.inflation, '#E65100', 'rgba(230,81,0,0.15)') },
                options: chartOpts('Inflation Distribution (per year)'),
            });
        }
    }
}

// --- Utility --------------------------------------------------------------

function fmt(n) {
    if (!n && n !== 0) return '—';
    return Math.round(n).toLocaleString();
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

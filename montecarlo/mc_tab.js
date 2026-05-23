// Monte Carlo tab — UI controller.
// Depends on: retirement_optimizer_core.js (getInputs, buildVariations),
//             montecarlo/mc_controller.js (runMCWorker, cancelMCWorker),
//             Chart.js (global Chart)

let _mcChart      = null;
let _mcResults    = null;
let _mcSelected   = new Set(); // indices of variations currently on chart
let _mcStartYear  = 2026;      // cached from getInputs() at run time

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
}

// Returns true when NERD_KNOBS is active.
function _mcNerdMode() {
    return typeof NERD_KNOBS !== 'undefined' && NERD_KNOBS;
}

// Called by the Monte Carlo tab button.
// In normal mode, runs immediately with default params (panel stays hidden).
function mcTabActivated() {
    if (!_mcNerdMode()) {
        runMonteCarlo();
    }
}

// --- Run ------------------------------------------------------------------

function runMonteCarlo() {
    const base = getInputs();

    const numPaths = parseInt(document.getElementById('mc-num-paths')?.value  ?? '500');
    const mu       = parseFloat(document.getElementById('mc-mu')?.value       ?? '7')  / 100;
    const sigma    = parseFloat(document.getElementById('mc-sigma')?.value    ?? '12') / 100;
    const seed     = parseInt(document.getElementById('mc-seed')?.value       ?? '42');

    _mcStartYear = base.startYear ?? 2026;
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
        { variations, numPaths, mu, sigma, seed, years, inflationRate: base.inflation },
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

function renderMCResults(msg) {
    document.getElementById('mc-error').style.display = 'none';
    renderMCMetrics(msg);
    renderSurvivalTable(msg.variations, msg.numPaths);

    // Default chart: best-surviving variation per strategy family
    _mcSelected.clear();
    const byFamily = {};
    msg.variations.forEach((v, i) => {
        const f = v.strategyFamily;
        if (!byFamily[f] || v.survivalRate > msg.variations[byFamily[f]].survivalRate) {
            byFamily[f] = i;
        }
    });
    Object.values(byFamily).forEach(i => _mcSelected.add(i));

    renderMCChart(msg);
    syncTableCheckboxes();
}

// --- Metrics bar ----------------------------------------------------------

function renderMCMetrics(msg) {
    const el = document.getElementById('mc-metrics');
    if (!el) return;

    const ms   = msg.totalMs            != null ? msg.totalMs                                     : null;
    const grow = msg.medianAnnualReturn != null ? (msg.medianAnnualReturn * 100).toFixed(1)      : null;
    const lo   = msg.minAnnualReturn    != null ? (msg.minAnnualReturn    * 100).toFixed(1)      : null;
    const hi   = msg.maxAnnualReturn    != null ? (msg.maxAnnualReturn    * 100).toFixed(1)      : null;
    const inf  = msg.inflationRate      != null ? (msg.inflationRate      * 100).toFixed(1)      : null;

    const parts = [];
    if (ms != null) {
        const sec = (ms / 1000).toFixed(ms < 10000 ? 1 : 0);
        parts.push(`Completed in <strong>${sec} s</strong>`);
    }
    if (grow != null) parts.push(`Median growth <strong>${grow}%/yr</strong> <span style="color:#888;font-size:0.85em;">(geometric)</span>`);
    if (lo != null && hi != null) parts.push(
        `Annual return range <strong style="color:${parseFloat(lo)<0?'#c0392b':'inherit'}">${lo}%</strong>`
        + ` to <strong>${hi}%</strong>`
        + ` <span style="color:#888;font-size:0.85em;">(worst/best simulated year)</span>`
    );
    if (inf  != null) parts.push(`Inflation <strong>${inf}%/yr</strong> <span style="color:#888;font-size:0.85em;">(fixed)</span>`);

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
        tr.style.background = color;
        tr.dataset.varIdx = v._origIdx;

        const spendTxt = v.spendGoal != null ? '$' + fmt(v.spendGoal) : '—';
        tr.innerHTML = `
            <td style="padding:3px 6px;text-align:center;">
                <input type="checkbox" class="mc-var-check" data-idx="${v._origIdx}">
            </td>
            <td style="padding:3px 6px;">${escapeHtml(v.strategyFamily)}</td>
            <td style="padding:3px 6px;">${escapeHtml(v.paramLabel)}</td>
            <td style="padding:3px 6px;text-align:center;">${v.maxConversion ? '✓' : '—'}</td>
            <td style="padding:3px 6px;text-align:right;">${spendTxt}</td>
            <td style="padding:3px 6px;text-align:right;font-weight:bold;">${pct}%</td>
            <td style="padding:3px 6px;text-align:right;">${ruinTxt}</td>
            <td style="padding:3px 6px;text-align:right;">$${fmt(v.percentiles.p50[v.percentiles.p50.length - 1])}</td>
        `;

        tr.querySelector('.mc-var-check').addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            if (e.target.checked) {
                _mcSelected.add(idx);
            } else {
                _mcSelected.delete(idx);
            }
            renderMCChart(_mcResults);
        });

        tbody.appendChild(tr);
    });

    document.getElementById('mc-table-wrap').style.display = '';
    document.getElementById('mc-path-count').textContent =
        `${numPaths.toLocaleString()} paths`;
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
            data:  v.percentiles.p5,
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            fill: false,
            tension: 0.3,
        });
        datasets.push({
            label: `${v.label} p95`,
            data:  v.percentiles.p95,
            borderColor: 'transparent',
            backgroundColor: c.band95,
            pointRadius: 0,
            fill: base,   // fill down to the p5 dataset
            tension: 0.3,
        });
        datasets.push({
            label: `${v.label} p25`,
            data:  v.percentiles.p25,
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            fill: false,
            tension: 0.3,
        });
        datasets.push({
            label: `${v.label} p75`,
            data:  v.percentiles.p75,
            borderColor: 'transparent',
            backgroundColor: c.band75,
            pointRadius: 0,
            fill: base + 2,   // fill down to the p25 dataset
            tension: 0.3,
        });
        datasets.push({
            label: v.label + ` (${(v.survivalRate * 100).toFixed(0)}%)`,
            data:  v.percentiles.p50,
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
                    // Solid dark background — no white box, no colored border.
                    backgroundColor: 'rgba(22, 22, 22, 0.92)',
                    titleColor: '#ffffff',
                    bodyColor: '#dddddd',
                    borderWidth: 0,
                    padding: 10,
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
                        // Solid filled square instead of outlined-on-white box.
                        labelColor: (ctx) => {
                            const color = ctx.dataset.borderColor;
                            return { backgroundColor: color, borderColor: color, borderWidth: 0 };
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
                    title: { display: true, text: 'Portfolio Balance' },
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

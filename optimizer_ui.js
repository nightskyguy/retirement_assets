// ============================================================================
// optimizer_ui.js - all DOM, chart, share-URL, and scenario code for
// retirement_optimizer.html. Requires optimizer_core.js (simulation engine)
// and taxengine.js to be loaded first; everything shares global scope.
// getInputs() is the single DOM-to-params bridge into the engine.
// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

// Version constant - increment this when data structure changes
const SCENARIO_VERSION = 4;

// New storage key for current version scenarios
const STORAGE_KEY = 'SLCRetireOptimizeScenario';

// Old storage key from previous version
const OLD_STORAGE_KEY = 'retirementScenarios';

// Feature flags
// NERD_KNOBS: shows advanced controls (Monte Carlo params, GK guardrails, the 💵 cash-funded
// sweep dimension, etc.). The optimizer objective selector graduated out of this in PF13 and the
// ACA Cliff options in v11.1464 - do not add either back to this list.
// Enabled via ?nerdknob URL param, OR flipped at runtime by the hidden Documentation-page checkbox
// (see setNerdKnob / applyNerdKnobVisibility). Therefore a `let`, not a `const` - it can change
// after load. The runtime flip is NOT persisted to the URL.
let NERD_KNOBS = new URLSearchParams(location.search).has('nerdknob');

// MONTE_DEMO: the ?montecarlo teaching demo. Lands the reader on the Monte Carlo tab in Synthetic
// mode with Seed/Paths/Input Distributions exposed and auto-runs the Experiment (see
// runMCExperiment in mc_tab.js). Deliberately NARROW: unlike NERD_KNOBS it does NOT unlock the
// other advanced surfaces (Avg BETR stat, GK params, sweep dimensions). It only widens the MC-tab
// panels and lowers the paths floor. Read once at load; not flipped at runtime, not in the URL twice.
const MONTE_DEMO = new URLSearchParams(location.search).has('montecarlo');

// Optimizer UI state - replaces window.optimizer* globals.
const OptimizerState = {
    results: null,
    baseline: null,
    // colKey '__objective__' (default) orders the body by the active "Optimize for" objective;
    // clicking a column header switches to that column (user override) until the objective changes.
    sortState: { colKey: '__objective__', direction: 'desc' },
    showInfeasible: false,
    showFailed: false,
    objective: 'taxflex',       // PF13: default ranking = Tax Flexibility (most-requested)
    sharedFutureIRARate: 0,     // PF13: heirs rate for widowrmd/taxflex metrics; set each runOptimizer
    perfStats: null,
    noSolutionFloor: null,
    convOptCandidateCount: 0,   // PF11: size of the conversion candidate pool this run
    convOptRowsAdded: 0,        // PF11: how many ⇌ rows actually improved (drives the empty-state banner)
    // ⚖ head-to-head: the row every Δ column is measured against, when it is not the ⚓ baseline.
    // The row OBJECT is per-sweep; compareSelection is the durable identity that survives a re-run
    // (see resolveCompareRow - _id is a build-order index and does not).
    compareRow: null,
    compareSelection: null,
    compareIsCurrentPlan: false,
};

// Optimizer "Optimize for" objectives (PF13) - labels + <select> display order live here; the
// ranking logic (metrics, the Tax Flexibility two-stage ranker) lives in optimizer_core.js
// (OPTIMIZER_OBJECTIVES / rankRowsByObjective) so it is pure and unit-testable. Keys must match.
// This drives BOTH the visible table order (when sortState is the '__objective__' sentinel) and
// the ⚓ baseline pick + Rank column. Visible to all users; default = Tax Flexibility.
const OPT_OBJECTIVE_ORDER = ['taxflex', 'networth', 'widowrmd', 'mintax', 'maxspend', 'maxroth', 'balanced', 'conveffect', 'earliestbe'];
const OPT_OBJECTIVE_LABELS = {
    taxflex:   'Tax Flexibility',
    networth:  'Maximum Net Wealth',
    widowrmd:  'Avoiding Widow & RMD Tax',
    mintax:    'Minimum Lifetime Taxes',
    maxspend:  'Maximum Spending',
    maxroth:   'Maximum Roth',
    balanced:  'Balanced (Wealth + Spend)',
    conveffect:'Roth Conversion Effectiveness',
    earliestbe:'Earliest Break Even',
};
// Thin UI wrapper over the core ranker: supplies the shared heirs rate the widowrmd/taxflex metrics
// need. Core enforces "failed rows always last".
function rankRows(rows, objKey) {
    return rankRowsByObjective(rows, objKey, OptimizerState.sharedFutureIRARate ?? 0);
}

// Flip the nerdknob at runtime and re-apply every gated UI surface. Called by the hidden
// Documentation-page checkbox. Not persisted to the URL.
function setNerdKnob(on) {
    NERD_KNOBS = !!on;
    applyNerdKnobVisibility();
}

// Re-runs all NERD_KNOBS-gated UI so toggling at runtime matches a fresh ?nerdknob load.
function applyNerdKnobVisibility() {
    // Optimizer objective selector - PF13: now drives the whole table ranking, so visible to ALL
    // users regardless of nerdknob (kept here only so a runtime toggle doesn't hide it).
    const objWrap = document.getElementById('opt-objective-wrap');
    if (objWrap) objWrap.style.display = 'flex';
    // Cycle Brokerage LTCG bracket target (0%/15%)
    const cycleLTCGWrap = document.getElementById('cycleLTCGTarget-wrap');
    if (cycleLTCGWrap) cycleLTCGWrap.style.display = NERD_KNOBS ? '' : 'none';
    // Maximize Conversions sub-flags (Convert Excess to Roth / Use Cash) - always visible: they are
    // two financially distinct decisions, not experimental knobs (kept here so a runtime nerd
    // toggle can't hide them).
    const convAdvWrap = document.getElementById('convAdvanced-wrap');
    if (convAdvWrap) convAdvWrap.style.display = '';
    // Tax-rate creep (Assumptions) and Stop-conversions-after (sidebar) are NOT handled here any
    // more: both graduated out of nerdknob once they were finished and tested, so their markup
    // carries no display:none and nothing hides them. Same treatment as convAdvanced-wrap above.
    // IRMAA safety margin below a projected tier threshold - experimental, still being measured
    // (.test_harnesses/IRMAA_MARGIN_RESULTS.md). The FORWARD PROJECTION it sits on is NOT gated:
    // that is a correctness fix and applies to every user. Only the choice of margin is hidden,
    // and hiding it leaves the default (IRMAA_MARGIN_DEFAULT, 'halfcpi') in force, not "no margin".
    const irmaaMarginWrap = document.getElementById('irmaaMarginMode-wrap');
    if (irmaaMarginWrap) irmaaMarginWrap.style.display = NERD_KNOBS ? '' : 'none';
    // 💵 legend - only meaningful once nerdknob is sweeping the cash-funded arm
    const cashFundLegend = document.getElementById('opt-legend-cashfund');
    if (cashFundLegend) cashFundLegend.style.display = NERD_KNOBS ? '' : 'none';
    // The ACA Cliff documentation paragraph used to be hidden here. It is now always visible, like
    // every other strategy's paragraph, so there is nothing to toggle - the inline display:none was
    // dropped from the markup rather than being switched off from JS, which keeps it visible even
    // if this function never runs.
    // Monte Carlo nerd panels (initMCTab reads _mcNerdMode() → NERD_KNOBS)
    if (typeof initMCTab === 'function') initMCTab();
    // Strategy panel (GK params gated) + bracket dropdown (ACA options gated, item 12)
    if (typeof toggleStrategyUI === 'function') toggleStrategyUI();
    if (typeof refreshStratRateOptions === 'function') refreshStratRateOptions();
    // Re-render optimizer table if a run exists (adds/removes Score, Rank, objective re-rank)
    if (OptimizerState.results && typeof renderOptimizerTable === 'function') {
        renderOptimizerTable(OptimizerState.results);
    }
    // Keep the hidden checkbox in sync (e.g. when ?nerdknob set it true at load)
    const cb = document.getElementById('secret-nerdknob');
    if (cb) cb.checked = NERD_KNOBS;
}

// Optimizer objective setter - wired to the nerdknob <select id="opt-objective">.
function setOptObjective(key) {
    OptimizerState.objective = OPT_OBJECTIVE_LABELS[key] ? key : 'taxflex';
    // Changing the objective re-follows it for the body order (drop any user column override).
    OptimizerState.sortState = { colKey: '__objective__', direction: 'desc' };
    if (OptimizerState.results) {
        recomputeBaselineForObjective();
        renderOptimizerTable(OptimizerState.results);
    }
}

// Picks the ⚓ baseline (best no-conversion / no-cyclic successful row) under the active objective,
// then recomputes every row's Δ columns against it. Called by runOptimizer and whenever the
// objective changes. Prefers a FEASIBLE row: an infeasible (⚠️) baseline would be pinned on top of
// the table and listed in the "Best" summary as a strategy you cannot actually run. Falls back to
// the unfiltered set only when every no-conversion row is infeasible, so the Δ columns still work.
function recomputeBaselineForObjective() {
    const results = OptimizerState.results;
    if (!results) return;
    const noConvSuccesses = results.filter(r => r._isNoConv && r.totals.success);
    const feasibleNoConv = noConvSuccesses.filter(r => !(r._isBracketInfeasible || r._isACAUntenable));
    const baselinePool = feasibleNoConv.length > 0 ? feasibleNoConv : noConvSuccesses;
    OptimizerState.baseline = baselinePool.length > 0
        ? rankRows(baselinePool, OptimizerState.objective)[0]
        : null;
    resolveCompareRow();
    recomputeDeltasAgainst(deltaReferenceRow());
}

// The row every Δ column is measured against: the compare pin when one is set, otherwise the
// ⚓ baseline. Splitting this out is what turns the existing Δ columns into a head-to-head diff --
// pin row A and every other row's Δ answers "how does this compare with A".
function deltaReferenceRow() {
    return OptimizerState.compareRow ?? OptimizerState.baseline ?? null;
}

function recomputeDeltasAgainst(referenceRow) {
    const results = OptimizerState.results;
    if (!results) return;
    for (const r of results) {
        r._dNW  = referenceRow ? (r.afterTaxNW   - referenceRow.afterTaxNW)   : null;
        r._dTax = referenceRow ? (referenceRow.totals.tax - r.totals.tax)     : null;
        r._dNWCurrent  = referenceRow ? (r.afterTaxNWCurrentDollars - referenceRow.afterTaxNWCurrentDollars) : null;
        r._dTaxCurrent = referenceRow ? (referenceRow.totals.taxCurrentDollars - r.totals.taxCurrentDollars) : null;
    }
}

// Re-finds the pinned comparison row after a sweep. `_id` is just `results.length` at build time,
// so it does not survive a re-run; the pin is stored as the row's `_selection` and matched with
// sameStrategySelection, the same identity the 📍 CURRENT PLAN row uses. A pin whose strategy is no
// longer in the table (the user changed a parameter out from under it) is dropped rather than left
// pointing at a stale object.
function resolveCompareRow() {
    const results = OptimizerState.results;
    const sel = OptimizerState.compareSelection;
    if (!results || !sel) { OptimizerState.compareRow = null; return; }
    OptimizerState.compareRow = results.find(r =>
        r._selection && sameStrategySelection(r._selection, sel)
        && !!r._isCurrentPlan === !!OptimizerState.compareIsCurrentPlan
    ) ?? results.find(r => r._selection && sameStrategySelection(r._selection, sel)) ?? null;
    if (!OptimizerState.compareRow) OptimizerState.compareSelection = null;
}

// Click handler for the ⚖ compare zone. Clicking whichever row is ALREADY the reference clears the
// comparison, which is the same thing the "Stop comparing" button does. That includes the ⚓
// baseline: it is the default reference, so clicking its ⚖ can only mean "put things back", never
// "pin the thing that is already pinned".
function toggleCompareRow(id) {
    const results = OptimizerState.results;
    const row = results?.find(r => r._id === id);
    if (!row) return;
    if (deltaReferenceRow() === row) {
        OptimizerState.compareSelection = null;
        OptimizerState.compareIsCurrentPlan = false;
        OptimizerState.compareRow = null;
    } else {
        OptimizerState.compareSelection = row._selection ?? null;
        OptimizerState.compareIsCurrentPlan = !!row._isCurrentPlan;
        OptimizerState.compareRow = row;
    }
    recomputeDeltasAgainst(deltaReferenceRow());
    renderOptimizerTable();
}

// Column-header and tooltip wording for whatever the Δ columns currently measure against.
function deltaRefSuffix() {
    return OptimizerState.compareRow ? ' vs ⚖' : '';
}

function deltaRefDescription() {
    const row = OptimizerState.compareRow;
    return row
        ? `the ⚖ comparison row (${row._strategyLabel}${row._paramLabel ? ' - ' + row._paramLabel : ''})`
        : 'the ⚓ baseline (the strongest plan with no Roth conversions and no cyclic brokerage maneuvering)';
}

// The ⚖ glyph. Highlighted on whichever row the Δ columns are CURRENTLY measured against, which is
// the ⚓ baseline until something else is picked -- so the table opens already showing where the
// comparison point is, rather than looking like the feature is switched off.
function compareToggleHtml(r) {
    const isRef = deltaReferenceRow() === r;
    return `<span style="${isRef ? 'font-size:1.2em;' : 'opacity:0.55;'}">⚖</span>`;
}

// Click routing for a table cell. The leading ⚖ / outcome / spacer cells select the comparison row;
// everything else loads the strategy. Keeping them in separate CELLS rather than nesting a small
// glyph inside the Strategy cell is what makes the two targets hard to hit by accident.
function cellActionCss(col) {
    if (col.inert) return 'cursor:default;';
    return 'cursor:pointer;';
}

// The two figures that used to occupy columns of their own. Spend Goal repeated your own input on
// every row except the ✦ optimized ones, so a whole column bought one number on a handful of rows.
// Yrs Funded is already said by the 🟢/🚨 in the status column, which means "every year funded" -
// only the n/N detail was lost, and this is where it went. Appended to EVERY cell's tooltip in the
// row, so it does not matter which cell the reader happens to be over.
// No double quotes in here: the callers interpolate straight into title="..." without escaping.
function rowDetailTip(r) {
    const goal = Math.round(r._spendGoal ?? 0).toLocaleString();
    return `\nSpend goal: $${goal}/yr in today’s dollars.`
         + `\nYears funded: ${r.totals.yearsfunded} of ${r.totals.yearstested}.`;
}

function cellActionAttrs(col, r, loadTitle) {
    if (col.inert) return '';
    if (col.compareZone) {
        const isRef = deltaReferenceRow() === r;
        const tip = (isRef
            ? 'Every Δ column is currently measured against this row. Click to go back to the ⚓ baseline.'
            : 'Compare against this row: the ΔNetWealth and ΔTax columns are re-measured from it instead of the ⚓ baseline.')
            + rowDetailTip(r);
        return ` onclick="toggleCompareRow(${r._id})" title="${tip}"`;
    }
    return ` onclick="loadOptimizerResult(${r._id})" title="${loadTitle + rowDetailTip(r)}"`;
}

// One line above the table that is always saying something: how to start a comparison when none is
// running, and what the Δ columns now mean when one is. Without the second half a pinned comparison
// row silently changes the meaning of every Δ number; without the first half nobody finds ⚖ at all.
function renderCompareBanner() {
    const el = document.getElementById('opt-compare-banner');
    const hint = document.getElementById('opt-compare-hint');
    if (!el) return;
    const row = OptimizerState.compareRow;
    if (!row) {
        el.style.display = 'none';
        el.innerHTML = '';
        if (hint) hint.style.display = '';
        return;
    }
    if (hint) hint.style.display = 'none';
    const label = `${row._strategyLabel}${row._paramLabel ? ' - ' + row._paramLabel : ''}`;
    el.innerHTML = `⚖ <strong>Comparing every row against:</strong> ${label}.`
        + ` The ΔNetWealth and ΔTax columns now show the difference from this row instead of the ⚓ baseline,`
        + ` and this row itself reads 0.`
        + ` <button onclick="clearCompareRow()" style="margin-left:8px;padding:3px 12px;font-size:0.95em;cursor:pointer;font-weight:600;">✕ Stop comparing</button>`;
    el.style.display = '';
}

function clearCompareRow() {
    OptimizerState.compareSelection = null;
    OptimizerState.compareIsCurrentPlan = false;
    OptimizerState.compareRow = null;
    recomputeDeltasAgainst(deltaReferenceRow());
    renderOptimizerTable();
}



/** UI CONTROLS **/
// ── P64e. Property / local taxes: URL entry only, deliberately no control on the page ──────────
// Measured 2026-08-19 (findings.md, P64): threading property tax into the SALT test is worth at most
// about $4,000 of lifetime federal tax for ANY household, it saturates at the cap, it shrinks every
// year because the standard deduction is indexed faster than the cap, it is exactly zero from 2030,
// and it changed no strategy recommendation in any case measured. That does not earn a field, a
// growth-mode selector and their help text on a page that already has a lot of both. It does earn a
// way in, so the engine parameter is reachable and testable rather than dead code:
//
//   ?ptx=25000          annual property + other local taxes, today's dollars
//   ?ptxm=inflation     how it grows: inflation (default) | flat | custom
//   ?ptxr=2             growth rate in PERCENT, read only when ptxm=custom (e.g. a Prop 13 2% cap)
//
// Read once at load, then MUTABLE state from there - not a frozen URL-only snapshot. It has to be
// mutable because it is also a scenario field: getInputs() includes it, so saveScenario() writes it
// into the localStorage JSON blob, but applyScenario() restores every OTHER field via
// `document.getElementById(key)`, and this one has no DOM element to find. Without a mutable slot
// for applyScenario to write into, a saved scenario's property tax is captured on save and silently
// dropped on every future load - saved but unrecoverable, which is worse than never having the
// field. buildShareURL() reads this same object, so re-sharing after a scenario load carries it too.
let PROP_TAX_STATE = (() => {
    const q = new URLSearchParams(location.search);
    const amt = Number(q.get('ptx'));
    if (!Number.isFinite(amt) || amt <= 0) return null;
    const rawMode = (q.get('ptxm') || 'inflation').toLowerCase();
    const mode = ['inflation', 'flat', 'custom'].includes(rawMode) ? rawMode : 'inflation';
    const rate = Number(q.get('ptxr'));
    return {
        propTax: amt,
        propTaxGrowthMode: mode,
        // Percent in the URL, fraction in the engine, matching every other rate the UI passes.
        propTaxGrowthRate: Number.isFinite(rate) ? rate / 100 : 0,
    };
})();

function getInputs() {
    // UI GAP: when spendChange (or BrokerageBasis) is out-of-range and corrected to 0 below,
    // the form field still shows the user's invalid value. Fix: call
    // DisplayHelpers.setValue('spendChange', '0') after correction so UI matches simulation.
    let spendChange = +val('spendChange')
    if (spendChange < -25 || spendChange > 25) {
        showMessage('Spend Delta: ' + spendChange + '% is unreasonable. Using 0% instead.', 'warning')
        spendChange = 0
    }
    let Brokerage = +val('Brokerage');
    let BrokerageBasis = +val('BrokerageBasis');
    // P35f: `if (Brokerage <= 0.01) basis = 0;` used to sit here. It assigned an undeclared global
    // named `basis`, never BrokerageBasis, so it had no effect from the day it was written. Removed
    // rather than repaired: the clamp below already covers a zero balance (basis > 0 === Brokerage,
    // so it is clamped to 0) and it tells the user, which the silent version did not.
    if (BrokerageBasis > Brokerage) {
        showMessage('BrokerageBasis (' + BrokerageBasis + ') was greater than the Brokerage balance. BrokerageBasis in input is being ignored. Using ' + Brokerage + ' instead.', 'warning');
        BrokerageBasis = Brokerage;
    }
    const _strat = (() => {
        const raw = val('stratRate') ?? '';
        if (/^irmaa/i.test(raw)) {
            return { stratRate: 0, stratIRMAATier: +raw.replace(/irmaa/i, ''), stratACAMultiple: 0 };
        }
        if (raw.startsWith('aca')) {
            return { stratRate: 0, stratIRMAATier: -1, stratACAMultiple: +raw.replace('aca', '') };
        }
        return { stratRate: +raw / 100.0, stratIRMAATier: -1, stratACAMultiple: 0 };
    })();
    // ACA is a STRICT-cap strategy internally. The UI keeps ACA as a "Fill Bracket" sub-option
    // (stratRate=aca<N>), so derive strategy='aca' whenever an ACA multiple is selected. This
    // also makes legacy scenarios/URLs (strategy=bracket + aca<N>) load with strict semantics.
    let _strategy = val('strategy');
    if (_strat.stratACAMultiple > 0 && (_strategy === 'bracket' || _strategy === 'minlimit')) {
        _strategy = 'aca';
    }
    return {
        STATEname: val('STATEname'),
        strategy: _strategy,
        orderedSeq: val('orderedSeq') || 'CBIR',
        nYears: +val('nYears'),
        ..._strat,
        hasSpouse: !!valChecked('hasSpouse'),
        birthyear1: +val('birthyear1'),
        birthmonth1: +val('birthmonth1') || 12,
        die1: +val('die1'),
        birthyear2: +val('birthyear2'),
        birthmonth2: +val('birthmonth2') || 12,
        die2: +val('die2'),
        IRA1: +val('IRA1'),
        IRA2: +val('IRA2'),
        Roth: +val('Roth'),
        Roth2: +val('Roth2') || 0,
        // Cash Reserve, three-way (P2): "Off" (recommended), blank, or negative -> undefined = OFF
        // (legacy: all surplus to Cash, no floor). 0 -> zero buffer, reinvest ALL surplus to
        // Brokerage. positive -> target cash buffer (today's $): keep it in Cash, reinvest the
        // overflow, protect it on withdrawal. Blank/negative are still accepted silently for
        // old saved scenarios and shared links, but "Off" is the only value shown to users now.
        CashReserve: (() => {
            const raw = (val('CashReserve') ?? '').toString().trim();
            if (raw === '' || raw.toLowerCase() === 'off') return undefined;
            const n = DisplayHelpers.parseShorthand(raw);
            const v = (n == null || Number.isNaN(n)) ? +raw : n;
            return (!Number.isFinite(v) || v < 0) ? undefined : v;
        })(),
        Brokerage: Brokerage,
        BrokerageBasis: BrokerageBasis,
        Cash: +val('Cash'),
        ss1: +val('ss1'),
        ss1Age: +val('ss1Age'),
        ss2: +val('ss2'),
        ss2Age: +val('ss2Age'),
        pensionAnnual: +val('pensionAnnual'),
        pensionStartAge: +val('pensionStartAge') || 0,
        survivorPct: +val('survivorPct'),
        pensionCola: !!valChecked('pensionCola'),
        spendGoal: +val('spendGoal'),
        spendChange: (spendChange / 100.0),
        iraBaseGoal: +val('iraBaseGoal'),
        inflation: +val('inflation') / 100.0,
        cpi: +val('cpi') / 100.0,
        growth: +val('growth') / 100.0,
        cashYield: +val('cashYield') / 100.0,
        dividendRate: +val('dividendRate') / 100.0,
        ssFailYear: +val('ssFailYear'),
        ssFailPct: +val('ssFailPct') / 100.0,
        // Tax-rate creep (nerdknob). Federal is the only knob today; the state multiplier is
        // plumbed all the way through the engine but pinned at 0 until it gets its own control.
        taxRateCreep: +val('taxRateCreep') / 100.0 || 0,
        taxCreepStartYear: +val('taxCreepStartYear') || 0,   // 0 = start with the plan's first year
        taxRateCreepState: 0,
        convertExcessToRoth: valChecked('convertExcessToRoth'),
        fundConversionWithCash: valChecked('fundConversionWithCash'),
        extraConversionAmount: +val('extraConversionAmount') || 0,
        // Conversion END: the LAST year conversions run; blank = never stop (today's behavior).
        // One field accepts a calendar year (4+ digits, e.g. 2031) or an age of person 1 (fewer
        // than 4 digits, e.g. 71 -> birthyear1 + 71). Engine reads it as a calendar year.
        convEndYear: (() => {
            const raw = (val('convEndYear') ?? '').toString().trim();
            if (!raw) return undefined;
            const n = parseInt(raw, 10);
            if (!Number.isFinite(n) || n <= 0) return undefined;
            const digits = raw.replace(/[^0-9]/g, '').length;
            return digits < 4 ? (+val('birthyear1') + n) : n;
        })(),
        convEndMode: val('convEndMode') === 'extra' ? 'extra' : 'all',
        ...(PROP_TAX_STATE || {}),
        propWithdraw: +val('propWithdraw') / 100.0,
        iraWithdrawPct: +val('iraWithdrawPct') / 100.0,
        startAge: +val('startAge') || (new Date().getFullYear() - +val('birthyear1')),
        startInYear: (() => {
            const sa = +val('startAge');
            const by1 = +val('birthyear1');
            // startAge is the user's real-world age: the year they ARE that age = birthyear + startAge.
            // Clamp to the current calendar year - can't start a simulation in the past.
            const computed = sa > 0 ? by1 + sa : new Date().getFullYear();
            return Math.max(computed, new Date().getFullYear());
        })(),
        dividendReinvest: !!valChecked('dividendReinvest'),
        cyclicEnabled: !!valChecked('cyclicEnabled'),
        cyclicOrder:   val('cyclicOrder') ?? 'ira-first',
        cycleLTCGTarget: +(val('cycleLTCGTarget') ?? 0.15),
        irmaaMarginMode: val('irmaaMarginMode') || IRMAA_MARGIN_DEFAULT,
        // Account Composition (equity/bond ratio selects + intl equity % inputs)
        comp_IRA1_ratio: +val('comp_IRA1_ratio'),
        comp_IRA1_intl: +val('comp_IRA1_intl'),
        comp_IRA2_ratio: +val('comp_IRA2_ratio'),
        comp_IRA2_intl: +val('comp_IRA2_intl'),
        comp_Brokerage_ratio: +val('comp_Brokerage_ratio'),
        comp_Brokerage_intl: +val('comp_Brokerage_intl'),
        comp_Roth1_ratio: +val('comp_Roth1_ratio'),
        comp_Roth1_intl: +val('comp_Roth1_intl'),
        comp_Roth2_ratio: +val('comp_Roth2_ratio'),
        comp_Roth2_intl: +val('comp_Roth2_intl'),
        futureIRATaxRate: (() => { const v = val('futureIRATaxRate'); return (v && +v > 0) ? +v / 100.0 : undefined; })(),
        qcdHHMax: +val('qcdHHMax') || 0,
        qcdMode: valChecked('qcdAlways') ? 'always' : 'asneeded',
        gkGuard:  +val('gkGuard')  / 100 || 0.20,
        gkAdjPct: +val('gkAdjPct') / 100 || 0.10,
    };
}

/*
 *
 *
 */
function updateProfileAgeDisplay() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const growthRate = (+val('growth') / 100) || 0.06;

    function ageInfo(birthYear, birthMonth, iraBalance) {
        if (!birthYear) return null;
        const age = currentYear - birthYear - (currentMonth <= birthMonth ? 1 : 0);
        const rmdAge = birthYear >= 1960 ? 75 : 73;
        let rmdStr = `RMD starts ${rmdAge}`;
        if (iraBalance > 0) {
            const yearsTo = rmdAge - age;
            let firstRMD;
            if (yearsTo <= 0) {
                const factor = RMD_TABLE[Math.min(age, 120)] ?? 2.0;
                firstRMD = iraBalance / factor;
            } else {
                const projIRA = iraBalance * Math.pow(1 + growthRate, yearsTo);
                const factor = RMD_TABLE[rmdAge] ?? 26.5;
                firstRMD = projIRA / factor;
            }
            rmdStr += ` | ~$${Math.round(firstRMD).toLocaleString()}/yr`;
        }
        return `Age ${age} | ${rmdStr}`;
    }

    const el1 = document.getElementById('age-display-1');
    if (el1) el1.textContent = ageInfo(+val('birthyear1'), +val('birthmonth1') || 12, +val('IRA1') || 0) ?? '';

    const el2 = document.getElementById('age-display-2');
    if (el2) el2.textContent = ageInfo(+val('birthyear2'), +val('birthmonth2') || 12, +val('IRA2') || 0) ?? '';
    updateACAWarning();
}

// IRA Goal suggestion - IRA balance today whose RMDs ≈ the spend goal at age 84.
// Mirrors the After-Tax Spend ⓘ pattern (computeSuggestedSpend / applySuggestSpend).
let _priorIraGoal = null;

function computeSuggestedIraGoal() {
    try {
        const age1 = new Date().getFullYear() - (+val('birthyear1'));
        const growth = +val('growth') / 100;
        const spendGoal = +val('spendGoal');
        const targetAge = 84;
        const yearsUntil = targetAge - age1;
        if (yearsUntil <= 0 || spendGoal <= 0 || !RMD_TABLE[targetAge]) return null;
        const rmdPctAtTarget = 1 / RMD_TABLE[targetAge];   // RMD fraction at target age
        const targetAtAge = spendGoal / rmdPctAtTarget;    // balance whose RMD = spend goal
        const targetNow = targetAtAge / Math.pow(1 + growth, yearsUntil);  // discount to today
        return { value: Math.round(targetNow), targetAge, rmdPctAtTarget, yearsUntil, growth };
    } catch (e) { return null; }
}

// Keep the existing name - runSimulation() already calls this. Now drives the ⓘ icon, not a hint div.
function updateIRAGoalHint() {
    const icon = document.getElementById('suggest-ira-icon');
    if (!icon) return;
    const sug = computeSuggestedIraGoal();
    if (!sug) { icon.style.display = 'none'; return; }
    icon.style.display = '';
    icon.title = _priorIraGoal !== null
        ? `Restore: $${Math.round(_priorIraGoal).toLocaleString()}`
        : `Suggested IRA Goal: $${sug.value.toLocaleString()} - IRA balance today whose RMDs ≈ your spend goal at age ${sug.targetAge} (${(sug.rmdPctAtTarget * 100).toFixed(2)}% RMD, ${sug.yearsUntil} yrs at ${(sug.growth * 100).toFixed(1)}% growth). Click to apply.`;
}

function applySuggestIraGoal() {
    if (_priorIraGoal !== null) {
        DisplayHelpers.setDollarValue('iraBaseGoal', Math.round(_priorIraGoal));
        _priorIraGoal = null;
    } else {
        const sug = computeSuggestedIraGoal();
        if (!sug) return;
        const el = document.getElementById('iraBaseGoal');
        _priorIraGoal = parseFloat((el?.dataset?.numVal) || (el?.value || '').replace(/[^\d.-]/g, '') || '0');
        DisplayHelpers.setDollarValue('iraBaseGoal', sug.value);
    }
    updateIRAGoalHint();
    runSimulation();
}

function runSimulation() {
    refreshStratRateOptions();   // keep bracket dropdown labels in sync with CPI + filing status
    // computeOC: single-scenario runs also produce the Opp. Cost counterfactual (Break Even).
    const _simInputs = { ...getInputs(), computeOC: true };
    let res = simulate(_simInputs);
    lastSimInputs = _simInputs;
    lastSimulationLog = res.log;
    lastTotals = res.totals;
    lastFinalNW = res.finalNW;
    const lastEntry = res.log[res.log.length - 1];
    lastFinalNWCurrentDollars = lastEntry.totalWealth / (lastEntry.inflationFactor || 1);
    updateTable(res.log);
    updateStats(res.totals, res.finalNW, lastFinalNWCurrentDollars);
    updateCharts(res.log);
    updateIRAGoalHint();
    refreshSuggestedSpend();   // re-solve the engine-calibrated suggested spend for the ⓘ icon
    // Show computed marginal rate in the auto label when futureIRATaxRate is blank
    const _autoRateEl = document.getElementById('future-ira-tax-auto');
    if (_autoRateEl) {
        const _blank = !val('futureIRATaxRate');
        if (_blank && res.log.length > 0) {
            const r0 = res.log[0];
            const autoRatePct = Math.round(((r0['FedRate%'] || 0) + (r0['StateRate%'] || 0)) * 100);
            _autoRateEl.textContent = autoRatePct > 0 ? `(auto: ${autoRatePct}%)` : '';
        } else {
            _autoRateEl.textContent = '';
        }
    }
    const spouseBtn = document.getElementById('chartPerson_spouse');
    if (spouseBtn) spouseBtn.style.display = getInputs().hasSpouse ? '' : 'none';
}

function updateCurrentDollarsView() {
    if (lastSimulationLog) {
        updateTable(lastSimulationLog);
        updateCharts(lastSimulationLog);
        updateStats(lastTotals, lastFinalNW, lastFinalNWCurrentDollars);
    }
    if (OptimizerState.results) renderOptimizerTable(OptimizerState.results);
    // Re-render the MC charts so current-dollar deflation is applied (or removed). The stress chart
    // reads the same checkbox but was never re-rendered here, so it silently stayed in nominal
    // dollars while the chart above it switched. It also has its own results object, which exists
    // even when no full sweep has run.
    const _stress = (typeof _mcResults !== 'undefined' && _mcResults?.stress)
        ? _mcResults.stress
        : (typeof _mcStress !== 'undefined' ? _mcStress : null);
    if (typeof _mcResults !== 'undefined' && _mcResults) {
        if (typeof renderMCChart === 'function') renderMCChart(_mcResults);
    }
    if (_stress && typeof renderStressChart === 'function') renderStressChart(_stress);
}
// //////////////////////////////////////////////////////////////////

let _lastOptimizerHash = null;

// Assign afterTaxNW / afterTaxNWCurrentDollars / _baselineScore to every row using one shared
// future-IRA rate so deltas are comparable across strategies. Baseline score = after-tax terminal
// wealth (bequest) + lifetime money actually spent (spendable weighted +10% via core's
// SPENDABLE_WEIGHT, since a dollar enjoyed outranks a dollar bequeathed). Both in current (real)
// dollars. Ranking on this -- instead of raw finalNW -- stops a spend-cutting strategy (e.g. GK)
// from "winning" by hoarding. Called once BEFORE Phase 23 (so the conversion pool can rank on
// _baselineScore) and once AFTER (so the newly pushed ⇌ rows and no-conv rows get scored too);
// it is pure arithmetic with zero simulate() calls, so the double pass is free. Rows do not retain
// res.log, so real-dollar after-tax NW is derived as afterTaxNW * (finalNWCurrentDollars/finalNW),
// which equals afterTaxNW / inflationFactor -- the exact value core's baselineScoreOf computes.
function _scoreRows(rows, sharedFutureIRARate) {
    for (const r of rows) {
        r.afterTaxNW = afterTaxNetWorth(r.totals.terminal, sharedFutureIRARate, r.totals.capGainsRate);
        const _defl = (r.finalNW && r.finalNW !== 0) ? (r.finalNWCurrentDollars / r.finalNW) : 1;
        r.afterTaxNWCurrentDollars = r.afterTaxNW * _defl;
        r._baselineScore = (r.afterTaxNWCurrentDollars ?? 0)
            + SPENDABLE_WEIGHT * (r.totals.spendCurrentDollars ?? 0);
    }
}

// Family + parameter label for an arbitrary plan, matching the names the sweep uses for the same
// selection ('Proportional' / '7%', 'IRMAA Ceil' / 'Tier 2 ceil', 'Ordered' / 'RIBC', ...). Used to
// label the 📍 CURRENT PLAN row so it reads as a peer of the swept rows.
// One constant so the marker that is PREPENDED to a label and the one STRIPPED back off it in the
// pinned row cannot drift apart.
const CURRENT_PLAN_MARK = '📍 ';
const BASELINE_MARK = '⚓ ';

// The ⚓ baseline is identified by object/id rather than by a label prefix: unlike the current plan,
// its label is never rewritten, because which row IS the baseline changes with the active objective.
function isBaselineRow(r) {
    return !!(r && OptimizerState.baseline && r._id === OptimizerState.baseline._id);
}
const _IRMAA_TIER_LABELS = ['Below IRMAA', 'Tier 1 ceil', 'Tier 2 ceil', 'Tier 3 ceil', 'Tier 4 ceil'];
function describeSelection(p) {
    const pct = v => `${Math.round((v ?? 0) * 100)}%`;
    switch (p.strategy) {
        case 'propwd':   return { family: 'Proportional', paramLabel: pct(p.propWithdraw), paramSortVal: Math.round((p.propWithdraw ?? 0) * 100) };
        case 'fixed':    return { family: 'Reduce', paramLabel: `${p.nYears} yrs`, paramSortVal: p.nYears ?? 0 };
        case 'fixedpct': return { family: 'IRA Draw', paramLabel: pct(p.iraWithdrawPct), paramSortVal: Math.round((p.iraWithdrawPct ?? 0) * 100) };
        case 'ordered':  return { family: 'Ordered', paramLabel: p.orderedSeq ?? 'CBIR', paramSortVal: p.orderedSeq ?? 'CBIR' };
        case 'gk':       return { family: 'Guyton-Klinger', paramLabel: `Grd:${Math.round((p.gkGuard ?? 0.20) * 100)} Adj:${Math.round((p.gkAdjPct ?? 0.10) * 100)}`, paramSortVal: 0 };
        case 'aca':      return { family: 'ACA Cliff', paramLabel: `${p.stratACAMultiple ?? 0}% FPL`, paramSortVal: 50 + (p.stratACAMultiple ?? 0) / 100 };
        case 'bracket':
            if ((p.stratACAMultiple ?? 0) > 0)
                return { family: 'ACA Cliff', paramLabel: `${p.stratACAMultiple}% FPL`, paramSortVal: 50 + p.stratACAMultiple / 100 };
            if ((p.stratIRMAATier ?? -1) >= 0)
                return { family: 'IRMAA Ceil', paramLabel: _IRMAA_TIER_LABELS[p.stratIRMAATier] ?? `Tier ${p.stratIRMAATier}`, paramSortVal: p.stratIRMAATier - 0.5 };
            return { family: 'Fill Bracket', paramLabel: pct(p.stratRate), paramSortVal: p.stratRate ?? 0 };
        default:         return { family: p.strategy ?? 'Plan', paramLabel: '', paramSortVal: 0 };
    }
}

// Handles for a sweep that is queued but has not started yet. Deliberately NOT a boolean "already
// scheduled, skip" latch: that version could only be cleared by the queued work actually running, so
// anything that stopped it running (a hidden tab that never fires frames, a torn-down context) left
// the flag stuck true and every later click did nothing at all. Cancelling and re-queueing cannot
// wedge, and it also does the more useful thing when inputs change twice quickly -- the newest wins.
let _optPendingTimer = null;
let _optPendingFrame = null;

// The sweep is a few hundred simulations and blocks the main thread for one to several seconds,
// during which the page looks frozen and the table still shows the previous run. Show a banner
// first, then yield so the browser can paint it before the work starts.
//
// The yield races two frames against a timer, and takes whichever arrives first. Two frames is what
// a visible tab needs (one to lay the banner out, one to commit the paint -- a single frame can run
// the callback before the paint lands). The timer is the fallback, because a tab that is not
// compositing never fires requestAnimationFrame at all: relying on frames alone means the sweep
// simply never runs for anyone who switches browser tabs while it is queued.
function runOptimizer() {
    if (_optPendingTimer) { clearTimeout(_optPendingTimer); _optPendingTimer = null; }
    if (_optPendingFrame) { cancelAnimationFrame(_optPendingFrame); _optPendingFrame = null; }
    setOptimizerBusy('busy');
    let started = false;
    const start = () => {
        if (started) return;          // whichever of the two racers arrived first already ran it
        started = true;
        _optPendingTimer = null;
        _optPendingFrame = null;
        const t0 = performance.now();
        try {
            _runOptimizerNow();
        } finally {
            // Measured wall time, not OptimizerState.perfStats: that is only written by a real
            // sweep, so a cached re-render would have reported the PREVIOUS sweep's duration. This
            // also counts the render, which is time the user waited either way.
            setOptimizerBusy('done', performance.now() - t0);
        }
    };
    _optPendingFrame = requestAnimationFrame(() => { _optPendingFrame = requestAnimationFrame(start); });
    _optPendingTimer = setTimeout(start, 60);
}

// How long the finished banner stays up. A banner that vanishes the instant the work ends reads as
// a glitch rather than as an answer -- on a fast sweep it was on screen for well under a second.
// Holding it lets the reader see that something ran, and what it cost, before it goes.
const OPT_BUSY_HOLD_MS = 5000;
let _optBusyHideTimer = null;

// state: 'busy' while the sweep runs, 'done' once it has finished. 'done' is not the same as hidden:
// it swaps the message and starts the hold timer.
function setOptimizerBusy(state, ms) {
    const el = document.getElementById('opt-busy');
    if (!el) return;
    clearTimeout(_optBusyHideTimer);   // a new run cancels the previous run's hold
    if (state === 'busy') {
        el.style.background = '#eef4fb';
        el.style.borderColor = '#c9dcf0';
        el.style.color = '#1a4d70';
        el.innerHTML = '⏳ Calculating strategies…'
            + '<span style="font-weight:400;color:#4a5c6a;"> testing every withdrawal and conversion strategy against your plan.</span>';
        el.style.display = '';
        return;
    }
    const secs = ms != null ? (ms / 1000).toFixed(1) : null;
    el.style.background = '#e8f6ec';
    el.style.borderColor = '#b7dfc4';
    el.style.color = '#1a7f37';
    el.innerHTML = '✓ Calculating strategies… <strong>DONE</strong>'
        + (secs != null ? `<span style="font-weight:400;color:#4a5c6a;"> in ${secs}s.</span>` : '');
    el.style.display = '';
    _optBusyHideTimer = setTimeout(() => { el.style.display = 'none'; }, OPT_BUSY_HOLD_MS);
}

function _runOptimizerNow() {
    const base = getInputs();
    // The user's plan exactly as configured, captured BEFORE the three guards below strip the
    // sidebar's conversion settings off `base`. The 📍 CURRENT PLAN row is simulated from this, so
    // it keeps conversions off when the user has them off, keeps their Extra Conversion, and keeps
    // their stop year -- none of which any swept row does.
    const userPlan = { ...base };
    // extraConversionAmount must never leak from the sidebar into the main strategy sweep or its
    // cyclic/Optimize-Spend passes below - none of their overrides objects set this key, so
    // without this line every family would silently inherit whatever's currently in the sidebar
    // (e.g. left over from loading a ⇌ row), corrupting the whole table. Phase 23 (further down)
    // is unaffected either way: it always sets this key explicitly on every simulate() call it
    // makes. Placed before currentHash so the cache hash is correctly insensitive to this field.
    base.extraConversionAmount = 0;
    // Same reasoning for the sidebar's Conversion End Year: no family override sets it, so leaving
    // it on `base` would silently truncate every strategy in the table at the sidebar's cutoff.
    // The optimizer explores full-conversion plans; a per-row stop-year is a separate (deferred)
    // sweep dimension. Cleared before currentHash so the cache stays insensitive to it.
    base.convEndYear = undefined;
    base.convEndMode = 'all';
    // The three fields cleared above are absent from `base`, so they must be hashed from userPlan:
    // the sweep is correctly insensitive to them, but the 📍 CURRENT PLAN row is not, and without
    // this a user who only changes their Extra Conversion or stop year gets the cached table back
    // with a stale current row.
    const currentHash = JSON.stringify(base)
        + ';optimizeSpend=' + (document.getElementById('optimizeSpend')?.checked ?? false)
        + ';convOpt=' + (document.getElementById('includeConvOpt')?.checked ?? false)
        + ';cur=' + JSON.stringify([userPlan.extraConversionAmount, userPlan.convEndYear, userPlan.convEndMode]);
    if (currentHash === _lastOptimizerHash && OptimizerState.results) {
        renderOptimizerTable(OptimizerState.results);
        showTab('tab-opt');
        return;
    }
    _lastOptimizerHash = currentHash;

    const results = [];
    simulationCount = 0;
    OptimizerState.convOptCandidateCount = 0;
    OptimizerState.convOptRowsAdded = 0;
    const optimizerStart = performance.now();

    // strategyOverrides stored separately so the spend optimizer can reuse them
    const strategyOverridesList = [];

    function addResult(strategyLabel, paramLabel, paramSortVal, overrides, noConv = false) {
        // Nerdknob sweeps fundConversionWithCash as its own dimension (the 💵 rows added after
        // the cyclic pass), so base rows must NOT inherit the sidebar's value - otherwise a user
        // with it already on would get two identical arms instead of an A/B. Outside nerdknob
        // rows keep inheriting it, so the table reflects the plan you actually configured.
        if (NERD_KNOBS && overrides.fundConversionWithCash === undefined) {
            overrides = { ...overrides, fundConversionWithCash: false };
        }
        const inputs = Object.assign({}, base, overrides);
        // computeOC on for every row so the Break Even column is populated table-wide, not just on
        // the ⇌ rows that used to re-run for it. Without this the "Earliest Break Even" objective
        // and its Best-table winner have nothing to sort on (every row falls back to the same
        // sentinel). Measured cost on a 144-row sweep: 78ms -> 152ms, ~+110ms at this table's size,
        // well inside the 2.5s budget. The second counterfactual (excessOC) is separately guarded
        // inside simulate() and fired on 0 of 144 rows.
        const res = simulate({ ...inputs, computeOC: true });
        const lastEntry = res.log[res.log.length - 1];
        const totalYears = res.log.length;
        const ovYears = res.log.filter(e => (e['BracketOverage'] ?? 0) > 0).length;
        const bracketOveragePct = totalYears > 0 ? ovYears / totalYears : 0;
        const isBracketInfeasible = overrides.strategy === 'bracket' && bracketOveragePct > 0.5;
        // ACA is strict: any year its FPL cap can't fund spending makes the plan untenable (the
        // subsidy is forfeited rather than the cap being broken).
        //
        // NARROWED from eitherOnMedicareAtStart to bothOnMedicareAtStart (P35 PR 3c). PF13 item 3
        // flagged the row whenever EITHER spouse was already on Medicare, on the reasoning that the
        // older spouse's RMDs/SS push household MAGI past any FPL cap. That reasoning is still
        // right, but it is now MEASURED instead of assumed: those years breach the cap and land in
        // acaBreachYears, so the row is flagged by evidence from its own simulation. What the
        // assumption got wrong was the other side - a 66/62 couple has four real ACA years, and
        // declaring the whole plan untenable on day one erased them.
        //
        // The remaining case is not a proxy for anything: when BOTH are past Medicare age at start,
        // yr.acaLapsed is true in every year, the engine runs Proportional 0% throughout, and the
        // row's ACA label describes nothing it did. The sweep already omits the family here
        // (acaDisabled, below); this still catches a plan loaded from a URL or restored as the
        // CURRENT PLAN row, which bypass that gate.
        const acaBreachYears = res.totals?.acaBreachYears ?? 0;
        const acaNeverApplies = bothOnMedicareAtStart(
            base.birthyear1, base.startAge, !!base.hasSpouse, base.hasSpouse ? (base.birthyear2 || 0) : 0);
        const isACAUntenable = overrides.strategy === 'aca' && (acaBreachYears > 0 || acaNeverApplies);
        const row = {
            _id: results.length,
            _isNoConv: noConv,
            _strategyLabel: strategyLabel + (inputs.convertExcessToRoth ? ' ✓' : '') + (noConv ? ' (no conv)' : '') + ((isBracketInfeasible || isACAUntenable) ? ' ⚠️' : ''),
            _paramLabel: paramLabel,
            _paramSortVal: paramSortVal,
            // Record the EFFECTIVE values (base + overrides), not just the overrides: outside
            // nerdknob fundConversionWithCash is inherited from the sidebar rather than set as
            // an override, and loadOptimizerResult() restores from these fields - reading the
            // override alone would load a plan that differs from the row the table evaluated.
            _convertExcessToRoth: !!inputs.convertExcessToRoth,
            _fundConversionWithCash: !!inputs.fundConversionWithCash,
            _spendGoal: inputs.spendGoal,
            _strategy: overrides.strategy,
            _nYears: overrides.nYears ?? null,
            _stratRate: overrides.stratRate ?? null,
            _stratIRMAATier: overrides.stratIRMAATier ?? null,
            _stratACAMultiple: overrides.stratACAMultiple ?? 0,
            _propWithdraw: overrides.propWithdraw ?? null,
            _iraWithdrawPct: overrides.iraWithdrawPct ?? null,
            _cyclicEnabled: !!(overrides.cyclicEnabled),
            _cyclicOrder:   overrides.cyclicOrder ?? 'ira-first',
            _convBEYear: res.totals.convBEYear ?? null,
            // The complete strategy selection, in plain engine field names, read from the EFFECTIVE
            // inputs. sameStrategySelection() compares this against the sidebar to mark the row
            // that matches the user's current plan, and loadOptimizerResult() restores the fields
            // the older _-prefixed set never carried (orderedSeq, the GK guardrails).
            _selection: {
                strategy: inputs.strategy,
                propWithdraw: inputs.propWithdraw, nYears: inputs.nYears,
                stratRate: inputs.stratRate, stratIRMAATier: inputs.stratIRMAATier ?? -1,
                stratACAMultiple: inputs.stratACAMultiple ?? 0,
                iraWithdrawPct: inputs.iraWithdrawPct, orderedSeq: inputs.orderedSeq,
                gkGuard: inputs.gkGuard, gkAdjPct: inputs.gkAdjPct,
                cyclicEnabled: !!inputs.cyclicEnabled, cyclicOrder: inputs.cyclicOrder ?? 'ira-first',
                fundConversionWithCash: !!inputs.fundConversionWithCash,
            },
            _isSpendOptimized: false,
            _bracketOveragePct: bracketOveragePct,
            _isBracketInfeasible: isBracketInfeasible,
            _isACAUntenable: isACAUntenable,
            _acaBreachYears: acaBreachYears,
            totals: res.totals,
            finalNW: res.finalNW,
            finalNWCurrentDollars: lastEntry.totalWealth / (lastEntry.inflationFactor || 1)
        };
        results.push(row);
        strategyOverridesList.push({ strategyLabel, paramLabel, paramSortVal, overrides });
    }

    // The enumeration itself lives in optimizer_core.js (buildStrategyFamilies), shared with Monte
    // Carlo's buildVariations() and - unlike the inline block this replaced - reachable from node,
    // which is what lets a study measure the sweep without a browser. Every way THIS table's sweep
    // differs from MC's is an argument below rather than a difference nobody declared.
    const acaDisabled = bothOnMedicareAtStart(base.birthyear1, base.startAge, !!base.hasSpouse,
        base.hasSpouse ? (base.birthyear2 || 0) : 0);
    const families = buildStrategyFamilies(base, {
        grids: OPTIMIZER_GRIDS,
        irmaaFamily: true,
        // ACA cliff arms are swept for everyone now; the age gate is the only thing that removes
        // them, and it removes them for a reason that is about the plan rather than the audience -
        // once both people are on Medicare at start an income cap protects nothing.
        acaFamily: !acaDisabled,
        // A Fill Bracket row must not inherit a sidebar IRMAA-tier selection; the tiers are swept
        // as their own family.
        bracketResetsIRMAATier: true,
        // Nerdknob sweeps cash funding as its own dimension (the 💵 rows), so the rows it clones
        // must read false rather than inherit the sidebar, or a user who already has it on gets
        // two identical arms instead of an A/B.
        markCashFunding: NERD_KNOBS,
        cashClones: NERD_KNOBS && base.Cash > 0,
        // The user's own off-grid parameter goes last here, after Guyton-Klinger. MC puts it
        // straight after IRA Draw. Both orders are pinned by sweep_golden.js.
        offGridLast: true,
    });
    for (const f of families) {
        addResult(f.strategyLabel, f.paramLabel, f.paramSortVal, f.overrides);
    }
    // The un-modified rows, reused far below for the no-conversion baseline sweep. Deliberately
    // excludes the 🗘/🔄 and 💵 clones: that sweep's whole point is a reference with the Roth and
    // brokerage machinery switched off.
    const baseFamilies = families.filter(f => f.modifier === null);

    // Snapshot of the finished enumeration, kept for characterization. It recorded the inline
    // block that buildStrategyFamilies replaced, and it stays because it captures what this sweep
    // ACTUALLY asked for after every option above resolved - a re-capture is how a change to the
    // gating gets re-pinned. Taken HERE, before the spend/conversion passes append their own rows
    // to the same list. Observation only: nothing in a sweep reads it back. `base` travels with it
    // because the enumeration branches on Cash, the birth years, the GK guardrails and the
    // off-grid parameter. Capture recipe and the recorded goldens: sweep_golden.js.
    OptimizerState.lastEnumeration = {
        nerdKnobs: NERD_KNOBS,
        base,
        rows: strategyOverridesList.slice(),
    };

    // Spend optimizer second pass - only runs when user enabled the toggle
    OptimizerState.noSolutionFloor = null;
    if (document.getElementById('optimizeSpend')?.checked) {
        const anySuccess = results.some(r => r.totals.success);

        if (anySuccess) {
            // Forward mode: for each successful strategy, binary-search upward
            const baselineCount = results.length;
            for (let i = 0; i < baselineCount; i++) {
                const baseRow = results[i];
                if (!baseRow.totals.success) continue;
                const { strategyLabel, paramLabel, paramSortVal, overrides } = strategyOverridesList[i];
                const opt = optimizeSpend(base, overrides);
                if (!opt) continue;
                const lastEntry = opt.result.log[opt.result.log.length - 1];
                results.push({
                    _id: results.length,
                    _strategyLabel: (strategyLabel + (overrides.convertExcessToRoth ? ' ✓' : '')) + (opt.hitCeiling ? ' ✦+' : ' ✦'),
                    _paramLabel: paramLabel,
                    _paramSortVal: paramSortVal,
                    _convertExcessToRoth: overrides.convertExcessToRoth,
                    _spendGoal: opt.optimizedSpend,
                    _strategy: overrides.strategy,
                    _nYears: overrides.nYears ?? null,
                    _stratRate: overrides.stratRate ?? null,
                    _propWithdraw: overrides.propWithdraw ?? null,
                    _isSpendOptimized: true,
                    _isReverseOptimized: false,
                    _hitCeiling: opt.hitCeiling,
                    totals: opt.result.totals,
                    finalNW: opt.result.finalNW,
                    finalNWCurrentDollars: lastEntry.totalWealth / (lastEntry.inflationFactor || 1)
                });
            }
        } else {
            // Reverse mode: all strategies failed - find the highest spend that works
            const opt = optimizeSpendDown(base, strategyOverridesList);
            if (opt) {
                const lastEntry = opt.result.log[opt.result.log.length - 1];
                results.push({
                    _id: results.length,
                    _strategyLabel: (opt.strategyLabel + (opt.overrides.convertExcessToRoth ? ' ✓' : '')) + ' ▼',
                    _paramLabel: opt.paramLabel,
                    _paramSortVal: opt.paramSortVal,
                    _convertExcessToRoth: opt.overrides.convertExcessToRoth,
                    _spendGoal: opt.optimizedSpend,
                    _strategy: opt.overrides.strategy,
                    _nYears: opt.overrides.nYears ?? null,
                    _stratRate: opt.overrides.stratRate ?? null,
                    _propWithdraw: opt.overrides.propWithdraw ?? null,
                    _isSpendOptimized: true,
                    _isReverseOptimized: true,
                    _hitCeiling: false,
                    totals: opt.result.totals,
                    finalNW: opt.result.finalNW,
                    finalNWCurrentDollars: lastEntry.totalWealth / (lastEntry.inflationFactor || 1)
                });
            } else {
                // Reverse search also failed - report the lowest spend level that was tried
                OptimizerState.noSolutionFloor = Math.max(500, base.spendGoal * 0.02);
            }
        }
    }

    // 📍 CURRENT PLAN - the sidebar's own plan, simulated exactly as configured so the table can
    // answer "is the optimizer's pick actually better than what I'm doing?". Every swept row forces
    // convertExcessToRoth on and runs with the sidebar's extra conversion and stop year stripped,
    // so none of them is this plan even when the strategy and parameter line up.
    // Added LAST, after the cyclic / 💵 / no-conv / Optimize-Spend passes, so it is never cloned
    // into a 🗘 / 🔄 / 💵 / (no conv) / ✦ variant -- it is one fixed reference, not a family.
    // fundConversionWithCash is passed explicitly so addResult's nerdknob guard cannot force it to
    // false and quietly model a different plan than the user has.
    {
        const _curOv = {
            strategy: userPlan.strategy,
            propWithdraw: userPlan.propWithdraw, nYears: userPlan.nYears,
            stratRate: userPlan.stratRate, stratIRMAATier: userPlan.stratIRMAATier ?? -1,
            stratACAMultiple: userPlan.stratACAMultiple ?? 0,
            iraWithdrawPct: userPlan.iraWithdrawPct, orderedSeq: userPlan.orderedSeq,
            gkGuard: userPlan.gkGuard, gkAdjPct: userPlan.gkAdjPct,
            cyclicEnabled: !!userPlan.cyclicEnabled, cyclicOrder: userPlan.cyclicOrder ?? 'ira-first',
            convertExcessToRoth: !!userPlan.convertExcessToRoth,
            fundConversionWithCash: !!userPlan.fundConversionWithCash,
            extraConversionAmount: userPlan.extraConversionAmount ?? 0,
            convEndYear: userPlan.convEndYear, convEndMode: userPlan.convEndMode ?? 'all',
        };
        // Name it the way the swept rows are named, so the pinned row reads as a peer of the table
        // ("Proportional 7%", "Guyton-Klinger Grd:20 Adj:10") rather than an unlabelled special case.
        const _fam = describeSelection(userPlan);
        addResult(_fam.family, _fam.paramLabel, _fam.paramSortVal, _curOv);
        const curRow = results[results.length - 1];
        curRow._isCurrentPlan = true;
        curRow._strategyLabel = CURRENT_PLAN_MARK + curRow._strategyLabel;
        // Carried so clicking the pinned row restores the plan intact - loadOptimizerResult() zeroes
        // the extra conversion and the stop year for every row type that doesn't claim them.
        curRow._optConvAmt  = userPlan.extraConversionAmount ?? 0;
        curRow._convEndYear = userPlan.convEndYear ?? null;
        curRow._convEndMode = userPlan.convEndMode ?? 'all';
        OptimizerState.currentPlanId = curRow._id;

        // Mark the swept row that uses the same strategy selection, so the user can see where their
        // setting sits on its family's curve. Exactly one row is marked: several can match (the base
        // row, its (no conv) twin, a 💵 clone), so prefer the one whose conversion switch also
        // agrees with the sidebar and fall back to the first match otherwise.
        const _matches = results.filter(r => !r._isCurrentPlan && sameStrategySelection(r._selection, userPlan));
        const _match = _matches.find(r => !!r._convertExcessToRoth === !!userPlan.convertExcessToRoth) ?? _matches[0];
        // ...but only when the twin is a DIFFERENT plan. A swept row differs from the user's plan
        // solely in the conversion fields runOptimizer strips (the on/off switch, any Extra Annual
        // Conversion, any stop year). When none of those differ, the twin IS the user's plan, run
        // again: marking it just puts a second 📍 on an identical row, which reads as a bug.
        const _curDiffersFromSweep = !!_match && (
               !!_match._convertExcessToRoth !== !!userPlan.convertExcessToRoth
            || (userPlan.extraConversionAmount ?? 0) !== 0
            || userPlan.convEndYear != null
        );
        if (_match && _curDiffersFromSweep) {
            _match._isCurrentMatch = true;
            _match._strategyLabel = CURRENT_PLAN_MARK + _match._strategyLabel;
        }
    }

    // Shared future-IRA rate for after-tax scoring - hoisted above Phase 23 so the conversion
    // candidate pool and the sweep's own objective can both rank on _baselineScore (the same
    // measure the table ranks on) rather than raw finalNW, which discounts each run's IRA at its
    // own rate and ignores spendable. results[0] is the propwd 0% row, present before Phase 23.
    const sharedFutureIRARate = base.futureIRATaxRate ?? (results[0]?.totals.futureIRARate ?? 0);
    OptimizerState.sharedFutureIRARate = sharedFutureIRARate;  // PF13: widowrmd/taxflex metrics read it
    _scoreRows(results, sharedFutureIRARate);

    // Phase 23 / PF11: Conversion Amount Optimizer - when the checkbox is enabled, sweep
    // extraConversionAmount for the best plan from EACH strategy family (not a flat top-5 by
    // ending wealth, which let one family monopolize every seat while the families that actually
    // benefit from converting ranked just below the cut). Each surviving candidate adds a ⇌ row.
    if (document.getElementById('includeConvOpt')?.checked) {
        const pool = selectConversionCandidates(results, 12);
        OptimizerState.convOptCandidateCount = pool.length;
        // Stashed for the on-demand break-even-rate diagnostic below, which needs the exact
        // candidates and base inputs this run used rather than re-deriving them later.
        const poolCandidates = [];
        OptimizerState.convOptBase = base;
        OptimizerState.convOptPool = poolCandidates;
        let convRowsAdded = 0;
        // The time-limited (convert-then-stop) fallback below costs a coarse amount x cutoff scan
        // per candidate. Measured on the default scenario, where all 12 candidates come back empty
        // and so all 12 would get the fallback, that pushed one optimizer run to 2,216 simulations
        // -- past this project's 1,500-run budget. Restricting it to the candidates holding the
        // most IRA at the end keeps the run inside budget while targeting the plans with the most
        // left to convert. Deliberately NOT filtered to "has an IRA left": a plan that spends its
        // IRA down still gains from converting earlier.
        const tlEligible = new Set([...pool]
            .sort((a, b) => (b.totals?.terminal?.ira ?? 0) - (a.totals?.terminal?.ira ?? 0))
            .slice(0, 6));
        for (const baseRow of pool) {
            const overrides = {
                strategy: baseRow._strategy,
                convertExcessToRoth: baseRow._convertExcessToRoth,
                fundConversionWithCash: baseRow._fundConversionWithCash ?? false,
                // stratIRMAATier/stratACAMultiple always have a defined sentinel on every row
                // (tier -1 / multiple 0), so pin them unconditionally rather than letting a
                // bracket-family top5 row silently fall back to the sidebar's current stratRate.
                stratIRMAATier: baseRow._stratIRMAATier ?? -1,
                stratACAMultiple: baseRow._stratACAMultiple ?? 0,
                ...(baseRow._stratRate   != null ? { stratRate:      baseRow._stratRate }   : {}),
                ...(baseRow._nYears      != null ? { nYears:         baseRow._nYears }      : {}),
                ...(baseRow._propWithdraw!= null ? { propWithdraw:   baseRow._propWithdraw }: {}),
                ...(baseRow._iraWithdrawPct != null ? { iraWithdrawPct: baseRow._iraWithdrawPct } : {}),
                // A cyclic (🗘/🔄) top5 candidate must keep cycling brokerage in the
                // conversion-optimized re-run, or beResult silently simulates the non-cyclic
                // variant while the displayed row still inherits the 🗘/🔄 prefix from
                // baseRow._strategyLabel - a real label/computation mismatch.
                ...(baseRow._cyclicEnabled ? { cyclicEnabled: true, cyclicOrder: baseRow._cyclicOrder ?? 'ira-first' } : {}),
            };
            poolCandidates.push({ overrides, terminalIRA: baseRow.totals?.terminal?.ira ?? 0,
                                  label: baseRow._strategyLabel || baseRow._strategy });
            let { optConv, optResult } = optimizeConversionAmount(
                base, overrides, 'baselineScore', { futureIRARate: sharedFutureIRARate });
            // When a flat forever-conversion doesn't help, try a TIME-LIMITED one before giving up:
            // convert for the first few years, then stop. That shape is inexpressible to the flat
            // sweep, and it is often the only one that pays (measured across the candidate pool:
            // 10 of 12 candidates rescued on a $3.3M-IRA scenario, 5 at a 45% future rate, 0 on the
            // default scenario -- where "conversions don't pay" is simply the true answer).
            // Only runs on candidates that already came back empty, so plans the flat sweep solves
            // pay nothing for it.
            let convEndYear = null;
            if (optConv === 0 && tlEligible.has(baseRow)) {
                const tl = bestTimeLimitedConversion(base, overrides,
                    { futureIRARate: sharedFutureIRARate, spendableWeight: SPENDABLE_WEIGHT });
                if (tl && tl.stopYearCalendar != null && tl.amount > 0) {
                    optConv = tl.amount;
                    convEndYear = tl.stopYearCalendar;
                    optResult = true;   // re-simulated as beResult below
                }
            }
            if (!optResult || optConv === 0) continue;
            // Break Even: re-run once more at the already-known winning conversion amount with
            // computeOC on, so this row's convBEYear uses the same sustained-crossing definition
            // as the single-scenario tab. Cheap: optimizeConversionAmount() already found optConv
            // via its own $25k sweep; this is one extra simulate() call (plus its internal
            // counterfactual pass) at that fixed amount, not a repeat of the sweep. beResult
            // carries the identical primary-run numbers as optResult (computeOC only adds
            // annotations), so it's used directly below instead of optResult.
            const beResult = simulate({ ...base, ...overrides, extraConversionAmount: optConv,
                                        ...(convEndYear != null ? { convEndYear, convEndMode: 'extra' } : {}),
                                        computeOC: true });
            const lastEntry = beResult.log[beResult.log.length - 1];
            results.push({
                _id: results.length,
                _strategyLabel: baseRow._strategyLabel + ' ⇌' + (convEndYear != null ? ` ⏹${convEndYear}` : ''),
                _paramLabel: baseRow._paramLabel,
                _paramSortVal: baseRow._paramSortVal,
                _convertExcessToRoth: baseRow._convertExcessToRoth,
                _fundConversionWithCash: baseRow._fundConversionWithCash ?? false,
                _spendGoal: base.spendGoal,
                _strategy: baseRow._strategy,
                _nYears: baseRow._nYears,
                _stratRate: baseRow._stratRate,
                _stratIRMAATier: baseRow._stratIRMAATier ?? null,
                _stratACAMultiple: baseRow._stratACAMultiple ?? 0,
                _propWithdraw: baseRow._propWithdraw ?? null,
                _iraWithdrawPct: baseRow._iraWithdrawPct ?? null,
                _isSpendOptimized: false,
                _isConvOptimized: true,
                _optConvAmt: optConv,
                _convEndYear: convEndYear,
                _convSavings: (baseRow.totals.tax - beResult.totals.tax),
                _convBEYear: beResult.totals.convBEYear,
                _convOCFinal: lastEntry?.convOC ?? null,
                totals: beResult.totals,
                finalNW: beResult.finalNW,
                finalNWCurrentDollars: lastEntry.totalWealth / (lastEntry.inflationFactor || 1)
            });
            convRowsAdded++;
        }
        OptimizerState.convOptRowsAdded = convRowsAdded;
    }

    // Baseline accounting - no-conversion / no-cyclic sweep over the same families.
    // These rows force conversions off (convertExcessToRoth=false, extraConversionAmount=0) and
    // cyclic brokerage maneuvering off, so the best of them is the honest "do it without
    // Roth or brokerage antics" reference every other strategy is measured against.
    for (const fam of baseFamilies) {
        addResult(fam.strategyLabel, fam.paramLabel, fam.paramSortVal,
            { ...fam.overrides, convertExcessToRoth: false, cyclicEnabled: false, extraConversionAmount: 0, qcdHHMax: 0 }, true);
    }

    // Re-score after Phase 23: the ⇌ rows pushed above and the no-conv baseline sweep rows (added
    // just above, after Phase 23) still need afterTaxNW / _baselineScore. Same shared rate, pure
    // arithmetic, no simulate() calls.
    _scoreRows(results, sharedFutureIRARate);

    // Pick the ⚓ baseline (best no-conv successful row) under the active objective, and compute
    // every row's Δ columns against it. 'balanced' (default) reproduces the historical weighted-score
    // pick; a nerdknob objective (item 9) re-picks the baseline under that single metric.
    OptimizerState.results = results;
    recomputeBaselineForObjective();

    // Update top-bar stats using the 0% propwd/no-maxConv row (first result, equivalent to baseline)
    const baseline = results[0];
    if (baseline) {
        updateStats(baseline.totals, baseline.finalNW, baseline.finalNWCurrentDollars);
    }

    OptimizerState.perfStats = { totalMs: performance.now() - optimizerStart, runsCount: simulationCount };
    OptimizerState.sortState = { colKey: '__objective__', direction: 'desc' };
    renderOptimizerTable(results);
    renderSpendOptimizerBanner(results, base.spendGoal);
    renderConvOptBanner();
    showTab('tab-opt');
}

// PF11 empty-state: when Optimize Conversions examined a real pool of strategies but none of them
// improved by converting more than the plan already does, every candidate legitimately returns
// optConv 0 and no ⇌ row is added. Without this, the user sees an empty ⇌ table and reads it as
// broken. Purely reports what already happened (reads the run's stored counts, no recompute).
function renderConvOptBanner() {
    const el = document.getElementById('opt-conv-banner');
    if (!el) return;
    const on = document.getElementById('includeConvOpt')?.checked;
    const n = OptimizerState.convOptCandidateCount || 0;
    if (on && n > 0 && (OptimizerState.convOptRowsAdded || 0) === 0) {
        const ratePct = ((OptimizerState.sharedFutureIRARate || 0) * 100).toFixed(0);
        el.innerHTML = `⇌ Optimize Conversions examined the best ${n} strategies and found none where converting more improves the result. ` +
            `At the ${ratePct}% future tax rate this plan assumes, the tax cost of extra conversions outweighs what they would save. ` +
            `<span id="opt-conv-rate-link" onclick="runConvBreakEvenRateDiagnosis()" style="cursor:pointer;color:#2980b9;white-space:nowrap;">What rate would change that? ▸</span>` +
            `<div id="opt-conv-rate-result" style="display:none;margin-top:4px;"></div>`;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// On demand (not on every run): the lowest future/heirs tax rate at which converting more would
// start to help. Deliberately click-triggered - measured at 0.5-1.2s across scenarios, which is
// affordable to ask for but not to spend on every optimizer run, and it is only ever relevant on
// the empty-state banner. Same affordance as the Break Even ⓘ diagnostic.
function runConvBreakEvenRateDiagnosis() {
    const link = document.getElementById('opt-conv-rate-link');
    const out  = document.getElementById('opt-conv-rate-result');
    if (!out) return;
    if (out.style.display === 'block') { out.style.display = 'none'; return; }  // click again to collapse
    const baseInputs = OptimizerState.convOptBase;
    const cands = OptimizerState.convOptPool || [];
    if (!baseInputs || !cands.length) return;

    if (link) link.textContent = 'Searching…';
    // Yield a frame so the "Searching…" label paints before the synchronous sweep blocks the thread.
    setTimeout(() => {
        const found = lowestBreakEvenHeirsRate(baseInputs, cands,
            { spendableWeight: SPENDABLE_WEIGHT });
        const cur = ((OptimizerState.sharedFutureIRARate || 0) * 100).toFixed(0);
        if (found) {
            out.innerHTML = `Converting starts to pay once your future tax rate is about ` +
                `<b>${(found.rate * 100).toFixed(0)}%</b> or higher (vs the ${cur}% assumed now) - ` +
                `at that rate the best plan found converts <b>$${found.optConv.toLocaleString()}</b>/yr ` +
                `for a gain of <b>$${Math.round(found.gain).toLocaleString()}</b>. ` +
                `Set "Future IRA Tax %" above that to explore it.`;
        } else {
            out.innerHTML = `No future tax rate up to 75% makes converting more worthwhile for this plan. ` +
                `That is a real result, not a missing answer: this plan's conversions cost more in tax now ` +
                `than they can recover later at any plausible rate.`;
        }
        out.style.display = 'block';
        if (link) link.textContent = 'What rate would change that? ▾';
    }, 0);
}

function renderSpendOptimizerBanner(results, baseSpendGoal) {
    const el = document.getElementById('opt-spend-banner');
    if (!el) return;

    // No-solution case: reverse search ran but even the floor (10% of baseline) failed
    if (OptimizerState.noSolutionFloor != null) {
        const floor = Math.round(OptimizerState.noSolutionFloor).toLocaleString();
        el.style.background = '#f8d7da';
        el.style.borderColor = '#f5c6cb';
        el.style.color = '#721c24';
        el.textContent = `⛔ No strategy could sustain your spending goal, and none could be found even at $${floor}/yr (the lowest level tried). Consider reducing your spend goal or increasing your portfolio.`;
        el.style.display = 'block';
        return;
    }

    const reverseRow = results.find(r => r._isReverseOptimized);
    if (reverseRow) {
        const amt = Math.round(reverseRow._spendGoal).toLocaleString();
        // innerHTML (not textContent) so the strategy label's markup (e.g. the red 🗘 cyclic span,
        // ✦/▼ glyphs) renders; the label is app-generated, not user input. Make it clickable to load.
        const label = `<span style="cursor:pointer;text-decoration:underline;" title="Click to load this strategy" onclick="loadOptimizerResult(${reverseRow._id})">${reverseRow._strategyLabel}</span>`;
        el.style.background = '#f8d7da';
        el.style.borderColor = '#f5c6cb';
        el.style.color = '#721c24';
        el.innerHTML = `⚠️ No strategy can fund your current spend goal. The highest sustainable spending found is $${amt}/yr, with all years fully funded. (Strategy: ${label})`;
        el.style.display = 'block';
        return;
    }

    const optimized = results
        .filter(r => r._isSpendOptimized && r.totals.success)
        .sort((a, b) => b._spendGoal - a._spendGoal);
    const best = optimized[0];
    if (best && (best._spendGoal / baseSpendGoal - 1) >= SPEND_SEARCH_MIN_DELTA) {
        const amt = Math.round(best._spendGoal).toLocaleString();
        // innerHTML + clickable (see reverse branch above).
        const label = `<span style="cursor:pointer;text-decoration:underline;" title="Click to load this strategy" onclick="loadOptimizerResult(${best._id})">${best._strategyLabel}</span>`;
        el.style.background = '#fff3cd';
        el.style.borderColor = '#ffc107';
        el.style.color = '#856404';
        el.innerHTML = `💡 It appears you can increase your spending to $${amt}/yr with all years fully funded. (Strategy: ${label})`;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// Column definitions (shared between render and sort)
// showAll: return the complete column set rather than the subset the active "Optimize for" goal
// asks for. Callers that need a column regardless of what is on screen - the sort tiebreakers, the
// "N of M columns" counter - pass true. The filter itself arrives with OPT_OBJECTIVE_COLUMNS; until
// then this parameter is accepted and ignored, so those call sites can already be written correctly.
function getOptimizerColumns(showAll = !!OptimizerState.showAllColumns) {
    const inC = () => document.getElementById('show-current-dollars')?.checked;
    // Nominal -> today's-dollar deflator for the terminal-balance columns. A row does not retain
    // res.log, so there is no terminal.rothCurrentDollars to read; this is the same ratio
    // _scoreRows already uses to build afterTaxNWCurrentDollars. Final IRA and Final Roth therefore
    // restate on the Future $ / Current $ toggle the way NetWealth does, rather than sitting there
    // nominal-only next to columns that move.
    const defl = r => (inC() && r.finalNW) ? (r.finalNWCurrentDollars / r.finalNW) : 1;
    const objKey   = OptimizerState.objective || 'taxflex';
    const objLabel = OPT_OBJECTIVE_LABELS[objKey] || OPT_OBJECTIVE_LABELS.taxflex;
    const cols = [
        // compareZone: these cells select the comparison row instead of loading the strategy.
        // The ⚖ used to be a small glyph inside the Strategy cell, where a near miss loaded the
        // strategy instead -- a destructive, surprising outcome for a click aimed at a comparison.
        // Giving it a whole column, extending the zone across the outcome marker, and separating the
        // two zones with a spacer column makes the two actions hard to confuse.
        {
            key: 'compare', label: '⚖', sortable: false, compareZone: true,
            title: 'Click to compare every other strategy against this row. The ΔNetWealth and ΔTax columns then measure from it instead of the ⚓ baseline. Click the highlighted one again to go back to the baseline.',
            getValue: r => compareToggleHtml(r),
            getSortValue: () => 0
        },
        {
            key: 'status', label: '✓', compareZone: true,
            title: 'Plan outcome. 🟢 = every year of the plan was fully funded. 🚨 = the portfolio ran out before the end (the plan failed). Failed plans always sort below successful ones.\n\nThis cell is part of the ⚖ compare control, so clicking it selects this row as the comparison instead of loading it.',
            getValue: r => r.totals.success ? '🟢' : '🚨',
            getSortValue: r => r.totals.success ? 1 : 0
        },
        {
            // Dead space that separates "compare with this row" from "load this row", so a slightly
            // off click does nothing at all rather than the wrong one of the two.
            key: 'gap', label: '', sortable: false, compareZone: true, inert: true,
            title: '',
            getValue: () => '',
            getSortValue: () => 0
        },
        {
            key: 'strategy', label: 'Strategy',
            title: 'Withdrawal strategy. ✓ = Maximize Conversions on. (no conv) = baseline variant with conversions and brokerage cycling off. 🗘/🔄 = cyclic IRA-first / brokerage-first. ⇌ = Optimize Conversions row. ✦ = Optimize Spend. ⚠️ = bracket target unreachable. Click any row to load it, or ⚖ at the start of the row to measure every Δ column against it.',
            getValue: r => r._strategyLabel,
            getSortValue: r => r._strategyLabel
        },
        {
            key: 'param', label: 'Param',
            title: 'The strategy parameter: bracket/IRMAA/ACA ceiling, IRA draw %, amortization years, proportional boost %, or account order (CBIR/RIBC/BIRC).',
            getValue: r => r._paramLabel,
            getSortValue: r => r._paramSortVal
        },
        // Rank column: numbers rows 1 (best) … N by the currently-selected objective (looked up from
        // the per-render map on OptimizerState; failed rows show '—'). Always visible - it is the
        // readout for the "Optimize for" choice, which every user can now set. PF13 item 4 removed
        // the redundant raw Score column, since the row order already conveys the ranking.
        //
        // Written inline here rather than spliced in after the fact. The old code did
        // `cols.splice(cols.findIndex(c => c.key === 'afterTaxNW') + 1, 0, ...)`, which was a trap
        // waiting for the first conditional column: findIndex returns -1 when its target is absent,
        // and splice(0, 0, ...) then puts Rank at index 0, in front of the ⚖ column that the Best
        // table assumes is there. Sitting beside Strategy and Param also reads better, since all
        // three answer "which plan is this?" rather than "how did it do?".
        {
            key: 'rank', label: 'Rank',
            title: `Rank under the selected objective - "${objLabel}". 1 = best, N = worst among successful plans (failed plans show -). Change the objective with the "Optimize for" selector above.`,
            getValue: r => (OptimizerState._rankMap && OptimizerState._rankMap[r._id]) ? OptimizerState._rankMap[r._id] : '—',
            getSortValue: r => (OptimizerState._rankMap && OptimizerState._rankMap[r._id]) ? OptimizerState._rankMap[r._id] : Infinity
        },
        {
            key: 'spendGoal', label: 'Spend Goal',
            title: 'Annual after-tax spending this strategy targets (today\'s dollars). Normally your input; Optimize Spend (✦) rows show a higher sustainable figure found by search.',
            getValue: r => Math.round(r._spendGoal).toLocaleString(),
            getSortValue: r => r._spendGoal
        },
        {
            key: 'tax', label: 'Lifetime Tax',
            title: 'Total tax paid over the whole plan: federal (ordinary + capital gains + NIIT), state, and Medicare IRMAA surcharges. Toggle Future $/Current $ to switch between nominal and today\'s-dollar totals.',
            getValue: r => Math.round(inC() ? r.totals.taxCurrentDollars : r.totals.tax).toLocaleString(),
            getSortValue: r => inC() ? r.totals.taxCurrentDollars : r.totals.tax
        },
        {
            key: 'spend', label: 'Total Spendable',
            title: 'Total after-tax money available to spend over the whole plan (gross income minus tax). Toggle Future $/Current $ for nominal vs today\'s dollars.',
            getValue: r => Math.round(inC() ? r.totals.spendCurrentDollars : r.totals.spend).toLocaleString(),
            getSortValue: r => inC() ? r.totals.spendCurrentDollars : r.totals.spend
        },
        {
            key: 'afterTaxNW', label: 'FinalWealth',
            title: 'After-tax terminal net worth: IRA × (1 − your expected future IRA rate), brokerage gains × (1 − cap-gains rate), Roth + Cash + basis at face. Uses ONE shared future-IRA rate across all rows so strategies compare on a level footing. This is what the "Maximum Net Wealth" objective ranks on. Toggle Future $/Current $ for nominal vs today\'s dollars.',
            getValue: r => Math.round(inC() ? (r.afterTaxNWCurrentDollars ?? 0) : (r.afterTaxNW ?? 0)).toLocaleString(),
            getSortValue: r => inC() ? (r.afterTaxNWCurrentDollars ?? 0) : (r.afterTaxNW ?? 0)
        },
        {
            key: 'finalIRA', label: 'Final IRA',
            title: 'Traditional (pre-tax) IRA balance at the end of the plan, both people combined, at face value. This is the tax bomb: the balance that drives Required Minimum Distributions, that a surviving spouse pays Single rates on, and that heirs must empty within ten years. FinalWealth already subtracts the tax owed on it; this column is the raw number that tax is charged against, and it is half of what the "Avoiding Widow & RMD Tax" objective ranks on. Toggle Future $/Current $ for nominal vs today\'s dollars.',
            getValue: r => Math.round(defl(r) * (r.totals.terminal?.ira ?? 0)).toLocaleString(),
            getSortValue: r => defl(r) * (r.totals.terminal?.ira ?? 0)
        },
        {
            key: 'finalRoth', label: 'Final Roth',
            title: 'Roth balance at the end of the plan, both people combined. Counts at face value: no tax is ever owed on it, by you or by your heirs. This is what the "Maximum Roth" objective ranks on. Toggle Future $/Current $ for nominal vs today\'s dollars.',
            getValue: r => Math.round(defl(r) * (r.totals.terminal?.roth ?? 0)).toLocaleString(),
            getSortValue: r => defl(r) * (r.totals.terminal?.roth ?? 0)
        },
        {
            // A unitless ratio, so inC() deliberately does NOT apply: deflating all three buckets by
            // the same factor leaves the ratio unchanged, and a number that jumped on the
            // Future $/Current $ toggle would be wrong, not merely restated.
            key: 'mixSpread', label: 'Mix Spread',
            title: 'How unevenly the plan ends up split across the three tax treatments: pre-tax IRA (net of the future IRA rate), Roth, and taxable (brokerage plus cash). 0% is a perfectly even three-way split, so in any future year you can draw from whichever account is cheapest that year. 100% means it all landed in one bucket and you draw from whatever you have. Lower is better. This is the measure the "Tax Flexibility" objective ranks on, among the plans that also finish among the wealthiest.',
            getValue: r => {
                const s = afterTaxBucketSpread(r, OptimizerState.sharedFutureIRARate ?? 0);
                return Number.isFinite(s) ? `${(s * 100).toFixed(0)}%` : '—';
            },
            getSortValue: r => afterTaxBucketSpread(r, OptimizerState.sharedFutureIRARate ?? 0)
        },
        {
            key: 'dNW', label: 'ΔFinalWealth' + deltaRefSuffix(),
            title: 'FinalWealth minus ' + deltaRefDescription() + '. Positive (green) = this strategy ends wealthier after tax than that reference; negative (red) = it ends behind it.',
            getValue: r => {
                const d = inC() ? r._dNWCurrent : r._dNW;
                if (d == null) return '—';
                const v = Math.round(d);
                const c = v > 0 ? '#1a7f37' : v < 0 ? '#cf222e' : '#57606a';
                return `<span style="color:${c}">${v > 0 ? '+' : ''}${v.toLocaleString()}</span>`;
            },
            getSortValue: r => (inC() ? r._dNWCurrent : r._dNW) ?? -Infinity
        },
        {
            key: 'dTax', label: 'ΔTax' + deltaRefSuffix(),
            title: 'Lifetime tax of ' + deltaRefDescription() + ' minus this strategy\'s lifetime tax (each = federal incl. NIIT + state + IRMAA). Positive (green) = this strategy pays less total tax than that reference; negative (red) = it pays more.',
            getValue: r => {
                const d = inC() ? r._dTaxCurrent : r._dTax;
                if (d == null) return '—';
                const v = Math.round(d);
                const c = v > 0 ? '#1a7f37' : v < 0 ? '#cf222e' : '#57606a';
                return `<span style="color:${c}">${v > 0 ? '+' : ''}${v.toLocaleString()}</span>`;
            },
            getSortValue: r => (inC() ? r._dTaxCurrent : r._dTax) ?? -Infinity
        },
        {
            key: 'rate', label: 'Tax Rate',
            title: 'Lifetime tax as a percentage of lifetime gross income (total tax ÷ total income). A blended effective rate across the whole plan.',
            getValue: r => `${(r.totals.tax / r.totals.gross * 100).toFixed(1)}%`,
            getSortValue: r => r.totals.tax / r.totals.gross
        },
        {
            key: 'years', label: 'Yrs Funded',
            title: 'Years fully funded out of years tested. Less than the full count means the plan fell short in some years (a failure).',
            getValue: r => `${r.totals.yearsfunded}/${r.totals.yearstested}`,
            getSortValue: r => r.totals.yearsfunded
        },
        {
            key: 'rmd', label: 'Total RMDs',
            title: 'Total Required Minimum Distributions forced out of traditional IRAs over the plan. Lower means the strategy drew down or converted the IRA earlier, shrinking later forced withdrawals.',
            getValue: r => Math.round(r.totals.rmd).toLocaleString(),
            getSortValue: r => r.totals.rmd
        },
        {
            key: 'rmdtax', label: 'RMD Tax%',
            title: 'Share of lifetime tax attributable to RMDs. High means forced IRA distributions are driving the tax bill - a signal that earlier conversions might help.',
            getValue: r => r.totals.tax > 0 ? `${(r.totals.rmdTax / r.totals.tax * 100).toFixed(0)}%` : '—',
            getSortValue: r => r.totals.rmdTax / (r.totals.tax || 1)
        },
        {
            // Renamed from "Tax Paid Δ". The Δ was misleading: unlike every other Δ in this table it
            // is not measured against the ⚓ baseline or a ⚖ pinned row, it is one row's own
            // conversion search compared against itself without the extra conversions.
            key: 'convSaved', label: 'Conversion Tax Saved',
            title: 'Counts only tax actually paid during the plan, so it is NOT a verdict on whether converting was worth it. Positive = the extra IRA→Roth conversions run by Optimize Conversions lowered lifetime tax vs the same strategy without them. It does not price the deferred tax still owed on the no-extra-conversion plan\'s larger remaining IRA, so a big positive number here can sit alongside a plan that ends up worse off overall. Use the Break Even column, which prices in that deferred tax, for the actual answer.',
            getValue: r => r._convSavings != null ? '$' + Math.round(r._convSavings).toLocaleString() : '—',
            getSortValue: r => r._convSavings ?? -Infinity
        },
        {
            key: 'convBE', label: 'Break Even',
            title: 'The year this strategy\'s after-tax wealth permanently overtakes the same strategy with no conversions (same sustained-crossing definition as the single-scenario Break Even stat: the lead must hold through the end of the plan). "—" means it never sustains a lasting lead, or the strategy never converts at all. Unlike Conversion Tax Saved, this prices in the tax still owed on whatever\'s left in the IRA, so it\'s the more complete answer to whether conversions paid off overall. Sort by it, or choose "Earliest Break Even" under Optimize for, to rank strategies by how fast their conversions pay back.',
            getValue: r => r._convBEYear != null ? String(r._convBEYear) : '—',
            getSortValue: r => r._convBEYear ?? 9999
        }
    ];
    return cols;
}

function renderOptimizerTable(results) {
    // Re-renders triggered by the ⚖ compare toggle pass no argument - they are redrawing whatever
    // is already in state, not a fresh sweep.
    results = results ?? OptimizerState.results;
    if (!results || results.length === 0) return;
    const columns = getOptimizerColumns();
    // Default: sort by After-Tax NW descending; Spendable descending as tiebreaker.
    // normalizeSortState is the single choke point where a vanished sort column is caught - see the
    // comment on the function. Written back to state so the header arrow and the next render agree.
    const sortState = OptimizerState.sortState = normalizeSortState(OptimizerState.sortState, columns);

    // Rank map (item 10): number successful rows 1 (best) … N under the active objective. Looked up
    // by the nerdknob Rank column; failed rows are left unranked ('—').
    const _ranked = rankRows(results.filter(r => r.totals.success), OptimizerState.objective);
    OptimizerState._rankMap = {};
    _ranked.forEach((r, idx) => { OptimizerState._rankMap[r._id] = idx + 1; });

    // Sort a copy; preserve original _id for click handlers.
    // Pull the baseline out of the body - it is rendered as a pinned reference row on top.
    const baselineRow = OptimizerState.baseline ?? null;
    // Infeasible (bracket-unreachable) rows are hidden by default - toggled via the legend.
    const showInfeasible = !!OptimizerState.showInfeasible;
    const showFailed = !!OptimizerState.showFailed;
    const infeasibleCount = results.filter(r => r._isBracketInfeasible || r._isACAUntenable).length;
    // Failed = the portfolio ran out of money (success===false). Hidden by default (item 11).
    const failedCount = results.filter(r => !r.totals.success).length;
    // Both pinned rows come out of the body, for the same reason: each is already rendered once,
    // sticky, above the table. The current plan used to stay in the body so its Rank was visible,
    // but the pinned row carries the Rank column too, so the body copy only produced a second 📍 on
    // an identical row.
    let display = results.filter(r => !(baselineRow && r._id === baselineRow._id) && !r._isCurrentPlan);
    if (!showInfeasible) display = display.filter(r => !(r._isBracketInfeasible || r._isACAUntenable));
    if (!showFailed) display = display.filter(r => r.totals.success);
    // Tiebreaker comparators come from the UNFILTERED column set. What the sort does when two rows
    // tie is a property of the sort, not of what happens to be on screen: reading these out of the
    // filtered `columns` would make the NetWealth/Spendable tiebreak quietly evaporate whenever the
    // active goal hid the other column.
    const allColumns  = getOptimizerColumns(true);
    const afterTaxCol = allColumns.find(c => c.key === 'afterTaxNW');
    const spendCol    = allColumns.find(c => c.key === 'spend');
    // PF13: default body order follows the active "Optimize for" objective (same order as the Rank
    // column) until the user clicks a real column header. rankRows already keeps failed rows last.
    if (sortState.colKey === '__objective__') {
        display = rankRows(display, OptimizerState.objective);
    }
    const col   = columns.find(c => c.key === sortState.colKey);
    if (col) {
        display.sort((a, b) => {
            // Failed plans never outrank successful ones, whatever the sort column - a strategy
            // that runs out of money can show inflated terminal wealth (it left needs unfunded).
            const sa = a.totals.success ? 1 : 0, sb = b.totals.success ? 1 : 0;
            if (sa !== sb) return sb - sa;
            const av = col.getSortValue(a), bv = col.getSortValue(b);
            const cmp = (typeof av === 'string') ? av.localeCompare(bv) : (av - bv);
            const primary = sortState.direction === 'asc' ? cmp : -cmp;
            // Tiebreakers: NetWealth → Spendable desc; Spendable → NetWealth desc
            if (primary === 0 && sortState.colKey === 'afterTaxNW' && spendCol) {
                return spendCol.getSortValue(b) - spendCol.getSortValue(a);
            }
            if (primary === 0 && sortState.colKey === 'spend' && afterTaxCol) {
                return afterTaxCol.getSortValue(b) - afterTaxCol.getSortValue(a);
            }
            return primary;
        });
    }

    // Identify per-metric winners. PF13 item 2: pick only from FEASIBLE successful rows - an
    // infeasible (⚠️ bracket-unreachable / ACA-untenable) row could otherwise win a metric and
    // show up green in the Best table even though the plan can't actually be run.
    const successes = results.filter(r => r.totals.success);
    const feasibleSuccesses = successes.filter(r => !(r._isBracketInfeasible || r._isACAUntenable));
    const bestIds = new Set();
    const colWinners = {}; // key -> winning _id
    if (feasibleSuccesses.length > 0) {
        const pick = (arr, fn, isMax) => arr.reduce((a, b) => isMax ? (fn(b) > fn(a) ? b : a) : (fn(b) < fn(a) ? b : a));
        const w1 = pick(feasibleSuccesses, r => r.totals.tax, false);
        const w2 = pick(feasibleSuccesses, r => r.totals.tax / r.totals.gross, false);
        const w3 = pick(feasibleSuccesses, r => r.totals.spend, true);
        const w5 = pick(feasibleSuccesses, r => r.totals.rmdTax / (r.totals.tax || 1), false);
        const w6 = pick(feasibleSuccesses, r => r.afterTaxNW ?? -Infinity, true);
        [w1, w2, w3, w5, w6].forEach(w => bestIds.add(w._id));
        colWinners.tax        = w1._id;
        colWinners.rate       = w2._id;
        colWinners.spend      = w3._id;
        colWinners.rmdtax     = w5._id;
        colWinners.afterTaxNW = w6._id;
        // Earliest Break Even - the year conversions permanently overtake the same strategy without
        // them. Only rows that HAVE a break-even can win: a plan that never converts has none, and
        // the 9999 sort sentinel must not be allowed to look like the earliest year. Ties break on
        // real-dollar after-tax net wealth, the same rule OPTIMIZER_OBJECTIVES.earliestbe uses.
        const beRows = feasibleSuccesses.filter(r => r._convBEYear != null);
        if (beRows.length > 0) {
            // Negative = the first argument is better (earlier year; equal years -> greater wealth).
            const beBetter = (x, y) => (x._convBEYear - y._convBEYear)
                || ((y.afterTaxNWCurrentDollars ?? -Infinity) - (x.afterTaxNWCurrentDollars ?? -Infinity));
            const w7 = beRows.reduce((a, b) => (beBetter(b, a) < 0 ? b : a));
            bestIds.add(w7._id);
            colWinners.convBE = w7._id;
        }
    }

    // Header - flat div cells for CSS grid
    const _hCellStyle = 'background:#f8f9fa;padding:6px 8px;border-bottom:2px solid #dee2e6;white-space:nowrap;font-weight:bold;cursor:pointer;user-select:none;position:sticky;top:0;z-index:1;';
    const headerHtml = columns.map(col => {
        const active = sortState.colKey === col.key;
        const arrow = active ? (sortState.direction === 'asc' ? ' ▲' : ' ▼') : '';
        const tip = col.title ? ` title="${col.title.replace(/"/g, '&quot;')}"` : '';
        // The ⚖ and spacer columns have nothing meaningful to sort on.
        if (col.sortable === false) {
            return `<div style="${_hCellStyle}cursor:default;"${tip}>${col.label}</div>`;
        }
        return `<div style="${_hCellStyle}"${tip} onclick="sortOptimizerBy('${col.key}')">${col.label}${arrow}</div>`;
    }).join('');

    // Rows - display:contents wrapper; each cell carries row styling + onclick
    const rowsHtml = display.map(r => {
        const isWinner = bestIds.has(r._id);
        const isFailed = !r.totals.success;
        const isInfeasible = (r._isBracketInfeasible || r._isACAUntenable) && !isWinner;
        const rowTitle = isFailed
            ? 'Failed - the portfolio ran out of money before the end of the plan (a real shortfall). ACA Cliff and Ordered rows can fail with money still in an account, by design: neither will breach its own constraint to spend it.'
            : isInfeasible
            ? (r._isACAUntenable
                ? ((r._acaBreachYears ?? 0) > 0
                    ? `ACA subsidy cliff: spending cannot be met within the FPL cap in ${r._acaBreachYears} year(s) - plan untenable at this spend (strict ACA never breaches the cap)`
                    : `ACA not applicable - everyone is already on Medicare (age ${TAXData.IRMAA.ELIGIBILITY_AGE}+) at the start, so there is no premium subsidy for a cap to protect. This row simulates as Proportional 0%.`)
                : 'Bracket target exceeded in >50% of years - income sources already push MAGI above this ceiling')
            : 'Click to load this strategy';
        const cells = columns.map(col => {
            const cellWin = (col.key === 'tax'    && r._id === colWinners.tax)
                         || (col.key === 'rate'   && r._id === colWinners.rate)
                         || (col.key === 'spend'  && r._id === colWinners.spend)
                         || (col.key === 'afterTaxNW' && r._id === colWinners.afterTaxNW)
                         || (col.key === 'rmdtax' && r._id === colWinners.rmdtax)
                         || (col.key === 'convBE' && r._id === colWinners.convBE);
            const bg = cellWin    ? '#4CAF5080'
                     : isFailed   ? '#fde0e0'
                     : isInfeasible ? '#e8e8e8'
                     : isWinner   ? '#90EE90'
                     : r._isReverseOptimized ? '#fde8d8'
                     : r._isConvOptimized    ? '#e8f5e9'
                     : r._isSpendOptimized   ? '#dbeafe' : '';
            const extra = isFailed ? 'opacity:0.75;'
                        : isInfeasible ? 'text-decoration:line-through;opacity:0.55;'
                        : isWinner     ? 'font-weight:bold;'
                        : (r._isReverseOptimized || r._isConvOptimized || r._isSpendOptimized) ? 'font-style:italic;' : '';
            const bgCss = bg ? `background-color:${bg};` : '';
            return `<div style="padding:4px 8px;${cellActionCss(col)}${bgCss}${extra}"${cellActionAttrs(col, r, rowTitle)}>${col.getValue(r)}</div>`;
        }).join('');
        return `<div style="display:contents;">${cells}</div>`;
    }).join('');

    // Pinned baseline reference row - best no-conversion / no-cyclic plan. Light-blue tint,
    // sticky under the header; its Δ columns read 0 by definition.
    let baselineRowHtml = '';
    if (baselineRow) {
        const _bCell = 'padding:4px 8px;background-color:#dbeafe;font-weight:bold;position:sticky;top:30px;z-index:1;';
        const bTitle = 'BASELINE - the strongest plan with no Roth conversions and no cyclic brokerage maneuvering. Every other row\'s Δ columns are measured against this. Click to load it.';
        baselineRowHtml = '<div style="display:contents;" id="opt-baseline-row">' + columns.map(col => {
            let v;
            if (col.key === 'strategy')      v = BASELINE_MARK + baselineRow._strategyLabel;
            // Zero only when the baseline IS the reference. With a compare row pinned the baseline
            // has a real Δ like every other row, and printing 0 would be a lie.
            else if ((col.key === 'dNW' || col.key === 'dTax') && !OptimizerState.compareRow) v = '0';
            else v = col.getValue(baselineRow);
            return `<div style="${_bCell}${cellActionCss(col)}"${cellActionAttrs(col, baselineRow, bTitle)}>${v}</div>`;
        }).join('') + '</div>';
    }

    // Pinned 📍 CURRENT PLAN row - the sidebar's own plan. Always rendered, even when it failed or
    // is infeasible: those rows are hidden from the body by default, and the user's own plan being
    // the hidden one is exactly the case worth seeing. It also stays in the ranked body (unlike the
    // ⚓ baseline, whose Δ columns are 0 by definition), so the Rank column still answers "where
    // does my plan actually stand?".
    let currentRowHtml = '';
    const currentRow = results.find(r => r._isCurrentPlan);
    if (currentRow) {
        const curFailed = !currentRow.totals.success;
        const curInfeas = currentRow._isBracketInfeasible || currentRow._isACAUntenable;
        const _cBg = curFailed ? '#fde0e0' : curInfeas ? '#e8e8e8' : '#fff3cd';
        const _cExtra = curFailed ? 'opacity:0.85;' : curInfeas ? 'text-decoration:line-through;opacity:0.7;' : '';
        const _cCell = `padding:4px 8px;background-color:${_cBg};font-weight:bold;position:sticky;top:60px;z-index:1;${_cExtra}`;
        const cTitle = 'YOUR PLAN - the strategy and settings currently in the sidebar, simulated exactly as configured '
            + '(conversions on or off as you have them, your Extra Conversion, your stop year). Every swept row runs with '
            + 'conversions forced on, so none of them is this plan. Click to reload it.'
            + (curFailed ? ' This plan runs out of money before the end.' : '')
            + (curInfeas ? ' This plan\'s bracket/ACA target cannot actually be held.' : '');
        currentRowHtml = '<div style="display:contents;" id="opt-current-row">' + columns.map(col => {
            // Marker first, matching '⚓ …' on the row above. _strategyLabel already carries the 📍
            // prefix (it is what marks the row everywhere else), so it is moved to the front rather
            // than printed twice as '📍 … 📍 …'. The words "BASELINE"/"CURRENT" are not printed: the
            // mark, the row color and the legend already say what these two pinned rows are.
            const _curBare = currentRow._strategyLabel.startsWith(CURRENT_PLAN_MARK)
                ? currentRow._strategyLabel.slice(CURRENT_PLAN_MARK.length)
                : currentRow._strategyLabel;
            const v = col.key === 'strategy' ? CURRENT_PLAN_MARK + _curBare : col.getValue(currentRow);
            return `<div style="${_cCell}${cellActionCss(col)}"${cellActionAttrs(col, currentRow, cTitle)}>${v}</div>`;
        }).join('') + '</div>';
    }

    renderCompareBanner();
    const optTableEl = document.getElementById('opt-table');
    optTableEl.style.gridTemplateColumns = columns.map(() => 'max-content').join(' ');
    optTableEl.innerHTML = headerHtml + baselineRowHtml + currentRowHtml + rowsHtml;
    // Stack the second sticky row directly under the first: the 60px default assumes header +
    // baseline row heights, which depend on the rendered font/zoom, so measure once it is in the DOM.
    if (currentRowHtml) {
        // The row wrappers are display:contents (no box of their own), so measure a CELL, not the
        // wrapper - a wrapper reports offsetHeight 0 and the sticky rows would overlap.
        const _hdrH  = optTableEl.children[0]?.offsetHeight ?? 30;
        const _baseH = document.querySelector('#opt-baseline-row > div')?.offsetHeight ?? 0;
        const _top = _hdrH + _baseH;
        document.querySelectorAll('#opt-current-row > div').forEach(d => { d.style.top = _top + 'px'; });
    }

    // Legend - make the "Infeasible" item a click toggle (rows hidden by default).
    const legendInfeasEl = document.getElementById('opt-legend-infeasible');
    if (legendInfeasEl) {
        const swatch = '<span style="display:inline-block;width:14px;height:14px;background:#e8e8e8;opacity:0.8;border:1px solid #ccc;vertical-align:middle;margin-right:4px;border-radius:2px;text-decoration:line-through;"></span>';
        if (infeasibleCount > 0) {
            const action = showInfeasible ? `click to hide ${infeasibleCount}` : `click to show ${infeasibleCount} hidden`;
            const tip = `Infeasible = the strategy's bracket/IRMAA/ACA target is exceeded in more than half its years (existing income already pushes MAGI above the ceiling). Hidden by default - ${showInfeasible ? 'click to hide them again' : 'click to reveal them'}.`;
            legendInfeasEl.innerHTML = `<span onclick="toggleInfeasibleRows()" title="${tip}" style="cursor:pointer;text-decoration:underline;color:#0969da;">${swatch}Infeasible - ${action}</span>`;
        } else {
            legendInfeasEl.innerHTML = `${swatch}Infeasible - none in this run`;
        }
    }

    // Legend - "Failed" item (rows where the portfolio ran out of money). Hidden by default,
    // click toggles (item 11). Mirrors the Infeasible legend toggle.
    const legendFailedEl = document.getElementById('opt-legend-failed');
    if (legendFailedEl) {
        const swatch = '<span style="display:inline-block;width:14px;height:14px;background:#fde0e0;opacity:0.9;border:1px solid #ccc;vertical-align:middle;margin-right:4px;border-radius:2px;"></span>';
        if (failedCount > 0) {
            const action = showFailed ? `click to hide ${failedCount}` : `click to show ${failedCount} hidden`;
            const tip = `Failed = the portfolio ran out of money before the end of the plan (a real shortfall, 🚨). ACA Cliff and Ordered rows can fail with money still in an account, by design. Hidden by default - ${showFailed ? 'click to hide them again' : 'click to reveal them'}.`;
            legendFailedEl.innerHTML = `<span onclick="toggleFailedRows()" title="${tip}" style="cursor:pointer;text-decoration:underline;color:#0969da;">${swatch}🚨 Failed - ${action}</span>`;
        } else {
            legendFailedEl.innerHTML = `${swatch}🚨 Failed - none in this run`;
        }
    }

    // Best summary table - unique winner rows labeled by what they won
    const bestEl = document.getElementById('opt-best');
    if (bestEl) {
        if (feasibleSuccesses.length > 0) {
            const winnerDefs = [
                { key: 'afterTaxNW', label: '💎 Most FinalWealth',    id: colWinners.afterTaxNW },
                { key: 'spend',  label: '🏆 Most Spendable',   id: colWinners.spend  },
                { key: 'tax',    label: '📉 Lowest Tax',        id: colWinners.tax    },
                { key: 'rate',   label: '📊 Lowest Tax Rate',   id: colWinners.rate   },
                { key: 'rmdtax', label: '📋 Lowest RMD Tax%',   id: colWinners.rmdtax },
                ...(colWinners.convBE != null ? [{ key: 'convBE', label: '⏱ Earliest Break Even', id: colWinners.convBE }] : []),
                ...(OptimizerState.baseline ? [{ key: 'afterTaxNW', label: '⚓ Best w/o Conv', id: OptimizerState.baseline._id }] : []),
            ];
            // Deduplicate: a row can win multiple metrics; show it once under its first/best label
            const seen = new Set();
            const uniqueWinners = winnerDefs.filter(w => {
                if (seen.has(w.id)) return false;
                seen.add(w.id);
                return true;
            });
            const _bHdrStyle = 'background:#f8f9fa;padding:4px 8px;border-bottom:2px solid #dee2e6;font-weight:bold;white-space:nowrap;';
            // By key, not by index. `columns.slice(1)` and `i === 0 ? 'Best' : ...` both encoded
            // "column zero is the ⚖ control" as an unstated assumption, which any change to the
            // column set would be free to break - silently, by shifting every cell one place left
            // under a header that no longer describes it. Naming the column it drops makes the two
            // halves of this table impossible to knock out of alignment with each other.
            const dataCols = columns.filter(c => c.key !== 'compare');
            const bestRows = uniqueWinners.map(w => {
                const r = results.find(x => x._id === w.id);
                if (!r) return '';
                const labelCell = `<div style="background:#A5D6A7;color:#14532d;font-weight:bold;font-size:0.78em;white-space:nowrap;padding:2px 6px;cursor:pointer;" onclick="loadOptimizerResult(${r._id})" title="${w.label} - click to load">${w.label}</div>`;
                const dataCells = dataCols.map(col => {
                    const cellWin = col.key === w.key;
                    const bg = cellWin ? '#4CAF5080' : '#90EE90';
                    let cellVal = col.getValue(r);
                    // Carry the pinned rows' markers into this table so a winner is recognisable as
                    // the SAME row the reader already saw pinned above. The marker alone does that;
                    // repeating "BASELINE -" / "CURRENT -" here would just be noise, and 📍 is
                    // already on the current row's own label.
                    if (col.key === 'strategy' && isBaselineRow(r)) cellVal = BASELINE_MARK + cellVal;
                    return `<div style="padding:4px 8px;background-color:${bg};font-weight:bold;cursor:pointer;" onclick="loadOptimizerResult(${r._id})" title="${w.label} - click to load">${cellVal}</div>`;
                }).join('');
                return `<div style="display:contents;">${labelCell}${dataCells}</div>`;
            }).join('');
            const _bLabelTip = 'Each row is the strategy that wins one metric (the highlighted cell shows which). Click a row to load that strategy.';
            const bestHeader = `<div style="${_bHdrStyle}" title="${_bLabelTip}">Best</div>`
                + dataCols.map(col => {
                    const tip = col.title ? ` title="${col.title.replace(/"/g, '&quot;')}"` : '';
                    return `<div style="${_bHdrStyle}"${tip}>${col.label}</div>`;
                }).join('');
            const _bColsCss = ['max-content', ...dataCols.map(() => 'max-content')].join(' ');
            bestEl.innerHTML = `<div style="display:grid;grid-template-columns:${_bColsCss};width:fit-content;margin-bottom:16px;border:1px solid #dee2e6;">${bestHeader}${bestRows}</div>`;
            bestEl.style.display = 'block';
        } else {
            bestEl.style.display = 'none';
        }
    }

    // Note when all spendable values are the same (fully-funded: every strategy hits the spend goal)
    const noteEl = document.getElementById('opt-note');
    if (noteEl) {
        const spendVals = results.map(r => r.totals.spend);
        const allSame = spendVals.every(v => v === spendVals[0]);
        if (allSame && results.length > 1) {
            noteEl.textContent = 'ℹ️ All strategies show the same Total Spendable - this means every strategy fully funds your spending goal. Differentiate by Lifetime Tax, NetWealth, or Yrs Funded.';
            noteEl.style.display = 'block';
        } else {
            noteEl.style.display = 'none';
        }
    }

    // Optimizer performance: total time + number of strategy runs (always shown).
    const perfEl = document.getElementById('opt-perf');
    if (perfEl) {
        const perf = OptimizerState.perfStats;
        if (perf) {
            perfEl.textContent = `⏱ ${perf.totalMs.toFixed(0)}ms · ${perf.runsCount} runs`;
            perfEl.style.display = 'block';
        } else {
            perfEl.style.display = 'none';
        }
    }
}

// Toggle visibility of infeasible (bracket-unreachable) optimizer rows; re-render in place.
function toggleInfeasibleRows() {
    OptimizerState.showInfeasible = !OptimizerState.showInfeasible;
    if (OptimizerState.results) renderOptimizerTable(OptimizerState.results);
}

function toggleFailedRows() {
    OptimizerState.showFailed = !OptimizerState.showFailed;
    if (OptimizerState.results) renderOptimizerTable(OptimizerState.results);
}

// A sort column can vanish out from under the user: the "Optimize for" goal picks the column set,
// so a column sorted on under one goal may not exist under the next, and the "show all columns"
// escape hatch can be switched back off while sorted by a column only it showed. The old code left
// `col` undefined, skipped the sort block entirely, and rendered the rows in BUILD order under a
// header carrying no arrow - unsorted, and silently so. Falling back to the objective sentinel is
// the honest answer: goal order is what the table shows when nothing else is asked for. Pure, so it
// is assertable without rendering anything.
function normalizeSortState(sortState, columns) {
    const s = sortState ?? { colKey: '__objective__', direction: 'desc' };
    if (s.colKey === '__objective__') return s;
    return columns.some(c => c.key === s.colKey) ? s : { colKey: '__objective__', direction: 'desc' };
}

function sortOptimizerBy(colKey) {
    const s = OptimizerState.sortState ?? { colKey: null, direction: 'asc' };
    if (s.colKey === colKey) {
        s.direction = s.direction === 'asc' ? 'desc' : 'asc';
    } else {
        s.colKey = colKey;
        s.direction = 'asc';
    }
    OptimizerState.sortState = s;
    if (OptimizerState.results) renderOptimizerTable(OptimizerState.results);
}

// Restore inputs from an optimizer row and re-run simulation
function loadOptimizerResult(id) {
    const result = (OptimizerState.results ?? []).find(r => r._id === id);
    if (!result) return;

    // ACA is a strict strategy internally, but the UI keeps it as a "Fill Bracket" sub-option
    // (stratRate=aca<N>) - map it back to the bracket dropdown + ACA stratRate.
    const _isACA = result._strategy === 'aca' || (result._stratACAMultiple ?? 0) > 0;
    document.getElementById('strategy').value = _isACA ? 'bracket' : result._strategy;

    if (result._strategy === 'fixed' && result._nYears != null) {
        document.getElementById('nYears').value = result._nYears;
    } else if (_isACA) {
        document.getElementById('stratRate').value = `aca${result._stratACAMultiple}`;
    } else if (result._strategy === 'bracket' && (result._stratIRMAATier ?? -1) >= 0) {
        document.getElementById('stratRate').value = `IRMAA${result._stratIRMAATier}`;
    } else if (result._strategy === 'bracket' && result._stratRate != null) {
        document.getElementById('stratRate').value = Math.round(result._stratRate * 100);
    } else if (result._strategy === 'propwd' && result._propWithdraw != null) {
        document.getElementById('propWithdraw').value = Math.round(result._propWithdraw * 100);
    } else if (result._strategy === 'fixedpct' && result._iraWithdrawPct != null) {
        document.getElementById('iraWithdrawPct').value = Math.round(result._iraWithdrawPct * 100);
    }

    // Ordered / Guyton-Klinger were never restored: the row recorded no sequence and no guardrails,
    // so loading "Ordered RIBC" set strategy=ordered and left whatever sequence the sidebar already
    // had - the table showed one plan and clicking it ran another (the PF8 bug class). _selection
    // carries the effective values; guard on it so rows from an older cached run still load.
    if (result._selection) {
        if (result._strategy === 'ordered' && result._selection.orderedSeq) {
            const seqEl = document.getElementById('orderedSeq');
            if (seqEl) seqEl.value = result._selection.orderedSeq;
        } else if (result._strategy === 'gk') {
            const gEl = document.getElementById('gkGuard'), aEl = document.getElementById('gkAdjPct');
            if (gEl && result._selection.gkGuard != null) gEl.value = Math.round(result._selection.gkGuard * 100);
            if (aEl && result._selection.gkAdjPct != null) aEl.value = Math.round(result._selection.gkAdjPct * 100);
        }
    }

    document.getElementById('convertExcessToRoth').checked = !!result._convertExcessToRoth;
    const fccEl = document.getElementById('fundConversionWithCash');
    if (fccEl) fccEl.checked = !!result._fundConversionWithCash;
    onConvSubFlagChange();
    const cyclicEl = document.getElementById('cyclicEnabled');
    if (cyclicEl) {
        cyclicEl.checked = !!(result._cyclicEnabled);
        onCyclicChange();
    }
    const cyclicOrderEl = document.getElementById('cyclicOrder');
    if (cyclicOrderEl) cyclicOrderEl.value = result._cyclicOrder ?? 'ira-first';
    // Restore the extra flat annual conversion $ that made a ⇌ (Optimize Conversions) row
    // special. Explicitly zero it for every other row type so a value left over from a
    // previously-loaded ⇌ row doesn't silently linger and misrepresent the newly loaded
    // (non-conversion-optimized) strategy in the opposite direction.
    if ((result._isConvOptimized || result._isCurrentPlan) && result._optConvAmt != null) {
        DisplayHelpers.setDollarValue('extraConversionAmount', Math.round(result._optConvAmt));
    } else {
        DisplayHelpers.setDollarValue('extraConversionAmount', 0);
    }
    // A ⏹YYYY row converts only until that year, so the stop year has to travel with it or the
    // loaded plan converts forever and stops matching the row it came from. Cleared for every
    // other row type for the same reason the amount above is: a leftover stop year would silently
    // truncate the conversions of the next strategy loaded.
    const convEndEl = document.getElementById('convEndYear');
    const convEndModeEl = document.getElementById('convEndMode');
    if (convEndEl) {
        convEndEl.value = ((result._isConvOptimized || result._isCurrentPlan) && result._convEndYear != null)
            ? String(result._convEndYear) : '';
        // A ⇌ row's stop year is always an extra-conversion cutoff; the 📍 current row carries the
        // user's own scope, so it restores that rather than being forced to 'extra'.
        if (convEndModeEl && result._convEndYear != null)
            convEndModeEl.value = result._isCurrentPlan ? (result._convEndMode ?? 'all') : 'extra';
    }
    // For spend-optimized rows, restore the optimized spend goal
    if (result._spendGoal != null) {
        DisplayHelpers.setDollarValue('spendGoal', Math.round(result._spendGoal));
    }
    toggleStrategyUI();
    runSimulation();
    showTab('tab-chart');
}

// //////////////////////////////////////////////////////////////////
// Column category mappings - each column can be in multiple categories
const columnCategories = {
    // Summary - high-level overview
    'year': ['Summary', 'Taxation', 'Balances', 'Income', 'Spending', 'IRA Δ', 'Roth Δ', 'Brokerage Δ', 'Cash Δ', 'Opp. Cost'],
    'age1': ['Summary'],
    'age2': ['Summary'],
    'status': ['Summary', 'Taxation'],
    'spendGoal': ['Summary', 'Income'],
    'netIncome': ['Summary', 'Income'],
    'totalWealth': ['Summary', 'Balances'],
    'totalTax': ['Summary', 'Taxation', 'Income'],
    'NominalRate%': ['Summary', 'Taxation'],
    'surplus': ['Summary', 'Income'],
    'shortfall': ['Summary', 'Income'],

    // Income Sources (could be its own category if you want)
    'SSincome': ['Summary', 'Income'],
    'pension': ['Summary', 'Income'],
    'totalIncome': ['Summary', 'Income'],
    'cashD+I': ['Cash Δ', 'Income'],

    // Balances - end-of-year balances
    'IRA1': ['Balances', 'IRA Δ'],
    'IRA2': ['Balances', 'IRA Δ'],
    'TotalIRA': ['Balances', 'IRA Δ'],
    'Cash': ['Balances', 'Cash Δ'],
    'Roth': ['Balances', 'Roth Δ'],
    'Brokerage': ['Balances', 'Brokerage Δ'],
    'Basis': ['Balances', 'Brokerage Δ'],
    'Spendable': ['Balances'],

    // Taxation
    'MAGI': ['Taxation'],
    'IRMAA': ['Taxation'],
    'Medicare': ['Taxation'],
    'IRMAATier': ['Taxation', 'Summary'],
    'FedTax': ['Taxation'],
    'StateTax': ['Taxation'],
    'CapGains': ['Taxation', 'Brokerage Δ', 'Income'],
    'SumTaxes': ['Taxation'],
    'FedRate%': ['Taxation', 'Summary'],
    'StateRate%': ['Taxation', 'Summary'],
    'FedCap': ['Taxation'],
    'StateCap': ['Taxation'],
    'BracketTarget': ['Taxation'],
    'BracketOverage': ['Taxation'],
    'ForcedIRA': ['Taxation', 'IRA Δ'],

    // IRA Changes - withdrawals, RMDs, and conversions
    'IRA1-': ['IRA Δ', 'Spending'],
    'IRA2-': ['IRA Δ', 'Spending'],
    'IRAwd': ['IRA Δ', 'Income'],
    'RMD%': ['IRA Δ'],
    'RMD1-': ['IRA Δ', 'Spending'],
    'RMD2-': ['IRA Δ', 'Spending'],
    'RMDwd': ['IRA Δ', 'Income'],
    'QCD1': ['IRA Δ', 'Spending'],
    'QCD2': ['IRA Δ', 'Spending'],
    'rothConv': ['IRA Δ', 'Roth Δ', 'Spending', 'Opp. Cost'],  // Conversion comes from IRA; also shown in Opp. Cost view

    // Roth Changes - balance, withdrawals, growth, conversions
    'Roth1': ['Balances', 'Roth Δ'],
    'Roth2': ['Balances', 'Roth Δ'],
    'RothWD': ['Roth Δ', 'Income', 'Spending'],
    'rothG': ['Roth Δ'],

    // Brokerage Changes - balance, withdrawals, gains, growth
    'Brokerage-': ['Brokerage Δ', 'Income', 'Spending'],
    'brokerageG': ['Brokerage Δ'],

    // Cash Changes - balance, withdrawals, growth
    'CashWD': ['Cash Δ', 'Income', 'Spending'],
    'cashG': ['Cash Δ'],
    'surplusCash': ['Cash Δ', 'Income', 'Spending'],
    // Phase 27: inflows/outflows + withdrawal rate
    'grossOut': ['Summary', 'Withdrawals'],
    'netOut':   ['Summary', 'Withdrawals'],
    'inflows':  ['Summary', 'Withdrawals', 'Spending'],
    'wdRate%':  ['Summary', 'IRA Δ'],

    // Debug / performance - only visible under Show All (no checkbox maps to 'Debug')
    'loopMs': ['Debug'],

    // Opportunity cost (Phase 20) + BETR signal (Phase 21) + extra conversion (Phase 23)
    'convOC':    ['Opp. Cost'],
    'excessOC':  ['Opp. Cost'],
    'convTax':   ['Opp. Cost'],
    'excessTax': ['Opp. Cost'],
    'BETR%':     ['Opp. Cost'],
    'betrFlag':  ['Opp. Cost'],
    'extraConv': ['Opp. Cost'],
    // Phase 24: Cyclic
    'subCycle':  ['Summary', 'Brokerage Δ'],
    // Phase 12: Withdrawal timing
    'timing':    ['Summary', 'Withdrawals'],
    // Phase 22: Guyton-Klinger
    'gkSpend':   ['Summary', 'Income'],
    'gkAdj':     ['Summary', 'Income'],
};

// Maps each column key to a visual group label for the group header row
const columnGroupDefs = {
    'year': 'Who', 'age1': 'Who', 'age2': 'Who', 'status': 'Who',
    'SSincome': 'Income', 'pension': 'Income', 'spendGoal': 'Income',
    'netIncome': 'Income', 'totalIncome': 'Income', 'surplus': 'Income',
    'shortfall': 'Income', 'RMDwd': 'Income', 'cashD+I': 'Income',
    'IRAwd': 'Withdrawals', 'IRA1-': 'Withdrawals', 'IRA2-': 'Withdrawals',
    'RMD1-': 'Withdrawals', 'RMD2-': 'Withdrawals',
    'Brokerage-': 'Withdrawals', 'RothWD': 'Withdrawals',
    'CashWD': 'Withdrawals', 'rothConv': 'Withdrawals', 'surplusCash': 'Withdrawals',
    'FedRate%': 'Taxes', 'StateRate%': 'Taxes', 'IRMAATier': 'Taxes',
    'IRMAA': 'Taxes', 'Medicare': 'Taxes', 'totalTax': 'Taxes', 'FedTax': 'Taxes', 'StateTax': 'Taxes',
    'CapGains': 'Taxes', 'MAGI': 'Taxes', 'NominalRate%': 'Taxes',
    'FedCap': 'Taxes', 'StateCap': 'Taxes', 'SumTaxes': 'Taxes',
    'BracketTarget': 'Taxes', 'BracketOverage': 'Taxes', 'ForcedIRA': 'Withdrawals',
    'IRA1': 'Balances', 'IRA2': 'Balances', 'TotalIRA': 'Balances',
    'Roth1': 'Balances', 'Roth2': 'Balances',
    'Cash': 'Balances', 'Roth': 'Balances', 'Brokerage': 'Balances',
    'Basis': 'Balances', 'totalWealth': 'Balances', 'Spendable': 'Balances',
    'brokerageG': 'Balances', 'cashG': 'Balances', 'rothG': 'Balances', 'RMD%': 'Balances',
    'convOC': 'Opp. Cost', 'excessOC': 'Opp. Cost', 'convTax': 'Opp. Cost', 'excessTax': 'Opp. Cost',
    'BETR%': 'Opp. Cost', 'betrFlag': 'Opp. Cost', 'extraConv': 'Opp. Cost',
    'subCycle': 'Withdrawals',
    'grossOut': 'Withdrawals',
    'netOut': 'Withdrawals',
    'inflows': 'Withdrawals',
    'wdRate%': 'Withdrawals',
    'timing': 'Withdrawals',
    'gkSpend': 'Income', 'gkAdj': 'Income',
};

// Get active categories based on checkbox state
function getActiveCategories() {
    const categories = [];
    if (document.getElementById('cat-summary')?.checked) categories.push('Summary');
    if (document.getElementById('cat-balances')?.checked) categories.push('Balances');
    if (document.getElementById('cat-income')?.checked) categories.push('Income');
    if (document.getElementById('cat-taxation')?.checked) categories.push('Taxation');
    if (document.getElementById('cat-ira')?.checked) categories.push('IRA Δ');
    if (document.getElementById('cat-roth')?.checked) categories.push('Roth Δ');
    if (document.getElementById('cat-brokerage')?.checked) categories.push('Brokerage Δ');
    if (document.getElementById('cat-cash')?.checked) categories.push('Cash Δ');
    if (document.getElementById('cat-oppcost')?.checked) categories.push('Opp. Cost');
    if (document.getElementById('cat-spending')?.checked) categories.push('Spending');
    return categories;
}

// Check if a column should be visible based on category filters
function isColumnVisible(columnKey) {
    const showAll = document.getElementById('show-all')?.checked ?? false;

    if (showAll) {
        // Show all columns that are listed in at least one category
        return columnCategories.hasOwnProperty(columnKey);
    }

    const activeCategories = getActiveCategories();

    // Column is not categorized - hide it
    if (!columnCategories.hasOwnProperty(columnKey)) {
        return false;
    }

    // Check if column is in any active category
    const columnCats = columnCategories[columnKey];
    return columnCats.some(cat => activeCategories.includes(cat));
}

// Analyze which columns have content (non-zero, non-empty values)
function analyzeColumnContent(log) {
    if (!log || log.length === 0) return {};

    const keys = Object.keys(log[0]).filter(key => !key.startsWith('-'));
    const columnStatus = {};

    keys.forEach(key => {
        let hasNonZeroValue = false;

        for (const row of log) {
            const value = row[key];

            // Check if value exists and is non-zero
            if (value != null && value !== '' && value !== '—') {
                if (!isNaN(value) && parseFloat(value) !== 0) {
                    hasNonZeroValue = true;
                    break;
                } else if (isNaN(value) && value !== '—') {
                    // Non-numeric non-empty value
                    hasNonZeroValue = true;
                    break;
                }
            }
        }

        columnStatus[key] = hasNonZeroValue;
    });

    return columnStatus;
}

// Global variable to store column content analysis
let columnContentStatus = {};

// Update column visibility without rebuilding the entire table
function updateColumnVisibility() {
    const table = document.getElementById('main-table');
    if (!table) return;

    // Use the last thead row (column names), not the first (group header)
    const allHeaderRows = table.querySelectorAll('thead tr');
    const headerRow = allHeaderRows[allHeaderRows.length - 1];
    const bodyRows = table.querySelectorAll('tbody tr');

    if (!headerRow) return;

    const showEmpty = document.getElementById('show-empty-columns')?.checked ?? false;

    // Get column keys from header
    const headers = Array.from(headerRow.querySelectorAll('th'));

    headers.forEach((th, index) => {
        const columnKey = th.textContent;
        const visibleByCategory = isColumnVisible(columnKey);
        const isEmpty = th.classList.contains('empty-column');

        // Column is visible if it passes category filter AND (has content OR show-empty is checked)
        const visible = visibleByCategory && (showEmpty || !isEmpty);

        // Update header
        if (visible) {
            th.classList.remove('hidden-column');
        } else {
            th.classList.add('hidden-column');
        }

        // Update all body cells in this column
        bodyRows.forEach(row => {
            const cell = row.cells[index];
            if (cell) {
                if (visible) {
                    cell.classList.remove('hidden-column');
                } else {
                    cell.classList.add('hidden-column');
                }
            }
        });
    });

    rebuildGroupRow(table);
    syncTopScroll();
}

// Phase P21: isolate the "Spending" category (unchecks all other cat-* boxes)
function showSpendingOnly() {
    const catIds = ['cat-summary', 'cat-income', 'cat-balances', 'cat-taxation',
        'cat-ira', 'cat-roth', 'cat-brokerage', 'cat-cash', 'cat-oppcost'];
    catIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    const showAll = document.getElementById('show-all');
    if (showAll) showAll.checked = false;
    const spending = document.getElementById('cat-spending');
    if (spending) spending.checked = true;
    updateColumnVisibility();
}

// Rebuild the group header row based on currently visible columns
function rebuildGroupRow(table) {
    const thead = table.tHead;
    if (!thead || thead.rows.length < 2) return;
    const groupRow = thead.rows[0];
    const headerRow = thead.rows[1];
    groupRow.innerHTML = '';

    const groupColors = {
        'Who':          '#e8eaf6',
        'Income':       '#e8f5e9',
        'Withdrawals':  '#fff3e0',
        'Taxes':        '#e3f2fd',
        'Balances':     '#e0f2f1',
    };

    let currentGroup = null;
    let currentSpan = 0;
    let currentCell = null;

    Array.from(headerRow.cells).forEach(th => {
        if (th.classList.contains('hidden-column')) return;
        const key = th.textContent.trim();
        const group = columnGroupDefs[key] ?? '';

        if (group !== currentGroup) {
            if (currentCell !== null) currentCell.colSpan = currentSpan;
            currentGroup = group;
            currentSpan = 1;
            currentCell = document.createElement('th');
            currentCell.textContent = group;
            const bg = groupColors[group] ?? '#f5f5f5';
            currentCell.style.cssText =
                `background:${bg};text-align:center;font-size:0.78em;font-weight:bold;` +
                `border-bottom:1px solid #bbb;padding:2px 4px;`;
            groupRow.appendChild(currentCell);
        } else {
            currentSpan++;
        }
    });
    if (currentCell !== null) currentCell.colSpan = currentSpan;
}

function updateTable(log) {
    const oldTable = document.getElementById('main-table');

    if (!log || log.length === 0) {
        if (oldTable) {
            oldTable.remove();
        }
        return null;
    }

    // Analyze which columns have content
    columnContentStatus = analyzeColumnContent(log);

    const table = document.createElement('table');
    table.border = '1';
    table.id = 'main-table';

    const keys = Object.keys(log[0]);

    // Create header - row 0 is the group banner, row 1 is the column names
    const thead = table.createTHead();
    thead.insertRow(); // group row placeholder - populated by rebuildGroupRow below
    const headerRow = thead.insertRow();

    // Medicare age is stated in three tooltips below; read it from the tax data so the copy
    // cannot drift from the gate that actually charges the surcharge.
    const medAge = TAXData.IRMAA.ELIGIBILITY_AGE;

    const tooltips = {
        'year': 'When yellow, it indicates a single survivor. If the rest of the row is pink, it means the year was underfunded.',
        'age1': 'Age at end of year (Dec 31). Used for RMD eligibility. May differ from current age shown in Profile & Ages if birthday falls late in the year.',
        'age2': 'Spouse age at end of year (Dec 31). Used for RMD eligibility. May differ from current age shown in Profile & Ages if birthday falls late in the year.',
        'RMDwd': 'Total of all Required Minimum Distributions (RMDs)',
        'QCD1': 'Qualified Charitable Distribution from Your IRA. Satisfies RMD requirement and is excluded from taxable income/MAGI (reduces IRMAA exposure). Age 70½+ only.',
        'QCD2': 'Qualified Charitable Distribution from Spouse IRA. Satisfies Spouse RMD requirement and is excluded from taxable income/MAGI (reduces IRMAA exposure). Age 70½+ only.',
        'RMD%': 'The highest percentage RMD required for IRA1 or IRA2.',
        'Brokerage': 'Year end Brokerage balance',
        'Brokerage-': 'Withdrawals from Brokerage account (asset sales/cash withdrawal)',
        'Basis': 'The amount in brokerage which can be withdrawn tax free.',
        'IRAwd': 'Total voluntary IRA withdrawals this year (IRA1- + IRA2-): spending draws plus Roth conversions. Excludes RMD, which is the involuntary draw shown in the RMD columns.',
        'IRA1-': 'Voluntary withdrawals from IRA1 this year: the spending draw plus any Roth conversions sourced from IRA1. Conversions are taken from whichever of the two IRAs is larger first, spilling to the other only when the larger cannot supply the full amount. Excludes RMD (see RMD1-).',
        'IRA2-': 'Voluntary withdrawals from IRA2 this year: the spending draw plus any Roth conversions sourced from IRA2. Conversions are taken from whichever of the two IRAs is larger first, spilling to the other only when the larger cannot supply the full amount. Excludes RMD (see RMD2-).',
        'CapGains': 'Amount of gains from withdrawing brokerage assets.',
        'IRMAA': `Annual IRMAA surcharge based on MAGI from 2 years prior. Charged only for spouses ${medAge}+ (Medicare age).`,
        'IRMAATier': `IRMAA tier (e.g. Tier 1–6) derived from MAGI 2 years ago. Shows -none- until a spouse reaches ${medAge} (Medicare age).`,
        'Medicare': `Base cost for Medicare Parts B + D for spouses ${medAge}+ (grows ~5.6%/yr). Illustration only - not deducted from spendable income; assumed inside the spend goal. Excludes IRMAA (separate column).`,
        'FedCap': 'Upper boundary of the current federal tax bracket.',
        'StateCap': 'Upper boundary of the current state tax bracket.',
        'BracketTarget': 'MAGI ceiling targeted by the bracket/IRMAA strategy this year (0 for other strategies).',
        'BracketOverage': 'Amount MAGI exceeded the bracket target. Non-zero means spending needs pushed above the ceiling.',
        'ForcedIRA': 'Extra IRA withdrawn to fund mandatory spending after Cash, Brokerage and Roth were exhausted. For the Fill Bracket and IRMAA Tier strategies this draw goes above their ceiling, which is what makes those ceilings soft. ACA Cliff never does this while its cap is in force: an IRA withdrawal is taxable income and crossing the cap forfeits the premium subsidy, so it leaves a shortfall instead. Once that cap ends at Medicare it is funded like any other strategy.',
        'spendGoal': 'This amount increases by inflation less Spend Delta%.',
        'Roth': 'Combined Roth balance at year end.',
        'Roth1': "Person 1's Roth balance at year end.",
        'Roth2': "Person 2's Roth balance at year end.",
        'rothG': 'Growth in the Roth (added to Roth account)',
        'rothConv': 'Amount that actually landed in Roth this year (IRA→Roth). A conversion owes tax on the amount converted: unless "Use Cash" (under Maximize Conversions) is on, that tax is taken out of the conversion itself, so this reads LOWER than the gross amount withdrawn (e.g. a $20,000 Extra Annual Roth Conversion lands ~$13,700 at a 31% marginal rate). With cash-funding on, the tax is paid from Cash instead and the full amount lands here. See the extraConv column (Opp. Cost category) for the gross figure.',
        'CashWD': 'Tax free withdrawals from Cash',
        'surplusCash': 'Cash left over after spending and taxes were covered - routed back into the Cash account (or on to Roth conversion if Max Conversion is enabled).',
        'cashD+I': 'Dividends (from brokerage) and interest from Cash (deposits)',
        'MAGI': 'Modified Adjusted Gross Income - determines future IRMAA',
        'totalTax': 'Federal, State, IRMAA, NIIT, and CapGains taxes - in total.',
        'SumTaxes': 'Running total of Federal, State, IRMAA, NIIT, and CapGains taxes.',
        'shortfall': 'How much income is missing, that is: spendGoal - (totalIncome - totalTax). Normally it means the plan ran out of money: every other account was spent and the IRA could not cover the rest. Two strategies report it by design instead. ACA Cliff will not cross its income cap while that cap is in force, because crossing it forfeits the premium subsidy. Ordered will not step outside the account sequence you chose, so it can leave a small residual while a later account still holds money.',
        'totalIncome': 'Funds from all sources, taxable and tax-free.',
        'NominalRate%': 'TotalTax/TotalGrossIncome for all taxes - Fed, State, IRMAA',
        'convOC': 'Roth Conversion Opportunity Cost: this plan\'s after-tax total wealth minus the same plan re-simulated with no conversions (the dollars stay in the IRA, no conversion tax is paid, and the bigger IRA pays its own larger RMD taxes and IRMAA later). Positive = the conversions have paid off by this year. The Break Even stat is the year the plan permanently pulls ahead and stays ahead for the rest of the plan, not just the first year that happens to touch non-negative.',
        'excessOC': 'Excess Withdrawal Opportunity Cost: same comparison as Conv OC but for surplus IRA withdrawals banked to Cash. The no-action plan keeps those dollars in the IRA. Positive = having the extra cash out early beat leaving it in the IRA. Same "permanently ahead" Break Even definition as Conv OC.',
        'convTax': 'Incremental federal + state tax attributable to this year\'s Roth conversion (true marginal method: re-runs tax calculation without the conversion and takes the difference). Does not include IRMAA.',
        'excessTax': 'Incremental federal + state tax attributable to this year\'s excess IRA withdrawal routed to Cash (same method as Conv Tax).',
        'BETR%': 'Break-Even Tax Rate (Kitces formula): t_now × (1 + r_taxable)^n / (1 + r_ira)^n. The future marginal rate at which converting now is tax-neutral vs leaving in IRA. If your expected future rate (Future IRA Tax %) exceeds BETR → conversion advantageous (▲). When r_taxable < r_ira (taxable drag), BETR falls below current rate, making conversion even more compelling. Treat this as a conversation-starter, not a decision rule: it is a closed-form estimate that ignores surplus routing and the RMD/IRMAA/Social Security cascade, and testing showed it can err in either direction. Trust the Break Even column instead.',
        'betrFlag': '▲ = expected future rate exceeds BETR by >2pp → conversion beneficial. ▼ = expected future rate is below BETR → conversion costly. ≈ = within 2pp either way (marginal).',
        'extraConv': 'Gross IRA amount additionally withdrawn and converted to Roth, independent of spending strategy. Sourced from the larger IRA first, and included in the IRA WD / IRA1-/IRA2- withdrawal totals. Taxes come from IRA gross (net Roth credit = extraConv − incremental tax) unless "Use Cash" funds the tax so the full gross lands in Roth.',
        'subCycle': 'Cyclic sub-cycle marker. Brok = brokerage harvest year (spending drawn from Brokerage; IRA free for conversions). IRA = IRA draw year (normal IRA withdrawal). ⚠Brok = brokerage harvest year but balance was below 50% of target - fell back to partial IRA draw.',
        'grossOut': 'Gross outflows: all account withdrawals this year (IRA + RMD + Brokerage + Cash + Roth), including amounts converted to Roth.',
        'netOut': 'Net outflows: portfolio draws funding spending/taxes. Gross outflows minus Roth conversions and reinvested surplus. Zero when Social Security and pension cover everything, since a forced RMD that gets reinvested never leaves the portfolio.',
        'inflows': 'Non-portfolio income applied to spending: Social Security + pension.',
        'wdRate%': 'Withdrawal rate: net outflows ÷ start-of-year portfolio balance, so it measures what actually left the portfolio to fund spending and taxes. Roth conversions and reinvested surplus are excluded. Social Security and pension are NOT subtracted (see the inflows column for those), which is what makes this comparable to the classic "4% rule" target of ~4%.',
        'timing': 'Withdrawal timing auto-selected each year. Early(Conv) = conversion year (withdrawal in 1st quarter, ideally January - maximizes Roth compounding). Late(Spend) = spending-only year (withdrawal in last quarter, ideally December - full portfolio compounds before withdrawal exits, gaining D×r per year).',
    };

    keys.forEach(key => {
        if (!key.startsWith('-')) {
            const th = document.createElement('th');
            const displayKey = key.endsWith('!') ? key.slice(0, -1) : key;
            th.textContent = displayKey;

            if (tooltips[key]) {
                th.title = tooltips[key];
            }

            // Apply visibility based on category filter AND empty column filter
            const visibleByCategory = isColumnVisible(displayKey);
            const hasContent = columnContentStatus[key];
            const showEmpty = document.getElementById('show-empty-columns')?.checked ?? false;

            if (!visibleByCategory || (!hasContent && !showEmpty)) {
                th.classList.add('hidden-column');
            }

            // Mark empty columns for styling
            if (!hasContent) {
                th.classList.add('empty-column');
            }

            headerRow.appendChild(th);
        }
    });

    // Create body
    const tbody = table.createTBody();
    let maritalStatus = 'MFJ';
    log.forEach((row, i) => {
        const tr = tbody.insertRow();

        // Check conditions for highlighting
        const spendGoal = row['SpendGoal'] ?? row['spendGoal'];
        const netIncome = row['NetIncome'] ?? row['netIncome'];
        const totalWealth = row['TotalWealth'] ?? row['totalWealth'];
        const age1 = row['Age1'] ?? row['age1'];
        const age2 = row['Age2'] ?? row['age2'];

        // Underfunded when income falls short, or portfolio can't cover its required draw.
        const rowGuaranteed = row['guaranteedIncome'] ?? 0;
        const rowPortfolio  = row['portfolioBalance'] ?? (totalWealth ?? 0);
        const rowRequired   = Math.max(0, spendGoal - rowGuaranteed);
        const incomeShortfall = (netIncome < spendGoal * 0.99) || (rowPortfolio < rowRequired);
        const deathOccurred = maritalStatus != row['status'];

        // IRMAA tier cell tint - blue scale (taxation theme), applied only to relevant columns
        const IRMAATierColors = {
            'Tier 1': ['#E8F4FF', '#000'], 'Tier 2': ['#BDD9FF', '#000'], 'Tier 3': ['#90BBFF', '#000'],
            'Tier 4': ['#6090FF', '#000'], 'Tier 5': ['#3366FF', '#fff'], 'Tier 6 (TOP)': ['#0000FF', '#fff'],
        };
        const tierEntry = IRMAATierColors[row['IRMAATier']];
        const _IRMAACols = ['year', 'IRMAATier', 'totalIncome', 'IRMAA', 'totalTax'];

        // Pink takes priority over tier color
        if (incomeShortfall) {
            tr.style.backgroundColor = '#ffb6c180';  // Light pink
            tr.style.color = '';  // reset to default dark text
        }

        // Apply cell-level yellow highlighting for death occurred
        const deathHighlightCols = ['year', 'age1', 'age2', 'status', 'SSincome'];

        keys.forEach(key => {
            if (!key.startsWith('-') && key !== 'inflationFactor') {
                const td = tr.insertCell();
                const value = row[key];

                if (tierEntry && !incomeShortfall && _IRMAACols.includes(key)) {
                    td.style.backgroundColor = tierEntry[0];
                    td.style.color = tierEntry[1];
                }
                if (deathOccurred && deathHighlightCols.includes(key.toLowerCase())) {
                    td.style.backgroundColor = '#ffff99';  // Light yellow
                    td.style.color = '';
                }
                if ((key === 'BracketOverage' || key === 'netIncome') && (row['BracketOverage'] ?? 0) > 0) {
                    td.style.backgroundColor = '#ff8c0099';  // Orange - MAGI exceeded bracket ceiling
                }
                if (key === 'totalTax' || key === 'year') {
                    td.style.cursor = 'pointer';
                    td.style.textDecoration = 'underline dotted';
                    td.title = 'Click to open Tax Payment Planner for this year';
                    td.onclick = () => openTaxPlanner(row, i > 0 ? log[i - 1] : null);
                }

                // Check if key indicates percentage
                const isPercent = key.toLowerCase().includes('%');
                const isYear = key.toLowerCase().includes('yr') || key.toLowerCase().includes('year');

                if (value != null && !isNaN(value)) {
                    if (isPercent) {
                        // Format as percentage (convert from decimal)
                        td.textContent = (value * 100).toFixed(2);
                    } else {
                        // Format as whole number
                        if (isYear) {
                            td.textContent = value;
                        } else {
                            const inCurrentDollars = document.getElementById('show-current-dollars')?.checked;
                            const displayValue = inCurrentDollars ? value / (row.inflationFactor || 1) : value;
                            td.textContent = Math.round(displayValue).toLocaleString();
                        }
                    }
                } else {
                    // Normalize IRMAATier base value for display
                    td.textContent = (key === 'IRMAATier' && (value === '-none-' || value === '-'))
                        ? '—'
                        : (value ?? '');
                }

                // Apply visibility based on category filter AND empty column filter
                const displayKey = key.endsWith('!') ? key.slice(0, -1) : key;
                const visibleByCategory = isColumnVisible(displayKey);
                const hasContent = columnContentStatus[key];
                const showEmpty = document.getElementById('show-empty-columns')?.checked ?? false;

                if (!visibleByCategory || (!hasContent && !showEmpty)) {
                    td.classList.add('hidden-column');
                }

                // Mark empty columns for styling
                if (!hasContent) {
                    td.classList.add('empty-column');
                }

                tr.appendChild(td);
            }
        });
    });

    rebuildGroupRow(table);

    if (oldTable) {
        oldTable.replaceWith(table);
    }

    syncTopScroll();
    return table;
}

// #2 - keep the mirror scrollbar above the Annual Details table sized and toggled correctly.
// Sets the spacer width to the table's scrollWidth and hides the strip when nothing overflows.
function syncTopScroll() {
    const table  = document.getElementById('main-table');
    const top    = document.getElementById('tbl-top-scroll');
    const inner  = document.getElementById('tbl-top-scroll-inner');
    const bottom = document.getElementById('tbl-scroll');
    if (!table || !top || !inner || !bottom) return;
    const w = table.scrollWidth;
    inner.style.width = w + 'px';
    top.style.display = w > bottom.clientWidth + 1 ? '' : 'none';
}

// Wire bidirectional scroll sync between the mirror strip and the table scroller. Called once.
let _topScrollWired = false;
function setupTopScrollSync() {
    if (_topScrollWired) return;
    const top    = document.getElementById('tbl-top-scroll');
    const bottom = document.getElementById('tbl-scroll');
    if (!top || !bottom) return;
    let syncing = false;
    top.addEventListener('scroll', () => {
        if (syncing) return; syncing = true; bottom.scrollLeft = top.scrollLeft; syncing = false;
    });
    bottom.addEventListener('scroll', () => {
        if (syncing) return; syncing = true; top.scrollLeft = bottom.scrollLeft; syncing = false;
    });
    window.addEventListener('resize', syncTopScroll);
    _topScrollWired = true;
}


function openTaxPlanner(row, prevRow) {
    const p = new URLSearchParams();

    const set = (k, v) => { if (v != null && v !== '' && !isNaN(v)) p.set(k, Math.round(v)); };
    const setF = (k, v) => { if (v != null && v !== '' && !isNaN(v)) p.set(k, v); };

    set('taxYear', row.year);
    set('federalTax', row.FedTax);
    set('stateTax', row.StateTax);
    if (prevRow) {
        set('priorYearFedTax', prevRow.FedTax);
        set('priorYearStateTax', prevRow.StateTax);
    }
    set('ssIncome', row.SSincome);
    set('pensionIncome', row.pension);
    set('interest', row.cashInterest);
    set('qualifiedDivs', row.cashDividends);
    set('capitalGains', row.CapGains);
    set('ira1Rmd', row['RMD1-']);
    set('ira2Rmd', row['RMD2-']);
    // Accurate per-IRA decomposition (from the engine's own accounting): voluntary = spending-only
    // draw per IRA; RothConversion = actual gross converted per IRA (conv reallocation + extra +
    // gross-up, sourced prefer-larger). RMD is passed separately above.
    set('ira1Voluntary', row['-iraVolSpend1']);
    set('ira2Voluntary', row['-iraVolSpend2']);
    set('ira1RothConversion', row['-iraConvGross1']);
    set('ira2RothConversion', row['-iraConvGross2']);

    const marginalOrd = ((row['FedRate%'] || 0) + (row['StateRate%'] || 0)) * 100;
    if (marginalOrd > 0) setF('marginalOrdRate', marginalOrd.toFixed(1));

    // Brokerage position, in dollars. The planner needs the unrealized-gain SHARE to price
    // "raise the tax money by selling brokerage", and it used to be stuck on its own hardcoded
    // 40% because this handoff never sent anything: neither the position nor the LTCG rate was in
    // the URL, so editing the basis here changed nothing over there. Both amounts are already on
    // the row, and (Brokerage - Basis) / Brokerage is the same ratio the engine itself keeps as
    // yr.capGainsPercentage.
    set('bv', row.Brokerage);
    set('bb', row.Basis);

    // Blended LTCG rate = federal capital-gains rate plus the state marginal rate, which is the
    // same blend optimizer_core applies to a brokerage withdrawal (capitalGainsRate +
    // nominalStateTaxAtLimit). Most states tax long-term gains as ordinary income; the handful
    // with preferential treatment will come out slightly high. Clamped to the input's 0-40 range.
    const cgBlended = ((row['-capGainsRate'] || 0) + (row['StateRate%'] || 0)) * 100;
    if (cgBlended > 0) setF('cgr', Math.min(40, cgBlended).toFixed(1));

    // IRC 6654(d)(1)(C) raises the safe harbor to 110% when the PRIOR year's AGI exceeded
    // $150,000, so this reads prevRow, not row -- the same row priorYearFedTax comes from. MAGI is
    // the closest thing the log carries to AGI; they differ by the MAGI add-backs, which matters
    // only for a filer sitting within those add-backs of the threshold.
    if (prevRow && (prevRow.MAGI || 0) > 150000) p.set('hi', '1');

    const stateEl = document.getElementById('STATEname');
    if (stateEl?.value) p.set('state', stateEl.value);

    const growthEl = document.getElementById('growth');
    if (growthEl?.value) setF('portfolioRate', parseFloat(growthEl.value));

    const cashYieldEl = document.getElementById('cashYield');
    if (cashYieldEl?.value) setF('hysaGross', parseFloat(cashYieldEl.value));

    window.open('RetirementTaxPlanner.html?' + p.toString(), '_blank');
}




function updateStats(totals, finalNW, finalNWCurrentDollars = finalNW, minNetWorth = 100000) {
    const inCD = document.getElementById('show-current-dollars')?.checked;
    const dispTax   = inCD ? totals.taxCurrentDollars   : totals.tax;
    const dispSpend = inCD ? totals.spendCurrentDollars : totals.spend;
    const dispNW    = inCD ? finalNWCurrentDollars      : finalNW;
    const dispRate  = totals.tax / totals.gross;

    document.getElementById('stat-rate').innerText  = (dispRate * 100).toFixed(1) + '%';
    document.getElementById('stat-spend').innerText = '$' + Math.round(dispSpend).toLocaleString();
    document.getElementById('stat-tax').innerText   = '$' + Math.round(dispTax).toLocaleString();
    document.getElementById('stat-nw').innerText    = '$' + Math.round(dispNW).toLocaleString();
    const rmdEl = document.getElementById('stat-rmd');
    const rmdPctEl = document.getElementById('stat-rmd-pct');
    if (rmdEl) rmdEl.innerText = '$' + Math.round(totals.rmd ?? 0).toLocaleString();
    if (rmdPctEl) {
        const rmdPctStr = totals.tax > 0 ? `${((totals.rmdTax ?? 0) / totals.tax * 100).toFixed(0)}% of taxes` : '';
        const qcdStr = (totals.qcd ?? 0) > 0 ? ` | QCD $${Math.round(totals.qcd).toLocaleString()}` : '';
        rmdPctEl.innerText = rmdPctStr + qcdStr;
    }
    const yearsEl = document.getElementById('stat-years');
    if (yearsEl) {
        yearsEl.innerText = totals.yearsfunded + '/' + totals.yearstested;
        const fullyFunded = totals.yearsfunded >= totals.yearstested && finalNW > minNetWorth;
        yearsEl.style.color = fullyFunded ? '' : '#c0392b';
    }
    const changeEl = document.getElementById('stat-success');
    if (changeEl) changeEl.innerText = _lastChangedInputLabel ? '↺ ' + _lastChangedInputLabel : '';
    const convBEEl = document.getElementById('stat-conv-be');
    if (convBEEl) convBEEl.innerText = totals.convBEYear ?? '—';
    // Break Even ⓘ - now a SEARCHED stop-year suggestion, not just a "why blank" explanation.
    // Evidence (findings.md, 2026-07-23) proved (a) stopping conversions partway can beat both
    // converting to the end and converting nothing, and (b) the old boundary-year text named the
    // WRONG year (off $662k). So whenever conversions occur we run bestConversionStopYear and lead
    // with the year that maximizes after-tax wealth + its dollar gain; the old boundary diagnosis
    // is demoted to secondary color, shown only when Break Even is actually blank. Computed eagerly
    // so hovering reveals it with no click. Cost: n+1 cheap runs + 1 OC re-run, well under a
    // runSimulation(), same order as the prior diagnostic scan.
    const diagIcon = document.getElementById('stat-conv-be-diagnose');
    const diagResultEl = document.getElementById('stat-conv-be-diagnose-result');
    if (diagIcon && diagResultEl) {
        _beDiagnosisMsg = '';
        _beStopSuggestion = null;
        const _hasConversions = lastSimulationLog?.some(r => (r.rothConv ?? 0) > 1) ?? false;
        if (_hasConversions && lastSimInputs) {
            try {
                const mode = lastSimInputs.convEndMode === 'extra' ? 'extra' : 'all';
                const sugg = bestConversionStopYear(lastSimInputs, { mode });
                // Secondary color, only when Break Even is blank: which conversion erased the lead.
                let boundaryNote = '';
                if (totals.convBEYear == null) {
                    const diag = diagnoseConvBreakEvenFailure(lastSimInputs, lastSimulationLog);
                    if (diag) boundaryNote = formatBreakEvenDiagnosis(diag);
                }
                const built = formatStopYearMessage(sugg, boundaryNote, mode);
                _beDiagnosisMsg = built.msg;
                _beStopSuggestion = built.suggestion;
            } catch (e) {
                console.error('Stop-year suggestion failed:', e);
            }
        }
        diagIcon.style.display = _beDiagnosisMsg ? '' : 'none';
        diagIcon.title = _beDiagnosisMsg;
        // Collapse any previously-expanded text: it belongs to the prior run's numbers.
        diagResultEl.innerHTML = '';
        diagResultEl.style.display = 'none';
    }

    const avgSpendEl = document.getElementById('stat-avg-spend-rate');
    if (avgSpendEl) {
        avgSpendEl.innerText = (totals.avgWdRate != null)
            ? (totals.avgWdRate * 100).toFixed(1) + '%' : '—';
        // Tile shows the simple mean; the other two framings go in the tooltip so the single
        // headline number can't be mistaken for the whole picture. The tile div owns the title.
        const wdTile = avgSpendEl.closest('div[title]');
        if (wdTile) {
            const pct = v => (v != null) ? (v * 100).toFixed(1) + '%' : '—';
            wdTile.title = 'Portfolio withdrawals funding spending and taxes, divided by the '
                + 'start-of-year portfolio balance. Roth conversions and reinvested surplus are '
                + 'excluded; Social Security and pension are not subtracted. The classic 4% rule '
                + 'targets ~4%. See the wdRate% column in Annual Details.'
                + '\n\nShown: simple average of the yearly rates, ' + pct(totals.avgWdRate) + '.'
                + '\nDollar-weighted (total withdrawn ÷ total portfolio): ' + pct(totals.avgWdRateWeighted) + '.'
                + '\nNet depletion (withdrawal rate minus portfolio return): ' + pct(totals.avgNetDepletion)
                + '. Negative means the portfolio grew faster than it was drawn down.';
        }
    }

    // Delta vs previous run
    if (_prevStatsTotals) {
        const pTax   = inCD ? _prevStatsTotals.taxCurrentDollars   : _prevStatsTotals.tax;
        const pSpend = inCD ? _prevStatsTotals.spendCurrentDollars : _prevStatsTotals.spend;
        const pNW    = inCD ? _prevStatsFinalNWCD                  : _prevStatsFinalNW;
        const pRate  = _prevStatsTotals.tax / _prevStatsTotals.gross;

        function fmtDelta(cur, prev, preferHigh) {
            const d = Math.round(cur - prev);
            if (d === 0) return '';
            const good = preferHigh ? d > 0 : d < 0;
            const clr = good ? '#1a7a1a' : '#c0392b';
            return `<span style="color:${clr}">${d > 0 ? '+' : ''}${d.toLocaleString()}</span>`;
        }
        function fmtDeltaPct(cur, prev, preferHigh) {
            const d = cur - prev;
            if (Math.abs(d) < 0.00005) return '';
            const good = preferHigh ? d > 0 : d < 0;
            const clr = good ? '#1a7a1a' : '#c0392b';
            return `<span style="color:${clr}">${d > 0 ? '+' : ''}${(d * 100).toFixed(2)}%</span>`;
        }

        const yD = document.getElementById('stat-years-delta');
        const rD = document.getElementById('stat-rate-delta');
        const tD = document.getElementById('stat-tax-delta');
        const sD = document.getElementById('stat-spend-delta');
        const nD = document.getElementById('stat-nw-delta');
        if (yD) yD.innerHTML = fmtDelta(totals.yearsfunded, _prevStatsTotals.yearsfunded, true);
        if (rD) rD.innerHTML = fmtDeltaPct(dispRate, pRate, false);
        if (tD) tD.innerHTML = fmtDelta(dispTax, pTax, false);
        if (sD) sD.innerHTML = fmtDelta(dispSpend, pSpend, true);
        if (nD) nD.innerHTML = fmtDelta(dispNW, pNW, true);
    }

    _prevStatsTotals    = { ...totals };
    _prevStatsFinalNW   = finalNW;
    _prevStatsFinalNWCD = finalNWCurrentDollars;
}

// Phase 23: update projected-RMD stats in the stats bar.
// RMD divisors come from RMD_TABLE in taxengine.js (full table, ages 72–120).
// Reads IRA balances, birth years, and growth rate from DOM inputs - no totals arg needed.
// Formats a diagnoseConvBreakEvenFailure() result as a plain-English explanation.
function formatBreakEvenDiagnosis(diag) {
    const _fmt = (n) => '$' + Math.round(n).toLocaleString();
    let msg;
    if (diag.outcome === 'neverSustains') {
        msg = `The first conversion, in ${diag.breakingYear} (${_fmt(diag.breakingAmount)}), never earns back its own tax cost by the end of the plan.`;
    } else {
        msg = `Conversions through ${diag.lastSustainableYear} would have broken even in ${diag.lastSustainableBEYear}. The ${diag.breakingYear} conversion (${_fmt(diag.breakingAmount)}) is the one that erases the lead for good.`;
    }
    if (diag.futureIRATaxRateUnset) {
        msg += ' (Valued at each year\'s own tax bracket -- set a Marginal Heirs Tax Rate in Assumptions for a steadier comparison.)';
    }
    return msg;
}

// Turns a bestConversionStopYear() result into the ⓘ headline + a one-click suggestion object.
// Leads with the searched year and its dollar gain (findings.md §7: never show a bare year -- the
// gain is what tells low-tax-state users a nearby year is worthless). `boundaryNote` is the old
// which-conversion-erased-the-lead sentence, appended as secondary color only when Break Even is
// blank. Returns { msg, suggestion } where suggestion is { year, mode } for the one-click apply,
// or null when there is nothing actionable to click (converting through the end is already best,
// or converting nothing is best -- the latter has no natural "stop after YEAR" the field expresses).
function formatStopYearMessage(sugg, boundaryNote, mode) {
    if (!sugg) return { msg: boundaryNote || '', suggestion: null };
    const _m = (n) => '$' + Math.round(n).toLocaleString();
    const scopeWord = mode === 'extra' ? 'the extra conversion' : 'conversions';
    let msg = '', suggestion = null;
    if (sugg.stopYearCalendar != null && sugg.gainVsFull > 1) {
        msg = `Stopping ${scopeWord} after ${sugg.stopYearCalendar} keeps about ${_m(sugg.gainVsFull)} more after-tax than converting to the end`;
        if (sugg.gainVsNone > 1) msg += `, and ${_m(sugg.gainVsNone)} more than never converting`;
        msg += '.';
        suggestion = { year: sugg.stopYearCalendar, mode };
    } else if (sugg.convertsNothingIsBest && sugg.gainVsFull > 1) {
        msg = `Converting nothing keeps about ${_m(sugg.gainVsFull)} more after-tax than this plan's ${scopeWord}. Consider turning ${mode === 'extra' ? 'the Extra Annual Roth Conversion' : 'conversions'} off.`;
    }
    // else: neverStopIsBest -- converting through the end is already best; no stop-year to suggest.
    if (boundaryNote) msg = msg ? (msg + ' ' + boundaryNote) : boundaryNote;
    return { msg, suggestion };
}

// Applies a suggested conversion stop year to the sidebar input and re-runs. convEndYear is a
// plain text field (not a DisplayHelpers dollar field), so a direct .value set is what getInputs
// reads.
function applyConvStopYear(year, mode) {
    const yearEl = document.getElementById('convEndYear');
    const modeEl = document.getElementById('convEndMode');
    if (!yearEl) return;
    yearEl.value = String(year);
    if (modeEl && mode) modeEl.value = mode;
    _lastChangedInputLabel = 'Stop Conversions';
    if (typeof runSimulation === 'function') runSimulation();
}

// The Break Even stop-year message for the current run, computed in updateStats(). Held here so
// the ⓘ can toggle it inline without recomputing.
let _beDiagnosisMsg = '';
// The one-click suggestion { year, mode } for the current run, or null. Set alongside the message.
let _beStopSuggestion = null;

// Click the ⓘ to expand the suggestion inline; click again to collapse it. The same text is
// always on the icon's title, so hovering reveals it without clicking at all. When a stop year is
// actionable, an "Apply" link is appended that sets the field and re-runs.
function toggleBreakEvenDiagnosis() {
    const el = document.getElementById('stat-conv-be-diagnose-result');
    if (!el || !_beDiagnosisMsg) return;
    const isOpen = el.style.display !== 'none';
    if (isOpen) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = '';
    el.textContent = _beDiagnosisMsg;
    if (_beStopSuggestion && _beStopSuggestion.year != null) {
        const y = _beStopSuggestion.year, m = _beStopSuggestion.mode;
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = `Stop after ${y} ▸`;
        link.style.cssText = 'display:inline-block;margin-top:4px;cursor:pointer;color:#2980b9;text-decoration:underline;';
        link.addEventListener('click', (e) => { e.preventDefault(); applyConvStopYear(y, m); });
        el.appendChild(document.createElement('br'));
        el.appendChild(link);
    }
}


let lastSimulationLog = null;
let lastSimInputs = null;
let lastTotals = null, lastFinalNW = null, lastFinalNWCurrentDollars = null;
let _prevStatsTotals = null, _prevStatsFinalNW = null, _prevStatsFinalNWCD = null;
let _lastChangedInputLabel = null;
let assetChart, incomeChart;

// Crosshair plugin - vertical dashed line at the active x position
const crosshairPlugin = {
    id: 'crosshair',
    afterDraw(chart) {
        if (chart.tooltip?._active?.length) {
            const x = chart.tooltip._active[0].element.x;
            const { top, bottom } = chart.chartArea;
            const ctx = chart.ctx;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.restore();
        }
    }
};

// #7 - milestone overlay. Draws labeled vertical lines at significant plan events. Shared by both
// charts; reads module-level `showMilestones` (toggle) and `_chartMilestones` (computed per run).
// On by default.
let showMilestones = true;
let _chartMilestones = [];
// #8 Taxation view - overlay federal-bracket / IRMAA-tier threshold lines that MAGI actually crosses.
// On by default.
let showTaxThresholds = true;

// Half / full basis step-up mark for a death milestone, DRAWN rather than typed. The obvious
// approach is to append a character to the label, but the Unicode geometric shapes will not
// cooperate: at the chart's 10px, U+25D0 (half) inks 9x7 while U+25CF (full) inks 6x4, so "full"
// would render a third SMALLER than "half" and read backwards. Its family (U+25D0..U+25D7) has no
// fully-black member to pair with, so no same-size pair exists to switch to. Drawing both from one
// radius makes them identical by construction, matches the marker's own colour exactly, and does
// not depend on what `sans-serif` resolves to on the reader's machine.
// The outline is deliberately THIN. It is drawn on both so the two glyphs share an outer diameter,
// but it also lays ink on the empty side of the half glyph, which is the only side the eye can use
// to tell them apart. Measured at r=4: a 0.75 outline leaves 42% less ink on the right-hand side
// for the half than for the full, against 36% at 1.0 and 33% at 1.25. Thinner is clearer here.
function drawStepUpGlyph(ctx, x, y, r, full, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.75;
    ctx.stroke();                        // outline on both, so the half reads as a circle
    ctx.beginPath();
    if (full) ctx.arc(x, y, r, 0, Math.PI * 2);
    else ctx.arc(x, y, r, Math.PI / 2, Math.PI * 1.5);   // canvas y is down: this is the LEFT half
    ctx.fillStyle = color;
    ctx.fill();
}

const milestonePlugin = {
    id: 'milestones',
    afterDatasetsDraw(chart) {
        if (!showMilestones || !_chartMilestones.length) return;
        // Milestones come from the last single-strategy run. The main charts show all of them;
        // the Monte Carlo fan aggregates many strategies/paths, so only the markers that are
        // deterministic across every path apply there - death (fixed life expectancy), the
        // RMD-start ages (fixed birth years) and the Social Security start years (fixed birth
        // years and claiming ages). IRMAA/GK/shortfall/break-even differ per path.
        // All other charts (MC input fans, etc.) get none.
        const canvasId = chart.canvas?.id || '';
        let milestones = _chartMilestones;
        // Deaths are matched on the stepUp flag, not on the label. They used to read "Your Passing"
        // and be caught by the regex; the labels are now "You"/"Spouse"/"Both", which no word test
        // can distinguish from a future marker without one. The flag is set on death markers only.
        if (canvasId === 'mc-chart') milestones = milestones.filter(m => m.stepUp || /RMDs begin|SS begins/.test(m.label));
        else if (canvasId !== 'chartAssets' && canvasId !== 'chartIncomeSources') return;
        if (!milestones.length) return;
        const xScale = chart.scales.x;
        if (!xScale) return;
        const { top, bottom, left, right } = chart.chartArea;
        const mid = (left + right) / 2;
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = '600 10px sans-serif';
        const GLYPH_R = 4, MAX_ROWS = 4, ROW_H = 12;
        // Assign label rows BEFORE drawing any of them. The rule used to be row = i % 3, which is
        // blind to where the labels actually sit: two markers twenty years apart could share a row
        // harmlessly while two adjacent ones landed on top of each other. That is what happened to
        // the two death markers in the default plan - list positions 2 and 5, so the same row, but
        // only one year apart on the axis. Rows are now taken by measuring real pixel extents, so a
        // row is reused only when it is genuinely clear.
        const rowEnds = [];
        const placed = milestones.map(m => {
            const px = xScale.getPixelForValue(m.x);
            if (px == null || isNaN(px)) return null;
            const onRight = px > mid;
            const w = ctx.measureText(m.label).width + (m.stepUp ? GLYPH_R * 2 + 3 : 0);
            const x0 = onRight ? px - 3 - w : px + 3;
            let row = 0;
            while (row < MAX_ROWS && rowEnds[row] != null && x0 < rowEnds[row] + 4) row++;
            if (row >= MAX_ROWS) row = MAX_ROWS - 1;   // out of rows: stack on the last and accept it
            rowEnds[row] = Math.max(rowEnds[row] ?? -Infinity, x0 + w);
            return { m, px, onRight, row };
        });
        placed.forEach(p => {
            if (!p) return;
            const { m, px, onRight, row } = p;
            ctx.beginPath();
            ctx.moveTo(px, top);
            ctx.lineTo(px, bottom);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = m.color;
            ctx.setLineDash([5, 3]);
            ctx.stroke();
            // Label hugs the line, flipping side near the right edge so it stays inside the chart.
            ctx.setLineDash([]);
            ctx.fillStyle = m.color;
            ctx.textAlign = onRight ? 'right' : 'left';
            const tx = px + (onRight ? -3 : 3);
            const ty = top + 10 + row * ROW_H;
            ctx.fillText(m.label, tx, ty);
            // Death markers carry a step-up glyph, placed on the far side of the label from the
            // line so it never sits on top of it. Right-aligned text occupies [tx - w, tx].
            if (m.stepUp) {
                const w = ctx.measureText(m.label).width;
                const gx = onRight ? tx - w - 3 - GLYPH_R : tx + w + 3 + GLYPH_R;
                drawStepUpGlyph(ctx, gx, ty - 3.5, GLYPH_R, m.stepUp === 'full', m.color);
                ctx.fillStyle = m.color;   // drawStepUpGlyph leaves its own fill/stroke set
            }
        });
        ctx.restore();
    }
};

// Chart series colors - single source of truth for anything IRMAA/Medicare colored
// (cost bars on both charts and the IRMAA milestone marker). Bars append 'C0' alpha
// (~75%) to match the other stacked cost series.
const IRMAA_COLOR    = '#E75480';
const MEDICARE_COLOR = '#008080';

// Milestone marker color for the two RMD-start lines - distinct from the five already in use
// (death purple, GK orange, IRMAA pink, shortfall red, break-even teal).
const RMD_MILESTONE_COLOR = '#2471a3';

// Milestone marker color for the Social Security start lines. Green, so it reads as income
// arriving rather than as one of the cost/warning markers.
const SS_MILESTONE_COLOR = '#1e8449';

// Legend hover hint for the Medicare series (browser-native tooltip via canvas title).
const MEDICARE_LEGEND_TIP = 'Base Cost for Medicare B+D - not deducted from spendable. Illustration only.';
const medicareLegendHover = {
    onHover: (e, item, legend) => { legend.chart.canvas.title = item.text === 'Medicare' ? MEDICARE_LEGEND_TIP : ''; },
    onLeave: (e, item, legend) => { legend.chart.canvas.title = ''; },
};

// Combine multiple {onHover,onLeave} legend-hover handler objects so several independent
// behaviors (e.g. the Medicare tooltip hint + dataset dimming below) all fire on the same
// event, instead of one silently overwriting the other via object spread key collision.
function composeLegendHover(...handlers) {
    return {
        onHover: (e, item, legend) => handlers.forEach(h => h.onHover?.(e, item, legend)),
        onLeave: (e, item, legend) => handlers.forEach(h => h.onLeave?.(e, item, legend)),
    };
}

// Shared color-dimming helper - fades a hex/rgba color to 15% opacity for the "not hovered /
// not isolated" state. Used by both datasetHoverHighlight() and makeChartLegendInteraction().
function dimColor(color) {
    if (!color || color === 'transparent') return color;
    let m = String(color).match(/^rgba?\((\d+),(\d+),(\d+)/);
    if (!m) {
        const h = String(color).match(/^#([0-9a-f]{6})/i);
        if (h) { const n = parseInt(h[1], 16); m = [null, (n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    }
    return m ? `rgba(${m[1]},${m[2]},${m[3]},0.15)` : color;
}

// Generic legend-hover highlight: dims every dataset except the hovered legend item's group,
// restoring on leave. `groupSize` lets one legend entry map to several consecutive datasets
// (e.g. the MC percentile-band chart uses 5 datasets - p5/p95/p25/p75/median - per strategy).
// NOTE: chart.update() (not 'none') - 'none' mode is a known Chart.js bug (chartjs/Chart.js#11507)
// that skips redrawing bar/point fill colors even though the dataset's color property updates
// correctly in the data model.
function datasetHoverHighlight(groupSize = 1) {
    return {
        onHover: (e, legendItem, legend) => {
            const chart = legend.chart, groupIdx = Math.floor(legendItem.datasetIndex / groupSize);
            chart.data.datasets.forEach((ds, i) => {
                // Bar datasets often have no borderColor at all (legitimately undefined) - use a
                // dedicated marker to track "cached", not `_origBorder !== undefined`, or those
                // datasets would never be recognized as cached and onLeave would skip restoring them.
                if (!ds._hoverHighlightCached) { ds._hoverHighlightCached = true; ds._origBorder = ds.borderColor; ds._origBg = ds.backgroundColor; }
                const inGroup = Math.floor(i / groupSize) === groupIdx;
                ds.borderColor = inGroup ? ds._origBorder : dimColor(ds._origBorder);
                ds.backgroundColor = inGroup ? ds._origBg : dimColor(ds._origBg);
            });
            chart.update();
        },
        onLeave: (e, legendItem, legend) => {
            const chart = legend.chart;
            chart.data.datasets.forEach(ds => {
                if (ds._hoverHighlightCached) { ds.borderColor = ds._origBorder; ds.backgroundColor = ds._origBg; }
            });
            chart.update();
        },
    };
}

// Combined hover-dim + click-isolate controller for mixed bar+line charts (Taxation, Inflows vs
// Outflows, Earnings vs W/D, combined Income & Expenses view). Bar legend items: click isolates
// (dims every other dataset, keeps the clicked bar full-color) - sticky until a DOUBLE-CLICK on
// any bar legend item restores everyone. Hover-dim is suppressed while a bar isolation is active
// (avoids two competing dim states). Line legend items are untouched - hover-dim still applies
// normally, and click keeps Chart.js's default toggle-hide/show (unlike bars, a single click on a
// line item DOES remove/restore that series, same as always).
function makeChartLegendInteraction(groupSize = 1) {
    let isolatedKey = null;
    const cache = (ds) => { if (!ds._hoverHighlightCached) { ds._hoverHighlightCached = true; ds._origBorder = ds.borderColor; ds._origBg = ds.backgroundColor; } };
    const restoreAll = (chart) => chart.data.datasets.forEach(ds => { if (ds._hoverHighlightCached) { ds.borderColor = ds._origBorder; ds.backgroundColor = ds._origBg; } });
    return {
        onHover: (e, legendItem, legend) => {
            if (isolatedKey !== null) return; // a bar isolation is active - hover-dim suppressed
            const chart = legend.chart, groupIdx = Math.floor(legendItem.datasetIndex / groupSize);
            chart.data.datasets.forEach((ds, i) => {
                cache(ds);
                const inGroup = Math.floor(i / groupSize) === groupIdx;
                ds.borderColor = inGroup ? ds._origBorder : dimColor(ds._origBorder);
                ds.backgroundColor = inGroup ? ds._origBg : dimColor(ds._origBg);
            });
            chart.update();
        },
        onLeave: (e, legendItem, legend) => {
            if (isolatedKey !== null) return; // stay on the isolated state
            restoreAll(legend.chart);
            legend.chart.update();
        },
        onClick: (e, legendItem, legend) => {
            const chart = legend.chart;
            const ds = chart.data.datasets[legendItem.datasetIndex];
            if (ds.type !== 'bar') {
                // Line item: native toggle-hide/show, unaffected by any bar isolation state.
                Chart.defaults.plugins.legend.onClick(e, legendItem, legend);
                return;
            }
            // MouseEvent.detail === 2 on the SECOND click of a genuine double-click (browser/OS
            // native double-click detection - resets to 1 if clicks are too far apart in time or
            // position, so accidentally clicking two different legend entries quickly won't trigger this).
            if (e.native?.detail === 2) {
                restoreAll(chart);
                isolatedKey = null;
                chart.update();
                return;
            }
            const key = `ds${legendItem.datasetIndex}`;
            chart.data.datasets.forEach((d, i) => {
                cache(d);
                const keep = i === legendItem.datasetIndex;
                d.backgroundColor = keep ? d._origBg : dimColor(d._origBg);
                d.borderColor = keep ? d._origBorder : dimColor(d._origBorder);
            });
            isolatedKey = key;
            chart.update();
        },
    };
}

// Compute milestone markers from the simulation log:
//  1. First death - labelled "You" / "Spouse" (filing status flips; the deceased's age becomes
//     '—'), carrying a half or full basis step-up glyph per the state's property law.
//  8. Last death - the final row, always someone's death since the plan ends at one. Labelled the
//     same way, always a FULL step-up (heirs), and it is the only death marker a single filer gets.
//  2. Every Guyton-Klinger guardrail spending CUT (gkAdj contains a "cap" adjustment).
//  3. Every year the IRMAA tier INCREASES over the prior year (e.g. Tier 1→Tier 2), labelled with
//     the new tier ("IRMAA Tier 2"). Same-or-lower tiers are not marked.
//  4. Every year net income falls short of the spend goal by more than 10%.
//  5. Roth conversion break-even - the year the converting plan permanently overtakes the
//     no-conversion shadow, i.e. totals.convBEYear (already the sustained-crossing year; this
//     function just looks it up and places the marker, no "first touch" logic here).
//  6. The year each person's RMDs begin - the year they reach their RMD start age, marked only
//     when that crossing happens INSIDE the plan (see rmdCross below).
function computeMilestones(log) {
    const ms = [];
    // Numeric IRMAA tier from the string field ("-none-"/"-"→0, "Tier 3 (TOP)"→3).
    const tierNum = t => { const m = String(t ?? '').match(/(\d+)/); return m ? +m[1] : 0; };
    const beYear = (typeof lastTotals !== 'undefined' && lastTotals) ? lastTotals.convBEYear : null;
    // Basis step-up fraction the RUN used (0.50 common law / 1.00 community property), same
    // lastTotals channel as beYear above. Only the first death of a couple can be a half step-up;
    // the last death is always full, because the heirs take the account at market wherever they live.
    const stepUpFraction = (typeof lastTotals !== 'undefined' && lastTotals && lastTotals.basisStepUpFraction != null)
        ? lastTotals.basisStepUpFraction : 0.50;
    // RMD start age from the log alone: the engine sets age = year − birthyear exactly
    // (optimizer_core.js resolveHousehold), so the birth year is recoverable from any row with a
    // numeric age, and the start age follows the same rule as getRMDPercentage() - 75 for anyone
    // born 1960 or later, else 73. A non-numeric age ('—') means not alive / no spouse.
    const numAge = a => (a == null || a === '—') ? null : +a;
    const rmdAgeFor = (year, age) => ((year - age) >= 1960 ? 75 : 73);
    // Fires on the first row where this person reaches their RMD age AND the prior row had them
    // below it. Requiring the crossing to happen inside the log means a plan that starts after
    // RMD age gets no marker (RMDs began before the plan), a spouse who dies first never fires
    // (their age goes '—'), and a single filer never fires (age2 is '—' in every row).
    const rmdCross = (year, age, prevAge) =>
        age != null && prevAge != null && prevAge < rmdAgeFor(year, age) && age >= rmdAgeFor(year, age);
    let prevStatus = null, deathDone = false, prevTier = 0, beDone = false;
    let prevAge1 = null, prevAge2 = null, rmd1Done = false, rmd2Done = false;
    for (let i = 0; i < log.length; i++) {
        const r = log[i];
        const status = r.status;
        // 1. First death - first filing-status flip; name who passed (their age shows '—'). The
        // word "Passing" is carried by the legend rather than the label: these markers sit at the
        // right-hand end of the chart where a long label is drawn right-aligned and sweeps left
        // across its neighbours. The step-up glyph replaces it at a fraction of the width.
        if (!deathDone && prevStatus && status && status !== prevStatus) {
            const youGone = (r.age1 == null || r.age1 === '—');
            ms.push({ x: i, label: youGone ? 'You' : 'Spouse', color: '#7b1fa2',
                      stepUp: stepUpFraction >= 1 ? 'full' : 'half' });
            deathDone = true;
        }
        if (status) prevStatus = status;
        // 4. Net income shortfall > 10% of the spend goal - every such year. (Computed first so a
        // shortfall year suppresses the GK-cut marker below - a shortfall is the more important note.)
        const sg = r.spendGoal ?? r.SpendGoal;
        const ni = r.netIncome ?? r.NetIncome;
        const isShort = (sg > 0 && ni != null && ni < sg * 0.90);
        // 2. GK guardrail cut - gkAdj like "−10%cap" (may be combined with "no-CPI"). Skipped when
        // the same year is already flagged as a shortfall.
        if (!isShort && String(r.gkAdj ?? '').includes('cap')) {
            ms.push({ x: i, label: 'GK cut', color: '#d35400' });
        }
        // 3. IRMAA tier increase over the prior year.
        const tier = tierNum(r.IRMAATier);
        if (tier > prevTier && tier > 0) {
            ms.push({ x: i, label: 'IRMAA ' + String(r.IRMAATier), color: IRMAA_COLOR });
        }
        prevTier = tier;
        if (isShort) {
            ms.push({ x: i, label: 'Shortfall', color: '#c0392b' });
        }
        // 5. Roth conversion break-even year.
        if (!beDone && beYear != null && r.year === beYear) {
            ms.push({ x: i, label: 'Roth Break Even', color: '#16a085' });
            beDone = true;
        }
        // 6. RMD start ages. Marked regardless of the IRA balance - the date is a fact about the
        // person, and "the year RMDs would start" is worth seeing even for a fully converted IRA.
        const a1 = numAge(r.age1), a2 = numAge(r.age2);
        if (!rmd1Done && rmdCross(r.year, a1, prevAge1)) {
            ms.push({ x: i, label: 'Your RMDs begin', color: RMD_MILESTONE_COLOR });
            rmd1Done = true;
        }
        if (!rmd2Done && rmdCross(r.year, a2, prevAge2)) {
            ms.push({ x: i, label: 'Spouse RMDs begin', color: RMD_MILESTONE_COLOR });
            rmd2Done = true;
        }
        // 7. Social Security start. Unlike the RMD markers these are not derived from age here: the
        // engine flags the first year a benefit is actually PAID, which with the default December
        // birth month is the year AFTER the claiming age is reached, since the claim year prorates
        // to zero months. The engine also knows which spouse the survivor benefit belongs to, which
        // the log's combined SSincome column cannot say. Hidden '-' fields, so they never show up
        // as Annual Details columns.
        if (r['-ssStart1']) ms.push({ x: i, label: 'Your SS begins', color: SS_MILESTONE_COLOR });
        if (r['-ssStart2']) ms.push({ x: i, label: 'Spouse SS begins', color: SS_MILESTONE_COLOR });
        if (r['-ssStartSurvivor']) ms.push({ x: i, label: 'Survivor SS begins', color: SS_MILESTONE_COLOR });
        if (a1 != null) prevAge1 = a1;
        if (a2 != null) prevAge2 = a2;
    }
    // 8. The LAST death. The simulation ends at it, so the final row is always someone's death -
    // for a couple and for a single filer alike - and until now it was the one life event on the
    // chart that went unmarked. A single filer got no death marker at all, because marker 1 above
    // fires on an MFJ -> SGL flip that never happens without a spouse.
    //   Always a FULL step-up, whatever the state: this is the transfer to heirs, and IRC 1014
    // re-bases the whole account. It is drawn whether or not it is worth anything, because the
    // marker is recording a death, and the glyph records the rule that applied to it. A plan that
    // spent its brokerage down gets the same mark as one that did not.
    const _lastIdx = log.length - 1;
    const _lastRow = _lastIdx >= 0 ? log[_lastIdx] : null;
    if (_lastRow) {
        // Whoever is still alive on the final row is the one it belongs to; the other shows '—'.
        // Both alive means both life expectancies land on the same year, so there was no first
        // death to flip the filing status and this is the only death marker the plan gets.
        const _you = !(_lastRow.age1 == null || _lastRow.age1 === '—');
        const _spouse = !(_lastRow.age2 == null || _lastRow.age2 === '—');
        const _label = (_you && _spouse) ? 'Both' : (_you ? 'You' : 'Spouse');
        ms.push({ x: _lastIdx, label: _label, color: '#7b1fa2', stepUp: 'full' });
    }
    _chartMilestones = ms;
}

// Keeps the step-up legend under the asset chart in step with the run, and describes only what is
// actually ON the chart. The half glyph cannot occur in a community-property state, where the whole
// account resets at the first death, nor for a single filer, whose one death goes straight to heirs
// and is always full. Explaining a half step-up to those users is describing something they will
// never see, so the half swatch and its half of the sentence are dropped when no half marker exists.
// The state is named only when it is what decided the answer: with two deaths and no half, the
// state IS the reason both are full. A single filer's full step-up is the heirs' rule, not their
// state's, so naming their state there would credit the wrong cause.
function updateStepUpLegend() {
    const el = document.getElementById('milestone-stepup-legend');
    if (!el) return;
    el.style.display = showMilestones ? 'flex' : 'none';
    const deaths = _chartMilestones.filter(m => m.stepUp);
    const anyHalf = deaths.some(m => m.stepUp === 'half');
    const name = (typeof lastTotals !== 'undefined' && lastTotals) ? lastTotals.stateName : null;
    const halfSwatch = document.getElementById('milestone-stepup-half');
    if (halfSwatch) halfSwatch.style.display = anyHalf ? 'flex' : 'none';
    const text = document.getElementById('milestone-stepup-text');
    if (!text) return;
    if (anyHalf) {
        text.textContent = `indicate passing with half or full basis step up based on ${name ? '(' + name + ') ' : ''}state law.`;
    } else if (deaths.length > 1) {
        text.textContent = `indicates passing with full basis step up${name ? ' (' + name + ' is a community property state)' : ''}.`;
    } else {
        text.textContent = 'indicates passing with full basis step up to heirs.';
    }
}

// Toggle handler for the "Show milestones" checkbox; redraws both charts in place.
function toggleMilestones(cb) {
    showMilestones = !!cb.checked;
    updateStepUpLegend();
    assetChart?.update('none');
    incomeChart?.update('none');
}

// #8 Taxation view - build federal-bracket and IRMAA-tier threshold series for the years MAGI
// actually CROSSES the boundary (a boundary always above or always below MAGI is omitted, so the
// always-exceeded low brackets and never-reached high brackets don't clutter the chart). Each
// boundary inflates per year by the cumulative CPI factor and uses that year's filing status.
function computeTaxThresholdSeries(log, adj) {
    if (!log.length) return [];
    const magi = log.map(r => r.MAGI ?? 0);
    // A boundary series is "crossed" iff MAGI sits below it in some year and at/above it in another.
    const crosses = series => {
        let below = false, atOrAbove = false;
        for (let i = 0; i < series.length; i++) {
            const v = series[i];
            if (v == null || !isFinite(v)) continue;
            if (magi[i] >= v) atOrAbove = true; else below = true;
        }
        return below && atOrAbove;
    };
    // Inflated per-year boundary value for table[status].brackets[idx].l (null if non-finite).
    const boundary = (table, idx) => log.map(r => {
        const brks = table?.[r.status]?.brackets;
        const l = brks?.[idx]?.l;
        return (l == null || !isFinite(l)) ? null : l * (r['-cpiFactor'] ?? 1);
    });
    const out = [];

    // Federal: each bracket lower bound is where a new marginal rate begins. Label with that rate.
    const fb = TAXData?.FEDERAL, fedShades = ['#f5cba7', '#f0b27a', '#eb984e', '#e67e22', '#ca6f1e', '#a04000'];
    if (fb?.MFJ) {
        const nFed = fb.MFJ.brackets.length;
        const rawFed = Array.from({ length: nFed }, (_, j) => boundary(fb, j));
        const crossedFed = new Set();
        for (let j = 0; j < nFed; j++) {
            if (!crosses(rawFed[j])) continue;
            crossedFed.add(j);
            const rate = Math.round((fb.MFJ.brackets[j].r ?? 0) * 100);
            out.push({ label: `${rate}% Limit`, color: fedShades[j % fedShades.length],
                       data: rawFed[j].map((v, k) => v == null ? null : v * adj(log[k])),
                       group: 'fed' });
        }
        // Next bracket above current MAGI - not already crossed.
        const nextFedCounts = {};
        for (let y = 0; y < magi.length; y++) {
            for (let j = 0; j < nFed; j++) {
                const v = rawFed[j][y];
                if (v != null && magi[y] < v) {
                    if (!crossedFed.has(j)) nextFedCounts[j] = (nextFedCounts[j] || 0) + 1;
                    break;
                }
            }
        }
        for (const [jStr] of Object.entries(nextFedCounts)) {
            const j = +jStr;
            const rate = Math.round((fb.MFJ.brackets[j].r ?? 0) * 100);
            out.push({ label: `${rate}% Limit`, color: fedShades[j % fedShades.length],
                       data: rawFed[j].map((v, k) => v == null ? null : v * adj(log[k])),
                       dash: [5, 4], group: 'fed', isNext: true });
        }
    }

    // IRMAA: each tier's MAGI entry threshold (skip the no-surcharge floor at index 0).
    const ib = TAXData?.IRMAA, IRMAAShades = ['#aed6f1', '#7fb3d5', '#5499c7', '#2e86c1', '#2471a3', '#1a5276'];
    if (ib?.MFJ) {
        const nIR = ib.MFJ.brackets.length;
        const rawIR = Array.from({ length: nIR }, (_, t) => boundary(ib, t));
        const crossedIR = new Set();
        for (let t = 1; t < nIR; t++) {
            if (!crosses(rawIR[t])) continue;
            crossedIR.add(t);
            const tier = (ib.MFJ.brackets[t].tier || `Tier ${t}`).replace(/\s*\(TOP\)/, '');
            out.push({ label: `IRMAA ${tier}`, color: IRMAAShades[(t - 1) % IRMAAShades.length],
                       data: rawIR[t].map((v, k) => v == null ? null : v * adj(log[k])), dash: [3, 3],
                       group: 'IRMAA' });
        }
        // Next IRMAA tier above current MAGI - not already crossed.
        const nextIRCounts = {};
        for (let y = 0; y < magi.length; y++) {
            for (let t = 1; t < nIR; t++) {
                const v = rawIR[t][y];
                if (v != null && magi[y] < v) {
                    if (!crossedIR.has(t)) nextIRCounts[t] = (nextIRCounts[t] || 0) + 1;
                    break;
                }
            }
        }
        for (const [tStr] of Object.entries(nextIRCounts)) {
            const t = +tStr;
            const tier = (ib.MFJ.brackets[t].tier || `Tier ${t}`).replace(/\s*\(TOP\)/, '');
            out.push({ label: `IRMAA ${tier}`, color: IRMAAShades[(t - 1) % IRMAAShades.length],
                       data: rawIR[t].map((v, k) => v == null ? null : v * adj(log[k])),
                       dash: [5, 4], group: 'IRMAA', isNext: true });
        }
    }
    return out;
}

// Toggle handler for the Taxation view's "Show thresholds" checkbox; rebuilds the chart.
function toggleTaxThresholds(cb) {
    showTaxThresholds = !!cb.checked;
    if (lastSimulationLog) updateCharts(lastSimulationLog);
}

function syncChart(source, target, event) {
    const pts = source.getElementsAtEventForMode(event, 'index', { intersect: false }, false);
    if (pts.length === 0) return;
    const idx = pts[0].index;
    const active = target.data.datasets.map((_, i) => ({ datasetIndex: i, index: idx }));
    target.setActiveElements(active);
    target.tooltip.setActiveElements(active, { x: 0, y: 0 });
    target.update('none');
}

function clearChartHighlight(chart) {
    chart.setActiveElements([]);
    chart.tooltip.setActiveElements([], { x: 0, y: 0 });
    chart.update('none');
}

function setupChartSync() {
    if (typeof Chart !== 'undefined') Chart.register(crosshairPlugin, milestonePlugin);
    const aCanvas = document.getElementById('chartAssets');
    const iCanvas = document.getElementById('chartIncomeSources');
    if (!aCanvas || !iCanvas) return;
    const syncOthers = (src, others, e) => others.forEach(c => { if (c) syncChart(src, c, e); });
    const clearOthers = charts => charts.forEach(c => { if (c) clearChartHighlight(c); });
    aCanvas.addEventListener('mousemove', e => syncOthers(assetChart,  [incomeChart], e));
    aCanvas.addEventListener('mouseleave', () => clearOthers([incomeChart]));
    iCanvas.addEventListener('mousemove', e => syncOthers(incomeChart, [assetChart], e));
    iCanvas.addEventListener('mouseleave', () => clearOthers([assetChart]));
}
let chartPersonView = 'both';

function setChartPersonView(v) {
    chartPersonView = v;
    ['both', 'mine', 'spouse'].forEach(k => {
        const btn = document.getElementById(`chartPerson_${k}`);
        if (btn) btn.classList.toggle('active', k === v);
    });
    if (lastSimulationLog) updateCharts(lastSimulationLog);
}

// #8 - which view the lower (Income & Expenses) chart shows.
let incomeChartView = 'combined';

function setIncomeChartView(v) {
    incomeChartView = v;
    ['combined', 'tax', 'net', 'flows', 'assetflows'].forEach(k => {
        const btn = document.getElementById(`chartView_${k}`);
        if (btn) btn.classList.toggle('active', k === v);
    });
    // "Show thresholds" applies only to the Taxation view.
    const thr = document.getElementById('chk-thresholds-wrap');
    if (thr) thr.style.display = v === 'tax' ? 'inline-flex' : 'none';
    // After-tax note applies only to the combined (Income & Expenses) view - it's the
    // only view where income-source bars are scaled down by the year's effective tax rate.
    const aftertaxNote = document.getElementById('income-aftertax-note');
    if (aftertaxNote) aftertaxNote.style.display = v === 'combined' ? '' : 'none';
    if (lastSimulationLog) updateCharts(lastSimulationLog);
}

// #8 - build the lower chart for the non-default views. `combined` stays inline in updateCharts.
// Receives the closures it needs (adj, sharedTooltip, mkLine, visibleSum) so it shares the exact
// dollar-adjustment and tooltip styling of the main charts.
function buildAltIncomeChart(ctxI, log, adj, sharedTooltip, mkLine, visibleSum) {
    const labels = log.map(r => r.year);
    const legendLabels = { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 16 };
    const dollarTicks = { callback: v => Math.round(v).toLocaleString() };

    if (incomeChartView === 'net') {
        // Income vs Net (spendable) income vs the spend goal.
        incomeChart = new Chart(ctxI, {
            type: 'line',
            data: { labels, datasets: [
                mkLine('Total Income',    '#2980b9', r => (r.totalIncome ?? 0) * adj(r)),
                mkLine('Net (Spendable)', '#27ae60', r => (visibleSum(r) - r.totalTax) * adj(r)),
                { ...mkLine('Spend Goal', '#e67e22', r => (r.spendGoal ?? 0) * adj(r)), borderDash: [6, 4], pointRadius: 0 },
            ]},
            options: { ...sharedTooltip,
                scales: { y: { ticks: dollarTicks } },
                plugins: { ...sharedTooltip.plugins, legend: { labels: legendLabels, ...datasetHoverHighlight() } } }
        });
    } else if (incomeChartView === 'tax') {
        // Taxation: stacked tax components are the headline number → LEFT (primary) axis.
        // MAGI and (optionally) the federal-bracket / IRMAA thresholds it crosses → RIGHT axis.
        // order: bars high (drawn first = behind), lines low (drawn last = on top) so the MAGI and
        // threshold lines are never hidden behind the stacked tax bars.
        const mkTax = (label, color, fn) => ({ label, type: 'bar', backgroundColor: color, stack: 'tax',
            yAxisID: 'y', order: 3, data: log.map(r => Math.max(0, fn(r)) * adj(r)) });
        const datasets = [
            mkTax('Federal',   '#c0392b', r => (r.FedTax ?? 0) - (r['-capGainsTax'] ?? 0)),
            mkTax('Cap Gains', '#e74c3c', r => r['-capGainsTax'] ?? 0),
            mkTax('State',     '#f39c12', r => r.StateTax ?? 0),
            mkTax('IRMAA',     IRMAA_COLOR + 'C0', r => r.IRMAA ?? 0),
            // Base Part B+D premiums (informational cost - not part of totalTax).
            mkTax('Medicare',  MEDICARE_COLOR + 'C0', r => r.Medicare ?? 0),
            { ...mkLine('MAGI', '#111827', r => (r.MAGI ?? 0) * adj(r)), type: 'line', yAxisID: 'y1', pointRadius: 0, borderWidth: 2.5, order: 1 },
        ];
        if (showTaxThresholds) {
            for (const s of computeTaxThresholdSeries(log, adj)) {
                datasets.push({ label: s.label, data: s.data, type: 'line', yAxisID: 'y1', order: 0,
                    borderColor: s.color, backgroundColor: s.color, pointRadius: 0, borderWidth: 2.5,
                    borderDash: s.dash || [6, 4], fill: false, spanGaps: true,
                    _thGroup: s.group, _thNext: s.isNext });
            }
        }
        // Threshold lines stay on the chart for visual context, but are dropped from the tooltip.
        // Instead the tooltip answers "what rate am I paying now?" via an afterBody footer with the
        // federal + state marginal rate and the highest IRMAA tier crossed (all already in the log row).
        const taxThresholdFilter = (item) => !item.dataset._thGroup;   // bars + MAGI only
        // Enrich two of the bar rows: IRMAA row shows its tier ("IRMAA Tier 4: 16,000"); the Cap Gains
        // row shows the effective cap-gains rate and the underlying gains ("Cap Gains: 81,835 (~21% on 392,932)").
        const taxLabelCb = (ctx) => {
            const r = log[ctx.dataIndex];
            const val = Math.round(ctx.parsed.y).toLocaleString();
            const lbl = ctx.dataset.label;
            if (lbl === 'IRMAA' && ctx.parsed.y > 0) {
                const tier = r?.IRMAATier;
                if (tier && tier !== '-none-' && tier !== '-') return `IRMAA ${tier}: ${val}`;
            }
            if (lbl === 'Cap Gains' && ctx.parsed.y > 0 && (r?.CapGains || 0) > 0) {
                const rate = Math.round((r['-capGainsTax'] || 0) / r.CapGains * 100);
                return `Cap Gains: ${val} (~${rate}% on ${Math.round(r.CapGains * adj(r)).toLocaleString()})`;
            }
            return lbl + ': ' + val;
        };
        // Footer reports the marginal rate on ORDINARY income (cap gains shown separately above).
        const taxRateFooter = (items) => {
            const r = log[items[0]?.dataIndex];
            if (!r) return [];
            const out = [`Fed ordinary marginal: ${Math.round((r['FedRate%'] || 0) * 100)}%`];
            if ((r['StateRate%'] || 0) > 0) out.push(`State marginal: ${((r['StateRate%']) * 100).toFixed(1)}%`);
            return out;
        };
        incomeChart = new Chart(ctxI, {
            type: 'bar',
            data: { labels, datasets },
            options: { ...sharedTooltip,
                scales: {
                    x:  { stacked: true },
                    y:  { position: 'left',  stacked: true,  title: { display: true, text: 'Tax ($)' },    ticks: dollarTicks },
                    y1: { position: 'right', stacked: false, min: 0, grid: { drawOnChartArea: false }, title: { display: true, text: 'Income ($)' }, ticks: dollarTicks },
                },
                plugins: { ...sharedTooltip.plugins,
                    tooltip: { ...sharedTooltip.plugins.tooltip, filter: taxThresholdFilter,
                        callbacks: { ...sharedTooltip.plugins.tooltip.callbacks, label: taxLabelCb, afterBody: taxRateFooter } },
                    legend: (() => { const li = makeChartLegendInteraction(); return { labels: legendLabels, ...composeLegendHover(medicareLegendHover, li), onClick: li.onClick }; })() } }
        });
    } else if (incomeChartView === 'flows') {
        // Inflows (up) vs outflows (down): where spending money comes from and where it goes.
        const mkUp = (label, color, fn) => ({ label, type: 'bar', backgroundColor: color, stack: 'flow',
            data: log.map(r =>  Math.max(0, fn(r)) * adj(r)) });
        const mkDn = (label, color, fn) => ({ label, type: 'bar', backgroundColor: color, stack: 'flow',
            data: log.map(r => -Math.max(0, fn(r)) * adj(r)) });
        // Portfolio Draw (= netOut + conversion gross) split by source account, using the asset-chart
        // colors. Per-account gross withdrawals are scaled so their sum equals the portfolio total,
        // which keeps the up/down sides balanced (reinvested surplus is netted out pro-rata).
        const _grossDraw = r => Math.max(0, r.IRAwd ?? 0) + Math.max(0, r['Brokerage-'] ?? 0)
            + Math.max(0, r.CashWD ?? 0) + Math.max(0, r.RothWD ?? 0);
        const _acctScale = r => { const g = _grossDraw(r); return g > 0 ? ((r.netOut ?? 0) + (r.rothConv ?? 0)) / g : 0; };
        incomeChart = new Chart(ctxI, {
            type: 'bar',
            data: { labels, datasets: [
                // IRA draw includes the gross IRA→Roth conversion (the converted dollars are drawn from
                // the IRA up, and land in Roth on the down side via "Conversions → Roth").
                // Spending is the amount actually CONSUMED (inflows + portfolio draw − taxes); using
                // netIncome here would balloon in conversion years because totalIncome includes the
                // converted amount, double-counting it against the separate Conversions bar.
                mkUp('Guaranteed (SS+Pension)', '#3498dbB0', r => r.inflows  ?? 0),
                mkUp('IRA draw',                '#e67e22B0', r => (r.IRAwd ?? 0)      * _acctScale(r)),
                mkUp('Brokerage draw',          '#4F4FDC', r => (r['Brokerage-'] ?? 0) * _acctScale(r)),
                mkUp('Cash draw',               '#27ae60B0', r => (r.CashWD ?? 0)     * _acctScale(r)),
                mkUp('Roth draw',               '#8e44adB0', r => (r.RothWD ?? 0)     * _acctScale(r)),
                mkDn('Taxes',                   '#A30000C0', r => r.totalTax ?? 0),
                mkDn('Spending',                '#1abc9cB0', r => (r.inflows ?? 0) + (r.netOut ?? 0) - (r.totalTax ?? 0)),
                mkDn('Conversions → Roth',      '#8e44adB0', r => r.rothConv ?? 0),
            ]},
            options: { ...sharedTooltip,
                scales: { x: { stacked: true }, y: { stacked: true, ticks: dollarTicks } },
                plugins: { ...sharedTooltip.plugins,
                    // Hide rows that round to $0 (e.g. no Brokerage draw this year) - declutters the tip.
                    tooltip: { ...sharedTooltip.plugins.tooltip, filter: (item) => Math.round(item.parsed.y) !== 0 },
                    legend: (() => { const li = makeChartLegendInteraction(); return { labels: legendLabels, onHover: li.onHover, onLeave: li.onLeave, onClick: li.onClick }; })() } }
        });
    } else if (incomeChartView === 'assetflows') {
        // Asset-level cash flow: investment EARNINGS (up, stacked by account) vs WITHDRAWALS that
        // leave the portfolio to fund spending/taxes (down). Roth conversions are excluded (IRA→Roth
        // is internal). The "Net change" line = earnings − withdrawals shows whether the portfolio
        // grew (above 0) or was drawn down (below 0) that year.
        const earn = r => (r['-iraG'] ?? 0) + (r.rothG ?? 0) + (r.brokerageG ?? 0) + (r.cashG ?? 0);
        const mkE = (label, color, fn) => ({ label, type: 'bar', backgroundColor: color, stack: 'flow',
            order: 2, data: log.map(r => (fn(r) ?? 0) * adj(r)) });
        incomeChart = new Chart(ctxI, {
            type: 'bar',
            data: { labels, datasets: [
                mkE('IRA earnings',       '#e67e22B0', r => r['-iraG']),
                mkE('Roth earnings',      '#8e44adB0', r => r.rothG),
                mkE('Brokerage earnings', '#4F4FDC', r => r.brokerageG),
                mkE('Cash earnings',      '#27ae60B0', r => r.cashG),
                { label: 'Withdrawals', type: 'bar', backgroundColor: '#c0392bC0', stack: 'flow', order: 2,
                  data: log.map(r => -Math.max(0, r.netOut ?? 0) * adj(r)) },
                { ...mkLine('Net change', '#111827', r => (earn(r) - Math.max(0, r.netOut ?? 0)) * adj(r)),
                  type: 'line', order: 0, pointRadius: 0, borderWidth: 2 },
            ]},
            options: { ...sharedTooltip,
                scales: { x: { stacked: true }, y: { stacked: true, ticks: dollarTicks } },
                plugins: { ...sharedTooltip.plugins, legend: (() => { const li = makeChartLegendInteraction(); return { labels: legendLabels, onHover: li.onHover, onLeave: li.onLeave, onClick: li.onClick }; })() } }
        });
    }
}

function updateCharts(log) {
    const inCurrentDollars = document.getElementById('show-current-dollars')?.checked;
    const adj = r => inCurrentDollars ? 1 / (r.inflationFactor || 1) : 1;
    computeMilestones(log);   // #7 - markers drawn by milestonePlugin when the toggle is on
    updateStepUpLegend();     // names the state behind the half/full step-up glyphs

    const sharedTooltip = {
        interaction: { mode: 'index', intersect: false },
        plugins: {
            tooltip: {
                itemSort: (a, b) => b.parsed.y - a.parsed.y,
                callbacks: {
                    title: items => {
                        const r = log[items[0]?.dataIndex];
                        if (!r) return items[0]?.label ?? '';
                        const a1 = (r.age1 == null || r.age1 === '—') ? '--' : r.age1;
                        const a2 = (r.age2 == null || r.age2 === '—') ? '--' : r.age2;
                        const taxPct = r.totalIncome > 0
                            ? (r.totalTax / r.totalIncome * 100).toFixed(1) + '%'
                            : '--';
                        return `${r.year}  |  You: ${a1}  Spouse: ${a2}  |  Tax: ${taxPct}`;
                    },
                    label: ctx => ctx.dataset.label + ': ' + Math.round(ctx.parsed.y).toLocaleString()
                }
            }
        }
    };

    const mkLine = (label, color, dataFn) => ({
        label, data: log.map(dataFn),
        borderColor: color, backgroundColor: color,
        pointBackgroundColor: color, fill: false
    });

    const ctxA = document.getElementById('chartAssets').getContext('2d');
    (Chart.getChart(ctxA.canvas) ?? assetChart)?.destroy();
    const iraLabel  = chartPersonView === 'mine' ? 'My IRA'    : chartPersonView === 'spouse' ? 'Spouse IRA'  : 'IRAs';
    const rothLabel = chartPersonView === 'mine' ? 'My Roth'   : chartPersonView === 'spouse' ? 'Spouse Roth' : 'Roth';
    const iraData   = r => (chartPersonView === 'mine' ? r.IRA1 : chartPersonView === 'spouse' ? r.IRA2 : r.TotalIRA) * adj(r);
    const rothData  = r => (chartPersonView === 'mine' ? (r.Roth1 || 0) : chartPersonView === 'spouse' ? (r.Roth2 || 0) : r.Roth) * adj(r);

    assetChart = new Chart(ctxA, {
        type: 'line',
        data: {
            labels: log.map(r => r.year),
            datasets: [
                mkLine(iraLabel,      '#e67e22', iraData),
                mkLine(rothLabel,     '#8e44ad', rothData),
                mkLine('Brokerage',   '#4F4FDC', r => r.Brokerage   * adj(r)),
                mkLine('Cash',        '#27ae60', r => r.Cash        * adj(r)),
                mkLine('TotalWealth', '#555555', r => r.totalWealth * adj(r))
            ]
        },
        options: {
            ...sharedTooltip,
            plugins: {
                ...sharedTooltip.plugins,
                legend: { labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 16 }, ...datasetHoverHighlight() }
            }
        }
    });

    // Income Sources chart
    // All income sources are scaled by (netIncome / visibleSum) ≈ (1 - effectiveTaxRate).
    // visibleSum = all income sources contributing to spending (including Cash WD and Basis Return).
    // This keeps each source proportional to its nominal value - a fixed pension stays
    // nearly fixed rather than inflating when Cash becomes the dominant income source.
    // Tax bands sit on top, reaching totalIncome. Spendable Income line at netIncome.
    const ctxI = document.getElementById('chartIncomeSources').getContext('2d');
    (Chart.getChart(ctxI.canvas) ?? incomeChart)?.destroy();

    // Brokerage basis return: the untaxed (return-of-basis) portion of brokerage withdrawals
    const basisReturn = r => Math.max(0, (r['Brokerage-'] ?? 0) - (r.CapGains ?? 0));

    // All income sources (including Cash WD and Basis Return). The IRA contribution to spendable
    // income is the spending-funding draw only (-iraSpend); Roth-conversion dollars left the IRA for
    // Roth (not for spending) and are shown separately as a cost above the Spendable line.
    const visibleSum = r => r.SSincome + r.pension + r.RMDwd + (r['-iraSpend'] ?? 0)
        + r.RothWD + r.CapGains + r.cashDividends + r.cashInterest
        + (r.CashWD ?? 0) + basisReturn(r);

    // scale = (1 - effectiveTaxRate) on post-refund income. Using r.netIncome is wrong in surplus
    // years because netIncome was computed with pre-refund cash withdrawals; the logged CashWD is
    // post-refund. Deriving scale from (visibleSum - totalTax) / visibleSum stays correct in both.
    const mkInc = (label, color, rawFn) => ({
        label, type: 'bar', backgroundColor: color, stack: 'income', order: 2,
        data: log.map(r => {
            const vsum = visibleSum(r);
            const scale = vsum > 0 ? (vsum - r.totalTax) / vsum : 1;
            return rawFn(r) * scale * adj(r);
        })
    });
    const mkAbs = (label, color, rawFn) => ({
        label, type: 'bar', backgroundColor: color, stack: 'income', order: 2,
        data: log.map(r => rawFn(r) * adj(r))
    });

    if (incomeChartView !== 'combined') {
        buildAltIncomeChart(ctxI, log, adj, sharedTooltip, mkLine, visibleSum);
        return;
    }

    incomeChart = new Chart(ctxI, {
        type: 'bar',  // required for Chart.js 4.x mixed bar+line; per-dataset type overrides apply
        data: {
            labels: log.map(r => r.year),
            datasets: [
                // Income sources - all scaled by (1 - effectiveTaxRate) so they sum to (visibleSum - totalTax)
                mkInc('SS',              '#3498dbB0', r => r.SSincome),
                mkInc('Pension',         '#7f8c8dB0', r => r.pension),
                mkInc('IRA RMD',         '#e67e22B0', r => r.RMDwd),
                mkInc('Interest',        '#f1c40fB0', r => r.cashInterest),
                mkInc('IRA WD',          '#d35400B0', r => r['-iraSpend'] ?? 0),
                mkInc('Roth WD',         '#8e44adB0', r => r.RothWD),
                mkInc('Gains+Div',       '#1abc9cB0', r => r.CapGains + r.cashDividends),
                mkInc('Cash WD',         '#27ae60B0', r => r.CashWD ?? 0),
                mkInc('Brokerage',       '#4F4FDC', r => basisReturn(r)),
                // Visual separator between spending and expense legend items
                { label: '│', type: 'bar', data: log.map(() => 0), backgroundColor: 'transparent', borderWidth: 0, stack: 'income', order: 2 },
                // Expenses stack on top of the Spendable Income line (unscaled absolute amounts)
                mkAbs('Fed Tax',        '#A30000C0', r => r.FedTax),
                mkAbs('State Tax',      '#FF2E2EC0', r => r.StateTax),
                mkAbs('IRMAA',          IRMAA_COLOR + 'C0', r => r.IRMAA),
                // Base Part B+D premiums (informational - not deducted from Net Income).
                mkAbs('Medicare',       MEDICARE_COLOR + 'C0', r => r.Medicare ?? 0),
                mkAbs('Roth Conv',      '#8e44ad80', r => r.rothConv),
                mkAbs('QCD',            '#99999980', r => (r.QCD1 ?? 0) + (r.QCD2 ?? 0)),
                // Spendable Income line sits exactly at the income/tax seam.
                // order:1 (lower than bars' order:2) ensures Chart.js draws this line
                // AFTER the bars so it appears on top. Higher order = drawn first = behind.
                {
                    label: 'Net Income',
                    data: log.map(r => (visibleSum(r) - r.totalTax) * adj(r)),
                    type: 'line', borderColor: '#27ae60', borderWidth: 2.5,
                    backgroundColor: '#27ae60', pointBackgroundColor: '#27ae60',
                    fill: false, order: 1
                }
            ]
        },
        options: {
            ...sharedTooltip,
            scales: {
                x: { stacked: true },
                y: { stacked: true, ticks: { callback: v => Math.round(v).toLocaleString() } }
            },
            plugins: {
                ...sharedTooltip.plugins,
                tooltip: {
                    ...sharedTooltip.plugins.tooltip,
                    callbacks: {
                        ...sharedTooltip.plugins.tooltip.callbacks,
                        title: items => {
                            const r = log[items[0]?.dataIndex];
                            if (!r) return items[0]?.label ?? '';
                            const a1 = (r.age1 == null || r.age1 === '—') ? '--' : r.age1;
                            const a2 = (r.age2 == null || r.age2 === '—') ? '--' : r.age2;
                            const taxPct = r.totalIncome > 0
                                ? (r.totalTax / r.totalIncome * 100).toFixed(1) + '%'
                                : '--';
                            const a = adj(r);
                            const totalFmt = Math.round(r.totalIncome * a).toLocaleString();
                            const cwd = (r.CashWD ?? 0) * a;
                            const br = basisReturn(r) * a;
                            const parts = [];
                            if (cwd > 0.5) parts.push(`Cash ${Math.round(cwd).toLocaleString()}`);
                            if (br  > 0.5) parts.push(`Brokerage ${Math.round(br).toLocaleString()}`);
                            const lines = [
                                `${r.year}  |  You: ${a1}  Spouse: ${a2}  |  Tax: ${taxPct}`,
                                `Total Income: ${totalFmt}`
                            ];
                            if (parts.length > 0) lines.push(`Untaxed: ${parts.join(' + ')}`);
                            return lines;
                        }
                    },
                    filter: item => item.dataset.label !== '│' && Math.abs(Math.round(item.parsed.y)) > 0
                },
                legend: (() => {
                    const li = makeChartLegendInteraction();
                    return {
                        onClick: (e, item, legend) => {
                            if (item.text === '│') return;   // zero-width separator dataset - not isolatable
                            li.onClick(e, item, legend);
                        },
                        ...composeLegendHover(medicareLegendHover, li),
                        labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 16 }
                    };
                })()
            }
        }
    });
}

function val(id) { const el = document.getElementById(id); if (!el) return undefined; return el.dataset.numVal !== undefined ? el.dataset.numVal : el.value; }
function valChecked(id) { return document.getElementById(id)?.checked; }


function showTab(id) {
    // 1. Hide all tab content cards
    document.querySelectorAll('.tab-content, .card').forEach(c => {
        if (c.id.startsWith('tab-')) c.classList.add('hidden');
    });
    // 2. Show the selected card
    document.getElementById(id).classList.remove('hidden');

    // 3. Update the active button styling (Fixed Selector)
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.tab-btn[onclick*="${id}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Annual Details table width can only be measured while its tab is visible (#2).
    if (id === 'tab-tbl') syncTopScroll();
}


// ── Small-screen UX helpers ─────────────────────────────────────────────────
// The app's contextual help lives in title= attributes, which touch devices cannot hover.
// On hover-less devices a tap on any titled (non-interactive) element shows a dismissible
// popover instead; the title is moved to data-tip on first tap so no native tooltip doubles up.
// Also: on phones, fold the sidebar input sections so results are one short scroll away, and
// add a floating jump button that hops between inputs and results.
// Test hook: add ?touchtips to the URL to force the tap-tooltip behavior on a mouse device.
function setupSmallScreenUX() {
    const touch = (window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches)
        || location.search.includes('touchtips');
    if (touch) {
        const pop = document.createElement('div');
        pop.id = 'touch-tooltip';
        document.body.appendChild(pop);
        let anchor = null;
        const hide = () => { pop.style.display = 'none'; anchor = null; };
        document.addEventListener('click', (e) => {
            // Interactive elements keep their normal behavior (typing, tab switch, toggle).
            if (e.target.closest && e.target.closest('button, a, select, input, textarea')) { hide(); return; }
            const el = e.target.closest ? e.target.closest('[title], [data-tip]') : null;
            if (!el) { hide(); return; }
            if (el.getAttribute('title')) { el.dataset.tip = el.getAttribute('title'); el.removeAttribute('title'); }
            const tip = el.dataset.tip;
            if (!tip || el === anchor) { hide(); return; }
            anchor = el;
            pop.textContent = tip;
            pop.style.display = 'block';
            pop.style.left = '0px'; pop.style.top = '0px';   // reset before measuring
            const margin = 8;
            const r = el.getBoundingClientRect();
            const w = Math.min(pop.offsetWidth, window.innerWidth - 2 * margin);
            const left = Math.min(Math.max(margin, r.left), window.innerWidth - w - margin);
            let top = r.bottom + 6;
            if (top + pop.offsetHeight > window.innerHeight - margin) {
                top = Math.max(margin, r.top - pop.offsetHeight - 6);
            }
            pop.style.left = left + 'px';
            pop.style.top = top + 'px';
        });
        window.addEventListener('scroll', hide, { passive: true });
    }
    // innerWidth can read 0 in hidden/prerendered contexts - don't fold the desktop sidebar then.
    if (window.innerWidth > 0 && window.innerWidth < 768) {
        document.querySelectorAll('.sidebar details.section[open]').forEach(d => d.removeAttribute('open'));
    }
    // Floating jump button - display is CSS-gated to small screens.
    const jump = document.createElement('button');
    jump.id = 'mobile-jump';
    jump.type = 'button';
    jump.setAttribute('aria-label', 'Jump between inputs and results');
    jump.textContent = '⇅';
    jump.addEventListener('click', (e) => {
        e.stopPropagation();
        const main = document.querySelector('.main');
        const atInputs = window.scrollY + 10 < (main?.offsetTop ?? 0);
        (atInputs ? main : document.querySelector('.sidebar'))?.scrollIntoView({ behavior: 'smooth' });
    });
    document.body.appendChild(jump);
}

function setupAutoRecalc() {
    const LABELS = {
        spendGoal: 'Spend Goal', spendChange: 'Spend Δ%', strategy: 'Strategy',
        nYears: 'N Years', stratRate: 'Bracket', propWithdraw: 'Boost%',
        iraBaseGoal: 'IRA Goal', maximizeConversions: 'Max Conversions',
        convertExcessToRoth: 'Convert Excess', fundConversionWithCash: 'Fund w/ Cash',
        extraConversionAmount: 'Extra Conversion', convEndYear: 'Stop Conversions', convEndMode: 'Stop Scope',
        birthyear1: 'Your Birth', die1: 'Your Life Exp',
        birthyear2: 'Spouse Birth', die2: 'Spouse Life Exp',
        IRA1: 'Your IRA', IRA2: 'Spouse IRA',
        Brokerage: 'Brokerage', BrokerageBasis: 'Brok Basis',
        Roth: 'Roth', Cash: 'Cash',
        ss1: 'My SS', ss1Age: 'SS Age', ss2: 'Spouse SS', ss2Age: 'Spouse SS Age',
        pensionAnnual: 'Pension', pensionStartAge: 'Pension Age', survivorPct: 'Survivor%', pensionCola: 'Pension COLA',
        inflation: 'Inflation', cpi: 'CPI/COLA', growth: 'Growth', cashYield: 'Cash Yield',
        dividendRate: 'Dividends', STATEname: 'State Tax', ssFailYear: 'SS Fail Yr', ssFailPct: 'SS Payout%',
        taxRateCreep: 'Fed Tax Creep', taxCreepStartYear: 'Creep Start',
        birthmonth1: 'Your Birth Mo', birthmonth2: 'Spouse Birth Mo', dividendReinvest: 'Div Reinvest',
        cyclicEnabled: 'Cyclic',
        cyclicOrder:   'Cyclic Order'
    };
    let timer = null;
    function scheduleRecalc(el) {
        _lastChangedInputLabel = LABELS[el.id] || el.id;
        clearTimeout(timer);
        timer = setTimeout(() => {
            const tab = document.querySelector('.tab-btn.active')?.getAttribute('onclick') || '';
            // The Summary Header (Break Even and its ⓘ, End Wealth, taxes, Withdrawal Rate) is
            // rendered by runSimulation() and is visible on EVERY tab, including the Optimizer.
            // Running only runOptimizer() here left that header showing the previous plan until
            // something else happened to call runSimulation() -- the Chart and Annual Details tab
            // buttons do, which is why clicking either one appeared to "fix" it. Always refresh the
            // single-scenario run; it is one simulate() against the optimizer's ~1.3s sweep.
            runSimulation();
            if (tab.includes('tab-opt')) runOptimizer();
            // Monte Carlo has the same staleness problem but cannot be handled the same way: its
            // main sweep is numPaths x variations simulations (measured 27.4s on the default
            // scenario), so re-running it on every edit is not viable. mcInputsChanged() refreshes
            // only the cheap stress pass and flags the rest as out of date. See mc_tab.js.
            // Runs on EVERY tab, not just tab-mc, because the Stress Test tile it feeds lives in the
            // summary bar and is visible from everywhere. mcInputsChanged is a no-op when its own
            // hash has not moved, so a change Monte Carlo does not care about costs nothing.
            if (typeof mcInputsChanged === 'function') mcInputsChanged();
        }, 400);
    }
    document.querySelectorAll('.sidebar input, .sidebar select').forEach(el => {
        if (el.type === 'checkbox' || el.tagName === 'SELECT') {
            el.addEventListener('change', () => scheduleRecalc(el));
        } else {
            el.addEventListener('blur', () => scheduleRecalc(el));
        }
    });
    // Prime the Stress Test tile once on load so it reads a real number before the user touches
    // anything or visits the Monte Carlo tab. Deferred past the first paint because it spawns a
    // worker; the pass itself is ~10 simulations. Everything after this is driven by scheduleRecalc.
    setTimeout(() => { if (typeof mcInputsChanged === 'function') mcInputsChanged(); }, 600);
}


function onCyclicChange() {
    const on = !!valChecked('cyclicEnabled');
    const dripEl = document.getElementById('dividendReinvest');
    if (dripEl) {
        if (on) {
            dripEl.checked = true;
            dripEl.disabled = true;
        } else {
            dripEl.disabled = false;
        }
    }
}

// "Maximize Conversions" is a convenience control (data-no-share, never read by getInputs()):
// it WRITES both real flags, and DISPLAYS their combined state. The two real flags -
// convertExcessToRoth and fundConversionWithCash - are what the engine and the share URL use.
// Recalc is handled by setupAutoRecalc()'s change listener on this checkbox (it's in .sidebar),
// so these handlers only sync state - calling runSimulation() here would double-run.
function onMaximizeConversionsChange() {
    const on = !!valChecked('maximizeConversions');
    const cxr = document.getElementById('convertExcessToRoth');
    const fcc = document.getElementById('fundConversionWithCash');
    if (cxr) cxr.checked = on;
    if (fcc) fcc.checked = on;
}

// Keeps the convenience checkbox honest when the two sub-flags are set independently (nerd
// panel) or restored programmatically (URL / scenario / optimizer row / MC variation), none of
// which fire onchange. Indeterminate = exactly one of the two is on.
function onConvSubFlagChange() {
    const cxr = !!valChecked('convertExcessToRoth');
    const fcc = !!valChecked('fundConversionWithCash');
    const main = document.getElementById('maximizeConversions');
    if (main) {
        main.checked = cxr && fcc;
        main.indeterminate = cxr !== fcc;
    }
}

function toggleSpouseUI() {
    const on = !!valChecked('hasSpouse');
    document.querySelectorAll('.spouse-field').forEach(el => el.classList.toggle('spouse-disabled', !on));
    if (typeof refreshStratRateOptions === 'function') refreshStratRateOptions();
}

function toggleStrategyUI() {
    let m = val('strategy');
    document.getElementById('ui-fixed').classList.toggle('hidden', m !== 'fixed');
    document.getElementById('ui-bracket').classList.toggle('hidden', m !== 'bracket' && m !== 'minlimit');
    document.getElementById('ui-propwd').classList.toggle('hidden', m !== 'propwd');
    document.getElementById('ui-fixedpct').classList.toggle('hidden', m !== 'fixedpct');
    document.getElementById('ui-ordered').classList.toggle('hidden', m !== 'ordered');
    document.getElementById('ui-gk').classList.toggle('hidden', m !== 'gk' || !NERD_KNOBS);
    // document.getElementById('ui-maximize').classList.toggle('hidden', !(m === 'baseline'));
}


// ============================================================================
// URL SHARE / LOAD
// ============================================================================

const OPT_LONG_TO_SHORT = {
    spendGoal:'sg', spendChange:'sc', strategy:'str', nYears:'ny',
    propWithdraw:'pw', stratRate:'sr', iraWithdrawPct:'iwp', orderedSeq:'os',
    convertExcessToRoth:'mc', fundConversionWithCash:'fcc', extraConversionAmount:'eca', iraBaseGoal:'ibg',
    convEndYear:'cey', convEndMode:'cem', irmaaMarginMode:'imm',
    birthyear1:'by1', birthmonth1:'bm1', die1:'d1', startAge:'sa',
    birthyear2:'by2', birthmonth2:'bm2', die2:'d2', hasSpouse:'hs',
    IRA1:'i1', IRA2:'i2', Roth:'ro', Roth2:'ro2',
    Brokerage:'bk', BrokerageBasis:'bb', dividendReinvest:'dr', Cash:'ca', CashReserve:'cr',
    ss1:'ss1', ss1Age:'ss1a', ss2:'ss2', ss2Age:'ss2a',
    pensionAnnual:'pa', pensionStartAge:'psa', pensionCola:'pc', survivorPct:'sur', dividendRate:'div',
    STATEname:'s', ssFailYear:'sfy', ssFailPct:'sfp',
    taxRateCreep:'trc', taxCreepStartYear:'tcy',
    growth:'g', cashYield:'cy', inflation:'inf', cpi:'cpi', futureIRATaxRate:'fitr',
    comp_IRA1_ratio:'c1r', comp_IRA1_intl:'c1x',
    comp_IRA2_ratio:'c2r', comp_IRA2_intl:'c2x',
    comp_Brokerage_ratio:'cbr', comp_Brokerage_intl:'cbx',
    comp_Roth1_ratio:'cr1r', comp_Roth1_intl:'cr1x',
    comp_Roth2_ratio:'cr2r', comp_Roth2_intl:'cr2x',
    'show-current-dollars':'cd', optimizeSpend:'opt', includeConvOpt:'copt',
    cyclicEnabled:'cyc',
    qcdHHMax:'qm', qcdAlways:'qa',
    gkGuard:'gkg', gkAdjPct:'gka',
};

const OPT_SHORT_TO_LONG = Object.fromEntries(
    Object.entries(OPT_LONG_TO_SHORT).map(([l, s]) => [s, l])
);


// Pristine default snapshot - captured once at init BEFORE loadFromURL mutates any field.
// Single source of truth for default-omission: buildShareURL omits a param when its current
// value equals this snapshot, and loadFromURL leaves absent params at their (default) markup
// value, so the two stay symmetric.
// Shareable/snapshotted inputs: the sidebar, plus the Optimizer tab's own search options
// (Optimize Spend / Optimize Conversions live in #tab-opt since they only drive runOptimizer(),
// but they are still URL-shareable - 'opt'/'copt' in OPT_LONG_TO_SHORT - so they must be in
// this selector or buildShareURL would silently stop emitting them while loadFromURL kept
// restoring them, an asymmetric round-trip.)
const SHARE_INPUT_SELECTOR = '.sidebar input, .sidebar select, #opt-search-options input';
const OPT_DEFAULTS = {};
function captureDefaults() {
    document.querySelectorAll(SHARE_INPUT_SELECTOR).forEach(el => {
        if (!el.id || el.dataset.noShare !== undefined) return;
        if (el.type === 'checkbox') {
            OPT_DEFAULTS[el.id] = { c: el.checked };
        } else {
            // Normalize dollars numerically so the comparison is robust to formatting.
            const num = DisplayHelpers.parseShorthand(el.value);   // null for non-numeric (selects/strings)
            OPT_DEFAULTS[el.id] = { v: el.value, n: num };
        }
    });
}

function buildShareURL() {
    const params = new URLSearchParams();
    document.querySelectorAll(SHARE_INPUT_SELECTOR).forEach(el => {
        if (!el.id || el.dataset.noShare !== undefined) return;
        const def = OPT_DEFAULTS[el.id];
        const short = OPT_LONG_TO_SHORT[el.id] ?? el.id;
        if (el.type === 'checkbox') {
            if (def && el.checked === def.c) return;                 // omit default
            params.set(short, el.checked ? '1' : '0');
        } else if (el.dataset.numVal !== undefined) {               // dollar field
            const cur = Number(el.dataset.numVal);
            if (def && def.n !== null && cur === def.n) return;     // omit default
            params.set(short, compactNum(el.dataset.numVal));
        } else {
            if (def && el.value === def.v) return;                  // omit default
            params.set(short, el.value);
        }
    });
    // P64e: these have no DOM field, so the loop above cannot see them. Re-emit them or a shared
    // link silently drops a figure the recipient never had a way to re-enter.
    if (PROP_TAX_STATE) {
        params.set('ptx', String(PROP_TAX_STATE.propTax));
        if (PROP_TAX_STATE.propTaxGrowthMode !== 'inflation') params.set('ptxm', PROP_TAX_STATE.propTaxGrowthMode);
        if (PROP_TAX_STATE.propTaxGrowthMode === 'custom') params.set('ptxr', String(PROP_TAX_STATE.propTaxGrowthRate * 100));
    }
    const base = location.href.split('?')[0].split('#')[0];
    return base + '?' + params.toString();
}

function toggleSharePanel() {
    const panel = document.getElementById('share-panel');
    const input = document.getElementById('share-url-input');
    const isOpen = panel.style.display === 'block';
    if (isOpen) { panel.style.display = 'none'; return; }
    input.value = buildShareURL();
    document.getElementById('share-status').textContent = '';
    panel.style.display = 'block';
    requestAnimationFrame(() => { input.select(); });
}

async function copyShareURL() {
    const input  = document.getElementById('share-url-input');
    const status = document.getElementById('share-status');
    input.select();
    try {
        await navigator.clipboard.writeText(input.value);
        status.textContent = '✓ Copied to clipboard';
        return;
    } catch {}
    try {
        document.execCommand('copy');
        status.textContent = '✓ Copied to clipboard';
    } catch {
        status.textContent = 'Select the URL above and press Ctrl+C / Cmd+C';
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
        const panel = document.getElementById('share-panel');
        if (panel && panel.style.display === 'block' &&
            !panel.contains(e.target) &&
            !e.target.closest('[onclick="toggleSharePanel()"]')) {
            panel.style.display = 'none';
        }
    });
}

function loadFromURL() {
    const raw = new URLSearchParams(location.search);
    if (!raw.size) return;
    const params = new URLSearchParams();
    raw.forEach((v, k) => params.set(OPT_SHORT_TO_LONG[k] ?? k, v));
    // Legacy: maxConversion was renamed to convertExcessToRoth. Short-coded links ('mc') resolve
    // for free via OPT_SHORT_TO_LONG; this covers a raw long-form param. fundConversionWithCash
    // is deliberately NOT implied - old links predate it and must keep their exact behavior.
    if (params.has('maxConversion') && !params.has('convertExcessToRoth')) {
        params.set('convertExcessToRoth', params.get('maxConversion'));
    }
    params.forEach((value, key) => {
        const el = document.getElementById(key);
        if (!el) return;
        if (el.type === 'checkbox') {
            el.checked = (value === '1' || value === 'true');   // new '1'/'0' + legacy 'true'/'false'
        } else {
            const decoded = DisplayHelpers.parseShorthand(value);
            // `data-plain` marks a numeric TEXT field that is NOT a dollar amount (e.g. the
            // conversion stop year/age) - it must keep its literal value, not be reformatted as
            // "$2,031". Without this, any numeric text input gets the dollar treatment on load.
            if (decoded !== null && (el.type === 'text' || el.type === '') && el.dataset.plain === undefined) {
                el.dataset.numVal = String(decoded);
                el.value = DisplayHelpers.formatDollar(decoded);
            } else {
                el.value = value;
                if (el.tagName === 'SELECT' && el.selectedIndex === -1) {
                    // Legacy case-mismatch (e.g. old shared links using 'irmaa2' before the
                    // IRMAA-casing cleanup renamed dropdown values to 'IRMAA2') - a native
                    // <select> silently deselects on a case-sensitive miss, so fall back to a
                    // case-insensitive option match to keep old URLs working.
                    const match = Array.from(el.options).find(o => o.value.toLowerCase() === value.toLowerCase());
                    if (match) el.value = match.value;
                }
            }
        }
    });
    toggleStrategyUI();
    onConvSubFlagChange();   // .checked set programmatically above → no change event; resync the convenience checkbox
    maybeWarnCashReserveActive();
    runSimulation();
}

// One-time load warning: a shared URL or saved scenario that carries an ACTIVE Cash Reserve
// (Off/blank/negative = off, so >= 0 is active) now behaves differently than in releases before
// the surplus-reinvestment feature. Fire only on load (loadFromURL/applyScenario), never on recalc.
function maybeWarnCashReserveActive() {
    const raw = (document.getElementById('CashReserve')?.value ?? '').toString().trim();
    if (raw === '' || raw.toLowerCase() === 'off') return;
    const n = DisplayHelpers.parseShorthand(raw);
    const v = (n == null || Number.isNaN(n)) ? +raw : n;
    if (!Number.isFinite(v) || v < 0) return;   // Off/blank/negative = off, no change to warn about
    showMessage('Note: this scenario sets a Cash Reserve, which now reinvests surplus above it into your Brokerage. Results differ from releases before this feature. Set Cash Reserve blank (or -1) to restore the original all-cash behavior.', 'warning');
}


/* Save, Import and Export settings/Scenarios
*/
///////////////////////////////////////////////
// ============================================================================


// ============================================================================
// MESSAGE DISPLAY FUNCTIONS
// ============================================================================

/**
 * Displays a colored message in the scenario message area
 * @param {string} message - The text message to display
 * @param {string} type - Message type: 'success' (green), 'error' (red), or 'warning' (yellow)
 *                        Default is 'success'
 * Auto-hides the message after 5 seconds
 */
function showMessage(message, type = 'success') {
    const messageDiv = document.getElementById('popUpMessage');
    messageDiv.textContent = message;
    messageDiv.className = `scenario-message ${type}`;
    messageDiv.style.display = 'block';

    // Auto-hide after 15 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 15000);
}

/**
 * Manually clears and hides the message display area
 * No parameters
 */
function clearMessage() {
    const messageDiv = document.getElementById('popUpMessage');
    messageDiv.style.display = 'none';
}

// ============================================================================
// STORAGE ACCESS FUNCTIONS
// ============================================================================

/**
 * Retrieves all scenarios from the new storage key
 * No parameters
 * @returns {Object} Object containing scenario data keyed by scenario name
 *                   Returns empty object {} if no scenarios exist
 */
function getSavedScenarios() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
}

/**
 * Retrieves all scenarios from the old storage key (previous version)
 * No parameters
 * @returns {Object} Object containing old scenario data keyed by scenario name
 *                   Returns empty object {} if no old scenarios exist
 */
function getOldScenarios() {
    const oldSaved = localStorage.getItem(OLD_STORAGE_KEY);
    return oldSaved ? JSON.parse(oldSaved) : {};
}

/**
 * Retrieves and merges scenarios from both old and new storage locations
 * Old scenarios are marked with isOldStorage flag and version 1
 * No parameters
 * @returns {Object} Merged object containing all scenarios from both storage keys
 *                   Old scenarios have isOldStorage: true property added
 */
function getAllScenarios() {
    const newScenarios = getSavedScenarios();
    const oldScenarios = getOldScenarios();

    // Merge old scenarios, marking them as version 1
    const allScenarios = { ...newScenarios };

    for (const [name, scenario] of Object.entries(oldScenarios)) {
        // If scenario doesn't have a version property, it's from old version
        if (!scenario.version) {
            allScenarios[name] = {
                version: 1,
                data: scenario.data || scenario, // Handle different old formats
                savedAt: scenario.savedAt || 'Unknown',
                isOldStorage: true // Flag to identify old storage scenarios
            };
        }
    }

    return allScenarios;
}

// ============================================================================
// SCENARIO VALIDATION FUNCTIONS
// ============================================================================

/**
 * Checks if a scenario is compatible with the current version
 * @param {Object} scenario - Scenario object with version property
 * @returns {boolean} True if scenario.version matches SCENARIO_VERSION, false otherwise
 */
function isCompatibleScenario(scenario) {
    return scenario.version === SCENARIO_VERSION;
}

/**
 * Escapes single and double quotes in a string for safe use in HTML attributes
 * @param {string} str - String to escape
 * @returns {string} String with ' replaced by \' and " replaced by \"
 */
function escapeQuotes(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}


// ============================================================================
// MAIN USER ACTION FUNCTIONS
// ============================================================================

/**
 * Saves current form inputs as a named scenario to new storage
 * Uses scenario name from input field #scenarioName, or generates timestamp name if empty
 * Calls getInputs() to retrieve current form values
 * Displays success or error message
 * No parameters
 */
function saveScenario() {
    const inputs = getInputs();
    const scenarioName = document.getElementById('scenarioName').value.trim() ||
        `${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;

    try {
        const scenarios = getSavedScenarios();

        scenarios[scenarioName] = {
            version: SCENARIO_VERSION,
            data: inputs,
            savedAt: new Date().toISOString()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));

        showMessage(`Scenario "${scenarioName}" saved successfully!`, 'success');
        document.getElementById('scenarioName').value = '';
    } catch (error) {
        showMessage(`Failed to save scenario: ${error.message}`, 'error');
    }
}

/**
 * Prompts user to select and load a compatible scenario
 * Filters out incompatible versions before displaying list
 * Shows error if no compatible scenarios exist
 * No parameters
 */
function loadScenario() {
    try {
        const scenarios = getSavedScenarios();
        const scenarioNames = Object.keys(scenarios);

        if (scenarioNames.length === 0) {
            showMessage('No saved scenarios found.', 'error');
            return;
        }

        const compatibleScenarios = scenarioNames.filter(name =>
            scenarios[name].version === SCENARIO_VERSION
        );

        if (compatibleScenarios.length === 0) {
            showMessage('No compatible scenarios found. All saved scenarios are from an older version.', 'error');
            return;
        }

        let selection = prompt('Enter scenario name to load:\n\n' + compatibleScenarios.join('\n'));

        if (selection && scenarios[selection]) {
            if (scenarios[selection].version !== SCENARIO_VERSION) {
                showMessage('This scenario is from an incompatible version and cannot be loaded.', 'error');
                return;
            }
            applyScenario(scenarios[selection].data);
            showMessage(`Scenario "${selection}" loaded successfully!`, 'success');
        } else if (selection) {
            showMessage('Scenario not found.', 'error');
        }
    } catch (error) {
        showMessage(`Failed to load scenario: ${error.message}`, 'error');
    }
}

/**
 * Applies scenario data to form input fields
 * Handles percentage conversions for specific fields (multiplies by 100 for display)
 * Triggers recalculate() function if it exists
 * @param {Object} data - Scenario data object with keys matching form input IDs
 */
const DOLLAR_INPUT_IDS = new Set([
    'spendGoal', 'iraBaseGoal', 'IRA1', 'IRA2', 'Roth', 'Roth2',
    'Brokerage', 'BrokerageBasis', 'Cash', 'CashReserve', 'ss1', 'ss2', 'pensionAnnual',
    'extraConversionAmount'
]);

function applyScenario(data) {
    // Legacy: scenarios saved before the rename store maxConversion. Map it to its renamed
    // continuation; fundConversionWithCash stays at its own default (those scenarios predate it,
    // so implying it would silently change their numbers).
    if (data.maxConversion !== undefined && data.convertExcessToRoth === undefined) {
        data = { ...data, convertExcessToRoth: data.maxConversion };
    }

    // Handle IRMAA / ACA stratRate values that don't map to a plain numeric key
    if ((data.stratIRMAATier ?? -1) >= 0) {
        const el = document.getElementById('stratRate');
        if (el) el.value = `IRMAA${data.stratIRMAATier}`;
    } else if ((data.stratACAMultiple ?? 0) > 0) {
        const el = document.getElementById('stratRate');
        if (el) el.value = `aca${data.stratACAMultiple}`;
    }

    // 'aca' is an internal strict strategy; the dropdown represents it as 'bracket' + ACA
    // stratRate (set above). Map it back so the (option-less) strategy dropdown stays valid.
    if (data.strategy === 'aca') {
        const el = document.getElementById('strategy');
        if (el) el.value = 'bracket';
    }

    // qcdMode is stored as 'always'/'asneeded' string but the UI element is qcdAlways checkbox
    if (data.qcdMode !== undefined) {
        const el = document.getElementById('qcdAlways');
        if (el) el.checked = (data.qcdMode === 'always');
    }

    // propTax has no DOM element - it is entered via the share URL, not a form field - so it would
    // otherwise fall through the generic getElementById loop below and be silently dropped on every
    // scenario load, despite saveScenario() having written it into the saved JSON. Restore it into
    // the same mutable slot getInputs() and buildShareURL() both read. Absent key = leave the
    // current value alone, the same convention every other field in this loop follows (a scenario
    // saved before this feature, or without ?ptx active, does not carry the key at all).
    if (data.propTax !== undefined) {
        PROP_TAX_STATE = {
            propTax: data.propTax,
            propTaxGrowthMode: data.propTaxGrowthMode || 'inflation',
            propTaxGrowthRate: data.propTaxGrowthRate || 0,
        };
    }

    for (const [key, value] of Object.entries(data)) {
        // stratIRMAATier has no standalone form element; handled above via stratRate dropdown
        if (key === 'stratIRMAATier') continue;
        if (key === 'stratACAMultiple') continue;
        // strategy='aca' has no dropdown option; mapped to 'bracket' above
        if (key === 'strategy' && value === 'aca') continue;
        // qcdMode maps to qcdAlways checkbox; handled above
        if (key === 'qcdMode') continue;
        const element = document.getElementById(key);
        if (element) {
            // Handle percentage values (multiply by 100 for display). getInputs() stores these as
            // decimals (e.g. gkGuard 20% → 0.20), so they MUST be scaled back ×100 on load or the
            // field shows 0.2 and the next getInputs() re-divides to 0.002 (GK then reads guard=0).
            // NOTE: taxCreepStartYear is a calendar year, NOT a percent - it must stay out of
            // this list or it reloads as 202600.
            if (['spendChange', 'inflation', 'cpi', 'growth',
                'cashYield', 'dividendRate', 'ssFailPct',
                'propWithdraw', 'iraWithdrawPct', 'taxRateCreep',
                'gkGuard', 'gkAdjPct', 'futureIRATaxRate'].includes(key)) {
                element.value = (value * 100).toFixed(3);
            } else if (key === 'stratRate' && ((data.stratIRMAATier ?? -1) >= 0 || (data.stratACAMultiple ?? 0) > 0)) {
                // Already set the dropdown above (IRMAA or ACA); skip numeric override
            } else if (key === 'stratRate') {
                element.value = (value * 100).toFixed(3);
            } else {
                if (['convertExcessToRoth', 'fundConversionWithCash', 'pensionCola', 'dividendReinvest', 'cyclicEnabled'].includes(key)) {
                    element.checked = !!value;
                } else if (DOLLAR_INPUT_IDS.has(key)) {
                    DisplayHelpers.setDollarValue(key, value);
                } else {
                    element.value = value;
                }
            }
        }
    }

    // Infer hasSpouse from data (explicit flag, or legacy: birthyear2 > 0)
    const hasSpouseEl = document.getElementById('hasSpouse');
    if (hasSpouseEl) {
        hasSpouseEl.checked = data.hasSpouse !== undefined ? !!data.hasSpouse : (data.birthyear2 > 0);
        if (typeof toggleSpouseUI === 'function') toggleSpouseUI();
    }

    // Sync strategy sub-UI to the newly loaded strategy value
    if (typeof toggleStrategyUI === 'function') toggleStrategyUI();

    // Resync the "Maximize Conversions" convenience checkbox to the two restored sub-flags
    if (typeof onConvSubFlagChange === 'function') onConvSubFlagChange();

    // Sync MC mode UI (grays out μ/σ when bootstrap mode is restored from scenario)
    if (typeof updateMCModeUI === 'function') updateMCModeUI();

    // Re-run the nerdknob gating: a scenario carrying a non-zero tax creep must reveal that row
    // even without nerdknob, or the plan silently runs on an assumption the user cannot see.
    if (typeof applyNerdKnobVisibility === 'function') applyNerdKnobVisibility();

    // Refresh derived/display fields that normally update via oninput handlers. Setting .value
    // programmatically does NOT fire those handlers, so the "Real Growth" line, age/RMD readouts,
    // bracket dropdown, and other hints would otherwise show stale values after a scenario load.
    if (typeof updateGrowthDisplay === 'function') updateGrowthDisplay();      // Real Growth under Growth field (uses growth, inflation, dividendRate)
    if (typeof syncMCMuFromGrowth === 'function') syncMCMuFromGrowth();        // MC μ tracks Growth
    if (typeof updateProfileAgeDisplay === 'function') updateProfileAgeDisplay(); // ages / RMD start / projected RMD
    if (typeof refreshStratRateOptions === 'function') refreshStratRateOptions(); // bracket/IRMAA labels (CPI + filing status)
    if (typeof updateBracketFeedback === 'function') updateBracketFeedback();
    // The loaded scenario is the new restore baseline. spendGoal was set programmatically via
    // setDollarValue, which does NOT fire the field's oninput="_priorSpendGoal=null", so a stale
    // pre-load "Restore: $X" (often the original default) would otherwise cling to the ⓘ icon.
    // Clear it: the icon now recalculates a fresh suggestion for the loaded inputs, and once the
    // user applies it, restore targets the goal loaded from the file - not the default.
    _priorSpendGoal = null;
    if (typeof updateSuggestSpendTooltip === 'function') updateSuggestSpendTooltip();
    if (typeof updateIRAGoalHint === 'function') updateIRAGoalHint();
    if (typeof updateCompAdvisory === 'function') updateCompAdvisory();

    maybeWarnCashReserveActive();

    // Trigger any recalculations your app needs
    if (typeof runSimulation === 'function') {
        runSimulation();
    }

    // The Stress Test tile in the summary bar is NOT written by runSimulation(); it is fed by
    // mcInputsChanged(), which is normally driven by the sidebar's blur/change listeners in
    // setupAutoRecalc. This function sets .value/.checked programmatically, which fires neither, so
    // loading a scenario left the tile showing the PREVIOUS plan's "N of M fail" until the user
    // edited a field by hand or opened the Monte Carlo tab. That is issue #177, and the reporter
    // read it as the scenario not having loaded at all.
    //
    // Guarded on readyState because BOOT is already covered by the one-shot prime in
    // setupAutoRecalc. At DOMContentLoaded this function runs BEFORE loadFromURL, so an unguarded
    // call would start a stress pass against the pre-URL plan; if that pass were still in flight
    // 600ms later the prime would be dropped by refreshMCStressOnly's own busy guard, and a share
    // URL would settle showing the DEFAULT plan's numbers. readyState is 'interactive' during
    // DOMContentLoaded and 'complete' by the time any Load or Import button can be clicked.
    if (document.readyState === 'complete' && typeof mcInputsChanged === 'function') mcInputsChanged();
}

// ============================================================================
// SCENARIO MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Opens modal dialog showing all scenarios from both storage locations
 * Displays table with Name, Saved Date, Version, Storage location, and Actions
 * Shows compatibility status with color coding (green=compatible, red=incompatible)
 * Shows bulk action buttons if incompatible or old scenarios exist
 * No parameters
 */
function manageScenarios() {
    const scenarios = getAllScenarios();
    const modal = document.getElementById('scenarioModal');
    const content = document.getElementById('scenarioListContent');

    if (Object.keys(scenarios).length === 0) {
        content.innerHTML = '<p>No saved scenarios.</p>';
    } else {
        let html = '<table style="width: 100%; border-collapse: collapse;">';
        html += '<tr><th style="text-align: left; padding: 8px; border-bottom: 2px solid #ddd;">Name</th>';
        html += '<th style="text-align: left; padding: 8px; border-bottom: 2px solid #ddd;">Saved</th>';
        html += '<th style="text-align: center; padding: 8px; border-bottom: 2px solid #ddd;">Version</th>';
        html += '<th style="text-align: center; padding: 8px; border-bottom: 2px solid #ddd;">Actions</th></tr>';

        for (const [name, scenario] of Object.entries(scenarios)) {
            const savedDate = scenario.savedAt !== 'Unknown'
                ? new Date(scenario.savedAt).toLocaleString()
                : 'Unknown';
            const version = scenario.version || 1;
            const isCurrent = version === SCENARIO_VERSION;
            const isOldStorage = scenario.isOldStorage || false;

            const versionBadge = isCurrent
                ? `<span style="color: green; font-weight: bold;">v${version} ✓</span>`
                : `<span style="color: red;">v${version} ✗</span>`;

            const storageBadge = isOldStorage
                ? `<span style="color: orange; font-size: 0.9em;">OLD</span>`
                : `<span style="color: blue; font-size: 0.9em;">NEW</span>`;

            const rowStyle = isCurrent ? '' : 'background-color: #ffeeee;';

            html += `<tr style="${rowStyle}">
                <td style="padding: 4px; border-bottom: 1px solid #eee;">${name}</td>
                <td style="padding: 4px; border-bottom: 1px solid #eee;">${savedDate}</td>
                <td style="padding: 4px; border-bottom: 1px solid #eee; text-align: center;">${versionBadge}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
					<button class="modal-btn" onclick="loadScenarioByName('${escapeQuotes(name)}')" ${!isCurrent ? 'disabled title="Incompatible version"' : ''}>Load</button>
					<button class="modal-btn" onclick="deleteScenario('${escapeQuotes(name)}')">Delete</button>
					<button class="modal-btn" onclick="exportScenario('${escapeQuotes(name)}')">Export</button>
                </td>
            </tr>`;
        }
        html += '</table>';

        const incompatibleCount = Object.values(scenarios).filter(s => !isCompatibleScenario(s)).length;
        const oldStorageCount = Object.values(scenarios).filter(s => s.isOldStorage).length;

        if (incompatibleCount > 0 || oldStorageCount > 0) {
            html += `<div style="margin-top: 15px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">`;

            if (incompatibleCount > 0) {
                html += `<strong>⚠️ ${incompatibleCount} incompatible scenario(s) found</strong><br>`;
            }
            if (oldStorageCount > 0) {
                html += `<strong>📦 ${oldStorageCount} scenario(s) in old storage format</strong><br>`;
            }

            html += `<button onclick="deleteIncompatibleScenarios()" style="margin-top: 5px;">Delete All Incompatible Scenarios</button>`;

            html += `</div>`;
        }

        content.innerHTML = html;
    }

    modal.style.display = 'block';
}

/**
 * Loads a specific scenario by name from either storage location
 * Validates version compatibility before loading
 * Closes modal and shows success/error message
 * @param {string} name - Name of the scenario to load
 */
function loadScenarioByName(name) {
    try {
        const scenarios = getAllScenarios();
        if (scenarios[name]) {
            if (!isCompatibleScenario(scenarios[name])) {
                showMessage(`Scenario "${name}" is from an incompatible version (v${scenarios[name].version || 1}) and cannot be loaded. Current version: v${SCENARIO_VERSION}`, 'error');
                return;
            }
            applyScenario(scenarios[name].data);
            closeScenarioModal();
            showMessage(`Scenario "${name}" loaded successfully!`, 'success');
        }
    } catch (error) {
        showMessage(`Failed to load scenario: ${error.message}`, 'error');
    }
}

/**
 * Deletes a specific scenario from appropriate storage location
 * Determines whether scenario is in old or new storage and deletes from correct location
 * Prompts for confirmation before deletion
 * Updates the management view and shows message
 * @param {string} name - Name of the scenario to delete
 */
function deleteScenario(name) {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
        try {
            const allScenarios = getAllScenarios();
            const scenario = allScenarios[name];

            if (scenario.isOldStorage) {
                // Delete from old storage
                const oldScenarios = getOldScenarios();
                delete oldScenarios[name];
                if (Object.keys(oldScenarios).length > 0) {
                    localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify(oldScenarios));
                } else {
                    localStorage.removeItem(OLD_STORAGE_KEY);
                }
            } else {
                // Delete from new storage
                const scenarios = getSavedScenarios();
                delete scenarios[name];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
            }

            manageScenarios();
            showMessage(`Scenario "${name}" deleted successfully.`, 'success');
        } catch (error) {
            showMessage(`Failed to delete scenario: ${error.message}`, 'error');
        }
    }
}

/**
 * Closes the scenario management modal dialog
 * No parameters
 */
function closeScenarioModal() {
    document.getElementById('scenarioModal').style.display = 'none';
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Deletes all scenarios that don't match SCENARIO_VERSION
 * Works across both old and new storage locations
 * Prompts for confirmation showing count and names of scenarios to delete
 * Removes old storage key if all old scenarios are deleted
 * Shows success/error message
 * No parameters
 */
function deleteIncompatibleScenarios() {
    const scenarios = getAllScenarios();
    const incompatibleNames = Object.keys(scenarios).filter(name =>
        !isCompatibleScenario(scenarios[name])
    );

    if (incompatibleNames.length === 0) {
        showMessage('No incompatible scenarios found.', 'warning');
        return;
    }

    if (confirm(`Delete ${incompatibleNames.length} incompatible scenario(s)?\n\n${incompatibleNames.join('\n')}`)) {
        try {
            const newScenarios = getSavedScenarios();
            const oldScenarios = getOldScenarios();

            // Delete from both storage locations
            incompatibleNames.forEach(name => {
                delete newScenarios[name];
                delete oldScenarios[name];
            });

            localStorage.setItem(STORAGE_KEY, JSON.stringify(newScenarios));

            // Only save old scenarios if there are any left
            if (Object.keys(oldScenarios).length > 0) {
                localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify(oldScenarios));
            } else {
                localStorage.removeItem(OLD_STORAGE_KEY);
            }

            manageScenarios();
            showMessage(`${incompatibleNames.length} incompatible scenario(s) deleted.`, 'success');
        } catch (error) {
            showMessage(`Failed to delete scenarios: ${error.message}`, 'error');
        }
    }
}

// ============================================================================
// IMPORT/EXPORT FUNCTIONS
// ============================================================================

/**
 * Exports a single scenario to JSON file
 * Works with scenarios from either storage location
 * Downloads file with scenario name as filename
 * Shows success or error message
 * @param {string} name - Name of the scenario to export
 */
function exportScenario(name) {
    try {
        const scenarios = getAllScenarios();
        const scenario = scenarios[name];

        const dataStr = JSON.stringify(scenario, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${name}.json`;
        link.click();

        URL.revokeObjectURL(url);
        showMessage(`Scenario "${name}" exported successfully.`, 'success');
    } catch (error) {
        showMessage(`Failed to export scenario: ${error.message}`, 'error');
    }
}

/**
 * Opens file picker to import scenario from JSON file
 * Warns about version incompatibility if versions don't match
 * Prompts for scenario name (defaults to filename without extension)
 * Adds imported scenario to new storage location
 * Shows success, warning, or error message
 * No parameters
 */
function importScenario() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const scenario = JSON.parse(event.target.result);

                if (scenario.version && scenario.version !== SCENARIO_VERSION) {
                    if (!confirm(`Warning: This scenario is from version ${scenario.version}, current version is ${SCENARIO_VERSION}.\n\nIt may not load correctly. Continue anyway?`)) {
                        showMessage('Import cancelled.', 'warning');
                        return;
                    }
                }

                const name = prompt('Enter name for imported scenario:', file.name.replace('.json', ''));

                if (name) {
                    const scenarios = getSavedScenarios();
                    scenarios[name] = scenario;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
                    // Apply immediately so Import also loads into the form (not just stages to
                    // localStorage). scenario.data is the field map; fall back to scenario for
                    // legacy flat exports without a .data wrapper.
                    applyScenario(scenario.data ?? scenario);
                    showMessage(`Scenario "${name}" imported and loaded!`, 'success');
                } else {
                    showMessage('Import cancelled.', 'warning');
                }
            } catch (error) {
                showMessage(`Error importing scenario: ${error.message}`, 'error');
            }
        };

        reader.onerror = () => {
            showMessage('Failed to read file.', 'error');
        };

        reader.readAsText(file);
    };

    input.click();
}

/**
 * Exports all scenarios from new storage to single JSON file
 * Downloads with date-stamped filename (format: all-scenarios-YYYY-MM-DD.json)
 * Shows warning if no scenarios exist, otherwise shows success or error message
 * No parameters
 */
function exportAllScenarios() {
    try {
        const scenarios = getSavedScenarios();

        if (Object.keys(scenarios).length === 0) {
            showMessage('No scenarios to export.', 'warning');
            return;
        }

        const dataStr = JSON.stringify(scenarios, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `all-scenarios-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
        showMessage(`All scenarios exported successfully.`, 'success');
    } catch (error) {
        showMessage(`Failed to export scenarios: ${error.message}`, 'error');
    }
}


// Scan the TAXData for state tax tables and add them to the choice list.
function generateStateOptions() {
    let html = '\n';

    const stateKeys = Object.keys(TAXData).filter(key => key.length === 2);
    stateKeys.sort();

    stateKeys.forEach(stateCode => {
        const stateData = TAXData[stateCode];

        let rates = stateData.MFJ.brackets.map(b => b.r);
        let lowestRate = (Math.min(...rates) * 100).toFixed(1) + '%';
        let highestRate = (Math.max(...rates) * 100).toFixed(1) + '%';
        let rateList = lowestRate === highestRate ? lowestRate : lowestRate + " to " + highestRate

        const selectedAttr = stateData.Default === true ? ' selected' : '';
        html += `<option value="${stateCode}"${selectedAttr}>${stateData.STATE}: ${rateList}</option>\n`;
    });

    return html;
}

// Base year of the TAXData bracket values. Used to CPI-adjust displayed limits.
const TAX_DATA_BASE_YEAR = 2025;

/**
 * Returns the filing status (MFJ or SGL) to use for the bracket dropdown.
 * MFJ if both spouses survive into the current calendar year, SGL otherwise.
 */
function getDropdownStatus() {
    if (!valChecked('hasSpouse')) return 'SGL';
    const currentYear = new Date().getFullYear();
    const die1Year = (+document.getElementById('birthyear1')?.value || 1960)
                   + (+document.getElementById('die1')?.value || 88);
    const die2Year = (+document.getElementById('birthyear2')?.value || 1952)
                   + (+document.getElementById('die2')?.value || 98);
    return (die1Year > currentYear && die2Year > currentYear) ? 'MFJ' : 'SGL';
}

/**
 * Shows real (after-inflation) growth and flags unusually high/low nominal rates.
 * Called from growth and inflation oninput handlers and on DOMContentLoaded.
 */
function updateGrowthDisplay() {
    const el = document.getElementById('growth-info');
    if (!el) return;
    const growth    = parseFloat(document.getElementById('growth')?.value);
    const inflation = parseFloat(document.getElementById('inflation')?.value);
    if (isNaN(growth) || isNaN(inflation)) { el.innerHTML = ''; return; }

    // Fisher equation: real = (1+g)/(1+d)/(1+i) - 1, including dividend yield
    const div = parseFloat(document.getElementById('dividendRate')?.value) || 0;
    const realPct = ((1 + growth / 100) * (1 + div / 100) / (1 + inflation / 100) - 1) * 100;
    const sign = realPct >= 0 ? '+' : '';
    const totalNominal = growth + div;
    let html = `Real growth: <strong>${sign}${realPct.toFixed(1)}%</strong>`
             + ` <span style="color:#888;">(${totalNominal.toFixed(1)}% nominal [${growth}% price + ${div}% div] &minus; ${inflation}% inflation)</span>`;

    if (growth > 10) {
        html += `<br><span style="color:#b45309;">⚠ Optimistic - S&amp;P 500 long-run nominal CAGR is ~10%; diversified portfolios typically 6–9%.</span>`;
    } else if (growth < 3) {
        html += `<br><span style="color:#b45309;">⚠ Pessimistic - below typical equity range (6–10% nominal). Appropriate only for very conservative (mostly-bond) allocations.</span>`;
    }

    el.innerHTML = html;
}

/**
 * Update bracket constraint feedback display.
 * Shows current bracket limit and warns if desired spend exceeds feasible amount.
 */
function updateBracketFeedback() {
    const stratRateEl = document.getElementById('stratRate');
    const feedbackEl = document.getElementById('bracket-feedback');
    const spendGoalEl = document.getElementById('spendGoal');

    if (!stratRateEl || !feedbackEl || !spendGoalEl) return;

    const selectedOption = stratRateEl.options[stratRateEl.selectedIndex];
    if (!selectedOption) return;

    const spendGoalStr = (spendGoalEl.value || '140000').toString().replace(/[^\d.-]/g, '');
    const spendGoal = parseFloat(spendGoalStr) || 140000;
    const label = selectedOption.text; // e.g., "24% Fed  ·  $414,849"

    // Extract bracket limit from option text
    // Try multiple patterns: "$414,849", "$414849", etc.
    let bracketLimit = null;
    const limitMatches = label.match(/\$[\s]*(\d+(?:,\d{3})*|\d+)/g);
    if (limitMatches && limitMatches.length > 0) {
        // Get the last dollar amount (usually the limit)
        const lastMatch = limitMatches[limitMatches.length - 1];
        bracketLimit = parseInt(lastMatch.replace(/[^\d]/g, ''));
    }

    if (!bracketLimit || isNaN(bracketLimit)) {
        feedbackEl.innerHTML = '';
        return;
    }

    // Federal bracket containing the selected ceiling - useful when the strategy is an IRMAA/ACA
    // tier (whose label shows no federal rate). bracketLimit is already CPI-adjusted current-$.
    const fedRate = federalBracketRateAt(bracketLimit);
    const fedNote = fedRate != null ? ` <span style="color:#888;">(${fedRate}% federal bracket)</span>` : '';

    // Estimate max feasible spend (simplified: bracket limit is approx max MAGI)
    // In reality this depends on tax rates and account composition, but this gives a rough indicator
    const estimatedMaxSpend = Math.round(bracketLimit * 0.95); // Slight buffer for estimation error

    if (spendGoal <= estimatedMaxSpend) {
        // Within bracket
        feedbackEl.innerHTML = `✓ Bracket allows ~$${estimatedMaxSpend.toLocaleString()} / year${fedNote}`;
        feedbackEl.style.color = '#4a7c4e';
    } else {
        // Over bracket - clicking adjusts spendGoal down to the bracket max
        const shortfall = Math.round(spendGoal - estimatedMaxSpend);
        feedbackEl.innerHTML = `<span style="cursor:pointer;text-decoration:underline;text-decoration-style:dotted;"
            title="Click to set After-Tax Spend to bracket maximum"
            onclick="DisplayHelpers.setDollarValue('spendGoal',${estimatedMaxSpend});runSimulation();"
            >⚠ Over bracket by ~$${shortfall.toLocaleString()} / year - click to adjust</span>${fedNote}`;
        feedbackEl.style.color = '#d4811f';
    }
    updateSuggestSpendTooltip();
}

// Federal marginal-rate % for a given CPI-adjusted (current-year $) income, or null. Mirrors the
// CPI compounding in generateStratRateOptions so the boundary lines up with the dropdown limits.
function federalBracketRateAt(income) {
    if (!isFinite(income) || income <= 0) return null;
    const cpi = (+document.getElementById('cpi')?.value || 2.8) / 100;
    const cpiAdj = Math.pow(1 + cpi, Math.max(0, new Date().getFullYear() - TAX_DATA_BASE_YEAR));
    const status = getDropdownStatus();
    const brks = (status === 'MFJ' ? TAXData.FEDERAL.MFJ : TAXData.FEDERAL.SGL).brackets;
    for (const b of brks) {
        if (income <= b.l * cpiAdj) return Math.round(b.r * 100);
    }
    return Math.round(brks[brks.length - 1].r * 100);
}

// Prior spendGoal value before user clicked the suggest icon (null = not in suggest mode).
let _priorSpendGoal = null;
// Cached engine-solved suggestion { spend, horizon, naivePMT, haircut } | null. The solve runs
// ~two dozen simulate() calls, so it is refreshed once per recalc from runSimulation() rather than
// on every spendGoal keystroke. It does NOT depend on the current spendGoal, so the keystroke path
// (updateBracketFeedback -> updateSuggestSpendTooltip) just reads this cache.
let _suggestedSpend = null;

// Re-solve the suggested spend against the current inputs and refresh the tooltip. Called from
// runSimulation() (whose scheduleRecalc triggers are exactly the inputs the suggestion depends on).
function refreshSuggestedSpend() {
    try {
        _suggestedSpend = (typeof suggestSustainableSpend === 'function')
            ? suggestSustainableSpend(getInputs(), {})
            : null;
    } catch (e) {
        _suggestedSpend = null;
    }
    updateSuggestSpendTooltip();
}

function updateSuggestSpendTooltip() {
    const icon = document.getElementById('suggest-spend-icon');
    if (!icon) return;
    const have = _suggestedSpend && _suggestedSpend.spend > 0;
    icon.style.display = have ? '' : 'none';
    if (!have) return;
    if (_priorSpendGoal !== null) {
        icon.title = `Restore: $${Math.round(_priorSpendGoal).toLocaleString()}`;
    } else {
        const s = _suggestedSpend;
        const K = (typeof SUGGEST_BUFFER_YEARS !== 'undefined') ? SUGGEST_BUFFER_YEARS : 3;
        const hair = (s.haircut != null) ? `, ${Math.round(s.haircut * 100)}% of a naive amortization` : '';
        icon.title = `Suggested goal: $${Math.round(s.spend).toLocaleString()} - the highest after-tax `
            + `spend this plan sustains while still holding ${K}+ years of portfolio-funded spending at `
            + `the end of its ${s.horizon}-year horizon${hair}. Deterministic path - see Monte Carlo `
            + `for return-sequence risk. Click to apply.`;
    }
}

function applySuggestSpend() {
    if (_priorSpendGoal !== null) {
        DisplayHelpers.setDollarValue('spendGoal', Math.round(_priorSpendGoal));
        _priorSpendGoal = null;
    } else {
        if (!_suggestedSpend) refreshSuggestedSpend();
        if (!_suggestedSpend || !(_suggestedSpend.spend > 0)) return;
        const el = document.getElementById('spendGoal');
        _priorSpendGoal = parseFloat((el?.dataset?.numVal) || (el?.value || '').replace(/[^\d.-]/g, '') || '0');
        DisplayHelpers.setDollarValue('spendGoal', Math.round(_suggestedSpend.spend));
    }
    updateSuggestSpendTooltip();
    updateBracketFeedback();
}

/**
 * Rebuilds the stratRate dropdown preserving the current selection.
 * Should be called whenever CPI or marital-status inputs change.
 */
function refreshStratRateOptions() {
    const sel = document.getElementById('stratRate');
    if (!sel) return;
    const saved = sel.value;                          // preserve current selection
    sel.innerHTML = generateStratRateOptions();
    // Restore if the option still exists in the new list
    if (saved && [...sel.options].some(o => o.value === saved)) {
        sel.value = saved;
    }
    updateBracketFeedback(); // Update feedback after options change
    updateACAWarning();
}

/**
 * Shows/hides the ACA Medicare warning based on retirement-start ages.
 * - Both persons ≥65 at retirement start → disable ACA options + "grayed" note.
 * - Exactly one person ≥65                → advisory warning, options still active.
 * Called from updateProfileAgeDisplay(), refreshStratRateOptions(), and startAge oninput.
 */
// bothOnMedicareAtStart() lives in optimizer_core.js - it moved there when the strategy enumeration
// did and needed it. Pure, and still used by the warning below.

function updateACAWarning() {
    const sel     = document.getElementById('stratRate');
    const warnEl  = document.getElementById('aca-age-warn');
    if (!sel || !warnEl) return;

    // No ACA options present → nothing to warn about. Kept as a guard rather than removed with the
    // nerdknob gate: refreshStratRateOptions() rebuilds this dropdown, and a warning about options
    // that are not in it would be worse than silence.
    if (![...sel.options].some(o => o.value.startsWith('aca'))) { warnEl.style.display = 'none'; return; }

    const by1       = +val('birthyear1') || 0;
    const startAge  = +val('startAge')   || 0;
    const hasSpouse = !!valChecked('hasSpouse');
    const by2       = hasSpouse ? (+val('birthyear2') || 0) : 0;

    if (!by1 || !startAge) { warnEl.style.display = 'none'; return; }

    const startYear    = by1 + startAge;
    const medAge       = TAXData.IRMAA.ELIGIBILITY_AGE;
    const p1Medicare   = startAge >= medAge;
    const p2Medicare   = hasSpouse && by2 > 0 && (startYear - by2) >= medAge;
    const bothMedicare = bothOnMedicareAtStart(by1, startAge, hasSpouse, by2);
    const oneMedicare  = hasSpouse && (p1Medicare !== p2Medicare);

    // Disable / re-enable ACA <option>s
    for (const opt of sel.options) {
        if (!opt.value.startsWith('aca')) continue;
        opt.disabled = bothMedicare;
        opt.style.color = bothMedicare ? '#aaa' : '';
    }
    // If a now-disabled ACA option is selected, switch to first enabled option
    if (bothMedicare && sel.value.startsWith('aca')) {
        const first = [...sel.options].find(o => !o.disabled);
        if (first) { sel.value = first.value; updateBracketFeedback(); }
    }

    // EVERY MESSAGE BELOW NAMES THE START YEAR AND THE AGES IN IT, and that is the whole point of
    // this block rather than a flourish. The age readouts beside the birth-year fields show ages
    // TODAY and never move when Retirement Start Age changes, while this gate is about ages at
    // retirement start. A user who sets a 1966 birth year sees "Age 59" next to it and is then told
    // they are on Medicare - two true statements about two different years, one of which the page
    // never showed. It reads as a stale control, and it was reported as one.
    const p1AgeAtStart = startAge;
    const p2AgeAtStart = startYear - by2;
    const you  = `you will be ${p1AgeAtStart}`;
    const them = `your spouse ${p2AgeAtStart}`;

    if (bothMedicare) {
        warnEl.textContent = hasSpouse
            ? `⚠ At retirement start in ${startYear}, ${you} and ${them} - both on Medicare (age ${medAge}+), so there is no premium subsidy for an income cap to protect. ACA options are unavailable. Lower Retirement Start Age to model pre-Medicare years.`
            : `⚠ At retirement start in ${startYear} ${you}, already on Medicare (age ${medAge}+), so there is no premium subsidy for an income cap to protect. ACA options are unavailable. Lower Retirement Start Age to model pre-Medicare years.`;
        warnEl.style.display = 'block';
    } else if (oneMedicare) {
        // Was "ACA income limits apply only to the other person", which was wrong in both
        // directions: the FPL cap is tested against HOUSEHOLD MAGI, so the Medicare spouse's
        // RMDs and Social Security count against it, and the cap does not lift for anyone until
        // the younger spouse reaches Medicare age too (P35 PR 3c, yr.acaLapsed).
        const onName  = p1Medicare ? 'You'  : 'Your spouse';
        const onPoss  = p1Medicare ? 'your' : 'their';
        const offName = p1Medicare ? 'your spouse' : 'you';
        const offVerb = p1Medicare ? 'stays' : 'stay';
        warnEl.textContent = `⚠ At retirement start in ${startYear}, ${you} and ${them}. ${onName} will already be on Medicare (age ${medAge}+). The FPL cap is measured against HOUSEHOLD income, so ${onPoss} RMDs and Social Security count against it while ${offName} ${offVerb} on an ACA plan. The cap lifts once both of you reach ${medAge}, after which this strategy simulates as Proportional 0%.`;
        warnEl.style.display = 'block';
    } else {
        warnEl.style.display = 'none';
    }
}

/**
 * Builds the bracket/IRMAA ceiling dropdown options.
 *
 * - All limits are CPI-adjusted from TAX_DATA_BASE_YEAR to the current calendar year
 *   so the displayed dollar amounts match approximately what the tool uses in year 1.
 * - Options are interleaved (federal + IRMAA) and sorted lowest → highest limit.
 * - Only the applicable filing-status limit is shown (MFJ or SGL from inputs).
 */
function generateStratRateOptions() {
    const cpi = (+document.getElementById('cpi')?.value || 2.8) / 100;
    const status = getDropdownStatus();
    const isMFJ = status === 'MFJ';

    // Compound CPI from TAX_DATA_BASE_YEAR to current year
    const currentYear = new Date().getFullYear();
    const yearsFromBase = Math.max(0, currentYear - TAX_DATA_BASE_YEAR);
    const cpiAdj = Math.pow(1 + cpi, yearsFromBase);

    const options = [];

    // ── Federal brackets (skip the top/Infinity bracket) ──────────────────────
    const fedBrks = isMFJ
        ? TAXData.FEDERAL.MFJ.brackets
        : TAXData.FEDERAL.SGL.brackets;
    for (let i = 0; i < fedBrks.length; i++) {
        const ratePct = Math.round(fedBrks[i].r * 100);
        const isTop   = !isFinite(fedBrks[i].l);   // 37% bracket - unbounded, shown for reference
        const limit   = isTop ? Infinity : Math.round(fedBrks[i].l * cpiAdj);
        options.push({
            value: String(ratePct),
            label: isTop ? `${ratePct}% Fed  ·  no limit` : `${ratePct}% Fed  ·  $${limit.toLocaleString()}`,
            limit,
            defaultSelected: false
        });
    }

    // ── IRMAA tier ceilings (tiers 0-4) ───────────────────────────────────────
    // Ceiling = start of NEXT tier - 1. IRMAA thresholds also grow at CPI.
    const IRMAABrks = isMFJ
        ? TAXData.IRMAA.MFJ.brackets
        : TAXData.IRMAA.SGL.brackets;
    const IRMAALabels = [
        'Below IRMAA',
        'IRMAA Tier 1',
        'IRMAA Tier 2',
        'IRMAA Tier 3',
        'IRMAA Tier 4'
    ];
    for (let i = 0; i < 5; i++) {
        const limit = Math.round((IRMAABrks[i + 1].l - 1) * cpiAdj);
        options.push({
            value: `IRMAA${i}`,
            label: `${IRMAALabels[i]}  ·  $${limit.toLocaleString()}`,
            limit,
            defaultSelected: i === 0
        });
    }

    // ── ACA FPL cliffs ────────────────────────────────────────────────────────
    // Available to everyone. These were nerdknob-only ("the ACA cliff model is rough"), which is
    // still true and is now said plainly in the strategy's documentation instead of being enforced
    // by hiding the control. The age gate below is the only thing that removes them.
    //
    // The 400% entry used to carry a hardcoded ⚠️ and no other entry did. Nothing computed it: it
    // was a string literal, so it fired on every scenario including ones where 400% was the only
    // FEASIBLE arm, and stayed silent on a 200% cap that could not fund a single year. PF13 saw it
    // ("not just the hardcoded 400% label") and worked around it in the results table rather than
    // removing it. Feasibility cannot be known without simulating, which the dropdown does not do -
    // the Optimizer's ⚠️ row flag is computed from acaBreachYears and is the honest signal.
    //
    // FPL base (2025): 2-person $20,440; 1-person $15,060. CPI-approx for future years.
    const FPL_BASE_YEAR = 2025;
    const fplBase = isMFJ ? 20440 : 15060;
    const fplCpiAdj = Math.pow(1 + cpi, Math.max(0, currentYear - FPL_BASE_YEAR + 1));
    const acaEntries = [
        { pct: 200, label: 'ACA 200% FPL' },
        { pct: 250, label: 'ACA 250% FPL' },
        { pct: 300, label: 'ACA 300% FPL' },
        { pct: 400, label: 'ACA 400% FPL' },
    ];
    for (const { pct, label } of acaEntries) {
        const limit = Math.round(fplBase * pct / 100 * fplCpiAdj);
        options.push({ value: `aca${pct}`, label: `${label}  ·  $${limit.toLocaleString()}`, limit });
    }

    // ── Sort all options by income limit, lowest → highest ─────────────────────
    options.sort((a, b) => a.limit - b.limit);

    // ── Build HTML ─────────────────────────────────────────────────────────────
    const statusLabel  = isMFJ ? 'MFJ' : 'Single';
    const cpiLabel     = `${(cpi * 100).toFixed(1)}% CPI`;
    const yearLabel    = yearsFromBase > 0 ? ` · ~${currentYear}` : ` · ${TAX_DATA_BASE_YEAR}`;
    let html = `<optgroup label="${statusLabel} · ${cpiLabel}${yearLabel}">`;
    for (const opt of options) {
        const selected = opt.defaultSelected ? ' selected' : '';
        html += `<option value="${opt.value}"${selected}>${opt.label}</option>\n`;
    }
    html += '</optgroup>';

    return html;
}






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
// P102b7. Goal-first mode is gated one notch deeper than the nerdknob: it shows only when the knob
// is set to the literal value 'goal' (?nerdknob=goal). Some users know the plain ?nerdknob and
// would find it; this is experimental work the user wants kept but not stumbled into. Read once
// from the URL and never toggled at runtime - the Documentation-page checkbox flips NERD_KNOBS
// only, and goal-first stays hidden without the URL saying so. ?nerdknob=goal still counts as
// the plain knob for everything else, because has('nerdknob') is true for it.
const GOAL_FIRST = new URLSearchParams(location.search).get('nerdknob') === 'goal';

// ============================================================================
// SPLIT_FEATURE  --  the Fixed Split withdrawal family (P104b3), ON PROBATION
// ============================================================================
// Gated one notch deeper than the nerdknob, the same way GOAL_FIRST is: it shows only at the
// literal ?nerdknob=split. The plain ?nerdknob does NOT reveal it.
//
// WHY IT IS ON PROBATION (user, 2026-09-03). On a real scenario Fixed Split reached the top ten
// under only two of the nine goals (Maximum Net Wealth and Balanced), it has no mechanism to grow
// a Roth balance other than declining to spend it, and Ordered CIBR beat every Fixed Split
// variation on that single path. The user's decision: keep it available for further testing,
// clearly flagged, and remove it outright if it keeps failing to earn its rows.
//
// The counter-argument, recorded so a later reader weighs both: the single-path comparison is the
// one P103e was built to distrust. Ordered CIBR won that bake-off too and then reached 0% survival
// under bootstrap resampling, while the four Fixed Split vectors were selected on median AND
// survival across three return models. See research/CONSTANT_SPLIT.md.
//
// ── REMOVAL MANIFEST ────────────────────────────────────────────────────────────────────────
// Everything the feature owns, so it can be taken out in one pass. Every site is tagged `P104b3`
// or `P104b1` in a comment; `grep -n "split\|Split" optimizer_core.js optimizer_ui.js` finds them.
//
//   optimizer_core.js  ENGINE (P104b1, keep if the sweep family goes but the input stays):
//     _splitWeightsFor()                    the vector validator + order/weight shape
//     planPrimaryWithdrawals                the `strategy === 'split'` branch
//     fillSpendingGap                       the gap-fill mirror of the same weights
//     totals.splitWeightsInvalid            malformed-vector flag
//     STRATEGY_SELECTION_FIELDS             'splitWeights'
//     sameStrategySelection                 the element-wise 'split' compare
//     ROTH_GAP_EXCLUDED                     'split'
//   optimizer_core.js  SWEEP (P104b3, the part on probation):
//     SPLIT_VECTORS / SPLIT_ACCOUNT_LABELS / splitVectorLabel / splitVectorSortVal
//     OPTIMIZER_GRIDS.split                 (MC_GRIDS deliberately has none)
//     buildStrategyFamilies                 the `splitFamily` opt + the family loop + the
//                                           addOffGrid guard
//     offGridParamFor                       case 'split'
//     the three exports
//   optimizer_ui.js:
//     SPLIT_FEATURE (this block), splitFamily in the sweep opts, describeSelection case 'split',
//     getInputs splitWeights, toggleStrategyUI's #ui-split line, applyNerdKnobVisibility's menu
//     entry, the loadOptimizerResult adopt branch, the four OPT_LONG_TO_SHORT keys, the
//     applyScenario array case, and generateSplitPresetOptions / onSplitPresetChange /
//     syncSplitPresetFromFields / onSplitFieldInput / updateSplitMixNote / SPLIT_FIELD_IDS
//   retirement_optimizer.html:
//     the #strategy-opt-split option, the #ui-split panel, the DOMContentLoaded menu build
//   optimizer_core.tests.js: the four `P104b3:` tests (and P104b1's engine tests, which stay)
//   research/CONSTANT_SPLIT.md + .test_harnesses/split_fine_harness.js, split_mc_harness.js
const SPLIT_FEATURE = new URLSearchParams(location.search).get('nerdknob') === 'split';

// MONTE_DEMO: the ?montecarlo teaching demo. Lands the reader on the Monte Carlo tab in Synthetic
// mode with Seed/Paths/Input Distributions exposed and auto-runs the Experiment (see
// runMCExperiment in mc_tab.js). Deliberately NARROW: unlike NERD_KNOBS it does NOT unlock the
// other advanced surfaces (Avg BETR stat, GK params, sweep dimensions). It only widens the MC-tab
// panels and lowers the paths floor. Read once at load; not flipped at runtime, not in the URL twice.
const MONTE_DEMO = new URLSearchParams(location.search).has('montecarlo');

// ?tab=... opens the page on a named tab instead of Charts. Friendly names rather than the DOM ids,
// because a shared link is read by people: ?tab=optimizer, not ?tab=tab-opt. Both are accepted, so
// a link built from an id still works.
const TAB_ALIASES = Object.freeze({
    annual: 'tab-tbl', details: 'tab-tbl', table: 'tab-tbl', annualdetails: 'tab-tbl',
    charts: 'tab-chart', chart: 'tab-chart',
    optimizer: 'tab-opt', opt: 'tab-opt',
    montecarlo: 'tab-mc', mc: 'tab-mc',
    importexport: 'tab-fileio', fileio: 'tab-fileio', import: 'tab-fileio', export: 'tab-fileio',
    documentation: 'tab-docs', docs: 'tab-docs', help: 'tab-docs',
});

// Returns a tab id from ?tab=, or null when the parameter is absent or names nothing. Null means
// 'leave the default alone' rather than 'go to Charts', so a typo cannot silently move the user.
function tabIdFromUrl() {
    const raw = new URLSearchParams(location.search).get('tab');
    if (!raw) return null;
    const key = String(raw).trim().toLowerCase().replace(/[^a-z-]/g, '');
    if (TAB_ALIASES[key]) return TAB_ALIASES[key];
    // also accept a literal id, but only one that actually exists on the page
    return (/^tab-[a-z]+$/.test(key) && document.getElementById(key)) ? key : null;
}

// Called once on load, after the tabs and their content exist. Monte Carlo needs its own
// activation hook, the same one its tab button calls, or the tab opens without its charts built.
function applyTabFromUrl() {
    const id = tabIdFromUrl();
    if (!id) return;
    showTab(id);
    if (id === 'tab-mc') mcTabActivated?.();
}

// Optimizer UI state - replaces window.optimizer* globals.
const OptimizerState = {
    results: null,
    baseline: null,
    // colKey '__objective__' (default) orders the body by the active "Optimize for" objective;
    // clicking a column header switches to that column (user override) until the objective changes.
    sortState: { colKey: '__objective__', direction: 'desc' },
    showInfeasible: false,
    showFailed: false,
    // Turns the per-goal column filter off, showing every column at once the way the table used
    // to open. Deliberately NOT reset by setOptObjective: how dense you want the table is a
    // preference, not a property of the goal.
    showAllColumns: false,
    // Relative view: every comparable column reads as a difference from the reference row rather
    // than as its own value. Nerdknob-gated while it is being lived with.
    relativeView: false,
    // P100b1: seeded from `?obj=` so a shared link reproduces the goal it was shared under.
    // Read HERE rather than in an init hook because renderOptimizerTable and the anchor baseline
    // pick both read this before any load hook would have run; an unknown or absent key falls back
    // to the default, so an old link and a typo behave the same way.
    objective: (() => {
        const k = new URLSearchParams(location.search).get('obj');
        return (k && typeof OPTIMIZER_OBJECTIVES !== 'undefined' && OPTIMIZER_OBJECTIVES[k]) ? k : 'taxflex';
    })(),                       // PF13: default ranking = Tax Flexibility (most-requested)
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
    // P104b3. The Fixed Split menu entry. `hidden` alone is not enough - a hidden <option> is still
    // keyboard-selectable in some browsers - so it is disabled too. If the knob goes off while it
    // is the live selection the strategy is NOT rewritten: silently switching someone's plan to a
    // different one is worse than showing a strategy they can no longer pick from the menu.
    const splitOpt = document.getElementById('strategy-opt-split');
    if (splitOpt) { splitOpt.hidden = !SPLIT_FEATURE; splitOpt.disabled = !SPLIT_FEATURE; }
    // Maximize Conversions sub-flags (Convert Excess to Roth / Use Cash) - always visible: they are
    // two financially distinct decisions, not experimental knobs (kept here so a runtime nerd
    // toggle can't hide them).
    const convAdvWrap = document.getElementById('convAdvanced-wrap');
    if (convAdvWrap) convAdvWrap.style.display = '';
    // Tax-rate creep (Assumptions) and Stop-conversions-after (sidebar) are NOT handled here any
    // more: both graduated out of nerdknob once they were finished and tested, so their markup
    // carries no display:none and nothing hides them. Same treatment as convAdvanced-wrap above.
    // IRMAA safety margin below a projected tier threshold - experimental, still being measured
    // (research/IRMAA_MARGIN_FIXED_CPI.md). The FORWARD PROJECTION it sits on is NOT gated:
    // that is a correctness fix and applies to every user. Only the choice of margin is hidden,
    // and hiding it leaves the default (IRMAA_MARGIN_DEFAULT, 'halfcpi') in force, not "no margin".
    // P70e. Fixed tax indexing - a DIAGNOSTIC, not a modeling choice, so it stays behind the knob.
    // Leaving it hidden leaves it OFF, which is the correct model (the tax code follows realized
    // inflation, as the IRS and SSA do), not a fallback.
    const fixedIdxWrap = document.getElementById('fixedTaxIndexing-wrap');
    if (fixedIdxWrap) fixedIdxWrap.style.display = NERD_KNOBS ? '' : 'none';
    // P102b1. Goal-first mode - gated while it is being lived with, and force-reverted on the way
    // out for the same reason relative view is below: a reader who enabled it once must not be
    // left holding a plan whose controls they can no longer see. goalFirstReset() hands the
    // classic fields back their own values, so knob-off lands on the plan the panel built rather
    // than on a rollback.
    // P102b7: visible only under ?nerdknob=goal AND with the knob on, so the runtime checkbox can
    // still hide it (and force-revert it) the way it hides every other gated surface.
    const goalFirstWrap = document.getElementById('goalfirst-panel');
    if (goalFirstWrap) goalFirstWrap.style.display = goalFirstOn() ? '' : 'none';
    buildGoalFirstObjectiveOptions();
    renderObjectiveBlurb();
    if (!goalFirstOn() && typeof goalFirstReset === 'function') goalFirstReset();
    // Ordering matters: goalFirstReset() above already puts the menu back when the knob goes off,
    // and this covers the knob-ON direction plus the very first call at init.
    refreshConvEndModeOptions();
    refreshConvEndEnabled();
    // P84. Advisor fee - gated by the user's 2026-08-28 decision. Hiding it leaves the field at
    // whatever it holds, which is 0 by default and therefore no fee; but a plan LOADED from a URL
    // carrying ?af= keeps its fee and still computes it, because the input is only hidden, never
    // cleared. That is the whole reason the URL keys are not gated with the field.
    // P84. The advisor fee is NOT gated: it is a fact about the plan, not a diagnostic, which is
    // the rule written just above. It sat behind the knob only while it was being proven out.
    // Ungating costs nobody a number, because the scope defaults to "none".
    updateAdvisorFeeHint();
    const irmaaMarginWrap = document.getElementById('irmaaMarginMode-wrap');
    if (irmaaMarginWrap) irmaaMarginWrap.style.display = NERD_KNOBS ? '' : 'none';
    // 💵 legend - only meaningful once nerdknob is sweeping the cash-funded arm
    const cashFundLegend = document.getElementById('opt-legend-cashfund');
    if (cashFundLegend) cashFundLegend.style.display = NERD_KNOBS ? '' : 'none';
    // Relative view control - gated while the mode is being lived with. Turning the knob OFF must
    // also turn the mode off, or a reader who enabled it once would be left reading a table of
    // differences with no visible way to get back.
    const relWrap = document.getElementById('opt-relmode-wrap');
    if (relWrap) relWrap.style.display = NERD_KNOBS ? '' : 'none';
    if (!NERD_KNOBS) OptimizerState.relativeView = false;
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
// The line under the selector describing what the CHOSEN goal ranks by. Called from
// setOptObjective and from page init, not only from renderOptimizerTable, because the goal can
// be changed before any sweep has run and the description should still be right.
function renderObjectiveBlurb() {
    const key = OptimizerState.objective || 'taxflex';
    const text = OPT_OBJECTIVE_BLURB[key] || OPT_OBJECTIVE_BLURB.taxflex;
    for (const id of ['opt-objective-note', 'gf-objective-note']) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }
}

// P102b6. Build the goal-first mirror's options from the SAME constants the Optimizer tab's menu is
// written from, rather than a second hand-kept <option> list that would drift the first time a goal
// is added. Idempotent, so applyNerdKnobVisibility() can call it on every knob toggle.
function buildGoalFirstObjectiveOptions() {
    const sel = document.getElementById('gf-objective');
    if (!sel || sel.options.length === OPT_OBJECTIVE_ORDER.length) return;
    sel.innerHTML = '';
    for (const key of OPT_OBJECTIVE_ORDER) {
        const o = document.createElement('option');
        o.value = key;
        o.textContent = OPT_OBJECTIVE_LABELS[key];
        sel.appendChild(o);
    }
    sel.value = OptimizerState.objective || 'taxflex';
}

function setOptObjective(key) {
    OptimizerState.objective = OPT_OBJECTIVE_LABELS[key] ? key : 'taxflex';
    // P100b1. The <select> is the CALLER when a user changes the goal by hand, but not when the
    // goal arrives from `?obj=` or from a loaded scenario - and a control showing one goal while
    // the table is ranked by another is worse than not restoring it at all. Written back
    // unconditionally, which is a no-op in the by-hand case.
    // P102b6: TWO selects now raise this - the Optimizer tab's and goal-first's mirror - and
    // neither is written by the caller. Both are set unconditionally, which is a no-op on whichever
    // one the user just used, so the same goal cannot read differently in two places.
    for (const _id of ['opt-objective', 'gf-objective']) {
        const _sel = document.getElementById(_id);
        if (_sel && _sel.value !== OptimizerState.objective) _sel.value = OptimizerState.objective;
    }
    // Changing the objective re-follows it for the body order (drop any user column override).
    OptimizerState.sortState = { colKey: '__objective__', direction: 'desc' };
    renderObjectiveBlurb();
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
    // Normally the baseline is the strongest plan that converts nothing: the "what if I do nothing"
    // reference. The two conversion goals rank on a field only a CONVERTING row has, so against a
    // no-conversion baseline every one of their deltas came out as a dash. Under those goals the
    // pool is the rows that actually carry the field instead (OPT_BASELINE_REQUIRES).
    const needField = OPT_BASELINE_REQUIRES[OptimizerState.objective];
    const successes = results.filter(r => r.totals.success
        && (needField ? r[needField] != null : r._isNoConv));
    const feasible = successes.filter(r => !(r._isBracketInfeasible || r._isACAUntenable));
    let baselinePool = feasible.length > 0 ? feasible : successes;
    // If a goal that wants a converting row has none - no ⇌ rows in this run - fall back to the
    // usual no-conversion baseline rather than leaving the table with no reference at all.
    if (needField && baselinePool.length === 0) {
        const noConv = results.filter(r => r._isNoConv && r.totals.success);
        const noConvFeasible = noConv.filter(r => !(r._isBracketInfeasible || r._isACAUntenable));
        baselinePool = noConvFeasible.length > 0 ? noConvFeasible : noConv;
    }
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
// The ⚖ marks the row every Δ column measures from, and NOTHING marks the others. Showing a
// faded ⚖ on all 177 rows and a slightly larger one on the reference row asked the reader to spot
// a difference of 0.2em and 45% opacity across a scrolling table, which is not a difference
// anyone spots. One glyph, in one place, plus the reference row carrying the same blue as the
// ⚓ baseline it replaces - the two are the same idea, so they read as the same thing.
//
// The empty cells are still the click target. The column heading keeps the ⚖ so the column says
// what it is, and CSS reveals a faint ⚖ under the pointer (see .opt-cmp-cell) so the affordance
// is findable without printing it 177 times.
// Relative view: render one cell as its difference from the reference row instead of its own
// value. Returns null when this cell should stay absolute, so the caller falls through to
// col.getValue unchanged - that covers the reference row itself, every column with no entry in
// OPT_DELTA_COLUMNS, and any row whose column has no value to compare.
//
// Built on getSortValue rather than on the raw row fields, which buys two things for free: the
// Future $ / Current $ toggle is already baked into it, and a column changing how it computes
// cannot leave the delta reading from a stale field.
function deltaCellHtml(col, r, refRow) {
    const meta = OPT_DELTA_COLUMNS[col.key];
    if (!meta || !refRow || r === refRow) return null;
    // A dash means this row has nothing to compare - a sweep row has no break-even year, for
    // instance. It must stay a dash: turning "no value" into "+0" would read as a tie.
    if (col.getValue(r) === '—' || col.getValue(refRow) === '—') return '—';
    const a = col.getSortValue(r), b = col.getSortValue(refRow);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return '—';
    const d = a - b;
    let body;
    // No unit suffix on the percent columns. These are differences between two percentages, so
    // strictly they are percentage POINTS - but "pp" read as an unexplained code, and "%" would be
    // worse than jargon: it invites reading 0.8 as a share OF the rate rather than a step in it.
    // The heading already says which column this is, so the bare number is the honest form.
    if (meta.unit === 'pp')         body = `${(Math.abs(d) * 100).toFixed(1)}`;
    else if (meta.unit === 'years') body = `${Math.abs(Math.round(d))} yr`;
    else                            body = Math.round(Math.abs(d)).toLocaleString();
    if (Math.round(Math.abs(d) * (meta.unit === 'dollar' ? 1 : 1000)) === 0) {
        return `<span style="color:#57606a">same</span>`;
    }
    const better = meta.dir === 'neutral' ? null
                 : (meta.dir === 'higher' ? d > 0 : d < 0);
    const color = better === null ? '#57606a' : (better ? '#1a7f37' : '#cf222e');
    return `<span style="color:${color}">${d > 0 ? '+' : '−'}${body}</span>`;
}

function compareToggleHtml(r) {
    return (deltaReferenceRow() === r) ? '<span style="font-size:1.2em;">⚖</span>' : '';
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
    if (_strat.stratACAMultiple > 0 && _strategy === 'bracket') {
        _strategy = 'aca';
    }
    return {
        STATEname: val('STATEname'),
        strategy: _strategy,
        orderedSeq: val('orderedSeq') || 'CBIR',
        // P104b3. RELATIVE weights, in account order, straight off the four fields. Always emitted,
        // not only for strategy 'split': every other strategy ignores the key, and a field that
        // travels conditionally is a field that goes missing from a share link exactly when it
        // matters. An all-zero vector reaches the engine as-is and is handled there - it falls back
        // to balance weights and raises splitWeightsInvalid, which updateSplitMixNote() shows.
        splitWeights: [+val('splitIRA') || 0, +val('splitBrok') || 0,
                       +val('splitCash') || 0, +val('splitRoth') || 0],
        // The switch is two-state, the engine input is a position, so the mapping lives here. ''
        // is the default and means "Roth last"; the engine validates against its known values
        // rather than for truthiness, so an empty string leaves today's order. 'fillRothThenCash'
        // is a third position the engine still accepts for the harnesses and no UI can reach.
        rothGapFill: valChecked('rothGapFill') ? 'fillCashThenRoth' : '',
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
        // P70i. A selector now, not a checkbox: 'none' | '1' | '2' | '3' | 'full'. The engine's
        // pensionColaCap() still accepts the old booleans, so a saved plan carrying true or false
        // keeps its meaning without a migration step.
        pensionCola: val('pensionCola') || 'none',
        spendGoal: +val('spendGoal'),
        spendChange: (spendChange / 100.0),
        iraBaseGoal: +val('iraBaseGoal'),
        // P84. The amount is one field carrying two meanings, so it is parsed here rather than
        // read. `val()` returns dataset.numVal when set and the literal text otherwise, and this is
        // a data-plain field so numVal is NEVER set - `+val(...)` on "20k" was NaN, which fell to 0
        // and silently charged no fee at all. Shorthand, commas, a '%' suffix and a '$' prefix are
        // all handled; the mode is then resolved and passed EXPLICITLY so the share URL pins it.
        ...(() => {
            const p = parseAdvisorFeeAmount(val('advisorFeeAmount'));
            return { advisorFeeAmount: p.amount, advisorFeeMode: p.mode };
        })(),
        advisorFeeScope: val('advisorFeeScope') || 'none',
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
        // P89: one definition of the plan's first year, shared with the ACA age gate. This block
        // used to carry its own copy of the clamp and the gate carried an unclamped copy.
        startInYear: planFirstYear(+val('birthyear1'), +val('startAge')),
        dividendReinvest: !!valChecked('dividendReinvest'),
        cyclicEnabled: !!valChecked('cyclicEnabled'),
        cyclicOrder:   val('cyclicOrder') ?? 'ira-first',
        cycleLTCGTarget: +(val('cycleLTCGTarget') ?? 0.15),
        irmaaMarginMode: val('irmaaMarginMode') || IRMAA_MARGIN_DEFAULT,
        fixedTaxIndexing: !!valChecked('fixedTaxIndexing'),
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
// P93. The heading over the balance fields says "Assets at Retirement Age", and the year it means
// is not on screen anywhere. That matters more here than a label usually does, because THE TOOL HAS
// NO ACCUMULATION PHASE: it never grows the typed balances between today and a later retirement
// year. A reader who types today's balances and a Retirement Start Age still ahead of them is
// modelling a smaller portfolio than they will actually have, and nothing says so - measured at
// $1,050,154 starting 2026 against $1,046,082 starting 2030 for the same typed $1M, where four
// years at 6% would be about $1.26M.
//
// Naming the year turns that from a hidden assumption into an instruction: these are the balances
// AS OF this year, and forecasting them to it is the reader's job. Reads the same `planFirstYear`
// the engine's `startInYear` uses (P89), so the label cannot drift from the year actually simulated.
function updateAssetsYearLabel() {
    const el = document.getElementById('assets-year-label');
    if (!el) return;
    const by1 = +val('birthyear1') || 0;
    if (!by1) { el.textContent = ''; return; }
    el.textContent = ' (' + planFirstYear(by1, +val('startAge') || 0) + ')';
}

function updateProfileAgeDisplay() {
    updateAssetsYearLabel();   // P93: birth year moves the start year, so it moves this label
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

// ── P69: Monte Carlo path replay ────────────────────────────────────────────
// One injection point, not a second pipeline: when a replay is active, runSimulation() overlays the
// captured path's return and inflation sequences onto the inputs it just read from the sidebar. The
// INPUTS are never mutated - the plan under test stays whatever the sidebar says - and the
// sequences are rebuilt from the shipped bank rows through the engine's own pathInputsFromBankRows,
// never regenerated from the seed. Exit paths: the banner's button, editing any sidebar input
// (delegated listener below), or leaving the Charts / Annual Details tabs.
let _replayState = null;   // { rows, mcMode, planFields, label, pathName, nav } from mc_tab.js, or null
let _replayExitHooked = false;
let _preReplayIncomeView = null;   // income-chart view to restore when replay ends
// P82d. Keeping the path while editing IS the behavior now, not a choice: a sidebar edit re-runs
// against the SAME sequences instead of ending the replay. The checkbox that used to gate this is
// gone, and with it the flag - every branch that read it now reads "always".

// P78. What the banner says. Split out of syncReplayBanner so the rule is testable without a
// live run: once the plan has been edited under the lock, the run's own outcome ("ruined 2035")
// describes a plan that is no longer on screen, so the banner names the PATH and says the plan is
// modified. A state with no pathName (an older cached mc_tab.js) keeps its full label rather than
// losing the text entirely.
function replayBannerText(state) {
    if (!state) return '';
    return (state.modified && state.pathName)
        ? `Replaying ${state.pathName} through your MODIFIED plan.`
        : state.label;
}

// P78. Stepping to another path must not re-impose the RUN's plan over the one the reader has been
// editing: the whole promise is that the plan stays put and only the sequence changes. `prev`
// having no planFields is what says the handoff already happened; with no prev at all this is an
// ENTRY, and the fresh state keeps its fields so replayPath can hand them to the sidebar. Mutates
// `next` in place, which is how replayPath receives it.
function replayCarryOnStep(prev, next) {
    if (!next || !prev || prev.planFields) return next;
    next.planFields = null;
    next.modified = !!(next.modified || prev.modified);
    return next;
}

// P80. Which historical year the replayed path's year `i` was sampled from, or null. Two ways to
// get nothing, both of them normal: no replay on screen, or a synthetic path (GBM and AAM are
// drawn, not sampled, so there is no year to name). The banks index returns and inflation with ONE
// shared index, so this single year is honest for both.
//
// P90: no longer gated on the nerdknob. Naming the year a bootstrap block came from is a FACT about
// the path being shown, not a diagnostic - the same rule that ungated the advisor fee and the
// forward IRMAA projection. A reader looking at a replayed 1974 return is better served knowing it
// is 1974 than being shown the number alone.
function replaySourceYear(i) {
    const y = _replayState?.rows?.srcYears?.[i];
    return Number.isFinite(y) && y > 0 ? y : null;
}

// P80. The Market Return tooltip's heading. Kept separate from the lookup so the wording is
// testable without a replay: the year is a suffix on the WHOLE heading rather than on each series,
// because one source year covers the return bar, the inflation line and the real-return line
// alike, and repeating it three times says nothing extra.
function marketTooltipTitle(base, srcYear) {
    return srcYear ? `${base}  (from ${srcYear})` : base;
}

// P82g. The market return after inflation. COMPOUNDED, not subtracted: 8% against 3% is 4.85%, not
// 5%, and the gap widens exactly where it matters - the high-inflation paths. Both arguments and
// the result are decimals, not percents.
function realReturnOf(nominal, inflation) {
    return (1 + (nominal || 0)) / (1 + (inflation || 0)) - 1;
}

function replayPath(state) {
    // Only the normal->replay transition force-switches the lower chart to the Market view (the
    // path's return/inflation story). Prev/next re-enters here with replay already active, so a
    // view the user picked mid-replay is preserved.
    if (!_replayState) {
        _preReplayIncomeView = incomeChartView;
        incomeChartView = 'market';
        syncIncomeViewControls();
    }
    // P82d. On ENTRY, hand the run's own plan fields to the sidebar once: swept rows force
    // conversions on, carry their own strategy and sometimes their own spend, and none of that was
    // visible while the controls said something else. On a STEP, prev has already been handed off,
    // so replayCarryOnStep drops the fresh state's fields instead - re-imposing them would revert
    // every edit the reader has made, which is the PF8 / P74 class.
    const entering = !_replayState;
    replayCarryOnStep(_replayState, state);
    if (entering && state.planFields && typeof applyMCVariationToSidebar === 'function') {
        applyMCVariationToSidebar(state.planFields);
        state.planFields = null;
    }
    _replayState = state;
    if (!_replayExitHooked) {
        // A sidebar edit means the user is back to designing the plan; a replayed chart under an
        // edited plan would look like the edit's effect. Capture phase, so this runs before the
        // input's own handler re-simulates.
        document.querySelector('.sidebar')?.addEventListener('input', () => {
            if (!_replayState) return;
            // The path stays; the plan is now the user's. planFields were handed to the sidebar
            // when the replay started, so nothing here overrides what they just typed. The
            // baseline overlay is dropped so it recomputes against the edited plan rather than
            // still describing the plan the run scored.
            _replayState.modified = true;
            _replayState.baselineLog = null;
            syncReplayBanner();
            // No runSimulation() here: this is the capture phase of the user's own edit, and the
            // input's own handler re-runs a moment later. Calling it would double-run.
        }, true);
        _replayExitHooked = true;
    }
    runSimulation();
}

// The one place replay ends: drops the state (and the baseline log cached on it) and restores the
// income-chart view the user was on before the replay switched it to Market.
function _clearReplay() {
    _replayState = null;
    if (_preReplayIncomeView != null) {
        incomeChartView = _preReplayIncomeView;
        _preReplayIncomeView = null;
        syncIncomeViewControls();
    }
}

function exitReplay() {
    _clearReplay();
    runSimulation();
}

function syncReplayBanner() {
    const banner = document.getElementById('replay-banner');
    if (!banner) return;
    banner.style.display = _replayState ? 'flex' : 'none';
    if (_replayState) {
        const txt = document.getElementById('replay-banner-text');
        if (txt) txt.textContent = replayBannerText(_replayState);
        // Prev/next enablement comes from mc_tab.js, which owns the lists and their order.
        const nav = (typeof replayNavState === 'function') ? replayNavState() : null;
        const prev = document.getElementById('replay-prev');
        const next = document.getElementById('replay-next');
        if (prev) { prev.style.display = nav ? '' : 'none'; prev.disabled = !nav?.hasPrev; }
        if (next) { next.style.display = nav ? '' : 'none'; next.disabled = !nav?.hasNext; }
    }
}

function runSimulation() {
    refreshStratRateOptions();   // keep bracket dropdown labels in sync with CPI + filing status
    // computeOC: single-scenario runs also produce the Opp. Cost counterfactual (Break Even).
    const _base = getInputs();
    const _simInputs = { ..._base, computeOC: true };
    if (_replayState) {
        // Baseline for the chart overlay: the SAME plan the replay runs (sidebar + planFields),
        // deterministically - no sequences, so growth and inflation stay the sidebar's flat
        // assumptions and the solid-vs-dashed gap is purely the path's market story. Cached on the
        // state object: every replay start and prev/next step builds a fresh state, so the cache
        // invalidates itself and dies with the state on exit. No computeOC - its fields go unused.
        if (!_replayState.baselineLog) {
            _replayState.baselineLog =
                simulate({ ..._base, ...(_replayState.planFields ?? {}) }).log;
        }
        // planFields first: the run's own strategy and conversion settings (swept rows are not the
        // raw sidebar plan - conversions are forced on, for one), so the replayed year-by-year
        // agrees with the survival rate and ruin year the run reported. Then the path's sequences.
        Object.assign(_simInputs, _replayState.planFields ?? {},
            MCEngine.pathInputsFromBankRows(_replayState.rows, _simInputs, _replayState.mcMode));
    }
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
    updateExtraConvWarning();  // P88e: after the log exists, so it can say how many years broke
    updateLimitFeasibilityWarning();   // P92c: same reason - it reports on the run just finished
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
    syncReplayBanner();
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
        // P86: the survival table and the plan headline carry dollar figures too (final balance,
        // taxes, spendable) and were never re-rendered here, so they sat on a fixed basis while
        // the chart above them switched. Plan scope never renders the table (renderMCResults hides
        // and empties it), so the same gate applies here.
        if (typeof renderSurvivalTable === 'function' && _mcResults.variations
            && (typeof _mcScope === 'undefined' || _mcScope !== 'plan')) {
            renderSurvivalTable(_mcResults.variations, _mcResults.numPaths);
        }
        if (typeof renderPlanHeadline === 'function') renderPlanHeadline(_mcResults);
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
        case 'split':    return { family: 'Fixed Split', paramLabel: splitVectorLabel(p.splitWeights), paramSortVal: splitVectorSortVal(p.splitWeights) };
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

    // Where the runs actually go. `simulationCount` is the only honest unit: a table row is one
    // addResult() but NOT one simulate(), because computeOC fires counterfactuals inside simulate(),
    // and the Optimize Spend / Optimize Conversions passes run a whole search per row. Counting
    // rows would therefore understate the cost of exactly the passes that dominate it.
    //
    // Phases are attributed by sampling the counter at each pass boundary (nothing between them
    // simulates), families by measuring the delta around addResult's own simulate().
    const perfRuns = { phase: {}, family: {}, rows: {} };
    let _perfPhase = 'Strategy table';
    let _perfSeen = 0;
    const perfFlush = () => {
        const d = simulationCount - _perfSeen;
        _perfSeen = simulationCount;
        if (d) perfRuns.phase[_perfPhase] = (perfRuns.phase[_perfPhase] ?? 0) + d;
    };
    const perfEnter = (name) => { perfFlush(); _perfPhase = name; };

    // strategyOverrides stored separately so the spend optimizer can reuse them
    const strategyOverridesList = [];

    function addResult(strategyLabel, paramLabel, paramSortVal, overrides, noConv = false, familyKey = null, modifier = null) {
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
        const _runsBefore = simulationCount;
        const res = simulate({ ...inputs, computeOC: true });
        // Family attribution. The caller passes the enumeration's own family name where it has one,
        // because 'bracket' covers both Fill Bracket and IRMAA Ceil and the strategy key alone
        // cannot tell them apart.
        const _fk = familyKey ?? OPT_FAMILY_OF_STRATEGY[overrides.strategy] ?? (overrides.strategy || '(other)');
        perfRuns.rows[_fk]   = (perfRuns.rows[_fk]   ?? 0) + 1;
        perfRuns.family[_fk] = (perfRuns.family[_fk] ?? 0) + (simulationCount - _runsBefore);
        const lastEntry = res.log[res.log.length - 1];
        const totalYears = res.log.length;
        // P88c: count only the SPENDING-driven part. BracketOverage now also carries overage a
        // voluntary Extra Annual Roth Conversion caused, and "infeasible" must keep meaning "this
        // ceiling cannot fund this plan" - otherwise typing a conversion would flag every bracket
        // row infeasible and empty the table.
        const ovYears = res.log.filter(e =>
            ((e['BracketOverage'] ?? 0) - (e['-overageFromConv'] ?? 0)) > 0).length;
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
            // The family and modifier as the ENUMERATION named them, not as the label renders them.
            // strategySortKey() sorts the Strategy column on these; reading them back off
            // _strategyLabel is what used to scatter each family's clones across the table.
            _family: _fk,
            _modifier: modifier,
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
                // P104b3. selectionOf() FIRST, then the explicit fields below. This list is
                // hand-kept and STRATEGY_SELECTION_FIELDS is the real one, and they had already
                // drifted: `splitWeights` was in the shared list and missing here, so a Fixed Split
                // row recorded no mix and clicking it left whatever the sidebar had - the table
                // showing one plan and the click running another, the PF8 class the comment above
                // says this object exists to prevent. Spreading the shared list first means a field
                // added there is carried automatically; the explicit entries after it keep their
                // coercions (`!!`, `?? -1`, `?? ''`), which sameStrategySelection relies on.
                ...selectionOf(inputs),
                strategy: inputs.strategy,
                propWithdraw: inputs.propWithdraw, nYears: inputs.nYears,
                stratRate: inputs.stratRate, stratIRMAATier: inputs.stratIRMAATier ?? -1,
                stratACAMultiple: inputs.stratACAMultiple ?? 0,
                iraWithdrawPct: inputs.iraWithdrawPct, orderedSeq: inputs.orderedSeq,
                gkGuard: inputs.gkGuard, gkAdjPct: inputs.gkAdjPct,
                cyclicEnabled: !!inputs.cyclicEnabled, cyclicOrder: inputs.cyclicOrder ?? 'ira-first',
                fundConversionWithCash: !!inputs.fundConversionWithCash,
                rothGapFill: inputs.rothGapFill ?? '',
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
        strategyOverridesList.push({ strategyLabel, paramLabel, paramSortVal, overrides, family: _fk, modifier });
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
        // The 🅡 arm is swept for everyone - P28 measured it worth up to +$3.56M and found no
        // heuristic that predicts when, so the only way to know is to run it. Gated on Roth
        // because with no Roth to draw the clone is a bit-identical twin, and restricted inside
        // the builder to every strategy but Ordered, which runs the sequence the user picked.
        rothClones: (base.Roth > 0 || base.Roth2 > 0),
        // P104b3. Fixed Split is on probation behind ?nerdknob=split, NOT the plain nerdknob -
        // see the SPLIT_FEATURE block for why and for the removal manifest. Monte Carlo's sweep
        // does not get it at all (MC_GRIDS carries no `split`), because MC has no knob to gate it.
        splitFamily: SPLIT_FEATURE,
        // The user's own off-grid parameter goes last here, after Guyton-Klinger. MC puts it
        // straight after IRA Draw. Both orders are pinned by sweep_golden.js.
        offGridLast: true,
    });
    for (const f of families) {
        addResult(f.strategyLabel, f.paramLabel, f.paramSortVal, f.overrides, false, f.family, f.modifier);
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
    perfEnter('Optimize Spend');
    OptimizerState.noSolutionFloor = null;
    if (document.getElementById('optimizeSpend')?.checked) {
        const anySuccess = results.some(r => r.totals.success);

        if (anySuccess) {
            // Forward mode: for each successful strategy, binary-search upward
            const baselineCount = results.length;
            for (let i = 0; i < baselineCount; i++) {
                const baseRow = results[i];
                if (!baseRow.totals.success) continue;
                const { strategyLabel, paramLabel, paramSortVal, overrides, family, modifier } = strategyOverridesList[i];
                const opt = optimizeSpend(base, overrides);
                if (!opt) continue;
                const lastEntry = opt.result.log[opt.result.log.length - 1];
                results.push({
                    _id: results.length,
                    _strategyLabel: (strategyLabel + (overrides.convertExcessToRoth ? ' ✓' : '')) + (opt.hitCeiling ? ' ✦+' : ' ✦'),
                    _paramLabel: paramLabel,
                    _paramSortVal: paramSortVal,
                    _family: family,
                    _modifier: modifier,
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
                    _family: opt.family ?? null,
                    _modifier: opt.modifier ?? null,
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
            // Passed explicitly for the same reason as fundConversionWithCash above: the 🅡 sweep
            // writes rothGapFill:'' onto every un-cloned row, and this reference row is the user's
            // actual plan, not a swept arm.
            rothGapFill: userPlan.rothGapFill ?? '',
            extraConversionAmount: userPlan.extraConversionAmount ?? 0,
            convEndYear: userPlan.convEndYear, convEndMode: userPlan.convEndMode ?? 'all',
        };
        // Name it the way the swept rows are named, so the pinned row reads as a peer of the table
        // ("Proportional 7%", "Guyton-Klinger Grd:20 Adj:10") rather than an unlabelled special case.
        const _fam = describeSelection(userPlan);
        perfEnter('Your plan');
        addResult(_fam.family, _fam.paramLabel, _fam.paramSortVal, _curOv, false, _fam.family);
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
    perfEnter('Optimize Conversions');
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
            // P88f. A conversion is stacked ON TOP of a draw already sized to fill the row's
            // ceiling, so on a Fill Bracket / Min Limit / IRMAA Tier row it goes over. Measured
            // across 180 ceiling cells: the search picks a non-zero conversion in 61 of them and
            // ALL 61 breach. The rows are still worth offering - median gain $53,990 and up to
            // $1,546,930, so dropping the family would throw real money away - but a row that
            // quietly abandons the ceiling in its own name should say so.
            //
            // `-overageFromConv` is the conversion's share specifically (P88c), not spending that
            // could not be funded inside the ceiling. Marking the second as if it were the first
            // would put this glyph on rows where the user chose nothing.
            const _convBreach = beResult.log.filter(r => (r['-overageFromConv'] ?? 0) > 1);
            const _convBreachWorst = _convBreach.length
                ? Math.max(..._convBreach.map(r => r['-overageFromConv'])) : 0;
            results.push({
                _id: results.length,
                _strategyLabel: baseRow._strategyLabel + ' ⇌' + (convEndYear != null ? ` ⏹${convEndYear}` : '')
                    + (_convBreach.length ? ' ⤴' : ''),
                _convBreachYears: _convBreach.length,
                _convBreachWorst: _convBreachWorst,
                _paramLabel: baseRow._paramLabel,
                _paramSortVal: baseRow._paramSortVal,
                _family: baseRow._family ?? null,
                _modifier: baseRow._modifier ?? null,
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
                // P86: the Current-$ twin is a difference of sum-of-deflated-years totals, so the
                // Conv Tax column can follow the toggle like the taxes it is made from.
                _convSavingsCurrent: (baseRow.totals.taxCurrentDollars - beResult.totals.taxCurrentDollars),
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
    perfEnter('No-conversion baseline');
    for (const fam of baseFamilies) {
        addResult(fam.strategyLabel, fam.paramLabel, fam.paramSortVal,
            { ...fam.overrides, convertExcessToRoth: false, cyclicEnabled: false, extraConversionAmount: 0, qcdHHMax: 0 }, true, fam.family, fam.modifier);
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

    perfFlush();
    OptimizerState.perfStats = {
        totalMs: performance.now() - optimizerStart, runsCount: simulationCount,
        rows: results.length, byFamily: perfRuns.family, rowsByFamily: perfRuns.rows, byPhase: perfRuns.phase,
    };
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
    let cols = [
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
            title: 'Withdrawal strategy. ✓ = Maximize Conversions on. (no conv) = baseline variant with conversions and brokerage cycling off. 🗘/🔄 = cyclic IRA-first / brokerage-first. ⇌ = Optimize Conversions row. ✦ = Optimize Spend. ⚠️ = unreachable target: the bracket/IRMAA/ACA ceiling cannot be hit. ⤴ = this row conversion goes ABOVE its own ceiling: the conversion is added on top of a draw already sized to fill the bracket or tier, so income lands over it. The row still scores well or it would not be here, but it is no longer respecting the limit in its name. Sorting this column groups each family together and orders it by parameter. Click any row to load it, or ⚖ at the start of the row to measure every Δ column against it.',
            getValue: r => r._strategyLabel,
            // Family, then parameter, then modifier - NOT the rendered label, which starts with markup
            // and emoji and scattered every clone away from the family it clones. rawSort compares
            // the key by code point; see strategySortKey() in optimizer_core.js.
            getSortValue: r => strategySortKey(r),
            rawSort: true
        },
        {
            key: 'param', label: 'Param',
            title: 'The strategy parameter: bracket/IRMAA/ACA ceiling, IRA draw %, amortization years, proportional boost %, or the Ordered account sequence (CBIR, CBRI, ...).',
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
            key: 'tax', label: 'All Taxes',
            title: 'Total tax paid over the whole plan: federal (ordinary + capital gains + NIIT), state, and Medicare IRMAA surcharges. Toggle Future $/Current $ to switch between nominal and today\'s-dollar totals.',
            getValue: r => Math.round(inC() ? r.totals.taxCurrentDollars : r.totals.tax).toLocaleString(),
            getSortValue: r => inC() ? r.totals.taxCurrentDollars : r.totals.tax
        },
        {
            key: 'spend', label: 'Spendable',
            title: 'Total after-tax money available to spend over the whole plan (gross income minus tax). Toggle Future $/Current $ for nominal vs today\'s dollars.',
            getValue: r => Math.round(inC() ? r.totals.spendCurrentDollars : r.totals.spend).toLocaleString(),
            getSortValue: r => inC() ? r.totals.spendCurrentDollars : r.totals.spend
        },
        {
            key: 'afterTaxNW', label: 'End Wealth',
            title: 'After-tax terminal net worth: IRA × (1 − your expected future IRA rate), brokerage gains × (1 − cap-gains rate), Roth + Cash + basis at face. Uses ONE shared future-IRA rate across all rows so strategies compare on a level footing. This is what the "Maximum Net Wealth" objective ranks on. Toggle Future $/Current $ for nominal vs today\'s dollars.',
            getValue: r => Math.round(inC() ? (r.afterTaxNWCurrentDollars ?? 0) : (r.afterTaxNW ?? 0)).toLocaleString(),
            getSortValue: r => inC() ? (r.afterTaxNWCurrentDollars ?? 0) : (r.afterTaxNW ?? 0)
        },
        {
            key: 'finalIRA', label: 'Final IRA',
            title: 'Traditional (pre-tax) IRA balance at the end of the plan, both people combined, at face value. This is the tax bomb: the balance that drives Required Minimum Distributions, that a surviving spouse pays Single rates on, and that heirs must empty within ten years. End Wealth already subtracts the tax owed on it; this column is the raw number that tax is charged against, and it is half of what the "Avoiding Widow & RMD Tax" objective ranks on. Toggle Future $/Current $ for nominal vs today\'s dollars.',
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
            key: 'dNW', label: 'ΔEnd Wealth' + deltaRefSuffix(),
            title: 'End Wealth minus ' + deltaRefDescription() + '. Positive (green) = this strategy ends wealthier after tax than that reference; negative (red) = it ends behind it.',
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
            key: 'rmd', label: 'All RMDs',
            title: 'Total Required Minimum Distributions forced out of traditional IRAs over the plan, in the dollars the Future $/Current $ switch selects. Lower means the strategy drew down or converted the IRA earlier, shrinking later forced withdrawals.',
            getValue: r => Math.round(inC() ? (r.totals.rmdCurrentDollars ?? r.totals.rmd) : r.totals.rmd).toLocaleString(),
            getSortValue: r => inC() ? (r.totals.rmdCurrentDollars ?? r.totals.rmd) : r.totals.rmd
        },
        {
            key: 'rmdtax', label: 'RMD Tax%',
            title: 'Share of lifetime tax attributable to RMDs. High means forced IRA distributions are driving the tax bill - a signal that earlier conversions might help.',
            getValue: r => r.totals.tax > 0 ? `${(r.totals.rmdTax / r.totals.tax * 100).toFixed(0)}%` : '—',
            getSortValue: r => r.totals.rmdTax / (r.totals.tax || 1)
        },
        {
            key: 'convBE', label: 'Break Even',
            title: 'The year this strategy\'s after-tax wealth permanently overtakes the same strategy with no conversions (same sustained-crossing definition as the single-scenario Break Even stat: the lead must hold through the end of the plan). "—" means it never sustains a lasting lead, or the strategy never converts at all. Unlike Conv Tax, this prices in the tax still owed on whatever\'s left in the IRA, so it\'s the more complete answer to whether conversions paid off overall. Sort by it, or choose "Earliest Break Even" under Optimize for, to rank strategies by how fast their conversions pay back.',
            getValue: r => r._convBEYear != null ? String(r._convBEYear) : '—',
            getSortValue: r => r._convBEYear ?? 9999
        },
        {
            // Renamed from "Tax Paid Δ". The Δ was misleading: unlike every other Δ in this table it
            // is not measured against the ⚓ baseline or a ⚖ pinned row, it is one row's own
            // conversion search compared against itself without the extra conversions.
            key: 'convSaved', label: 'Conv Tax',
            title: 'Counts only tax actually paid during the plan, so it is NOT a verdict on whether converting was worth it. Positive = the extra IRA→Roth conversions run by Optimize Conversions lowered lifetime tax vs the same strategy without them. It does not price the deferred tax still owed on the no-extra-conversion plan\'s larger remaining IRA, so a big positive number here can sit alongside a plan that ends up worse off overall. Use the Break Even column, which prices in that deferred tax, for the actual answer.',
            // Colored by SIGN, not left plain. This is a saving, so a negative means the extra
            // conversions cost MORE lifetime tax - a worse plan - and it was rendering in the same
            // black as a gain, with only a minus sign to say otherwise. No dollar prefix: every
            // other money column in this table is bare, and the heading already says what it is.
            getValue: r => {
                if (r._convSavings == null) return '—';
                const v = Math.round(inC() ? (r._convSavingsCurrent ?? r._convSavings) : r._convSavings);
                const c = v > 0 ? '#1a7f37' : v < 0 ? '#cf222e' : '#57606a';
                return `<span style="color:${c}">${v > 0 ? '+' : ''}${v.toLocaleString()}</span>`;
            },
            getSortValue: r => (inC() ? (r._convSavingsCurrent ?? r._convSavings) : r._convSavings) ?? -Infinity
        }
    ];
    // Display order comes from OPT_COLUMN_KEYS, not from the order these descriptors happen to be
    // written in. One source of truth, and reordering a column is a one-line edit in core instead
    // of moving a twenty-line block through this literal - which is exactly the edit that once
    // relocated a descriptor into an unrelated function.
    const _byKey = new Map(cols.map(c => [c.key, c]));
    const _ordered = OPT_COLUMN_KEYS.map(k => _byKey.get(k)).filter(Boolean);
    // A descriptor whose key is missing from OPT_COLUMN_KEYS would silently disappear from the
    // table. Fail loudly in the console instead, and fall back to the literal order so the table
    // still renders.
    if (_ordered.length !== cols.length) {
        const missing = cols.map(c => c.key).filter(k => !OPT_COLUMN_KEYS.includes(k));
        console.error('getOptimizerColumns: column(s) not listed in OPT_COLUMN_KEYS:', missing);
    }
    cols = (_ordered.length === cols.length) ? _ordered : cols;

    // In relative view every comparable column already IS a difference from the reference row, so a
    // column whose name says delta is a second copy of one. Dropped on BOTH paths: switching all
    // columns on must not bring them back, which is exactly how they reappeared the first time.
    const dropDeltaCols = c => !(OptimizerState.relativeView && (c.key === 'dNW' || c.key === 'dTax'));
    if (showAll) return cols.filter(dropDeltaCols);
    // Union with the pinned set, not a straight read of the goal's list. `compare` MUST survive:
    // the Best summary table drops the leading column on the understanding that it is the ⚖
    // control. A typo in the data above cannot take it out.
    const keep = new Set([...OPT_COLUMNS_PINNED, ...(OPT_OBJECTIVE_COLUMNS[objKey] || OPT_OBJECTIVE_COLUMNS.taxflex)]);
    // The Δ columns are in no goal's list. They measure against a reference, so they earn their
    // space only once the reader has chosen one by pinning a ⚖ row - until then they restate the
    // ⚓ baseline the table is already ordered around.
    // ...except in relative view, where every comparable column is already a difference from that
    // same row, so a column whose NAME says delta is just two of them.
    if (OptimizerState.compareRow) { keep.add('dNW'); keep.add('dTax'); }
    // filter(), never a map over the goal's list: this array IS the display order, so a goal's
    // columns can be written in any order and `compare` still lands at index 0.
    return cols.filter(c => keep.has(c.key) && dropDeltaCols(c));
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
            // rawSort: compare by CODE POINT, not by locale. A column whose sort value is a
            // constructed key (the Strategy column) needs its padding and field tags compared
            // literally - localeCompare treats them as ignorable and would reorder the key's fields.
            const cmp = col.rawSort ? (av < bv ? -1 : av > bv ? 1 : 0)
                : (typeof av === 'string') ? av.localeCompare(bv) : (av - bv);
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
    let bestIds = new Set();
    const colWinners = {}; // key -> winning _id
    if (feasibleSuccesses.length > 0) {
        const pick = (arr, fn, isMax) => arr.reduce((a, b) => isMax ? (fn(b) > fn(a) ? b : a) : (fn(b) < fn(a) ? b : a));
        const w1 = pick(feasibleSuccesses, r => r.totals.tax, false);
        const w2 = pick(feasibleSuccesses, r => r.totals.tax / r.totals.gross, false);
        const w3 = pick(feasibleSuccesses, r => r.totals.spend, true);
        const w5 = pick(feasibleSuccesses, r => r.totals.rmdTax / (r.totals.tax || 1), false);
        const w6 = pick(feasibleSuccesses, r => r.afterTaxNW ?? -Infinity, true);
        colWinners.tax        = w1._id;
        colWinners.rate       = w2._id;
        colWinners.spend      = w3._id;
        colWinners.rmdtax     = w5._id;
        colWinners.afterTaxNW = w6._id;
        // Earliest Break Even - the year conversions permanently overtake the same strategy without
        // them. Only rows that HAVE a break-even can win: a plan that never converts has none, and
        // the 9999 sort sentinel must not be allowed to look like the earliest year.
        //
        // Ordered THROUGH rankRows, so the badge and Rank 1 cannot disagree. The hand-written copy
        // of the tie rule that used to sit here broke ties on net wealth, and when the objective's
        // ties moved to the Roth balance first it would have gone on awarding the badge to the
        // other row - two rules for one question, drifting apart silently. One rule, in core.
        const beRows = feasibleSuccesses.filter(r => r._convBEYear != null);
        if (beRows.length > 0) colWinners.convBE = rankRows(beRows, 'earliestbe')[0]._id;
    }
    // A row counts as "Best" only for a metric the reader can actually see. bestIds drives the
    // whole-row green and the bold, and the legend promises a highlighted cell explains it - a
    // winner whose column the active goal hid would leave a green row with nothing highlighted in
    // it, which is unexplainable. colWinners itself stays complete; only what is DISPLAYED from it
    // is filtered, so nothing downstream loses information.
    const visibleKeys = new Set(columns.map(c => c.key));
    bestIds = new Set(Object.entries(colWinners).filter(([k]) => visibleKeys.has(k)).map(([, id]) => id));

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
        const isCompareRef = deltaReferenceRow() === r;
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
                     // The Δ reference row wears the ⚓ baseline's blue: it IS the baseline's job,
                     // handed to a row the reader picked. Above isWinner on purpose - having just
                     // clicked it, that is the row they are looking for.
                     : isCompareRef ? '#dbeafe'
                     : isWinner   ? '#90EE90'
                     : r._isReverseOptimized ? '#fde8d8'
                     // ✦ Optimize Spend rows no longer take the baseline blue. They carry the ✦
                     // already, and blue now means exactly one thing: the row Δ measures from.
                     : r._isConvOptimized    ? '#e8f5e9' : '';
            const extra = isCompareRef ? 'font-weight:bold;'
                        : isFailed ? 'opacity:0.75;'
                        : isInfeasible ? 'text-decoration:line-through;opacity:0.55;'
                        : isWinner     ? 'font-weight:bold;'
                        : (r._isReverseOptimized || r._isConvOptimized || r._isSpendOptimized) ? 'font-style:italic;' : '';
            const bgCss = bg ? `background-color:${bg};` : '';
            const cls = col.key === 'compare' ? ' class="opt-cmp-cell"' : '';
            const dv = OptimizerState.relativeView ? deltaCellHtml(col, r, deltaReferenceRow()) : null;
            return `<div${cls} style="padding:4px 8px;${cellActionCss(col)}${bgCss}${extra}"${cellActionAttrs(col, r, rowTitle)}>${dv ?? col.getValue(r)}</div>`;
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
            // Both pinned rows go through the delta wrapper too. They are rows like any other in
            // relative view: the reference one returns null and falls through to its own numbers,
            // and any pinned row that is NOT the reference reads as a difference. Without this the
            // two rows at the top of the table stayed absolute while everything under them was a
            // difference, in the same columns, with nothing saying so.
            else v = (OptimizerState.relativeView ? deltaCellHtml(col, baselineRow, deltaReferenceRow()) : null)
                  ?? col.getValue(baselineRow);
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
            const _rel = OptimizerState.relativeView ? deltaCellHtml(col, currentRow, deltaReferenceRow()) : null;
            const v = col.key === 'strategy' ? CURRENT_PLAN_MARK + _curBare : (_rel ?? col.getValue(currentRow));
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

    // Column-count escape hatch. Written here rather than in the markup for the same reason the two
    // legend toggles are: the count is only knowable after the columns are built.
    // The two switches. Only the label text and the checked state are written here; the switch
    // itself is CSS. checked is assigned rather than toggled so it cannot drift out of step with
    // state - applyNerdKnobVisibility can force relativeView off underneath it.
    const colTextEl = document.getElementById('opt-colmode-text');
    const colCbEl   = document.getElementById('opt-colmode-cb');
    if (colTextEl) {
        const _allCols = getOptimizerColumns(true).length;
        colTextEl.textContent = OptimizerState.showAllColumns
            ? `Show All ${_allCols} Columns (showing all ${_allCols})`
            : `Show All ${_allCols} Columns (showing ${columns.length})`;
    }
    if (colCbEl) colCbEl.checked = !!OptimizerState.showAllColumns;

    const relTextEl = document.getElementById('opt-relmode-text');
    const relCbEl   = document.getElementById('opt-relmode-cb');
    if (relTextEl) {
        const _ref = deltaReferenceRow();
        const _refName = (_ref && _ref !== OptimizerState.baseline) ? 'the ⚖ row' : 'the ⚓ baseline';
        relTextEl.textContent = `Show As Differences (from ${_refName})`;
    }
    if (relCbEl) relCbEl.checked = !!OptimizerState.relativeView;

    // Legend - make the "Infeasible" item a click toggle (rows hidden by default).
    const legendInfeasEl = document.getElementById('opt-legend-infeasible');
    if (legendInfeasEl) {
        const swatch = '<span style="display:inline-block;width:14px;height:14px;background:#e8e8e8;opacity:0.8;border:1px solid #ccc;vertical-align:middle;margin-right:4px;border-radius:2px;text-decoration:line-through;"></span>';
        if (infeasibleCount > 0) {
            const action = showInfeasible ? `click to hide ${infeasibleCount}` : `click to show ${infeasibleCount} hidden`;
            const tip = `Unreachable target (⚠️) = the strategy's bracket/IRMAA/ACA ceiling is exceeded in more than half its years, because existing income already pushes MAGI above it. Hidden by default - ${showInfeasible ? 'click to hide them again' : 'click to reveal them'}.`;
            legendInfeasEl.innerHTML = `<span onclick="toggleInfeasibleRows()" title="${tip}" style="cursor:pointer;text-decoration:underline;color:#0969da;">${swatch}⚠️ Unreachable target - ${action}</span>`;
        } else {
            legendInfeasEl.innerHTML = `${swatch}⚠️ Unreachable target - none in this run`;
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
        if (feasibleSuccesses.length > 0 && Object.keys(colWinners).some(k => visibleKeys.has(k))) {
            const winnerDefs = [
                { key: 'afterTaxNW', label: '💎 Most End Wealth',    id: colWinners.afterTaxNW },
                { key: 'spend',  label: '🏆 Most Spendable',   id: colWinners.spend  },
                { key: 'tax',    label: '📉 Lowest Tax',        id: colWinners.tax    },
                { key: 'rate',   label: '📊 Lowest Tax Rate',   id: colWinners.rate   },
                { key: 'rmdtax', label: '📋 Lowest RMD Tax%',   id: colWinners.rmdtax },
                ...(colWinners.convBE != null ? [{ key: 'convBE', label: '⏱ Earliest Break Even', id: colWinners.convBE }] : []),
                // Not a metric win at all - this is "here is the ⚓ baseline row again". It survives
                // whatever the column filter does, because nothing about it depends on a column.
                ...(OptimizerState.baseline ? [{ key: 'afterTaxNW', always: true, label: (OptimizerState.baseline._isNoConv ? '⚓ Best w/o Conv' : '⚓ Reference row'), id: OptimizerState.baseline._id }] : []),
            // Drop any winner whose column the active goal has put away. Its label names a
            // column the reader cannot find, and its highlighted cell would not be rendered.
            ].filter(w => w.always || visibleKeys.has(w.key));
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
            // Names the columns that are ACTUALLY on screen. The old string named three fixed
            // columns, one of which (Yrs Funded) is no longer a default column at all and two of
            // which the active goal may have put away. Advice pointing at a column the reader
            // cannot see is worse than no advice. dNW/dTax are excluded on purpose: their labels
            // carry the ' vs ⚖' suffix and read strangely mid-sentence.
            const _diffKeys = ['tax', 'afterTaxNW', 'mixSpread', 'finalRoth', 'finalIRA', 'rmdtax', 'convBE'];
            const _diffNames = columns.filter(c => _diffKeys.includes(c.key)).map(c => c.label).slice(0, 3);
            noteEl.textContent = 'ℹ️ All strategies show the same Total Spendable - this means every strategy fully funds your spending goal. '
                + (_diffNames.length
                    ? `Differentiate by ${_diffNames.join(', ')}.`
                    : 'Differentiate by changing what you Optimize for, or by showing all columns.');
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
            // The breakdown is nerdknob-only. It answers "why was that slow" - which pass, which
            // family - and that is a question about the tool rather than about the plan; a reader
            // comparing strategies has no use for it and two dense lines of counts under the timing
            // read as something they are supposed to act on. The headline stays for everyone.
            const n = v => v.toLocaleString();
            const pairs = o => Object.entries(o).filter(([, v]) => v > 0)
                                     .sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${n(v)}`).join(' · ');
            const fam = perf.rowsByFamily ? Object.entries(perf.rowsByFamily)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${k} ${n(v)} (${n(perf.byFamily[k] ?? 0)})`).join(' · ') : '';
            perfEl.innerHTML =
                `⏱ ${perf.totalMs.toFixed(0)}ms · ${n(perf.runsCount)} runs · ${n(perf.rows ?? 0)} rows`
                + (NERD_KNOBS && fam ? `<div style="font-size:0.85em;opacity:0.8;">Rows by strategy, runs in parens: ${fam}</div>` : '')
                + (NERD_KNOBS && perf.byPhase ? `<div style="font-size:0.85em;opacity:0.8;">Runs by pass: ${pairs(perf.byPhase)}</div>` : '');
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

// The legend fold above the table remembers whether it is open. Deliberately persisted,
// unlike showInfeasible / showFailed / showAllColumns, none of which are: those are per-analysis
// choices that should start fresh, while how much chrome you want above the table is a standing
// preference, and one that resets on every page load is not a preference at all. Its own key, not
// the saved-scenario blob under STORAGE_KEY, because this is not scenario data.
const FOLD_STORAGE_KEY = 'optimizerChromeFolds';
const FOLD_IDS = ['opt-fold-legend'];
// Chrome fires a `toggle` event when it PARSES a <details open>, before any of our init code has
// run. The strip carries `open` in the markup, so that toggle lands first, the inline handler
// writes "both open" to storage, and restoreFoldState then reads back the value it just
// clobbered - a reader who folded it would find it open again on every visit. Nothing is
// persisted until the stored preference has actually been read.
let _foldsRestored = false;

function rememberFoldState() {
    if (!_foldsRestored) return;   // parse-time toggles are not the reader's choice
    try {
        const state = {};
        FOLD_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) state[id] = el.open;
        });
        localStorage.setItem(FOLD_STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* private mode / quota: the fold still works, it just will not be remembered */ }
}

// Called once on load. Both strips are marked `open` in the markup, so a first visit and a
// storage failure both leave them open, which is the safe direction: the reader sees the legend
// they have not learned yet rather than a table of symbols with no key.
function restoreFoldState() {
    let state;
    try { state = JSON.parse(localStorage.getItem(FOLD_STORAGE_KEY) || '{}'); } catch (e) { state = null; }
    _foldsRestored = true;   // from here on, a toggle really is the reader clicking
    if (!state || typeof state !== 'object') return;
    FOLD_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el && typeof state[id] === 'boolean') el.open = state[id];
    });
}

// Turn the per-goal column filter off and back on. Every hidden column is a real column with
// real data behind it; this shows all of them at once, the way the table used to open. The
// vanished-sort-column case is handled by normalizeSortState at the render choke point, so
// this needs no guard of its own.
// Relative view on/off. The row ORDER is untouched by this: sorting keeps using getSortValue on
// the absolute values, and a difference from a common reference is monotonic in that absolute, so
// the ranking is identical in both modes. Only what each cell prints changes.
function toggleRelativeView() {
    OptimizerState.relativeView = !OptimizerState.relativeView;
    if (OptimizerState.results) renderOptimizerTable(OptimizerState.results);
}

function toggleAllColumns() {
    OptimizerState.showAllColumns = !OptimizerState.showAllColumns;
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
        // A cached row from before the top bracket was disabled can still carry 0.37, and setting
        // .value to a disabled <option> in code succeeds. Drop it to the highest real ceiling
        // rather than running a plan the dropdown says is unavailable.
        clampStratRateSelection(document.getElementById('stratRate'));
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
        // Same PF8 class, one dimension later: a 🅡 row that loaded without its Roth position ran
        // the un-cloned plan. Set unconditionally, including back to off for the rows that are not
        // 🅡 clones, or a leftover setting follows the next strategy loaded.
        const rgEl = document.getElementById('rothGapFill');
        if (rgEl) rgEl.checked = (result._selection.rothGapFill === 'fillCashThenRoth');
        if (result._strategy === 'ordered' && result._selection.orderedSeq) {
            const seqEl = document.getElementById('orderedSeq');
            if (seqEl) seqEl.value = result._selection.orderedSeq;
        } else if (result._strategy === 'gk') {
            const gEl = document.getElementById('gkGuard'), aEl = document.getElementById('gkAdjPct');
            if (gEl && result._selection.gkGuard != null) gEl.value = Math.round(result._selection.gkGuard * 100);
            if (aEl && result._selection.gkAdjPct != null) aEl.value = Math.round(result._selection.gkAdjPct * 100);
        } else if (result._strategy === 'split' && Array.isArray(result._selection.splitWeights)) {
            // Same PF8 class again: without this, clicking "Fixed Split Brok 90 / Cash 10" would set
            // the strategy and leave whatever mix the sidebar already had, so the table would show
            // one plan and the click would run another.
            const ids = ['splitIRA', 'splitBrok', 'splitCash', 'splitRoth'];
            result._selection.splitWeights.forEach((w, i) => {
                const el = document.getElementById(ids[i]);
                if (el) el.value = w;
            });
            syncSplitPresetFromFields();
            updateSplitMixNote();
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
    'ConvTaxCash': ['Cash Δ', 'Opp. Cost'],
    'ttlCashWD': ['Cash Δ', 'Spending'],

    // Balances - end-of-year balances
    'IRA1': ['Balances', 'IRA Δ'],
    'IRA2': ['Balances', 'IRA Δ'],
    'TotalIRA': ['Balances', 'IRA Δ'],
    'Cash': ['Balances', 'Cash Δ'],
    'CashReserve': ['Balances', 'Cash Δ'],
    'Roth': ['Balances', 'Roth Δ'],
    'Brokerage': ['Balances', 'Brokerage Δ'],
    'Basis': ['Balances', 'Brokerage Δ'],
    'SumSpendable': ['Balances'],

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
    'acaBreach': ['Taxation'],
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
    'DRIP': ['Brokerage Δ'],
    'SurplusBrok': ['Brokerage Δ', 'Cash Δ'],
    'SumBrokIn': ['Brokerage Δ'],

    // Cash Changes - balance, withdrawals, growth
    'CashWD': ['Cash Δ', 'Income', 'Spending'],
    'AdvisorFee': ['Summary', 'Spending', 'Balances'],
    'SumAdvisorFees': ['Balances'],
    'cashG': ['Cash Δ'],
    'surplusCash': ['Cash Δ', 'Income', 'Spending'],
    // Phase 27: inflows/outflows + withdrawal rate
    'grossOut': ['Summary', 'Withdrawals'],
    'netOut':   ['Summary', 'Withdrawals'],
    'inflows':  ['Summary', 'Withdrawals', 'Spending'],
    'wdRate%':  ['Summary', 'IRA Δ'],

    // Debug / performance - only visible under Show All (no checkbox maps to 'Debug')
    'loopMs': ['Debug'],

    // What the market handed this year. No checkbox maps to 'Market' either, so these three are
    // Show All only for now: in a deterministic run they are the same two numbers on every row,
    // and they only start saying anything once a Monte Carlo path is being read back.
    'infl%':    ['Market'],
    'inflCum%': ['Market'],
    'return%':  ['Market'],

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
    'AdvisorFee': 'Withdrawals', 'SumAdvisorFees': 'Withdrawals',
    'FedRate%': 'Taxes', 'StateRate%': 'Taxes', 'IRMAATier': 'Taxes',
    'IRMAA': 'Taxes', 'Medicare': 'Taxes', 'totalTax': 'Taxes', 'FedTax': 'Taxes', 'StateTax': 'Taxes',
    'CapGains': 'Taxes', 'MAGI': 'Taxes', 'NominalRate%': 'Taxes',
    'FedCap': 'Taxes', 'StateCap': 'Taxes', 'SumTaxes': 'Taxes',
    'BracketTarget': 'Taxes', 'BracketOverage': 'Taxes', 'acaBreach': 'Taxes',
    'ForcedIRA': 'Withdrawals',
    'IRA1': 'Balances', 'IRA2': 'Balances', 'TotalIRA': 'Balances',
    'Roth1': 'Balances', 'Roth2': 'Balances',
    'Cash': 'Balances', 'CashReserve': 'Balances', 'Roth': 'Balances', 'Brokerage': 'Balances',
    'Basis': 'Balances', 'totalWealth': 'Balances', 'SumSpendable': 'Balances',
    'brokerageG': 'Balances', 'DRIP': 'Balances', 'SurplusBrok': 'Balances', 'SumBrokIn': 'Balances',
    'cashG': 'Balances', 'rothG': 'Balances', 'RMD%': 'Balances',
    'ConvTaxCash': 'Withdrawals',
    'ttlCashWD': 'Withdrawals',
    'convOC': 'Opp. Cost', 'excessOC': 'Opp. Cost', 'convTax': 'Opp. Cost', 'excessTax': 'Opp. Cost',
    'BETR%': 'Opp. Cost', 'betrFlag': 'Opp. Cost', 'extraConv': 'Opp. Cost',
    'subCycle': 'Withdrawals',
    'grossOut': 'Withdrawals',
    'netOut': 'Withdrawals',
    'inflows': 'Withdrawals',
    'wdRate%': 'Withdrawals',
    'timing': 'Withdrawals',
    'gkSpend': 'Income', 'gkAdj': 'Income',
    'infl%': 'Market', 'inflCum%': 'Market', 'return%': 'Market',
};

// P86: the running-total columns are COMPUTED HERE, not stored in the engine log. A stored nominal
// sum-to-date divided by one row's inflation factor is the wrong Current-$ number (it can even
// fall year over year); the right one is the running sum of each year's deflated flow. This is a
// NAMED list on purpose - never infer accumulators by monotonicity: per-year flows like spendGoal
// and netIncome legitimately DECLINE under Current-$ and must keep doing so.
// `after` = the log key each computed column is spliced after; these are the columns' historical
// positions, and rebuildGroupRow colSpans runs of consecutive same-group columns, so moving one
// into the middle of another run shears the Annual Details banner (the P84 lesson).
const ANNUAL_RUNNING_TOTALS = {
    'SumTaxes':       { after: 'StateCap',         source: r => r.totalTax ?? 0 },
    'SumAdvisorFees': { after: 'AdvisorFee',       source: r => r.AdvisorFee ?? 0 },
    // Delivered spend = goal + shortfall (shortfall is <= 0 by construction), the same per-year
    // quantity totals.spend accumulates in the engine, Guyton-Klinger included.
    'SumSpendable':   { after: 'guaranteedIncome', source: r => (r.spendGoal ?? 0) + (r.shortfall ?? 0) },
    // 11.1703: contributions into Brokerage that are not market growth - reinvested dividends plus
    // surplus the Cash Reserve rule routed there - so the reader can see how much of the balance
    // was put in rather than earned.
    'SumBrokIn':      { after: 'SurplusBrok',      source: r => (r.DRIP ?? 0) + (r.SurplusBrok ?? 0) },
};

// ONE key list for the Annual Details header row, body rows and content scan: the engine log's own
// keys with the computed running-total columns spliced in. Three consumers, one list - the docblock
// above isTableColumnKey explains what happened last time two of them disagreed.
function annualDetailsKeys(log) {
    const keys = Object.keys(log[0]);
    for (const [key, def] of Object.entries(ANNUAL_RUNNING_TOTALS)) {
        const at = keys.indexOf(def.after);
        keys.splice(at >= 0 ? at + 1 : keys.length, 0, key);
    }
    return keys;
}

// One pass per render: each computed column's per-row value in the basis the toggle selects.
// Future $ = running sum of the nominal per-year flow; Current $ = running sum of each year's
// flow deflated by THAT year's factor (the totals.*CurrentDollars idiom).
function computeRunningTotals(log, inCurrentDollars) {
    const out = {};
    for (const [key, def] of Object.entries(ANNUAL_RUNNING_TOTALS)) {
        let sum = 0;
        out[key] = log.map(row => {
            const flow = def.source(row);
            sum += inCurrentDollars ? flow / (row.inflationFactor || 1) : flow;
            return sum;
        });
    }
    return out;
}

// The category -> checkbox id map, in the order the boxes appear in the markup.
//
// One copy, because there were three: getActiveCategories() and showSpendingOnly() each spelled the
// same ten ids out by hand, and showAnnualColumns() would have made a fourth. A category added to
// `columnCategories` without a checkbox here is simply not reachable from the pickers, which is
// already true of 'Withdrawals', 'Taxes', 'Who' and 'Market' - those are GROUP labels
// (`columnGroupDefs`), a different vocabulary that happens to overlap.
const CATEGORY_CHECKBOXES = {
    'Summary': 'cat-summary', 'Balances': 'cat-balances', 'Income': 'cat-income',
    'Taxation': 'cat-taxation', 'IRA Δ': 'cat-ira', 'Roth Δ': 'cat-roth',
    'Brokerage Δ': 'cat-brokerage', 'Cash Δ': 'cat-cash', 'Opp. Cost': 'cat-oppcost',
    'Spending': 'cat-spending',
};

// Get active categories based on checkbox state
function getActiveCategories() {
    return Object.keys(CATEGORY_CHECKBOXES)
        .filter(cat => document.getElementById(CATEGORY_CHECKBOXES[cat])?.checked);
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

// ONE rule for what becomes a column in Annual Details, used by the header row, the body rows and
// the content scan. It has to be one rule: the header used to emit every key that did not start with
// '-', while the body ALSO skipped `inflationFactor`, so from that column rightward every body cell
// sat under the header to its left and the last column had no cell at all. `loopMs` was that last
// column and read as permanently empty, while the cells under the `inflationFactor` heading were
// actually loopMs values - plausible enough in year 1, where the factor really is 1, to go unnoticed
// for months.
//
// '-' prefix = internal, chart-only or handoff-only. `inflationFactor` is the cumulative inflation
// MULTIPLIER, which the current-dollars toggle divides by; the reader-facing form of it is the
// `inflCum%` column.
function isTableColumnKey(key) {
    return !key.startsWith('-') && key !== 'inflationFactor';
}

// Account BALANCE columns are never treated as empty (user, 2026-09-01). A balance of zero is a
// fact about the plan - "this account is empty all the way through" - and hiding the column turns
// that fact into a missing column, which reads as "the tool does not track Cash" rather than "you
// have no Cash". Every other column is a FLOW or a rate, where all-zero really does mean the row has
// nothing to say and the column is noise.
//
// Deliberately the aggregate accounts only. IRA1/IRA2/Roth1/Roth2 are per-PERSON splits, and an
// all-zero Roth2 for a single filer is not an empty account, it is an absent person - suppressing
// that one is right.
const ALWAYS_SHOW_BALANCE_COLS = new Set([
    'Cash', 'Brokerage', 'Basis', 'TotalIRA', 'Roth', 'totalWealth', 'SumSpendable',
]);

// Analyze which columns have content (non-zero, non-empty values)
function analyzeColumnContent(log) {
    if (!log || log.length === 0) return {};

    const keys = annualDetailsKeys(log).filter(isTableColumnKey);
    const columnStatus = {};

    keys.forEach(key => {
        if (ALWAYS_SHOW_BALANCE_COLS.has(key)) { columnStatus[key] = true; return; }
        let hasNonZeroValue = false;

        for (const row of log) {
            // A computed running total has content iff any year's SOURCE flow is non-zero
            // (keeps "no advisor fee -> SumAdvisorFees hidden" working).
            const value = ANNUAL_RUNNING_TOTALS[key] ? ANNUAL_RUNNING_TOTALS[key].source(row) : row[key];

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
//
// Deliberately NOT built on showAnnualColumns() below. Its verb is "only": it is a button in the
// table's own toolbar, pressed by a reader who can see what they are clearing. showAnnualColumns()
// is the opposite operation - additive, fired from a sentence elsewhere on the page - and folding
// the two together would give one of them the wrong behavior.
function showSpendingOnly() {
    Object.values(CATEGORY_CHECKBOXES).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = (id === 'cat-spending');
    });
    const showAll = document.getElementById('show-all');
    if (showAll) showAll.checked = false;
    updateColumnVisibility();
}

// ── Sending a reader to a column, from anywhere on the page ─────────────────
//
// Several notes end "See BracketOverage in Annual Details." Following that by hand is four steps:
// switch tabs, work out which category the column belongs to, tick that category, then find the
// column among twenty-odd others. Two of those notes name a column that is OFF by default, so a
// reader who followed the instruction literally arrived at a table that did not contain it.
//
// ADDITIVE, not isolating. The click comes from the sidebar, where the reader cannot see the table
// they are about to disturb, so silently wiping their column selection would be a bigger action
// than the one they asked for - and it has no undo. Findability is bought with the scroll and the
// flash instead. Whatever they had checked stays checked.
//
// Returns true if it showed something, false if it changed nothing. The false case is what makes a
// dead link impossible: `acaBreach` was named by a note for months while being an internal field
// the table strips, and a test walks the links to keep that from coming back.
let _colRevealTimer = null;
function showAnnualColumns(...keys) {
    keys = keys.flat().filter(Boolean);
    if (!keys.length) return false;

    // The Documentation tab can be read before anything has been simulated, so the table may not
    // exist yet. Build it the way #btn-tbl does rather than sending the reader to an empty tab.
    let table = document.getElementById('main-table');
    let head = table?.tHead?.rows[table.tHead.rows.length - 1];
    if (!head || !head.cells.length) {
        if (typeof runSimulation === 'function') runSimulation();
        table = document.getElementById('main-table');
        head = table?.tHead?.rows[table.tHead.rows.length - 1];
    }
    if (!head || !head.cells.length) return false;

    // Match on the rendered header text, which is `displayKey` - a trailing '!' is stripped at
    // render time - never on the raw log key.
    const cells = [...head.cells];
    const found = [];
    keys.forEach(key => {
        const idx = cells.findIndex(th => th.textContent.trim() === key);
        if (idx >= 0) found.push({ key, idx, th: cells[idx] });
    });
    if (!found.length) return false;   // nothing to show: leave the page exactly as it was

    // Turn on only what is missing, and only the first category that has a picker.
    const showAll = document.getElementById('show-all');
    found.forEach(({ key }) => {
        if (isColumnVisible(key)) return;
        const cat = (columnCategories[key] ?? []).find(c => CATEGORY_CHECKBOXES[c]);
        const box = cat && document.getElementById(CATEGORY_CHECKBOXES[cat]);
        if (box) box.checked = true;
        else if (showAll) showAll.checked = true;   // categorized outside the pickers
    });

    // A column of all zeros stays hidden behind its own switch. Ticking the switch - rather than
    // stripping .hidden-column off the one cell - keeps updateColumnVisibility() the single
    // authority, and shows the reader why the rest of the table changed with it.
    const showEmpty = document.getElementById('show-empty-columns');
    if (showEmpty && !showEmpty.checked && found.some(f => f.th.classList.contains('empty-column'))) {
        showEmpty.checked = true;
    }

    // BEFORE the two steps below: inside a hidden card every rect reads 0, so syncTopScroll() would
    // hide the mirror scrollbar and the scroll maths would land on 0.
    showTab('tab-tbl');
    updateColumnVisibility();

    // Centre the first named column. Centring rather than left-aligning also clears the sticky
    // `year` column, which would otherwise sit on top of it.
    const sc = document.getElementById('tbl-scroll');
    if (sc) {
        const scRect = sc.getBoundingClientRect(), thRect = found[0].th.getBoundingClientRect();
        const delta = (thRect.left - scRect.left) - Math.max(0, (scRect.width - thRect.width) / 2);
        sc.scrollLeft = Math.max(0, sc.scrollLeft + delta);
    }
    // On a phone the sidebar is a full-width header above the table, so the table can be a screen
    // away. Only scroll the page when it actually is.
    const card = document.getElementById('tab-tbl');
    if (card) {
        const r = card.getBoundingClientRect();
        if (r.top < 0 || r.top > window.innerHeight * 0.6) {
            // NOT behavior:'smooth', which the other two scrollIntoView calls in this repo use.
            // Measured on a 375x812 viewport with the table card 1,421px down the page: 'smooth'
            // left scrollY at 0 and the reader saw nothing move, while the default 'auto' scrolled.
            // A phone is exactly where this call matters, so it does not get to be the case that
            // silently does nothing. No stylesheet here sets scroll-behavior, so 'auto' is a jump.
            card.scrollIntoView({ block: 'start' });
        }
    }

    // Say which column was the answer. A revealed column in a table of twenty is otherwise
    // indistinguishable from the nineteen the reader did not ask for.
    if (_colRevealTimer) { clearTimeout(_colRevealTimer); _colRevealTimer = null; }
    document.querySelectorAll('.col-reveal').forEach(el => el.classList.remove('col-reveal'));
    const bodyRows = table.querySelectorAll('tbody tr');
    found.forEach(({ idx, th }) => {
        th.classList.add('col-reveal');
        bodyRows.forEach(row => row.cells[idx]?.classList.add('col-reveal'));
    });
    _colRevealTimer = setTimeout(() => {
        document.querySelectorAll('.col-reveal').forEach(el => el.classList.remove('col-reveal'));
        _colRevealTimer = null;
    }, 2200);

    return true;
}

// Prose that points at a TAB rather than a column. It clicks the real tab button instead of calling
// showTab() directly, because the buttons do more than switch: #btn-opt runs the sweep, #btn-tbl
// re-runs the simulation. A link that only called showTab('tab-opt') would land the reader on an
// empty Optimizer. Clicking the button also means this can never drift from what the button does.
function goToTab(tabId) {
    const btn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
    if (!btn) return false;
    btn.click();
    return true;
}

// The two link builders. House style: a <span> with inline styles calling a bare global. No <a>,
// and no href="#" - a fragment on the URL is exactly the reload risk these links exist to avoid.
//
// Deliberately no title=. setupSmallScreenUX() exempts only button/a/select/input/textarea from its
// tap-popover conversion, so a titled span would both fire its onclick AND leave a popover floating
// over the tab it just opened. The sentence around the link is the affordance.
const _LINK_STYLE = 'cursor:pointer;color:#2980b9;text-decoration:underline;'
                  + 'text-decoration-style:dotted;';
function annualLink(...keys) {
    keys = keys.flat().filter(Boolean);
    const args = keys.map(k => `'${k}'`).join(',');
    return `<span onclick="showAnnualColumns(${args})" style="${_LINK_STYLE}">`
         + `${keys.join(' and ')}</span>`;
}
function tabLink(tabId, text) {
    return `<span onclick="goToTab('${tabId}')" style="${_LINK_STYLE}">${text}</span>`;
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

    const keys = annualDetailsKeys(log);
    // P86: computed running-total columns, already in the basis the toggle selects - their cells
    // must NOT go through the generic per-row deflation below.
    const _inCurrentDollars = document.getElementById('show-current-dollars')?.checked;
    const _runningTotals = computeRunningTotals(log, _inCurrentDollars);

    // Create header - row 0 is the group banner, row 1 is the column names
    const thead = table.createTHead();
    thead.insertRow(); // group row placeholder - populated by rebuildGroupRow below
    const headerRow = thead.insertRow();

    // Medicare age is stated in three tooltips below; read it from the tax data so the copy
    // cannot drift from the gate that actually charges the surcharge.
    const medAge = TAXData.IRMAA.ELIGIBILITY_AGE;

    const tooltips = {
        'year': 'When yellow, it indicates a single survivor. If the rest of the row is pink, it means the year was underfunded. During a path replay, the dark red line across a row marks the year the money runs out.',
        'age1': 'Age at end of year (Dec 31). Used for RMD eligibility. May differ from current age shown in Profile & Ages if birthday falls late in the year.',
        'age2': 'Spouse age at end of year (Dec 31). Used for RMD eligibility. May differ from current age shown in Profile & Ages if birthday falls late in the year.',
        'RMDwd': 'Total of all Required Minimum Distributions (RMDs)',
        'QCD1': 'Qualified Charitable Distribution from Your IRA. Satisfies RMD requirement and is excluded from taxable income/MAGI (reduces IRMAA exposure). Age 70½+ only.',
        'QCD2': 'Qualified Charitable Distribution from Spouse IRA. Satisfies Spouse RMD requirement and is excluded from taxable income/MAGI (reduces IRMAA exposure). Age 70½+ only.',
        'RMD%': 'The highest percentage RMD required for IRA1 or IRA2.',
        'Brokerage': 'Year end Brokerage balance. Last year\'s Brokerage, minus Brokerage-, plus BrokerageG, plus SurplusBrok (less any advisor fee charged to this account) is this year\'s balance.',
        'Brokerage-': 'Withdrawals from Brokerage account (asset sales/cash withdrawal)',
        'brokerageG': 'Growth of the Brokerage balance this year: the market return on what was held, PLUS dividends reinvested into it when Dividend Reinvestment is on (that part is shown on its own as DRIP). Does NOT include surplus routed here by the Cash Reserve rule - that is SurplusBrok.',
        'DRIP': 'Dividends reinvested into Brokerage this year, when Dividend Reinvestment is on. Already inside BrokerageG; shown here so the market return can be read apart from it. Zero when dividends flow to Cash instead.',
        'SurplusBrok': 'Money the Cash Reserve rule routed into Brokerage this year: the year\'s surplus above the reserve target (with a reserve of 0, all of it). Not part of BrokerageG. Zero when Cash Reserve is Off, since surplus then stays in Cash.',
        'SumBrokIn': 'Running total of DRIP plus SurplusBrok: every dollar that entered Brokerage as a contribution rather than as market growth. In Current $ mode each year is converted to today\'s purchasing power before it is added.',
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
        'BracketOverage': 'Amount MAGI exceeded the bracket target. Two things put it above: spending needs that could not be funded inside the ceiling, and an Extra Annual Roth Conversion, which is added on top of the ceiling rather than fitted inside it.',
        'acaBreach': 'Yes in a year an ACA Cliff plan could not both stay under its income cap and fund the Spend Goal. Two outcomes reach it: MAGI went over the cap anyway, which shows as BracketOverage, or the plan held the cap and left spending unfunded, which shows as shortfall. Blank on every plan that is not using an ACA FPL cap, and on cap years that held without costing anything.',
        'ForcedIRA': 'Extra IRA withdrawn to fund mandatory spending after Cash, Brokerage and Roth were exhausted. For the Fill Bracket and IRMAA Tier strategies this draw goes above their ceiling, which is what makes those ceilings soft. ACA Cliff never does this while its cap is in force: an IRA withdrawal is taxable income and crossing the cap forfeits the premium subsidy, so it leaves a shortfall instead. Once that cap ends at Medicare it is funded like any other strategy.',
        'spendGoal': 'This amount increases by inflation less Spend Delta%.',
        'Roth': 'Combined Roth balance at year end.',
        'Roth1': "Person 1's Roth balance at year end.",
        'Roth2': "Person 2's Roth balance at year end.",
        'rothG': 'Growth in the Roth (added to Roth account)',
        'rothConv': 'Amount that actually landed in Roth this year (IRA→Roth). A conversion owes tax on the amount converted: unless "Use Cash" (under Maximize Conversions) is on, that tax is taken out of the conversion itself, so this reads LOWER than the gross amount withdrawn (e.g. a $20,000 Extra Annual Roth Conversion lands ~$13,700 at a 31% marginal rate). With cash-funding on, the tax is paid from Cash instead and the full amount lands here. See the extraConv column (Opp. Cost category) for the gross figure.',
        'CashReserve': 'The part of the Cash balance that is your Cash Reserve at year end: the smaller of the reserve target (your Cash Reserve input, grown with inflation) and the Cash actually held. Cash above it is what the routing rule sent, or left, there; a year where this reads below the target is a year spending had to break into the reserve. Hidden when there is no reserve (Cash Reserve Off or 0).',
        'CashWD': 'Cash drawn to fund SPENDING, tax free. This is not every dollar that can leave Cash: when "Use Cash" (under Maximize Conversions) is on, the conversion tax is paid from Cash too and appears in ConvTaxCash instead. The two together are the whole Cash outflow for the year.',
        'ttlCashWD': 'Every dollar that left Cash this year: the spending draw (Cash WD) plus the conversion tax when "Use Cash" funds it (ConvTaxCash). Shown beside Cash WD in the Withdrawals band. Last year’s Cash balance minus this, plus interest and growth, is this year’s Cash balance.',
        'ConvTaxCash': 'Roth conversion tax paid out of Cash rather than netted out of the conversion, which happens only when "Use Cash" (under Maximize Conversions) is on. Kept separate from Cash WD because this money funded a conversion, not spending - the income and asset-flow charts would double-count it as spending money otherwise. Start-of-year Cash minus Cash WD minus ConvTaxCash, plus interest and growth, is the year-end Cash balance.',
        'surplusCash': 'Cash left over after spending and taxes were covered - routed back into the Cash account (or on to Roth conversion if Max Conversion is enabled).',
        'cashD+I': 'Dividends (from brokerage) and interest from Cash (deposits)',
        'MAGI': 'Modified Adjusted Gross Income - determines future IRMAA',
        'totalTax': 'Federal, State, IRMAA, NIIT, and CapGains taxes - in total.',
        'SumTaxes': 'Running total of Federal, State, IRMAA, NIIT, and CapGains taxes. In Current $ mode each year is converted to today\'s purchasing power before it is added, so the total never falls.',
        'AdvisorFee': 'Advisor or fund fee charged this year, on the previous December 31 balances. Money taken from an IRA to pay it is not a taxable distribution.',
        'SumAdvisorFees': 'Running total of advisor and fund fees paid. In Current $ mode each year is converted to today\'s purchasing power before it is added, so the total never falls.',
        'SumSpendable': 'Running total of after-tax money actually delivered for spending (the spending goal minus any shortfall). In Current $ mode each year is converted to today\'s purchasing power before it is added.',
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
        'infl%': 'Inflation applied to the spending goal for this year. Fixed at your Inflation input in a normal run; under Monte Carlo each path draws its own, so this column is how you see which years the path got expensive. Note that tax brackets and IRMAA thresholds index at the separate CPI input instead, which is why a high-inflation year can raise spending without widening the brackets that spending is taxed in.',
        'inflCum%': 'How much the price level has risen since the plan started, compounding the infl% column. Divide any nominal dollar figure by 1 + this to read it in current dollars, or flip the Future $ / Current $ switch above the tabs and let every column do it for you.',
        'return%': 'The market return this year before dividends and before any per-account mix is applied: your Growth input in a normal run, or the year drawn from the Monte Carlo path. The balance columns will not move by exactly this much - each account adds its dividend yield and blends its own stock/bond/international split, and Cash earns its own yield instead.',
        'timing': 'Withdrawal timing auto-selected each year. Early(Conv) = conversion year (withdrawal in 1st quarter, ideally January - maximizes Roth compounding). Late(Spend) = spending-only year (withdrawal in last quarter, ideally December - full portfolio compounds before withdrawal exits, gaining D×r per year).',
    };

    keys.forEach(key => {
        if (isTableColumnKey(key)) {
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
    // P69g: under replay, the FIRST year the portfolio cannot cover its required draw is the ruin
    // year the Monte Carlo run scored - the same rule the engine's path loop applies. Later years
    // also shade pink (underfunded), so without this mark the one year that defines "ruin 2035"
    // in the banner would be indistinguishable from the wreckage after it.
    const _ruinYear = (typeof _replayState !== 'undefined' && _replayState)
        ? (log.find(r => ((r.portfolioBalance ?? 0) <
              Math.max(0, (r.spendGoal ?? 0) - (r.guaranteedIncome ?? 0))))?.year ?? null)
        : null;
    log.forEach((row, i) => {
        const tr = tbody.insertRow();
        const _isRuinRow = _ruinYear != null && row.year === _ruinYear;

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
            if (isTableColumnKey(key)) {
                const td = tr.insertCell();
                const isRunningTotal = !!ANNUAL_RUNNING_TOTALS[key];
                const value = isRunningTotal ? _runningTotals[key][i] : row[key];

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
                // After the Tax Planner title above, which would otherwise overwrite this one.
                if (_isRuinRow) {
                    td.style.borderTop = '2px solid #c0392b';
                    if (key === 'year') {
                        td.title = 'Money runs out this year: the portfolio can no longer cover '
                                 + 'required spending - the ruin year the Monte Carlo run reported '
                                 + 'for this path. Click to open Tax Payment Planner for this year.';
                    }
                }

                // Columns whose useful magnitude is below 1, so the whole-number rounding every
                // other column gets would print 0 forever. loopMs is the engine's time for one
                // simulated year: ~0.2ms on a normal plan, which read as "0" the moment the column
                // was fixed enough to render at all.
                const isFractional = (key === 'loopMs');
                // Check if key indicates percentage
                const isPercent = key.toLowerCase().includes('%');
                const isYear = key.toLowerCase().includes('yr') || key.toLowerCase().includes('year');

                // `value !== ''` is load-bearing: isNaN('') is FALSE, because Number('') is 0, so an
                // empty cell took the numeric branch and printed "0". P99 found it on `acaBreach`,
                // whose blank years read as a real zero beside the years that read "Yes". It is the
                // only key in any log that holds '', so this is that column and nothing else -
                // measured, not assumed - but the rule is general: an empty cell is not a zero.
                if (value != null && value !== '' && !isNaN(value)) {
                    if (isPercent) {
                        // Format as percentage (convert from decimal)
                        td.textContent = (value * 100).toFixed(2);
                    } else if (isFractional) {
                        td.textContent = value.toFixed(2);
                    } else {
                        // Format as whole number
                        if (isYear) {
                            td.textContent = value;
                        } else {
                            // Running totals are already in the selected basis (a running sum of
                            // deflated years); dividing that sum by this row's factor would be
                            // the exact mistake P86 removed.
                            const displayValue = (_inCurrentDollars && !isRunningTotal)
                                ? value / (row.inflationFactor || 1) : value;
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
    // P84. Self-hiding: a plan with no fee shows no tile, so the row does not grow a permanent $0
    // for the many users who never set one.
    const feeTile = document.getElementById('stat-advisorfee-tile');
    if (feeTile) {
        const fees = totals.advisorFees || 0;
        feeTile.style.display = fees > 0 ? '' : 'none';
        if (fees > 0) {
            const dispFees = inCD ? (totals.advisorFeesCurrentDollars || 0) : fees;
            document.getElementById('stat-advisorfee').innerText = '$' + Math.round(dispFees).toLocaleString();
            const sub = document.getElementById('stat-advisorfee-sub');
            // The average yearly fee, which needs nothing this function does not already have.
            // DELIBERATELY NOT a ratio against end wealth: the fee's real cost is larger than the
            // fee, because the money it removed would have compounded. On the shipped defaults a
            // 1% fee charges $212,267 and lowers the ending balance by $433,490. Any single-number
            // ratio here would understate that by roughly half while looking authoritative; the
            // honest version needs a second simulation, the way Break Even does, and that belongs
            // in a phase of its own rather than in a tile sub-label.
            const yrs = totals.yearstested || 0;
            // P86: the average divides the DISPLAYED total, so the sub-label and the tile above it
            // are always on the same basis.
            if (sub) sub.innerText = yrs > 0
                ? '$' + Math.round(dispFees / yrs).toLocaleString() + '/yr average' : '';
        }
    }
    const rmdEl = document.getElementById('stat-rmd');
    const rmdPctEl = document.getElementById('stat-rmd-pct');
    // P86: lifetime RMD and QCD are accumulated flows like All Taxes beside them, so they follow
    // the toggle through the engine's sum-of-deflated-years twins.
    const dispRmd = inCD ? (totals.rmdCurrentDollars ?? totals.rmd) : totals.rmd;
    const dispQcd = inCD ? (totals.qcdCurrentDollars ?? totals.qcd) : totals.qcd;
    if (rmdEl) rmdEl.innerText = '$' + Math.round(dispRmd ?? 0).toLocaleString();
    if (rmdPctEl) {
        const rmdPctStr = totals.tax > 0 ? `${((totals.rmdTax ?? 0) / totals.tax * 100).toFixed(0)}% of taxes` : '';
        const qcdStr = (dispQcd ?? 0) > 0 ? ` | QCD $${Math.round(dispQcd).toLocaleString()}` : '';
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
                // P86: the ⓘ dollars honor the toggle at FORMAT time only - the search and its
                // thresholds stay nominal, so the suggestion itself never flips with the view.
                // Stop-year gains are after-tax terminal-wealth differences (stocks at the final
                // date), so they deflate by the terminal factor; a named conversion amount is a
                // flow in its own year and deflates by that year's factor.
                const _beDeflTerm = inCD
                    ? 1 / (lastSimulationLog?.[lastSimulationLog.length - 1]?.inflationFactor || 1) : 1;
                const _beDeflAtYear = (y) => inCD
                    ? 1 / (lastSimulationLog?.find(r => r.year === y)?.inflationFactor || 1) : 1;
                // Secondary color, only when Break Even is blank: which conversion erased the lead.
                let boundaryNote = '';
                if (totals.convBEYear == null) {
                    const diag = diagnoseConvBreakEvenFailure(lastSimInputs, lastSimulationLog);
                    if (diag) boundaryNote = formatBreakEvenDiagnosis(diag, _beDeflAtYear);
                }
                const built = formatStopYearMessage(sugg, boundaryNote, mode, _beDeflTerm);
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
    // P102b2. Immediately after _beStopSuggestion is refreshed, and never before it: the
    // 'when they stop paying' stop-year position adopts that exact object rather than searching
    // again, which is what makes it and the Break Even icon agree by construction.
    syncAutoStopYear();

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
// `deflAtYear` (P86) converts a named year's conversion amount to the displayed basis - a flow in
// its own year deflates by that year's factor. Defaults to identity for Future $.
function formatBreakEvenDiagnosis(diag, deflAtYear = () => 1) {
    const _fmt = (n, y) => '$' + Math.round(n * deflAtYear(y)).toLocaleString();
    let msg;
    if (diag.outcome === 'neverSustains') {
        msg = `The first conversion, in ${diag.breakingYear} (${_fmt(diag.breakingAmount, diag.breakingYear)}), never earns back its own tax cost by the end of the plan.`;
    } else {
        msg = `Conversions through ${diag.lastSustainableYear} would have broken even in ${diag.lastSustainableBEYear}. The ${diag.breakingYear} conversion (${_fmt(diag.breakingAmount, diag.breakingYear)}) is the one that erases the lead for good.`;
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
// `deflTerm` (P86) converts the terminal-wealth gains to the displayed basis; the `> 1` decision
// thresholds below deliberately stay on the NOMINAL values so the toggle never changes which
// suggestion is made, only the dollars that describe it.
function formatStopYearMessage(sugg, boundaryNote, mode, deflTerm = 1) {
    if (!sugg) return { msg: boundaryNote || '', suggestion: null };
    const _m = (n) => '$' + Math.round(n * deflTerm).toLocaleString();
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
// radius makes them identical by construction, matches the marker's own color exactly, and does
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

// 11.1703: the balances chart's vertical scale - 'linear' (today's chart), 'log10' or 'log2'.
// A log axis spreads out the small balances that sit in the looks-like-zero band under a large
// one. Session-only, like the person view; the page loads linear.
let assetChartScale = 'linear';
function setAssetChartScale(v) {
    assetChartScale = (v === 'log10' || v === 'log2') ? v : 'linear';
    const sel = document.getElementById('assetScale');
    if (sel && sel.value !== assetChartScale) sel.value = assetChartScale;
    if (lastSimulationLog) updateCharts(lastSimulationLog);
}

// Dollar labels for a log axis: 1k, 10k, 250k, 1M, 2.5M. Chart.js's own log ticks print raw
// numbers, which at eight digits are unreadable beside a chart.
function fmtAxisDollars(v) {
    const n = Number(v);
    if (!isFinite(n)) return String(v);
    const f = (x, s) => (Math.round(x * 10) / 10).toString().replace(/\.0$/, '') + s;
    if (Math.abs(n) >= 1e9) return f(n / 1e9, 'B');
    if (Math.abs(n) >= 1e6) return f(n / 1e6, 'M');
    if (Math.abs(n) >= 1e3) return f(n / 1e3, 'k');
    return String(Math.round(n));
}

// A log2 axis is a log axis whose gridlines fall on powers of two. Pixel placement is inherited
// from Chart.js's logarithmic scale untouched - log2 and log10 differ by a constant factor, so
// the geometry is identical - and only the tick generator changes. Registered on first use, so a
// page that never leaves linear never touches the registry.
let _log2ScaleRegistered = false;
function registerLog2Scale() {
    if (_log2ScaleRegistered || typeof Chart === 'undefined' || !Chart.LogarithmicScale) return;
    class Log2Scale extends Chart.LogarithmicScale {
        buildTicks() {
            const lo = Math.max(1, this.min || 1);
            const hi = Math.max(lo * 2, this.max || lo * 2);
            const p0 = Math.floor(Math.log2(lo)), p1 = Math.ceil(Math.log2(hi));
            const ticks = [];
            for (let p = p0; p <= p1; p++) ticks.push({ value: Math.pow(2, p) });
            this.min = Math.pow(2, p0);
            this.max = Math.pow(2, p1);
            return ticks;
        }
    }
    Log2Scale.id = 'log2';
    Log2Scale.defaults = Chart.LogarithmicScale.defaults;
    Chart.register(Log2Scale);
    _log2ScaleRegistered = true;
}

// #8 - which view the lower (Income & Expenses) chart shows.
let incomeChartView = 'combined';

// DOM half of the view switch, split out so replay can flip the view without rendering the stale
// pre-replay log (its runSimulation() paints once, in the right view, right after).
function syncIncomeViewControls() {
    const v = incomeChartView;
    ['combined', 'tax', 'net', 'flows', 'assetflows', 'market'].forEach(k => {
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
}

function setIncomeChartView(v) {
    incomeChartView = v;
    syncIncomeViewControls();
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
    } else if (incomeChartView === 'market') {
        // The rates the projection was handed, in percent - NO adj(): these are not dollars, so
        // the Current $ toggle must not touch them. On a deterministic run both series are flat,
        // which is itself informative next to a replayed path's jagged sequence.
        const pctRet = log.map(r => (r['return%'] ?? 0) * 100);
        // P82g. What the market did after inflation, which is the number that decides whether the
        // portfolio actually grew. Compounded, not subtracted: (1+r)/(1+i) - 1. At 8% against 3%
        // that is 4.85%, not 5%, and the gap widens exactly where it matters, on the high-inflation
        // paths. Drawn as a line on the same percent axis as the bars it is derived from.
        const pctReal = log.map(r => realReturnOf(r['return%'], r['infl%']) * 100);
        const MARKET_UP = '#27ae60B0', MARKET_DOWN = '#c0392bC0';
        incomeChart = new Chart(ctxI, {
            type: 'bar',
            data: { labels, datasets: [
                { label: 'Market return', type: 'bar', order: 3,
                  backgroundColor: pctRet.map(v => v >= 0 ? MARKET_UP : MARKET_DOWN),
                  data: pctRet },
                { label: 'Return after inflation', data: pctReal, type: 'line', order: 1,
                  borderColor: '#1565C0', backgroundColor: '#1565C0',
                  pointBackgroundColor: '#1565C0', fill: false,
                  pointRadius: 0, borderWidth: 2, borderDash: [6, 3] },
                { ...mkLine('Inflation', '#e67e22', r => (r['infl%'] ?? 0) * 100),
                  type: 'line', order: 2, pointRadius: 0, borderWidth: 2.5 },
                // Cumulative inflation as a dollar figure rather than a percent: what day-one
                // $10,000 still buys, on its own right-hand scale. A percent line climbing to 200%
                // would crush the +-15% axis the other two series live on.
                { ...mkLine('What $10,000 buys', '#8e44ad', r => 10000 / (r.inflationFactor || 1)),
                  type: 'line', order: 0, pointRadius: 0, borderWidth: 2, borderDash: [4, 3],
                  yAxisID: 'y1' },
            ]},
            options: { ...sharedTooltip,
                scales: {
                    y:  { position: 'left', ticks: { callback: v => v + '%' } },
                    y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false },
                          title: { display: true, text: 'Buying power ($)' }, ticks: dollarTicks },
                },
                plugins: { ...sharedTooltip.plugins,
                    tooltip: { ...sharedTooltip.plugins.tooltip,
                        callbacks: { ...sharedTooltip.plugins.tooltip.callbacks,
                            // P80. Only this chart names the historical year: it is the one that
                            // shows the sampled rates themselves, so it is where the year explains
                            // the number rather than decorating it.
                            title: items => marketTooltipTitle(
                                sharedTooltip.plugins.tooltip.callbacks.title(items),
                                replaySourceYear(items[0]?.dataIndex)),
                            // The shared callback rounds to whole dollars; the two rate series are
                            // small percents ("Inflation: 3" is useless), so one decimal and a %
                            // sign - except the buying-power line, which really is dollars.
                            label: ctx => ctx.dataset.yAxisID === 'y1'
                                ? `${ctx.dataset.label}: $${Math.round(ctx.parsed.y).toLocaleString()}`
                                : `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` } },
                    // Plain legend: the hover-dim helper cannot dim the bars' per-point color
                    // ARRAY, so with four series the default toggle-hide legend is the honest one.
                    //
                    // P82g. The bars carry a per-point color array - green in a year the market
                    // rose, red in a year it fell - and Chart.js builds the legend swatch from
                    // backgroundColor[0]. So the swatch showed whatever the FIRST year happened to
                    // be: a red key beside a chart of mostly green bars, for one quantity. The
                    // swatch is pinned to the up color and the label names the convention instead.
                    legend: { labels: { ...legendLabels, generateLabels: (chart) => {
                        const items = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                        const bar = items.find(i => i.text === 'Market return');
                        if (bar) {
                            bar.text = 'Market return (red = a losing year)';
                            bar.fillStyle = MARKET_UP;
                            bar.strokeStyle = MARKET_UP;
                        }
                        return items;
                    } } } } }
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

    // 11.1703: the balances chart's vertical scale. On a log axis a zero has nowhere to be drawn,
    // so a zero balance becomes a gap in that line rather than a point pinned to some floor that
    // would read as a real balance. `pt` applies that; linear mode passes values through.
    const logY = assetChartScale !== 'linear';
    const pt = v => (logY && !(v > 0)) ? null : v;
    const mkLine = (label, color, dataFn) => ({
        label, data: log.map(r => pt(dataFn(r))),
        borderColor: color, backgroundColor: color,
        pointBackgroundColor: color, fill: false
    });
    if (logY) registerLog2Scale();
    const assetScales = !logY ? {} : { scales: { y: {
        type: assetChartScale === 'log2' ? 'log2' : 'logarithmic',
        ticks: { callback: v => '$' + fmtAxisDollars(v) },
    } } };

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
                mkLine('TotalWealth', '#555555', r => r.totalWealth * adj(r)),
                // P69 replay overlay: the same plan run on steady assumptions, one dashed total.
                // Deflated by ITS OWN inflationFactor (fixed-inflation compounding) - deflating by
                // the path's factors would smuggle the path back into the "expected" line. It
                // cannot use mkLine/adj, which both close over the replayed log. Appended last so
                // it draws behind the five solid lines; person views keep it as-is because the
                // solid TotalWealth line is person-agnostic too.
                ...(_replayState?.baselineLog ? [{
                    label: 'Plan (steady assumptions)',
                    data: _replayState.baselineLog.map(r =>
                        pt(r.totalWealth * (inCurrentDollars ? 1 / (r.inflationFactor || 1) : 1))),
                    borderColor: '#888888', backgroundColor: '#888888',
                    pointBackgroundColor: '#888888',
                    fill: false, borderDash: [6, 4], pointRadius: 0, borderWidth: 2, spanGaps: true,
                }] : []),
            ]
        },
        options: {
            ...sharedTooltip,
            ...assetScales,
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
    // P90. `_rawInc` is the UNSCALED series, already dollar-adjusted, so the tooltip can report the
    // income that actually arrived rather than the scaled bar height. The bar heights are a
    // presentation device - every source is shrunk by ONE year-wide rate so the stack lands exactly
    // on the Net Income line - and a reader hovering over Social Security wants to know what Social
    // Security paid, not what it looks like after that device.
    //
    // `taxed` says whether the source bears any tax at all, and it is why the difference is not
    // labelled "tax" everywhere. The scale is uniform, so it shaves Cash withdrawals, Roth
    // withdrawals and return of basis by the same fraction as an IRA draw - and none of those three
    // is taxable. Printing "- $2,800 tax" beside a Roth withdrawal would invent a charge that does
    // not exist. Those sources report their raw amount and stop there; the title line already flags
    // them as untaxed.
    const mkInc = (label, color, rawFn, taxed) => ({
        label, type: 'bar', backgroundColor: color, stack: 'income', order: 2,
        _rawInc: log.map(r => rawFn(r) * adj(r)),
        _taxed: !!taxed,
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
                // Income sources - all scaled by (1 - effectiveTaxRate) so they sum to (visibleSum -
                // totalTax). The last argument is whether the source bears tax: Roth withdrawals,
                // Cash withdrawals and return of basis do not, so the tooltip must not attribute
                // any of the year's tax to them (P90).
                mkInc('SS',              '#3498dbB0', r => r.SSincome,                    true),
                mkInc('Pension',         '#7f8c8dB0', r => r.pension,                     true),
                mkInc('IRA RMD',         '#e67e22B0', r => r.RMDwd,                       true),
                mkInc('Interest',        '#f1c40fB0', r => r.cashInterest,                true),
                mkInc('IRA WD',          '#d35400B0', r => r['-iraSpend'] ?? 0,           true),
                mkInc('Roth WD',         '#8e44adB0', r => r.RothWD,                      false),
                mkInc('Gains+Div',       '#1abc9cB0', r => r.CapGains + r.cashDividends,  true),
                mkInc('Cash WD',         '#27ae60B0', r => r.CashWD ?? 0,                 false),
                mkInc('Brokerage',       '#4F4FDC',   r => basisReturn(r),                false),
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
                        // P90. The shared callback prints the plotted value, which on this chart is
                        // the SCALED bar height - so hovering over a $45,000 pension read about
                        // $38,700 and there was nothing on screen saying why. Income sources now
                        // report the amount that actually arrived, with the tax attributed to them
                        // beside it where they bear any. Expense bars are absolute already and fall
                        // through to the shared callback untouched.
                        label: ctx => {
                            const d = ctx.dataset;
                            const shown = Math.round(ctx.parsed.y);
                            if (!d._rawInc) return d.label + ': ' + shown.toLocaleString();
                            const rawv = Math.round(d._rawInc[ctx.dataIndex] ?? 0);
                            const shaved = rawv - shown;
                            // The attribution is the year's average rate applied proportionally, not
                            // a per-source calculation - $35,000 of Social Security does not really
                            // owe $12,000, and Social Security is taxed on at most 85% of itself in
                            // any case. The "~" carries that, and it is the only thing that does.
                            //
                            // No minus sign before the "~": "- ~3,674" is two operators in a row and
                            // reads as noise. The space and the word "tax" already say it is a
                            // deduction from the figure beside it.
                            return (d._taxed && shaved > 0)
                                ? `${d.label}: ${rawv.toLocaleString()}  ~${shaved.toLocaleString()} tax`
                                : `${d.label}: ${rawv.toLocaleString()}`;
                        },
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

// P84. One field, two meanings. Returns { amount, mode, explicit } from whatever was typed.
//
// An explicit marker always wins over the magnitude: "0.9%" is a percent even though a bare 0.9
// would be too, and "$15" is fifteen dollars a year even though a bare 15 would read as 15%.
// Everything else falls to the engine's own threshold, so the rule lives in ONE place.
function parseAdvisorFeeAmount(raw) {
    const txt = (raw ?? '').toString().trim();
    if (!txt) return { amount: 0, mode: 'pct', explicit: false };
    const hasPct = /%\s*$/.test(txt);
    const hasDollar = /^\s*\$/.test(txt);
    const body = txt.replace(/^\s*\$/, '').replace(/%\s*$/, '').replace(/,/g, '').trim();
    // parseShorthand carries the k/m suffixes every other dollar field on this page accepts.
    const n = DisplayHelpers.parseShorthand(body);
    const amount = (n == null || Number.isNaN(n)) ? (Number.isFinite(+body) ? +body : 0) : n;
    const explicit = hasPct ? 'pct' : hasDollar ? 'flat' : null;
    return {
        amount: Math.max(0, amount),
        mode: OptimizerCore.inferAdvisorFeeMode(amount, explicit),
        explicit: !!explicit,
    };
}

// Says out loud which way the number was read, directly under the field. A single field carrying
// two meanings is only honest if it tells you which one it picked.
function updateAdvisorFeeHint() {
    const el = document.getElementById('advisorFeeRead');
    if (!el) return;
    const p = parseAdvisorFeeAmount(document.getElementById('advisorFeeAmount')?.value);
    const scope = document.getElementById('advisorFeeScope')?.value || 'none';
    if (!(p.amount > 0)) { el.textContent = 'No fee.'; return; }
    const reading = p.mode === 'pct'
        ? `${(+p.amount.toFixed(4))}% per year`
        : `$${Math.round(p.amount).toLocaleString()} per year`;
    el.textContent = scope === 'none'
        ? `${reading}, but not applied - "Fee applies to" is None.`
        : `${reading}.`;
}


function showTab(id) {
    // P69: replay is confined to Charts and Annual Details. Any other destination ends it - the
    // Optimizer and the Monte Carlo tab run their own sweeps from the sidebar, and a lingering
    // replay banner over them would claim a relationship that does not exist. The re-run matters:
    // without it, coming back to Charts showed the replayed lines with no banner over them.
    if (_replayState && id !== 'tab-chart' && id !== 'tab-tbl') {
        _clearReplay();
        syncReplayBanner();
        runSimulation();
    }
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
        advisorFeeAmount: 'Advisor Fee', advisorFeeMode: 'Fee Mode', advisorFeeScope: 'Fee Applies To',
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
            // P82f. While a replay is on screen an edit re-runs the PATH and nothing else. The
            // Optimizer and Monte Carlo both sweep from the sidebar, so refreshing them here would
            // spend seconds recomputing a comparison the reader is not looking at, and the Monte
            // Carlo refresh would age out the very run the replay came from.
            if (_replayState) return;
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
    // P102b3. The goal-first "Roth conversions" selector is a second convenience control over the
    // same flags, so it is kept honest here for exactly the reasons the comment above lists: an
    // optimizer row, a share URL, a scenario or an MC variation can all switch conversions on
    // without firing onchange, and a panel still reading "Never convert" would be a lie.
    //
    // ONE DIRECTION ONLY. "never" is CLEARED when conversions appear, and is never SET
    // automatically. All flags off is also the shipped default of a plan whose Optimizer is still
    // searching for a conversion, so inferring "never" from it would answer a question the user
    // was never asked, and would switch Optimize Conversions off behind their back.
    const gfMode = document.getElementById('gf-conv-mode');
    if (gfMode && gfMode.value === 'never'
        && (cxr || fcc || (+val('extraConversionAmount') || 0) > 0)) {
        gfMode.value = 'auto';
        _gfConvSaved = null;
        const note = document.getElementById('gf-conv-note');
        if (note) note.style.display = 'none';
    }
}

// -- P102b: goal-first mode --------------------------------------------------------------------
// An ALTERNATIVE surface over the classic sidebar, not a replacement for it. Every control here
// DRIVES the shipped controls rather than reaching the engine: nothing below is read by
// getInputs(), added to a share URL, or written into a saved scenario. Two consequences are the
// whole design:
//
//   1. The fallback is free. Turn the nerdknob off and the sidebar is already holding exactly the
//      plan this panel built, populated and editable - not a blank form, and not a rollback.
//   2. "What did it decide?" is answered by looking down the page. The panel cannot hold a value
//      the classic controls disagree with, because it has no values of its own.

// The conversion controls as they stood when "Never convert" was selected, so choosing it is not a
// way to lose settings that took work to arrive at. Null whenever the mode is 'auto'.
let _gfConvSaved = null;

// The one gate for every goal-first surface. URL says 'goal' AND the knob is on.
function goalFirstOn() { return GOAL_FIRST && NERD_KNOBS; }

// P102b3. "Roth conversions": one GOAL question standing in front of five POLICY switches. It
// writes them, then leans on onConvSubFlagChange() to keep the Maximize Conversions checkbox
// honest, the same way every other programmatic writer of those flags does.
//
// includeConvOpt lives on the Optimizer tab rather than in the sidebar, and switching it off is
// the only part of "never" that removes WORK: it skips the conversion-optimization pass entirely.
function onGoalConvModeChange() {
    const mode = document.getElementById('gf-conv-mode')?.value || 'auto';
    const cxr = document.getElementById('convertExcessToRoth');
    const fcc = document.getElementById('fundConversionWithCash');
    const ico = document.getElementById('includeConvOpt');
    const note = document.getElementById('gf-conv-note');
    if (mode === 'never') {
        if (_gfConvSaved === null) {
            _gfConvSaved = {
                cxr: !!cxr?.checked,
                fcc: !!fcc?.checked,
                eca: +val('extraConversionAmount') || 0,
                ico: !!ico?.checked,
            };
        }
        if (cxr) cxr.checked = false;
        if (fcc) fcc.checked = false;
        if (ico) ico.checked = false;
        DisplayHelpers.setDollarValue('extraConversionAmount', 0);
    } else if (_gfConvSaved !== null) {
        if (cxr) cxr.checked = _gfConvSaved.cxr;
        if (fcc) fcc.checked = _gfConvSaved.fcc;
        if (ico) ico.checked = _gfConvSaved.ico;
        DisplayHelpers.setDollarValue('extraConversionAmount', _gfConvSaved.eca);
        _gfConvSaved = null;
    }
    onConvSubFlagChange();
    if (note) note.style.display = (mode === 'never') ? '' : 'none';
    // A stop year is a question about conversions, so it stops being a live question when there
    // are none. This is the "it seems wrong when Never convert is selected" case.
    refreshConvEndEnabled();
}

// Re-entrancy guard. applyConvStopYear() re-runs the simulation, which re-enters updateStats(),
// which calls the sync below again.
let _gfStopApplying = false;

// P102b2 v2. The user's own stop year, held while the mode is 'auto' so switching back to a manual
// scope returns what they typed rather than the tool's answer. Null whenever the mode is not 'auto'.
let _autoStopSaved = null;

function convEndAutoNote(text) {
    const el = document.getElementById('convEndAuto-note');
    if (!el) return;
    el.textContent = text || '';
    el.style.display = text ? '' : 'none';
}

// True when the stop year is the tool's to work out rather than the user's.
function convEndIsAuto() {
    return val('convEndMode') === 'auto';
}

// The Stop-conversions row as a whole is meaningless when the plan converts nothing, and a live
// control that cannot do anything is worse than a disabled one that says so. Disabling rather than
// hiding, the way the Ordered strategy greys out Roth-before-Brokerage.
function refreshConvEndEnabled() {
    const never = document.getElementById('gf-conv-mode')?.value === 'never';
    const yearEl = document.getElementById('convEndYear');
    const modeEl = document.getElementById('convEndMode');
    const wrap = document.getElementById('convEndYear-wrap');
    if (yearEl) yearEl.disabled = never;
    if (modeEl) modeEl.disabled = never;
    if (wrap) wrap.style.opacity = never ? '0.5' : '';
    // The box is the tool's readout while the mode is 'auto', so it is not typed into. readOnly,
    // not disabled: a disabled field is skipped by getInputs()' own reads in some browsers and the
    // year still has to reach the engine.
    if (yearEl) yearEl.readOnly = !never && convEndIsAuto();
    if (never) convEndAutoNote('');
}

// P102b2 v2. 'when they stop paying' is nerdknob-gated the way the ACA entries in the Limit menu
// are: gated while it is being lived with, and its absence leaves 'all conversions' in force, which
// is today's behavior rather than a fallback. Removing the option while it is SELECTED would leave
// a select with no matching entry, so the mode is put back first.
function refreshConvEndModeOptions() {
    const sel = document.getElementById('convEndMode');
    if (!sel) return;
    const has = [...sel.options].some(o => o.value === 'auto');
    if (goalFirstOn() && !has) {
        const o = document.createElement('option');
        o.value = 'auto';
        o.textContent = 'when they stop paying';
        sel.appendChild(o);
    } else if (!goalFirstOn() && has) {
        if (sel.value === 'auto') { sel.value = 'all'; onConvEndModeChange(); }
        [...sel.options].filter(o => o.value === 'auto').forEach(o => o.remove());
    }
}

function onConvEndModeChange() {
    const yearEl = document.getElementById('convEndYear');
    if (convEndIsAuto()) {
        if (_autoStopSaved === null) _autoStopSaved = yearEl ? yearEl.value : '';
        convEndAutoNote('Looking for the best stop year...');
    } else if (_autoStopSaved !== null) {
        if (yearEl) yearEl.value = _autoStopSaved;
        _autoStopSaved = null;
        convEndAutoNote('');
    }
    refreshConvEndEnabled();
}

// P102b2. "Stop conversions when they stop paying" adopts the answer the Break Even icon already
// computes on this very path, through applyConvStopYear() - the same function its "Stop after
// YYYY" link calls. Sharing the object rather than re-deriving it is what makes the toggle and the
// diagnostic agree by construction instead of by test.
//
// Called from the end of updateStats(), where _beStopSuggestion has just been refreshed.
//
// The apply is DEFERRED out of this call stack. applyConvStopYear() runs a fresh simulation
// synchronously, so applying inline would let the inner updateStats() paint the new numbers and
// then let the outer one paint its own stale totals straight back over them.
//
// Convergence: bestConversionStopYear() strips any stop year the plan already carries before it
// searches, so re-running against the applied year returns that same year, the value guard below
// matches, and nothing further is scheduled.
function syncAutoStopYear() {
    if (!convEndIsAuto() || _gfStopApplying) return;
    const yearEl = document.getElementById('convEndYear');
    if (!yearEl) return;
    const sugg = _beStopSuggestion;
    if (!sugg || sugg.year == null) {
        const converts = lastSimulationLog?.some(r => (r.rothConv ?? 0) > 1) ?? false;
        convEndAutoNote(!converts
            ? 'This plan converts nothing, so there is nothing to stop.'
            : (_beDiagnosisMsg
                ? 'Converting nothing may beat this plan. See the Break Even note above.'
                : 'Converting all the way through was best here, so no stop year was set.'));
        return;
    }
    if (yearEl.value.trim() === String(sugg.year)) {
        convEndAutoNote('Stopping after ' + sugg.year + ' kept the most after-tax wealth.');
        return;
    }
    _gfStopApplying = true;
    setTimeout(() => {
        try { applyConvStopYear(sugg.year, sugg.mode); }
        finally { _gfStopApplying = false; }
        // applyConvStopYear() writes the SCOPE as well as the year, and the scope it carries is
        // 'all' - so adopting through it deselects the very position that asked for it, and the
        // menu snapped back to "all conversions" the moment it found an answer. Re-assert it.
        // Sharing that function is deliberate and worth this line: it is what makes this position
        // and the Break Even icon agree by construction rather than by test. The engine never saw
        // the difference, because getInputs() maps anything that is not 'extra' to 'all'.
        const _m = document.getElementById('convEndMode');
        if (_m && [...(_m.options)].some(o => o.value === 'auto')) _m.value = 'auto';
        refreshConvEndEnabled();
        convEndAutoNote('Stopping after ' + sugg.year + ' kept the most after-tax wealth.');
    }, 0);
}

// Knob off means the panel stops DRIVING. It does NOT mean the plan changes under the reader.
//
// The classic controls keep exactly what the panel last wrote them, and that is the whole point:
// the sidebar is the fallback because it is already holding the plan, populated and editable, not
// because anything is rolled back. Handing the borrowed values back instead would silently move a
// plan at the very moment its UI disappeared - the worse of the two failures, and the one a reader
// would have no way to notice.
//
// The panel's own memory IS dropped. A later re-enable starts from whatever the controls now say,
// which is the truth about the plan; a remembered "before" from a previous session of the panel
// would be a second, stale source of it.
function goalFirstReset() {
    const modeEl = document.getElementById('gf-conv-mode');
    if (modeEl) modeEl.value = 'auto';
    _gfConvSaved = null;
    const note = document.getElementById('gf-conv-note');
    if (note) note.style.display = 'none';
    // The stop year itself is NOT reverted, for the same reason the conversion switches are not:
    // it is in the classic field, visible and editable, and taking it away would move the plan at
    // the moment its UI disappeared. Only the AUTO position goes, because its option does - and
    // dropping it is numerically a no-op, since getInputs() already maps it to 'all'.
    _autoStopSaved = null;
    refreshConvEndModeOptions();
    refreshConvEndEnabled();
    convEndAutoNote('');
}

function toggleSpouseUI() {
    const on = !!valChecked('hasSpouse');
    document.querySelectorAll('.spouse-field').forEach(el => el.classList.toggle('spouse-disabled', !on));
    if (typeof refreshStratRateOptions === 'function') refreshStratRateOptions();
}

// Display name per engine strategy key, for the ⏱ run breakdown. 'bracket' is deliberately
// absent: it serves both Fill Bracket and IRMAA Ceil, which the enumeration distinguishes by its
// own family name, so those callers pass theirs instead of falling back here.
const OPT_FAMILY_OF_STRATEGY = {
    propwd: 'Proportional', fixed: 'Reduce', fixedpct: 'IRA Draw',
    aca: 'ACA Cliff', ordered: 'Ordered', gk: 'Guyton-Klinger',
};

// P88e. An Extra Annual Roth Conversion and a ceiling strategy pull against each other, and until
// P88b the tool could not say so: the conversion never reached MAGI, so the overage column showed
// nothing and IRMAA charged nothing. Both are now real, which is what makes this warning worth
// showing rather than alarming.
//
// WARN, DO NOT BLOCK. Converting past a ceiling on purpose is a legitimate plan - the ceiling paces
// ORDINARY withdrawals, and a conversion moves money inside the household rather than out of it.
// What the user must not do is believe the ceiling still holds.
//
// The strategies this applies to are the ones that carry a ceiling: Fill Bracket (federal rate or
// IRMAA tier) and the ACA cap. Proportional, Ordered, IRA Draw % and Reduce are
// bracket-agnostic and have no ceiling to breach, so they say nothing.
// P92c. This read `val('stratIRMAATier')` and `val('stratACAMultiple')`, and NEITHER IS A FORM
// FIELD: both are derived in getInputs() from the one Limit dropdown, whose value carries them as
// "IRMAA2" or "aca400". So both lookups returned undefined, `+undefined` is NaN, and every
// comparison against it is false - the function fell through to "the federal bracket ceiling" for
// every plan in the family, IRMAA tiers and ACA caps included. It named the wrong ceiling from the
// day it shipped, in the one sentence whose whole job is to name the right one. Asking getInputs(),
// which is where those two values actually exist, is the fix; `strategy` is derived there too, and
// is the only place 'aca' is ever the answer (the dropdown itself only ever says 'bracket').
function extraConvCeilingKind() {
    const i = getInputs();
    if (i.strategy === 'aca') return 'the ACA FPL cap';
    if (i.strategy !== 'bracket') return null;
    if ((i.stratIRMAATier ?? -1) >= 0) return 'the IRMAA tier ceiling';
    return 'the federal bracket ceiling';
}

function updateExtraConvWarning() {
    const box = document.getElementById('extraConv-warn');
    if (!box) return;
    const amt  = +(document.getElementById('extraConversionAmount')?.dataset.numVal
                   ?? val('extraConversionAmount')) || 0;
    const kind = extraConvCeilingKind();
    if (amt <= 0 || !kind) { box.style.display = 'none'; box.innerHTML = ''; return; }

    // Measured, when there is a run to measure. `-overageFromConv` is the part of BracketOverage
    // this conversion caused, so the count is years the ceiling was actually broken BY THE
    // CONVERSION rather than by spending the ceiling could not fund.
    let measured = '';
    if (Array.isArray(lastSimulationLog) && lastSimulationLog.length) {
        const yrs = lastSimulationLog.filter(r => (r['-overageFromConv'] ?? 0) > 1);
        if (yrs.length) {
            const worst = Math.max(...yrs.map(r => r['-overageFromConv']));
            const irmaaYrs = lastSimulationLog.filter(r => (r.IRMAA ?? 0) > 0).length;
            measured = ` In this plan it puts you over in <b>${yrs.length}</b> year${yrs.length === 1 ? '' : 's'}`
                     + `, by up to <b>${DisplayHelpers.formatDollar(worst)}</b>`
                     + (irmaaYrs ? `, and ${irmaaYrs} year${irmaaYrs === 1 ? '' : 's'} carry an IRMAA surcharge.` : '.');
        }
    }
    box.innerHTML = `<b>This conversion is added on top of ${kind}, not fitted inside it.</b> `
        + `Your strategy fills income up to the ceiling, then this amount goes over it.${measured} `
        + `That can be exactly what you want - a ceiling paces ordinary withdrawals, while a `
        + `conversion moves money from IRA to Roth rather than out of the household - but the `
        + `ceiling will not hold while it is set. See ${annualLink('BracketOverage','IRMAA')} in Annual Details.`;
    box.style.display = '';
}

// P92c. A limit the user picked is a contract, and this is the plan saying when it could not keep
// it. The engine already falls back to funding the Spend Goal - the third pass forces an IRA draw
// past a bracket or IRMAA ceiling rather than leaving spending unpaid - but it did that silently,
// and only the BracketOverage column recorded it. A reader looking at the headline numbers had no
// way to know the limit on screen was not the limit the plan ran under.
//
// NO THRESHOLD. The Optimizer's `_isBracketInfeasible` calls a row infeasible past 50% of years,
// which is a reasonable way to rank a table and a bad way to talk to one reader: on the P87a grid a
// single breached year is common (24 of 40 IRMAA Tier 1 cells breach in 1 to 50% of years) while a
// wholly unfundable limit is also common (all 40 Fill Bracket 12% cells breach, 36 of them past
// half). Both are worth saying and they are not the same statement, so the COUNT is the message and
// only the opening sentence changes with it.
//
// The forced half only. `-overageFromConv` (P88c) carries overage an Extra Annual Roth Conversion
// caused, which is the user choosing to go over rather than the plan being unable to stay under;
// that half is what updateExtraConvWarning() covers.
// P97. The message this builds, split out from the DOM so it can be tested on rows rather than on a
// page. Pure: rows in, HTML out, '' when there is nothing to say.
//
// TWO CAUSES, AND THEY TAKE OPPOSITE ADVICE. The first version of this warning said "Lower the Spend
// Goal" whenever a year went over, and on a plan whose IRA is large enough that is simply wrong: a
// $4M IRA left to a survivor throws off an RMD of $455,636 against an IRMAA Tier 1 ceiling of
// $370,371, and the plan withdraws NOTHING beyond that RMD in the years it is flagged. Required
// distributions, Social Security and a pension are income the household must take; no Spend Goal
// reaches them. Telling that user to spend less is advice that cannot work, on the one screen whose
// job is to explain the number above it.
//
// The test is exact rather than estimated: `IRAwd` is the voluntary draw plus conversion gross
// (optimizer_core.js, buildSimYearLogRecord) and `ForcedIRA` is the third pass's draw, so a year
// with neither is a year in which the plan chose nothing that could have put it over. Estimating
// instead - subtracting the draws from MAGI - would be wrong in the unsafe direction, because IRA
// income also raises the taxable share of Social Security, so removing it would take more out of
// MAGI than the draw itself.
function limitWarningText(rows, kind, totalYears) {
    const isACA = kind === 'the ACA FPL cap';
    const forced = r => (r.BracketOverage ?? 0) - (r['-overageFromConv'] ?? 0);
    const yrs = isACA ? rows.filter(r => r['acaBreach']) : rows.filter(r => forced(r) > 1);
    if (!yrs.length) return '';

    const chose = r => (r.IRAwd ?? 0) + (r.ForcedIRA ?? 0);
    const structural = yrs.filter(r => chose(r) <= 1);      // nothing the plan chose put it over
    const spendDriven = yrs.filter(r => chose(r) > 1);

    const m = totalYears;
    const yearWord = m === 1 ? 'year' : 'years';
    const money = v => DisplayHelpers.formatDollar(v);
    const worstOf = set => Math.max(...set.map(forced));
    const ceiling = isACA ? 'the cap' : kind;

    // The structural half first when it is the bigger one, because it is the half whose advice the
    // reader would otherwise get backwards.
    if (structural.length && structural.length >= spendDriven.length) {
        const worstRow = structural.reduce((a, b) => (forced(a) > forced(b) ? a : b));
        const rmd = worstRow.RMDwd ?? 0;
        let out = `<b>Income you cannot defer already exceeds ${ceiling} in `
            + `${structural.length} of ${m} ${yearWord}.</b> `
            + `In ${structural.length === 1 ? 'that year' : 'those years'} the plan withdraws nothing `
            + `beyond what it is required to, and still goes over by up to `
            + `<b>${money(worstOf(structural))}</b>`;
        if (rmd > 1) {
            out += `, on a required distribution of ${money(rmd)}`;
        }
        out += `. <b>Lowering the Spend Goal cannot change this</b> - required distributions, Social `
            + `Security and any pension are income the plan has to take. Converting more before `
            + `required distributions begin, a QCD, or a higher limit are what move it.`;
        if (spendDriven.length) {
            out += ` Separately, spending pushes the plan over in ${spendDriven.length} other `
                + `${spendDriven.length === 1 ? 'year' : 'years'}, by up to ${money(worstOf(spendDriven))}.`;
        }
        return out + ` See ${annualLink('RMDwd','BracketOverage')} in Annual Details.`;
    }

    const n = spendDriven.length, worst = worstOf(spendDriven);
    const most = n / m > 0.5;
    let out;
    if (isACA) {
        out = `<b>Your spending does not fit under ${kind} in ${n} of ${m} ${yearWord}.</b> `
            + `The plan pays for the spending anyway, so income goes over the cap in `
            + `${n === 1 ? 'that year' : 'those years'} and the premium subsidy is lost in `
            + `${n === 1 ? 'it' : 'them'}. Lower the Spend Goal, or raise the multiple, to keep the cap.`;
    } else {
        out = (most
                ? `<b>${kind.charAt(0).toUpperCase() + kind.slice(1)} you chose cannot fund this plan:</b> `
                  + `your Spend Goal does not fit inside it in ${n} of ${m} ${yearWord}. `
                : `<b>Your Spend Goal does not fit inside ${kind} in ${n} of ${m} ${yearWord}.</b> `)
            + `The plan withdraws past it to pay for spending, by up to <b>${money(worst)}</b>, so `
            + `${n === 1 ? 'that year satisfies' : 'those years satisfy'} your Spend Goal rather than `
            + `the limit. Lower the Spend Goal or pick a higher limit to keep it. `
            + `A conversion you chose to make going over is counted separately, not here.`;
    }
    if (structural.length) {
        out += ` In ${structural.length} further ${structural.length === 1 ? 'year' : 'years'} the `
             + `plan is over on required income alone, which no Spend Goal reaches.`;
    }
    return out + ` See ${isACA ? annualLink('acaBreach','BracketOverage') : annualLink('BracketOverage')} in Annual Details.`;
}

function updateLimitFeasibilityWarning() {
    const box = document.getElementById('limit-warn');
    if (!box) return;
    const kind = extraConvCeilingKind();   // null for every strategy with no ceiling at all
    const log  = Array.isArray(lastSimulationLog) ? lastSimulationLog : null;
    if (!kind || !log || !log.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const html = limitWarningText(log, kind, log.length);
    if (!html) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.innerHTML = html;
    box.style.display = '';
}

// A saved plan or a shared link can name a strategy this version does not have - `minlimit`, which
// was removed, or a typo in a hand-edited URL. A <select> handed a value matching no option lands on
// selectedIndex -1, so getInputs().strategy reads "" and the plan computes $0 with nothing on screen
// to say why. Fall back to the first option, which is the default strategy, and restore that
// option's own parameter fields from the defaults captured before any load - so what comes up is a
// working plan rather than a blank one.
//
// The check is generic rather than a list of retired names: any value the dropdown does not carry
// gets the same treatment, and there is no list to keep in step with the markup. Silent, on
// instruction. It must run AFTER the deliberate strategy='aca' -> 'bracket' mapping, which is a
// value the dropdown legitimately does not have; running before would swallow that case.
function resetUnknownStrategy() {
    const el = document.getElementById('strategy');
    if (!el || el.options.length === 0 || el.selectedIndex !== -1) return;
    el.value = el.options[0].value;
    // Each strategy's parameters live in its own #ui-<value> group, so the group names itself from
    // the option value and no mapping table is needed here either.
    document.querySelectorAll(`#ui-${el.value} input, #ui-${el.value} select`).forEach(f => {
        // OPT_DEFAULTS is the pristine snapshot captureDefaults() takes at load. It is the right
        // source when it exists, and it is not always there: the self-check suite runs BEFORE
        // captureDefaults(). Fall back to the markup's own default rather than leaving whatever the
        // unusable strategy carried, which is the one outcome this function exists to prevent.
        const def = OPT_DEFAULTS[f.id];
        if (f.type === 'checkbox') {
            f.checked = def ? def.c : f.defaultChecked;
        } else if (DOLLAR_INPUT_IDS.has(f.id)) {
            DisplayHelpers.setDollarValue(f.id, def ? (def.n ?? def.v) : f.defaultValue);
        } else if (def) {
            f.value = def.v;
        } else if (f.tagName === 'SELECT') {
            f.value = ([...f.options].find(o => o.defaultSelected) || f.options[0])?.value ?? f.value;
        } else {
            f.value = f.defaultValue;
        }
    });
}

// P104b3. What the four weights actually mean, in words, under the fields. VISIBLE text and not
// a tooltip: a phone cannot hover, and the normalized percentages are the thing the reader
// needs - the numbers they typed are relative and say nothing on their own.
//
// This is also the only consumer of the engine's splitWeightsInvalid flag: an all-zero mix
// cannot be normalized, so the engine falls back to a balance-weighted draw and raises it.
// Reading the FIELDS rather than the last run means the warning appears as the mix is typed,
// and covers a share link or a saved scenario too, since both land in these fields first.
// P104b3. The preset menu, built FROM SPLIT_VECTORS so it cannot drift from the grid the Optimizer
// sweeps. Each option's value is the vector itself, comma-joined; 'custom' is the escape hatch.
function generateSplitPresetOptions() {
    const opts = SPLIT_VECTORS.map(v =>
        `<option value="${v.join(',')}">${splitVectorLabel(v)}</option>`);
    // Last, and named for what it does rather than what it is: a reader picking from a list of four
    // measured mixes needs to know the fifth entry is theirs to fill in.
    opts.push('<option value="custom">Custom mix...</option>');
    return opts.join('');
}

// The four weight fields, in account order. One place, because three functions read them.
const SPLIT_FIELD_IDS = ['splitIRA', 'splitBrok', 'splitCash', 'splitRoth'];
const splitFieldValues = () => SPLIT_FIELD_IDS.map(id => +val(id) || 0);

// Picking a preset WRITES the fields and hides them; picking Custom reveals them and changes
// nothing. The fields remain the only thing getInputs() reads, so nothing downstream has to know
// this menu exists.
function onSplitPresetChange() {
    const sel = document.getElementById('splitPreset');
    const custom = document.getElementById('split-custom-fields');
    if (!sel || !custom) return;
    const isCustom = sel.value === 'custom';
    custom.classList.toggle('hidden', !isCustom);
    if (!isCustom) {
        const v = sel.value.split(',').map(Number);
        SPLIT_FIELD_IDS.forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.value = v[i] ?? 0;
        });
    }
    updateSplitMixNote();
}

// The reverse direction, and the reason the fields are the source of truth: a share link, a saved
// scenario and a row-click all set the FIELDS, and the menu has to follow them. A mix that matches
// a preset selects it (compared normalized, so 0/90/10/0 finds `Brok 90 / Cash 10`); anything else
// selects Custom and shows the fields.
function syncSplitPresetFromFields() {
    const sel = document.getElementById('splitPreset');
    const custom = document.getElementById('split-custom-fields');
    if (!sel || !custom || !sel.options.length) return;
    const mine = splitVectorSortVal(splitFieldValues());
    const hit = SPLIT_VECTORS.find(v => Math.abs(splitVectorSortVal(v) - mine) < 1e-9);
    sel.value = hit ? hit.join(',') : 'custom';
    custom.classList.toggle('hidden', !!hit);
}

// Typing in a field can only happen while Custom is showing, but a field can also be set
// programmatically; re-deriving costs nothing and keeps the menu honest either way.
function onSplitFieldInput() {
    syncSplitPresetFromFields();
    updateSplitMixNote();
}

function updateSplitMixNote() {
    const el = document.getElementById('split-mix-note');
    if (!el) return;
    const w = [+val('splitIRA') || 0, +val('splitBrok') || 0, +val('splitCash') || 0, +val('splitRoth') || 0];
    if (!(w.reduce((a, b) => a + b, 0) > 0)) {
        el.innerHTML = '<span style="color:#b45309;">\u26a0\ufe0f Every weight is zero, so there is no mix to draw on. '
            + 'This plan falls back to drawing in proportion to your account balances.</span>';
        return;
    }
    // The spill order is FIXED at IRA -> Brokerage -> Cash -> Roth for every mix, whatever the
    // weights say (the `order` array in _splitWeightsFor). The old wording said "the other
    // accounts", which is wrong twice: for `IRA 50 / Cash 40 / Roth 10` the first fallback is IRA,
    // an account already in the mix, and for `Brok 90 / Cash 10` it is IRA rather than the
    // brokerage the label leads with. Name the order instead of gesturing at it.
    el.textContent = 'Draws ' + splitVectorLabel(w)
        + '. If a year needs more, the rest comes from IRA, then Brokerage, then Cash, then Roth.';
}

function toggleStrategyUI() {
    let m = val('strategy');
    document.getElementById('ui-fixed').classList.toggle('hidden', m !== 'fixed');
    document.getElementById('ui-bracket').classList.toggle('hidden', m !== 'bracket');
    document.getElementById('ui-propwd').classList.toggle('hidden', m !== 'propwd');
    document.getElementById('ui-fixedpct').classList.toggle('hidden', m !== 'fixedpct');
    document.getElementById('ui-ordered').classList.toggle('hidden', m !== 'ordered');
    document.getElementById('ui-gk').classList.toggle('hidden', m !== 'gk' || !NERD_KNOBS);
    // Gated on the knob as well as the selection: a share link can carry str=split to someone who
    // has no menu entry for it, and a panel with no way to have been chosen is worse than hidden.
    document.getElementById('ui-split').classList.toggle('hidden', m !== 'split' || !SPLIT_FEATURE);
    syncSplitPresetFromFields();
    updateSplitMixNote();
    // "Roth before Brokerage" reaches every strategy except Ordered, which runs the sequence the
    // user chose - the same line fillSpendingGap draws, and the one ROTH_GAP_EXCLUDED draws for the
    // 🅡 rows. Greyed rather than hidden, and the switch is NOT cleared: switching to Ordered and
    // back would otherwise silently throw the setting away.
    const rgLabel = document.getElementById('rothGapFill-label');
    if (rgLabel) {
        rgLabel.classList.toggle('knob-na', m === 'ordered');
        document.getElementById('rothGapFill').disabled = (m === 'ordered');
    }
    // document.getElementById('ui-maximize').classList.toggle('hidden', !(m === 'baseline'));
    updateExtraConvWarning();   // P88e: the ceiling it warns about is the one just switched to
    updateLimitFeasibilityWarning();   // P92c: and so is the limit this one reports on
}


// ============================================================================
// URL SHARE / LOAD
// ============================================================================

const OPT_LONG_TO_SHORT = {
    spendGoal:'sg', spendChange:'sc', strategy:'str', nYears:'ny',
    propWithdraw:'pw', stratRate:'sr', iraWithdrawPct:'iwp', orderedSeq:'os', rothGapFill:'rgf',
    convertExcessToRoth:'mc', fundConversionWithCash:'fcc', extraConversionAmount:'eca', iraBaseGoal:'ibg',
    convEndYear:'cey', convEndMode:'cem', irmaaMarginMode:'imm', fixedTaxIndexing:'fti',
    advisorFeeAmount:'af', advisorFeeMode:'afm', advisorFeeScope:'afs',
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
    // P104b3. FOUR keys rather than one packed `sw=0,9,1,0`. buildShareURL and loadFromURL are both
    // driven off the DOM fields themselves, so four plain fields round-trip with no parse step -
    // and a hand-written parse step for a packed value is exactly the shape of the ACA share-link
    // defect (P95), which loads as the wrong strategy entirely.
    splitIRA:'swi', splitBrok:'swb', splitCash:'swc', splitRoth:'swr',
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
    // P84. `afm` is NOT emitted, and pinning it here was over-engineering on my part. buildShareURL
    // emits each field's own TEXT, so an explicit "$15" or "15%" already travels in `af` verbatim
    // and reproduces exactly; a bare "15" means what the inference says, which is what the user
    // typed and saw. A second parameter carrying the same fact could only ever disagree with it.
    // Incoming `afm` is still ACCEPTED by loadFromURL, so links already generated keep working.
    // P64e: these have no DOM field, so the loop above cannot see them. Re-emit them or a shared
    // link silently drops a figure the recipient never had a way to re-enter.
    // P100b1: the "Optimize for" goal is UI state, not an engine input, so the field loop above
    // cannot see it - and without it a shared link silently reopens on Tax Flexibility, showing the
    // recipient a different winner and a different anchor baseline for the same plan. Emitted only
    // when it differs from the default, so existing links are unchanged.
    if (OptimizerState.objective && OptimizerState.objective !== 'taxflex') {
        params.set('obj', OptimizerState.objective);
    }
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
    // P84. `advisorFeeMode` has no element to load into. Rather than carry hidden state, fold it back
    // into the amount's own text as a marker - "$20000" or "1.2%" - which is exactly what a user
    // would have typed to mean the same thing. Everything downstream then reads one field, and a
    // link that says 15 means 15% while one that says afm=flat means fifteen dollars.
    if (params.has('advisorFeeMode') && params.has('advisorFeeAmount')) {
        const m = params.get('advisorFeeMode');
        const a = (params.get('advisorFeeAmount') || '').toString().trim();
        if (a && (m === 'pct' || m === 'flat')) {
            params.set('advisorFeeAmount', m === 'flat' ? '$' + a : a + '%');
        }
        params.delete('advisorFeeMode');
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
    // 'aca' is an internal strict strategy with no dropdown option of its own; applyScenario maps it
    // back to 'bracket' + an ACA stratRate, and a link that carries it has to be read the same way or
    // the unknown-strategy guard below would take it for a name this version does not have.
    const _stratEl = document.getElementById('strategy');
    if (_stratEl && params.get('strategy') === 'aca') _stratEl.value = 'bracket';
    resetUnknownStrategy();
    toggleStrategyUI();
    onConvSubFlagChange();   // .checked set programmatically above → no change event; resync the convenience checkbox
    runSimulation();
}

// The load-time "this scenario sets a Cash Reserve" warning was retired at 11.1702, when 0 became
// the default: it would have fired for everyone. The changelog carries the change instead.


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
            // P100b1: `optObjective` rides along beside the engine inputs. It is NOT added to
            // getInputs() on purpose - that object feeds simulate() and the MC cache hash, and a
            // ranking preference has no business changing either.
            data: { ...inputs, optObjective: OptimizerState.objective },
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

    // P70i. Pension COLA was a checkbox and is now a selector, so a scenario saved before that
    // carries a BOOLEAN. The generic loop below would set a <select> to "true", match no option and
    // leave the control blank - which reads as "No increase" and silently strips a COLA the plan was
    // saved with. Map it here, the way the IRMAA/ACA stratRate values are mapped just below.
    if (typeof data.pensionCola === 'boolean') {
        data = { ...data, pensionCola: data.pensionCola ? 'full' : 'none' };
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

    // P104b3. splitWeights is an ARRAY with no DOM element of its own, so the generic
    // getElementById loop below cannot restore it and would drop it silently on every scenario
    // load. Same shape as the propTax and qcdMode cases either side of this one.
    if (Array.isArray(data.splitWeights) && data.splitWeights.length === 4) {
        ['splitIRA', 'splitBrok', 'splitCash', 'splitRoth'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.value = data.splitWeights[i];
        });
        if (typeof syncSplitPresetFromFields === 'function') syncSplitPresetFromFields();
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

    // P100b1. Same shape as propTax above: the "Optimize for" goal has no engine input to travel
    // in, so it is restored explicitly. An unknown key falls back to the default rather than
    // throwing, and an absent key leaves the current goal alone - a scenario saved before this
    // feature does not carry it.
    if (data.optObjective !== undefined && typeof setOptObjective === 'function') {
        setOptObjective(data.optObjective);
    }

    for (const [key, value] of Object.entries(data)) {
        // optObjective is UI state restored above, and has no form element of its own
        if (key === 'optObjective') continue;
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
                // NOT .toFixed(3), which is what the percent fields above need. This one is a
                // <select>, and its option values are whole percents ("24"). Writing "24.000"
                // matched no option, so the select cleared, and the rebuild in
                // refreshStratRateOptions() then landed on its default "Below IRMAA" - every saved
                // Fill Bracket plan quietly reloaded as a different strategy than it was saved as.
                element.value = String(Math.round(value * 100));
                // And if that rate is one of the reference-only entries (the top bracket), drop to
                // the highest real ceiling rather than sitting on an option the menu disables.
                clampStratRateSelection(element);
            } else {
                if (['convertExcessToRoth', 'fundConversionWithCash', 'dividendReinvest', 'cyclicEnabled', 'fixedTaxIndexing'].includes(key)) {
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

    // A strategy this version does not have loads as the default rather than as a blank $0 plan.
    if (typeof resetUnknownStrategy === 'function') resetUnknownStrategy();

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
    if (typeof updateCpiSpreadDisplay === 'function') updateCpiSpreadDisplay(); // CPI/Inflation spread under the two rate fields
    if (typeof syncMCMuFromGrowth === 'function') syncMCMuFromGrowth();        // MC μ tracks Growth
    if (typeof updateProfileAgeDisplay === 'function') updateProfileAgeDisplay(); // ages / RMD start / projected RMD
    if (typeof refreshStratRateOptions === 'function') refreshStratRateOptions(); // bracket/IRMAA labels (CPI + filing status)
    if (typeof updateBracketFeedback === 'function') updateBracketFeedback();
    if (typeof updateLimitBasisNote === 'function') updateLimitBasisNote();
    // The loaded scenario is the new restore baseline. spendGoal was set programmatically via
    // setDollarValue, which does NOT fire the field's oninput="_priorSpendGoal=null", so a stale
    // pre-load "Restore: $X" (often the original default) would otherwise cling to the ⓘ icon.
    // Clear it: the icon now recalculates a fresh suggestion for the loaded inputs, and once the
    // user applies it, restore targets the goal loaded from the file - not the default.
    _priorSpendGoal = null;
    if (typeof updateSuggestSpendTooltip === 'function') updateSuggestSpendTooltip();
    if (typeof updateIRAGoalHint === 'function') updateIRAGoalHint();
    if (typeof updateCompAdvisory === 'function') updateCompAdvisory();

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
        // No Version column. An incompatible scenario is already unmistakable without one: the row is
        // tinted red, its Load button is disabled and says why, and the warning below counts them.
        // A column of green ticks next to every other row was three states of nothing.
        html += '<th style="text-align: center; padding: 8px; border-bottom: 2px solid #ddd;">Actions</th></tr>';

        for (const [name, scenario] of Object.entries(scenarios)) {
            const savedDate = scenario.savedAt !== 'Unknown'
                ? new Date(scenario.savedAt).toLocaleString()
                : 'Unknown';
            const version = scenario.version || 1;
            const isCurrent = version === SCENARIO_VERSION;
            const isOldStorage = scenario.isOldStorage || false;

            const rowStyle = isCurrent ? '' : 'background-color: #ffeeee;';

            html += `<tr style="${rowStyle}">
                <td style="padding: 4px; border-bottom: 1px solid #eee;">${name}</td>
                <td style="padding: 4px; border-bottom: 1px solid #eee;">${savedDate}</td>
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
//
// P92e. This was hardcoded to 2025 while the tables it indexes say 2026 (`TAXData.FEDERAL.YEAR`,
// `TAXData.IRMAA.YEAR`), so every limit in the Limit dropdown was compounded one extra year of CPI
// over figures that were already current: the menu offered `22% Fed - $217,319` where the engine
// built that same plan's ceiling on $211,400, which is 211,400 x 1.028 to the dollar. Display only,
// but it is the number a reader compares against their own tax table. Reading the year off the data
// is what stops it drifting again the next time the tables are rolled forward.
//
// The two tables must share a year for one factor to be right for both; a test pins that.
const TAX_DATA_BASE_YEAR = TAXData.FEDERAL.YEAR;

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
 * P70. Shows the gap between the two rate inputs, because that gap IS the inflation model and
 * nothing on the page said so.
 *
 * CPI and Inflation are separate fields on purpose: the statutory index (CPI-W for Social Security,
 * chained CPI-U for brackets) runs below felt inflation, and for a retired household the difference
 * is largely medical weighting. Under Monte Carlo the drawn path supplies general inflation and the
 * tax code is indexed at that path LESS this spread, so a reader who never notices the gap cannot
 * account for why their brackets creep in real terms.
 *
 * Names the direction, not just the number - "0.20 pts" alone does not say which way. Handles the
 * sign both ways; entering a CPI above Inflation is legal and someone testing a scenario will do it.
 */
function updateCpiSpreadDisplay() {
    const el = document.getElementById('cpi-spread-info');
    if (!el) return;
    const inflation = parseFloat(document.getElementById('inflation')?.value);
    const cpi       = parseFloat(document.getElementById('cpi')?.value);
    if (isNaN(inflation) || isNaN(cpi)) { el.innerHTML = ''; return; }

    const gap = Math.abs(cpi - inflation).toFixed(2);
    const rel = cpi < inflation ? 'below' : cpi > inflation ? 'above' : null;
    const lead = rel === null
        ? `CPI and Inflation are equal, so the tax code is indexed at the same rate prices rise.`
        : `CPI runs <strong>${gap} pts ${rel}</strong> Inflation.`;
    el.innerHTML = lead
        + ` <span style="color:#888;">Brackets, IRMAA tiers and Social Security follow CPI;`
        + ` spending follows Inflation. Under Monte Carlo the tax code is indexed at each path's own`
        + ` inflation, carrying this same gap.</span>`;
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
    // P92e. The limit comes off the option's `data-limit`, which generateStratRateOptions() writes
    // from the same number it formatted. This used to run a regex over the option's DISPLAY TEXT and
    // take the last dollar amount in it - which broke twice over the moment the label changed: the
    // new compact form is "$211k", whose digits parse as 211, and the label now ends with the OTHER
    // ladder's position, so "the last dollar amount" would have been the wrong one even in full
    // digits. A label is a thing to read; the number it shows travels separately.
    const bracketLimit = Number(selectedOption.dataset.limit);

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
 * Moves the ceiling dropdown off an option it must not sit on, to the nearest CHOOSABLE ceiling
 * below it. Returns true if it moved anything.
 *
 * There are two ways to land on one. A saved plan or a shared URL from before the top bracket was
 * disabled still carries stratRate 0.37, and setting `.value` to a disabled <option>
 * programmatically succeeds - the browser only blocks a person picking it. And an option can be
 * disabled after the fact, which is what updateACAWarning() does to the ACA entries once everyone
 * is on Medicare.
 *
 * Nearest ceiling BELOW, not the first enabled option in the list: those plans were aiming as high
 * as the ladder went, and the entry directly under an unbounded top band is the highest real
 * ceiling there is. Dropping them to the bottom of the list would quietly re-plan them at 10%.
 */
function clampStratRateSelection(sel) {
    if (!sel) return false;
    const opts = [...sel.options];
    const cur  = opts.find(o => o.value === sel.value);
    if (cur && !cur.disabled) return false;
    const idx  = cur ? opts.indexOf(cur) : opts.length;
    // The list is sorted by income limit, so walking back is walking down the ladder.
    for (let i = idx - 1; i >= 0; i--) {
        if (!opts[i].disabled) { sel.value = opts[i].value; return true; }
    }
    const first = opts.find(o => !o.disabled);
    if (first) { sel.value = first.value; return true; }
    return false;
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
    clampStratRateSelection(sel);
    updateBracketFeedback(); // Update feedback after options change
    updateLimitBasisNote();  // P92e: same trigger - it describes the option now selected
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

// ── P92e: the sentence under the Limit dropdown, and the picture behind it ────────────────
// The label says where the selected limit sits on the other ladder in three words. This says it in
// a sentence, and adds the one fact a label has no room for: an IRMAA tier SPANS a bracket
// boundary, so the tier a plan is filling can start in one bracket and end in the next.
function updateLimitBasisNote() {
    const box = document.getElementById('limit-basis');
    const panel = document.getElementById('limit-ladder');
    const sel = document.getElementById('stratRate');
    if (!box || !sel) return;
    const showLadder = panel && panel.style.display !== 'none';
    const opt = sel.options[sel.selectedIndex];
    const bracketUIVisible = !document.getElementById('ui-bracket')?.classList.contains('hidden');
    if (!opt || !bracketUIVisible) {
        box.innerHTML = '';
        if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
        return;
    }

    const status = getDropdownStatus();
    const cpi = (+document.getElementById('cpi')?.value || 2.8) / 100;
    const cpiAdj = Math.pow(1 + cpi, Math.max(0, new Date().getFullYear() - TAX_DATA_BASE_YEAR));
    const limit = Number(opt.dataset.limit);
    const v = opt.value;
    const isIRMAA = /^irmaa/i.test(v);
    const isACA = v.startsWith('aca');
    const money = n => DisplayHelpers.formatDollarShort(n);

    let sentence;
    if (isIRMAA) {
        // The tier's own span is the point. Its floor and its ceiling can sit in two different
        // federal brackets, which is exactly what no label can say.
        const tier = +v.replace(/[^0-9]/g, '');
        const brks = TAXData.IRMAA[status]?.brackets ?? [];
        const floor = tier === 0 ? 0 : Math.round(brks[tier].l * cpiAdj);
        const ded = dropdownDeduction(status);
        const topBracket = fedBracketPctAt(Math.max(0, limit - ded), status, cpiAdj);
        const floorBracket = fedBracketPctAt(Math.max(0, floor - ded), status, cpiAdj);
        sentence = tier === 0
            ? `Filling income up to ${money(limit)} keeps you under every IRMAA tier, and lands in the ${topBracket}% bracket.`
            : (floorBracket === topBracket
                ? `IRMAA Tier ${tier} runs ${money(floor)} to ${money(limit)}, all of it inside the ${topBracket}% bracket.`
                : `IRMAA Tier ${tier} runs ${money(floor)} to ${money(limit)}. It <b>begins</b> in the ${floorBracket}% bracket and <b>ends</b> in the ${topBracket}% one, so filling this tier crosses a bracket on the way.`);
    } else if (isACA) {
        const ded = dropdownDeduction(status);
        sentence = `This cap holds income to ${money(limit)}, which is inside the ${fedBracketPctAt(Math.max(0, limit - ded), status, cpiAdj)}% bracket. It is a cap to stay under, not a target to fill.`;
    } else {
        const ded = dropdownDeduction(status);
        const magi = limit + ded;
        sentence = `The ${opt.value}% bracket tops out at ${money(limit)} of taxable income. After this plan's deduction that is about ${money(magi)} of total income, which reaches ${irmaaBandNameAt(magi, status, cpiAdj)}.`;
    }

    box.innerHTML = sentence
        + ` <span id="limit-ladder-link" onclick="toggleLimitLadder()" style="cursor:pointer;color:#2980b9;white-space:nowrap;">`
        + `${showLadder ? 'Hide ▾' : 'Show me ▸'}</span>`;
    if (showLadder) {
        // A titled header with its own close control. The panel opens AWAY from the link that
        // opened it - it has to, to escape a 245px sidebar - so "click Show me again" is not a
        // discoverable way out of it. Reported as exactly that.
        panel.innerHTML =
            `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">`
          + `<b style="font-size:0.85em;color:#78350f;flex:1;">Where the limits sit</b>`
          + `<span id="limit-ladder-close" onclick="toggleLimitLadder()" `
          + `style="cursor:pointer;color:#78350f;font-size:0.85em;">close ✕</span></div>`
          + buildLimitLadderSVG(status, cpiAdj, limit);
    }
}

// Click anywhere else to dismiss, the way the share panel does (see setupSmallScreenUX's sibling
// handler). Registered once, at load, and cheap: it does nothing at all while the panel is closed.
document.addEventListener('click', e => {
    const panel = document.getElementById('limit-ladder');
    if (!panel || panel.style.display === 'none') return;
    if (panel.contains(e.target)) return;
    if (e.target.closest && e.target.closest('#limit-ladder-link')) return;   // the toggle's own job
    panel.style.display = 'none';
    panel.innerHTML = '';
    if (typeof updateLimitBasisNote === 'function') updateLimitBasisNote();
});

// Escape closes it too, since it overlays the page while open.
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const panel = document.getElementById('limit-ladder');
    if (panel && panel.style.display !== 'none') toggleLimitLadder();
});

// The DRAWING is a picture. The interactions are the toggle, the close control, a click outside and
// Escape - all of them ways to get rid of it, none of them inside the graphic.
//
// Placed against the viewport rather than flowed into the sidebar: the sidebar is 245px wide and
// clips its overflow, so an in-flow panel was either illegible or had to scroll sideways. Same
// approach as #touch-tooltip in setupSmallScreenUX() - measure the control, clamp to the viewport.
function toggleLimitLadder() {
    const panel = document.getElementById('limit-ladder');
    const sel = document.getElementById('stratRate');
    if (!panel) return;
    const open = panel.style.display !== 'none';
    if (open) { panel.style.display = 'none'; panel.innerHTML = ''; updateLimitBasisNote(); return; }
    panel.style.display = '';
    updateLimitBasisNote();                     // fills it, so it has a size to place
    const r = sel ? sel.getBoundingClientRect() : { left: 8, bottom: 8 };
    const w = panel.offsetWidth || 560;      // offsetWidth, laid out; the rect can read 0 mid-fill
    const clamp = (v, lo, hi) => Math.round(Math.max(lo, Math.min(v, Math.max(lo, hi))));
    panel.style.left = clamp(r.left, 8, window.innerWidth - w - 8) + 'px';
    // Both ends. Clamping only the bottom put the panel off the TOP of the window whenever the page
    // was scrolled far enough that the dropdown had left it.
    panel.style.top  = clamp(r.bottom + 6, 8, window.innerHeight - 60) + 'px';
}

// Two ladders drawn on ONE income axis, which is only possible because a federal bracket top plus
// the year's deduction is the same measure as an IRMAA threshold. Hand-written SVG rather than
// Chart.js: every chart in this app is a time series that must be destroyed and re-instantiated on
// a static canvas, and a canvas inside a hidden panel has no box to measure (montecarlo/mc_tab.js
// carries that warning). A string of SVG has neither problem.
//
// NOTHING IN HERE IS INTERACTIVE. No onclick, no title, no hover. A test pins that.
function buildLimitLadderSVG(status, cpiAdj, selectedLimit) {
    const ded = dropdownDeduction(status);
    const fedBrks = (TAXData.FEDERAL[status]?.brackets ?? []).filter(b => isFinite(b.l));
    const irmaaBrks = (TAXData.IRMAA[status]?.brackets ?? []).filter(b => isFinite(b.l));
    if (!fedBrks.length || !irmaaBrks.length) return '';

    // Axis runs to just past the last tier a reader can actually choose, so nothing the dropdown
    // offers falls off the end. The top federal bracket and top IRMAA tier are unbounded and are
    // drawn as open-ended bands rather than dropped.
    const maxX = Math.max(irmaaBrks[irmaaBrks.length - 1].l * cpiAdj,
                          fedBrks[fedBrks.length - 1].l * cpiAdj + ded) * 1.08;
    const W = 520, L = 62, R = 10, H = 138;
    const x = v => L + Math.max(0, Math.min(1, v / maxX)) * (W - L - R);
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const money = n => DisplayHelpers.formatDollarShort(n);

    const FED = ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'];
    const IRM = ['#f3f4f6', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309'];
    let out = '';

    // Federal band: each bracket drawn where its MAGI equivalent falls, so the two rows line up.
    let prev = 0;
    fedBrks.forEach((b, i) => {
        const top = b.l * cpiAdj + ded;
        out += `<rect x="${x(prev).toFixed(1)}" y="26" width="${Math.max(0, x(top) - x(prev)).toFixed(1)}" height="26" fill="${FED[i % FED.length]}" stroke="#94a3b8"/>`;
        if (x(top) - x(prev) > 26) {
            out += `<text x="${((x(prev) + x(top)) / 2).toFixed(1)}" y="43" font-size="12" text-anchor="middle" fill="#1e293b">${Math.round(b.r * 100)}%</text>`;
        }
        prev = top;
    });
    out += `<rect x="${x(prev).toFixed(1)}" y="26" width="${(W - R - x(prev)).toFixed(1)}" height="26" fill="${FED[fedBrks.length % FED.length]}" stroke="#94a3b8"/>`;

    // IRMAA band. The table's FIRST row is a `-none-` sentinel sitting one dollar below Tier 1's
    // start, not a tier - drawing it as one produced a $1 sliver and shifted every tier number
    // after it by one. So the bands are: 0 to Tier 1's start (no surcharge), then each tier from
    // its own start to the next one's.
    const irmaaBand = (from, to, fill, label) => {
        out += `<rect x="${x(from).toFixed(1)}" y="62" width="${Math.max(0, x(to) - x(from)).toFixed(1)}" height="26" fill="${fill}" stroke="#94a3b8"/>`;
        if (x(to) - x(from) > 26) {
            out += `<text x="${((x(from) + x(to)) / 2).toFixed(1)}" y="79" font-size="12" text-anchor="middle" fill="#1e293b">${label}</text>`;
        }
    };
    const tier1Start = irmaaBrks[1].l * cpiAdj;
    irmaaBand(0, tier1Start, IRM[0], 'none');
    prev = tier1Start;
    for (let i = 1; i < irmaaBrks.length; i++) {
        const next = i + 1 < irmaaBrks.length ? irmaaBrks[i + 1].l * cpiAdj : null;
        if (next === null) break;
        irmaaBand(prev, next, IRM[i % IRM.length], 'T' + i);
        prev = next;
    }
    out += `<rect x="${x(prev).toFixed(1)}" y="62" width="${(W - R - x(prev)).toFixed(1)}" height="26" fill="${IRM[irmaaBrks.length % IRM.length]}" stroke="#94a3b8"/>`;

    // The selected limit, on the axis both rows share.
    const selMagi = /^\d+$/.test(String(document.getElementById('stratRate')?.value ?? ''))
        ? selectedLimit + ded : selectedLimit;
    out += `<line x1="${x(selMagi).toFixed(1)}" y1="20" x2="${x(selMagi).toFixed(1)}" y2="96" stroke="#b45309" stroke-width="2" stroke-dasharray="4 3"/>`;
    out += `<text x="${x(selMagi).toFixed(1)}" y="16" font-size="11" fill="#b45309" text-anchor="middle">your limit</text>`;

    // The plan's own first-year income, when there is a run to read it off.
    const e = Array.isArray(lastSimulationLog) ? lastSimulationLog[0] : null;
    const planMagi = e && e.MAGI > 0 ? e.MAGI / (e['-cpiFactor'] || 1) : null;
    if (planMagi) {
        out += `<line x1="${x(planMagi).toFixed(1)}" y1="20" x2="${x(planMagi).toFixed(1)}" y2="96" stroke="#334155" stroke-width="1.5"/>`;
        out += `<text x="${x(planMagi).toFixed(1)}" y="108" font-size="11" fill="#334155" text-anchor="middle">this plan ${esc(money(planMagi))}</text>`;
    }

    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * maxX);
    let axis = `<line x1="${L}" y1="118" x2="${W - R}" y2="118" stroke="#999"/>`;
    for (const t of ticks) axis += `<text x="${x(t).toFixed(1)}" y="130" font-size="10" fill="#777" text-anchor="middle">${esc(money(t))}</text>`;

    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" `
         + `aria-label="Federal brackets and IRMAA tiers on one total-income axis">`
         + `<text x="4" y="43" font-size="11" fill="#444">Federal</text>`
         + `<text x="4" y="79" font-size="11" fill="#444">IRMAA</text>`
         + out + axis
         + `</svg>`
         + `<div style="font-size:0.72em;color:#78350f;margin-top:2px;padding-left:4px;">`
         + `Both ladders on one axis of total income. Federal brackets are drawn at their top plus `
         + `this plan's deduction, which is the income the plan measures against.</div>`;
}

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

    // P89: the PLAN'S first year, clamped, from the one shared definition - not `by1 + startAge`,
    // which is the year they reach that age even when it is in the past.
    const startYear    = planFirstYear(by1, startAge);
    const medAge       = TAXData.IRMAA.ELIGIBILITY_AGE;
    const p1Medicare   = (startYear - by1) >= medAge;
    const p2Medicare   = hasSpouse && by2 > 0 && (startYear - by2) >= medAge;
    const bothMedicare = bothOnMedicareAtStart(by1, startAge, hasSpouse, by2);
    const oneMedicare  = hasSpouse && (p1Medicare !== p2Medicare);

    // P96. Is Medicare age ALREADY past, this calendar year, for everyone in the plan? If it is,
    // the advice the bothMedicare message used to end on - "Lower Retirement Start Age to model
    // pre-Medicare years" - cannot be followed by anybody: planFirstYear clamps a start year in the
    // past up to the current one, so EVERY start age yields the same first year and the same ages
    // in it. The message named a control that could not change the outcome it was describing.
    // `planFirstYear(by1, 0)` is that clamp's own floor, which is today, so this reuses the shared
    // definition rather than writing a second age calculation beside it.
    const nowYear = planFirstYear(by1, 0);
    const medicareAlready = (nowYear - by1) >= medAge
                         && (!hasSpouse || by2 <= 0 || (nowYear - by2) >= medAge);

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
    // P89: BOTH ages come from the start year. p1's used to be `startAge` itself, which is the age
    // the user typed rather than the age they will be when the plan begins - so a plan starting
    // today for someone already past that age announced an age they had passed years ago.
    const p1AgeAtStart = startYear - by1;
    const p2AgeAtStart = startYear - by2;
    const you  = `you will be ${p1AgeAtStart}`;
    const them = `your spouse ${p2AgeAtStart}`;

    if (bothMedicare && medicareAlready) {
        // Silent, on instruction. The options are greyed out above and nothing here can be acted
        // on, so the box says nothing rather than describing a control that will not help.
        warnEl.style.display = 'none';
    } else if (bothMedicare) {
        warnEl.textContent = hasSpouse
            ? `⚠ At retirement start in ${startYear}, ${you} and ${them} - both on Medicare (age ${medAge}+), so there is no premium subsidy for an income cap to protect. ACA options are unavailable. Lower Retirement Start Age to model pre-Medicare years.`
            : `⚠ At retirement start in ${startYear} ${you}, already on Medicare (age ${medAge}+), so there is no premium subsidy for an income cap to protect. ACA options are unavailable. Lower Retirement Start Age to model pre-Medicare years.`;
        warnEl.style.display = 'block';
    } else if (oneMedicare && sel.value.startsWith('aca')) {
        // P89: gated on the SELECTION. This advisory describes how the FPL cap behaves for a plan
        // that is using one; it was previously shown for every selection, so choosing a federal
        // bracket or an IRMAA tier produced an unprompted paragraph about a cap the plan does not
        // have. The bothMedicare branch above is NOT gated the same way on purpose: it explains why
        // the ACA options are greyed out, and a user who cannot select them could otherwise never
        // find out why.
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

// ── P92e: reading one income ladder's position on the other ────────────────────────────
// The Limit menu offers three families of ceiling in one sorted list and they are NOT measured
// against the same income: a federal entry is a TAXABLE-income threshold, an IRMAA entry is MAGI,
// an ACA entry is ACA MAGI. Printed as three bare dollar amounts they invite a comparison that is
// not valid, and the specific thing a reader cannot see is that IRMAA Tier 1 BEGINS inside the 22%
// bracket and ENDS inside the 24% one - so "fill Tier 1" is a 24% decision.
//
// Every annotation goes through these functions, so the dropdown label, the sentence under it and
// the ladder picture can never disagree about where a limit sits.

// The deduction that converts between the two bases. THE PLAN'S OWN, not a second derivation of it:
// `-fedDeduction` is what calculateTaxes() charged in the plan's first year - standard or itemized,
// the age bumps, and the OBBBA senior deduction after its phase-out. Divided by that year's CPI
// factor to bring it back to the table-year dollars the dropdown prints, since a plan starting in
// 2035 logs a deduction inflated by nine years.
//
// Before the first run there is no log, so this falls back to the bare statutory standard deduction:
// no age bumps, no senior deduction. Wrong by up to about $7,700 for a couple, and wrong only until
// the first simulation finishes, which happens on page load.
//
// STALENESS, and it is deliberate: refreshStratRateOptions() runs at the TOP of runSimulation(), so
// labels are built from the PREVIOUS run's deduction. A second simulation to avoid that would cost
// far more than the drift it removes.
function dropdownDeduction(status) {
    const e = Array.isArray(lastSimulationLog) ? lastSimulationLog[0] : null;
    if (e && e['-fedDeduction'] > 0) return e['-fedDeduction'] / (e['-cpiFactor'] || 1);
    return TAXData.FEDERAL[status]?.std ?? 0;
}

// Which IRMAA band a MAGI figure falls in, by the names the dropdown itself uses.
function irmaaBandNameAt(magi, status, cpiAdj) {
    const brks = TAXData.IRMAA[status]?.brackets ?? [];
    let band = 0;
    for (let i = 1; i < brks.length; i++) {
        if (isFinite(brks[i].l) && magi >= brks[i].l * cpiAdj) band = i; else break;
    }
    return band === 0 ? 'below IRMAA' : `IRMAA Tier ${band}`;
}

// Which federal bracket a TAXABLE-income figure falls in, as a whole-percent rate. Two callers
// want two different words around the same number - the dropdown label says "24% Fed" to match its
// own entries, the sentence below it says "the 24% bracket" - so the number comes back bare and
// each caller writes its own sentence.
function fedBracketPctAt(taxable, status, cpiAdj) {
    const brks = TAXData.FEDERAL[status]?.brackets ?? [];
    for (const b of brks) if (!isFinite(b.l) || taxable <= b.l * cpiAdj) return Math.round(b.r * 100);
    return null;
}
function fedBracketNameAt(taxable, status, cpiAdj) {
    const pct = fedBracketPctAt(taxable, status, cpiAdj);
    return pct == null ? '' : `${pct}% Fed`;
}

// The annotation. `kind` is the ladder the limit came FROM; the answer is the other one.
function crossLadderNote(kind, limit, status, cpiAdj) {
    const ded = dropdownDeduction(status);
    return kind === 'fed'
        ? irmaaBandNameAt(limit + ded, status, cpiAdj)                  // taxable top -> MAGI
        : fedBracketNameAt(Math.max(0, limit - ded), status, cpiAdj);   // MAGI threshold -> taxable
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

    // Compound CPI from TAX_DATA_BASE_YEAR to current year. For tables of the current year this is
    // 1, which is exactly what the engine uses for a plan starting this year (`sim.cpiRate` opens at
    // 1 in the plan's first year and compounds from there), so the menu and the engine agree.
    const currentYear = new Date().getFullYear();
    const yearsFromBase = Math.max(0, currentYear - TAX_DATA_BASE_YEAR);
    const cpiAdj = Math.pow(1 + cpi, yearsFromBase);
    // P92e. Every entry now carries its own figure AND its position on the other ladder, so the
    // dollars are shortened to make room. 3 significant figures: $24.8k at the bottom of the ladder
    // where that precision means something, $211k where it does not.
    const money = n => DisplayHelpers.formatDollarShort(n);

    const options = [];

    // ── Federal brackets ──────────────────────────────────────────────────────
    // Every entry names a CEILING to fill up to, so the top bracket cannot be one of them: its
    // `l` is the Infinity sentinel, meaning "nothing above this". It used to be offered anyway,
    // labelled "no limit", and selecting it produced $NaN for the whole plan - there is no rate
    // at a ceiling that is nowhere.
    //
    // It stays in the list, disabled, showing the income where it BEGINS rather than a ceiling it
    // does not have, because that is the one thing a reader wants from it: where the ladder they
    // are choosing from runs out. Same treatment as the top IRMAA tier below.
    const fedBrks = isMFJ
        ? TAXData.FEDERAL.MFJ.brackets
        : TAXData.FEDERAL.SGL.brackets;
    let prevFedLimit = 0;
    for (let i = 0; i < fedBrks.length; i++) {
        const ratePct = Math.round(fedBrks[i].r * 100);
        const isTop   = !isFinite(fedBrks[i].l);
        if (isTop) {
            // Sorts immediately after the bracket below it, which is where it belongs on an
            // income ladder - Infinity would have parked it past the ACA and IRMAA entries.
            const floor = prevFedLimit + 1;
            options.push({
                value: String(ratePct),
                label: `${ratePct}% Fed  ·  ${money(floor)}+ (${crossLadderNote('fed', floor, status, cpiAdj)})`,
                limit: floor,
                disabled: true,
            });
            continue;
        }
        const limit = Math.round(fedBrks[i].l * cpiAdj);
        prevFedLimit = limit;
        options.push({
            value: String(ratePct),
            label: `${ratePct}% Fed  ·  ${money(limit)} (${crossLadderNote('fed', limit, status, cpiAdj)})`,
            limit,
            defaultSelected: false
        });
    }

    // ── IRMAA tier ceilings ───────────────────────────────────────────────────
    // Ceiling = start of NEXT tier - 1. IRMAA thresholds also grow at CPI. So "IRMAA Tier 4" means
    // keep MAGI INSIDE tier 4, and its ceiling is where tier 5 begins.
    //
    // Which is why the ladder of selectable entries stops at tier 4: tier 5 is the top band, so
    // its ceiling would be the Infinity sentinel row, exactly the unbounded case the top federal
    // bracket hits. It is listed disabled at its FLOOR for the same reason - a reader sizing a
    // plan against the ladder wants to see where it ends.
    const IRMAABrks = isMFJ
        ? TAXData.IRMAA.MFJ.brackets
        : TAXData.IRMAA.SGL.brackets;
    // The last row is the `l: Infinity` sentinel, so the last REAL tier is the one before it, and
    // the last tier with a ceiling is the one before that. Derived rather than hardcoded at 5: the
    // list used to be a fixed five labels, which would silently drop a tier if the table gained one.
    const topTier = IRMAABrks.length - 2;
    for (let i = 0; i <= topTier; i++) {
        const label = i === 0 ? 'Below IRMAA' : `IRMAA Tier ${i}`;
        if (i === topTier) {
            const floor = Math.round(IRMAABrks[i].l * cpiAdj);
            options.push({
                value: `IRMAA${i}`,
                label: `${label}  ·  ${money(floor)}+ (${crossLadderNote('magi', floor, status, cpiAdj)})`,
                limit: floor,
                disabled: true,
            });
            continue;
        }
        const limit = Math.round((IRMAABrks[i + 1].l - 1) * cpiAdj);
        options.push({
            value: `IRMAA${i}`,
            label: `${label}  ·  ${money(limit)} (${crossLadderNote('magi', limit, status, cpiAdj)})`,
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
    //
    // P92e. This used to compound from its own FPL_BASE_YEAR with a `+ 1`, which came to two years
    // where the federal rows took one, so the ACA rows were high by a year on top of the base-year
    // error the other two families had. It now mirrors the engine's own ACA formula exactly
    // (`optimizer_core.js`, the stratACAMultiple branch of computeBracketCeiling):
    //     FPL_2025 * multiple/100 * cpiRate * (1 + cpi)
    // The trailing `(1 + cpi)` is the engine's, ageing a 2025 FPL figure into the plan's first year,
    // and `cpiAdj` stands in for `cpiRate` at a plan starting this calendar year. Measured against a
    // live run before changing: a 2026 plan targets $84,049 where the menu was offering $86,403.
    const fplBase = isMFJ ? 20440 : 15060;
    const fplCpiAdj = cpiAdj * (1 + cpi);
    const acaEntries = [
        { pct: 200, label: 'ACA 200% FPL' },
        { pct: 250, label: 'ACA 250% FPL' },
        { pct: 300, label: 'ACA 300% FPL' },
        { pct: 400, label: 'ACA 400% FPL' },
    ];
    for (const { pct, label } of acaEntries) {
        const limit = Math.round(fplBase * pct / 100 * fplCpiAdj);
        options.push({
            value: `aca${pct}`,
            label: `${label}  ·  ${money(limit)} (${crossLadderNote('magi', limit, status, cpiAdj)})`,
            limit
        });
    }

    // ── Sort all options by income limit, lowest → highest ─────────────────────
    // Sorted on each entry's OWN printed figure, so the column of dollars a reader scans runs
    // upward. It is not the comparable axis: a federal entry's number is taxable income and an
    // IRMAA entry's is MAGI, so `24% Fed - $404k` lists before `IRMAA Tier 3 - $410k` while the
    // ceiling it really imposes ($435,750 of MAGI) is above Tier 3.
    //
    // SORTING ON THE COMPARABLE AXIS WAS TRIED AND REVERTED (P92e). It fixes that inversion and
    // breaks something worse: `10% Fed - $24.8k` then lands between the $63k and $84k ACA entries,
    // because its MAGI equivalent is $57k, and a column reading 42k, 52.5k, 63k, 24.8k, 84k looks
    // broken on sight, on every load. The annotation in each label now carries the cross-ladder
    // truth in words, and the ladder picture under the menu carries it visually. That is where the
    // ranking belongs; this list is for picking one entry and reading its own number.
    options.sort((a, b) => a.limit - b.limit);

    // ── Build HTML ─────────────────────────────────────────────────────────────
    const statusLabel  = isMFJ ? 'MFJ' : 'Single';
    const cpiLabel     = `${(cpi * 100).toFixed(1)}% CPI`;
    const yearLabel    = yearsFromBase > 0 ? ` · ~${currentYear}` : ` · ${TAX_DATA_BASE_YEAR}`;
    let html = `<optgroup label="${statusLabel} · ${cpiLabel}${yearLabel}">`;
    for (const opt of options) {
        const selected = opt.defaultSelected ? ' selected' : '';
        // Greyed the same way updateACAWarning() greys a lapsed ACA entry, so "listed but not
        // choosable" looks like one thing in this control rather than two.
        const off = opt.disabled ? ' disabled style="color:#aaa"' : '';
        // P92e. The numeric limit travels as a data attribute. updateBracketFeedback() used to
        // recover it by running a regex over this label's DISPLAY TEXT, which the `k` suffix would
        // have broken silently - and a label is a thing to read, not an API to parse.
        html += `<option value="${opt.value}" data-limit="${opt.limit}"${selected}${off}>${opt.label}</option>\n`;
    }
    html += '</optgroup>';

    return html;
}






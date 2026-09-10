'use strict';
/**
 * The plan bank: every reference household in one place, by id.
 *
 * WHY IT EXISTS. Studies in this repo used to run on the page's shipped defaults, which are a
 * TEACHING scenario - built to show a user the tradeoffs needed to reach a viable plan, and so
 * strained on purpose. Measuring on it produced four dead results in one day: a feature scored at
 * $0 because the household converts nothing in the only window the feature is legal in, two
 * measures floored because the IRA drains to zero, a bucket objective unreadable because the
 * household ends 100% Roth, and 189 of 270 households skipped because the spend rate could not be
 * funded. None of those were arithmetic errors. They were fixture errors.
 *
 * So: pick a household deliberately, and read its card first. Every plan here carries a
 * `notes.cannotShow` list, and it is the field that saves a wasted study.
 *
 *   const { get, list, viable } = require('./plans');
 *   simulate(get('long-widowhood').inputs);
 *
 * See plans/README.md for the full table and for what each card field means.
 */

const aca_gap_years_texas_early_ss = require('./aca-gap-years-texas-early-ss.js');
const aca_gap_years_texas = require('./aca-gap-years-texas.js');
const age_gap_ira_heavy_ca = require('./age-gap-ira-heavy-ca.js');
const balanced_thirds_couple = require('./balanced-thirds-couple.js');
const bracket_filler_texas_cyclic = require('./bracket-filler-texas-cyclic.js');
const bracket_filler_texas = require('./bracket-filler-texas.js');
const brokerage_heavy_couple = require('./brokerage-heavy-couple.js');
const high_spend_large_ira = require('./high-spend-large-ira.js');
const ira_heavy_couple_overreaching = require('./ira-heavy-couple-overreaching.js');
const ira_heavy_couple = require('./ira-heavy-couple.js');
const irmaa_tier_filler = require('./irmaa-tier-filler.js');
const long_widowhood = require('./long-widowhood.js');
const mixed_portfolio_couple = require('./mixed-portfolio-couple.js');
const modest_balances_little_surplus = require('./modest-balances-little-surplus.js');
const ordered_sequence_texas = require('./ordered-sequence-texas.js');
const single_filer_long_horizon = require('./single-filer-long-horizon.js');
const single_filer_no_survivor = require('./single-filer-no-survivor.js');
const soft_cap_underfunded = require('./soft-cap-underfunded.js');
const taxable_heavy_new_york = require('./taxable-heavy-new-york.js');

const ALL = [
    aca_gap_years_texas_early_ss,
    aca_gap_years_texas,
    age_gap_ira_heavy_ca,
    balanced_thirds_couple,
    bracket_filler_texas_cyclic,
    bracket_filler_texas,
    brokerage_heavy_couple,
    high_spend_large_ira,
    ira_heavy_couple_overreaching,
    ira_heavy_couple,
    irmaa_tier_filler,
    long_widowhood,
    mixed_portfolio_couple,
    modest_balances_little_surplus,
    ordered_sequence_texas,
    single_filer_long_horizon,
    single_filer_no_survivor,
    soft_cap_underfunded,
    taxable_heavy_new_york,
];

const BY_ID = Object.fromEntries(ALL.map(p => [p.id, p]));

/** Every plan, in a stable order. */
function list() { return ALL.slice(); }

/**
 * One plan by id. THROWS rather than returning undefined: a typo'd id would otherwise run the
 * whole study on `undefined` and report numbers for nothing.
 */
function get(id) {
    const p = BY_ID[id];
    if (!p) throw new Error('no plan "' + id + '" - have: ' + Object.keys(BY_ID).join(', '));
    return p;
}

/**
 * The plans that fund every year. Two here do not, deliberately. A scorer silently skipping a
 * failing plan shrinks its sample without saying so, which is what this filter is for.
 */
function viable() { return ALL.filter(p => p.notes.viability.fundsEveryYear); }

/**
 * The plans whose IRA is still alive at the end. Any ending-IRA or peak-IRA measure needs one of
 * these; on the others both are floored and read as though nothing happened.
 */
function withLiveIRA() { return ALL.filter(p => p.notes.viability.endingIRA > 0); }

const API = { list, get, viable, withLiveIRA, ALL, BY_ID };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.PlanBank = API;

// Risk-based guardrails, solved along the live plan (P128).
//
// WHAT IT ANSWERS. At the start of a plan year: what is the probability the plan funds every
// remaining year, what spending would put that probability exactly on the target, at what wealth
// the plan's own spending reaches the raise rail and the cut rail, and what spending returns the
// plan to target at each of those two levels. That is Tharp and Fitzpatrick's four-step recipe
// (research/RISK_BASED_GUARDRAILS.md, section 1), asked at a cadence instead of once, so the rails
// can be drawn over the plan's own lines. The parameter sets are RAIL_PRESETS (optimizer_core.js).
//
// WHEN. The first solve is at the start of the plan's second year - the first FULL year for a plan
// that starts this year, which is how the page is used (user, 2026-09-16) - and every `cadence`
// years after that. Nothing is solved after the last one, so nothing is drawn past it either: an
// extrapolated rail would be a number nobody computed.
//
// IN WHAT UNITS. A solve starting in year S resumes the plan from the end of year S-1, and it finds
// the rails by scaling every account, and the brokerage basis, by one factor. The after-tax wealth of
// the plan (`totalNetWealth`) scales by exactly that factor, so each rail is stated as the
// TotalNetWealth the END of year S-1 would need - the same quantity, at the same moment, as the
// TotalNetWealth line and column on that row. The spending answers belong to year S itself.
//
// HOW A YEAR IS SOLVED. The plan is run once as configured, recording what each year hands the next
// (`captureResume`). A solve RESUMES the plan from that record - same plan-year index, clocks and
// carried state, so a resumed run is the plan itself, not a restart of it - and hands it fresh
// market paths from the Monte Carlo engine. Every probability is the Monte Carlo tab's own survival
// test (yearIsRuined, mc_engine.js), so a 90% rail is a plan the tab would report at 90%.
//
// Guardrails is OFF inside every solve. The rails ARE the spending rule being evaluated, and a
// probability "at a spending level" means spending that holds its planned path - Spend Delta and
// inflation - rather than one another rule is adjusting underneath it. A plan with Guardrails on is
// still resumed from its own Guardrails-adjusted state and spending.
//
// WHAT IT COSTS, which is half the reason it exists (user, 2026-09-16: "to help me determine how
// slow / fast the change can be made"). Every solved year runs the same 46 probability estimates -
// one at the plan as it stands, then five bisections of 9 steps - so a run is
//     solved years x 46 x paths   engine runs,
// and each engine run costs in proportion to the years it simulates, which shrink as the solved year
// moves out. The job returns what it measured, and railsProjectMs() prices settings that were not run
// from it.
//
// One set of paths is drawn per job and reused by every estimate at every year (common random
// numbers): a bisection over a noisy probability is only monotone if every step sees the same draws,
// and the rails of neighbouring years only compare if they were measured on the same market.
//
// Loadable three ways, like mc_engine.js. Depends on, and does not own: simulate(), resumeInputs()
// and RAIL_PRESETS (optimizer_core.js), mulberry32() (prng.js), and buildBanks(), buildPathInputs(),
// yearIsRuined() and _hooksOf() (mc_engine.js). The page and the worker load all of those as classic
// scripts first; node requires the Monte Carlo engine here and expects the rest on globalThis, the
// same contract mc_engine.js has.

const _railsMC = (typeof module !== 'undefined' && module.exports && typeof require === 'function')
    ? require('./mc_engine.js')
    : { buildBanks, buildPathInputs, yearIsRuined, _hooksOf };

// Bisection steps per answer. Nine put a spending answer inside ~0.6% of the plan's spending and a
// rail inside ~0.6% of the wealth, and match the research harness, whose costs the plan was priced on.
const RAILS_BISECT_STEPS = 9;
// One estimate at the plan as it stands, then five bisections: the target spend, the two rails, and
// the spend that returns the plan to target at each rail.
const RAILS_ESTIMATES_PER_YEAR = 1 + 5 * RAILS_BISECT_STEPS;
// Search brackets, as multiples of the plan's own spending and of its wealth. The side of 1 each
// search starts on is decided by the probability already measured, which halves the bracket for
// free; an answer that never leaves the outer edge is reported as clamped.
const RAILS_SPEND_RANGE = [0.1, 4];
const RAILS_SCALE_RANGE = [0.05, 4];
// Market paths longer than the plan, as the research harness draws them.
const RAILS_EXTRA_YEARS = 3;
const RAILS_CADENCE_MAX = 10;
const RAILS_PATHS_RANGE = [20, 2000];
// The first plan year solved: the first full year of a plan that starts this year.
const RAILS_FIRST_YEAR = 1;

// Years between solves, as a whole number the job can use.
function railsCadence(cadence) {
    return Math.min(RAILS_CADENCE_MAX, Math.max(1, Math.floor(Number(cadence)) || 1));
}

// The plan-year indexes a job solves: 1, 1 + cadence, 1 + 2 x cadence, ... while inside the plan.
function railsSolvedYears(n, cadence) {
    const c = railsCadence(cadence);
    const out = [];
    for (let k = RAILS_FIRST_YEAR; k < n; k += c) out.push(k);
    return out;
}

const _RAILS_CANCELLED = Symbol('rails-cancelled');

// One whole rails job. Resolves to the results message, or null if shouldCancel() went true.
//
// cfg: { base, preset, cadence, numPaths, simulationMode, seed, mu, sigma, bearFraction,
//        inflationRate, inflationPersistence, inflationShockSd, inflationReturnCorr }
// `base` is the plan's simulate() inputs, exactly as the page runs them.
async function runRailsJob(cfg, hooks) {
    const h = _railsMC._hooksOf(hooks);
    const t0 = performance.now();
    const preset = RAIL_PRESETS[cfg.preset] || RAIL_PRESETS.normal;
    const numPathsWanted = Math.min(RAILS_PATHS_RANGE[1],
        Math.max(RAILS_PATHS_RANGE[0], Math.round(Number(cfg.numPaths)) || 200));
    const mode = (cfg.simulationMode === 'bootstrap' || cfg.simulationMode === 'aam') ? cfg.simulationMode : 'gbm';

    // The page's own inputs, minus the two things that would only cost time here: the Break Even
    // counterfactual and a resume record nobody asked for.
    const base = { ...cfg.base, computeOC: false, captureResume: false, resume: undefined };
    const ruleOn = base.spendRule === 'gk';
    const solveBase = { ...base, spendRule: '' };

    const tSpine = performance.now();
    const spine = simulate({ ...base, captureResume: true });
    const spineMs = performance.now() - tSpine;
    const log = spine.log;
    const n = log.length;
    const solved = railsSolvedYears(n, cfg.cadence);

    const tBanks = performance.now();
    const years = n + RAILS_EXTRA_YEARS;
    const bankCfg = { ...cfg, years, numPaths: numPathsWanted, baseInputs: solveBase };
    const banks = _railsMC.buildBanks(bankCfg, mulberry32(cfg.seed ?? 42), mode);
    const numPaths = banks.numPaths;
    const pathInputs = new Array(numPaths);
    for (let p = 0; p < numPaths; p++) {
        pathInputs[p] = _railsMC.buildPathInputs(banks, p, years, solveBase, mode);
    }
    const bankMs = performance.now() - tBanks;

    const totalEstimates = solved.length * RAILS_ESTIMATES_PER_YEAR;
    let estimates = 0, runs = 0, pathYears = 0, crashes = 0;

    // Share of paths that fund every remaining year.
    const pos = async (inputsAt) => {
        let ok = 0;
        for (let p = 0; p < numPaths; p++) {
            if ((p & 15) === 0) {
                await h.yieldIfDue();
                if (h.shouldCancel()) throw _RAILS_CANCELLED;
            }
            runs++;
            let r;
            try { r = simulate({ ...inputsAt, ...pathInputs[p] }); }
            catch (e) { crashes++; continue; }   // a crashed run is a failed path, as in runPass
            pathYears += r.log.length;
            if (!r.log.some(_railsMC.yearIsRuined)) ok++;
        }
        estimates++;
        h.onProgress(estimates / totalEstimates);
        return ok / numPaths;
    };

    // Nine halvings of [lo, hi]. `below(x)` answers "is x below the crossing?". `outer` names the
    // edge that is not 1: an answer that never moved off it lies beyond the bracket.
    const bisect = async (lo, hi, below, outer) => {
        let movedLo = false, movedHi = false;
        for (let i = 0; i < RAILS_BISECT_STEPS; i++) {
            const mid = (lo + hi) / 2;
            if (await below(mid)) { lo = mid; movedLo = true; } else { hi = mid; movedHi = true; }
        }
        return { value: (lo + hi) / 2, clamped: outer === 'hi' ? !movedHi : !movedLo };
    };
    const [SPEND_LO, SPEND_HI] = RAILS_SPEND_RANGE;
    const [SCALE_LO, SCALE_HI] = RAILS_SCALE_RANGE;

    const phaseMs = { pos: 0, target: 0, upper: 0, lower: 0, spendUp: 0, spendDn: 0 };
    const timed = async (name, fn) => {
        const t = performance.now();
        try { return await fn(); } finally { phaseMs[name] += performance.now() - t; }
    };

    const out = [];
    try {
        for (const k of solved) {
            // The end of the year before: what the solve starts from, and the row its rails sit on.
            const prev = log[k - 1];
            const rec = prev['-resume'];
            // The spending the plan itself has in year k, as the engine holds it: nominal, before any
            // Medicare outflow or bracket cap is applied to it. With Guardrails on that is the rule's
            // own adjusted goal for the year.
            const planSpend = ruleOn ? log[k].gkSpend : rec.sim.spendGoal;
            const at = (scale, mult) => resumeInputs(solveBase, rec, { balanceScale: scale, spendGoal: planSpend * mult });
            const yT0 = performance.now(), yRuns0 = runs, yPY0 = pathYears;

            const pos0 = await timed('pos', () => pos(at(1, 1)));
            const safe = async (scale, mult, p) => (await pos(at(scale, mult))) >= p;

            const target = await timed('target', () => pos0 >= preset.target
                ? bisect(1, SPEND_HI, m => safe(1, m, preset.target), 'hi')
                : bisect(SPEND_LO, 1, m => safe(1, m, preset.target), 'lo'));
            const upper = await timed('upper', () => pos0 < preset.upper
                ? bisect(1, SCALE_HI, s => safe(s, 1, preset.upper).then(v => !v), 'hi')
                : bisect(SCALE_LO, 1, s => safe(s, 1, preset.upper).then(v => !v), 'lo'));
            const lower = await timed('lower', () => pos0 < preset.lower
                ? bisect(1, SCALE_HI, s => safe(s, 1, preset.lower).then(v => !v), 'hi')
                : bisect(SCALE_LO, 1, s => safe(s, 1, preset.lower).then(v => !v), 'lo'));
            // Every preset has upper >= target > lower, so the plan sits at or above target on the
            // raise rail (more spending affordable) and below it on the cut rail.
            const spendUp = await timed('spendUp', () =>
                bisect(1, SPEND_HI, m => safe(upper.value, m, preset.target), 'hi'));
            const spendDn = await timed('spendDn', () =>
                bisect(SPEND_LO, 1, m => safe(lower.value, m, preset.target), 'lo'));

            const wealth = prev.totalNetWealth;
            out.push({
                k, year: log[k].year, fromYear: prev.year,
                wealth, planSpend, pos: pos0,
                upperScale: upper.value, lowerScale: lower.value,
                railUpper:    wealth * upper.value,
                railLower:    wealth * lower.value,
                spendTarget:  planSpend * target.value,
                spendAtUpper: planSpend * spendUp.value,
                spendAtLower: planSpend * spendDn.value,
                clamped: { target: target.clamped, upper: upper.clamped, lower: lower.clamped,
                           spendUp: spendUp.clamped, spendDn: spendDn.clamped },
                ms: performance.now() - yT0,
                runs: runs - yRuns0,
                pathYears: pathYears - yPY0,
            });
        }
    } catch (e) {
        if (e === _RAILS_CANCELLED) return null;
        throw e;
    }

    const totalMs = performance.now() - t0;
    const solveMs = Object.values(phaseMs).reduce((a, b) => a + b, 0);
    return {
        type: 'results', kind: 'rails',
        preset: { key: preset.key, label: preset.label, target: preset.target,
                  upper: preset.upper, lower: preset.lower },
        cadence: railsCadence(cfg.cadence),
        numPaths, simulationMode: mode, ruleOn,
        planYears: n, startYear: log[0].year,
        years: out,
        cost: {
            totalMs, spineMs, bankMs, solveMs, phaseMs,
            runs, estimates, pathYears, crashes,
            msPerRun:      runs > 0 ? solveMs / runs : null,
            msPerPathYear: pathYears > 0 ? solveMs / pathYears : null,
            bankMsPerPathYear: bankMs / Math.max(1, numPaths * years),
        },
    };
}

// What a rails job with other settings would cost, priced from one that ran. Engine time scales with
// the years each run simulates, and a solve for year k simulates the n - k that are left, so the
// estimate walks the solved years rather than multiplying a flat per-run figure: cadence 1 solves
// many short-horizon years that a per-run average would overprice. `fixedMs` is whatever the caller
// measured outside the job (worker startup, the transfer, the redraw).
//
// The run count is exact whatever the clock did; `ms` is null when the run it is priced from measured
// no time (a host without a real clock).
function railsProjectMs(cost, n, { cadence, numPaths, presets = 1, fixedMs = 0 } = {}) {
    if (!cost || !(n > 0)) return null;
    const paths = Math.min(RAILS_PATHS_RANGE[1], Math.max(RAILS_PATHS_RANGE[0], Math.round(numPaths) || 200));
    const solved = railsSolvedYears(n, cadence);
    let pathYears = 0;
    for (const k of solved) pathYears += RAILS_ESTIMATES_PER_YEAR * paths * (n - k);
    const bankMs = (cost.bankMsPerPathYear ?? 0) * paths * (n + RAILS_EXTRA_YEARS);
    return {
        ms: cost.msPerPathYear > 0
            ? fixedMs + (cost.spineMs ?? 0) + bankMs + presets * pathYears * cost.msPerPathYear
            : null,
        runs: presets * solved.length * RAILS_ESTIMATES_PER_YEAR * paths,
        pathYears: presets * pathYears,
        solvedYears: solved.length,
    };
}

// The rails as Annual Details columns: one object per row of `log`, aligned with it, or null.
//
// Each solve lands on TWO rows. Its wealth rails and its probability sit on the row of the year it
// starts from (`fromYear`), beside that row's own totalNetWealth; its spending answers sit on the
// row of the year it solves for (`year`), beside that row's own spending. Years between two solves
// are interpolated in TODAY's dollars (each row's own inflationFactor) and say so; nothing is
// written after the last solve. `railBasis` describes the wealth rails on its row - the spending on
// the row below comes from the same solve.
//
// Every value is NOMINAL, like every other dollar column, so the Current $ toggle treats them alike.
// `stale` marks rails solved for a plan that has since changed.
const RAIL_FIELDS = ['railLower', 'railUpper', 'railPoS%', 'railSpend', 'railSpendDn', 'railSpendUp', 'railBasis'];

function railsRowFields(msg, log, { stale = false } = {}) {
    const rows = log.map(() => null);
    if (!msg || !Array.isArray(msg.years) || !msg.years.length || !log.length) return rows;
    const infl = i => log[i]?.inflationFactor || 1;
    const idxOf = new Map(log.map((r, i) => [r.year, i]));
    // A solve belongs to this log only if both of its rows are in it, one year apart.
    const pts = msg.years
        .map(y => ({ ...y, w: idxOf.get(y.fromYear), s: idxOf.get(y.year) }))
        .filter(y => y.w != null && y.s === y.w + 1)
        .sort((a, b) => a.w - b.w);
    const put = (i, fields) => { rows[i] = { ...(rows[i] ?? {}), ...fields }; };
    const tag = s => stale ? s + ' (stale)' : s;
    const real = (p, key, at) => p[key] / infl(at);
    for (let j = 0; j < pts.length; j++) {
        const a = pts[j], b = pts[j + 1];
        put(a.w, { railLower: a.railLower, railUpper: a.railUpper, 'railPoS%': a.pos, railBasis: tag('solved') });
        put(a.s, { railSpend: a.spendTarget, railSpendDn: a.spendAtLower, railSpendUp: a.spendAtUpper });
        if (!b) break;
        const span = b.w - a.w;
        for (let d = 1; d < span; d++) {
            const t = d / span;
            const wi = a.w + d, si = a.s + d;
            const mixW = key => (real(a, key, a.w) + t * (real(b, key, b.w) - real(a, key, a.w))) * infl(wi);
            const mixS = key => (real(a, key, a.s) + t * (real(b, key, b.s) - real(a, key, a.s))) * infl(si);
            put(wi, { railLower: mixW('railLower'), railUpper: mixW('railUpper'),
                      'railPoS%': a.pos + t * (b.pos - a.pos), railBasis: tag('interp') });
            put(si, { railSpend: mixS('spendTarget'), railSpendDn: mixS('spendAtLower'), railSpendUp: mixS('spendAtUpper') });
        }
    }
    return rows;
}

// Same three-host tail as mc_engine.js. Keep the two lists identical.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runRailsJob, railsCadence, railsSolvedYears, railsProjectMs, railsRowFields, RAIL_FIELDS,
                       RAILS_BISECT_STEPS, RAILS_ESTIMATES_PER_YEAR, RAILS_SPEND_RANGE, RAILS_SCALE_RANGE,
                       RAILS_EXTRA_YEARS, RAILS_CADENCE_MAX, RAILS_PATHS_RANGE, RAILS_FIRST_YEAR };
} else if (typeof window !== 'undefined') {
    window.RailsEngine = { runRailsJob, railsCadence, railsSolvedYears, railsProjectMs, railsRowFields, RAIL_FIELDS,
                           RAILS_BISECT_STEPS, RAILS_ESTIMATES_PER_YEAR, RAILS_SPEND_RANGE, RAILS_SCALE_RANGE,
                           RAILS_EXTRA_YEARS, RAILS_CADENCE_MAX, RAILS_PATHS_RANGE, RAILS_FIRST_YEAR };
}

// Risk-based guardrails, solved along the live plan (P128).
//
// WHAT IT ANSWERS. At the start of a plan year: what is the probability the plan funds every
// remaining year, what spending would put that probability exactly on the target, at what wealth
// the plan's own spending reaches the raise rail and the cut rail, and what spending returns the
// plan to target at each of those two levels. That is Tharp and Fitzpatrick's four-step recipe
// (research/RISK_BASED_GUARDRAILS.md, section 1), asked at a cadence instead of once, so the rails
// can be drawn over the plan's own lines - for EVERY preset in RAIL_PRESETS (optimizer_core.js) at
// once, so switching presets on the page redraws without solving again. Plus one answer from the
// plan's own start: the After-Tax Spend that puts the plan on each preset's target (P129).
//
// WHEN. The first solve is at the start of the plan's second year - the first FULL year for a plan
// that starts this year, which is how the page is used (user, 2026-09-16) - then every `cadence`
// years, and always the plan's LAST year, whether or not the cadence lands on it (user, 2026-09-18:
// "force RBG to plot up to the next to the last (or last) year"). So the wealth rails reach the
// year-end before the final year and the spending rails the final year itself, and nothing is ever
// extrapolated: a rail past the last solve would be a number nobody computed. The final-year solve
// runs one simulated year a path, so it costs next to nothing. Lengthening the plan to push the
// rails further would not do the same thing: the rails would then be those of a plan that has more
// years to fund.
//
// The plan's own first year has one spending answer and no rails: the After-Tax Spend answer below,
// which is the target spend for year 0 from the balances as entered, and is drawn as that year's
// target-spend point.
//
// IN WHAT UNITS. A solve starting in year S resumes the plan from the end of year S-1, and it finds
// the rails by scaling every account, and the brokerage basis, by one factor. The after-tax wealth of
// the plan (`totalNetWealth`) scales by exactly that factor, so each rail is stated as the
// TotalNetWealth the END of year S-1 would need - the same quantity, at the same moment, as the
// TotalNetWealth line and column on that row. The spending answers belong to year S itself.
//
// HOW A YEAR IS SOLVED (P128n, 2026-09-16: "calculate every rail (and spend threshold?) at the same
// time"). The plan is run once as configured, recording what each year hands the next
// (`captureResume`). A solve RESUMES the plan from that record - same plan-year index, clocks and
// carried state - on fresh market paths from the Monte Carlo engine, and asks each path two
// questions once: the smallest wealth at which it funds every remaining year with the plan's own
// spending, and the largest spending it survives at the plan's own wealth. Survival is monotone in
// both - rails_precision_harness.js made 10,800 path checks and found none out of order - so each
// path has one threshold for each, found by bisection to within RAILS_RESOLUTION.
//
// Every answer is then an ORDER STATISTIC of those thresholds. "The wealth at which q of the paths
// survive" is the c-th smallest wealth threshold, with c the least count for which c / N >= q - the
// Monte Carlo tab's own comparison, applied by the tab's own survival test (yearIsRuined,
// mc_engine.js). So every preset's rails, target spends and chance of success come out of the same
// two passes. The spend that returns the plan to target at a rail is the same question asked at that
// rail's wealth: one more pass per DISTINCT rail (Tight and Normal share their 99% raise rail), each
// path's search bracketed by what the first two passes already know about it.
//
// Only paths that could still BE one of the order statistics are refined (refine(), below), so most
// thresholds stay rough brackets and the answers are exactly the same. On two bank households that
// cut the runs from 59 a path a solved year to 23, and the eight rails_precision_harness.js times
// take 20 to 23: under the 46 the earlier one-preset solver spent, for all three presets. The
// After-Tax Spend answer is counted apart, since it runs on its own paths.
//
// The count rule is the solver's own and is NOT corrected for the path count: from 100 paths a 99%
// rail behaves like a 98% one (research/RISK_BASED_RAILS_PRECISION.md, section 2). A correction
// would make Loose's 99.5% unanswerable below 199 paths.
//
// Guardrails (GK-style) is OFF inside every solve. The rails ARE the spending rule being evaluated,
// and a probability "at a spending level" means spending that holds its planned path - Spend Delta
// and inflation - rather than one another rule is adjusting underneath it. A plan with Guardrails on
// is still resumed from its own adjusted state and spending, which is the plan on screen.
//
// WHAT IT COSTS, which is half the reason it exists. How far each path is refined depends on where it
// sits, so the run count varies with the plan; the job counts what it did, and railsProjectMs()
// prices other settings from that.
//
// One set of paths is drawn per job and reused by every search at every year (common random
// numbers), so the rails of neighboring years compare on the same market.
//
// Loadable three ways, like mc_engine.js. Depends on, and does not own: simulate(), resumeInputs()
// and RAIL_PRESETS (optimizer_core.js), mulberry32() (prng.js), and buildBanks(), buildPathInputs(),
// yearIsRuined() and _hooksOf() (mc_engine.js). The page and the worker load all of those as classic
// scripts first; node requires the Monte Carlo engine here and expects the rest on globalThis, the
// same contract mc_engine.js has.

const _railsMC = (typeof module !== 'undefined' && module.exports && typeof require === 'function')
    ? require('./mc_engine.js')
    : { buildBanks, buildPathInputs, yearIsRuined, _hooksOf };

// Each threshold is found to within 1% of itself - far inside the 3% to 27% a 100-path answer moves
// from run to run - and the After-Tax Spend answer, which has 400 paths behind it, to within 0.5%.
const RAILS_RESOLUTION = Math.log(1.01);
const RAILS_START_RESOLUTION = Math.log(1.005);
// Search brackets, as multiples of the plan's own spending and of its wealth. An answer beyond one
// is reported as clamped, and the page ends its line there rather than drawing the bracket's edge -
// except a wealth rail under the floor, which is reported as $0 (below).
const RAILS_SPEND_RANGE = [0.1, 16];
const RAILS_SCALE_RANGE = [0.05, 16];
// Market paths longer than the plan, as the research harness draws them.
const RAILS_EXTRA_YEARS = 3;
const RAILS_CADENCE_MAX = 10;
// Backstop on the solve loop, not the mechanism: every rail the harness has measured settles in
// well under this, and the loop exits when every count has an answer.
const RAILS_MAX_SOLVE_ROUNDS = 80;
const RAILS_PATHS_RANGE = [20, 2000];
// The panel's defaults (user, 2026-09-16: "Running 100 paths every 3 years is sufficient").
const RAILS_DEFAULT_PATHS = 100;
const RAILS_DEFAULT_CADENCE = 3;
// Paths behind the After-Tax Spend answer, whatever the panel's path count (user, 2026-09-16:
// "worth calculating on the first year at 400 paths").
const RAILS_START_PATHS = 400;
// The first plan year solved: the first full year of a plan that starts this year.
const RAILS_FIRST_YEAR = 1;

// Years between solves, as a whole number the job can use.
function railsCadence(cadence) {
    return Math.min(RAILS_CADENCE_MAX, Math.max(1, Math.floor(Number(cadence)) || RAILS_DEFAULT_CADENCE));
}

function railsPaths(paths) {
    return Math.min(RAILS_PATHS_RANGE[1], Math.max(RAILS_PATHS_RANGE[0], Math.round(Number(paths)) || RAILS_DEFAULT_PATHS));
}

// The plan-year indexes a job solves: 1, 1 + cadence, 1 + 2 x cadence, ... while inside the plan,
// and the last plan year, n - 1, when the cadence steps past it.
function railsSolvedYears(n, cadence) {
    const c = railsCadence(cadence);
    const out = [];
    for (let k = RAILS_FIRST_YEAR; k < n; k += c) out.push(k);
    if (out.length && out[out.length - 1] < n - 1) out.push(n - 1);
    return out;
}

// The least count of N paths that must survive for a q answer: c / N >= q, compared exactly the way
// the Monte Carlo tab compares a survival rate (a floating q x N can land a hair either side).
function railsCount(N, q) {
    for (let c = Math.max(0, Math.floor(q * N) - 2); c <= N; c++) {
        if (c / N >= q) return c;
    }
    return N;
}

// The presets in a fixed order, so every consumer walks them the same way. A job may bring its own
// map (`cfg.presets`, P132: the page appends a `custom` set from the nerdknob boxes); RAIL_PRESETS
// is the default.
function railsPresetKeys(presets = RAIL_PRESETS) {
    return Object.keys(presets);
}

// The chance a cut returns the plan to: the set's own `cutTo`, else its target.
function railsCutTo(P) {
    return P.cutTo ?? P.target;
}

const _RAILS_CANCELLED = Symbol('rails-canceled');
const _RAILS_SKIP_START = Symbol('rails-skip-start');

// One whole rails job. Resolves to the results message, or null if shouldCancel() went true.
//
// cfg: { base, cadence, numPaths, simulationMode, seed, mu, sigma, bearFraction, inflationRate,
//        inflationPersistence, inflationShockSd, inflationReturnCorr, startPaths? }
// `base` is the plan's simulate() inputs, exactly as the page runs them. `startPaths` exists for the
// tests; the page always sends the default.
async function runRailsJob(cfg, hooks) {
    const h = _railsMC._hooksOf(hooks);
    const t0 = performance.now();
    const numPathsWanted = railsPaths(cfg.numPaths);
    const startPathsWanted = Math.max(1, Math.round(Number(cfg.startPaths)) || RAILS_START_PATHS);
    const mode = (cfg.simulationMode === 'bootstrap' || cfg.simulationMode === 'aam') ? cfg.simulationMode : 'gbm';
    const presetMap = cfg.presets ?? RAIL_PRESETS;
    const presetKeys = railsPresetKeys(presetMap);

    // The page's own inputs, minus the two things that would only cost time here: the Break Even
    // counterfactual and a resume record nobody asked for.
    const base = { ...cfg.base, computeOC: false, captureResume: false, resume: undefined };
    // The spine is the plan on screen, GK-style rule and all. With the RISK-BASED rule on it is the
    // plan without the rule (P132): the rails are what that rule follows, and a spine adjusted by
    // the last table would make every solve depend on the one before it.
    const spineBase = base.spendRule === 'rbg' ? { ...base, spendRule: '', rbgRails: undefined } : base;
    const ruleOn = spineBase.spendRule === 'gk';
    const solveBase = { ...spineBase, spendRule: '' };

    const tSpine = performance.now();
    const spine = simulate({ ...spineBase, captureResume: true });
    const spineMs = performance.now() - tSpine;
    const log = spine.log;
    const n = log.length;
    // A caller may name the plan years to solve (a subset of the cadence's, for a job split across
    // workers - P132f) and skip the After-Tax Spend answer; the page never does either.
    const solved = Array.isArray(cfg.solveYears)
        ? railsSolvedYears(n, cfg.cadence).filter(k => cfg.solveYears.includes(k))
        : railsSolvedYears(n, cfg.cadence);
    const years = n + RAILS_EXTRA_YEARS;

    const tBanks = performance.now();
    const bankOf = (paths, seedShift) => {
        const banks = _railsMC.buildBanks({ ...cfg, years, numPaths: paths, baseInputs: solveBase },
                                          mulberry32((cfg.seed ?? 42) + seedShift), mode);
        const inputs = new Array(banks.numPaths);
        for (let p = 0; p < banks.numPaths; p++) inputs[p] = _railsMC.buildPathInputs(banks, p, years, solveBase, mode);
        return inputs;
    };
    const pathInputs = bankOf(numPathsWanted, 0);
    // Its own paths, and more of them: the same seed, so a 400-path answer's first paths are the
    // job's own in the synthetic methods (Historical's bear-start quarter differs with the count).
    const startInputs = bankOf(startPathsWanted, 0);
    const bankMs = performance.now() - tBanks;
    const numPaths = pathInputs.length;
    const startPaths = startInputs.length;

    let runs = 0, pathYears = 0, crashes = 0, sinceYield = 0;
    // What the whole job is expected to take, for the progress bar only: measured on two bank
    // households at about 23 runs a path for a solved year and 3 to 6 for a start path.
    const expectRuns = solved.length * numPaths * 23 + startPaths * 5;

    // Does path `pathIn` fund every remaining year from `inputs`?
    const survives = async (inputs, pathIn) => {
        if (++sinceYield >= 16) {
            sinceYield = 0;
            await h.yieldIfDue();
            if (h.shouldCancel()) throw _RAILS_CANCELLED;
            h.onProgress(Math.min(0.99, runs / expectRuns));
        }
        runs++;
        let r;
        try { r = simulate({ ...inputs, ...pathIn }); }
        catch (e) { crashes++; return false; }   // a crashed run is a failed path, as in runPass
        pathYears += r.log.length;
        return !r.log.some(_railsMC.yearIsRuined);
    };

    const [S_LO, S_HI] = RAILS_SCALE_RANGE;
    const [M_LO, M_HI] = RAILS_SPEND_RANGE;

    // Every answer is an order statistic, and only the paths that could still BE that statistic need
    // their threshold pinned down. So each path's threshold is a bracket, refined a step at a time and
    // only while it overlaps the range an answer could still take - most paths stop after a few steps,
    // far above or below everything asked. Measured on the reference household, that halves the runs
    // against pinning every path, for the same answers.
    //
    // items: [{ lo, hi, loSure, hiSure, test }], test(x) resolving to survival at x. `rise`: survival
    // rises with x (wealth: lo fails, hi survives; a count c asks for the c-th SMALLEST threshold);
    // otherwise it falls (spending: lo survives, hi fails; the c-th LARGEST). An end that is not
    // `sure` is the range's own edge, not yet checked: the path may lie beyond it. A path found beyond
    // an edge is censored - [0, low edge] or [high edge, Infinity] - and never refined again.
    // Resolves to a Map from each count to { value, clamped }, clamped '' | 'low' | 'high'.
    const refine = async (items, counts, rise, range, res) => {
        const [R_LO, R_HI] = range;
        const loB = it => it.loSure ? it.lo : 0;
        const hiB = it => it.hiSure ? it.hi : Infinity;
        const order = rise ? ((a, b) => a - b) : ((a, b) => b - a);
        const kth = (vals, c) => vals.slice().sort(order)[c - 1];
        const answers = new Map();
        const settle = (c, LB, UB) => {
            if (LB >= R_HI) answers.set(c, { value: rise ? null : R_HI, clamped: 'high' });
            else if (UB <= R_LO) answers.set(c, { value: rise ? R_LO : null, clamped: 'low' });
            else if (LB > 0 && Number.isFinite(UB)) answers.set(c, { value: Math.sqrt(LB * UB), clamped: '' });
            else answers.set(c, { value: null, clamped: LB > 0 ? 'high' : 'low' });
        };
        // One step on one path: halve a wide bracket, or check an unchecked edge. False when there is
        // nothing left to learn about it.
        const step = async it => {
            if (it.lo > 0 && Number.isFinite(it.hi) && Math.log(it.hi / it.lo) > res) {
                const x = Math.sqrt(it.lo * it.hi);
                if ((await it.test(x)) === rise) { it.hi = x; it.hiSure = true; }
                else { it.lo = x; it.loSure = true; }
                return true;
            }
            if (!it.loSure) {
                // rise: surviving at the bottom edge, or falling: failing there, is below the range.
                if ((await it.test(R_LO)) === rise) Object.assign(it, { lo: 0, hi: R_LO, loSure: true, hiSure: true });
                else it.loSure = true;
                return true;
            }
            if (!it.hiSure) {
                if ((await it.test(R_HI)) === rise) it.hiSure = true;
                else Object.assign(it, { lo: R_HI, hi: Infinity, loSure: true, hiSure: true });
                return true;
            }
            return false;
        };
        for (let round = 0; round < RAILS_MAX_SOLVE_ROUNDS; round++) {
            const lows = items.map(loB), highs = items.map(hiB);
            const open = [];
            for (const c of counts) {
                if (answers.has(c)) continue;
                if (c <= 0) { answers.set(c, rise ? { value: 0, clamped: 'low' } : { value: null, clamped: 'high' }); continue; }
                const LB = kth(lows, c), UB = kth(highs, c);
                if (LB >= R_HI || UB <= R_LO || (LB > 0 && Number.isFinite(UB) && Math.log(UB / LB) <= res)) settle(c, LB, UB);
                else open.push({ c, LB, UB });
            }
            if (!open.length) break;
            let moved = false;
            for (const it of items) {
                if (!open.some(o => loB(it) < o.UB && hiB(it) > o.LB)) continue;
                if (await step(it)) moved = true;
            }
            // Brackets that overlap but cannot narrow further (several paths within the resolution of
            // one another): the answer is inside them, which is as close as the resolution allows.
            if (!moved) { for (const o of open) settle(o.c, o.LB, o.UB); break; }
        }
        for (const c of counts) if (!answers.has(c)) answers.set(c, { value: null, clamped: 'high' });
        return answers;
    };
    const uniq = xs => [...new Set(xs)];

    const phaseMs = { thresholds: 0, railSpends: 0, start: 0 };
    const out = [];
    let start = null;
    try {
        for (const k of solved) {
            // The end of the year before: what the solve starts from, and the row its rails sit on.
            const prev = log[k - 1];
            const rec = prev['-resume'];
            // The spending the plan itself has in year k, as the engine holds it: nominal, before any
            // Medicare outflow or bracket cap is applied to it. With Guardrails on that is the rule's
            // own adjusted goal for the year.
            const planSpend = ruleOn ? log[k].ruleSpend : rec.sim.spendGoal;
            const at = (scale, mult) => resumeInputs(solveBase, rec, { balanceScale: scale, spendGoal: planSpend * mult });
            const yT0 = performance.now(), yRuns0 = runs, yPY0 = pathYears;

            // Pass 1: each path as planned, which already brackets both of its thresholds by 1.
            const paths = [];
            for (let p = 0; p < numPaths; p++) {
                const pathIn = pathInputs[p];
                const ok11 = await survives(at(1, 1), pathIn);
                const w = ok11 ? { lo: S_LO, hi: 1, loSure: false, hiSure: true }
                               : { lo: 1, hi: S_HI, loSure: true, hiSure: false };
                const m = ok11 ? { lo: 1, hi: M_HI, loSure: true, hiSure: false }
                               : { lo: M_LO, hi: 1, loSure: false, hiSure: true };
                w.test = x => survives(at(x, 1), pathIn);
                m.test = x => survives(at(1, x), pathIn);
                paths.push({ p, ok11, w, m });
            }
            const pos = paths.filter(x => x.ok11).length / numPaths;
            const countOf = q => railsCount(numPaths, q);
            const wealthAns = await refine(paths.map(x => x.w),
                uniq(presetKeys.flatMap(key => [countOf(presetMap[key].upper), countOf(presetMap[key].lower)])),
                true, RAILS_SCALE_RANGE, RAILS_RESOLUTION);
            // The target spend, and (P132) the spend at the plan's own wealth that returns it to a
            // set's cutTo: the second point the rule's cut-side landing runs through. The same
            // count as the target for every set but Paper, so it costs nothing there.
            const spendAns = await refine(paths.map(x => x.m),
                uniq(presetKeys.flatMap(key => [countOf(presetMap[key].target), countOf(railsCutTo(presetMap[key]))])),
                false, RAILS_SPEND_RANGE, RAILS_RESOLUTION);
            const tThresh = performance.now();
            phaseMs.thresholds += tThresh - yT0;

            // Every preset's rails and target, read off those two.
            const rails = {};
            const scales = new Map();   // a distinct rail wealth -> the presets and rails that use it
            for (const key of presetKeys) {
                const P = presetMap[key];
                const upper = wealthAns.get(countOf(P.upper));
                const lower = wealthAns.get(countOf(P.lower));
                const target = spendAns.get(countOf(P.target));
                const cutTo = spendAns.get(countOf(railsCutTo(P)));
                rails[key] = { upper, lower, target, cutTo, spendUp: { value: null, clamped: 'rail' }, spendDn: { value: null, clamped: 'rail' } };
                // The spend at the raise rail returns to the target; the spend at the cut rail to
                // `cutTo`, which the Paper set puts below the target.
                for (const [which, r, q] of [['spendUp', upper, P.target], ['spendDn', lower, railsCutTo(P)]]) {
                    if (r.clamped) continue;   // a rail at a bracket's edge has no spend worth solving
                    if (!scales.has(r.value)) scales.set(r.value, []);
                    scales.get(r.value).push({ key, which, c: countOf(q) });
                }
            }

            // Pass 2: the spend back on target at each distinct rail, starting from what pass 1 learned.
            for (const [scale, uses] of scales) {
                const items = [];
                for (const x of paths) {
                    const pathIn = pathInputs[x.p];
                    // Survival as planned at this wealth, when the wealth bracket already says.
                    let ok = (x.w.hiSure && scale >= x.w.hi) ? true : (x.w.loSure && scale <= x.w.lo) ? false : null;
                    if (ok === null) ok = await survives(at(scale, 1), pathIn);
                    let it;
                    if (ok) {
                        it = { lo: 1, loSure: true, hi: M_HI, hiSure: false };
                        // More wealth survives any spending less wealth did; less wealth fails any
                        // spending more wealth failed.
                        if (scale >= 1 && x.m.loSure && x.m.lo > it.lo) it.lo = x.m.lo;
                        if (scale <= 1 && x.m.hiSure && Number.isFinite(x.m.hi)) { it.hi = x.m.hi; it.hiSure = true; }
                        if (it.lo >= M_HI) it = { lo: M_HI, hi: Infinity, loSure: true, hiSure: true };
                    } else {
                        it = { lo: M_LO, loSure: false, hi: 1, hiSure: true };
                        if (scale <= 1 && x.m.hiSure && x.m.hi < it.hi) it.hi = x.m.hi;
                        if (scale >= 1 && x.m.loSure && x.m.lo > 0) { it.lo = x.m.lo; it.loSure = true; }
                        if (it.hi <= M_LO) it = { lo: 0, hi: M_LO, loSure: true, hiSure: true };
                    }
                    it.test = v => survives(at(scale, v), pathIn);
                    items.push(it);
                }
                const ans = await refine(items, uniq(uses.map(u => u.c)), false, RAILS_SPEND_RANGE, RAILS_RESOLUTION);
                for (const u of uses) rails[u.key][u.which] = ans.get(u.c);
            }
            phaseMs.railSpends += performance.now() - tThresh;

            const wealth = prev.totalNetWealth;
            // A clamped answer is a bound, not a value: its dollar figure is null, so the page ends the
            // line there. The multiple stays, for the status text ("beyond 16x").
            const dollars = (r, of) => (r.clamped || r.value == null) ? null : of * r.value;
            // Except a wealth rail under the floor: the plan needs less than 5% of what it has to reach
            // that chance, and it is reported as $0 (user, 2026-09-18: "Rather than search to the floor,
            // you can clamp the raise rail to 0 ... and the cut rail to -0 also"). Measured on ten
            // households, searching on down to 0.1% of wealth found every such rail, at 8.8% more runs
            // (28% on the plan that raised it), for a number that sits at the bottom of the chart either
            // way. A line that ENDED there read as though the solve had stopped. Its spending (pass 2)
            // stays unsolved, since $0 is a stand-in and not a wealth anyone was measured at.
            const wealthDollars = r => r.clamped === 'low' ? 0 : dollars(r, wealth);
            const presets = {};
            for (const key of presetKeys) {
                const r = rails[key];
                presets[key] = {
                    upperScale: r.upper.value, lowerScale: r.lower.value, targetMult: r.target.value,
                    railUpper:    wealthDollars(r.upper),
                    railLower:    wealthDollars(r.lower),
                    spendTarget:  dollars(r.target, planSpend),
                    spendAtCutTo: dollars(r.cutTo, planSpend),
                    spendAtUpper: dollars(r.spendUp, planSpend),
                    spendAtLower: dollars(r.spendDn, planSpend),
                    clamped: { upper: r.upper.clamped, lower: r.lower.clamped, target: r.target.clamped, cutTo: r.cutTo.clamped,
                               spendUp: r.spendUp.clamped, spendDn: r.spendDn.clamped },
                };
            }
            out.push({
                k, year: log[k].year, fromYear: prev.year,
                wealth, planSpend, pos, presets,
                // The price level the solved year's dollars carry, so the rule can state the row
                // in today's dollars and apply it at a path's own price level, and the year's
                // Social Security and pension, so it can state spending net of them (railsRuleTable).
                inflationFactor: log[k].inflationFactor,
                guaranteedIncome: log[k].guaranteedIncome ?? 0,
                ms: performance.now() - yT0,
                runs: runs - yRuns0,
                pathYears: pathYears - yPY0,
            });
        }

        // The After-Tax Spend that puts the plan on each preset's target, from its own start (P129).
        // Scaling the start record's goal IS typing the scaled goal (checked on 60 path runs by the
        // research harness), so the answer is that multiple of the After-Tax Spend on screen.
        const tStart = performance.now(), sRuns0 = runs, sPY0 = pathYears;
        if (cfg.skipStart) throw _RAILS_SKIP_START;
        const rec0 = spine.resumeStart;
        const at0 = (scale, mult) => resumeInputs(solveBase, rec0, { balanceScale: scale, spendGoal: rec0.sim.spendGoal * mult });
        const items0 = [];
        let ok0 = 0;
        for (let p = 0; p < startPaths; p++) {
            const pathIn = startInputs[p];
            const ok = await survives(at0(1, 1), pathIn);
            if (ok) ok0++;
            const it = ok ? { lo: 1, hi: M_HI, loSure: true, hiSure: false }
                          : { lo: M_LO, hi: 1, loSure: false, hiSure: true };
            it.test = v => survives(at0(1, v), pathIn);
            items0.push(it);
        }
        const startCount = key => railsCount(startPaths, presetMap[key].target);
        const ans0 = await refine(items0, uniq(presetKeys.map(startCount)), false, RAILS_SPEND_RANGE, RAILS_START_RESOLUTION);
        // `spendGoal` is the answer as the After-Tax Spend input takes it, in today's dollars;
        // `spendTarget` is the same spending as year 0 holds it, nominal like every rails dollar, and
        // is what the page draws as the first year's target-spend point.
        const answers = {};
        for (const key of presetKeys) {
            const a = ans0.get(startCount(key));
            const none = a.clamped || a.value == null;
            answers[key] = { mult: a.value, clamped: a.clamped,
                             spendGoal:   none ? null : base.spendGoal * a.value,
                             spendTarget: none ? null : rec0.sim.spendGoal * a.value };
        }
        start = { paths: startPaths, pos: ok0 / startPaths, spendGoal: base.spendGoal, answers,
                  runs: runs - sRuns0, pathYears: pathYears - sPY0, ms: performance.now() - tStart };
        phaseMs.start += performance.now() - tStart;
    } catch (e) {
        if (e === _RAILS_CANCELLED) return null;
        if (e === _RAILS_SKIP_START) start = { paths: 0, pos: null, spendGoal: base.spendGoal, answers: {}, runs: 0, pathYears: 0, ms: 0 };
        else throw e;
    }
    h.onProgress(1);

    const totalMs = performance.now() - t0;
    const solveMs = phaseMs.thresholds + phaseMs.railSpends;
    const solveRuns = runs - start.runs;
    const solvePY = pathYears - start.pathYears;
    const presetsOut = {};
    for (const key of presetKeys) {
        const P = presetMap[key];
        presetsOut[key] = { key, label: P.label, target: P.target, upper: P.upper, lower: P.lower, cutTo: railsCutTo(P) };
    }
    return {
        type: 'results', kind: 'rails', version: 2,
        presets: presetsOut,
        cadence: railsCadence(cfg.cadence),
        numPaths, simulationMode: mode, ruleOn,
        planYears: n, startYear: log[0].year,
        years: out,
        // Every plan year of the spine, so the rule's table can interpolate between solved years in
        // dollars and net each year's own guaranteed income (railsRuleTable).
        spine: log.map((r, k) => ({ k, year: r.year, wealth: r.totalNetWealth, planSpend: ruleOn ? r.ruleSpend : r.spendGoal,
                                    inflationFactor: r.inflationFactor, guaranteedIncome: r.guaranteedIncome ?? 0 })),
        start,
        cost: {
            totalMs, spineMs, bankMs, solveMs, phaseMs,
            runs, pathYears, crashes,
            solveRuns, startRuns: start.runs,
            msPerRun:      runs > 0 ? (solveMs + phaseMs.start) / runs : null,
            msPerPathYear: pathYears > 0 ? (solveMs + phaseMs.start) / pathYears : null,
            bankMsPerPathYear: bankMs / Math.max(1, (numPaths + startPaths) * years),
            // What a path costs, measured: runs per path per solved year, and per start path.
            runsPerPathYear: solved.length > 0 ? solveRuns / (numPaths * solved.length) : null,
            runsPerStartPath: start.runs / startPaths,
            // Simulated years per solve run, against the years left: how much shorter a solve's runs
            // are than a full-horizon run. Used to price other cadences.
            solvePathYears: solvePY,
        },
    };
}

// What a rails job with other settings would cost, priced from one that ran. Engine time scales with
// the years each run simulates, and a solve for year k simulates the n - k that are left, so the
// estimate walks the solved years rather than multiplying a flat per-run figure: cadence 1 solves
// many short-horizon years that a per-run average would overprice. `fixedMs` is whatever the caller
// measured outside the job (worker startup, the transfer, the redraw).
//
// Runs per path are measured, not fixed - a path's searches end sooner when it sits far from every
// rail - so the run count is exact only for the settings that ran, and close for others. `ms` is null
// when the run it is priced from measured no time (a host without a real clock).
function railsProjectMs(cost, n, { cadence, numPaths, fixedMs = 0 } = {}) {
    if (!cost || !(n > 0) || !(cost.runsPerPathYear >= 0)) return null;
    const paths = railsPaths(numPaths);
    const solved = railsSolvedYears(n, cadence);
    const perPath = cost.runsPerPathYear;
    let pathYears = 0;
    for (const k of solved) pathYears += perPath * paths * (n - k);
    const startRuns = cost.startRuns ?? 0;
    const startPY = startRuns * n;
    const bankMs = (cost.bankMsPerPathYear ?? 0) * (paths + RAILS_START_PATHS) * (n + RAILS_EXTRA_YEARS);
    const runs = perPath * paths * solved.length + startRuns;
    return {
        ms: cost.msPerPathYear > 0
            ? fixedMs + (cost.spineMs ?? 0) + bankMs + (pathYears + startPY) * cost.msPerPathYear
            : null,
        runs: Math.round(runs),
        pathYears: Math.round(pathYears + startPY),
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
// A value at a search bracket's edge (clamped) is not a number anyone computed, so it is left out,
// and so is every interpolated value that would lean on it: its line ENDS there (user, 2026-09-16:
// "end the line"). The solved row's `railBasis` names what was left out. The one exception arrives
// already as a number: a wealth rail under the search's floor is $0 (runRailsJob), drawn and
// interpolated like any other, and `railBasis` says so.
//
// The plan's first row also carries a target spend of its own, the After-Tax Spend answer (`start`),
// so the target-spend line begins in the first year. That row's other spending fields stay empty:
// nothing is solved from before the plan starts, so there are no rails to spend at.
//
// Every value is NOMINAL, like every other dollar column, so the Current $ toggle treats them alike.
// `preset` picks which preset's rails to lay out; `stale` marks rails solved for a plan that has
// since changed.
const RAIL_FIELDS = ['railLower', 'railUpper', 'railPoS%', 'railSpend', 'railSpendDn', 'railSpendUp', 'railBasis'];

function railsRowFields(msg, log, { stale = false, preset = 'normal' } = {}) {
    const rows = log.map(() => null);
    if (!msg || !Array.isArray(msg.years) || !log.length) return rows;
    const infl = i => log[i]?.inflationFactor || 1;
    const idxOf = new Map(log.map((r, i) => [r.year, i]));
    // A solve belongs to this log only if both of its rows are in it, one year apart.
    const pts = msg.years
        .map(y => ({ ...y, ...(y.presets?.[preset] ?? {}), w: idxOf.get(y.fromYear), s: idxOf.get(y.year) }))
        .filter(y => y.w != null && y.s === y.w + 1)
        .sort((a, b) => a.w - b.w);
    const put = (i, fields) => { rows[i] = { ...(rows[i] ?? {}), ...fields }; };
    const tag = s => stale ? s + ' (stale)' : s;
    const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
    const real = (p, key, at) => num(p[key]) == null ? null : p[key] / infl(at);
    const SPEND = [['railSpend', 'spendTarget'], ['railSpendDn', 'spendAtLower'], ['railSpendUp', 'spendAtUpper']];
    const NAMES = { upper: 'raise rail', lower: 'cut rail', target: 'target spend',
                    spendUp: 'spend at raise', spendDn: 'spend at cut' };
    // The first year's target spend, only for the plan it was solved from.
    const first = num(msg.start?.answers?.[preset]?.spendTarget);
    if (first != null && msg.startYear === log[0].year) put(0, { railSpend: first });
    for (let j = 0; j < pts.length; j++) {
        const a = pts[j], b = pts[j + 1];
        const atZero = k => (k === 'upper' || k === 'lower') && a.clamped?.[k] === 'low';
        const flagged = Object.entries(a.clamped ?? {}).filter(([, v]) => v);
        const zeroed = flagged.filter(([k]) => atZero(k)).map(([k]) => NAMES[k]);
        const ended = flagged.filter(([k]) => !atZero(k)).map(([k]) => NAMES[k] ?? k);
        const basis = 'solved'
            + (zeroed.length ? `; ${zeroed.join(', ')} under ${RAILS_SCALE_RANGE[0] * 100}% of wealth, shown as $0` : '')
            + (ended.length ? `; ended: ${ended.join(', ')}` : '');
        put(a.w, { railLower: num(a.railLower), railUpper: num(a.railUpper), 'railPoS%': a.pos,
                   railBasis: tag(basis) });
        put(a.s, Object.fromEntries(SPEND.map(([f, key]) => [f, num(a[key])])));
        if (!b) break;
        const span = b.w - a.w;
        for (let d = 1; d < span; d++) {
            const t = d / span;
            const wi = a.w + d, si = a.s + d;
            // Between two solves, and only when both ends were computed.
            const mix = (key, ai, bi, at) => {
                const x = real(a, key, ai), y = real(b, key, bi);
                return x == null || y == null ? null : (x + t * (y - x)) * infl(at);
            };
            put(wi, { railLower: mix('railLower', a.w, b.w, wi), railUpper: mix('railUpper', a.w, b.w, wi),
                      'railPoS%': a.pos + t * (b.pos - a.pos), railBasis: tag('interp') });
            put(si, Object.fromEntries(SPEND.map(([f, key]) => [f, mix(key, a.s, b.s, si)])));
        }
    }
    return rows;
}

// P132. The table the 'rbg' spend rule follows (resolveSpendTarget, optimizer_core.js): one rails
// job, one preset, turned into RATIOS a simulated year can compare its own state against.
//
// The solver finds every rail by scaling the plan's balances by one factor, so a rail is really a
// spend-to-wealth ratio: the plan's spending over the wealth at which it reaches the rail's chance.
// A ratio holds on any path's wealth, which is what lets the rule run inside a Monte Carlo path at
// the cost of one comparison a year instead of a nested solve. What a ratio does NOT carry is the
// dollars Social Security and pensions add - the reason the job solves the spend at each rail
// separately (`spendAtLower`, `spendAtUpper`) rather than scaling the target - so each row keeps
// the rail's own spend-to-wealth ratio, measured at the wealth the rail sits at, which is where a
// path is when it crosses. research/RBG_RULE_VALIDATION.md measures how far that is from re-solving.
//
// Per plan year k (index k of `years`; year 0 has no row - the rule leaves the plan's own first
// year alone), with W the spine's year-end wealth, S its year-k spending and G that year's Social
// Security and pension. Spending is taken NET of G throughout: what the portfolio has to fund is
// S - G, and a path that has raised its spending well above the plan's still has the same G, so a
// ratio on gross spending would misplace both its triggers and its landings. Every dollar is
// divided by the solved year's price level so a path applies the row at its own.
//   cutAt, raiseAt   (S - G) / railLower and (S - G) / railUpper: the ratio of net spending to
//                    wealth at which the chance falls to the cut level, and the one at which it
//                    reaches the raise level
//   wealthReal       W in today's dollars; a path's wealth over it is the multiple `m` below
//   cutA, cutB       the NET spend that returns the plan to `cutTo`, as a share of W, AFFINE in m:
//                    s(m) = cutA + cutB x m, through the two solved points on that chance -
//                    (railLower, spendAtLower - G) and (W, spendAtCutTo - G); with one point solved
//                    it is the ratio through the origin (cutA = 0). The path adds its own G back.
//   raiseA, raiseB   the same for the target, through (railUpper, spendAtUpper - G) and
//                    (W, spendTarget - G)
// A rail under the search's floor is $0 on the message. For the RAISE rail that means the plan
// reaches the raise chance at any wealth the search looked at, so the side fires at any ratio
// (raiseAt = Infinity) and lands through the plan-wealth point alone. For the CUT rail it means the
// chance stays above the cut level at any such wealth: the side never fires. A rail beyond the
// search's top is the mirror image: a cut rail above 16x wealth means the plan is under the cut
// chance at every wealth searched, so the cut fires from the top of the search (cutAt at 16 W),
// and a raise rail beyond it never fires. A side with no landing is null on every one of its
// fields. Years between two solves are interpolated linearly, only when both ends were solved
// (an Infinity end stays Infinity). Nothing is written past the last solve, which is always the
// plan's last year.
function railsRuleTable(msg, presetKey) {
    const P = msg?.presets?.[presetKey];
    if (!P || !Array.isArray(msg.years)) return null;
    const ok = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
    const TOP = RAILS_SCALE_RANGE[1];
    const pts = msg.years
        .map(y => ({ k: y.k, year: y.year, wealth: y.wealth, spend: y.planSpend, infl: y.inflationFactor || 1,
                     guar: y.guaranteedIncome ?? 0, p: y.presets?.[presetKey] }))
        .filter(y => y.p && ok(y.wealth) && ok(y.spend) && Number.isInteger(y.k) && y.k >= 1)
        .sort((a, b) => a.k - b.k);
    // s(m) through the solved points of one chance curve, each (wealth, net spend) as shares of W.
    // The first pair is the rail's point, the second the plan's own wealth. A rail within 5% of the
    // plan's wealth (a plan sitting at the cut or raise level) leaves the two points too close for a
    // line: the slope is one rounding error over another, and between two solves, where the rail
    // and the spend at it are interpolated apart, it produced landings at $0 (2026-09-20). Such a
    // pair, and any pair whose line would have spending FALL with wealth, is read as the ratio
    // through the origin at the rail's point instead.
    const NEAR = 0.05;
    const line = (W, ...pairs) => {
        const q = pairs.filter(([w, s]) => ok(w) && typeof s === 'number' && Number.isFinite(s)).map(([w, s]) => [w / W, s / W]);
        if (!q.length) return [null, null];
        if (q.length === 1 || Math.abs(q[0][0] - q[1][0]) < NEAR) return [0, q[0][1] / q[0][0]];
        const b = (q[1][1] - q[0][1]) / (q[1][0] - q[0][0]);
        if (b < 0) return [0, q[0][1] / q[0][0]];
        return [q[0][1] - b * q[0][0], b];
    };
    // One row from a year's numbers, all in the same dollars (a solved year's own, or today's for an
    // interpolated one - the ratios do not care which). `cl` is the solve's clamp flags. `cutM` and
    // `raiseM` are the rails as multiples of the plan's wealth: beyond them the rule holds the
    // rail's own spend-to-wealth ratio rather than extrapolating the line (resolveSpendTarget).
    const rowOf = (k, year, solved, W, G, S, p, cl, infl) => {
        const net = S - G;
        const spendNet = v => ok(v) ? v - G : null;
        const [cutA, cutB] = line(W, [p.railLower, spendNet(p.spendAtLower)], [W, spendNet(p.spendAtCutTo)]);
        const [raiseA, raiseB] = line(W, [p.railUpper, spendNet(p.spendAtUpper)], [W, spendNet(p.spendTarget)]);
        const r = { k, year, solved, wealthReal: W / infl,
                    cutAt:   ok(p.railLower) ? net / p.railLower : cl.lower === 'high' ? net / (TOP * W) : null, cutA, cutB,
                    cutM:    ok(p.railLower) ? p.railLower / W : null,
                    raiseAt: ok(p.railUpper) ? net / p.railUpper : cl.upper === 'low' ? Infinity : null, raiseA, raiseB,
                    raiseM:  ok(p.railUpper) ? p.railUpper / W : null };
        if (r.cutAt == null || r.cutB == null || !(net > 0)) r.cutAt = r.cutA = r.cutB = r.cutM = null;
        if (r.raiseAt == null || r.raiseB == null) r.raiseAt = r.raiseA = r.raiseB = r.raiseM = null;
        return r;
    };
    const solvedRow = y => rowOf(y.k, y.year, true, y.wealth, y.guar, y.spend, y.p, y.p.clamped ?? {}, y.infl);
    const years = [];
    const FIELDS = ['wealthReal', 'cutAt', 'cutA', 'cutB', 'cutM', 'raiseAt', 'raiseA', 'raiseB', 'raiseM'];
    // Between two solves. With the job's spine (every plan year's wealth, spending and guaranteed
    // income) the DOLLARS are interpolated in today's terms - each rail, and the spend the solver
    // found at it - and the row is then built from that year's OWN spending and guaranteed income.
    // Interpolating the ratios themselves goes wrong where Social Security starts between two
    // solves: total spending capacity is smooth across the start (the solve before it already
    // priced the benefit in), but spending NET of the benefit halves, so a net ratio interpolated
    // across the step sat between two numbers that were both wrong for that year, and a plan raised
    // in the first Social Security year on a rail it had not reached (2026-09-19). Without a spine
    // (an old message) the fields are interpolated as before.
    const spine = Array.isArray(msg.spine) ? msg.spine : null;
    const RAIL_KEYS = ['railLower', 'railUpper', 'spendTarget', 'spendAtCutTo', 'spendAtUpper', 'spendAtLower'];
    const interpolated = (a, b, k) => {
        const t = (k - a.k) / (b.k - a.k);
        const sy = spine && spine[k], sw = spine && spine[k - 1];
        if (sy && sw && ok(sw.wealth) && ok(sy.planSpend)) {
            const infl = sy.inflationFactor || 1;
            const real = (y, key) => ok(y.p[key]) ? y.p[key] / y.infl : y.p[key] === 0 ? 0 : null;
            const p = {};
            for (const key of RAIL_KEYS) {
                const x = real(a, key), z = real(b, key);
                p[key] = (x == null || z == null) ? null : x + t * (z - x);
            }
            // A side clamped at either end stays clamped the same way between them.
            const cl = { lower: a.p.clamped?.lower || b.p.clamped?.lower || '', upper: a.p.clamped?.upper || b.p.clamped?.upper || '' };
            return rowOf(k, sy.year, false, sw.wealth / infl, (sy.guaranteedIncome ?? 0) / infl, sy.planSpend / infl, p, cl, 1);
        }
        const ra = solvedRow(a), rb = solvedRow(b);
        const r = { k, year: ra.year + (k - ra.k), solved: false };
        for (const f of FIELDS) {
            r[f] = (ra[f] == null || rb[f] == null) ? null
                 : (ra[f] === Infinity || rb[f] === Infinity) ? Infinity
                 : ra[f] + t * (rb[f] - ra[f]);
        }
        return r;
    };
    for (let j = 0; j < pts.length; j++) {
        const a = pts[j];
        years[a.k] = solvedRow(a);
        const b = pts[j + 1];
        if (!b) break;
        for (let k = a.k + 1; k < b.k; k++) years[k] = interpolated(a, b, k);
    }
    for (let k = 0; k < years.length; k++) if (years[k] === undefined) years[k] = null;
    return {
        preset: presetKey, label: P.label, target: P.target, upper: P.upper, lower: P.lower, cutTo: P.cutTo ?? P.target,
        numPaths: msg.numPaths, simulationMode: msg.simulationMode, cadence: msg.cadence,
        startYear: msg.startYear, planYears: msg.planYears,
        years,
    };
}

// P132. The rails the RULE reads along any log - a replayed Monte Carlo path, typically - laid out
// as the same Annual Details fields railsRowFields produces, so the charts draw them the same way.
// Each is the table's row for that plan year, turned back into dollars at the path's own state:
//   cut rail   = this year's net spending / cutAt      (the wealth at the end of the year before at
//   raise rail = this year's net spending / raiseAt     which the rule would cut, or raise)
//   target spend, spend at cut, spend at raise = the row's landing lines at the path's own wealth,
//   at the cut rail, and at the raise rail, plus this year's guaranteed income
// The wealth rails sit on the row of the year before (the year-end they compare with), the spending
// on the row of the year itself, as railsRowFields lays them. Spending is the row's own, AFTER any
// adjustment the rule made that year. No chance of success: nothing was solved on this path.
// `railBasis` says 'rule' on a solved row of the table and 'rule (interp)' between two.
function railsRuleRowFields(table, log) {
    const rows = log.map(() => null);
    if (!table || !Array.isArray(table.years) || !Array.isArray(log)) return rows;
    const put = (i, fields) => { rows[i] = { ...(rows[i] ?? {}), ...fields }; };
    const num = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0) ? v : null;
    for (let k = 1; k < log.length; k++) {
        const t = table.years[k];
        const row = log[k], prev = log[k - 1];
        if (!t || !row || !prev || !(t.wealthReal > 0)) continue;
        const g = row.guaranteedIncome ?? 0;
        const net = (row.spendGoal ?? 0) - g;
        const infl = row.inflationFactor || 1;
        const railLower = t.cutAt == null ? null : t.cutAt === 0 ? null : net > 0 ? net / t.cutAt : null;
        const railUpper = t.raiseAt == null ? null : t.raiseAt === Infinity ? 0 : net > 0 ? net / t.raiseAt : null;
        // A line at a wealth: net spend as a share of the spine's wealth, at that wealth's multiple.
        const land = (a, b, w) => (a == null || b == null || w == null) ? null
            : g + (a + b * ((w / infl) / t.wealthReal)) * t.wealthReal * infl;
        put(k - 1, { railLower: num(railLower), railUpper: num(railUpper), 'railPoS%': null,
                     railBasis: t.solved ? 'rule' : 'rule (interp)' });
        put(k, { railSpend:   num(land(t.raiseA, t.raiseB, prev.totalNetWealth)),
                 railSpendDn: num(land(t.cutA, t.cutB, railLower)),
                 railSpendUp: num(land(t.raiseA, t.raiseB, railUpper)) });
    }
    return rows;
}

// Same three-host tail as mc_engine.js. Keep the two lists identical.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runRailsJob, railsCadence, railsPaths, railsSolvedYears, railsProjectMs, railsRowFields, railsRuleTable, railsRuleRowFields,
                       railsCount, railsPresetKeys, railsCutTo, RAIL_FIELDS,
                       RAILS_RESOLUTION, RAILS_START_RESOLUTION, RAILS_SPEND_RANGE, RAILS_SCALE_RANGE,
                       RAILS_EXTRA_YEARS, RAILS_CADENCE_MAX, RAILS_PATHS_RANGE, RAILS_FIRST_YEAR,
                       RAILS_DEFAULT_PATHS, RAILS_DEFAULT_CADENCE, RAILS_START_PATHS };
} else if (typeof window !== 'undefined') {
    window.RailsEngine = { runRailsJob, railsCadence, railsPaths, railsSolvedYears, railsProjectMs, railsRowFields, railsRuleTable, railsRuleRowFields,
                           railsCount, railsPresetKeys, railsCutTo, RAIL_FIELDS,
                           RAILS_RESOLUTION, RAILS_START_RESOLUTION, RAILS_SPEND_RANGE, RAILS_SCALE_RANGE,
                           RAILS_EXTRA_YEARS, RAILS_CADENCE_MAX, RAILS_PATHS_RANGE, RAILS_FIRST_YEAR,
                           RAILS_DEFAULT_PATHS, RAILS_DEFAULT_CADENCE, RAILS_START_PATHS };
}

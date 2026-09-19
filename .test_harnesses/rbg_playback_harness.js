'use strict';
/**
 * rbg_playback_harness.js -- does the cheap risk-based spend rule (`spendRule: 'rbg'`, P132) follow
 * the same path a household would follow if it re-solved its chance of success every year?
 *
 * Run:  node .test_harnesses/rbg_playback_harness.js                 (five households, six historical
 *                                                                     starts, two presets; a few minutes
 *                                                                     on 5 processes)
 *       node .test_harnesses/rbg_playback_harness.js --quick         (one household, two starts, ~1 min)
 *       node .test_harnesses/rbg_playback_harness.js --plan long-widowhood --starts 1937,1966
 *       node .test_harnesses/rbg_playback_harness.js --paths 200 --method bootstrap
 *       node .test_harnesses/rbg_playback_harness.js --from <dir>    (re-print a finished run)
 * Report: research/RBG_RULE_VALIDATION.md. Every number that report quotes is printed here.
 *
 * WHY. The rule inside simulate() never solves a probability. It reads a table the rails solver
 * produced ONCE for the plan - the spend-to-wealth ratios at which the chance crosses each rail,
 * and a line through the two solved points of each chance curve for where an adjustment lands
 * (railsRuleTable, montecarlo/rails_engine.js) - and applies it to whatever wealth a path has. That
 * is what makes the rule cost one comparison a year under Monte Carlo. It is an approximation in
 * three ways, and this harness measures all three at once against the thing it approximates:
 *   1. the table was solved on the plan's own deterministic spine, and a path's STATE (its account
 *      mix, its price level, its Social Security clock) is not the spine's;
 *   2. an adjustment lands on a LINE through two solved points, not on a fresh solve at the path's
 *      wealth (the fixed dollars Social Security and pensions add are why a single ratio is not
 *      enough, and why a line is the first-order fix);
 *   3. years between solves are interpolated at the panel's cadence (3 by default).
 *
 * THE EXACT RULE, which the cheap one is scored against: step the plan through ONE real historical
 * sequence a year at a time. At the start of each year, take the plan's state as it actually is,
 * estimate its chance of success on N fresh market paths (the same paths, by seed, the table was
 * solved on), and if that chance is below the cut rail or at the raise rail, bisect the spending
 * that puts it back on the preset's return level. Then live the year on the real record and repeat.
 * That is the article's rule followed to the letter; it costs N runs a year plus ~11N on each
 * crossing, which is fine for one sequence and hopeless inside a sweep.
 *
 * WHAT IS PRINTED, per household x start year x preset: a year-by-year table of the two rules
 * (wealth, chance, spending, the adjustment made) beside the plan with no rule and the GK-style
 * rule on the same sequence; then a summary of where they part - the years each adjusted, the
 * largest spending gap, the trough against the plan's own shape, lifetime real spending, first
 * decade, ending wealth. A second cheap run at cadence 1 separates (3) from (1) and (2).
 *
 * THE SEQUENCE is the real record from the start year on, the way the Stress Test walks it: equity,
 * bonds, international (equity before 1970) and CPI, per account through the plan's own mix, wrapping
 * to 1928 past 2025. The chance-of-success model is the page's default (Synthetic GBM at the plan's
 * Growth, 12%, seed 42), or Historical with --method bootstrap.
 */

globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
Object.assign(globalThis, require('../taxengine.js'));
const core = require('../optimizer_core.js');
Object.assign(globalThis, core);
Object.assign(globalThis, require('../montecarlo/prng.js'));
Object.assign(globalThis, require('../montecarlo/stats.js'));
Object.assign(globalThis, require('../montecarlo/historical_returns.js'));
const mc = require('../montecarlo/mc_engine.js');
const rails = require('../montecarlo/rails_engine.js');
const PLANS = require('../plans');
const { simulate, resumeInputs, RAIL_PRESETS } = core;
const H = globalThis.HISTORICAL_RETURNS;
const ENGINE = fs.readFileSync(path.join(__dirname, '..', 'retirement_optimizer.html'), 'utf8')
    .match(/<title>[^<]*?([\d.]+\w*)<\/title>/)?.[1] ?? '?';

// ---- knobs -----------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const QUICK = argv.includes('--quick');
const FROM = opt('--from', null);
const PATHS = Number(opt('--paths', QUICK ? 60 : 100));
const METHOD = opt('--method', 'gbm');
const SEED = Number(opt('--seed', 42));
const CADENCE = Number(opt('--cadence', 3));
const PRESETS = opt('--presets', QUICK ? 'normal' : 'normal,paper').split(',');
// With --ceiling both rules hold spending at the plan's own shape (the page's "Never above plan"
// switch, gkShapeCeiling): raises can walk the goal back up to the plan and no further.
const CEILING = argv.includes('--ceiling');
const STARTS = opt('--starts', QUICK ? '1937,2000' : '1929,1937,1966,1973,2000,2007').split(',').map(Number);
const BANK_IDS = argv.includes('--plan') ? [opt('--plan')] : QUICK
    ? ['bracket-filler-texas']
    : ['bracket-filler-texas', 'modest-balances-little-surplus', 'long-widowhood', 'soft-cap-underfunded', 'mixed-portfolio-couple'];
for (const id of BANK_IDS) PLANS.get(id);   // a typo fails at startup
const JOBS = Number(process.env.JOBS) || Math.max(1, Math.min(BANK_IDS.length, os.cpus().length - 4));
const [M_LO, M_HI] = rails.RAILS_SPEND_RANGE;
const STEPS = 9;                              // log bisection on the spend multiple: ~0.4%
const DISCOUNTS = [0, 0.03, 0.05];

// ---- the model -------------------------------------------------------------------------------
function household(id) {
    const inputs = PLANS.get(id).inputs;
    // The plan with NO rule: what the table is solved on, what the exact rule resumes from, and the
    // plan's own shape.
    const base = { ...inputs, computeOC: false, captureResume: false, resume: undefined, spendRule: '', rbgRails: undefined };
    const n = simulate(base).log.length;
    return { id, base, n };
}

function modelCfg(h) {
    return { simulationMode: METHOD, seed: SEED, numPaths: PATHS, mu: h.base.growth, sigma: 0.12, bearFraction: 25,
             inflationRate: h.base.inflation };
}

// The paths every chance is measured on: built exactly as runRailsJob builds its own, so the exact
// rule and the table share one market (the same seed, count, length and base).
function pathBank(h) {
    const years = h.n + rails.RAILS_EXTRA_YEARS;
    const cfg = { ...modelCfg(h), years, baseInputs: h.base };
    const banks = mc.buildBanks(cfg, mulberry32(SEED), METHOD);
    const out = new Array(banks.numPaths);
    for (let p = 0; p < banks.numPaths; p++) out[p] = mc.buildPathInputs(banks, p, years, h.base, METHOD);
    return out;
}

// One real sequence from `start`, `years` long, as the inputs simulate() takes - through the same
// per-account blend the Stress Test uses (pathInputsFromBankRows in bootstrap mode).
function historicalPath(h, start, years) {
    const n = H.equity.length, i0 = start - H.equityStartYear;
    if (i0 < 0 || i0 >= n) throw new Error(`no record for ${start}`);
    const off = H.intlStartYear - H.equityStartYear;
    const rows = { scenario: [], equity: [], bonds: [], intl: [], inflation: [], srcYears: [] };
    for (let y = 0; y < years; y++) {
        const idx = (i0 + y) % n;
        rows.equity.push(H.equity[idx]);
        rows.scenario.push(H.equity[idx]);
        rows.bonds.push(H.bonds[idx]);
        rows.intl.push((idx - off >= 0 && idx - off < H.intl.length) ? H.intl[idx - off] : H.equity[idx]);
        rows.inflation.push(Math.max(-0.01, H.inflation[idx]));
        rows.srcYears.push(H.equityStartYear + idx);
    }
    return { inputs: mc.pathInputsFromBankRows(rows, h.base, 'bootstrap'), srcYears: rows.srcYears,
             wrapsAt: i0 + years > n ? H.equityStartYear + n - 1 : null };
}
// The same sequence from its k-th year on, for a run resumed there.
function slicePath(pi, k) {
    const cut = a => a == null ? a : a.slice(k);
    return { returnSequence: cut(pi.returnSequence), inflationSequence: cut(pi.inflationSequence),
             returnSequencePerAccount: pi.returnSequencePerAccount
                 ? Object.fromEntries(Object.entries(pi.returnSequencePerAccount).map(([a, s]) => [a, cut(s)])) : null };
}

let RUNS = 0;
function survives(inp, pathIn) {
    RUNS++;
    let r;
    try { r = simulate({ ...inp, ...pathIn }); } catch (e) { return false; }
    return !r.log.some(mc.yearIsRuined);
}
// The chance of success of the plan continued from `rec` at spending `spend`, on the bank.
function chance(h, bank, rec, spend) {
    const inp = resumeInputs(h.base, rec, { spendGoal: spend });
    let ok = 0;
    for (const pi of bank) if (survives(inp, pi)) ok++;
    return ok / bank.length;
}
// The largest multiple of `spend` at which the chance still meets q: the solver's own question,
// asked at the path's real state. Clamped at the search's edges like the solver.
function multipleFor(h, bank, rec, spend, q) {
    const meets = m => chance(h, bank, rec, spend * m) >= q;
    if (!meets(M_LO)) return { mult: M_LO, clamped: 'low' };
    if (meets(M_HI)) return { mult: M_HI, clamped: 'high' };
    let lo = M_LO, hi = M_HI;   // lo meets, hi does not
    for (let i = 0; i < STEPS; i++) {
        const mid = Math.sqrt(lo * hi);
        if (meets(mid)) lo = mid; else hi = mid;
    }
    return { mult: Math.sqrt(lo * hi), clamped: '' };
}

// ---- the exact rule, one sequence ------------------------------------------------------------
function exactWalk(h, bank, P, hist, shape) {
    const t0 = performance.now(), r0 = RUNS;
    const cutTo = P.cutTo ?? P.target;
    const rows = [];
    // Year 0 is the plan's own; its record hands year 1 the state.
    let run = simulate({ ...h.base, ...hist.inputs, captureResume: true });
    rows.push({ k: 0, year: run.log[0].year, wealthStart: null, pos: null, spend: run.log[0].spendGoal, label: '',
                wealthEnd: run.log[0].totalNetWealth, infl: run.log[0].inflationFactor });
    let rec = run.log[0]['-resume'];
    for (let k = 1; k < h.n; k++) {
        if (!rec) break;
        const spend = rec.sim.spendGoal;          // year k's goal, Spend Delta and CPI applied
        const pos = chance(h, bank, rec, spend);
        let next = spend, label = '';
        if (pos < P.lower) {
            const m = multipleFor(h, bank, rec, spend, cutTo);
            next = spend * m.mult; label = `cut→${Math.round(cutTo * 100)}%${m.clamped ? ' ' + m.clamped : ''}`;
        } else if (pos >= P.upper) {
            const m = multipleFor(h, bank, rec, spend, P.target);
            next = spend * m.mult; label = `raise→${Math.round(P.target * 100)}%${m.clamped ? ' ' + m.clamped : ''}`;
        }
        // The ceiling: never above the plan's own spending for the year (the rule-off run's).
        if (CEILING && shape[k] && next > shape[k].spend) { next = shape[k].spend; label = (label + ' @shape').trim(); }
        run = simulate({ ...resumeInputs(h.base, rec, { spendGoal: next }), ...slicePath(hist.inputs, k), captureResume: true });
        const row = run.log[0];
        if (!row) break;
        rows.push({ k, year: row.year, wealthStart: rows[k - 1].wealthEnd, pos, spend: row.spendGoal, label,
                    wealthEnd: row.totalNetWealth, infl: row.inflationFactor, ruined: mc.yearIsRuined(row) });
        rec = row['-resume'];
    }
    return { rows, runs: RUNS - r0, ms: performance.now() - t0 };
}

// ---- the cheap rule, the same sequence, and its own chance at each year for the comparison -----
function cheapWalk(h, bank, key, table, hist, { withChance = true } = {}) {
    const t0 = performance.now(), r0 = RUNS;
    const res = simulate({ ...h.base, spendRule: 'rbg', rbgPreset: key, rbgRails: table, gkShapeCeiling: CEILING, ...hist.inputs, captureResume: true });
    const rows = res.log.map((row, k) => ({
        k, year: row.year, wealthStart: k > 0 ? res.log[k - 1].totalNetWealth : null, spend: row.spendGoal,
        label: row.gkAdj === '—' ? '' : row.gkAdj, wealthEnd: row.totalNetWealth, infl: row.inflationFactor,
        ruined: mc.yearIsRuined(row), pos: null,
    }));
    if (withChance) {
        for (let k = 1; k < rows.length; k++) {
            const rec = res.log[k - 1]['-resume'];
            rows[k].pos = chance(h, bank, rec, res.log[k].spendGoal);
        }
    }
    return { rows, runs: RUNS - r0, ms: performance.now() - t0 };
}

function plainWalk(h, hist, over) {
    const res = simulate({ ...h.base, ...over, ...hist.inputs });
    return res.log.map(row => ({ year: row.year, spend: row.spendGoal, infl: row.inflationFactor,
                                 wealthEnd: row.totalNetWealth, label: row.gkAdj && row.gkAdj !== '—' ? row.gkAdj : '',
                                 ruined: mc.yearIsRuined(row) }));
}

// ---- scoring ---------------------------------------------------------------------------------
// Real spending per year against the plan's own shape (rule off, same sequence), lifetime real
// spending at three discount rates, the first decade's share, trough, years below the shape.
function score(rows, shape) {
    const real = rows.map(r => r.spend / (r.infl || 1));
    const shapeReal = shape.map(r => r.spend / (r.infl || 1));
    let trough = Infinity, troughYear = null, below = 0;
    for (let y = 0; y < real.length && y < shapeReal.length; y++) {
        const x = real[y] / shapeReal[y];
        if (x < trough) { trough = x; troughYear = rows[y].year; }
        if (x < 1 - 1e-9) below++;
    }
    const life = {};
    for (const d of DISCOUNTS) life[d] = real.reduce((s, v, y) => s + v / Math.pow(1 + d, y), 0);
    const decade = real.slice(0, 10).reduce((s, v) => s + v, 0);
    const adj = rows.filter(r => r.label).map(r => `${r.year} ${r.label}`);
    return { trough: trough === Infinity ? null : trough, troughYear, below, life, decade,
             endWealth: rows[rows.length - 1]?.wealthEnd ?? null, ruined: rows.some(r => r.ruined), adjustments: adj };
}

// ---- one task: one household, every start and preset --------------------------------------------
async function runTask(task) {
    const h = household(task.plan);
    const t0 = performance.now();
    const bank = pathBank(h);
    const jobs = {};
    for (const cad of [CADENCE, 1]) {
        jobs[cad] = await rails.runRailsJob({ base: h.base, cadence: cad, ...modelCfg(h) });
    }
    const out = { kind: 'playback', engine: ENGINE, plan: task.plan, n: h.n, paths: PATHS, method: METHOD, seed: SEED,
                  cadence: CADENCE, ceiling: CEILING, jobMs: { [CADENCE]: jobs[CADENCE].cost.totalMs, 1: jobs[1].cost.totalMs },
                  jobRuns: { [CADENCE]: jobs[CADENCE].cost.runs, 1: jobs[1].cost.runs }, cases: [] };
    for (const start of STARTS) {
        const hist = historicalPath(h, start, h.n + rails.RAILS_EXTRA_YEARS);
        const off = plainWalk(h, hist, {});
        const gk = plainWalk(h, hist, { spendRule: 'gk', gkShapeCeiling: CEILING });
        for (const key of PRESETS) {
            const P = RAIL_PRESETS[key];
            const table = rails.railsRuleTable(jobs[CADENCE], key);
            const table1 = rails.railsRuleTable(jobs[1], key);
            const exact = exactWalk(h, bank, P, hist, off);
            const cheap = cheapWalk(h, bank, key, table, hist);
            const cheap1 = cheapWalk(h, bank, key, table1, hist, { withChance: false });
            out.cases.push({
                start, preset: key, wrapsAt: hist.wrapsAt, srcYears: hist.srcYears.slice(0, h.n),
                exact: { ...exact, score: score(exact.rows, off) },
                cheap: { ...cheap, score: score(cheap.rows, off) },
                cheap1: { rows: cheap1.rows.map(r => ({ year: r.year, spend: r.spend, label: r.label })), score: score(cheap1.rows, off) },
                off: { score: score(off, off), rows: off },
                gk: { score: score(gk, off), rows: gk },
            });
            process.stderr.write(`  ${task.plan} ${start} ${key}: exact ${exact.runs} runs ${(exact.ms / 1000).toFixed(1)}s, `
                + `cheap ${(cheap.ms / 1000).toFixed(1)}s\n`);
        }
    }
    out.runs = RUNS;
    out.ms = performance.now() - t0;
    return out;
}

if (argv[0] === '--child') {
    const task = JSON.parse(argv[1]);
    runTask(task).then(res => { fs.writeFileSync(task.out, JSON.stringify(res)); process.exit(0); },
                       err => { console.error(err && err.stack || err); process.exit(1); });
    return;
}

function runChildren(tasks) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rbg-playback-'));
    console.log(`Per-task results: ${dir} (re-print with --from <that directory>).\n`);
    let next = 0, done = 0;
    const results = new Array(tasks.length);
    const pass = argv.filter(a => a !== '--child');
    return new Promise((resolve, reject) => {
        const launch = () => {
            if (next >= tasks.length) return;
            const i = next++;
            const task = { ...tasks[i], out: path.join(dir, `t${i}.json`) };
            const child = spawn(process.execPath, [__filename, '--child', JSON.stringify(task), ...pass],
                                { stdio: ['ignore', 'ignore', 'pipe'], env: process.env });
            let err = '';
            child.stderr.on('data', d => { err += d; process.stderr.write(d); });
            child.on('exit', code => {
                if (code !== 0) { reject(new Error(`${task.plan}: ${err}`)); return; }
                results[i] = JSON.parse(fs.readFileSync(task.out, 'utf8'));
                done++;
                process.stderr.write(`[${done}/${tasks.length}] ${task.plan} ${(results[i].ms / 1000).toFixed(0)}s\n`);
                if (done === tasks.length) resolve(results); else launch();
            });
        };
        for (let j = 0; j < Math.min(JOBS, tasks.length); j++) launch();
    });
}

// ---- printing --------------------------------------------------------------------------------
const money = v => v == null ? '-' : '$' + Math.round(v).toLocaleString('en-US');
const pct = (v, d = 0) => v == null ? '-' : (v * 100).toFixed(d) + '%';
const signed = (v, d = 1) => v == null ? '-' : (v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%';

function printCase(r, c) {
    const P = RAIL_PRESETS[c.preset];
    console.log(`\n### ${r.plan}, retiring into ${c.start}, ${P.label} (target ${pct(P.target)}, raise ${pct(P.upper, 1)}, cut ${pct(P.lower)} back to ${pct(P.cutTo ?? P.target)})`);
    if (c.wrapsAt) console.log(`\n(The record ends in ${c.wrapsAt}; the sequence continues from 1928.)`);
    console.log('\n| year | record | wealth at start | exact: chance | exact: spend | exact: adjustment | cheap: chance | cheap: spend | cheap: adjustment | gap | no rule | GK-style |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
    const n = Math.min(c.exact.rows.length, c.cheap.rows.length);
    for (let k = 0; k < n; k++) {
        const e = c.exact.rows[k], q = c.cheap.rows[k];
        const gap = e.spend > 0 ? q.spend / e.spend - 1 : null;
        console.log(`| ${e.year} | ${c.srcYears[k]} | ${money(e.wealthStart)} | ${pct(e.pos)} | ${money(e.spend)} | ${e.label || ''} `
            + `| ${pct(q.pos)} | ${money(q.spend)} | ${q.label || ''} | ${signed(gap)} | ${money(c.off.rows[k]?.spend)} | ${money(c.gk.rows[k]?.spend)}${c.gk.rows[k]?.label ? ' ' + c.gk.rows[k].label : ''} |`);
    }
    const S = { exact: c.exact.score, cheap: c.cheap.score, 'cheap, every year': c.cheap1.score, 'no rule': c.off.score, 'GK-style': c.gk.score };
    console.log('\n| rule | adjustments | trough vs shape | years below | first decade (real) | lifetime real 0% | 3% | 5% | ending wealth | funded |');
    console.log('|---|---|---|---|---|---|---|---|---|---|');
    for (const [name, s] of Object.entries(S)) {
        console.log(`| ${name} | ${s.adjustments.length ? s.adjustments.join('; ') : 'none'} | ${s.trough == null ? '-' : signed(s.trough - 1)} (${s.troughYear ?? '-'}) | ${s.below} `
            + `| ${money(s.decade)} | ${money(s.life[0])} | ${money(s.life[0.03])} | ${money(s.life[0.05])} | ${money(s.endWealth)} | ${s.ruined ? 'NO' : 'yes'} |`);
    }
}

function gapStats(c) {
    const n = Math.min(c.exact.rows.length, c.cheap.rows.length);
    let maxGap = 0, sumAbs = 0, cnt = 0, maxYear = null, nearAbs = 0, nearCnt = 0;
    for (let k = 1; k < n; k++) {
        const e = c.exact.rows[k].spend, q = c.cheap.rows[k].spend;
        if (!(e > 0)) continue;
        const g = q / e - 1;
        if (Math.abs(g) > Math.abs(maxGap)) { maxGap = g; maxYear = c.exact.rows[k].year; }
        sumAbs += Math.abs(g); cnt++;
        // Near the plan: the exact rule's spending within 1.5x of the plan's own for the year.
        const shape = c.off.rows[k]?.spend;
        if (shape > 0 && e / shape <= 1.5) { nearAbs += Math.abs(g); nearCnt++; }
    }
    const yearsOf = rows => rows.filter(r => r.label).map(r => r.year);
    const ey = yearsOf(c.exact.rows), cy = yearsOf(c.cheap.rows);
    const matched = ey.filter(a => cy.some(y => Math.abs(y - a) <= 1)).length;
    return { maxGap, maxYear, meanAbs: cnt ? sumAbs / cnt : 0, nearAbs: nearCnt ? nearAbs / nearCnt : null, nearCnt,
             exactAdj: ey.length, cheapAdj: cy.length, matched, firstExact: ey[0] ?? null, firstCheap: cy[0] ?? null };
}

function printAll(results) {
    const ceiling = results[0]?.ceiling;
    console.log(`# rbg_playback_harness.js - engine ${results[0]?.engine}, ${PATHS} paths, ${METHOD}, seed ${SEED}, table every ${CADENCE} years (and every year)${ceiling ? ', ceiling ON (never above plan)' : ', no ceiling'}\n`);
    console.log('## Summary: where the cheap rule parts from the exact one\n');
    console.log('| household | start | preset | exact adjusts | cheap adjusts | matched +/-1 yr | first: exact / cheap | largest spend gap (year) | mean |gap| | mean |gap| near plan (years) | trough: exact / cheap / every-year / GK | lifetime real 0%: exact / cheap / off | funded: exact / cheap |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of results) {
        for (const c of r.cases) {
            const g = gapStats(c);
            const t = s => s.trough == null ? '-' : signed(s.trough - 1, 0);
            console.log(`| ${r.plan} | ${c.start} | ${c.preset} | ${g.exactAdj} | ${g.cheapAdj} | ${g.matched} | ${g.firstExact ?? '-'} / ${g.firstCheap ?? '-'} `
                + `| ${signed(g.maxGap)} (${g.maxYear ?? '-'}) | ${pct(g.meanAbs, 1)} | ${g.nearAbs == null ? '-' : pct(g.nearAbs, 1)} (${g.nearCnt}) | ${t(c.exact.score)} / ${t(c.cheap.score)} / ${t(c.cheap1.score)} / ${t(c.gk.score)} `
                + `| ${money(c.exact.score.life[0])} / ${money(c.cheap.score.life[0])} / ${money(c.off.score.life[0])} | ${c.exact.score.ruined ? 'NO' : 'yes'} / ${c.cheap.score.ruined ? 'NO' : 'yes'} |`);
        }
    }
    console.log('\n## Cost\n');
    console.log('| household | plan years | table job (every 3) | table job (every year) | exact walk per sequence | runs per exact walk | task total |');
    console.log('|---|---|---|---|---|---|---|');
    for (const r of results) {
        const ex = r.cases.map(c => c.exact);
        const avgMs = ex.reduce((s, e) => s + e.ms, 0) / ex.length, avgRuns = ex.reduce((s, e) => s + e.runs, 0) / ex.length;
        console.log(`| ${r.plan} | ${r.n} | ${(r.jobMs[r.cadence] / 1000).toFixed(1)} s, ${r.jobRuns[r.cadence].toLocaleString()} runs | ${(r.jobMs[1] / 1000).toFixed(1)} s, ${r.jobRuns[1].toLocaleString()} runs `
            + `| ${(avgMs / 1000).toFixed(1)} s | ${Math.round(avgRuns).toLocaleString()} | ${(r.ms / 1000).toFixed(0)} s |`);
    }
    console.log('\n## Every case, year by year');
    for (const r of results) for (const c of r.cases) printCase(r, c);
}

async function main() {
    let results;
    if (FROM) {
        results = fs.readdirSync(FROM).filter(f => /^t\d+\.json$/.test(f)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
            .map(f => JSON.parse(fs.readFileSync(path.join(FROM, f), 'utf8')));
    } else {
        results = await runChildren(BANK_IDS.map(plan => ({ plan })));
    }
    printAll(results);
}
main().catch(e => { console.error(e && e.stack || e); process.exit(1); });

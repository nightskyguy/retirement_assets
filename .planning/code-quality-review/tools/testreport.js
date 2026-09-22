'use strict';
// Builds the markdown pieces of the Tests section from the mutation jsonl files, the per-test
// inventory and the timing tables.  node testreport.js <scratchpad> <out.md>
const fs = require('fs'), path = require('path');
const SP = process.argv[2], OUT = process.argv[3];
const STAR = String.fromCharCode(0x2605);

function readJsonl(f) { if (!fs.existsSync(f)) return []; return fs.readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); }
function baseNames(tsv) {
    const out = []; const seen = new Set();
    for (const l of fs.readFileSync(tsv, 'utf8').split('\n').filter(Boolean)) {
        const p = l.split('\t'); let name = p[2]; const crit = name.startsWith(STAR);
        if (crit) name = name.replace(/^\S+\s+CRITICAL\s+/, '');
        if (seen.has(name)) continue; seen.add(name); out.push({ name, ms: Number(p[0]), critical: crit });
    }
    return out;
}
const inv = require(path.join(SP, 'out', 'testinv.json'));
const invByName = new Map(inv.map(t => [t.name, t]));

const RUNS = [
    ['optimizer_core.js', 'mut_core.jsonl', 'optimizer_core.tests.js', 'timing_optimizer_core.tsv'],
    ['taxengine.js', 'mut_taxengine.jsonl', 'taxengine.tests.js', 'timing_taxengine.tsv'],
    ['taxPaymentPlanner.js', 'mut_tpp.jsonl', 'taxPaymentPlanner.tests.js', 'timing_taxPaymentPlanner.tsv'],
    ['montecarlo/mc_engine.js', 'mut_mc_engine.jsonl', 'optimizer_core.tests.js', 'timing_optimizer_core.tsv'],
    ['montecarlo/prng.js', 'mut_prng.jsonl', 'optimizer_core.tests.js', 'timing_optimizer_core.tsv'],
    ['montecarlo/stats.js', 'mut_stats.jsonl', 'optimizer_core.tests.js', 'timing_optimizer_core.tsv'],
    ['montecarlo/rails_engine.js', 'mut_rails.jsonl', 'optimizer_core.tests.js', 'timing_optimizer_core.tsv'],
    ['feedback.js', 'mut_feedback.jsonl', 'feedback.tests.js', 'timing_feedback.tsv'],
    ['.feedback-worker/src/logic.cjs', 'mut_logic.jsonl', 'feedback.tests.js', 'timing_feedback.tsv'],
    ['doclinks.js', 'mut_doclinks.jsonl', 'doclinks.tests.js', 'timing_doclinks.tsv'],
    ['displayhelpers.js', 'mut_displayhelpers.jsonl', 'optimizer_core.tests.js', 'timing_optimizer_core.tsv'],
];
// taxengine run also ran optimizer_core.tests.js; count its kills for core tests too
const EXTRA = [['taxengine.js', 'mut_taxengine.jsonl', 'optimizer_core.tests.js', 'timing_optimizer_core.tsv']];

const killsByTest = new Map();   // suite|name -> {kills, unique, targets:{}}
const perTarget = [];
const survivorsByTarget = {};
const killSetsBySuite = {};      // suite -> [{key, tests:Set}]
function tally(target, recs, suite, names) {
    for (const b of names) { const k = suite + '|' + b.name; if (!killsByTest.has(k)) killsByTest.set(k, { suite, name: b.name, ms: b.ms, critical: b.critical, kills: 0, unique: 0, targets: {} }); }
    killSetsBySuite[suite] = killSetsBySuite[suite] || [];
    for (const r of recs) {
        const failed = (r.failed && r.failed[suite]) || [];
        if (r.status === 'killed' && failed.length) {
            const set = new Set(failed);
            killSetsBySuite[suite].push({ key: r.key, tests: set });
            const totalFailed = Object.values(r.failed).reduce((s, a) => s + a.length, 0);
            for (const n of set) {
                const k = suite + '|' + n;
                if (!killsByTest.has(k)) killsByTest.set(k, { suite, name: n, ms: 0, critical: false, kills: 0, unique: 0, targets: {} });
                const e = killsByTest.get(k); e.kills++; e.targets[target] = (e.targets[target] || 0) + 1; if (totalFailed === 1) e.unique++;
            }
        }
    }
}
for (const [target, jsonl, suite, tsv] of RUNS) {
    const recs = readJsonl(path.join(SP, 'out', jsonl));
    if (!recs.length) { perTarget.push({ target, missing: true }); continue; }
    const T = { target, total: recs.length, killed: 0, survived: 0, crash: 0, timeout: 0, byOp: {}, byFn: {} };
    for (const r of recs) {
        T[r.status] = (T[r.status] || 0) + 1;
        const opc = r.op.split(':')[0]; const O = T.byOp[opc] = T.byOp[opc] || { total: 0, survived: 0 }; O.total++; if (r.status === 'survived') O.survived++;
        const F = T.byFn[r.fn] = T.byFn[r.fn] || { total: 0, survived: 0, high: 0, samples: [], lowSamples: [] }; F.total++;
        if (r.status === 'survived') {
            F.survived++;
            // high-signal: a deleted statement, a flipped sign / comparison / condition, a swapped
            // min/max, a boolean; NOT a numeric literal nudged by 10% (mostly epsilons and labels)
            const high = !/^num:/.test(r.op) && !/^rel:.*(<→<=|<=→<|>→>=|>=→>)/.test(r.op) ? true : (/^rel:/.test(r.op) ? false : false);
            if (high) { F.high++; if (F.samples.length < 4) F.samples.push(r); }
            else if (F.lowSamples.length < 2) F.lowSamples.push(r);
        }
    }
    perTarget.push(T);
    survivorsByTarget[target] = T.byFn;
    tally(target, recs, suite, baseNames(path.join(SP, 'out', tsv)));
}
for (const [target, jsonl, suite, tsv] of EXTRA) {
    const recs = readJsonl(path.join(SP, 'out', jsonl));
    if (recs.length) tally(target, recs, suite, baseNames(path.join(SP, 'out', tsv)));
}
// in-page runs
const inpage = {};
for (const [target, jsonl] of [['optimizer_core.js', 'mut_inpage_core.jsonl'], ['taxengine.js', 'mut_inpage_taxengine.jsonl']]) {
    const recs = readJsonl(path.join(SP, 'out', jsonl));
    if (!recs.length) continue;
    const nodeRecs = readJsonl(path.join(SP, 'out', target === 'optimizer_core.js' ? 'mut_core.jsonl' : 'mut_taxengine.jsonl'));
    const nodeStatus = new Map(nodeRecs.map(r => [r.key, r.status]));
    const byAssert = new Map();
    let killed = 0, killedNodeMissed = 0, killedNodeMissedList = [];
    for (const r of recs) {
        if (r.status !== 'killed') continue;
        killed++;
        const ns = nodeStatus.get(r.key);
        if (ns === 'survived') { killedNodeMissed++; if (killedNodeMissedList.length < 40) killedNodeMissedList.push(r); }
        for (const n of (r.failed['__inpage_runner.js'] || [])) byAssert.set(n, (byAssert.get(n) || 0) + 1);
    }
    inpage[target] = { total: recs.length, killed, survived: recs.filter(r => r.status === 'survived').length, killedNodeMissed, killedNodeMissedList, byAssert: [...byAssert.entries()].sort((a, b) => b[1] - a[1]) };
}

// greedy cover per suite
const covers = {};
for (const [suite, sets] of Object.entries(killSetsBySuite)) {
    const testToMut = new Map();
    for (const s of sets) for (const t of s.tests) { if (!testToMut.has(t)) testToMut.set(t, new Set()); testToMut.get(t).add(s.key); }
    const alive = new Set(sets.map(s => s.key));
    const cover = [];
    while (alive.size) {
        let best = null, bestN = 0;
        for (const [t, ms] of testToMut) { let n = 0; for (const m of ms) if (alive.has(m)) n++; if (n > bestN) { bestN = n; best = t; } }
        if (!best) break;
        cover.push([best, bestN]); for (const m of testToMut.get(best)) alive.delete(m);
    }
    covers[suite] = { cover, mutantsKilled: sets.length, testsThatKill: testToMut.size };
}

const esc = s => String(s).replace(/\|/g, '\\|').replace(/`/g, "'");
let md = '';
md += '### 4.1 Mutation scores by file\n\n| File | Mutants | Killed | Survived | Crash/timeout | Score | Survival by operator (survived/total) |\n|---|---|---|---|---|---|---|\n';
for (const T of perTarget) {
    if (T.missing) { md += `| \`${T.target}\` | run did not complete | | | | | |\n`; continue; }
    const ct = (T.crash || 0) + (T.timeout || 0);
    const score = (100 * (T.killed + ct) / T.total).toFixed(0) + '%';
    const ops = Object.entries(T.byOp).sort((a, b) => (b[1].survived / b[1].total) - (a[1].survived / a[1].total)).map(([k, v]) => `${k} ${v.survived}/${v.total}`).join(', ');
    md += `| \`${T.target}\` | ${T.total} | ${T.killed} | ${T.survived} | ${ct} | ${score} | ${esc(ops)} |\n`;
}
md += '\nOperator keys: num = numeric literal changed; rel = `<`/`<=`/`>`/`>=` swapped; eq = `===`/`!==` flipped; logic = `&&`/`||` swapped; arith = `+`/`-`/`*`/`/` swapped; minmax = `Math.min`/`Math.max` swapped; bool = `true`/`false` flipped; ifneg = an `if` condition negated; stmtdel = one assignment or call statement deleted.\n\n';

// zero-kill tests
md += '### 4.2 Tests that killed no mutant in any run\n\n';
for (const suite of ['optimizer_core.tests.js', 'taxengine.tests.js', 'taxPaymentPlanner.tests.js', 'feedback.tests.js', 'doclinks.tests.js']) {
    const all = [...killsByTest.values()].filter(e => e.suite === suite);
    const zero = all.filter(e => e.kills === 0);
    md += `\n**${suite}**: ${all.length} tests, ${zero.length} killed nothing`;
    const cov = covers[suite];
    if (cov) md += `; ${cov.mutantsKilled} mutants were killed by this suite, ${cov.testsThatKill} tests took part, and a greedy cover of **${cov.cover.length} tests** kills every one of them`;
    md += '.\n\n';
    if (zero.length) {
        md += '| Test | Line | Lines | Time (ms) | Signals |\n|---|---|---|---|---|\n';
        for (const e of zero.sort((a, b) => (invByName.get(a.name) || { start: 0 }).start - (invByName.get(b.name) || { start: 0 }).start)) {
            const t = invByName.get(e.name) || {};
            const sig = [t.tag ? t.tag.toUpperCase() : '', t.readsSource ? 'reads source' : '', t.goldenNums >= 3 ? 'golden literals' : '', t.earlyReturn ? 'early return' : '', t.simulateCalls === 0 && t.calcTaxCalls === 0 ? 'no simulate/calculateTaxes' : '', e.critical ? 'CRITICAL' : ''].filter(Boolean).join(', ');
            md += `| ${esc(e.name.slice(0, 95))} | ${t.start || '?'} | ${t.lines || '?'} | ${Math.round(e.ms || t.ms || 0)} | ${sig} |\n`;
        }
    }
}
// redundant: kill only mutants also killed by the cover
md += '\n### 4.3 Tests whose every kill is also caught by the cover set\n\n';
for (const suite of ['optimizer_core.tests.js', 'taxengine.tests.js', 'taxPaymentPlanner.tests.js', 'feedback.tests.js', 'doclinks.tests.js']) {
    const cov = covers[suite]; if (!cov) continue;
    const coverSet = new Set(cov.cover.map(c => c[0]));
    const red = [...killsByTest.values()].filter(e => e.suite === suite && e.kills > 0 && !coverSet.has(e.name));
    md += `\n**${suite}**: ${red.length} tests kill mutants but add no kill beyond the ${cov.cover.length}-test cover (candidates to MERGE, not to drop blindly: the cover is one of many minimal sets). Unique kills (a mutant no other test caught) are the number to respect.\n\n`;
    md += '| Test | Kills | Unique kills | Line |\n|---|---|---|---|\n';
    for (const e of red.sort((a, b) => a.unique - b.unique || a.kills - b.kills).slice(0, 60)) md += `| ${esc(e.name.slice(0, 95))} | ${e.kills} | ${e.unique} | ${(invByName.get(e.name) || {}).start || '?'} |\n`;
    if (red.length > 60) md += `| ... ${red.length - 60} more | | | |\n`;
}
// top killers
md += '\n### 4.4 The tests that do the work\n\n';
for (const suite of ['optimizer_core.tests.js', 'taxengine.tests.js', 'taxPaymentPlanner.tests.js']) {
    const cov = covers[suite]; if (!cov) continue;
    md += `\n**${suite}** greedy cover, in order (test: mutants newly covered):\n\n`;
    md += cov.cover.slice(0, 25).map(([t, n]) => `- ${esc(t.slice(0, 100))} (${n})`).join('\n') + (cov.cover.length > 25 ? `\n- ... ${cov.cover.length - 25} more` : '') + '\n';
}
// survivors by function
md += '\n### 4.5 Where the survivors are (behavior no test pins)\n\n';
for (const T of perTarget) {
    if (T.missing) continue;
    const fns = Object.entries(T.byFn).filter(([, v]) => v.survived > 0).sort((a, b) => b[1].high - a[1].high || b[1].survived - a[1].survived);
    if (!fns.length) continue;
    const totHigh = fns.reduce((s, [, v]) => s + v.high, 0), totSurv = fns.reduce((s, [, v]) => s + v.survived, 0);
    md += `\n**${T.target}** - ${totSurv} survivors in ${fns.length} functions, ${totHigh} of them high-signal (a deleted statement, a flipped sign, comparison, condition or boolean, a swapped min/max; numeric nudges and off-by-one relational swaps excluded). Top 20 functions by high-signal count:\n\n| Function | High-signal / all survivors / mutants | High-signal examples (line: mutation; source) |\n|---|---|---|\n`;
    for (const [fn, v] of fns.slice(0, 20)) {
        const ex = (v.samples.length ? v.samples : v.lowSamples).slice(0, 3).map(r => `${r.line}: ${esc(r.op)}; \`${esc(r.src.slice(0, 70))}\``).join(' / ');
        md += `| \`${fn}\` | ${v.high} / ${v.survived} / ${v.total} | ${ex} |\n`;
    }
}
// in-page
md += '\n### 4.6 The in-page suite, measured the same way\n\n';
for (const [target, v] of Object.entries(inpage)) {
    md += `\n**${target}** against the 274 in-page assertions that pass under a stubbed DOM: ${v.total} mutants, ${v.killed} killed, ${v.survived} survived; **${v.killedNodeMissed}** of the kills are mutants the node suite let live, i.e. what the pre-commit hook gains if those assertions move to node.\n\n`;
    if (v.byAssert.length) md += 'Assertions with the most kills: ' + v.byAssert.slice(0, 12).map(([n, k]) => `${esc(n.slice(0, 60))} (${k})`).join('; ') + '.\n\n';
    if (v.killedNodeMissedList.length) {
        md += 'Mutants only the in-page suite caught (first 25):\n\n| Line | Function | Mutation | Source |\n|---|---|---|---|\n';
        for (const r of v.killedNodeMissedList.slice(0, 25)) md += `| ${r.line} | \`${r.fn}\` | ${esc(r.op)} | \`${esc(r.src.slice(0, 80))}\` |\n`;
    }
}
fs.writeFileSync(OUT, md);
console.log('written', OUT, md.length, 'chars; targets', perTarget.filter(t => !t.missing).length, 'missing', perTarget.filter(t => t.missing).map(t => t.target).join(','));

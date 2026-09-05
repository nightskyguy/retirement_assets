'use strict';
/**
 * endgame_harness.js -- P35n. What should Phased's tail (the post-IRA-target years) draw from?
 *
 * Run:  node .test_harnesses/endgame_harness.js
 *
 * THE QUESTION. P35's PR-5 spec fills post-target spending from ['Brokerage','Cash','Roth']
 * weighted by balance -- proportional over the non-IRA accounts. Nobody measured that choice,
 * and the 2026-08-10 program produced evidence against its shape: P28 says Roth LOSES when it
 * displaces Cash (proportional draws them together every year), and the P51 oracle's recurring
 * end-game is a late ROTH-SPENDING TAIL with appreciated Brokerage ridden to the IRC 1014
 * step-up. This harness starts simulations IN the endgame state (IRA already at target, RMD
 * age, SS in payment) and bakes off tail policies directly.
 *
 * ARMS (all via the P51b oracleWithdrawalPlan research input; engine defaults untouched):
 *   ref        no plan -- the engine's own default tail (propwd-0 primary + [40,60] gap fill).
 *              NOTE it draws the IRA proportionally, i.e. it does NOT respect the target floor;
 *              it is the honest incumbent, not a floor-respecting candidate.
 *   spec-prop  { prop: true } every year -- the PR-5 BALANCED spec, exactly.
 *   seq-CBR    Cash -> Brokerage -> Roth (IRA dead-last backstop) -- P28-consistent ordering.
 *   seq-CRB    Cash -> Roth -> Brokerage -- Roth early, statically.
 *   flip-k     seq-CBR until year k, then Roth -> Cash -> Brokerage from k on -- the gain-aware
 *              late flip, k found by linear scan (fractions 0.4..0.9 of horizon + never).
 *   oracle     light per-year coordinate descent over a 5-entry menu (prop/CBR/CRB/Roth-first/
 *              Brok-first), 2 passes, seeded from the best static arm -- the expressible ceiling.
 *
 * GRID (user-approved 2026-08-10): residual IRA {$0, $750k at-goal} x death profile
 * {long-joint ~4 survivor yrs, early-first-death ~16 survivor yrs} x non-IRA mix {brokheavy,
 * balanced, rothheavy; $2.55M constant} x basis 20/50/80% x spend 4/6/8% of total = 108 cells.
 * Conversions OFF in the primary tables; a conversions-ON sensitivity pass re-checks the
 * winner identity on the basis-50 slice.
 *
 * RULES: spend pinned (equal delivered spend or the arm is flagged), wealth-only score at a
 * shared per-cell heirs rate, failed arms reported not hidden, sequential node.
 *
 * ── PREDICTIONS (E-P1..E-P5), recorded BEFORE the numbers were looked at ────────────────────
 *   E-P1. seq-CBR beats spec-prop in >=70% of comparable cells (P28: Roth displacing Cash is
 *         the leak proportional bakes in).
 *   E-P2. The flip adds real value at basis 20% (best k in the last third of the horizon) and
 *         ~nothing at basis 80%.
 *   E-P3. Static Roth-early (seq-CRB) loses to seq-CBR in most cells; exceptions concentrate
 *         in early-first-death cells at basis 20 (long widow phase + step-up).
 *   E-P4. The residual-IRA axis changes LEVELS, not the ordering verdict: the winning arm is
 *         the same in IRA=$0 and IRA=$750k cells in >=80% of paired cells.
 *   E-P5. Conversions-on sensitivity: winner identity unchanged in >=80% of checked cells.
 * Scored at the end of the run.
 */

// ── Bootstrap ───────────────────────────────────────────────────────────────────────────────
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const { simulate, afterTaxNetWorth } = core;

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();
let SIMS = 0;
const runSim = inputs => { SIMS++; return simulate(inputs); };

// ── Endgame base: couple 75/73, SS in payment, RMDs active ──────────────────────────────────
const COMMON = {
    STATEname: 'CA', nYears: 20,
    birthyear1: 1951, birthmonth1: 6, birthyear2: 1953, birthmonth2: 3, hasSpouse: true,
    ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 67,
    pensionAnnual: 0, pensionStartAge: 0, survivorPct: 0, pensionCola: false,
    spendChange: 0, iraBaseGoal: 750000,
    inflation: 0.025, cpi: 0.025, growth: 0.06,
    cashYield: 0.03, dividendRate: 0.02,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: false, propWithdraw: 0, iraWithdrawPct: 0.06,
    extraConversionAmount: 0, fundConversionWithCash: false,
    strategy: 'propwd',
    startAge: 75, startInYear: 2026, dividendReinvest: true,
    gkGuard: 0.20, gkAdjPct: 0.10, cycleLTCGTarget: 0.15,
    qcdHHMax: 0, qcdMode: 'asneeded', computeOC: false,
};
const DEATHS = [
    ['joint', { die1: 92, die2: 94 }],   // deaths 2043/2047 -> ~4 survivor years
    ['widow', { die1: 80, die2: 94 }],   // death1 2031 -> ~16 survivor years
];
const IRAS = [['ira0', 0], ['ira750', 750000]];
const MIXES = [                          // non-IRA total held at $2.55M
    ['brokheavy', { Brokerage: 1800000, Roth: 600000, Cash: 150000 }],
    ['balanced',  { Brokerage: 1200000, Roth: 1200000, Cash: 150000 }],
    ['rothheavy', { Brokerage: 600000,  Roth: 1800000, Cash: 150000 }],
];
const BASES = [0.2, 0.5, 0.8];
const RATES = [0.04, 0.06, 0.08];

// ── Arms ────────────────────────────────────────────────────────────────────────────────────
const E_CBR = { seq: ['Cash', 'Brokerage', 'Roth', 'IRA'] };
const E_CRB = { seq: ['Cash', 'Roth', 'Brokerage', 'IRA'] };
const E_ROTH = { seq: ['Roth', 'Cash', 'Brokerage', 'IRA'] };
const E_BROK = { seq: ['Brokerage', 'Cash', 'Roth', 'IRA'] };
const E_PROP = { prop: true };
const fullPlan = e => new Array(40).fill(e);
const flipPlan = (h, k) => new Array(40).fill(null).map((_, y) => y < k ? E_CBR : E_ROTH);

function scoreOf(res, rate, baseSpend) {
    if (!res?.totals?.success) return null;
    if ((res.totals.shortfall ?? 0) > 1) return null;
    if (baseSpend != null && Math.abs((res.totals.spendCurrentDollars ?? 0) - baseSpend) > 1) return null;
    const last = res.log[res.log.length - 1];
    const atnw = afterTaxNetWorth(res.totals.terminal, rate, res.totals.capGainsRate);
    const defl = (res.finalNW && res.finalNW !== 0)
        ? ((last.totalNetWealth / (last.inflationFactor || 1)) / res.finalNW) : 1;
    return atnw * defl;
}

function runCell(cellBase) {
    const ref = runSim({ ...cellBase });
    const rate = ref.totals.futureIRARate ?? 0;
    const horizon = ref.log.length;
    const baseSpend = ref.totals.success ? (ref.totals.spendCurrentDollars ?? 0) : null;
    const evalPlan = plan => {
        const res = runSim({ ...cellBase, oracleWithdrawalPlan: plan });
        return { res, score: scoreOf(res, rate, baseSpend) };
    };
    const arms = {
        ref: { res: ref, score: scoreOf(ref, rate, null) },
        'spec-prop': evalPlan(fullPlan(E_PROP)),
        'seq-CBR': evalPlan(fullPlan(E_CBR)),
        'seq-CRB': evalPlan(fullPlan(E_CRB)),
    };
    // flip-k linear scan (never binary): k as fraction of horizon, plus k = horizon (no flip).
    let bestFlip = null;
    for (const f of [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]) {
        const k = Math.round(horizon * f);
        const a = evalPlan(flipPlan(horizon, k));
        if (a.score != null && (!bestFlip || a.score > bestFlip.score)) bestFlip = { ...a, k, f };
    }
    arms['flip-k'] = bestFlip ?? { score: null };
    // Light oracle: per-year menu, 2 passes, seeded from the best static arm's entry.
    const MENU = [E_PROP, E_CBR, E_CRB, E_ROTH, E_BROK];
    const staticBest = ['spec-prop', 'seq-CBR', 'seq-CRB'].reduce((a, b) =>
        (arms[b].score ?? -Infinity) > (arms[a].score ?? -Infinity) ? b : a);
    const seedEntry = staticBest === 'spec-prop' ? E_PROP : staticBest === 'seq-CRB' ? E_CRB : E_CBR;
    let plan = new Array(horizon).fill(seedEntry);
    let cur = evalPlan(plan).score;
    if (cur != null) {
        for (let pass = 0; pass < 2; pass++) {
            let improved = 0;
            for (let y = 0; y < horizon; y++) {
                let best = plan[y], bestSc = cur;
                for (const e of MENU) {
                    if (e === plan[y]) continue;
                    const p2 = plan.slice(); p2[y] = e;
                    const sc = evalPlan(p2).score;
                    if (sc != null && sc > bestSc + 0.01) { bestSc = sc; best = e; }
                }
                if (best !== plan[y]) { improved += bestSc - cur; plan[y] = best; cur = bestSc; }
            }
            if (improved < 1) break;
        }
    }
    arms.oracle = { score: cur, plan };
    return { arms, rate, horizon, baseSpend };
}

// ── Main sweep ──────────────────────────────────────────────────────────────────────────────
console.log('P35n endgame tail bake-off -- 108 cells, conversions OFF primary');
console.log('grid: IRA {0, 750k} x deaths {joint, widow} x mix {brokheavy, balanced, rothheavy}');
console.log('      x basis 20/50/80 x spend 4/6/8% of total\n');
const t0 = Date.now();
const cells = [];
for (const [dn, dov] of DEATHS) for (const [ian, ira] of IRAS) for (const [mn, mov] of MIXES) {
    for (const bf of BASES) for (const sr of RATES) {
        const accounts = { IRA1: ira, IRA2: 0, Roth: mov.Roth, Roth2: 0,
            Brokerage: mov.Brokerage, BrokerageBasis: Math.round(mov.Brokerage * bf),
            Cash: mov.Cash };
        const total = ira + mov.Roth + mov.Brokerage + mov.Cash;
        const cellBase = { ...COMMON, ...dov, ...accounts,
            spendGoal: Math.round(total * sr) };
        const r = runCell(cellBase);
        cells.push({ label: [dn, ian, mn, 'b' + bf * 100, '@' + sr * 100 + '%'].join(' '),
            dn, ian, mn, bf, sr, cellBase, ...r });
        process.stdout.write('.');
    }
}
console.log('\n' + cells.length + ' cells, ' + SIMS + ' sims, ' +
    ((Date.now() - t0) / 1000).toFixed(1) + 's\n');

// ── Tables ──────────────────────────────────────────────────────────────────────────────────
const ARMK = ['ref', 'spec-prop', 'seq-CBR', 'seq-CRB', 'flip-k'];
const winnerOf = c => {
    let w = null;
    for (const a of ARMK) {
        if (c.arms[a].score == null) continue;
        if (!w || c.arms[a].score > c.arms[w].score) w = a;
    }
    return w;
};
console.log('='.repeat(105));
console.log('TABLE 1  winner among the five candidate arms (oracle excluded), by axis');
console.log('='.repeat(105));
const axes = [['dn', ['joint', 'widow']], ['ian', ['ira0', 'ira750']],
              ['mn', ['brokheavy', 'balanced', 'rothheavy']], ['bf', BASES], ['sr', RATES]];
for (const [ax, vals] of axes) {
    for (const v of vals) {
        const cs = cells.filter(c => c[ax] === v);
        const counts = {};
        for (const c of cs) { const w = winnerOf(c); if (w) counts[w] = (counts[w] || 0) + 1; }
        console.log(String(v).padEnd(11) + Object.entries(counts).sort((a, b) => b[1] - a[1])
            .map(([a, n]) => a + ' ' + n).join(', '));
    }
    console.log('');
}
const total = {};
for (const c of cells) { const w = winnerOf(c); if (w) total[w] = (total[w] || 0) + 1; }
console.log('ALL CELLS: ' + Object.entries(total).sort((a, b) => b[1] - a[1])
    .map(([a, n]) => a + ' ' + n).join(', '));

console.log('\n' + '='.repeat(105));
console.log('TABLE 2  median delta vs spec-prop (the PR-5 spec), successful comparable cells');
console.log('='.repeat(105));
for (const a of ['seq-CBR', 'seq-CRB', 'flip-k', 'oracle']) {
    const ds = cells.filter(c => c.arms[a].score != null && c.arms['spec-prop'].score != null)
        .map(c => c.arms[a].score - c.arms['spec-prop'].score).sort((x, y) => x - y);
    if (!ds.length) continue;
    console.log(a.padEnd(10) + 'n=' + String(ds.length).padEnd(5) +
        ' median ' + money(ds[Math.floor(ds.length / 2)]).padStart(11) +
        '  min ' + money(ds[0]).padStart(11) + '  max ' + money(ds[ds.length - 1]).padStart(11));
}

console.log('\nFlip value (flip-k minus seq-CBR) by basis, and where the flip lands:');
for (const bf of BASES) {
    const cs = cells.filter(c => c.bf === bf && c.arms['flip-k'].score != null &&
        c.arms['seq-CBR'].score != null);
    const ds = cs.map(c => c.arms['flip-k'].score - c.arms['seq-CBR'].score).sort((x, y) => x - y);
    const realFlips = cs.filter(c => c.arms['flip-k'].f < 1 &&
        c.arms['flip-k'].score - c.arms['seq-CBR'].score > 1);
    const fs = realFlips.map(c => c.arms['flip-k'].f);
    console.log('  b' + (bf * 100) + ':  median ' + money(ds[Math.floor(ds.length / 2)] ?? 0) +
        ', max ' + money(ds[ds.length - 1] ?? 0) + ';  real flips ' + realFlips.length + '/' +
        cs.length + (fs.length ? ', k/h range ' + Math.min(...fs) + '-' + Math.max(...fs) : ''));
}

console.log('\nGap to the light oracle (oracle minus best candidate arm), by basis:');
for (const bf of BASES) {
    const ds = cells.filter(c => c.bf === bf && c.arms.oracle.score != null)
        .map(c => {
            const best = Math.max(...ARMK.map(a => c.arms[a].score ?? -Infinity));
            return c.arms.oracle.score - best;
        }).sort((x, y) => x - y);
    console.log('  b' + (bf * 100) + ':  median ' + money(ds[Math.floor(ds.length / 2)] ?? 0) +
        ', max ' + money(ds[ds.length - 1] ?? 0));
}

// Arm health
console.log('\nArm health (cells where the arm was infeasible or spend-moved, of ' + cells.length + '):');
for (const a of ARMK) {
    const bad = cells.filter(c => c.arms[a].score == null).length;
    if (bad) console.log('  ' + a.padEnd(10) + bad);
}

// ── Conversions-ON sensitivity (basis-50 slice) ─────────────────────────────────────────────
console.log('\n' + '='.repeat(105));
console.log('SENSITIVITY  conversions ON (convertExcessToRoth), basis-50 slice, winner identity');
console.log('='.repeat(105));
let sensSame = 0, sensN = 0;
for (const c of cells.filter(c => c.bf === 0.5)) {
    const cb = { ...c.cellBase, convertExcessToRoth: true };
    const r = runCell(cb);
    const w0 = winnerOf(c), w1 = winnerOf({ arms: r.arms });
    if (!w0 || !w1) continue;
    sensN++;
    if (w0 === w1) sensSame++;
    else console.log('  winner flip at ' + c.label + ': ' + w0 + ' -> ' + w1);
    process.stdout.write('');
}
console.log('winner identity unchanged: ' + sensSame + '/' + sensN);

// ── Low-wealth check ────────────────────────────────────────────────────────────────────────
// The main grid's smallest total is $2.55M, where Brokerage draws overrun the 0% LTCG bracket.
// At ~$1M the 0% bracket can swallow the whole draw and the "avoid realizing gains" mechanism
// weakens -- the one regime where spec-prop/seq-CBR could still be right. x0.4 scale, basis 50.
console.log('\n' + '='.repeat(105));
console.log('LOW-WEALTH CHECK  (x0.4 scale, totals ~$1.02M-$1.32M, basis 50, 36 cells)');
console.log('='.repeat(105));
const lowCounts = {};
let lowN = 0;
for (const [dn, dov] of DEATHS) for (const [ian, ira] of IRAS) for (const [mn, mov] of MIXES) {
    for (const sr of RATES) {
        const s = x => Math.round(x * 0.4);
        const accounts = { IRA1: s(ira), IRA2: 0, Roth: s(mov.Roth), Roth2: 0,
            Brokerage: s(mov.Brokerage), BrokerageBasis: Math.round(s(mov.Brokerage) * 0.5),
            Cash: s(mov.Cash) };
        const total = s(ira) + s(mov.Roth) + s(mov.Brokerage) + s(mov.Cash);
        const cellBase = { ...COMMON, ...dov, ...accounts, iraBaseGoal: s(750000),
            spendGoal: Math.round(total * sr) };
        const r = runCell(cellBase);
        const w = winnerOf({ arms: r.arms });
        if (!w) continue;
        lowN++;
        lowCounts[w] = (lowCounts[w] || 0) + 1;
    }
}
console.log('winners over ' + lowN + ' low-wealth cells: ' +
    Object.entries(lowCounts).sort((a, b) => b[1] - a[1]).map(([a, n]) => a + ' ' + n).join(', '));

// ── Prediction scoring ──────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(105));
console.log('PREDICTION SCORING  (E-P1..E-P5, recorded before the run)');
console.log('='.repeat(105));
const comp = cells.filter(c => c.arms['seq-CBR'].score != null && c.arms['spec-prop'].score != null);
const cbrWins = comp.filter(c => c.arms['seq-CBR'].score > c.arms['spec-prop'].score + 1).length;
console.log('E-P1 seq-CBR beats spec-prop >=70%: ' + cbrWins + '/' + comp.length + ' (' +
    (100 * cbrWins / Math.max(1, comp.length)).toFixed(0) + '%) -> ' +
    (cbrWins / Math.max(1, comp.length) >= 0.7 ? 'RIGHT' : 'WRONG'));
const flipVal = bf => {
    const cs = cells.filter(c => c.bf === bf && c.arms['flip-k'].score != null && c.arms['seq-CBR'].score != null);
    const ds = cs.map(c => c.arms['flip-k'].score - c.arms['seq-CBR'].score).sort((x, y) => x - y);
    return ds[Math.floor(ds.length / 2)] ?? 0;
};
const realFlipFracs = cells.filter(c => c.bf === 0.2 && c.arms['flip-k'].f < 1 &&
    c.arms['flip-k'].score - (c.arms['seq-CBR'].score ?? -Infinity) > 1).map(c => c.arms['flip-k'].f);
const lateFlips = realFlipFracs.filter(f => f >= 0.6).length;
console.log('E-P2 flip pays at b20 (late k), inert at b80: median flip value b20 ' +
    money(flipVal(0.2)) + ' vs b80 ' + money(flipVal(0.8)) + ';  late flips ' + lateFlips + '/' +
    realFlipFracs.length + ' -> ' +
    ((flipVal(0.2) > 1 && flipVal(0.8) < Math.max(1, flipVal(0.2) / 5)) ? 'RIGHT' : 'WRONG'));
const crbComp = cells.filter(c => c.arms['seq-CRB'].score != null && c.arms['seq-CBR'].score != null);
const crbLoses = crbComp.filter(c => c.arms['seq-CRB'].score < c.arms['seq-CBR'].score - 1);
const crbWinsCells = crbComp.filter(c => c.arms['seq-CRB'].score > c.arms['seq-CBR'].score + 1);
const crbWinsInWidowB20 = crbWinsCells.filter(c => c.dn === 'widow' && c.bf === 0.2).length;
console.log('E-P3 static Roth-early loses to seq-CBR mostly: loses ' + crbLoses.length + '/' +
    crbComp.length + '; its wins ' + crbWinsCells.length + ' (widow+b20 among them: ' +
    crbWinsInWidowB20 + ') -> ' + (crbLoses.length > crbComp.length / 2 ? 'RIGHT' : 'WRONG'));
let pairSame = 0, pairN = 0;
for (const c of cells.filter(c => c.ian === 'ira0')) {
    const twin = cells.find(x => x.ian === 'ira750' && x.dn === c.dn && x.mn === c.mn &&
        x.bf === c.bf && x.sr === c.sr);
    if (!twin) continue;
    const w0 = winnerOf(c), w1 = winnerOf(twin);
    if (!w0 || !w1) continue;
    pairN++; if (w0 === w1) pairSame++;
}
console.log('E-P4 winner same across the IRA axis >=80%: ' + pairSame + '/' + pairN + ' (' +
    (100 * pairSame / Math.max(1, pairN)).toFixed(0) + '%) -> ' +
    (pairSame / Math.max(1, pairN) >= 0.8 ? 'RIGHT' : 'WRONG'));
console.log('E-P5 conversions-on winner identity >=80%: ' + sensSame + '/' + sensN + ' (' +
    (100 * sensSame / Math.max(1, sensN)).toFixed(0) + '%) -> ' +
    (sensSame / Math.max(1, sensN) >= 0.8 ? 'RIGHT' : 'WRONG'));

console.log('\nTotal: ' + SIMS + ' sims, ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log('\nCEILINGS: one deterministic path (6%/2.5%), CA only, one household shape per death');
console.log('profile, aggregate basis (no lots), no SECURE 10-yr heirs, IRC 1014 step-up at both');
console.log('deaths, spend flat, conversions off in primary tables. The ref arm does NOT respect');
console.log('the IRA floor (it is today\'s engine default, shown as the incumbent).');

'use strict';
/**
 * timinggrid_harness.js -- P111a. Does the withdrawal-month / tax-date ranking generalize, or is it
 * a fact about one asset mix and one spending level?
 *
 * Run:  node .test_harnesses/timinggrid_harness.js
 *
 * WHY THIS EXISTS. The P111 grid was first run on the page defaults alone and produced a clean
 * ranking - Always November best, Always January worst, the shipped Automatic 5th of 6. The user
 * stopped it from becoming a prior: "the rank here may only apply to households with this asset mix,
 * and spending. E.g. assuming 'always January' will be worst or 'Always November' is best is not
 * likely to be true universally." That is exactly the shape of claim this repo has had to retract
 * before, so it is measured across a crossed grid instead of generalized from one cell.
 *
 * THE SIX CELLS: forceWithdrawTiming {auto, early, late} x taxSettlement {with the draw, december}.
 *
 * THREE QUESTIONS, and the third is the one a user-facing card would rest on:
 *   Q1. Does Always November always win? Does Always January always lose?
 *   Q2. How large is the spread - is there anything worth cueing at all in each household?
 *   Q3. Do lifetime TAX and net WORTH always rank together? The defaults household had them
 *       perfectly correlated, which is why "minimise lifetime tax" picked the worst plan there. If
 *       any household produces a cell with MORE wealth and LESS tax, that cell is DOMINANT and the
 *       "it is always a trade" framing is wrong.
 *
 * SCORING DISCIPLINE, carried from timingtrigger_harness.js because it earned itself there:
 * a household is scored only when all six cells succeed and deliver the same spend. Cells that
 * disagree about survival are counted and named rather than dropped silently, because an arm that
 * breaks a plan is the strongest thing the grid can find.
 *
 * The IRA Goal is set explicitly and the grid is run at two values (P85: `iraBaseGoal: 0` inherited
 * from another harness against a shipped default of $750,000 broke a 186-of-186 claim).
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const { simulate } = core;

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();

// COMMON, MIXES, WEALTH, SPEND_RATES copied verbatim from timingtrigger_harness.js, which copied
// them from unifiedconv_harness.js. Copy, do not import - the harnesses must not couple.
const COMMON = {
    STATEname: 'CA', nYears: 20,
    birthyear1: 1962, birthmonth1: 6, die1: 92,
    birthyear2: 1964, birthmonth2: 3, die2: 94, hasSpouse: true,
    ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 67,
    pensionAnnual: 0, pensionStartAge: 0, survivorPct: 0, pensionCola: false,
    spendChange: 0, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.06,
    cashYield: 0.03, dividendRate: 0.02,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: true, propWithdraw: 0.10, iraWithdrawPct: 0.06,
    extraConversionAmount: 0, fundConversionWithCash: false,
    startAge: 64, startInYear: 2026, dividendReinvest: true,
    gkGuard: 0.20, gkAdjPct: 0.10, cycleLTCGTarget: 0.15,
    qcdHHMax: 0, qcdMode: 'asneeded', computeOC: false,
};
const MIXES = [
    { key: 'defaults',   over: { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000,
                                 Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 } },
    { key: 'defaults3x', over: { IRA1: 3000000, IRA2: 1200000, Roth: 150000, Roth2: 60000,
                                 Brokerage: 300000, BrokerageBasis: 150000, Cash: 150000 } },
    { key: 'round1',     over: { IRA1: 1800000, IRA2: 700000, Roth: 250000, Roth2: 100000,
                                 Brokerage: 900000, BrokerageBasis: 500000, Cash: 150000 } },
    { key: 'thirds',     over: { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000,
                                 Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 } },
    { key: 'brokheavy',  over: { IRA1: 700000, IRA2: 300000, Roth: 400000, Roth2: 200000,
                                 Brokerage: 2800000, BrokerageBasis: 1200000, Cash: 150000 } },
];
const WEALTH = [0.5, 1, 3];
const SPEND_RATES = [0.04, 0.06, 0.08];
const ACCTS = ['IRA1', 'IRA2', 'Roth', 'Roth2', 'Brokerage', 'BrokerageBasis', 'Cash'];
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

const STRATEGIES = [
    { key: 'bracket22', over: { strategy: 'bracket', stratRate: 0.22 } },
    { key: 'reduce11',  over: { strategy: 'fixed', nYears: 11 } },
    { key: 'iradraw9',  over: { strategy: 'fixedpct', iraWithdrawPct: 0.09 } },
    { key: 'prop10',    over: { strategy: 'propwd', propWithdraw: 0.10 } },
    { key: 'gk',        over: { strategy: 'gk' } },
    { key: 'ordered',   over: { strategy: 'ordered', orderedSeq: 'CIBR' } },
];

const CELLS = [
    { key: 'auto/draw',   fwt: '',      txs: '' },
    { key: 'auto/dec',    fwt: '',      txs: 'december' },
    { key: 'early/draw',  fwt: 'early', txs: '' },
    { key: 'early/dec',   fwt: 'early', txs: 'december' },
    { key: 'late/draw',   fwt: 'late',  txs: '' },
    { key: 'late/dec',    fwt: 'late',  txs: 'december' },
];

function runCell(inputs) {
    let res;
    try { res = simulate(inputs); } catch (e) { return { threw: String((e && e.message) || e) }; }
    const log = res.log || [];
    const last = log[log.length - 1];
    if (!last) return { threw: 'empty log' };
    return {
        nw: last.totalNetWealth / (last.inflationFactor || 1),
        tax: res.totals.tax,
        spend: res.totals.spend,
        success: !!res.totals.success,
    };
}

function run(goal, label) {
    const winners = new Map(), tally = new Map();
    let scored = 0, skipped = 0, survivalSplit = 0;
    let lateEverLoses = 0, earlyEverWins = 0, autoEverWins = 0, dominantCells = 0;
    let rankAgree = 0, rankDisagree = 0;
    const spreads = [], dominantExamples = [], earlyWinExamples = [], flatCells = [];

    for (const mix of MIXES) for (const w of WEALTH) for (const sr of SPEND_RATES) {
        const over = {};
        for (const a of ACCTS) over[a] = (mix.over[a] || 0) * w;
        const spendGoal = totalAssets(over) * sr;
        for (const st of STRATEGIES) {
            const base = { ...COMMON, ...over, ...st.over, iraBaseGoal: goal, spendGoal };
            const id = st.key + '/' + mix.key + '/x' + w + '/' + (sr * 100).toFixed(0) + '%';
            const out = CELLS.map(c => ({ c,
                r: runCell({ ...base, forceWithdrawTiming: c.fwt, taxSettlement: c.txs }) }));
            if (out.some(o => o.r.threw)) { skipped++; continue; }
            if (out.some(o => !o.r.success)) {
                skipped++;
                if (out.some(o => o.r.success)) survivalSplit++;
                continue;
            }
            const s0 = out[0].r.spend;
            if (out.some(o => Math.abs(o.r.spend - s0) > 1)) { skipped++; continue; }
            scored++;

            const byNW = [...out].sort((a, b) => b.r.nw - a.r.nw);
            const best = byNW[0], worst = byNW[byNW.length - 1];
            winners.set(best.c.key, (winners.get(best.c.key) || 0) + 1);
            for (const o of out) {
                if (!tally.has(o.c.key)) tally.set(o.c.key, []);
                tally.get(o.c.key).push(o.r.nw - out[0].r.nw);   // vs auto/draw, the shipped default
            }
            const spread = best.r.nw - worst.r.nw;
            spreads.push(spread / Math.max(1, out[0].r.nw));
            if (spread < 1) flatCells.push(id);

            if (!best.c.key.startsWith('late')) lateEverLoses++;
            if (best.c.key.startsWith('early')) { earlyEverWins++; if (earlyWinExamples.length < 6) earlyWinExamples.push(id + '  -> ' + best.c.key); }
            if (best.c.key.startsWith('auto')) autoEverWins++;

            // Q3: does the wealth-best cell also pay the most tax? If some cell has MORE wealth and
            // LESS tax than another, that cell DOMINATES and "always a trade" is false.
            const byTax = [...out].sort((a, b) => b.r.tax - a.r.tax);
            if (byTax[0].c.key === best.c.key) rankAgree++; else rankDisagree++;
            const dom = out.some(x => out.some(y => x.r.nw > y.r.nw + 1 && x.r.tax < y.r.tax - 1));
            if (dom) { dominantCells++; if (dominantExamples.length < 6) dominantExamples.push(id); }
        }
    }

    const median = xs => { if (!xs.length) return NaN; const s = [...xs].sort((p, q) => p - q);
        const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

    console.log('\n' + '='.repeat(78));
    console.log(label + '   (iraBaseGoal = ' + money(goal) + ')');
    console.log('='.repeat(78));
    console.log('households scored ' + scored + ' | skipped ' + skipped +
                ' (of which the six cells disagreed about SURVIVAL in ' + survivalSplit + ')');

    console.log('\n-- Q1. Which cell wins, and how often? --');
    for (const c of CELLS) {
        const n = winners.get(c.key) || 0;
        console.log('   ' + c.key.padEnd(12) + String(n).padStart(4) + ' wins  (' +
                    (n / Math.max(1, scored) * 100).toFixed(1) + '%)');
    }
    console.log('   "Always November" is NOT best in ' + lateEverLoses + ' of ' + scored + ' households');
    console.log('   "Always January" IS best in     ' + earlyEverWins + ' of ' + scored);
    for (const e of earlyWinExamples) console.log('      ' + e);
    console.log('   the shipped Automatic is best in ' + autoEverWins + ' of ' + scored);

    console.log('\n-- Q2. Is there anything worth cueing? spread best-to-worst, as a share of NW --');
    console.log('   median ' + (median(spreads) * 100).toFixed(2) + '%   ' +
                'flat (under $1) in ' + flatCells.length + ' households');
    console.log('   mean delta vs the shipped default (auto / with the draw):');
    for (const c of CELLS) {
        const v = tally.get(c.key) || [];
        console.log('      ' + c.key.padEnd(12) + ' median ' + money(median(v)).padStart(14));
    }

    console.log('\n-- Q3. Do tax and wealth always rank together? --');
    console.log('   wealth-best cell is ALSO the highest-tax cell: ' + rankAgree + ' of ' + scored +
                '   (they disagree in ' + rankDisagree + ')');
    console.log('   households containing a DOMINANT cell (more wealth AND less tax): ' + dominantCells);
    for (const e of dominantExamples) console.log('      ' + e);
    console.log(dominantCells === 0
        ? '   => no household lets you have more wealth for less tax. "It is always a trade" HOLDS.'
        : '   => "it is always a trade" is FALSE somewhere. The card cannot say tax always rises.');
    return { scored, lateEverLoses, earlyEverWins, autoEverWins, dominantCells, rankDisagree };
}

console.log('P111a -- does the withdrawal-month / tax-date ranking generalize?');
console.log('grid: ' + MIXES.length + ' mixes x ' + WEALTH.length + ' wealth x ' + SPEND_RATES.length +
            ' spend x ' + STRATEGIES.length + ' strategies x ' + CELLS.length + ' cells');
const A = run(750000, 'HEADLINE - shipped IRA Goal default');
const B = run(0, 'ROBUSTNESS - iraBaseGoal 0 (P85)');

console.log('\n' + '='.repeat(78));
console.log('VERDICT');
console.log('='.repeat(78));
for (const [lbl, R] of [['goal 750k', A], ['goal 0', B]]) {
    console.log(lbl.padEnd(12) +
        ' late-not-best ' + R.lateEverLoses + '/' + R.scored +
        ' | early-best ' + R.earlyEverWins +
        ' | auto-best ' + R.autoEverWins +
        ' | dominant cells ' + R.dominantCells +
        ' | tax/wealth rank disagreements ' + R.rankDisagree);
}

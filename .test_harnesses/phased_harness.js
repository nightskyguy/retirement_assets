'use strict';
/**
 * phased_harness.js -- P36 round 1. Do any strategies never win, and where does each family rank?
 *
 * Run:  node .test_harnesses/phased_harness.js
 *
 * Round 1 deliberately differs from the P36 section's full 90-cell design: death timing,
 * deathBasisStepUp and survivorSpendPct are ROUND 2 axes -- they detect nothing until P35's
 * Phased engine ships. Round 1 instead measures the SHIPPED SWEEP AS ENUMERATED: the same
 * ~176 rows buildStrategyFamilies() emits for the Optimizer table (nerdknob configuration,
 * cash clones included), ranked by the same exported rankRowsByObjective() the UI uses, over
 * a crossed 45-cell grid. That answers P36's question B (how many swept variations never
 * produce a top result) against the real sweep rather than a hand-picked arm list.
 *
 * GRID -- crossed, not hand-picked (P28 round 2 confounded mix with strain; round 4 overturned
 * three conclusions once spend became a controlled axis):
 *   mix (5)      P28's ladder copied VERBATIM from unifiedconv_harness.js:79-106 (copy, do not
 *                import -- the harnesses must not couple)
 *   wealth (3)   x0.5 / x1 / x3 on every account balance
 *   spend (3)    4% / 6% / 8% of total assets
 *   = 45 cells x ~176 arms ~ 7,900 sims (computeOC doubles converting rows).
 *
 * SCORING -- the UI's own recipe, reproduced from optimizer_ui.js:560-568 and :981:
 *   sharedRate = cell's first row (Proportional 0%) totals.futureIRARate   [the "auto" path]
 *   afterTaxNW = afterTaxNetWorth(totals.terminal, sharedRate, totals.capGainsRate)
 *   afterTaxNWCurrentDollars = afterTaxNW * (finalNWCurrentDollars / finalNW)
 *   _baselineScore = afterTaxNWCurrentDollars + SPENDABLE_WEIGHT * spendCurrentDollars
 * Rate is shared WITHIN a cell, never across cells; nothing here compares across cells.
 * `conveffect` is OUT OF SCOPE: it reads _convSavings, computed only by the UI table pass,
 * absent from a bare simulate() result. `earliestbe` IS in scope via totals.convBEYear under
 * computeOC:true, with its no-break-even sentinel count reported rather than laundered.
 *
 * FAMILY KEY -- family x modifier class (lin / cyc / cash). Cyclic must be its own dimension:
 * the PF11 failure was cyclic rows crowding out the non-cyclic champion of the same strategy
 * (findings.md). Winner votes are one per cell per objective. Rows failed (totals.success
 * false), bracket-infeasible (>50% overage years, UI rule optimizer_ui.js:739) or
 * ACA-untenable (any breach year, :759) are excluded from votes and family ranks; their
 * counts are reported.
 *
 * FRAMING (as much the deliverable as the numbers): this produces evidence for DEFAULT
 * ORDERING, not for deleting arms. "Arm X seldom wins" is a frequency observation, and
 * frequency shortcuts have failed four times in this repo. The ONLY deletion evidence is the
 * zero test in table 3: an arm byte-identical to another in EVERY cell.
 *
 * ── PREDICTION UNDER TEST, recorded BEFORE the numbers were looked at ───────────────────────
 *   S1-P1. Proportional (lin) lands top-3 family rank on networth AND balanced in >=60% of
 *          cells, but is NOT the #1 family by overall mean rank; Fill Bracket leads
 *          unconstrained cells. (Prior: propwd ranked 6 of 6 in the one measured pool;
 *          P28's 7 exception cells were all Proportional and all high-strain.)
 * Scored at the end of the run.
 */

// ── Bootstrap the engine exactly like brokerage_harness.js / optimizer_core.tests.js ────────
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const {
    simulate, afterTaxNetWorth, SPENDABLE_WEIGHT,
    buildStrategyFamilies, OPTIMIZER_GRIDS, rankRowsByObjective, bothOnMedicareAtStart,
} = core;

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();

// ── Base plan: unifiedconv_harness.js COMMON, copied verbatim ───────────────────────────────
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

// P28 mix ladder, copied verbatim from unifiedconv_harness.js:79-106.
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

const OBJECTIVES = ['taxflex', 'networth', 'widowrmd', 'mintax', 'maxspend', 'maxroth',
                    'balanced', 'earliestbe'];

const modClass = m => m == null ? 'lin' : (m === 'cash' ? 'cash' : 'cyc');
const famKeyOf = f => f.family + '|' + modClass(f.modifier);
const armKeyOf = f => f.family + ' ' + f.paramLabel +
    (f.modifier ? ' [' + (f.modifier === 'cash' ? 'cash' : 'cyc-' + f.modifier.replace('-first', '')) + ']' : '');

// ── Run one cell: enumerate, simulate, score with the UI's recipe ───────────────────────────
function runCell(cellBase) {
    const acaDisabled = bothOnMedicareAtStart(cellBase.birthyear1, cellBase.startAge,
        !!cellBase.hasSpouse, cellBase.hasSpouse ? (cellBase.birthyear2 || 0) : 0);
    const fams = buildStrategyFamilies(cellBase, {
        grids: OPTIMIZER_GRIDS,
        irmaaFamily: true,
        acaFamily: !acaDisabled,
        bracketResetsIRMAATier: true,
        markCashFunding: true,               // nerdknob configuration, same as the shipped table
        cashClones: cellBase.Cash > 0,
        offGridLast: true,
    });
    const rows = [];
    for (const f of fams) {
        const inputs = { ...cellBase, ...f.overrides, computeOC: true };
        let res;
        try { res = simulate(inputs); } catch (e) {
            rows.push({ arm: armKeyOf(f), famKey: famKeyOf(f), family: f.family,
                        mod: modClass(f.modifier), threw: true, totals: { success: false } });
            continue;
        }
        const last = res.log[res.log.length - 1];
        const totalYears = res.log.length;
        const ovYears = res.log.filter(e => (e['BracketOverage'] ?? 0) > 0).length;
        const isBracketInfeasible = f.overrides.strategy === 'bracket' &&
            totalYears > 0 && ovYears / totalYears > 0.5;
        const isACAUntenable = f.overrides.strategy === 'aca' &&
            ((res.totals?.acaBreachYears ?? 0) > 0 || acaDisabled);
        rows.push({
            arm: armKeyOf(f), famKey: famKeyOf(f), family: f.family, mod: modClass(f.modifier),
            totals: res.totals, finalNW: res.finalNW,
            finalNWCurrentDollars: last.totalWealth / (last.inflationFactor || 1),
            _convBEYear: res.totals.convBEYear ?? null,
            flagged: isBracketInfeasible || isACAUntenable,
            isBracketInfeasible, isACAUntenable,
            fp: JSON.stringify([res.finalNW, res.totals.tax, res.totals.spend,
                res.totals.shortfall ?? 0, res.totals.terminal?.ira, res.totals.terminal?.roth,
                res.totals.terminal?.brokerage, res.totals.terminal?.cash,
                res.totals.terminal?.basis]),
        });
    }
    // The UI's "auto" shared heirs rate: the first row is Proportional 0% by enumeration order.
    const sharedRate = cellBase.futureIRATaxRate ?? (rows[0]?.totals?.futureIRARate ?? 0);
    for (const r of rows) {
        if (r.threw || !r.totals?.terminal) continue;
        r.afterTaxNW = afterTaxNetWorth(r.totals.terminal, sharedRate, r.totals.capGainsRate);
        const defl = (r.finalNW && r.finalNW !== 0) ? (r.finalNWCurrentDollars / r.finalNW) : 1;
        r.afterTaxNWCurrentDollars = r.afterTaxNW * defl;
        r._baselineScore = (r.afterTaxNWCurrentDollars ?? 0)
            + SPENDABLE_WEIGHT * (r.totals.spendCurrentDollars ?? 0);
    }
    return { rows, sharedRate };
}

// ── Main sweep ──────────────────────────────────────────────────────────────────────────────
console.log('P36 round 1 -- family-ranking study over the shipped sweep enumeration');
console.log('Grid: 5 mixes x wealth x' + WEALTH.join('/x') + ' x spend ' +
    SPEND_RATES.map(r => (r * 100) + '%').join('/') + ' = 45 cells');
console.log('conveffect objective OUT OF SCOPE: reads _convSavings, which only the UI table pass');
console.log('computes; a bare simulate() result never carries it.\n');

const cells = [];               // { label, rows, sharedRate }
const t0 = Date.now();
for (const mix of MIXES) {
    for (const w of WEALTH) {
        const scaled = {};
        for (const a of ACCTS) scaled[a] = Math.round(mix.over[a] * w);
        for (const sr of SPEND_RATES) {
            const cellBase = { ...COMMON, ...scaled,
                spendGoal: Math.round(totalAssets(scaled) * sr) };
            const label = mix.key + ' x' + w + ' @' + (sr * 100) + '%';
            const { rows, sharedRate } = runCell(cellBase);
            cells.push({ label, mix: mix.key, w, sr, rows, sharedRate });
            process.stdout.write('.');
        }
    }
}
console.log('\n' + cells.length + ' cells, ' + cells[0].rows.length + ' arms each, ' +
    ((Date.now() - t0) / 1000).toFixed(1) + 's\n');

// Eligibility: a row can represent its family / win a vote only if it succeeded and is unflagged.
const eligible = r => !r.threw && r.totals?.success && !r.flagged;

// Per cell per objective: full ranking (the UI's), then family positions among ELIGIBLE rows.
const famKeys = [...new Set(cells[0].rows.map(r => r.famKey))].sort();
const famRankSum = {};   // objective -> famKey -> { sum, n }
const winnerVotes = {};  // objective -> famKey -> votes
const armWins = {};      // armKey -> total wins across all objectives/cells
const top3Cells = { networth: new Set(), balanced: new Set() };  // cells where propwd-lin top-3
let beNullTotal = 0, beRowsTotal = 0;

for (const cell of cells) {
    const elig = cell.rows.filter(eligible);
    beNullTotal += cell.rows.filter(r => !r.threw && r._convBEYear == null).length;
    beRowsTotal += cell.rows.filter(r => !r.threw).length;
    for (const obj of OBJECTIVES) {
        const ordered = rankRowsByObjective(elig, obj, cell.sharedRate);
        // family rank = 1 + number of families whose best row sits earlier in the order
        const seen = new Set();
        const famRank = {};
        for (const r of ordered) {
            if (!seen.has(r.famKey)) { seen.add(r.famKey); famRank[r.famKey] = seen.size; }
        }
        const fr = famRankSum[obj] = famRankSum[obj] || {};
        for (const fk of famKeys) {
            const rank = famRank[fk] ?? (famKeys.length);   // absent family: worst rank
            const e = fr[fk] = fr[fk] || { sum: 0, n: 0 };
            e.sum += rank; e.n++;
        }
        if (ordered.length) {
            const w = ordered[0];
            const wv = winnerVotes[obj] = winnerVotes[obj] || {};
            wv[w.famKey] = (wv[w.famKey] || 0) + 1;
            armWins[w.arm] = (armWins[w.arm] || 0) + 1;
        }
        if ((obj === 'networth' || obj === 'balanced') &&
            (famRank['Proportional|lin'] ?? 99) <= 3) top3Cells[obj].add(cell.label);
    }
}

// ── Table 1: per-objective x per-family MEAN RANK ───────────────────────────────────────────
console.log('='.repeat(110));
console.log('TABLE 1  mean family rank per objective (1 = best; eligible rows only; absent family = worst rank)');
console.log('='.repeat(110));
const hdr = 'family'.padEnd(22) + OBJECTIVES.map(o => o.slice(0, 9).padStart(10)).join('') +
    '   OVERALL';
console.log(hdr);
const overallMean = {};
for (const fk of famKeys) {
    let line = fk.padEnd(22), tot = 0;
    for (const obj of OBJECTIVES) {
        const e = famRankSum[obj][fk];
        const m = e.sum / e.n; tot += m;
        line += m.toFixed(1).padStart(10);
    }
    overallMean[fk] = tot / OBJECTIVES.length;
    console.log(line + overallMean[fk].toFixed(1).padStart(10));
}

// ── Table 2: per-cell winner counts, one vote per cell per objective ────────────────────────
console.log('\n' + '='.repeat(110));
console.log('TABLE 2  winner votes (one per cell per objective; failed/flagged rows cannot win)');
console.log('='.repeat(110));
console.log('family'.padEnd(22) + OBJECTIVES.map(o => o.slice(0, 9).padStart(10)).join('') + '     TOTAL');
for (const fk of famKeys) {
    let line = fk.padEnd(22), tot = 0;
    for (const obj of OBJECTIVES) {
        const v = winnerVotes[obj]?.[fk] || 0; tot += v;
        line += String(v || '').padStart(10);
    }
    if (tot === 0) continue;
    console.log(line + String(tot).padStart(10));
}
// Votes by spend rate -- exposes survivorship: at 8% most fixed-spend arms FAIL and are vote-
// ineligible, so a spend-cutting strategy (GK) can win by being the last one standing.
console.log('\nWinner votes by spend rate (all objectives pooled; top families):');
const votesBySr = {};   // sr -> famKey -> votes
const eligBySr = {};    // sr -> { sum, n } eligible arms per cell
for (const cell of cells) {
    const elig = cell.rows.filter(eligible);
    const e = eligBySr[cell.sr] = eligBySr[cell.sr] || { sum: 0, n: 0 };
    e.sum += elig.length; e.n++;
    for (const obj of OBJECTIVES) {
        const ordered = rankRowsByObjective(elig, obj, cell.sharedRate);
        if (!ordered.length) continue;
        const v = votesBySr[cell.sr] = votesBySr[cell.sr] || {};
        v[ordered[0].famKey] = (v[ordered[0].famKey] || 0) + 1;
    }
}
console.log('spend'.padEnd(8) + 'mean eligible arms/cell'.padStart(24) + '   top families (votes)');
for (const sr of SPEND_RATES) {
    const e = eligBySr[sr];
    const top = Object.entries(votesBySr[sr] || {}).sort((a, b) => b[1] - a[1]).slice(0, 4)
        .map(([f, v]) => f + ' ' + v).join(', ');
    console.log(((sr * 100) + '%').padEnd(8) + (e.sum / e.n).toFixed(0).padStart(24) + '   ' + top);
}

// GK is NOT like-for-like: it moves delivered spend (P28 excluded it for exactly this; the
// production Best table gates it behind gkSpendStable). Quantify the drift so table 1/2 GK
// numbers are read with it in view.
console.log('\nGK delivered-spend drift vs fixed-spend arms (defaults x1 cells):');
console.log('cell'.padEnd(22) + 'GK lin spend'.padStart(14) + 'propwd10 lin spend'.padStart(20) + '   drift');
for (const cell of cells.filter(c => c.mix === 'defaults' && c.w === 1)) {
    const gk = cell.rows.find(r => r.arm.startsWith('Guyton-Klinger') && r.mod === 'lin');
    const pw = cell.rows.find(r => r.arm === 'Proportional 10%');
    if (!gk?.totals || !pw?.totals) continue;
    const g = gk.totals.spendCurrentDollars ?? 0, p = pw.totals.spendCurrentDollars ?? 0;
    console.log(cell.label.padEnd(22) + money(g).padStart(14) + money(p).padStart(20) +
        ((100 * (g - p) / p).toFixed(1) + '%').padStart(9));
}

const famNeverWon = famKeys.filter(fk => !OBJECTIVES.some(o => (winnerVotes[o]?.[fk] || 0) > 0));
console.log('\nFamilies with ZERO votes under every objective: ' +
    (famNeverWon.length ? famNeverWon.join(', ') : 'none'));
console.log('earliestbe coverage: ' + (beRowsTotal - beNullTotal) + '/' + beRowsTotal +
    ' rows carry a break-even year; the rest sort on the 9999 sentinel.');

// Question B, stated as a frequency observation and NOT deletion evidence:
const allArms = [...new Set(cells[0].rows.map(r => r.arm))];
const neverWinArms = allArms.filter(a => !(armWins[a] > 0));
console.log('\nArms never taking rank 1 under any objective in any cell: ' + neverWinArms.length +
    '/' + allArms.length + '  [frequency observation; NOT deletion evidence -- see table 3]');

// ── Table 3: the zero test -- byte-identical money fields, the only deletion evidence ───────
console.log('\n' + '='.repeat(110));
console.log('TABLE 3  zero test: cells where an arm is byte-identical to at least one other arm');
console.log('='.repeat(110));
const dupCells = {};   // armKey -> count
const twinOf = {};     // armKey -> Set of twins seen
for (const cell of cells) {
    const byFp = {};
    for (const r of cell.rows) { if (!r.threw) (byFp[r.fp] = byFp[r.fp] || []).push(r); }
    for (const group of Object.values(byFp)) {
        if (group.length < 2) continue;
        for (const r of group) {
            dupCells[r.arm] = (dupCells[r.arm] || 0) + 1;
            const tw = twinOf[r.arm] = twinOf[r.arm] || new Set();
            for (const o of group) if (o.arm !== r.arm) tw.add(o.arm);
        }
    }
}
const dupArms = Object.entries(dupCells).sort((a, b) => b[1] - a[1]);
const fullDups = dupArms.filter(([, n]) => n === cells.length);
console.log('Arms byte-identical to another arm in ALL ' + cells.length + ' cells (deletion candidates): ' +
    (fullDups.length ? '' : 'none'));
for (const [arm] of fullDups) {
    console.log('  ' + arm.padEnd(40) + ' == ' + [...twinOf[arm]].slice(0, 4).join(', '));
}
const partial = dupArms.filter(([, n]) => n < cells.length && n > 0);
console.log('Arms duplicated in SOME cells (not deletion candidates): ' + partial.length +
    ' of ' + allArms.length + (partial.length ? '; worst 5:' : ''));
for (const [arm, n] of partial.slice(0, 5)) {
    console.log('  ' + arm.padEnd(40) + String(n).padStart(4) + '/' + cells.length);
}

// ── Row-health accounting (context for every table above) ───────────────────────────────────
let nFail = 0, nBracketInf = 0, nACAUnt = 0, nThrew = 0, nRows = 0;
for (const cell of cells) for (const r of cell.rows) {
    nRows++;
    if (r.threw) { nThrew++; continue; }
    if (!r.totals?.success) nFail++;
    if (r.isBracketInfeasible) nBracketInf++;
    if (r.isACAUntenable) nACAUnt++;
}
console.log('\nRow health: ' + nRows + ' rows; failed ' + nFail + ', bracket-infeasible ' +
    nBracketInf + ', ACA-untenable ' + nACAUnt + ', threw ' + nThrew + '.');

// ── Prediction scoring ──────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(110));
console.log('PREDICTION SCORING  (S1-P1, recorded before the run)');
console.log('='.repeat(110));
const p1a_nw = top3Cells.networth.size / cells.length;
const p1a_bal = top3Cells.balanced.size / cells.length;
const leader = famKeys.reduce((a, b) => overallMean[a] <= overallMean[b] ? a : b);
const p1a = p1a_nw >= 0.6 && p1a_bal >= 0.6;
const p1b = leader !== 'Proportional|lin';
console.log('S1-P1a propwd(lin) top-3 on networth in ' + (100 * p1a_nw).toFixed(0) +
    '% / balanced in ' + (100 * p1a_bal).toFixed(0) + '% of cells (need >=60% both) -> ' +
    (p1a ? 'RIGHT' : 'WRONG'));
console.log('S1-P1b #1 family by overall mean rank = ' + leader + ' (predicted NOT Proportional|lin) -> ' +
    (p1b ? 'RIGHT' : 'WRONG'));
console.log('');

// ════════════════════════════════════════════════════════════════════════════════════════════
// BASIS-AXIS EXTENSION (2026-08-10, user request): the main grid holds basis/Brokerage at the
// mix defaults (43-56%). Rebuild the 45 cells at basis = 20% (highly appreciated) and 80%
// (mostly fresh contributions) and check whether the RANKING conclusions travel.
//
// PREDICTION (B-P5), recorded before the numbers were looked at:
//   B-P5. The ranking conclusions are basis-stable: the #1 famKey by overall mean rank and the
//         zero-vote families (ACA Cliff) are UNCHANGED at 20% and 80% basis, and Proportional
//         still never reaches top-3 on networth/balanced in any cell.
// ════════════════════════════════════════════════════════════════════════════════════════════
function buildCellsAtBasis(frac) {
    const out = [];
    for (const mix of MIXES) {
        for (const w of WEALTH) {
            const scaled = {};
            for (const a of ACCTS) scaled[a] = Math.round(mix.over[a] * w);
            scaled.BrokerageBasis = Math.round(scaled.Brokerage * frac);
            for (const sr of SPEND_RATES) {
                const cellBase = { ...COMMON, ...scaled,
                    spendGoal: Math.round(totalAssets(scaled) * sr) };
                const { rows, sharedRate } = runCell(cellBase);
                out.push({ label: mix.key + ' x' + w + ' @' + (sr * 100) + '% b' + (frac * 100),
                           mix: mix.key, w, sr, rows, sharedRate });
                process.stdout.write('.');
            }
        }
    }
    console.log('');
    return out;
}
function summarizeBasis(cellsB, label) {
    const fr = {}, votes = {};
    const top3 = { networth: 0, balanced: 0 };
    for (const cell of cellsB) {
        const elig = cell.rows.filter(eligible);
        for (const obj of OBJECTIVES) {
            const ordered = rankRowsByObjective(elig, obj, cell.sharedRate);
            const seen = new Set(); const famRank = {};
            for (const r of ordered) {
                if (!seen.has(r.famKey)) { seen.add(r.famKey); famRank[r.famKey] = seen.size; }
            }
            for (const fk of famKeys) {
                const e = fr[fk] = fr[fk] || { sum: 0, n: 0 };
                e.sum += famRank[fk] ?? famKeys.length; e.n++;
            }
            if (ordered.length) votes[ordered[0].famKey] = (votes[ordered[0].famKey] || 0) + 1;
            if ((obj === 'networth' || obj === 'balanced') &&
                (famRank['Proportional|lin'] ?? 99) <= 3) top3[obj]++;
        }
    }
    const mean = {};
    for (const fk of famKeys) mean[fk] = fr[fk].sum / fr[fk].n;
    const leader = famKeys.reduce((a, b) => mean[a] <= mean[b] ? a : b);
    const zeroVote = famKeys.filter(fk => !(votes[fk] > 0));
    console.log('\n' + label + ':  leader ' + leader + ' (mean ' + mean[leader].toFixed(1) + ')' +
        ';  propwd|lin mean ' + mean['Proportional|lin'].toFixed(1) +
        ', top-3 cells networth/balanced ' + top3.networth + '/' + top3.balanced +
        ';  zero-vote: ' + (zeroVote.length ? zeroVote.join(', ') : 'none'));
    const top5 = Object.entries(votes).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([f, v]) => f + ' ' + v).join(', ');
    console.log('  top vote-getters: ' + top5);
    return { leader, zeroVote, top3, mean };
}

console.log('='.repeat(110));
console.log('BASIS-AXIS SENSITIVITY  (basis/Brokerage 20% and 80% vs the mix defaults 43-56%)');
console.log('='.repeat(110));
const sumDefault = { leader, zeroVote: famNeverWon,
    top3: { networth: top3Cells.networth.size, balanced: top3Cells.balanced.size } };
console.log('\nmix-default basis (the tables above):  leader ' + leader +
    ';  propwd top-3 networth/balanced ' + top3Cells.networth.size + '/' + top3Cells.balanced.size +
    ';  zero-vote: ' + (famNeverWon.length ? famNeverWon.join(', ') : 'none'));
const cellsB20 = buildCellsAtBasis(0.2);
const s20 = summarizeBasis(cellsB20, 'basis 20% (highly appreciated)');
const cellsB80 = buildCellsAtBasis(0.8);
const s80 = summarizeBasis(cellsB80, 'basis 80% (mostly contributions)');
const bp5 = s20.leader === leader && s80.leader === leader &&
    s20.top3.networth === 0 && s20.top3.balanced === 0 &&
    s80.top3.networth === 0 && s80.top3.balanced === 0 &&
    s20.zeroVote.some(f => f.startsWith('ACA')) && s80.zeroVote.some(f => f.startsWith('ACA'));
console.log('\nB-P5 rankings basis-stable (same leader, ACA still zero-vote, propwd still never top-3): ' +
    (bp5 ? 'RIGHT' : 'WRONG'));

console.log('');
console.log('CEILINGS bounding every number above: aggregate basis (no lot selection), one-sided');
console.log('ACA pricing, deterministic single return path, no SECURE 10-yr heir modeling, IRC 1014');
console.log('step-up at terminal row. CA only, one age/SS profile, CashReserve off.');

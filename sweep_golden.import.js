'use strict';
/**
 * sweep_golden.import.js — folds a browser capture of the Optimizer's strategy enumeration into
 * the OPT_GOLDEN block of sweep_golden.js.
 *
 *   node sweep_golden.import.js <dir-with-captures>
 *
 * The Optimizer's enumeration is built inline inside `_runOptimizerNow()` (optimizer_ui.js). It is
 * not exported and never runs in node, so unlike the MC half it cannot be regenerated from source
 * — it has to be RECORDED from a live page. That is what this imports.
 *
 * ── Capture recipe ────────────────────────────────────────────────────────────────────────────
 * Serve the repo (the project preview config does this) and open retirement_optimizer.html. In the
 * page console, define the poster once:
 *
 *   window.__send = (name) => {
 *     const e = OptimizerState.lastEnumeration;                     // set at the end of the sweep
 *     const o = { name, nerdKnobs: e.nerdKnobs, base: e.base,
 *       rows: e.rows.map(r => [r.strategyLabel, r.paramLabel, r.paramSortVal, r.overrides]) };
 *     return fetch('http://localhost:8769/' + name, { method: 'POST',
 *       headers: {'Content-Type':'application/json'}, body: JSON.stringify(o) }).then(r => r.status);
 *   };
 *
 * ...pointed at any local sink that writes the POST body to <name>.json, then run the four
 * scenarios below. Each needs its own page state, and the ORDER matters for one reason only:
 * `_runOptimizerNow()` early-returns from a cache keyed on JSON.stringify(base), and NERD_KNOBS is
 * NOT part of that key. So flipping the nerdknob alone will hand back the cached table and leave a
 * stale capture. Reload the page for the nerdknob change; change a sidebar field for the rest.
 *
 *   default                 plain load, no ?nerdknob            _runOptimizerNow(); __send('default')
 *   nerdknob                reload with ?nerdknob               same, __send('nerdknob')
 *   nerdknobACA             startAge 60, birthyear2 1962        so bothOnMedicareAtStart() is false
 *   nerdknobNoCashOffGrid   Cash 0, strategy fixedpct, 9%       DisplayHelpers.setDollarValue('Cash', 0)
 *
 * Between them these open and close every gate the enumeration has: NERD_KNOBS (the 💵 clones and
 * the ACA family), bothOnMedicareAtStart (the ACA family again, independently), base.Cash > 0 (the
 * 💵 clones again, independently) and offGridParamFor (one extra row). The stock scenario has BOTH
 * people on Medicare at start, so `nerdknob` alone never produces an ACA row — hence the third.
 */

const fs = require('fs');
const path = require('path');

const SCENARIOS = ['default', 'nerdknob', 'nerdknobACA', 'nerdknobNoCashOffGrid'];
const CLONE = /🗘|🔄|💵/;

const dir = process.argv[2];
if (!dir) {
    console.error('usage: node sweep_golden.import.js <dir-with-captures>');
    process.exit(1);
}

const golden = {};
for (const name of SCENARIOS) {
    const file = path.join(dir, name + '.json');
    if (!fs.existsSync(file)) {
        console.error(`missing capture: ${file} — see the recipe at the top of this file.`);
        process.exit(1);
    }
    const cap = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (cap.name !== name) {
        console.error(`${file}: captured under the name "${cap.name}" — refusing to file it as "${name}".`);
        process.exit(1);
    }
    golden[name] = {
        nerdKnobs: cap.nerdKnobs,
        base: cap.base,
        rowCount: cap.rows.length,
        baseRowCount: cap.rows.filter(r => !CLONE.test(r[0])).length,
        rows: cap.rows,
    };
}

const START = '// >>> OPT_GOLDEN IMPORTED by sweep_golden.import.js — do not hand-edit';
const END   = '// <<< OPT_GOLDEN IMPORTED';

// One row per line: a deliberate enumeration change should read as a handful of added or removed
// arms, not as a reflowed 3,000-line block.
function fmt(g) {
    const q = JSON.stringify;
    const parts = Object.entries(g).map(([name, e]) => [
        `    ${q(name)}: {`,
        `        nerdKnobs: ${e.nerdKnobs},`,
        `        rowCount: ${e.rowCount},`,
        `        baseRowCount: ${e.baseRowCount},`,
        `        base: ${JSON.stringify(e.base, null, 4).split('\n').join('\n        ')},`,
        `        rows: [`,
        ...e.rows.map(r => `            [${q(r[0])}, ${q(r[1])}, ${q(r[2])}, ${q(r[3])}],`),
        `        ],`,
        `    },`,
    ].join('\n'));
    return `{\n${parts.join('\n')}\n}`;
}

const file = path.join(__dirname, 'sweep_golden.js');
const src  = fs.readFileSync(file, 'utf8');
const i = src.indexOf(START), j = src.indexOf(END);
if (i < 0 || j < 0 || j < i) {
    console.error('sweep_golden.js: IMPORTED markers not found — refusing to write.');
    process.exit(1);
}

fs.writeFileSync(file, src.slice(0, i) + `${START}\nconst OPT_GOLDEN = ${fmt(golden)};\n` + src.slice(j), 'utf8');

console.log(`sweep_golden.js OPT_GOLDEN rewritten from ${dir}:`);
for (const [k, g] of Object.entries(golden))
    console.log(`  ${k}: ${g.rowCount} rows (${g.baseRowCount} base), nerdKnobs=${g.nerdKnobs}`);

#!/usr/bin/env node
'use strict';
// check-pins.js - compare the test counts the pre-commit hook just measured with the two places
// that pin them: TestTiers.EXPECTED in optimizer_tests.js (the Optimizer's self-check badge turns
// red on any difference) and the suite table in .githooks/README.md. The hook passes one
// name=count argument per suite, the name being the file name without .tests.js:
//
//     node .githooks/check-pins.js optimizer_core=518 taxengine=33 taxPaymentPlanner=61 ...
//
// slowInCore is counted here, from the test.slow( registrations in optimizer_core.tests.js.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const measured = Object.fromEntries(process.argv.slice(2).map(arg => {
    const [name, n] = arg.split('=');
    return [name, Number(n)];
}));
measured.slowInCore = (read('optimizer_core.tests.js').match(/^test\.slow\(/gm) || []).length;

const pin = read('optimizer_tests.js').match(/EXPECTED:\s*\{([^}]*)\}/);
if (!pin) {
    console.log('check-pins: BLOCKED - TestTiers.EXPECTED was not found in optimizer_tests.js.');
    process.exit(1);
}
const expected = Object.fromEntries(pin[1].split(',').map(kv => kv.split(':').map(s => s.trim()))
    .filter(([k]) => k).map(([k, v]) => [k, Number(v)]));
// README rows look like: | `optimizer_core.tests.js` | 518 | 14 s |
const table = Object.fromEntries([...read('.githooks/README.md').matchAll(/^\| `(\w+)\.tests\.js` \| (\d+) \|/gm)]
    .map(m => [m[1], Number(m[2])]));

const drift = [];
for (const name of new Set([...Object.keys(measured), ...Object.keys(expected)])) {
    if (!(name in measured)) drift.push(`${name}: pinned in TestTiers.EXPECTED, but no suite reported it`);
    else if (!(name in expected)) drift.push(`${name}: ${measured[name]} tests, missing from TestTiers.EXPECTED`);
    else if (measured[name] !== expected[name]) drift.push(`${name}: ${measured[name]} tests, TestTiers.EXPECTED says ${expected[name]}`);
}
for (const [name, n] of Object.entries(measured)) {
    if (name === 'slowInCore') continue;
    if (!(name in table)) drift.push(`${name}: no row in the .githooks/README.md suite table`);
    else if (table[name] !== n) drift.push(`${name}: ${n} tests, the .githooks/README.md table says ${table[name]}`);
}

if (drift.length) {
    console.log('check-pins: BLOCKED - the pinned test counts are out of date:');
    for (const d of drift) console.log(`            ${d}`);
    console.log('            Update TestTiers.EXPECTED in optimizer_tests.js and the table in .githooks/README.md.');
    process.exit(1);
}
console.log(`check-pins: TestTiers.EXPECTED and the README table match all ${Object.keys(measured).length - 1} suites and the ${measured.slowInCore} slow tests.`);

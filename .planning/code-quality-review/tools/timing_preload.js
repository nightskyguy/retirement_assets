'use strict';
// node -r ./timing_preload.js <suite>: records wall time between consecutive test result lines and
// writes them to the file named by env TIMING_OUT as TSV (ms, status, name).
const fs = require('fs');
const out = process.env.TIMING_OUT;
const rows = [];
let last = process.hrtime.bigint();
const realLog = console.log;
const PASS = String.fromCharCode(0x2713), FAIL = String.fromCharCode(0x2717);
console.log = function (...args) {
    const s = String(args[0] === undefined ? '' : args[0]);
    const m = /^\s*([^\sA-Za-z0-9])\s+(.*)$/.exec(s);
    if (m && (m[1] === PASS || m[1] === FAIL)) {
        const now = process.hrtime.bigint();
        rows.push([(Number(now - last) / 1e6).toFixed(1), m[1] === PASS ? 'pass' : 'FAIL', m[2]]);
        last = now;
    }
    return realLog.apply(console, args);
};
process.on('exit', () => {
    if (out) fs.writeFileSync(out, rows.map(r => r.join('\t')).join('\n') + '\n');
});

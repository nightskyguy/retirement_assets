'use strict';
// Splices the generated pieces into the report body.  node assemble.js <scratchpad> <out.md>
const fs = require('fs'), path = require('path');
const SP = process.argv[2], OUT = process.argv[3];
const rd = f => fs.existsSync(path.join(SP, 'out', f)) ? fs.readFileSync(path.join(SP, 'out', f), 'utf8') : `(missing ${f})`;
let body = rd('REPORT_BODY.md');
body = body.replace('<<TESTS>>', rd('TESTS_INTRO.md') + '\n' + rd('tests_mut.md') + '\n' + rd('TESTS_CLOSE.md'));
body = body.replace('<<UK_TABLES>>', rd('uk_tables.md'));
body = body.replace('<<PLAN>>', rd('PLAN.md'));
body = body.replace('<<ESSAYS>>', rd('essays.md'));
fs.writeFileSync(OUT, body);
const left = (body.match(/<<[A-Z_]+>>/g) || []);
console.log('written', OUT, body.length, 'chars,', body.split('\n').length, 'lines; unresolved placeholders:', left.join(',') || 'none');

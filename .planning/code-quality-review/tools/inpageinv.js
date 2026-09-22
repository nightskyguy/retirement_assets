'use strict';
// Inventory of the in-page suite (optimizer_tests.js): every assertEqual(actual, expected, name) call,
// the first function called inside `actual`, whether the expected value is a literal, and whether the
// enclosing block touches the DOM. node inpageinv.js <repoRoot> <outJson>
const fs = require('fs'), path = require('path');
const { lex, lineIndex } = require('./jslex.js');
const root = process.argv[2], out = process.argv[3];
const rel = 'optimizer_tests.js';
const src = fs.readFileSync(path.join(root, rel), 'utf8');
const li = lineIndex(src);
const sig = lex(src, 0).filter(t => t.type !== 'line_comment' && t.type !== 'block_comment');
const match = new Map(); const st = [];
sig.forEach((t, k) => {
    if (t.type !== 'punct' || t.value.length !== 1) return;
    if ('([{'.includes(t.value)) st.push(k); else if (')]}'.includes(t.value)) { const o = st.pop(); if (o !== undefined) match.set(o, k); }
});
const DOM = /^(document|window|getElementById|querySelector|querySelectorAll|DisplayHelpers|localStorage|location|getInputs|applyScenario|runSimulation|runOptimizer|OptimizerState|RailsState|NERD_KNOBS|loadFromURL|buildShareURL|captureDefaults|Chart)$/;
const recs = [];
for (let k = 0; k < sig.length; k++) {
    if (sig[k].type !== 'ident' || sig[k].value !== 'assertEqual' || !sig[k + 1] || sig[k + 1].value !== '(' || !match.has(k + 1)) continue;
    if (sig[k - 1] && sig[k - 1].value === 'function') continue;
    const open = k + 1, close = match.get(open);
    // split top-level args
    const args = []; let depth = 0, cur = [];
    for (let j = open + 1; j < close; j++) {
        const t = sig[j];
        if (t.type === 'punct' && t.value.length === 1 && '([{'.includes(t.value)) depth++;
        if (t.type === 'punct' && t.value.length === 1 && ')]}'.includes(t.value)) depth--;
        if (depth === 0 && t.type === 'punct' && t.value === ',') { args.push(cur); cur = []; } else cur.push(t);
    }
    args.push(cur);
    const actual = args[0] || [], expected = args[1] || [], nameArg = args[2] || [];
    let fn = '(expr)';
    for (let j = 0; j < actual.length - 1; j++) if (actual[j].type === 'ident' && actual[j + 1].value === '(' && !/^(Math|JSON|Object|Array|Number|String|Boolean|parseFloat|parseInt|round|abs|keys|map|filter|some|every|includes|toFixed)$/.test(actual[j].value)) { fn = actual[j].value; break; }
    const expLits = expected.filter(t => t.type === 'num' || t.type === 'string').length;
    const expIdents = expected.filter(t => t.type === 'ident' && !/^(true|false|null|undefined|NaN|Infinity)$/.test(t.value)).length;
    const expKind = expIdents === 0 ? (expected.length > 12 ? 'literal-object' : 'literal') : 'computed';
    const name = nameArg.filter(t => t.type === 'string' || t.type === 'template').map(t => t.value.replace(/^['"`]|['"`]$/g, '')).join('');
    const touchesDom = actual.concat(expected).some(t => t.type === 'ident' && DOM.test(t.value));
    recs.push({ line: li.lineOf(sig[k].start), endLine: li.lineOf(sig[close].end), fn, expKind, expTokens: expected.length, touchesDom, name: name.slice(0, 110) });
}
fs.writeFileSync(out, JSON.stringify(recs, null, 1));
const byFn = {};
for (const r of recs) { const b = byFn[r.fn] = byFn[r.fn] || { n: 0, literal: 0, literalObject: 0, computed: 0, dom: 0, first: r.line, last: r.line }; b.n++; b.last = r.line; if (r.expKind === 'literal') b.literal++; else if (r.expKind === 'literal-object') b.literalObject++; else b.computed++; if (r.touchesDom) b.dom++; }
console.log('assertEqual call sites:', recs.length);
console.log(Object.entries(byFn).sort((a, b) => b[1].n - a[1].n).map(([f, b]) => `${String(b.n).padStart(4)}  ${f.padEnd(34)} lit=${b.literal} litObj=${b.literalObject} computed=${b.computed} dom=${b.dom}  L${b.first}-${b.last}`).join('\n'));

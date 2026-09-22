'use strict';
// Test inventory for the node suites: one record per test() with size and mechanical signals.
// node testinv.js <repoRoot> <outJson> <suite>...
const fs = require('fs'), path = require('path');
const { lex, lineIndex } = require('./jslex.js');
const root = process.argv[2], out = process.argv[3], suites = process.argv.slice(4);

function unquote(tok) {
    const v = tok.value;
    if (tok.type === 'string') { try { return Function('"use strict"; return (' + v + ')')(); } catch (e) { return v.slice(1, -1); } }
    if (tok.type === 'template') return v.replace(/^`|`$/g, '');
    return v;
}

const all = [];
for (const rel of suites) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    const li = lineIndex(src);
    const toks = lex(src, 0);
    const sig = toks.filter(t => t.type !== 'line_comment' && t.type !== 'block_comment');
    const comments = toks.filter(t => t.type === 'line_comment' || t.type === 'block_comment');
    const match = new Map(); const st = [];
    sig.forEach((t, k) => {
        if (t.type !== 'punct') return;
        if ('([{'.includes(t.value) && t.value.length === 1) st.push(k);
        else if (')]}'.includes(t.value) && t.value.length === 1) { const o = st.pop(); if (o !== undefined) match.set(o, k); }
    });
    for (let k = 0; k < sig.length; k++) {
        const t = sig[k];
        if (t.type !== 'ident' || t.value !== 'test') continue;
        if (sig[k - 1] && (sig[k - 1].value === '.' || sig[k - 1].value === 'function')) continue;
        let j = k + 1, tag = '';
        if (sig[j] && sig[j].value === '.' && sig[j + 1] && /^(slow|critical)$/.test(sig[j + 1].value)) { tag = sig[j + 1].value; j += 2; }
        if (!sig[j] || sig[j].value !== '(' || !match.has(j)) continue;
        const nameTok = sig[j + 1];
        if (!nameTok || (nameTok.type !== 'string' && nameTok.type !== 'template')) continue;
        const close = match.get(j);
        const body = sig.slice(j + 1, close);
        const start = li.lineOf(t.start), end = li.lineOf(sig[close].end);
        const bodySrc = src.slice(sig[j].start, sig[close].end);
        const cLines = comments.filter(c => c.start > t.start && c.end < sig[close].end)
            .reduce((n, c) => n + (li.lineOf(Math.max(c.start, c.end - 1)) - li.lineOf(c.start) + 1), 0);
        const idents = body.filter(x => x.type === 'ident').map(x => x.value);
        const count = name => idents.filter(v => v === name).length;
        const nums = body.filter(x => x.type === 'num').map(x => x.value.replace(/_/g, ''));
        // "golden-looking" literals: >= 4 significant digits and not a round number / year
        const golden = nums.filter(v => {
            const d = v.replace(/^0\./, '').replace(/[.eE+-]/g, '').replace(/^0+/, '');
            const n = Number(v);
            if (!isFinite(n)) return false;
            if (Number.isInteger(n) && n >= 1900 && n <= 2100) return false;
            const sigd = d.replace(/0+$/, '').length;
            return sigd >= 4;
        });
        all.push({
            suite: rel, name: unquote(nameTok), tag, start, end, lines: end - start + 1, commentLines: cLines,
            asserts: count('assert') + count('assertNear') + count('assertEq') + count('eq') + count('assertEqual') + count('deepEq') + count('ok') + count('throws') + count('assertThrows'),
            assertNear: count('assertNear'),
            simulateCalls: count('simulate'), calcTaxCalls: count('calculateTaxes'),
            readsSource: /readFileSync|readdirSync/.test(bodySrc),
            usesJSONStringify: count('stringify') > 0,
            typeofChecks: count('typeof'),
            earlyReturn: /if \(![\w.]+\) return;|if \(!IS_NODE\) return;/.test(bodySrc),
            nums: nums.length, goldenNums: golden.length,
            loops: count('for') + count('forEach') + count('every') + count('some'),
        });
    }
}
fs.writeFileSync(out, JSON.stringify(all, null, 1));
const by = {};
for (const t of all) { by[t.suite] = by[t.suite] || { n: 0, lines: 0, golden: 0, src: 0, zeroAssert: 0 }; const b = by[t.suite]; b.n++; b.lines += t.lines; if (t.goldenNums >= 3) b.golden++; if (t.readsSource) b.src++; if (!t.asserts) b.zeroAssert++; }
console.log(JSON.stringify(by, null, 1));

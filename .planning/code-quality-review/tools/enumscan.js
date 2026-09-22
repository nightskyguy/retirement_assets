'use strict';
// Magic-string inventory: string literals used in comparisons (===, !==, ==, !=, case, .includes([...]))
// node enumscan.js <repoRoot> <outTsv> <file>...
const fs = require('fs'), path = require('path');
const { lex, inlineScripts, lineIndex } = require('./jslex.js');
const root = process.argv[2], out = process.argv[3], files = process.argv.slice(4);
const CMP = new Set(['===', '!==', '==', '!=']);
const hits = new Map(); // value -> {n, files:Map(file->count), lines:[]}
for (const rel of files) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    const li = lineIndex(src);
    const blocks = /\.html?$/i.test(rel) ? inlineScripts(src) : [{ start: 0, end: src.length }];
    for (const b of blocks) {
        const sig = lex(src.slice(b.start, b.end), b.start).filter(t => t.type !== 'line_comment' && t.type !== 'block_comment');
        for (let k = 0; k < sig.length; k++) {
            const t = sig[k];
            if (t.type !== 'string') continue;
            const prev = sig[k - 1], next = sig[k + 1];
            const isCmp = (prev && prev.type === 'punct' && CMP.has(prev.value)) || (next && next.type === 'punct' && CMP.has(next.value)) || (prev && prev.type === 'ident' && prev.value === 'case');
            if (!isCmp) continue;
            const v = t.value.slice(1, -1);
            if (!v || v.length > 40) continue;
            // skip typeof comparisons
            if (/^(undefined|function|string|number|object|boolean|symbol)$/.test(v)) continue;
            if (!hits.has(v)) hits.set(v, { n: 0, files: new Map(), lines: [] });
            const h = hits.get(v); h.n++; h.files.set(rel, (h.files.get(rel) || 0) + 1);
            if (h.lines.length < 6) h.lines.push(rel + ':' + li.lineOf(t.start));
        }
    }
}
const rows = [['value', 'comparisons', 'files', 'per_file', 'examples'].join('\t')];
[...hits.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([v, h]) => {
    rows.push([JSON.stringify(v), h.n, h.files.size, [...h.files.entries()].map(([f, c]) => f + '=' + c).join(' '), h.lines.join(' ')].join('\t'));
});
fs.writeFileSync(out, rows.join('\n') + '\n');
console.log('distinct compared strings', hits.size, 'total comparisons', [...hits.values()].reduce((s, h) => s + h.n, 0));

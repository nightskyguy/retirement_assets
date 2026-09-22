'use strict';
// Function-level duplication: names defined in more than one place, with body similarity, plus
// functions that are never referenced anywhere else (dead-code candidates).
// node fndups.js <repoRoot> <outJson> <file>...
const fs = require('fs'), path = require('path');
const { lex, inlineScripts, lineIndex } = require('./jslex.js');
const { functionRanges } = require('./mutsites.js');
const root = process.argv[2], out = process.argv[3], files = process.argv.slice(4);

const defs = [];            // {file, name, start, end, lines, norm, tokens}
const identCount = new Map();   // name -> total ident occurrences across all files (code + strings in html attrs)
const htmlText = [];
for (const rel of files) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    const li = lineIndex(src);
    const isHtml = /\.html?$/i.test(rel);
    if (isHtml) htmlText.push(src);
    const blocks = isHtml ? inlineScripts(src) : [{ start: 0, end: src.length }];
    for (const b of blocks) {
        const body = src.slice(b.start, b.end);
        const sig = lex(body, 0).filter(t => t.type !== 'line_comment' && t.type !== 'block_comment');
        for (const t of sig) {
            if (t.type === 'ident') identCount.set(t.value, (identCount.get(t.value) || 0) + 1);
            else if (t.type === 'string' || t.type === 'template') for (const w of t.value.match(/[A-Za-z_$][\w$]*/g) || []) identCount.set(w, (identCount.get(w) || 0) + 0.001);
        }
        const { ranges } = functionRanges(sig);
        for (const r of ranges) {
            const toks = sig.slice(r.startTok, r.endTok + 1);
            const norm = toks.map(t => t.type === 'string' ? 'S' : t.value).join(' ');
            const abs = toks.map(t => t.type === 'ident' ? '$' : t.type === 'num' ? '#' : t.type === 'string' ? 'S' : t.value).join(' ');
            defs.push({ file: rel, name: r.name, start: li.lineOf(b.start + r.start), end: li.lineOf(b.start + r.end), tokens: toks.length, norm, abs });
        }
    }
}
// inline handler references in HTML attributes count as uses
const attrUse = new Map();
for (const h of htmlText) for (const m of h.matchAll(/\bon\w+\s*=\s*"([^"]*)"/g)) for (const w of m[1].match(/[A-Za-z_$][\w$]*/g) || []) attrUse.set(w, (attrUse.get(w) || 0) + 1);

function similarity(a, b) {
    const A = a.split(' '), B = b.split(' ');
    const bag = new Map(); for (const x of A) bag.set(x, (bag.get(x) || 0) + 1);
    let common = 0; for (const x of B) { const c = bag.get(x) || 0; if (c > 0) { common++; bag.set(x, c - 1); } }
    return 2 * common / (A.length + B.length);
}

const byName = new Map();
for (const d of defs) { if (!byName.has(d.name)) byName.set(d.name, []); byName.get(d.name).push(d); }
const sameName = [];
for (const [name, list] of byName) {
    if (list.length < 2) continue;
    const big = list.filter(d => d.tokens >= 25);
    if (big.length < 2) continue;
    const pairs = [];
    for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) pairs.push({ a: big[i].file + ':' + big[i].start + '-' + big[i].end, b: big[j].file + ':' + big[j].start + '-' + big[j].end, sim: +similarity(big[i].norm, big[j].norm).toFixed(2), tokens: [big[i].tokens, big[j].tokens] });
    sameName.push({ name, copies: big.length, pairs });
}
sameName.sort((x, y) => y.copies - x.copies);

// different names, near-identical abstract bodies (>= 60 tokens)
const bigDefs = defs.filter(d => d.tokens >= 60);
const twins = [];
const seen = new Map();
for (const d of bigDefs) { const k = d.abs; if (!seen.has(k)) seen.set(k, []); seen.get(k).push(d); }
for (const list of seen.values()) if (list.length > 1 && new Set(list.map(d => d.file + d.start)).size > 1) twins.push(list.map(d => `${d.name} ${d.file}:${d.start}-${d.end} (${d.tokens}t)`));

// never-referenced function names (defined once, ident appears exactly once = the definition)
const unref = [];
for (const d of defs) {
    const c = Math.floor(identCount.get(d.name) || 0);
    const strUse = ((identCount.get(d.name) || 0) % 1) > 0.0005;
    if (c <= 1 && !attrUse.get(d.name) && !strUse && d.tokens >= 15 && !/^(_|on[A-Z])/.test(d.name)) unref.push(`${d.name} ${d.file}:${d.start}-${d.end} (${d.end - d.start + 1} lines)`);
}
fs.writeFileSync(out, JSON.stringify({ sameName, twins, unref }, null, 1));
console.log('function defs', defs.length, '| same-name groups', sameName.length, '| identical-shape twins', twins.length, '| unreferenced', unref.length);

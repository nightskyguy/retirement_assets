'use strict';
// Clone detector. node clones.js <repoRoot> <outJson> <mode:exact|abstract> <window> <minUnits> <file>...
// exact    : comment-stripped, whitespace-normalized lines must match
// abstract : identifiers -> $, numbers -> #, strings -> S (renamed-variable clones)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { lex, inlineScripts, lineIndex } = require('./jslex.js');

const [root, outJson, mode, Wstr, minStr] = process.argv.slice(2, 7);
const W = Number(Wstr), MIN = Number(minStr);
const files = process.argv.slice(7);
const KEYWORDS = new Set(('break case catch class const continue debugger default delete do else export extends finally for function if import in ' +
    'instanceof new return super switch this throw try typeof var void while with yield let static async await of null undefined true false').split(' '));

function unitsFor(rel, src) {
    const li = lineIndex(src);
    const isHtml = /\.html?$/i.test(rel);
    const isCss = /\.css$/i.test(rel);
    const nLines = li.starts.length;
    const lineToks = new Map();
    const scriptLines = new Set();
    if (!isCss) {
        const blocks = isHtml ? inlineScripts(src) : [{ start: 0, end: src.length }];
        for (const b of blocks) {
            for (let l = li.lineOf(b.start); l <= li.lineOf(Math.max(b.start, b.end - 1)); l++) scriptLines.add(l);
            for (const t of lex(src.slice(b.start, b.end), b.start)) {
                if (t.type === 'line_comment' || t.type === 'block_comment') continue;
                const l0 = li.lineOf(t.start), l1 = li.lineOf(Math.max(t.start, t.end - 1));
                if (l0 === l1) { if (!lineToks.has(l0)) lineToks.set(l0, []); lineToks.get(l0).push(t); }
                else {
                    // multi-line template / string: attribute each physical line's text
                    const parts = t.value.split('\n');
                    for (let k = 0; k < parts.length; k++) {
                        const l = l0 + k; if (!lineToks.has(l)) lineToks.set(l, []);
                        lineToks.get(l).push({ type: 'tpltext', value: parts[k].trim() });
                    }
                }
            }
        }
    }
    const units = [];
    for (let l = 1; l <= nLines; l++) {
        let n1, n2;
        if (scriptLines.has(l)) {
            const ts = lineToks.get(l);
            if (!ts || !ts.length) continue;
            n1 = ts.map(t => t.value).join(' ').replace(/\s+/g, ' ').trim();
            n2 = ts.map(t => t.type === 'ident' ? (KEYWORDS.has(t.value) ? t.value : '$') : t.type === 'num' ? '#' : (t.type === 'string') ? 'S' : t.type === 'tpltext' ? t.value.replace(/\s+/g, ' ') : t.value).join(' ');
        } else {
            n1 = li.text(l).replace(/\s+/g, ' ').trim();
            if (isCss) n1 = n1.replace(/\/\*.*?\*\//g, '').trim();
            n2 = n1;
        }
        if (n1.length < 4 || /^[\]\[(){};,.<>\/ ]*$/.test(n1) || /^(else|try|\} else \{|\} catch \( \w+ \) \{|return ;|break ;|<\/\w+>|<br>|<tr>|<td>|<div>)$/.test(n1)) continue;
        units.push({ line: l, key: mode === 'abstract' ? n2 : n1, raw: n1 });
    }
    return units;
}

const fileUnits = [];
for (const rel of files) {
    let src; try { src = fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { continue; }
    fileUnits.push({ rel, units: unitsFor(rel, src) });
}

// window hashes
const index = new Map();
fileUnits.forEach((f, fi) => {
    for (let i = 0; i + W <= f.units.length; i++) {
        const h = crypto.createHash('md5').update(f.units.slice(i, i + W).map(u => u.key).join('\n')).digest('hex');
        if (!index.has(h)) index.set(h, []);
        index.get(h).push([fi, i]);
    }
});

// matching pairs grouped by (fileA, fileB, diagonal)
const diag = new Map();
for (const occ of index.values()) {
    if (occ.length < 2 || occ.length > 40) continue;
    for (let a = 0; a < occ.length; a++) for (let b = a + 1; b < occ.length; b++) {
        const [fa, ia] = occ[a], [fb, ib] = occ[b];
        if (fa === fb && Math.abs(ia - ib) < W) continue;
        const k = fa + '|' + fb + '|' + (ib - ia);
        if (!diag.has(k)) diag.set(k, []);
        diag.get(k).push(ia);
    }
}
const clones = [];
for (const [k, starts] of diag) {
    const [fa, fb, d] = k.split('|').map(Number);
    starts.sort((x, y) => x - y);
    let runStart = starts[0], prev = starts[0];
    const flush = () => {
        const nUnits = prev - runStart + W;
        if (nUnits >= MIN) {
            const A = fileUnits[fa], B = fileUnits[fb];
            const a0 = A.units[runStart].line, a1 = A.units[runStart + nUnits - 1].line;
            const b0 = B.units[runStart + d].line, b1 = B.units[runStart + d + nUnits - 1].line;
            if (!(fa === fb && a1 >= b0 && b1 >= a0)) {
                const chars = A.units.slice(runStart, runStart + nUnits).reduce((s, u) => s + u.raw.length, 0);
                clones.push({ a: A.rel, a0, a1, b: B.rel, b0, b1, units: nUnits, chars, sample: A.units.slice(runStart, runStart + 3).map(u => u.raw.slice(0, 110)) });
            }
        }
    };
    for (let i = 1; i < starts.length; i++) {
        if (starts[i] === prev) continue;
        if (starts[i] === prev + 1) { prev = starts[i]; continue; }
        flush(); runStart = prev = starts[i];
    }
    flush();
}
clones.sort((x, y) => y.units - x.units || y.chars - x.chars);
fs.writeFileSync(outJson, JSON.stringify(clones, null, 1));
const cross = clones.filter(c => c.a !== c.b).length;
console.log(mode, 'W=' + W, 'min=' + MIN, 'files', fileUnits.length, 'clone pairs', clones.length, 'cross-file', cross, 'dup units total', clones.reduce((s, c) => s + c.units, 0));

'use strict';
// Builds two inventories per source file:
//   out/nums/<flat>.tsv      every numeric literal in code (not comments/strings), classified
//   out/comments/<flat>.json every comment block (consecutive line comments merged) with stats
// plus out/inventory_summary.tsv. Usage: node inventory.js <repoRoot> <outDir> <file>...
const fs = require('fs');
const path = require('path');
const { lex, inlineScripts, lineIndex } = require('./jslex.js');

const root = process.argv[2];
const outDir = process.argv[3];
const files = process.argv.slice(4);
fs.mkdirSync(path.join(outDir, 'nums'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'comments'), { recursive: true });

const TRIVIAL = new Set(['0', '1', '2']);
const CONTROL = /\b(if|for|while|return|function|switch|case|else|throw|new|typeof|await|yield)\b|=>|[<>]=?|===?|!==?|&&|\|\||\?/;

const summary = [['file', 'lines', 'code_lines', 'comment_lines', 'blank_lines', 'comment_pct_of_nonblank',
    'comment_blocks', 'blocks_ge_8_lines', 'nums_total', 'nums_logic', 'nums_namedconst', 'nums_data'].join('\t')];

for (const rel of files) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    const li = lineIndex(src);
    const isHtml = /\.html?$/i.test(rel);
    const blocks = isHtml ? inlineScripts(src) : [{ start: 0, end: src.length }];
    let toks = [];
    for (const b of blocks) toks = toks.concat(lex(src.slice(b.start, b.end), b.start));

    // ---- line classification -------------------------------------------------------------
    const nLines = li.starts.length;
    const hasCode = new Uint8Array(nLines + 2), hasComment = new Uint8Array(nLines + 2);
    for (const t of toks) {
        const l0 = li.lineOf(t.start), l1 = li.lineOf(Math.max(t.start, t.end - 1));
        const arr = (t.type === 'line_comment' || t.type === 'block_comment') ? hasComment : hasCode;
        for (let l = l0; l <= l1; l++) arr[l] = 1;
    }
    if (isHtml) {
        // HTML outside scripts: count <!-- --> as comment, everything else non-blank as code.
        const inScript = new Uint8Array(nLines + 2);
        for (const b of blocks) for (let l = li.lineOf(b.start); l <= li.lineOf(b.end); l++) inScript[l] = 1;
        const re = /<!--[\s\S]*?-->/g; let m;
        while ((m = re.exec(src))) {
            if (inScript[li.lineOf(m.index)]) continue;
            for (let l = li.lineOf(m.index); l <= li.lineOf(m.index + m[0].length - 1); l++) hasComment[l] = 1;
        }
        for (let l = 1; l <= nLines; l++) if (!inScript[l] && !hasComment[l] && li.text(l).trim()) hasCode[l] = 1;
    }
    let codeLines = 0, commentLines = 0, blank = 0;
    for (let l = 1; l <= nLines; l++) {
        if (hasCode[l]) codeLines++;
        else if (hasComment[l]) commentLines++;   // comment-ONLY lines
        else blank++;
    }

    // ---- comment blocks -------------------------------------------------------------------
    const comments = toks.filter(t => t.type === 'line_comment' || t.type === 'block_comment');
    const cblocks = [];
    for (const t of comments) {
        const l0 = li.lineOf(t.start), l1 = li.lineOf(Math.max(t.start, t.end - 1));
        const trailing = hasCode[l0] && t.type === 'line_comment';
        const last = cblocks[cblocks.length - 1];
        if (last && !trailing && !last.trailing && t.type === 'line_comment' && last.kind === 'line' && l0 === last.end + 1) {
            last.end = l1; last.text += '\n' + t.value;
        } else {
            cblocks.push({ start: l0, end: l1, kind: t.type === 'line_comment' ? 'line' : 'block', trailing, text: t.value });
        }
    }
    const flat = rel.replace(/[\\/]/g, '__');
    fs.writeFileSync(path.join(outDir, 'comments', flat + '.json'), JSON.stringify(cblocks));

    // ---- numeric literals -----------------------------------------------------------------
    const rows = [['line', 'literal', 'class', 'function', 'source'].join('\t')];
    let curFn = '(top)';
    let nLogic = 0, nConst = 0, nData = 0, nTotal = 0;
    const sig = toks.filter(t => t.type !== 'line_comment' && t.type !== 'block_comment');
    for (let k = 0; k < sig.length; k++) {
        const t = sig[k];
        if (t.type === 'ident' && t.value === 'function' && sig[k + 1] && sig[k + 1].type === 'ident') curFn = sig[k + 1].value;
        if (t.type === 'ident' && sig[k + 1] && sig[k + 1].value === '=' && sig[k + 2] &&
            (sig[k + 2].value === 'function' || (sig[k + 2].value === 'async'))) curFn = t.value;
        if (t.type !== 'num') continue;
        const v = t.value.replace(/_/g, '');
        if (TRIVIAL.has(v)) continue;
        const prev = sig[k - 1], next = sig[k + 1];
        if (prev && next && prev.value === '[' && next.value === ']') continue;          // plain index
        nTotal++;
        const line = li.lineOf(t.start);
        const text = li.text(line);
        const codeOnly = text.replace(/\/\/.*$/, '');
        let cls = 'LOGIC';
        if (/^\s*(const|let|var)\s+[A-Z][A-Z0-9_]*\s*=\s*[-+]?[\d._eE]+\s*[;,]?\s*$/.test(codeOnly)) cls = 'NAMEDCONST';
        else if (!CONTROL.test(codeOnly.replace(/'[^']*'|"[^"]*"/g, '')) && !/[=(]/.test(codeOnly.replace(/'[^']*'|"[^"]*"/g, '').replace(/^\s*(const|let|var)\s+\w+\s*=/, ''))) cls = 'DATA';
        if (cls === 'LOGIC') nLogic++; else if (cls === 'NAMEDCONST') nConst++; else nData++;
        rows.push([line, t.value, cls, curFn, text.trim().slice(0, 170)].join('\t'));
    }
    fs.writeFileSync(path.join(outDir, 'nums', flat + '.tsv'), rows.join('\n') + '\n');

    const big = cblocks.filter(b => b.end - b.start + 1 >= 8).length;
    const pct = (100 * commentLines / Math.max(1, codeLines + commentLines)).toFixed(1);
    summary.push([rel, nLines, codeLines, commentLines, blank, pct, cblocks.length, big, nTotal, nLogic, nConst, nData].join('\t'));
}
fs.writeFileSync(path.join(outDir, 'inventory_summary.tsv'), summary.join('\n') + '\n');
console.log(summary.join('\n'));

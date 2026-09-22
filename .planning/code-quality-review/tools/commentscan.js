'use strict';
// Classifies comment blocks mechanically. node commentscan.js <repoRoot> <outDir> <allFilesList.txt> <file>...
// allFilesList.txt: every tracked file path (for file-reference checks).
const fs = require('fs');
const path = require('path');
const { lex, inlineScripts, lineIndex } = require('./jslex.js');

const root = process.argv[2], outDir = process.argv[3];
const tracked = fs.readFileSync(process.argv[4], 'utf8').split(/\r?\n/).filter(Boolean);
const files = process.argv.slice(5);
const trackedBase = new Set(tracked.map(f => f.split('/').pop()));
const trackedSet = new Set(tracked);

// 1. global identifier + string vocabulary (code zones of every JS/HTML file)
const vocab = new Set();
const codeFiles = tracked.filter(f => /\.(js|cjs|html)$/.test(f) && !/^\.idea\//.test(f));
const tokCache = new Map();
for (const rel of codeFiles) {
    let src; try { src = fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { continue; }
    const blocks = /\.html?$/.test(rel) ? inlineScripts(src) : [{ start: 0, end: src.length }];
    let toks = [];
    for (const b of blocks) toks = toks.concat(lex(src.slice(b.start, b.end), b.start));
    tokCache.set(rel, { src, toks });
    for (const t of toks) {
        if (t.type === 'ident') vocab.add(t.value);
        else if (t.type === 'string' || t.type === 'template') for (const w of t.value.match(/[A-Za-z_$][\w$]*/g) || []) vocab.add(w);
    }
    if (/\.html?$/.test(rel)) for (const w of src.match(/(?:id|class|name|for|data-[\w-]+)="([^"]+)"/g) || []) for (const x of w.match(/[A-Za-z_$][\w$-]*/g) || []) vocab.add(x);
}

const RX = {
    HIST: /\b(used to|no longer|previously|formerly|originally|until (?:P\d|v?\d|20\d\d|then|now)|since (?:v?1[01]\.|P\d|20\d\d)|the old\b|old (?:code|version|behaviou?r|test|logic|path|name|copy|order|form|rule|loop|check)|now (?:reads|uses|is|does|returns|takes|calls|lives|sits|runs|shares|carries|comes|reports)|was (?:a|the|an|being|called|named|in|on|once|never|always|only|not|also|wrong|right|read|set|computed|spread|hard)\b|were (?:once|never|always|both|all|two|three)\b|replaced|renamed|retired|shipped|moved (?:here|to|from|out)|introduced|added (?:in|on|by|when|for)|fixed (?:in|on|by|here)|regress\w*|the bug\b|the defect\b|that bug\b|this bug\b|a bug\b|defect\b|reproduc\w*|before (?:this|the) (?:fix|change|phase|refactor)|found (?:by|when|while|on)|caught (?:by|when|it)|measured (?:on|20\d\d)|by construction|hard way|for real\b)/i,
    DATE: /\b20\d\d-\d\d-\d\d\b/,
    PHASE: /\bP[F]?\d{1,3}[a-z]{0,2}\d?\b/,
    VERSION: /\bv?1[01]\.\d{1,2}[0-9a-fA-F]{1,3}\b/,
    PR: /\bPR ?#?\d+\b/,
    USER: /\b(?:the )?user\b[^.]{0,40}\b(?:asked|said|chose|decided|decision|request|wanted|instruction)|on instruction|\(user[,:)]/i,
    MEASURE: /\$\d{1,3}(?:,\d{3})+|\b\d+ of \d+\b|\b\d+(?:\.\d+)? ?ms\b|\b\d+\/\d+ (?:cells|tests|plans|households)\b/,
    TODO: /\b(?:TODO|FIXME|XXX|HACK|for now|temporar(?:y|ily)|revisit|placeholder|stopgap|not yet)\b/i,
};
const CODEY = /^(?:\s*(?:const|let|var|if|else|for|while|return|function|switch|case|break|continue|try|catch|throw)\b.*[;{(]\s*$|\s*[\w.$\[\]]+\s*(?:[+\-*\/]?=)\s*[^=].*;\s*$|\s*[\w.$]+\([^)]*\);\s*$|\s*\}\s*(?:else\s*\{)?\s*$|\s*\/\/\s*\w+\(.*\);\s*$)/;

function strip(text, kind) {
    return text.split('\n').map(l => l.replace(/^\s*(?:\/\/+|\/\*+|\*+\/?|\*)\s?/, '').replace(/\*\/\s*$/, ''));
}

const summary = [['file', 'comment_only_lines', 'blocks', 'HIST_lines', 'DATE_lines', 'PHASE_lines', 'VERSION_lines', 'PR_lines', 'USER_lines', 'MEASURE_lines', 'TODO_blocks', 'DEADCODE_lines',
    'any_history_marker_lines', 'essay_blocks_ge8', 'essay_lines', 'missing_file_refs', 'line_cites', 'unknown_ident_refs'].join('\t')];
const detail = [];

for (const rel of files) {
    const flat = rel.replace(/[\\/]/g, '__');
    const cpath = path.join(outDir, 'comments', flat + '.json');
    if (!fs.existsSync(cpath)) continue;
    const blocks = JSON.parse(fs.readFileSync(cpath, 'utf8'));
    const agg = { lines: 0, HIST: 0, DATE: 0, PHASE: 0, VERSION: 0, PR: 0, USER: 0, MEASURE: 0, TODO: 0, DEAD: 0, anyHist: 0, essayBlocks: 0, essayLines: 0, missFile: 0, lineCites: 0, unkIdent: 0 };
    for (const b of blocks) {
        const n = b.end - b.start + 1;
        if (!b.trailing) agg.lines += n;
        const lines = strip(b.text, b.kind);
        const text = lines.join('\n');
        const flags = [];
        for (const k of Object.keys(RX)) if (RX[k].test(text)) flags.push(k);
        // per-line counts for history-ish markers
        let histLines = 0;
        for (const l of lines) if (RX.HIST.test(l) || RX.DATE.test(l) || RX.PHASE.test(l) || RX.VERSION.test(l) || RX.PR.test(l) || RX.USER.test(l)) histLines++;
        let dead = 0, run = 0;
        for (const l of lines) { if (CODEY.test(l) && !/^\s*(e\.g\.|i\.e\.)/.test(l)) { run++; } else { if (run >= 2) dead += run; run = 0; } }
        if (run >= 2) dead += run;
        if (dead) flags.push('DEADCODE');
        // file refs
        const missing = [];
        for (const m of text.matchAll(/(?<![\w/])((?:[\w.-]+\/)*[\w.-]+\.(?:js|cjs|html|md|css|json|jsonc|yml|py|sh))\b/g)) {
            const f = m[1];
            if (/^(e\.g|i\.e|etc|vs|node)\./.test(f)) continue;
            const base = f.split('/').pop();
            if (!trackedSet.has(f) && !trackedBase.has(base) && !/^(chart|chart\.umd|html2canvas|gtag|beacon\.min|package|index|foo|bar|x|tool|settings)\./i.test(base)) missing.push(f);
        }
        const cites = [...text.matchAll(/(?:[\w./-]+\.(?:js|html|md|css))?:(\d{2,5})(?:-\d+)?\b/g)].filter(m => Number(m[1]) > 20).map(m => m[0]);
        // identifier refs
        const unk = [];
        for (const m of text.matchAll(/`([A-Za-z_$][\w$.]*)(?:\([^`]*\))?`|\b([A-Za-z_$][\w$]*[a-z][A-Z][\w$]*)\(\)/g)) {
            const name = (m[1] || m[2]);
            const parts = name.split('.').filter(Boolean);
            const last = parts[parts.length - 1];
            if (!last || last.length < 4) continue;
            if (/^(true|false|null|undefined|NaN|Infinity|this|window|document|node|npm|git|http|https|file)$/.test(last)) continue;
            if (!vocab.has(last)) unk.push(name);
        }
        if (missing.length) flags.push('MISSINGFILE');
        if (unk.length) flags.push('UNKIDENT');
        if (cites.length) flags.push('LINECITE');
        if (n >= 8) { agg.essayBlocks++; agg.essayLines += n; flags.push('LONG'); }
        if (flags.includes('HIST')) agg.HIST += n;
        if (flags.includes('DATE')) agg.DATE += n;
        if (flags.includes('PHASE')) agg.PHASE += n;
        if (flags.includes('VERSION')) agg.VERSION += n;
        if (flags.includes('PR')) agg.PR += n;
        if (flags.includes('USER')) agg.USER += n;
        if (flags.includes('MEASURE')) agg.MEASURE += n;
        if (flags.includes('TODO')) agg.TODO++;
        agg.DEAD += dead; agg.anyHist += histLines; agg.missFile += missing.length; agg.lineCites += cites.length; agg.unkIdent += unk.length;
        detail.push({ file: rel, start: b.start, end: b.end, lines: n, trailing: !!b.trailing, flags, histLines, dead, missing, cites, unk, head: lines.find(l => l.trim()) ? lines.find(l => l.trim()).trim().slice(0, 140) : '' });
    }
    summary.push([rel, agg.lines, blocks.length, agg.HIST, agg.DATE, agg.PHASE, agg.VERSION, agg.PR, agg.USER, agg.MEASURE, agg.TODO, agg.DEAD, agg.anyHist, agg.essayBlocks, agg.essayLines, agg.missFile, agg.lineCites, agg.unkIdent].join('\t'));
}
fs.writeFileSync(path.join(outDir, 'comment_summary.tsv'), summary.join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'comment_detail.json'), JSON.stringify(detail));
console.log(summary.join('\n'));

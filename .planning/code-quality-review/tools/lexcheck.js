'use strict';
// Sanity check for jslex.js: gaps between tokens must be whitespace only, and braces/parens must
// balance over the code tokens. Usage: node lexcheck.js <repoRoot> <file> [<file> ...]
const fs = require('fs');
const path = require('path');
const { lex, inlineScripts } = require('./jslex.js');

const root = process.argv[2];
for (const rel of process.argv.slice(3)) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    const blocks = /\.html?$/i.test(rel) ? inlineScripts(src) : [{ start: 0, end: src.length }];
    let bad = 0, ntok = 0;
    for (const b of blocks) {
        const body = src.slice(b.start, b.end);
        const toks = lex(body, 0);
        ntok += toks.length;
        let pos = 0;
        const depth = { '{': 0, '(': 0, '[': 0 };
        for (const t of toks) {
            const gap = body.slice(pos, t.start);
            if (/\S/.test(gap.replace(/﻿/g, ''))) { bad++; if (bad < 4) console.log('  gap', JSON.stringify(gap.slice(0, 40)), 'at', t.start); }
            pos = t.end;
            if (t.type === 'punct') {
                if (t.value === '{') depth['{']++; else if (t.value === '}') depth['{']--;
                else if (t.value === '(') depth['(']++; else if (t.value === ')') depth['(']--;
                else if (t.value === '[') depth['[']++; else if (t.value === ']') depth['[']--;
            }
        }
        if (depth['{'] || depth['('] || depth['[']) { bad++; console.log('  unbalanced', JSON.stringify(depth), 'block@', b.start); }
    }
    console.log((bad ? 'FAIL ' : 'ok   ') + rel + '  tokens=' + ntok + ' blocks=' + blocks.length);
}

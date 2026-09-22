'use strict';
// Mutation-site discovery over jslex tokens. Every site is {start, end, replacement, op, line, fn}.
const { lex, lineIndex } = require('./jslex.js');

const SWAP = {
    '<': '<=', '<=': '<', '>': '>=', '>=': '>',
    '===': '!==', '!==': '===', '==': '!=', '!=': '==',
    '&&': '||', '||': '&&',
    '+': '-', '-': '+', '*': '/', '/': '*',
    '+=': '-=', '-=': '+=',
};
const OPCLASS = {
    '<': 'rel', '<=': 'rel', '>': 'rel', '>=': 'rel',
    '===': 'eq', '!==': 'eq', '==': 'eq', '!=': 'eq',
    '&&': 'logic', '||': 'logic',
    '+': 'arith', '-': 'arith', '*': 'arith', '/': 'arith', '+=': 'arith', '-=': 'arith',
};

function functionRanges(sig) {
    // sig: significant tokens. Returns [{name, startTok, endTok, start, end}]
    const match = new Map();
    const stack = [];
    for (let k = 0; k < sig.length; k++) {
        const v = sig[k].type === 'punct' ? sig[k].value : null;
        if (v === '(' || v === '{' || v === '[') stack.push(k);
        else if (v === ')' || v === '}' || v === ']') { const o = stack.pop(); if (o !== undefined) { match.set(o, k); } }
        // template tokens that close an expression behave like '}' but jslex folds them in; ignore
    }
    const ranges = [];
    function bodyAfterParams(kOpenParen, name) {
        const close = match.get(kOpenParen);
        if (close === undefined) return;
        let b = close + 1;
        if (sig[b] && sig[b].value === '=>') b++;
        if (sig[b] && sig[b].value === '{' && match.has(b)) {
            ranges.push({ name, startTok: b, endTok: match.get(b), start: sig[b].start, end: sig[match.get(b)].end });
        }
    }
    for (let k = 0; k < sig.length; k++) {
        const t = sig[k];
        if (t.type !== 'ident') continue;
        if (t.value === 'function') {
            let j = k + 1;
            if (sig[j] && sig[j].value === '*') j++;
            if (sig[j] && sig[j].type === 'ident' && sig[j + 1] && sig[j + 1].value === '(') bodyAfterParams(j + 1, sig[j].value);
            continue;
        }
        // NAME = function (...) {  |  NAME = async (...) => {  |  NAME = (...) => {  |  NAME = x => {
        if (sig[k + 1] && sig[k + 1].value === '=' && sig[k + 2]) {
            let j = k + 2;
            if (sig[j].value === 'async') j++;
            if (sig[j] && sig[j].value === 'function') {
                let p = j + 1; if (sig[p] && sig[p].type === 'ident') p++;
                if (sig[p] && sig[p].value === '(') bodyAfterParams(p, t.value);
            } else if (sig[j] && sig[j].value === '(' && match.has(j) && sig[match.get(j) + 1] && sig[match.get(j) + 1].value === '=>') {
                bodyAfterParams(j, t.value);
            } else if (sig[j] && sig[j].type === 'ident' && sig[j + 1] && sig[j + 1].value === '=>' && sig[j + 2] && sig[j + 2].value === '{' && match.has(j + 2)) {
                ranges.push({ name: t.value, startTok: j + 2, endTok: match.get(j + 2), start: sig[j + 2].start, end: sig[match.get(j + 2)].end });
            }
        }
    }
    return { ranges, match };
}

function enclosing(ranges, off) {
    let best = null;
    for (const r of ranges) if (off >= r.start && off < r.end && (!best || (r.end - r.start) < (best.end - best.start))) best = r;
    return best ? best.name : '(top)';
}

function mutateNumber(text) {
    const clean = text.replace(/_/g, '');
    if (/^0[xXbBoO]/.test(clean) || /n$/.test(clean)) return null;
    const v = Number(clean);
    if (!isFinite(v)) return null;
    if (v === 0) return '1';
    if (v === 1) return '0';
    const isInt = /^\d+$/.test(clean);
    if (isInt && v < 10) return String(v + 1);
    if (isInt) return String(Math.round(v * 1.1) === v ? v + 1 : Math.round(v * 1.1));
    const m = v * 1.1;
    return String(Number(m.toPrecision(6)));
}

function sites(src, opts) {
    opts = opts || {};
    const li = lineIndex(src);
    const toks = lex(src, 0);
    const sig = toks.filter(t => t.type !== 'line_comment' && t.type !== 'block_comment');
    const { ranges, match } = functionRanges(sig);
    const out = [];
    const isStr = t => t && (t.type === 'string' || t.type === 'template');
    const lineSkip = /console\.(log|warn|error|info|debug)|throw new Error|\bassert\(/;

    for (let k = 0; k < sig.length; k++) {
        const t = sig[k], prev = sig[k - 1], next = sig[k + 1];
        const line = li.lineOf(t.start);
        if (lineSkip.test(li.text(line))) continue;
        if (t.type === 'punct' && SWAP[t.value]) {
            const v = t.value;
            if (v === '+' || v === '-' || v === '*' || v === '/') {
                // binary only: left operand must end an expression
                const leftOk = prev && (prev.type === 'num' || prev.type === 'ident' && !/^(return|typeof|case|in|of|delete|void|throw|new|else|do|yield|await)$/.test(prev.value)
                    || (prev.type === 'punct' && (prev.value === ')' || prev.value === ']')));
                if (!leftOk) continue;
                if (v === '+' && (isStr(prev) || isStr(next))) continue;   // string concatenation
            }
            if ((v === '<' || v === '>') && prev && prev.type === 'punct' && prev.value === '=') continue;
            out.push({ start: t.start, end: t.end, replacement: SWAP[v], op: OPCLASS[v] + ':' + v + '→' + SWAP[v], line });
            continue;
        }
        if (t.type === 'num') {
            const rep = mutateNumber(t.value);
            if (rep !== null && rep !== t.value) out.push({ start: t.start, end: t.end, replacement: rep, op: 'num:' + t.value + '→' + rep, line });
            continue;
        }
        if (t.type === 'ident') {
            if ((t.value === 'true' || t.value === 'false') && !(prev && prev.value === '.')) {
                out.push({ start: t.start, end: t.end, replacement: t.value === 'true' ? 'false' : 'true', op: 'bool:' + t.value, line });
            } else if ((t.value === 'min' || t.value === 'max') && prev && prev.value === '.' && sig[k - 2] && sig[k - 2].value === 'Math') {
                out.push({ start: t.start, end: t.end, replacement: t.value === 'min' ? 'max' : 'min', op: 'minmax:' + t.value, line });
            } else if (t.value === 'if' && next && next.value === '(' && match.has(k + 1)) {
                const o = sig[k + 1], c = sig[match.get(k + 1)];
                out.push({ start: o.start, end: c.end, replacement: '(!(' + src.slice(o.end, c.start) + '))', op: 'ifneg', line });
            }
        }
    }

    if (opts.statementDeletion !== false) {
        // single-line assignment / call statements
        const byLine = new Map();
        for (const t of sig) {
            const l0 = li.lineOf(t.start), l1 = li.lineOf(Math.max(t.start, t.end - 1));
            if (l0 !== l1) { byLine.set(l0, null); byLine.set(l1, null); continue; }
            if (byLine.get(l0) === null) continue;
            if (!byLine.has(l0)) byLine.set(l0, []);
            byLine.get(l0).push(t);
        }
        let prevEnd = ';';
        const lines = [...byLine.keys()].sort((a, b) => a - b);
        for (const l of lines) {
            const ts = byLine.get(l);
            if (!ts || !ts.length) { prevEnd = '?'; continue; }
            const first = ts[0], last = ts[ts.length - 1];
            const okPrev = prevEnd === ';' || prevEnd === '{' || prevEnd === '}';
            prevEnd = last.value;
            if (!okPrev || last.value !== ';' || first.type !== 'ident') continue;
            if (/^(const|let|var|return|if|for|while|do|switch|case|break|continue|throw|function|class|else|try|import|export|default|yield|await|new|delete|typeof)$/.test(first.value)) continue;
            const text = li.text(l);
            if (lineSkip.test(text)) continue;
            let depth = 0, bad = false, hasAssignOrCall = false;
            for (const t of ts) {
                if (t.type !== 'punct') continue;
                if ('([{'.includes(t.value)) depth++;
                else if (')]}'.includes(t.value)) { depth--; if (depth < 0) bad = true; }
                if (depth === 0 && /^([+\-*\/%]|\*\*|&&|\|\||\?\?)?=$/.test(t.value)) hasAssignOrCall = true;
                if (t.value === '(') hasAssignOrCall = true;
                if (t.value === '=>' ) { /* arrow inside is fine if balanced */ }
            }
            if (bad || depth !== 0 || !hasAssignOrCall) continue;
            if (ts.filter(t => t.value === ';').length !== 1) continue;
            out.push({ start: first.start, end: last.end, replacement: ';', op: 'stmtdel', line: l });
        }
    }
    for (const s of out) s.fn = enclosing(ranges, s.start);
    return out;
}

module.exports = { sites, functionRanges };

'use strict';
// Minimal JavaScript lexer for audit tooling. Not a parser: it only needs to tell code from
// comments, strings, template text and regex literals, and to hand back identifier / number /
// punctuator tokens with offsets. Good enough for literal inventories, comment extraction and
// mutation-site discovery on hand-written ES2020 classic scripts.

const KEYWORDS_BEFORE_REGEX = new Set([
    'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do',
    'else', 'yield', 'await',
]);

const PUNCT = [
    '>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
    '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=',
    '&=', '|=', '^=', '<<', '>>', '**',
    '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/', '%', '&', '|', '^', '!',
    '~', '?', ':', '=', '.', '@', '#',
];

function isIdStart(c) { return /[A-Za-z_$]/.test(c) || c > '\x7f'; }
function isIdPart(c) { return /[A-Za-z0-9_$]/.test(c) || c > '\x7f'; }
function isDigit(c) { return c >= '0' && c <= '9'; }

function lex(src, baseOffset) {
    baseOffset = baseOffset || 0;
    const tokens = [];
    const n = src.length;
    let i = 0;
    // stack of template contexts: each entry is the brace depth inside a `${ ... }` expression
    const tplStack = [];
    let braceDepth = 0;
    let prevSig = null; // previous significant token (not comment / whitespace)

    function push(type, start, end) {
        const t = { type, start: baseOffset + start, end: baseOffset + end, value: src.slice(start, end) };
        tokens.push(t);
        if (type !== 'line_comment' && type !== 'block_comment') prevSig = t;
        return t;
    }

    function regexAllowed() {
        if (!prevSig) return true;
        if (prevSig.type === 'num' || prevSig.type === 'string' || prevSig.type === 'template' || prevSig.type === 'regex') return false;
        if (prevSig.type === 'ident') return KEYWORDS_BEFORE_REGEX.has(prevSig.value);
        if (prevSig.type === 'punct') {
            const v = prevSig.value;
            if (v === ')' || v === ']' || v === '}' || v === '++' || v === '--') return false;
            return true;
        }
        return true;
    }

    function readTemplateText(start) {
        // reads template characters from `start` (just after a backtick or a closing brace) until
        // the closing backtick or the next `${`. Returns the index after what it consumed and
        // whether an expression was opened.
        let j = start;
        while (j < n) {
            const c = src[j];
            if (c === '\\') { j += 2; continue; }
            if (c === '`') { return { end: j + 1, opened: false }; }
            if (c === '$' && src[j + 1] === '{') { return { end: j + 2, opened: true }; }
            j++;
        }
        return { end: n, opened: false };
    }

    while (i < n) {
        const c = src[i];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v' || c === '﻿') { i++; continue; }
        if (c === '/' && src[i + 1] === '/') {
            let j = i + 2;
            while (j < n && src[j] !== '\n') j++;
            push('line_comment', i, j);
            i = j; continue;
        }
        if (c === '/' && src[i + 1] === '*') {
            let j = src.indexOf('*/', i + 2);
            j = j < 0 ? n : j + 2;
            push('block_comment', i, j);
            i = j; continue;
        }
        if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < n && src[j] !== c) {
                if (src[j] === '\\') j++;
                if (src[j] === '\n') break;
                j++;
            }
            push('string', i, Math.min(j + 1, n));
            i = Math.min(j + 1, n); continue;
        }
        if (c === '`') {
            const r = readTemplateText(i + 1);
            push('template', i, r.end);
            i = r.end;
            if (r.opened) { tplStack.push(braceDepth); braceDepth = 0; }
            continue;
        }
        if (c === '}' && tplStack.length && braceDepth === 0) {
            // end of a `${ ... }` expression: resume template text
            const r = readTemplateText(i + 1);
            push('template', i, r.end);
            i = r.end;
            if (r.opened) { braceDepth = 0; } else { braceDepth = tplStack.pop(); }
            continue;
        }
        if (isDigit(c) || (c === '.' && isDigit(src[i + 1] || ''))) {
            let j = i;
            if (c === '0' && /[xXbBoO]/.test(src[i + 1] || '')) {
                j = i + 2;
                while (j < n && /[0-9a-fA-F_]/.test(src[j])) j++;
            } else {
                while (j < n && /[0-9_]/.test(src[j])) j++;
                if (src[j] === '.' && src[j + 1] !== '.') { j++; while (j < n && /[0-9_]/.test(src[j])) j++; }
                if (/[eE]/.test(src[j] || '') && /[0-9+\-]/.test(src[j + 1] || '')) {
                    j += 2; while (j < n && isDigit(src[j])) j++;
                }
                if (src[j] === 'n') j++;
            }
            push('num', i, j);
            i = j; continue;
        }
        if (isIdStart(c)) {
            let j = i + 1;
            while (j < n && isIdPart(src[j])) j++;
            push('ident', i, j);
            i = j; continue;
        }
        if (c === '/' && regexAllowed()) {
            let j = i + 1, inClass = false, ok = false;
            while (j < n && src[j] !== '\n') {
                const d = src[j];
                if (d === '\\') { j += 2; continue; }
                if (d === '[') inClass = true;
                else if (d === ']') inClass = false;
                else if (d === '/' && !inClass) { ok = true; break; }
                j++;
            }
            if (ok) {
                j++;
                while (j < n && /[a-z]/i.test(src[j])) j++;
                push('regex', i, j);
                i = j; continue;
            }
        }
        let matched = null;
        for (const p of PUNCT) { if (src.startsWith(p, i)) { matched = p; break; } }
        if (!matched) matched = c;
        if (matched === '{') braceDepth++;
        if (matched === '}') braceDepth--;
        push('punct', i, i + matched.length);
        i += matched.length;
    }
    return tokens;
}

// Inline <script> bodies of an HTML document (no src= attribute). Returns [{start, end}] offsets.
function inlineScripts(html) {
    const out = [];
    const re = /<script\b([^>]*)>/gi;
    let m;
    while ((m = re.exec(html))) {
        const attrs = m[1] || '';
        const bodyStart = m.index + m[0].length;
        const close = html.toLowerCase().indexOf('</script', bodyStart);
        const bodyEnd = close < 0 ? html.length : close;
        const isSrc = /\bsrc\s*=/.test(attrs);
        const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1] || '';
        const isJs = !type || /javascript|module/i.test(type);
        if (!isSrc && isJs && bodyEnd > bodyStart) out.push({ start: bodyStart, end: bodyEnd });
        re.lastIndex = bodyEnd;
    }
    return out;
}

function lineIndex(src) {
    const starts = [0];
    for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
    return {
        starts,
        lineOf(off) {
            let lo = 0, hi = starts.length - 1;
            while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; }
            return lo + 1;
        },
        text(line) {
            const s = starts[line - 1], e = line < starts.length ? starts[line] : src.length;
            return src.slice(s, e).replace(/\r?\n$/, '');
        },
    };
}

// Tokens for a .js file, or for every inline script of an .html file.
function lexFile(path, src) {
    if (/\.html?$/i.test(path)) {
        let toks = [];
        for (const blk of inlineScripts(src)) toks = toks.concat(lex(src.slice(blk.start, blk.end), blk.start));
        return toks;
    }
    return lex(src, 0);
}

module.exports = { lex, lexFile, inlineScripts, lineIndex };

'use strict';
// Turns out/uk_hits.tsv into vetted markdown tables. node uktables.js <hits.tsv> <out.md>
const fs = require('fs');
const [inTsv, outMd] = process.argv.slice(2);
const rows = fs.readFileSync(inTsv, 'utf8').split('\n').slice(1).filter(Boolean).map(l => { const [tier, match, us, file, line, zone, ctx] = l.split('\t'); return { tier, match, us, file, line: +line, zone, ctx: ctx || '' }; });

function falsePositive(r) {
    const m = r.match.toLowerCase(), c = r.ctx;
    if (r.zone === 'code') return true;                                     // identifiers are exempt
    if (/^(gkraise|rraise|portraise|praise|upraise)/.test(m)) return true;
    if (m === 'faff' && /#[0-9a-f]*faff/i.test(c)) return true;             // hex color
    if (m === 'to hand') return true;                                       // always "used to hand X" here
    if (m === 'in future') return true;                                     // always adjectival ("in future dollars")
    if (/^(can|would|could|should|will|may|might|must) (do|have done)$/.test(m)) return true;
    if (m === 'current account') return true;
    if (m === 'sat' || m === 'stood') return true;                          // plain past tense, not "was sat"
    if (/^\$/.test(m)) return true;                                         // $5M style is fine
    if (/^\d+ (january|february|march|april|june|july|august|september|october|november|december)$/.test(m) && /\$\d|,000/.test(c)) return true;
    if (m === 'analyses' && /\b(the|these|those|two|both|several|such|all|other|sensitivity|of)\s+analyses|analyses\s+(show|are|were|of)\b/i.test(c)) return true;
    if (/^(un)?tick(s|ed|ing)?$/.test(m)) {
        if (/axis|chart|log ticks|same tick|tick generator|one tick per|ticks above|four ticks|tick marks?|ticks? print|per tick|next tick|maxTicks|ticks:|ticker/i.test(c)) return true;
    }
    if (m === 'nil' || m === 'the lot' || m === 'diary' || m === 'rota') return !/\b(nil|the lot|diary|rota)\b/i.test(c);
    return false;
}

function group(r) {
    const f = r.file;
    if (/^\.planning\//.test(f)) return 'F';
    if (/^\.test_harnesses\//.test(f)) return 'E';
    if (/tests\.js$|optimizer_tests\.js$/.test(f)) return 'D';
    if (/\.(md|txt|yml|jsonc)$/.test(f) || /^\.githooks\/(install|pre-commit)$/.test(f) || f === '.gitattributes') return 'B';
    if (r.zone === 'string' || r.zone === 'template' || r.zone === 'markup') return 'A';
    return 'C';
}
const WORDMAP = [
    [/^untick/, 'uncheck'], [/^tick/, 'check'], [/^grey/, 'gray'],
    [/^(colo|behavio|neighbo|hono|favo|labo|flavo|humo|rumo|endeavo|harbo|savo|armo|odo)ur/, '$1r'],
    [/^(rig|vig|cand)our$/, '$1or'],
    [/^(label|model|cancel|total|equal|travel|level|signal|fuel|channel|tunnel|dial|initial|funnel|panel|pencil|unravel)l(ed|ing|er|ers)$/, '$1$2'],
    [/^centre(s?)$/, 'center$1'], [/^centred$/, 'centered'], [/^centring$/, 'centering'],
    [/^licence/, 'license'], [/^artefact/, 'artifact'], [/^maths$/, 'math'], [/^ageing$/, 'aging'], [/^enrolment/, 'enrollment'],
    [/^focuss(es|ed|ing)$/, 'focus$1'], [/^catalogue(s?)$/, 'catalog$1'], [/^cataloguing$/, 'cataloging'], [/^catalogued$/, 'cataloged'],
    [/^analys(e|ed|es|ing)$/, 'analyz$1'], [/^way round$/, 'way around'], [/^knock-on$/, 'ripple / downstream'], [/^fiddly$/, 'finicky'],
    [/^reckon/, 'expect / figure'], [/^belt[- ]and[- ]braces$/, 'belt and suspenders'], [/^topped up$/, 'replenished'], [/^top up$/, 'replenish'],
    [/^one-off$/, 'one-time'], [/^whilst$/, 'while'], [/^amongst$/, 'among'], [/^judgement/, 'judgment'], [/^learnt$/, 'learned'], [/^spelt$/, 'spelled'],
];
function exactUS(match, generic) {
    const lower = match.toLowerCase();
    for (const [re, rep] of WORDMAP) {
        if (re.test(lower)) {
            let out = lower.replace(re, rep);
            if (match === match.toUpperCase() && match.length > 1) out = out.toUpperCase();
            else if (match[0] === match[0].toUpperCase()) out = out[0].toUpperCase() + out.slice(1);
            return out;
        }
    }
    return generic;
}
for (const r of rows) r.us = exactUS(r.match, r.us);
const keep = rows.filter(r => !falsePositive(r));
const core = keep.filter(r => r.tier === 'S' || r.tier === 'I');
const variants = keep.filter(r => r.tier === 'V');
const esc = s => s.replace(/\|/g, '\\|').replace(/`/g, "'").replace(/</g, '&lt;');
const titles = {
    A: 'A. User-facing text in code (strings, templates, HTML markup)',
    B: 'B. Published and repo documentation',
    C: 'C. Code comments in production files',
    D: 'D. Test files (test names, assertion messages, comments)',
    E: 'E. Research harnesses',
};
let md = '';
const counts = {};
for (const g of ['A', 'B', 'C', 'D', 'E']) {
    const rs = core.filter(r => group(r) === g).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    counts[g] = rs.length;
    md += `\n#### ${titles[g]} - ${rs.length} corrections\n\n| Location | Found | US English | Context |\n|---|---|---|---|\n`;
    for (const r of rs) md += `| \`${r.file}:${r.line}\` | ${esc(r.match)} | ${esc(r.us)} | ${esc(r.ctx.slice(0, 110))} |\n`;
}
const plan = core.filter(r => group(r) === 'F');
const byFile = {};
for (const r of plan) byFile[r.file] = (byFile[r.file] || 0) + 1;
md += `\n#### F. Planning logs (.planning/) - ${plan.length} occurrences, listed by file only\n\n| File | Occurrences |\n|---|---|\n`;
for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) md += `| \`${f}\` | ${n} |\n`;
const wordCount = {};
for (const r of core) { const k = r.match.toLowerCase(); wordCount[k] = (wordCount[k] || 0) + 1; }
md += `\n#### Word frequency (all groups)\n\n` + Object.entries(wordCount).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ${n}`).join(' · ') + '\n';
const vCount = {};
for (const r of variants) { const k = r.match.toLowerCase(); vCount[k] = (vCount[k] || 0) + 1; }
md += `\n#### Optional: UK-leaning variants that many US writers also use (${variants.length})\n\n` + Object.entries(vCount).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ${n}`).join(' · ') + '\n';
fs.writeFileSync(outMd, md);
console.log(JSON.stringify({ kept: keep.length, core: core.length, counts, planning: plan.length, variants: variants.length }));

#!/usr/bin/env node
'use strict';
/**
 * check-comment-history.js - a comment says what the code does now, and the count cannot rise.
 *
 * Run by .githooks/pre-commit. Standalone: `node .githooks/check-comment-history.js`, and
 * `--list <file>` prints the matching lines so they can be read and rewritten.
 *
 * THE RULE, from CLAUDE.md: a comment carries what the code does today and the one constraint that
 * would break if someone changed it. What was measured, when, by whom and which version got it wrong
 * belongs in the commit message, and in research/ when a later decision will need the evidence.
 *
 * WHAT THIS COUNTS. Comment lines carrying a history marker - "used to", "no longer", "replaced",
 * "was the", "the old X", "shipped", "measured on", "the bug", a bare "P12b" phase id, a "v11.x"
 * version. The regex is the one the 2026-09-21 code quality review measured with, kept so the numbers
 * stay comparable; it OVER-counts a little, because a phase id used as a pointer and a present-tense
 * "now reads" both match. That is why the budget is a CEILING per file rather than a target of zero.
 *
 * WHY A CEILING AND NOT THE REVIEW'S LINE TARGET. Section 3.4 of that review budgeted
 * optimizer_core.js down to about 1,500 comment lines and optimizer_ui.js to about 1,500. Measured on
 * 2026-09-25 the two files carry 3,091 and 2,677 comment lines and 410 history-marked lines BETWEEN
 * them, so the target could only be reached by deleting explanation of what the code does, what it may
 * not do, and which statute it implements - the material 3.4 itself says to keep. The narration is what
 * was worth removing, so the narration is what is pinned.
 *
 * WHEN THIS FAILS, rewrite the comment rather than raising the number. The budget moves DOWN as blocks
 * are trimmed; raising one needs a sentence in the commit message saying why the history had to stay.
 */

const fs = require('fs');

// The review's own marker regex (.planning/code-quality-review/tools/commentscan.js, RX.HIST), plus
// the phase-id and version markers it counted separately.
const HIST = /\b(used to|no longer|previously|formerly|originally|until (?:P\d|v?\d|20\d\d|then|now)|since (?:v?1[01]\.|P\d|20\d\d)|the old\b|old (?:code|version|behaviou?r|test|logic|path|name|copy|order|form|rule|loop|check)|now (?:reads|uses|is|does|returns|takes|calls|lives|sits|runs|shares|carries|comes|reports)|was (?:a|the|an|being|called|named|in|on|once|never|always|only|not|also|wrong|right|read|set|computed|spread|hard)\b|were (?:once|never|always|both|all|two|three)\b|replaced|renamed|retired|shipped|moved (?:here|to|from|out)|introduced|added (?:in|on|by|when|for)|fixed (?:in|on|by|here)|regress\w*|the bug\b|the defect\b|that bug\b|this bug\b|a bug\b|defect\b|reproduc\w*|before (?:this|the) (?:fix|change|phase|refactor)|found (?:by|when|while|on)|caught (?:by|when|it)|measured (?:on|20\d\d)|by construction|hard way|for real\b)/i;

// Measured 2026-09-25 (P134). A number here may fall freely; raising one is a decision to defend.
const BUDGET = {
    'optimizer_core.js':           58,
    'optimizer_ui.js':             97,
    'taxengine.js':                27,
    'taxPaymentPlanner.js':        33,
    'montecarlo/mc_tab.js':        53,
    'montecarlo/mc_engine.js':     11,
    'montecarlo/rails_engine.js':   6,
    'montecarlo/prng.js':          13,
    'montecarlo/mc_controller.js':  6,
    'montecarlo/stats.js':          1,
};

// Comment lines only: a // line, or a line inside a /* */ run. A trailing comment after code counts
// too, which is what the review measured.
function commentLines(src) {
    const out = [];
    let inBlock = false;
    src.split(/\r?\n/).forEach((line, i) => {
        const t = line.trim();
        let isComment = inBlock || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*');
        if (!isComment && /\/\/|\/\*/.test(line)) {
            // A trailing comment, unless the marker sits inside a string or a regex - cheap test:
            // count unescaped quotes before it.
            const at = Math.min(...['//', '/*'].map(m => { const j = line.indexOf(m); return j < 0 ? 1e9 : j; }));
            const before = line.slice(0, at);
            const quotes = (before.match(/(?<!\\)['"`]/g) || []).length;
            if (quotes % 2 === 0) isComment = true;
        }
        if (t.includes('/*') && !t.includes('*/')) inBlock = true;
        if (inBlock && t.includes('*/')) inBlock = false;
        if (isComment) out.push({ n: i + 1, text: line });
    });
    return out;
}

const listFile = process.argv.includes('--list') ? process.argv[process.argv.indexOf('--list') + 1] : null;
const files = listFile ? [listFile] : Object.keys(BUDGET);
const over = [];
let total = 0;

for (const f of files) {
    if (!fs.existsSync(f)) { over.push(`${f} is in the budget but not on disk`); continue; }
    const hits = commentLines(fs.readFileSync(f, 'utf8')).filter(l => HIST.test(l.text));
    total += hits.length;
    if (listFile) {
        console.log(`${f}: ${hits.length} history-marked comment lines`);
        for (const h of hits) console.log(`  ${String(h.n).padStart(5)} ${h.text.trim().slice(0, 150)}`);
        continue;
    }
    const budget = BUDGET[f];
    if (hits.length > budget) over.push(`${f}: ${hits.length} history-marked comment lines, budget ${budget}`);
}

if (listFile) process.exit(0);

if (over.length) {
    console.log('check-comment-history: BLOCKED - a comment narrates history instead of stating the rule:');
    for (const o of over) console.log(`            ${o}`);
    console.log('            node .githooks/check-comment-history.js --list <file> prints the lines.');
    console.log('            Rewrite the comment; the history belongs in this commit\'s message.');
    process.exitCode = 1;
} else {
    console.log(`check-comment-history: ${total} history-marked comment lines across ${files.length} files, all within budget.`);
}

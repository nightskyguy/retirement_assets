'use strict';
/*
 * md-html-scan.js - block raw HTML in markdown that SILENTLY HIDES the rest of the document.
 *
 * WHY THIS EXISTS. On 2026-08-28 the VS Code markdown preview of task_plan.md stopped rendering
 * at line 1304 of 5,734. Not truncation and not a setting: that line contained a bare, unquoted
 * <select> in prose. VS Code's preview passes raw HTML through WITHOUT sanitizing, so the browser
 * parsed it as a real element - and a <select> paints nothing except <option> children. Never
 * being closed, all 4,430 following lines became its children and were silently not painted.
 * progress.md had the same defect at line 974 via a bare <option>, hiding ~4,665 lines.
 *
 * Both survived for weeks because GITHUB SANITIZES markdown HTML and drops non-allowlisted tags,
 * so the files rendered perfectly everywhere they were normally reviewed. Only an unsanitized
 * renderer reproduces it. There is no error, no artifact at the break, and no clue in the source -
 * the document simply appears to end early, which reads as file corruption or an editor limit.
 *
 * WHAT IS AND IS NOT BLOCKED. A blanket "no raw HTML" rule was measured and rejected: the 27
 * tracked .md files hold 181 bare tags, and 172 are legitimate <a> anchors in the changelog.
 * <a>, <b>, <span>, <li>, <details>, <img>, <br>, <kbd> all render their children normally and
 * are none of this script's business, closed or not.
 *
 * The denylist below is exactly the elements whose CONTENT MODEL EXCLUDES FLOW CONTENT. An
 * unclosed one does not merely look wrong, it makes everything after it invisible. That is the
 * whole failure class, and it is why this is a denylist and not a parser: detecting "unclosed"
 * properly needs a real HTML parse, while naming the ~11 elements that can swallow a document
 * needs none and has no false positives on this corpus.
 *
 * THE FIX IS ALWAYS THE SAME: wrap it in backticks. `<select>` renders the tag visibly instead
 * of executing it, and matches this repo's own convention - every other code identifier in the
 * planning docs is already backticked.
 *
 * SCOPE. Fenced blocks and inline code spans are skipped. Indented (4-space) code blocks are NOT
 * detected, deliberately: distinguishing one from a wrapped list item needs a real markdown parse.
 * If a denylisted tag ever belongs in an indented block, fence it or backtick it - both are
 * clearer anyway, and the error message says so.
 *
 * Run standalone:  node .githooks/md-html-scan.js [file.md ...]
 * With no arguments it scans every tracked *.md. Exit 1 on any hit.
 */

const fs = require('fs');
const { execSync } = require('child_process');

// Elements that hide their children. <title>/<style>/<script>/<textarea>/<xmp>/<plaintext> take
// raw text, <option>/<optgroup> take text only, <select> paints only options, <iframe> and
// <template> never render inline children at all.
const SWALLOWS = new Set([
    'select', 'option', 'optgroup', 'textarea', 'title', 'style',
    'script', 'noscript', 'iframe', 'template', 'xmp', 'plaintext', 'listing',
]);

const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

function scan(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); }
    catch { return []; }                       // deleted/renamed in this commit; not our problem

    const hits = [];
    let inFence = false;
    text.split(/\r?\n/).forEach((line, i) => {
        if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return; }
        if (inFence) return;
        const bare = line.replace(/`[^`]*`/g, '');   // inline code spans are already safe
        for (const m of bare.matchAll(TAG)) {
            const name = m[1].toLowerCase();
            if (SWALLOWS.has(name)) hits.push({ file, line: i + 1, tag: m[0], name });
        }
    });
    return hits;
}

let files = process.argv.slice(2);
if (!files.length) {
    try {
        files = execSync('git ls-files "*.md"', { encoding: 'utf8' })
            .trim().split(/\r?\n/).filter(Boolean);
    } catch {
        console.error('md-html-scan: cannot list tracked files; is this a work tree?');
        process.exit(1);
    }
}

const hits = files.flatMap(scan);

if (hits.length) {
    console.error(`md-html-scan: BLOCKED - ${hits.length} raw HTML tag(s) that hide the rest of the file:`);
    for (const h of hits) console.error(`    ${h.file}:${h.line}  ${h.tag}`);
    console.error('');
    console.error('    A <' + hits[0].name + '> renders none of its children, and these are not closed, so every');
    console.error('    line after it vanishes from any UNSANITIZED preview (VS Code). GitHub strips the');
    console.error('    tag and looks fine, which is why this kind of break hides for weeks.');
    console.error('');
    console.error('    FIX: wrap it in backticks - `<' + hits[0].name + '>` - matching the convention every');
    console.error('    other code identifier in these docs already follows.');
    process.exit(1);
}

const label = process.argv.length > 2 ? `${files.length} file(s)` : `${files.length} tracked .md`;
console.log(`md-html-scan: ${label} clean.`);

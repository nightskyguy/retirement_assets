'use strict';
/*
 * md-html-scan.js - block raw HTML in markdown that SILENTLY HIDES the rest of the document.
 *
 * WHY THIS EXISTS. On 2026-08-28 the VS Code markdown preview of task_plan.md stopped rendering
 * at line 1304 of 5,734. Not truncation and not a setting: that line contained a bare, unquoted
 * <select> in prose. VS Code's preview passes raw HTML through WITHOUT sanitizing, so the browser
 * parsed it as a real element - and a <select> paints nothing except <option> children. Never
 * being closed, all 4,430 following lines became its children and were silently not painted.
 * progress.md had the same class of defect at line 3695 via a bare <details>, hiding ~1,944 lines:
 * an unclosed <details> is CLOSED by default, so everything after it collapses into it.
 *
 * Both survived for weeks because GITHUB SANITIZES markdown HTML and drops non-allowlisted tags,
 * so the files rendered perfectly everywhere they were normally reviewed. Only an unsanitized
 * renderer reproduces it. There is no error, no artifact at the break, and no clue in the source -
 * the document simply appears to end early, which reads as file corruption or an editor limit.
 *
 * TWO FAILURE MODES, and the second was missed on the first pass. An unclosed <b> at
 * progress.md:4447 did not HIDE anything - every following line was still there, just bold. The
 * original check only ever asked "did the text disappear", so no amount of that measurement could
 * have caught it. The user found it by reading. Hence rule B.
 *
 *   A. HIDES     - a bare hiding element, closed or not. Balance is irrelevant here: even a
 *                  properly paired <select>...</select> paints nothing but its options.
 *   B. CORRUPTS  - any element whose open and close counts differ within a file. An unclosed <b>
 *                  bolds the rest of the document, an unclosed <a> makes the remainder one link,
 *                  an unclosed <li> emits a stray bullet and pulls what follows into a list item.
 *
 * WHAT IS AND IS NOT BLOCKED. A blanket "no raw HTML" rule was measured and rejected: the 27
 * tracked .md files hold 181 bare tags, and 172 are legitimate <a> anchors in the changelog -
 * every one of them correctly PAIRED, which is exactly why rule B tests balance and not presence.
 * Real markup passes untouched; only unclosed markup fails.
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
 * detected, deliberately: telling one from a wrapped list item needs a real markdown parse. A tag
 * inside an indented block is therefore reported - fence it instead, which is clearer anyway and
 * is what p71_probe/README.md was converted to. Void elements (<br>, <img>, <hr>, ...) and
 * self-closing tags are exempt from rule B, since they never take a closing tag.
 *
 * Run standalone:  node .githooks/md-html-scan.js [file.md ...]
 * With no arguments it scans every tracked *.md. Exit 1 on any hit.
 */

const fs = require('fs');
const { execSync } = require('child_process');

// MEASURED, not reasoned. The first version of this list was written from the HTML spec and was
// wrong in BOTH directions: it blocked option/optgroup/xmp/plaintext/listing, which do NOT hide
// anything, and it missed details/object/dialog, which do - and a bare <details> was live in
// progress.md at the time. Guessing content models is exactly the mistake this file exists to
// catch someone else making.
//
// Re-derive rather than edit by hand. Paste into any browser console; every tag whose following
// content disappears belongs here:
//
//   for (const tag of ['select','details','yourTagHere']) {
//     const f = document.createElement('iframe'); document.body.appendChild(f);
//     const d = f.contentDocument; d.open();
//     d.write('<p>BEFORE <' + tag + '> here.</p><p>SENT</p>'); d.close();
//     console.log(tag, (d.body.innerText||'').includes('SENT') ? 'safe' : 'HIDES');
//     f.remove();
//   }
//
// Run 2026-08-28 over 57 candidate elements; these 11 hid their following content. <option>,
// <optgroup>, <table>, <tr>, <li>, <b>, <span>, <a>, <summary>, <pre> and 36 others did not.
const SWALLOWS = new Set([
    'select', 'textarea', 'title', 'style', 'script', 'noscript',
    'iframe', 'template', 'details', 'object', 'dialog',
]);

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;

// Never take a closing tag, so they can never be "unbalanced" under rule B.
const VOID = new Set([
    'br', 'img', 'hr', 'input', 'meta', 'link', 'source',
    'area', 'base', 'col', 'embed', 'param', 'track', 'wbr',
]);

function scan(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); }
    catch { return []; }                       // deleted/renamed in this commit; not our problem

    const hits = [];
    const open = {}, close = {}, firstAt = {};
    let inFence = false;
    text.split(/\r?\n/).forEach((line, i) => {
        if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return; }
        if (inFence) return;
        const bare = line.replace(/`[^`]*`/g, '');   // inline code spans are already safe
        for (const m of bare.matchAll(TAG)) {
            const name = m[2].toLowerCase();
            // Rule A - hides everything after it, whether or not it is closed.
            if (SWALLOWS.has(name) && !m[1]) hits.push({ kind: 'hides', file, line: i + 1, tag: m[0], name });
            // Rule B bookkeeping. Void and self-closed tags never pair, so they cannot be unbalanced.
            if (VOID.has(name) || m[3]) continue;
            if (m[1]) close[name] = (close[name] || 0) + 1;
            else { open[name] = (open[name] || 0) + 1; if (!firstAt[name]) firstAt[name] = i + 1; }
        }
    });
    for (const name of new Set([...Object.keys(open), ...Object.keys(close)])) {
        const o = open[name] || 0, c = close[name] || 0;
        if (o !== c) hits.push({ kind: 'unbalanced', file, line: firstAt[name] || 1, name, open: o, close: c });
    }
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
    console.error(`md-html-scan: BLOCKED - ${hits.length} raw HTML problem(s) in markdown:`);
    for (const h of hits.filter(x => x.kind === 'hides'))
        console.error(`    ${h.file}:${h.line}  ${h.tag}  HIDES everything after it`);
    for (const h of hits.filter(x => x.kind === 'unbalanced'))
        console.error(`    ${h.file}:${h.line}  <${h.name}> UNBALANCED (open=${h.open} close=${h.close})`);
    console.error('');
    console.error('    VS Code previews markdown WITHOUT sanitizing, so a raw tag is parsed as a real');
    console.error('    element. A hiding element paints none of its children; an unclosed one styles or');
    console.error('    wraps every line after it. GitHub strips these and looks perfect, which is why');
    console.error('    such a break survives review.');
    console.error('');
    console.error('    FIX: wrap the tag in backticks - matching the convention every other code identifier');
    console.error('    in these docs already follows. Real PAIRED markup is fine and is never reported; a');
    console.error('    tag inside an INDENTED code block is - fence it instead.');
    process.exit(1);
}

const label = process.argv.length > 2 ? `${files.length} file(s)` : `${files.length} tracked .md`;
console.log(`md-html-scan: ${label} clean.`);

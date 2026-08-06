'use strict';
/**
 * doclinks.tests.js
 * Run with: node doclinks.tests.js
 *
 * Covers the pure half of doclinks.js: docHref(), the map from a .md href on disk to the
 * .html page Jekyll publishes on GitHub Pages, and docLabel(), which keeps a link whose
 * visible text is a filename honest about where it now points.
 *
 *   1. Plain .md -> .html, with #hash and ?query preserved
 *   2. README.md -> the directory index, never README.html (that URL 404s)
 *   3. Absolute URLs untouched (the theme's "Improve this page" edit link)
 *   4. Non-.md hrefs untouched
 *   5. Dot-directories untouched (Jekyll never publishes them, in any form)
 *   6. rendered=false is a straight pass-through, so local use is unaffected
 *   7. sourceFile maps a rendered page back to the .md it was generated from
 *   8. docLabel swaps a filename label to match the rewritten href, and leaves every
 *      descriptive label ("Details", "Improve this page") alone
 */

const DocLinks = require('./doclinks.js');
const docHref = DocLinks.docHref;

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗  ${name}`);
    console.log(`       ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// Asserts both directions at once: what the live site gets, and that a local page is
// left exactly as authored.
function maps(input, expected) {
  const got = docHref(input, true);
  assert(got === expected, `rendered: "${input}" -> "${got}", expected "${expected}"`);
  const local = docHref(input, false);
  assert(local === input, `local: "${input}" was rewritten to "${local}"`);
}

function unchanged(input) {
  maps(input, input);
}

// ── 1. Plain .md -> .html ──────────────────────────────────────────────────

test('bare .md becomes .html', () => {
  maps('optimizer_changelog.md', 'optimizer_changelog.html');
});

test('per-version anchor is preserved', () => {
  maps('optimizer_changelog.md#11.13bd', 'optimizer_changelog.html#11.13bd');
  maps('ARCHITECTURE.md#1-module-dependency-graph', 'ARCHITECTURE.html#1-module-dependency-graph');
});

test('query string is preserved', () => {
  maps('ARCHITECTURE.md?v=1', 'ARCHITECTURE.html?v=1');
  maps('ARCHITECTURE.md?v=1#top', 'ARCHITECTURE.html?v=1#top');
});

test('subdirectory and parent-relative paths keep their prefix', () => {
  maps('docs/notes.md', 'docs/notes.html');
  maps('../ARCHITECTURE.md', '../ARCHITECTURE.html');
  maps('./ARCHITECTURE.md#x', './ARCHITECTURE.html#x');
});

test('uppercase extension is handled', () => {
  maps('ARCHITECTURE.MD', 'ARCHITECTURE.html');
});

// ── 2. README.md is the index, not README.html ─────────────────────────────

test('root README.md maps to the directory, not README.html', () => {
  // Verified against the live site: /README.html returns 404, / returns the rendered README.
  maps('README.md', './');
  maps('readme.md', './');
});

test('README.md in a subdirectory maps to that directory', () => {
  maps('standalone/README.md', 'standalone/');
  maps('../README.md#faq', '../#faq');
});

// ── 3. Absolute URLs untouched ─────────────────────────────────────────────

test('the theme edit link is left alone', () => {
  unchanged('https://github.com/nightskyguy/retirement_assets/edit/main/optimizer_changelog.md');
});

test('other schemes and protocol-relative URLs are left alone', () => {
  unchanged('http://example.com/x.md');
  unchanged('//example.com/x.md');
  unchanged('mailto:someone@example.com');
});

test('site-absolute .md is still rewritten', () => {
  maps('/optimizer_changelog.md#11.1370', '/optimizer_changelog.html#11.1370');
});

// ── 4. Non-.md hrefs untouched ─────────────────────────────────────────────

test('html, js and fragment hrefs are left alone', () => {
  unchanged('retirement_optimizer.html');
  unchanged('optimizer_changelog.html#11.13bd');
  unchanged('#faq');
  unchanged('doclinks.js?v=1113c5');
  unchanged('');
});

test('a path that merely contains .md is not a match', () => {
  unchanged('notes.md.html');
  unchanged('mdfile.txt');
});

// ── 5. Dot-directories untouched ───────────────────────────────────────────

test('.planning links are left as-is because Jekyll never publishes them', () => {
  // Both the .md and a hypothetical .html 404 there, so do not pretend otherwise.
  unchanged('.planning/retirement-optimizer/task_plan.md');
  unchanged('./.planning/retirement-optimizer/findings.md');
});

// ── 6. Pass-through and bad input ──────────────────────────────────────────

test('non-string input is returned as given', () => {
  assert(docHref(null, true) === null, 'null');
  assert(docHref(undefined, true) === undefined, 'undefined');
});

// ── 7. sourceFile: rendered page back to the .md it came from ──────────────

test('sourceFile maps a rendered page back to its source .md', () => {
  const src = DocLinks.sourceFile;
  assert(src('/ARCHITECTURE.html') === 'ARCHITECTURE.md', 'ARCHITECTURE');
  assert(src('/optimizer_changelog.html') === 'optimizer_changelog.md', 'changelog');
  // The index is the rendered README, and Pages serves it at both / and /index.html.
  assert(src('/index.html') === 'README.md', 'index.html');
  assert(src('/') === 'README.md', 'root');
});

// ── 8. docLabel: a link labelled with a filename must not lie ──────────────
// Rewriting the href alone left the page reading "optimizer_changelog.md" while the link
// went to the .html. Only filename labels get swapped; descriptive text never does.

test('a label that is exactly the old filename follows the href', () => {
  const lbl = DocLinks.docLabel;
  assert(lbl('optimizer_changelog.md', 'optimizer_changelog.md', 'optimizer_changelog.html')
         === 'optimizer_changelog.html', 'bare filename');
  assert(lbl('optimizer_changelog.md', 'optimizer_changelog.md#11.13a1', 'optimizer_changelog.html#11.13a1')
         === 'optimizer_changelog.html', 'anchored href, filename label');
  assert(lbl('ARCHITECTURE.md', 'docs/ARCHITECTURE.md', 'docs/ARCHITECTURE.html')
         === 'ARCHITECTURE.html', 'label is the basename of a deeper path');
});

test('surrounding whitespace in the label survives', () => {
  assert(DocLinks.docLabel('\n\t optimizer_changelog.md \n', 'optimizer_changelog.md', 'optimizer_changelog.html')
         === '\n\t optimizer_changelog.html \n', 'padding lost');
});

test('descriptive labels are never touched', () => {
  const lbl = DocLinks.docLabel;
  ['Details', 'the changelog', 'Improve this page', 'optimizer_changelog', 'See optimizer_changelog.md'
  ].forEach(t => {
    assert(lbl(t, 'optimizer_changelog.md', 'optimizer_changelog.html') === t, `relabelled "${t}"`);
  });
});

test('README keeps its name, since the index has no filename to show', () => {
  // docHref('README.md') is './' — there is no .html basename to swap in, and "README.md"
  // is still the honest name of what lives at the site root.
  assert(DocLinks.docLabel('README.md', 'README.md', './') === 'README.md', 'README relabelled');
});

test('an unchanged href never relabels', () => {
  const lbl = DocLinks.docLabel;
  assert(lbl('optimizer_changelog.md', 'optimizer_changelog.md', 'optimizer_changelog.md')
         === 'optimizer_changelog.md', 'no-op href');
  // Local pages: docHref returns the input, so this is the path every local run takes.
  const href = 'optimizer_changelog.md#11.13a1';
  assert(lbl('optimizer_changelog.md', href, docHref(href, false)) === 'optimizer_changelog.md',
         'local run relabelled');
});

test('non-string label is returned as given', () => {
  assert(DocLinks.docLabel(null, 'a.md', 'a.html') === null, 'null');
  assert(DocLinks.docLabel(undefined, 'a.md', 'a.html') === undefined, 'undefined');
});

test('the DOM half of the module is exported', () => {
  ['isRendered', 'rewriteLinks', 'captionMermaid', 'addBackLink', 'init'].forEach(fn => {
    assert(typeof DocLinks[fn] === 'function', `${fn} missing`);
  });
});

// ── Summary ───────────────────────────────────────────────────────────────
console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n*** SOME TESTS FAILED ***');
  process.exitCode = 1;
} else {
  console.log('All tests passed.');
}

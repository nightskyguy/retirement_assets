#!/usr/bin/env node
'use strict';
/**
 * check-architecture.js - every script the repo ships is named in ARCHITECTURE.md, and every file the
 * file reference table names exists.
 *
 * Run by .githooks/pre-commit. Standalone: `node .githooks/check-architecture.js`.
 *
 * WHY. ARCHITECTURE.md is the map a reader uses to find what loads what and where an entry point
 * lives. A new file that is not on it is invisible there, and nothing else notices: the suites pass,
 * the page works. taxcalc_core.js and taxcalc.js were added without a row on 2026-11-04, and
 * feedback.js, sharepanel.js and two of this directory's own checks had been missing for longer.
 *
 * WHAT IT CHECKS, both directions.
 *   1. Every tracked script (.js) and stylesheet (.css) at the repo root, every .js under montecarlo/,
 *      and every .js in .githooks/ appears in ARCHITECTURE.md: by its path, or for a root or hook file
 *      by its bare name. A root `foo.js` is not satisfied by `foo.js.map` or `a-foo.js`.
 *   2. Every file or directory named in the FIRST column of the section 6 file reference table exists,
 *      so a rename or a deletion cannot leave a row pointing at nothing.
 *
 * WHAT IT CANNOT CHECK. Whether the module dependency graph (section 1) draws the new file and its
 * edges. That is a drawing, and the check cannot tell a missing edge from an intended one. The
 * failure message says so, so the graph is a prompt and not a forgotten step.
 *
 * NOT IN SCOPE, on purpose: the HTML pages under standalone/ and their data files (separate tools
 * with their own pages, not part of the Optimizer's module graph), research/, plans/ and
 * .test_harnesses/ (each has its own index). A page that is a handoff target or loads a shared engine
 * gets a row by hand, as RetirementTaxPlanner.html and IncomeTaxPlanner.html have.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const doc = fs.readFileSync(path.join(root, 'ARCHITECTURE.md'), 'utf8');

const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);

// The files a reader of the map needs to find.
function inScope(f) {
  if (!f.includes('/')) return /\.(js|css)$/.test(f);
  if (f.startsWith('montecarlo/')) return /^montecarlo\/[^/]+\.js$/.test(f);
  if (f.startsWith('.githooks/')) return /^\.githooks\/[^/]+\.js$/.test(f);
  return false;
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function isNamed(f) {
  if (doc.includes(f)) return true;                       // the full path, as the montecarlo rows write it
  if (f.startsWith('montecarlo/')) return false;          // worker.js alone would be ambiguous
  const bare = f.split('/').pop();
  return new RegExp('(?<![\\w./-])' + escapeRe(bare) + '(?![\\w-])').test(doc);
}

const unlisted = tracked.filter(inScope).filter(f => !isNamed(f));

// Section 6, first column: | `name` | layer | ...
const section = doc.split(/^## 6\. File reference\s*$/m)[1] || '';
const table = section.split(/^### /m)[0];
const rows = [...table.matchAll(/^\| `([^`]+)` \|/gm)].map(m => m[1]);
const dangling = rows.filter(name => !fs.existsSync(path.join(root, name)));

if (!rows.length) {
  console.log('check-architecture: BLOCKED - the section 6 file reference table was not found in ARCHITECTURE.md.');
  console.log('            The check reads the heading "## 6. File reference"; if it was renamed, update this script.');
  process.exit(1);
}

if (unlisted.length || dangling.length) {
  console.log('check-architecture: BLOCKED - ARCHITECTURE.md and the files on disk disagree.');
  if (unlisted.length) {
    console.log('  Not named anywhere in ARCHITECTURE.md:');
    for (const f of unlisted) console.log('    ' + f);
    console.log('  Add a row to the section 6 file reference table. If the file loads, or is loaded or');
    console.log('  required by, another file, draw it in the section 1 module dependency graph as well:');
    console.log('  this check cannot see the graph.');
  }
  if (dangling.length) {
    console.log('  Named in the section 6 table but not on disk:');
    for (const f of dangling) console.log('    ' + f);
    console.log('  Remove or correct the row.');
  }
  process.exit(1);
}

console.log(`check-architecture: ${tracked.filter(inScope).length} scripts and stylesheets all named in ARCHITECTURE.md, and all ${rows.length} table rows exist.`);

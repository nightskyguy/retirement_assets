'use strict';
// node sitecount.js <repo> <file>... : number of mutation sites per file, by operator class,
// and a syntax check of 40 sampled mutants per file (node --check).
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const { sites } = require('./mutsites.js');
const repo = process.argv[2];
for (const rel of process.argv.slice(3)) {
    const src = fs.readFileSync(path.join(repo, rel), 'utf8');
    const all = sites(src, {});
    const by = {};
    for (const s of all) { const c = s.op.split(':')[0]; by[c] = (by[c] || 0) + 1; }
    const fns = new Set(all.map(s => s.fn));
    let bad = 0;
    const step = Math.max(1, Math.floor(all.length / 40));
    const tmp = path.join(os.tmpdir(), 'mutcheck_' + process.pid + path.extname(rel));
    for (let i = 0; i < all.length; i += step) {
        const s = all[i];
        fs.writeFileSync(tmp, src.slice(0, s.start) + s.replacement + src.slice(s.end));
        const r = cp.spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
        if (r.status !== 0) { bad++; if (bad <= 3) console.log('  SYNTAX FAIL', rel + ':' + s.line, s.op, (r.stderr || '').split('\n')[0]); }
    }
    try { fs.unlinkSync(tmp); } catch (e) { }
    console.log(rel, 'sites=' + all.length, 'functions=' + fns.size, JSON.stringify(by), 'syntaxBad=' + bad);
}

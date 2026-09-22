Evidence and tooling behind ../CODE_QUALITY_REVIEW.md (review of main @ f6783e6, 2026-09-21).

tools/  jslex.js (lexer), inventory.js (literals + comments), commentscan.js, clones.js, fndups.js,
        enumscan.js, ukscan.js + uktables.js, testinv.js, inpageinv.js, inpage_runner.js (runs
        optimizer_tests.js under node with a stubbed DOM), mutsites.js + mutate.js (mutation testing
        on sandbox copies, never on the repo), mutreport.js / testreport.js (tables), assemble.js.
cfg/    one mutation config per target. The paths inside (repo, sandboxRoot, out) point at the
        session scratchpad they were run from; edit them before re-running. core and inpage_core
        were run in full; the other targets were skipped for time.
out/    raw results: mut_core.jsonl and mut_inpage_core.jsonl (one record per mutant), timing_*.tsv
        (per-test wall time), uk_hits.tsv, clones_*.json, comment_detail.json, testinv.json,
        inpageinv.json, enums.tsv, nums/ and comments/ are not copied (regenerate with inventory.js).

Nothing here is loaded by any page or suite. Delete the directory when the review has been acted on.

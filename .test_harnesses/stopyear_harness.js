/**
 * stopyear_harness.js -- Phase P24 evidence harness (kept in .test_harnesses/).
 * The production search now lives in optimizer_core.js as bestConversionStopYear().
 *
 * Answers: "when should a plan STOP converting?" by re-running the plan with the
 * conversion schedule truncated at every possible cutoff and scoring each truncation
 * on after-tax net worth at a shared heirs rate.
 *
 * HOW TO RUN
 *   1. python -m http.server 8767   (or the retirement-optimizer launch.json entry)
 *   2. Open retirement_optimizer.html with the scenario URL you want to measure.
 *   3. Paste this whole file into the browser console.
 *   4. Call the reporters at the bottom, e.g.  console.log(EV2.reportStopYear());
 *
 * WHY IN THE BROWSER: getInputs() is the only faithful decoder of a share URL plus the
 * markup defaults. Re-implementing it in node drifts silently. Cost is not a problem:
 * one 27-cutoff sweep of a 26-year plan is ~46ms.
 *
 * TWO TRUNCATION MODES
 *   'all'   -- suppress ALL conversion activity from the cutoff on (strategy bracket-fill
 *              surplus AND Extra Annual Roth Conversion). Uses the engine's existing
 *              _cfSuppressConversionsFromYear counterfactual flag.
 *   'extra' -- suppress ONLY the Extra Annual Roth Conversion; the strategy keeps filling
 *              brackets to the end. Needs no engine flag: extraConversionAmount already
 *              accepts a per-year ARRAY, so the cutoff is expressed as a zero tail.
 *
 * SCORING: afterTaxNetWorth(terminal, heirs, capGainsRate) at a SHARED heirs rate, so all
 * truncations are comparable. Note futureIRATaxRate is a VALUATION input only -- it never
 * changes plan mechanics, so it cannot move the optimal stop year. Vary the heirs rate in
 * score(), not in the inputs, or every scenario will report an identical optimum.
 */
window.EV2 = {
    /**
     * Re-runs `inputs` once per cutoff and returns the raw terminal state of each, so any
     * number of heirs rates can be scored afterward without re-simulating.
     * cut === 0 means "no conversions at all"; cut === n means "the plan as configured".
     * lastConvYear is the last calendar year conversions were still allowed to run.
     */
    sweep(inputs, mode) {
        const rows = [];
        const probe = simulate({ ...inputs, computeOC: true });
        const n = probe.log.length, start = probe.log[0].year;
        for (let cut = 0; cut <= n; cut++) {
            let inp;
            if (mode === 'all') {
                inp = { ...inputs, _cfSuppressConversionsFromYear: cut };
            } else {
                const amt = inputs.extraConversionAmount || 0;
                inp = { ...inputs, extraConversionAmount: new Array(n + 2).fill(0).map((_, y) => y < cut ? amt : 0) };
            }
            const r = simulate({ ...inp, computeOC: true });
            rows.push({
                cut, lastConvYear: cut === 0 ? null : start + cut - 1,
                t: { ...r.totals.terminal }, cg: r.totals.capGainsRate,
                tax: r.totals.tax, spend: r.totals.spend, be: r.totals.convBEYear,
                success: r.totals.success,
                conv: r.log.reduce((s, x) => s + (x.rothConv ?? 0), 0)
            });
        }
        return { start, n, planEnd: start + n - 1, rows };
    },

    score(row, heirs) { return afterTaxNetWorth(row.t, heirs, row.cg); },

    /**
     * Argmax by after-tax NW. LINEAR, deliberately: the sweep is NOT unimodal (measured up
     * to 7 first-difference sign flips), because the bracket/IRMAA tables are step
     * functions. A ternary or binary search converges on the wrong cutoff with no way to
     * detect it -- the same reasoning diagnoseConvBreakEvenFailure() already documents.
     */
    best(sw, heirs) {
        let b = sw.rows[0];
        for (const r of sw.rows) if (this.score(r, heirs) > this.score(b, heirs)) b = r;
        return b;
    },

    /** Full per-cutoff table for the current sidebar scenario. */
    reportStopYear(over = {}, heirs = 0.33, mode = 'all') {
        const sw = this.sweep({ ...getInputs(), ...over }, mode);
        return 'cut\tlastConv\tatnw$k\ttax$k\tBE\tconv$k\tira$k\troth$k\n' + sw.rows.map(r =>
            [r.cut, r.lastConvYear ?? '', Math.round(this.score(r, heirs) / 1000), Math.round(r.tax / 1000),
             r.be ?? '', Math.round(r.conv / 1000), Math.round(r.t.ira / 1000), Math.round(r.t.roth / 1000)].join('\t')
        ).join('\n');
    },

    /**
     * Joint (amount, stop year) grid. Reports the four policies that matter:
     *   A = plan as configured (no stop)         B = best stop year at the configured amount
     *   D = best amount, no stop  <-- what the optimizer's existing 'Optimize Conversions'
     *                                 (⇌) pass searches today
     *   C = best (amount, stop year) jointly
     * C-D is the value the stop-year axis would add to the optimizer.
     */
    reportPolicies(over = {}, heirs = 0.33, amounts = null) {
        const base = { ...getInputs(), ...over };
        const cfgAmt = base.extraConversionAmount || 0;
        const AMTS = amounts || (() => { const a = [cfgAmt]; for (let x = 0; x <= 400000; x += 25000) a.push(x); return a; })();
        let A = null, B = null, C = null, D = null, Bc = null, Cc = null, Ca = null, Da = null, none = null;
        for (const a of AMTS) {
            const sw = this.sweep({ ...base, extraConversionAmount: a }, 'all');
            const full = sw.rows[sw.rows.length - 1], b = this.best(sw, heirs);
            const sf = this.score(full, heirs), sb = this.score(b, heirs);
            if (none == null) none = this.score(sw.rows[0], heirs);
            if (D == null || sf > D) { D = sf; Da = a; }
            if (C == null || sb > C) { C = sb; Cc = b.lastConvYear; Ca = a; }
            if (a === cfgAmt) { A = sf; B = sb; Bc = b.lastConvYear; }
        }
        return { noConv: none, A, B, Byear: Bc, D, Damt: Da, C, Camt: Ca, Cyear: Cc, BminusA: B - A, CminusD: C - D, CminusA: C - A };
    }
};

'use strict';
// taxcalc_core.js - the Income Tax Planner's calculation, with no page in it.
//
// Loaded by standalone/IncomeTaxPlanner.html (a classic <script>, after taxengine.js and
// medicare_costs.js) and by taxcalc.js (node). Both ask for a result the same way, so a link and a
// command line give the same line. The page keeps the DOM, the chart and the controls; everything
// that turns inputs into tax lives here.
//
//   TaxCalc.configFromParams(get)  link keys -> { cfg, errors, pin, given }
//   TaxCalc.returnSpec(get)        the `return` / `result` key -> { names } or null
//   TaxCalc.create(cfg)            the calculation bound to one mutable cfg object
//   TaxCalc.run(get)               the whole thing for a command line: { ok, csv, ... }
//
// `get(key)` returns the string a key carries, or null when it is absent - URLSearchParams.get does.
// The field names and their meaning are documented in UsageGuide.md. Add fields at the END of
// RESULT_FIELDS and never rename one: other people's sheets read the line by position. `return=all`
// is inputs first and calculated fields second, each after a marker column.

(function (root) {
  // Inside this function scope the engine names are bare globals in a browser and a require() in node.
  const ENG = (typeof module !== 'undefined' && module.exports)
    ? Object.assign({}, require('./taxengine.js'), require('./medicare_costs.js'))
    : { TAXData, calculateTaxes, calcIRMAA, netCapitalLosses, getIRMAATiers, medicareGrowthFactor, MEDICARE_COSTS };
  const { TAXData: TD, calculateTaxes: calcTaxes, calcIRMAA: irmaaCharge, netCapitalLosses: netLosses,
          getIRMAATiers: tiersOf, medicareGrowthFactor: medGrowth, MEDICARE_COSTS: MED } = ENG;

  const BASE_YEAR = TD.FEDERAL.YEAR;        // the year the tax tables are stated in
  const YEARS_AHEAD = 9;                    // the tax year runs BASE_YEAR .. BASE_YEAR + 9
  const IRMAA_AHEAD = -TD.IRMAA.LOOKBACK;   // IRMAA is charged from the MAGI of two years back
  const IRMAA_TIERS_SHOWN = 5;              // the paying tiers; the top row is a terminator, not a band
  const obbaSalt = TD.OBBBA.SALT;
  const obbaSen  = TD.OBBBA.SENIOR_DED;

  // One row per Income details entry: its link key, its cfg name, and whether a negative amount means
  // something (a business loss, a short-term capital loss).
  const DETAIL_FIELDS = [
    { key:'wg', cfg:'wages',            neg:true  },
    { key:'it', cfg:'interest',         neg:false },
    { key:'nd', cfg:'ndiv',             neg:false },
    { key:'sg', cfg:'stcg',             neg:true  },
    { key:'ri', cfg:'retirementIncome', neg:false },
    { key:'rd', cfg:'rmd',              neg:false },
    { key:'rc', cfg:'rothConv',         neg:false },
    { key:'rt', cfg:'taxWithdrawal',    neg:false },
    { key:'ot', cfg:'other',            neg:true  },
    { key:'qd', cfg:'qdiv',             neg:false },
    { key:'mu', cfg:'muni',             neg:false },
    { key:'ui', cfg:'usInt',            neg:false },
    { key:'sm', cfg:'stMuni',           neg:false },
    { key:'un', cfg:'untaxed',          neg:false },
    { key:'pt', cfg:'propTax',          neg:false },
  ];

  // The amount an entry means: a number, not below 0 unless the entry may be negative.
  const detailValue = (f, v) => Number.isFinite(v) ? (f.neg ? v : Math.max(0, v)) : 0;
  const wholeDollars = v => Math.sign(v) * Math.round(Math.abs(v));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function newConfig() {
    return {
      status:'MFJ', state:'CA', ages:[65, 65],
      ssIncome:0, propTax:0,
      retirementIncome:0, retirementSwept:false,
      rmd:0,                       // required minimum distribution: ordinary income, and retirement income for the states that exempt it
      rothConv:0,                  // Roth conversion: ordinary income, and retirement income for the states that exempt it
      taxWithdrawal:0,             // IRA withdrawal taken to pay the tax: the same kind of income as a Roth conversion
      autoTax:false,               // true: taxWithdrawal is not an entry, deriveIncome() sets it to the amount that covers the tax
      wages:0, interest:0, ndiv:0, stcg:0, other:0, qdiv:0,
      muni:0, usInt:0, stMuni:0,   // tax-exempt interest, its state-exempt Treasury part, and the part a state taxes
      untaxed:0,                   // money that came in untaxed (Roth, cash): in gross income, in no tax
      cgSale:0, cgBasisPct:60,
      // Derived from the entries above by deriveIncome(), never set directly:
      ltNet:0,          // long-term gain left after netting a short-term loss against it
      stOrd:0,          // short-term result that joins ordinary income (a capped net loss is negative)
      carry:0,          // net capital loss that does not offset anything this year
      usIntEff:0,       // Treasury interest, limited to the Interest entered
      stMuniEff:0,      // municipal interest a state taxes, limited to the municipal interest entered
      entOrdinary:0,    // everything entered under Ordinary income, added up
      year:BASE_YEAR, inflation:2.5,
      prevMagi:null,    // MAGI from year - 2, or null when not entered; only the IRMAA-in-force line reads it
      // OBBBA is current law, so it is always on. calcAt() gates each provision on its own sunset year.
      obbaOn:true, saltHigh:true
    };
  }

  // ─── LINK KEYS -> CONFIG ───────────────────────────────────────────────────
  // Every value is brought to what the page's control would hold after the same link: the sliders
  // snap to their steps and stop at their ends, and the entries that show as whole dollars are
  // rounded to them.
  function configFromParams(get) {
    const cfg = newConfig();
    const errors = [], given = new Set();
    let pin = null;
    const raw = k => { const s = get(k); return s === null || s === undefined ? null : String(s); };
    const num = k => { const s = raw(k); if (s === null || s.trim() === '') return null; const v = +s; return Number.isFinite(v) ? v : null; };
    const take = (k, fn) => { const v = num(k); if (v !== null) { fn(v); given.add(k); } };

    const st = raw('st');
    if (st !== null) {
      if (st === 'MFJ' || st === 'SGL') { cfg.status = st; given.add('st'); }
      else errors.push('unknown filing status ' + st);
    }
    const s = raw('s');
    if (s !== null) {
      const code = s.trim().toUpperCase();
      // A code that is not in the tables is an ERROR, never a quiet fallback to California.
      if (TD[code] && TD[code].STATE !== undefined) { cfg.state = code; given.add('s'); }
      else errors.push('unknown state ' + s);
    }
    take('a1', v => { cfg.ages[0] = v || 40; });
    take('a2', v => { cfg.ages[1] = v || 40; });
    take('ss', v => { cfg.ssIncome = Math.max(0, v); });
    for (const f of DETAIL_FIELDS) take(f.key, v => { cfg[f.cfg] = wholeDollars(detailValue(f, v)); });
    const rw = raw('rw');
    if (rw !== null) { cfg.retirementSwept = rw === '1'; given.add('rw'); }
    const ra = raw('ra');
    if (ra !== null) { cfg.autoTax = ra === '1'; given.add('ra'); }
    take('pm', v => { cfg.prevMagi = v >= 0 ? wholeDollars(v) : null; });
    take('cs', v => { cfg.cgSale = Math.max(0, v); });
    take('cb', v => { cfg.cgBasisPct = clamp(Math.round(v), 0, 100); });
    take('yr', v => { cfg.year = clamp(Math.round(v), BASE_YEAR, BASE_YEAR + YEARS_AHEAD); });
    take('in', v => { cfg.inflation = clamp(Math.round(v / 0.5) * 0.5, 0.5, 6); });
    take('pi', v => { pin = v; });   // may be negative
    return { cfg, errors, pin, given };
  }

  // `return` alone (or 1) is the default set, `all` is every field, anything else a comma list.
  // `result` is accepted as a synonym. null when the link asks for no result.
  function returnSpec(get) {
    const key = get('return') !== null && get('return') !== undefined ? 'return'
              : get('result') !== null && get('result') !== undefined ? 'result' : null;
    if (!key) return null;
    const rawText = String(get(key)).trim();
    const names = (rawText === '' || rawText === '1' || rawText === 'true') ? RESULT_DEFAULT
                : rawText === 'all' ? ALL_NAMES
                : rawText.split(',').map(x => x.trim()).filter(Boolean);
    return { names };
  }

  // ─── THE CALCULATION, BOUND TO ONE CFG ─────────────────────────────────────
  function create(cfg) {
    // The two index factors for the selected year, or for a year `ahead` of it. `inf` indexes every
    // income threshold (brackets, IRMAA floors); `med` scales the IRMAA surcharge DOLLARS, which ride
    // their own published path. Memoized: calcAt runs a few hundred times per redraw.
    let fxKey = '', fx = {};
    function indexFactors(ahead = 0) {
      const key = `${cfg.year}|${cfg.inflation}`;
      if (key !== fxKey) { fxKey = key; fx = {}; }
      return fx[ahead] ??= {
        inf: Math.pow(1 + cfg.inflation / 100, cfg.year + ahead - BASE_YEAR),
        med: medGrowth(cfg.year + ahead - MED.ANCHOR_YEAR)
      };
    }

    // Fills cfg's derived income figures from the entries. The short-term and long-term results are
    // netted the way the return does it (netCapitalLosses in taxengine.js).
    function deriveIncome() {
      const lt  = cfg.cgSale > 0 ? cfg.cgSale * (1 - cfg.cgBasisPct / 100) : 0;
      const net = netLosses(cfg.stcg, lt);
      cfg.ltNet = net.longTerm;
      cfg.stOrd = net.ordinary;
      cfg.carry = net.carryforward;
      // Each is a part of another entry, so it cannot be larger than that entry.
      cfg.usIntEff  = Math.min(cfg.usInt, cfg.interest);
      cfg.stMuniEff = Math.min(cfg.stMuni, cfg.muni);
      cfg.entOrdinary = cfg.wages + cfg.interest + cfg.ndiv + cfg.retirementIncome + cfg.rmd + cfg.rothConv + cfg.taxWithdrawal + cfg.other + net.ordinary;
      settleTaxWithdrawal();
    }

    // With autoTax the IRA withdrawal is whatever covers the tax on all the other entries, so it follows
    // every change to them. Run after the entries and their derived figures are in place.
    function settleTaxWithdrawal() {
      if (!cfg.autoTax) return;
      cfg.entOrdinary -= cfg.taxWithdrawal;
      cfg.taxWithdrawal = 0;
      const w = withdrawalForTax().withdrawal;
      cfg.taxWithdrawal = w;
      cfg.entOrdinary += w;
    }

    // Maps cfg to calculateTaxes() params and reshapes the result.
    function calcAt(ordInc) {
      const {status, state, ages, ssIncome, propTax, obbaOn, saltHigh, year} = cfg;
      const {inf} = indexFactors();
      const cgGain = cfg.ltNet;

      // The elevated SALT cap and the senior deduction each switch off after their own sunset year.
      const effectiveSaltHigh = saltHigh && year <= obbaSalt.sunsetYear;
      const effectiveObbaOn = obbaOn && year <= obbaSen.sunsetYear;

      // Retirement part of the ordinary income, for the states that exempt it: what was entered, plus
      // (when asked) everything swept above what was entered. Never more than the ordinary income there is.
      const extraRet = cfg.retirementSwept ? Math.max(0, ordInc - cfg.entOrdinary) : 0;
      const retInc = Math.max(0, Math.min(ordInc, cfg.retirementIncome + cfg.rmd + cfg.rothConv + cfg.taxWithdrawal + extraRet));

      // The ordinary income that is also investment income, for the net investment income tax: interest,
      // non-qualified dividends and a short-term gain. Handed over as ordDivInterest, which the engine
      // taxes like earned income everywhere except that surtax. A short-term loss is not subtracted
      // (it never lowers investment income), and it can never exceed the ordinary income there is.
      const investOrd = Math.min(Math.max(0, ordInc), cfg.interest + cfg.ndiv + Math.max(0, cfg.stOrd));

      const r = calcTaxes({
        filingStatus:    status,
        ages:            ages,
        earnedIncome:    ordInc - investOrd,
        ordDivInterest:  investOrd,
        iraIncome:       retInc,
        totalSS:         ssIncome,
        capGains:        cgGain,
        qualifiedDiv:    cfg.qdiv,
        taxExemptInterest:   cfg.muni,          // federal MAGI only: IRMAA, Social Security taxability, SALT cap
        stateExemptInterest: cfg.usIntEff,      // Treasury interest, out of state income
        stateTaxableExempt:  cfg.stMuniEff,     // municipal interest the state taxes, into state income
        inflation:       inf,
        state:           state,
        obbaOn:          effectiveObbaOn,
        saltHigh:        effectiveSaltHigh,
        propTax:         propTax,
        taxYear:         year,
        IRMAAAnnualCost: 0   // computed below from MAGI
      });

      // IRMAA is a step function on MAGI. Thresholds index at inflation, the surcharge at the Medicare
      // path. `IRMAA` is the charge in force this year, set by the MAGI entered for year - 2, so it is
      // flat across a sweep. `IRMAAFuture` is the charge THIS point's MAGI sets IRMAA_AHEAD years out;
      // it is reported, never added to this year's tax.
      const now = indexFactors(), fut = indexFactors(IRMAA_AHEAD);
      const IRMAA = cfg.prevMagi === null ? 0 : irmaaCharge(cfg.prevMagi, status, now.inf, now.med);
      const IRMAAFuture = irmaaCharge(r.MAGI, status, fut.inf, fut.med);

      return {
        ordInc,
        fedTax:    r.federalOrdinaryTax,
        fedCGTax:  r.capitalGainsTax,
        IRMAA,
        IRMAAFuture,
        stTaxOrd:  r.stateOrdinaryTax,
        stTaxCG:   r.stateCapGainsTax,
        ssTax:     r.taxableSS,
        magi:      r.MAGI,
        fedAGI:    r.AGI,
        useItz:    r.useItemized,
        senDed:    r.seniorDeduction,
        fedDed:    r.federalStdDeduction,
        stDed:     r.stateStdDeduction,
        stMarg:    r.stateMarginalRate,
        fedBr:     r.federalMarginalRate,   // statutory federal ordinary bracket
        cgStat:    r.capitalGainsRate,      // statutory capital-gains bracket (NIIT is not in it)
        niit:      r.niitTax,
        cgRate:    r.capitalGainsRate + (r.MAGI > TD.FEDERAL.NIIT[status] ? TD.FEDERAL.NIIT.rate : 0),
        cgGain:    cgGain + cfg.qdiv        // everything taxed at capital-gains rates
      };
    }

    // Everything that came in at a point: Fed income, tax-exempt interest, and the untaxed money.
    const grossOf = d => d.ordInc + cfg.ssIncome + d.cgGain + cfg.muni + cfg.untaxed;

    // Derived fields shared by the sweep and by the exact row. prevFedTax === null means "no left
    // neighbor", so no marginal rate; h is the difference width.
    function deriveRow(p, prevFedTax, h) {
      const denom    = Math.max(p.ordInc + cfg.ssIncome + p.cgGain, 1);
      const totalTax = p.fedTax + p.fedCGTax + p.niit + p.IRMAA + p.stTaxOrd + p.stTaxCG;
      const fedMarg = prevFedTax === null ? 0 : (p.fedTax - prevFedTax) / h;
      // The solid effective rates are INCOME taxes. This year's IRMAA is a flat charge set by income
      // two years ago, so over a small income it is an enormous "rate"; `allIn` carries it, and is
      // shown (allInShown) only where it stays within the sum of the two marginal rates.
      const allIn = totalTax / denom;
      return {
        ...p, totalTax, fedMarg, allIn,
        fedEff:  (p.fedTax + p.fedCGTax + p.niit) / denom,
        stEff:   (p.stTaxOrd + p.stTaxCG) / denom,
        totEff:  (totalTax - p.IRMAA) / denom,
        allInShown: p.IRMAA > 0 && allIn <= Math.max(0, fedMarg) + Math.max(0, p.stMarg) ? allIn : null
      };
    }

    // The paying IRMAA tiers in the dollars of the year `ahead` of the selected one.
    function irmaaTiers(ahead = IRMAA_AHEAD) {
      const {inf} = indexFactors(ahead);
      return tiersOf(cfg.status).slice(0, IRMAA_TIERS_SHOWN).map(t => ({ ...t, at: t.l * inf }));
    }

    // Where a MAGI sits on the ladder in the year `ahead` of the selected one. `tier` is 0 below the
    // first surcharge. `annual` is the household surcharge at that MAGI, Medicare growth included.
    // `next` is null in the top tier, which has a floor and no ceiling.
    function irmaaAt(magi, ahead = IRMAA_AHEAD) {
      const {med} = indexFactors(ahead);
      const tiers = irmaaTiers(ahead);
      const tier  = tiers.filter(t => t.at <= magi).length;      // floors ascend, so a count is the index
      const annual = tier ? tiers[tier - 1].annualCost * med : 0;
      const nx = tiers[tier];
      return { tier, annual,
               next: nx ? { n: nx.n, at: nx.at, away: nx.at - magi, cliff: nx.annualCost * med - annual } : null };
    }

    // ─── ROTH CONVERSION ROOM ──────────────────────────────────────────────────
    // How much more ordinary income fits before something changes: the federal bracket rises, or MAGI
    // reaches the next IRMAA tier. Both are found by bisection on calcAt, so they hold the Social
    // Security torpedo, the deduction phase-outs and the state in the answer. Both tests only ever turn
    // true as income rises, which is what makes bisection valid.
    //
    // The row at `extra` more Roth conversion than is entered (negative takes some away). With autoTax
    // the withdrawal that pays the tax moves with it, so a conversion is never counted without the tax
    // on it; the inputs are put back afterwards.
    function rowAfter(extra) {
      const keep = { rc: cfg.rothConv, tw: cfg.taxWithdrawal, ent: cfg.entOrdinary };
      try {
        cfg.rothConv += extra;
        cfg.entOrdinary += extra;
        settleTaxWithdrawal();
        return calcAt(cfg.entOrdinary);
      } finally {
        cfg.rothConv = keep.rc; cfg.taxWithdrawal = keep.tw; cfg.entOrdinary = keep.ent;
      }
    }

    // The most extra conversion at or above `from` where `crossed(row)` is still false; null when
    // nothing up to the search ceiling crosses it.
    function lastExtraBefore(from, crossed) {
      const CEIL = 5_000_000;
      if (!crossed(rowAfter(CEIL))) return null;
      let lo = from, hi = CEIL;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (crossed(rowAfter(mid))) hi = mid; else lo = mid;
      }
      return lo;
    }

    // Room to the top of the federal bracket the income sits in. Sitting on the top edge already, it
    // offers the bracket above, so a second click keeps climbing. null in the top bracket.
    function bracketRoom() {
      let from = 0;
      for (let k = 0; k < 2; k++) {
        const rate = rowAfter(from).fedBr;
        const end = lastExtraBefore(from, r => r.fedBr > rate + 1e-9);
        if (end === null) return null;
        if (end >= 1) return { rate, room: Math.floor(end) };
        from = end + 1;
      }
      return null;
    }

    // Room before MAGI reaches the next IRMAA tier (the tier this year's MAGI sets IRMAA_AHEAD years
    // out). null in the top tier, which has a floor and no ceiling. Sitting on the edge already, it
    // offers the tier above, like bracketRoom.
    function irmaaRoom() {
      let from = 0;
      for (let k = 0; k < 2; k++) {
        const next = irmaaAt(rowAfter(from).magi).next;
        if (!next) return null;
        const end = lastExtraBefore(from, r => r.magi >= next.at);
        if (end === null) return null;
        if (end >= 1) return { tier: next.n, cliff: next.cliff, room: Math.floor(end) };
        from = end + 1;
      }
      return null;
    }

    const incomeTaxOf = r => r.fedTax + r.fedCGTax + r.niit + r.stTaxOrd + r.stTaxCG;

    // The income tax at `extra` more conversion than is entered, with the tax withdrawal left out, so a
    // difference of two of these is the tax on the conversion dollars themselves.
    function ownTaxAfter(extra) {
      const keep = { rc: cfg.rothConv, tw: cfg.taxWithdrawal, ent: cfg.entOrdinary };
      try {
        cfg.rothConv += extra;
        cfg.entOrdinary += extra - cfg.taxWithdrawal;
        cfg.taxWithdrawal = 0;
        return incomeTaxOf(calcAt(cfg.entOrdinary));
      } finally {
        cfg.rothConv = keep.rc; cfg.taxWithdrawal = keep.tw; cfg.entOrdinary = keep.ent;
      }
    }

    // The income tax the conversion itself adds, federal and state: the same year with and without it.
    // The IRA withdrawal that pays the tax is left out of both.
    function conversionTax() { return ownTaxAfter(0) - ownTaxAfter(-cfg.rothConv); }

    // The tax the conversion adds, and with autoTax the further tax on the extra IRA withdrawal that
    // pays it: { own, withdrawal, total }.
    function conversionCost() {
      const own = conversionTax();
      const total = incomeTaxOf(rowAfter(0)) - incomeTaxOf(rowAfter(-cfg.rothConv));
      return { own, withdrawal: total - own, total };
    }

    // The nearest line ahead, as one step: the top of the federal bracket or the foot of the next IRMAA
    // tier, whichever is closer. `tax` is the income tax the step's conversion adds. null when neither
    // has a ceiling. { kind:'bracket', rate, room, tax, irmaaReached } or { kind:'irmaa', tier, cliff, room,
    // tax, irmaaReached }. irmaaReached is null, or { to, adds }: the step lifts MAGI into IRMAA tier `to`,
    // adding `adds` a year.
    function nextConversionStep() {
      const b = bracketRoom(), m = irmaaRoom();
      const pick = b && m ? (m.room < b.room ? { kind: 'irmaa', ...m } : { kind: 'bracket', ...b })
                 : b ? { kind: 'bracket', ...b } : m ? { kind: 'irmaa', ...m } : null;
      if (!pick) return null;
      const was = irmaaAt(rowAfter(0).magi), now = irmaaAt(rowAfter(pick.room).magi);
      return { ...pick, tax: ownTaxAfter(pick.room) - ownTaxAfter(0),
               irmaaReached: now.tier > was.tier ? { to: now.tier, adds: now.annual - was.annual } : null };
    }

    // The IRA withdrawal that pays the year's income tax, tax on the withdrawal included: the W with
    // W = tax(income without the withdrawal field, plus W). Each dollar withdrawn is itself taxed, so
    // W is the tax now plus the tax the withdrawal adds, and that added tax is taxed too. The marginal
    // rate is below 100%, so feeding the tax back in as the next withdrawal converges, and rounding W
    // UP to a dollar leaves the tax covered. Income tax only (federal, capital gains, NIIT, state):
    // IRMAA is a Medicare premium billed separately. Computed from the income WITHOUT the current
    // taxWithdrawal, so asking again gives the same answer however much is already entered.
    //   { withdrawal, tax, taxBefore, extraTax, taxNow }   taxNow is the tax at the withdrawal entered.
    function withdrawalForTax() {
      const tax = r => r.fedTax + r.fedCGTax + r.niit + r.stTaxOrd + r.stTaxCG;
      const keepW = cfg.taxWithdrawal, keepEnt = cfg.entOrdinary, base = keepEnt - keepW;
      const taxWith = w => {            // the tax with a withdrawal of w taken
        cfg.taxWithdrawal = w; cfg.entOrdinary = base + w;
        return tax(calcAt(base + w));
      };
      const taxNow = tax(calcAt(keepEnt));
      const taxBefore = taxWith(0);
      let w = taxBefore;
      for (let i = 0; i < 200; i++) {
        const next = taxWith(w);
        const done = Math.abs(next - w) < 0.005;
        w = next;
        if (done) break;
      }
      const withdrawal = Math.ceil(w - 1e-9);
      const taxAt = taxWith(withdrawal);
      cfg.taxWithdrawal = keepW; cfg.entOrdinary = keepEnt;      // the caller's inputs are untouched
      return { withdrawal, tax: taxAt, taxBefore, extraTax: taxAt - taxBefore, taxNow };
    }

    // The result at one ordinary income. The marginal rates are measured over a $1,000 step.
    function resultFor(P) {
      const h = 1000;
      const d = deriveRow(calcAt(P), calcAt(P - h).fedTax, h);
      return { d, P, total: P + cfg.ssIncome + d.cgGain,
               now: cfg.prevMagi === null ? null : irmaaAt(cfg.prevMagi, 0), fut: irmaaAt(d.magi) };
    }

    // { fields, values, csv } for spec = { names, header }. A name the calculation does not know comes
    // back as a single "ERROR: ..." token rather than as a column of zeros, so a typo cannot pass as
    // a result.
    function buildResult(spec, P) {
      const inputs = inputFields(cfg);
      const all = { ...RESULT_FIELDS, ...inputs, ...MARKER_FIELDS };
      const bad = spec.names.filter(n => !(n in all));
      if (bad.length) return { fields: [], values: [], csv: 'ERROR: unknown field ' + bad.join(' ') };
      const c = resultFor(P ?? cfg.entOrdinary);
      c.grossOf = grossOf;
      c.bracketRoom = bracketRoom; c.irmaaRoom = irmaaRoom; c.conversionTax = conversionTax;
      c.withdrawalForTax = withdrawalForTax;
      c.iraTotal = () => cfg.rmd + cfg.retirementIncome + cfg.rothConv + cfg.taxWithdrawal;
      const values = spec.names.map(n => {
        const v = all[n](c);
        if (typeof v === 'string') return v;     // filing status, state, or a blank
        return RESULT_RATES.has(n) ? Math.round(v * 1e6) / 1e6 : Math.round(v * 100) / 100;
      });
      const csv = (spec.header ? spec.names.join(',') + '\n' : '') + values.join(',');
      return { fields: spec.names, values, csv };
    }

    return { cfg, indexFactors, deriveIncome, calcAt, grossOf, deriveRow, irmaaTiers, irmaaAt,
             resultFor, buildResult, bracketRoom, irmaaRoom, conversionTax, conversionCost, nextConversionStep,
             withdrawalForTax };
  }

  // ─── THE RESULT LINE ───────────────────────────────────────────────────────
  // The output contract. Other people's sheets read these by position, so a new field goes at the END.
  const RESULT_DEFAULT = ['ordinary', 'fedIncome', 'grossIncome', 'agi', 'magi', 'fedTax', 'stateTax', 'irmaa',
                          'irmaaFuture', 'totalTax', 'effRate', 'fedMarginal', 'stateMarginal'];
  const RESULT_RATES   = new Set(['effRate', 'allInRate', 'fedMarginal', 'stateMarginal', 'cgRate']);
  const RESULT_FIELDS = {
    ordinary:        c => c.P,
    fedIncome:       c => c.total,
    grossIncome:     c => c.grossOf(c.d),
    agi:             c => c.d.fedAGI,
    magi:            c => c.d.magi,
    taxableSS:       c => c.d.ssTax,
    deduction:       c => c.d.fedDed,
    seniorDeduction: c => c.d.senDed,
    stateDeduction:  c => c.d.stDed,
    itemized:        c => c.d.useItz ? 1 : 0,
    fedOrdinaryTax:  c => c.d.fedTax,
    fedCgTax:        c => c.d.fedCGTax,
    niit:            c => c.d.niit,
    fedTax:          c => c.d.fedTax + c.d.fedCGTax + c.d.niit,
    stateTax:        c => c.d.stTaxOrd + c.d.stTaxCG,
    incomeTax:       c => RESULT_FIELDS.fedTax(c) + RESULT_FIELDS.stateTax(c),
    irmaa:           c => c.d.IRMAA,
    irmaaTier:       c => c.now ? c.now.tier : 0,
    totalTax:        c => c.d.totalTax,
    netIncome:       c => c.grossOf(c.d) - c.d.totalTax,
    effRate:         c => c.d.totEff,
    allInRate:       c => c.d.allIn,
    fedMarginal:     c => c.d.fedMarg,
    stateMarginal:   c => c.d.stMarg,
    cgRate:          c => c.d.cgRate,
    irmaaFuture:     c => c.d.IRMAAFuture,
    irmaaFutureTier: c => c.fut.tier,
    // Roth conversion: the room left at the income calculated at, and the tax the conversion entered
    // adds. Room is blank in the top bracket or tier, where there is no ceiling to fill up to.
    bracketRoom:     c => c.bracketRoom()?.room ?? '',
    irmaaRoom:       c => c.irmaaRoom()?.room ?? '',
    conversionTax:   c => c.conversionTax(),
    withdrawalForTax: c => c.withdrawalForTax().withdrawal,
    // Everything taken from IRAs and 401ks: the RMD, other withdrawals (a pension entered there too), the
    // Roth conversion and the withdrawal that pays the tax.
    iraTotal:        c => c.iraTotal(),
  };

  // Two names that carry no value: a blank column labelled `inputs` or `calculated`, so a line that
  // mixes the two families shows where one ends and the other starts.
  const MARKER_FIELDS = { inputs: () => '', calculated: () => '' };

  // The inputs the result was calculated from, named as in the link (st, s, ss, wg, ...), so a result
  // line can say what it was a result OF. `a2` is blank for a single filer and `pm` when not entered.
  // Each reads cfg, so the table is built per cfg; the names are the same for every cfg.
  function inputFields(cfg) {
    return {
      st: () => cfg.status,
      s:  () => cfg.state,
      a1: () => cfg.ages[0],
      a2: () => cfg.status === 'MFJ' ? cfg.ages[1] : '',
      yr: () => cfg.year,
      'in': () => cfg.inflation,
      ss: () => cfg.ssIncome,
      cs: () => cfg.cgSale,
      cb: () => cfg.cgBasisPct,
      pm: () => cfg.prevMagi ?? '',
      ...Object.fromEntries(DETAIL_FIELDS.map(f => [f.key, () => cfg[f.cfg]])),
      ui: () => cfg.usIntEff,    // the amounts USED, which are limited to the entries they are part of
      sm: () => cfg.stMuniEff,
      rw: () => cfg.retirementSwept ? 1 : 0,
      ra: () => cfg.autoTax ? 1 : 0,
    };
  }
  // `all` is the inputs, then the calculated fields, each family after its marker.
  const ALL_NAMES = ['inputs', ...Object.keys(inputFields(newConfig())), 'calculated', ...Object.keys(RESULT_FIELDS)];

  // The ordinary income a link's `pi` asks for becomes whatever Other ordinary income makes the
  // entries add up to it, in whole dollars like the entry it is written into.
  function applyPin(calc, pin) {
    const cfg = calc.cfg;
    cfg.other = wholeDollars(cfg.other + (pin - cfg.entOrdinary));
    calc.deriveIncome();
  }

  // The whole thing for a command line or a server: link keys in, a result line out. `P` overrides
  // the ordinary income the result is taken at.
  function run(get, over = {}) {
    const L = configFromParams(get);
    if (L.errors.length) return { ok: false, csv: 'ERROR: ' + L.errors.join('; ') };
    const calc = create(L.cfg);
    calc.deriveIncome();
    if (L.pin !== null) applyPin(calc, L.pin);
    const spec = { names: (returnSpec(get) || { names: RESULT_DEFAULT }).names, header: !!over.header };
    const r = calc.buildResult(spec, over.P);
    return { ok: !r.csv.startsWith('ERROR:'), ...r, calc };
  }

  const api = { BASE_YEAR, IRMAA_AHEAD, DETAIL_FIELDS, RESULT_DEFAULT, RESULT_RATES, RESULT_FIELDS, ALL_NAMES,
                detailValue, wholeDollars, newConfig, configFromParams, returnSpec, create, applyPin, run };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TaxCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

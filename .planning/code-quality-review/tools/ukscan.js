'use strict';
// UK -> US English scanner. node ukscan.js <repoRoot> <outTsv> <file>...
// Zones for .js/.html: comment | string | template | code | markup. For .md/.css/.yml etc: doc.
const fs = require('fs');
const path = require('path');
const { lex, inlineScripts, lineIndex } = require('./jslex.js');

const root = process.argv[2], outTsv = process.argv[3], files = process.argv.slice(4);

// [regex source, US replacement or note, tier]
// tier: S = spelling (clear UK), V = variant (UK-leaning, some US writers accept it), I = idiom / phrase
const RULES = [
    // -our
    ['colour\\w*', 'color', 'S'], ['behaviour\\w*', 'behavior', 'S'], ['favour\\w*', 'favor', 'S'], ['honour\\w*', 'honor', 'S'],
    ['labour\\w*', 'labor', 'S'], ['neighbour\\w*', 'neighbor', 'S'], ['flavour\\w*', 'flavor', 'S'], ['humour\\w*', 'humor', 'S'],
    ['rumour\\w*', 'rumor', 'S'], ['endeavour\\w*', 'endeavor', 'S'], ['harbour\\w*', 'harbor', 'S'], ['rigour', 'rigor', 'S'],
    ['vigour', 'vigor', 'S'], ['savour\\w*', 'savor', 'S'], ['armour\\w*', 'armor', 'S'], ['odour\\w*', 'odor', 'S'], ['candour', 'candor', 'S'],
    // -re
    ['centre[sd]?', 'center', 'S'], ['centring', 'centering', 'S'], ['(?:kilo|centi|milli)?metres?', 'meter', 'S'],
    ['litres?', 'liter', 'S'], ['fibres?', 'fiber', 'S'], ['theatres?', 'theater', 'S'], ['calibres?', 'caliber', 'S'],
    ['sombre', 'somber', 'S'], ['spectres?', 'specter', 'S'], ['meagre', 'meager', 'S'], ['manoeuvr\\w*', 'maneuver', 'S'],
    // -yse
    ['analys(?:e|ed|es|ing|er|ers)', 'analyze (check: "analyses" as a plural noun is fine)', 'S'], ['catalys(?:e|ed|es|ing)', 'catalyze', 'S'], ['paralys(?:e|ed|es|ing)', 'paralyze', 'S'],
    // -ence / -ogue
    ['defences?', 'defense', 'S'], ['offences?', 'offense', 'S'], ['licences?', 'license', 'S'], ['pretences?', 'pretense', 'S'],
    ['catalogu(?:e|es|ed|ing)', 'catalog', 'S'], ['analogues?', 'analog', 'S'],
    // doubled consonants
    ['cancell(?:ed|ing)', 'canceled / canceling', 'S'], ['modell(?:ed|ing|er|ers)', 'modeled / modeling', 'S'],
    ['labell(?:ed|ing)', 'labeled / labeling', 'S'], ['travell(?:ed|ing|er|ers)', 'traveled', 'S'],
    ['levell(?:ed|ing)', 'leveled', 'S'], ['signall(?:ed|ing)', 'signaled', 'S'], ['totall(?:ed|ing)', 'totaled', 'S'],
    ['fuell(?:ed|ing)', 'fueled', 'S'], ['channell(?:ed|ing)', 'channeled', 'S'], ['tunnell(?:ed|ing)', 'tunneled', 'S'],
    ['dialled|dialling', 'dialed', 'S'], ['equall(?:ed|ing)', 'equaled', 'S'], ['initiall(?:ed|ing)', 'initialed', 'S'],
    ['funnell(?:ed|ing)', 'funneled', 'S'], ['panell(?:ed|ing)', 'paneled', 'S'], ['pencill(?:ed|ing)', 'penciled', 'S'],
    ['unravell(?:ed|ing)', 'unraveled', 'S'], ['marvellous', 'marvelous', 'S'], ['counsellors?', 'counselor', 'S'],
    ['jewellery', 'jewelry', 'S'], ['enrol(?:s|ment|ments)?', 'enroll / enrollment', 'S'], ['fulfil(?:s|ment)?', 'fulfill', 'S'],
    ['instalments?', 'installment', 'S'], ['skilful\\w*', 'skillful', 'S'], ['wilful\\w*', 'willful', 'S'],
    ['focuss(?:ed|ing|es)', 'focused', 'S'], ['targett(?:ed|ing)', 'targeted', 'S'], ['benefitt(?:ed|ing)', 'benefited', 'V'],
    ['biass(?:ed|ing)', 'biased', 'S'],
    // -t past tense
    ['learnt', 'learned', 'S'], ['spelt', 'spelled', 'S'], ['dreamt', 'dreamed', 'V'], ['spoilt', 'spoiled', 'S'],
    ['leant', 'leaned', 'S'], ['earnt', 'earned', 'S'], ['burnt', 'burned', 'V'],
    // misc spelling
    ['grey(?:s|ed|ing|ish)?', 'gray', 'S'], ['whilst', 'while', 'S'], ['amongst', 'among', 'S'], ['amidst', 'amid', 'V'],
    ['programmes?', 'program', 'S'], ['cheques?', 'check', 'S'], ['tyres?', 'tire', 'S'], ['aluminium', 'aluminum', 'S'],
    ['plough\\w*', 'plow', 'S'], ['sceptic\\w*', 'skeptic', 'S'], ['cosy', 'cozy', 'S'], ['draughts?', 'draft', 'S'],
    ['mould\\w*', 'mold', 'S'], ['storeys?', 'story (floor)', 'S'], ['ageing', 'aging', 'S'],
    ['judgements?', 'judgment', 'V'], ['acknowledgements?', 'acknowledgment', 'V'], ['enquir(?:y|ies|e|ed|ing)', 'inquiry / inquire', 'S'],
    ['per cent', 'percent', 'S'], ['maths', 'math', 'S'], ['anti-?clockwise', 'counterclockwise', 'S'], ['fortnight\\w*', 'two weeks', 'I'],
    ['orientated', 'oriented', 'S'], ['speciality', 'specialty', 'S'], ['artefacts?', 'artifact', 'S'],
    ['practis(?:e|ed|es|ing)', 'practice (verb)', 'S'], ['dependants?', 'dependent (noun)', 'S'], ['annexe', 'annex', 'S'],
    ['sulphur', 'sulfur', 'S'], ['cypher', 'cipher', 'S'], ['kerb', 'curb', 'S'],
    ['no-one', 'no one', 'S'], ['co-operat\\w*', 'cooperate', 'S'], ['co-ordinat\\w*', 'coordinate', 'S'], ['on-going', 'ongoing', 'S'],
    ['towards', 'toward', 'V'], ['afterwards', 'afterward', 'V'], ['forwards', 'forward', 'V'], ['backwards', 'backward', 'V'],
    ['upwards', 'upward', 'V'], ['downwards', 'downward', 'V'], ['onwards', 'onward', 'V'], ['inwards|outwards', 'inward / outward', 'V'],
    ['pensioners?', 'retiree', 'I'], ['bank holidays?', 'federal holiday', 'I'], ['current account', 'checking account', 'I'],
    // idioms and phrases
    ['(?:un)?tick(?:ed|ing|s)?', 'check / checked / unchecked (a box) - vet: chart "ticks" are fine', 'I'],
    ['tick ?box(?:es)?', 'checkbox', 'I'],
    ['full stops?', 'period', 'I'], ['inverted commas', 'quotation marks', 'I'], ['round brackets', 'parentheses', 'I'],
    ['exclamation marks?', 'exclamation point', 'I'],
    ['way round', 'way around', 'I'],
    ['(?:turn|turned|turning|turns|get|gets|got|getting|come|comes|came|go|goes|went|look|looked|all|right|swap|swapped|switch|switched|wrap|wrapped|built|moved?|passed?|hand(?:ed)?) round', '... around', 'I'],
    ['round about', 'around', 'I'],
    ['straight away', 'right away', 'I'], ['one-off', 'one-time', 'I'], ['bespoke', 'custom', 'I'], ['knock-on', 'ripple / downstream (effect)', 'I'],
    ['belt[- ]and[- ]braces', 'belt and suspenders', 'I'], ['ring-?fenc\\w*', 'earmark / wall off', 'I'], ['top(?:s|ped|ping)?[- ]up', 'add to / replenish / refill', 'I'],
    ['fit for purpose', 'suitable / up to the job', 'I'], ['swings and roundabouts', '(trade-off)', 'I'], ['horses for courses', '(it depends)', 'I'],
    ['spanner', 'wrench', 'I'], ['fiddly', 'finicky', 'I'], ['dodgy', 'sketchy / unreliable', 'I'], ['bodg\\w+', 'hack / kludge', 'I'],
    ['faff\\w*', 'fuss', 'I'], ['bits and bobs', 'odds and ends', 'I'], ['spot on', 'exactly right', 'I'], ['touch wood', 'knock on wood', 'I'],
    ['at the weekend', 'on the weekend', 'I'], ['in future', 'in the future (vet: "in future years" is fine)', 'I'],
    ['different to', 'different from', 'I'], ['cater(?:s|ed|ing)? for', 'cater to', 'I'], ['take(?:s|n)? a decision|took a decision', 'make a decision', 'I'],
    ['works? out at', 'works out to', 'I'], ['to hand', 'on hand / at hand (vet)', 'I'], ['by some way|by a distance', 'by far', 'I'],
    ['full marks', 'full credit', 'I'], ['(?:do|does|doing|did) the sums', 'do the math', 'I'],
    ['tot(?:s|ted|ting)? up', 'add up', 'I'], ['the lot', 'all of it / all of them (vet)', 'I'], ['reckon\\w*', 'think / figure', 'I'],
    ['whinge\\w*', 'complain', 'I'], ['rubbish', 'garbage / junk', 'I'],
    ['tid(?:y|ied|ies|ying)(?: up)?', 'clean up - UK-leaning', 'V'], ["shan't|needn't|oughtn't|daren't", 'need not ...', 'V'],
    ['(?:should|would|could|might|may|will|must|can) (?:do|have done)(?=[.,;:)]| so)', 'elliptical "do" (UK) - drop "do"', 'I'],
    ["have got to|has got to|haven't got|hasn't got", 'have to / does not have', 'V'],
    ['\\d{1,2} (?:January|February|March|April|June|July|August|September|October|November|December)', 'Month D, YYYY', 'V'],
    ['[$]\\d[\\d,.]*(?:m|bn)', '$xM / $xB', 'V'],
    ['autumn', 'fall', 'V'], ['nought|noughts', 'zero', 'I'], ['nil', 'zero / none', 'V'],
    ['postcode', 'ZIP code', 'I'], ['lorry|lorries', 'truck', 'I'], ['petrol', 'gas', 'I'],
    ['re-us(?:e|ed|es|ing|able)', 'reuse', 'V'], ['car park', 'parking lot', 'I'], ['rota', 'schedule', 'I'], ['timetable\\w*', 'schedule', 'V'],
    ['diary', 'calendar', 'V'], ['hoover\\w*', 'vacuum', 'I'], ['chalk and cheese', 'apples and oranges', 'I'], ['at the minute', 'right now', 'I'],
    ['hived? off|hiving off', 'split off / spin off', 'I'], ['gubbins', 'stuff', 'I'], ['kerfuffle', 'fuss', 'I'],
    ['whinging', 'whining', 'I'], ['a fair few', 'quite a few', 'I'], ['proper(?= (?:job|mess|fix))', 'real', 'I'],
    ['sat(?= (?:in|on|at|beside|next|under|above|behind|inside|outside|between|there|here|idle))', '"was sat" (UK) -> sitting / sits (vet)', 'V'],
    ['stood(?= (?:in|on|at|beside|next|under|above|behind|inside|outside|between|there|here))', '"was stood" (UK) -> standing (vet)', 'V'],
    ['queue(?:d|s)? up', 'line up (vet)', 'V'],
];

const OK_STEMS = new Set(('adv advert appr compr comprom desp dev disgu enterpr exc exerc expert franch improv inc merchand ' +
    'prec imprec prem prom rev superv surm surpr telev pra appra cru bru dem conc parad treat chast lia bra mayonna turquo torto porpo ' +
    'repr circumc exorc mort cer val chem marqu enfranch disenfranch unw sunr moonr upr').split(/\s+/));
const ISE_RE = /(?<![A-Za-z])([A-Za-z]{3,}?)is(e|es|ed|ing|er|ers|ation|ations|able)(?![A-Za-z])/g;

const compiled = RULES.map(r => ({ re: new RegExp('(?<![A-Za-z])(?:' + r[0] + ')(?![A-Za-z])', 'gi'), us: r[1], tier: r[2] }));

const rows = [['tier', 'match', 'us', 'file', 'line', 'zone', 'context'].join('\t')];
let nfiles = 0;
for (const rel of files) {
    let src;
    try { src = fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { continue; }
    nfiles++;
    const li = lineIndex(src);
    const isJs = /\.(js|cjs|mjs)$/i.test(rel), isHtml = /\.html?$/i.test(rel);
    let zones = null;
    if (isJs || isHtml) {
        zones = [];
        const blocks = isHtml ? inlineScripts(src) : [{ start: 0, end: src.length }];
        for (const b of blocks) for (const t of lex(src.slice(b.start, b.end), b.start)) {
            const z = t.type === 'line_comment' || t.type === 'block_comment' ? 'comment' : t.type === 'string' ? 'string' : t.type === 'template' ? 'template' : 'code';
            zones.push([t.start, t.end, z]);
        }
    }
    function zoneOf(off) {
        if (!zones) return 'doc';
        let lo = 0, hi = zones.length - 1;
        while (lo <= hi) { const mid = (lo + hi) >> 1; const z = zones[mid]; if (off < z[0]) hi = mid - 1; else if (off >= z[1]) lo = mid + 1; else return z[2]; }
        if (isHtml) { const open = src.lastIndexOf('<!--', off), close = src.lastIndexOf('-->', off); return open > close ? 'comment' : 'markup'; }
        return 'code';
    }
    function emit(tier, m, us, off) {
        const line = li.lineOf(off);
        const text = li.text(line);
        const col = off - li.starts[line - 1];
        const ctx = text.slice(Math.max(0, col - 60), Math.min(text.length, col + m.length + 50)).replace(/\t/g, ' ').trim();
        rows.push([tier, m, us, rel, line, zoneOf(off), ctx].join('\t'));
    }
    for (const r of compiled) {
        r.re.lastIndex = 0; let m;
        while ((m = r.re.exec(src))) { emit(r.tier, m[0], r.us, m.index); if (m[0].length === 0) r.re.lastIndex++; }
    }
    ISE_RE.lastIndex = 0; let m;
    while ((m = ISE_RE.exec(src))) {
        const stem = m[1].toLowerCase();
        if (OK_STEMS.has(stem) || /w$/.test(stem)) continue;
        emit('S', m[0], m[0].replace(/is(e|es|ed|ing|er|ers|ation|ations|able)$/i, 'iz$1'), m.index);
    }
}
fs.writeFileSync(outTsv, rows.join('\n') + '\n');
console.log('files scanned', nfiles, 'hits', rows.length - 1);

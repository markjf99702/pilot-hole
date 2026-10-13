// Every drill bit in the four series (fractional, number, letter, metric), Forstner bits for big holes,
// and the sets they come in. Sizes are ASME B94.11M for number and letter bits. No page code.
import { MM, fracText, mmText, decIn } from './units.js';

// Number drills #1 to #80, in inches.
const NUMBER = [
  0.2280, 0.2210, 0.2130, 0.2090, 0.2055, 0.2040, 0.2010, 0.1990, 0.1960, 0.1935, // 1-10
  0.1910, 0.1890, 0.1850, 0.1820, 0.1800, 0.1770, 0.1730, 0.1695, 0.1660, 0.1610, // 11-20
  0.1590, 0.1570, 0.1540, 0.1520, 0.1495, 0.1470, 0.1440, 0.1405, 0.1360, 0.1285, // 21-30
  0.1200, 0.1160, 0.1130, 0.1110, 0.1100, 0.1065, 0.1040, 0.1015, 0.0995, 0.0980, // 31-40
  0.0960, 0.0935, 0.0890, 0.0860, 0.0820, 0.0810, 0.0785, 0.0760, 0.0730, 0.0700, // 41-50
  0.0670, 0.0635, 0.0595, 0.0550, 0.0520, 0.0465, 0.0430, 0.0420, 0.0410, 0.0400, // 51-60
  0.0390, 0.0380, 0.0370, 0.0360, 0.0350, 0.0330, 0.0320, 0.0310, 0.0292, 0.0280, // 61-70
  0.0260, 0.0250, 0.0240, 0.0225, 0.0210, 0.0200, 0.0180, 0.0160, 0.0145, 0.0135, // 71-80
];

// Letter drills A to Z, in inches.
const LETTER = {
  A: 0.234, B: 0.238, C: 0.242, D: 0.246, E: 0.250, F: 0.257, G: 0.261, H: 0.266, I: 0.272,
  J: 0.277, K: 0.281, L: 0.290, M: 0.295, N: 0.302, O: 0.316, P: 0.323, Q: 0.332, R: 0.339,
  S: 0.348, T: 0.358, U: 0.368, V: 0.377, W: 0.386, X: 0.397, Y: 0.404, Z: 0.413,
};

export const KINDS = {
  frac: { name: 'Fractional', finish: 'gold' },
  num: { name: 'Number', finish: 'black' },
  letter: { name: 'Letter', finish: 'bright' },
  metric: { name: 'Metric', finish: 'cobalt' },
  forstner: { name: 'Forstner', finish: 'forstner' },
};

function bit(kind, key, inches, mm) {
  const isMetric = kind === 'metric' || (kind === 'forstner' && mm != null && inches == null);
  const sizeMm = mm ?? inches * MM;
  const sizeIn = inches ?? mm / MM;
  let short, name;
  if (kind === 'frac') { short = fracText(sizeIn); name = `${short}″`; }
  else if (kind === 'num') { short = `#${key}`; name = short; }
  else if (kind === 'letter') { short = key; name = `${key}`; }
  else if (isMetric) { short = mmText(sizeMm); name = `${short} mm`; }
  else { short = fracText(sizeIn, 8); name = `${short}″`; }
  const id = kind === 'forstner' ? (isMetric ? `fm:${short}` : `fo:${short}`) : `${kind[0]}:${kind === 'frac' ? short : key}`;
  return { id, kind, key: String(key), short, name, mm: sizeMm, in: sizeIn, metric: isMetric };
}

const ALL = [];
const add = b => { ALL.push(b); return b; };

// Fractional: 1/64″ to 1″ by 64ths.
for (let n = 1; n <= 64; n++) add(bit('frac', n, n / 64));
// Number and letter.
NUMBER.forEach((inch, i) => add(bit('num', i + 1, inch)));
for (const [k, inch] of Object.entries(LETTER)) add(bit('letter', k, inch));
// Metric: 0.5 to 13 mm by tenths, the two odd tap sizes, then 13.5 to 20 by halves.
const metricSizes = new Set();
for (let t = 5; t <= 130; t++) metricSizes.add(t / 10);
[1.25, 2.05].forEach(s => metricSizes.add(s));
for (let h = 27; h <= 40; h++) metricSizes.add(h / 2);
[...metricSizes].sort((a, b) => a - b).forEach(s => add(bit('metric', mmText(s), null, s)));
// Forstner: inch by eighths to 2-1/8″, and the metric sizes sets come in.
for (const e of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) add(bit('forstner', `${e}/8`, e / 8));
for (const s of [10, 12, 15, 20, 25, 30, 35]) add(bit('forstner', s, null, s));

export const BITS = ALL;
const BY_ID = new Map(ALL.map(b => [b.id, b]));
export const bitById = id => BY_ID.get(id);

// Ids, the easy way: frac('7/64'), num(36), letter('F'), metric(2.5).
export const fracId = s => `f:${s}`;
export const numId = n => `n:${n}`;
export const letterId = s => `l:${s}`;
export const metricId = s => `m:${mmText(s)}`;

const range = (from, to, step) => { const out = []; for (let x = from; x <= to + 1e-9; x += step) out.push(+x.toFixed(4)); return out; };

// The sets bits come in. A person ticks the ones they own; `case` is how many to a row in the drill index.
export const SETS = [
  { id: 'frac29', name: 'Fractional', range: '1/16″ to 1/2″ by 64ths', row: 10,
    bits: range(4, 32, 1).map(n => fracId(fracText(n / 64))) },
  { id: 'num60', name: 'Number', range: '#1 to #60', row: 10,
    bits: range(1, 60, 1).map(numId) },
  { id: 'letter', name: 'Letter', range: 'A to Z', row: 9,
    bits: Object.keys(LETTER).map(letterId) },
  { id: 'met25', name: 'Metric', range: '1 to 13 mm by 0.5', row: 9,
    bits: range(1, 13, 0.5).map(metricId) },
  { id: 'met91', name: 'Metric by tenths', range: '1 to 10 mm by 0.1', row: 10,
    bits: range(1, 10, 0.1).map(metricId) },
  { id: 'num80', name: 'Wire gauge', range: '#61 to #80', row: 10,
    bits: range(61, 80, 1).map(numId) },
  { id: 'fracbig', name: 'Fractional over 1/2″', range: '17/32″ to 1″ by 32nds', row: 8, big: true,
    bits: range(34, 64, 2).map(n => fracId(fracText(n / 64))) },
  { id: 'tapin', name: 'Inch tap drills', range: 'from a tap set, #50 to 29/64″', row: 8,
    bits: ['n:50', 'n:43', 'n:36', 'n:29', 'n:25', 'n:21', 'n:16', 'n:7', 'n:3', 'l:F', 'l:I', 'f:5/16', 'l:Q', 'l:U', 'f:25/64', 'f:27/64', 'f:29/64'] },
  { id: 'tapmm', name: 'Metric tap drills', range: 'from a tap set, 1.6 to 10.2 mm', row: 9,
    bits: [1.6, 2.05, 2.5, 3.3, 4.2, 5, 6.8, 8.5, 10.2].map(metricId) },
  { id: 'forin', name: 'Forstner', range: '1/4″ to 2-1/8″ by 1/8', row: 4, big: true, forstner: true,
    bits: range(2, 17, 1).map(e => `fo:${fracText(e / 8, 8)}`) },
  { id: 'formm', name: 'Forstner, metric', range: '15 to 35 mm', row: 5, big: true, forstner: true,
    bits: [15, 20, 25, 30, 35].map(s => `fm:${s}`) },
  { id: 'hinge', name: 'Hinge-cup bit', range: '35 mm', row: 1, big: true, forstner: true,
    bits: ['fm:35'] },
];
export const setById = id => SETS.find(s => s.id === id);
export const DEFAULT_SETS = ['frac29'];

// What a person owns: the ticked sets, less the bits they've marked missing, plus loose ones.
export function ownedBits({ sets = DEFAULT_SETS, missing = [], loose = [] } = {}) {
  const gone = new Set(missing);
  const out = new Set();
  for (const id of sets) {
    const s = setById(id);
    if (!s) continue;
    for (const b of s.bits) if (!gone.has(`${id}:${b}`)) out.add(b);
  }
  for (const b of loose) if (BY_ID.has(b)) out.add(b);
  return out;
}

// Every bit sorted by size (smallest first), optionally only from a list of ids.
export function bySize(ids) {
  const list = ids ? [...ids].map(bitById).filter(Boolean) : [...ALL];
  return list.sort((a, b) => a.mm - b.mm || a.id.localeCompare(b.id));
}

// The bit nearest a size in each series: what a 2.8 mm hole is in fractions, numbers and letters.
export function nearestInEachKind(mm, { exclude } = {}) {
  const out = {};
  for (const b of ALL) {
    if (b.kind === 'forstner' || b.id === exclude) continue;
    const k = b.kind;
    if (!out[k] || Math.abs(b.mm - mm) < Math.abs(out[k].mm - mm)) out[k] = b;
  }
  return out;
}

// A bit's sizes in words: 7/64″ is 0.1094″ and 2.78 mm.
export const sizeLine = b => `${decIn(b.in)}″ · ${mmText(b.mm)} mm`;

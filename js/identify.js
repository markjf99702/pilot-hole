// The screen gauge's arithmetic: calibrating against a bank card, what a measured screw could be,
// the thread combs to try, standard lengths, and the name it ends up with. No page code.
import { MM, toFrac, fracText, mmText } from './units.js';
import { THREADS, fullName } from './threads.js';
import { WOOD_SCREWS, SHEET_SCREWS, LAGS } from './fasteners.js';
import { BITS } from './drills.js';

// ISO/IEC 7810 ID-1: every bank card, ID card and loyalty card is this size.
export const CARD = { long: 85.60, short: 53.98, corner: 3.18 };

export const pxPerMmFrom = (px, mm = CARD.long) => px / mm;
export const plausible = k => Number.isFinite(k) && k >= 2 && k <= 16;

// A first guess before anyone calibrates: phones are about 6 CSS pixels to the millimetre, desktops about 3.8.
export function guessPxPerMm({ coarse = false, shortSide = 400 } = {}) {
  if (coarse && shortSide < 600) return 6.1;
  if (coarse) return 5.2; // a tablet
  return 96 / MM;
}

// A thread's crests measure a little under its nominal size: the allowance and tolerance of a 2A or 6g thread.
export const expectedMajor = t => t.d - (0.08 + 0.06 * t.p);
const windowFor = t => Math.max(0.3, 0.06 * t.d);

// Machine threads a measured diameter could be, best first.
export function threadCandidates(dMm) {
  return THREADS
    .map(t => ({ thread: t, off: dMm - expectedMajor(t), score: Math.abs(dMm - expectedMajor(t)) / windowFor(t) }))
    .filter(c => c.score <= 1)
    .sort((a, b) => a.score - b.score);
}

// The combs to hold the screw against: one per pitch, in the order the candidates came.
export function combsFor(dMm, { more = false } = {}) {
  const cands = threadCandidates(dMm);
  let pool = cands.map(c => c.thread);
  if (more || pool.length < 2) {
    // Add the nearest sizes either side, so there's always something to compare.
    const near = [...THREADS].sort((a, b) => Math.abs(expectedMajor(a) - dMm) - Math.abs(expectedMajor(b) - dMm));
    for (const t of near) { if (pool.length >= (more ? 8 : 3)) break; if (!pool.includes(t)) pool.push(t); }
  }
  const combs = [];
  for (const t of pool) {
    const key = t.system === 'inch' ? `tpi:${t.tpi}` : `p:${t.p}`;
    let c = combs.find(x => x.key === key);
    if (!c) {
      c = { key, pitch: t.p, label: t.system === 'inch' ? `${t.tpi} per inch` : `${t.p} mm`, system: t.system, threads: [] };
      combs.push(c);
    }
    c.threads.push(t);
  }
  return combs;
}

// The ten-thread span that tells close pitches apart: 1/4-20 spans 12.7 mm, M6 × 1 spans 10, 1/4-28 spans 9.07.
export const tenThreads = pitchMm => 10 * pitchMm;

// Which thread on a comb it is, given the measured diameter.
export function threadOnComb(comb, dMm) {
  return [...comb.threads].sort((a, b) => Math.abs(expectedMajor(a) - dMm) - Math.abs(expectedMajor(b) - dMm))[0];
}

// Pointed screws go by gauge: the nearest wood screw, sheet-metal screw or lag to the measured crests.
export function gaugeFor(dMm, kind) {
  const list = kind === 'sheet' ? SHEET_SCREWS.map(s => ({ id: String(s.g), d: s.d * MM, label: `#${s.g}`, st: s.st }))
    : kind === 'lag' ? LAGS.map(l => ({ id: l.id, d: l.d, label: l.label, metric: l.metric }))
      : WOOD_SCREWS.map(w => ({ id: String(w.g), d: w.d * MM, label: `#${w.g}` }));
  const exp = x => x.d - 0.12;
  return [...list].sort((a, b) => Math.abs(exp(a) - dMm) - Math.abs(exp(b) - dMm))[0];
}

// The drill bits nearest a measured shank, closest first.
export function bitsNear(dMm, n = 4) {
  return BITS.filter(b => b.kind !== 'forstner')
    .map(b => ({ bit: b, diff: b.mm - dMm }))
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff) || (a.bit.kind === 'frac' ? -1 : 1))
    .slice(0, n);
}

// Lengths screws are sold in.
export const INCH_LENGTHS = [1 / 8, 3 / 16, 1 / 4, 5 / 16, 3 / 8, 7 / 16, 1 / 2, 5 / 8, 3 / 4, 7 / 8, 1, 1.125, 1.25, 1.375, 1.5, 1.625, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.5, 5, 5.5, 6];
export const MM_LENGTHS = [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120];

// The sold length nearest a measurement, if it's close enough to call; otherwise the measurement, rounded.
export function snapLength(lenMm, metric) {
  if (metric) {
    const near = MM_LENGTHS.reduce((a, b) => (Math.abs(b - lenMm) < Math.abs(a - lenMm) ? b : a));
    if (Math.abs(near - lenMm) <= Math.max(0.6, 0.03 * near)) return { mm: near, standard: true };
    return { mm: Math.round(lenMm * 2) / 2, standard: false };
  }
  const inch = lenMm / MM;
  const near = INCH_LENGTHS.reduce((a, b) => (Math.abs(b - inch) < Math.abs(a - inch) ? b : a));
  if (Math.abs(near - inch) * MM <= Math.max(0.8, 0.03 * near * MM)) return { in: near, standard: true };
  return { in: Math.round(inch * 16) / 16, standard: false };
}

// A length the way a hardware store writes it: 1/2, 1-1/2 (text) for inches; 10 for millimetres.
export const lengthText = len => (len.mm != null ? mmText(len.mm, 1) : fracText(len.in, 16));

const INCH_HEAD = { hex: 'hex bolt', socket: 'socket head', button: 'button head', flat: 'flat head', pan: 'pan head' };
const MM_HEAD = { ...INCH_HEAD, flat: 'countersunk' };

// The name: '1/4-20 × 1-1/2 hex bolt', 'M3 × 0.5 × 10 socket head', '#8 × 1-1/4 wood screw'.
export function screwName({ kind, thread, gauge, len, head }) {
  const L = len ? ` × ${lengthText(len)}` : '';
  if (kind === 'machine') {
    const words = head ? ` ${(thread.system === 'metric' ? MM_HEAD : INCH_HEAD)[head]}` : '';
    const hexWord = head === 'hex' && thread.system === 'inch' && thread.dIn < 0.25 ? ' hex head screw' : words;
    return `${fullName(thread)}${L}${hexWord}`;
  }
  if (kind === 'wood') return `${gauge.label}${L} wood screw`;
  if (kind === 'sheet') return `${gauge.label}${L} sheet-metal screw`;
  if (kind === 'lag') return `${gauge.label}${L} lag screw`;
  return '';
}

// Which way round a length reads best for a screw: metric threads in millimetres, the rest in inches.
export const metricKind = ({ kind, thread, gauge }) => (kind === 'machine' ? thread.system === 'metric' : kind === 'lag' ? !!gauge?.metric : false);

export { toFrac };

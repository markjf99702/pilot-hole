// The screen gauge's arithmetic: calibrating against a bank card, what a measured screw could be,
// the thread combs to try, standard lengths, and the name it ends up with. No page code.
import { MM, toFrac, fracText, mmText } from './units.js';
import { THREADS, fullName } from './threads.js';
import { WOOD_SCREWS, SHEET_SCREWS, LAGS, headWords, headShape } from './fasteners.js';
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

// A comb whose pitch is within 2% of this one's: no comb can tell them apart (M5 × 0.8 and #10-32,
// M2.5 and #2-56), so the measured size has to.
export const nearTwin = (combs, comb) => combs.find(c => c !== comb && Math.abs(c.pitch - comb.pitch) / comb.pitch < 0.02) || null;

// Which of two such twins the measured size points to, and whether it's clear (a quarter of the gap between
// their sizes or more from halfway) or a close call.
export function twinCall(a, b, dMm) {
  const ea = expectedMajor(a), eb = expectedMajor(b);
  return { thread: Math.abs(dMm - ea) <= Math.abs(dMm - eb) ? a : b, sure: Math.abs(dMm - (ea + eb) / 2) >= Math.abs(ea - eb) / 4 };
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

// What a measured drill bit could be, likeliest first. A screen can't split hairs, so every bit within a pixel
// of the measurement is in the running, and the answer leans on what's likely: a bit gone missing from one of
// your cases, then one you own, then the everyday fractional and metric bits over number and letter ones.
export function bitCandidates(dMm, mmPerPx, { owned = new Set(), missing = new Set() } = {}) {
  const all = BITS.filter(b => b.kind !== 'forstner').map(b => ({ bit: b, diff: b.mm - dMm }));
  const px = x => Math.abs(x.diff) / mmPerPx;
  const score = x => px(x) + (x.bit.kind === 'num' || x.bit.kind === 'letter' ? 0.25 : 0)
    - (missing.has(x.bit.id) ? 0.7 : owned.has(x.bit.id) ? 0.35 : 0);
  const within = all.filter(x => px(x) <= 1);
  const pool = within.length ? within : [all.reduce((a, b) => (Math.abs(b.diff) < Math.abs(a.diff) ? b : a))];
  return pool.sort((a, b) => score(a) - score(b));
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

// The name: '1/4-20 × 1-1/2 hex bolt', 'M3 × 0.5 × 10 socket head', '#8 × 1-1/4 wood screw'.
// The head's words are the Holes screen's, so the two call a screw the same thing.
export function screwName({ kind, thread, gauge, len, head }) {
  const L = len ? ` × ${lengthText(len)}` : '';
  if (kind === 'machine') return `${fullName(thread)}${L}${head ? ` ${headWords(thread, head)}` : ''}`;
  if (kind === 'wood') return `${gauge.label}${L} wood screw`;
  if (kind === 'sheet') return `${gauge.label}${L} sheet-metal screw`;
  if (kind === 'lag') return `${gauge.label}${L} lag screw`;
  return '';
}

// What the named screw looks like, in millimetres, to draw it at true size where it lay on the glass: its head,
// a plain shank, the threaded part and the point. Lengths run from under the head (from the top of a flat
// head), the way the gauge measures them. root is the thread's core; for wood screws only roughly.
export function screwShape({ kind, thread, gauge, len, head }) {
  const L = len.mm ?? len.in * MM;
  if (kind === 'machine') {
    const t = thread, d = t.d;
    // Machine screws are threaded right up; a bolt longer than its thread (2d + 1/4″, or 2d + 6 mm) has a plain shank.
    const b = head === 'hex' ? 2 * d + (t.system === 'inch' ? MM / 4 : 6) : L;
    return { d, p: t.p, root: d - 1.2269 * t.p, length: L, threaded: L - b < 2 * t.p ? L : b,
      head: head ? headShape(t, head) : null, point: 'chamfer',
      finish: head === 'socket' || head === 'button' || (head === 'flat' && t.system === 'metric') ? 'black' : 'bright' };
  }
  if (kind === 'wood') {
    const w = WOOD_SCREWS.find(x => String(x.g) === gauge.id), d = w.d * MM;
    return { d, p: MM / w.tpi, root: 0.72 * d, shank: 0.95 * d, length: L, threaded: L >= 25 ? 0.66 * L : L,
      head: { kind: 'flat', dia: w.head * MM, angle: 82 }, point: 'gimlet', finish: 'gold' };
  }
  if (kind === 'sheet') {
    const s = SHEET_SCREWS.find(x => String(x.g) === gauge.id), d = s.d * MM;
    return { d, p: MM / s.tpi, root: 0.72 * d, length: L, threaded: L, head: { kind: 'pan', dia: 1.9 * d, height: 0.65 * d }, point: 'sharp', finish: 'bright' };
  }
  const l = LAGS.find(x => x.id === gauge.id);
  return { d: l.d, p: l.p, root: 0.75 * l.d, length: L, threaded: Math.max(L / 2, Math.min(L - l.d, L / 2 + 12.7)),
    head: { kind: 'hex', af: l.af, height: l.headH }, point: 'gimlet', finish: 'bright' };
}

// Which way round a length reads best for a screw: metric threads in millimetres, the rest in inches.
export const metricKind = ({ kind, thread, gauge }) => (kind === 'machine' ? thread.system === 'metric' : kind === 'lag' ? !!gauge?.metric : false);

export { toFrac };

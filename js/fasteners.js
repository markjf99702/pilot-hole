// What you can drive: every fastener type, its sizes, and the published numbers behind its holes.
// Inch sizes are in inches here and millimetres everywhere else; holes.js turns all of it into holes. No page code.
import { MM } from './units.js';
import { THREADS } from './threads.js';

export const MATERIALS = [
  { id: 'hardwood', name: 'Hardwood', eg: 'oak, maple, walnut', group: 'wood' },
  { id: 'softwood', name: 'Softwood', eg: 'pine, fir, cedar', group: 'wood' },
  { id: 'plywood', name: 'Plywood', eg: 'birch or construction ply', group: 'wood' },
  { id: 'mdf', name: 'MDF', eg: 'or chipboard', group: 'wood' },
  { id: 'aluminium', name: 'Aluminium', eg: 'plate, angle, extrusion', group: 'metal' },
  { id: 'steel', name: 'Steel', eg: 'mild steel, sheet or plate', group: 'metal' },
  { id: 'printed', name: 'Printed part', eg: 'PLA, PETG, ABS', group: 'printed' },
];
export const materialById = id => MATERIALS.find(m => m.id === id);
export const WOOD = ['hardwood', 'softwood', 'plywood', 'mdf'];

// ---------- Wood screws ----------
// Major diameter by gauge: 0.060″ + 0.013″ per gauge number (ASME B18.6.1). Pilot, shank and head-bore
// sizes from WOOD Magazine's chart: traditional (tapered) screws for every gauge, and the thinner-shanked
// production screws sold today for #4 to #14. head is the 82° flat head's diameter (B18.6.1).
// tpi is the traditional thread count, used only to draw one on the gauge.
const WOOD_TPI = { 2: 26, 3: 24, 4: 22, 5: 20, 6: 18, 7: 16, 8: 15, 9: 14, 10: 13, 12: 11, 14: 10 };
export const WOOD_SCREWS = [
  { g: 2, shank: '3/32', hard: '1/16', soft: '1/16', bore: '11/64', head: 0.172 },
  { g: 3, shank: '7/64', hard: '1/16', soft: '1/16', bore: '13/64', head: 0.199 },
  { g: 4, shank: '7/64', hard: '5/64', soft: '1/16', bore: '15/64', head: 0.225, prod: { hard: '5/64', soft: '1/16', bore: '7/32' } },
  { g: 5, shank: '1/8', hard: '5/64', soft: '1/16', bore: '1/4', head: 0.252 },
  { g: 6, shank: '9/64', hard: '3/32', soft: '5/64', bore: '9/32', head: 0.279, prod: { hard: '7/64', soft: '3/32', bore: '17/64' } },
  { g: 7, shank: '5/32', hard: '7/64', soft: '3/32', bore: '5/16', head: 0.305 },
  { g: 8, shank: '5/32', hard: '7/64', soft: '3/32', bore: '11/32', head: 0.332, prod: { hard: '1/8', soft: '7/64', bore: '11/32' } },
  { g: 9, shank: '11/64', hard: '1/8', soft: '7/64', bore: '23/64', head: 0.358 },
  { g: 10, shank: '3/16', hard: '1/8', soft: '7/64', bore: '25/64', head: 0.385, prod: { hard: '9/64', soft: '1/8', bore: '23/64' } },
  { g: 12, shank: '7/32', hard: '9/64', soft: '1/8', bore: '7/16', head: 0.438, prod: { hard: '5/32', soft: '9/64', bore: '7/16' } },
  { g: 14, shank: '1/4', hard: '5/32', soft: '9/64', bore: '1/2', head: 0.491, prod: { hard: '3/16', soft: '5/32', bore: '1/2' } },
].map(w => ({ ...w, d: 0.060 + 0.013 * w.g, tpi: WOOD_TPI[w.g] }));

// Drivers for wood screws: Phillips and square (Robertson) by gauge, with Robertson's colours (#00 orange for
// #1 and #2 screws), and the Torx sizes most modern screws use.
export function woodDrivers(g) {
  const ph = g <= 4 ? 1 : g <= 10 ? 2 : 3;
  const sq = g <= 2 ? ['00', 'orange'] : g <= 4 ? [0, 'yellow'] : g <= 7 ? [1, 'green'] : g <= 10 ? [2, 'red'] : [3, 'black'];
  const torx = { 4: 10, 5: 10, 6: 15, 7: 15, 8: 20, 9: 20, 10: 25, 12: 30, 14: 30 }[g];
  return { phillips: ph, square: sq[0], squareColour: sq[1], torx };
}

// ---------- Machine screws and bolts ----------
// Inch socket head cap screws (ASME B18.3): head diameter, hex key, and the usual counterbore
// (Machinery's Handbook). The head is as tall as the screw is thick.
const SOCKET_IN = {
  '#0': { head: 0.096, key: 0.050, cb: '1/8' }, '#2': { head: 0.140, key: 5 / 64, cb: '3/16' },
  '#4': { head: 0.183, key: 3 / 32, cb: '7/32' }, '#6': { head: 0.226, key: 7 / 64, cb: '9/32' },
  '#8': { head: 0.270, key: 9 / 64, cb: '5/16' }, '#10': { head: 0.312, key: 5 / 32, cb: '3/8' },
  '1/4': { head: 0.375, key: 3 / 16, cb: '7/16' }, '5/16': { head: 0.469, key: 1 / 4, cb: '17/32' },
  '3/8': { head: 0.562, key: 5 / 16, cb: '5/8' }, '7/16': { head: 0.656, key: 3 / 8, cb: '23/32' },
  '1/2': { head: 0.750, key: 3 / 8, cb: '13/16' },
};
// Inch button heads and flat (countersunk) socket heads take the same keys (ASME B18.3).
const BUTTON_KEY_IN = { '#2': 0.050, '#4': 1 / 16, '#6': 5 / 64, '#8': 3 / 32, '#10': 1 / 8, '1/4': 5 / 32, '5/16': 3 / 16, '3/8': 7 / 32, '1/2': 5 / 16 };
// Inch 82° flat heads (Phillips or slotted, ASME B18.6.3): head diameter and Phillips point.
const FLAT_IN = {
  '#0': [0.119, 0], '#2': [0.172, 1], '#4': [0.225, 1], '#6': [0.279, 2], '#8': [0.332, 2], '#10': [0.385, 2],
  '#12': [0.438, 3], '1/4': [0.507, 3], '5/16': [0.635, 4], '3/8': [0.762, 4], '7/16': [0.812, 4], '1/2': [0.875, 4],
};
// Hex wrench sizes, inch: cap screws (B18.2.1).
const HEX_IN = { '1/4': 7 / 16, '5/16': 1 / 2, '3/8': 9 / 16, '7/16': 5 / 8, '1/2': 3 / 4 };
// Hex nuts, inch: [across the flats, thickness]. Machine screw nuts (B18.6.3) to #12, finished hex nuts (B18.2.2) from 1/4″.
const NUT_IN = {
  '#0': [5 / 32, 3 / 64], '#2': [3 / 16, 1 / 16], '#4': [1 / 4, 3 / 32], '#6': [5 / 16, 7 / 64], '#8': [11 / 32, 1 / 8], '#10': [3 / 8, 1 / 8],
  '#12': [7 / 16, 5 / 32], '1/4': [7 / 16, 7 / 32], '5/16': [1 / 2, 17 / 64], '3/8': [9 / 16, 21 / 64], '7/16': [11 / 16, 3 / 8], '1/2': [3 / 4, 7 / 16],
};
// The flat washer under a nut, inch: SAE washers (ASME B18.21.1, narrow series), [outside diameter, thickness].
const WASHER_IN = {
  '#0': [3 / 16, 0.020], '#2': [1 / 4, 0.020], '#4': [5 / 16, 0.032], '#6': [3 / 8, 0.049], '#8': [7 / 16, 0.049], '#10': [1 / 2, 0.049],
  '#12': [9 / 16, 0.065], '1/4': [5 / 8, 0.065], '5/16': [11 / 16, 0.065], '3/8': [13 / 16, 0.065], '7/16': [59 / 64, 0.065], '1/2': [1 + 1 / 16, 0.095],
};

// Metric socket head cap screws (ISO 4762): head dk, height k and key s, with the counterbore (DIN 974-1).
const SOCKET_MM = {
  2: { head: 3.8, k: 2, key: 1.5, cb: 4.4 }, 2.5: { head: 4.5, k: 2.5, key: 2, cb: 5.5 },
  3: { head: 5.5, k: 3, key: 2.5, cb: 6.5 }, 4: { head: 7, k: 4, key: 3, cb: 8 },
  5: { head: 8.5, k: 5, key: 4, cb: 10 }, 6: { head: 10, k: 6, key: 5, cb: 11 },
  8: { head: 13, k: 8, key: 6, cb: 15 }, 10: { head: 16, k: 10, key: 8, cb: 18 },
  12: { head: 18, k: 12, key: 10, cb: 20 },
};
// Button heads (ISO 7380) and countersunk socket heads (ISO 10642, head 2.24 × d) share keys from M3 up.
const BUTTON_KEY_MM = { 3: 2, 4: 2.5, 5: 3, 6: 4, 8: 5, 10: 6, 12: 8 };
// Pan heads, Phillips (ISO 7045): the cross recess each size takes, PH0 for an M2.
const PAN_MM = { 2: 0, 2.5: 1, 3: 1, 4: 2, 5: 2, 6: 3 };
// Hex bolts (ISO 4014/4017) and nuts (ISO 4032). Older DIN 931 and 934 parts are a size bigger at M10 and M12.
const HEX_MM = { 2: 4, 2.5: 5, 3: 5.5, 4: 7, 5: 8, 6: 10, 8: 13, 10: 16, 12: 18 };
const HEX_DIN = { 10: 17, 12: 19 };
// ISO 4032 nut thickness, and ISO 7089 flat washers [outside diameter, thickness].
const NUT_MM_THICK = { 2: 1.6, 2.5: 2, 3: 2.4, 4: 3.2, 5: 4.7, 6: 5.2, 8: 6.8, 10: 8.4, 12: 10.8 };
const WASHER_MM = { 2: [5, 0.3], 2.5: [6, 0.5], 3: [7, 0.5], 4: [9, 0.8], 5: [10, 1], 6: [12, 1.6], 8: [16, 1.6], 10: [20, 2], 12: [24, 2.5] };

export const HEADS = {
  socket: { name: 'Socket head', short: 'Socket' },
  button: { name: 'Button head', short: 'Button' },
  flat: { name: 'Flat head', short: 'Flat', metricName: 'Countersunk' },
  pan: { name: 'Pan head', short: 'Pan' },
  hex: { name: 'Hex head', short: 'Hex' },
};

// The heads a thread comes with, and the facts about each.
export function headFacts(t, head) {
  if (t.system === 'inch') {
    const s = t.size;
    if (head === 'socket' && SOCKET_IN[s]) return { kind: 'socket', headMm: SOCKET_IN[s].head * MM, heightMm: t.d, keyIn: SOCKET_IN[s].key, cb: `f:${SOCKET_IN[s].cb}` };
    if (head === 'button' && BUTTON_KEY_IN[s]) return { kind: 'button', keyIn: BUTTON_KEY_IN[s] };
    if (head === 'flat' && FLAT_IN[s]) return { kind: 'flat', headMm: FLAT_IN[s][0] * MM, angle: 82, phillips: FLAT_IN[s][1] };
    if (head === 'pan' && FLAT_IN[s] && !['7/16', '1/2'].includes(s)) return { kind: 'pan', phillips: FLAT_IN[s][1] };
    if (head === 'hex' && HEX_IN[s]) return { kind: 'hex', wrenchIn: HEX_IN[s] };
    return null;
  }
  const d = t.d;
  if (head === 'socket' && SOCKET_MM[d]) return { kind: 'socket', headMm: SOCKET_MM[d].head, heightMm: SOCKET_MM[d].k, keyMm: SOCKET_MM[d].key, cbMm: SOCKET_MM[d].cb };
  if (head === 'button' && BUTTON_KEY_MM[d]) return { kind: 'button', keyMm: BUTTON_KEY_MM[d] };
  if (head === 'flat' && BUTTON_KEY_MM[d]) return { kind: 'flat', headMm: +(2.24 * d).toFixed(2), angle: 90, keyMm: BUTTON_KEY_MM[d] };
  if (head === 'pan' && PAN_MM[d] != null) return { kind: 'pan', phillips: PAN_MM[d] };
  if (head === 'hex' && HEX_MM[d] && d >= 3) return { kind: 'hex', wrenchMm: HEX_MM[d], dinMm: HEX_DIN[d] };
  return null;
}
export const headsFor = t => Object.keys(HEADS).filter(h => headFacts(t, h));

// What a screw with this head is called after its thread, the way a hardware store says it:
// socket head, flat head (countersunk in metric), hex bolt (a hex head screw below 1/4″).
export function headWords(t, head) {
  if (head === 'flat' && t.system === 'metric') return 'countersunk';
  if (head === 'hex') return t.system === 'inch' && t.dIn < 0.25 ? 'hex head screw' : 'hex bolt';
  return HEADS[head].name.toLowerCase();
}

// A head's outline for drawing it at true size on the gauge, in millimetres: how wide it is (a hex across its
// flats) and how tall. Hex bolt heights from ASME B18.2.1 and ISO 4017, metric button heads from ISO 7380;
// inch button heads and pan heads go by their usual proportions.
const HEX_BOLT_H_IN = { '1/4': 5 / 32, '5/16': 13 / 64, '3/8': 15 / 64, '7/16': 9 / 32, '1/2': 5 / 16 };
const HEX_BOLT_K_MM = { 3: 2, 4: 2.8, 5: 3.5, 6: 4, 8: 5.3, 10: 6.4, 12: 7.5 };
const BUTTON_MM = { 3: [5.7, 1.65], 4: [7.6, 2.2], 5: [9.5, 2.75], 6: [10.5, 3.3], 8: [14, 4.4], 10: [17.5, 5.5], 12: [21, 6.6] };
export function headShape(t, head) {
  const f = headFacts(t, head);
  if (!f) return null;
  const d = t.d, inch = t.system === 'inch';
  if (head === 'socket') return { kind: 'socket', dia: f.headMm, height: f.heightMm };
  if (head === 'button') return { kind: 'button', dia: inch ? 1.75 * d : BUTTON_MM[d][0], height: inch ? 0.5 * d : BUTTON_MM[d][1] };
  if (head === 'flat') return { kind: 'flat', dia: f.headMm, angle: f.angle };
  if (head === 'pan') return { kind: 'pan', dia: 2 * d, height: 0.75 * d };
  return { kind: 'hex', af: inch ? f.wrenchIn * MM : f.wrenchMm, height: inch ? HEX_BOLT_H_IN[t.size] * MM : HEX_BOLT_K_MM[d] };
}

// The nut a thread takes, and the flat washer under it. A hex is 2/√3 as wide across its corners as across its flats.
const CORNERS = 2 / Math.sqrt(3);
export function nutFor(t) {
  if (t.system === 'inch') {
    const n = NUT_IN[t.size], w = WASHER_IN[t.size];
    if (!n) return null;
    return { wrenchIn: n[0], acrossMm: n[0] * CORNERS * MM, thickMm: n[1] * MM, washer: { odMm: w[0] * MM, thickMm: w[1] * MM } };
  }
  if (!HEX_MM[t.d]) return null;
  const w = WASHER_MM[t.d];
  return { wrenchMm: HEX_MM[t.d], dinMm: HEX_DIN[t.d], acrossMm: HEX_MM[t.d] * CORNERS, thickMm: NUT_MM_THICK[t.d], washer: { odMm: w[0], thickMm: w[1] } };
}

// ---------- Lag screws ----------
// Inch lags (ASME B18.2.1) and metric coach screws (DIN 571), with their wrench sizes.
// Lead holes follow the NDS: 40–70% of the shank in softwood, 65–85% in dense hardwood.
// For drawing one: af is the hex across its flats and headH its height, in millimetres, and p the thread's pitch.
export const LAGS = [
  { id: '1/4', d: 0.25 * MM, label: '1/4″', wrench: '7/16″', af: 7 / 16 * MM, headH: 11 / 64 * MM, p: MM / 10 },
  { id: '5/16', d: 0.3125 * MM, label: '5/16″', wrench: '1/2″', af: 1 / 2 * MM, headH: 7 / 32 * MM, p: MM / 9 },
  { id: '3/8', d: 0.375 * MM, label: '3/8″', wrench: '9/16″', af: 9 / 16 * MM, headH: 1 / 4 * MM, p: MM / 7 },
  { id: '1/2', d: 0.5 * MM, label: '1/2″', wrench: '3/4″', af: 3 / 4 * MM, headH: 11 / 32 * MM, p: MM / 6 },
  { id: '6', d: 6, label: '6 mm', wrench: '10 mm', metric: true, af: 10, headH: 4, p: 2.5 },
  { id: '8', d: 8, label: '8 mm', wrench: '13 mm', metric: true, af: 13, headH: 5.5, p: 3 },
  { id: '10', d: 10, label: '10 mm', wrench: '17 mm', metric: true, af: 17, headH: 7, p: 4 },
  { id: '12', d: 12, label: '12 mm', wrench: '19 mm', metric: true, af: 19, headH: 8, p: 4.5 },
];
export const LAG_LEAD = { softwood: [0.4, 0.6, 0.7], hardwood: [0.65, 0.75, 0.85] };

// ---------- Sheet-metal screws ----------
// Type A and AB tapping screws with their ISO 1478 names. sheet is the drilled pilot in steel or aluminium
// sheet from ASME B18.6.4: [thinnest, typical (0.030″ sheet), thickest] in inches. hexIn is the nut driver
// for a hex washer head. tpi is the Type AB thread count, used to draw one on the gauge.
export const SHEET_SCREWS = [
  { g: 4, d: 0.112, st: 'ST2.9', sheet: [0.086, 0.094, 0.098], ph: 1, hexIn: null, tpi: 24 },
  { g: 6, d: 0.138, st: 'ST3.5', sheet: [0.104, 0.104, 0.106], ph: 2, hexIn: 1 / 4, tpi: 20 },
  { g: 8, d: 0.164, st: 'ST4.2', sheet: [0.125, 0.125, 0.128], ph: 2, hexIn: 1 / 4, tpi: 18 },
  { g: 10, d: 0.190, st: 'ST4.8', sheet: [0.136, 0.136, 0.149], ph: 2, hexIn: 5 / 16, tpi: 16 },
  { g: 12, d: 0.216, st: 'ST5.5', sheet: [0.161, 0.161, 0.161], ph: 3, hexIn: 5 / 16, tpi: 14 },
  { g: 14, d: 0.250, st: 'ST6.3', sheet: [0.185, 0.189, 0.196], ph: 3, hexIn: 3 / 8, tpi: 14 },
];

// ---------- Heat-set inserts for printed parts ----------
// Ruthex and CNC Kitchen publish the same hole sizes. len is the insert's length (Ruthex where the two
// differ, CNC Kitchen's alongside), wall the least plastic to leave around the hole.
export const HEATSET = [
  { id: 'M2', thread: 'M2', hole: 3.2, len: 4, alsoLen: 3, wall: 1.3 },
  { id: 'M2.5', thread: 'M2.5', hole: 4.0, len: 5.7, alsoLen: 4, wall: 1.6 },
  { id: 'M3', thread: 'M3', hole: 4.0, len: 5.7, wall: 1.6 },
  { id: 'M3-short', thread: 'M3', name: 'M3 short', hole: 4.0, len: 3, wall: 1.6 },
  { id: 'M3-voron', thread: 'M3', name: 'M3 Voron', hole: 4.4, len: 4, wall: 1.3 },
  { id: 'M4', thread: 'M4', hole: 5.6, len: 8.1, wall: 2.1 },
  { id: 'M5', thread: 'M5', hole: 6.4, len: 9.5, wall: 2.6 },
  { id: 'M6', thread: 'M6', hole: 8.0, len: 12.7, wall: 3.3 },
  { id: 'M8', thread: 'M8', hole: 9.7, len: 12.7, wall: 3.3 },
  { id: '1/4-20', thread: '1/4-20', hole: 8.0, len: 12.7, wall: 3.3 },
];

// ---------- Threaded inserts for wood ----------
// E-Z Lok's drill chart: knife-thread inserts for hardwood, hex-drive inserts for softwood, ply and MDF.
export const WOOD_INSERTS = [
  { id: '8-32', thread: '8-32', knife: '17/64', hex: '15/64' },
  { id: '10-24', thread: '10-24', knife: '25/64', hex: '9/32' },
  { id: '1/4-20', thread: '1/4-20', knife: '25/64', hex: '23/64' },
  { id: '5/16-18', thread: '5/16-18', knife: '33/64', hex: '7/16' },
  { id: '3/8-16', thread: '3/8-16', knife: '33/64', hex: '15/32' },
  { id: 'M4', thread: 'M4', knife: '17/64' },
  { id: 'M5', thread: 'M5', knife: '25/64' },
  { id: 'M6', thread: 'M6', knife: '25/64', hex: '23/64' },
  { id: 'M8', thread: 'M8', knife: '33/64', hex: '7/16' },
  { id: 'M10', thread: 'M10', hex: '15/32' },
];

// ---------- Dowels, shelf pins and hinge cups ----------
export const DOWELS = [
  { id: '1/4', d: 0.25 * MM, label: '1/4″', len: 1.5 * MM, lenLabel: '1-1/2″' },
  { id: '5/16', d: 0.3125 * MM, label: '5/16″', len: 1.5 * MM, lenLabel: '1-1/2″' },
  { id: '3/8', d: 0.375 * MM, label: '3/8″', len: 2 * MM, lenLabel: '2″' },
  { id: '1/2', d: 0.5 * MM, label: '1/2″', len: 2 * MM, lenLabel: '2″' },
  { id: '6', d: 6, label: '6 mm', len: 30, lenLabel: '30 mm', metric: true },
  { id: '8', d: 8, label: '8 mm', len: 40, lenLabel: '40 mm', metric: true },
  { id: '10', d: 10, label: '10 mm', len: 50, lenLabel: '50 mm', metric: true },
  { id: '12', d: 12, label: '12 mm', len: 60, lenLabel: '60 mm', metric: true },
];
export const SHELF_PINS = [
  { id: '5', d: 5, label: '5 mm', metric: true },
  { id: '1/4', d: 0.25 * MM, label: '1/4″' },
];
export const HINGE_CUPS = [
  { id: '35', d: 35, label: '35 mm', metric: true },
];

// ---------- The types, in the order the picker shows them ----------
const threadIds = system => THREADS.filter(t => t.system === system).map(t => t.id);
export const TYPES = [
  { id: 'wood', name: 'Wood screw', plural: 'Wood screws', sizes: WOOD_SCREWS.map(w => String(w.g)), def: '8', materials: 'all', mat: 'hardwood' },
  { id: 'machine', name: 'Machine screw or bolt', short: 'Machine screw', plural: 'Machine screws and bolts', sizes: [...threadIds('inch'), ...threadIds('metric')], def: 'M3', materials: 'all', mat: 'aluminium' },
  { id: 'lag', name: 'Lag screw', plural: 'Lag screws', sizes: LAGS.map(l => l.id), def: '5/16', materials: WOOD, mat: 'softwood' },
  { id: 'sheet', name: 'Sheet-metal screw', short: 'Sheet metal', plural: 'Sheet-metal screws', sizes: SHEET_SCREWS.map(s => String(s.g)), def: '8', materials: 'all', mat: 'steel' },
  { id: 'heatset', name: 'Heat-set insert', short: 'Heat-set', plural: 'Heat-set inserts', sizes: HEATSET.map(h => h.id), def: 'M3', materials: ['printed'], mat: 'printed' },
  { id: 'insert', name: 'Threaded insert', short: 'Wood insert', plural: 'Threaded inserts for wood', sizes: WOOD_INSERTS.map(i => i.id), def: '1/4-20', materials: WOOD, mat: 'hardwood' },
  { id: 'dowel', name: 'Dowel', plural: 'Dowels', sizes: DOWELS.map(d => d.id), def: '3/8', materials: WOOD, mat: 'hardwood' },
  { id: 'shelfpin', name: 'Shelf pin', plural: 'Shelf pins', sizes: SHELF_PINS.map(s => s.id), def: '5', materials: WOOD, mat: 'plywood' },
  { id: 'hinge', name: 'Hinge cup', plural: 'Hinge cups', sizes: HINGE_CUPS.map(h => h.id), def: '35', materials: WOOD, mat: 'plywood' },
];
export const typeById = id => TYPES.find(t => t.id === id);
export const fitsMaterial = (type, material) => type.materials === 'all' || type.materials.includes(material);

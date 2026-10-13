// Machine screw and bolt threads: Unified inch (ASME B1.1) and ISO metric coarse and fine (ISO 261/262),
// with the tap drill for a 75% thread, the usual bit from the charts, and close and free clearance holes.
// Sizes are millimetres inside; inch threads keep their inch numbers too. No page code.
import { MM } from './units.js';

// Inch threads. d is the basic major diameter in inches, tpi threads per inch.
// tap is the usual tap drill and close/free the usual clearance bits (the Little Machine Shop chart).
const INCH = [
  { id: '0-80', size: '#0', d: 0.060, tpi: 80, cls: 'UNF', tap: 'f:3/64', close: 'n:52', free: 'n:50' },
  { id: '2-56', size: '#2', d: 0.086, tpi: 56, cls: 'UNC', tap: 'n:50', close: 'n:43', free: 'n:41' },
  { id: '4-40', size: '#4', d: 0.112, tpi: 40, cls: 'UNC', tap: 'n:43', close: 'n:32', free: 'n:30' },
  { id: '6-32', size: '#6', d: 0.138, tpi: 32, cls: 'UNC', tap: 'n:36', close: 'n:27', free: 'n:25' },
  { id: '8-32', size: '#8', d: 0.164, tpi: 32, cls: 'UNC', tap: 'n:29', close: 'n:18', free: 'n:16' },
  { id: '10-24', size: '#10', d: 0.190, tpi: 24, cls: 'UNC', tap: 'n:25', close: 'n:9', free: 'n:7' },
  { id: '10-32', size: '#10', d: 0.190, tpi: 32, cls: 'UNF', tap: 'n:21', close: 'n:9', free: 'n:7' },
  { id: '12-24', size: '#12', d: 0.216, tpi: 24, cls: 'UNC', tap: 'n:16', close: 'n:2', free: 'n:1' },
  { id: '1/4-20', size: '1/4', d: 0.250, tpi: 20, cls: 'UNC', tap: 'n:7', close: 'l:F', free: 'l:H' },
  { id: '1/4-28', size: '1/4', d: 0.250, tpi: 28, cls: 'UNF', tap: 'n:3', close: 'l:F', free: 'l:H' },
  { id: '5/16-18', size: '5/16', d: 0.3125, tpi: 18, cls: 'UNC', tap: 'l:F', close: 'l:P', free: 'l:Q' },
  { id: '5/16-24', size: '5/16', d: 0.3125, tpi: 24, cls: 'UNF', tap: 'l:I', close: 'l:P', free: 'l:Q' },
  { id: '3/8-16', size: '3/8', d: 0.375, tpi: 16, cls: 'UNC', tap: 'f:5/16', close: 'l:W', free: 'l:X' },
  { id: '3/8-24', size: '3/8', d: 0.375, tpi: 24, cls: 'UNF', tap: 'l:Q', close: 'l:W', free: 'l:X' },
  { id: '7/16-14', size: '7/16', d: 0.4375, tpi: 14, cls: 'UNC', tap: 'l:U', close: 'f:29/64', free: 'f:15/32' },
  { id: '7/16-20', size: '7/16', d: 0.4375, tpi: 20, cls: 'UNF', tap: 'f:25/64', close: 'f:29/64', free: 'f:15/32' },
  { id: '1/2-13', size: '1/2', d: 0.500, tpi: 13, cls: 'UNC', tap: 'f:27/64', close: 'f:33/64', free: 'f:17/32' },
  { id: '1/2-20', size: '1/2', d: 0.500, tpi: 20, cls: 'UNF', tap: 'f:29/64', close: 'f:33/64', free: 'f:17/32' },
];

// ISO 273 clearance holes: fine, medium and coarse, in millimetres. Close is fine, free is medium.
const ISO273 = {
  2: [2.2, 2.4, 2.6], 2.5: [2.7, 2.9, 3.1], 3: [3.2, 3.4, 3.6], 4: [4.3, 4.5, 4.8], 5: [5.3, 5.5, 5.8],
  6: [6.4, 6.6, 7.0], 8: [8.4, 9.0, 10.0], 10: [10.5, 11.0, 12.0], 12: [13.0, 13.5, 14.5],
};

// Metric threads, d and p in millimetres. tap is the usual tap drill (ISO 2306).
const METRIC = [
  { id: 'M2', d: 2, p: 0.4, tap: 1.6 },
  { id: 'M2.5', d: 2.5, p: 0.45, tap: 2.05 },
  { id: 'M3', d: 3, p: 0.5, tap: 2.5 },
  { id: 'M4', d: 4, p: 0.7, tap: 3.3 },
  { id: 'M5', d: 5, p: 0.8, tap: 4.2 },
  { id: 'M6', d: 6, p: 1, tap: 5 },
  { id: 'M8', d: 8, p: 1.25, tap: 6.8 },
  { id: 'M8x1', d: 8, p: 1, tap: 7, fine: true },
  { id: 'M10', d: 10, p: 1.5, tap: 8.5 },
  { id: 'M10x1.25', d: 10, p: 1.25, tap: 8.8, fine: true },
  { id: 'M10x1', d: 10, p: 1, tap: 9, fine: true },
  { id: 'M12', d: 12, p: 1.75, tap: 10.2 },
  { id: 'M12x1.5', d: 12, p: 1.5, tap: 10.5, fine: true },
  { id: 'M12x1.25', d: 12, p: 1.25, tap: 10.8, fine: true },
];

const mmId = s => `m:${String(+s.toFixed(2))}`;

export const THREADS = [
  ...INCH.map(t => ({
    id: t.id, system: 'inch', size: t.size, cls: t.cls,
    label: t.size.startsWith('#') ? `${t.id.replace(/^/, '#')}` : t.id,
    sizeLabel: t.size.startsWith('#') ? t.size : `${t.size}″`,
    dIn: t.d, tpi: t.tpi, d: t.d * MM, p: MM / t.tpi,
    tap: t.tap, close: t.close, free: t.free,
  })),
  ...METRIC.map(t => {
    const [fine, med, coarse] = ISO273[t.d];
    return {
      id: t.id, system: 'metric', size: `M${t.d}`, cls: t.fine ? 'fine' : 'coarse',
      label: t.fine ? `M${t.d} × ${t.p}` : `M${t.d}`,
      sizeLabel: `M${t.d}`,
      d: t.d, p: t.p, tap: mmId(t.tap),
      closeMm: fine, freeMm: med, looseMm: coarse,
    };
  }),
];
export const threadById = id => THREADS.find(t => t.id === id);

// The name a thread goes by, pitch included: 1/4-20, #10-32, M3 × 0.5.
export const fullName = t => (t.system === 'inch' ? t.label : `M${t.d} × ${t.p}`);
// Threads per inch or pitch, in words.
export const pitchText = t => (t.system === 'inch' ? `${t.tpi} threads per inch` : `${t.p} mm pitch`);

// Tap drills by percentage of thread, the shop formula: drill = major − 0.01299 × % × pitch.
// 75% is the usual aim; 60–85% all hold, less is easier on the tap and more is stronger in soft metal.
export const K = 0.01299;
export const tapDrillMm = (t, pct = 75) => t.d - K * pct * t.p;
export const threadPct = (t, drillMm) => (t.d - drillMm) / (K * t.p);
export const TAP_RANGE = [60, 85];

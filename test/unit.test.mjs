// The tables, the hole maths, choosing a bit, the reverse lookup and the gauge, without a browser:
//   node --test test/unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as U from '../js/units.js';
import { BITS, SETS, bitById, ownedBits, bySize, nearestInEachKind } from '../js/drills.js';
import { THREADS, threadById, tapDrillMm, threadPct, TAP_RANGE, fullName } from '../js/threads.js';
import * as FS from '../js/fasteners.js';
import { holesFor, chooseBit, usesFor, spotOn, allHoles, normalizePick, missWords, screwTools } from '../js/holes.js';
import * as G from '../js/identify.js';

const close = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) < eps, msg || `${a} is not close to ${b}`);
const inch = x => x * 25.4;
const all = new Set(BITS.map(b => b.id));
const owning = (...sets) => ownedBits({ sets });
const pick = (p, owned, key) => {
  const r = holesFor(p);
  const h = r.holes.find(x => x.key === key);
  assert.ok(h, `${r.name} has no ${key} hole`);
  return { r, h, c: chooseBit(h, owned, r.pick.material) };
};

// ---------- Units ----------

test('fractions, decimals and millimetres read the way a drill chart prints them', () => {
  assert.equal(U.fracText(7 / 64), '7/64');
  assert.equal(U.fracText(0.5), '1/2');
  assert.equal(U.fracText(1.5), '1-1/2');
  assert.equal(U.fracText(1), '1');
  assert.equal(U.fracText(0.2031, 64), '13/64');
  assert.equal(U.fracHTML(1.5), '1<span class="sp">-</span><span class="fr">1/2</span>');
  assert.equal(U.decIn(0.109375), '0.1094');
  assert.equal(U.decIn(0.201), '0.201');
  assert.equal(U.decIn(0.25), '0.25');
  assert.equal(U.mmText(2.778125), '2.78');
  assert.equal(U.mmText(35), '35');
  assert.equal(U.offText(inch(0.0035), false), '0.0035″');
  assert.equal(U.offText(0.05, true), '0.05 mm');
  // Halves round up, the way charts print them: 1/8″ is 3.18 mm, not 3.17.
  assert.equal(U.mmText(inch(1 / 8)), '3.18');
  assert.equal(U.mmText(inch(3 / 8)), '9.53');
  assert.equal(U.mmText(inch(1 / 16)), '1.59');
  assert.equal(U.offText(0.045, true), '0.05 mm');
  assert.ok(U.isFrac(7 / 64));
  assert.ok(!U.isFrac(0.1065));
});

// ---------- Drill series ----------

test('number and letter drills match ASME B94.11M', () => {
  assert.equal(bitById('n:1').in, 0.228);
  assert.equal(bitById('n:7').in, 0.201);
  assert.equal(bitById('n:29').in, 0.136);
  assert.equal(bitById('n:36').in, 0.1065);
  assert.equal(bitById('n:43').in, 0.089);
  assert.equal(bitById('n:50').in, 0.07);
  assert.equal(bitById('n:60').in, 0.04);
  assert.equal(bitById('n:80').in, 0.0135);
  assert.equal(bitById('l:A').in, 0.234);
  assert.equal(bitById('l:F').in, 0.257);
  assert.equal(bitById('l:Q').in, 0.332);
  assert.equal(bitById('l:Z').in, 0.413);
  // Numbers get smaller as they go up; letters get bigger.
  for (let n = 1; n < 80; n++) assert.ok(bitById(`n:${n}`).in > bitById(`n:${n + 1}`).in, `#${n} should be bigger than #${n + 1}`);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (let i = 1; i < letters.length; i++) assert.ok(bitById(`l:${letters[i]}`).in > bitById(`l:${letters[i - 1]}`).in);
  // #1 is just under A, Z just over 13/32.
  assert.ok(bitById('n:1').in < bitById('l:A').in);
  assert.ok(bitById('l:Z').in > 13 / 32);
});

test('fractional and metric bits are exact, with names and ids that round-trip', () => {
  const b = bitById('f:7/64');
  assert.equal(b.name, '7/64″');
  close(b.mm, 2.778125);
  assert.equal(bitById('f:1').name, '1″');
  assert.equal(bitById('m:2.5').name, '2.5 mm');
  assert.equal(bitById('m:10.2').mm, 10.2);
  assert.ok(bitById('m:2.05'), 'the M2.5 tap drill is there');
  assert.ok(bitById('fm:35'), 'a 35 mm Forstner');
  assert.ok(bitById('fo:1-3/8'), 'a 1-3/8″ Forstner');
  for (const b of BITS) assert.equal(bitById(b.id), b, `${b.id} looks itself up`);
  assert.equal(new Set(BITS.map(b => b.id)).size, BITS.length, 'no two bits share an id');
});

test('sets have the bits they say, and owning one means owning its bits', () => {
  const count = id => SETS.find(s => s.id === id).bits.length;
  assert.equal(count('frac29'), 29);
  assert.equal(count('num60'), 60);
  assert.equal(count('num80'), 20);
  assert.equal(count('letter'), 26);
  assert.equal(count('met25'), 25);
  assert.equal(count('met91'), 91);
  assert.equal(count('fracbig'), 16);
  for (const s of SETS) for (const id of s.bits) assert.ok(bitById(id), `${s.id} has an unknown bit ${id}`);
  const frac = SETS.find(s => s.id === 'frac29');
  assert.equal(frac.bits[0], 'f:1/16');
  assert.equal(frac.bits.at(-1), 'f:1/2');
  const owned = ownedBits({ sets: ['frac29'], missing: ['frac29:f:7/64'], loose: ['n:36', 'nope'] });
  assert.ok(!owned.has('f:7/64'), 'a missing bit isn’t owned');
  assert.ok(owned.has('f:1/8'));
  assert.ok(owned.has('n:36'), 'a loose bit is owned');
  assert.ok(!owned.has('nope'));
  // Two sets with the same size: missing from one, still there in the other.
  const both = ownedBits({ sets: ['met25', 'met91'], missing: ['met25:m:5'] });
  assert.ok(both.has('m:5'));
});

test('the nearest bit in each series', () => {
  const n = nearestInEachKind(inch(7 / 64));
  assert.equal(n.frac.id, 'f:7/64');
  assert.equal(n.num.id, 'n:35');
  assert.equal(n.metric.id, 'm:2.8');
  assert.equal(nearestInEachKind(inch(0.2)).num.id, 'n:7');
});

// ---------- Threads ----------

test('threads have the right sizes and pitches', () => {
  const t = threadById('1/4-20');
  close(t.d, 6.35);
  close(t.p, 1.27);
  assert.equal(fullName(t), '1/4-20');
  assert.equal(fullName(threadById('M3')), 'M3 × 0.5');
  assert.equal(fullName(threadById('M10x1.25')), 'M10 × 1.25');
  assert.equal(threadById('10-32').label, '#10-32');
  for (const t of THREADS) {
    for (const id of [t.tap, t.close, t.free].filter(Boolean)) assert.ok(bitById(id), `${t.id}: unknown bit ${id}`);
    assert.ok(t.d > 0 && t.p > 0);
  }
});

test('the 75% formula picks the chart’s tap drill for every thread', () => {
  const inchBits = new Set(BITS.filter(b => b.kind === 'frac' || b.kind === 'num' || b.kind === 'letter').map(b => b.id));
  const mmBits = new Set(BITS.filter(b => b.kind === 'metric').map(b => b.id));
  for (const t of THREADS) {
    const r = holesFor({ type: 'machine', size: t.id, material: 'aluminium' });
    const h = r.holes.find(x => x.key === 'tap');
    const c = chooseBit(h, t.system === 'inch' ? inchBits : mmBits, 'aluminium');
    assert.equal(c.bit.id, t.tap, `${t.label}: got ${c.bit.name}, the chart says ${bitById(t.tap).name}`);
    const pct = threadPct(t, bitById(t.tap).mm);
    assert.ok(pct >= TAP_RANGE[0] && pct <= TAP_RANGE[1], `${t.label}: the usual bit gives ${pct.toFixed(0)}%`);
  }
  close(tapDrillMm(threadById('1/4-20')) / 25.4, 0.2013, 1e-4);
  close(threadPct(threadById('1/4-20'), inch(0.201)), 75.4, 0.1);
  close(threadPct(threadById('1/4-20'), inch(13 / 64)), 72, 0.5);
});

test('clearance holes clear the thread, close smaller than free', () => {
  for (const t of THREADS) {
    const r = holesFor({ type: 'machine', size: t.id, material: 'steel' });
    const c = r.holes.find(h => h.key === 'close'), f = r.holes.find(h => h.key === 'free');
    assert.ok(c.ideal > t.d, `${t.label} close clears it`);
    assert.ok(f.ideal > c.ideal, `${t.label} free is bigger than close`);
    assert.ok(c.min > t.d, `${t.label}: nothing in the close range is smaller than the screw`);
    close(c.max, f.min, 1e-9, `${t.label}: close and free meet in the middle`);
  }
  // ISO 273 and the Little Machine Shop chart.
  const m3 = holesFor({ type: 'machine', size: 'M3', material: 'steel' });
  assert.equal(m3.holes.find(h => h.key === 'close').ideal, 3.2);
  assert.equal(m3.holes.find(h => h.key === 'free').ideal, 3.4);
  const q = holesFor({ type: 'machine', size: '1/4-20', material: 'steel' });
  assert.equal(q.holes.find(h => h.key === 'close').usual, 'l:F');
  assert.equal(q.holes.find(h => h.key === 'free').usual, 'l:H');
});

// ---------- Every hole of every fastener ----------

test('every fastener, size and material gives sensible holes', () => {
  let n = 0;
  for (const type of FS.TYPES) {
    for (const size of type.sizes) {
      for (const m of FS.MATERIALS) {
        const heads = type.id === 'machine' ? FS.headsFor(threadById(size)) : [undefined];
        for (const head of heads) {
          const r = holesFor({ type: type.id, size, material: m.id, head });
          assert.ok(r.name && r.holes.length, `${type.id} ${size} ${m.id}`);
          for (const h of r.holes) {
            n++;
            assert.ok(h.name && h.ideal > 0, `${r.name}: a hole with no size`);
            assert.ok(h.min <= h.ideal + 1e-9 && h.ideal <= h.max + 1e-9, `${r.name} ${h.name}: ${h.min} ≤ ${h.ideal} ≤ ${h.max}`);
            if (h.usual) assert.ok(bitById(h.usual), `${r.name} ${h.name}: unknown usual bit ${h.usual}`);
            if (h.usual && !h.cone) {
              const u = bitById(h.usual).mm;
              assert.ok(u >= h.min - 1e-6 && u <= h.max + 1e-6, `${r.name} ${h.name}: the usual bit is outside the range`);
            }
          }
        }
      }
    }
  }
  assert.ok(n > 1000, `${n} holes checked`);
});

test('a pick that doesn’t make sense is put right', () => {
  assert.deepEqual(normalizePick({ type: 'heatset', size: 'M3', material: 'oak' }), { type: 'heatset', size: 'M3', material: 'printed' });
  assert.deepEqual(normalizePick({ type: 'nonsense' }), { type: 'wood', size: '8', material: 'hardwood' });
  assert.equal(normalizePick({ type: 'machine', size: '#12', material: 'steel' }).size, 'M3', 'an unknown size falls back');
  assert.equal(normalizePick({ type: 'machine', size: '12-24', head: 'socket', material: 'steel' }).head, 'flat', 'no #12 socket or button heads');
  assert.equal(normalizePick({ type: 'lag', size: '5/16', material: 'steel' }).material, 'softwood');
});

// ---------- Wood screws (WOOD Magazine’s chart) ----------

test('wood screws: pilot, shank, countersink and plug', () => {
  const frac = owning('frac29');
  let { c, h, r } = pick({ type: 'wood', size: '8', material: 'hardwood' }, frac, 'pilot');
  assert.equal(c.bit.id, 'f:1/8');
  assert.equal(h.alt[0].bit, 'f:7/64', 'old-style tapered screws want 7/64″');
  assert.equal(pick({ type: 'wood', size: '8', material: 'softwood' }, frac, 'pilot').c.bit.id, 'f:7/64');
  assert.equal(pick({ type: 'wood', size: '8', material: 'mdf' }, frac, 'pilot').c.bit.id, 'f:1/8', 'MDF takes the hardwood size');
  assert.equal(pick({ type: 'wood', size: '8', material: 'hardwood' }, frac, 'shank').c.bit.id, 'f:5/32');
  assert.equal(pick({ type: 'wood', size: '10', material: 'hardwood' }, frac, 'pilot').c.bit.id, 'f:9/64');
  assert.equal(pick({ type: 'wood', size: '6', material: 'softwood' }, frac, 'pilot').c.bit.id, 'f:3/32');
  assert.equal(pick({ type: 'wood', size: '14', material: 'hardwood' }, frac, 'pilot').c.bit.id, 'f:3/16');
  // #9 has no production-screw figures, so it uses the traditional chart and says so.
  ({ h } = pick({ type: 'wood', size: '9', material: 'hardwood' }, frac, 'pilot'));
  assert.equal(h.usual, 'f:1/8');
  assert.match(h.note, /traditional/);
  ({ h, r } = pick({ type: 'wood', size: '8', material: 'hardwood' }, frac, 'csink'));
  assert.equal(h.cone.angle, 82);
  close(h.cone.dia, inch(0.332));
  assert.equal(pick({ type: 'wood', size: '8', material: 'hardwood' }, frac, 'plug').c.bit.id, 'f:3/8');
  assert.deepEqual(r.tools.map(t => `${t.what} ${t.text}`), ['Phillips #2', 'Square #2 (red)', 'Torx T20, on many modern screws']);
  // In metal it says so, and only offers the clearance through a bracket.
  r = holesFor({ type: 'wood', size: '8', material: 'steel' });
  assert.match(r.warn, /don’t hold in metal/);
  assert.equal(r.holes[0].usual, 'f:11/64');
  // Every gauge: hardwood pilot ≥ softwood pilot < shank hole.
  for (const w of FS.WOOD_SCREWS) {
    const v = s => { const [a, b] = s.split('/'); return a / b; };
    assert.ok(v(w.hard) >= v(w.soft), `#${w.g}: hardwood pilot is at least the softwood one`);
    assert.ok(v(w.shank) > v(w.hard), `#${w.g}: shank hole is bigger than the pilot`);
    if (w.prod) assert.ok(v(w.prod.hard) >= v(w.prod.soft));
    close(w.d, 0.060 + 0.013 * w.g);
  }
});

test('a missing pilot bit names the neighbour that will do, with what to watch', () => {
  // 1/8″ gone from the case: a #8 in hardwood takes 7/64″ (the old-style size) with wax.
  const without18 = ownedBits({ sets: ['frac29'], missing: ['frac29:f:1/8'] });
  let { c } = pick({ type: 'wood', size: '8', material: 'hardwood' }, without18, 'pilot');
  assert.equal(c.ok, true);
  assert.equal(c.bit.id, 'f:7/64');
  assert.equal(c.near, 'tight');
  assert.match(c.words, /wax the screw/);
  assert.equal(c.other.bit.id, 'f:9/64');
  assert.equal(c.other.near, 'loose');
  assert.equal(c.usual.id, 'f:1/8');
  // MDF would rather be loose than split.
  ({ c } = pick({ type: 'wood', size: '8', material: 'mdf' }, without18, 'pilot'));
  assert.equal(c.bit.id, 'f:9/64');
  assert.equal(c.near, 'loose');
  // Softwood, with a metric set too: 2.5 mm stands in for a missing 7/64″.
  ({ c } = pick({ type: 'wood', size: '8', material: 'softwood' }, ownedBits({ sets: ['frac29', 'met25'], missing: ['frac29:f:7/64'] }), 'pilot'));
  assert.equal(c.bit.id, 'm:2.5');
  assert.equal(c.near, 'tight');
  // A small screw is fussier: a #4 in hardwood won't take 1/16″ for a missing 5/64″.
  ({ c } = pick({ type: 'wood', size: '4', material: 'hardwood' }, ownedBits({ sets: ['frac29'], missing: ['frac29:f:5/64'] }), 'pilot'));
  assert.equal(c.ok, false);
  // Hinge screws and sheet-metal screws in wood forgive the same way; tap drills never do.
  assert.equal(pick({ type: 'hinge', size: '35', material: 'hardwood' }, ownedBits({ sets: ['frac29'], missing: ['frac29:f:7/64'] }), 'screws').c.near, 'tight');
  assert.equal(pick({ type: 'sheet', size: '8', material: 'hardwood' }, without18, 'pilot').c.near, 'tight');
  assert.equal(pick({ type: 'machine', size: 'M3', material: 'aluminium' }, owning('frac29'), 'tap').c.ok, false);
});

// ---------- Machine screws ----------

test('machine screws: tap drill in the bits you own, with the thread it gives', () => {
  let { c } = pick({ type: 'machine', size: '1/4-20', material: 'aluminium', head: 'socket' }, owning('frac29'), 'tap');
  assert.equal(c.bit.id, 'f:13/64');
  close(c.pct, 72, 0.5);
  assert.equal(c.usual.id, 'n:7');
  ({ c } = pick({ type: 'machine', size: '1/4-20', material: 'aluminium', head: 'socket' }, owning('frac29', 'num60'), 'tap'));
  assert.equal(c.bit.id, 'n:7');
  // #8-32 with only fractions: 9/64″ gives a shallow 58% thread, which still holds in steel.
  ({ c } = pick({ type: 'machine', size: '8-32', material: 'steel', head: 'socket' }, owning('frac29'), 'tap'));
  assert.equal(c.bit.id, 'f:9/64');
  close(c.pct, 57.7, 0.2);
  // M3 in a print with only fractional bits: nothing gives a usable thread, and it says which way each misses.
  ({ c } = pick({ type: 'machine', size: 'M3', material: 'printed' }, owning('frac29'), 'tap'));
  assert.equal(c.ok, false);
  assert.equal(c.below.bit.id, 'f:3/32');
  assert.ok(c.below.pct > 85, 'too tight');
  assert.equal(c.above.bit.id, 'f:7/64');
  assert.ok(c.above.pct < 60, 'too loose');
  // ...but 7/64″ will do to screw one straight in.
  assert.equal(pick({ type: 'machine', size: 'M3', material: 'printed' }, owning('frac29'), 'straight').c.bit.id, 'f:7/64');
  assert.equal(pick({ type: 'machine', size: 'M3', material: 'printed' }, owning('met25'), 'tap').c.bit.id, 'm:2.5');
  assert.equal(pick({ type: 'machine', size: 'M12', material: 'steel' }, owning('met91', 'tapmm'), 'tap').c.bit.id, 'm:10.2', 'the chart’s 10.2, not 10.3');
});

test('a bit either side of a tap drill says what’s wrong in words, never an impossible thread', () => {
  const frac = owning('frac29');
  // #0-80: the smallest fractional bit, 1/16″, is wider than the screw itself.
  let { c, h } = pick({ type: 'machine', size: '0-80', material: 'aluminium' }, frac, 'tap');
  assert.equal(c.ok, false);
  assert.equal(c.above.bit.id, 'f:1/16');
  assert.ok(c.above.pct < 0);
  assert.equal(missWords(h, c.above, 'above', false), 'bigger than the screw: no thread at all');
  // #2-56: 1/16″ is narrower than the screw's core, past a full thread.
  ({ c, h } = pick({ type: 'machine', size: '2-56', material: 'steel' }, frac, 'tap'));
  assert.equal(c.below.bit.id, 'f:1/16');
  assert.ok(c.below.pct > 100);
  assert.equal(missWords(h, c.below, 'below', false), 'smaller than the screw’s core: the tap would jam');
  assert.equal(missWords(h, c.above, 'above', false), '34% thread: too loose to hold');
  // Into a print with no tap, the words are about the screw, not a tap.
  ({ c, h } = pick({ type: 'machine', size: '0-80', material: 'printed' }, frac, 'straight'));
  assert.equal(missWords(h, c.above, 'above', false), 'bigger than the screw: it won’t grip');
  ({ c, h } = pick({ type: 'machine', size: 'M3', material: 'printed' }, owning('num60'), 'straight'));
  assert.ok(c.ok, 'a number bit will do to screw an M3 straight in');
  // Every thread, every material it taps into, every set: no thread under 0% or over 100%.
  for (const t of THREADS) {
    for (const material of ['aluminium', 'steel', 'printed']) {
      for (const s of SETS) {
        const r = holesFor({ type: 'machine', size: t.id, material });
        for (const hh of r.holes) {
          const cc = chooseBit(hh, owning(s.id), material);
          if (cc.ok) continue;
          for (const side of ['below', 'above']) {
            if (!cc[side]) continue;
            const words = missWords(hh, cc[side], side, t.system === 'metric');
            assert.doesNotMatch(words, /-\d+%|\b(1\d\d|[2-9]\d\d)%/, `${t.label} ${material} ${s.id} ${hh.key}: ${words}`);
          }
        }
      }
    }
  }
  // A clearance hole too small to pass the screw says so.
  ({ c, h } = pick({ type: 'machine', size: 'M3', material: 'steel' }, owning('frac29'), 'close'));
  assert.equal(c.ok, true);
  ({ c, h } = pick({ type: 'machine', size: '1/4-20', material: 'steel' }, new Set(['f:1/4', 'f:5/16']), 'close'));
  assert.equal(missWords(h, c.below, 'below', false), 'won’t clear the screw');
  assert.match(missWords(h, c.above, 'above', false), /: a free fit, not a close one$/);
});

test('a nut counterbore takes the nut’s corners and the washer under it', () => {
  for (const t of THREADS) {
    const h = holesFor({ type: 'machine', size: t.id, material: 'hardwood' }).holes.find(x => x.key === 'nut');
    const nut = FS.nutFor(t);
    assert.ok(nut.washer.odMm > nut.acrossMm, `${t.label}: the washer is wider than the nut`);
    assert.ok(h.min > nut.washer.odMm, `${t.label}: the smallest bit it takes still fits the washer`);
    if (t.system === 'inch') assert.ok(!bitById(h.usual).metric, `${t.label}: an inch job gets an inch Forstner`);
    for (const s of SETS) {
      const c = chooseBit(h, owning(s.id), 'hardwood');
      if (c.ok) assert.ok(c.bit.mm > nut.washer.odMm, `${t.label} with ${s.id}: ${c.bit.name} is narrower than the washer`);
    }
  }
  // 1/4-20: the 7/16″ nut is 0.505″ across its corners and its SAE washer 5/8″, so the fractional set's 1/2″ won't do.
  const q = threadById('1/4-20');
  close(FS.nutFor(q).acrossMm / 25.4, 0.505, 0.001);
  const { h, c } = pick({ type: 'machine', size: '1/4-20', material: 'hardwood', head: 'hex' }, owning('frac29'), 'nut');
  assert.equal(c.ok, false);
  assert.equal(c.below.bit.id, 'f:1/2');
  assert.equal(missWords(h, c.below, 'below', false), '0.125″ narrower than the washer: it won’t go in');
  assert.equal(h.spare, FS.nutFor(q).washer.odMm, 'a bit for it is judged by the room it leaves around the washer');
  assert.equal(h.usual, 'fo:3/4');
  assert.equal(chooseBit(h, owning('frac29', 'forin'), 'hardwood').bit.id, 'fo:3/4');
  assert.match(h.depth, /^At least 5\/16″, for the nut and its washer/);
  assert.match(h.note, /5\/8″ flat washer/);
  // Metric: an M6 nut's ISO 7089 washer is 12 mm across; a 3/8-16 asks for a 7/8″ Forstner, not a 20 mm one.
  assert.equal(pick({ type: 'machine', size: 'M6', material: 'softwood' }, owning('met25'), 'nut').c.bit.id, 'm:13');
  assert.equal(holesFor({ type: 'machine', size: '3/8-16', material: 'hardwood' }).holes.find(x => x.key === 'nut').usual, 'fo:7/8');
});

test('machine screws: heads, keys, counterbores and countersinks', () => {
  const r = holesFor({ type: 'machine', size: 'M3', material: 'aluminium', head: 'socket' });
  const cb = r.holes.find(h => h.key === 'cbore');
  assert.equal(cb.ideal, 6.5);
  assert.match(cb.depth, /3 mm/);
  // A tapped hole takes a key and a tap, and no nut: there isn't one.
  assert.deepEqual(r.tools.map(t => t.what), ['Hex key', 'Tap']);
  assert.equal(r.tools[0].text, '2.5 mm');
  for (const material of ['aluminium', 'steel', 'printed']) {
    for (const t of THREADS) {
      for (const head of FS.headsFor(t)) {
        assert.ok(!holesFor({ type: 'machine', size: t.id, material, head }).tools.some(x => x.what === 'Nut' || /the nut/.test(x.text)), `${t.label} ${head} into ${material} lists a nut`);
      }
    }
  }
  const q = holesFor({ type: 'machine', size: '1/4-20', material: 'steel', head: 'socket' });
  assert.equal(q.tools[0].text, '3/16″');
  assert.equal(q.holes.find(h => h.key === 'cbore').usual, 'f:7/16');
  const hex = holesFor({ type: 'machine', size: 'M10', material: 'steel', head: 'hex' });
  assert.deepEqual(hex.tools.map(t => `${t.what} ${t.text}`), ['Wrench 16 mm (17 mm on older DIN bolts)', 'Tap M10 × 1.5']);
  assert.equal(hex.name, 'M10 hex bolt');
  const q20 = holesFor({ type: 'machine', size: '1/4-20', material: 'aluminium', head: 'hex' });
  assert.equal(q20.name, '1/4-20 hex bolt', 'the gauge calls it a hex bolt too');
  assert.deepEqual(q20.tools.map(t => `${t.what} ${t.text}`), ['Wrench 7/16″', 'Tap 1/4-20 UNC']);
  // Through wood there is a nut. A hex bolt whose nut takes the same wrench gets one line for both.
  const tools = p => holesFor({ type: 'machine', material: 'hardwood', ...p }).tools.map(t => `${t.what} ${t.text}`);
  assert.deepEqual(tools({ size: 'M10', head: 'hex' }), ['Wrench 16 mm, for the head and the nut (17 mm on older DIN parts)']);
  assert.deepEqual(tools({ size: '1/4-20', head: 'hex' }), ['Wrench 7/16″, for the head and the nut']);
  assert.deepEqual(tools({ size: '7/16-14', head: 'hex' }), ['Wrench 5/8″', 'Nut 11/16″ wrench'], 'a 7/16″ nut is bigger than the head');
  assert.deepEqual(tools({ size: 'M3', head: 'socket' }), ['Hex key 2.5 mm', 'Nut 5.5 mm wrench']);
  // A loose bolt on the gauge: everything it takes, its nut and its tap too, and no key until its head is known.
  assert.deepEqual(screwTools(threadById('1/4-20'), 'hex').map(t => `${t.what} ${t.text}`), ['Wrench 7/16″, for the head and the nut', 'Tap 1/4-20 UNC']);
  assert.deepEqual(screwTools(threadById('7/16-14'), 'hex').map(t => `${t.what} ${t.text}`), ['Wrench 5/8″', 'Nut 11/16″ wrench', 'Tap 7/16-14 UNC']);
  assert.deepEqual(screwTools(threadById('M3'), null).map(t => `${t.what} ${t.text}`), ['Nut 5.5 mm wrench', 'Tap M3 × 0.5']);
  // A bolt through wood takes a nut, not a tap; a heat-set insert takes neither.
  assert.deepEqual(holesFor({ type: 'machine', size: '1/4-20', material: 'hardwood', head: 'hex' }).tools.map(t => t.what), ['Wrench']);
  assert.deepEqual(holesFor({ type: 'heatset', size: 'M3' }).tools.map(t => `${t.what} ${t.text}`),
    ['Soldering iron With an insert tip, set 10–⁠20 °C above your print temperature. Press it in straight and stop flush.', 'Hex key 2.5 mm, for a socket head screw']);
  const flat = holesFor({ type: 'machine', size: '10-32', material: 'aluminium', head: 'flat' });
  const cs = flat.holes.find(h => h.key === 'csink');
  assert.equal(cs.cone.angle, 82);
  close(cs.cone.dia, inch(0.385));
  const mflat = holesFor({ type: 'machine', size: 'M4', material: 'aluminium', head: 'flat' });
  assert.equal(mflat.holes.find(h => h.key === 'csink').cone.angle, 90);
  assert.equal(mflat.tools[0].text, '2.5 mm');
  assert.equal(holesFor({ type: 'machine', size: '1/2-13', material: 'steel', head: 'socket' }).tools[0].text, '3/8″');
  // Keys from ASME B18.3 and ISO 4762.
  const key = (size, head) => holesFor({ type: 'machine', size, material: 'steel', head }).tools[0].text;
  assert.equal(key('4-40', 'socket'), '3/32″');
  assert.equal(key('6-32', 'socket'), '7/64″');
  assert.equal(key('8-32', 'socket'), '9/64″');
  assert.equal(key('10-24', 'socket'), '5/32″');
  assert.equal(key('M4', 'socket'), '3 mm');
  assert.equal(key('M5', 'socket'), '4 mm');
  assert.equal(key('M6', 'socket'), '5 mm');
  assert.equal(key('M8', 'socket'), '6 mm');
  assert.equal(key('M3', 'button'), '2 mm');
  assert.equal(key('1/4-20', 'button'), '5/32″');
  // Into wood: through and a nut, or a threaded insert.
  const wood = holesFor({ type: 'machine', size: '1/4-20', material: 'hardwood', head: 'socket' });
  assert.equal(wood.holes[0].key, 'through');
  assert.equal(wood.related[0].pick.type, 'insert');
  // Into a print: a heat-set insert is offered.
  assert.equal(holesFor({ type: 'machine', size: 'M3', material: 'printed' }).related[0].pick.type, 'heatset');
});

// ---------- The rest ----------

test('lags, sheet-metal screws, inserts, dowels, shelf pins and hinge cups', () => {
  const frac = owning('frac29');
  assert.equal(pick({ type: 'lag', size: '5/16', material: 'softwood' }, frac, 'lead').c.bit.id, 'f:3/16');
  assert.equal(pick({ type: 'lag', size: '1/4', material: 'hardwood' }, frac, 'lead').c.bit.id, 'f:3/16');
  assert.equal(pick({ type: 'lag', size: '5/16', material: 'softwood' }, frac, 'shank').c.bit.id, 'f:5/16');
  assert.equal(holesFor({ type: 'lag', size: '3/8' }).tools[0].text, '9/16″');
  assert.equal(pick({ type: 'sheet', size: '8', material: 'steel' }, frac, 'pilot').c.bit.id, 'f:1/8');
  assert.equal(pick({ type: 'sheet', size: '10', material: 'aluminium' }, owning('num60'), 'pilot').c.bit.id, 'n:29');
  assert.match(holesFor({ type: 'sheet', size: '10' }).tools[0].text, /5\/16″ nut driver/);
  // Heat-set inserts: Ruthex and CNC Kitchen sizes.
  assert.equal(pick({ type: 'heatset', size: 'M3' }, owning('met25'), 'insert').c.bit.id, 'm:4');
  assert.equal(pick({ type: 'heatset', size: 'M3' }, frac, 'insert').c.bit.id, 'f:5/32');
  assert.equal(pick({ type: 'heatset', size: 'M4' }, owning('met91'), 'insert').c.bit.id, 'm:5.6');
  assert.equal(pick({ type: 'heatset', size: 'M5' }, owning('met91'), 'insert').c.bit.id, 'm:6.4');
  assert.match(holesFor({ type: 'heatset', size: 'M3' }).holes[0].depth, /6.7 mm/);
  // E-Z Lok inserts: knife thread in hardwood, hex drive in softwood.
  assert.equal(pick({ type: 'insert', size: '1/4-20', material: 'hardwood' }, frac, 'insert').c.bit.id, 'f:25/64');
  assert.equal(pick({ type: 'insert', size: '1/4-20', material: 'softwood' }, frac, 'insert').c.bit.id, 'f:23/64');
  assert.equal(pick({ type: 'insert', size: 'M6', material: 'plywood' }, frac, 'insert').c.bit.id, 'f:23/64');
  assert.match(holesFor({ type: 'insert', size: 'M10', material: 'hardwood' }).holes[0].note, /doesn’t make a knife-thread/);
  // Dowels and shelf pins want the exact size; a bit a hair off is a near miss, with what to watch.
  const dw = pick({ type: 'dowel', size: '8' }, frac, 'dowel').c;
  assert.equal(dw.bit.id, 'f:5/16');
  assert.equal(dw.near, 'tight', 'a 5/16″ bit is a hair small for an 8 mm dowel, which should push in by hand');
  assert.match(dw.words, /try a dowel in a scrap first/);
  assert.equal(pick({ type: 'dowel', size: '8' }, owning('met25'), 'dowel').c.near, undefined, 'an 8 mm bit is just right');
  assert.equal(pick({ type: 'dowel', size: '10' }, frac, 'dowel').c.bit.id, 'f:25/64');
  assert.match(holesFor({ type: 'dowel', size: '8' }).holes[0].depth, /^21 mm deep in each piece for an 8 mm × 40 mm dowel/);
  assert.equal(normalizePick({ type: 'dowel' }).size, '3/8', 'an inch dowel to start with');
  const pin = pick({ type: 'shelfpin', size: '5' }, frac, 'pin').c;
  assert.equal(pin.bit.id, 'f:13/64');
  assert.equal(pin.near, 'loose');
  assert.equal(pick({ type: 'shelfpin', size: '5' }, owning('met25'), 'pin').c.bit.id, 'm:5');
  // Hinge cups need a Forstner: twist bits don't count.
  const cup = pick({ type: 'hinge', size: '35', material: 'plywood' }, frac, 'cup').c;
  assert.equal(cup.ok, false);
  assert.equal(cup.below, undefined);
  assert.equal(pick({ type: 'hinge', size: '35' }, owning('forin'), 'cup').c.bit.id, 'fo:1-3/8');
  assert.equal(pick({ type: 'hinge', size: '35' }, owning('forin', 'hinge'), 'cup').c.bit.id, 'fm:35');
  // No Forstner bits in metal.
  const cbore = holesFor({ type: 'machine', size: '1/2-13', material: 'steel', head: 'socket' }).holes.find(h => h.key === 'cbore');
  assert.equal(chooseBit(cbore, owning('forin'), 'steel').ok, false);
  const cboreWood = holesFor({ type: 'machine', size: '1/2-13', material: 'hardwood', head: 'socket' }).holes.find(h => h.key === 'cbore');
  assert.equal(chooseBit(cboreWood, owning('forin'), 'hardwood').bit.id, 'fo:7/8', 'in wood a Forstner will do');
});

// ---------- The other way round ----------

const usesText = id => usesFor(id).flatMap(g => g.uses.map(u => `${u.hole.name} · ${u.who}${u.matsMatter ? ' · ' + u.mats.join(', ') : ''}`));

test('tap 7/64″ and it lists pilot for #8, clearance for #4 and tap drill for #6-32', () => {
  const t = usesText('f:7/64');
  assert.ok(t.includes('Pilot hole · #8 wood screw, old-style · hardwood, plywood, mdf'), t.join('\n'));
  assert.ok(t.includes('Pilot hole · #8 wood screw · softwood'));
  assert.ok(t.includes('Pilot hole · #6 wood screw · hardwood, plywood, mdf'));
  assert.ok(t.includes('Shank hole · #4 wood screw'));
  assert.ok(t.includes('Tap drill · #6-32'));
  const tap = usesFor('f:7/64').find(g => g.name === 'Tap drills').uses.find(u => u.who === '#6-32');
  close(tap.pct, 70.7, 0.2);
  // Groups come in a fixed order, closest first inside each.
  assert.deepEqual(usesFor('f:7/64').map(g => g.name), ['Pilot holes', 'Tap drills', 'Clearance and shank holes', 'Counterbores']);
});

test('a bit’s sheet leads with what it’s spot on for, the chart’s own bit first', () => {
  const spot = id => spotOn(id).map(u => `${u.hole.name} · ${u.who}`);
  assert.equal(spot('n:29')[0], 'Tap drill · #8-32', '#29 is the #8-32 tap drill before anything else');
  assert.equal(spot('n:36')[0], 'Tap drill · #6-32');
  assert.equal(spot('n:7')[0], 'Tap drill · 1/4-20');
  assert.equal(spot('m:2.5')[0], 'Tap drill · M3');
  assert.ok(spot('f:7/64').includes('Pilot hole · #8 wood screw, old-style'));
  assert.ok(spot('f:7/64').includes('Shank hole · #4 wood screw'));
  assert.ok(spot('f:7/64').includes('Tap drill · #6-32'), 'a 71% thread is spot on, though not the chart’s bit');
  assert.ok(!spot('n:29').includes('Pilot hole · #10 wood screw'), 'a pilot 0.0046″ small is a near miss');
  // Spot on is the chart's bit, an exact size, or a 70–80% thread; everything else waits below.
  for (const id of ['n:29', 'f:7/64', 'm:3.3', 'l:F']) {
    for (const u of usesFor(id).flatMap(g => g.uses)) {
      assert.equal(u.spot, u.usual || Math.abs(u.diff) < 0.006 || (u.hole.key === 'tap' && u.pct >= 70 && u.pct <= 80), `${id}: ${u.who}`);
    }
  }
  const s = spotOn('f:1/8');
  assert.ok(s.findIndex(u => !u.usual) > s.findLastIndex(u => u.usual), 'the chart’s own uses come first');
});

test('other bits know what they’re for', () => {
  assert.ok(usesText('n:7').includes('Tap drill · 1/4-20'));
  assert.ok(usesFor('n:7').flatMap(g => g.uses).find(u => u.who === '1/4-20').usual);
  assert.ok(usesText('n:7').includes('Free clearance · #10'));
  assert.ok(usesText('n:29').includes('Tap drill · #8-32'));
  assert.ok(usesText('n:36').includes('Tap drill · #6-32'));
  assert.ok(usesText('m:2.5').includes('Tap drill · M3'));
  assert.ok(usesText('m:4').includes('Insert hole · M3 heat-set insert'));
  assert.ok(usesText('m:5').includes('Shelf-pin hole · 5 mm shelf pin'));
  assert.ok(usesText('fm:35').includes('Cup hole · 35 mm hinge cup'));
  assert.ok(usesText('f:25/64').includes('Insert hole · 1/4-20 knife-thread insert · hardwood'));
  assert.ok(usesText('f:7/16').includes('Counterbore · 1/4″ socket head'));
  assert.ok(usesText('l:F').includes('Tap drill · 5/16-18'));
  assert.ok(usesText('l:F').includes('Close clearance · 1/4″'));
  // A Forstner bit isn't offered for metal.
  for (const g of usesFor('fo:7/8')) for (const u of g.uses) assert.ok(!u.mats.includes('steel'));
  // Every indexed hole can be found by its own usual bit.
  for (const u of allHoles()) {
    if (!u.hole.usual) continue;
    const b = bitById(u.hole.usual);
    if (b.mm < u.lo - 1e-6 || b.mm > u.hi + 1e-6) continue;
    assert.ok(usesFor(b.id).some(g => g.uses.some(x => x.who === u.who && x.hole.name === u.hole.name)), `${b.name} should list ${u.hole.name} · ${u.who}`);
  }
});

// ---------- The screen gauge ----------

test('calibrating against a bank card', () => {
  assert.equal(G.CARD.long, 85.6);
  close(G.pxPerMmFrom(517.38), 6.044, 1e-3);
  assert.ok(G.plausible(6));
  assert.ok(!G.plausible(0.5));
  assert.ok(!G.plausible(NaN));
  close(G.guessPxPerMm({ coarse: false }), 96 / 25.4);
  assert.equal(G.guessPxPerMm({ coarse: true, shortSide: 390 }), 6.1);
});

test('a measured diameter narrows the threads, and the combs tell close pitches apart', () => {
  const names = d => G.threadCandidates(d).map(c => c.thread.id);
  // A quarter-inch bolt measures about 6.2 mm across the crests.
  assert.deepEqual(names(6.2).slice(0, 3).sort(), ['1/4-20', '1/4-28', 'M6'].sort());
  assert.equal(names(5.9)[0], 'M6');
  assert.equal(names(2.88)[0], 'M3');
  assert.ok(names(2.75).includes('4-40'));
  assert.ok(names(4.85).includes('M5') && names(4.85).includes('10-32'), 'M5 and #10 are close');
  const combs = G.combsFor(6.2);
  const labels = combs.map(c => c.label);
  assert.ok(labels.includes('20 per inch') && labels.includes('28 per inch') && labels.includes('1 mm'), labels.join(', '));
  close(G.tenThreads(threadById('1/4-20').p), 12.7);
  close(G.tenThreads(threadById('M6').p), 10);
  close(G.tenThreads(threadById('1/4-28').p), 9.0714, 1e-3);
  // Ten threads apart, the three differ by more than a millimetre.
  assert.ok(G.tenThreads(threadById('1/4-20').p) - G.tenThreads(threadById('M6').p) > 2);
  assert.ok(G.tenThreads(threadById('M6').p) - G.tenThreads(threadById('1/4-28').p) > 0.9);
  // A comb with several threads on it picks the one nearest the measurement.
  const c20 = combs.find(c => c.label === '20 per inch');
  assert.equal(G.threadOnComb(c20, 6.2).id, '1/4-20');
  assert.ok(G.combsFor(40).length >= 1, 'something to compare, even off the end of the table');
  // M5 × 0.8 and #10-32 differ by 0.006 mm a thread: no comb can part them, so the gauge says to go by size.
  const c48 = G.combsFor(4.8);
  const m5 = c48.find(c => c.label === '0.8 mm'), ten32 = c48.find(c => c.label === '32 per inch');
  assert.ok(m5 && ten32, c48.map(c => c.label).join(', '));
  assert.equal(G.nearTwin(c48, m5), ten32);
  assert.equal(G.nearTwin(combs, c20), null, '1/4-20 has no twin');
  assert.ok(G.expectedMajor(threadById('M5')) - G.expectedMajor(threadById('10-32')) > 0.15, 'but their sizes differ');
  // So the size gives the answer: 4.88 mm is clearly the M5, 4.70 the #10-32, and 4.80 only leans to the M5.
  const M5 = threadById('M5'), T32 = threadById('10-32');
  assert.deepEqual(G.twinCall(T32, M5, 4.88), { thread: M5, sure: true });
  assert.deepEqual(G.twinCall(M5, T32, 4.70), { thread: T32, sure: true });
  assert.deepEqual(G.twinCall(T32, M5, 4.80), { thread: M5, sure: false });
});

test('a measured drill bit: everything within a pixel is in the running, and yours come first', () => {
  const px = 1 / 6; // a millimetre is 6 pixels on a phone
  const names = (d, o) => G.bitCandidates(d, px, o).map(x => x.bit.name);
  // 2.78 mm: 7/64″ by a whisker, with the number and metric bits the screen can't tell from it named too.
  const c = names(2.78);
  assert.equal(c[0], '7/64″');
  assert.ok(c.includes('#35') && c.includes('2.8 mm'), c.join(', '));
  assert.ok(G.bitCandidates(2.78, px).every(x => Math.abs(x.diff) <= px + 1e-9), 'nothing further than a pixel');
  // Exactly a #29, and no sets: the #29.
  assert.equal(names(3.454)[0], '#29');
  // But with a metric set, the 3.5 mm a pixel away is likelier than a #29 you don't own...
  assert.equal(names(3.454, { owned: ownedBits({ sets: ['met25'] }) })[0], '3.5 mm');
  // ...and a bit gone missing from your case is likelier still.
  assert.equal(names(2.8, { owned: ownedBits({ sets: ['met25'] }), missing: new Set(['f:7/64']) })[0], '7/64″');
  // A bit owned but most of a pixel away doesn't beat an exact match.
  assert.equal(names(3.454, { owned: new Set(['f:9/64']) })[0], '#29');
  // Off the end of every series, the nearest bit there is.
  assert.equal(G.bitCandidates(30, px).length, 1);
});

test('the named screw drawn at true size: head, shank, threads and point in millimetres', () => {
  const bolt = G.screwShape({ kind: 'machine', thread: threadById('1/4-20'), len: { in: 1.5 }, head: 'hex' });
  close(bolt.d, 6.35);
  close(bolt.p, 1.27);
  close(bolt.length, 38.1);
  close(bolt.threaded, 2 * 6.35 + 6.35, 1e-9, 'a bolt is threaded 2d + 1/4″');
  close(bolt.head.af, 7 / 16 * 25.4);
  close(bolt.head.height, 5 / 32 * 25.4);
  assert.equal(bolt.finish, 'bright');
  // A socket head cap screw is threaded right up, black, with a head as tall as the screw is thick.
  const cap = G.screwShape({ kind: 'machine', thread: threadById('1/4-20'), len: { in: 1.5 }, head: 'socket' });
  close(cap.threaded, 38.1);
  assert.equal(cap.finish, 'black');
  close(cap.head.height, 6.35);
  // A short bolt is threaded all the way.
  close(G.screwShape({ kind: 'machine', thread: threadById('M6'), len: { mm: 16 }, head: 'hex' }).threaded, 16);
  // A countersunk M4 has the ISO 10642 head; no head picked yet draws none.
  assert.equal(G.screwShape({ kind: 'machine', thread: threadById('M4'), len: { mm: 12 }, head: 'flat' }).head.angle, 90);
  assert.equal(G.screwShape({ kind: 'machine', thread: threadById('M4'), len: { mm: 12 } }).head, null);
  // Wood screws: a gold flat head and a gimlet point; lags and sheet-metal screws their own heads.
  const wood = G.screwShape({ kind: 'wood', gauge: G.gaugeFor(4.05, 'wood'), len: { in: 1.25 } });
  close(wood.d, 0.164 * 25.4);
  assert.equal(wood.point, 'gimlet');
  assert.equal(wood.head.angle, 82);
  close(wood.head.dia, 0.332 * 25.4);
  assert.ok(wood.threaded < wood.length, 'a long wood screw has a plain shank');
  assert.equal(G.screwShape({ kind: 'lag', gauge: G.gaugeFor(7.8, 'lag'), len: { in: 3 } }).head.kind, 'hex');
  // Even a lag shorter than it is thick has some thread to draw.
  assert.ok(G.screwShape({ kind: 'lag', gauge: G.gaugeFor(12, 'lag'), len: { mm: 8 } }).threaded > 0);
  assert.equal(G.screwShape({ kind: 'sheet', gauge: G.gaugeFor(4.1, 'sheet'), len: { in: 0.75 } }).head.kind, 'pan');
  // Every head every thread comes with has a shape to draw.
  for (const t of THREADS) for (const h of FS.headsFor(t)) {
    const s = FS.headShape(t, h);
    assert.ok(s && (s.dia > t.d || s.af > t.d), `${t.label} ${h}`);
    if (h !== 'flat') assert.ok(s.height > 0, `${t.label} ${h} height`);
  }
});

test('past the ends of the tables it says so, and a pointed screw too fat for a wood screw is a lag', () => {
  // A 5/16″ lag measures about 7.8 mm: fatter than any wood or sheet-metal screw, so it's a lag.
  assert.equal(G.likelyKind(7.8), 'lag');
  assert.equal(G.likelyKind(4.1), 'wood');
  assert.ok(!G.kindFits('wood', 7.8) && !G.kindFits('sheet', 7.8) && G.kindFits('lag', 7.8));
  assert.ok(!G.kindFits('lag', 4.1), 'nothing as thin as 4.1 mm is a lag');
  assert.ok(G.kindFits('wood', 6.2) && G.kindFits('lag', 6.2), 'a #14 wood screw and a 1/4″ lag measure the same');
  assert.equal(G.kindReach('wood').last.label, '#14');
  // A 15 mm bolt is bigger than anything in the thread tables, and 1 mm smaller; every thread in them is inside.
  assert.equal(G.pastTables(15), 'big');
  assert.equal(G.pastTables(1), 'small');
  assert.equal(G.pastTables(12.6), null);
  for (const t of THREADS) assert.equal(G.pastTables(G.expectedMajor(t)), null, t.label);
  assert.equal(G.pastTables(15, 'pointed'), 'big');
  assert.equal(G.pastTables(1.5, 'pointed'), 'small');
  assert.equal(G.pastTables(30, 'bit'), 'big');
  assert.equal(G.pastTables(25.4, 'bit'), null);
  // Two pitches of one size: the coarse one first, though the fine one measures a hair nearer.
  assert.deepEqual(G.threadCandidates(12.6).map(c => c.thread.id), ['1/2-13', '1/2-20']);
  assert.equal(G.threadCandidates(6.25)[0].thread.id, '1/4-20');
  // Between sizes (a 7 mm thread, between 1/4″ and 5/16″), the combs are the nearest, coarse before fine,
  // and the nearest thread is known not to fit.
  assert.deepEqual(G.combsFor(7).map(c => c.threads[0].id), ['5/16-18', '5/16-24', '1/4-20']);
  assert.ok(!G.fitsThread(threadById('1/4-20'), 7) && G.fitsThread(threadById('1/4-20'), 6.2));
});

test('pointed screws by gauge, and drill bits by size', () => {
  assert.equal(G.gaugeFor(4.05, 'wood').label, '#8');
  assert.equal(G.gaugeFor(4.7, 'wood').label, '#10');
  assert.equal(G.gaugeFor(4.1, 'sheet').label, '#8');
  assert.equal(G.gaugeFor(4.1, 'sheet').st, 'ST4.2');
  assert.equal(G.gaugeFor(7.8, 'lag').label, '5/16″');
  assert.equal(G.bitsNear(3.45)[0].bit.id, 'n:29');
  assert.equal(G.bitsNear(2.78)[0].bit.id, 'f:7/64');
});

test('lengths snap to what screws are sold in, and names read like a hardware store', () => {
  assert.deepEqual(G.snapLength(25.2, false), { in: 1, standard: true });
  assert.deepEqual(G.snapLength(38.4, false), { in: 1.5, standard: true });
  assert.deepEqual(G.snapLength(10.3, true), { mm: 10, standard: true });
  assert.deepEqual(G.snapLength(23.4, true), { mm: 23.5, standard: false });
  assert.equal(G.lengthText({ in: 1.5 }), '1-1/2');
  assert.equal(G.screwName({ kind: 'machine', thread: threadById('1/4-20'), len: { in: 1.5 }, head: 'hex' }), '1/4-20 × 1-1/2 hex bolt');
  assert.equal(G.screwName({ kind: 'machine', thread: threadById('M3'), len: { mm: 10 }, head: 'socket' }), 'M3 × 0.5 × 10 socket head');
  assert.equal(G.screwName({ kind: 'machine', thread: threadById('M4'), len: { mm: 12 }, head: 'flat' }), 'M4 × 0.7 × 12 countersunk');
  assert.equal(G.screwName({ kind: 'machine', thread: threadById('8-32'), len: { in: 0.5 }, head: 'hex' }), '#8-32 × 1/2 hex head screw');
  assert.equal(G.screwName({ kind: 'machine', thread: threadById('10-24'), len: { in: 0.75 } }), '#10-24 × 3/4');
  assert.equal(G.screwName({ kind: 'wood', gauge: G.gaugeFor(4.05, 'wood'), len: { in: 1.25 } }), '#8 × 1-1/4 wood screw');
  assert.equal(G.screwName({ kind: 'sheet', gauge: G.gaugeFor(4.1, 'sheet'), len: { in: 0.75 } }), '#8 × 3/4 sheet-metal screw');
  assert.equal(G.metricKind({ kind: 'machine', thread: threadById('M3') }), true);
  assert.equal(G.metricKind({ kind: 'wood' }), false);
});

// ---------- What's kept in the browser ----------

test('the store keeps sets, missing and loose bits, and loads only its own files', async () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  mem.set('pilot-hole.v1', '{not json');
  const { store } = await import('../js/store.js?fresh');
  assert.deepEqual(store.sets, ['frac29'], 'bad data starts fresh with a fractional set');
  store.setSet('met25', true);
  store.setMissing('frac29', 'f:7/64', true);
  store.addLoose('n:29');
  store.addLoose('nonsense');
  assert.ok(store.has('m:2.5') && store.has('n:29') && !store.has('f:7/64'));
  // A bit missing from a set you've taken out isn't counted, but it's still marked when the set comes back.
  assert.equal(store.missingInOwned().length, 1);
  store.setSet('frac29', false);
  assert.equal(store.missingInOwned().length, 0);
  store.setSet('frac29', true);
  assert.deepEqual(store.missingInOwned(), ['frac29:f:7/64']);
  store.setSet('met25', false);
  store.setSet('met25', true); // so the sets are back in the order the rest of this test expects
  const saved = JSON.parse(mem.get('pilot-hole.v1'));
  assert.deepEqual(saved.sets, ['frac29', 'met25']);
  assert.deepEqual(saved.missing, ['frac29:f:7/64']);
  assert.deepEqual(saved.loose, ['n:29']);
  // A saved copy round-trips; anything else is refused and changes nothing.
  const copy = store.exportData();
  assert.equal(copy.app, 'pilot-hole');
  store.setMissing('frac29', 'f:7/64', false);
  store.importData(copy);
  assert.ok(!store.has('f:7/64'));
  assert.throws(() => store.importData({ hello: 1 }), /isn’t a Pilot Hole file/);
  assert.deepEqual(store.sets, ['frac29', 'met25']);
  store.importData({ app: 'pilot-hole', sets: ['frac29', 'made-up'], missing: ['made-up:x'], loose: ['f:1/8', 'f:1/8', 'zz'] });
  assert.deepEqual(store.sets, ['frac29'], 'unknown sets are dropped');
  assert.deepEqual(store.missing, []);
  assert.deepEqual(store.loose, ['f:1/8']);
  // Clear everything means everything: no sets ticked, not the fractional set a first visit starts with.
  store.clearAll();
  assert.deepEqual(store.sets, []);
  assert.equal(store.owned().size, 0);
  assert.deepEqual(JSON.parse(mem.get('pilot-hole.v1')).sets, [], 'and it stays cleared after a reload');
  delete globalThis.localStorage;
});

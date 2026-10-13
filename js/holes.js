// The holes a fastener needs in a material, the bit you own that suits each, and the other way round:
// everything one bit is right for. Every size is in millimetres. No page code, so the tests run it in Node.
import { MM, inToMm, fracText, mmText, offWords, offText, SAME_MM } from './units.js';
import { BITS, bitById, bySize } from './drills.js';
import { threadById, tapDrillMm, threadPct, TAP_RANGE, goodTap, fullName } from './threads.js';
import * as FS from './fasteners.js';

const f = s => inToMm(eval64(s)); // '7/64' → 2.778 mm
function eval64(s) {
  const m = String(s).match(/^(?:(\d+)-)?(\d+)\/(\d+)$/);
  if (m) return (m[1] ? +m[1] : 0) + m[2] / m[3];
  return +s;
}
const HALF64 = MM / 128; // half a 64th of an inch, 0.198 mm: the gap to the next fractional bit
const thou = x => x * MM / 1000;
const ceil64 = mm => Math.ceil(mm / MM * 64 - 1e-6) / 64 * MM;

const TAP_NOTES = {
  aluminium: 'Use cutting fluid (WD-40 will do) so the tap doesn’t clog.',
  steel: 'Use tapping oil, and back the tap off every half turn to break the chip. In steel a 65–70% thread is plenty: go a size up if the tap binds.',
  printed: 'Turn the tap in slowly by hand. Printed threads wear: for parts you’ll take apart often, use an insert.',
};

const MAT_NOTES = {
  hardwood: 'Hardwood splits and snaps screws without a pilot. Wax on the threads helps long ones.',
  softwood: 'Near an end or an edge, pilot anyway: that’s where softwood splits.',
  plywood: 'Into the face, ply takes the hardwood size. Into an edge, keep to the middle and pilot every time.',
  mdf: 'Always pilot MDF, and keep 1″ (25 mm) from corners. It won’t let a head pull itself in, so countersink, and don’t overtighten: it strips.',
  printed: 'Printed holes come out a little small: drill them to size, or model them 0.1–0.2 mm big.',
};

// ---------- One pick: a fastener, its size, what it goes into ----------
export function normalizePick(p = {}) {
  const type = FS.typeById(p.type) || FS.TYPES[0];
  const size = type.sizes.includes(p.size) ? p.size : type.def;
  const material = FS.materialById(p.material) && FS.fitsMaterial(type, p.material) ? p.material : type.mat;
  let head = p.head;
  if (type.id === 'machine') {
    const heads = FS.headsFor(threadById(size));
    if (!heads.includes(head)) head = heads.includes('socket') ? 'socket' : heads[0];
  } else head = undefined;
  return { type: type.id, size, material, ...(head ? { head } : {}) };
}

export function holesFor(pick) {
  const p = normalizePick(pick);
  const out = BUILD[p.type](p);
  out.pick = p;
  out.material = FS.materialById(p.material);
  out.holes.forEach((h, i) => { h.n = i; });
  return out;
}

// A hole: what it's called, where it goes, the size to aim for and how far either side still works.
function hole(o) {
  return { role: 'main', twist: true, forstner: false, alt: [], ...o };
}

const BUILD = {
  wood(p) {
    const w = FS.WOOD_SCREWS.find(x => String(x.g) === p.size);
    const name = `#${w.g} wood screw`;
    const mat = p.material, group = FS.materialById(mat).group;
    const drivers = FS.woodDrivers(w.g);
    const tools = [{ what: 'Phillips', text: `#${drivers.phillips}` }, { what: 'Square', text: `#${drivers.square} (${drivers.squareColour})` }];
    if (drivers.torx) tools.push({ what: 'Torx', text: `T${drivers.torx}, on many modern screws` });
    const holes = [];
    const major = w.d * MM;
    const clearAll = ceil64(major + 0.01);
    if (group === 'metal') {
      holes.push(hole({ key: 'clear', role: 'clear', name: 'Clearance through the metal', where: 'for a bracket going onto wood', noIndex: true,
        ideal: clearAll, min: major + 0.05, max: clearAll + MM / 32, usual: `f:${fracText(clearAll / MM)}`,
        note: 'Then pick the wood it’s going into for the pilot hole.' }));
      holes.push(countersink(w.head * MM, 82, 'Only if the screw has a flat head and the metal is thick enough to take one.'));
      return { name, title: name, diagram: 'wood', holes, tools,
        warn: 'Wood screws don’t hold in metal. Into sheet metal use a sheet-metal screw; into thicker metal, a machine screw in a tapped hole.',
        switchTo: [{ type: 'sheet', size: nearestSheet(w.g) }, { type: 'machine' }] };
    }
    if (group === 'printed') {
      holes.push(hole({ key: 'pilot', name: 'Pilot hole', where: 'in the printed part', noIndex: true,
        ideal: 0.82 * major, min: 0.76 * major, max: 0.88 * major,
        depth: 'As deep as the screw goes, plus a little.',
        note: 'About 0.8 of the screw’s size, so the threads form in the plastic without splitting the walls. ' + MAT_NOTES.printed }));
      holes.push(hole({ key: 'shank', role: 'clear', name: 'Shank hole', where: 'in the top piece',
        ideal: f(w.shank), min: f(w.shank) - 0.1, max: major + MM / 64, usual: `f:${w.shank}`, depth: 'Right through the top piece.' }));
      holes.push(countersink(w.head * MM, 82));
      return { name, title: name, diagram: 'wood', holes, tools };
    }
    const col = mat === 'softwood' ? 'soft' : 'hard';
    const prod = w.prod?.[col];
    const trad = w[col];
    const main = prod || trad;
    const pilot = hole({ key: 'pilot', name: 'Pilot hole', where: 'in the bottom piece', matsMatter: true,
      ideal: f(main), min: f(main) - HALF64, max: f(main) + HALF64, usual: `f:${main}`, near: woodNear(mat, f(main)),
      depth: 'As deep as the screw goes into this piece.',
      note: prod ? '' : 'From the chart for traditional tapered screws: no figures for modern ones this size.' });
    if (prod && prod !== trad) pilot.alt.push({ label: 'Old-style tapered screws', bit: `f:${trad}`, index: `${name}, old-style` });
    holes.push(pilot);
    const shank = hole({ key: 'shank', role: 'clear', name: 'Shank hole', where: 'in the top piece',
      ideal: f(w.shank), min: f(w.shank) - 0.1, max: major + MM / 64, usual: `f:${w.shank}`,
      depth: 'Right through the top piece, so the screw pulls it tight.' });
    if (clearAll > f(w.shank) + 0.01) shank.note = `Threaded right up to the head? Use ${fracText(clearAll / MM)}″ so the threads don’t grip the top piece.`;
    holes.push(shank);
    holes.push(countersink(w.head * MM, 82, mat === 'softwood' ? 'A flat head will pull itself into softwood, but a countersink stops the surface splintering.' : ''));
    const plug = (w.prod?.bore || w.bore);
    const plugSize = f(plug) <= f('3/8') + 0.01 ? '3/8' : '1/2';
    holes.push(hole({ key: 'plug', role: 'head', name: 'Counterbore for a plug', where: 'optional',
      ideal: f(plugSize), min: f(plugSize) - 0.1, max: f(plugSize) + 0.1, usual: `f:${plugSize}`, forstner: true,
      depth: 'About 1/4″ (6 mm) deep, then glue in a plug cut to match.',
      note: `${plugSize}″ plugs fit it. To just sink the head, ${plug}″ is enough. A Forstner or brad-point bit leaves a flat bottom.` }));
    return { name, title: name, diagram: 'wood', holes, tools, note: MAT_NOTES[mat] };
  },

  machine(p) {
    const t = threadById(p.size);
    const hf = FS.headFacts(t, p.head);
    const headName = FS.headWords(t, p.head);
    const name = `${t.label} ${headName}`;
    const mat = p.material, group = FS.materialById(mat).group;
    const holes = [];
    const tools = machineTools(t, hf, { tap: group !== 'wood' }); // through wood it's a nut, not a tapped hole
    const out = { name, title: t.label, sub: headName, diagram: group === 'wood' ? 'bolt' : 'tapped', holes, tools, thread: t };

    if (group === 'wood') {
      holes.push(clearance(t, 'free', { name: 'Through hole', where: 'through both pieces, for a nut on the back', key: 'through', noIndex: true }));
      addHeadRecess(holes, t, hf, true);
      const nut = FS.nutFor(t);
      if (nut) holes.push(nutHole(t, nut));
      const ins = FS.WOOD_INSERTS.find(i => i.thread === t.id || i.thread === t.id.replace(/^#/, ''));
      if (ins) out.related = [{ text: `Or thread it into wood with a threaded insert`, pick: { type: 'insert', size: ins.id, material: mat } }];
      out.note = 'A machine screw doesn’t grip wood on its own: put a nut and washer on the back, or use a threaded insert.';
      return out;
    }

    holes.push(hole({ key: 'tap', name: 'Tap drill', where: 'for a 75% thread',
      ideal: tapDrillMm(t, 75), min: tapDrillMm(t, TAP_RANGE[1]), max: tapDrillMm(t, TAP_RANGE[0]),
      usual: t.tap, thread: t,
      depth: `Drill deeper than the screw reaches: 3 threads more (${mmShort(3 * t.p)}) lets the tap finish the thread.`,
      note: TAP_NOTES[mat] }));
    if (group === 'printed') {
      holes.push(hole({ key: 'straight', name: 'To screw straight in', where: 'no tap, in a printed part',
        ideal: tapDrillMm(t, 55), min: tapDrillMm(t, 75), max: tapDrillMm(t, 33), thread: t,
        depth: 'As deep as the screw goes.',
        note: 'A little bigger than the tap drill, so the screw forms its own thread without cracking the layers. Fine for a few fittings, not for taking apart often.' }));
      const hs = FS.HEATSET.find(h => h.thread === t.id);
      if (hs) out.related = [{ text: `For a thread that lasts, use a heat-set insert`, pick: { type: 'heatset', size: hs.id, material: 'printed' } }];
    }
    holes.push(clearance(t, 'close'));
    holes.push(clearance(t, 'free'));
    addHeadRecess(holes, t, hf, false);
    return out;
  },

  lag(p) {
    const l = FS.LAGS.find(x => x.id === p.size);
    const mat = p.material;
    const name = `${l.label} lag screw`;
    const r = FS.LAG_LEAD[mat === 'softwood' || mat === 'plywood' ? 'softwood' : 'hardwood'];
    const holes = [
      hole({ key: 'lead', name: 'Lead hole', where: 'for the threads', matsMatter: true,
        ideal: r[1] * l.d, min: r[0] * l.d, max: r[2] * l.d, index: [r[1] * l.d - MM / 64, r[1] * l.d + MM / 64],
        depth: 'As deep as the lag goes, less its point.',
        note: `${Math.round(r[1] * 100)}% of the shank, the middle of the NDS range for ${mat === 'softwood' || mat === 'plywood' ? 'softwood' : 'dense hardwood'}.` }),
      hole({ key: 'shank', role: 'clear', name: 'Shank hole', where: 'for the plain shank',
        ideal: l.d, min: l.d - 0.1, max: l.d + MM / 32,
        depth: 'As deep as the plain part of the shank is long. Right through the piece being fastened, and through a steel bracket.' }),
    ];
    return { name, title: name, diagram: 'lag', holes,
      tools: [{ what: 'Wrench or socket', text: l.wrench }, { what: 'Washer', text: 'Under the head, so it doesn’t sink into the wood' }],
      note: MAT_NOTES[mat] };
  },

  sheet(p) {
    const s = FS.SHEET_SCREWS.find(x => String(x.g) === p.size);
    const name = `#${s.g} sheet-metal screw`;
    const mat = p.material, group = FS.materialById(mat).group;
    const major = s.d * MM;
    const holes = [];
    if (group === 'metal') {
      holes.push(hole({ key: 'pilot', name: 'Pilot hole', where: 'in the sheet', matsMatter: true,
        ideal: s.sheet[1] * MM, min: s.sheet[0] * MM - 0.15, max: s.sheet[2] * MM + 0.1,
        depth: 'Through the sheet the screw grips.',
        note: 'For sheet up to about 1 mm (20 gauge), from ASME B18.6.4. In thicker sheet, go up a size.' }));
    } else if (group === 'printed') {
      holes.push(hole({ key: 'pilot', name: 'Pilot hole', where: 'in the printed part', noIndex: true,
        ideal: 0.82 * major, min: 0.76 * major, max: 0.88 * major, depth: 'As deep as the screw goes.',
        note: 'About 0.8 of the screw’s size. ' + MAT_NOTES.printed }));
    } else {
      const w = FS.WOOD_SCREWS.find(x => x.g === s.g);
      const col = mat === 'softwood' ? 'soft' : 'hard';
      const v = w.prod?.[col] || w[col];
      holes.push(hole({ key: 'pilot', name: 'Pilot hole', where: 'in the wood', matsMatter: true,
        ideal: f(v), min: f(v) - HALF64, max: f(v) + HALF64, usual: `f:${v}`, near: woodNear(mat, f(v)),
        depth: 'As deep as the screw goes.', note: 'The same as a wood screw this size. ' + MAT_NOTES[mat] }));
    }
    const like = threadById({ 4: '4-40', 6: '6-32', 8: '8-32', 10: '10-24', 12: '12-24', 14: '1/4-20' }[s.g]);
    const freeBit = bitById(like.free);
    holes.push(hole({ key: 'clear', role: 'clear', name: 'Clearance', where: 'in the top piece, optional', noIndex: true,
      ideal: freeBit.mm, min: major + 0.05, max: freeBit.mm + thou(20), usual: freeBit.id,
      depth: 'Through the top piece.',
      note: 'Threaded all the way up, the screw can’t pull two pieces together unless the top one clears it.' }));
    return { name, title: name, sub: s.st, diagram: 'sheet', holes,
      tools: [{ what: 'Driver', text: `Phillips #${s.ph}${s.hexIn ? ` · hex washer head: ${fracText(s.hexIn)}″ nut driver` : ''}` }] };
  },

  heatset(p) {
    const h = FS.HEATSET.find(x => x.id === p.size);
    const t = threadById(h.thread);
    const name = `${h.name || h.id} heat-set insert`;
    const holes = [
      hole({ key: 'insert', name: 'Insert hole', where: 'in the printed part',
        ideal: h.hole, min: h.hole - 0.1, max: h.hole + 0.15,
        depth: `At least ${mmShort(h.len + 1)} deep: a millimetre more than the insert${h.alsoLen ? ` (Ruthex’s is ${mmShort(h.len)} long, CNC Kitchen’s ${mmShort(h.alsoLen)})` : ` is long (${mmShort(h.len)})`}, so melted plastic has somewhere to go.`,
        note: `Model it at ${mmShort(h.hole)}, or print it small and drill it to size. Leave at least ${mmShort(h.wall)} of plastic around it.` }),
      clearance(t, 'free', { name: `Clearance for the ${t.label} screw`, where: 'in the part that bolts on', key: 'clear', noIndex: true }),
    ];
    return { name, title: name, diagram: 'heatset', holes, thread: t,
      tools: [{ what: 'Soldering iron', text: 'With an insert tip, set 10–⁠20 °C above your print temperature. Press it in straight and stop flush.' },
        ...machineTools(t, FS.headFacts(t, 'socket'), { tap: false, nut: false }).map(x => (x.what === 'Hex key' ? { ...x, text: `${x.text}, for a socket head screw` } : x))] };
  },

  insert(p) {
    const ins = FS.WOOD_INSERTS.find(x => x.id === p.size);
    const t = threadById(ins.thread);
    const mat = p.material;
    const wantKnife = mat === 'hardwood';
    const style = wantKnife ? (ins.knife ? 'knife' : 'hex') : (ins.hex ? 'hex' : 'knife');
    const size = ins[style];
    const styleName = style === 'knife' ? 'knife-thread insert' : 'hex-drive insert';
    const label = t.label;
    const h = hole({ key: 'insert', name: 'Insert hole', where: `for a ${styleName}`, matsMatter: true, indexName: `${label} ${styleName}`,
      ideal: f(size), min: f(size) - HALF64, max: f(size) + HALF64, usual: `f:${size}`,
      depth: 'A little deeper than the insert is long.',
      note: style === 'knife'
        ? 'Knife-thread inserts are for hardwood. Drive one in on a bolt with a jam nut, square to the surface.'
        : 'Hex-drive inserts are for softwood, ply and MDF. Drive one in with a hex key, square to the surface; a drop of glue stops it backing out.' });
    const other = style === 'knife' ? 'hex' : 'knife';
    if (ins[other]) h.alt.push({ label: other === 'knife' ? 'Knife-thread insert, for hardwood' : 'Hex-drive insert, for softwood, ply and MDF', bit: `f:${ins[other]}` });
    if (wantKnife !== (style === 'knife')) h.note = `E-Z Lok doesn’t make a ${wantKnife ? 'knife-thread' : 'hex-drive'} insert in ${label}. ` + h.note;
    const holes = [h];
    holes.push(clearance(t, 'free', { name: `Clearance for the ${t.label} bolt`, where: 'in the part that bolts on', key: 'clear', noIndex: true }));
    return { name: `${label} threaded insert`, title: `${label} threaded insert`, sub: 'E-Z Lok sizes', diagram: 'insert', holes, thread: t,
      tools: [{ what: 'To drive it', text: style === 'knife' ? 'A bolt and a jam nut, or the insert maker’s tool' : 'A hex key, or the insert maker’s tool' }] };
  },

  dowel(p) {
    const d = FS.DOWELS.find(x => x.id === p.size);
    const depth = d.metric ? `${mmShort(d.len / 2 + 1)} deep in each piece for ${an(d.label)} ${d.label} × ${d.lenLabel} dowel: half its length and 1 mm for glue.`
      : `${fracText((d.len / 2) / MM + 1 / 16)}″ deep in each piece for ${an(d.label)} ${d.label} × ${d.lenLabel} dowel: half its length and 1/16″ for glue.`;
    // A dowel should push in by hand, so a bit any smaller than it is only a near miss, to try in scrap first.
    return { name: `${d.label} dowel`, title: `${d.label} dowel`, diagram: 'dowel',
      holes: [hole({ key: 'dowel', name: 'Dowel hole', where: 'in both pieces',
        ideal: d.d, min: d.d - 0.03, max: d.d + 0.1, depth,
        near: { tight: 0.1, loose: 0.2, prefer: 'loose', words: {
          tight: 'A hair tight: try a dowel in a scrap first, and sand it down if it won’t push in by hand.',
          loose: 'A hair loose: glue fills a gap this small.' } },
        note: 'Use a brad-point bit and a depth stop, and mark the second piece with dowel centres. A dowel should push in by hand: tight ones split the work.' })],
      tools: [{ what: 'Bit', text: 'Brad point, with a stop collar' }, { what: 'Marking', text: 'Dowel centres, or a doweling jig' }] };
  },

  shelfpin(p) {
    const s = FS.SHELF_PINS.find(x => x.id === p.size);
    return { name: `${s.label} shelf pin`, title: `${s.label} shelf pins`, diagram: 'shelfpin',
      holes: [hole({ key: 'pin', name: 'Shelf-pin hole', where: 'in the sides',
        ideal: s.d, min: s.d - 0.03, max: s.d + 0.12,
        near: { tight: 0.1, loose: 0.2, prefer: 'loose', words: {
          tight: 'A hair tight: the pins may need a tap to go in, and won’t move easily.',
          loose: 'A hair loose: the pins sit a little sloppy, but they hold a shelf.' } },
        depth: s.metric ? 'About 10 mm deep, or the length of the pin’s peg. Use a stop so the row matches.' : 'About 3/8″ deep. Use a stop so the row matches.',
        note: s.metric ? 'On the 32 mm system the rows sit 37 mm in from the front and back edges, holes 32 mm apart.' : 'Space them to suit; a drilling jig keeps the rows level.' })],
      tools: [{ what: 'Bit', text: 'Brad point with a stop collar, or a shelf-pin jig with its own bit' }] };
  },

  hinge(p) {
    const mat = p.material;
    const w6 = FS.WOOD_SCREWS.find(x => x.g === 6);
    const pilot6 = w6.prod[mat === 'softwood' ? 'soft' : 'hard'];
    return { name: '35 mm hinge cup', title: '35 mm hinge cup', sub: 'concealed (European) hinges', diagram: 'hinge',
      holes: [
        hole({ key: 'cup', name: 'Cup hole', where: 'in the back of the door',
          ideal: 35, min: 34.85, max: 35.15, twist: false, forstner: true,
          depth: '13 mm deep for most hinges; some want 11.5 mm. Check the hinge’s sheet, and use a stop.',
          note: 'The cup’s edge sits 3–6 mm in from the door’s edge, so its centre is 20.5–23.5 mm in (22.5 mm for a 5 mm gap). A 1-3/8″ Forstner is close enough.' }),
        hole({ key: 'screws', role: 'clear', name: 'Screw holes', where: 'either side of the cup', noIndex: true,
          ideal: f(pilot6), min: f(pilot6) - HALF64, max: f(pilot6) + HALF64, usual: `f:${pilot6}`, near: woodNear(mat, f(pilot6)),
          depth: 'Pilots for #6 screws, as deep as the screws.',
          note: 'Two holes 45 mm apart, 9.5 mm in from the cup’s centre towards the middle of the door. Press-in hinges want 8 mm holes there instead.' }),
      ],
      tools: [{ what: 'Bit', text: '35 mm Forstner in a drill press or a hinge jig, with a depth stop' }] };
  },
};

const an = label => (/^(8|11|18)\b/.test(label) ? 'an' : 'a'); // an 8 mm dowel, a 10 mm one

function nearestSheet(g) {
  return String(FS.SHEET_SCREWS.reduce((a, b) => (Math.abs(b.g - g) < Math.abs(a.g - g) ? b : a)).g);
}
const mmShort = x => `${mmText(x, 1)} mm`;

function countersink(diaMm, angle, extra = '') {
  return hole({ key: 'csink', role: 'head', name: 'Countersink', where: `${angle}°`,
    cone: { angle, dia: diaMm }, ideal: diaMm, min: diaMm, max: diaMm, twist: false,
    depth: 'Until the head sits flush, or a hair below.',
    note: `${angle === 82 ? 'An' : 'A'} ${angle}° countersink, opened up to the width of the head at the surface. ${extra}`.trim() });
}

// Close and free clearance holes for a thread.
function clearance(t, fit, o = {}) {
  let ideal, min, max, usual;
  if (t.system === 'inch') {
    const c = bitById(t.close).mm, fr = bitById(t.free).mm;
    const mid = (c + fr) / 2;
    if (fit === 'close') { ideal = c; min = t.d + thou(2); max = mid; usual = t.close; }
    else { ideal = fr; min = mid; max = fr + Math.max(thou(20), 0.07 * t.d); usual = t.free; }
  } else {
    const mid = (t.closeMm + t.freeMm) / 2;
    if (fit === 'close') { ideal = t.closeMm; min = t.d + 0.1; max = mid; }
    else { ideal = t.freeMm; min = mid; max = t.looseMm; }
    usual = `m:${ideal}`;
  }
  return hole({ key: fit, role: 'clear', name: fit === 'close' ? 'Close clearance' : 'Free clearance',
    where: fit === 'close' ? 'snug: for lining parts up' : 'easy: the usual through hole',
    ideal, min, max, usual, clearance: true, screwMm: t.d,
    depth: 'Right through the part being fastened.', ...o });
}

function addHeadRecess(holes, t, hf, wood) {
  if (!hf) return;
  if (hf.kind === 'socket') {
    const inch = t.system === 'inch';
    const ideal = inch ? bitById(hf.cb).mm : hf.cbMm;
    holes.push(hole({ key: 'cbore', role: 'head', name: 'Counterbore', where: 'to sink the head',
      ideal, min: hf.headMm + (inch ? thou(10) : 0.3), max: ideal + (inch ? MM / 16 : 1.5), usual: inch ? hf.cb : `m:${hf.cbMm}`,
      index: [Math.max(hf.headMm + (inch ? thou(10) : 0.3), ideal - MM / 64), ideal + MM / 64],
      forstner: wood,
      depth: inch ? `At least ${fracText(hf.heightMm / MM)}″ deep (the head’s height), a little more to sit below the surface.`
        : `At least ${mmShort(hf.heightMm)} deep (the head’s height), a little more to sit below the surface.`,
      note: wood ? 'Bore the counterbore first, then the through hole from its centre.' : 'A counterbore tool or an end mill leaves a flat bottom; a drill leaves a cone, which is fine if you go a little deeper.' }));
  } else if (hf.kind === 'flat') {
    holes.push(countersink(hf.headMm, hf.angle, t.system === 'inch' ? '' : 'Phillips countersunk heads (ISO 7046) are a little smaller.'));
  }
}

// A counterbore on the back for the nut and the flat washer under it: wider than the washer (which is wider
// than the nut's corners) with a little room to get them in, flat-bottomed, and as deep as the two together.
function nutHole(t, nut) {
  const inch = t.system === 'inch';
  const clear = Math.max(nut.washer.odMm, nut.acrossMm);
  const ideal = inch ? Math.ceil((clear / MM + 1 / 16) * 32 - 1e-6) / 32 * MM : Math.ceil(clear + 1 - 1e-6);
  const min = clear + (inch ? MM / 64 : 0.4), max = ideal + (inch ? MM * 3 / 16 : 4);
  const usual = FORSTNERS.find(b => b.metric === !inch && b.mm >= min - 1e-6 && b.mm <= max + 1e-6);
  const deep = nut.thickMm + nut.washer.thickMm;
  const deepText = inch ? `${fracText(Math.ceil(deep / MM * 32 - 1e-6) / 32)}″` : mmShort(Math.ceil(deep * 2 - 1e-6) / 2);
  const washer = inch ? `${fracText(nut.washer.odMm / MM)}″` : mmShort(nut.washer.odMm);
  // Any bit from a little over the washer up to a good deal bigger will do, so a bit is judged by the room it
  // leaves around the washer ("0.94 mm to spare"), not by how far it is from a size in the middle.
  return hole({ key: 'nut', role: 'head', name: 'Counterbore for the nut', where: 'optional, on the back', noIndex: true,
    ideal, min, max, usual: usual?.id, forstner: true, spare: clear,
    depth: `At least ${deepText}, for the nut and its washer; deeper if the end of the bolt has to hide too.`,
    note: `Wide enough for the ${washer} flat washer under the nut. A Forstner bit leaves the flat bottom it sits on. Only if the nut has to sit below the surface.` });
}
const FORSTNERS = BITS.filter(b => b.kind === 'forstner').sort((a, b) => a.mm - b.mm);

// The keys, drivers and wrenches a screw takes, the wrench for its nut, and the tap for its thread.
// A hex bolt whose nut takes the same wrench gets one line for both.
function machineTools(t, hf, { tap = true, nut = true } = {}) {
  const inch = t.system === 'inch';
  const len = x => (inch ? `${fracText(x, 64)}″` : `${String(x)} mm`);
  const tools = [];
  if (hf?.kind === 'socket' || hf?.kind === 'button' || (hf?.kind === 'flat' && hf.keyMm)) tools.push({ what: 'Hex key', text: inch ? (hf.keyIn === 0.05 ? '0.050″' : len(hf.keyIn)) : len(hf.keyMm) });
  if (hf?.kind === 'flat' && hf.phillips != null) tools.push({ what: 'Driver', text: `Phillips #${hf.phillips}` });
  if (hf?.kind === 'pan') tools.push({ what: 'Driver', text: `Phillips #${hf.phillips}` });
  const n = nut && FS.nutFor(t);
  const nutSize = n && (inch ? len(n.wrenchIn) : `${n.wrenchMm} mm`);
  const din = (mm, what) => (mm ? ` (${mm} mm on older DIN ${what})` : '');
  let nutToo = false;
  if (hf?.kind === 'hex') {
    const headSize = inch ? len(hf.wrenchIn) : `${hf.wrenchMm} mm`;
    nutToo = !!n && nutSize === headSize;
    tools.push({ what: 'Wrench', text: nutToo ? `${headSize}, for the head and the nut${din(hf.dinMm, 'parts')}` : `${headSize}${din(hf.dinMm, 'bolts')}` });
  }
  if (n && !nutToo) tools.push({ what: 'Nut', text: `${nutSize} wrench${din(n.dinMm, 'nuts')}` });
  if (tap) tools.push({ what: 'Tap', text: inch ? `${t.label} ${t.cls}` : `${fullName(t)}${t.cls === 'fine' ? ' (fine)' : ''}` });
  return tools;
}

// ---------- Choosing a bit ----------
// The bits that can cut a hole: no Forstner bits in metal or for small holes, no twist bits where a Forstner is needed.
function canCut(b, h, group) {
  if (b.kind === 'forstner') return h.forstner && group !== 'metal';
  return h.twist !== false;
}

// The owned bit that suits a hole best: inside its range and nearest the ideal (for a tap drill, nearest 75%).
// If none is in range, the nearest on either side, so the page can say what's wrong with each.
export function chooseBit(h, owned, material = 'hardwood') {
  const group = FS.materialById(material)?.group || 'wood';
  if (h.cone) return { cone: true };
  const list = bySize(owned).filter(b => canCut(b, h, group));
  const eps = 1e-6;
  const inside = list.filter(b => b.mm >= h.min - eps && b.mm <= h.max + eps);
  const usual = h.usual ? bitById(h.usual) : null;
  const score = b => Math.abs(b.mm - h.ideal) - (usual && b.id === usual.id ? 1e-4 : 0) - (b.kind !== 'metric' ? 1e-7 : 0);
  if (inside.length) {
    // The chart's own bit wins when it's owned and within a tenth of a millimetre of the ideal (M12: 10.2, not 10.3).
    const std = usual && inside.find(b => b.id === usual.id && Math.abs(b.mm - h.ideal) < 0.1);
    const best = std || inside.reduce((a, b) => (score(b) < score(a) ? b : a));
    return { bit: best, ok: true, diff: best.mm - h.ideal, usual, pct: h.thread ? threadPct(h.thread, best.mm) : null };
  }
  const below = [...list].reverse().find(b => b.mm < h.min);
  const above = list.find(b => b.mm > h.max);
  const info = b => b && { bit: b, diff: b.mm - h.ideal, pct: h.thread ? threadPct(h.thread, b.mm) : null };
  // Some holes forgive a bit a hair either side, with a caveat: a pilot in wood, a dowel, a shelf pin.
  // Then the nearest one on the side the hole prefers will do, and the other side is named too.
  if (h.near) {
    const tight = below && h.ideal - below.mm <= h.near.tight + eps ? below : null;
    const loose = above && above.mm - h.ideal <= h.near.loose + eps ? above : null;
    const best = h.near.prefer === 'loose' ? loose || tight : tight || loose;
    if (best) {
      const side = best === tight ? 'tight' : 'loose', other = best === tight ? loose : tight;
      return { bit: best, ok: true, near: side, words: h.near.words[side], diff: best.mm - h.ideal, usual, pct: null,
        other: other && { bit: other, near: side === 'tight' ? 'loose' : 'tight', diff: other.mm - h.ideal } };
    }
  }
  return { ok: false, below: info(below), above: info(above), usual };
}

// A pilot in wood forgives a bit a 64th either side of the chart's (less for small screws, where a 64th
// is a lot), with a word on what to watch. MDF would rather be loose than split.
function woodNear(mat, ideal) {
  const by = Math.min(MM / 64, 0.15 * ideal);
  const [tight, loose] = {
    hardwood: ['A hair tight in hardwood: wax the screw and drive it slowly.', 'A hair loose: it holds, with a little less bite.'],
    plywood: ['A hair tight: wax the screw, and go slowly near an edge.', 'A hair loose: it holds, with a little less bite.'],
    softwood: ['A hair tight: fine in softwood.', 'A hair loose: softwood grips less, so go no bigger.'],
    mdf: ['A hair tight: MDF splits, so keep well in from the edges.', 'A hair loose: it holds, but don’t overtighten.'],
  }[mat];
  return { tight: by, loose: by, prefer: mat === 'mdf' ? 'loose' : 'tight', words: { tight, loose } };
}

// Why the nearest bit on one side of a hole's range won't do, in words: "95% thread: too tight, the tap
// may snap", "0.0156″ small: too tight". A thread can't be under 0% or over 100%: a bit that big is wider
// than the screw, and one that small is narrower than the screw's core.
export function missWords(h, x, side, metric) {
  const off = offWords(x.diff, metric);
  if (x.pct != null) {
    const straight = h.key === 'straight'; // a screw forming its own thread in a print, no tap
    if (x.pct <= 0) return straight ? 'bigger than the screw: it won’t grip' : 'bigger than the screw: no thread at all';
    if (x.pct >= 100) return straight ? 'smaller than the screw’s core: it would split the print' : 'smaller than the screw’s core: the tap would jam';
    if (straight) return `${off}: ${side === 'below' ? 'too tight, it may split the print' : 'too loose to hold'}`;
    return `${Math.round(x.pct)}% thread: ${side === 'below' ? 'too tight, the tap may snap' : 'too loose to hold'}`;
  }
  if (h.role === 'clear' && side === 'below' && x.bit.mm <= (h.screwMm ?? h.min)) return 'won’t clear the screw';
  if (h.key === 'nut' && side === 'below') {
    const gap = x.bit.mm - h.spare;
    return gap <= 0 ? `${offText(-gap, metric)} narrower than the washer: it won’t go in` : `only ${offText(gap, metric)} wider than the washer: too tight to get it in`;
  }
  if (h.key === 'cbore' && side === 'below') return `${off}: the head won’t go in`;
  if (h.key === 'close' && side === 'above') return `${off}: a free fit, not a close one`;
  return `${off}: ${side === 'below' ? 'too tight' : 'too loose'}`;
}

// ---------- The other way round: everything a bit is right for ----------
// Every hole of every fastener in every material, merged where the numbers are the same.
let ALL;
export function allHoles() {
  if (ALL) return ALL;
  const seen = new Map();
  const put = (who, h, type, pick, material, order) => {
    const [lo, hi] = h.index || [h.min, h.max];
    const key = `${who}|${h.name}|${lo.toFixed(3)}|${hi.toFixed(3)}`;
    let u = seen.get(key);
    if (!u) { u = { who, hole: h, lo, hi, group: useGroup(type, h), pick, mats: [], matsMatter: !!h.matsMatter, order }; seen.set(key, u); }
    if (!u.mats.includes(material)) u.mats.push(material);
  };
  FS.TYPES.forEach((type, ti) => {
    const mats = type.materials === 'all' ? FS.MATERIALS.map(m => m.id) : type.materials;
    type.sizes.forEach((size, si) => {
      const order = ti * 1000 + si * 2;
      const heads = type.id === 'machine' ? FS.headsFor(threadById(size)) : [undefined];
      for (const material of mats) {
        for (const head of heads) {
          const r = holesFor({ type: type.id, size, material, head });
          for (const h of r.holes) {
            if (h.cone || h.noIndex) continue;
            put(useLabel(r, h), h, type.id, r.pick, material, order);
            for (const a of h.alt) {
              if (!a.index) continue;
              const mm = bitById(a.bit).mm;
              put(a.index, { ...h, ideal: mm, min: mm - HALF64, max: mm + HALF64, usual: a.bit, alt: [], index: null }, type.id, r.pick, material, order + 1);
            }
          }
        }
      }
    });
  });
  ALL = [...seen.values()];
  return ALL;
}

function useLabel(r, h) {
  if (h.indexName) return h.indexName;
  if (r.pick.type === 'machine') {
    if (h.key === 'cbore') return `${r.thread.sizeLabel} ${r.sub}`;
    if (h.key === 'close' || h.key === 'free') return r.thread.sizeLabel;
    return r.thread.label;
  }
  return r.name;
}

export const GROUPS = ['Pilot holes', 'Tap drills', 'Clearance and shank holes', 'Inserts, dowels and pins', 'Counterbores'];
function useGroup(type, h) {
  if (h.key === 'tap' || h.key === 'straight') return 'Tap drills';
  if (h.role === 'clear') return 'Clearance and shank holes';
  if (h.role === 'head') return 'Counterbores';
  if (['heatset', 'insert', 'dowel', 'shelfpin', 'hinge'].includes(type)) return 'Inserts, dowels and pins';
  return 'Pilot holes';
}

// Every use of one bit, grouped, closest first. A use is spot on when it's the chart's own bit for the hole,
// exactly the size, or a tap drill giving a 70–80% thread.
export function usesFor(bitId) {
  const b = bitById(bitId);
  if (!b) return [];
  const eps = 1e-6;
  const groups = GROUPS.map(name => ({ name, uses: [] }));
  for (const u of allHoles()) {
    if (b.mm < u.lo - eps || b.mm > u.hi + eps || !canCutAny(b, u)) continue;
    const mats = u.mats.filter(m => b.kind !== 'forstner' || FS.materialById(m).group !== 'metal');
    const diff = b.mm - u.hole.ideal, usual = u.hole.usual === b.id;
    const pct = u.hole.thread ? threadPct(u.hole.thread, b.mm) : null;
    const spot = usual || Math.abs(diff) < SAME_MM || (u.hole.key === 'tap' && goodTap(pct));
    groups.find(x => x.name === u.group).uses.push({ ...u, mats, diff, usual, pct, spot });
  }
  // Closest first; among equally close ones, in the order the picker lists them.
  const near = d => Math.round(Math.abs(d) * 1000);
  for (const g of groups) g.uses.sort((x, y) => near(x.diff) - near(y.diff) || x.order - y.order);
  return groups.filter(g => g.uses.length);
}

// What a bit is known for, to lead its sheet: its spot-on uses, the ones it's the chart's bit for first (#29: the
// tap drill for #8-32), then by kind of hole, the same materials together, in the picker's order.
export function spotOn(bitId) {
  const list = usesFor(bitId).flatMap(g => g.uses.filter(u => u.spot));
  const gi = u => GROUPS.indexOf(u.group);
  return list.sort((x, y) => (y.usual - x.usual) || gi(x) - gi(y) || x.mats.join().localeCompare(y.mats.join()) || x.order - y.order);
}
function canCutAny(b, u) {
  if (b.kind === 'forstner') return u.hole.forstner && u.mats.some(m => FS.materialById(m).group !== 'metal');
  return u.hole.twist !== false;
}

export { eval64 };

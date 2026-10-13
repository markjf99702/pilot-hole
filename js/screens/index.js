// The drill index: each set you own drawn as a steel case, every bit standing in a hole sized to it.
// Tap a bit to see everything it's right for, or mark it missing.
import { store } from '../store.js';
import { SETS, setById, bitById, BITS, nearestInEachKind } from '../drills.js';
import { usesFor } from '../holes.js';
import { bitInHole } from '../draw.js';
import { pickHash, finishOf } from './holes.js';
import { $, $$, esc, bitHTML, bitSizes, offWords, fracify, openSheet, closeSheet, toast, ICON } from '../ui.js';

let arrived = false;    // the wave plays once a visit
const STD_MAX = 13;      // mm: the biggest bit in an everyday set, which sets the scale for all of them
const CELL = 33;         // px: the narrowest a slot gets

export function renderIndex(main) {
  main.innerHTML = `<section class="index" id="index"></section>`;
  const root = $('#index', main);
  let selected = null;

  function draw() {
    const owned = store.sets.map(setById).filter(Boolean);
    const others = SETS.filter(s => !store.sets.includes(s.id));
    const missing = store.missing.length;
    const count = store.owned().size;
    root.innerHTML = `
      <div class="index-head">
        <h1>Your drill index</h1>
        <p>${count ? `${count} bit${count > 1 ? 's' : ''}${missing ? `, ${missing} gone missing` : ''}. Tap one to see everything it’s right for, or to mark it missing.` : 'No bits yet: tick the sets you have below.'}</p>
      </div>
      <div class="cases">${owned.filter(x => !x.big).map(caseHTML).join('')}${store.loose.length ? looseCase() : ''}${owned.filter(x => x.big).map(caseHTML).join('')}</div>
      <section class="others" aria-labelledby="othersTitle">
        <h2 id="othersTitle">${owned.length ? 'Other sets' : 'Sets'}</h2>
        <p class="hint">Tick the ones in your drawer. Answers on the Holes screen come from these.</p>
        <ul class="set-list">${others.map(s => `<li>
          <span class="set-name"><b>${esc(s.name)}</b><small>${fracify(s.range)} · ${s.bits.length} bit${s.bits.length > 1 ? 's' : ''}</small></span>
          <button type="button" class="btn small" data-add="${s.id}">I have these</button></li>`).join('')}</ul>
        <p class="hint">A bit on its own, from the junk drawer? <button type="button" class="link-btn" data-act="loose">Add a loose bit</button></p>
      </section>`;
    sizeTrays();
    if (selected) $(`.slot[data-bit="${CSS.escape(selected.bit)}"][data-set="${selected.set}"]`, root)?.classList.add('on');
  }

  // Fit each tray's columns to the screen.
  function sizeTrays() {
    for (const tray of $$('.tray', root)) {
      const cell = +tray.dataset.cell || CELL;
      const want = tray.clientWidth > 700 ? +(tray.dataset.rowWide || tray.dataset.row) : +tray.dataset.row;
      const cols = Math.max(1, Math.min(want, Math.floor(tray.clientWidth / cell)));
      tray.style.setProperty('--cols', cols);
    }
  }

  root.addEventListener('click', e => {
    const slot = e.target.closest('.slot');
    if (slot) {
      $$('.slot.on', root).forEach(s => s.classList.remove('on'));
      slot.classList.add('on');
      selected = { bit: slot.dataset.bit, set: slot.dataset.set };
      bitSheet(slot.dataset.bit, slot.dataset.set, () => { $$('.slot.on', root).forEach(s => s.classList.remove('on')); selected = null; });
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) { store.setSet(add.dataset.add, true); toast(`${setById(add.dataset.add).name} added`); return; }
    const drop = e.target.closest('[data-drop]');
    if (drop) {
      const s = setById(drop.dataset.drop);
      if (confirm(`Take the ${s.name.toLowerCase()} set out of your bits?`)) store.setSet(s.id, false);
      return;
    }
    if (e.target.closest('[data-act="loose"]')) looseSheet();
  });

  const off = store.onChange(draw);
  const onResize = () => sizeTrays();
  window.addEventListener('resize', onResize);
  draw();
  // The first time in, the bits rise into their holes in a quick wave.
  if (!arrived) {
    arrived = true;
    root.classList.add('arrive');
    setTimeout(() => root.classList.remove('arrive'), 1600);
  }
  return () => { off(); window.removeEventListener('resize', onResize); };
}

// One case: the lid's plate with what's in it, then the tray of bits.
function caseHTML(s) {
  const big = !!s.big;
  const maxMm = big ? Math.max(...s.bits.map(id => bitById(id).mm)) : STD_MAX;
  const cell = big ? (s.forstner ? 74 : 54) : CELL;
  const scale = (cell - 8) / maxMm;
  const gone = s.bits.filter(id => store.isMissing(s.id, id)).length;
  return `<article class="case${big ? ' wide' : ''}" data-set="${s.id}">
    <header class="lid">
      <div class="plate"><b>${esc(s.name)}</b><span>${fracify(s.range)}</span></div>
      <span class="count" title="${s.bits.length - gone} of ${s.bits.length}">${s.bits.length - gone}<small>/${s.bits.length}</small></span>
      <button type="button" class="lid-x" data-drop="${s.id}" aria-label="I don’t have the ${esc(s.name.toLowerCase())} set">${ICON.x}</button>
    </header>
    <div class="tray" data-row="${s.row}" data-row-wide="${s.rowWide || s.row}" data-cell="${cell}" style="--cell:${cell}px">
      ${s.bits.map((id, i) => slotHTML(bitById(id), s, scale, cell, maxMm, i)).join('')}
    </div>
  </article>`;
}

function slotHTML(b, s, scale, cell, maxMm, i = 0) {
  const missing = store.isMissing(s.id, b.id);
  const forstner = b.kind === 'forstner';
  const h = forstner && s.forstner ? cell : 84; // a Forstner bit among twist bits sits on their baseline
  const rise = 24 + 42 * Math.pow(Math.min(1, b.mm / maxMm), 0.75);
  const svg = bitInHole({ w: cell, h, d: b.mm * scale, rise, finish: finishOf(b), missing, forstner });
  return `<button type="button" class="slot${missing ? ' gone' : ''}" data-bit="${b.id}" data-set="${s.id}" style="--i:${Math.min(i, 40)}" aria-label="${esc(b.name)}, ${esc(bitSizes(b))}${missing ? ', missing' : ''}">
    ${svg}<span class="stamp">${stampHTML(b)}</span></button>`;
}

// The size stamped by the hole: 7/64, #36, F, 2.5.
function stampHTML(b) {
  if (b.kind === 'frac' || (b.kind === 'forstner' && !b.metric)) {
    const [w, f] = b.short.includes('-') ? b.short.split('-') : [null, b.short];
    return `${w ? `${w}<span class="sp">-</span>` : ''}${f.includes('/') ? `<span class="fr">${f}</span>` : f}`;
  }
  return esc(b.metric ? b.short : b.name);
}

function looseCase() {
  const bits = store.loose.map(bitById).filter(Boolean).sort((a, b) => a.mm - b.mm);
  const s = { id: 'loose', name: 'Loose bits', row: 8 };
  const cell = 40, maxMm = Math.max(STD_MAX, ...bits.map(b => b.mm));
  const scale = (cell - 8) / maxMm;
  return `<article class="case loose" data-set="loose">
    <header class="lid"><div class="plate"><b>Loose bits</b><span>odds and ends</span></div><span class="count">${bits.length}</span></header>
    <div class="tray" data-row="8" data-cell="${cell}" style="--cell:${cell}px">
      ${bits.map(b => slotHTML(b, s, scale, cell, maxMm)).join('')}
    </div></article>`;
}

// ---------- The sheet for one bit ----------
const MAT_SHORT = { hardwood: 'hardwood', softwood: 'softwood', plywood: 'plywood', mdf: 'MDF', aluminium: 'aluminium', steel: 'steel', printed: 'printed parts' };
function matsText(mats) {
  const wood = ['hardwood', 'softwood', 'plywood', 'mdf'];
  if (mats.length === 4 && wood.every(m => mats.includes(m))) return 'any wood';
  return mats.map(m => MAT_SHORT[m]).join(', ');
}

export function bitSheet(bitId, setId, onClose) {
  const b = bitById(bitId);
  if (!b) return;
  const owned = store.has(b.id);
  const inSet = setId && setId !== 'loose' ? setById(setId) : null;
  const missing = inSet ? store.isMissing(inSet.id, b.id) : false;
  const twins = Object.values(nearestInEachKind(b.mm, { exclude: b.id }))
    .filter(x => x.kind !== b.kind && Math.abs(x.mm - b.mm) <= 0.051)
    .sort((x, y) => Math.abs(x.mm - b.mm) - Math.abs(y.mm - b.mm));
  const groups = usesFor(b.id);
  const loose = store.loose.includes(b.id);
  const body = openSheet(`
    <div class="sheet-top bit-top">
      <div class="bit-hero">${bitInHole({ w: 56, h: 92, d: Math.min(6 + 30 * Math.min(1, b.mm / 13), 40), rise: 60, finish: finishOf(b), forstner: b.kind === 'forstner' })}</div>
      <div class="bit-title">
        <h2 class="bitname">${bitHTML(b)}</h2>
        <p>${esc(bitSizes(b))} · ${esc(kindName(b))}</p>
      </div>
      <button type="button" class="close" aria-label="Close">${ICON.x}</button>
    </div>
    ${twins.length ? `<p class="twins">${twinText(twins, b)}</p>` : ''}
    <div class="own-row">
      ${inSet ? `<label class="switch"><input type="checkbox" id="goneBox"${missing ? ' checked' : ''}><span>Missing from the case</span></label>`
        : owned ? `<p class="mine">${ICON.ok} In your bits${loose ? ', as a loose one' : ''}.${loose ? ` <button type="button" class="link-btn" data-unloose>Take it out</button>` : ''}</p>`
          : `<p class="not-mine">Not in your bits. <button type="button" class="link-btn" data-loose>Add it as a loose bit</button></p>`}
    </div>
    <h3 class="uses-title">${groups.length ? 'Right for' : 'Nothing in the tables calls for this size.'}</h3>
    ${groups.map(g => `<section class="uses"><h4>${esc(g.name)}</h4><ul>${mergeRuns(g.uses).map(useRow).join('')}</ul></section>`).join('')}
  `, onClose);
  body.addEventListener('click', e => {
    if (e.target.closest('.close')) closeSheet();
    if (e.target.closest('[data-loose]')) { store.addLoose(b.id); toast(`${b.name} added to your bits`); closeSheet(); }
    if (e.target.closest('[data-unloose]')) { store.removeLoose(b.id); toast(`${b.name} taken out`); closeSheet(); }
    if (e.target.closest('a.use')) closeSheet();
  });
  $('#goneBox', body)?.addEventListener('change', e => {
    store.setMissing(inSet.id, b.id, e.target.checked);
    toast(e.target.checked ? `${b.name} marked missing` : `${b.name} is back`);
  });
}

// "The same size as 5.1 mm", or "Near enough the same as #35 (0.0006″ big) and 2.8 mm (0.0009″ big)".
function twinText(twins, b) {
  const same = twins.filter(t => Math.abs(t.mm - b.mm) < 0.006);
  const near = twins.filter(t => !same.includes(t));
  // A Forstner bit's twin can share its name: "the 3/8″ twist drill".
  const nm = t => (t.name === b.name ? `the ${esc(t.name)} twist drill` : `<b>${esc(t.name)}</b>`);
  const list = xs => xs.map(t => `${nm(t)}${same.includes(t) ? '' : ` (${esc(offWords(t.mm - b.mm, b.metric))})`}`).join(' and ');
  return [same.length ? `The same size as ${list(same)}.` : '', near.length ? `${same.length ? 'Near enough' : 'Near enough the same as'} ${list(near)}${same.length ? ' too' : ''}.` : ''].join(' ');
}

function kindName(b) {
  return b.kind === 'forstner' ? 'Forstner bit' : `${{ frac: 'fractional', num: 'number', letter: 'letter', metric: 'metric' }[b.kind]} drill`;
}

// Runs of gauges with the same hole and the same fit become one row: "#2 to #10 wood screws".
function mergeRuns(uses) {
  const out = [];
  for (const u of uses) {
    const m = u.who.match(/^#(\d+) (wood screw|sheet-metal screw)(, old-style)?$/);
    const prev = out[out.length - 1];
    const key = m && `${m[2]}|${m[3] || ''}|${u.hole.key}|${u.mats.join()}|${Math.round(u.diff * 1000)}|${u.usual}`;
    if (m && prev?.runKey === key) {
      prev.count++;
      prev.who = `#${prev.first} ${prev.count === 2 ? 'and' : 'to'} #${m[1]} ${m[2]}s${m[3] || ''}`;
      continue;
    }
    out.push(m ? { ...u, runKey: key, first: m[1], count: 1 } : u);
  }
  return out;
}

// What a hole is, when its group doesn't already say: "shank hole", "close fit", "straight into a print".
const QUALIFIER = { lead: 'lead hole', straight: 'straight into a print, no tap', shank: 'shank hole', close: 'close fit', free: 'free fit', plug: 'for a plug' };

function useRow(u) {
  const metric = /^M\d|mm/.test(u.who) || u.pick.type === 'heatset' || u.pick.type === 'hinge';
  const tap = u.pct != null && u.hole.key === 'tap';
  const how = tap ? `${Math.round(u.pct)}% thread` : offWords(u.diff, metric);
  const good = tap ? u.pct >= 70 && u.pct <= 80 : Math.abs(u.diff) < 0.006;
  const bits = [QUALIFIER[u.hole.key], u.matsMatter ? `in ${matsText(u.mats)}` : ''].filter(Boolean);
  return `<li><a class="use" href="${pickHash({ ...u.pick, material: u.matsMatter ? u.mats[0] : u.pick.material })}">
    <span class="what"><b>${fracify(u.who)}</b>${bits.length ? ` <small>${esc(bits.join(', '))}</small>` : ''}</span>
    <span class="how${good ? ' good' : ''}">${esc(how)}${u.usual ? ' · the usual' : ''}</span></a></li>`;
}

// ---------- Adding a loose bit ----------
export function looseSheet() {
  const kinds = [['frac', 'Fractional'], ['num', 'Number'], ['letter', 'Letter'], ['metric', 'Metric'], ['forstner', 'Forstner']];
  const body = openSheet(`
    <div class="sheet-top"><h2>Add a loose bit</h2><button type="button" class="close" aria-label="Close">${ICON.x}</button></div>
    <p class="hint">For a bit that isn’t part of a set: one bought for a job, or one rolling around the drawer.</p>
    <div class="loose-pick">
      <label class="field"><span class="label">Kind</span><select id="looseKind">${kinds.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
      <label class="field"><span class="label">Size</span><select id="looseSize"></select></label>
    </div>
    <p class="hint" id="looseLine"></p>
    <button type="button" class="btn primary" id="looseAdd">Add it</button>`);
  const kindSel = $('#looseKind', body), sizeSel = $('#looseSize', body);
  const line = () => { $('#looseLine', body).textContent = store.has(sizeSel.value) ? 'You have this one already.' : ''; };
  const fill = () => {
    const list = BITS.filter(b => b.kind === kindSel.value).sort((a, b) => a.mm - b.mm);
    sizeSel.innerHTML = list.map(b => `<option value="${b.id}">${esc(b.name)} · ${esc(bitSizes(b))}</option>`).join('');
    sizeSel.value = { frac: 'f:1/8', num: 'n:29', letter: 'l:F', metric: 'm:2.5', forstner: 'fm:35' }[kindSel.value];
    line();
  };
  kindSel.addEventListener('change', fill);
  sizeSel.addEventListener('change', line);
  body.addEventListener('click', e => {
    if (e.target.closest('.close')) closeSheet();
    if (e.target.closest('#looseAdd')) {
      const b = bitById(sizeSel.value);
      store.addLoose(b.id);
      toast(`${b.name} added`);
      closeSheet();
    }
  });
  fill();
}

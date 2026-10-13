// The Holes screen: pick a fastener and what it's going into, and see every hole it needs in the bits you own.
import { store } from '../store.js';
import { holesFor, chooseBit, normalizePick, missWords } from '../holes.js';
import * as FS from '../fasteners.js';
import { threadById, goodTap } from '../threads.js';
import { bitById, BITS, setById } from '../drills.js';
import { MM, decIn, mmText } from '../units.js';
import { bitInHole, coneGlyph, typeIcon, headIcon, swatch, section } from '../draw.js';
import { $, $$, esc, bitHTML, bitSizes, sizeText, offWords, fracify, toast, ICON } from '../ui.js';

const ALL_BITS = new Set(BITS.map(b => b.id));
// With no bits ticked, answers come from the bits people buy (fractions, metric by halves, Forstner bits)
// and the bit the chart calls for, if there is one.
const BOUGHT = new Set(BITS.filter(b => b.kind === 'frac' || b.kind === 'forstner' || (b.kind === 'metric' && Math.abs(b.mm * 2 - Math.round(b.mm * 2)) < 1e-9)).map(b => b.id));
const usualBits = h => (h.usual ? new Set([...BOUGHT, h.usual]) : BOUGHT);
// What to get for a hole with no usual bit: the nearest of the bits people buy, in the job's own units, so an
// inch job isn't sent out for a 20 mm Forstner. Then any bit at all.
const BOUGHT_IN = new Set([...BOUGHT].filter(id => !bitById(id).metric));
const BOUGHT_MM = new Set([...BOUGHT].filter(id => bitById(id).metric));
function toGet(h, metric, material) {
  for (const pool of [metric ? BOUGHT_MM : BOUGHT_IN, BOUGHT, ALL_BITS]) {
    const c = chooseBit(h, pool, material);
    if (c.ok) return c.bit;
  }
  return null;
}
const lastSize = { inch: '1/4-20', metric: 'M3' };
// Each fastener's last size and material this visit, so a heat-set insert forcing a printed part doesn't
// leave the wood screw you come back to going into plastic.
const lastPick = {};

// The address for a pick, so a reload or a shared link comes back to it.
export function pickHash(p) {
  const q = new URLSearchParams({ type: p.type, size: p.size, into: p.material });
  if (p.head) q.set('head', p.head);
  return `#/?${q}`;
}
export function pickFromHash(hash) {
  const i = hash.indexOf('?');
  if (i < 0) return null;
  const q = new URLSearchParams(hash.slice(i + 1));
  if (!q.get('type')) return null;
  return { type: q.get('type'), size: q.get('size'), material: q.get('into'), head: q.get('head') || undefined };
}

function sizeLabel(type, id) {
  switch (type) {
    case 'wood': case 'sheet': return `#${id}`;
    case 'machine': return esc(threadById(id).label);
    case 'lag': return fracify(FS.LAGS.find(l => l.id === id).label);
    case 'heatset': { const h = FS.HEATSET.find(x => x.id === id); return esc(h.name || h.id); }
    case 'insert': { const t = threadById(id); return esc(t.label); }
    case 'dowel': return fracify(FS.DOWELS.find(d => d.id === id).label);
    case 'shelfpin': return fracify(FS.SHELF_PINS.find(s => s.id === id).label);
    case 'hinge': return '35 mm';
    default: return esc(id);
  }
}

const NOT_FOR = {
  lag: 'Lag screws are for wood.',
  heatset: 'Heat-set inserts go into printed parts.',
  insert: 'These inserts are for wood. In a printed part use a heat-set insert; in metal, tap the hole.',
  dowel: 'Dowels are for wood.',
  shelfpin: 'Shelf pins are for wood.',
  hinge: 'Hinge cups are for wood.',
};

export function renderHoles(main, fromHash) {
  let pick = normalizePick(fromHash || store.pick || {});
  lastPick[pick.type] = pick;
  // A pick that came by a link (a bit's sheet, the gauge, a shared address) is the last one looked at too,
  // so the Holes tab comes back to it.
  if (fromHash) store.setPick(pick);
  main.innerHTML = `
    <section class="holes">
      <div class="picker" id="picker"></div>
      <div class="result" id="result" aria-live="polite"></div>
    </section>`;
  const picker = $('#picker', main), result = $('#result', main);

  function set(p, { scrollChips = false } = {}) {
    pick = normalizePick(p);
    lastPick[pick.type] = pick;
    const t = pick.type === 'machine' ? threadById(pick.size) : null;
    if (t) lastSize[t.system] = pick.size;
    store.setPick(pick);
    const hash = pickHash(pick);
    if (location.hash !== hash) history.replaceState(null, '', hash);
    drawPicker(scrollChips);
    drawResult();
  }

  function drawPicker(scrollChips) {
    const type = FS.typeById(pick.type);
    const t = pick.type === 'machine' ? threadById(pick.size) : null;
    const sizes = t ? type.sizes.filter(id => threadById(id).system === t.system) : type.sizes;
    const heads = t ? FS.headsFor(t) : [];
    const scroll = Object.fromEntries($$('.chips', picker).map(el => [el.dataset.row, el.scrollLeft]));
    picker.innerHTML = `
      <div class="types" role="radiogroup" aria-label="What you're driving">
        ${FS.TYPES.map(x => `<button type="button" role="radio" class="type" data-type="${x.id}" aria-checked="${x.id === pick.type}" title="${esc(x.name)}">
          ${typeIcon(x.id, 30)}<span>${esc(x.short || x.name)}</span></button>`).join('')}
      </div>
      <div class="pick-row">
        <span class="row-label" id="sizeLbl">Size</span>
        ${t ? `<div class="seg sys" role="radiogroup" aria-label="Inch or metric">
          <button type="button" role="radio" data-sys="inch" aria-checked="${t.system === 'inch'}">Inch</button>
          <button type="button" role="radio" data-sys="metric" aria-checked="${t.system === 'metric'}">Metric</button></div>` : ''}
        <div class="chips" data-row="size" role="radiogroup" aria-labelledby="sizeLbl">
          ${sizes.map(id => `<button type="button" role="radio" class="chip" data-size="${esc(id)}" aria-checked="${id === pick.size}"><span>${sizeLabel(pick.type, id)}</span></button>`).join('')}
        </div>
      </div>
      ${heads.length ? `<div class="pick-row">
        <span class="row-label" id="headLbl">Head</span>
        <div class="chips" data-row="head" role="radiogroup" aria-labelledby="headLbl">
          ${heads.map(h => `<button type="button" role="radio" class="chip head" data-head="${h}" aria-checked="${h === pick.head}">${headIcon(h)}${esc(t.system === 'metric' && h === 'flat' ? 'Countersunk' : FS.HEADS[h].short)}</button>`).join('')}
        </div>
      </div>` : ''}
      <div class="pick-row">
        <span class="row-label" id="intoLbl">Into</span>
        <div class="chips" data-row="into" role="radiogroup" aria-labelledby="intoLbl">
          ${FS.MATERIALS.map(m => {
            const ok = FS.fitsMaterial(type, m.id);
            return `<button type="button" role="radio" class="chip mat${ok ? '' : ' off'}" data-mat="${m.id}" aria-checked="${m.id === pick.material}"${ok ? '' : ' aria-disabled="true"'}>${swatch(m.id)}${esc(m.name)}</button>`;
          }).join('')}
        </div>
      </div>`;
    for (const el of $$('.chips', picker)) {
      el.addEventListener('scroll', () => edges(el), { passive: true });
      if (scroll[el.dataset.row] != null) el.scrollLeft = scroll[el.dataset.row];
      if (scrollChips || scroll[el.dataset.row] == null) {
        const on = $('[aria-checked="true"]', el);
        if (on) el.scrollLeft = Math.max(0, on.offsetLeft - el.clientWidth / 2 + on.offsetWidth / 2);
      }
      edges(el);
    }
  }

  picker.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.type && b.dataset.type !== pick.type) {
      // Back to where this fastener was; the first time, its usual size into whatever you're on, if it can go there.
      const type = FS.typeById(b.dataset.type);
      const keepMat = FS.fitsMaterial(type, pick.material) ? pick.material : type.mat;
      set(lastPick[type.id] || { type: type.id, size: type.def, material: keepMat }, { scrollChips: true });
    } else if (b.dataset.sys) {
      set({ ...pick, size: lastSize[b.dataset.sys] }, { scrollChips: true });
    } else if (b.dataset.size) set({ ...pick, size: b.dataset.size });
    else if (b.dataset.head) set({ ...pick, head: b.dataset.head });
    else if (b.dataset.mat) {
      if (b.getAttribute('aria-disabled') === 'true') { toast(NOT_FOR[pick.type] || 'Not for that.'); return; }
      set({ ...pick, material: b.dataset.mat });
    }
  });

  function drawResult() {
    const r = holesFor(pick);
    const owned = store.owned();
    const maxMm = Math.max(...r.holes.map(h => h.ideal));
    const scale = Math.min(30 / maxMm, 4.4); // px per mm for the glyphs: the biggest bit 30 px across
    const mat = FS.materialById(pick.material);
    const yours = ownedSummary();
    result.innerHTML = `
      <h1 class="spec"><span class="what">${fracify(r.name)}</span> <span class="into">into ${esc(mat.name.toLowerCase())}</span>${r.sub && pick.type !== 'machine' ? ` <span class="sub">${esc(r.sub)}</span>` : ''}</h1>
      ${owned.size ? '' : '<p class="nobits">No bits ticked yet, so these are the usual sizes. Tick the sets you have and every answer comes in your own bits. <button type="button" class="link-btn" data-act="bits">Your bits</button></p>'}
      ${r.warn ? `<p class="warn">${esc(r.warn)}${r.switchTo ? ` ${r.switchTo.map(s => `<button type="button" class="link-btn" data-switch='${esc(JSON.stringify(s))}'>${esc(FS.typeById(s.type).name)} →</button>`).join(' ')}` : ''}</p>` : ''}
      <figure class="diagram">${section(r)}</figure>
      <ol class="cards">${r.holes.map(h => card(h, r, owned, scale)).join('')}</ol>
      ${r.related ? r.related.map(x => `<p class="related"><button type="button" class="link-btn" data-switch='${esc(JSON.stringify(x.pick))}'>${esc(x.text)} ${ICON.arrow}</button></p>`).join('') : ''}
      <section class="tools card-ish" aria-label="Tools">
        <h2>Tools</h2>
        <dl>${r.tools.map(t => `<div><dt>${esc(t.what)}</dt><dd>${fracify(t.text)}</dd></div>`).join('')}</dl>
      </section>
      ${r.note ? `<p class="mat-note">${esc(r.note)}</p>` : ''}
      <p class="yours">Answers come in your bits: ${yours}. <button type="button" class="link-btn" data-act="bits">Change</button></p>`;
  }

  result.addEventListener('click', e => {
    const s = e.target.closest('[data-switch]');
    if (s) { set({ ...pick, ...JSON.parse(s.dataset.switch) }, { scrollChips: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    const t = e.target.closest('[data-bit]');
    if (t) document.dispatchEvent(new CustomEvent('pilot:bit', { detail: t.dataset.bit }));
    if (e.target.closest('[data-act="bits"]')) document.dispatchEvent(new CustomEvent('pilot:bits'));
  });

  const off = store.onChange(drawResult);
  drawPicker(true);
  drawResult();
  history.replaceState(null, '', pickHash(pick));
  return () => off();
}

// "fractional 1/16–1/2″ and metric 1–13 mm", in a few words.
function ownedSummary() {
  const sets = store.sets.map(setById).filter(Boolean);
  const loose = store.loose.length;
  if (!sets.length && !loose) return '<b>none ticked yet</b>';
  const parts = sets.map(s => `${esc(s.name.toLowerCase())} (${fracify(s.range)})`);
  if (loose) parts.push(`${loose} loose bit${loose > 1 ? 's' : ''}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
}

// One hole: the bit you own for it, how close that is, and what else to know.
function card(h, r, owned, scale) {
  const metric = isMetricWork(r);
  // With no bits ticked at all, answer from every bit there is, so the cards show the usual sizes.
  const c = chooseBit(h, owned.size ? owned : usualBits(h), r.pick.material);
  const head = `<div class="hole-head"><h3>${esc(h.name)}</h3><span class="where">${esc(h.where)}</span></div>`;
  const extra = [
    h.alt.length ? h.alt.map(a => { const b = bitById(a.bit); return `<p class="alt">${esc(a.label)}: <button type="button" class="bit-link" data-bit="${b.id}">${bitHTML(b)}</button>${owned.has(b.id) || !owned.size ? '' : ' <span class="not-yours">not in your bits</span>'}</p>`; }).join('') : '',
    h.depth ? `<p class="depth"><b>Depth</b> ${fracify(h.depth)}</p>` : '',
    h.note ? `<p class="note">${fracify(h.note)}</p>` : '',
  ].join('');
  if (c.cone) {
    return `<li class="hole r-${h.role}" data-key="${h.key}">
      <div class="pic">${coneGlyph({ angle: h.cone.angle })}</div>
      <div class="body">${head}
        <p class="big">Ø ${sizeBig(h.cone.dia, metric)}<span class="tag">at the surface</span></p>
        <p class="sizes">${sizeText(h.cone.dia, metric)} · the width of the head</p>
        ${extra}</div></li>`;
  }
  const glyph = (bit, missing) => bitInHole({ w: 52, h: 76, d: (bit ? bit.mm : h.ideal) * scale, rise: 40 + 14 * Math.min(1, (bit ? bit.mm : h.ideal) / 13), finish: bit ? finishOf(bit) : 'gold', missing, ghost: missing, forstner: !missing && bit?.kind === 'forstner' });
  const link = x => `<button type="button" class="bit-link" data-bit="${x.id}">${bitHTML(x)}</button>`;
  if (c.ok) {
    const b = c.bit;
    const exact = Math.abs(c.diff) < 0.006;
    const tag = c.near ? `a hair ${c.near}` : c.pct != null && h.key === 'tap' ? `${Math.round(c.pct)}% thread` : offWords(c.diff, metric);
    let usualLine;
    if (c.near) {
      // A neighbour standing in for the right bit: say which bit that is.
      const right = c.usual || toGet(h, metric, r.pick.material);
      usualLine = !right ? '' : c.usual ? `The usual is ${link(right)} (${esc(otherSizes(right))}), not in your bits.` : `The right size is ${link(right)}, not in your bits.`;
    } else {
      usualLine = c.usual
        ? (c.usual.id === b.id ? (owned.size ? 'The usual bit for it.' : 'The usual bit.') : `The usual is ${link(c.usual)} (${esc(otherSizes(c.usual))})${owned.has(c.usual.id) || !owned.size ? '' : ', not in your bits'}.`)
        : exact ? '' : `Aim for ${esc(sizeText(h.ideal, metric))}.`;
    }
    const pctGood = h.key === 'tap' && goodTap(c.pct);
    // What a thread that's shallower or deeper than usual means for the job, or what to watch with a near miss.
    const metal = r.pick.material === 'steel';
    const pctLine = c.near ? `<p class="pct">${esc(c.words)}${c.other ? ` Or ${link(c.other.bit)}, a hair ${c.other.near}.` : ''}</p>`
      : h.key !== 'tap' || pctGood ? ''
        : c.pct < 70 ? `<p class="pct">A shallow thread: ${metal ? 'plenty in steel' : 'it holds, but go easy tightening it'}, and easy on the tap.</p>`
          : '<p class="pct">A deep thread: strong, but stiff to tap. Go gently and back off often.</p>';
    const tagClass = c.near ? ' near' : exact || pctGood ? ' good' : '';
    return `<li class="hole r-${h.role}${c.near ? ' near' : ''}" data-key="${h.key}" data-bit="${b.id}">
      <div class="pic">${glyph(b)}</div>
      <div class="body">${head}
        <p class="big">${link(b)}<span class="tag${tagClass}">${esc(tag)}</span></p>
        <p class="sizes">${esc(bitSizes(b))}. ${usualLine}</p>
        ${pctLine}${extra}</div></li>`;
  }
  // Nothing you own will do: say what to get, and what's wrong with the nearest on each side.
  const want = c.usual || toGet(h, metric, r.pick.material);
  const why = side => {
    const x = c[side];
    if (!x) return '';
    return `<li><button type="button" class="bit-link" data-bit="${x.bit.id}">${bitHTML(x.bit)}</button> ${esc(missWords(h, x, side, metric))}</li>`;
  };
  const near = why('below') + why('above');
  return `<li class="hole r-${h.role} none" data-key="${h.key}">
    <div class="pic">${glyph(want, true)}</div>
    <div class="body">${head}
      <p class="big want">${want ? `<button type="button" class="bit-link" data-bit="${want.id}">${bitHTML(want)}</button>` : esc(sizeText(h.ideal, metric))}<span class="tag none">not in your bits</span></p>
      <p class="sizes">${want ? `${esc(bitSizes(want))}. ` : ''}${near ? 'Nearest you have:' : 'Nothing you have comes close.'}</p>
      ${near ? `<ul class="nearest">${near}</ul>` : ''}
      ${extra}</div></li>`;
}

// A bit's size in the units its name doesn't already give: 0.126″ for 3.2 mm, 0.201″ · 5.11 mm for #7.
function otherSizes(b) {
  if (b.metric) return `${decIn(b.in, 4)}″`;
  if (b.kind === 'frac') return `${decIn(b.in, 4)}″ · ${mmText(b.mm)} mm`;
  return bitSizes(b);
}

// Which ends of a chip row have more to scroll to, for the fades.
function edges(el) {
  const max = el.scrollWidth - el.clientWidth;
  el.dataset.at = max <= 2 ? 'none' : el.scrollLeft <= 2 ? 'start' : el.scrollLeft >= max - 2 ? 'end' : 'middle';
}

export function finishOf(b) {
  return { frac: 'gold', num: 'black', letter: 'bright', metric: 'cobalt', forstner: 'bright' }[b.kind];
}
function isMetricWork(r) {
  if (r.thread) return r.thread.system === 'metric';
  const p = r.pick;
  if (p.type === 'heatset' || p.type === 'hinge') return true;
  if (p.type === 'lag') return !!FS.LAGS.find(l => l.id === p.size)?.metric;
  if (p.type === 'dowel') return !!FS.DOWELS.find(d => d.id === p.size)?.metric;
  if (p.type === 'shelfpin') return p.size === '5';
  return false;
}
function sizeBig(mm, metric) {
  return metric ? `${mmText(mm, 1)}<small> mm</small>` : `${decIn(mm / MM, 3)}″`;
}

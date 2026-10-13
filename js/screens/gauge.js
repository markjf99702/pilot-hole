// The screw gauge: calibrate the screen against a bank card, lay a screw on the glass and slide two jaws
// to its threads and its length, hold its threads against true-size combs, and it names itself.
import { store } from '../store.js';
import { CARD, plausible, guessPxPerMm, threadCandidates, combsFor, threadOnComb, tenThreads,
  gaugeFor, bitsNear, snapLength, screwName } from '../identify.js';
import { holesFor, chooseBit } from '../holes.js';
import * as FS from '../fasteners.js';
import { fullName, pitchText } from '../threads.js';
import { MM, decIn, mmText, fracText } from '../units.js';
import { pickHash } from './holes.js';
import { bitSheet } from './index.js';
import { headIcon, typeIcon } from '../draw.js';
import { $, esc, bitHTML, bitSizes, offWords, fracify, toast, ICON } from '../ui.js';

const n = x => +x.toFixed(2);
const STEPS = [['cal', 'Card'], ['measure', 'Measure'], ['threads', 'Threads'], ['name', 'Name']];

export function renderGauge(main, { calibrate = false } = {}) {
  const saved = store.screen();
  const coarse = matchMedia('(pointer: coarse)').matches;
  const st = {
    step: calibrate || !saved?.same ? 'cal' : 'measure',
    k: saved?.pxPerMm || guessPxPerMm({ coarse, shortSide: Math.min(screen.width, screen.height) }),
    calEdge: 'long',
    what: 'screw',          // screw or bit
    tip: 'blunt',           // blunt (machine screw or bolt) or pointed (wood, sheet-metal or lag)
    dia: 6.2, len: 25.4,    // mm
    more: false, comb: null, thread: null, head: null, kind: 'wood',
  };
  const recal = !!saved && !saved.same;

  document.body.classList.add('gauge-on');
  const meta = document.querySelector('meta[name="viewport"]');
  const metaWas = meta.content;
  meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

  main.innerHTML = `
    <div class="gauge" id="gauge">
      <div class="g-top">
        <a class="g-close" href="#/" aria-label="Close the gauge">${ICON.x}</a>
        <ol class="g-steps" aria-label="Steps"></ol>
        <span class="g-zoom" id="gZoom" hidden>Zoomed in: pinch out so sizes are true</span>
      </div>
      <div class="g-field" id="gField"><svg id="gSvg" aria-hidden="true"></svg><div class="g-over" id="gOver"></div></div>
      <div class="g-panel" id="gPanel"></div>
    </div>`;
  const gauge = $('#gauge', main), field = $('#gField', main), svg = $('#gSvg', main), over = $('#gOver', main), panel = $('#gPanel', main);
  $('.g-close', gauge).href = window.pilotHole?.prev || '#/';

  // ---------- Drawing ----------
  let W = 0, H = 0;
  function size() {
    W = field.clientWidth; H = field.clientHeight;
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }
  const corner = () => (st.step === 'cal' ? { x0: 14, y0: st.calEdge === 'long' ? 14 : 64 } : { x0: Math.round(14 + 7 * st.k), y0: Math.round(12 + 12 * st.k) });

  function drawSteps() {
    const at = STEPS.findIndex(s => s[0] === st.step);
    $('.g-steps', gauge).innerHTML = STEPS.map(([id, name], i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"${i === at ? ' aria-current="step"' : ''}>${name}</li>`).join('');
  }

  function draw() {
    size();
    drawSteps();
    gauge.dataset.step = st.step;
    over.innerHTML = '';
    if (st.step === 'cal') drawCal();
    else if (st.step === 'measure') drawMeasure();
    else if (st.step === 'threads') drawThreads();
    else { svg.innerHTML = ''; drawName(); }
  }

  // Step 1: the card.
  function drawCal() {
    drawCalPanel();
    size();
    const { x0, y0 } = corner();
    const k = st.k, cw = CARD.short * k, ch = CARD.long * k, r = CARD.corner * k;
    let s = `<rect x="${x0}" y="${y0}" width="${n(cw)}" height="${n(ch)}" rx="${n(r)}" class="card-ghost"/>`;
    s += `<path d="M0 ${y0}H${W}M${x0} 0V${H}" class="fence"/>`;
    if (st.calEdge === 'long') {
      const y = y0 + ch;
      s += `<path d="M0 ${n(y)}H${W}" class="jaw"/>`;
      s += `<path d="M${n(x0 + cw)} ${y0 - 12}v-${Math.max(0, y0 - 14)}M${n(x0 + cw)} ${n(y + 4)}v12" class="tick"/>`;
      s += grip(W - 34, y, 'v');
      s += `<text x="${W - 62}" y="${n(y - 10)}" text-anchor="end" class="g-lbl">the card’s far end</text>`;
    } else {
      const x = x0 + cw;
      s += `<path d="M${n(x)} 0V${H}" class="jaw"/>`;
      s += grip(x, H - 34, 'h');
      s += `<text x="${n(x + 10)}" y="${y0 - 26}" class="g-lbl">the card’s right edge</text>`;
    }
    svg.innerHTML = s;
  }
  function drawCalPanel() {
    const fits = st.calEdge === 'long' ? (corner().y0 + CARD.long * st.k + 30 < field.clientHeight) : true;
    panel.innerHTML = `
      ${recal ? '<p class="g-warn">This screen or its zoom has changed since you last calibrated, so do it once more.</p>' : ''}
      <p class="g-say">${st.calEdge === 'long'
        ? 'Lay a bank card on the glass, long side down the screen, tucked into the corner. Drag the red line to the card’s far end.'
        : 'Lay a bank card on the glass, tucked into the corner under the top line. Drag the red line to the card’s right edge.'}</p>
      <div class="g-row">
        <button type="button" class="g-nudge" data-nudge="-1" aria-label="A hair shorter">${ICON.minus}</button>
        <span class="g-read"><b>${st.k.toFixed(2)}</b> px per mm</span>
        <button type="button" class="g-nudge" data-nudge="1" aria-label="A hair longer">${ICON.plus}</button>
        <button type="button" class="btn primary g-next" data-go="measure">That’s it</button>
      </div>
      <p class="g-small">Any card the size of a bank card works: they’re all ${CARD.long.toFixed(2)} × ${CARD.short.toFixed(2)} mm. ${st.calEdge === 'long'
        ? `${fits ? 'Card too long for the screen?' : 'The card won’t fit this screen lengthways:'} <button type="button" class="link-btn" data-edge="short">Measure across it instead</button>`
        : '<button type="button" class="link-btn" data-edge="long">Measure its long side instead</button> (more exact)'}</p>`;
  }

  // Step 2: the jaws. The panel goes first: its height decides how much glass is left to draw on.
  function drawMeasure() {
    drawMeasurePanel();
    size();
    const { x0, y0 } = corner();
    const k = st.k;
    const xd = x0 + st.dia * k, yl = y0 + st.len * k;
    let s = `<path d="M0 0H${W}V${y0}H${x0}V${H}H0Z" class="rail"/>`;
    s += `<path d="M${x0} ${y0}H${W}M${x0} ${y0}V${H}" class="fence"/>`;
    // Rulers: millimetres down the left fence and along the top one.
    let t = '', lbl = '';
    for (let mm = 1; y0 + mm * k < H; mm++) {
      const y = n(y0 + mm * k), len = mm % 10 === 0 ? 12 : mm % 5 === 0 ? 8 : 4.5;
      t += `M${x0 - len} ${y}H${x0}`;
      if (mm % 10 === 0) lbl += `<text x="${x0 - 15}" y="${y + 4}" text-anchor="end" class="g-num">${mm}</text>`;
    }
    for (let mm = 1; x0 + mm * k < W; mm++) {
      const x = n(x0 + mm * k), len = mm % 10 === 0 ? 12 : mm % 5 === 0 ? 8 : 4.5;
      t += `M${x} ${y0 - len}V${y0}`;
      if (mm % 10 === 0) lbl += `<text x="${x}" y="${y0 - 16}" text-anchor="middle" class="g-num">${mm}</text>`;
    }
    s += `<path d="${t}" class="tick"/>${lbl}`;
    s += `<rect x="${x0}" y="${y0}" width="${n(st.dia * k)}" height="${st.what === 'bit' ? H - y0 : n(st.len * k)}" class="g-box"/>`;
    s += `<path d="M${n(xd)} ${y0 - 18}V${H}" class="jaw"/>`;
    s += grip(xd, H - 30, 'h');
    if (st.what === 'screw') {
      s += `<path d="M${x0 - 18} ${n(yl)}H${W}" class="jaw"/>`;
      s += grip(W - 30, yl, 'v');
    }
    // How to lay it, up in the space where the head goes.
    s += `<text x="${x0 + 6}" y="${Math.max(16, y0 - 46)}" class="g-tell">Head above this line,</text><text x="${x0 + 6}" y="${Math.max(31, y0 - 31)}" class="g-tell">side against the left one.</text>`;
    svg.innerHTML = s;
  }

  function drawMeasurePanel() {
    const cands = threadCandidates(st.dia).slice(0, 3).map(c => c.thread);
    const sizes = [...new Set(cands.map(t => t.system === 'inch' ? t.sizeLabel : t.size))];
    const could = st.what === 'bit'
      ? `Nearest: ${bitsNear(st.dia, 3).map(x => esc(x.bit.name)).join(', ')}`
      : st.tip === 'pointed' ? `Could be a ${esc(gaugeFor(st.dia, 'wood').label)} screw` : sizes.length ? `Could be ${fracify(sizes.join(' or '))}` : 'Off the end of the tables';
    panel.innerHTML = `
      <div class="g-row g-opts">
        <div class="seg" role="radiogroup" aria-label="What it is">
          <button type="button" role="radio" data-what="screw" aria-checked="${st.what === 'screw'}">Screw or bolt</button>
          <button type="button" role="radio" data-what="bit" aria-checked="${st.what === 'bit'}">Drill bit</button>
        </div>
        ${st.what === 'screw' ? `<div class="seg" role="radiogroup" aria-label="Its tip">
          <button type="button" role="radio" data-tip="blunt" aria-checked="${st.tip === 'blunt'}">Blunt</button>
          <button type="button" role="radio" data-tip="pointed" aria-checked="${st.tip === 'pointed'}">Pointed</button>
        </div>` : ''}
      </div>
      <div class="g-row g-meas">
        <span class="g-what">${st.what === 'bit' ? 'Across the shank' : 'Across the threads'}</span>
        <button type="button" class="g-nudge" data-d="-0.05" aria-label="Narrower">${ICON.minus}</button>
        <span class="g-read"><b>${mmText(st.dia, 2)}</b> mm <small>${decIn(st.dia / MM, 3)}″</small></span>
        <button type="button" class="g-nudge" data-d="0.05" aria-label="Wider">${ICON.plus}</button>
      </div>
      <p class="g-could">${could}</p>
      ${st.what === 'screw' ? `<div class="g-row g-meas">
        <span class="g-what">Length <small>${st.tip === 'pointed' ? 'under the head' : 'under the head (flat heads: all of it)'}</small></span>
        <button type="button" class="g-nudge" data-l="-0.5" aria-label="Shorter">${ICON.minus}</button>
        <span class="g-read"><b>${mmText(st.len, 1)}</b> mm <small>${fracText(st.len / MM, 16)}″</small></span>
        <button type="button" class="g-nudge" data-l="0.5" aria-label="Longer">${ICON.plus}</button>
      </div>` : ''}
      <div class="g-row g-end">
        <p class="g-small">Slide the red jaws until they touch.</p>
        <button type="button" class="btn primary g-next" data-go="${st.what === 'bit' || st.tip === 'pointed' ? 'name' : 'threads'}">${st.what === 'bit' || st.tip === 'pointed' ? 'Name it' : 'Threads'} ${ICON.arrow}</button>
      </div>`;
  }

  // Step 3: the combs, each spanning more than ten threads at true size.
  function drawThreads() {
    const combs = combsFor(st.dia, { more: st.more });
    if (!st.comb || !combs.find(c => c.key === st.comb)) st.comb = null;
    drawThreadsPanel(combs);
    size();
    const k = st.k, x0 = 16, span = W - 32;
    let y = 46, s = '';
    over.innerHTML = '';
    for (const c of combs) {
      const p = c.pitch * k, depth = Math.max(3, 0.62 * c.pitch * k), band = 26;
      if (y + band + 30 > H) break;
      const count = Math.floor(span / p);
      let teeth = `M${x0} ${y + band}V${y + depth}`;
      for (let i = 0; i < count; i++) teeth += `L${n(x0 + (i + 0.5) * p)} ${y}L${n(x0 + (i + 1) * p)} ${n(y + depth)}`;
      teeth += `V${y + band}Z`;
      const on = st.comb === c.key;
      const t = threadOnComb(c, st.dia);
      s += `<path d="${teeth}" class="comb"/>`;
      // Number the notches under the comb: 0, 5 and 10. By the tenth, close pitches have parted company.
      for (const i of [0, 5, 10]) {
        if (i > count) continue;
        const x = n(x0 + (i + 0.5) * p);
        s += `<path d="M${x} ${y + band + 2}v${i === 5 ? 4 : 7}" class="comb-mark"/>`;
        if (i) s += `<text x="${x}" y="${y + band + 19}" text-anchor="middle" class="comb-ten">${i}</text>`;
      }
      over.insertAdjacentHTML('beforeend', `<button type="button" class="comb-btn${on ? ' on' : ''}" data-comb="${c.key}" style="top:${y - 28}px;height:${band + 54}px" aria-pressed="${on}">
        <span><b>${fracify(t.system === 'inch' ? t.label : fullName(t))}</b> · ${esc(c.label)}${c.threads.length > 1 ? ` <small>(${c.threads.filter(x => x !== t).map(x => esc(x.label)).join(', ')} too)</small>` : ''}</span>
        <small>10 threads: ${mmText(tenThreads(c.pitch), 2)} mm</small></button>`);
      y += band + 64;
    }
    svg.innerHTML = s;
  }
  function drawThreadsPanel(combs) {
    const pick = combs.find(c => c.key === st.comb);
    panel.innerHTML = `
      <p class="g-say">Hold the threads against each comb. The one where every crest sits in a notch, right out to the 10, is it.</p>
      <div class="g-row g-end">
        <button type="button" class="btn small" data-go="measure">${ICON.back} Back</button>
        <button type="button" class="btn small" data-more>${st.more ? 'Fewer' : 'More sizes'}</button>
        <button type="button" class="btn primary g-next" data-go="name"${pick ? '' : ' disabled'}>That one ${ICON.arrow}</button>
      </div>`;
  }

  // Step 4: the name, its holes and its tools.
  function drawName() {
    let html = '';
    if (st.what === 'bit') {
      const near = bitsNear(st.dia, 4);
      const best = near[0];
      html = `<p class="g-kicker">That bit is</p>
        <h2 class="gauge-name">${bitHTML(best.bit)}</h2>
        <p class="g-facts">${esc(bitSizes(best.bit))}: ${esc(offWords(best.diff, best.bit.metric))} from the ${mmText(st.dia, 2)} mm you measured.</p>
        <p class="g-facts">Or ${near.slice(1).map(x => `<button type="button" class="bit-link" data-bit="${x.bit.id}">${bitHTML(x.bit)}</button> (${esc(offWords(x.diff, x.bit.metric))})`).join(', ')}.</p>
        <div class="row-btns"><button type="button" class="btn primary" data-bit="${best.bit.id}">What it’s for</button>
        <button type="button" class="btn" data-go="measure">Measure another</button></div>`;
    } else {
      const pointed = st.tip === 'pointed';
      let name, pick, facts;
      if (pointed) {
        const g = gaugeFor(st.dia, st.kind);
        const len = snapLength(st.len, st.kind === 'lag' && g.metric);
        name = screwName({ kind: st.kind, gauge: g, len });
        pick = { type: st.kind === 'lag' ? 'lag' : st.kind === 'sheet' ? 'sheet' : 'wood', size: g.id };
        facts = `${mmText(st.dia, 2)} mm across the threads${g.st ? ` (${g.st})` : ''}, ${lenWords(st.len, len)}.`;
      } else {
        const combs = combsFor(st.dia, { more: st.more });
        const c = combs.find(x => x.key === st.comb) || combs[0];
        const t = threadOnComb(c, st.dia);
        const heads = FS.headsFor(t);
        if (st.head && !heads.includes(st.head)) st.head = null;
        const len = snapLength(st.len, t.system === 'metric');
        name = screwName({ kind: 'machine', thread: t, len, head: st.head });
        pick = { type: 'machine', size: t.id, ...(st.head ? { head: st.head } : {}) };
        facts = `${t.system === 'inch' ? `${esc(t.sizeLabel)} ${esc(t.cls)}` : `M${t.d}${t.cls === 'fine' ? ' fine' : ''}`}: ${esc(pitchText(t))}, ${mmText(st.dia, 2)} mm across the threads, ${lenWords(st.len, len)}.`;
        st.thread = t;
      }
      const r = holesFor({ ...pick, material: pointed ? (st.kind === 'sheet' ? 'steel' : 'hardwood') : 'aluminium' });
      const owned = store.owned();
      const list = r.holes.filter(h => !h.cone && h.key !== 'plug' && h.key !== 'straight').slice(0, 4).map(h => {
        const c = chooseBit(h, owned, r.pick.material);
        const b = c.ok ? c.bit : c.usual;
        return `<li><span>${esc(h.name)}</span><span class="g-bit"><b>${b ? bitHTML(b) : '—'}</b>${c.ok ? '' : '<small>not in your bits</small>'}</span></li>`;
      }).join('');
      html = `<p class="g-kicker">It’s a</p>
        <h2 class="gauge-name">${fracName(name)}</h2>
        <p class="g-facts">${facts}</p>
        ${pointed ? `<div class="chips g-kinds" role="radiogroup" aria-label="Kind">${[['wood', 'Wood screw'], ['sheet', 'Sheet-metal screw'], ['lag', 'Lag screw']].map(([k, label]) =>
          `<button type="button" role="radio" class="chip" data-kind="${k}" aria-checked="${st.kind === k}">${typeIcon(k === 'sheet' ? 'sheet' : k, 22)}${label}</button>`).join('')}</div>`
          : `<p class="g-ask">${st.head ? 'Head' : 'What’s its head like?'}</p><div class="chips g-heads" role="radiogroup" aria-label="Head">${FS.headsFor(st.thread).map(h =>
            `<button type="button" role="radio" class="chip head" data-head="${h}" aria-checked="${st.head === h}">${headIcon(h)}${esc(st.thread.system === 'metric' && h === 'flat' ? 'Countersunk' : FS.HEADS[h].short)}</button>`).join('')}</div>`}
        <ul class="g-holes">${list}</ul>
        <ul class="g-tools">${r.tools.filter(t => t.what !== 'Washer').map(t => `<li><span>${esc(t.what)}</span><b>${fracify(t.text)}</b></li>`).join('')}</ul>
        <div class="row-btns">
          <a class="btn primary" href="${pickHash(normal(pick, pointed))}">All its holes ${ICON.arrow}</a>
          <button type="button" class="btn" data-go="measure">Measure another</button>
        </div>`;
    }
    over.innerHTML = `<div class="g-result">${html}</div>`;
    panel.innerHTML = '';
  }

  const normal = (pick, pointed) => ({ ...pick, material: pointed ? (pick.type === 'sheet' ? 'steel' : 'hardwood') : (store.pick?.material && pick.type === store.pick.type ? store.pick.material : 'aluminium') });
  const lenWords = (mm, len) => `${mmText(mm, 1)} mm long${len.standard ? '' : ' (not a usual length)'}`;
  // "1/4-20 × 1-1/2 hex bolt" with the length's fraction set properly.
  const fracName = name => esc(name).replace(/× (\d+)-(\d+)\/(\d+)/, '× $1<span class="sp">-</span><span class="fr">$2/$3</span>').replace(/× (\d+)\/(\d+)(?!-)/, '× <span class="fr">$1/$2</span>');

  function grip(x, y, dir) {
    const arrows = dir === 'v' ? `M${x} ${n(y - 9)}l-4 5h8zM${x} ${n(y + 9)}l-4 -5h8z` : `M${n(x - 9)} ${y}l5 -4v8zM${n(x + 9)} ${y}l-5 -4v8z`;
    return `<g class="grip" data-grip="${dir}"><circle cx="${n(x)}" cy="${n(y)}" r="17"/><path d="${arrows}"/></g>`;
  }

  // ---------- Dragging ----------
  // Drags move things by how far the finger moves, so a finger never has to sit on the line it's moving.
  let drag = null;
  // A finger holding the card or the screw on the glass can count as a touch, so only touches by a jaw,
  // its grip, or out past it move anything: nothing starts inside the card or the box the screw lies in.
  field.addEventListener('pointerdown', e => {
    if (st.step !== 'cal' && st.step !== 'measure') return;
    if (drag) return; // one finger at a time
    const r = field.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const { x0, y0 } = corner();
    const k = st.k;
    let what = null;
    if (st.step === 'cal') {
      const cw = CARD.short * k, ch = CARD.long * k;
      if (st.calEdge === 'long') { if (Math.abs(y - (y0 + ch)) < 70 || x > x0 + cw + 4) what = 'cal-long'; }
      else if (Math.abs(x - (x0 + cw)) < 70 || y < y0 || y > y0 + ch + 4) what = 'cal-short';
    } else {
      const xd = x0 + st.dia * k, yl = y0 + st.len * k;
      const near = (gx, gy) => Math.hypot(x - gx, y - gy) < 34;
      if (near(xd, H - 30)) what = 'dia';
      else if (st.what === 'screw' && near(W - 30, yl)) what = 'len';
      else if (y > y0 && x > xd - 8 && x < xd + 44 && (st.what === 'bit' || y < yl + 44)) what = 'dia';
      else if (st.what === 'screw' && x > x0 && y > yl - 8 && y < yl + 44) what = 'len';
    }
    if (!what) return;
    drag = { what, x, y, k: st.k, dia: st.dia, len: st.len, id: e.pointerId };
    field.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  field.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const r = field.getBoundingClientRect();
    const dx = e.clientX - r.left - drag.x, dy = e.clientY - r.top - drag.y;
    if (drag.what === 'cal-long') st.k = clampK((drag.k * CARD.long + dy) / CARD.long);
    else if (drag.what === 'cal-short') st.k = clampK((drag.k * CARD.short + dx) / CARD.short);
    else if (drag.what === 'dia') st.dia = clamp(drag.dia + dx / st.k, 0.5, maxDia());
    else st.len = clamp(drag.len + dy / st.k, 1, maxLen());
    st.step === 'cal' ? drawCal() : drawMeasure();
  });
  const end = e => { if (drag && e.pointerId === drag.id) drag = null; };
  field.addEventListener('pointerup', end);
  field.addEventListener('pointercancel', end);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const clampK = v => clamp(v, 2, 16);
  const maxDia = () => (W - corner().x0 - 24) / st.k;
  const maxLen = () => (H - corner().y0 - 10) / st.k;

  // ---------- Buttons ----------
  gauge.addEventListener('click', e => {
    const b = e.target.closest('button, a');
    if (!b) return;
    if (b.dataset.nudge) {
      // A quarter of a pixel over the card's length, or across it.
      const edge = st.calEdge === 'long' ? CARD.long : CARD.short;
      st.k = clampK(st.k + (+b.dataset.nudge * 0.25) / edge);
      drawCal();
    } else if (b.dataset.edge) { st.calEdge = b.dataset.edge; drawCal(); }
    else if (b.dataset.d) { st.dia = clamp(st.dia + +b.dataset.d, 0.5, maxDia()); drawMeasure(); }
    else if (b.dataset.l) { st.len = clamp(st.len + +b.dataset.l, 1, maxLen()); drawMeasure(); }
    else if (b.dataset.what) { st.what = b.dataset.what; drawMeasure(); }
    else if (b.dataset.tip) { st.tip = b.dataset.tip; drawMeasure(); }
    else if (b.dataset.comb) { st.comb = b.dataset.comb; drawThreads(); }
    else if (b.hasAttribute('data-more')) { st.more = !st.more; drawThreads(); }
    else if (b.dataset.head) { st.head = b.dataset.head; drawName(); }
    else if (b.dataset.kind) { st.kind = b.dataset.kind; drawName(); }
    else if (b.dataset.bit) bitSheet(b.dataset.bit);
    else if (b.dataset.go) {
      if (st.step === 'cal' && b.dataset.go === 'measure') {
        if (!plausible(st.k)) { toast('That doesn’t look like a card: try again'); return; }
        store.setScreen(st.k);
        toast('Calibrated');
      }
      if (b.dataset.go === 'threads') { st.comb = combsFor(st.dia)[0]?.key || null; st.more = false; }
      if (b.dataset.go === 'measure' && st.step === 'name') st.head = null;
      st.step = b.dataset.go;
      draw();
    }
  });

  // ---------- Zoom ----------
  // Pinching on the gauge is blocked; if the page is zoomed anyway, say so, because sizes would be wrong.
  const zoomCheck = () => { $('#gZoom', gauge).hidden = !(window.visualViewport && visualViewport.scale > 1.02); };
  const stopGesture = e => e.preventDefault();
  document.addEventListener('gesturestart', stopGesture);
  window.visualViewport?.addEventListener('resize', zoomCheck);
  const onResize = () => {
    if (st.step !== 'cal' && store.screen() && !store.screen().same) { st.step = 'cal'; }
    draw();
  };
  window.addEventListener('resize', onResize);
  draw();
  zoomCheck();

  return () => {
    document.body.classList.remove('gauge-on');
    meta.content = metaWas;
    document.removeEventListener('gesturestart', stopGesture);
    window.visualViewport?.removeEventListener('resize', zoomCheck);
    window.removeEventListener('resize', onResize);
  };
}

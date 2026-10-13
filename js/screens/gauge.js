// The screw gauge: calibrate the screen against a bank card, lay a screw on the glass and slide two jaws
// to its threads and its length, hold its threads against true-size combs, and it names itself, drawn at
// true size where it lay so the real one can be laid back on its picture.
import { store } from '../store.js';
import { CARD, plausible, guessPxPerMm, threadCandidates, combsFor, threadOnComb, tenThreads, expectedMajor, nearTwin,
  twinCall, gaugeFor, bitsNear, bitCandidates, snapLength, screwName, screwShape, fitsThread, kindFits, kindReach,
  likelyKind, pastTables } from '../identify.js';
import { holesFor, screwTools } from '../holes.js';
import * as FS from '../fasteners.js';
import { fullName, pitchText } from '../threads.js';
import { setById } from '../drills.js';
import { MM, decIn, mmText, fracText, fixed } from '../units.js';
import { pickHash, finishOf, bitForHole } from './holes.js';
import { bitSheet, knownFor } from './index.js';
import { headIcon, typeIcon, screwOnGlass, bitOnGlass } from '../draw.js';
import { $, esc, bitHTML, bitSizes, fracify, toast, ICON } from '../ui.js';

const n = x => +x.toFixed(2);
const STEPS = [['cal', 'Card'], ['measure', 'Measure'], ['threads', 'Threads'], ['name', 'Name']];
const an = s => (/^(M|8\b|11\b|18\b)/.test(s) ? 'an' : 'a'); // an M5, an 8 mm lag, a #10-32
// Past either end of the tables, it says so instead of naming the nearest thing.
const PAST = {
  blunt: { big: 'Bigger than anything in the tables: they stop at 1/2″ and M12', small: 'Smaller than anything in the tables: they start at #0-80 and M2' },
  pointed: { big: 'Bigger than any screw in the tables: lags stop at 1/2″ and 12 mm', small: 'Smaller than any screw in the tables: they start at a #2 wood screw' },
  bit: { big: 'Bigger than any twist bit in the tables: they stop at 1″', small: 'Smaller than any bit in the tables' },
};
const KINDS = [['wood', 'Wood screw', 'Wood screws'], ['sheet', 'Sheet-metal screw', 'Sheet-metal screws'], ['lag', 'Lag screw', 'Lag screws']];
const LONGEST = 160; // mm: the − and + go this far, past the glass, for a screw longer than the screen

// Each step has its own address, so the phone's Back goes back a step and Forward comes forward again.
// "?calibrate" is the Card step, as Your bits links to it.
const stepIn = h => (/[?&]calibrate\b/.test(h) ? 'cal' : (h.match(/[?&]step=(threads|name)\b/) || [])[1] || 'measure');
const hashFor = step => (step === 'cal' ? '#/gauge?calibrate' : step === 'measure' ? '#/gauge' : `#/gauge?step=${step}`);
// The measurement, kept while the page is open: Back, Forward, or coming back to the gauge from another screen
// finds the jaws where you left them.
const KEEP = ['what', 'tip', 'dia', 'len', 'more', 'comb', 'head', 'kind', 'tucked', 'reached'];
let kept = null;

export function renderGauge(main, hash = '') {
  const saved = store.screen();
  const coarse = matchMedia('(pointer: coarse)').matches;
  const phone = coarse && Math.min(screen.width, screen.height) < 600;
  const st = {
    step: 'measure',
    k: saved?.pxPerMm || guessPxPerMm({ coarse, shortSide: Math.min(screen.width, screen.height) }),
    calEdge: 'long',
    what: 'screw',          // screw or bit
    tip: 'blunt',           // blunt (machine screw or bolt) or pointed (wood, sheet-metal or lag)
    dia: 6.2, len: 25.4,    // mm
    more: false, comb: null, thread: null, head: null,
    kind: null,             // a pointed screw's kind, once picked: wood, sheet or lag
    tucked: false,          // the panel tucked away, for a screw longer than the glass
    reached: new Set(),     // the steps past Measure this measurement has got to, so Forward can go back to them
    ...kept,
  };
  st.reached = new Set(st.reached);
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
      <div class="g-field" id="gField"><svg id="gSvg" aria-hidden="true"></svg><div class="g-over" id="gOver"></div>
        <p class="g-turn" id="gTurn" hidden>Turn your phone upright: the gauge needs the long side of the screen.</p></div>
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
  const corner = () => (st.step === 'cal' ? { x0: 14, y0: st.calEdge === 'long' ? 14 : 64 } : { x0: Math.round(14 + 7 * st.k), y0: Math.round(34 + 5 * st.k) });

  // The steps along the top. Any you can go back (or on) to is a button: Card to calibrate again, Measure to
  // change the measurement. Threads is skipped for a pointed screw or a drill bit.
  function drawSteps() {
    const at = STEPS.findIndex(s => s[0] === st.step);
    const skip = st.what === 'bit' || st.tip === 'pointed';
    $('.g-steps', gauge).innerHTML = STEPS.map(([id, name], i) => {
      const skipped = id === 'threads' && skip;
      const cls = i === at ? 'now' : skipped ? 'skip' : i < at ? 'done' : '';
      const can = i !== at && !skipped && reachable(id) === id;
      return `<li class="${cls}"${i === at ? ' aria-current="step"' : ''}>${can ? `<button type="button" data-step="${id}">${name}</button>` : name}</li>`;
    }).join('');
  }

  // Where a step can go: nowhere past the Card until the screen's calibrated, and nowhere past Measure that this
  // measurement hasn't got to (Threads only for a blunt screw, and nothing for a size past the tables).
  function reachable(step) {
    if (step === 'cal' || !store.screen()?.same) return 'cal';
    if (step === 'measure' || !st.reached.has(step) || pastTables(st.dia, sort())) return 'measure';
    if (step === 'threads' && (st.what === 'bit' || st.tip === 'pointed')) return 'measure';
    return step;
  }
  // Go to a step, as a new place in the history unless it's only putting the address right.
  function go(step, { push = true } = {}) {
    const to = reachable(step);
    // Leaving the Card step without "That's it" keeps the calibration there was.
    if (st.step === 'cal' && to !== 'cal') st.k = store.screen()?.pxPerMm ?? st.k;
    st.step = to;
    kept = Object.fromEntries(KEEP.map(x => [x, st[x]]));
    const h = hashFor(to);
    if (location.hash !== h) history[push ? 'pushState' : 'replaceState'](null, '', h);
    if (to !== 'measure') gauge.classList.remove('tucked');
    draw();
  }
  // A new measurement hasn't got anywhere yet.
  const remeasured = () => st.reached.clear();

  function draw() {
    size();
    drawSteps();
    gauge.dataset.step = st.step;
    over.innerHTML = '';
    field.scrollTop = 0;
    moreBelow();
    // On its side a phone has too little glass to measure on.
    $('#gTurn', gauge).hidden = !(phone && innerWidth > innerHeight && st.step !== 'name');
    if (st.step === 'cal') drawCal({ choose: true });
    else if (st.step === 'measure') drawMeasure();
    else if (st.step === 'threads') drawThreads();
    else { svg.innerHTML = ''; drawName(); }
  }

  // Step 1: the card. Which way round it's measured is settled when the step opens (lengthways, if the card fits
  // the glass that way) or the screen changes, never under a finger: a drag or a nudge only moves the line, and
  // the line stops at the edge of the glass.
  function drawCal({ choose = false } = {}) {
    drawCalPanel();
    size();
    if (choose && !st.edgeChosen) {
      const edge = 14 + CARD.long * st.k + 30 > H ? 'short' : 'long';
      if (edge !== st.calEdge) { st.calEdge = edge; drawCalPanel(); size(); }
    }
    if (st.k > calMax()) { st.k = clampCal(st.k); drawCalPanel(); }
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
      s += `<text x="${n(x - 10)}" y="${y0 - 26}" text-anchor="end" class="g-lbl">the card’s right edge</text>`;
    }
    svg.innerHTML = s;
  }
  // How far the line goes: to the foot (or the right) of the glass, less a little. Across the card it has to get
  // near the edge (a 375-wide phone's card reaches 360), and a grip half out of sight still drags.
  const calMax = () => (st.calEdge === 'long' ? (H - 10 - corner().y0) / CARD.long : (W - 6 - corner().x0) / CARD.short);
  const clampCal = v => clamp(v, 2, Math.min(16, calMax()));
  function drawCalPanel() {
    const long = st.calEdge === 'long';
    const fits = 14 + CARD.long * st.k + 30 < field.clientHeight; // the card lengthways, on this screen
    const stuck = long && st.k >= calMax() - 0.005; // the line's at the foot of the glass and the card goes on
    panel.innerHTML = `
      ${recal ? '<p class="g-warn">This screen or its zoom has changed since you last calibrated, so do it once more.</p>' : ''}
      <p class="g-say">${long
        ? 'Lay a bank card on the glass, long side down the screen, tucked into the corner. Drag the red line to the card’s far end.'
        : 'Lay a bank card on the glass, tucked into the corner under the top line. Drag the red line to the card’s right edge.'}</p>
      <div class="g-row">
        <button type="button" class="g-nudge" data-nudge="-1" aria-label="Move the line a pixel ${long ? 'up' : 'left'}">${ICON.minus}</button>
        <span class="g-read"><b>${st.k.toFixed(2)}</b><small>pixels to the mm</small></span>
        <button type="button" class="g-nudge" data-nudge="1" aria-label="Move the line a pixel ${long ? 'down' : 'right'}">${ICON.plus}</button>
        <button type="button" class="btn primary g-next" data-go="measure">That’s it</button>
      </div>
      <p class="g-small">Any card the size of a bank card works: they’re all ${CARD.long.toFixed(2)} × ${CARD.short.toFixed(2)} mm. ${long
        ? `<span class="g-stuck${stuck ? ' on' : ''}">Card longer than the glass? <button type="button" class="link-btn" data-edge="short">Measure across it instead</button></span>`
        : fits ? '<button type="button" class="link-btn" data-edge="long">Measure its long side instead</button> (more exact)' : ''}</p>`;
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
      const x = n(x0 + mm * k), len = mm % 10 === 0 ? 10 : mm % 5 === 0 ? 7 : 4;
      t += `M${x} ${y0 - len}V${y0}`;
      if (mm % 10 === 0) lbl += `<text x="${x}" y="${y0 - 13}" text-anchor="middle" class="g-num">${mm}</text>`;
    }
    s += `<path d="${t}" class="tick"/>${lbl}`;
    s += `<rect x="${x0}" y="${y0}" width="${n(st.dia * k)}" height="${st.what === 'bit' ? H - y0 : n(Math.max(0, Math.min(st.len * k, H - y0)))}" class="g-box"/>`;
    s += `<path d="M${n(xd)} ${y0 - 18}V${H}" class="jaw"/>`;
    s += grip(xd, H - 30, 'h');
    if (st.what === 'screw') {
      s += `<path d="M${x0 - 18} ${n(yl)}H${W}" class="jaw"/>`;
      s += grip(W - 30, yl, 'v');
    }
    // How to lay it, up in the space where the head goes. A flat (countersunk) head is measured overall, so its
    // top goes on the line; every other head sits above it, measured from under the head.
    const tell = st.what === 'bit'
      ? ['Lay the bit’s shank against the left line,', 'then close the red jaw on it.']
      : ['Head above this line (a flat head: its top on it),', 'side on the left line, then close the red jaws.'];
    s += `<text x="${x0 + 6}" y="15" class="g-tell">${tell[0]}</text><text x="${x0 + 6}" y="30" class="g-tell">${tell[1]}</text>`;
    svg.innerHTML = s;
  }

  function drawMeasurePanel() {
    const next = st.what === 'bit' || st.tip === 'pointed' ? 'name' : 'threads';
    const past = pastTables(st.dia, sort());
    const nextBtn = `<button type="button" class="btn primary g-next" data-go="${next}"${past ? ' disabled' : ''}>${next === 'name' ? 'Name it' : 'Threads'} ${ICON.arrow}</button>`;
    gauge.classList.toggle('tucked', st.tucked);
    if (st.tucked) {
      // Tucked away: just the two sizes, so the glass runs nearly to the bottom of the screen.
      panel.innerHTML = `<div class="g-row g-end g-tuck">
        <p class="g-mini"><b>${mmText(st.dia, 2)}</b> mm across${st.what === 'screw' ? ` · <b>${mmText(st.len, 1)}</b> mm long` : ''}</p>
        <button type="button" class="btn small" data-tuck>Show all</button>${nextBtn}</div>`;
      return;
    }
    const could = couldBe(past);
    // Run out of glass for a long screw? The panel can tuck itself away.
    const atEnd = st.what === 'screw' && st.len >= maxLen() - 1;
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
      ${st.what === 'screw' ? `<div class="g-row g-meas">
        <span class="g-what">Length <small>under the head;<br>a flat head, overall</small></span>
        <button type="button" class="g-nudge" data-l="-0.5" aria-label="Shorter">${ICON.minus}</button>
        <span class="g-read"><b>${mmText(st.len, 1)}</b> mm <small>${inchLen(st.len)}</small></span>
        <button type="button" class="g-nudge" data-l="0.5" aria-label="Longer">${ICON.plus}</button>
      </div>` : ''}
      ${atEnd ? '<p class="g-small">Longer than the glass? <button type="button" class="link-btn" data-tuck>Tuck this panel away</button> for more.</p>' : ''}
      <div class="g-row g-end">
        <p class="g-could">${could}</p>
        ${nextBtn}
      </div>`;
  }

  // A length in inches to the nearest 16th, the way a tape reads, and "≈" when the 16th is further off than a
  // pixel can tell: 12.7 mm is 1/2″, 12 mm about 1/2″.
  const inchLen = mm => `${Math.abs(Math.round(mm / MM * 16) / 16 * MM - mm) > 1 / st.k ? '≈ ' : ''}${fracText(mm / MM, 16)}″`;

  // What's being measured, for the tables it's looked up in: a drill bit, or a blunt or pointed screw.
  const sort = () => (st.what === 'bit' ? 'bit' : st.tip);
  // A pointed screw's kind: the one picked, if this size comes in it, or the likeliest for the size.
  const kindNow = () => (st.kind && kindFits(st.kind, st.dia) ? st.kind : likelyKind(st.dia));

  // What the size could be, in a few words, or that nothing in the tables comes near it.
  function couldBe(past) {
    if (past) return PAST[sort()][past];
    if (st.what === 'bit') return `Nearest: ${bitsNear(st.dia, 3).map(x => esc(x.bit.name)).join(', ')}`;
    if (st.tip === 'pointed') {
      const w = kindFits('wood', st.dia) && gaugeFor(st.dia, 'wood'), l = kindFits('lag', st.dia) && gaugeFor(st.dia, 'lag');
      if (w && l) return `Could be a ${esc(w.label)} wood screw or ${an(l.label)} ${fracify(l.label)} lag`;
      return w ? `Could be a ${esc(w.label)} wood screw` : `Could be ${an(l.label)} ${fracify(l.label)} lag screw`;
    }
    const label = t => (t.system === 'inch' ? t.sizeLabel : t.size);
    const sizes = [...new Set(threadCandidates(st.dia).slice(0, 3).map(c => label(c.thread)))];
    if (sizes.length) return `Could be ${fracify(sizes.join(' or '))}`;
    // In a gap between the sizes in the tables (6.8 mm, say): the nearest either side.
    const near = [...new Set(combsFor(st.dia).flatMap(c => c.threads).map(label))].slice(0, 2);
    return `Between sizes: nearest ${fracify(near.join(' and '))}`;
  }

  // Step 3: the combs, each spanning more than ten threads at true size. Every one is drawn: on this step the
  // glass scrolls, so a short screen (a phone with its browser's bars showing) still reaches them all.
  const COMB = { top: 46, band: 26, gap: 64 };
  const combTop = i => COMB.top + i * (COMB.band + COMB.gap);
  function drawThreads() {
    const combs = combsFor(st.dia, { more: st.more });
    if (!st.comb || !combs.find(c => c.key === st.comb)) st.comb = null;
    const scrolled = field.scrollTop;
    drawThreadsPanel(combs);
    size();
    const k = st.k, x0 = 16, span = W - 32, band = COMB.band;
    let s = '';
    over.innerHTML = '';
    combs.forEach((c, ci) => {
      const y = combTop(ci);
      const p = c.pitch * k, depth = Math.max(3, 0.62 * c.pitch * k);
      const count = Math.floor(span / p);
      let teeth = `M${x0} ${y + band}V${y + depth}`;
      for (let i = 0; i < count; i++) teeth += `L${n(x0 + (i + 0.5) * p)} ${y}L${n(x0 + (i + 1) * p)} ${n(y + depth)}`;
      teeth += `V${y + band}Z`;
      const on = st.comb === c.key;
      const t = threadOnComb(c, st.dia);
      s += `<path d="${teeth}" class="comb"/>`;
      // Number the notches under the comb: 0, 5 and 10. By the tenth, close pitches have parted company.
      // On a fine comb the 5 would crowd the 10, so it keeps its tick and loses its number.
      for (const i of [0, 5, 10]) {
        if (i > count) continue;
        const x = n(x0 + (i + 0.5) * p);
        s += `<path d="M${x} ${y + band + 2}v${i === 5 ? 4 : 7}" class="comb-mark"/>`;
        if (i === 10 || (i === 5 && 5 * p >= 24)) s += `<text x="${x}" y="${y + band + 19}" text-anchor="middle" class="comb-ten">${i}</text>`;
      }
      over.insertAdjacentHTML('beforeend', `<button type="button" class="comb-btn${on ? ' on' : ''}" data-comb="${c.key}" style="top:${y - 28}px;height:${band + 54}px" aria-pressed="${on}">
        <span><b>${fracify(t.system === 'inch' ? t.label : fullName(t))}</b> · ${esc(c.label)}${c.threads.length > 1 ? ` <small>(${c.threads.filter(x => x !== t).map(x => esc(x.label)).join(', ')} too)</small>` : ''}</span>
        <small>10 threads: ${mmText(tenThreads(c.pitch), 2)}\u00a0mm</small></button>`);
    });
    const tall = Math.max(H, combTop(combs.length - 1) + band + 34);
    svg.setAttribute('height', tall);
    svg.setAttribute('viewBox', `0 0 ${W} ${tall}`);
    svg.innerHTML = s;
    field.scrollTop = scrolled;
    moreBelow();
  }
  // A fade at the foot of the glass while there are combs further down.
  const moreBelow = () => gauge.toggleAttribute('data-below', st.step === 'threads' && field.scrollTop + field.clientHeight < field.scrollHeight - 4);
  field.addEventListener('scroll', moreBelow, { passive: true });
  const smooth = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  function drawThreadsPanel(combs) {
    const pick = combs.find(c => c.key === st.comb);
    // Some pitches are too close for any comb (M5 × 0.8 and #10-32, M2.5 and #2-56): only the size tells them
    // apart, so say which one the size points to.
    let twin = '';
    if (pick) {
      const other = nearTwin(combs, pick);
      if (other) {
        const a = threadOnComb(pick, st.dia), b = threadOnComb(other, st.dia);
        const call = twinCall(a, b, st.dia);
        const nm = t => `${t.system === 'metric' ? 'an' : 'a'} ${esc(shortName(t))}`; // an M5, a #10-32
        twin = `<p class="g-warn">${esc(fullName(a))} and ${esc(fullName(b))} have all but the same pitch, so the size decides: ${nm(a)} measures about ${fixed(expectedMajor(a), 2)}\u00a0mm across its threads, ${nm(b)} about ${fixed(expectedMajor(b), 2)}. You measured ${fixed(st.dia, 2)}: ${call.sure
          ? `<b>that’s the ${esc(shortName(call.thread))}</b>.`
          : `<b>a shade nearer the ${esc(shortName(call.thread))}</b>. A nut you know will settle it.`}</p>`;
      }
    }
    panel.innerHTML = `
      ${twin}
      <p class="g-say">Hold the threads against each comb. The one where every crest sits in a notch, right out to the 10, is it.</p>
      <div class="g-row g-end">
        <button type="button" class="btn small" data-go="measure">${ICON.back} Back</button>
        ${st.more || combsFor(st.dia, { more: true }).length > combs.length ? `<button type="button" class="btn small" data-more>${st.more ? 'Fewer' : 'More sizes'}</button>` : ''}
        <button type="button" class="btn primary g-next" data-go="name"${pick ? '' : ' disabled'}>That one ${ICON.arrow}</button>
      </div>`;
  }

  // The thread a comb and a size point to. Twins no comb can part go by the size.
  function namedThread() {
    const combs = combsFor(st.dia, { more: st.more });
    const c = combs.find(x => x.key === st.comb) || combs[0];
    const t = threadOnComb(c, st.dia);
    const twin = nearTwin(combs, c);
    if (!twin) return { t };
    const other = threadOnComb(twin, st.dia);
    const call = twinCall(t, other, st.dia);
    return { t: call.thread, twin: call.thread === t ? other : t, sure: call.sure };
  }

  // Step 4: the name, drawn at true size where it lay, then its holes and its tools.
  function drawName() {
    const k = st.k, { x0, y0 } = corner();
    let drawing, label, details, reach;
    if (st.what === 'bit') ({ drawing, label, details } = nameBit(k, x0, y0));
    else ({ drawing, label, details, reach } = nameScrew(k, x0, y0));
    // The name beside the drawing (clear of the widest head it might get), or under it when the screen's
    // too narrow for both.
    let lx = Math.ceil(Math.max(drawing.right, reach || 0) + 18);
    const below = W - lx - 16 < 170;
    if (below) lx = 16;
    const glassH = Math.ceil(drawing.bottom + 24);
    const fenceTo = below ? W : lx - 12;
    over.innerHTML = `<div class="g-result" style="--lx:${lx}px">
      <div class="g-glass" style="min-height:${glassH}px">
        <svg class="g-draw" width="${W}" height="${glassH}" aria-hidden="true"><path class="rail"/><path class="fence faint"/>${drawing.svg}</svg>
        <div class="g-label" style="margin-left:${lx}px;padding-top:${below ? glassH + 10 : Math.max(12, y0 - 6)}px">${label}
          <p class="g-lay">Lay it on its drawing: the two should match.</p></div>
      </div>
      <div class="g-details">${details}</div>
    </div>`;
    // The fences run the whole height of the glass, which the name beside the drawing may have stretched;
    // with the name under the drawing they stop above it.
    const g = $('.g-glass', over), d = $('.g-draw', over), h = below ? glassH : Math.max(glassH, g.offsetHeight);
    d.setAttribute('height', h);
    $('.rail', d).setAttribute('d', `M0 0H${W}V${y0}H${x0}V${h}H0Z`);
    $('.fence', d).setAttribute('d', `M${x0} ${y0}H${fenceTo}M${x0} ${y0}V${h}`);
    panel.innerHTML = '';
  }

  function nameBit(k, x0, y0) {
    const owned = store.owned();
    const gone = store.missingInOwned();
    const missing = new Set(gone.map(m => m.slice(m.indexOf(':') + 1)));
    const cands = bitCandidates(st.dia, 1 / k, { owned, missing });
    const b = cands[0].bit;
    const others = cands.slice(1).sort((x, y) => Math.abs(x.diff) - Math.abs(y.diff)).slice(0, 3);
    const link = x => `<button type="button" class="bit-link" data-bit="${x.bit.id}">${bitHTML(x.bit)}</button>`;
    const list = xs => (xs.length > 1 ? `${xs.slice(0, -1).map(link).join(', ')} or ${link(xs.at(-1))}` : link(xs[0]));
    const goneFrom = gone.find(m => m.endsWith(`:${b.id}`));
    const set = goneFrom && setById(goneFrom.slice(0, goneFrom.indexOf(':')));
    const known = knownFor(b.id);
    const own = set ? `<p class="g-own">Your ${esc(b.name)} went missing from the ${esc(set.name.toLowerCase())} case. Is this it? <button type="button" class="link-btn" data-putback="${set.id}" data-id="${b.id}">Put it back</button></p>`
      : owned.has(b.id) ? `<p class="g-own mine">${ICON.ok} In your bits.</p>`
        : `<p class="g-own">Not in your bits. <button type="button" class="link-btn" data-addloose="${b.id}">Add it as a loose bit</button></p>`;
    return {
      drawing: bitOnGlass(b, { k, x0, y0, finish: finishOf(b), shank: 14, flutes: 22 }),
      label: `<p class="g-kicker">That bit is</p><h2 class="gauge-name">${bitHTML(b)}</h2><p class="g-facts">${esc(bitSizes(b))}</p>
        <p class="g-facts">You measured ${mmText(st.dia, 2)}\u00a0mm. ${others.length
          ? `A pixel on this screen is ${mmText(1 / k, 2)}\u00a0mm, so it could also be ${list(others)}.`
          : 'Nothing else is within a pixel of that.'}</p>
        ${own}`,
      // What it's known for, right under its name: the rows that lead its sheet, which has the rest.
      details: `${known ? `<section class="g-list" aria-label="What it’s for"><h3>${known.title}</h3><ul class="g-uses">${known.rows}</ul></section>`
          : '<p class="g-small g-none">Nothing in the tables calls for this size.</p>'}
        <div class="row-btns">${known ? `<button type="button" class="btn primary" data-bit="${b.id}">Everything it’s for</button>` : ''}
        <button type="button" class="btn" data-go="measure">Measure another</button></div>`,
    };
  }

  function nameScrew(k, x0, y0) {
    const pointed = st.tip === 'pointed';
    let name, pick, facts, shape, metric, twinNote = '';
    const kind = kindNow();
    if (pointed) {
      const g = gaugeFor(st.dia, kind);
      metric = !!g.metric;
      const len = snapLength(st.len, kind === 'lag' && g.metric);
      name = screwName({ kind, gauge: g, len });
      pick = { type: kind, size: g.id };
      facts = `You measured ${mmText(st.dia, 2)}\u00a0mm across the threads${g.st ? ` (${esc(g.st)} in metric)` : ''}, ${lenWords(st.len, len)}.`;
      shape = screwShape({ kind, gauge: g, len });
    } else {
      const { t, twin, sure } = namedThread();
      const heads = FS.headsFor(t);
      if (st.head && !heads.includes(st.head)) st.head = null;
      const len = snapLength(st.len, t.system === 'metric');
      name = screwName({ kind: 'machine', thread: t, len, head: st.head });
      pick = { type: 'machine', size: t.id, ...(st.head ? { head: st.head } : {}) };
      facts = `${t.system === 'inch' ? `${esc(t.sizeLabel)} ${esc(t.cls)}` : `M${t.d}${t.cls === 'fine' ? ' fine' : ''}`}, ${esc(pitchText(t))}. You measured ${mmText(st.dia, 2)}\u00a0mm across the threads, ${lenWords(st.len, len)}.`;
      if (twin) twinNote = `<p class="g-twin">${esc(fullName(twin))} has all but the same pitch, and the size you measured ${sure ? 'says' : 'leans to'} ${esc(shortName(t))}${sure ? '' : ': a nut you know will settle it'}.</p>`;
      // Between the sizes in the tables, the nearest thread is a guess, and it says so.
      if (!fitsThread(t, st.dia)) {
        const off = st.dia - expectedMajor(t);
        twinNote += `<p class="g-twin">${an(shortName(t)) === 'an' ? 'An' : 'A'} ${esc(shortName(t))} measures about ${fixed(expectedMajor(t), 2)}\u00a0mm across its threads, ${fixed(Math.abs(off), 2)}\u00a0mm ${off > 0 ? 'less' : 'more'} than this one. Check the jaw: it may be a size the tables don’t have.</p>`;
      }
      st.thread = t;
      metric = t.system === 'metric';
      shape = screwShape({ kind: 'machine', thread: t, len, head: st.head });
    }
    const r = holesFor({ ...pick, material: pointed ? (kind === 'sheet' ? 'steel' : 'hardwood') : 'aluminium' });
    // A loose bolt's tools are everything it takes, its nut and its tap too, not only what a tapped hole needs.
    const tools = (pointed ? r.tools : screwTools(st.thread, st.head)).filter(t => t.what !== 'Washer');
    // Each hole in the bit the Holes screen would give it: yours, or with none ticked, the usual size.
    const owned = store.owned();
    const holes = r.holes.filter(h => !h.cone && h.key !== 'plug' && h.key !== 'straight').slice(0, 4).map(h => {
      const c = bitForHole(h, owned, r.pick.material, metric);
      const note = c.near ? `a hair ${c.near}` : c.ok ? '' : 'not in your bits';
      return `<li><span>${esc(h.name)}</span><span class="g-bit"><b>${c.show ? bitHTML(c.show) : '—'}</b>${note ? `<small>${note}</small>` : ''}</span></li>`;
    }).join('');
    const chooser = pointed
      // A kind that doesn't come in this size is shown but marked off; a tap says why.
      ? `<p class="g-ask">Which kind is it?</p><div class="chips g-kinds" role="radiogroup" aria-label="Kind">${KINDS.map(([kd, lbl]) => {
        const ok = kindFits(kd, st.dia);
        return `<button type="button" role="radio" class="chip${ok ? '' : ' off'}" data-kind="${kd}" aria-checked="${kind === kd}"${ok ? '' : ' aria-disabled="true"'}>${typeIcon(kd, 22)}${lbl}</button>`;
      }).join('')}</div>`
      : `<p class="g-ask">${st.head ? 'Head' : 'What’s its head like?'}</p><div class="chips g-heads" role="radiogroup" aria-label="Head">${FS.headsFor(st.thread).map(h =>
        `<button type="button" role="radio" class="chip head" data-head="${h}" aria-checked="${st.head === h}">${headIcon(h)}${esc(st.thread.system === 'metric' && h === 'flat' ? 'Countersunk' : FS.HEADS[h].short)}</button>`).join('')}</div>`;
    // Keep the name clear of the widest head this thread comes with, so picking one doesn't shove it along.
    const reach = pointed ? 0 : x0 + shape.d / 2 * k + Math.max(...FS.headsFor(st.thread).map(h => {
      const hs = FS.headShape(st.thread, h);
      return (hs.kind === 'hex' ? hs.af / Math.sqrt(3) : hs.dia / 2) * k;
    }));
    return {
      reach,
      drawing: screwOnGlass(shape, { k, x0, y0 }),
      label: `<p class="g-kicker">It’s ${an(name)}</p><h2 class="gauge-name">${fracName(name)}</h2><p class="g-facts">${facts}</p>${twinNote}`,
      details: `${chooser}
        <section class="g-list" aria-label="Holes"><h3>Holes</h3>${owned.size ? '' : `<p class="g-small g-usual">No bits ticked, so these are the usual sizes. <button type="button" class="link-btn" data-act="bits">Your bits</button></p>`}<ul class="g-holes">${holes}</ul></section>
        <section class="g-list" aria-label="Tools"><h3>Tools</h3><ul class="g-tools">${tools.map(t => `<li><span>${esc(t.what)}</span><b>${fracify(t.text)}</b></li>`).join('')}</ul></section>
        <div class="row-btns">
          <a class="btn primary" href="${pickHash(normal(pick, pointed))}">All its holes ${ICON.arrow}</a>
          <button type="button" class="btn" data-go="measure">Measure another</button>
        </div>`,
    };
  }

  const shortName = t => (t.system === 'inch' ? t.label : t.size); // #10-32, M5
  // Why a kind is marked off for this size: "Lag screws start at 6 mm: this one’s thinner."
  function notThisKind(kind) {
    const r = kindReach(kind), plural = KINDS.find(x => x[0] === kind)[2];
    return st.dia > r.hi ? `${plural} stop at ${r.last.label}: this one’s fatter.` : `${plural} start at ${r.first.label}: this one’s thinner.`;
  }
  const normal = (pick, pointed) => ({ ...pick, material: pointed ? (pick.type === 'sheet' ? 'steel' : 'hardwood') : (store.pick?.material && pick.type === store.pick.type ? store.pick.material : 'aluminium') });
  const lenWords = (mm, len) => `${mmText(mm, 1)}\u00a0mm long${len.standard ? '' : ' (not a usual length)'}`;
  // "1/4-20 × 1-1/2 hex bolt" with the length's fraction set properly, and a lag's size too (5/16″, as on the
  // Holes screen). The thread's name and each "× size" stay whole, so it breaks as "1/4-20 × 1½ / hex bolt",
  // never "1/4- / 20" or "1 / ½".
  const fracName = name => esc(name)
    .replace(/^(\d+)\/(\d+)″/, '<span class="nw"><span class="fr">$1/$2</span>″</span>')
    .replace(/^(\d+) mm/, '<span class="nw">$1 mm</span>')
    .replace(/^(?!<)(\S+)/, '<span class="nw">$1</span>')
    .replace(/× ([\d.]+)(?![\d./-])/g, '<span class="nw">× $1</span>')
    .replace(/× (\d+)-(\d+)\/(\d+)/, '<span class="nw">× $1<span class="sp">-</span><span class="fr">$2/$3</span></span>')
    .replace(/× (\d+)\/(\d+)/, '<span class="nw">× <span class="fr">$1/$2</span></span>');

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
    drag = { what, x, y, k: st.k, dia: st.dia, len: st.len, id: e.pointerId, atEnd: false };
    field.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  field.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const r = field.getBoundingClientRect();
    const dx = e.clientX - r.left - drag.x, dy = e.clientY - r.top - drag.y;
    if (drag.what === 'cal-long') st.k = clampCal((drag.k * CARD.long + dy) / CARD.long);
    else if (drag.what === 'cal-short') st.k = clampCal((drag.k * CARD.short + dx) / CARD.short);
    else if (drag.what === 'dia') { st.dia = clamp(drag.dia + dx / st.k, 0.5, maxDia()); remeasured(); }
    else st.len = clamp(drag.len + dy / st.k, 1, Math.max(maxLen(), drag.len));
    st.step === 'cal' ? drawCal() : drawMeasure();
  });
  const end = e => { if (drag && e.pointerId === drag.id) drag = null; };
  field.addEventListener('pointerup', end);
  field.addEventListener('pointercancel', end);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const maxDia = () => (W - corner().x0 - 24) / st.k;
  const maxLen = () => (H - corner().y0 - 10) / st.k;

  // ---------- Buttons ----------
  gauge.addEventListener('click', e => {
    const b = e.target.closest('button, a');
    if (!b) return;
    if (b.dataset.nudge) {
      // A whole pixel over the card's length, or across it: enough to see the line move.
      const edge = st.calEdge === 'long' ? CARD.long : CARD.short;
      st.k = clampCal(st.k + +b.dataset.nudge / edge);
      drawCal();
    } else if (b.dataset.edge) { st.calEdge = b.dataset.edge; st.edgeChosen = true; drawCal(); }
    else if (b.dataset.d) { st.dia = clamp(st.dia + +b.dataset.d, 0.5, maxDia()); remeasured(); drawMeasure(); }
    else if (b.dataset.l) { st.len = clamp(st.len + +b.dataset.l, 1, LONGEST); drawMeasure(); }
    else if (b.hasAttribute('data-tuck')) { st.tucked = !st.tucked; drawMeasure(); }
    else if (b.dataset.what) { st.what = b.dataset.what; remeasured(); drawSteps(); drawMeasure(); }
    else if (b.dataset.tip) { st.tip = b.dataset.tip; remeasured(); drawSteps(); drawMeasure(); }
    else if (b.dataset.step) go(b.dataset.step);
    else if (b.dataset.comb) { st.comb = b.dataset.comb; drawThreads(); }
    else if (b.hasAttribute('data-more')) {
      const had = combsFor(st.dia).length;
      st.more = !st.more;
      drawThreads();
      // Show what changed: the first new comb if it's out of sight, or back to the top for fewer.
      const y = combTop(had);
      if (!st.more) field.scrollTo({ top: 0, behavior: smooth });
      else if (y + COMB.band + 30 > field.scrollTop + field.clientHeight) field.scrollTo({ top: y - 40, behavior: smooth });
    }
    else if (b.dataset.head) { st.head = b.dataset.head; drawName(); }
    else if (b.dataset.kind) {
      if (b.getAttribute('aria-disabled') === 'true') { toast(notThisKind(b.dataset.kind)); return; }
      st.kind = b.dataset.kind;
      drawName();
    }
    else if (b.dataset.putback) {
      const bit = b.dataset.id;
      store.setMissing(b.dataset.putback, bit, false);
      toast(`Back in the ${setById(b.dataset.putback).name.toLowerCase()} case`); // the store's change redraws the name
    } else if (b.dataset.addloose) { store.addLoose(b.dataset.addloose); toast('Added to your bits'); }
    else if (b.dataset.act === 'bits') document.dispatchEvent(new CustomEvent('pilot:bits'));
    else if (b.dataset.bit) bitSheet(b.dataset.bit);
    else if (b.dataset.go) {
      const to = b.dataset.go;
      if (st.step === 'cal' && to === 'measure') {
        if (!plausible(st.k)) { toast('That doesn’t look like a card: try again'); return; }
        store.setScreen(st.k);
        toast('Calibrated');
      }
      if (to === 'threads') { st.comb = combsFor(st.dia)[0]?.key || null; st.more = false; }
      if (to === 'measure' && st.step === 'name') st.head = null;
      if (to === 'threads' || to === 'name') st.reached.add(to);
      go(to);
    }
  });

  // Back and Forward between the steps: the address changes, the gauge goes to that step.
  const onHash = () => {
    const want = stepIn(location.hash);
    if (want === st.step) return;
    go(want, { push: false });
  };
  window.addEventListener('hashchange', onHash);

  // ---------- Zoom ----------
  // Pinching on the gauge is blocked; if the page is zoomed anyway, say so, because sizes would be wrong.
  const zoomCheck = () => { $('#gZoom', gauge).hidden = !(window.visualViewport && visualViewport.scale > 1.02); };
  const stopGesture = e => e.preventDefault();
  document.addEventListener('gesturestart', stopGesture);
  window.visualViewport?.addEventListener('resize', zoomCheck);
  const onResize = () => {
    if (st.step !== 'cal' && store.screen() && !store.screen().same) go('cal', { push: false });
    else draw();
  };
  window.addEventListener('resize', onResize);
  // Bits ticked or put back while the name's showing (in Your bits, say) change its answers.
  const offStore = store.onChange(() => { if (st.step === 'name') drawName(); });
  go(stepIn(hash), { push: false });
  zoomCheck();

  return () => {
    kept = Object.fromEntries(KEEP.map(x => [x, st[x]]));
    window.removeEventListener('hashchange', onHash);
    document.body.classList.remove('gauge-on');
    meta.content = metaWas;
    document.removeEventListener('gesturestart', stopGesture);
    window.visualViewport?.removeEventListener('resize', zoomCheck);
    window.removeEventListener('resize', onResize);
    offStore();
  };
}

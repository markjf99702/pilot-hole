// The page: which screen goes with which address, the header, the sheets for a bit and for your bits, and going offline.
import { store } from './store.js';
import { renderHoles, pickFromHash } from './screens/holes.js';
import { renderIndex, bitSheet } from './screens/index.js';
import { renderGauge } from './screens/gauge.js';
import { yourBitsSheet } from './screens/bits.js';
import { DEFS } from './draw.js';
import { $, $$, closeSheet } from './ui.js';

const main = document.getElementById('app');
let cleanup = null;
let current = '';
let lastHash = '#/';
window.pilotHole = { prev: '#/' };

const SCREENS = {
  holes: { title: 'Pilot Hole', render: h => renderHoles(main, pickFromHash(h)) },
  index: { title: 'Drill index · Pilot Hole', render: () => renderIndex(main) },
  gauge: { title: 'Screw gauge · Pilot Hole', render: h => renderGauge(main, { calibrate: /[?&]calibrate/.test(h) }) },
};

function screenOf(hash) {
  const id = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return SCREENS[id] ? id : 'holes';
}

function route() {
  const id = screenOf(location.hash);
  // Changing the pick on the Holes screen rewrites the address; that's not a new screen,
  // but a link to another fastener (from a bit's sheet, say) draws it afresh.
  if (id === current && id === 'holes' && cleanup && !pickFromHash(location.hash)) return;
  cleanup?.();
  cleanup = null;
  if (current && current !== 'gauge') window.pilotHole.prev = lastHash;
  current = id;
  document.body.dataset.screen = id;
  document.title = SCREENS[id].title;
  $$('.tabs a').forEach(a => a.setAttribute('aria-current', a.dataset.tab === id ? 'page' : 'false'));
  closeSheet();
  cleanup = SCREENS[id].render(location.hash) || null;
  window.scrollTo(0, 0);
}
// Remember where you were, so closing the gauge goes back there.
window.addEventListener('hashchange', () => { if (screenOf(location.hash) !== 'gauge') lastHash = location.hash || '#/'; });

document.body.insertAdjacentHTML('afterbegin', DEFS);
$('#bitsBtn').addEventListener('click', () => yourBitsSheet());
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); }); // a tap outside closes it
document.addEventListener('pilot:bit', e => bitSheet(e.detail));
document.addEventListener('pilot:bits', () => yourBitsSheet());
window.addEventListener('hashchange', route);
route();

// For the tests.
Object.assign(window.pilotHole, { store, route });

if ('serviceWorker' in navigator && !('single' in document.documentElement.dataset) && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

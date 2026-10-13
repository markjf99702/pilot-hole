// What's kept in this browser: the bit sets you own, bits gone missing, loose bits, your last pick,
// and this screen's calibration. The bits can be saved to a file and loaded on another device.
import { ownedBits, setById, bitById, DEFAULT_SETS } from './drills.js';

const KEY = 'pilot-hole.v1';
const SCREEN = 'pilot-hole.screen'; // per device, so it isn't in the saved file

const fresh = () => ({ v: 1, sets: [...DEFAULT_SETS], missing: [], loose: [], pick: null });

function clean(d) {
  const out = fresh();
  if (!d || typeof d !== 'object') return out;
  if (Array.isArray(d.sets)) out.sets = d.sets.filter(id => setById(id));
  if (Array.isArray(d.missing)) out.missing = d.missing.filter(m => typeof m === 'string' && setById(m.split(':')[0]));
  if (Array.isArray(d.loose)) out.loose = [...new Set(d.loose.filter(id => bitById(id)))];
  if (d.pick && typeof d.pick === 'object') out.pick = d.pick;
  return out;
}

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window or full: it still works for this visit */ }
}

let state = clean(read(KEY));
let owned = null;
const listeners = new Set();
function changed() {
  owned = null;
  write(KEY, state);
  listeners.forEach(fn => fn());
}

export const store = {
  get sets() { return state.sets; },
  get missing() { return state.missing; },
  get loose() { return state.loose; },
  get pick() { return state.pick; },
  owned() { return (owned ||= ownedBits(state)); },
  has: id => store.owned().has(id),
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  setSet(id, on) {
    const has = state.sets.includes(id);
    if (on && !has) state.sets.push(id);
    if (!on && has) state.sets = state.sets.filter(x => x !== id);
    changed();
  },
  isMissing: (setId, bitId) => state.missing.includes(`${setId}:${bitId}`),
  setMissing(setId, bitId, gone) {
    const key = `${setId}:${bitId}`;
    state.missing = state.missing.filter(m => m !== key);
    if (gone) state.missing.push(key);
    changed();
  },
  addLoose(id) { if (bitById(id) && !state.loose.includes(id)) { state.loose.push(id); changed(); } },
  removeLoose(id) { state.loose = state.loose.filter(x => x !== id); changed(); },
  setPick(pick) { state.pick = pick; write(KEY, state); },

  // A file with the bits in it, for another device or a backup.
  exportData() {
    return { app: 'pilot-hole', v: 1, saved: new Date().toISOString(), sets: state.sets, missing: state.missing, loose: state.loose };
  },
  importData(d) {
    if (!d || d.app !== 'pilot-hole' || !Array.isArray(d.sets)) throw new Error('That file isn’t a Pilot Hole file.');
    state = { ...clean(d), pick: state.pick };
    changed();
  },
  clearAll() {
    state = fresh();
    try { localStorage.removeItem(SCREEN); } catch { /* nothing to clear */ }
    changed();
  },

  // This screen's size, from the bank card. It only counts on the same screen at the same zoom.
  screen() {
    const s = read(SCREEN);
    if (!s || !(s.pxPerMm > 0)) return null;
    const now = screenKey();
    return { ...s, same: s.key === now };
  },
  setScreen(pxPerMm) { write(SCREEN, { pxPerMm, key: screenKey(), at: Date.now() }); },
};

// What would make an old calibration wrong: another screen, or the page zoomed differently.
export function screenKey() {
  if (typeof window === 'undefined') return '';
  const w = Math.min(screen.width, screen.height), h = Math.max(screen.width, screen.height);
  return `${w}x${h}@${Math.round((window.devicePixelRatio || 1) * 100) / 100}`;
}

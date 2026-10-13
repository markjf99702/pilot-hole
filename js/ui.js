// Pieces every screen uses: escaping, bit names set as real fractions, sizes in both units, the sheet and toasts.
import { MM, fracHTML, decIn, mmText, offWords } from './units.js';

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// A bit's name with its fraction set properly: 7/64″ as a real fraction, #36, F, 2.5 mm.
export function bitHTML(b) {
  if (!b) return '';
  if (b.kind === 'frac' || (b.kind === 'forstner' && !b.metric)) return `${fracHTML(b.in, b.kind === 'frac' ? 64 : 8)}″`;
  if (b.metric) return `${esc(b.short)}<small>\u00a0mm</small>`;
  return esc(b.name);
}

// Any size in both units, inches first for inch work: 0.1250″ · 3.18 mm.
export function sizeText(mm, metricFirst = false) {
  const i = `${decIn(mm / MM, 4)}″`, m = `${mmText(mm)}\u00a0mm`;
  return metricFirst ? `${m} · ${i}` : `${i} · ${m}`;
}
export const bitSizes = b => sizeText(b.mm, b.metric);

// How far a bit is from the size wanted (exact, 0.0035″ big, 0.05 mm small) lives with the other units.
export { offWords };

// Fractions inside any text: 1/4-20 stays as written, but "1-1/2″" can be set as a real fraction. A number keeps
// its unit on its line too, and a range its two ends, so a note never breaks "20.5–23.5 mm" anywhere.
export const fracify = s => esc(s).replace(/(\d+)\/(\d+)(?=″)/g, '<span class="fr">$1/$2</span>')
  .replace(/(\d) (mm|°C)\b/g, '$1\u00a0$2').replace(/(\d)–(?=\d)/g, '$1–\u2060');

// The one-file copy (scripts/build.mjs) has no offline copy and can't be installed, and shown inside another
// page, as the playable copy is, it can't start a download either.
export const SITE = 'https://junkdrawer.works/pilot-hole/';
export const isSingle = () => 'single' in document.documentElement.dataset;
export function canDownload() {
  if (!isSingle()) return true;
  try { return window.top === window.self; } catch { return false; }
}

let toastTimer;
export function toast(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// The sheet that slides up: a bit's uses, your bits, picking a fastener.
export function openSheet(html, onClose) {
  const sheet = document.getElementById('sheet');
  const body = document.createElement('div');
  body.className = 'sheet-body';
  sheet.querySelector('.sheet-body').replaceWith(body);
  body.innerHTML = html;
  const title = body.querySelector('h2');
  if (title) { title.id = 'sheetTitle'; sheet.setAttribute('aria-labelledby', 'sheetTitle'); }
  sheet.onclose = () => { onClose?.(); };
  if (!sheet.open) sheet.showModal();
  body.scrollTop = 0;
  return body;
}
export function closeSheet() {
  const sheet = document.getElementById('sheet');
  if (sheet.open) sheet.close();
}

export const ICON = {
  x: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  bits: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2.5" y="12.5" width="19" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 12.5V5.8l1-1.6 1 1.6v6.7M11.5 12.5V4.2l1.25-1.9L14 4.2v8.3M17 12.5V3.6l1.4-2 1.4 2v8.9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 10h11M11 5.5l4.5 4.5L11 14.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M16 10H5M9 5.5L4.5 10 9 14.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ok: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  minus: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 10h10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 10h10M10 5v10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

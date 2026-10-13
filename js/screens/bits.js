// Your bits: the sets you own, loose bits, saving a copy to move them to another device, and this screen's calibration.
import { store } from '../store.js';
import { SETS, bitById } from '../drills.js';
import { mmText } from '../units.js';
import { looseSheet } from './index.js';
import { esc, fracify, openSheet, closeSheet, toast, ICON, SITE, isSingle, canDownload } from '../ui.js';

export function yourBitsSheet() {
  const body = openSheet('');
  const saving = canDownload();
  function draw() {
    const scr = store.screen();
    const loose = store.loose.map(bitById).filter(Boolean).sort((a, b) => a.mm - b.mm);
    body.innerHTML = `
      <div class="sheet-top"><h2>Your bits</h2><button type="button" class="close" aria-label="Close">${ICON.x}</button></div>
      <p class="hint">Tick the sets in your drawer. Every answer comes in these bits, and the drill index draws them.</p>
      <ul class="set-toggles">${SETS.map(s => {
        const gone = store.missing.filter(m => m.startsWith(s.id + ':')).length;
        return `<li><label class="switch"><input type="checkbox" data-set="${s.id}"${store.sets.includes(s.id) ? ' checked' : ''}>
          <span class="st"><b>${esc(s.name)}</b><small>${fracify(s.range)} · ${s.bits.length} bit${s.bits.length > 1 ? 's' : ''}${gone && store.sets.includes(s.id) ? `, ${gone} missing` : ''}</small></span></label></li>`;
      }).join('')}</ul>
      <h3 class="sub-title">Loose bits</h3>
      <p class="hint">${loose.length ? 'Bits on their own, not in a set.' : 'None yet: a bit bought for one job, or one from the junk drawer.'}</p>
      ${loose.length ? `<ul class="loose-chips">${loose.map(b => `<li><span>${esc(b.name)}</span><button type="button" class="x" data-unloose="${b.id}" aria-label="Take out ${esc(b.name)}">${ICON.x}</button></li>`).join('')}</ul>` : ''}
      <button type="button" class="btn small" data-act="loose">Add a loose bit</button>
      <h3 class="sub-title">This screen</h3>
      <p class="hint">${scr ? (scr.same ? `Calibrated with a bank card: ${mmText(scr.pxPerMm, 2)} pixels to the millimetre.` : 'Calibrated on a different screen or zoom: the gauge will ask again.') : 'Not calibrated yet. The screw gauge asks for a bank card the first time.'}
        ${scr ? '<a href="#/gauge?calibrate" class="link" data-close>Calibrate again</a>' : ''}</p>
      <h3 class="sub-title">Keep a copy</h3>
      <p class="hint">Your bits are kept in this browser, on this device. ${saving ? 'Save a copy to move them to another phone, or keep it safe.'
        : `To save a copy of them, open Pilot Hole at <a class="link" href="${SITE}">junkdrawer.works/pilot-hole</a>.`}</p>
      <div class="row-btns">
        ${saving ? '<button type="button" class="btn small" data-act="save">Save a copy</button>' : ''}
        <label class="btn small file-btn">Load a copy<input type="file" accept="application/json,.json" data-act="load" hidden></label>
      </div>
      <div class="about">
        <p>Nothing you do here is sent anywhere.${isSingle() ? '' : ' It works offline, and you can add it to your home screen.'}</p>
        <button type="button" class="btn quiet" data-act="clear">Clear everything</button>
        <footer class="jd-foot">
          <a href="https://junkdrawer.works/">Part of junkdrawer.works</a>
          <span aria-hidden="true">·</span>
          <a href="https://junkdrawer.works/privacy.html">Privacy</a>
        </footer>
      </div>`;
  }
  draw();
  const off = store.onChange(draw);
  const sheet = document.getElementById('sheet');
  const prevClose = sheet.onclose;
  sheet.onclose = () => { off(); prevClose?.(); };

  body.addEventListener('change', e => {
    const box = e.target.closest('[data-set]');
    if (box) store.setSet(box.dataset.set, box.checked);
    if (e.target.closest('[data-act="load"]')) load(e.target);
  });
  body.addEventListener('click', e => {
    if (e.target.closest('.close') || e.target.closest('[data-close]')) closeSheet();
    const un = e.target.closest('[data-unloose]');
    if (un) store.removeLoose(un.dataset.unloose);
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'loose') looseSheet();
    if (act === 'save') save();
    if (act === 'clear' && confirm('Clear your bits, the bits marked missing, and this screen’s calibration?')) { store.clearAll(); toast('Cleared'); }
  });
}

function save() {
  const data = JSON.stringify(store.exportData(), null, 1);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = `pilot-hole-bits-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Saved');
}

async function load(input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    store.importData(JSON.parse(await file.text()));
    toast('Loaded');
  } catch (err) {
    toast(err.message.startsWith('That file') ? err.message : 'That file couldn’t be read.');
  }
  input.value = '';
}

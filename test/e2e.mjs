// Uses the app in Chromium through the real page:  node test/e2e.mjs  (needs Playwright)
// Picks fasteners and materials, ticks bit sets and sees the answers change, taps bits in the drill index,
// marks one missing, calibrates the screen gauge with a drag and names a bolt, saves and loads a copy of
// your bits, then the checks every project wants: no errors, nothing leaving the site, no sideways
// scrolling, installable, and working offline.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, readdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let body;
  try { body = await readFile(join(root, path === '/' ? 'index.html' : path)); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
  res.end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

// Every file the page needs is in the service worker's list, so it all works offline.
{
  const sw = await readFile(join(root, 'sw.js'), 'utf8');
  const listed = new Set([...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
  const need = ['index.html', 'icon.svg', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'];
  for (const dir of ['css', 'fonts', 'js', 'js/screens']) {
    for (const f of await readdir(join(root, dir), { withFileTypes: true })) if (f.isFile()) need.push(`${dir}/${f.name}`);
  }
  for (const f of need) assert.ok(listed.has(f), `sw.js doesn't keep ${f} for offline`);
  for (const f of listed) if (f !== './') await readFile(join(root, f)).catch(() => assert.fail(`sw.js lists ${f}, which doesn't exist`));
}

const browser = await pw.chromium.launch();
const problems = [];
const squash = s => s.replace(/\s+/g, ' ').trim();
const text = async (page, sel) => squash(await page.locator(sel).first().innerText());
const fits = async (page, where) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${where} scrolls sideways`);
const card = (page, key) => page.locator(`.hole[data-key="${key}"]`);
// Drag the gauge's jaws from wherever they are to a size across the threads and a length, on a screen
// calibrated at k pixels to the millimetre. The gauge keeps them where they were left, so start from the readings.
async function jaws(page, k, { dia, len }) {
  const f = await page.locator('#gField').boundingBox();
  const x0 = Math.round(14 + 7 * k), y0 = Math.round(34 + 5 * k);
  const [d0, l0] = await page.evaluate(() => [...document.querySelectorAll('.g-meas .g-read b')].map(b => parseFloat(b.textContent)));
  if (dia != null) {
    await page.mouse.move(f.x + x0 + d0 * k, f.y + f.height - 30); await page.mouse.down();
    await page.mouse.move(f.x + x0 + dia * k, f.y + f.height - 30, { steps: 5 }); await page.mouse.up();
  }
  if (len != null) {
    await page.mouse.move(f.x + f.width - 30, f.y + y0 + l0 * k); await page.mouse.down();
    await page.mouse.move(f.x + f.width - 30, f.y + y0 + len * k, { steps: 5 }); await page.mouse.up();
  }
}

async function device(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('requestfailed', r => problems.push('failed: ' + r.url()));
  page.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('blob:')) problems.push('left the site: ' + r.url()); });
  page.on('dialog', d => d.accept());
  return { ctx, page };
}

try {
  // ---------- On a phone: the Holes screen ----------
  const phone = await device({ width: 390, height: 844 }, { isMobile: true, hasTouch: true });
  let page = phone.page;
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.title(), 'Pilot Hole');
  assert.equal(await page.evaluate(() => document.fonts.check('16px Archivo')), true, 'the self-hosted font loads');

  // The first thing anyone sees: a #8 wood screw into hardwood, in a fractional set.
  assert.equal(await text(page, '.spec'), '#8 wood screw into hardwood');
  assert.equal(await text(page, `${'.hole[data-key="pilot"]'} .big .bit-link`), '1/8″');
  assert.match(await text(page, '.hole[data-key="pilot"] .tag'), /^exact$/);
  assert.match(await text(page, '.hole[data-key="pilot"] .alt'), /Old-style tapered screws: 7\/64″/);
  assert.equal(await text(page, '.hole[data-key="shank"] .big .bit-link'), '5/32″');
  assert.match(await text(page, '.hole[data-key="csink"] .big'), /Ø 0\.332″/);
  assert.match(await text(page, '.tools'), /Phillips #2 Square #2 \(red\) Torx T20/);
  assert.ok(await page.locator('.diagram svg.section').count(), 'a section through the joint');
  await fits(page, 'the Holes screen');

  // Softwood takes a smaller pilot; the address follows the pick.
  await page.click('[data-mat="softwood"]');
  assert.equal(await text(page, '.hole[data-key="pilot"] .big .bit-link'), '7/64″');
  assert.match(await page.evaluate(() => location.hash), /type=wood&size=8&into=softwood/);
  await page.click('[data-size="12"]');
  assert.equal(await text(page, '.hole[data-key="pilot"] .big .bit-link'), '9/64″');

  // A machine screw keeps the material it can go into: through softwood, with a nut.
  await page.click('[data-type="machine"]');
  assert.equal(await text(page, '.spec'), 'M3 socket head into softwood');
  assert.ok(await card(page, 'through').count());
  // The nut's counterbore says how much room a bit leaves around the 7 mm washer, and that the usual is a Forstner,
  // not that 5/16″ is a hair small of some size in between.
  assert.equal(await text(page, '.hole[data-key="nut"] .tag'), '0.94 mm to spare');
  assert.match(await text(page, '.hole[data-key="nut"] .sizes'), /The usual is a 10 mm Forstner \(0\.3937″\), not in your bits\./);
  await page.evaluate(() => { location.hash = '#/?type=machine&size=1%2F4-20&into=hardwood&head=hex'; });
  await page.waitForFunction(() => document.querySelector('.spec')?.textContent.includes('1/4-20'));
  assert.match(await text(page, '.hole[data-key="nut"] .sizes'), /^Forstner, 0\.75″ · 19\.05 mm\. Nearest you have:/, 'it says the 3/4″ it wants is a Forstner');
  assert.match(await text(page, '.hole[data-key="nut"] .nearest'), /1\/2″ 0\.125″ narrower than the washer: it won’t go in/);
  await page.evaluate(() => { location.hash = '#/?type=machine&size=M3&into=softwood&head=socket'; });
  await page.waitForFunction(() => document.querySelector('.spec')?.textContent.includes('M3'));
  // Into aluminium: no metric bits yet, so the tap drill says what's wrong with the nearest.
  await page.click('[data-mat="aluminium"]');
  assert.equal(await text(page, '.spec'), 'M3 socket head into aluminium');
  assert.equal(await card(page, 'tap').getAttribute('class'), 'hole r-main none');
  assert.match(await text(page, '.hole[data-key="tap"] .nearest'), /3\/32″ 95% thread: too tight, the tap may snap 7\/64″ 34% thread: too loose to hold/);
  // A tapped hole takes a key and a tap; there's no nut to list.
  assert.match(await text(page, '.tools'), /Hex key 2\.5 mm Tap M3 × 0\.5$/);

  // Tick the metric set in Your bits: now the tap drill is 2.5 mm, a 77% thread.
  await page.click('#bitsBtn');
  await page.locator('.sheet input[data-set="met25"]').check();
  await page.click('.sheet .close');
  assert.equal(await text(page, '.hole[data-key="tap"] .big .bit-link'), '2.5 mm');
  assert.equal(await text(page, '.hole[data-key="tap"] .tag'), '77% thread');
  assert.match(await text(page, '.hole[data-key="close"] .big'), /^1\/8″/, 'met25 has no 3.2: it takes 1/8″');

  // Inch threads, a hex head, and the tools follow.
  await page.click('[data-sys="inch"]');
  assert.equal(await text(page, '.spec'), '1/4-20 socket head into aluminium');
  assert.equal(await text(page, '.hole[data-key="tap"] .big .bit-link'), '13/64″');
  assert.equal(await text(page, '.hole[data-key="tap"] .tag'), '72% thread');
  await page.click('[data-head="hex"]');
  assert.match(await text(page, '.tools'), /Wrench 7\/16″/);
  assert.equal(await page.locator('.hole[data-key="cbore"]').count(), 0, 'a hex head has no counterbore');

  // Into a print: the screw-straight-in hole, and a link to a heat-set insert.
  await page.click('[data-sys="metric"]');
  await page.click('[data-mat="printed"]');
  assert.ok(await card(page, 'straight').count());
  await page.click('.related .link-btn');
  await page.waitForFunction(() => scrollY === 0); // it scrolls up to the new pick smoothly
  assert.equal(await text(page, '.spec'), 'M3 heat-set insert into printed part');
  assert.equal(await text(page, '.hole[data-key="insert"] .big .bit-link'), '4 mm');
  assert.match(await text(page, '.hole[data-key="insert"] .depth'), /At least 6\.7 mm deep/);

  // Materials that make no sense for the fastener say why instead.
  await page.click('[data-mat="steel"]', { force: true }); // it's marked unavailable, but a tap still explains
  assert.match(await text(page, '#toast'), /Heat-set inserts go into printed parts/);
  assert.equal(await text(page, '.spec'), 'M3 heat-set insert into printed part');
  assert.doesNotMatch(await text(page, '.tools'), /Nut|Tap/, 'a heat-set insert has no nut and no tap');

  // An exact answer with no chart bit to compare doesn't say the size twice.
  await page.evaluate(() => { location.hash = '#/?type=lag&size=5%2F16&into=softwood'; });
  await page.waitForFunction(() => document.querySelector('.spec')?.textContent.includes('lag'));
  assert.equal(await text(page, '.hole[data-key="shank"] .sizes'), '0.3125″ · 7.94 mm.');

  // A reload comes back to the same pick.
  await page.click('[data-type="insert"]');
  await page.click('[data-mat="hardwood"]');
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await text(page, '.spec'), '1/4-20 threaded insert into hardwood E-Z Lok sizes');
  assert.equal(await text(page, '.hole[data-key="insert"] .big .bit-link'), '25/64″');
  await fits(page, 'the Holes screen with inserts');

  // Each fastener comes back to where it was: the printed part a heat-set insert needs doesn't stick to a wood screw.
  await page.click('[data-type="wood"]');
  assert.equal(await text(page, '.spec'), '#8 wood screw into hardwood');
  await page.click('[data-size="12"]');
  await page.click('[data-type="heatset"]');
  assert.equal(await text(page, '.spec'), 'M3 heat-set insert into printed part');
  await page.click('[data-type="wood"]');
  assert.equal(await text(page, '.spec'), '#12 wood screw into hardwood', 'back to where the wood screw was');

  // ---------- The drill index ----------
  await page.click('.tabs a[data-tab="index"]');
  await page.waitForSelector('.case[data-set="frac29"]');
  assert.equal(await page.locator('.case[data-set="frac29"] .slot').count(), 29);
  assert.equal(await page.locator('.case[data-set="met25"] .slot').count(), 25);
  await fits(page, 'the drill index');

  // Tap 7/64″: pilot for an old-style #8 in hardwood, the shank hole for #4, the tap drill for #6-32.
  await page.click('.case[data-set="frac29"] .slot[data-bit="f:7/64"]');
  await page.waitForSelector('.sheet[open] .uses');
  const uses = await text(page, '.sheet[open]');
  assert.match(uses, /7\/64″/);
  // It leads with what it's spot on for, each saying what kind of hole, then the near misses.
  assert.match(uses, /Spot on for #6 and #7 wood screws pilot hole, in hardwood, plywood, MDF exact · the usual/i);
  assert.match(uses, /#8 wood screw, old-style pilot hole, in hardwood, plywood, MDF exact · the usual/);
  assert.match(uses, /#3 and #4 wood screws shank hole exact · the usual/);
  assert.match(uses, /#6-32 tap drill 71% thread Near enough for/i);
  assert.match(uses, /Near enough the same as #35/);
  // A twin's name stays on one line: "2.8 mm", never "2.8" at the end of one line and "mm" on the next.
  assert.deepEqual(await page.$$eval('.twins b', bs => bs.filter(b => b.getClientRects().length > 1).map(b => b.textContent)), []);

  // A number drill is known for its tap drill, and that comes first, not under the pilot holes it nearly fits.
  await page.click('.sheet .close');
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pilot:bit', { detail: 'n:29' })));
  await page.waitForSelector('.sheet[open] .use');
  assert.equal(squash(await page.locator('.sheet .use').first().innerText()), '#8-32 tap drill 69% thread · the usual');
  await page.click('.sheet .close');
  await page.click('.case[data-set="frac29"] .slot[data-bit="f:7/64"]');
  await page.waitForSelector('.sheet[open] .uses');
  // Mark it missing: the hole goes empty, and the Holes screen stops offering it.
  await page.locator('#goneBox').check();
  await page.click('.sheet .close');
  assert.match(await page.getAttribute('.case[data-set="frac29"] .slot[data-bit="f:7/64"]', 'class'), /gone/);
  assert.match(await text(page, '.case[data-set="frac29"] .count'), /^28 ?\/29$/);
  await page.evaluate(() => { location.hash = '#/?type=wood&size=8&into=softwood'; });
  await page.waitForFunction(() => document.querySelector('.spec')?.textContent.includes('softwood'));
  // With 7/64″ gone, the neighbour that will do in softwood stands in, and says what to watch.
  assert.match(await card(page, 'pilot').getAttribute('class'), /near/, '7/64″ is missing, so a neighbour stands in');
  assert.equal(await text(page, '.hole[data-key="pilot"] .big'), '2.5 mm a hair tight');
  assert.match(await text(page, '.hole[data-key="pilot"] .sizes'), /The usual is 7\/64″ .*not in your bits\.$/);
  assert.equal(await text(page, '.hole[data-key="pilot"] .pct'), 'A hair tight: fine in softwood. Or 3 mm, a hair loose.');

  // A use in the sheet opens that fastener.
  await page.click('.tabs a[data-tab="index"]');
  await page.click('.case[data-set="met25"] .slot[data-bit="m:4"]');
  await page.waitForSelector('.sheet[open] .uses');
  await page.locator('.sheet .use', { hasText: 'M3 heat-set insert' }).click();
  await page.waitForFunction(() => document.querySelector('.spec')?.textContent.includes('heat-set'));
  assert.equal(await text(page, '.spec'), 'M3 heat-set insert into printed part');
  // Holes keeps a fastener reached by a link: away to the drill index and back, it's still the insert,
  // not the #12 wood screw last tapped on the picker.
  await page.click('.tabs a[data-tab="index"]');
  await page.waitForSelector('.case');
  await page.click('.tabs a[data-tab="holes"]');
  await page.waitForSelector('.spec');
  assert.equal(await text(page, '.spec'), 'M3 heat-set insert into printed part', 'the Holes tab forgot the linked pick');

  // ---------- Your bits: save a copy and load it back ----------
  await page.click('#bitsBtn');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('.sheet [data-act="save"]')]);
  const saved = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(saved.app, 'pilot-hole');
  assert.deepEqual(saved.sets, ['frac29', 'met25']);
  assert.deepEqual(saved.missing, ['frac29:f:7/64']);
  await page.locator('.sheet input[data-set="met25"]').uncheck();
  assert.deepEqual(await page.evaluate(() => window.pilotHole.store.sets), ['frac29']);
  const dir = await mkdtemp(join(tmpdir(), 'pilot-hole-'));
  await writeFile(join(dir, 'bits.json'), JSON.stringify(saved));
  await page.setInputFiles('.sheet input[data-act="load"]', join(dir, 'bits.json'));
  await page.waitForFunction(() => window.pilotHole.store.sets.includes('met25'));
  await writeFile(join(dir, 'nope.json'), '{"hello":1}');
  await page.setInputFiles('.sheet input[data-act="load"]', join(dir, 'nope.json'));
  await page.waitForFunction(() => /isn’t a Pilot Hole file/.test(document.getElementById('toast').textContent));
  await rm(dir, { recursive: true });
  await page.click('.sheet .close');

  // ---------- The screw gauge ----------
  await page.click('.tabs a[data-tab="gauge"]');
  await page.waitForSelector('.gauge[data-step="cal"]');
  assert.match(await page.getAttribute('meta[name="viewport"]', 'content'), /maximum-scale=1/, 'pinch-zoom is locked on the gauge');
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('gField')).touchAction), 'none');

  // Calibrate: drag the red line to where a card's far end would be on a screen with 6.0 px to the mm.
  const box = await page.locator('#gField').boundingBox();
  const k0 = await page.evaluate(() => parseFloat(document.querySelector('.g-read b').textContent));
  const lineY = box.y + 14 + 85.6 * k0;
  const target = box.y + 14 + 85.6 * 6.0;
  // A finger on the card itself moves nothing...
  await page.mouse.move(box.x + 100, box.y + 200); await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 260, { steps: 4 }); await page.mouse.up();
  assert.equal(await page.evaluate(() => parseFloat(document.querySelector('.g-read b').textContent)), k0, 'touching the card moved the line');
  // ...a drag from out past the card does. Overshoot past the foot of the glass and the line stops there, still
  // across the screen, and the way to measure across the card lights up; it never turns on its side under a finger.
  await page.mouse.move(box.x + box.width - 30, lineY); await page.mouse.down();
  await page.mouse.move(box.x + box.width - 30, box.y + box.height + 80, { steps: 8 });
  assert.match(await page.locator('#gSvg .jaw').getAttribute('d'), /^M0 [\d.]+H\d+$/, 'the line turned on its side mid-drag');
  assert.match(await text(page, '.g-say'), /the card’s far end/);
  const atFoot = await page.evaluate(() => { const j = document.querySelector('#gSvg .jaw').getAttribute('d'); return +j.split(' ')[1].split('H')[0]; });
  assert.ok(atFoot <= box.height - 8 && atFoot > box.height - 14, `the line stopped at ${atFoot}, the glass is ${box.height} tall`);
  assert.equal(await page.locator('.g-stuck.on').count(), 1, 'the way to measure across the card lights up');
  await page.mouse.move(box.x + box.width - 30, box.y + atFoot - 40, { steps: 4 });
  assert.match(await page.locator('#gSvg .jaw').getAttribute('d'), /^M0 /, 'back up, it is still across the screen');
  await page.mouse.up();
  await page.mouse.move(box.x + box.width - 30, box.y + atFoot - 40); await page.mouse.down(); // where the line is now
  await page.mouse.move(box.x + box.width - 30, target, { steps: 6 }); await page.mouse.up();
  assert.equal(await page.evaluate(() => parseFloat(document.querySelector('.g-read b').textContent)), 6, 'the drag set 6.00 px per mm');
  assert.equal(await page.locator('.g-stuck.on').count(), 0);
  // − and + move the line a whole pixel, so the reading changes where you can see it.
  await page.click('[data-nudge="1"]');
  assert.equal(await page.evaluate(() => document.querySelector('.g-read b').textContent), '6.01');
  await page.click('[data-nudge="-1"]');
  assert.equal(await page.evaluate(() => parseFloat(document.querySelector('.g-read b').textContent)), 6);
  assert.match(await text(page, '.g-read'), /pixels to the mm/);
  await page.click('[data-go="measure"]');
  await page.waitForSelector('.gauge[data-step="measure"]');
  const scr = await page.evaluate(() => JSON.parse(localStorage.getItem('pilot-hole.screen')));
  assert.ok(Math.abs(scr.pxPerMm - 6) < 0.01, 'the calibration is kept');

  // Measure: 6.2 mm across the threads is a quarter-inch or M6; nudge the length to an inch.
  assert.match(await text(page, '.g-could'), /Could be 1\/4″ or M6/);
  for (let i = 0; i < 4; i++) await page.click('[data-l="-0.5"]');
  assert.equal(await page.evaluate(() => document.querySelectorAll('.g-read b')[1].textContent), '23.4');
  // In inches it's about 15/16″ (that's 23.8 mm), and an inch is an inch.
  const inchRead = () => page.evaluate(() => document.querySelectorAll('.g-read small')[1].textContent);
  assert.equal(await inchRead(), '≈ 15/16″');
  for (let i = 0; i < 4; i++) await page.click('[data-l="0.5"]');
  assert.equal(await inchRead(), '1″');
  // A touch inside the box the screw lies in doesn't move the jaws.
  const f2 = await page.locator('#gField').boundingBox();
  await page.mouse.move(f2.x + 60, f2.y + 120); await page.mouse.down(); await page.mouse.move(f2.x + 140, f2.y + 300, { steps: 4 }); await page.mouse.up();
  assert.match(await text(page, '.g-meas .g-read'), /^6\.2 mm/);
  await page.click('[data-go="threads"]');
  await page.waitForSelector('.comb-btn');
  const combs = await page.locator('.comb-btn b').allInnerTexts();
  assert.ok(combs.includes('1/4-20') && combs.includes('1/4-28') && combs.includes('M6 × 1'), combs.join(', '));
  // The steps along the top go back (and on again), and so do the phone's Back and Forward, keeping the measurement.
  await page.click('.g-steps [data-step="measure"]');
  await page.waitForSelector('.gauge[data-step="measure"]');
  assert.match(await text(page, '.g-meas .g-read'), /^6\.2 mm/, 'going back a step keeps the measurement');
  await page.goBack();
  await page.waitForSelector('.gauge[data-step="threads"]');
  await page.goBack();
  await page.waitForSelector('.gauge[data-step="measure"]');
  assert.equal(await page.evaluate(() => location.hash), '#/gauge', 'Back went back a step, not out of the gauge');
  assert.match(await text(page, '.g-meas .g-read'), /^6\.2 mm/);
  await page.goForward();
  await page.waitForSelector('.gauge[data-step="threads"]');
  assert.equal(await page.locator('.comb-btn').count(), combs.length);
  // Card, to calibrate again; leaving it without "That's it" keeps the calibration there was.
  await page.click('.g-steps [data-step="cal"]');
  await page.waitForSelector('.gauge[data-step="cal"]');
  await page.click('[data-nudge="1"]');
  await page.click('.g-steps [data-step="threads"]');
  await page.waitForSelector('.comb-btn');
  await page.click('.g-steps [data-step="cal"]');
  assert.equal(await page.evaluate(() => parseFloat(document.querySelector('.g-read b').textContent)), 6, 'a nudge without That’s it changed the calibration');
  await page.click('.g-steps [data-step="threads"]');
  await page.waitForSelector('.comb-btn');
  await page.locator('.comb-btn', { hasText: '1/4-20' }).click();
  await page.click('[data-go="name"]');
  await page.waitForSelector('.gauge-name');
  assert.equal(await text(page, '.gauge-name'), '1/4-20 × 1');
  await page.click('[data-head="hex"]');
  assert.equal(await text(page, '.gauge-name'), '1/4-20 × 1 hex bolt');
  // A loose bolt's tools are everything it takes: one wrench for its head and its nut, and the tap.
  assert.equal(await text(page, '.g-tools'), 'Wrench 7/16″, for the head and the nut Tap 1/4-20 UNC');
  // It's drawn at true size where it lay: an inch (25.4 mm at 6 px to the mm) down from the top fence, under
  // a hex head 5/32″ tall and 7/16″ across its flats, so as wide as that hex across its corners.
  const drawn = await page.evaluate(() => { const b = document.querySelector('.g-draw .sg').getBBox(); return { top: b.y, bottom: b.y + b.height, width: b.width }; });
  const fence = Math.round(34 + 5 * 6);
  assert.ok(Math.abs(drawn.bottom - (fence + 25.4 * 6)) < 1, `the bolt ends ${drawn.bottom - fence} px below the fence`);
  assert.ok(Math.abs(drawn.top - (fence - 5 / 32 * 25.4 * 6)) < 1, `its head stands ${fence - drawn.top} px above it`);
  assert.ok(Math.abs(drawn.width - 7 / 16 * 25.4 * 2 / Math.sqrt(3) * 6) < 1, `its head is ${drawn.width} px across`);
  await page.click('.g-result a.btn.primary');
  await page.waitForSelector('.spec');
  assert.equal(await text(page, '.spec'), '1/4-20 hex bolt into aluminium', 'the Holes screen calls it what the gauge does');
  assert.equal(await page.evaluate(() => document.body.classList.contains('gauge-on')), false, 'leaving the gauge unlocks the page');
  assert.match(await page.getAttribute('meta[name="viewport"]', 'content'), /^width=device-width, initial-scale=1, viewport-fit=cover$/);
  // Back from there is the gauge's Name step again, with the bolt as it was.
  await page.goBack();
  await page.waitForSelector('.gauge-name');
  assert.equal(await text(page, '.gauge-name'), '1/4-20 × 1 hex bolt');
  await page.click('.g-close');
  await page.waitForSelector('.spec');
  assert.equal(await text(page, '.spec'), '1/4-20 hex bolt into aluminium', 'closing the gauge goes back to where you were');

  // A metric screw by comb, and a drill bit by its shank.
  await page.click('.tabs a[data-tab="gauge"]');
  await page.waitForSelector('.gauge[data-step="measure"]');
  for (let i = 0; i < 6; i++) await page.click('[data-d="-0.05"]');
  assert.match(await text(page, '.g-could'), /M6/);
  await page.click('[data-what="bit"]');
  const k = 6, f3 = await page.locator('#gField').boundingBox();
  const x0 = Math.round(14 + 7 * k), xd = x0 + 5.9 * k;
  await page.mouse.move(f3.x + xd, f3.y + f3.height - 30); await page.mouse.down();
  await page.mouse.move(f3.x + x0 + 3.454 * k, f3.y + f3.height - 30, { steps: 5 }); await page.mouse.up();
  await page.click('[data-go="name"]');
  // 3.454 mm is a #29 to the hundredth, but a pixel here is 0.17 mm, and the metric case has a 3.5 mm bit.
  assert.equal(await text(page, '.gauge-name'), '3.5 mm');
  assert.match(await text(page, '.g-label'), /A pixel on this screen is 0\.17 mm, so it could also be #29/);
  assert.match(await text(page, '.g-label'), /In your bits\./);
  assert.ok(await page.locator('.g-draw .sg').count(), 'the bit is drawn where it lay');
  // A bit gone missing from a case is the likeliest of all, and can go straight back.
  await page.click('.g-result [data-go="measure"]');
  await page.waitForSelector('.gauge[data-step="measure"]');
  const f4 = await page.locator('#gField').boundingBox();
  await page.mouse.move(f4.x + x0 + 3.454 * k, f4.y + f4.height - 30); await page.mouse.down();
  await page.mouse.move(f4.x + x0 + 2.78 * k, f4.y + f4.height - 30, { steps: 5 }); await page.mouse.up();
  await page.click('[data-go="name"]');
  assert.equal(await text(page, '.gauge-name'), '7/64″');
  assert.match(await text(page, '.g-own'), /Your 7\/64″ went missing from the fractional case\. Is this it\?/);
  await page.click('[data-putback]');
  assert.equal(await page.evaluate(() => window.pilotHole.store.isMissing('frac29', 'f:7/64')), false, 'put back');
  assert.match(await text(page, '.g-own'), /In your bits\./);
  await page.click('.g-result [data-go="measure"]');
  await page.waitForSelector('.gauge[data-step="measure"]');
  await page.click('.g-close');
  await page.waitForSelector('.spec');

  // A pointed screw goes by gauge.
  await page.click('.tabs a[data-tab="gauge"]');
  await page.waitForSelector('.gauge[data-step="measure"]');
  await page.click('[data-what="screw"]');
  await page.click('[data-tip="pointed"]');
  await page.click('[data-go="name"]');
  assert.match(await text(page, '.gauge-name'), /^#\d+ × 1 wood screw$/);
  await page.click('[data-kind="sheet"]');
  assert.match(await text(page, '.gauge-name'), /sheet-metal screw$/);
  // The commonest screw in the drawer, a #8 × 1-1/4″ flat head, measured the way the gauge says: a flat head goes
  // top on the line and is measured overall, 31.75 mm (29.3 under its head would be a 1-1/8″), and it's drawn so.
  await page.click('[data-kind="wood"]');
  await page.click('.g-result [data-go="measure"]');
  await page.waitForSelector('.gauge[data-step="measure"]');
  assert.match(await text(page, '.g-panel'), /Length under the head; a flat head, overall/i);
  assert.match(await page.locator('.g-tell').first().textContent(), /a flat head: its top on it/);
  const gy0 = Math.round(34 + 5 * 6);
  await jaws(page, 6, { dia: 4.1, len: 31.75 });
  await page.click('[data-go="name"]');
  assert.equal(await text(page, '.gauge-name'), '#8 × 1-1/4 wood screw');
  const ws = await page.evaluate(() => { const b = document.querySelector('.g-draw .sg').getBBox(); return { top: b.y, bottom: b.y + b.height }; });
  assert.ok(Math.abs(ws.top - gy0) < 1, `the flat head's top is ${ws.top - gy0} px off the line`);
  assert.ok(Math.abs(ws.bottom - (gy0 + 31.75 * 6)) < 1.5, `the screw ends ${ws.bottom - gy0} px below the line`);
  // Fatter than any wood screw: 7.8 mm pointed is a 5/16″ lag, and the wood screw chip, marked off, says why not.
  await page.click('.g-result [data-go="measure"]');
  await page.waitForSelector('.gauge[data-step="measure"]');
  await jaws(page, 6, { dia: 7.8 });
  assert.match(await text(page, '.g-could'), /^Could be a 5\/16″ lag screw$/);
  await page.click('[data-go="name"]');
  assert.equal(await text(page, '.gauge-name'), '5/16″ × 1-1/4 lag screw');
  // Its size is set as a real fraction, as the Holes screen sets it, not as 5/16 in a row.
  assert.deepEqual(await page.$$eval('.gauge-name .fr', fs => fs.map(f => f.textContent)), ['5/16', '1/4']);
  assert.match(await page.getAttribute('[data-kind="wood"]', 'class'), /\boff\b/);
  await page.click('[data-kind="wood"]', { force: true });
  assert.match(await text(page, '#toast'), /Wood screws stop at #14: this one’s fatter\./);
  assert.match(await text(page, '.gauge-name'), /lag screw$/);
  // Past the end of the tables, it names nothing: a 15 mm bolt is bigger than anything in them.
  await page.click('.g-result [data-go="measure"]');
  await page.waitForSelector('.gauge[data-step="measure"]');
  await page.click('[data-tip="blunt"]');
  await jaws(page, 6, { dia: 15 });
  assert.match(await text(page, '.g-could'), /Bigger than anything in the tables: they stop at 1\/2″ and M12/);
  assert.equal(await page.locator('.g-panel [data-go="threads"]').isDisabled(), true, 'no going on to name a 15 mm bolt');
  await page.click('.g-close');
  await page.waitForSelector('.spec');
  await fits(page, 'the Holes screen after the gauge');

  // Clear everything clears everything: no sets ticked, not the fractional set a first visit starts with.
  await page.click('#bitsBtn');
  await page.click('.sheet [data-act="clear"]');
  assert.deepEqual(await page.evaluate(() => window.pilotHole.store.sets), []);
  await page.click('.sheet .close');
  assert.match(await text(page, '.nobits'), /No bits ticked yet/);
  await phone.ctx.close();

  // ---------- A small phone: the card won't fit lengthways, so the gauge measures across it ----------
  const small = await device({ width: 375, height: 667 }, { isMobile: true, hasTouch: true });
  await small.page.goto(base + '#/gauge');
  await small.page.waitForSelector('.gauge[data-step="cal"]');
  assert.match(await text(small.page, '.g-say'), /Drag the red line to the card’s right edge/);
  const sb = await small.page.locator('#gField').boundingBox();
  const sk0 = await small.page.evaluate(() => parseFloat(document.querySelector('.g-read b').textContent));
  const sx = sb.x + 14 + 53.98 * sk0;
  await small.page.mouse.move(sx, sb.y + sb.height - 34); await small.page.mouse.down();
  await small.page.mouse.move(sb.x + 14 + 53.98 * 6.4, sb.y + sb.height - 34, { steps: 6 }); await small.page.mouse.up();
  assert.equal(await small.page.evaluate(() => parseFloat(document.querySelector('.g-read b').textContent)), 6.4, 'the drag across the card set 6.40 px per mm');
  await fits(small.page, 'the gauge on a small phone');
  await small.page.click('[data-go="measure"]');
  await small.page.waitForSelector('.gauge[data-step="measure"]');
  const sk = 6.4, sx0 = Math.round(14 + 7 * sk), sy0 = Math.round(34 + 5 * sk);
  let sf = await small.page.locator('#gField').boundingBox();
  // Twins no comb can part go by the size: 4.88 mm on the #10-32 comb is the M5.
  await small.page.mouse.move(sf.x + sx0 + 6.2 * sk, sf.y + sf.height - 30); await small.page.mouse.down();
  await small.page.mouse.move(sf.x + sx0 + 4.88 * sk, sf.y + sf.height - 30, { steps: 5 }); await small.page.mouse.up();
  await small.page.click('[data-go="threads"]');
  await small.page.locator('.comb-btn', { hasText: '#10-32' }).click();
  assert.match(await text(small.page, '.g-warn'), /You measured 4\.88: that’s the M5\./);
  await small.page.click('[data-go="name"]');
  assert.equal(await text(small.page, '.gauge-name'), 'M5 × 0.8 × 25', 'named by its size, though the #10-32 comb was picked');
  assert.equal(await small.page.evaluate(() => document.querySelector('.g-kicker').textContent), 'It’s an');
  // With a metric set ticked, its free clearance is a 5.5 mm bit, on one line: not "5.5" over "mm".
  await small.page.evaluate(() => window.pilotHole.store.setSet('met25', true));
  await small.page.click('[data-head="socket"]');
  const mmLines = await small.page.$$eval('.g-holes .g-bit b', bs => bs.filter(b => /mm/.test(b.textContent)).map(b => `${b.textContent}: ${b.getClientRects().length}`));
  assert.ok(mmLines.length && mmLines.every(x => x.endsWith(': 1')), `metric sizes break across lines: ${mmLines.join(', ')}`);
  // A screw longer than the glass: the panel tucks away and there's room for a 2½″ one.
  await small.page.click('.g-result [data-go="measure"]');
  await small.page.waitForSelector('.gauge[data-step="measure"]');
  sf = await small.page.locator('#gField').boundingBox();
  await small.page.mouse.move(sf.x + sf.width - 30, sf.y + sy0 + 25.4 * sk); await small.page.mouse.down();
  await small.page.mouse.move(sf.x + sf.width - 30, sf.y + sf.height - 4, { steps: 8 }); await small.page.mouse.up();
  await small.page.click('.g-panel [data-tuck]');
  const tall = await small.page.locator('#gField').boundingBox();
  assert.ok(tall.height > sf.height + 90, `tucked away, the glass grows from ${sf.height} to ${tall.height} px`);
  const atLen = await small.page.evaluate(() => parseFloat(document.querySelectorAll('.g-mini b')[1].textContent));
  await small.page.mouse.move(tall.x + tall.width - 30, tall.y + sy0 + atLen * sk); await small.page.mouse.down();
  await small.page.mouse.move(tall.x + tall.width - 30, tall.y + sy0 + 63.5 * sk, { steps: 8 }); await small.page.mouse.up();
  assert.match(await text(small.page, '.g-mini'), /63\.5 mm long/);
  // On its side, a phone has no room to measure: it says to turn it upright.
  await small.page.setViewportSize({ width: 667, height: 375 });
  await small.page.waitForFunction(() => !document.getElementById('gTurn').hidden);
  await small.ctx.close();

  // ---------- A phone with its browser's bars showing: every comb can still be reached ----------
  const short = await device({ width: 390, height: 664 }, { isMobile: true, hasTouch: true });
  await short.page.goto(base);
  await short.page.evaluate(() => window.pilotHole.store.setScreen(6));
  await short.page.goto(base + '#/gauge');
  await short.page.waitForSelector('.gauge[data-step="measure"]');
  // 4.85 mm across the threads: M5, #10-32 or #10-24, with three more combs behind More sizes.
  const hx0 = Math.round(14 + 7 * 6), hf = await short.page.locator('#gField').boundingBox();
  await short.page.mouse.move(hf.x + hx0 + 6.2 * 6, hf.y + hf.height - 30); await short.page.mouse.down();
  await short.page.mouse.move(hf.x + hx0 + 4.85 * 6, hf.y + hf.height - 30, { steps: 5 }); await short.page.mouse.up();
  await short.page.click('[data-go="threads"]');
  await short.page.waitForSelector('.comb-btn');
  assert.equal(await short.page.locator('.comb-btn').count(), 3);
  await short.page.click('[data-more]');
  assert.equal(await short.page.locator('.comb-btn').count(), 6, 'More sizes draws every comb, not just the ones that fit');
  await short.page.waitForFunction(() => document.getElementById('gField').scrollTop > 0); // and scrolls down to them
  const lastComb = short.page.locator('.comb-btn').last();
  await lastComb.scrollIntoViewIfNeeded();
  assert.match(await lastComb.innerText(), /1\/4-20/);
  await lastComb.click();
  assert.equal(await short.page.locator('.comb-btn').last().getAttribute('aria-pressed'), 'true');
  await fits(short.page, 'the combs on a short phone');
  await short.ctx.close();

  // ---------- The narrowest phone: the picker still shows what's ticked ----------
  const narrow = await device({ width: 320, height: 640 }, { isMobile: true, hasTouch: true });
  await narrow.page.goto(base + '#/?type=machine&size=1%2F4-20&into=aluminium&head=socket');
  await narrow.page.waitForSelector('.chips');
  await narrow.page.evaluate(() => document.fonts.ready);
  // Each ticked chip sits in its row clear of the fades at either end (it used to land 80 px left of centre,
  // half out of sight), and every fastener's name fits its tile.
  const chipsSeen = await narrow.page.$$eval('.chips', rows => rows.map(el => {
    const on = el.querySelector('[aria-checked="true"]'), a = el.getBoundingClientRect(), b = on.getBoundingClientRect();
    const at = el.dataset.at, fadeL = at === 'middle' || at === 'end' ? 22 : 0, fadeR = at === 'start' || at === 'middle' ? 26 : 0;
    return { row: el.dataset.row, ok: b.left >= a.left + fadeL - 0.5 && b.right <= a.right - fadeR + 0.5 };
  }));
  assert.deepEqual(chipsSeen.filter(x => !x.ok).map(x => x.row), [], 'a ticked chip is under a fade');
  const spills = await narrow.page.$$eval('.type', ts => ts.filter(t => {
    const r = document.createRange(); r.selectNodeContents(t.querySelector('span'));
    return r.getBoundingClientRect().width > t.getBoundingClientRect().width + 0.5;
  }).map(t => t.textContent.trim()));
  assert.deepEqual(spills, [], 'a fastener’s name spills out of its tile');
  await fits(narrow.page, 'the Holes screen at 320');
  await narrow.ctx.close();

  // ---------- On a laptop ----------
  const laptop = await device({ width: 1280, height: 800 });
  page = laptop.page;
  await page.goto(base + '#/?type=machine&size=10-32&into=steel&head=flat');
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await text(page, '.spec'), '#10-32 flat head into steel');
  assert.match(await text(page, '.hole[data-key="csink"] .big'), /Ø 0\.385″/);
  await fits(page, 'the Holes screen on a laptop');
  await page.click('.tabs a[data-tab="index"]');
  await page.waitForSelector('.case');
  await fits(page, 'the drill index on a laptop');

  // Installable: a manifest with a name, and no complaints from Chromium.
  const cdp = await laptop.ctx.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  assert.deepEqual(installabilityErrors, [], 'Chrome says it can’t install it');
  const man = await cdp.send('Page.getAppManifest');
  assert.equal(man.errors.length, 0, 'the manifest has errors');
  assert.match(man.data, /"name": "Pilot Hole"/);

  // Works offline once it has been opened.
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 15000 }).catch(() => {});
  await laptop.ctx.setOffline(true);
  await page.goto(base + '#/');
  await page.waitForSelector('.spec', { timeout: 10000 });
  assert.ok(await page.title(), 'the page did not load offline');
  await laptop.ctx.setOffline(false);
  await laptop.ctx.close();

  // ---------- In the dark ----------
  const dark = await device({ width: 390, height: 844 }, { colorScheme: 'dark', isMobile: true, hasTouch: true });
  await dark.page.goto(base + '#/index');
  await dark.page.waitForSelector('.case');
  await fits(dark.page, 'the drill index in the dark');
  await dark.ctx.close();

  assert.deepEqual(problems.filter(p => !p.startsWith('failed:')), [], 'problems while using it');
} finally {
  await browser.close();
  server.close();
}
console.log('all good');

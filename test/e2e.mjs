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
  // Into aluminium: no metric bits yet, so the tap drill says what's wrong with the nearest.
  await page.click('[data-mat="aluminium"]');
  assert.equal(await text(page, '.spec'), 'M3 socket head into aluminium');
  assert.equal(await card(page, 'tap').getAttribute('class'), 'hole r-main none');
  assert.match(await text(page, '.hole[data-key="tap"] .nearest'), /3\/32″ 95% thread: too tight, the tap may snap 7\/64″ 34% thread: too loose to hold/);
  assert.match(await text(page, '.tools'), /Hex key 2\.5 mm Nut 5\.5 mm wrench Tap M3 × 0\.5/);

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
  assert.equal(await text(page, '.spec'), 'M3 heat-set insert into printed part');
  assert.equal(await text(page, '.hole[data-key="insert"] .big .bit-link'), '4 mm');
  assert.match(await text(page, '.hole[data-key="insert"] .depth'), /At least 6\.7 mm deep/);

  // Materials that make no sense for the fastener say why instead.
  await page.click('[data-mat="steel"]', { force: true }); // it's marked unavailable, but a tap still explains
  assert.match(await text(page, '#toast'), /Heat-set inserts go into printed parts/);
  assert.equal(await text(page, '.spec'), 'M3 heat-set insert into printed part');

  // A reload comes back to the same pick.
  await page.click('[data-type="insert"]');
  await page.click('[data-mat="hardwood"]');
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await text(page, '.spec'), '1/4-20 threaded insert into hardwood E-Z Lok sizes');
  assert.equal(await text(page, '.hole[data-key="insert"] .big .bit-link'), '25/64″');
  await fits(page, 'the Holes screen with inserts');

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
  assert.match(uses, /#8 wood screw, old-style in hardwood, plywood, MDF exact · the usual/);
  assert.match(uses, /#4 wood screw shank hole exact · the usual/);
  assert.match(uses, /#6-32 71% thread/);
  assert.match(uses, /Near enough the same as #35/);

  // Mark it missing: the hole goes empty, and the Holes screen stops offering it.
  await page.locator('#goneBox').check();
  await page.click('.sheet .close');
  assert.match(await page.getAttribute('.case[data-set="frac29"] .slot[data-bit="f:7/64"]', 'class'), /gone/);
  assert.match(await text(page, '.case[data-set="frac29"] .count'), /^28 ?\/29$/);
  await page.evaluate(() => { location.hash = '#/?type=wood&size=8&into=softwood'; });
  await page.waitForFunction(() => document.querySelector('.spec')?.textContent.includes('softwood'));
  assert.match(await card(page, 'pilot').getAttribute('class'), /none/, '7/64″ is missing, so nothing fits');
  assert.match(await text(page, '.hole[data-key="pilot"] .nearest'), /^2\.5 mm .*too tight 3 mm .*too loose$/, 'the nearest either side, from both sets');

  // A use in the sheet opens that fastener.
  await page.click('.tabs a[data-tab="index"]');
  await page.click('.case[data-set="met25"] .slot[data-bit="m:4"]');
  await page.waitForSelector('.sheet[open] .uses');
  await page.locator('.sheet .use', { hasText: 'M3 heat-set insert' }).click();
  await page.waitForFunction(() => document.querySelector('.spec')?.textContent.includes('heat-set'));
  assert.equal(await text(page, '.spec'), 'M3 heat-set insert into printed part');

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
  // ...a drag from out past the card does.
  await page.mouse.move(box.x + box.width - 30, lineY); await page.mouse.down();
  await page.mouse.move(box.x + box.width - 30, target, { steps: 6 }); await page.mouse.up();
  assert.equal(await page.evaluate(() => parseFloat(document.querySelector('.g-read b').textContent)), 6, 'the drag set 6.00 px per mm');
  await page.click('[data-go="measure"]');
  await page.waitForSelector('.gauge[data-step="measure"]');
  const scr = await page.evaluate(() => JSON.parse(localStorage.getItem('pilot-hole.screen')));
  assert.ok(Math.abs(scr.pxPerMm - 6) < 0.01, 'the calibration is kept');

  // Measure: 6.2 mm across the threads is a quarter-inch or M6; nudge the length to an inch.
  assert.match(await text(page, '.g-could'), /Could be 1\/4″ or M6/);
  for (let i = 0; i < 4; i++) await page.click('[data-l="-0.5"]');
  assert.equal(await page.evaluate(() => document.querySelectorAll('.g-read b')[1].textContent), '23.4');
  for (let i = 0; i < 4; i++) await page.click('[data-l="0.5"]');
  // A touch inside the box the screw lies in doesn't move the jaws.
  const f2 = await page.locator('#gField').boundingBox();
  await page.mouse.move(f2.x + 60, f2.y + 120); await page.mouse.down(); await page.mouse.move(f2.x + 140, f2.y + 300, { steps: 4 }); await page.mouse.up();
  assert.match(await text(page, '.g-meas .g-read'), /^6\.2 mm/);
  await page.click('[data-go="threads"]');
  await page.waitForSelector('.comb-btn');
  const combs = await page.locator('.comb-btn b').allInnerTexts();
  assert.ok(combs.includes('1/4-20') && combs.includes('1/4-28') && combs.includes('M6 × 1'), combs.join(', '));
  await page.locator('.comb-btn', { hasText: '1/4-20' }).click();
  await page.click('[data-go="name"]');
  await page.waitForSelector('.gauge-name');
  assert.equal(await text(page, '.gauge-name'), '1/4-20 × 1');
  await page.click('[data-head="hex"]');
  assert.equal(await text(page, '.gauge-name'), '1/4-20 × 1 hex bolt');
  assert.match(await text(page, '.g-tools'), /Wrench 7\/16″/);
  await page.click('.g-result a.btn.primary');
  await page.waitForSelector('.spec');
  assert.equal(await text(page, '.spec'), '1/4-20 hex head into aluminium');
  assert.equal(await page.evaluate(() => document.body.classList.contains('gauge-on')), false, 'leaving the gauge unlocks the page');
  assert.match(await page.getAttribute('meta[name="viewport"]', 'content'), /^width=device-width, initial-scale=1, viewport-fit=cover$/);

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
  assert.equal(await text(page, '.gauge-name'), '#29');
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
  await page.click('.g-close');
  await page.waitForSelector('.spec');
  await fits(page, 'the Holes screen after the gauge');
  await phone.ctx.close();

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

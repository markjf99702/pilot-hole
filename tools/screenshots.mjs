// Renders the README screenshots (docs/*.png) and the link preview (og.png):  node tools/screenshots.mjs
// Needs Playwright, and upng-js from `npm install`. Nothing is random, so the same pictures come out every time.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const UPNG = require('upng-js');
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
const browser = await pw.chromium.launch();
await mkdir(join(root, 'docs'), { recursive: true });

// A 256-colour palette keeps the PNGs small.
async function save(shot, path) {
  const img = UPNG.decode(shot);
  await writeFile(join(root, path), Buffer.from(UPNG.encode(UPNG.toRGBA8(img), img.width, img.height, 256)));
  console.log('wrote', path);
}

// A phone, light, no motion, no service worker. The screen is calibrated the way a bank card would set it
// on a 390-wide phone, so the gauge draws at that phone's true size.
async function open(viewport, deviceScaleFactor, hash = '', phone = true) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, isMobile: phone, hasTouch: phone, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(base);
  await page.evaluate(() => { window.pilotHole.store.setScreen(6.04); });
  await page.goto(base + hash);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  return page;
}

// Drag a gauge jaw by the grip at (x, y) on the glass to (x2, y2).
async function drag(page, x, y, x2, y2) {
  const f = await page.locator('#gField').boundingBox();
  await page.mouse.move(f.x + x, f.y + y); await page.mouse.down();
  await page.mouse.move(f.x + x2, f.y + y2, { steps: 8 }); await page.mouse.up();
}

// Phone screenshots for the README.
{
  // The Holes screen: a #8 wood screw into hardwood, in a fractional set.
  let page = await open({ width: 390, height: 844 }, 2, '#/?type=wood&size=8&into=hardwood');
  await save(await page.screenshot(), 'docs/phone-holes.png');
  await page.context().close();

  // The drill index: the fractional case, with 7/64″ lifted out of its hole, and the number case under it.
  page = await open({ width: 390, height: 844 }, 2, '#/');
  await page.evaluate(() => window.pilotHole.store.setSet('num60', true));
  await page.goto(base + '#/index');
  await page.waitForSelector('.case[data-set="frac29"]');
  await page.evaluate(() => document.querySelector('.case[data-set="frac29"] .slot[data-bit="f:7/64"]').classList.add('on'));
  await page.waitForTimeout(150);
  await save(await page.screenshot(), 'docs/phone-index.png');
  await page.context().close();

  // The screw gauge naming a 1/4-20 × 1½ hex bolt, drawn at true size where it lay.
  page = await open({ width: 390, height: 844 }, 2, '#/gauge');
  await page.waitForSelector('.gauge[data-step="measure"]');
  const k = 6.04, y0 = Math.round(34 + 5 * k);
  const f = await page.locator('#gField').boundingBox();
  await drag(page, f.width - 30, y0 + 25.4 * k, f.width - 30, y0 + 38.1 * k);
  await page.click('[data-go="threads"]');
  await page.locator('.comb-btn', { hasText: '1/4-20' }).click();
  await page.click('[data-go="name"]');
  await page.click('[data-head="hex"]');
  await page.waitForTimeout(150);
  await save(await page.screenshot(), 'docs/phone-gauge.png');
  await page.context().close();
}

// Link preview, 1200 x 630: the name and a line on the left, the app's own fractional case on the right.
{
  const page = await open({ width: 600, height: 900 }, 1, '#/index', false);
  await page.waitForSelector('.case[data-set="frac29"]');
  await page.evaluate(() => document.querySelector('.case[data-set="frac29"] .slot[data-bit="f:7/64"]').classList.add('on'));
  await page.evaluate(async () => {
    const defs = document.body.querySelector(':scope > svg').outerHTML; // the bits' gradients
    const kase = document.querySelector('.case[data-set="frac29"]').outerHTML;
    document.body.innerHTML = `${defs}
      <div class="og">
        <div class="og-text">
          <img src="icon.svg" alt="" width="80" height="80"><h1>Pilot Hole</h1>
          <p>The drill bit for any screw, bolt or insert, in the bits you own.</p>
          <ul><li>Pilot, clearance and tap-drill holes</li><li>Your drill index, bit by bit</li><li>Lay a screw on the screen and it names it</li></ul>
        </div>
        <div class="og-case">${kase}</div>
      </div>`;
    const style = document.createElement('style');
    style.textContent = `
      body { width: 1200px; height: 630px; overflow: hidden; margin: 0; min-height: 0; }
      .og { position: relative; width: 1200px; height: 630px; overflow: hidden; background: var(--bg); }
      .og::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 26px;
        background: linear-gradient(180deg, rgba(255, 255, 255, .06), rgba(0, 0, 0, .1)), var(--hammer) 0 0 / 180px 180px, var(--steel);
        background-blend-mode: normal, soft-light, normal; }
      .og-text { position: absolute; left: 64px; top: 50%; transform: translateY(-50%); width: 456px; }
      .og-text img { display: block; border-radius: 18px; box-shadow: 0 2px 8px rgba(0, 0, 0, .3); }
      .og-text h1 { margin: 26px 0 0; font: 800 54px/1 var(--sans); font-stretch: 125%; text-transform: uppercase; letter-spacing: .02em; white-space: nowrap; }
      .og-text p { margin: 24px 0 24px; font: 650 33px/1.2 var(--sans); font-stretch: 87.5%; color: var(--ink); }
      .og-text ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
      .og-text li { display: flex; align-items: center; gap: 14px; font: 650 24px/1.2 var(--sans); font-stretch: 87.5%; color: var(--ink-2); }
      .og-text li::before { content: ''; flex: none; width: 12px; height: 12px; border-radius: 50%; background: var(--accent); }
      .og-case { position: absolute; right: 52px; top: calc(50% + 13px); transform: translateY(-50%); width: 580px; }
      .og-case .case { box-shadow: inset 0 1px 0 rgba(255, 255, 255, .2), inset 0 -3px 0 rgba(0, 0, 0, .35), 0 22px 40px -18px rgba(0, 0, 0, .65); }
      .og-case .lid-x, .toast { display: none !important; }`;
    document.head.append(style);
    await document.fonts.ready;
  });
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.waitForTimeout(200);
  await save(await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } }), 'og.png');
  await page.context().close();
}

await browser.close();
server.close();
console.log('screenshots written');

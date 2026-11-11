#!/usr/bin/env node
// Start page in the headless browser: scene loads (layers + Leyla), runs without errors. Server must run (npm run serve).
//   node tools/splash_test.mjs [--shots]   (images → output/splash_*.png: desktop, iPad upright, phone)
import path from 'node:path';
import { chromium } from 'playwright';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv.includes('--shots');
const browser = await chromium.launch();
let failed = 0;
for (const [name, width, height] of [['desktop', 1440, 900], ['ipad', 820, 1180], ['phone', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
  await page.goto('http://localhost:8766/index.html');
  await page.waitForFunction(() => window.splash, null, { timeout: 15000 });
  const s = await page.evaluate(() => window.splash);
  await page.waitForTimeout(1500);
  const ok = s.layers >= 1 && (s.layers === 4 || s.weather) && s.runner && s.drone && !errors.length;
  console.log(`  ${ok ? 'ok  ' : 'FEHLER'} ${name}: ${s.layers} Ebenen${s.weather ? " + Wetter " + s.weather : ""}, Leyla ${s.runner ? 'da' : 'fehlt'}${errors.length ? ' · ' + errors.join(' | ') : ''}`);
  if (!ok) failed++;
  if (shots) await page.screenshot({ path: path.join(repo, `output/splash_${name}.png`) });
  await page.close();
}
// controller in the main menu (Daniel, 11.11.2026): stick up/down chooses, sideways bends the road, A opens
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', index: 0, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
    window.setPad = ({ press = [], axes = [0, 0] } = {}) => { pad.buttons.forEach((b, i) => { b.pressed = press.includes(i); b.value = b.pressed ? 1 : 0; }); pad.axes = [...axes, 0, 0]; };
    navigator.getGamepads = () => [pad, null, null, null];
  });
  await page.goto('http://localhost:8766/index.html');
  await page.waitForFunction(() => window.splash && window.menu, null, { timeout: 15000 });
  const ev = f => page.evaluate(f);
  await ev(() => setPad({ axes: [0, 1] })); await page.waitForTimeout(120); await ev(() => setPad()); await page.waitForTimeout(100);
  await ev(() => setPad({ axes: [0, 1] })); await page.waitForTimeout(120); await ev(() => setPad()); await page.waitForTimeout(100);
  const sel = await ev(() => menu.selected());
  // the little surprise: a tumbleweed rolls over the highway, a shooting star crosses the sky
  await ev(() => splash.surprise());
  let sur = { star: false, tumble: false };
  for (let i = 0; i < 20 && !(sur.star && sur.tumble); i++) { await page.waitForTimeout(80); const x = await ev(() => ({ star: splash.star(), tumble: splash.tumble() })); sur = { star: sur.star || x.star, tumble: sur.tumble || x.tumble }; }
  console.log(`  ${sur.star && sur.tumble ? 'ok  ' : 'FEHLER'} Überraschung: Sternschnuppe ${sur.star ? 'ja' : 'nein'}, Steppenläufer ${sur.tumble ? 'ja' : 'nein'}`);
  if (!(sur.star && sur.tumble)) failed++;
  await ev(() => setPad({ axes: [1, 0] })); await page.waitForTimeout(1500);
  const bent = await ev(() => splash.curve());
  if (shots) await page.screenshot({ path: path.join(repo, 'output/splash_curve.png') });
  await ev(() => setPad()); await page.waitForTimeout(2500);
  const back = await ev(() => splash.curve());
  await ev(() => setPad({ press: [0] }));
  const url = await page.waitForURL(/game\.html/, { timeout: 5000 }).then(() => page.url()).catch(() => page.url());
  const ok = sel === 1 && bent > 0.8 && Math.abs(back) < 0.05 && /game\.html$/.test(url) && !errors.length;
  console.log(`  ${ok ? 'ok  ' : 'FEHLER'} Controller: Stick runter wählt (${sel}), seitlich Kurve ${bent}, losgelassen gerade ${back}, A öffnet ${url.split('/').pop()}${errors.length ? ' · ' + errors.join(' | ') : ''}`);
  if (!ok) failed++;
  await page.close();
}
await browser.close();
console.log(failed ? `\n${failed} Fehler.` : 'Startseite ok.');
process.exit(failed ? 1 : 0);

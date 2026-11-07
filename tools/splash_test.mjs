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
  page.on('console', m => { if (m.type() === 'error' && !m.location()?.url?.includes('/api/')) errors.push(m.text()); });
  await page.goto('http://localhost:8766/index.html');
  await page.waitForFunction(() => window.splash, null, { timeout: 15000 });
  const s = await page.evaluate(() => window.splash);
  await page.waitForTimeout(1500);
  const ok = s.layers === 4 && s.runner && !errors.length;
  console.log(`  ${ok ? 'ok  ' : 'FEHLER'} ${name}: ${s.layers} Ebenen, Leyla ${s.runner ? 'da' : 'fehlt'}${errors.length ? ' · ' + errors.join(' | ') : ''}`);
  if (!ok) failed++;
  if (shots) await page.screenshot({ path: path.join(repo, `output/splash_${name}.png`) });
  await page.close();
}
await browser.close();
console.log(failed ? `\n${failed} Fehler.` : 'Startseite ok.');
process.exit(failed ? 1 : 0);

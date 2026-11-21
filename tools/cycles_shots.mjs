// #168 pictures of the cycle graph preview in the workshop (POIs › Level: map + Zyklus-Graph per seed).
// Server must run (npm run serve).   node tools/cycles_shots.mjs [poi …]   → output/cycles_workshop_<poi>.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const pois = process.argv.slice(2).length ? process.argv.slice(2) : ['ministerium', 'raketensilo'];
const url = (process.env.GAME_URL || 'http://localhost:8766/game.html').replace(/game\.html.*$/, 'workshop.html');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
await page.goto(url);
await page.waitForFunction(() => window.workshop?.p && !document.querySelector('#load.loading-on'), null, { timeout: 30000 });
fs.mkdirSync('output', { recursive: true });
for (const poi of pois) {
  await page.evaluate(id => window.workshop.go({ area: 'pois', choice: id }), poi);
  await page.waitForSelector('.ng-graphMap', { timeout: 15000 });
  const box = await page.evaluate(() => { const c = document.querySelector('.ng-graphMap'); c.scrollIntoView({ block: 'center' }); const p = c.parentElement.getBoundingClientRect(); return { x: p.x, y: p.y, w: p.width, h: p.height }; });
  await page.waitForTimeout(300);
  const c = await page.evaluate(() => { const r = document.querySelector('.ng-graphMap').parentElement.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.screenshot({ path: `output/cycles_workshop_${poi}.png`, clip: { x: Math.max(0, c.x - 8), y: Math.max(0, c.y - 8), width: Math.min(1500, c.w + 16), height: Math.min(1100, c.h + 16) } });
  console.log(`output/cycles_workshop_${poi}.png`, JSON.stringify(box));
}
await browser.close();

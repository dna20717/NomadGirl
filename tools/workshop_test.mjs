// Headless check of the workshop: every area draws without errors, editing + undo work.
// python3 -m http.server 8766 &  node tools/workshop_test.mjs [--shots]  (screenshots to output/)
import fs from 'node:fs';
import { chromium } from 'playwright';
import { AREAS } from '../engine/schema.js';

const url = process.env.WORKSHOP_URL || 'http://localhost:8766/workshop.html';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.location()?.url?.includes('/api/')) errors.push(m.text()); });   // no worker locally: /api/ answers 404
await page.goto(url);
await page.waitForSelector('#ng-load', { state: 'detached', timeout: 10000 });
if (shots) fs.mkdirSync('output', { recursive: true });
const go = t => page.evaluate(t => window.workshop.go(t), t);
const shot = async n => { if (shots) await page.screenshot({ path: `output/workshop_${n}.png` }); };

await shot('overview');
for (const [a, A] of Object.entries(AREAS)) {
  const first = A.kind === 'catalog' ? await page.evaluate(a => Object.keys(window.workshop.p.data[a])[0], a) : null;
  await go({ area: a, choice: first });
  const bad = await page.$$eval('.ed-error', l => l.map(e => e.textContent));
  if (bad.length) errors.push(`${a}: ${bad.join(' | ')}`);
  await shot(a);
}
await go({ area: 'validation' }); await shot('validation');

// edit a number in Leyla, then undo
await go({ area: 'leyla' });
const field = page.locator('label.da-field', { hasText: 'Rennen' }).locator('input');
await field.fill('333'); await field.dispatchEvent('change');
const after = await page.evaluate(() => window.workshop.p.data.leyla.movement.runSpeed);
await page.keyboard.press('Control+z');
const undone = await page.evaluate(() => window.workshop.p.data.leyla.movement.runSpeed);
if (after !== 333 || undone === 333) errors.push(`Bearbeiten/Rückgängig: ${after} → ${undone}`);

// room layout: monospaced text, one row per line; preview draws
await go({ area: 'rooms', choice: 'testraum' }); await shot('rooms_layout');
await page.locator('canvas.ng-roomMap').scrollIntoViewIfNeeded(); await shot('rooms_preview');
const lay = page.locator('textarea.ng-lines');
const rows = (await lay.inputValue()).split('\n');
rows[13] = rows[13].slice(0, 5) + '#' + rows[13].slice(6);
await lay.fill(rows.join('\n')); await lay.dispatchEvent('change');
const changed = await page.evaluate(() => window.workshop.p.data.rooms.testraum.layout[13][5]);
if (changed !== '#') errors.push(`Layout bearbeiten: Zeichen ist „${changed}“`);
if (!await page.locator('canvas.ng-roomMap').count()) errors.push('Layout-Vorschau fehlt');
await page.keyboard.press('Control+z');

// scroll positions stay where you are (Daniel, 08.11.2026): small window, area list scrolled down, click an area there;
// entry list scrolled down, click an entry there; another area starts its list at the top
await page.setViewportSize({ width: 1280, height: 560 });
await go({ area: 'overview' });
const top = sel => page.$eval(sel, e => e.scrollTop);
await page.$eval('.da-navbar', e => { e.scrollTop = e.scrollHeight; });
const deep = page.locator('.da-nav', { hasText: 'Rig-Bau' });
await deep.scrollIntoViewIfNeeded();
const navBefore = await top('.da-navbar');
await deep.click();
const navAfter = await top('.da-navbar');
if (!navBefore || Math.abs(navAfter - navBefore) > 2) errors.push(`Bereichsleiste springt: ${navBefore} → ${navAfter}`);
await go({ area: 'items' });
await page.$eval('.da-main', e => { e.scrollTop = e.scrollHeight; });
const lastEntry = page.locator('.da-entry').last();
await lastEntry.scrollIntoViewIfNeeded();
const listBefore = await top('.da-main');
await lastEntry.click();
const listAfter = await top('.da-main');
if (!listBefore || Math.abs(listAfter - listBefore) > 2) errors.push(`Eintragsliste springt: ${listBefore} → ${listAfter}`);
if (!(await page.evaluate(() => window.workshop.page.choice))) errors.push('Eintrag nicht gewählt');
await page.locator('.da-nav', { hasText: 'Waffen' }).click();
if (await top('.da-main') !== 0) errors.push('Neuer Bereich beginnt nicht oben');

await browser.close();
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Werkstatt ok: ${Object.keys(AREAS).length} Bereiche gezeichnet, Bearbeiten + Rückgängig gehen.`);

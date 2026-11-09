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
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });   // no worker locally: /api/ answers 404
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
const field = page.getByRole('spinbutton', { name: 'Rennen (px/s)', exact: true });
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

// icon sheet (asset kind "Symbole"): the inspector of an item shows the grid, a click picks the cell, undo takes it back, the list shows the cell
await go({ area: 'items', choice: 'verband' });
await page.waitForSelector('.ng-icons.pick .ng-icon.picked', { timeout: 5000 }).catch(() => errors.push('Symbol-Raster im Inspektor fehlt'));
const iconBefore = await page.evaluate(() => window.workshop.p.data.items.verband.icon);
await page.locator('.ng-icons.pick .ng-icon').nth(48).click();
if (await page.evaluate(() => window.workshop.p.data.items.verband.icon) !== 48) errors.push('Klick ins Symbol-Raster setzt das Symbol nicht');
await shot('icons');
await page.keyboard.press('Control+z');
if (await page.evaluate(() => window.workshop.p.data.items.verband.icon) !== iconBefore) errors.push('Rückgängig stellt das Symbol nicht zurück');
if (!(await page.locator('.da-entry .ng-thumb canvas, .da-entry .ng-thumb img').count())) errors.push('Liste zeigt keine Vorschaubilder');
await go({ area: 'assets', choice: 'icons_gear' });
await page.waitForSelector('.ng-icons .ng-icon', { timeout: 5000 }).catch(() => errors.push('Symbol-Raster in der Asset-Vorschau fehlt'));

await browser.close();
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Werkstatt ok: ${Object.keys(AREAS).length} Bereiche gezeichnet, Bearbeiten + Rückgängig gehen.`);

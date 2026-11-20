// #124 Cockpit-Hauptmenü (/cockpit): Teile geladen, Menü im Radio, Lenken dreht Lenkrad und Straße, Sticker, Billboard, AvA.
// Run: node tools/cockpit_test.mjs   (server on :8766, e.g. npm run serve; or via npm run test:browser)
import { chromium } from 'playwright';

const base = (process.env.GAME_URL || 'http://localhost:8766/game.html').replace(/game\.html.*$/, '');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], ok = [], pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
await page.goto(base + 'cockpit.html?stickers=all');
await page.waitForFunction(() => window.cockpitMenu && window.splash, null, { timeout: 30000 });
await page.waitForTimeout(1500);
let r = await page.evaluate(() => { const l = document.getElementById('lcd'), b = l.getBoundingClientRect(); return { items: cockpitMenu.items(), vis: l.querySelectorAll('a:not([hidden])').length, box: [b.x, b.y, b.width, b.height], stickers: cockpitMenu.stickers() }; });
check('Menü liegt im Radio-Display (4 Zeilen sichtbar, Display auf dem Bildschirm)', r.vis === 4 && r.items.length >= 5 && r.box[2] > 150 && r.box[2] < 600 && r.box[1] > 300 && r.box[1] < 900, r);
check('Alle Achievements als Sticker (?stickers=all)', r.stickers === 16, r.stickers);
const z0 = await page.evaluate(() => cockpitMenu.billboard());
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500);
r = await page.evaluate(() => ({ curve: splash.curve(), z: cockpitMenu.billboard() }));
await page.keyboard.up('ArrowRight');
check('Lenken: Pfeil rechts biegt die Straße (Lenkrad dreht mit)', r.curve > 0.5, r);
check('Billboard kommt näher', r.z < z0 || z0 > 30, { z0, z: r.z });
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
r = await page.evaluate(() => cockpitMenu.selected());
check('↓ wählt im Radio-Menü', r === 2, r);
const acts = new Set();
for (let i = 0; i < 12; i++) { acts.add(await page.evaluate(() => cockpitMenu.ava())); await page.waitForTimeout(1200); }
r = await page.evaluate(() => cockpitMenu.avaAt());
check('AvA wechselt ihre Beschäftigung und bleibt in der Scheibe', acts.size >= 2 && r && r.y > 0 && r.y < 900 * 0.5 && r.x > 0 && r.x < 1600, { acts: [...acts], at: r });
check('Keine Fehler auf der Seite', !pageErrors.length, pageErrors);
await browser.close();
for (const n of ok) console.log('✓', n);
for (const e of errors) console.log('✗', e);
console.log(errors.length ? `Cockpit: ${errors.length} Fehler` : `Cockpit ok: ${ok.length} Prüfungen.`);
process.exit(errors.length ? 1 : 0);

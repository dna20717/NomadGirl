#!/usr/bin/env node
// Datensets (#073): in the workshop „Speichern unter …“ makes a variant (only the difference), it is active on this device; the game plays
// it, the main menu shows it in the status bar and switches; back to the standard.   node tools/datasets_test.mjs   (server: npm run serve)
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const B = 'http://localhost:8766/';

await page.goto(B + 'workshop.html'); await page.waitForFunction(() => window.workshop?.p, null, { timeout: 30000 });
await page.evaluate(() => { localStorage.clear(); });
await page.reload(); await page.waitForFunction(() => window.workshop?.p, null, { timeout: 30000 });
let v = await page.evaluate(() => ({ label: document.querySelector('.ng-setButton')?.textContent.trim(), set: window.workshop.dataSet }));
check('Werkstatt: Knopf „Standard“, kein Set aktiv', v.label === 'Standard' && !v.set, v);
// change something, then „Speichern unter …“
await page.evaluate(() => { const w = window.workshop; w.change('leyla', () => { w.p.data.leyla.movement.runSpeed = 777; }); });
await page.click('.ng-setButton');
await page.click('.ed-dialogue .ed-button.main');
await page.waitForSelector('.ed-dialogue input.ed-field');
await page.fill('.ed-dialogue input.ed-field', 'Schnelle Leyla');
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.workshop?.dataSet?.id === 'schnelle_leyla', null, { timeout: 20000 });
v = await page.evaluate(() => ({ label: document.querySelector('.ng-setButton')?.textContent.trim(), run: window.workshop.p.data.leyla.movement.runSpeed, std: window.workshop.base.leyla.movement.runSpeed,
  draft: JSON.parse(localStorage.getItem('nomadgirl-drafts:sets/schnelle_leyla/data/leyla.json') || 'null'), index: JSON.parse(localStorage.getItem('nomadgirl-drafts:sets/index.json') || 'null'), active: localStorage.getItem('nomadgirl-set') }));
check('Speichern unter: Variante mit nur dem Unterschied, aktiv, Standard unverändert', v.label === 'Schnelle Leyla' && v.run === 777 && v.std !== 777 && JSON.stringify(v.draft) === '{"movement":{"runSpeed":777}}' && v.index?.[0]?.id === 'schnelle_leyla' && v.active === 'schnelle_leyla', v);
// the game plays it
await page.goto(B + 'game.html?camp&new'); await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 60000 });
v = await page.evaluate(() => ({ set: window.__nomadData?.set, run: game.scene.getScene('play').data_.leyla.movement.runSpeed }));
check('Spiel: lädt das aktive Datenset', v.set?.id === 'schnelle_leyla' && v.run === 777, v);
// main menu: status bar and switching
await page.goto(B + 'index.html'); await page.waitForFunction(() => window.dataSets, null, { timeout: 20000 });
v = await page.evaluate(() => ({ bar: document.getElementById('dataset').textContent, entry: document.querySelector('nav a.dataset b').textContent }));
check('Hauptmenü: Statusleiste und Eintrag zeigen das aktive Set', v.bar === 'Datenset: Schnelle Leyla' && v.entry === 'Datenset: Schnelle Leyla', v);
await page.click('nav a.dataset');
v = await page.evaluate(() => ({ bar: document.getElementById('dataset').textContent, active: localStorage.getItem('nomadgirl-set') }));
check('Hauptmenü: Klick wechselt zum Standard', v.bar === 'Datenset: Standard' && !v.active, v);
await page.goto(B + 'game.html?camp&new'); await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 60000 });
v = await page.evaluate(() => ({ set: window.__nomadData?.set, run: game.scene.getScene('play').data_.leyla.movement.runSpeed }));
check('Spiel: wieder Standard', !v.set && v.run !== 777, v);
await page.evaluate(() => localStorage.clear());

console.log(ok.map(x => '✔ ' + x).join('\n'));
if (errors.length) { console.log(errors.map(x => '✖ ' + x).join('\n')); await browser.close(); process.exit(1); }
console.log(`Datensets: ${ok.length} Prüfungen grün`);
await browser.close();

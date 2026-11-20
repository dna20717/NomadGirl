// Werkstätten ausbauen (#078, Daniel 19.11.2026: „ermögliche den Ausbau von Werkstätten. Kennzeichne es mit Sternchen neben dem Titel
// der Werkstatt in der Rig-Ansicht und in der jeweiligen Werkstatt“): button in the window, the step's menu, pay, stars everywhere.
// Server must run (npm run serve).   node tools/upgrade_test.mjs [--shots]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { furnishedStart } from './test_fixture.mjs';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await furnishedStart(page);
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 20000 });
const ev = f => page.evaluate(f);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const SC = () => 'game.scene.getScene("play")';

let v = await ev(async () => {
  nomad.take(); nomad.step(5);
  const s = game.scene.getScene('play'), save = s.box.save, C = await import('/game/crafting.js');
  save.deltas = 3000; C.give(s.data_, save, 'schrottplatte', 4); C.give(s.data_, save, 'rohrbogen', 2);
  const place = save.rig.units.flatMap((u, ui) => (u.workshops || []).map(w => ({ ui, w }))).find(x => x.w.id === 'kochnische'), p = `${place.ui}:${place.w.at}`;
  window.__p = p;
  s.camp.use('kochnische', p); nomad.step(2);
  const btn = document.querySelector('.craft-up')?.textContent || '', h2 = document.querySelector('.craft-box h2')?.textContent || '';
  document.querySelector('.craft-up')?.click(); nomad.step(2);
  const menu = (s.hud.menuItems || []).map(x => x.label), title = s.hud.menuTitle;
  return { btn, h2, menu, title };
});
check('Kochfenster: Knopf „Ausbauen ★“, Titel noch ohne Stern', /Ausbauen ★/.test(v.btn) && v.h2 === 'Kochnische', v);
check('Ausbau-Menü: Stufe, Preis, „Ausbauen ★“', v.menu.includes('Ausbauen ★') && /Kochnische → ★/.test(v.title || ''), v);
v = await ev(async () => {
  const s = game.scene.getScene('play'), d0 = s.box.save.deltas; nomad.choose('Ausbauen ★'); nomad.step(5);
  for (let i = 0; i < 30 && !game.scene.getScene('play')?.camp; i++) { nomad.step(10); await new Promise(r => setTimeout(r, 50)); }
  const s2 = game.scene.getScene('play'), save = s2.box.save, U = await import('/game/upgrades.js'), w = U.benchAt(save, window.__p);
  nomad.step(5);
  const labels = (s2.camp.labels || []).map(t => t.text);
  s2.camp.use('kochnische', window.__p); nomad.step(2); const h2 = document.querySelector('.craft-box h2')?.textContent || '', btn = document.querySelector('.craft-up')?.textContent || '';
  s2.hud.craft.close();
  return { level: w.level, paid: d0 - save.deltas, labels, h2, btn };
});
check('Ausgebaut: Stufe 1, 100 Δ bezahlt, im Fenster „Kochnische ★“ und der nächste Knopf „Ausbauen ★★“', v.level === 1 && v.paid === 100 && v.h2 === 'Kochnische ★' && /Ausbauen ★★/.test(v.btn), v);
if (shots) { fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: 'output/upgrade_camp.png' }); }

// #099 a Speziallager: „Ausbauen ★“ in its own window, the grid grows
v = await ev(async () => {
  const s = game.scene.getScene('play'), save = s.box.save, C = await import('/game/crafting.js'), S = await import('/game/save.js');
  save.deltas = 3000; C.give(s.data_, save, 'kupferkabel', 3);
  save.rig.units.push({ kind: 'container', id: 'container_40', workshops: [{ id: 'kuehlraum', at: 0 }] }); S.fitContainers(s.data_, save);
  const key = `store:${save.rig.units.length - 1}:0`; window.__k = key;
  s.openContainer(key); nomad.step(2);
  const btn = document.querySelector('.inv-upgrade'), label = btn?.textContent || '', h0 = save.inv.grids[key].h;
  btn?.click(); nomad.step(2);
  const menu = (s.hud.menuItems || []).map(x => x.label);
  nomad.choose('Ausbauen ★'); nomad.step(5);
  for (let i = 0; i < 30 && !game.scene.getScene('play')?.camp; i++) { nomad.step(10); await new Promise(r => setTimeout(r, 50)); }
  const save2 = game.scene.getScene('play').box.save;
  return { label, menu, h0, h1: save2.inv.grids[key]?.h };
});
check('#099 Speziallager: „Ausbauen ★“ im Lager-Fenster, eine Reihe mehr', /Ausbauen ★/.test(v.label) && v.menu.includes('Ausbauen ★') && v.h1 === v.h0 + 1, v);

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(errors.length ? `${ok.length} ok, ${errors.length} Fehler` : `Ausbau: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);

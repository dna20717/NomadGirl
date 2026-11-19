// Menus with choices side by side (Daniel 19.11.2026: „im Dialog-Menü sind die Optionen horizontal angeordnet, aber nur vertikale
// Eingaben funktionierten“): the columns come from the layout; ←/→ go along a row, ↑/↓ a whole row; a one-column menu stays as it was.
// Server must run (npm run serve).   node tools/menu_nav_test.mjs
import { chromium } from 'playwright';
import { furnishedStart } from './test_fixture.mjs';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
await furnishedStart(page);
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 20000 });
const ev = f => page.evaluate(f);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);

// a talk with many answers: the dialog grid lays them out in columns
let v = await ev(() => {
  nomad.take(); nomad.step(5);
  const hud = game.scene.getScene('play').hud;
  hud.menu({ title: 'Test', sub: 'Gespräch', talk: { name: 'Schraube', initials: 'S' }, items: ['Eins', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs'].map(label => ({ label, act: () => {} })) });
  return { cols: hud.menuCols, i0: hud.menuIndex };
});
await page.keyboard.press('ArrowRight'); const right = await ev(() => game.scene.getScene('play').hud.menuIndex);
await page.keyboard.press('ArrowDown'); const down = await ev(() => game.scene.getScene('play').hud.menuIndex);
await page.keyboard.press('ArrowLeft'); const left = await ev(() => game.scene.getScene('play').hud.menuIndex);
check('Gespräch mit Antworten nebeneinander: Spalten aus dem Layout, → eins weiter, ↓ eine Reihe, ← zurück', v.cols >= 2 && right === 1 && down === 1 + v.cols && left === v.cols, { v, right, down, left });
await ev(() => game.scene.getScene('play').hud.closeMenu());
// a plain menu: one column, ↓ is the next one, ← does nothing
v = await ev(() => { const hud = game.scene.getScene('play').hud; hud.menu({ title: 'Liste', items: ['A', 'B', 'C'].map(label => ({ label, act: () => {} })) }); return hud.menuCols; });
await page.keyboard.press('ArrowDown'); const d1 = await ev(() => game.scene.getScene('play').hud.menuIndex);
await page.keyboard.press('ArrowLeft'); const l1 = await ev(() => game.scene.getScene('play').hud.menuIndex);
check('Einfache Liste: eine Spalte, ↓ der nächste, ← bleibt', v === 1 && d1 === 1 && l1 === 1, { v, d1, l1 });

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(errors.length ? `${ok.length} ok, ${errors.length} Fehler` : `Menü-Steuerung: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);

// Bit-Stapel mobile (/mobile, Daniel 17.11.2026: „Standalone mobile Variante“, nur Layout + Touch): on three phones the whole duel fits between
// the title and the bar, no sideways scrolling; the first tap on a pipeline only shows what the bit would do, the second sends it; the AI answers.
// Server must run (npm run serve).   node tools/mobile_test.mjs [--shots]
import fs from 'node:fs';
import { chromium, devices } from 'playwright';

const base = (process.env.GAME_URL || 'http://localhost:8766/game.html').replace(/game(\.html)?(\?.*)?$/, 'mobile.html');
const shots = process.argv.includes('--shots');
const browser = await chromium.launch();
const errors = [], ok = [];
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
for (const name of ['iPhone 13', 'iPhone SE', 'Pixel 5']) {
  const page = await browser.newPage({ ...devices[name] });
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  await page.goto(base + '?seed=33&tempo=schnell');
  await page.waitForFunction(() => window.duelDemo?.view?.canAct(), null, { timeout: 20000 });
  let r = await page.evaluate(() => { const a = document.querySelector('.sb-ai.player').getBoundingClientRect(), t = document.querySelector('.sb-ai.enemy').getBoundingClientRect(), bar = document.querySelector('.mb-bar').getBoundingClientRect(); return { top: t.top, headBottom: a.bottom, barTop: bar.top, sw: document.documentElement.scrollWidth, w: innerWidth, ghosts: document.querySelectorAll('.sb-ai canvas.glitch-face').length }; });
  check(`${name}: alles passt aufs Display (kein Abschneiden, kein Seitwärts-Scrollen), zwei Entities`, r.top >= 0 && r.headBottom <= r.barTop + 1 && r.sw <= r.w && r.ghosts === 2, r);
  await page.tap('.sb-pipe.player[data-col="0"]'); await page.waitForTimeout(80);
  r = await page.evaluate(() => ({ n: duelDemo.view.duel.sides.player.cols.flat().length, cursor: duelDemo.view.cursor, ghost: getComputedStyle(document.querySelector('.sb-pipe.player.cursor .sb-slot.ghost .sb-die') || document.body).visibility }));
  check(`${name}: erster Tipp zeigt nur die Vorschau`, r.n === 0 && r.cursor === 0 && r.ghost === 'visible', r);
  await page.tap('.sb-pipe.player[data-col="0"]'); await page.waitForTimeout(80);
  r = await page.evaluate(() => ({ n: duelDemo.view.duel.sides.player.cols.flat().length, turn: duelDemo.view.duel.turn }));
  check(`${name}: zweiter Tipp schickt das Bit, der Gegner ist dran`, r.n === 1 && r.turn === 'enemy', r);
  await page.waitForFunction(() => duelDemo.view.canAct() || duelDemo.view.duel.winner, null, { timeout: 20000 });
  if (shots) { fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/mobile_${name.replace(/\s/g, '_')}.png` }); }
  await page.close();
}
await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(errors.length ? `${ok.length} ok, ${errors.length} Fehler` : `Bit-Stapel mobil: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);

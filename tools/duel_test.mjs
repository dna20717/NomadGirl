// Glitch-Duell demo (#050, duel.html): cards with Code-Porträts, select → action → target, dice in the tray, the AI answers,
// „KI spielt für mich“ plays a duel to the end, Kammerjäger, the 1000× simulation. Server must run (npm run serve).
//   node tools/duel_test.mjs [--shots]   pictures to output/duel_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = (process.env.GAME_URL || 'http://localhost:8766/game.html').replace(/game(\.html)?(\?.*)?$/, 'duel.html');
const shots = process.argv.includes('--shots');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/duel_${n}.png` }); };

await page.goto(base + '?seed=42&foes=2&team=2&tempo=schnell');
await page.waitForFunction(() => window.duelDemo?.S.duel, null, { timeout: 15000 });
let r = await page.evaluate(() => ({ cards: document.querySelectorAll('.dl-card').length, faces: document.querySelectorAll('.dl-card canvas.glitch-face').length, turn: duelDemo.S.duel.turn, acts: [...document.querySelectorAll('.dl-act')].map(b => b.textContent.trim()) }));
check('Vier Karten mit Code-Porträts, Leyla beginnt, Aktionen Einflüstern/Verschränken/Kalibrieren', r.cards === 4 && r.faces === 4 && r.turn === 'player' && r.acts.join() === 'Einflüstern,Verschränken,Kalibrieren', r);
await page.click('.dl-card.player.pick'); await page.click('[data-action=link]');
r = await page.evaluate(() => document.querySelectorAll('.dl-card.target').length);
check('Glitchling gewählt, Verschränken: beide Gegner sind Ziele', r === 2, r);
await page.hover('.dl-card.target'); await shot('choose');
r = await page.evaluate(() => getComputedStyle(document.querySelector('.dl-card.target:hover .dl-preview') || document.body).display);
check('Vorschau am Ziel: erwartete Wunden', r === 'block', r);
await page.click('.dl-card.target');
r = await page.evaluate(() => ({ dice: document.querySelectorAll('.dl-tray .dl-die').length, answer: /Antwort/.test(document.querySelector('.dl-tray').textContent), turn: duelDemo.S.duel.turn }));
check('Würfel im Tablett, das Ziel antwortet, der Gegner ist dran', r.dice >= 2 && r.answer && r.turn === 'enemy', r);
await page.waitForFunction(() => duelDemo.S.duel.turn === 'player' && !duelDemo.S.busy || duelDemo.S.duel.winner, null, { timeout: 15000 });
r = await page.evaluate(() => duelDemo.S.duel.log.filter(e => e.type === 'act').map(e => e.uid[0]));
check('Die KI hat geantwortet (ein Zug des Gegners)', r.includes('e'), r);
await page.click('.dl-check input');
await page.waitForFunction(() => duelDemo.S.duel.winner, null, { timeout: 60000 });
r = await page.evaluate(() => ({ w: duelDemo.S.duel.winner, stamp: document.querySelectorAll('.dl-stamp').length, end: document.querySelector('.dl-status.end')?.textContent }));
check('„KI spielt für mich“ spielt das Duell zu Ende: Sieger, überschriebene Karten, Ende-Zeile', !!r.w && r.stamp >= 1 && /Gewonnen|Verloren/.test(r.end || ''), r);
await shot('end');
await page.goto(base + '?seed=3&foe=hunters&foes=3&team=2&tempo=schnell');
await page.waitForFunction(() => window.duelDemo?.S.duel, null, { timeout: 15000 });
r = await page.evaluate(() => [...document.querySelectorAll('.dl-card.enemy .dl-kind')].map(x => x.textContent));
check('Kammerjäger als Gegner (drei)', r.length === 3 && r.every(x => x === 'Kammerjäger'), r);
await page.click('text=1000× simulieren');
r = await page.textContent('.dl-sim');
check('1000× simulieren zeigt die Gewinnchance', /Du gewinnst \d+ %/.test(r || ''), r);
await shot('hunters');

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✘', e);
console.log(errors.length ? `${ok.length} ok, ${errors.length} Fehler` : `Glitch-Duell: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);

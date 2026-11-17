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
page.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/duel_${n}.png` }); };

await page.goto(base + '?mode=fight&seed=42&foes=2&team=2&tempo=schnell');
await page.waitForFunction(() => window.duelDemo?.S.duel, null, { timeout: 15000 });
let r = await page.evaluate(() => ({ cards: document.querySelectorAll('.dl-card').length, faces: document.querySelectorAll('.dl-card canvas.glitch-face').length, turn: duelDemo.S.duel.turn, acts: [...document.querySelectorAll('.dl-act')].map(b => b.querySelector('.dl-act-text').firstChild.textContent.trim()) }));
check('Vier Karten mit Code-Porträts, Leyla beginnt, Aktionen Sicherer Angriff/Harter Angriff/Stabilisieren', r.cards === 4 && r.faces === 4 && r.turn === 'player' && r.acts.join() === 'Sicherer Angriff,Harter Angriff,Stabilisieren', r);
await page.click('.dl-card.player.pick'); await page.click('[data-action=link]');
r = await page.evaluate(() => document.querySelectorAll('.dl-card.target').length);
check('Entity gewählt, Harter Angriff: beide Gegner sind Ziele', r === 2, r);
await page.hover('.dl-card.target'); await shot('choose');
r = await page.evaluate(() => getComputedStyle(document.querySelector('.dl-card.target:hover .dl-preview') || document.body).display);
check('Vorschau am Ziel: erwartete Wunden', r === 'block', r);
await page.click('.dl-card.target');
r = await page.evaluate(() => { const t = document.querySelector('.dl-tray').textContent; return { dice: document.querySelectorAll('.dl-tray .dl-die').length, answer: /Gegenschlag/.test(t) || /überschrieben|flackert!/.test(t), turn: duelDemo.S.duel.turn }; });
check('Würfel im Tablett, das Ziel schlägt zurück (wenn es noch steht und nicht flackert), der Gegner ist dran', r.dice >= 2 && r.answer && r.turn === 'enemy', r);
await page.waitForFunction(() => duelDemo.S.duel.turn === 'player' && !duelDemo.S.busy || duelDemo.S.duel.winner, null, { timeout: 15000 });
r = await page.evaluate(() => duelDemo.S.duel.log.filter(e => e.type === 'act').map(e => e.uid[0]));
check('Die KI hat geantwortet (ein Zug des Gegners)', r.includes('e'), r);
await page.click('.dl-check input');
await page.waitForFunction(() => duelDemo.S.duel.winner, null, { timeout: 60000 });
r = await page.evaluate(() => ({ w: duelDemo.S.duel.winner, stamp: document.querySelectorAll('.dl-stamp').length, end: document.querySelector('.dl-status.end')?.textContent }));
check('„KI spielt für mich“ spielt das Duell zu Ende: Sieger, überschriebene Karten, Ende-Zeile', !!r.w && r.stamp >= 1 && /Gewonnen|Verloren/.test(r.end || ''), r);
await shot('end');
await page.goto(base + '?mode=fight&seed=3&foe=hunters&foes=3&team=2&tempo=schnell');
await page.waitForFunction(() => window.duelDemo?.S.duel, null, { timeout: 15000 });
r = await page.evaluate(() => [...document.querySelectorAll('.dl-card.enemy .dl-kind')].map(x => x.textContent));
check('Kammerjäger als Gegner (drei)', r.length === 3 && r.every(x => x === 'Kammerjäger'), r);
await page.click('text=1000× simulieren');
r = await page.textContent('.dl-sim');
check('1000× simulieren zeigt die Gewinnchance', /Du gewinnst \d+ %/.test(r || ''), r);
await shot('hunters');
// Bit-Stapel (#051, Knucklebones principle) is the default mode: three columns per side with Code-Porträts, a rolled bit, click a column
await page.goto(base + '?seed=11&tempo=schnell');
await page.waitForFunction(() => window.duelDemo?.mode === 'stack' && duelDemo.S.duel, null, { timeout: 15000 });
r = await page.evaluate(() => ({ pipes: document.querySelectorAll('.sb-pipe').length, ais: document.querySelectorAll('.sb-ai canvas.glitch-face').length, reel: !!document.querySelector('.sb-reel .sb-window'), die: duelDemo.S.duel.die, turn: duelDemo.S.duel.turn, core: [...document.querySelectorAll('.dl-setup select')][0]?.options.length }));
check('Bit-Stapel: je eine KI mit Porträt und drei Pipelines, Walze, Leyla beginnt, drei AI-Cores zur Wahl', r.pipes === 6 && r.ais === 2 && r.reel && r.die >= 1 && r.die <= 6 && r.turn === 'player' && r.core === 3, r);
await page.hover('.sb-pipe.player.pick'); await shot('stack_hover');
r = await page.evaluate(() => { const g = document.querySelector('.sb-pipe.player.pick:hover .sb-slot.ghost .sb-die.ghost'); return !!g && getComputedStyle(g).visibility === 'visible'; });
check('Bit-Stapel: Vorschau beim Überfahren (das Bit als Geist in der Pipeline)', r, r);
r = await page.evaluate(() => { const s = document.querySelector('.sb-strip'); return { spin: s?.classList.contains('spin'), anim: s && getComputedStyle(s).animationName }; });
check('Bit-Stapel: Walze dreht sich nach dem Würfeln (oder steht danach)', r.spin === false || r.anim === 'sb-spin', r);
await page.click('.sb-pipe.player.pick');
r = await page.evaluate(() => ({ n: duelDemo.S.duel.sides.player.cols.reduce((s, c) => s + c.length, 0), turn: duelDemo.S.duel.turn }));
check('Bit-Stapel: Klick legt das Bit, der Gegner ist dran', r.n === 1 && r.turn === 'enemy', r);
await page.waitForFunction(() => duelDemo.S.duel.turn === 'player' && !duelDemo.S.busy, null, { timeout: 15000 });
await page.keyboard.press('2');
r = await page.evaluate(() => duelDemo.S.duel.log.filter(e => e.type === 'place' && e.side === 'player' && e.col === 1).length);   // placed into pipe 2 (it can be wiped again)
check('Bit-Stapel: Taste 2 legt in Spalte 2', r >= 1, r);
await page.click('.dl-check input');
await page.waitForFunction(() => duelDemo.S.duel.winner, null, { timeout: 60000 });
r = await page.evaluate(() => ({ w: duelDemo.S.duel.winner, end: document.querySelector('.sb-mid.end b')?.textContent, moves: duelDemo.S.duel.moves }));
check('Bit-Stapel: „KI spielt für mich“ spielt zu Ende, Sieger steht da', !!r.w && /ÜBERSCHRIEBEN|VERBINDUNG|ZUGRIFF/.test(r.end || ''), r);
await shot('stack_end');
await page.click('text=1000× simulieren');
r = await page.textContent('.dl-sim');
check('Bit-Stapel: 1000× simulieren', /Du gewinnst \d+ %/.test(r || ''), r);
// Daniel, 17.11.2026: „/duel lädt nicht“: what goes wrong is written on the page instead of a blank page
const bad = await browser.newPage();
await bad.route('**/game/stack_duel.js', r => r.fulfill({ status: 404, body: 'nope' }));
await bad.goto(base); await bad.waitForTimeout(2000);
r = await bad.textContent('#duel');
check('Fehler beim Laden steht auf der Seite (fehlende Datei)', /konnte nicht starten/.test(r) && /stack_ui\.js/.test(r), r);

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✘', e);
console.log(errors.length ? `${ok.length} ok, ${errors.length} Fehler` : `Glitch-Duell: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);

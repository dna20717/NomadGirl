// Bit-Stapel mobile (/mobile, Daniel 17.11.2026: „Standalone mobile Variante“, nur Layout + Touch): on three phones the whole duel fits between
// the title and the bar, no sideways scrolling; the first tap on a pipeline only shows what the bit would do, the second sends it; the AI answers.
// Haptics (Daniel: „Haptik und Touch sind auch wichtig“): a vibration pattern per event (pick, send, hit …), switchable; swipe up sends at once.
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
  await page.addInitScript(() => { window.__buzz = []; navigator.vibrate = p => { window.__buzz.push(p); return true; }; try { localStorage.removeItem('bitstapel.buzz'); localStorage.removeItem('nomad.haptics'); } catch {} });
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
  r = await page.evaluate(() => ({ kinds: duelDemo.S.buzzed, raw: window.__buzz.length }));
  check(`${name}: Vibration bei Antippen und Schicken (und beim Gegner-Zug, wenn er trifft)`, r.kinds[0] === 'pick' && /send|wipe/.test(r.kinds[1]) && r.raw >= 2, r);
  r = await page.evaluate(() => ({ sounds: [...duelDemo.S.sounds], on: duelDemo.S.soundOn, btn: !!document.querySelector('.mb-sound') }));
  check(`${name}: Ton bei Antippen und Schicken, Schalter da (#151)`, r.on && r.btn && r.sounds.includes('pick') && r.sounds.some(k => /send|wipe/.test(k)), r);
  // swipe up on a pipeline with room: sends at once
  const col = await page.evaluate(() => [2, 1, 0].find(i => duelDemo.view.duel.sides.player.cols[i].length < 3));
  const box = await page.locator(`.sb-pipe.player[data-col="${col}"]`).boundingBox();
  const before = await page.evaluate(() => duelDemo.view.duel.log.filter(e => e.type === 'place' && e.side === 'player').length);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.2, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(80);
  r = await page.evaluate(() => ({ n: duelDemo.view.duel.log.filter(e => e.type === 'place' && e.side === 'player').length, last: duelDemo.view.duel.log.filter(e => e.type === 'place').at(-1) }));
  check(`${name}: nach oben wischen schickt sofort`, r.n === before + 1 && r.last.col === col, { ...r, before, col });
  await page.click('.mb-buzz'); await page.waitForTimeout(50);
  const n0 = await page.evaluate(() => window.__buzz.length);
  await page.waitForFunction(() => duelDemo.view.canAct() || duelDemo.view.duel.winner, null, { timeout: 20000 });
  const free = await page.evaluate(() => [0, 1, 2].find(i => duelDemo.view.duel.sides.player.cols[i].length < 3 && duelDemo.view.picked !== i));
  if (free != null) await page.tap(`.sb-pipe.player[data-col="${free}"]`);
  r = await page.evaluate(n0 => ({ off: !duelDemo.S.buzzOn, same: window.__buzz.length === n0, stored: localStorage.getItem('nomad.haptics') }), n0);
  check(`${name}: Vibration abschaltbar (gemerkt)`, r.off && r.same && r.stored === '0', r);
  if (shots) { fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/mobile_${name.replace(/\s/g, '_')}.png` }); }
  await page.close();
}
// why bits vanish: framed red, linked, shattering, with a label (the AI plays both sides until something is wiped)
{
  const page = await browser.newPage({ ...devices['iPhone SE'] });
  await page.goto(base + '?seed=21&tempo=langsam');
  await page.waitForFunction(() => window.duelDemo?.view?.duel, null, { timeout: 20000 });
  await page.evaluate(() => { duelDemo.view.host.auto = () => true; duelDemo.view.step(); });
  const r = await page.evaluate(() => new Promise(res => { const t = setInterval(() => { if (duelDemo.view.wipe) { clearInterval(t); res({ dying: document.querySelectorAll('.sb-die.dying').length, striker: document.querySelectorAll('.sb-die.striker').length, link: document.querySelectorAll('.sb-pipe.wipe-link').length, label: document.querySelector('.sb-wipe-label')?.textContent || '', inside: (() => { const l = document.querySelector('.sb-wipe-label')?.getBoundingClientRect(); return !!l && l.left >= 0 && l.right <= innerWidth; })() }); } }, 5); setTimeout(() => res({ timeout: true }), 60000); }));
  check('Gelöschte Bits: rot gerahmt, beide Pipelines verbunden, zersplittern, Schild „gleiche Zahl → gelöscht“ im Bild', r.dying >= 1 && r.striker === 1 && r.link === 2 && /gleiche Zahl.*gelöscht/.test(r.label) && r.inside, r);
  if (shots) { await page.waitForTimeout(250); await page.screenshot({ path: 'output/mobile_wipe.png' }); }
  await page.close();
}
await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(errors.length ? `${ok.length} ok, ${errors.length} Fehler` : `Bit-Stapel mobil: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);

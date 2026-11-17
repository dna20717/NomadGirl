// Glitch-Duell in the game (#052): a machine with a KI at the gas station (Marken-Clutter „KI“) asks for a duel by E; the overlay is a window
// like the others (frame, ✕, hint line), pauses the game, plays by keyboard (arrows + E) and controller (padMenus → nav), Esc gives up
// (the duel counts), the switch asks for a duel and opens its door afterwards. Server must run (npm run serve).
//   node tools/glitch_duel_test.mjs [--shots]   pictures to output/glitch_duel_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?poi=tankstelle_km7&seed=3';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/glitch_duel_${n}.png` }); };
const ev = f => page.evaluate(f);
const ready = () => page.waitForFunction(() => { const v = game.scene.getScene('play').hud.duel.view; return v?.canAct() || v?.duel?.winner; }, null, { timeout: 20000 });

await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 120000 });
let r = await ev(() => { nomad.take(); const sc = game.scene.getScene('play'), h = sc.level.hosts(); if (!h.length) return { hosts: 0 }; nomad.tp(h[0].x - 40, h[0].feet - 4); nomad.step(12); return { hosts: h.length, p: nomad.state().prompt }; });
check('Automat mit KI: E-Hinweis „… anzapfen · Glitch-Duell“', r.hosts > 0 && /anzapfen · Glitch-Duell/.test(r.p || ''), r);
r = await ev(() => { nomad.step(1, [], ['grab']); nomad.step(2); const d = document.querySelector('.tut.gd'); return { open: game.scene.getScene('play').hud.duel.isOpen, frame: !!d?.querySelector('.gd-card.ui-frame'), x: !!d?.querySelector('.ui-x'), hints: d?.querySelector('.ui-hints')?.textContent || '', ghosts: d?.querySelectorAll('canvas.glitch-face').length, pipes: d?.querySelectorAll('.sb-pipe').length }; });
check('Overlay im Spielrahmen: ✕, Hilfezeile, zwei KIs, sechs Pipelines', r.open && r.frame && r.x && /Pipeline wählen/.test(r.hints) && /aufgeben/.test(r.hints) && r.ghosts === 2 && r.pipes === 6, r);
r = await ev(() => { const sc = game.scene.getScene('play'), x = sc.leyla.x; nomad.step(30, ['right']); return { moved: Math.abs(sc.leyla.x - x), paused: sc.physics.world.isPaused }; });
check('Das Spiel pausiert (Leyla läuft nicht)', r.moved < 1, r);
await ready(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('e'); await page.waitForTimeout(150);
r = await ev(() => game.scene.getScene('play').hud.duel.view.duel.log.filter(e => e.type === 'place' && e.side === 'player').length);   // placed bits (a placed one can be wiped again)
check('Tastatur: Pfeil + E schickt das Bit', r === 1, r);
await ready();
r = await ev(() => { const D = game.scene.getScene('play').hud.duel, before = D.view.cursor; D.nav({ keys: false, pressed: a => a === 'left' }); const mid = D.view.cursor; D.nav({ keys: false, pressed: a => a === 'ok' }); return { before, mid, n: D.view.duel.log.filter(e => e.type === 'place' && e.side === 'player').length }; });
check('Controller: Stick links wählt, A schickt', r.mid !== r.before && r.n >= 2, r);
await page.waitForTimeout(1400); await shot('mid');
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
r = await ev(() => { const sc = game.scene.getScene('play'); nomad.step(3); return { open: sc.hud.duel.isOpen, done: sc.level.hosts()[0].done, pause: !!sc.hud.modal || !!sc.hud.paused }; });
check('Esc gibt auf: Fenster zu, die KI ist weg, kein Pause-Menü', !r.open && r.done && !r.pause, r);
// the switch: a duel first, then the door opens
r = await ev(() => { const sc = game.scene.getScene('play'), sw = sc.level.switches[0]; nomad.tp(sw.x - 30, sw.feet - 4); nomad.step(12); const p = nomad.state().prompt; nomad.step(1, [], ['grab']); nomad.step(2); return { p, open: sc.hud.duel.isOpen, door: sw.door?.open }; });
check('Schalter: erst ein Glitch-Duell', r.p === 'Schalter hacken · Glitch-Duell' && r.open && !r.door, r);
r = await ev(() => { const sc = game.scene.getScene('play'), D = sc.hud.duel; D.quick(); return { winner: D.state().winner, end: document.querySelector('.gd-card .sb-mid.end b')?.textContent, go: !!document.querySelector('.gd-card .gd-go') }; });
await shot('end');
check('Am Ende: Ergebnis und „Weiter“', !!r.winner && /ÜBERSCHRIEBEN|VERBINDUNG/.test(r.end || '') && r.go, r);
await page.keyboard.press('e'); await page.waitForTimeout(200);
r = await ev(() => { const sc = game.scene.getScene('play'), sw = sc.level.switches[0]; nomad.step(60); return { open: sc.hud.duel.isOpen, on: sw.on, door: sw.door?.open, dueled: sw.dueled }; });
check('Nach dem Duell (gewonnen oder verloren) ist der Schalter umgelegt, die Tür offen', !r.open && r.on && r.dueled && r.door !== false, r);

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);   // ✖: tools/test_all.mjs shows these lines when the test is red
console.log(errors.length ? `${ok.length} ok, ${errors.length} Fehler` : `Glitch-Duell im Spiel: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);

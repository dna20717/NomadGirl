// #186 Lektionen beim ersten Mal (Daniel 23.11.2026: „hybrider Ansatz, wo es definiert ist, dass man es dort zum ersten Mal tut, da.
// Ansonsten, wenn man es das erste Mal tut … ohne den Spieler mit zu vielen Tutorial-Tipps hintereinander zu erschlagen“):
// the first run in Mile 7 is a Lehrpfad (only its lessons, as tips), a lesson comes when Leyla does it the first time, a pause between two,
// lessons outside the path wait, a freed system brings its lesson in the camp. Server must run or tools/test_all.mjs.
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new&slot=2';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await page.addInitScript(() => { localStorage.setItem('nomadgirl-unlocks-test', '1'); localStorage.setItem('nomadgirl-tutorial-test', 'true'); localStorage.removeItem('nomadgirl-tutorial-seen'); localStorage.removeItem('nomadgirl-tutorial-off'); sessionStorage.removeItem('nomadgirl-tutorial-session-off'); });
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 30000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
await ev(async () => { window.__U = await import('./game/unlocks.js'); nomad.take(); nomad.calm(); window.TU = () => game.scene.getScene('play').hud.tut; window.st = () => ({ tip: TU().tip?.id || null, open: TU().isOpen, lesson: TU().state().lesson, seen: [...TU().seen] }); });

// 1. the first run: „Laufen“ comes first, as a tip, the game runs on
let v = await ev(() => { nomad.step(260); return { ...st(), mode: game.scene.getScene('play').mode, first: !!game.scene.getScene('play').box.save.run?.first }; });
check('Erster Run in Mile 7: „Laufen“ als Tipp (Lehrpfad)', v.mode === 'run' && v.first && v.tip === 'laufen' && !v.open, v);
// 2. a pause: the first jump right after it does not bring „Springen“ yet
v = await ev(() => { TU().hideTip(game.scene.getScene('play').now); nomad.step(1, [], ['jump']); nomad.step(20, ['jump']); nomad.step(40); return st(); });
check('Gleich danach kein zweiter Tipp (Pause im Lehrpfad)', !v.tip, v);
// 3. after the pause: the first jump → „Springen“ (the first time she does it)
v = await ev(() => { TU().lastClose = -1e9; nomad.step(80); nomad.step(1, [], ['jump']); nomad.step(30, ['jump']); return st(); });
check('Erster Sprung nach der Pause → „Springen“', v.tip === 'springen', v);
// 4. off the path: a dash brings no lesson in the first run
v = await ev(() => { TU().hideTip(game.scene.getScene('play').now); TU().lastClose = -1e9; nomad.step(80); nomad.step(1, [], ['dash']); nomad.step(10, ['dash']); return st(); });
check('Dash ist nicht im Lehrpfad: keine Lektion im ersten Run', v.tip !== 'dash' && !v.seen.includes('dash'), v);

// 5. the camp: a freed system brings its lesson (Rig bauen → „Bauen“), as a card
await ev(() => { const s = game.scene.getScene('play'); s.box.save.run = { poi: 'tankstelle_km7', before: {} }; TU().hideTip(s.now); s.endRun(false); nomad.release(); });
await page.waitForFunction(() => game.scene.getScene('play')?.camp && game.scene.getScene('play').mode === 'camp', null, { timeout: 60000 }).catch(() => {});
v = await ev(() => { nomad.take(); nomad.step(60); const s = game.scene.getScene('play'); s.hud.sum?.close?.(); s.hud.closeMenu(); if (TU().isOpen) TU().close(); TU().lastClose = -1e9; TU().count = 0;
  window.__U.setUnlocked(s.data_, s.box.save, 'build', true); TU().unlocked('build'); nomad.step(60); return { ...st(), mode: s.mode }; });
check('Im Camp: frei gewordenes System bringt seine Lektion („Bauen“) als Karte', v.mode === 'camp' && v.open && v.lesson === 'bauen', v);
// 6. at most a few per camp visit
v = await ev(() => { const T = TU(); T.close(); T.count = 99; T.lastClose = -1e9; window.__U.setUnlocked(game.scene.getScene('play').data_, game.scene.getScene('play').box.save, 'travel', true); T.unlocked('travel'); nomad.step(60); const r = st(); T.count = 0; return r; });
check('Höchstens ein paar Lektionen je Besuch', !v.open, v);

await browser.close();
for (const o of ok) console.log('  ✓ ' + o);
for (const e of errors) console.log('  ✗ ' + e);
console.log(errors.length ? `${errors.length} Fehler` : `tutorial_path_test: alle ${ok.length} Prüfungen grün`);
process.exit(errors.length ? 1 : 0);

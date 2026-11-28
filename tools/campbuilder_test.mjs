// CampBuilder v2 (#196): plays the building toy with the remote control (window.campbuilder) like a controller would: a hill pulled
// up step by step, a hollow dug, ground painted and taken away, back and forth in time, the material wheel, the sun, the menu, the
// parcel growing, saving and loading again. Server must run (npm run serve).
//   node tools/campbuilder_test.mjs [--shots]   → output/campbuilder_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.CB_URL || 'http://localhost:8766/campbuilder.html');
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|Failed to load resource/.test(m.text())) errors.push(m.text()); });
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
const ev = (f, a) => page.evaluate(f, a);
const shot = async name => { if (shots) { await page.waitForTimeout(700); await page.screenshot({ path: `output/campbuilder_${name}.png` }); } };
fs.mkdirSync('output', { recursive: true });
await page.goto(url + '?new');
await page.waitForFunction(() => window.campbuilder?.state, null, { timeout: 60000 });
await page.waitForTimeout(600);
await shot('start');

// a hill: A at the surface, then up three, five tiles; the peak follows, back down to three gives the flanks back
let r = await ev(() => {
  const cb = campbuilder, out = {};
  cb.at(0, -1); cb.press('a'); cb.step(3);
  out.pending = cb.state().gesture;
  for (let y = -2; y >= -6; y--) { cb.at(0, y); cb.step(3); }
  out.mode = cb.state().gesture; out.peak5 = cb.surface(0); out.flank5 = cb.surface(5);
  cb.at(0, -4); cb.step(3); out.peak3 = cb.surface(0);
  cb.at(0, -7); cb.step(3); out.peak6 = cb.surface(0);
  cb.release('a'); cb.step(2);
  const st = cb.state(); out.history = st.history; out.gesture = st.gesture; out.notes = st.notes; out.played = st.tones.played; out.high = st.metrics.high;
  return out;
});
check('Hügel: am Boden A halten und hochziehen', r.pending === 'pending' && r.mode === 'hill', r);
check('Hügel: wächst Stufe für Stufe', r.peak5 === -5 && r.flank5 > -5 && r.flank5 <= 0 && r.peak3 === -3 && r.peak6 === -6, r);
check('Hügel: ein Schritt, Töne gespielt', r.history === 1 && r.gesture === null && r.played >= 3 && r.high === 6, r);
await shot('hill');

// a hollow: B at the surface, drag down
r = await ev(() => {
  const cb = campbuilder; cb.at(12, 0); cb.press('b'); cb.step(2);
  for (let y = 1; y <= 4; y++) { cb.at(12, y); cb.step(3); }
  const mode = cb.state().gesture; cb.release('b'); cb.step(2);
  return { mode, s: cb.surface(12), s2: cb.surface(16), history: cb.state().history };
});
check('Senke: B am Boden und runterziehen gräbt', r.mode === 'dig' && r.s === 4 && r.s2 >= 0 && r.history === 2, r);

// paint in the air (a ledge), with another material from RB; then take a tile away with B
r = await ev(() => {
  const cb = campbuilder; cb.press('rb'); cb.step(1); cb.release('rb'); cb.step(1);
  const set = cb.state().set;
  cb.at(-8, -4); cb.press('a'); cb.step(2);
  for (let x = -7; x >= -13; x--) { cb.at(x, -4); cb.step(1); }
  cb.release('a'); cb.step(2);
  const m = cb.model(), painted = [];
  for (let x = -13; x <= -8; x++) painted.push(cb.M.setAt(m, x, -4));
  cb.at(-10, -4); cb.press('b'); cb.step(2); cb.release('b'); cb.step(2);
  return { set, painted, gone: cb.M.setAt(m, -10, -4), history: cb.state().history };
});
check('Malen: RB wechselt das Material, A malt eine Kante in die Luft', r.set === 'concrete' && r.painted.every(v => v === 'concrete'), r);
check('Abtragen: B tippen nimmt eine Kachel', r.gone === null && r.history === 4, r);
await shot('paint');

// back in time (Select), forth (X), rewinding while held
r = await ev(() => {
  const cb = campbuilder, m = cb.model();
  cb.press('select'); cb.step(1); cb.release('select'); cb.step(1);
  const back = cb.M.setAt(m, -10, -4);
  cb.press('x'); cb.step(1); cb.release('x'); cb.step(1);
  const forth = cb.M.setAt(m, -10, -4);
  return { back, forth, h: cb.state().history, f: cb.state().future };
});
check('Zurück und vor', r.back === 'concrete' && r.forth === null && r.h === 4 && r.f === 0, r);
r = await ev(async () => {
  const cb = campbuilder; cb.press('select');
  const t0 = performance.now(); while (performance.now() - t0 < 1800) { cb.step(1); await new Promise(res => setTimeout(res, 16)); }
  cb.release('select'); cb.step(1);
  return { h: cb.state().history, f: cb.state().future, peak: cb.surface(0) };
});
check('Zurückspulen: Select halten spult alles zurück', r.h === 0 && r.f === 4 && r.peak === 0, r);
await ev(() => { const cb = campbuilder; for (let i = 0; i < 4; i++) { cb.press('x'); cb.step(1); cb.release('x'); cb.step(1); } });
check('Wieder vorgespult', (await ev(() => campbuilder.surface(0))) === -6, null);

// the material wheel: LB held, right stick points, letting go chooses
r = await ev(async () => {
  const cb = campbuilder; cb.press('lb'); cb.step(1);
  await new Promise(res => setTimeout(res, 260)); cb.step(1);
  const open = cb.state().hud.wheel;
  cb.rstick(0, 1); cb.step(2);
  const name = document.querySelector('[data-wname]').textContent;
  cb.release('lb'); cb.rstick(0, 0); cb.step(2);
  return { open, name, set: cb.state().set, closed: !cb.state().hud.wheel };
});
check('Material-Rad: LB halten, Stick zeigt, loslassen wählt', r.open && r.closed && r.name && r.set !== 'concrete', r);
await shot('wheel_after');

// the sun: Y held, the stick turns the hour; night comes
r = await ev(async () => {
  const cb = campbuilder, h0 = cb.state().hour; cb.press('y'); cb.stick(1, 0);
  const t0 = performance.now(); while (performance.now() - t0 < 900) { cb.step(1); await new Promise(res => setTimeout(res, 16)); }
  const open = document.querySelector('[data-clock]').classList.contains('open');
  cb.stick(0, 0); cb.release('y'); cb.step(1);
  return { h0, h1: cb.state().hour, open, time: document.querySelector('[data-time]').textContent, veil: cb.scene().sky.veil };
});
check('Uhr: Y halten und Stick dreht die Sonne', r.open && r.h1 > r.h0 + 0.5 && /^\d\d:\d\d$/.test(r.time), r);
await shot('clock');
await ev(() => campbuilder.scene().setHour(22.5));
await shot('night');
await ev(() => campbuilder.scene().setHour(11));
await shot('noon');
await ev(() => { const s = campbuilder.scene(); s.setHour(18.2); });

// the menu: Start opens, details off redraws the ground, B closes
r = await ev(() => {
  const cb = campbuilder; cb.press('start'); cb.step(1); cb.release('start'); cb.step(1);
  const open = cb.state().hud.menu, bakes = cb.state().bakes;
  for (let i = 0; i < 3; i++) { cb.press('down'); cb.step(1); cb.release('down'); cb.step(1); }
  cb.press('a'); cb.step(1); cb.release('a'); cb.step(1);
  const details = cb.scene().view.details;
  cb.press('a'); cb.step(1); cb.release('a'); cb.step(1);
  cb.press('b'); cb.step(1); cb.release('b'); cb.step(1);
  cb.scene().view.update(cb.scene().time.now, true);
  return { open, details, again: cb.scene().view.details, closed: !cb.state().hud.menu, more: cb.state().bakes > bakes };
});
check('Menü: Start, Lebendige Details aus und an, B schließt', r.open && r.details === false && r.again === true && r.closed && r.more, r);

// the parcel grows when one builds near its edge
r = await ev(() => {
  const cb = campbuilder, p0 = cb.state().parcel.slice();
  cb.at(p0[1] - 1, -1); cb.press('a'); cb.step(2); cb.release('a'); cb.step(2);
  return { p0, p1: cb.state().parcel };
});
check('Parzelle wächst am Rand', r.p1[1] > r.p0[1], r);

// the d-pad moves one tile; the magnet centres AvA
r = await ev(() => {
  const cb = campbuilder; cb.at(3, -2); const c0 = cb.state().cursor;
  cb.press('right'); cb.step(10); cb.release('right'); cb.step(30);
  const s = cb.scene();
  return { c0, c1: cb.state().cursor, off: Math.abs((s.cur.x % 64) - 32) };
});
check('Steuerkreuz: eine Kachel weiter, mittig', r.c1.x === r.c0.x + 1 && r.c1.y === r.c0.y && r.off < 3, r);

// HUD falls quiet when nothing happens
await page.waitForTimeout(4200);
check('Oberfläche wird leise', await ev(() => { campbuilder.step(1); return campbuilder.state().hud.quiet; }), null);

// save and load again
r = await ev(async () => { const ok = await campbuilder.save(); return { ok, m: campbuilder.state().metrics }; });
await page.goto(url);
await page.waitForFunction(() => window.campbuilder?.state, null, { timeout: 60000 });
const after = await ev(() => ({ peak: campbuilder.surface(0), m: campbuilder.state().metrics }));
check('Speichern und wieder laden', r.ok && after.peak === -6 && after.m.tiles === r.m.tiles, { r, after });
await shot('reloaded');

// touch: one finger builds a tile above the surface, two fingers zoom
r = await ev(() => {
  const s = campbuilder.scene(), h = s.hud, cv = game.canvas.getBoundingClientRect(), k = cv.width / s.scale.width;
  const sx = (32 + 20 * 64 - s.cam.worldView.x) * s.cam.zoom * k, sy = (-64 + 32 - s.cam.worldView.y) * s.cam.zoom * k + 70 * k;
  const pt = (x, y) => ({ at: [x, y, cv.width, cv.height], start: [x, y], t: 0 });
  h.onTouch('down', { n: 1, list: [pt(sx, sy)] }); campbuilder.step(2);
  h.onTouch('up', { n: 0, list: [] }); campbuilder.step(2);
  const tile = campbuilder.M.setAt(campbuilder.model(), 20, -1);
  const z0 = s.zoom;
  h.onTouch('down', { n: 2, list: [pt(400, 300), pt(600, 300)] });
  h.onTouch('move', { n: 2, list: [pt(350, 300), pt(650, 300)] });
  h.onTouch('up', { n: 0, list: [] });
  return { tile, z0, z1: s.zoom, touch: document.querySelector('.cb-hud').classList.contains('touch') };
});
check('Touch: ein Finger baut, zwei Finger zoomen', r.tile && r.z1 > r.z0 && r.touch, r);

console.log(`CampBuilder: ${ok.length} ok${errors.length ? `, ${errors.length} Fehler` : ''}`);
for (const e of errors) console.log('  ✗ ' + e);
await browser.close();
process.exit(errors.length ? 1 : 0);

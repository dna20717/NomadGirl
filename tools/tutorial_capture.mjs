#!/usr/bin/env node
// Records the clips and pictures of the field guide (#011) from the game itself: no new graphics (Daniel, 13.11.2026: „keine neuen
// Grafiken erzeugen, sondern Clips und Screenshots nutzen“). Every lesson has a little script below that plays the scene with the
// remote control (window.nomad); clips: a frame every 4 game frames (15 fps) → WebM (VP9, 640 px wide, ffmpeg), slides: one
// screenshot per page → WebP 960 px. Registers the assets (Assets › kind „Clip“ / „Bild“) and fills the lessons' clip / slides.
//   npm run serve &  node tools/tutorial_capture.mjs [lesson ids …]      (all lessons without ids)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pretty } from './json.js';

const BASE = process.env.GAME_URL || 'http://localhost:8766/game.html';
const OUT = 'projects/nomadgirl/assets/tutorial', TMP = fs.mkdtempSync('/tmp/tut-');
const want = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const lessons = JSON.parse(fs.readFileSync('projects/nomadgirl/data/tutorial.json', 'utf8'));
const pois = JSON.parse(fs.readFileSync('projects/nomadgirl/data/pois.json', 'utf8'));
pois.tankstelle_km7.seed = 7;   // the same level every time (like poi_test)

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('   Seite:', e.message));
await page.addInitScript(p => {
  localStorage.setItem('nomadgirl-tutorial-off', 'true');   // no cards while recording
  localStorage.setItem('nomadgirl-drafts:data/pois.json', JSON.stringify(p));
  // a controller that only acts when a script moves it (AvA's rubber band needs the right stick)
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', index: 0, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  window.setPad = (press = [], axes = [0, 0, 0, 0]) => { pad.buttons.forEach((b, i) => { b.pressed = press.includes(i); b.value = b.pressed ? 1 : 0; }); pad.axes = axes; };
  window.usePad = on => { navigator.getGamepads = on ? () => [pad, null, null, null] : () => [null, null, null, null]; };
  window.usePad(false);
}, pois);
const ev = (f, a) => page.evaluate(f, a);
const wait = ms => page.waitForTimeout(ms);

// ---------- the recorder ----------
const R = {
  async boot(q = '', { hud = false, hour = null, zoom = 1.9, zoomHud = false } = {}) {
    await page.setViewportSize(hud ? { width: 1600, height: 900 } : { width: 1280, height: 720 });   // windows fit completely, clips stay small
    await page.goto(BASE + q);
    await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.leyla, null, { timeout: 40000 });
    await ev(() => { nomad.take(); nomad.step(30); window.SC = () => game.scene.getScene('play'); window.T = SC().T; SC().hud.banner?.(null); });
    if (hour != null) await ev(h => { const s = nomad.save(); s.hour = h; SC().goCamp({}); nomad.step(40); }, hour);
    await this.hud(hud);
    if (!hud || zoomHud) await this.zoom(zoom);
    await ev(() => { nomad.step(60); SC().hud.banner?.(null); });   // the camera settles, „Willkommen im Camp“ goes
  },
  // clips come closer to Leyla (the game camera keeps following her)
  async zoom(z) { await ev(z => { const c = SC().cam; c.setZoom(c.zoom * z); nomad.step(2); }, z); },
  // hide the HUD for clips (the prompt stays), show it for windows
  async hud(on) {
    await page.addStyleTag({ content: on ? '.hud-top,.hud-foot,.hud-camp,.hud-buildbtn,.hud-openbtn{visibility:visible}' : '.hud-top,.hud-foot,.hud-camp,.hud-buildbtn,.hud-openbtn,.hud-toasts{visibility:hidden}' });
  },
  frames: [],
  async grab() {
    await ev(() => nomad.freeze()); await wait(110);
    const f = path.join(TMP, `f${String(this.frames.length).padStart(4, '0')}.png`);
    await page.screenshot({ path: f });
    await ev(() => nomad.thaw());
    this.frames.push(f);
  },
  // play n game frames, a picture every 4 (tap only in the first frame)
  async play(n, hold = [], tap = []) {
    for (let i = 0; i < n; i += 4) {
      await ev(([k, h, t]) => nomad.step(k, h, t), [Math.min(4, n - i), hold, i === 0 ? tap : []]);
      await this.grab();
    }
  },
  // play until test(state) (as JS text) is true
  async until(test, max = 240, hold = []) {
    for (let i = 0; i < max; i += 4) {
      const done = await ev(([t, h]) => { nomad.step(4, h); return new Function('s', `return (${t})`)(nomad.state()); }, [test, hold]);
      await this.grab();
      if (done) break;
    }
  },
  async step(n, hold = [], tap = []) { await ev(([k, h, t]) => nomad.step(k, h, t), [n, hold, tap]); },
  async clip(id) {
    const out = `${OUT}/${id}.webm`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '15', '-i', path.join(TMP, 'f%04d.png'), '-vf', 'scale=640:-2', '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-pix_fmt', 'yuv420p', '-row-mt', '1', '-an', out]);
    for (const f of this.frames) fs.unlinkSync(f);
    const n = this.frames.length; this.frames = [];
    return { file: `assets/tutorial/${id}.webm`, frames: n };
  },
  async slide(id) {
    await ev(() => nomad.freeze()); await wait(260);
    const png = path.join(TMP, `${id}.png`), out = `${OUT}/${id}.webp`;
    await page.screenshot({ path: png });
    await ev(() => nomad.thaw());
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=960:-2', '-c:v', 'libwebp', '-quality', '80', out]);
    fs.unlinkSync(png);
    return { file: `assets/tutorial/${id}.webp` };
  },
};

// ---------- helpers for the scenes ----------
const camp = (opts = {}) => R.boot('?camp&new', opts);
const room = (r = 'testraum', opts = {}) => R.boot(r === 'testraum' ? '' : `?room=${r}`, opts);
const tp = (col, row) => ev(([c, r]) => { nomad.tp(c * T, r * T); nomad.step(60); }, [col, row]);   // the camera settles before the first picture
const toRun = async (opts = {}) => { await camp(opts); await ev(() => { nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Karte'); nomad.step(3); nomad.choose('Plündern'); nomad.step(80); nomad.calm?.(); }); await R.hud(opts.hud ?? false); };
const nearEnemy = () => ev(() => { const e = nomad.state().enemies.find(x => x.alive !== false) || nomad.state().enemies[0]; nomad.tp(e.x - 230, e.feet ?? e.y); nomad.step(10); return e; });
const build = () => ev(() => { SC().openBuild(); nomad.step(40); window.BM = () => SC().hud.build; BM().follow = () => {}; });   // the camera stays where the script frames it

// ---------- the scripts: one per lesson; clips play, slides return after every page with R.slide ----------
const S = {
  // Bewegung (the parcours of the test room)
  laufen: async () => { await room(); await tp(6, 18); await R.play(56, ['right']); await R.play(48, ['right', 'walk']); await R.play(12); },
  springen: async () => { await room(); await tp(11, 18); await R.play(12, ['right']); await R.play(40, ['right', 'jump'], ['jump']); await R.until('s.leyla.ground', 60, ['right']); await R.play(8); await R.play(24, [], ['jump']); await R.play(16); },
  salto: async () => { await room(); await tp(64, 12); await R.until(`s.leyla.x > ${66.4 * 64}`, 120, ['right']); await R.play(16, ['right', 'jump'], ['jump']); await R.play(48, ['right', 'jump'], ['jump']); await R.until('s.leyla.ground', 80, ['right']); await R.play(12); },
  kanten: async () => { await room(); await tp(27.6, 18); await R.until(`s.leyla.x > ${29.3 * 64}`, 60, ['right']); await R.play(24, ['down']); await R.play(8, ['down', 'right']); await R.play(32); await R.play(28, [], ['down']); await R.play(8, [], ['up']); await R.until("s.leyla.state === 'normal'", 90); await R.play(16); },
  leitern: async () => { await room(); await tp(5.2, 18); await R.play(8); await R.play(64, ['up'], ['up']); await R.play(36, ['down']); await R.play(12); },
  dash: async () => { await room(); await tp(6, 18); await R.play(16, ['right']); await R.play(32, ['right'], ['dash']); await R.play(16, ['right']); await R.play(28, ['right'], ['dash']); await R.play(8); },
  slide: async () => { await room(); await tp(33, 18); await R.until(`s.leyla.x > ${36 * 64}`, 80, ['right']); await R.play(4, ['right'], ['down']); await R.until(`s.leyla.x > ${44 * 64}`, 160, ['right']); await R.play(8); },
  ducken: async () => { await room(); await tp(9, 18); await R.play(12); await R.play(40, ['down']); await R.play(16); await R.play(24, ['left']); await R.play(36, ['down']); await R.play(12); },
  seil: async () => { await room(); await tp(79.2, 12); await R.play(14, ['right', 'jump'], ['jump']); for (let i = 0; i < 8; i++) await R.play(4, ['right'], ['grab']); await R.until(`s.leyla.x > ${87.6 * 64}`, 80, ['right']); await R.play(4, [], ['jump']); await R.play(48); },
  // Kampf (the fight room)
  nahkampf: async () => { await room('kampfraum'); await nearEnemy(); await R.play(12, ['right']); for (let i = 0; i < 4; i++) await R.play(12, ['right'], ['melee']); await R.play(16); await R.play(64, ['melee']); await R.play(16); },
  schiessen: async () => { await room('kampfraum'); await nearEnemy(); await ev(() => nomad.step(1, ['left'])); await R.play(8); for (let i = 0; i < 4; i++) await R.play(12, ['right'], ['ranged']); await R.play(16); await R.play(40, ['ranged']); await R.play(12); },
  treffer: async () => { await room('kampfraum'); await nearEnemy(); await R.play(8); await ev(() => { const s = SC(), l = s.leyla; l.invulnerableUntil = 0; l.hurt(s.now, 9, l.x + 60); }); await R.play(28); await ev(() => { const s = SC(), l = s.leyla; l.invulnerableUntil = 0; l.hurt(s.now, 25, l.x + 60); }); await R.play(36); },
  beute: async () => { await room('kampfraum'); const e = await nearEnemy(); await R.play(8); await ev(() => { const en = SC().enemies?.list?.[0] || SC().enemies?.[0]; if (en?.hurt) for (let i = 0; i < 20 && en.alive !== false; i++) en.hurt?.(SC().now, 999, SC().leyla.x); }); for (let i = 0; i < 5; i++) await R.play(12, ['right'], ['melee']); await R.play(40); await R.until('false', 48, ['right']); await R.play(4, [], ['grab']); await R.play(20); },
  // AvA
  gummiband: async () => { await room(); await tp(20, 18); await ev(() => usePad(true)); await R.play(12); for (const ax of [[1, -0.6], [1, -0.2], [0.4, -1], [-0.6, -0.8]]) { await ev(a => setPad([], [0, 0, a[0], a[1]]), ax); await R.play(16); } await ev(() => setPad()); await R.play(28); await ev(() => usePad(false)); },
  plattform: async () => { await room(); await tp(12, 18);
    await ev(() => { const s = SC(), l = s.leyla, d = s.drone; window.__park = (x, top) => { const y = top + d.half - (d.d.platform?.inset ?? 14); d.x = x; d.y = y; d.parkAt = [x, y]; d.parkUntil = s.time.now + 1e7; }; __park(l.x + 30, l.feet - 120); nomad.step(3); });
    await R.play(12); await R.play(48, ['jump'], ['jump']); await R.play(24);
    await ev(() => { const l = SC().leyla; __park(l.x + 160, l.feet - 150); nomad.step(3); }); await R.play(8);
    await R.play(52, ['right'], ['jump']); await R.play(24); await ev(() => { const d = SC().drone; d.parkAt = null; d.parkUntil = 0; }); await R.play(24); },
  // Camp
  benutzen: async () => { await camp({ hour: 19 }); await ev(() => { const h = nomad.state().camp.hotspots.find(x => x.name === 'Kiste'); window.__x = h.x; nomad.tp(h.x - 320, SC().camp.ground); nomad.step(10); }); await R.until('Math.abs(s.leyla.x - window.__x) < 24', 120, ['right']); await R.play(16); await R.play(28, [], ['grab']); },
  feuer: async () => { await camp({ hour: 20 }); await ev(() => { const x = SC().camp.geo.fireX; window.__x = x; nomad.tp(x - 360, SC().camp.ground); nomad.step(10); }); await R.until('Math.abs(s.leyla.x - window.__x) < 40', 120, ['right']); await R.play(8); await R.play(60, [], ['grab']); await R.play(32); await R.play(28, ['left']); },
  lichterketten: async () => { await camp({ hour: 21 }); await ev(() => { nomad.save().deltas = 9999; }); await build();
    await ev(() => { const U = SC().camp.geo.units, g = SC().camp.geo; BM().frame({ x0: Math.min(...U.map(u => u.x0)) - 140, x1: g.vanRight + 140 }); nomad.step(30); }); await R.play(8);
    const A = await ev(() => SC().camp.anchors().map(a => ({ id: a.id, x: a.x, y: a.y })));
    const a = A.find(x => x.id === '1:1') || A[0], b = A.find(x => x.id === '0:0') || A[1], c = A.find(x => x.id === '1:0') || A[2];
    const glide = async (p, q) => { for (let k = 1; k <= 8; k++) { await ev(([x, y]) => { BM().ava ??= { on: true, x, y }; BM().ava.on = true; BM().aim({ x, y }); }, [p.x + (q.x - p.x) * k / 8, p.y + (q.y - p.y) * k / 8 + Math.sin(k / 8 * Math.PI) * 50]); await R.play(4); } };
    await ev(p => { BM().ava = { on: true, x: p.x, y: p.y }; BM().aim(p); }, a); await R.play(8); await ev(() => BM().padPress()); await R.play(4);
    await glide(a, b); await ev(() => BM().padPress()); await R.play(16);
    await ev(p => BM().aim(p), c); await R.play(4); await ev(() => BM().padPress()); await glide(c, a); await ev(() => BM().padPress()); await R.play(12);
    await ev(() => { BM().close(); }); await R.play(48); },
  // Im POI (Tankstelle, seed 7)
  kisten: async () => { await toRun(); await ev(() => { const c = [...nomad.state().level.chests].sort((a, b) => a.x - b.x)[0]; window.__c = c; nomad.tp(c.x - 260, c.feet); nomad.step(8); }); await R.until('Math.abs(s.leyla.x - (window.__c.x - 60)) < 20', 90, ['right']); await R.play(12); await R.play(40, [], ['grab']); },
  schalter: async () => { await toRun(); await ev(() => { const w = nomad.state().level.switches[0]; window.__w = w; nomad.tp(w.x - 240, w.feet ?? w.y); nomad.step(8); }); await R.until('Math.abs(s.leyla.x - window.__w.x) < 40', 90, ['right']); await R.play(8); await R.play(60, [], ['grab']); },
  waende: async () => { await toRun(); await ev(() => { const w = nomad.state().level.walls[0]; nomad.tp(w.x0 * T - 220, w.y1 * T); nomad.step(8); }); await R.play(24, ['right']); await R.play(8); await R.play(76, ['melee']); await R.play(40); },
  zurueck: async () => { await toRun(); await ev(() => { const v = SC().van; nomad.tp(v.x + 380, SC().leyla.feet); nomad.step(8); }); await R.until("/Van/.test(s.prompt || '')", 120, ['left']); await R.play(12); await R.play(24, [], ['grab']); await R.hud(true); await R.play(12); },
};

// slides: [setup, …] per page; each function sets the scene, then R.slide takes the picture
const W = (fn, ...a) => ev(fn, ...a);
const P = {
  nachladen: [async () => { await room('kampfraum', { hud: true }); await nearEnemy(); await R.step(2, [], ['ranged']); await R.step(30); }, async () => { await R.step(1, [], ['reload']); await R.step(12); }],
  gegner: [async () => { await room('kampfraum', { hud: true }); await ev(() => { const e = nomad.state().enemies[0]; nomad.tp(e.x - 420, e.feet ?? e.y); }); await R.step(60, ['right']); }, async () => { await ev(() => { const e = nomad.state().enemies[0]; nomad.tp(e.x + 160, e.feet ?? e.y); }); await R.step(40); }],
  stimmungen: [async () => { await camp({ hour: 18, hud: true, zoomHud: true }); await W(() => { nomad.drone('curious'); nomad.step(10); }); }, async () => { await W(() => { nomad.drone('alert'); nomad.step(10); }); }],
  inventar: [async () => { await camp({ hud: true }); await R.step(1, [], ['inventory']); await R.step(10); }, async () => { await W(() => { const U = a => ({ now: new Set([a]), down: x => x === a, pressed: x => x === a }), inv = SC().hud.inv, t = () => SC().now; inv.padNav(U('right'), t()); inv.focusId = 'cell:backpack:0:0'; inv.padShow?.(); nomad.step(2); }); }],
  raster: [async () => { await camp({ hud: true }); await R.step(1, [], ['inventory']); await R.step(10);
    const it = page.locator('.inv-grid[data-key="backpack"] .inv-item').first(), b = await it.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 30, { steps: 4 }); await R.step(4); },
    async () => { await page.mouse.click(700, 420, { button: 'right' }); await page.mouse.move(705, 425); await R.step(4); }],
  rueber: [async () => { await camp({ hud: true }); await W(() => { nomad.goTo('Kiste'); nomad.step(1, [], ['grab']); nomad.step(12); }); }, async () => { await W(() => { SC().hud.inv.close(); nomad.step(4); const s = nomad.save(), g = s.inv.grids.backpack; const it = g.items.shift(); if (it) SC().loot?.throwDown?.({ a: it.a, id: it.id, n: it.n, r: 0 }); nomad.step(30); nomad.step(1, [], ['inventory']); nomad.step(10); }); }],
  boden: [async () => { await camp({ hud: true }); await W(() => { for (const id of ['verband', 'schrottplatte']) SC().loot?.throwDown?.({ a: 'items', id, n: 2, r: 0 }); nomad.step(30); SC().openFloor?.() ?? nomad.step(1, [], ['inventory']); nomad.step(12); }); }, async () => { await W(() => { SC().hud.inv.close?.(); for (let i = 0; i < 2; i++) { nomad.step(40, ['right']); SC().loot?.throwDown?.({ a: 'items', id: 'kabelbaum', n: 1, r: 0 }); } nomad.step(30, ['left']); nomad.step(1, [], ['inventory']); nomad.step(12); }); }],
  implantate: [async () => { await camp({ hud: true }); await R.step(1, [], ['inventory']); await R.step(10); await page.locator('.inv-tab', { hasText: 'Implantate' }).first().click(); await R.step(4); }, async () => { await W(() => { const U = a => ({ now: new Set([a]), down: x => x === a, pressed: x => x === a }), inv = SC().hud.inv, t = () => SC().now; inv.padNav(U('right'), t()); nomad.step(2); }); }],
  schlafen: [async () => { await camp({ hud: true, hour: 22 }); await W(() => { nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(4); }); }, async () => { await W(() => { SC().hud.closeMenu(); const s = nomad.save(); s.hour = 7.2; SC().goCamp({}); nomad.step(60); }); }],
  kiste: [async () => { await camp({ hud: true }); await W(() => { const h = nomad.state().camp.hotspots.find(x => x.name === 'Kiste'); nomad.walkTo(h.x); nomad.step(10); }); }, async () => { await R.step(1, [], ['grab']); await R.step(12); }],
  kochen: [async () => { await camp({ hud: true }); await W(() => { SC().camp.use('kochnische'); nomad.step(10); }); }, async () => { await page.locator('.craft-supply').nth(0).click(); await page.locator('.craft-supply').nth(1).click(); await R.step(4); }],
  experimentieren: [async () => { await camp({ hud: true }); await W(() => { SC().camp.use('kochnische'); nomad.step(10); }); for (const k of [0, 2, 4]) await page.locator('.craft-supply').nth(k).click(); await R.step(4); }, async () => { await page.locator('button', { hasText: 'Ausprobieren' }).first().click(); await R.step(30); }],
  werkbank: [async () => { await camp({ hud: true }); await W(() => { SC().camp.use('werkbank'); nomad.step(10); }); }, async () => { await page.locator('button', { hasText: 'Herstellen' }).first().click(); await R.step(30); }],
  hydrokultur: [async () => { await camp({ hud: true }); await W(() => { const s = nomad.save(); s.rig.units.push({ kind: 'container', id: 'container_20', workshops: [{ id: 'hydrokultur', at: 0 }] }); s.garden = { '2:0': Array(30).fill(0) }; SC().goCamp({}); nomad.step(60); const h = SC().camp.hotspots.find(x => x.ws === 'hydrokultur'); nomad.goTo(h.name); nomad.step(10); }); }, async () => { await R.step(1, [], ['grab']); await R.step(6); }],
  zisterne: [async () => { await camp({ hud: true }); await W(() => { const s = nomad.save(); s.rig.units.push({ kind: 'container', id: 'container_20', workshops: [{ id: 'zisterne', at: 0 }] }); s.cistern = { '2:0': { water: 5.4, at: (s.day || 1) * 24 + (s.hour || 0) } }; SC().goCamp({}); nomad.step(60); const h = SC().camp.hotspots.find(x => x.ws === 'zisterne'); nomad.goTo(h.name); nomad.step(10); }); }, async () => { await R.step(1, [], ['grab']); await R.step(6); }],
  ripperdoc: [async () => { await camp({ hud: true }); await W(() => { const s = nomad.save(), D = SC().data_, id = Object.keys(D.workshops).find(k => D.workshops[k].function === 'cyber'); D.tractors.van.power = 9; s.rig.units.push({ kind: 'container', id: 'container_20', workshops: [{ id, at: 0 }] }); SC().goCamp({}); nomad.step(60); window.__rd = id; const h = SC().camp.hotspots.find(x => x.ws === id); nomad.goTo(h.name); nomad.step(10); }); }, async () => { await W(() => { SC().camp.use(window.__rd); nomad.step(10); }); }],
  bauen: [async () => { await camp({ hud: true }); await build(); await R.step(20); }, async () => { await W(() => { usePad(true); setPad([15]); nomad.step(3); setPad(); nomad.step(20); }); }],
  einbauen: [async () => { await camp({ hud: true }); await build(); await W(() => { const fr = (a, b) => { BM().frame({ x0: a, x1: b }); nomad.step(20); }, g = SC().camp.geo, U0 = g.units; const it = SC().camp.yardItems.find(x => x.id === 'werkbank'); BM().ava = { on: true, x: 0, y: 0 }; BM().aim({ x: (it.x0 + it.x1) / 2, y: (it.y0 + it.y1) / 2 }); BM().padPress(); nomad.step(4); fr(Math.min(...U0.map(u => u.x0)) - 200, g.vanRight + 160); const t = BM().navTargets().find(t => /Tauschen mit Kochnische/.test(t.label)); BM().aim(t); nomad.step(6); }); },
    async () => { await W(() => { const t = BM().navTargets().find(t => /Cryo/.test(t.label)) || BM().navTargets()[0]; BM().aim(t); nomad.step(6); }); }],
  anhaenger: [async () => { await camp({ hud: true }); await W(() => { nomad.save().deltas = 9999; }); await build(); await W(() => { const fr = (a, b) => { BM().frame({ x0: a, x1: b }); nomad.step(20); }, g = SC().camp.geo, U0 = g.units; BM().buy('containers', 'container_20'); nomad.step(80); const it = SC().camp.yardItems.find(x => x.kind === 'container'); BM().ava = { on: true, x: 0, y: 0 }; BM().aim({ x: (it.x0 + it.x1) / 2, y: (it.y0 + it.y1) / 2 }); BM().padPress(); nomad.step(4); fr(Math.min(...U0.map(u => u.x0)) - 900, g.vanRight + 160); const t = BM().navTargets().find(t => /Ankuppeln|einreihen/.test(t.label)); if (t) BM().aim(t); nomad.step(10); }); },
    async () => { await W(() => { const t = BM().navTargets().find(t => /stapeln/i.test(t.label)); if (t) BM().aim(t); nomad.step(10); }); }],
  solar: [async () => { await camp({ hud: true }); await W(() => { nomad.save().deltas = 9999; }); await build(); await W(() => { const fr = (a, b) => { BM().frame({ x0: a, x1: b }); nomad.step(20); }, g = SC().camp.geo, U0 = g.units; BM().buy('rigParts', 'solarpaneel'); nomad.step(80); const it = SC().camp.yardItems.find(x => x.kind === 'part'); BM().ava = { on: true, x: 0, y: 0 }; BM().aim({ x: (it.x0 + it.x1) / 2, y: (it.y0 + it.y1) / 2 }); BM().padPress(); nomad.step(4); fr(Math.min(...U0.map(u => u.x0)) - 200, g.vanRight + 160); const t = BM().navTargets().find(t => /Anschrauben/.test(t.label)); if (t) BM().aim(t); nomad.step(10); }); },
    async () => { await W(() => { BM().padPress(); nomad.step(30); BM().close(); nomad.step(60); }); }],
  haendler: [async () => { await camp({ hud: true }); await build(); await W(() => { BM().shopOpen = true; BM().draw(); nomad.step(20); }); }, async () => { await W(() => { const fr = (a, b) => { BM().frame({ x0: a, x1: b }); nomad.step(20); }, g = SC().camp.geo, U0 = g.units; BM().shopOpen = false; BM().draw(); const it = SC().camp.yardItems.find(x => x.id === 'lagerregal'); BM().ava = { on: true, x: 0, y: 0 }; BM().aim({ x: (it.x0 + it.x1) / 2, y: (it.y0 + it.y1) / 2 }); BM().padPress(); nomad.step(4); const Y = g.yard; fr(Y.x0 - 80, Math.max(Y.x1, SC().camp.dealer.x1) + 400); BM().aim({ x: SC().camp.dealer.x, y: SC().camp.ground - 140 }); nomad.step(10); }); }],
  budget: [async () => { await camp({ hud: true }); await build(); await R.step(20); }, async () => { await W(() => { const s = nomad.save(); s.rig.units.push({ kind: 'container', id: 'container_20', workshops: [{ id: 'werkbank', at: 0 }, { id: 'lagerregal', at: 1 }] }); s.rig.spare.workshops = []; BM().draw(); SC().camp.drawRig(); BM().draw(); nomad.step(10); }); }],
  karte: [async () => { await camp({ hud: true }); await W(() => { nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Karte'); nomad.step(10); }); await wait(800); }, async () => { await W(() => { const mp = SC().hud.map; mp.select(nomad.map().near[0]); nomad.step(4); }); await wait(500); }],
  fahren: [async () => { await camp({ hud: true }); await W(() => { nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Karte'); nomad.step(10); const mp = SC().hud.map; mp.select(nomad.map().near[1] || nomad.map().near[0]); nomad.step(4); }); await wait(800); }, async () => { await W(() => { document.querySelector('.wm-go')?.click(); nomad.step(70); }); await R.hud(true); }],
  pluendern: [async () => { await camp({ hud: true }); await W(() => { nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Karte'); nomad.step(10); SC().hud.map.select(nomad.save().location); nomad.step(4); }); await wait(800); }],
  warroom: [async () => { await camp({ hud: true }); await W(() => { const u = nomad.save().rig.units[0]; u.workshops = u.workshops.filter(w => w.at !== 1).concat({ id: 'warroom', at: 1 }); SC().goCamp({ keepPlace: true, fade: 0 }); nomad.step(40); nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(2); nomad.choose('Planen'); nomad.step(10); SC().hud.map.select(nomad.map().near[0]); nomad.step(4); }); await wait(800); },
    async () => { await page.mouse.move(640, 60); await wait(300); }],
  ziel: [async () => { await toRun({ hud: true }); await W(() => { const z = nomad.state().level.goals[0]; nomad.tp(z.x - 90, z.feet); nomad.step(8); }); }, async () => { await R.step(1, [], ['grab']); await R.step(4); }],
  ko: [async () => { await toRun({ hud: true }); await W(() => { nomad.step(60, ['right']); const s = SC(), l = s.leyla; l.invulnerableUntil = 0; l.hurt(s.now, 9999, l.x + 40); nomad.step(14); }); }, async () => { await W(() => { nomad.step(120); const p = SC().lostPack; if (p) { nomad.tp(p.x - 200, SC().leyla.feet); nomad.step(30); } }); }],
  tank: [async () => { await camp({ hud: true }); await W(() => { const h = SC().camp.hotspots.find(x => x.ws === 'cryotank'); nomad.goTo(h.name); nomad.step(10); }); }, async () => { await R.step(1, [], ['grab']); await R.step(10); }],
  techtree: [async () => { await camp({ hud: true }); await W(() => { const g = nomad.save().inv.grids.chest; g.items.push({ a: 'items', id: 'technik', n: 12, x: 0, y: 0, r: 0 }); SC().hud.tech.open(); nomad.step(10); }); await wait(500); }, async () => { await W(() => { SC().hud.tech.nav?.({ now: new Set(['right']), down: () => false, pressed: a => a === 'right' }); nomad.step(4); }); await wait(400); }],
  durchgang: [async () => { await camp({ hud: true }); await W(() => { const s = nomad.save(); s.tank.dead = true; SC().goCamp({}); nomad.step(10); }); await wait(2600); }, async () => { await wait(7000); await W(() => nomad.step(120)); }],
};

// ---------- run ----------
const A = JSON.parse(fs.readFileSync('projects/nomadgirl/data/assets.json', 'utf8'));
const done = [], failed = [];
for (const [id, l] of Object.entries(lessons)) {
  if (want.length && !want.includes(id)) continue;
  const t0 = Date.now();
  try {
    if (l.media === 'clip') {
      if (!S[id]) throw new Error('kein Drehbuch');
      R.frames = [];
      await S[id]();
      if (R.frames.length < 4) throw new Error('zu wenig Bilder');
      const c = await R.clip(`tut_${id}`);
      A[`tut_${id}`] = { name: `Feldhandbuch · ${l.name}`, kind: 'video', file: c.file, source: 'Code (aus dem Spiel aufgenommen, tools/tutorial_capture.mjs)', date: '13.11.2026', description: `Clip der Lektion „${l.name}“, ${c.frames} Bilder mit 15 fps, 640 px breit (WebM/VP9).` };
      l.clip = `tut_${id}`;
    } else {
      if (!P[id]) throw new Error('kein Drehbuch');
      const pages = P[id], slides = l.slides || [];
      for (let i = 0; i < pages.length; i++) {
        await pages[i]();
        const key = `tut_${id}_${i + 1}`, c = await R.slide(key);
        A[key] = { name: `Feldhandbuch · ${l.name} ${i + 1}`, kind: 'image', file: c.file, source: 'Code (Screenshot aus dem Spiel, tools/tutorial_capture.mjs)', date: '13.11.2026', description: `Bild ${i + 1} der Lektion „${l.name}“ (960 px, WebP).` };
        slides[i] = { ...(slides[i] || {}), look: key };
      }
      l.slides = slides;
    }
    done.push(id); console.log(`  ok  ${id} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (e) { failed.push(id); console.log(`  FEHLER ${id}: ${e.message.split('\n')[0]}`); R.frames.forEach(f => fs.existsSync(f) && fs.unlinkSync(f)); R.frames = []; }
}
fs.writeFileSync('projects/nomadgirl/data/assets.json', pretty(A) + '\n');
fs.writeFileSync('projects/nomadgirl/data/tutorial.json', pretty(lessons) + '\n');
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${done.length} aufgenommen${failed.length ? `, ${failed.length} fehlgeschlagen: ${failed.join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);

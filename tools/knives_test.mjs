// Headless check of the throwing knives (#176) in the Gegner-Arena: Z swaps grenade / knives, T throws the active one; the knife
// flies straight and fast (a little gravity), spins, hits one enemy (head = Kopftreffer), sticks in the thin wall and can be picked
// up again (charge back), charges come back one by one, no noise; Wende-Wurf with knives = a flat fan backwards; the grenade
// still flies (painted) and goes off; the HUD shows both throws with the active one lit.
// Pictures: output/wurf_176.jpg (contact sheet), output/knives_*.png. python3 -m http.server 8766 &  node tools/knives_test.mjs
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || `http://localhost:${process.env.TEST_PORT || 8766}/game.html`) + '?room=gegner_arena';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => !document.querySelector('#load.loading-on'), null, { timeout: 45000 });
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 45000 });
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const ev = (fn, arg) => page.evaluate(fn, arg);
fs.mkdirSync('output', { recursive: true });
// a picture around a point of the world (the game is 1920 × 1080 inside the 1280 × 720 page)
async function shotAt(name, wx, wy, w = 520, h = 292) {
  const r = await page.evaluate(([x, y]) => {
    const s = game.scene.getScene('play'), c = s.cam || s.cameras.main, v = c.worldView, R = game.canvas.getBoundingClientRect(), k = R.width / game.scale.width;
    return { x: R.left + (x - v.x) * c.zoom * k, y: R.top + (y - v.y) * c.zoom * k };
  }, [wx, wy]);
  await page.screenshot({ path: `output/${name}.png`, clip: { x: Math.max(0, Math.min(1280 - w, r.x - w / 2)), y: Math.max(0, Math.min(720 - h, r.y - h / 2)), width: w, height: h } });
}
const here = () => ev(() => { const l = KN.s.leyla; return [l.x, l.feet - 90]; });

await ev(() => {
  const s = game.scene.getScene('play'), T = s.T, FLOOR = 15 * T;
  nomad.take();
  window.KN = {
    s, T, FLOOR,
    reset(col = 12, kind = 'knife') {
      nomad.calm(); s.combat.clear(); s.throwables?.list.splice(0); nomad.step(2);
      const l = s.leyla, G = l.grenade, K = l.knives;
      l.invulnerableUntil = 1e12; l.health = l.maxHealth; l.attack = null; l.combo = null; l.state = 'normal'; l.tt = null;
      nomad.tp((col + 0.5) * T, FLOOR); l.facing = 1; nomad.step(20);
      l.stamina = l.maxStamina; G.charges = G.c.charges; G.refillAt = null; G.pose = null; K.charges = K.c.charges; K.refillAt = null; K.clear();
      G.active = kind;
      return l;
    },
    foe(id, col) { nomad.spawn(id, col, 14); const e = s.enemies.at(-1); e.S.sight = 0; e.readyAt = 1e12; e.hp = e.maxHp = 500; return e; },
  };
});

// ---------- swap: Z toggles, the HUD follows ----------
const sw = await ev(() => {
  const l = KN.reset(12, 'grenade'), out = {};
  nomad.step(2);
  out.a = nomad.state().throwKind; out.hudA = nomad.state().grenade.hud;
  nomad.step(1, [], ['throwSwap']); nomad.step(2);
  out.b = nomad.state().throwKind; out.hudB = nomad.state().grenade.hud;
  nomad.step(1, [], ['throwSwap']); nomad.step(2);
  out.c = nomad.state().throwKind;
  return out;
});
check('Umschalten: Z wechselt Granate → Messer → Granate', sw.a === 'grenade' && sw.b === 'knife' && sw.c === 'grenade', sw);
check('HUD: beide Würfe, der aktive leuchtet, Symbole statt Punkte', sw.hudA?.slots?.grenade?.active && !sw.hudA.slots.knife?.active && sw.hudB?.slots?.knife?.active && sw.hudB.slots.knife.icon && sw.hudB.slots.knife.pips === 4 && sw.hudB.slots.grenade.pips >= 1, sw);

// ---------- the knife: straight, fast, spinning, sticks in the thin wall (column 18), no noise ----------
const fly = await ev(() => {
  const { s } = KN, l = KN.reset(12), K = l.knives, out = {};
  s.lastNoise = null;
  out.before = K.state().charges;
  nomad.step(1, [], ['grenade']);
  const st = nomad.until(v => v.knives.flying.length > 0, 40);
  const a = st.knives.flying[0];
  nomad.step(3);
  const b = nomad.state().knives.flying[0];
  out.a = a; out.b = b; out.charges = nomad.state().knives.charges;
  nomad.until(v => v.knives.stuck.length > 0 || v.knives.flying.length === 0, 60);
  out.stuck = nomad.state().knives.stuck; out.noise = s.lastNoise; out.log = K.state().log;
  out.wallX = 18 * KN.T; out.leylaX = Math.round(l.x);
  return out;
});
const slope = fly.a && fly.b ? Math.abs((fly.b.y - fly.a.y) / Math.max(1, fly.b.x - fly.a.x)) : 9;
check('Messer: fliegt gerade und schnell nach rechts', fly.a && fly.a.vx > 1500 && Math.abs(fly.a.vy) < 120 && fly.b.x - fly.a.x > 60 && slope < 0.15, fly);
check('Messer: dreht sich im Flug', fly.a && fly.b && fly.a.rot !== fly.b.rot, fly);
check('Messer: kostet eine Ladung', fly.charges === fly.before - 1, fly);
check('Messer: steckt in der Wand (Spalte 18)', fly.stuck.length === 1 && fly.stuck[0].what === 'wall' && Math.abs(fly.stuck[0].x - fly.wallX) < 12, fly);
check('Messer: lautlos (kein Lärm)', !fly.noise, fly);

await ev(() => { KN.s.leyla.knives.c; nomad.step(8); nomad.freeze(); });
await page.waitForTimeout(300);
{ const [x, y] = await ev(() => { const t = KN.s.leyla.knives.stuck[0], l = KN.s.leyla; return t ? [(t.x + l.x) / 2, t.y] : [l.x, l.feet - 90]; }); await shotAt('knives_stuck', x, y, 360, 202); }
await ev(() => nomad.thaw());

// ---------- pick it up: walk to the wall, a charge back ----------
const pick = await ev(() => {
  const { s } = KN, l = s.leyla, K = l.knives, out = {};
  K.refillAt = null; out.before = K.state().charges;
  nomad.until(v => v.knives.stuck.length === 0, 160, ['right']);
  out.after = K.state().charges; out.picked = K.state().picked; out.stuck = K.state().stuck.length;
  return out;
});
check('Messer: aufsammeln gibt die Ladung zurück', pick.stuck === 0 && pick.picked >= 1 && pick.after === pick.before + 1, pick);

// ---------- charges and cooldown: all four, then empty, then one by one ----------
const cd = await ev(() => {
  const { s } = KN, l = KN.reset(5), K = l.knives, out = {}, n0 = K.state().thrown;
  for (let i = 0; i < 4; i++) { nomad.step(1, [], ['grenade']); nomad.step(16); }
  out.empty = K.state().charges; out.refillIn = K.state().refillIn; out.thrown = K.state().thrown - n0;
  nomad.step(1, [], ['grenade']); nomad.step(16);
  out.denied = K.state().thrown - n0 === out.thrown;
  out.hud = nomad.state().grenade.hud;
  const per = K.c.cooldown;
  nomad.until(() => K.state().charges >= 1, Math.ceil(per / 16) + 60);
  out.one = K.state().charges; out.next = K.state().refillIn;
  out.per = per;
  return out;
});
check('Ladungen: vier Messer, dann leer, kein fünfter Wurf', cd.thrown === 4 && cd.empty === 0 && cd.denied && cd.refillIn > 0 && cd.refillIn <= cd.per, cd);
check('Abklingzeit: einzeln, eine Ladung kommt zurück, die Uhr läuft weiter', cd.one === 1 && cd.next > cd.per * 0.8, cd);
check('HUD: leere Ladungen und Sekunden', cd.hud?.slots?.knife?.full === 0 && /\ds$/.test(cd.hud.slots.knife.time), cd);

// ---------- a hit: one enemy, damage, small knockback; head = Kopftreffer ----------
const hit = await ev(() => {
  const { s } = KN, l = KN.reset(20), K = l.knives, out = {};
  const e = KN.foe('schlaeger', 26); nomad.step(10);
  const hp0 = e.hp, x0 = e.x;
  nomad.step(1, [], ['grenade']);
  nomad.until(() => K.state().log.some(r => r.kind === 'hit' || r.kind === 'blocked'), 60);
  const r = K.state().log.filter(r => r.kind === 'hit').at(-1);
  out.hit = r; out.dmg = hp0 - e.hp; out.push = Math.round(e.x - x0);
  out.box = { top: Math.round(e.body.top), bottom: Math.round(e.body.bottom) };
  out.flying = K.state().flying.length;
  // a knife aimed at the head
  const hp1 = e.hp; K.spawn({ x: e.x - 200, y: e.body.top + 10, vx: 1900, vy: 0, time: s.now });
  nomad.step(12);
  out.head = K.state().log.filter(r => r.kind === 'hit').at(-1); out.headDmg = hp1 - e.hp;
  return out;
});
check('Treffer: Messer trifft den Gegner (Schaden, fliegt nicht weiter)', hit.hit && hit.dmg > 0 && hit.flying === 0, hit);
check('Treffer: Kopftreffer macht doppelt', hit.head?.head && hit.head.crit && hit.headDmg >= hit.dmg * 1.8, hit);

await ev(() => {
  const { s } = KN, l = KN.reset(20), K = l.knives;
  const e = KN.foe('schlaeger', 27); nomad.step(90);
  nomad.step(1, [], ['grenade']); nomad.until(() => K.state().flying.length > 0, 30); nomad.step(2);
  nomad.freeze();
});
await page.waitForTimeout(300);
{ const [x, y] = await here(); await shotAt('knives_flight', x + 160, y); }
await ev(() => nomad.thaw());

// ---------- running throw: she keeps running, the knife leaves faster than a grenade ----------
const run = await ev(() => {
  const { s } = KN, l = KN.reset(4), K = l.knives, G = l.grenade, out = {};
  nomad.step(20, ['right']);
  const t0 = s.now; nomad.step(1, ['right'], ['grenade']);
  nomad.until(() => K.state().flying.length > 0, 40, ['right']);
  out.knifeMs = Math.round(s.now - t0); out.vx = Math.round(l.body.velocity.x); out.state = l.state;
  nomad.step(30);
  KN.reset(4, 'grenade'); nomad.step(20, ['right']);
  const t1 = s.now; nomad.step(1, ['right'], ['grenade']);
  nomad.until(() => (s.throwables?.list || []).some(p => p.friendly), 60, ['right']);
  out.grenadeMs = Math.round(s.now - t1);
  return out;
});
check('Laufen: Messerwurf im Rennen, schneller als die Granate', run.vx > 200 && run.knifeMs > 0 && run.knifeMs < run.grenadeMs, run);

// ---------- Wende-Wurf with knives: a flat fan backwards, one charge ----------
const tt = await ev(() => {
  const { s } = KN, l = KN.reset(30), K = l.knives, out = {};
  out.before = K.state().charges;
  nomad.step(1, ['right'], ['dash']); nomad.step(3, ['right']);
  out.dash = l.state;
  nomad.step(1, ['left'], ['grenade']);
  out.state = l.state;
  nomad.until(() => K.state().flying.length > 0, 90);
  out.fly = K.state().flying; out.after = K.state().charges; out.facing = l.facing;
  out.turn = K.state().log.filter(r => r.kind === 'throw' && r.turn).length;
  nomad.step(1); nomad.freeze();
  return out;
});
await page.waitForTimeout(300);
{ const [x, y] = await here(); await shotAt('knives_turn', x - 160, y); }
await ev(() => nomad.thaw());
check('Wende-Wurf: Messer als Fächer flach nach hinten', tt.dash === 'dash' && tt.state === 'turnThrow' && tt.fly.length === 3 && tt.fly.every(p => p.vx < -1500 && Math.abs(p.vy) < 600) && tt.turn === 3, tt);
check('Wende-Wurf: der Fächer kostet eine Ladung', tt.after === tt.before - 1, tt);

// ---------- the grenade is still fine: painted, flies, goes off ----------
const gr = await ev(() => {
  const { s } = KN, l = KN.reset(8, 'grenade'), G = l.grenade, out = {};
  out.before = G.state().charges;
  nomad.step(1, [], ['grenade']);
  nomad.until(() => (s.throwables?.list || []).some(p => p.friendly), 60);
  nomad.step(6);
  out.img = (s.throwables.imgs || []).some(i => i.visible && i.texture.key === s.data_.leyla.grenade.sprite);
  out.after = G.state().charges;
  nomad.step(3); nomad.freeze();
  return out;
});
await page.waitForTimeout(300);
{ const [x, y] = await here(); await shotAt('knives_grenade', x + 160, y); }
const gr2 = await ev(() => {
  nomad.thaw();
  const { s } = KN, out = {};
  nomad.until(() => (s.throwables.log || []).some(r => r.kind === 'blast'), 200);
  out.blast = s.throwables.log.filter(r => r.kind === 'blast').length;
  nomad.step(4);
  out.ball = (s.throwables.imgs || []).some(i => i.visible && i.texture.key === s.data_.leyla.grenade.blastLook);
  nomad.freeze();
  return out;
});
await page.waitForTimeout(300);
{ const [x, y] = await here(); await shotAt('knives_blast', x + 200, y); }
await ev(() => nomad.thaw());
check('Granate: gemalt im Flug, eine Ladung, knallt mit Feuerball', gr.img && gr.after === gr.before - 1 && gr2.blast >= 1 && gr2.ball, { gr, gr2 });

// ---------- HUD picture ----------
await ev(() => { const l = KN.reset(12, 'knife'); l.knives.charges = 2; l.knives.refillAt = KN.s.now + 3000; nomad.step(3); nomad.freeze(); });
await page.waitForTimeout(300);
const box = await page.evaluate(() => { const r = document.querySelector('.hud-throw')?.getBoundingClientRect(); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; });
if (box) await page.screenshot({ path: 'output/knives_hud.png', clip: { x: Math.max(0, box.x - 260), y: Math.max(0, box.y - 50), width: Math.min(1280, box.w + 300), height: box.h + 80 } });
await ev(() => nomad.thaw());
check('HUD: Wurf-Anzeige sichtbar', !!box && box.w > 60, box);

// ---------- GIF: run, throw, the knife flies and sticks (output/wurfmesser.gif, ffmpeg if there) ----------
if (!process.env.NO_GIF) {
  fs.mkdirSync('output/_kngif', { recursive: true });
  await ev(() => { const l = KN.reset(8); nomad.step(60); });
  for (let i = 0; i < 34; i++) {
    await ev(i => { nomad.step(2, i < 22 ? ['right'] : [], i === 4 ? ['grenade'] : i === 12 ? ['grenade'] : []); nomad.freeze(); }, i);
    await page.waitForTimeout(120);
    await shotAt(`_kngif/f${String(i).padStart(3, '0')}`, 18 * 64 - 260, 15 * 64 - 110, 640, 360);
    await ev(() => nomad.thaw());
  }
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '15', '-i', 'output/_kngif/f%03d.png', '-vf', 'scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer', 'output/wurfmesser.gif']);
  } catch (e) { console.log('GIF übersprungen: ' + e.message.split('\n')[0]); }
  fs.rmSync('output/_kngif', { recursive: true, force: true });
}

// contact sheet (ImageMagick, if there)
try {
  const tile = (f, o) => execFileSync('convert', [f, '-resize', '640x360', '-background', '#0d0a12', '-gravity', 'center', '-extent', '640x360', o]);
  const T = ['knives_flight', 'knives_stuck', 'knives_turn', 'knives_grenade', 'knives_blast', 'knives_hud'].map((n, i) => { const o = `output/_kn${i}.png`; tile(`output/${n}.png`, o); return o; });
  execFileSync('convert', [T[0], T[1], T[2], '+append', 'output/_knr1.png']);
  execFileSync('convert', [T[3], T[4], T[5], '+append', 'output/_knr2.png']);
  execFileSync('convert', ['output/_knr1.png', 'output/_knr2.png', '-append', '-quality', '88', 'output/wurf_176.jpg']);
  for (const f of [...T, 'output/_knr1.png', 'output/_knr2.png']) fs.rmSync(f);
} catch (e) { console.log('Kontaktbogen übersprungen: ' + e.message.split('\n')[0]); }

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
console.log('Bilder: output/wurf_176.jpg, output/knives_*.png');
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Wurfmesser ok: ${ok.length} Prüfungen.`);

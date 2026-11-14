// Headless check of the enemy AI and of walls in combat (Daniel, 12.11.2026) in the room Gegner-Arena (game.html?room=gegner_arena).
// python3 -m http.server 8766 &  node tools/enemy_test.mjs [--shots]  (screenshot to output/enemy_arena.png)
// Walls: Leyla's strikes, the point-blank shot, nails (also very fast ones) and enemy strikes stop at walls; at a wall the gun stays at the chest
// and a strike pose slides her back. AI: sight only with a free line and in the cone, hearing (shots), searching, shield, armour, dodging,
// ambusher on the ceiling, flyer, shooter without a line holds fire.
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?room=gegner_arena';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => !document.querySelector('#load.loading-on'), null, { timeout: 15000 });
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 15000 });
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);

// helpers inside the page
await page.evaluate(() => {
  const s = game.scene.getScene('play'), T = s.T, FLOOR = 15 * T;
  nomad.take();
  window.A = {
    s, T, FLOOR,
    reset() { nomad.calm(); s.combat.clear(); const l = s.leyla; l.invulnerableUntil = 1e12; l.health = l.maxHealth ?? l.health; l.attack = null; l.combo = null; l.meleeReady = 0; l.rangedReady = 0; l.mag = l.magSize; nomad.step(2); },
    spawn(id, col, row = 14, o = {}) { nomad.spawn(id, col, row); const e = s.enemies.at(-1); Object.assign(e, o); return e; },
    // Leyla with her front edge `gap` px before x (facing dir)
    stand(x, dir = 1, gap = 1) { const l = s.leyla; nomad.tp(x - dir * (l.body.width / 2 + gap), FLOOR); l.facing = dir; nomad.step(2); },
    draw() { const l = s.leyla, F = l.fight; F.on = true; F.manual = 'on'; F.last = s.now; for (let i = 0; i < 90 && l.armed !== 'on'; i++) nomad.step(1); },
    holster() { const F = s.leyla.fight; F.on = false; F.manual = 'off'; nomad.step(40); },
    friendly(x, y, vx) { s.combat.spawn({ key: 'nail', x, y, vx, vy: 0, life: 1500, friendly: true, damage: 10, knockback: 0, crit: 0, time: s.now }); },
  };
});
const ev = fn => page.evaluate(fn);

// ---------- walls ----------
const wall = await ev(() => {
  const { s, T } = A, l = s.leyla, out = {};
  A.reset();
  const e = A.spawn('kriecher', 19, 14, { readyAt: 1e12 }); e.S.hearing = 0; e.M.patrol = 0;   // right behind the thin wall (column 18)
  A.stand(18 * T, 1, 1);
  const x0 = l.x, hp0 = e.hp;
  nomad.step(1, [], ['melee']); nomad.step(50);
  out.melee = { hp0, hp: e.hp, x0: Math.round(x0), x: Math.round(l.x), nudge: l.attack?.nudge?.dist ?? null };
  // the same hit in the open does hit
  A.reset();
  const f = A.spawn('kriecher', 26, 14, { readyAt: 1e12 }); f.S.hearing = 0; f.M.patrol = 0;
  A.stand(f.body.left - 30, 1, 0); const hp1 = f.hp;
  nomad.step(1, [], ['melee']); nomad.step(50);
  out.open = { hp1, hp: f.hp };
  // shot at the wall: drawn gun, muzzle behind the wall → sparks, no nail, gun at the chest
  A.reset();
  const g = A.spawn('kriecher', 19, 14, { readyAt: 1e12 }); g.S.hearing = 0; g.M.patrol = 0;
  A.stand(18 * T, 1, 1);
  A.draw();
  const mag = l.mag, n0 = s.combat.shots.length; l.rangedReady = 0;
  nomad.step(1, [], ['ranged']); const nails = s.combat.shots.length - n0; nomad.step(6);
  out.shot = { armed: l.armed, magUsed: mag - l.mag, nails, gunWall: l.gunWall, look: nomad.state().leyla.look, hp: g.hp, full: g.d.health };
  A.holster();
  // a very fast nail does not jump over the 64 px wall
  g.hp = g.d.health; A.friendly(17 * T, A.FLOOR - 100, 9000); nomad.step(20);
  out.fast = { hp: g.hp, full: g.d.health, left: s.combat.shots.filter(p => p.friendly).length };
  // an enemy strike does not go through the wall either
  A.reset(); l.invulnerableUntil = 0;
  const c = A.spawn('schlaeger', 19, 14); c.facing = -1; c.S.hearing = 0;
  A.stand(18 * T, 1, 2); const hp = l.health;
  c.state = 'windup'; c.windupEnd = s.now; c.readyAt = 0; nomad.step(30);
  out.enemyStrike = { hp, after: l.health, state: c.state };
  l.invulnerableUntil = 1e12;
  return out;
});
check('Wand: Hieb trifft nicht durch die dünne Wand', wall.melee.hp === wall.melee.hp0, wall.melee);
check('Wand: Hieb-Pose an der Wand = Leyla rutscht zurück', wall.melee.x0 - wall.melee.x >= 10, wall.melee);
check('Wand: derselbe Hieb trifft im Freien', wall.open.hp < wall.open.hp1, wall.open);
check('Wand: Schuss an der Wand = Funken, kein Nagel, Waffe an der Brust', wall.shot.magUsed === 1 && wall.shot.nails === 0 && wall.shot.gunWall && !/shoot|aim/.test(wall.shot.look || '') && wall.shot.hp === wall.shot.full, wall.shot);
check('Wand: schneller Nagel springt nicht über die Wand', wall.fast.hp === wall.fast.full && wall.fast.left === 0, wall.fast);
check('Wand: Gegner-Hieb geht nicht durch die Wand', wall.enemyStrike.after === wall.enemyStrike.hp, wall.enemyStrike);

// ---------- senses ----------
const sense = await ev(() => {
  const { s, T } = A, l = s.leyla, out = {};
  A.reset();
  // behind the wall: no sight
  const e = A.spawn('schlaeger', 20, 14, { readyAt: 1e12 }); e.S.hearing = 0; e.M.patrol = 0; e.facing = -1;
  A.stand(16 * T, 1, 0); nomad.step(60);
  out.wall = { state: e.state, seeing: e.seeing };
  // open floor, in front: notices her, reacts, engages
  A.reset();
  const f = A.spawn('schlaeger', 32, 14, { readyAt: 1e12 }); f.M.patrol = 0; f.facing = -1;
  A.stand(26 * T, 1, 0); const seen = []; for (let i = 0; i < 60; i++) { nomad.step(1); seen.push(f.state); }
  out.front = [...new Set(seen)];
  // behind its back (and further than "Spürt hinter sich"): nothing
  A.reset();
  const g = A.spawn('schlaeger', 30, 14, { readyAt: 1e12 }); g.M.patrol = 0; g.facing = -1; g.S.hearing = 0;
  A.stand(37 * T, -1, 0); nomad.step(60);
  out.back = { state: g.state, seeing: g.seeing };
  // hearing: Leyla shoots behind its back → it turns, goes looking, gives up after a while when she is gone
  g.S.hearing = 100; g.S.search = 1500;
  A.draw(); l.facing = 1; l.rangedReady = 0; nomad.step(1, [], ['ranged']); nomad.step(4);
  out.heard = { state: g.state, lastKnown: g.lastKnown && Math.round(g.lastKnown.x), lx: Math.round(l.x), noise: nomad.state().noise };
  A.holster();
  A.stand(6 * T, 1, 0);   // gone behind the thin wall
  const states = []; for (let i = 0; i < 420; i++) { nomad.step(1); states.push(g.state); }
  out.search = [...new Set(states)];
  return out;
});
check('Sicht: hinter der Wand sieht er sie nicht', sense.wall.state === 'patrol' && !sense.wall.seeing, sense.wall);
check('Sicht: von vorn bemerkt, kurze Reaktion, dann Angriff', sense.front.includes('alert') && sense.front.includes('engage'), sense.front);
check('Sicht: im Rücken bemerkt er sie nicht', sense.back.state === 'patrol' && !sense.back.seeing, sense.back);
check('Gehör: Schuss im Rücken alarmiert, er merkt sich die Stelle', ['alert', 'search', 'engage'].includes(sense.heard.state) && Math.abs(sense.heard.lastKnown - sense.heard.lx) < 80 && sense.heard.noise?.r > 0, sense.heard);
check('Suchen: geht hin, schaut sich um, gibt auf', sense.search.includes('search') && sense.search.at(-1) === 'patrol', sense.search);

// ---------- counters ----------
const counter = await ev(() => {
  const { s, T } = A, l = s.leyla, C = s.combat, out = {};
  A.reset();
  const e = A.spawn('schildtraeger', 30, 14, { readyAt: 1e12 }); e.facing = -1; e.M.patrol = 0;
  A.stand(e.body.left - 20, 1, 0); nomad.step(20); e.facing = -1; e.readyAt = 1e12;
  const hp0 = e.hp; A.friendly(e.x - 300, e.chest, 2200); nomad.step(20);
  out.shotFront = e.hp - hp0;
  C.melee(l, s.now); nomad.step(5); out.lightFront = e.hp - hp0; e.stunUntil = 0;
  C.melee(l, s.now, { damage: 2.5, range: 160, knockback: 220, heavy: true }); nomad.step(2);
  out.heavy = { dmg: e.hp - hp0, open: e.guardOpen, state: e.state };
  nomad.step(80); out.closed = !e.guardOpen;
  // from behind: a light hit lands
  e.facing = 1; e.C.turn = 1e9; const hp1 = e.hp; C.melee(l, s.now); nomad.step(2); out.back = e.hp - hp1;
  // armour: light hits scratch, heavy hits crack the plates
  A.reset();
  const p = A.spawn('panzerwache', 30, 14, { readyAt: 1e12 }); p.M.patrol = 0;
  A.stand(p.body.left - 20, 1, 0); p.readyAt = 1e12;
  const w = s.weapon('melee'), a0 = p.hp; C.melee(l, s.now); nomad.step(20); out.armorLight = { dmg: a0 - p.hp, weapon: w.damage, plates: p.plates };
  for (let i = 0; i < 2; i++) { p.stunUntil = 0; C.melee(l, s.now, { damage: 2.5, range: 160, knockback: 0, heavy: true }); nomad.step(20); }
  // #017 stable: stand next to it again (the heavy hits may have moved it), same reach as the heavy hits, a plain light hit
  p.stunUntil = 0; p.body.setVelocity(0, 0); A.stand(p.body.left - 20, 1, 0); nomad.step(2);
  out.plates = p.plates; const a1 = p.hp; C.melee(l, s.now, { damage: 1, range: 160, knockback: 0 }); nomad.step(5); out.afterArmor = a1 - p.hp;
  // dodging: a shooter that always dodges hops away from a nail
  A.reset();
  const d = A.spawn('schuetze', 40, 14, { readyAt: 1e12 }); d.C.dodge = 100; d.state = 'engage'; d.lastSeen = s.now; d.M.patrol = 0;
  A.stand(30 * T, 1, 0); d.readyAt = 1e12;
  const d0 = d.hp; A.friendly(d.x - 260, d.chest, 1400); const seen = []; for (let i = 0; i < 40; i++) { nomad.step(1); seen.push(d.state); }
  out.dodge = { states: [...new Set(seen)], dmg: d0 - d.hp };
  return out;
});
check('Schild: Schuss von vorn prallt ab', counter.shotFront === 0, counter);
check('Schild: leichter Hieb von vorn = Block', counter.lightFront === 0, counter);
check('Schild: schwerer Hieb öffnet die Deckung und trifft', counter.heavy.dmg < 0 && counter.heavy.open && counter.heavy.state === 'stagger', counter.heavy);
check('Schild: Deckung schließt sich wieder, von hinten trifft alles', counter.closed && counter.back < 0, counter);
check('Panzerung: leichter Hieb kratzt nur', counter.armorLight.dmg > 0 && counter.armorLight.dmg <= Math.ceil(counter.armorLight.weapon * 0.3) && counter.armorLight.plates === 2, counter.armorLight);
check('Panzerung: zwei schwere Treffer brechen die Platten, dann voller Schaden', counter.plates === 0 && counter.afterArmor > counter.armorLight.dmg, counter);
check('Ausweichen: hüpft vor dem Nagel weg, kein Treffer', counter.dodge.states.includes('dodge') && counter.dodge.dmg === 0, counter.dodge);

// ---------- ambusher, flyer, shooter ----------
const kinds = await ev(() => {
  const { s, T } = A, l = s.leyla, out = {};
  A.reset();
  const b = A.spawn('schleimbeisser', 44, 14);
  out.lurk = { state: b.state, ceiling: !!b.onCeiling, top: Math.round(b.body.top), want: 10 * T };
  A.stand(38 * T, 1, 0); nomad.step(30); out.waits = b.state;
  A.stand(45 * T, 1, 0); const seen = []; for (let i = 0; i < 120; i++) { nomad.step(1); seen.push(b.state); }
  out.drop = { states: [...new Set(seen)], ceiling: !!b.onCeiling, feet: Math.round(b.feet), floor: A.FLOOR };
  // flyer: stays in the air, flies over to her and shoots
  A.reset();
  const d = A.spawn('wachdrohne', 52, 6);
  nomad.step(60); out.hover = { feet: Math.round(d.feet), kind: d.kind };
  A.stand(50 * T, 1, 0); let fired = 0;
  for (let i = 0; i < 360; i++) { nomad.step(1); fired = Math.max(fired, s.combat.shots.filter(p => !p.friendly).length); }
  out.fly = { fired, feet: Math.round(d.feet), state: d.state, dy: Math.round(l.feet - d.feet) };
  // shooter that knows where she is, but has no line (thin wall): holds fire
  A.reset();
  const g = A.spawn('schuetze', 21, 14); g.facing = -1; g.M.patrol = 0;
  A.stand(16 * T, 1, 0);
  g.state = 'engage'; g.lastSeen = s.now; g.lastKnown = { x: l.x, y: l.chest, at: s.now };
  let shotsAtHer = 0; for (let i = 0; i < 240; i++) { nomad.step(1); shotsAtHer = Math.max(shotsAtHer, s.combat.shots.filter(p => !p.friendly).length); }
  out.blind = { shots: shotsAtHer, state: g.state };
  return out;
});
check('Lauerer: hängt an der Decke', kinds.lurk.state === 'lurk' && kinds.lurk.ceiling && Math.abs(kinds.lurk.top - kinds.lurk.want) < 4, kinds.lurk);
check('Lauerer: wartet, bis sie drunter ist', kinds.waits === 'lurk', kinds);
check('Lauerer: lässt sich fallen und kämpft am Boden', kinds.drop.states.includes('windup') && kinds.drop.states.includes('strike') && !kinds.drop.ceiling && kinds.drop.feet === kinds.drop.floor, kinds.drop);
check('Flieger: bleibt in der Luft', kinds.hover.kind === 'flyer' && kinds.hover.feet < A_FLOOR(), kinds.hover);
check('Flieger: kommt über sie und schießt', kinds.fly.fired > 0 && kinds.fly.dy > 100, kinds.fly);
check('Schütze: ohne Sichtlinie kein Schuss', kinds.blind.shots === 0, kinds.blind);
function A_FLOOR() { return 15 * 64 - 150; }

// boss (#016): below 60 % the Hausmeister roars, gets faster, winds up shorter, calls two helpers and sends floor waves
{
  const v = await ev(() => { nomad.restart(); const s = game.scene.getScene('play'); nomad.calm();
    nomad.spawn('hausmeister', 14, 14); const e = s.enemies.at(-1), sp = e.d.speed, wu = e.a.windup ?? 450; nomad.tpTile(8, 14); nomad.step(20);
    const n0 = s.enemies.filter(x => x.alive).length;
    e.hit(s.now, Math.ceil(e.maxHp * 0.45), 0, 1, false, { kind: 'melee', heavy: true }); nomad.step(80);
    const out = { phase: e.phase, faster: e.d.speed > sp, shorter: e.a.windup < wu, added: s.enemies.filter(x => x.alive).length - n0 };
    e.release(s.now, s.leyla); nomad.step(20); out.waves = s.combat.shots.filter(x => x.wave).length;
    return out; });
  check('Boss: Phase 2 unter 60 % (schneller, kürzer ausholen, 2 Helfer, Bodenwelle in beide Richtungen)', v.phase === 1 && v.faster && v.shorter && v.added === 2 && v.waves === 2, v);
}

if (shots) {
  fs.mkdirSync('output', { recursive: true });
  await ev(() => { nomad.restart(); A.s.leyla.invulnerableUntil = 1e12; nomad.tp(40 * 64, 960); nomad.step(90); nomad.freeze(); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'output/enemy_arena.png' });
}
await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Gegner ok: ${ok.length} Prüfungen.`);

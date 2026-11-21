// Headless check of the enemy traits (#139, docs/concepts/enemy_kit.md › 11) and Leyla's grenade (#140) in the Gegner-Arena.
// python3 -m http.server 8766 &  node tools/enemy_traits_test.mjs [--shots]   (pictures to output/traits_*.png)
// Sniper: laser follows with a delay, a chest in between breaks the lock, without cover the shot hits after „Aufschalten“.
// Medic: the fallen stands up after „Zurückholen dauert“ with „Steht auf mit“ %, a hit breaks it off, kills count on the final death.
// Alarm: after „Auslösen dauert“ everyone is alarmed and the adds are there; caught before = nothing; then he flees (Feigling).
// Werfer: landing marker before the bang, damage in the radius, nothing behind a wall, molotov leaves a fire that burns.
// Ergibt sich: kneels, E prompt, menu (gefangen nehmen only with a savegame), laufen lassen / erledigen.
// Granate (#140): T throws, charges count down, cooldown refills, the throw works while running.
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?room=gegner_arena';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [], pics = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => !document.querySelector('#load.loading-on'), null, { timeout: 15000 });
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 15000 });
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name, prep) => {
  if (!shots) return;
  await ev(() => { nomad.restart(); A.reset(); A.s.hud.banner(null); });
  await ev(prep);
  await page.waitForTimeout(350);
  const path = `output/traits_${name}.png`;
  await page.screenshot({ path });
  pics.push(path);
  await ev(() => nomad.thaw());
};
if (shots) fs.mkdirSync('output', { recursive: true });

await ev(() => {
  const s = game.scene.getScene('play'), T = s.T, FLOOR = 15 * T;
  nomad.take();
  window.A = {
    s, T, FLOOR,
    reset() {
      nomad.calm(); s.combat.clear(); s.testCovers = []; s.lastSiren = null; s.room.marks['!'] = []; s.alarmRoom = null;
      for (const e of s.enemies) e.pendingKill = false;
      const l = s.leyla; l.invulnerableUntil = 1e12; l.health = l.maxHealth; l.attack = null; l.combo = null; l.meleeReady = 0; l.rangedReady = 0;
      if (s.hud.modal) s.hud.closeMenu?.(true);
      nomad.step(2);
    },
    spawn(id, col, o = {}) { nomad.spawn(id, col, 14); const e = s.enemies.at(-1); e.S.hearing = 0; e.M.patrol = 0; Object.assign(e, o); return e; },
    stand(col, dir = 1) { const l = s.leyla; nomad.tp((col + 0.5) * T, FLOOR); l.facing = dir; nomad.step(2); },
  };
});

// ---------- sniper ----------
const sn = await ev(() => {
  const { s, T, FLOOR } = A, l = s.leyla, out = {};
  A.reset();
  const e = A.spawn('visier', 34, { facing: -1 });
  A.stand(24, 1);
  nomad.until(() => e.state === 'engage', 200);
  nomad.step(40);
  out.on = { on: e.sn.on, onLeyla: e.sn.onLeyla };
  // knocked off her (as if she jumped aside): the laser swings back at „Laser folgt mit“, not at once
  e.sn.ang += 0.6; nomad.step(1);
  out.lag = e.sn.onLeyla;
  let f = 0; for (; f < 120 && !e.sn.onLeyla; f++) nomad.step(1);
  out.catch = f;
  // a chest in between breaks the lock
  e.sn.lock = 0; A.stand(24, 1); nomad.until(() => e.sn.onLeyla && e.sn.lock > 600, 200);
  out.before = e.sn.lock;
  s.testCovers = [{ x: 29.5 * T, w: 80, top: FLOOR - 190, feet: FLOOR }];
  nomad.step(60);
  out.cover = { lock: e.sn.lock, blocked: e.sn.blocked, shots: e.sn.shots };
  // without cover: one hard shot after the lock time
  s.testCovers = []; l.invulnerableUntil = 0; e.readyAt = 0; e.sn.lock = 0;
  const hp = l.health; let n = 0;
  for (; n < 240 && e.sn.shots === 0; n++) nomad.step(1);
  out.lockFrames = n;
  nomad.until(() => l.health < hp, 60);
  out.hit = { hp, after: l.health, dmg: Math.round(hp - l.health), want: Math.round((e.d.damage ?? 9) * 2.5) };
  l.invulnerableUntil = 1e12;
  return out;
});
check('Scharfschütze: Laser liegt auf ihr', sn.on.on && sn.on.onLeyla, sn);
check('Scharfschütze: Laser folgt mit Verzögerung', sn.lag === false && sn.catch > 12 && sn.catch < 60, sn);
check('Scharfschütze: Kiste dazwischen bricht das Aufschalten', sn.before > 600 && sn.cover.lock === 0 && sn.cover.blocked === 'cover' && sn.cover.shots === 0, sn);
check('Scharfschütze: ohne Deckung trifft der Schuss nach dem Aufschalten', sn.lockFrames >= Math.floor(1400 / 16.7) - 2 && sn.hit.dmg === sn.hit.want, sn);
await shot('sniper', () => { const { s } = A; A.reset(); const e = A.spawn('visier', 34, { facing: -1 }); A.stand(26, 1); nomad.until(() => e.sn.onLeyla && e.sn.lock > 900, 300); s.leyla.facing = 1; nomad.freeze(); });

// ---------- medic ----------
const md = await ev(() => {
  const { s } = A, out = {};
  A.reset(); A.stand(4, 1);   // behind the thin wall, far away
  const m = A.spawn('flickerin', 34, { facing: -1 }); m.tc.surrender.chance = 0;
  const a = A.spawn('pistolero', 28, { facing: -1 });
  const k0 = s.kills;
  a.hit(s.now, 999, 0, 1, false, { kind: 'shot' });
  out.down = { pending: a.pendingKill, kills: s.kills - k0 };
  nomad.until(() => m.state === 'revive', 400);
  out.kneel = { state: m.state, kit: m.kitState };
  const t0 = s.now;
  nomad.until(() => a.alive, 400);
  out.up = { ms: Math.round(s.now - t0), hp: a.hp, want: Math.round(a.maxHp * 0.4), kills: s.kills - k0, left: m.medicLeft, state: a.state };
  nomad.step(80);
  out.after = a.state;
  // again, but a hit breaks it off
  a.hit(s.now, 999, 0, 1, false, { kind: 'shot' });
  nomad.until(() => m.state === 'revive', 400);
  nomad.step(20);
  m.hit(s.now, 1, 0, 1, false, { kind: 'shot' });
  nomad.step(5);
  out.broken = { medic: m.state, pending: a.pendingKill, reviver: !!a.reviver };
  // the medic falls: no one can fetch them, both kills count now
  m.tc.medic.max = 0; m.medicLeft = 0;
  m.hit(s.now, 999, 0, 1, false, { kind: 'shot' }); nomad.step(5);
  out.final = { kills: s.kills - k0, pending: a.pendingKill || m.pendingKill };
  return out;
});
check('Sanitäter: Gefallener liegt, Kill zählt noch nicht', md.down.pending && md.down.kills === 0, md);
check('Sanitäter: kniet am Gefallenen (Ducken-Pose)', md.kneel.state === 'revive' && md.kneel.kit === 'crouch', md);
check('Sanitäter: steht nach „Zurückholen dauert“ mit 40 % auf', Math.abs(md.up.ms - 2200) < 120 && md.up.hp === md.up.want && md.up.kills === 0 && md.up.left === 1, md);
check('Sanitäter: Zurückgeholter kämpft weiter', md.after !== 'dead' && md.after !== 'rise', md);
check('Sanitäter: Treffer bricht das Zurückholen ab', md.broken.medic !== 'revive' && md.broken.pending && !md.broken.reviver, md);
check('Sanitäter: Kills zählen erst beim endgültigen Tod', md.final.kills === 2 && !md.final.pending, md);
await shot('medic', () => { const { s } = A; A.reset(); A.stand(23, 1); const blind = e => { e.S.cone = 10; e.S.behind = 0; }; const m = A.spawn('flickerin', 31, { facing: 1 }); m.tc.surrender.chance = 0; blind(m); const a = A.spawn('pistolero', 27, { facing: 1 }); blind(a);
  a.hit(s.now, 999, 0, 1, false, { kind: 'shot' }); nomad.until(() => m.state === 'revive', 400); nomad.step(70); nomad.freeze(); });

// ---------- alarm + coward ----------
const al = await ev(() => {
  const { s, T } = A, out = {};
  A.reset();
  s.room.marks['!'] = [[27, 13]]; s.alarmRoom = null;
  A.stand(22, 1);
  const far = A.spawn('schlaeger', 60, { facing: 1 });   // patrolling far away, sees nothing
  const e = A.spawn('sirene', 30, { facing: -1 }); e.tc.alarm.addEnemy = 'pistolero';
  const n0 = s.enemies.filter(x => x.alive).length, t0 = s.now;
  nomad.until(() => e.al.phase === 'crank', 400);
  out.ran = { phase: e.al.phase, x: Math.round(e.x), point: Math.round(s.alarmPts[0].x) };
  nomad.until(() => e.al.phase === 'done', 400);
  out.ms = Math.round(s.now - t0);
  out.siren = s.lastSiren && { adds: s.lastSiren.adds.length, called: s.lastSiren.called.length };
  out.alive = s.enemies.filter(x => x.alive).length - n0;
  out.far = far.state;
  const x0 = e.x; nomad.step(60);
  out.flee = { fleeing: e.cw.fleeing, moved: Math.round(Math.abs(e.x - A.s.leyla.x) - Math.abs(x0 - A.s.leyla.x)) };
  // caught before: nothing happens
  A.reset(); s.alarmRoom = null; s.alarmPts = null; s.room.marks['!'] = [[40, 13]];
  A.stand(22, 1);
  const g = A.spawn('sirene', 32, { facing: -1 }); g.tc.alarm.addEnemy = 'pistolero';
  const n1 = s.enemies.filter(x => x.alive).length;
  nomad.until(() => g.al.phase === 'crank', 400);
  g.hit(s.now, 999, 0, 1, false, { kind: 'shot' });
  nomad.step(200);
  out.caught = { siren: s.lastSiren, alive: s.enemies.filter(x => x.alive).length - n1 + 1, phase: g.al.phase };
  return out;
});
check('Alarm: läuft zum Alarmpunkt', al.ran.phase === 'crank' && Math.abs(al.ran.x - al.ran.point) < 40, al);
check('Alarm: nach „Auslösen dauert“ alle im Alarm, Verstärkung da', al.ms >= 2500 && al.siren?.adds === 2 && al.alive === 2 && al.far !== 'patrol', al);
check('Alarm: Feigling rennt danach weg', al.flee.fleeing && al.flee.moved > 40, al);
check('Alarm: vorher erwischt = keine Sirene', al.caught.siren === null && al.caught.alive === 0 && al.caught.phase === 'dead', al);
await shot('alarm', () => { const { s } = A; A.reset(); s.alarmRoom = null; s.room.marks['!'] = [[40, 13]]; A.stand(33, 1); const e = A.spawn('sirene', 37, { facing: -1 }); e.tc.alarm.addEnemy = 'pistolero';
  nomad.until(() => e.al.phase === 'done', 500); nomad.step(20); nomad.freeze(); });

// ---------- grenadier + throwables ----------
const gr = await ev(() => {
  const { s, T, FLOOR } = A, l = s.leyla, out = {};
  A.reset(); A.stand(24, 1); l.invulnerableUntil = 0;
  const e = A.spawn('brandsatz', 32, { facing: -1 }); e.tc.grenadier.item = 'granate'; e.tc.grenadier.radius = 140;
  const hp = l.health;
  nomad.until(() => (s.throwables?.list || []).length > 0, 400);
  const p = s.throwables.list[0];
  out.marker = { mark: !!p?.mark, markX: Math.round(p?.mark?.x ?? 0), leyla: Math.round(l.x), blasts: s.throwables.log.filter(x => x.kind === 'blast').length };
  nomad.until(() => s.throwables.log.some(x => x.kind === 'blast'), 300);
  out.blast = s.throwables.log.find(x => x.kind === 'blast');
  out.hurt = Math.round(hp - l.health);
  l.invulnerableUntil = 1e12;
  // a wall in between: nothing behind it (enemy blast at Leyla behind the thin wall, Leyla's blast at an enemy behind it)
  A.reset(); A.stand(16, 1); l.invulnerableUntil = 0;
  const hp2 = l.health, Th = s.throwables;
  out.wallLeyla = Th.blast(19.4 * T, FLOOR - 40, { radius: 200, damage: 30, friendly: false }, s.now);
  const behind = A.spawn('kriecher', 17), open = A.spawn('kriecher', 21);
  out.wallEnemy = Th.blast(19.4 * T, FLOOR - 40, { radius: 200, damage: 30, friendly: true }, s.now).map(id => id);
  out.wallHp = { behind: behind.hp === behind.maxHp, open: open.hp < open.maxHp, leyla: l.health === hp2 };
  // molotov: a fire on the floor that burns her
  A.reset(); A.stand(24, 1); l.invulnerableUntil = 0;
  const hp3 = l.health;
  Th.throw({ x: 24.5 * T, y: FLOOR - 200, vx: 0, vy: 50, item: 'molotow', radius: 120, damage: 20, burn: 3, friendly: false, time: s.now });
  nomad.until(() => Th.areas.length > 0, 120);
  out.fire = { areas: Th.areas.length };
  l.health = hp3; const h0 = l.health;
  for (let i = 0; i < 90; i++) { l.invulnerableUntil = 0; nomad.step(1); }
  out.fire.burnt = Math.round(h0 - l.health);
  l.invulnerableUntil = 1e12;
  return out;
});
check('Werfer: Landemarke vor der Explosion', gr.marker.mark && gr.marker.blasts === 0 && Math.abs(gr.marker.markX - gr.marker.leyla) < 220, gr);
check('Werfer: Schaden im Radius', gr.blast?.hit?.includes('leyla') && gr.hurt > 0, gr);
check('Werfer: hinter der Wand kein Schaden', !gr.wallLeyla.includes('leyla') && gr.wallHp.leyla && gr.wallHp.behind && gr.wallHp.open, gr);
check('Werfer: Molotow lässt eine Feuerfläche, die brennt', gr.fire.areas === 1 && gr.fire.burnt > 0, gr);
await shot('grenade', () => { const { s, T, FLOOR } = A; A.reset(); A.stand(22, 1); const e = A.spawn('brandsatz', 32, { facing: -1 }); e.tc.grenadier.item = 'granate';
  nomad.until(() => s.throwables?.list?.[0]?.landedAt != null, 400); nomad.step(12);
  s.throwables.throw({ x: 27 * T, y: FLOOR - 300, vx: 0, vy: 0, item: 'molotow', radius: 110, damage: 1, burn: 4, friendly: false, time: s.now }); nomad.step(30); nomad.freeze(); });

// ---------- surrender ----------
const sr = await ev(() => {
  const { s } = A, out = {};
  const give = (col) => { const e = A.spawn('flickerin', col, { facing: -1 }); e.tc.surrender.chance = 100; e.tc.medic.heal = 0; e.S.sight = 0; e.hit(s.now, Math.ceil(e.maxHp * 0.75), 0, 1, false, { kind: 'shot' }); nomad.step(3); return e; };
  A.reset(); A.stand(24, 1);
  const e = give(26), k0 = s.kills;
  out.kneel = { state: e.state, kit: e.kitState };
  nomad.step(30);
  out.stays = e.state;
  A.stand(25, 1); nomad.step(2);
  out.prompt = nomad.state().prompt;
  nomad.step(1, [], ['grab']);
  const m = nomad.menu();
  out.menu = m && { title: m.title, items: (m.items || []).map(i => ({ label: i.label, disabled: !!i.disabled })) };
  nomad.choose('Laufen');
  nomad.step(120);
  out.free = { state: e.state, outcome: e.sr.outcome, kills: s.kills - k0 };
  const f = give(28);
  A.stand(27, 1); nomad.step(2); nomad.step(1, [], ['grab']); nomad.choose('Erledigen'); nomad.step(5);
  out.kill = { state: f.state, outcome: f.sr.outcome, kills: s.kills - k0 };
  // a hit that does not kill keeps him kneeling
  const g = give(30); g.hit(s.now, 1, 0, 1, false, { kind: 'shot' }); nomad.step(5);
  out.hitKneel = g.state;
  return out;
});
check('Ergeben: kniet (Ducken-Pose), schießt nicht mehr', sr.kneel.state === 'surrender' && sr.kneel.kit === 'crouch' && sr.stays === 'surrender' && sr.hitKneel === 'surrender', sr);
check('Ergeben: E-Hinweis und Auswahl (gefangen nehmen nur mit Spielstand)', /ergibt sich/.test(sr.prompt || '') && sr.menu?.items?.length === 3 && sr.menu.items[0].disabled && !sr.menu.items[1].disabled, sr);
check('Ergeben: laufen lassen = geht, zählt als besiegt', sr.free.state === 'dead' && sr.free.outcome === 'freed' && sr.free.kills === 1, sr);
check('Ergeben: erledigen', sr.kill.state === 'dead' && sr.kill.outcome === 'killed' && sr.kill.kills === 2, sr);
await shot('surrender', () => { const { s } = A; A.reset(); A.stand(23, 1); const e = A.spawn('flickerin', 26, { facing: -1 }); e.tc.surrender.chance = 100; e.tc.medic.heal = 0; e.S.sight = 0;
  e.hit(s.now, Math.ceil(e.maxHp * 0.75), 0, 1, false, { kind: 'shot' }); nomad.step(40); A.stand(25, 1); nomad.step(2); nomad.freeze(); });

// ---------- Leyla's grenade (#140) ----------
const lg = await ev(() => {
  const { s } = A, l = s.leyla, G = l.grenade, out = {};
  A.reset(); A.stand(22, 1);
  G.charges = null; G.refillAt = null;
  const e = A.spawn('kriecher', 31, { facing: -1, readyAt: 1e12 }); e.S.sight = 0;
  nomad.step(1, [], ['grenade']);
  out.pose = G.state().throwing;
  nomad.until(() => s.throwables.list.some(p => p.friendly), 60);
  out.flying = s.throwables.list.filter(p => p.friendly).length;
  const hp = e.hp;
  nomad.until(() => s.throwables.list.length === 0, 300);
  out.dmg = hp - e.hp;
  out.after1 = G.state();
  for (let i = 0; i < 3; i++) { nomad.step(1, [], ['grenade']); nomad.step(40); }
  out.empty = G.state();
  out.thrown = G.thrown;
  G.refillAt = s.now; nomad.step(2);
  out.refilled = G.state().charges; out.mode = G.c.refill;   // #156 Daniel: einzeln, je Ladung 60 s
  for (let i = 0; i < 3; i++) { G.refillAt = s.now; nomad.step(2); }
  out.full = G.state().charges;
  // while running: she keeps running, the grenade flies
  nomad.step(20, ['right']);
  const n = G.thrown;
  const st = nomad.step(1, ['right'], ['grenade']); nomad.step(20, ['right']);
  out.run = { vx: nomad.state().leyla.vx, state: nomad.state().leyla.state, thrown: G.thrown - n, look: st.leyla.look };
  nomad.step(200);
  return out;
});
check('Granate: T wirft (Wurf-Schicht), sie fliegt und trifft', lg.pose && lg.flying === 1 && lg.dmg > 0, lg);
check('Granate: Ladungen zählen runter, Abklingzeit läuft', lg.after1.charges === 2 && lg.after1.refillIn > 50000 && lg.empty.charges === 0 && lg.thrown === 3, lg);
check('Granate: einzeln, je Abklingzeit eine Ladung, dann voll (#156)', (lg.mode === 'each' ? lg.refilled === 1 : lg.refilled === 3) && lg.full === 3, lg);
check('Granate: Wurf im Rennen, sie rennt weiter', lg.run.thrown === 1 && lg.run.vx > 200 && lg.run.state === 'normal', lg);

await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (pics.length) console.log('Bilder: ' + pics.join(', '));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Bausteine ok: ${ok.length} Prüfungen.`);

// Headless check of the game (MVP Movement & Kampf): steps the test room without rendering and with scripted input.
// python3 -m http.server 8766 &  node tools/game_test.mjs [--shots]  (screenshots to output/)
// Uses game.headlessStep, so it is independent of the frame rate of the (software-rendered) headless browser.
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?room=kampfraum';   // the fight playground (the test room is a parcours without enemies)
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });   // no worker locally: /api/ answers 404
await page.goto(url);
await page.waitForSelector('#load', { state: 'detached', timeout: 15000 });
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 15000 });
if (shots) { fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: 'output/game_help.png' }); }

await page.evaluate(() => {
  const n = nomad, flat = v => ({ st: v.leyla.state, x: v.leyla.x, feet: v.leyla.feet, hp: v.leyla.health, ammo: v.leyla.ammo, mag: v.leyla.mag, armed: v.leyla.armed, reloading: v.leyla.reloading, kills: v.kills });
  n.take();
  window.t = {
    run: (frames, hold, tap) => flat(n.step(frames, hold, tap)),
    until(cond, max, hold = [], tap = []) { let v = flat(n.state()); for (let i = 0; i < max && !cond(v); i++) v = flat(n.step(1, hold, tap)); return v; },
    tp: (x, feet) => flat(n.tp(x, feet)),
    calm: () => n.calm(), restart: () => n.restart(),
    enemies: () => n.state().enemies,
  };
});
const t = (fn, ...a) => page.evaluate(([fn, a]) => { const f = new Function('t', 'a', `return (${fn})(t, ...a)`); return f(window.t, a); }, [fn.toString(), a]);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);

// 1. fight first: the Schläger comes, Leyla hits until he falls
let v = await t(t => t.tp(1350, 960));
let foes = await t(t => t.enemies());
for (let i = 0; i < 40 && foes.find(e => e.id === 'schlaeger')?.state !== 'dead'; i++) {
  await t(t => t.run(24, [], ['melee']));
  foes = await t(t => t.enemies());
}
v = await t(t => t.run(1));
check('Nahkampf: Schläger besiegt', v.kills >= 1, { v, foes });
// heavy melee: hold J for 3 s, release
v = await t(t => t.run(60));
const heavy = await page.evaluate(() => { const l = game.scene.getScene('play').leyla; nomad.step(1, ['melee'], ['melee']); nomad.step(185, ['melee']); const ready = !!l.charging?.ready; nomad.step(1); const atk = l.attack?.power?.heavy; return { ready, atk }; });
check('Nahkampf schwer: 3 s halten, loslassen', heavy.ready && heavy.atk, heavy);
v = await t(t => t.run(130));
check('Kampfmodus: ohne Gegner in Sicht steckt sie die Waffe weg', v.armed === 'off', v);
v = await t(t => t.run(2, [], ['ranged']));
check('Kampfmodus: Abzug zieht erst die Waffe', v.armed === 'drawing' && v.mag === 7, v);
v = await t(t => t.run(40));
v = await t(t => t.run(10, [], ['ranged']));
check('Fernkampf: Waffe gezogen, Schuss aus dem Magazin', v.armed === 'on' && v.mag === 6 && v.ammo === 33, v);
for (let i = 0; i < 12 && v.mag > 0; i++) v = await t(t => t.run(30, [], ['ranged']));
check('Magazin leer', v.mag === 0, v);
v = await t(t => t.run(2, [], ['ranged']));
check('Leer schießen lädt automatisch nach', v.reloading, v);
v = await t(t => t.run(100));
check('Nachgeladen: 7 Schuss, Vorrat 26', v.mag === 7 && v.ammo === 26 && !v.reloading, v);
v = await t(t => t.run(4, [], ['jump'])); const before = v.mag;
v = await t(t => t.run(3, [], ['ranged']));
check('Im Sprung kein Schuss', v.mag === before, v);
v = await t(t => t.run(80));

// combat mode (Q) and Cells-like: running with the gun, slide recoil, aim help at the shooter up on the ledge
const cm = await page.evaluate(() => {
  const s = game.scene.getScene('play'), L = () => nomad.state().leyla, out = {};
  try { localStorage.removeItem('nomadgirl-shoot-style'); } catch {}
  nomad.step(60);
  nomad.step(2, [], ['holster']); out.holster = L();
  nomad.step(2, [], ['holster']); nomad.step(40); out.drawn = L();
  nomad.step(50, ['right']); out.run = L();
  const shown = L().recoilShown, mag = L().mag;
  nomad.step(2, ['right'], ['ranged']); nomad.step(1, ['right']); out.shot = { ...L(), shown, mag0: mag, recoilNow: L().recoil };
  nomad.step(30);
  // aim help: on the little platform, the shooter stands on the ledge further right and a bit higher
  s.leyla.invulnerableUntil = 1e12;   // the shooter fires back: no knockback off the platform here
  nomad.tp(36 * 64, 576); s.leyla.facing = 1; nomad.step(2, [], ["ranged"]); nomad.step(75);
  const sh = s.enemies.find(e => e.id === 'schuetze' && e.alive); sh.body.reset(2846, sh.body.center.y); sh.body.setVelocity(0, 0);   // he patrols: put him back in range
  out.target = s.combat.findTarget(s.leyla)?.id || null;
  const n0 = s.combat.shots.length; s.leyla.rangedReady = 0;
  nomad.step(1, [], ['ranged']); const p = s.combat.shots.filter(q => q.friendly).at(-1);
  out.aim = p ? { vx: Math.round(p.vx), vy: Math.round(p.vy), n: s.combat.shots.length - n0 } : null;
  s.leyla.invulnerableUntil = 0;
  // classic: running holsters the gun
  localStorage.setItem('nomadgirl-shoot-style', 'classic');
  nomad.calm(); nomad.tp(22 * 64, 960); nomad.step(2, [], ['holster']); nomad.step(2, [], ['holster']); nomad.step(40); nomad.step(40, ['right']); out.classic = L();
  localStorage.removeItem('nomadgirl-shoot-style');
  nomad.step(2, [], ['holster']); nomad.step(300); out.calm = L();
  return out;
});
check('Kampfmodus: Q steckt weg (Ziehen rückwärts)', /holstering|off/.test(cm.holster.armed) && cm.holster.fight.manual === 'off', cm.holster);
check('Kampfmodus: Q zieht wieder', cm.drawn.armed === 'on' && cm.drawn.fight.on && cm.drawn.fight.manual === 'on', cm.drawn);
check('Cells-like: rennt mit Waffe (85 %)', cm.run.style === 'cells' && cm.run.armed === 'on' && cm.run.look === 'leyla_run_ready_side' && Math.abs(cm.run.vx - 374) < 8, cm.run);
check('Cells-like: Schuss im Rennen, Schlitten zuckt', cm.shot.mag === cm.shot.mag0 - 1 && cm.shot.recoilShown > cm.shot.shown && cm.shot.armed === 'on', cm.shot);
check('Zielhilfe: Schütze erfasst, Schuss fliegt schräg zu ihm', cm.target === 'schuetze' && cm.aim && cm.aim.vy < -20 && cm.aim.vx > 1000, cm);
check('Klassisch: im Rennen steckt sie die Waffe weg', cm.classic.style === 'classic' && cm.classic.armed === 'off' && cm.classic.vx > 400, cm.classic);
check('Kampfmodus: weggesteckt bleibt sie friedlich', !cm.calm.fight.on && cm.calm.armed === 'off', cm.calm);

// running in combat mode (Cells-like): gun at the chest, arms out when shooting, reloading in two halves, holstering via the holster; the step never jumps
const rv = await page.evaluate(() => {
  const s = game.scene.getScene('play'), l = s.leyla, key = () => l.sprite.anims.currentAnim?.key, idx = () => l.sprite.anims.currentFrame?.index, out = {};
  try { localStorage.removeItem('nomadgirl-shoot-style'); } catch {}
  nomad.calm(); nomad.tp(22 * 64, 960); nomad.step(80);
  nomad.step(2, [], ['holster']); nomad.step(40);
  nomad.step(30, ['right']); out.ready = key();
  const f0 = idx(); nomad.step(1, ['right'], ['ranged']); nomad.step(1, ['right']); out.shot = key(); out.keep = Math.abs(idx() - f0) <= 1 || Math.abs(idx() - f0) === 7;
  nomad.step(70, ['right']); out.back = key();
  nomad.tp(22 * 64, 960); nomad.step(20, ['right']); l.mag = 0; nomad.step(1, ['right'], ['reload']); nomad.step(4, ['right']); out.reload1 = key(); nomad.step(55, ['right']); out.reload2 = key();
  nomad.tp(22 * 64, 960); nomad.step(25, ['right']);
  nomad.step(1, ['right'], ['holster']); nomad.step(6, ['right']); out.h1 = key(); nomad.step(10, ['right']); out.h2 = key(); nomad.step(20, ['right']); out.h3 = key();
  return out;
});
check('Rennen im Kampfmodus: Waffe an der Brust', rv.ready === 'leyla_run_ready_side', rv);
check('Rennen + Schuss: Arme lang, Schritt bleibt', rv.shot === 'leyla_run_gun_side' && rv.keep, rv);
check('Rennen: nach dem Schuss wieder an die Brust', rv.back === 'leyla_run_ready_side', rv);
check('Rennen + Nachladen in zwei Hälften', rv.reload1 === 'leyla_run_reload_side' && rv.reload2 === 'leyla_run_reload2_side', rv);
check('Rennen: Wegstecken über die Hand am Holster', rv.h1 === 'leyla_run_ready_side' && rv.h2 === 'leyla_run_draw_side' && rv.h3 === 'leyla_run_side', rv);

// reload (Daniel, 11.11.2026, 1C): a jump does not stop it, a hit pauses it, the progress is kept and it carries on by itself
const rl = await page.evaluate(() => {
  const s = game.scene.getScene('play'), l = s.leyla, out = {};
  nomad.calm(); nomad.tp(22 * 64, 960); nomad.step(2, [], ['holster']); nomad.step(60);
  l.mag = 2; nomad.step(1, [], ['reload']); nomad.step(20);
  nomad.step(1, [], ['jump']); nomad.step(15); out.air = { reloading: !!l.reloading, armed: l.armed, ground: l.body.blocked.down };
  nomad.step(70); out.afterJump = l.mag;
  l.mag = 2; nomad.step(1, [], ['reload']); nomad.step(30);
  l.invulnerableUntil = 0; l.hurt(s.now, 5, l.x + 50); nomad.step(4); out.paused = !l.reloading && l.reloadSaved > 300; out.saved = Math.round(l.reloadSaved);
  out.hud = document.querySelector('.hud-reloading')?.textContent || null;
  nomad.step(110); out.afterHit = l.mag; out.left = l.reloadSaved;
  return out;
});
check('Nachladen läuft im Sprung weiter', rl.air.reloading && !rl.air.ground && rl.afterJump === 7, rl);
check('Treffer pausiert das Nachladen, Fortschritt bleibt, danach geht es weiter', rl.paused && rl.afterHit === 7 && !rl.left, rl);

// hit reaction (Leyla › Treffer): light and heavy animation, back to standing, running breaks it off after half the time
const hit = await page.evaluate(() => {
  const s = game.scene.getScene('play'), l = s.leyla, key = () => l.sprite.texture.key, out = {};
  nomad.calm(); nomad.tp(22 * 64, 960); nomad.step(60);
  l.invulnerableUntil = 0; l.hurt(s.now, 8, l.x + 50); nomad.step(7); out.light = key(); out.lightFrame = Number(l.sprite.frame.name); out.hp = l.health;
  nomad.step(30); out.after = key();
  l.invulnerableUntil = 0; l.hurt(s.now, 25, l.x + 50); nomad.step(9); out.heavy = key();
  nomad.step(18, ['right']); out.cancel = { key: key(), anim: !!l.hitAnim, vx: Math.round(l.body.velocity.x) };
  return out;
});
check('Treffer leicht: Animation, sitzt schnell', hit.light === 'leyla_hit_side' && hit.lightFrame >= 1, hit);
check('Treffer: danach wieder Stehen', !/hit/.test(hit.after), hit);
check('Treffer schwer ab 20 Schaden', hit.heavy === 'leyla_hit_heavy_side', hit);
check('Treffer: Laufen bricht ab der Hälfte ab', !hit.cancel.anim && !/hit/.test(hit.cancel.key), hit);

// movement without enemies
await t(t => { t.restart(); t.calm(); });
v = await t(t => t.tp(560, 960));
v = await t(t => t.until(v => v.x > 740, 60, ['right']));
v = await t(t => t.run(2, ['right'], ['down']));
check('Slide startet', v.st === 'slide', v);
v = await t(t => t.until(v => v.x > 1330, 200, ['right']));
check('Slide durch den Tunnel', v.x > 1330 && v.st === 'normal', v);

v = await t(t => t.tp(28 * 64, 960));
for (const want of [832, 704, 576]) { v = await t(t => t.run(30, ['right', 'jump'], ['jump'])); v = await t(t => t.run(10)); check(`Sprung auf Plattform ${want}`, v.feet === want, v); }
v = await t(t => t.run(3, ['down'], ['jump'])); v = await t(t => t.run(40));
check('Durch Plattform fallen', v.feet === 960, v);

v = await t(t => t.tp(48.5 * 64, 960));
v = await t(t => t.run(4, ['up'], ['up']));
check('Leiter greifen', v.st === 'climb', v);
v = await t(t => t.until(v => v.st !== 'climb', 300, ['up'])); const pulled = v.st;
v = await t(t => t.until(v => v.st === 'normal', 120)); v = await t(t => t.run(5));
check('Leiter hoch bis auf die Kante (oben seitlich hochziehen)', pulled === 'mantle' && v.feet === 7 * 64 && v.st === 'normal', { ...v, pulled });
v = await t(t => t.run(4, ['down'], ['down']));
check('Leiter runter', v.st === 'climb', v);

v = await t(t => t.tp(47.2 * 64, 448));
v = await t(t => t.run(14, ['right', 'jump'], ['jump']));
v = await t(t => t.until(v => v.st === 'swing', 20, ['right'], ['grab']));
check('Seil greifen', v.st === 'swing', v);
v = await t(t => t.until(v => v.x > 3560, 60, ['right']));
v = await t(t => t.run(2, ['right'], ['jump']));
v = await t(t => t.run(60, ['right']));
check('Schwingen bis aufs Plateau', v.feet === 7 * 64 && v.x > 58 * 64, v);

v = await t(t => t.tp(300, 960));
v = await t(t => t.run(12, [], ['dash']));
check('Dash', v.x > 300 + 200, v);

// drone: follows behind Leyla (decoration), shows moods
const dr = await page.evaluate(() => { nomad.calm(); nomad.step(90); const s = nomad.state(); return { lx: s.leyla.x, f: s.leyla.facing, ...s.drone, after: nomad.drone('kill') }; });
check('Drohne fliegt hinter Leyla', dr.mood && Math.sign(dr.lx - dr.x) === dr.f && Math.abs(dr.lx - dr.x) < 260, dr);
check('Drohne zeigt Stimmungen', dr.after === 'kill', dr);
// modular drone: the face layer changes with the mood, cables hang below and trail behind in flight
const df = await page.evaluate(() => {
  nomad.step(6); const kill = nomad.state().drone.face;
  nomad.drone('hit'); nomad.step(6); const hit = nomad.state().drone.face;
  nomad.calm(); nomad.step(200); const rest = nomad.state().drone;
  nomad.step(20, ['right']); const fly = nomad.state().drone;
  return { kill, hit, rest, fly };
});
check('Drohne: Gesicht wechselt mit der Stimmung', df.kill !== df.hit && df.kill > 0, df);
check('Drohne: Kabel hängen unten und schwingen nach', df.rest.cables.length >= 2 && df.rest.cables.every(([, y]) => y > df.rest.y)
  && df.fly.x > df.rest.x + 20 && df.fly.cables.some(([x], i) => x - df.fly.x < df.rest.cables[i][0] - df.rest.x - 4), df);

if (shots) await page.screenshot({ path: 'output/game_end.png' });
await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Spiel ok: ${ok.length} Prüfungen.`);

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

if (shots) await page.screenshot({ path: 'output/game_end.png' });
await browser.close();
console.log(ok.map(n => '✓ ' + n).join('\n'));
if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
console.log(`Spiel ok: ${ok.length} Prüfungen.`);

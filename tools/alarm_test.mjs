// Gruppen-Alarm (#039): who spots Leyla shouts, mates of the same family in reach come looking, other families do not, „Ruft andere“
// 0 calls nobody. Room Gegner-Arena (game.html?room=gegner_arena). Server must run (npm run serve).  node tools/alarm_test.mjs
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?room=gegner_arena';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 60000 });
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);

const run = call => page.evaluate(call => {
  const s = game.scene.getScene('play'), T = s.T;
  nomad.take(); nomad.calm();
  for (const e of s.enemies) { e.alive = false; e.box?.destroy?.(); }
  s.enemies = s.enemies.filter(e => e.alive);
  const l = s.leyla; l.invulnerableUntil = 1e12;
  nomad.tp(22 * T, 15 * T); l.facing = 1; nomad.step(3);
  const add = (id, col, facing, o = {}) => { nomad.spawn(id, col, 14); const e = s.enemies.at(-1); e.facing = facing; e.S.hearing = 0; e.M.patrol = 0; e.readyAt = 1e12; Object.assign(e.S, o); return e; };
  const spotter = add('schlaeger', 28, -1, { call });   // sees her
  const mate = add('pistolero', 38, 1, { sight: 200 });  // looks away, far: sees nothing by itself
  const mutant = add('kriecher', 36, 1, { sight: 200 }); // other family
  s.lastAlarm = null;
  nomad.step(40);
  const a = s.lastAlarm;
  nomad.step(60);
  return { spotter: spotter.state, alarm: a, mate: mate.state, mateKnows: !!mate.lastKnown, mutant: mutant.state, ids: [spotter.id, mate.id, mutant.id] };
}, call);

let r = await run(100);
check('Gruppen-Alarm: wer Leyla sieht, ruft', r.spotter === 'engage' && r.alarm?.by === r.ids[0], r);
check('Gruppen-Alarm: der Kumpel aus der Familie wird gerufen und schaut nach', r.alarm?.called.includes(r.ids[1]) && r.mateKnows && ['alert', 'search', 'engage'].includes(r.mate), r);
check('Gruppen-Alarm: andere Familie (Mutant) bleibt ruhig', !r.alarm?.called.includes(r.ids[2]) && r.mutant === 'patrol', r);
r = await run(0);
check('Gruppen-Alarm: „Ruft andere“ 0 ruft niemanden', !r.alarm && r.mate === 'patrol', r);

console.log(ok.map(o => '✔ ' + o).join('\n'));
if (errors.length) { console.log(errors.map(e => '✘ ' + e).join('\n')); process.exitCode = 1; }
console.log(`${ok.length} ok, ${errors.length} Fehler`);
await browser.close();

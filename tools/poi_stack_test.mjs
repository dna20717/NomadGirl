// Stacked POIs (#038, Daniel 15.11.2026: „unterirdische oder insgesamt vertikale wie Hochhaus-Ruinen“): a tower (Delta Heights) and
// a deep POI (Metro Line 4) load without errors, the stack is tall, Leyla climbs a joint ladder into the next room, and the shortcut
// works: tower = from the top down the shaft, pull the switch, the door into the lobby opens; deep = the switch in the exit room
// opens the door, up the shaft to the entrance. Server must run (npm run serve).   node tools/poi_stack_test.mjs [--shots]
import fs from 'node:fs';
import { chromium } from 'playwright';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [], ok = [];
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);

async function open(poi, seed) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errs.push(m.text()); });
  await page.goto(`${process.env.GAME_URL || 'http://localhost:8766/game.html'}?poi=${poi}&seed=${seed}`);
  await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 120000 });
  await page.evaluate(() => nomad.take());
  return { page, errs };
}
const shot = async (page, name) => {
  if (!shots) return;
  fs.mkdirSync('output', { recursive: true });
  await page.evaluate(() => nomad.freeze()); await page.waitForTimeout(400);
  await page.screenshot({ path: `output/poi_stack_${name}.png` });
  await page.evaluate(() => nomad.thaw());
};

// ---- tower ----
{
  const { page, errs } = await open('delta_heights', 2);
  let s = await page.evaluate(() => {
    const L = game.scene.getScene('play').levelInfo, st = nomad.state();
    return { stack: L.stack, size: L.def.size, rooms: L.rooms.map(r => r.id), shortcut: L.shortcut, chests: st.level?.chests?.length ?? st.level?.chests, room: game.scene.getScene('play').roomName };
  });
  check(`Turm lädt ohne Fehler (${s.rooms.length} Räume, ${s.size.join('×')})`, !errs.length && s.stack === 'tower' && s.size[1] > 50 && s.chests > 0, { ...s, errs });
  check('Turm: Abkürzung ist ein Schacht', s.shortcut?.kind === 'shaft' && s.shortcut.door, s.shortcut);
  await shot(page, 'tower_lobby');
  // the first joint ladder: from the lobby up into the next floor
  s = await page.evaluate(() => {
    const sc = game.scene.getScene('play'), L = sc.levelInfo, T = sc.T, lobby = L.rooms[0], lay = L.def.layout;
    const x = [...lay[lobby.y]].findIndex((c, i) => c === 'H' && i >= lobby.x && i < lobby.x + lobby.w);
    nomad.tp((x + 0.5) * T, (lobby.y + lobby.h - 1) * T - 2); nomad.step(5);
    nomad.until(st => st.leyla.state === 'climb', 60, ['up'], ['up']);
    const st = nomad.until(st => st.leyla.state === 'normal' && st.leyla.feet < lobby.y * T - 10, 900, ['up']);
    nomad.step(20);
    return { x, feet: st.leyla.feet, top: lobby.y * T, room: sc.roomName, lobby: sc.data_.rooms[lobby.id].name };
  });
  check(`Turm: Leiter aus der Lobby in die nächste Etage (${s.room})`, s.feet < s.top && s.room !== s.lobby, s);
  await shot(page, 'tower_floor');
  // from the top down the shaft, pull the switch, the door opens
  s = await page.evaluate(() => {
    const sc = game.scene.getScene('play'), L = sc.levelInfo, T = sc.T, [lx, ly] = L.shortcut.down, F = L.shortcut.floor;
    nomad.tp((lx + 0.5) * T, ly * T); nomad.step(5);
    nomad.until(st => st.leyla.state === 'climb', 60, ['down']);
    let st = nomad.until(st => st.leyla.feet >= F * T - 70 && st.leyla.state !== 'climb', 1800, ['down']);
    const sw = nomad.state().level.switches.at(-1);
    nomad.until(st => Math.abs(st.leyla.x - sw.x) < 50, 300, [st.leyla.x < sw.x ? 'right' : 'left']);
    nomad.step(5); const p = nomad.state().prompt; nomad.step(1, [], ['grab']); nomad.step(80);
    const lv = nomad.state().level, door = lv.doors.find(d => d.x0 === L.shortcut.door[0]);
    return { p, feet: nomad.state().leyla.feet, F: F * T, door, room: sc.roomName };
  });
  check('Turm: den Schacht hinunter bis zum Schalter', s.p === 'Schalter umlegen' && s.room === 'Abkürzung', s);
  check('Turm: Schalter öffnet die Tür in die Lobby', s.door?.open === true, s);
  await shot(page, 'tower_shaft');
  // overview: the whole tower, zoomed out
  if (shots) {
    await page.evaluate(() => { const sc = game.scene.getScene('play'), [W, H] = sc.levelInfo.def.size; sc.cam.stopFollow?.(); sc.cam.setZoom(Math.min(1280 / (W * sc.T), 720 / (H * sc.T))); sc.cam.centerOn(W * sc.T / 2, H * sc.T / 2); });
    await page.waitForTimeout(800); await page.screenshot({ path: 'output/poi_stack_tower_all.png' });
  }
  await page.close();
}

// ---- deep ----
{
  const { page, errs } = await open('metro_line4', 3);
  let s = await page.evaluate(() => {
    const sc = game.scene.getScene('play'), L = sc.levelInfo, st = nomad.state();
    const start = L.rooms[0], exit = L.rooms.filter(r => r.band === 'main').at(-1);
    return { stack: L.stack, size: L.def.size, rooms: L.rooms.map(r => r.id), shortcut: L.shortcut, startY: start.y, exitY: exit.y, feet: st.leyla.feet, T: sc.T };
  });
  check(`Tiefe lädt ohne Fehler (${s.rooms.length} Räume, ${s.size.join('×')})`, !errs.length && s.stack === 'deep' && s.startY < s.exitY && s.feet < (s.startY + 20) * s.T, { ...s, errs });
  await shot(page, 'deep_entrance');
  // the switch sits in the exit room next to the door; pull it, then up the shaft to the entrance
  s = await page.evaluate(() => {
    const sc = game.scene.getScene('play'), L = sc.levelInfo, T = sc.T, [dx, dy] = L.shortcut.door;
    const sw = nomad.state().level.switches.find(w => Math.abs(w.x / T - dx) < 6);
    nomad.tp(sw.x, sw.feet - 2); nomad.step(10);
    const p = nomad.state().prompt; nomad.step(1, [], ['grab']); nomad.step(80);
    const door = nomad.state().level.doors.find(d => d.x0 === dx);
    const [ux, uy] = L.shortcut.up;
    // through the open door to the ladder, up
    nomad.until(st => Math.abs(st.leyla.x - (ux + 0.5) * T) < 14, 600, [ux * T > sw.x ? 'right' : 'left', 'walk']);
    nomad.until(st => st.leyla.state === 'climb', 60, ['up'], ['up']);
    const st = nomad.until(st => st.leyla.state === 'normal' && st.leyla.feet <= uy * T + 4, 2400, ['up']);
    nomad.step(10);
    return { p, door, feet: st.leyla.feet, want: uy * T, room: sc.roomName };
  });
  check('Tiefe: Schalter im Ausgang öffnet die Tür zum Schacht', s.p === 'Schalter umlegen' && s.door?.open === true, s);
  check('Tiefe: durch den Schacht hoch bis zum Eingang', Math.abs(s.feet - s.want) < 10, s);
  await shot(page, 'deep_top');
  if (shots) {
    await page.evaluate(() => { const sc = game.scene.getScene('play'), [W, H] = sc.levelInfo.def.size; sc.cam.stopFollow?.(); sc.cam.setZoom(Math.min(1280 / (W * sc.T), 720 / (H * sc.T))); sc.cam.centerOn(W * sc.T / 2, H * sc.T / 2); });
    await page.waitForTimeout(800); await page.screenshot({ path: 'output/poi_stack_deep_all.png' });
  }
  await page.close();
}

console.log(ok.map(o => '✔ ' + o).join('\n'));
if (errors.length) { console.log(errors.map(e => '✘ ' + e).join('\n')); process.exitCode = 1; }
console.log(`${ok.length} ok, ${errors.length} Fehler`);
await browser.close();

// Headless check of a POI level (Tankstelle Kilometer 7): rooms welded to one level, side room above, chests, brittle wall (secret),
// door that only opens from the other side, goal + ranking, the shortcut tunnel back to the van, bonus at the van.
// Server must run (npm run serve).   node tools/poi_test.mjs [--shots]   pictures to output/poi_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';
import { furnishedStart } from './test_fixture.mjs';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await furnishedStart(page);
// a fixed level: same seed every run (POIs › Level › Fester Seed), with the side room
const pois = JSON.parse(fs.readFileSync(new URL('../projects/nomadgirl/data/pois.json', import.meta.url), 'utf8'));
pois.tankstelle_km7.seed = 7;
await page.addInitScript(p => localStorage.setItem('nomadgirl-drafts:data/pois.json', JSON.stringify(p)), pois);
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 20000 });
const ev = f => page.evaluate(f);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(250); await page.screenshot({ path: `output/poi_${n}.png` }); await ev(() => nomad.thaw()); };

let s = await ev(() => {
  nomad.take(); nomad.step(30); nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.choose('Planen'); nomad.choose('Plündern'); nomad.step(60);
  const sc = game.scene.getScene('play'); window.L = sc.levelInfo; window.T = sc.T;
  return { ...nomad.state(), rooms: L.rooms, shortcut: L.shortcut, seed: nomad.save().run?.seed };
});
check('Run startet als POI-Level', s.mode === 'run' && s.seed === 7 && s.level?.poi === 'tankstelle_km7', { mode: s.mode, seed: s.seed });
check('Hauptweg: Vorplatz → Verkaufsraum → … → Werkstatthalle', s.rooms[0].id === 'vorplatz' && s.rooms.filter(r => r.band === 'main').at(-1).id === 'werkstatthalle', s.rooms);
check('Abzweig: Lager hängt über einem Verkaufsraum', s.rooms.some(r => r.band === 'branch' && r.id === 'lager'), s.rooms);
check('Abkürzung: Tunnel von der Werkstatthalle zum Vorplatz', !!s.shortcut?.up && !!s.shortcut?.down && s.shortcut.down[0] > s.shortcut.up[0], s.shortcut);
check('Am Van: zurück ins Camp', s.prompt === 'Zurück ins Camp · Van', s.prompt);
check('Kisten, Schalter, Tür, brüchige Wände, Ziel', s.level.chests.length >= 4 && s.level.switches.length === 1 && s.level.doors.length === 1 && s.level.walls.length >= 2 && s.level.goals.length === 1, s.level);
check('HUD nennt den Raum', /Tankstelle Kilometer 7 · Vorplatz/.test(await ev(() => document.querySelector('.hud-room, [class*=room]')?.textContent || game.scene.getScene('play').roomName)), null);
await ev(() => nomad.calm());
await shot('van');

// the closet door does not open from the van's side
s = await ev(() => { const d = nomad.state().level.doors[0]; nomad.tp((d.x1 + 0.7) * T, d.y1 * T); nomad.step(5); const p = nomad.state().prompt; nomad.step(40, ['left']); return { p, x: nomad.state().leyla.x, wall: d.x1 * T }; });
check('Tür: geht von dieser Seite nicht auf', s.p === 'Die Tür geht von dieser Seite nicht auf', s.p);
check('Tür: Leyla kommt nicht durch', s.x > s.wall, s);

// chest: E opens it, the POI's loot lies on the ground
s = await ev(() => { const c = nomad.state().level.chests[0]; nomad.tp(c.x - 60, c.feet); nomad.step(5); const p = nomad.state().prompt; nomad.step(1, [], ['grab']); nomad.step(40); return { p, c: nomad.state().level.chests[0], loot: nomad.loot() }; });
check('Kiste: E-Hinweis', s.p === 'Kiste öffnen', s.p);
check('Kiste: offen, Beute am Boden', s.c.open && s.loot.length > 0 && s.loot.some(p => p.items.length), s);
await shot('chest');

// brittle wall: a melee hit breaks it, counts as a secret
s = await ev(() => {
  const w = nomad.state().level.walls[0];
  nomad.tp(w.x0 * T - 70, w.y1 * T); nomad.step(4, ['right']); nomad.step(30);
  nomad.step(1, [], ['melee']); nomad.step(40);
  const sc = game.scene.getScene('play'), cw = sc.camo.find(c => c.kind === '$');
  return { lv: nomad.state().level, open: nomad.state().level.walls[0].open, camo: cw.rts.every(r => !r.active) };
});
check('Brüchige Wand: Nahkampf bricht sie auf', s.open, s.lv.walls);
check('Brüchige Wand: zählt als Secret', s.lv.secrets === 1 && s.lv.secretsMax === s.lv.walls.length + s.lv.fakes.length, s.lv);
check('Getarnte brüchige Wand: sieht aus wie Wand, verschwindet beim Brechen', s.lv.walls[0].kind === '$' && s.camo, s);
await shot('secret');

// fog of war (Daniel, 11.11.2026): indoors only, over air Leyla can reach; dense behind secrets; a fake wall fades when she walks in
s = await ev(() => {
  const sc = game.scene.getScene('play'), F = sc.fog, lv = nomad.state().level, f = lv.fakes[0], c = sc.camo.find(c => c.kind === '%');
  const tun = L.shortcut.up, deep = c.secret.find(([x]) => x > f.x0 + 1) || c.secret[0];
  const out = { on: F.on, outdoor: F.at(5 * T, (L.rooms[0].y + 5) * T), tunnel: F.at((tun[0] + 20) * T, (tun[1] + 2) * T), secret: F.at((deep[0] + 0.5) * T, (deep[1] + 0.5) * T), coverBefore: c.rts[0].alpha };
  nomad.tp((f.x0 - 1.5) * T, f.y1 * T); nomad.step(10);
  out.stillHidden = F.at((deep[0] + 0.5) * T, (deep[1] + 0.5) * T);
  nomad.step(40, ['right']); nomad.step(40);
  const lv2 = nomad.state().level;
  out.found = lv2.fakes[0].found; out.alpha = lv2.fakes[0].alpha; out.secrets = lv2.secrets; out.secretAfter = F.at((deep[0] + 0.5) * T, (deep[1] + 0.5) * T); out.inRoom = nomad.state().leyla.x > (f.x1 - 0.2) * T;
  return out;
});
check('Nebel: draußen klar, im Tunnel Dunst, hinter dem Secret dicht', s.on && s.outdoor === 0 && s.tunnel >= 0.7 && s.tunnel <= 0.9 && s.secret >= 0.95, s);
check('Scheinwand: sieht aus wie Wand und deckt den Raum dahinter ab', s.coverBefore === 1 && s.stillHidden >= 0.95, s);
check('Scheinwand: Leyla läuft hindurch, die Wand blendet aus, zählt als Secret', s.found && s.alpha === 0 && s.secrets === 2 && s.inRoom, s);
check('Nebel: der geheime Raum klart auf, wenn sie drin ist', s.secretAfter === 0, s);
await shot('fog');

// side room: up the ladder from the shop into the store room
s = await ev(() => {
  const b = L.rooms.find(r => r.band === 'branch'), col = [...Array(b.w).keys()].map(i => b.x + i).find(x => game.scene.getScene('play').room.tiles[b.y + b.h - 1][x] === 'H');
  const floor = L.rooms[0].y + L.rooms[0].h - 1;
  nomad.tp((col + 0.5) * T, floor * T); nomad.step(5);
  const st = nomad.until(s => s.leyla.feet <= (b.y + b.h - 1) * T + 2 && s.leyla.state === 'normal', 900, ['up'], ['up']);
  return { feet: st.leyla.feet, want: (b.y + b.h - 1) * T, room: game.scene.getScene('play').roomName, state: st.leyla.state };
});
check('Abzweig: Leiter hoch ins Lager', s.room === 'Lager' && Math.abs(s.feet - s.want) < 8, s);
await shot('branch');

// goal: E cracks the safe, time stops, ranking
s = await ev(() => { const z = nomad.state().level.goals[0]; nomad.tp(z.x - 90, z.feet); nomad.step(5); const p = nomad.state().prompt; nomad.step(1, [], ['grab']); nomad.step(3); return { p, menu: nomad.menu(), lv: nomad.state().level }; });
check('Ziel: E-Hinweis', s.p === 'Tresor knacken · POI abschließen', s.p);
check('Tresor ist voll: mindestens 6 Dinge liegen davor', s.lv.done?.haul?.length >= 3 && /^Tresor: (\d+) Dinge/.test(s.menu.items[3].label) && Number(s.menu.items[3].label.match(/\d+/)[0]) >= 6, { haul: s.lv.done?.haul, item: s.menu?.items?.[3] });
check('Ziel: Ranking mit Rang, Zeit, Kills, Secrets', /^Rang [FDCBAS]$/.test(s.menu?.title) && s.menu.items.length === 5 && /Secrets 2\//.test(s.menu.items[2].label) && s.lv.done?.grade, s.menu);
await shot('rank');
s = await ev(() => { nomad.choose('Weiter'); const t0 = nomad.state().time; nomad.step(120); return { t0, t1: nomad.state().time, p: nomad.state().prompt }; });
check('Ziel: Uhr steht', s.t0 === s.t1, s);
check('Ziel: Hinweis auf die Abkürzung', /Abkürzung zum Van/.test(s.p), s.p);

// the shortcut: down the ladder in the workshop hall, through the tunnel, up into the closet, pull the switch
s = await ev(() => {
  const [dx, dy] = L.shortcut.down, [ux, uy] = L.shortcut.up, F = L.shortcut.floor;
  nomad.tp((dx + 0.5) * T, dy * T); nomad.step(5);
  let st = nomad.until(s => s.leyla.state === 'climb', 60, ['down']);
  st = nomad.until(s => s.leyla.state !== 'climb' && s.leyla.feet >= F * T - 4, 900, ['down']);
  const tunnel = { feet: st.leyla.feet, room: game.scene.getScene('play').roomName };
  st = nomad.until(s => Math.abs(s.leyla.x - (ux + 0.5) * T) < 16, 3000, ['left', 'walk']);
  nomad.step(10);
  st = nomad.until(s => s.leyla.state === 'climb', 60, ['up'], ['up']);
  st = nomad.until(s => s.leyla.state === 'normal' && s.leyla.feet <= uy * T + 2, 900, ['up']);
  return { tunnel, top: st.leyla, want: uy * T, room: game.scene.getScene('play').roomName };
});
check('Abkürzung: runter in den Tunnel', s.tunnel.room === 'Abkürzung' && s.tunnel.feet > s.want, s.tunnel);
check('Abkürzung: im Vorplatz wieder hoch', s.room === 'Vorplatz' && Math.abs(s.top.feet - s.want) < 8, s);
await shot('closet');
s = await ev(() => {
  const sw = nomad.state().level.switches[0];
  nomad.until(st => Math.abs(st.leyla.x - sw.x) < 50, 300, [nomad.state().leyla.x < sw.x ? 'right' : 'left']);
  nomad.step(5); const p = nomad.state().prompt; nomad.step(1, [], ['grab']); nomad.step(80);
  return { p, lv: nomad.state().level };
});
check('Schalter: E-Hinweis in der Kammer', s.p === 'Schalter umlegen', s.p);
check('Schalter: Tür geht auf', s.lv.switches[0].on && s.lv.doors[0].open, s.lv);
await shot('door');
s = await ev(() => {
  const sc = game.scene.getScene('play');
  sc.deltas = 100;
  nomad.until(st => st.prompt?.startsWith('Zurück ins Camp'), 600, ['right']);
  const p = nomad.state().prompt, before = nomad.save().deltas, grade = nomad.state().level.done;
  nomad.step(1, [], ['grab']); nomad.step(3); nomad.choose('Zurückreisen'); nomad.step(10);
  return { p, before, after: nomad.save().deltas, grade, st: nomad.state() };
});
check('Durch die Tür zum Van, Hinweis mit Rang', /^Zurück ins Camp · Rang [FDCBAS]$/.test(s.p), s.p);
check('Am Van: Run-Geld plus Rang-Bonus', s.st.mode === 'camp' && s.after - s.before === Math.round(100 * (1 + s.grade.bonus / 100)) && /Rang/.test(s.st.banner), { d: s.after - s.before, grade: s.grade, banner: s.st.banner });

console.log(ok.map(o => '✔ ' + o).join('\n'));
if (errors.length) { console.log(errors.map(e => '✘ ' + e).join('\n')); process.exitCode = 1; }
console.log(`${ok.length} ok, ${errors.length} Fehler`);
await browser.close();

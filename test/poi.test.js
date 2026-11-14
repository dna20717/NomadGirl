// POI levels (engine/poi.js): rooms welded to one level, side rooms, shortcut tunnel, ranking.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { parseRoom, solidRects } from '../engine/room.js';
import { buildPoi, poiReady, rankRun, parseCurve, curveAt } from '../engine/poi.js';
import { reach } from '../engine/reach.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl');
const D = (await loadProject(nodeLoader(root))).data;

test('alle vier POIs sind als Level spielbar (seit 11.11.2026 nachts auch Großmarkt, Bunker 13, Ministerium)', () => {
  for (const p of ['tankstelle_km7', 'grossmarkt', 'bunker_13', 'ministerium']) assert.equal(poiReady(D, p).ok, true, p);
});

// rough movement model (engine/reach.js): from the van every chest, switch, the goal and the shortcut can be reached, also in side rooms
test('Erreichbarkeit: Kisten, Schalter, Ziel und Abkürzung in allen POIs, mehrere Seeds', () => {
  for (const p of ['tankstelle_km7', 'grossmarkt', 'bunker_13', 'ministerium']) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const L = buildPoi(D, p, seed), lay = L.def.layout, R = reach(lay), miss = [];
    assert.equal(L.problems.length, 0, `${p} ${seed}: ${L.problems.join('; ')}`);
    for (let y = 0; y < lay.length; y++) for (let x = 0; x < lay[0].length; x++) if ('CZvS'.includes(lay[y][x]) && !R.can(x, y)) miss.push(`${lay[y][x]} ${x},${y}`);
    assert.deepEqual(miss, [], `${p} Seed ${seed}`);
  }
});
test('Erreichbarkeit: eine Kiste 7 Kacheln über dem Boden ist nicht erreichbar', () => {
  const lay = ['##########', '#.....C..#', '#........#', '#........#', '#........#', '#........#', '#........#', '#........#', '#.L......#', '##########'];
  assert.equal(reach(lay).can(6, 1), false);
  assert.equal(reach(lay).can(6, 8), true);
});
test('Abzweig-Leiter reicht durch den Fels bis in niedrigere Haupträume', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const L = buildPoi(D, 'ministerium', seed), lay = L.def.layout;
    for (const b of L.rooms.filter(r => r.band === 'branch')) {
      const hx = [...lay[b.y + b.h - 1]].findIndex((c, x) => c === 'H' && x >= b.x && x < b.x + b.w);
      assert.ok(hx >= 0, `${b.id}: Leiter im Boden`);
      let y = b.y + b.h - 1; while (lay[y][hx] === 'H') y++;
      const m = L.rooms.find(r => r.band === 'main' && hx >= r.x && hx < r.x + r.w);
      assert.ok(y >= m.y + 2, `${b.id} seed ${seed}: Leiter endet im Fels über ${m.id} (Zeile ${y}, Raum ab ${m.y})`);
    }
  }
});

test('gleicher Seed = gleiches Level, anderer Seed darf anders sein', () => {
  const a = buildPoi(D, 'tankstelle_km7', 42), b = buildPoi(D, 'tankstelle_km7', 42);
  assert.deepEqual(a.def.layout, b.def.layout);
  const shapes = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(s => buildPoi(D, 'tankstelle_km7', s).def.layout.join('|')));
  assert.ok(shapes.size > 1);
});

test('Level: Eingang zuerst, Ausgang zuletzt, ein Start, Ziel, Abkürzung, alle Zeilen gleich breit', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const L = buildPoi(D, 'tankstelle_km7', seed), main = L.rooms.filter(r => r.band === 'main');
    assert.equal(main[0].id, 'vorplatz');
    assert.equal(main.at(-1).id, 'werkstatthalle');
    const [c0, c1] = D.pois.tankstelle_km7.roomCount;
    assert.ok(main.length >= c0 && main.length <= c1, `${main.length} Räume`);
    const r = parseRoom(L.def);
    assert.deepEqual(r.problems.filter(([k]) => k !== 'hint'), []);
    assert.ok(r.start);
    assert.equal(r.marks.Z.length, 1);
    assert.equal(r.marks.A.length + r.marks['^'].length + r.marks.v.length, 0, 'Haken und Abkürzungs-Zeichen sind aufgelöst');
    assert.ok(L.shortcut && L.shortcut.down[0] > L.shortcut.up[0]);
    // the tunnel is open from one ladder to the other
    for (let x = L.shortcut.up[0]; x <= L.shortcut.down[0]; x++) assert.ok(!r.solid(x, L.shortcut.floor - 1), `Tunnel bei ${x}`);
    // every enemy symbol is in the spawn table
    for (const s of r.spawns) assert.ok(D.enemies[s.enemy]);
    assert.ok(solidRects(r).length > 0);
  }
});

test('Abzweig: Leiter vom Boden des Seitenraums bis in den Hauptraum', () => {
  const L = [...Array(30).keys()].map(s => buildPoi(D, 'tankstelle_km7', s + 1)).find(l => l.branches);
  assert.ok(L, 'mindestens ein Seed mit Seitenraum');
  const r = parseRoom(L.def), b = L.rooms.find(o => o.band === 'branch'), floor = b.y + b.h - 1;
  const col = [...Array(b.w).keys()].map(i => b.x + i).find(x => r.tiles[floor][x] === 'H');
  assert.ok(col !== undefined);
  let y = floor; while (r.tiles[y + 1]?.[col] === 'H') y++;
  assert.equal(r.tiles[y + 1][col], '#', 'Leiter endet auf dem Boden des Hauptraums');
});

test('ohne Abkürzung (POI › Level › Abkürzung aus): kein Tunnel', () => {
  const D2 = { ...D, pois: { ...D.pois, tankstelle_km7: { ...D.pois.tankstelle_km7, shortcut: false } } };
  const L = buildPoi(D2, 'tankstelle_km7', 3);
  assert.equal(L.shortcut, null);
  assert.equal(L.def.size[1], L.rooms.reduce((m, r) => Math.max(m, r.y + r.h), 0));
});

test('Ranking: Bestzeit, Kills, Secrets → Rang und Bonus', () => {
  const R = D.ranking;
  assert.equal(rankRun(R, { seconds: 60, par: 90, kills: 10, killsMax: 10, secrets: 2, secretsMax: 2 }).grade, 'S');
  const late = rankRun(R, { seconds: 90 + 100, par: 90, kills: 0, killsMax: 10, secrets: 0, secretsMax: 2 });
  assert.equal(late.parts.time, Math.round(R.points.time * (1 - R.timeFalloff / 100 * 10)));
  assert.equal(late.grade, 'F');
  assert.equal(late.bonus, 0);
});

// Spannungskurve (#016): quiet entrance, the loudest room at the exit, no boss from the random 1, curve off = every 1 an enemy
test('Spannungskurve: ruhiger Eingang, lauter Ausgang, kein Boss aus der 1', () => {
  assert.deepEqual(parseCurve('30, 70,100'), [0.3, 0.7, 1]);
  assert.equal(parseCurve(''), null);
  assert.ok(Math.abs(curveAt([0.2, 1], 0.5) - 0.6) < 1e-9);
  const count = (r, room) => { const sym = Object.fromEntries(r.def.spawns.map(s => [s.symbol, s.enemy])); let n = 0; for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) if (sym[r.def.layout[y][x]]) n++; return n; };
  let first = 0, last = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const r = buildPoi(D, 'ministerium', seed), main = r.rooms.filter(x => x.band === 'main');
    assert.ok(main[0].intensity < main.at(-1).intensity, 'Eingang leiser als Ausgang');
    first += count(r, main[0]); last += count(r, main.at(-1));
    const random = r.def.spawns.filter(s => s.enemy === 'hausmeister');
    assert.ok(random.length <= 1, 'Hausmeister nur aus seinem Raum');
  }
  assert.ok(first < last, `Eingang ${first} < Ausgang ${last}`);
  const off = buildPoi({ ...D, pois: { ...D.pois, tankstelle_km7: { ...D.pois.tankstelle_km7, curve: '' } } }, 'tankstelle_km7', 3);
  assert.ok(off.rooms.every(x => x.intensity === 100));
});

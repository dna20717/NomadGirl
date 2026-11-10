// POI levels (engine/poi.js): rooms welded to one level, side rooms, shortcut tunnel, ranking.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { parseRoom, solidRects } from '../engine/room.js';
import { buildPoi, poiReady, rankRun } from '../engine/poi.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl');
const D = (await loadProject(nodeLoader(root))).data;

test('Tankstelle KM7 ist als Level spielbar, die anderen POIs noch nicht', () => {
  assert.equal(poiReady(D, 'tankstelle_km7').ok, true);
  assert.equal(poiReady(D, 'bunker_13').ok, false);
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

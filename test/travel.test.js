// Reisen in Etappen mit Zwischenfällen (#014): the shortest way along the roads, encounters roll per leg, choices cost or give.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave } from '../game/save.js';
import { generateMap, route, neighbours, roadKm, placeOf } from '../game/worldmap.js';
import { encounterChance, rollEncounter, blocked, choose } from '../game/travel.js';
import { give, have } from '../game/crafting.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('Route: kürzester Weg über die Straßen, jede Etappe ist eine Straße', () => {
  const m = generateMap(D, 5), from = m.start;
  for (const n of m.nodes) {
    const r = route(D, m, from, n.id);
    assert.ok(r, `Weg nach ${n.id}`);
    assert.equal(r[0], from); assert.equal(r[r.length - 1], n.id);
    for (let i = 1; i < r.length; i++) assert.ok(neighbours(m, r[i - 1]).includes(r[i]));
    if (neighbours(m, from).includes(n.id)) {
      const km = r.slice(1).reduce((s, id, i) => s + roadKm(D, m.nodes.find(x => x.id === r[i]), m.nodes.find(x => x.id === id)), 0);
      assert.ok(km <= roadKm(D, m.nodes.find(x => x.id === from), n));
    }
  }
});

test('Zwischenfälle: Chance wächst mit der Strecke und nachts, jeder hat Entscheidungen', () => {
  assert.ok(encounterChance(D, 40, 12) > encounterChance(D, 10, 12));
  assert.ok(encounterChance(D, 20, 1) > encounterChance(D, 20, 12));
  assert.ok(Object.values(D.encounters).every(e => e.options?.length));
  const s = newSave(D); s.hour = 12;
  let r = 0; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const seen = new Set(); for (let i = 0; i < 300; i++) { const e = rollEncounter(D, s, 200, rnd); if (e) seen.add(e); }
  assert.ok(seen.size >= 3, [...seen].join());
  assert.ok([...seen].every(id => D.encounters[id].time !== 'night'), 'tagsüber keine Nacht-Zwischenfälle');
});

test('Entscheidung: kostet und bringt, ausgegraut ohne Δ oder Gegenstand', () => {
  const s = newSave(D); s.deltas = 10; s.fuel = 20; s.health = 100;
  const toll = D.encounters.strassensperre.options[0], tape = D.encounters.panne.options[0];
  assert.ok(blocked(D, s, toll));
  s.deltas = 500; assert.equal(blocked(D, s, toll), null);
  const r = choose(D, s, toll); assert.equal(s.deltas, 500 + toll.deltas); assert.ok(r.lines.length);
  if (!have(D, s, 'panzertape')) assert.ok(blocked(D, s, tape));
  give(D, s, 'panzertape', 1);
  assert.equal(blocked(D, s, tape), null);
  const n = have(D, s, 'panzertape'), h = s.hour; choose(D, s, tape);
  assert.equal(have(D, s, 'panzertape'), n - 1); assert.ok(s.hour !== h || s.day > 1);
  const fuel = s.fuel; choose(D, s, D.encounters.liegengebliebener_lkw.options[1]); assert.ok(s.fuel > fuel);
});

// #021 English place names: an older map keeps its roads, visited places and dangers, only names and regions change
test('Ortsnamen: alte Karte bekommt die neuen englischen Namen, Wege bleiben', async () => {
  const { generateMap, ensureMap, NAMES_VERSION } = await import('../game/worldmap.js');
  const map = generateMap(D, 4242, 1), old = JSON.parse(JSON.stringify(map));
  for (const n of map.nodes) { n.name = 'Alter Name ' + n.id; n.region = 'Ödland'; }
  delete map.names; map.visited = [map.nodes[0].id, map.nodes[3].id];
  const save = { map, cycle: 1, location: map.nodes[3].id };
  ensureMap(D, save);
  assert.equal(save.map.names, NAMES_VERSION);
  assert.deepEqual(save.map.edges, old.edges);
  assert.deepEqual(save.map.visited, [old.nodes[0].id, old.nodes[3].id]);
  assert.equal(save.location, old.nodes[3].id);
  for (const n of save.map.nodes) { assert.ok(!/Alter Name|Ödland/.test(n.name + n.region), n.name); assert.equal(n.name, old.nodes.find(o => o.id === n.id).name); }
  assert.equal(save.map.nodes.find(n => n.id === 'tankstelle_km7')?.name, 'Mile 7 Gas & Go');
});

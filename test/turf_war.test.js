// Revierkrieg (#089): rivals both ways, Ruf spills over to rivals, a cleared place goes to the rival, fronts between rival places
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { ensureMap } from '../game/worldmap.js';
import { rivalsOf, addRep, repOf, gangOfPlace } from '../game/reputation.js';
import { takeover, fronts, onFront } from '../game/turf_war.js';
import { generateEncounter } from '../game/road_events.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Rivalen gelten in beide Richtungen', () => {
  assert.ok(rivalsOf(D, 'Yellow Vultures').includes('Neon Rats'));
  assert.ok(rivalsOf(D, 'Neon Rats').includes('Yellow Vultures'));
  assert.ok(rivalsOf(D, 'Salt Dogs').includes('Tunnel Kings') && rivalsOf(D, 'Salt Dogs').includes('Rust Guard'));
});
test('Ruf schwappt über: +20 bei den Vultures = −10 bei Neon Rats und Crude Boys, nur eine Stufe', () => {
  const save = newSave(D);
  const r = addRep(D, save, 'Yellow Vultures', 20);
  assert.equal(repOf(save, 'Yellow Vultures'), 20);
  assert.equal(repOf(save, 'Neon Rats'), -10); assert.equal(repOf(save, 'Crude Boys'), -10);
  assert.equal(repOf(save, 'Sunny Side'), 0, 'kein Weiterschwappen über Crude Boys');
  assert.equal(r.rivals.length, 2);
  addRep(D, save, 'Neon Rats', -20);
  assert.equal(repOf(save, 'Yellow Vultures'), 30, 'Feind meines Feindes');
});
test('Übernahme: Rivale mit dem besten Ruf zieht ein, Heimat-Gang zurück löscht den Eintrag', () => {
  const save = newSave(D); ensureMap(D, save);
  const node = save.map.nodes.find(n => n.poi === 'tankstelle_km7').id;
  save.rep = { 'Neon Rats': 30, 'Crude Boys': 10 };
  const m = takeover(D, save, node, 'Yellow Vultures');
  assert.deepEqual(m, { node, from: 'Yellow Vultures', to: 'Neon Rats' });
  assert.equal(gangOfPlace(D, save, node), 'Neon Rats');
  takeover(D, save, node, 'Neon Rats');
  assert.equal(gangOfPlace(D, save, node), 'Yellow Vultures'); assert.equal(save.turfs[node], undefined);
  assert.equal(takeover(D, save, node, 'Gibt es nicht'), null);
});
test('Fronten: Straßen zwischen Orten rivalisierender Gangs; Zwischenfall dort nimmt die beiden', () => {
  const save = newSave(D); ensureMap(D, save);
  const [a, b] = save.map.edges[0];
  save.turfs = { [a]: 'Sky Wolves', [b]: 'Level Five' };
  const F = onFront(D, save, b, a);
  assert.ok(F && fronts(D, save).length >= 1);
  let hit = 0;
  for (let i = 0; i < 60; i++) { let x = i * 9301 + 7; const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
    const E = generateEncounter(D, rnd, { save, front: F, danger: 3 }); if (E?.gang && ['Sky Wolves', 'Level Five'].includes(E.gang)) { hit++; assert.equal(E.rival, E.gang === 'Sky Wolves' ? 'Level Five' : 'Sky Wolves'); } }
  assert.ok(hit > 0, 'Fehden an der Front');
});

test('#102 Gangs kämpfen selbst: alle paar Tage wechselt ein Ort an einer Front, Leylas Ort bleibt', async () => {
  const { gangWar } = await import('../game/turf_war.js');
  const save = newSave(D); ensureMap(D, save);
  let F = fronts(D, save);
  if (!F.length) {   // make a front: a rival gang moves into a neighbour of some place
    const [a, b] = save.map.edges[0], ga = gangOfPlace(D, save, a) || 'Yellow Vultures';
    save.turfs = { [a]: ga, [b]: rivalsOf(D, ga)[0] };
    F = fronts(D, save);
  }
  assert.ok(F.length > 0);
  assert.deepEqual(gangWar(D, save, () => 0), [], 'gleich nach dem Start nichts');
  save.day += 2; assert.deepEqual(gangWar(D, save, () => 0), [], 'zwei Tage: noch nichts');
  save.day += 1;
  const before = JSON.stringify(save.turfs || {}), r = gangWar(D, save, () => 0);
  assert.equal(r.length, 1);
  assert.notEqual(JSON.stringify(save.turfs || {}), before);
  assert.equal(gangOfPlace(D, save, r[0].node), r[0].to);
  assert.ok(r[0].node !== save.location);
  assert.equal(save.turfWar.log.at(-1).to, r[0].to);
  save.day += 30; assert.ok(gangWar(D, save, () => 0.99).length === 0, 'Pech beim Würfeln: nichts');
});

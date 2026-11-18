// Silo Zero (#057, Daniel 18.11.2026): a hidden XXL deep POI in the mountains with at least 20 rooms, its own gang, Major Null at the bottom,
// the Silo-KI Titan Lullaby in a terminal (optional, very hard); a story on the road gives the place away.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { buildPoi, poiReady } from '../engine/poi.js';
import { parseRoom } from '../engine/room.js';
import { newSave } from '../game/save.js';
import { revealPlace } from '../game/worldmap.js';
import { generateEncounter } from '../game/road_events.js';
import { choose } from '../game/travel.js';
import { uniqueEntity } from '../game/glitchlings.js';
import { newStack } from '../game/stack_duel.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;
const rng = seed => { let x = (seed * 2654435761) % 2147483647 || 1; return () => (x = (x * 16807) % 2147483647) / 2147483647; };

test('Silo Zero: XXL, tief, eigene Gang, mindestens 20 Räume in jedem Run, Boss und KI-Terminal unten', () => {
  const S = D.pois.raketensilo;
  assert.ok(poiReady(D, 'raketensilo').ok);
  assert.equal(S.size, 'XXL'); assert.equal(S.stack, 'deep'); assert.equal(S.gang.name, 'Zero Hour');
  for (let seed = 1; seed <= 12; seed++) {
    const L = buildPoi(D, 'raketensilo', seed);
    assert.ok(L.def && !L.problems.length, `seed ${seed}: ${L.problems}`);
    assert.ok(L.rooms.length >= 20, `seed ${seed}: ${L.rooms.length} Räume`);
    const p = parseRoom(L.def);
    assert.equal(p.marks.Z.length, 1); assert.equal(p.marks['@'].length, 1);
    assert.ok((L.def.spawns || []).some(s => s.enemy === 'major_null'), 'Major Null');
  }
});

test('Versteckt: nicht auf der Karte, bis die Geschichte es verrät; dann mit Straße von hier', () => {
  const save = newSave(D);
  assert.ok(!save.map.nodes.some(n => n.id === 'silo_zero'));
  const chain = ['silo_frequenz', 'silo_konvoi', 'silo_entdeckt'];
  let e = generateEncounter(D, rng(1), { save, situation: chain[0] });
  choose(D, save, e.options.find(o => o.answer === 'silo_peilen'), () => 0.99);
  assert.equal(save.road.chain.step, 'silo_konvoi');
  e = generateEncounter(D, rng(2), { save, chain: save.road.chain });
  assert.equal(e.gang, 'Zero Hour');
  choose(D, save, e.options.find(o => o.answer === 'silo_folgen'), () => 0.99);
  e = generateEncounter(D, rng(3), { save, chain: save.road.chain });
  const r = choose(D, save, e.options.find(o => o.answer === 'silo_markieren'), () => 0.99);
  assert.ok(r.revealed && save.map.revealed.includes('silo_zero') && save.road.flags.includes('silo_gefunden'));
  assert.ok(save.map.edges.some(([a, b]) => (a === save.location && b === 'silo_zero') || (b === save.location && a === 'silo_zero')));
  assert.equal(revealPlace(D, save, 'silo_zero').id, 'silo_zero');   // twice = still one place
  assert.equal(save.map.nodes.filter(n => n.id === 'silo_zero').length, 1);
});

test('Titan Lullaby: einzigartig, mehr Integrität, fast fehlerfrei', () => {
  const g = uniqueEntity(D, 'Titan Lullaby');
  assert.ok(g.unique && g.duelHp === 120 && g.duelNoise <= 0.05);
  const duel = newStack({ name: 'AvA Core', bits: 2 }, g, rng(4), 'player', { hp: 50, foeHp: g.duelHp });
  assert.equal(duel.sides.player.hp, 50); assert.equal(duel.sides.enemy.hp, 120);
});

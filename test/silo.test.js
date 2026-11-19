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
import { situationsFor } from '../game/road_events.js';
import { give, have } from '../game/crafting.js';
import { offers, accept, claim, progressOf } from '../game/quests.js';
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

test('Versteckt: nicht auf der Karte; die Straßenkette gibt Kartenstück 4, auch wenn es schiefgeht', () => {
  const save = newSave(D);
  assert.ok(!save.map.nodes.some(n => n.id === 'silo_zero'));
  let e = generateEncounter(D, rng(1), { save, situation: 'silo_frequenz' });
  choose(D, save, e.options.find(o => o.answer === 'silo_peilen'), () => 0.99);
  assert.equal(save.road.chain.step, 'silo_konvoi');
  e = generateEncounter(D, rng(2), { save, chain: save.road.chain });
  assert.equal(e.gang, 'Zero Hour');
  choose(D, save, e.options.find(o => o.answer === 'silo_folgen'), () => 0.99);
  e = generateEncounter(D, rng(3), { save, chain: save.road.chain });
  choose(D, save, e.options.find(o => o.answer === 'silo_umsehen'), () => 0);   // goes wrong
  assert.equal(have(D, save, 'silo_karte_4'), 1);
  assert.ok(save.road.flags.includes('silo_gefunden'));
  assert.ok(!save.map.revealed?.includes('silo_zero') && !save.map.nodes.some(n => n.id === 'silo_zero'));
});

test('Schatzsuche „Now I am become Death“: Onkel bietet sie erst mit einem Stück an, Händler erst danach, fünf Stücke decken Silo Zero auf', () => {
  const save = newSave(D), Q = D.quests.silo_schatz;
  assert.equal(Q.giver, 'onkel_sung'); assert.equal(Q.pieces.length, 5);
  assert.ok(!offers(D, save).includes('silo_schatz'));
  const traders = () => situationsFor(D, { night: true, danger: 3, save }).map(s => s.id).concat(situationsFor(D, { night: false, danger: 3, save }).map(s => s.id));
  assert.ok(!traders().includes('silo_kartenhaendler') && !traders().includes('silo_schwarzmarkt'));
  give(D, save, 'silo_karte_1', 1);
  assert.ok(offers(D, save).includes('silo_schatz'));
  accept(D, save, 'silo_schatz');
  assert.ok(save.road.flags.includes('silo_jagd'));
  assert.ok(traders().includes('silo_kartenhaendler') && traders().includes('silo_schwarzmarkt'));
  save.deltas = 1000;
  let e = generateEncounter(D, rng(5), { save, situation: 'silo_kartenhaendler' });
  choose(D, save, e.options.find(o => o.answer === 'silo_karte_kaufen'), () => 0.99);
  e = generateEncounter(D, rng(6), { save, situation: 'silo_schwarzmarkt', night: true });
  choose(D, save, e.options.find(o => o.answer === 'silo_brand_stehlen'), () => 0);   // caught, still has it
  assert.equal(have(D, save, 'silo_karte_2'), 1); assert.equal(have(D, save, 'silo_karte_5'), 1);
  assert.ok(!traders().includes('silo_kartenhaendler') && !traders().includes('silo_schwarzmarkt'), 'Händler kommen nicht wieder');
  const p = progressOf(D, save, 'silo_schatz');
  assert.equal(p.n, 3); assert.deepEqual(p.missing, ['silo_karte_3', 'silo_karte_4']);
  assert.equal(claim(D, save, 'silo_schatz').ok, false);
  give(D, save, 'silo_karte_3', 1); give(D, save, 'silo_karte_4', 1);
  const r = claim(D, save, 'silo_schatz');
  assert.ok(r.ok && r.got.some(x => x.includes('Silo Zero')));
  assert.ok(save.map.revealed.includes('silo_zero'));
  assert.ok(save.map.edges.some(([a, b]) => (a === save.location && b === 'silo_zero') || (b === save.location && a === 'silo_zero')));
  for (const id of Q.pieces) assert.equal(have(D, save, id), 0);
  assert.equal(revealPlace(D, save, 'silo_zero').id, 'silo_zero');   // twice = still one place
  assert.equal(save.map.nodes.filter(n => n.id === 'silo_zero').length, 1);
});

test('Fundstücke: Stück 1 im Tresor von Bunker 13, Stück 3 im Ministerium', () => {
  assert.ok(D.pois.bunker_13.treasure.some(t => t.item === 'silo_karte_1' && t.where === 'vault'));
  assert.ok(D.pois.ministerium.treasure.some(t => t.item === 'silo_karte_3' && t.where === 'vault'));
  for (let i = 1; i <= 5; i++) assert.ok(D.items[`silo_karte_${i}`].tags.includes('quest'));
});

test('Titan Lullaby: einzigartig, mehr Integrität, fast fehlerfrei', () => {
  const g = uniqueEntity(D, 'Titan Lullaby');
  assert.ok(g.unique && g.duelHp === 85 && g.duelNoise <= 0.05);
  const duel = newStack({ name: 'AvA Core', bits: 2 }, g, rng(4), 'player', { hp: D.glitchlings.duel.stackHp, foeHp: g.duelHp });
  assert.equal(duel.sides.player.hp, 35); assert.equal(duel.sides.enemy.hp, 85);
});

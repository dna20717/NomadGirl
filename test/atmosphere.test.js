// Light & atmosphere (engine/atmosphere.js): moods per room and tunnel, lamps at the ceilings, * in the layout, behaviors
import test from 'node:test';
import assert from 'node:assert/strict';
import { atmoRegions, planLights, behave, moodOf } from '../engine/atmosphere.js';
import { parseRoom } from '../engine/room.js';
import { buildPoi } from '../engine/poi.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = {
  game: { tiles: { terrain: 'stone' }, atmosphere: { default: 'grau' } },
  terrain: { stone: { atmosphere: 'hell' }, dark: { atmosphere: 'dunkel' } },
  rooms: { a: { terrain: 'dark' }, b: { atmosphere: 'grau' } },
  atmosphere: {
    hell: { light: { ambient: 100 } }, grau: { light: { ambient: 60 } },
    dunkel: { light: { ambient: 30, color: '#6080c0' }, lamps: [{ kind: 'tube', every: 4, chance: 100, radius: 300, strength: 80, behavior: 'flicker' }] },
  },
};
const room = parseRoom({ layout: [
  '##########',
  '#........#',
  '#.......*#',
  '#........#',
  '##########',
] });

test('Atmosphäre: Raum › Kachel-Set › Standard', () => {
  assert.equal(atmoRegions(D, room, { roomId: 'a' })(3, 2).mood, 'dunkel');   // Kachel-Set des Raums
  assert.equal(atmoRegions(D, room, { roomId: 'b' })(3, 2).mood, 'grau');     // Raum selbst
  assert.equal(atmoRegions(D, room, { roomId: 'x' })(3, 2).mood, 'hell');     // Spiel › Kachel-Set
  assert.equal(moodOf(D, 'dunkel').ambient, 0.3);
  assert.equal(moodOf(D, 'fehlt').ambient, 1);
});

test('Lampen hängen an Decken im Abstand, * hängt fest', () => {
  const { lamps, ceilings } = planLights(D, room, atmoRegions(D, room, { roomId: 'a' }));
  const auto = lamps.filter(l => !l.fixed), fixed = lamps.filter(l => l.fixed);
  assert.ok(ceilings.length >= 8, 'Decke über dem ganzen Raum');
  assert.deepEqual(auto.map(l => l.x), [2, 6]);          // every 4 from the room's left edge, offset = half
  assert.ok(auto.every(l => l.y === 1 && l.kind === 'tube' && l.behavior === 'flicker'));
  assert.equal(fixed.length, 1);
  assert.deepEqual([fixed[0].x, fixed[0].y], [8, 1]);    // * in row 2 hangs from the ceiling above (row 1 = under the wall)
  assert.equal(planLights(D, room, atmoRegions(D, room, { roomId: 'x' })).lamps.filter(l => !l.fixed).length, 0);   // bright mood: no lamps
});

test('Verhalten: ruhig = 1, kaputt meist dunkel, Pulsieren schwankt', () => {
  assert.equal(behave('steady', 1234, 0.3), 1);
  const broken = Array.from({ length: 400 }, (_, i) => behave('broken', i * 37, 0.5));
  assert.ok(broken.filter(v => v < 0.3).length > broken.length / 2);
  const pulse = Array.from({ length: 100 }, (_, i) => behave('pulse', i * 50, 0.2));
  assert.ok(Math.max(...pulse) > 0.9 && Math.min(...pulse) < 0.4);
});

test('Tankstelle KM7: Räume haben ihre Atmosphäre, der Tunnel seine eigene, Lampen hängen', async () => {
  const p = await loadProject(nodeLoader(new URL('../projects/nomadgirl', import.meta.url).pathname));
  // a seed whose level has all four classic rooms (#017: more rooms, so not every seed has them)
  const Dk = p.data, has = l => ['vorplatz', 'verkaufsraum', 'lager', 'werkstatthalle'].every(id => l.rooms.some(x => x.id === id));
  const level = [...Array(60).keys()].map(i => buildPoi(Dk, 'tankstelle_km7', i + 1)).find(has), r = parseRoom(level.def);
  const at = atmoRegions(Dk, r, { level, poiId: 'tankstelle_km7' });
  const of = id => { const q = level.rooms.find(x => x.id === id); return at(q.x + 3, q.y + q.h - 3).mood; };
  assert.equal(of('vorplatz'), 'wueste_draussen');
  assert.equal(of('verkaufsraum'), 'supermarkt_hell');   // #179 the supermarket set brings its mood
  assert.equal(of('lager'), 'beton_lager');
  assert.equal(of('werkstatthalle'), 'metall_rost');
  assert.equal(at(10, r.h - 2).mood, 'tunnel_blau');
  const { lamps } = planLights(Dk, r, at);
  assert.ok(lamps.length > 10, `${lamps.length} Lampen`);
  assert.ok(lamps.some(l => l.fixed), '* im Verkaufsraum (Geheimfach)');
  assert.ok(!lamps.some(l => l.region.mood === 'wueste_draussen'), 'draußen keine Lampen');
});

test('#179 Mile 7: Blende um den Block, Licht der Hülle im Lichtsystem, Supermarkt-Rückwand', async () => {
  const { planHull, hullLamps } = await import('../engine/facade.js');
  const p = await loadProject(nodeLoader(new URL('../projects/nomadgirl', import.meta.url).pathname)), D = p.data;
  const level = buildPoi(D, 'tankstelle_km7', 1), r = parseRoom(level.def), plan = planHull(D, 'tankstelle_km7', level);
  const frame = plan.parts.find(x => x.kind === 'roof' && x.frame);
  assert.ok(frame, 'die Blende läuft um den Block');
  const lager = level.rooms.find(x => x.id === 'lager');
  assert.ok(frame.x < lager.x && frame.x + frame.w > lager.x + lager.w, 'der Block reicht über den ganzen Seitenraum und den Rahmen');
  assert.ok(!plan.parts.some(x => x.kind === 'roof' && x.roof === 'parapet'), 'keine graue Attika mehr');
  const hl = hullLamps(plan);
  assert.ok(hl.filter(l => l.what === 'station').length >= 4 && hl.some(l => l.what === 'entry') && hl.some(l => l.what === 'pylon'), 'Lichtleisten, Vordach, Pylon');
  const at = atmoRegions(D, r, { level, poiId: 'tankstelle_km7' }), { lamps } = planLights(D, r, at, { level, poiId: 'tankstelle_km7', seed: 1 });
  assert.ok(lamps.some(l => l.hull === 'station' && l.bare) && lamps.some(l => l.hull === 'pylon' && l.free), 'Hüllen-Lampen im Lichtsystem');
  assert.ok(lamps.some(l => l.kind === 'panel'), 'Leuchtpaneele im Supermarkt');
  const T = D.terrain.supermarket;
  assert.equal(T.back.terrain, 'supermarket_wall');
  assert.ok(T.back.base.length && T.back.ceiling.length, 'Wandfuß und Deckenrand');
  assert.deepEqual(hullLamps({ ...plan, cfg: { ...plan.cfg, lamps: false } }), [], 'ohne Licht der Hülle keine Lampen');
});

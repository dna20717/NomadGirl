// Savegame (game/save.js): start rig, clock, repair of old savegames, travel costs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, placeWorkshops, advance, hoursUntil, clockText, repairSave, arrive } from '../game/save.js';
import { travelCost, legCost } from '../game/play/camp.js';
import { shop } from '../game/rig.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Start-Rig (Daniel, 13.11.2026): Van mit Koje + Kochnische, der kleine Anhänger mit dem Tank, kein Warroom, Modul-Anhänger gibt es nicht mehr', () => {
  const s = newSave(D);
  assert.equal(s.rig.tractor, 'van');
  assert.deepEqual(s.rig.units.map(u => [u.id, u.workshops.map(w => `${w.id}@${w.at}`)]), [['van', ['schlafkoje@0', 'kochnische@1']], ['container_10', ['cryotank@0']]]);
  assert.deepEqual(s.rig.spare.workshops, ['werkbank', 'lagerregal']);
  assert.ok(!shop(D).containers.includes('modulanhaenger') && !shop(D).containers.includes('wohnanhaenger'));
  const old = repairSave({ ...s, rig: { ...s.rig, units: [s.rig.units[0], { kind: 'container', id: 'wohnanhaenger', workshops: [{ id: 'werkbank', at: 0 }] }, s.rig.units[1]] } }, D);
  assert.deepEqual(old.rig.units.map(u => u.id), ['van', 'container_20', 'container_10']);   // old savegames: the trailer becomes a 20-foot container
  assert.ok(old.rig.units[1].workshops.some(w => w.id === 'werkbank'));
  assert.ok(s.inv.grids.camp.items.some(e => e.id === 'reis'), 'Vorräte liegen im Camp-Lager (Kofferraum, #041)');
  const { left } = placeWorkshops(D, 'van', [], ['kueche', 'schlafkoje', 'warroom']);   // Küche needs 2 places → fills the van, the rest has no room
  assert.deepEqual(left, ['schlafkoje', 'warroom']);
});

test('Uhr: Ereignis-Zeit über Mitternacht', () => {
  const s = { day: 1, hour: 22.5 };
  assert.equal(hoursUntil(s, 7), 8.5);
  advance(s, 8.5);
  assert.equal(clockText(s), 'Tag 2 · 07:00');
  assert.equal(hoursUntil(s, 7), 24);
});

test('Alter Spielstand wird repariert', () => {
  assert.equal(repairSave(null, D).version, 1);
  const s = newSave(D), n = s.rig.units[1].workshops.length; s.buffs = ['gibtsnicht', 'satt']; s.rig.units[1].workshops.push({ id: 'weg', at: 3 }); s.location = 'nirgendwo';
  const r = repairSave(s, D);
  assert.deepEqual(r.buffs, ['satt']);
  assert.equal(r.rig.units[1].workshops.length, n);
  assert.equal(r.location, 'tankstelle_km7');
});

test('Fahrtkosten', () => {
  const s = newSave(D), leg = legCost(D, s, 'tankstelle_km7', 'bunker_13');
  assert.deepEqual(leg, { from: 'tankstelle_km7', to: 'bunker_13', km: 47, hours: 1.25, fuel: 6.3, food: 0.2 });   // Straße auf der Reisekarte (#007: Luftlinie 40,5 km + 15 % Umweg); nur der Tank im 10-Fuß-Container (#008)
  // #014: the way over several legs, the costs summed up
  const t = travelCost(D, s, 'bunker_13');
  assert.equal(t.route[0], s.location); assert.equal(t.route[t.route.length - 1], 'bunker_13'); assert.equal(t.legs.length, t.route.length - 1);
  assert.equal(t.km, t.legs.reduce((n, l) => n + l.km, 0));
});

test('Reisekarte: jeder Durchgang würfelt eine Karte, Wahrzeichen bleiben, jeder Ort hat mindestens zwei Straßen (#007)', async () => {
  const { generateMap, ensureMap, neighbours, hops } = await import('../game/worldmap.js');
  const a = generateMap(D, 1), b = generateMap(D, 2), again = generateMap(D, 1);
  assert.deepEqual(a, again);   // same seed, same map
  assert.notDeepEqual(a.nodes.map(n => n.name), b.nodes.map(n => n.name));
  for (const id of Object.keys(D.locations)) assert.ok(a.nodes.some(n => n.id === id && n.landmark));
  for (const n of a.nodes) { assert.ok(neighbours(a, n.id).length >= 2, n.id); assert.ok(n.danger >= 1 && n.danger <= 5); }
  assert.equal(Object.keys(hops(a, a.start)).length, a.nodes.length);   // every place can be reached
  const s = newSave(D); assert.equal(s.location, Object.keys(D.locations)[0]); assert.ok(s.map.nodes.length > Object.keys(D.locations).length);
  const old = { ...s }; delete old.map; const r = repairSave(old, D); assert.ok(r.map?.nodes.length);   // older savegames get a map
  const kept = ensureMap(D, s); assert.equal(kept, s.map);   // the same Durchgang keeps its map
});

test('Ankunft im Camp: immer Dämmerung', () => {
  const s = { day: 1, hour: 21.5 };
  arrive(s, D); assert.equal(clockText(s), 'Tag 2 · 18:30');
  arrive(s, D); assert.equal(clockText(s), 'Tag 2 · 18:30');   // already dusk: stays
});

test('Alter Spielstand: Werkstatt auf einem Platz, den es nicht mehr gibt, kommt auf den Schrottplatz, ihr Inhalt bleibt', async () => {
  const { classicRig } = await import('./fixture.js');
  const old = newSave(classicRig(D)), count = s => Object.values(s.inv.grids).concat(Object.values(s.ground || {}).flat().map(p => p.grid)).reduce((n, g) => n + g.items.reduce((m, e) => m + e.n, 0), 0);
  const before = count(old);
  const r = repairSave(structuredClone(old), D);
  assert.deepEqual(r.rig.units[1].workshops.map(w => `${w.id}@${w.at}`), ['kochnische@0', 'werkbank@1']);
  assert.deepEqual(r.rig.spare.workshops, ['lagerregal']);
  assert.ok(!Object.keys(r.inv.grids).some(k => k.startsWith('store:')));
  assert.equal(count(r), before);   // nothing lost: Camp-Lager, a bundle by the van
  // with a free place it moves there; the Camp-Lager keeps everything (#041)
  const old2 = newSave(classicRig(D)); old2.rig.units.push({ kind: 'container', id: 'holzkiste', workshops: [] });
  const n = count(old2), r2 = repairSave(structuredClone(old2), D);
  assert.deepEqual(r2.rig.units[2].workshops, [{ id: 'lagerregal', at: 0 }]);
  assert.equal(count(r2), n);
  // an older savegame (before #041): the camp chest, the Kofferraum and a shelf of its own move into the Camp-Lager, nothing is lost
  const old3 = structuredClone(old2), camp = old3.inv.grids.camp; delete old3.inv.grids.camp;
  old3.inv.grids.chest = { w: 8, h: 5, items: camp.items.slice(0, 3) }; old3.inv.grids['rig:0'] = { w: 4, h: 3, items: camp.items.slice(3, 5) }; old3.inv.grids['store:2:0'] = { w: 8, h: 5, items: camp.items.slice(5) };
  const r3 = repairSave(structuredClone(old3), D);
  assert.ok(!r3.inv.grids.chest && !r3.inv.grids['rig:0'] && !r3.inv.grids['store:2:0'], 'die alten Raster sind weg');
  assert.equal(count(r3), n);
});

test('Nachreichen mit „Platz machen“ (Daniel, 12.11.2026): das Sturmgewehr kommt in jeden Rucksack, notfalls fliegen andere Dinge raus', () => {
  const s = newSave(D), bp = s.inv.grids.backpack;
  s.handedOut = [];
  bp.items = []; for (let y = 0; y < bp.h; y++) for (let x = 0; x < bp.w; x++) bp.items.push({ a: 'items', id: 'stoffreste', n: 1, x, y, r: 0 });
  const full = bp.items.length;
  repairSave(s, D);
  assert.ok(bp.items.some(e => e.id === 'sturmgewehr'), 'Gewehr im Rucksack');
  assert.ok(bp.items.length < full, 'andere Dinge sind raus');
  const n = bp.items.length;
  repairSave(s, D);
  assert.equal(bp.items.length, n, 'nur einmal');
  const t = newSave(D); t.handedOut = []; t.inv.grids.backpack.items = []; t.inv.slots.ranged = 'sturmgewehr';
  repairSave(t, D);
  assert.ok(!t.inv.grids.backpack.items.some(e => e.id === 'sturmgewehr'), 'wer es schon trägt, bekommt kein zweites');
});

test('Deichselkästen sind weg: alter Inhalt wandert ins Camp-Lager, das Raster verschwindet', async () => {
  const { loadProject } = await import('../engine/project.js');
  const { nodeLoader } = await import('../tools/loader.js');
  const { newSave, repairSave } = await import('../game/save.js');
  const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
  const s = newSave(D);
  s.inv.grids.camp.items = [];
  s.inv.grids['rig:1'] = { w: 3, h: 2, items: [{ a: 'items', id: 'schrott', n: 2, x: 0, y: 0, r: 0 }] };
  const r = repairSave(JSON.parse(JSON.stringify(s)), D);
  assert.equal(r.inv.grids['rig:1'], undefined);
  assert.ok(r.inv.grids.camp.items.some(e => e.id === 'schrott' && e.n === 2));
});

// Daniel 16.11.2026 („A“): Spiel › Start › Nachreichen gives a thing once per savegame, a new Durchgang does not give it again
test('Nachreichen: einmal pro Spielstand, auch über einen neuen Durchgang hinweg', async () => {
  const { newCycle } = await import('../game/save.js');
  const w = 'schrott', D2 = { ...D, game: { ...D.game, start: { ...D.game.start, later: [{ where: 'storage', item: w, count: 1 }] } } };
  const s = newSave(D2);
  assert.ok(s.handedOut.includes(`items:${w}`));
  const has = x => x.inv.grids.camp.items.filter(e => e.id === w).reduce((n, e) => n + e.n, 0);
  const n0 = has(newSave(D));
  assert.equal(has(s), n0 + 1);
  const c = newCycle(D2, s);
  assert.equal(has(c), n0, 'im neuen Durchgang nicht noch einmal');
  assert.ok(c.handedOut.includes(`items:${w}`));
});

// Savegame (game/save.js): start rig, clock, repair of old savegames, travel costs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, placeWorkshops, advance, hoursUntil, clockText, repairSave, arrive } from '../game/save.js';
import { travelCost } from '../game/play/camp.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Start-Rig (Daniel, 09.11.2026): Van mit Schlafkoje + Warroom, leerer Modul-Anhänger, der Rest verpackt auf dem Schrottplatz', () => {
  const s = newSave(D);
  assert.equal(s.rig.tractor, 'van');
  assert.deepEqual(s.rig.units.map(u => [u.id, u.workshops.map(w => `${w.id}@${w.at}`)]), [['van', ['schlafkoje@0', 'warroom@1']], ['modulanhaenger', []]]);
  assert.deepEqual(s.rig.spare.workshops, ['kochnische', 'werkbank', 'lagerregal']);
  assert.ok(s.inv.grids.chest.items.some(e => e.id === 'reis'), 'Vorräte ohne Lager liegen in der Kiste');
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
  const t = travelCost(D, newSave(D), 'bunker_13');
  assert.deepEqual(t, { km: 42, hours: 1, fuel: 5.4, food: 0.1 });   // leerer Modul-Anhänger: 800 kg
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
  assert.ok(!r.inv.grids['store:1:2']);
  assert.equal(count(r), before);   // nothing lost: chest, Kofferraum, a bundle by the van
  // with a free place it moves there, with its contents
  const old2 = newSave(classicRig(D)); old2.rig.units.push({ kind: 'container', id: 'holzkiste', workshops: [] });
  const n = old2.inv.grids['store:1:2'].items.length, r2 = repairSave(structuredClone(old2), D);
  assert.deepEqual(r2.rig.units[2].workshops, [{ id: 'lagerregal', at: 0 }]);
  assert.equal(r2.inv.grids['store:2:0'].items.length, n);
});

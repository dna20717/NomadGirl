// Savegame (game/save.js): start rig, clock, repair of old savegames, travel costs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, placeWorkshops, advance, hoursUntil, clockText, repairSave, arrive } from '../game/save.js';
import { travelCost } from '../game/play/camp.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Start-Rig: erst die Plätze im Van, dann Wohnanhänger und Holzkiste', () => {
  const s = newSave(D);
  assert.equal(s.rig.tractor, 'van');
  assert.deepEqual(s.rig.units.map(u => [u.id, u.workshops.map(w => `${w.id}@${w.at}`)]), [['van', ['schlafkoje@0', 'warroom@1']], ['wohnanhaenger', ['kochnische@0', 'werkbank@1']], ['holzkiste', ['lagerregal@0']]]);
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
  const s = newSave(D); s.buffs = ['gibtsnicht', 'satt']; s.rig.units[1].workshops.push({ id: 'weg', at: 3 }); s.location = 'nirgendwo';
  const r = repairSave(s, D);
  assert.deepEqual(r.buffs, ['satt']);
  assert.equal(r.rig.units[1].workshops.length, 2);
  assert.equal(r.location, 'tankstelle_km7');
});

test('Fahrtkosten', () => {
  const t = travelCost(D, newSave(D), 'bunker_13');
  assert.deepEqual(t, { km: 42, hours: 1, fuel: 5.5, food: 0.1 });   // Wohnanhänger + Holzkiste: 1.150 kg
});

test('Ankunft im Camp: immer Dämmerung', () => {
  const s = { day: 1, hour: 21.5 };
  arrive(s, D); assert.equal(clockText(s), 'Tag 2 · 18:30');
  arrive(s, D); assert.equal(clockText(s), 'Tag 2 · 18:30');   // already dusk: stays
});

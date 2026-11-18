// Bit-Farm und Worker (#060, Daniel 18.11.2026): Entities in the Bit-Farm work at workshops of the rig with their talent (bonus) and their
// quirk (Macke); Bindung from friendly duels makes them better.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave, repairSave } from '../game/save.js';
import { add } from '../game/inventory.js';
import { generate } from '../game/glitchlings.js';
import { farmKeys, farmEntities, placesFor, assign, unassign, workers, workerBonus, flawOf, befriend, bondOf, syncWorkers, workplaceOf } from '../game/workers.js';
import { budgets } from '../game/rig.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;
function withFarm() {
  const s = newSave(D);
  s.rig.units.push({ kind: 'container', id: 'container_20', workshops: [{ id: 'bitfarm', at: 0 }, { id: 'generator', at: 1 }] });
  return repairSave(JSON.parse(JSON.stringify(s)), D);
}
const ent = (talent, quirkKind = null, quirk = '') => ({ ...generate(D, 3, 12).find(g => g.talent === talent) || generate(D, 3, 12)[0], talent, quirkKind, quirk, bits: 3 });
const put = (s, g) => add(D, s.inv.grids[farmKeys(D, s)[0]], 'items', 'glitchling', 1, { g });

test('Bit-Farm: eigenes Raster nur für Entities, ihre Bewohner sind gelistet', () => {
  const s = withFarm(), keys = farmKeys(D, s);
  assert.equal(keys.length, 1);
  assert.deepEqual(D.workshops.bitfarm.accept, ['glitchling']);
  assert.equal(put(s, ent('Koch')), 0);
  assert.equal(farmEntities(D, s).length, 1);
});

test('Worker: Koch an der Kochnische voll, an fremder Werkbank schwächer; nur solange er in der Farm wohnt', () => {
  const s = withFarm(), g = ent('Koch', 'odd', 'kocht alles scharf'); g.id = 'koch_test'; put(s, g);
  const P0 = placesFor(D, s, g), own = P0.find(b => b.def.function === 'kitchen'), other = P0.find(b => !b.own);
  assert.ok(own?.own && other && own.effect.value > other.effect.value);
  assert.ok(assign(D, s, g.id, own.ui, own.at));
  assert.equal(workplaceOf(D, s, g.id).def.function, 'kitchen');
  const w = workers(D, s)[0];
  assert.equal(w.stat, 'perfect'); assert.equal(w.flaw.why, 'lenkt sich ab');
  assert.equal(workerBonus(D, s, 'perfect'), Math.round(own.effect.value * 0.85 * 10) / 10);
  // taken out of the farm: no longer works
  const key = farmKeys(D, s)[0]; s.inv.grids[key].items = [];
  assert.equal(workers(D, s).length, 0);
  assert.ok(!unassign(D, s, 'nobody'));
});

test('Macken: nur nachts, Regen, Generator, Laune; Bindung macht stärker', () => {
  const s = withFarm();
  s.hour = 12;
  assert.equal(flawOf(D, s, { id: 'a', quirkKind: 'time', quirk: 'arbeitet nur nachts' }).factor, 0);
  s.hour = 22;
  assert.equal(flawOf(D, s, { id: 'a', quirkKind: 'time', quirk: 'arbeitet nur nachts' }).factor, 1);
  assert.equal(flawOf(D, s, { id: 'a', quirkKind: 'neighbour', quirk: 'hasst den Generator' }).factor, 0.5, 'Generator im Rig');
  const days = Array.from({ length: 40 }, (_, i) => flawOf(D, { ...s, day: i + 1 }, { id: 'm', quirkKind: 'mood' }).factor);
  assert.ok(days.includes(0) && days.filter(f => f === 1).length > 20, 'manchmal keine Lust');
  const g = ent('Ingenieur'); g.id = 'ing'; put(s, g);
  const gen = placesFor(D, s, g).find(b => b.own);
  assign(D, s, g.id, gen.ui, gen.at);
  const p0 = syncWorkers(D, s), made0 = budgets(D, s.rig).power.made;
  assert.ok(p0 >= 3, `Strom +${p0}`);
  for (let d = 1; d <= 5; d++) befriend(D, { ...s, day: d }, g.id, true);
  const x = farmEntities(D, s).find(y => y.g.id === 'ing').g;
  assert.equal(bondOf(x), 5);
  assert.ok(syncWorkers(D, s) > p0 && budgets(D, s.rig).power.made > made0 - 1);
  // once a day
  const b = befriend(D, s, g.id, true); assert.equal(b.up, false);
});

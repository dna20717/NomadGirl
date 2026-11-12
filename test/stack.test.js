// Stacking containers (game/rig.js): onto a trailer that carries, on top of a container, the tractor's height, blocks move together.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, repairSave, containers } from '../game/save.js';
import { act, buyContainer, stackOn, stackSlots, moveContainer, detach, attachAt, budgets, blockAt, toSpare } from '../game/rig.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { classicRig } from './fixture.js';

const D0 = classicRig((await loadProject(nodeLoader('projects/nomadgirl'))).data);   // fixed setup (fixture.js)
// the trailers lost their own storage (12.11.2026); the code still carries one along, so the test gives the 20 Fuß one back
const D = { ...D0, containers: { ...D0.containers, container_20: { ...D0.containers.container_20, storage: [4, 2] } } };
const fresh = () => { const s = newSave(D); s.deltas = 9000; return s; };
const ids = s => s.rig.units.map(u => u.id + (u.level ? '^' + u.level : '')).join(' ');

test('Container auf den Wohnanhänger stapeln; Holzkiste trägt nichts; Van stapelt 2 hoch', () => {
  const s = fresh();
  act(D, s, d => buyContainer(D, d, 'container_20'));
  act(D, s, d => buyContainer(D, d, 'holzkiste'));
  const r = act(D, s, d => stackOn(D, d, { spare: 0 }, 1));
  assert.equal(r.ok, true, r.reason);
  assert.equal(ids(s), 'van wohnanhaenger container_20^1');
  assert.equal(budgets(D, s.rig).length, 1);
  assert.equal(budgets(D, s.rig).height, 2);
  const r2 = act(D, s, d => stackOn(D, d, { spare: 0 }, 1));
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /höchstens 2/);
  // the stacked container gets its own storage and places
  assert.ok(containers(D, s).some(c => c.key === 'rig:2'));
});

test('Abhängen: erst oben abnehmen; gestapelter Container kommt runter in die Reihe', () => {
  const s = fresh();
  act(D, s, d => buyContainer(D, d, 'container_20'));
  act(D, s, d => stackOn(D, d, { spare: 0 }, 1));
  const r = act(D, s, d => { for (const w of d.rig.units[1].workshops.splice(0)) toSpare(d, w); return detach(D, d, 1); });
  assert.equal(r.ok, false);
  assert.match(r.reason, /oben abnehmen/);
  s.rig.tractor = s.rig.units[0].id = 'lkw';   // pulls 3
  assert.equal(act(D, s, d => moveContainer(D, d, 2, 1)).ok, true);
  assert.equal(ids(s), 'lkw container_20 wohnanhaenger');
});

test('Block zieht mit: Anhänger mit Container drauf umsortieren', () => {
  const s = fresh();
  s.rig.tractor = s.rig.units[0].id = 'lkw';
  act(D, s, d => buyContainer(D, d, 'modulanhaenger'));
  act(D, s, d => attachAt(D, d, 0, 2));
  act(D, s, d => buyContainer(D, d, 'container_20'));
  act(D, s, d => stackOn(D, d, { spare: 0 }, 1));
  assert.equal(ids(s), 'lkw wohnanhaenger container_20^1 modulanhaenger');
  assert.deepEqual(blockAt(s.rig.units, 2), [1, 3]);
  // the block (trailer + container) behind the Modul-Anhänger
  assert.equal(act(D, s, d => moveContainer(D, d, 1, 4)).ok, true);
  assert.equal(ids(s), 'lkw modulanhaenger wohnanhaenger container_20^1');
  // the container moves over onto the Modul-Anhänger, with its storage
  s.inv.grids['rig:3'].items.push({ a: 'items', id: 'schrott', n: 1, x: 0, y: 0, r: 0 });
  assert.equal(act(D, s, d => stackOn(D, d, { ui: 3 }, 1)).ok, true);
  assert.equal(ids(s), 'lkw modulanhaenger container_20^1 wohnanhaenger');
  assert.equal(s.inv.grids['rig:2'].items[0].id, 'schrott');
});

test('Alter/kaputter Stand: Stapel bleiben heil', () => {
  const s = fresh();
  s.rig.units.push({ kind: 'container', id: 'container_20', level: 3, workshops: [] });
  s.rig.units.splice(1, 0, { kind: 'container', id: 'holzkiste', level: 1, workshops: [] });
  const t = repairSave(JSON.parse(JSON.stringify(s)), D);
  assert.equal(t.rig.units.map(u => u.level || 0).join(), '0,0,0,1');
});

test('Container-Slots: kurzer Container links, Mitte oder rechts auf einem langen, umsetzen auf dem eigenen Stapel', () => {
  const s = fresh();
  s.rig.units.splice(1); s.rig.tractor = s.rig.units[0].id = 'lkw';   // only the truck (pulls 40 feet)
  act(D, s, d => buyContainer(D, d, 'container_40'));
  act(D, s, d => buyContainer(D, d, 'container_10'));
  const ground = s.rig.spare.containers.indexOf('container_40');
  assert.equal(act(D, s, d => attachAt(D, d, ground, 1)).ok, true);
  assert.equal(stackSlots(D, 'container_40', 'container_10'), 2);
  assert.equal(stackSlots(D, 'container_20', 'container_40'), 0);   // longer: centred
  const r = act(D, s, d => stackOn(D, d, { spare: 0 }, 1, 2));
  assert.equal(r.ok, true, r.reason);
  assert.equal(ids(s), 'lkw container_40 container_10^1');
  assert.equal(s.rig.units[2].slot, 2);   // right
  assert.equal(act(D, s, d => stackOn(D, d, { ui: 2 }, 1, 0)).ok, true);   // move to the left on its own stack
  assert.equal(s.rig.units[2].slot, 0);
  assert.equal(act(D, s, d => stackOn(D, d, { ui: 2 }, 1, 0)).same, true);   // already there
  assert.equal(act(D, s, d => stackOn(D, d, { ui: 2 }, 1, 9)).ok, true);   // clamped to the right
  assert.equal(s.rig.units[2].slot, 2);
});

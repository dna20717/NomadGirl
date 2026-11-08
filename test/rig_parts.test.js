// Rig parts as building parts (game/rig.js): buy onto the scrapyard, mount on a socket, swap, take off, sell, Dachbox and the Kofferraum.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, repairSave, containers } from '../game/save.js';
import { act, buyPart, sellPart, mountPart, unmountPart, budgets, snapshot, restore } from '../game/rig.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { classicRig } from './fixture.js';

const D = classicRig((await loadProject(nodeLoader('projects/nomadgirl'))).data);   // fixed setup (fixture.js)
const fresh = () => { const s = newSave(D); s.deltas = 5000; return s; };
const trunk = s => containers(D, s).find(c => c.key === 'rig:0');

test('Rig-Teil kaufen: liegt auf dem Schrottplatz, kostet Δ', () => {
  const s = fresh();
  const r = act(D, s, d => buyPart(D, d, 'v8'));
  assert.equal(r.ok, true);
  assert.deepEqual(s.rig.spare.parts, ['v8']);
  assert.equal(s.deltas, 5000 - D.rigParts.v8.value);
});

test('Anschrauben, falscher Sockel, Tauschen, Abschrauben, Verkaufen', () => {
  const s = fresh();
  act(D, s, d => buyPart(D, d, 'v8'));
  assert.equal(act(D, s, d => mountPart(D, d, 'armor', 0, { yard: 0 })).ok, false);
  const pull0 = budgets(D, s.rig).pull;
  assert.equal(act(D, s, d => mountPart(D, d, 'engine', 0, { yard: 0 })).ok, true);
  assert.equal(s.rig.parts.engine[0], 'v8');
  assert.equal(budgets(D, s.rig).pull, pull0 + D.rigParts.v8.pull);
  assert.deepEqual(s.rig.spare.parts, []);
  act(D, s, d => buyPart(D, d, 'bleche'));
  act(D, s, d => buyPart(D, d, 'stachelgitter'));
  act(D, s, d => mountPart(D, d, 'armor', 0, { yard: 0 }));
  const r = act(D, s, d => mountPart(D, d, 'armor', 0, { yard: 0 }));
  assert.equal(r.swapped, 'bleche');
  assert.deepEqual(s.rig.spare.parts, ['bleche']);
  assert.equal(act(D, s, d => unmountPart(D, d, 'engine', 0)).ok, true);
  assert.deepEqual(s.rig.spare.parts, ['bleche', 'v8']);
  const before = s.deltas;
  act(D, s, d => sellPart(D, d, 1));
  assert.equal(s.deltas, before + Math.round(D.rigParts.v8.value * (D.build.sellFactor ?? 50) / 100));
});

test('Dachbox macht den Kofferraum höher, ab nur wenn nichts rausfällt; Rückgängig', () => {
  const s = fresh();
  act(D, s, d => buyPart(D, d, 'dachbox'));
  const snap = snapshot(s);
  act(D, s, d => mountPart(D, d, 'roof', 0, { yard: 0 }));
  assert.equal(trunk(s).size[1], D.tractors.van.storage[1] + 2);
  assert.equal(s.inv.grids['rig:0'].h, D.tractors.van.storage[1] + 2);
  const g = s.inv.grids['rig:0'];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.items.push({ a: 'items', id: 'zettel_curry', n: 1, x, y, r: 0 });   // does not stack
  const r = act(D, s, d => unmountPart(D, d, 'roof', 0));
  assert.equal(r.ok, false);
  assert.match(r.reason, /Kofferraum/);
  g.items.length = 0;
  assert.equal(act(D, s, d => unmountPart(D, d, 'roof', 0)).ok, true);
  assert.equal(s.inv.grids['rig:0'].h, D.tractors.van.storage[1]);
  restore(s, snap);
  assert.deepEqual(s.rig.spare.parts, ['dachbox']);
});

test('Alter Spielstand: Rig-Teile aus dem Inventar ziehen auf den Schrottplatz', () => {
  const s = newSave(D);
  s.inv.grids['rig:0'].items.push({ a: 'rigParts', id: 'dachbox', n: 1, x: 0, y: 0, r: 0 });
  delete s.rig.spare.parts;
  const t = repairSave(JSON.parse(JSON.stringify(s)), D);
  assert.deepEqual(t.rig.spare.parts, ['dachbox']);
  assert.equal(t.inv.grids['rig:0'].items.length, 0);
});

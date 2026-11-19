// Vehicles from a tileset (#076): rear + bay 1 + (strut + bay 2) × (places − 1) + cab; two places = the picture itself
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { kitLayout, kitData } from '../game/vehicle_kit.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const K = D.tractors.van.kit;

test('Van mit zwei Plätzen: genau das Bild, Nischen wie von Hand eingetragen', () => {
  const L = kitLayout(K, 2, 256);
  assert.equal(L.width, 256); assert.equal(L.shift, 0);
  const k = kitData(D, 'van');
  assert.deepEqual(k.tractor.door.bays.map(b => b.x), [[50, 101], [114, 157]]);
  assert.equal(k.tractor.door.enter, D.tractors.van.door.enter);
  assert.deepEqual(k.asset.origin, D.assets.van_side.origin);
  assert.deepEqual(k.spawn.roof.x, D.game.spawn.roof.x);
});
test('Drei Plätze: eine Nische mehr, das Fahrerhaus rückt nach rechts', () => {
  const L = kitLayout(K, 3, 256), extra = (K.strut - K.bay) + (K.bay2 - K.strut);
  assert.equal(L.width, 256 + extra); assert.equal(L.bays.length, 3);
  const k = kitData({ ...D, tractors: { ...D.tractors, van: { ...D.tractors.van, places: 3 } } }, 'van');
  assert.equal(k.tractor.door.enter, D.tractors.van.door.enter + extra);
  assert.equal(k.asset.origin[0], D.assets.van_side.origin[0] + extra);
  assert.deepEqual(k.tractor.door.bays.map(b => b.place), [0, 1, 2]);
});
test('Ein Platz: Stütze und zweite Nische fallen weg', () => {
  const L = kitLayout(K, 1, 256);
  assert.equal(L.width, 256 - (K.bay2 - K.bay)); assert.equal(L.bays.length, 1);
  assert.equal(kitLayout({ rear: 50, bay: 40, strut: 1, bay2: 2 }, 2, 256), null, 'falsche Spalten: aus');
});

// Inventory grids (game/inventory.js): shapes, turning, stacking, swapping, moving everything, loot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellsOf, newGrid, add, fits, drop, remove, moveAll, rollLoot, findSpot, count, at } from '../game/inventory.js';
import { loadProject } from '../engine/project.js';
import { classicRig } from './fixture.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';

const D = classicRig((await loadProject(nodeLoader('projects/nomadgirl'))).data);   // furnished start rig, whatever the data say
const sorted = c => c.map(p => p.join(',')).sort().join(' ');

test('Formen: Rechteck, Tetris-Form, gedreht', () => {
  assert.equal(sorted(cellsOf(D, 'items', 'discokugel')), '0,0 0,1 1,0 1,1');
  assert.equal(sorted(cellsOf(D, 'items', 'rohrbogen')), '0,0 0,1 0,2 1,2');           // L
  assert.equal(sorted(cellsOf(D, 'items', 'rohrbogen', 1)), '0,0 0,1 1,0 2,0');        // a quarter turn
  assert.equal(sorted(cellsOf(D, 'weapons', 'schrotflinte', 1)), '0,0 0,1 0,2');
  assert.equal(cellsOf(D, 'backpacks', 'wanderrucksack').length, 6);
});

test('Platzieren, Stapeln, Tauschen', () => {
  const g = newGrid(4, 3);
  assert.equal(add(D, g, 'items', 'kupferkabel', 14), 0);   // stack 10 → 10 + 4
  assert.equal(count(g, 'items', 'kupferkabel'), 14);
  assert.equal(g.items.length, 2);
  assert.equal(add(D, g, 'items', 'kupferkabel', 3), 0);    // onto the open stack first
  assert.equal(g.items.length, 2);
  const L = { a: 'items', id: 'rohrbogen', n: 1, r: 0 };
  assert.ok(fits(D, g, L, 2, 0));
  assert.ok(!fits(D, g, L, 3, 0));                          // sticks out
  assert.equal(drop(D, g, L, 2, 0).ok, true);
  assert.equal(at(D, g, 3, 2), L); assert.equal(at(D, g, 3, 1), null);   // the L's empty corner stays free
  // drop a 1×1 onto the cable stack → stacks; onto a different 1×1 → swap
  const cable = { a: 'items', id: 'kupferkabel', n: 2, r: 0 };
  const first = at(D, g, 0, 0);
  assert.deepEqual(drop(D, g, cable, 0, 0), first.n + 2 <= 10 ? { ok: true, held: null } : drop(D, g, cable, 0, 0));
  const bulb = { a: 'items', id: 'gluehbirne', n: 1, r: 0 };
  const r = drop(D, g, bulb, 1, 0);
  assert.equal(r.ok, true); assert.equal(r.held?.id, 'kupferkabel');
});

test('Volles Raster, Alles einlagern, Beute', () => {
  const small = newGrid(2, 2);
  assert.equal(add(D, small, 'items', 'discokugel', 2), 1);   // only one fits
  assert.equal(findSpot(D, small, 'items', 'verband'), null);
  const big = newGrid(8, 5);
  assert.equal(moveAll(D, small, big), 1);
  assert.equal(small.items.length, 0); assert.equal(count(big, 'items', 'discokugel'), 1);
  const loot = rollLoot(D, 'pluenderer_beute', () => 0.01);
  assert.ok(loot.length >= 1 && loot.every(l => D.items[l.id] && l.n >= 1));
  remove(big, big.items[0]); assert.equal(big.items.length, 0);
});

test('Start-Inventar: Rucksack, Kiste und Lager', () => {
  const g = newSave(D).inv.grids;
  assert.equal(count(g.backpack, 'items', 'verband'), 2);
  assert.equal(count(g.chest, 'weapons', 'machete'), 1);
  const store = Object.keys(g).find(k => k.startsWith('store:'));
  assert.equal(count(g[store], 'items', 'kronkorken'), 37);
  assert.equal(count(g[store], 'backpacks', 'wanderrucksack'), 1);
});

// Inventory grids (game/inventory.js): rectangles, turning, stacking, swapping, moving everything, loot, untangling old savegames.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellsOf, newGrid, add, fits, drop, remove, moveAll, rollLoot, findSpot, count, at, untangle } from '../game/inventory.js';
import { loadProject } from '../engine/project.js';
import { classicRig } from './fixture.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave, repairSave } from '../game/save.js';

const D = classicRig((await loadProject(nodeLoader('projects/nomadgirl'))).data);   // furnished start rig, whatever the data say
const sorted = c => c.map(p => p.join(',')).sort().join(' ');

test('Formen: nur Rechtecke (14.11.2026), gedreht', () => {
  assert.equal(sorted(cellsOf(D, 'items', 'discokugel')), '0,0 0,1 1,0 1,1');
  assert.equal(sorted(cellsOf(D, 'items', 'rohrbogen')), '0,0 0,1 0,2 1,0 1,1 1,2');   // was an L, now its 2 × 3 rectangle
  assert.equal(sorted(cellsOf(D, 'items', 'rohrbogen', 1)), '0,0 0,1 1,0 1,1 2,0 2,1'); // a quarter turn: 3 × 2
  for (const a of ['items', 'weapons', 'backpacks']) for (const id of Object.keys(D[a])) {
    const c = cellsOf(D, a, id), w = Math.max(...c.map(p => p[0])) + 1, h = Math.max(...c.map(p => p[1])) + 1;
    assert.equal(c.length, w * h, `${a}/${id} ist ein Rechteck`);
  }
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
  assert.equal(at(D, g, 3, 2), L); assert.equal(at(D, g, 3, 1), L);     // no empty corner any more: the whole rectangle is taken
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

// older savegames: two L shapes nested into each other overlap as rectangles → the second one moves, nothing is lost
test('Alte Spielstände: verschachtelte Formen werden entwirrt', () => {
  const g = newGrid(5, 3);
  g.items = [{ a: 'items', id: 'rohrbogen', n: 1, x: 0, y: 0, r: 0 }, { a: 'items', id: 'rohrbogen', n: 1, x: 1, y: 0, r: 0 }, { a: 'items', id: 'gluehbirne', n: 1, x: 9, y: 9, r: 0 }];
  const out = untangle(D, g);
  assert.equal(out.length, 0);
  assert.equal(g.items.length, 3);
  for (const e of g.items) assert.ok(cellsOf(D, e.a, e.id, e.r).every(([cx, cy]) => e.x + cx < g.w && e.y + cy < g.h));
  const cells = g.items.flatMap(e => cellsOf(D, e.a, e.id, e.r).map(([cx, cy]) => `${e.x + cx},${e.y + cy}`));
  assert.equal(new Set(cells).size, cells.length, 'nichts überlappt');
  const tiny = newGrid(2, 3); tiny.items = [{ a: 'items', id: 'rohrbogen', n: 1, x: 0, y: 0, r: 0 }, { a: 'items', id: 'rohrbogen', n: 1, x: 0, y: 0, r: 0 }];
  assert.equal(untangle(D, tiny).length, 1, 'was nirgends passt, kommt zurück (der Spielstand legt es in die Kiste oder neben den Van)');
});
test('Alter Spielstand: was im Rucksack keinen Platz mehr hat, zieht um (Kiste, Kofferraum, Bündel am Van), nichts geht verloren', () => {
  const s = newSave(D), bp = s.inv.grids.backpack;
  bp.items = [];
  for (let i = 0; i < bp.w * bp.h; i++) bp.items.push({ a: 'items', id: 'rohrbogen', n: 1, x: i % bp.w, y: Math.floor(i / bp.w), r: 0 });   // far too many, all overlapping
  const all = x => Object.values(x.inv.grids).reduce((n, g) => n + g.items.filter(e => e.id === 'rohrbogen').length, 0) + Object.values(x.ground || {}).flat().reduce((n, p) => n + p.grid.items.filter(e => e.id === 'rohrbogen').length, 0);
  const before = all(s), r = repairSave(JSON.parse(JSON.stringify(s)), D);
  assert.equal(all(r), before, 'nichts geht verloren');
  const inBag = r.inv.grids.backpack.items.filter(e => e.id === 'rohrbogen').length;
  assert.ok(inBag > 0 && inBag < bp.items.length);
  const cells = r.inv.grids.backpack.items.flatMap(e => cellsOf(D, e.a, e.id, e.r).map(([cx, cy]) => `${e.x + cx},${e.y + cy}`));
  assert.equal(new Set(cells).size, cells.length, 'im Rucksack überlappt nichts mehr');
});

// Beute-Bilanz (#017): snapshot when driving off, difference when back, the most useful next stop
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { snapshot, compare } from '../game/summary.js';
import { accept } from '../game/quests.js';
import { newGrid } from '../game/inventory.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl');
const D = (await loadProject(nodeLoader(root))).data;
const fresh = () => ({ day: 1, hour: 8, deltas: 0, nodes: [], recipes: [], tank: { cond: 90, at: 0, since: 1 }, inv: { grids: { chest: newGrid(8, 6), backpack: newGrid(6, 4) } }, rig: { units: [] } });

test('Bilanz: Mitgebrachtes (Ressourcen zuerst), neue Rezepte, Techtree bezahlbar → Techtree', () => {
  const s = fresh(), before = snapshot(D, s);
  s.inv.grids.backpack.items.push({ a: 'items', id: 'kupferkabel', n: 4, x: 0, y: 0 }, { a: 'items', id: 'technik', n: 3, x: 1, y: 0 });
  s.recipes.push(Object.keys(D.recipes)[0]);
  const S = compare(D, s, before, { grade: 'B' });
  assert.equal(S.gained[0].id, 'technik');
  assert.ok(S.gained.some(x => x.id === 'kupferkabel' && x.n === 4));
  assert.equal(S.recipes.length, 1);
  assert.ok(S.ready.includes(D.techtree.wartungsklappe.name));
  assert.equal(S.next.kind, 'tech');
  assert.equal(S.grade, 'B');
});
test('Bilanz: erfüllter Auftrag geht vor, k.o. zeigt Verlorenes', () => {
  const s = fresh();
  accept(D, s, 'kabelsalat');
  s.inv.grids.backpack.items.push({ a: 'items', id: 'goldzahn', n: 1, x: 0, y: 0 });
  const before = snapshot(D, s);
  s.inv.grids.backpack.items = [{ a: 'items', id: 'kupferkabel', n: 5, x: 0, y: 0 }];
  const S = compare(D, s, before, {});
  assert.equal(S.next.kind, 'quests');
  assert.ok(S.quests.some(q => q.id === 'kabelsalat' && q.ready));
  assert.ok(S.lost.some(x => x.id === 'goldzahn'));
});

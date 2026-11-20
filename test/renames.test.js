// Backlog C10 (#125): renames are logged (data/renames.json) and savegames follow them on load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject, renameEntry, renameMap, validateProject } from '../engine/project.js';
import { newSave, repairSave, followRenames } from '../game/save.js';
import { add } from '../game/inventory.js';
import { nodeLoader } from '../tools/loader.js';

const load = async () => loadProject(nodeLoader('projects/nomadgirl'));

test('Umbenennen schreibt ins Protokoll, Zurück-Umbenennen zeigt wieder auf die alte ID', async () => {
  const p = await load();
  const changed = renameEntry(p, 'items', 'kupferkabel', 'kabel_kupfer');
  assert.ok(changed.includes('renames'));
  assert.deepEqual(p.data.renames.log.at(-1).from, 'kupferkabel');
  assert.deepEqual(renameMap(p.data).items, { kupferkabel: 'kabel_kupfer' });
  renameEntry(p, 'items', 'kabel_kupfer', 'kupferkabel');
  assert.deepEqual(renameMap(p.data).items, { kabel_kupfer: 'kupferkabel' });   // back where it was: only a savegame from in between follows
  assert.ok(!validateProject(p).some(m => m.level === 'error'));
});

test('Ketten a → b → c landen bei c', async () => {
  const p = await load();
  renameEntry(p, 'buffs', 'satt', 'satt2');
  renameEntry(p, 'buffs', 'satt2', 'gesaettigt');
  assert.equal(renameMap(p.data).buffs.satt, 'gesaettigt');
  assert.equal(renameMap(p.data).buffs.satt2, 'gesaettigt');
});

test('Spielstand zieht mit: Gegenstand im Rucksack, Rezept, Buff', async () => {
  const p = await load(), D = p.data;
  const s = newSave(D);
  s.buffs = ['satt'];
  s.recipes = [...new Set([...(s.recipes || []), 'bohneneintopf'])];
  assert.equal(add(D, s.inv.grids.backpack, 'items', 'kupferkabel', 3), 0);
  const raw = JSON.parse(JSON.stringify(s));
  renameEntry(p, 'items', 'kupferkabel', 'kabel_kupfer');
  renameEntry(p, 'buffs', 'satt', 'gesaettigt');
  renameEntry(p, 'recipes', 'bohneneintopf', 'bohnen_eintopf');
  const r = repairSave(raw, D);
  assert.ok(r.inv.grids.backpack.items.some(e => e.a === 'items' && e.id === 'kabel_kupfer' && e.n === 3), 'Kabel bleibt im Rucksack');
  assert.ok(!r.inv.grids.backpack.items.some(e => e.id === 'kupferkabel'));
  assert.deepEqual(r.buffs, ['gesaettigt']);
  assert.ok(r.recipes.includes('bohnen_eintopf') && !r.recipes.includes('bohneneintopf'));
});

test('Ohne Umbenennungen bleibt der Spielstand unberührt', async () => {
  const D = (await load()).data;
  const s = newSave(D), before = JSON.stringify(s);
  assert.equal(followRenames(D, s), 0);
  assert.equal(JSON.stringify(s), before);
});

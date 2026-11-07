// Tests for engine/schema.js and engine/project.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from '../tools/loader.js';
import { AREAS, GROUPS, fields, loadProject, validateProject, usages, renameEntry, removeEntry, get, set } from '../engine/project.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl');
const load = () => loadProject(nodeLoader(root));
const TYPES = new Set(['text', 'textarea', 'number', 'checkbox', 'color', 'select', 'multi', 'ref', 'refs', 'size', 'point', 'range', 'table']);

test('schema: every area is in exactly one group, every field is well-formed', () => {
  const grouped = GROUPS.flatMap(([, l]) => l);
  assert.deepEqual([...grouped].sort(), Object.keys(AREAS).sort());
  assert.equal(new Set(grouped).size, grouped.length);
  for (const a of Object.keys(AREAS)) {
    const A = AREAS[a];
    assert.ok(A.name && A.icon && A.file && ['catalog', 'single'].includes(A.kind), a);
    const all = fields(a).flatMap(f => f.type === 'table' ? [f, ...f.columns] : [f]);
    for (const f of all) {
      assert.ok(TYPES.has(f.type), `${a}.${f.key}: Typ ${f.type}`);
      if (f.type === 'ref' || f.type === 'refs') assert.ok(AREAS[f.area], `${a}.${f.key} → ${f.area}`);
      if (f.type === 'select' || f.type === 'multi') assert.ok(f.options?.length, `${a}.${f.key} ohne Optionen`);
    }
    const keys = fields(a).map(f => f.key);
    assert.equal(new Set(keys).size, keys.length, `${a}: doppelte Feldschlüssel`);
  }
});

test('data: the example project has no errors (asset files included)', async () => {
  const p = await load(); p.exists = f => fs.existsSync(path.join(root, f));
  const errors = validateProject(p).filter(m => m.kind === 'error');
  assert.deepEqual(errors, []);
});

test('get/set: dot paths, empty values remove and clean up', () => {
  const x = {};
  set(x, 'movement.walkSpeed', 120);
  assert.equal(get(x, 'movement.walkSpeed'), 120);
  set(x, 'movement.walkSpeed', undefined);
  assert.deepEqual(x, {});
});

test('validation: unknown reference is an error, template entries are valid', async () => {
  const p = await load();
  p.data.enemies.kriecher.loot = 'gibt_es_nicht';
  assert.ok(validateProject(p).some(m => m.kind === 'error' && m.place.area === 'enemies' && m.place.id === 'kriecher'));
  for (const [a, A] of Object.entries(AREAS)) if (A.kind === 'catalog' && A.template) {
    const q = await load(); q.data[a].__neu = structuredClone(A.template);
    const e = validateProject(q).filter(m => m.kind === 'error' && m.place.id === '__neu' && !/fehlt|ohne Zutaten/.test(m.text));
    assert.deepEqual(e, [], `Vorlage von ${a}`);
  }
});

test('rename: references in all areas follow (ref, refs, table)', async () => {
  const p = await load();
  const changed = renameEntry(p, 'items', 'kupferkabel', 'kupferdraht');
  assert.ok(p.data.items.kupferdraht && !p.data.items.kupferkabel);
  assert.ok(changed.includes('lootTables') && changed.includes('recipes'));
  assert.ok(p.data.recipes.kabelbaum.ingredients.some(i => i.item === 'kupferdraht'));
  assert.deepEqual(usages(p, 'items', 'kupferkabel'), []);
  renameEntry(p, 'workshops', 'werkbank', 'bastelbank');
  assert.equal(p.data.recipes.verband.station, 'bastelbank');
  assert.ok(p.data.game.start.workshops.includes('bastelbank'));
  assert.ok(p.data.companions.schraube.workshops.includes('bastelbank'));
  assert.deepEqual(validateProject(p).filter(m => m.kind === 'error'), []);
});

test('remove: references are cleared', async () => {
  const p = await load();
  removeEntry(p, 'enemies', 'kriecher');
  assert.ok(!p.data.pois.tankstelle_km7.enemies.includes('kriecher'));
  assert.deepEqual(usages(p, 'enemies', 'kriecher'), []);
});

test('start rig: places, power and weight are checked', async () => {
  const p = await load();
  p.data.game.start.workshops.push('kueche');
  assert.ok(validateProject(p).some(m => m.place.area === 'game' && /Plätze/.test(m.text)));
});

test('sprites: a missing file is an error when files can be checked', async () => {
  const p = await load(); p.exists = () => false;
  assert.ok(validateProject(p).some(m => m.kind === 'error' && m.place.area === 'sprites'));
});

// Datensets (#073): a set is a variant of the standard (only what differs), merged on load
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { AREAS } from '../engine/schema.js';
import { mergeArea, diffArea, applySet, setChanges, setFile, SET_INDEX, slugSet } from '../engine/sets.js';

const base = nodeLoader('projects/nomadgirl');
const withFiles = files => ({ ...base, async json(p) { if (files.has(p)) return structuredClone(files.get(p)); return base.json(p); } });

test('Diff und Merge sind Umkehrungen (Katalog und Einzelbereich, auch Löschen)', () => {
  const b = { a: { x: 1 }, b: { y: 2 }, c: { z: 3 } }, c = { a: { x: 1 }, b: { y: 5 }, d: { w: 1 } };
  const d = diffArea('catalog', b, c);
  assert.deepEqual(d, { b: { y: 5 }, d: { w: 1 }, c: null });
  assert.deepEqual(mergeArea('catalog', b, d), c);
  const s0 = { m: { run: 1, jump: 2 }, list: [1, 2], keep: 1 }, s1 = { m: { run: 3, jump: 2 }, list: [1], keep: 1 };
  const ds = diffArea('single', s0, s1);
  assert.deepEqual(ds, { m: { run: 3 }, list: [1] });
  assert.deepEqual(mergeArea('single', s0, ds), s1);
  assert.equal(diffArea('single', s0, structuredClone(s0)), undefined);
  assert.equal(slugSet('Härter & schneller!'), 'harter_schneller');
});

test('Ein Set wird über den Standard gelegt; seine Dateien enthalten nur den Unterschied', async () => {
  const P0 = await loadProject(base), std = structuredClone(P0.data);
  const P = await loadProject(base);
  P.data.leyla.movement.runSpeed = 999;
  P.data.items.verband.value = 77;
  delete P.data.items.kupferkabel;
  const ch = setChanges(P, std, 'hart').filter(c => c.content);
  assert.deepEqual(ch.map(c => c.file).sort(), [setFile('hart', P.paths.items), setFile('hart', P.paths.leyla)].sort());
  assert.deepEqual(ch.find(c => c.file.endsWith(P.paths.leyla)).content, { movement: { runSpeed: 999 } });
  const files = new Map([[SET_INDEX, [{ id: 'hart', name: 'Hart' }]], ...ch.map(c => [c.file, c.content])]);
  const Q = await loadProject(withFiles(files));
  const meta = await applySet(Q, withFiles(files), 'hart');
  assert.equal(meta.name, 'Hart');
  assert.equal(Q.data.leyla.movement.runSpeed, 999); assert.equal(Q.data.items.verband.value, 77); assert.ok(!Q.data.items.kupferkabel);
  assert.deepEqual(Q.data.weapons, std.weapons);
  assert.equal(await applySet(await loadProject(base), withFiles(files), 'gibtsnicht'), null);
  assert.ok(Object.keys(AREAS).length > 30);
});

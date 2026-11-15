// Ressourcen verdienen (#039, game/earn.js): chests, kills by family and bosses, secrets, a good rank, cooking/crafting the first time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave } from '../game/save.js';
import { earn, earnRows } from '../game/earn.js';
import { craft, stock } from '../game/crafting.js';
import { loadProject } from '../engine/project.js';
import { classicRig } from './fixture.js';
import { nodeLoader } from '../tools/loader.js';

const D = classicRig((await loadProject(nodeLoader('projects/nomadgirl'))).data);
const sure = () => 0;   // every chance hits, the minimum count
const ids = list => list.map(t => `${t.id}×${t.n}`).sort();

test('Kisten, Kills nach Familie, Bosse, Secrets: die passenden Regeln würfeln', () => {
  assert.deepEqual(ids(earn(D, 'chest', {}, sure)), ['technik×1', 'wissen×1']);
  assert.deepEqual(ids(earn(D, 'kill', { family: 'mutant' }, sure)), ['bio×1']);
  assert.deepEqual(ids(earn(D, 'kill', { family: 'raider' }, sure)), ['technik×1']);
  assert.deepEqual(ids(earn(D, 'kill', { family: 'raider', boss: true }, sure)), ['technik×3', 'wissen×3']);   // raider 1 + boss 2
  assert.deepEqual(ids(earn(D, 'kill', { family: 'anomaly' }, sure)), []);
  assert.deepEqual(ids(earn(D, 'secret', {}, sure)), ['wissen×1']);
  assert.deepEqual(earn(D, 'chest', {}, () => 0.99), []);   // chances can miss
});
test('Rang: guter Rang gibt Wissen extra, S auch Technik, F nichts', () => {
  assert.deepEqual(ids(earn(D, 'rank', { grade: 'F' }, sure)), []);
  assert.deepEqual(ids(earn(D, 'rank', { grade: 'C' }, sure)), ['wissen×1']);
  assert.deepEqual(ids(earn(D, 'rank', { grade: 'A' }, sure)), ['wissen×2']);
  assert.deepEqual(ids(earn(D, 'rank', { grade: 'S' }, sure)), ['technik×2', 'wissen×2']);
  assert.equal(earnRows(D, 'rank', { grade: 'B' }).length, 1);
});
test('Kochen/Herstellen: nur beim ersten Mal je Rezept, landet im Lager (kein Farming)', () => {
  const s = newSave(D); s.hour = 18.5;
  const bio0 = stock(D, s).bio || 0;
  const a = craft(D, s, 'bohneneintopf', 'kochnische');
  assert.ok(a.ok, a.reason);
  assert.deepEqual(ids(a.earned), ['bio×1']);
  assert.equal(stock(D, s).bio || 0, bio0 + 1);
  const b = craft(D, s, 'bohneneintopf', 'kochnische');
  if (b.ok) assert.deepEqual(b.earned, []);
});

// Gangs als Auftraggeber (#088): jobs of a gang are offered only from their Ruf (Geduldet), not in the camp, handed in for Ruf
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject, validateProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { offers, gangJobs, accept, claim, progressOf, trackedGoal, track } from '../game/quests.js';
import { addRep, repOf } from '../game/reputation.js';
import { bump } from '../game/achievements.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;
const V = 'Yellow Vultures';

test('Daten: Gang-Aufträge gültig, jede Gang hat ein Revier', () => {
  const gq = Object.entries(D.quests).filter(([, x]) => x.gang);
  assert.ok(gq.length >= 6);
  const r = validateProject(P);
  assert.equal(r.filter(x => x.level === 'error' && x.area === 'quests').length, 0);
});
test('Angebot nur ab Geduldet, nie im Camp-Angebot', () => {
  const save = newSave(D);
  assert.ok(!offers(D, save).some(id => D.quests[id].gang), 'Camp-Angebote ohne Gang-Aufträge');
  assert.deepEqual(gangJobs(D, save, V).offers, []);
  addRep(D, save, V, 25);
  assert.deepEqual(gangJobs(D, save, V).offers, ['vultures_ratten']);
});
test('Annehmen, Zähler, Abgeben: Δ und Ruf, Folge-Auftrag erst als Freund', () => {
  const save = newSave(D); addRep(D, save, V, 25);
  const d0 = save.deltas || 0;
  assert.ok(accept(D, save, 'vultures_ratten'));
  assert.equal(gangJobs(D, save, V).active[0], 'vultures_ratten');
  track(save, 'vultures_ratten');
  assert.match(trackedGoal(D, save)?.sub || '', /Yellow Vultures/);
  assert.ok(!progressOf(D, save, 'vultures_ratten').ready);
  bump(D, save, 'pois', 1, ['grossmarkt']);
  assert.ok(progressOf(D, save, 'vultures_ratten').ready);
  assert.deepEqual(gangJobs(D, save, V).ready, ['vultures_ratten']);
  const r = claim(D, save, 'vultures_ratten');
  assert.ok(r.ok); assert.equal(save.deltas, d0 + 80); assert.equal(repOf(save, V), 40); assert.ok(r.got.some(g => /Ruf Yellow Vultures \+15/.test(g)));
  assert.deepEqual(gangJobs(D, save, V).offers, [], 'Leere Kanister erst als Freund');
  addRep(D, save, V, 30);
  assert.deepEqual(gangJobs(D, save, V).offers, ['vultures_kanister']);
});

test('#101 Jede Gang mit Revier hat mindestens einen Auftrag, Folgeaufträge zeigen auf einen der eigenen', async () => {
  const { loadProject } = await import('../engine/project.js');
  const { nodeLoader } = await import('../tools/loader.js');
  const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
  const gangs = new Set(Object.values(D.pois).map(p => p.gang?.name).filter(Boolean));
  const Q = Object.entries(D.quests).filter(([, q]) => q.gang);
  for (const g of gangs) assert.ok(Q.some(([, q]) => q.gang === g), `${g} hat keinen Auftrag`);
  assert.equal(gangs.size, 12);
  for (const [id, q] of Q) if (q.after) assert.equal(D.quests[q.after]?.gang, q.gang, `${id}: Vorgänger gehört zur selben Gang`);
});

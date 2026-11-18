// Eine Bedingungs-Sprache (#068): Merker, Tag, Crew & Rig — the same check for answers, situations and quests
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { check, ok } from '../game/conditions.js';
import { offers } from '../game/quests.js';
import { situationsFor } from '../game/road_events.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('check: Merker (beide Schreibweisen), Tag, Crew; der Grund nennt, was fehlt', () => {
  const save = newSave(D);
  save.road = { flags: ['a'], seen: [], chain: null };
  assert.ok(ok(D, save, { needsFlag: 'a' }) && ok(D, save, { needs: 'a' }) && !ok(D, save, { not: 'a' }) && !ok(D, save, { notFlag: 'a' }));
  const r = check(D, save, { minDay: 99, needCompanion: 'schraube', needWorkshop: 'cyber' });
  assert.equal(r.ok, false); assert.match(r.why, /Tag 99 erreicht/); assert.match(r.why, /Ripperdoc-Liege im Rig/); assert.doesNotMatch(r.why, /Schraube/);
});

test('Quests und Lagen fragen dieselbe Sprache: ein Auftrag nur mit Schraube an Bord, eine Lage nur mit Kochnische', () => {
  const save = newSave(D), D2 = { ...D, quests: { ...D.quests, mit_schraube: { name: 'T', giver: 'schraube', counter: 'kills', target: 1, needCompanion: 'schraube' } },
    roadEvents: { ...D.roadEvents, situations: [...D.roadEvents.situations, { id: 'nur_kueche', name: 'K', weight: 1, danger: 1, time: 'any', needWorkshop: 'kitchen', answers: 'weiterfahren' }, { id: 'nur_doc', name: 'R', weight: 1, danger: 1, time: 'any', needWorkshop: 'cyber', answers: 'weiterfahren' }] } };
  assert.ok(offers(D2, save).includes('mit_schraube'));
  save.companions = [];
  assert.ok(!offers(D2, save).includes('mit_schraube'));
  const ids = situationsFor(D2, { danger: 3, save }).map(s => s.id);
  assert.ok(ids.includes('nur_kueche') && !ids.includes('nur_doc'));
});

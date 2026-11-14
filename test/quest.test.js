// The red thread (#016): the goal line follows the mechanics: the tank first when weak, else the next node on the way to the cure
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { goal, pathTo, progress } from '../game/quest.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl');
const D = (await loadProject(nodeLoader(root))).data;
const fresh = () => ({ nodes: [], tank: { cond: 90, at: 0, since: 1 }, inv: { grids: {} }, rig: { units: [] }, day: 1, hour: 8 });

test('Zielzeile: nächster Knoten zum Heilmittel, mit Woher', () => {
  const g = goal(D, fresh());
  assert.equal(g.kind, 'step');
  assert.match(g.text, /Heilmittel: Wartungsklappe/);
  assert.match(g.sub, /Technik \(Zerlegen an der Werkbank\)/);
  assert.equal(g.progress, 0);
});
test('Zielzeile: schwacher Tank geht vor, toter Tank = Suche verloren, Heilmittel = fertig', () => {
  const s = fresh(); s.tank.cond = 20;
  assert.equal(goal(D, s).kind, 'tank');
  s.tank.dead = true; assert.equal(goal(D, s).kind, 'lost');
  const done = fresh(); done.nodes = pathTo(D, 'heilmittel');
  assert.equal(goal(D, done).kind, 'done');
  assert.equal(progress(D, done), 1);
});
test('Zielzeile: Fortschritt wächst mit jedem Knoten auf dem Weg', () => {
  const s = fresh(); s.nodes = ['wartungsklappe'];
  assert.ok(progress(D, s) > 0 && progress(D, s) < 1);
  assert.doesNotMatch(goal(D, s).text, /Wartungsklappe/);
});

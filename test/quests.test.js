// Questlog (#016): offers, taking a job, counting from the moment it was taken, delivering, reward, tracking
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { offers, accept, progressOf, claim, trackedGoal, questLog, track } from '../game/quests.js';
import { bump } from '../game/achievements.js';
import { newGrid } from '../game/inventory.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl');
const D = (await loadProject(nodeLoader(root))).data;
const fresh = () => ({ day: 1, hour: 8, deltas: 0, nodes: [], tank: { cond: 90, at: 0, since: 1 }, inv: { grids: { chest: newGrid(8, 6), backpack: newGrid(6, 4) } }, rig: { units: [] } });

test('Questlog: Angebote, Folge-Auftrag erst nach dem ersten, Ab Tag', () => {
  const s = fresh(), o = offers(D, s);
  assert.ok(o.includes('kabelsalat') && o.includes('sungs_suppe'));
  assert.ok(!o.includes('geier_rupfen'), 'Folgeauftrag noch nicht');
  assert.ok(!o.includes('lichter_fuers_camp'), 'erst ab Tag 2');
});
test('Questlog: Zähler zählt ab dem Annehmen, Abgeben gibt die Belohnung', () => {
  const s = fresh();
  bump(D, s, 'cooked', 5);   // before taking the job: does not count
  accept(D, s, 'sungs_suppe');
  assert.equal(progressOf(D, s, 'sungs_suppe').n, 0);
  bump(D, s, 'cooked', 3);
  assert.equal(progressOf(D, s, 'sungs_suppe').ready, true);
  const r = claim(D, s, 'sungs_suppe');
  assert.ok(r.ok && s.deltas === 40 && s.quests.done.sungs_suppe);
  assert.ok(s.inv.grids.chest.items.some(e => e.id === 'bio' && e.n === 2));
  assert.ok(offers(D, s).includes('tresor_tankstelle'), 'Folgeauftrag jetzt im Angebot');
});
test('Questlog: Abgeben nimmt die Dinge, verfolgte Quest in der Zielzeile, schwacher Tank geht vor', () => {
  const s = fresh();
  accept(D, s, 'kabelsalat');
  assert.equal(trackedGoal(D, s).quest, 'kabelsalat');
  s.inv.grids.chest.items.push({ a: 'items', id: 'kupferkabel', n: 6, x: 0, y: 0 });
  assert.equal(trackedGoal(D, s).kind, 'ready');
  assert.ok(claim(D, s, 'kabelsalat').ok);
  assert.equal(s.inv.grids.chest.items.find(e => e.id === 'kupferkabel').n, 1);
  accept(D, s, 'sungs_suppe'); track(s, 'sungs_suppe');
  s.tank.cond = 20;
  assert.equal(trackedGoal(D, s).kind, 'tank');
  const L = questLog(D, s);
  assert.ok(L.main.steps.length >= 5 && L.tank && L.active.length === 1 && L.done.length === 1);
});

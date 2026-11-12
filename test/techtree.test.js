// The tech tree (game/techtree.js, design.md › Progression): status, unlocking with resources from the camp, recipes, bonuses on the tank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave } from '../game/save.js';
import { status, unlock, bonuses, tankMods, tabs } from '../game/techtree.js';
import { rate, rescue } from '../game/tank.js';
import { add } from '../game/inventory.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const give = (s, id, n) => add(D, s.inv.grids.chest, 'items', id, n);

test('Tabs: Technik, Wissen, Bio; Dunkelheit bleibt versteckt', () => {
  assert.deepEqual(tabs(D).map(t => t.id), ['technik', 'wissen', 'bio']);
});

test('Freischalten kostet Ressourcen aus dem Camp, braucht Voraussetzungen, lernt Rezepte', () => {
  const s = newSave(D);
  for (const g of Object.values(s.inv.grids)) g.items = [];
  assert.equal(status(D, s, 'wartungsklappe').state, 'open');
  assert.equal(status(D, s, 'thermohuelle').state, 'locked');
  give(s, 'technik', 9); give(s, 'wissen', 1);
  const r = unlock(D, s, 'wartungsklappe');
  assert.ok(r.ok && r.learnt.includes('tank_dichtung') && s.recipes.includes('tank_dichtung'));
  assert.equal(status(D, s, 'wartungsklappe').state, 'owned');
  assert.ok(unlock(D, s, 'thermohuelle').ok);
  assert.equal(unlock(D, s, 'notreserve').ok, false, 'kein Bio');
});

test('Boni wirken auf den Tank: Verfall −15 %, Rettung −25 %', () => {
  const s = newSave(D), base = rate(D, s);
  s.nodes = ['thermohuelle', 'notreserve'];
  assert.ok(Math.abs(rate(D, s) / base - 0.85) < 1e-9);
  assert.equal(bonuses(D, s).tankRescue, -25);
  assert.equal(tankMods(D, s).rescue, 0.75);
  const before = s.tank.cond; rescue(D, s); assert.equal(before - s.tank.cond, D.tank.rescue * 0.75);
});

test('Neuer Durchgang: Knoten und ihre Rezepte bleiben, alles andere fängt klein an', async () => {
  const { newCycle } = await import('../game/save.js');
  const s = newSave(D);
  s.nodes = ['wartungsklappe', 'thermohuelle', 'weg_damit']; s.deltas = 12345; s.tank.cond = 0; s.tank.dead = true; s.day = 9;
  const n = newCycle(D, s);
  assert.deepEqual(n.nodes, ['wartungsklappe', 'thermohuelle']);
  assert.equal(n.cycle, 2); assert.equal(n.tank.cond, 100); assert.equal(n.tank.dead, false);
  assert.equal(n.deltas, newSave(D).deltas); assert.ok(n.day < 9);
  assert.ok(n.recipes.includes('tank_dichtung'));
  assert.equal(n.dreams.length, 1);
});

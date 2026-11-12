// The cryo tank (game/tank.js, design.md › Progression): decay in event time, phases, rescues, maintenance, old savegames.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, repairSave, advance } from '../game/save.js';
import { update, phase, rescue, ensureTank } from '../game/tank.js';
import { craft } from '../game/crafting.js';
import { add } from '../game/inventory.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Neuer Spielstand: Cryo-Tank steht im kleinsten Container, voll', () => {
  const s = newSave(D);
  const u = s.rig.units.find(u => u.workshops.some(w => w.id === D.tank.workshop));
  assert.equal(u?.id, D.tank.container);
  assert.equal(s.tank.cond, 100);
  assert.equal(phase(D, s).name, 'Stabil');
});

test('Ohne Pflege stirbt AvA nach etwa 10 Tagen (≈ 10 Runs), immer schneller', () => {
  const s = newSave(D);
  let day = 0, lost1 = 0;
  while (!s.tank.dead && day < 30) { advance(s, 24); const l = update(D, s); if (!day) lost1 = l; day++; }
  assert.ok(day >= 8 && day <= 12, `nach ${day} Tagen`);
  assert.ok(s.tank.dead && s.tank.cause === 'decay');
  const s2 = newSave(D); s2.tank.cond = 30; advance(s2, 24); assert.ok(update(D, s2) > lost1, 'schwacher Tank verfällt schneller');
});

test('Phasen nach Zustand', () => {
  const s = newSave(D);
  for (const [c, name] of [[100, 'Stabil'], [70, 'Beschlagen'], [50, 'Risse'], [30, 'Lecks'], [5, 'Alarm']]) { s.tank.cond = c; assert.equal(phase(D, s).name, name); }
  s.tank.dead = true; assert.ok(phase(D, s).dead);
});

test('Rettung kostet Zustand, die letzte Rettung kostet AvA das Leben', () => {
  const s = newSave(D);
  const r = rescue(D, s);
  assert.equal(r.last, false); assert.equal(s.tank.cond, 100 - D.tank.rescue);
  s.tank.cond = D.tank.rescue - 1;
  const r2 = rescue(D, s);
  assert.ok(r2.last && s.tank.dead && s.tank.cause === 'rescue');
});

test('Wartung am Tank: Rezept füllt auf, hilft nur bis zur Phase', () => {
  const s = newSave(D);
  for (const g of Object.values(s.inv.grids)) g.items = [];
  add(D, s.inv.grids.chest, 'items', 'panzertape', 4); add(D, s.inv.grids.chest, 'items', 'schrott', 2);
  s.tank.cond = 50;
  let r = craft(D, s, 'tank_notflicken', D.tank.workshop);
  assert.ok(r.ok, r.reason); assert.equal(Math.round(s.tank.cond), 58);
  s.tank.cond = 30;   // Lecks (Phase 4): tape does not help any more
  r = craft(D, s, 'tank_notflicken', D.tank.workshop);
  assert.equal(r.ok, false);
});

test('Alter Spielstand ohne Tank: bekommt ihn am Ende des Rigs, Lager-Schlüssel bleiben, voll zur heutigen Uhrzeit', () => {
  const s = newSave(D);
  s.rig.units = s.rig.units.filter(u => !u.workshops.some(w => w.id === D.tank.workshop));
  delete s.tank; s.day = 9;
  const keys = s.rig.units.map((u, i) => i);
  const r = repairSave(JSON.parse(JSON.stringify(s)), D);
  assert.deepEqual(r.rig.units.slice(0, keys.length).map(u => u.id), s.rig.units.map(u => u.id));
  assert.equal(r.rig.units.at(-1).workshops[0].id, D.tank.workshop);
  assert.equal(r.tank.cond, 100);
  update(D, r); assert.ok(r.tank.cond > 99, 'kein Verfall für die Zeit vor dem Tank');
  ensureTank(D, r);
});

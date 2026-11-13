// Werkstätten mit eigener Handlung (#013): quality from timing, dishes stack by quality, weapon copies with their own values,
// AvA's board, a clean operation, the regulator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave } from '../game/save.js';
import { bandQuality, aimQuality, weaponMods, applyMods, installBoard, droneBonuses, implantBonus, noteSurgery, tuneResult, powerBoost, rollCustomers, serve } from '../game/stations.js';
import { craft, give, use, have } from '../game/crafting.js';
import { add, newGrid, gearStats } from '../game/inventory.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('Timing: guter und perfekter Bereich, daneben ist normal (kein Scheitern)', () => {
  assert.equal(bandQuality(72, [55, 90], [68, 80]), 2);
  assert.equal(bandQuality(60, [55, 90], [68, 80]), 1);
  assert.equal(bandQuality(100, [55, 90], [68, 80]), 0);
  assert.equal(aimQuality(-3, 20, 8), 2); assert.equal(aimQuality(15, 20, 8), 1); assert.equal(aimQuality(40, 20, 8), 0);
});

test('Gerichte stapeln nur mit gleicher Qualität, ein perfektes gibt mehr Buff', () => {
  const g = newGrid(4, 4);
  add(D, g, 'items', 'bohneneintopf', 1); add(D, g, 'items', 'bohneneintopf', 1, { q: 2 }); add(D, g, 'items', 'bohneneintopf', 1);
  assert.deepEqual(g.items.map(e => [e.n, e.q || 0]), [[2, 0], [1, 2]]);
  const s = newSave(D);
  const r = use(D, s, 'bohneneintopf', { q: 2 });
  assert.ok(r.ok); assert.equal(r.bonus, 50); assert.equal(s.buffQ.satt, 50);
  assert.equal(use(D, s, 'bohneneintopf', { q: 0 }).ok, false, 'ein schlechteres obendrauf bringt nichts');
});

test('Bauplan + Teile: zwei Teile-Sätze ergeben zwei Exemplare mit anderen Werten', () => {
  const s = newSave(D);
  for (const id of ['schrott', 'schrauben']) give(D, s, id, 10);
  give(D, s, 'langer_lauf', 1); give(D, s, 'kurzer_lauf', 1); give(D, s, 'rotpunkt_visier', 1);
  const a = weaponMods(D, ['langer_lauf', 'rotpunkt_visier'], 2), b = weaponMods(D, ['kurzer_lauf'], 0);
  assert.ok(craft(D, s, 'bauplan_nagelpistole', 'werkbank', { mods: a, parts: ['langer_lauf', 'rotpunkt_visier'], q: 2 }).ok);
  assert.ok(craft(D, s, 'bauplan_nagelpistole', 'werkbank', { mods: b, parts: ['kurzer_lauf'] }).ok);
  assert.equal(have(D, s, 'langer_lauf'), 0, 'die Teile stecken jetzt in der Waffe');
  const copies = Object.values(s.inv.grids).flatMap(g => g.items).filter(e => e.a === 'weapons' && e.id === 'nagelpistole');
  assert.equal(copies.length, 2);
  const w = copies.map(e => applyMods(D.weapons.nagelpistole, e.mods));
  assert.ok(w[0].range > D.weapons.nagelpistole.range && w[1].range < D.weapons.nagelpistole.range);
  assert.ok(w[0].critChance > (D.weapons.nagelpistole.critChance || 0));
  assert.ok(w[1].cooldown < D.weapons.nagelpistole.cooldown);
  assert.equal(craft(D, s, 'bauplan_nagelpistole', 'werkbank', { parts: ['langer_lauf'] }).ok, false, 'ohne das Teil geht es nicht');
});

test('AvAs Platine: Energie-Budget, Chips verbraucht, Bonus mit Lötqualität', () => {
  const s = newSave(D); give(D, s, 'chip', 2); give(D, s, 'notfall_relais', 2);
  assert.equal(installBoard(D, s, [{ id: 'notfall_relais' }, { id: 'notfall_relais' }, { id: 'chip' }]).ok, false, 'zu viel Energie');
  const r = installBoard(D, s, [{ id: 'chip', q: 2 }, { id: 'notfall_relais', q: 0 }]);
  assert.ok(r.ok);
  assert.equal(droneBonuses(D, s).battery, Math.round(D.items.chip.chip.value * 1.3));
  assert.equal(have(D, s, 'chip'), 1);
});

test('Ripperdoc: ein sauberer Schnitt verstärkt nur die Vorteile', () => {
  const s = newSave(D); noteSurgery(s, 'panzerhaut_titan', 2);
  assert.equal(implantBonus(D, s, 'panzerhaut_titan'), 20);
  const t = D.items.panzerhaut_titan, base = gearStats(D, { [t.wear]: 'panzerhaut_titan' }), up = gearStats(D, { [t.wear]: 'panzerhaut_titan' }, { panzerhaut_titan: 20 });
  for (const [k, v] of Object.entries(t.stats || {})) { if (v > 0 && k !== 'dashCooldown' && k !== 'tankDecay') assert.ok(up[k] >= base[k]); if (v < 0 && k !== 'dashCooldown') assert.equal(up[k], base[k]); }
});

test('Foodtruck und Regler', () => {
  const s = newSave(D); give(D, s, 'bohneneintopf', 3); s.deltas = 0;
  const q = rollCustomers(D, s, () => 0.1);
  assert.ok(q.length && q.every(c => c.want === 'bohneneintopf'));
  const r = serve(D, s, q[0], 0);
  assert.ok(r.ok && r.tip > 0 && s.deltas === r.deltas);
  const t = tuneResult(D, s, 0.9, 100);
  assert.ok(t.ok); assert.equal(powerBoost(s, 101), D.crafting.stations.power.extra); assert.equal(powerBoost(s, 100 + t.hours + 1), 0);
  assert.equal(tuneResult(D, newSave(D), 0.2, 0).ok, false);
});

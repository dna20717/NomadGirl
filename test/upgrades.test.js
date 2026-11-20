// Werkstätten ausbauen (#078): steps with stars, price in Δ + things + hours, the values add up, they count where the bench counts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { add } from '../game/inventory.js';
import { upgrade, upgradeOf, blocked, titleOf, benchAt, speedOf, powerOf, stepsOf } from '../game/upgrades.js';
import { budgets, startDraft, applyDraft } from '../game/rig.js';
import { craftMinutes } from '../game/crafting.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
function rig() {
  const s = newSave(D); s.deltas = 5000;
  s.rig.units.push({ kind: 'container', id: 'container_40', workshops: [{ id: 'werkbank', at: 0 }, { id: 'generator', at: 1 }] });
  for (const id of ['schrauben', 'kabelbaum', 'alte_platine', 'rohrbogen']) add(D, s.inv.grids.camp, 'items', id, 6);
  return s;
}
const place = s => `${s.rig.units.length - 1}:0`;

test('Ausbau: Preis, Zeit, ein Stern mehr, Titel mit Sternen', () => {
  const s = rig(), p = place(s), w = benchAt(s, p), r = stepsOf(D, 'werkbank')[0];
  assert.equal(titleOf(D, w), 'Werkbank');
  const h0 = s.day * 24 + s.hour, d0 = s.deltas;
  const x = upgrade(D, s, p);
  assert.ok(x.ok); assert.equal(w.level, 1);
  assert.equal(s.deltas, d0 - r.deltas);
  assert.equal(s.day * 24 + s.hour - h0, r.hours);
  assert.equal(titleOf(D, w), 'Werkbank ★');
  upgrade(D, s, p); upgrade(D, s, p);
  assert.equal(titleOf(D, w), 'Werkbank ★★★');
  assert.equal(blocked(D, s, w), 'Voll ausgebaut');
  assert.equal(upgradeOf(D, w).speed, stepsOf(D, 'werkbank').reduce((n, r) => n + (r.speed || 0), 0));
});
test('Ohne Geld oder Teile geht es nicht', () => {
  const s = rig(), w = benchAt(s, place(s)); s.deltas = 0;
  assert.match(blocked(D, s, w), /Zu wenig Δ/);
  assert.equal(upgrade(D, s, place(s)).ok, false); assert.equal(w.level || 0, 0);
});
test('Wirkung: Herstellen schneller, Generator mehr Strom', () => {
  const s = rig(), p = place(s);
  const r = Object.entries(D.recipes).find(([, r]) => r.station === 'werkbank' && (r.time || 0) >= 20);
  const before = craftMinutes(D, s, r[1], 'werkbank');
  upgrade(D, s, p);
  assert.ok(speedOf(D, s, 'werkbank') > 0);
  assert.ok(craftMinutes(D, s, r[1], 'werkbank') < before);
  const m0 = budgets(D, s.rig).power.made;
  upgrade(D, s, `${s.rig.units.length - 1}:1`);
  assert.equal(powerOf(D, s.rig), upgradeOf(D, benchAt(s, `${s.rig.units.length - 1}:1`)).power + upgradeOf(D, benchAt(s, p)).power);
  assert.ok(budgets(D, s.rig).power.made > m0);
});
test('Der Ausbau bleibt beim Umbauen erhalten', () => {
  const s = rig(), p = place(s);
  upgrade(D, s, p);
  const d = startDraft(D, s), r = applyDraft(D, s, d);
  assert.ok(r.ok !== false, r.reason);
  assert.equal(benchAt(s, p).level, 1);
});

test('#099 Speziallager ausbauen: mehr Reihen je Stern, der Inhalt bleibt', async () => {
  const { containers, fitContainers } = await import('../game/save.js');
  const s = newSave(D); s.deltas = 5000;
  s.rig.units.push({ kind: 'container', id: 'container_40', workshops: [{ id: 'kuehlraum', at: 0 }] });
  add(D, s.inv.grids.camp, 'items', 'kupferkabel', 6); add(D, s.inv.grids.camp, 'items', 'kabelbaum', 4);
  fitContainers(D, s);
  const key = `store:${s.rig.units.length - 1}:0`, size = () => containers(D, s).find(c => c.key === key).size;
  const [w, h] = D.workshops.kuehlraum.grid;
  assert.deepEqual(size(), [w, h]);
  add(D, s.inv.grids[key], 'items', 'kupferkabel', 1);
  assert.equal(upgrade(D, s, `${s.rig.units.length - 1}:0`).ok, true);
  assert.deepEqual(size(), [w, h + 1]);
  assert.equal(s.inv.grids[key].h, h + 1, 'das Raster wächst sofort');
  assert.ok(s.inv.grids[key].items.some(e => e.id === 'kupferkabel'), 'Inhalt bleibt');
  assert.equal(upgrade(D, s, `${s.rig.units.length - 1}:0`).ok, true);
  assert.equal(s.inv.grids[key].h, h + 3);
});

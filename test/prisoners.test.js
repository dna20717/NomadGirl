// Die Zelle: Gefangene (#079): caught in melee like loot, safe in the Zelle, suffering elsewhere, used on the road (Ruf, Dunkelheit),
// hurt by incidents, delivered for Kopfgeld
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave, storeKeyOf, repairSave } from '../game/save.js';
import { add } from '../game/inventory.js';
import { capture, capturable, prisoners, darkOf, catchUp, cellKeys, hurtAll, PRISONER } from '../game/prisoners.js';
import { situationsFor, generateEncounter } from '../game/road_events.js';
import { choose } from '../game/travel.js';
import { accept, claim, offers, progressOf } from '../game/quests.js';
import { repOf } from '../game/reputation.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const raider = { id: 'schlaeger', d: D.enemies.schlaeger };
function withCell() {
  const s = newSave(D);
  s.rig.units.push({ kind: 'container', id: 'container_20', workshops: [{ id: 'zelle', at: 0 }] });
  return repairSave(JSON.parse(JSON.stringify(s)), D);
}
const put = (s, key, gang = 'Yellow Vultures') => { if (key === 'backpack') s.inv.grids.backpack.items = []; const e = capture(D, raider, gang, 0.3); return add(D, s.inv.grids[key], e.a, e.id, 1, { p: e.p }); };

test('Fesseln: nur Plünderer, nur im Nahkampf, mit Chance; der Gefangene trägt Name, Gang, Gesundheit', () => {
  assert.equal(capturable(D, raider, { kind: 'melee' }, () => 0), true);
  assert.equal(capturable(D, raider, { kind: 'shot' }, () => 0), false);
  assert.equal(capturable(D, { id: 'kriecher', d: D.enemies.kriecher }, { kind: 'melee' }, () => 0), false);
  const e = capture(D, raider, 'Yellow Vultures', 0.5);
  assert.equal(e.id, PRISONER); assert.ok(e.p.name && e.p.gang === 'Yellow Vultures' && e.p.hp === 100);
});
test('Zelle: eigenes Lager nur für Gefangene; dort Dunkelheit je Tag, draußen leiden sie', () => {
  const s = withCell(), cells = cellKeys(D, s, storeKeyOf);
  assert.equal(cells.length, 1);
  assert.equal(put(s, cells[0]), 0);
  assert.equal(put(s, 'backpack'), 0);
  s.cellDay = s.day; s.day += 2;
  const r = catchUp(D, s, cells);
  assert.equal(r.dark, 2 * D.roadEvents.prisoners.perDay);
  assert.equal(darkOf(s), r.dark);
  const outside = prisoners(s).find(x => x.key === 'backpack');
  assert.equal(outside.e.p.hp, 100 - 2 * D.roadEvents.prisoners.outside);
});
test('Auf der Straße: Lösegeld nimmt einen Gefangenen, Ruf bei seiner Gang, Dunkelheit; ohne Gefangene keine solche Lage', () => {
  const s = newSave(D); s.deltas = 0;
  const ids = () => situationsFor(D, { danger: 2, save: s }).map(x => x.id);
  assert.ok(!ids().includes('gefangenen_angebot'));
  put(s, 'backpack');
  assert.ok(ids().includes('gefangenen_angebot') && ids().includes('unruhe_laderaum'));
  const E = generateEncounter(D, () => 0.4, { save: s, situation: 'gefangenen_angebot', danger: 2 });
  const o = E.options.find(x => x.answer === 'loesegeld');
  const r0 = repOf(s, 'Yellow Vultures');
  const r = choose(D, s, o, () => 0.99);
  assert.equal(prisoners(s).length, 0); assert.ok(s.deltas > 0);
  assert.ok(repOf(s, 'Yellow Vultures') > r0, r.lines.join(' | '));
  assert.ok(darkOf(s) >= D.roadEvents.prisoners.useDark);
  // without a prisoner the answer is closed
  const E2 = generateEncounter(D, () => 0.4, { save: s, situation: 'gefangenen_angebot', danger: 2 });
  assert.ok(E2.options.find(x => x.answer === 'loesegeld').needPrisoner);
});
test('Unruhe: ruhigstellen verletzt alle, ein toter Gefangener ist weg und hinterlässt Dunkelheit', () => {
  const s = newSave(D); put(s, 'backpack');
  prisoners(s)[0].e.p.hp = 20;
  const h = hurtAll(D, s, 30);
  assert.equal(h[0].died, true); assert.equal(prisoners(s).length, 0); assert.ok(darkOf(s) > 0);
});
test('Auftragsart Kopfgeld: Schraube will einen Gefangenen, Abgeben zahlt und macht dunkler', () => {
  const s0 = newSave(D); s0.day = 5;
  assert.ok(!offers(D, s0).includes('kopfgeld_schraube'), 'erst mit einer Zelle im Rig');
  const s = withCell(); s.day = 5;
  assert.ok(offers(D, s).includes('kopfgeld_schraube'));
  accept(D, s, 'kopfgeld_schraube');
  assert.equal(progressOf(D, s, 'kopfgeld_schraube').ready, false);
  put(s, 'camp');
  assert.equal(progressOf(D, s, 'kopfgeld_schraube').ready, true);
  const d0 = s.deltas, r = claim(D, s, 'kopfgeld_schraube');
  assert.ok(r.ok); assert.equal(s.deltas - d0, 200); assert.equal(prisoners(s).length, 0); assert.ok(darkOf(s) > 0);
});

// #012 Achievements mit Trophäen-Rezepten + Rezepte automatisch lernen (game/achievements.js, game/crafting.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, newCycle, repairSave, containers, SAVE_VERSION } from '../game/save.js';
import { bump, level, check, displayed, bonuses, overview, achievementOf, recipeOf, trophyOf } from '../game/achievements.js';
import { craft, learnAll, learnNote, known, give, experiment } from '../game/crafting.js';
import { bonuses as techBonuses } from '../game/techtree.js';
import { stage } from '../game/garden.js';
import { add, newGrid } from '../game/inventory.js';
import { loadProject, validateProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;
const rich = s => { s.inv.grids.chest = newGrid(40, 40); for (const r of Object.values(D.recipes)) for (const i of r.ingredients || []) give(D, s, i.item, (i.count || 1) * 2); };
// a rig with a treasury in a 20-foot container (and optionally a second one)
function withTreasury(n = 1) {
  const s = newSave(D);
  for (let k = 0; k < n; k++) s.rig.units.push({ kind: 'container', id: 'container_20', workshops: [{ id: 'schatzkammer', at: 0 }] });
  return repairSave(JSON.parse(JSON.stringify(s)), D);
}
const stands = s => containers(D, s).filter(c => c.stand != null);

test('Daten: 12 Achievements, jedes mit einmaligem Trophäen-Rezept, Trophäe mit Tag Trophäe, Prüfung ohne Fehler', () => {
  const ids = Object.keys(D.achievements);
  assert.ok(ids.length >= 10, ids.length);
  for (const id of ids) {
    const rid = recipeOf(D, id), t = trophyOf(D, id);
    assert.ok(rid && D.recipes[rid].once, id);
    assert.ok(D.items[t]?.tags?.includes('trophy'), t);
    assert.equal(achievementOf(D, t), id);
  }
  assert.ok(Object.values(D.achievements).some(x => x.hidden), 'versteckte Achievements');
  assert.ok(new Set(Object.values(D.achievements).map(x => x.category)).size >= 5, 'Kampf, Erkundung, Cosy, AvA, Story');
  const errors = validateProject(P).filter(m => m.kind === 'error');
  assert.deepEqual(errors, []);
});

test('Rezepte automatisch lernen: Zettel im Rucksack → Rezeptbuch, Rucksack leer; bekanntes Rezept → Wissen', () => {
  const s = newSave(D), bag = s.inv.grids.backpack;
  bag.items = [];
  add(D, bag, 'items', 'rezept_ramen', 1);
  const r = learnAll(D, s, bag);
  assert.equal(r.length, 1); assert.ok(r[0].learnt);
  assert.ok(known(s, D.items.rezept_ramen.teaches));
  assert.equal(bag.items.length, 0, 'kein Platz im Rucksack');
  add(D, bag, 'items', 'rezept_ramen', 1);
  const r2 = learnAll(D, s, bag);
  assert.equal(r2[0].learnt, false); assert.equal(r2[0].knowledge, D.crafting.knownKnowledge ?? 1);
  assert.deepEqual(bag.items.map(e => [e.id, e.n]), [['wissen', D.crafting.knownKnowledge ?? 1]]);
  // Schnellaktion „Lernen“: a note in the chest (older savegames)
  const chest = s.inv.grids.chest = newGrid(10, 10); add(D, chest, 'items', 'bauplan_medikit', 1);
  const e = chest.items.find(x => x.id === 'bauplan_medikit');
  assert.ok(learnNote(D, s, chest, e).learnt);
  assert.ok(!chest.items.some(x => x.id === 'bauplan_medikit'));
});

test('Achievement erreichen: Zähler mit Filter, Rezept gelernt, Trophäe nur einmal herstellbar', () => {
  const s = newSave(D);
  rich(s);
  assert.deepEqual(bump(D, s, 'kills', 24, ['raider']), []);
  bump(D, s, 'kills', 5, ['mutant']);
  assert.equal(s.achievements.done.plage, undefined, 'Mutanten zählen nicht für Plünderer');
  const got = bump(D, s, 'kills', 1, ['schlaeger', 'raider']);
  assert.deepEqual(got.map(a => a.id), ['plage']);
  assert.ok(got[0].learnt && known(s, got[0].recipe));
  const rid = got[0].recipe, ws = D.recipes[rid].station;
  const a = craft(D, s, rid, ws);
  assert.ok(a.ok, a.reason);
  const b = craft(D, s, rid, ws);
  assert.equal(b.ok, false); assert.match(b.reason, /einmalig/);
  // experimenting never makes an unknown trophy
  const t = newSave(D); rich(t);
  const pot = Object.fromEntries(D.recipes.trophaee_messing_patrone.ingredients.map(i => [i.item, i.count]));
  assert.equal(experiment(D, t, 'werkbank', pot, () => 0).hit, false);
  // states: the counter is the level
  const u = newSave(D);
  assert.deepEqual(level(D, u, 'lights', 6).map(x => x.id), ['lichterfest']);
});

test('Bonus: Trophäe auf einem Ständer wirkt, im Lager nicht; zweite Schatzkammer zählt mit; doppelt zählt einmal', () => {
  const s = withTreasury(2), st = stands(s);
  assert.ok(st.length >= 8, 'zwei Schatzkammern mit je 4 Ständern');
  assert.deepEqual(bonuses(D, s), {});
  add(D, s.inv.grids.chest, 'items', 'messing_patrone', 1);
  assert.deepEqual(bonuses(D, s), {}, 'in der Kiste wirkt nichts');
  const second = st.filter(c => c.parent !== st[0].parent);
  assert.equal(add(D, s.inv.grids[second[1].key], 'items', 'messing_patrone', 1), 0);
  assert.equal(add(D, s.inv.grids[st[1].key], 'items', 'goldene_giesskanne', 1), 0);
  assert.equal(add(D, s.inv.grids[st[3].key], 'items', 'messing_patrone', 1), 0);
  const b = bonuses(D, s);
  assert.equal(b.crit, 5, 'dieselbe Trophäe zweimal zählt einmal');
  assert.equal(b.growth, 25);
  assert.equal(displayed(D, s).length, 2);
  // AvAs erstes Bild: tank decay through the tech tree bonuses (tank.js uses them)
  add(D, s.inv.grids[st[2].key], 'items', 'avas_erstes_bild', 1);
  assert.equal(techBonuses(D, s).tankDecay, -10);
});

test('Goldene Gießkanne: Hydrokultur wächst schneller', () => {
  const s = withTreasury(1), st = stands(s), place = '0:0';
  s.rig.units[0].workshops.push({ id: 'hydrokultur', at: 1 });
  const before = stage(D, s, 'hydrokultur', place, 0).p;
  s.hour += 3;
  const slow = stage(D, s, 'hydrokultur', place, 0).p;
  add(D, s.inv.grids[st[1].key], 'items', 'goldene_giesskanne', 1);
  const fast = stage(D, s, 'hydrokultur', place, 0).p;
  assert.ok(fast > slow && slow > before - 1e-9, JSON.stringify({ before, slow, fast }));
});

test('Neuer Durchgang: Achievements, Rezepte und Trophäen bleiben, Trophäen liegen in der Erinnerungskiste', () => {
  const s = withTreasury(1), st = stands(s);
  bump(D, s, 'kills', 25, ['raider']);
  add(D, s.inv.grids[st[1].key], 'items', 'raider_maske', 1);
  s.inv.grids.backpack.items = [];
  assert.equal(add(D, s.inv.grids.backpack, 'items', 'goldene_giesskanne', 1), 0);
  const n = newCycle(D, s);
  assert.ok(n.achievements.done.plage);
  assert.ok(n.recipes.includes('trophaee_raider_maske'));
  assert.equal(n.achievements.counts.cycles, 1);
  const pile = n.ground[n.location].find(p => p.memory);
  assert.ok(pile, 'Erinnerungskiste');
  assert.deepEqual(pile.grid.items.map(e => e.id).sort(), ['goldene_giesskanne', 'raider_maske']);
  assert.deepEqual(check(D, n).map(a => a.id), ['neuer_anfang']);
  // the stored savegame keeps the chest (repair)
  const r = repairSave(JSON.parse(JSON.stringify(n)), D);
  assert.ok(r.ground[r.location].some(p => p.memory && p.grid.items.length === 2));
});

test('Alte Spielstände: ohne achievements gültig, Übersicht zeigt versteckte als ???', () => {
  const s = newSave(D); delete s.achievements;
  const r = repairSave(JSON.parse(JSON.stringify({ ...s, version: SAVE_VERSION })), D);
  const o = overview(D, r);
  assert.equal(o.length, Object.keys(D.achievements).length);
  assert.ok(o.some(x => x.hidden) && o.every(x => !x.done));
});

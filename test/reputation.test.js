// Ruf bei den Gangs, Folgen und Ketten (#055): friends are not attacked, enemies hunted, answers change the Ruf, Merker bring later
// incidents, a story runs over several legs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gangs, repOf, addRep, levelOf, gangOfPlace } from '../game/reputation.js';
import { generateEncounter, situationsFor } from '../game/road_events.js';
import { pickEncounter, choose } from '../game/travel.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;
const rng = seed => { let x = (seed * 2654435761) % 2147483647 || 1; return () => (x = (x * 16807) % 2147483647) / 2147483647; };
const fresh = rep => Object.assign(newSave(D), { day: 1, hour: 12, fuel: 50, food: 5, deltas: 500, health: 100, buffs: [], rep: { ...rep }, road: { flags: [], seen: [], chain: null } });
const G = 'Yellow Vultures';

test('Gangs: die elf Gangs der POIs, Ruf −100 … 100, Stufen von Feind bis Freund', () => {
  assert.ok(gangs(D).length >= 11 && gangs(D).some(g => g.name === G));
  const save = fresh({});
  assert.equal(repOf(save, G), 0);
  assert.equal(addRep(D, save, G, 250).to, 100);
  assert.equal(levelOf(D, 100), 'freund'); assert.equal(levelOf(D, -100), 'feind'); assert.equal(levelOf(D, 0), 'neutral');
  assert.equal(gangOfPlace(D, { map: { nodes: [{ id: 'x', poi: 'tankstelle_km7' }] } }, 'x'), G);
});

test('Freund wird nicht überfallen: am Ziel der Gang keine Zollstation, kein Hinterhalt, keine Straßensperre, dafür Freie Fahrt', () => {
  const save = fresh({ [G]: 90 });
  const ids = new Set();
  for (let s = 1; s < 400; s++) {
    const e = generateEncounter(D, rng(s), { save, here: G, danger: 3, night: s % 2 === 0 });
    if (e.gang === G) ids.add(e.situation);
    if (e.gang === G && e.mood) assert.ok(D.roadEvents.moods.find(m => m.id === e.mood).friendly, `${e.situation}: Stimmung ${e.mood}`);
    if (e.gang === G) assert.ok(!e.options.some(o => ['kaempfen', 'durchbrechen'].includes(o.answer)), e.situation);
  }
  assert.ok(!ids.has('zollstation') && !ids.has('hinterhalt') && ids.has('freie_fahrt'), [...ids].join(','));
  const always = { ...D, travel: { ...D.travel, encounterChance: 100 }, roadEvents: { ...D.roadEvents, share: 0 } };
  for (let s = 1; s < 120; s++) { const e = pickEncounter(always, save, 50, rng(s), { here: G }); assert.ok(!(e?.id === 'strassensperre' && e.gang === G)); }
});

test('Feind wird gejagt: Kopfgeldjäger seiner Gang, Antworten ändern den Ruf', () => {
  const save = fresh({ [G]: -90 });
  const found = Array.from({ length: 300 }, (_, s) => generateEncounter(D, rng(s + 1), { save, here: G, danger: 2 })).find(e => e.situation === 'kopfgeld');
  assert.ok(found && found.gang === G);
  const pay = found.options.find(o => o.answer === 'schutzgeld');
  const r = choose(D, save, pay, () => 0.99);
  assert.ok(r.rep && repOf(save, G) === -80 && save.deltas < 500);
});

test('Kette Fehde: drei Etappen hintereinander, gleiche Gangs, am Ende Merker und Buff', () => {
  const save = fresh({});
  const e1 = generateEncounter(D, rng(4), { save, situation: 'fehde1' });
  const side = e1.options.find(o => o.answer === 'partei_gang');
  choose(D, save, side, () => 0.99);
  assert.equal(save.road.chain.step, 'fehde2');
  assert.ok(repOf(save, e1.gang) > 0 && repOf(save, e1.rival) < 0);
  const never = { ...D, travel: { ...D.travel, encounterChance: 0 } };
  const e2 = pickEncounter(never, save, 10, rng(9));
  assert.ok(e2.situation === 'fehde2' && e2.gang === e1.gang && e2.rival === e1.rival, 'die Kette kommt auch ohne Zufall');
  choose(D, save, e2.options[0], () => 0.99);
  const e3 = pickEncounter(never, save, 10, rng(10));
  assert.equal(e3.situation, 'fehde3');
  choose(D, save, e3.options.find(o => o.answer === 'dank_annehmen'), () => 0.99);
  assert.equal(save.road.chain, null);
  assert.ok(save.road.flags.includes('fehde_held') && save.buffs.includes('gestaerkt'));
});

test('Folgen: wer den Kurier rettet, bekommt später ein Dankeschön, einmal je Durchgang', () => {
  const save = fresh({});
  assert.ok(!situationsFor(D, { save }).some(s => s.id === 'kurier_dank'));
  const e = generateEncounter(D, rng(2), { save, chain: { step: 'sos3', n: 3 } });
  choose(D, save, e.options.find(o => o.answer === 'kurier_retten'), () => 0.99);
  assert.ok(situationsFor(D, { save }).some(s => s.id === 'kurier_dank'));
  const d = generateEncounter(D, rng(3), { save, situation: 'kurier_dank' });
  choose(D, save, d.options[0], () => 0.99);
  assert.ok(!situationsFor(D, { save }).some(s => s.id === 'kurier_dank'), 'nur einmal');
  assert.ok(!situationsFor(D, { save }).some(s => s.only), 'Kettenschritte kommen nicht zufällig');
});

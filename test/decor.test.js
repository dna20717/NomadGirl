// Decoration in the camp (#036, game/decor.js): buy, place, lift, Lager, sell, poles as anchors, Gemütlichkeit, rig rebuild.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave, repairSave } from '../game/save.js';
import { act, buyContainer, attach } from '../game/rig.js';
import { buy, put, lift, stow, fromSpare, sell, cozy, cozyBonus, shopDecor, plantStage, dstate } from '../game/decor.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const fresh = () => { const s = newSave(D); s.deltas = 5000; return s; };

test('Katalog: Beispiele aus allen Paketen, alle mit Preis und Art', () => {
  const ids = shopDecor(D);
  assert.ok(ids.length >= 15, ids.length);
  // #111: roof pieces became free pieces (ground, roof, on top of each other)
  for (const k of ['ground', 'wall', 'free', 'span']) assert.ok(ids.some(id => D.decor[id].place === k), k);
  assert.ok(ids.includes('zelt') && ids.includes('zeltstange'));
});

test('Kaufen, platzieren, aufnehmen, ins Lager, verkaufen', () => {
  const s = fresh(), d0 = s.deltas;
  assert.ok(buy(D, s, 'laterne').ok);
  assert.equal(s.deltas, d0 - D.decor.laterne.value);
  assert.ok(put(D, s, 'laterne', { x: 3 }).ok);
  assert.equal(dstate(s).decor.length, 1);
  const o = lift(D, s, 0);
  assert.equal(o.id, 'laterne');
  stow(s, o.id);
  assert.deepEqual(dstate(s).spare.decor, ['laterne']);
  const r = sell(D, s, 'laterne');
  assert.ok(r.ok && r.back === Math.round(D.decor.laterne.value / 2));
  assert.equal(dstate(s).spare.decor.length, 0);
  s.deltas = 0;
  assert.equal(buy(D, s, 'zelt').ok, false);
});

test('Zelt an zwei Zeltstangen; Stange weg = Zelt ins Lager', () => {
  const s = fresh();
  put(D, s, 'zeltstange', { x: 2 }); put(D, s, 'zeltstange', { x: 8 }); put(D, s, 'pflanze', { x: 5 });
  assert.ok(put(D, s, 'zelt', { a: 'pole:0', b: 'pole:1' }).ok);
  assert.equal(put(D, s, 'zelt', { a: 'pole:0', b: 'pole:0' }).ok, false);
  lift(D, s, 0);   // the first pole: the tent comes down, the other pole is now pole:0
  assert.ok(!dstate(s).decor.some(x => x.id === 'zelt'));
  assert.ok(dstate(s).spare.decor.includes('zelt'));
});

test('Gemütlichkeit: Summe, Deckel', () => {
  const s = fresh();
  put(D, s, 'zelt', { a: 'mast:0', b: '1:0' }); put(D, s, 'haengematte', { a: 'mast:0', b: '1:1' });
  assert.equal(cozy(D, s), D.decor.zelt.cozy + D.decor.haengematte.cozy);
  for (let i = 0; i < 20; i++) put(D, s, 'laterne', { x: i });
  assert.equal(cozyBonus(D, s), D.camp.decor.cozyMax);
});

test('Pflanze wächst mit den Tagen', () => {
  const s = fresh(); s.day = 1;
  put(D, s, 'pflanze', { x: 1 });
  const x = dstate(s).decor[0];
  assert.equal(plantStage(D, s, x), 0);
  s.day = 1 + 3 * D.decor.pflanze.growDays;
  assert.equal(plantStage(D, s, x), 3);
});

test('Umbau: Deko wandert mit ihrem Container, alte Spielstände bleiben heil', () => {
  const s = fresh();
  put(D, s, 'neon_open', { ui: 1, p: 0 }); put(D, s, 'graffiti', { ui: 1, p: 0 });
  const r = act(D, s, d => { buyContainer(D, d, 'container_10'); return attach(D, d, d.rig.spare.containers.length - 1); });
  assert.ok(r.ok, r.reason);
  assert.ok(dstate(s).decor.every(x => s.rig.units[x.at.ui]?.id === 'container_10'));
  const back = repairSave(JSON.parse(JSON.stringify(s)), D);
  assert.equal(back.rig.decor.length, 2);
});

test('Balkon am Container-Ende (#037): einer je Ende, wandert mit, Brücke an Balkon und Turm', () => {
  const s = fresh();
  assert.ok(put(D, s, 'balkon', { ui: 1, side: 1 }).ok);
  assert.equal(put(D, s, 'balkon_breit', { ui: 1, side: 1 }).ok, false);
  assert.equal(put(D, s, 'balkon', { ui: 1 }).ok, false);
  put(D, s, 'aussichtsturm', { x: 4 });
  assert.ok(put(D, s, 'haengebruecke', { a: 'balc:0', b: 'tower:1' }).ok);
  lift(D, s, 1);   // the tower goes: the bridge comes down, the balcony stays
  assert.deepEqual(dstate(s).decor.map(x => x.id), ['balkon']);
  assert.ok(dstate(s).spare.decor.includes('haengebruecke'));
});

// Aufräumen 16.11.2026: anchors are array indices; removing pieces must keep the rest pointing at the right ones
test('Deko-Anker: Aufnehmen und Umbauen nummerieren Zeltstangen um, Spannen ohne Anker kommen ins Lager', async () => {
  const { lift, remap } = await import('../game/decor.js');
  const save = { rig: { units: [{}, {}, {}], decor: [
    { id: 'zeltstange', at: { x: 1 } }, { id: 'zelt', at: { a: 'pole:0', b: '1:0' } },
    { id: 'zeltstange', at: { x: 5 } }, { id: 'zelt', at: { a: 'pole:2', b: '2:1' } }], spare: { workshops: [], containers: [] } } };
  lift({}, save, 0);   // the first pole goes: its tent comes down, the second pole moves to index 0
  assert.deepEqual(save.rig.decor.map(o => o.id), ['zeltstange', 'zelt']);
  assert.equal(save.rig.decor[1].at.a, 'pole:0');
  assert.deepEqual(save.rig.spare.decor, ['zelt']);
  // unit 2 leaves the rig: the tent on its corner comes down, the pole stays
  remap(save.rig, ui => (ui === 2 ? null : ui));
  assert.deepEqual(save.rig.decor.map(o => o.id), ['zeltstange']);
  assert.deepEqual(save.rig.spare.decor, ['zelt', 'zelt']);
});

// #111 Camp-Baukasten (game/decor.js): free pieces, stacking, variants, neighbours and ensembles (never negative).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { put, lift, cozy, cozyParts, ensembles, neighbourBonus, restOf, variants, remap, dstate } from '../game/decor.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const fresh = () => { const s = newSave(D); s.deltas = 5000; dstate(s).decor = []; return s; };

test('Baukasten-Stücke: Varianten aus dem Symbol-Raster, Ensembles im Katalog', () => {
  assert.equal(variants(D, 'kit_kiste'), 10);
  assert.equal(variants(D, 'kit_laterne'), 1);
  assert.ok(Object.keys(D.decorSets).length >= 5);
  const s = fresh();
  assert.ok(put(D, s, 'kit_kiste', { x: 2 }).ok);
  const v = s.rig.decor[0].at.v;
  assert.ok(v >= 0 && v < 10);
});

test('Stapeln: Kiste auf Kiste, Pflanze obendrauf, Stuhl nicht, Höhe begrenzt', () => {
  const s = fresh();
  put(D, s, 'kit_kiste', { x: 4 });
  assert.ok(put(D, s, 'kit_kiste', { on: 'deco:0', dx: 0 }).ok);
  assert.ok(put(D, s, 'kit_pflanze', { on: 'deco:1', dx: 0 }).ok);
  assert.equal(put(D, s, 'kit_stuhl', { on: 'deco:1', dx: 0 }).ok, false, 'Stuhl lässt sich nicht draufstellen');
  assert.equal(put(D, s, 'kit_kiste', { on: 'deco:2', dx: 0 }).ok, false, 'auf einer Pflanze hält nichts');
  assert.deepEqual(restOf(D, s, 2), { surf: 'g', x: 4, level: 2 });
  put(D, s, 'kit_kiste', { on: 'deco:1', dx: 0.3 });   // level 2
  assert.ok(put(D, s, 'kit_kiste', { on: 'deco:3', dx: 0 }).ok, 'level 3');
  assert.equal(put(D, s, 'kit_kiste', { on: 'deco:4', dx: 0 }).ok, false, 'Stapel höchstens 4');
});

test('Aufnehmen: was oben stand, rutscht nach unten, nichts geht verloren', () => {
  const s = fresh();
  put(D, s, 'kit_kiste', { x: 6 });
  put(D, s, 'kit_kiste', { on: 'deco:0', dx: 0 });
  put(D, s, 'kit_pflanze', { on: 'deco:1', dx: 0.3 });
  const v = s.rig.decor[2].at.v;
  lift(D, s, 1);
  assert.equal(s.rig.decor.length, 2);
  assert.equal(s.rig.decor[1].id, 'kit_pflanze');
  assert.equal(s.rig.decor[1].at.on, 'deco:0', 'steht jetzt auf der unteren Kiste');
  assert.equal(s.rig.decor[1].at.v, v, 'behält ihre Variante');
  lift(D, s, 0);
  assert.equal(s.rig.decor.length, 1);
  assert.equal(s.rig.decor[0].at.x, 6.3, 'auf dem Boden, wo die Kiste stand');
  assert.deepEqual(dstate(s).spare.decor, []);
});

test('Nachbarn und Ensembles geben nur Bonus (Dorfromantik)', () => {
  const s = fresh();
  put(D, s, 'kit_stuhl', { x: 0 });
  const alone = cozy(D, s);
  assert.equal(alone, D.decor.kit_stuhl.cozy, 'allein: nur sein eigener Wert');
  put(D, s, 'kit_feuerstelle', { x: 2 });
  assert.ok(neighbourBonus(D, s).some(b => b.i === 0 && b.tag === 'feuer'), 'Stuhl mag das Feuer');
  put(D, s, 'kit_stuhl', { x: 4 });
  assert.equal(ensembles(D, s).length, 0);
  put(D, s, 'kit_laterne', { x: 5 });
  const e = ensembles(D, s);
  assert.equal(e.length, 1);
  assert.equal(e[0].id, 'lagerfeuer_ecke');
  const p = cozyParts(D, s);
  assert.equal(p.total, p.base + p.neighbours + D.decorSets.lagerfeuer_ecke.cozy);
  // far away pieces do not count, but cost nothing either
  put(D, s, 'kit_pflanze', { x: 18 });
  assert.equal(cozyParts(D, s).total, p.total + D.decor.kit_pflanze.cozy);
});

test('Gestapelte Kisten zählen fürs Vorratslager, auch auf einem Dach', () => {
  const s = fresh();
  put(D, s, 'kit_kiste', { ui: 1, p: 0 });
  put(D, s, 'kit_kiste', { on: 'deco:0', dx: 0 });
  put(D, s, 'kit_kiste', { ui: 1, p: 0.5 });
  put(D, s, 'kit_kiste', { on: 'deco:2', dx: 0 });
  assert.deepEqual(ensembles(D, s).map(e => e.id), ['vorratslager']);
  // the container goes away: the whole stack goes into the Lager
  remap(s.rig, ui => (ui === 1 ? null : ui));
  assert.equal(s.rig.decor.length, 0);
  assert.equal(dstate(s).spare.decor.length, 4);
});

test('Wand, Balkon und Ensembles der zweiten Runde', () => {
  const s = fresh();
  put(D, s, 'kit_wandschmuck', { ui: 1, p: 0, row: 0.3 });
  put(D, s, 'kit_wandschmuck', { ui: 1, p: 0.17, row: 0.62 });
  put(D, s, 'kit_wandschmuck', { ui: 1, p: 0.33, row: 0.3 });
  assert.equal(restOf(D, s, 0).surf, 'w1');
  assert.ok(ensembles(D, s).some(e => e.id === 'wohnwand'));
  put(D, s, 'balkon', { ui: 1, side: 1 });
  assert.ok(put(D, s, 'kit_liegestuhl', { on: 'balc:3', dx: 0 }).ok);
  assert.equal(put(D, s, 'kit_liegestuhl', { on: 'balc:0', dx: 0 }).ok, false, 'Wandschmuck ist kein Balkon');
  assert.equal(restOf(D, s, 4).surf, 'b3');
  // taking the balcony away puts what stood on it into the Lager
  lift(D, s, 3);
  assert.ok(!s.rig.decor.some(x => x.id === 'kit_liegestuhl'));
  assert.ok(dstate(s).spare.decor.includes('kit_liegestuhl'));
});

test('Alte Stücke als Bild: IDs bleiben, alte Spielstände (Boden, Dach) gelten weiter', () => {
  for (const id of ['dreibein', 'feuertonne', 'vogelhaus', 'windrad', 'spiegel']) { assert.equal(D.decor[id].art, 'sprite', id); assert.equal(D.decor[id].place, 'free', id); }
  const s = fresh();
  s.rig.decor.push({ id: 'windrad', at: { ui: 1, p: 0, day: 1 } }, { id: 'feuertonne', at: { x: 3, day: 1 } });
  assert.equal(restOf(D, s, 0).surf, 'r1');
  assert.equal(restOf(D, s, 1).surf, 'g');
});

// Building the rig (game/rig.js): budgets, moving workshops, buying and selling, containers, storage contents move along.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, clockText, containers } from '../game/save.js';
import { budgets, startDraft, lift, place, fits, toSpare, fromSpare, buyWorkshop, sellWorkshop, buyContainer, attach, detach, shift, problems, applyDraft, shop, sellContainer } from '../game/rig.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const fresh = () => { const s = newSave(D); s.hour = 18.5; return s; };
const layout = s => s.rig.units.map(u => `${u.id}[${u.workshops.map(w => `${w.id}@${w.at}`).join(' ')}]`).join(' ');

test('Budgets: Gewicht gegen Zugkraft, Energie, Container-Zahl', () => {
  const b = budgets(D, fresh().rig);
  assert.deepEqual([b.weight, b.pull, b.heavy, b.length, b.maxLength], [900, 1500, false, 1, 1]);
  assert.deepEqual(b.power, { made: 3, used: 3, net: 0 });   // van 3 ⚡, warroom + kochnische + werkbank −1 each
  assert.equal(b.places, 5); assert.equal(b.filled, 5);
  assert.equal(fresh().deltas, 400);
});

test('Laden: nur erlaubte Ausbaustufen', () => {
  const s = shop(D);
  assert.ok(s.workshops.includes('generator') && s.workshops.includes('kuehlraum') && !s.workshops.includes('reaktor'));
  assert.ok(s.containers.includes('holzkiste'));
});

test('Umstellen: Werkbank und Kochnische tauschen, kostet Zeit; zurück an den alten Platz kostet nichts', () => {
  const s = fresh(), d = startDraft(D, s);
  const a = lift(D, d, 1, 0), b = lift(D, d, 1, 1);
  assert.ok(place(D, d, a, 1, 1) && place(D, d, b, 1, 0));
  assert.equal(d.minutes, 60);
  const c = lift(D, d, 1, 2);
  assert.ok(!fits(D, d.rig, 0, 0, 'lagerregal'));   // van is full
  assert.ok(place(D, d, c, 1, 2));
  assert.equal(d.minutes, 60);
  applyDraft(D, s, d);
  assert.equal(layout(s), 'van[schlafkoje@0 warroom@1] wohnanhaenger[kochnische@1 werkbank@0 lagerregal@2]');
  assert.equal(clockText(s), 'Tag 1 · 19:30');
});

test('Kaufen, Verkaufen, Δ', () => {
  const s = fresh(), d = startDraft(D, s);
  const r = buyWorkshop(D, d, 'generator');
  assert.ok(r.ok);
  assert.equal(d.deltas, 200);
  assert.equal(buyWorkshop(D, d, 'foodtruck').reason, 'Zu wenig Δ');
  assert.ok(sellWorkshop(D, d, r.inst.uid).ok);
  assert.equal(d.deltas, 300);    // half the price back
});

test('Lager mit Inhalt zieht mit um; voll ausbauen geht nicht', () => {
  const s = fresh(), key = containers(D, s).find(c => c.workshop === 'lagerregal').key, before = s.inv.grids[key].items.length;
  assert.ok(before > 0);
  let d = startDraft(D, s);
  const k = lift(D, d, 1, 0), shelf = lift(D, d, 1, 2);
  toSpare(d, k);
  assert.ok(place(D, d, shelf, 1, 0));
  applyDraft(D, s, d);
  assert.equal(s.inv.grids['store:1:0'].items.length, before);
  assert.ok(!s.inv.grids['store:1:2']);
  assert.deepEqual(s.rig.spare.workshops, ['kochnische']);
  d = startDraft(D, s);
  toSpare(d, lift(D, d, 1, 0));
  assert.match(problems(D, d)[0], /nicht leer/);
  assert.equal(applyDraft(D, s, d).ok, false);
});

test('Container: Holzkiste kaufen, Van zieht nur einen, abhängen erst leer', () => {
  const s = fresh(), d = startDraft(D, s);
  assert.ok(buyContainer(D, d, 'holzkiste').ok);
  assert.match(attach(D, d, 0).reason, /höchstens 1/);
  assert.match(detach(D, d, 1).reason, /Werkstätten/);
  toSpare(d, lift(D, d, 1, 0)); toSpare(d, lift(D, d, 1, 1));
  const shelf = lift(D, d, 1, 2); toSpare(d, shelf);
  assert.match(problems(D, d)[0] || '', /Lagerregal/);
  place(D, d, fromSpare(d, shelf.uid), 1, 0);
  assert.match(detach(D, d, 1).reason, /Werkstätten/);
  toSpare(d, lift(D, d, 1, 0));
  // the shelf has things inside: empty it first (in the game: inventory), here directly
  d.grids[shelf.key].items = [];
  assert.ok(detach(D, d, 1).ok);
  assert.ok(attach(D, d, d.rig.spare.containers.indexOf('holzkiste')).ok);
  assert.equal(shift(D, d, 1, -1).ok, false);   // the tractor stays first
  assert.ok(sellContainer(D, d, d.rig.spare.containers.indexOf('wohnanhaenger')).ok);
  assert.ok(applyDraft(D, s, d).ok);
  assert.equal(layout(s), 'van[schlafkoje@0 warroom@1] holzkiste[]');
  assert.equal(budgets(D, s.rig).weight, 250);
});

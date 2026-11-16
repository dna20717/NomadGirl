// Building the rig (game/rig.js): budgets, moving workshops, buying and selling, containers, storage contents move along.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, clockText } from '../game/save.js';
import { add, count } from '../game/inventory.js';
import { budgets, startDraft, lift, place, fits, toSpare, fromSpare, buyWorkshop, sellWorkshop, buyContainer, attach, detach, shift, problems, applyDraft, shop, sellContainer, act, snapshot, restore, stow, attachAt, moveContainer } from '../game/rig.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { classicRig } from './fixture.js';

const D = classicRig((await loadProject(nodeLoader('projects/nomadgirl'))).data);   // fixed setup (fixture.js)
// the tests play with 400 Δ, whatever Wirtschaft › Startgeld says (Daniel tries other values in the workshop)
const fresh = () => { const s = newSave(D); s.hour = 18.5; s.deltas = 400; return s; };
// fills the Camp-Lager (#041) to the brim with junk
const JUNK = Object.keys(D.items).find(id => D.items[id].category === 'junk' && (D.items[id].stack || 1) === 1) || 'schrott';
const fill = s => { let n = 0; while (add(D, s.inv.grids.camp, 'items', JUNK, 1) === 0 && n < 500) n++; return n; };
const stuff = s => s.inv.grids.camp.items.reduce((n, e) => n + e.n, 0);
const layout = s => s.rig.units.map(u => `${u.id}[${u.workshops.map(w => `${w.id}@${w.at}`).join(' ')}]`).join(' ');

test('Budgets: Gewicht gegen Zugkraft, Energie, Container-Zahl', () => {
  const b = budgets(D, fresh().rig);
  assert.deepEqual([b.weight, b.pull, b.heavy, b.length, b.maxLength], [900, 1500, false, 1, 1]);
  assert.deepEqual(b.power, { made: 2, used: 3, net: -1 });   // van 2 ⚡ (Daniel, 13.11.2026: „genug für ein oder zwei Module“), warroom + kochnische + werkbank −1 each
  assert.equal(b.places, 5); assert.equal(b.filled, 5);
  assert.equal(newSave(D).deltas, D.economy.startDeltas);
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

test('Camp-Lager (#041): Regal umstellen ändert nichts am Inhalt; ausbauen nur, solange alles in den Rest passt', () => {
  const s = fresh(), before = stuff(s), cap = s.inv.grids.camp.cap ?? s.inv.grids.camp.w * s.inv.grids.camp.h;
  assert.ok(before > 0);
  assert.equal(cap, 10 * 8 + D.workshops.lagerregal.grid[0] * D.workshops.lagerregal.grid[1], 'Kofferraum + Lagerregal');
  let d = startDraft(D, s);
  const k = lift(D, d, 1, 0), shelf = lift(D, d, 1, 2);
  toSpare(d, k);
  assert.ok(place(D, d, shelf, 1, 0));
  applyDraft(D, s, d);
  assert.equal(stuff(s), before);
  assert.ok(!Object.keys(s.inv.grids).some(k => k.startsWith('store:')), 'kein eigenes Regal-Raster');
  assert.deepEqual(s.rig.spare.workshops, ['kochnische']);
  fill(s);
  d = startDraft(D, s);
  toSpare(d, lift(D, d, 1, 0));
  assert.match(problems(D, d)[0], /Camp-Lager leeren/);
  assert.equal(applyDraft(D, s, d).ok, false);
});

test('Container: Holzkiste kaufen, Van zieht nur einen, abhängen erst leer', () => {
  const s = fresh(), d = startDraft(D, s);
  assert.ok(buyContainer(D, d, 'holzkiste').ok);
  assert.match(attach(D, d, 0).reason, /höchstens 1/);
  assert.match(detach(D, d, 1).reason, /Werkstätten/);
  toSpare(d, lift(D, d, 1, 0)); toSpare(d, lift(D, d, 1, 1));
  const shelf = lift(D, d, 1, 2); toSpare(d, shelf);
  assert.deepEqual(problems(D, d), [], 'das Regal darf raus: alles passt in den Kofferraum (#041)');
  place(D, d, fromSpare(d, shelf.uid), 1, 0);
  assert.match(detach(D, d, 1).reason, /Werkstätten/);
  toSpare(d, lift(D, d, 1, 0));
  assert.ok(detach(D, d, 1).ok);
  assert.ok(attach(D, d, d.rig.spare.containers.indexOf('holzkiste')).ok);
  assert.equal(shift(D, d, 1, -1).ok, false);   // the tractor stays first
  assert.ok(sellContainer(D, d, d.rig.spare.containers.indexOf('wohnanhaenger')).ok);
  assert.ok(applyDraft(D, s, d).ok);
  assert.equal(layout(s), 'van[schlafkoje@0 warroom@1] holzkiste[]');
  assert.equal(budgets(D, s.rig).weight, 250);
});

test('Sofort echt: jede Aktion zählt gleich (act), Fehlschlag ändert nichts', () => {
  const s = fresh();
  let r = act(D, s, d => stow(D, d, lift(D, d, 1, 1)));
  assert.ok(r.ok);
  assert.equal(r.minutes, 30);
  assert.deepEqual(s.rig.spare.workshops, ['werkbank']);
  assert.equal(clockText(s), 'Tag 1 · 19:00');
  fill(s);
  const before = JSON.stringify(s.rig);
  r = act(D, s, d => stow(D, d, lift(D, d, 1, 2)));   // the shelf, with a full Camp-Lager
  assert.equal(r.ok, false);
  assert.match(r.reason, /Camp-Lager leeren/);
  assert.equal(JSON.stringify(s.rig), before);
  r = act(D, s, d => { toSpare(d, lift(D, d, 1, 0)); return sellWorkshop(D, d, d.rig.spare.workshops[1].uid); });
  assert.ok(r.ok);
  assert.equal(r.deltas, 40);
  assert.equal(s.deltas, 440);
});

test('Rückgängig: Schnappschuss bringt Rig, Δ, Uhr und Lager-Inhalt zurück', () => {
  const s = fresh(), snap = snapshot(s), shelf = stuff(s);
  act(D, s, d => { const a = lift(D, d, 1, 2), b = lift(D, d, 1, 0); place(D, d, a, 1, 0); place(D, d, b, 1, 2); });
  act(D, s, d => buyWorkshop(D, d, 'generator'));
  assert.equal(stuff(s), shelf);
  assert.equal(s.deltas, 200);
  restore(s, snap);
  assert.equal(layout(s), 'van[schlafkoje@0 warroom@1] wohnanhaenger[kochnische@0 werkbank@1 lagerregal@2]');
  assert.equal(stuff(s), shelf);
  assert.equal(s.deltas, 400);
  assert.equal(clockText(s), 'Tag 1 · 18:30');
  assert.deepEqual(s.rig.spare.workshops, []);
});

test('Anhänger an eine Kupplung hängen und umsortieren', () => {
  const s = fresh(), D2 = { ...D, tractors: { ...D.tractors, van: { ...D.tractors.van, length: 3 } } };
  s.deltas = 5000;
  act(D2, s, d => buyContainer(D2, d, 'holzkiste'));
  act(D2, s, d => buyContainer(D2, d, 'container_20'));
  assert.ok(act(D2, s, d => attachAt(D2, d, 0, 1)).ok);   // right behind the van
  assert.ok(act(D2, s, d => attachAt(D2, d, 0, 3)).ok);   // at the end
  assert.equal(layout(s), 'van[schlafkoje@0 warroom@1] holzkiste[] wohnanhaenger[kochnische@0 werkbank@1 lagerregal@2] container_20[]');
  const shelf = stuff(s);
  assert.ok(act(D2, s, d => moveContainer(D2, d, 1, 4)).ok);   // holzkiste to the end
  assert.equal(layout(s), 'van[schlafkoje@0 warroom@1] wohnanhaenger[kochnische@0 werkbank@1 lagerregal@2] container_20[] holzkiste[]');
  assert.equal(stuff(s), shelf);   // the Camp-Lager stays as it is (#041)
  assert.equal(act(D2, s, d => moveContainer(D2, d, 2, 3)).ok, false);   // same place
  assert.match(act(D2, s, d => attachAt(D2, d, 0, 1)).reason || '', /Liegt nicht/);
});

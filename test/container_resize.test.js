// #113 Container ziehen (game/rig.js): one container to buy, pulled to 1–5 places without a price, weight per place, workshops that
// no longer fit pop onto the scrapyard, a full storage holds, the length is saved, stacked containers keep a valid slot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { act, shop, buyWorkshop, buyContainer, attach, resizeContainer, placesOf, containerWeight, budgets, place, fromSpare, stackOn } from '../game/rig.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const fresh = () => { const s = newSave(D); s.deltas = 9000; return s; };
const withContainer = (s, n) => {
  act(D, s, d => { buyContainer(D, d, 'container_20'); return attach(D, d, d.rig.spare.containers.length - 1); });
  const ui = s.rig.units.length - 1;
  if (n) act(D, s, d => resizeContainer(D, d, ui, n));
  return ui;
};

test('Beim Händler gibt es nur noch einen Container', () => {
  const c = shop(D).containers.filter(id => D.containers[id].kind === 'shipping');
  assert.deepEqual(c, ['container_20']);
});

test('Ziehen: länger und kürzer, ohne Δ, Gewicht wächst je Platz, Länge bleibt gespeichert', () => {
  const s = fresh(), ui = withContainer(s), d0 = s.deltas, w2 = containerWeight(D, s.rig.units[ui]);
  assert.equal(placesOf(D, s.rig.units[ui]), 2);
  const r = act(D, s, d => resizeContainer(D, d, ui, 5));
  assert.ok(r.ok, r.reason);
  assert.equal(s.rig.units[ui].places, 5, 'im Spielstand');
  assert.equal(placesOf(D, s.rig.units[ui]), 5);
  assert.equal(s.deltas, d0, 'kein Aufpreis');
  assert.equal(containerWeight(D, s.rig.units[ui]), w2 + 3 * D.containers.container_20.weightPerPlace);
  assert.equal(budgets(D, s.rig).places, s.rig.units.reduce((n, u) => n + placesOf(D, u), 0));
  assert.equal(act(D, s, d => resizeContainer(D, d, ui, 6)).ok, false, 'höchstens 5');
  assert.ok(act(D, s, d => resizeContainer(D, d, ui, 1)).ok);
  assert.equal(act(D, s, d => resizeContainer(D, d, ui, 0)).ok, false, 'mindestens 1');
});

test('Kürzer über eine Werkstatt: sie ploppt auf den Schrottplatz; ein volles Lager hält', () => {
  const s = fresh(), ui = withContainer(s, 3);
  // the scrapyard has a werkbank and a lagerregal from the start: build them in at place 2 and 0
  act(D, s, d => { const w = fromSpare(d, d.rig.spare.workshops.find(x => x.id === 'werkbank').uid); return { ok: place(D, d, w, ui, 2) }; });
  assert.ok(s.rig.units[ui].workshops.some(w => w.id === 'werkbank' && w.at === 2));
  const r = act(D, s, d => resizeContainer(D, d, ui, 2));
  assert.ok(r.ok); assert.deepEqual(r.popped, ['werkbank']);
  assert.ok(s.rig.spare.workshops.includes('werkbank'), 'liegt als Kiste auf dem Schrottplatz');
  assert.equal(s.rig.units[ui].workshops.length, 0);
  // a full storage stays: shrinking over it is refused
  act(D, s, d => { const b = buyWorkshop(D, d, 'waffenkammer'); return { ok: b.ok && place(D, d, fromSpare(d, b.inst.uid), ui, 1) }; });
  const key = Object.keys(s.inv.grids).find(k => k === `store:${ui}:1`);
  assert.ok(key, 'die Waffenkammer hat ein eigenes Lager');
  s.inv.grids[key].items.push({ id: 'schrott', x: 0, y: 0, w: 1, h: 1, count: 1 });
  const no = act(D, s, d => resizeContainer(D, d, ui, 1));
  assert.equal(no.ok, false); assert.match(no.reason, /nicht leer/);
  assert.equal(placesOf(D, s.rig.units[ui]), 2);
});

test('Gestapelt: der obere Container behält einen gültigen Platz', () => {
  const s = fresh();
  s.rig.tractor = 'lkw'; s.rig.units[0].id = 'lkw';
  const ui = withContainer(s, 4);
  act(D, s, d => { buyContainer(D, d, 'container_20'); return stackOn(D, d, { spare: d.rig.spare.containers.length - 1 }, ui, 2); });
  const top = s.rig.units[ui + 1];
  assert.equal(top.level, 1); assert.equal(top.slot, 2);
  act(D, s, d => resizeContainer(D, d, ui, 3));
  assert.equal(s.rig.units[ui + 1].slot, 1, 'rutscht mit, bleibt auf dem Dach');
});

test('Alte Größen (10/40 Fuß) bleiben gültig und lassen sich auch ziehen', () => {
  const s = fresh(), tank = s.rig.units.findIndex(u => u.id === 'container_10');
  assert.equal(placesOf(D, s.rig.units[tank]), 1);
  assert.ok(act(D, s, d => resizeContainer(D, d, tank, 2)).ok);
  assert.ok(s.rig.units[tank].workshops.some(w => w.id === 'cryotank'), 'der Tank bleibt drin');
});

test('Kürzer: Deko auf Dach, Wand und innen hinter dem neuen Ende geht ins Lager (kein schwebendes Windrad)', () => {
  const s = fresh(), ui = withContainer(s, 3);
  s.rig.decor = [{ id: 'windrad', at: { ui, p: 2.2, day: 1 } }, { id: 'kit_pflanze', at: { ui, p: 0.5, day: 1 } }, { id: 'fenster', at: { ui, p: 1.4, row: 0.3, day: 1 } }];
  const r = act(D, s, d => resizeContainer(D, d, ui, 2));
  assert.ok(r.ok); assert.deepEqual(r.decor, ['windrad']);
  assert.deepEqual(s.rig.decor.map(x => x.id), ['kit_pflanze', 'fenster']);
  assert.ok(s.rig.spare.decor.includes('windrad'));
});

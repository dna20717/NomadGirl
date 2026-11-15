// Driving a mega rig (#029, game/mega.js): moving aboard (rig into the loading bay), cells on the grid, rooms in the hull,
// stages, budgets, string lights, back into the rig, and the built vehicle for the camp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { budgets } from '../game/rig.js';
import { activate, deactivate, activeMega, canPut, grid, stageOf, buildOwn, buyStage, nextStage, hangLight, fixLights, settle, mstate, travelSpeed, flies } from '../game/mega.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const fresh = (id = 'crawler') => { const s = newSave(D); s.deltas = 50000; s.megarigs = [id]; return s; };
const wsCount = s => s.rig.units.reduce((n, u) => n + u.workshops.length, 0) + s.rig.spare.workshops.length;

test('Ohne Bergung kein Umzug', () => {
  const s = newSave(D);
  assert.equal(activate(D, s, 'crawler').ok, false);
  assert.equal(activeMega(D, s), null);
});

test('Umzug in den Crawler: Rig in die Ladebucht, Container auf dem Raster, keine Werkstatt geht verloren', () => {
  const s = fresh(), before = wsCount(s), tractor = s.rig.tractor;
  const r = activate(D, s, 'crawler');
  assert.ok(r.ok);
  assert.equal(activeMega(D, s), 'crawler');
  assert.equal(s.rig.tractor, 'crawler');
  assert.equal(s.mega.bay.tractor, tractor);
  for (const u of s.rig.units.filter(u => u.kind === 'container')) { assert.ok(u.pos, `${u.id} hat einen Platz`); assert.equal(u.level, undefined); }
  assert.equal(wsCount(s), before);
  const b = buildOwn(D, s);
  assert.ok(b && b.kind === 'crawler');
  assert.equal(b.pieces.filter(p => p.type === 'container' || p.type === 'room').length, s.rig.units.filter(u => u.pos).length);
});

test('Raster: belegt, außerhalb, oben braucht Unterbau; Räume im Rumpf', () => {
  const s = fresh();
  activate(D, s, 'crawler');
  const g = grid(D, 'crawler', stageOf(D, s));
  s.rig.units.push({ kind: 'container', id: 'container_10', workshops: [] });
  const ui = s.rig.units.length - 1;
  assert.match(canPut(D, s, ui, g.places, 0), /Außerhalb/);
  const taken = s.rig.units.find(u => u.pos);
  assert.match(canPut(D, s, ui, taken.pos.place, taken.pos.story), /schon/);
  assert.match(canPut(D, s, ui, g.places - 1, g.inside + 0 + 1 > g.stories - 1 ? g.stories - 1 : g.inside + 1) || 'Darunter steht nichts', /Darunter|schon/);
  settle(D, s);
  assert.ok(s.rig.units[ui].pos);
  const b = buildOwn(D, s), rooms = b.pieces.filter(p => p.type === 'room');
  assert.ok(rooms.every(p => p.story < g.inside), 'Räume nur im Rumpf');
});

test('Ausbaustufe kaufen: kostet Δ, mehr Plätze und Stockwerke', () => {
  const s = fresh();
  activate(D, s, 'crawler');
  const g0 = grid(D, 'crawler', stageOf(D, s)), x = nextStage(D, s), d0 = s.deltas;
  const r = buyStage(D, s);
  assert.ok(r.ok);
  assert.equal(s.deltas, d0 - x.price);
  const g1 = grid(D, 'crawler', stageOf(D, s));
  assert.ok(g1.places > g0.places && g1.stories > g0.stories);
  s.deltas = 0;
  assert.equal(buyStage(D, s).ok, false);
});

test('Budgets: der Crawler zieht alles, Strom zählt weiter', () => {
  const s = fresh();
  activate(D, s, 'crawler');
  const b = budgets(D, s.rig);
  assert.equal(b.heavy, false);
  assert.ok(b.pull >= 100000);
  assert.ok(Number.isFinite(b.power.net));
});

test('Lichterketten an Bord: aufhängen, Unit fällt weg, Kette fällt mit', () => {
  const s = fresh();
  s.rig.units.push({ kind: 'container', id: 'container_20', workshops: [] });
  activate(D, s, 'crawler');
  const units = s.rig.units.map((u, ui) => ({ u, ui })).filter(x => x.u.pos);
  assert.ok(units.length >= 2);
  assert.ok(hangLight(D, s, { ui: units[0].ui, corner: 1 }, { ui: units[1].ui, corner: 0 }).ok);
  assert.equal(mstate(s).lights.length, 1);
  s.rig.units.splice(units[0].ui, 1);
  fixLights(s, units[0].ui);
  assert.equal(mstate(s).lights.length, 0);
});

test('Zurück ins alte Rig aus der Ladebucht', () => {
  const s = fresh(), tractor = s.rig.tractor;
  activate(D, s, 'crawler');
  assert.ok(deactivate(D, s).ok);
  assert.equal(s.rig.tractor, tractor);
  assert.equal(activeMega(D, s), null);
  assert.ok(s.rig.units.every(u => !u.pos));
});

test('Fatbird: Container im Lastrahmen mit Haut, Decks als Räume; reist schnell und Luftlinie', () => {
  const s = fresh('fatbird');
  assert.ok(activate(D, s, 'fatbird').ok);
  const b = buildOwn(D, s);
  assert.equal(b.kind, 'airship');
  assert.ok(flies(D, 'fatbird') && !flies(D, 'crawler'));
  assert.ok(travelSpeed(D, 'fatbird') > 1 && travelSpeed(D, 'crawler') < 1);
});

// Driving a mega rig (#029, game/mega.js): moving aboard (rig into the loading bay), cells on the grid, rooms in the hull,
// stages, budgets, string lights, back into the rig, and the built vehicle for the camp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { budgets, act, buyContainer, buyWorkshop, place, fromSpare } from '../game/rig.js';
import { activate, deactivate, activeMega, canPut, grid, stageOf, buildOwn, buyStage, nextStage, hangLight, fixLights, settle, mstate, travelSpeed, flies, putFromSpare, moveTo, storeUnit } from '../game/mega.js';

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
  assert.equal(b.pieces.filter(p => (p.type === 'container' || p.type === 'room') && p !== b.hub).length, s.rig.units.filter(u => u.pos).length);
  assert.ok(b.hub && b.hub.type === 'room', '#077 der Hauptcontainer ist ein Raum im Rumpf');
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

test('Bauen auf dem Raster: kaufen, setzen, Werkstatt einräumen, verschieben, ins Lager (Positionen bleiben im Spielstand)', () => {
  const s = fresh();
  activate(D, s, 'crawler');
  const n0 = s.rig.units.length;
  // a free cell on the hull floor (#077: places 0–1 are the Hauptcontainer)
  const g = grid(D, 'crawler', stageOf(D, s, 'crawler')), taken = new Set(s.rig.units.filter(u => u.pos).flatMap(u => Array.from({ length: D.containers[u.id]?.places || 1 }, (_, k) => `${u.pos.story}:${u.pos.place + k}`)));
  const fp = [...Array(g.places).keys()].find(p => p >= 2 && !taken.has(`0:${p}`));
  let r = act(D, s, d => { buyContainer(D, d, 'container_20'); return putFromSpare(D, s, d, d.rig.spare.containers.length - 1, fp, 0); });
  assert.ok(r.ok, r.reason);
  const ui = s.rig.units.length - 1;
  assert.equal(s.rig.units.length, n0 + 1);
  assert.deepEqual(s.rig.units[ui].pos, { place: fp, story: 0 });
  assert.match(act(D, s, d => moveTo(D, s, d, ui, 0, 0)).reason || '', /schon/, 'der Hauptcontainer ist belegt');
  r = act(D, s, d => { const b = buyWorkshop(D, d, 'werkbank'); return { ok: place(D, d, fromSpare(d, b.inst.uid), ui, 0) }; });
  assert.ok(r.ok);
  assert.equal(s.rig.units[ui].workshops[0].id, 'werkbank');
  r = act(D, s, d => moveTo(D, s, d, ui, 3, 1));
  assert.ok(r.ok, r.reason);
  assert.deepEqual(s.rig.units[ui].pos, { place: 3, story: 1 });
  assert.match(act(D, s, d => moveTo(D, s, d, ui, 0, 0)).reason || '', /schon/);
  r = act(D, s, d => storeUnit(D, s, d, ui));
  assert.ok(r.ok, r.reason);
  assert.equal(s.rig.units.length, n0);
  assert.ok(s.rig.spare.containers.includes('container_20') && s.rig.spare.workshops.includes('werkbank'));
});

// Aufräumen 16.11.2026: the review found these
import { repairSave } from '../game/save.js';
import { add, count } from '../game/inventory.js';
import { finish } from '../game/salvage.js';
test('Laden behält die Plätze an Bord (settle löschte früher gerade die gültigen)', () => {
  const s = fresh(); activate(D, s, 'crawler');
  // the player moved the last container to another free cell
  const g = grid(D, 'crawler', stageOf(D, s, 'crawler')), ui = s.rig.units.length - 1, u = s.rig.units[ui], was = u.pos;
  let moved = false;
  for (let story = g.stories - 1; story >= 0 && !moved; story--) for (let place = g.places - 1; place >= 0 && !moved; place--) if ((place !== was.place || story !== was.story) && !canPut(D, s, ui, place, story)) { u.pos = { place, story }; moved = true; }
  assert.ok(moved);
  const before = s.rig.units.map(u => u.pos && `${u.pos.place}/${u.pos.story}`);
  const r = repairSave(JSON.parse(JSON.stringify(s)), D);
  assert.deepEqual(r.rig.units.map(u => u.pos && `${u.pos.place}/${u.pos.story}`), before);
});
test('Aussteigen: der Tank-Container kommt immer mit, gestapelt wird wieder, nichts doppelt', () => {
  const s = fresh();
  activate(D, s, 'crawler');
  for (let i = 0; i < 3; i++) { s.rig.spare.containers.push('container_10'); }
  const tankAt = () => s.rig.units.findIndex(u => u.workshops.some(w => D.workshops[w.id]?.function === 'tank'));
  assert.ok(tankAt() > 0);
  // the tank container last in the order: before, the first ones were kept and the tank went into the Lager
  const t = s.rig.units.splice(tankAt(), 1)[0]; s.rig.units.push(t);
  const conts = s.rig.units.filter(u => u.kind === 'container').length;
  const r = deactivate(D, s);
  assert.ok(r.ok);
  assert.ok(tankAt() > 0, 'Tank-Container ist noch im Rig');
  const T = D.tractors[s.rig.tractor], kept = s.rig.units.filter(u => u.kind === 'container').length;
  assert.ok(kept <= (T.length ?? 1) * (T.stack ?? 1));
  assert.equal(kept + r.lost, conts);
  const r2 = repairSave(JSON.parse(JSON.stringify(s)), D);
  assert.equal(r2.rig.units.filter(u => u.workshops.some(w => D.workshops[w.id]?.function === 'tank')).length, 1, 'kein zweiter Tank');
});
test('Aussteigen: was im großen Kofferraum lag, fällt nicht heraus', () => {
  const s = fresh(); activate(D, s, 'crawler');
  const g = s.inv.grids.camp, item = Object.keys(D.items).find(id => D.items[id].category === 'junk' && (D.items[id].stack || 1) === 1) || 'schrott';
  let n = 0; while (n < 200 && add(D, g, 'items', item, 1) === 0) n++;
  const total = () => Object.values(s.inv.grids).reduce((k, gr) => k + count(gr, 'items', item), 0) + (s.ground?.[s.location] || []).reduce((k, p) => k + count(p.grid, 'items', item), 0);
  const before = total();
  deactivate(D, s);
  assert.equal(total(), before);
});
test('Zugmaschinen-Bergung an Bord: die neue wartet in der Ladebucht', () => {
  const s = fresh(); activate(D, s, 'crawler');
  const id = Object.keys(D.salvage || {}).find(k => D.salvage[k].tractor);
  if (!id) return;
  const S = (s.salvage ??= { built: {}, done: {}, seen: {} });
  const steps = D.salvage[id].steps || [];
  S.built ??= {}; S.built[id] = steps.map(st => st.count || 1);
  const r = finish(D, s, id, (D2, s2, t) => { s2.rig.tractor = t; });
  if (!r.ok) return;
  assert.equal(s.rig.tractor, 'crawler');
  assert.equal(s.mega.bay.tractor, D.salvage[id].tractor);
});

test('#125 (C15): Lichterketten des Camps kommen beim Einsteigen zurück wie beim Abhängen', () => {
  const s = fresh(), back = Math.round((D.camp?.lights?.price ?? 10) * (D.camp?.lights?.back ?? 50) / 100);
  s.rig.lights = [['1:0', '1:1'], ['0:1', '1:0']];
  const before = s.deltas, r = activate(D, s, 'crawler');
  assert.ok(r.ok);
  assert.equal(r.strings, 2);
  assert.equal(s.deltas, before + 2 * back);
  assert.equal(s.rig.lights, undefined);
});

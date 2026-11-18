// Antworten mit Voraussetzungen (#059, Daniel 18.11.2026): crew on board, implants and AvA parts, rig parts and workshops open answers on the road.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { generateEncounter } from '../game/road_events.js';
import { blocked, choose } from '../game/travel.js';
import { needsOf, needBlocked } from '../game/needs.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;
const rng = seed => { let x = (seed * 2654435761) % 2147483647 || 1; return () => (x = (x * 16807) % 2147483647) / 2147483647; };
const enc = (save, situation, seed = 0.3) => generateEncounter(D, seed < 1 ? () => seed : rng(seed), { save, situation, danger: 3 });
const opt = (e, id) => e.options.find(o => o.answer === id);

test('Companion an Bord: Schraube flickt den LKW, ohne sie ist die Antwort grau mit Grund', () => {
  const save = newSave(D);
  let o = opt(enc(save, 'panne_fremd'), 'schraube_flickt');
  assert.ok(o && /^Schraube · /.test(o.label) && !blocked(D, save, o));
  const d0 = save.deltas || 0; choose(D, save, o, () => 0.5); assert.ok(save.deltas > d0);
  save.companions = save.companions.filter(c => c !== 'schraube');
  o = opt(enc(save, 'panne_fremd'), 'schraube_flickt');
  assert.ok(o, 'eine verschlossene Tür bleibt als Anreiz sichtbar');
  assert.equal(blocked(D, save, o), 'Braucht Schraube an Bord');
});

test('Implantat und AvA-Teil: Optik erkennt die Falle, Greifarm angelt Teile', () => {
  const save = newSave(D); save.inv.wear ??= {};
  assert.match(needBlocked(D, save, { needWear: 'eyes' }), /Augen-Implantat eingebaut/);
  const eyes = Object.keys(D.items).find(id => D.items[id].wear === 'eyes');
  save.inv.wear.eyes = eyes;
  const o = opt(enc(save, 'hinterhalt'), 'optik_falle');
  assert.ok(o && o.label.startsWith(D.items[eyes].name) && !blocked(D, save, o));
  for (const k of Object.keys(save.inv.wear)) if (save.inv.wear[k] === 'greifarm') save.inv.wear[k] = null;
  assert.ok(needBlocked(D, save, { needItem: 'greifarm' }));
  save.inv.wear.core = 'greifarm';
  assert.equal(needBlocked(D, save, { needItem: 'greifarm' }), null);
});

test('Rig-Teil und Werkstatt: Panzerung rammt, Kochnische kocht für alle, Ripperdoc fehlt', () => {
  const save = newSave(D);
  assert.match(needBlocked(D, save, { needRigSlot: 'armor' }), /Panzerung am Rig/);
  save.rig.parts = { ...(save.rig.parts || {}), armor: ['bleche'] };
  assert.deepEqual(needsOf(D, save, { needRigSlot: 'armor' }).map(n => [n.ok, n.name]), [[true, 'Angeschweißte Bleche']]);
  assert.equal(needBlocked(D, save, { needWorkshop: 'kitchen' }), null, 'Kochnische im Start-Van');
  assert.match(needBlocked(D, save, { needWorkshop: 'cyber' }), /Ripperdoc-Liege im Rig/);
});

test('Jede Lage hat höchstens eine verschlossene Antwort mehr als erlaubt, und immer eine freie', () => {
  const save = newSave(D); save.companions = [];
  const E = D.roadEvents;
  for (const s of (E?.situations || [])) {
    if (s.only) continue;
    const e = enc(save, s.id, 7);
    if (!e) continue;
    assert.ok(E.situations.length > 30); assert.ok(e.options.length <= (E.maxAnswers || 4) + 1, s.id);
    assert.ok(e.options.some(o => !blocked(D, { ...save, deltas: 0, fuel: 99 }, o)), `${s.id}: keine freie Antwort`);
  }
});

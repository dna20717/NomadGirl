// The drive in scene (#053): sky by the hour, configuration with defaults, landscapes per region, weather of a leg.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skyAt, driveConfig, landscapeOf, legWeather, ROADSIDE, RELIEFS } from '../game/road.js';
import { loadProject, validateProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const P = await loadProject(nodeLoader('projects/nomadgirl'));
const D = P.data;

test('Himmel: Sonne am Tag oben, nachts unter dem Horizont, Abend warm, Nacht dunkel', () => {
  const noon = skyAt(36), night = skyAt(2), dusk = skyAt(18.5);
  assert.ok(noon.sun.alt > 0.9 && noon.dark < 0.05);
  assert.ok(night.sun.alt < 0 && night.moon.alt > 0 && night.dark > 0.7);
  assert.ok(dusk.warm > 0.5 && dusk.sun.alt < 0.2);
  assert.ok(skyAt(6.5).sun.x < skyAt(17).sun.x, 'die Sonne wandert von links nach rechts');
});

test('Reisen › Fahrt: Daniels Standard 30 Sekunden je Etappe, Werte begrenzt', () => {
  const C = driveConfig(D);
  assert.equal(C.seconds, 30);
  assert.ok(C.enabled && C.fast > 1 && C.stopAt > 0.3 && C.stopAt < 0.95);
  assert.equal(driveConfig({}).seconds, 30);
  assert.equal(driveConfig({ travel: { drive: { seconds: 1, rigHeight: 200 } } }).seconds, 3);
  assert.equal(driveConfig({ travel: { drive: { rigHeight: 200 } } }).rigHeight, 0.7);
});

test('Landschaften: jede Region der Reisekarte hat eine, sonst die ohne Region', () => {
  const regions = String(D.worldmap.regions).split(',').map(s => s.trim()).filter(Boolean);
  for (const r of regions) assert.ok((D.travel.landscapes || []).some(l => l.region === r), `Landschaft für ${r}`);
  assert.equal(landscapeOf(D, 'Salt Flats').relief, 'flat');
  assert.equal(landscapeOf(D, 'gibt es nicht').region, '');
  for (const l of D.travel.landscapes) assert.ok(RELIEFS.some(([k]) => k === l.relief), l.region);
});

test('Wetter einer Etappe: immer gleich für dieselbe Etappe, Nebel nur morgens', () => {
  assert.deepEqual(legWeather(D, 42, 1, 'East Bend', 7), legWeather(D, 42, 1, 'East Bend', 7));
  for (let s = 1; s < 60; s++) assert.equal(legWeather(D, s, 0, 'East Bend', 15).fog, 0);
  const dusty = Array.from({ length: 200 }, (_, s) => legWeather(D, s, 0, 'Glass Dunes', 12).dust > 0).filter(Boolean).length;
  assert.ok(dusty > 30 && dusty < 120, `Glass Dunes staubig in ~35 % (${dusty}/200)`);
});

test('Encounter: jeder hat etwas am Straßenrand, Figuren sind Gegner mit Bausatz', () => {
  for (const [id, e] of Object.entries(D.encounters)) {
    assert.ok(ROADSIDE.some(([k]) => k && k === e.roadside), `${id} am Straßenrand`);
    for (const f of e.figures?.length ? e.figures : e.enemies || []) assert.ok(D.enemies[f]?.kit, `${id}: ${f} mit Bausatz`);
  }
  assert.equal(validateProject(P).filter(x => x.level === 'error').length, 0);
});

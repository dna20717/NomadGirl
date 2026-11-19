// Wettervorhersage (#087): the navigator rolls the same dice as the drive, so the forecast of a route is the weather of its legs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { forecastRoute, rainOutlook, legSky, forecastConfig } from '../game/weather_fx.js';
import { rainOn } from '../game/rain.js';
import { clockHours } from '../game/tank.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Route: jede Etappe wie legSky der Fahrt (gleicher Seed, Region, Stunden)', () => {
  const save = newSave(D); save.map = { seed: 11 }; save.day = 4; save.hour = 6;
  const legs = [{ to: 'a', hours: 2 }, { to: 'b', hours: 3.5 }, { to: 'c', hours: 1 }], region = { a: '', b: 'Glass Dunes', c: '' };
  const seed = (11 * 31 + 4) | 0;
  const F = forecastRoute(D, save, legs, id => region[id]);
  let h = clockHours(save);
  F.forEach((L, i) => { const sky = legSky(D, save, seed, i, region[legs[i].to], h, h + legs[i].hours); assert.deepEqual(L.kinds, sky.kinds); assert.equal(L.h0, h); h += legs[i].hours; });
});
test('Viele Seeds: es gibt Etappen mit Sandsturm, Nebel und Regen, und klare', () => {
  const seen = new Set();
  for (let s = 1; s < 300; s++) { const save = newSave(D); save.map = { seed: s }; save.day = 2; save.hour = 5;
    for (const L of forecastRoute(D, save, [{ to: 'x', hours: 3 }, { to: 'y', hours: 3 }], () => 'Glass Dunes')) { L.kinds.forEach(k => seen.add(k)); if (!L.kinds.length) seen.add('klar'); } }
  for (const k of ['dust', 'fog', 'wet', 'klar']) assert.ok(seen.has(k), k);
});
test('Regen-Ausblick: die nächsten Tage aus rainOn, Stunden des Tages', () => {
  const save = newSave(D); save.map = { seed: 5 }; save.day = 3;
  const O = rainOutlook(D, save, 5);
  assert.equal(O.length, 5); assert.equal(O[0].day, 3);
  for (const x of O) { const w = rainOn(D, save, x.day); assert.equal(!!x.rain, !!w); if (w) assert.equal(x.rain.from, w.from - x.day * 24); }
  assert.equal(forecastConfig(D).days, 3);
});

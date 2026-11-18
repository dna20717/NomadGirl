// Kleine Fehler (#071): Macken-Wirkung als Feld, Wetter-Gewichte aus der Werkstatt, Welt-Merker an einer Stelle
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { generate } from '../game/glitchlings.js';
import { quirkEffectOf, flawOf } from '../game/workers.js';
import { roadBias, ROAD_BIAS } from '../game/weather_fx.js';
import { worldFlags, setFlag, ok } from '../game/conditions.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('Macken: jede hat eine Wirkung, generierte Entities tragen sie, umbenannte Texte verlieren sie nicht', () => {
  assert.ok(D.glitchlings.quirks.every(q => q.effect));
  for (const g of generate(D, 9, 12)) if (!g.unique) assert.ok(g.quirkEffect, g.name);
  const g = { id: 'x', quirk: 'ganz neuer Text', quirkKind: 'odd', quirkEffect: 'night' };
  assert.equal(quirkEffectOf(D, g), 'night');
  const save = newSave(D); save.hour = 12;
  assert.equal(flawOf(D, save, g).factor, 0);
  assert.equal(quirkEffectOf(D, { quirk: 'hasst den Generator', quirkKind: 'neighbour' }), 'generator', 'alte Entities: nach Text');
});

test('Wetter-Gewichte kommen aus der Werkstatt und gleichen den eingebauten', () => {
  assert.deepEqual(roadBias(D), ROAD_BIAS);
  assert.equal(roadBias({ roadEvents: { weather: [{ kind: 'dust', roadside: 'storm', factor: 9 }] } }).dust.storm, 9);
});

test('Welt-Merker: setzen, löschen, Bedingungen sehen sie', () => {
  const save = newSave(D);
  setFlag(save, 'held'); assert.ok(ok(D, save, { needsFlag: 'held' }));
  setFlag(save, '-held'); assert.ok(!worldFlags(save).includes('held'));
});

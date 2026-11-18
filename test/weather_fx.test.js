// Wetter mit Folgen (#063, Daniel 18.11.2026: „auch machen, aber mit Meldungen“)
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { legSky, runSky, ROAD_BIAS } from '../game/weather_fx.js';
import { rainOn } from '../game/rain.js';
import { generateEncounter } from '../game/road_events.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('Sandsturm: Staubwände werden viel häufiger', () => {
  const save = newSave(D);
  const count = bias => { let n = 0; for (let i = 0; i < 600; i++) { let x = i * 9301 + 49297; const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647; const e = generateEncounter(D, rnd, { save, danger: 3, bias }); if (e?.roadside === 'storm') n++; } return n; };
  const plain = count(null), dusty = count(ROAD_BIAS.dust);
  assert.ok(dusty > plain * 2, `${plain} → ${dusty}`);
});

test('Regen: die Etappe sagt es, der POI hört schlechter; Meldungen haben Text', () => {
  const save = newSave(D);
  let day = 1; while (!rainOn(D, save, day) && day < 200) day++;
  const w = rainOn(D, save, day);
  assert.ok(w, 'ein Regentag');
  save.day = Math.floor(w.from / 24); save.hour = w.from % 24 + 0.1;
  const sky = runSky(D, save, '');
  assert.ok(sky.rain && sky.hear < 1 && /Regen/.test(sky.line));
  const leg = legSky(D, save, 7, 0, '', w.from, w.from + 1);
  assert.ok(leg.wet && leg.kinds.includes('wet') && leg.bias.breakdown > 1 && /Zisterne/.test(leg.line));
});

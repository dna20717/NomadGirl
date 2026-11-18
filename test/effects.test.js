// Effekt-Leiste (#067): everything in force, from wherever it lives
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { activeEffects, effectsKey } from '../game/effects.js';
import { becomeInfluencer } from '../game/brand_perks.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('Buffs, Influencer, Strom-Boost, Frieden und Wetter im Run stehen in einer Liste', () => {
  const save = newSave(D);
  save.buffs = [Object.keys(D.buffs)[0]];
  becomeInfluencer(D, save, 'vulkan');
  save.powerBoost = { until: save.day * 24 + save.hour + 5, extra: 1 };
  const camp = activeEffects(D, save).map(e => e.id);
  assert.ok(camp.includes(`buff:${save.buffs[0]}`) && camp.includes('influencer') && camp.includes('power'));
  const run = activeEffects(D, save, { run: true, sky: { rain: true }, turf: { peace: true, broken: false, gang: 'Rust Guard', friend: true } });
  assert.ok(run.some(e => e.id === 'rain') && run.some(e => e.id === 'turf' && /Waffenstillstand: Rust Guard/.test(e.label)));
  assert.notEqual(effectsKey(camp), effectsKey(run));
});

// Entities in the world (#052, game/glitch_world.js): who lives in a switch or a machine, Leyla's AI-Cores, catching.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foeFor, cores, catchGlitchling, AVA_CORE, glitchState } from '../game/glitch_world.js';
import { generate } from '../game/glitchlings.js';
import { newSave } from '../game/save.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
test('Bewohner: gleicher Ort = gleiche Entity, keine Unikate, Gefangene kommen nicht wieder', () => {
  const s = newSave(D);
  const a = foeFor(D, s, 'tankstelle_km7:3:sw0'), b = foeFor(D, s, 'tankstelle_km7:3:sw0');
  assert.equal(a.name, b.name); assert.ok(!a.unique);
  glitchState(s).caught.push(a.name);
  assert.notEqual(foeFor(D, s, 'tankstelle_km7:3:sw0').name, a.name);
  const many = new Set(Array.from({ length: 30 }, (_, i) => foeFor(D, s, 'x' + i).name)); assert.ok(many.size > 3, 'verschiedene Orte, verschiedene KIs');
});
test('AI-Cores: die Entities im Deck, sonst AvA', () => {
  const s = newSave(D);
  assert.deepEqual(cores(s), [AVA_CORE]);
  s.inv.slots.cyberdeck = 'bastlerdeck'; s.inv.grids.deck = { w: 2, h: 2, items: [{ a: 'items', id: 'glitchling', n: 1, x: 0, y: 0, r: 0, g: generate(D, 1)[0] }] };
  assert.equal(cores(s)[0].name, 'Amber Slay');
});
test('Fangen: ins Deck, wenn ein AI-Core-Platz frei ist, sonst Rucksack, sonst Lager; gemerkt', () => {
  const s = newSave(D), g = generate(D, 2)[5];
  s.inv.grids.deck = { w: 2, h: 2, items: [] };
  assert.equal(catchGlitchling(D, s, g), 'deck');
  assert.equal(s.inv.grids.deck.items[0].g.name, g.name);
  assert.ok(glitchState(s).caught.includes(g.name));
  const g2 = generate(D, 2)[6];
  assert.ok(['backpack', 'camp'].includes(catchGlitchling(D, s, g2)), 'Deck voll: Rucksack oder Lager');
});

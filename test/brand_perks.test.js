// Markentreue und Influencer (#064, Daniel 18.11.2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave, advance } from '../game/save.js';
import { becomeInfluencer, influencer, brandDiscount, brandSets } from '../game/brand_perks.js';
import { generateEncounter } from '../game/road_events.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('Influencer: 20 % auf die Marke für 24 h, dann vorbei', () => {
  const save = newSave(D);
  assert.equal(brandDiscount(D, save, 'delta_petrol'), 1);
  const r = becomeInfluencer(D, save, 'delta_petrol');
  assert.equal(r.discount, 20); assert.equal(r.hours, 24);
  assert.equal(brandDiscount(D, save, 'delta_petrol'), 0.8);
  assert.equal(brandDiscount(D, save, 'nomadcola'), 1);
  advance(save, 25);
  assert.equal(influencer(D, save), null);
});

test('Unterwegs: Sprit bei Delta Petrol billiger, Markenstand verkauft Waren der Influencer-Marke', () => {
  const save = newSave(D), rnd = () => 0.3;
  const full = generateEncounter(D, rnd, { save, situation: 'karawane', danger: 2 }).options.find(o => o.answer === 'tanken');
  becomeInfluencer(D, save, 'delta_petrol');
  const cheap = generateEncounter(D, rnd, { save, situation: 'karawane', danger: 2 }).options.find(o => o.answer === 'tanken');
  assert.ok(cheap.deltas > full.deltas && /Influencer −20 %/.test(cheap.label), `${full.deltas} → ${cheap.deltas}`);
  becomeInfluencer(D, save, 'vulkan');
  const e = generateEncounter(D, rnd, { save, situation: 'markenstand', danger: 2 });
  const wares = e.options.filter(o => o.item);
  assert.ok(wares.length >= 1 && wares.every(o => D.items[o.item].brand === 'vulkan' && o.influencer === 'vulkan'), JSON.stringify(e.options.map(o => o.label)));
  assert.match(e.description, /Vulkan/);
});

test('Markentreue: drei Teile derselben Marke geben ihren Set-Bonus', () => {
  const save = newSave(D), V = Object.keys(D.items).filter(id => D.items[id].brand === 'vulkan' && D.items[id].wear);
  const slots = [...new Set(V.map(id => D.items[id].wear))];
  assert.ok(slots.length >= 3, 'Vulkan hat Teile für drei Plätze');
  save.inv.wear = {};
  for (const sl of slots.slice(0, 2)) save.inv.wear[sl] = V.find(id => D.items[id].wear === sl);
  assert.ok(!brandSets(D, save).stats.defense);
  save.inv.wear[slots[2]] = V.find(id => D.items[id].wear === slots[2]);
  assert.equal(brandSets(D, save).stats.defense, D.brands.vulkan.set.value);
});

// Preise bündeln (#069): one price function, the same numbers the road always showed
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { pay, earn, factors, factorText } from '../game/pricing.js';
import { repPrice } from '../game/reputation.js';
import { becomeInfluencer } from '../game/brand_perks.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('Wie die alte Formel: Ruf × Stimmung × Gefahr, Verdienst umgekehrt', () => {
  const save = newSave(D); save.rep = { 'Rust Guard': 70, 'Neon Rats': -80 };
  for (const gang of [null, 'Rust Guard', 'Neon Rats']) for (const mood of [70, 100, 140]) for (const danger of [1, 3, 5]) for (const base of [-15, -40, -120, 25, 60]) {
    const price = mood / 100 * repPrice(D, save, gang), k = 1 + 0.25 * (danger - 1);
    const old = Math.round(base < 0 ? base * price * k : base * k / price);
    const now = base < 0 ? pay(D, save, base, { gang, mood, danger, scale: 0.25 }) : earn(D, save, base, { gang, mood, danger, scale: 0.25 });
    assert.ok(Math.abs(now - old) <= 1, `${gang} ${mood} ${danger} ${base}: ${old} → ${now}`);
  }
});

test('Influencer wirkt nach dem Runden, nur beim Kaufen, und erklärt sich', () => {
  const save = newSave(D); becomeInfluencer(D, save, 'delta_petrol');
  assert.equal(pay(D, save, -30, { brand: 'delta_petrol', danger: 2, scale: 0.25 }), Math.round(Math.round(-30 * 1.25) * 0.8));
  assert.equal(earn(D, save, 30, { brand: 'delta_petrol' }), 30);
  assert.match(factorText(factors(D, save, { brand: 'delta_petrol', markup: 1.5 })), /Aufschlag ×1,5 · Influencer ×0,8/);
});

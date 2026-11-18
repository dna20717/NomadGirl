// Banter (Daniel, 18.11.2026: „Gib jeder KI einen Charakter und passend dazu einige Zeilen Text, so dass während des Spiels Banter entstehen
// kann“; game/banter.js): every Entity has a character, same name = same character, unique ones their own, Kammerjäger and AvA theirs;
// every character has lines for every moment; after a move the right side speaks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterOf, characters, linesOf, banter, MOMENTS } from '../game/banter.js';
import { generate } from '../game/glitchlings.js';
import { AVA_CORE } from '../game/glitch_world.js';
import { newStack } from '../game/stack_duel.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
test('Jede Entity hat einen Charakter, gleich bleibt gleich, Unikate, Kammerjäger und AvA ihre eigenen', () => {
  const list = generate(D, 9);
  for (const g of list) assert.ok(characterOf(D, g), g.name);
  assert.equal(characterOf(D, list[3]), characterOf(D, { ...list[3] }));
  assert.equal(characterOf(D, list.find(g => g.name === 'Amber Slay')), 'amber_slay');
  assert.equal(characterOf(D, { name: 'Watchdog', hunter: true }), 'kammerjaeger');
  assert.equal(characterOf(D, AVA_CORE), 'ava');
  assert.ok(new Set(generate(D, 4).concat(generate(D, 5)).map(g => characterOf(D, g))).size >= 4, 'verschiedene Charaktere');
});
test('Jeder Charakter hat Sprüche für jeden Moment', () => {
  assert.ok(characters(D).length >= 8);
  for (const c of characters(D)) for (const [m] of MOMENTS) assert.ok(linesOf(D, c.id, m).length >= 1, `${c.id} › ${m}`);
});
test('Nach einem Zug spricht die richtige Seite: Löschen, Feuer, knappe Integrität (einmal)', () => {
  D.glitchlings.banter = { chance: 100 };
  const d = newStack({ name: 'Moss Fang', bits: 2 }, { name: 'Watchdog', hunter: true, bits: 5 });
  let b = banter(D, d, { type: 'place', side: 'player', destroyed: 1 }, () => 0.2);
  assert.equal(b.side, 'player'); assert.equal(b.moment, 'wipe');
  b = banter(D, d, { type: 'place', side: 'player', destroyed: 1 }, () => 0.7);
  assert.equal(b.side, 'enemy'); assert.equal(b.moment, 'wiped'); assert.ok(/[A-Z]{3}/.test(b.text), 'Kammerjäger spricht in Systemmeldungen');
  b = banter(D, d, { type: 'place', side: 'enemy', fire: 4 }, () => 0.3);
  assert.equal(b.side, 'enemy'); assert.equal(b.moment, 'fire');
  d.sides.player.hp = 10;
  b = banter(D, d, { type: 'place', side: 'enemy', fire: 4 }, () => 0.3);
  assert.equal(b.moment, 'low'); assert.equal(b.side, 'player');
  assert.notEqual(banter(D, d, { type: 'place', side: 'enemy', fire: 4 }, () => 0.3)?.moment, 'low', 'knapp nur einmal');
});

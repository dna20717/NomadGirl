// Glitchlings (#047, game/glitchlings.js): the generator of passive companions. Same seed = same set, names from two words and
// never twice (no word twice), unique ones marked „immer“ always there, effect = per bit × bits, weaker in a foreign workbench.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, config, effectOf } from '../game/glitchlings.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Gleicher Seed, gleiche Glitchlings; anderer Seed, andere', () => {
  assert.deepEqual(generate(D, 42), generate(D, 42));
  assert.notDeepEqual(generate(D, 42).map(g => g.name), generate(D, 43).map(g => g.name));
});

test('Namen: zwei Wörter, keins doppelt; Unikate „immer“ sind dabei', () => {
  for (const seed of [1, 2, 3, 99, 1234]) {
    const list = generate(D, seed), words = list.flatMap(g => g.name.split(' '));
    assert.equal(list.length, config(D).count);
    assert.ok(list.every(g => g.name.split(' ').length === 2), seed);
    assert.equal(new Set(list.map(g => g.name.split(' ')[0])).size, list.length, 'erstes Wort einmalig');
    assert.equal(new Set(list.map(g => g.name.split(' ')[1])).size, list.length, 'zweites Wort einmalig');
    for (const u of config(D).unique.filter(u => u.always)) assert.ok(list.some(g => g.name === u.name && g.unique), u.name);
    assert.ok(words.includes('Amber') && words.includes('Slay'), 'Amber Slay (Daniel)');
  }
});

test('Jeder hat Begabung mit Werkbank, Stärke 1–5, Macke, Wunsch, Wohnort; Effekt = je Bit × Bits, fremd schwächer', () => {
  const C = config(D);
  for (const g of generate(D, 7)) {
    assert.ok(g.talent && g.function && g.bits >= 1 && g.bits <= 5 && g.quirk && g.wish && g.home, g.name);
    assert.ok(g.effect.length && !g.effect.includes('{n}'), g.name);
  }
  const t = C.talents[0], own = effectOf(C, t, 3), off = effectOf(C, t, 3, false);
  assert.equal(own.value, t.perBit * 3);
  assert.equal(off.value, Math.round(t.perBit * 3 * C.off / 100 * 10) / 10);
});

test('Macken wiederholen sich in einem Durchgang nicht, solange es genug gibt', () => {
  const list = generate(D, 5).filter(g => !g.unique);
  assert.equal(new Set(list.map(g => g.quirk)).size, list.length);
});

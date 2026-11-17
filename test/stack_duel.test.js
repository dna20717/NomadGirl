// Bit-Stapel (#051, game/stack_duel.js): the Glitchling duel after the Knucklebones principle. Equal bits multiply, the favourite bit
// counts double, a placed bit destroys equal bits opposite, the duel ends when one side is full; the AI beats random play.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colValue, newStack, place, open, choose, play, favourite, total, preview } from '../game/stack_duel.js';

const g = n => [0, 1, 2].map(i => ({ name: `Test ${n}${i}`, bits: 3 }));
const fixed = (...v) => { let i = 0; return () => (v[i++ % v.length] - 1) / 6 + 0.01; };
test('Spaltenwert: gleiche Bits multiplizieren, Lieblingsbit zählt doppelt', () => {
  assert.equal(colValue([4, 4]), 16); assert.equal(colValue([3, 3, 3]), 27); assert.equal(colValue([2, 5]), 7);
  assert.equal(colValue([4, 4], 4), 32); assert.equal(colValue([2, 5], 5), 12);
  assert.ok(favourite({ name: 'Amber Slay' }) >= 1 && favourite({ name: 'Amber Slay' }) <= 6);
});
test('Legen zerstört gleiche Bits drüben; abwechselnd; Ende, wenn eine Seite voll ist', () => {
  const f = fixed(3, 3, 5), d = newStack(g(1), g(2), f);   // first die 3 (player), then 3 (enemy), then 5
  assert.equal(d.die, 3);
  place(d, 0, f); assert.equal(d.turn, 'enemy'); assert.deepEqual(d.sides.player.cols[0], [3]);
  const pv = preview(d, 0); assert.equal(pv.destroyed, 1);
  place(d, 0, f); assert.deepEqual(d.sides.player.cols[0], [], 'die 3 des Gegners löscht Leylas 3'); assert.deepEqual(d.sides.enemy.cols[0], [3]);
  const f2 = fixed(1, 2), e = newStack(g(3), g(4), f2);
  for (let k = 0; k < 40 && !e.winner; k++) place(e, open(e)[0], f2);
  assert.ok(e.winner); assert.ok(e.sides.player.cols.every(c => c.length === 3) || e.sides.enemy.cols.every(c => c.length === 3));
  assert.equal(e.log.at(-1).type, 'end'); assert.equal(e.log.at(-1).score.player, total(e.sides.player));
});
test('Die KI spielt sinnvoll (schlägt Zufall deutlich) und ein Duell dauert rund 15 Züge je Seite', () => {
  let r = 9; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  let won = 0, moves = 0;
  for (let i = 0; i < 400; i++) {
    const d = newStack(g(i), g(i + 500), rnd);
    while (!d.winner) { if (d.turn === 'player') place(d, choose(d, rnd, 0).col, rnd); else { const o = open(d); place(d, o[Math.floor(rnd() * o.length)], rnd); } }
    if (d.winner === 'player') won++; moves += d.moves;
  }
  assert.ok(won > 300, `KI gewinnt nur ${won} von 400`);
  const avg = moves / 400 / 2; assert.ok(avg > 9 && avg < 25, `Züge je Seite ${avg}`);
  assert.ok(play(newStack(g(1), g(2), rnd), rnd).winner);
});

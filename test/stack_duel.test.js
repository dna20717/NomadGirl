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
test('Wertung Summe: Legen zerstört gleiche Bits drüben; abwechselnd; Ende, wenn eine Seite voll ist', () => {
  const f = fixed(3, 3, 5), d = newStack(g(1), g(2), f, 'player', { rules: 'sum' });   // first die 3 (player), then 3 (enemy), then 5
  assert.equal(d.die, 3);
  place(d, 0, f); assert.equal(d.turn, 'enemy'); assert.deepEqual(d.sides.player.cols[0], [3]);
  const pv = preview(d, 0); assert.equal(pv.destroyed, 1);
  place(d, 0, f); assert.deepEqual(d.sides.player.cols[0], [], 'die 3 des Gegners löscht Leylas 3'); assert.deepEqual(d.sides.enemy.cols[0], [3]);
  const f2 = fixed(1, 2), e = newStack(g(3), g(4), f2, 'player', { rules: 'sum' });
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

// Wertung Integrität (Daniel, 17.11.2026: „wer die Lebenspunkte des anderen zuerst reduziert hat“)
import { healOf } from '../game/stack_duel.js';
test('Integrität: gleiche Bits heilen, zerstörte Bits kosten den Gegner ihren Wert, 0 = überschrieben, volle Spalten laufen über', () => {
  const f = fixed(4, 4, 4, 2), d = newStack(g(5), g(6), f, 'player', { rules: 'hp', hp: 25 });
  d.sides.player.fav = [0, 0, 0]; d.sides.enemy.fav = [0, 0, 0];
  place(d, 0, f);                                           // player 4 in col 0
  const ev = place(d, 1, f);                                // enemy 4 in col 1 (nothing opposite)
  assert.equal(ev.damage, 0);
  const ev2 = place(d, 0, f);                               // player 4 on 4: heals 4
  assert.equal(ev2.heal, 4); assert.equal(d.sides.player.hp, 29);
  assert.equal(healOf({ cols: [[3, 3]], fav: [3] }, 0, 3), 12, 'zu zwei gleichen, Lieblingsbit: 3 × 2 × 2');
  const h = newStack(g(7), g(8), fixed(5), 'player', { rules: 'hp', hp: 10 });
  h.sides.enemy.cols[0] = [5, 5]; h.sides.enemy.fav = [0, 0, 0];
  const k = place(h, 0, fixed(5));                          // destroys 5,5 = 20 > 10
  assert.equal(k.damage, 20); assert.equal(h.winner, 'player'); assert.equal(h.sides.enemy.hp, 0);
  const o = newStack(g(9), g(10), fixed(1, 2), 'player', { rules: 'hp' });
  o.sides.enemy.cols = [[6, 6, 5], [6, 5, 5], [5, 6, 6]];
  place(o, 0, fixed(1));
  assert.ok(o.log.some(e => e.type === 'overflow' && e.side === 'enemy')); assert.ok(o.sides.enemy.cols.every(c => !c.length));
  let n = 0; for (let i = 0; i < 300; i++) { const r = play(newStack(g(i), g(i + 3), Math.random, 'player', { rules: 'hp', hp: 25 })); assert.ok(r.winner); n += r.moves; }
  assert.ok(n / 600 > 8 && n / 600 < 20, `Züge je Seite ${n / 600}`);
});

// Wertung Dauerfeuer (Daniel, 17.11.2026: „alle Paare und Trippel jeden Zug Schaden, bis sie zerstört werden; Lieblingsbits Bonus obendrauf“)
import { fireOf } from '../game/stack_duel.js';
test('Dauerfeuer: Paare und Drillinge feuern jeden Zug, Lieblingsbit obendrauf, Zerstören kostet die Augen', () => {
  assert.equal(fireOf({ cols: [[4, 4], [5, 5, 5], [2, 3]], fav: [0, 0, 0] }), 4 + 10);
  assert.equal(fireOf({ cols: [[4, 4], [], []], fav: [4, 0, 0] }), 8, 'Paar aus Lieblingsbits: 4 + 4');
  const d = newStack(g(1), g(2), fixed(3, 6, 3, 1), 'player', { rules: 'dot', hp: 50 });
  d.sides.player.fav = [0, 0, 0]; d.sides.enemy.fav = [0, 0, 0];
  d.sides.player.cols[0] = [3]; d.sides.enemy.cols[1] = [5, 5];
  let ev = place(d, 0, fixed(6));                       // player 3 on 3: pair fires 3
  assert.equal(ev.fire, 3); assert.equal(d.sides.enemy.hp, 47);
  ev = place(d, 2, fixed(5));                           // enemy 6 elsewhere: its 5-5 pair fires 5
  assert.equal(ev.fire, 5); assert.equal(d.sides.player.hp, 45);
  ev = place(d, 1, fixed(1));                           // player 5 into col 1: destroys 5,5 (10 at once), fires 3
  assert.equal(ev.damage, 10); assert.equal(ev.fire, 3); assert.equal(d.sides.enemy.hp, 34); assert.deepEqual(d.sides.enemy.cols[1], []);
  let n = 0; for (let i = 0; i < 300; i++) { const r = play(newStack(g(i), g(i + 3))); assert.ok(r.winner); n += r.moves; }
  assert.ok(n / 600 > 6 && n / 600 < 16, `Züge je Seite ${n / 600}`);
});

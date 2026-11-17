// The Glitchling duel (#050, game/duel.js): the core of OPR Firefight without special rules, as a card game. Taking turns, the three
// actions, dice against Präzision and Abschirmung, Integrität, Selbsttest and Flackern, the AI plays sensibly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../game/glitchlings.js';
import { statsOf, hunterStats, duelConfig, newDuel, options, act, choose, play, standing, fighter } from '../game/duel.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };   // dice: (face - 1) / 6 + a bit
const die = f => (f - 1) / 6 + 0.01;
const mk = (o = {}) => ({ kind: 'glitchling', id: 'x', name: 'X', quality: 4, defense: 4, tough: 3, remote: 1, link: 2, ...o });

test('Werte aus dem Glitchling: Präzision nach Bits, Abschirmung nach Hersteller, Integrität = Bits + 1, Impulse nach Begabung', () => {
  const amber = generate(D, 1).find(g => g.name === 'Amber Slay'), s = statsOf(D, amber);
  assert.equal(s.quality, 4); assert.equal(s.defense, D.glitchlings.duel.defense[D.brands.vulkan.tier]); assert.equal(s.tough, 5);
  assert.deepEqual([s.remote, s.link], [2, 3]);
  assert.ok(duelConfig(D).hunters.length >= 3 && hunterStats(duelConfig(D).hunters[0]).tough > 0);
});
test('Abwechselnd: jede Seite aktiviert einen, dann neue Runde; wer zuletzt begann, gibt ab', () => {
  const d = newDuel([mk(), mk()], [mk()]);
  assert.equal(d.turn, 'player');
  act(d, 'p0', 'calibrate'); assert.equal(d.turn, 'enemy');
  act(d, 'e2', 'calibrate'); assert.equal(d.turn, 'player');
  assert.equal(options(d, 'p0').length, 0, 'schon dran gewesen');
  act(d, 'p1', 'calibrate'); assert.equal(d.round, 2); assert.equal(d.turn, 'enemy');
});
test('Würfel: Treffer bei W6 ≥ Präzision, Abwehr bei W6 ≥ Abschirmung; Verschränken bringt eine Antwort', () => {
  const d = newDuel([mk({ link: 2 })], [mk({ link: 1 })]);
  // attack: 6 and 2 → one hit; save 1 → wound; Selbsttest not yet (1 of 3); answer: 5 → hit, save 3 → wound
  const ev = act(d, 'p0', 'link', 'e1', seq(die(6), die(2), die(1), die(5), die(3)));
  const a = ev.find(e => e.type === 'attack'), b = ev.find(e => e.type === 'answer');
  assert.deepEqual([a.hits, a.wounds, b.hits, b.wounds], [1, 1, 1, 1]);
  assert.equal(fighter(d, 'e1').wounds, 1); assert.equal(fighter(d, 'p0').wounds, 1);
  const d2 = newDuel([mk({ remote: 1 })], [mk()]);
  assert.equal(act(d2, 'p0', 'whisper', 'e1', seq(die(6), die(1))).some(e => e.type === 'answer'), false, 'Einflüstern: keine Antwort');
});
test('Selbsttest bei halber Integrität: misslungen = flackert, kann nur kalibrieren und antwortet nicht', () => {
  const d = newDuel([mk({ remote: 2 }), mk()], [mk({ tough: 4, quality: 4 }), mk()]);
  act(d, 'p0', 'whisper', 'e2', seq(die(6), die(6), die(1), die(1), die(2)));   // 2 wounds of 4, test roll 2 < 4
  const t = fighter(d, 'e2');
  assert.ok(t.flicker);
  assert.deepEqual(options(d, 'e2').map(o => o.action), ['calibrate']);
  act(d, 'e2', 'calibrate'); assert.equal(t.flicker, false);
});
test('Überschrieben bei voller Integrität; Sieg, wenn die andere Seite niemanden mehr hat', () => {
  const d = newDuel([mk({ remote: 3 })], [mk({ tough: 1 })]);
  act(d, 'p0', 'whisper', 'e1', seq(die(6), die(1)));
  assert.ok(fighter(d, 'e1').out); assert.equal(d.winner, 'player'); assert.equal(standing(d, 'enemy').length, 0);
});
test('Die KI spielt sinnvoll: schlägt eine Zufalls-KI deutlich, ein Duell endet immer', () => {
  let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  let ai = 0;
  for (let i = 0; i < 400; i++) {
    const team = generate(D, i + 1).slice(2, 4).map(g => statsOf(D, g)), foe = generate(D, i + 1).slice(4, 6).map(g => statsOf(D, g));
    const d = newDuel(team, foe);
    for (let k = 0; k < 300 && !d.winner; k++) {
      if (d.turn === 'player') { const c = choose(d, rnd, 0); act(d, c.uid, c.action, c.target, rnd); }
      else { const opts = standing(d, 'enemy').filter(f => !f.done).flatMap(f => options(d, f.uid).map(o => ({ uid: f.uid, ...o }))), o = opts[Math.floor(rnd() * opts.length)]; act(d, o.uid, o.action, o.target, rnd); }
    }
    assert.ok(d.winner);
    if (d.winner === 'player') ai++;
  }
  assert.ok(ai > 260, `KI gewinnt nur ${ai} von 400 gegen Zufall`);
  const res = play(newDuel(generate(D, 3).slice(0, 2).map(g => statsOf(D, g)), duelConfig(D).hunters.slice(0, 2).map(hunterStats)), rnd);
  assert.ok(res.winner);
});

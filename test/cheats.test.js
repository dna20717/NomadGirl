// Cheat-Menü (#097): unlocked per device with ?cheats=1, every cheat changes the savegame
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { cheatsOn, CHEATS, runCheat } from '../game/cheats.js';
import { stock } from '../game/crafting.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };

test('Balancing v1 ist Standard: Startgeld 600 Δ', () => { assert.equal(newSave(D).deltas, 600); });
test('Freischalten pro Gerät: ?cheats=1 an, ?cheats=0 aus, sonst gemerkt', () => {
  assert.equal(cheatsOn(''), false); assert.equal(cheatsOn('?cheats=1'), true); assert.equal(cheatsOn(''), true); assert.equal(cheatsOn('?cheats=0'), false);
});
test('Jeder Cheat wirkt auf den Spielstand', () => {
  const save = newSave(D), d0 = save.deltas, t0 = stock(D, save).technik || 0;
  for (const c of CHEATS) assert.ok(runCheat(D, save, c.id));
  assert.equal(save.deltas, d0 + 1000);
  assert.equal((stock(D, save).technik || 0) - t0, 10);
  assert.equal(save.map.revealed.length, save.map.nodes.length);
});

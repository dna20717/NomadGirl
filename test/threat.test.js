// Gefahr wirkt (#014): the danger of a place on the travel map means more and tougher enemies and more loot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { threatOf } from '../game/worldmap.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('Gefahr 1 ändert nichts, jede Stufe darüber bringt mehr Gegner, mehr Leben und Schaden, mehr Beute', () => {
  const a = threatOf(D, 1), b = threatOf(D, 3), T = D.worldmap.threat;
  assert.deepEqual([a.more, a.health, a.damage, a.loot], [0, 1, 1, 0]);
  assert.equal(b.more, 2 * T.enemies / 100);
  assert.equal(b.health, 1 + 2 * T.health / 100);
  assert.equal(b.damage, 1 + 2 * T.damage / 100);
  assert.equal(b.loot, 2 * T.loot);
  assert.ok(threatOf(D, 5).more > b.more);
});

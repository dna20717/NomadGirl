// #142 keepsakes in the cockpit: shown once the achievement counters reach them, announced once per savegame
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { keepsakeList, cockpitFor, newKeepsakes } from '../game/keepsakes.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('every keepsake names a known counter and a picture', () => {
  const L = keepsakeList(D).filter(x => x.counter);
  assert.ok(L.length >= 9, `${L.length} keepsakes`);
  for (const x of L) { assert.ok(D.assets[x.look], x.look); assert.ok(x.note, x.look); }
});

test('the main menu shows only what the counts reached; ?stickers=all shows all', () => {
  const C = D.splash.cockpit, none = cockpitFor(C, {}), some = cockpitFor(C, { pois: 1, kills: 30 });
  assert.ok(!none.clutter.some(c => c.look === 'ck_map'));
  assert.ok(none.clutter.some(c => c.look === 'ck_cactus'), 'pieces without a counter stay');
  assert.equal(none.visor.at, null);
  assert.ok(some.clutter.some(c => c.look === 'ck_map'));
  assert.ok(some.hang.some(h => h.look === 'ck_bottlecap_rosary'));
  assert.equal(cockpitFor(C, {}, true).clutter.length, C.clutter.length);
});

test('a reached keepsake is announced once', () => {
  const save = { achievements: { counts: { trips: 3 } } };
  const a = newKeepsakes(D, save);
  assert.deepEqual(a.map(x => x.look), ['ck_sunglasses']);
  assert.equal(a[0].name, 'Sonnenbrille');
  assert.equal(newKeepsakes(D, save).length, 0);
});

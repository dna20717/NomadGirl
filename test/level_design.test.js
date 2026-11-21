// Level design by the bible (#163): room types, landmark / rest / guide line / Wow per POI, rhythm, fair fights, and the level audit
// (tools/level_audit.mjs) over every POI × 8 seeds without findings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeLoader } from '../tools/loader.js';
import { loadProject } from '../engine/project.js';
import { buildPoi } from '../engine/poi.js';
import { ROOM_TYPES, roomType, calmAfterPeaks, LEVEL, wowOf, sees } from '../engine/level_design.js';
import { auditPoi, SEEDS } from '../tools/level_audit.mjs';

const p = await loadProject(nodeLoader(new URL('../projects/nomadgirl', import.meta.url).pathname));
const D = p.data;

test('alle Räume haben einen Raumtyp, jeder POI Landmarke, Atempause, Leitlinie und genau einen Wow-Raum', () => {
  const types = new Set(ROOM_TYPES.map(([k]) => k));
  for (const [id, r] of Object.entries(D.rooms)) assert.ok(types.has(r.type), `${id}: Raumtyp ${r.type}`);
  for (const [id, P] of Object.entries(D.pois)) {
    for (const f of ['landmark', 'landmarkMotif', 'rest', 'guide', 'guideKind']) assert.ok(P.level?.[f], `${id}: level.${f}`);
    assert.equal(D.rooms[P.level.rest]?.type, 'rest', `${id}: Atempause ${P.level.rest}`);
    const W = wowOf(D, id); assert.ok(W && P.rooms.includes(W.room), `${id}: Wow-Raum`);
    assert.equal(P.rooms.filter(r => D.rooms[r]?.type === 'wow').length, 1, `${id}: genau ein Wow-Raum`);
  }
});

test('Rhythmus: nach einer Spitze Ruhe, nicht vor dem Ausgang', () => {
  const I = [0.3, 0.9, 0.7, 0.9, 1];
  calmAfterPeaks(I, LEVEL);
  assert.deepEqual(I, [0.3, 0.9, 0.3, 0.9, 1]);
  assert.equal(roomType({ tags: ['start'] }), 'threshold'); assert.equal(roomType({ tags: ['loot'] }), 'branch'); assert.equal(roomType({ type: 'wow' }), 'wow');
});

test('Wow-Raum in jedem Seed, Atempause ohne Gegner und mit Kiste', () => {
  for (const poi of Object.keys(D.pois)) for (const seed of SEEDS) {
    const L = buildPoi(D, poi, seed), sym = new Set((L.def.spawns || []).map(s => s.symbol));
    assert.equal(L.rooms.filter(r => r.wow).length, 1, `${poi} #${seed}: Wow-Raum`);
    for (const r of L.rooms.filter(r => r.rest && r.band === 'main')) {
      let chest = false, foe = false;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const c = L.def.layout[y][x]; if (c === 'C') chest = true; if (sym.has(c)) foe = true; }
      assert.ok(chest && !foe, `${poi} #${seed}: Atempause ${r.id} (Kiste ${chest}, Gegner ${foe})`);
    }
  }
});

test('Sichtlinie: Wände halten den Blick auf', () => {
  assert.ok(sees(['.....', '.....', '#####'], [0, 1], [4, 1]));
  assert.ok(!sees(['..#..', '..#..', '#####'], [0, 1], [4, 1]));
});

test('Level-Prüfer: alle POIs × 8 Seeds ohne Befunde', () => {
  const found = Object.keys(D.pois).flatMap(poi => SEEDS.flatMap(s => auditPoi(D, poi, s).map(f => `${poi} #${s} ${f.what} ${f.room || ''}: ${f.text}`)));
  assert.deepEqual(found, []);
});

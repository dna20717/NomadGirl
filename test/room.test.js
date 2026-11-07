// Tests for engine/room.js (room layouts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoom, solidRects } from '../engine/room.js';

const room = { size: [6, 4], layout: ['######', '#.o.a#', '#L=H.#', '######'], spawns: [{ symbol: 'a', enemy: 'schlaeger' }] };

test('parseRoom: start, spawns, ladders, anchors, platforms, solids', () => {
  const r = parseRoom(room);
  assert.deepEqual(r.start, [1, 2]);
  assert.deepEqual(r.spawns, [{ x: 4, y: 1, symbol: 'a', enemy: 'schlaeger' }]);
  assert.deepEqual(r.ladders, [[3, 2]]);
  assert.deepEqual(r.anchors, [[2, 1]]);
  assert.deepEqual(r.platforms, [[2, 2]]);
  assert.equal(r.solid(0, 0), true); assert.equal(r.solid(2, 1), false); assert.equal(r.solid(-1, 1), true);
  assert.deepEqual(r.problems, []);
});

test('parseRoom: problems with widths, unknown symbols, missing start', () => {
  const r = parseRoom({ size: [4, 2], layout: ['####', '#x.'] });
  const texts = r.problems.map(([, t]) => t).join(' | ');
  assert.match(texts, /falscher Breite/); assert.match(texts, /Unbekannte Zeichen.*„x“/); assert.match(texts, /ohne Leylas Start/);
});

test('solidRects: covers every solid tile exactly once', () => {
  const r = parseRoom(room), seen = new Set();
  for (const q of solidRects(r)) for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) {
    assert.equal(r.tiles[y][x], '#'); assert.ok(!seen.has(x + ',' + y)); seen.add(x + ',' + y);
  }
  assert.equal(seen.size, r.tiles.flat().filter(c => c === '#').length);
});

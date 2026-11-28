// CampBuilder v2 (#196): the diorama model (game/campbuilder/model.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { newDiorama, solid, surface, begin, put, end, undo, redo, grow, snapshot, shapeHill, hillTargets, toJSON, fromJSON, metrics, setAt, bottom } from '../game/campbuilder/model.js';

test('a new diorama: flat ground of the base set, the parcel in the middle, ground beyond it', () => {
  const m = newDiorama({ width: 20, depth: 5 }, { base: 'desert' });
  assert.deepEqual(m.parcel, [-10, 9]);
  assert.equal(surface(m, 0), 0);
  assert.equal(setAt(m, 0, 3), 'desert');
  assert.equal(solid(m, 0, -1), false);
  assert.equal(solid(m, 50, 0), true, 'outside the parcel the ground runs on');
  assert.equal(solid(m, 50, -1), false);
  assert.equal(solid(m, 0, 99), true, 'below the bottom: rock');
});

test('paint, undo, redo: one gesture is one step', () => {
  const m = newDiorama({ width: 20 });
  begin(m); put(m, 2, -1, 'ruins'); put(m, 3, -1, 'ruins'); put(m, 3, -1, 'ruins'); const st = end(m);
  assert.equal(st.changes.length, 2);
  assert.equal(setAt(m, 3, -1), 'ruins');
  undo(m);
  assert.equal(solid(m, 3, -1), false);
  redo(m);
  assert.equal(setAt(m, 2, -1), 'ruins');
  begin(m); assert.equal(end(m), null, 'an empty gesture leaves no step');
  assert.equal(m.history.length, 1);
});

test('the last row stays, nothing outside the parcel or above the sky', () => {
  const m = newDiorama({ width: 10, depth: 4, sky: 6 });
  begin(m);
  assert.equal(put(m, 0, bottom(m), null), false);
  assert.equal(put(m, 99, -1, 'desert'), false);
  assert.equal(put(m, 0, -7, 'desert'), false);
  assert.equal(put(m, 0, 2, null), true);
});

test('a hill: the peak rises by its height, the flanks fall off; shaping again goes back to the snapshot', () => {
  const m = newDiorama({ width: 40, rough: 0 }, { seed: 3 });
  const snap = snapshot(m, m.parcel[0], m.parcel[1]), base = new Map();
  begin(m, 'hill');
  shapeHill(m, { cx: 0, height: 5, radius: 6, set: 'desert', seed: 3 }, snap, base);
  assert.equal(surface(m, 0), -5);
  assert.ok(surface(m, 4) > -5 && surface(m, 4) < 0, 'flank');
  assert.equal(surface(m, 8), 0, 'beyond the radius: flat');
  shapeHill(m, { cx: 0, height: 2, radius: 3, set: 'desert', seed: 3 }, snap, base);
  assert.equal(surface(m, 0), -2);
  assert.equal(surface(m, 5), 0, 'the wider flank went back');
  const st = end(m);
  undo(m);
  assert.equal(surface(m, 0), 0);
  assert.ok(st.changes.length > 0);
});

test('a hollow digs, but never through the last row', () => {
  const m = newDiorama({ width: 30, depth: 5, rough: 0 });
  const snap = snapshot(m, m.parcel[0], m.parcel[1]);
  begin(m, 'dig');
  shapeHill(m, { cx: 0, height: -9, radius: 4, set: 'desert', seed: 1 }, snap, new Map());
  end(m);
  assert.equal(surface(m, 0), bottom(m));
  assert.ok(hillTargets(m, { cx: 0, height: 3, radius: 2, set: 'x', seed: 1 }, snap).size > 0);
});

test('the parcel grows near its edges, with flat ground', () => {
  const m = newDiorama({ width: 20, grow: 6, growAt: 3 });
  assert.equal(grow(m, 0), null);
  const g = grow(m, 8);
  assert.deepEqual(g, { side: 1, from: 10, to: 15 });
  assert.deepEqual(m.parcel, [-10, 15]);
  assert.equal(surface(m, 14), 0);
  grow(m, -10);
  assert.equal(m.parcel[0], -16);
});

test('save and load give the same ground; the metric counts', () => {
  const m = newDiorama({ width: 16 }, { seed: 9, base: 'desert' });
  begin(m); put(m, 1, -1, 'ruins'); put(m, 1, -2, 'ruins'); put(m, 2, 0, null); end(m);
  const j = JSON.parse(JSON.stringify(toJSON(m))), n = fromJSON(j, m.cfg);
  assert.deepEqual([...n.cells].sort(), [...m.cells].sort());
  assert.equal(n.seed, 9);
  const M = metrics(m);
  assert.equal(M.sets, 2);
  assert.equal(M.high, 2);
  assert.ok(M.relief >= 4);
  assert.ok(M.stand > 10);
  assert.equal(fromJSON({ v: 2 }), null);
});

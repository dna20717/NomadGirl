// CampBuilder v2 (#196): the diorama model (game/campbuilder/model.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { enclosedSet, frontAt, OPEN, shapeRuin, backAt, newDiorama, solid, surface, begin, put, end, undo, redo, grow, snapshot, shapeHill, hillTargets, toJSON, fromJSON, metrics, setAt, bottom } from '../game/campbuilder/model.js';

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

test('a ruin: pillars, floors, a jagged top, back wall with windows; one step, saved with its back wall', () => {
  const m = newDiorama({ width: 40 }, { seed: 4 });
  const snap = snapshot(m, m.parcel[0], m.parcel[1]), base = new Map();
  begin(m, 'ruin');
  shapeRuin(m, { x0: 0, x1: 7, base: 0, height: 9, set: 'ruins', seed: 4 }, snap, base);
  assert.equal(setAt(m, 0, -1), 'ruins', 'left pillar');
  assert.equal(setAt(m, 7, -1), 'ruins', 'right pillar');
  assert.equal(setAt(m, 3, -1), null, 'inside: air');
  assert.equal(backAt(m, 3, -1), 'ruins', 'inside: back wall');
  let walls = 0, windows = 0;
  for (let x = 1; x < 7; x++) for (let y = -8; y < 0; y++) { if (setAt(m, x, y) == null && backAt(m, x, y) == null && y > -6) windows++; if (setAt(m, x, y)) walls++; }
  assert.ok(windows > 0 && walls > 0, `windows ${windows}, walls ${walls}`);
  shapeRuin(m, { x0: 0, x1: 3, base: 0, height: 4, set: 'ruins', seed: 4 }, snap, base);
  assert.equal(setAt(m, 7, -1), null, 'smaller again: the far pillar is gone');
  const st = end(m);
  assert.ok(st.changes.some(c => c[4] === 1), 'back wall in the step');
  const n = fromJSON(JSON.parse(JSON.stringify(toJSON(m))), m.cfg);
  assert.deepEqual([...n.back].sort(), [...m.back].sort());
  undo(m);
  assert.equal(m.back.size, 0);
  assert.equal(setAt(m, 0, -1), null);
});

test('three layers: foreground and background are their own maps, undone and saved like the stage', () => {
  const m = newDiorama({ width: 20 });
  begin(m); put(m, 2, -2, 'metal', 'f'); put(m, 3, -2, 'ruins', 'b'); put(m, 4, -2, 'desert'); const st = end(m);
  assert.deepEqual(st.changes.map(c => c[4] ?? 0).sort(), [0, 1, 2]);
  assert.equal(frontAt(m, 2, -2), 'metal'); assert.equal(backAt(m, 3, -2), 'ruins'); assert.equal(solid(m, 2, -2), false, 'the foreground does not carry');
  const n = fromJSON(JSON.parse(JSON.stringify(toJSON(m))), m.cfg);
  assert.equal(frontAt(n, 2, -2), 'metal'); assert.equal(backAt(n, 3, -2), 'ruins');
  undo(m); assert.equal(m.front.size + m.back.size, 0);
});

test('automatic background: air shut in on most sides gets a wall of the set around it, open air and windows do not', () => {
  const m = newDiorama({ width: 30 });
  begin(m);
  for (let y = -5; y < 0; y++) { put(m, 0, y, 'ruins'); put(m, 6, y, 'ruins'); }
  for (let x = 0; x <= 6; x++) put(m, x, -5, 'ruins');
  end(m);
  assert.equal(enclosedSet(m, 3, -2), 'ruins');
  assert.equal(enclosedSet(m, 12, -2), null, 'open desert air');
  put(m, 3, -3, OPEN, 'b');
  assert.equal(enclosedSet(m, 3, -3), null, 'a window stays open');
  assert.equal(backAt(m, 3, -3), null);
});

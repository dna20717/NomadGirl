// Reachability without double jump (#145): the movement model of tools/reach_audit.mjs against the limits measured in the browser
import test from 'node:test';
import assert from 'node:assert/strict';
import { reachMap } from '../tools/reach_audit.mjs';

// a lab room: floor row 18, Leyla at column 5, a block of height h from column 30 (or a pit of width w, landing dh higher)
const lab = ({ h = 0, w = 0, dh = 0 }) => {
  const W = 60, H = 24, F = 18;
  const t = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (y >= F || !x || x === W - 1 || !y ? '#' : '.')));
  for (let y = F - h; y < F; y++) for (let x = 30; x < 40; x++) t[y][x] = '#';
  for (let y = F; y < H - 1; y++) for (let x = 30; x < 30 + w; x++) t[y][x] = '.';
  if (w) for (let y = F - dh; y < F; y++) for (let x = 30 + w; x < W - 1; x++) t[y][x] = '#';
  t[F - 1][5] = 'L';
  return t.map(r => r.join(''));
};
const top = (lay, x, y) => reachMap(lay).nodes.has(x + ',' + y);

test('Stufen: bis 4 Kacheln mit Kante greifen, 5 nicht (gemessen 21.11.2026)', () => {
  for (const h of [1, 2, 3, 4]) assert.equal(top(lab({ h }), 32, 17 - h), true, `Stufe ${h}`);
  assert.equal(top(lab({ h: 5 }), 32, 12), false);
});
// the model keeps a margin: measured flat 5 / 2 up 5 / 4 up 4 empty columns with the ledge grab, the model allows one less
test('Lücken: flach 4 leere Spalten, 2 höher 4, 4 höher 3 (eine Spalte Reserve zur Messung), weiter nicht', () => {
  assert.equal(top(lab({ w: 4 }), 35, 17), true);
  assert.equal(top(lab({ w: 6 }), 37, 17), false);
  assert.equal(top(lab({ w: 4, dh: 2 }), 35, 15), true);
  assert.equal(top(lab({ w: 6, dh: 2 }), 37, 15), false);
  assert.equal(top(lab({ w: 3, dh: 4 }), 34, 13), true);
  assert.equal(top(lab({ w: 5, dh: 4 }), 36, 13), false);
});
test('Plattformen direkt übereinander: 4 höher nur mit Leiter', () => {
  const lay = lab({}).map(r => [...r]);
  for (let x = 20; x < 30; x++) lay[13][x] = '=';
  const plain = lay.map(r => r.join(''));
  assert.equal(top(plain, 25, 12), false);
  for (let y = 13; y < 18; y++) lay[y][25] = 'H';
  assert.equal(top(lay.map(r => r.join('')), 25, 12), true);
});
test('Tür bleibt zu, bis ein erreichbarer Schalter sie öffnet', () => {
  const lay = lab({}).map(r => [...r]);
  for (let y = 1; y < 18; y++) lay[y][20] = 'D';
  const shut = lay.map(r => r.join(''));
  assert.equal(top(shut, 25, 17), false);
  lay[17][10] = 'S';
  assert.equal(top(lay.map(r => r.join('')), 25, 17), true);
});

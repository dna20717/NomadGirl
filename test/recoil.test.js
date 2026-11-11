// Slide recoil (game/play/recoil.js): the slide box moves back, the barrel shows at the front, nothing else changes
import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftSlide, slideBox } from '../game/play/recoil.js';

const W = 12, H = 6;
const px = (d, x, y) => Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 4));
function gun() {   // slide rows 1–3 from x 3 to 10 (grey, row 2 dark), grip below at x 3–4
  const d = new Uint8ClampedArray(W * H * 4);
  const set = (x, y, c) => d.set([...c, 255], (y * W + x) * 4);
  for (let y = 1; y <= 3; y++) for (let x = 3; x <= 10; x++) set(x, y, y === 2 ? [20, 20, 30] : [90, 90, 110]);
  for (let y = 4; y <= 5; y++) for (let x = 3; x <= 4; x++) set(x, y, [200, 0, 90]);
  return d;
}

test('Schlitten: Kasten fährt zurück, vorn schaut der Lauf raus', () => {
  const d = gun(), out = shiftSlide(d, W, H, [3, 1, 10, 3], 2, 1);
  assert.equal(px(out, 1, 1)[3], 255, 'slide moved 2 px back');
  assert.equal(px(out, 10, 1)[3], 0, 'top row ends earlier');
  assert.equal(px(out, 10, 3)[3], 0, 'bottom row ends earlier');
  assert.deepEqual(px(out, 10, 2), [20, 20, 30, 255], 'barrel in the middle row, darkest slide colour');
  assert.deepEqual(px(out, 3, 5), px(d, 3, 5), 'grip below the box stays');
});

test('Schlitten: gespiegelte Grafik schiebt nach rechts, ohne Zeile pro Frame alle Frames', () => {
  const d = gun(), out = shiftSlide(d, W, H, [3, 1, 10, 3], 1, -1);
  assert.equal(px(out, 11, 1)[3], 255);
  assert.equal(px(out, 3, 1)[3], 0);
  const a = { slide: [{ frame: 0, from: [3, 1], to: [10, 3] }, { frame: 2, from: [10, 4], to: [4, 2] }] };
  assert.deepEqual(slideBox(a, 0), [3, 1, 10, 3]);
  assert.deepEqual(slideBox(a, 1), [4, 2, 10, 4], 'frame 2 has its own box, corners in any order');
  assert.equal(slideBox({}, 0), null);
});

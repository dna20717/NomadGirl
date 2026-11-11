// Can Leyla get everywhere? A rough movement model over a room layout (Browser + Node), used by the tests for generated POI levels.
// Leyla is 3 tiles tall standing (2.6), 1–2 tiles sliding/crouching. Moves: walk, fall, jump/double jump (up to `up` tiles high,
// `side` tiles wide), climb ladders, slide through 2-high gaps. Doors, fake walls (%) and brittle walls (B, $) count as passable
// (switches open doors, a hit breaks walls); ropes are ignored (extra routes only).
// → { reached: Set('x,y'), can(x, y) — can she stand at or touch this tile }
const SOLID = new Set(['#', 'A', '^', 'v']);
const PLATFORM = new Set(['=']);

export function reach(layout, { up = 5, side = 4, start } = {}) {
  const H = layout.length, W = layout[0].length;
  const at = (x, y) => (y < 0 || y >= H || x < 0 || x >= W ? '#' : layout[y][x]);
  const solid = (x, y) => SOLID.has(at(x, y));
  const free = (x, y) => !solid(x, y);
  const ladder = (x, y) => at(x, y) === 'H';
  const body = (x, y, h = 3) => { for (let k = 0; k < h; k++) if (!free(x, y - k)) return false; return true; };
  // standing at (x, y) = feet tile y is free, the tile below carries (wall, platform, ladder top) or she is on a ladder
  const stands = (x, y) => body(x, y) && (solid(x, y + 1) || PLATFORM.has(at(x, y + 1)) || ladder(x, y + 1) || ladder(x, y));
  const low = (x, y) => body(x, y, 2) && (solid(x, y + 1) || PLATFORM.has(at(x, y + 1)));   // sliding / crawling
  let s = start;
  if (!s) for (let y = 0; y < H && !s; y++) for (let x = 0; x < W; x++) if (at(x, y) === 'L') { s = [x, y]; break; }
  if (!s) return { reached: new Set(), can: () => false };
  const key = (x, y) => x + ',' + y, seen = new Set(), q = [s];
  const fall = (x, y) => { while (y < H - 1 && !stands(x, y) && free(x, y + 1)) y++; return stands(x, y) ? [x, y] : null; };
  const push = p => { if (p && !seen.has(key(...p))) { seen.add(key(...p)); q.push(p); } };
  seen.add(key(...s));
  while (q.length) {
    const [x, y] = q.pop();
    // walk / fall off an edge
    for (const d of [-1, 1]) {
      if (body(x + d, y)) push(fall(x + d, y));
      else if (low(x + d, y)) {   // slide: keep going through the low gap until she can stand again
        let xx = x + d;
        while (low(xx, y) && !body(xx, y)) xx += d;
        if (body(xx, y)) push(fall(xx, y));
      }
    }
    // ladders: up and down
    if (ladder(x, y) || ladder(x, y + 1)) for (const d of [-1, 1]) { let yy = y + d; if (ladder(x, yy) || ladder(x, yy + 1) || ladder(x, yy + 2)) { if (body(x, yy)) push([x, yy]); } }
    if (ladder(x, y + 1) || ladder(x, y)) { let yy = y; while (ladder(x, yy + 1) || ladder(x, yy)) yy--; if (body(x, yy)) push(fall(x, yy)); }
    // drop through a platform
    if (PLATFORM.has(at(x, y + 1)) && body(x, y + 3)) push(fall(x, y + 2));
    // jumps: rise straight up to the apex (head room), then sideways at the apex, then land
    for (let dy = 1; dy <= up; dy++) {
      let ok = true;
      for (let k = 1; k <= dy; k++) if (!free(x, y - k - 2)) { ok = false; break; }   // the head moves up (platforms let her through)
      if (!ok) break;
      for (const d of [-1, 1]) for (let dx = 0; dx <= side; dx++) {
        if (dx && !body(x + d * dx, y - dy)) break;
        push(fall(x + d * dx, y - dy));
      }
    }
  }
  const can = (tx, ty) => { for (let dy = 0; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (seen.has(key(tx + dx, ty + dy))) return true; return false; };
  return { reached: seen, can };
}

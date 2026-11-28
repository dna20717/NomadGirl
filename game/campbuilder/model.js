// CampBuilder v2 (#196): the diorama as data, without DOM or Phaser (Node tests: test/campbuilder.test.js).
// A diorama is a grid of tiles in world coordinates (x to the right, y downwards, y = 0 is the first row of the ground); every
// solid tile names its Kachel-Set. The parcel is the part that can be built on; left and right of it the ground runs on flat
// (drawn, not stored). Building close to an edge makes the parcel grow (Daniel, 28.11.2026: „wachsende Parzelle“).
// Every gesture is one step of the history: undo and redo replay its changes (Zurückspulen).
//   newDiorama(cfg, { base, seed }) · solid(m, x, y) · setAt(m, x, y) · surface(m, x)
//   begin(m) · put(m, x, y, set|null) · end(m) → step · undo(m) · redo(m)
//   hill(m, plan) → changes of a hill or a hollow against the state when the gesture began
//   grow(m, x) · toJSON(m) · fromJSON(json, cfg) · metrics(m)

export const DEFAULTS = { width: 40, grow: 8, growAt: 4, depth: 7, sky: 22, maxWidth: 400, hillMax: 14, hillRadius: 140, hillMinRadius: 2, rough: 18, keep: 1 };
export const cfgOf = c => ({ ...DEFAULTS, ...(c || {}) });
const key = (x, y) => x + ',' + y;
export const unkey = k => k.split(',').map(Number);

// a stable random number per column (the same hill twice looks the same)
export function noise(x, seed = 0) {
  let h = (x * 374761393 + seed * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function newDiorama(cfg0, { base = 'desert', seed = 1, hour = 18.2, name = 'Mein Camp' } = {}) {
  const cfg = cfgOf(cfg0), half = Math.floor(cfg.width / 2);
  const m = { v: 1, name, seed, base, hour, parcel: [-half, cfg.width - half - 1], cells: new Map(), back: new Map(), front: new Map(), cfg, history: [], future: [], step: null, made: Date.now(), seconds: 0 };
  for (let x = m.parcel[0]; x <= m.parcel[1]; x++) fillColumn(m, x);
  return m;
}
const fillColumn = (m, x) => { for (let y = 0; y < m.cfg.depth; y++) m.cells.set(key(x, y), m.base); };

export const top = m => -m.cfg.sky;               // highest row one can build in
export const bottom = m => m.cfg.depth - 1;       // the lowest stored row; below it the rock goes on
export const inParcel = (m, x) => x >= m.parcel[0] && x <= m.parcel[1];
// outside the parcel: flat ground of the base set; below the bottom: rock
export function setAt(m, x, y) {
  if (y > bottom(m)) return m.cells.get(key(x, bottom(m))) ?? m.base;
  if (!inParcel(m, x)) return y >= 0 ? m.base : null;
  return m.cells.get(key(x, y)) ?? null;
}
export const solid = (m, x, y) => setAt(m, x, y) != null;
// three layers (Daniel, 28.11.2026: „Vordergrund (Leyla läuft dahinter lang), Bühne (Leyla läuft dagegen), Hintergrund (Leyla läuft
// davor)“): cells = the stage, back = the background (a ruin's inside, darker), front = the foreground (facades, drawn over Leyla).
// OPEN in the back layer marks a hole that stays open (a window to the sky: no automatic background there).
export const OPEN = '~';
export const LAYERS = { c: 'cells', b: 'back', f: 'front' };
const mapOf = (m, l) => m[LAYERS[l] || 'cells'];
export const backAt = (m, x, y) => { const v = m.back.get(key(x, y)) ?? null; return v === OPEN ? null : v; };
export const backRaw = (m, x, y) => m.back.get(key(x, y)) ?? null;
export const frontAt = (m, x, y) => m.front.get(key(x, y)) ?? null;

// ---------- automatic background (Daniel, 28.11.2026: „wenn Tiles eine Fläche einschließen mehr als x Prozent, erscheint automatisch
// ein Hintergrund passend zu den Tiles“) ----------
// An air tile of the stage is inside when most of eight rays from it hit ground within reach (CampBuilder › Hintergrund); its wall
// is the set the rays hit most. → set | null
const RAYS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
export function enclosedSet(m, x, y, { percent = 75, reach = 10 } = {}) {
  if (solid(m, x, y) || m.back.has(key(x, y))) return null;
  let hits = 0; const count = new Map();
  for (const [dx, dy] of RAYS) {
    for (let i = 1; i <= reach; i++) {
      const X = x + dx * i, Y = y + dy * i;
      if (Y < top(m)) break;
      const v = setAt(m, X, Y);
      if (v) { hits++; count.set(v, (count.get(v) || 0) + (dx && dy ? 1 : 2)); break; }
    }
  }
  if (hits * 100 < percent * RAYS.length) return null;
  let best = null, n = -1; for (const [v, c] of count) if (c > n) { best = v; n = c; }
  return best;
}
// the highest solid row of a column (y), or bottom + 1 when it is dug out completely
export function surface(m, x) {
  for (let y = top(m); y <= bottom(m); y++) if (solid(m, x, y)) return y;
  return bottom(m) + 1;
}

// ---------- history ----------
export function begin(m, kind = 'paint') {
  if (m.step) end(m);
  m.step = { kind, changes: new Map(), at: Date.now() };
  return m.step;
}
// one tile: set it (or empty it with null); out of the parcel it grows first, out of the rows nothing happens.
// → true when something changed
export function put(m, x, y, set, layer = 'c') {
  if (y < top(m) || y > bottom(m)) return false;
  if (!inParcel(m, x)) return false;
  const map = mapOf(m, layer), k = key(x, y), before = map.get(k) ?? null, after = set ?? null;
  if (before === after) return false;
  if (layer === 'c' && y === bottom(m) && after == null && m.cfg.keep > 0) return false;   // the last row stays: the diorama never opens to the void
  if (after == null) map.delete(k); else map.set(k, after);
  const st = m.step || begin(m), sk = layer === 'c' ? k : layer + '|' + k;
  const c = st.changes.get(sk);
  if (c) { c[1] = after; if (c[0] === c[1]) st.changes.delete(sk); } else st.changes.set(sk, [before, after]);
  return true;
}
// close the gesture: an empty step is dropped; a real one goes on the history and clears the redo list
export function end(m) {
  const st = m.step; m.step = null;
  if (!st || !st.changes.size) return null;
  const step = { kind: st.kind, changes: [...st.changes].map(([k, [b, a]]) => k[1] === '|' ? [...unkey(k.slice(2)), b, a, k[0] === 'b' ? 1 : 2] : [...unkey(k), b, a]) };
  m.history.push(step); m.future = [];
  if (m.history.length > 400) m.history.shift();
  return step;
}
function apply(m, step, back) {
  for (const [x, y, b, a, l] of step.changes) { const v = back ? b : a, k = key(x, y), map = l === 1 ? m.back : l === 2 ? m.front : m.cells; if (v == null) map.delete(k); else map.set(k, v); }
  return step;
}
export function undo(m) { if (m.step) end(m); const s = m.history.pop(); if (!s) return null; m.future.push(s); return apply(m, s, true); }
export function redo(m) { const s = m.future.pop(); if (!s) return null; m.history.push(s); return apply(m, s, false); }

// ---------- the parcel grows when one builds close to its edge ----------
// → { side: -1|1, from, to } of the new columns, or null
export function grow(m, x) {
  const C = m.cfg, [x0, x1] = m.parcel, width = x1 - x0 + 1;
  if (width + C.grow > C.maxWidth) return null;
  if (x <= x0 + C.growAt - 1) { const from = x0 - C.grow; for (let i = from; i < x0; i++) fillColumn(m, i); m.parcel = [from, x1]; return { side: -1, from, to: x0 - 1 }; }
  if (x >= x1 - C.growAt + 1) { const to = x1 + C.grow; for (let i = x1 + 1; i <= to; i++) fillColumn(m, i); m.parcel = [x0, to]; return { side: 1, from: x1 + 1, to }; }
  return null;
}

// ---------- hills and hollows ----------
// The ground at the start of the gesture (snapshot) plus a soft bump: the peak column rises (or sinks) by `height` tiles, the
// flanks fall off with a cosine over `radius` tiles, a little roughness per column (seeded) keeps it natural; tiles step whole.
// plan = { cx, height (tiles, < 0 digs), radius, set, seed } → Map key → set|null (the target of every tile the bump touches)
export function snapshot(m, x0, x1) {
  const s = new Map();
  for (let x = x0; x <= x1; x++) s.set(x, surface(m, x));
  return s;
}
export function profile(plan, x, rough = 18) {
  const r = Math.max(0.5, plan.radius), t = Math.abs(x - plan.cx) / (r + 0.5);
  if (t >= 1) return 0;
  const p = Math.pow((1 + Math.cos(Math.PI * t)) / 2, 0.8);   // a little rounder than a cosine: a dome, not a pyramid
  if (x === plan.cx) return Math.abs(plan.height);
  const k = 1 + (rough / 100) * (noise(x, plan.seed) - 0.5) * 2;
  return Math.min(Math.abs(plan.height), Math.max(0, Math.round(Math.abs(plan.height) * p * k)));
}
export function hillTargets(m, plan, snap, rough = m.cfg.rough) {
  const out = new Map(), R = Math.ceil(plan.radius), n = new Map();
  for (let x = plan.cx - R; x <= plan.cx + R; x++) n.set(x, profile(plan, x, rough));
  // never a notch: from the peak outwards a column is at most as high as the one before it (natural, still a little uneven)
  for (let x = plan.cx - 1; x >= plan.cx - R; x--) n.set(x, Math.min(n.get(x), n.get(x + 1)));
  for (let x = plan.cx + 1; x <= plan.cx + R; x++) n.set(x, Math.min(n.get(x), n.get(x - 1)));
  for (let x = plan.cx - R; x <= plan.cx + R; x++) {
    if (!inParcel(m, x)) continue;
    const s = snap.get(x) ?? surface(m, x), k = n.get(x);
    if (!k) continue;
    if (plan.height > 0) for (let i = 1; i <= k; i++) { const y = s - i; if (y >= top(m)) out.set(key(x, y), plan.set); }
    else for (let i = 0; i < k; i++) { const y = s + i; if (y <= bottom(m) - (m.cfg.keep > 0 ? 1 : 0)) out.set(key(x, y), null); }
  }
  return out;
}
// a shape of this moment (a hill, a ruin): tiles the last frame of the gesture set but this one does not go back to their value
// before the gesture (base), the new targets are put. want: Map of „x,y“ (front) or „b|x,y“ (back wall) → set|null;
// base: Map of every key the gesture touched → its value before. → { added: [[x, y, set, back]], removed: [[x, y, set, back]] }
export function reshape(m, want, base) {
  const added = [], removed = [], parse = k => { const l = k[1] === '|' ? k[0] : 'c', kk = l === 'c' ? k : k.slice(2), [x, y] = unkey(kk); return { l, b: l === 'b', x, y, map: mapOf(m, l), kk }; };
  for (const [k, before] of base) {
    if (want.has(k)) continue;
    const p = parse(k), now = p.map.get(p.kk) ?? null;
    if (now !== before && put(m, p.x, p.y, before, p.l)) (before == null ? removed : added).push([p.x, p.y, before ?? now, p.l]);
  }
  for (const [k, v] of want) {
    const p = parse(k);
    if (!base.has(k)) base.set(k, p.map.get(p.kk) ?? null);
    if ((p.map.get(p.kk) ?? null) === v) continue;
    const was = p.map.get(p.kk) ?? null;
    if (put(m, p.x, p.y, v, p.l)) (v == null ? removed : added).push([p.x, p.y, v ?? was, p.l]);
  }
  return { added, removed };
}
export const shapeHill = (m, plan, snap, base) => reshape(m, hillTargets(m, plan, snap), base);

// ---------- ruins ----------
// A broken building out of one set, standing on the ground at the anchor column: pillars at both ends, floors every four rows with
// gaps, a jagged top (one side falls off more), the inside as a darker back wall with window holes to the sky; columns where the
// ground lies lower get a foundation. plan = { x0, x1, base (the ground row: the ruin's lowest row is base − 1), height, set, seed }
export function ruinTargets(m, plan, snap) {
  const out = new Map(), a = Math.min(plan.x0, plan.x1), b = Math.max(plan.x0, plan.x1), w = b - a + 1, H = Math.max(2, plan.height), yb = plan.base, sd = plan.seed || 1;
  if (w < 2) return out;
  const fall = noise(a * 7 + b, sd) < 0.5 ? -1 : 1, rough = Math.min(3, Math.floor(H / 3));
  const topOf = x => {
    const k = (x - a) / Math.max(1, w - 1), side = fall > 0 ? k : 1 - k, pillar = x === a || x === b;
    const drop = Math.round(side * side * H * 0.38 + noise(x, sd + 3) * rough * (pillar ? 0.4 : 1));
    return yb - H + Math.min(H - 2, drop);
  };
  for (let x = a; x <= b; x++) {
    const t = topOf(x), s = snap.get(x) ?? surface(m, x), edge = x === a || x === b;
    for (let y = yb; y < s; y++) out.set(key(x, y), plan.set);   // foundation down to lower ground
    for (let y = t; y < yb; y++) {
      if (y < top(m)) continue;
      const fromBase = yb - y, floor = fromBase % 4 === 0 && fromBase > 0;
      const crumb = y === t && !edge && noise(x * 13 + y, sd + 5) < 0.45;   // the broken top: a brick here and there
      const gap = floor && !edge && noise(Math.floor((x - a) / 2) * 31 + y, sd + 7) > 0.72;
      if (edge || (floor && !gap) || crumb) out.set(key(x, y), plan.set);
      else {
        const band = (fromBase - 1) % 4, col = (x - a) % 3, win = band >= 1 && band <= 2 && col !== 0 && w >= 4 && noise(Math.floor((x - a) / 3) * 17 + Math.floor(fromBase / 4), sd + 9) < 0.7;
        out.set(key(x, y), null);
        out.set('b|' + key(x, y), win ? OPEN : plan.set);   // a window stays open to the sky
      }
    }
  }
  return out;
}
export const shapeRuin = (m, plan, snap, base) => reshape(m, ruinTargets(m, plan, snap), base);

// ---------- save ----------
// compact: the sets used, then one string per row of the parcel (a letter per tile, „.“ = air)
const LET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function toJSON(m) {
  const sets = [...new Set([...m.cells.values(), ...m.back.values(), ...m.front.values()])].sort(), idx = new Map(sets.map((s, i) => [s, LET[i]]));
  const rowsOf = map => { const rows = []; for (let y = top(m); y <= bottom(m); y++) { let r = ''; for (let x = m.parcel[0]; x <= m.parcel[1]; x++) { const v = map.get(key(x, y)); r += v == null ? '.' : idx.get(v); } rows.push(r); } return rows; };
  const rows = rowsOf(m.cells), back = rowsOf(m.back), front = rowsOf(m.front);
  while (rows.length && /^\.*$/.test(rows[0]) && /^\.*$/.test(back[0]) && /^\.*$/.test(front[0])) { rows.shift(); back.shift(); front.shift(); }
  return { v: 1, name: m.name, seed: m.seed, base: m.base, hour: m.hour, parcel: m.parcel, sets, rows, back: m.back.size ? back : undefined, front: m.front.size ? front : undefined, made: m.made, seconds: Math.round(m.seconds), metrics: metrics(m) };
}
export function fromJSON(j, cfg0) {
  if (!j || j.v !== 1 || !Array.isArray(j.parcel) || !Array.isArray(j.rows)) return null;
  const cfg = cfgOf(cfg0), m = newDiorama(cfg, { base: j.base || 'desert', seed: j.seed || 1, hour: j.hour ?? 18.2, name: j.name || 'Mein Camp' });
  m.parcel = [j.parcel[0] | 0, j.parcel[1] | 0]; m.cells = new Map(); m.back = new Map(); m.front = new Map(); m.made = j.made || Date.now(); m.seconds = j.seconds || 0;
  const y0 = bottom(m) - j.rows.length + 1;
  const fill = (rows, map) => (rows || []).forEach((r, i) => { for (let c = 0; c < r.length; c++) { const ch = r[c]; if (ch === '.') continue; const s = j.sets[LET.indexOf(ch)]; if (s) map.set(key(m.parcel[0] + c, y0 + i), s); } });
  fill(j.rows, m.cells); fill(j.back, m.back); fill(j.front, m.front);
  return m;
}

// ---------- the metric for v3 (Daniel, 28.11.2026: „zunächst unsichtbar, aber bau eine Metrik mit“) ----------
// tiles, sets in use, relief (how much the ground goes up and down), the highest point, overhangs, and where Leyla can stand
// (a surface with three tiles of air above: she is 192 px = three tiles tall), plus steps and building time
export function metrics(m) {
  const [x0, x1] = m.parcel, sets = {};
  let relief = 0, high = 0, over = 0, stand = 0, prev = null;
  for (const v of m.cells.values()) sets[v] = (sets[v] || 0) + 1;
  for (let x = x0; x <= x1; x++) {
    const s = surface(m, x);
    high = Math.max(high, -s);
    if (prev != null) relief += Math.abs(s - prev);
    prev = s;
    for (let y = top(m) + 3; y <= bottom(m); y++) {
      if (!solid(m, x, y)) continue;
      if (!solid(m, x, y - 1) && !solid(m, x, y - 2) && !solid(m, x, y - 3)) stand++;
      if (y < bottom(m) && !solid(m, x, y + 1)) over++;
    }
  }
  return { width: x1 - x0 + 1, tiles: m.cells.size, sets: Object.keys(sets).length, use: sets, relief, high, overhangs: over, stand, steps: m.history.length, seconds: Math.round(m.seconds) };
}

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
  const m = { v: 1, name, seed, base, hour, parcel: [-half, cfg.width - half - 1], cells: new Map(), cfg, history: [], future: [], step: null, made: Date.now(), seconds: 0 };
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
export function put(m, x, y, set) {
  if (y < top(m) || y > bottom(m)) return false;
  if (!inParcel(m, x)) return false;
  const k = key(x, y), before = m.cells.get(k) ?? null, after = set ?? null;
  if (before === after) return false;
  if (y === bottom(m) && after == null && m.cfg.keep > 0) return false;   // the last row stays: the diorama never opens to the void
  if (after == null) m.cells.delete(k); else m.cells.set(k, after);
  const st = m.step || begin(m);
  const c = st.changes.get(k);
  if (c) { c[1] = after; if (c[0] === c[1]) st.changes.delete(k); } else st.changes.set(k, [before, after]);
  return true;
}
// close the gesture: an empty step is dropped; a real one goes on the history and clears the redo list
export function end(m) {
  const st = m.step; m.step = null;
  if (!st || !st.changes.size) return null;
  const step = { kind: st.kind, changes: [...st.changes].map(([k, [b, a]]) => [...unkey(k), b, a]) };
  m.history.push(step); m.future = [];
  if (m.history.length > 400) m.history.shift();
  return step;
}
function apply(m, step, back) {
  for (const [x, y, b, a] of step.changes) { const v = back ? b : a, k = key(x, y); if (v == null) m.cells.delete(k); else m.cells.set(k, v); }
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
// the hill of the moment: tiles the last frame of the gesture set but this one does not go back to the snapshot (base), the new
// targets are put. base = Map key → set|null of every tile the gesture touched so far (its value before the gesture)
// → { added: [[x, y, set]], removed: [[x, y, set]] }
export function shapeHill(m, plan, snap, base) {
  const want = hillTargets(m, plan, snap), added = [], removed = [];
  for (const [k, before] of base) if (!want.has(k)) { const [x, y] = unkey(k), now = m.cells.get(k) ?? null; if (now !== before && put(m, x, y, before)) (before == null ? removed : added).push([x, y, before ?? now]); }
  for (const [k, v] of want) {
    if (!base.has(k)) base.set(k, m.cells.get(k) ?? null);
    const [x, y] = unkey(k), now = m.cells.get(k) ?? null;
    if (now === v) continue;
    if (put(m, x, y, v)) (v == null ? removed : added).push([x, y, v ?? now]);
  }
  return { added, removed };
}

// ---------- save ----------
// compact: the sets used, then one string per row of the parcel (a letter per tile, „.“ = air)
const LET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function toJSON(m) {
  const sets = [...new Set(m.cells.values())].sort(), idx = new Map(sets.map((s, i) => [s, LET[i]]));
  const rows = [];
  for (let y = top(m); y <= bottom(m); y++) { let r = ''; for (let x = m.parcel[0]; x <= m.parcel[1]; x++) { const v = m.cells.get(key(x, y)); r += v == null ? '.' : idx.get(v); } rows.push(r); }
  while (rows.length && /^\.*$/.test(rows[0])) rows.shift();
  return { v: 1, name: m.name, seed: m.seed, base: m.base, hour: m.hour, parcel: m.parcel, sets, rows, made: m.made, seconds: Math.round(m.seconds), metrics: metrics(m) };
}
export function fromJSON(j, cfg0) {
  if (!j || j.v !== 1 || !Array.isArray(j.parcel) || !Array.isArray(j.rows)) return null;
  const cfg = cfgOf(cfg0), m = newDiorama(cfg, { base: j.base || 'desert', seed: j.seed || 1, hour: j.hour ?? 18.2, name: j.name || 'Mein Camp' });
  m.parcel = [j.parcel[0] | 0, j.parcel[1] | 0]; m.cells = new Map(); m.made = j.made || Date.now(); m.seconds = j.seconds || 0;
  const y0 = bottom(m) - j.rows.length + 1;
  j.rows.forEach((r, i) => { for (let c = 0; c < r.length; c++) { const ch = r[c]; if (ch === '.') continue; const s = j.sets[LET.indexOf(ch)]; if (s) m.cells.set(key(m.parcel[0] + c, y0 + i), s); } });
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

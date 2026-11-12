// Inventories in the Diablo/Tetris style: grids where things take up cells by their shape, can be turned and stack.
// Pure logic (browser and Node, no DOM): the backpack, the chest in the camp, storage places in the rig and the ground in a run
// are all the same kind of grid. The interface is game/play/inventory_ui.js.
//
// grid  = { w, h, items: [entry] }
// entry = { a, id, n, x, y, r }   a = area of the thing ('items' | 'weapons' | 'backpacks'), n = count, x/y = top left cell, r = quarter turns (0–3)
// Shapes: items may have a "shape" (rows of text, # = taken, . = free), otherwise a full rectangle of "size" [w, h].
// Weapons use their "size", backpacks their "bag" footprint (default 2 × 3).

export const AREAS_WITH_THINGS = ['items', 'weapons', 'backpacks'];

export function thing(D, a, id) { return D[a]?.[id] || null; }

// the cells of a thing (unturned): list of [x, y]
export function baseCells(D, a, id) {
  const t = thing(D, a, id) || {};
  if (a === 'items' && Array.isArray(t.shape) && t.shape.length) {
    const cells = [];
    t.shape.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.' && c !== ' ') cells.push([x, y]); }));
    if (cells.length) return cells;
  }
  const [w, h] = (a === 'backpacks' ? t.bag : t.size) || (a === 'backpacks' ? [2, 3] : [1, 1]);
  const cells = [];
  for (let y = 0; y < Math.max(1, h); y++) for (let x = 0; x < Math.max(1, w); x++) cells.push([x, y]);
  return cells;
}

// turned a quarter clockwise r times, moved back to 0/0
export function cellsOf(D, a, id, r = 0) {
  let cells = baseCells(D, a, id);
  for (let i = 0; i < ((r % 4) + 4) % 4; i++) cells = cells.map(([x, y]) => [-y, x]);
  const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my]);
}
export function boxOf(D, e) {
  const c = cellsOf(D, e.a, e.id, e.r || 0);
  return { w: Math.max(...c.map(p => p[0])) + 1, h: Math.max(...c.map(p => p[1])) + 1 };
}
export const stackMax = (D, a, id) => a === 'items' ? Math.max(1, thing(D, a, id)?.stack || 1) : 1;
export const canTurn = (D, a, id) => { const c = baseCells(D, a, id); const b = cellsOf(D, a, id, 1); return JSON.stringify(c.sort()) !== JSON.stringify(b.sort()); };

export function newGrid(w, h) { return { w: Math.max(1, w | 0), h: Math.max(1, h | 0), items: [] }; }

// which entry occupies each cell: Map "x,y" → entry
export function occupancy(D, grid, skip = null) {
  const m = new Map();
  for (const e of grid.items) if (e !== skip) for (const [cx, cy] of cellsOf(D, e.a, e.id, e.r)) m.set(`${e.x + cx},${e.y + cy}`, e);
  return m;
}
// can `e` (a, id, r) sit at x/y? skip = an entry ignored (the one being moved)
export function fits(D, grid, e, x, y, skip = null) {
  const occ = occupancy(D, grid, skip);
  return cellsOf(D, e.a, e.id, e.r || 0).every(([cx, cy]) => {
    const px = x + cx, py = y + cy;
    return px >= 0 && py >= 0 && px < grid.w && py < grid.h && !occ.has(`${px},${py}`);
  });
}
// what lies under a shape placed at x/y (to swap or stack onto)
export function under(D, grid, e, x, y, skip = null) {
  const occ = occupancy(D, grid, skip), found = new Set();
  for (const [cx, cy] of cellsOf(D, e.a, e.id, e.r || 0)) { const o = occ.get(`${x + cx},${y + cy}`); if (o) found.add(o); }
  return [...found];
}
export function at(D, grid, x, y) { return occupancy(D, grid).get(`${x},${y}`) || null; }

// first free spot, trying every turn; → { x, y, r } or null
export function findSpot(D, grid, a, id, turns = [0, 1, 2, 3]) {
  for (const r of turns) for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (fits(D, grid, { a, id, r }, x, y)) return { x, y, r };
  return null;
}

// add n of a thing: first onto existing stacks, then into free spots. Returns how many did NOT fit.
export function add(D, grid, a, id, n = 1, { stackOnly = false } = {}) {
  const max = stackMax(D, a, id);
  for (const e of grid.items) {
    if (!n) break;
    if (e.a === a && e.id === id && e.n < max) { const k = Math.min(n, max - e.n); e.n += k; n -= k; }
  }
  while (n > 0 && !stackOnly) {
    const spot = findSpot(D, grid, a, id);
    if (!spot) break;
    const k = Math.min(n, max);
    grid.items.push({ a, id, n: k, ...spot });
    n -= k;
  }
  return n;
}
export function remove(grid, e) { const i = grid.items.indexOf(e); if (i >= 0) grid.items.splice(i, 1); return e; }
export function count(grid, a, id) { return grid.items.filter(e => e.a === a && e.id === id).reduce((s, e) => s + e.n, 0); }

// put an entry (taken out of somewhere) at x/y: free → placed; same thing with room → stacked onto it;
// one other thing in the way → swapped (the other one comes back as "held"). → { ok, held }
export function drop(D, grid, e, x, y) {
  const hit = under(D, grid, e, x, y);
  const inside = cellsOf(D, e.a, e.id, e.r || 0).every(([cx, cy]) => x + cx >= 0 && y + cy >= 0 && x + cx < grid.w && y + cy < grid.h);
  if (!inside) return { ok: false, held: e };
  if (!hit.length) { grid.items.push(Object.assign(e, { x, y })); return { ok: true, held: null }; }
  if (hit.length === 1) {
    const o = hit[0], max = stackMax(D, e.a, e.id);
    if (o.a === e.a && o.id === e.id && max > 1) {
      const k = Math.min(e.n, max - o.n);
      if (k <= 0) return { ok: false, held: e };
      o.n += k; e.n -= k;
      return { ok: true, held: e.n > 0 ? e : null };
    }
    if (fits(D, grid, e, x, y, o)) { remove(grid, o); grid.items.push(Object.assign(e, { x, y })); return { ok: true, held: o }; }
  }
  return { ok: false, held: e };
}

// move everything from one grid into another where it fits ("Alles einlagern"); → number of things moved
export function moveAll(D, from, to) {
  let moved = 0;
  for (const e of [...from.items].sort((p, q) => cellsOf(D, q.a, q.id).length - cellsOf(D, p.a, p.id).length)) {
    const left = add(D, to, e.a, e.id, e.n);
    if (left < e.n) moved++;
    if (left === 0) remove(from, e); else e.n = left;
  }
  return moved;
}

// roll a loot table → [{ a: 'items', id, n }]
export function rollLoot(D, tableId, rnd = Math.random) {
  const T = D.lootTables?.[tableId];
  if (!T?.entries?.length) return [];
  const [r0, r1] = T.rolls || [1, 1], rolls = r0 + Math.floor(rnd() * (r1 - r0 + 1)), total = T.entries.reduce((s, e) => s + (e.weight || 0), 0), out = [];
  for (let i = 0; i < rolls && total > 0; i++) {
    let k = rnd() * total;
    const e = T.entries.find(x => (k -= x.weight || 0) < 0) || T.entries[0];
    // an entry is a thing (Gegenstand) or a weapon (Waffe, #004: raider weapons can lie in the loot)
    const a = e.weapon && D.weapons?.[e.weapon] ? 'weapons' : 'items', id = a === 'weapons' ? e.weapon : e.item;
    if (!D[a]?.[id]) continue;
    const n = a === 'weapons' ? 1 : (e.min ?? 1) + Math.floor(rnd() * ((e.max ?? e.min ?? 1) - (e.min ?? 1) + 1));
    const same = a === 'items' && out.find(o => o.a === 'items' && o.id === id);
    if (same) same.n += n; else out.push({ a, id, n });
  }
  return out;
}

// value of a grid in Δ (shown in the interface)
// would the grid's contents survive a new size w × h (nothing lost)? (the Dachbox comes off, the Kofferraum shrinks)
export function canResize(D, grid, w, h) {
  const g = newGrid(w, h), total = grid.items.reduce((n, e) => n + e.n, 0);
  let kept = 0;
  for (const e of grid.items) if (fits(D, g, e, e.x, e.y)) { g.items.push({ ...e }); kept += e.n; }
  for (const e of grid.items) if (!g.items.some(x => x.x === e.x && x.y === e.y && x.id === e.id)) kept += e.n - add(D, g, e.a, e.id, e.n);
  return kept === total;
}
export function worth(D, grid) { return grid.items.reduce((s, e) => s + (thing(D, e.a, e.id)?.value || 0) * e.n, 0); }

// ---------- worn things (Daniel, 10.11.2026: Inventar im Diablo-Stil) ----------
// inv.wear = { head, armor, eyes, nerves, arm, heart, legs, skin, bow, tail, core, module } → item id or null.
// Items say where they go with "wear" (Gegenstände › Ausrüstung) and add their "stats" ({ defense, health, damage, speed }) while worn.
export const LEYLA_WEAR = ['head', 'armor'];
export const IMPLANTS = ['eyes', 'nerves', 'arm', 'heart', 'legs', 'skin'];
export const DRONE_WEAR = ['bow', 'tail', 'core', 'module'];
export const WEAR_KEYS = [...LEYLA_WEAR, ...IMPLANTS, ...DRONE_WEAR];
export const wearOf = (D, id) => D.items?.[id]?.wear || null;
// the worn things at the start (Leyla › Start-Ausrüstung › Angelegt), one per place
export function startWear(D) {
  const w = Object.fromEntries(WEAR_KEYS.map(k => [k, null]));
  for (const id of D.leyla?.loadout?.wear || []) { const k = wearOf(D, id); if (k && WEAR_KEYS.includes(k) && !w[k]) w[k] = id; }
  return w;
}
// what everything worn adds up to; strain = load of the implants
export function gearStats(D, wear = {}) {
  const s = { defense: 0, health: 0, damage: 0, speed: 0, strain: 0 };
  for (const [k, id] of Object.entries(wear)) {
    const t = id && D.items?.[id];
    if (!t || t.wear !== k) continue;
    for (const st of ['defense', 'health', 'damage', 'speed']) s[st] += t.stats?.[st] || 0;
    if (IMPLANTS.includes(k)) s.strain += t.strain || 0;
  }
  return s;
}
// one number to compare two things for the same place (AvA cheers or worries)
export const gearScore = st => (st?.defense || 0) + (st?.health || 0) * 0.4 + (st?.damage || 0) + (st?.speed || 0);

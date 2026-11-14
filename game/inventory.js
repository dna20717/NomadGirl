// Inventories in the Diablo style: grids where things take up a rectangle of cells, can be turned and stack.
// Pure logic (browser and Node, no DOM): the backpack, the chest in the camp, storage places in the rig and the ground in a run
// are all the same kind of grid. The interface is game/play/inventory_ui.js.
//
// grid  = { w, h, items: [entry] }
// entry = { a, id, n, x, y, r, q?, mods? }   a = area of the thing ('items' | 'weapons' | 'backpacks'), n = count, x/y = top left cell, r = quarter turns (0–3)
//         q = quality of a dish or thing (#013: 1 gut, 2 perfekt; only the same quality stacks), mods = values of one weapon copy (#013)
// Rectangles only (Daniel, 14.11.2026: „Lass uns mit dem Tetris-Quatsch aufhören und auf Rechtecke beschränken“): items and weapons
// take their "size" [w, h], backpacks their "bag" footprint (default 2 × 3). Older savegames are tidied by untangle().

export const AREAS_WITH_THINGS = ['items', 'weapons', 'backpacks'];

export function thing(D, a, id) { return D[a]?.[id] || null; }

// the cells of a thing (unturned): list of [x, y], always its whole rectangle
export function baseCells(D, a, id) {
  const t = thing(D, a, id) || {};
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

// a grid whose things overlap or stick out (older savegames: Tetris shapes nested into each other became full rectangles, 14.11.2026):
// keeps whatever fits where it lies, moves the rest to a free spot in the same grid (any turn); → the entries that found no room
export function untangle(D, grid) {
  const all = grid.items, out = [];
  grid.items = [];
  const later = [];
  for (const e of all) if (fits(D, grid, e, e.x, e.y)) grid.items.push(e); else later.push(e);
  for (const e of later) {
    const spot = findSpot(D, grid, e.a, e.id, [e.r || 0, ...[0, 1, 2, 3].filter(r => r !== (e.r || 0))]);
    if (spot) grid.items.push(Object.assign(e, spot)); else out.push(e);
  }
  return out;
}

// add n of a thing: first onto existing stacks, then into free spots. Returns how many did NOT fit.
// q / mods (#013): only the same quality stacks; a weapon with its own values keeps them
export const sameKind = (e, a, id, q = 0) => e.a === a && e.id === id && (e.q || 0) === (q || 0);
export function add(D, grid, a, id, n = 1, { stackOnly = false, q = 0, mods = null } = {}) {
  const max = stackMax(D, a, id);
  for (const e of grid.items) {
    if (!n) break;
    if (sameKind(e, a, id, q) && e.n < max && !mods) { const k = Math.min(n, max - e.n); e.n += k; n -= k; }
  }
  while (n > 0 && !stackOnly) {
    const spot = findSpot(D, grid, a, id);
    if (!spot) break;
    const k = Math.min(n, max);
    grid.items.push({ a, id, n: k, ...spot, ...(q ? { q } : {}), ...(mods ? { mods: { ...mods } } : {}) });
    n -= k;
  }
  return n;
}
// an entry taken out of somewhere back into a grid, with its quality and values; → how many did NOT fit
export const addEntry = (D, grid, e, n = e.n, opts = {}) => add(D, grid, e.a, e.id, n, { ...opts, q: e.q || 0, mods: e.mods || null });
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
    if (sameKind(o, e.a, e.id, e.q) && max > 1 && !e.mods && !o.mods) {
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
    const left = addEntry(D, to, e);
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
  for (const e of grid.items) if (!g.items.some(x => x.x === e.x && x.y === e.y && x.id === e.id)) kept += e.n - addEntry(D, g, e);
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
// what worn things can change (Gegenstände › Ausrüstung); key, name, unit, good when (+1 higher, -1 lower), weight for comparing
// Cyberware (#006, Daniel, 13.11.2026): implants unlock the double jump and the air dash and may carry a flaw (negative value)
export const GEAR_STATS = [
  ['defense', 'Abwehr', '%', 1, 1], ['health', 'Leben', ' LP', 1, 0.4], ['damage', 'Schaden', '%', 1, 1], ['melee', 'Nahkampf', '%', 1, 0.7], ['ranged', 'Fernkampf', '%', 1, 0.7],
  ['crit', 'Krit-Chance', '%', 1, 1], ['speed', 'Tempo', '%', 1, 1], ['jump', 'Sprungkraft', '%', 1, 0.6], ['dashCooldown', 'Dash-Abklingzeit', '%', -1, 0.4],
  ['airJumps', 'Sprünge in der Luft', '', 1, 15], ['airDash', 'Luft-Dash', '', 1, 12], ['regen', 'Heilt sich', ' LP/10 s', 1, 4], ['heal', 'Heilung', '%', 1, 0.3],
  ['droneBattery', 'AvA-Akku', '%', 1, 0.3], ['tankDecay', 'Tank-Verfall', '%', -1, 0.5],
];
export const GEAR_KEYS = GEAR_STATS.map(s => s[0]);
// one line per value: '+12 % Fernkampf', 'Luft-Dash'; good = helps Leyla (green), bad = flaw (red)
export function statParts(st = {}) {
  return GEAR_STATS.filter(([k]) => st[k]).map(([k, name, unit, dir]) => {
    const v = st[k], good = v * dir > 0;
    const text = k === 'airDash' ? (v > 0 ? 'Luft-Dash' : 'kein Luft-Dash') : k === 'airJumps' ? (v > 0 ? `+${v} ${v === 1 ? 'Sprung' : 'Sprünge'} in der Luft` : `${v} Sprung in der Luft`)
      : `${v > 0 ? '+' : ''}${v}${unit === '%' ? ' %' : unit} ${name}`;
    return { key: k, text, good };
  });
}
// what everything worn adds up to; strain = load of the implants
// boost (#013, Ripperdoc): { implant id: % } a clean operation makes the good sides of an implant stronger, never its flaws
export function gearStats(D, wear = {}, boost = null) {
  const s = { strain: 0 }, dir = Object.fromEntries(GEAR_STATS.map(x => [x[0], x[3] || 1]));
  for (const k of GEAR_KEYS) s[k] = 0;
  for (const [k, id] of Object.entries(wear)) {
    const t = id && D.items?.[id];
    if (!t || t.wear !== k) continue;
    const f = 1 + (IMPLANTS.includes(k) ? boost?.[id] || 0 : 0) / 100;
    for (const st of GEAR_KEYS) { const v = t.stats?.[st] || 0; s[st] += v * (dir[st] ?? 1) > 0 && st !== 'airJumps' && st !== 'airDash' ? Math.round(v * f * 10) / 10 : v; }
    if (IMPLANTS.includes(k)) s.strain += t.strain || 0;
  }
  return s;
}
// one number to compare two things for the same place (AvA cheers or worries)
export const gearScore = st => GEAR_STATS.reduce((n, [k, , , dir, w]) => n + (st?.[k] || 0) * dir * w, 0);

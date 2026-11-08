// Savegame: everything that lasts between runs (clock, place, rig, Δ, health, buffs, run in progress).
// Online (Cloudflare worker) one savegame per login in KV (/api/save), the same on every device;
// without the worker (local, tests) in this browser (localStorage). Shape:
//   { version, day, hour, location, fuel, food, deltas, health, buffs: [id], rig: { tractor, units: [{ kind, id, workshops: [{ id, at }] }] },
//     companions: [id], recipes: [id] (recipe book), run: null | { poi, room, location }, log: [text],
//     inv: { backpack: id, slots: { melee, ranged, cyberdeck }, grids: { backpack, chest, 'store:<unit>:<place>': grid } } }   (grids: game/inventory.js)
// Times are hours (18.5 = 18:30). "Ereignis-Zeit": the clock only moves on actions (sleeping, runs, sitting at the fire).

import { newGrid, add, fits } from './inventory.js';

const LOCAL_KEY = 'nomadgirl-save';
export const SAVE_VERSION = 1;

// rig layout from a tractor, containers and workshops: the tractor's own places first, then the containers in order
export function placeWorkshops(D, tractor, containers, workshops) {
  const units = [{ kind: 'tractor', id: tractor, workshops: [] }, ...containers.map(id => ({ kind: 'container', id, workshops: [] }))];
  const cap = u => (u.kind === 'tractor' ? D.tractors?.[u.id]?.places : D.containers?.[u.id]?.places) || 0;
  const free = u => { const used = new Set(); for (const w of u.workshops) for (let i = 0; i < (D.workshops?.[w.id]?.places || 1); i++) used.add(w.at + i); return used; };
  const left = [];
  for (const id of workshops) {
    const need = D.workshops?.[id]?.places || 1;
    let done = false;
    for (const u of units) {
      const used = free(u);
      for (let at = 0; at + need <= cap(u) && !done; at++)
        if ([...Array(need).keys()].every(i => !used.has(at + i))) { u.workshops.push({ id, at }); done = true; }
      if (done) break;
    }
    if (!done) left.push(id);
  }
  return { units, left };
}

// every inventory the camp has: the chest and each storage place in the rig (workshops with a "Lager-Raster")
export function containers(D, save) {
  const out = [];
  const K = D.camp?.chest;
  if (K?.enabled !== false && K?.grid) out.push({ key: 'chest', name: 'Kiste', size: K.grid });
  save.rig.units.forEach((u, ui) => u.workshops.forEach(w => {
    const g = D.workshops?.[w.id]?.grid;
    if (g) out.push({ key: `store:${ui}:${w.at}`, name: D.workshops[w.id].name || w.id, size: g, workshop: w.id });
  }));
  return out;
}
// a grid with the right size: created when missing, things that no longer fit after a resize look for a new spot (or are lost)
export function ensureGrid(D, inv, key, [w, h]) {
  let g = inv.grids[key];
  if (!g) return (inv.grids[key] = newGrid(w, h));
  if (g.w !== w || g.h !== h) {
    const old = g.items; g.w = w; g.h = h; g.items = [];
    for (const e of old) if (fits(D, g, e, e.x, e.y)) g.items.push(e); else add(D, g, e.a, e.id, e.n);
  }
  return g;
}
export function backpackSize(D, inv) { return D.backpacks?.[inv.backpack]?.size || [4, 3]; }

function newInventory(D, save) {
  const L = D.leyla?.loadout || {}, S = D.game?.start || {};
  const inv = { backpack: L.backpack || Object.keys(D.backpacks || {})[0] || null, slots: { melee: L.melee || null, ranged: L.ranged || null, cyberdeck: L.cyberdeck || null }, grids: {} };
  ensureGrid(D, inv, 'backpack', backpackSize(D, inv));
  const conts = containers(D, save);
  for (const c of conts) ensureGrid(D, inv, c.key, c.size);
  const firstStore = conts.find(c => c.key.startsWith('store:'))?.key;
  for (const row of S.inventory || []) {
    const key = row.where === 'chest' ? 'chest' : row.where === 'storage' ? firstStore : 'backpack', g = key && inv.grids[key];
    const [a, id] = row.item ? ['items', row.item] : row.weapon ? ['weapons', row.weapon] : row.backpack ? ['backpacks', row.backpack] : [];
    if (g && a && D[a]?.[id]) add(D, g, a, id, row.count || 1);
  }
  return inv;
}

export function newSave(D) {
  const S = D.game?.start || {}, C = D.camp?.clock || {};
  const { units } = placeWorkshops(D, S.tractor, S.containers || [], S.workshops || []);
  return withInventory(D, {
    version: SAVE_VERSION,
    day: C.startDay ?? 1, hour: C.startHour ?? 18,
    location: S.location || Object.keys(D.locations || {})[0] || null,
    fuel: S.fuel ?? 40, food: S.food ?? 6, deltas: S.deltas ?? 0,
    health: D.leyla?.health ?? 100,
    buffs: [],
    rig: { tractor: S.tractor, units },
    companions: [...(S.companions || [])],
    recipes: startRecipes(D),
    run: null,
    log: [],
  });
}
function withInventory(D, save) {
  save.inv ??= newInventory(D, save);
  const inv = save.inv;
  inv.grids ??= {}; inv.slots ??= {};
  if (!D.backpacks?.[inv.backpack]) inv.backpack = D.leyla?.loadout?.backpack || null;
  for (const k of ['melee', 'ranged', 'cyberdeck']) if (inv.slots[k] && !D.weapons?.[inv.slots[k]]) inv.slots[k] = null;
  for (const g of Object.values(inv.grids)) g.items = (g.items || []).filter(e => D[e.a]?.[e.id] && e.n > 0);
  for (const piles of Object.values(save.ground || {})) for (const p of piles) p.grid.items = (p.grid?.items || []).filter(e => D[e.a]?.[e.id] && e.n > 0);
  ensureGrid(D, inv, 'backpack', backpackSize(D, inv));
  for (const c of containers(D, save)) ensureGrid(D, inv, c.key, c.size);
  return save;
}

// the recipe book at the start: every recipe with discovery "Von Anfang an"
const startRecipes = D => Object.entries(D.recipes || {}).filter(([, r]) => (r.discovery || []).includes('start')).map(([id]) => id);

// fills gaps of an older savegame (new fields, removed workshops) so the game never trips over it
export function repairSave(save, D) {
  const fresh = newSave(D);
  if (!save || typeof save !== 'object' || save.version !== SAVE_VERSION) return fresh;
  const s = { ...fresh, ...save };
  if (!D.locations?.[s.location]) s.location = fresh.location;
  if (!D.tractors?.[s.rig?.tractor]) s.rig = fresh.rig;
  for (const u of s.rig.units) u.workshops = (u.workshops || []).filter(w => D.workshops?.[w.id]);
  s.buffs = (s.buffs || []).filter(b => D.buffs?.[b]);
  s.companions = (s.companions || []).filter(c => D.companions?.[c]);
  if (s.run && !D.pois?.[s.run.poi]) s.run = null;
  s.recipes = Array.isArray(save.recipes) ? [...new Set([...save.recipes.filter(r => D.recipes?.[r]), ...startRecipes(D)])] : fresh.recipes;
  if (save.inv === undefined) delete s.inv;   // older savegame: inventory from the start values
  return withInventory(D, s);
}

// the clock: day + hour → "Tag 2 · 07:30"
export function clockText(save) {
  const h = Math.floor(save.hour), m = Math.round((save.hour - h) * 60);
  return `Tag ${save.day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function advance(save, hours) {
  const m = Math.round((save.hour + hours) * 60);   // whole minutes (cooking and crafting take minutes)
  save.day += Math.floor(m / 1440); save.hour = (m % 1440) / 60;
  return save;
}
// hours until the next time the clock shows `hour` (sleeping until the morning)
// arriving in the camp (loading, after a run, after driving): the clock moves on to the next dusk (Camp › Zeit › Ankunft um)
export function arrive(save, D) {
  const h = D.camp?.clock?.arriveHour;
  if (h == null || h === '' || save.hour === h) return save;
  return advance(save, hoursUntil(save, h));
}
export function hoursUntil(save, hour) { const d = (hour - save.hour + 24) % 24; return d === 0 ? 24 : d; }

export async function openSave(D, base = '') {
  let where = 'local', stored = null, time = null;
  try {
    const r = await fetch(`${base}/api/save`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) { const d = await r.json(); where = 'cloud'; stored = d.save; time = d.time; }
  } catch { /* no worker */ }
  if (where === 'local') try { stored = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch { stored = null; }
  const box = {
    where, time,
    save: repairSave(stored, D),
    fresh: !stored,
    error: null,
    // write the savegame (online: KV per login, otherwise this browser); errors are kept, the game goes on
    async persist() {
      const body = JSON.stringify({ save: box.save });
      try {
        if (where === 'cloud') {
          const r = await fetch(`${base}/api/save`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Fehler ${r.status}`);
          box.time = (await r.json()).time;
        } else { localStorage.setItem(LOCAL_KEY, JSON.stringify(box.save)); box.time = new Date().toISOString(); }
        box.error = null;
      } catch (e) { box.error = e.message; console.warn('Spielstand nicht gespeichert:', e.message); }
      return box;
    },
    async reset() { box.save = newSave(D); box.fresh = true; return box.persist(); },
  };
  return box;
}

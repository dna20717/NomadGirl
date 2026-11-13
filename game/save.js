// Savegame: everything that lasts between runs (clock, place, rig, Δ, health, buffs, run in progress).
// Online (Cloudflare worker) one savegame per login in KV (/api/save), the same on every device;
// without the worker (local, tests) in this browser (localStorage). Shape:
//   { version, day, hour, location, fuel, food, deltas, health, buffs: [id], rig: { tractor, units: [{ kind, id, workshops: [{ id, at }] }], spare: { workshops: [id], containers: [id] } } (game/rig.js),
//     companions: [id], recipes: [id] (recipe book), run: null | { poi, room, location }, log: [text],
//     inv: { backpack: id, slots: { melee, ranged, cyberdeck }, wear: { head, armor, eyes … module }, grids: { backpack, drone (rescue pocket), chest, 'store:<unit>:<place>': grid, 'rig:<unit>': grid } } }   (grids: game/inventory.js)
//   rig.parts = { engine: [id|null], armor: [...], weapon: [...], roof: [...] }: rig parts on the tractor's sockets (Rig bauen), rig.spare.parts = on the scrapyard
//   'rig:<unit>' = the own storage of the tractor (Kofferraum, plus rows from a Dachbox) or of a trailer (Deichselkasten)
// Times are hours (18.5 = 18:30). "Ereignis-Zeit": the clock only moves on actions (sleeping, runs, sitting at the fire).

import { ensureMap } from './worldmap.js';
import { ensureTank } from './tank.js';
import { newGrid, add, fits, startWear, wearOf, WEAR_KEYS } from './inventory.js';

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

// the cryo tank (Cryo-Tank › Werkstatt + Im Container) is always in the rig: from the start and in old savegames, in a container of its own
// at the end of the rig (storage keys of the other units stay where they are); fixed, so it never leaves again
export function ensureTankInRig(D, s) {
  const T = D.tank || {};
  if (T.enabled === false || !D.workshops?.[T.workshop]) return s;
  ensureTank(D, s);
  if (s.rig.units.some(u => u.workshops.some(w => w.id === T.workshop))) return s;
  s.rig.spare.workshops = (s.rig.spare.workshops || []).filter(w => (w.id ?? w) !== T.workshop);
  s.rig.units.push({ kind: 'container', id: D.containers?.[T.container] ? T.container : Object.keys(D.containers || {})[0], workshops: [{ id: T.workshop, at: 0 }] });
  return s;
}

// every inventory the camp has: the chest and each storage place in the rig (workshops with a "Lager-Raster")
export function containers(D, save) {
  const out = [];
  const K = D.camp?.chest;
  if (K?.enabled !== false && K?.grid) out.push({ key: 'chest', name: 'Kiste', size: K.grid });
  save.rig.units.forEach((u, ui) => {
    const def = u.kind === 'tractor' ? D.tractors?.[u.id] : D.containers?.[u.id], S = def?.storage;
    if (!S?.[0] || !S?.[1]) return;
    const rows = u.kind === 'tractor' ? Object.values(save.rig.parts || {}).flat().reduce((n, id) => n + (D.rigParts?.[id]?.storageRows || 0), 0) : 0;   // Dachbox
    const own = def.storageName || (u.kind === 'tractor' ? 'Kofferraum' : 'Deichselkasten');
    out.push({ key: `rig:${ui}`, name: u.kind === 'tractor' ? own : `${own} · ${def.name || u.id}`, size: [S[0], S[1] + rows], unit: ui });
  });
  save.rig.units.forEach((u, ui) => u.workshops.forEach(w => {
    const g = D.workshops?.[w.id]?.grid;
    const def = D.workshops[w.id];
    if (g) out.push({ key: `store:${ui}:${w.at}`, name: def.name || w.id, size: g, workshop: w.id, ...(def.accept?.length ? { accept: { categories: def.accept } } : {}) });
    // trophy stands (Werkstätten › Schatzkammer & Trophäen): every stand is an inventory of its own, only things tagged "trophy"
    (def.stands || []).forEach((st, i) => { if (st.grid?.[0] && st.grid?.[1]) out.push({ key: `store:${ui}:${w.at}:s${i}`, name: `${def.name || w.id} · ${st.name || 'Ständer ' + (i + 1)}`, size: st.grid, workshop: w.id, stand: i, parent: `store:${ui}:${w.at}`, accept: { tag: 'trophy' } }); });
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
  const firstStore = conts.find(c => c.key.startsWith('store:') && !c.accept)?.key;
  for (const row of S.inventory || []) {
    const key = row.where === 'chest' ? 'chest' : row.where === 'storage' ? firstStore || 'chest' : 'backpack', g = key && inv.grids[key];   // no storage at the start: into the chest
    const [a, id] = row.item ? ['items', row.item] : row.weapon ? ['weapons', row.weapon] : row.backpack ? ['backpacks', row.backpack] : [];
    if (g && a && D[a]?.[id]) add(D, g, a, id, row.count || 1);
  }
  return inv;
}

export function newSave(D) {
  return withMap(D, newSaveCore(D));
}
// the travel map (#007): rolled for every new game and every Durchgang (game/worldmap.js)
function withMap(D, s) { ensureMap(D, s); return s; }
function newSaveCore(D) {
  const S = D.game?.start || {}, C = D.camp?.clock || {};
  const { units, left } = placeWorkshops(D, S.tractor, S.containers || [], S.workshops || []);
  const spare = [...(S.spare || []), ...left].filter(id => D.workshops?.[id]);   // packed on the scrapyard: Spiel › Start › Verpackt auf dem Schrottplatz, plus what did not fit
  return withInventory(D, ensureTankInRig(D, {
    version: SAVE_VERSION,
    day: C.startDay ?? 1, hour: C.startHour ?? 18,
    location: S.location || Object.keys(D.locations || {})[0] || null,
    fuel: S.fuel ?? 40, food: S.food ?? 6, deltas: S.deltas ?? D.economy?.startDeltas ?? 0,
    health: D.leyla?.health ?? 100,
    buffs: [],
    rig: { tractor: S.tractor, units, spare: { workshops: spare, containers: [], parts: [] }, parts: {} },
    companions: [...(S.companions || [])],
    recipes: startRecipes(D),
    run: null,
    log: [],
  }));
}
// a new Durchgang (design.md › Progression: „War alles nur ein Traum?“): AvA is dead, Leyla wakes up at the fire.
// What stays: the tech tree nodes (and the recipes they unlock), the count of Durchgänge. Everything else starts small.
export function newCycle(D, old) {
  const s = newSave(D);
  s.nodes = [...(old.nodes || [])].filter(id => D.techtree?.[id]);
  s.cycle = (old.cycle || 1) + 1;
  s.map = null; ensureMap(D, s);   // a new Durchgang, a new map
  s.dreams = [...(old.dreams || []), { day: old.day, hour: old.hour, rescues: old.tank?.rescues || 0, cause: old.tank?.cause || null }];
  for (const id of s.nodes) for (const r of D.techtree[id].recipes || []) if (!s.recipes.includes(r)) s.recipes.push(r);
  return s;
}
function withInventory(D, save) {
  save.inv ??= newInventory(D, save);
  const inv = save.inv;
  inv.grids ??= {}; inv.slots ??= {};
  if (!D.backpacks?.[inv.backpack]) inv.backpack = D.leyla?.loadout?.backpack || null;
  for (const k of ['melee', 'ranged', 'cyberdeck']) if (inv.slots[k] && !D.weapons?.[inv.slots[k]]) inv.slots[k] = null;
  // worn things: head, armor, implants, AvA's parts; older savegames start with Leyla › Start-Ausrüstung › Angelegt
  inv.wear ??= startWear(D);
  for (const k of WEAR_KEYS) if (inv.wear[k] && wearOf(D, inv.wear[k]) !== k) inv.wear[k] = null; else inv.wear[k] ??= null;
  for (const g of Object.values(inv.grids)) g.items = (g.items || []).filter(e => D[e.a]?.[e.id] && e.n > 0);
  for (const piles of Object.values(save.ground || {})) for (const p of piles) p.grid.items = (p.grid?.items || []).filter(e => D[e.a]?.[e.id] && e.n > 0);
  ensureGrid(D, inv, 'backpack', backpackSize(D, inv));
  for (const c of containers(D, save)) ensureGrid(D, inv, c.key, c.size);
  ensureGrid(D, inv, 'drone', D.drone?.rescue?.size || [3, 2]);   // AvA's rescue pocket: survives a knock-out
  // Spiel › Start › Nachreichen: every savegame (new or old) gets these once, e.g. a test weapon (Daniel, 12.11.2026: Revolver-Test)
  save.handedOut ??= [];
  for (const row of D.game?.start?.later || []) {
    const [a, id] = row.item ? ['items', row.item] : row.weapon ? ['weapons', row.weapon] : row.backpack ? ['backpacks', row.backpack] : [];
    const key = `${a}:${id}${row.force ? '!' : ''}`;
    if (!a || !D[a]?.[id] || save.handedOut.includes(key)) continue;
    const g = inv.grids[row.where === 'chest' ? 'chest' : 'backpack'] || inv.grids.chest;
    if (!g) continue;
    // „Platz machen“ (Daniel, 12.11.2026: „lösch einfach andere Items, bis es passt“): whoever already owns it keeps theirs,
    // otherwise the newest things in that grid move to the camp chest (or are gone when it is full) until it fits
    if (row.force) {
      const owned = Object.values(inv.grids).some(x => x?.items?.some(e => e.a === a && e.id === id)) || Object.values(inv.slots || {}).includes(id);
      if (!owned) while (add(D, g, a, id, row.count || 1) !== 0 && g.items.some(e => !(e.a === a && e.id === id))) {
        const i = g.items.map((e, k) => [e, k]).filter(([e]) => !(e.a === a && e.id === id)).pop()[1];
        const [out] = g.items.splice(i, 1), chest = inv.grids.chest;
        if (chest && chest !== g) add(D, chest, out.a, out.id, out.n);   // into the camp chest while there is room, otherwise gone
      }
      save.handedOut.push(key);
      continue;
    }
    if (add(D, g, a, id, row.count || 1) === 0) save.handedOut.push(key);
  }
  return save;
}

// the recipe book at the start: every recipe with discovery "Von Anfang an"
const startRecipes = D => Object.entries(D.recipes || {}).filter(([, r]) => (r.discovery || []).includes('start')).map(([id]) => id);

// fills gaps of an older savegame (new fields, removed workshops) so the game never trips over it
// A container may have fewer places now (Daniel, 08.11.2026: Wohnanhänger 3 → 2): a workshop standing on a place that is gone
// moves to a free place in the rig, otherwise onto the scrapyard; a storage takes its contents along (to its new place, else
// into the chest, the Kofferraum, and what is left lies as a bundle next to the van).
function refit(D, s) {
  const U = s.rig.units, cap = u => (u.kind === 'tractor' ? D.tractors?.[u.id]?.places : D.containers?.[u.id]?.places) || 0, size = id => D.workshops?.[id]?.places || 1;
  const taken = U.map(() => new Set()), out = [];
  U.forEach((u, ui) => {
    u.workshops = u.workshops.filter(w => {
      const n = size(w.id), ok = w.at >= 0 && w.at + n <= cap(u) && [...Array(n)].every((_, k) => !taken[ui].has(w.at + k));
      if (ok) for (let k = 0; k < n; k++) taken[ui].add(w.at + k); else out.push({ ui, w });
      return ok;
    });
  });
  const grids = s.inv?.grids || {};
  for (const { ui, w } of out) {
    const n = size(w.id), old = `store:${ui}:${w.at}`;
    let spot = null;
    U.forEach((u, vi) => { for (let at = 0; !spot && at + n <= cap(u); at++) if ([...Array(n)].every((_, k) => !taken[vi].has(at + k))) spot = { vi, at }; });
    if (spot) {
      U[spot.vi].workshops.push({ id: w.id, at: spot.at });
      for (let k = 0; k < n; k++) taken[spot.vi].add(spot.at + k);
      if (grids[old]) { grids[`store:${spot.vi}:${spot.at}`] = grids[old]; delete grids[old]; }
      continue;
    }
    s.rig.spare.workshops.push(w.id);
    const g = grids[old];
    delete grids[old];
    if (!g?.items?.length) continue;
    rehome(D, s, g);
  }
}
// the contents of a grid that is gone: into the chest, the Kofferraum, and what is left lies as a bundle next to the van
function rehome(D, s, g) {
  const grids = s.inv?.grids || {};
  let rest = g.items.map(e => ({ ...e }));
  for (const key of ['chest', 'rig:0']) if (grids[key]) rest = rest.map(e => ({ ...e, n: add(D, grids[key], e.a, e.id, e.n) })).filter(e => e.n > 0);
  if (rest.length) {
    const pile = { x: null, feet: null, grid: newGrid(Math.max(4, g.w), Math.max(3, g.h)) };
    for (const e of rest) add(D, pile.grid, e.a, e.id, e.n);
    ((s.ground ??= {})[s.location] ??= []).push(pile);
  }
}
// Deichselkästen und Staufächer are gone (Daniel, 12.11.2026, design.md › Ausbaustufe Progression): only the tractor keeps its own storage;
// what an older savegame kept in a trailer's box moves into the chest (then the Kofferraum, then a bundle by the van)
function dropStorage(D, s) {
  const grids = s.inv?.grids || {};
  for (const key of Object.keys(grids)) {
    const m = /^rig:(\d+)$/.exec(key);
    if (!m) continue;
    const u = s.rig.units[Number(m[1])];
    if (u?.kind === 'tractor' || (u && D.containers?.[u.id]?.storage)) continue;
    const g = grids[key]; delete grids[key];
    if (g?.items?.length) rehome(D, s, g);
  }
}

export function repairSave(save, D) {
  const fresh = newSave(D);
  if (!save || typeof save !== 'object' || save.version !== SAVE_VERSION) return fresh;
  const s = { ...fresh, ...save };
  if (!D.locations?.[s.location] && !s.map?.nodes?.some(n => n.id === s.location)) s.location = fresh.location;
  ensureMap(D, s);   // older savegames get their map here (#007)
  if (!D.tractors?.[s.rig?.tractor]) s.rig = fresh.rig;
  s.rig.units = s.rig.units.filter(u => u.kind === 'tractor' || D.containers?.[u.id]);
  for (const u of s.rig.units) u.workshops = (u.workshops || []).filter(w => D.workshops?.[w.id]);
  refit(D, s);
  dropStorage(D, s);
  // stacks stay whole: a level is at most one above the unit before it, nothing stands on the tractor
  s.rig.units.forEach((u, i) => { const prev = s.rig.units[i - 1]; if (!u.level) { delete u.slot; return; } const max = !prev || prev.kind === 'tractor' ? 0 : (prev.level || 0) + 1; if (u.level > max) u.level = max; if (!u.level) { delete u.level; delete u.slot; } });   // a slot only counts on a stack
  const sp = s.rig.spare || {};
  s.rig.spare = { workshops: (sp.workshops || []).filter(w => D.workshops?.[w]), containers: (sp.containers || []).filter(c => D.containers?.[c]), parts: (sp.parts || []).filter(c => D.rigParts?.[c]) };
  // rig parts were things in the inventory for a morning (08.11.2026): they move onto the scrapyard
  for (const g of Object.values(save.inv?.grids || {})) for (const e of [...(g.items || [])]) if (e.a === 'rigParts') { g.items.splice(g.items.indexOf(e), 1); if (D.rigParts?.[e.id]) for (let k = 0; k < (e.n || 1); k++) s.rig.spare.parts.push(e.id); }
  s.rig.parts = Object.fromEntries(Object.entries(s.rig.parts || {}).map(([k, l]) => [k, (l || []).map(id => D.rigParts?.[id]?.slot === k ? id : null)]));
  s.buffs = (s.buffs || []).filter(b => D.buffs?.[b]);
  s.companions = (s.companions || []).filter(c => D.companions?.[c]);
  if (s.run && !D.pois?.[s.run.poi]) s.run = null;
  s.recipes = Array.isArray(save.recipes) ? [...new Set([...save.recipes.filter(r => D.recipes?.[r]), ...startRecipes(D)])] : fresh.recipes;
  if (save.inv === undefined) delete s.inv;   // older savegame: inventory from the start values
  if (!save.tank) delete s.tank;   // older savegame: the tank starts full at today's clock
  ensureTankInRig(D, s);
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
    async cycle() { box.save = newCycle(D, box.save); box.fresh = true; return box.persist(); },
  };
  return box;
}

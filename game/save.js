// Savegame: everything that lasts between runs (clock, place, rig, Δ, health, buffs, run in progress).
// Online (Cloudflare worker) in KV per login (/api/save?slot=n), the same on every device; without the worker (local, tests) in this
// browser (localStorage). #126: three slots, global achievements, the Vor-Lösch-Zustand: game/slots.js. Shape:
//   { version, day, hour, location, fuel, food, deltas, health, buffs: [id], rig: { tractor, units: [{ kind, id, workshops: [{ id, at }] }], spare: { workshops: [id], containers: [id] } } (game/rig.js),
//     companions: [id], recipes: [id] (recipe book), run: null | { poi, room, location }, log: [text],
//     inv: { backpack: id, slots: { melee, ranged, cyberdeck }, wear: { head, armor, eyes … module }, grids: { backpack, drone (rescue pocket), camp (Camp-Lager, #041), 'store:<unit>:<place>': grid (Speziallager + trophy stands) } } }   (grids: game/inventory.js)
//   rig.parts = { engine: [id|null], armor: [...], weapon: [...], roof: [...] }: rig parts on the tractor's sockets (Rig bauen), rig.spare.parts = on the scrapyard
//   camp = the Kofferraum (plus rows from a Dachbox) and every Lagerregal as ONE grid; older 'chest' and 'rig:<unit>' grids move into it on load
// Times are hours (18.5 = 18:30). "Ereignis-Zeit": the clock only moves on actions (sleeping, runs, sitting at the fire).

import { keepThrough, recipeOf } from './achievements.js';
import { openStorage, activeSlot, slotMeta, withGlobal, mergeAchievements } from './slots.js';
import { renameMap } from '../engine/renames.js';
import { ensureMap } from './worldmap.js';
import { generate } from './glitchlings.js';
import { settle as settleMega, fixLights as fixMegaLights, deactivate as deactivateMega } from './mega.js';
import { compact as compactDecor } from './decor.js';
import { rehome, removeUnits } from './reindex.js';
import { ensureTank } from './tank.js';
import { newGrid, add, fits, startWear, wearOf, WEAR_KEYS, addEntry, untangle, kindOf, thing, remove } from './inventory.js';

export const SAVE_VERSION = 2;   // 2: Daniel, 19.11.2026 „alle Spielstände reset“ (after #111–#113): every older savegame starts fresh

// rig layout from a tractor, containers and workshops: the tractor's own places first, then the containers in order
export function placeWorkshops(D, tractor, containers, workshops) {
  const units = [{ kind: 'tractor', id: tractor, workshops: [] }, ...containers.map(id => ({ kind: 'container', id, workshops: [] }))];
  const cap = u => (u.kind === 'tractor' ? D.tractors?.[u.id]?.places : u.places ?? D.containers?.[u.id]?.places) || 0;
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

// the Camp-Lager (#041, Daniel 16.11.2026: „das Camp-Inventar konsolidiert einsehbar und nutzbar, die einzelnen Regale bestimmen lediglich
// das Volumen; Ausnahme sind Speziallager wie Kühlen, Waffen oder Trophäen“): the tractor's own storage (Kofferraum, plus the Dachbox)
// and every workshop with a Lager-Raster that is no Speziallager add their cells to ONE grid. rig = { units, parts } (a savegame's or a draft's)
export function campStore(D, rig) {
  const parts = [];
  (rig?.units || []).forEach((u, ui) => {
    if (u.kind === 'tractor') {
      const T = D.tractors?.[u.id], S = T?.storage;
      const rows = Object.values(rig.parts || {}).flat().reduce((n, id) => n + (D.rigParts?.[id]?.storageRows || 0), 0);   // Dachbox
      if (S?.[0] && S?.[1]) parts.push({ name: T.storageName || 'Kofferraum', cells: S[0] * (S[1] + rows), unit: ui });
    }
    for (const w of u.workshops || []) {
      const def = D.workshops?.[w.id], g = def?.grid;
      if (g?.[0] && g?.[1] && !def.ownStorage) parts.push({ name: def.name || w.id, cells: g[0] * g[1], place: `${ui}:${w.at}`, workshop: w.id });
    }
  });
  const cap = parts.reduce((n, p) => n + p.cells, 0), W = Math.max(1, D.camp?.storage?.width || 10);
  return { cap, size: [Math.min(W, Math.max(1, cap)), Math.max(1, Math.ceil(cap / W))], parts };
}
export const CAMP = 'camp';
export const campName = D => D.camp?.storage?.name || 'Camp-Lager';

// every inventory the camp has: the Camp-Lager and each Speziallager in the rig (Werkstätten › Speziallager), with their trophy stands
export function containers(D, save) {
  const out = [], C = campStore(D, save.rig);
  if (C.cap) out.push({ key: CAMP, name: campName(D), size: C.size, cap: C.cap, parts: C.parts });
  save.rig.units.forEach((u, ui) => u.workshops.forEach(w => {
    const def = D.workshops[w.id], g = def?.grid;
    if (!def) return;
    if (g && def.ownStorage) out.push({ key: `store:${ui}:${w.at}`, name: def.name || w.id, size: [g[0], g[1] + extraRows(def, w)], workshop: w.id, own: true, ...(def.accept?.length ? { accept: { categories: def.accept } } : {}) });
    // trophy stands (Werkstätten › Schatzkammer & Trophäen): every stand is an inventory of its own, only things tagged "trophy"
    (def.stands || []).forEach((st, i) => { if (st.grid?.[0] && st.grid?.[1]) out.push({ key: `store:${ui}:${w.at}:s${i}`, name: `${def.name || w.id} · ${st.name || 'Ständer ' + (i + 1)}`, size: st.grid, workshop: w.id, stand: i, parent: `store:${ui}:${w.at}`, accept: st.accept ? { categories: String(st.accept).split(',').map(x => x.trim()).filter(Boolean) } : { tag: 'trophy' } }); });
  }));
  return out;
}
// #099 Speziallager ausbauen: every step (Werkstätten › Ausbau › + Reihen Lager) adds rows to the own grid
export const extraRows = (def, w) => (def?.upgrades || []).filter(r => r && (r.name || r.deltas || r.item)).slice(0, Math.max(0, Math.floor(Number(w?.level) || 0))).reduce((n, r) => n + (Number(r.rows) || 0), 0);
// the key of the inventory a workshop opens: its own (Speziallager) or the Camp-Lager; null = it has none
export function storeKeyOf(D, save, ui, at) {
  const own = `store:${ui}:${at}`, all = containers(D, save);
  if (all.some(c => c.key === own)) return own;
  const id = save.rig.units[ui]?.workshops.find(w => w.at === at)?.id, def = D.workshops?.[id];
  return def?.grid && !def.ownStorage && all.some(c => c.key === CAMP) ? CAMP : null;
}
// „Alles einlagern“ (#041, Daniel 16.11.2026: „nach einem POI im Camp einen Button, alles Mitgebrachte einzulagern, sofern genug Lagerraum
// vorhanden ist“; Antwort: teilweise): everything from `from` (the backpack) goes first to a Speziallager that prefers its kind
// (Werkstätten › Einlagern bevorzugt, e.g. dishes into the Kühlraum) and takes it, then into the Camp-Lager; what fits nowhere stays.
// → { moved: things moved, left: things that stayed, places: { name: count } }
export function stowAll(D, save, from = 'backpack') {
  const G = save.inv?.grids || {}, src = G[from], out = { moved: 0, left: 0, places: {} };
  if (!src) return out;
  const all = containers(D, save), camp = all.find(c => c.key === CAMP);
  const takes = (c, e) => !c.accept || ((!c.accept.categories?.length || c.accept.categories.includes(kindOf(D, e.a, e.id))) && (!c.accept.tag || (thing(D, e.a, e.id)?.tags || []).includes(c.accept.tag)));
  for (const e of [...src.items]) {
    const kind = kindOf(D, e.a, e.id);
    const special = all.filter(c => c.own && c.stand == null && (D.workshops?.[c.workshop]?.prefers || []).includes(kind) && takes(c, e));
    for (const c of [...special, ...(camp ? [camp] : [])]) {
      const g = G[c.key];
      if (!g || !e.n) continue;
      const left = addEntry(D, g, e, e.n);
      if (left < e.n) out.places[c.name] = (out.places[c.name] || 0) + (e.n - left);
      e.n = left;
    }
    if (e.n > 0) out.left++; else { remove(src, e); out.moved++; }
  }
  return out;
}
// a grid with the right size: created when missing; things that no longer fit after a resize look for a new spot.
// → the entries that found no room at all (the caller rehomes them: Camp-Lager, else a bundle by the van)
export function ensureGrid(D, inv, key, [w, h], cap = null) {
  let g = inv.grids[key];
  if (!g) { inv.grids[key] = newGrid(w, h, cap); return []; }
  const want = cap != null && cap < w * h ? cap : undefined;
  if (g.w === w && g.h === h && g.cap === want) return [];
  const old = g.items, out = []; g.w = w; g.h = h; if (want == null) delete g.cap; else g.cap = want; g.items = [];
  for (const e of old) if (!fits(D, g, e, e.x, e.y)) out.push(e); else g.items.push(e);
  return out.filter(e => (e.n = addEntry(D, g, e, e.n)) > 0);
}
// every container at its size; what falls out goes into the Camp-Lager, else a bundle by the van (never lost)
export function fitContainers(D, save) {
  const lost = [];
  for (const c of containers(D, save)) lost.push(...ensureGrid(D, save.inv, c.key, c.size, c.cap));
  if (lost.length) rehome(D, save, { w: 4, h: 3, items: lost });
  return lost.length;
}
// the cyberdeck is an inventory for Entities (#049, Daniel 17.11.2026: „Man muss sie nicht im Inventar transportieren, wenn man ein
// Cyberdeck hat (was im Grunde zunächst mal ein eigenes Inventar für Glitchlinge ist)“): one place = 2 × 2 (an Entity), side by side
export const DECK = 'deck';
export const TRUNK = 'trunk';   // #094 the van's trunk in a POI
// #094 back in the camp the trunk's loot is treated like the backpack's: into the backpack, the rest into the Camp-Lager, what still
// does not fit waits in the trunk → { moved, left }
export function unloadTrunk(D, save) {
  const g = save?.inv?.grids?.[TRUNK];
  let moved = 0;
  if (!g?.items?.length) return { moved, left: 0 };
  for (const e of [...g.items]) {
    let n = e.n;
    for (const k of ['backpack', CAMP]) { const t = save.inv.grids[k]; if (t && n > 0) { const was = n; n = addEntry(D, t, e, n); moved += was - n; } }
    if (n <= 0) g.items.splice(g.items.indexOf(e), 1); else e.n = n;
  }
  return { moved, left: g.items.reduce((s, e) => s + e.n, 0) };
}
export function deckSize(D, id) { const n = D.weapons?.[id]?.kind === 'cyberdeck' ? D.weapons[id].glitchSlots || 0 : 0; return n > 0 ? [2 * n, 2] : null; }
// the deck grid for the deck Leyla holds (none without one); → what no longer fits
export function fitDeck(D, inv) {
  const size = deckSize(D, inv.slots?.cyberdeck);
  if (size) return ensureGrid(D, inv, DECK, size);
  const out = inv.grids[DECK]?.items || []; delete inv.grids[DECK]; return out;
}
export function backpackSize(D, inv) { return D.backpacks?.[inv.backpack]?.size || [4, 3]; }

function newInventory(D, save) {
  const L = D.leyla?.loadout || {}, S = D.game?.start || {};
  const inv = { backpack: L.backpack || Object.keys(D.backpacks || {})[0] || null, slots: { melee: L.melee || null, ranged: L.ranged || null, cyberdeck: L.cyberdeck || null }, grids: {} };
  ensureGrid(D, inv, 'backpack', backpackSize(D, inv));
  for (const c of containers(D, save)) ensureGrid(D, inv, c.key, c.size, c.cap);
  for (const row of S.inventory || []) {
    const key = row.where === 'storage' || row.where === 'chest' ? (inv.grids[CAMP] ? CAMP : 'backpack') : 'backpack', g = inv.grids[key];   // #041: the chest is gone, „Kiste“ = Camp-Lager
    const [a, id] = row.item ? ['items', row.item] : row.weapon ? ['weapons', row.weapon] : row.backpack ? ['backpacks', row.backpack] : [];
    if (g && a && D[a]?.[id]) add(D, g, a, id, row.count || 1);
  }
  return inv;
}

// handed: what Spiel › Start › Nachreichen already gave (a new Durchgang keeps it, Daniel 16.11.2026: „A“, only once per savegame)
export function newSave(D, handed = []) {
  return withMap(D, newSaveCore(D, handed));
}
// the travel map (#007): rolled for every new game and every Durchgang (game/worldmap.js)
function withMap(D, s) { ensureMap(D, s); return s; }
function newSaveCore(D, handed = []) {
  const S = D.game?.start || {}, C = D.camp?.clock || {};
  const { units, left } = placeWorkshops(D, S.tractor, S.containers || [], S.workshops || []);
  const spare = [...(S.spare || []), ...left].filter(id => D.workshops?.[id]);   // packed on the scrapyard: Spiel › Start › Verpackt auf dem Schrottplatz, plus what did not fit
  return noGift(withInventory(D, ensureTankInRig(D, {
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
    handedOut: [...handed],
  })));
}
// a new Durchgang (design.md › Progression: „War alles nur ein Traum?“): AvA is dead, Leyla wakes up at the fire.
// What stays: the tech tree nodes (and the recipes they unlock), the count of Durchgänge. Everything else starts small.
export function newCycle(D, old) {
  const s = newSave(D, old.handedOut || []);
  s.nodes = [...(old.nodes || [])].filter(id => D.techtree?.[id]);
  s.cycle = (old.cycle || 1) + 1;
  s.map = null; ensureMap(D, s);   // a new Durchgang, a new map
  // salvage (#023): what is built stays, done wrecks stay done, the LKW keeps pulling; sites are rolled anew on the new map
  if (old.salvage) s.salvage = { built: old.salvage.built || {}, done: old.salvage.done || {}, seen: old.salvage.seen || {}, sites: {} };
  if (old.megarigs) s.megarigs = [...old.megarigs];
  if (old.look) s.look = { color: old.look.color ?? 0, unlocked: [...(old.look.unlocked || [])] };   // #044: the hair colour is Leyla's, not the dream's
  if (old.gifts) s.gifts = [...old.gifts];   // a gift (#048) comes once per savegame, not per dream
  for (const [id, x] of Object.entries(D.salvage || {})) if (s.salvage?.done?.[id] && x.tractor && D.tractors?.[x.tractor]) swapTractor(D, s, x.tractor);
  s.dreams = [...(old.dreams || []), { day: old.day, hour: old.hour, rescues: old.tank?.rescues || 0, cause: old.tank?.cause || null }];
  for (const id of s.nodes) for (const r of D.techtree[id].recipes || []) if (!s.recipes.includes(r)) s.recipes.push(r);
  // Achievements (#012): they, their recipes and the trophies stay; ⚠️ vorläufig the trophies wait in a memory chest at the fire
  const trophies = keepThrough(D, old, s);
  if (trophies.length) {
    const grid = newGrid(6, Math.max(3, Math.ceil(trophies.length / 2) + 1));
    for (const t of trophies) addEntry(D, grid, t, t.n);
    ((s.ground ??= {})[s.location] ??= []).push({ x: null, feet: null, grid, memory: true });
  }
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
  // #041: the camp chest, the Kofferraum and the shelves became one Camp-Lager; what an older savegame kept there moves in
  // (the Camp-Lager is filled after the Speziallager, what does not fit lies as a bundle by the van)
  const conts = containers(D, save), keep = new Set(conts.map(c => c.key)), loose = [];
  for (const k of Object.keys(inv.grids)) if (k === 'chest' || /^rig:\d+$/.test(k) || (k.startsWith('store:') && !keep.has(k))) { loose.push(...(inv.grids[k]?.items || [])); delete inv.grids[k]; }
  const homeless = [];
  homeless.push(...ensureGrid(D, inv, 'backpack', backpackSize(D, inv)));
  for (const c of conts) homeless.push(...ensureGrid(D, inv, c.key, c.size, c.cap));
  homeless.push(...ensureGrid(D, inv, 'drone', D.drone?.rescue?.size || [3, 2]));   // AvA's rescue pocket: survives a knock-out
  if (D.game?.spawn?.trunk?.enabled !== false) homeless.push(...ensureGrid(D, inv, TRUNK, D.game?.spawn?.trunk?.size || [6, 4]));   // #094 the van's trunk in a POI: survives a knock-out too
  homeless.push(...fitDeck(D, inv));   // the cyberdeck's Entities (#049)
  if (loose.length) { const camp = inv.grids[CAMP]; for (const e of loose) { const left = camp ? addEntry(D, camp, e, e.n) : e.n; if (left > 0) homeless.push({ ...e, n: left }); } }
  // rectangles only (14.11.2026): what overlaps now moves to a free spot, else into the Camp-Lager / a bundle by the van
  for (const g of Object.values(inv.grids)) if (g?.items?.length) homeless.push(...untangle(D, g));
  for (const piles of Object.values(save.ground || {})) for (const p of piles) if (p.grid?.items?.length) homeless.push(...untangle(D, p.grid));
  if (homeless.length) rehome(D, save, { w: 4, h: 3, items: homeless });
  // Spiel › Start › Nachreichen: every savegame (new or old) gets these once, e.g. a test weapon (Daniel, 12.11.2026: Revolver-Test)
  save.handedOut ??= [];
  for (const row of D.game?.start?.later || []) {
    const [a, id] = row.item ? ['items', row.item] : row.weapon ? ['weapons', row.weapon] : row.backpack ? ['backpacks', row.backpack] : [];
    const key = `${a}:${id}${row.force ? '!' : ''}`;
    if (!a || !D[a]?.[id] || save.handedOut.includes(key)) continue;
    const g = inv.grids[row.where === 'chest' || row.where === 'storage' ? CAMP : 'backpack'] || inv.grids[CAMP];
    if (!g) continue;
    // „Platz machen“ (Daniel, 12.11.2026: „lösch einfach andere Items, bis es passt“): whoever already owns it keeps theirs,
    // otherwise the newest things in that grid move to the Camp-Lager (or are gone when it is full) until it fits
    if (row.force) {
      const owned = Object.values(inv.grids).some(x => x?.items?.some(e => e.a === a && e.id === id)) || Object.values(inv.slots || {}).includes(id);
      if (!owned) while (add(D, g, a, id, row.count || 1) !== 0 && g.items.some(e => !(e.a === a && e.id === id))) {
        const i = g.items.map((e, k) => [e, k]).filter(([e]) => !(e.a === a && e.id === id)).pop()[1];
        const [out] = g.items.splice(i, 1), camp = inv.grids[CAMP];
        if (camp && camp !== g) addEntry(D, camp, out, out.n);   // into the Camp-Lager while there is room, otherwise gone
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
// a new tractor in front of the rig (#023, the salvaged LKW): workshops that do not fit any more move into the rig or onto the scrapyard
export function swapTractor(D, s, id) {
  if (!D.tractors?.[id] || !s.rig?.units?.length) return false;
  s.rig.tractor = id;
  const t = s.rig.units.find(u => u.kind === 'tractor');
  if (t) t.id = id;
  refit(D, s);
  return true;
}
function refit(D, s) {
  const U = s.rig.units, cap = u => (u.kind === 'tractor' ? D.tractors?.[u.id]?.places : (D.containers?.[u.id]?.resize && u.places != null ? Math.max(D.containers[u.id].resize[0] ?? 1, Math.min(D.containers[u.id].resize[1] ?? 9, u.places)) : D.containers?.[u.id]?.places)) || 0, size = id => D.workshops?.[id]?.places || 1;
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
// Backlog C10 (#125): ids renamed in the workshop (Grundlagen › Umbenennungen) follow in the savegame instead of being dropped below.
// Inventory entries ({ a: area, id }) map by their area; any other string or key maps when its old id is gone from every area and
// only one rename leads away from it (ids are plain words, so a match is that id). Returns how many places changed.
export function followRenames(D, save) {
  const byArea = renameMap(D), any = new Map(), clash = new Set();
  const exists = id => Object.values(D).some(o => o && typeof o === 'object' && !Array.isArray(o) && Object.hasOwn(o, id) && o[id] && typeof o[id] === 'object');
  for (const m of Object.values(byArea)) for (const [from, to] of Object.entries(m)) {
    if (any.has(from) && any.get(from) !== to) clash.add(from); else any.set(from, to);
  }
  for (const id of [...any.keys()]) if (clash.has(id) || exists(id)) any.delete(id);
  if (!any.size && !Object.keys(byArea).length) return 0;
  let n = 0;
  const walk = o => {
    if (Array.isArray(o)) { o.forEach((v, i) => { if (typeof v === 'string' && any.has(v)) { o[i] = any.get(v); n++; } else if (v && typeof v === 'object') walk(v); }); return; }
    if (typeof o.a === 'string' && typeof o.id === 'string' && byArea[o.a]?.[o.id]) { o.id = byArea[o.a][o.id]; n++; }
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string' && any.has(v) && !(k === 'id' && typeof o.a === 'string')) { o[k] = any.get(v); n++; }
      else if (v && typeof v === 'object') walk(v);
      if (any.has(k) && !Object.hasOwn(o, any.get(k))) { o[any.get(k)] = o[k]; delete o[k]; n++; }
    }
  };
  walk(save);
  return n;
}

export function repairSave(save, D) {
  const fresh = newSave(D);
  if (!save || typeof save !== 'object' || save.version !== SAVE_VERSION) return fresh;
  followRenames(D, save);
  const s = { ...fresh, ...save, gifts: save.gifts || [] };   // a savegame from before a gift gets it (#048)
  if (!D.locations?.[s.location] && !s.map?.nodes?.some(n => n.id === s.location)) s.location = fresh.location;
  ensureMap(D, s);   // older savegames get their map here (#007)
  // a tractor that no longer exists: only the tractor is replaced, the containers, workshops and storages stay (Aufräumen 16.11.)
  if (!s.rig?.units?.length) s.rig = fresh.rig;
  else if (!D.tractors?.[s.rig.tractor]) { s.rig.tractor = fresh.rig.tractor; const t = s.rig.units.find(u => u.kind === 'tractor'); if (t) t.id = fresh.rig.tractor; }
  // retired containers (Modul-Anhänger, Daniel 13.11.2026) become their replacement, with the same workshops
  // #113: a retired fixed size (10-/40-Fuß) becomes the pullable container with its old length
  for (const u of s.rig.units) { const c = D.containers?.[u.id]; if (u.kind === 'container' && !u.pos && c?.retired && D.containers?.[c.replacedBy]) { if (D.containers[c.replacedBy].resize && u.places == null && c.places !== D.containers[c.replacedBy].places) u.places = c.places; u.id = c.replacedBy; } }
  if (s.rig.spare?.containers) s.rig.spare.containers = s.rig.spare.containers.map(id => D.containers?.[id]?.retired && D.containers?.[D.containers[id].replacedBy] ? D.containers[id].replacedBy : id);
  // containers that no longer exist leave the rig; everything keyed by unit index moves along, their storages are rehomed (Aufräumen 16.11.)
  removeUnits(D, s, s.rig.units.map((u, i) => (u.kind === 'tractor' || D.containers?.[u.id] ? -1 : i)).filter(i => i >= 0));
  // workshops that no longer exist: what lay in their storage is rehomed instead of being lost
  s.rig.units.forEach((u, ui) => { u.workshops = (u.workshops || []).filter(w => { if (D.workshops?.[w.id]) return true; for (const k of Object.keys(s.inv?.grids || {})) if (k === `store:${ui}:${w.at}` || k.startsWith(`store:${ui}:${w.at}:s`)) { const g = s.inv.grids[k]; delete s.inv.grids[k]; if (g?.items?.length) rehome(D, s, g); } return false; }); });
  refit(D, s);
  // stacks stay whole: a level is at most one above the unit before it, nothing stands on the tractor
  s.rig.units.forEach((u, i) => { const prev = s.rig.units[i - 1]; if (!u.level) { delete u.slot; return; } const max = !prev || prev.kind === 'tractor' ? 0 : (prev.level || 0) + 1; if (u.level > max) u.level = max; if (!u.level) { delete u.level; delete u.slot; } });   // a slot only counts on a stack
  const sp = s.rig.spare || {};
  // Daniel 19.11.2026: the old code lantern became the painted Laternenpfosten
  const merged = { laterne: 'kit_laterne' };
  for (const o of s.rig.decor || []) if (merged[o.id]) o.id = merged[o.id];
  if (sp.decor) sp.decor = sp.decor.map(id => merged[id] || id);
  s.rig.spare = { workshops: (sp.workshops || []).filter(w => D.workshops?.[w]), containers: (sp.containers || []).filter(c => D.containers?.[c]), parts: (sp.parts || []).filter(c => D.rigParts?.[c]), decor: (sp.decor || []).filter(c => D.decor?.[c]) };
  if (s.rig.decor) { compactDecor(s.rig, x => !D.decor?.[x.id] || !x.at); compactDecor(s.rig, x => x.at.ui != null && !s.rig.units[x.at.ui], { spare: true }); }   // #036, anchors stay right (Aufräumen 16.11.)
  // a mega rig (#029): every container on a free cell of its grid, the rest into the Lager; strings only between units that are there
  if (s.mega?.active && D.megarigs?.[s.mega.active] && D.tractors?.[s.rig.tractor]?.megarig) { settleMega(D, s); fixMegaLights(s); }
  else if (s.mega?.active) { if (D.tractors?.[s.mega.bay?.tractor]) deactivateMega(D, s); else s.mega.active = null; }   // the link broke in the data: back into the old rig from the bay (Aufräumen 16.11.)
  // rig parts were things in the inventory for a morning (08.11.2026): they move onto the scrapyard
  for (const g of Object.values(save.inv?.grids || {})) for (const e of [...(g.items || [])]) if (e.a === 'rigParts') { g.items.splice(g.items.indexOf(e), 1); if (D.rigParts?.[e.id]) for (let k = 0; k < (e.n || 1); k++) s.rig.spare.parts.push(e.id); }
  s.rig.parts = Object.fromEntries(Object.entries(s.rig.parts || {}).map(([k, l]) => [k, (l || []).map(id => D.rigParts?.[id]?.slot === k ? id : null)]));
  s.buffs = (s.buffs || []).filter(b => D.buffs?.[b]);
  if (s.look) { const n = (D.leyla?.signature?.colors || []).length; if (!(s.look.color >= 0 && s.look.color < n)) s.look.color = 0; s.look.unlocked = (s.look.unlocked || []).filter(i => i > 0 && i < n); }   // #044
  s.companions = (s.companions || []).filter(c => D.companions?.[c]);
  if (s.run && !D.pois?.[s.run.poi]) s.run = null;
  s.recipes = Array.isArray(save.recipes) ? [...new Set([...save.recipes.filter(r => D.recipes?.[r]), ...startRecipes(D)])] : fresh.recipes;
  if (save.inv === undefined) delete s.inv;   // older savegame: inventory from the start values
  if (!save.tank) delete s.tank;   // older savegame: the tank starts full at today's clock
  ensureTankInRig(D, s);
  return giftDeck(D, giftGlitchling(D, withInventory(D, s)));
}

// Daniel, 17.11.2026: „Kannst du mir einen Glitchling ins Inventar legen?“ (#048): once per savegame, Amber Slay (his unique one, the
// first of the Durchgang) as an Entity item into the cyberdeck (#049), else the backpack, else the Camp-Lager. Until catching comes (Stufe 1).
export const GIFT_GLITCHLING = 'glitchling_048';
// a new game starts without it (its Lager is tight); the gift is for savegames that were there before
const noGift = s => { s.gifts = [GIFT_GLITCHLING, GIFT_DECK]; return s; };
export function giftGlitchling(D, s, where = [DECK, 'backpack', 'camp']) {
  if (!D.items?.glitchling || !s.inv?.grids || (s.gifts || []).includes(GIFT_GLITCHLING)) return s;
  const g = generate(D, s.cycle || 1)[0];
  if (!g) return s;
  const left = where.reduce((n, k) => n && s.inv.grids[k] ? add(D, s.inv.grids[k], 'items', 'glitchling', 1, { g }) : n, 1);
  if (!left) s.gifts = [...(s.gifts || []), GIFT_GLITCHLING];
  return s;
}

// #049: a savegame from before gets a Bastler-Deck in the empty cyberdeck slot once, and its Entities move from backpack and
// Camp-Lager into the deck (as far as there is room)
export const GIFT_DECK = 'deck_049';
export function giftDeck(D, s) {
  if (!s.inv?.slots || (s.gifts || []).includes(GIFT_DECK)) return s;
  const deck = D.game?.start?.deck || 'bastlerdeck';
  if (!s.inv.slots.cyberdeck && deckSize(D, deck)) s.inv.slots.cyberdeck = deck;
  fitDeck(D, s.inv);
  const g = s.inv.grids[DECK];
  if (g) for (const k of ['backpack', CAMP]) for (const e of [...(s.inv.grids[k]?.items || [])]) if (e.g && addEntry(D, g, e, e.n) === 0) remove(s.inv.grids[k], e);
  s.gifts = [...(s.gifts || []), GIFT_DECK];
  return s;
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

// opens the savegame of a slot (#126). opts: slot (else this device's, game/slots.js › activeSlot), set (the Datenset a new slot
// begins with), be (a storage, else the worker or this browser). Achievements are global: they come in on loading and go out on saving.
export async function openSave(D, base = '', opts = {}) {
  const be = opts.be || await openStorage(base), n = opts.slot || activeSlot();
  let stored = null, time = null, G = null;
  try { ({ save: stored, time } = await be.get(n)); } catch (e) { console.warn('Spielstand nicht geladen:', e.message); }
  try { G = await be.blob('achievements'); } catch { G = null; }
  const learnt = s => {   // the global achievements into this slot, with the recipes they teach
    withGlobal(s, G);
    for (const id of Object.keys(s.achievements?.done || {})) { const rid = recipeOf(D, id); if (rid && Array.isArray(s.recipes) && !s.recipes.includes(rid)) s.recipes.push(rid); }
    return s;
  };
  const fresh = s => { s.set = opts.set ?? ''; s.name ??= `Leyla ${n}`; return s; };
  let clock = Date.now();
  const box = {
    where: be.where, time, slot: n, be,
    save: learnt(stored ? repairSave(stored, D) : fresh(repairSave(null, D))),
    fresh: !stored,
    error: null,
    seen: stored?.savedAt || 0,   // the newest stamp this tab knows (loaded or written itself)
    // what is stored right now (another tab or device may have written it) → raw save or null
    async stored() { return (await be.get(n)).save; },
    // a newer savegame from another tab or device wins over this (stale) tab: it is taken over instead of being overwritten
    // (Daniel, 13.11.2026: „die Lichterketten verschwinden weiterhin“; a second game tab, e.g. from the workshop's Spielen button,
    // still held the rig without them and wrote it back). → true when the stored one was taken over
    async adoptNewer() {
      let st = null;
      try { st = await box.stored(); } catch { return false; }
      if (!st?.savedAt || st.savedAt <= box.seen) return false;
      box.save = learnt(repairSave(st, D)); box.seen = st.savedAt;
      box.onAdopt?.(box.save);
      return true;
    },
    // write the savegame (online: KV per login, otherwise this browser); errors are kept, the game goes on
    async persist(force = false) {
      if (!force && await box.adoptNewer()) return box;
      const now = Date.now();
      box.save.playMs = (box.save.playMs || 0) + Math.min(10 * 60000, Math.max(0, now - clock)); clock = now;   // play time (an idle tab counts at most 10 min)
      box.save.savedAt = box.seen = Math.max(now, box.seen + 1);
      try {
        box.time = await be.put(n, box.save, slotMeta(D, box.save, n));
        const merged = mergeAchievements(G, box.save.achievements);
        if (JSON.stringify(merged) !== JSON.stringify(G)) { await be.setBlob('achievements', merged); G = merged; }
        box.error = null;
      } catch (e) { box.error = e.message; console.warn('Spielstand nicht gespeichert:', e.message); }
      return box;
    },
    // the slot's preview picture (#126, Frage F: a snapshot when the camp saves)
    async shot(dataUrl) { try { if (dataUrl) await be.setBlob(`shot${n}`, dataUrl); } catch (e) { console.warn('Vorschaubild nicht gespeichert:', e.message); } },
    // Neues Spiel on an occupied slot: the old one goes into the Vor-Lösch-Zustand first (Daniel 20.11.2026)
    async reset() {
      const { save: old } = await be.get(n).catch(() => ({ save: null }));
      if (old) await be.setBlob('trash', { slot: n, save: old, meta: slotMeta(D, old, n), why: 'überschrieben', at: Date.now() }).catch(() => {});
      box.save = learnt(fresh(newSave(D))); if (old?.name) box.save.name = old.name;   // a new game begins with this device's Datenset
      box.fresh = true; return box.persist(true);
    },
    async cycle() { const keep = { name: box.save.name, set: box.save.set, playMs: box.save.playMs }; box.save = learnt(Object.assign(newCycle(D, box.save), keep)); box.fresh = true; return box.persist(true); },
  };
  return box;
}

// the solar battery (#008, Daniel: „tagsüber + Akku“): every hour of sun the panels charge it, every dark hour they draw from it.
// save.solar = { charge (⚡·h), at (absolute hour) }. At night the panels only count while there is charge left.
export function solarState(D, save) {
  const S = D.camp?.solar || {}, n = (save.rig?.parts?.solar || []).filter(id => D.rigParts?.[id]?.slot === 'solar').length, per = S.power ?? 1;
  const [d0, d1] = S.day || [7, 19], cap = n * (S.battery ?? 6), now = (save.day || 1) * 24 + (save.hour || 0);
  const st = save.solar ??= { charge: cap / 2, at: now };
  for (let h = Math.max(st.at, now - 72); h < now; h += 1) { const hr = ((h % 24) + 24) % 24, sun = hr >= d0 && hr < d1, step = Math.min(1, now - h); st.charge = Math.max(0, Math.min(cap, st.charge + (sun ? 1 : -1) * n * per * step)); }
  st.at = now;
  const hr = save.hour || 0, sun = hr >= d0 && hr < d1;
  return { panels: n, sun, charge: Math.round(st.charge * 10) / 10, capacity: cap, live: sun || st.charge > 0 ? n * per : 0, made: n * per };
}


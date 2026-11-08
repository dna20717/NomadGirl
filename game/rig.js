// Building the rig (Rig bauen 2.0): pure logic, browser and Node, no DOM. Interface: game/play/build_mode.js (right in the camp).
// Values from the area "Rig-Bau" (data/build.json), prices = "Wert" of workshops and containers.
//
// The rig in the savegame: save.rig = { tractor, units: [{ kind: 'tractor' | 'container', id, workshops: [{ id, at }] }], spare: { workshops: [id], containers: [id] } }
//   units[0] is the tractor (its own places, the van: sleeping bunk + war room), then the containers in order (camp: from the van to the left).
//   spare = bought or removed things that are not built in ("Lager" in the build view).
// Every action is a small draft (startDraft → op → applyDraft, all in act()): Δ, the clock, and the storage grids follow their workshop.
// "Rückgängig" puts a snapshot back (snapshot/restore).
// Stacks (Daniel, 08.11.2026): units are still one flat list; a stacked container has "level" (1 = on the roof of the one below)
// and follows right after its base. A ground unit with everything stacked on it is a "block"; blocks move together.
// Budgets: weight of the containers ≤ pull of the tractor (else no driving), number of ground containers ≤ "Plätze hintereinander",
// levels < "Stapelhöhe",
// energy: tractor "Lichtmaschine" + workshops with + minus workshops with − (below 0: workshops that need power do not work).
import { containers as storeList, advance, ensureGrid } from './save.js';
import { canResize } from './inventory.js';

const clone = x => JSON.parse(JSON.stringify(x));
export const B = D => D.build || {};
export const wsDef = (D, id) => D.workshops?.[id] || {};
export const placesOf = (D, u) => (u.kind === 'tractor' ? D.tractors?.[u.id]?.places : D.containers?.[u.id]?.places) || 0;
export const priceOf = (D, area, id) => D[area]?.[id]?.value || 0;
export const sellPrice = (D, area, id) => Math.round(priceOf(D, area, id) * (B(D).sellFactor ?? 50) / 100);

// grids that belong to the rig (they move with their workshop or unit and come back with "Rückgängig")
const rigGrid = k => k.startsWith('store:') || k.startsWith('rig:');

// ---------- rig parts in the tractor's slots (Inventar › Van) ----------
export const SLOT_ORDER = ['engine', 'armor', 'weapon', 'roof'];
export const slotCount = (D, rig, slot) => D.tractors?.[rig.tractor]?.slots?.[slot] || 0;
// all slots of the tractor: [{ slot, i, id }]
export function partSlots(D, rig) {
  const out = [];
  for (const slot of SLOT_ORDER) for (let i = 0; i < slotCount(D, rig, slot); i++) out.push({ slot, i, id: rig.parts?.[slot]?.[i] || null });
  return out;
}
export const partsIn = (D, rig) => partSlots(D, rig).map(p => p.id).filter(Boolean);
// what the rig parts add up to
export function partStats(D, rig) {
  const s = { pull: 0, fuelUse: 0, armor: 0, damage: 0, storageRows: 0 };
  for (const id of partsIn(D, rig)) { const p = D.rigParts?.[id] || {}; for (const k of Object.keys(s)) s[k] += p[k] || 0; }
  return s;
}
// how many rows the parts add to the tractor's own storage (Dachbox)
export const extraRows = (D, parts) => Object.values(parts || {}).flat().reduce((n, id) => n + (D.rigParts?.[id]?.storageRows || 0), 0);

// rig parts are building parts like workshops (Daniel, 08.11.2026): bought ones and taken out ones lie on the scrapyard (rig.spare.parts),
// in the build mode they are dragged onto the sockets on the van. Every action is a draft op (act).
// from = { yard: index in spare.parts } or { slot, i } (another socket). A taken socket: its part goes onto the scrapyard (or swaps sockets).
export function mountPart(D, d, slot, i, from) {
  const P = (d.rig.parts ??= {}), list = (P[slot] ??= []), yard = d.rig.spare.parts;
  const id = from.yard != null ? yard[from.yard] : P[from.slot]?.[from.i];
  const def = D.rigParts?.[id];
  if (!def) return { ok: false, reason: 'Weg' };
  if (def.slot !== slot) return { ok: false, reason: `${def.name || id} gehört an ${SLOT_NAMES[def.slot] || def.slot}` };
  if (i >= slotCount(D, d.rig, slot)) return { ok: false, reason: 'Diesen Platz hat die Zugmaschine nicht' };
  if (from.slot === slot && from.i === i) return { ok: false, same: true, reason: 'Sitzt schon da' };
  const there = list[i] || null;
  if (from.yard != null) { yard.splice(from.yard, 1); if (there) yard.push(there); }
  else P[from.slot][from.i] = there;
  list[i] = id;
  spend(D, d, 0, M(D, 'part', 30));
  return { ok: true, swapped: there };
}
// a socket's part onto the scrapyard
export function unmountPart(D, d, slot, i) {
  const id = d.rig.parts?.[slot]?.[i];
  if (!id) return { ok: false, reason: 'Leer' };
  d.rig.parts[slot][i] = null;
  d.rig.spare.parts.push(id);
  spend(D, d, 0, M(D, 'part', 30));
  return { ok: true };
}
export function buyPart(D, d, id) {
  const price = priceOf(D, 'rigParts', id);
  if (!D.rigParts?.[id]) return { ok: false, reason: 'Unbekannt' };
  if (price > d.deltas) return { ok: false, reason: 'Zu wenig Δ' };
  d.rig.spare.parts.push(id);
  spend(D, d, price, M(D, 'buy', 60));
  return { ok: true };
}
export function sellPart(D, d, i) {
  const id = d.rig.spare.parts[i];
  if (!id) return { ok: false, reason: 'Liegt nicht auf dem Schrottplatz' };
  d.rig.spare.parts.splice(i, 1);
  spend(D, d, -sellPrice(D, 'rigParts', id), 0);
  return { ok: true };
}
export const SLOT_NAMES = { engine: 'Motor', armor: 'Panzerung', weapon: 'Waffe', roof: 'Dach' };

// what can be bought: workshops of the allowed stages (Rig-Bau › Kaufbar), all containers, all rig parts
export function shop(D) {
  const stages = B(D).stages || ['mvp', '1'];
  return {
    workshops: Object.entries(D.workshops || {}).filter(([, w]) => stages.includes(w.stage || 'mvp') && (w.value || 0) > 0).map(([id]) => id),
    containers: Object.entries(D.containers || {}).filter(([, c]) => (c.value || 0) > 0).map(([id]) => id),
    rigParts: Object.entries(D.rigParts || {}).filter(([, c]) => (c.value || 0) > 0).map(([id]) => id),
  };
}

// ---------- stacks ----------
export const levelOf = u => u?.level || 0;
// the block of unit ui: [start, end) (start = its ground unit)
export function blockAt(U, ui) {
  let a = ui; while (a > 0 && levelOf(U[a]) > 0) a--;
  let b = a + 1; while (b < U.length && levelOf(U[b]) > 0) b++;
  return [a, b];
}
// is something standing on unit ui?
export const hasAbove = (U, ui) => levelOf(U[ui + 1]) > levelOf(U[ui]) && ui + 1 < U.length && levelOf(U[ui + 1]) > 0;
export const maxStack = (D, rig) => Math.max(1, D.tractors?.[rig.tractor]?.stack ?? 1);
// can something be stacked on the block of unit ui? → the top unit or a reason
export function stackTop(D, rig, ui) {
  const U = rig.units, [, b] = blockAt(U, ui), top = U[b - 1];
  if (!top || top.kind === 'tractor') return { reason: 'Auf die Zugmaschine kommt nichts' };
  if (!D.containers?.[top.id]?.carries) return { reason: `Auf ${D.containers?.[top.id]?.name || top.id} kann nichts stehen` };
  if (levelOf(top) + 1 >= maxStack(D, rig)) return { reason: `${D.tractors?.[rig.tractor]?.name || 'Die Zugmaschine'} stapelt höchstens ${maxStack(D, rig)} hoch` };
  return { top, end: b };
}
// takes a unit out of the rig: a ground unit with its whole block, a stacked one only if nothing stands on it. → { units } or { reason }
function takeOut(U, ui) {
  if (levelOf(U[ui]) > 0) {
    if (hasAbove(U, ui)) return { reason: 'Erst den Container darüber abnehmen' };
    const [u] = U.splice(ui, 1);
    return { units: [u] };
  }
  const [a, b] = blockAt(U, ui);
  return { units: U.splice(a, b - a) };
}

export function budgets(D, rig) {
  const T = D.tractors?.[rig.tractor] || {}, Tr = D.travel || {}, P = partStats(D, rig), pull = (T.pull || 0) + P.pull;
  const conts = rig.units.filter(u => u.kind === 'container'), ground = conts.filter(u => !levelOf(u));
  const weight = conts.reduce((n, u) => n + (D.containers?.[u.id]?.weight || 0), 0);
  let made = T.power || 0, used = 0;
  for (const u of rig.units) for (const w of u.workshops) { const p = wsDef(D, w.id).power || 0; if (p > 0) made += p; else used -= p; }
  const fuel = Math.round(((T.fuelUse ?? 12) + P.fuelUse) * (1 + (Tr.weightFuelFactor ?? 0) / 100 * weight / 1000) * 10) / 10;
  const places = rig.units.reduce((n, u) => n + placesOf(D, u), 0), filled = rig.units.reduce((n, u) => n + u.workshops.reduce((k, w) => k + (wsDef(D, w.id).places || 1), 0), 0);
  return { weight, pull, heavy: weight > pull, armor: P.armor, damage: P.damage, length: ground.length, maxLength: T.length ?? 0, stack: Math.max(1, T.stack ?? 1), height: Math.max(1, ...conts.map(u => levelOf(u) + 1)), power: { made, used, net: made - used }, fuel, places, filled };
}

// ---------- the draft ----------
// every workshop gets a uid; storage workshops remember their grid key (to carry their contents along)
export function startDraft(D, save) {
  const rig = clone(save.rig);
  rig.spare ??= { workshops: [], containers: [] };
  rig.spare.parts ??= [];
  rig.parts ??= {};
  let uid = 0;
  rig.units.forEach((u, ui) => { u.key = `rig:${ui}`; });
  rig.units.forEach((u, ui) => u.workshops.forEach(w => { w.uid = ++uid; w.home = `${ui}:${w.at}`; if (wsDef(D, w.id).grid) w.key = `store:${ui}:${w.at}`; }));
  rig.spare.workshops = rig.spare.workshops.map(w => typeof w === 'string' ? { id: w, uid: ++uid } : { ...w, uid: ++uid });
  return { rig, deltas: save.deltas, minutes: 0, uid, changes: 0, grids: save.inv?.grids || {} };
}
const spend = (D, d, n, minutes) => { d.deltas -= n; d.minutes += minutes ?? 0; d.changes++; };
const M = (D, k, def) => B(D).minutes?.[k] ?? def;

// free run of places in a unit for a workshop needing n places at `at` (skip = an instance ignored)
export function fits(D, rig, ui, at, id, skip = null) {
  const u = rig.units[ui], need = wsDef(D, id).places || 1;
  if (!u || at < 0 || at + need > placesOf(D, u)) return false;
  for (const w of u.workshops) {
    if (w === skip) continue;
    const a = w.at, b = w.at + (wsDef(D, w.id).places || 1);
    if (at < b && a < at + need) return false;
  }
  return true;
}
export function at(D, rig, ui, place) { return rig.units[ui]?.workshops.find(w => place >= w.at && place < w.at + (wsDef(D, w.id).places || 1)) || null; }

// takes a built-in workshop out (into the hand); → the instance
export function lift(D, d, ui, place) {
  const u = d.rig.units[ui], w = at(D, d.rig, ui, place);
  if (!w) return null;
  u.workshops.splice(u.workshops.indexOf(w), 1);
  return w;
}
// puts a workshop instance into a unit at a place; → ok. Every placement costs "Werkstatt umstellen" minutes (unless back where it was)
export function place(D, d, inst, ui, p, { free = false } = {}) {
  if (!fits(D, d.rig, ui, p, inst.id)) return false;
  d.rig.units[ui].workshops.push(inst);
  inst.at = p;
  if (!free && inst.home !== `${ui}:${p}`) spend(D, d, 0, M(D, 'move', 30));
  return true;
}
export function toSpare(d, inst) { d.rig.spare.workshops.push(inst); }
// take a workshop out onto the scrapyard: costs the time for moving it
export function stow(D, d, inst) { toSpare(d, inst); spend(D, d, 0, M(D, 'move', 30)); return { ok: true }; }
export function fromSpare(d, uid) { const i = d.rig.spare.workshops.findIndex(w => w.uid === uid); return i < 0 ? null : d.rig.spare.workshops.splice(i, 1)[0]; }

// a storage workshop with things inside cannot be sold or left out of the rig
export const storeFull = (d, inst) => !!(inst.key && d.grids[inst.key]?.items?.length);

export function buyWorkshop(D, d, id) {
  const price = priceOf(D, 'workshops', id);
  if (!D.workshops?.[id]) return { ok: false, reason: 'Unbekannt' };
  if (price > d.deltas) return { ok: false, reason: 'Zu wenig Δ' };
  const inst = { id, uid: ++d.uid };
  d.rig.spare.workshops.push(inst);
  spend(D, d, price, M(D, 'buy', 60));
  return { ok: true, inst };
}
export function sellWorkshop(D, d, uid) {
  const inst = d.rig.spare.workshops.find(w => w.uid === uid);
  if (!inst) return { ok: false, reason: 'Liegt nicht im Lager' };
  if (storeFull(d, inst)) return { ok: false, reason: 'Erst ausräumen' };
  fromSpare(d, uid);
  spend(D, d, -sellPrice(D, 'workshops', inst.id), 0);
  return { ok: true };
}
export function buyContainer(D, d, id) {
  const price = priceOf(D, 'containers', id);
  if (!D.containers?.[id]) return { ok: false, reason: 'Unbekannt' };
  if (price > d.deltas) return { ok: false, reason: 'Zu wenig Δ' };
  d.rig.spare.containers.push(id);
  spend(D, d, price, M(D, 'buy', 60));
  return { ok: true };
}
export function sellContainer(D, d, i) {
  const id = d.rig.spare.containers[i];
  if (!id) return { ok: false, reason: 'Liegt nicht im Lager' };
  d.rig.spare.containers.splice(i, 1);
  spend(D, d, -sellPrice(D, 'containers', id), 0);
  return { ok: true };
}
// hang a spare container at the end of the rig (left in the camp); limited by the tractor's "Plätze hintereinander"
export function attach(D, d, i) {
  const id = d.rig.spare.containers[i], b = budgets(D, d.rig);
  if (!id) return { ok: false, reason: 'Liegt nicht im Lager' };
  if (b.length >= b.maxLength) return { ok: false, reason: `Die Zugmaschine zieht höchstens ${b.maxLength} Container` };
  d.rig.spare.containers.splice(i, 1);
  d.rig.units.push({ kind: 'container', id, workshops: [] });
  spend(D, d, 0, M(D, 'container', 90));
  return { ok: true };
}
// take a container off: only when it is empty (its workshops go into the "Lager" first)
export function detach(D, d, ui) {
  const u = d.rig.units[ui];
  if (!u || u.kind !== 'container') return { ok: false, reason: 'Das ist kein Container' };
  if (hasAbove(d.rig.units, ui)) return { ok: false, reason: 'Erst den Container oben abnehmen' };
  if (u.workshops.length) return { ok: false, reason: 'Erst die Werkstätten ausbauen' };
  if (d.grids[u.key]?.items?.length) return { ok: false, reason: `Erst den ${D.containers?.[u.id]?.storageName || 'Deichselkasten'} ausräumen` };
  d.rig.units.splice(ui, 1);
  d.rig.spare.containers.push(u.id);
  spend(D, d, 0, M(D, 'container', 90));
  return { ok: true };
}
// change the order of the containers (dir -1 = towards the tractor)
export function shift(D, d, ui, dir) {
  const j = ui + dir, U = d.rig.units;
  if (!U[ui] || U[ui].kind !== 'container' || !U[j] || U[j].kind !== 'container') return { ok: false };
  [U[ui], U[j]] = [U[j], U[ui]];
  spend(D, d, 0, M(D, 'container', 90));
  return { ok: true };
}
// hang a spare container in at gap `at` (a unit index where a block starts, 1 = right behind the tractor, units.length = at the end)
export function attachAt(D, d, i, at) {
  const id = d.rig.spare.containers[i], b = budgets(D, d.rig), U = d.rig.units;
  if (!id) return { ok: false, reason: 'Liegt nicht im Lager' };
  if (b.length >= b.maxLength) return { ok: false, reason: `${D.tractors?.[d.rig.tractor]?.name || 'Die Zugmaschine'} zieht höchstens ${b.maxLength} Anhänger` };
  d.rig.spare.containers.splice(i, 1);
  U.splice(blockStart(U, at), 0, { kind: 'container', id, workshops: [] });
  spend(D, d, 0, M(D, 'container', 90));
  return { ok: true };
}
// a gap index snapped to the start of a block (never inside a stack, never before the tractor)
const blockStart = (U, at) => { let g = Math.max(1, Math.min(U.length, at)); while (g < U.length && levelOf(U[g]) > 0) g++; return g; };
// move a built-in container into the gap `gap` (gap g = in front of the block starting at g, units.length = at the end):
// a ground unit takes its stack along, a stacked one comes down onto the ground; same place = nothing happens
export function moveContainer(D, d, ui, gap) {
  const U = d.rig.units, u = U[ui];
  if (!u || u.kind !== 'container') return { ok: false, reason: 'Das ist kein Anhänger' };
  const wasStacked = levelOf(u) > 0, b = budgets(D, d.rig);
  if (wasStacked && b.length >= b.maxLength) return { ok: false, reason: `${D.tractors?.[d.rig.tractor]?.name || 'Die Zugmaschine'} zieht höchstens ${b.maxLength} Anhänger` };
  const g = blockStart(U, gap), target = U[g] || null, [a, e] = blockAt(U, ui);
  if (!wasStacked && (g === a || g === e)) return { ok: false, reason: 'Steht schon da', same: true };
  const t = takeOut(U, ui);
  if (t.reason) return { ok: false, reason: t.reason };
  const shift = t.units[0].level || 0;
  for (const x of t.units) x.level = (x.level || 0) - shift || undefined;
  const at = target ? U.indexOf(target) : U.length;
  U.splice(at, 0, ...t.units);
  spend(D, d, 0, M(D, 'container', 90));
  return { ok: true };
}
// stack a container onto the block of unit `onto`: from = { spare: i } (scrapyard) or { ui } (a container in the rig without anything on it)
export function stackOn(D, d, from, onto) {
  const U = d.rig.units, st = stackTop(D, d.rig, onto);
  if (st.reason) return { ok: false, reason: st.reason };
  const id = from.spare != null ? d.rig.spare.containers[from.spare] : U[from.ui]?.id, def = D.containers?.[id];
  if (!def) return { ok: false, reason: 'Weg' };
  if (!def.stackable) return { ok: false, reason: `${def.name || id} lässt sich nicht stapeln` };
  let unit;
  if (from.spare != null) { d.rig.spare.containers.splice(from.spare, 1); unit = { kind: 'container', id, workshops: [] }; }
  else {
    const [a, b] = blockAt(U, from.ui);
    if (onto >= a && onto < b) return { ok: false, reason: 'Steht schon da', same: true };
    if (hasAbove(U, from.ui)) return { ok: false, reason: 'Erst den Container darüber abnehmen' };
    unit = takeOut(U, from.ui).units[0];
  }
  const top = st.top, at = U.indexOf(top) + 1;
  unit.level = levelOf(top) + 1;
  U.splice(at, 0, unit);
  spend(D, d, 0, M(D, 'stack', M(D, 'container', 90)));
  return { ok: true };
}

// ---------- building right away (Rig bauen 2.0): every action is a small draft that is applied at once ----------
// act(D, save, d => op(...)) → { ok, reason, minutes, deltas }; nothing changes when the action fails or leaves problems
export function act(D, save, fn) {
  const d = startDraft(D, save), r = fn(d) || { ok: true };
  if (r.ok === false) return r;
  if (!d.changes) return { ok: false, reason: r.reason || 'Nichts geändert', same: true };
  const before = save.deltas, a = applyDraft(D, save, d);
  return a.ok ? { ...r, ok: true, minutes: a.minutes, deltas: save.deltas - before } : a;
}
// snapshot for "Rückgängig": rig, Δ, clock and the storage grids
export function snapshot(save) {
  return JSON.parse(JSON.stringify({ rig: save.rig, deltas: save.deltas, day: save.day, hour: save.hour, grids: save.inv.grids }));
}
export function restore(save, snap) {
  const s = JSON.parse(JSON.stringify(snap));
  save.rig = s.rig; save.deltas = s.deltas; save.day = s.day; save.hour = s.hour;
  save.inv.grids = s.grids;
  return save;
}

// can the draft be built? → list of reasons (empty = yes)
export function problems(D, d) {
  const out = [];
  for (const w of d.rig.spare.workshops) if (storeFull(d, w)) out.push(`${wsDef(D, w.id).name || w.id} ist nicht leer und muss eingebaut bleiben`);
  if (d.deltas < 0) out.push('Zu wenig Δ');
  // the Dachbox comes off: the Kofferraum shrinks, nothing may fall out
  const S = D.tractors?.[d.rig.tractor]?.storage, g = d.grids['rig:0'];
  if (S?.[0] && g && !canResize(D, g, S[0], S[1] + extraRows(D, d.rig.parts))) out.push(`Erst den ${D.tractors[d.rig.tractor].storageName || 'Kofferraum'} ausräumen, sonst fällt etwas raus`);
  return out;
}

// writes the draft into the savegame: rig, Δ, clock; storage grids move with their workshop (new keys), new storages get empty grids
export function applyDraft(D, save, d) {
  const bad = problems(D, d);
  if (bad.length) return { ok: false, reason: bad[0] };
  const old = save.inv.grids, grids = {};
  for (const [k, g] of Object.entries(old)) if (!rigGrid(k)) grids[k] = g;
  const rig = { tractor: d.rig.tractor, units: d.rig.units.map(u => ({ kind: u.kind, id: u.id, ...(u.level ? { level: u.level } : {}), workshops: u.workshops.map(w => ({ id: w.id, at: w.at })) })),
    spare: { workshops: d.rig.spare.workshops.map(w => w.id), containers: [...d.rig.spare.containers], parts: [...d.rig.spare.parts] }, parts: clone(d.rig.parts || {}) };
  d.rig.units.forEach((u, ui) => u.workshops.forEach(w => { if (w.key && old[w.key]) grids[`store:${ui}:${w.at}`] = old[w.key]; }));
  d.rig.units.forEach((u, ui) => { if (u.key && old[u.key]) grids[`rig:${ui}`] = old[u.key]; });
  save.rig = rig;
  save.inv.grids = grids;
  save.deltas = d.deltas;
  for (const c of storeList(D, save)) ensureGrid(D, save.inv, c.key, c.size);
  if (d.minutes) advance(save, d.minutes / 60);
  return { ok: true, minutes: d.minutes };
}

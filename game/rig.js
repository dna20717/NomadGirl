// Building the rig (Rig bauen 2.0): pure logic, browser and Node, no DOM. Interface: game/play/build_mode.js (right in the camp).
// Values from the area "Rig-Bau" (data/build.json), prices = "Wert" of workshops and containers.
//
// The rig in the savegame: save.rig = { tractor, units: [{ kind: 'tractor' | 'container', id, workshops: [{ id, at }] }], spare: { workshops: [id], containers: [id] } }
//   units[0] is the tractor (its own places, the van: sleeping bunk + war room), then the containers in order (camp: from the van to the left).
//   spare = bought or removed things that are not built in ("Lager" in the build view).
// Every action is a small draft (startDraft → op → applyDraft, all in act()): Δ, the clock, and the storage grids follow their workshop.
// "Rückgängig" puts a snapshot back (snapshot/restore).
// Budgets: weight of the containers ≤ pull of the tractor (else no driving), number of containers ≤ "Plätze hintereinander",
// energy: tractor "Lichtmaschine" + workshops with + minus workshops with − (below 0: workshops that need power do not work).
import { containers as storeList, advance, ensureGrid } from './save.js';

const clone = x => JSON.parse(JSON.stringify(x));
export const B = D => D.build || {};
export const wsDef = (D, id) => D.workshops?.[id] || {};
export const placesOf = (D, u) => (u.kind === 'tractor' ? D.tractors?.[u.id]?.places : D.containers?.[u.id]?.places) || 0;
export const priceOf = (D, area, id) => D[area]?.[id]?.value || 0;
export const sellPrice = (D, area, id) => Math.round(priceOf(D, area, id) * (B(D).sellFactor ?? 50) / 100);

// what can be bought: workshops of the allowed stages (Rig-Bau › Kaufbar), all containers
export function shop(D) {
  const stages = B(D).stages || ['mvp', '1'];
  return {
    workshops: Object.entries(D.workshops || {}).filter(([, w]) => stages.includes(w.stage || 'mvp') && (w.value || 0) > 0).map(([id]) => id),
    containers: Object.entries(D.containers || {}).filter(([, c]) => (c.value || 0) > 0).map(([id]) => id),
  };
}

export function budgets(D, rig) {
  const T = D.tractors?.[rig.tractor] || {}, Tr = D.travel || {};
  const conts = rig.units.filter(u => u.kind === 'container');
  const weight = conts.reduce((n, u) => n + (D.containers?.[u.id]?.weight || 0), 0);
  let made = T.power || 0, used = 0;
  for (const u of rig.units) for (const w of u.workshops) { const p = wsDef(D, w.id).power || 0; if (p > 0) made += p; else used -= p; }
  const fuel = Math.round((T.fuelUse ?? 12) * (1 + (Tr.weightFuelFactor ?? 0) / 100 * weight / 1000) * 10) / 10;
  const places = rig.units.reduce((n, u) => n + placesOf(D, u), 0), filled = rig.units.reduce((n, u) => n + u.workshops.reduce((k, w) => k + (wsDef(D, w.id).places || 1), 0), 0);
  return { weight, pull: T.pull || 0, heavy: weight > (T.pull || 0), length: conts.length, maxLength: T.length ?? 0, power: { made, used, net: made - used }, fuel, places, filled };
}

// ---------- the draft ----------
// every workshop gets a uid; storage workshops remember their grid key (to carry their contents along)
export function startDraft(D, save) {
  const rig = clone(save.rig);
  rig.spare ??= { workshops: [], containers: [] };
  let uid = 0;
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
  if (u.workshops.length) return { ok: false, reason: 'Erst die Werkstätten ausbauen' };
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
// hang a spare container in at unit index `at` (1 = right behind the tractor, units.length = at the end)
export function attachAt(D, d, i, at) {
  const id = d.rig.spare.containers[i], b = budgets(D, d.rig), U = d.rig.units;
  if (!id) return { ok: false, reason: 'Liegt nicht im Lager' };
  if (b.length >= b.maxLength) return { ok: false, reason: `${D.tractors?.[d.rig.tractor]?.name || 'Die Zugmaschine'} zieht höchstens ${b.maxLength} Anhänger` };
  d.rig.spare.containers.splice(i, 1);
  U.splice(Math.max(1, Math.min(U.length, at)), 0, { kind: 'container', id, workshops: [] });
  spend(D, d, 0, M(D, 'container', 90));
  return { ok: true };
}
// move a built-in container into the gap `gap` (gap g = in front of unit g, units.length = at the end); same place = nothing happens
export function moveContainer(D, d, ui, gap) {
  const U = d.rig.units, u = U[ui];
  if (!u || u.kind !== 'container') return { ok: false, reason: 'Das ist kein Anhänger' };
  U.splice(ui, 1);
  const at = Math.max(1, Math.min(U.length, gap > ui ? gap - 1 : gap));
  U.splice(at, 0, u);
  if (at === ui) return { ok: false, reason: 'Steht schon da', same: true };
  spend(D, d, 0, M(D, 'container', 90));
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
  return JSON.parse(JSON.stringify({ rig: save.rig, deltas: save.deltas, day: save.day, hour: save.hour, grids: Object.fromEntries(Object.entries(save.inv.grids).filter(([k]) => k.startsWith('store:'))) }));
}
export function restore(save, snap) {
  const s = JSON.parse(JSON.stringify(snap));
  save.rig = s.rig; save.deltas = s.deltas; save.day = s.day; save.hour = s.hour;
  for (const k of Object.keys(save.inv.grids)) if (k.startsWith('store:')) delete save.inv.grids[k];
  Object.assign(save.inv.grids, s.grids);
  return save;
}

// can the draft be built? → list of reasons (empty = yes)
export function problems(D, d) {
  const out = [];
  for (const w of d.rig.spare.workshops) if (storeFull(d, w)) out.push(`${wsDef(D, w.id).name || w.id} ist nicht leer und muss eingebaut bleiben`);
  if (d.deltas < 0) out.push('Zu wenig Δ');
  return out;
}

// writes the draft into the savegame: rig, Δ, clock; storage grids move with their workshop (new keys), new storages get empty grids
export function applyDraft(D, save, d) {
  const bad = problems(D, d);
  if (bad.length) return { ok: false, reason: bad[0] };
  const old = save.inv.grids, grids = {};
  for (const [k, g] of Object.entries(old)) if (!k.startsWith('store:')) grids[k] = g;
  const rig = { tractor: d.rig.tractor, units: d.rig.units.map(u => ({ kind: u.kind, id: u.id, workshops: u.workshops.map(w => ({ id: w.id, at: w.at })) })),
    spare: { workshops: d.rig.spare.workshops.map(w => w.id), containers: [...d.rig.spare.containers] } };
  d.rig.units.forEach((u, ui) => u.workshops.forEach(w => { if (w.key && old[w.key]) grids[`store:${ui}:${w.at}`] = old[w.key]; }));
  save.rig = rig;
  save.inv.grids = grids;
  save.deltas = d.deltas;
  for (const c of storeList(D, save)) ensureGrid(D, save.inv, c.key, c.size);
  if (d.minutes) advance(save, d.minutes / 60);
  return { ok: true, minutes: d.minutes };
}

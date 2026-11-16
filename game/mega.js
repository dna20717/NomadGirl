// Driving a mega rig (#029, Daniel 15.11.2026: Crawler and Fatbird as the base; the old rig goes into the loading bay, its
// workshops move aboard; camp on board, build mode on the grid, budgets, travel; no crew yet). Pure logic, browser and Node.
//
// The rig stays the one model of workshops, storages, power and weight (game/rig.js): in a mega rig the tractor is the vehicle
// (Zugmaschinen › Mega-Rig), and every container carries a place on its grid instead of a spot in the chain:
//   save.rig.units[i].pos = { place, story }      (no level/slot: the grid says where it stands)
//   save.mega = { active: null | '<megarig id>', stage: { <id>: n }, bay: { tractor, parts } | null, lights: [{ from, fromCorner, to, toCorner }] }
// Stories inside the hull hold rooms (a container without its skin), the frame of the fatbird and the stories on top hold containers.
// Module number = unit index (units[0] is the tractor), so string lights point at units.
import { buildMegarig } from '../engine/megarig.js';
import { swapTractor } from './save.js';
import { removeUnits, reindexUnits, rehome } from './reindex.js';
import { fitContainers } from './save.js';
import { addEntry, newGrid } from './inventory.js';

const clone = x => JSON.parse(JSON.stringify(x));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

export const mstate = save => { const m = (save.mega ??= {}); m.stage ??= {}; m.lights ??= []; return m; };
// the mega rig the player lives in right now (or null: the normal rig)
export const activeMega = (D, save) => { const id = save?.mega?.active; return id && D.megarigs?.[id] ? id : null; };
export const owned = save => save?.megarigs || [];
export const stageOf = (D, save, id = activeMega(D, save)) => Math.max(0, Math.min((D.megarigs?.[id]?.stages?.length || 1) - 1, num(save?.mega?.stage?.[id], 0)));

// the grid of a mega rig at a stage: places, stories, which stories lie in the hull, the frame (fatbird)
export function grid(D, id, stage) {
  const V = D.megarigs?.[id];
  if (!V) return null;
  const H = V.hull || {}, st = V.stages?.[stage] || V.stages?.[0] || { mids: 1, top: 1 };
  const inside = num(H.inside, 1), frames = num(H.frame, 0), places = Math.max(0, num(st.mids, 1)) * num(H.segPlaces, 2);
  return { places, stories: inside + Math.max(0, num(st.top, 1)), inside, frames, kind: V.kind };
}
const cont = (D, u) => D.containers?.[u.id] || {};
const width = (D, u) => cont(D, u).places || 1;
// rooms in the hull have no skin; containers in the fatbird's frame and on top keep theirs
export const shellAt = (g, story) => story < g.frames || story >= g.inside;

// which unit stands on which cell: Map "story:place" → unit index
export function cells(D, rig, skip = -1) {
  const out = new Map();
  rig.units.forEach((u, ui) => {
    if (ui === skip || u.kind !== 'container' || !u.pos) return;
    for (let k = 0; k < width(D, u); k++) out.set(`${u.pos.story}:${u.pos.place + k}`, ui);
  });
  return out;
}
// may unit ui (or a container of type id) stand at place/story in this rig (also a draft)? → reason or null
export function fitsGrid(D, g, rig, ui, place, story, id = rig.units[ui]?.id) {
  const n = D.containers?.[id]?.places || 1;
  if (!g) return 'Kein Mega-Rig';
  if (place < 0 || story < 0 || place + n > g.places || story >= g.stories) return 'Außerhalb des Rasters';
  const taken = cells(D, rig, ui);
  for (let k = 0; k < n; k++) if (taken.has(`${story}:${place + k}`)) return 'Da steht schon etwas';
  // on top of the hull a container needs something to stand on (and a way up): the deck, or a container under part of it
  if (story > g.inside && ![...Array(n)].some((_, k) => taken.has(`${story - 1}:${place + k}`))) return 'Darunter steht nichts';
  return null;
}
export const gridNow = (D, save) => { const id = activeMega(D, save); return id ? grid(D, id, stageOf(D, save, id)) : null; };
export const canPut = (D, save, ui, place, story, id = save.rig.units[ui]?.id) => fitsGrid(D, gridNow(D, save), save.rig, ui, place, story, id);

// ---------- building on the grid (drafts of game/rig.js: startDraft → op → applyDraft, via act()) ----------
const work = (D, d, k, def) => { d.changes++; d.minutes += D.build?.minutes?.[k] ?? def; };
// a container from the Lager onto a cell
export function putFromSpare(D, save, d, i, place, story) {
  const id = d.rig.spare.containers[i], why = id ? fitsGrid(D, gridNow(D, save), d.rig, -1, place, story, id) : 'Liegt nicht im Lager';
  if (why) return { ok: false, reason: why };
  d.rig.spare.containers.splice(i, 1);
  d.rig.units.push({ kind: 'container', id, workshops: [], pos: { place, story } });
  work(D, d, 'container', 90);
  return { ok: true, ui: d.rig.units.length - 1 };
}
// a built container to another cell (its workshops and storages move along); everything that stood on it must still stand
export function moveTo(D, save, d, ui, place, story) {
  const u = d.rig.units[ui], g = gridNow(D, save);
  if (!u?.pos) return { ok: false, reason: 'Das ist kein Container' };
  const why = fitsGrid(D, g, d.rig, ui, place, story);
  if (why) return { ok: false, reason: why };
  const was = u.pos;
  u.pos = { place, story };
  const loose = d.rig.units.findIndex((x, xi) => xi !== ui && x.pos && x.pos.story > g.inside && fitsGrid(D, g, d.rig, xi, x.pos.place, x.pos.story));
  if (loose >= 0) { u.pos = was; return { ok: false, reason: 'Darauf steht noch etwas' }; }
  work(D, d, 'container', 90);
  return { ok: true };
}
// a built container into the Lager, with its workshops (storages must be empty); returns the removed unit index
export function storeUnit(D, save, d, ui) {
  const u = d.rig.units[ui], g = gridNow(D, save);
  if (!u?.pos) return { ok: false, reason: 'Das ist kein Container' };
  if (u.workshops.some(w => w.key && Object.entries(d.grids).some(([k, x]) => (k === w.key || k.startsWith(w.key + ':s')) && x?.items?.length))) return { ok: false, reason: 'Erst das Lager darin ausräumen' };
  if (d.grids[u.key]?.items?.length) return { ok: false, reason: 'Erst ausräumen' };
  const rest = d.rig.units.filter((_, xi) => xi !== ui);
  if (rest.some((x, xi) => x.pos && x.pos.story > g.inside && fitsGrid(D, g, { units: rest }, xi, x.pos.place, x.pos.story))) return { ok: false, reason: 'Darauf steht noch etwas' };
  d.rig.units.splice(ui, 1);
  d.rig.spare.containers.push(u.id);
  for (const w of u.workshops) { delete w.at; d.rig.spare.workshops.push(w); }
  work(D, d, 'container', 90);
  return { ok: true, removed: ui };
}

// the first free cell where a container fits: hull first, then upwards, from the bow
export function freeCell(D, save, ui, id = save.rig.units[ui]?.id) {
  const mid = activeMega(D, save), g = mid && grid(D, mid, stageOf(D, save, mid));
  if (!g) return null;
  for (let story = 0; story < g.stories; story++) for (let place = 0; place < g.places; place++) if (!canPut(D, save, ui, place, story, id)) return { place, story };
  return null;
}
// every container gets a valid cell; what does not fit goes to the spare list (Lager), its workshops with it
export function settle(D, save) {
  const rig = save.rig, out = [];
  rig.units.forEach(u => { if (u.kind === 'container') { delete u.level; delete u.slot; } });
  for (let changed = true; changed;) {   // until nothing changes: an upper container whose lower one lost its cell must not float
    changed = false;
    rig.units.forEach((u, ui) => { if (u.kind === 'container' && u.pos && canPut(D, save, ui, u.pos.place, u.pos.story)) { delete u.pos; changed = true; } });
  }
  rig.units.forEach((u, ui) => { if (u.kind === 'container' && !u.pos) { const c = freeCell(D, save, ui); if (c) u.pos = c; else out.push(ui); } });
  for (const ui of out) {
    const u = rig.units[ui];
    (rig.spare ??= { workshops: [], containers: [], parts: [] }).containers.push(u.id);
    for (const w of u.workshops) rig.spare.workshops.push(w.id);
  }
  removeUnits(D, save, out);   // storages, decor and lights of the others move along (Aufräumen 16.11.)
  return out.length;
}

// moving into a mega rig: the old tractor (and its parts) park in the loading bay, the containers find cells on the grid,
// the tractor's own places become the bridge (crawler) or the cockpit (fatbird)
export function activate(D, save, id) {
  const V = D.megarigs?.[id], T = V?.tractor;
  if (!V || !T || !D.tractors?.[T] || !owned(save).includes(id)) return { ok: false, why: 'Noch nicht geborgen' };
  if (D.tractors[T].megarig !== id) return { ok: false, why: 'Nicht fahrbar (Zugmaschine › Mega-Rig fehlt)' };   // else the next load would undo it
  const m = mstate(save);
  if (!m.active) { m.bay = { tractor: save.rig.tractor, parts: clone(save.rig.parts || {}) }; save.rig.parts = {}; }   // the old tractor's parts stay with it in the bay
  m.active = id;
  m.stage[id] ??= 0;
  delete save.rig.lights;   // the camp's strings hang on trailer corners; aboard they hang on the grid (mega.lights)
  swapTractor(D, save, T);
  const lost = settle(D, save);
  return { ok: true, lost };
}
// back into the old rig from the loading bay: the containers line up behind it again and stack as far as it may (Aufräumen 16.11.:
// the tank's container always comes along, the rest in their order; what does not fit goes into the Lager, its storages rehomed)
export function deactivate(D, save) {
  const m = mstate(save);
  if (!m.active || !m.bay?.tractor) return { ok: false };
  m.active = null;
  const T = D.tractors?.[m.bay.tractor] || {}, len = Math.max(1, T.length ?? 1), high = Math.max(1, T.stack ?? 1);
  const U = save.rig.units;
  for (const u of U) { delete u.pos; delete u.level; delete u.slot; }
  const isTank = u => u.workshops.some(w => D.workshops?.[w.id]?.function === 'tank');
  const order = U.map((u, i) => i).filter(i => U[i].kind === 'container').sort((a, b) => (isTank(U[b]) - isTank(U[a])) || a - b);
  const blocks = [], gone = [];
  for (const i of order) {
    const u = U[i], def = D.containers?.[u.id] || {};
    if (blocks.length < len) { blocks.push([i]); continue; }
    const b = def.stackable && blocks.find(bl => bl.length < high && D.containers?.[U[bl.at(-1)].id]?.carries);
    if (b) { u.level = b.length; b.push(i); } else gone.push(i);
  }
  for (const i of gone) { save.rig.spare.containers.push(U[i].id); for (const w of U[i].workshops) save.rig.spare.workshops.push(w.id); }
  // the new order: tractor, then every block from the ground up; everything keyed by unit index moves along
  const tractor = U.findIndex(u => u.kind === 'tractor'), next = [tractor, ...blocks.flat()], map = new Map(next.map((o, n) => [o, n]));
  save.rig.units = next.map(i => U[i]);
  reindexUnits(D, save, i => (map.has(i) ? map.get(i) : null));
  save.rig.parts = m.bay.parts || {};
  swapTractor(D, save, m.bay.tractor);
  m.lights = [];
  // the Camp-Lager (#041) gets smaller again with the old tractor: what does not fit any more is rehomed instead of falling out
  fitContainers(D, save);
  return { ok: true, lost: gone.length };
}

// the modules for buildMegarig: one per container in unit order (module number = unit index)
export function modules(D, save, hide = null) {
  const mid = activeMega(D, save), g = mid && grid(D, mid, stageOf(D, save, mid));
  if (!g) return [];
  return save.rig.units.map((u, ui) => {
    if (u.kind !== 'container' || !u.pos || ui === hide) return { container: '_none', place: -99, story: -99 };   // keeps the numbering
    return { container: u.id, place: u.pos.place, story: u.pos.story, shell: shellAt(g, u.pos.story), name: cont(D, u).name, workshops: u.workshops.map(w => w.id), ui };
  }).slice(1);
}
// the add-ons that belong to the vehicle itself (lights on the bow, at place -1), not to the example city
export const hullAddons = (D, id) => (D.megarigs?.[id]?.addons || []).filter(a => num(a.place, 0) < 0);
// the built vehicle of this savegame (geometry for the camp and the build mode)
export function buildOwn(D, save, opts = {}) {
  const id = activeMega(D, save);
  if (!id) return null;
  const data = { megarigs: D.megarigs, containers: { ...D.containers, _none: undefined }, rigAddons: D.rigAddons };
  const lights = (mstate(save).lights || []).map(l => ({ ...l, from: Number(l.from) + 0, to: Number(l.to) + 0 }));
  const b = buildMegarig(data, id, stageOf(D, save, id), { modules: modules(D, save, opts.hide), addons: hullAddons(D, id), lights, margin: opts.margin, sky: opts.sky });
  if (b) b.problems = b.problems.filter(([, t]) => !/„_none“/.test(t));   // the placeholders of empty unit numbers
  return b;
}

// growing (Mega-Rigs › Ausbaustufen › Ausbau kostet): the next stage costs Δ and time; it is not undone by "Rückgängig"
export function nextStage(D, save) {
  const id = activeMega(D, save), V = D.megarigs?.[id], n = stageOf(D, save, id) + 1, st = V?.stages?.[n];
  return st ? { n, name: st.name || `Stufe ${n + 1}`, price: num(st.price, 0), hours: num(st.hours, 0) } : null;
}
export function buyStage(D, save) {
  const x = nextStage(D, save);
  if (!x) return { ok: false, why: 'Schon ganz ausgebaut' };
  if ((save.deltas || 0) < x.price) return { ok: false, why: `Der Ausbau kostet ${x.price} Δ` };
  save.deltas = (save.deltas || 0) - x.price;
  mstate(save).stage[activeMega(D, save)] = x.n;
  return { ok: true, ...x };
}

// string lights aboard: from/to are unit numbers, corners 0 (left) / 1 (right)
export function hangLight(D, save, a, b) {
  const L = mstate(save).lights, max = D.camp?.lights?.max ?? 12, price = D.camp?.lights?.price ?? 10;
  if (!a || !b || (a.ui === b.ui && a.corner === b.corner)) return { ok: false, why: 'Zu einer anderen Ecke ziehen' };
  if (L.some(l => (l.from === a.ui && l.to === b.ui && l.fromCorner === a.corner && l.toCorner === b.corner) || (l.from === b.ui && l.to === a.ui && l.fromCorner === b.corner && l.toCorner === a.corner))) return { ok: false, why: 'Da hängt schon eine' };
  if (L.length >= max * 2) return { ok: false, why: 'Genug Lichterketten' };
  if ((save.deltas || 0) < price) return { ok: false, why: `Eine Lichterkette kostet ${price} Δ` };
  save.deltas -= price;
  L.push({ from: a.ui, fromCorner: a.corner, to: b.ui, toCorner: b.corner });
  return { ok: true };
}
export function unhangLight(D, save, i) {
  const L = mstate(save).lights, back = Math.round((D.camp?.lights?.price ?? 10) * (D.camp?.lights?.back ?? 50) / 100);
  if (!L[i]) return { ok: false };
  L.splice(i, 1);
  save.deltas = (save.deltas || 0) + back;
  return { ok: true, back };
}
// lights follow their units when units move or leave (indices shift when a unit is removed)
export function fixLights(save, removed = null) {
  const m = mstate(save), n = save.rig.units.length;
  if (removed != null) m.lights = m.lights.filter(l => l.from !== removed && l.to !== removed).map(l => ({ ...l, from: l.from > removed ? l.from - 1 : l.from, to: l.to > removed ? l.to - 1 : l.to }));
  m.lights = m.lights.filter(l => l.from > 0 && l.to > 0 && l.from < n && l.to < n && save.rig.units[l.from]?.pos && save.rig.units[l.to]?.pos);
}

// travel (#029): speed relative to the van, flying straight over the map
export const travelSpeed = (D, tractor) => num(D.tractors?.[tractor]?.speed, 100) / 100;
export const flies = (D, tractor) => !!D.tractors?.[tractor]?.air;

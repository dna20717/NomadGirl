// Unit indices in the savegame (Aufräumen 16.11.2026). Much of the rig's state is keyed by the index of a unit in save.rig.units:
// storage grids (`rig:<ui>`, `store:<ui>:<at>`, trophy stands `…:s<i>`), the camp's string lights ('<ui>:<side>'), decoration on a
// unit (at.ui, corner anchors), the string lights aboard a mega rig ({ from, to }), hydroponics, cistern and watering ('<ui>:<at>').
// When units leave the rig or change their order outside the build draft (savegame repair, a mega rig settling its grid, leaving
// a mega rig), everything has to move along, or it silently points at the wrong unit and the contents of storages get lost.
// No DOM: browser and Node.
import { addEntry, newGrid } from './inventory.js';
import { remap as remapDecor } from './decor.js';

// the contents of a grid that is gone: into the Camp-Lager (#041), and what is left lies as a bundle next to the van
export function rehome(D, s, g) {
  const camp = s.inv?.grids?.camp;
  let rest = (g.items || []).map(e => ({ ...e }));
  if (camp) rest = rest.map(e => ({ ...e, n: addEntry(D, camp, e, e.n) })).filter(e => e.n > 0);
  if (rest.length) {
    const pile = { x: null, feet: null, grid: newGrid(Math.max(4, g.w || 4), Math.max(3, g.h || 3)) };
    // the bundle grows until everything is in (#019: it used to drop what did not fit)
    for (const e of rest) { let left = e.n, guard = 0; while ((left = addEntry(D, pile.grid, e, left)) > 0 && guard++ < 40) pile.grid.h += 3; }
    ((s.ground ??= {})[s.location] ??= []).push(pile);
  }
}

// state keyed '<ui>:<at>…' (garden, cistern, watered): the unit part follows move(ui) → new index or null (gone)
export function remapPlaceKeys(save, move) {
  for (const k of ['garden', 'cistern', 'watered']) {
    const S = save[k];
    if (!S || typeof S !== 'object') continue;
    save[k] = Object.fromEntries(Object.entries(S).flatMap(([key, v]) => {
      const m = /^(\d+)(:.*)$/.exec(key);
      if (!m) return [[key, v]];
      const n = move(Number(m[1]));
      return n == null ? [] : [[`${n}${m[2]}`, v]];
    }));
  }
}

// call after save.rig.units has been changed: move(oldIndex) → new index, or null when that unit left the rig.
// Storage grids follow their unit; grids of units that left are emptied into the chest / Kofferraum / a bundle by the van.
export function reindexUnits(D, save, move) {
  const grids = save.inv?.grids;
  if (grids) {
    const next = {}, lost = [];
    for (const [k, g] of Object.entries(grids)) {
      const m = /^(rig|store):(\d+)(.*)$/.exec(k);
      if (!m) { next[k] = g; continue; }
      const n = move(Number(m[2]));
      if (n == null) { if (g?.items?.length) lost.push(g); continue; }
      next[`${m[1]}:${n}${m[3]}`] = g;
    }
    save.inv.grids = next;
    for (const g of lost) rehome(D, save, g);
  }
  const rig = save.rig;
  if (rig.lights?.length) {
    const fix = a => { const [ui, side] = String(a).split(':'); if (ui === 'mast') return a; const n = move(Number(ui)); return n == null ? null : `${n}:${side}`; };
    rig.lights = rig.lights.map(([a, b]) => [fix(a), fix(b)]).filter(([a, b]) => a && b && a !== b);
  }
  if (rig.decor?.length) remapDecor(rig, move);
  if (save.mega?.lights?.length) save.mega.lights = save.mega.lights.map(l => ({ ...l, from: move(l.from), to: move(l.to) })).filter(l => l.from != null && l.to != null && l.from !== l.to);
  remapPlaceKeys(save, move);
}

// removes the units at the given indices from save.rig.units and moves everything keyed by index along (see reindexUnits)
export function removeUnits(D, save, indices) {
  const gone = new Set(indices), map = new Map();
  let n = 0;
  save.rig.units.forEach((u, i) => { if (!gone.has(i)) map.set(i, n++); });
  save.rig.units = save.rig.units.filter((u, i) => !gone.has(i));
  reindexUnits(D, save, i => (map.has(i) ? map.get(i) : null));
}

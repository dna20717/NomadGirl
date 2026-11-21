// NomadGirl – Tropes als Spuren-Bausteine (#167 G1, docs/concepts/poi_next_gen.md › Bewährte Tropes): Letzte Pose, Das letzte Logbuch,
// Die letzte Stellung, Warnung an der Wand, Der Schrein, Kinderspuren … Each trope is a small set piece in one room: a painted picture
// (PixelLab) or traces from code, optionally a note beside it. Conditions decide where it fits (room role, the POI's event, who lives
// there, the time layers, everything the storylets read); the dice only pick the room and the spot. Grundsätze nach Smith/Worch: ziehen
// statt drücken, man muss etwas übersehen können, kein anonymes Detail. Tote ehrlich, moderater Gore (Zeitschichten › Gore höchstens).
// Browser and Node, no DOM.
//
//   planTropes(D, poiId, L, seed, ctx)  → [{ id, room (index in L.rooms), x, y (air tile above the floor), w (tiles), place, note }]
//   tropeSpots(tiles, rect, w, place)   free stretches of floor (or wall above one) in a room
import { roomStory } from './story.js';
import { holds, rng, hashStr } from './storylets.js';

export const TROPE_PLACES = [['floor', 'auf dem Boden'], ['wall', 'an der Wand']];
export const GORE = [[0, 'keiner'], [1, 'Blutfleck'], [2, 'moderat (Tote sichtbar)']];
const list = v => Array.isArray(v) ? v : String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);
const BUSY = 'HDSCZ@!%$BL*^v';   // ladders, doors, switches, chests, goal, terminal, siren … keep a tile off them

// free stretches of w tiles: floor below, two tiles of air above, nothing special within one tile → [[x, y]] (y = the air tile on the floor)
export function tropeSpots(tiles, rect, w = 3, place = 'floor') {
  const at = (x, y) => tiles[y]?.[x], out = [];
  const solid = c => c === '#' || c === 'A';   // never on a one-way platform
  for (let y = rect.y + 2; y < rect.y + rect.h; y++) for (let x = rect.x + 1; x + w <= rect.x + rect.w - 1; x++) {
    let ok = true;
    for (let k = 0; k < w && ok; k++) ok = at(x + k, y) === '.' && at(x + k, y - 1) === '.' && (place !== 'wall' || at(x + k, y - 2) === '.') && solid(at(x + k, y + 1));
    if (!ok) continue;
    for (let dy = -2; dy <= 1 && ok; dy++) for (let dx = -1; dx <= w && ok; dx++) if (BUSY.includes(at(x + dx, y + dy) || '.')) ok = false;
    if (ok) out.push([x, y]);
  }
  return out;
}

// does trope t fit a room of this role in a place with this context
export function tropeFits(D, t, ctx, role) {
  if (!t || t.off) return false;
  if ((t.gore ?? 0) > (D?.history?.gore ?? 2)) return false;
  if (list(t.roles).length && !list(t.roles).includes(role)) return false;
  const ev = list(t.events);
  if (ev.length && !ev.includes(ctx.event) && !ev.includes(ctx.residents)) return false;
  if (list(t.pois).length && !list(t.pois).includes(ctx.poi)) return false;
  return (t.when || []).every(c => !c.when || holds(D, ctx, c));
}

export function planTropes(D, poiId, L, seed = 0, ctx = {}) {
  const T = Object.entries(D?.tropes || {}), tiles = L?.def?.layout, rooms = L?.rooms || [];
  if (!T.length || !tiles) return [];
  const H = D.history || {}, max = H.tropesPerLevel ?? 3, r = rng((seed ^ hashStr('tropes:' + poiId)) >>> 0), P = D.pois?.[poiId] || {};
  const used = new Set(), out = [], taken = [];
  // rooms in a seeded order, never the first (the van) nor the Wow room unless the trope allows it
  const order = rooms.map((rm, i) => i).filter(i => i > 0).sort((a, b) => hashStr(`${seed}:${a}`) - hashStr(`${seed}:${b}`));
  const cands = T.filter(([, t]) => r() * 100 < (t.chance ?? 60)).sort((a, b) => (b[1].weight ?? 10) * r() - (a[1].weight ?? 10) * r());
  for (const [id, t] of cands) {
    if (out.length >= max) break;
    const w = Math.max(1, Math.round(t.tiles ?? 3)), place = t.place || 'floor';
    for (const i of order) {
      if (used.has(i)) continue;
      const rm = rooms[i], R = D.rooms?.[rm.id] || {};
      if ((R.type === 'wow' || rm.wow) && !t.wow) continue;
      const role = roomStory(P, R).role;
      if (!tropeFits(D, t, ctx, role)) continue;
      const spots = tropeSpots(tiles, rm, w, place).filter(([x, y]) => !taken.some(([tx, ty, tw]) => ty === y && x < tx + tw + 1 && x + w + 1 > tx));
      if (!spots.length) continue;
      const [x, y] = spots[Math.floor(r() * spots.length)];
      out.push({ id, room: i, x, y, w, place, note: t.note || null });
      used.add(i); taken.push([x, y, w]);
      break;
    }
  }
  return out;
}

// NomadGirl – set dressing by rules (#158, Daniel 21.11.2026: „Wie können wir hübschere, echter anfühlende Maps erschaffen, ohne dass
// ich alles selbst machen muss? … Clutter wird manchmal zu gehäuft eingesetzt, manchmal falsch (ein Baum oben auf einem Hochhaus)“).
// Runs in the browser (game/play/art.js drawRoom) and in Node (test/dressing.test.js), no DOM.
//
//   regionMap(D, …)        which room, Kachel-Set, inside/outside and room role every tile of a level belongs to
//   placeTypes(room, reg)  place types from the tiles: floor_in, floor_out, roof, ledge (+ corner), ceiling, wall

import { roomStory } from './story.js';
import { rulesOf, orderConfig, decayConfig, ageItems, roomTale, hash as hash2 } from './dressing_story.js';

// Ort-Typen: where a thing can be (Kachel-Sets › Clutter-Regeln › Ort, POI-Ensembles › Ort)
export const PLACE_TYPES = [['floor_in', 'Boden drinnen'], ['floor_out', 'Boden draußen'], ['roof', 'Dach'], ['ledge', 'Steg / Sims / Theke'],
  ['corner', 'Ecke am Wandfuß'], ['ceiling', 'Decke (hängt)'], ['wall', 'Wand (Rückwand, Augenhöhe)']];
export const PLACE_COLORS = { floor_in: '#3fe0d0', floor_out: '#f0c040', roof: '#ff5ab4', ledge: '#8a7dff', corner: '#ff8a3d', ceiling: '#7dff9a', wall: '#c8c8d8' };
export const STANDING = new Set(['floor_in', 'floor_out', 'roof', 'ledge']);
// Raum-Rollen (#158 step 3): what a room is for; weights the choice of clutter and ensembles (Spiel › Set-Dressing › Rollen)
export const ROOM_ROLES = [['general', 'allgemein'], ['shop', 'Laden'], ['storage', 'Lager'], ['office', 'Büro'], ['hall', 'Halle'], ['living', 'Wohnen'],
  ['tech', 'Technik'], ['corridor', 'Gang'], ['outdoor', 'Draußen'], ['combat', 'Kampf'], ['cave', 'Höhle']];

// tiles drawn as wall by art.js (doors D and brittle walls B are drawn by poi_level.js and carry nothing)
const WALLISH = new Set(['#', 'A', '^', 'v', '%', '$']);
const list = v => Array.isArray(v) ? v : String(v || '').split(',').map(s => s.trim()).filter(Boolean);
export const splitList = list;

// Which room every tile belongs to, its Kachel-Set id, inside (back wall) or outside, and its role. Same rules as before (#038):
// in a level each tile belongs to the room at it, above a room to the nearest room in its column, below all rooms the tunnel.
// rooms = levelInfo.rooms (or null for a single room roomId)
export function regionMap(D, { rooms = null, roomId = null, poiId = null } = {}) {
  const dflt = D.game?.tiles?.terrain, roomSet = id => D.rooms?.[id]?.terrain || dflt;
  const indoor = id => { const r = D.rooms?.[id] || {}; return r.indoor ?? !(r.backdrop?.image || r.backdrop?.weather); };
  const roleOf = id => D.rooms?.[id]?.role || (id && !indoor(id) ? 'outdoor' : 'general');
  if (rooms?.length) {
    const P = D.pois?.[poiId] || {}, tunnel = P.tunnelTerrain || roomSet(rooms[0]?.id), cache = new Map();
    const roomAt = (x, y) => {
      const k = x + ',' + y;
      if (cache.has(k)) return cache.get(k);
      const col = rooms.filter(r => x >= r.x && x < r.x + r.w);
      let r = col.find(r => y >= r.y && y < r.y + r.h) || null;
      if (!r && col.length && y < Math.max(...col.map(c => c.y + c.h))) r = col.reduce((a, b) => Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a);
      cache.set(k, r);
      return r;
    };
    return { tower: P.stack === 'tower', roomAt, idAt: (x, y) => { const r = roomAt(x, y); return r ? roomSet(r.id) : tunnel; }, inside: (x, y) => { const r = roomAt(x, y); return r ? indoor(r.id) : true; },
      roleAt: (x, y) => { const r = roomAt(x, y); return r ? roleOf(r.id) : 'corridor'; } };
  }
  const own = roomSet(roomId), inside = !!D.rooms?.[roomId]?.indoor;
  return { roomAt: () => null, idAt: () => own, inside: () => inside, roleAt: () => D.rooms?.[roomId]?.role || (inside ? 'general' : 'outdoor') };
}

// Ort-Typen (#158 step 1) from the tiles of a parsed room (or level). room = { w, h, tiles }, reg = regionMap(…) (inside, roomAt)
// → { list, at(x, y) } with entries
//   standing: { x, y (the carrying tile), type: floor_in | floor_out | roof | ledge, corner: 'l' | 'r' | null, air (free tiles above, max 8), run: [x0, x1] }
//   ceiling:  { x, y (the air tile under the ceiling), type: 'ceiling', drop (free tiles below) }
//   wall:     { x, y (air tile at eye height, 1.5 tiles above the floor), type: 'wall', side: 'l' | 'r' | null (a side wall next to it) }
// roof = top of a building: outside, with a room's air under a thin slab (up to 4 tiles); ledge = platform (=), a thin slab with air
// under it outside, a short slab inside (under 5 tiles) or the top of a narrow block that stands up out of the floor (counter, pump)
export function placeTypes(room, reg = {}) {
  const { w, h, tiles } = room, ch = (x, y) => tiles[y]?.[x];
  const inside = reg.inside || (() => false), roomAt = reg.roomAt || (() => null);
  const solid = (x, y) => x < 0 || y < 0 || x >= w || y >= h || WALLISH.has(ch(x, y));
  const carries = (x, y) => solid(x, y) || ch(x, y) === '=';
  const open = (x, y) => ch(x, y) === '.';
  const surface = (x, y) => y > 0 && y < h && x >= 0 && x < w && carries(x, y) && !carries(x, y - 1) && !solid(x, y - 1);
  const out = [], at = new Map();
  const add = e => { out.push(e); at.set(e.type === 'ceiling' || e.type === 'wall' ? `${e.type}:${e.x},${e.y}` : `${e.x},${e.y}`, e); };
  for (let y = 1; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!surface(x, y)) { x++; continue; }
      let x1 = x; while (x1 + 1 < w && surface(x1 + 1, y) && (ch(x1 + 1, y) === '=') === (ch(x, y) === '=')) x1++;
      const width = x1 - x + 1;
      // a narrow block standing up out of the floor: both ends drop at least 2 tiles (counter, pump island, crate stack)
      const drop = xx => { let d = 0; while (d < 3 && !carries(xx, y + d)) d++; return d; };
      const raised = width <= 4 && drop(x - 1) >= 2 && drop(x1 + 1) >= 2;
      for (let xx = x; xx <= x1; xx++) {
        let air = 0; while (air < 8 && open(xx, y - 1 - air)) air++;
        const inn = inside(xx, y - 1);
        let type;
        if (ch(xx, y) === '=') type = 'ledge';
        else {
          let k = 1; while (k <= 4 && solid(xx, y + k)) k++;
          // air under a thin slab; the shortcut tunnel under all rooms (no room there) counts as ground
          const hollow = k <= 4 && y + k < h && !solid(xx, y + k) && !(reg.roomAt && !roomAt(xx, y + k) && roomAt(xx, y - 1));
          // outside: a room under it (up to 8 tiles of wall down, e.g. a block on a roof deck) makes it a roof
          // in a tower (#038) any room further down the column: the whole stack is one building
          const deep = reg.tower ? h : 8;
          let kr = 1; while (kr <= deep && solid(xx, y + kr)) kr++;
          const under = kr <= deep && y + kr < h && !solid(xx, y + kr) && roomAt(xx, y + kr);
          if (!inn && under && (inside(xx, y + kr) || under !== roomAt(xx, y - 1))) type = 'roof';
          else if (hollow && !inn) type = 'ledge';
          else if (hollow) type = width >= 5 ? 'floor_in' : 'ledge';
          else if (raised) type = 'ledge';
          else type = inn ? 'floor_in' : 'floor_out';
        }
        const corner = solid(xx - 1, y - 1) ? 'l' : solid(xx + 1, y - 1) ? 'r' : null;
        add({ x: xx, y, type, corner, air, run: [x, x1] });
      }
      x = x1 + 1;
    }
  }
  for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) {
    if (!open(x, y)) continue;
    if (inside(x, y) && solid(x, y - 1) && !open(x, y - 2)) {   // the underside of a wall inside: something can hang here (outside the top is the sky's edge)
      let drop = 0; while (drop < 12 && open(x, y + drop)) drop++;
      if (drop >= 3) add({ x, y, type: 'ceiling', drop });
    }
    // eye height on the back wall: floor two tiles below, only inside (outside there is no wall behind)
    if (inside(x, y) && open(x, y + 1) && carries(x, y + 2) && !carries(x, y + 1) && !solid(x, y - 1))
      add({ x, y, type: 'wall', side: solid(x - 1, y) ? 'l' : solid(x + 1, y) ? 'r' : null });
  }
  return { list: out, at: (x, y, type = null) => at.get(type === 'ceiling' || type === 'wall' ? `${type}:${x},${y}` : `${x},${y}`) || null };
}
// does a thing with these place types fit this spot? corner things only at the foot of a wall, standing things on their own types
export function fits(place, spot) {
  const P = list(place);
  if (!P.length) return STANDING.has(spot.type) && spot.type !== 'roof' && spot.type !== 'ledge';
  if (spot.type === 'ceiling' || spot.type === 'wall') return P.includes(spot.type);
  if (!P.includes(spot.type)) return P.includes('corner') && !!spot.corner && !P.some(p => STANDING.has(p)) && (spot.type === 'floor_in' || spot.type === 'floor_out');
  return true;
}

// Raum-Rollen (#158 step 3): how much a thing fits a room. Its own roles: 3× when the room's role is among them, ¼ when it names
// others; the role's preferred tags (Spiel › Set-Dressing › Rollen) 2×, avoided tags ¼. → weight ≥ 0
export function roleConfig(D) {
  const m = new Map();
  for (const r of D?.game?.dressing?.roles || []) if (r.role) m.set(r.role, { prefer: list(r.prefer), avoid: list(r.avoid) });
  return role => m.get(role) || { prefer: [], avoid: [] };
}
export function roleWeight(rule, role, cfg) {
  let w = rule?.weight ?? 1;
  const roles = list(rule?.roles), tags = list(rule?.tags), c = cfg ? cfg(role) : { prefer: [], avoid: [] };
  if (roles.length && rule?.strict && !roles.includes(role)) return 0;   // #178 Marken-Clutter „nur in diesen Rollen“ (Supermarktregal nie im Tunnel)
  if (roles.length) w *= roles.includes(role) ? 3 : 0.25;
  if (tags.some(t => c.prefer.includes(t))) w *= 2;
  if (tags.some(t => c.avoid.includes(t))) w *= 0.25;
  return w;
}
// pick by weight with a number r in [0, 1)
export function pickWeighted(items, weightOf, r) {
  const ws = items.map(weightOf), sum = ws.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return null;
  let t = r * sum;
  for (let i = 0; i < items.length; i++) { t -= ws[i]; if (t < 0) return items[i]; }
  return items.at(-1);
}

// Overrides per POI and room (POIs › Set-Dressing, Raum-Bausteine › Set-Dressing). Hook points for #160 „Story zuerst“: a POI's
// story (decay, tone …) or a room brief can fill these same fields (or be mapped onto them here) without touching the planner.
// → { scale (POI density in %, as factor), density (room: things per 10 floor tiles, else null = role), prefer, avoid (tags), sets (ensemble ids, [] = all) }
// #160 Dressing liest die Story: the room brief's must-things are preferred, its never-things are forbidden (tag or clutter name), decay
// comes from the story (room over POI) → also { must, forbid, decay, story (roomStory) }
export function dressingOverrides(D, poiId, roomId) {
  const P = D?.pois?.[poiId]?.dressing || {}, R = D?.rooms?.[roomId]?.dressing || {};
  const S = roomId && D?.rooms?.[roomId] ? roomStory(D?.pois?.[poiId] || {}, D.rooms[roomId]) : null;
  return { scale: (P.density ?? 100) / 100, density: R.density ?? null, wall: R.wall ?? null, prefer: [...list(P.prefer), ...list(R.prefer), ...(S?.must || [])], avoid: [...list(P.avoid), ...list(R.avoid)],
    sets: R.sets?.length ? R.sets : P.sets?.length ? P.sets : [], must: S?.must || [], forbid: S?.never || [], decay: S?.decay ?? D?.pois?.[poiId]?.story?.decay ?? null, story: S };
}

// ---------- the plan (#158 steps 4 + 5): ensembles first, then single things up to a budget, ways kept free ----------
// Spiel › Set-Dressing: density = things per 10 floor tiles („bewohnt“ ≈ 3), per role in the table Rollen; minGap = free tiles between
// two things (Poisson along the floor); ensembles = share of the budget for ensembles (%); wall = share for wall and ceiling things (%)
export const DRESSING = { density: 3, minGap: 1, ensembles: 50, wall: 12, brandWeight: 15, aiMax: 1, sameMax: 2 };
export function dressingConfig(D) {
  const g = D?.game?.dressing || {}, dens = new Map((g.roles || []).filter(r => r.role && r.density != null).map(r => [r.role, r.density]));
  return { ...DRESSING, ...Object.fromEntries(Object.entries(g).filter(([k, v]) => k in DRESSING && v != null)), densityOf: role => dens.get(role) ?? g.density ?? DRESSING.density };
}
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const FIXED = new Set('.#=HoLCSDBZA^v*%$@!'.split(''));
const pxPerCm = D => (D.assets?.[D.leyla?.look?.idle]?.height || 192) / (D.game?.tiles?.leylaCm || 170);
const cellH = (D, key) => { const c = D.assets?.[key]?.cell; return Array.isArray(c) ? c[1] : c || 64; };
// everything a Kachel-Set can put down: clutter (a name twice = twice as often) and large clutter (two tiles wide), with its rule.
// → [{ set, key, name, w, h (tiles high), rule }]; a set without Clutter-Regeln gives [] (it keeps the old dice in art.js)
export function setPool(D, id, T = 64) {
  const t = D.terrain?.[id];
  if (!t?.dressing?.length) return [];
  const rules = new Map(t.dressing.filter(r => r.name).map(r => [r.name, r])), cm = new Map((t.sizes || []).map(r => [r.name, r.cm])), k = pxPerCm(D);
  const tall = (key, n) => Math.max(1, Math.ceil((cm.get(n) ? cm.get(n) * k : cellH(D, key)) / T - 0.15));
  const out = [];
  for (const n of t.clutter || []) if (t.props) out.push({ set: id, key: t.props, name: n, w: 1, h: tall(t.props, n), rule: rules.get(n) || {} });
  for (const n of t.bigClutter || []) if (t.propsBig) out.push({ set: id, key: t.propsBig, name: n, w: 2, h: tall(t.propsBig, n), rule: rules.get(n) || {} });
  return out;
}
// Marken-Clutter of a POI as candidates: their chance becomes their weight (Spiel › Set-Dressing › Marken-Gewicht)
export function brandPool(D, poiId, T = 64) {
  const k = pxPerCm(D), w = dressingConfig(D).brandWeight / 100;
  return (D.pois?.[poiId]?.brandProps || []).filter(b => b.look && b.name).map(b => ({ set: null, brand: true, key: b.look, name: b.name, w: Math.max(1, Math.min(6, Math.round(+b.w || 1))), h: Math.max(1, Math.ceil((b.cm || 100) * k / T - 0.15)), ai: !!b.ai,
    rule: { ...b, weight: (b.chance ?? 5) * w } }));
}
const tagsOf = c => list(c.rule?.tags);
export const matchesTag = (c, tag) => String(tag || '').split('|').map(s => s.trim()).filter(Boolean).some(t => tagsOf(c).includes(t));

// Ways and fighting spots stay free (#158 step 5): Leyla's start, doors, ladders (foot and top), switches, chests, the goal, terminals,
// alarms, spawns, brittle and fake walls, shortcut ends, jump edges (the last floor tile before a drop) and the openings between rooms
export function keepClear(room, spots, reg = {}) {
  const { w, h, tiles } = room, ch = (x, y) => tiles[y]?.[x], keep = new Set(), wallKeep = new Set();
  const carries = (x, y) => { const c = ch(x, y); return c == null || '#A^v%$='.includes(c); };
  const mark = (x, y, r) => { for (let dx = -r; dx <= r; dx++) keep.add((x + dx) + ',' + y); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = ch(x, y);
    if (c === '.' || c === '#' || c === '=' || c === '*') continue;
    const r = c === 'L' || c === 'Z' || c === 'D' || c === '/' ? 2 : 1;
    if ('LSCZ@!1'.includes(c) || !FIXED.has(c)) mark(x, y + 1, r);
    if ('DB%$/'.includes(c)) { mark(x, y + 1, 2); mark(x, y, 1); }
    if (c === 'H') { if (ch(x, y + 1) !== 'H') mark(x, y + 1, 1); if (ch(x, y - 1) !== 'H') { mark(x, y, 1); mark(x, y + 1, 1); } }
    if ('^vA'.includes(c)) mark(x, y, 1);
    if ('HDSC@!Z%$B'.includes(c) || !FIXED.has(c)) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) wallKeep.add((x + dx) + ',' + (y + dy));
  }
  for (const s of spots.list) {
    if (!STANDING.has(s.type)) continue;
    if ((s.x === s.run[0] && !s.corner && !carries(s.x - 1, s.y)) || (s.x === s.run[1] && !carries(s.x + 1, s.y))) keep.add(s.x + ',' + s.y);   // jump edge
    if (reg.roomAt) for (let dx = -2; dx <= 2; dx++) if (dx && ch(s.x + dx, s.y - 1) === '.' && reg.roomAt(s.x + dx, s.y - 1) !== reg.roomAt(s.x, s.y - 1)) keep.add(s.x + ',' + s.y);   // opening between rooms
  }
  return { keep, wallKeep };
}

// The plan for a room or level: → { items, regions, planned(x, y), keep }
//   items: [{ x, y, w, h, hang: 'stand' | 'ceiling' | 'wall', type (place type), set, key, name, brand, ai, ens (ensemble id) }]
//     stand: tiles x … x+w-1 carry it in row y, it stands on top; ceiling: hangs under the wall above tile (x, y); wall: on the back wall at (x, y)
//   regions: [{ key, role, set, spots, budget, placed }]
// Only rooms whose Kachel-Set has Clutter-Regeln are planned; planned(x, y) tells art.js which floor tiles are left for the old dice.
// Deterministic: the same level and seed give the same plan.
export function planDressing({ D, room, reg, spots, poiId = null, seed = 0, T = 64, singles = true, keepFree = [] }) {
  const cfg = dressingConfig(D), rc = roleConfig(D), ch = (x, y) => room.tiles[y]?.[x];
  const rules = rulesOf(D), ocfg = orderConfig(D), dcfg = decayConfig(D);   // #159 corrections, order rows, decay
  const pools = new Map(), poolOf = id => { if (!pools.has(id)) pools.set(id, setPool(D, id, T)); return pools.get(id); };
  const brands = brandPool(D, poiId, T), sets = Object.keys(D.terrain || {});
  const { keep, wallKeep } = keepClear(room, spots, reg);
  for (const k of keepFree) { keep.add(k); wallKeep.add(k); }   // #174 in front of the front doors
  const idAt = reg.idAt || (() => null), roleAt = reg.roleAt || (() => 'general'), roomAt = reg.roomAt || (() => null);
  const keyOf = r => r ? `${r.id}@${r.x},${r.y}` : 'room';
  const taken = new Map(), items = [], s0 = (seed >>> 0) % 100003;
  const free = (x, y) => !taken.has(x + ',' + y);
  const lampAbove = (x, y) => { for (let k = 1; k <= 8; k++) { const c = ch(x, y - k); if (c === '*') return true; if (c !== '.' && c != null) return false; } return false; };
  const score = s => (s.corner ? 3 : 0) + (lampAbove(s.x, s.y) ? 1 : 0) + hash(s.x, s.y, s0 + 11) * 1.5;
  // regions: spots grouped by the room they belong to (the air above them)
  const regions = new Map();
  for (const s of spots.list) {
    const air = STANDING.has(s.type) ? [s.x, s.y - 1] : [s.x, s.y];
    const set = idAt(...air);
    if (!poolOf(set).length) continue;
    const r = roomAt(...air), key = keyOf(r);
    if (!regions.has(key)) regions.set(key, { key, room: r?.id || null, role: roleAt(...air), set, stand: [], hang: [], placed: 0 });
    regions.get(key)[STANDING.has(s.type) ? 'stand' : 'hang'].push(s);
  }
  const fitsAt = (c, x, y) => {
    for (let i = 0; i < c.w; i++) {
      const s = spots.at(x + i, y);
      if (!s || !STANDING.has(s.type) || !fits(c.rule.place, s) || s.air < c.h || keep.has((x + i) + ',' + y) || !free(x + i, y) || rules.forbids(c.name, null, s.type)) return false;
    }
    return true;
  };
  // #178 a thing with a KI in it (E / ↑ starts a duel) keeps away from ladders, the goal, switches, chests, doors and the start, or its
  // prompt would take the place of theirs
  const aiClear = (c, x, y) => { if (!c.ai) return true; for (let dy = -4; dy <= 0; dy++) for (let dx = -3; dx < c.w + 3; dx++) if ('HZCSD@!L/+o'.includes(ch(x + dx, y + dy) || '.')) return false; return true; };
  const gapFree = (x0, x1, y, g) => { for (let x = x0 - g; x < x0; x++) if (!free(x, y)) return false; for (let x = x1 + 1; x <= x1 + g; x++) if (!free(x, y)) return false; return true; };
  const put = (c, x, y, hang, type, ens, R) => {
    const it = { x, y, w: c.w, h: c.h, hang, type, set: c.set, key: c.key, name: c.name, brand: !!c.brand, ai: !!c.ai, ens: ens || null, room: R.key, tags: c.rule?.tags || '', ...(+c.rule?.lift > 0 && hang === 'wall' ? { lift: +c.rule.lift } : {}) };
    items.push(it);
    if (hang === 'stand') for (let i = 0; i < c.w; i++) taken.set((x + i) + ',' + y, it);
    R.placed++;
    return it;
  };
  const cands = (R, extra = false) => [...poolOf(R.set), ...brands, ...(extra ? sets.filter(id => id !== R.set).flatMap(id => poolOf(id).map(c => ({ ...c, borrowed: true }))) : [])];
  // per POI and per room (#160 hooks): density, preferred and avoided tags, which ensembles (dressingOverrides)
  let ov = null;
  const weight = (c, role) => { let w = roleWeight(c.rule, role, rc) * (c.borrowed ? 0.3 : 1); const t = tagsOf(c); if (ov?.forbid.length && (ov.forbid.includes(c.name) || t.some(x => ov.forbid.includes(x)))) return 0; if (rules.forbids(c.name, role, null)) return 0; if (tale?.tags.length && t.some(x => tale.tags.includes(x))) w *= 3; if (ov?.prefer.length && t.some(x => ov.prefer.includes(x))) w *= 2; if (ov?.avoid.length && t.some(x => ov.avoid.includes(x))) w *= 0.25; return w; };
  const hangOnly = c => { const P = list(c.rule.place); return P.length > 0 && P.every(p => p === 'wall' || p === 'ceiling'); };
  let ri = 0, tale = null;
  for (const R of regions.values()) {
    ri++;
    R.spots = R.stand.length;
    ov = dressingOverrides(D, poiId, R.room);
    // #159 the room's story (Raum-Geschichten): its tags come thrice as often, a third more things; decay from the story (room over POI)
    const rr = R.key !== 'room' ? R.key.split('@')[1].split(',').map(Number) : null;
    R.tale = R.room && rr && poiId ? roomTale(D, poiId, { id: R.room, x: rr[0], y: rr[1] }, rr[0] * 1000 + rr[1], seed) : null;
    const TT = R.tale ? D.roomStories?.[R.tale] : null;
    tale = TT ? { tags: list(TT.tags), sets: TT.sets || [] } : null;
    R.decay = Math.max(0, Math.min(3, ov.decay ?? 0)); R.scale = ov.scale;
    R.budget = Math.round(R.spots * (ov.density ?? cfg.densityOf(R.role)) * ov.scale * rules.density(R.role) * (tale ? 1.3 : 1) / 10);
    const order = [...R.stand].sort((a, b) => score(b) - score(a));
    const same = c => items.filter(it => it.room === R.key && it.name === c.name).length;   // no room full of the same thing
    // 0. #159 order first (Originalzustand): a row of the same thing at a fixed beat, centred in the longest free stretch of floor inside
    const oc = singles && R.budget >= 2 ? ocfg(R.role) : null;
    if (oc) {
      const runs = [];
      for (const s of [...R.stand].sort((a, b) => a.y - b.y || a.x - b.x)) {
        if (s.type !== 'floor_in' || keep.has(s.x + ',' + s.y) || !free(s.x, s.y)) continue;
        const last = runs.at(-1);
        if (last && last.y === s.y && last.x1 === s.x - 1) last.x1 = s.x; else runs.push({ y: s.y, x0: s.x, x1: s.x });
      }
      const run = runs.filter(r => r.x1 - r.x0 + 1 >= 6).sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0))[0];
      if (run) {
        const len = run.x1 - run.x0 + 1, pool = cands(R).filter(c => !hangOnly(c) && !c.ai && matchesTag(c, oc.tags) && fitsAt(c, run.x0, run.y));
        const c = pickWeighted(pool, c => weight(c, R.role), hash(run.x0, run.y, s0 + 17));
        if (c) {
          const step = c.w + oc.gap;
          // the longest row that fits completely (every place free), centred: keeps the beat
          for (let n = Math.min(Math.floor((len + oc.gap) / step), Math.max(2, Math.round(R.budget * oc.share / 100))); n >= 2; n--) {
            const x0 = run.x0 + Math.floor((len - (n * step - oc.gap)) / 2), xs = [...Array(n).keys()].map(i => x0 + i * step);
            if (!xs.every(x => fitsAt(c, x, run.y))) continue;
            for (const x of xs) put(c, x, run.y, 'stand', spots.at(x, run.y).type, null, R).ord = true;
            break;
          }
        }
      }
    }
    // 1. ensembles (POI-Ensembles): the core on a good spot, companions to its left and right
    const ensBudget = Math.floor(R.budget * cfg.ensembles / 100);
    const ensList = Object.entries(D.poiSets || {}).filter(([id, e]) => (e.weight ?? 1) > 0 && (e.members || []).length && (!e.roles?.length || e.roles.includes(R.role)) && (!ov.sets.length || ov.sets.includes(id)))
      .sort(([a], [b]) => (tale?.sets.includes(b) ? 1 : 0) - (tale?.sets.includes(a) ? 1 : 0));
    const pool = cands(R, true).filter(c => !hangOnly(c));
    let ensPlaced = 0;
    for (let k = 0; k < 6 && ensList.length && ensPlaced < ensBudget; k++) {
      const open = ensList.filter(([id]) => !items.some(it => it.room === R.key && it.ens === id));   // each ensemble once per room
      if (!open.length) break;
      const [eid, E] = pickWeighted(open, ([id, e]) => (e.weight ?? 1) * (e.roles?.length ? 2 : 1) * (tale?.sets.includes(id) ? 6 : 1), hash(k, ri, s0 + 21));
      const places = E.place?.length ? E.place : ['floor_in'];
      const at = (c, x, y) => fitsAt(c, x, y) && aiClear(c, x, y) && places.includes(spots.at(x, y).type);
      for (const a of order.filter(s => places.includes(s.type) && (!E.corner || s.corner || k > 2)).slice(0, 40)) {
        if (!free(a.x, a.y) || keep.has(a.x + ',' + a.y)) continue;
        const ms = E.members, plan = [], used = new Set();
        // the same thing twice only where the plan repeats the core (a row of benches, registers, sandbags)
        const coreTags = String(ms[0].tag || '').split('|').map(t => t.trim()), repeats = m => String(m.tag || '').split('|').some(t => coreTags.includes(t.trim()));
        const c0 = pickWeighted(pool.filter(c => !c.borrowed && matchesTag(c, ms[0].tag) && at(c, c.w === 2 && a.corner === 'r' ? a.x - 1 : a.x, a.y)), c => weight(c, R.role), hash(a.x, a.y, s0 + 31 + k));
        if (!c0) continue;
        const cx = c0.w === 2 && a.corner === 'r' ? a.x - 1 : a.x;   // a wide core at a right-hand wall leans away from it
        plan.push([c0, cx]); for (let i = 0; i < c0.w; i++) used.add(cx + i);
        let L = cx - 1, Rr = cx + c0.w, fail = false;
        for (const m of ms.slice(1)) {
          const left = m.side === 'left', x0 = left ? L - (m.gap || 0) : Rr + (m.gap || 0);
          const xsOf = c => left ? x0 - c.w + 1 : x0;
          const c = pickWeighted(pool.filter(c => matchesTag(c, m.tag) && (repeats(m) || !plan.some(([o]) => o.name === c.name)) && ![...Array(c.w).keys()].some(i => used.has(xsOf(c) + i)) && at(c, xsOf(c), a.y)), c => weight(c, R.role), hash(x0, a.y, s0 + 41 + k));
          if (!c) { if (!m.optional) { fail = true; break; } continue; }
          const xs = xsOf(c);
          plan.push([c, xs]); for (let i = 0; i < c.w; i++) used.add(xs + i);
          if (left) L = xs - 1; else Rr = xs + c.w;
        }
        if (fail || plan.length < 2 || !gapFree(L + 1, Rr - 1, a.y, cfg.minGap)) continue;
        for (const [c, x] of plan) put(c, x, a.y, 'stand', spots.at(x, a.y).type, eid, R);
        ensPlaced += plan.length;
        break;
      }
    }
    // 2. single things up to the budget, a free tile between neighbours, corners and spots under lamps first
    if (!singles) continue;
    const single = cands(R).filter(c => !hangOnly(c)), ais = () => items.filter(it => it.ai && it.room === R.key).length;
    for (const s of order) {
      if (R.placed >= R.budget) break;
      if (!free(s.x, s.y) || keep.has(s.x + ',' + s.y)) continue;
      const fit = single.filter(c => (!c.ai || ais() < cfg.aiMax) && same(c) < cfg.sameMax && fitsAt(c, s.x, s.y) && aiClear(c, s.x, s.y) && gapFree(s.x, s.x + c.w - 1, s.y, cfg.minGap));
      const c = pickWeighted(fit, c => weight(c, R.role), hash(s.x, s.y, s0 + 51));
      if (c) put(c, s.x, s.y, 'stand', s.type, null, R);
    }
    // 3. on the back wall and under the ceiling: a small share of the budget, far apart, away from ladders and doors
    // borrowed from another set only when its rule names this room's role (a ZONE 13 sign stays in the bunker)
    const wallBudget = Math.round(R.budget * (ov.wall ?? cfg.wall) / 100), hangPool = cands(R, true).filter(c => list(c.rule.place).some(p => p === 'wall' || p === 'ceiling') && (!c.borrowed || list(c.rule.roles).includes(R.role)));
    let hung = 0;
    // #179 things that hang over others (Regel „Über“, e.g. aisle signs over the shelf rows): one over each thing with that tag, in order
    // left to right through the candidates (Gangschild 1, 2, 3 …), under the ceiling straight above its middle, with room to hang
    const overs = hangPool.filter(c => c.rule.above && list(c.rule.place).includes('ceiling') && weight(c, R.role) > 0).sort((a, b) => String(a.name).localeCompare(String(b.name), 'de', { numeric: true }));
    if (overs.length) {
      const tag = overs[0].rule.above, rows = items.filter(it => it.room === R.key && it.hang === 'stand' && !it.debris && list(it.tags).includes(tag)).sort((a, b) => a.y - b.y || a.x - b.x);
      let k = 0;
      for (const it of rows) {
        const cx = it.x + Math.floor(it.w / 2), c = overs[k % overs.length];
        const s = spots.list.filter(o => o.type === 'ceiling' && o.x === cx && o.y < it.y && o.y + o.drop >= it.y - 1 && o.drop >= it.h + c.h + 1).sort((a, b) => b.y - a.y)[0];
        if (!s || wallKeep.has(s.x + ',' + s.y) || items.some(o => o.hang !== 'stand' && Math.abs(o.x - s.x) < 3 && Math.abs(o.y - s.y) < 3)) continue;
        let ld = false; for (let d = 0; d < s.drop; d++) for (const dx of [-1, 0, 1]) if (ch(s.x + dx, s.y + d) === 'H') ld = true;
        if (ld) continue;
        put(c, s.x, s.y, 'ceiling', 'ceiling', null, R); hung++; k++;
      }
    }
    const hangOrder = [...R.hang].sort((a, b) => ((b.side ? 1 : 0) + hash(b.x, b.y, s0 + 61)) - ((a.side ? 1 : 0) + hash(a.x, a.y, s0 + 61)));
    for (const s of hangOrder) {
      if (hung >= wallBudget) break;
      if (wallKeep.has(s.x + ',' + s.y) || items.some(it => it.hang !== 'stand' && Math.abs(it.x - s.x) < 5 && Math.abs(it.y - s.y) < 3)) continue;
      if (s.type === 'ceiling') { let ld = false; for (let k = 0; k < s.drop; k++) for (const dx of [-1, 0, 1]) if (ch(s.x + dx, s.y + k) === 'H') ld = true; if (ld) continue; }
      const airUp = n => { for (let k = 1; k <= n; k++) if (ch(s.x, s.y - k) !== '.') return false; return true; };   // #179 lifted wall things need the wall above free
      const fit = hangPool.filter(c => !c.rule.above && list(c.rule.place).includes(s.type) && c.w === 1 && same(c) < cfg.sameMax && (s.type !== 'ceiling' || s.drop >= c.h + 3) && (s.type !== 'wall' || !(+c.rule.lift > 0) || airUp(Math.ceil(+c.rule.lift + c.h / 2))));
      const c = pickWeighted(fit, c => weight(c, R.role), hash(s.x, s.y, s0 + 71));
      if (c) { put(c, s.x, s.y, s.type, s.type, null, R); hung++; }
    }
  }
  // #159 then decay: per region (its story's decay) things tip over, slide, leave gaps; debris lies about on free floor
  let kept = items;
  ri = 0;
  for (const R of regions.values()) {
    ri++;
    if (!R.decay) continue;
    const mine = items.filter(it => it.room === R.key);
    R.aged = ageItems(mine, R.decay, s0 + ri, dcfg);
    const n = Math.round(dcfg.debris * R.decay * R.stand.length * (R.scale ?? 1) / 10);
    for (const s of R.stand.filter(s => !keep.has(s.x + ',' + s.y) && free(s.x, s.y) && (s.type === 'floor_in' || s.type === 'floor_out')).sort((a, b) => hash2(a.x, a.y, s0 + 7) - hash2(b.x, b.y, s0 + 7)).slice(0, n))
      items.push({ x: s.x, y: s.y, w: 1, h: 1, hang: 'stand', type: s.type, debris: true, room: R.key, seed: hash2(s.x, s.y, s0) });
  }
  kept = items.filter(it => !it.gone);
  return { items: kept, regions: [...regions.values()].map(({ stand, hang, ...r }) => r), planned: (x, y) => poolOf(idAt(x, y - 1)).length > 0, keep };
}

// ---------- autotiling (#158 step 6) ----------
// Set je Gebäude-Hülle: a wall tile takes the Kachel-Set of the room whose air is nearest to it (straight up, left, right, down, up
// to `reach` tiles; on a tie the air above wins, its floor), instead of the room in its column. So the seam between a building and the
// desert next to it runs through the middle of the wall, not along the room's edge. Deep rock without air near keeps idAt.
export function hullMap(room, reg, reach = 6) {
  const { w, h, tiles } = room, cache = new Map(), idAt = reg.idAt || (() => null);
  const wall = (x, y) => x < 0 || y < 0 || x >= w || y >= h || WALLISH.has(tiles[y][x]) || tiles[y][x] === 'D' || tiles[y][x] === 'B';
  return (x, y) => {
    const k = x + ',' + y;
    if (cache.has(k)) return cache.get(k);
    let best = null;
    // cost: up = distance, sideways + 0.5, down + 3 (a floor belongs to the room standing on it, not to the tunnel under it)
    for (const [dx, dy, extra] of [[0, -1, 0], [-1, 0, 0.5], [1, 0, 0.5], [0, 1, 3]]) {
      for (let d = 1; d <= reach; d++) {
        const ax = x + dx * d, ay = y + dy * d;
        if (ax < 0 || ay < 0 || ax >= w || ay >= h) break;
        if (!wall(ax, ay)) { if (!best || d + extra < best.d) best = { d: d + extra, id: idAt(ax, ay) }; break; }
      }
    }
    const id = best ? best.id : idAt(x, y);
    cache.set(k, id);
    return id;
  };
}
// which edge case a wall tile is (16 cases of its four neighbours + the inner corners): → { top, capL, capR, under, innerL, innerR }
//   top = air above (surface), capL/capR = a surface tile whose side is open (a run ends: cap, outer corner, pillar), under = air
//   below (ceiling underside, the lower face of a ledge), innerL/innerR = a surface tile at the foot of a wall going up (inner corner)
export function tileCase(solid, x, y) {
  const top = !solid(x, y - 1), under = !solid(x, y + 1);
  return { top, under, capL: top && !solid(x - 1, y), capR: top && !solid(x + 1, y), innerL: top && solid(x - 1, y - 1), innerR: top && solid(x + 1, y - 1) };
}

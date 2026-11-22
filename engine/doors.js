// NomadGirl – Türen (#174, Daniel 22.11.2026: „Wir brauchen Türen in der orthogonalen Seitensicht, damit die Level mehr wie Level
// wirken. Offen und geschlossen und zerstört“; Wahl: beides + funktional). Pure logic for the browser and Node (no DOM).
//
// Two kinds of doors, both planned after the rooms are welded (engine/poi.js › buildPoi), deterministic per level seed:
//   side  Durchgangstüren im Profil: in a doorway of a wall between two spaces (a seam between rooms, the way into a building, an
//         opening in an inner wall). The layout marks them with „/“ (Zeichen-Legende); the game makes them bodies: shut = solid and
//         blind (sight, light, fog), E opens and shuts them, enemies open them, hits, shots and grenades break them (by material).
//   front Rückwand-Türen frontal: on a wall spot (Ort-Typ wall, #158) of an indoor room, by role; most are scenery (open with a dark
//         way in, shut, broken, boarded), a few are real: E steps through into the side room they are paired with (and back).
// A door's state is rolled by the decay of its room (POIs › Story › Verfall, Spiel › Türen › Zustände) and the POI's event; „locked“
// doors are only kept where a reach check (engine/reach.js) shows that nothing the level needs lies behind them (keys, switches, the
// goal, the shortcut): the main way is always open by E or by force. The cycle graph's locks (#168, „|“) stay what they are.
//
//   doorConfig(D)                      Spiel › Türen with the code defaults
//   doorTypes(D)                       the catalog (data/doors.json, Welt › Türen)
//   doorCandidates(tiles, rooms, D)    every doorway in the welded layout → [{ x, y0, y1, h, kind, a, b }]
//   planDoors(D, poiId, L, seed)       → { side: [...], front: [...], links: n, problems } and „/“ in L.def.layout
//   doorAudit(D, poiId, L)             findings: doors on ladders or in shafts, locked doors that cut off what the level needs
//   doorLayout(L, { locked })          the layout with locked (or all shut) doors as wall, for reach checks
import { reach } from './reach.js';
import { roomStory } from './story.js';
import { planHull, hullConfig } from './facade.js';
import { landmarkViews, wowOf } from './level_design.js';

export const DOOR_MATERIALS = [['wood', 'Holz'], ['steel', 'Stahl (Feuerschutz)'], ['glass', 'Glas (Schiebetür)'], ['shutter', 'Rolltor'], ['grate', 'Gittertür'], ['bulkhead', 'Schott mit Handrad']];
export const DOOR_STATES = [['open', 'offen'], ['closed', 'zu'], ['broken', 'zerstört'], ['locked', 'verschlossen']];
export const DOOR_OPENING = [['swing', 'schwingt auf (Flügel steht daneben)'], ['slide', 'gleitet zur Seite'], ['roll', 'fährt hoch']];
export const DOOR_KINDS = [['seam', 'Naht zwischen Räumen'], ['entrance', 'Gebäude-Eingang (draußen → drinnen)'], ['inner', 'Durchbruch in einer Innenwand'], ['hand', 'von Hand (Zeichen „/“)']];
export const DOOR_BREAK = [['all', 'Hiebe, Schüsse, Granaten'], ['heavy', 'nur Hiebe und Granaten'], ['blast', 'nur Granaten'], ['never', 'gar nicht']];

// Spiel › Türen
export const DOORS = { enabled: true, seam: 50, entrance: 90, inner: 40, front: true, frontEvery: 14, frontLink: 60, lockedMax: 1, sideLocked: 40, enemies: true, patrol: false,
  minH: 3, maxH: 4, splinters: 14, hitFlash: true };
// Zustände je Verfall (POIs › Story › Verfall 0–3): weights of open / closed / broken / locked
export const DOOR_STATE_ROWS = [{ decay: 0, open: 25, closed: 65, broken: 5, locked: 5 }, { decay: 1, open: 30, closed: 50, broken: 15, locked: 5 },
  { decay: 2, open: 30, closed: 35, broken: 30, locked: 5 }, { decay: 3, open: 25, closed: 20, broken: 50, locked: 5 }];

const num = (v, d) => v == null || v === '' || Number.isNaN(+v) ? d : +v;
const list = v => Array.isArray(v) ? v : String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);
export const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const indoorOf = (D, id) => { const r = D?.rooms?.[id] || {}; return r.indoor ?? !(r.backdrop?.image || r.backdrop?.weather); };

export function doorConfig(D) {
  const g = D?.game?.doors || {}, c = { ...DOORS };
  for (const [k, v] of Object.entries(g)) if (k in DOORS && v != null && v !== '') c[k] = typeof DOORS[k] === 'number' ? num(v, DOORS[k]) : v;
  c.states = (Array.isArray(g.states) && g.states.length ? g.states : DOOR_STATE_ROWS).map(r => ({ decay: num(r.decay, 0), open: num(r.open, 0), closed: num(r.closed, 0), broken: num(r.broken, 0), locked: num(r.locked, 0) }));
  return c;
}
// the catalog; a type: { name, material, opening, health, breaks, side: { closed, broken }, front: { closed, open, broken, boarded, locked }, hulls, roles, kinds, weight, … }
export function doorTypes(D) { return Object.fromEntries(Object.entries(D?.doors || {}).filter(([, t]) => t && t.off !== true)); }

// which type fits: the building type of the POI (POIs › Hülle › Gebäudetyp), the room's role and the kind of doorway; weighted, by hash
export function pickType(D, { hull, role, kind, view = 'side', r }) {
  const all = Object.entries(doorTypes(D)).filter(([, t]) => view === 'side' ? t.side?.closed : t.front?.closed);
  if (!all.length) return null;
  const score = ([, t]) => {
    const hs = list(t.hulls), rs = list(t.roles), ks = list(t.kinds);
    if (ks.length && !ks.includes(kind)) return 0;
    let w = num(t.weight, 10);
    if (hs.length) w *= hull && hs.includes(hull) ? 3 : 0.15;
    if (rs.length) w *= role && rs.includes(role) ? 2 : 0.3;
    if (view === 'front' && t.frontWeight != null) w *= num(t.frontWeight, 100) / 100;
    return Math.max(0, w);
  };
  const weighted = all.map(e => [e, score(e)]).filter(([, w]) => w > 0), sum = weighted.reduce((s, [, w]) => s + w, 0);
  if (!sum) return all[Math.floor(r * all.length)][0];
  let k = r * sum;
  for (const [[id], w] of weighted) { k -= w; if (k <= 0) return id; }
  return weighted.at(-1)[0][0];
}
// the state by decay (+ the POI's event: sealed places keep their doors shut, a fight or a fire leaves them broken)
export function rollState(cfg, decay, event, r) {
  const row = cfg.states.reduce((best, s) => Math.abs(s.decay - decay) < Math.abs(best.decay - decay) ? s : best, cfg.states[0]);
  const w = { open: row.open, closed: row.closed, broken: row.broken, locked: row.locked };
  if (event === 'sealed' || event === 'orderly') { w.closed *= 2; w.broken *= 0.4; w.open *= 0.6; }
  if (event === 'fight' || event === 'fire') w.broken *= 1.6;
  if (event === 'flight') w.open *= 1.6;
  const sum = w.open + w.closed + w.broken + w.locked;
  if (sum <= 0) return 'closed';
  let k = r * sum;
  for (const s of ['open', 'closed', 'broken', 'locked']) { k -= w[s]; if (k <= 0) return s; }
  return 'closed';
}

// a doorway: a column of 3–4 free tiles with solid floor under it and a lintel (two tiles of wall) over it, in a wall at most 3 thick
// between two taller spaces that both belong to a room (no tunnel, no shaft corridor)
const BUSY = 'HDSCZ+|L^v@!%$Bo';
export function doorCandidates(tiles, rooms, { minH = 3, maxH = 4 } = {}) {
  const H = tiles.length, W = tiles[0]?.length || 0, at = (x, y) => (y < 0 || y >= H || x < 0 || x >= W ? '#' : tiles[y][x]);
  const roomAt = (x, y) => rooms.findIndex(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  const col = new Map();   // 'x,y1' → h
  for (let x = 1; x < W - 1; x++) for (let y1 = 1; y1 < H - 1; y1++) {
    if (at(x, y1) !== '.' || at(x, y1 + 1) !== '#') continue;
    let h = 0; while (at(x, y1 - h) === '.') h++;
    if (h < minH || h > maxH || at(x, y1 - h) !== '#' || at(x, y1 - h - 1) !== '#') continue;
    col.set(x + ',' + y1, h);
  }
  const out = [], used = new Set();
  for (const [k, h] of col) {
    if (used.has(k)) continue;
    const [x0, y1] = k.split(',').map(Number);
    if (col.get((x0 - 1) + ',' + y1) === h) continue;   // not the left end of the run
    let n = 1; while (col.get((x0 + n) + ',' + y1) === h) { used.add((x0 + n) + ',' + y1); n++; }
    if (n > 3) continue;
    const L = x0 - 1, R = x0 + n, y0 = y1 - h + 1;
    // both sides: room to stand and taller than the doorway
    const side = x => at(x, y1) === '.' && at(x, y1 - 1) === '.' && at(x, y0 - 1) !== '#' && '#=H'.includes(at(x, y1 + 1));
    if (!side(L) || !side(R)) continue;
    const a = roomAt(L, y1), b = roomAt(R, y1);
    if (a < 0 || b < 0) continue;
    const x = x0 + ((n - 1) >> 1);
    out.push({ x, y0, y1, h, run: [x0, x0 + n - 1], a, b });
  }
  return out;
}

const roleOf = (D, id) => D?.rooms?.[id]?.role || (indoorOf(D, id) ? 'general' : 'outdoor');
// where nothing may stand next to a door: ladders, switches, chests, keys and locks, the start, the shortcut, secrets, terminals, sirens
function busyNear(tiles, x, y0, y1, r = 2) {
  for (let y = y0 - 1; y <= y1 + 1; y++) for (let dx = -r; dx <= r; dx++) { const c = tiles[y]?.[x + dx]; if (c && BUSY.includes(c)) return true; }
  return false;
}

export function planDoors(D, poiId, L, seed = 1) {
  const out = { side: [], front: [], links: 0, problems: [] };
  const cfg = doorConfig(D);
  if (!L?.def || cfg.enabled === false || !Object.keys(doorTypes(D)).length) return out;
  const P = D.pois?.[poiId] || {}, rows = L.def.layout.map(r => [...r]), H = rows.length, W = rows[0]?.length || 0;
  const hull = hullConfig(D, poiId).type || null, event = P.story?.eventKind || '';
  const rooms = L.rooms || [], wow = rooms.find(r => r.wow), s0 = (seed * 7919 + 174) >>> 0;
  // tiles the cycle graph uses (locks, collapses, one-ways, switch–door links) keep their space
  const C = L.cycles || {}, claimed = [];
  for (const l of C.locks || []) claimed.push(...l.tiles);
  for (const c of C.collapses || []) claimed.push(...c.tiles);
  for (const o of C.oneWays || []) claimed.push(o.from, o.land);
  for (const k of C.links || []) claimed.push(k.switch, k.door);
  const nearClaim = (x, y0, y1) => claimed.some(([cx, cy]) => Math.abs(cx - x) <= 2 && cy >= y0 - 2 && cy <= y1 + 2);
  let start = null; for (let y = 0; y < H && !start; y++) { const x = rows[y].indexOf('L'); if (x >= 0) start = [x, y]; }
  const shaft = L.shortcut?.shaft || null;   // [x, y, w, h] of a stacked POI's shortcut shaft
  const inShaft = x => shaft && x >= shaft[0] - 2 && x <= shaft[0] + shaft[2] + 1;
  const decayOf = id => roomStory(P, D.rooms?.[id] || {}).decay;

  // ---------- side doors ----------
  const add = (c, kind, inside) => {
    const room = rooms[inside], role = roleOf(D, room.id), r = k => hash(c.x, c.y1, s0 + k);
    const type = pickType(D, { hull, role, kind, view: 'side', r: r(3) });
    if (!type) return;
    let state = rollState(cfg, decayOf(room.id), event, r(5));
    // ⚠️ locked only at a side room (band 'branch'): the main way between main rooms never waits for a lock (reach check on top)
    const side = kind !== 'entrance' && [rooms[c.a], rooms[c.b]].some(o => o?.band === 'branch');
    if (state === 'locked' && !side) state = 'closed';
    else if (side && state === 'closed' && r(7) * 100 < cfg.sideLocked) state = 'locked';   // a side room keeps its loot behind a lock more often
    out.side.push({ id: `d${out.side.length}`, x: c.x, y: c.y0, h: c.h, feet: c.y1, kind, type, material: D.doors[type].material || 'wood', state,
      room: room.id, rx: c.x - room.x, ry: c.y1 - room.y, a: rooms[c.a]?.id, b: rooms[c.b]?.id });
  };
  // hand-placed doors („/“ in a room layout): kept, rolled like the others
  const hand = new Set();
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    if (rows[y][x] !== '/' || hand.has(x + ',' + y)) continue;
    let y1 = y; while (rows[y1 + 1]?.[x] === '/') y1++;
    for (let k = y; k <= y1; k++) hand.add(x + ',' + k);
    const ri = rooms.findIndex(r => x >= r.x && x < r.x + r.w && y1 >= r.y && y1 < r.y + r.h);
    if (ri >= 0) add({ x, y0: y, y1, h: y1 - y + 1, a: ri, b: ri }, 'hand', ri);
  }
  for (const c of doorCandidates(rows, rooms, cfg)) {
    const A = rooms[c.a], B = rooms[c.b], inA = indoorOf(D, A.id), inB = indoorOf(D, B.id);
    if (!inA && !inB) continue;   // outdoors to outdoors: no door
    if (busyNear(rows, c.x, c.y0, c.y1) || nearClaim(c.x, c.y0, c.y1) || inShaft(c.x)) continue;
    if (start && Math.abs(start[0] - c.x) <= 4 && Math.abs(start[1] - c.y1) <= 4) continue;
    // the Wow room: no door at its way in (the camera ride starts there) nor inside it
    if (wow && c.x >= wow.x - 2 && c.x <= wow.x + wow.w + 1 && c.y1 >= wow.y && c.y1 < wow.y + wow.h) continue;
    const kind = c.a !== c.b ? (inA !== inB ? 'entrance' : 'seam') : 'inner';
    if (kind === 'inner' && !inA) continue;
    const chance = kind === 'entrance' ? cfg.entrance : kind === 'seam' ? cfg.seam : cfg.inner;
    if (hash(c.x, c.y1, s0 + 1) * 100 >= chance) continue;
    add(c, kind, inA ? c.a : c.b);
  }
  for (const d of out.side) for (let y = d.y; y <= d.feet; y++) rows[y][d.x] = '/';
  L.def.layout = rows.map(r => r.join(''));
  // locked doors only where nothing the level needs lies behind them; at most Spiel › Türen › Verschlossen höchstens
  let locked = out.side.filter(d => d.state === 'locked');
  for (const d of locked.slice(Math.max(0, cfg.lockedMax))) d.state = 'closed';
  locked = out.side.filter(d => d.state === 'locked');
  while (locked.length && cutsOff(L, out.side)) { locked.at(-1).state = 'closed'; locked.pop(); }

  // ---------- front doors (back wall) ----------
  if (cfg.front !== false) planFront(D, poiId, L, rows, out, { cfg, hull, event, s0, decayOf, start });
  return out;
}

// would the locked doors cut Leyla off from something the level needs? (keys, switches, the goal, both ends of the shortcut, the exit)
export function cutsOff(L, side) {
  // switch doors (D) stay shut here: the rough model would walk the shortcut backwards through them and miss a locked door on the main way
  const noD = rows => rows.map(r => r.replace(/D/g, '#'));
  const lay = noD(doorLayout(L, { side, locked: true })), R = reach(lay, {}), base = reach(noD(doorLayout(L, { side })), {});
  const need = [];
  for (let y = 0; y < lay.length; y++) for (let x = 0; x < lay[y].length; x++) if ('+SZ'.includes(L.def.layout[y][x])) need.push([x, y]);
  for (const e of ['up', 'down']) if (L.shortcut?.[e]) need.push(L.shortcut[e]);
  if (need.some(([x, y]) => base.can(x, y) && !R.can(x, y))) return true;
  // stricter than the rough model (switch doors, one-ways, the way home): what a locked door shuts off is a dead end inside rooms, with no
  // switch, key, lock, switch door, goal, shortcut or start in it (a chest is fine: that is what the lock guards)
  const rooms = L.rooms || [], inRoom = (x, y) => rooms.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h), src = L.def.layout;
  for (const k of base.reached) {
    if (R.reached.has(k)) continue;
    const [x, y] = k.split(',').map(Number);
    if (!inRoom(x, y)) return true;
    for (let dy = -3; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) { const c = src[y + dy]?.[x + dx]; if (c && 'SZ+D|v^L'.includes(c)) return true; }
  }
  return false;
}
// the layout for reach checks: doors as '.', locked ones (or all shut ones with { shut: true }) as '#'
export function doorLayout(L, { side = L.doors?.side || [], locked = false, shut = false } = {}) {
  const rows = L.def.layout.map(r => [...r]);
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === '/') rows[y][x] = '.';
  for (const d of side) if ((locked && d.state === 'locked') || (shut && d.state !== 'open' && d.state !== 'broken')) for (let y = d.y; y <= d.feet; y++) rows[y][d.x] = '#';
  return rows.map(r => r.join(''));
}

// front doors: 3 wide, 4 high of free back wall over a solid floor, indoors, away from windows, ladders, doors and everything busy
function planFront(D, poiId, L, rows, out, { cfg, hull, event, s0, decayOf, start }) {
  const rooms = L.rooms || [], at = (x, y) => rows[y]?.[x];
  const holes = new Set();
  try {
    const plan = planHull(D, poiId, L);
    for (const w of plan.windows || []) if (w.where === 'room') for (let y = w.y - 1; y <= w.y + w.h; y++) for (let x = w.x - 1; x <= w.x + w.w; x++) holes.add(x + ',' + y);
    for (const v of landmarkViews(D, poiId, L)) if (v.win) for (let y = v.win.y - 1; y <= v.win.y + v.win.h; y++) for (let x = v.win.x - 1; x <= v.win.x + v.win.w; x++) holes.add(x + ',' + y);
  } catch { /* no hull, no landmark */ }
  const sideX = out.side.map(d => [d.x, d.feet]);
  const spot = (x, f) => {   // f = floor row (solid), the door stands on it, 4 rows of air above for 3 tiles of width
    for (let dx = 0; dx < 3; dx++) { if (at(x + dx, f) !== '#') return false; for (let dy = 1; dy <= 4; dy++) if (at(x + dx, f - dy) !== '.' || holes.has((x + dx) + ',' + (f - dy))) return false; }
    for (let y = f - 5; y <= f; y++) for (let dx = -2; dx <= 4; dx++) { const c = at(x + dx, y); if (c && (BUSY.includes(c) || c === '/' || c === '=')) return false; }
    if (sideX.some(([sx, sy]) => Math.abs(sx - (x + 1)) <= 4 && Math.abs(sy - (f - 1)) <= 4)) return false;
    if (start && Math.abs(start[0] - (x + 1)) <= 4 && Math.abs(start[1] - (f - 1)) <= 4) return false;
    return true;
  };
  const W0 = wowOf(D, poiId)?.room;
  const spots = rooms.map((r, ri) => {
    if (!indoorOf(D, r.id) || r.id === W0 || r.wow) return [];
    const list = [];
    for (let f = r.y + 4; f < r.y + r.h; f++) for (let x = r.x + 2; x < r.x + r.w - 4; x++) if (spot(x, f)) list.push([x, f]);
    return list;
  });
  const RF = reach(doorLayout(L, { side: out.side, locked: true }), {});   // a real way in must be reachable
  const taken = [];
  const free = (x, f) => !taken.some(([tx, tf]) => Math.abs(tx - x) < 8 && Math.abs(tf - f) < 5);
  const make = (ri, [x, f], extra = {}) => {
    const r = rooms[ri], role = roleOf(D, r.id), k = n => hash(x, f, s0 + n);
    const type = pickType(D, { hull, role, kind: 'front', view: 'front', r: k(13) });
    if (!type) return null;
    let state = extra.link != null ? (k(15) < 0.5 ? 'open' : 'closed') : rollState(cfg, decayOf(r.id), event, k(17));
    const T = D.doors[type];
    if (state === 'locked') state = T.front?.boarded ? 'boarded' : T.front?.locked ? 'locked' : 'closed';
    const d = { id: `f${out.front.length}`, x, y: f - 4, w: 3, h: 4, feet: f - 1, type, material: T.material || 'wood', state, room: r.id, rx: x - r.x, ry: f - 1 - r.y, ...extra };
    out.front.push(d); taken.push([x, f]);
    return d;
  };
  // real ones first: a side room (band 'branch') gets a door paired with one in a main room near it (Spiel › Türen › Echte Eingänge %)
  rooms.forEach((r, ri) => {
    if (r.band !== 'branch' || !spots[ri].length || hash(r.x, r.y, s0 + 21) * 100 >= cfg.frontLink) return;
    const mains = rooms.map((m, mi) => [m, mi]).filter(([m, mi]) => m.band === 'main' && spots[mi].length).sort((p, q) => Math.abs(p[0].x + p[0].w / 2 - r.x - r.w / 2) - Math.abs(q[0].x + q[0].w / 2 - r.x - r.w / 2));
    if (!mains.length) return;
    const ok = ([x, f]) => free(x, f) && RF.can(x + 1, f - 1), [, mi] = mains[0], a = spots[ri].filter(ok), b = spots[mi].filter(ok);
    if (!a.length || !b.length) return;
    const pa = a[Math.floor(hash(r.x, r.y, s0 + 23) * a.length)], pb = b[Math.floor(hash(r.x, r.y, s0 + 25) * b.length)];
    const da = make(ri, pa, { link: -1 }), db = da && make(mi, pb, { link: -1 });
    if (!da || !db) { if (da) out.front.splice(out.front.indexOf(da), 1); return; }
    da.link = out.front.indexOf(db); db.link = out.front.indexOf(da); da.state = db.state = da.state === 'open' ? 'open' : 'closed';
    out.links++;
  });
  // scenery: about one per Spiel › Türen › Rückwand-Türen: Abstand free spots (by role: no front doors in caves or outdoors)
  rooms.forEach((r, ri) => {
    const role = roleOf(D, r.id);
    if (role === 'cave' || role === 'outdoor') return;
    let n = 0;
    for (const [x, f] of spots[ri]) {
      if (n >= (r.w >= 34 ? 2 : 1) || !free(x, f) || hash(x, f, s0 + 31) * cfg.frontEvery >= 1) continue;
      if (make(ri, [x, f])) n++;
    }
  });
}

// ---------- the checker (tools/level_audit.mjs, tools/reach_audit.mjs, test/doors.test.js) ----------
export function doorAudit(D, poiId, L) {
  const out = [], doors = L.doors || { side: [], front: [] }, lay = L.def.layout, add = (what, text) => out.push({ what, text });
  for (const d of doors.side) {
    for (let y = d.y - 1; y <= d.feet + 1; y++) for (let dx = -1; dx <= 1; dx++) if (lay[y]?.[d.x + dx] === 'H') { add('Tür', `${d.id} an einer Leiter (${d.x},${d.feet})`); y = d.feet + 2; break; }
    if (lay[d.feet + 1]?.[d.x] !== '#') add('Tür', `${d.id} ohne Boden (${d.x},${d.feet})`);
    if (lay[d.y - 1]?.[d.x] !== '#') add('Tür', `${d.id} ohne Sturz (${d.x},${d.y})`);
    const sh = L.shortcut?.shaft; if (sh && d.x >= sh[0] && d.x < sh[0] + sh[2]) add('Tür', `${d.id} im Schacht`);
    if (d.feet - d.y + 1 < 3) add('Tür', `${d.id} niedriger als Leyla`);
    const T = D.doors?.[d.type]; if (!T) add('Tür', `${d.id}: Türsatz „${d.type}“ fehlt`);
  }
  if (doors.side.some(d => d.state === 'locked') && cutsOff(L, doors.side)) add('Softlock', 'eine verschlossene Tür schneidet Schlüssel, Schalter, Tresor oder Abkürzung ab');
  // every shut door can be passed by E: with all shut ones open the goal is reached; locked ones count shut
  const R = reach(doorLayout(L, { locked: true }), {});
  let goal = null; for (let y = 0; y < lay.length && !goal; y++) { const x = lay[y].indexOf('Z'); if (x >= 0) goal = [x, y]; }
  if (goal && !R.can(...goal)) add('Softlock', 'Tresor mit verschlossenen Türen nicht erreichbar');
  const RF = reach(doorLayout(L, { locked: true }), {});
  for (const f of doors.front) {
    if (f.link != null && f.link >= 0 && doors.front[f.link]?.link !== doors.front.indexOf(f)) add('Rückwand-Tür', `${f.id}: Paar kaputt`);
    for (let dy = 0; dy < f.h; dy++) for (let dx = 0; dx < f.w; dx++) if (lay[f.y + dy]?.[f.x + dx] !== '.') { add('Rückwand-Tür', `${f.id} auf belegtem Platz (${f.x + dx},${f.y + dy})`); dy = f.h; break; }
    if (f.link != null && f.link >= 0 && !RF.can(f.x + 1, f.feet)) add('Rückwand-Tür', `${f.id} (Eingang) nicht erreichbar`);
  }
  return out;
}

// NomadGirl – set dressing stage 2 (#159, Daniel 21.11.2026: „Wie können wir das weiter optimieren?“ → order + decay, traces from the
// story, the desert creeps in, back wall clutter, learning from corrections). Browser and Node, no DOM. Used by engine/dressing.js
// (planDressing), engine/atmosphere.js (broken lamps, dim stories), game/play/dressing_fx.js (drawing) and test/dressing.test.js.
import { roomStory } from './story.js';

const list = v => Array.isArray(v) ? v : String(v || '').split(',').map(s => s.trim()).filter(Boolean);
export const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------- 1. order first, then decay ----------
// Originalzustand per room role (Spiel › Set-Dressing › Ordnung): a row of the same thing at a fixed beat, centred in the longest free
// stretch of floor (symmetry). tags: which thing makes the row (| = or), gap: free tiles between two, share: of the room's budget (%)
export const ORDER = [
  { role: 'shop', tags: 'regal|kasse|automat|laden', gap: 1, share: 40 }, { role: 'office', tags: 'tisch|büro', gap: 2, share: 40 },
  { role: 'storage', tags: 'regal|palette|kiste|lager', gap: 1, share: 45 }, { role: 'living', tags: 'bett|sitz|spind', gap: 1, share: 35 },
  { role: 'hall', tags: 'sitz|bank|werkbank|deko', gap: 2, share: 30 }, { role: 'corridor', tags: 'bank|sitz', gap: 2, share: 25 },
  { role: 'tech', tags: 'technik|rohr', gap: 1, share: 30 }];
export function orderConfig(D) {
  const rows = D?.game?.dressing?.order?.length ? D.game.dressing.order : ORDER;
  const m = new Map(rows.filter(r => r.role && r.tags).map(r => [r.role, { tags: r.tags, gap: r.gap ?? 1, share: r.share ?? 35 }]));
  return role => m.get(role) || null;
}
// Verfall (0–3) disturbs the order: per thing a chance to tip over / lean (angle), to slide (px), to be gone (a gap); debris lies about.
// POIs › Story › Verfall, Raum-Bausteine › Story › Verfall hier. Numbers per step in Spiel › Set-Dressing › Verfall.
export const DECAY = { tilt: 12, slide: 18, gap: 8, debris: 1.2, broken: 10 };
export function decayConfig(D) { const g = D?.game?.dressing?.decay || {}; return { ...DECAY, ...Object.fromEntries(Object.entries(g).filter(([k, v]) => k in DECAY && v != null)) }; }
// items of one region (mutated): → { tipped, slid, gone }
export function ageItems(items, decay, seed, cfg = DECAY) {
  const out = { tipped: 0, slid: 0, gone: 0 };
  if (!decay) return out;
  for (const it of items) {
    if (it.hang !== 'stand' || it.debris) continue;
    const r = k => hash(it.x * 7 + k, it.y * 13 + k, seed + 101);
    if (it.ord && r(1) * 100 < cfg.gap * decay) { it.gone = true; out.gone++; continue; }
    if (r(2) * 100 < cfg.tilt * decay) { it.tilt = (r(3) < 0.5 ? -1 : 1) * (it.h <= 1 && r(4) < 0.3 * decay ? 90 : 6 + r(5) * 16 * decay); it.flip = r(6) < 0.5; out.tipped++; }
    if (r(7) * 100 < cfg.slide * decay) { it.dx = Math.round((r(8) - 0.5) * 2 * (6 + 6 * decay)); out.slid++; }
  }
  return out;
}

// ---------- 2. traces from the story (Raum-Geschichten) ----------
// the traces a room story can leave (drawn from code by game/play/dressing_fx.js)
export const DECALS = [['soot', 'Ruß'], ['holes', 'Einschusslöcher'], ['shells', 'Hülsen'], ['blood', 'Blutfleck'], ['puddle', 'Pfützen'], ['drip', 'Tropfen'], ['algae', 'Algen'],
  ['bones', 'Knochen'], ['boards', 'Bretter vor der Tür'], ['cartons', 'Kartons verstreut'], ['camp', 'Feuerstelle'], ['sleep', 'Schlafsack']];
// where a room's traces lie: on free floor and the back wall, from the room rect and the seed → [{ x, y, kind }]
export function taleMarks(T, rect, tiles, seed) {
  const out = [], at = (x, y) => tiles[y]?.[x];
  const floors = [], walls = [];
  for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
    if (at(x, y) !== '.') continue;
    if ('#=A'.includes(at(x, y + 1) || '#')) floors.push([x, y]);
    else if (at(x, y + 1) === '.' && '#='.includes(at(x, y + 2) || '#')) walls.push([x, y]);
  }
  for (const [i, kind] of (T.decals || []).entries()) {
    const onWall = ['soot', 'holes', 'drip', 'algae'].includes(kind), pool = onWall ? walls : floors;
    const n = kind === 'shells' || kind === 'holes' ? 3 : kind === 'cartons' || kind === 'puddle' || kind === 'bones' ? 2 : 1;
    for (let k = 0; k < n && pool.length; k++) { const [x, y] = pool[Math.floor(hash(i * 31 + k, rect.x + rect.y, seed + 601) * pool.length)]; out.push({ x, y, kind }); }
  }
  return out;
}
// a room's story (catalog Raum-Geschichten): the POI's event and who lives there now decide which ones fit (never the dice alone);
// about `share` % of the rooms get one, at most one per room, never the Wow room. → story id or null
export function roomTale(D, poiId, room, index, seed) {
  const T = D?.roomStories || {}, share = D?.game?.dressing?.storyShare ?? 40, R = D.rooms?.[room.id];
  if (!R || R.type === 'wow' || room.wow || hash(index, 7, seed + 303) * 100 >= share) return null;
  const S = roomStory(D.pois?.[poiId] || {}, R), role = S.role;
  const cands = Object.entries(T).filter(([, t]) => (t.chance ?? 50) > 0 && (!t.roles?.length || t.roles.includes(role)));
  const match = t => (t.events || []).includes(S.event) || (t.events || []).includes(S.residents.kind);
  const pool = cands.filter(([, t]) => !t.events?.length || match(t));
  if (!pool.length) return null;
  const w = ([, t]) => (t.chance ?? 50) * (match(t) ? 4 : 1);
  let k = hash(index, 11, seed + 307) * pool.reduce((a, c) => a + w(c), 0);
  for (const c of pool) { k -= w(c); if (k < 0) return c[0]; }
  return pool.at(-1)[0];
}
// every main and side room of a level → Map(index in L.rooms → story id)
export function levelTales(D, poiId, L, seed) {
  const m = new Map();
  (L?.rooms || []).forEach((r, i) => { const t = roomTale(D, poiId, r, i, seed); if (t) m.set(i, t); });
  return m;
}

// ---------- 3. the desert creeps in ----------
// from every opening to the outside (outdoor rooms, windows, open seams) the desert reaches into the building and fades with the
// distance (tiles of air, a walk around walls). POIs › Set-Dressing › Wüste (%, leer = 60; Bunker fast nichts), Reichweite (tiles).
// → { at(x, y) → 0..1 (0 = clean), sources: [[x, y]] }
export function desertField(D, poiId, L, holes = []) {
  const P = D?.pois?.[poiId] || {}, amp = (P.dressing?.desert ?? 60) / 100, reach = P.dressing?.desertReach ?? 14;
  const tiles = L.def.layout, H = tiles.length, W = tiles[0]?.length || 0;
  const indoor = id => { const r = D.rooms?.[id] || {}; return r.indoor ?? !(r.backdrop?.image || r.backdrop?.weather); };
  const out = new Float32Array(W * H), dist = new Int16Array(W * H).fill(-1), q = [], sources = [];
  const air = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !'#A^vDB$'.includes(tiles[y][x]);
  for (const r of L.rooms || []) if (!indoor(r.id)) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (air(x, y)) { dist[y * W + x] = 0; q.push(x, y); }
  for (const [x, y] of holes) if (air(x, y)) { dist[y * W + x] = 2; q.push(x, y); sources.push([x, y]); }
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i], y = q[i + 1], d = dist[y * W + x];
    if (d >= reach) continue;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (air(nx, ny) && dist[ny * W + nx] < 0) { dist[ny * W + nx] = d + 1; q.push(nx, ny); }
  }
  for (let i = 0; i < W * H; i++) out[i] = dist[i] < 0 ? 0 : Math.max(0, 1 - dist[i] / reach) * amp;
  return { at: (x, y) => x >= 0 && y >= 0 && x < W && y < H ? out[y * W + x] : 0, amp, reach, sources };
}
// sand drifts and green in cracks along the floors indoors: → [{ x, y (floor tile), kind: 'sand'|'plant', size (0..1), corner }]
export function desertMarks(field, spots, inside, seed) {
  const out = [];
  for (const s of spots.list) {
    if (s.type !== 'floor_in' && s.type !== 'corner') continue;
    if (!inside(s.x, s.y - 1)) continue;
    const v = field.at(s.x, s.y - 1);
    if (v < 0.12) continue;
    if (s.corner || hash(s.x, s.y, seed + 401) < v) out.push({ x: s.x, y: s.y, kind: 'sand', size: Math.min(1, v * (s.corner ? 1.4 : 0.9)), corner: s.corner });
    if (hash(s.x, s.y, seed + 409) < v * 0.22) out.push({ x: s.x, y: s.y, kind: 'plant', size: v });
  }
  return out;
}

// ---------- 4. back wall clutter ----------
// a layer between the back wall and the world, darkened (Spiel › Set-Dressing › Rückwand dunkler, 35–50 %), no body, no collision:
// pipes along the upper wall, cable ducts, shelves, posters, signs, doors that lead nowhere. By room role. On wall spots only, away
// from ladders, doors, switches, chests and the windows. → [{ x, y, w, h (tiles), kind, room }]
export const BACK_KINDS = { shop: ['poster', 'shelf', 'sign', 'poster'], office: ['poster', 'duct', 'door', 'board'], storage: ['shelf', 'pipe', 'shelf'], tech: ['pipe', 'duct', 'box', 'pipe'],
  hall: ['pipe', 'door', 'sign'], living: ['poster', 'shelf', 'door'], corridor: ['door', 'pipe', 'sign'], general: ['pipe', 'poster'], combat: ['pipe', 'sign'], cave: [], outdoor: [] };
export function planBackWall(D, room, reg, spots, seed, holes = new Set()) {
  const ch = (x, y) => room.tiles[y]?.[x], out = [], taken = new Set();
  const roleAt = reg.roleAt || (() => 'general'), roomAt = reg.roomAt || (() => null);
  const busy = (x, y) => { for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) { const c = ch(x + dx, y + dy); if (c && 'HDSC@!Z%$BL*/'.includes(c)) return true; } return holes.has(x + ',' + y) || taken.has(x + ',' + y); };
  const inside = reg.inside || (() => true), free = (x, y) => ch(x, y) === '.' && inside(x, y) && !busy(x, y);
  const every = D?.game?.dressing?.backEvery ?? 7;
  for (const s of spots.list) {
    if (s.type !== 'wall' || !free(s.x, s.y)) continue;
    const r = roomAt(s.x, s.y), kinds = BACK_KINDS[roleAt(s.x, s.y)] || BACK_KINDS.general;
    if (!kinds.length || hash(s.x, s.y, seed + 501) * every >= 1) continue;
    const kind = kinds[Math.floor(hash(s.x, s.y, seed + 503) * kinds.length)];
    let w = 1, h = 1, y = s.y;
    if (kind === 'pipe') { w = 1; while (w < 6 && free(s.x + w, s.y) && ch(s.x + w, s.y + 1) === '.') w++; }
    if (kind === 'duct') y = free(s.x, s.y - 1) ? s.y - 1 : s.y;
    if (kind === 'shelf' || kind === 'board') { if (!free(s.x + 1, s.y)) continue; w = 2; }
    if (kind === 'door') { if (!free(s.x, s.y + 1)) continue; w = 1; h = 2; }
    if (kind === 'duct' && y !== s.y && !free(s.x, y)) y = s.y;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) taken.add((s.x + dx) + ',' + (y + dy));
    out.push({ x: s.x, y, w, h, kind, room: r?.id || null });
  }
  return out;
}

// ---------- 5. learning from corrections ----------
// Korrekturen (data/dressing_rules.json, Werkstatt › Korrekturen): a rule per correction, for every seed.
//   room: a thing never in rooms of this role · place: never on this place type · much: density of a role × factor ·
//   size: a thing drawn × factor · remove: a thing never again
export const RULE_REASONS = [['room', 'passt nicht in diesen Raum'], ['place', 'passt nicht an diesen Ort'], ['much', 'zu viel hier'], ['size', 'falsche Größe'], ['remove', 'weg damit']];
export function rulesOf(D) {
  const R = Object.values(D?.dressingRules || {}).filter(r => r && r.off !== true);
  return {
    forbids: (name, role, place) => R.some(r => r.thing === name && (r.reason === 'remove' || (r.reason === 'room' && r.role === role) || (r.reason === 'place' && r.place === place))),
    density: role => R.filter(r => r.reason === 'much' && r.role === role).reduce((k, r) => k * (r.factor ?? 0.8), 1),
    size: name => R.filter(r => r.reason === 'size' && r.thing === name).reduce((k, r) => k * (r.factor ?? 0.8), 1),
  };
}
// a new rule from a correction in the game → the entry for data/dressing_rules.json
export function ruleFrom(reason, { thing, role, place, poi, room, factor }) {
  const date = new Date().toISOString().slice(0, 10);
  const what = { room: `„${thing}“ nie in ${role}`, place: `„${thing}“ nie auf ${place}`, much: `${role}: Dichte × ${factor ?? 0.8}`, size: `„${thing}“ × ${factor ?? 0.8}`, remove: `„${thing}“ nie mehr` }[reason];
  return { name: what, reason, thing: reason === 'much' ? '' : thing, role: reason === 'room' || reason === 'much' ? role : '', place: reason === 'place' ? place : '', factor: reason === 'much' || reason === 'size' ? factor ?? 0.8 : undefined, poi, room, date };
}

// NomadGirl – level design by the bible (#163, Daniel 21.11.2026: „Können wir die Bible noch einmal upgraden?“ → docs/concepts/poi_bible.md
// › Level-Design, Wow-Moment). Pure logic for the browser and Node (no DOM): room types, rhythm of pressure and rest, fair fights,
// light at the way on, landmark views, signs at secrets, guide lines and the Wow room. Used by engine/poi.js (welding), the game
// (game/play/level_fx.js, atmosphere) and the level audit (tools/level_audit.mjs, test/level_design.test.js).

// Raumtyp: what a room does in the game (Raum-Rolle = what it was before)
export const ROOM_TYPES = [['threshold', 'Schwelle'], ['corridor', 'Gang'], ['arena', 'Arena'], ['vertical', 'Vertikale'], ['rest', 'Atempause'],
  ['branch', 'Abzweig'], ['boss', 'Boss'], ['wow', 'Wow']];
// where the Wow room sits in the arc (POIs › Wow › Platz im Bogen)
export const WOW_AT = [['peak', 'Höhepunkt (vor dem Ausgang)'], ['mid', 'Mitte'], ['start', 'Schwelle (Eingang)']];
// code silhouettes for the Wow motif and the landmark (game/play/level_fx.js draws them from AAP-64 colours, VT323 for text)
export const MOTIFS = [['priceboard', 'Preistafel'], ['watertower', 'Wasserturm'], ['mast', 'Funkmast-Spitze'], ['dome', 'Glaskuppel'], ['neon', 'Neon-Schild'],
  ['kiosk', 'Kassenhaus'], ['board', 'Anzeigetafel'], ['shaft', 'Lichtschacht'], ['reactor', 'Reaktor'], ['headframe', 'Förderturm'], ['crystals', 'Kristalle'],
  ['clock', 'Große Uhr'], ['flare', 'Fackel'], ['rocket', 'Rakete'], ['pool', 'Leerer Pool'], ['cabin', 'Kabine mit Zetteln'], ['brokenoffice', 'Bruchkante'],
  ['grate', 'Gittertor'], ['nest', 'Nest'], ['cars', 'Autowracks']];
// Leitlinie (POIs › Level-Design › Leitlinie): what runs along the way on
export const GUIDE_KINDS = [['cable', 'Kabel'], ['pipe', 'Rohr'], ['strip', 'Notlicht-Streifen'], ['rail', 'Schienen'], ['lights', 'Lichterkette'], ['carpet', 'Teppich'], ['arrows', 'Fahrbahnpfeile'], ['mud', 'Rinnsal']];
export const STINGERS = [['swell', 'Anschwellen'], ['chord', 'Akkord'], ['bell', 'Glocke'], ['drone', 'Tiefer Ton'], ['neon', 'Neon springt an']];

// Spiel › Level-Design: the numbers of the rules (all editable in the workshop)
export const LEVEL = { peak: 85, calm: 40, rest: 30, seam: 3, shooterMin: 5, exitLight: 150, exitReach: 6, deadEnd: 60, landmarkShare: 34, windowEvery: 2,
  wowZoom: 70, wowMs: 1800, wowHold: 900, wowDark: 30, wowCalm: 45, rewardReach: 4, signReach: 3, firstSign: 100, laterSign: 45 };
export function levelConfig(D) {
  const g = D?.game?.levelDesign || {};
  return { ...LEVEL, ...Object.fromEntries(Object.entries(g).filter(([k, v]) => k in LEVEL && v != null)) };
}

const WALLS = new Set(['#', 'A', '^', 'v', 'D', 'B', '$', '%']);
const isWall = c => c == null || WALLS.has(c);

// Raumtyp of a room (Raum-Bausteine › Raumtyp), else from its tags and shape
export function roomType(room = {}) {
  if (room.type) return room.type;
  const t = room.tags || [], [w = 30, h = 17] = room.size || [];
  if (t.includes('start')) return 'threshold';
  if (t.includes('boss')) return 'boss';
  if ((t.includes('loot') || t.includes('secret')) && !t.includes('combat')) return 'branch';
  if (h >= w * 0.85 || (h >= 20 && t.includes('corridor'))) return 'vertical';
  if (t.includes('combat') || t.includes('exit')) return 'arena';
  return 'corridor';
}

// the Wow room of a POI (POIs › Wow): → { room, at, motif, point } or null
export function wowOf(D, poiId) {
  const P = D?.pois?.[poiId], W = P?.wow;
  if (!W?.room || !D.rooms?.[W.room]?.layout?.length) return null;
  return { room: W.room, at: W.at || 'peak', motif: W.motif || 'neon', point: W.point || null, ...W };
}

// Rhythm (#163 step 3): after every main room from `peak` % on comes one under `calm` % (not when the next one is the exit: the
// way out lies close to the climax). The calm slot prefers a room of type Atempause. intens: [0..1] per main room, mutated
// → [{ at (index of the calm room), was }]
export function calmAfterPeaks(intens, cfg = LEVEL) {
  const out = [];
  for (let i = 0; i < intens.length - 2; i++) {
    if (intens[i] >= cfg.peak / 100 && intens[i + 1] >= cfg.calm / 100) { out.push({ at: i + 1, was: intens[i + 1] }); intens[i + 1] = cfg.rest / 100; }
  }
  return out;
}

// where Leyla comes into and goes out of a main room of a welded level: horizontal POIs at the left / right seam (floor row),
// stacked ones at the ladder through the hook. → { in: [x, y], out: [x, y] } (tiles, feet row) per main room index
export function roomGates(L) {
  const tiles = L.def.layout, mains = L.rooms.filter(r => r.band === 'main');
  const at = (x, y) => tiles[y]?.[x];
  const floorAt = (x, y0, y1) => { for (let y = y1; y >= y0; y--) if (!isWall(at(x, y)) && (isWall(at(x, y + 1)) || at(x, y + 1) === '=' || at(x, y + 1) === 'H')) return y; return y1; };
  const ladderIn = (r, row) => { for (let x = r.x; x < r.x + r.w; x++) if (at(x, row) === 'H') return x; return null; };
  return mains.map((r, i) => {
    if (!L.stack) return { in: [r.x, floorAt(r.x, r.y, r.y + r.h - 2)], out: [r.x + r.w - 1, floorAt(r.x + r.w - 1, r.y, r.y + r.h - 2)] };
    // tower: in through the floor (from below), out through the ceiling; deep: the other way round
    const up = L.stack === 'tower', fx = ladderIn(r, r.y + r.h - 1), cx = ladderIn(r, r.y);
    const inX = up ? fx : cx, outX = up ? cx : fx;
    const g = x => x == null ? null : [x, floorAt(x, r.y, r.y + r.h - 2)];
    return { in: g(inX ?? r.x + 1), out: g(outX ?? r.x + r.w - 2), first: i === 0, last: i === mains.length - 1 };
  });
}

// line of sight between two tiles (eyes one row over the feet), walls block
export function sees(tiles, [x0, y0], [x1, y1]) {
  const at = (x, y) => tiles[y]?.[x];
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 || 1;
  for (let i = 1; i < n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 - 1 + (y1 - y0) * i / n); if (isWall(at(x, y))) return false; }
  return true;
}

// Light at the way on (#163 step 4): the lamp nearest the exit of every main room shines `exitLight` %, and a room without one gets a
// fixed lamp over it; dead ends (side rooms) `deadEnd` %. lamps: planLights(...).lamps (mutated), L: the welded level, mk(x, y): a new lamp
export function lightTheWay(lamps, L, room, cfg = LEVEL, mk = null) {
  if (!L?.rooms?.length) return lamps;
  const gates = roomGates(L), mains = L.rooms.filter(r => r.band === 'main');
  const inRoom = (r, l) => l.x >= r.x && l.x < r.x + r.w && l.y >= r.y && l.y < r.y + r.h;
  for (const r of L.rooms.filter(r => r.band === 'branch')) for (const l of lamps) if (inRoom(r, l)) { l.strength = Math.round(l.strength * cfg.deadEnd / 100); l.deadEnd = true; }
  mains.forEach((r, i) => {
    const g = gates[i]?.out; if (!g) return;
    const own = lamps.filter(l => inRoom(r, l));
    let best = own.map(l => [Math.hypot(l.x - g[0], l.y - g[1]), l]).filter(([d]) => d <= cfg.exitReach + 4).sort((a, b) => a[0] - b[0])[0]?.[1];
    if (!best && mk) {
      // the ceiling over the exit (first wall above the gate, inside the room)
      const x = Math.max(r.x + 1, Math.min(r.x + r.w - 2, g[0] + (L.stack ? 0 : -1)));
      let y = g[1]; while (y > r.y && !isWall(room.tiles[y - 1]?.[x])) y--;
      best = mk(x, y); if (best) lamps.push(best);
    }
    if (!best) return;
    const top = Math.max(best.strength, ...own.map(l => l.strength));
    best.strength = Math.round(top * cfg.exitLight / 100); best.exit = true;
    if (best.behavior === 'broken' || best.behavior === 'flicker') best.behavior = 'steady';
  });
  return lamps;
}

// Landmark views (#163 step 2): outdoor main rooms see it in the sky; indoor ones get a window in the back wall every `windowEvery`
// rooms (shown, hidden, shown …), never in the Wow room (it has its own motif). → [{ room (index in L.rooms), how: 'sky'|'window'|null, win }]
export function landmarkViews(D, poiId, L, cfg = levelConfig(D)) {
  const P = D?.pois?.[poiId]; if (!P?.level?.landmark || !L?.rooms?.length) return [];
  const indoor = id => { const r = D.rooms?.[id] || {}; return r.indoor ?? !(r.backdrop?.image || r.backdrop?.weather); };
  const wow = wowOf(D, poiId)?.room, tiles = L.def.layout;
  let k = 0;
  return L.rooms.map((r, i) => {
    if (r.band !== 'main') return { room: i, how: null };
    if (!indoor(r.id)) return { room: i, how: 'sky' };
    if (r.id === wow || k++ % Math.max(1, cfg.windowEvery)) return { room: i, how: null };
    const win = windowSpot(tiles, r);
    return { room: i, how: win ? 'window' : null, win };
  });
}
// a 4 × 3 window of open air in the upper middle of a room's back wall (no ladder, no lamp, no platform in it)
function windowSpot(tiles, r) {
  const at = (x, y) => tiles[y]?.[x], W = 4, H = 3;
  const ok = (x0, y0) => { for (let y = y0 - 1; y <= y0 + H; y++) for (let x = x0 - 1; x <= x0 + W; x++) if (at(x, y) !== '.') return false; return true; };
  const cx = Math.floor(r.x + r.w / 2 - W / 2);
  for (const dx of [0, -3, 3, -6, 6, -9, 9]) for (let y = r.y + 2; y < r.y + r.h - H - 2; y++) if (ok(cx + dx, y)) return { x: cx + dx, y, w: W, h: H };
  return null;
}

// Signs at secrets (#163 step 7): every fake or brittle wall gets a sign within `signReach` tiles: a crack decal on the wall next to
// it, a draft (paper scraps drift towards it), light through a slit. The first secret of a POI is clear, later ones quieter.
// → [{ x, y (tile of the sign), at: [x, y] (the secret wall), kind: 'crack'|'draft'|'slit', strength (0..1) }]
export function secretSigns(L, cfg = LEVEL) {
  const tiles = L.def.layout, H = tiles.length, W = tiles[0]?.length || 0, seen = new Set(), groups = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = tiles[y][x];
    if (!'B$%'.includes(c) || seen.has(x + ',' + y)) continue;
    const g = [], q = [[x, y]]; seen.add(x + ',' + y);
    while (q.length) { const [a, b] = q.pop(); g.push([a, b]); for (const [p, s] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) if ('B$%'.includes(tiles[s]?.[p]) && !seen.has(p + ',' + s)) { seen.add(p + ',' + s); q.push([p, s]); } }
    groups.push({ tiles: g, c });
  }
  // from the entrance on: order by the main path (x for horizontal levels, distance from the start along y for stacks)
  const start = L.def.layout.findIndex(r => r.includes('L')), sx = start >= 0 ? L.def.layout[start].indexOf('L') : 0;
  groups.sort((a, b) => Math.hypot(a.tiles[0][0] - sx, a.tiles[0][1] - start) - Math.hypot(b.tiles[0][0] - sx, b.tiles[0][1] - start));
  return groups.map((g, i) => {
    // the air tile next to the secret that Leyla stands at (a wall's face to the open side)
    let spot = null;
    for (const [x, y] of g.tiles) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (!spot && tiles[y + dy]?.[x + dx] === '.') spot = [x + dx, y + dy];
    const kinds = g.c === '%' ? ['draft', 'slit'] : ['crack', 'slit', 'draft'];
    return { x: spot?.[0] ?? g.tiles[0][0], y: spot?.[1] ?? g.tiles[0][1], at: g.tiles[0], tiles: g.tiles, kind: kinds[i % kinds.length], strength: (i ? cfg.laterSign : cfg.firstSign) / 100 };
  });
}

// Guide lines (#163 step 6): per main room a line from the way in to the way on, along the floor (strip, rail, carpet, arrows, mud) or
// under the ceiling (cable, pipe, lights). → [{ room, kind, pts: [[x, y] tile points] }]
export function guideLines(D, poiId, L) {
  const kind = D?.pois?.[poiId]?.level?.guideKind; if (!kind || !L?.rooms?.length) return [];
  const gates = roomGates(L), mains = L.rooms.filter(r => r.band === 'main'), tiles = L.def.layout, high = ['cable', 'pipe', 'lights'].includes(kind);
  return mains.map((r, i) => {
    const g = gates[i]; if (!g?.in || !g?.out) return null;
    const [a, b] = [g.in, g.out], n = Math.max(2, Math.round(Math.abs(b[0] - a[0]) / 3) + 1), pts = [];
    for (let k = 0; k < n; k++) {
      const x = Math.round(a[0] + (b[0] - a[0]) * k / (n - 1));
      let y = Math.round(a[1] + (b[1] - a[1]) * k / (n - 1));
      if (high) { let yy = y; while (yy > r.y && !isWall(tiles[yy - 1]?.[x])) yy--; y = yy; }
      else { let yy = Math.max(r.y, y - 6); while (yy < r.y + r.h - 1 && !(tiles[yy]?.[x] === '.' && isWall(tiles[yy + 1]?.[x]) || tiles[yy + 1]?.[x] === '=')) yy++; y = yy; }
      pts.push([x, y]);
    }
    return { room: L.rooms.indexOf(r), kind, high, pts };
  }).filter(Boolean);
}

// the Wow room in a welded level → { index (in L.rooms), room, x, y (motif tile in the level), motif, area } or null
export function wowInLevel(D, poiId, L) {
  const W = wowOf(D, poiId); if (!W || !L?.rooms) return null;
  const i = L.rooms.findIndex(r => r.id === W.room && r.band === 'main');
  if (i < 0) return null;
  const r = L.rooms[i], [px, py] = W.point || [Math.floor(r.w * 0.65), r.h - 2];
  const x = r.flip ? r.x + r.w - 1 - px : r.x + px;
  return { index: i, room: r, x, y: r.y + py, motif: W.motif, W };
}

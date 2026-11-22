// NomadGirl – Hüllen G4 (#171, docs/concepts/poi_next_gen.md › G4, Neun Schichten: „Hülle liest die Räume darüber“). Pure logic for the
// browser and Node (no DOM): a building grammar in side view. From the welded rooms of a POI level (boxes, inside/outside, stack) it derives
// the buildings and lays a shell around them by rules: plinth, storeys (height from the rooms), window axes in a beat, roof (parapet, gable,
// flat with rooftop units, crown, dome), corners and pilasters, awnings and canopies, fire escapes, damage by decay (#159 story.decay).
// One building type per POI (Werkstatt › Welt › Gebäudetypen, POIs › Hülle) with its own rules. The same grammar makes far silhouettes for
// the parallax and the landmark's surroundings (skylinePlan).
//
//   hullTypes(D)                         the types (data/hulls.json) with the code defaults underneath
//   hullConfig(D, poiId)                 the rules of a POI: its type + POIs › Hülle overrides + Spiel › Hülle
//   planHull(D, poiId, L, { decay })     → plan (see below); deterministic per level seed; memoised per level object
//   hullWindowSpot(plan, room)           a window on the grid inside a room's back wall (#163 landmark windows use it)
//   hullAudit(D, poiId, L, plan)         findings: shell around every room, windows on the grid and consistent, no hull on play space
//   skylinePlan(D, { region, seed, width, height, far }) → silhouettes for the background (BigCityDelta, neighbours)
//
// A hull never changes the level: collision, reachability and the layout stay as they are. It only decides which wall tiles the game
// draws as tiles (the shell right at the rooms) and which ones become facade, earth or open sky (the mass further away, the unreachable
// ceiling of outdoor rooms). plan.cls per tile: 0 keep (drawn by art.js), 1 facade, 2 open (sky, background), 4 earth (buried types).

export const HULL_KINDS = [['building', 'Gebäude'], ['buried', 'Eingegraben (Bunker)'], ['lattice', 'Gittermast'], ['decks', 'Offene Decks (Parkhaus)'],
  ['plant', 'Anlage (Raffinerie)'], ['surface', 'Nur Oberfläche (Untergrund)'], ['trailers', 'Wohnwagen-Siedlung']];
export const ROOF_KINDS = [['flat', 'Flachdach'], ['parapet', 'Attika'], ['gable', 'Satteldach / Giebel'], ['shed', 'Pultdach (Sheds)'], ['crown', 'Krone (Hochhaus)'],
  ['dome', 'Kuppel'], ['fascia', 'Blende (Mega-Store)'], ['none', 'keins']];
export const ROOFTOP = [['ac', 'Klimagerät'], ['tank', 'Wassertank'], ['antenna', 'Antenne'], ['dish', 'Schüssel'], ['solar', 'Solarpaneele'], ['chimney', 'Schornstein'],
  ['vent', 'Lüfter'], ['frame', 'Schildgerüst (leer)'], ['stairs', 'Treppenhaus-Aufbau'], ['pylon', 'Werbe-Pylon (einer, am höchsten Teil)']];
// #178 a mega-store (Mile 7): an entrance canopy at the doors towards the outdoor rooms, and what stands in the yard behind the play space
export const ENTRIES = [['none', 'keins'], ['canopy', 'Eingangs-Vordach']];
export const YARD = [['truck', 'Lkw-Wrack'], ['wreck', 'Autowrack'], ['lamp', 'Laterne'], ['cart', 'Einkaufswagen'], ['dumpster', 'Müllcontainer'], ['billboard', 'Werbetafel (leer)'], ['stop', 'Radstopper und Poller']];
// size of each yard thing in tiles [w, h] (the painter keeps the picture's aspect inside)
export const YARD_FAR = new Set(['truck', 'billboard', 'lamp']);
export const YARD_SIZE = { truck: [12, 4.4], wreck: [4, 1.9], lamp: [2.2, 6.5], cart: [1.3, 1.25], dumpster: [2.8, 2.1], billboard: [5, 6.2], stop: [1.4, 0.55] };
export const AWNINGS = [['none', 'keine'], ['awning', 'Markise'], ['canopy', 'Vordach'], ['station', 'Tankstellendach über dem Hof']];
export const MATERIALS = [['concrete', 'Beton (Platten)'], ['brick', 'Ziegel'], ['plaster', 'Putz'], ['metal', 'Blech (Wellen)'], ['glass', 'Glas (Vorhangfassade)'], ['stone', 'Naturstein']];
export const BASES = [['none', 'kein Sockel'], ['plain', 'glatt'], ['stone', 'Rustika'], ['shop', 'Schaufenster'], ['tiles', 'Fliesen']];
export const SURFACES = [['', '–'], ['metro', 'U-Bahn-Abgang'], ['drain', 'Gully und Mauer'], ['mine', 'Zeche (Kaue, Förderband)'], ['silo', 'Silo-Deckel, Zaun, Radar'], ['hatch', 'Luke']];
export const PLANT = [['tank', 'Tank'], ['column', 'Kolonne'], ['pipes', 'Rohrbrücke'], ['stack', 'Schlot'], ['trailer', 'Wohnwagen'], ['watertower', 'Wasserturm'], ['pylon', 'Mast']];
// regions of the travel map → what stands on the horizon (Spiel › Hülle › Skyline je Region overrides)
export const SKY_KINDS = [['city', 'Stadt (Hochhäuser)'], ['outskirts', 'Vorstadt'], ['industry', 'Industrie'], ['desert', 'Wüste (vereinzelt)'], ['salt', 'Salzebene'], ['canyon', 'Canyon (kaum etwas)']];
const SKY_OF_REGION = { 'Delta Ring': 'city', 'The Outskirts': 'outskirts', 'Scrap Desert': 'industry', 'East Bend': 'industry', 'Salt Flats': 'salt', 'South Badlands': 'canyon', 'Crow Valley': 'canyon', 'Glass Dunes': 'desert' };

// Spiel › Hülle: switches and numbers for all POIs
// #172 painted modules: modules (an/aus), artGrain (pixels per tile when modules are painted), artPx (pixels per tile the modules are painted at),
// artDim (the textured facade a little darker, behind the play space)
export const HULL = { enabled: true, grain: 16, light: 85, backDim: 45, reach: 6, skyline: true, cityShare: 100, roomWindows: true, modules: true, artGrain: 32, artPx: 32, artDim: 20 };
export function hullGame(D) { const g = D?.game?.hull || {}; return { ...HULL, ...Object.fromEntries(Object.entries(g).filter(([k, v]) => k in HULL && v != null && v !== '')) }; }

// the code defaults of a type; data/hulls.json overrides field by field
const BASE = { kind: 'building', floors: 1, floorH: 6, axis: 5, winW: 2, winH: 2, sill: 1, edge: 1, base: 'plain', baseH: 1, roof: 'parapet', roofH: 1,
  rooftop: [], rooftopCount: 2, lisene: true, lisEvery: 0, awning: 'none', fireEscape: false, roomWindows: 35, lit: 12, uniform: false, damage: 100,
  material: 'concrete', wall: '#8b93af', trim: '#4a5462', glass: '#285cc4', frame: '#333941', litColor: '#ffd541', roofColor: '#4a5462', baseColor: '#5a4e44',
  cover: 4, surface: '', plant: [], neighbors: true,
  // #178 mega-store: side rooms over the hall become their own block (upper, no windows if upperWindows off) instead of raising the hall;
  // entrance canopy; station roof over every outdoor room beside the building (also the Wow room and the entrance) with pumps under it;
  // yard things behind the play space; a parking apron
  upperAnnex: false, upperWindows: true, entry: 'none', stationAll: false, pumps: true, yard: [], yardGap: 3, apron: false,
  // #179 the fascia steps up around the block on the roof (a raised sign parapet: the band runs up its sides and across its top), the
  // block reaches its whole side room and `upperPad` tiles more each side (the clad frame); hull lamps (canopy strips, entrance
  // downlights, pylon) in the light system, flicker by decay
  upperFascia: false, upperPad: 2, lamps: false };
export function hullTypes(D) { return D?.hulls || {}; }
const num = (v, d) => v == null || v === '' || Number.isNaN(+v) ? d : +v;

export function hullConfig(D, poiId) {
  const P = D?.pois?.[poiId] || {}, H = P.hull || {}, G = hullGame(D), type = H.type || null, T = type ? hullTypes(D)[type] || {} : {};
  const c = { ...BASE };
  for (const src of [T, H]) for (const [k, v] of Object.entries(src || {})) if (k !== 'name' && k !== 'description' && k !== 'type' && k !== 'on' && v != null && v !== '' && !(Array.isArray(v) && !v.length && src === H)) c[k] = v;
  for (const k of ['floors', 'floorH', 'axis', 'winW', 'winH', 'sill', 'edge', 'baseH', 'roofH', 'rooftopCount', 'lisEvery', 'roomWindows', 'lit', 'damage', 'cover', 'yardGap', 'upperPad']) c[k] = num(c[k], BASE[k]);
  c.on = G.enabled !== false && H.on !== false && !!type && !!hullTypes(D)[type];
  c.type = type; c.name = T.name || type || '';
  c.decay = num(H.decay, num(P.story?.decay, 1));
  c.event = P.story?.eventKind || '';
  c.reach = G.reach;
  c.roomWindowsOn = G.roomWindows !== false;
  // #172 painted modules: Spiel › Hülle › Module (shared: rooftop units, awnings, damage, plant …) under Gebäudetyp › Module under POIs › Hülle
  const artOf = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)));
  c.art = G.modules === false ? {} : { ...artOf(D?.game?.hull?.art), ...artOf(T.art), ...artOf(H.art) };
  c.artPx = G.artPx; c.artDim = G.artDim;
  return c;
}

// ---------------- helpers ----------------
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const indoorOf = (D, id) => { const r = D.rooms?.[id] || {}; return r.indoor ?? !(r.backdrop?.image || r.backdrop?.weather); };
const median = a => { const s = [...a].sort((p, q) => p - q); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
const inBox = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.top && y <= b.bottom;
// tiles a room window must keep free around it (ladder, platform, lamp, door, switch, chest … anything but air)
const freeAir = (tiles, x0, y0, w, h, m = 1) => { for (let y = y0 - m; y < y0 + h + m; y++) for (let x = x0 - m; x < x0 + w + m; x++) if (tiles[y]?.[x] !== '.') return false; return true; };

const memo = new WeakMap();
// plan = { on, cfg, W, H, ground, cls (Uint8Array W×H), buildings: [{ x0, x1, top, bottom, ground, floorH, floors: [rows], axes: [x], volumes, kind }],
//   windows: [{ x, y, w, h, b (building index), where: 'facade'|'room', room, lit, broken, boarded }], parts: [{ kind, x, y, w, h, … }], above (rows above the level) }
export function planHull(D, poiId, L, opt = {}) {
  if (!L?.def) return { on: false };
  if (opt.decay == null && memo.has(L)) return memo.get(L);
  const cfg = hullConfig(D, poiId);
  if (opt.decay != null) cfg.decay = opt.decay;
  const out = buildPlan(D, poiId, L, cfg, opt);
  if (opt.decay == null) memo.set(L, out);
  return out;
}

function buildPlan(D, poiId, L, cfg, opt) {
  const tiles = opt.tiles || L.def.layout, H = tiles.length, W = tiles[0]?.length || 0;
  // the seed of the hull follows the level (same seed, same level, same hull) without needing the run's seed
  let seed = opt.seed ?? 0; if (!opt.seed) for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 7) seed = (seed * 31 + tiles[y].charCodeAt(x)) >>> 0;
  const plan = { on: cfg.on, cfg, W, H, tiles, cls: new Uint8Array(W * H), buildings: [], windows: [], parts: [], above: 0, kind: cfg.kind };
  if (!cfg.on) return plan;
  const rooms = L.rooms.map((r, i) => ({ ...r, i, x0: r.x, x1: r.x + r.w - 1, top: r.y, bottom: r.y + r.h - 1, indoor: indoorOf(D, r.id) }));
  const main = rooms.filter(r => r.band === 'main'), stack = L.stack || (D.pois?.[poiId]?.stack === 'tower' || D.pois?.[poiId]?.stack === 'deep' ? D.pois[poiId].stack : null);
  const roomAt = (x, y) => rooms.find(r => x >= r.x0 && x <= r.x1 && y >= r.top && y <= r.bottom) || null;
  const t = (x, y) => tiles[y]?.[x];
  // the ground: the floor of the main band, the lobby of a tower, the street over a deep POI
  const ground = stack === 'deep' ? main[0].bottom : Math.max(...main.map(r => r.bottom));
  plan.ground = ground; plan.stack = stack;
  // distance (8 neighbours) of every '#' to anything that is not '#'
  const dist = new Uint8Array(W * H).fill(9), q = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t(x, y) !== '#') { dist[y * W + x] = 0; q.push(y * W + x); }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % W, y = (i - x) / W; if (dist[i] >= 3) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, j = ny * W + nx; if (nx >= 0 && ny >= 0 && nx < W && ny < H && dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); } }
  }
  // outdoor air out of reach: higher than `reach` rows over every place to stand within 5 columns (floors, platforms, ladder rungs).
  // Everything lower can be reached by jumping or falling, so the walls next to it stay.
  const reach = Math.max(3, cfg.reach), HR = 5, high = new Uint8Array(W * H), topReach = new Int16Array(W).fill(32000);
  for (let x = 0; x < W; x++) for (let y = 1; y < H; y++) {
    const c = t(x, y), stand = (c === '#' || c === '=' || c === 'H') && t(x, y - 1) !== '#' || c === 'H';
    if (!stand) continue;
    for (let d = -HR; d <= HR; d++) if (x + d >= 0 && x + d < W) topReach[x + d] = Math.min(topReach[x + d], y - reach);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (t(x, y) !== '.' || y >= topReach[x]) continue;
    const r = roomAt(x, y); if (r && !r.indoor) high[y * W + x] = 1;
  }
  const openShell = (x, y) => {
    let any = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const c = t(x + dx, y + dy); if (c == null || c === '#') continue;
      if (c !== '.' || !high[(y + dy) * W + x + dx]) return false;
      any = true;
    }
    return any;
  };
  const hullable = (x, y) => t(x, y) === '#' && y < ground && (dist[y * W + x] >= 2 || openShell(x, y));

  // ---------- buildings ----------
  const B = plan.buildings, vol = (x0, x1, top, bottom, extra = {}) => ({ x0, x1, top, bottom, ...extra });
  const floorsOf = list => {   // storey height from the rooms: each room split into whole storeys close to the type's height
    const hs = list.filter(r => r.indoor || stack === 'tower').map(r => { const n = Math.max(1, Math.round((r.h - 1) / cfg.floorH)); return (r.h - 1) / n; });
    return Math.max(4, Math.round(hs.length ? median(hs) : cfg.floorH));
  };
  const minTop = -5;   // the camera may rise 5 tiles over the level (Spiel › Kamera › Himmel über dem Level)
  if (cfg.kind === 'surface') {
    // deep POIs: everything under the street is earth; over it the street structures beside the entrance (parts below)
  } else if (stack === 'tower') {
    const shaftX0 = Math.round(median(main.map(r => r.x0))), shaftX1 = Math.round(median(main.map(r => r.x1)));
    const top = Math.min(...main.map(r => r.top)), fh = floorsOf(main), lobby = main[0];
    const volumes = [vol(shaftX0, shaftX1, top, ground, { shaft: true })];
    if (lobby.x0 < shaftX0 || lobby.x1 > shaftX1) volumes.push(vol(Math.min(lobby.x0, shaftX0), Math.max(lobby.x1, shaftX1), lobby.top, ground, { podium: true }));
    for (const r of rooms) if (r !== lobby && (r.x0 < shaftX0 - 1 || r.x1 > shaftX1 + 1)) volumes.push(vol(r.x0, r.x1, r.top, r.bottom, { annex: true }));
    // the shortcut shaft beside the stack (#038) is a stair tower built onto the building: the gap to it is facade too
    const sh = L.shortcut?.kind === 'shaft' && L.shortcut.shaft;
    if (sh) { const [s0, sy, sw] = sh, a = s0 < shaftX0 ? s0 - 1 : shaftX1 + 1, z = s0 < shaftX0 ? shaftX0 - 1 : s0 + sw; volumes.push(vol(Math.max(0, a), Math.min(W - 1, z), Math.max(0, sy - 1), ground, { annex: true, stair: true })); }
    B.push({ x0: Math.min(...volumes.map(v => v.x0)), x1: Math.max(...volumes.map(v => v.x1)), top, bottom: ground, ground, floorH: fh, volumes, rooms: rooms.map(r => r.i), shaft: [shaftX0, shaftX1] });
  } else {
    // side by side: runs of indoor main rooms are buildings; side rooms over them belong to them (over open ground: an annex)
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const x0 = run[0].x0, x1 = run.at(-1).x1, fh = floorsOf(run), tall = ground - cfg.floors * fh;
      const branches = rooms.filter(r => r.band !== 'main' && r.x1 >= x0 - 2 && r.x0 <= x1 + 2);
      const volumes = run.map(r => {
        const over = cfg.upperAnnex ? [] : branches.filter(b => b.x1 >= r.x0 && b.x0 <= r.x1);
        return vol(r.x0, r.x1, Math.max(minTop, Math.min(r.top, tall, ...over.map(b => b.top))), ground, { room: r.i });
      });
      if (cfg.uniform) { const top = Math.min(...volumes.map(v => v.top)); for (const v of volumes) v.top = top; }
      // #178 a side room over the hall is a block of its own on the roof (the high-bay store of the mega-store), the hall keeps its height
      const hallTop0 = Math.min(...volumes.map(v => v.top)), whole = new Set();
      if (cfg.upperAnnex) for (const b of branches) if (b.x1 >= x0 && b.x0 <= x1 && b.top < hallTop0) {
        // #179 upperFascia: the block is its whole side room plus a clad frame of upperPad tiles each side (the fascia runs up there)
        if (cfg.upperFascia && cfg.roof === 'fascia') { const pad = Math.max(0, Math.round(cfg.upperPad)); volumes.push(vol(Math.max(0, b.x0 - pad), Math.min(W - 1, b.x1 + pad), Math.max(minTop, b.top), b.bottom, { annex: true, upper: true, frame: pad })); whole.add(b); }
        else volumes.push(vol(Math.max(b.x0, x0), Math.min(b.x1, x1), Math.max(minTop, b.top), b.bottom, { annex: true, upper: true }));
      }
      for (const b of branches) {
        if (whole.has(b)) continue;
        if (b.x0 < x0) volumes.push(vol(b.x0, Math.min(b.x1, x0 - 1), b.top, b.bottom, { annex: true }));
        if (b.x1 > x1) volumes.push(vol(Math.max(b.x0, x1 + 1), b.x1, b.top, b.bottom, { annex: true }));
      }
      B.push({ x0, x1, vx0: Math.min(x0, ...volumes.map(v => v.x0)), vx1: Math.max(x1, ...volumes.map(v => v.x1)), top: Math.min(...volumes.map(v => v.top)), bottom: ground, ground, floorH: fh, volumes, rooms: [...run, ...branches].map(r => r.i) });
      run = [];
    };
    for (const r of main) { if (r.indoor && (!run.length || r.x0 <= run.at(-1).x1 + 1)) run.push(r); else { flush(); if (r.indoor) run.push(r); } }
    flush();
  }
  // classify: hull tiles in a volume are facade (earth for buried types), the rest of the hull is open
  const volAt = (x, y) => { for (let b = 0; b < B.length; b++) for (const v of B[b].volumes) if (inBox(v, x, y)) return { b, v }; return null; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!hullable(x, y)) continue;
    const at = volAt(x, y), r = roomAt(x, y);
    if (cfg.kind === 'buried') plan.cls[y * W + x] = 4;
    else plan.cls[y * W + x] = at && cfg.kind !== 'lattice' && !(r && !r.indoor) ? 1 : 2;   // inside an outdoor room: open (a broken or unfinished floor)
  }
  if (cfg.kind === 'buried') {   // the mound over the bunker: earth from its surface down, the surface follows the rooms with a soft slope
    const ind = main.filter(r => r.indoor), x0 = ind.length ? ind[0].x0 : 0, x1 = ind.length ? ind.at(-1).x1 : W - 1;
    const surf = Math.max(minTop + 1, Math.min(...ind.map(r => r.top), ground) - cfg.cover);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (plan.cls[i] !== 4) continue;
      const slope = Math.max(0, x0 - x, x - x1);   // falls off at both ends
      if (y < surf + slope) plan.cls[i] = 2;
    }
    plan.mound = { x0, x1, surf };
  }

  // ---------- storeys, axes, windows ----------
  const rnd = (x, y, k) => hash(x, y, seed + k);
  B.forEach((b, bi) => {
    const fh = b.floorH, floors = []; for (let y = ground; y > b.top - fh; y -= fh) floors.push(y);
    b.floors = floors;
    const span = b.x1 - b.x0 + 1 - 2 * cfg.edge, ax = Math.max(cfg.winW + 1, cfg.axis), n = Math.max(1, Math.floor(span / ax)), start = b.x0 + cfg.edge + Math.floor((span - n * ax) / 2);
    b.axes = []; for (let i = 0; i < n; i++) b.axes.push(start + i * ax + Math.floor((ax - cfg.winW) / 2));
    if (cfg.kind === 'buried' || cfg.kind === 'lattice') return;
    b.grid = { w: cfg.winW, h: cfg.winH, rows: floors.map(F => F - 1 - cfg.sill - cfg.winH + 1).filter(y => y - 1 >= b.top - 1), axes: b.axes };
    for (const wy of b.grid.rows) for (const wx of b.axes) {
      const cells = []; for (let y = wy; y < wy + cfg.winH; y++) for (let x = wx; x < wx + cfg.winW; x++) cells.push([x, y]);
      if (!cells.every(([x, y]) => volAt(x, y)?.b === bi)) continue;
      if (!cfg.upperWindows && cells.some(([x, y]) => volAt(x, y)?.v.upper)) continue;   // #178 the block on the roof has no windows
      const k = rnd(wx, wy, 7), dec = cfg.decay * cfg.damage / 100;
      const win = { x: wx, y: wy, w: cfg.winW, h: cfg.winH, b: bi, lit: k < cfg.lit / 100, broken: rnd(wx, wy, 8) < dec * 0.18, boarded: rnd(wx, wy, 9) < dec * 0.08 };
      if (cells.every(([x, y]) => plan.cls[y * W + x] === 1)) { plan.windows.push({ ...win, where: 'facade', room: null }); continue; }
      if (cfg.kind === 'decks') continue;
      // a window of a room: the hole sits in the back wall of an indoor room of this building, on the same grid
      const r = roomAt(wx, wy);
      if (!r || !r.indoor || r.wow || !b.rooms.includes(r.i) || !cfg.roomWindowsOn) continue;
      if (!cells.every(([x, y]) => roomAt(x, y) === r) || !freeAir(tiles, wx, wy, cfg.winW, cfg.winH)) continue;
      if (rnd(wx, wy, 11) * 100 < cfg.roomWindows) plan.windows.push({ ...win, broken: false, boarded: false, lit: false, where: 'room', room: r.i });
    }
  });
  plan.parts = partsOf(D, poiId, L, plan, rooms, main, rnd);
  plan.above = Math.max(0, -Math.min(0, ...plan.parts.map(p => Math.floor(p.y - (p.tall ? p.tall - p.h : 0))), ...B.map(b => b.top - (cfg.roofH + 1))));
  return plan;
}

// a window on the hull grid inside a room's back wall for the landmark (#163): the free grid cell nearest the room's middle, or null
export function hullWindowSpot(plan, room) {
  if (!plan?.on || plan.cfg.kind === 'buried' || plan.cfg.kind === 'surface') return undefined;   // undefined: the hull has no say, use the old spot
  const b = plan.buildings.find(o => o.grid && o.rooms.includes(room.i ?? room.index));
  if (!b) return undefined;
  const g = b.grid, tiles = plan.tiles, cx = room.x + room.w / 2, cy = room.y + room.h / 2, out = [];
  for (const y of g.rows) for (const x of g.axes) {
    if (x < room.x + 1 || x + g.w > room.x + room.w - 1 || y < room.y + 1 || y + g.h > room.y + room.h - 1) continue;
    if (!tiles || !freeAir(tiles, x, y, g.w, g.h)) continue;
    out.push({ x, y, w: g.w, h: g.h, d: Math.abs(x + g.w / 2 - cx) + Math.abs(y + g.h / 2 - cy) * 0.5 });
  }
  out.sort((a, b2) => a.d - b2.d);
  return out[0] ? { x: out[0].x, y: out[0].y, w: out[0].w, h: out[0].h } : null;
}

// ---------------- the parts of the grammar (all in tile units; the painter draws them) ----------------
function partsOf(D, poiId, L, plan, rooms, main, rnd) {
  const { cfg, W, H, ground, buildings: B } = plan, P = [], push = p => P.push(p);
  const dec = cfg.decay * cfg.damage / 100, list = v => Array.isArray(v) ? v : String(v || '').split(',').map(s => s.trim()).filter(Boolean);
  if (cfg.kind !== 'buried' && cfg.kind !== 'lattice') B.forEach((b, bi) => {
    const tops = b.volumes.filter(v => !v.annex);
    // plinth (Sockel) and floor bands (Gesims) over the whole building, the painter clips them to facade tiles
    if (cfg.base !== 'none' && cfg.baseH > 0) push({ kind: 'base', style: cfg.base, x: b.x0, y: ground - cfg.baseH, w: b.x1 - b.x0 + 1, h: cfg.baseH, b: bi });
    const hallTop = Math.min(...tops.map(v => v.top)), uppers = b.volumes.filter(v => v.upper);   // #178 no storey bands on the block over the hall (it reads as one tall store)
    for (const F of b.floors || []) if (F < ground && F > b.top && !(cfg.upperAnnex && F <= hallTop)) push({ kind: 'band', x: b.x0, y: F, w: b.x1 - b.x0 + 1, h: 1, b: bi });
    // pilasters (Lisenen): at the corners, and every n axes between the windows
    if (cfg.lisene) {
      for (const v of tops) { push({ kind: 'lisene', x: v.x0, y: v.top, w: 1, h: ground - v.top, b: bi, corner: true }); push({ kind: 'lisene', x: v.x1, y: v.top, w: 1, h: ground - v.top, b: bi, corner: true }); }
      if (cfg.lisEvery > 0) (b.axes || []).forEach((ax, i) => { if (i && i % cfg.lisEvery === 0) push({ kind: 'lisene', x: ax - Math.ceil((Math.max(cfg.winW + 1, cfg.axis) - cfg.winW) / 2), y: b.top, w: 1, h: ground - b.top, b: bi }); });
    }
    // roof per volume: kind, a parapet, rooftop units on the flat parts
    const units = list(cfg.rooftop);
    tops.concat(b.volumes.filter(v => v.annex)).forEach((v, vi) => {
      const w = v.x1 - v.x0 + 1, kind = v.frame != null ? 'fascia' : v.annex ? 'parapet' : cfg.roof === 'dome' ? (rooms[v.room]?.wow ? 'dome' : 'parapet') : cfg.roof;
      if (kind === 'none') return;
      // the room at the top of the volume is open (Rohbau, terrace, broken floor): no roof, the columns stick out unfinished
      const crown = rooms.find(r => r.top <= v.top + 1 && r.x1 >= v.x0 && r.x0 <= v.x1 && r.top >= v.top - 1);
      if (crown && !crown.indoor && crown.band !== 'main') return;   // a roof terrace (side room on top) brings its own railing
      if (crown && !crown.indoor) {   // only where a wall of the open room still stands at the top (the columns of the unfinished floor)
        for (let x = Math.max(v.x0, crown.x0); x <= Math.min(v.x1, crown.x1); x += Math.max(3, cfg.axis)) {
          let y = v.top; while (y < v.top + 3 && (plan.tiles[y]?.[x] !== '#' || plan.cls[y * W + x])) y++;
          if (y < v.top + 3) { const hh = 1.2 + rnd(x, 1, 25) * 1.5; push({ kind: 'stub', x: x + 0.25, y: y - hh, w: 0.5, h: hh, b: bi }); }
        }
        return;
      }
      // #179 the raised fascia around the block: its top band, and the bands down its sides to the hall's fascia (join) or its bottom (cap)
      if (v.frame != null) {
        const joinAt = x => tops.some(o => x >= o.x0 && x <= o.x1) ? hallTop : null, f = Math.max(1, v.frame);
        push({ kind: 'roof', roof: kind, x: v.x0, y: v.top - cfg.roofH, w, h: cfg.roofH, b: bi, annex: true, upper: true, frame: f,
          bottom: v.bottom + 1, joinL: joinAt(v.x0 + f / 2), joinR: joinAt(v.x1 - f / 2), roofH: cfg.roofH });
      } else push({ kind: 'roof', roof: kind, x: v.x0, y: v.top - cfg.roofH, w, h: cfg.roofH, b: bi, annex: !!v.annex });
      // #172 a pediment in classical proportion (about 1 : 2.4, like the painted module): over a wide volume it crowns the middle
      if (kind === 'gable') { const gh = Math.min(7, Math.max(2, (w + 1) / 2.4)), gw = Math.min(w + 1, gh * 2.4); push({ kind: 'gable', x: v.x0 - 0.5 + (w + 1 - gw) / 2, y: v.top - cfg.roofH - gh, w: gw, h: gh, b: bi }); }
      // crown: 2 tiles of code; a painted crown rises higher (tall), the hull makes room for it above the level
      if (kind === 'crown') push({ kind: 'crown', x: v.x0 + w * 0.2, y: v.top - cfg.roofH - 2, w: w * 0.6, h: 2, tall: Math.min(12, w * 0.6 * 1.1), b: bi });
      if (kind === 'dome') push({ kind: 'dome', x: v.x0 + 1, y: v.top - cfg.roofH - Math.min(5, w / 4), w: w - 2, h: Math.min(5, w / 4), b: bi });
      if (kind === 'shed') for (let x = v.x0; x + 4 <= v.x1 + 1; x += 5) push({ kind: 'shed', x, y: v.top - cfg.roofH - 2, w: 5, h: 2, b: bi });
      if (!units.length || kind === 'gable' || kind === 'dome' || (v.annex && !v.upper)) return;
      const pick = units.filter(u => u !== 'pylon');
      if (!pick.length) return;
      const n = Math.min(cfg.rooftopCount, Math.floor(w / 5));
      for (let k = 0; k < n; k++) {
        const u = pick[Math.floor(rnd(v.x0, k, 21 + vi) * pick.length)], x = v.x0 + 2 + (k + 0.5) * (w - 4) / n + (rnd(v.x0, k, 22) - 0.5) * 2;
        const size = { ac: [2, 1.2], tank: [2.4, 3.2], antenna: [0.4, 5], dish: [1.6, 1.8], solar: [4, 1.2], chimney: [1, 3], vent: [1.2, 1.2], frame: [5, 3.5], stairs: [2.6, 2] }[u] || [1, 1];
        if (!v.upper && uppers.some(o => x + 1.5 >= o.x0 && x - 1.5 <= o.x1)) continue;   // #178 not behind the block on the roof
        if (dec > 1.5 && rnd(x | 0, k, 23) < 0.35) { push({ kind: 'unit', unit: u, fallen: true, x: x - 1, y: v.top - cfg.roofH - 1, w: 2, h: 1, b: bi, tilt: 0 }); continue; }   // fallen off: a wreck lies there
        push({ kind: 'unit', unit: u, x: x - size[0] / 2, y: v.top - cfg.roofH - size[1], w: size[0], h: size[1], b: bi, tilt: dec > 0.5 ? (rnd(x | 0, k, 24) - 0.5) * dec * 6 : 0 });
      }
    });
    // #178 one advertising pylon on the highest part of the first building (blank light boxes, the brand's logo from code)
    // (on the hall's roof beside the block, where the sky is free: the camera sees 5 tiles over the level at most)
    if (list(cfg.rooftop).includes('pylon') && !P.some(p => p.kind === 'pylon')) {
      let best = null;
      for (const v of tops) {
        let a = v.x0 + 2;
        for (let x = v.x0 + 2; x <= v.x1 - 1; x++) {
          const cut = uppers.some(u => x >= u.x0 - 2 && x <= u.x1 + 2) || x === v.x1 - 1;
          if (cut) { if (x - a >= 5 && (!best || x - a > best.w)) best = { x: a, w: x - a, top: v.top }; a = x + 1; }
        }
      }
      if (best) { const pw = 3.4, ph = Math.min(10, best.top - cfg.roofH + 5), x = best.x + best.w * 0.5 - pw / 2; if (ph >= 6) push({ kind: 'pylon', x, y: best.top - cfg.roofH - ph, w: pw, h: ph, b: bi }); }
    }
    // awnings, canopies and fire escapes: towards the outdoor rooms beside the building (in the background, dimmed: no platform)
    const sideAir = side => { const x = side < 0 ? b.x0 - 1 : b.x1 + 1, r = rooms.find(o => o.band === 'main' && !o.indoor && x >= o.x0 && x <= o.x1); return r || null; };
    for (const side of [-1, 1]) {
      const o = sideAir(side);
      if (!o) continue;
      const ex = side < 0 ? b.x0 : b.x1 + 1;
      if (cfg.awning === 'awning' || cfg.awning === 'canopy') push({ kind: cfg.awning, x: side < 0 ? ex - 3 : ex, y: ground - 5, w: 3, h: cfg.awning === 'awning' ? 1.2 : 0.6, side, b: bi, torn: rnd(ex, 1, 31) < dec * 0.3 });
      if (cfg.entry === 'canopy') push({ kind: 'entry', x: side < 0 ? ex - 4.2 : ex, y: ground - 5.3, w: 4.2, h: 5.3, side, b: bi });   // #178 over the sliding doors
      if (cfg.fireEscape && b.floors.length > 2 && rnd(ex, 2, 32) < 0.8) push({ kind: 'fire', x: side < 0 ? ex - 3 : ex, y: b.floors[b.floors.length - 2] - 1, w: 3, h: ground - b.floors[b.floors.length - 2] - 3, side, step: b.floorH, b: bi });
    }
    if (cfg.fireEscape && plan.stack === 'tower') {
      const side = rnd(b.x0, 3, 33) < 0.5 ? -1 : 1, sh = b.shaft || [b.x0, b.x1], ex = side < 0 ? sh[0] - 3 : sh[1] + 1;
      if (ex >= 0 && ex + 3 <= W) push({ kind: 'fire', x: ex, y: b.top + 2, w: 3, h: ground - b.top - 6, side, step: b.floorH, b: bi });
    }
    // damage (Verfall): cracks, holes, soot over windows (fire), shots (fight), a water line (flood); the painter keeps them on the facade
    const facade = []; for (const v of b.volumes) for (let y = v.top; y <= v.bottom; y++) for (let x = v.x0; x <= v.x1; x++) if (plan.cls[y * W + x] === 1) facade.push([x, y]);
    if (facade.length) {
      const pickF = k => facade[Math.floor(rnd(bi, k, 41) * facade.length)];
      for (let k = 0; k < Math.round(dec * 3 * Math.max(1, facade.length / 400)); k++) { const [x, y] = pickF(k); push({ kind: 'crack', x, y, w: 1, h: 1, seed: k, len: 2 + rnd(x, y, 42) * 4, b: bi }); }
      for (let k = 0; k < Math.round(dec * 1.2 * Math.max(1, facade.length / 600)); k++) { const [x, y] = pickF(100 + k); push({ kind: 'hole', x, y, w: 1 + rnd(x, y, 43) * 2.5, h: 1 + rnd(x, y, 44) * 2, seed: k, b: bi }); }
      if (cfg.event === 'fight') for (let k = 0; k < Math.round((1 + dec) * Math.max(1, facade.length / 160)); k++) { const [x, y] = pickF(200 + k); push({ kind: 'shots', x, y, w: 2, h: 1.5, seed: k, b: bi }); }
      if (cfg.event === 'flood') push({ kind: 'waterline', x: b.x0, y: ground - 2 - Math.round(rnd(bi, 5, 45) * 3), w: b.x1 - b.x0 + 1, h: 0.4, b: bi });
    }
    if (cfg.event === 'fire') for (const w of plan.windows) if (w.b === bi && w.where === 'facade' && rnd(w.x, w.y, 46) < 0.25 + dec * 0.15) push({ kind: 'soot', x: w.x - 0.3, y: w.y - 2.2, w: w.w + 0.6, h: 2.2, b: bi });
  });
  // the buried mound: a concrete portal where the open ground meets the first indoor room, vents and an antenna on top
  if (plan.mound) {
    const m = plan.mound, first = main.find(r => r.indoor), units = list(cfg.rooftop);
    if (first) push({ kind: 'portal', x: first.x0 - 1, y: first.top - 2, w: 4, h: first.bottom - first.top + 2 });
    for (let k = 0; k < Math.max(2, Math.floor((m.x1 - m.x0) / 40)); k++) {
      const u = units[k % Math.max(1, units.length)] || 'vent', x = m.x0 + 8 + rnd(k, 1, 51) * (m.x1 - m.x0 - 16);
      push({ kind: 'unit', unit: u, x, y: m.surf - (u === 'antenna' ? 5 : 1.4), w: u === 'antenna' ? 0.4 : 1.4, h: u === 'antenna' ? 5 : 1.4, tilt: 0 });
    }
  }
  // lattice (radio mast): the steel truss around the stack, plus guy wires
  if (cfg.kind === 'lattice') {
    const x0 = Math.round(median(main.map(r => r.x0))), x1 = Math.round(median(main.map(r => r.x1))), top = Math.min(...main.map(r => r.top));
    push({ kind: 'lattice', x: x0, y: top - 4, w: x1 - x0 + 1, h: ground - top + 4, step: 4 });
  }
  // open ground structures over the outdoor rooms (background, dimmed): station roof, plant, trailers, street furniture
  const outs = main.filter(r => !r.indoor && r.bottom === ground);
  // the station roof stands over the forecourt: an outdoor room beside a building, not the entrance, not the Wow room (its motif rules there)
  // #178 stationAll (mega-store): over every outdoor room beside a building, the Wow room too (its motif stands in front as a pylon); the
  // canopy follows the walkway of the room when there is one (the platform reads as the roof), pumps stand in rows under it
  const stations = [];
  if (cfg.awning === 'station' && !cfg.stationAll) outs.filter((r, i) => i > 0 && !r.wow && B.some(b => b.x0 === r.x1 + 1 || b.x1 === r.x0 - 1)).slice(0, 1).forEach(r => { const p = { kind: 'station', x: r.x0 + 3, y: ground - 8, w: r.w - 6, h: 1.4, posts: Math.max(2, Math.floor((r.w - 6) / 10)) }; push(p); stations.push(p); });
  if (cfg.awning === 'station' && cfg.stationAll) for (const r of outs) {
    if (!B.some(b => b.x0 <= r.x1 + 3 && b.x1 >= r.x0 - 3) && !r.wow) continue;
    let best = null;   // the longest walkway (platform '=', ladder through it) 5 to 11 rows over the ground
    for (let y = ground - 11; y <= ground - 5; y++) for (let x = r.x0 + 1, a = -1; x <= r.x1; x++) {
      const c = plan.tiles[y]?.[x], on = (c === '=' || c === 'H' && (plan.tiles[y][x - 1] === '=' || plan.tiles[y][x + 1] === '=')) && x < r.x1;
      if (on && a < 0) a = x;
      if (!on && a >= 0) { if (x - a >= 8 && (!best || x - a > best.w)) best = { x: a, y, w: x - a }; a = -1; }
    }
    const p = best ? { kind: 'station', x: best.x - 0.25, y: best.y, w: best.w + 0.5, h: 1.4, walk: true } : { kind: 'station', x: r.x0 + 3, y: ground - 8, w: r.w - 6, h: 1.4 };
    if (p.w < 6) continue;
    p.posts = Math.max(1, Math.round(p.w / 9)); push(p); stations.push(p);
  }
  if (cfg.pumps) for (const st of stations) for (let k = 0, n = Math.max(1, Math.floor(st.w / 6)); k < n; k++) push({ kind: 'pump', x: st.x + (k + 0.5) * st.w / n - 0.7 + (k % 2 ? 1.2 : -1.2), y: ground - 2.2, w: 1.4, h: 2.2, seed: k });
  // #178 the yard behind the play space: a parking apron with bay lines, wrecks, lamps, carts, dumpsters, blank billboards (slot by slot,
  // never under the station roof, never in front of the Wow motif)
  const yard = list(cfg.yard);
  if (cfg.apron || yard.length) outs.forEach((r, ri) => {
    if (cfg.apron) push({ kind: 'apron', x: r.x0, y: ground - 0.55, w: r.w, h: 0.55 });
    if (!yard.length) return;
    // far things (truck, billboard, lamp) stand behind the station roof, near ones (carts, dumpsters, wheel stops, car wrecks) beside it
    const busy = stations.filter(st => st.x < r.x1 && st.x + st.w > r.x0).map(st => [st.x - 0.5, st.x + st.w + 0.5]), wowBusy = [];
    const P0 = D?.pois?.[poiId]?.wow, wp = r.wow && Array.isArray(P0?.point) ? r.x0 + P0.point[0] : null;
    if (wp != null) wowBusy.push([wp - 4, wp + 4]);
    const free = (a, z, far) => ![...wowBusy, ...(far ? [] : busy)].some(([p, q]) => a < q && z > p);
    let x = r.x0 + 1, k = 0, truck = 0;
    while (x < r.x1 - 1 && k < 40) {
      const want = yard.filter(u => u !== 'truck' || !truck), u = want[Math.floor(rnd(x | 0, ri, 71) * want.length)], [sw, sh] = YARD_SIZE[u] || [2, 2];
      k++;
      const far = YARD_FAR.has(u);
      if (x + sw > r.x1 - 1 || !free(x, x + sw, far)) { x += 1; continue; }
      push({ kind: 'yard', what: u, x, y: ground - sh, w: sw, h: sh, seed: k + ri * 50, flip: rnd(x | 0, ri, 72) < 0.5, far });
      if (u === 'truck') truck++;
      x += sw + cfg.yardGap * (0.5 + rnd(x | 0, ri, 73));
    }
  });
  const plant = list(cfg.plant);
  if (plant.length) outs.forEach((r, i) => {
    for (let k = 0, x = r.x0 + 2 + rnd(i, 0, 61) * 4; x < r.x1 - 4 && k < 6; k++) {
      const what = plant[Math.floor(rnd(i, k, 62) * plant.length)];
      const s = { tank: [6, 5], column: [2.5, 14], pipes: [10, 6], stack: [1.6, 16], trailer: [7, 3], watertower: [4, 10], pylon: [3, 12] }[what] || [3, 3];
      if (x + s[0] > r.x1 - 1) break;
      push({ kind: 'plant', what, x, y: ground - s[1], w: s[0], h: s[1], seed: k + i * 10, broken: rnd(i, k, 63) < dec * 0.25 });
      x += s[0] + 2 + rnd(i, k, 64) * 5;
    }
  });
  if (cfg.kind === 'surface' && cfg.surface) {
    const r = main[0], sides = [[0, r.x0 - 1], [r.x1 + 1, W - 1]];
    push({ kind: 'street', x: 0, y: ground, w: W, h: 0.5 });
    for (const [a, z] of sides) {
      if (z - a < 4) continue;
      const w = Math.min(z - a - 1, cfg.surface === 'mine' ? 10 : 8);
      push({ kind: 'surface', what: cfg.surface, x: a + (z - a - w) / 2, y: ground - Math.min(12, w * 0.9), w, h: Math.min(12, w * 0.9), seed: a });
    }
    push({ kind: 'surface', what: cfg.surface + '_in', x: r.x0 + 2, y: ground - 7, w: r.w - 4, h: 6 });   // in the entrance room, behind: canopy, fence, headframe legs
  }
  return P;
}

// ---------------- #179 lamps of the hull (Gebäudetyp › Licht der Hülle) ----------------
// The painted lights of the hull as lamps for the light system (engine/atmosphere.js planLights): light strips under every station
// roof (every ~3 tiles, cool white), a downlight under every entrance canopy (warm), the light boxes of the pylon (no clip: it stands
// over the roof). Decay (POIs › Story › Verfall × Schäden) lets some buzz, flicker or die. All in tiles; y = the underside of the fixture.
// → [{ x, y, kind, color, radius, strength, behavior, bare (no fixture from code: the picture has one), free (not clipped to a room), what }]
export const HULL_LAMP = { strip: { color: '#e3f0ff', radius: 380, strength: 95, every: 3 }, entry: { color: '#ffe2a8', radius: 330, strength: 62 }, pylon: { color: '#ffd59a', radius: 300, strength: 55 } };
export function hullLamps(plan) {
  if (!plan?.on || !plan.cfg?.lamps) return [];
  const out = [], dec = (plan.cfg.decay ?? 1) * (plan.cfg.damage ?? 100) / 100;
  const mood = (x, y, k) => { const r = hash(x * 7 | 0, y * 3 | 0, 600 + k); return r < dec * 0.03 ? 'broken' : r < dec * 0.07 ? 'flicker' : r < dec * 0.15 ? 'buzz' : 'steady'; };
  for (const p of plan.parts) {
    if (p.kind === 'station') {
      const n = Math.max(1, Math.round(p.w / HULL_LAMP.strip.every));
      for (let k = 0; k < n; k++) { const x = p.x + (k + 0.5) * p.w / n - 0.5; out.push({ ...HULL_LAMP.strip, x, y: p.y + (plan.ground - p.y) * 0.25, kind: 'ceiling', behavior: mood(x, p.y, k), bare: true, what: 'station' }); }
    }
    if (p.kind === 'entry') { const x = p.x + p.w / 2 - 0.5; out.push({ ...HULL_LAMP.entry, x, y: p.y + p.h * 0.2, kind: 'ceiling', behavior: mood(x, p.y, 9), bare: true, what: 'entry' }); }
    if (p.kind === 'pylon') out.push({ ...HULL_LAMP.pylon, x: p.x + p.w / 2 - 0.5, y: p.y + p.h * 0.09, kind: 'bulb', behavior: dec >= 2.5 ? 'flicker' : mood(p.x, p.y, 11) === 'broken' ? 'flicker' : 'steady', bare: true, free: true, what: 'pylon' });
  }
  return out;
}

// ---------------- audit (test/facade.test.js, tools/level_audit.mjs) ----------------
// → [{ what, text }] : the shell keeps every room closed (no hull tile next to reachable air in an indoor room), windows sit on the grid of
// their building and are whole (facade window: all facade; room window: all free air of one indoor room of the building), the hull lies
// only on '#' (never on play space), landmark windows lie on the grid too.
export function hullAudit(D, poiId, L, plan = planHull(D, poiId, L), landmarkWins = []) {
  const out = [], add = (what, text) => out.push({ what, text });
  if (!plan.on) return out;
  const tiles = L.def.layout, W = plan.W, rooms = L.rooms;
  for (let y = 0; y < plan.H; y++) for (let x = 0; x < W; x++) {
    const c = plan.cls[y * W + x]; if (!c) continue;
    if (tiles[y][x] !== '#') { add('Spielfläche', `Hülle auf „${tiles[y][x]}“ bei ${x},${y}`); continue; }
    // next to the air of an indoor room the shell stays: the hull must never open a room
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, n = tiles[ny]?.[nx];
      if (n == null || n === '#') continue;
      const r = rooms.find(o => nx >= o.x && nx < o.x + o.w && ny >= o.y && ny < o.y + o.h);
      if (!r || indoorOf(D, r.id)) add('Hülle offen', `Kachel ${x},${y} der Hülle grenzt an ${r ? r.id : 'Luft'} (${n})`);
    }
  }
  const onGrid = (w, b) => b?.grid && b.grid.rows.includes(w.y) && b.grid.axes.includes(w.x) && w.w === b.grid.w && w.h === b.grid.h;
  for (const w of plan.windows) {
    const b = plan.buildings[w.b];
    if (!onGrid(w, b)) add('Fenster', `Fenster ${w.x},${w.y} nicht im Raster von Gebäude ${w.b + 1}`);
    for (let y = w.y; y < w.y + w.h; y++) for (let x = w.x; x < w.x + w.w; x++) {
      const c = plan.cls[y * W + x], t = tiles[y]?.[x];
      if (w.where === 'facade' && c !== 1) add('Fenster', `Fassadenfenster ${w.x},${w.y} ragt aus der Fassade`);
      if (w.where === 'room' && (t !== '.' || !(x >= rooms[w.room].x && x < rooms[w.room].x + rooms[w.room].w && y >= rooms[w.room].y && y < rooms[w.room].y + rooms[w.room].h))) add('Fenster', `Raumfenster ${w.x},${w.y} nicht frei im Raum ${rooms[w.room]?.id}`);
    }
    if (w.where === 'room' && !indoorOf(D, rooms[w.room].id)) add('Fenster', `Raumfenster in Außenraum ${rooms[w.room].id}`);
  }
  for (const lw of landmarkWins) {
    const b = plan.buildings.find(o => o.rooms.includes(lw.room));
    if (b?.grid && !onGrid(lw.win, b)) add('Fenster', `Landmarken-Fenster ${lw.win.x},${lw.win.y} (${rooms[lw.room]?.id}) nicht im Raster`);
  }
  return out;
}

// ---------------- silhouettes for the background (same grammar, far away) ----------------
// → { kind, list: [{ x, w, h, roof, units: [{ x, w, h, unit }], windows: [[x, y]] }] } in pixels of a strip `width` × `height`
export function skylinePlan(D, { region = '', seed = 1, width = 2000, height = 300, far = true, kind = null } = {}) {
  const G = hullGame(D), rows = D?.game?.hull?.regions || [];
  const row = rows.find(r => r.region && r.region === region) || rows.find(r => !r.region) || {};
  const k = kind || row.kind || SKY_OF_REGION[region] || 'desert';
  const prof = { city: [0.95, 0.35, 1, 0.8], outskirts: [0.6, 0.18, 0.5, 0.4], industry: [0.55, 0.2, 0.45, 0.3], desert: [0.18, 0.08, 0.25, 0.1], salt: [0.12, 0.05, 0.3, 0.05], canyon: [0.06, 0.04, 0.2, 0.02] }[k];
  // [density, min height share, max height share, share of tall towers]; far = BigCityDelta on the horizon: always a city, small
  const [dens, h0, h1, tall] = far ? [1, 0.25, 1, 0.9 * G.cityShare / 100] : [Math.min(1, prof[0] * (row.density ?? 100) / 100), prof[1], prof[2], prof[3]];
  const list = [], r = (a, b2) => hash(a, b2, seed * 7 + (far ? 3 : 11));
  let x = 0, i = 0;
  while (x < width && i < 400) {
    i++;
    const gap = (1 - dens) * 220 * r(i, 1) + (far ? 4 : 30);
    x += gap;
    const towerish = r(i, 2) < tall, w = towerish ? 30 + r(i, 3) * 60 : 50 + r(i, 3) * 120, h = height * (h0 + (towerish ? (h1 - h0) : (h1 - h0) * 0.35) * r(i, 4));
    const roof = towerish ? (r(i, 5) < 0.3 ? 'crown' : r(i, 5) < 0.55 ? 'setback' : 'flat') : k === 'industry' ? (r(i, 5) < 0.5 ? 'shed' : 'tank') : r(i, 5) < 0.3 ? 'gable' : 'flat';
    const units = [];
    if (r(i, 6) < 0.55) units.push({ unit: r(i, 7) < 0.6 ? 'antenna' : 'tank', x: w * (0.2 + 0.6 * r(i, 8)), w: 4, h: 10 + r(i, 9) * 30 });
    if (k === 'industry' && r(i, 10) < 0.5) units.push({ unit: 'chimney', x: w * r(i, 11), w: 6, h: 30 + r(i, 12) * 50 });
    const windows = [];
    const lit = far ? 0.06 : 0.04;
    for (let wy = 10; wy < h - 6; wy += far ? 9 : 14) for (let wx = 6; wx < w - 6; wx += far ? 7 : 12) if (r(i * 1000 + wx, wy) < lit) windows.push([wx, wy]);
    list.push({ x, w, h, roof, units, windows });
    x += w;
  }
  return { kind: k, list };
}

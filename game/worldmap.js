// The travel map (#007, Daniel, 13.11.2026: „eine verwitterte alte Karte à la 60er Tourismus, mit Brands aus der Welt des Spiels,
// der Inhalt so dynamisch wie möglich und in jedem Run mehr oder weniger zufällig generiert“). No DOM: game, workshop preview and tests.
//
// Every Durchgang rolls a road network around BigCityDelta (area Reisekarte, data/worldmap.json): the places from the area Orte stay as
// landmarks at their position, the rest are rolled from the POI kinds with generated names, a region by direction, a danger that grows with
// the distance from the start, hints about the loot (from the POI's loot tables) and a brand. Roads link neighbours (relative neighbourhood
// graph, every place gets at least two); from where Leyla is she can drive along one road to a neighbour.
//
//   save.map = { v, seed, cycle, start, nodes: [{ id, name, poi, pos: [km x, km y], region, danger, hints: [category], brand, landmark }],
//                edges: [[a, b]], visited: [id], signs: [{ brand, pos, rot }] }

export const MAP_VERSION = 1;

// small seeded random numbers (mulberry32), the same seed gives the same map
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
const pickW = (r, rows, w = x => x.weight ?? 1) => { let k = r() * rows.reduce((s, x) => s + Math.max(0, w(x)), 0); return rows.find(x => (k -= Math.max(0, w(x))) < 0) || rows[0]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const words = s => String(s || '').split(/[,|]/).map(x => x.trim()).filter(Boolean);

// the settings with defaults (Reisekarte in the workshop)
export function mapConfig(D) {
  const M = D.worldmap || {};
  return {
    count: M.count || [10, 14], radius: M.radius ?? 75, gap: M.gap ?? 11, city: M.city || [0, 0], cityName: M.cityName || 'BigCityDelta', cityRadius: M.cityRadius ?? 9,
    dangerStep: M.dangerStep ?? 30, reveal: M.reveal ?? 2, signs: M.signs ?? 6, detour: M.detour ?? 15,
    kinds: (M.kinds || []).filter(k => D.pois?.[k.poi]), regions: words(M.regions), brands: (M.brands || []).filter(b => b.name),
    fill: { word: words(M.words), office: words(M.offices) },
    title: M.title || 'Straßenkarte BigCityDelta & Umland', edition: M.edition || 'Ausgabe 1962', paper: M.paper, logos: M.logos,
  };
}

// a name from a template: {km} kilometre, {nr} number, {word} place word, {office} office, {region}, {brand}
function nameFrom(r, tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => k === 'km' ? String(Math.max(2, Math.round(ctx.km))) : k === 'nr' ? String(2 + Math.floor(r() * 97)) : k === 'region' ? ctx.region
    : k === 'brand' ? (ctx.brand?.short || ctx.brand?.name || '') : pick(r, ctx.fill[k]?.length ? ctx.fill[k] : ['Nord'])).replace(/\s+/g, ' ').trim();
}

// what lies there, roughly: the item categories of the POI's chests and enemies (the vault is the same everywhere), the strongest three
export function lootHints(D, poiId) {
  const P = D.pois?.[poiId] || {}, tables = [P.loot, ...(P.enemies || []).map(e => D.enemies?.[e]?.loot)].filter(t => t && D.lootTables?.[t]);
  const sum = {};
  for (const t of new Set(tables)) for (const e of D.lootTables[t].entries || []) {
    const cat = e.weapon ? 'weapon' : D.items?.[e.item]?.category;
    if (cat && !['junk', 'progress'].includes(cat)) sum[cat] = (sum[cat] || 0) + (e.weight ?? 1);
  }
  return Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
}

export function generateMap(D, seed, cycle = 1) {
  const C = mapConfig(D), r = rng(seed), nodes = [];
  const regionAt = p => { if (!C.regions.length) return ''; const a = (Math.atan2(p[1] - C.city[1], p[0] - C.city[0]) + Math.PI) / (2 * Math.PI); return C.regions[Math.floor(a * C.regions.length) % C.regions.length]; };
  const brandFor = (kind, rr = r) => { const own = C.brands.filter(b => !b.kind || b.kind === kind); return own.length ? pickW(rr, own) : null; };
  // landmarks: the places from the area Orte at their own position (the first one is where every Durchgang starts)
  for (const [id, L] of Object.entries(D.locations || {})) {
    const P = D.pois?.[L.poi];
    nodes.push({ id, name: L.name || id, poi: L.poi || null, pos: [...(L.position || [0, 0])], region: L.region || regionAt(L.position || [0, 0]), danger: P?.danger || 1,
      hints: lootHints(D, L.poi), brand: brandFor(P?.kind)?.id || null, landmark: true });
  }
  const start = nodes[0]?.pos || [C.city[0] + C.radius / 2, C.city[1]];
  // rolled places: anywhere in the circle around the city, not inside the city, not too close to each other
  const [lo, hi] = C.count, n = lo + Math.floor(r() * (Math.max(lo, hi) - lo + 1));
  for (let i = 0, tries = 0; i < n && tries < n * 60; tries++) {
    const a = r() * Math.PI * 2, d = C.cityRadius + 6 + Math.sqrt(r()) * (C.radius - C.cityRadius - 6), pos = [Math.round((C.city[0] + Math.cos(a) * d) * 10) / 10, Math.round((C.city[1] + Math.sin(a) * d * 0.62) * 10) / 10];
    if (nodes.some(x => dist(x.pos, pos) < C.gap)) continue;
    const kind = C.kinds.length ? pickW(r, C.kinds) : null, poi = kind?.poi || Object.keys(D.pois || {})[0], P = D.pois?.[poi] || {};
    const region = regionAt(pos), brand = brandFor(P.kind), ring = Math.floor(dist(pos, start) / Math.max(1, C.dangerStep));
    const tpl = words(kind?.names || '').filter(Boolean);
    const name = nameFrom(r, tpl.length ? pick(r, tpl) : P.name || poi, { km: dist(pos, C.city), region, brand, fill: C.fill });
    if (nodes.some(x => x.name === name)) continue;
    nodes.push({ id: `n${++i}`, name, poi, pos, region, danger: Math.max(1, Math.min(5, (P.danger || 1) + ring - 1 + (r() < 0.25 ? 1 : 0))), hints: lootHints(D, poi), brand: brand?.id || null, landmark: false });
  }
  // roads: relative neighbourhood graph (a and b are neighbours if no third place is closer to both), then nobody with fewer than two
  const edges = [], has = (a, b) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const d = dist(nodes[i].pos, nodes[j].pos);
    if (!nodes.some((c, k) => k !== i && k !== j && Math.max(dist(nodes[i].pos, c.pos), dist(nodes[j].pos, c.pos)) < d)) edges.push([nodes[i].id, nodes[j].id]);
  }
  for (const a of nodes) {
    const deg = () => edges.filter(e => e.includes(a.id)).length;
    for (const b of [...nodes].filter(b => b !== a).sort((p, q) => dist(a.pos, p.pos) - dist(a.pos, q.pos))) { if (deg() >= 2) break; if (!has(a.id, b.id)) edges.push([a.id, b.id]); }
  }
  // billboards of the brands along the roads (60s tourism: every road has its advert)
  const signs = [];
  for (let i = 0; i < C.signs && edges.length && C.brands.length; i++) {
    const [a, b] = edges[Math.floor(r() * edges.length)].map(id => nodes.find(x => x.id === id).pos), t = 0.3 + r() * 0.4;
    signs.push({ brand: pickW(r, C.brands).id, pos: [a[0] + (b[0] - a[0]) * t + (r() - 0.5) * 6, a[1] + (b[1] - a[1]) * t + (r() - 0.5) * 6], rot: (r() - 0.5) * 0.35 });
  }
  return { v: MAP_VERSION, seed, cycle, start: nodes[0]?.id || null, nodes, edges, visited: nodes[0] ? [nodes[0].id] : [], signs };
}

// the savegame's map: rolled once per Durchgang (save.cycle), kept from then on; Leyla's place must be on it
export function ensureMap(D, save) {
  const cycle = save.cycle || 1;
  if (!save.map || save.map.v !== MAP_VERSION || save.map.cycle !== cycle || !save.map.nodes?.length) {
    save.map = generateMap(D, (Math.random() * 2 ** 31) >>> 0, cycle);
    if (!save.map.nodes.some(n => n.id === save.location)) save.location = save.map.start;
  }
  if (!save.map.nodes.some(n => n.id === save.location)) save.location = save.map.start;
  if (!save.map.visited.includes(save.location)) save.map.visited.push(save.location);
  return save.map;
}
// a place on the map (or, without a map, from the area Orte)
export function placeOf(D, save, id = save?.location) {
  return save?.map?.nodes?.find(n => n.id === id) || (D.locations?.[id] ? { id, ...D.locations[id], pos: D.locations[id].position || [0, 0] } : null);
}
// what the danger of a place does in the run (#014, Daniel 13.11.2026: „Mehr Gegner + mehr Beute“): every step above 1 adds
// Reisekarte › Gefahr wirkt: more enemies, more health and damage, a chance of one more thing per loot roll (all in %)
export function threatOf(D, danger = 1) {
  const T = D.worldmap?.threat || {}, k = Math.max(0, (Number(danger) || 1) - 1);
  return { danger: k + 1, more: k * (T.enemies ?? 25) / 100, health: 1 + k * (T.health ?? 15) / 100, damage: 1 + k * (T.damage ?? 10) / 100, loot: k * (T.loot ?? 20) };
}
export const neighbours = (map, id) => (map?.edges || []).filter(e => e.includes(id)).map(e => e[0] === id ? e[1] : e[0]);
// hops from Leyla's place (breadth first): what the map shows with its name (Reisekarte › Namen sichtbar bis)
export function hops(map, from) {
  const out = { [from]: 0 }, q = [from];
  while (q.length) { const a = q.shift(); for (const b of neighbours(map, a)) if (out[b] == null) { out[b] = out[a] + 1; q.push(b); } }
  return out;
}
// the road between two places: a little longer than the straight line (Reisekarte › Umwege %)
export function roadKm(D, a, b) { return Math.round(dist(a.pos, b.pos) * (1 + (mapConfig(D).detour) / 100)); }

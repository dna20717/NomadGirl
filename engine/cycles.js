// NomadGirl – the cycle graph of a POI (#168 G2, after „Dungeon Generation in Unexplored“ by Boris the Brave: cycles as the basic
// building block, placeholders resolved late). Pure logic for the browser and Node (no DOM), deterministic per seed.
//
// Before the rooms are welded (engine/poi.js buildPoi), planCycles draws the plan of a POI: the main path as slots (start, rooms,
// the Wow room at its place in the arc, the goal with the vault), split into circles of about 7 rooms (POIs › Struktur). Every
// circle gets one recipe:
//   lockKey         Schlüssel und Schloss: a lock on the way on (door, gate, hatch), the key (a prop of the POI's story) in a side
//                   room or high up in a room before it
//   hiddenShortcut  Versteckte Abkürzung: the way back starts behind a fake floor (band) or a camouflaged wall (stack)
//   oneWayDown      Einbahn hinunter: a drop without a way up (band: a platform over the tunnel, tower: the shaft without its
//                   ladder, deep: a joint ladder cut, Leyla falls into the next room)
//   doublePath      Doppelweg: the way back is open at both ends, a second way through the POI
//   dangerReward    Gefahr und Belohnung: a loud side room (or the way back) with a chest
//   changedReturn   Rückweg verändert: the way back opens from the other side (a door Leyla passes first, the switch behind it);
//                   variant „eingestürzter Gang“ (#170): when Leyla enters the goal room, a passage of the main path behind her
//                   caves in (rubble, dust, the camera shakes), so the way home is the changed one (POIs › Struktur › Einsturz)
// The last circle is the outer one: its way back is the POI's shortcut (tunnel under the rooms, shaft beside the stack). Inner
// circles (big POIs like Silo Zero) close over their side room: lockKey, dangerReward, in deep POIs oneWayDown.
// Placeholder slots carry needs (role, a side room for the key, the lock) that buildPoi resolves with fitting room blocks.
import { reach } from './reach.js';

export const RECIPES = [['lockKey', 'Schlüssel und Schloss'], ['hiddenShortcut', 'Versteckte Abkürzung'], ['oneWayDown', 'Einbahn hinunter'],
  ['doublePath', 'Doppelweg'], ['dangerReward', 'Gefahr und Belohnung'], ['changedReturn', 'Rückweg verändert']];
export const KEY_KINDS = [['key', 'Schlüssel'], ['keycard', 'Keycard'], ['stamp', 'Stempel'], ['valve', 'Ventilrad'], ['fuse', 'Sicherung'], ['note', 'Code-Zettel'],
  ['ticket', 'Parkschein'], ['tag', 'Marke']];
export const LOCK_KINDS = [['door', 'Tür'], ['gate', 'Schranke'], ['valve', 'Ventil'], ['fusebox', 'Sicherungskasten'], ['hatch', 'Luke'], ['grate', 'Gittertor']];
// POIs › Struktur: the defaults (all editable per POI)
export const CYCLES = { collapse: 50, rooms: 7, weights: { lockKey: 4, changedReturn: 2, hiddenShortcut: 2, oneWayDown: 2, doublePath: 1, dangerReward: 2 } };
const ROUTE = new Set(['hiddenShortcut', 'doublePath', 'changedReturn']);   // only with a way back (the POI's shortcut)
// how the way back of the outer circle behaves (edge kind in the graph)
export const RETURN_KIND = { lockKey: 'gated', changedReturn: 'gated', hiddenShortcut: 'hidden', oneWayDown: 'oneway', doublePath: 'open', dangerReward: 'danger' };

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const hash = t => [...String(t)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 0x811c9dc5) >>> 0;
export const recipeName = id => RECIPES.find(([k]) => k === id)?.[1] || id;
export const keyKindName = id => KEY_KINDS.find(([k]) => k === id)?.[1] || id;
export const lockKindName = id => LOCK_KINDS.find(([k]) => k === id)?.[1] || id;

// POIs › Struktur → { enabled, rooms, count, weights, keys }
export function cycleConfig(D, poiId) {
  const P = D?.pois?.[poiId] || {}, C = P.cycles || {};
  const listed = (C.recipes || []).filter(r => r?.recipe && r.recipe in CYCLES.weights);
  // a table with rows = only these recipes (weight 0 = off); empty = all with the defaults
  const weights = listed.length ? Object.fromEntries(Object.keys(CYCLES.weights).map(k => [k, 0])) : { ...CYCLES.weights };
  for (const r of listed) weights[r.recipe] = Math.max(0, Number(r.weight ?? 1) || 0);
  return { enabled: C.enabled !== false, rooms: Math.max(2, C.rooms || CYCLES.rooms), count: Math.max(0, C.count || 0), weights, keys: (C.keys || []).filter(k => k?.name),
    collapse: Math.max(0, Math.min(100, C.collapse ?? CYCLES.collapse)) };
}
// the key of circle i: POIs › Struktur › Schlüssel (row i, repeated), else a plain key for a door (stacks: a hatch)
export function keyOf(D, poiId, i, stack) {
  const K = cycleConfig(D, poiId).keys, k = K.length ? K[i % K.length] : null;
  const lock = k?.lock || (stack ? 'hatch' : 'door');
  return { name: k?.name || 'Schlüssel', kind: k?.kind || 'key', lock, lockName: k?.lockName || lockKindName(lock), story: k?.story || '' };
}

// → graph { seed, stack, count, circles: [{ i, outer, recipe, name, from, to, lockSlot, host, drop, key }], slots: [{ slot, role, circle, needs, room }],
//   extras: [{ id, role: key|reward, circle, host }], edges: [{ from, to, kind, circle }] }   (slot ids are numbers, extras strings)
export function planCycles(D, poiId, seed, { count, stack = null, shortcut = true, wowSlot = -1 } = {}) {
  const cfg = cycleConfig(D, poiId), rnd = rng(Math.imul(seed | 0, 2654435761) ^ hash(poiId));
  const graph = { seed, stack, count, circles: [], slots: [], extras: [], edges: [], off: !cfg.enabled };
  for (let s = 0; s < count; s++) graph.slots.push({ slot: s, role: s === 0 ? 'start' : s === count - 1 ? 'goal' : s === wowSlot ? 'wow' : 'room', circle: 0, needs: {}, room: null });
  for (let s = 1; s < count; s++) graph.edges.push({ from: s - 1, to: s, kind: 'path', circle: 0 });
  if (!cfg.enabled || count < 2) return graph;
  // circles: about `rooms` main rooms each, at least 3 (a lock needs a room before it); the last one is the outer circle
  const maxN = Math.max(1, Math.floor(count / 3));
  const n = cfg.count ? Math.min(cfg.count, maxN) : Math.max(1, Math.min(maxN, Math.round(count / cfg.rooms)));
  let a = 0, prev = null;
  for (let i = 0; i < n; i++) {
    const size = Math.round((count - a) / (n - i)), from = a, to = a + size - 1, outer = i === n - 1;
    a += size;
    const can = r => r === 'lockKey' ? to > from : r === 'oneWayDown' ? shortcut && (stack === 'deep' ? to > from : outer) : ROUTE.has(r) ? outer && shortcut : true;
    let opts = Object.entries(cfg.weights).filter(([r, w]) => w > 0 && can(r));
    if (opts.length > 1 && prev) opts = opts.filter(([r]) => r !== prev);   // no recipe twice in a row while there is a choice
    const total = opts.reduce((s, [, w]) => s + w, 0);
    let k = rnd() * total, recipe = opts.find(([, w]) => (k -= w) < 0)?.[0] || opts.at(-1)?.[0] || 'dangerReward';
    prev = recipe;
    const c = { i, outer, recipe, name: recipeName(recipe), from, to, lockSlot: null, host: null, drop: null, key: null };
    for (let s = from; s <= to; s++) graph.slots[s].circle = i;
    if (recipe === 'lockKey') {
      c.lockSlot = to; c.key = keyOf(D, poiId, graph.circles.filter(o => o.key).length, stack);
      c.host = from + Math.floor(rnd() * (to - from));   // a room before the lock: its side room (or a high place in it) holds the key
      graph.slots[c.host].needs.keyHost = true; graph.slots[to].needs.lock = c.key.lock;
      graph.extras.push({ id: `key${i}`, role: 'key', circle: i, host: c.host, name: c.key.name });
      graph.edges.push({ from: c.host, to: `key${i}`, kind: 'detour', circle: i });
      graph.edges.find(e => e.to === to && e.kind === 'path').kind = 'locked';
    } else if (recipe === 'dangerReward' && (!outer || !shortcut)) {
      c.host = from + Math.floor(rnd() * (to - from + 1));
      graph.slots[c.host].needs.dangerHost = true;
      graph.extras.push({ id: `reward${i}`, role: 'reward', circle: i, host: c.host });
      graph.edges.push({ from: c.host, to: `reward${i}`, kind: 'danger', circle: i });
    } else if (recipe === 'oneWayDown' && stack === 'deep') {
      c.drop = from + 1 + Math.floor((to - from) / 2);   // the joint between drop − 1 and drop
      graph.edges.find(e => e.to === c.drop && e.kind === 'path').kind = 'oneway';
    }
    for (let s = from; s <= to; s++) if (!graph.slots[s].needs.lock) graph.slots[s].needs.circle = i;
    graph.circles.push(c);
  }
  // the outer circle closes with the POI's way back (goal → start)
  const outer = graph.circles.at(-1);
  // #170 Rückweg verändert, variant „eingestürzter Gang“: a passage between two main rooms behind the goal caves in once Leyla enters
  // the goal room (its own dice, so the plan of every other circle stays as it was)
  if (shortcut && outer.recipe === 'changedReturn' && count >= 3) {
    const dice = rng(Math.imul(seed | 0, 2246822519) ^ hash(poiId + ':collapse'));
    if (dice() * 100 < cfg.collapse) {
      const lo = Math.max(1, outer.from), hi = count - 2;   // the passage into slot s (from s − 1), never into the goal room itself
      if (hi >= lo) {
        outer.collapse = lo + Math.floor(dice() * (hi - lo + 1)); outer.name = `${outer.name} · eingestürzter Gang`;
        const e = graph.edges.find(e => e.to === outer.collapse && e.kind === 'path'); if (e) e.kind = 'collapse';
      }
    }
  }
  if (shortcut) {
    const kind = outer.recipe === 'oneWayDown' && stack === 'deep' ? 'gated' : RETURN_KIND[outer.recipe] || 'gated';
    graph.edges.push({ from: count - 1, to: 0, kind, circle: outer.i, route: stack ? 'shaft' : 'tunnel' });
  }
  return graph;
}

// places to stand in a rect: 3 rows of air, ground (wall or platform) below, nothing on the tile itself → [[x, y]]
export function standSpots(tiles, r) {
  const at = (x, y) => tiles[y]?.[x], out = [];
  for (let y = r.y + 2; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++)
    if (at(x, y) === '.' && at(x, y - 1) === '.' && at(x, y - 2) === '.' && (at(x, y + 1) === '#' || at(x, y + 1) === '=')) out.push([x, y]);
  return out;
}

// the layout as Leyla meets it at circle `ci`: locks of earlier circles open (a hatch becomes its ladder), the others shut
export function layoutAt(tiles, locks, ci) {
  const lay = tiles.map(r => [...r]);
  for (const L of locks) if (L.circle < ci) for (const [x, y] of L.tiles) lay[y][x] = L.hatch ? 'H' : '.';
  return lay.map(r => r.join(''));
}

// the key of a circle: a reachable place in its side rooms first (far from the ladder), else high up in a main room before the
// lock (the highest place: a gallery, a shelf) → [x, y] or null. regions: [{ x, y, w, h, branch, hookX }]
export function keySpot(tiles, locks, ci, regions, rnd = Math.random) {
  const R = reach(layoutAt(tiles, locks, ci), { locked: true });
  const ok = ([x, y]) => R.reached.has(x + ',' + y) && ![[-1, 0], [1, 0]].some(([dx]) => 'CSZL@!'.includes(tiles[y][x + dx] || '#') && tiles[y][x + dx] !== '#');
  for (const r of regions.filter(r => r.branch)) {
    const s = standSpots(tiles, r).filter(ok).sort((a, b) => Math.abs(b[0] - (r.hookX ?? b[0])) - Math.abs(a[0] - (r.hookX ?? a[0])));
    if (s.length) return s[Math.floor(rnd() * Math.min(3, s.length))];
  }
  for (const r of regions.filter(r => !r.branch)) {
    const s = standSpots(tiles, r).filter(ok).sort((a, b) => a[1] - b[1]);
    if (s.length) { const top = s.filter(p => p[1] <= s[0][1] + 1); return top[Math.floor(rnd() * top.length)]; }
  }
  return null;
}

// a lock across the seam into room b (band): the first column of b (or the one after) whose open tiles are plain air, filled
// from b's top to its floor → [[x, y]] or null
export function seamLock(tiles, b, floorY) {
  for (const x of [b.x, b.x + 1, b.x + 2]) {
    const col = [];
    let clean = true;
    for (let y = b.y; y < floorY; y++) { const c = tiles[y][x]; if (c === '#') continue; if (c !== '.') { clean = false; break; } col.push([x, y]); }
    if (clean && col.length >= 3) return col;
  }
  return null;
}

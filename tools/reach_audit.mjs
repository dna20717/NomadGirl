#!/usr/bin/env node
// Reachability audit without double jump (#145, Daniel 21.11.2026: „Es gibt POI-Situationen, wo Leyla ein Hindernis nicht passieren
// kann, weil sie Doublejumpen können müsste. Das geht nicht.“). The double jump and the air dash only come with cyberware, so every
// POI must be fully playable with what Leyla can do from the start. Welds every POI like the game (engine/poi.js buildPoi) for many
// seeds, searches a graph over the tiles Leyla can stand on and reports what she cannot reach. Also every room block on its own.
//
// Usage: node tools/reach_audit.mjs [--seeds 40] [--poi <id>] [--rooms] [--traps] [--verbose] [--root <project folder>]
//   --rooms    also every room block standalone (entries: L, open seams left/right, hooks A, shortcut; doors open; between two
//              entries at least one way, every mark from some entry)
//   (#175) also from every place she can get to before the goal room (with the doors and locks open by then): a way home to the van,
//   without cracking the vault first („Kein Rückweg zum Van“); ladders folded over a one-way hole come down from the landing
//   --traps    also report dead ends: places she can get to but not back to the van from (model is conservative, so only a hint)
//   Exit 1 when anything is unreachable.
//
// Movement model (tiles of 64 px, measured in the browser with window.nomad in lab rooms, double jump off, 21.11.2026):
//   Leyla stands at feet tile (x, y): rows y, y-1, y-2 not solid (168 px = 2.6 tiles), the tile below carries (wall, platform =,
//   the top of a ladder H). Solid: # A ^ v and closed doors D. Brittle walls B $ (a hit breaks them) and fake walls % are open.
//   measured: jump apex 2.6 tiles (v 1120, g 3600); without the ledge grab a step of 2 tiles, with the ledge grab (hang/vault)
//   4 tiles (5 fails: hands reach 319 px, a 5-high edge is at 320); gaps (empty columns) flat 4 without, 5 with ledge grab;
//   1–2 up: 5 with ledge, 3–4 up: 4 with ledge; down 1–4: 6. A dash on the ground does not make a jump longer.
//   Jumps are checked against the arc itself (arcWith: frame by frame at 60 fps, full jump, 90 % of the run speed, a ceiling over
//   the way stops the rise like a bump in Arcade physics), which reproduces all the measured limits; margin 16 px per gap:
//   - walk left/right; walk off an edge = fall straight down (catching a ladder on the way is allowed)
//   - land: on anything that carries (also on a platform from below) up to 8 columns away, up to 4 rows up, 12 rows down
//   - grab an edge: only an edge that sticks out to her side (the column in front of it is free air); the hands catch it with the
//     feet between edge − 145 px and edge − 10 px, not while rising faster than 450 px/s; then she pulls up (hang or vault)
//   - the body (3 rows) must fit along the way at the higher level, the lowest ceiling over the span limits the arc
//   - ladders: climb up and down, stand on the top, step off sideways; catch a ladder from a jump whose lowest rung is ≤ 2 rows up
//   - platforms: drop through with ↓ + jump; slide under 2-high gaps (any length, floor all the way)
//   - doors: closed until a reachable switch S opens its nearest door (like game/play/poi_level.js), repeated until nothing changes;
//     explicit links of the cycle graph (#168, L.cycles.links) pair a switch with its door first
//   - locks | (#168): shut until Leyla reaches their key + (L.cycles.locks[].keyAt); an open hatch is a ladder
//   - ropes (o) are ignored (extra routes only), and so are the double jump, the air dash and AvA as a platform
// Targets: every chest C, switch S, terminal @, the vault Z, both ends of the shortcut, every room of the level (some standing place
// in it). Reachable = standing in the same row at most 1 column away (E range 130 px). Rules of thumb in docs/features/pois.md.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from './loader.js';
import { loadProject } from '../engine/project.js';
import { buildPoi, poiReady } from '../engine/poi.js';
import { parseRoom } from '../engine/room.js';
import { doorLayout } from '../engine/doors.js';

// numbers of the game at 192 px Leyla (rulesFrom reads them from the data); speed = 90 % of the run (she has to speed up first)
export const RULES = { T: 64, gravity: 3600, jump: 1120, speed: 396, bodyPx: 168, widthPx: 54, handPx: 105, grabUp: 40, grabLow: 95,
  sidePx: 24, rising: 450, marginPx: 16, reachX: 8, upLedge: 4, dropMax: 12 };
export function rulesFrom(D) {
  const m = D.leyla?.movement || {}, k = 168 / 168;
  return { ...RULES, gravity: D.game?.gravity || RULES.gravity, jump: m.jumpVelocity ?? RULES.jump, speed: (m.runSpeed ?? 440) * 0.9,
    grabUp: (m.ledgeUp ?? 40) * k, sidePx: (m.ledgeSide ?? 24) * k, rising: m.ledgeRising ?? 450 };
}
// one jump, frame by frame like Arcade physics (60 fps): full jump, a ceiling `room` px over the take-off floor stops the rise.
// lands = she comes down onto height `rise` (px, up) after at least `hx` px sideways; ledge = her hands meet an edge at `rise`
// (feet between edge − hand − grabUp and edge − 10, not while rising faster than `rising`)
const arcMemo = new Map();
function arcWith(R, room, rise, hx, ledge) {
  if (room < 0) return false;
  const key = [room, rise, hx, ledge].join(':');
  if (arcMemo.has(key)) return arcMemo.get(key);
  const dt = 1 / 60; let h = 0, vy = R.jump, x = 0, ok = false;
  for (let f = 0; f < 120 && !ok; f++) {
    const h0 = h;
    x += R.speed * dt; vy -= R.gravity * dt; h += vy * dt;
    if (h > room) { h = room; vy = Math.min(vy, 0); }
    if (ledge) { if (vy < R.rising && h >= rise - R.handPx - R.grabUp && h <= rise - 10 && x >= hx) ok = true; }
    else if (h0 > rise && h <= rise) { ok = x >= hx; break; }   // she lands where she comes down (air control can only shorten it)
    if (h < Math.min(0, rise) - 13 * R.T) break;
  }
  arcMemo.set(key, ok);
  return ok;
}
const SOLID = new Set(['#', 'A', '^', 'v', 'D']);

// → { nodes: Set('x,y'), open: Set(door index), edges (Map node → Set node), stand(x, y), near(x, y) }
// doorsHeld = door indexes already open, frozen = nothing more opens on the way (#175: the state of the run at that moment);
// stages = the nodes and what was open after each round of opening (#175: where she can be before which door / lock is open)
// lifts (#175): ladders folded up over a one-way hole (cycles.oneWays[].ladder), let down at the landing (at): air until then, a
// ladder after; liftsHeld = indexes already down
export function reachMap(layout, { start, starts, rules = RULES, doorsOpen = false, locks = [], links = [], keysHeld = null, doorsHeld = null, frozen = false, forbid = null, lifts = [], liftsHeld = null } = {}) {
  const H = layout.length, W = Math.max(...layout.map(r => r.length));
  // #168 locks: shut (wall) until their key is reached, then air (a hatch: its ladder); keysHeld = indexes already open
  const lockOf = new Map(), lockOpen = new Set(keysHeld || []);
  locks.forEach((l, i) => { for (const [x, y] of l.tiles) lockOf.set(x + ',' + y, i); });
  const raw0 = (x, y) => (y < 0 || y >= H || x < 0 || x >= W ? '#' : layout[y][x] ?? '#');
  const liftOf = new Map(), liftOpen = new Set(liftsHeld || []);
  lifts.forEach((f, i) => { for (const [x, y] of f.tiles) liftOf.set(x + ',' + y, i); });
  const raw = (x, y) => { const c = raw0(x, y); if (c === '.' && liftOpen.size && liftOpen.has(liftOf.get(x + ',' + y))) return 'H'; if (c !== '|') return c; const i = lockOf.get(x + ',' + y); return i != null && lockOpen.has(i) ? (locks[i].hatch ? 'H' : '.') : '#'; };
  // doors: 4-connected groups of D, every switch opens the nearest (centre distance, as in the game)
  const doorOf = new Map(), doors = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (raw(x, y) === 'D' && !doorOf.has(x + ',' + y)) {
    const g = [], todo = [[x, y]]; doorOf.set(x + ',' + y, doors.length);
    while (todo.length) { const [a, b] = todo.pop(); g.push([a, b]); for (const [c, d] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) if (raw(c, d) === 'D' && !doorOf.has(c + ',' + d)) { doorOf.set(c + ',' + d, doors.length); todo.push([c, d]); } }
    const xs = g.map(p => p[0]), ys = g.map(p => p[1]);
    doors.push({ tiles: g, cx: (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy: (Math.min(...ys) + Math.max(...ys) + 1) / 2 });
  }
  const switches = [], linked = new Map(links.map(k => [k.switch.join(','), doorOf.get(k.door.join(','))]));
  const claimed = new Set([...linked.values()].filter(v => v != null));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (raw(x, y) === 'S') {
    const cx = x + 0.5, cy = y + 1;
    if (linked.get(x + ',' + y) != null) { switches.push({ x, y, door: linked.get(x + ',' + y) }); continue; }
    const best = doors.map((d, i) => [Math.hypot(d.cx - cx, d.cy - cy), i]).filter(([, i]) => !claimed.has(i)).sort((a, b) => a[0] - b[0])[0];
    switches.push({ x, y, door: best ? best[1] : -1 });
  }
  let s0 = starts || (start ? [start] : null);
  if (!s0) for (let y = 0; y < H && !s0; y++) for (let x = 0; x < W; x++) if (raw(x, y) === 'L') { s0 = [[x, y]]; break; }
  if (!s0) return { nodes: new Set(), edges: new Map(), near: () => false, open: new Set(), doors, switches };
  const open = new Set(doorsOpen ? doors.map((_, i) => i) : doorsHeld || []);
  let result;
  const stages = [];
  for (;;) {
    result = search(raw, W, H, s0, open, doorOf, rules, forbid);
    stages.push({ nodes: result.nodes, edges: result.edges, open: new Set(open), lockOpen: new Set(lockOpen), liftOpen: new Set(liftOpen) });
    if (frozen) break;
    let more = false;
    for (const s of switches) if (s.door >= 0 && !open.has(s.door) && nearIn(result.nodes, s.x, s.y)) { open.add(s.door); more = true; }
    locks.forEach((l, i) => { if (!lockOpen.has(i) && l.keyAt && nearIn(result.nodes, ...l.keyAt)) { lockOpen.add(i); more = true; } });
    lifts.forEach((f, i) => { if (!liftOpen.has(i) && f.at && nearIn(result.nodes, ...f.at)) { liftOpen.add(i); more = true; } });
    if (!more) break;
  }
  return { ...result, open, doors, switches, lockOpen, liftOpen, stages, near: (x, y) => nearIn(result.nodes, x, y) };
}
// E reaches it: standing in the same row (feet tile), at most one column away
const nearIn = (nodes, x, y) => [-1, 0, 1].some(d => nodes.has((x + d) + ',' + y));

function search(raw, W, H, starts, open, doorOf, R, forbid = null) {
  const T = R.T, arc = (room, rise, hx, ledge) => arcWith(R, room, rise, hx, ledge);
  const solid = (x, y) => { const c = raw(x, y); return c === 'D' ? !open.has(doorOf.get(x + ',' + y)) : SOLID.has(c); };
  const plat = (x, y) => raw(x, y) === '=';
  const lad = (x, y) => raw(x, y) === 'H';
  const free = (x, y) => !solid(x, y);
  const body = (x, y, h = 3) => { for (let k = 0; k < h; k++) if (solid(x, y - k)) return false; return true; };
  const ground = (x, y) => solid(x, y + 1) || plat(x, y + 1) || (lad(x, y + 1) && !lad(x, y));   // carries her feet (ladder: its top)
  const onLadder = (x, y) => lad(x, y) || lad(x, y + 1);   // feet from one above the top rung down to the lowest rung
  const at = (x, y) => body(x, y) && (ground(x, y) || onLadder(x, y));
  const colFree = (x, y0, y1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) if (solid(x, y)) return false; return true; };
  // free px over the feet tile's floor in this column (up to the first solid tile)
  const ceilAbove = (x, y) => { let k = 0; while (k < 12 && !solid(x, y - k)) k++; return k * T; };
  const nodes = new Set(), edges = new Map(), q = [];
  const key = (x, y) => x + ',' + y;
  let from = null;
  const push = (x, y) => {
    if (y < 0 || y >= H || x < 0 || x >= W || forbid?.(x, y)) return;   // #175 forbid: places she may not use (the goal room)
    const k = key(x, y);
    if (from) { let e = edges.get(from); if (!e) edges.set(from, e = new Set()); e.add(k); }
    if (!nodes.has(k)) { nodes.add(k); q.push([x, y]); }
  };
  // fall straight down from (x, y) (body free there): every ladder on the way can be caught, then the ground
  const fall = (x, y) => {
    for (let yy = y; yy < H; yy++) {
      if (!body(x, yy)) return;
      if (onLadder(x, yy)) push(x, yy);
      if (ground(x, yy)) { push(x, yy); return; }
    }
  };
  for (const [x, y] of starts) { if (at(x, y)) push(x, y); else if (body(x, y)) fall(x, y); }
  while (q.length) {
    const [x, y] = q.pop(); from = key(x, y);
    const onGround = ground(x, y);
    // walk, step off a ladder, walk off an edge
    for (const d of [-1, 1]) {
      if (body(x + d, y)) { if (at(x + d, y)) push(x + d, y); else fall(x + d, y); }
      else if (onGround && body(x + d, y, 2)) {   // slide through a low gap (2 rows) as long as the floor goes on
        let xx = x + d;
        while (body(xx, y, 2) && !body(xx, y) && ground(xx, y)) xx += d;
        if (body(xx, y) && ground(xx, y)) push(xx, y);
      }
    }
    // ladders
    if (onLadder(x, y)) {
      if (onLadder(x, y - 1) && body(x, y - 1)) push(x, y - 1);
      if (onLadder(x, y + 1) && body(x, y + 1)) push(x, y + 1);
      if (!ground(x, y) && !onLadder(x, y + 1)) fall(x, y + 1);   // let go at the bottom
    }
    if (!onGround) continue;
    // drop through a platform (↓ + jump)
    if (plat(x, y + 1)) fall(x, y + 1);
    // jumps: every landing place within reach, checked against the arc (arc() below) under the lowest ceiling along the way
    const up0 = ceilAbove(x, y);
    for (let d = -R.reachX; d <= R.reachX; d++) for (let y2 = y - R.upLedge; y2 <= y + R.dropMax; y2++) {
      if (!d && y2 >= y) continue;
      const x2 = x + d, dh = y - y2, ad = Math.abs(d), s = Math.sign(d);
      if (x2 < 0 || x2 >= W || y2 < 0 || y2 >= H) continue;
      const lands = body(x2, y2) && ground(x2, y2), catches = !lands && lad(x2, y2) && body(x2, y2);
      if (!lands && !catches) continue;
      const hi = Math.min(y, y2);
      // the body fits along the way at the higher of both levels; ceiling = the lowest one over the span, in px over her take-off floor
      let ceil = Math.min(up0, ceilAbove(x2, y2) + (y - y2) * T), ok = true;
      for (let xx = Math.min(x, x2) + 1; ok && xx < Math.max(x, x2); xx++) { if (!body(xx, hi)) ok = false; else ceil = Math.min(ceil, ceilAbove(xx, hi) + (y - hi) * T); }
      if (!ok) continue;
      const room = ceil - R.bodyPx - 2, gap = Math.max(0, ad - 1) * T;
      // landing on it: over the gap (her box may hang 1 px over an edge, so the gap minus her width, plus a margin)
      if (arc(room, dh * T, Math.max(0, gap - R.widthPx + R.marginPx), false)) { push(x2, y2); continue; }
      // grabbing its edge from the side (hang or vault, then pull up): the edge sticks out, the air in front of it is free
      if (!lands || !ad || lad(x2, y2 + 1) || dh < -2) continue;
      if (solid(x2 - s, y2 + 1) || plat(x2 - s, y2 + 1) || !colFree(x2 - s, y2 - 2, Math.min(y, y2 + 2))) continue;
      if (arc(room, dh * T, Math.max(0, gap - R.widthPx / 2 - R.sidePx + R.marginPx), true)) push(x2, y2);
    }
  }
  return { nodes, edges };
}

// nodes from which a start node is reachable again (reverse search over the edges)
export function backTo(map, startKeys) {
  const rev = new Map();
  for (const [a, set] of map.edges) for (const b of set) { let r = rev.get(b); if (!r) rev.set(b, r = []); r.push(a); }
  const seen = new Set(startKeys), q = [...startKeys];
  while (q.length) { const k = q.pop(); for (const a of rev.get(k) || []) if (!seen.has(a)) { seen.add(a); q.push(a); } }
  return seen;
}

// what the cycle graph puts into a level for the search: locks with their keys, switch → door links, ladders to let down (#175)
export const cycleOpts = L => { const c = L.cycles || {}; return { locks: c.locks || [], links: c.links || [], lifts: (c.oneWays || []).filter(o => o.ladder?.length).map(o => ({ tiles: o.ladder, at: o.land })) }; };

// #175 (Daniel 22.11.2026: „Aus dem Hochhaus kommt man nicht wieder raus, wenn man vorzeitig raus will“): from every place she can get
// to, with the run as it is when she first gets there (the doors and locks open by then), a way home to the van exists without the
// goal room: she may open switches, doors and locks on the way back, but she does not have to crack the vault or take the shortcut
// first. The goal room itself and the shortcut are the business of „Rückweg vom Tresor“ and „Einsturz“. Places are grouped by what
// they can reach (strongly connected parts of the move graph), one search per part → [{ kind, x, y, room }] (one per room and stage)
export function homeAudit(L) {
  const lay = L.def.layout, opts = cycleOpts(L);
  const inR = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  const roomAt = (x, y) => L.rooms.find(r => inR(r, x, y));
  const goals = L.rooms.filter(r => { for (let y = r.y; y < r.y + r.h; y++) if (lay[y]?.slice(r.x, r.x + r.w).includes('Z')) return true; return false; });
  const forbid = goals.length ? (x, y) => goals.some(r => inR(r, x, y)) : null;
  const isVan = k => { const [x, y] = k.split(',').map(Number); return lay[y][x] === 'L'; };
  // the run before the goal room, round by round: what she reaches without it, and what is open by then (places she only gets to
  // through the goal room, like a side room hanging off it or the far end of an open shortcut, belong to the goal room)
  const M = reachMap(lay, { ...opts, forbid });
  const out = [], seen = new Set(), told = new Set();
  M.stages.forEach((st, k) => {
    const fresh = [...st.nodes].filter(n => !seen.has(n));
    for (const n of st.nodes) seen.add(n);
    if (!fresh.length) return;
    // the places new in this stage and everything they reach, nothing more opens (frozen) → which of them get home as they are
    const vanKeys = [...st.nodes].filter(isVan).map(k => k.split(',').map(Number));
    const G = reachMap(lay, { ...opts, starts: [...fresh.map(n => n.split(',').map(Number)), ...vanKeys], keysHeld: [...st.lockOpen], doorsHeld: [...st.open], liftsHeld: [...st.liftOpen], frozen: true, forbid });
    const home = backTo(G, [...G.nodes].filter(isVan));
    const bad = fresh.filter(n => !home.has(n) && G.nodes.has(n));
    if (!bad.length) return;
    // strongly connected parts among the bad places (iterative Tarjan): one search from one place of each part
    const badSet = new Set(bad), idx = new Map(), low = new Map(), onStack = new Set(), stack = [], parts = [];
    let counter = 0;
    for (const v0 of bad) {
      if (idx.has(v0)) continue;
      const work = [[v0, [...(G.edges.get(v0) || [])].filter(w => badSet.has(w)), 0]];
      idx.set(v0, counter); low.set(v0, counter++); stack.push(v0); onStack.add(v0);
      while (work.length) {
        const top = work[work.length - 1], [v, nb] = top;
        if (top[2] < nb.length) {
          const w = nb[top[2]++];
          if (!idx.has(w)) { idx.set(w, counter); low.set(w, counter++); stack.push(w); onStack.add(w); work.push([w, [...(G.edges.get(w) || [])].filter(u => badSet.has(u)), 0]); }
          else if (onStack.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
        } else {
          work.pop();
          if (work.length) { const u = work[work.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
          if (low.get(v) === idx.get(v)) { const part = []; let w; do { w = stack.pop(); onStack.delete(w); part.push(w); } while (w !== v); parts.push(part); }
        }
      }
    }
    for (const part of parts) {
      const [x, y] = part[0].split(',').map(Number);
      const R = reachMap(lay, { ...opts, start: [x, y], keysHeld: [...st.lockOpen], doorsHeld: [...st.open], liftsHeld: [...st.liftOpen], forbid });
      if (vanKeys.some(([a, b]) => R.nodes.has(a + ',' + b)) || [...R.nodes].some(isVan)) continue;
      const r = roomAt(x, y), id = r?.id || (L.shortcut?.kind === 'shaft' ? 'Schacht' : 'Tunnel'), tag = id + ':' + k;
      if (told.has(tag)) continue;
      told.add(tag);
      out.push({ kind: 'Kein Rückweg zum Van', x, y, room: id, stage: k, n: part.length, lx: r ? (r.flip ? r.w - 1 - (x - r.x) : x - r.x) : '–', ly: r ? y - r.y : '–' });
    }
  });
  return out;
}

// one welded level → findings [{ kind, x, y, room, lx, ly }]
export function auditLevel(L, { traps = false } = {}) {
  const lay = L.def.layout, out = [];
  const roomAt = (x, y) => L.rooms.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  const note = (kind, x, y) => {
    const r = roomAt(x, y);
    const lx = r ? (r.flip ? r.w - 1 - (x - r.x) : x - r.x) : '–', ly = r ? y - r.y : '–';
    out.push({ kind, x, y, room: r ? r.id : (L.shortcut?.kind === 'shaft' ? 'Schacht' : 'Tunnel'), lx, ly });
  };
  const cyc = L.cycles || {}, opts = cycleOpts(L);
  const M = reachMap(lay, opts);
  for (let y = 0; y < lay.length; y++) for (let x = 0; x < lay[y].length; x++) {
    const c = lay[y][x];
    if ('CSZ@+'.includes(c) && !M.near(x, y)) note({ C: 'Kiste', S: 'Schalter', Z: 'Tresor', '@': 'Terminal', '+': 'Schlüssel' }[c], x, y);
  }
  // #174 doors: shut ones open by E (they count as open); locked ones count as wall: keys, switches and the vault stay reachable without them
  if ((L.doors?.side || []).some(d => d.state === 'locked')) {
    const M2 = reachMap(doorLayout(L, { locked: true }), opts);
    for (let y = 0; y < lay.length; y++) for (let x = 0; x < lay[y].length; x++) if ('SZ+'.includes(lay[y][x]) && M.near(x, y) && !M2.near(x, y)) note('hinter verschlossener Tür', x, y);
  }
  // #168 every lock opens (its key is reachable before it: no softlock) and every one-way drop leads on to the vault or home
  (cyc.locks || []).forEach((l, i) => { if (!M.lockOpen.has(i)) note('Schloss ohne erreichbaren Schlüssel', ...l.tiles[0]); });
  for (const o of cyc.oneWays || []) {
    // keys she surely holds up there: the locks without which the drop cannot be reached (she may have left every other key behind)
    const held = opts.locks.map((_, i) => i).filter(i => !reachMap(lay, { ...opts, locks: opts.locks.map((l, k) => k === i ? { ...l, keyAt: null } : l) }).near(...o.from));
    const from = reachMap(lay, { ...opts, start: o.land, keysHeld: held });
    const goal = [], van = [];
    for (let y = 0; y < lay.length; y++) for (let x = 0; x < lay[y].length; x++) { if (lay[y][x] === 'Z') goal.push([x, y]); if (lay[y][x] === 'L') van.push([x, y]); }
    if (!goal.some(p => from.near(...p)) && !van.some(p => from.near(...p))) note('Einbahn in die Sackgasse', ...o.land);
  }
  // #170 eingestürzter Gang: once the passage is rubble (Leyla stands in the goal room), the way home still exists (the changed one)
  for (const c of cyc.collapses || []) {
    const shut = lay.map((r, y) => [...r].map((t, x) => c.tiles.some(([a, b]) => a === x && b === y) ? '#' : t).join(''));
    const t = c.trigger, inGoal = [];
    for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) if (lay[y]?.[x] === 'Z' || (M.nodes.has(x + ',' + y) && !inGoal.length)) inGoal.push([x, y]);
    const from = inGoal.find(([x, y]) => lay[y][x] === 'Z') || inGoal[0];
    if (!from) { note('Einsturz ohne Zielraum', ...c.tiles[0]); continue; }
    const after = reachMap(shut, { ...opts, start: from, keysHeld: opts.locks.map((_, i) => i) });
    const van = []; for (let y = 0; y < lay.length; y++) for (let x = 0; x < lay[y].length; x++) if (lay[y][x] === 'L') van.push([x, y]);
    if (!van.some(p => after.near(...p))) note('Einsturz: kein Weg zum Van', ...c.tiles[0]);
  }
  // #175 from every place she gets to before the goal room, a way home to the van (vorzeitig raus)
  for (const f of homeAudit(L)) out.push(f);
  const sc = L.shortcut;
  if (sc) for (const [name, p] of [['Abkürzung (Ausgang)', sc.oneWay ? (cyc.oneWays || []).at(-1)?.from || sc.down : sc.down], ['Abkürzung (Eingang)', sc.up]]) {
    const [x, y] = p, hit = [-1, 0, 1, 2, 3].some(dy => [-1, 0, 1].some(dx => M.nodes.has((x + dx) + ',' + (y - 1 + dy))));
    if (!hit) note(name, x, y);
  }
  for (const r of L.rooms) {
    let any = false;
    for (const k of M.nodes) { const [x, y] = k.split(',').map(Number); if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) { any = true; break; } }
    if (!any) out.push({ kind: r.band === 'main' ? 'Hauptraum' : 'Seitenraum', room: r.id, x: r.x, y: r.y, lx: 0, ly: 0 });
  }
  // back to the van: from the vault (doors as the run left them) the way home exists (shortcut or the way in)
  const startKeys = [...M.nodes].filter(k => { const [x, y] = k.split(',').map(Number); return lay[y][x] === 'L'; });
  if (startKeys.length) {
    const back = backTo(M, startKeys);
    const z = []; for (let y = 0; y < lay.length; y++) for (let x = 0; x < lay[y].length; x++) if (lay[y][x] === 'Z') z.push([x, y]);
    for (const [x, y] of z) if (M.near(x, y) && ![-1, 0, 1].some(d => back.has((x + d) + ',' + y))) note('Rückweg vom Tresor', x, y);
    if (traps) {
      const byRoom = new Map();
      for (const k of M.nodes) if (!back.has(k)) { const [x, y] = k.split(',').map(Number); const r = roomAt(x, y); const id = r?.id || '—'; if (!byRoom.has(id)) byRoom.set(id, [x, y]); }
      for (const [, [x, y]] of byRoom) note('Sackgasse', x, y);
    }
  }
  return out;
}

// one room block standalone → findings
export function auditRoom(id, room) {
  const p = parseRoom(room), lay = p.tiles.map(r => [...r]), h = p.h, out = [];
  // hooks: a ladder comes down through a ceiling hook, a floor hook is a ladder going down out of the room
  for (const [x, y] of p.marks.A) {
    if (y === 0) for (let yy = 0; yy < h && !'#=H'.includes(yy ? lay[yy][x] : '.'); yy++) lay[yy][x] = 'H';
    else lay[y][x] = 'H';
  }
  for (const [x, y] of [...p.marks['^'], ...p.marks.v]) lay[y][x] = 'H';
  const L = lay.map(r => r.join(''));
  const entries = [];
  if (p.start) entries.push(['Start', p.start]);
  for (const [side, x] of [['links', 0], ['rechts', p.w - 1]]) for (let y = h - 2; y >= 0; y--) if (!SOLID.has(L[y][x]) && SOLID.has(L[y + 1]?.[x] ?? '#') && !SOLID.has(L[y - 1]?.[x]) && !SOLID.has(L[y - 2]?.[x])) { entries.push([`Naht ${side}`, [x, y]]); break; }
  for (const [x, y] of p.marks.A) entries.push([y === 0 ? 'Haken oben' : 'Haken unten', y === 0 ? [x, 3] : [x, y]]);
  for (const [x, y] of [...p.marks['^'], ...p.marks.v]) entries.push(['Abkürzung', [x, y]]);
  if (!entries.length) return out;
  // doors count as open (their switch is on the way in from another room or the tunnel); between every two entries one way must
  // exist (a room may be one-way: in a tower you leave through the ceiling hook), every mark from some entry
  const maps = entries.map(([, p]) => reachMap(L, { start: p, doorsOpen: true }));
  const hits = (M, [x, y]) => [-1, 0, 1, 2].some(dy => [-1, 0, 1].some(dx => M.nodes.has((x + dx) + ',' + (y + dy))));
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++)
    if (!hits(maps[i], entries[j][1]) && !hits(maps[j], entries[i][1])) out.push({ kind: `kein Weg ${entries[i][0]} ↔ ${entries[j][0]}`, room: id, x: entries[j][1][0], y: entries[j][1][1], lx: entries[j][1][0], ly: entries[j][1][1] });
  for (let y = 0; y < h; y++) for (let x = 0; x < p.w; x++) { const c = L[y][x]; if ('CSZ@'.includes(c) && !maps.some(M => M.near(x, y))) out.push({ kind: { C: 'Kiste', S: 'Schalter', Z: 'Tresor', '@': 'Terminal' }[c], room: id, x, y, lx: x, ly: y }); }
  return out;
}

// ---------- command line ----------
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const seeds = +(opt('--seeds') || 40), only = opt('--poi'), verbose = args.includes('--verbose'), traps = args.includes('--traps');
  const root = opt('--root') || path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl');
  const D = (await loadProject(nodeLoader(root))).data;
  Object.assign(RULES, rulesFrom(D));
  let total = 0;
  for (const poi of Object.keys(D.pois || {})) {
    if (only && poi !== only) continue;
    if (!poiReady(D, poi).ok) continue;
    const agg = new Map();
    for (let seed = 1; seed <= seeds; seed++) {
      const L = buildPoi(D, poi, seed);
      if (!L.def) continue;
      for (const f of auditLevel(L, { traps })) {
        const k = `${f.room} · ${f.kind} · Kachel ${f.lx},${f.ly}`;
        const a = agg.get(k) || { n: 0, seeds: [], f };
        a.n++; if (a.seeds.length < 5) a.seeds.push(`${seed}@${f.x},${f.y}`); agg.set(k, a);
      }
    }
    const real = [...agg].filter(([, a]) => a.f.kind !== 'Sackgasse');
    total += real.length;
    console.log(`${poi}: ${real.length ? real.length + ' Befunde' : 'alles erreichbar'} (${seeds} Seeds)`);
    for (const [k, a] of agg) console.log(`  ${k}  (${a.n}× · z. B. Seed ${a.seeds.join(', ')})`);
  }
  if (args.includes('--rooms')) {
    let n = 0;
    for (const [id, room] of Object.entries(D.rooms || {})) {
      if (!room.layout?.length) continue;
      const f = auditRoom(id, room);
      if (f.length || verbose) console.log(`Raum ${id}: ${f.length ? f.map(x => `${x.kind} ${x.lx},${x.ly}`).join(' · ') : 'ok'}`);
      n += f.length;
    }
    console.log(`Räume einzeln: ${n} Befunde`);
    total += n;
  }
  console.log(total ? `${total} Befunde ohne Doppelsprung` : 'Alles ohne Doppelsprung erreichbar.');
  process.exit(total ? 1 : 0);
}

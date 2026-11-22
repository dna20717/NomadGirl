// NomadGirl – POI levels. Hand-built room blocks are welded into one seamless level (like Dead Cells):
//
//   branch band   side rooms (tags loot/secret) hang above a main room, a ladder joins their floor hook A to the main room's ceiling hook A
//   main band     entrance (tag start, Leyla's van at L) → middle rooms (combat/corridor) → exit (tag exit, goal Z)
//   tunnel        the shortcut back (like Elden Ring): from v in the exit room down, along under all rooms, up at ^ in the entrance
//
// Stacked POIs (#038, Daniel 15.11.2026: „unterirdische oder insgesamt vertikale wie Hochhaus-Ruinen“), POIs › Level › Aufbau:
//   tower   entrance at the bottom, the main rooms stack upwards, the exit on top (high-rise ruins, radio masts, car parks)
//   deep    entrance at the surface, the main rooms go down, the exit at the bottom (metro, sewers, mines, silos)
//   Rooms join through hooks: the floor hook A of the upper room sits over the ceiling hook A of the lower one, a ladder between.
//   Side rooms (loot/secret) stand next to a main room on the same floor, joined through the open seam. The shortcut is a shaft
//   beside the stack with a ladder from top to bottom; at the bottom a door into the lowest room that only a switch on the far side
//   opens (tower: in the shaft, deep: in the exit room).
//
// Runs in the browser (game) and in Node (validation, tests). Same POI + same seed = same level.
import { parseRoom } from './room.js';
import { levelConfig, wowOf, roomType, calmAfterPeaks, fairFights, restChestSpot } from './level_design.js';
import { planCycles, keySpot, seamLock, standSpots } from './cycles.js';
import { shaftConfig } from './shaft.js';
import { planDoors } from './doors.js';

export const TUNNEL_HEIGHT = 4;   // free rows in the shortcut tunnel (Leyla is 168 px = 2.6 tiles)

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pick = (list, rnd, R) => {
  const total = list.reduce((s, id) => s + Math.max(0, R[id].weight ?? 1), 0);
  if (!list.length) return null;
  if (total <= 0) return list[Math.floor(rnd() * list.length)];
  let k = rnd() * total;
  return list.find(id => (k -= Math.max(0, R[id].weight ?? 1)) < 0) || list.at(-1);
};
const tagged = (R, id, ...tags) => tags.some(t => R[id]?.tags?.includes(t));

// can this POI be played as a generated level? → { ok, why }
export function poiReady(D, poiId) {
  const P = D.pois?.[poiId], R = D.rooms || {};
  if (!P) return { ok: false, why: 'POI fehlt' };
  const ready = (P.rooms || []).filter(id => R[id]?.layout?.length);
  if (!ready.some(id => tagged(R, id, 'start'))) return { ok: false, why: 'Kein Eingang (Merkmal Eingang) mit Layout' };
  if (!ready.some(id => tagged(R, id, 'exit') && !tagged(R, id, 'start'))) return { ok: false, why: 'Kein Ausgang (Merkmal Ausgang) mit Layout' };
  return { ok: true, why: '' };
}

// → { def (a room definition the game plays: name, size, layout, spawns, backdrop), rooms: [{ id, band, x, y, w, h }],
//     shortcut: null | { up: [x, y] (ladder top in the entrance), down: [x, y] (ladder top in the exit), floor: tunnel floor row }, branches, problems }
// Spannungskurve: „30, 70, 20, 85, 100“ → [0.3, 0.7, …] (null = off, every 1 is an enemy as before)
export function parseCurve(text) {
  const v = String(text ?? '').split(/[,;\s]+/).filter(Boolean).map(Number).filter(n => Number.isFinite(n));
  return v.length ? v.map(n => Math.max(0, Math.min(150, n)) / 100) : null;
}
// the curve at t (0 = entrance, 1 = exit), linear between its points
export function curveAt(c, t) {
  if (c.length === 1) return c[0];
  const f = Math.max(0, Math.min(1, t)) * (c.length - 1), i = Math.min(c.length - 2, Math.floor(f));
  return c[i] + (c[i + 1] - c[i]) * (f - i);
}

// #174 doors after the welding: side doors go into the layout („/“), front doors and every door's state into L.doors (engine/doors.js)
export function buildPoi(D, poiId, seed = 1) {
  const L = weld(D, poiId, seed);
  if (L.def) { const d = planDoors(D, poiId, L, seed); L.doors = d; } else L.doors = { side: [], front: [], links: 0, problems: [] };
  return L;
}
function weld(D, poiId, seed = 1) {
  const P = D.pois?.[poiId] || {}, R = D.rooms || {}, rnd = rng(seed), problems = [];
  const all = (P.rooms || []).filter(id => R[id]?.layout?.length);
  const parsed = Object.fromEntries(all.map(id => [id, parseRoom(R[id])]));
  // stacked: a room needs the hooks its place in the stack joins with (tower: entrance ceiling, exit floor; deep: the other way round)
  const stack = P.stack === 'tower' || P.stack === 'deep' ? P.stack : null;
  const hook = (id, y) => parsed[id].marks.A.filter(([, hy]) => hy === (y === 'floor' ? parsed[id].h - 1 : 0));
  const needs = (id, ...ys) => ys.every(y => hook(id, y).length);
  const ready = all;
  // #163 the Wow room of the POI comes in every run (POIs › Wow); as the entrance when its place in the arc is the threshold
  const LD = levelConfig(D), W0 = wowOf(D, poiId), wowId = W0 && parsed[W0.room] && (P.rooms || []).includes(W0.room) ? W0.room : null;
  const wowStart = !!wowId && W0.at === 'start' && tagged(R, wowId, 'start') && (!stack || needs(wowId, stack === 'tower' ? 'ceil' : 'floor'));
  const picked = pick(ready.filter(id => tagged(R, id, 'start') && (!stack || needs(id, stack === 'tower' ? 'ceil' : 'floor'))), rnd, R);   // always rolled: same seed, same level as before
  const start = wowStart ? wowId : picked;
  const exit = pick(ready.filter(id => tagged(R, id, 'exit') && id !== start && !tagged(R, id, 'start') && (!stack || needs(id, stack === 'tower' ? 'floor' : 'ceil'))), rnd, R);
  if (!start || !exit) return { def: null, rooms: [], shortcut: false, branches: 0, problems: [stack ? `Stapel (${stack}): Eingang/Ausgang ohne passende Haken (A)` : poiReady(D, poiId).why] };
  // main path: entrance, middle rooms, exit (roomCount = length of the main path)
  const [c0, c1] = P.roomCount || [3, 3], count = Math.max(2, c0 + Math.floor(rnd() * (Math.max(c0, c1) - c0 + 1)));
  const middlePool = ready.filter(id => tagged(R, id, 'combat', 'corridor') && !tagged(R, id, 'start', 'exit') && (R[id].weight ?? 1) > 0 && (!stack || needs(id, 'floor', 'ceil')));
  const main = [start];
  for (let i = 0; i < count - 2 && middlePool.length; i++) {
    // no room twice in a row while there is a choice
    const pool = middlePool.length > 1 ? middlePool.filter(id => id !== main.at(-1)) : middlePool;
    main.push(pick(pool, rnd, R));
  }
  if (wowId && !wowStart && (!stack || needs(wowId, 'floor', 'ceil'))) {
    const at = W0.at === 'mid' ? Math.max(1, Math.floor(main.length / 2)) : main.length - 1;
    if (main.length > 1) main[at] = wowId; else main.push(wowId);
  }
  main.push(exit);
  const enemyKit = makeEnemies(D, P, R, rnd);
  // #163 rhythm: after a peak (≥ 85 %) a calm room (< 40 %), preferably an Atempause; not right before the exit (it lies near the climax)
  const curve = enemyKit.curve, intens = main.map((_, i) => curve ? curveAt(curve, main.length > 1 ? i / (main.length - 1) : 1) : 1);
  const restPool = middlePool.filter(id => roomType(R[id]) === 'rest');
  for (const c of curve ? calmAfterPeaks(intens, LD) : []) {
    if (main[c.at] === wowId) continue;
    const pool = restPool.filter(id => id !== main[c.at - 1] && id !== main[c.at + 1]);
    if (pool.length && roomType(R[main[c.at]]) !== 'rest') main[c.at] = pick(pool, rnd, R);
  }
  // #168 the cycle graph: circles of about 7 rooms, one recipe each; its placeholders are resolved with the rooms picked above
  const graph = planCycles(D, poiId, seed, { count: main.length, stack, shortcut: P.shortcut !== false, wowSlot: main.indexOf(wowId) });
  resolveSlots({ graph, main, R, parsed, middlePool, stack, wowId, seed });
  const flags = id => ({ rest: roomType(R[id]) === 'rest', wow: id === wowId });
  Object.assign(enemyKit, { LD, stack });
  if (stack) return buildStack({ D, P, poiId, R, rnd, parsed, ready, main, start, exit, stack, hook, enemyKit, problems, intens, flags, graph });

  // branches: side rooms with a floor hook A over main rooms with a ceiling hook A
  const branchPool = ready.filter(id => tagged(R, id, 'loot', 'secret') && parsed[id].marks.A.some(([, y]) => y === parsed[id].h - 1));
  const chance = (P.branchChance ?? 60) / 100;
  const MH = Math.max(...main.map(id => parsed[id].h));
  const W = main.reduce((s, id) => s + parsed[id].w, 0) + 2;
  const placedMain = [];
  let x = 1;
  for (const id of main) { placedMain.push({ id, band: 'main', x, w: parsed[id].w, h: parsed[id].h, ...flags(id) }); x += parsed[id].w; }
  const branches = [], hosts = hostSlots(graph);
  placedMain.forEach((m, slot) => {
    const hooks = parsed[m.id].marks.A.filter(([, y]) => y === 0);
    for (const [hx] of hooks) {
      // #168 a key or a reward needs a side room over its host: the roll still happens (same seed, same level elsewhere)
      const force = hosts.has(slot) && !branches.some(o => o.main === m);
      if (!branchPool.length || (rnd() >= chance && !force)) continue;
      const id = pick(branchPool, rnd, R), b = parsed[id], [bx] = b.marks.A.find(([, y]) => y === b.h - 1);
      const left = m.x + hx - bx;
      if (left < 1 || left + b.w > W - 1 || branches.some(o => left < o.x + o.w + 1 && o.x < left + b.w + 1)) continue;
      branches.push({ id, band: 'branch', x: left, w: b.w, h: b.h, hookX: m.x + hx, main: m, ...(hosts.get(slot) === 'danger' ? { danger: true } : {}) });
    }
  });
  const BH = branches.length ? Math.max(...branches.map(b => b.h)) : 0;
  const pS = parsed[start], pE = parsed[exit];
  const up = pS.marks['^'].find(([, y]) => y === pS.h - 1), down = pE.marks.v.find(([, y]) => y === pE.h - 1);
  const shortcut = P.shortcut !== false && !!up && !!down;
  if (P.shortcut !== false && !up) problems.push(`Eingang ${start}: keine Abkürzung (^) im Boden`);
  if (P.shortcut !== false && !down) problems.push(`Ausgang ${exit}: keine Abkürzung (v) im Boden`);
  const top = BH, H = BH + MH + (shortcut ? TUNNEL_HEIGHT + 1 : 0);
  const tiles = Array.from({ length: H }, () => new Array(W).fill('#'));

  placedMain.forEach((m, i) => { m.intensity = intens[i]; });
  for (const b of branches) b.intensity = b.danger ? 1 : curve ? (b.main.intensity ?? 1) * 0.5 : 1;
  const stamp = (place, y0) => stampRoom({ R, parsed, tiles, start, exit, enemyKit, keep: { '^': place.id === start && shortcut, v: place.id === exit && shortcut } }, place, y0);
  for (const m of placedMain) stamp(m, top + MH - m.h);
  for (const b of branches) stamp(b, top - b.h);
  // L only once (entrance), first one wins
  let seenL = false;
  for (const row of tiles) for (let x = 0; x < W; x++) if (row[x] === 'L') { if (seenL) row[x] = '.'; seenL = true; }

  // seams between main rooms: if no tile is open on both sides, cut a door (3 high) just above the floor
  const floorY = top + MH - 1, wall = c => c === '#' || c === 'A' || c === '^' || c === 'v';
  for (let i = 1; i < placedMain.length; i++) {
    const a = placedMain[i - 1], b = placedMain[i], xa = b.x - 1, xb = b.x;
    let open = false;
    for (let y = top; y < floorY; y++) if (!wall(tiles[y][xa]) && !wall(tiles[y][xb]) && tiles[y][xa] !== 'D' && tiles[y][xb] !== 'D') open = true;
    if (!open) { for (let y = floorY - 3; y < floorY; y++) for (const xx of [xa - 1, xa, xb, xb + 1]) if (wall(tiles[y][xx])) tiles[y][xx] = '.'; problems.push(`Durchgang ${a.id} → ${b.id} geschnitten`); }
  }
  // branch ladders: from the branch room's floor hook down through the main room's ceiling hook to the ground
  for (const b of branches) {
    const hx = b.hookX;
    for (let y = top - 1; y < H; y++) {
      // a main room lower than the band has rock above its ceiling: the ladder goes through it down to the ceiling hook (b.main.y)
      if (y > Math.max(top, b.main.y) && (tiles[y][hx] === '#' || tiles[y][hx] === '=' || tiles[y][hx] === 'H')) break;
      tiles[y][hx] = 'H';
    }
  }
  for (const row of tiles) for (let x = 0; x < W; x++) if (row[x] === 'A') row[x] = '#';   // unused hooks
  // shortcut tunnel: under all rooms from v (exit) to ^ (entrance)
  let ends = null;
  if (shortcut) {
    const ux = placedMain[0].x + up[0], dx = placedMain.at(-1).x + down[0], t0 = top + MH;
    for (let y = t0; y < t0 + TUNNEL_HEIGHT; y++) for (let x = Math.min(ux, dx) - 1; x <= Math.max(ux, dx) + 1; x++) tiles[y][x] = '.';
    for (const [cx, mark] of [[ux, '^'], [dx, 'v']]) {
      let y = floorY; while (y > top && tiles[y][cx] !== mark) y--;   // the marker sits in the room's floor (rooms may be lower than the band)
      for (let yy = y; yy < t0 + TUNNEL_HEIGHT; yy++) tiles[yy][cx] = 'H';
      (ends ??= {})[mark === '^' ? 'up' : 'down'] = [cx, y];
    }
    ends.floor = t0 + TUNNEL_HEIGHT;
  }
  const cycles = weldBand({ graph, tiles, placedMain, branches, ends, floorY, top, enemyKit, seed });
  // #163 fair fights: no spawn at a seam (between main rooms, at a side room's ladder), shooters only with sight of the way in
  {
    const gates = [...placedMain.slice(1).map(b => [b.x, floorY - 1]), ...placedMain.slice(0, -1).map(a => [a.x + a.w - 1, floorY - 1]), ...branches.map(b => [b.hookX, top - 1])];
    const Lx = (() => { for (let y = 0; y < H; y++) { const x = tiles[y].indexOf('L'); if (x >= 0) return [x, y]; } return null; })();
    const entries = [...placedMain.map((m, i) => ({ x: m.x, y: m.y, w: m.w, h: m.h, at: i ? [m.x, floorY - 1] : Lx })), ...branches.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, at: [b.hookX, top - 2] }))];
    fairFights({ D, tiles, gates, entries, spawns: enemyKit.spawns, letterOf: enemyKit.letterOf, melee: enemyKit.melee, cfg: LD, rnd });
  }
  const layout = tiles.map(r => r.join(''));
  const S = R[start];
  const def = { name: P.name || poiId, size: [W, H], layout, spawns: enemyKit.spawns, tags: ['poi'], backdrop: S.backdrop };
  const rooms = [...placedMain, ...branches].map(({ id, band, x, y, w, h, intensity, rest, wow }) => ({ id, band, x, y, w, h, intensity: Math.round((intensity ?? 1) * 100), ...(rest ? { rest: true } : {}), ...(wow ? { wow: true } : {}) }));
  return { def, rooms, shortcut: ends, branches: branches.length, problems, start, exit, graph, cycles };
}

// enemy symbols: every enemy gets one global letter, rooms keep their own tables
// Spannungskurve (#016, Daniel 14.11.2026: Flow): the main path follows a curve of intensity (POIs › Level › Spannungskurve, %
// from entrance to exit). A random enemy (1) stays with that chance; quiet rooms draw from the weaker half of the POI's enemies,
// loud rooms (from 85 %) from the tougher half. Bosses never come from 1, only from their room's table. Side rooms: half as loud.
function makeEnemies(D, P, R, rnd) {
  const letters = 'abcdefghijklmnpqrstuwxyzEFGIJKMNOPQRTUVWXY'.split(''), sym = {}, spawns = [];
  const letterOf = enemy => {
    if (!sym[enemy]) { sym[enemy] = letters.shift() || '.'; if (sym[enemy] !== '.') spawns.push({ symbol: sym[enemy], enemy }); }
    return sym[enemy];
  };
  const byHealth = (P.enemies || []).filter(e => D.enemies?.[e] && D.enemies[e].behavior !== 'boss').sort((a, b) => (D.enemies[a].health ?? 30) - (D.enemies[b].health ?? 30));
  const curve = parseCurve(P.curve);
  const pickEnemy = k => {
    if (!byHealth.length) return null;
    const half = Math.max(1, Math.ceil(byHealth.length / 2));
    const pool = !curve ? byHealth : k < 0.5 ? byHealth.slice(0, half) : k >= 0.85 ? byHealth.slice(byHealth.length - half) : byHealth;
    return pool[Math.floor(rnd() * pool.length)];
  };
  const melee = byHealth.filter(e => D.enemies[e].behavior !== 'shooter' && D.enemies[e].behavior !== 'flyer');
  return { D, rnd, spawns, letterOf, pickEnemy, curve, melee };
}
// one room into the level's tiles at (place.x, y0): L only in the entrance, Z only in the exit, ^ v only where keep says, 1 by the curve
// #163 an Atempause has no enemies (and a chest), the Wow room keeps its first part calm (from the way in: left, the bottom of a tower,
// the top of a deep POI)
function stampRoom({ R, parsed, tiles, start, exit, enemyKit: K, keep }, place, y0) {
  const r = place.p || parsed[place.id], table = Object.fromEntries((R[place.id].spawns || []).map(s => [s.symbol, s.enemy]));
  const calm = (K.LD?.wowCalm ?? 45) / 100, st = K.stack;
  const quiet = (x, y) => place.rest || (place.wow && (st === 'tower' ? y > r.h * (1 - calm) : st === 'deep' ? y < r.h * calm : x < r.w * calm));
  place.y = y0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    let c = r.tiles[y][x];
    if ((c === '1' || table[c]) && quiet(x, y) && K.D.enemies?.[table[c]]?.behavior !== 'boss') c = '.';
    if (c === 'L' && place.id !== start) c = '.';
    else if (c === '^' && !keep['^']) c = '#';
    else if (c === 'v' && !keep.v) c = '#';
    else if (c === 'Z' && place.id !== exit) c = '.';
    else if (c === '1') { const k = place.intensity ?? 1, e = K.rnd() < k ? K.pickEnemy(k) : null; c = e ? K.letterOf(e) : '.'; }
    else if (table[c]) c = K.D.enemies?.[table[c]] ? K.letterOf(table[c]) : '.';
    tiles[y0 + y][place.x + x] = c;
  }
  if (place.rest && !r.marks.C.length) { const p = restChestSpot(r); if (p) tiles[y0 + p[1]][place.x + p[0]] = 'C'; }
  // #168 Gefahr und Belohnung: a loud side room with an extra chest and two more of the POI's tougher enemies
  if (place.danger) {
    const p = restChestSpot({ ...r, tiles: r.tiles.map((row, y) => row.map((c, x) => tiles[y0 + y][place.x + x] === '.' ? c : '#')) });
    if (p) tiles[y0 + p[1]][place.x + p[0]] = 'C';
    const spots = standSpots(tiles, { x: place.x, y: y0, w: r.w, h: r.h }).filter(([x]) => Math.abs(x - (place.hookX ?? -99)) > 3);
    for (let i = 0; i < 2 && spots.length; i++) { const e = K.pickEnemy(1); if (!e) break; const [x, y] = spots.splice(Math.floor(K.rnd() * spots.length), 1)[0]; tiles[y][x] = K.letterOf(e); }
  }
}

// stacked POIs (tower / deep), see the top of this file
function buildStack({ D, P, poiId, R, rnd, parsed, ready, main, start, exit, stack, hook, enemyKit, problems, intens, flags, graph }) {
  const curve = enemyKit.curve;
  // rooms may be mirrored (a mirrored room is just as valid): every lower room takes the side that keeps the stack close above its
  // first room, so towers stay upright and mines do not wander off diagonally; when both are about as good, chance decides
  const mirrored = {};
  const look = (id, flip) => !flip ? parsed[id] : (mirrored[id] ??= parseRoom({ ...R[id], layout: parsed[id].tiles.map(r => [...r].reverse().join('')) }));
  const hooksOf = (p, y) => p.marks.A.filter(([, hy]) => hy === (y === 'floor' ? p.h - 1 : 0)).map(([hx]) => hx);
  const placed = main.map((id, i) => ({ id, band: 'main', w: parsed[id].w, h: parsed[id].h, intensity: intens[i], ...flags(id) }));
  const order = stack === 'tower' ? [...placed].reverse() : placed;   // top to bottom
  // x: every lower room hangs under the upper one so that the upper floor hook sits over the lower ceiling hook; y: one under the other
  const joints = [];
  order[0].flip = rnd() < 0.5; order[0].p = look(order[0].id, order[0].flip); order[0].x = 0; order[0].y = 0;
  const middle = order[0].w / 2;
  // #173 POIs › Schacht-Motiv › Räume am Schacht ausrichten: every room hangs as close as its hooks allow centred under the first room,
  // so a column through the middle (the rocket of Silo Zero) runs through all of them. The dice roll exactly as before.
  const align = shaftConfig(P)?.align;
  for (let i = 1; i < order.length; i++) {
    const up = order[i - 1], lo = order[i], fh = hooksOf(up.p, 'floor');
    let fx = fh[Math.floor(rnd() * fh.length)];
    const options = [false, true].map(flip => {
      const p = look(lo.id, flip), ch = hooksOf(p, 'ceil'), cx = ch[Math.floor(rnd() * ch.length)], x = up.x + fx - cx;
      return { flip, p, x, off: Math.abs(x + p.w / 2 - middle) };
    }).sort((a, b) => a.off - b.off);
    let o = options[1].off - options[0].off < 6 && rnd() < 0.5 ? options[1] : options[0];
    if (align) {
      const all = [];
      for (const f of fh) for (const flip of [false, true]) { const p = look(lo.id, flip); for (const c of hooksOf(p, 'ceil')) { const x = up.x + f - c; all.push({ flip, p, x, fx: f, off: Math.abs(x + p.w / 2 - middle) }); } }
      const best = all.sort((a, b) => a.off - b.off)[0];
      if (best) { o = best; fx = best.fx; }
    }
    Object.assign(lo, { flip: o.flip, p: o.p, x: o.x, y: up.y + up.h });
    joints.push({ x: up.x + fx, y: up.y + up.h - 1 });
  }
  // side rooms: next to a main room (not the bottom one: the shaft's door is there), floor on the same row, through the open seams
  const side = rnd() < 0.5 ? -1 : 1;   // the shaft's side; side rooms go to the other one
  const pool = ready.filter(id => tagged(R, id, 'loot', 'secret') && seamOpen(parsed[id], side));
  const chance = (P.branchChance ?? 60) / 100, branches = [], hosts = hostSlots(graph);
  const free = (x, y, w, h) => y >= 0 && ![...order, ...branches].some(o => x < o.x + o.w && o.x < x + w && y < o.y + o.h && o.y < y + h);   // y < 0: taller than the top room
  for (const m of order.slice(0, -1)) {
    const slot = placed.indexOf(m), force = hosts.has(slot);   // #168 a key or a reward wants a side room here
    if (!pool.length || (rnd() >= chance && !force) || !seamOpen(m.p, -side)) continue;
    const id = pick(pool, rnd, R), b = parsed[id], x = side > 0 ? m.x - b.w : m.x + m.w, y = m.y + m.h - b.h;
    if (!free(x, y, b.w, b.h)) continue;
    const danger = hosts.get(slot) === 'danger';
    branches.push({ id, band: 'branch', x, y, w: b.w, h: b.h, main: m, intensity: danger ? 1 : curve ? m.intensity * 0.5 : 1, ...(danger ? { danger: true } : {}) });
  }
  // the shaft: 3 wide, 2 tiles away from everything on its side, from the top room's floor down to the bottom room's floor
  const top = order[0], bot = order.at(-1), shortcut = P.shortcut !== false;
  if (shortcut && !seamOpen(top.p, side)) problems.push(`${top.id}: keine offene Seite zum Schacht`);
  if (shortcut && !seamOpen(bot.p, side)) problems.push(`${bot.id}: keine offene Seite zum Schacht`);
  const all = [...order, ...branches];
  let x0 = Math.min(...all.map(o => o.x)), x1 = Math.max(...all.map(o => o.x + o.w));   // x1 exclusive
  const SW = 3, GAP = 2;
  let s0 = null;
  if (shortcut) { if (side > 0) { s0 = x1 + GAP; x1 = s0 + SW; } else { s0 = x0 - GAP - SW; x0 = s0; } }
  const shift = 1 - x0;
  for (const o of all) o.x += shift;
  for (const j of joints) j.x += shift;
  if (s0 != null) s0 += shift;
  const W = x1 - x0 + 2, H = Math.max(...all.map(o => o.y + o.h)) + 1;
  // a little sky above a tower, the earth's surface above a deep POI: one row of rock is enough, the rooms carry their own ceilings
  const tiles = Array.from({ length: H }, () => new Array(W).fill('#'));
  const ctx = { R, parsed, tiles, start, exit, enemyKit, keep: {} };
  for (const o of all) stampRoom(ctx, o, o.y);
  let seenL = false;
  for (const row of tiles) for (let x = 0; x < W; x++) if (row[x] === 'L') { if (seenL) row[x] = '.'; seenL = true; }
  // ladders: from the upper room's floor hook through the lower ceiling down to the floor (or a platform)
  for (const j of joints) {
    tiles[j.y][j.x] = 'H'; tiles[j.y + 1][j.x] = 'H';
    for (let y = j.y + 2; y < H - 1 && !'#=H'.includes(tiles[y][j.x]); y++) tiles[y][j.x] = 'H';
  }
  for (const row of tiles) for (let x = 0; x < W; x++) if (row[x] === 'A' || row[x] === '^' || row[x] === 'v') row[x] = '#';   // unused hooks
  let ends = null;
  if (s0 != null) {
    const floorOf = o => o.y + o.h - 1, ft = floorOf(top), fb = floorOf(bot);
    const sx = side > 0 ? s0 : s0 + SW - 1, ladderX = side > 0 ? s0 + SW - 1 : s0;   // walk in on the near column, ladder on the far one
    for (let y = ft - 3; y < fb; y++) for (let x = s0; x < s0 + SW; x++) tiles[y][x] = '.';
    for (let y = ft; y < fb; y++) tiles[y][ladderX] = 'H';
    // corridors from the rooms' open seams to the shaft (3 high, just above the floor)
    const corridor = (o, f) => { const a = side > 0 ? o.x + o.w : s0 + SW, b = side > 0 ? s0 : o.x; for (let y = f - 3; y < f; y++) for (let x = a; x < b; x++) tiles[y][x] = '.'; return side > 0 ? a : b - 1; };
    const topX = corridor(top, ft);
    const dx = corridor(bot, fb);
    for (let y = fb - 3; y < fb; y++) tiles[y][dx] = 'D';
    // the switch on the far side of the door: in the shaft for a tower (you come down from the top), in the exit room for a deep POI
    const swX = stack === 'tower' ? sx : (side > 0 ? bot.x + bot.w - 3 : bot.x + 2);
    if (stack === 'tower') tiles[fb - 1][swX] = 'S';
    else if (tiles[fb - 1][swX] === '.') tiles[fb - 1][swX] = 'S';
    else problems.push(`${bot.id}: kein Platz für den Schalter am Schacht`);
    // up = the entrance's end of the shortcut, down = the exit's end (as with the tunnel)
    ends = { up: [ladderX, stack === 'tower' ? fb : ft], down: [ladderX, stack === 'tower' ? ft : fb], floor: fb, door: [dx, fb - 1], shaft: [s0, ft - 3, SW, fb - ft + 3], kind: 'shaft',
      sw: tiles[fb - 1][swX] === 'S' ? [swX, fb - 1] : null, topX, ladderX, walkX: sx, ft };
  }
  const cycles = weldStack({ graph, tiles, placed, branches, joints, stack, ends, enemyKit, seed: graph.seed });
  // #163 fair fights: gates are the ladders through the hooks (both sides) and the seams of the side rooms
  {
    const foot = j => { let y = j.y + 1; while (tiles[y + 1]?.[j.x] === 'H' || (tiles[j.y][j.x] === '.' && tiles[y + 1]?.[j.x] === '.')) y++; return [j.x, y]; };   // where the ladder (or the drop, #168) through a hook ends below
    const gates = [...joints.flatMap(j => [[j.x, j.y - 1], [j.x, j.y + 2], foot(j)]), ...branches.map(b => [side > 0 ? b.x + b.w - 1 : b.x, b.y + b.h - 2])];
    const Lx = (() => { for (let y = 0; y < H; y++) { const x = tiles[y].indexOf('L'); if (x >= 0) return [x, y]; } return null; })();
    // the way in of a main room: the entrance at L; a tower comes in through the floor (joint below), a deep POI through the ceiling
    const entries = [...placed.map((m, i) => {
      if (!i) return { x: m.x, y: m.y, w: m.w, h: m.h, at: Lx };
      const oi = order.indexOf(m), j = stack === 'tower' ? joints[oi] : joints[oi - 1];
      return { x: m.x, y: m.y, w: m.w, h: m.h, at: j ? (stack === 'tower' ? [j.x, j.y - 1] : foot(j)) : null };
    }), ...branches.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, at: [side > 0 ? b.x + b.w - 1 : b.x, b.y + b.h - 2] }))];
    fairFights({ D, tiles, gates, entries, spawns: enemyKit.spawns, letterOf: enemyKit.letterOf, melee: enemyKit.melee, cfg: enemyKit.LD, rnd });
  }
  const def = { name: P.name || poiId, size: [W, H], layout: tiles.map(r => r.join('')), spawns: enemyKit.spawns, tags: ['poi'], backdrop: R[start].backdrop || all.map(o => R[o.id].backdrop).find(Boolean) };
  const rooms = [...placed, ...branches].map(({ id, band, x, y, w, h, intensity, flip, rest, wow }) => ({ id, band, x, y, w, h, intensity: Math.round((intensity ?? 1) * 100), ...(flip ? { flip: true } : {}), ...(rest ? { rest: true } : {}), ...(wow ? { wow: true } : {}) }));   // entrance first, like the band
  return { def, rooms, shortcut: ends, branches: branches.length, problems, start, exit, stack, graph, cycles };
}
// ---------- #168 the cycle graph in the welded level (engine/cycles.js plans it) ----------
// slots that want a side room: Map slot → 'key' | 'danger'
function hostSlots(graph) {
  const m = new Map();
  for (const c of graph?.circles || []) if (c.host != null) m.set(c.host, c.recipe === 'lockKey' ? 'key' : 'danger');
  return m;
}
// placeholders resolved late: a host slot needs a room a side room can hang from (band: a ceiling hook A). Swap in a fitting room
// from the pool, else move the host to another room of the circle. Then every slot learns its room.
function resolveSlots({ graph, main, R, parsed, middlePool, stack, wowId, seed }) {
  const rr = rng(Math.imul(seed | 0, 40503) + 168), canHost = id => !!stack || parsed[id].marks.A.some(([, y]) => y === 0);
  for (const c of graph.circles) {
    if (c.host == null || canHost(main[c.host])) continue;
    const s = c.host, last = c.recipe === 'lockKey' ? c.to - 1 : c.to;
    const pool = middlePool.filter(id => canHost(id) && roomType(R[id]) !== 'rest' && id !== main[s - 1] && id !== main[s + 1]);
    if (s > 0 && s < main.length - 1 && main[s] !== wowId && roomType(R[main[s]]) !== 'rest' && pool.length) { main[s] = pick(pool, rr, R); graph.slots[s].resolved = 'getauscht'; continue; }
    const other = [...Array(last - c.from + 1).keys()].map(k => c.from + k).find(k => canHost(main[k]));
    if (other == null) continue;
    delete graph.slots[s].needs.keyHost; delete graph.slots[s].needs.dangerHost;
    c.host = other; graph.slots[other].needs[c.recipe === 'lockKey' ? 'keyHost' : 'dangerHost'] = true;
    for (const e of graph.extras) if (e.circle === c.i) e.host = c.host;
    for (const e of graph.edges) if (e.circle === c.i && (e.kind === 'detour' || e.kind === 'danger') && typeof e.from === 'number') e.from = c.host;
  }
  main.forEach((id, s) => { if (graph.slots[s]) graph.slots[s].room = id; });
}
const cyclesOut = () => ({ locks: [], keys: [], links: [], oneWays: [], collapses: [], notes: [] });
// #170 Rückweg verändert · eingestürzter Gang: the passage into slot c.collapse stays open in the layout and caves in during the run
// (game/play/poi_level.js) when Leyla first stands in the goal room → { circle, tiles, trigger: { x, y, w, h } }
// no place for it: the plain variant (the door from the other side) stays, the plan says so
function placeCollapse(out, c, col, goal, graph) {
  if (col?.length) { out.collapses.push({ circle: c.i, tiles: col, trigger: { x: goal.x, y: goal.y, w: goal.w, h: goal.h } }); return; }
  const e = graph.edges.find(e => e.kind === 'collapse'); if (e) e.kind = 'path';
  c.name = c.name.replace(' · eingestürzter Gang', ''); delete c.collapse;
}
// the key of a lock circle, from its side rooms or the main rooms before the lock; no place → the lock goes again (noted)
function placeKey(out, c, tiles, regions, rnd) {
  const lock = out.locks.find(l => l.circle === c.i);
  if (!lock) return;
  const p = keySpot(tiles, out.locks, c.i, regions, rnd);
  if (!p) {
    for (const [x, y] of lock.tiles) tiles[y][x] = lock.hatch ? 'H' : '.';
    out.locks.splice(out.locks.indexOf(lock), 1); c.fallback = 'kein Platz für den Schlüssel: Schloss entfällt'; out.notes.push(`Kreis ${c.i + 1}: ${c.fallback}`);
    return;
  }
  tiles[p[1]][p[0]] = '+';
  out.keys.push({ circle: c.i, x: p[0], y: p[1], name: c.key.name, kind: c.key.kind, lock: c.key.lockName });
  lock.keyAt = p;
}
// where the key of circle c may lie: side rooms of its rooms before the lock (the host's first), then those rooms (host first)
function regionsOf(c, mains, branches) {
  const last = c.lockSlot != null ? c.lockSlot - 1 : c.to, slot = m => mains.indexOf(m), inside = m => slot(m) >= c.from && slot(m) <= last;
  const side = branches.filter(b => inside(b.main)).sort((a, b) => (slot(b.main) === c.host) - (slot(a.main) === c.host)).map(b => ({ ...b, branch: true }));
  const rooms = mains.filter(inside).sort((a, b) => (slot(b) === c.host) - (slot(a) === c.host) || slot(b) - slot(a));
  return [...side, ...rooms];
}
// one of the tougher half of the POI's enemies at a spot (Gefahr und Belohnung on the way back)
const foe = (K, tiles, x, y) => { const e = K.pickEnemy(1); if (e && tiles[y][x] === '.') tiles[y][x] = K.letterOf(e); };

// side by side: locks across seams, the tunnel shaped by the outer circle's recipe
function weldBand({ graph, tiles, placedMain, branches, ends, floorY, enemyKit: K, seed }) {
  const out = cyclesOut(), rnd = rng(Math.imul(seed | 0, 69069) + 1680);
  for (const c of graph.circles) {
    if (c.recipe !== 'lockKey') continue;
    const col = seamLock(tiles, placedMain[c.lockSlot], floorY);
    if (!col) { c.fallback = 'keine freie Naht für das Schloss'; out.notes.push(`Kreis ${c.i + 1}: ${c.fallback}`); continue; }
    for (const [x, y] of col) tiles[y][x] = '|';
    out.locks.push({ circle: c.i, tiles: col, kind: c.key.lock, name: c.key.lockName, key: c.key.name, keyKind: c.key.kind, hatch: false });
  }
  const outer = graph.circles.at(-1);
  if (ends && outer) {
    const [ux] = ends.up, [dx, dy] = ends.down, F = ends.floor, t0 = F - TUNNEL_HEIGHT, r = outer.recipe;
    if (r === 'lockKey' || r === 'changedReturn' || r === 'hiddenShortcut') {
      // the door just past the entrance's ladder: Leyla sees it before she finds the switch from the other side
      if (dx - ux > 6) {
        for (let y = t0; y < F; y++) tiles[y][ux + 2] = 'D';
        tiles[F - 1][ux + 4] = 'S';
        out.links.push({ switch: [ux + 4, F - 1], door: [ux + 2, F - 1] });
        ends.door = [ux + 2, F - 1];
      }
      if (r === 'hiddenShortcut') { tiles[dy][dx] = '%'; ends.hidden = [dx, dy]; }   // a fake floor over the ladder: a trapdoor
    } else if (r === 'oneWayDown') {
      tiles[dy][dx] = '=';
      for (let y = dy + 1; y < F; y++) tiles[y][dx] = '.';
      out.oneWays.push({ circle: outer.i, from: [dx, dy - 1], land: [dx, F - 1] });
      ends.oneWay = true;
    } else if (r === 'dangerReward') {
      const mid = Math.round((ux + dx) / 2);
      tiles[F - 1][mid] = 'C';
      for (const x of [Math.round(ux + (dx - ux) / 3), Math.round(ux + (dx - ux) * 2 / 3)]) if (Math.abs(x - mid) > 2) foe(K, tiles, x, F - 1);
      ends.danger = [mid, F - 1];
    }
  }
  if (outer?.collapse != null) {   // the column of the seam into the collapsing room, top to floor (like a lock, but open until then)
    placeCollapse(out, outer, seamLock(tiles, placedMain[outer.collapse], floorY), placedMain.at(-1), graph);
  }
  for (const c of graph.circles) if (c.recipe === 'lockKey') placeKey(out, c, tiles, regionsOf(c, placedMain, branches), rnd);
  return out;
}

// stacked: locks are hatches in the joint ladders, a cut joint is a drop, the shaft is shaped by the outer circle's recipe
function weldStack({ graph, tiles, placed, branches, joints, stack, ends, enemyKit: K, seed }) {
  const out = cyclesOut(), rnd = rng(Math.imul(seed | 0, 69069) + 1681), n = placed.length;
  const joint = s => joints[stack === 'tower' ? n - 2 - s : s];   // the joint between slot s and s + 1
  for (const c of graph.circles) {
    if (c.recipe === 'lockKey') {
      const j = joint(c.lockSlot - 1);
      if (!j || tiles[j.y][j.x] !== 'H') { c.fallback = 'keine Leiter für die Luke'; out.notes.push(`Kreis ${c.i + 1}: ${c.fallback}`); continue; }
      tiles[j.y][j.x] = '|';
      out.locks.push({ circle: c.i, tiles: [[j.x, j.y]], kind: c.key.lock, name: c.key.lockName, key: c.key.name, keyKind: c.key.kind, hatch: true, up: stack === 'tower' });
    } else if (c.recipe === 'oneWayDown' && stack === 'deep' && c.drop != null) {
      const j = joint(c.drop - 1);
      if (!j) continue;
      const cut = [];
      let y = j.y; while (tiles[y][j.x] === 'H') { cut.push([j.x, y]); tiles[y++][j.x] = '.'; }
      y--; while (tiles[y + 1]?.[j.x] === '.') y++;
      // #175 (Daniel: „Aus dem Hochhaus kommt man nicht wieder raus …“): the cut ladder hangs folded up at the top of the hole; at the
      // landing Leyla lets it down (E), then the way back up is open (Bibel: a way back opens from the inside and closes a circle)
      out.oneWays.push({ circle: c.i, from: [j.x, j.y - 1], land: [j.x, y], ladder: cut });
    }
  }
  const outer = graph.circles.at(-1);
  if (ends && outer) {
    const r = outer.recipe, { ft, floor: fb, ladderX, walkX, topX } = ends;
    if (r === 'hiddenShortcut') { for (let y = ft - 3; y < ft; y++) tiles[y][topX] = '$'; ends.hidden = [topX, ft - 1]; }
    else if (r === 'oneWayDown' && stack === 'tower') {
      for (let y = ft; y < fb; y++) if (tiles[y][ladderX] === 'H') tiles[y][ladderX] = '.';
      out.oneWays.push({ circle: outer.i, from: [walkX, ft - 1], land: [ladderX, fb - 1] });
      ends.oneWay = true;
    } else if (r === 'doublePath' || r === 'dangerReward') {
      const [dx] = ends.door;
      for (let y = fb - 3; y < fb; y++) if (tiles[y][dx] === 'D') tiles[y][dx] = '.';
      if (ends.sw) tiles[ends.sw[1]][ends.sw[0]] = '.';
      ends.door = null; ends.sw = null; ends.open = true;
      if (r === 'dangerReward') {
        if (tiles[fb - 1][walkX] === '.') tiles[fb - 1][walkX] = 'C';
        const cx = Math.round((walkX + dx) / 2);
        if (Math.abs(cx - walkX) > 1) foe(K, tiles, cx, fb - 1);
        ends.danger = [walkX, fb - 1];
      }
    }
  }
  if (outer?.collapse != null) {   // the joint ladder into the collapsing room: rubble fills the hole in the floor
    const j = joint(outer.collapse - 1);
    placeCollapse(out, outer, j && tiles[j.y][j.x] === 'H' ? [[j.x, j.y]] : null, placed[n - 1], graph);
  }
  for (const c of graph.circles) if (c.recipe === 'lockKey') placeKey(out, c, tiles, regionsOf(c, placed, branches), rnd);
  return out;
}

// is the seam (the three rows above the floor) open on that side (-1 left, 1 right)?
function seamOpen(r, side) {
  const x = side > 0 ? r.w - 1 : 0;
  return [r.h - 4, r.h - 3, r.h - 2].every(y => r.tiles[y][x] !== '#');
}

// ranking (area Ranking): time, kills %, secrets → { points, grade, bonus, parts }
export function rankRun(rank = {}, { seconds, par, kills, killsMax, secrets, secretsMax }) {
  const pts = rank.points || {}, fall = rank.timeFalloff ?? 5;
  const over = Math.max(0, seconds - (par || 0));
  const time = Math.max(0, (pts.time || 0) * (1 - fall / 100 * over / 10));
  const k = killsMax ? (pts.kills || 0) * Math.min(1, kills / killsMax) : pts.kills || 0;
  const s = secretsMax ? (pts.secrets || 0) * Math.min(1, secrets / secretsMax) : pts.secrets || 0;
  const points = Math.round(time + k + s);
  const g = [...(rank.grades || [])].reverse().find(x => points >= (x.minPoints ?? 0)) || { grade: 'F', bonus: 0 };
  return { points, grade: g.grade, bonus: g.bonus || 0, parts: { time: Math.round(time), kills: Math.round(k), secrets: Math.round(s) } };
}
// #141 the rank's Δ bonus on the run money: deltas × (1 + bonus %), rounded → { paid, extra }
export function rankBonus(deltas, bonus = 0) {
  const paid = Math.round((deltas || 0) * (1 + (bonus || 0) / 100));
  return { paid, extra: paid - Math.round(deltas || 0) };
}
// #141 the bonus crate at the exit: from Ranking › Bonus-Kiste „ab Rang“ on, the grade's rolls and „Wählerisch“ → { grade, rolls, pick, loot } | null
export function rankCrate(rank = {}, grade) {
  const G = rank.grades || [], C = rank.bonusCrate || {}, at = G.findIndex(g => g.grade === grade), from = G.findIndex(g => g.grade === C.minGrade);
  if (C.enabled === false || at < 0 || from < 0 || at < from) return null;
  const g = G[at], rolls = Math.max(0, Math.round(g.crateRolls ?? 0));
  return rolls ? { grade, rolls, pick: Math.max(1, Math.round(g.cratePick ?? 1)), loot: C.loot || null } : null;
}

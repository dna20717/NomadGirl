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

export function buildPoi(D, poiId, seed = 1) {
  const P = D.pois?.[poiId] || {}, R = D.rooms || {}, rnd = rng(seed), problems = [];
  const all = (P.rooms || []).filter(id => R[id]?.layout?.length);
  const parsed = Object.fromEntries(all.map(id => [id, parseRoom(R[id])]));
  // stacked: a room needs the hooks its place in the stack joins with (tower: entrance ceiling, exit floor; deep: the other way round)
  const stack = P.stack === 'tower' || P.stack === 'deep' ? P.stack : null;
  const hook = (id, y) => parsed[id].marks.A.filter(([, hy]) => hy === (y === 'floor' ? parsed[id].h - 1 : 0));
  const needs = (id, ...ys) => ys.every(y => hook(id, y).length);
  const ready = all;
  const start = pick(ready.filter(id => tagged(R, id, 'start') && (!stack || needs(id, stack === 'tower' ? 'ceil' : 'floor'))), rnd, R);
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
  main.push(exit);
  const enemyKit = makeEnemies(D, P, R, rnd);
  if (stack) return buildStack({ D, P, poiId, R, rnd, parsed, ready, main, start, exit, stack, hook, enemyKit, problems });

  // branches: side rooms with a floor hook A over main rooms with a ceiling hook A
  const branchPool = ready.filter(id => tagged(R, id, 'loot', 'secret') && parsed[id].marks.A.some(([, y]) => y === parsed[id].h - 1));
  const chance = (P.branchChance ?? 60) / 100;
  const MH = Math.max(...main.map(id => parsed[id].h));
  const W = main.reduce((s, id) => s + parsed[id].w, 0) + 2;
  const placedMain = [];
  let x = 1;
  for (const id of main) { placedMain.push({ id, band: 'main', x, w: parsed[id].w, h: parsed[id].h }); x += parsed[id].w; }
  const branches = [];
  for (const m of placedMain) {
    const hooks = parsed[m.id].marks.A.filter(([, y]) => y === 0);
    for (const [hx] of hooks) {
      if (!branchPool.length || rnd() >= chance) continue;
      const id = pick(branchPool, rnd, R), b = parsed[id], [bx] = b.marks.A.find(([, y]) => y === b.h - 1);
      const left = m.x + hx - bx;
      if (left < 1 || left + b.w > W - 1 || branches.some(o => left < o.x + o.w + 1 && o.x < left + b.w + 1)) continue;
      branches.push({ id, band: 'branch', x: left, w: b.w, h: b.h, hookX: m.x + hx, main: m });
    }
  }
  const BH = branches.length ? Math.max(...branches.map(b => b.h)) : 0;
  const pS = parsed[start], pE = parsed[exit];
  const up = pS.marks['^'].find(([, y]) => y === pS.h - 1), down = pE.marks.v.find(([, y]) => y === pE.h - 1);
  const shortcut = P.shortcut !== false && !!up && !!down;
  if (P.shortcut !== false && !up) problems.push(`Eingang ${start}: keine Abkürzung (^) im Boden`);
  if (P.shortcut !== false && !down) problems.push(`Ausgang ${exit}: keine Abkürzung (v) im Boden`);
  const top = BH, H = BH + MH + (shortcut ? TUNNEL_HEIGHT + 1 : 0);
  const tiles = Array.from({ length: H }, () => new Array(W).fill('#'));

  const curve = enemyKit.curve;
  placedMain.forEach((m, i) => { m.intensity = curve ? curveAt(curve, placedMain.length > 1 ? i / (placedMain.length - 1) : 1) : 1; });
  for (const b of branches) b.intensity = curve ? (b.main.intensity ?? 1) * 0.5 : 1;
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
  const layout = tiles.map(r => r.join(''));
  const S = R[start];
  const def = { name: P.name || poiId, size: [W, H], layout, spawns: enemyKit.spawns, tags: ['poi'], backdrop: S.backdrop };
  const rooms = [...placedMain, ...branches].map(({ id, band, x, y, w, h, intensity }) => ({ id, band, x, y, w, h, intensity: Math.round((intensity ?? 1) * 100) }));
  return { def, rooms, shortcut: ends, branches: branches.length, problems, start, exit };
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
  return { D, rnd, spawns, letterOf, pickEnemy, curve };
}
// one room into the level's tiles at (place.x, y0): L only in the entrance, Z only in the exit, ^ v only where keep says, 1 by the curve
function stampRoom({ R, parsed, tiles, start, exit, enemyKit: K, keep }, place, y0) {
  const r = place.p || parsed[place.id], table = Object.fromEntries((R[place.id].spawns || []).map(s => [s.symbol, s.enemy]));
  place.y = y0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    let c = r.tiles[y][x];
    if (c === 'L' && place.id !== start) c = '.';
    else if (c === '^' && !keep['^']) c = '#';
    else if (c === 'v' && !keep.v) c = '#';
    else if (c === 'Z' && place.id !== exit) c = '.';
    else if (c === '1') { const k = place.intensity ?? 1, e = K.rnd() < k ? K.pickEnemy(k) : null; c = e ? K.letterOf(e) : '.'; }
    else if (table[c]) c = K.D.enemies?.[table[c]] ? K.letterOf(table[c]) : '.';
    tiles[y0 + y][place.x + x] = c;
  }
}

// stacked POIs (tower / deep), see the top of this file
function buildStack({ D, P, poiId, R, rnd, parsed, ready, main, start, exit, stack, hook, enemyKit, problems }) {
  const curve = enemyKit.curve;
  // rooms may be mirrored (a mirrored room is just as valid): every lower room takes the side that keeps the stack close above its
  // first room, so towers stay upright and mines do not wander off diagonally; when both are about as good, chance decides
  const mirrored = {};
  const look = (id, flip) => !flip ? parsed[id] : (mirrored[id] ??= parseRoom({ ...R[id], layout: parsed[id].tiles.map(r => [...r].reverse().join('')) }));
  const hooksOf = (p, y) => p.marks.A.filter(([, hy]) => hy === (y === 'floor' ? p.h - 1 : 0)).map(([hx]) => hx);
  const placed = main.map((id, i) => ({ id, band: 'main', w: parsed[id].w, h: parsed[id].h, intensity: curve ? curveAt(curve, main.length > 1 ? i / (main.length - 1) : 1) : 1 }));
  const order = stack === 'tower' ? [...placed].reverse() : placed;   // top to bottom
  // x: every lower room hangs under the upper one so that the upper floor hook sits over the lower ceiling hook; y: one under the other
  const joints = [];
  order[0].flip = rnd() < 0.5; order[0].p = look(order[0].id, order[0].flip); order[0].x = 0; order[0].y = 0;
  const middle = order[0].w / 2;
  for (let i = 1; i < order.length; i++) {
    const up = order[i - 1], lo = order[i], fh = hooksOf(up.p, 'floor'), fx = fh[Math.floor(rnd() * fh.length)];
    const options = [false, true].map(flip => {
      const p = look(lo.id, flip), ch = hooksOf(p, 'ceil'), cx = ch[Math.floor(rnd() * ch.length)], x = up.x + fx - cx;
      return { flip, p, x, off: Math.abs(x + p.w / 2 - middle) };
    }).sort((a, b) => a.off - b.off);
    const o = options[1].off - options[0].off < 6 && rnd() < 0.5 ? options[1] : options[0];
    Object.assign(lo, { flip: o.flip, p: o.p, x: o.x, y: up.y + up.h });
    joints.push({ x: up.x + fx, y: up.y + up.h - 1 });
  }
  // side rooms: next to a main room (not the bottom one: the shaft's door is there), floor on the same row, through the open seams
  const side = rnd() < 0.5 ? -1 : 1;   // the shaft's side; side rooms go to the other one
  const pool = ready.filter(id => tagged(R, id, 'loot', 'secret') && seamOpen(parsed[id], side));
  const chance = (P.branchChance ?? 60) / 100, branches = [];
  const free = (x, y, w, h) => y >= 0 && ![...order, ...branches].some(o => x < o.x + o.w && o.x < x + w && y < o.y + o.h && o.y < y + h);   // y < 0: taller than the top room
  for (const m of order.slice(0, -1)) {
    if (!pool.length || rnd() >= chance || !seamOpen(m.p, -side)) continue;
    const id = pick(pool, rnd, R), b = parsed[id], x = side > 0 ? m.x - b.w : m.x + m.w, y = m.y + m.h - b.h;
    if (!free(x, y, b.w, b.h)) continue;
    branches.push({ id, band: 'branch', x, y, w: b.w, h: b.h, main: m, intensity: curve ? m.intensity * 0.5 : 1 });
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
    corridor(top, ft);
    const dx = corridor(bot, fb);
    for (let y = fb - 3; y < fb; y++) tiles[y][dx] = 'D';
    // the switch on the far side of the door: in the shaft for a tower (you come down from the top), in the exit room for a deep POI
    const swX = stack === 'tower' ? sx : (side > 0 ? bot.x + bot.w - 3 : bot.x + 2);
    if (stack === 'tower') tiles[fb - 1][swX] = 'S';
    else if (tiles[fb - 1][swX] === '.') tiles[fb - 1][swX] = 'S';
    else problems.push(`${bot.id}: kein Platz für den Schalter am Schacht`);
    // up = the entrance's end of the shortcut, down = the exit's end (as with the tunnel)
    ends = { up: [ladderX, stack === 'tower' ? fb : ft], down: [ladderX, stack === 'tower' ? ft : fb], floor: fb, door: [dx, fb - 1], shaft: [s0, ft - 3, SW, fb - ft + 3], kind: 'shaft' };
  }
  const def = { name: P.name || poiId, size: [W, H], layout: tiles.map(r => r.join('')), spawns: enemyKit.spawns, tags: ['poi'], backdrop: R[start].backdrop || all.map(o => R[o.id].backdrop).find(Boolean) };
  const rooms = [...placed, ...branches].map(({ id, band, x, y, w, h, intensity, flip }) => ({ id, band, x, y, w, h, intensity: Math.round((intensity ?? 1) * 100), ...(flip ? { flip: true } : {}) }));   // entrance first, like the band
  return { def, rooms, shortcut: ends, branches: branches.length, problems, start, exit, stack };
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

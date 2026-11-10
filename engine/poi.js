// NomadGirl – POI levels. Hand-built room blocks are welded into one seamless level (like Dead Cells):
//
//   branch band   side rooms (tags loot/secret) hang above a main room, a ladder joins their floor hook A to the main room's ceiling hook A
//   main band     entrance (tag start, Leyla's van at L) → middle rooms (combat/corridor) → exit (tag exit, goal Z)
//   tunnel        the shortcut back (like Elden Ring): from v in the exit room down, along under all rooms, up at ^ in the entrance
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
export function buildPoi(D, poiId, seed = 1) {
  const P = D.pois?.[poiId] || {}, R = D.rooms || {}, rnd = rng(seed), problems = [];
  const ready = (P.rooms || []).filter(id => R[id]?.layout?.length);
  const parsed = Object.fromEntries(ready.map(id => [id, parseRoom(R[id])]));
  const start = pick(ready.filter(id => tagged(R, id, 'start')), rnd, R);
  const exit = pick(ready.filter(id => tagged(R, id, 'exit') && id !== start && !tagged(R, id, 'start')), rnd, R);
  if (!start || !exit) return { def: null, rooms: [], shortcut: false, branches: 0, problems: [poiReady(D, poiId).why] };
  // main path: entrance, middle rooms, exit (roomCount = length of the main path)
  const [c0, c1] = P.roomCount || [3, 3], count = Math.max(2, c0 + Math.floor(rnd() * (Math.max(c0, c1) - c0 + 1)));
  const middlePool = ready.filter(id => tagged(R, id, 'combat', 'corridor') && !tagged(R, id, 'start', 'exit') && (R[id].weight ?? 1) > 0);
  const main = [start];
  for (let i = 0; i < count - 2 && middlePool.length; i++) {
    // no room twice in a row while there is a choice
    const pool = middlePool.length > 1 ? middlePool.filter(id => id !== main.at(-1)) : middlePool;
    main.push(pick(pool, rnd, R));
  }
  main.push(exit);

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
      branches.push({ id, band: 'branch', x: left, w: b.w, h: b.h, hookX: m.x + hx });
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

  // enemy symbols: every enemy gets one global letter, rooms keep their own tables
  const letters = 'abcdefghijklmnpqrstuwxyzEFGIJKMNOPQRTUVWXY'.split(''), sym = {}, spawns = [];
  const letterOf = enemy => {
    if (!sym[enemy]) { sym[enemy] = letters.shift() || '.'; if (sym[enemy] !== '.') spawns.push({ symbol: sym[enemy], enemy }); }
    return sym[enemy];
  };
  const poiEnemies = (P.enemies || []).filter(e => D.enemies?.[e]);
  const stamp = (place, y0) => {
    const r = parsed[place.id], table = Object.fromEntries((R[place.id].spawns || []).map(s => [s.symbol, s.enemy]));
    place.y = y0;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      let c = r.tiles[y][x];
      if (c === 'L' && place.id !== start) c = '.';
      else if (c === '^' && !(place.id === start && shortcut)) c = '#';
      else if (c === 'v' && !(place.id === exit && shortcut)) c = '#';
      else if (c === 'Z' && place.id !== exit) c = '.';
      else if (c === '1') c = poiEnemies.length ? letterOf(poiEnemies[Math.floor(rnd() * poiEnemies.length)]) : '.';
      else if (table[c]) c = D.enemies?.[table[c]] ? letterOf(table[c]) : '.';
      tiles[y0 + y][place.x + x] = c;
    }
  };
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
      if (y > top && (tiles[y][hx] === '#' || tiles[y][hx] === '=' || tiles[y][hx] === 'H')) break;
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
  const def = { name: P.name || poiId, size: [W, H], layout, spawns, tags: ['poi'], backdrop: S.backdrop };
  const rooms = [...placedMain, ...branches].map(({ id, band, x, y, w, h }) => ({ id, band, x, y, w, h }));
  return { def, rooms, shortcut: ends, branches: branches.length, problems, start, exit };
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

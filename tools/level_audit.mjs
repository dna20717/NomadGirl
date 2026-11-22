#!/usr/bin/env node
// Level audit (#163, Bibel › Level-Design › Prüfung): every POI × 8 seeds, welded like the game. Checks
//   · main path (L → Z) without a step of 4 or a gap over 3 (except rooms marked „Bewusste Hürde“), on the easiest way the movement
//     model of tools/reach_audit.mjs finds (moves Leyla can do without the double jump)
//   · calm after every peak (≥ 85 % → next < 40 %, not right before the exit)
//   · the landmark seen from at least a third of the main rooms (sky or window)
//   · the way on brighter than the dead ends (a lamp at every exit, brighter than every lamp in a side room; daylight counts as bright)
//   · every fake or brittle wall with a sign within 3 tiles
//   · no spawn at a seam, every shooter with sight of the way in of his room
//   · the Wow room in every seed: narrow before wide, the largest room of the POI, a key light on the motif, calm first, a reward
//     within 4 tiles of the motif
//   · #171 the hull: never on play space, rooms stay closed, windows on the grid of their building (facade, back walls, landmark)
//   · #169 the camps (fresh state and after 10 days): never in an Atempause, the Wow room, the entrance, never at a seam; members on
//     their floor, rounds on walkable floor
// Usage: node tools/level_audit.mjs [--seeds 8] [--poi <id>] [--verbose]   Exit 1 on findings.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeLoader } from './loader.js';
import { loadProject } from '../engine/project.js';
import { buildPoi } from '../engine/poi.js';
import { parseRoom } from '../engine/room.js';
import { atmoRegions, planLights } from '../engine/atmosphere.js';
import { levelConfig, roomGates, landmarkViews, secretSigns, wowInLevel, wowOf, shooterFair, roomType } from '../engine/level_design.js';
import { reachMap, rulesFrom, cycleOpts } from './reach_audit.mjs';
import { initLife, simulate, planLife } from '../engine/ecosystem.js';
import { planHull, hullAudit } from '../engine/facade.js';

export const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];

// the easiest way from L to Z: hard moves (step ≥ 4 rows up, gap ≥ 4 columns without a place to stand) cost a lot
export function mainPath(L, D) {
  const lay = L.def.layout, m = reachMap(lay, { rules: rulesFrom(D), ...cycleOpts(L) });
  let z = null; for (let y = 0; y < lay.length && !z; y++) { const x = lay[y].indexOf('Z'); if (x >= 0) z = [x, y]; }
  if (!z) return { hard: [], ok: false };
  const goal = [-1, 0, 1].map(d => (z[0] + d) + ',' + z[1]).find(k => m.nodes.has(k));
  let start = null; for (let y = 0; y < lay.length && !start; y++) { const x = lay[y].indexOf('L'); if (x >= 0) start = [x, y]; }
  const sk = [...m.nodes].find(k => k === start.join(',')) || [...m.edges.keys()][0];
  const P = k => k.split(',').map(Number), hardOf = (a, b) => {
    const [ax, ay] = P(a), [bx, by] = P(b), up = ay - by;
    let gap = 0; for (let x = Math.min(ax, bx) + 1; x < Math.max(ax, bx); x++) if (!m.nodes.has(x + ',' + ay) && !m.nodes.has(x + ',' + by)) gap++;
    // sliding under a low ceiling (a crawl along a floor) is no gap: the floor goes on under her (#168: seen once the tunnel stopped being the easy way)
    if (gap && ay === by) { let floor = true; for (let x = Math.min(ax, bx) + 1; x < Math.max(ax, bx) && floor; x++) if (!'#='.includes(lay[ay + 1]?.[x] ?? '.')) floor = false; if (floor) gap = 0; }
    return up >= 4 || gap >= 4 ? { up, gap } : null;
  };
  // Dijkstra (small graphs: a bucket queue on cost)
  const dist = new Map([[sk, 0]]), prev = new Map(), q = [[0, sk]];
  while (q.length) {
    q.sort((a, b) => a[0] - b[0]); const [d, k] = q.shift();
    if (d > (dist.get(k) ?? Infinity)) continue;
    if (k === goal) break;
    for (const n of m.edges.get(k) || []) { const c = d + (hardOf(k, n) ? 1000 : 1); if (c < (dist.get(n) ?? Infinity)) { dist.set(n, c); prev.set(n, k); q.push([c, n]); } }
  }
  if (!goal || !dist.has(goal)) return { hard: [], ok: false };
  const hard = [];
  for (let k = goal; prev.has(k); k = prev.get(k)) { const h = hardOf(prev.get(k), k); if (h) hard.push({ at: P(k), ...h }); }
  return { hard, ok: true };
}

export function auditPoi(D, poiId, seed) {
  const L = buildPoi(D, poiId, seed), out = [], cfg = levelConfig(D), P = D.pois[poiId];
  if (!L.def) return [{ what: 'Level', text: L.problems.join(', ') }];
  const add = (what, text, room = null) => out.push({ what, text, room, seed });
  const tiles = L.def.layout, room = parseRoom(L.def), mains = L.rooms.filter(r => r.band === 'main');
  const roomAt = (x, y) => L.rooms.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  // 1. main path
  const mp = mainPath(L, D);
  if (!mp.ok) add('Hauptweg', 'Ziel nicht erreichbar');
  for (const h of mp.hard) { const r = roomAt(...h.at); if (!D.rooms[r?.id]?.hurdle) add('Hauptweg', `${h.up >= 4 ? `Stufe ${h.up}` : `Lücke ${h.gap}`} bei ${h.at.join(',')}`, r?.id); }
  // 2. calm after peaks
  for (let i = 0; i < mains.length - 2; i++) if (mains[i].intensity >= cfg.peak && mains[i + 1].intensity >= cfg.calm) add('Rhythmus', `${mains[i].id} ${mains[i].intensity} % → ${mains[i + 1].id} ${mains[i + 1].intensity} %`, mains[i + 1].id);
  // 3. landmark
  if (P.level?.landmark) {
    const views = landmarkViews(D, poiId, L, cfg).filter(v => L.rooms[v.room]?.band === 'main'), seen = views.filter(v => v.how).length;
    if (seen * 100 < mains.length * cfg.landmarkShare) add('Landmarke', `nur aus ${seen} von ${mains.length} Haupträumen sichtbar`);
  } else add('Landmarke', 'keine Landmarke (POIs › Level-Design)');
  // 4. light at the way on
  const at = atmoRegions(D, room, { level: L, poiId }), { lamps } = planLights(D, room, at, { level: L, poiId });
  const dead = Math.max(0, ...lamps.filter(l => l.deadEnd).map(l => l.strength));
  const bright = r => (D.atmosphere?.[at(r.x + 1, r.y + r.h - 2).mood]?.light?.ambient ?? 100) >= 90;
  mains.slice(0, -1).forEach(r => {
    if (bright(r)) return;
    const ex = lamps.filter(l => l.exit && l.x >= r.x && l.x < r.x + r.w && l.y >= r.y && l.y < r.y + r.h);
    if (!ex.length) add('Licht', 'kein Licht am Weiterweg', r.id);
    else if (Math.max(...ex.map(l => l.strength)) <= dead) add('Licht', `Weiterweg (${Math.max(...ex.map(l => l.strength))}) nicht heller als Sackgassen (${dead})`, r.id);
  });
  // 5. signs at secrets
  for (const s of secretSigns(L, cfg)) if (Math.max(Math.abs(s.x - s.at[0]), Math.abs(s.y - s.at[1])) > cfg.signReach && !s.tiles.some(([x, y]) => Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) <= cfg.signReach)) add('Geheimnis', `ohne Zeichen bei ${s.at.join(',')}`, roomAt(...s.at)?.id);
  // 6. spawns at seams, shooters with sight
  const sym = new Map((L.def.spawns || []).map(s => [s.symbol, s.enemy])), gates = roomGates(L);
  const gatePts = gates.flatMap((g, i) => [i ? g.in : null, i < gates.length - 1 ? g.out : null]).filter(Boolean);
  for (let y = 0; y < tiles.length; y++) for (let x = 0; x < tiles[y].length; x++) {
    const e = sym.get(tiles[y][x]); if (!e || D.enemies?.[e]?.behavior === 'boss') continue;
    if (gatePts.some(([gx, gy]) => Math.abs(gx - x) <= cfg.seam && Math.abs(gy - y) <= cfg.seam + 1)) add('Kampf', `${e} an einer Naht (${x},${y})`, roomAt(x, y)?.id);
  }
  let lx = null; for (let y = 0; y < tiles.length && !lx; y++) { const x = tiles[y].indexOf('L'); if (x >= 0) lx = [x, y]; }
  const entries = mains.map((r, i) => ({ x: r.x, y: r.y, w: r.w, h: r.h, at: i ? gates[i].in : lx }));
  for (const [x, y] of shooterFair(D, tiles.map(r => [...r]), sym, entries, cfg)) add('Kampf', `Schütze ohne Sichtlinie zum Eingang (${x},${y})`, roomAt(x, y)?.id);
  // 7. the Wow room
  const W0 = wowOf(D, poiId), w = wowInLevel(D, poiId, L);
  if (!W0) add('Wow', 'kein Wow-Raum (POIs › Wow)');
  else if (!w) add('Wow', `${W0.room} fehlt in diesem Seed`);
  else {
    const r = w.room, R = D.rooms[r.id], area = r.w * r.h;
    for (const id of P.rooms || []) if (id !== r.id && D.rooms[id]?.layout?.length && D.rooms[id].size && D.rooms[id].size[0] * D.rooms[id].size[1] > area) add('Wow', `nicht der größte Raum (${id} ist größer)`, r.id);
    if (W0.at !== 'start') {
      if (!L.stack) { let open = 0; for (let y = r.y; y < r.y + r.h; y++) if (!'#'.includes(tiles[y][r.x + 2])) open++; if (open > 5) add('Wow', `keine Enge davor (${open} Reihen offen)`, r.id); }
    }
    if (!lamps.some(l => l.key && l.x >= r.x && l.x < r.x + r.w)) add('Wow', 'kein Schlüssellicht', r.id);
    const calm = cfg.wowCalm / 100;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (!sym.has(tiles[y][x]) || D.enemies?.[sym.get(tiles[y][x])]?.behavior === 'boss') continue;
      const lx2 = r.flip ? r.x + r.w - 1 - x : x - r.x, ly = y - r.y;
      const q = L.stack === 'tower' ? ly > r.h * (1 - calm) : L.stack === 'deep' ? ly < r.h * calm : lx2 < r.w * calm;
      if (q) add('Wow', `Gegner im ruhigen Teil (${x},${y})`, r.id);
    }
    let reward = false;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (tiles[y][x] === 'C' || tiles[y][x] === 'Z') {
      const d = Math.max(Math.abs(x - w.x), y > w.y ? y - w.y : y < w.y - 5 ? w.y - 5 - y : 0);
      if (d <= cfg.rewardReach) reward = true;
    }
    if (!reward) add('Wow', `keine Belohnung in ${cfg.rewardReach} Kacheln um das Motiv`, r.id);
    if (roomType(R) !== 'wow') add('Wow', 'Raumtyp ist nicht Wow', r.id);
  }
  // 8. #169 camps
  for (const f of auditLife(D, poiId, L, seed)) add('Lager', f.text, f.room);
  // 9. #171 Hüllen G4: the hull never on play space, every room still closed, windows on the grid of their building (facade, back walls,
  // landmark windows) and whole
  {
    const plan = planHull(D, poiId, L), lw = landmarkViews(D, poiId, L, cfg).filter(v => v.win).map(v => ({ room: v.room, win: v.win }));
    for (const f of hullAudit(D, poiId, L, plan, lw)) add(`Hülle: ${f.what}`, f.text);
  }
  return out;
}
export function auditLife(D, poiId, L, seed) {
  const out = [], cfg = levelConfig(D), gates = roomGates(L), mains = L.rooms.filter(r => r.band === 'main'), tiles = L.def.layout;
  const gatePts = gates.flatMap((g, i) => [i ? g.in : null, i < gates.length - 1 ? g.out : null]).filter(Boolean);
  const fresh = initLife(D, poiId, { seed }), later = simulate(D, poiId, initLife(D, poiId, { seed }), 11);
  for (const S of [fresh, later]) {
    const plan = planLife(D, poiId, L, S, seed);
    for (const c of plan.camps) {
      const r = L.rooms.find(o => o.id === c.room && c.x0 >= o.x && c.x0 < o.x + o.w && c.y >= o.y && c.y < o.y + o.h);
      if (!r) { out.push({ text: `${c.id} liegt in keinem Raum`, room: c.room }); continue; }
      const t = roomType(D.rooms[r.id]);
      if (r.rest || t === 'rest') out.push({ text: `${c.name} in einer Atempause`, room: r.id });
      if (r.wow || t === 'wow') out.push({ text: `${c.name} im Wow-Raum`, room: r.id });
      if (r === mains[0]) out.push({ text: `${c.name} im Eingang`, room: r.id });
      for (const m of c.members) {
        if (gatePts.some(([gx, gy]) => Math.abs(gx - m.x) <= cfg.seam && Math.abs(gy - m.y) <= cfg.seam + 1)) out.push({ text: `${c.name}: ${m.enemy} an einer Naht (${m.x},${m.y})`, room: r.id });
        if (tiles[m.y + 1]?.[m.x] !== '#' || '#='.includes(tiles[m.y]?.[m.x])) out.push({ text: `${c.name}: ${m.enemy} ohne Boden (${m.x},${m.y})`, room: r.id });
      }
      const [a, b] = c.route;
      for (let x = a; x <= b; x++) if (!'#='.includes(tiles[c.y + 1]?.[x] ?? '.')) { out.push({ text: `${c.name}: Runde über Luft (${x},${c.y})`, room: r.id }); break; }
    }
  }
  return out;
}

const run = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (run) {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const n = +(opt('--seeds') || 8), only = opt('--poi'), verbose = args.includes('--verbose');
  const seeds = n <= 8 ? SEEDS.slice(0, n) : [...Array(n).keys()].map(i => i + 1);
  const p = await loadProject(nodeLoader(path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl')));
  let total = 0;
  for (const poi of Object.keys(p.data.pois).filter(k => !only || k === only)) {
    const all = seeds.flatMap(s => auditPoi(p.data, poi, s)), by = new Map();
    for (const f of all) { const k = `${f.what} · ${f.room || '–'} · ${f.text.replace(/\(\d+,\d+\)|\d+,\d+/g, '…')}`; by.set(k, [...(by.get(k) || []), f.seed]); }
    total += by.size;
    console.log(by.size ? `${poi}: ${by.size} Befunde (${seeds.length} Seeds)` : `${poi}: ohne Befunde (${seeds.length} Seeds)`);
    for (const [k, s] of by) console.log(`  ${k}  (Seeds ${[...new Set(s)].join(', ')})`);
    if (verbose) for (const f of all) console.log('   ', f.seed, f.what, f.room, f.text);
  }
  console.log(total ? `${total} Befunde` : 'Level-Prüfer: alles nach der Bibel.');
  process.exitCode = total ? 1 : 0;
}

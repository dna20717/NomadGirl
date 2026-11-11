// NomadGirl – atmosphere of rooms and POI levels (area "Atmosphäre", Daniel, 11.11.2026: "Atmosphäre und Beleuchtung für die POIs,
// damit alles nicht so blank wirkt"). Pure logic for browser and Node: which mood holds where, where the lamps hang.
// Drawing (lightmap, glow, dust, sparks, drips, fog) lives in game/play/atmosphere.js.
//
// Mood of a tile: Raum-Bausteine › Atmosphäre, else the room's Kachel-Set › Atmosphäre, else Spiel › Atmosphäre › Standard.
// In a POI level each tile belongs to the room in its column (like the Kachel-Sets); below all rooms lies the tunnel
// (POIs › Atmosphäre im Tunnel, else the tunnel's Kachel-Set).
import { WALL } from './room.js';

export const LAMP_KINDS = [['ceiling', 'Deckenlampe'], ['tube', 'Neonröhre'], ['emergency', 'Notlicht'], ['bulb', 'Glühbirne']];
export const LIGHT_BEHAVIORS = [['steady', 'Ruhig'], ['flicker', 'Flackert'], ['pulse', 'Pulsiert'], ['broken', 'Kaputt (Aussetzer, Funken)']];

// the same random number for the same tile, every time
export const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// → regionAt(x, y): { key, room (id or null for the tunnel), mood (id or null), x, y, w, h (tiles) }
//   level = buildPoi(...) result or null (single room), roomId = the single room, poiId = the POI of the level
export function atmoRegions(D, room, { level = null, roomId = null, poiId = null } = {}) {
  const dflt = D.game?.atmosphere?.default || null;
  const moodOfRoom = id => { const r = D.rooms?.[id] || {}, t = r.terrain || D.game?.tiles?.terrain; return r.atmosphere || D.terrain?.[t]?.atmosphere || dflt; };
  if (!level?.def) {
    const whole = { key: 'room', room: roomId, mood: moodOfRoom(roomId), x: 0, y: 0, w: room.w, h: room.h };
    return () => whole;
  }
  const P = D.pois?.[poiId] || {}, rooms = level.rooms.map((r, i) => ({ key: 'r' + i, room: r.id, mood: moodOfRoom(r.id), x: r.x, y: r.y, w: r.w, h: r.h }));
  const bottom = Math.max(...rooms.map(r => r.y + r.h));
  const tunnelSet = P.tunnelTerrain || D.rooms?.[level.rooms[0]?.id]?.terrain || D.game?.tiles?.terrain;
  const tunnel = { key: 'tunnel', room: null, mood: P.tunnelAtmosphere || D.terrain?.[tunnelSet]?.atmosphere || dflt, x: 0, y: bottom, w: room.w, h: room.h - bottom };
  const cache = new Map();
  return (x, y) => {
    const k = x + ',' + y;
    if (cache.has(k)) return cache.get(k);
    const col = rooms.filter(r => x >= r.x && x < r.x + r.w);
    let r = col.find(r => y >= r.y && y < r.y + r.h) || null;
    if (!r && col.length && y < Math.max(...col.map(c => c.y + c.h))) r = col.reduce((a, b) => Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a);
    if (!r && y < bottom) r = rooms.reduce((a, b) => Math.abs(b.x + b.w / 2 - x) < Math.abs(a.x + a.w / 2 - x) ? b : a);   // outside all columns (edge)
    r ||= tunnel;
    cache.set(k, r);
    return r;
  };
}

// Lamps of a room or level. Auto: every ceiling tile (wall with two tiles of air below) every n tiles of its room gets a lamp
// from the mood's table Lampen (chance per spot). Fixed: * in the layout hangs the mood's first lamp there.
// → { lamps: [{ x, y (tile of the fixture: ceiling bottom = y * T), kind, color, radius, strength, behavior, seed, region, fixed }],
//     ceilings: [[x, y]] every ceiling tile (drips), faces: [[x, y]] wall tiles next to air (sparks) }
export function planLights(D, room, regionAt) {
  const M = D.atmosphere || {}, solid = (x, y) => x < 0 || y < 0 || x >= room.w || y >= room.h || WALL.has(room.tiles[y][x]);
  const air = (x, y) => !solid(x, y) && room.tiles[y]?.[x] !== 'H' && room.tiles[y]?.[x] !== '=';
  const lamps = [], ceilings = [], faces = [], taken = new Set();
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    if (room.tiles[y][x] === '*') {
      const reg = regionAt(x, y), rows = M[reg.mood]?.lamps || [], L = rows[0] || { kind: 'bulb' };
      // the fixture hangs from the ceiling above (up to 3 tiles), else from the top of this tile
      let cy = y; while (cy > y - 3 && !solid(x, cy - 1)) cy--;
      if (!solid(x, cy - 1)) cy = y;
      lamps.push(lamp(L, x, cy, reg, true));
      continue;
    }
    if (!solid(x, y)) continue;
    if (air(x, y + 1) && air(x, y + 2)) ceilings.push([x, y + 1]);
    if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y + 1)) faces.push([x, y]);
  }
  for (const [x, y] of ceilings) {
    const reg = regionAt(x, y), rows = M[reg.mood]?.lamps || [];
    for (let i = 0; i < rows.length; i++) {
      const L = rows[i], every = Math.max(1, L.every || 8), at = ((L.offset ?? Math.floor(every / 2)) % every + every) % every;
      if (((x - reg.x) % every + every) % every !== at || taken.has(x + ',' + y)) continue;
      if (hash(x, y, 31 + i) * 100 >= (L.chance ?? 100)) continue;
      lamps.push(lamp(L, x, y, reg, false));
      taken.add(x + ',' + y);
    }
  }
  return { lamps, ceilings, faces };
}
function lamp(L, x, y, reg, fixed) {
  return { x, y, kind: L.kind || 'ceiling', color: L.color || '#ffe2a8', radius: L.radius || 360, strength: L.strength ?? 80, behavior: L.behavior || 'steady', seed: hash(x, y, 77), region: reg, fixed };
}

// brightness factor of a light at time t (ms) by its behavior; seed 0..1 keeps lamps out of step → 0..1
export function behave(behavior, t, seed = 0) {
  if (behavior === 'pulse') return 0.62 + 0.38 * Math.sin(t / 1000 * Math.PI * 2 * (0.35 + seed * 0.3) + seed * 6.28);
  if (behavior === 'flicker') {
    const slot = Math.floor(t / 70), n = hash(slot, 3, Math.floor(seed * 1e6));
    const burst = hash(Math.floor(t / 1700), 5, Math.floor(seed * 1e6)) < 0.35;   // now and then a nervous phase
    return burst ? (n < 0.45 ? 0.15 + n : 1) : n < 0.04 ? 0.35 : 0.92 + 0.08 * n;
  }
  if (behavior === 'broken') {
    const slot = Math.floor(t / 90), n = hash(slot, 7, Math.floor(seed * 1e6));
    const on = hash(Math.floor(t / 2300), 9, Math.floor(seed * 1e6)) < 0.3;   // mostly dark, sometimes it catches
    return on ? (n < 0.5 ? 0.9 : 0.2) : n < 0.03 ? 0.7 : 0.04;
  }
  return 1;
}

// mood values with defaults (a missing mood = no darkness, nothing moving)
export function moodOf(D, id) {
  const m = D.atmosphere?.[id] || {};
  return {
    id, ambient: (m.light?.ambient ?? 100) / 100, color: m.light?.color || '#ffffff', vignette: (m.light?.vignette ?? 0) / 100,
    lamps: m.lamps || [], dust: m.dust || {}, sparks: m.sparks || {}, drips: m.drips || {}, fog: m.fog || {},
  };
}

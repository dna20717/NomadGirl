// NomadGirl – atmosphere of rooms and POI levels (area "Atmosphäre", Daniel, 11.11.2026: "Atmosphäre und Beleuchtung für die POIs,
// damit alles nicht so blank wirkt"). Pure logic for browser and Node: which mood holds where, where the lamps hang.
// Drawing (lightmap, glow, dust, sparks, drips, fog) lives in game/play/atmosphere.js.
//
// Mood of a tile: Raum-Bausteine › Atmosphäre, else the room's Kachel-Set › Atmosphäre, else Spiel › Atmosphäre › Standard.
// In a POI level each tile belongs to the room in its column (like the Kachel-Sets); below all rooms lies the tunnel
// (POIs › Atmosphäre im Tunnel, else the tunnel's Kachel-Set).
import { WALL } from './room.js';
import { levelConfig, lightTheWay, wowInLevel } from './level_design.js';
import { shaftInLevel } from './shaft.js';
import { roomTale, decayConfig } from './dressing_story.js';
import { roomStory } from './story.js';
import { planHull, hullLamps } from './facade.js';

export const LAMP_KINDS = [['ceiling', 'Deckenlampe'], ['tube', 'Neonröhre'], ['panel', 'Leuchtpaneel (Supermarkt)'], ['emergency', 'Notlicht'], ['bulb', 'Glühbirne']];
export const LIGHT_BEHAVIORS = [['steady', 'Ruhig'], ['flicker', 'Flackert'], ['pulse', 'Pulsiert'], ['broken', 'Kaputt (Aussetzer, Funken)'], ['stutter', 'Springt an (Neonröhre stottert)'], ['alarm', 'Alarm (Rundumlicht)'], ['buzz', 'Brummt (leises Zittern)']];

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
// #163 opts = { level (buildPoi result), poiId }: light at the way on (the lamp at every main room's exit brightest, dead ends dimmer) and
// the Wow room's key light on its motif (POIs › Wow › Schlüssellicht)
export function planLights(D, room, regionAt, opts = {}) {
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
  if (opts.level?.rooms?.length) {
    // #159 decay breaks lamps (POIs › Story › Verfall, Spiel › Set-Dressing Stufe 2 › Lampen kaputt), a room's story can dim them
    const dc = decayConfig(D), P = D.pois?.[opts.poiId] || {};
    for (const l of lamps) {
      const r = l.region?.room ? opts.level.rooms.find(o => o.id === l.region.room && l.x >= o.x && l.x < o.x + o.w && l.y >= o.y && l.y < o.y + o.h) : null;
      if (!r) continue;
      const decay = roomStory(P, D.rooms?.[r.id] || {}).decay, tale = D.roomStories?.[roomTale(D, opts.poiId, r, r.x * 1000 + r.y, opts.seed || 0)];
      if (!l.fixed && hash(l.x, l.y, 913) * 100 < dc.broken * decay) l.behavior = 'broken';
      if (tale?.light) l.strength = Math.round(l.strength * (1 - tale.light / 100));
    }
    const cfg = levelConfig(D);
    lightTheWay(lamps, opts.level, room, cfg, (x, y) => { const reg = regionAt(x, y), L = M[reg.mood]?.lamps?.[0] || { kind: 'bulb' }; return (M[reg.mood]?.light?.ambient ?? 100) >= 90 ? null : lamp(L, x, y, reg, true); });   // daylight needs no lamp
    const W = wowInLevel(D, opts.poiId, opts.level);
    if (W) {
      const top = x => { let y = W.y - 2; while (y > W.room.y && !solid(x, y - 1)) y--; return y; };
      const L = { kind: 'ceiling', color: W.W.light || '#ffe2a8', radius: W.W.lightRadius || 560, strength: W.W.lightStrength ?? 220, behavior: W.W.particles === 'flicker' ? 'stutter' : 'steady' };
      lamps.push({ ...lamp(L, W.x, top(W.x), regionAt(W.x, top(W.x)), true), key: true });
      // #165 Fülllicht: two softer lamps left and right of the motif, a quarter of the room away, so the room does not drown
      if (W.W.fill > 0) for (const d of [-1, 1]) {
        const x = Math.max(W.room.x + 1, Math.min(W.room.x + W.room.w - 2, W.x + d * Math.round(W.room.w / 4))), y = top(x);
        lamps.push(lamp({ ...L, kind: 'ceiling', behavior: 'steady', radius: Math.round(L.radius * 0.9), strength: Math.round(L.strength * W.W.fill / 100) }, x, y, regionAt(x, y), true));
      }
    }
    // #179 the hull's lamps (Welt › Gebäudetypen › Licht der Hülle): canopy strips, entrance downlights, the pylon's light boxes
    if (opts.level.def) for (const L of hullLamps(planHull(D, opts.poiId, opts.level))) {
      const tx = Math.max(0, Math.min(room.w - 1, Math.floor(L.x))), ty = Math.max(0, Math.min(room.h - 1, Math.floor(L.y)));
      lamps.push({ ...lamp(L, L.x, L.y, regionAt(tx, ty), true), bare: true, free: !!L.free, hull: L.what });
    }
    // #173 Schacht-Motiv: a floodlight over the motif in every room the shaft crosses (POIs › Schacht-Motiv › Schacht-Licht)
    const sh = shaftInLevel(D, opts.poiId, opts.level);
    if (sh && sh.cfg.lightStrength > 0) {
      const x = sh.body[0] + Math.floor(sh.body[1] / 2);
      for (const o of sh.rooms) {
        let y = o.y; while (y < o.y + o.h && !sh.cells.has(x + ',' + y)) y++;
        if (y >= o.y + o.h) continue;
        while (y > o.y && !solid(x, y - 1)) y--;
        lamps.push({ ...lamp({ kind: 'ceiling', color: sh.cfg.light, radius: 520, strength: sh.cfg.lightStrength, behavior: 'steady' }, x, y, regionAt(x, y), true), shaft: true });
      }
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
  if (behavior === 'stutter') {   // a tube that keeps trying to start: dark, a stammering burst, then on for a while
    const cyc = 5200 + seed * 3000, p = (t + seed * 9000) % cyc;
    if (p < 900) return 0.06;
    if (p < 1500) return hash(Math.floor(t / 45), 11, Math.floor(seed * 1e6)) < 0.5 ? 1 : 0.1;
    return 0.95 + 0.05 * hash(Math.floor(t / 120), 13, Math.floor(seed * 1e6));
  }
  if (behavior === 'alarm') {   // rotating beacon: a sharp sweep twice a second
    const p = ((t / 1000) * (1.6 + seed * 0.4) + seed) % 1;
    return 0.15 + 0.85 * Math.max(0, Math.cos(p * Math.PI * 2)) ** 6;
  }
  if (behavior === 'buzz') return 0.9 + 0.1 * hash(Math.floor(t / 50), 17, Math.floor(seed * 1e6));
  return 1;
}

// mood values with defaults (a missing mood = no darkness, nothing moving)
export function moodOf(D, id) {
  const m = D.atmosphere?.[id] || {};
  return {
    id, ambient: (m.light?.ambient ?? 100) / 100, color: m.light?.color || '#ffffff', vignette: (m.light?.vignette ?? 0) / 100,
    lamps: m.lamps || [], dust: m.dust || {}, sparks: m.sparks || {}, drips: m.drips || {}, fog: m.fog || {}, critters: m.critters || {},
  };
}

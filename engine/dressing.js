// NomadGirl – set dressing by rules (#158, Daniel 21.11.2026: „Wie können wir hübschere, echter anfühlende Maps erschaffen, ohne dass
// ich alles selbst machen muss? … Clutter wird manchmal zu gehäuft eingesetzt, manchmal falsch (ein Baum oben auf einem Hochhaus)“).
// Runs in the browser (game/play/art.js drawRoom) and in Node (test/dressing.test.js), no DOM.
//
//   regionMap(D, …)        which room, Kachel-Set, inside/outside and room role every tile of a level belongs to
//   placeTypes(room, reg)  place types from the tiles: floor_in, floor_out, roof, ledge (+ corner), ceiling, wall

// Ort-Typen: where a thing can be (Kachel-Sets › Clutter-Regeln › Ort, POI-Ensembles › Ort)
export const PLACE_TYPES = [['floor_in', 'Boden drinnen'], ['floor_out', 'Boden draußen'], ['roof', 'Dach'], ['ledge', 'Steg / Sims / Theke'],
  ['corner', 'Ecke am Wandfuß'], ['ceiling', 'Decke (hängt)'], ['wall', 'Wand (Rückwand, Augenhöhe)']];
export const PLACE_COLORS = { floor_in: '#3fe0d0', floor_out: '#f0c040', roof: '#ff5ab4', ledge: '#8a7dff', corner: '#ff8a3d', ceiling: '#7dff9a', wall: '#c8c8d8' };
export const STANDING = new Set(['floor_in', 'floor_out', 'roof', 'ledge']);
// Raum-Rollen (#158 step 3): what a room is for; weights the choice of clutter and ensembles (Spiel › Set-Dressing › Rollen)
export const ROOM_ROLES = [['general', 'allgemein'], ['shop', 'Laden'], ['storage', 'Lager'], ['office', 'Büro'], ['hall', 'Halle'], ['living', 'Wohnen'],
  ['tech', 'Technik'], ['corridor', 'Gang'], ['outdoor', 'Draußen'], ['combat', 'Kampf'], ['cave', 'Höhle']];

// tiles drawn as wall by art.js (doors D and brittle walls B are drawn by poi_level.js and carry nothing)
const WALLISH = new Set(['#', 'A', '^', 'v', '%', '$']);
const list = v => Array.isArray(v) ? v : String(v || '').split(',').map(s => s.trim()).filter(Boolean);
export const splitList = list;

// Which room every tile belongs to, its Kachel-Set id, inside (back wall) or outside, and its role. Same rules as before (#038):
// in a level each tile belongs to the room at it, above a room to the nearest room in its column, below all rooms the tunnel.
// rooms = levelInfo.rooms (or null for a single room roomId)
export function regionMap(D, { rooms = null, roomId = null, poiId = null } = {}) {
  const dflt = D.game?.tiles?.terrain, roomSet = id => D.rooms?.[id]?.terrain || dflt;
  const indoor = id => { const r = D.rooms?.[id] || {}; return r.indoor ?? !(r.backdrop?.image || r.backdrop?.weather); };
  const roleOf = id => D.rooms?.[id]?.role || (id && !indoor(id) ? 'outdoor' : 'general');
  if (rooms?.length) {
    const P = D.pois?.[poiId] || {}, tunnel = P.tunnelTerrain || roomSet(rooms[0]?.id), cache = new Map();
    const roomAt = (x, y) => {
      const k = x + ',' + y;
      if (cache.has(k)) return cache.get(k);
      const col = rooms.filter(r => x >= r.x && x < r.x + r.w);
      let r = col.find(r => y >= r.y && y < r.y + r.h) || null;
      if (!r && col.length && y < Math.max(...col.map(c => c.y + c.h))) r = col.reduce((a, b) => Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a);
      cache.set(k, r);
      return r;
    };
    return { tower: P.stack === 'tower', roomAt, idAt: (x, y) => { const r = roomAt(x, y); return r ? roomSet(r.id) : tunnel; }, inside: (x, y) => { const r = roomAt(x, y); return r ? indoor(r.id) : true; },
      roleAt: (x, y) => { const r = roomAt(x, y); return r ? roleOf(r.id) : 'corridor'; } };
  }
  const own = roomSet(roomId), inside = !!D.rooms?.[roomId]?.indoor;
  return { roomAt: () => null, idAt: () => own, inside: () => inside, roleAt: () => D.rooms?.[roomId]?.role || (inside ? 'general' : 'outdoor') };
}

// Ort-Typen (#158 step 1) from the tiles of a parsed room (or level). room = { w, h, tiles }, reg = regionMap(…) (inside, roomAt)
// → { list, at(x, y) } with entries
//   standing: { x, y (the carrying tile), type: floor_in | floor_out | roof | ledge, corner: 'l' | 'r' | null, air (free tiles above, max 8), run: [x0, x1] }
//   ceiling:  { x, y (the air tile under the ceiling), type: 'ceiling', drop (free tiles below) }
//   wall:     { x, y (air tile at eye height, 1.5 tiles above the floor), type: 'wall', side: 'l' | 'r' | null (a side wall next to it) }
// roof = top of a building: outside, with a room's air under a thin slab (up to 4 tiles); ledge = platform (=), a thin slab with air
// under it outside, a short slab inside (under 5 tiles) or the top of a narrow block that stands up out of the floor (counter, pump)
export function placeTypes(room, reg = {}) {
  const { w, h, tiles } = room, ch = (x, y) => tiles[y]?.[x];
  const inside = reg.inside || (() => false), roomAt = reg.roomAt || (() => null);
  const solid = (x, y) => x < 0 || y < 0 || x >= w || y >= h || WALLISH.has(ch(x, y));
  const carries = (x, y) => solid(x, y) || ch(x, y) === '=';
  const open = (x, y) => ch(x, y) === '.';
  const surface = (x, y) => y > 0 && y < h && x >= 0 && x < w && carries(x, y) && !carries(x, y - 1) && !solid(x, y - 1);
  const out = [], at = new Map();
  const add = e => { out.push(e); at.set(e.type === 'ceiling' || e.type === 'wall' ? `${e.type}:${e.x},${e.y}` : `${e.x},${e.y}`, e); };
  for (let y = 1; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!surface(x, y)) { x++; continue; }
      let x1 = x; while (x1 + 1 < w && surface(x1 + 1, y) && (ch(x1 + 1, y) === '=') === (ch(x, y) === '=')) x1++;
      const width = x1 - x + 1;
      // a narrow block standing up out of the floor: both ends drop at least 2 tiles (counter, pump island, crate stack)
      const drop = xx => { let d = 0; while (d < 3 && !carries(xx, y + d)) d++; return d; };
      const raised = width <= 4 && drop(x - 1) >= 2 && drop(x1 + 1) >= 2;
      for (let xx = x; xx <= x1; xx++) {
        let air = 0; while (air < 8 && open(xx, y - 1 - air)) air++;
        const inn = inside(xx, y - 1);
        let type;
        if (ch(xx, y) === '=') type = 'ledge';
        else {
          let k = 1; while (k <= 4 && solid(xx, y + k)) k++;
          // air under a thin slab; the shortcut tunnel under all rooms (no room there) counts as ground
          const hollow = k <= 4 && y + k < h && !solid(xx, y + k) && !(reg.roomAt && !roomAt(xx, y + k) && roomAt(xx, y - 1));
          // outside: a room under it (up to 8 tiles of wall down, e.g. a block on a roof deck) makes it a roof
          // in a tower (#038) any room further down the column: the whole stack is one building
          const deep = reg.tower ? h : 8;
          let kr = 1; while (kr <= deep && solid(xx, y + kr)) kr++;
          const under = kr <= deep && y + kr < h && !solid(xx, y + kr) && roomAt(xx, y + kr);
          if (!inn && under && (inside(xx, y + kr) || under !== roomAt(xx, y - 1))) type = 'roof';
          else if (hollow && !inn) type = 'ledge';
          else if (hollow) type = width >= 5 ? 'floor_in' : 'ledge';
          else if (raised) type = 'ledge';
          else type = inn ? 'floor_in' : 'floor_out';
        }
        const corner = solid(xx - 1, y - 1) ? 'l' : solid(xx + 1, y - 1) ? 'r' : null;
        add({ x: xx, y, type, corner, air, run: [x, x1] });
      }
      x = x1 + 1;
    }
  }
  for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) {
    if (!open(x, y)) continue;
    if (solid(x, y - 1) && !open(x, y - 2)) {   // the underside of a wall: something can hang here
      let drop = 0; while (drop < 12 && open(x, y + drop)) drop++;
      if (drop >= 3) add({ x, y, type: 'ceiling', drop });
    }
    // eye height on the back wall: floor two tiles below, only inside (outside there is no wall behind)
    if (inside(x, y) && open(x, y + 1) && carries(x, y + 2) && !carries(x, y + 1) && !solid(x, y - 1))
      add({ x, y, type: 'wall', side: solid(x - 1, y) ? 'l' : solid(x + 1, y) ? 'r' : null });
  }
  return { list: out, at: (x, y, type = null) => at.get(type === 'ceiling' || type === 'wall' ? `${type}:${x},${y}` : `${x},${y}`) || null };
}
// does a thing with these place types fit this spot? corner things only at the foot of a wall, standing things on their own types
export function fits(place, spot) {
  const P = list(place);
  if (!P.length) return STANDING.has(spot.type) && spot.type !== 'roof' && spot.type !== 'ledge';
  if (spot.type === 'ceiling' || spot.type === 'wall') return P.includes(spot.type);
  if (!P.includes(spot.type)) return P.includes('corner') && !!spot.corner && !P.some(p => STANDING.has(p)) && (spot.type === 'floor_in' || spot.type === 'floor_out');
  return true;
}

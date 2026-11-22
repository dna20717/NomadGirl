// #173 Schacht-Motiv (Daniel, 22.11.2026: „Die Rakete ist viel zu klein. Mach aus der Grafik ein Tileset und mach die Rakete so hoch
// wie das Silo selbst. Das ist übrigens ein POI, den man von oben nach unten erkundet.“): one column through a stacked POI (Tiefe/Turm)
// in which a tall motif stands, stacked from segments (nose, hull, rings, tail, pad; a tower beside it). The rooms of the stack hang
// centred under each other (engine/poi.js, „Räume am Schacht ausrichten“), so the column runs through all of them; in every room it
// crosses, the back wall opens onto the shaft and the motif shows behind the play layer. Collision and reachability stay untouched:
// only air tiles show the shaft, walls and floors stay where they are.
// Data: POIs › Schacht-Motiv (field `shaft`). Pictures: game/play/shaft_fx.js. Runs in the browser and in Node.

const WALL = new Set(['#', 'A', '^', 'v', '%', '$', 'B']);

// POIs › Schacht-Motiv with its defaults, or null when it is off
export function shaftConfig(P) {
  const S = P?.shaft;
  if (!S?.on || (P.stack !== 'deep' && P.stack !== 'tower')) return null;
  return {
    width: Math.max(2, +S.width || 10),                 // tiles of the hull
    tower: Math.max(0, S.tower ?? 6),                   // tiles of the service tower beside it (0 = none)
    towerSide: S.towerSide === 'right' ? 'right' : 'left',
    align: S.align !== false,
    top: S.top || 'indoor',                             // 'indoor': under the first room that is not open to the sky; 'first'
    bottom: S.bottom || 'wow',                          // 'wow': the motif stands on the Wow room's floor; 'last': on the lowest room's
    ringEvery: Math.max(0, S.ringEvery ?? 44),          // a stage ring about every n tiles (0 = none)
    ride: S.ride !== false,                             // the Wow camera rides up the motif and back
    rideMs: Math.max(1500, +S.rideMs || 5200),
    light: S.light || '#dae0ea',
    lightStrength: S.lightStrength ?? 70,
    segments: S.segments || [],
    kind: S.kind || 'rocket',
  };
}

const indoorOf = (D, id) => { const r = D.rooms?.[id] || {}; return r.indoor ?? !(r.backdrop?.image || r.backdrop?.weather); };

// the column in a welded level → null or
// { cfg, x0, w (tiles of the whole column), body: [x, w], tower: [x, w] | null, top (tile row of the tip), foot (tile row the motif
//   stands on: its bottom edge), bottomRoom (index), wowRoom (index | -1), rooms: [{ room, x, y, w, h }] (main rooms the column crosses,
//   their air in the column), open(x, y) → true where the shaft shows (air of a crossed main room inside the column, or anywhere in the
//   room the motif stands in), cells: Set of 'x,y' (the open tiles inside the column: no back wall there), seed }
export function shaftInLevel(D, poiId, L) {
  const P = D?.pois?.[poiId], cfg = shaftConfig(P);
  if (!cfg || !L?.def?.layout || !L.rooms?.length) return null;
  const tiles = L.def.layout, H = tiles.length, W = tiles[0].length;
  const mains = L.rooms.map((r, i) => ({ ...r, i })).filter(r => r.band === 'main').sort((a, b) => a.y - b.y);
  if (mains.length < 2) return null;
  // top: the first room that is not open to the sky (the surface of a silo is a yard); bottom: the Wow room or the lowest room
  const first = cfg.top === 'first' ? mains[0] : mains.find(r => indoorOf(D, r.id)) || mains[0];
  const wow = L.rooms.findIndex(r => r.wow);
  const standOn = cfg.bottom === 'wow' && wow >= 0 ? L.rooms[wow] : mains.at(-1);
  const bottomRoom = L.rooms.indexOf(standOn) >= 0 ? L.rooms.indexOf(standOn) : mains.at(-1).i;
  const span = mains.filter(r => r.y >= first.y && r.y <= mains.at(-1).y);
  const air = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !WALL.has(tiles[y][x]);
  const inRoom = (r, x, y) => x > r.x && x < r.x + r.w - 1 && y > r.y && y < r.y + r.h - 1;
  // the column: most open tiles over the rooms it crosses (the room the motif stands in counts three times), near the middle on a tie
  const cw = cfg.width + cfg.tower;
  if (cw > W - 2) return null;
  const mid = span.reduce((s, r) => s + r.x + r.w / 2, 0) / span.length;
  let best = null;
  for (let x0 = 1; x0 + cw < W; x0++) {
    let n = 0;
    for (const r of span) {
      let k = 0;
      for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = x0; x < x0 + cw; x++) if (inRoom(r, x, y) && air(x, y)) k++;
      n += r.i === bottomRoom ? 3 * k : k;
    }
    // the tail is about 2.3 hulls wide: in the stand room its fins want air on both sides of the hull (lowest 12 rows)
    const sr0 = L.rooms[bottomRoom], b0 = cfg.towerSide === 'left' ? x0 + cfg.tower : x0, f0 = Math.floor(b0 - 0.65 * cfg.width), f1 = Math.ceil(b0 + 1.65 * cfg.width);
    for (let y = sr0.y + sr0.h - 13; y < sr0.y + sr0.h - 1; y++) for (let x = f0; x < f1; x++) if (inRoom(sr0, x, y) && air(x, y)) n += 2;
    const d = Math.abs(x0 + cw / 2 - mid);
    if (!best || n > best.n || (n === best.n && d < best.d)) best = { x0, n, d };
  }
  if (!best?.n) return null;
  const x0 = best.x0, tl = cfg.towerSide === 'left';
  const body = [tl ? x0 + cfg.tower : x0, cfg.width], tower = cfg.tower ? [tl ? x0 : x0 + cfg.width, cfg.tower] : null;
  const top = first.y + 1, sr = L.rooms[bottomRoom], foot = sr.y + sr.h - 1;
  const rooms = [], cells = new Set(), below = mains.filter(r => r.y > sr.y);
  for (const r of span) {
    if (r.y > sr.y + sr.h) continue;
    let k = 0, ys = [];
    for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = x0; x < x0 + cw; x++) if (inRoom(r, x, y) && air(x, y)) { k++; cells.add(x + ',' + y); ys.push(y); }
    if (k) rooms.push({ room: r.i, x: x0, y: Math.min(...ys), w: cw, h: Math.max(...ys) - Math.min(...ys) + 1 });
  }
  // under the stand: the flame trench through the rooms below (the exit at the launch pad), only inside the hull's width
  const trench = [];
  for (const r of below) {
    let k = 0;
    for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = body[0]; x < body[0] + body[1]; x++) if (inRoom(r, x, y) && air(x, y)) { k++; cells.add(x + ',' + y); }
    if (k) trench.push({ room: r.i, x: body[0], y: r.y + 1, w: body[1], h: r.h - 2 });
  }
  const open = (x, y) => {
    if (cells.has(x + ',' + y)) return true;
    return inRoom(sr, x, y) && air(x, y);   // the tail and the pad are wider than the column: the whole stand room shows them
  };
  return { cfg, x0, w: cw, body, tower, top, foot, bottomRoom, wowRoom: wow, rooms, trench, open, cells, seed: (L.def.layout.length * 31 + W) | 0 };
}

// which hull picture goes where: from the tip down, a stage ring every `ringEvery` tiles, the hull variants by weight, never the
// same striped/hatch panel twice in a row; deterministic per level. segH(part, image) → height in tiles of one copy at the hull width.
// → [{ part, image, y (tile row of the top edge), h }]
export function stackSegments(sh, segH) {
  const S = sh.cfg.segments, by = p => S.filter(s => s.part === p && s.image), out = [];
  const nose = by('nose')[0], tail = by('engine')[0], ring = by('ring')[0], hulls = by('body');
  if (!hulls.length) return out;
  let y = sh.top;
  if (nose) { const h = segH(nose); out.push({ part: 'nose', image: nose.image, seg: nose, y, h }); y += h; }
  const end = sh.foot - (tail ? segH(tail) : 0);
  let seed = sh.seed >>> 0 || 1, last = null, sinceRing = 0;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const total = hulls.reduce((s, h) => s + (h.weight ?? 1), 0);
  while (y < end - 0.01) {
    if (ring && sh.cfg.ringEvery && sinceRing >= sh.cfg.ringEvery && end - y > segH(ring) + 4) {
      const h = segH(ring); out.push({ part: 'ring', image: ring.image, seg: ring, y, h }); y += h; sinceRing = 0; last = 'ring'; continue;
    }
    let pick = hulls[0];
    for (let tries = 0; tries < 6; tries++) {
      let t = rnd() * total; pick = hulls.find(h => (t -= (h.weight ?? 1)) < 0) || hulls[0];
      if (pick.image !== last || hulls.length === 1) break;
    }
    if (last === 'ring' || out.length === (nose ? 1 : 0)) pick = hulls.find(h => h.after === 'ring') || pick;   // a stage starts with its band
    const h = Math.min(segH(pick), end - y);
    out.push({ part: 'body', image: pick.image, seg: pick, y, h, cut: h < segH(pick) });
    y += h; sinceRing += h; last = pick.image;
  }
  if (tail) out.push({ part: 'engine', image: tail.image, seg: tail, y: end, h: segH(tail) });
  return out;
}

const WALLS = new Set(['#', 'A', '^', 'v']);   // drawn as wall (doors and brittle walls: game/play/poi_level.js)
const CAMO = new Set(['%', '$']);   // fake walls and camouflaged brittle walls: drawn like the wall, on their own layer above Leyla
// Code-drawn art for the MVP: sky and skyline of BigCityDelta, tiles, placeholder raiders, projectiles, particles.
// Everything is generated at start (no external files). Real AI assets replace the placeholders via "look".

export const PLACEHOLDER_COLORS = {
  rust: { cloth: 0x7a3b2a, dark: 0x3d1f18, accent: 0xff7a3d },
  olive: { cloth: 0x5c6236, dark: 0x2c2f1a, accent: 0xd6e04a },
  violet: { cloth: 0x52356e, dark: 0x271a36, accent: 0xc77dff },
  steel: { cloth: 0x4a5866, dark: 0x22292f, accent: 0x6fd3ff },
};

// Draw once into textures (Phaser redraws Graphics every frame, textures are cheap). Chunks of max. 2048 px.
// stamps: [{ key, frame, x, y }] texture frames drawn on top (tiles from assets), over: graphics drawn after the stamps (edges)
function bake(scene, g, x0, y0, w, h, { depth = 0, scroll = null, stamps = [], over = null } = {}) {
  const C = 2048, rts = [];
  let stamp = null;
  for (let cy = 0; cy < h; cy += C) for (let cx = 0; cx < w; cx += C) {
    const cw = Math.min(C, w - cx), ch = Math.min(C, h - cy);
    const rt = scene.add.renderTexture(x0 + cx, y0 + cy, cw, ch).setOrigin(0).setDepth(depth);
    rts.push(rt);
    rt.draw(g, -(x0 + cx), -(y0 + cy));
    // only the stamps that reach into this chunk, drawn as one batch (big rooms have thousands of tiles)
    const mine = stamps.filter(st => st.x < x0 + cx + cw && st.x + 256 > x0 + cx && st.y < y0 + cy + ch && st.y + 256 > y0 + cy);
    if (mine.length) {
      // in order: plain frames go in one batch, a scaled one (clutter at real size) ends the batch and is drawn on its own
      let open = false;
      for (const st of mine) {
        if (!st.scale) { if (!open) { rt.beginDraw(); open = true; } rt.batchDrawFrame(st.key, st.frame, st.x - x0 - cx, st.y - y0 - cy); continue; }
        if (open) { rt.endDraw(); open = false; }
        stamp ||= scene.make.image({ key: st.key }, false);
        stamp.setTexture(st.key, st.frame).setOrigin(st.ox, st.oy).setScale(st.scale);
        rt.draw(stamp, st.ax - x0 - cx, st.ay - y0 - cy);
      }
      if (open) rt.endDraw();
    }
    if (over) rt.draw(over, -(x0 + cx), -(y0 + cy));
    if (scroll) rt.setScrollFactor(...scroll);
  }
  g.destroy(); over?.destroy(); stamp?.destroy();
  return rts;
}

// painted part of a frame (transparent rows/columns around it), measured once per frame
const boxes = new Map();
function contentBox(scene, key, frame) {
  const id = key + '#' + frame;
  if (boxes.has(id)) return boxes.get(id);
  const f = scene.textures.getFrame(key, frame), w = f.cutWidth, h = f.cutHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(f.source.image, f.cutX, f.cutY, w, h, 0, 0, w, h);
  const a = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const b = x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1, w, h };
  boxes.set(id, b);
  return b;
}
// a clutter stamp standing on the ground at (cx, ground): real height from the set's table Größen, else 1:1 in its cell
function propStamp(scene, kit, key, frame, cx, ground) {
  const cm = kit.sizes.get(key + '#' + frame), b = cm && contentBox(scene, key, frame);
  if (!b) { const f = scene.textures.getFrame(key, frame); return { key, frame, x: cx - f.cutWidth / 2, y: ground - f.cutHeight }; }
  const scale = Math.min(kit.maxScale, cm * kit.pxPerCm / (b.y1 - b.y0)), w = (b.x1 - b.x0) * scale, hh = (b.y1 - b.y0) * scale;
  return { key, frame, scale, ox: (b.x0 + b.x1) / 2 / b.w, oy: b.y1 / b.h, ax: cx, ay: ground, x: cx - w / 2, y: ground - hh };
}

// small deterministic random so the skyline looks the same every time
const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

export function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // particle + nail
  g.fillStyle(0xffffff).fillRect(0, 0, 4, 4); g.generateTexture('px', 4, 4); g.clear();
  g.fillStyle(0xc9d1d9).fillRect(0, 2, 22, 3).fillStyle(0xffffff).fillTriangle(22, 0, 30, 3.5, 22, 7).fillStyle(0x8b949e).fillRect(0, 0, 3, 7);
  g.generateTexture('nail', 30, 7); g.clear();
  g.fillStyle(0xffd27a).fillRect(0, 2, 18, 3).fillStyle(0xff7a3d).fillTriangle(18, 0, 26, 3.5, 18, 7);
  g.generateTexture('nail_enemy', 26, 7); g.clear();
  // placeholder raiders: one texture per color and weapon kind (drawn 120 × 240, scaled to the enemy's height)
  for (const [name, c] of Object.entries(PLACEHOLDER_COLORS)) for (const kind of ['melee', 'gun']) {
    drawRaider(g, c, kind); g.generateTexture(`raider_${kind}_${name}`, 150, 240); g.clear();
  }
  // placeholder blob (ambusher, small vermin) and drone (flyer), faces right
  for (const [name, c] of Object.entries(PLACEHOLDER_COLORS)) {
    drawBlob(g, c); g.generateTexture(`enemy_blob_${name}`, 140, 120); g.clear();
    drawDrone(g, c); g.generateTexture(`enemy_drone_${name}`, 120, 96); g.clear();
  }
  g.destroy();
}

function drawBlob(g, c) {
  g.fillStyle(c.dark).fillEllipse(70, 92, 132, 56);
  g.fillStyle(c.cloth).fillEllipse(70, 76, 120, 80);
  g.fillStyle(c.accent, 0.35).fillEllipse(54, 62, 40, 22);
  for (const [x, y] of [[30, 112], [52, 116], [88, 116], [110, 112]]) g.fillStyle(c.dark).fillTriangle(x - 8, y - 14, x + 8, y - 14, x, y + 4);
  g.fillStyle(0x0d0a12).fillEllipse(104, 84, 34, 16);   // mouth
  g.fillStyle(0xf2efe6).fillTriangle(92, 78, 98, 78, 95, 88).fillTriangle(104, 78, 110, 78, 107, 88).fillTriangle(114, 80, 120, 80, 116, 89);
  g.fillStyle(c.accent).fillCircle(96, 60, 7).fillCircle(116, 62, 5);
  g.fillStyle(0x0d0a12).fillCircle(98, 60, 3).fillCircle(117, 62, 2);
}

function drawDrone(g, c) {
  g.fillStyle(0x1b1d22).fillRect(14, 22, 30, 6).fillRect(76, 22, 30, 6);   // rotor arms
  g.fillStyle(c.accent, 0.5).fillEllipse(22, 18, 40, 8).fillEllipse(98, 18, 40, 8);   // spinning rotors
  g.fillStyle(c.dark).fillRoundedRect(28, 26, 64, 46, 14);
  g.fillStyle(c.cloth).fillRoundedRect(32, 28, 56, 36, 12);
  g.fillStyle(0x0d0a12).fillCircle(78, 48, 13);
  g.fillStyle(c.accent).fillCircle(80, 48, 8);
  g.fillStyle(0xffffff, 0.8).fillCircle(83, 45, 3);
  g.fillStyle(0x6b7280).fillRect(56, 72, 8, 12).fillRect(50, 82, 20, 6);   // gun pod
  g.fillStyle(0xff4060).fillCircle(40, 36, 3);
}

function drawRaider(g, c, kind) {
  const skin = 0x8d6248;
  // legs + boots
  g.fillStyle(c.dark).fillRoundedRect(42, 150, 22, 78, 6).fillRoundedRect(68, 150, 22, 78, 6);
  g.fillStyle(0x1b1d22).fillRoundedRect(38, 222, 30, 18, 4).fillRoundedRect(66, 222, 30, 18, 4);
  // torso: long coat with a belt
  g.fillStyle(c.cloth).fillRoundedRect(34, 70, 64, 96, 14);
  g.fillStyle(c.dark).fillRect(34, 128, 64, 10);
  g.fillStyle(c.accent).fillRect(60, 130, 10, 6);
  // shoulder pad (scrap armor)
  g.fillStyle(0x6b7280).fillRoundedRect(30, 66, 34, 22, 8);
  // arm
  g.fillStyle(c.cloth).fillRoundedRect(70, 78, 20, 56, 8);
  g.fillStyle(skin).fillCircle(84, 136, 9);
  // head: hood + mask + glowing visor (faces right)
  g.fillStyle(c.dark).fillCircle(66, 46, 30);
  g.fillStyle(skin).fillRoundedRect(58, 30, 30, 34, 10);
  g.fillStyle(0x2b2f36).fillRoundedRect(60, 48, 30, 18, 6);
  g.fillStyle(c.accent).fillRect(66, 38, 22, 6);
  g.fillStyle(c.dark).fillTriangle(36, 30, 66, 14, 54, 60);
  if (kind === 'melee') {
    // machete raised behind the hand
    g.fillStyle(0x3d2b1f).fillRect(82, 112, 8, 26);
    g.fillStyle(0xc9d1d9).fillTriangle(84, 112, 96, 112, 120, 36).fillStyle(0xffffff).fillTriangle(92, 110, 96, 112, 118, 40);
  } else {
    // nail gun pointing forward
    g.fillStyle(0x30363d).fillRoundedRect(80, 118, 56, 16, 4).fillRect(88, 130, 12, 18);
    g.fillStyle(c.accent).fillRect(126, 122, 10, 8);
  }
}

// Sky, distant skyline (BigCityDelta), nearer ruins: three layers with parallax
export function drawBackground(scene, roomW, roomH) {
  const [W, H] = [scene.scale.width, scene.scale.height];
  if (scene.textures.exists('sky')) scene.textures.remove('sky');   // the scene restarts (camp ↔ run)
  const sky = scene.textures.createCanvas('sky', 4, H), ctx = sky.getContext();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1030'); grad.addColorStop(0.55, '#5a2a4a'); grad.addColorStop(0.8, '#c4553e'); grad.addColorStop(1, '#f0a35a');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 4, H); sky.refresh();
  scene.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDisplaySize(W, H).setDepth(-100);
  // sun
  scene.add.circle(W * 0.72, H * 0.72, 120, 0xffc477, 0.9).setScrollFactor(0.02).setDepth(-99);
  scene.add.circle(W * 0.72, H * 0.72, 190, 0xffa04a, 0.18).setScrollFactor(0.02).setDepth(-99);
  const layer = (seed, factor, color, base, minH, maxH, windows, depth) => {
    const r = rng(seed), g = scene.make.graphics({}, false);
    const span = W + (roomW - W) * factor + 200;
    for (let x = -100; x < span;) {
      const w = 60 + r() * 140, h = minH + r() * (maxH - minH), top = base - h;
      g.fillStyle(color).fillRect(x, top, w, h + 400);
      if (r() < 0.3) g.fillRect(x + w * 0.4, top - 40 - r() * 60, 6, 60 + r() * 60);   // antenna
      if (windows) for (let wy = top + 14; wy < base - 10; wy += 22) for (let wx = x + 10; wx < x + w - 12; wx += 18)
        if (r() < 0.12) g.fillStyle(r() < 0.5 ? 0x3fe0d0 : 0xff5ab4, 0.55).fillRect(wx, wy, 6, 8).fillStyle(color);
      x += w + r() * 30;
    }
    bake(scene, g, -100, 0, Math.ceil(span + 300), Math.ceil(H + 200), { depth, scroll: [factor, 0.2] });
  };
  layer(7, 0.08, 0x2a1a3a, H * 0.78, 180, 520, true, -98);   // BigCityDelta on the horizon
  layer(13, 0.25, 0x221628, H * 0.92, 80, 260, false, -97);  // ruins in between
  // haze
  scene.add.rectangle(0, H * 0.7, W, H * 0.3, 0xf0a35a, 0.08).setOrigin(0).setScrollFactor(0).setDepth(-96);
  // dark back wall of the room
  scene.add.rectangle(0, 0, roomW, roomH, 0x0d0a12, 0.35).setOrigin(0).setDepth(-90);
}

// Kachel-Sets (data/terrain.json, TileSet00): resolve a set to frames of its icon sheets, once per id.
// → kit { key, over (px the cells reach above the tile), top/fill/fill2 (frame indices), props, pcell, clutter, decals, details, big, def } or null
//   big = { key, cell, list } large clutter (two tiles wide) from its own sheet
export function terrainKits(scene, D) {
  const A = D.assets || {}, cache = new Map();
  return id => {
    if (!id) return null;
    if (cache.has(id)) return cache.get(id);
    const t = D.terrain?.[id], a = A[t?.look], p = A[t?.props], b = A[t?.propsBig];
    let kit = null;
    if (t && a?.kind === 'icons' && a.cell && scene.textures.exists(t.look)) {
      const list = (k, asset) => (t[k] || []).map(n => (asset.names || []).indexOf(n)).filter(i => i >= 0);
      const props = p?.kind === 'icons' && p.cell && scene.textures.exists(t.props);
      kit = { id, def: t, key: t.look, over: Math.max(0, a.cell[1] - a.cell[0]), top: list('top', a), fill: list('fill', a), fill2: list('fill2', a),
        props: props ? t.props : null, pcell: props ? p.cell : null, clutter: props ? list('clutter', p) : [], decals: props ? list('decals', p) : [], details: props ? list('details', p) : [] };
      const big = b?.kind === 'icons' && b.cell && scene.textures.exists(t.propsBig) ? list('bigClutter', b) : [];
      kit.big = big.length ? { key: t.propsBig, cell: b.cell, list: big } : null;
      for (const k of [t.props, kit.big?.key]) if (k) scene.textures.get(k).setFilter(1);   // NEAREST: scaled pixel art stays sharp
      // Größen: real height in cm per clutter name (props and big props), Leyla's height sets the pixels per cm
      kit.sizes = new Map();
      for (const r of t.sizes || []) {
        for (const [k, asset] of [[t.props, p], [t.propsBig, b]]) { const i = (asset?.names || []).indexOf(r.name); if (i >= 0 && r.cm > 0) kit.sizes.set(k + '#' + i, r.cm); }
      }
      const L = A[D.leyla?.look?.idle];
      kit.pxPerCm = (L?.height || 192) / (D.game?.tiles?.leylaCm || 170);
      kit.maxScale = (t.sizeMax || 200) / 100;
      if (!kit.top.length || !kit.fill.length) kit = null;
    }
    cache.set(id, kit);
    return kit;
  };
}
// the same random number for the same tile, every time
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const hexInt = (c, d) => c ? parseInt(String(c).slice(1), 16) : d;

// Tiles of a parsed room: concrete blocks with lit edges, platforms, ladders, rope anchors
// terrain = { at(x, y) → kit | null, back(x, y) → kit | null }: tiles from a Kachel-Set instead of code (walls, back wall in indoor rooms)
// tiles = { platform: textureKey | null } (asset strips: single, left, middle, right)
// style (camp): { ground, top, hide(x, y) } = earth instead of concrete, side walls invisible
export function drawRoom(scene, room, T, tiles = {}, style = null, terrain = null) {
  const g0 = scene.make.graphics({}, false), solid = (x, y) => x < 0 || y < 0 || x >= room.w || y >= room.h || WALLS.has(room.tiles[y][x]) || CAMO.has(room.tiles[y][x]), stamps0 = [];
  // camouflaged tiles: one group per connected patch, each with its own graphics and stamps (poi_level fades or breaks them)
  const camo = [], camoAt = new Map();
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    if (!CAMO.has(room.tiles[y][x]) || camoAt.has(x + ',' + y)) continue;
    const grp = { kind: room.tiles[y][x], tiles: [], g: scene.make.graphics({}, false), edges: scene.make.graphics({}, false), stamps: [] }, todo = [[x, y]];
    camoAt.set(x + ',' + y, grp);
    while (todo.length) {
      const [cx, cy] = todo.pop(); grp.tiles.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
        if (room.tiles[ny]?.[nx] === grp.kind && !camoAt.has(k)) { camoAt.set(k, grp); todo.push([nx, ny]); }
      }
    }
    camo.push(grp);
  }
  const edges0 = scene.make.graphics({}, false), decals0 = [], clutter = [], details0 = [], back = [], backShade = scene.make.graphics({}, false), taken = new Set();
  const r = rng(99);
  // clutter stamp + where it stands, by name (game/play/atmosphere.js finds glowing things)
  const placed = (kit, key, frame, cx, ground) => {
    const st = propStamp(scene, kit, key, frame, cx, ground), f = scene.textures.getFrame(key, frame);
    return { ...st, name: scene.data_?.assets?.[key]?.names?.[frame], kit, cw: f.cutWidth, ch: f.cutHeight };
  };
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    const t0 = room.tiles[y][x], t = WALLS.has(t0) || CAMO.has(t0) ? '#' : t0, px = x * T, py = y * T;
    const cg = camoAt.get(x + ',' + y), g = cg ? cg.g : g0, edges = cg ? cg.edges : edges0, stamps = cg ? cg.stamps : stamps0, details = cg ? cg.stamps : details0, decals = cg ? cg.stamps : decals0;
    const kit = t === '#' && !style ? terrain?.at(x, y) : null;
    if ((t !== '#' || cg) && !style) {   // camouflaged tiles get the back wall behind them (seen once a fake wall fades)
      const bk = terrain?.back?.(x, y);
      if (bk) {
        const list = y % 2 && bk.fill2.length ? bk.fill2 : bk.fill;
        back.push({ key: bk.key, frame: list[x % list.length], x: px, y: py - bk.over });
        backShade.fillStyle(0x060608, (bk.shade ?? 55) / 100).fillRect(px, py, T, T);
      }
    }
    if (cg && t === '#') continue;   // camouflaged: drawn in the cover pass below
    if (kit) {
      const top = !solid(x, y - 1), D = kit.def, seed = D.seed || 0, list = top ? kit.top : y % 2 && kit.fill2.length ? kit.fill2 : kit.fill;
      stamps.push({ key: kit.key, frame: list[x % list.length], x: px, y: py - kit.over });
      // embedded details (stones, pipes, patches) break up the repeating fill
      if (!top && kit.details.length && hash(x, y, seed + 5) * 100 < (D.detailChance ?? 0))
        details.push({ key: kit.props, frame: kit.details[Math.floor(hash(x, y, seed + 6) * kit.details.length)], x: px + (T - kit.pcell[0]) / 2, y: py + (T - kit.pcell[1]) / 2 });
      const faces = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1) || !solid(x - 1, y - 1) || !solid(x + 1, y - 1) || !solid(x - 1, y + 1) || !solid(x + 1, y + 1);
      if (faces && kit.decals.length && hash(x, y, seed + 1) * 100 < (D.decalChance ?? 0))   // decals only where the wall meets the air
        decals.push({ key: kit.props, frame: kit.decals[Math.floor(hash(x, y, seed + 2) * kit.decals.length)], x: px + (T - kit.pcell[0]) / 2, y: py + (T - kit.pcell[1]) / 2 });
      const air = room.tiles[y - 1]?.[x] === '.';
      // large clutter: two surface tiles with air two tiles high above both, walls on the outside
      const free = (xx) => solid(xx, y) && !solid(xx, y - 1) && room.tiles[y - 1]?.[xx] === '.' && room.tiles[y - 2]?.[xx] === '.';
      if (top && !cg && kit.big && !taken.has(x) && free(x) && free(x + 1) && solid(x - 1, y) && solid(x + 2, y) && terrain?.at(x + 1, y) === kit && hash(x, y, seed + 7) * 100 < (D.bigChance ?? 0)) {
        const B = kit.big;
        clutter.push(placed(kit, B.key, B.list[Math.floor(hash(x, y, seed + 8) * B.list.length)], px + T, py + 4));
        taken.add(x); taken.add(x + 1);
      }
      if (top && air && !cg && !taken.has(x) && kit.clutter.length && solid(x - 1, y) && solid(x + 1, y) && hash(x, y, seed + 3) * 100 < (D.clutterChance ?? 0))
        clutter.push(placed(kit, kit.props, kit.clutter[Math.floor(hash(x, y, seed + 4) * kit.clutter.length)], px + T / 2, py + 4));
      // edges from code: shade inside, then the outline (left, right, bottom; the top tile brings its own)
      const E = D.edge || {}, ow = E.width ?? 2, sw = E.shadeWidth ?? 3, sa = (E.shade ?? 40) / 100, oc = hexInt(E.color, 0x060608);
      const side = (open, rx, ry, rw, rh, ix, iy, iw, ih) => { if (!open) return; edges.fillStyle(0x060608, sa).fillRect(ix, iy, iw, ih); edges.fillStyle(oc).fillRect(rx, ry, rw, rh); };
      side(!solid(x - 1, y), px, py, ow, T, px + ow, py, sw, T);
      side(!solid(x + 1, y), px + T - ow, py, ow, T, px + T - ow - sw, py, sw, T);
      side(!solid(x, y + 1), px, py + T - ow, T, ow, px, py + T - ow - sw, T, sw);
      continue;
    }
    if (t === '#' && style) {
      if (style.hide?.(x, y)) continue;
      const base = parseInt(style.ground.slice(1), 16), topC = parseInt(style.top.slice(1), 16);
      g.fillStyle(base).fillRect(px, py, T, T);
      if (r() < 0.3) g.fillStyle(topC, 0.35).fillRect(px + 6 + r() * 40, py + 14 + r() * 40, 8 + r() * 10, 4);   // pebbles
      if (!solid(x, y - 1)) { g.fillStyle(topC).fillRect(px, py, T, 8); for (let i = 0; i < 4; i++) g.fillRect(px + r() * (T - 6), py - 4 - r() * 6, 3, 6 + r() * 4); }
    } else if (t === '#') {
      const shade = 0x24272e + (r() < 0.15 ? 0x050505 : 0);
      g.fillStyle(shade).fillRect(px, py, T, T);
      g.fillStyle(0x1a1c21).fillRect(px, py + T - 3, T, 3).fillRect(px + T - 3, py, 3, T);
      if (r() < 0.25) g.fillStyle(0x2f333b).fillRect(px + 8 + r() * 30, py + 10 + r() * 30, 10 + r() * 14, 3);   // cracks
      if (!solid(x, y - 1)) { g.fillStyle(0x6b7280).fillRect(px, py, T, 6); g.fillStyle(0x3fe0d0, 0.25).fillRect(px, py + 6, T, 2); }
      if (!solid(x - 1, y)) g.fillStyle(0x3a3f48).fillRect(px, py, 4, T);
      if (!solid(x + 1, y)) g.fillStyle(0x3a3f48).fillRect(px + T - 4, py, 4, T);
      if (!solid(x, y + 1)) g.fillStyle(0x111216).fillRect(px, py + T - 6, T, 6);
    } else if (t === '=' && tiles.platform) {
      const l = room.tiles[y][x - 1] === '=', r2 = room.tiles[y][x + 1] === '=';
      stamps.push({ key: tiles.platform, frame: l && r2 ? 2 : r2 ? 1 : l ? 3 : 0, x: px, y: py });
    } else if (t === '=') {
      g.fillStyle(0x7a6235).fillRect(px, py, T, 14).fillStyle(0x4a3b20).fillRect(px, py + 14, T, 4);
      g.fillStyle(0x3b2f1a); for (let i = 6; i < T; i += 12) g.fillRect(px + i, py + 3, 5, 8);
      g.fillStyle(0xd4a72c).fillRect(px, py, T, 2);
    } else if (t === 'H') {
      g.fillStyle(0x7d6a4a).fillRect(px + 12, py, 7, T).fillRect(px + T - 19, py, 7, T);
      g.fillStyle(0xa58e62); for (let i = 8; i < T; i += 21) g.fillRect(px + 12, py + i, T - 24, 6);
    } else if (t === 'o') {
      g.fillStyle(0x6b7280).fillRect(px + T / 2 - 4, py - T, 8, T);
      g.lineStyle(6, 0xb9c0c9).strokeCircle(px + T / 2, py + T / 2, 14);
      g.fillStyle(0xe45aa8, 0.6).fillCircle(px + T / 2, py + T / 2, 5);
    }
  }
  if (back.length) bake(scene, scene.make.graphics({}, false), 0, 0, room.w * T, room.h * T, { depth: -11, stamps: back, over: backShade });
  else backShade.destroy();
  bake(scene, g0, 0, 0, room.w * T, room.h * T, { depth: -10, stamps: [...stamps0, ...details0, ...decals0, ...clutter], over: edges0 });
  // cover: a camouflaged patch also hides the secret behind it (air reachable only through it) plus the ring of wall around,
  // all drawn as solid wall on the patch's layer until it is found or broken (Daniel: „hinter Tiles versteckt“, 4A)
  if (camo.length && !style) {
    const pass = (x, y) => { const t = room.tiles[y]?.[x]; return t != null && !WALLS.has(t) && !CAMO.has(t) && t !== 'B'; };
    const normal = new Set(), q = room.start ? [room.start] : [];
    for (const [x, y] of q) normal.add(x + ',' + y);
    while (q.length) { const [x, y] = q.pop(); for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { const k = nx + ',' + ny; if (!normal.has(k) && pass(nx, ny)) { normal.add(k); q.push([nx, ny]); } } }
    const claimed = new Set();
    for (const c of camo) {
      const cover = new Set(c.tiles.map(([x, y]) => x + ',' + y)), todo = [...c.tiles];
      if (room.start) while (todo.length) {
        const [x, y] = todo.pop();
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          const k = nx + ',' + ny;
          if (cover.has(k) || normal.has(k) || claimed.has(k) || !pass(nx, ny)) continue;
          cover.add(k); claimed.add(k); todo.push([nx, ny]);
        }
      }
      for (const k of [...cover]) { const [x, y] = k.split(',').map(Number); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const kk = (x + dx) + ',' + (y + dy); if (!normal.has(kk) && solid(x + dx, y + dy) && x + dx >= 0 && y + dy >= 0 && x + dx < room.w && y + dy < room.h) cover.add(kk); } }
      c.cover = [...cover].map(k => k.split(',').map(Number));
      const cs = (x, y) => solid(x, y) || cover.has(x + ',' + y);
      for (const [x, y] of c.cover) {
        const px = x * T, py = y * T, kit = terrain?.at(x, y);
        if (kit) {
          const top = !cs(x, y - 1), list = top ? kit.top : y % 2 && kit.fill2.length ? kit.fill2 : kit.fill;
          c.stamps.push({ key: kit.key, frame: list[x % list.length], x: px, y: py - kit.over });
          const E = kit.def.edge || {}, ow = E.width ?? 2, sw = E.shadeWidth ?? 3, sa = (E.shade ?? 40) / 100, oc = hexInt(E.color, 0x060608);
          const side = (open, rx, ry, rw, rh, ix, iy, iw, ih) => { if (!open) return; c.edges.fillStyle(0x060608, sa).fillRect(ix, iy, iw, ih); c.edges.fillStyle(oc).fillRect(rx, ry, rw, rh); };
          side(!cs(x - 1, y), px, py, ow, T, px + ow, py, sw, T);
          side(!cs(x + 1, y), px + T - ow, py, ow, T, px + T - ow - sw, py, sw, T);
          side(!cs(x, y + 1), px, py + T - ow, T, ow, px, py + T - ow - sw, T, sw);
        } else {
          c.g.fillStyle(0x24272e).fillRect(px, py, T, T);
          if (!cs(x, y - 1)) { c.g.fillStyle(0x6b7280).fillRect(px, py, T, 6); c.g.fillStyle(0x3fe0d0, 0.25).fillRect(px, py + 6, T, 2); }
          if (!cs(x - 1, y)) c.g.fillStyle(0x3a3f48).fillRect(px, py, 4, T);
          if (!cs(x + 1, y)) c.g.fillStyle(0x3a3f48).fillRect(px + T - 4, py, 4, T);
          if (!cs(x, y + 1)) c.g.fillStyle(0x111216).fillRect(px, py + T - 6, T, 6);
        }
      }
    }
  }
  for (const c of camo) {
    const all = c.cover || c.tiles, xs = all.map(t => t[0]), ys = all.map(t => t[1]), x0 = (Math.min(...xs) - 1) * T, y0 = (Math.min(...ys) - 1) * T;
    c.rts = bake(scene, c.g, x0, y0, (Math.max(...xs) - Math.min(...xs) + 3) * T, (Math.max(...ys) - Math.min(...ys) + 3) * T, { depth: 10.6, stamps: c.stamps, over: c.edges });
    c.secret = all.filter(([x, y]) => !solid(x, y)).map(([x, y]) => [x, y]);   // the hidden air (the fog keeps it dense)
    delete c.g; delete c.edges; delete c.stamps;
  }
  return { props: clutter, camo };
}

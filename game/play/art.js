// Code-drawn art for the MVP: sky and skyline of BigCityDelta, tiles, placeholder raiders, projectiles, particles.
// Everything is generated at start (no external files). Real AI assets replace the placeholders via "look".

export const PLACEHOLDER_COLORS = {
  rust: { cloth: 0x7a3b2a, dark: 0x3d1f18, accent: 0xff7a3d },
  olive: { cloth: 0x5c6236, dark: 0x2c2f1a, accent: 0xd6e04a },
  violet: { cloth: 0x52356e, dark: 0x271a36, accent: 0xc77dff },
  steel: { cloth: 0x4a5866, dark: 0x22292f, accent: 0x6fd3ff },
};

// Draw once into textures (Phaser redraws Graphics every frame, textures are cheap). Chunks of max. 2048 px.
// stamps: [{ key, frame, x, y }] texture frames drawn on top (tiles from assets)
function bake(scene, g, x0, y0, w, h, { depth = 0, scroll = null, stamps = [] } = {}) {
  const C = 2048;
  for (let cy = 0; cy < h; cy += C) for (let cx = 0; cx < w; cx += C) {
    const cw = Math.min(C, w - cx), ch = Math.min(C, h - cy);
    const rt = scene.add.renderTexture(x0 + cx, y0 + cy, cw, ch).setOrigin(0).setDepth(depth);
    rt.draw(g, -(x0 + cx), -(y0 + cy));
    for (const st of stamps) rt.drawFrame(st.key, st.frame, st.x - x0 - cx, st.y - y0 - cy);
    if (scroll) rt.setScrollFactor(...scroll);
  }
  g.destroy();
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
  g.destroy();
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

// Tiles of a parsed room: concrete blocks with lit edges, platforms, ladders, rope anchors
// tiles = { platform: textureKey | null } (asset strips: single, left, middle, right)
// style (camp): { ground, top, hideEdges } = earth instead of concrete, side walls invisible
export function drawRoom(scene, room, T, tiles = {}, style = null) {
  const g = scene.make.graphics({}, false), solid = (x, y) => room.solid(x, y), stamps = [];
  const r = rng(99);
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    const t = room.tiles[y][x], px = x * T, py = y * T;
    if (t === '#' && style) {
      if (style.hideEdges && (x === 0 || x === room.w - 1) && y < room.h - 2) continue;
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
  bake(scene, g, 0, 0, room.w * T, room.h * T, { depth: -10, stamps });
}

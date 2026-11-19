// Black silhouettes in front of the floors indoors (#043, Daniel 16.11.2026: „Vordergrund-Silhouetten“ like The Looter): rubble,
// crates, a pipe, barrels, rebar. From code, seeded by the level, in Spiel › Vordergrund (Abstand, Höhe, Parallaxe, Deckkraft, Farbe).
// They stand on the front edge of the floor and slide sideways a little faster than the world (scroll factor > 1): closer to the camera.
// Only where the darkness (fog.js) knows indoor air above a floor.

const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function placeForeground(scene) {
  const out = [...placeOutdoor(scene)];   // #115 painted silhouettes under the open sky
  const s = scene, G = s.data_.game?.foreground || {}, f = s.fog;
  if (G.enabled === false || s.mode === 'camp' || !f?.on) return out;
  const R = s.room, T = s.T, w = R.w, h = R.h, rnd = rng((s.levelInfo?.seed ?? s.box?.save?.run?.seed ?? 7) * 977 + 13);
  const [e0, e1] = G.every || [5, 11], [h0, h1] = G.height || [0.4, 1.2], p = (G.parallax ?? 118) / 100;
  const color = parseInt(String(G.color || '#060508').slice(1), 16), alpha = (G.alpha ?? 96) / 100;
  const cam = s.cam || s.cameras.main, zoom = cam.zoom || 1, halfW = cam.width / zoom / 2;
  // floor spots: indoor air (fog kind 1) on solid ground ('#': floors and ledges, no platforms);
  // every floor gets its own row of silhouettes (a room over a tunnel has both)
  const ground = (x, y) => R.tiles[y]?.[x] === '#';
  // #096 (Daniel 19.11.2026: „Vordergrund-Grafiken hängen in der Luft“): a silhouette slides (p − 1) × its distance to the screen
  // centre sideways, at most (p − 1) × half a screen; it keeps that far from the ends of its floor, so it never hangs over a gap
  const margin = Math.ceil(Math.max(0, p - 1) * halfW / T + 0.5);
  for (let y = 1; y < h - 2; y++) {
    let x = 0;
    while (x < w) {
      const at = x0 => f.kind[y * w + x0] === 1 && ground(x0, y + 1);
      if (!at(x)) { x++; continue; }
      let x1 = x; while (x1 < w && at(x1)) x1++;   // one floor stretch [x, x1)
      const a = x + margin, b = x1 - margin;   // the part of the floor where it stays on the floor while in view
      for (let c = a + Math.floor(rnd() * Math.min(e0, Math.max(1, b - a))); c < b; c += e0 + Math.floor(rnd() * (e1 - e0 + 1))) {
        const X = (c + 0.5) * T, Y = (y + 1) * T + T * 0.12, H = (h0 + rnd() * (h1 - h0)) * T, kind = ['rubble', 'rubble', 'crates', 'pipe', 'barrels', 'rebar'][Math.floor(rnd() * 6)];
        const g = s.add.graphics().setDepth(15.8).setScrollFactor(p, 1).setAlpha(alpha);
        g.fillStyle(color, 1);
        shape(g, kind, H, T, rnd, color);
        // with scroll factor p the shape stands at X when the camera is centred there
        g.x = halfW + (X - halfW) * p; g.y = Y;   // parallax only sideways: they stay on the floor
        out.push({ g, kind, x: X, y: Y });
      }
      x = x1;
    }
  }
  return out;
}

// one silhouette, base on y = 0 (it reaches a little below: the floor edge stays covered), x around 0, chunky 4-px steps
function shape(g, kind, H, T, rnd, color) {
  const q = v => Math.round(v / 4) * 4, base = T * 0.6;
  if (kind === 'rubble' || kind === 'rebar') {
    const W = q(T * (1.4 + rnd() * 2.2)), pts = [[-W / 2, base]];
    for (let x = -W / 2; x <= W / 2; x += 12) { const k = 1 - Math.abs(x) / (W / 2); pts.push([q(x), q(-H * (0.25 + 0.75 * Math.sqrt(k)) * (0.75 + rnd() * 0.35))]); }
    pts.push([W / 2, base]);
    g.fillPoints(pts.map(([x, y]) => ({ x, y })), true);
    if (kind === 'rebar') for (let i = 0; i < 3; i++) { const x = q((rnd() - 0.5) * W * 0.6), len = H * (0.6 + rnd() * 0.7), a = (rnd() - 0.5) * 0.9; g.lineStyle(4, color, 1); g.lineBetween(x, -H * 0.4, x + Math.sin(a) * len, -H * 0.4 - Math.cos(a) * len); }
  } else if (kind === 'crates') {
    let x = -q(T * 0.9);
    for (let i = 0; i < 2 + Math.floor(rnd() * 2); i++) { const s = q(T * (0.55 + rnd() * 0.35)), up = i === 1 && rnd() < 0.6; g.fillRect(x, -s - (up ? s : 0), s, s + base + (up ? s : 0)); x += s - 4; }
  } else if (kind === 'pipe') {
    const W = q(T * (2.5 + rnd() * 2)), y = -q(H * 0.7);
    g.fillRect(-W / 2, y, W, 16); g.fillRect(-W / 2 - 4, y - 4, 12, 24); g.fillRect(W / 2 - 8, y - 4, 12, 24);
    g.fillRect(-W / 4, y, 12, base - y); g.fillRect(W / 4, y, 12, base - y);
    g.fillRect(-W / 2, 0, W, base);
  } else {   // barrels
    let x = -q(T * 0.7);
    for (let i = 0; i < 1 + Math.floor(rnd() * 3); i++) { const bw = q(T * 0.5), bh = q(Math.min(H, T * 0.85)); g.fillRoundedRect(x, -bh, bw, bh + base, 6); x += bw + 4; }
  }
}

// #115 (Daniel 19.11.2026: „ein paar schwarze Vordergrund-Formen“, gemalt): under the open sky (no indoor air) the painted silhouettes
// of the run's parallax set (Parallax-Sets › Vordergrund) stand on the floors' front edge, faster than the world, like the ones indoors
function placeOutdoor(scene) {
  const s = scene, D = s.data_, P = D.parallax?.[s.parallaxSet], F = P?.fg, G = D.game?.foreground || {};
  if (!F?.look || G.enabled === false || s.mode === 'camp' || !s.textures.exists(F.look)) return [];
  s.textures.get(F.look).setFilter(Phaser.Textures.FilterMode.NEAREST);
  const R = s.room, T = s.T, w = R.w, h = R.h, f = s.fog, rnd = rng((s.levelInfo?.seed ?? s.box?.save?.run?.seed ?? 7) * 613 + 5);
  const A = D.assets?.[F.look], n = A?.grid ? A.grid[0] * A.grid[1] : 1, cells = String(F.cells || '').split(',').map(t => Number(t.trim()) - 1).filter(v => v >= 0 && v < n);
  const pool = cells.length ? cells : [...Array(n).keys()], p = (F.speed ?? 135) / 100, [g0, g1] = F.gap || [900, 2200], [s0, s1] = F.size || [350, 600];
  const cam = s.cam || s.cameras.main, halfW = cam.width / (cam.zoom || 1) / 2, margin = Math.ceil(Math.max(0, p - 1) * halfW / T + 0.5);
  const air = (x, y) => R.tiles[y]?.[x] !== '#' && !(f?.on && f.kind[y * w + x] >= 1), ground = (x, y) => R.tiles[y]?.[x] === '#';
  const out = [];
  for (let y = 1; y < h - 1; y++) {
    let x = 0;
    while (x < w) {
      const at = x0 => air(x0, y) && ground(x0, y + 1);
      if (!at(x)) { x++; continue; }
      let x1 = x; while (x1 < w && at(x1)) x1++;
      const a = (x + margin) * T, b = (x1 - margin) * T;
      for (let X = a + g0 * rnd(); X < b; X += g0 + (g1 - g0) * rnd()) {
        const fr = pool[Math.floor(rnd() * pool.length)], k = (s0 + (s1 - s0) * rnd()) / 100, Y = (y + 1) * T + (F.drop ?? 40);
        const img = s.add.image(halfW + (X - halfW) * p, Y, F.look, fr).setOrigin(0.5, 1).setScale(k).setFlipX(rnd() < 0.5).setScrollFactor(p, 1).setDepth(15.8).setAlpha((F.alpha ?? 100) / 100);
        out.push({ g: img, kind: 'painted', x: X, y: Y });
      }
      x = x1;
    }
  }
  return out;
}

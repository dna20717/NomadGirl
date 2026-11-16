// Black silhouettes in front of the floors indoors (#043, Daniel 16.11.2026: „Vordergrund-Silhouetten“ like The Looter): rubble,
// crates, a pipe, barrels, rebar. From code, seeded by the level, in Spiel › Vordergrund (Abstand, Höhe, Parallaxe, Deckkraft, Farbe).
// They stand on the front edge of the floor and slide sideways a little faster than the world (scroll factor > 1): closer to the camera.
// Only where the darkness (fog.js) knows indoor air above a floor.

const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function placeForeground(scene) {
  const s = scene, G = s.data_.game?.foreground || {}, f = s.fog;
  if (G.enabled === false || s.mode === 'camp' || !f?.on) return [];
  const R = s.room, T = s.T, w = R.w, h = R.h, rnd = rng((s.levelInfo?.seed ?? s.box?.save?.run?.seed ?? 7) * 977 + 13);
  const [e0, e1] = G.every || [5, 11], [h0, h1] = G.height || [0.4, 1.2], p = (G.parallax ?? 118) / 100;
  const color = parseInt(String(G.color || '#060508').slice(1), 16), alpha = (G.alpha ?? 96) / 100;
  const cam = s.cam || s.cameras.main, zoom = cam.zoom || 1, halfW = cam.width / zoom / 2;
  // floor spots: indoor air (fog kind 1) on solid ground ('#': floors and ledges, no platforms);
  // every floor gets its own row of silhouettes (a room over a tunnel has both)
  const ground = (x, y) => R.tiles[y]?.[x] === '#';
  const out = [];
  for (let y = 1; y < h - 2; y++) {
    let x = 0;
    while (x < w) {
      const at = x0 => f.kind[y * w + x0] === 1 && ground(x0, y + 1);
      if (!at(x)) { x++; continue; }
      let x1 = x; while (x1 < w && at(x1)) x1++;   // one floor stretch [x, x1)
      for (let c = x + Math.floor(rnd() * Math.min(e0, x1 - x)); c < x1 && x1 - x >= 3; c += e0 + Math.floor(rnd() * (e1 - e0 + 1))) {   // short floors get one too
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

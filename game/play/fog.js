// Darkness like The Looter (#043, Daniel 16.11.2026: „Ich mag, wie sie mit nicht sichtbaren Bereichen umgehen. Das gibt dem Ganzen mehr
// Enge und Dichte“; Antworten: ungesehen schwarz, Areale außerhalb des sichtbaren Bereichs auch schwarz, bereits besucht halb transparent
// aber wieder dunkel, besonders die Kacheln außerhalb des beeinflussbaren Bereichs; Wände/Fels schwarze Masse; Rand ausgefranst).
// Before (#011, 11.11.2026) this was a soft fog that stayed open once seen.
// Only indoors (Raum-Bausteine › Innenraum, tunnels). Per tile:
//   air Leyla can reach   → black until seen, clear while in sight, „Besucht“ dark once she looks away
//   a wall next to that air → takes the clearest air beside it, a little darker (the inner edge keeps its texture)
//   everything further from her air (rock, walls ≥ „Masse ab“ tiles deep, air she cannot reach) → black mass
// Drawn in chunks of canvas (Spiel › Nebel › Körnung pixels per tile): alpha between the tile centres, frayed by noise where it changes,
// scaled up sharp (whole pixels, like the art). Only chunks whose tiles changed are drawn again.
import { SOLID_TILES } from '../../engine/room.js';

const CH = 16;   // tiles per chunk

// value noise 0…1 on the canvas pixels (two octaves, fixed: the frayed edge does not crawl)
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export class Fog {
  constructor(scene) {
    const s = scene, R = s.room, F = s.data_.game?.fog || {};
    this.scene = s; this.F = F;
    // under a camouflage cover (art.js) the secret already looks like solid wall: no fog there until it is found or broken
    this.covers = R ? (s.camo || []).map(c => ({ c, cells: new Set((c.cover || []).map(([x, y]) => y * R.w + x)) })) : [];
    this.on = F.enabled !== false && s.mode !== 'camp' && !!R?.start;
    if (!this.on) return;
    const w = R.w, h = R.h, inside = (x, y) => s.terrain?.inside?.(x, y) ?? false;
    const solid = (x, y) => { const t = R.tiles[y]?.[x]; return t == null || (SOLID_TILES.has(t) && t !== 'D') || t === '%'; };
    const pass = (x, y) => { const t = R.tiles[y]?.[x]; return t != null && (!SOLID_TILES.has(t) || t === 'D') && t !== '%'; };
    // reachable without secrets, then with them
    const flood = (seeds, ok) => { const set = new Set(seeds.map(([x, y]) => x + ',' + y)), q = [...seeds]; while (q.length) { const [x, y] = q.pop(); for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { const k = nx + ',' + ny; if (!set.has(k) && ok(nx, ny)) { set.add(k); q.push([nx, ny]); } } } return set; };
    const normal = flood([R.start], pass);
    const any = flood([R.start], (x, y) => { const t = R.tiles[y]?.[x]; return t != null && (pass(x, y) || t === '%' || t === '$' || t === 'B'); });
    // kind: 0 clear (outdoors), 1 normal air, 2 secret air, 3 edge (wall or dead air next to her air), 4 mass
    this.kind = new Uint8Array(w * h);
    const reach = new Uint8Array(w * h);   // any air Leyla can reach, indoors or out
    let cells = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = x + ',' + y, i = y * w + x;
      if (normal.has(k) || (any.has(k) && pass(x, y))) reach[i] = 1;
      if (!inside(x, y)) continue;
      if (normal.has(k)) { this.kind[i] = 1; cells++; } else if (any.has(k) && pass(x, y)) { this.kind[i] = 2; cells++; }
    }
    this.on = cells > 0;
    if (!this.on) return;
    // distance (tiles, 8 neighbours) from her air: 1 = the edge with its texture, from „Masse ab“ on = black mass (indoor tiles only)
    const massFrom = Math.max(1, F.mass ?? 2), dist = new Uint8Array(w * h).fill(255), q = [];
    for (let i = 0; i < w * h; i++) if (reach[i]) { dist[i] = 0; q.push(i); }
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % w, y = (i - x) / w;
      if (dist[i] >= massFrom) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, j = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && dist[j] === 255) { dist[j] = dist[i] + 1; q.push(j); } }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (this.kind[i] || reach[i] || !inside(x, y)) continue;
      this.kind[i] = dist[i] < massFrom && (solid(x, y) || dist[i] === 1) ? 3 : 4;
    }
    // an edge only counts as edge next to fogged air; next to clear outdoor air it stays clear
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (this.kind[i] !== 3) continue;
      let air = false;
      for (let dy = -1; dy <= 1 && !air; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (y + dy) * w + x + dx; if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h && (this.kind[j] === 1 || this.kind[j] === 2)) { air = true; break; } }
      if (!air) this.kind[i] = 0;
    }
    this.w = w; this.h = h;
    this.seen = new Uint8Array(w * h);
    this.vis = new Uint8Array(w * h);
    this.alpha = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) this.alpha[i] = this.kind[i] === 0 ? 0 : 1;
    const col = parseInt(String(F.color || '#07060c').slice(1), 16);
    this.rgb = [col >> 16 & 255, col >> 8 & 255, col & 255];
    // chunks: one canvas each, Körnung pixels per tile (at most 4096 px on a side for the whole level)
    this.g = Math.max(1, Math.min(F.grain ?? 16, Math.floor(4096 / Math.max(w, h)), 32));
    this.cw = Math.ceil(w / CH); this.chh = Math.ceil(h / CH);
    this.chunks = [];
    const T = s.T, stamp = Date.now();
    for (let cy = 0; cy < this.chh; cy++) for (let cx = 0; cx < this.cw; cx++) {
      const tw = Math.min(CH, w - cx * CH), th = Math.min(CH, h - cy * CH);
      let any4 = false;
      for (let y = 0; y < th && !any4; y++) for (let x = 0; x < tw; x++) if (this.kind[(cy * CH + y) * w + cx * CH + x]) { any4 = true; break; }
      if (!any4) { this.chunks.push(null); continue; }
      const tex = s.textures.createCanvas(`fog_${stamp}_${cx}_${cy}`, tw * this.g, th * this.g);
      tex.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
      const ctx = tex.getContext(), img = ctx.createImageData(tw * this.g, th * this.g);
      const sprite = s.add.image(cx * CH * T, cy * CH * T, tex.key).setOrigin(0).setDisplaySize(tw * T, th * T).setDepth(15.5);
      this.chunks.push({ cx, cy, tw, th, tex, ctx, img, sprite, dirty: true });
    }
    this.next = 0;
    this.reveal(true);
    this.draw(1);
  }

  opaque(x, y) {
    const t = this.scene.room.tiles[y]?.[x];
    if (t == null) return true;
    if (t === '%') return !!this.scene.level?.hides(x, y);
    return SOLID_TILES.has(t);
  }
  // sight lines from Leyla's eyes (Spiel › Nebel › Sicht in tiles): what they reach is visible now and seen for good; a wall that stops a line too
  reveal(force = false) {
    if (!this.on) return;
    const s = this.scene, l = s.leyla, T = s.T, now = s.now ?? 0;
    if (!force && now < this.next) return;
    this.next = now + 90;
    const r = (this.F.sight ?? 11) * T, ex = l.x, ey = l.feet - l.height * 0.75, w = this.w, rays = 160, step = T / 3;
    this.vis.fill(0);
    const mark = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < this.h) { const i = y * w + x; this.vis[i] = 1; this.seen[i] = 1; } };
    // close around her: always
    const cx = Math.floor(l.x / T), cy = Math.floor((l.feet - 4) / T);
    for (let dy = -2; dy <= 0; dy++) for (let dx = -1; dx <= 1; dx++) mark(cx + dx, cy + dy);
    for (let a = 0; a < rays; a++) {
      const dx = Math.cos(a / rays * Math.PI * 2), dy = Math.sin(a / rays * Math.PI * 2);
      for (let d = 0; d <= r; d += step) {
        const tx = Math.floor((ex + dx * d) / T), ty = Math.floor((ey + dy * d) / T);
        mark(tx, ty);
        if (this.opaque(tx, ty)) break;
      }
    }
  }
  update(dt) {
    if (!this.on) return;
    this.reveal();
    this.draw(Math.min(1, dt / (this.F.fade ?? 450)));
  }
  // what a tile wants: in sight clear, seen „Besucht“, never seen „Ungesehen“ (behind secrets „Hinter Secrets“), mass black
  target(i) {
    const kd = this.kind[i], F = this.F;
    if (kd === 1 || kd === 2) return this.vis[i] ? 0 : this.seen[i] ? (F.remembered ?? 60) / 100 : (kd === 1 ? F.density ?? 100 : F.secretDensity ?? 100) / 100;
    return kd === 4 ? 1 : 0;
  }
  // fade toward the target; the edge follows the clearest air next to it, a little darker (Spiel › Nebel › Kante)
  draw(k) {
    const hidden = new Set();
    for (const { c, cells } of this.covers) if (c.rts?.[0]?.active && (c.rts[0].alpha ?? 1) > 0.5) for (const i of cells) hidden.add(i);
    const { w, h, kind, alpha } = this, edge = (this.F.walls ?? 45) / 100;
    const shown = this.shown ??= new Float32Array(w * h).fill(-1), dirty = new Set();
    for (let i = 0; i < w * h; i++) {
      const kd = kind[i];
      if (kd !== 1 && kd !== 2) continue;
      const t = this.target(i);
      if (alpha[i] !== t) alpha[i] += Math.sign(t - alpha[i]) * Math.min(Math.abs(t - alpha[i]), k);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, kd = kind[i];
      let a;
      if (hidden.has(i)) a = 0;
      else if (kd === 1 || kd === 2) a = alpha[i];
      else if (kd === 3) {
        let m = 1;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (y + dy) * w + x + dx; if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h && (kind[j] === 1 || kind[j] === 2)) m = Math.min(m, alpha[j]); }
        a = m + (1 - m) * edge;
      } else a = kd === 4 ? 1 : 0;
      if (Math.abs(shown[i] - a) > 0.004) { shown[i] = a; dirty.add(Math.floor(y / CH) * this.cw + Math.floor(x / CH)); if (x % CH === 0 && x) dirty.add(Math.floor(y / CH) * this.cw + Math.floor(x / CH) - 1); if (y % CH === 0 && y) dirty.add((Math.floor(y / CH) - 1) * this.cw + Math.floor(x / CH)); }
    }
    for (const n of dirty) { const c = this.chunks[n]; if (c) this.paint(c); }
  }
  // one chunk: alpha between the tile centres, frayed by the noise where neighbouring tiles differ, then hard (no half pixels at the rim)
  paint(c) {
    const { w, h, g, shown } = this, d = c.img.data, [r0, g0, b0] = this.rgb, rag = (this.F.ragged ?? 70) / 100;
    const at = (x, y) => shown[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
    const W = c.tw * g, H = c.th * g, ox = c.cx * CH, oy = c.cy * CH;
    for (let py = 0; py < H; py++) {
      const fy = oy + (py + 0.5) / g - 0.5, ty = Math.floor(fy), vy = fy - ty;
      for (let px = 0; px < W; px++) {
        const fx = ox + (px + 0.5) / g - 0.5, tx = Math.floor(fx), vx = fx - tx;
        const a00 = at(tx, ty), a10 = at(tx + 1, ty), a01 = at(tx, ty + 1), a11 = at(tx + 1, ty + 1);
        let a = (a00 * (1 - vx) + a10 * vx) * (1 - vy) + (a01 * (1 - vx) + a11 * vx) * vy;
        const spread = Math.max(a00, a10, a01, a11) - Math.min(a00, a10, a01, a11);
        if (spread > 0.02 && rag > 0) {   // a frayed rim like charred paper: noise moves the edge, then a steep curve makes it crisp
          const gx = (ox * g + px), gy = (oy * g + py), n = 0.65 * vnoise(gx / (g * 0.55), gy / (g * 0.55)) + 0.35 * vnoise(gx / (g * 0.18), gy / (g * 0.18));
          a += (n - 0.5) * rag * spread * 1.6;
          const lo = Math.min(a00, a10, a01, a11), hi = lo + spread, m = (a - lo) / spread;
          a = lo + spread * Math.max(0, Math.min(1, (m - 0.5) * (1 + rag * 3) + 0.5));
        }
        const o = (py * W + px) * 4;
        d[o] = r0; d[o + 1] = g0; d[o + 2] = b0; d[o + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
      }
    }
    c.ctx.putImageData(c.img, 0, 0);
    c.tex.refresh();
  }
  // a point under a camouflage cover that is still closed (lamps in secrets stay dark, game/play/atmosphere.js)
  hiddenAt(x, y) {
    const T = this.scene.T, i = Math.floor(y / T) * (this.scene.room.w) + Math.floor(x / T);
    return (this.covers || []).some(({ c, cells }) => c.rts?.[0]?.active && (c.rts[0].alpha ?? 1) > 0.5 && cells.has(i));
  }
  // darkness at a point: air its own (also under a closed camouflage cover, where nothing is drawn), anything else as drawn
  at(x, y) { const T = this.scene.T, i = Math.floor(y / T) * this.w + Math.floor(x / T), kd = this.kind?.[i]; return this.on ? +((kd === 1 || kd === 2 ? this.alpha[i] : this.shown?.[i] ?? this.alpha[i]) ?? 0).toFixed(2) : 0; }
  state() {
    if (!this.on) return { on: false };
    let seen = 0, total = 0, visible = 0, mass = 0;
    for (let i = 0; i < this.kind.length; i++) { const kd = this.kind[i]; if (kd === 1 || kd === 2) { total++; if (this.seen[i]) seen++; if (this.vis[i]) visible++; } if (kd === 4) mass++; }
    return { on: true, seen, total, visible, mass, secret: [...this.kind].filter(k => k === 2).length };
  }
}

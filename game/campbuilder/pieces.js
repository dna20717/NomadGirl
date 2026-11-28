// CampBuilder v2 (#196): pieces from the camp kit (Werkstatt › RIG › Deko, art „Bild mit Varianten“ and „Bild aus einem Symbol-Raster“):
// placed, moved, grown and coloured (Daniel, 28.11.2026: „Dinge bauen, verschieben oder vergrößern“, Farbrad). A lean drawing of its own,
// ported from game/play/camp_decor.js (modGeo, drawModular, drawStack, kitContent) without the camp's state, so the CampBuilder stays a
// module of its own: grown pieces are crops of their cell (head, n middle sections, foot), a stack is n cells on top of each other.
// Pieces with light (Deko › Effekt / extra light) glow when the sun is down.
import { paintPixels } from '../play/camp.js';

const ARTS = new Set(['sprite', 'icon']);
const HANG = new Set(['wall', 'inside', 'climb']);
// the pieces that can be built here, in the order of the Deko area
export function catalog(D) {
  const A = D.assets || {};
  return Object.entries(D.decor || {}).filter(([, d]) => ARTS.has(d.art) && d.look && A[d.look]?.kind === 'icons' && !d.retired)
    .map(([id, d]) => ({ id, d, name: d.name || id, hang: HANG.has(d.place) }));
}

export class Pieces {
  constructor(scene) { this.s = scene; this.D = scene.data_; this.objs = []; this.content = new Map(); this.glows = []; }
  def(id) { return this.D.decor?.[id] || null; }
  cells(d) { const a = this.D.assets?.[d.look]; return a?.grid ? a.grid[0] * a.grid[1] : 1; }
  frame(d, p) { const n = this.cells(d); if (d.grow === 'steps') return Math.max(0, Math.min(n - 1, p.n ?? d.growStart ?? 0)); const v = (p.v ?? 0) + (d.variant || 0); return ((v % n) + n) % n; }
  scale(d) {
    if (d.art === 'icon') { const c = this.kc(d.look, 0); return c ? ((d.size?.[1] ?? 1.6) * 64 + 8) / c.h : 1; }
    return (d.scale || 100) / 100;
  }
  growOf(d, p) {
    if (!d?.grow || d.grow === 'steps') return null;
    const lim = (r, v, def) => { const [lo, hi] = r || [0, 4]; return Math.max(lo, Math.min(hi, Math.round(v ?? def))); };
    return { n: lim(d.growRange, p.n, d.growStart ?? 1), m: lim(d.growRange2, p.m, d.growStart2 ?? 1) };
  }
  range(d) { return d.grow === 'steps' ? [0, this.cells(d) - 1] : d.growRange || [0, 4]; }
  // painted height of a frame (its cell may have air above the head), measured once
  kc(key, frame) {
    const id = key + ':' + frame;
    if (this.content.has(id)) return this.content.get(id);
    const f = this.s.textures.getFrame(key, frame);
    if (!f) return null;
    let top = f.height;
    try {
      const W = f.cutWidth, H = f.cutHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(f.source.image, f.cutX, f.cutY, W, H, 0, 0, W, H);
      const a = g.getImageData(0, 0, W, H).data;
      outer: for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 2) if (a[(y * W + x) * 4 + 3] > 40) { top = y; break outer; }
    } catch { /* full cell */ }
    const out = { h: f.height - top, w: f.width, fh: f.height };
    this.content.set(id, out);
    return out;
  }
  // a sheet in a colour, made once (the camp's brush: bright accents stay, CampBuilder › Farbe)
  look(d, hex) {
    if (!hex) return d.look;
    const s = this.s, out = `${d.look}__cb${hex.slice(1)}`;
    if (s.textures.exists(out)) return out;
    const src = s.textures.get(d.look), img = src.getSourceImage(), tex = s.textures.createCanvas(out, img.width, img.height), ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0); paintPixels(ctx, img.width, img.height, hex, this.D.campbuilder?.paint || this.D.camp?.paint); tex.refresh();
    for (const n of src.getFrameNames()) { const f = src.get(n); tex.add(n, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return out;
  }
  // geometry of a grown piece in picture pixels
  geo(d, p, fr) {
    const f = this.s.textures.getFrame(d.look, fr), g = this.growOf(d, p) || { n: 1, m: 1 }, S = (d.slices || [])[fr] || (d.slices || [])[0] || {};
    const sl = { y: S.y0 != null ? [S.y0, S.y1] : null, x: S.x0 != null ? [S.x0, S.x1] : null };
    const ny = d.grow === 'up' ? g.n : d.grow === 'side' ? g.m : 1, nx = d.grow === 'side' ? g.n : 1;
    const py = sl.y ? sl.y[1] - sl.y[0] : 0, px = sl.x ? sl.x[1] - sl.x[0] : 0;
    return { f, sl, nx, ny, W: f.width + (sl.x ? (nx - 1) * px : 0), H: f.height + (sl.y ? (ny - 1) * py : 0) };
  }
  // one piece into a container: feet (or middle when it hangs) at (p.x, p.y) → { box, x0, x1, y0, y1 }
  draw(p, { alpha = 1, depth = -9.5 } = {}) {
    const s = this.s, d = this.def(p.id);
    if (!d || !s.textures.exists(d.look)) return null;
    s.textures.get(d.look).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const fr = this.frame(d, p), k = this.scale(d), key = this.look(d, p.c), hang = HANG.has(d.place), flip = !!(d.flip && p.f);
    const box = s.add.container(Math.round(p.x), Math.round(p.y)).setDepth(depth).setAlpha(alpha);
    const c = this.kc(d.look, fr) || { h: 64, fh: 64, w: 64 };
    let w, h;
    if (d.grow === 'stack') {
      const n = this.growOf(d, p).n || 1, nv = this.cells(d);
      let yy = 0; w = 0;
      for (let j = 0; j < n; j++) {
        const v = (fr + j * 3) % nv, cc = this.kc(d.look, v), f = s.textures.getFrame(d.look, v);
        box.add(s.add.image(j ? Math.round(((j * 7919) % 11) - 5) : 0, yy, key, v).setOrigin(0.5, 1).setScale(k).setFlipX(j % 2 ? !flip : flip));
        yy -= (cc?.h ?? f.height) * k - 2; w = Math.max(w, f.width * k);
      }
      h = -yy;
    } else if (d.grow === 'up' || d.grow === 'side') {
      const G = this.geo(d, p, fr), tex = s.textures.get(key), F = G.f;
      const segs = (len, sl, n) => { if (!sl) return [[0, len, 0]]; const out = [[0, sl[0], 0]], q = sl[1] - sl[0]; for (let j = 0; j < n; j++) out.push([sl[0], sl[1], sl[0] + j * q]); out.push([sl[1], len, sl[0] + n * q]); return out.filter(r => r[1] > r[0]); };
      const inner = s.add.container(0, hang ? (G.H - (c.fh - c.h)) * k / 2 : 0);
      for (const [y0, y1, ty] of segs(F.height, G.sl.y, G.ny)) for (const [x0, x1, tx] of segs(F.width, G.sl.x, G.nx)) {
        const name = `m:${fr}:${x0},${y0},${x1 - x0},${y1 - y0}`;
        if (!tex.has(name)) tex.add(name, 0, F.cutX + x0, F.cutY + y0, x1 - x0, y1 - y0);
        inner.add(s.add.image(tx - G.W / 2, ty - G.H, key, name).setOrigin(0, 0));
      }
      inner.setScale(flip ? -k : k, k); box.add(inner);
      w = G.W * k; h = (G.H - (c.fh - c.h)) * k;
    } else {
      box.add(s.add.image(0, hang ? c.h * k / 2 : 0, key, fr).setOrigin(0.5, 1).setScale(k).setFlipX(flip));
      w = c.w * k; h = c.h * k;
    }
    // a soft contact shadow under standing pieces
    if (!hang && d.shadow !== false) { const g = s.add.graphics(); g.fillStyle(0x060608, 0.28).fillEllipse(0, -1, w * 0.8, 7); box.addAt(g, 0); }
    const y1 = hang ? p.y + h / 2 : p.y;
    return { box, d, x0: p.x - w / 2, x1: p.x + w / 2, y0: y1 - h, y1, light: d.extra === 'light' || /light|flame/i.test(d.effect || '') || String(d.tags || '').includes('licht') };
  }
  // all pieces anew (a handful; the one just changed springs a little)
  rebuild(list, spring = -1) {
    for (const o of this.objs) o?.box.destroy();
    for (const g of this.glows) g.destroy();
    this.objs = list.map(p => this.draw(p)); this.glows = [];
    this.objs.forEach((o, i) => {
      if (!o) return;
      if (o.light) { const g = this.s.add.image((o.x0 + o.x1) / 2, o.y0 + (o.y1 - o.y0) * 0.25, 'cb_glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(51).setScale(Math.max(1.2, (o.x1 - o.x0) / 60)); g.base = g.scale; this.glows.push(g); }
      if (i === spring) { o.box.setScale(1.14, 0.84); this.s.tweens.add({ targets: o.box, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.Out', easeParams: [2.6] }); }
    });
  }
  // the topmost piece under a point (index) or -1
  hit(x, y, pad = 6) { for (let i = this.objs.length - 1; i >= 0; i--) { const o = this.objs[i]; if (o && x >= o.x0 - pad && x <= o.x1 + pad && y >= o.y0 - pad && y <= o.y1 + pad) return i; } return -1; }
  // lights come on at dusk, flicker a little
  update(time, dark) {
    const a = Math.max(0, Math.min(1, (dark - 0.15) * 1.8));
    this.glows.forEach((g, i) => g.setAlpha(a * (0.85 + 0.15 * Math.sin(time / 90 + i * 2.3) * Math.sin(time / 37 + i))).setScale(g.base * (1 + 0.03 * Math.sin(time / 300 + i))));
  }
}

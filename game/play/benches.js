// Workshops with a look, inside the rig (Werkstätten › Aussehen im Rig, Licht & Effekte):
// the picture stands on the interior floor, fitted into its place; a storage with "Aussehen leer" fills up shelf by shelf
// (bottom first) with how full its inventory is; cosy code effects sit on top of the picture: lights, screens, steam, smoke,
// sparks, flames, LEDs, fairy lights, bubbles, fish, a lava lamp, a 3D-printer head and a glint over the guns.
// Every effect is placed in pixels of the picture and can wait for the evening, for Leyla coming close or for being used.
// Also: the packed crates on the scrapyard and the workshop picture on its own (in the hand while building, in the van).
import { occupancy } from '../inventory.js';

const col = c => parseInt(String(c || '#ffffff').slice(1), 16);
const rnd = (a, b) => a + Math.random() * (b - a);
const GLOW = 'camp_glow';

function glowKey(scene) {
  if (scene.textures.exists(GLOW)) return GLOW;
  const t = scene.textures.createCanvas(GLOW, 256, 256), c = t.getContext(), g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256); t.refresh();
  return GLOW;
}

// where a picture has pixels (cached on the texture), plus its pixels for the fairy-light finder
export function pictureBox(scene, key) {
  const tex = scene.textures.get(key);
  if (tex.benchBox) return tex.benchBox;
  const img = tex.getSourceImage(), w = img.width, h = img.height, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return (tex.benchBox = { x0, y0, x1: x1 + 1, y1: y1 + 1, w, h, data: d });
}

const lookOf = (scene, D, def) => def?.look && D.assets?.[def.look] && scene.textures.exists(def.look) ? def.look : null;
const footOf = (D, key, box) => { const o = D.assets?.[key]?.origin; return o ? [o[0], o[1]] : [(box.x0 + box.x1) / 2, box.y1]; };

// the workshop on its own: the picture trimmed to its pixels, w wide at most (and h high at most), on a canvas
export function benchTexture(scene, D, id, w, h) {
  const def = D.workshops?.[id], key = lookOf(scene, D, def);
  if (!key) return null;
  const tk = `ws_pic_${id}_${Math.round(w)}_${Math.round(h)}`;
  if (scene.textures.exists(tk)) return tk;
  const b = pictureBox(scene, key), [, fy] = footOf(D, key, b), bw = b.x1 - b.x0, bh = fy - b.y0, k = Math.min(w / bw, h / bh);
  const t = scene.textures.createCanvas(tk, Math.ceil(bw * k), Math.ceil((b.y1 - b.y0) * k)), c = t.getContext();
  c.imageSmoothingEnabled = k < 1;
  c.drawImage(scene.textures.get(key).getSourceImage(), b.x0, b.y0, bw, b.y1 - b.y0, 0, 0, bw * k, (b.y1 - b.y0) * k);
  t.refresh();
  return tk;
}

// a packed workshop on the scrapyard: a crate with a label carrying the workshop's name (Camp › Verpackte Werkstätten).
// With a picture (yard.crate.look) the name goes on its label, otherwise a crate from code.
export function crateTexture(scene, D, id) {
  const C = D.camp?.yard?.crate || {}, def = D.workshops?.[id] || {}, n = def.places || 1, H = C.height ?? 100, name = def.name || id;
  const key = `ws_crate_${id}_${H}_${C.look || ''}`;
  if (scene.textures.exists(key)) return key;
  const pic = C.look && scene.textures.exists(C.look) ? scene.textures.get(C.look).getSourceImage() : null;
  const k = pic ? H / pic.height : 1, W = pic ? Math.round(pic.width * k * (0.65 + 0.35 * n)) : Math.round(H * (1.05 + 0.75 * (n - 1)) + 30);
  const t = scene.textures.createCanvas(key, W, H), c = t.getContext();
  let label;
  if (pic) {
    c.imageSmoothingEnabled = k < 1;
    c.drawImage(pic, 0, 0, W, H);
    const [lx, ly] = C.labelAt || [pic.width / 2, pic.height / 2], [lw, lh] = C.labelSize || [pic.width * 0.5, pic.height * 0.25], kx = W / pic.width;
    label = { x: lx * kx, y: ly * k, w: lw * kx, h: lh * k };
  } else {
    // planks, darker edges, steel corners, stencilled arrows; the paper label in the middle
    const f = (x, y, w, h, s) => { c.fillStyle = s; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    f(0, 4, W, H - 4, '#2e2218');
    f(4, 8, W - 8, H - 14, '#7a5a3a');
    for (let y = 8; y < H - 8; y += 18) { f(4, y, W - 8, 2, '#5c4128'); f(4, y + 2, W - 8, 1, '#8f6c48'); }
    f(4, 8, W - 8, 8, '#5c4128'); f(4, H - 14, W - 8, 8, '#5c4128');
    f(4, 8, 10, H - 14, '#5c4128'); f(W - 14, 8, 10, H - 14, '#5c4128');
    for (const [x, y] of [[0, 4], [W - 16, 4], [0, H - 16], [W - 16, H - 16]]) { f(x, y, 16, 16, '#30363d'); f(x + 5, y + 5, 4, 4, '#8b949e'); }
    c.fillStyle = 'rgba(20,14,10,0.55)'; c.font = '18px VT323, monospace'; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText('↑↑', 20, 20);
    c.fillText('FRAGIL', W - 70, H - 34);
    label = { x: W / 2, y: H * 0.48, w: Math.min(W - 44, 150 + 60 * (n - 1)), h: 40 };
    f(label.x - label.w / 2 + 3, label.y - label.h / 2 + 3, label.w, label.h, 'rgba(0,0,0,0.35)');
    f(label.x - label.w / 2, label.y - label.h / 2, label.w, label.h, '#e9dcc0');
    f(label.x - label.w / 2, label.y - label.h / 2, label.w, 5, '#c9b896');
    f(label.x - 10, label.y - label.h / 2 - 4, 20, 8, 'rgba(230,220,180,0.7)');   // tape
  }
  // the name on the label, as big as fits
  let size = C.fontSize ?? 24;
  c.fillStyle = C.ink || '#2a1d14'; c.textAlign = 'center'; c.textBaseline = 'middle';
  do { c.font = `${size}px VT323, monospace`; } while (c.measureText(name).width > label.w - 8 && --size > 10);
  c.fillText(name, label.x, label.y + 1);
  t.refresh();
  return key;
}

// how full an inventory is: occupied cells / all cells
export function fillOf(D, grid) {
  if (!grid?.w || !grid?.h) return 0;
  return Math.min(1, occupancy(D, grid).size / (grid.w * grid.h));
}

// ---------- benches in the rig ----------
// One manager per camp: add() places a workshop picture into a unit's view and remembers its effects; update() animates them.
export class Benches {
  constructor(camp) {
    this.camp = camp; this.scene = camp.scene; this.D = camp.D;
    this.list = []; this.objs = [];
    const s = this.scene;
    // screens, LEDs, sparks, bubbles … sit right in front of the pictures and behind Leyla (depth 10); the night shade lies over
    // them, so they are boosted by the same amount (glow()). Only the big room lights (kind "light") shine over everything.
    this.add_ = s.add.graphics().setDepth(-19.9).setBlendMode(Phaser.BlendModes.ADD);
    this.flat = s.add.graphics().setDepth(-19.93);                                      // fish (under the night like the picture)
    this.puffs = [];
    this.sparks = [];
  }
  destroy() {
    for (const o of this.objs) o.destroy();
    for (const p of this.puffs) p.img.destroy();
    this.add_.destroy(); this.flat.destroy();
    this.list = []; this.objs = []; this.puffs = [];
  }
  glow(x, y, color, blend = Phaser.BlendModes.ADD, depth = -19.92) {
    const g = this.scene.add.image(x, y, glowKey(this.scene)).setTint(col(color)).setBlendMode(blend).setDepth(depth).setAlpha(0);
    this.objs.push(g);
    return g;
  }
  // a workshop picture in a place: x0 = left end in the world, w = width of its places, floor = interior floor, h = interior height.
  // Returns false without a look (then the camp draws its code furniture).
  add({ id, place, x0, w, floor, h, view, mid, G, grid, clip, unitScale = 1 }) {
    const s = this.scene, D = this.D, def = D.workshops?.[id] || {}, key = lookOf(s, D, def);
    if (!key) return false;
    const b = pictureBox(s, key), [fx, fy] = footOf(D, key, b);
    // one scale for all pictures (Camp › Rig-Ansicht › Maßstab der Werkstatt-Bilder), corrected per workshop (Maßstab %);
    // without it every picture is fitted into its place
    // and per container (Container › Maßstab der Werkstätten, Daniel 09.11.2026: in den hohen Hochseecontainern wirkten sie zu klein)
    const one = this.camp.C.rig?.benchScale, k = one ? one * (def.scale ?? 100) / 100 * unitScale : Math.min(w * (def.fit ?? 100) / 100 / (b.x1 - b.x0), h * 1.02 / Math.max(1, fy - b.y0)), cx = x0 + w / 2;
    const at = (ix, iy) => [cx + (ix - (b.x0 + b.x1) / 2) * k, floor + (iy - fy) * k];
    // pixel magic: nothing reaches past the place it stands in (clip = interior of the container, this place's span); a picture
    // is cut at whole picture pixels
    const C0 = clip || { x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity };
    const img = tk => {
      const src = s.textures.get(tk).getSourceImage(), ox = (b.x0 + b.x1) / 2, i = s.add.image(cx - mid, floor - G, tk).setOrigin(ox / src.width, fy / src.height).setScale(k);
      const left = cx - ox * k, top = floor - fy * k;
      i.clipBox = { x: Math.max(0, Math.ceil((C0.x0 - left) / k)), y: Math.max(0, Math.ceil((C0.y0 - top) / k)), x1: Math.min(src.width, Math.floor((C0.x1 - left) / k)), y1: Math.min(src.height, Math.floor((C0.y1 - top) / k)) };
      i.cropTo = (y = 0) => { const c = i.clipBox, yy = Math.max(y, c.y); i.setCrop(c.x, yy, Math.max(0, c.x1 - c.x), Math.max(0, c.y1 - yy)); };
      i.cropTo(0);
      view.add(i);
      return i;
    };
    const bench = { id, place, def, cx, x0: Math.max(C0.x0, cx - (b.x1 - b.x0) * k / 2), x1: Math.min(C0.x1, cx + (b.x1 - b.x0) * k / 2), floor, top: Math.max(C0.y0, floor - (fy - b.y0) * k), k, at, grid, fx: [], s: {}, clip: C0 };
    // a storage that fills up: the empty picture below, the full one cut to the filled shelves
    const empty = def.lookEmpty && s.textures.exists(def.lookEmpty) ? def.lookEmpty : null;
    if (empty && grid) {
      bench.empty = img(empty);
      bench.full = img(key);
      bench.edges = (def.fill || []).map(r => r.y).filter(v => v != null).sort((a, c) => a - c);
      if (!bench.edges.length) bench.edges = [0];
      bench.fill = -1;
      this.refill(bench);
    } else img(key);
    // effects whose spot was cut away stay out
    (def.fx || []).forEach((r, i) => { const [ex, ey] = at((r.x || 0) + (r.w || 1) / 2, (r.y || 0) + (r.h || 1) / 2); if (ex >= C0.x0 && ex <= C0.x1 && ey >= C0.y0 && ey <= C0.y1) bench.fx.push(this.effect(bench, r, i)); });
    this.list.push(bench);
    return bench;
  }
  // shelves: the full picture from the topmost filled shelf down
  refill(bench) {
    const save = this.camp.box.save, f = fillOf(this.D, save.inv?.grids?.[bench.grid]);
    if (Math.abs(f - bench.fill) < 1e-6) return;
    bench.fill = f;
    const E = bench.edges, n = f <= 0 ? 0 : Math.max(1, Math.ceil(f * E.length - 1e-9));
    bench.full.setVisible(n > 0);
    if (n > 0) bench.full.cropTo(E[E.length - n]);
    bench.shelves = n;
  }
  // one row of "Licht & Effekte" → a little live object
  effect(bench, r, i) {
    const k = bench.k, [x, y] = bench.at(r.x || 0, r.y || 0), w = (r.w || 1) * k, h = (r.h || 1) * k, e = { r, x, y, w, h, cx: x + w / 2, cy: y + h / 2, ph: Math.random() * 10, s: r.when && r.when !== 'always' ? (r.idle ?? 0) / 100 : 1, i };
    const kind = r.kind;
    if (kind === 'light' || kind === 'lava' || kind === 'flame') {
      const rad = (r.size || 40) * k;
      e.glow = this.glow(e.cx, e.cy, r.color || '#ffcf7a', Phaser.BlendModes.ADD, kind === 'light' ? 31 : -19.92).setDisplaySize(w + rad * 2, h + rad * 2);
    }
    if (kind === 'sparks') e.glow = this.glow(e.cx, e.cy, r.color || '#ffb347').setDisplaySize(110 * k, 110 * k);
    if (kind === 'screen') e.glow = this.glow(e.cx, e.cy, r.color || '#3fe0d0').setDisplaySize(w * 2.6 + 30 * k, h * 2.6 + 30 * k);
    if (kind === 'steam' || kind === 'smoke' || kind === 'bubbles') e.acc = Math.random();
    if (kind === 'fish') e.fish = Array.from({ length: Math.max(1, Math.round(r.rate || 2)) }, (_, j) => ({ x: rnd(0, w), y: rnd(h * 0.15, h * 0.85), d: Math.random() < 0.5 ? -1 : 1, v: rnd(6, 14) * k, c: [0xff9a3d, 0xffd24a, 0x3fe0d0, 0xff6a8a][j % 4], turn: 0 }));
    if (kind === 'bubbles') e.list = [];
    if (kind === 'twinkle') {
      // the bright, colourful pixels in the area are the bulbs / LEDs (in 3 × 3 picture-pixel cells)
      const key = bench.def.look, P = pictureBox(this.scene, key), seen = new Map();
      for (let yy = r.y; yy < r.y + (r.h || 1); yy++) for (let xx = r.x; xx < r.x + (r.w || 1); xx++) {
        if (xx < 0 || yy < 0 || xx >= P.w || yy >= P.h) continue;
        const o = (yy * P.w + xx) * 4, R = P.data[o], Gg = P.data[o + 1], B = P.data[o + 2], A = P.data[o + 3], mx = Math.max(R, Gg, B), mn = Math.min(R, Gg, B);
        if (A < 200 || !(mx > 185 && mx - mn > 70 || mx > 225)) continue;
        const cell = `${Math.floor(xx / 3)},${Math.floor(yy / 3)}`;
        if (!seen.has(cell)) seen.set(cell, { ix: xx, iy: yy, c: R << 16 | Gg << 8 | B });
      }
      e.dots = [...seen.values()].slice(0, 70).map(d => { const [dx, dy] = bench.at(d.ix + 0.5, d.iy + 0.5); return { x: dx, y: dy, c: d.c, ph: Math.random() * 7, sp: rnd(0.6, 1.6) }; });
      e.halos = e.dots.slice(0, 40).map(d => this.glow(d.x, d.y, '#' + d.c.toString(16).padStart(6, '0')).setDisplaySize(11 * k + 4, 11 * k + 4));
    }
    if (kind === 'shine') e.next = this.scene.time.now + rnd(500, (r.rate || 6) * 1000);
    return e;
  }

  // is it evening, is Leyla close, is the bench being used? → strength 0..1 for each effect (eased)
  update(time, dt) {
    const s = this.scene, camp = this.camp, l = s.leyla, A = this.add_.clear(), F = this.flat.clear(), sec = dt / 1000, t = time / 1000;
    const hidden = !!s.hud.build?.active;
    A.setVisible(!hidden); F.setVisible(!hidden);
    for (const o of this.objs) if (hidden) o.setVisible(false);
    const night = (camp.lightK ?? 0) > 0.3, lk = camp.lightK ?? 0, craft = s.hud.craft;
    this.boost = 1 / Math.max(0.35, 1 - (camp.night?.fillAlpha ?? 0));   // what the night shade takes away, the small lights get back
    if (time > (this.fillAt || 0)) { this.fillAt = time + 400; for (const b of this.list) if (b.full) this.refill(b); }
    for (const b of this.list) {
      const near = l && Math.abs(l.x - b.cx) < (b.x1 - b.x0) / 2 + 90 && Math.abs(l.feet - b.floor) < 80;
      const use = l && ((camp.atWorkshop && camp.prompt?.place === b.place) || (craft?.isOpen && craft.ws === b.id && Math.abs(l.x - b.cx) < (b.x1 - b.x0) / 2 + 40) || camp.resting === b.place);
      b.use = !!use;
      b.dark = !!camp.noPower && (b.def.power || 0) < 0;
      for (const e of b.fx) {
        const r = e.r, on = !r.when || r.when === 'always' || (r.when === 'night' && night) || (r.when === 'near' && near) || (r.when === 'use' && use);
        // no power (Rig-Bau › Regeln): consumers go dark, only the fish keep swimming
        const goal = b.shut || (b.dark && r.kind !== 'fish') ? 0 : on ? 1 : (r.idle ?? 0) / 100;
        e.s += (goal - e.s) * Math.min(1, sec * 4);
        if (!hidden) this.draw(b, e, t, sec, lk, A, F);
      }
    }
    // steam and smoke puffs: rise, widen, fade
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += sec;
      if (p.age >= p.life || hidden) { p.img.destroy(); this.puffs.splice(i, 1); continue; }
      const q = p.age / p.life;
      p.x += (p.vx + Math.sin(t * 2 + p.ph) * p.wob) * sec; p.y += p.vy * sec;
      p.img.setPosition(p.x, p.y).setDisplaySize(p.r * (1 + q * 2.2), p.r * (1 + q * 2.2)).setAlpha(p.a * Math.sin(Math.PI * Math.min(1, q * 1.4 + 0.05)) * (1 - q));
    }
    // sparks: little glowing streaks under gravity
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.age += sec;
      if (p.age >= p.life || hidden) { this.sparks.splice(i, 1); continue; }
      const px = p.x, py = p.y;
      p.vy += p.g * sec; p.x += p.vx * sec; p.y += p.vy * sec;
      if (p.y > p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; }
      const a = 1 - p.age / p.life;
      A.lineStyle(p.wd, p.c, a).lineBetween(px, py, p.x, p.y);
      A.fillStyle(0xffffff, a * 0.8).fillRect(p.x - p.wd / 2, p.y - p.wd / 2, p.wd, p.wd);
    }
  }
  puff(e, b, kind) {
    const r = e.r, k = b.k, smoke = kind === 'smoke', size = (r.size || 5) * k;
    const img = this.scene.add.image(0, 0, glowKey(this.scene)).setTint(col(r.color || (smoke ? '#9a94a6' : '#ece6f2'))).setDepth(-19.91);
    this.puffs.push({ img, x: e.x + Math.random() * e.w, y: e.y + Math.random() * e.h, vx: rnd(-4, 4) * k, vy: -rnd(16, 28) * k * (smoke ? 0.8 : 1), wob: rnd(4, 9) * k, ph: Math.random() * 6,
      r: size * 2, a: (smoke ? 0.4 : 0.32) * Math.min(1, 0.4 + e.s), age: 0, life: rnd(1.6, 2.6) * (smoke ? 1.4 : 1) });
    if (this.puffs.length > 140) { this.puffs[0].img.destroy(); this.puffs.shift(); }
  }
  shower(e, b, n) {
    const k = b.k, c = col(e.r.color || '#ffb347');
    for (let j = 0; j < n; j++) this.sparks.push({ x: e.x + Math.random() * e.w, y: e.y + Math.random() * e.h, vx: rnd(-170, 170) * k, vy: -rnd(40, 230) * k, g: 900 * k, floor: b.floor - 2,
      life: rnd(0.25, 0.7), age: 0, c, wd: Math.max(1.5, (e.r.size || 2) * k * rnd(0.6, 1.2)) });
    if (this.sparks.length > 400) this.sparks.splice(0, this.sparks.length - 400);
    e.flash = 1;
  }
  draw(b, e, t, sec, lk, A, F) {
    const r = e.r, k = b.k, s = r.kind === 'light' ? e.s : Math.min(1, e.s) * (this.boost || 1), c = col(r.color || '#ffcf7a'), fl = (r.rate ?? 0) / 100;
    const flick = () => 1 - fl * (0.5 + 0.5 * Math.sin(t * 9.1 + e.ph) * Math.sin(t * 5.3 + 1 + e.ph)) - fl * 0.3 * Math.random();
    const dusk = 0.35 + 0.65 * lk;   // lights count for more in the evening
    switch (r.kind) {
      case 'light':
        e.glow.setVisible(true).setAlpha(0.55 * s * flick() * dusk);
        break;
      case 'screen': {
        // the screen itself glows; now and then a brighter band rolls down, a faint flicker on top
        const pass = r.rate ? (t * r.rate / 10 + e.ph) % 1 : -1, a = s * (0.2 + 0.18 * lk) * (0.92 + 0.08 * Math.random());
        A.fillStyle(c, a).fillRect(e.x, e.y, e.w, e.h);
        if (pass >= 0 && s > 0.05) A.fillStyle(0xffffff, 0.16 * s).fillRect(e.x, e.y + pass * e.h, e.w, Math.max(1.5, e.h * 0.12));
        e.glow.setVisible(true).setAlpha(s * 0.22 * dusk);
        break;
      }
      case 'steam': case 'smoke': case 'bubbles': {
        e.acc += sec * (r.rate || 1) * e.s;
        while (e.acc >= 1) {
          e.acc -= 1;
          if (r.kind === 'bubbles') e.list.push({ x: Math.random() * e.w, y: e.h, v: rnd(10, 20) * k, ph: Math.random() * 6, rr: rnd(0.6, 1.2) * (r.size || 2) * k });
          else this.puff(e, b, r.kind);
        }
        if (r.kind === 'bubbles') for (let i = e.list.length - 1; i >= 0; i--) {
          const p = e.list[i];
          p.y -= p.v * sec;
          if (p.y < 2) { e.list.splice(i, 1); continue; }
          A.lineStyle(Math.max(1, k), c, 0.55).strokeCircle(e.x + p.x + Math.sin(t * 3 + p.ph) * 1.5 * k, e.y + p.y, p.rr);
        }
        break;
      }
      case 'sparks':
        // showers per minute, scaled with the strength (a random gap each time)
        e.acc = (e.acc || 0) + sec * (r.rate || 6) / 60 * e.s;
        if (e.acc >= (e.gap ??= rnd(0.3, 1.5))) { e.acc = 0; e.gap = rnd(0.3, 1.5); this.shower(e, b, Math.round(rnd(6, 14))); }
        e.glow.setVisible(e.flash > 0).setAlpha(e.flash * 0.8 * (0.5 + 0.5 * Math.random()));
        if (e.flash > 0) {
          e.flash = Math.max(0, e.flash - sec * 6);
          A.fillStyle(0xffffff, e.flash * 0.9).fillCircle(e.cx, e.cy, 2 * k + 1);
        }
        break;
      case 'flame': {
        // a small gas flame under the pan: blue foot, orange tongues, warm glow on the wall
        const f = flick();
        e.glow.setVisible(true).setAlpha(0.5 * s * f * dusk);
        if (s > 0.05) for (let i = 0; i < 5; i++) {
          const fx = e.x + e.w * (i + 0.5) / 5, hh = (3 + 3 * Math.abs(Math.sin(t * 13 + i * 1.7 + e.ph))) * k * (0.6 + s * 0.6);
          A.fillStyle(0x3f7aff, 0.7 * s).fillRect(fx - k, e.y + e.h - 1.5 * k, 2 * k, 1.5 * k);
          A.fillStyle(0xff8a2a, 0.75 * s).fillRect(fx - k, e.y + e.h - 1.5 * k - hh, 2 * k, hh);
        }
        break;
      }
      case 'blink': {
        const on = Math.sin(t * Math.PI * 2 * (r.rate || 1) + e.ph) > 0 ? 1 : 0.15, sz = Math.max(2, (r.size || 2) * k);
        A.fillStyle(c, on * s).fillRect(e.cx - sz / 2, e.cy - sz / 2, sz, sz);
        A.fillStyle(c, on * s * 0.25).fillCircle(e.cx, e.cy, sz * 2.5);
        break;
      }
      case 'twinkle': {
        // every bulb on its own rhythm: soft swell plus a rare quick sparkle
        const sp = r.rate || 1, sz = Math.max(1.5, (r.size || 3) * k * 0.6);
        e.dots.forEach((d, i) => {
          const w = 0.55 + 0.45 * Math.sin(t * 2.2 * sp * d.sp + d.ph), sparkle = Math.sin(t * 0.7 * d.sp + d.ph * 3) > 0.985 ? 1 : 0, a = s * (0.35 + 0.65 * w);
          A.fillStyle(d.c, a * 0.9).fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
          if (sparkle) A.fillStyle(0xffffff, s * 0.9).fillRect(d.x - sz * 0.3, d.y - sz * 1.6, sz * 0.6, sz * 3.2).fillRect(d.x - sz * 1.6, d.y - sz * 0.3, sz * 3.2, sz * 0.6);
          if (e.halos[i]) e.halos[i].setVisible(true).setAlpha(a * 0.3 * dusk);
        });
        break;
      }
      case 'fish':
        for (const f of e.fish) {
          f.x += f.d * f.v * sec;
          if (f.x < 3 * k || f.x > e.w - 3 * k || Math.random() < sec * 0.08) { f.d *= -1; f.x = Math.max(3 * k, Math.min(e.w - 3 * k, f.x)); }
          f.y += Math.sin(t * 1.3 + f.v) * 2 * k * sec;
          const fx = e.x + f.x, fy = e.y + f.y, u = Math.max(1, k * 1.2);
          F.fillStyle(f.c, 0.95).fillRect(fx - 2 * u, fy - u, 4 * u, 2 * u);                  // body
          F.fillStyle(f.c, 0.8).fillRect(fx - f.d * 3 * u - u / 2, fy - 1.5 * u, u, 3 * u);   // tail
          F.fillStyle(0x0d0a12, 1).fillRect(fx + f.d * 1.2 * u - u / 4, fy - u / 2, u / 2, u / 2);   // eye
        }
        break;
      case 'lava': {
        // blobs drift up and down in the glass, the lamp breathes its light into the room
        const sp = r.rate || 1;
        for (let i = 0; i < 3; i++) {
          const q = 0.5 + 0.5 * Math.sin(t * 0.6 * sp + i * 2.1 + e.ph), by = e.y + e.h * (0.15 + 0.7 * q), rr = (1.6 + 0.8 * Math.sin(t * 1.3 + i)) * k * 1.4;
          A.fillStyle(c, 0.55 * s).fillCircle(e.cx + Math.sin(t + i) * e.w * 0.15, by, rr);
        }
        e.glow.setVisible(true).setAlpha(s * (0.4 + 0.12 * Math.sin(t * 1.1 * sp)) * dusk);
        break;
      }
      case 'scan': {
        // the hot printer nozzle travels to and fro, leaving a short glowing trail
        const q = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * (r.rate || 0.5) * 0.5 + e.ph), nx = e.x + e.w * q, ny = e.cy, sz = Math.max(2, (r.size || 3) * k);
        A.fillStyle(0x8b949e, 0.5 * s).fillRect(nx - sz, e.y, sz * 2, e.h * 0.4);
        A.fillStyle(c, 0.9 * s).fillRect(nx - sz / 2, ny, sz, sz);
        A.fillStyle(c, 0.22 * s).fillCircle(nx, ny, sz * 3);
        break;
      }
      case 'shine': {
        // every few seconds a glint runs over the metal
        const now = this.scene.time.now;
        if (now > e.next + 700) e.next = now + rnd(0.6, 1.4) * (r.rate || 6) * 1000;
        const q = (now - e.next) / 700;
        if (q >= 0 && q <= 1 && s > 0.05) {
          const bx = e.x - e.h + (e.w + e.h * 2) * q;
          for (let j = 0; j < e.h; j += Math.max(1, k)) {
            const xx = bx + (e.h - j) * 0.6;
            if (xx < e.x || xx > e.x + e.w - 2 * k) continue;
            A.fillStyle(c, 0.5 * s * Math.sin(q * Math.PI)).fillRect(xx, e.y + j, 2 * k + 1, Math.max(1, k));
          }
        }
        break;
      }
    }
  }
  // where Mama-Bot sits down on a bench
  dockOf(place) { const b = this.list.find(x => x.place === place); return b && { x: b.cx, y: b.top + (b.floor - b.top) * 0.42 }; }
  state() { return this.list.map(b => ({ id: b.id, place: b.place, fill: b.full ? Math.round(b.fill * 100) : null, shelves: b.shelves ?? null, fx: b.fx.length, use: b.use, x: Math.round(b.cx), scale: +b.k.toFixed(3) })); }
}

// Mega rigs (#022): draws a vehicle built by engine/megarig.js. The raw vehicle comes from its image (truck) or from code
// (crawler, fatbird) in strict side view on a 4 px pixel grid with AAP-64 colours; modules are the container pictures of the camp,
// rooms inside the hull are drawn from code; add-ons are cut-outs of a parts sheet or code. Everything lies behind Leyla.
import { chassisPlan, chassisTexture } from './camp.js';
import { SOLID_TILES } from '../../engine/room.js';
import { benchTexture } from './benches.js';
import { catenary, lightsConfig } from '../string_lights.js';
const PX = 4;   // one art pixel = 4 game pixels, like the container and truck pictures
// #027: the tile sets are doubled with EPX (Scale2x) before they are scaled up, so stairs and diagonals stay clean instead of
// turning into big blocks (Daniel: „ein paar der Grafiken sind sehr grob“); the skin canvas holds 2 game px per pixel
const SKIN_RES = 2;
const EPX = new Map();
export function epx(img) {
  const w = img.width, h = img.height, src = document.createElement('canvas');
  src.width = w; src.height = h;
  const sc = src.getContext('2d'); sc.drawImage(img, 0, 0);
  const a = new Uint32Array(sc.getImageData(0, 0, w, h).data.buffer), out = document.createElement('canvas');
  out.width = w * 2; out.height = h * 2;
  const oc = out.getContext('2d'), od = oc.createImageData(w * 2, h * 2), o = new Uint32Array(od.data.buffer);
  const at = (x, y) => a[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = a[y * w + x], A = at(x, y - 1), B = at(x + 1, y), Cc = at(x - 1, y), D = at(x, y + 1);
    let p1 = P, p2 = P, p3 = P, p4 = P;
    if (Cc === A && Cc !== D && A !== B) p1 = A;
    if (A === B && A !== Cc && B !== D) p2 = B;
    if (D === Cc && D !== B && Cc !== A) p3 = Cc;
    if (B === D && B !== A && D !== Cc) p4 = D;
    const i = (y * 2) * w * 2 + x * 2;
    o[i] = p1; o[i + 1] = p2; o[i + w * 2] = p3; o[i + w * 2 + 1] = p4;
  }
  oc.putImageData(od, 0, 0);
  return out;
}
const col = c => (typeof c === 'number' ? c : parseInt(String(c || '#ff00ff').slice(1), 16));
const snap = v => Math.round(v / PX) * PX;
// AAP-64 colours used by the code art
const C = { black: '#060608', ink: '#141013', night: '#242234', violet: '#403353', plum: '#793a80', grey: '#4a5462', steel: '#6d758d', silver: '#8b93af', pale: '#b3b9d1', white: '#dae0ea',
  brown: '#322b28', mud: '#221c1a', rust: '#71413b', copper: '#bb7547', sand: '#dba463', yellow: '#f9a31b', gold: '#ffd541', red: '#df3e23', cyan: '#20d6c7', blue: '#249fde', pink: '#bc4a9b', rose: '#f5a097', glass: '#285cc4' };
const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// container picture geometry (assets/rig/container_*): body from x 17, 121 px for one place + 101 per further place, roof at y 83, bottom at 187
const BOX = { left: 17, one: 121, more: 101, roof: 83, bottom: 187 };

export class MegarigView {
  // opts.id: the vehicle (default: the prototype page's); used small as a wreck in the camp too (camp_salvage.js)
  constructor(scene, build, T, opts = {}) {
    this.s = scene; this.b = build; this.T = T;
    this.containers = [];
    this.glows = [];
    const D = scene.data_, V = D.megarigs?.[opts.id ?? scene.args.megarig?.id] || {};
    this.V = opts.lights ? { ...V, lights: opts.lights } : V; this.id = opts.id ?? scene.args.megarig?.id ?? 'rig';
    this.docks = new Map();   // module number (from 1) → its two upper corners
    this.paint = { main: C.yellow, dark: C.violet, trim: C.copper, neon: C.cyan, light: C.red, ...(V.paint || {}) };
    this.g = scene.add.graphics().setDepth(-6);       // hull, back layer
    this.gm = scene.add.graphics().setDepth(-4.5);    // rooms
    this.gf = scene.add.graphics().setDepth(-3);      // front details (rails, girders in front of containers)
    this.gl = scene.add.graphics().setDepth(-2.5);    // ladders
    const hull = build.pieces.find(p => p.type === 'hull');
    if (hull.kind === 'truck') this.truck(hull);
    else if (hull.kind === 'crawler') this.crawler(hull);
    else this.airship(hull);
    for (const p of build.pieces) {
      if (p.type === 'container') this.container(p);
      else if (p.type === 'room') this.room(p);
      else if (p.type === 'rotor') this.rotor(p);
      else if (p.type === 'bridge') this.bridge(p);
    }
    for (const p of build.pieces) if (p.type === 'addon') this.addon(p);
    this.stringLights();
    if (scene.args?.megarig || opts.walk) this.walkways();   // not on a wreck in the camp
    if (V.brand && this.brandAt) {
      const st = this.stencil(V.brand, ...this.brandAt);
      const c = this.containers.find(c => c.inside && st.x > c.x0 && st.x < c.x1 && st.y > c.y0 && st.y < c.y1);
      if (c) { st.setDepth(-4.3); c.extra.push(st); }   // painted on the skin over the bridge: fades with it
    }
  }

  // ---------- helpers ----------
  r(g, x, y, w, h, c, a = 1) { g.fillStyle(col(c), a).fillRect(snap(x), snap(y), Math.max(PX, snap(w)), Math.max(PX, snap(h))); }
  rivets(g, x, y, w, c, gap = 24) { for (let i = x + 8; i < x + w - 4; i += gap) this.r(g, i, y, PX, PX, c); }
  hazard(g, x, y, w, h) {
    this.r(g, x, y, w, h, C.ink);
    for (let i = -h; i < w; i += 32) for (let j = 0; j < h; j += PX) this.r(g, x + Math.max(0, Math.min(w - 16, i + j)), y + j, 16, PX, C.yellow);
  }
  plate(g, x, y, w, h, main, dark, trim, seed = 1) {
    const r = rng(seed);
    this.r(g, x, y, w, h, dark);
    this.r(g, x + PX, y + PX, w - 2 * PX, h - 2 * PX, main);
    this.r(g, x + PX, y + PX, w - 2 * PX, PX, '#ffffff', 0.18);   // lit top edge
    this.r(g, x + PX, y + h - 2 * PX, w - 2 * PX, PX, C.black, 0.25);
    for (let n = 0; n < w * h / 2600; n++) this.r(g, x + 8 + r() * (w - 16), y + 8 + r() * (h - 16), PX * (1 + Math.floor(r() * 3)), PX, trim, 0.55);   // rust speckles
  }
  glow(x, y, w, h, c, a = 0.5) {
    const s = this.s;
    if (!s.textures.exists('mr_glow')) {
      const t = s.textures.createCanvas('mr_glow', 64, 64), ctx = t.getContext(), gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64); t.refresh();
    }
    const im = s.add.image(x, y, 'mr_glow').setDisplaySize(w, h).setTint(col(c)).setAlpha(a).setBlendMode(Phaser.BlendModes.ADD).setDepth(-2);
    this.glows.push(im);
    return im;
  }
  wheel(x, y, d) {   // a wheel from the parts sheet (Anbauteile › Ersatzrad), else from code
    const A = this.s.data_.rigAddons?.rad;
    if (A?.look && this.s.textures.exists(A.look)) {
      const f = this.frame(A.look, A.crop);
      return this.s.add.image(x, y, A.look, f).setDisplaySize(d, d).setDepth(-5.5);
    }
    this.g.fillStyle(col(C.ink)).fillCircle(x, y, d / 2).fillStyle(col(C.grey)).fillCircle(x, y, d / 4);
  }
  frame(key, crop) {
    if (!crop?.at || !crop?.size) return undefined;
    const name = `mr:${crop.at.join(',')}:${crop.size.join(',')}`, tex = this.s.textures.get(key);
    if (!tex.has(name)) tex.add(name, 0, crop.at[0], crop.at[1], crop.size[0], crop.size[1]);
    return name;
  }

  // ---------- tile sets (#026) ----------
  // The raw vehicle as one continuous skin of PixelLab pieces (bow, repeated middle pieces, stern) painted into a canvas at picture
  // resolution; rooms inside the hull lie behind it and a piece of the skin over each room fades when Leyla is inside (cover()).
  skinOk(...keys) { return keys.every(k => k && this.s.textures.exists(k)); }
  src(k) { return this.s.textures.get(k).getSourceImage(); }
  // the picture doubled with EPX (cached per texture)
  // n = 2: doubled twice (4×) for pieces that are scaled up a lot (bow, stern, the whole fatbird)
  fine(k, n = 1) { const key = `${k}:${n}`; if (!EPX.has(key)) EPX.set(key, n > 1 ? epx(this.fine(k, n - 1)) : epx(this.src(k))); return EPX.get(key); }
  skinCanvas(gx, gy, gw, gh, A) {
    const s = this.s, key = `mr_skin_${this.id}_${this.b.pieces[0].stage}`;
    if (s.textures.exists(key)) s.textures.remove(key);
    A = SKIN_RES;
    const t = s.textures.createCanvas(key, Math.ceil(gw / A), Math.ceil(gh / A)), ctx = t.getContext();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    this.skin = { key, t, ctx, gx, gy, A };
    return ctx;
  }
  // a picture into the skin: game position of its top-left corner, game px per picture px, flipped, only the first `cut` picture px
  put(k, x, y, sc, flip = false, cut = null) {
    const n = sc > 4.5 ? 2 : 1, f = 2 ** n, S = this.skin, im = this.fine(k, n), w = Math.min(im.width, f * (cut ?? im.width)), k2 = sc / f / S.A, dx = (x - S.gx) / S.A, dy = (y - S.gy) / S.A;
    const c = S.ctx;
    c.save();
    c.imageSmoothingEnabled = Math.abs(k2 - Math.round(k2)) > 0.01;   // whole steps stay sharp, the rest is smoothed
    if (flip) { c.translate(dx + w * k2, dy); c.scale(-1, 1); c.drawImage(im, 0, 0, w, im.height, 0, 0, w * k2, im.height * k2); }
    else c.drawImage(im, 0, 0, w, im.height, dx, dy, w * k2, im.height * k2);
    c.restore();
  }
  finishSkin(depth = -6) {
    const S = this.skin;
    S.t.refresh(); S.t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.s.add.image(S.gx, S.gy, S.key).setOrigin(0).setScale(S.A).setDepth(depth);
  }
  // #027 order in the hull (Daniel: „weniger Durcheinander“): the machinery of the middle pieces a little calmer, a steel frame
  // per place and a beam per story, so the hull reads as bays of the grid and the floors line up with the walkways
  bays(x0, x1, top, bottom, places, P, stories, S, under) {
    const Sk = this.skin, c = Sk.ctx, T = this.T, X = v => (v - Sk.gx) / Sk.A, Y = v => (v - Sk.gy) / Sk.A, u = 1 / Sk.A;
    c.save();
    c.fillStyle = 'rgba(20,16,19,0.28)'; c.fillRect(X(x0), Y(top + 2.6 * T), (x1 - x0) * u, (bottom - top - 2.6 * T) * u);   // calmer machinery
    const beam = (y, h) => {   // a steel beam with a lit top edge and rivets
      c.fillStyle = '#141013'; c.fillRect(X(x0), Y(y), (x1 - x0) * u, h * u);
      c.fillStyle = '#4a5462'; c.fillRect(X(x0), Y(y + 4), (x1 - x0) * u, (h - 8) * u);
      c.fillStyle = '#8b93af'; c.fillRect(X(x0), Y(y + 4), (x1 - x0) * u, 4 * u);
      c.fillStyle = '#333941'; for (let rx = x0 + 16; rx < x1; rx += 48) c.fillRect(X(rx), Y(y + h / 2), 4 * u, 4 * u);
    };
    for (let st = 1; st < stories; st++) beam(bottom - st * S * T - 12, 24);
    beam(bottom - 12, 20);
    for (let p = 0; p <= places; p++) {   // frames between the places
      const fx = x0 + p * P * T;
      c.fillStyle = '#141013'; c.fillRect(X(fx - 14), Y(top + 2.6 * T), 28 * u, (bottom - top - 2.6 * T) * u);
      c.fillStyle = '#4a5462'; c.fillRect(X(fx - 10), Y(top + 2.6 * T), 20 * u, (bottom - top - 2.6 * T) * u);
      c.fillStyle = '#6d758d'; c.fillRect(X(fx - 10), Y(top + 2.6 * T), 6 * u, (bottom - top - 2.6 * T) * u);
    }
    c.restore();
  }
  // the skin over a room: closed until Leyla climbs in (update())
  cover(x, y, w, h) {
    const S = this.skin;
    if (!S) return;
    const im = this.s.add.image(S.gx, S.gy, S.key).setOrigin(0).setScale(S.A).setCrop((x - S.gx) / S.A, (y - S.gy) / S.A, w / S.A, h / S.A).setDepth(-4.4);
    this.containers.push({ open: null, closed: im, x0: x, x1: x + w, y0: y, y1: y + h, inside: true, extra: [] });
  }
  // a long picture stretched by repeating its middle [r0, r1] (the track: one road wheel), as its own texture, picture px
  stretched(k, artW, r0, r1) {
    const s = this.s, im = this.fine(k), key = `mr_str_${k}_${artW}`;
    artW *= 2; r0 *= 2; r1 *= 2;
    if (!s.textures.exists(key)) {
      const t = s.textures.createCanvas(key, artW, im.height), c = t.getContext(), tail = im.width - r1;
      c.imageSmoothingEnabled = false;
      c.drawImage(im, 0, 0, r0, im.height, 0, 0, r0, im.height);
      for (let x = r0; x < artW - tail; x += r1 - r0) c.drawImage(im, r0, 0, r1 - r0, im.height, x, 0, r1 - r0, im.height);
      c.drawImage(im, r1, 0, tail, im.height, artW - tail, 0, tail, im.height);
      t.refresh(); t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    return key;
  }
  crawlerSkin(h) {
    const V = this.V.skin || {}, A = V.scale || 4;
    if (!this.skinOk(V.bow, V.mid, V.stern, V.track)) return false;
    const T = this.T, s = this.s, b = this.b, ground = b.G * T, x0 = b.x0 * T, len = h.len * T, P = this.paint;
    const bottom = (b.G - h.under) * T, top = (b.G - h.hullTop) * T, front = h.front * T, back = h.back * T, cabTop = top - h.S * T;
    const bow = this.src(V.bow), mid = this.src(V.mid), st = this.src(V.stern), tr = this.src(V.track);
    // bow: the cab roof of the picture (31 px down) on the cab roof, its foot one tile into the tracks; right edge 2 tiles into the middle
    const roof = 31, foot = bow.height - 10, bk = (bottom + T - cabTop) / (foot - roof);
    const bw = bow.width * bk, bx = x0 + front + 2 * T - bw, by = cabTop - roof * bk;
    // stern: its body (14 px down) level with the deck, a bit bigger than the middle pieces
    // stern: its hull band (Kachel-Set › Heck: Rumpf im Bild von – bis) exactly from the deck to the top of the tracks (#030)
    const [b0, b1] = V.sternBody || [14, 14 + st.height / ((V.sternScale || 1.75))], sk = V.sternBody ? (bottom - top) / (b1 - b0) : (V.sternScale || 1.75) * A;
    const sw = st.width * sk, sx = x0 + len + (V.sternBody ? 0.5 : 1.5) * T - sw, sy = top - b0 * sk;
    const gx = Math.min(bx, x0) - T, gy = Math.min(by, sy) - T;
    this.skinCanvas(gx, gy, x0 + len + 3 * T - gx, ground - gy, A);
    const end = x0 + len - back;
    for (let x = x0 + front - T; x < end; x += mid.width * A) this.put(V.mid, x, top, A, false, Math.ceil((end - x) / A));
    this.bays(x0 + front, x0 + front + h.places * h.P * T, top, bottom, h.places, h.P, h.inside, h.S);
    this.put(V.stern, sx, sy, sk);
    this.put(V.bow, bx, by, bk);
    // under the hull between the track units: the bogie, from code
    this.r(this.g, x0 + 3 * T, bottom, len - 6 * T, h.under * T * 0.55, C.night);
    for (let i = x0 + 4 * T; i < x0 + len - 4 * T; i += 3 * T) this.r(this.g, i, bottom + 2 * PX, 2 * T, 6 * PX, C.violet);
    this.finishSkin(-6);
    // two track units, the middle of the picture repeated to their length
    const [r0, r1] = V.trackRepeat || [Math.round(tr.width * 0.35), Math.round(tr.width * 0.5)];
    const tk = h.under * T / tr.height, uw = len * 0.42, key = this.stretched(V.track, Math.round(uw / tk), r0, r1);
    for (const ux of [x0 + T, x0 + len - uw - T]) s.add.image(ux, ground, key).setOrigin(0, 1).setScale(tk / 2).setDepth(-5.9);
    // lights, the deck railing, a catwalk over the sloped stern (the deck walks on to the end)
    this.glow(bx + 26 * bk, by + 147 * bk, 200, 110, C.gold, 0.5);
    this.glow(sx + sw - 6 * sk, sy + 62 * sk, 90, 60, P.light, 0.55);
    this.r(this.gf, x0 + front, top - 0.7 * T, end - x0 - front, PX, C.steel);
    for (let i = x0 + front; i < end; i += T) this.r(this.gf, i, top - 0.7 * T, PX, 0.7 * T, C.steel);
    const cw0 = sx + (V.sternSlope ?? 57) * sk;
    this.r(this.gf, cw0, top - PX, x0 + len - cw0, 3 * PX, C.ink); this.r(this.gf, cw0, top - PX, x0 + len - cw0, PX, C.steel);
    for (let i = cw0; i < x0 + len; i += 0.5 * T) this.r(this.gf, i, top + 2 * PX, PX, 0.5 * T, C.night);   // struts down to the slope
    this.brandAt = [bx + 84 * bk, by + 116 * bk, 0.62 * T];   // on the yellow nose plate under the bridge
    return true;
  }
  // the gas envelope as pixel art (#026): a silver cigar shaded in AAP-64 bands with ordered dithering, light from the top left,
  // curved panel seams, two load straps, patches of old canvas with stitches, rust drips; drawn at the tile set's pixel size
  envelopePixels(ex, ey, ew, eh, A) {
    const s = this.s, key = `mr_env_${this.id}_${Math.round(ew)}`, w = Math.round(ew / A), h = Math.round(eh / A);
    if (s.textures.exists(key)) s.textures.remove(key);
    const t = s.textures.createCanvas(key, w, h), c = t.getContext(), img = c.createImageData(w, h), d = img.data;
    const ramp = ['#242234', '#4a5462', '#6d758d', '#8b93af', '#b3b9d1', '#dae0ea'].map(x => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]);
    const ink = [20, 16, 19], bayer = [[0, 2], [3, 1]], cx = w / 2, cy = h / 2, rx = w / 2 - 0.5, ry = h / 2 - 0.5, r = rng(23);
    const patches = Array.from({ length: 6 }, () => ({ x: 0.1 + r() * 0.75, y: 0.2 + r() * 0.5, w: 10 + Math.floor(r() * 14), h: 6 + Math.floor(r() * 7), tan: r() < 0.5 }));
    const inside = (x, y) => { const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry; return Math.pow(Math.abs(nx), 2.6) + ny * ny <= 1; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // a cigar: rounder nose and tail than an ellipse (superellipse in x)
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, dd = Math.pow(Math.abs(nx), 2.6) + ny * ny;
      if (dd > 1) continue;
      const i = (y * w + x) * 4;
      let rgb;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) rgb = ink;   // a one pixel outline
      else {
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, dd)));
        const v = 0.62 - ny * 0.5 - nx * 0.08 - (1 - nz) * 0.45;   // light from the top left, darker towards the rim and the belly
        const seam = x % 22 === 0 && (y % 2 === 0) && Math.abs(nx) < 0.92;
        const strap = (Math.abs(nx + 0.42) < 0.008 || Math.abs(nx - 0.42) < 0.008);
        let k = Math.max(0, Math.min(5, Math.floor(v * 6 + bayer[y % 2][x % 2] / 4 - 0.25)));
        if (seam) k = Math.max(0, k - 1);
        rgb = strap ? ramp[Math.max(0, k - 2)] : ramp[k];
        for (const p of patches) {
          const px = p.x * w, py = p.y * h;
          if (x >= px && x < px + p.w && y >= py && y < py + p.h) {
            const edge = x === Math.floor(px) || x === Math.floor(px + p.w - 1) || y === Math.floor(py) || y === Math.floor(py + p.h - 1);
            const base = p.tan ? [[160, 134, 98], [199, 176, 139]] : [[142, 82, 82], [186, 117, 106]];
            rgb = edge && (x + y) % 2 === 0 ? ink : base[(x + y) % 3 === 0 ? 0 : 1];
          }
        }
        if (k <= 2 && r() < 0.012) rgb = [113, 65, 59];   // rust specks in the shade
      }
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    t.refresh(); t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    s.add.image(ex, ey, key).setOrigin(0).setScale(ew / w, eh / h).setDepth(-6.5);
  }
  airshipSkin(h) {
    const V = this.V.skin || {}, A = V.scale || 6;
    if (!this.skinOk(V.bow, V.mid, V.stern)) return false;
    const T = this.T, b = this.b, x0 = b.x0 * T, len = h.len * T, P = this.paint;
    const frameBottom = (b.G - h.under) * T, top = (b.G - h.hullTop) * T, front = h.front * T, back = h.back * T;
    const nose = this.src(V.bow), mid = this.src(V.mid), tail = this.src(V.stern);
    const nw = nose.width * A, nh = nose.height * A, nx = x0 + front + 2 * T - nw, ny = frameBottom + 1.5 * T - nh;
    const tx = x0 + len - back - 5 * T, ty = top - 4.5 * T, tw = tail.width * A, th = tail.height * A;
    const gx = Math.min(nx, x0) - T, gy = Math.min(ny, ty) - T;
    this.skinCanvas(gx, gy, Math.max(tx + tw, x0 + len) + T - gx, Math.max(ny + nh, ty + th, frameBottom + 2 * T) - gy, A);
    const end = tx + 4 * T;
    for (let x = x0 + front - T; x < end; x += mid.width * A) this.put(V.mid, x, top, A, false, Math.ceil((end - x) / A));
    this.bays(x0 + front, x0 + front + h.places * h.P * T, top, frameBottom - h.frames * h.S * T, h.places, h.P, h.inside - h.frames, h.S);
    this.put(V.stern, tx, ty, A);
    this.put(V.bow, nx, ny, A);
    this.finishSkin(-6);
    this.glow(nx + 50 * A, ny + 80 * A, 260, 200, C.gold, 0.35);   // the cockpit window
    this.glow(nx + 40 * A, ny + nh - 12 * A, 160, 90, P.neon, 0.5);   // hover nozzle under the nose
    this.glow(tx + tw - 5 * A, ty + 125 * A, 220, 160, P.neon, 0.5);   // the tail engine
    return true;
  }

  // ---------- raw vehicles ----------
  // #027 (Daniel: „der LKW soll mit den normalen Container-Anhängern funktionieren, da braucht es keine gesonderte Auflieger-Grafik“):
  // every container on the bed stands on the camp's modular chassis (Camp › Fahrgestell), drawbar towards the truck; with nothing
  // loaded an empty 40-foot chassis waits behind the truck
  truck(h) {
    const T = this.T, s = this.s, b = this.b, ground = b.G * T, x0 = b.x0 * T, D = s.data_;
    const ground0 = b.pieces.filter(p => p.type === 'container' && p.story === 0);
    const beds = ground0.length ? ground0 : [{ x: b.x0 + h.front, w: h.P * h.places, h: h.S - 1, places: h.places, container: Object.keys(D.containers || {}).find(k => D.containers[k].chassis && D.containers[k].places === h.places) }];
    for (const p of beds) {
      const def = D.containers?.[p.container], plan = def && chassisPlan(D, def), key = plan && chassisTexture(s, plan);
      if (!key) continue;
      const k = (p.h + 3) * T / (BOX.bottom - BOX.roof), n = p.places || def.places || 1, cxImg = BOX.left + (BOX.one + (n - 1) * BOX.more) / 2;
      const bedLeft = (p.x + p.w / 2) * T - (cxImg - BOX.left) * k, hgt = (plan.rows[1] - plan.rows[0]) * k;
      s.add.image(bedLeft - plan.drawbar * k, ground, key).setOrigin(0, 1).setScale(k).setFlipX(true).setDepth(-5.2);
      if (!ground0.length) this.r(this.g, bedLeft, ground - hgt - PX, plan.bed * k, PX, C.ink, 0);   // nothing on it: the bed alone
    }
    // the cab: the truck picture from PixelLab, strict side view
    if (h.look && s.textures.exists(h.look)) {
      const [ox, oy] = h.lookOffset || [0, 0];
      s.add.image(x0 + ox, ground + oy, h.look).setOrigin(0, 1).setScale(h.lookScale || 4).setDepth(-3.5);
      this.glow(x0 + 10, ground - 2.2 * T, 90, 60, C.cyan, 0.35);   // headlight
    }
  }

  crawler(h) {
    if (this.crawlerSkin(h)) return;
    const T = this.T, g = this.g, b = this.b, P = this.paint, ground = b.G * T, x0 = b.x0 * T, len = h.len * T;
    const bottom = (b.G - h.under) * T, top = (b.G - h.hullTop) * T, front = h.front * T, r = rng(7);
    // two track units: dark tread loops with road wheels, a bogie block between them
    const uw0 = len * 0.42, units = [[x0 + 1 * T, uw0], [x0 + len - uw0 - T, uw0]];   // #024: as long as the hull allows, no cap
    this.r(g, x0 + 3 * T, bottom, len - 6 * T, h.under * T * 0.55, C.night);
    for (let i = x0 + 4 * T; i < x0 + len - 4 * T; i += 3 * T) this.r(g, i, bottom + 2 * PX, 2 * T, 6 * PX, C.violet);
    for (const [ux, uw] of units) {
      const th = h.under * T - 2 * PX, ty = ground - th;
      this.r(g, ux + 4 * PX, ty, uw - 8 * PX, th, C.mud);
      this.r(g, ux, ty + 4 * PX, uw, th - 8 * PX, C.mud);
      for (let i = ux + 2 * PX; i < ux + uw - 2 * PX; i += 6 * PX) { this.r(g, i, ty, 3 * PX, 2 * PX, C.brown); this.r(g, i, ground - 2 * PX, 3 * PX, 2 * PX, C.brown); }   // tread teeth
      this.r(g, ux + 3 * PX, ty + 3 * PX, uw - 6 * PX, th - 6 * PX, C.brown);
      const d = th * 0.52, n = Math.max(3, Math.round(uw / (d * 1.18)));   // big road wheels: the tracks tower over Leyla
      for (let k = 0; k < n; k++) {
        const cx = ux + uw * (k + 0.5) / n, cy = ground - th / 2;
        g.fillStyle(col(C.ink)).fillCircle(cx, cy, d / 2);
        g.fillStyle(col(C.grey)).fillCircle(cx, cy, d / 2 - 3 * PX);
        g.fillStyle(col(C.steel)).fillCircle(cx, cy, d / 5);
        this.r(g, cx - PX, cy - PX, 2 * PX, 2 * PX, C.ink);
        for (let a = 0; a < 6; a++) { const ang = a * Math.PI / 3 + k; this.r(g, cx + Math.cos(ang) * d * 0.32 - PX, cy + Math.sin(ang) * d * 0.32 - PX, 2 * PX, 2 * PX, C.ink); }   // bolts
      }
      // return rollers on top of the track
      for (let k = 0; k < n - 1; k++) { const rx = ux + uw * (k + 1) / n; g.fillStyle(col(C.grey)).fillCircle(rx, ty + 5 * PX, 3 * PX); }
      this.r(g, ux + 6 * PX, ty - 3 * PX, uw - 12 * PX, 3 * PX, P.dark);   // track guard
      this.hazard(g, ux + uw * 0.3, ty - 3 * PX, uw * 0.4, 3 * PX);
    }
    // hull body with panels per place
    this.plate(g, x0 + 2 * T, top, len - 2 * T, bottom - top + T, P.main, P.dark, P.trim, 3);
    for (let p = 0; p <= h.places; p++) { const px = x0 + front + p * h.P * T; this.r(g, px - PX, top + T, 2 * PX, bottom - top - T, P.dark, 0.7); }
    this.hazard(g, x0 + 2 * T, bottom + T - 4 * PX, len - 2 * T, 4 * PX);
    this.r(g, x0 + 2 * T, top, len - 2 * T, T, P.dark);   // deck slab
    for (let st = 1; st < h.inside; st++) { const sy = (b.G - h.under - st * h.S) * T; this.r(g, x0 + front, sy, len - front - h.back * T, T * 0.6, P.dark, 0.85); this.rivets(g, x0 + front, sy + 2 * PX, len - front - h.back * T, P.main, 28); }   // slabs between the hull stories
    this.rivets(g, x0 + 2 * T, top + 6 * PX, len - 2 * T, P.main, 28);
    // cab: block up to one story above the deck, slanted nose, a lit bridge window
    const cy = top - h.S * T, cx = x0 + 2 * T, cw = front - 3 * T;
    this.plate(g, cx, cy, cw, top - cy + T, P.main, P.dark, P.trim, 5);
    // slanted nose: cut the top-left corner with sky-coloured steps of the dark tone
    for (let i = 0; i < 8; i++) this.r(g, cx, cy + i * 2 * PX, (8 - i) * 3 * PX, 2 * PX, P.dark);
    // windshield in the nose in front of the bridge (the bridge itself is a room, see bridge())
    const wx = cx + 0.8 * T, wy = cy + 1.4 * T, ww = 2.4 * T, wh = h.S * T - 2.4 * T;
    this.r(g, wx - PX, wy - PX, ww + 2 * PX, wh + 2 * PX, C.ink);
    this.r(g, wx, wy, ww, wh, C.glass, 0.9);
    this.r(g, wx + PX, wy + PX, ww * 0.35, wh - 2 * PX, C.pale, 0.35);
    this.logo(g, cx + cw * 0.42, top + 2 * T, 3 * T, P.dark);
    this.brandAt = [cx + cw * 0.42 + 1.5 * T, top + 6.2 * T, 1.0 * T];   // #025: the maker's name stencilled on the engine block under the logo
    this.hazard(g, cx, top + T, cw, 3 * PX);
    this.r(g, cx - 2 * PX, top - 1.6 * T, 6 * PX, 1.2 * T, C.ink);   // headlights
    this.r(g, cx - PX, top - 1.4 * T, 3 * PX, 0.8 * T, P.neon);
    this.glow(cx - 20, top - 1 * T, 160, 120, P.neon, 0.4);
    // the cab roof is a platform (engine); antennas + red light on top
    this.r(g, cx + cw - 2 * T, cy - 1.6 * T, PX, 1.6 * T, C.silver);
    this.r(g, cx + cw - 2 * T - PX, cy - 1.6 * T - 2 * PX, 3 * PX, 2 * PX, P.light);
    this.glow(cx + cw - 2 * T, cy - 1.6 * T, 40, 40, P.light, 0.6);
    // deck railing along the top
    this.r(this.gf, x0 + front, top - 0.7 * T, len - front - T, PX, C.steel);
    for (let i = x0 + front; i < x0 + len - T; i += T) this.r(this.gf, i, top - 0.7 * T, PX, 0.7 * T, C.steel);
    // exhaust stacks at the back
    for (let k = 0; k < 2; k++) { const ex = x0 + len - (1.5 + k * 1.2) * T; this.r(g, ex, top - 3 * T, 5 * PX, 3 * T, C.grey); this.r(g, ex - PX, top - 3 * T, 7 * PX, 2 * PX, C.ink); }
    for (let n = 0; n < 14; n++) this.r(g, x0 + 2 * T + r() * (len - 4 * T), top + T + r() * (bottom - top - T), PX * 2, PX, P.trim, 0.6);
  }

  airship(h) {
    const T = this.T, g = this.g, b = this.b, P = this.paint, x0 = b.x0 * T, len = h.len * T;
    const frameTop = (b.G - h.under - h.frames * h.S) * T, frameBottom = (b.G - h.under) * T, top = (b.G - h.hullTop) * T, front = h.front * T;
    // gas envelope: a fat silver cigar above the fuselage, panel seams, neon band, logo; catwalk rail on top
    const ex = x0 + front - 3 * T, ew = len - front + 4 * T, eh = (h.envelope + 1) * T, ey = top - eh;
    const env = this.s.add.graphics().setDepth(-6.4);
    if (this.V.skin?.bow && this.s.textures.exists(this.V.skin.bow)) this.envelopePixels(ex, ey, ew, eh, this.V.skin.scale || 6);   // #026: pixel art like the tile set
    else {
      const ell = (c, inset, a = 1) => { env.fillStyle(col(c), a); env.fillEllipse(ex + ew / 2, ey + eh / 2 + inset / 3, ew - inset * 2, eh - inset); };
      ell(C.steel, 0); ell(C.silver, 2 * PX); ell(C.pale, 6 * PX);
      env.fillStyle(col(C.white), 0.9).fillEllipse(ex + ew / 2, ey + eh * 0.3, ew * 0.8, eh * 0.25);
      for (let i = 1; i < 12; i++) { const sx = ex + ew * i / 12, k = Math.sqrt(1 - Math.pow((sx - ex - ew / 2) / (ew / 2), 2)); env.fillStyle(col(C.steel), 0.6).fillRect(snap(sx), snap(ey + eh / 2 - eh / 2 * k + 2 * PX), PX, snap(eh * k - 4 * PX)); }
    }
    env.fillStyle(col(P.neon), 0.9).fillRect(snap(ex + ew * 0.08), snap(ey + eh * 0.55), snap(ew * 0.84), 2 * PX);
    this.glow(ex + ew / 2, ey + eh * 0.55, ew * 0.9, 50, P.neon, 0.35);
    this.logo(env, ex + ew * 0.32, ey + eh * 0.3, 2.6 * T, P.main);
    this.r(this.gf, ex + ew * 0.15, ey - 0.8 * T, ew * 0.7, PX, C.steel);   // catwalk rail
    for (let i = ex + ew * 0.15; i < ex + ew * 0.85; i += T) this.r(this.gf, i, ey - 0.8 * T, PX, 0.8 * T, C.steel);
    for (let i = 0; i < 6; i++) this.r(g, ex + ew * (0.18 + i * 0.13), ey + eh - 2 * PX, PX, top - ey - eh + 4 * PX, C.ink);   // straps down to the hull
    if (this.airshipSkin(h)) { this.winch = true; return; }
    // fuselage: closed decks, cockpit nose, engine block at the back
    this.plate(g, x0 + 2 * T, top, len - 3 * T, frameTop - top + T, P.main, P.dark, P.trim, 11);
    for (let p = 0; p <= h.places; p++) this.r(g, x0 + front + p * h.P * T - PX, top + T, 2 * PX, frameTop - top - T, P.dark, 0.7);
    this.r(g, x0 + 2 * T, top, len - 3 * T, T, P.dark);
    this.hazard(g, x0 + 2 * T, frameTop + T - 4 * PX, len - 3 * T, 4 * PX);
    // cockpit: rounded nose with a glowing window, a front balcony
    const nx = x0 - 1.5 * T, ny = top + 1 * T, nw = front * 0.3, nh = Math.min(frameTop - top - 0.6 * T, h.S * T * 1.4);
    g.fillStyle(col(P.dark)).fillRoundedRect(nx, ny, nw + 2 * T, nh, 40);
    g.fillStyle(col(P.main)).fillRoundedRect(nx + PX, ny + PX, nw + 2 * T, nh - 2 * PX, 36);
    const cw_ = nw * 0.8, ch_ = nh * 0.32;
    this.r(g, nx + 2 * PX, ny + nh * 0.18, cw_, ch_, C.ink);
    this.r(g, nx + 3 * PX, ny + nh * 0.18 + PX, cw_ - 2 * PX, ch_ - 2 * PX, C.gold, 0.85);
    this.glow(nx + cw_ / 2, ny + nh * 0.18 + ch_ / 2, cw_ * 1.6, ch_ * 2, C.gold, 0.4);
    this.logo(g, x0 + front - 4 * T, top + 2.5 * T, 1.6 * T, P.dark);
    const bx = x0 + len - h.back * T;
    this.r(g, bx + T, top + T, 4 * PX, frameTop - top, C.ink);
    for (let k = 0; k < 3; k++) this.r(g, x0 + len - T, top + (1.4 + k * 1.2) * T, 6 * PX, 0.6 * T, C.grey);
    // open cargo frame underneath: beams, diagonal braces, cables
    const fx = x0 + 2 * T, fw = len - 3 * T;
    this.r(this.gf, fx, frameBottom, fw, 0.5 * T, C.ink);
    this.r(this.gf, fx, frameBottom + PX, fw, 0.5 * T - 2 * PX, P.dark);
    this.hazard(this.gf, fx + fw * 0.4, frameBottom + 0.5 * T, fw * 0.2, 3 * PX);
    for (let p = 0; p <= h.places; p++) {
      const px = x0 + front + p * h.P * T;
      this.r(this.gf, px - 2 * PX, frameTop + T, 4 * PX, frameBottom - frameTop - T, C.ink);
      if (p < h.places) this.gf.lineStyle(PX, col(C.night), 0.9).lineBetween(px, frameTop + T, px + h.P * T, frameBottom);
    }
    this.r(this.gf, x0 + 2 * T, frameTop + T - PX, 3 * PX, frameBottom - frameTop - T, C.ink);
    this.r(this.gf, x0 + len - T - 3 * PX, frameTop + T - PX, 3 * PX, frameBottom - frameTop - T, C.ink);
    // hover thrusters glowing blue underneath
    for (const t of [0.12, 0.88]) { const tx = x0 + len * t; this.r(g, tx - T, frameBottom + 0.5 * T, 2 * T, 0.5 * T, C.grey); this.r(g, tx - 0.7 * T, frameBottom + T - PX, 1.4 * T, PX, P.neon); this.glow(tx, frameBottom + 1.4 * T, 2.6 * T, 1.4 * T, P.neon, 0.55); }
    this.winch = true;
  }

  rotor(p) {   // ducted fan on an outrigger: housing with a yellow band, blue glow below, red light on top
    const T = this.T, g = this.gf, P = this.paint, x = p.x * T, y = p.y * T, w = p.w * T;
    const hullX = this.b.x0 * T + (x < this.b.x0 * T ? 2 * T : (this.b.len - 1) * T);
    const hullTop = (this.b.G - this.b.pieces[0].hullTop) * T, ax = x + w / 2;   // outrigger: an arm to the hull roof plus a strut
    this.g.lineStyle(0.7 * T, col(C.night)).lineBetween(ax, y + 0.8 * T, hullX, hullTop + T);
    this.g.lineStyle(2 * PX, col(this.paint.dark)).lineBetween(ax, y + 1.4 * T, hullX, hullTop + 2.5 * T);
    const R = this.V.skin?.rotor;
    if (R && this.s.textures.exists(R)) {   // #026: the rotor pod from the tile set, its outrigger stub towards the hull
      const key = R + '_x2';
      if (!this.s.textures.exists(key)) this.s.textures.addCanvas(key, this.fine(R));
      const im = this.src(R), k = w / im.width, left = x < this.b.x0 * T + this.b.len * T / 2;
      this.s.add.image(x, y - 0.3 * T, key).setOrigin(0).setScale(k / 2).setFlipX(left).setDepth(-3);
      this.glow(x + w / 2, y + im.height * k + 0.4 * T, w * 1.1, 1.6 * T, P.neon, 0.5);
      this.blink(x + w * (left ? 0.44 : 0.56), y - 0.2 * T, P.light);
      return;
    }
    const rh = Math.max(1.6 * T, w * 0.22);   // #024: housing grows with the rotor
    g.fillStyle(col(C.ink)).fillRoundedRect(x, y, w, rh, 20);
    g.fillStyle(col(C.grey)).fillRoundedRect(x + PX, y + PX, w - 2 * PX, rh - 2 * PX, 18);
    this.r(g, x + w * 0.42, y + PX, w * 0.16, rh - 2 * PX, P.main);
    this.r(g, x + 2 * PX, y + rh - 3 * PX, w - 4 * PX, 2 * PX, C.night);
    this.r(g, x + w * 0.2, y + rh, w * 0.6, PX, P.neon);
    this.glow(x + w / 2, y + rh + 0.6 * T, w * 1.1, rh, P.neon, 0.55);
    this.r(g, x + w / 2 - PX, y - 2 * PX, 2 * PX, 2 * PX, P.light);
    this.blink(x + w / 2, y - PX, P.light);
  }

  logo(g, x, y, s, c) {   // the triangle mark of the concept art
    g.fillStyle(col(c), 0.9).fillTriangle(x, y + s, x + s / 2, y, x + s, y + s);
    g.fillStyle(col(this.paint.main), 1).fillTriangle(x + s * 0.25, y + s * 0.82, x + s / 2, y + s * 0.38, x + s * 0.75, y + s * 0.82);
    g.fillStyle(col(c), 0.9).fillTriangle(x + s * 0.38, y + s * 0.82, x + s / 2, y + s * 0.6, x + s * 0.62, y + s * 0.82);
  }
  blink(x, y, c) {
    const im = this.glow(x, y, 46, 46, c, 0.7);
    this.s.tweens.add({ targets: im, alpha: 0.1, duration: 700, yoyo: true, repeat: -1, delay: Math.random() * 900 });
  }

  // ---------- modules ----------
  container(p) {
    const s = this.s, T = this.T, D = s.data_, Cn = D.containers?.[p.container] || {};
    const open = Cn.look, closed = Cn.lookClosed;
    if (!open || !s.textures.exists(open)) { this.room(p); return; }
    const k = (p.h + 3) * T / (BOX.bottom - BOX.roof);   // roof edge on the top of the roof row, bottom on the bottom of the floor row
    const fw = s.textures.get(open).getSourceImage().width, a = s.data_.assets?.[open], frameW = a?.frameSize?.[0] || fw;
    const n = p.places, cxImg = BOX.left + (BOX.one + (n - 1) * BOX.more) / 2;
    const x = (p.x + p.w / 2) * T, y = (p.floorRow + 1) * T, depth = -5 + p.story * 0.01;
    const o = s.add.image(x, y, open, 0).setOrigin(cxImg / frameW, BOX.bottom / 256).setScale(k).setDepth(depth);
    const c = closed && s.textures.exists(closed) ? s.add.image(x, y, closed, 0).setOrigin(cxImg / frameW, BOX.bottom / 256).setScale(k).setDepth(depth + 0.005) : null;
    if (p.color) { o.setTint(col(p.color)); c?.setTint(col(p.color)); }
    // #031 (Daniel: „die räumliche Kante der Container in der obersten Reihe ausblenden, damit die Perspektive einheitlich ist“):
    // the pictures show a strip of the roof from above; aboard everything is strict side view, so the picture starts at the top rail
    const cut = BOX.roof - (Cn.roofCut ?? 0), fh = s.textures.get(open).frames[0]?.height || 256;
    for (const im of [o, c]) im?.setCrop(0, cut, frameW, fh - cut);
    this.containers.push({ open: o, closed: c, x0: p.x * T, x1: (p.x + p.w) * T, y0: (p.y - 1) * T, y1: (p.floorRow + 1) * T });
    // #028: workshops inside (seen when it is open), docking points for string lights on the upper corners of the box
    const ins = Cn.inside?.y || [90, 175], roofY = y - (BOX.bottom - BOX.roof) * k;
    this.benchesIn(p, p.x * T + 0.35 * T, p.w * T - 0.7 * T, y - (BOX.bottom - ins[1]) * k, (ins[1] - ins[0]) * k, depth + 0.002);
    if (p.module != null) this.docks.set(p.module + 1, [{ x: p.x * T + 0.4 * T, y: roofY + 6 }, { x: (p.x + p.w) * T - 0.4 * T, y: roofY + 6 }]);
    if (p.name && p.name !== Cn.name) this.label(x, (p.y - 1) * T + 0.3 * T, p.name);
  }

  room(p) {   // a room inside the hull: a container without its skin (Daniel: „genau so“)
    const T = this.T, g = this.gm, P = this.paint, x = p.x * T, y = (p.y - 1) * T + T, w = p.w * T, h = (p.floorRow - p.y + 1) * T;
    this.r(g, x, y, w, h, C.ink);
    this.r(g, x + 2 * PX, y + 2 * PX, w - 4 * PX, h - 2 * PX, P.dark);
    this.r(g, x + 2 * PX, y + 2 * PX, w - 4 * PX, h * 0.18, C.black, 0.35);   // shade under the ceiling
    for (let i = x + T * 1.5; i < x + w - T; i += T * 1.5) this.r(g, i, y + 3 * PX, PX, h - 3 * PX, C.black, 0.25);   // wall ribs
    this.r(g, x + 2 * PX, y + h - 3 * PX, w - 4 * PX, 3 * PX, C.steel);   // floor
    this.r(g, x + 2 * PX, y + h - 3 * PX, w - 4 * PX, PX, C.pale, 0.6);
    for (let i = 0; i < p.places; i++) {   // one lamp per place, warm
      const lx = x + w * (i + 0.5) / p.places;
      this.r(g, lx - 3 * PX, y + 2 * PX, 6 * PX, 2 * PX, C.gold);
      this.glow(lx, y + 0.6 * T, 2.2 * T, 1.4 * T, C.gold, 0.28);
    }
    const helm = p.type === 'bridge' && p.workshops?.length ? 3 * T : 0;   // #029: the helm (map) in front, the bridge's workshops behind it
    if (p.workshops?.length) this.benchesIn(p, x + helm + 0.3 * T, w - helm - 0.6 * T, y + h - 3 * PX, h - 0.8 * T, -4.45);   // #028
    const lab = p.name ? this.label(x + w / 2, y + 0.5 * T, p.name) : null;
    if (this.skin && (p.inside || p.type === 'bridge')) {   // #026: the hull skin over the room; #027: its name shows when it is open
      this.cover(x, y - T, w, h + T);
      if (lab) { lab.setAlpha(0); this.containers[this.containers.length - 1].inner = [lab]; }
    }
  }

  // the crawler's bridge (#024): a room as big as a 40-foot container, consoles with screens, the captain's chair
  bridge(p) {
    this.room({ ...p, places: 3 });
    const T = this.T, g = this.gm, P = this.paint, x = p.x * T, w = p.w * T, floor = p.floorRow * T;
    const helm = !!p.workshops?.length;   // #029: with workshops aboard only the helm console stays, in front
    for (let i = 0; i < (helm ? 1 : 3); i++) {
      const kx = helm ? x + 0.3 * T : x + w * (0.12 + i * 0.3), ky = floor - 1.3 * T;
      this.r(g, kx, ky, 2.4 * T, 1.3 * T, C.ink); this.r(g, kx + PX, ky + PX, 2.4 * T - 2 * PX, 1.3 * T - PX, C.grey);
      this.r(g, kx + 3 * PX, ky - 1.1 * T, 1.8 * T, 1 * T, C.ink); this.r(g, kx + 4 * PX, ky - 1.1 * T + PX, 1.8 * T - 2 * PX, 1 * T - 2 * PX, i === 1 ? P.neon : C.cyan, 0.8);
      this.glow(kx + 1.2 * T, ky - 0.6 * T, 3 * T, 2 * T, P.neon, 0.25);
    }
    const cx = helm ? x + 2.4 * T : x + w * 0.5, cy = floor;   // chair
    this.r(g, cx - 0.4 * T, cy - 1.6 * T, 0.3 * T, 1.2 * T, C.rust); this.r(g, cx - 0.4 * T, cy - 0.6 * T, 0.9 * T, 0.25 * T, C.rust); this.r(g, cx, cy - 0.4 * T, 0.12 * T, 0.4 * T, C.ink);
  }

  // #025: the maker's name, sprayed through a stencil (gaps in the letters, a bit faded, worn)
  stencil(text, x, y, size) {
    const words = text.toUpperCase().split(' '), lines = words.length > 2 ? [words[0], words.slice(1).join(' ')] : [words.join(' ')];
    const t = this.s.add.text(x, y, lines.join('\n'), { fontFamily: 'VT323, monospace', fontSize: `${Math.round(size)}px`, color: this.paint.dark, letterSpacing: Math.round(size * 0.18), align: 'center', lineSpacing: -Math.round(size * 0.2) })
      .setOrigin(0.5).setDepth(-4.4).setAlpha(0.82);
    return t;
  }
  label(x, y, text) {
    return this.s.add.text(x, y, text.toUpperCase(), { fontFamily: 'VT323, monospace', fontSize: '30px', color: '#a6fcdb' }).setOrigin(0.5, 0).setDepth(-2.4).setAlpha(0.85);
  }

  // ---------- add-ons ----------
  // #028: a part on the outer wall of a container belongs to its skin: it fades out with it when Leyla goes in (no banner in front
  // of the workshops); it gets its own graphics for that
  addon(p) {
    if (p.at !== 'wall') return this.addonDraw(p, this.gf);
    const x = p.cx * this.T, y = p.base * this.T, box = this.containers.find(c => c.closed && !c.inside && x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1);
    const before = new Set(this.s.children.list), g = this.s.add.graphics().setDepth(-3);
    this.addonDraw(p, g);
    if (box) (box.skin ??= []).push(...this.s.children.list.filter(o => !before.has(o) && !this.glows.includes(o)));
  }
  addonDraw(p, g) {
    const s = this.s, T = this.T, P = this.paint, x = p.cx * T, base = p.base * T, w = p.w * T, h = p.h * T, c = p.color || P.main;
    const onWall = p.at === 'wall';
    if (p.look && s.textures.exists(p.look) && !p.code) {
      const im = s.add.image(x, onWall ? base : base, p.look, this.frame(p.look, p.crop)).setOrigin(0.5, onWall ? 0.5 : 1).setDisplaySize(w, h).setDepth(-2.8);
      if (p.flip) im.setFlipX(true);
      return;
    }
    const y = onWall ? base - h / 2 : base - h;
    switch (p.code) {
      case 'crane': {   // lattice mast, boom with a hook
        const mx = x - 2 * PX;
        for (let j = 0; j < h; j += 6 * PX) { this.r(g, mx - 6 * PX, y + j, 16 * PX, PX, C.rust); }
        this.r(g, mx - 6 * PX, y, 2 * PX, h, c); this.r(g, mx + 8 * PX, y, 2 * PX, h, c);
        const bl = w - T, dir = p.flip ? 1 : -1, by = y + 3 * PX;
        this.r(g, dir < 0 ? mx - bl : mx, by, bl + 10 * PX, 4 * PX, c);
        for (let i = 0; i < bl; i += 6 * PX) this.r(g, (dir < 0 ? mx - bl : mx) + i, by + 4 * PX, PX, 3 * PX, C.rust);
        const hx = mx + dir * (bl - 2 * PX);
        this.r(g, hx, by + 4 * PX, PX, h * 0.45, C.ink);
        this.r(g, hx - 3 * PX, by + 4 * PX + h * 0.45, 7 * PX, 3 * PX, C.ink);
        this.r(g, hx - 2 * PX, by + 7 * PX + h * 0.45, 5 * PX, 6 * PX, C.grey);
        this.r(g, mx - 8 * PX, y - 4 * PX, 20 * PX, 4 * PX, C.ink);
        this.blink(mx + 2 * PX, y - 4 * PX, P.light);
        break;
      }
      case 'mast': {
        this.r(g, x - PX, y, 2 * PX, h, c);
        for (let j = 2 * T; j < h; j += 1.5 * T) this.r(g, x - 4 * PX, y + j, 9 * PX, PX, c);
        this.r(g, x - 1.5 * T, y, 3 * T, 3 * PX, C.grey);   // crow's nest: the lookout on top
        this.r(g, x - 1.5 * T, y - 0.5 * T, 3 * T, PX, C.steel);
        for (let i = -1.5 * T; i <= 1.5 * T; i += 0.5 * T) this.r(g, x + i, y - 0.5 * T, PX, 0.5 * T, C.steel);
        this.r(g, x - PX, y - 1.6 * T, 2 * PX, 1.6 * T, c);
        this.r(g, x - 2 * PX, y - 1.6 * T - 2 * PX, 4 * PX, 2 * PX, P.light);
        this.blink(x, y - 1.6 * T - PX, P.light);
        break;
      }
      case 'tower': {   // drilling derrick: trapezoid lattice
        const bw = w, tw = w * 0.3;
        for (let j = 0; j <= h; j += 4 * PX) {
          const t = j / h, half = (tw + (bw - tw) * t) / 2;
          this.r(g, x - half, y + j, 2 * PX, 4 * PX, c); this.r(g, x + half - 2 * PX, y + j, 2 * PX, 4 * PX, c);
          if (j % (8 * PX) === 0) this.r(g, x - half, y + j, half * 2, PX, C.rust);
        }
        this.r(g, x - tw / 2 - PX, y - 3 * PX, tw + 2 * PX, 3 * PX, C.ink);
        this.blink(x, y - 4 * PX, P.light);
        break;
      }
      case 'banner': {
        this.r(g, x - w / 2 - PX, y - PX, w + 2 * PX, 2 * PX, C.ink);
        this.r(g, x - w / 2, y, w, h, c);
        this.r(g, x - w / 2, y, PX, h, C.black, 0.3);
        g.fillStyle(col(c)).fillTriangle(x - w / 2, y + h, x, y + h + 3 * PX, x + w / 2, y + h);
        this.logo(g, x - w * 0.3, y + h * 0.25, w * 0.6, C.gold);
        break;
      }
      case 'neon': {
        const t = s.add.text(x, y + h / 2, p.text || 'OPEN', { fontFamily: 'VT323, monospace', fontSize: `${Math.round(h * 0.95)}px`, color: c }).setOrigin(0.5).setDepth(-2.6);
        this.r(g, x - t.width / 2 - 3 * PX, y - PX, t.width + 6 * PX, h + 2 * PX, C.ink, 0.85);
        this.glow(x, y + h / 2, t.width * 1.5, h * 2.6, c, 0.45);
        s.tweens.add({ targets: t, alpha: 0.55, duration: 90, yoyo: true, repeat: -1, repeatDelay: 2600 + Math.random() * 3000 });
        break;
      }
      case 'sail': {   // sun sail on two poles, its top is walkable
        const top = base - h;
        this.r(g, x - w / 2, top, PX * 2, h, C.grey); this.r(g, x + w / 2 - 2 * PX, top, PX * 2, h, C.grey);
        g.fillStyle(col(c)).fillRect(snap(x - w / 2), snap(top - PX), snap(w), 3 * PX);
        for (let i = 0; i < w; i += 4 * T / 4) g.fillStyle(col(c)).fillTriangle(x - w / 2 + i, top + 2 * PX, x - w / 2 + i + T / 2, top + 2 * PX + 0.6 * T, x - w / 2 + i + T, top + 2 * PX);
        break;
      }
      case 'balcony': {   // a walkable plate sticking out of the wall, railing, brackets
        const top = base - h;
        this.r(g, x - w / 2, top, w, 3 * PX, c);
        this.r(g, x - w / 2, top - 0.6 * T, w, PX, C.steel);
        for (let i = x - w / 2; i <= x + w / 2; i += 0.5 * T) this.r(g, i, top - 0.6 * T, PX, 0.6 * T, C.steel);
        g.lineStyle(PX, col(C.ink)).lineBetween(x - w / 2 + PX, top + 3 * PX, x - w / 2 + 0.8 * T, top + T);
        g.lineStyle(PX, col(C.ink)).lineBetween(x + w / 2 - PX, top + 3 * PX, x + w / 2 - 0.8 * T, top + T);
        break;
      }
      case 'beacon': default: {
        this.r(g, x - PX, y + h * 0.4, 2 * PX, h * 0.6, C.grey);
        this.r(g, x - 2 * PX, y + h * 0.2, 4 * PX, 3 * PX, c);
        this.blink(x, y + h * 0.25, c);
      }
    }
  }

  // ---------- ladders (after the scene built them from the layout) ----------
  ladders(list, skip = new Set()) {
    const T = this.T, g = this.gl, rope = this.b.kind === 'airship';
    for (const l of list) {
      if (skip.has(l.tx)) continue;
      // #027: readable from afar: dark outline, light rails and rungs, a yellow cap where Leyla gets on at the top
      const below = rope && l.bottom >= this.b.G * T - T, c = below ? C.sand : C.white, rail = below ? C.copper : C.silver;
      for (const rx of [l.x0 + 10, l.x1 - 10 - 2 * PX]) { this.r(g, rx - PX, l.top, 4 * PX, l.bottom - l.top, C.ink); this.r(g, rx, l.top, 2 * PX, l.bottom - l.top, rail); }
      for (let y = l.top + 12; y < l.bottom; y += 22) { this.r(g, l.x0 + 10, y - PX, T - 20, 3 * PX, C.ink); this.r(g, l.x0 + 10, y, T - 20, PX, c); }
      if (!below) { this.r(g, l.x0 + 6, l.top - 2 * PX, T - 12, 3 * PX, C.ink); this.r(g, l.x0 + 8, l.top - PX, T - 16, PX, C.gold); }
    }
  }

  // #028 (Daniel: „richte testhalber einen Crawler mit Werkbänken und Lichterketten ein“): the workshops of a module stand on its
  // floor side by side, each as wide as its places (Werkstätten › Plätze), pictures trimmed like in the camp
  benchesIn(p, x, w, floor, h, depth) {
    const D = this.s.data_, ids = (p.workshops || []).filter(id => D.workshops?.[id]);
    if (!ids.length) return;
    const slots = Math.max(p.places || 1, ids.reduce((n, id) => n + (D.workshops[id].places || 1), 0)), slot = w / slots;
    let at = x;
    for (const id of ids) {
      const n = D.workshops[id].places || 1, bw = slot * n, key = benchTexture(this.s, D, id, bw * 0.92, h * 0.86);
      if (key) this.s.add.image(at + bw / 2, floor, key).setOrigin(0.5, 1).setDepth(depth);
      at += bw;
    }
  }
  // string lights between the upper corners of two containers (Mega-Rigs › Lichterketten), the camp's colours, sag and spacing;
  // the bulbs glow and breathe a little
  stringLights() {
    const L = lightsConfig(this.s.data_), g = this.s.add.graphics().setDepth(-2.7);
    let n = 0;
    for (const r of this.V.lights || []) {
      const a = this.docks.get(Number(r.from))?.[Number(r.fromCorner) || 0], b = this.docks.get(Number(r.to))?.[Number(r.toCorner) || 0];
      if (!a || !b) continue;
      const cat = catenary(a, b, L.sag, L.spacing);
      g.lineStyle(3, 0x141013, 0.9).beginPath(); g.moveTo(cat.line[0].x, cat.line[0].y); for (const q of cat.line) g.lineTo(q.x, q.y); g.strokePath();
      cat.bulbs.forEach((q, i) => {
        const c = L.colors[(i + n) % L.colors.length];
        g.fillStyle(0x141013).fillRect(q.x - 2, q.y, 4, 4); g.fillStyle(col(c)).fillCircle(q.x, q.y + 9, 5);
        const gl = this.glow(q.x, q.y + 9, 46, 46, c, 0.55);
        this.s.tweens.add({ targets: gl, alpha: 0.3, duration: 900 + Math.random() * 900, yoyo: true, repeat: -1, delay: Math.random() * 1200 });
      });
      n++;
    }
    this.lightCount = n;
  }

  // #027 walkways (Daniel: „die Laufwege müssen besser sichtbar und für den Spieler lesbar sein“): every surface Leyla can stand on
  // gets a light grating edge, taken from the layout itself (solid or platform with air above), except the floors inside rooms and
  // containers (they have their own floors); open ends get a small yellow post
  walkways() {
    const T = this.T, b = this.b, rows = b.rows || b.layout || [], g = this.s.add.graphics().setDepth(-2.6);
    const walk = ch => SOLID_TILES.has(ch) || ch === '=', air = ch => ch === undefined || ch === '.' || ch === 'H' || ch === 'L' || ch === '*';
    const boxes = this.b.pieces.filter(p => p.type === 'room' || p.type === 'container' || p.type === 'bridge').map(p => ({ x0: p.x, x1: p.x + p.w, row: p.floorRow }));
    const inBox = (x, y) => boxes.some(q => y === q.row && x >= q.x0 && x < q.x1);
    for (let y = 1; y < rows.length; y++) {
      if (y >= b.G) break;   // the ground has its own look
      let run = null;
      const flush = () => {
        if (!run) return;
        const x = run[0] * T, w = (run[1] - run[0] + 1) * T, top = y * T;
        this.r(g, x, top - PX, w, 4 * PX, C.ink, 0.9);
        this.r(g, x, top - PX, w, PX, C.white, 0.95);
        this.r(g, x, top, w, 2 * PX, C.steel, 0.95);
        for (let gx = x + 6; gx < x + w - 4; gx += 12) this.r(g, gx, top + PX, PX, PX, C.ink, 0.8);   // grating holes
        for (const ex of [x, x + w - 2 * PX]) this.r(g, ex, top - 3 * PX, 2 * PX, 3 * PX, C.gold);   // posts at the ends
        run = null;
      };
      for (let x = 0; x < rows[y].length; x++) {
        const ok = walk(rows[y][x]) && air(rows[y - 1]?.[x]) && !inBox(x, y);
        if (ok) { if (run && run[1] === x - 1) run[1] = x; else { flush(); run = [x, x]; } }
      }
      flush();
    }
  }

  // containers open when Leyla is near them (like in the camp), otherwise closed
  update(leyla) {
    const lx = leyla.x, ly = leyla.y;
    for (const c of this.containers) {
      if (!c.closed) continue;
      const near = c.inside ? lx > c.x0 - 40 && lx < c.x1 + 40 && ly > c.y0 + 20 && ly < c.y1 + 40   // a room in the hull: only from inside
        : lx > c.x0 - 200 && lx < c.x1 + 200 && ly > c.y0 - 120 && ly < c.y1 + 200;
      const want = near ? 0 : 1;
      c.closed.alpha += (want - c.closed.alpha) * 0.15;
      for (const e of c.extra || []) e.alpha = c.closed.alpha * 0.82;
      for (const e of c.inner || []) e.alpha = (1 - c.closed.alpha) * 0.85;
      for (const e of c.skin || []) e.alpha = c.closed.alpha;
    }
  }
}

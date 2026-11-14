// Mega rigs (#022): draws a vehicle built by engine/megarig.js. The raw vehicle comes from its image (truck) or from code
// (crawler, fatbird) in strict side view on a 4 px pixel grid with AAP-64 colours; modules are the container pictures of the camp,
// rooms inside the hull are drawn from code; add-ons are cut-outs of a parts sheet or code. Everything lies behind Leyla.
const PX = 4;   // one art pixel = 4 game pixels, like the container and truck pictures
const col = c => (typeof c === 'number' ? c : parseInt(String(c || '#ff00ff').slice(1), 16));
const snap = v => Math.round(v / PX) * PX;
// AAP-64 colours used by the code art
const C = { black: '#060608', ink: '#141013', night: '#242234', violet: '#403353', plum: '#793a80', grey: '#4a5462', steel: '#6d758d', silver: '#8b93af', pale: '#b3b9d1', white: '#dae0ea',
  brown: '#322b28', mud: '#221c1a', rust: '#71413b', copper: '#bb7547', sand: '#dba463', yellow: '#f9a31b', gold: '#ffd541', red: '#df3e23', cyan: '#20d6c7', blue: '#249fde', pink: '#bc4a9b', rose: '#f5a097', glass: '#285cc4' };
const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// container picture geometry (assets/rig/container_*): body from x 17, 121 px for one place + 101 per further place, roof at y 83, bottom at 187
const BOX = { left: 17, one: 121, more: 101, roof: 83, bottom: 187 };

export class MegarigView {
  constructor(scene, build, T) {
    this.s = scene; this.b = build; this.T = T;
    this.containers = [];
    this.glows = [];
    const D = scene.data_, V = D.megarigs?.[scene.args.megarig.id] || {};
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
    }
    for (const p of build.pieces) if (p.type === 'addon') this.addon(p);
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

  // ---------- raw vehicles ----------
  truck(h) {
    const T = this.T, s = this.s, g = this.g, b = this.b, ground = b.G * T, x0 = b.x0 * T;
    // semi-trailer: bed at the deck height from the fifth wheel to the end, gooseneck, landing legs, three axles
    const bx = (b.x0 + h.front - 1.5) * T, bw = (h.places * h.P + h.back + 1.5) * T, deck = (b.G - h.under) * T;
    this.r(g, bx, deck, bw, T, C.night);
    this.r(g, bx + PX, deck + PX, bw - 2 * PX, T - 6 * PX, this.paint.main);
    this.rivets(g, bx, deck + 3 * PX, bw, C.night, 32);
    this.hazard(g, bx + bw - 2 * T, deck + T - 5 * PX, 2 * T, 4 * PX);
    this.r(g, bx + 2 * T, deck + T, bw - 3 * T, 6 * PX, C.ink);   // main beam under the bed
    this.r(g, bx + 1.2 * T + bw * 0.25, deck + T, 6 * PX, ground - deck - T - 2 * PX, C.grey);   // landing leg
    this.r(g, bx + 1.2 * T + bw * 0.25 - 4 * PX, ground - 3 * PX, 14 * PX, 3 * PX, C.ink);
    for (let i = 0; i < 3; i++) this.wheel(bx + bw - (1.6 + i * 2.15) * T, ground - T, 2 * T);
    this.r(g, bx + bw - 7.6 * T, deck + T, 6.6 * T, 5 * PX, C.ink);   // mudguard bar
    this.r(g, bx + bw - PX * 3, deck + 2 * PX, PX * 2, PX * 3, C.red);   // tail light
    this.glow(bx + bw, deck + 4 * PX, 70, 50, C.red, 0.5);
    // the cab: the truck picture from PixelLab, strict side view
    if (h.look && s.textures.exists(h.look)) {
      const [ox, oy] = h.lookOffset || [0, 0];
      s.add.image(x0 + ox, ground + oy, h.look).setOrigin(0, 1).setScale(h.lookScale || 4).setDepth(-3.5);
      this.glow(x0 + 10, ground - 2.2 * T, 90, 60, C.cyan, 0.35);   // headlight
    }
  }

  crawler(h) {
    const T = this.T, g = this.g, b = this.b, P = this.paint, ground = b.G * T, x0 = b.x0 * T, len = h.len * T;
    const bottom = (b.G - h.under) * T, top = (b.G - h.hullTop) * T, front = h.front * T, r = rng(7);
    // two track units: dark tread loops with road wheels, a bogie block between them
    const units = [[x0 + 1 * T, Math.min(len * 0.44, 24 * T)], [x0 + len - Math.min(len * 0.44, 24 * T) - T, Math.min(len * 0.44, 24 * T)]];
    this.r(g, x0 + 3 * T, bottom, len - 6 * T, h.under * T * 0.55, C.night);
    for (let i = x0 + 4 * T; i < x0 + len - 4 * T; i += 3 * T) this.r(g, i, bottom + 2 * PX, 2 * T, 6 * PX, C.violet);
    for (const [ux, uw] of units) {
      const th = h.under * T - 2 * PX, ty = ground - th;
      this.r(g, ux + 4 * PX, ty, uw - 8 * PX, th, C.mud);
      this.r(g, ux, ty + 4 * PX, uw, th - 8 * PX, C.mud);
      for (let i = ux + 2 * PX; i < ux + uw - 2 * PX; i += 6 * PX) { this.r(g, i, ty, 3 * PX, 2 * PX, C.brown); this.r(g, i, ground - 2 * PX, 3 * PX, 2 * PX, C.brown); }   // tread teeth
      this.r(g, ux + 3 * PX, ty + 3 * PX, uw - 6 * PX, th - 6 * PX, C.brown);
      const n = Math.max(3, Math.round(uw / (2.6 * T))), d = Math.min(th - 8 * PX, 2.2 * T);
      for (let k = 0; k < n; k++) {
        const cx = ux + uw * (k + 0.5) / n, cy = ground - th / 2;
        g.fillStyle(col(C.ink)).fillCircle(cx, cy, d / 2);
        g.fillStyle(col(C.grey)).fillCircle(cx, cy, d / 2 - 3 * PX);
        g.fillStyle(col(C.steel)).fillCircle(cx, cy, d / 5);
        this.r(g, cx - PX, cy - PX, 2 * PX, 2 * PX, C.ink);
      }
      this.r(g, ux + 6 * PX, ty - 3 * PX, uw - 12 * PX, 3 * PX, P.dark);   // track guard
      this.hazard(g, ux + uw * 0.3, ty - 3 * PX, uw * 0.4, 3 * PX);
    }
    // hull body with panels per place
    this.plate(g, x0 + 2 * T, top, len - 2 * T, bottom - top + T, P.main, P.dark, P.trim, 3);
    for (let p = 0; p <= h.places; p++) { const px = x0 + front + p * h.P * T; this.r(g, px - PX, top + T, 2 * PX, bottom - top - T, P.dark, 0.7); }
    this.hazard(g, x0 + 2 * T, bottom + T - 4 * PX, len - 2 * T, 4 * PX);
    this.r(g, x0 + 2 * T, top, len - 2 * T, T, P.dark);   // deck slab
    this.rivets(g, x0 + 2 * T, top + 6 * PX, len - 2 * T, P.main, 28);
    // cab: block up to one story above the deck, slanted nose, a lit bridge window
    const cy = top - h.S * T, cx = x0 + 2 * T, cw = front - 3 * T;
    this.plate(g, cx, cy, cw, top - cy + T, P.main, P.dark, P.trim, 5);
    // slanted nose: cut the top-left corner with sky-coloured steps of the dark tone
    for (let i = 0; i < 8; i++) this.r(g, cx, cy + i * 2 * PX, (8 - i) * 3 * PX, 2 * PX, P.dark);
    const wx = cx + 2.4 * T, wy = cy + 1.4 * T, ww = cw - 3.4 * T, wh = 2 * T;
    this.r(g, wx - PX, wy - PX, ww + 2 * PX, wh + 2 * PX, C.ink);
    this.r(g, wx, wy, ww, wh, C.gold, 0.85);
    for (let i = wx + T; i < wx + ww; i += T * 1.3) this.r(g, i, wy, 2 * PX, wh, C.ink);
    this.glow(wx + ww / 2, wy + wh / 2, ww * 1.4, wh * 2.2, C.gold, 0.35);
    this.logo(g, cx + cw - 3.2 * T, cy + 3.8 * T, 1.8 * T, P.dark);
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
    const env = this.s.add.graphics().setDepth(-6.5);
    const ell = (c, inset, a = 1) => { env.fillStyle(col(c), a); env.fillEllipse(ex + ew / 2, ey + eh / 2 + inset / 3, ew - inset * 2, eh - inset); };
    ell(C.steel, 0); ell(C.silver, 2 * PX); ell(C.pale, 6 * PX);
    env.fillStyle(col(C.white), 0.9).fillEllipse(ex + ew / 2, ey + eh * 0.3, ew * 0.8, eh * 0.25);
    for (let i = 1; i < 12; i++) { const sx = ex + ew * i / 12, k = Math.sqrt(1 - Math.pow((sx - ex - ew / 2) / (ew / 2), 2)); env.fillStyle(col(C.steel), 0.6).fillRect(snap(sx), snap(ey + eh / 2 - eh / 2 * k + 2 * PX), PX, snap(eh * k - 4 * PX)); }
    env.fillStyle(col(P.neon), 0.9).fillRect(snap(ex + ew * 0.08), snap(ey + eh * 0.55), snap(ew * 0.84), 2 * PX);
    this.glow(ex + ew / 2, ey + eh * 0.55, ew * 0.9, 50, P.neon, 0.35);
    this.logo(env, ex + ew * 0.32, ey + eh * 0.3, 2.6 * T, P.main);
    this.r(this.gf, ex + ew * 0.15, ey - 0.8 * T, ew * 0.7, PX, C.steel);   // catwalk rail
    for (let i = ex + ew * 0.15; i < ex + ew * 0.85; i += T) this.r(this.gf, i, ey - 0.8 * T, PX, 0.8 * T, C.steel);
    for (let i = 0; i < 6; i++) this.r(g, ex + ew * (0.18 + i * 0.13), ey + eh - 2 * PX, PX, top - ey - eh + 4 * PX, C.ink);   // straps down to the hull
    // fuselage: closed decks, cockpit nose, engine block at the back
    this.plate(g, x0 + 2 * T, top, len - 3 * T, frameTop - top + T, P.main, P.dark, P.trim, 11);
    for (let p = 0; p <= h.places; p++) this.r(g, x0 + front + p * h.P * T - PX, top + T, 2 * PX, frameTop - top - T, P.dark, 0.7);
    this.r(g, x0 + 2 * T, top, len - 3 * T, T, P.dark);
    this.hazard(g, x0 + 2 * T, frameTop + T - 4 * PX, len - 3 * T, 4 * PX);
    // cockpit: rounded nose with a glowing window, a front balcony
    const nx = x0 - 1 * T, ny = top + 1.2 * T, nw = 3.5 * T, nh = frameTop - top - 0.6 * T;
    g.fillStyle(col(P.dark)).fillRoundedRect(nx, ny, nw + 2 * T, nh, 40);
    g.fillStyle(col(P.main)).fillRoundedRect(nx + PX, ny + PX, nw + 2 * T, nh - 2 * PX, 36);
    this.r(g, nx + 2 * PX, ny + 1.2 * T, 2.8 * T, 1.6 * T, C.ink);
    this.r(g, nx + 3 * PX, ny + 1.2 * T + PX, 2.8 * T - 2 * PX, 1.6 * T - 2 * PX, C.gold, 0.85);
    this.glow(nx + 1.4 * T, ny + 2 * T, 260, 150, C.gold, 0.4);
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
    this.g.lineStyle(0.5 * T, col(C.night)).lineBetween(ax, y + 0.8 * T, hullX, hullTop + T);
    this.g.lineStyle(2 * PX, col(this.paint.dark)).lineBetween(ax, y + 1.4 * T, hullX, hullTop + 2.5 * T);
    g.fillStyle(col(C.ink)).fillRoundedRect(x, y, w, 1.6 * T, 20);
    g.fillStyle(col(C.grey)).fillRoundedRect(x + PX, y + PX, w - 2 * PX, 1.6 * T - 2 * PX, 18);
    this.r(g, x + w * 0.42, y + PX, w * 0.16, 1.6 * T - 2 * PX, P.main);
    this.r(g, x + 2 * PX, y + 1.6 * T - 3 * PX, w - 4 * PX, 2 * PX, C.night);
    this.r(g, x + w * 0.2, y + 1.6 * T, w * 0.6, PX, P.neon);
    this.glow(x + w / 2, y + 2.2 * T, w * 1.1, 1.6 * T, P.neon, 0.55);
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
    this.containers.push({ open: o, closed: c, x0: p.x * T, x1: (p.x + p.w) * T, y0: (p.y - 1) * T, y1: (p.floorRow + 1) * T });
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
    if (p.name) this.label(x + w / 2, y + 0.5 * T, p.name);
  }

  label(x, y, text) {
    this.s.add.text(x, y, text.toUpperCase(), { fontFamily: 'VT323, monospace', fontSize: '30px', color: '#a6fcdb' }).setOrigin(0.5, 0).setDepth(-2.4).setAlpha(0.85);
  }

  // ---------- add-ons ----------
  addon(p) {
    const s = this.s, T = this.T, g = this.gf, P = this.paint, x = p.cx * T, base = p.base * T, w = p.w * T, h = p.h * T, c = p.color || P.main;
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
      const below = rope && l.bottom >= this.b.G * T - T, c = below ? C.copper : C.silver, rail = below ? C.rust : C.grey;
      this.r(g, l.x0 + 10, l.top, 2 * PX, l.bottom - l.top, rail);
      this.r(g, l.x1 - 10 - 2 * PX, l.top, 2 * PX, l.bottom - l.top, rail);
      for (let y = l.top + 12; y < l.bottom; y += 22) this.r(g, l.x0 + 10, y, T - 20, PX, c);
    }
  }

  // containers open when Leyla is near them (like in the camp), otherwise closed
  update(leyla) {
    const lx = leyla.x, ly = leyla.y;
    for (const c of this.containers) {
      if (!c.closed) continue;
      const near = lx > c.x0 - 200 && lx < c.x1 + 200 && ly > c.y0 - 120 && ly < c.y1 + 200;
      const want = near ? 0 : 1;
      c.closed.alpha += (want - c.closed.alpha) * 0.15;
    }
  }
}

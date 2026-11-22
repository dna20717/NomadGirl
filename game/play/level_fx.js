// Level design in the picture (#163, Bibel › Level-Design, Wow-Moment): the landmark of the POI (in the sky outdoors, through windows in
// the back wall indoors, shown and hidden in turns), guide lines to the way on, signs at secrets (crack, draft, light through a slit),
// and the Wow room: its motif as a code silhouette (AAP-64, glow, VT323), movement, a camera move on the first entry (once per run,
// any input stops it, Leyla stays in control), a stinger and a music layer. Logic in engine/level_design.js; nothing here blocks play.
import { landmarkViews, guideLines, secretSigns, wowInLevel, levelConfig } from '../../engine/level_design.js';
import { drawShaft } from './shaft_fx.js';

// AAP-64 (projects/nomadgirl/assets/palette/aap-64.hex): every colour snaps to it
const AAP = '060608 141013 3b1725 73172d b4202a df3e23 fa6a0a f9a31b ffd541 fffc40 d6f264 9cdb43 59c135 14a02e 1a7a3e 24523b 122020 143464 285cc4 249fde 20d6c7 a6fcdb ffffff fef3c0 fad6b8 f5a097 e86a73 bc4a9b 793a80 403353 242234 221c1a 322b28 71413b bb7547 dba463 f4d29c dae0ea b3b9d1 8b93af 6d758d 4a5462 333941 422433 5b3138 8e5252 ba756a e9b5a3 e3e6ff b9bffb 849be4 588dbe 477d85 23674e 328464 5daf8d 92dcba cdf7e2 e4d2aa c7b08b a08662 796755 5a4e44 423934'.split(' ').map(h => parseInt(h, 16));
export function aap(c) {
  const n = typeof c === 'number' ? c : parseInt(String(c || '#ffffff').replace('#', ''), 16);
  const d = (a, b) => ((a >> 16) - (b >> 16)) ** 2 + ((a >> 8 & 255) - (b >> 8 & 255)) ** 2 + ((a & 255) - (b & 255)) ** 2;
  return AAP.reduce((best, p) => d(p, n) < d(best, n) ? p : best, AAP[0]);
}
const DARK = 0x333941, STEEL = 0x6d758d, RUST = 0x71413b, BONE = 0xdae0ea, INK = 0x221c1a;
const hex = n => '#' + n.toString(16).padStart(6, '0');

export class LevelFx {
  constructor(scene) {
    const s = this.scene = scene, LI = s.levelInfo, D = s.data_;
    this.on = !!LI?.def && s.mode !== 'camp' && !s.megarig;
    if (!this.on) return;
    this.T = s.T; this.D = D; this.cfg = levelConfig(D); this.P = D.pois?.[s.levelPoi] || {};
    this.parts = []; this.anim = [];
    this.views = landmarkViews(D, s.levelPoi, LI, this.cfg);
    this.drawLandmark();
    this.drawGuides(guideLines(D, s.levelPoi, LI));
    this.signs = secretSigns(LI, this.cfg); this.drawSigns();
    this.shaft = drawShaft(s);   // #173 the rocket through the whole silo (POIs › Schacht-Motiv)
    this.wow = wowInLevel(D, s.levelPoi, LI);
    if (this.wow) this.drawWow();
    s.events.once('shutdown', () => this.stopMusic(true));
  }
  // ---------- landmark: far away, slow parallax, behind the back wall (so indoors only the windows show it) ----------
  drawLandmark() {
    const s = this.scene, L = this.P.level || {}, T = this.T;
    if (!L.landmark || !this.views.some(v => v.how)) return;
    const W = s.room.w * T, H = s.room.h * T, vw = s.scale.width, vh = s.scale.height, sf = 0.12;
    const g = s.add.graphics().setDepth(-60).setScrollFactor(sf), col = aap(L.landmarkColor || '#ffd541');
    // where the camera is around the middle of the level, the landmark stands right of the middle of the view, its foot near the horizon
    const cx = (W / 2 - vw / 2) * sf + vw * 0.62, foot = (H * 0.6 - vh / 2) * sf + vh * 0.72;
    const pic = L.landmarkImage && s.textures.exists(L.landmarkImage) ? L.landmarkImage : null;   // #165 the painted landmark
    if (pic) {
      const src = s.textures.get(pic).getSourceImage(), k = vh * 0.42 / src.height;
      this.landmark = s.add.image(cx, foot, pic).setOrigin(0.5, 1).setScale(k).setScrollFactor(sf).setDepth(-60).setTint(0xb0a8c0);
      g.fillStyle(col, 0.08).fillCircle(cx, foot - src.height * k * 0.6, src.height * k * 0.55);
    } else {
      drawMotif(g, L.landmarkMotif || 'neon', cx, foot, vh * 0.42 / (5 * 64), col, { far: true, text: L.landmark.length < 14 ? L.landmark : '' });
      this.landmark = g;
    }
    // windows: the view outside (dusk sky, the far city, the landmark small) and a frame with mullions on the back wall around every hole
    const fr = s.add.graphics().setDepth(-10.8), view = s.add.graphics().setDepth(-10.9);
    const wowX = this.scene.levelInfo.rooms.find(r => r.wow)?.x ?? s.room.w;
    for (const v of this.views) if (v.how === 'window' && v.win) {
      const { x, y, w, h } = v.win, X = x * T, Y = y * T, WW = w * T, HH = h * T;
      view.fillGradientStyle(0x285cc4, 0x285cc4, 0xf5a097, 0xf5a097, 1).fillRect(X, Y, WW, HH);
      view.fillStyle(0x403353, 1); for (let i = 0; i < 9; i++) { const bh = (0.18 + ((i * 7 + x) % 5) * 0.07) * HH; view.fillRect(X + i * WW / 9, Y + HH - bh, WW / 9 - 2, bh); }
      const side = wowX > x ? 0.72 : 0.28;
      if (pic) {   // #165 the painted landmark in the window, cropped to the hole
        const src = s.textures.get(pic).getSourceImage(), k = HH * 0.8 / src.height, ix = X + WW * side, iy = Y + HH * 0.98;
        const left = ix - src.width * k / 2, top = iy - src.height * k;
        const c0 = Math.max(0, (X - left) / k), c1 = Math.min(src.width, (X + WW - left) / k), r0 = Math.max(0, (Y - top) / k);
        if (c1 > c0) s.add.image(left, top, pic).setOrigin(0).setScale(k).setDepth(-10.85).setTint(0xc8c0d0).setCrop(c0, r0, c1 - c0, src.height - r0);
      } else drawMotif(view, L.landmarkMotif || 'neon', X + WW * side, Y + HH * 0.98, HH * 0.8 / (5 * 64), col, { far: true });
      fr.lineStyle(10, INK, 1).strokeRect(x * T - 4, y * T - 4, w * T + 8, h * T + 8);
      fr.lineStyle(5, STEEL, 1).lineBetween((x + w / 2) * T, y * T, (x + w / 2) * T, (y + h) * T).lineBetween(x * T, (y + h / 2) * T, (x + w) * T, (y + h / 2) * T);
      fr.fillStyle(DARK, 0.9).fillRect(x * T - 8, (y + h) * T + 4, w * T + 16, 10);   // sill
    }
  }
  // ---------- guide lines (Leitlinie): along the floor or under the ceiling, towards the way on ----------
  drawGuides(lines) {
    if (!lines.length) return;
    const s = this.scene, T = this.T, L = this.P.level || {}, col = aap(L.guideColor || '#c7b08b');
    const g = s.add.graphics().setDepth(-9.8), glow = s.add.graphics().setDepth(-9.7).setBlendMode(Phaser.BlendModes.ADD);
    this.guides = { g, glow, lines, kind: L.guideKind, col };
    for (const ln of lines) for (let i = 1; i < ln.pts.length; i++) {
      const [ax, ay] = ln.pts[i - 1], [bx, by] = ln.pts[i];
      if (Math.abs(ay - by) > (ln.high ? 2 : 0)) continue;
      const x0 = (ax + 0.5) * T, x1 = (bx + 0.5) * T, dir = Math.sign(bx - ax) || 1;
      if (ln.high) {   // cable, pipe, string of lights: a sag between two hooks under the ceiling
        const y0 = ay * T + 6, y1 = by * T + 6, sag = Math.min(40, Math.abs(x1 - x0) * 0.18);
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x0, y0), new Phaser.Math.Vector2((x0 + x1) / 2, Math.max(y0, y1) + sag), new Phaser.Math.Vector2(x1, y1));
        g.lineStyle(ln.kind === 'pipe' ? 10 : 4, ln.kind === 'pipe' ? STEEL : INK, 1); curve.draw(g, 24);
        if (ln.kind === 'pipe') { g.lineStyle(2, 0x8b93af, 0.8); new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x0, y0 - 3), new Phaser.Math.Vector2((x0 + x1) / 2, Math.max(y0, y1) + sag - 3), new Phaser.Math.Vector2(x1, y1 - 3)).draw(g, 24); }
        if (ln.kind === 'lights') for (let k = 1; k < 6; k++) { const p = curve.getPoint(k / 6); g.fillStyle(col, 1).fillCircle(p.x, p.y + 5, 4); glow.fillStyle(col, 0.25).fillCircle(p.x, p.y + 5, 14); }
        continue;
      }
      const y = (ay + 1) * T - 3;   // on the floor
      if (ln.kind === 'carpet') g.fillStyle(col, 0.9).fillRect(Math.min(x0, x1), y - 3, Math.abs(x1 - x0), 6);
      else if (ln.kind === 'rail') { g.lineStyle(3, 0x8b93af, 0.9).lineBetween(x0, y - 4, x1, y - 4).lineBetween(x0, y, x1, y); for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x += 24) g.fillStyle(RUST, 1).fillRect(x, y - 6, 6, 8); }
      else if (ln.kind === 'mud') { g.lineStyle(5, col, 0.8).beginPath(); for (let x = Math.min(x0, x1), k = 0; x <= Math.max(x0, x1); x += 16, k++) g.lineTo(x, y - 2 + Math.sin(k * 1.3) * 2); g.strokePath(); }
      else if (ln.kind === 'arrows') for (let x = x0 + dir * T; dir > 0 ? x < x1 : x > x1; x += dir * T * 3) g.lineStyle(5, col, 0.85).lineBetween(x - dir * 12, y - 10, x, y - 3).lineBetween(x, y - 3, x - dir * 12, y + 4);
      else for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x += 32) { g.fillStyle(col, 0.9).fillRect(x, y - 2, 14, 4); glow.fillStyle(col, 0.18).fillRect(x - 6, y - 8, 26, 14); }   // strip of emergency lights
    }
  }
  // ---------- signs at secrets: crack, draft (paper scraps drift there), light through a slit; the first one clearest ----------
  drawSigns() {
    if (!this.signs.length) return;
    const s = this.scene, T = this.T, g = s.add.graphics().setDepth(10.7), glow = s.add.graphics().setDepth(10.75).setBlendMode(Phaser.BlendModes.ADD);
    this.signG = { g, glow };
    for (const sg of this.signs) {
      const [wx, wy] = sg.at, a = 0.35 + 0.6 * sg.strength, side = sg.x < wx ? -1 : 1, fx = side < 0 ? wx * T : (wx + 1) * T;
      if (sg.kind === 'crack') {   // a jagged crack on the wall face, reaching into the wall
        g.lineStyle(3, DARK, a).beginPath().moveTo(fx, wy * T + 10);
        for (let k = 1; k <= 5; k++) g.lineTo(fx - side * (k * 6 + (k % 2) * 6), wy * T + 10 + k * 9);
        g.strokePath(); g.lineStyle(2, DARK, a * 0.8).lineBetween(fx - side * 18, wy * T + 28, fx - side * 30, wy * T + 22);
      } else if (sg.kind === 'slit') {   // light through a gap
        glow.fillStyle(0xfef3c0, 0.18 * sg.strength + 0.08).fillRect(fx - (side < 0 ? 0 : 3), wy * T + 6, 3, T - 12);
        glow.fillStyle(0xfef3c0, 0.08 * sg.strength + 0.04).fillTriangle(fx, wy * T + 8, fx, (wy + 1) * T - 8, fx + side * T * 1.6, (wy + 1) * T + 10);
      }
      sg.side = side; sg.fx = fx;
    }
  }
  // ---------- the Wow room ----------
  drawWow() {
    const s = this.scene, T = this.T, w = this.wow, W = w.W, r = w.room;
    const g = s.add.graphics().setDepth(-10.6), col = aap(W.light || '#ffd541');
    const bx = (w.x + 0.5) * T, by = (w.y + 1) * T, k = (W.scale ?? 150) / 100;
    // #173 the shaft's motif stands in this room (the rocket on its pad): it is the Wow motif, no picture and no silhouette on top
    const SH = this.shaft && this.shaft.sh.bottomRoom === w.index ? this.shaft : null;
    if (SH) return this.drawWowShaft(g, SH, col);
    const pic = W.image && s.textures.exists(W.image) ? this.drawWowImage(g, bx, by, k, col) : null;   // #165 the painted motif
    if (!pic) drawMotif(g, w.motif, bx, by, k, col, { text: W.text || '', room: { x: r.x * T, y: r.y * T, w: r.w * T, h: r.h * T }, T });   // fallback: code silhouette
    this.wowG = g; this.wowPic = pic;
    const gx = pic ? pic.core.x : bx, gy = pic ? pic.core.y : by - 2.5 * T * k, R = pic ? Math.max(pic.w, pic.h) * 0.42 : 3.2 * T * k;
    this.wowGlow = s.add.graphics().setDepth(-10.55).setBlendMode(Phaser.BlendModes.ADD);
    this.wowGlow.fillStyle(col, 0.12).fillCircle(gx, gy, R).fillStyle(col, 0.1).fillCircle(gx, gy, R / 2);
    this.wowFx = s.add.graphics().setDepth(-9.6).setBlendMode(Phaser.BlendModes.ADD);
    this.wowBox = { x: r.x * T, y: r.y * T, w: r.w * T, h: r.h * T, bx, by: pic && !W.imageHang ? pic.bottom : by, top: pic ? pic.top : by - 5 * T * k, bottom: pic?.bottom, core: pic?.core, half: pic ? pic.w / 2 : 3 * T };
  }
  // #173 the Wow room at the foot of the shaft: glow at the nozzles, the counter on a console beside the pad, steam from the trench
  drawWowShaft(g, SH, col) {
    const s = this.scene, T = this.T, w = this.wow, W = w.W, r = w.room;
    const nozzles = { x: SH.cx, y: SH.stand - 1.5 * T };
    this.wowG = g; this.wowPic = { core: nozzles, w: SH.half * 2, h: 12 * T, img: null };
    this.wowGlow = s.add.graphics().setDepth(-10.55).setBlendMode(Phaser.BlendModes.ADD);
    this.wowGlow.fillStyle(col, 0.12).fillCircle(nozzles.x, nozzles.y, 5 * T).fillStyle(col, 0.1).fillCircle(nozzles.x, nozzles.y, 2.5 * T);
    this.wowFx = s.add.graphics().setDepth(-9.6).setBlendMode(Phaser.BlendModes.ADD);
    this.wowPulse = s.add.graphics().setDepth(-10.55).setBlendMode(Phaser.BlendModes.ADD);
    // the counter: a console on a post right of the pad (inside the room), VT323 from code
    const floor = (r.y + r.h - 1) * T, x = Math.min((r.x + r.w - 5) * T, SH.cx + SH.half + 0.6 * T), y = floor - 3.2 * T;
    g.fillStyle(0x333941, 1).fillRect(x, y, 3.4 * T, 1.2 * T).lineStyle(4, 0x4a5462, 1).strokeRect(x, y, 3.4 * T, 1.2 * T).fillRect(x + 1.5 * T, y + 1.2 * T, 0.3 * T, floor - y - 1.2 * T);
    vtext(s, x + 1.7 * T, y + 0.6 * T, W.text || '00:00:01', 0.9 * T, 0xe83b3b, -10.58);
    this.wowBox = { x: r.x * T, y: r.y * T, w: r.w * T, h: r.h * T, bx: SH.cx, by: floor, top: Math.max(r.y * T, SH.stand - 14 * T), core: nozzles, half: SH.half, shaft: SH };
  }
  // #165 the painted motif (POIs › Wow › Motiv: gemaltes Bild): foot on the motif point (or hung under the ceiling), with what moves on it
  // from code: the second hand of the clock, the counter beside the rocket, text, a pulsing core, light cones under a dome, the chandelier
  drawWowImage(g, bx, by, k, col) {
    const s = this.scene, T = this.T, w = this.wow, W = w.W, r = w.room;
    const src = s.textures.get(W.image).getSourceImage(), H = (W.imageTiles || 5 * k) * T, sc = H / src.height, Wd = src.width * sc;
    const drop = W.imageHang ? Math.max(0, +W.imageDrop || 0) * T : 0;   // #170 hangs lower: in the game's zoom the dome must be seen
    const top = W.imageHang ? (r.y + 1) * T + drop : by - H;
    if (drop) {   // steel cables and two girders carry it from the ceiling
      for (const f of [-0.42, -0.14, 0.14, 0.42]) g.lineStyle(f === -0.14 || f === 0.14 ? 3 : 6, f === -0.14 || f === 0.14 ? 0x4a5462 : 0x333941, 1).lineBetween(bx + Wd * f, (r.y + 1) * T, bx + Wd * f * 0.96, top + H * 0.08);
      g.fillStyle(0x333941, 1); for (const f of [-0.42, 0.42]) g.fillRect(bx + Wd * f - 8, (r.y + 1) * T, 16, 10);
    }
    const img = s.add.image(bx, top, W.image).setOrigin(0.5, 0).setScale(sc).setDepth(-10.6);
    const at = p => ({ x: bx + (p[0] - src.width / 2) * sc, y: top + p[1] * sc });
    const core = at(W.imageCore || [src.width / 2, src.height / 2]);
    const pic = { img, top, bottom: top + H, w: Wd, h: H, core, sc };
    if (W.imageText && W.text) vtext(s, at(W.imageText).x, at(W.imageText).y, W.text, Math.max(18, H * 0.07), col, -10.58);
    if (w.motif === 'clock') {
      const R = H * 0.2, hand = s.add.graphics().setDepth(-10.58);
      hand.lineStyle(Math.max(3, H * 0.008), 0xb4202a, 1).lineBetween(0, R * 0.15, 0, -R).fillStyle(0xb4202a, 1).fillCircle(0, 0, Math.max(4, H * 0.012));
      hand.setPosition(core.x, core.y); s.tweens.add({ targets: hand, angle: 360, duration: 60000, repeat: -1 });
      const cy = (r.y + 1) * T + 0.2 * T;   // the chandelier under the ceiling
      if (top - cy > 3 * T) for (const dx of [-Wd * 0.9, Wd * 0.9]) {
        const x = bx + dx; g.lineStyle(4, 0xa08662, 1).lineBetween(x, cy - 0.2 * T, x, cy + 1.2 * T);
        g.fillStyle(0xa08662, 1).fillTriangle(x - 1.2 * T, cy + 1.5 * T, x + 1.2 * T, cy + 1.5 * T, x, cy + 1.1 * T);
        g.fillStyle(0xf4d29c, 1); for (let i = -4; i <= 4; i++) g.fillCircle(x + i * 0.28 * T, cy + 1.55 * T + Math.abs(i) * 0.06 * T, 7);
        this.chandeliers = [...(this.chandeliers || []), { x, y: cy + 1.5 * T }];
      }
    }
    if (w.motif === 'rocket') {   // the counter on the launch console beside the rocket
      const x = bx + Wd / 2 + 0.4 * T, y = pic.bottom - 2.4 * T;
      g.fillStyle(DARK, 1).fillRect(x, y, 3.4 * T, 1.2 * T).lineStyle(4, 0x4a5462, 1).strokeRect(x, y, 3.4 * T, 1.2 * T).fillRect(x + 1.5 * T, y + 1.2 * T, 0.3 * T, pic.bottom - y - 1.2 * T);
      vtext(s, x + 1.7 * T, y + 0.6 * T, W.text || '00:00:01', 0.9 * T, 0xe83b3b, -10.58);
    }
    if (W.imageHang) {   // light falls from the dome to the floor
      const L = s.add.graphics().setDepth(-10.5).setBlendMode(Phaser.BlendModes.ADD), y0 = pic.bottom - H * 0.25;
      L.fillStyle(col, 0.06).fillTriangle(bx - Wd * 0.3, y0, bx + Wd * 0.3, y0, bx + Wd * 0.55, by).fillTriangle(bx - Wd * 0.3, y0, bx - Wd * 0.55, by, bx + Wd * 0.55, by);
      L.fillStyle(col, 0.05).fillTriangle(bx - Wd * 0.12, y0, bx + Wd * 0.12, y0, bx, by);
    }
    this.wowPulse = s.add.graphics().setDepth(-10.55).setBlendMode(Phaser.BlendModes.ADD);
    return pic;
  }
  // the room Leyla is in changed (scene_events.js runUpdate): the Wow moment on the first entry
  enterRoom(here) {
    if (!this.on) return;
    const inWow = !!(here && this.wow && here.id === this.wow.room.id && here.x === this.wow.room.x && here.y === this.wow.room.y);
    if (inWow && !this.inWow) this.startWow();
    if (!inWow && this.inWow) this.stopMusic();
    this.inWow = inWow;
  }
  startWow() {
    const s = this.scene, W = this.wow.W, C = this.cfg;
    if ((s.elapsed || 0) < 600) { s.time.delayedCall(800, () => { if (this.inWow) this.startWow(); }); return; }   // the run just began (Mile 7: the forecourt)
    this.startMusic(); this.stinger(W.stinger || 'swell');
    if (this.wowDone || W.camera === false || !s.cam) return;
    this.wowDone = true;
    const cam = s.cam, base = cam.zoom, ms = C.wowMs, z = base * C.wowZoom / 100, B = this.wowBox;
    if (B.shaft?.sh.cfg.ride) return this.rideShaft(cam, base, z, ms);
    const tx = B.bx, ty = W.imageHang && B.bottom ? (B.top + B.by) / 2 : Math.max(B.top + 2 * this.T, B.by - 3 * this.T);   // #170 a hanging motif: frame it and the floor
    this.wowCam = { base, at: s.time.now, until: s.time.now + ms + C.wowHold, back: false };
    cam.stopFollow();
    cam.pan(tx, ty, ms, 'Sine.easeInOut', true);
    cam.zoomTo(z, ms, 'Sine.easeInOut', true);
    const stop = () => this.endWowCam();
    this.wowStop = stop;
    s.input.keyboard?.once('keydown', stop); s.input.once('pointerdown', stop);
    s.time.delayedCall(ms + C.wowHold, stop);
  }
  // #173 the ride up the rocket: zoom out at its foot, up the hull to the tip, a breath there, back down to the pad; any key, a click
  // or Leyla's first steps stop it (she stays in control the whole time)
  rideShaft(cam, base, z, ms) {
    const s = this.scene, T = this.T, B = this.wowBox, SH = B.shaft, C = this.cfg;
    const up = SH.sh.cfg.rideMs, lead = Math.round(ms * 0.6);
    this.wowCam = { base, at: s.time.now, back: false, ride: { x: SH.cx, foot: B.by - 4 * T, tip: SH.top + 4 * T, lead, up, hold: C.wowHold, down: Math.round(up * 0.6) }, from: s.leyla?.x ?? 0 };
    cam.stopFollow();
    cam.pan(SH.cx, B.by - 4 * T, lead, 'Sine.easeInOut', true);
    cam.zoomTo(z * 0.85, lead, 'Sine.easeInOut', true);
    const stop = () => this.endWowCam();
    this.wowStop = stop;
    s.input.keyboard?.once('keydown', stop); s.input.once('pointerdown', stop);
  }
  // the ride runs on the scene clock (also under nomad.step): lead-in pan, up, hold at the tip, down, a breath, done
  rideStep() {
    const s = this.scene, c = this.wowCam, R = c.ride, t = s.time.now - c.at, e = k => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, k)));
    if (t < R.lead) return;
    if (!R.going) { R.going = true; s.cam.panEffect?.reset?.(); }
    const t1 = t - R.lead, a = R.up, b = a + R.hold, d = b + R.down, f = d + R.hold * 0.5;
    const y = t1 < a ? R.foot + (R.tip - R.foot) * e(t1 / a) : t1 < b ? R.tip : t1 < d ? R.tip + (R.foot - R.tip) * e((t1 - b) / R.down) : R.foot;
    s.cam.centerOn(R.x, y);
    if (t1 >= f) this.endWowCam();
  }
  endWowCam() {
    const s = this.scene, c = this.wowCam; if (!c || c.back) return;
    c.back = true;
    const cam = s.cam, C = s.data_.game?.camera || {};
    cam.panEffect?.reset?.(); cam.zoomEffect?.reset?.();
    cam.zoomTo(c.base, 500, 'Sine.easeInOut', true);
    cam.startFollow(s.leyla.box, false, C.follow ?? 0.12, C.follow ?? 0.12);
    s.input.keyboard?.off('keydown', this.wowStop); s.input.off('pointerdown', this.wowStop);
  }
  // ---------- sound: a short stinger and a soft layer under the room (Web Audio, from code) ----------
  audio() { const s = this.scene, c = s.sound?.context; return c && !s.sound.mute && c.state === 'running' ? c : null; }
  stinger(kind) {
    const c = this.audio(); if (!c) return;
    const t = c.currentTime, out = c.createGain(); out.gain.value = (this.D.game?.sfx?.volume ?? 60) / 100 * 0.35; out.connect(c.destination);
    const tone = (type, f0, f1, at, len, v) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(f1, t + at + len); g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(v, t + at + Math.min(0.4, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + at + len); o.connect(g).connect(out); o.start(t + at); o.stop(t + at + len + 0.05); };
    const chords = { swell: [[220, 1.8], [277, 1.8], [330, 1.8], [440, 2.2]], chord: [[262, 1.4], [330, 1.4], [392, 1.4]], bell: [[880, 2.4], [1320, 1.6], [660, 2.6]], drone: [[55, 2.6], [82, 2.6], [110, 2.2]], neon: [[1200, 0.08], [1150, 0.08], [1180, 0.5]] };
    (chords[kind] || chords.swell).forEach(([f, len], i) => tone(kind === 'bell' ? 'sine' : kind === 'neon' ? 'square' : 'triangle', f, f * (kind === 'drone' ? 1 : 1.002), kind === 'neon' ? i * 0.12 : i * 0.06, len, kind === 'neon' ? 0.12 : 0.22));
    setTimeout(() => { try { out.disconnect(); } catch { /* gone */ } }, 4000);
  }
  startMusic() {
    const c = this.audio(), v = (this.wow?.W.music ?? 35) / 100; if (!c || !v || this.music) return;
    const g = c.createGain(), f = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 700; lfo.frequency.value = 0.12; lg.gain.value = 300; lfo.connect(lg).connect(f.frequency);
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.06 * v + 0.0001, c.currentTime + 1.8);
    const base = { reactor: 55, rocket: 49, crystals: 98, clock: 73, flare: 65 }[this.wow.motif] || 62;
    const osc = [1, 1.5, 2.01].map((m, i) => { const o = c.createOscillator(); o.type = i ? 'sawtooth' : 'triangle'; o.frequency.value = base * m; o.detune.value = (i - 1) * 7; o.connect(f); o.start(); return o; });
    f.connect(g).connect(c.destination); lfo.start();
    this.music = { c, g, osc: [...osc, lfo] };
  }
  stopMusic(now = false) {
    const m = this.music; if (!m) return;
    this.music = null;
    try { m.g.gain.cancelScheduledValues(m.c.currentTime); m.g.gain.setValueAtTime(Math.max(0.0001, m.g.gain.value), m.c.currentTime); m.g.gain.exponentialRampToValueAtTime(0.0001, m.c.currentTime + (now ? 0.05 : 1.2)); } catch { /* closed */ }
    setTimeout(() => { for (const o of m.osc) { try { o.stop(); } catch { /* done */ } } try { m.g.disconnect(); } catch { /* gone */ } }, now ? 100 : 1400);
  }
  // ---------- every frame: Wow movement, paper drifting to secrets, the landmark blinks ----------
  update(time, dt) {
    if (!this.on) return;
    const T = this.T, s = this.scene;
    if (this.wowCam?.ride && !this.wowCam.back) {   // #173 the ride up the rocket; she walks: the ride ends
      if (Math.abs((s.leyla?.x ?? 0) - this.wowCam.from) > 2 * T) this.endWowCam(); else this.rideStep();
    }
    if (this.landmark && this.P.level?.landmarkMotif === 'mast') this.landmark.alpha = 0.75 + 0.25 * (Math.sin(time / 300) > 0 ? 1 : 0);
    if (this.wowFx) {
      const B = this.wowBox, kind = this.wow.W.particles, near = Math.abs(s.leyla.x - B.bx) < s.scale.width;
      const fx = this.wowFx.clear();
      if (near && kind) {
        if (this.parts.length < 60 && Math.random() < dt / 40) this.parts.push(spawn(kind, B, T));
        this.parts = this.parts.filter(p => (p.t += dt) < p.life);
        for (const p of this.parts) {
          p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vy += (p.g || 0) * dt / 1000;
          const a = Math.max(0, 1 - p.t / p.life) * p.a;
          fx.fillStyle(p.c, a).fillCircle(p.x, p.y, p.r * (kind === 'glitter' ? 0.5 + 0.5 * Math.abs(Math.sin(p.t / 120)) : 1));
        }
      }
      if (kind === 'flicker' && this.wowG) { const a = Math.random() < 0.04 ? 0.55 : 1; this.wowG.alpha = a; if (this.wowPic) this.wowPic.img.alpha = 0.75 + 0.25 * a; }
      // #165 the core of the painted motif breathes: the reactor pulses, the flame flickers, crystals and treasure shimmer
      if (this.wowPulse && near) {
        const c = this.wowPic.core, m = this.wow.motif, col = aap(this.wow.W.light || '#ffd541'), R = Math.max(this.wowPic.w, this.wowPic.h);
        const a = m === 'flare' ? 0.55 + 0.45 * Math.random() : m === 'reactor' ? 0.5 + 0.5 * Math.sin(time / 520) : 0.6 + 0.4 * Math.sin(time / 1300);
        const big = { reactor: 0.22, flare: 0.16, crystals: 0.3, nest: 0.25, grate: 0.35, dome: 0.3 }[m] ?? 0.14;
        this.wowPulse.clear().fillStyle(col, 0.16 * a).fillCircle(c.x, c.y, R * big).fillStyle(col, 0.14 * a).fillCircle(c.x, c.y, R * big * 0.45);
        for (const ch of this.chandeliers || []) this.wowPulse.fillStyle(0xf4d29c, 0.12 + 0.04 * Math.sin(time / 700)).fillCircle(ch.x, ch.y, 1.6 * T);
      }
    }
    // paper scraps drift towards a draft (sign kind draft), more of them at the first secret
    if (this.signs?.length && this.signG) {
      const g = this.signG.glow;
      for (const sg of this.signs) if (sg.kind === 'draft' && Math.abs(s.leyla.x - sg.fx) < s.scale.width * 0.7) {
        sg.paper ??= [];
        if (sg.paper.length < 2 + 3 * sg.strength && Math.random() < dt / 600) sg.paper.push({ x: sg.fx + sg.side * (2 + Math.random() * 2) * T, y: (sg.at[1] + 0.2 + Math.random() * 0.7) * T, t: 0 });
        sg.paper = sg.paper.filter(p => (p.t += dt) < 2600);
      }
      g.clear();
      for (const sg of this.signs) {
        if (sg.kind === 'slit') { g.fillStyle(0xfef3c0, 0.18 * sg.strength + 0.08).fillRect(sg.fx - (sg.side < 0 ? 0 : 3), sg.at[1] * T + 6, 3, T - 12); g.fillStyle(0xfef3c0, 0.06 * sg.strength + 0.04).fillTriangle(sg.fx, sg.at[1] * T + 8, sg.fx, (sg.at[1] + 1) * T - 8, sg.fx + sg.side * T * 1.6, (sg.at[1] + 1) * T + 10); }
        for (const p of sg.paper || []) { const k = p.t / 2600, x = p.x + (sg.fx - p.x) * k, y = p.y + Math.sin(p.t / 180) * 6; g.fillStyle(0xdae0ea, 0.5 * (1 - k)).fillRect(x, y, 7, 5); }
      }
    }
  }
}

function spawn(kind, B, T) {
  const rx = () => B.bx + (Math.random() - 0.5) * Math.max(6 * T, (B.half || 0) * 1.6);
  if (kind === 'sparks') return { x: (B.core?.x ?? B.bx) + (Math.random() - 0.5) * T, y: B.core?.y ?? B.top, vx: (Math.random() - 0.5) * 220, vy: -120 - Math.random() * 160, g: 420, r: 3, c: aap(Math.random() < 0.5 ? 0xffd541 : 0xfa6a0a), a: 1, t: 0, life: 1400 };
  if (kind === 'steam') return { x: rx(), y: B.by - T, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 30, r: 10 + Math.random() * 16, c: 0xb3b9d1, a: 0.12, t: 0, life: 3200 };
  if (kind === 'paper') return { x: rx(), y: B.top + Math.random() * 3 * T, vx: 90 + Math.random() * 80, vy: 10 - Math.random() * 30, r: 4, c: 0xdae0ea, a: 0.7, t: 0, life: 3000 };
  if (kind === 'glitter') return { x: rx(), y: B.by - Math.random() * 3 * T, vx: 0, vy: -6, r: 4, c: 0xfef3c0, a: 0.9, t: 0, life: 1600 };
  return { x: rx(), y: B.by - Math.random() * 5 * T, vx: 8, vy: -4, r: 2.5, c: 0xf4d29c, a: 0.35, t: 0, life: 4000 };   // dust, flicker
}

// VT323 text with a soft additive halo (on painted motifs, #165)
function vtext(scene, x, y, str, size, c, depth) {
  const st = { fontFamily: 'VT323, monospace', fontSize: `${Math.round(size)}px`, color: hex(c) };
  scene.add.text(x, y, str, st).setOrigin(0.5).setDepth(depth + 0.005).setAlpha(0.35).setScale(1.08).setBlendMode(Phaser.BlendModes.ADD);
  return scene.add.text(x, y, str, st).setOrigin(0.5).setDepth(depth + 0.01);
}

// A motif as a code silhouette, foot at (bx, by), k = scale (1 = about 5 tiles high), col = glow colour (AAP-64).
// opts: { text (VT323), room (px rect of the Wow room, for things that hang from the ceiling), far (landmark: flatter, darker) }
export function drawMotif(g, kind, bx, by, k, col, opts = {}) {
  const u = 64 * k, dark = opts.far ? 0x221c1a : DARK, line = opts.far ? 0x322b28 : STEEL;
  const text = (str, x, y, size, c = col) => { if (!str || !g.scene) return; const t = g.scene.add.text(x, y, str, { fontFamily: 'VT323, monospace', fontSize: `${Math.round(size)}px`, color: hex(c) }).setOrigin(0.5).setDepth(g.depth + 0.01).setScrollFactor(g.scrollFactorX, g.scrollFactorY); g.scene.add.text(x, y, str, { fontFamily: 'VT323, monospace', fontSize: `${Math.round(size)}px`, color: hex(c) }).setOrigin(0.5).setDepth(g.depth + 0.005).setScrollFactor(g.scrollFactorX, g.scrollFactorY).setAlpha(0.35).setScale(1.08).setBlendMode(Phaser.BlendModes.ADD); return t; };
  const glow = (x, y, r, a = 0.25) => { g.fillStyle(col, a * 0.5).fillCircle(x, y, r * 1.6); g.fillStyle(col, a).fillCircle(x, y, r); };
  const room = opts.room;
  switch (kind) {
    case 'priceboard': {
      g.fillStyle(line, 1).fillRect(bx - 0.9 * u, by - 5 * u, 0.25 * u, 5 * u).fillRect(bx + 0.65 * u, by - 5 * u, 0.25 * u, 5 * u);
      g.fillStyle(dark, 1).fillRect(bx - 1.6 * u, by - 6.8 * u, 3.2 * u, 2.2 * u); g.lineStyle(0.08 * u, col, 1).strokeRect(bx - 1.6 * u, by - 6.8 * u, 3.2 * u, 2.2 * u);
      text('DIESEL', bx, by - 6.3 * u, 0.42 * u); text(opts.text || '9,99', bx, by - 5.4 * u, 0.9 * u);
      glow(bx, by - 5.7 * u, 1.2 * u, 0.12); break;
    }
    case 'watertower': {
      g.lineStyle(0.12 * u, line, 1); for (const dx of [-1, -0.35, 0.35, 1]) g.lineBetween(bx + dx * u * 0.8, by, bx + dx * u * 0.5, by - 4 * u);
      g.fillStyle(dark, 1).fillEllipse(bx, by - 5 * u, 3 * u, 2.2 * u); g.lineStyle(0.07 * u, col, 1).strokeEllipse(bx, by - 5 * u, 3 * u, 2.2 * u);
      g.fillStyle(col, 1).fillCircle(bx - 0.5 * u, by - 5.3 * u, 0.12 * u).fillCircle(bx + 0.5 * u, by - 5.3 * u, 0.12 * u);
      g.lineStyle(0.08 * u, col, 1).beginPath().arc(bx, by - 5.1 * u, 0.6 * u, 0.3, Math.PI - 0.3).strokePath(); break;
    }
    case 'mast': case 'headframe': {
      const h = kind === 'mast' ? 9 : 6;
      g.lineStyle(0.1 * u, line, 1).lineBetween(bx - 1.2 * u, by, bx, by - h * u).lineBetween(bx + 1.2 * u, by, bx, by - h * u);
      for (let i = 1; i < h; i++) { const w = 1.2 * u * (1 - i / h); g.lineBetween(bx - w, by - i * u, bx + w, by - (i + 1) * u).lineBetween(bx + w, by - i * u, bx - w, by - (i + 1) * u); }
      if (kind === 'headframe') { g.lineStyle(0.1 * u, line, 1).strokeCircle(bx, by - h * u, 0.8 * u); for (let a = 0; a < 6; a++) g.lineBetween(bx, by - h * u, bx + Math.cos(a) * 0.8 * u, by - h * u + Math.sin(a) * 0.8 * u); glow(bx, by + 0.2 * u, 1.4 * u, 0.2); }
      else { g.fillStyle(0xe86a73, 1).fillCircle(bx, by - h * u - 0.15 * u, 0.18 * u); glow(bx, by - h * u, 0.5 * u, 0.4); }
      break;
    }
    case 'dome': {
      const cy = room ? room.y + 0.4 * u : by - 6 * u, R = 4 * u;
      g.fillStyle(dark, 0.9).fillEllipse(bx, cy, 2 * R, R * 0.9);
      g.lineStyle(0.06 * u, col, 0.9); for (let i = -3; i <= 3; i++) g.lineBetween(bx + i * R / 3.4, cy + R * 0.42, bx + i * R / 8, cy - R * 0.4);
      g.strokeEllipse(bx, cy, 2 * R, R * 0.9);
      g.fillStyle(col, 0.08).fillTriangle(bx - R * 0.6, cy + R * 0.4, bx + R * 0.6, cy + R * 0.4, bx + R * 1.1, by).fillTriangle(bx - R * 0.6, cy + R * 0.4, bx - R * 1.2, by, bx + R * 0.3, by);
      // the stopped escalator and the banner
      g.fillStyle(line, 1).fillTriangle(bx - 3 * u, by, bx + 0.5 * u, by, bx + 0.5 * u, by - 3.2 * u); g.lineStyle(0.05 * u, 0x8b93af, 1).lineBetween(bx - 3 * u, by - 0.5 * u, bx + 0.5 * u, by - 3.7 * u);
      g.fillStyle(0xb4202a, 1).fillRect(bx - 2.4 * u, cy + R * 0.6, 4.8 * u, 0.9 * u); text(opts.text || 'SALE −70 %', bx, cy + R * 0.6 + 0.45 * u, 0.7 * u, 0xfef3c0);
      break;
    }
    case 'neon': case 'kiosk': {
      if (kind === 'kiosk') {   // the skyline behind, the booth in neon
        g.fillStyle(0x242234, 1); for (let i = -6; i <= 6; i++) { const h = (2 + ((i * 7919) % 5 + 5) % 5) * u * 0.8; g.fillRect(bx + i * 0.9 * u - 0.4 * u, by - 1.5 * u - h, 0.8 * u, h); }
        g.fillStyle(dark, 1).fillRect(bx - 1.5 * u, by - 2.6 * u, 3 * u, 2.6 * u); g.fillStyle(col, 0.18).fillRect(bx - 1.2 * u, by - 2.3 * u, 2.4 * u, 1.2 * u);
        g.lineStyle(0.07 * u, col, 1).strokeRect(bx - 1.5 * u, by - 2.6 * u, 3 * u, 2.6 * u); text(opts.text || 'KASSE', bx, by - 3.1 * u, 0.6 * u);
        // burnt cars
        g.fillStyle(0x221c1a, 1); for (const dx of [-4, 3.2]) { g.fillRoundedRect(bx + dx * u, by - 0.9 * u, 2.2 * u, 0.7 * u, 0.2 * u).fillRoundedRect(bx + (dx + 0.4) * u, by - 1.4 * u, 1.3 * u, 0.6 * u, 0.2 * u); }
      } else { g.fillStyle(dark, 1).fillRect(bx - 2 * u, by - 1.4 * u, 4 * u, 1.4 * u); g.lineStyle(0.08 * u, col, 1).strokeRect(bx - 2 * u, by - 1.4 * u, 4 * u, 1.4 * u); text(opts.text || 'PENTHOUSE', bx, by - 0.7 * u, 0.8 * u); }
      glow(bx, by - 1.6 * u, 1.4 * u, 0.12); break;
    }
    case 'board': case 'grate': {
      if (kind === 'grate') {
        g.fillStyle(col, 0.16).fillRect(bx - 3 * u, by - 5 * u, 6 * u, 5 * u);
        g.lineStyle(0.14 * u, line, 1); for (let i = 0; i <= 12; i++) g.lineBetween(bx - 3 * u + i * 0.5 * u, by - 5 * u, bx - 3 * u + i * 0.5 * u, by);
        g.lineBetween(bx - 3 * u, by - 2.5 * u, bx + 3 * u, by - 2.5 * u); g.lineStyle(0.1 * u, 0xfa6a0a, 0.9).lineBetween(bx - 3 * u, by - 2.5 * u, bx + 3 * u, by - 2.5 * u);
        text(opts.text || 'BigCityDelta', bx, by - 5.6 * u, 0.7 * u, 0xdae0ea);
        g.fillStyle(0x5a4e44, 1); for (const dx of [-2.4, -0.6, 1.4]) g.fillEllipse(bx + dx * u, by - 0.2 * u, 1.4 * u, 0.4 * u);   // sleeping bags
      } else { g.fillStyle(dark, 1).fillRect(bx - 2.6 * u, by - 4.6 * u, 5.2 * u, 1.3 * u); g.lineStyle(0.06 * u, line, 1).strokeRect(bx - 2.6 * u, by - 4.6 * u, 5.2 * u, 1.3 * u); text(opts.text || 'ZUG FÄLLT AUS', bx, by - 3.95 * u, 0.6 * u); }
      break;
    }
    case 'shaft': {
      const top = room ? room.y : by - 8 * u;
      g.fillStyle(col, 0.1).fillTriangle(bx - 0.8 * u, top, bx + 0.8 * u, top, bx + 2.6 * u, by).fillTriangle(bx - 0.8 * u, top, bx - 2.6 * u, by, bx + 2.6 * u, by);
      g.lineStyle(0.08 * u, line, 1); for (let i = -2; i <= 2; i++) g.lineBetween(bx + i * 0.35 * u, top, bx + i * 0.35 * u, top + 0.3 * u); break;
    }
    case 'reactor': {
      g.fillStyle(dark, 1).fillRect(bx - 2 * u, by - 6 * u, 4 * u, 6 * u); g.fillStyle(line, 1).fillRect(bx - 2.3 * u, by - 6.3 * u, 4.6 * u, 0.4 * u).fillRect(bx - 2.3 * u, by - 0.4 * u, 4.6 * u, 0.4 * u);
      for (let i = 1; i < 5; i++) { g.fillStyle(col, 0.85).fillRect(bx - 2 * u, by - i * 1.2 * u, 4 * u, 0.12 * u); } glow(bx, by - 3 * u, 2.2 * u, 0.14);
      g.lineStyle(0.18 * u, line, 1).lineBetween(bx + 2 * u, by - 5 * u, bx + 4 * u, by - 5 * u).lineBetween(bx - 2 * u, by - 4 * u, bx - 4 * u, by - 4 * u); break;
    }
    case 'crystals': {
      const pts = [[-2.4, 2.2], [-1.4, 3.6], [-0.4, 2.6], [0.5, 4.4], [1.5, 2.8], [2.4, 3.4], [3.2, 1.8]];
      for (const [dx, h] of pts) { g.fillStyle(col, 0.85).fillTriangle(bx + (dx - 0.35) * u, by, bx + (dx + 0.35) * u, by, bx + (dx + 0.1) * u, by - h * u); g.fillStyle(0xffffff, 0.35).fillTriangle(bx + (dx - 0.05) * u, by, bx + (dx + 0.15) * u, by, bx + (dx + 0.1) * u, by - h * u); }
      glow(bx, by - 1.5 * u, 2.6 * u, 0.16); break;
    }
    case 'clock': {
      const cy = by - 5.5 * u, R = 1.8 * u;
      g.fillStyle(0xe4d2aa, 1).fillCircle(bx, cy, R); g.lineStyle(0.18 * u, 0xa08662, 1).strokeCircle(bx, cy, R);
      g.lineStyle(0.06 * u, INK, 1); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.lineBetween(bx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82, bx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); }
      g.lineStyle(0.12 * u, INK, 1).lineBetween(bx, cy, bx, cy - R * 0.6).lineBetween(bx, cy, bx + R * 0.45, cy + R * 0.1);
      if (g.scene) { const hand = g.scene.add.graphics().setDepth(g.depth + 0.02); hand.lineStyle(0.05 * u, 0xb4202a, 1).lineBetween(0, 0, 0, -R * 0.85); hand.setPosition(bx, cy); g.scene.tweens.add({ targets: hand, angle: 360, duration: 60000, repeat: -1 }); }
      // the chandelier
      if (room) { const ty = room.y + 0.2 * u; g.lineStyle(0.05 * u, 0xa08662, 1).lineBetween(bx, ty, bx, ty + 1.2 * u); g.fillStyle(0xf4d29c, 1); for (let i = -3; i <= 3; i++) g.fillCircle(bx + i * 0.35 * u, ty + 1.4 * u + Math.abs(i) * 0.08 * u, 0.1 * u); glow(bx, ty + 1.4 * u, 1.2 * u, 0.15); }
      break;
    }
    case 'flare': {
      g.fillStyle(line, 1).fillRect(bx - 0.35 * u, by - 8 * u, 0.7 * u, 8 * u); g.lineStyle(0.06 * u, 0x8b93af, 1); for (let i = 1; i < 8; i++) g.lineBetween(bx - 0.6 * u, by - i * u, bx + 0.6 * u, by - i * u);
      g.fillStyle(0xfa6a0a, 0.9).fillTriangle(bx - 0.6 * u, by - 8 * u, bx + 0.6 * u, by - 8 * u, bx, by - 10 * u); g.fillStyle(0xffd541, 0.9).fillTriangle(bx - 0.3 * u, by - 8 * u, bx + 0.3 * u, by - 8 * u, bx, by - 9.2 * u);
      glow(bx, by - 8.6 * u, 1.6 * u, 0.25);
      g.fillStyle(0x5a4e44, 1); for (const dx of [-3.4, -2.6, 2.6, 3.4]) g.fillRect(bx + dx * u - 0.35 * u, by - 1 * u, 0.7 * u, 1 * u);   // barrels of the still
      break;
    }
    case 'rocket': {
      const top = room ? room.y + 1.5 * u : by - 14 * u, h = by - top, w = 1.4 * u;
      g.fillStyle(0xb3b9d1, 1).fillRect(bx - w / 2, top + 1.6 * u, w, h - 2.6 * u); g.fillStyle(0xdae0ea, 1).fillTriangle(bx - w / 2, top + 1.6 * u, bx + w / 2, top + 1.6 * u, bx, top);
      g.fillStyle(0xb4202a, 1).fillRect(bx - w / 2, top + 1.6 * u, w, 0.3 * u).fillTriangle(bx - w / 2, by - 1 * u, bx - w / 2 - 0.8 * u, by - 0.1 * u, bx - w / 2, by - 2.2 * u).fillTriangle(bx + w / 2, by - 1 * u, bx + w / 2 + 0.8 * u, by - 0.1 * u, bx + w / 2, by - 2.2 * u);
      g.lineStyle(0.04 * u, 0x8b93af, 1); for (let y = top + 3 * u; y < by - 1.5 * u; y += 2 * u) g.lineBetween(bx - w / 2, y, bx + w / 2, y);
      g.fillStyle(DARK, 1).fillRect(bx + 2 * u, by - 2.6 * u, 3 * u, 1.1 * u); text(opts.text || '00:00:01', bx + 3.5 * u, by - 2.05 * u, 0.8 * u, 0xe83b3b);
      break;
    }
    case 'pool': {
      const T = opts.T || 64; g.fillStyle(0x249fde, 0.12).fillRect(bx - 5 * u, by - 0.3 * u, 10 * u, 0.3 * u);
      g.lineStyle(0.05 * u, 0x8b93af, 1); for (const dx of [-5.2, 4.8]) { g.lineBetween(bx + dx * u, by - 2.4 * u, bx + dx * u, by - 1.2 * u); g.lineBetween(bx + (dx + 0.4) * u, by - 2.4 * u, bx + (dx + 0.4) * u, by - 1.2 * u); }
      for (const dx of [-3.4, -1.2, 1.2, 3.2]) { g.lineStyle(0.1 * u, 0xfad6b8, 1).lineBetween(bx + dx * u - 0.7 * u, by - 0.3 * u, bx + dx * u + 0.5 * u, by - 0.3 * u).lineBetween(bx + dx * u + 0.5 * u, by - 0.3 * u, bx + dx * u + 0.9 * u, by - 0.9 * u); }
      g.fillStyle(0xf9a31b, 1).fillTriangle(bx - 0.9 * u, by - 3.6 * u, bx + 0.9 * u, by - 3.6 * u, bx, by - 4.4 * u); g.lineStyle(0.06 * u, line, 1).lineBetween(bx, by - 3.6 * u, bx, by);   // a parasol
      void T; break;
    }
    case 'cabin': {
      g.fillStyle(dark, 1).fillRect(bx - 2 * u, by - 3 * u, 4 * u, 3 * u); g.lineStyle(0.07 * u, line, 1).strokeRect(bx - 2 * u, by - 3 * u, 4 * u, 3 * u);
      for (let i = 0; i < 26; i++) { const x = bx - 1.8 * u + ((i * 37) % 36) / 10 * u, y = by - 2.8 * u + ((i * 53) % 24) / 10 * u; g.fillStyle(i % 3 ? 0xdae0ea : 0xf4d29c, 0.9).fillRect(x, y, 0.32 * u, 0.24 * u); }
      g.lineStyle(0.07 * u, col, 1).beginPath().arc(bx + 1.4 * u, by - 1.2 * u, 0.25 * u, Math.PI, 0).strokePath(); break;
    }
    case 'brokenoffice': {
      g.fillStyle(0x4a5462, 1).beginPath().moveTo(bx - 4 * u, by).lineTo(bx + 1.5 * u, by).lineTo(bx + 2.2 * u, by + 0.3 * u).lineTo(bx + 1.6 * u, by + 0.7 * u).lineTo(bx - 4 * u, by + 0.6 * u).closePath().fillPath();
      g.fillStyle(0x5a4e44, 1); for (const dx of [-3, -1.2, 0.6]) { g.fillRect(bx + dx * u, by - 0.9 * u, 1.3 * u, 0.15 * u).fillRect(bx + dx * u + 0.1 * u, by - 0.75 * u, 0.1 * u, 0.75 * u).fillRect(bx + dx * u + 1.1 * u, by - 0.75 * u, 0.1 * u, 0.75 * u); }
      g.lineStyle(0.16 * u, 0x71413b, 1).lineBetween(bx + 1.6 * u, by - 0.1 * u, bx + 3.2 * u, by - 1.6 * u).lineBetween(bx + 1.2 * u, by - 3.5 * u, bx + 3 * u, by - 3 * u); break;
    }
    case 'nest': case 'cars': {
      if (kind === 'cars') { g.fillStyle(0x221c1a, 1); for (const dx of [-4, -1, 2]) g.fillRoundedRect(bx + dx * u, by - 0.9 * u, 2.4 * u, 0.8 * u, 0.2 * u); break; }
      g.fillStyle(0x5a4e44, 1).beginPath().moveTo(bx - 3.5 * u, by).lineTo(bx - 1.5 * u, by - 1.6 * u).lineTo(bx, by - 2.4 * u).lineTo(bx + 1.8 * u, by - 1.4 * u).lineTo(bx + 3.4 * u, by).closePath().fillPath();
      for (let i = 0; i < 30; i++) { const x = bx + (((i * 71) % 60) / 10 - 3) * u, y = by - ((i * 37) % 20) / 10 * u * (1 - Math.abs(((i * 71) % 60) / 30 - 1)); g.fillStyle([0xffd541, 0xdae0ea, 0xf9a31b, 0x249fde][i % 4], 1).fillCircle(x, y, 0.07 * u); }
      glow(bx, by - 1.2 * u, 2 * u, 0.12); break;
    }
    default: glow(bx, by - u, u, 0.3);
  }
}

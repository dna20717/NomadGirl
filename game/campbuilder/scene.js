// CampBuilder v2 (#196): the building scene. One camera over the world; sky and parallax sit in screen space in front of it
// (counter-scaled against the zoom). AvA is the hand: the left stick flies her with a little inertia, a soft magnet pulls her to the
// middle of a tile when the stick rests; under her a light shows the tile she works on.
//   A held  + drag: add ground (paint); at the surface, drag up = a hill that grows step by step
//   B held  + drag: take ground away; at the surface, drag down = a hollow
//   LB/RB tap: material · LB held: the material wheel · RB held: the tool wheel (ground, ruin) · Y held: the sun (sticks turn the hour)
//   Ruin tool: A at the ground, pull sideways (width) and up (height): a broken building of the material grows
//   LT/RT zoom · right stick moves the view · Select: back (held: rewinds) · X: forward · Start: menu
// Every step is a note of the music (tones.js), the higher the tile, the higher the note. Plan: docs/features/campbuilder.md.
import { makeTextures } from '../play/art.js';
import { Drone } from '../play/drone.js';
import * as M from './model.js';
import { TerrainView, AIR } from './terrain_view.js';
import { Sky } from './sky.js';
import { Pieces, catalog } from './pieces.js';

const T = 64;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k, dt) => 1 - Math.pow(1 - k, dt / 16.67);

export class BuilderScene extends Phaser.Scene {
  constructor() { super('builder'); }
  init(args) {
    this.args = args; this.data_ = args.project.data; this.cfg = args.cfg; this.base = args.base; this.mode = 'camp';
    this.T = T; this.enemies = []; this.input_ = args.input; this.tones = args.tones; this.hud = args.hud; this.store = args.store;
  }
  preload() {
    const D = this.data_, A = D.assets || {}, ids = new Set();
    if (this.args.loading) this.load.on('progress', p => this.args.loading.progress(p));
    for (const t of Object.values(D.terrain || {})) for (const id of [t.look, t.props, t.propsBig]) if (id) ids.add(id);
    const DR = D.drone || {};
    for (const id of [DR.look, DR.face?.look, DR.face?.glass, ...(DR.parts || []).filter(r => r.on).map(r => r.look)]) if (id) ids.add(id);
    const P = D.parallax?.[this.cfg.view?.parallax || 'wueste'];
    for (const L of P?.layers || []) if (L.look) ids.add(L.look);
    for (const c of catalog(D)) ids.add(c.d.look);   // the camp kit's pieces
    for (const id of ids) {
      const a = A[id];
      if (!a?.file || this.textures.exists(id)) continue;
      const url = new URL(a.file, this.base).href;
      if ((a.kind === 'animation' || a.kind === 'tiles') && a.frameSize) this.load.spritesheet(id, url, { frameWidth: a.frameSize[0], frameHeight: a.frameSize[1] });
      else if (a.kind === 'icons' && a.cell) { const [cw, ch] = Array.isArray(a.cell) ? a.cell : [a.cell, a.cell]; this.load.spritesheet(id, url, { frameWidth: cw, frameHeight: ch }); }
      else if (a.kind === 'image') this.load.image(id, url);
    }
  }

  create() {
    const C = this.cfg, W = this.scale.width, H = this.scale.height;
    makeTextures(this);
    this.cam = this.cameras.main; this.cam.setBackgroundColor('#0d0a12');
    this.m = this.args.model;
    this.sets = Object.keys(this.data_.terrain || {});
    this.set = this.sets.includes(this.args.set) ? this.args.set : this.m.base;
    this.tool = 'ground'; this.layer = 'c'; this.facade = 'auto';
    this.mats = new Map((C.materials || []).map(r => [r.set, r.material]));
    this.sky = new Sky(this, null, this.data_, C);
    this.view = new TerrainView(this, this.m, { seams: C.seams, enclose: C.enclose, details: C.view?.details !== false, margin: Math.ceil(W / ((C.view?.zoom?.[0] ?? 38) / 100) / T / 2) + 4 });
    this.makeHole();
    this.view.update(0, true);
    this.under = this.add.graphics().setDepth(-9);
    this.drawUnder();
    this.stakes = [this.makeStake(-1), this.makeStake(1)];
    this.placeStakes(false);
    // the light under AvA, the guide of a hill, dust
    this.beam = this.add.graphics().setDepth(54).setBlendMode(Phaser.BlendModes.ADD);
    this.ghost = this.add.graphics().setDepth(56);
    this.ghostImg = this.add.image(0, 0, 'px').setOrigin(0.5, 1).setDepth(55).setAlpha(0).setVisible(false);
    this.guide = this.add.graphics().setDepth(56);
    this.dust = this.add.particles(0, 0, 'px', { lifespan: { min: 500, max: 1100 }, speed: { min: 30, max: 140 }, angle: { min: 200, max: 340 }, gravityY: 260, scale: { start: 1.6, end: 0.2 }, alpha: { start: 0.85, end: 0 }, emitting: false }).setDepth(-9.4);
    this.crumbs = this.add.particles(0, 0, 'px', { lifespan: { min: 700, max: 1300 }, speed: { min: 60, max: 220 }, angle: { min: 210, max: 330 }, gravityY: 900, scale: { start: 1.3, end: 0.8 }, alpha: { start: 1, end: 0.2 }, emitting: false, bounce: 0.3 }).setDepth(-9.3);
    // night and golden hour over the world (normal blend: works on every renderer); lights shine above it (depth 51)
    this.veil = this.add.rectangle(0, 0, W, H, 0x0b0d26, 0).setOrigin(0).setScrollFactor(0).setDepth(50);
    this.warmth = this.add.rectangle(0, 0, W, H, 0xff9a50, 0).setOrigin(0).setScrollFactor(0).setDepth(50.1).setBlendMode(Phaser.BlendModes.ADD);
    // AvA, the hand (the game's own drone, without Leyla: a stand-in tells her where to look and how calm it is)
    this.leyla = { x: 0, feet: 0, facing: 1, alive: true, health: 100, state: 'normal', body: { velocity: { x: 0, y: 0 } }, size: { w: 60 } };
    const DD = { ...this.data_, drone: { ...(this.data_.drone || {}), bubble: { ...(this.data_.drone?.bubble || {}), show: false }, roam: { enabled: false }, layer: 'front' } };
    this.drone = new Drone(this, DD);
    this.drone.sprite.setDepth(60); this.drone.rope.setDepth(59.9);
    // the cursor: a point in the world (px); AvA hovers above it
    const s0 = M.surface(this.m, 0);
    this.cur = { x: T / 2, y: (s0 - 1) * T + T / 2, vx: 0, vy: 0 };
    this.drone.x = this.cur.x; this.drone.y = this.cur.y - 200;
    this.zoom = clamp((C.view?.start ?? 72) / 100, ...this.zoomRange());
    this.cam.setZoom(this.zoom);
    this.cam.centerOn(this.cur.x, this.cur.y - 120);
    this.hour = this.m.hour ?? C.clock?.start ?? 18.2;
    this.sky.setHour(this.hour);
    this.g = null; this.repeat = {}; this.idle = 0; this.saveAt = 0; this.notes = 0; this.lastNote = 0; this.stats = { gestures: 0 };
    // pieces from the camp kit, and the brush's colour (Farbrad)
    if (!this.textures.exists('cb_glow')) { const t = this.textures.createCanvas('cb_glow', 128, 128), g = t.getContext(), r = g.createRadialGradient(64, 64, 2, 64, 64, 64); r.addColorStop(0, 'rgba(255,214,140,0.9)'); r.addColorStop(0.4, 'rgba(255,170,80,0.35)'); r.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); t.refresh(); }
    this.cat = catalog(this.data_); this.pieceId = (this.cat.find(c => c.id === 'feuertonne') || this.cat[0])?.id; this.pv = 0; this.color = null;
    this.pieces = new Pieces(this); this.pieces.rebuild(this.m.pieces);
    this.hud?.attach(this);
    this.events.emit('ready');
  }
  // the foreground opens like the rig (Daniel, 28.11.2026: „die Mechanik wieder auf, dass man Gebäude öffnen und schließen kann“):
  // auto = a soft hole around AvA, open = see-through, closed = whole. Y tapped switches.
  makeHole() {
    if (!this.textures.exists('cb_hole')) {
      const t = this.textures.createCanvas('cb_hole', 256, 256), g = t.getContext(), r = g.createRadialGradient(128, 128, 20, 128, 128, 128);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 256, 256); t.refresh();
    }
    this.hole = this.make.image({ x: 0, y: 0, key: 'cb_hole', add: false }).setScale(3.2);
    try { this.holeMask = new Phaser.Display.Masks.BitmapMask(this, this.hole); this.holeMask.invertAlpha = true; } catch { this.holeMask = null; }
    this.setFacade('auto', false);
  }
  setFacade(mode, sound = true) {
    this.facade = mode;
    const box = this.view.frontBox, editing = this.layer === 'f';
    if (mode === 'auto' && this.holeMask && !editing) box.setMask(this.holeMask); else box.clearMask();
    this.tweens.add({ targets: box, alpha: mode === 'open' && !editing ? 0.16 : 1, duration: 420, ease: 'Sine.InOut' });
    if (sound) { this.tones?.play(mode === 'closed' ? 'menu' : 'open'); this.input_.rumble(0.12, 20, this.cfg.haptics); this.hud?.flash?.(mode); }
  }
  cycleLayer() {
    const order = ['c', 'f', 'b'];
    this.layer = order[(order.indexOf(this.layer) + 1) % order.length];
    this.setFacade(this.facade, false);
    this.hud?.setMaterial(this.set, this.view.kitOf(this.set));
    this.tones?.play('select', { degree: order.indexOf(this.layer) });
    this.input_.rumble(0.14, 22, this.cfg.haptics);
  }
  zoomRange() { const z = this.cfg.view?.zoom || [38, 115]; return [z[0] / 100, z[1] / 100]; }
  material(set) { return this.mats.get(M.setOf(set)) || 'stone'; }

  // ---------- the ground below the diorama: it fades into the dark ----------
  drawUnder() {
    const g = this.under.clear(), [a, b] = this.view.range(), x0 = (a - 1) * 12 * T, x1 = (b + 2) * 12 * T, yb = (M.bottom(this.m) + 1) * T;
    g.fillGradientStyle(0x07050c, 0x07050c, 0x07050c, 0x07050c, 0, 0, 1, 1).fillRect(x0, yb - T * 2.5, x1 - x0, T * 2.5);
    g.fillStyle(0x07050c, 1).fillRect(x0, yb, x1 - x0, 4000);
    // the far ends: darkness creeps in from the sides of what is drawn
    const top = (M.top(this.m) - AIR - 20) * T, h = yb + 4000 - top;
    g.fillGradientStyle(0x07050c, 0x07050c, 0x07050c, 0x07050c, 1, 0, 1, 0).fillRect(x0, top, 10 * T, h);
    g.fillGradientStyle(0x07050c, 0x07050c, 0x07050c, 0x07050c, 0, 1, 0, 1).fillRect(x1 - 10 * T, top, 10 * T, h);
    g.fillStyle(0x07050c, 1).fillRect(x0 - 4000, top, 4000, h).fillRect(x1, top, 4000, h);
  }
  // ---------- survey stakes at the parcel's ends: a pole with a little flag that flutters, moves out when the parcel grows ----------
  makeStake(side) {
    const c = this.add.container(0, 0).setDepth(-9.2), g = this.add.graphics();
    g.fillStyle(0x07050c, 0.35).fillEllipse(2, 2, 26, 7);
    g.fillStyle(0x5d4037).fillRect(-3, -84, 6, 86); g.fillStyle(0x7a5a44).fillRect(-3, -84, 2, 86);
    g.fillStyle(0xdae0ea).fillRect(-4, -60, 8, 4).fillRect(-4, -30, 8, 4);
    const flag = this.add.graphics();
    c.add([g, flag]); c.flag = flag; c.side = side;
    return c;
  }
  placeStakes(anim = true) {
    for (const st of this.stakes) {
      const x = st.side < 0 ? this.m.parcel[0] : this.m.parcel[1] + 1, px = x * T, py = M.surface(this.m, st.side < 0 ? x : x - 1) * T + 2;
      if (anim) this.tweens.add({ targets: st, x: px, y: py, duration: 900, ease: 'Cubic.InOut' }); else st.setPosition(px, py);
    }
  }
  drawFlags(t) {
    for (const st of this.stakes) {
      const f = st.flag.clear(), w = 26, d = -st.side;
      f.fillStyle(0xf9a31b);
      for (let i = 0; i < 6; i++) { const k = i / 6, y0 = -84 + Math.sin(t / 260 + i * 0.9) * 2.2 * k; f.fillRect(d > 0 ? 3 + k * w : -3 - (k + 1 / 6) * w, y0, w / 6 + 0.5, 16 - k * 6); }
      f.fillStyle(0xffd541, 0.6).fillRect(d > 0 ? 3 : -9, -84, 6, 3);
    }
  }

  update(time, dt) { this.tick(Math.min(dt, 50), time); }

  // ---------- one frame ----------
  tick(dt, time = this.time.now) {
    const I = this.input_.poll(time), C = this.cfg, hud = this.hud;
    if (I.anyButton()) { this.tones?.unlock(); hud?.wake(time); }
    this.idle = time - I.lastInput;
    if (hud?.menuOpen) { hud.menuNav(I, time); this.frame(dt, time); return; }
    if (I.pressed('start')) { this.endGesture(); hud?.openMenu(); this.tones?.play('open'); this.frame(dt, time); return; }
    // the sun: Y held, the sticks turn the hour
    if (I.released('y') && !this.clockUsed && !this.g) this.setFacade({ auto: 'open', open: 'closed', closed: 'auto' }[this.facade]);
    if (!I.down('y')) this.clockUsed = false;
    const clock = I.down('y') && I.heldFor('y', time) > 220 && !this.g;
    if (clock) this.clockUsed = true;
    hud?.showClock(clock, time);
    if (clock) {
      const v = (Math.abs(I.left[0]) > Math.abs(I.right[0]) ? I.left[0] : I.right[0]) + (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
      if (v) { this.setHour(this.hour + v * (C.clock?.speed ?? 5) * dt / 1000); }
      this.cur.vx *= 0.8; this.cur.vy *= 0.8;
      this.frame(dt, time); return;
    }
    // the material: LB / RB tap, LB held opens the wheel
    const wheelAfter = 200;
    for (const [btn, kind] of [['lb', this.tool === 'deko' ? 'piece' : 'set'], ['rb', 'tool'], ['x', 'color']]) {
      if (I.down(btn) && I.heldFor(btn, time) > wheelAfter && !this.g) { if (!hud?.wheelOpen) { hud?.openWheel(kind); this.tones?.play('open'); } hud?.wheelAim(I.right[0] || I.left[0], I.right[1] || I.left[1], time); this.frame(dt, time); return; }
      if (!I.released(btn)) continue;
      if (hud?.wheelOpen) { const s = hud.closeWheel(); if (kind === 'set' && s && s !== this.set) this.chooseSet(s); if (kind === 'tool' && s && s !== this.tool) this.chooseTool(s); if (kind === 'piece' && s) this.choosePiece(s); if (kind === 'color') this.chooseColor(s); continue; }
      if (btn === 'x') { this.endGesture(); if (this.tool === 'deko') this.variant(); else this.forth(); continue; }   // X tapped: forward in time (deko: the next variant)
      if (kind === 'piece') this.cyclePiece(btn === 'lb' ? -1 : 1); else this.cycleSet(btn === 'lb' ? -1 : 1);
    }
    // back and forth in time
    if (I.pressed('select')) { this.endGesture(); this.back(); this.rewindAt = time + 420; }
    if (I.down('select') && time > (this.rewindAt || Infinity)) { this.back(); this.rewindAt = time + Math.max(55, 200 - I.heldFor('select', time) / 12); }
    if (!I.down('select')) this.rewindAt = null;
    if (I.pressed('rs')) this.pipette();
    if (I.pressed('ls')) this.cycleLayer();
    // zoom and view
    const zv = (I.rt - I.lt) * (C.view?.zoomSpeed ?? 120) / 100;
    if (zv) this.zoom = clamp(this.zoom * Math.exp(zv * dt / 1000), ...this.zoomRange());
    if (!this.touchPan) this.panView(I.right, dt);
    this.moveCursor(I, dt, time);
    this.gesture(I, time);
    this.frame(dt, time);
  }
  setHour(h) { this.hour = ((h % 24) + 24) % 24; this.m.hour = this.hour; this.sky.setHour(this.hour); this.dirtySave(); }
  panView([x, y], dt) {
    if (!x && !y) return;
    const v = (this.cfg.view?.pan ?? 1400) / this.cam.zoom;
    this.cam.scrollX += x * v * dt / 1000; this.cam.scrollY += y * v * dt / 1000; this.panned = this.time.now;
  }
  // AvA flies with a little inertia; a resting stick lets the magnet pull her into the middle of the tile
  moveCursor(I, dt, time) {
    const C = this.cfg.cursor || {}, c = this.cur, [lx, ly] = I.left, m = Math.hypot(lx, ly);
    const speed = (C.speed ?? 1500) * (0.55 + 0.45 / Math.max(0.5, this.cam.zoom)), k = 1 - Math.exp(-(C.accel ?? 9) * dt / 1000);
    const curve = m > 0 ? Math.pow(m, 1.6) / m : 0;
    c.vx += (lx * curve * speed - c.vx) * k; c.vy += (ly * curve * speed - c.vy) * k;
    // the d-pad: one tile per press, repeating while held
    for (const [b, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
      if (!I.down(b)) { delete this.repeat[b]; continue; }
      if (I.pressed(b) || time >= (this.repeat[b] ?? Infinity)) {
        const tx = (Math.floor(c.x / T) + dx) * T + T / 2, ty = (Math.floor(c.y / T) + dy) * T + T / 2;
        this.hop = { x: tx, y: ty }; this.repeat[b] = time + (I.pressed(b) ? 300 : (C.repeat ?? 140));
        this.tones?.play('move');
      }
    }
    if (this.hop) { c.x += (this.hop.x - c.x) * ease(0.35, dt); c.y += (this.hop.y - c.y) * ease(0.35, dt); c.vx = c.vy = 0; if (Math.hypot(this.hop.x - c.x, this.hop.y - c.y) < 1 || m > 0.05) this.hop = null; }
    else if (!this.touchAim) {
      c.x += c.vx * dt / 1000; c.y += c.vy * dt / 1000;
      if (m < 0.05 && Math.hypot(c.vx, c.vy) < 260 && !this.g?.mode?.match(/hill|dig/)) {   // the magnet
        const mg = (C.magnet ?? 30) / 100, tx = Math.floor(c.x / T) * T + T / 2, ty = Math.floor(c.y / T) * T + T / 2;
        c.x += (tx - c.x) * ease(0.12 * mg + 0.02, dt); c.y += (ty - c.y) * ease(0.12 * mg + 0.02, dt);
      }
    }
    const [x0, x1] = this.m.parcel;
    c.x = clamp(c.x, (x0 - 1) * T + 8, (x1 + 2) * T - 8); c.y = clamp(c.y, (M.top(this.m) - 1) * T, (M.bottom(this.m) + 1) * T - 4);
  }
  cell(x = this.cur.x, y = this.cur.y) { return { x: Math.floor(x / T), y: Math.floor(y / T) }; }

  // ---------- gestures ----------
  // A or B (or a finger) goes down: what it can do here; it decides once the hand moves (up / down = hill / hollow, else painting)
  gesture(I, time) {
    const a = I.down('a') || this.touchA === 'a', b = I.down('b') || this.touchA === 'b';
    const g = this.g;
    if (!g && (a || b)) {
      const c = this.cell(), s = M.solid(this.m, c.x, c.y), above = M.solid(this.m, c.x, c.y - 1), below = M.solid(this.m, c.x, c.y + 1);
      const surf = s && !above ? c.y : !s && below ? c.y + 1 : null;
      this.g = { btn: a ? 'a' : 'b', mode: 'pending', start: { ...this.cur }, cell: c, surf, t: time, last: null };
      if (this.tool === 'deko') { this.startPiece(); return; }
      if (this.layer !== 'c') { this.g.surf = null; this.startPaint(); }
      else if (a && this.tool === 'ruin') this.startRuin();
      else if (surf == null) this.startPaint();
      return;
    }
    if (!g) return;
    const held = g.btn === 'a' ? a : b;
    if (!held) { this.endGesture(true); return; }
    if (g.mode === 'pending') {
      const dx = this.cur.x - g.start.x, dy = this.cur.y - g.start.y;
      if (Math.hypot(dx, dy) > T * 0.42) {
        const vertical = Math.abs(dy) > Math.abs(dx) * 0.8;
        if (vertical && g.btn === 'a' && dy < 0) this.startHill(1);
        else if (vertical && g.btn === 'b' && dy > 0) this.startHill(-1);
        else this.startPaint();
      }
      return;
    }
    if (g.mode === 'done') return;
    if (g.mode === 'piece') this.movePiece(time);
    else if (g.mode === 'paint') this.paint();
    else if (g.mode === 'ruin') this.shapeRuin();
    else this.shape();
  }
  startPaint() {
    const g = this.g; g.mode = 'paint'; M.begin(this.m, g.btn === 'a' ? 'paint' : 'erase');
    // from the surface: painting starts on the first air tile (A) or the surface tile (B)
    if (g.surf != null) g.last = g.btn === 'a' ? { x: g.cell.x, y: g.surf - 1 } : { x: g.cell.x, y: g.surf };
    this.paintCell(g.last || this.cell());
    this.paint();
  }
  // along the way from the last tile to this one (no gaps when AvA flies fast)
  paint() {
    const g = this.g, c = this.cell(), p = g.last || c;
    const n = Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y));
    for (let i = 1; i <= n; i++) this.paintCell({ x: Math.round(p.x + (c.x - p.x) * i / n), y: Math.round(p.y + (c.y - p.y) * i / n) });
    g.last = c;
  }
  paintCell({ x, y }) {
    const m = this.m, add = this.g.btn === 'a';
    if (this.layer !== 'c') {   // foreground and background: a layer of its own, nothing to carry
      const l = this.layer, get = l === 'f' ? M.frontAt : M.backAt, was = get(m, x, y), br = this.brush();
      if (add ? was === br : was == null) return;
      this.edge(x);
      if (!M.put(m, x, y, add ? br : null, l)) return;
      if (add) this.view.pop(x, y, br, 0, l); else this.view.crumble(x, y, was, 0, l);
      this.puff(x * T + T / 2, y * T + T, add ? br : was, add ? 4 : 6);
      this.note(add ? 'add' : 'remove', -y, add ? br : was, 0.7);
      this.input_.rumble(add ? 0.18 : 0.15, 20, this.cfg.haptics);
      return;
    }
    // A over ground of another material or colour paints it over (the brush recolours, the Farbrad's way to work)
    if (add && M.solid(m, x, y) && (M.setAt(m, x, y) === this.brush() || !M.inParcel(m, x))) return;
    if (!add && !M.solid(m, x, y)) {   // B over air: a back wall there goes
      const b = M.backAt(m, x, y);
      if (b && M.put(m, x, y, null, 'b')) { this.view.crumble(x, y, b, 0, true); this.crumble(x * T + T / 2, y * T + T / 2, b, 4); this.note('remove', -y, b, 0.5); }
      return;
    }
    this.edge(x);
    const set = add ? this.brush() : M.setAt(m, x, y);
    if (!M.put(m, x, y, add ? set : null)) return;
    const T2 = T / 2;
    if (add) { this.view.pop(x, y, set); this.puff(x * T + T2, y * T + T, set, 6); }
    else { this.view.crumble(x, y, set); this.crumble(x * T + T2, y * T + T2, set, 8); }
    if (add && M.solid(m, x, y + 1)) this.view.touch(x);
    this.note(add ? 'add' : 'remove', -y, set, 0.8);
    this.input_.rumble(add ? 0.22 : 0.18, 22, this.cfg.haptics);
  }
  startHill(dir) {
    const g = this.g, m = this.m;
    g.mode = dir > 0 ? 'hill' : 'dig'; g.dir = dir; g.H = 0; g.R = 0;
    M.begin(m, g.mode);
    g.snap = M.snapshot(m, m.parcel[0] - 60, m.parcel[1] + 60); g.base = new Map(); g.cx = g.cell.x;
    g.set = dir > 0 ? this.brush() : M.setAt(m, g.cx, g.surf) || this.brush();
    this.shape();
  }
  // the hill of this moment: height from how far AvA is above (below) the start, width from the height and the sideways pull
  shape() {
    const g = this.g, m = this.m, Hc = this.cfg.hill || {}, max = Hc.max ?? 14;
    const up = (g.start.y - this.cur.y) * g.dir / T;
    const H = clamp(Math.round(up + 0.2), 0, max) * g.dir;
    const R = Math.round(Math.max(Hc.minRadius ?? 2, Math.abs(H) * (Hc.radius ?? 140) / 100 + Math.abs(this.cur.x - g.start.x) / T * (Hc.wide ?? 100) / 100));
    if (H === g.H && R === g.R) return;
    const grewH = Math.abs(H) > Math.abs(g.H);
    g.H = H; g.R = R;
    for (let i = 0; i < 6; i++) { const gr = this.edge(g.cx - R) || this.edge(g.cx + R); if (!gr) break; }
    const { added, removed } = M.shapeHill(m, { cx: g.cx, height: H, radius: R, set: g.set, seed: m.seed }, g.snap, g.base);
    // a ripple from the peak outwards
    for (const [x, y, set] of added) this.view.pop(x, y, set, Math.abs(x - g.cx) * 16);
    for (const [x, y, set] of removed) this.view.crumble(x, y, set, Math.abs(x - g.cx) * 14);
    const peak = (g.snap.get(g.cx) ?? 0) - (g.dir > 0 ? Math.abs(H) : -Math.abs(H) + 1);
    if (added.length || removed.length) {
      this.note(g.dir > 0 ? 'hill' : 'dig', g.dir > 0 ? Math.abs(H) : -Math.abs(H), g.set, grewH ? 1 : 0.45, true);
      this.puff(g.cx * T + T / 2, peak * T + T, g.set, grewH ? 14 : 5);
      if (g.dir > 0 && grewH) for (const side of [-1, 1]) this.crumble((g.cx + side * Math.max(1, R * 0.4)) * T, (peak + 1) * T, g.set, 3, side);
      this.input_.rumble(grewH ? 0.25 + Math.abs(H) * 0.035 : 0.12, grewH ? 40 : 20, this.cfg.haptics);
    }
  }
  // the hand lets go: the step goes on the history; a soft settle (sound, a last puff of dust)
  endGesture(release = false) {
    const g = this.g;
    if (!g) return;
    this.g = null;
    if (g.mode === 'ruin' && !g.moved && release) { this.g = g; this.shapeRuin({ W: 7, H: 7 }); this.g = null; }
    if (g.mode === 'pending') {   // a tap: one tile
      if (!release) return;
      g.mode = 'paint'; this.g = g; M.begin(this.m, g.btn === 'a' ? 'paint' : 'erase');
      const c = g.surf != null ? (g.btn === 'a' ? { x: g.cell.x, y: g.surf - 1 } : { x: g.cell.x, y: g.surf }) : g.cell;
      this.paintCell(c); this.g = null;
    }
    const step = M.end(this.m);
    if (step) {
      this.stats.gestures++;
      this.input_.rumble(0.35, 50, this.cfg.haptics);
      if ((g.mode === 'hill' && Math.abs(g.H) >= 7) || step.changes.length > 40) this.drone.react(Math.random() < 0.5 ? 'curious' : 'love');
      this.dirtySave();
    }
  }
  // building near the parcel's edge: it grows (stakes walk out, a little arpeggio)
  edge(x) {
    const gr = M.grow(this.m, x);
    if (!gr) return null;
    this.placeStakes(true); this.drawUnder();
    this.tones?.play('grow');
    this.input_.rumble(0.3, 80, this.cfg.haptics);
    if (this.g?.snap) for (let i = gr.from; i <= gr.to; i++) this.g.snap.set(i, M.surface(this.m, i));
    return gr;
  }
  back() { const s = M.undo(this.m); if (s) this.replay(s, true); }
  forth() { const s = M.redo(this.m); if (s) this.replay(s, false); }
  replay(step, back) {
    if (step.pieces) this.pieces.rebuild(this.m.pieces);
    const ch = step.changes, xs = ch.map(c => c[0]), mid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    for (const [x, y, b, a, l] of ch) { const now = back ? b : a, was = back ? a : b, d = Math.abs(x - mid) * 10; if (now == null) this.view.crumble(x, y, was, d, l || 'c'); else this.view.pop(x, y, now, d, l || 'c'); }
    const top = ch.reduce((h, c) => Math.max(h, -c[1]), -99);
    this.tones?.play(back ? 'undo' : 'redo', { degree: top });
    this.input_.rumble(0.16, 26, this.cfg.haptics);
    this.dirtySave();
  }
  chooseSet(s) {
    this.set = s; this.hud?.setMaterial(s, this.view.kitOf(s));
    this.tones?.play('select', { degree: this.sets.indexOf(s) % 5 });
    this.input_.rumble(0.12, 18, this.cfg.haptics);
    if (Math.random() < 0.35) this.drone.react('curious');
  }
  brush() { return M.withPaint(this.set, this.color); }
  chooseColor(hex) {
    this.color = hex || null; this.hud?.setMaterial(this.set, this.view.kitOf(this.brush()));
    this.tones?.play('select', { degree: 2 }); this.input_.rumble(0.12, 18, this.cfg.haptics);
    // a piece under AvA takes the colour at once (one step)
    if (this.tool === 'deko') { const i = this.pieces.hit(this.cur.x, this.cur.y); if (i >= 0) { M.begin(this.m, 'paint'); M.setPiece(this.m, i, { c: this.color || undefined }); M.end(this.m); this.pieces.rebuild(this.m.pieces, i); this.dirtySave(); } }
  }
  // ---------- pieces (the Deko tool) ----------
  choosePiece(id) { this.pieceId = id; this.pv = 0; this.ghostKey = null; this.hud?.setMaterial(this.set, this.view.kitOf(this.brush())); this.tones?.play('select', { degree: this.cat.findIndex(c => c.id === id) % 5 }); this.input_.rumble(0.1, 16, this.cfg.haptics); }
  cyclePiece(d) { const i = this.cat.findIndex(c => c.id === this.pieceId); this.choosePiece(this.cat[(i + d + this.cat.length) % this.cat.length].id); }
  // where a piece stands: on the first ground at or under the point (half tiles); hanging ones go where the point is
  spot(id, x, y) {
    const d = this.data_.decor?.[id], sx = Math.round(x / 32) * 32;
    if (!d) return null;
    if (['wall', 'inside', 'climb'].includes(d.place)) return { x: sx, y: Math.round(y / 16) * 16 };
    const col = Math.floor(sx / T - (sx % T === 0 ? 0.5 : 0)), m = this.m;
    let r = Math.floor(y / T);
    if (M.solid(m, col, r)) { while (r > M.top(m) && M.solid(m, col, r - 1)) r--; }
    else { while (r <= M.bottom(m) && !M.solid(m, col, r)) r++; }
    return { x: sx, y: r * T };
  }
  // the next variant: of the piece under AvA, or of the one in hand
  variant() {
    const i = this.pieces.hit(this.cur.x, this.cur.y);
    if (i >= 0) { M.begin(this.m, 'piece'); M.setPiece(this.m, i, { v: (this.m.pieces[i].v || 0) + 1 }); M.end(this.m); this.pieces.rebuild(this.m.pieces, i); this.dirtySave(); }
    else { this.pv++; this.ghostKey = null; }
    this.tones?.play('select', { degree: 3 }); this.input_.rumble(0.1, 16, this.cfg.haptics);
  }
  materialOfPiece(d) { return d?.art === 'icon' ? 'metal' : /metal|blech|tonne|automat/i.test((d?.name || '') + (d?.tags || '')) ? 'metal' : 'wood'; }
  // A on a piece grabs it (left stick moves it, right stick grows it); A on the free ground places the piece in hand and keeps
  // holding it; B on a piece takes it away
  startPiece() {
    const g = this.g, m = this.m, i = this.pieces.hit(this.cur.x, this.cur.y);
    if (g.btn === 'b') {
      g.mode = 'done';
      if (i < 0) return;
      const o = this.pieces.objs[i], p = M.removePiece(m, i);
      M.end(m); this.poof(o); this.pieces.rebuild(m.pieces);
      this.tones?.play('remove', { material: this.materialOfPiece(o?.d) });
      this.input_.rumble(0.3, 40, this.cfg.haptics); this.dirtySave(); return p;
    }
    M.begin(m, 'piece'); g.mode = 'piece'; g.growAt = 0;
    if (i >= 0) { const p = m.pieces[i]; g.i = i; g.ox = p.x - this.cur.x; g.oy = p.y - this.cur.y; this.tones?.play('select', { degree: 1 }); }
    else {
      const q = this.spot(this.pieceId, this.cur.x, this.cur.y); if (!q) { g.mode = 'done'; return; }
      this.edge(Math.floor(q.x / T));
      g.i = M.addPiece(m, { id: this.pieceId, x: q.x, y: q.y, v: this.pv, ...(this.color ? { c: this.color } : {}) }); g.ox = q.x - this.cur.x; g.oy = q.y - this.cur.y; g.placed = true;
      this.pieces.rebuild(m.pieces, g.i);
      const o = this.pieces.objs[g.i]; if (o) this.dust.setParticleTint(0xcbb89a).emitParticleAt((o.x0 + o.x1) / 2, o.y1, 10);
      this.tones?.play('add', { material: this.materialOfPiece(this.data_.decor?.[this.pieceId]) });
    }
    this.input_.rumble(0.28, 40, this.cfg.haptics); this.tap = 1;
  }
  movePiece(time) {
    const g = this.g, m = this.m, p = m.pieces[g.i]; if (!p) return;
    const q = this.spot(p.id, this.cur.x + g.ox, this.cur.y + g.oy);
    if (q && (q.x !== p.x || q.y !== p.y)) { this.edge(Math.floor(q.x / T)); M.setPiece(m, g.i, q); this.pieces.rebuild(m.pieces); g.moved = true; this.tones?.play('move'); }
    // the right stick grows it, step by step (posts get taller, crates stack, tents get wider)
    const d = this.data_.decor?.[p.id], [rx, ry] = this.input_.right;
    if (d?.grow && time > g.growAt && (Math.abs(ry) > 0.5 || Math.abs(rx) > 0.5)) {
      const side = d.grow === 'side', v = side ? Math.sign(rx) : -Math.sign(ry), [lo, hi] = this.pieces.range(d), cur = p.n ?? d.growStart ?? (d.grow === 'steps' ? 0 : 1), n = Math.max(lo, Math.min(hi, cur + v));
      g.growAt = time + 170;
      if (v && n !== cur) { M.setPiece(m, g.i, { n }); this.pieces.rebuild(m.pieces, g.i); this.tones?.play('hill', { material: this.materialOfPiece(d), vel: 0.6 }); this.input_.rumble(0.22 + n * 0.03, 30, this.cfg.haptics); this.tap = 0.8; }
    }
  }
  poof(o) {
    if (!o) return;
    this.dust.setParticleTint(0xb8a890).emitParticleAt((o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2, 18);
    this.crumbs.setParticleTint(0x8a7a6a).emitParticleAt((o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2, 8);
  }
  // the piece in hand as a breathing ghost where it would go; a frame around the piece under AvA
  drawGhost(time) {
    const show = this.tool === 'deko' && !this.g && !this.hud?.wheelOpen;
    const hit = show ? this.pieces.hit(this.cur.x, this.cur.y) : -1, q = show && hit < 0 ? this.spot(this.pieceId, this.cur.x, this.cur.y) : null;
    const key = q ? [this.pieceId, q.x, q.y, this.pv, this.color].join('|') : '';
    if (key !== this.ghostKey) { this.ghostKey = key; this.ghost_?.box.destroy(); this.ghost_ = q ? this.pieces.draw({ id: this.pieceId, x: q.x, y: q.y, v: this.pv, c: this.color }, { alpha: 0.5, depth: 55 }) : null; }
    if (this.ghost_) this.ghost_.box.setAlpha(0.38 + 0.16 * Math.sin(time / 380));
    const gd = this.guide; if (hit >= 0) { const o = this.pieces.objs[hit]; gd.lineStyle(2, 0xffd541, 0.55 + 0.2 * Math.sin(time / 300)).strokeRoundedRect(o.x0 - 6, o.y0 - 6, o.x1 - o.x0 + 12, o.y1 - o.y0 + 12, 8); }
  }
  chooseTool(t) {
    this.tool = t; this.hud?.setMaterial(this.set, this.view.kitOf(this.set));
    this.tones?.play('select', { degree: t === 'ruin' ? 4 : 0 });
    this.input_.rumble(0.12, 18, this.cfg.haptics);
  }
  // ---------- a ruin: anchored at the ground under the start, pulled sideways and up ----------
  startRuin() {
    const g = this.g, m = this.m;
    g.mode = 'ruin'; g.ax = g.cell.x; g.yb = M.surface(m, g.ax); g.set = this.set; g.seed = 1 + Math.floor(Math.random() * 99999);
    M.begin(m, 'ruin');
    g.snap = M.snapshot(m, m.parcel[0] - 60, m.parcel[1] + 60); g.base = new Map(); g.W = 0; g.H = 0;
  }
  shapeRuin(fixed = null) {
    const g = this.g, m = this.m, c = this.cell(), max = Math.min(-M.top(m) - 2, 40);
    const dx = c.x - g.ax, up = g.yb - c.y;
    if (Math.abs(dx) >= 1 || up >= 2) g.moved = true;
    if (!g.moved && !fixed) return;
    const dir = fixed ? 1 : dx < 0 ? -1 : 1, W = fixed ? fixed.W : Math.max(3, Math.abs(dx) + 1), H = fixed ? fixed.H : Math.max(3, Math.min(max, up));
    if (W === g.W && H === g.H) return;
    const grewH = H > g.H, grewW = W > g.W;
    g.W = W; g.H = H;
    const x0 = g.ax, x1 = g.ax + dir * (W - 1);
    for (let i = 0; i < 6; i++) { if (!(this.edge(Math.min(x0, x1)) || this.edge(Math.max(x0, x1)))) break; }
    // the kind follows the height: shed → house → block of flats → high-rise (CampBuilder › Gebäude)
    const kind = M.buildingKind(this.cfg.buildings, H), newKind = g.kind && kind.name !== g.kind.name;
    g.kind = kind;
    if (newKind) { this.tones?.play('grow'); this.hud?.flash(kind.name, 'building'); this.input_.rumble(0.45, 70, this.cfg.haptics); if (H > 12) this.drone.react('curious'); }
    const paint = this.color, K = paint ? { ...kind, frame: M.withPaint(kind.frame, paint), facade: kind.facade && M.withPaint(kind.facade, paint) } : kind;   // the brush colours frame and facade
    const { added, removed } = M.shapeBuilding(m, { x0, x1, base: g.yb, height: H, kind: K, seed: g.seed, set: g.set }, g.snap, g.base);
    g.box = [Math.min(x0, x1), g.yb - H, Math.max(x0, x1), g.yb];
    for (const [x, y, set, back] of added) this.view.pop(x, y, set, (g.yb - y) * 22 + Math.abs(x - g.ax) * 8, back);
    for (const [x, y, set, back] of removed) this.view.crumble(x, y, set, 0, back);
    if (added.length || removed.length) {
      this.note(grewH || grewW ? 'hill' : 'dig', grewH ? H : W, g.set, grewH || grewW ? 1 : 0.5, true);
      this.puff((x0 + x1 + 1) / 2 * T, (g.yb - H + 1) * T, g.set, grewH ? 12 : 6);
      this.input_.rumble(grewH || grewW ? 0.24 + H * 0.02 : 0.12, grewH ? 38 : 22, this.cfg.haptics);
    }
  }
  // the pipette (rechter Stick drücken): the material and the layer under AvA, so one can go on with what is already there
  pipette() {
    const c = this.cell(), m = this.m, f = M.frontAt(m, c.x, c.y), st = M.setAt(m, c.x, c.y), b = M.backAt(m, c.x, c.y);
    const [l, set] = f ? ['f', f] : st ? ['c', st] : b ? ['b', b] : [this.layer, null];
    this.recenter = true;
    if (!set) return;
    if (l !== this.layer) { this.layer = l; this.setFacade(this.facade, false); }
    if (set !== this.set) this.chooseSet(set); else this.hud?.setMaterial(this.set, this.view.kitOf(this.set));
    this.hud?.flash(this.data_.terrain?.[set]?.name || set, 'picker');
  }
  cycleSet(d) { const i = this.sets.indexOf(this.set); this.chooseSet(this.sets[(i + d + this.sets.length) % this.sets.length]); }
  // one note per moment at most (a stroke over many tiles is a melody, not a heap)
  note(kind, degree, set, vel = 1, force = false) {
    const now = this.time.now;
    if (!force && now - this.lastNote < 70) return;
    this.lastNote = now; this.notes++; this.tap = Math.min(1, (this.tap || 0) + 0.7 * vel);
    const cam = this.cam, pan = ((this.cur.x - cam.worldView.x) / cam.worldView.width - 0.5) * 1.4;   // where AvA works, left or right
    this.tones?.play(kind, { degree, material: this.material(set), vel, pan });
  }
  puff(x, y, set, n = 8) { this.dust.setParticleTint(this.view.dustOf(set)); this.dust.emitParticleAt(x, y, n); }
  crumble(x, y, set, n = 6, side = 0) {
    this.crumbs.setParticleTint(this.view.dustOf(set));
    this.crumbs.emitParticleAt(x + side * 6, y, n);
  }

  // ---------- every frame: camera, AvA, the light, the sky ----------
  frame(dt, time) {
    const cam = this.cam, c = this.cur, W = this.scale.width, H = this.scale.height;
    cam.setZoom(cam.zoom + (this.zoom - cam.zoom) * ease(0.14, dt));
    // follow: AvA stays in the middle part of the screen; Rechter Stick drücken = back to her
    const vw = W / cam.zoom, vh = H / cam.zoom, mx = cam.midPoint.x, my = cam.midPoint.y, bx = vw * 0.32, by = vh * 0.28;
    let tx = mx, ty = my;
    if (this.recenter) { tx = c.x; ty = c.y - 100; if (Math.hypot(tx - mx, ty - my) < 8) this.recenter = false; }
    else if (!(time - (this.panned || -1e9) < 1200)) { if (c.x < mx - bx) tx = c.x + bx; if (c.x > mx + bx) tx = c.x - bx; if (c.y < my - by) ty = c.y + by; if (c.y > my + by) ty = c.y - by; }
    const nx = mx + (tx - mx) * ease(this.recenter ? 0.12 : 0.08, dt), ny = my + (ty - my) * ease(this.recenter ? 0.12 : 0.08, dt);
    // keep inside what is drawn: the ground never ends in view
    const [a, b] = this.view.range(), L = (a * 12 + 6) * T + vw / 2, R = ((b + 1) * 12 - 6) * T - vw / 2;
    const top = (M.top(this.m) - AIR - 6) * T + vh / 2, bot = (M.bottom(this.m) + 3) * T - vh / 2;
    cam.centerOn(L > R ? (L + R) / 2 : clamp(nx, L, R), top > bot ? bot : clamp(ny, top, bot));
    // AvA above the point, a light falls from her onto the tile
    const C = this.cfg.cursor || {};
    this.leyla.x = c.x + (c.vx > 0 ? 120 : -120); this.leyla.feet = c.y + 200; this.leyla.facing = c.vx >= 0 ? 1 : -1;
    this.leyla.state = this.idle > 9000 ? 'pose' : 'normal';
    // every building step AvA dips like a hammer stroke and springs back (this.tap decays smoothly, frame-rate independent)
    this.tap = (this.tap || 0) * Math.pow(0.86, dt / 16.67);
    this.drone.build = { x: c.x, y: c.y - (C.above ?? 92) + this.tap * 26, smooth: 0.22 + this.tap * 0.4 };
    this.drone.update(time, dt);
    this.drawCursor(time);
    if (this.hole) this.hole.setPosition(c.x, c.y);
    // sky and light in screen space, counter-scaled against the zoom
    const z = cam.zoom, cx = W / 2, cy = H / 2, scr = (sx, sy) => [cx + (sx - cx) / z, cy + (sy - cy) / z];
    const gy = (0 - cam.worldView.y) * z;
    this.sky.update(time, cam, gy + 6 * z);
    for (const o of [this.sky.img]) { const [px, py] = scr(0, 0); o.setPosition(px, py).setScale(this.sky.k / z); }
    for (const { ts } of this.sky.layers) { const [px, py] = scr(-2, ts.y); ts.setPosition(px, py).setScale(1 / z); }
    { const [px, py] = scr(0, this.sky.ground.y); this.sky.ground.setPosition(px, py).setScale(1 / z); }
    { const [px, py] = scr(0, 0); this.veil.setPosition(px, py).setScale(1 / z).setFillStyle(this.sky.veil ?? 0x0b0d26, this.sky.veilAlpha ?? 0); this.warmth.setPosition(px, py).setScale(1 / z).setFillStyle(0xff9a50, this.sky.warm ?? 0); }
    this.drawFlags(time);
    this.view.update(time);
    this.pieces.update(time, this.sky.S?.dark ?? 0);
    this.drawGhost(time);
    this.hud?.update(time, this);
    if (this.saveAt && time > this.saveAt) { this.saveAt = 0; this.store?.save(this.m); }
    if (this.idle < 4000) this.m.seconds += dt / 1000;
  }
  dirtySave() { this.saveAt = this.time.now + (this.cfg.save?.after ?? 2.5) * 1000; }
  drawCursor(time) {
    const g = this.ghost.clear(), b = this.beam.clear(), gd = this.guide.clear(), c = this.cell(), m = this.m, G = this.g;
    const px = c.x * T, py = c.y * T, breathe = 0.5 + 0.5 * Math.sin(time / 420);
    const remove = G ? G.btn === 'b' : this.layer === 'f' ? !!M.frontAt(m, c.x, c.y) : this.layer === 'b' ? !!M.backAt(m, c.x, c.y) : M.solid(m, c.x, c.y);
    const col = this.layer === 'f' ? (remove ? 0xff9ad0 : 0xff7ac0) : this.layer === 'b' ? (remove ? 0xb8b0ff : 0x9a8cff) : remove ? 0x7ff6ff : 0xffd541;
    // the light from AvA down onto the tile
    const dx = this.drone.x, dy = this.drone.y + 18;
    b.fillStyle(col, 0.07 + 0.04 * breathe).fillTriangle(dx - 10, dy, dx + 10, dy, px + T, py + T).fillTriangle(dx - 10, dy, px, py + T, px + T, py + T);
    b.fillStyle(col, 0.05).fillTriangle(dx - 6, dy, dx + 6, dy, px + T / 2, py + T);
    // the tile: a soft frame, corners brighter
    const a = 0.45 + 0.25 * breathe;
    g.lineStyle(3, col, a).strokeRoundedRect(px + 2, py + 2, T - 4, T - 4, 8);
    g.lineStyle(3, 0xffffff, a * 0.8);
    for (const [cx, cy, sx, sy] of [[px, py, 1, 1], [px + T, py, -1, 1], [px, py + T, 1, -1], [px + T, py + T, -1, -1]]) g.beginPath().moveTo(cx + sx * 4, cy + sy * 16).lineTo(cx + sx * 4, cy + sy * 4).lineTo(cx + sx * 16, cy + sy * 4).strokePath();
    // the tile that A would add, as a ghost
    const f = !remove && (this.layer !== 'c' || !M.solid(m, c.x, c.y)) ? this.view.frameOf(c.x, c.y, this.brush(), this.layer === 'b') : null;
    if (f && !G && this.tool !== 'deko' && (this.tool === 'ground' || this.layer !== 'c')) { this.ghostImg.setVisible(true).setTexture(f.key, f.frame).setPosition(px + T / 2, py + T).setAlpha(0.32 + 0.14 * breathe); }
    else this.ghostImg.setVisible(false);
    // at the surface, while resting: little chevrons say „pull me up“
    const s = M.solid(m, c.x, c.y), surf = s && !M.solid(m, c.x, c.y - 1) ? c.y : !s && M.solid(m, c.x, c.y + 1) ? c.y + 1 : null;
    if (!G && surf != null && this.idle > 500 && this.layer === 'c') {
      const y0 = (surf - 1) * T + 8 - (time / 40 % 14);
      for (let i = 0; i < 2; i++) g.lineStyle(3, 0xffd541, 0.35 * (1 - i * 0.4) * Math.min(1, (this.idle - 500) / 600)).beginPath().moveTo(px + T / 2 - 9, y0 - i * 12 + 6).lineTo(px + T / 2, y0 - i * 12 - 3).lineTo(px + T / 2 + 9, y0 - i * 12 + 6).strokePath();
    }
    // a ruin being pulled: its frame, corners bright
    if (G?.mode === 'ruin' && G.box) {
      const [a, t, b2, yb] = G.box, x0 = a * T, x1 = (b2 + 1) * T, y0 = t * T, y1 = yb * T;
      gd.lineStyle(2, 0xffd541, 0.35).strokeRect(x0, y0, x1 - x0, y1 - y0);
      for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) gd.fillStyle(0xffd541, 0.9).fillCircle(cx, cy, 5);
    }
    // the ruin tool at rest: a little frame of a house above the tile
    if (!G && this.tool === 'ruin' && this.layer === 'c') {
      const s0 = M.surface(m, c.x) * T, k = 0.5 + 0.2 * breathe;
      gd.lineStyle(2, 0xffd541, 0.3 * k).strokeRect(px, s0 - 6 * T, 5 * T, 6 * T);
    }
    // a hill being pulled: a line from the ground up to AvA with a tick per step
    if (G && (G.mode === 'hill' || G.mode === 'dig')) {
      const x = G.cx * T + T / 2, y0 = (G.snap.get(G.cx) ?? 0) * T, n = Math.abs(G.H);
      gd.lineStyle(2, col, 0.5).lineBetween(x, y0, x, y0 - G.dir * n * T);
      for (let i = 1; i <= n; i++) gd.fillStyle(col, i === n ? 0.95 : 0.45).fillCircle(x, y0 - G.dir * i * T, i === n ? 5 : 3);
    }
  }
}

// Atmosphere in rooms and POI levels (area "Atmosphäre", engine/atmosphere.js): darkness with lights, glow, colour mood,
// vignette, dust in the light, sparks, drips and ground fog. Everything from code (Daniel, 11.11.2026).
//
// Lightmap: a small canvas (1/scale of the view) is filled each frame with the ambient light of the rooms (colour mood × brightness,
// one pixel per tile, smoothed), the lights are added on top ('lighter'), then the vignette; it lies over the world with MULTIPLY.
// Lights: lamps at the ceilings (auto + * in the layout), glowing clutter (Kachel-Sets › Leuchtet), a small glow around Leyla,
// Mama-Bot's searchlight (Drohne › Scheinwerfer, only while the part sits on her) and short flashes (sparks).
// Above the lightmap: additive glow of the fixtures and clutter, dust motes, sparks. Below it (lit by it): fog and drips.
import { atmoRegions, planLights, moodOf, behave, hash } from '../../engine/atmosphere.js';

const rgb = c => { const n = parseInt(String(c || '#ffffff').slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const css = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`;
const lerp = (a, b, k) => a + (b - a) * k;

export class Atmosphere {
  // props = clutter stamps from drawRoom (with name and kit), so glowing things can be found
  constructor(scene, props = []) {
    this.scene = scene;
    const s = scene, D = s.data_, G = D.game?.atmosphere || {}, T = s.T, R = s.room;
    this.on = G.enabled !== false && s.mode !== 'camp';
    if (!this.on) return;
    this.G = G; this.T = T;
    this.regionAt = atmoRegions(D, R, { level: s.levelInfo, roomId: s.roomId, poiId: s.levelPoi });
    this.moods = new Map();
    this.moodAt = (tx, ty) => { const id = this.regionAt(Math.max(0, Math.min(R.w - 1, tx)), Math.max(0, Math.min(R.h - 1, ty))).mood; if (!this.moods.has(id)) this.moods.set(id, moodOf(D, id)); return this.moods.get(id); };
    const plan = planLights(D, R, this.regionAt);
    this.ceilings = plan.ceilings; this.faces = plan.faces;
    // nothing to do at all (every room bright, no lamps, nothing moving): stay out of the way
    const any = [...new Set([...Array(R.w).keys()].flatMap(x => [0, Math.floor(R.h / 2), R.h - 1].map(y => this.regionAt(x, y).mood)))].map(id => moodOf(D, id))
      .some(m => m.ambient < 1 || m.color.toLowerCase() !== '#ffffff' || m.vignette || m.dust.count || m.fog.count || m.drips.perMinute || m.sparks.perMinute) || plan.lamps.length;
    if (!any) { this.on = false; return; }
    this.depth = G.depth ?? 14;

    // ambient: one pixel per tile, colour mood × brightness (smoothing makes soft transitions between rooms)
    this.amb = document.createElement('canvas'); this.amb.width = R.w; this.amb.height = R.h;
    const ac = this.amb.getContext('2d'), img = ac.createImageData(R.w, R.h);
    this.ambLum = new Float32Array(R.w * R.h);
    for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) {
      const m = this.moodAt(x, y), c = rgb(m.color), i = (y * R.w + x) * 4;
      img.data[i] = c[0] * m.ambient; img.data[i + 1] = c[1] * m.ambient; img.data[i + 2] = c[2] * m.ambient; img.data[i + 3] = 255;
      this.ambLum[y * R.w + x] = (c[0] + c[1] + c[2]) / 765 * m.ambient;
    }
    ac.putImageData(img, 0, 0);

    // lightmap canvas texture, over the world with MULTIPLY
    const k = Math.max(1, G.scale || 4), margin = 160, view = s.cam.worldView;
    this.k = k; this.margin = margin;
    this.lw = Math.ceil((s.scale.width / s.cam.zoom + margin * 2) / k); this.lh = Math.ceil((s.scale.height / s.cam.zoom + margin * 2) / k);
    if (s.textures.exists('atmo_light')) s.textures.remove('atmo_light');
    this.tex = s.textures.createCanvas('atmo_light', this.lw, this.lh);
    this.ctx = this.tex.getContext();
    this.image = s.add.image(view.x, view.y, 'atmo_light').setOrigin(0).setDisplaySize(this.lw * k, this.lh * k).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(this.depth);

    // lights: lamps (fixture + glow), glowing clutter, Leyla, the searchlight
    this.fixtures = s.add.graphics().setDepth(-9.5);
    this.lights = [];
    for (const L of plan.lamps) this.addLamp(L);
    for (const p of props) this.addGlow(p);
    this.flashes = [];
    // dust, sparks (additive, above the lightmap), drips and fog (below, lit by it)
    this.top = s.add.graphics().setDepth(this.depth + 0.6).setBlendMode(Phaser.BlendModes.ADD);
    this.low = s.add.graphics().setDepth(this.depth - 1);
    this.dust = []; this.sparks = []; this.drips = []; this.fog = [];
    this.vig = 0; this.cur = null; this.time = 0;
    this.spotGlow = s.add.image(0, 0, s.fx.glowKey()).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 0.5).setVisible(false);
    // drawn right before the world camera renders: its view is final then (it follows Leyla after update, also in headless steps)
    s.cam.on('prerender', () => this.render());
  }

  // ---------- lights ----------
  addLamp(L) {
    const s = this.scene, T = this.T, x = (L.x + 0.5) * T, y = L.y * T, c = rgb(L.color), reg = L.region;
    const clip = { x0: reg.x * T, y0: reg.y * T, x1: (reg.x + reg.w) * T, y1: (reg.y + reg.h) * T };
    const g = this.fixtures, lit = Phaser.Display.Color.GetColor(...c);
    // fixture from code: cable, shade, tube, box
    let ly = y + 14;
    if (L.kind === 'tube') {
      g.fillStyle(0x2a2d33).fillRect(x - 6, y, 3, 8).fillRect(x + 3, y, 3, 8).fillStyle(0x3a3e46).fillRect(x - 54, y + 8, 108, 7);
      g.fillStyle(lit).fillRect(x - 50, y + 15, 100, 6); ly = y + 18;
    } else if (L.kind === 'emergency') {
      g.fillStyle(0x30343a).fillRect(x - 13, y, 26, 14).fillStyle(lit).fillRect(x - 9, y + 3, 18, 8).fillStyle(0xffffff, 0.8).fillRect(x - 3, y + 5, 6, 3); ly = y + 8;
    } else if (L.kind === 'bulb') {
      g.fillStyle(0x1c1d22).fillRect(x - 1, y, 3, 26).fillStyle(0x50545c).fillRect(x - 4, y + 24, 9, 6).fillStyle(lit).fillCircle(x + 0.5, y + 36, 7); ly = y + 36;
    } else {
      g.fillStyle(0x1c1d22).fillRect(x - 1, y, 3, 18).fillStyle(0x4a4f58).fillTriangle(x - 26, y + 34, x + 27, y + 34, x + 0.5, y + 16).fillRect(x - 26, y + 32, 53, 4);
      g.fillStyle(lit).fillRect(x - 18, y + 36, 37, 4); ly = y + 36;
    }
    const halo = s.add.image(x, ly, s.fx.glowKey()).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 0.5).setTint(lit);
    const hw = L.kind === 'tube' ? 260 : L.kind === 'emergency' ? 120 : 110;
    halo.setDisplaySize(hw, L.kind === 'tube' ? 70 : hw);
    this.lights.push({ kind: L.kind, x, y: ly, c, radius: L.radius, strength: L.strength / 100, behavior: L.behavior, seed: L.seed, clip, halo, haloA: L.kind === 'emergency' ? 0.7 : 0.55, lamp: true, fixed: L.fixed, f: 1 });
  }
  addGlow(p) {
    const s = this.scene, rows = p.kit?.def?.glows || [], r = rows.find(r => r.name === p.name);
    if (!r) return;
    const [cx, cy] = r.at || [p.cw / 2, p.ch / 2], [w, h] = r.size || [p.cw / 2, p.ch / 2], sc = p.scale || 1;
    const x = p.scale ? p.ax + (cx - p.ox * p.cw) * sc : p.x + cx, y = p.scale ? p.ay + (cy - p.oy * p.ch) * sc : p.y + cy;
    const c = rgb(r.color), lit = Phaser.Display.Color.GetColor(...c);
    const halo = s.add.image(x, y, s.fx.glowKey()).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 0.5).setTint(lit).setDisplaySize(w * sc * 1.8, h * sc * 1.8);
    this.lights.push({ kind: 'bulb', x, y, c, radius: r.light ?? 200, strength: (r.strength ?? 80) / 100, behavior: r.behavior || 'steady', seed: hash(Math.round(x), Math.round(y), 5), clip: null, halo, haloA: 0.45 * (r.strength ?? 80) / 100, glow: p.name, f: 1 });
  }
  // Mama-Bot's searchlight: lens position and direction while the part sits on her
  spot() {
    const dr = this.scene.drone, S = this.scene.data_.drone?.spot;
    if (!dr || !S || dr.d.enabled === false || !dr.sprite.visible) return null;
    const name = S.part || 'Suchscheinwerfer', part = (dr.partImgs || []).find(p => p.r.name === name);
    if (!part?.img.visible) return null;
    const look = dr.sprite.scaleX < 0 ? -1 : 1, k = dr.scale, rot = dr.sprite.rotation, [ox, oy] = dr.org, [px, py] = S.at || [ox + 40, oy + 30];
    const lx = (px - ox) * k * look, ly = (py - oy) * k;
    const x = dr.sprite.x + lx * Math.cos(rot) - ly * Math.sin(rot), y = dr.sprite.y + lx * Math.sin(rot) + ly * Math.cos(rot);
    const tilt = (S.tilt ?? 14) * Math.PI / 180, dir = look > 0 ? tilt + rot : Math.PI - tilt + rot;
    return { x, y, dir, half: (S.angle ?? 46) / 2 * Math.PI / 180, range: S.range ?? 760, c: rgb(S.color || '#fff2c8'), strength: (S.strength ?? 85) / 100, glow: (S.glow ?? 90) / 100 };
  }
  flash(x, y, color, radius = 200, life = 140) { this.flashes.push({ x, y, c: rgb(color), radius, strength: 0.9, t: 0, life }); }

  // brightness 0..1 at a world point (ambient + lights, without vignette): dust, tests
  lightAt(x, y) {
    if (!this.on) return 1;
    const R = this.scene.room, tx = Math.max(0, Math.min(R.w - 1, Math.floor(x / this.T))), ty = Math.max(0, Math.min(R.h - 1, Math.floor(y / this.T)));
    let v = this.ambLum[ty * R.w + tx];
    const add = (l, f) => { v += f * l.strength * (l.c[0] + l.c[1] + l.c[2]) / 765; };
    for (const l of this.lights) {
      if (l.clip && (x < l.clip.x0 || x > l.clip.x1 || y < l.clip.y0 || y > l.clip.y1)) continue;
      const dx = x - l.x, dy = y - l.y, d = Math.hypot(dx, dy);
      if (d > l.radius) continue;
      const fall = 1 - d / l.radius;
      if (l.kind === 'ceiling' || l.kind === 'tube') { const a = Math.abs(Math.atan2(dy, dx) - Math.PI / 2), half = l.kind === 'tube' ? 1.0 : 0.62; if (a > half * 1.35 && d > 50) continue; add(l, l.f * fall * (a > half ? 0.35 : 1)); }
      else add(l, l.f * fall);
    }
    const sp = this.lastSpot;
    if (sp) {
      const dx = x - sp.x, dy = y - sp.y, d = Math.hypot(dx, dy);
      let a = Math.atan2(dy, dx) - sp.dir; a = Math.atan2(Math.sin(a), Math.cos(a));
      if (d < sp.range && Math.abs(a) < sp.half * 1.35) add(sp, (1 - d / sp.range) * (Math.abs(a) < sp.half ? 1 : 0.35));
    }
    const l = this.scene.leyla, G = this.G.leyla || {};
    if (l) { const d = Math.hypot(x - l.x, y - l.chest); const r = G.radius ?? 260; if (d < r) v += (G.strength ?? 22) / 100 * (1 - d / r); }
    return Math.min(1, v);
  }

  // ---------- time: lamps flicker, particles move ----------
  update(time, dt) {
    if (!this.on) return;
    const s = this.scene, T = this.T, l = s.leyla;
    this.time += dt;
    const mood = this.moodAt(Math.floor(l.x / T), Math.floor((l.feet - 40) / T));
    this.vig = lerp(this.vig, mood.vignette, Math.min(1, dt / 600));
    for (const L of this.lights) {
      L.f = s.fog?.hiddenAt?.(L.x, L.y + 8) ? 0 : behave(L.behavior, this.time, L.seed);   // a lamp inside an undiscovered secret stays dark
      L.halo.setAlpha(L.haloA * L.f);
      if (L.behavior === 'broken' && L.f > 0.6 && (L.was ?? 0) < 0.3 && Math.random() < 0.5) this.burst(L.x, L.y, '#ffd27a', 7);   // catches: sparks
      L.was = L.f;
    }
    this.flashes = this.flashes.filter(f => (f.t += dt) < f.life);
    this.lastSpot = this.spot();
    this.particles(mood, dt, s.cam.worldView);
  }

  // ---------- lightmap ----------
  render() {
    if (!this.on || this.hidden || !this.scene.leyla) return;
    const s = this.scene, cam = s.cam, k = this.k, m = this.margin, T = this.T, ctx = this.ctx;
    const vw = cam.worldView, x0 = vw.x - m, y0 = vw.y - m, W = this.lw * k, H = this.lh * k, l = s.leyla;
    const X = wx => (wx - x0) / k, Y = wy => (wy - y0) / k;

    // ambient of the rooms
    ctx.globalCompositeOperation = 'copy';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.amb, x0 / T, y0 / T, W / T, H / T, 0, 0, this.lw, this.lh);
    ctx.globalCompositeOperation = 'lighter';
    // lamps and glowing things
    for (const L of this.lights) {
      if (L.x + L.radius < x0 || L.x - L.radius > x0 + W || L.y + L.radius < y0 || L.y - L.radius > y0 + H) continue;
      const a = L.strength * L.f;
      if (a < 0.01) continue;
      if (L.clip) { ctx.save(); ctx.beginPath(); ctx.rect(X(L.clip.x0), Y(L.clip.y0), (L.clip.x1 - L.clip.x0) / k, (L.clip.y1 - L.clip.y0) / k); ctx.clip(); }
      const lx = X(L.x), ly = Y(L.y), r = L.radius / k;
      if (L.kind === 'ceiling') { blob(ctx, lx, ly, r * 0.32, L.c, a * 0.8); cone(ctx, lx, ly, Math.PI / 2, 0.62, r, L.c, a); }
      else if (L.kind === 'tube') { blob(ctx, lx, ly, r * 0.38, L.c, a * 0.7, 2.6); cone(ctx, lx, ly, Math.PI / 2, 1.0, r, L.c, a * 0.85); }
      else blob(ctx, lx, ly, r, L.c, a);
      if (L.clip) ctx.restore();
    }
    // short flashes (sparks)
    for (const f of this.flashes) blob(ctx, X(f.x), Y(f.y), f.radius / k, f.c, f.strength * (1 - f.t / f.life));
    // Leyla never vanishes completely
    const LG = this.G.leyla || {};
    if (l && (LG.strength ?? 22) > 0) blob(ctx, X(l.x), Y(l.chest), (LG.radius ?? 260) / k, [255, 240, 225], (LG.strength ?? 22) / 100);
    // Mama-Bot's searchlight
    const sp = this.lastSpot;
    if (sp) { cone(ctx, X(sp.x), Y(sp.y), sp.dir, sp.half, sp.range / k, sp.c, sp.strength); blob(ctx, X(sp.x), Y(sp.y), 60 / k, sp.c, sp.strength * 0.8); }
    this.spotGlow.setVisible(!!sp);
    if (sp) this.spotGlow.setPosition(sp.x, sp.y).setTint(Phaser.Display.Color.GetColor(...sp.c)).setDisplaySize(70, 70).setAlpha(0.6 * sp.glow);
    // vignette around the middle of the view
    if (this.vig > 0.005) {
      ctx.globalCompositeOperation = 'multiply';
      const cx = X(vw.centerX), cy = Y(vw.centerY), rr = Math.hypot(vw.width, vw.height) / 2 / k, v = Math.round(255 * (1 - this.vig));
      const g = ctx.createRadialGradient(cx, cy, rr * 0.45, cx, cy, rr);
      g.addColorStop(0, 'rgb(255,255,255)'); g.addColorStop(1, `rgb(${v},${v},${v})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.lw, this.lh);
    }
    ctx.globalCompositeOperation = 'source-over';
    this.tex.refresh();
    this.image.setPosition(x0, y0);
  }

  // ---------- dust, sparks, drips, fog ----------
  particles(mood, dt, vw) {
    const s = this.scene, sec = dt / 1000, T = this.T, top = this.top.clear(), low = this.low.clear();
    // dust motes: drift in the view, wrap around its edges; inside: only where light falls
    const D = mood.dust, want = D.count || 0;
    while (this.dust.length < want) this.dust.push({ x: vw.x + Math.random() * vw.width, y: vw.y + Math.random() * vw.height, ph: Math.random() * 6.28, z: 0.5 + Math.random() });
    if (this.dust.length > want) this.dust.length = want;
    const dc = Phaser.Display.Color.GetColor(...rgb(D.color || '#f0e6d0')), [vx, vy] = D.drift || [0, 0], size = D.size || 3, base = (D.alpha ?? 50) / 100;
    for (const p of this.dust) {
      p.ph += sec * 0.9;
      p.x += (vx * p.z + Math.sin(p.ph) * 8) * sec; p.y += (vy * p.z + Math.cos(p.ph * 0.7) * 6) * sec;
      if (p.x < vw.x - 20) p.x += vw.width + 40; else if (p.x > vw.right + 20) p.x -= vw.width + 40;
      if (p.y < vw.y - 20) p.y += vw.height + 40; else if (p.y > vw.bottom + 20) p.y -= vw.height + 40;
      if (s.pointSolid(p.x, p.y)) continue;
      let a = base;
      if (D.inLight) { const m = this.moodAt(Math.floor(p.x / T), Math.floor(p.y / T)); a *= Math.max(0, Math.min(1, (this.lightAt(p.x, p.y) - m.ambient * 0.9) * 2.2)); }
      if (a > 0.02) top.fillStyle(dc, a * (0.6 + 0.4 * Math.sin(p.ph * 2.3))).fillRect(Math.round(p.x), Math.round(p.y), size * p.z, size * p.z);
    }
    // sparks at walls in the view (broken cables), plus the bursts of broken lamps
    const S = mood.sparks;
    if (S.perMinute && Math.random() < S.perMinute / 60 * sec && this.faces.length) {
      const near = this.faces.filter(([x, y]) => x * T > vw.x && x * T < vw.right && y * T > vw.y && y * T < vw.bottom);
      if (near.length) { const [fx, fy] = near[Math.floor(Math.random() * near.length)]; this.burst((fx + Math.random()) * T, (fy + Math.random()) * T, S.color || '#ffb040', 10); }
    }
    for (const p of this.sparks) { p.vy += 1600 * sec; p.x += p.vx * sec; p.y += p.vy * sec; p.life -= dt; }
    this.sparks = this.sparks.filter(p => p.life > 0 && !s.pointSolid(p.x, p.y));
    for (const p of this.sparks) top.fillStyle(p.c, Math.min(1, p.life / 200)).fillRect(p.x, p.y, 3, 3).fillStyle(p.c, Math.min(0.5, p.life / 400)).fillRect(p.x - p.vx * 0.012, p.y - p.vy * 0.012, 2, 2);
    // drips from the ceilings in the view
    const DR = mood.drips;
    if (DR.perMinute && Math.random() < DR.perMinute / 60 * sec && this.ceilings.length) {
      const near = this.ceilings.filter(([x, y]) => x * T > vw.x && x * T < vw.right && y * T > vw.y && y * T < vw.bottom);
      if (near.length) { const [cx, cy] = near[Math.floor(Math.random() * near.length)]; this.drips.push({ x: (cx + 0.2 + Math.random() * 0.6) * T, y: cy * T + 2, vy: 0, hang: 600 + Math.random() * 900, c: Phaser.Display.Color.GetColor(...rgb(DR.color || '#9ec8d8')) }); }
    }
    for (const d of this.drips) {
      if (d.hang > 0) { d.hang -= dt; low.fillStyle(d.c, 0.8).fillRect(d.x - 1, d.y, 3, 3 + (1 - d.hang / 1500) * 3); continue; }
      d.vy += 2200 * sec; d.y += d.vy * sec;
      if (s.pointSolid(d.x, d.y + 4) || s.groundAt(d.x, d.y + 4)) { d.done = true; for (let i = 0; i < 4; i++) this.sparks.push({ x: d.x, y: d.y, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 120, life: 180, c: d.c }); continue; }
      low.fillStyle(d.c, 0.85).fillRect(d.x - 1, d.y - 6, 3, 8);
    }
    this.drips = this.drips.filter(d => !d.done && d.y < s.room.h * T);
    // ground fog: soft drifting banks on the floors in the view
    const F = mood.fog, fw = F.count || 0;
    while (this.fog.length < fw) { const f = this.fogSpot(vw, true); if (!f) break; this.fog.push(f); }
    if (this.fog.length > fw) this.fog.splice(fw).forEach(f => f.img.destroy());
    const fc = Phaser.Display.Color.GetColor(...rgb(F.color || '#7d8ea0')), fa = (F.alpha ?? 18) / 100, fh = F.height || 90;
    for (const f of this.fog) {
      f.x += (F.speed ?? 10) * f.z * sec; f.ph += sec * 0.4;
      if (f.x > vw.right + 300 || f.x < vw.x - 300 || f.floor < vw.y - 100 || f.floor > vw.bottom + 200) { const n = this.fogSpot(vw, false); if (n) Object.assign(f, { x: n.x, floor: n.floor, z: n.z }); }
      f.img.setPosition(f.x, f.floor - fh * 0.25).setTint(fc).setDisplaySize(520 * f.z, fh * 1.6).setAlpha(fa * (0.7 + 0.3 * Math.sin(f.ph)));
    }
  }
  fogSpot(vw, anywhere) {
    const T = this.T, R = this.scene.room, s = this.scene;
    for (let i = 0; i < 20; i++) {
      const x = anywhere ? vw.x + Math.random() * vw.width : vw.x - 250 + Math.random() * 60, tx = Math.floor(x / T);
      if (tx < 0 || tx >= R.w) continue;
      const rows = [];
      for (let ty = Math.max(1, Math.floor(vw.y / T)); ty < Math.min(R.h, Math.ceil(vw.bottom / T) + 1); ty++) if (R.solid(tx, ty) && !R.solid(tx, ty - 1)) rows.push(ty);
      if (!rows.length) continue;
      const floor = rows[Math.floor(Math.random() * rows.length)] * T, z = 0.7 + Math.random() * 0.6;
      const img = anywhere ? s.add.image(x, floor, s.fx.glowKey()).setDepth(this.depth - 1) : null;
      return { x, floor, z, ph: Math.random() * 6.28, img };
    }
    return null;
  }
  burst(x, y, color, n = 8) {
    const c = Phaser.Display.Color.GetColor(...rgb(color));
    for (let i = 0; i < n; i++) this.sparks.push({ x, y, vx: (Math.random() - 0.5) * 520, vy: -Math.random() * 380, life: 260 + Math.random() * 360, c });
    this.flash(x, y, color, 180, 160);
  }

  // switch everything off and on again (comparison pictures, tests); the lamps keep hanging
  show(v) {
    if (!this.tex) return false;
    this.hidden = !v;
    for (const o of [this.image, this.fixtures, this.top, this.low, ...this.lights.map(L => L.halo), ...this.fog.map(f => f.img)]) o.setVisible(v);
    if (!v) this.spotGlow.setVisible(false);
    return v;
  }

  state() {
    if (!this.on) return { on: false };
    const l = this.scene.leyla, sp = this.lastSpot;
    return {
      on: true, lamps: this.lights.filter(L => L.lamp).map(L => ({ kind: L.kind, x: Math.round(L.x), y: Math.round(L.y), behavior: L.behavior, fixed: !!L.fixed })),
      glows: this.lights.filter(L => L.glow).map(L => ({ name: L.glow, x: Math.round(L.x), y: Math.round(L.y) })),
      mood: this.moodAt(Math.floor(l.x / this.T), Math.floor((l.feet - 40) / this.T)).id, spot: sp ? { x: Math.round(sp.x), y: Math.round(sp.y), dir: +sp.dir.toFixed(2) } : null,
      dust: this.dust.length, fog: this.fog.length, drips: this.drips.length, sparks: this.sparks.length,
      atLeyla: +this.lightAt(l.x, l.chest).toFixed(3), ahead: +this.lightAt(l.x + l.facing * 380, l.chest + 40).toFixed(3),
    };
  }
}

// soft round light (sx = horizontal stretch, neon tubes)
function blob(ctx, x, y, r, c, a, sx = 1) {
  if (r <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, css(c, Math.min(1, a))); g.addColorStop(0.45, css(c, Math.min(1, a) * 0.45)); g.addColorStop(1, css(c, 0));
  ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}
// cone of light from (x, y) towards angle dir, half opening half; two wedges for a soft edge
function cone(ctx, x, y, dir, half, len, c, a) {
  if (len <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, len);
  g.addColorStop(0, css(c, Math.min(1, a))); g.addColorStop(0.5, css(c, Math.min(1, a) * 0.4)); g.addColorStop(1, css(c, 0));
  ctx.fillStyle = g;
  for (const [m, f] of [[1.35, 0.35], [1, 0.65]]) {
    ctx.globalAlpha = f;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, len, dir - half * m, dir + half * m); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

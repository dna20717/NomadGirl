// Throwables (#139 Werfer, #140 Leyla's grenade): one code for everything that flies in an arc and goes off.
// Ballistic flight with gravity, bounces off tiles (grenade) or shatters on the first contact (molotov, acid), a landing marker
// on the ground from the moment it leaves the hand, an explosion whose damage stops at walls and chests (combat.blockedAt,
// scene.covers), and a burning or corrosive area that hurts whoever stands in it. Code shapes, or (#176) the painted grenade and fireball from Leyla › Granate.
//
//   const T = Throwables.of(scene)
//   T.throw({ x, y, vx, vy, item: 'granate' | 'molotow' | 'saeure', fuse, radius, damage, burn, friendly, from })
//   Throwables.aim(x0, y0, tx, ty, gravity)   → { vx, vy } for a lob that lands at (tx, ty)
//   T.predict(x, y, vx, vy, item)            → { x, y } where it comes down (the marker)
//   T.blast(x, y, { radius, damage, friendly, knockback, from }, time) → names of what it hit
//
// friendly = Leyla threw it: it hurts enemies, not her. Enemy throws hurt Leyla, not other enemies (⚠️ no friendly fire).
import { blastSirens } from './traits/alarm.js';

export const THROW_GRAVITY = 2200;   // px/s², a little softer than the world, so lobs read well
const SHATTER = new Set(['molotow', 'saeure']);
const COLORS = { granate: 0x4e5a3a, molotow: 0xb06a2a, saeure: 0x7fbf3a };
const AREA_COLORS = { molotow: [0xff7a1a, 0xffd27a], saeure: [0x8fe04a, 0xd8ff8a] };

export class Throwables {
  // #190 ① (persona test #189: „zweiter Run, Granate, das Spiel friert ein“): Phaser keeps the scene object over a restart (camp ↔ run),
  // so scene.throwables survived while its graphics and pictures belonged to the old scene → setTexture on a destroyed image ('sys').
  // A destroyed graphics means a new scene: start over.
  static live(scene) { const t = scene.throwables; if (t && !t.g?.scene) scene.throwables = null; return scene.throwables || null; }   // #190 ① only one of this scene
  static of(scene) { const t = scene.throwables; return (scene.throwables = t && t.g?.scene ? t : new Throwables(scene)); }
  constructor(scene) {
    this.s = scene; this.list = []; this.areas = []; this.rings = []; this.log = [];
    this.g = scene.add.graphics().setDepth(14);
    this.marks = scene.add.graphics().setDepth(6);
  }

  // the start velocity of a lob from (x0, y0) that lands at (tx, ty): higher for far throws, at least a short arc
  static aim(x0, y0, tx, ty, gravity = THROW_GRAVITY, { min = 0.55, max = 1.25, per = 760 } = {}) {
    const dx = tx - x0, dy = ty - y0, t = Math.max(min, Math.min(max, Math.abs(dx) / per + 0.35));
    return { vx: dx / t, vy: (dy - 0.5 * gravity * t * t) / t, t };
  }

  solid(x, y) {
    const s = this.s;
    if (s.pointSolid(x, y)) return 'wall';
    if ((s.covers?.() || []).some(c => x > c.x - c.w / 2 && x < c.x + c.w / 2 && y > c.top && y < c.feet)) return 'cover';
    return null;
  }

  // the flight without bounces: where it first touches something solid (the marker)
  predict(x, y, vx, vy, gravity = THROW_GRAVITY, max = 3) {
    const dt = 1 / 120;
    for (let t = 0; t < max; t += dt) {
      vy += gravity * dt;
      const nx = x + vx * dt, ny = y + vy * dt;
      if (this.solid(nx, ny)) {
        if (this.solid(nx, y) && !this.solid(x, ny)) return { x, y: this.floorBelow(x, ny), wall: true };
        return { x: nx, y: this.floorBelow(nx, y) };
      }
      x = nx; y = ny;
    }
    return { x, y };
  }
  // the top of the floor under a point (so the marker lies on the ground)
  floorBelow(x, y) {
    const s = this.s;
    for (let k = 0; k < 400; k += 2) if (this.solid(x, y + k)) return y + k;
    return y;
  }

  throw(o) {
    const s = this.s, item = o.item || 'granate', time = o.time ?? s.now ?? s.time.now;
    const p = { ...o, item, gravity: o.gravity ?? THROW_GRAVITY, fuse: o.fuse ?? 900, radius: o.radius ?? 140, damage: o.damage ?? 20, burn: o.burn ?? 0,
      knockback: o.knockback ?? 420, at: time, landedAt: null, dead: false, spin: (Math.random() - 0.5) * 18, rot: 0 };
    p.mark = this.predict(p.x, p.y, p.vx, p.vy, p.gravity);
    this.list.push(p);
    this.log.push({ kind: 'throw', item, friendly: !!p.friendly, at: time, mark: { x: Math.round(p.mark.x), y: Math.round(p.mark.y) } });
    s.sfx?.('melee_whoosh', { x: p.x });
    return p;
  }

  update(time, dt) {
    const k = Math.min(0.05, dt / 1000), s = this.s;
    for (const p of this.list) {
      if (p.dead) continue;
      if (p.landedAt == null || !SHATTER.has(p.item)) {
        const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * k / 10));
        for (let i = 0; i < n && !p.dead; i++) this.move(p, k / n, time);
      }
      if (!p.dead && p.item === 'granate' && p.landedAt != null && time >= p.landedAt + p.fuse) this.explode(p, time);
      if (!p.dead && time - p.at > 6000) this.explode(p, time);   // never lies around for ever
      p.rot += p.spin * k;
    }
    this.list = this.list.filter(p => !p.dead);
    for (const a of this.areas) this.tickArea(a, time);
    this.areas = this.areas.filter(a => time < a.until);
    this.rings = this.rings.filter(r => time < r.at + r.life);
    this.draw(time);
  }

  move(p, k, time) {
    const s = this.s;
    p.vy += p.gravity * k;
    const nx = p.x + p.vx * k, ny = p.y + p.vy * k;
    // a molotov bursts on a body too (Leyla for enemy throws, enemies for hers)
    if (SHATTER.has(p.item) && this.bodyAt(nx, ny, p.friendly)) { p.x = nx; p.y = ny; return this.shatter(p, time); }
    if (!this.solid(nx, ny)) { p.x = nx; p.y = ny; return; }
    if (SHATTER.has(p.item)) { if (!this.solid(nx, p.y)) p.x = nx; return this.shatter(p, time); }
    // grenade: bounce, lose speed, come to rest
    const hitX = this.solid(nx, p.y), hitY = this.solid(p.x, ny);
    if (hitX) p.vx *= -0.45; else p.x = nx;
    if (hitY || (!hitX && !hitY)) {
      if (p.vy > 0) {   // ground
        if (p.landedAt == null) { p.landedAt = time; s.sfx?.('land_soft', { x: p.x, k: 0.2 }); }
        const rolling = Math.abs(p.vy) < 260;
        p.vy = rolling ? 0 : -p.vy * 0.3; p.vx *= rolling ? Math.max(0, 1 - 9 * k) : 0.45;   // bounce, then it rolls out quickly
        if (Math.abs(p.vx) < 20) p.vx = 0;
        p.mark = { x: p.x, y: this.floorBelow(p.x, p.y) };
      } else p.vy *= -0.3;   // ceiling
    } else p.y = ny;
  }

  bodyAt(x, y, friendly) {
    const s = this.s;
    if (!friendly) { const l = s.leyla, b = l?.body; return !!(l?.alive && x > b.left && x < b.right && y > b.top && y < b.bottom); }
    return s.enemies.some(e => e.alive && x > e.body.left && x < e.body.right && y > e.body.top && y < e.body.bottom);
  }

  shatter(p, time) {
    const s = this.s, feet = this.floorBelow(p.x, p.y - 4);
    p.dead = true;
    const [c1, c2] = AREA_COLORS[p.item] || AREA_COLORS.molotow;
    s.fx.sparks(p.x, p.y, c2, 14); s.fx.puff?.(p.x, feet, c1);
    s.fx.light?.(p.x, feet - 30, { radius: p.radius * 1.4, color: c1, alpha: 0.8, life: 200 });
    s.noise?.(p.x, p.y, 900);
    // the splash itself hurts a little, the area does the rest
    this.blast(p.x, Math.min(p.y, feet - 20), { radius: p.radius * 0.7, damage: Math.round(p.damage * 0.5), friendly: p.friendly, knockback: 160, from: p.from, item: p.item }, time);
    const w = p.radius * 1.6;
    this.areas.push({ item: p.item, x: p.x, feet, w, at: time, until: time + Math.max(800, (p.burn || 3) * 1000), next: time + 200,
      damage: Math.max(1, Math.round(p.damage * (p.item === 'saeure' ? 0.3 : 0.25))), friendly: p.friendly, from: p.from });
    this.log.push({ kind: 'area', item: p.item, x: Math.round(p.x), feet: Math.round(feet), at: time });
  }

  explode(p, time) {
    const s = this.s;
    p.dead = true;
    if (SHATTER.has(p.item)) return this.shatter(p, time);
    const y = p.y - 14;
    s.fx.flash(p.x, y, 0xfff2b0, p.radius * 0.45);
    s.fx.light?.(p.x, y, { radius: p.radius * 0.6, color: 0xfff6d8, alpha: 1, life: 120 });
    s.fx.light?.(p.x, y, { radius: p.radius * 2.2, color: 0xff9a3a, alpha: 0.85, life: 260 });
    s.fx.sparks(p.x, y, 0xffd27a, 26); s.fx.puff?.(p.x, p.y, 0x6b6670); s.fx.dust?.(p.x, p.y, 14);
    s.cam?.shake(260, 0.012);
    s.noise?.(p.x, y, 1600);
    this.rings.push({ x: p.x, y, r: p.radius, at: time, life: 320, ball: true });
    boom(s, p.radius);
    this.blast(p.x, y, p, time);
    blastSirens(s, p.x, y, p.radius, p.damage ?? 20, time);   // #155
    s.level?.doorways?.blast(p.x, y, p.radius, p.damage ?? 20, time);   // #174 a grenade blows doors in (also bulkheads)
    // ⚠️ explosions open brittle walls in reach (concept 3.2)
    const r = p.radius * 0.6;
    s.level?.meleeHit?.(p.x - r, p.x + r, y - r, y + r);
  }

  // damage in a radius, cut by walls and chests: the target counts when the line from the blast to its chest or its feet is free
  blast(x, y, o, time) {
    const s = this.s, R = o.radius ?? 140, hit = [];
    const reach = (b, cx, cy) => {
      const nx = Math.max(b.left, Math.min(x, b.right)), ny = Math.max(b.top, Math.min(y, b.bottom)), d = Math.hypot(nx - x, ny - y);
      if (d > R) return null;
      const free = [[cx, cy], [cx, b.bottom - 8], [cx, b.top + 8]].some(([tx, ty]) => this.lineFree(x, y, tx, ty));
      return free ? d : null;
    };
    if (!o.friendly) {
      const l = s.leyla;
      if (l?.alive) {
        const d = reach(l.body, l.x, l.chest);
        if (d != null) {
          const dmg = Math.max(1, Math.round((o.damage ?? 20) * (1 - 0.5 * d / R)));
          if (l.hurt(time, dmg, x)) { s.onLeylaHit?.(dmg); l.body.setVelocity(Math.sign(l.x - x || 1) * (o.knockback ?? 420), -260); }
          hit.push('leyla');
        }
      }
    } else for (const e of s.enemies) {
      if (!e.alive) continue;
      const d = reach(e.body, e.x, e.chest);
      if (d == null) continue;
      const dmg = Math.max(1, Math.round((o.damage ?? 20) * (1 - 0.5 * d / R) * (s.combat?.boost?.('ranged') ?? 1)));
      e.hit(time, dmg, o.knockback ?? 420, Math.sign(e.x - x) || 1, false, { kind: 'blast', heavy: true });
      hit.push(e.id);
    }
    this.log.push({ kind: 'blast', x: Math.round(x), y: Math.round(y), r: R, hit, at: time });
    if (this.log.length > 40) this.log.splice(0, this.log.length - 40);
    return hit;
  }
  lineFree(x0, y0, x1, y1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
    for (let i = 1; i < n; i++) if (this.solid(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
    return true;
  }

  // fire or acid on the floor: hurts what stands in it every 400 ms
  tickArea(a, time) {
    const s = this.s;
    if (time < a.next) return;
    a.next = time + 400;
    const inside = b => b.right > a.x - a.w / 2 && b.left < a.x + a.w / 2 && Math.abs(b.bottom - a.feet) < 50;
    if (!a.friendly) { const l = s.leyla; if (l?.alive && inside(l.body) && l.hurt(time, a.damage, a.x)) s.onLeylaHit?.(a.damage); }
    else for (const e of s.enemies) if (e.alive && inside(e.body)) e.hit(time, a.damage, 40, Math.sign(e.x - a.x) || 1, false, { kind: 'burn', heavy: false });
  }

  draw(time) {
    const g = this.g, m = this.marks;
    g.clear(); m.clear();
    this.used = 0;
    for (const p of this.list) {
      // landing marker: a flat ring of the blast radius on the ground, pulsing faster the closer the bang
      const left = p.item === 'granate' && p.landedAt != null ? Math.max(0, 1 - (time - p.landedAt) / p.fuse) : 1;
      const pulse = 0.5 + 0.5 * Math.sin(time / (40 + 120 * left)), col = p.friendly ? 0x3fe0d0 : 0xff4060, mk = p.mark;
      if (mk) {
        m.lineStyle(4, col, 0.35 + 0.45 * pulse).strokeEllipse(mk.x, mk.y - 4, p.radius * 2, p.radius * 0.42);
        m.fillStyle(col, 0.12 + 0.12 * pulse).fillEllipse(mk.x, mk.y - 4, p.radius * 2 * (1 - left * 0.6), p.radius * 0.42 * (1 - left * 0.6));
        m.fillStyle(col, 0.9).fillCircle(mk.x, mk.y - 4, 5);
      }
      // the thing itself: #176 the painted grenade (Leyla › Granate › Flug-Bild), turned by code; else the shape from code
      if (this.picture(p, time)) continue;
      const c = Math.cos(p.rot), sn = Math.sin(p.rot), w = 11, h = 16;
      g.fillStyle(0x0d0a12, 1).fillCircle(p.x, p.y, 11);
      g.fillStyle(COLORS[p.item] || COLORS.granate, 1).fillPoints([[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => ({ x: p.x + x * c * 0.7 - y * sn * 0.7, y: p.y + x * sn * 0.7 + y * c * 0.7 })), true);
      if (p.item === 'molotow') { g.fillStyle(0xffd27a, 0.7 + 0.3 * Math.sin(time / 40)).fillCircle(p.x - sn * 12, p.y - c * 12, 5); }
      if (p.item === 'granate' && p.landedAt != null && Math.floor(time / (60 + 200 * left)) % 2) g.fillStyle(0xff4060, 1).fillCircle(p.x, p.y - 10, 4);
    }
    for (const a of this.areas) {
      const [c1, c2] = AREA_COLORS[a.item] || AREA_COLORS.molotow, fade = Math.min(1, (a.until - time) / 500), n = Math.max(4, Math.round(a.w / 26));
      m.fillStyle(c1, 0.22 * fade).fillEllipse(a.x, a.feet - 3, a.w, 22);
      for (let i = 0; i < n; i++) {
        const x = a.x - a.w / 2 + (i + 0.5) * a.w / n, f = Math.sin(time / 70 + i * 2.1), hh = (a.item === 'saeure' ? 16 : 34 + 16 * f) * fade;
        if (a.item === 'saeure') g.fillStyle(c2, 0.6 * fade).fillCircle(x, a.feet - 6 - Math.abs(f) * 10, 4 + 3 * Math.abs(f));
        else { g.fillStyle(c1, 0.75 * fade).fillTriangle(x - 11, a.feet, x + 11, a.feet, x + f * 4, a.feet - hh); g.fillStyle(c2, 0.8 * fade).fillTriangle(x - 5, a.feet, x + 5, a.feet, x + f * 3, a.feet - hh * 0.55); }
      }
      if (a.item !== 'saeure' && Math.random() < 0.3) this.s.fx.light?.(a.x, a.feet - 30, { radius: a.w * 0.9, color: 0xff8a2a, alpha: 0.35 * fade, life: 120 });
    }
    for (const r of this.rings) {
      const k = (time - r.at) / r.life;
      if (r.ball) this.fireball(r, k);
      g.lineStyle(8 * (1 - k) + 2, 0xffd27a, 0.8 * (1 - k)).strokeCircle(r.x, r.y, r.r * (0.3 + 0.7 * k));
    }
    for (let i = this.used; i < (this.imgs?.length || 0); i++) this.imgs[i].setVisible(false);
  }

  // #176 the painted pictures: a pool of images, hidden each frame and shown again for what flies
  img(key, i) {
    this.imgs ??= [];
    if (this.imgs[i] && !this.imgs[i].scene) this.imgs[i] = null;   // #190 ① never reuse a destroyed picture
    const im = this.imgs[i] ??= this.s.add.image(0, 0, key).setDepth(14);
    return im.setTexture(key).setVisible(true).setAlpha(1);
  }
  picture(p, time) {
    const s = this.s, key = p.item === 'granate' && s.data_?.leyla?.grenade?.sprite;
    if (!key || !s.textures.exists(key)) return false;
    const A = s.data_.assets?.[key] || {}, im = this.img(key, this.used++), w = im.frame.width, h = im.frame.height;
    im.setOrigin((A.origin?.[0] ?? w / 2) / w, (A.origin?.[1] ?? h / 2) / h).setScale((A.height || 34) / h).setPosition(p.x, p.y - 4).setRotation(p.rot);
    // a red blink at the lever before the bang
    const left = p.landedAt != null ? Math.max(0, 1 - (time - p.landedAt) / p.fuse) : 1;
    if (p.landedAt != null && Math.floor(time / (60 + 200 * left)) % 2) this.g.fillStyle(0xff4060, 1).fillCircle(p.x + Math.sin(p.rot) * 14, p.y - 4 - Math.cos(p.rot) * 14, 4);
    return true;
  }
  fireball(r, k) {
    const s = this.s, key = s.data_?.leyla?.grenade?.blastLook;
    if (!key || !s.textures.exists(key) || k > 1) return;
    const im = this.img(key, this.used++), sc = r.r * 1.5 / Math.max(1, im.frame.width) * (0.45 + 0.75 * Math.sqrt(k));
    im.setOrigin(0.5).setPosition(r.x, r.y - r.r * 0.08 * k).setScale(sc).setRotation(r.x % 7).setAlpha(Math.max(0, 1 - k * k)).setDepth(14.1);
  }

  clear() { this.list = []; this.areas = []; this.rings = []; this.g.clear(); this.marks.clear(); for (const im of this.imgs || []) im.setVisible(false); }
  state() {
    const r = n => Math.round(n);
    return { flying: this.list.map(p => ({ item: p.item, x: r(p.x), y: r(p.y), landed: p.landedAt != null, friendly: !!p.friendly, mark: p.mark && { x: r(p.mark.x), y: r(p.mark.y) } })),
      areas: this.areas.map(a => ({ item: a.item, x: r(a.x), feet: r(a.feet), w: r(a.w) })), log: this.log.slice(-12) };
  }
}

// a short bang from code (noise burst through a low-pass), only where Web Audio runs
function boom(s, radius) {
  try {
    const ctx = s.sound?.context;
    if (!ctx || s.sound.mute || ctx.state !== 'running') return;
    const len = Math.floor(ctx.sampleRate * 0.6), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), v = ctx.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = 600 + radius * 2; v.gain.value = 0.55 * (s.sound.volume ?? 1);
    src.connect(f).connect(v).connect(s.sound.destination || ctx.destination); src.start();
  } catch { /* no audio */ }
}

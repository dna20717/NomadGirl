// Throwing knives (#176, Daniel 22.11.2026: „Bau parallel zur Granate als Alternative Wurfmesser ein“): the second throw skill.
// Leyla has both, one is active (Z, controller: hold the grenade button); T throws the active one. The throw pose, the painted
// throw over walking, running and jumping (#161) and the Wende-Wurf (#164) are the grenade's (leyla_grenade.js), only faster;
// this file owns the knives: charges (one by one), the straight fast flight with a little gravity, spinning, a single hit
// (head = Kopftreffer ×2, crits from implants), sticking in walls, chests and doors, picking them up again, no noise.
// Values: Leyla › Wurfmesser. Pictures: Leyla › Wurfmesser › Flug / Steckt (PixelLab), without them a knife from code.
import { damageSirens } from './traits/alarm.js';

export class LeylaKnives {
  constructor(leyla) { this.l = leyla; this.charges = null; this.refillAt = null; this.list = []; this.stuck = []; this.log = []; this.thrown = 0; this.picked = 0; }
  get c() {
    const K = this.l.d.knives || {};
    return { enabled: K.enabled !== false, charges: Math.max(1, K.charges ?? 4), cooldown: (K.cooldown ?? 6) * 1000, refill: K.refill || 'each',
      speed: K.speed ?? 1900, gravity: K.gravity ?? 320, damage: K.damage ?? 16, knockback: K.knockback ?? 90, head: (K.headshot ?? 200) / 100,
      headZone: (K.headZone ?? 15) / 100, spin: (K.spin ?? 1440) * Math.PI / 180, armSpeed: Math.max(0.2, (K.armSpeed ?? 180) / 100), life: K.life ?? 1400,
      stick: (K.stick ?? 8) * 1000, pickup: K.pickup !== false, fan: Math.max(1, K.fan ?? 3), spread: K.spread ?? 7, length: K.length ?? 60,
      look: K.look || '', stuckLook: K.stuckLook || '', icon: K.icon || '', sirens: K.sirens !== false, hand: K.hand || [44, 110] };
  }
  now() { return this.l.scene.now ?? this.l.scene.time.now; }
  ready() { return (this.charges ?? this.c.charges) > 0; }

  // the clock (from leyla_grenade.update every frame): one charge after another, or all together
  tick(time) {
    const c = this.c, s = this.l.scene, now = this.now();
    if (this.charges == null) this.charges = c.charges;
    if (this.refillAt != null && now >= this.refillAt) {
      if (c.refill === 'all') { this.charges = c.charges; this.refillAt = null; }
      else { this.charges = Math.min(c.charges, this.charges + 1); this.refillAt = this.charges < c.charges ? now + c.cooldown : null; }
    }
    this.pickups(time);
  }
  spendCharge() {
    const c = this.c, now = this.now();
    if (this.refillAt == null) this.refillAt = now + c.cooldown;
    this.charges = Math.max(0, (this.charges ?? c.charges) - 1);
  }
  giveBack() {
    const c = this.c;
    this.charges = Math.min(c.charges, (this.charges ?? c.charges) + 1);
    if (this.charges >= c.charges) this.refillAt = null;
  }

  // from the grenade's release(): P = the pose (P.turn = Wende-Wurf), h = the hand
  release(time, P, h, input) {
    const c = this.c, l = this.l, s = l.scene, f = l.facing, k = l.size.h / 168;
    h = { x: l.x + f * c.hand[0] * k, y: l.feet - c.hand[1] * k };   // chest high, so it meets a standing enemy (Leyla › Wurfmesser › Abwurf)
    let angles = [0];
    if (P.turn) {   // #164 flat backwards, a fan of knives (⚠️ one charge for the whole fan)
      const a = Math.atan2(-P.turn.vy, Math.abs(P.turn.vx)) * 180 / Math.PI * 0.4;
      angles = Array.from({ length: c.fan }, (_, i) => a + (i - (c.fan - 1) / 2) * c.spread);
    } else if (P.up || input?.up?.down) angles = [22];
    else if ((P.down || input?.down?.down) && !l.body.blocked.down) angles = [-24];
    for (const deg of angles) {
      const r = deg * Math.PI / 180, sp = c.speed * (P.turn ? 1.08 : 1);
      this.spawn({ x: h.x, y: h.y, vx: f * Math.cos(r) * sp + (P.turn ? 0 : l.body.velocity.x * 0.25), vy: -Math.sin(r) * sp, time, turn: !!P.turn });
    }
    this.spendCharge();
    this.thrown += angles.length;
    s.sfx?.('melee_whoosh', { x: l.x });   // a whisper, no noise for the enemies (lautlos)
    if (P.turn) l.turnRelease?.(time, h);
  }

  spawn(o) {
    const s = this.l.scene, c = this.c;
    const k = { ...o, rot: Math.atan2(o.vy, o.vx), dead: false, at: o.time, gravity: c.gravity, dir: Math.sign(o.vx) || this.l.facing };
    this.list.push(k);
    this.log.push({ kind: 'throw', at: o.time, x: Math.round(o.x), y: Math.round(o.y), vx: Math.round(o.vx), vy: Math.round(o.vy), turn: !!o.turn });
    if (this.log.length > 30) this.log.splice(0, this.log.length - 30);
    return k;
  }

  // flight: straight and fast, in small steps (thin walls, low frame rates); first contact counts
  update(time, dt) {
    const s = this.l.scene, k = Math.min(0.05, dt / 1000), c = this.c;
    for (const p of this.list) {
      if (p.dead) continue;
      if (time - p.at > c.life) { this.drop(p, time); continue; }
      const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * k / 10));
      for (let i = 0; i < n && !p.dead; i++) this.move(p, k / n, time);
      p.rot += p.dir * c.spin * k;
    }
    this.list = this.list.filter(p => !p.dead);
    this.stuck = this.stuck.filter(t => !t.gone && time < t.until);
    this.drawAll(time);
  }

  move(p, k, time) {
    const s = this.l.scene, c = this.c;
    p.vy += p.gravity * k;
    const nx = p.x + p.vx * k, ny = p.y + p.vy * k;
    // the tip: a little ahead of the middle
    const sp = Math.hypot(p.vx, p.vy) || 1, tx = nx + p.vx / sp * c.length * 0.4, ty = ny + p.vy / sp * c.length * 0.4;
    // enemies first (a body in front of the wall)
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const b = e.body;
      if (tx > b.left - 4 && tx < b.right + 4 && ty > b.top && ty < b.bottom) {
        if (e.dodging?.(p)) continue;
        return this.hitEnemy(p, e, ty, time);
      }
    }
    if (c.sirens && damageSirens(s, [{ x0: tx - 4, x1: tx + 4, y0: ty - 4, y1: ty + 4 }], this.damage(), time)) { p.x = nx; p.y = ny; return this.drop(p, time, 'siren'); }   // only a hit on the box
    const wall = s.pointSolid(tx, ty) ? 'wall' : (s.covers?.() || []).some(q => tx > q.x - q.w / 2 && tx < q.x + q.w / 2 && ty > q.top && ty < q.feet) ? 'cover' : null;
    if (wall) return this.stick(p, wall, time);
    p.x = nx; p.y = ny;
  }

  damage() { return Math.max(1, Math.round(this.c.damage * (this.l.scene.combat?.boost?.('ranged') ?? 1))); }

  hitEnemy(p, e, y, time) {
    const s = this.l.scene, c = this.c;
    const head = y < e.body.top + (e.body.bottom - e.body.top) * c.headZone;
    const crit = head || Math.random() * 100 < (s.combat?.critBonus?.() || 0);
    const dmg = Math.round(this.damage() * (head ? c.head : crit ? 2 : 1));
    const r = e.hit(time, dmg, c.knockback, p.dir, crit, { kind: 'knife', heavy: false, head });
    if (head && r !== 'blocked') s.fx.text(e.x, e.body.top - 54, 'Kopftreffer', { color: '#ffd27a', size: 34, rise: 30 });
    this.l.fightTrigger?.(time);
    p.x = e.x - p.dir * 6; p.y = y;
    this.log.push({ kind: r === 'blocked' ? 'blocked' : 'hit', at: time, enemy: e.id, damage: dmg, head, crit });
    this.drop(p, time, r === 'blocked' ? 'blocked' : 'hit');
  }

  // into the wall, the chest, the door: the blade sinks in along its flight line and stays a while
  stick(p, what, time) {
    const s = this.l.scene, c = this.c, sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
    // (x, y) = where the blade enters: the first solid point along the flight line from the tip (a chest: right at the tip)
    let x = p.x + ux * c.length * 0.4, y = p.y + uy * c.length * 0.4;
    if (what === 'wall') { for (let d = 0; d < c.length && s.pointSolid(x, y); d += 2) { x -= ux * 2; y -= uy * 2; } for (let d = 0; d < c.length && !s.pointSolid(x + ux * 2, y + uy * 2); d += 2) { x += ux * 2; y += uy * 2; } }
    p.dead = true;
    const t = { x, y, rot: Math.atan2(uy, ux), dir: p.dir, at: time, until: time + c.stick, what, gone: false };
    this.stuck.push(t);
    s.fx.sparks(x - ux * 4, y - uy * 4, what === 'cover' ? 0xc7b08b : 0xffd27a, 4);
    s.sfx?.('melee_wall', { x });
    this.log.push({ kind: 'stuck', at: time, x: Math.round(x), y: Math.round(y), what });
    return t;
  }
  // hit a body, a shield or a siren: it falls away (gone, the charge comes back with the clock)
  drop(p, time, why = 'miss') {
    const s = this.l.scene;
    p.dead = true;
    if (why === 'miss') s.fx.sparks(p.x, p.y, 0x8b949e, 3);
    if (why === 'blocked' || why === 'siren') s.fx.sparks(p.x, p.y, 0xd8e6f0, 6);
    if (why === 'miss') this.log.push({ kind: 'miss', at: time, x: Math.round(p.x), y: Math.round(p.y) });
  }

  // a stuck knife within reach of her body: picked up, one charge back (Leyla › Wurfmesser › Aufsammeln)
  pickups(time) {
    const c = this.c, l = this.l, b = l.body;
    if (!c.pickup || !l.alive || !this.stuck.length) return;
    for (const t of this.stuck) {
      if (t.gone || time - t.at < 250) continue;
      const hx = t.x - Math.cos(t.rot) * c.length * 0.5, hy = t.y - Math.sin(t.rot) * c.length * 0.5;   // the handle
      if (hx > b.left - 40 && hx < b.right + 40 && hy > b.top - 30 && hy < b.bottom + 10) {
        t.gone = true; this.picked++;
        if ((this.charges ?? c.charges) < c.charges) this.giveBack();
        l.scene.fx.text(t.x, t.y - 30, '+1 Messer', { color: '#3fe0d0', size: 30, rise: 30 });
        l.scene.sfx?.('item_pick', { x: t.x });
        this.log.push({ kind: 'pickup', at: time, x: Math.round(t.x), y: Math.round(t.y) });
      }
    }
  }

  // ---------- look ----------
  sprite(key) {
    const s = this.l.scene;
    return key && s.textures.exists(key) ? key : null;
  }
  drawAll(time) {
    const s = this.l.scene, c = this.c;
    this.g ??= s.add.graphics().setDepth(14);
    this.g.clear();
    const fly = this.sprite(c.look), stuckKey = this.sprite(c.stuckLook) || fly;
    this.pool ??= [];
    let used = 0;
    // both pictures at the same pixel size: the flying knife's picture is Länge im Spiel wide
    const sc = fly ? c.length / s.textures.get(fly).get().width : 1;
    const put = (key, x, y, rot, flip, alpha = 1) => {
      const A = s.data_.assets?.[key];
      const img = this.pool[used] ??= s.add.image(0, 0, key).setDepth(14);
      used++;
      img.setTexture(key);
      const w = img.frame.width, h = img.frame.height;
      img.setVisible(true).setPosition(x, y).setScale(sc).setRotation(rot).setFlipY(flip).setAlpha(alpha);
      if (A?.origin) img.setOrigin(A.origin[0] / w, A.origin[1] / h); else img.setOrigin(0.5);
    };
    for (const p of this.list) {
      if (fly) put(fly, p.x, p.y, p.rot, false);
      else this.codeKnife(p.x, p.y, p.rot, 1);
      // a short streak behind it
      const sp = Math.hypot(p.vx, p.vy) || 1;
      this.g.lineStyle(3, 0xc8fff4, 0.35).lineBetween(p.x, p.y, p.x - p.vx / sp * 46, p.y - p.vy / sp * 46);
    }
    for (const t of this.stuck) {
      const a = Math.min(1, (t.until - time) / 600);
      if (stuckKey) put(stuckKey, t.x, t.y, t.rot, Math.cos(t.rot) < 0, a);   // thrown to the left: the edge stays down
      else this.codeKnife(t.x - Math.cos(t.rot) * c.length * 0.3, t.y - Math.sin(t.rot) * c.length * 0.3, t.rot, a);
      if (c.pickup && this.l.alive && Math.abs(this.l.x - t.x) < 260) this.g.fillStyle(0x3fe0d0, 0.35 + 0.3 * Math.sin(time / 120)).fillCircle(t.x - Math.cos(t.rot) * c.length * 0.62, t.y - Math.sin(t.rot) * c.length * 0.62, 4);
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i].setVisible(false);
  }
  // fallback without pictures: a blade from code
  codeKnife(x, y, rot, a) {
    const L = this.c.length, cx = Math.cos(rot), sn = Math.sin(rot), g = this.g;
    const P = (u, v) => ({ x: x + cx * u - sn * v, y: y + sn * u + cx * v });
    g.fillStyle(0x060608, a).fillPoints([P(-L * 0.5, -5), P(0, -6), P(L * 0.5, 0), P(0, 6), P(-L * 0.5, 5)], true);
    g.fillStyle(0xdae0ea, a).fillPoints([P(-L * 0.05, -3), P(L * 0.46, 0), P(-L * 0.05, 3)], true);
    g.fillStyle(0x333941, a).fillRect(P(-L * 0.45, 0).x - 4, P(-L * 0.45, 0).y - 4, 8, 8);
  }
  clear() { this.list = []; this.stuck = []; this.g?.clear(); for (const i of this.pool || []) i.setVisible(false); }

  state() {
    const c = this.c, r = n => Math.round(n);
    return { charges: this.charges ?? c.charges, max: c.charges, refillIn: this.refillAt != null ? Math.round(this.refillAt - this.now()) : 0, thrown: this.thrown, picked: this.picked,
      flying: this.list.map(p => ({ x: r(p.x), y: r(p.y), vx: r(p.vx), vy: r(p.vy), rot: +p.rot.toFixed(2) })), stuck: this.stuck.map(t => ({ x: r(t.x), y: r(t.y), what: t.what, rot: +t.rot.toFixed(2) })),
      log: this.log.slice(-12) };
  }
}

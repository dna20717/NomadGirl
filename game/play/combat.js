// Combat: Leyla's melee and ranged attacks, enemy shots, projectiles, hitstop.
// Weapon values from the game data (area "Waffen"): damage, cooldown, range, knockback, critChance, ammo, projectileSpeed.

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.shots = [];
  }

  boost(kind) { const m = this.scene.mods || {}; return Math.max(0, 1 + ((m.damage || 0) + (kind ? m[kind] || 0 : 0)) / 100); }   // damage buffs + implants (Nahkampf/Fernkampf %)
  critBonus() { return this.scene.mods?.crit || 0; }   // Krit-Chance from implants

  // ---------- walls stop everything (Daniel, 12.11.2026: „nicht durch Objekte schießen oder schlagen, auch wenn der Sprite hineinreicht“) ----------
  // how far from (x, y) in direction dir (±1) until the first solid tile (closed doors and brittle walls count), at most max px
  freeRun(x, y, dir, max) {
    const s = this.scene;
    if (s.pointSolid(x, y)) return 0;
    for (let d = 0; d < max;) {
      const n = Math.min(max, d + 8);
      if (s.pointSolid(x + dir * n, y)) { for (let k = d + 1; k <= n; k++) if (s.pointSolid(x + dir * k, y)) return k - 1; return n; }
      d = n;
    }
    return max;
  }
  // first solid point on the line (x0, y0) → (x1, y1), or null when the line is free
  blockedAt(x0, y0, x1, y1) {
    const s = this.scene, n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (s.pointSolid(x, y)) return { x, y }; }
    return null;
  }
  // the hit zone of a strike: rows from the attacker's middle (ox) forward, each cut at the first wall at its height
  zone(ox, dir, reach, y0, y1, rows = 6) {
    const out = [], n = Math.max(2, rows), band = (y1 - y0) / (n - 1) / 2 + 1;
    for (let i = 0; i < n; i++) {
      const y = y0 + (y1 - y0) * i / (n - 1), free = this.freeRun(ox, y, dir, reach);
      out.push({ y, y0: y - band, y1: y + band, x0: dir > 0 ? ox : ox - free, x1: dir > 0 ? ox + free : ox, wall: free < reach ? ox + dir * (free + 4) : null });
    }
    return out;
  }
  inZone(z, b, pad = 0) { return z.some(r => b.bottom > r.y0 && b.top < r.y1 && b.right + pad > r.x0 && b.left - pad < r.x1); }
  // Leyla's melee zone: from her middle to her front edge + reach, feet to head
  meleeZone(leyla, reach) {
    const b = leyla.body, H = leyla.height;
    return this.zone(b.center.x, leyla.facing, b.width / 2 + reach, b.bottom - H, b.bottom - H * 0.1);
  }
  // the stretched-out gun would poke into a wall: no shot from there, the gun stays at the chest (Leyla › Waffe ziehen)
  muzzleBlocked(leyla) {
    const { x, y } = this.muzzleOf(leyla, true);
    return this.blockedAt(leyla.x, y, x + leyla.facing * 8, y);
  }
  // power (heavy hit): { damage ×, range +px, knockback +, heavy }
  melee(leyla, time, power = null) {
    const s = this.scene, w = s.weapon('melee');
    if (!w) return;
    leyla.meleeReady = Math.max(leyla.meleeReady || 0, time + (w.cooldown ?? 400));
    leyla.attackPose = time + 160;
    const reach = (w.range ?? 70) + 40 + (power?.range || 0), f = leyla.facing, b = leyla.body, H = leyla.height;
    if (!leyla.attack || leyla.attack.trail) s.fx.slash(leyla.x + f * 24, b.bottom - H * 0.58, f, w.range ?? 70, leyla.attack?.trail ? 0xbff8ff : undefined, !!leyla.attack?.trailUp);   // the attack animations bring their own slash
    const z = this.meleeZone(leyla, reach);
    let hits = 0, blocked = 0;
    for (const e of s.enemies) {
      if (!e.alive || !this.inZone(z, e.body)) continue;
      const crit = Math.random() * 100 < (w.critChance ?? 0) + this.critBonus();
      const r = e.hit(time, Math.round((w.damage ?? 10) * (power?.damage || 1) * this.boost('melee') * (crit ? 2 : 1)), (w.knockback ?? 200) + (power?.knockback || 0), f, crit, { kind: 'melee', heavy: !!power?.heavy });
      if (r === 'blocked') blocked++; else hits++;
    }
    // brittle walls in POI levels: only where the strike really reaches the wall
    const walls = z.filter(r => r.wall != null);
    for (const r of walls) s.level?.meleeHit(r.wall - 4, r.wall + 4, r.y - 4, r.y + 4);
    if (walls.length && !hits && !blocked) s.fx.sparks(walls[Math.floor(walls.length / 2)].wall - f * 6, walls[Math.floor(walls.length / 2)].y, 0xb8b0a0, 4);
    if (blocked && !hits) { leyla.body.setVelocityX(-f * 260); s.fx.text(leyla.x + f * 80, b.bottom - H - 10, 'Block', { color: '#8fb3c9', size: 38, rise: 26 }); }
    if (hits || blocked || walls.length) s.noise?.(leyla.x, leyla.chest, s.shootRules().noiseMelee ?? 380);
    if (hits) { s.hitstop(time, power?.heavy ? 110 : 55); s.cam.shake(power?.heavy ? 160 : 70, power?.heavy ? 0.008 : 0.003); }
  }

  // the fifth hit of a perfect combo: a shot pressed right on the enemy (Leyla › Kombo › Schuss); costs one round from the magazine
  pointBlank(leyla, time, o) {
    const s = this.scene, w = s.weapon('ranged');
    if (!w || leyla.mag <= 0) return;
    leyla.mag--;
    const f = leyla.facing, b = leyla.body, H = leyla.height, x = leyla.x + f * H * 0.4, y = b.bottom - H * 0.79;   // muzzle of the stretched shooting pose
    s.fx.flash(x, y, 0xfff2b0, 22);
    s.fx.light?.(x, y, { radius: 90, color: 0xfff6d8, alpha: 0.8, life: 80 });
    s.fx.light?.(x, y, { radius: 240, color: 0xffc870, alpha: 0.45, life: 120 });
    s.fx.impact?.(x + f * 30, y, f, true, 1.3);
    const snd = w.sound && s.cache.audio.exists(w.sound) && s.data_.assets?.[w.sound];
    if (snd) s.sound.play(w.sound, { volume: Math.min(1, (snd.volume ?? 100) / 100 * 1.25), detune: -260 });
    const z = this.meleeZone(leyla, o.range);
    let hits = 0;
    for (const e of s.enemies) if (e.alive && this.inZone(z, e.body) && e.hit(time, Math.round(o.damage * this.boost('melee')), o.knockback, f, true, { kind: 'blank', heavy: true }) !== 'blocked') hits++;
    s.noise?.(x, y, s.shootRules().noiseShot ?? 900);
    s.hitstop(time, hits ? 140 : 60); s.cam.shake(180, hits ? 0.01 : 0.004);
    leyla.fightTrigger?.(time);
  }

  shoot(leyla, time) {
    const s = this.scene, w = s.weapon('ranged');
    if (!w) return;
    leyla.rangedReady = time + (w.cooldown ?? 300);
    if (leyla.mag <= 0) { s.fx.text(leyla.x, leyla.feet - leyla.height - 20, 'leer', { color: '#8b949e', size: 36, rise: 30 }); return; }
    leyla.mag--;
    leyla.attackPose = time + 120;
    // from the chest-high ready pose the arms first stretch out (Leyla › Waffe ziehen › Ausstrecken), the shot itself leaves right away
    const lowered = leyla.armed === 'on' && time > (leyla.aimUntil ?? -1e9) && Math.abs(leyla.body.velocity.x) <= 20;
    leyla.shotAt = time; leyla.extendAt = lowered ? time : null;
    // with the gun drawn the shot leaves the muzzle (Leyla › Waffe ziehen › Mündung), the picture brings its own muzzle flash
    const A = leyla.armed === 'on', AR = leyla.d.armed || {}, R = s.shootRules(), cells = s.cellsLike(), f = leyla.facing, { x, y } = this.muzzleOf(leyla);
    s.noise?.(leyla.x, y, R.noiseShot ?? 900);
    // the muzzle would be inside or behind a wall: the nail hits the wall right there (sparks), the gun stays at the chest
    const wall = this.blockedAt(leyla.x, y, x, y);
    if (wall) {
      leyla.extendAt = null; leyla.wallShotAt = time;
      s.fx.sparks(wall.x - f * 6, wall.y, 0xffd27a, 9);
      s.fx.light?.(wall.x - f * 10, wall.y, { radius: 120, color: 0xffc870, alpha: 0.7, life: 80 });
      const snd0 = w.sound && s.cache.audio.exists(w.sound) && s.data_.assets?.[w.sound];
      if (snd0) s.sound.play(w.sound, { volume: (snd0.volume ?? 100) / 100 * 0.9, detune: -120 });
      return;
    }
    const speed = (cells && R.bulletSpeed) || w.projectileSpeed || 1600;
    // Cells-like: the nearest enemy in front (cone, range, free line) gets the shot, slanted; otherwise straight ahead
    const tgt = cells ? this.findTarget(leyla, { x, y }) : null;
    let dx = f, dy = 0;
    if (tgt) { const tx = tgt.body.center.x - x, ty = tgt.body.center.y - y, n = Math.hypot(tx, ty) || 1; dx = tx / n; dy = ty / n; }
    if (!A) s.fx.flash(x + f * 10, y, 0xfff2b0, 18);
    else if (w.muzzleFlash) {   // the arms come up from the chest first (extendTime): the flash waits for the aim
      const wait = leyla.extendAt === time ? (AR.extendTime ?? 100) : 0, k = leyla.size.h / 168;
      if (wait) s.time.delayedCall(wait, () => { const m = this.muzzleOf(leyla); s.fx.muzzle?.(m.x, m.y, leyla.facing, k); }); else s.fx.muzzle?.(x, y, f, k);
    }
    // muzzle flash light (Leyla › Waffe ziehen › Mündungslicht): bright core + a wider warm glow over the surroundings
    if (AR.flashLight !== false) {
      const col = parseInt(String(AR.flashColor || '#ffc870').slice(1), 16), r = AR.flashRadius ?? 260, life = AR.flashTime ?? 90;
      s.fx.light(x + f * 12, y, { radius: r * 0.35, color: 0xfff6d8, alpha: 1, life: life * 0.8 });
      s.fx.light(x + f * 12, y, { radius: r, color: col, alpha: 0.75, life });
    }
    const snd = w.sound && s.cache.audio.exists(w.sound) && s.data_.assets?.[w.sound];
    if (snd) s.sound.play(w.sound, { volume: (snd.volume ?? 100) / 100 * (0.92 + Math.random() * 0.16), detune: (Math.random() - 0.5) * 120 });
    this.spawn({ key: 'nail', x, y, vx: dx * speed, vy: dy * speed, life: Math.max(w.range ?? 600, tgt ? (R.range ?? 9) * s.T : 0) / speed * 1000, friendly: true, damage: (w.damage ?? 5) * this.boost('ranged'), knockback: w.knockback ?? 80, crit: (w.critChance ?? 0) + this.critBonus(), time });
    if (!leyla.body.blocked.down) leyla.body.setVelocityX(leyla.body.velocity.x - f * 40);
  }

  // where the shot leaves: the muzzle with the gun drawn (Leyla › Waffe ziehen › Mündung / im Rennen), otherwise in front of the chest
  muzzleOf(leyla, stretched = false) {
    const A = stretched || leyla.armed === 'on', AR = leyla.d.armed || {}, run = A && leyla.gunRunning(leyla.body.velocity), k = leyla.size.h / 168;
    const M = (run && AR.muzzleRun) || AR.muzzle || [100, 146], f = leyla.facing;
    return { x: leyla.x + f * (A ? M[0] * k : leyla.size.w * 0.8), y: leyla.feet - (A ? M[1] * k : leyla.height * 0.62) };
  }
  // Spiel › Kampf: Kegel (± degrees around the facing), Reichweite in tiles, only with a free line of sight
  findTarget(leyla, at = this.muzzleOf(leyla)) {
    const { x, y } = at, s = this.scene, R = s.shootRules(), f = leyla.facing, cone = (R.cone ?? 35) * Math.PI / 180, range = (R.range ?? 9) * s.T;
    let best = null, bd = Infinity;
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const tx = e.body.center.x - x, ty = e.body.center.y - y, d = Math.hypot(tx, ty);
      if (tx * f <= 0 || d > range || Math.atan2(Math.abs(ty), Math.abs(tx)) > cone || d >= bd) continue;
      if (!s.lineFree(x, y, e.body.center.x, e.body.center.y)) continue;
      best = e; bd = d;
    }
    return best;
  }
  // target marker (Spiel › Kampf › Ziel-Marker): small corner brackets around the enemy the next shot would hit
  marker(time) {
    const s = this.scene, l = s.leyla, R = s.shootRules();
    const on = s.cellsLike() && R.marker !== false && l?.alive && l.armed === 'on';
    this.target = on ? this.findTarget(l) : null;
    this.mark ??= s.add.graphics().setDepth(15);
    this.mark.clear();
    if (!this.target) return;
    const b = this.target.body, pad = 10 + 3 * Math.sin(time / 90), x0 = b.left - pad, x1 = b.right + pad, y0 = b.top - pad, y1 = b.bottom + pad, L = 18;
    this.mark.lineStyle(4, parseInt(String(R.markerColor || '#ff3fa4').slice(1), 16), 0.9);
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      this.mark.beginPath(); this.mark.moveTo(cx, cy + sy * L); this.mark.lineTo(cx, cy); this.mark.lineTo(cx + sx * L, cy); this.mark.strokePath();
    }
  }

  enemyShot(enemy, from, dir) {
    const speed = enemy.a.projectileSpeed ?? 900;
    this.scene.fx.flash(from.x, from.y, 0xffb070, 20);
    const wall = this.blockedAt(enemy.x, from.y, from.x, from.y);
    if (wall) { this.scene.fx.sparks(wall.x, wall.y, 0xffd27a, 6); return; }
    this.spawn({ key: 'nail_enemy', x: from.x, y: from.y, vx: dir.x * speed, vy: dir.y * speed, life: 2400, friendly: false, damage: enemy.d.damage ?? 8, knockback: 0, time: this.scene.time.now, from: enemy });
  }

  spawn(o) {
    const img = this.scene.add.image(o.x, o.y, o.key).setDepth(9).setRotation(Math.atan2(o.vy, o.vx)).setScale(1.4);
    this.shots.push({ ...o, img, end: o.time + o.life });
  }

  update(time, dt) {
    const s = this.scene, k = dt / 1000;
    this.marker(time);
    const covers = s.covers?.() || [];
    for (const p of this.shots) {
      if (p.dead) continue;
      if (time >= p.end) { p.dead = true; s.fx.sparks(p.x, p.y, 0x8b949e, 3); continue; }
      // in small steps, so fast nails never jump over a thin wall or an enemy (low frame rates included)
      const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * k / 12));
      for (let i = 0; i < n && !p.dead; i++) {
        p.x += p.vx * k / n; p.y += p.vy * k / n;
        if (s.pointSolid(p.x, p.y)) { p.dead = true; s.fx.sparks(p.x - Math.sign(p.vx) * 6, p.y, 0xffd27a, 6); break; }
        if (covers.some(c => p.x > c.x - c.w / 2 && p.x < c.x + c.w / 2 && p.y > c.top && p.y < c.feet)) { p.dead = true; s.fx.sparks(p.x - Math.sign(p.vx) * 6, p.y, 0xc7b08b, 6); break; }   // a chest is cover (#014)
        if (p.friendly) {
          for (const e of s.enemies) {
            if (!e.alive) continue;
            const b = e.body;
            if (p.x > b.left - 6 && p.x < b.right + 6 && p.y > b.top && p.y < b.bottom) {
              if (e.dodging?.(p)) continue;   // jumped out of the way
              const crit = Math.random() * 100 < p.crit;
              e.hit(time, Math.round(p.damage * (crit ? 2 : 1)), p.knockback, Math.sign(p.vx) || 1, crit, { kind: 'shot', heavy: false });
              s.leyla?.fightTrigger(time);
              p.dead = true; s.fx.sparks(p.x, p.y, 0xffffff, 5);
              break;
            }
          }
        } else {
          const l = s.leyla, b = l.body;
          if (l.alive && p.x > b.left && p.x < b.right && p.y > b.top && p.y < b.bottom) {
            if (l.hurt(time, p.damage, p.x - p.vx)) { s.onLeylaHit(p.damage); p.dead = true; s.fx.sparks(p.x, p.y, 0xff4060, 8); }
          }
        }
      }
      p.img?.setPosition(p.x, p.y);
    }
    for (const p of this.shots) if (p.dead && p.img) { p.img.destroy(); p.img = null; }
    this.shots = this.shots.filter(p => !p.dead);
  }

  clear() { for (const p of this.shots) p.img?.destroy(); this.shots = []; this.mark?.clear(); this.target = null; }
}

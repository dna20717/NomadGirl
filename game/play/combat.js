// Combat: Leyla's melee and ranged attacks, enemy shots, projectiles, hitstop.
// Weapon values from the game data (area "Waffen"): damage, cooldown, range, knockback, critChance, ammo, projectileSpeed.

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.shots = [];
  }

  boost() { return 1 + (this.scene.mods?.damage || 0) / 100; }   // damage buffs from the camp
  // power (heavy hit): { damage ×, range +px, knockback +, heavy }
  melee(leyla, time, power = null) {
    const s = this.scene, w = s.weapon('melee');
    if (!w) return;
    leyla.meleeReady = Math.max(leyla.meleeReady || 0, time + (w.cooldown ?? 400));
    leyla.attackPose = time + 160;
    const reach = (w.range ?? 70) + 40 + (power?.range || 0), f = leyla.facing, b = leyla.body;
    const x0 = f > 0 ? b.center.x : b.left - reach, x1 = f > 0 ? b.right + reach : b.center.x;
    const H = leyla.height, y0 = b.bottom - H, y1 = b.bottom - H * 0.1;
    if (!leyla.attack || leyla.attack.trail) s.fx.slash(leyla.x + f * 24, b.bottom - H * 0.58, f, w.range ?? 70, leyla.attack?.trail ? 0xbff8ff : undefined, !!leyla.attack?.trailUp);   // the attack animations bring their own slash
    let hits = 0;
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const eb = e.body;
      if (eb.right > x0 && eb.left < x1 && eb.bottom > y0 && eb.top < y1) {
        const crit = Math.random() * 100 < (w.critChance ?? 0);
        e.hit(time, Math.round((w.damage ?? 10) * (power?.damage || 1) * this.boost() * (crit ? 2 : 1)), (w.knockback ?? 200) + (power?.knockback || 0), f, crit);
        hits++;
      }
    }
    s.level?.meleeHit(x0, x1, y0, y1);   // brittle walls in POI levels
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
    const x0 = f > 0 ? b.center.x : b.left - o.range, x1 = f > 0 ? b.right + o.range : b.center.x, y0 = b.bottom - H, y1 = b.bottom - H * 0.1;
    let hits = 0;
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const eb = e.body;
      if (eb.right > x0 && eb.left < x1 && eb.bottom > y0 && eb.top < y1) { e.hit(time, Math.round(o.damage * this.boost()), o.knockback, f, true); hits++; }
    }
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
    const speed = (cells && R.bulletSpeed) || w.projectileSpeed || 1600;
    // Cells-like: the nearest enemy in front (cone, range, free line) gets the shot, slanted; otherwise straight ahead
    const tgt = cells ? this.findTarget(leyla, { x, y }) : null;
    let dx = f, dy = 0;
    if (tgt) { const tx = tgt.body.center.x - x, ty = tgt.body.center.y - y, n = Math.hypot(tx, ty) || 1; dx = tx / n; dy = ty / n; }
    if (!A) s.fx.flash(x + f * 10, y, 0xfff2b0, 18);
    // muzzle flash light (Leyla › Waffe ziehen › Mündungslicht): bright core + a wider warm glow over the surroundings
    if (AR.flashLight !== false) {
      const col = parseInt(String(AR.flashColor || '#ffc870').slice(1), 16), r = AR.flashRadius ?? 260, life = AR.flashTime ?? 90;
      s.fx.light(x + f * 12, y, { radius: r * 0.35, color: 0xfff6d8, alpha: 1, life: life * 0.8 });
      s.fx.light(x + f * 12, y, { radius: r, color: col, alpha: 0.75, life });
    }
    const snd = w.sound && s.cache.audio.exists(w.sound) && s.data_.assets?.[w.sound];
    if (snd) s.sound.play(w.sound, { volume: (snd.volume ?? 100) / 100 * (0.92 + Math.random() * 0.16), detune: (Math.random() - 0.5) * 120 });
    this.spawn({ key: 'nail', x, y, vx: dx * speed, vy: dy * speed, life: Math.max(w.range ?? 600, tgt ? (R.range ?? 9) * s.T : 0) / speed * 1000, friendly: true, damage: (w.damage ?? 5) * this.boost(), knockback: w.knockback ?? 80, crit: w.critChance ?? 0, time });
    if (!leyla.body.blocked.down) leyla.body.setVelocityX(leyla.body.velocity.x - f * 40);
  }

  // where the shot leaves: the muzzle with the gun drawn (Leyla › Waffe ziehen › Mündung / im Rennen), otherwise in front of the chest
  muzzleOf(leyla) {
    const A = leyla.armed === 'on', AR = leyla.d.armed || {}, run = A && leyla.gunRunning(leyla.body.velocity), k = leyla.size.h / 168;
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
    this.spawn({ key: 'nail_enemy', x: from.x, y: from.y, vx: dir.x * speed, vy: dir.y * speed, life: 2400, friendly: false, damage: enemy.d.damage ?? 8, knockback: 0, time: this.scene.time.now, from: enemy });
  }

  spawn(o) {
    const img = this.scene.add.image(o.x, o.y, o.key).setDepth(9).setRotation(Math.atan2(o.vy, o.vx)).setScale(1.4);
    this.shots.push({ ...o, img, end: o.time + o.life });
  }

  update(time, dt) {
    const s = this.scene, k = dt / 1000;
    this.marker(time);
    for (const p of this.shots) {
      if (p.dead) continue;
      p.x += p.vx * k; p.y += p.vy * k;
      p.img.setPosition(p.x, p.y);
      if (time >= p.end) { p.dead = true; s.fx.sparks(p.x, p.y, 0x8b949e, 3); continue; }
      if (s.pointSolid(p.x, p.y)) { p.dead = true; s.fx.sparks(p.x - Math.sign(p.vx) * 6, p.y, 0xffd27a, 6); continue; }
      if (p.friendly) {
        for (const e of s.enemies) {
          if (!e.alive) continue;
          const b = e.body;
          if (p.x > b.left - 6 && p.x < b.right + 6 && p.y > b.top && p.y < b.bottom) {
            const crit = Math.random() * 100 < p.crit;
            e.hit(time, Math.round(p.damage * (crit ? 2 : 1)), p.knockback, Math.sign(p.vx) || 1, crit);
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
    for (const p of this.shots) if (p.dead && p.img) { p.img.destroy(); p.img = null; }
    this.shots = this.shots.filter(p => !p.dead);
  }

  clear() { for (const p of this.shots) p.img?.destroy(); this.shots = []; this.mark?.clear(); this.target = null; }
}

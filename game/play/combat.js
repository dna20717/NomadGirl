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
    if (!leyla.attack) s.fx.slash(leyla.x + f * 24, b.bottom - H * 0.58, f, w.range ?? 70);   // the attack animations bring their own slash
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
    if (hits) { s.hitstop(time, power?.heavy ? 110 : 55); s.cam.shake(power?.heavy ? 160 : 70, power?.heavy ? 0.008 : 0.003); }
  }

  shoot(leyla, time) {
    const s = this.scene, w = s.weapon('ranged');
    if (!w) return;
    leyla.rangedReady = time + (w.cooldown ?? 300);
    if (leyla.mag <= 0) { s.fx.text(leyla.x, leyla.feet - leyla.height - 20, 'leer', { color: '#8b949e', size: 36, rise: 30 }); return; }
    leyla.mag--;
    leyla.attackPose = time + 120;
    leyla.shotAt = time;
    // with the gun drawn the shot leaves the muzzle (Leyla › Waffe ziehen › Mündung), the picture brings its own muzzle flash
    const A = leyla.armed === 'on', AR = leyla.d.armed || {}, M = AR.muzzle || [100, 146], k = leyla.size.h / 168;
    const f = leyla.facing, x = leyla.x + f * (A ? M[0] * k : leyla.size.w * 0.8), y = leyla.feet - (A ? M[1] * k : leyla.height * 0.62), speed = w.projectileSpeed ?? 1600;
    if (!A) s.fx.flash(x + f * 10, y, 0xfff2b0, 18);
    // muzzle flash light (Leyla › Waffe ziehen › Mündungslicht): bright core + a wider warm glow over the surroundings
    if (AR.flashLight !== false) {
      const col = parseInt(String(AR.flashColor || '#ffc870').slice(1), 16), r = AR.flashRadius ?? 260, life = AR.flashTime ?? 90;
      s.fx.light(x + f * 12, y, { radius: r * 0.35, color: 0xfff6d8, alpha: 1, life: life * 0.8 });
      s.fx.light(x + f * 12, y, { radius: r, color: col, alpha: 0.75, life });
    }
    const snd = w.sound && s.cache.audio.exists(w.sound) && s.data_.assets?.[w.sound];
    if (snd) s.sound.play(w.sound, { volume: (snd.volume ?? 100) / 100 * (0.92 + Math.random() * 0.16), detune: (Math.random() - 0.5) * 120 });
    this.spawn({ key: 'nail', x, y, vx: f * speed, vy: 0, life: (w.range ?? 600) / speed * 1000, friendly: true, damage: (w.damage ?? 5) * this.boost(), knockback: w.knockback ?? 80, crit: w.critChance ?? 0, time });
    if (!leyla.body.blocked.down) leyla.body.setVelocityX(leyla.body.velocity.x - f * 40);
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

  clear() { for (const p of this.shots) p.img?.destroy(); this.shots = []; }
}

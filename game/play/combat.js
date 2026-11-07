// Combat: Leyla's melee and ranged attacks, enemy shots, projectiles, hitstop.
// Weapon values from the game data (area "Waffen"): damage, cooldown, range, knockback, critChance, ammo, projectileSpeed.

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.shots = [];
  }

  melee(leyla, time) {
    const s = this.scene, w = s.weapon('melee');
    if (!w) return;
    leyla.meleeReady = time + (w.cooldown ?? 400);
    leyla.attackPose = time + 160;
    const reach = (w.range ?? 70) + 40, f = leyla.facing, b = leyla.body;
    const x0 = f > 0 ? b.center.x : b.left - reach, x1 = f > 0 ? b.right + reach : b.center.x;
    const y0 = b.bottom - 220, y1 = b.bottom - 20;
    s.fx.slash(leyla.x + f * 24, b.bottom - 130, f, w.range ?? 70);
    let hits = 0;
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const eb = e.body;
      if (eb.right > x0 && eb.left < x1 && eb.bottom > y0 && eb.top < y1) {
        const crit = Math.random() * 100 < (w.critChance ?? 0);
        e.hit(time, Math.round((w.damage ?? 10) * (crit ? 2 : 1)), w.knockback ?? 200, f, crit);
        hits++;
      }
    }
    if (hits) { s.hitstop(time, 55); s.cameras.main.shake(70, 0.003); }
  }

  shoot(leyla, time) {
    const s = this.scene, w = s.weapon('ranged');
    if (!w) return;
    leyla.rangedReady = time + (w.cooldown ?? 300);
    if (leyla.ammo <= 0) { s.fx.text(leyla.x, leyla.feet - 250, 'leer', { color: '#8b949e', size: 36, rise: 30 }); return; }
    leyla.ammo--;
    leyla.attackPose = time + 120;
    const f = leyla.facing, x = leyla.x + f * 60, y = leyla.feet - 140, speed = w.projectileSpeed ?? 1600;
    s.fx.flash(x + f * 10, y, 0xfff2b0, 18);
    this.spawn({ key: 'nail', x, y, vx: f * speed, vy: 0, life: (w.range ?? 600) / speed * 1000, friendly: true, damage: w.damage ?? 5, knockback: w.knockback ?? 80, crit: w.critChance ?? 0, time });
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

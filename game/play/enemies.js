// Enemies of the MVP: behaviors "charger" (Schläger) and "shooter" (Schütze); others fall back to "patrol".
// Values from the game data (area "Gegner"): health, damage, speed, aggroRange, weapon, attack.windup/cooldown/range/projectileSpeed, height.
// Every attack is telegraphed (windup): blinking + warning sign, the shooter shows his aim line.


export class Enemy {
  constructor(scene, id, def, feet) {
    this.scene = scene; this.id = id; this.d = def;
    this.weapon = scene.data_.weapons?.[def.weapon] || null;
    this.a = def.attack || {};
    this.h = def.height ?? 220;
    const bodyH = Math.round(this.h * 0.9);
    this.w = Math.round(this.h * 0.32);
    this.box = scene.add.rectangle(feet[0], feet[1] - bodyH / 2, this.w, bodyH, 0x000000, 0);
    scene.physics.add.existing(this.box);
    this.body = this.box.body;
    this.body.setMaxVelocityY(1700);
    const look = scene.enemyLook(def);
    this.look = look;
    this.sprite = scene.add.sprite(feet[0], feet[1], look.key).setOrigin(look.ox, look.oy).setScale(look.scale).setDepth(8);
    if (look.anim) this.sprite.play(look.anim);
    this.bar = scene.add.graphics().setDepth(15);
    this.warn = scene.add.text(0, 0, '!', { fontFamily: 'VT323, monospace', fontSize: '72px', color: '#ff4060', stroke: '#0d0a12', strokeThickness: 8 }).setOrigin(0.5, 1).setDepth(16).setVisible(false);
    this.aim = scene.add.graphics().setDepth(7);
    this.hp = def.health ?? 30;
    this.state = 'patrol'; this.facing = -1; this.home = feet[0];
    this.readyAt = 0; this.stunUntil = 0; this.barUntil = 0; this.lastSeen = -1e9;
  }

  get x() { return this.body.center.x; }
  get feet() { return this.body.bottom; }
  get chest() { return this.body.bottom - this.h * 0.6; }
  get alive() { return this.state !== 'dead'; }
  get behavior() { return this.d.behavior === 'shooter' ? 'shooter' : this.d.behavior === 'charger' ? 'charger' : 'patrol'; }

  // ground ahead in walking direction (so nobody walks off ledges)
  safeStep(dir) {
    const fx = this.x + dir * (this.w / 2 + 10);
    return this.scene.groundAt(fx, this.feet + 8) && !(dir < 0 ? this.body.blocked.left : this.body.blocked.right);
  }

  update(time, dt, leyla) {
    if (!this.alive) return;
    const b = this.body, speed = this.d.speed ?? 120;
    const dx = leyla.x - this.x, dist = Math.abs(dx), dy = Math.abs(leyla.chest - this.chest);
    const sees = leyla.alive && dist < (this.d.aggroRange ?? 400) && dy < (this.behavior === 'shooter' ? 420 : 240);
    if (sees) this.lastSeen = time;
    this.warn.setVisible(this.state === 'windup');
    this.aim.clear();

    if (time < this.stunUntil) { b.setVelocityX(b.velocity.x * 0.9); return this.draw(time); }

    switch (this.state) {
      case 'patrol': {
        if (sees) { this.state = 'chase'; this.scene.fx.text(this.x, this.feet - this.h - 10, '?!', { color: '#ffd27a', size: 48, rise: 30 }); break; }
        if (!this.safeStep(this.facing) || Math.abs(this.x - this.home) > 200 && Math.sign(this.x - this.home) === this.facing) this.facing *= -1;
        b.setVelocityX(this.facing * speed * 0.35);
        break;
      }
      case 'chase': {
        if (time - this.lastSeen > 1600) { this.state = 'patrol'; this.home = this.x; break; }
        this.facing = Math.sign(dx) || this.facing;
        if (this.behavior === 'shooter') this.shooterMove(time, dist, speed, sees);
        else {
          const range = this.a.range ?? 140;
          if (dist < range && dy < 160 && time >= this.readyAt) this.startWindup(time);
          else b.setVelocityX(dist > range * 0.7 && this.safeStep(this.facing) ? this.facing * speed : 0);
        }
        break;
      }
      case 'windup': {
        b.setVelocityX(0);
        if (this.behavior === 'shooter') this.drawAim(time);
        if (time >= this.windupEnd) this.behavior === 'shooter' ? this.fire(time) : this.lunge(time);
        break;
      }
      case 'lunge': {
        if (this.safeStep(this.facing)) b.setVelocityX(this.facing * speed * 1.9); else b.setVelocityX(0);
        if (!this.struck) this.strike(time, leyla);
        if (time >= this.lungeEnd) { this.state = 'recover'; this.recoverEnd = time + 260; }
        break;
      }
      case 'recover': {
        b.setVelocityX(b.velocity.x * 0.8);
        if (time >= this.recoverEnd) this.state = 'chase';
        break;
      }
    }
    this.draw(time);
  }

  shooterMove(time, dist, speed, sees) {
    const want = this.a.range ?? 520, b = this.body;
    let v = 0;
    if (dist < want * 0.55 && this.safeStep(-this.facing)) v = -this.facing * speed;
    else if (dist > want && this.safeStep(this.facing)) v = this.facing * speed * 0.8;
    b.setVelocityX(v);
    if (sees && time >= this.readyAt && dist <= (this.d.aggroRange ?? 600)) this.startWindup(time);
  }

  startWindup(time) {
    this.state = 'windup'; this.windupEnd = time + (this.a.windup ?? 450);
    if (this.behavior === 'shooter') {
      const l = this.scene.leyla, m = this.muzzle();
      const ang = Math.atan2(l.chest - m.y, l.x - m.x);
      this.aimDir = { x: Math.cos(ang), y: Math.sin(ang) };
      this.facing = Math.sign(this.aimDir.x) || this.facing;
    }
  }
  muzzle() { return { x: this.x + this.facing * this.h * 0.3, y: this.feet - this.h * 0.47 }; }
  drawAim(time) {
    const m = this.muzzle(), left = Math.max(0, this.windupEnd - time) / (this.a.windup || 1);
    this.aim.lineStyle(3, 0xff4060, 0.25 + 0.6 * (1 - left)).lineBetween(m.x, m.y, m.x + this.aimDir.x * 1400, m.y + this.aimDir.y * 1400);
  }
  fire(time) {
    this.scene.combat.enemyShot(this, this.muzzle(), this.aimDir);
    this.state = 'recover'; this.recoverEnd = time + 200;
    this.readyAt = time + (this.a.cooldown ?? 1400);
  }
  lunge(time) {
    this.state = 'lunge'; this.lungeEnd = time + 180; this.struck = false;
    this.readyAt = time + 180 + (this.a.cooldown ?? 900);
    this.scene.fx.slash(this.x + this.facing * 20, this.feet - this.h * 0.55, this.facing, (this.weapon?.range ?? 80), 0xff9a7a);
  }
  strike(time, leyla) {
    const reach = (this.weapon?.range ?? 80) + 40;
    const x0 = this.facing > 0 ? this.x : this.x - this.w / 2 - reach, x1 = this.facing > 0 ? this.x + this.w / 2 + reach : this.x;
    const y0 = this.feet - this.h * 0.9, y1 = this.feet - 20;
    const lb = leyla.body;
    if (lb.right > x0 && lb.left < x1 && lb.bottom > y0 && lb.top < y1) {
      this.struck = true;
      if (leyla.hurt(time, this.d.damage ?? 10, this.x)) this.scene.onLeylaHit(this.d.damage ?? 10);
    }
  }

  hit(time, damage, knockback, dir, crit) {
    if (!this.alive) return;
    this.hp -= damage;
    this.barUntil = time + 2500;
    this.sprite.setTintFill(crit ? 0xffd27a : 0xffffff);
    this.scene.time.delayedCall(70, () => this.alive && this.sprite.clearTint());
    this.scene.fx.text(this.x + (Math.random() - 0.5) * 40, this.feet - this.h - 10, String(damage) + (crit ? '!' : ''), { color: crit ? '#ffd27a' : '#ffffff', size: crit ? 56 : 42 });
    this.scene.fx.blood(this.x, this.chest, crit ? 18 : 10);
    this.body.setVelocity(dir * (knockback ?? 0), -(knockback ?? 0) * 0.35);
    this.stunUntil = time + 220;
    if (this.state === 'windup' || this.state === 'patrol') { this.state = 'chase'; this.readyAt = Math.max(this.readyAt, time + 350); }
    this.lastSeen = time;
    if (this.hp <= 0) this.die(time, dir);
  }

  die(time, dir) {
    this.state = 'dead';
    this.body.enable = false;
    this.warn.setVisible(false); this.aim.clear(); this.bar.clear();
    this.scene.fx.blood(this.x, this.chest, 26);
    this.scene.tweens.add({ targets: this.sprite, rotation: dir * 1.4, alpha: 0, y: this.sprite.y + 10, duration: 650, ease: 'Cubic.easeIn' });
    this.scene.onKill(this);
  }

  draw(time) {
    this.sprite.setPosition(this.body.center.x, this.body.bottom).setFlipX(this.look.flip ? this.facing > 0 : this.facing < 0);
    if (this.state === 'windup' && !this.stunned) this.sprite.setTintFill(Math.floor(time / 60) % 2 ? 0xff4060 : 0xffffff);
    else if (time > this.stunUntil - 150) this.sprite.clearTint();
    this.warn.setPosition(this.x, this.feet - this.h - 6);
    this.bar.clear();
    if (time < this.barUntil) {
      const w = Math.round(this.h * 0.46), x = this.x - w / 2, y = this.feet - this.h - 24, f = Math.max(0, this.hp / (this.d.health || 1));
      this.bar.fillStyle(0x0d0a12, 0.8).fillRect(x - 3, y - 3, w + 6, 14).fillStyle(0xe5484d).fillRect(x, y, w * f, 8);
    }
  }

  destroy() { for (const o of [this.box, this.sprite, this.bar, this.warn, this.aim]) o.destroy(); }
}

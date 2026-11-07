// Leyla: controller (states, physics feel) and look (sprite + code effects).
// All numbers come from the game data (area "Leyla"); only feel constants that are not game design live here.
//
// States: normal (ground/air) · dash · slide · climb · swing · dead
// Look: per state the asset from leyla.look.<state>, otherwise look.idle. Missing animations are covered by
// code effects (squash & stretch, lean, afterimages, blinking), new animations plug in without code changes.

// collider at 256 px look height; everything scales with the height of look.idle (Assets › „Höhe im Spiel“)
const BASE = { height: 256, w: 72, h: 224, slideH: 104, climbW: 44, hand: 84, chest: 150 };
const DASH_TIME = 170, TERMINAL_FALL = 1700;
const approach = (v, target, step) => v < target ? Math.min(target, v + step) : Math.max(target, v - step);

export class Leyla {
  constructor(scene, data, feet) {
    this.scene = scene;
    this.d = data.leyla;
    this.m = data.leyla.movement || {};
    const k = (data.assets?.[data.leyla.look?.idle]?.height || BASE.height) / BASE.height;
    this.size = Object.fromEntries(Object.entries(BASE).map(([n, v]) => [n, Math.round(v * k)]));
    const { w: BODY_W, h: BODY_H } = this.size;
    this.box = scene.add.rectangle(feet[0], feet[1] - BODY_H / 2, BODY_W, BODY_H, 0x000000, 0);
    scene.physics.add.existing(this.box);
    this.body = this.box.body;
    this.body.setMaxVelocityY(TERMINAL_FALL);
    this.sprite = scene.add.sprite(feet[0], feet[1], scene.lookKey('leyla', 'idle')).setDepth(10);
    this.start = feet;
    this.reset();
  }

  reset() {
    const [x, y] = this.start;
    this.setStanding();
    this.body.reset(x, y - this.size.h / 2);
    this.body.allowGravity = true;
    this.state = 'normal';
    this.facing = 1;
    this.health = this.d.health ?? 100;
    this.ammo = this.scene.weapon('ranged')?.ammo ?? Infinity;
    this.airJumps = this.m.airJumps ?? 0;
    this.airDash = true;
    this.lastGround = -1e9; this.jumpAt = -1e9; this.dashReady = 0; this.dropUntil = 0;
    this.meleeReady = 0; this.rangedReady = 0; this.invulnerableUntil = 0; this.attackPose = 0;
    this.squash = { x: 1, y: 1 };
    this.sprite.setAlpha(1).setRotation(0).clearTint();
  }

  get feet() { return this.body.bottom; }
  get x() { return this.body.center.x; }
  get chest() { return this.body.bottom - this.size.chest; }
  get height() { return this.size.h; }
  get alive() { return this.state !== 'dead'; }
  invulnerable(time) { return time < this.invulnerableUntil || (this.state === 'dash' && this.m.dashInvulnerable); }

  setStanding() { const z = this.size; this.body.setSize(z.w, z.h, false); this.body.setOffset(0, 0); }
  setNarrow() { const z = this.size; this.body.setSize(z.climbW, z.h, false); this.body.setOffset((z.w - z.climbW) / 2, 0); }   // on ladders next to ledges
  setLow() { const z = this.size; this.body.setSize(z.w, z.slideH, false); this.body.setOffset(0, z.h - z.slideH); }
  canStand() { const z = this.size; return this.scene.rectFree(this.x - z.w / 2 + 2, this.feet - z.h, z.w - 4, z.h - 2); }

  // ---------- update ----------
  update(time, dt, input) {
    const s = dt / 1000, b = this.body, m = this.m;
    const grounded = b.blocked.down || b.touching.down;
    if (grounded) {
      if (!this.wasGrounded && this.lastVy > 500 && this.state === 'normal') this.land(this.lastVy);
      this.lastGround = time; this.airJumps = m.airJumps ?? 0; this.airDash = true;
    }
    if (input.jump.pressed) this.jumpAt = time;
    const dir = (input.right.down ? 1 : 0) - (input.left.down ? 1 : 0);

    switch (this.state) {
      case 'normal': this.normal(time, s, input, dir, grounded); break;
      case 'dash': this.dash(time, input); break;
      case 'slide': this.slide(time, input, grounded); break;
      case 'climb': this.climb(time, input, dir, grounded); break;
      case 'swing': this.swing(time, s, input, dir); break;
      case 'dead': b.setVelocityX(b.velocity.x * 0.9); break;
    }
    if (this.alive && this.state !== 'climb') {
      if (input.melee.pressed && time >= this.meleeReady) this.scene.combat.melee(this, time);
      if (input.ranged.pressed && time >= this.rangedReady) this.scene.combat.shoot(this, time);
    }
    this.wasGrounded = grounded;
    this.lastVy = b.velocity.y;
    this.look(time, dt, grounded);
  }

  normal(time, s, input, dir, grounded) {
    const b = this.body, m = this.m;
    if (dir && time > this.attackPose) this.facing = dir;
    const speed = input.walk.down ? (m.walkSpeed ?? 240) : (m.runSpeed ?? 440);
    let acc = (m.acceleration ?? 2800) * (grounded ? (dir ? 1 : 1.6) : 0.75);
    // keep momentum in the air (rope, knockback) while pushing the same way
    if (!grounded && Math.abs(b.velocity.x) > speed && Math.sign(b.velocity.x) === dir) acc *= 0.15;
    b.setVelocityX(approach(b.velocity.x, dir * speed, acc * s));

    const ladder = this.scene.ladderAt(this.x, this.feet);
    // drop through a platform: ↓ + jump
    if (grounded && input.down.down && input.jump.pressed && this.scene.onPlatform(this.x, this.feet)) {
      this.dropUntil = time + 250; this.jumpAt = -1e9; return;
    }
    // jump (buffer + coyote time), air jumps, short hop when released early
    if (time - this.jumpAt <= (m.jumpBuffer ?? 120) && (grounded || time - this.lastGround <= (m.coyoteTime ?? 100))) {
      this.jump(1); this.lastGround = -1e9;
    } else if (input.jump.pressed && !grounded && this.airJumps > 0) {
      this.airJumps--; this.jump(0.92); this.scene.fx.puff(this.x, this.feet, 0x3fe0d0);
    }
    if (this.cut && !input.jump.down && b.velocity.y < 0) { b.setVelocityY(b.velocity.y * 0.45); this.cut = false; }
    if (b.velocity.y >= 0) this.cut = false;

    if (input.dash.pressed && time >= this.dashReady && (grounded || this.airDash)) return this.startDash(time, dir);
    if (grounded && input.down.pressed && Math.abs(b.velocity.x) > (m.walkSpeed ?? 240) * 0.8 && !(ladder && this.feet <= ladder.top + 4)) return this.startSlide(time);
    if (ladder) {
      const atTop = this.feet <= ladder.top + 4, atBottom = this.feet >= ladder.bottom - 4;
      if ((input.up.down && !atTop && (input.up.pressed || !grounded)) || (input.down.down && atTop && grounded) || (input.down.down && !grounded && !atBottom)) return this.startClimb(ladder);
    }
    if (!grounded && (input.grab.pressed || input.up.pressed)) {
      const a = this.scene.anchorNear(this.x, this.hand().y, this.m.swingRope ?? 320);
      if (a) return this.startSwing(a);
    }
  }

  jump(f) {
    this.body.setVelocityY(-(this.m.jumpVelocity ?? 1100) * f);
    this.jumpAt = -1e9; this.cut = true;
    this.squash = { x: 0.86, y: 1.14 };
  }
  land(vy) {
    const k = Math.min(1, vy / 1600);
    this.squash = { x: 1 + 0.2 * k, y: 1 - 0.2 * k };
    this.scene.fx.dust(this.x, this.feet, 6 + 8 * k);
  }

  // ---------- dash ----------
  startDash(time, dir) {
    if (dir) this.facing = dir;
    this.scene.drone?.react('dash');
    this.state = 'dash'; this.dashEnd = time + DASH_TIME; this.dashReady = time + DASH_TIME + (this.m.dashCooldown ?? 600);
    if (!this.body.blocked.down) this.airDash = false;
    this.body.allowGravity = false;
    this.body.setVelocity(this.facing * (this.m.dashDistance ?? 280) / (DASH_TIME / 1000), 0);
    this.squash = { x: 1.25, y: 0.84 };
    this.nextGhost = 0;
    this.scene.fx.dust(this.x, this.feet, 5);
  }
  dash(time, input) {
    this.body.setVelocity(this.facing * (this.m.dashDistance ?? 280) / (DASH_TIME / 1000), 0);
    if (time >= this.nextGhost) { this.scene.fx.ghost(this.sprite); this.nextGhost = time + 28; }
    if (input.jump.pressed && (this.body.blocked.down || time - this.lastGround < 120)) { this.endDash(); this.jump(1); return; }
    if (time >= this.dashEnd || this.body.blocked.left || this.body.blocked.right) this.endDash();
  }
  endDash() {
    this.state = 'normal'; this.body.allowGravity = true;
    this.body.setVelocityX(this.facing * (this.m.runSpeed ?? 440));
  }

  // ---------- slide ----------
  startSlide(time) {
    this.state = 'slide'; this.slideEnd = time + (this.m.slideDuration ?? 350);
    this.setLow();
    this.body.setVelocityX(this.facing * (this.m.slideSpeed ?? 600));
    this.scene.fx.dust(this.x, this.feet, 8);
  }
  slide(time, input, grounded) {
    const b = this.body, blocked = !this.canStand();
    const speed = time < this.slideEnd ? (this.m.slideSpeed ?? 600) : blocked ? 260 : 0;
    b.setVelocityX(this.facing * speed);
    if (Math.random() < 0.4) this.scene.fx.dust(this.x - this.facing * this.size.w / 2, this.feet, 1);
    if (input.jump.pressed && !blocked) { this.endSlide(); this.jump(1); return; }
    if ((time >= this.slideEnd && !blocked) || (!grounded && !blocked) || b.blocked.left || b.blocked.right) {
      if (blocked) { this.facing *= -1; return; }   // stuck in a tunnel: crawl back out
      this.endSlide();
    }
  }
  endSlide() { this.state = 'normal'; this.setStanding(); this.squash = { x: 0.92, y: 1.08 }; }

  // ---------- ladder ----------
  startClimb(ladder) {
    this.state = 'climb'; this.ladder = ladder;
    this.body.allowGravity = false;
    this.setNarrow();
    this.body.reset(ladder.cx, this.body.center.y);
    this.body.setVelocity(0, 0);
  }
  climb(time, input, dir, grounded) {
    const b = this.body, L = this.ladder, m = this.m;
    const v = ((input.down.down ? 1 : 0) - (input.up.down ? 1 : 0)) * (m.climbSpeed ?? 180);
    b.setVelocity(0, v);
    this.climbPhase = (this.climbPhase || 0) + Math.abs(v) / 1000;
    if (input.jump.pressed) { this.leaveClimb(); b.setVelocity(dir * (m.walkSpeed ?? 240), -(m.jumpVelocity ?? 1100) * 0.6); this.cut = true; return; }
    if (v < 0 && this.feet <= L.top) { this.body.reset(L.cx, L.top - this.size.h / 2); this.leaveClimb(); return; }
    if (this.feet >= L.bottom && grounded && v >= 0) { this.leaveClimb(); return; }
    if (dir && grounded) this.leaveClimb();
  }
  leaveClimb() { this.state = 'normal'; this.body.allowGravity = true; this.ladder = null; this.setStanding(); }

  // ---------- rope swing (pendulum) ----------
  startSwing(a) {
    const { x: hx, y: hy } = this.hand();
    const dx = hx - a.x, dy = hy - a.y;
    this.anchor = a;
    this.rope = Math.max(128, Math.min(this.m.swingRope ?? 320, Math.hypot(dx, dy)));
    this.theta = Math.atan2(dx, dy);
    const v = this.body.velocity;
    this.omega = (v.x * Math.cos(this.theta) - v.y * Math.sin(this.theta)) / this.rope;
    this.state = 'swing'; this.body.allowGravity = false;
    this.squash = { x: 0.9, y: 1.1 };
  }
  swing(time, s, input, dir) {
    const g = this.scene.gravity, L = this.rope;
    this.omega += (-(g / L) * Math.sin(this.theta) + dir * 2.6 * Math.cos(this.theta) * (300 / L)) * s;
    this.omega *= 1 - 0.12 * s;
    this.theta += this.omega * s;
    if (dir) this.facing = dir;
    const tx = this.anchor.x + L * Math.sin(this.theta), ty = this.anchor.y + L * Math.cos(this.theta) + this.size.h / 2 - this.size.hand;
    this.body.setVelocity((tx - this.body.center.x) / s, (ty - this.body.center.y) / s);
    if (input.jump.pressed || input.grab.pressed) return this.releaseSwing(true);
    const b = this.body.blocked;
    if (b.left || b.right || b.up || b.down) this.releaseSwing(false);
  }
  releaseSwing(boost) {
    const k = boost ? 1 + (this.m.swingBoost ?? 0) / 100 : 0.5, v = this.rope * this.omega;
    this.state = 'normal'; this.body.allowGravity = true; this.anchor = null;
    this.body.setVelocity(v * Math.cos(this.theta) * k, -v * Math.sin(this.theta) * k - (boost ? 260 : 0));
    this.airJumps = this.m.airJumps ?? 0; this.airDash = true; this.cut = false;
    this.squash = { x: 0.88, y: 1.12 };
  }

  // ---------- damage ----------
  hurt(time, damage, fromX) {
    if (!this.alive || this.invulnerable(time)) return false;
    this.health = Math.max(0, this.health - damage);
    this.invulnerableUntil = time + (this.d.invulnerableAfterHit ?? 600);
    const low = this.state === 'slide' && !this.canStand();   // hit in a tunnel: stay low
    if (this.state === 'slide' && !low) this.endSlide();
    if (this.state === 'climb') this.leaveClimb();
    if (this.state === 'swing') this.releaseSwing(false);
    if (this.state === 'dash') this.endDash();
    const away = Math.sign(this.x - fromX) || -this.facing;
    this.body.setVelocity(away * 520, low ? 0 : -420);
    if (low) this.facing = away;
    this.sprite.setTintFill(0xff4060);
    this.scene.time.delayedCall(90, () => this.sprite.clearTint());
    if (this.health <= 0) this.die();
    return true;
  }
  die() {
    if (this.state === 'slide') this.setStanding();
    this.state = 'dead'; this.body.allowGravity = true;
    this.scene.onLeylaDown();
  }

  // ---------- look ----------
  look(time, dt, grounded) {
    const b = this.body, v = b.velocity, st = this.state;
    const name = st === 'dead' ? 'hurt' : st === 'normal' ? (!grounded ? (v.y < 0 ? 'jump' : 'fall') : Math.abs(v.x) > 300 ? 'run' : Math.abs(v.x) > 20 ? 'walk' : 'idle') : st === 'swing' ? 'jump' : st;
    const info = this.scene.playLook(this.sprite, 'leyla', name, this.facing);
    // run cycle follows the speed, so the feet do not slide (walking = slower steps)
    this.sprite.anims.timeScale = info.used === 'run' ? Math.max(0.45, Math.min(1.4, Math.abs(v.x) / (this.m.runSpeed || 440))) : 1;
    // squash & stretch relaxes back to 1
    const k = Math.min(1, dt / 90);
    this.squash.x += (1 - this.squash.x) * k; this.squash.y += (1 - this.squash.y) * k;
    let sx = this.squash.x, sy = this.squash.y, rot = 0;
    const lean = v.x / (this.m.runSpeed || 440);
    if (st === 'normal' && grounded && info.fallback && Math.abs(v.x) > 20) { sy *= 1 + Math.sin(time / 55) * 0.025; rot = lean * 0.09; }
    if (st === 'normal' && !grounded && info.fallback) rot = this.facing * Math.max(-0.12, Math.min(0.12, v.y / 9000)) + lean * 0.05;
    if (st === 'slide') rot = -this.facing * 1.15;
    if (st === 'dash') rot = this.facing * 0.12;
    if (st === 'climb') rot = Math.sin(this.climbPhase * 6) * 0.05;
    if (st === 'swing') rot = -this.theta * 0.85;
    if (time < this.attackPose && st === 'normal') rot += this.facing * 0.1;
    if (st === 'dead') { this.deadRot = (this.deadRot || 0) + (this.facing * -1.45 - (this.deadRot || 0)) * k; rot = this.deadRot; } else this.deadRot = 0;
    this.sprite.setPosition(b.center.x, b.bottom).setRotation(rot);
    this.sprite.setScale(info.scale * sx, info.scale * sy);
    this.sprite.setFlipX(info.flip ? this.facing > 0 : this.facing < 0);
    if (st !== 'dead') this.sprite.setAlpha(time < this.invulnerableUntil && Math.floor(time / 70) % 2 ? 0.35 : 1);
  }

  hand() { return { x: this.x, y: this.feet - this.size.h + this.size.hand }; }
}

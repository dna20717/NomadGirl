// Leyla: controller (states, physics feel) and look (sprite + code effects).
// All numbers come from the game data (area "Leyla"); only feel constants that are not game design live here.
//
// States: normal (ground/air) · dash · slide · climb · swing · hang (ledge) · mantle (pull up) · crouch (also standing up) · dead
// Look: per state the asset from leyla.look.<state>, otherwise look.idle. Missing animations are covered by
// code effects (squash & stretch, lean, afterimages, blinking), new animations plug in without code changes.

// collider at 256 px look height; everything scales with the height of look.idle (Assets › „Höhe im Spiel“)
// hangReach: hands above the feet while hanging; mantleLift: how far the last pull-up frame lifts the feet inside the picture
const BASE = { height: 256, w: 72, h: 224, slideH: 104, crouchH: 196, climbW: 44, hand: 84, chest: 150, hangReach: 253, mantleLift: 120 };
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
    // two idles: after every loop pick one at random (Leyla › „Stehen 2 Anteil“)
    this.idleVariant = 'idle';
    this.sprite.on('animationrepeat', () => {
      if (this.idleNow) this.idleVariant = Math.random() * 100 < (this.d.idleAltChance ?? 50) ? 'idleAlt' : 'idle';
    });
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
    this.lastGround = -1e9; this.jumpAt = -1e9; this.dashReady = 0; this.dropUntil = 0; this.noGrabUntil = 0;
    this.ledge = null; this.body.checkCollision.none = false;
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
  setCrouch() { const z = this.size; this.body.setSize(z.w, z.crouchH, false); this.body.setOffset(0, z.h - z.crouchH); }
  setLow() { const z = this.size; this.body.setSize(z.w, z.slideH, false); this.body.setOffset(0, z.h - z.slideH); }
  canStand() { const z = this.size; return this.scene.rectFree(this.x - z.w / 2 + 2, this.feet - z.h, z.w - 4, z.h - 2); }

  // ---------- update ----------
  update(time, dt, input) {
    const s = dt / 1000, b = this.body, m = this.m;
    const grounded = b.blocked.down || b.touching.down;
    if (grounded) {
      if (!this.wasGrounded && this.lastVy > 500 && this.state === 'normal') this.land(this.lastVy);
      this.lastGround = time; this.airJumps = m.airJumps ?? 0; this.airDash = true; this.flipUntil = 0;
    }
    if (input.jump.pressed) this.jumpAt = time;
    const dir = (input.right.down ? 1 : 0) - (input.left.down ? 1 : 0);

    switch (this.state) {
      case 'normal': this.normal(time, s, input, dir, grounded); break;
      case 'dash': this.dash(time, input); break;
      case 'slide': this.slide(time, input, grounded); break;
      case 'climb': this.climb(time, input, dir, grounded); break;
      case 'swing': this.swing(time, s, input, dir); break;
      case 'hang': this.hang(time, input, dir); break;
      case 'mantle': this.mantle(time); break;
      case 'crouch': this.crouch(time, dt, input, dir, grounded); break;
      case 'dead': b.setVelocityX(b.velocity.x * 0.9); break;
    }
    if (this.alive && !['climb', 'hang', 'mantle'].includes(this.state)) {
      if (input.melee.pressed && time >= this.meleeReady) this.scene.combat.melee(this, time);
      if (input.ranged.pressed && time >= this.rangedReady) this.scene.combat.shoot(this, time);
    }
    if (time < (this.flipUntil || 0) && m.airJumpGhosts && time >= (this.nextGhost || 0)) { this.scene.fx.ghost(this.sprite); this.nextGhost = time + 28; }
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
      // double jump: whole animation once, or from „Doppelsprung ab Frame“ over „Doppelsprung-Dauer“ (e.g. the last dash frames)
      this.flipAt = time; this.flipLen = (m.airJumpFromFrame ?? 1) > 1 ? (m.airJumpTime ?? 300) : this.scene.lookDuration('airJump');
      this.flipUntil = time + this.flipLen; this.nextGhost = 0;
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
    // ledge: while jumping or falling and pushing towards a wall or platform end, the hands catch its edge
    if (!grounded && dir && m.ledgeGrab !== false && time >= this.noGrabUntil && b.velocity.y > -350) {
      const L = this.scene.ledgeAt(this.x, this.hand().y, dir, m.ledgeReach ?? 56, this.size.w / 2);
      if (L && this.hangFits(L)) return this.startHang(L);
    }
    // crouch: ↓ while standing (fast = slide, see above)
    if (grounded && input.down.down && !input.jump.down && Math.abs(b.velocity.x) <= (m.walkSpeed ?? 240) * 0.8) return this.startCrouch();
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

  // ---------- ledge: hang, pull up, crouch ----------
  hangBox(L) { const z = this.size; return { x: L.x - L.dir * z.w / 2, feet: L.y + z.hangReach }; }
  hangFits(L) {
    const z = this.size, { x, feet } = this.hangBox(L);
    return this.scene.rectFree(x - z.w / 2 + 2, feet - z.h, z.w - 4, z.h - 2);
  }
  startHang(L) {
    const { x, feet } = this.hangBox(L), b = this.body;
    this.state = 'hang'; this.ledge = L; this.facing = L.dir;
    this.setStanding(); b.allowGravity = false;
    b.reset(x, feet - this.size.h / 2); b.setVelocity(0, 0);
    this.airJumps = this.m.airJumps ?? 0; this.airDash = true; this.cut = false; this.flipUntil = 0;
    this.squash = { x: 0.94, y: 1.06 };
  }
  hang(time, input, dir) {
    const b = this.body, L = this.ledge, m = this.m;
    b.setVelocity(0, 0);
    if (input.jump.pressed && dir === -L.dir) {   // jump away from the wall
      this.leaveHang(time); this.facing = dir;
      b.setVelocity(dir * (m.runSpeed ?? 440) * 0.8, -(m.jumpVelocity ?? 1100) * 0.85); this.cut = true; this.jumpAt = -1e9;
      return;
    }
    if (input.up.pressed || input.jump.pressed) {
      this.jumpAt = -1e9;
      const z = this.size, top = { x: L.x + L.dir * (z.w / 2 + 4), feet: L.y };
      if (this.scene.rectFree(top.x - z.w / 2 + 2, top.feet - z.crouchH, z.w - 4, z.crouchH - 2)) return this.startMantle(time, top);
    }
    if (input.down.pressed) this.leaveHang(time);
  }
  leaveHang(time) { this.state = 'normal'; this.body.allowGravity = true; this.ledge = null; this.noGrabUntil = time + 300; }
  startMantle(time, top) {
    this.state = 'mantle'; this.mantleAt = time;
    this.mantleFrom = { x: this.x, feet: this.feet }; this.mantleTo = top;
    this.body.checkCollision.none = true; this.body.setVelocity(0, 0);
  }
  mantleP(time) { return Math.min(1, (time - this.mantleAt) / (this.m.mantleTime ?? 450)); }
  mantle(time) {
    this.body.setVelocity(0, 0);
    if (this.mantleP(time) < 1) return;
    const t = this.mantleTo, b = this.body;
    b.checkCollision.none = false; b.allowGravity = true; this.ledge = null;
    this.setCrouch(); b.reset(t.x, t.feet - this.size.h / 2);   // offset keeps the feet at the bottom
    this.state = 'crouch'; this.crouchF = this.crouchFrames() - 1; this.rising = true;
  }
  crouchFrames() { return this.scene.data_.assets?.[this.d.look?.crouch]?.frames || 1; }
  startCrouch() {
    this.state = 'crouch'; this.crouchF = 0; this.rising = false;
    this.setCrouch(); this.body.setVelocityX(0);
  }
  crouch(time, dt, input, dir, grounded) {
    const b = this.body, m = this.m, last = this.crouchFrames() - 1;
    b.setVelocityX(0);
    if (!grounded) { this.endCrouch(); return; }
    // drop through a platform (↓ + jump) or jump out of the crouch
    if (input.jump.pressed && this.canStand()) {
      this.endCrouch();
      if (input.down.down && this.scene.onPlatform(this.x, this.feet)) { this.dropUntil = time + 250; this.jumpAt = -1e9; } else this.jump(1);
      return;
    }
    // at an edge: ↓ + direction towards it = climb down and hang on the edge
    if (dir && input.down.down && !this.rising) {
      const L = this.scene.edgeBelow(this.x, this.feet, dir, this.size.w / 2);
      if (L && this.hangFits(L)) { this.endCrouch(); return this.startHang(L); }
    }
    if (dir && this.canStand()) { this.facing = dir; this.endCrouch(); return; }
    this.rising = !input.down.down;
    const target = this.rising ? 0 : last, ms = this.rising ? (m.standUpTime ?? 350) : (m.crouchTime ?? 300);
    const step = ms > 0 ? last * dt / ms : last;
    this.crouchF = target > this.crouchF ? Math.min(target, this.crouchF + step) : Math.max(target, this.crouchF - step);
    if (this.rising && this.crouchF <= 0 && this.canStand()) this.endCrouch();
  }
  endCrouch() { const x = this.x, f = this.feet, vx = this.body.velocity.x; this.state = 'normal'; this.rising = false; this.setStanding(); this.body.reset(x, f - this.size.h / 2); this.body.setVelocityX(vx); }

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
    if (this.state === 'hang' || this.state === 'mantle') { this.body.checkCollision.none = false; this.setStanding(); this.leaveHang(time); }
    if (this.state === 'crouch') this.endCrouch();
    const away = Math.sign(this.x - fromX) || -this.facing;
    this.body.setVelocity(away * 520, low ? 0 : -420);
    if (low) this.facing = away;
    this.sprite.setTintFill(0xff4060);
    this.scene.time.delayedCall(90, () => this.sprite.clearTint());
    if (this.health <= 0) this.die();
    return true;
  }
  die() {
    if (this.state === 'slide' || this.state === 'crouch') this.setStanding();
    this.body.checkCollision.none = false;
    this.state = 'dead'; this.body.allowGravity = true;
    this.scene.onLeylaDown();
  }

  // ---------- look ----------
  look(time, dt, grounded) {
    const b = this.body, v = b.velocity, st = this.state;
    let name = st === 'dead' ? 'hurt' : st === 'normal' ? (!grounded ? (time < (this.flipUntil || 0) ? 'airJump' : v.y < 0 ? 'jump' : 'fall') : Math.abs(v.x) > 300 ? 'run' : Math.abs(v.x) > 20 ? 'walk' : 'idle') : st === 'swing' ? 'jump' : st;
    this.idleNow = name === 'idle';
    if (name === 'idle' && this.idleVariant === 'idleAlt' && this.d.look?.idleAlt) name = 'idleAlt';
    // mantle and crouch pick their frame from the progress (crouch backwards = standing up)
    const flipFrames = name === 'airJump' && (this.m.airJumpFromFrame ?? 1) > 1;
    const manual = st === 'mantle' || st === 'crouch' || st === 'dash' || flipFrames, an0 = this.sprite.anims;
    if (!manual && st !== 'slide' && an0.isPaused) an0.resume();
    const info = this.scene.playLook(this.sprite, 'leyla', name, this.facing);
    if (manual && (info.used === st || (flipFrames && info.used === 'airJump')) && an0.currentAnim) {
      const fr = an0.currentAnim.frames, n = fr.length;
      const from = st === 'mantle' ? Math.min(n - 1, Math.max(0, (this.m.mantleFromFrame ?? 5) - 1)) : 0;
      const dashFrom = Math.min(n - 1, Math.max(0, (this.m.dashFromFrame ?? 1) - 1)), dashP = Math.min(1, 1 - (this.dashEnd - time) / DASH_TIME);
      const flipFrom = Math.min(n - 1, Math.max(0, (this.m.airJumpFromFrame ?? 1) - 1)), flipP = Math.min(1, (time - this.flipAt) / Math.max(1, this.flipLen));
      const f = flipFrames ? Math.round(flipFrom + (n - 1 - flipFrom) * flipP) : st === 'mantle' ? Math.round(from + (n - 1 - from) * this.mantleP(time)) : st === 'dash' ? Math.round(dashFrom + (n - 1 - dashFrom) * dashP) : Math.round(Math.min(n - 1, this.crouchF || 0));
      if (!an0.isPaused) an0.pause();
      this.sprite.setFrame(fr[f].frame.name);
    }
    // run cycle follows the speed, so the feet do not slide (walking = slower steps)
    // sliding through a tunnel: hold the lowest frame (middle of the slide) until she can stand
    const an = this.sprite.anims;
    if (st === 'slide' && info.used === 'slide' && an.currentAnim) {
      const mid = an.currentAnim.frames[Math.floor(an.currentAnim.frames.length / 2)];
      if (!this.canStand() && an.currentFrame?.index >= mid.index) { if (!an.isPaused) an.pause(mid); } else if (an.isPaused) an.resume();
    }
    const pace = { run: this.m.runSpeed || 440, walk: this.m.walkSpeed || 240 }[info.used];
    this.sprite.anims.timeScale = pace ? Math.max(0.45, Math.min(1.4, Math.abs(v.x) / pace)) : 1;
    // squash & stretch relaxes back to 1
    const k = Math.min(1, dt / 90);
    this.squash.x += (1 - this.squash.x) * k; this.squash.y += (1 - this.squash.y) * k;
    let sx = this.squash.x, sy = this.squash.y, rot = 0;
    const lean = v.x / (this.m.runSpeed || 440);
    if (st === 'normal' && grounded && info.fallback && Math.abs(v.x) > 20) { sy *= 1 + Math.sin(time / 55) * 0.025; rot = lean * 0.09; }
    if (st === 'normal' && !grounded && info.fallback) rot = this.facing * Math.max(-0.12, Math.min(0.12, v.y / 9000)) + lean * 0.05;
    if (info.fallback && st === 'slide') rot = -this.facing * 1.15;
    if (info.fallback && st === 'dash') rot = this.facing * 0.12;
    if (info.fallback && st === 'climb') rot = Math.sin(this.climbPhase * 6) * 0.05;
    if (st === 'swing') rot = -this.theta * 0.85;
    if (name === 'airJump' && this.m.airJumpTilt) rot = this.facing * Math.atan2(v.y, Math.max(Math.abs(v.x), 250)) * this.m.airJumpTilt / 100;   // pose leans into the jump
    if (time < this.attackPose && st === 'normal') rot += this.facing * 0.1;
    if (st === 'dead') { this.deadRot = (this.deadRot || 0) + (this.facing * -1.45 - (this.deadRot || 0)) * k; rot = this.deadRot; } else this.deadRot = 0;
    this.sprite.setPosition(b.center.x, b.bottom).setRotation(rot);
    if (st === 'mantle') {   // the picture lifts the feet itself, so the anchor only rises the rest of the way
      const p = this.mantleP(time), F = this.mantleFrom, T = this.mantleTo, e = p * p * (3 - 2 * p);
      const lift = info.used === 'mantle' ? this.size.mantleLift : 0, ex = Math.max(0, Math.min(1, (p - 0.4) / 0.6));
      this.sprite.setPosition(F.x + (T.x - F.x) * ex * ex * (3 - 2 * ex), F.feet + (T.feet + lift - F.feet) * e);
    }
    this.sprite.setScale(info.scale * sx, info.scale * sy);
    this.sprite.setFlipX(info.flip ? this.facing > 0 : this.facing < 0);
    if (st !== 'dead') this.sprite.setAlpha(time < this.invulnerableUntil && Math.floor(time / 70) % 2 ? 0.35 : 1);
  }

  hand() { return { x: this.x, y: this.feet - this.size.h + this.size.hand }; }
}

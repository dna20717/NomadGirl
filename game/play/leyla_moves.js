// Leyla's special moves (#017 split from leyla.js): dash, slide, ladder, rope swing, ledges, hard landing, braking.
// Mixed into Leyla (game/play/leyla.js): the methods keep their `this`, nothing else changes.
import { DASH_TIME } from './leyla.js';

export class LeylaMoves {
  // ---------- dash ----------
  startDash(time, dir) {
    if (dir) this.facing = dir;
    this.scene.drone?.react('dash');
    this.state = 'dash'; this.flipUntil = 0; this.dashEnd = time + DASH_TIME;   // a dash ends the somersault (no flip after the dash)
    this.dashReady = time + DASH_TIME + (this.m.dashCooldown ?? 600) * Math.max(0.1, 1 + (this.scene.mods?.dashCooldown || 0) / 100);
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
    this.state = 'slide'; this.slideAt = time; this.slideEnd = time + (this.m.slideDuration ?? 350);
    this.setLow();
    this.body.setVelocityX(this.facing * (this.m.slideSpeed ?? 600));
    this.scene.fx.dust(this.x, this.feet, 8);
  }
  slide(time, input, grounded) {
    const b = this.body, blocked = !this.canStand();
    // a push that rolls out (Daniel, 12.11.2026: „nicht statisch von A nach B gleiten“): 120 % at the start down to 75 % at the end, about the same way
    const p = Math.min(1, (time - (this.slideAt ?? time)) / Math.max(1, this.slideEnd - (this.slideAt ?? time)));
    const speed = time < this.slideEnd ? (this.m.slideSpeed ?? 600) * (1.2 - 0.45 * p) : blocked ? 260 : 0;
    b.setVelocityX(this.facing * speed);
    if (Math.random() < 0.4) this.scene.fx.dust(this.x - this.facing * this.size.w / 2, this.feet, 1);
    if (speed > (this.m.slideSpeed ?? 600) * 0.95 && this.m.slideGhosts !== false && time >= (this.nextGhost || 0)) { this.scene.fx.ghost(this.sprite, 0xe45aa8, 0.22, 160); this.nextGhost = time + 80; }   // only in the first push: a faint pink trail   // speed: a few after-images while she shoots along
    if (input.jump.pressed && !blocked) { this.endSlide(); this.jump(1); return; }
    if ((time >= this.slideEnd && !blocked) || (!grounded && !blocked) || b.blocked.left || b.blocked.right) {
      if (blocked) { this.facing *= -1; return; }   // stuck in a tunnel: crawl back out
      this.endSlide();
      // direction still held: run on at full pace (Daniel, 11.11.2026: one frame standing still after the slide looked like a stutter)
      const dir = (input.right.down ? 1 : 0) - (input.left.down ? 1 : 0);
      if (dir === this.facing && grounded) b.setVelocityX(this.facing * (this.m.runSpeed ?? 440));
    }
  }
  // the double jump as a somersault: roll in, the tuck frames turn (rotation in look()), open up (Leyla › Laufen & Springen › Salto)
  spinFrame(n, p) {
    const M = this.m, [a1, b1] = M.airJumpTuck || [4, 4], a = Math.min(n - 1, a1 - 1), b = Math.min(n - 1, b1 - 1), [p0, p1] = (M.airJumpPhase || [22, 78]).map(x => x / 100);
    if (p < p0) return Math.floor(a * p / p0);
    if (p > p1) return Math.min(n - 1, b + 1 + Math.floor((n - 1 - b) * (p - p1) / Math.max(0.01, 1 - p1)));
    const q = (p - p0) / Math.max(0.01, p1 - p0), e = q < 0.5 ? 2 * q * q : 1 - 2 * (1 - q) * (1 - q);   // ease in and out
    this.flipSpin = e * (M.airJumpSpin || 1) * Math.PI * 2;
    return a + Math.min(b - a, Math.floor(q * (b - a + 1)));
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
    // ↓ = slide down (Daniel, 11.11.2026: „rutschen, keine Animation, schneller runter“; Leyla › Klettern & Schwingen › Rutschen, 0 = klettern)
    const slideDown = input.down.down && !input.up.down && (m.ladderSlide ?? 560) > 0;
    const v = slideDown ? Math.min(m.ladderSlide ?? 560, Math.max(m.climbSpeed ?? 150, b.velocity.y + (m.ladderSlide ?? 560) / 10)) : ((input.down.down ? 1 : 0) - (input.up.down ? 1 : 0)) * (m.climbSpeed ?? 150);
    b.setVelocity(0, v);
    this.climbSliding = slideDown;
    if (slideDown && Math.random() < 0.25) this.scene.fx.dust(this.x, this.y - this.size.h * 0.3, 1);
    if (!slideDown) {
      this.climbPhase = (this.climbPhase || 0) + Math.abs(v) / 1000;
      this.climbDist = (this.climbDist || 0) + Math.abs(v) / 60;   // px climbed (per frame at 60 fps), drives the climb frames
    }
    // near the top: pull up sideways like at a ledge (hands at the top rung), then stand up from the crouch
    if (v < 0 && m.ladderMantle !== false && this.feet <= L.top + this.size.hangReach && this.feet > L.top + 8) {
      const z = this.size, top = { x: L.cx, feet: L.top };
      if (this.scene.rectFree(top.x - z.w / 2 + 2, top.feet - z.crouchH, z.w - 4, z.crouchH - 2)) {
        this.ladder = null; this.body.allowGravity = false; this.setStanding();
        if (dir) this.facing = dir;
        return this.startMantle(time, top);
      }
    }
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
    this.airJumps = this.maxAirJumps; this.airDash = this.canAirDash; this.cut = false;
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
    this.oneArm = !!L.drone && this.m.droneOneArm !== false && !!this.d.look?.hangOne;   // at AvA: dangling from one arm (Daniel, 12.11.2026)
    this.setStanding(); b.allowGravity = false;
    b.reset(x, feet - this.size.h / 2); b.setVelocity(0, 0);
    this.airJumps = this.maxAirJumps; this.airDash = this.canAirDash; this.cut = false; this.flipUntil = 0;
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
      // hanging at AvA's grip: up onto her top
      const z = this.size, dr = this.scene.drone, top = L.point && dr ? { x: dr.x, feet: dr.platformTop() } : { x: L.x + L.dir * (z.w / 2 + 4), feet: L.y };
      if (this.scene.rectFree(top.x - z.w / 2 + 2, top.feet - z.crouchH, z.w - 4, z.crouchH - 2)) return this.startMantle(time, top);
    }
    // ↓ once = dangle from one arm, ↓ again = let go (Daniel, 12.11.2026)
    if (input.down.pressed) {
      if (!this.oneArm && this.m.oneArmTap !== false && this.d.look?.hangOne) this.oneArm = true;
      else this.leaveHang(time);
    }
  }
  leaveHang(time) { this.oneArm = false; this.state = 'normal'; this.body.allowGravity = true; this.ledge = null; this.noGrabUntil = time + 300; }
  startMantle(time, top, q0 = 0, dur = null) {
    this.state = 'mantle'; this.mantleAt = time; this.mantleQ0 = q0; this.mantleDur = dur ?? (this.m.mantleTime ?? 450);
    this.mantleFrom = { x: this.x, feet: this.feet }; this.mantleTo = top;
    this.body.checkCollision.none = true; this.body.setVelocity(0, 0);
    if (!dur) this.vault = null;
  }
  // vault: how high she already is decides where the pull-up starts (q0) and how long the rest takes; the run speed is kept for afterwards
  startVault(time, L, rise, top) {
    const z = this.size, m = this.m, q0 = Math.max(0, Math.min(0.9, rise / z.hangReach));
    this.facing = L.dir; this.ledge = null; this.body.allowGravity = false; this.setStanding();
    this.vault = { dir: L.dir, speed: Math.max(Math.abs(this.body.velocity.x), m.walkSpeed ?? 240) };
    this.airJumps = this.maxAirJumps; this.airDash = this.canAirDash; this.cut = false; this.flipUntil = 0;
    this.startMantle(time, top, q0, Math.max(80, (m.vaultTime ?? 300) * (1 - q0) / 0.42));
  }
  mantleP(time) { return Math.min(1, (time - this.mantleAt) / (this.mantleDur ?? this.m.mantleTime ?? 450)); }
  mantle(time, dir = 0) {
    this.body.setVelocity(0, 0);
    if (this.mantleP(time) < 1) return;
    const t = this.mantleTo, b = this.body;
    b.checkCollision.none = false; b.allowGravity = true; this.ledge = null;
    // after a vault with the direction still held: straight on running (round movement), no crouch in between
    const V = this.vault; this.vault = null;
    if (V && dir === V.dir && this.scene.rectFree(t.x - this.size.w / 2 + 2, t.feet - this.size.h, this.size.w - 4, this.size.h - 2)) {
      this.setStanding(); b.reset(t.x, t.feet - this.size.h / 2); b.setVelocityX(dir * V.speed);
      this.state = 'normal'; this.squash = { x: 1.06, y: 0.94 }; this.lastGround = time;
      return;
    }
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

  // ---------- hard landing (after a long jump or deep fall) ----------
  startLand(time) {
    this.state = 'land'; this.landAt = time; this.flipUntil = 0;
    this.scene.fx.dust(this.x, this.feet, 16);
    this.scene.cam?.shake?.(120, 0.004);
  }
  landP(time) { return Math.min(1, (time - this.landAt) / (this.m.landTime ?? 450)); }
  landing(time, s, input, dir) {
    const b = this.body, p = this.landP(time);
    b.setVelocityX(b.velocity.x * Math.pow(0.0005, s));   // skids to a stop
    if (p >= (this.m.landCancel ?? 55) / 100 && (dir || input.jump.pressed || input.dash.pressed)) {
      this.state = 'normal';
      if (input.jump.pressed) this.jump(1); else if (input.dash.pressed && time >= this.dashReady) this.startDash(time, dir);
      return;
    }
    if (p >= 1) this.state = 'normal';
  }

  // ---------- braking (from a run): the front foot plants, she skids with dust, then stands ----------
  startBrake(time) {
    this.state = 'brake'; this.brakeAt = time; this.brakeV = this.body.velocity.x;
    this.facing = Math.sign(this.brakeV) || this.facing;
    this.scene.fx.dust(this.x + this.facing * this.size.w / 2, this.feet, 2);   // the animation brings its own dust
  }
  brakeP(time) { return Math.min(1, (time - this.brakeAt) / (this.d.brake?.time ?? 650)); }
  braking(time, s, input, dir, grounded) {
    const B = this.d.brake || {}, p = this.brakeP(time), slide = Math.max(0.05, (B.slide ?? 55) / 100);
    // speed falls off evenly over the skid part, then she stands
    this.body.setVelocityX(this.brakeV * Math.max(0, 1 - p / slide));
    const free = input.jump.pressed || input.dash.pressed || (dir && (dir !== this.facing || p >= (B.cancel ?? 40) / 100));
    if (!grounded || free) {
      this.state = 'normal';
      if (input.jump.pressed && grounded) this.jump(1); else if (input.dash.pressed && time >= this.dashReady) this.startDash(time, dir);
      return;
    }
    if (p >= 1) { this.state = 'normal'; this.body.setVelocityX(0); }
  }
}

// Leyla: controller (states, physics feel) and look (sprite + code effects).
// All numbers come from the game data (area "Leyla"); only feel constants that are not game design live here.
//
// States: normal (ground/air) · dash · slide · climb · swing · hang (ledge) · mantle (pull up) · crouch (also standing up) · land (hard landing) · brake (stopping from a run) · dead
// Look: per state the asset from leyla.look.<state>, otherwise look.idle. Missing animations are covered by
// code effects (squash & stretch, lean, afterimages, blinking), new animations plug in without code changes.

// collider at 256 px look height; everything scales with the height of look.idle (Assets › „Höhe im Spiel“)
// hangReach: hands above the feet while hanging; mantleLift: how far the last pull-up frame lifts the feet inside the picture
import { recoilTexture } from './recoil.js';
import { makeSfx } from './sfx.js';

const BASE = { height: 256, w: 72, h: 224, slideH: 104, crouchH: 196, climbW: 44, hand: 84, chest: 150, hangReach: 253, mantleLift: 120 };
const DASH_TIME = 170, TERMINAL_FALL = 1700;
const approach = (v, target, step) => v < target ? Math.min(target, v + step) : Math.max(target, v - step);

export class Leyla {
  // Leyla's data, with the poses of the ranged weapon in her hand laid over her own looks (Waffen › Posen, Daniel, 12.11.2026:
  // „Sturmgewehr als Grundlage für weitere Waffenvarianten“); without poses: her own data
  get d() {
    const w = this.scene.weapon?.('ranged'), P = w?.poses;
    if (!P) return this.base;
    if (this.posesOf !== w) {
      this.posesOf = w;
      const look = { ...this.base.look }, armed = { ...this.base.armed };
      for (const [k, v] of Object.entries(P)) if (typeof v === 'string' && v && this.scene.textures.exists(v)) look[k] = v;
      if (P.muzzle) armed.muzzle = P.muzzle;
      if (P.muzzleRun) armed.muzzleRun = P.muzzleRun;
      this.posed = { ...this.base, look, armed };
    }
    return this.posed;
  }
  constructor(scene, data, feet) {
    this.scene = scene;
    this.base = data.leyla;
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
    this.health = this.maxHealth;
    this.loadWeapon();
    this.airJumps = this.m.airJumps ?? 0;
    this.airDash = true;
    this.lastGround = -1e9; this.jumpAt = -1e9; this.dashReady = 0; this.dropUntil = 0; this.noGrabUntil = 0;
    this.ledge = null; this.body.checkCollision.none = false;
    this.meleeReady = 0; this.rangedReady = 0; this.invulnerableUntil = 0; this.attackPose = 0;
    this.squash = { x: 1, y: 1 };
    this.fight = { on: false, manual: null, last: -1e9, seen: false, check: 0 };   // combat mode (Leyla › Kampfmodus)
    this.armedLost = -1e9; this.armed = 'off';
    this.sprite.setAlpha(1).setRotation(0).clearTint();
  }

  get maxHealth() { return (this.d.health ?? 100) + (this.scene.mods?.health || 0); }
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
    if (grounded && time - (this.leapAt ?? -1e9) > 80) this.leapAt = -1e9;   // landed: the next fall without a jump does not grab on its own
    // airtime of a normal jump/fall: highest point and start, for the hard landing
    if (this.state === 'normal' && !grounded) {
      if (!this.air) this.air = { x: this.x, peak: this.feet };
      this.air.peak = Math.min(this.air.peak, this.feet);
    } else if (this.state !== 'normal') this.air = null;
    if (grounded) {
      if (!this.wasGrounded && this.state === 'normal' && this.air) {
        const drop = this.feet - this.air.peak, dist = Math.abs(this.x - this.air.x);
        if (this.d.look?.land && (drop >= (m.landMinDrop ?? 384) || dist >= (m.landMinDistance ?? 640))) this.startLand(time);
        else if (this.lastVy > 500) this.land(this.lastVy);
      }
      this.air = null;
      this.lastGround = time; this.airJumps = m.airJumps ?? 0; this.airDash = true; this.flipUntil = 0;
    }
    if (input.jump.pressed) this.jumpAt = time;
    const dir = (input.right.down ? 1 : 0) - (input.left.down ? 1 : 0);
    this.dirHeld = dir; this.walkHeld = !!input.walk.down;   // for the look: running intent, pushing against a wall

    if (this.hitAnim) {   // the hit reaction runs out, or running / jumping / dash breaks it off after "Abbrechen ab"
      const h = this.hitAnim, p = (time - h.at) / h.dur;
      if (p >= 1 || this.state !== 'normal' || (p >= (this.d.hit?.cancelAfter ?? 50) / 100 && (dir || input.jump.pressed || input.dash.pressed || input.melee.pressed || input.ranged.pressed))) this.hitAnim = null;
    }
    switch (this.state) {
      case 'normal': this.normal(time, s, input, dir, grounded); break;
      case 'dash': this.dash(time, input); break;
      case 'slide': this.slide(time, input, grounded); break;
      case 'climb': this.climb(time, input, dir, grounded); break;
      case 'swing': this.swing(time, s, input, dir); break;
      case 'hang': this.hang(time, input, dir); break;
      case 'mantle': this.mantle(time, dir); break;
      case 'crouch': this.crouch(time, dt, input, dir, grounded); break;
      case 'sit': this.sitting(time, input, dir); break;
      case 'pose': this.posing(time, input, dir); break;
      case 'land': this.landing(time, s, input, dir); break;
      case 'brake': this.braking(time, s, input, dir, grounded); break;
      case 'dead': b.setVelocityX(b.velocity.x * 0.9); break;
    }
    this.comboFx(time);
    if (this.alive && !['climb', 'hang', 'mantle'].includes(this.state)) {
      this.meleeInput(time, input, grounded);
      // shooting only on the ground with the gun drawn (Daniel: no shooting in a jump); empty magazine = reload
      const gun = !!this.d.look?.aim && this.d.armed?.enabled !== false, AR = this.d.armed || {};
      // Quick Draw (Daniel, 12.11.2026, 1b): Y / K always shoots right away; with the gun away she draws it from the hip in the same move
      // (Leyla › Waffe ziehen › Quick Draw dauert) and the shot follows by itself. Holding Y / K with the gun out holsters it (Wegstecken: halten).
      if (input.ranged.pressed && gun) {
        this.rangedPress = { at: time, wasOut: this.armed === 'on', done: false };
        this.fightTrigger(time);
        if (this.armed !== 'on' && AR.quickDraw !== false && this.state === 'normal' && grounded) {
          this.quickShot = time;   // updateArmed draws it within "Quick Draw dauert", then the shot goes off by itself
          this.quickDraw = Math.max(1, AR.quickDrawTime ?? 120);
        }
      }
      if (this.rangedPress && !input.ranged.down) this.rangedPress = null;
      const hold = this.d.fight?.holdToHolster ?? 500;
      if (gun && this.rangedPress?.wasOut && !this.rangedPress.done && hold > 0 && time - this.rangedPress.at >= hold && this.fight) {
        this.rangedPress.done = true; this.fight.on = false; this.fight.manual = 'off'; this.quickShot = null;
      }
      const canShoot = this.state === 'normal' && grounded && !this.reloading && (!gun || this.armed === 'on');
      const quickNow = this.quickShot != null && this.armed === 'on' && time - this.quickShot < 600;   // the drawn-from-the-hip shot
      if (this.quickShot != null && (time - this.quickShot >= 600 || !grounded)) this.quickShot = null;
      if ((input.ranged.pressed || quickNow) && time >= this.rangedReady && canShoot) { this.quickShot = null; if (this.mag <= 0 && this.ammo > 0) this.startReload(time); else this.scene.combat.shoot(this, time); }
      if (input.reload?.pressed && canShoot) this.startReload(time);
    }
    this.updateReload(time);
    this.updateFight(time, input);
    if (time < (this.flipUntil || 0) && m.airJumpGhosts && time >= (this.nextGhost || 0)) { this.scene.fx.ghost(this.sprite); this.nextGhost = time + 28; }
    this.wasGrounded = grounded;
    this.lastVy = b.velocity.y;
    this.look(time, dt, grounded);
  }

  normal(time, s, input, dir, grounded) {
    const b = this.body, m = this.m;
    if (input.pose?.pressed && grounded && !dir && Math.abs(b.velocity.x) <= 20 && this.d.look?.yoga && !this.attack && !this.charging) { this.startPose(time); return; }
    if (dir && time > this.attackPose) this.facing = dir;
    const gunRun = !input.walk.down && this.armed === 'on' && this.gunRunning(b.velocity, true) ? (this.scene.shootRules().runSpeed ?? 85) / 100 : 1;   // Cells-like: a bit slower with the gun out
    const speed = (input.walk.down ? (m.walkSpeed ?? 240) : (m.runSpeed ?? 440) * gunRun) * (1 + (this.scene.mods?.speed || 0) / 100);   // gear, implants, buffs
    let acc = (m.acceleration ?? 2800) * (grounded ? (dir ? 1 : 1.6) : 0.75);
    // keep momentum in the air (rope, knockback) while pushing the same way
    if (!grounded && Math.abs(b.velocity.x) > speed && Math.sign(b.velocity.x) === dir) acc *= 0.15;
    // braking (Leyla › Bremsen, Daniel 08.11.2026): let go of the direction after a real run on the ground → she skids to a stop
    const B = this.d.brake || {}, fast = grounded && Math.abs(b.velocity.x) >= (m.runSpeed ?? 440) * (B.minSpeed ?? 85) / 100 && !input.walk.down;
    if (fast) this.runSince ??= time; else if (dir || !grounded) this.runSince = null;
    if (!dir && grounded && this.runSince != null && B.enabled !== false && this.d.look?.brake && !this.attack && !this.charging && time - this.runSince >= (B.minRun ?? 350)
      && Math.abs(b.velocity.x) >= (m.runSpeed ?? 440) * (B.minSpeed ?? 85) / 100) { this.runSince = null; return this.startBrake(time); }
    if (!fast && !dir) this.runSince = null;
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
    // too high for hanging (Daniel, 11.11.2026: „ab einem Schwellwert nimmt Leyla die Kante parkourmäßig“): she vaults straight up and over,
    // the first pull-up frames are skipped and she keeps her run (Leyla › Kanten & Ducken › Schwung ab)
    // easier (Daniel, 12.11.2026: „es ist zu fummelig, an eine Kante zu springen“): the hands also catch an edge a bit above them (Greifen nach oben),
    // the edge may be a little away from her side (Greifen zur Seite, she is pulled over), already while still rising a bit (Greifen im Steigen),
    // and without a direction held she grabs what she flies or looks towards (Greifen ohne Richtung); ↓ held never grabs
    const leapt = time - (this.leapAt ?? -1e9) < 1200;   // only after a jump of her own, never when dropping through a platform or falling off
    const gdir = dir || (m.ledgeAuto !== false && leapt ? (Math.abs(b.velocity.x) > 60 ? Math.sign(b.velocity.x) : this.facing) : 0);
    if (!grounded && gdir && !input.down.down && m.ledgeGrab !== false && time >= this.noGrabUntil && b.velocity.y > -(m.ledgeRising ?? 450)) {
      const z = this.size, hy = this.hand().y, reach = m.ledgeReach ?? 56, up = m.ledgeUp ?? 40, k = z.h / 168;
      const vaultOn = m.vault !== false, low = vaultOn ? Math.max(reach, this.feet - hy - 10) : reach;
      const L = this.scene.ledgeAt(this.x, hy, gdir, low, z.w / 2, up, m.ledgeSide ?? 24);
      if (L) {
        const rise = L.y + z.hangReach - this.feet, top = { x: L.x + L.dir * (z.w / 2 + 4), feet: L.y };
        if (vaultOn && rise >= (m.vaultFrom ?? 110) * k && this.scene.rectFree(top.x - z.w / 2 + 2, top.feet - z.crouchH, z.w - 4, z.crouchH - 2)) return this.startVault(time, L, rise, top);
        if (L.y - hy <= reach && this.hangFits(L)) return this.startHang(L);
        // AvA low over the ground (no room to hang below her): Leyla climbs straight up onto her
        if (L.drone && this.scene.rectFree(top.x - z.w / 2 + 2, top.feet - z.crouchH, z.w - 4, z.crouchH - 2)) return this.startVault(time, L, Math.max(0, rise), top);
      }
    }
    // crouch: ↓ while standing (fast = slide, see above)
    if (grounded && input.down.down && !dir && !input.jump.down && Math.abs(b.velocity.x) <= (m.walkSpeed ?? 240) * 0.8) return this.startCrouch();   // not while a direction is held (after a slide with ↓ + → she simply runs on)
  }

  jump(f) {
    this.body.setVelocityY(-(this.m.jumpVelocity ?? 1100) * f);
    this.jumpAt = -1e9; this.cut = true; this.leapAt = this.scene.now ?? 0;
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
      // direction still held: run on at full pace (Daniel, 11.11.2026: one frame standing still after the slide looked like a stutter)
      const dir = (input.right.down ? 1 : 0) - (input.left.down ? 1 : 0);
      if (dir === this.facing && grounded) b.setVelocityX(this.facing * (this.m.runSpeed ?? 440));
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
    this.oneArm = !!L.drone && this.m.droneOneArm !== false && !!this.d.look?.hangOne;   // at AvA: dangling from one arm (Daniel, 12.11.2026)
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
    this.airJumps = m.airJumps ?? 0; this.airDash = true; this.cut = false; this.flipUntil = 0;
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

  // ---------- damage ----------
  hurt(time, damage, fromX) {
    if (!this.alive || this.invulnerable(time)) return false;
    this.health = Math.max(0, this.health - damage * (1 - Math.min(90, this.scene.mods?.defense || 0) / 100));
    this.invulnerableUntil = time + (this.d.invulnerableAfterHit ?? 600);
    this.fightTrigger(time, true);
    const low = this.state === 'slide' && !this.canStand();   // hit in a tunnel: stay low
    if (this.state === 'slide' && !low) this.endSlide();
    if (this.state === 'climb') this.leaveClimb();
    if (this.state === 'swing') this.releaseSwing(false);
    if (this.state === 'dash') this.endDash();
    if (this.state === 'hang' || this.state === 'mantle') { this.body.checkCollision.none = false; this.setStanding(); this.leaveHang(time); }
    if (this.state === 'crouch') this.endCrouch();
    if (this.state === 'land' || this.state === 'brake') this.state = 'normal';
    const away = Math.sign(this.x - fromX) || -this.facing;
    // the damage sets how hard it hits (Leyla › Treffer › „Volle Wucht bei“): 0.5 (a scratch) … 1.5 (a big hit)
    const H = this.d.hit || {}, k = Math.max(0.5, Math.min(1.5, damage / Math.max(1, H.fullAt ?? 15))), kick = H.scale === false ? 1 : 0.75 + 0.25 * k;
    this.body.setVelocity(away * 520 * kick, low ? 0 : -420 * kick);
    if (low) this.facing = away;
    // hit reaction (Leyla › Treffer, Daniel 11.11.2026): light or heavy animation, effects from code (white flash, then red)
    const heavy = damage >= (H.heavyFrom ?? 12) && this.d.look?.hitHeavy, look = heavy ? this.d.look.hitHeavy : this.d.look?.hit;
    if (look && this.scene.textures.exists(look) && H.enabled !== false) {
      this.hitAnim = { at: time, look, heavy: !!heavy, k, dur: (heavy ? H.heavyTime ?? 520 : H.time ?? 360) * (H.scale === false ? 1 : 0.8 + 0.2 * k) };
      this.attack = null; this.charging = null; this.special = null;
    }
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(H.flash ?? 50, () => { if (this.alive) { this.sprite.setTintFill(0xff4060); this.scene.time.delayedCall(70, () => this.sprite.clearTint()); } });
    this.scene.fx.impact?.(this.x - away * this.size.w * 0.4, this.chest, away, heavy, H.scale === false ? 1 : k);
    if (H.hitstop !== 0) this.scene.hitstop(time, (H.hitstop ?? 60) * (heavy ? 1.6 : 1) * (H.scale === false ? 1 : k));
    if (this.health <= 0) { this.hitAnim = null; this.die(); }
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
    // smooth look (animation audit 11.11.2026): a frame in the air right after a dash or a step down counts as ground,
    // pushing against a wall is standing, and holding a direction runs from the first step (no walk cycle that restarts as a run)
    const b0 = b.blocked, wall = (v.x > 0 && (b0.right || b.touching.right)) || (v.x < 0 && (b0.left || b.touching.left));
    const speed = wall ? 0 : Math.abs(v.x), held = this.dirHeld && !wall && st === 'normal';
    const z0 = this.size, near = Math.abs(v.y) < 150 && (!this.scene.rectFree(this.x - z0.w / 2 + 2, this.feet + 1, z0.w - 4, 8) || this.scene.onPlatform(this.x, this.feet + 6));
    const onGround = grounded || near || (time - (this.lastGround ?? -1e9) < 90 && Math.abs(v.y) < 150);
    let name = st === 'dead' ? 'hurt' : st === 'normal' ? (!onGround ? (time < (this.flipUntil || 0) ? 'airJump' : v.y < 0 ? 'jump' : 'fall')
      : speed > 300 || (held && !this.walkHeld) ? 'run' : speed > 20 || held ? 'walk' : 'idle') : st === 'swing' ? 'jump' : st;
    this.updateArmed(time, dt, grounded);
    // (3) no standing frame without real stillness: right after walking or running she keeps the step a moment (Leyla › Übergänge › Stehen erst nach)
    // (after a jump the last air frame stays for a moment too, so a quick hop again does not flash a standing frame)
    const air = name === 'jump' || name === 'fall' || name === 'airJump';
    if (st === 'normal' && (name === 'walk' || name === 'run' || air)) { this.movedAt = time; this.movedLook = name; this.movedAir = air; }
    else if (name === 'idle' && st === 'normal' && time - (this.movedAt ?? -1e9) < (this.movedAir ? (this.d.transition?.idleAfterAir ?? 60) : (this.d.transition?.idleAfter ?? 90))) name = this.movedLook;
    this.idleNow = name === 'idle' && this.armed === 'off';
    if (name === 'idle' && this.idleVariant === 'idleAlt' && this.d.look?.idleAlt) name = 'idleAlt';
    // random idles after standing still for a while (Leyla › Zufällige Idles); sitting does not count
    if (this.idleNow && st === 'normal') {
      this.stillSince ??= time; this.idleWait ??= this.rollIdleWait();
      if (!this.special && time - this.stillSince > this.idleWait) this.special = this.pickIdle();
      if (this.special) name = '@' + this.special;
    } else { this.stillSince = time; this.special = null; this.idleWait = this.rollIdleWait(); }
    if (st === 'hang' && this.oneArm) name = 'hangOne';
    if (st === 'sit') name = '@' + this.sit.look;
    if (st === 'pose') name = '@' + this.d.look.yoga;
    // standing at a workshop in the rig: seen from behind, busy with her hands
    if (this.idleNow && (this.scene.camp?.atWorkshop || this.scene.hud?.build?.working) && this.d.look?.work) { name = '@' + this.d.look.work; this.special = null; }
    // gun drawn (Leyla › Waffe ziehen): drawing, then aiming, walking with the gun, shooting
    const L = this.d.look || {}, walking = speed > 20;   // against a wall: standing
    let armedFrame = null, armedFrom = 1;
    // drawing: the draw animation (from "Ziehen ab Frame"), then stretching the arms out (aim), then that pose is held
    const onRun = this.gunRunning(v) && this.runLook('runReady');
    if ((this.armed === 'drawing' || this.armed === 'holstering') && onRun) {
      // on the run: hand to the holster, then the gun at the chest (holstering the other way round), the legs keep their step
      name = '@' + (this.drawP < 0.5 && this.runLook('runDraw') ? L.runDraw : L.runReady);
    } else if (this.armed === 'drawing' || this.armed === 'holstering') {
      // drawing ends with the gun at the chest (Daniel: arms only stretch out to shoot); holstering plays it backwards
      if (L.draw) { name = '@' + L.draw; armedFrame = this.drawP; armedFrom = this.d.armed?.drawFromFrame ?? 1; }
    } else if (this.armed === 'on') {
      const AR = this.d.armed || {}, ext = AR.extendTime ?? 100, hold = AR.aimHold ?? 900, lower = AR.lowerTime ?? 220;
      const since = time - (this.shotAt ?? -1e9), extending = this.extendAt != null && time - this.extendAt < ext;
      const shot = L.shoot && !extending && since < (this.extendAt != null && this.extendAt === this.shotAt ? ext : 0) + this.lookDur(walking && L.shootWalk ? L.shootWalk : L.shoot);
      const out = time - (this.aimUntil ?? -1e9);   // < 0: arms still stretched out after shooting / reloading, then they come down
      const running = this.gunRunning(v);
      // at a wall (Daniel, 12.11.2026: „Kombi“): the stretched-out gun would poke into it, so it stays at the chest; shots spark on the wall
      this.gunWall = !running && !!this.scene.combat?.muzzleBlocked(this);
      // Cells-like on the run (Daniel, 11.11.2026): shooting = arms out, otherwise the gun at the chest, reloading in two halves
      if (running) {
        const RL = this.reloading && (time - this.reloading.at) / this.reloading.dur;
        name = '@' + (this.reloading && this.runLook('runReload') ? (RL < 0.5 || !this.runLook('runReload2') ? L.runReload : L.runReload2)
          : since < hold || !onRun ? L.runGun : L.runReady);
      }
      else if (this.reloading && (L.reload || L.reloadWalk)) { name = '@' + (walking && L.reloadWalk ? L.reloadWalk : L.reload || L.reloadWalk); armedFrame = Math.min(1, (time - this.reloading.at) / this.reloading.dur); this.aimUntil = this.reloading.at + this.reloading.dur + hold; }
      else if (this.gunWall && L.draw) { name = '@' + L.draw; armedFrame = 1; armedFrom = AR.drawFromFrame ?? 1; }
      else if (extending && L.aim) { name = '@' + L.aim; armedFrame = (time - this.extendAt) / ext; }   // gun from the chest up into the aim, then the shot
      else if (shot) { name = '@' + (walking && L.shootWalk ? L.shootWalk : L.shoot); this.aimUntil = time + hold; }
      else if (walking && L.aimWalk) name = '@' + L.aimWalk;
      else if (out < 0 && L.aim) { name = '@' + L.aim; armedFrame = 1; }
      else if (out < lower && L.aim) { name = '@' + L.aim; armedFrame = 1 - out / lower; }
      else if (L.draw) { name = '@' + L.draw; armedFrame = 1; armedFrom = AR.drawFromFrame ?? 1; }   // ready: gun at the chest
      else { name = '@' + (L.aim || L.idle); armedFrame = 1; }
      if (shot && !running && !this.gunWall && this.shotSeen !== this.shotAt) { this.shotSeen = this.shotAt; this.restartLook = true; }
    }
    // melee: the attack runs over its time (frames from "ab Frame"), charging holds the crouch loop of the heavy attack
    let pin = null;
    if (this.attack && st === 'normal') { const a = this.attack; name = '@' + a.look; armedFrame = Math.min(1, (time - a.at) / a.dur); armedFrom = a.from; }
    else if (this.charging && st === 'normal' && grounded && !walking && L.meleeHeavy) {
      const [c0, c1] = this.d.melee?.chargeLoop || [3, 10], t = time - this.charging.at - (this.d.melee?.chargeAfter ?? 250), n0 = Math.max(1, c0 - 1);
      name = '@' + L.meleeHeavy;
      pin = t < n0 * 60 ? Math.floor(t / 60) : c0 - 1 + Math.floor((t - n0 * 60) / 110) % Math.max(1, c1 - c0 + 1);   // into the crouch, then the charging loop
    }
    // hit reaction: snap into the pose within "Treffer sitzt nach" frames, then recover to standing over the rest of the time
    if (this.hitAnim && st === 'normal') {
      const h = this.hitAnim, a = this.scene.data_.assets?.[h.look], n = a?.frames || 1, H = this.d.hit || {};
      const inN = Math.min(n - 1, H.inFrames ?? 3), inT = H.inTime ?? 70, t = time - h.at;
      const f = t < inT ? Math.floor(t / inT * inN) : inN + Math.floor((t - inT) / Math.max(1, h.dur - inT) * (n - inN));
      name = '@' + h.look; armedFrom = 1; armedFrame = Math.min(1, Math.min(n - 1, f) / Math.max(1, n - 1)); pin = null;
    }
    // mantle and crouch pick their frame from the progress (crouch backwards = standing up)
    const flipFrames = name === 'airJump' && (this.m.airJumpFromFrame ?? 1) > 1;
    const climbFrames = st === 'climb' && (this.m.climbFromFrame ?? 1) > 0;
    const manual = st === 'mantle' || st === 'crouch' || st === 'dash' || st === 'land' || st === 'brake' || st === 'sit' || st === 'pose' || flipFrames || climbFrames, an0 = this.sprite.anims;
    if (!manual && armedFrame == null && pin == null && st !== 'slide' && an0.isPaused) an0.resume();
    // the run and its variants (gun out, at the chest, drawing, reloading) share the step: switching keeps the frame, so the legs never jump
    // transitions (Daniel, 11.11.2026, 2A): (1) families with the same step keep their place in the cycle (run and its variants,
    // walk with and without the gun), (2) Leyla › Übergänge names exceptions: from → to starts at a given frame
    const A = this.scene.data_.assets || {}, aa = this.sprite.anims, prevKey = aa.currentAnim?.key?.split('@')[0], prevIdx = aa.currentFrame ? aa.currentFrame.index - 1 : 0;
    const want = name.startsWith('@') ? name.slice(1) : L[name] || null, base = id => [id, A[id]?.mirror].filter(Boolean);
    let keep = null;
    const row = want && prevKey && prevKey !== want && (this.d.transitions || []).find(r => r.from && r.to && base(r.from).includes(prevKey) && base(r.to).includes(want));
    if (row) keep = Math.max(0, (row.frame || 1) - 1);
    else if (want && !aa.isPaused) for (const fam of this.families()) if (fam.has(prevKey) && fam.has(want)) {
      const n0 = A[prevKey]?.frames || 1, n1 = A[want]?.frames || 1;
      keep = n0 === n1 ? prevIdx : Math.round(prevIdx / n0 * n1) % n1;   // same share of the cycle
      break;
    }
    const info = this.scene.playLook(this.sprite, 'leyla', name, st === 'pose' ? 1 : this.facing, keep);   // the yoga pose is seen from the front: never mirrored
    if (this.restartLook && an0.currentAnim) { this.restartLook = false; an0.restart(); }
    if (pin != null && info.used === name && an0.currentAnim) {
      const fr = an0.currentAnim.frames;
      if (!an0.isPaused) an0.pause();
      this.sprite.setFrame(fr[Math.max(0, Math.min(fr.length - 1, pin))].frame.name);
      if (this.charging?.ready) this.sprite.setTint(Math.floor(time / 90) % 2 ? 0xffffff : 0xffe0a0); else this.sprite.clearTint();
    } else if (armedFrame != null && info.used === name && an0.currentAnim) {
      const fr = an0.currentAnim.frames, from = Math.min(fr.length - 1, Math.max(0, armedFrom - 1));
      if (!an0.isPaused) an0.pause();
      this.sprite.setFrame(fr[Math.round(from + (fr.length - 1 - from) * Math.min(1, armedFrame))].frame.name);
    } else if (st === 'pose' && info.used === name && an0.currentAnim) {
      const fr = an0.currentAnim.frames;
      if (!an0.isPaused) an0.pause();
      this.sprite.setFrame(fr[Math.max(0, Math.min(fr.length - 1, this.poseFrame(time)))].frame.name);
    } else if (st === 'sit' && info.used === name && an0.currentAnim) {
      const fr = an0.currentAnim.frames;
      if (!an0.isPaused) an0.pause();
      this.sprite.setFrame(fr[Math.max(0, Math.min(fr.length - 1, this.sitFrame(time)))].frame.name);
    } else if (manual && (info.used === st || (flipFrames && info.used === 'airJump')) && an0.currentAnim) {
      const fr = an0.currentAnim.frames, n = fr.length;
      const from = st === 'mantle' ? Math.min(n - 1, Math.max(0, (this.m.mantleFromFrame ?? 5) - 1)) : 0;
      const dashFrom = Math.min(n - 1, Math.max(0, (this.m.dashFromFrame ?? 1) - 1)), dashP = Math.min(1, 1 - (this.dashEnd - time) / DASH_TIME);
      const flipFrom = Math.min(n - 1, Math.max(0, (this.m.airJumpFromFrame ?? 1) - 1)), flipP = Math.min(1, (time - this.flipAt) / Math.max(1, this.flipLen));
      const climbFrom = Math.min(n - 1, Math.max(0, (this.m.climbFromFrame ?? 1) - 1)), climbN = Math.max(1, n - climbFrom);
      const landFrom = Math.min(n - 1, Math.max(0, (this.m.landFromFrame ?? 4) - 1));
      const brakeFrom = Math.min(n - 1, Math.max(0, (this.d.brake?.fromFrame ?? 2) - 1));
      const f = st === 'land' ? Math.round(landFrom + (n - 1 - landFrom) * this.landP(time)) : st === 'brake' ? Math.min(n - 1, brakeFrom + Math.floor((n - brakeFrom) * this.brakeP(time))) : climbFrames ? climbFrom + Math.floor((this.climbDist || 0) / Math.max(1, this.m.climbStep ?? 24)) % climbN : flipFrames ? Math.round(flipFrom + (n - 1 - flipFrom) * flipP) : st === 'mantle' ? Math.round(from + (n - 1 - from) * ((this.mantleQ0 || 0) + (1 - (this.mantleQ0 || 0)) * this.mantleP(time))) : st === 'dash' ? Math.round(dashFrom + (n - 1 - dashFrom) * dashP) : Math.round(Math.min(n - 1, this.crouchF || 0));
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
    const pace = { run: this.m.runSpeed || 440, walk: this.m.walkSpeed || 240 }[info.used] ?? (info.used?.startsWith('@') && this.runFamily().has(info.used.slice(1)) ? (this.m.runSpeed || 440) * (this.scene.shootRules().runSpeed ?? 85) / 100 : null);
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
    if (name === 'airJump' && this.m.airJumpTilt) rot = this.facing * Math.max(-0.6, Math.min(0.6, Math.atan2(v.y, Math.max(Math.abs(v.x), 400)))) * this.m.airJumpTilt / 100;   // pose leans into the jump
    if (time < this.attackPose && st === 'normal') rot += this.facing * 0.1;
    if (st === 'dead') { this.deadRot = (this.deadRot || 0) + (this.facing * -1.45 - (this.deadRot || 0)) * k; rot = this.deadRot; } else this.deadRot = 0;
    this.sprite.setPosition(b.center.x, b.bottom).setRotation(rot);
    if (st === 'mantle') {   // the picture lifts the feet itself, so the anchor only rises the rest of the way
      const p = this.mantleP(time), F = this.mantleFrom, T = this.mantleTo, e = p * p * (3 - 2 * p);
      const lift = info.used === 'mantle' ? this.size.mantleLift : 0, q0 = this.mantleQ0 || 0, l0 = lift * q0;   // a vault starts mid-pull-up: the picture already lifts the feet a bit
      const ex = Math.max(0, Math.min(1, (p - 0.4 * (1 - q0)) / (1 - 0.4 * (1 - q0))));
      this.sprite.setPosition(F.x + (T.x - F.x) * ex * ex * (3 - 2 * ex), F.feet + l0 + (T.feet + lift - F.feet - l0) * e);
    }
    this.sprite.setScale(info.scale * sx, info.scale * sy);
    const flipped = info.flip ? this.facing > 0 : this.facing < 0;
    this.sprite.setFlipX(flipped).setOrigin(flipped ? 1 - info.ox : info.ox, info.oy);   // Phaser mirrors inside the frame: the anchor has to mirror too
    if (st !== 'dead') this.sprite.setAlpha(time < this.invulnerableUntil && Math.floor(time / 70) % 2 ? 0.35 : 1);
    this.recoil(time);
  }

  // ---------- melee (Daniel, 07.11.2026 spät): tap = light hit, standing or walking; holding = heavy hit when released ----------
  // Kombo (Daniel, 11.11.2026: „1c; b … der fünfte ein direkt aufgesetzter Schuss … die ersten drei Hiebe immer random, aber nie doppelt“):
  // tapping J chains three hits drawn at random from Leyla › Kombo › Zufällige Hiebe (none twice), then the finisher; a tap during a hit is
  // kept and the next hit starts on its beat ("Takt bei"); taps within "Takt-Fenster" of the beat are perfect, four perfect taps = point-blank shot
  comboOn() { const C = this.d.combo || {}; return C.enabled !== false && (C.hits || []).some(h => h.look); }
  meleeInput(time, input, grounded) {
    const M = this.d.melee || {}, L = this.d.look || {}, C = this.d.combo || {}, b = this.body;
    if (this.attack) {
      const a = this.attack, p = (time - a.at) / a.dur;
      if (!a.hit && p >= a.hitAt) { a.hit = true; if (a.shot) this.scene.combat.pointBlank(this, time, a.shot); else this.scene.combat.melee(this, time, a.power); }
      if (a.nudge && grounded && time < a.nudge.until) b.setVelocityX(-this.facing * a.nudge.speed);   // at a wall: slide back so the pose fits
      else if (a.step && grounded && p < Math.min(1, a.hitAt + 0.1)) b.setVelocityX(this.facing * a.step * (1 - p / Math.max(0.01, a.hitAt + 0.1)));
      if (a.combo && input.melee.pressed && a.next == null && time >= a.at + 60) a.next = time;   // the tap waits for the beat
      const beatAt = a.at + a.dur * a.beat;
      if (a.combo && a.next != null && a.hit && time >= beatAt && this.state === 'normal' && grounded) { this.attack = null; this.comboNext(time, a.next, beatAt, grounded); return; }
      if (p >= 1 || this.state !== 'normal') {
        this.attack = null;
        if (a.combo && this.combo) { this.combo.beat = beatAt; this.combo.until = a.at + a.dur + (C.window ?? 350); }
      }
      return;
    }
    if (this.combo && (time > this.combo.until || this.state !== 'normal')) this.combo = null;
    // a late tap after the hit, still within the window
    if (this.combo && input.melee.pressed && grounded && this.state === 'normal') { this.comboNext(time, time, this.combo.beat, grounded); return; }
    if (input.melee.pressed && time >= this.meleeReady) {
      if (!grounded || this.state !== 'normal' || !(L.meleeLight || L.meleeHeavy)) { this.scene.combat.melee(this, time); return; }   // in the air: the quick code hit
      this.charging = { at: time, ready: false };
    }
    const c = this.charging;
    if (!c) return;
    if (this.state !== 'normal' || !grounded) { this.charging = null; this.sprite.clearTint(); this.chargeEffects(time, -1); return; }
    const held = time - c.at;
    if (!c.ready && held >= (M.chargeTime ?? 1000)) { c.ready = true; this.scene.fx.sparks(this.x, this.chest, 0xffd27a, 14); this.scene.drone?.react('alert'); }
    this.chargeEffects(time, held);
    if (input.melee.down) return;
    this.chargeEffects(time, -1);
    // released: heavy when charged, otherwise the first hit of the combo (or the light hit without combo); walking picks the walking version
    this.charging = null; this.sprite.clearTint();
    const walking = Math.abs(b.velocity.x) > 20, heavy = c.ready;
    if (!heavy && this.comboOn()) { this.combo = { n: 0, used: [], perfect: true, taps: [], beat: 0, until: 0 }; this.comboHit(time, walking); return; }
    this.combo = null;
    const look = heavy ? (walking ? L.meleeHeavyWalk || L.meleeHeavy : L.meleeHeavy) : (walking ? L.meleeLightWalk || L.meleeLight : L.meleeLight);
    if (!look) { this.scene.combat.melee(this, time); return; }
    const key = (heavy ? 'heavy' : 'light') + (walking ? 'Walk' : '');
    this.attack = { look, at: time, dur: M[key + 'Time'] ?? 450, hitAt: M[key + 'Hit'] ?? 0.4, from: M[key + 'From'] ?? (heavy && !walking ? 11 : 1), hit: false,
      power: heavy ? { damage: (M.heavyDamage ?? 250) / 100, range: M.heavyRange ?? 160, knockback: M.heavyKnockback ?? 220, heavy: true } : null };
    this.meleeReady = time + this.attack.dur;
    this.attackPose = time + this.attack.dur;   // keeps facing the way she strikes
    this.wallRoom(this.attack);
  }
  // strike poses reach further than her body (Daniel, 12.11.2026: „Hieb an der Wand: Leyla rutscht ein Stück zurück, damit die Pose passt“):
  // Leyla › Nahkampf › „An der Wand: Abstand“ = from her middle to the tip of the strike pose; with less room she slides back
  wallRoom(a) {
    const M = this.d.melee || {}, C = this.scene.combat, k = this.size.h / 168, need = (M.wallGap ?? 96) * k, dur = Math.max(30, M.wallSlide ?? 120);
    if (!C || M.wallGap === 0 || !a) return;
    let free = need;
    for (const q of [0.85, 0.6, 0.35]) free = Math.min(free, C.freeRun(this.x, this.feet - this.height * q, this.facing, need));
    if (free >= need) return;
    const back = Math.min(need - free, C.freeRun(this.x - this.facing * this.size.w / 2, this.feet - this.height * 0.5, -this.facing, need));
    a.step = 0;
    if (back > 2) a.nudge = { until: a.at + dur, speed: back / (dur / 1000), dist: Math.round(back) };
  }
  // the next tap of the combo: judge the beat, then hit 2–3 (random, none twice), the finisher, or with four perfect taps the shot
  comboNext(time, tapAt, beatAt, grounded) {
    const C = this.d.combo || {}, k = this.combo, walking = Math.abs(this.body.velocity.x) > 20;
    if (!k) return;
    const perfect = Math.abs(tapAt - beatAt) <= (C.perfect ?? 90);
    // forgiving (Daniel, 11.11.2026: „der fünfte ist zu schwer, insgesamt etwas verzeihender“): Kombo › Fehler erlaubt taps may miss the beat
    k.misses = (k.misses || 0) + (perfect ? 0 : 1); k.perfect = k.misses <= (C.misses ?? 1); k.taps.push(perfect); k.flash = { at: time, perfect };
    if (perfect) { this.sfx ??= makeSfx(this.scene, 0.22); this.sfx.tick?.(k.taps.length); }
    if (k.n < 3) return this.comboHit(time, walking);
    if (k.n === 3) return this.comboFinisher(time);
    const w = this.scene.weapon('ranged');
    if (k.n === 4 && k.perfect && C.shot !== false && w && this.mag > 0 && this.d.look?.shoot) return this.comboShot(time, w);
    this.combo = { n: 0, used: [], perfect: true, taps: [], beat: 0, until: 0 };   // after the finisher (or shot) a new tap starts over
    this.comboHit(time, walking);
  }
  startCombo(time, a) {
    this.attack = { hit: false, combo: true, at: time, next: null, ...a };
    this.wallRoom(this.attack);
    this.meleeReady = time + a.dur; this.attackPose = time + a.dur;
    this.combo.n++; this.combo.beat = time + a.dur * a.beat; this.combo.until = time + a.dur + ((this.d.combo || {}).window ?? 350);
  }
  comboHit(time, walking) {
    const C = this.d.combo || {}, rows = (C.hits || []).map((h, i) => ({ ...h, i })).filter(h => h.look), k = this.combo;
    let free = rows.filter(h => !k.used.includes(h.i));
    if (!free.length) free = rows.filter(h => h.i !== k.used[k.used.length - 1]);
    if (!free.length) free = rows;
    const h = free[Math.floor(Math.random() * free.length)];
    k.used.push(h.i);
    this.startCombo(time, { look: (walking && h.walk) || h.look, from: h.from ?? 1, dur: h.time ?? 420, hitAt: h.hit ?? 0.3, beat: h.beat ?? 0.7, step: h.step ?? 0, row: h.i, trail: !!h.trail, trailUp: !!h.trailUp,
      power: (h.damage ?? 100) !== 100 ? { damage: (h.damage ?? 100) / 100 } : null });
  }
  comboFinisher(time) {
    const C = this.d.combo || {}, M = this.d.melee || {}, L = this.d.look || {};
    const look = C.finisher || L.meleeHeavy;
    if (!look) { this.combo = null; return; }
    this.startCombo(time, { look, from: C.finisherFrom ?? M.heavyFrom ?? 11, dur: C.finisherTime ?? 650, hitAt: C.finisherHit ?? 0.3, beat: C.finisherBeat ?? 0.65, step: 160, finisher: true,
      power: { damage: (C.finisherDamage ?? 200) / 100, range: C.finisherRange ?? 120, knockback: C.finisherKnockback ?? 200, heavy: true } });
  }
  comboShot(time, w) {
    const C = this.d.combo || {};
    this.startCombo(time, { look: this.d.look.shoot, from: 1, dur: C.shotTime ?? 420, hitAt: 0.05, beat: 1, step: 0,
      shot: { damage: (w.damage ?? 10) * (C.shotDamage ?? 400) / 100, range: C.shotRange ?? 170, knockback: C.shotKnockback ?? 520 } });
    this.combo.until = time;   // the shot ends the combo
  }
  // the beat, quietly (Leyla › Kombo › Takt anzeigen): a small ring beside her head closes onto the beat, dots for the hits; a perfect tap flashes
  comboFx(time) {
    const C = this.d.combo || {}, a = this.attack?.combo ? this.attack : null, k = this.combo;
    const show = C.show !== false && this.alive && (a || (k && time <= k.until + 250) || (k?.flash && time - k.flash.at < 300));
    if (!show) { this.comboG?.clear().setVisible(false); return; }
    const s = this.scene, g = (this.comboG ??= s.add.graphics().setDepth(19)).clear().setVisible(true);
    const col = parseInt(String(C.color || '#7ff6ff').slice(1), 16), hot = parseInt(String(C.perfectColor || '#ffe27a').slice(1), 16);
    const x = this.x + this.facing * this.height * 0.1, y = this.feet - this.height * 1.14, r = 9;
    const beatAt = a ? a.at + a.dur * a.beat : k?.beat ?? 0, near = Math.abs(time - beatAt) <= (C.perfect ?? 90);
    const fade = a ? 1 : Math.max(0, 1 - (time - (k?.until ?? time) + 250) / 250 * 0.5);
    g.lineStyle(2, col, 0.32 * fade).strokeCircle(x, y, r);
    if (a && a.hit && !a.shot && !(k && k.n >= 4 && !(k.perfect && C.shot !== false))) {   // the approach circle closes onto the beat
      const span = Math.max(1, beatAt - (a.at + a.dur * a.hitAt)), q = Math.max(0, Math.min(1, (beatAt - time) / span));
      if (time <= beatAt + (C.perfect ?? 90)) g.lineStyle(2, near ? hot : col, (near ? 0.85 : 0.45) * fade).strokeCircle(x, y, r + 22 * q);
      if (near) g.fillStyle(hot, 0.7 * fade).fillCircle(x, y, 3.5);
    }
    // dots: one per hit, warm while the beat is kept, the fifth only shows while the shot is still possible
    const n = k?.n || 0, dots = k?.perfect && C.shot !== false ? 5 : 4;
    for (let i = 0; i < dots; i++) {
      const dx = x + (i - (dots - 1) / 2) * 9, dy = y + r + 10, on = i < n;
      g.fillStyle(on ? (k?.perfect ? hot : col) : 0xffffff, on ? 0.75 * fade : 0.16 * fade).fillCircle(dx, dy, i === 4 ? 2.6 : 2.1);
    }
    if (k?.flash && time - k.flash.at < 300) {
      const t = (time - k.flash.at) / 300;
      g.lineStyle(2, k.flash.perfect ? hot : 0x8b949e, (1 - t) * (k.flash.perfect ? 0.9 : 0.4)).strokeCircle(x, y, r + 4 + 18 * t);
    }
  }

  // charging: a glow grows round her, sparks are pulled in; when it is ready the glow turns hot and pulses (Leyla › Nahkampf › Aufladen-Licht)
  chargeEffects(time, held) {
    const s = this.scene, M = this.d.melee || {}, fx = s.fx;
    if (held < (M.chargeAfter ?? 250)) { this.chargeGlow?.destroy(); this.chargeGlow = null; return; }
    const p = Math.min(1, held / (M.chargeTime ?? 3000)), ready = this.charging?.ready, x = this.x, y = this.feet - this.height * 0.45;
    this.chargeGlow ??= s.add.image(x, y, fx.glowKey()).setBlendMode(Phaser.BlendModes.ADD).setDepth(9.5);
    const pulse = ready ? 0.85 + 0.15 * Math.sin(time / 60) : 1, r = (M.chargeGlow ?? 170) * (0.45 + 0.55 * p) * pulse;
    this.chargeGlow.setPosition(x, y).setDisplaySize(r * 2, r * 2.2).setTint(ready ? 0xffe9a0 : 0x3fe0d0).setAlpha((ready ? 0.75 : 0.25 + 0.4 * p) * pulse);
    if (time >= (this.nextGather || 0)) { this.nextGather = time + (ready ? 40 : 90 - 50 * p); fx.gather(x, y, ready ? 0xffd27a : 0x7ff6ff, 90 + 70 * p); }
  }

  // ---------- magazine and reloading (Waffen › Magazin, Nachladen dauert; R lädt nach, leer = automatisch) ----------
  loadWeapon() {
    const w = this.scene.weapon('ranged'), total = w?.ammo ?? Infinity;
    this.magSize = w?.magazine || total;
    this.mag = Math.min(this.magSize, total); this.ammo = total - this.mag; this.reloading = null; this.reloadSaved = 0;
  }
  // Daniel, 11.11.2026 (1C): jumps, dashes and slides do not stop the reload, only the animation; a hit or a melee attack pauses it,
  // the progress is kept and it carries on by itself as soon as she can
  startReload(time) {
    if (this.reloading || this.mag >= this.magSize || this.ammo <= 0) return;
    const dur = this.scene.weapon('ranged')?.reloadTime ?? 1400, done = Math.min(dur - 1, this.reloadSaved || 0);
    this.reloading = { at: time - done, dur }; this.reloadSaved = 0;
  }
  updateReload(time) {
    if (!this.reloading && this.reloadSaved > 0 && this.alive && !this.attack && !this.charging && !this.hitAnim && this.state === 'normal') this.startReload(time);   // carry on
    const R = this.reloading;
    if (!R) return;
    if (this.attack || this.charging || this.hitAnim || !this.alive) { this.reloadSaved = Math.min(R.dur - 1, time - R.at); this.reloading = null; return; }   // paused, progress kept
    if (time - R.at >= R.dur) { const n = Math.min(this.magSize - this.mag, this.ammo); this.mag += n; this.ammo -= n; this.reloading = null; this.reloadSaved = 0; }
  }

  // ---------- gun drawn: automatically while she is not running (Daniel: "zieht die Waffe automatisch, wenn sie nicht rennt,
  // kann schießen oder gehen und schießen; sobald sie rennt oder springt, steckt sie die Waffe wieder weg") ----------
  updateArmed(time, dt, grounded) {
    const A = this.d.armed || {}, s = this.scene, v = this.body.velocity;
    const slow = Math.abs(v.x) <= (this.m.walkSpeed ?? 240) * 1.15 || this.gunRunning(v, true);
    const can = A.enabled !== false && this.d.look?.aim && s.weapon('ranged') && (s.mode !== 'camp' || A.inCamp) && this.state === 'normal' && grounded && !this.attack && !this.charging
      && slow && !this.hitAnim;
    this.armed ??= 'off';
    // a strike, charging or a hit with the gun out (Daniel, 12.11.2026: „Hieb mit gezogener Waffe steckt nicht weg“): the gun counts as out
    // the whole time and is back in the hand right after, without drawing
    const busy = this.attack || this.charging || this.hitAnim;
    if (!can) { if (this.armed === 'on' || (busy && this.gunOut && this.fight?.on)) this.armedLost = time; this.armed = 'off'; this.drawP = 0; return; }
    // combat over (calm, Q): holstering = drawing backwards (Daniel, 11.11.2026: „Waffe ziehen soll auch wegstecken sein“)
    if (!this.fight.on) {
      this.gunOut = false;
      if (this.armed === 'on' || this.armed === 'drawing') { if (this.armed === 'on') this.drawP = 1; this.armed = (A.holsterTime ?? 420) > 0 && this.d.look?.draw ? 'holstering' : 'off'; }
      if (this.armed === 'holstering') { this.drawP -= dt / Math.max(1, A.holsterTime ?? 420); if (this.drawP <= 0) { this.armed = 'off'; this.drawP = 0; } }
      if (this.armed === 'off') this.drawP = 0;
      return;
    }
    if (this.armed === 'holstering') this.armed = 'drawing';   // back into the fight halfway: draw again from where the hand is
    // back on the ground after a jump or dash in a fight: the gun comes straight back (Leyla › Kampfmodus › Wieder im Anschlag)
    const quick = time - this.armedLost < (this.d.fight?.redraw ?? 700);
    if (this.armed === 'off') { this.armed = this.d.look?.draw && !quick ? 'drawing' : 'on'; this.drawP = 0; this.special = null; }
    if (this.armed === 'drawing' && this.gunRunning(v) && !this.runLook('runDraw')) this.armed = 'on';   // no drawing on the run without its animation
    if (this.armed === 'drawing') { this.drawP += dt / Math.max(1, this.quickShot != null ? this.quickDraw ?? 120 : A.drawTime ?? 650); if (this.drawP >= 1) { this.armed = 'on'; this.gunOut = true; } }
    if (this.armed === 'on') this.gunOut = true;
  }
  runFamily() { return this.families()[0]; }
  families() {
    const L = this.d.look || {}, A = this.scene.data_.assets || {};
    const set = ids => { ids = ids.filter(Boolean); return new Set([...ids, ...ids.map(id => A[id]?.mirror).filter(Boolean)]); };
    return [set([L.run, L.runGun, L.runReady, L.runDraw, L.runReload, L.runReload2]), set([L.walk, L.aimWalk])];
  }
  runLook(key) { const id = this.d.look?.[key]; return id && this.scene.textures.exists(id) ? id : null; }
  // Cells-like (Spiel › Kampf › Schießstil): with the gun out she keeps running, look Leyla › Waffe ziehen › Rennen mit Waffe
  gunRunning(v, any = false) {
    if (!this.d.look?.runGun || !this.scene.cellsLike() || !this.scene.textures.exists(this.d.look.runGun)) return false;
    return any || Math.abs(v.x) > (this.m.walkSpeed ?? 240) * 1.15;
  }

  // ---------- combat mode (Daniel, 11.11.2026: "Leyla existiert im friedlichen Zustand oder im Combat Mode, d. h. mit gezogener Waffe";
  // C: automatically in when an enemy shows up, she is hit or pulls the trigger, out again after a quiet while, plus a key to draw and holster) ----------
  fightTrigger(time, hit = false) {
    const F = this.fight;
    if (!F || (hit && this.d.fight?.onHit === false)) return;
    F.manual = F.manual === 'on' ? 'on' : null;   // a shot or a hit overrides a gun holstered by hand
    F.last = time; F.on = true;
  }
  updateFight(time, input) {
    const F = this.fight, C = this.d.fight || {}, s = this.scene;
    if (!F) return;
    if (C.enabled === false) { F.on = true; return; }   // no combat mode: the gun is ready like before
    if (s.mode === 'camp' && !this.d.armed?.inCamp) { F.on = false; F.manual = null; return; }
    // key (Q / left stick): draw or holster by hand; drawn by hand stays drawn until the key again
    if (input.holster?.pressed && this.alive) {
      if (F.on) { F.on = false; F.manual = 'off'; } else { F.on = true; F.manual = 'on'; F.last = time; }
    }
    // enemies in sight (Leyla › Kampfmodus › Sicht, free line of sight), a few times a second
    // without "Automatisch" (Daniel, 12.11.2026, 2b: only by button) an enemy in sight keeps a drawn gun out, but never draws it
    if (time >= F.check) {
      F.check = time + 150;
      const seen = this.enemyInSight((C.sight ?? 10) * (s.T || 64));
      if (C.auto !== false) {
        if (seen && F.manual === 'off' && !F.seen) F.manual = null;   // holstered by hand: only a new sighting draws again
        if (seen && F.manual !== 'off') { F.on = true; F.last = time; }
      } else if (seen && F.on) F.last = time;
      F.seen = seen;
    }
    if (F.on && F.manual !== 'on' && time - F.last > (C.calm ?? 4) * 1000 && !this.reloading) F.on = false;
  }
  enemyInSight(range) {
    const s = this.scene, x = this.x, y = this.feet - this.height * 0.7;
    for (const e of s.enemies || []) {
      if (!e.alive) continue;
      const b = e.body, ex = b.center.x, ey = b.center.y;
      if (Math.hypot(ex - x, ey - y) <= range && s.lineFree(x, y, ex, ey)) return true;
    }
    return false;
  }

  // slide recoil (Assets › Schlitten): for a moment the frame with the slide back lies over Leyla
  recoil(time) {
    const AR = this.d.armed || {}, dur = AR.recoilTime ?? 70, sp = this.sprite;
    const start = (this.shotAt ?? -1e9) + (this.extendAt != null && this.extendAt === this.shotAt ? AR.extendTime ?? 100 : 0);
    const on = AR.recoil !== false && time >= start && time - start < dur && this.armed === 'on' && sp.visible;
    const key = on ? recoilTexture(this.scene, sp.texture.key, Number(sp.frame.name)) : null;
    if (!key) { if (this.recoilImg?.visible) this.recoilImg.setVisible(false); return; }
    this.recoilImg ??= this.scene.add.image(0, 0, key);
    this.recoilImg.setTexture(key).setVisible(true).setDepth(sp.depth + 0.001).setPosition(sp.x, sp.y).setOrigin(sp.originX, sp.originY)
      .setScale(sp.scaleX, sp.scaleY).setFlipX(sp.flipX).setRotation(sp.rotation).setAlpha(sp.alpha);
    if (sp.isTinted) this.recoilImg.setTint(sp.tintTopLeft); else this.recoilImg.clearTint();
    sp.setAlpha(0);
    this.recoilShown = (this.recoilShown || 0) + 1;
  }
  lookDur(id) { const a = this.scene.data_.assets?.[id]; return a?.frames && a.fps ? a.frames / a.fps * 1000 : 0; }

  // ---------- random idles ----------
  rollIdleWait() { const [a, b] = this.d.idleAfter || [6, 12]; return (a + Math.random() * (b - a)) * 1000; }
  pickIdle() {
    const rows = (this.d.idles || []).filter(r => r.look && this.scene.textures.exists(r.look) && (r.weight ?? 1) > 0);
    if (!rows.length) return null;
    let k = Math.random() * rows.reduce((n, r) => n + (r.weight ?? 1), 0);
    const r = rows.find(x => (k -= x.weight ?? 1) < 0) || rows[0];
    // after one run of the animation: back to standing, wait again
    this.sprite.once('animationcomplete', () => { this.special = null; this.stillSince = this.scene.time.now; this.idleWait = this.rollIdleWait(); });
    return r.look;
  }

  // ---------- sitting (camp fire): sit down, a looping part, stand up; frames from Camp › Am Feuer sitzen ----------
  startSit(S, x, facing, onStand) {
    this.state = 'sit'; this.sit = { ...S, at: this.scene.time.now, up: 0, onStand };
    this.facing = facing; this.special = null;
    this.body.reset(x, this.feet - this.size.h / 2); this.body.setVelocity(0, 0);
  }
  sitFrame(time) {
    const S = this.sit, ms = 1000 / (S.fps || 5), t = time - S.at, down = Math.max(1, S.downTo ?? 6), [l0, l1] = S.loop || [down + 1, down + 1], up = S.upFrom ?? l1 + 1;
    if (S.up) { const f = up - 1 + Math.floor((time - S.up) / ms); return f; }
    if (t < down * ms) return Math.floor(t / ms);
    return l0 - 1 + Math.floor((t - down * ms) / ms) % Math.max(1, l1 - l0 + 1);
  }
  sitting(time, input, dir) {
    const S = this.sit, b = this.body;
    b.setVelocityX(0);
    if (!S.up && (dir || input.jump.pressed || input.grab.pressed || input.up.pressed)) S.up = time;
    const n = this.scene.data_.assets?.[S.look]?.frames || 1;
    if (S.up && this.sitFrame(time) >= n) { const sat = (S.up - S.at) / 1000; this.state = 'normal'; this.sit = null; S.onStand?.(sat); }
  }

  // ---------- yoga pose (Daniel: P triggers it, dissolving plays it backwards); the anchor offset is baked into the strip ----------
  startPose(time) {
    const Y = this.d.yoga || {}, n = this.scene.data_.assets?.[this.d.look.yoga]?.frames || 1;
    this.state = 'pose'; this.special = null; this.body.setVelocityX(0);
    this.pose = { at: time, out: 0, n, ms: 1000 / (Y.fps || 6), back: 1000 / (Y.backFps || 10), hold: Math.min(n, Math.max(1, Y.holdFrom ?? n)) - 1 };
  }
  poseFrame(time) {
    const P = this.pose;
    if (P.out) return P.outFrom - Math.floor((time - P.out) / P.back);
    const f = Math.floor((time - P.at) / P.ms);
    return f < P.n ? f : P.hold + (f - P.n) % Math.max(1, P.n - P.hold);   // in, then breathe (or hold the last frame)
  }
  posing(time, input, dir) {
    const P = this.pose;
    this.body.setVelocityX(0);
    if (!P.out && (dir || input.pose.pressed || input.jump.pressed || input.grab.pressed || input.melee.pressed || input.ranged.pressed || input.down.pressed)) { P.outFrom = Math.min(P.n - 1, this.poseFrame(time)); P.out = time; }
    if (P.out && this.poseFrame(time) < 0) { this.state = 'normal'; this.pose = null; this.stillSince = time; }
  }

  hand() { return { x: this.x, y: this.feet - this.size.h + this.size.hand }; }
}

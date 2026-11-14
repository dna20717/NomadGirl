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
export const DASH_TIME = 170, TERMINAL_FALL = 1700;
const approach = (v, target, step) => v < target ? Math.min(target, v + step) : Math.max(target, v - step);

export class Leyla {
  // Leyla's data, with the poses of the ranged weapon in her hand laid over her own looks (Waffen › Posen, Daniel, 12.11.2026:
  // „Sturmgewehr als Grundlage für weitere Waffenvarianten“); without poses: her own data
  get d() {
    const w = this.scene.weapon?.('ranged'), from = w?.posesFrom && this.scene.data_.weapons?.[w.posesFrom];
    const P = w && (w.poses || from?.poses) ? { ...from?.poses, ...w.poses } : null;   // Waffen › Posen von: a new gun borrows the poses of another one
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
    this.airJumps = this.maxAirJumps;
    this.airDash = this.canAirDash;
    this.lastGround = -1e9; this.jumpAt = -1e9; this.dashReady = 0; this.dropUntil = 0; this.noGrabUntil = 0;
    this.ledge = null; this.body.checkCollision.none = false;
    this.meleeReady = 0; this.rangedReady = 0; this.invulnerableUntil = 0; this.attackPose = 0;
    this.squash = { x: 1, y: 1 };
    this.fight = { on: false, manual: null, last: -1e9, seen: false, check: 0 };   // combat mode (Leyla › Kampfmodus)
    this.armedLost = -1e9; this.armed = 'off';
    this.sprite.setAlpha(1).setRotation(0).clearTint();
  }

  // Cyberware (#006): with Leyla › Fähigkeiten › „nur mit Implantat“ the double jump and the air dash come from implants (scene.ability)
  get maxAirJumps() { return this.scene.ability ? this.scene.ability.airJumps : this.m.airJumps ?? 0; }
  get canAirDash() { return this.scene.ability ? this.scene.ability.airDash : true; }
  // ---------- stamina (#020, Daniel 14.11.2026: „eine Ausdauerleiste für Dash, Slide, Doppelsprung und Nahkampf-Attacken“) ----------
  // empty = the action does not happen (the bar flashes, a short buzz); after Leyla › Ausdauer › „Erholt sich nach“ it refills quickly
  get S() { return this.d.stamina || {}; }
  get staminaOn() { return this.S.enabled !== false; }
  get maxStamina() { return Math.max(1, (this.S.max ?? 100) + (this.scene.mods?.stamina || 0)); }
  staminaCost(kind) { return this.staminaOn ? Math.max(0, this.S.costs?.[kind] ?? { dash: 25, slide: 20, airJump: 25, melee: 12, heavy: 28 }[kind] ?? 0) : 0; }
  canSpend(kind) { return (this.stamina ?? this.maxStamina) >= this.staminaCost(kind) - 1e-6; }
  spend(kind, time) {
    const cost = this.staminaCost(kind);
    if (!cost) return true;
    if (!this.canSpend(kind)) { this.staminaDenied = time; this.scene.staminaDenied?.(kind); return false; }
    this.stamina = (this.stamina ?? this.maxStamina) - cost; this.staminaAt = time;
    return true;
  }
  staminaTick(time, dt) {
    const max = this.maxStamina;
    if (this.stamina == null || this.stamina > max) this.stamina = Math.min(this.stamina ?? max, max);
    if (this.stamina < max && time - (this.staminaAt ?? -1e9) >= (this.S.delay ?? 600))
      this.stamina = Math.min(max, this.stamina + (this.S.regen ?? 55) * (1 + (this.scene.mods?.staminaRegen || 0) / 100) * dt / 1000);
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
    this.staminaTick(time, dt);   // #020
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
      this.lastGround = time; this.airJumps = this.maxAirJumps; this.airDash = this.canAirDash; this.flipUntil = 0;
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
    if (time < (this.flipUntil || 0) && m.airJumpGhosts && time >= (this.nextGhost || 0)) { this.scene.fx.ghost(this.sprite, 0x3fe0d0, m.airJumpSpin > 0 ? 0.25 : 0.45, m.airJumpSpin > 0 ? 160 : 220); this.nextGhost = time + (m.airJumpSpin > 0 ? 45 : 28); }
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
    } else if (input.jump.pressed && !grounded && this.airJumps > 0 && this.spend('airJump', time)) {
      this.airJumps--; this.jump(0.92); this.scene.fx.puff(this.x, this.feet, 0x3fe0d0);
      // double jump: whole animation once, or from „Doppelsprung ab Frame“ over „Doppelsprung-Dauer“ (e.g. the last dash frames)
      this.flipAt = time; this.flipLen = (m.airJumpFromFrame ?? 1) > 1 || m.airJumpSpin > 0 ? (m.airJumpTime ?? 300) : this.scene.lookDuration('airJump');
      this.flipUntil = time + this.flipLen; this.nextGhost = 0;
    }
    if (this.cut && !input.jump.down && b.velocity.y < 0) { b.setVelocityY(b.velocity.y * 0.45); this.cut = false; }
    if (b.velocity.y >= 0) this.cut = false;

    if (input.dash.pressed && time >= this.dashReady && (grounded || this.airDash) && this.spend('dash', time)) return this.startDash(time, dir);
    if (grounded && input.down.pressed && Math.abs(b.velocity.x) > (m.walkSpeed ?? 240) * 0.8 && !(ladder && this.feet <= ladder.top + 4) && this.spend('slide', time)) return this.startSlide(time);
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
    this.body.setVelocityY(-(this.m.jumpVelocity ?? 1100) * f * (1 + (this.scene.mods?.jump || 0) / 100));   // Sprungkraft from implants
    this.jumpAt = -1e9; this.cut = true; this.leapAt = this.scene.now ?? 0;
    this.squash = { x: 0.86, y: 1.14 };
  }
  land(vy) {
    const k = Math.min(1, vy / 1600);
    this.squash = { x: 1 + 0.2 * k, y: 1 - 0.2 * k };
    this.scene.fx.dust(this.x, this.feet, 6 + 8 * k);
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
    // sliding down a ladder in the submarine pose (Daniel, 12.11.2026: „die Pose, die Menschen im U-Boot einnehmen“): Leyla › Aussehen › Leiter runterrutschen
    if (st === 'climb' && this.climbSliding && this.d.look?.ladderSlide) { name = 'ladderSlide'; this.ladderSlideAt ??= time; } else this.ladderSlideAt = null;
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
    const spin = name === 'airJump' && this.m.airJumpSpin > 0;
    const flipFrames = name === 'airJump' && ((this.m.airJumpFromFrame ?? 1) > 1 || spin);
    const slideFrames = st === 'slide' && !!this.m.slideLoop?.[1];
    const ladderFrames = name === 'ladderSlide';
    this.flipSpin = 0;
    const climbFrames = st === 'climb' && (this.m.climbFromFrame ?? 1) > 0;
    const manual = st === 'mantle' || st === 'crouch' || st === 'dash' || st === 'land' || st === 'brake' || st === 'sit' || st === 'pose' || flipFrames || climbFrames || slideFrames || ladderFrames, an0 = this.sprite.anims;
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
    } else if (ladderFrames && info.used === 'ladderSlide' && an0.currentAnim) {
      // take the pose (Klettern & Schwingen › Rutschen: Einnehmen), then the fluttering loop
      const fr = an0.currentAnim.frames, n = fr.length, k = Math.min(n - 1, Math.max(0, this.m.ladderSlideIn ?? 0)), t = time - this.ladderSlideAt, step = 1000 / (this.m.ladderSlideFps ?? 12);
      const f = t < k * step * 0.6 ? Math.floor(t / (step * 0.6)) : k + Math.floor((t - k * step * 0.6) / step) % Math.max(1, n - k);
      if (!an0.isPaused) an0.pause();
      this.sprite.setFrame(fr[Math.min(n - 1, f)].frame.name);
    } else if (slideFrames && info.used === 'slide' && an0.currentAnim) {
      // slide in three parts (Daniel, 12.11.2026: „dynamischer, nicht statisch von A nach B gleiten“): drop in, loop while sliding (also in a tunnel), get up
      const fr = an0.currentAnim.frames, n = fr.length, M = this.m, [l0, l1] = M.slideLoop, a = Math.max(0, l0 - 1), z = Math.min(n - 1, l1 - 1);
      const t = time - (this.slideAt ?? time), tin = M.slideIn ?? 90, tout = M.slideOut ?? 110, outAt = this.slideEnd - tout;
      let f;
      if (t < tin) f = Math.floor(a * t / Math.max(1, tin));
      else if (time >= outAt && this.canStand()) f = Math.min(n - 1, z + 1 + Math.floor((n - 1 - z) * Math.min(1, (time - outAt) / Math.max(1, tout))));
      else f = a + Math.floor((t - tin) / (1000 / (M.slideFps ?? 14))) % Math.max(1, z - a + 1);
      if (!an0.isPaused) an0.pause();
      this.sprite.setFrame(fr[Math.min(n - 1, f)].frame.name);
    } else if (manual && (info.used === st || (flipFrames && info.used === 'airJump')) && an0.currentAnim) {
      const fr = an0.currentAnim.frames, n = fr.length;
      const from = st === 'mantle' ? Math.min(n - 1, Math.max(0, (this.m.mantleFromFrame ?? 5) - 1)) : 0;
      const dashFrom = Math.min(n - 1, Math.max(0, (this.m.dashFromFrame ?? 1) - 1)), dashP = Math.min(1, 1 - (this.dashEnd - time) / DASH_TIME);
      const flipFrom = Math.min(n - 1, Math.max(0, (this.m.airJumpFromFrame ?? 1) - 1)), flipP = Math.min(1, (time - this.flipAt) / Math.max(1, this.flipLen));
      const climbFrom = Math.min(n - 1, Math.max(0, (this.m.climbFromFrame ?? 1) - 1)), climbN = Math.max(1, n - climbFrom);
      const landFrom = Math.min(n - 1, Math.max(0, (this.m.landFromFrame ?? 4) - 1));
      const brakeFrom = Math.min(n - 1, Math.max(0, (this.d.brake?.fromFrame ?? 2) - 1));
      const f = st === 'land' ? Math.round(landFrom + (n - 1 - landFrom) * this.landP(time)) : st === 'brake' ? Math.min(n - 1, brakeFrom + Math.floor((n - brakeFrom) * this.brakeP(time))) : climbFrames ? climbFrom + Math.floor((this.climbDist || 0) / Math.max(1, this.m.climbStep ?? 24)) % climbN : flipFrames ? (spin ? this.spinFrame(n, flipP) : Math.round(flipFrom + (n - 1 - flipFrom) * flipP)) : st === 'mantle' ? Math.round(from + (n - 1 - from) * ((this.mantleQ0 || 0) + (1 - (this.mantleQ0 || 0)) * this.mantleP(time))) : st === 'dash' ? Math.round(dashFrom + (n - 1 - dashFrom) * dashP) : Math.round(Math.min(n - 1, this.crouchF || 0));
      if (!an0.isPaused) an0.pause();
      this.sprite.setFrame(fr[f].frame.name);
    }
    // run cycle follows the speed, so the feet do not slide (walking = slower steps)
    // sliding through a tunnel: hold the lowest frame (middle of the slide) until she can stand
    const an = this.sprite.anims;
    if (st === 'slide' && !slideFrames && info.used === 'slide' && an.currentAnim) {
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
    if (name === 'airJump' && this.m.airJumpTilt && !spin) rot = this.facing * Math.max(-0.6, Math.min(0.6, Math.atan2(v.y, Math.max(Math.abs(v.x), 400)))) * this.m.airJumpTilt / 100;   // pose leans into the jump
    if (time < this.attackPose && st === 'normal') rot += this.facing * 0.1;
    if (st === 'dead') { this.deadRot = (this.deadRot || 0) + (this.facing * -1.45 - (this.deadRot || 0)) * k; rot = this.deadRot; } else this.deadRot = 0;
    if (spin && this.flipSpin) rot = this.facing * this.flipSpin;
    this.sprite.setPosition(b.center.x, b.bottom).setRotation(rot);
    // the somersault turns around her middle, not around her feet (Salto: Drehpunkt über den Füßen, in Bildpixeln)
    if (spin && this.flipSpin) { const ph = (this.m.airJumpPivot ?? 70) * info.scale; this.sprite.x -= Math.sin(rot) * ph; this.sprite.y -= ph - Math.cos(rot) * ph; }
    // Waffen › Rückstoß: the gun shoves her back a few pixels for a moment (long guns without a painted slide)
    const kick = this.armed === 'on' && this.scene.weapon?.('ranged')?.kick, since = time - (this.shotAt ?? -1e9);
    if (kick && since >= 0 && since < 90) this.sprite.x -= this.facing * kick * (1 - since / 90) * this.size.h / 168;
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

// Split (#017, backlog C8): special moves and fighting live in their own files
import { LeylaMoves } from './leyla_moves.js';
import { LeylaCombat } from './leyla_combat.js';
for (const M of [LeylaMoves, LeylaCombat]) for (const k of Object.getOwnPropertyNames(M.prototype)) if (k !== 'constructor') Object.defineProperty(Leyla.prototype, k, Object.getOwnPropertyDescriptor(M.prototype, k));

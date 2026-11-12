// Enemy AI from building blocks (Daniel, 12.11.2026: „Gegner-KI … Bausteine + Werkstatt“; Wahrnehmung „Sicht + Gehör“;
// Verhalten bestehende schärfen + Lauerer + Flieger; Konter Schild, Ausweichen, Panzerung). All values from the area "Gegner".
//
//   senses    sight (range, cone in facing direction, a little behind, only with a free line), hearing (scene.noise: shots, hits),
//             memory (last known position → search there, look around, give up)
//   moves     walk (patrol around home, steps up small ledges, drops down when chasing), hang on the ceiling, fly
//   attacks   melee (short hit), lunge (charge), shot (aim line, projectile), dive (flyer swoops), drop (ambusher falls)
//   counters  shield in front (blocks shots + light hits, a heavy hit breaks the guard, turns slowly), dodge (hops away from shots
//             and strikes), armour plates (light hits only scratch, heavy hits crack a plate)
//   states    patrol · alert · engage · search · windup · strike · recover · dodge · stagger · lurk · drop · dead
// Every attack is telegraphed (windup: blinking + "!", the shooter shows his aim line, cut at the first wall).

const KINDS = { patrol: 'melee', charger: 'lunge', shooter: 'shot', ambusher: 'drop', flyer: 'dive', boss: 'lunge' };
const SHAPES = { flyer: 'drone', ambusher: 'blob' };

export class Enemy {
  constructor(scene, id, def, feet) {
    this.scene = scene; this.id = id; this.d = def;
    this.weapon = scene.data_.weapons?.[def.weapon] || null;
    this.a = def.attack || {};
    this.kind = ['patrol', 'charger', 'shooter', 'ambusher', 'flyer', 'boss'].includes(def.behavior) ? def.behavior : 'patrol';
    this.shape = def.placeholderShape || SHAPES[this.kind] || 'raider';
    this.attackKind = this.a.kind || (this.kind === 'flyer' && (this.a.projectileSpeed || this.weapon) ? 'shot' : KINDS[this.kind]);
    this.h = def.height ?? (this.shape === 'blob' ? 110 : this.shape === 'drone' ? 90 : 220);
    const S = def.sense || {}, M = def.move || {}, C = def.counter || {};
    // senses: the old field "Bemerkt Leyla ab" is the sight range
    this.S = { sight: def.aggroRange ?? 400, cone: S.cone ?? (this.kind === 'flyer' ? 360 : 140), behind: S.behind ?? 140, hearing: S.hearing ?? 100,
      react: S.react ?? 300, lost: S.lost ?? 900, search: S.search ?? 5000 };
    this.M = { patrol: M.patrol ?? 200, jump: M.jump ?? 1, drop: M.drop ?? 3, fly: M.flyHeight ?? 230 };
    this.C = { shield: !!C.shield, turn: C.shieldTurn ?? 650, stagger: C.shieldStagger ?? 900, dodge: C.dodge ?? 0, dodgeEvery: C.dodgeCooldown ?? 1400,
      dodgeDist: C.dodgeDistance ?? 200, plates: C.armor ?? 0, chip: C.armorChip ?? 15 };
    this.plates = this.C.plates;
    const sizes = { raider: [0.32, 0.9], blob: [1.0, 0.8], drone: [0.95, 0.75] }[this.shape] || [0.32, 0.9];
    const bodyH = Math.round(this.h * sizes[1]);
    this.w = Math.round(this.h * sizes[0]);
    this.box = scene.add.rectangle(feet[0], feet[1] - bodyH / 2, this.w, bodyH, 0x000000, 0);
    scene.physics.add.existing(this.box);
    this.body = this.box.body;
    this.body.setMaxVelocityY(1700);
    const look = scene.enemyLook(def, this.shape);
    this.look = look;
    this.sprite = scene.add.sprite(feet[0], feet[1], look.key).setOrigin(look.ox, look.oy).setScale(look.scale).setDepth(8);
    if (look.anim) this.sprite.play(look.anim);
    this.gear = scene.add.graphics().setDepth(8.5);
    this.bar = scene.add.graphics().setDepth(15);
    this.warn = scene.add.text(0, 0, '!', { fontFamily: 'VT323, monospace', fontSize: '72px', color: '#ff4060', stroke: '#0d0a12', strokeThickness: 8 }).setOrigin(0.5, 1).setDepth(16).setVisible(false);
    this.aim = scene.add.graphics().setDepth(7);
    this.hp = def.health ?? 30;
    this.state = 'patrol'; this.facing = -1; this.home = { x: feet[0], y: feet[1] - bodyH / 2 };
    this.readyAt = 0; this.stunUntil = 0; this.barUntil = 0; this.lastSeen = -1e9; this.lastKnown = null; this.seeing = false;
    this.senseAt = 0; this.dodgeReady = 0; this.dodged = new WeakSet(); this.turnAt = 0; this.until = 0;
    if (this.kind === 'flyer') { this.body.allowGravity = false; this.body.setMaxVelocity(900, 900); }
    if (this.kind === 'ambusher') this.toCeiling();
  }

  get x() { return this.body.center.x; }
  get feet() { return this.body.bottom; }
  get chest() { return this.body.bottom - this.body.height * 0.6; }
  get eyeY() { return this.body.top + this.body.height * 0.2; }
  get alive() { return this.state !== 'dead'; }
  get behavior() { return this.kind; }
  get busy() { return ['windup', 'strike', 'recover', 'dodge', 'stagger', 'drop'].includes(this.state); }

  // ---------- senses ----------
  // sight: in range, inside the cone in facing direction (or very close behind), free line from the eyes to her chest or head
  sees(l) {
    if (!l.alive) return false;
    const s = this.scene, ex = this.x, ey = this.state === 'lurk' ? this.body.bottom + 4 : this.eyeY;
    const tx = l.x, ty = l.chest, dx = tx - ex, dy = ty - ey, d = Math.hypot(dx, dy);
    if (d > this.S.sight) return false;
    if (this.state === 'lurk') { if (Math.abs(dx) > (this.a.range ?? 160) * 1.6 || dy < 0) return false; }
    else if (d > this.S.behind && this.S.cone < 360) {
      const ang = Math.atan2(Math.abs(dy), dx * this.facing) * 180 / Math.PI;   // 0 = straight ahead, 180 = behind
      if (ang > this.S.cone / 2) return false;
    }
    return s.lineFree(ex, ey, tx, ty) || s.lineFree(ex, ey, tx, l.feet - l.height * 0.92);
  }
  // hearing (scene.noise): a sound at (x, y) that carries r px; walls in between halve it (Gegner › Wahrnehmung › Hört)
  hear(time, x, y, r) {
    if (!this.alive || this.S.hearing <= 0 || this.state === 'lurk') return;
    let reach = r * this.S.hearing / 100;
    if (!this.scene.lineFree(this.x, this.eyeY, x, y)) reach *= 0.5;
    if (Math.hypot(x - this.x, y - this.chest) > reach) return;
    this.lastKnown = { x, y, at: time };
    if (this.state === 'patrol') { this.state = 'alert'; this.until = time + this.S.react; this.heard = true; this.say('?', '#ffd27a'); }
    else if (this.state === 'search') this.searchStart = time;
  }
  say(t, color) { this.scene.fx.text(this.x, this.body.top - 16, t, { color, size: 48, rise: 30 }); }

  // ---------- update ----------
  update(time, dt, leyla) {
    if (!this.alive) return;
    const b = this.body, l = leyla;
    if (time >= this.senseAt) {   // a few looks a second are enough
      this.senseAt = time + 90;
      this.seeing = this.sees(l);
      if (this.seeing) { this.lastSeen = time; this.lastKnown = { x: l.x, y: l.chest, at: time }; }
    }
    this.warn.setVisible(this.state === 'windup');
    this.aim.clear();
    if (time < this.stunUntil && this.state !== 'stagger') { b.setVelocityX(b.velocity.x * 0.9); if (this.kind === 'flyer') b.setVelocityY(b.velocity.y * 0.9); return this.draw(time); }
    this.watchDodge(time, l);
    const dx = l.x - this.x, dist = Math.abs(dx);

    switch (this.state) {
      case 'lurk': {   // ambusher on the ceiling: waits until Leyla walks underneath
        b.setVelocity(0, 0);
        if (this.seeing) { this.state = 'windup'; this.windupEnd = time + (this.a.windup ?? 380); this.facing = Math.sign(dx) || this.facing; }
        break;
      }
      case 'patrol': {
        if (this.seeing) { this.state = 'alert'; this.until = time + this.S.react; this.heard = false; this.say('?!', '#ffd27a'); break; }
        this.patrol(time);
        break;
      }
      case 'alert': {   // a short moment to react: stand, look there
        this.stop();
        if (this.lastKnown) this.face(time, this.lastKnown.x - this.x, true);
        if (time >= this.until) {
          if (this.seeing) this.state = 'engage';
          else if (this.lastKnown) { this.state = 'search'; this.searchStart = time; }
          else this.state = 'patrol';
        }
        break;
      }
      case 'engage': {
        if (!l.alive) { this.state = 'patrol'; break; }
        if (!this.seeing && time - this.lastSeen > this.S.lost) { this.state = 'search'; this.searchStart = time; break; }
        this.face(time, dx);
        this.engage(time, l, dx, dist);
        break;
      }
      case 'search': {   // go to where she was last seen or heard, look around, then give up
        if (this.seeing) { this.state = 'engage'; this.say('!', '#ff4060'); break; }
        const k = this.lastKnown;
        const there = !k || (this.kind === 'flyer' ? Math.hypot(k.x - this.x, k.y - this.chest) < 60 : Math.abs(k.x - this.x) < 40);
        if (!there && !this.stuck) this.moveTo(time, k.x, k.y - (this.kind === 'flyer' ? 40 : 0), (this.d.speed ?? 120) * 0.7);
        else { this.stop(); if (time >= (this.lookAt || 0)) { this.facing *= -1; this.lookAt = time + 800; } }
        if (time - this.searchStart > this.S.search) { this.state = 'patrol'; this.home = { x: this.x, y: this.body.center.y }; this.lastKnown = null; this.say('…', '#8b949e'); }
        break;
      }
      case 'windup': {
        this.stop();
        if (this.attackKind === 'shot') this.drawAim(time);
        if (this.attackKind === 'dive' || this.attackKind === 'drop') this.sprite.x += Math.sin(time / 30) * 3;   // trembling before it lets go
        if (time >= this.windupEnd) this.release(time, l);
        break;
      }
      case 'strike': {
        if (this.attackKind === 'dive') { if (b.blocked.down || b.blocked.left || b.blocked.right || b.blocked.up) this.until = Math.min(this.until, time); }
        else if (this.attackKind === 'drop') { if (b.blocked.down) { this.landed(time, l); break; } }
        else if (this.attackKind === 'lunge') b.setVelocityX(this.safeStep(this.facing) ? this.facing * (this.d.speed ?? 200) * 1.9 : 0);
        else this.stop();
        if (!this.struck) this.strike(time, l);
        if (time >= this.until) { this.state = 'recover'; this.until = time + (this.attackKind === 'dive' ? 420 : 260); }
        break;
      }
      case 'recover': {
        if (this.kind === 'flyer') { b.setVelocity(b.velocity.x * 0.9, b.velocity.y * 0.9 - 6); }
        else b.setVelocityX(b.velocity.x * 0.8);
        if (time >= this.until) { this.state = this.seeing ? 'engage' : 'search'; this.searchStart = time; }
        break;
      }
      case 'dodge': {
        if (time >= this.until) this.state = 'engage';
        break;
      }
      case 'stagger': {   // shield knocked aside: open for a moment
        b.setVelocityX(b.velocity.x * 0.85);
        if (time >= this.until) { this.state = 'engage'; this.guardOpen = false; }
        break;
      }
    }
    this.draw(time);
  }

  // ---------- moving ----------
  stop() { const b = this.body; b.setVelocityX(0); if (this.kind === 'flyer') b.setVelocityY(b.velocity.y * 0.85); }
  // turning: shielded enemies turn slowly (Gegner › Konter › Dreht sich langsam), so Leyla can get behind them
  face(time, dx, now = false) {
    const want = Math.sign(dx);
    if (!want || want === this.facing) { this.turnAt = 0; return; }
    if (now || !this.C.shield || this.guardOpen) { this.facing = want; return; }
    if (!this.turnAt) this.turnAt = time + this.C.turn;
    if (time >= this.turnAt) { this.facing = want; this.turnAt = 0; }
  }
  // ground ahead in walking direction; a drop of at most "Springt runter bis" tiles is fine while chasing or searching
  safeStep(dir, drop = 0) {
    const s = this.scene, T = s.T, fx = this.x + dir * (this.w / 2 + 10);
    if (dir < 0 ? this.body.blocked.left : this.body.blocked.right) return false;
    for (let k = 0; k <= drop; k++) if (s.groundAt(fx, this.feet + 8 + k * T)) return true;
    return false;
  }
  // a wall of at most "Springt hoch bis" tiles in front: jump onto it
  hop(dir) {
    const s = this.scene, T = s.T, b = this.body;
    if (!b.blocked.down || !(dir < 0 ? b.blocked.left : b.blocked.right) || this.M.jump <= 0) return false;
    const fx = this.x + dir * (this.w / 2 + 8);
    for (let k = 1; k <= this.M.jump; k++) {
      if (!s.pointSolid(fx, this.feet - k * T - 4)) {
        if (!s.rectFree(fx - this.w / 2, this.feet - k * T - b.height - 4, this.w, b.height)) return false;
        b.setVelocityY(-Math.sqrt(2 * 2400 * (k * T + 40)));
        b.setVelocityX(dir * (this.d.speed ?? 120));
        return true;
      }
    }
    return false;
  }
  walk(dir, speed, drop = 0) {
    const b = this.body;
    if (!dir) return b.setVelocityX(0);
    this.facing = dir;
    if (this.safeStep(dir, drop)) { b.setVelocityX(dir * speed); this.stuck = false; }
    else if (this.hop(dir)) this.stuck = false;
    else { b.setVelocityX(0); this.stuck = true; }
  }
  moveTo(time, x, y, speed) {
    if (this.kind === 'flyer') return this.flyTo(x, y, speed);
    const dx = x - this.x;
    this.walk(Math.abs(dx) < 12 ? 0 : Math.sign(dx), speed, this.M.drop);
  }
  flyTo(x, y, speed) {
    const b = this.body, dx = x - this.x, dy = y - this.body.center.y, d = Math.hypot(dx, dy) || 1, v = Math.min(speed, d * 3);
    b.setVelocity(b.velocity.x * 0.85 + dx / d * v * 0.15, b.velocity.y * 0.85 + dy / d * v * 0.15);
    if (Math.abs(dx) > 8) this.facing = Math.sign(dx);
  }
  patrol(time) {
    const b = this.body, speed = (this.d.speed ?? 120) * 0.35, r = this.M.patrol;
    if (this.kind === 'flyer') {   // drifts left and right around home, bobbing
      const tx = this.home.x + Math.sin(time / 2200 + this.home.x) * r, ty = this.home.y + Math.sin(time / 700) * 18;
      return this.flyTo(tx, ty, speed * 1.6);
    }
    if (r <= 0) return this.stop();
    if (!this.safeStep(this.facing) || Math.abs(this.x - this.home.x) > r && Math.sign(this.x - this.home.x) === this.facing) this.facing *= -1;
    b.setVelocityX(this.safeStep(this.facing) ? this.facing * speed : 0);
  }

  // ---------- fighting (per behavior) ----------
  engage(time, l, dx, dist) {
    const speed = this.d.speed ?? 120, dy = Math.abs(l.chest - this.chest), range = this.a.range ?? (this.attackKind === 'shot' ? 520 : 140);
    const ready = time >= this.readyAt;
    if (this.kind === 'flyer') {
      // hovers above and a bit away from her, keeps the line free, then shoots or swoops
      const side = Math.sign(this.x - l.x) || 1, keep = this.attackKind === 'shot' ? Math.min(range * 0.6, 340) : 220;
      this.flyTo(l.x + side * keep, l.chest - this.M.fly, speed);
      this.facing = Math.sign(dx) || this.facing;
      if (ready && this.seeing && Math.hypot(dx, l.chest - this.chest) < range + 120) this.startWindup(time, l);
      return;
    }
    if (this.attackKind === 'shot') {   // keep the distance band, close in when the line is blocked
      let v = 0;
      if (!this.seeing && this.lastKnown) return this.moveTo(time, this.lastKnown.x, this.lastKnown.y, speed * 0.8);
      if (dist < range * 0.55 && this.safeStep(-this.facing)) v = -this.facing * speed;
      else if (dist > range) v = this.facing * speed * 0.8;
      if (v) this.walk(Math.sign(v), Math.abs(v), this.M.drop); else this.stop();
      this.facing = Math.sign(dx) || this.facing;   // walks backwards, keeps looking at her
      if (this.seeing && ready && dist <= this.S.sight) this.startWindup(time, l);
      return;
    }
    // melee, lunge (patrol, charger, ambusher after landing, boss)
    if (dist < range && dy < 160 && ready && this.seeing) return this.startWindup(time, l);
    if (dist > range * 0.7) this.walk(Math.sign(dx), this.kind === 'patrol' ? speed * 0.8 : speed, this.M.drop);
    else this.stop();
    if (!this.C.shield || this.guardOpen) this.facing = Math.sign(dx) || this.facing;
  }

  startWindup(time, l) {
    this.state = 'windup'; this.windupEnd = time + (this.a.windup ?? 450);
    if (this.attackKind === 'shot') {
      const m = this.muzzle(), ang = Math.atan2(l.chest - m.y, l.x - m.x);
      this.aimDir = { x: Math.cos(ang), y: Math.sin(ang) };
      this.facing = Math.sign(this.aimDir.x) || this.facing;
    }
    if (this.attackKind === 'dive') this.diveAt = { x: l.x, y: l.chest };
  }
  muzzle() {
    if (this.shape === 'drone') return { x: this.x + this.facing * this.w * 0.35, y: this.body.center.y + this.body.height * 0.15 };
    return { x: this.x + this.facing * this.h * 0.3, y: this.feet - this.h * 0.47 };
  }
  drawAim(time) {
    const m = this.muzzle(), left = Math.max(0, this.windupEnd - time) / (this.a.windup || 1), C = this.scene.combat;
    const end = C.blockedAt(m.x, m.y, m.x + this.aimDir.x * 1400, m.y + this.aimDir.y * 1400) || { x: m.x + this.aimDir.x * 1400, y: m.y + this.aimDir.y * 1400 };   // the line stops at the wall
    this.aim.lineStyle(3, 0xff4060, 0.25 + 0.6 * (1 - left)).lineBetween(m.x, m.y, end.x, end.y);
  }
  release(time, l) {
    const k = this.attackKind, b = this.body;
    this.readyAt = time + (this.a.cooldown ?? 900);
    if (k === 'shot') {
      const m = this.muzzle();
      if (this.scene.combat.blockedAt(this.x, m.y, m.x, m.y)) { this.state = 'recover'; this.until = time + 200; return; }   // muzzle in the wall: no shot
      for (let i = 0; i < (this.a.burst ?? 1); i++) this.scene.time.delayedCall(i * 110, () => this.alive && this.scene.combat.enemyShot(this, this.muzzle(), this.aimDir));
      this.state = 'recover'; this.until = time + 200 + 110 * ((this.a.burst ?? 1) - 1);
      return;
    }
    this.state = 'strike'; this.struck = false;
    if (k === 'dive') {
      const t = this.diveAt || { x: l.x, y: l.chest }, dx = t.x - this.x, dy = t.y - this.body.center.y, d = Math.hypot(dx, dy) || 1, v = (this.d.speed ?? 300) * 2.6;
      b.setVelocity(dx / d * v, dy / d * v); this.until = time + Math.min(700, d / v * 1000 + 120);
      return;
    }
    if (k === 'drop') { b.allowGravity = true; b.setVelocity(0, 200); this.onCeiling = false; this.until = time + 2000; return; }
    this.until = time + (k === 'lunge' ? 180 : 120);
    this.scene.fx.slash(this.x + this.facing * 20, this.feet - this.h * 0.55, this.facing, (this.weapon?.range ?? 80), 0xff9a7a);
  }
  // the ambusher hits the floor: splash around it, then it fights like a charger
  landed(time, l) {
    this.scene.fx.puff?.(this.x, this.feet, 0x7fbf6a); this.scene.cam.shake(120, 0.004);
    this.strike(time, l, true);
    this.state = 'recover'; this.until = time + 360; this.attackKind = this.a.kindAfter || 'lunge'; this.kind = 'charger';
  }
  // the strike zone is cut at walls (combat.zone), so nothing hits through them
  strike(time, l, around = false) {
    const C = this.scene.combat, reach = (this.weapon?.range ?? 80) + 40 + this.w / 2;
    const z = around ? [...C.zone(this.x, 1, reach, this.body.top, this.feet - 10), ...C.zone(this.x, -1, reach, this.body.top, this.feet - 10)]
      : C.zone(this.x, this.facing, reach, this.body.top - this.h * 0.1, this.feet - 12);
    if (this.attackKind === 'dive' && !around) z.push(...C.zone(this.x, -this.facing, this.w / 2 + 10, this.body.top, this.feet));
    if (!C.inZone(z, l.body)) return;
    this.struck = true;
    if (l.hurt(time, this.d.damage ?? 10, this.x)) this.scene.onLeylaHit(this.d.damage ?? 10);
  }

  // ---------- counters ----------
  // dodge (Gegner › Konter › Weicht aus %): incoming nails and strikes get one roll each, then a hop away
  watchDodge(time, l) {
    if (!this.C.dodge || this.busy || this.state === 'patrol' || this.state === 'lurk' || time < this.dodgeReady) return;
    const s = this.scene;
    for (const p of s.combat.shots) {
      if (!p.friendly || p.dead || this.dodged.has(p)) continue;
      const ahead = (this.x - p.x) * Math.sign(p.vx || 1);
      if (ahead < 0 || ahead > 300 || Math.abs(p.y - this.chest) > this.body.height * 0.7) continue;
      this.dodged.add(p);
      if (Math.random() * 100 < this.C.dodge) return this.dodge(time, Math.sign(p.vx || 1), true);
    }
    const a = l.attack;
    if (a && !this.dodged.has(a) && Math.abs(l.x - this.x) < 260 && Math.sign(this.x - l.x) === l.facing && Math.abs(l.chest - this.chest) < 160) {
      this.dodged.add(a);
      if (Math.random() * 100 < this.C.dodge) this.dodge(time, Math.sign(this.x - l.x) || 1, false);
    }
  }
  dodge(time, away, jump) {
    const b = this.body, dist = this.C.dodgeDist;
    this.state = 'dodge'; this.until = time + 320; this.dodgeReady = time + this.C.dodgeEvery;
    if (this.kind === 'flyer') b.setVelocity(away * dist * 2, (Math.random() < 0.5 ? -1 : 1) * dist * 2.5);
    else { b.setVelocity(this.safeStep(away, 1) ? away * dist / 0.32 : 0, -(jump ? 620 : 380)); }
    this.scene.fx.puff?.(this.x, this.feet, 0x8b949e);
    this.say('hopp', '#9ad1ff');
  }
  // a nail that meets it mid-hop flies through and stays harmless for it (combat.update asks)
  dodging(p) {
    if (!p.friendly) return false;
    if (this.passed?.has(p)) return true;
    if (this.state !== 'dodge') return false;
    (this.passed ??= new WeakSet()).add(p);
    return true;
  }

  // info: { kind: 'melee' | 'shot' | 'blank', heavy } → 'blocked' when the shield took it
  hit(time, damage, knockback, dir, crit, info = {}) {
    if (!this.alive) return;
    const s = this.scene, heavy = !!info.heavy;
    if (this.state === 'lurk') this.fall();
    const front = this.facing === -dir;
    // shield in front: shots and light hits bounce off, a heavy hit knocks the guard open (Gegner › Konter › Schild vorn)
    if (this.C.shield && front && !this.guardOpen && this.state !== 'stagger') {
      if (!heavy) {
        s.fx.sparks(this.x + this.facing * this.w * 0.7, this.chest, 0xd8e6f0, 8);
        s.fx.text(this.x, this.body.top - 10, 'Block', { color: '#8fb3c9', size: 38, rise: 26 });
        this.body.setVelocityX(dir * 90);
        this.lastSeen = time; if (this.state === 'patrol') { this.state = 'engage'; }
        return 'blocked';
      }
      this.guardOpen = true; this.state = 'stagger'; this.until = time + this.C.stagger; this.stunUntil = 0;
      s.fx.sparks(this.x + this.facing * this.w * 0.7, this.chest, 0xffd27a, 16);
      s.fx.text(this.x, this.body.top - 40, 'Deckung offen!', { color: '#ffd27a', size: 40, rise: 40 });
      damage = Math.round(damage * 0.5);
    }
    // armour plates: light hits only scratch, heavy hits crack a plate (Gegner › Konter › Panzerung)
    if (this.plates > 0) {
      if (heavy) {
        this.plates--;
        s.fx.sparks(this.x, this.chest, 0xc0c8d0, 18); s.cam.shake(120, 0.005);
        s.fx.text(this.x, this.body.top - 40, this.plates ? `Panzer ${this.plates}` : 'Panzer bricht!', { color: '#c0c8d0', size: 40, rise: 40 });
      } else {
        damage = Math.max(1, Math.round(damage * this.C.chip / 100));
        s.fx.sparks(this.x - dir * this.w * 0.4, this.chest, 0xc0c8d0, 5);
        knockback = (knockback ?? 0) * 0.3;
      }
    }
    this.hp -= damage;
    this.barUntil = time + 2500;
    this.sprite.setTintFill(crit ? 0xffd27a : 0xffffff);
    s.time.delayedCall(70, () => this.alive && this.sprite.clearTint());
    s.fx.text(this.x + (Math.random() - 0.5) * 40, this.body.top - 10, String(damage) + (crit ? '!' : ''), { color: crit ? '#ffd27a' : '#ffffff', size: crit ? 56 : 42 });
    s.fx.blood(this.x, this.chest, crit ? 18 : 10);
    this.body.setVelocity(dir * (knockback ?? 0), this.kind === 'flyer' ? -(knockback ?? 0) * 0.2 : -(knockback ?? 0) * 0.35);
    this.stunUntil = time + 220;
    // hit from somewhere: it knows where she is now, turns round and fights
    this.lastSeen = time; this.lastKnown = { x: s.leyla.x, y: s.leyla.chest, at: time };
    if (['windup', 'patrol', 'alert', 'search'].includes(this.state)) { this.state = 'engage'; this.readyAt = Math.max(this.readyAt, time + 350); }
    if (!this.C.shield || this.guardOpen) this.facing = -dir || this.facing;
    if (this.hp <= 0) this.die(time, dir);
  }

  // ---------- ceiling (ambusher) ----------
  toCeiling() {
    const s = this.scene, T = s.T, b = this.body;
    for (let k = 1; k <= 10; k++) {
      const y = this.home.y - k * T;
      if (s.pointSolid(this.x, y)) {
        const top = (Math.floor(y / T) + 1) * T;
        b.reset(this.x, top + b.height / 2 + 1); b.allowGravity = false;
        this.state = 'lurk'; this.onCeiling = true;
        return;
      }
    }
  }
  fall() { this.body.allowGravity = true; this.onCeiling = false; this.state = 'engage'; this.attackKind = this.a.kindAfter || 'lunge'; this.kind = 'charger'; }

  die(time, dir) {
    this.state = 'dead';
    this.body.enable = false;
    this.warn.setVisible(false); this.aim.clear(); this.bar.clear(); this.gear.clear();
    this.scene.fx.blood(this.x, this.chest, 26);
    this.scene.tweens.add({ targets: this.sprite, rotation: dir * 1.4, alpha: 0, y: this.sprite.y + 10, duration: 650, ease: 'Cubic.easeIn' });
    this.scene.onKill(this);
  }

  // ---------- look ----------
  draw(time) {
    const flip = this.look.flip ? this.facing > 0 : this.facing < 0, b = this.body;
    if (this.onCeiling) this.sprite.setFlipY(true).setOrigin(this.look.ox, 1 - this.look.oy).setPosition(b.center.x, b.top);
    else this.sprite.setFlipY(false).setOrigin(this.look.ox, this.look.oy).setPosition(b.center.x, this.shape === 'drone' ? b.bottom + this.h * 0.08 : b.bottom);
    this.sprite.setFlipX(flip);
    if (this.state === 'windup' && !this.stunned) this.sprite.setTintFill(Math.floor(time / 60) % 2 ? 0xff4060 : 0xffffff);
    else if (time > this.stunUntil - 150) this.sprite.clearTint();
    this.sprite.setAlpha(this.state === 'dodge' ? 0.7 : 1);
    this.warn.setPosition(this.x, this.onCeiling ? b.bottom + 70 : b.top - 6);
    // shield and armour from code (until the enemies have their own look)
    const g = this.gear; g.clear();
    if (this.C.shield) {
      const open = this.guardOpen || this.state === 'stagger', fx = this.x + this.facing * (this.w / 2 + (open ? -6 : 10)), top = b.top + b.height * 0.12, hh = b.height * 0.62;
      g.fillStyle(open ? 0x3a4450 : 0x5d7080, 1).fillRoundedRect(fx - 9, top + (open ? 30 : 0), 18, hh, 5);
      g.lineStyle(3, open ? 0x2a3138 : 0xb8c7d4, 1).strokeRoundedRect(fx - 9, top + (open ? 30 : 0), 18, hh, 5);
      g.fillStyle(0xffd27a, open ? 0.2 : 0.8).fillRect(fx - 3, top + hh * 0.45 + (open ? 30 : 0), 6, 10);
    }
    if (this.plates > 0) {
      g.fillStyle(0x9aa6b2, 0.85).fillRoundedRect(this.x - this.w * 0.55, b.top + b.height * 0.22, this.w * 1.1, b.height * 0.3, 6);
      g.lineStyle(2, 0x2a3138, 1).strokeRoundedRect(this.x - this.w * 0.55, b.top + b.height * 0.22, this.w * 1.1, b.height * 0.3, 6);
      for (let i = 0; i < this.plates; i++) g.fillStyle(0xe8eef4, 1).fillCircle(this.x - (this.plates - 1) * 7 + i * 14, b.top + b.height * 0.37, 4);
    }
    this.bar.clear();
    if (time < this.barUntil) {
      const w = Math.round(Math.max(60, this.h * 0.46)), x = this.x - w / 2, y = (this.onCeiling ? b.bottom + 20 : b.top - 30), f = Math.max(0, this.hp / (this.d.health || 1));
      this.bar.fillStyle(0x0d0a12, 0.8).fillRect(x - 3, y - 3, w + 6, 14).fillStyle(0xe5484d).fillRect(x, y, w * f, 8);
    }
  }

  state_() {
    return { id: this.id, state: this.state, kind: this.kind, attack: this.attackKind, x: Math.round(this.x), feet: Math.round(this.feet), hp: this.hp, facing: this.facing,
      seeing: this.seeing, lastKnown: this.lastKnown && { x: Math.round(this.lastKnown.x), y: Math.round(this.lastKnown.y) }, plates: this.plates, guardOpen: !!this.guardOpen, ceiling: !!this.onCeiling };
  }

  destroy() { for (const o of [this.box, this.sprite, this.bar, this.warn, this.aim, this.gear]) o.destroy(); }
}

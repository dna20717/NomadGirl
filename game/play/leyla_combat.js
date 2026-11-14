// Leyla fights (#017 split from leyla.js): melee combo, magazine and reloading, drawing the gun, combat mode.
// Mixed into Leyla (game/play/leyla.js): the methods keep their `this`, nothing else changes.
import { recoilTexture } from './recoil.js';
import { makeSfx } from './sfx.js';

export class LeylaCombat {
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
}

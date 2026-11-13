// Leyla's drone (area "Drohne"): pure decoration, no physics. Flies behind Leyla with a soft lag, bobs and tilts,
// and shows a mood: a face (frame of its look) plus an optional kaomoji bubble.
// Moods come from events (kill, hit, cleared, dash, down) and from states (alert, lowHealth, bored, sleep);
// while Leyla is moving, a random mood (curious, scan) pops up now and then.

import { suffering } from '../tank.js';
import { bonuses } from '../techtree.js';
import { Cables, hullPoint } from '../drone_cables.js';

const STATES = ['down', 'lowHealth', 'alert', 'zen', 'sleep', 'bored'];   // lasting moods, most important first

export class Drone {
  constructor(scene, data) {
    this.scene = scene; this.d = data.drone || {};
    // AvA suffers with her tank (Cryo-Tank › Phasen: Akku −, Glitches, Scheinwerfer flackert); in the camp she is home
    this.suffer = scene.mode === 'run' && scene.box?.save?.tank ? suffering(data, scene.box.save) : null;
    const A = data.assets || {}, a = A[this.d.look], tex = id => id && scene.textures.exists(id);
    this.moods = Object.fromEntries((this.d.moods || []).map(m => [m.mood, m]));
    this.f = this.d.follow || {};
    const has = a && tex(this.d.look), F = this.d.face || {};
    // pixel art stays crisp (the drone is drawn 1:1)
    for (const id of [this.d.look, F.look, F.glass, ...(this.d.parts || []).map(r => r.look)]) if (tex(id)) scene.textures.get(id).setFilter(Phaser.Textures.FilterMode.NEAREST);
    // layers (Daniel, 10.11.2026: "modulare Drohne"): cables behind, hull, face on the screen, glass, parts in front/behind
    const [fw, fh] = has ? (a.frameSize || [scene.textures.get(this.d.look).getSourceImage().width, scene.textures.get(this.d.look).getSourceImage().height]) : [1, 1];
    const [ox, oy] = has && a.origin ? a.origin : [fw / 2, fh / 2];
    this.org = [ox, oy];
    this.hull = has ? (a.kind === 'animation' ? scene.add.sprite(0, 0, this.d.look, 0) : scene.add.image(0, 0, this.d.look)) : scene.add.image(0, 0, 'px').setTint(0xe0287a);
    if (has) this.hull.setOrigin(ox / fw, oy / fh);
    this.scale = has ? (this.d.height || a.height || fh) / fh : 60;
    const kids = [];
    const part = (r) => {
      const pa = A[r.look]; if (!tex(r.look)) return null;
      const img = pa.kind === 'animation' ? scene.add.sprite(0, 0, r.look, 0) : scene.add.image(0, 0, r.look);
      if (pa.kind === 'animation' && scene.anims.exists(r.look)) img.play(r.look);
      const [pw, ph] = pa.frameSize || [img.width, img.height], [px, py] = pa.origin || [pw / 2, ph / 2];
      this.partImgs.push({ r, img });
      return img.setOrigin(px / pw, py / ph).setPosition((r.at?.[0] ?? ox) - ox, (r.at?.[1] ?? oy) - oy);
    };
    this.partImgs = [];
    for (const r of this.d.parts || []) if (r.layer === 'behind') { const p = part(r); if (p) kids.push(p); }
    kids.push(this.hull);
    // antigravity ring: soft additive glow over the painted ring
    const R = this.d.ring;
    if (has && R?.at) {
      const [rw, rh] = R.size || [40, 10], col = parseInt((R.color || '#20d6c7').slice(1), 16);
      this.ring = scene.add.graphics().setPosition(R.at[0] - ox, R.at[1] - oy).setBlendMode(Phaser.BlendModes.ADD);
      for (const [m, al] of [[1.9, 0.12], [1.4, 0.22], [1, 0.4]]) this.ring.fillStyle(col, al).fillEllipse(0, 0, rw * m, rh * m);
      kids.push(this.ring);
    }
    this.faced = has && tex(F.look);
    if (this.faced) {
      const fa = A[F.look], [cw, chh] = fa.frameSize, [cx, cy] = fa.origin || [cw / 2, chh / 2], [sx, sy] = F.screen || [ox, oy];
      this.faceAt = [sx - ox, sy - oy];
      this.face = scene.add.sprite(this.faceAt[0], this.faceAt[1], F.look, 0).setOrigin(cx / cw, cy / chh);
      kids.push(this.face);
      if (tex(F.glass)) { const ga = A[F.glass], gi = scene.add.image(0, 0, F.glass); const [gw, gh] = [gi.width, gi.height], [gx, gy] = ga.origin || [ox, oy]; kids.push(gi.setOrigin(gx / gw, gy / gh)); }
    }
    for (const r of this.d.parts || []) if (r.layer !== 'behind') { const p = part(r); if (p) kids.push(p); }
    const depth = this.d.layer === 'front' ? 11 : 9.5;
    this.sprite = scene.add.container(0, 0, kids).setScale(this.scale).setDepth(depth);
    this.refreshParts();
    this.cables = new Cables(this.d.cables, this.d.cable);
    this.rope = scene.add.graphics().setDepth(depth - 0.01);
    this.half = (has ? oy : 0.5) * this.scale;   // from the anchor up to the top edge
    const B = this.d.bubble || {};
    this.bubble = scene.add.text(0, 0, '', {
      fontFamily: 'Inter, "Hiragino Sans", "Noto Sans CJK JP", "Yu Gothic", sans-serif', fontSize: `${B.size || 30}px`,
      color: B.color || '#7ff6ff', backgroundColor: B.background || '#140c1c', padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 1).setDepth(12).setAlpha(0);
    this.reset();
  }

  // parts with a "Gegenstand" show while that item sits on AvA in the inventory (inv.wear), others follow "Angebaut"
  refreshParts() {
    const worn = new Set(Object.values(this.scene.box?.save?.inv?.wear || {}).filter(Boolean)), hasInv = !!this.scene.box?.save?.inv?.wear;
    for (const { r, img } of this.partImgs || []) img.setVisible(r.item && hasInv ? worn.has(r.item) : !!r.on);
  }

  reset() {
    const l = this.scene.leyla, [dx, dy] = this.f.offset || [-110, -210];
    this.x = l.x + dx * l.facing; this.y = l.feet + dy; this.side = l.facing;
    this.turnAt = 0; this.event = null; this.still = 0; this.mood = null; this.bubbleUntil = 0;
    this.nextRandom = this.scene.time.now + this.randomGap();
    this.sprite.setVisible(this.d.enabled !== false); this.rope.setVisible(this.d.enabled !== false); this.bubble.setAlpha(0);
    this.cables.ropes = null; this.blinkAt = this.scene.time.now + this.blinkGap(); this.boostUntil = 0; this.faceFrame = 0;
  }

  blinkGap() { const [a, b] = this.d.face?.blink?.every || [2.5, 6]; return (a + Math.random() * Math.max(0, b - a)) * 1000; }

  randomGap() { const [a, b] = this.d.idle?.randomEvery || [8, 16]; return (a + Math.random() * Math.max(0, b - a)) * 1000; }

  // event moods (kill, hit, cleared, dash, down …) win for their duration
  react(mood) {
    const m = this.moods[mood];
    this.scene.hud?.tut?.event(mood);   // the field guide listens (#011): alert, hit, kill, cleared, down …
    if (this.gone || !m || this.d.enabled === false) return;
    const time = this.scene.time.now;
    this.event = { mood, until: m.duration ? time + m.duration : Infinity };
    if (mood === 'dash') this.boostUntil = time + 450;
    this.show(mood, time);
  }

  show(mood, time) {
    if (this.mood === mood) return;
    this.mood = mood;
    const m = this.moods[mood] || this.moods.idle || { frame: 0 };
    this.setFace(m.frame ?? 0);
    const pop = this.face ? this.scene.tweens.add({ targets: this.face, scaleX: 1.15, scaleY: 1.15, duration: 90, yoyo: true })
      : this.scene.tweens.add({ targets: this.sprite, scaleY: this.scale * 1.12, duration: 90, yoyo: true });
    if (m.kaomoji && this.d.bubble?.show !== false) {
      this.bubble.setText(m.kaomoji).setAlpha(1);
      this.bubbleUntil = time + Math.max(1200, m.duration && m.duration < Infinity ? m.duration : 2200);
    } else this.bubbleUntil = 0;
    return pop;
  }

  // face frame: on the screen layer, or (old drone) the hull's own frame
  setFace(frame) {
    const t = this.face || (this.hull.setFrame ? this.hull : null);
    if (!t) return;
    this.faceFrame = Math.min(frame, t.texture.frameTotal - 2);
    t.setFrame(this.faceFrame);
  }

  // the lasting mood from the situation
  situation(time, dt) {
    const s = this.scene, l = s.leyla, I = this.d.idle || {};
    if (!l.alive) return 'down';
    if (l.health / (s.data_.leyla?.health || 100) * 100 < (this.d.lowHealth ?? 30)) return 'lowHealth';
    const near = s.enemies.some(e => e.alive && Math.abs(e.x - l.x) < (this.d.alertRange ?? 700) && Math.abs(e.feet - l.feet) < 400);
    if (near && !this.alerted) { this.alerted = true; this.react('alert'); }
    if (!near) this.alerted = false;
    // Leyla in the yoga pose for a while: the drone joins in (Daniel: "Zen-Modus")
    this.zen = l.state === 'pose' && !l.pose?.out ? (this.zen || 0) + dt : 0;
    if (this.zen > (I.zenAfter ?? 2) * 1000) return 'zen';
    // near her own body in the camp (Daniel, 12.11.2026: „ein liebevolles Gesicht, wenn sie in der Nähe des Tanks herumfliegt“)
    const tank = s.mode === 'camp' && s.camp?.benches?.list?.find(b => b.tank);
    if (tank && !tank.tank.p?.dead && Math.hypot(this.x - tank.cx, this.y - (tank.floor - 120)) < (s.data_.tank?.love ?? 360)) return 'love';
    // in a run with a weak tank she sighs now and then
    if (this.suffer?.index >= 4 && time > (this.sighAt ||= time + 9000)) { this.sighAt = time + 14000 + Math.random() * 12000; this.react('tankWeak'); }
    const moving = Math.abs(l.body.velocity.x) > 20 || Math.abs(l.body.velocity.y) > 20 || l.state !== 'normal';
    this.still = moving ? 0 : this.still + dt;
    if (this.still > (I.sleepAfter ?? 14) * 1000) return 'sleep';
    if (this.still > (I.boredAfter ?? 6) * 1000) return 'bored';
    if (time > this.nextRandom) { this.nextRandom = time + this.randomGap(); if (moving && !near && l.state !== 'pose') this.react(Math.random() < 0.5 ? 'curious' : 'scan'); }   // not into the yoga pose (would break the zen)
    return 'idle';
  }

  // the last rescue (design.md › k.o. neu): AvA flickers out and is gone until the next Durchgang
  die() {
    if (this.gone) return;
    this.gone = true;
    this.scene.fx?.text?.(this.x, this.y - 60, '(×_×)', { color: '#ff6b8a', size: 40, rise: 40, life: 1600 });
    this.scene.tweens.add({ targets: this.sprite, alpha: { from: 1, to: 0 }, duration: 1400, ease: 'Stepped', easeParams: [7], onComplete: () => this.sprite.setVisible(false) });
  }

  update(time, dt) {
    if (this.gone) return;
    if (this.d.enabled === false) return;
    const l = this.scene.leyla, F = this.f, [dx, dy] = F.offset || [-110, -210];
    // turn around a moment after Leyla does
    if (l.facing !== this.side) { this.turnAt ||= time + (F.turnDelay ?? 250); if (time >= this.turnAt) { this.side = l.facing; this.turnAt = 0; } } else this.turnAt = 0;
    // camp: roams freely (Drohne › Im Camp frei fliegen), picks a new spot every few seconds, sometimes visits Leyla
    const R = this.d.roam || {}, area = this.roamArea;
    let tx = l.x + dx * this.side, ty = l.feet + dy, smooth = F.smooth ?? 0.08;
    if (area && R.enabled !== false && !(this.scene.pad?.right && Math.hypot(...this.scene.pad.right) > 0.02 && this.d.leash?.enabled !== false)) {
      if (!this.roamTo || time > this.roamAt) {
        const [a, b] = R.every || [3, 7], [h0, h1] = R.height || [180, 460], visit = Math.random() * 100 < (R.visitLeyla ?? 30);
        // she often looks in on her own body in the cryo tank (Drohne › Im Camp frei fliegen › Besucht den Tank %)
        const tank = this.scene.camp?.benches?.list?.find(b => b.tank && !b.tank.p?.dead), toTank = !visit && tank && Math.random() * 100 < (R.visitTank ?? 30);
        const rx = toTank ? tank.cx + (Math.random() - 0.5) * 80 : visit ? l.x + (Math.random() < 0.5 ? -1 : 1) * 120 : area.x0 + Math.random() * (area.x1 - area.x0);
        this.roamTo = { x: rx, y: toTank ? tank.floor - 150 - Math.random() * 80 : area.ground - (h0 + Math.random() * (h1 - h0)), leyla: visit };
        this.roamAt = time + (a + Math.random() * (b - a)) * 1000;
      }
      if (this.roamTo.leyla) this.roamTo.x += (l.x + this.side * -110 - this.roamTo.x) * 0.02;
      tx = this.roamTo.x; ty = this.roamTo.y; smooth = R.smooth ?? 0.02;
    }
    // right stick: AvA hangs on Leyla like on a rubber band (Daniel, 12.11.2026: „je weiter weg, desto höher der Widerstand,
    // lässt man los, geht sie zurück in ihre Position. So hätte man eine Tischlampe dabei“); Drohne › Gummiband
    const G = this.d.leash || {}, st = G.enabled === false ? [0, 0] : this.scene.pad?.right || [0, 0], m = Math.hypot(st[0], st[1]);
    if (m > 0.02) {
      const reach = G.reach ?? 380, stiff = Math.max(0.01, G.stiffness ?? 2.4), pull = reach * (1 - Math.exp(-stiff * m)) / (1 - Math.exp(-stiff));
      tx = l.x + dx * this.side * (1 - m) + st[0] / m * pull; ty = l.feet + dy + st[1] / m * pull;
      smooth = (G.smooth ?? 0.06) * (1 - 0.6 * m * m);   // the further out, the heavier it pulls
      this.aim = Math.atan2(st[1], st[0]); this.leashed = true; this.roamTo = null;
    } else if (this.leashed) { this.leashed = false; this.aimUntil = time + (G.aimHold ?? 600); this.parkUntil = time + (this.d.platform?.park ?? 1800); this.parkAt = [this.x, this.y]; }
    // parked after the rubber band (Drohne › Plattform › Parkt nach dem Loslassen): she waits there a moment, so Leyla can climb onto her
    if (!this.leashed && this.parkAt && (time < (this.parkUntil || 0) || this.carrying)) { tx = this.parkAt[0]; ty = this.parkAt[1]; smooth = 0.25; }
    else if (!this.leashed) this.parkAt = null;
    if (!this.leashed && this.aim != null && time > (this.aimUntil || 0)) this.aim = null;
    // building the rig (build_mode.js): she is the hand that carries the parts, Leyla sits at the fire
    if (this.build) { tx = this.build.x; ty = this.build.y; smooth = this.build.smooth ?? 0.3; this.roamTo = null; }
    // docked on a workbench (Werkstätten › Benutzen › AvA dockt an): flies there and sits still
    if (this.dock) { if (time > this.dock.until) this.dock = null; else { tx = this.dock.x; ty = this.dock.y; smooth = 0.07; } }
    // carrying Leyla she holds still; with Leyla standing on her the right stick lets her hover a little, but that eats the battery
    // (Daniel, 12.11.2026: „kurz schweben mit Leyla ist ok, aber mit dem Gewicht kann sie das nicht lange machen“, Drohne › Plattform › Schweben)
    this.flying = false;
    if (this.carrying) {
      const P = this.d.platform || {}, st = this.scene.pad?.right || [0, 0], m = Math.hypot(st[0], st[1]);
      const hanging = l.state === 'hang' && l.ledge?.drone;
      if ((this.riding || hanging) && P.fly !== false && m > 0.2 && this.battery > 0) {
        const v = (P.flySpeed ?? 150) * Math.min(1, m) * dt / 1000, dx = st[0] / m * v, dy = st[1] / m * v * (st[1] < 0 ? (P.flyUp ?? 60) / 100 : 1);
        if (this.carryLeyla(dx, dy)) { this.x += dx; this.y += dy; this.flying = true; }
      }
      tx = this.x; ty = this.y;
    }
    const k = 1 - Math.pow(1 - Math.min(1, smooth), dt / 16.67);
    const px = this.x; this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    const vx = (this.x - px) / Math.max(1, dt) * 1000;
    this.updatePlatform(time, dt);
    // zen: slow, deep breathing instead of the usual bobbing (phase kept smooth when it switches)
    const zen = this.mood === 'zen', bs = (F.bobSpeed ?? 0.6) * (zen ? 0.35 : 1);
    this.bobPh = (this.bobPh || 0) + dt / 1000 * Math.PI * 2 * bs;
    const bob = Math.sin(this.bobPh) * (F.bob ?? 10) * (zen ? 1.8 : 1);
    // flying towards a side: look that way, otherwise look where Leyla looks
    const look = this.aim != null && Math.abs(Math.cos(this.aim)) > 0.2 ? Math.sign(Math.cos(this.aim)) : Math.abs(vx) > 120 ? Math.sign(vx) : this.side;
    const rot = Math.max(-1, Math.min(1, vx / 900)) * (F.tilt ?? 8) * Math.PI / 180;   // nose dips into the flight direction
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y + bob)).setScale(this.scale * (look < 0 ? -1 : 1), this.scale).setRotation(rot);
    // mood: an event for its duration, otherwise the situation
    const lasting = this.situation(time, dt);
    if (this.event && (time > this.event.until || STATES.includes(lasting) && STATES.indexOf(lasting) < 2)) this.event = null;
    this.show(this.event ? this.event.mood : lasting, time);
    this.updateFace(time, look);
    this.updateRing(time, vx);
    this.updateCables(dt, rot, look);
    const top = this.y + bob - this.half - 6;
    this.bubble.setPosition(this.x + look * 30, top);
    if (this.bubbleUntil && time > this.bubbleUntil) this.bubble.setAlpha(Math.max(0, this.bubble.alpha - dt / 250));
  }

  // ---------- AvA as a platform (Daniel, 12.11.2026: „Leyla kann dran hochklettern und auf ihr stehen, bis der Akku alle ist“) ----------
  // Drohne › Plattform: while she is pulled out (right stick) or parked after it, her top is a one-way platform and her sides are ledges.
  // Carrying Leyla (standing, hanging, pulling up) she holds still and the battery drains; empty = she sags away and Leyla drops.
  makePlatform() {
    const s = this.scene, P = this.d.platform || {};
    this.battery = 1; this.carrying = false;
    if (P.enabled === false) return;
    this.plat = s.add.zone(this.x, this.y, P.width ?? 110, 16);
    s.physics.add.existing(this.plat, true);
    this.platBar = s.add.graphics().setDepth(12);
    s.physics.add.collider(s.leyla.box, this.plat, null, () => {
      const l = s.leyla, b = l.body;
      return this.platOn && l.state !== 'climb' && l.state !== 'swing' && s.time.now >= l.dropUntil && b.velocity.y >= 0 && b.prev.y + b.height <= this.plat.body.top + 4;
    });
  }
  platformTop() { return this.y - this.half + (this.d.platform?.inset ?? 14); }
  // move Leyla along with her (standing on her or hanging at her): false if Leyla would end up in a wall
  carryLeyla(dx, dy) {
    const l = this.scene.leyla, b = l.body;
    if (!this.scene.rectFree(b.x + dx + 2, b.y + dy, b.width - 4, b.height - 2)) return false;
    b.x += dx; b.y += dy; b.prev.x += dx; b.prev.y += dy;
    if (l.ledge?.drone) { l.ledge.x += dx; l.ledge.y += dy; }
    return true;
  }
  // the grip at her back (Drohne › Plattform › Hängen am Anbauteil, the Greifarm): world point
  gripPoint() {
    const P = this.d.platform || {}, name = P.hangPart || 'Greifarm', part = (this.partImgs || []).find(p => p.r.name === name);
    const [ax, ay] = part?.img.visible && part.r.at ? part.r.at : P.hangAt || [40, 80], [ox, oy] = this.org || [0, 0], look = this.sprite.scaleX < 0 ? -1 : 1;
    return { x: this.x + (ax - ox) * this.scale * look, y: this.y + (ay - oy) * this.scale };
  }
  // how much longer her battery lasts with the parts on her (Gegenstände › AvA: mehr Akku, summed up)
  batteryBonus() {
    const wear = this.scene.box?.save?.inv?.wear || {}, I = this.scene.data_.items || {};
    return ['bow', 'tail', 'core', 'module'].reduce((n, k) => n + (I[wear[k]]?.battery || 0), 0) + (bonuses(this.scene.data_, this.scene.box?.save).droneBattery || 0);   // + Techtree
  }
  updatePlatform(time, dt) {
    const P = this.d.platform || {}, s = this.scene, l = s.leyla;
    if (!this.plat || !l) return;
    const w = P.width ?? 110, top = this.platformTop(), halfW = l.size.w / 2;
    // easy to get on (Daniel, 12.11.2026: „zu schwer, sich an die Drohne zu hängen … lass Leyla direkt auf bzw. in der oberen Hälfte stehen“):
    // in the air with her feet in AvA's upper half she simply stands on top; near the grip at her back she grabs it by herself
    const air = l.state === 'normal' && !(l.body.blocked.down || l.body.touching.down) && s.now - (l.lastGround ?? -1e9) > 100 && time >= (l.dropUntil || 0);
    if (this.platOn && air && l.body.velocity.y > -250 && Math.abs(l.x - this.x) < w / 2 + halfW * 0.5 && l.feet >= top - 12 && l.feet <= top + (P.snap ?? 70)) {
      const b = l.body, dy = top - l.feet; b.y += dy; b.prev.y = b.y; b.setVelocityY(0);
    } else if (this.platOn && air && time >= (l.noGrabUntil || 0) && P.grab !== 0) {
      const g = this.gripPoint(), h = l.hand(), dir = l.facing || 1;
      const L = { x: g.x + dir * halfW, y: g.y, dir, drone: true, point: true };
      if (Math.hypot(h.x - g.x, h.y - g.y) < (P.grab ?? 70) && l.hangFits(L)) l.startHang(L);   // only where her legs hang free
    }
    // standing on her, hanging at her edge or pulling up onto her
    const onTop = this.platOn && (l.body.blocked.down || l.body.touching.down) && Math.abs(l.feet - top) < 10 && Math.abs(l.x - this.x) < w / 2 + halfW;
    this.carrying = !!(onTop || l.ledge?.drone); this.riding = !!onTop;
    const ready = time >= (this.emptyUntil || 0);
    this.platOn = P.enabled !== false && l.alive && ready && this.battery > 0 && !this.build && !this.dock && (this.leashed || this.parkAt || this.carrying);
    const cap = (P.battery ?? 4) * 1000 * (1 + (this.batteryBonus?.() || 0) / 100) * (1 - (this.suffer?.battery || 0) / 100);
    if (this.carrying) {
      this.battery = Math.max(0, this.battery - dt / cap * (this.flying ? P.flyDrain ?? 3 : 1));
      const sag = (P.sag ?? 12) * (1 - this.battery) * dt / 1000;   // the motors labour: she sinks a little (Leyla with her)
      if (l.state === 'hang' && l.ledge?.drone) { if (this.carryLeyla(0, sag)) this.y += sag; } else this.y += sag;
      if (this.battery <= 0) this.empty(time);
    } else this.battery = Math.min(1, this.battery + dt / ((P.recharge ?? 6) * 1000));
    this.plat.setPosition(this.x, top + 8); this.plat.body.updateFromGameObject();
    this.plat.body.enable = this.platOn;
    // battery bar over her while it is not full
    const g = this.platBar.clear();
    if (this.battery < 0.995 || this.carrying) {
      const bw = 64, x0 = this.x - bw / 2, y0 = top - 26, c = this.battery > 0.5 ? 0x3fe0d0 : this.battery > 0.2 ? 0xffd27a : 0xff4d6d;
      g.fillStyle(0x0d0a12, 0.75).fillRoundedRect(x0 - 3, y0 - 3, bw + 6, 12, 4);
      g.fillStyle(c, 1).fillRoundedRect(x0, y0, Math.max(2, bw * this.battery), 6, 3);
    }
  }
  // battery empty: she sags away for a moment (Drohne › Plattform › Erholt sich ab), Leyla drops off
  empty(time) {
    const s = this.scene, l = s.leyla, P = this.d.platform || {};
    this.emptyUntil = time + (P.cooldown ?? 1500); this.parkAt = null; this.parkUntil = 0; this.carrying = false; this.platOn = false;
    if (this.plat) this.plat.body.enable = false;
    if ((l.state === 'hang' || l.state === 'mantle') && l.ledge?.drone) { l.body.checkCollision.none = false; l.setStanding(); l.leaveHang(time); }
    this.react('gearWorse');
    s.fx?.text?.(this.x, this.y - this.half - 20, 'Akku leer!', { color: '#ff9a9a', size: 30, rise: 40, life: 900 });
  }
  // a ledge at her side for Leyla's hands (scene.ledgeAt asks here when no wall edge is in reach)
  ledgeFor(x, handY, dir, reach, halfW, up, side) {
    if (!this.platOn || !this.plat) return null;
    const w = this.d.platform?.width ?? 110, top = this.platformTop(), edge = dir > 0 ? this.x - w / 2 : this.x + w / 2;
    const gap = (edge - (x + dir * halfW)) * dir;
    if (gap < -halfW * 1.5 || gap > Math.max(6, side) + 6) return null;   // also a little from under her edge
    if (top < handY - up || top > handY + reach) return null;
    return { x: edge, y: top, dir, drone: true };
  }

  // face: blinks now and then (only the normal face), eyes drift towards Leyla or the nearest enemy, old screen flickers
  updateFace(time, look) {
    if (!this.face) return;
    const FC = this.d.face || {}, B = FC.blink || {}, base = this.moods[this.mood]?.frame ?? 0;
    if (this.mood === 'idle' || !this.mood) {
      if (time > this.blinkAt) { this.blinkAt = time + this.blinkGap(); this.blinkUntil = time + (B.duration ?? 130); }
      const f = time < (this.blinkUntil || 0) && B.frame != null ? B.frame : base;
      if (f !== this.faceFrame) this.setFace(f);
    } else if (this.faceFrame !== base) this.setFace(base);
    const s = this.scene, l = s.leyla, foe = this.mood === 'alert' || this.mood === 'hit'
      ? s.enemies.filter(e => e.alive).sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x))[0] : null;
    const tx = foe ? foe.x : l.x, ty = foe ? (foe.feet ?? foe.y) - 90 : l.chest;
    const sh = FC.lookShift ?? 1.5, ang = Math.atan2(ty - this.y, (tx - this.x) * look);
    const want = this.mood === 'sleep' || this.mood === 'zen' || this.mood === 'down' ? [0, 0] : [Math.cos(ang) * sh, Math.sin(ang) * sh * 0.6];
    this.eye = this.eye || [0, 0];
    this.eye[0] += (want[0] - this.eye[0]) * 0.12; this.eye[1] += (want[1] - this.eye[1]) * 0.12;
    this.face.setPosition(this.faceAt[0] + Math.round(this.eye[0]), this.faceAt[1] + Math.round(this.eye[1]));
    const gl = (this.suffer?.glitch || 0) / 100;   // a weak tank: the face stutters and jumps
    if (gl && Math.random() < gl * 0.08) { this.face.setPosition(this.face.x + (Math.random() < 0.5 ? -2 : 2), this.face.y); if (Math.random() < 0.4) this.face.setFrame(Math.floor(Math.random() * 12)); }
    const fl = (FC.flicker ?? 0) / 100;
    this.face.setAlpha(fl && Math.random() < 0.06 ? 1 - fl * (0.5 + Math.random() * 0.5) : Math.min(1, this.face.alpha + 0.2));
  }

  // antigravity ring: breathes, lights up on dash and fast flight
  updateRing(time, vx) {
    if (!this.ring) return;
    const R = this.d.ring || {}, fast = time < this.boostUntil || Math.abs(vx) > 700;
    const want = (R.glow ?? 45) / 100 * (fast ? (R.dash ?? 220) / 100 : 1) * (0.8 + 0.2 * Math.sin(time / 1000 * Math.PI * 2 * (R.pulse ?? 1.2)));
    this.ring.setAlpha(this.ring.alpha + (Math.min(1, want) - this.ring.alpha) * 0.2);
  }

  // cables hang from the hull and swing with the flight (Drohne › Kabel)
  updateCables(dt, rot, look) {
    const g = this.rope; g.clear();
    if (!this.cables.list.length || !this.sprite.visible) return;
    const k = this.scale, anchor = hullPoint(this.sprite.x, this.sprite.y, rot, look < 0 ? -1 : 1, k, this.org[0], this.org[1]);
    this.cables.step(dt, anchor, k);
    const out = parseInt((this.d.cable?.outline || '#060608').slice(1), 16);
    const lines = this.cables.lines();
    for (const pass of [0, 1]) for (const c of lines) {
      const w = c.width * k;
      g.lineStyle(pass ? w : w + 2 * k, pass ? parseInt(c.color.slice(1), 16) : out, 1);
      g.beginPath(); g.moveTo(c.pts[0][0], c.pts[0][1]);
      for (const [x, y] of c.pts.slice(1)) g.lineTo(x, y);
      g.strokePath();
    }
  }
}

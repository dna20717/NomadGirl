// Leyla's drone (area "Drohne"): pure decoration, no physics. Flies behind Leyla with a soft lag, bobs and tilts,
// and shows a mood: a face (frame of its look) plus an optional kaomoji bubble.
// Moods come from events (kill, hit, cleared, dash, down) and from states (alert, lowHealth, bored, sleep);
// while Leyla is moving, a random mood (curious, scan) pops up now and then.

import { Cables, hullPoint } from '../drone_cables.js';

const STATES = ['down', 'lowHealth', 'alert', 'zen', 'sleep', 'bored'];   // lasting moods, most important first

export class Drone {
  constructor(scene, data) {
    this.scene = scene; this.d = data.drone || {};
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

  // parts with a "Gegenstand" show while that item sits on Mama-Bot in the inventory (inv.wear), others follow "Angebaut"
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
    if (!m || this.d.enabled === false) return;
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
    const moving = Math.abs(l.body.velocity.x) > 20 || Math.abs(l.body.velocity.y) > 20 || l.state !== 'normal';
    this.still = moving ? 0 : this.still + dt;
    if (this.still > (I.sleepAfter ?? 14) * 1000) return 'sleep';
    if (this.still > (I.boredAfter ?? 6) * 1000) return 'bored';
    if (time > this.nextRandom) { this.nextRandom = time + this.randomGap(); if (moving && !near && l.state !== 'pose') this.react(Math.random() < 0.5 ? 'curious' : 'scan'); }   // not into the yoga pose (would break the zen)
    return 'idle';
  }

  update(time, dt) {
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
        const rx = visit ? l.x + (Math.random() < 0.5 ? -1 : 1) * 120 : area.x0 + Math.random() * (area.x1 - area.x0);
        this.roamTo = { x: rx, y: area.ground - (h0 + Math.random() * (h1 - h0)), leyla: visit };
        this.roamAt = time + (a + Math.random() * (b - a)) * 1000;
      }
      if (this.roamTo.leyla) this.roamTo.x += (l.x + this.side * -110 - this.roamTo.x) * 0.02;
      tx = this.roamTo.x; ty = this.roamTo.y; smooth = R.smooth ?? 0.02;
    }
    // right stick: Mama-Bot hangs on Leyla like on a rubber band (Daniel, 12.11.2026: „je weiter weg, desto höher der Widerstand,
    // lässt man los, geht sie zurück in ihre Position. So hätte man eine Tischlampe dabei“); Drohne › Gummiband
    const G = this.d.leash || {}, st = G.enabled === false ? [0, 0] : this.scene.pad?.right || [0, 0], m = Math.hypot(st[0], st[1]);
    if (m > 0.02) {
      const reach = G.reach ?? 380, stiff = Math.max(0.01, G.stiffness ?? 2.4), pull = reach * (1 - Math.exp(-stiff * m)) / (1 - Math.exp(-stiff));
      tx = l.x + dx * this.side * (1 - m) + st[0] / m * pull; ty = l.feet + dy + st[1] / m * pull;
      smooth = (G.smooth ?? 0.06) * (1 - 0.6 * m * m);   // the further out, the heavier it pulls
      this.aim = Math.atan2(st[1], st[0]); this.leashed = true; this.roamTo = null;
    } else if (this.leashed) { this.leashed = false; this.aimUntil = time + (G.aimHold ?? 600); }
    if (!this.leashed && this.aim != null && time > (this.aimUntil || 0)) this.aim = null;
    // docked on a workbench (Werkstätten › Benutzen › Mama-Bot dockt an): flies there and sits still
    if (this.dock) { if (time > this.dock.until) this.dock = null; else { tx = this.dock.x; ty = this.dock.y; smooth = 0.07; } }
    const k = 1 - Math.pow(1 - Math.min(1, smooth), dt / 16.67);
    const px = this.x; this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    const vx = (this.x - px) / Math.max(1, dt) * 1000;
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

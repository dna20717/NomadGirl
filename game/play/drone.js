// Leyla's drone (area "Drohne"): pure decoration, no physics. Flies behind Leyla with a soft lag, bobs and tilts,
// and shows a mood: a face (frame of its look) plus an optional kaomoji bubble.
// Moods come from events (kill, hit, cleared, dash, down) and from states (alert, lowHealth, bored, sleep);
// while Leyla is moving, a random mood (curious, scan) pops up now and then.

const STATES = ['down', 'lowHealth', 'alert', 'sleep', 'bored'];   // lasting moods, most important first

export class Drone {
  constructor(scene, data) {
    this.scene = scene; this.d = data.drone || {};
    const a = data.assets?.[this.d.look];
    this.moods = Object.fromEntries((this.d.moods || []).map(m => [m.mood, m]));
    this.f = this.d.follow || {};
    const has = a && scene.textures.exists(this.d.look);
    this.sprite = has ? scene.add.sprite(0, 0, this.d.look, 0) : scene.add.image(0, 0, 'px').setTint(0xe0287a);
    const fh = has ? a.frameSize[1] : 1, [ox, oy] = has && a.origin ? a.origin : [has ? a.frameSize[0] / 2 : 0.5, fh / 2];
    if (has) this.sprite.setOrigin(ox / a.frameSize[0], oy / fh);
    this.scale = has ? (this.d.height || a.height || fh) / fh : 60;
    this.sprite.setScale(this.scale).setDepth(this.d.layer === 'front' ? 11 : 9.5);
    const B = this.d.bubble || {};
    this.bubble = scene.add.text(0, 0, '', {
      fontFamily: 'Inter, "Hiragino Sans", "Noto Sans CJK JP", "Yu Gothic", sans-serif', fontSize: `${B.size || 30}px`,
      color: B.color || '#7ff6ff', backgroundColor: B.background || '#140c1c', padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 1).setDepth(12).setAlpha(0);
    this.reset();
  }

  reset() {
    const l = this.scene.leyla, [dx, dy] = this.f.offset || [-110, -210];
    this.x = l.x + dx * l.facing; this.y = l.feet + dy; this.side = l.facing;
    this.turnAt = 0; this.event = null; this.still = 0; this.mood = null; this.bubbleUntil = 0;
    this.nextRandom = this.scene.time.now + this.randomGap();
    this.sprite.setVisible(this.d.enabled !== false); this.bubble.setAlpha(0);
  }

  randomGap() { const [a, b] = this.d.idle?.randomEvery || [8, 16]; return (a + Math.random() * Math.max(0, b - a)) * 1000; }

  // event moods (kill, hit, cleared, dash, down …) win for their duration
  react(mood) {
    const m = this.moods[mood];
    if (!m || this.d.enabled === false) return;
    const time = this.scene.time.now;
    this.event = { mood, until: m.duration ? time + m.duration : Infinity };
    this.show(mood, time);
  }

  show(mood, time) {
    if (this.mood === mood) return;
    this.mood = mood;
    const m = this.moods[mood] || this.moods.idle || { frame: 0 };
    if (this.sprite.setFrame) this.sprite.setFrame(Math.min(m.frame ?? 0, this.sprite.texture.frameTotal - 2));
    const pop = this.scene.tweens.add({ targets: this.sprite, scaleY: this.scale * 1.12, duration: 90, yoyo: true });
    if (m.kaomoji && this.d.bubble?.show !== false) {
      this.bubble.setText(m.kaomoji).setAlpha(1);
      this.bubbleUntil = time + Math.max(1200, m.duration && m.duration < Infinity ? m.duration : 2200);
    } else this.bubbleUntil = 0;
    return pop;
  }

  // the lasting mood from the situation
  situation(time, dt) {
    const s = this.scene, l = s.leyla, I = this.d.idle || {};
    if (!l.alive) return 'down';
    if (l.health / (s.data_.leyla?.health || 100) * 100 < (this.d.lowHealth ?? 30)) return 'lowHealth';
    const near = s.enemies.some(e => e.alive && Math.abs(e.x - l.x) < (this.d.alertRange ?? 700) && Math.abs(e.feet - l.feet) < 400);
    if (near && !this.alerted) { this.alerted = true; this.react('alert'); }
    if (!near) this.alerted = false;
    const moving = Math.abs(l.body.velocity.x) > 20 || Math.abs(l.body.velocity.y) > 20 || l.state !== 'normal';
    this.still = moving ? 0 : this.still + dt;
    if (this.still > (I.sleepAfter ?? 14) * 1000) return 'sleep';
    if (this.still > (I.boredAfter ?? 6) * 1000) return 'bored';
    if (time > this.nextRandom) { this.nextRandom = time + this.randomGap(); if (moving && !near) this.react(Math.random() < 0.5 ? 'curious' : 'scan'); }
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
    if (area && R.enabled !== false) {
      if (!this.roamTo || time > this.roamAt) {
        const [a, b] = R.every || [3, 7], [h0, h1] = R.height || [180, 460], visit = Math.random() * 100 < (R.visitLeyla ?? 30);
        const rx = visit ? l.x + (Math.random() < 0.5 ? -1 : 1) * 120 : area.x0 + Math.random() * (area.x1 - area.x0);
        this.roamTo = { x: rx, y: area.ground - (h0 + Math.random() * (h1 - h0)), leyla: visit };
        this.roamAt = time + (a + Math.random() * (b - a)) * 1000;
      }
      if (this.roamTo.leyla) this.roamTo.x += (l.x + this.side * -110 - this.roamTo.x) * 0.02;
      tx = this.roamTo.x; ty = this.roamTo.y; smooth = R.smooth ?? 0.02;
    }
    const k = 1 - Math.pow(1 - Math.min(1, smooth), dt / 16.67);
    const px = this.x; this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    const vx = (this.x - px) / Math.max(1, dt) * 1000;
    const bob = Math.sin(time / 1000 * Math.PI * 2 * (F.bobSpeed ?? 0.6)) * (F.bob ?? 10);
    // flying towards a side: look that way, otherwise look where Leyla looks
    const look = Math.abs(vx) > 120 ? Math.sign(vx) : this.side;
    this.sprite.setPosition(this.x, this.y + bob).setFlipX(look < 0)
      .setRotation(Math.max(-1, Math.min(1, vx / 900)) * (F.tilt ?? 8) * Math.PI / 180);   // nose dips into the flight direction
    // mood: an event for its duration, otherwise the situation
    const lasting = this.situation(time, dt);
    if (this.event && (time > this.event.until || STATES.includes(lasting) && STATES.indexOf(lasting) < 2)) this.event = null;
    this.show(this.event ? this.event.mood : lasting, time);
    const top = this.y + bob - this.sprite.displayHeight * this.sprite.originY - 6;
    this.bubble.setPosition(this.x + look * 30, top);
    if (this.bubbleUntil && time > this.bubbleUntil) this.bubble.setAlpha(Math.max(0, this.bubble.alpha - dt / 250));
  }
}

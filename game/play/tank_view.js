// The cryo tank in the rig (Daniel, 12.11.2026: „der Tank ist das wichtigste Element im Spiel, er soll Charakter haben“).
// Sits on a bench picture (benches.js) and brings it to life, all from the area "Cryo-Tank" (data/tank.json):
// - the picture of the current phase, with its loop animation playing exactly over it (Phasen › Aussehen / Schleife)
// - bubbles rising in the glass, a soft glow in the colour of the liquid (red pulse in the alarm phase)
// - the text screen cycles through lines ({zustand}, {phase}, {tage}, {stunden}) in a pixel font, typed in letter by letter
// - the face screen shows AvA's faces (the drone's face sheet): her mood follows the phase, she smiles when Leyla stands close,
//   she blinks, and when the drone itself flies by she shows her loving face
// - now and then her hand rests against the glass (Phasen › Hand, faded in and out) and, once the glass is fogged (phase 2+),
//   a fingertip draws a heart from the inside that slowly fades again
import { phase, update as tankUpdate, hoursLeft } from '../tank.js';

const HEART = (() => {   // a heart as a list of points (unit size, starts at the dip), drawn one after another like a fingertip
  const pts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 2; pts.push([16 * Math.sin(t) ** 3 / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]); }
  return pts;
})();

export class TankView {
  constructor(benches, bench, picture) {
    this.b = bench; this.benches = benches; this.scene = benches.scene; this.D = benches.D; this.camp = benches.camp;
    this.T = this.D.tank || {}; this.pic = picture;
    const s = this.scene;
    this.sprite = s.add.sprite(picture.x, picture.y, picture.texture.key).setOrigin(picture.originX, picture.originY).setScale(picture.scaleX);
    bench.view.add(this.sprite);
    this.g = s.add.graphics().setDepth(-19.89);                                    // bubbles, heart (over the picture, behind Leyla)
    this.glowG = benches.glow(0, 0, this.T.glow || '#5cff9d', Phaser.BlendModes.ADD, -19.9);
    const S = this.T.screen || {};
    this.text = s.add.text(0, 0, '', { fontFamily: 'VT323, monospace', fontSize: '40px', color: S.color || '#7ff6ff' }).setOrigin(0.5).setDepth(-19.88);
    this.face = s.textures.exists(this.D.drone?.face?.look || '') ? s.add.image(0, 0, this.D.drone.face.look, 0).setDepth(-19.88) : null;
    benches.objs.push(this.sprite, this.g, this.text, ...(this.face ? [this.face] : []));
    this.bubbles = []; this.heart = null; this.hand = null; this.line = 0; this.lineAt = 0; this.typed = 0;
    this.nextHeart = s.time.now + 8000; this.nextHand = s.time.now + 12000 + Math.random() * 10000;
    this.blinkAt = 0; this.phaseIndex = 0;
    this.refresh(true);
  }
  get save() { return this.camp.box?.save; }
  // the picture's pixel (ix, iy) in the world
  at(ix, iy) { return this.b.at(ix, iy); }
  // the phase may change while standing in the camp (maintenance, time): swap picture and loop
  refresh(force = false) {
    const save = this.save; if (!save) return;
    tankUpdate(this.D, save);
    const p = phase(this.D, save);
    if (!force && p.index === this.phaseIndex) return;
    this.phaseIndex = p.index; this.p = p;
    const s = this.scene, still = p.dead ? this.T.deadLook : p.look, loop = p.dead ? null : p.anim;
    if (still && s.textures.exists(still)) { this.pic.setTexture(still); this.pic.cropTo?.(0); }
    this.loopKey = loop && s.textures.exists(loop) && this.D.assets?.[loop]?.kind === 'animation' ? loop : null;
    if (this.loopKey && !s.anims.exists(this.loopKey)) {
      const A = this.D.assets[this.loopKey];
      s.anims.create({ key: this.loopKey, frames: s.anims.generateFrameNumbers(this.loopKey, { start: 0, end: (A.frames || 1) - 1 }), frameRate: A.fps || 6, repeat: -1 });
    }
    this.playLoop();
  }
  playLoop() {
    const sp = this.sprite;
    if (this.loopKey) { sp.setVisible(true); sp.play(this.loopKey, true); this.pic.setAlpha(0.001); }
    else { sp.setVisible(false); this.pic.setAlpha(1); }
    this.copyCrop();
  }
  copyCrop() { const c = this.pic.clipBox; if (c) this.sprite.setCrop(c.x, c.y, Math.max(0, c.x1 - c.x), Math.max(0, c.y1 - c.y)); }

  update(time, dt, hidden) {
    const sec = dt / 1000, s = this.scene, T = this.T, l = s.leyla, b = this.b, p = this.p || {};
    for (const o of [this.g, this.text, this.face, this.sprite]) o?.setVisible(!hidden && (o !== this.sprite || !!this.loopKey));
    this.hand?.img.setVisible(!hidden);
    if (hidden) return;
    if (time > (this.checkAt || 0)) { this.checkAt = time + 1000; this.refresh(); }
    const g = this.g.clear(), dead = !!p.dead, alarm = p.index >= 5 && !dead;
    const [gx, gy] = T.glass?.at || [88, 61], [gw, gh] = T.glass?.size || [80, 122];
    const [x0, y0] = this.at(gx, gy), [x1, y1] = this.at(gx + gw, gy + gh), k = b.k;
    // glow over the glass: the liquid's colour, breathing; alarm = red pulse; dead = nothing
    const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2], pulse = alarm ? 0.5 + 0.5 * Math.sin(time / 260) : 0.85 + 0.15 * Math.sin(time / 900);
    this.glowG.setVisible(!dead).setPosition(cx, cy).setDisplaySize((x1 - x0) * 2.4, (y1 - y0) * 1.5).setTint(alarm ? 0xff3b4a : Phaser.Display.Color.HexStringToColor(T.glow || '#5cff9d').color)
      .setAlpha((alarm ? 0.5 : 0.28 / Math.max(1, p.index * 0.6)) * pulse * (this.benches.boost || 1));
    // bubbles (fewer the worse it gets, none when dead)
    if (!dead && Math.random() < (T.bubbles ?? 6) * sec / Math.max(1, p.index * 0.7)) this.bubbles.push({ x: x0 + 6 * k + Math.random() * (x1 - x0 - 12 * k), y: y1 - 4 * k, r: (0.6 + Math.random() * 1.2) * k, v: (14 + Math.random() * 20) * k, ph: Math.random() * 6 });
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const u = this.bubbles[i]; u.y -= u.v * sec; u.x += Math.sin(time / 300 + u.ph) * 0.15 * k;
      if (u.y < y0 + 4 * k) { this.bubbles.splice(i, 1); continue; }
      g.fillStyle(0xd6fff0, 0.55).fillCircle(u.x, u.y, u.r);
    }
    this.heartStep(time, sec, g, x0, y0, x1, y1, k);
    this.handStep(time);
    this.screens(time, l, dead);
  }

  // a fingertip draws a heart into the fogged glass from the inside (phase 2 and worse, not dead); it stays a while, then fogs over
  heartStep(time, sec, g, x0, y0, x1, y1, k) {
    const p = this.p || {}, every = (this.T.heartEvery ?? 45) * 1000;
    if (!this.heart && p.index >= 2 && !p.dead && every > 0 && time > this.nextHeart) {
      const size = (x1 - x0) * (0.16 + Math.random() * 0.1), hx = x0 + (x1 - x0) * (0.3 + Math.random() * 0.4), hy = y0 + (y1 - y0) * (0.25 + Math.random() * 0.4);
      this.heart = { x: hx, y: hy, size, t0: time, draw: 2600, hold: 6000, fade: 3000 };
      this.nextHeart = time + every * (0.7 + Math.random() * 0.6);
    }
    const H = this.heart; if (!H) return;
    const t = time - H.t0, n = Math.min(HEART.length, Math.floor(HEART.length * t / H.draw)), a = t < H.draw + H.hold ? 1 : 1 - (t - H.draw - H.hold) / H.fade;
    if (a <= 0) { this.heart = null; return; }
    g.lineStyle(Math.max(2, 1.6 * k), 0x0f6b4e, 0.55 * a);   // where the finger wiped, the dark liquid shows through the frost
    g.beginPath();
    for (let i = 0; i < n; i++) { const [u, v] = HEART[i], X = H.x + u * H.size, Y = H.y + v * H.size; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }
    g.strokePath();
    if (n < HEART.length) { const [u, v] = HEART[Math.max(0, n - 1)]; g.fillStyle(0x0f6b4e, 0.7 * a).fillCircle(H.x + u * H.size, H.y + v * H.size, 1.8 * k); }   // the fingertip
  }
  // a hand at the glass (Cryo-Tank › Phasen › Hand: the phase picture with her hand on the glass, or a handprint in the frost):
  // fades in over the picture, stays, fades out; now and then, more often when Leyla is close
  handStep(time) {
    const T = this.T, p = this.p || {}, s = this.scene, key = p.hand;
    if (this.hand) {
      const H = this.hand, t = time - H.t0, a = t < 1400 ? t / 1400 : t < 5400 ? 1 : 1 - (t - 5400) / 1800;
      if (a <= 0 || H.phase !== this.phaseIndex) { H.img.destroy(); this.hand = null; return; }
      H.img.setAlpha(a).setPosition(this.pic.x, this.pic.y);
      return;
    }
    if (p.dead || !key || !s.textures.exists(key)) return;
    const l = s.leyla, close = l && Math.abs(l.x - this.b.cx) < 220 && Math.abs(l.feet - this.b.floor) < 100;
    if (time < this.nextHand - (close ? 25000 : 0)) return;
    this.nextHand = time + (T.handEvery ?? 70) * 1000 * (0.7 + Math.random() * 0.6);
    const pic = this.pic, img = s.add.image(pic.x, pic.y, key).setOrigin(pic.originX, pic.originY).setScale(pic.scaleX).setAlpha(0);
    const c = pic.clipBox; if (c) img.setCrop(c.x, c.y, Math.max(0, c.x1 - c.x), Math.max(0, c.y1 - c.y));
    this.b.view.add(img);
    this.hand = { img, t0: time, phase: this.phaseIndex };
  }

  // text screen + face screen
  screens(time, l, dead) {
    const T = this.T, S = T.screen || {}, save = this.save, p = this.p || {}, k = this.b.k;
    // text: one line at a time, typed in, then held
    const [tx, ty] = this.at(...(S.text || [116.5, 208])), [tw, th] = S.textSize || [40, 14];
    const lines = (S.lines || 'AVA · {zustand} %').split('\n').filter(Boolean);
    const t = save?.tank || { cond: 0 };
    if (time > this.lineAt) { this.line = (this.line + 1) % lines.length; this.lineAt = time + 3200; this.typed = time; this.hoursLeft = save ? hoursLeft(this.D, save) : 0; }
    const full = dead ? (T.deadName || 'TOT').toUpperCase() : (lines[this.line] || '')
      .replace('{zustand}', Math.round(t.cond)).replace('{phase}', (p.status || p.name || '').toUpperCase())
      .replace('{tage}', Math.max(1, (save?.day ?? 1) - (t.since ?? 1) + 1)).replace('{stunden}', this.hoursLeft ?? '?');
    const shown = full.slice(0, Math.max(1, Math.floor((time - this.typed) / 45)));
    const color = p.index >= 5 ? '#ff6b7a' : p.index >= 4 ? '#ffb36b' : p.index >= 3 ? '#ffd27a' : S.color || '#7ff6ff';
    this.text.setText(shown + (time % 900 < 450 && shown.length < full.length + 1 ? '_' : '')).setColor(color).setPosition(tx, ty)
      .setFontSize(Math.max(8, Math.round(th * k * 0.72))).setAlpha(dead ? 0.35 : (p.glitch && Math.random() < p.glitch / 900 ? 0.2 : 1));
    if (this.text.width > tw * k) this.text.setScale(tw * k / this.text.width, 1); else this.text.setScale(1);
    // face: the phase's face; Leyla close = happy, the drone close = love; blinks in calm moments
    if (!this.face) return;
    const [fx, fy] = this.at(...(S.face || [154, 208])), drone = this.scene.drone, fsz = (S.faceScale ?? 55) / 100;
    const near = l && Math.abs(l.x - this.b.cx) < 200 && Math.abs(l.feet - this.b.floor) < 100;
    const avaNear = drone && Math.hypot(drone.x - this.b.cx, drone.y - (this.b.floor - 120)) < (T.love ?? 360);
    let frame = dead ? 9 : p.face ?? 0;
    if (!dead && avaNear) frame = 14;
    else if (!dead && near && (p.index ?? 1) <= 2) frame = 2;
    if (!dead && frame === 0) { if (time > this.blinkAt) this.blinkAt = time + 2500 + Math.random() * 3500; if (this.blinkAt - time < 140) frame = 1; }
    const total = this.face.texture.frameTotal - 1;
    this.face.setFrame(Math.min(frame, total - 1)).setPosition(fx, fy).setScale(k * fsz).setAlpha(dead ? 0.15 : p.glitch && Math.random() < p.glitch / 600 ? 0.3 : 1);
    this.faceFrame = frame;
  }
  destroy() {}
  state() { return { phase: this.p?.name, index: this.phaseIndex, face: this.faceFrame, text: this.text.text, heart: !!this.heart, hand: !!this.hand, loop: this.loopKey }; }
}

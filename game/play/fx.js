// Small effects: dust, puffs, afterimages, sparks, slash arcs, floating numbers.
export class Fx {
  constructor(scene) { this.scene = scene; }

  particles(x, y, n, color, { speed = 220, up = 0.6, life = 380, size = 1.5, gravity = 900 } = {}) {
    const s = this.scene;
    for (let i = 0; i < n; i++) {
      const p = s.add.image(x, y, 'px').setTint(color).setScale(size * (0.6 + Math.random() * 0.8)).setDepth(12);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * (1 + up), v = speed * (0.4 + Math.random() * 0.8);
      const vx = Math.cos(a) * v, vy = Math.sin(a) * v * up * 1.6;
      s.tweens.addCounter({ from: 0, to: 1, duration: life * (0.6 + Math.random() * 0.6), onUpdate: tw => {
        const t = tw.getValue() * life / 1000;
        p.setPosition(x + vx * t, y + vy * t + gravity * t * t / 2).setAlpha(1 - tw.getValue());
      }, onComplete: () => p.destroy() });
    }
  }
  // a short burst of light (muzzle flash): soft additive glow that lights up the surroundings, then fades
  light(x, y, { radius = 220, color = 0xffc870, alpha = 0.9, life = 90 } = {}) {
    const s = this.scene;
    if (!s.textures.exists('fx_glow')) {
      const t = s.textures.createCanvas('fx_glow', 128, 128), c = t.getContext(), g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128); t.refresh();
    }
    const l = s.add.image(x, y, 'fx_glow').setDisplaySize(radius * 2, radius * 2).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(32).setAlpha(alpha);
    s.tweens.add({ targets: l, alpha: 0, scale: l.scale * 1.15, duration: life, ease: 'Quad.easeOut', onComplete: () => l.destroy() });
    return l;
  }
  glowKey() {
    const s = this.scene;
    if (!s.textures.exists('fx_glow')) {
      const t = s.textures.createCanvas('fx_glow', 128, 128), c = t.getContext(), g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128); t.refresh();
    }
    return 'fx_glow';
  }
  // charging up: sparks drawn in from a ring around (x, y) towards the centre
  gather(x, y, color, radius = 120) {
    const s = this.scene, a = Math.random() * Math.PI * 2, r = radius * (0.7 + Math.random() * 0.5);
    const p = s.add.image(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, 'px').setTint(color).setScale(1.6 + Math.random()).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: p, x, y, alpha: { from: 0.2, to: 1 }, scale: 0.6, duration: 260 + Math.random() * 160, ease: 'Quad.easeIn', onComplete: () => p.destroy() });
  }
  dust(x, y, n = 6) { this.particles(x, y - 4, Math.round(n), 0xb8a48a, { speed: 160, up: 0.25, life: 420, size: 2.2, gravity: -60 }); }
  puff(x, y, color) { this.particles(x, y - 4, 10, color, { speed: 180, up: 0.2, life: 300, size: 1.6, gravity: 0 }); }
  sparks(x, y, color = 0xffd27a, n = 8) { this.particles(x, y, n, color, { speed: 340, up: 1, life: 260, size: 1.3, gravity: 1400 }); }
  // Leyla is hit (Leyla › Treffer): ring + streaks flying in the direction of the blow; dir = where she is pushed
  impact(x, y, dir, heavy = false, k = 1) {
    const s = this.scene, n = Math.round((heavy ? 9 : 6) * k);
    const ring = s.add.circle(x, y, (heavy ? 16 : 12) * k).setStrokeStyle(heavy ? 4 : 3, 0xff4f9a, 1).setDepth(12);
    s.tweens.add({ targets: ring, scale: heavy ? 3.2 : 2.6, alpha: 0, duration: heavy ? 220 : 160, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    for (let i = 0; i < n; i++) {
      const a = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.3, len = (18 + Math.random() * (heavy ? 34 : 22)) * k;
      const g = s.add.rectangle(x, y, len, heavy ? 4 : 3, i % 3 ? 0xffffff : 0xff4f9a).setRotation(a).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
      const d = 70 + Math.random() * (heavy ? 120 : 80);
      s.tweens.add({ targets: g, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scaleX: 0.2, alpha: 0, duration: 160 + Math.random() * 120, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
    }
  }
  blood(x, y, n = 14) { this.particles(x, y, n, 0xc0304a, { speed: 300, up: 1, life: 520, size: 2, gravity: 1800 }); }

  // ---------- blood (Daniel, 12.11.2026: „ein wenig mehr Treffer-Feedback in Form von Blutspritzern“, Spiel › Kampf › Blut) ----------
  // a spray in the direction of the hit (dir: +1 = to the right), a puff of red mist, droplets that fly, fall and stay where they
  // land: a splat on the floor, a run down the wall. k = strength (≈ damage / 15; crits more). machine = sparks and oil instead.
  bloodHit(x, y, dir, k = 1, { machine = false } = {}) {
    const s = this.scene, B = s.data_.game?.combat?.blood || {};
    if (B.enabled === false) return this.blood(x, y, 10);
    if (machine) { this.sparks(x, y, 0xffd27a, Math.round(8 + 6 * k)); return this.spray(x, y, dir, k * 0.6, [0x1b1a1f, 0x2b2830, 0x3a3640], B); }
    const base = B.color ? parseInt(String(B.color).replace('#', ''), 16) : 0xa01828;
    const shade = (c, f) => ((Math.min(255, (c >> 16 & 255) * f) << 16) | (Math.min(255, (c >> 8 & 255) * f) << 8) | Math.min(255, (c & 255) * f)) >>> 0;
    const cols = [base, shade(base, 0.7), shade(base, 0.5), shade(base, 1.25)];
    const m = s.add.image(x + dir * 10, y, this.glowKey()).setTint(cols[1]).setDepth(12).setAlpha(0.55).setDisplaySize(40 * k + 30, 40 * k + 30);
    s.tweens.add({ targets: m, alpha: 0, scale: m.scale * 1.8, x: m.x + dir * 30, duration: 260, ease: 'Quad.easeOut', onComplete: () => m.destroy() });
    this.spray(x, y, dir, k, cols, B);
  }
  spray(x, y, dir, k, cols, B = {}) {
    const s = this.scene, n = Math.round((8 + 10 * k) * (B.amount ?? 100) / 100);
    for (let i = 0; i < n; i++) {
      const size = 2 + Math.random() * 3.5 * Math.min(1.6, k), col = cols[i % cols.length];
      const p = s.add.rectangle(x, y, size, size, col).setDepth(12);
      // a cone in the hit direction, a little upward; a few fly back towards the attacker
      const back = Math.random() < 0.15 ? -1 : 1, a = (dir * back > 0 ? 0 : Math.PI) + (Math.random() - 0.6) * 1.3 * (dir * back > 0 ? 1 : -1);
      const v = (220 + Math.random() * 520) * Math.sqrt(k), vx = Math.cos(a) * v, vy = Math.sin(a) * v - 120;
      let lx = x, ly = y;
      s.tweens.addCounter({ from: 0, to: 1, duration: 900, onUpdate: tw => {
        if (!p.active) return;
        const t = tw.getValue() * 0.9, px = x + vx * t, py = y + vy * t + 2200 * t * t / 2;
        if (B.decals !== false && (s.pointSolid?.(px, py) || (vy + 2200 * t > 0 && s.groundAt?.(px, py)))) {
          const T = s.T || 64, wall = s.pointSolid(px, py) && !s.pointSolid(lx, py) && Math.abs(vx) > 80;
          if (wall) this.splat(vx > 0 ? Math.floor(px / T) * T : Math.ceil(px / T) * T, py, col, size, 'wall');
          else this.splat(px, Math.floor(py / T) * T, col, size, 'floor');
          p.destroy(); return;
        }
        p.setPosition(px, py).setAngle(t * 400); lx = px; ly = py;
      }, onComplete: () => p.destroy() });
    }
  }
  // a stain that stays (Spiel › Kampf › Blut › Bleibt liegen); the oldest goes first
  splat(x, y, col, size, where) {
    const s = this.scene, B = s.data_.game?.combat?.blood || {}, g = s.add.graphics().setDepth(7.5);
    this.stains ??= [];
    if (where === 'wall') {
      g.fillStyle(col, 0.9).fillEllipse(x, y, size * 0.9, size * 1.6);
      const run = s.add.rectangle(x, y, Math.max(1.5, size * 0.4), 1, col, 0.85).setOrigin(0.5, 0).setDepth(7.5);
      s.tweens.add({ targets: run, displayHeight: 8 + Math.random() * 22 * (size / 4), duration: 900 + Math.random() * 900, ease: 'Sine.easeOut' });
      this.stains.push(run);
    } else {
      const w = size * (2 + Math.random() * 2.5);
      g.fillStyle(col, 0.9).fillEllipse(x, y + 1, w, Math.max(3, size * 1.1));
      if (Math.random() < 0.4) g.fillStyle(col, 0.8).fillCircle(x + (Math.random() - 0.5) * w * 1.6, y + 1, Math.max(1, size * 0.35));
    }
    this.stains.push(g);
    while (this.stains.length > (B.max ?? 160)) this.stains.shift().destroy();
    s.tweens.add({ targets: g, alpha: 0, delay: (B.stay ?? 20) * 1000, duration: 2500, onComplete: () => { g.destroy(); this.stains = this.stains.filter(o => o !== g); } });
  }
  // a pool under a fallen body that grows for a moment
  pool(x, y, k = 1) {
    const s = this.scene, B = s.data_.game?.combat?.blood || {};
    if (B.enabled === false || B.decals === false) return;
    const col = B.color ? parseInt(String(B.color).replace('#', ''), 16) : 0xa01828, T = s.T || 64;
    const floor = s.groundAt?.(x, y + 4) ? Math.floor((y + 4) / T) * T : y;
    const g = s.add.graphics().setDepth(7.4), st = { w: 6 };
    (this.stains ??= []).push(g);
    s.tweens.add({ targets: st, w: 70 * k, duration: 1400, delay: 350, ease: 'Sine.easeOut', onUpdate: () => g.clear().fillStyle(col, 0.85).fillEllipse(x, floor + 1, st.w, Math.max(3, st.w * 0.14)).fillStyle(0xffffff, 0.08).fillEllipse(x - st.w * 0.15, floor, st.w * 0.3, 2) });
    s.tweens.add({ targets: g, alpha: 0, delay: (B.stay ?? 20) * 1000 + 1800, duration: 2500, onComplete: () => g.destroy() });
  }

  // copy of a sprite that fades out (dash afterimage)
  ghost(sprite, color = 0x3fe0d0, alpha = 0.45, life = 220) {
    const g = this.scene.add.image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY).setScale(sprite.scaleX, sprite.scaleY).setRotation(sprite.rotation)
      .setFlipX(sprite.flipX).setTintFill(color).setAlpha(alpha).setDepth(9);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: life, onComplete: () => g.destroy() });
  }

  // crescent slash in front of the attacker
  slash(x, y, facing, reach, color = 0xf2f5f8, up = false) {
    const g = this.scene.add.graphics().setDepth(11);
    const draw = t => {
      g.clear();
      let r = 60 + reach, a0 = facing > 0 ? -1.2 : Math.PI + 1.2, a1 = facing > 0 ? 1.0 : Math.PI - 1.0;
      if (up) [a0, a1] = [a1, a0];   // rising cut: from below to above
      const cut = a0 + (a1 - a0) * Math.min(1, t * 1.6);
      g.lineStyle(14 * (1 - t), color, 0.9 * (1 - t)).beginPath().arc(x, y, r, Math.min(a0, cut), Math.max(a0, cut), false).strokePath();
      g.lineStyle(4 * (1 - t), 0x3fe0d0, 0.8 * (1 - t)).beginPath().arc(x, y, r - 12, Math.min(a0, cut), Math.max(a0, cut), false).strokePath();
    };
    this.scene.tweens.addCounter({ from: 0, to: 1, duration: 170, onUpdate: tw => draw(tw.getValue()), onComplete: () => g.destroy() });
  }

  // muzzle flash from code (Waffen › Mündungsfeuer aus Code): white-hot core, a forward tongue and two side prongs, gone in 70 ms;
  // f = facing, k = size (1 at 192 px Leyla)
  muzzle(x, y, f, k = 1) {
    const g = this.scene.add.graphics().setDepth(12).setBlendMode(Phaser.BlendModes.ADD), j = 0.85 + Math.random() * 0.3;
    const draw = t => {
      g.clear(); const a = 1 - t, L = 34 * k * j, W = 9 * k;
      g.fillStyle(0xffb347, 0.85 * a).fillTriangle(x, y - W, x, y + W, x + f * L, y);
      g.fillStyle(0xffe08a, 0.9 * a).fillTriangle(x, y - W * 0.5, x, y + W * 0.5, x + f * L * 0.7, y);
      g.fillStyle(0xffb347, 0.7 * a).fillTriangle(x + f * 4 * k, y, x + f * 14 * k, y - 16 * k * j, x + f * 10 * k, y)
        .fillTriangle(x + f * 4 * k, y, x + f * 14 * k, y + 16 * k * j, x + f * 10 * k, y);
      g.fillStyle(0xffffff, a).fillCircle(x + f * 3 * k, y, 6 * k * (1 - t * 0.5));
    };
    draw(0);
    this.scene.tweens.addCounter({ from: 0, to: 1, duration: 70, onUpdate: tw => draw(tw.getValue()), onComplete: () => g.destroy() });
  }

  flash(x, y, color = 0xfff2b0, r = 26) {
    const c = this.scene.add.circle(x, y, r, color, 0.9).setDepth(12);
    this.scene.tweens.add({ targets: c, scale: 0.2, alpha: 0, duration: 90, onComplete: () => c.destroy() });
  }

  // floating text (damage numbers, Δ)
  text(x, y, str, { color = '#ffffff', size = 40, rise = 70, life = 700 } = {}) {
    const t = this.scene.add.text(x, y, str, { fontFamily: 'VT323, monospace', fontSize: size + 'px', color, stroke: '#0d0a12', strokeThickness: 6 }).setOrigin(0.5, 1).setDepth(20);
    this.scene.tweens.add({ targets: t, y: y - rise, alpha: { from: 1, to: 0 }, ease: 'Cubic.easeOut', duration: life, onComplete: () => t.destroy() });
  }
}

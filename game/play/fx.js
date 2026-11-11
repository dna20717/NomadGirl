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

  // copy of a sprite that fades out (dash afterimage)
  ghost(sprite, color = 0x3fe0d0) {
    const g = this.scene.add.image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY).setScale(sprite.scaleX, sprite.scaleY).setRotation(sprite.rotation)
      .setFlipX(sprite.flipX).setTintFill(color).setAlpha(0.45).setDepth(9);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  // crescent slash in front of the attacker
  slash(x, y, facing, reach, color = 0xf2f5f8) {
    const g = this.scene.add.graphics().setDepth(11);
    const draw = t => {
      g.clear();
      const r = 60 + reach, a0 = facing > 0 ? -1.2 : Math.PI + 1.2, a1 = facing > 0 ? 1.0 : Math.PI - 1.0, cut = a0 + (a1 - a0) * Math.min(1, t * 1.6);
      g.lineStyle(14 * (1 - t), color, 0.9 * (1 - t)).beginPath().arc(x, y, r, Math.min(a0, cut), Math.max(a0, cut), false).strokePath();
      g.lineStyle(4 * (1 - t), 0x3fe0d0, 0.8 * (1 - t)).beginPath().arc(x, y, r - 12, Math.min(a0, cut), Math.max(a0, cut), false).strokePath();
    };
    this.scene.tweens.addCounter({ from: 0, to: 1, duration: 170, onUpdate: tw => draw(tw.getValue()), onComplete: () => g.destroy() });
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

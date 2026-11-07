// Leyla's van at the spawn point: decoration with a sliding door that opens when Leyla comes close,
// a walkable roof (one-way platform with a foreground rail in front of her feet), a ladder up and a rotating radar dish.
// All values come from "Spiel" › Spawn-Punkt (game.spawn); positions on the van are in image pixels of its asset.

export class Van {
  constructor(scene, S, feet) {
    this.scene = scene; this.S = S;
    const sp = scene.assetInfo(S.look), A = scene.data_.assets?.[S.look] || {};
    const [ox, oy] = S.offset || [0, 0];
    this.x = feet[0] + ox; this.y = feet[1] + oy;
    this.flip = !!S.flip;
    this.depth = S.layer === 'front' ? 5 : -20;
    this.scale = sp.scale;
    this.frames = A.kind === 'animation' ? A.frames || 1 : 1;
    this.fps = S.door?.fps || A.fps || 8;
    this.origin = A.origin || [(A.frameSize?.[0] || 0) / 2, A.frameSize?.[1] || 0];
    this.sprite = scene.add.sprite(this.x, this.y, sp.key, 0).setOrigin(sp.ox, sp.oy).setScale(sp.scale).setFlipX(this.flip).setDepth(this.depth);

    // door: frame 0 = closed, last frame = open; plays forward or backward towards the target
    this.door = S.door?.enabled !== false && this.frames > 1;
    this.frame = 0;

    // radar dish: own looping animation, sits on the van at an image pixel and bobs with the body
    const dish = S.dish?.look && scene.assetInfo(S.dish.look);
    if (dish) {
      this.dish = scene.add.sprite(0, 0, dish.key).setOrigin(dish.ox, dish.oy).setScale(sp.scale).setFlipX(this.flip).setDepth(this.depth + 0.1);
      if (dish.anim) { this.dish.play(dish.anim); this.dish.anims.timeScale = S.dish.speed ?? 1; }
    }
    // roof: one-way platform between two image x positions at an image y
    const R = S.roof;
    if (R?.enabled !== false && R?.x && R?.y != null) {
      const a = this.toWorld(R.x[0], R.y), b = this.toWorld(R.x[1], R.y);
      this.roof = { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y: a.y };
      const z = scene.add.zone((this.roof.x0 + this.roof.x1) / 2, this.roof.y + 8, this.roof.x1 - this.roof.x0, 16);
      scene.platforms.add(z);
      Object.assign(z.body.checkCollision, { down: false, left: false, right: false });
      // foreground (e.g. the front rail): same frames as the van, drawn in front of Leyla while she is up there
      const fg = R.front && scene.assetInfo(R.front);
      if (fg) this.front = scene.add.sprite(this.x, this.y, fg.key, 0).setOrigin(sp.ox, sp.oy).setScale(sp.scale).setFlipX(this.flip).setDepth(10.5).setVisible(false);
    }
    // ladder at the back: climbs like an H ladder (top = roof)
    const L = S.ladder;
    if (L?.enabled !== false && L?.x != null && L?.y) {
      const a = this.toWorld(L.x, L.y[0]), b = this.toWorld(L.x, L.y[1]), T = scene.T;
      scene.ladders.push({ cx: a.x, x0: a.x - T / 2, x1: a.x + T / 2, top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y), van: true });
    }
    this.place();
  }

  // image pixel of the van (frame 0) → world position
  toWorld(ix, iy) {
    const dx = (ix - this.origin[0]) * this.scale, dy = (iy - this.origin[1]) * this.scale;
    return { x: this.x + (this.flip ? -dx : dx), y: this.y + dy };
  }

  place() {
    const f = Math.round(this.frame);
    this.sprite.setFrame(f);
    this.front?.setFrame(Math.min(f, this.front.texture.frameTotal - 2));
    if (this.dish) {
      const [sx, sy] = this.S.bob?.[f] ? [this.S.bob[f].dx || 0, this.S.bob[f].dy || 0] : [0, 0];
      const [dx, dy] = this.S.dish.at || [0, 0], p = this.toWorld(dx + sx, dy + sy);
      this.dish.setPosition(p.x, p.y);
    }
  }

  reset() { this.update(0, true); }

  update(dt, snap = false) {
    const l = this.scene.leyla;
    if (this.door) {
      const D = this.S.door || {}, d = Math.hypot(l.x - this.x, (l.feet - this.y) * 1.5);
      if (d <= (D.openRange ?? 260)) this.open = true;
      else if (d >= (D.closeRange ?? 380)) this.open = false;
      const target = this.open ? this.frames - 1 : 0;
      if (snap) this.frame = target;
      else if (this.frame !== target) {
        const step = this.fps * dt / 1000;
        this.frame = this.frame < target ? Math.min(target, this.frame + step) : Math.max(target, this.frame - step);
      }
    }
    if (this.front) this.front.setVisible(l.alive !== false && l.feet <= this.roof.y + 6 && l.x >= this.roof.x0 - 40 && l.x <= this.roof.x1 + 40);
    this.place();
  }

  state() { return { frame: Math.round(this.frame), open: !!this.open, roof: this.roof, front: !!this.front?.visible }; }
}

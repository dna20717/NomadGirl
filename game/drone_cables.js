// Mama-Bot's hanging cables (area "Drohne" › Kabel), shared by the game and the start page. No DOM, no Phaser.
// Each cable is a little rope (Verlet points) hanging from a point of the hull, either with a loose end or as a loop
// back to a second point. The hull points are given in hull pixels; `anchor(p)` turns them into world positions.

export class Cables {
  constructor(list, cfg = {}) {
    this.cfg = cfg;
    this.list = (list || []).filter(c => Array.isArray(c.at) && c.length > 0);
    this.ropes = null;
  }

  // anchor: [hx, hy] → [x, y] in the world; k = world pixels per hull pixel
  build(anchor, k) {
    const n = Math.max(2, Math.round(this.cfg.segments ?? 8));
    this.ropes = this.list.map(c => {
      const a = anchor(c.at), b = c.to ? anchor(c.to) : null, seg = c.length * k / n, pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, sag = b ? Math.sin(t * Math.PI) * c.length * k * 0.35 : seg * i;
        const x = b ? a[0] + (b[0] - a[0]) * t : a[0], y = (b ? a[1] + (b[1] - a[1]) * t : a[1]) + sag;
        pts.push({ x, y, px: x, py: y });
      }
      return { c, pts, seg, last: a };
    });
  }

  // one step: pin the ends to the hull, let the rest fall and swing
  step(dt, anchor, k) {
    if (!this.ropes) this.build(anchor, k);
    const C = this.cfg, g = (C.gravity ?? 900) * k, damp = C.damping ?? 0.9, carry = 1 - Math.min(1.5, (C.swing ?? 100) / 100);
    const s = Math.min(dt, 50) / 1000;
    for (const r of this.ropes) {
      const a = anchor(r.c.at), b = r.c.to ? anchor(r.c.to) : null, p = r.pts, n = p.length - 1;
      const mx = a[0] - r.last[0], my = a[1] - r.last[1];
      if (Math.hypot(mx, my) > 400 * k) { this.build(anchor, k); return; }   // teleported (new room, camp): hang fresh
      r.last = a;
      for (let i = 1; i <= n; i++) {
        const q = p[i];
        if (b && i === n) continue;
        q.x += mx * carry; q.y += my * carry; q.px += mx * carry; q.py += my * carry;   // some of the flight carries the rope along
        const vx = (q.x - q.px) * damp, vy = (q.y - q.py) * damp;
        q.px = q.x; q.py = q.y; q.x += vx; q.y += vy + g * s * s;
      }
      p[0].x = a[0]; p[0].y = a[1];
      if (b) { p[n].x = b[0]; p[n].y = b[1]; }
      for (let it = 0; it < 6; it++) {
        for (let i = 0; i < n; i++) {
          const u = p[i], v = p[i + 1], dx = v.x - u.x, dy = v.y - u.y, d = Math.hypot(dx, dy) || 1e-6, diff = (d - r.seg) / d;
          const fu = i === 0 ? 0 : (b && i + 1 === n ? 1 : 0.5), fv = b && i + 1 === n ? 0 : (i === 0 ? 1 : 0.5);
          u.x += dx * diff * fu; u.y += dy * diff * fu; v.x -= dx * diff * fv; v.y -= dy * diff * fv;
        }
      }
    }
  }

  // [{ pts: [[x, y] …], color, width }] for drawing
  lines() {
    return (this.ropes || []).map(r => ({ pts: r.pts.map(q => [q.x, q.y]), color: r.c.color || '#20d6c7', width: r.c.width || 2 }));
  }
}

// hull pixel → world, for a sprite drawn with its origin at (ox, oy), scaled by k, mirrored by flip (±1) and rotated by rot
export function hullPoint(x, y, rot, flip, k, ox, oy) {
  return ([hx, hy]) => {
    const lx = (hx - ox) * k * flip, ly = (hy - oy) * k, c = Math.cos(rot), s = Math.sin(rot);
    return [x + lx * c - ly * s, y + lx * s + ly * c];
  };
}

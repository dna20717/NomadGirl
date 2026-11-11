// Small life in the POIs (Daniel, 11.11.2026: „mehr Stimmung durch flackernde Lampen, Fliegen, Kakerlaken und andere Kleinigkeiten,
// die man im Code so machen kann“). Everything from code, a few pixels each, drawn under the lightmap so the darkness swallows them:
//   flies    buzz in small knots over floors (garbage), scatter when Leyla runs through
//   moths    circle the lamps that are on, bump into them
//   roaches  sit on floors and walls, scurry away from Leyla and vanish into the wall
//   rats     now and then one runs across a floor and is gone
//   papers   scraps that the draft pushes over the floor
// Values per mood: Atmosphäre › Kleinvieh (critters.*). Lives inside the Atmosphere (game/play/atmosphere.js), uses its moods and lamps.
const rgb = s => { const n = parseInt(String(s || '#000').replace('#', ''), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const col = s => Phaser.Display.Color.GetColor(...rgb(s));
const rnd = (a, b) => a + Math.random() * (b - a);

export class Critters {
  constructor(atmo) {
    this.atmo = atmo; this.scene = atmo.scene; this.T = atmo.T;
    this.g = this.scene.add.graphics().setDepth(atmo.depth - 0.9);   // under the lightmap: lit like the world
    this.knots = []; this.moths = []; this.roaches = []; this.rats = []; this.papers = [];
    this.t = 0;
  }
  // a floor tile in or near the view: [x, y of the floor top]
  floorSpot(vw, edge = false) {
    const s = this.scene, R = s.room, T = this.T;
    for (let i = 0; i < 24; i++) {
      const x = edge ? (Math.random() < 0.5 ? vw.x - 40 : vw.right + 40) : rnd(vw.x, vw.right), tx = Math.floor(x / T);
      if (tx < 1 || tx >= R.w - 1) continue;
      const rows = [];
      for (let ty = Math.max(1, Math.floor(vw.y / T)); ty < Math.min(R.h, Math.ceil(vw.bottom / T) + 1); ty++) if (R.solid(tx, ty) && !R.solid(tx, ty - 1) && !R.solid(tx, ty - 2)) rows.push(ty);
      if (rows.length) return [x, rows[Math.floor(Math.random() * rows.length)] * T];
    }
    return null;
  }
  update(mood, dt, vw) {
    const C = mood.critters || {}, s = this.scene, l = s.leyla, sec = Math.min(0.05, dt / 1000), g = this.g.clear(), z = (C.size ?? 200) / 100;   // Kleinvieh › Größe
    this.t += sec;
    if (this.hidden) return;
    const inView = (x, y, m = 120) => x > vw.x - m && x < vw.right + m && y > vw.y - m && y < vw.bottom + m;
    const fast = Math.abs(l.body.velocity.x) > 300 || l.state === 'dash' || l.state === 'slide';

    // ---- flies: knots over floors, each fly a dot on a little wobbly orbit ----
    const nk = Math.round(C.flies || 0);
    while (this.knots.length < nk) { const p = this.floorSpot(vw); if (!p) break; this.knots.push({ x: p[0], y: p[1] - rnd(14, 40), n: 3 + Math.floor(Math.random() * 4), ph: Math.random() * 9, flies: [] }); }
    if (this.knots.length > nk) this.knots.length = nk;
    const fc = col(C.flyColor || '#141013');
    for (const k of this.knots) {
      if (!inView(k.x, k.y, 300)) { const p = this.floorSpot(vw); if (p) Object.assign(k, { x: p[0], y: p[1] - rnd(14, 40), flies: [] }); continue; }
      while (k.flies.length < k.n) k.flies.push({ a: Math.random() * 6.28, r: rnd(6, 22), sp: rnd(5, 11) * (Math.random() < 0.5 ? -1 : 1), dx: 0, dy: 0, vx: 0, vy: 0 });
      const near = Math.hypot(l.x - k.x, l.chest - k.y) < 110;
      for (const f of k.flies) {
        f.a += f.sp * sec;
        if (near && fast) { f.vx += rnd(-900, 900) * sec; f.vy += rnd(-900, 200) * sec; }   // scatter
        f.vx *= 0.9; f.vy *= 0.9; f.dx = (f.dx + f.vx * sec) * 0.985; f.dy = (f.dy + f.vy * sec) * 0.985;
        const x = k.x + Math.cos(f.a) * f.r + Math.sin(f.a * 2.7) * 4 + f.dx, y = k.y + Math.sin(f.a * 1.3) * f.r * 0.6 + f.dy;
        g.fillStyle(fc, 0.95).fillRect(Math.round(x), Math.round(y), 2 * z, 2 * z);
      }
    }

    // ---- moths: around lamps that shine ----
    const lamps = this.atmo.lights.filter(L => L.lamp && L.f > 0.4 && inView(L.x, L.y, 200));
    const nm = Math.round((C.moths || 0) * lamps.length);
    while (this.moths.length < nm && lamps.length) { const L = lamps[Math.floor(Math.random() * lamps.length)]; this.moths.push({ L, a: Math.random() * 6.28, r: rnd(10, 34), sp: rnd(2.5, 5) * (Math.random() < 0.5 ? -1 : 1), ph: Math.random() * 9 }); }
    if (this.moths.length > nm) this.moths.length = nm;
    const mc = col(C.mothColor || '#f4d29c');
    for (const m of this.moths) {
      if (!lamps.includes(m.L)) { if (lamps.length) m.L = lamps[Math.floor(Math.random() * lamps.length)]; else continue; }
      m.a += m.sp * sec; m.ph += sec * 13;
      const bump = Math.max(0, Math.sin(m.a * 3.1)) ** 8 * 0.7;   // now and then it bumps into the lamp
      const x = m.L.x + Math.cos(m.a) * m.r * z * (1 - bump), y = m.L.y + 18 + Math.sin(m.a * 1.7) * m.r * z * 0.5 * (1 - bump), w = (Math.sin(m.ph) > 0 ? 3 : 1) * z;
      g.fillStyle(mc, 0.9).fillRect(Math.round(x - w / 2), Math.round(y), w, 2 * z);
    }

    // ---- roaches: sit still, twitch, flee from Leyla into the wall ----
    const nr = Math.round(C.roaches || 0);
    while (this.roaches.length < nr) { const p = this.floorSpot(vw); if (!p) break; this.roaches.push({ x: p[0], y: p[1], d: Math.random() < 0.5 ? -1 : 1, v: 0, wait: rnd(0.3, 3), run: 0 }); }
    if (this.roaches.length > nr) this.roaches.length = nr;
    const rc = col(C.roachColor || '#5b3138');
    for (const r of this.roaches) {
      if (r.gone || !inView(r.x, r.y, 260)) { const p = this.floorSpot(vw); if (p) Object.assign(r, { x: p[0], y: p[1], gone: false, run: 0, v: 0, wait: rnd(0.5, 3) }); continue; }
      const dx = r.x - l.x, scared = Math.abs(dx) < 170 && Math.abs(r.y - l.feet) < 90;
      if (scared && !r.run) { r.d = Math.sign(dx) || 1; r.run = rnd(0.6, 1.3); }
      if (r.run > 0) { r.run -= sec; r.v = 260 * r.d; } else if ((r.wait -= sec) <= 0) { r.wait = rnd(0.6, 3.5); r.d = Math.random() < 0.5 ? -1 : 1; r.v = rnd(30, 80) * r.d; } else r.v *= 0.9;
      const nx = r.x + r.v * sec, T = this.T, R = s.room;
      if (!R.solid(Math.floor(nx / T), Math.floor(r.y / T)) || R.solid(Math.floor(nx / T), Math.floor((r.y - 4) / T))) { if (r.run > 0) r.gone = true; r.v = 0; r.d *= -1; }   // edge or wall: into a crack
      else r.x = nx;
      const leg = Math.floor(this.t * 30) % 2;
      g.fillStyle(rc, 1).fillRect(Math.round(r.x - 3 * z), Math.round(r.y - 3 * z), 6 * z, 3 * z).fillStyle(0x141013, 1).fillRect(Math.round(r.x + (r.d > 0 ? 2 : -4) * z), Math.round(r.y - 3 * z), 2 * z, 2 * z);
      if (Math.abs(r.v) > 5) g.fillStyle(0x141013, 0.8).fillRect(Math.round(r.x + (-3 + leg * 2) * z), Math.round(r.y - z), 2 * z, z).fillRect(Math.round(r.x + (1 - leg * 2) * z), Math.round(r.y - z), 2 * z, z);
    }

    // ---- rats: now and then one runs along a floor across the whole view ----
    if (C.rats && Math.random() < C.rats / 60 * sec) { const p = this.floorSpot(vw, true); if (p) this.rats.push({ x: p[0], y: p[1], d: p[0] < l.x ? 1 : -1, v: rnd(380, 520), ph: 0, life: 6 }); }
    const ratc = col(C.ratColor || '#4a5462');
    for (const r of this.rats) {
      r.life -= sec; r.ph += sec * 22;
      const nx = r.x + r.d * r.v * sec, T = this.T, R = s.room;
      if (!R.solid(Math.floor(nx / T), Math.floor(r.y / T)) || R.solid(Math.floor(nx / T), Math.floor((r.y - 8) / T))) { r.life = 0; continue; }
      r.x = nx;
      const hop = Math.abs(Math.sin(r.ph)) * 2 * z, x = Math.round(r.x), y = Math.round(r.y - 6 * z - hop), d = r.d, Z = n => n * z;
      g.fillStyle(ratc, 1).fillRect(x - Z(6), y, Z(12), Z(5)).fillRect(d > 0 ? x + Z(6) : x - Z(9), y + Z(1), Z(3), Z(3))              // body, head
        .fillStyle(0xe86a73, 0.9).fillRect(d > 0 ? x - Z(14) : x + Z(6), y + Z(3), Z(8), Math.max(1, z * 0.7))                   // tail
        .fillStyle(0x141013, 1).fillRect(d > 0 ? x + Z(7) : x - Z(8), y + Z(1), Z(1), Z(1));                                        // eye
    }
    this.rats = this.rats.filter(r => r.life > 0 && inView(r.x, r.y, 300));

    // ---- paper scraps: pushed by the draft over the floor, flutter up now and then ----
    const np = Math.round(C.papers || 0);
    while (this.papers.length < np) { const p = this.floorSpot(vw); if (!p) break; this.papers.push({ x: p[0], y: p[1], h: 0, vh: 0, ph: Math.random() * 9, s: Math.random() < 0.5 ? 1 : -1 }); }
    if (this.papers.length > np) this.papers.length = np;
    const pc = col(C.paperColor || '#dae0ea'), wind = C.draft ?? 30;
    for (const p of this.papers) {
      if (!inView(p.x, p.y, 300)) { const q = this.floorSpot(vw); if (q) Object.assign(p, { x: q[0], y: q[1], h: 0, vh: 0 }); continue; }
      p.ph += sec;
      const gust = Math.max(0, Math.sin(p.ph * 0.8 + p.s)) ** 4;
      if (Math.abs(l.x - p.x) < 60 && fast) { p.vh = 260; }
      p.vh -= 600 * sec; p.h = Math.max(0, p.h + p.vh * sec); if (!p.h) p.vh = 0;
      const nx = p.x + (wind * gust + (p.h ? 40 : 0)) * p.s * sec, T = this.T, R = s.room;
      if (R.solid(Math.floor(nx / T), Math.floor(p.y / T)) && !R.solid(Math.floor(nx / T), Math.floor((p.y - 4) / T))) p.x = nx; else p.s *= -1;
      const flip = Math.sin(p.ph * 6) > 0;
      g.fillStyle(pc, 0.9).fillRect(Math.round(p.x - 4 * z), Math.round(p.y - 2 * z - p.h), (flip || !p.h ? 8 : 4) * z, (p.h ? 3 : 2) * z);
    }
  }
  show(v) { this.hidden = !v; this.g.setVisible(v); }
  state() { return { flies: this.knots.reduce((n, k) => n + k.flies.length, 0), moths: this.moths.length, roaches: this.roaches.filter(r => !r.gone).length, rats: this.rats.length, papers: this.papers.length }; }
}

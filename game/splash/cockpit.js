// #123 Hauptmenü aus dem Van-Cockpit (Daniel 20.11.2026: „Blick aus dem Cockpit des Vans bitte unbedingt … Die Straße und das Lenken
// könnten wir beibehalten … mach vielleicht erst ein Mockup aus Code“). A code mockup: the whole cockpit is drawn in pixels on a small
// canvas (480 × 270, scaled up sharp) over the start page scene, which drives towards us (startSplash({ drive, runner: false })).
// Steering turns the wheel and bends the road; the dice and the air freshener swing with it; the needles shiver; bumps shake the van.
// The menu runs in the radio's LCD (DOM text laid over the pixels).
//   startCockpit(canvas, { steerValue: () => -1..1, speed: () => 0..1 }) → { lcd(): {x, y, w, h} in canvas pixels, bump() }
export const PW = 480, PH = 270;

const C = {
  ink: '#060608', night: '#141013', plum: '#242234', plum2: '#403353', steel: '#333941', steel2: '#4a5462', steel3: '#6d758d', light: '#b3b9d1', white: '#e3e6ff',
  brown: '#221c1a', brown2: '#322b28', brown3: '#423934', tan: '#5a4e44', rust: '#71413b', rust2: '#bb7547', sand: '#dba463',
  red: '#b4202a', red2: '#df3e23', orange: '#fa6a0a', amber: '#f9a31b', yellow: '#ffd541', green: '#59c135', lime: '#9cdb43', mint: '#a6fcdb', teal: '#20d6c7',
  pink: '#e86a73', magenta: '#bc4a9b', purple: '#793a80', tree: '#14a02e', tree2: '#9cdb43', cyan: '#249fde'
};

export function startCockpit(canvas, { steerValue = () => 0, speed = () => 1 } = {}) {
  canvas.width = PW; canvas.height = PH;
  const ctx = canvas.getContext('2d');
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const px = (x, y, c) => rect(x, y, 1, 1, c);
  const poly = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); };
  const line = (x0, y0, x1, y1, c) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (let i = 0; i <= n; i++) px(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c); };
  const rnd = (s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(123);

  // ---------- the static parts, drawn once into a layer ----------
  const base = document.createElement('canvas'); base.width = PW; base.height = PH + 20;
  const b = base.getContext('2d');
  const B = { rect: (x, y, w, h, c) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }, poly: (pts, c) => { b.fillStyle = c; b.beginPath(); pts.forEach(([x, y], i) => i ? b.lineTo(x, y) : b.moveTo(x, y)); b.closePath(); b.fill(); } };
  const bpx = (x, y, c) => B.rect(x, y, 1, 1, c);
  const dashTop = x => 186 - 10 * Math.cos((x / PW - 0.5) * Math.PI) + (x < 200 ? 0 : 0);   // the dashboard's top edge curves up to the sides
  // headliner and the top of the windshield frame
  B.rect(0, 0, PW, 20, C.night);
  for (let x = 0; x < PW; x += 6) bpx(x + (x % 12 ? 0 : 3), 6, C.plum);   // stitching
  B.rect(0, 18, PW, 4, C.ink); B.rect(0, 22, PW, 1, C.steel);
  // sun visor (passenger side, down a little): a photo tucked into its strap
  B.poly([[300, 18], [452, 18], [448, 40], [304, 36]], C.brown2); B.rect(300, 18, 152, 2, C.brown3);
  B.rect(330, 22, 22, 16, C.white); B.rect(332, 24, 18, 10, C.cyan); B.rect(335, 29, 4, 5, C.pink); B.rect(342, 28, 5, 6, C.amber); B.rect(332, 31, 18, 3, C.tan);   // polaroid: Leyla and the crew
  B.rect(326, 26, 32, 3, C.steel);   // strap
  // A-pillars, slanted
  B.poly([[0, 22], [38, 22], [10, 200], [0, 200]], C.night); B.poly([[30, 22], [38, 22], [12, 190], [6, 190]], C.plum);
  B.poly([[PW, 22], [PW - 38, 22], [PW - 10, 200], [PW, 200]], C.night); B.poly([[PW - 30, 22], [PW - 38, 22], [PW - 12, 190], [PW - 6, 190]], C.plum);
  // a crack in the windshield, top right: a star with long lines
  const cx0 = 402, cy0 = 70;
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + rnd() * 0.5, L = 8 + rnd() * 34; let x = cx0, y = cy0; for (let s = 0; s < L; s++) { x += Math.cos(a) + (rnd() - 0.5) * 0.7; y += Math.sin(a) + (rnd() - 0.5) * 0.7; b.globalAlpha = 0.55 * (1 - s / L); bpx(x, y, C.white); } }
  b.globalAlpha = 0.8; for (let i = 0; i < 6; i++) bpx(cx0 + (rnd() - 0.5) * 4, cy0 + (rnd() - 0.5) * 4, C.white); b.globalAlpha = 1;
  // dirt along the bottom of the glass
  for (let x = 10; x < PW - 10; x++) for (let y = 150; y < 190; y++) if (rnd() < (y - 150) / 40 * 0.22) { b.globalAlpha = 0.25 + rnd() * 0.3; bpx(x, y, rnd() < 0.5 ? C.tan : C.sand); }
  b.globalAlpha = 1;
  // the dashboard
  b.beginPath(); b.moveTo(0, PH + 20); for (let x = 0; x <= PW; x += 4) b.lineTo(x, dashTop(x)); b.lineTo(PW, PH + 20); b.closePath(); b.fillStyle = C.brown2; b.fill();
  for (let x = 0; x < PW; x++) { const t = Math.round(dashTop(x)); bpx(x, t, C.tan); bpx(x, t + 1, C.brown3); bpx(x, t + 7, C.brown); }
  // plastic grain and cracks with tape
  for (let i = 0; i < 900; i++) { const x = rnd() * PW, y = dashTop(x) + 9 + rnd() * 90; bpx(x, y, rnd() < 0.5 ? C.brown : C.brown3); }
  [[170, 196, 30, 9], [440, 200, -26, 14]].forEach(([x, y, dx, dy]) => { for (let s = 0; s <= 30; s++) bpx(x + dx * s / 30 + Math.sin(s) * 1.2, y + dy * s / 30, C.ink); });
  B.rect(176, 197, 14, 5, C.light); B.rect(176, 197, 14, 1, C.white);   // duct tape over the crack
  // instrument cluster (behind the wheel): a hood, two gauges, warning lights
  B.poly([[54, 196], [210, 196], [204, 182], [62, 182]], C.ink); B.rect(56, 196, 152, 40, C.night);
  const gauge = (gx, gy, r) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y); if (d <= r) bpx(gx + x, gy + y, d > r - 2 ? C.steel2 : d > r - 3 ? C.ink : C.plum); } for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.8 + i * 0.14); bpx(gx + Math.cos(a) * (r - 4), gy + Math.sin(a) * (r - 4), i > 7 ? C.red2 : C.light); } };
  gauge(92, 216, 17); gauge(170, 216, 17);
  // center console: the radio (the menu's LCD), cassette slot, buttons; vents
  B.rect(256, 186, 150, 84, C.brown); B.rect(258, 188, 146, 80, C.steel); B.rect(258, 188, 146, 1, C.steel3);
  B.rect(264, 194, 134, 50, C.ink);   // LCD bezel
  for (let i = 0; i < 6; i++) { B.rect(266 + i * 22, 250, 18, 8, C.steel2); B.rect(266 + i * 22, 250, 18, 1, C.light); }
  B.rect(282, 260, 98, 4, C.ink);   // cassette slot
  [[214, 238], [416, 238]].forEach(([x, y]) => { B.rect(x, y, 30, 22, C.ink); for (let i = 0; i < 5; i++) B.rect(x + 2, y + 2 + i * 4, 26, 2, C.steel); });
  // passenger side: a crumpled map and a can with a cactus on the dash
  B.poly([[420, 182], [470, 178], [474, 188], [424, 192]], C.sand); for (let i = 0; i < 6; i++) B.rect(426 + i * 8, 182 + (i % 2), 1, 8, C.rust2); B.rect(440, 184, 4, 2, C.red);
  B.rect(30, 168, 14, 16, C.steel2); B.rect(30, 168, 14, 2, C.light); B.rect(32, 172, 10, 3, C.red2);   // can
  B.rect(34, 152, 6, 18, C.tree); B.rect(30, 158, 4, 6, C.tree); B.rect(40, 156, 4, 6, C.tree); B.rect(35, 153, 1, 14, C.tree2); bpx(36, 151, C.pink);

  // ---------- moving parts ----------
  const pend = [{ x: 228, len: 34, a: 0, v: 0, kind: 'tree' }, { x: 250, len: 26, a: 0, v: 0, kind: 'dice' }];
  let last = performance.now(), bumpY = 0, bumpV = 0, nextBump = 0, lean = 0, needle = 0, rpm = 0, blink = 0;
  const wheel = (cxw, cyw, R, ang) => {   // the steering wheel: ring with tape at the top, three spokes, horn pad; rotated per pixel
    const ca = Math.cos(-ang), sa = Math.sin(-ang);
    for (let y = -R - 2; y <= R + 2; y++) for (let x = -R - 2; x <= R + 2; x++) {
      const yy = cyw + y; if (yy >= PH) continue;
      const d = Math.hypot(x, y); const u = x * ca - y * sa, v = x * sa + y * ca;   // wheel coordinates
      let c = null;
      if (d <= R && d >= R - 9) {
        const lit = (-x - y) / (d || 1);   // light from top left
        c = d > R - 1.5 || d < R - 8 ? C.ink : lit > 0.45 ? C.steel3 : lit > -0.3 ? C.steel2 : C.steel;
        if (Math.abs(u) < 5 && v < 0) c = d > R - 1.5 || d < R - 8 ? C.ink : C.red2;   // tape at 12 o'clock
        if (Math.abs(u) < 5 && v < 0 && Math.abs(u) > 3.5) c = C.red;
      } else if (d < R - 9) {
        const spoke = (Math.abs(v) < 4 && Math.abs(u) > 12) || (u > -3.5 && u < 3.5 && v > 12);   // left, right, down
        if (d < 15) c = d > 14 ? C.ink : d > 12 ? C.steel2 : C.plum2;
        else if (spoke) c = Math.abs(v) > 3 || (v > 12 && Math.abs(u) > 2.6) ? C.ink : C.steel2;
        if (d < 9 && d > 2) { const pu = Math.round(u), pv = Math.round(v); if ((pu === -2 || pu === 2) && pv === -1) c = C.pink; if (pv === 2 && Math.abs(pu) <= 3) c = C.pink; }   // a pink cat face sticker on the horn
      }
      if (c) px(cxw + x, yy, c);
    }
  };
  const lcdBox = { x: 266, y: 196, w: 130, h: 46 };
  let raf = 0, alive = true;
  const frame = now => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
    const st = steerValue(), sp = speed();
    // bumps: now and then the van drops into a pothole
    if (now > nextBump) { bumpV -= 18 + Math.random() * 30; nextBump = now + 600 + Math.random() * 2600; }
    bumpV += (-bumpY * 90 - bumpV * 9) * dt; bumpY += bumpV * dt;
    const jit = Math.sin(t * 31) * 0.35 * sp;
    lean += (-st * 4 - lean) * Math.min(1, dt * 3);
    ctx.clearRect(0, 0, PW, PH);
    ctx.save(); ctx.translate(Math.round(lean), Math.round(bumpY + jit));
    ctx.drawImage(base, 0, 0);
    rect(-14, 0, 14, PH + 14, C.night); rect(PW, 0, 14, PH + 14, C.night); rect(-14, -14, PW + 28, 14, C.night);   // the edges stay closed when the van leans
    // rear-view mirror with the rig behind us in it
    rect(196, 22, 4, 8, C.ink); rect(170, 28, 90, 18, C.ink); rect(172, 30, 86, 14, C.plum);
    for (let i = 0; i < 86; i++) { const h = 4 + Math.round(Math.sin(i * 0.3 + t * 0.4) * 1.5); rect(172 + i, 44 - h, 1, h, i % 9 < 2 ? C.rust : C.plum2); }
    rect(206, 33, 20, 8, C.rust2); rect(208, 34, 6, 3, C.teal); rect(218, 34, 6, 3, C.teal); px(212, 31, C.amber);   // the trailer, lamps on
    rect(172, 30, 86, 1, C.steel3); ctx.globalAlpha = 0.18; rect(176, 31, 20, 12, C.white); ctx.globalAlpha = 1;
    // air freshener and dice: pendulums that swing with the steering and the bumps
    for (const p of pend) {
      const acc = (st * 2.4 + Math.sin(t * 1.3 + p.x) * 0.15) * 9.8 / p.len * 0.4 + bumpV * 0.004;
      p.v += (-9.8 / (p.len / 10) * Math.sin(p.a) - p.v * 0.9 + acc) * dt; p.a += p.v * dt;
      const ex = p.x + Math.sin(p.a) * p.len, ey = 44 + Math.cos(p.a) * p.len;
      line(p.x, 44, ex, ey, C.light);
      if (p.kind === 'tree') {
        for (let r = 0; r < 14; r++) { const w = 1 + Math.floor(r / 2); rect(ex - w, ey + r, w * 2 + 1, 1, r % 4 === 3 ? C.tree2 : C.tree); }
        rect(ex - 1, ey + 14, 3, 3, C.brown3); rect(ex - 4, ey + 7, 9, 3, C.white); rect(ex - 3, ey + 8, 7, 1, C.red);
      } else {
        const die = (x, y, c, c2) => { rect(x - 4, y, 9, 9, c); rect(x - 4, y, 9, 1, C.white); rect(x - 4, y + 8, 9, 1, c2); px(x - 2, y + 2, C.white); px(x + 2, y + 6, C.white); px(x, y + 4, C.white); };
        die(ex - 4, ey, C.magenta, C.purple); die(ex + 5, ey + 3, C.teal, C.cyan);
      }
    }
    // gauges: speed and revs shiver with the road; warning lights
    needle += ((0.45 + sp * 0.35 + Math.sin(t * 7) * 0.02 + Math.max(0, -bumpV) * 0.002) - needle) * Math.min(1, dt * 4);
    rpm += ((0.55 + Math.abs(st) * 0.15 + Math.sin(t * 13) * 0.04) - rpm) * Math.min(1, dt * 6);
    [[92, needle], [170, rpm]].forEach(([gx, v]) => { const a = Math.PI * (0.8 + v * 1.4); line(gx, 216, gx + Math.cos(a) * 13, 216 + Math.sin(a) * 13, C.orange); rect(gx - 1, 215, 3, 3, C.red2); });
    blink = (blink + dt) % 1.4;
    rect(124, 204, 6, 4, blink < 0.7 ? C.amber : C.brown3);   // check engine
    rect(124, 222, 6, 4, C.green); rect(133, 222, 6, 4, Math.sin(t * 0.7) > 0.6 ? C.red2 : C.brown3);   // fuel low now and then
    // LCD glow (the text lies in the DOM)
    rect(lcdBox.x, lcdBox.y, lcdBox.w, lcdBox.h, '#0b1a12');
    ctx.globalAlpha = 0.12 + 0.03 * Math.sin(t * 3); rect(lcdBox.x, lcdBox.y, lcdBox.w, lcdBox.h, C.lime); ctx.globalAlpha = 1;
    for (let y = lcdBox.y; y < lcdBox.y + lcdBox.h; y += 2) { ctx.globalAlpha = 0.18; rect(lcdBox.x, y, lcdBox.w, 1, C.ink); } ctx.globalAlpha = 1;
    // the cassette sticks out of the slot, reels turn
    rect(290, 254, 82, 8, C.ink); rect(292, 252, 78, 8, C.white); rect(296, 253, 70, 3, C.pink); rect(296, 256, 70, 1, C.teal);
    // the steering wheel (in front of everything): turns up to 120° with the steering
    wheel(128, 268, 68, st * 2.1);
    // windshield glare: two soft diagonal streaks drifting a little
    ctx.globalAlpha = 0.05; for (let i = 0; i < 2; i++) { const o = 140 + i * 40 + Math.sin(t * 0.2) * 10; poly([[o, 24], [o + 14 + i * 8, 24], [o - 70 + i * 8, 170], [o - 84, 170]], C.white); } ctx.globalAlpha = 1;
    ctx.restore();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { lcd: () => ({ ...lcdBox, x: lcdBox.x + Math.round(lean), y: lcdBox.y + Math.round(bumpY) }), bump: () => { bumpV -= 40; }, stop: () => { alive = false; cancelAnimationFrame(raf); } };
}

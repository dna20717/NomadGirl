// #124 Hauptmenü aus dem Van-Cockpit, „in hübsch“ (Daniel 20.11.2026: „Alles modular, damit wir es ggf. im Code animieren können“;
// „so, dass wir es später um Clutter ergänzen können“; „Achievements als Sticker im Innenraum“). Every piece is its own PixelLab
// picture placed by Startseite › Cockpit (data/splash.json › cockpit, pixels of the shell, 384 × 216):
//   shell (roof, pillars, dashboard; the glass is transparent) · mirror with things hanging from it (pendulums) · clutter on the
//   dashboard (a table: add a row = a new piece) · stickers (reached achievements, the trophy picture with a white die-cut edge) ·
//   instruments (needles from code) · radio (the menu lies in its LCD as DOM text) · steering wheel (turns with the steering)
// The whole cockpit leans into bends and shakes in potholes. Drawn sharp on a small canvas, scaled up by CSS.
//   startCockpit(canvas, { cfg, A, base, steerValue, speed, stickers }) → { lcd(), bump(), stop() }
export const PW = 384, PH = 216;

const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

// a sticker: the picture with a white die-cut edge, a dark hairline and a soft shadow; one corner peels a little
export function makeSticker(img, sx, sy, sw, sh, size) {
  const k = size / Math.max(sw, sh), w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k)), pad = 3;
  const c = document.createElement('canvas'); c.width = w + pad * 2; c.height = h + pad * 2;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const pic = document.createElement('canvas'); pic.width = w; pic.height = h;
  const pg = pic.getContext('2d'); pg.imageSmoothingEnabled = false; pg.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const sil = (col, grow) => { const s = document.createElement('canvas'); s.width = w; s.height = h; const sg = s.getContext('2d'); sg.drawImage(pic, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = col; sg.fillRect(0, 0, w, h);
    for (let dy = -grow; dy <= grow; dy++) for (let dx = -grow; dx <= grow; dx++) if (Math.abs(dx) + Math.abs(dy) <= grow + 0.5) g.drawImage(s, pad + dx, pad + dy); };
  sil('#060608', 3); sil('#e3e6ff', 2);   // hairline, white edge
  g.drawImage(pic, pad, pad);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(pad, pad, w, Math.max(1, Math.round(h * 0.18)));   // gloss
  g.fillStyle = '#b3b9d1'; g.beginPath(); g.moveTo(c.width - 1, c.height - 6); g.lineTo(c.width - 6, c.height - 1); g.lineTo(c.width - 6, c.height - 6); g.closePath(); g.fill();   // peeling corner
  return c;
}

export async function startCockpit(canvas, { cfg = {}, A = {}, base = location.href, steerValue = () => 0, speed = () => 1, stickers = [] } = {}) {
  canvas.width = PW; canvas.height = PH;
  const ctx = canvas.getContext('2d');
  const url = id => A[id]?.file ? new URL(A[id].file, base).href : null;
  const pic = id => url(id) ? load(url(id)) : Promise.resolve(null);
  const C = cfg;
  const [shell, wheel, cluster, radio, mirror, visor] = await Promise.all([C.shell, C.wheel?.look, C.cluster?.look, C.radio?.look, C.mirror?.look, C.visor?.look].map(pic));
  const hang = (await Promise.all((C.hang || []).map(async h => ({ ...h, img: await pic(h.look), a: 0, v: 0 })))).filter(h => h.img);
  const clutter = (await Promise.all((C.clutter || []).map(async c => ({ ...c, img: await pic(c.look), ph: Math.random() * 9 })))).filter(c => c.img);
  // stickers: [{ img, sx, sy, sw, sh }] in the order of the spots
  const spots = C.stickers || [];
  const stick = stickers.slice(0, spots.length).map((s, i) => ({ c: makeSticker(s.img, s.sx, s.sy, s.sw, s.sh, spots[i].size || 14), at: spots[i].at || [0, 0], turn: (spots[i].turn || 0) * Math.PI / 180 }));
  const put = (img, at, scale = 1, flip = false) => { if (!img) return; const w = Math.round(img.width * scale), h = Math.round(img.height * scale); ctx.save(); ctx.translate(Math.round(at[0]), Math.round(at[1])); if (flip) ctx.scale(-1, 1); ctx.drawImage(img, -Math.round(w / 2), -Math.round(h / 2), w, h); ctx.restore(); };
  const box = (img, at, scale = 1) => img ? { x: Math.round(at[0] - img.width * scale / 2), y: Math.round(at[1] - img.height * scale / 2), k: scale } : null;

  let last = performance.now(), bumpY = 0, bumpV = 0, nextBump = 0, lean = 0, raf = 0, alive = true;
  const needleV = {};
  const lcdBox = () => { const R = C.radio || {}, b = box(radio, R.at || [0, 0], (R.scale ?? 100) / 100); if (!b) return { x: 0, y: 0, w: 0, h: 0 }; const [lx, ly] = R.lcd || [0, 0], [lw, lh] = R.lcdSize || [radio.width, radio.height]; return { x: b.x + lx * b.k, y: b.y + ly * b.k, w: lw * b.k, h: lh * b.k }; };
  const frame = now => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
    const st = steerValue(), sp = speed();
    if (now > nextBump) { bumpV -= 14 + Math.random() * 26; nextBump = now + 700 + Math.random() * 2800; }   // potholes
    bumpV += (-bumpY * 90 - bumpV * 9) * dt; bumpY += bumpV * dt;
    lean += (-st * 3 - lean) * Math.min(1, dt * 3);
    ctx.clearRect(0, 0, PW, PH); ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.translate(Math.round(lean), Math.round(bumpY + Math.sin(t * 31) * 0.3 * sp));
    // things hanging from the mirror: pendulums (steering pushes them sideways, bumps make them jump)
    for (const h of hang) {
      const L = Math.max(4, h.length || 10) + (h.img.height * (h.scale ?? 50) / 100) / 2;
      const acc = st * 1.8 + Math.sin(t * 1.1 + h.from[0]) * 0.08 + bumpV * 0.01;
      h.v += (-(9.8 / (L / 12)) * Math.sin(h.a) - h.v * 0.8 + acc) * dt; h.a += h.v * dt;
      const ex = h.from[0] + Math.sin(h.a) * (h.length || 10), ey = h.from[1] + Math.cos(h.a) * (h.length || 10);
      ctx.fillStyle = '#b3b9d1'; for (let i = 0; i <= 10; i++) ctx.fillRect(Math.round(h.from[0] + (ex - h.from[0]) * i / 10), Math.round(h.from[1] + (ey - h.from[1]) * i / 10), 1, 1);
      const s = (h.scale ?? 50) / 100; ctx.save(); ctx.translate(Math.round(ex), Math.round(ey)); ctx.rotate(-h.a * 0.6); ctx.drawImage(h.img, -Math.round(h.img.width * s / 2), 0, Math.round(h.img.width * s), Math.round(h.img.height * s)); ctx.restore();
    }
    if (C.mirror) put(mirror, C.mirror.at, (C.mirror.scale ?? 100) / 100);
    ctx.fillStyle = '#141013'; ctx.fillRect(-12, -12, 12, PH + 24); ctx.fillRect(PW, -12, 12, PH + 24); ctx.fillRect(-12, -12, PW + 24, 12);   // closed edges when leaning
    if (shell) ctx.drawImage(shell, 0, 0, PW, PH);
    if (C.visor?.at) put(visor, C.visor.at, (C.visor.scale ?? 100) / 100);
    for (const s of stick) { ctx.save(); ctx.translate(s.at[0], s.at[1]); ctx.rotate(s.turn); ctx.globalAlpha = 0.35; ctx.fillStyle = '#060608'; ctx.fillRect(-s.c.width / 2 + 1, -s.c.height / 2 + 1, s.c.width, s.c.height); ctx.globalAlpha = 1; ctx.drawImage(s.c, -Math.round(s.c.width / 2), -Math.round(s.c.height / 2)); ctx.restore(); }
    const drawClutter = layer => { for (const c of clutter) if ((c.depth || 0) === layer) {
      const s = (c.scale ?? 50) / 100, w = Math.round(c.img.width * s), h = Math.round(c.img.height * s), wob = c.wobble ? Math.sin(t * 5 + c.ph) * 0.12 + bumpV * 0.004 : 0;
      ctx.save(); ctx.translate(Math.round(c.at[0]), Math.round(c.at[1])); ctx.rotate(wob); ctx.drawImage(c.img, -Math.round(w / 2), -h, w, h); ctx.restore();
    } };
    drawClutter(0);
    // instruments: needles shiver with the road and jump in potholes
    if (cluster && C.cluster) {
      const b = box(cluster, C.cluster.at, (C.cluster.scale ?? 100) / 100); ctx.drawImage(cluster, b.x, b.y, cluster.width * b.k, cluster.height * b.k);
      for (const n of C.cluster.needles || []) {
        const want = n.kind === 'rpm' ? 0.5 + Math.abs(st) * 0.15 + Math.sin(t * 13) * 0.04 : n.kind === 'fuel' ? 0.18 : 0.42 + sp * 0.3 + Math.sin(t * 7) * 0.02 + Math.max(0, -bumpV) * 0.003;
        const v = needleV[n.kind] = (needleV[n.kind] ?? want) + (want - (needleV[n.kind] ?? want)) * Math.min(1, dt * 5);
        const a = Math.PI * (0.75 + v * 1.5), cx = b.x + n.at[0] * b.k, cy = b.y + n.at[1] * b.k, L = (n.length || 10) * b.k;
        ctx.fillStyle = '#df3e23'; for (let i = 0; i <= L; i++) ctx.fillRect(Math.round(cx + Math.cos(a) * i), Math.round(cy + Math.sin(a) * i), 1, 1);
        ctx.fillStyle = '#060608'; ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3);
      }
    }
    // the radio, its LCD glows (the menu text lies over it in the DOM)
    if (radio && C.radio) {
      const b = box(radio, C.radio.at, (C.radio.scale ?? 100) / 100); ctx.drawImage(radio, b.x, b.y, radio.width * b.k, radio.height * b.k);
      const L = lcdBox(); ctx.fillStyle = '#0b1a12'; ctx.fillRect(L.x, L.y, L.w, L.h);
      ctx.globalAlpha = 0.14 + 0.03 * Math.sin(t * 3); ctx.fillStyle = '#9cdb43'; ctx.fillRect(L.x, L.y, L.w, L.h); ctx.globalAlpha = 0.2; ctx.fillStyle = '#060608';
      for (let y = L.y; y < L.y + L.h; y += 2) ctx.fillRect(L.x, y, L.w, 1);
      ctx.globalAlpha = 1;
    }
    // the steering wheel turns with the steering
    if (wheel && C.wheel) {
      const k = (C.wheel.scale ?? 100) / 100, w = wheel.width * k, h = wheel.height * k;
      ctx.save(); ctx.translate(Math.round(C.wheel.at[0]), Math.round(C.wheel.at[1])); ctx.rotate(st * (C.wheel.turn ?? 120) * Math.PI / 180); ctx.drawImage(wheel, -w / 2, -h / 2, w, h); ctx.restore();
    }
    drawClutter(1);
    ctx.restore();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { lcd: () => { const L = lcdBox(); return { ...L, x: L.x + Math.round(lean), y: L.y + Math.round(bumpY) }; }, bump: () => { bumpV -= 40; }, stop: () => { alive = false; cancelAnimationFrame(raf); } };
}

// reached achievements → sticker sources (trophy picture of each: achievement › recipe › item › icon sheet cell)
export async function achievementStickers(D, done, base) {
  const out = [];
  for (const [id, a] of Object.entries(D.achievements || {})) {
    if (!done[id]) continue;
    const r = D.recipes?.[a.recipe], it = D.items?.[r?.result], sheet = D.assets?.[it?.look];
    if (!sheet?.file || it.icon == null) continue;
    const [c] = sheet.grid || [1, 1], [cw, ch] = Array.isArray(sheet.cell) ? sheet.cell : [sheet.cell || 1, sheet.cell || 1];
    const img = await load(new URL(sheet.file, base).href); if (!img) continue;
    const col = it.icon % c, row = Math.floor(it.icon / c), w = img.width / c, h = img.height / (sheet.grid?.[1] || 1);
    out.push({ id, img, sx: col * w, sy: row * h, sw: w, sh: h, cw, ch });
  }
  return out;
}

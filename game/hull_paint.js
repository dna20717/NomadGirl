// Hüllen G4 (#171): paints a hull plan (engine/facade.js planHull) into a 2D canvas, in pixel art on the AAP-64 palette with ordered
// dithering, light from the upper left. Used by the game (game/play/hull.js, chunks of canvas scaled up sharp) and the workshop preview
// (game/workshop/summaries.js). No Phaser, no DOM beyond the context it gets. No text anywhere (Projekt-Regel: keine Texte in Grafiken).
//   paintHull(ctx, plan, { g, x0, y0, w, h, dim })   tiles [x0, x0 + w) × [y0, y0 + h) at g pixels per tile, (x0, y0) at the canvas origin
//   paintSkyline(ctx, sky, { x, base, color, lit, k })  far silhouettes (engine/facade.js skylinePlan) standing on `base`
//   paintWindowView(ctx, x, y, w, h, { sky, seed })   the view out of a room window: dusk sky and the far city

const AAP = '060608 141013 3b1725 73172d b4202a df3e23 fa6a0a f9a31b ffd541 fffc40 d6f264 9cdb43 59c135 14a02e 1a7a3e 24523b 122020 143464 285cc4 249fde 20d6c7 a6fcdb ffffff fef3c0 fad6b8 f5a097 e86a73 bc4a9b 793a80 403353 242234 221c1a 322b28 71413b bb7547 dba463 f4d29c dae0ea b3b9d1 8b93af 6d758d 4a5462 333941 422433 5b3138 8e5252 ba756a e9b5a3 e3e6ff b9bffb 849be4 588dbe 477d85 23674e 328464 5daf8d 92dcba cdf7e2 e4d2aa c7b08b a08662 796755 5a4e44 423934'.split(' ').map(h => parseInt(h, 16));
const cache = new Map();
const rgbOf = n => [n >> 16 & 255, n >> 8 & 255, n & 255];
export function snap(c) {
  const n = typeof c === 'number' ? c : parseInt(String(c || '#ffffff').replace('#', ''), 16);
  if (cache.has(n)) return cache.get(n);
  const [r, g, b] = rgbOf(n);
  let best = AAP[0], bd = 1e9;
  for (const p of AAP) { const [pr, pg, pb] = rgbOf(p), d = (pr - r) ** 2 * 0.3 + (pg - g) ** 2 * 0.59 + (pb - b) ** 2 * 0.11; if (d < bd) { bd = d; best = p; } }
  cache.set(n, best);
  return best;
}
const css = n => '#' + n.toString(16).padStart(6, '0');
const toN = c => typeof c === 'number' ? c : parseInt(String(c || '#888888').replace('#', ''), 16);
// mix towards another colour (k 0..1), then snap: shades stay on the palette
const mix = (a, b, k) => { const A = rgbOf(toN(a)), B = rgbOf(toN(b)); return snap((Math.round(A[0] + (B[0] - A[0]) * k) << 16) | (Math.round(A[1] + (B[1] - A[1]) * k) << 8) | Math.round(A[2] + (B[2] - A[2]) * k)); };
const DARK = 0x141013, INK = 0x060608, LIGHT = 0xfef3c0;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------------- #172 painted modules (PixelLab, AAP-64): helpers ----------------
// A module is an asset id in plan.cfg.art (Welt › Gebäudetypen › Module, Spiel › Hülle › Module); `art(id)` gives the loaded picture or null.
// A list of ids is a set of variants (picked per place by hash). Modules are painted at plan.cfg.artPx pixels per tile (Standard 32).
const mkCanvas = (w, h) => { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const dimCache = new WeakMap();
// the picture darkened by k (0..1) towards DARK, cached: things behind the play space (Spiel › Hülle › Vordächer und Treppen dunkler)
function dimmed(img, k) {
  if (!k) return img;
  let m = dimCache.get(img); if (!m) dimCache.set(img, m = new Map());
  const key = Math.round(k * 100);
  if (!m.has(key)) {
    const c = mkCanvas(img.width, img.height), x = c.getContext('2d');
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = k; x.fillStyle = '#141013'; x.fillRect(0, 0, c.width, c.height);
    m.set(key, c);
  }
  return m.get(key);
}
// the picture coloured over by `color` (k 0..1), cached: a painted coping in the type's trim colour (the red fascia of the gas station)
function tinted(img, color, k = 0.6) {
  if (!color) return img;
  let m = dimCache.get(img); if (!m) dimCache.set(img, m = new Map());
  const key = color + k;
  if (!m.has(key)) {
    const c = mkCanvas(img.width, img.height), x = c.getContext('2d');
    // #178 multiply keeps the painted light and shade (a plain overlay made the red fascia look pink), then a little of the colour on top
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-atop'; x.globalAlpha = k * 0.35; x.fillRect(0, 0, c.width, c.height);
    x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0);
    m.set(key, c);
  }
  return m.get(key);
}
// 9-slice: corners keep their size (scaled by s), edges and middle stretch; for windows of any size in the grid
function nine(ctx, img, dx, dy, dw, dh, s = 1) {
  const iw = img.width, ih = img.height, b = Math.max(2, Math.round(Math.min(iw, ih) * 0.2)), d = Math.max(2, Math.min(Math.round(b * s), Math.floor(dw / 2) - 1, Math.floor(dh / 2) - 1));
  const sx = [0, b, iw - b, iw], sy = [0, b, ih - b, ih], X = [dx, dx + d, dx + dw - d, dx + dw], Y = [dy, dy + d, dy + dh - d, dy + dh];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const w0 = sx[i + 1] - sx[i], h0 = sy[j + 1] - sy[j], w1 = X[i + 1] - X[i], h1 = Y[j + 1] - Y[j];
    if (w0 > 0 && h0 > 0 && w1 > 0 && h1 > 0) ctx.drawImage(img, sx[i], sy[j], w0, h0, X[i], Y[j], w1, h1);
  }
}
// a picture into a box (pixels): keep its aspect, stretch up to `stretch` to fill more of the box, stand on the bottom, centred
function fitIn(ctx, img, x, y, w, h, { stretch = 1.25, mode = 'contain', flip = false } = {}) {
  const a = img.width / img.height;
  let dw, dh;
  if (mode === 'height') { dh = h; dw = Math.min(h * a, w * 2.2); if (dw < h * a) dh = Math.min(h, dw / a * stretch); }
  else if (a > w / h) { dw = w; dh = Math.min(h, w / a * stretch); }
  else { dh = h; dw = Math.min(w, h * a * stretch); }
  const X = Math.round(x + (w - dw) / 2), Y = Math.round(y + h - dh);
  if (flip) { ctx.save(); ctx.translate(X + dw, Y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, Math.round(dw), Math.round(dh)); ctx.restore(); }
  else ctx.drawImage(img, X, Y, Math.round(dw), Math.round(dh));
  return { x: X, y: Y, w: dw, h: dh };
}
// all asset ids a hull config uses (for loading them before painting)
export function hullArtIds(cfg) {
  const out = new Set();
  for (const v of Object.values(cfg?.art || {})) for (const id of Array.isArray(v) ? v : [v]) if (typeof id === 'string' && id && id[0] !== '#') out.add(id);
  return [...out];
}

export function paintHull(ctx, plan, { g = 16, x0 = 0, y0 = 0, w = plan.W, h = plan.H, dim = 45, art = null } = {}) {
  if (!plan?.on) return;
  const C = plan.cfg, W = plan.W, H = plan.H, cls = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? 0 : plan.cls[y * W + x];
  const pw = w * g, ph = h * g, X = x => Math.round((x - x0) * g), Y = y => Math.round((y - y0) * g);
  const wall = snap(C.wall), trim = snap(C.trim), glass = snap(C.glass), frame = snap(C.frame), lit = snap(C.litColor || '#ffd541'), roofC = snap(C.roofColor), baseC = snap(C.baseColor);
  const back = c => mix(c, 0x141013, dim / 100);   // things behind the play space: darker, never read as a platform
  // #172 modules: M(key, seed) → picture or null (code painting stays the fallback), s = canvas pixels per module pixel
  const M = (key, seed = 0) => {
    if (!art) return null;
    let v = C.art?.[key]; if (Array.isArray(v)) v = v.length ? v[Math.floor(hash(seed | 0, v.length, 77) * v.length) % v.length] : null;
    const im = v ? art(v) : null; return im && im.width ? im : null;
  };
  const s = g / Math.max(4, C.artPx || 32), artDim = (C.artDim ?? 0) / 100;
  const bOf = (x, y) => { for (let b = 0; b < plan.buildings.length; b++) for (const v of plan.buildings[b].volumes) if (x >= v.x0 && x <= v.x1 && y >= v.top && y <= v.bottom) return b; return -1; };

  // ---------- 1. the mass: facade (wall with light from above, dithered), earth (strata) — per pixel ----------
  const img = ctx.createImageData(pw, ph), data = img.data;
  const light = mix(wall, 0xffffff, 0.22), shade = mix(wall, DARK, 0.28), deep = mix(wall, DARK, 0.5);
  const earth = [0x796755, 0x5a4e44, 0x423934, 0x322b28, 0x221c1a].map(snap), grass = snap(0xa08662);
  const put = (i, c) => { data[i] = c >> 16 & 255; data[i + 1] = c >> 8 & 255; data[i + 2] = c & 255; data[i + 3] = 255; };
  const tops = new Map();   // per building: its top row, for the light gradient
  plan.buildings.forEach((b, i) => tops.set(i, b.top));
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const x = x0 + tx, y = y0 + ty, k = cls(x, y);
    if (k !== 1 && k !== 4) continue;
    const bi = k === 1 ? bOf(x, y) : -1, top = bi >= 0 ? tops.get(bi) : plan.mound?.surf ?? 0, span = Math.max(4, plan.ground - top);
    for (let py = 0; py < g; py++) {
      const fy = (y + py / g - top) / span;   // 0 at the top, 1 at the ground
      for (let px = 0; px < g; px++) {
        const i = ((ty * g + py) * pw + tx * g + px) * 4, b = BAYER[(py & 3) * 4 + (px & 3)];
        if (k === 4) {   // earth: strata that get darker with depth, a few stones
          const d = Math.max(0, y + py / g - (plan.mound?.surf ?? 0)), band = Math.min(earth.length - 1, Math.floor(d / 2.5 + (b - 0.5) * 0.6 + Math.sin((x * g + px) * 0.05) * 0.25));
          let c = earth[Math.max(0, band)];
          if (d < 0.35) c = grass;
          if (hash(x * g + px >> 2, y * g + py >> 2, 3) < 0.012) c = earth[0];
          put(i, c); continue;
        }
        // facade: a little light at the top of the building, shade towards the ground
        put(i, fy < 0.15 && b < (0.15 - fy) * 4 ? light : fy > 0.55 && b < (fy - 0.55) * 1.4 ? shade : wall);
      }
    }
  }
  // the earth's surface: grass tufts against the sky
  if (plan.mound) for (let tx = 0; tx < w; tx++) { const x = x0 + tx; for (let ty = 0; ty < h; ty++) { const y = y0 + ty; if (cls(x, y) === 4 && cls(x, y - 1) === 2) for (let px = 0; px < g; px += 2) if (hash(x * g + px, y, 5) < 0.4) { const hh = 1 + Math.floor(hash(x * g + px, y, 6) * g * 0.25); for (let k = 1; k <= hh && ty * g - k >= 0; k++) put(((ty * g - k) * pw + tx * g + px) * 4, k < 2 ? 0x24523b : 0x59c135); } } }
  ctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.translate(-x0 * g, -y0 * g);
  ctx.imageSmoothingEnabled = false;
  const R = (c, x, y, ww, hh) => { ctx.fillStyle = css(c); ctx.fillRect(Math.round(x * g), Math.round(y * g), Math.max(1, Math.round(ww * g)), Math.max(1, Math.round(hh * g))); };
  const Rp = (c, x, y, ww, hh) => { ctx.fillStyle = css(c); ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(ww)), Math.max(1, Math.round(hh))); };   // in pixels
  const facadePath = bi => {   // clip to this building's facade tiles (row runs)
    const p = new Path2D(), b = plan.buildings[bi];
    for (let y = Math.max(y0, b.top); y <= Math.min(y0 + h - 1, b.bottom); y++) {
      let run = -1;
      for (let x = Math.max(x0, b.x0 - 1); x <= Math.min(x0 + w, b.x1 + 1); x++) {
        const on = cls(x, y) === 1 && bOf(x, y) === bi;
        if (on && run < 0) run = x;
        if (!on && run >= 0) { p.rect(run * g, y * g, (x - run) * g, g); run = -1; }
      }
      if (run >= 0) p.rect(run * g, y * g, (Math.min(x0 + w, b.x1 + 1) + 1 - run) * g, g);
    }
    return p;
  };
  const px1 = Math.max(1, Math.round(g / 16));   // one art pixel at this grain
  // #172 a texture tiled over a rectangle (tile units), aligned to the world, at `sc` canvas pixels per module pixel; stripH: squeeze to that height
  const tileRect = (img, x, y, ww, hh, { sc = s, stripH = 0, dimK = 0 } = {}) => {
    const im = dimK ? dimmed(img, dimK) : img, th = stripH ? stripH * g : img.height * sc, tw = img.width * (stripH ? th / img.height : sc);
    if (tw < 1 || th < 1) return;
    ctx.save(); ctx.beginPath(); ctx.rect(Math.round(x * g), Math.round(y * g), Math.round(ww * g), Math.round(hh * g)); ctx.clip();
    const sx = Math.floor(x * g / tw) * tw, sy = stripH ? y * g : Math.floor(y * g / th) * th;
    for (let py = sy; py < (y + hh) * g; py += th) for (let px = sx; px < (x + ww) * g; px += tw) ctx.drawImage(im, Math.round(px), Math.round(py), Math.ceil(tw), Math.ceil(th));
    ctx.restore();
  };

  // ---------- 2. per building, clipped to its facade: material, bands, plinth, pilasters, windows, damage ----------
  plan.buildings.forEach((b, bi) => {
    if (b.x1 < x0 - 2 || b.x0 > x0 + w + 2) return;
    ctx.save(); ctx.clip(facadePath(bi));
    const left = b.x0, right = b.x1 + 1, top = b.top, bottom = plan.ground;
    // material: the painted wall texture (#172) on the world grid (chunks stitch), variants per texture cell; else from code
    const tex = M('wall');
    if (tex) {
      const tw = tex.width * s, th = tex.height * s, cw = tex.width / Math.max(4, C.artPx || 32), ch = tex.height / Math.max(4, C.artPx || 32);
      for (let cy = Math.floor(top / ch) * ch; cy < bottom; cy += ch) for (let cx = Math.floor(left / cw) * cw; cx < right; cx += cw) {
        if (cx + cw < x0 - 1 || cx > x0 + w + 1 || cy + ch < y0 - 1 || cy > y0 + h + 1) continue;
        const alt = (C.art?.wallAltShare ?? 25) > hash(cx, cy, 71) * 100 ? M('wallAlt', Math.floor(hash(cx, cy, 72) * 97)) : null;
        ctx.drawImage(alt || tex, Math.round(cx * g), Math.round(cy * g), Math.round(tw), Math.round(th));
      }
      // light from above, shade towards the ground (the building stands outside), and the facade a bit back behind the play space
      const gr = ctx.createLinearGradient(0, top * g, 0, bottom * g);
      gr.addColorStop(0, 'rgba(254,243,192,0.10)'); gr.addColorStop(0.35, 'rgba(20,16,19,0)'); gr.addColorStop(1, 'rgba(20,16,19,0.3)');
      ctx.fillStyle = gr; ctx.fillRect(left * g, top * g, (right - left) * g, (bottom - top) * g);
      if (artDim) { ctx.fillStyle = `rgba(20,16,19,${artDim})`; ctx.fillRect(left * g, top * g, (right - left) * g, (bottom - top) * g); }
    }
    else if (C.material === 'brick') { for (let y = top * g; y < bottom * g; y += Math.max(2, g / 4)) { Rp(shade, left * g, y, (right - left) * g, px1); const off = (y / Math.max(2, g / 4)) % 2 ? g / 4 : 0; for (let x = left * g + off; x < right * g; x += g / 2) Rp(shade, x, y, px1, g / 4); } }
    else if (C.material === 'concrete') { for (let x = left; x < right; x += Math.max(2, C.axis / 2)) R(shade, x, top, 1 / g, bottom - top); for (let y = bottom; y > top; y -= b.floorH / 2) R(shade, left, y - 0.5, right - left, 1 / g); for (let k = 0; k < (right - left) * (bottom - top) / 6; k++) { const x = left + hash(k, bi, 1) * (right - left), y = top + hash(k, bi, 2) * (bottom - top); R(hash(k, bi, 3) < 0.5 ? shade : light, x, y, 2 / g, 1 / g); } }
    else if (C.material === 'metal') { for (let x = left * g; x < right * g; x += Math.max(3, g / 4)) { Rp(shade, x, top * g, px1, (bottom - top) * g); Rp(light, x + px1 * 2, top * g, px1, (bottom - top) * g); } }
    else if (C.material === 'stone') { for (let y = top; y < bottom; y += 1) { R(shade, left, y, right - left, 1 / g); for (let x = left + (y % 2) * 0.75; x < right; x += 1.5) R(shade, x, y, 1 / g, 1); } }
    else if (C.material === 'glass') { R(mix(glass, DARK, 0.35), left, top, right - left, bottom - top); for (let x = left; x < right; x += 1) R(frame, x, top, 2 / g, bottom - top); for (const F of b.floors) R(wall, left, F - 0.9, right - left, 0.9); }
    else { for (let k = 0; k < (right - left) * (bottom - top) / 3; k++) { const x = left + hash(k, bi, 4) * (right - left), y = top + hash(k, bi, 5) * (bottom - top); R(hash(k, bi, 6) < 0.6 ? shade : light, x, y, (1 + hash(k, bi, 7) * 3) / g, 1 / g); } }   // plaster
    for (const p of plan.parts) {
      if (p.b !== bi) continue;
      if (p.kind === 'band' && M('band')) { tileRect(M('band'), p.x, p.y - 0.3, p.w, 0.3, { stripH: 0.3, dimK: 0.4 }); R(DARK, p.x, p.y, p.w, 1 / g); }
      else if (p.kind === 'band') { R(trim, p.x, p.y - 0.28, p.w, 0.28); R(mix(trim, 0xffffff, 0.3), p.x, p.y - 0.28, p.w, 1 / g); R(DARK, p.x, p.y, p.w, 1 / g); }
      if (p.kind === 'base' && M('base')) {
        tileRect(M('base'), p.x, p.y, p.w, p.h); R(mix(baseC, 0xffffff, 0.25), p.x, p.y, p.w, 2 / g); R(DARK, p.x, p.y + 2 / g, p.w, 1 / g);
        if (p.style === 'shop') for (const ax of b.axes) { const im = M('shop', ax); if (im) nine(ctx, im, Math.round((ax - 0.5) * g), Math.round((p.y + 0.3) * g), Math.round((C.winW + 1) * g), Math.round((p.h - 0.3) * g), s); }
      }
      else if (p.kind === 'base') {
        R(baseC, p.x, p.y, p.w, p.h); R(mix(baseC, 0xffffff, 0.25), p.x, p.y, p.w, 2 / g);
        if (p.style === 'stone') for (let y = p.y; y < p.y + p.h; y += 0.5) { R(mix(baseC, DARK, 0.4), p.x, y, p.w, 1 / g); for (let x = p.x + ((y * 2) % 2) * 0.6; x < p.x + p.w; x += 1.2) { R(mix(baseC, DARK, 0.4), x, y, 1 / g, 0.5); R(mix(baseC, 0xffffff, 0.2), x + 1 / g, y + 1 / g, 1 / g, 0.5 - 2 / g); } }
        if (p.style === 'tiles') for (let y = p.y; y < p.y + p.h; y += 0.25) for (let x = p.x; x < p.x + p.w; x += 0.25) R(mix(baseC, 0xffffff, hash(x * 4 | 0, y * 4 | 0, 9) < 0.5 ? 0.12 : 0), x, y, 0.25 - 1 / g, 0.25 - 1 / g);
        if (p.style === 'shop') for (const ax of b.axes) { R(frame, ax - 0.5, p.y + 0.3, C.winW + 1, p.h - 0.3); R(mix(glass, DARK, 0.45), ax - 0.5 + 2 / g, p.y + 0.3 + 2 / g, C.winW + 1 - 4 / g, p.h - 0.3 - 4 / g); R(mix(glass, 0xffffff, 0.25), ax, p.y + 0.6, 0.2, p.h * 0.6); }
      }
      if (p.kind === 'lisene' && M('lisene')) { tileRect(tinted(M('lisene'), C.art?.liseneTint), p.x + 0.2, p.y, 0.6, p.h, { dimK: 0.1 }); R(mix(trim, 0xffffff, 0.28), p.x + 0.2, p.y, 1.5 / g, p.h); R(INK, p.x + 0.8 - 1.5 / g, p.y, 1.5 / g, p.h); }
      else if (p.kind === 'lisene') { R(trim, p.x + 0.2, p.y, 0.6, p.h); R(mix(trim, 0xffffff, 0.28), p.x + 0.2, p.y, 1.5 / g, p.h); R(mix(trim, DARK, 0.35), p.x + 0.8 - 1.5 / g, p.y, 1.5 / g, p.h); }
    }
    // windows of the facade (the rooms behind them we cannot enter): frame, glass with a streak of sky, lit, broken, boarded
    for (const wn of plan.windows) {
      if (wn.b !== bi || wn.where !== 'facade') continue;
      const { x, y, w: ww, h: hh } = wn;
      if (plan.kind === 'decks') { R(DARK, x - 0.4, y, ww + 0.8, hh); R(mix(trim, DARK, 0.2), x - 0.4, y + hh * 0.55, ww + 0.8, 2 / g); continue; }   // open deck: a dark slot with the railing
      // #172 painted window: boarded, broken, lit or dark (variants per place), 9-slice into the grid cell, a little shadow in the reveal
      const wim = wn.boarded ? M('windowBoarded', wn.x * 7 + wn.y) : wn.broken ? M('windowBroken', wn.x * 7 + wn.y) : wn.lit ? M('windowLit', wn.x * 7 + wn.y) : M('window', wn.x * 7 + wn.y);
      if (wim) { R(mix(wall, DARK, 0.55), x - 1 / g, y - 1 / g, ww + 2 / g, hh + 3 / g); nine(ctx, wim, Math.round(x * g), Math.round(y * g), Math.round(ww * g), Math.round(hh * g), s); continue; }
      R(mix(wall, DARK, 0.45), x - 2 / g, y - 2 / g, ww + 4 / g, hh + 4 / g);   // reveal
      R(frame, x, y, ww, hh);
      const ix = x + 2 / g, iy = y + 2 / g, iw = ww - 4 / g, ih = hh - 4 / g;
      if (wn.boarded) { R(DARK, ix, iy, iw, ih); for (let k = 0; k < 3; k++) R(k % 2 ? 0x8e5252 : 0xa08662, ix - 1 / g, iy + ih * (0.15 + k * 0.3), iw + 2 / g, ih * 0.2); }
      else if (wn.broken) { R(DARK, ix, iy, iw, ih); ctx.fillStyle = css(mix(glass, 0xffffff, 0.15)); ctx.beginPath(); ctx.moveTo(ix * g, iy * g); ctx.lineTo((ix + iw * 0.45) * g, iy * g); ctx.lineTo((ix + iw * 0.2) * g, (iy + ih * 0.35) * g); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo((ix + iw) * g, (iy + ih) * g); ctx.lineTo((ix + iw * 0.6) * g, (iy + ih) * g); ctx.lineTo((ix + iw) * g, (iy + ih * 0.55) * g); ctx.closePath(); ctx.fill(); }
      else if (wn.lit) { R(lit, ix, iy, iw, ih); R(mix(lit, 0xffffff, 0.4), ix, iy, iw, ih * 0.3); R(mix(lit, DARK, 0.35), ix, iy + ih - 2 / g, iw, 2 / g); }
      else { R(mix(glass, DARK, 0.25), ix, iy, iw, ih); R(mix(glass, 0xffffff, 0.2), ix, iy, iw, ih * 0.25); ctx.fillStyle = css(mix(glass, 0xffffff, 0.35)); ctx.beginPath(); ctx.moveTo((ix + iw * 0.15) * g, (iy + ih) * g); ctx.lineTo((ix + iw * 0.45) * g, (iy + ih) * g); ctx.lineTo((ix + iw * 0.85) * g, iy * g); ctx.lineTo((ix + iw * 0.6) * g, iy * g); ctx.closePath(); ctx.fill(); }
      if (ww >= 2) R(frame, x + ww / 2 - 1 / g, y, 2 / g, hh);   // mullion
      R(mix(trim, 0xffffff, 0.2), x - 3 / g, y + hh + 1 / g, ww + 6 / g, 2 / g);   // sill
    }
    // damage
    // #172 weathering from the painted decals (rust, stains, moss, peeling paint) by decay, before the bigger damage
    const decK = (C.decay ?? 1) * (C.damage ?? 100) / 100, nW = Math.round(decK * (right - left) * (bottom - top) / 90 * (C.art?.weatherShare ?? 100) / 100);
    for (let k = 0; k < nW && C.art?.weather?.length; k++) {
      const im = M('weather', k * 13 + bi); if (!im) break;
      const wx = left + hash(k, bi, 81) * (right - left - 1), wy = top + hash(k, bi, 82) * (bottom - top - 1.5), sz = 1 + hash(k, bi, 83) * 0.8;
      fitIn(ctx, im, wx * g, wy * g, sz * g, sz * g, { flip: hash(k, bi, 84) < 0.5 });
    }
    for (const p of plan.parts) {
      if (p.b !== bi) continue;
      const dk = { hole: 'hole', crack: 'crack', shots: 'shots', soot: 'soot' }[p.kind], dim0 = dk ? M(dk, (p.seed ?? 0) + bi * 31 + (p.x | 0)) : null;
      if (dim0) {
        // decals at most a little larger than painted (≈ 2 tiles), so damage stays a detail and the wall still reads
        const nat = Math.max(dim0.width, dim0.height) * s / g * 1.15, ln = Math.min(p.len || 2, nat * 1.2);
        if (p.kind === 'crack') fitIn(ctx, dim0, (p.x - 0.4) * g, p.y * g, ln * g, ln * g, { mode: 'height', flip: hash(p.seed, bi, 85) < 0.5 });
        else if (p.kind === 'soot') fitIn(ctx, dim0, p.x * g, (p.y - 0.4) * g, p.w * g, (p.h + 0.6) * g, { stretch: 1.6 });
        else fitIn(ctx, dim0, p.x * g, p.y * g, Math.min(nat, Math.max(1.2, p.w)) * g, Math.min(nat, Math.max(1.2, p.h)) * g, { stretch: 1.2, flip: hash(p.seed, bi, 86) < 0.5 });
        continue;
      }
      if (p.kind === 'hole') {   // a bite out of the facade: dark inside, rebar, a broken light edge
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2, n = 9;
        ctx.fillStyle = css(DARK); ctx.beginPath();
        for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, r = 0.55 + hash(p.seed, k, 11) * 0.45; ctx.lineTo((cx + Math.cos(a) * p.w / 2 * r) * g, (cy + Math.sin(a) * p.h / 2 * r) * g); }
        ctx.closePath(); ctx.fill(); ctx.strokeStyle = css(light); ctx.lineWidth = px1; ctx.stroke();
        ctx.strokeStyle = css(0x71413b); ctx.lineWidth = px1; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo((p.x + 0.2) * g, (cy - p.h * 0.3 + k * p.h * 0.3) * g); ctx.lineTo((p.x + p.w - 0.2) * g, (cy - p.h * 0.25 + k * p.h * 0.3 + (hash(p.seed, k, 12) - 0.5) * 0.4) * g); ctx.stroke(); }
      }
      if (p.kind === 'crack') { ctx.strokeStyle = css(deep); ctx.lineWidth = px1; ctx.beginPath(); let x = p.x + 0.5, y = p.y + 0.2; ctx.moveTo(x * g, y * g); for (let k = 0; k < p.len * 3; k++) { x += (hash(p.seed, k, 13) - 0.5) * 0.7; y += 0.33; ctx.lineTo(x * g, y * g); } ctx.stroke(); }
      if (p.kind === 'shots') for (let k = 0; k < 7; k++) { const x = p.x + hash(p.seed, k, 14) * p.w, y = p.y + hash(p.seed, k, 15) * p.h; R(DARK, x, y, 2 / g, 2 / g); R(light, x - 1 / g, y - 1 / g, 1 / g, 1 / g); }
      if (p.kind === 'soot') for (let py = 0; py < p.h * g; py++) for (let px = 0; px < p.w * g; px++) { const f = 1 - py / (p.h * g), e = 1 - Math.abs(px / (p.w * g) - 0.5) * 2; if (BAYER[(py & 3) * 4 + (px & 3)] < f * e * 0.9) Rp(DARK, p.x * g + px, p.y * g + py, 1, 1); }
      if (p.kind === 'waterline') { R(mix(wall, 0x5a4e44, 0.5), p.x, p.y, p.w, p.h); R(mix(wall, 0x23674e, 0.3), p.x, p.y + p.h, p.w, 2 / g); }
    }
    ctx.restore();
  });

  // ---------- 3. edges: dark outline against the sky, a light rim at the top and left; shadow of the shell where the rooms are cut ----------
  for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
    const k = cls(x, y); if (k !== 1 && k !== 4) continue;
    const up = cls(x, y - 1), dn = cls(x, y + 1), lf = cls(x - 1, y), rt = cls(x + 1, y), base = k === 1 ? wall : earth[1];
    if (up === 2) { R(INK, x, y, 1, px1 / g); if (k === 1) R(mix(base, 0xffffff, 0.35), x, y + px1 / g, 1, px1 / g); }
    if (lf === 2) { R(INK, x, y, px1 / g, 1); R(mix(base, 0xffffff, 0.25), x + px1 / g, y, px1 / g, 1); }
    if (rt === 2) { R(INK, x + 1 - px1 / g, y, px1 / g, 1); R(mix(base, DARK, 0.3), x + 1 - 3 * px1 / g, y, 2 * px1 / g, 1); }
    if (dn === 2) R(INK, x, y + 1 - px1 / g, 1, px1 / g);
    // the cut: where the shell (walls of the rooms) begins, the facade falls into shade (it stands behind them)
    if (k === 1) { if (y > 0 && !up && y - 1 >= 0) R(mix(base, DARK, 0.45), x, y, 1, 3 * px1 / g); if (!lf && x > 0) R(mix(base, DARK, 0.35), x, y, 3 * px1 / g, 1); if (!rt && x < W - 1) R(mix(base, DARK, 0.25), x + 1 - 2 * px1 / g, y, 2 * px1 / g, 1); }
  }

  // ---------- 4. roofs and what stands on them, the lattice, the portal ----------
  for (const p of plan.parts) {
    if (p.x > x0 + w + 4 || p.x + p.w < x0 - 4) continue;
    // #172 painted: parapet/coping strip, pediment, crown, rooftop units (variants), a fallen wreck, the bunker lintel
    if (p.kind === 'roof' && p.roof === 'fascia') { drawFascia(ctx, p, g, { trim, px1, R, decay: (C.decay ?? 1) * (C.damage ?? 100) / 100 }); continue; }
    if (p.kind === 'pylon') { const im = M('pylon'); if (im) { const r = fitIn(ctx, im, p.x * g, p.y * g, p.w * g, p.h * g, { mode: 'height', stretch: 1 }); pylonLogos(ctx, r, g, (C.decay ?? 1) * (C.damage ?? 100) / 100); } continue; }
    if (p.kind === 'roof' && M('roof')) { tileRect(tinted(M('roof'), C.art?.roofTint), p.x, p.y, p.w, p.h, { stripH: p.h }); R(INK, p.x, p.y, 1 / g, p.h); R(INK, p.x + p.w - 1 / g, p.y, 1 / g, p.h); R(INK, p.x, p.y + p.h - 1 / g, p.w, 1 / g); continue; }
    if (p.kind === 'gable' && M('gable')) { R(roofC, p.x - 0.3, p.y + p.h - 0.2, p.w + 0.6, 0.3); ctx.drawImage(M('gable'), Math.round(p.x * g), Math.round(p.y * g), Math.round(p.w * g), Math.round(p.h * g)); continue; }
    if (p.kind === 'crown' && M('crown')) { const t = p.tall || p.h; fitIn(ctx, M('crown'), p.x * g, (p.y + p.h - t) * g, p.w * g, t * g, { stretch: 1.2 }); continue; }
    if (p.kind === 'unit' && p.fallen) { const im = M('fallen', p.x | 0); if (im) fitIn(ctx, im, (p.x - 0.2) * g, (p.y - 0.4) * g, (p.w + 0.4) * g, (p.h + 0.4) * g, { flip: hash(p.x | 0, 1, 87) < 0.5 }); continue; }
    if (p.kind === 'unit' && M(p.unit, p.x * 3 | 0)) {
      const im = M(p.unit, p.x * 3 | 0), cx = (p.x + p.w / 2) * g, by = (p.y + p.h) * g;
      ctx.save(); if (p.tilt) { ctx.translate(cx, by); ctx.rotate(p.tilt * Math.PI / 180); ctx.translate(-cx, -by); }
      fitIn(ctx, im, p.x * g, p.y * g, p.w * g, p.h * g, { mode: 'height', flip: hash(p.x | 0, 2, 88) < 0.5 && p.unit !== 'frame' });
      ctx.restore(); continue;
    }
    if (p.kind === 'portal' && M('portal')) { const im = M('portal'), ww = (p.w + 1.6) * g, hh = ww * im.height / im.width; ctx.drawImage(dimmed(im, dim / 200), Math.round((p.x - 0.8) * g), Math.round((p.y + 1.3) * g - hh), Math.round(ww), Math.round(hh)); continue; }
    if (p.kind === 'roof') {
      const c = p.roof === 'flat' ? roofC : trim;
      R(c, p.x, p.y, p.w, p.h); R(mix(c, 0xffffff, 0.35), p.x, p.y, p.w, 2 / g); R(INK, p.x, p.y, p.w, 1 / g); R(INK, p.x, p.y, 1 / g, p.h); R(INK, p.x + p.w - 1 / g, p.y, 1 / g, p.h);
      if (p.roof === 'parapet' || p.roof === 'crown') { R(mix(c, DARK, 0.35), p.x, p.y + p.h - 2 / g, p.w, 2 / g); for (let x = p.x + 0.5; x < p.x + p.w - 0.5; x += 2) R(mix(c, DARK, 0.2), x, p.y + 3 / g, 1 / g, p.h - 5 / g); }
    }
    if (p.kind === 'gable') {   // pediment: triangle, cornice, a round window without glass
      const cx = p.x + p.w / 2;
      ctx.fillStyle = css(trim); ctx.beginPath(); ctx.moveTo(p.x * g, (p.y + p.h) * g); ctx.lineTo(cx * g, p.y * g); ctx.lineTo((p.x + p.w) * g, (p.y + p.h) * g); ctx.closePath(); ctx.fill();
      ctx.fillStyle = css(wall); ctx.beginPath(); ctx.moveTo((p.x + 0.8) * g, (p.y + p.h - 0.25) * g); ctx.lineTo(cx * g, (p.y + 0.55) * g); ctx.lineTo((p.x + p.w - 0.8) * g, (p.y + p.h - 0.25) * g); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = css(INK); ctx.lineWidth = px1; ctx.beginPath(); ctx.moveTo(p.x * g, (p.y + p.h) * g); ctx.lineTo(cx * g, p.y * g); ctx.lineTo((p.x + p.w) * g, (p.y + p.h) * g); ctx.stroke();
      ctx.strokeStyle = css(mix(trim, 0xffffff, 0.35)); ctx.beginPath(); ctx.moveTo(p.x * g + px1, (p.y + p.h) * g - px1 * 2); ctx.lineTo(cx * g, p.y * g + px1 * 2); ctx.stroke();
      if (p.h > 2.5) { ctx.fillStyle = css(DARK); ctx.beginPath(); ctx.arc(cx * g, (p.y + p.h * 0.62) * g, g * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = css(trim); ctx.lineWidth = px1 * 2; ctx.stroke(); }
      R(roofC, p.x - 0.3, p.y + p.h - 0.2, p.w + 0.6, 0.3);
    }
    if (p.kind === 'crown') { R(trim, p.x, p.y, p.w, p.h); R(mix(trim, 0xffffff, 0.3), p.x, p.y, p.w, 1 / g); R(frame, p.x + 0.5, p.y - 1.2, p.w - 1, 1.2); for (let x = p.x + 1; x < p.x + p.w - 1; x += 1.5) R(lit, x, p.y + 0.4, 0.5, 0.4); R(INK, p.x, p.y, 1 / g, p.h); R(INK, p.x + p.w - 1 / g, p.y, 1 / g, p.h); }
    if (p.kind === 'dome') {   // glass dome with ribs over the Wow room
      const cx = (p.x + p.w / 2) * g, by = (p.y + p.h) * g, rx = p.w / 2 * g, ry = p.h * g;
      ctx.fillStyle = css(mix(glass, DARK, 0.3)); ctx.beginPath(); ctx.ellipse(cx, by, rx, ry, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = css(mix(glass, 0xffffff, 0.3)); ctx.beginPath(); ctx.ellipse(cx - rx * 0.35, by - ry * 0.55, rx * 0.18, ry * 0.25, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = css(frame); ctx.lineWidth = px1 * 2; for (let k = 1; k < 8; k++) { const a = Math.PI + k / 8 * Math.PI; ctx.beginPath(); ctx.moveTo(cx, by - ry); ctx.lineTo(cx + Math.cos(a) * rx, by + Math.sin(a) * ry * 0.02); ctx.stroke(); }
      for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.ellipse(cx, by, rx * (1 - k * 0.0), ry * (1 - k * 0.33), 0, Math.PI, 0); ctx.stroke(); }
      ctx.strokeStyle = css(INK); ctx.lineWidth = px1; ctx.beginPath(); ctx.ellipse(cx, by, rx, ry, 0, Math.PI, 0); ctx.stroke();
    }
    if (p.kind === 'shed') { ctx.fillStyle = css(roofC); ctx.beginPath(); ctx.moveTo(p.x * g, (p.y + p.h) * g); ctx.lineTo((p.x + p.w * 0.8) * g, p.y * g); ctx.lineTo((p.x + p.w * 0.8) * g, (p.y + p.h) * g); ctx.closePath(); ctx.fill(); R(mix(glass, 0xffffff, 0.15), p.x + p.w * 0.8, p.y, 0.4, p.h); R(INK, p.x + p.w * 0.8 + 0.4, p.y, 1 / g, p.h); ctx.strokeStyle = css(INK); ctx.lineWidth = px1; ctx.beginPath(); ctx.moveTo(p.x * g, (p.y + p.h) * g); ctx.lineTo((p.x + p.w * 0.8) * g, p.y * g); ctx.stroke(); }
    if (p.kind === 'stub') { R(mix(wall, DARK, 0.15), p.x, p.y, p.w, p.h); R(INK, p.x, p.y, 1 / g, p.h); ctx.strokeStyle = css(0x71413b); ctx.lineWidth = px1; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo((p.x + 0.1 + k * 0.15) * g, p.y * g); ctx.lineTo((p.x + 0.1 + k * 0.15 + (hash(p.x | 0, k, 26) - 0.5) * 0.5) * g, (p.y - 0.6 - hash(p.x | 0, k, 27) * 0.6) * g); ctx.stroke(); } }
    if (p.kind === 'unit') drawUnit(ctx, p, g, { trim, roofC, frame, wall, lit, px1, R, mix });
    if (p.kind === 'portal') { R(back(wall), p.x - 0.5, p.y, p.w + 1, 1.2); R(mix(back(wall), 0xffffff, 0.3), p.x - 0.5, p.y, p.w + 1, 2 / g); R(INK, p.x - 0.5, p.y + 1.2, p.w + 1, 1 / g); for (let k = 0; k < 6; k++) R(k % 2 ? 0xffd541 : DARK, p.x - 0.5 + k * (p.w + 1) / 6, p.y + 0.4, (p.w + 1) / 6, 0.35); }
    if (p.kind === 'lattice') drawLattice(ctx, p, g, { trim: snap(C.trim), white: snap(C.wall), px1, back });
  }
  // ---------- 5. behind the play space (dimmed): awnings, canopies, the station roof, fire escapes, plant, street structures ----------
  // #178 first the parking apron and the far yard (trucks, billboards, lamps behind the station roof), at the end the near yard
  const near = p => !(p.x > x0 + w + 12 || p.x + p.w < x0 - 12);
  for (const p of plan.parts) if (p.kind === 'apron' && near(p)) drawApron(ctx, p, g, { back, R, px1 });
  for (const p of plan.parts) if (p.kind === 'yard' && p.far && near(p)) drawYard(ctx, p, g, M, dim / 100 * 1.15);
  for (const p of plan.parts) {
    if (p.x > x0 + w + 12 || p.x + p.w < x0 - 12) continue;
    if (p.kind === 'apron' || p.kind === 'yard') continue;
    // #172 painted and darkened like everything behind the play space
    const dk = dim / 100;
    if (p.kind === 'pump') { const im = M('pump', p.seed); if (im) fitIn(ctx, dimmed(im, dk * 0.9), p.x * g, p.y * g, p.w * g, p.h * g, { mode: 'height', stretch: 1, flip: p.seed % 2 === 1 }); continue; }
    if (p.kind === 'entry') {   // #178 the entrance canopy over the sliding doors: the wall end of the picture (right) at the building
      const im = M('entry'); if (!im) continue;
      const r = fitIn(ctx, dimmed(im, dk * 0.7), p.x * g, p.y * g, p.w * g, p.h * g, { mode: 'height', stretch: 1, flip: p.side > 0 });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createLinearGradient(0, r.y + r.h * 0.2, 0, r.y + r.h); gr.addColorStop(0, 'rgba(255,236,190,0.16)'); gr.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = gr; ctx.fillRect(r.x + r.w * 0.05, r.y + r.h * 0.2, r.w * 0.9, r.h * 0.8); ctx.restore();
      continue;
    }
    if (p.kind === 'awning' && M('awning')) { const im = dimmed(M('awning'), dk), hh = p.w * im.height / im.width; ctx.drawImage(im, Math.round(p.x * g), Math.round(p.y * g), Math.round(p.w * g), Math.round(hh * g)); continue; }
    if (p.kind === 'station' && M('station')) {   // the canopy in sections, each with its post down to the ground
      const im = dimmed(M('station'), dk), H0 = plan.ground - p.y, segW = H0 * im.width / im.height, n = Math.max(1, Math.round(p.w / segW)), sw = p.w / n;
      for (let k = 0; k < n; k++) ctx.drawImage(im, Math.round((p.x + k * sw) * g), Math.round(p.y * g), Math.round(sw * g) + 1, Math.round(H0 * g));
      // #178 the light strips under the canopy fall on the forecourt (a soft warm cone, drawn additive)
      if (p.walk || C.stationAll) {
        const ly = (p.y + H0 * 0.3) * g, lh = (plan.ground - p.y - H0 * 0.3) * g;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createLinearGradient(0, ly, 0, ly + lh); gr.addColorStop(0, 'rgba(230,240,255,0.2)'); gr.addColorStop(0.6, 'rgba(255,230,190,0.07)'); gr.addColorStop(1, 'rgba(255,230,190,0)');
        ctx.fillStyle = gr; ctx.fillRect(Math.round(p.x * g), Math.round(ly), Math.round(p.w * g), Math.round(lh)); ctx.restore();
      }
      continue;
    }
    if (p.kind === 'fire' && M('fire')) {   // one flight per storey, alternating
      const im = dimmed(M('fire'), dk), step = Math.max(3, p.step || 5), fw = Math.min(p.w * 1.5, step * im.width / im.height);
      for (let y = p.y + p.h, k = 0; y - step >= p.y - 0.01; y -= step, k++) {
        const fx = p.x + (p.w - fw) / 2;
        if (k % 2) { ctx.save(); ctx.translate(Math.round((fx + fw) * g), 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, Math.round((y - step) * g), Math.round(fw * g), Math.round(step * g)); ctx.restore(); }
        else ctx.drawImage(im, Math.round(fx * g), Math.round((y - step) * g), Math.round(fw * g), Math.round(step * g));
      }
      continue;
    }
    if (p.kind === 'plant' && M('plant_' + p.what, p.seed)) { fitIn(ctx, dimmed(M('plant_' + p.what, p.seed), dk), p.x * g, p.y * g, p.w * g, p.h * g, { stretch: 1.6, flip: hash(p.seed, 3, 89) < 0.5 }); continue; }
    if (p.kind === 'surface' && drawSurfaceArt(ctx, p, g, M, dk)) continue;
    if (p.kind === 'awning') {   // striped awning, torn by decay
      const n = Math.max(3, Math.round(p.w * 2));
      for (let k = 0; k < n; k++) { if (p.torn && k % 3 === 2) continue; R(back(k % 2 ? 0xdae0ea : trim), p.x + k * p.w / n, p.y, p.w / n, p.h - (p.torn && k % 4 === 1 ? 0.4 : 0)); }
      R(back(INK), p.x, p.y, p.w, 1 / g); for (let k = 0; k < n; k++) R(back(k % 2 ? 0xdae0ea : trim), p.x + k * p.w / n + p.w / n * 0.2, p.y + p.h, p.w / n * 0.6, 0.25);
    }
    if (p.kind === 'canopy') { R(back(trim), p.x, p.y, p.w, p.h); R(back(mix(trim, 0xffffff, 0.3)), p.x, p.y, p.w, 1 / g); R(back(INK), p.x, p.y + p.h, p.w, 1 / g); const sx = p.side < 0 ? p.x + 0.3 : p.x + p.w - 0.5; ctx.strokeStyle = css(back(frame)); ctx.lineWidth = px1; ctx.beginPath(); ctx.moveTo(sx * g, (p.y + p.h) * g); ctx.lineTo((p.side < 0 ? p.x + p.w : p.x) * g, (p.y - 1.2) * g); ctx.stroke(); }
    if (p.kind === 'station') {   // the gas station's canopy over the forecourt: fascia in the trim colour (no lettering), posts, lights underneath
      R(back(trim), p.x, p.y, p.w, p.h); R(back(mix(trim, 0xffffff, 0.35)), p.x, p.y, p.w, 2 / g); R(back(0xdae0ea), p.x, p.y + p.h * 0.55, p.w, p.h * 0.2); R(back(INK), p.x, p.y + p.h, p.w, 1 / g);
      for (let k = 0; k < p.posts; k++) { const x = p.x + (k + 0.5) * p.w / p.posts; R(back(0x8b93af), x - 0.25, p.y + p.h, 0.5, plan.ground - p.y - p.h); R(back(mix(0x8b93af, 0xffffff, 0.3)), x - 0.25, p.y + p.h, 1 / g, plan.ground - p.y - p.h); }
      for (let x = p.x + 1; x < p.x + p.w - 1; x += 2.5) R(back(0xfef3c0), x, p.y + p.h, 1, 2 / g);
    }
    if (p.kind === 'fire') drawFireEscape(ctx, p, g, { c: back(0x333941), rail: back(0x4a5462), px1 });
    if (p.kind === 'plant') drawPlant(ctx, p, g, { back, trim, wall, px1, R });
    if (p.kind === 'surface') drawSurface(ctx, p, g, { back, trim, wall, glass, px1, R, C });
    if (p.kind === 'street') { R(back(0x333941), p.x, p.y + 1 - 0.15, p.w, 0.15); }
  }
  for (const p of plan.parts) if (p.kind === 'yard' && !p.far && near(p)) drawYard(ctx, p, g, M, dim / 100 * 0.8);
  ctx.restore();
}

// #178 the fascia of the mega-store (Mile 7): coping, a red band with a white and an orange stripe, every ~24 tiles a white roundel with
// the orange delta of Delta Petrol (shapes from code, no lettering), panels missing by decay with the steel showing
function drawFascia(ctx, p, g, { trim, px1, R, decay }) {
  const red = trim, hiRed = mix(trim, 0xffffff, 0.22), loRed = mix(trim, DARK, 0.35);
  R(0xb3b9d1, p.x, p.y, p.w, 0.2); R(0xdae0ea, p.x, p.y, p.w, 1 / g); R(0x6d758d, p.x, p.y + 0.2 - 1 / g, p.w, 1 / g);
  R(red, p.x, p.y + 0.2, p.w, p.h - 0.45); R(hiRed, p.x, p.y + 0.2, p.w, 2 / g);
  R(0xdae0ea, p.x, p.y + p.h * 0.52, p.w, p.h * 0.1); R(0xfa6a0a, p.x, p.y + p.h * 0.62, p.w, p.h * 0.05);
  R(loRed, p.x, p.y + p.h - 0.35, p.w, 0.1); R(0x333941, p.x, p.y + p.h - 0.25, p.w, 0.25); R(INK, p.x, p.y + p.h - 1 / g, p.w, 1 / g);
  for (let x = p.x + 2; x < p.x + p.w - 1; x += 2) R(loRed, x, p.y + 0.22, 1 / g, p.h * 0.28);   // panel joints
  // weathering: rust runs from the joints, by decay
  for (let k = 0; k < p.w * decay * 0.4; k++) { const x = p.x + hash(k, p.x | 0, 91) * p.w, hh = 0.2 + hash(k, 2, 92) * 0.5; R(0x71413b, x, p.y + 0.25, 2 / g, hh); }
  // logos: a white roundel with the orange delta
  const n = Math.max(1, Math.round(p.w / 24));
  for (let k = 0; k < n; k++) {
    const cx = p.x + (k + 0.5) * p.w / n, cy = p.y + p.h * 0.45, r = p.h * 0.42;
    ctx.fillStyle = css(INK); ctx.beginPath(); ctx.arc(cx * g, cy * g, r * g + px1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = css(0xfef3c0); ctx.beginPath(); ctx.arc(cx * g, cy * g, r * g, 0, Math.PI * 2); ctx.fill();
    deltaLogo(ctx, cx * g, cy * g, r * g * 0.72, px1);
  }
  // missing panels: the steel frame behind
  for (let k = 0; k < Math.floor(decay * p.w / 70); k++) {
    const x = p.x + 1 + hash(k, p.x | 0, 93) * (p.w - 4), ww = 0.8 + hash(k, 3, 94) * 0.9;
    if (Array.from({ length: n }, (_, i) => p.x + (i + 0.5) * p.w / n).some(cx => Math.abs(cx - x - ww / 2) < p.h)) continue;   // keep the logos
    R(0x5b3138, x, p.y + 0.2, ww, p.h * 0.5); R(0x3b1725, x, p.y + 0.2 + p.h * 0.5, ww, p.h * 0.5 - 0.45); for (let xx = x + 0.25; xx < x + ww; xx += 0.5) R(0x4a5462, xx, p.y + 0.2, 1 / g, p.h - 0.45);
  }
}
// the orange delta (Delta Petrol), a triangle with a lighter inner triangle, centred on (cx, cy), r = half its height, in pixels
function deltaLogo(ctx, cx, cy, r, px1) {
  const tri = (k, c) => { ctx.fillStyle = css(c); ctx.beginPath(); ctx.moveTo(cx, cy - r * k); ctx.lineTo(cx + r * 1.1 * k, cy + r * 0.85 * k); ctx.lineTo(cx - r * 1.1 * k, cy + r * 0.85 * k); ctx.closePath(); ctx.fill(); };
  tri(1.12, INK); tri(1, 0xfa6a0a); tri(0.45, 0xfef3c0);
  ctx.fillStyle = css(0xb4202a); ctx.fillRect(Math.round(cx - r * 1.1), Math.round(cy + r * 0.85 - px1 * 2), Math.round(r * 2.2), px1 * 2);
}
// the logos on the pylon's blank light boxes: the delta in the upper box, orange and yellow stripes below; a dead lower box by decay
function pylonLogos(ctx, r, g, decay) {
  const box = (fy, fh) => ({ x: r.x + r.w * 0.13, y: r.y + r.h * fy, w: r.w * 0.7, h: r.h * fh });
  const a = box(0.03, 0.12), b = box(0.215, 0.115);
  ctx.save();
  ctx.fillStyle = 'rgba(254,243,192,0.55)'; ctx.fillRect(a.x, a.y, a.w, a.h);
  deltaLogo(ctx, a.x + a.w / 2, a.y + a.h * 0.52, a.h * 0.36, Math.max(1, Math.round(g / 16)));
  if (decay < 2.5) { ctx.fillStyle = css(0xfa6a0a); ctx.fillRect(b.x, b.y + b.h * 0.25, b.w, b.h * 0.2); ctx.fillStyle = css(0xf9a31b); ctx.fillRect(b.x, b.y + b.h * 0.55, b.w, b.h * 0.12); }
  else { ctx.fillStyle = 'rgba(20,16,19,0.55)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = css(0xfa6a0a); ctx.fillRect(b.x, b.y + b.h * 0.3, b.w * 0.45, b.h * 0.18); }
  ctx.restore();
}
// the parking apron behind the play floor: asphalt, a kerb, slanted bay lines (the far edge of the lot), dust over it
function drawApron(ctx, p, g, { back, R, px1 }) {
  R(back(0x322b28), p.x, p.y, p.w, p.h); R(back(0x5a4e44), p.x, p.y, p.w, 2 / g); R(back(0x8b93af), p.x, p.y + 2 / g, p.w, 1 / g);
  ctx.fillStyle = css(back(0xc7b08b));
  for (let x = p.x + 1; x < p.x + p.w - 0.5; x += 3) { ctx.beginPath(); ctx.moveTo(x * g, (p.y + 0.15) * g); ctx.lineTo((x + 0.12) * g, (p.y + 0.15) * g); ctx.lineTo((x + 0.55) * g, (p.y + p.h) * g); ctx.lineTo((x + 0.4) * g, (p.y + p.h) * g); ctx.closePath(); ctx.fill(); }
  for (let k = 0; k < p.w * 1.5; k++) { const x = p.x + hash(k, p.x | 0, 95) * p.w; R(back(0xa08662), x, p.y + p.h * (0.3 + hash(k, 1, 96) * 0.6), 0.3 + hash(k, 2, 97) * 0.8, px1 / g); }
}
// one thing of the yard (truck, car wreck, lamp, cart, dumpster, billboard, wheel stop), painted and darkened
function drawYard(ctx, p, g, M, dk) {
  const im = M('yard_' + p.what, p.seed); if (!im) return;
  fitIn(ctx, dimmed(im, Math.min(0.85, dk)), p.x * g, p.y * g, p.w * g, p.h * g, { mode: 'height', stretch: 1, flip: !!p.flip && p.what !== 'billboard' });
}

function drawUnit(ctx, p, g, { trim, roofC, frame, wall, lit, px1, R, mix: m }) {
  if (p.fallen) return;   // a wreck only as a painted module (#172)
  ctx.save();
  const cx = (p.x + p.w / 2) * g, by = (p.y + p.h) * g;
  if (p.tilt) { ctx.translate(cx, by); ctx.rotate(p.tilt * Math.PI / 180); ctx.translate(-cx, -by); }
  const metal = 0x8b93af, dk = 0x333941, hi = 0xdae0ea;
  if (p.unit === 'ac') { R(metal, p.x, p.y, p.w, p.h); R(hi, p.x, p.y, p.w, 1 / g); for (let x = p.x + 0.2; x < p.x + p.w * 0.55; x += 0.25) R(dk, x, p.y + 0.25, 1 / g, p.h - 0.45); ctx.strokeStyle = css(dk); ctx.lineWidth = px1; ctx.beginPath(); ctx.arc((p.x + p.w * 0.77) * g, (p.y + p.h / 2) * g, p.h * 0.33 * g, 0, Math.PI * 2); ctx.stroke(); R(0x060608, p.x, p.y + p.h - 1 / g, p.w, 1 / g); }
  if (p.unit === 'tank') { R(dk, p.x + 0.2, p.y + p.h * 0.55, 1 / g * 2, p.h * 0.45); R(dk, p.x + p.w - 0.3, p.y + p.h * 0.55, 2 / g, p.h * 0.45); R(0x71413b, p.x, p.y, p.w, p.h * 0.58); R(0xbb7547, p.x, p.y, 2 / g, p.h * 0.58); for (let y = p.y + 0.3; y < p.y + p.h * 0.55; y += 0.5) R(0x5b3138, p.x, y, p.w, 1 / g); ctx.fillStyle = css(0x5b3138); ctx.beginPath(); ctx.moveTo(p.x * g, p.y * g); ctx.lineTo(cx, (p.y - 0.5) * g); ctx.lineTo((p.x + p.w) * g, p.y * g); ctx.fill(); }
  if (p.unit === 'antenna') { R(dk, p.x, p.y, p.w, p.h); for (let y = p.y + 0.6; y < p.y + p.h - 0.5; y += 1.1) R(dk, p.x - 0.5, y, p.w + 1, 1 / g); R(0xb4202a, p.x - 1 / g, p.y - 2 / g, p.w + 2 / g, 4 / g); }
  if (p.unit === 'dish') { R(dk, p.x + p.w / 2 - 1 / g, p.y + p.h * 0.5, 2 / g, p.h * 0.5); ctx.fillStyle = css(hi); ctx.beginPath(); ctx.ellipse(cx, (p.y + p.h * 0.45) * g, p.w * 0.45 * g, p.h * 0.4 * g, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = css(dk); ctx.lineWidth = px1; ctx.stroke(); }
  if (p.unit === 'solar') for (let k = 0; k < 3; k++) { ctx.fillStyle = css(0x143464); const x = (p.x + k * p.w / 3) * g; ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + p.w / 3 * g * 0.9, by - p.h * g * 0.4); ctx.lineTo(x + p.w / 3 * g * 0.9, by - p.h * g); ctx.lineTo(x, by - p.h * g * 0.5); ctx.fill(); ctx.strokeStyle = css(0x285cc4); ctx.lineWidth = px1; ctx.stroke(); }
  if (p.unit === 'chimney') { R(0x8e5252, p.x, p.y, p.w, p.h); for (let y = p.y + 0.25; y < p.y + p.h; y += 0.25) R(0x5b3138, p.x, y, p.w, 1 / g); R(dk, p.x - 0.1, p.y, p.w + 0.2, 0.3); }
  if (p.unit === 'vent') { R(metal, p.x + p.w * 0.3, p.y + p.h * 0.4, p.w * 0.4, p.h * 0.6); ctx.fillStyle = css(hi); ctx.beginPath(); ctx.ellipse(cx, (p.y + p.h * 0.4) * g, p.w * 0.5 * g, p.h * 0.3 * g, 0, Math.PI, 0); ctx.fill(); R(dk, p.x, p.y + p.h * 0.4, p.w, 1 / g); }
  if (p.unit === 'frame') {   // an empty billboard frame (no lettering, Projekt-Regel): lattice legs and a blank, weathered panel
    R(dk, p.x + p.w * 0.2, p.y + p.h * 0.55, 2 / g, p.h * 0.45); R(dk, p.x + p.w * 0.8, p.y + p.h * 0.55, 2 / g, p.h * 0.45);
    R(dk, p.x, p.y, p.w, p.h * 0.58); R(m(trim, 0xdae0ea, 0.5), p.x + 2 / g, p.y + 2 / g, p.w - 4 / g, p.h * 0.58 - 4 / g);
    for (let k = 0; k < 4; k++) R(m(trim, 0xdae0ea, 0.2 + k * 0.1), p.x + 2 / g + k * (p.w - 4 / g) / 4, p.y + 2 / g, (p.w - 4 / g) / 8, p.h * 0.58 - 4 / g);   // torn strips
    for (let k = 0; k < 3; k++) R(lit, p.x + 0.3 + k * (p.w - 0.6) / 2, p.y - 0.2, 0.3, 0.2);
  }
  if (p.unit === 'stairs') { R(m(wall, 0x141013, 0.2), p.x, p.y, p.w, p.h); R(0x141013, p.x + p.w * 0.35, p.y + p.h * 0.3, p.w * 0.3, p.h * 0.7); R(0x060608, p.x, p.y, p.w, 1 / g); }
  ctx.restore();
}
function drawFireEscape(ctx, p, g, { c, rail, px1 }) {
  const step = Math.max(3, p.step || 5);
  ctx.strokeStyle = css(c); ctx.lineWidth = px1;
  for (let y = p.y + p.h, k = 0; y > p.y; y -= step, k++) {
    ctx.fillStyle = css(c); ctx.fillRect(p.x * g, y * g, p.w * g, Math.max(1, px1 * 2));   // landing
    ctx.strokeStyle = css(rail); ctx.beginPath(); ctx.moveTo(p.x * g, (y - 1) * g); ctx.lineTo((p.x + p.w) * g, (y - 1) * g); ctx.stroke();
    for (let x = p.x; x <= p.x + p.w; x += 0.5) { ctx.beginPath(); ctx.moveTo(x * g, (y - 1) * g); ctx.lineTo(x * g, y * g); ctx.stroke(); }
    if (y - step < p.y) break;
    ctx.strokeStyle = css(c); ctx.lineWidth = px1 * 2; ctx.beginPath(); const a = k % 2 ? p.x : p.x + p.w, b = k % 2 ? p.x + p.w : p.x; ctx.moveTo(a * g, y * g); ctx.lineTo(b * g, (y - step) * g); ctx.stroke(); ctx.lineWidth = px1;
  }
}
function drawLattice(ctx, p, g, { trim, white, px1, back }) {
  const lx = p.x + p.w * 0.12, rx = p.x + p.w * 0.88, top = p.y, bot = p.y + p.h, n = Math.max(2, Math.round(p.h / p.step)), cx = (lx + rx) / 2;
  const leg = (f, side) => side < 0 ? lx + (cx - 0.8 - lx) * f : rx - (rx - cx - 0.8) * f;   // legs lean in towards the top
  ctx.lineWidth = Math.max(1, px1 * 2);
  for (let k = 0; k < n; k++) {
    const f0 = 1 - k / n, f1 = 1 - (k + 1) / n, y0 = top + (1 - f0) * p.h, y1 = top + (1 - f1) * p.h, c = back(k % 2 ? trim : white);
    ctx.strokeStyle = css(c); ctx.beginPath();
    ctx.moveTo(leg(1 - f0, -1) * g, y0 * g); ctx.lineTo(leg(1 - f1, -1) * g, y1 * g); ctx.moveTo(leg(1 - f0, 1) * g, y0 * g); ctx.lineTo(leg(1 - f1, 1) * g, y1 * g);
    ctx.moveTo(leg(1 - f0, -1) * g, y0 * g); ctx.lineTo(leg(1 - f1, 1) * g, y1 * g); ctx.moveTo(leg(1 - f0, 1) * g, y0 * g); ctx.lineTo(leg(1 - f1, -1) * g, y1 * g);
    ctx.moveTo(leg(1 - f1, -1) * g, y1 * g); ctx.lineTo(leg(1 - f1, 1) * g, y1 * g); ctx.stroke();
  }
  ctx.strokeStyle = css(back(0x4a5462)); ctx.lineWidth = px1; ctx.beginPath();
  for (const s of [-1, 1]) for (const f of [0.3, 0.6]) { ctx.moveTo(leg(f, s) * g, (top + f * p.h * 0.9) * g); ctx.lineTo((s < 0 ? p.x - 4 : p.x + p.w + 4) * g, bot * g); }   // guy wires
  ctx.stroke();
}
function drawPlant(ctx, p, g, { back, trim, wall, px1, R }) {
  const c = back(p.broken ? 0x5a4e44 : 0x8b93af), d = back(0x333941), r = back(0x71413b), hi = back(0xdae0ea), bx = p.x, by = p.y + p.h;
  if (p.what === 'tank') { R(c, bx, p.y + 0.8, p.w, p.h - 0.8); ctx.fillStyle = css(c); ctx.beginPath(); ctx.ellipse((bx + p.w / 2) * g, (p.y + 0.8) * g, p.w / 2 * g, 0.8 * g, 0, Math.PI, 0); ctx.fill(); R(hi, bx + 0.3, p.y + 0.8, 2 / g, p.h - 0.8); for (let y = p.y + 1.5; y < by; y += 1.2) R(d, bx, y, p.w, 1 / g); R(back(trim), bx, by - p.h * 0.45, p.w, 0.35); for (let y = p.y + 0.8; y < by; y += 0.5) R(d, bx + p.w - 0.6, y, 0.4, 1 / g); if (p.broken) R(back(0x141013), bx + p.w * 0.3, p.y + 1.6, 1.2, 0.8); }
  if (p.what === 'column') { R(c, bx + 0.3, p.y, p.w - 0.6, p.h); for (let y = p.y + 1; y < by; y += 2) R(d, bx, y, p.w, 0.25); R(hi, bx + 0.4, p.y, 2 / g, p.h); R(d, bx + p.w / 2 - 0.05, p.y - 1.5, 0.1, 1.5); }
  if (p.what === 'pipes') { for (let k = 0; k < 3; k++) R(k % 2 ? r : c, bx, p.y + k * 0.6, p.w, 0.45); for (let x = bx + 0.5; x < bx + p.w; x += 3) { R(d, x, p.y + 1.8, 0.3, p.h - 1.8); ctx.strokeStyle = css(d); ctx.lineWidth = px1; ctx.beginPath(); ctx.moveTo(x * g, (p.y + 1.8) * g); ctx.lineTo((x + 1.5) * g, by * g); ctx.stroke(); } }
  if (p.what === 'stack') { R(c, bx, p.y, p.w, p.h); for (let y = p.y; y < p.y + 3; y += 1) R(y % 2 ? back(0xb4202a) : hi, bx, y, p.w, 0.5); R(d, bx - 0.1, p.y, p.w + 0.2, 0.2); }
  if (p.what === 'trailer') { R(back(0xdae0ea), bx, p.y + 0.4, p.w, p.h - 1); R(back(trim), bx, p.y + 1.3, p.w, 0.25); for (let x = bx + 0.6; x < bx + p.w - 1; x += 1.8) R(back(0x285cc4), x, p.y + 0.8, 0.9, 0.4); ctx.fillStyle = css(d); ctx.beginPath(); ctx.arc((bx + p.w * 0.3) * g, (by - 0.4) * g, 0.4 * g, 0, Math.PI * 2); ctx.fill(); R(d, bx - 1, by - 0.8, 1, 1 / g); }
  if (p.what === 'watertower') { R(d, bx + 0.6, p.y + 4, 0.2, p.h - 4); R(d, bx + p.w - 0.8, p.y + 4, 0.2, p.h - 4); R(c, bx, p.y + 1, p.w, 3); ctx.fillStyle = css(c); ctx.beginPath(); ctx.moveTo(bx * g, (p.y + 1) * g); ctx.lineTo((bx + p.w / 2) * g, p.y * g); ctx.lineTo((bx + p.w) * g, (p.y + 1) * g); ctx.fill(); }
  if (p.what === 'pylon') { ctx.strokeStyle = css(d); ctx.lineWidth = px1; ctx.beginPath(); ctx.moveTo(bx * g, by * g); ctx.lineTo((bx + p.w / 2) * g, p.y * g); ctx.lineTo((bx + p.w) * g, by * g); for (let y = p.y + 2; y < by; y += 2) { const f = (y - p.y) / p.h; ctx.moveTo((bx + p.w / 2 - f * p.w / 2) * g, y * g); ctx.lineTo((bx + p.w / 2 + f * p.w / 2) * g, y * g); } ctx.moveTo((bx - 0.5) * g, (p.y + 2) * g); ctx.lineTo((bx + p.w + 0.5) * g, (p.y + 2) * g); ctx.stroke(); }
}
// #172 the street structures of the underground POIs from painted modules; false = nothing painted for it, the code draws it
function drawSurfaceArt(ctx, p, g, M, dk) {
  const im = k => { const i = M('surface_' + k, p.seed || 0); return i ? dimmed(i, dk) : null; }, bx = p.x, by = p.y + p.h;
  const row = (i, hh, y = by - hh) => { const tw = hh * i.width / i.height; for (let x = bx; x < bx + p.w - 0.01; x += tw) { const ww = Math.min(tw, bx + p.w - x); ctx.drawImage(i, 0, 0, i.width * ww / tw, i.height, Math.round(x * g), Math.round(y * g), Math.round(ww * g), Math.round(hh * g)); } };
  const fit = (i, x, w, h, o) => fitIn(ctx, i, x * g, (by - h) * g, w * g, h * g, o);
  const w = p.what;
  if (w.endsWith('_in')) { const f = im('fence'); if (!f) return false; row(f, 1.4); return true; }
  if (w === 'metro') { const m = im('metro'), l = im('lamp'); if (!m) return false; fit(m, bx + 0.8, p.w - 0.8, Math.min(p.h, 4.5)); if (l) fit(l, bx - 0.4, 1.2, 4, { mode: 'height' }); return true; }
  if (w === 'drain') { const d = im('drain'); if (!d) return false; row(d, 3); return true; }
  if (w === 'mine') { const hf = im('headframe'), wh = im('washhouse'); if (!hf && !wh) return false; if (hf) fit(hf, bx + p.w * 0.45, p.w * 0.55, p.h, { mode: 'height' }); if (wh) fit(wh, bx, p.w * 0.6, 4.5); return true; }
  if (w === 'silo') { const f = im('fence'), gh = im('guardhouse'), rd = im('radar'); if (!f && !gh && !rd) return false; if (rd) fit(rd, bx + p.w * 0.1, 2.5, 5.5, { mode: 'height' }); if (gh) fit(gh, bx + p.w * 0.5, 3, 2.8); if (f) row(f, 1.5); return true; }
  if (w === 'hatch') { const h = im('hatch'); if (!h) return false; fit(h, bx, p.w, 1.2); return true; }
  return false;
}
function drawSurface(ctx, p, g, { back, trim, wall, glass, px1, R, C }) {
  const w = back(snap(C.wall)), t = back(snap(C.trim)), d = back(0x333941), hi = back(0xdae0ea), bx = p.x, by = p.y + p.h;
  const what = p.what;
  if (what === 'metro') { R(t, bx + 1, p.y + p.h * 0.35, p.w - 2, 0.5); R(w, bx + 1, p.y + p.h * 0.35 + 0.5, p.w - 2, 0.2); for (const x of [bx + 1.5, bx + p.w - 1.8]) R(d, x, p.y + p.h * 0.35, 0.3, p.h * 0.65); R(back(0x285cc4), bx + p.w / 2 - 0.6, p.y + p.h * 0.35 - 1.4, 1.2, 1.2); R(hi, bx + p.w / 2 - 0.3, p.y + p.h * 0.35 - 1.1, 0.6, 0.6); }
  if (what === 'metro_in' || what === 'drain_in' || what === 'silo_in' || what === 'mine_in') { for (let x = bx; x < bx + p.w; x += 0.6) R(d, x, by - 1.2, 1 / g, 1.2); R(d, bx, by - 1.2, p.w, 1 / g); R(d, bx, by - 0.6, p.w, 1 / g); }   // a railing / fence behind the entrance
  if (what === 'metro' || what === 'silo') { R(d, bx + 0.2, p.y + 1, 0.2, p.h - 1); R(back(0xfef3c0), bx - 0.1, p.y + 0.8, 0.8, 0.3); }   // street lamp
  if (what === 'drain') { R(back(0x8b93af), bx, by - 2.5, p.w, 2.5); R(hi, bx, by - 2.5, p.w, 1 / g); for (let x = bx + 0.5; x < bx + p.w - 1; x += 1.5) R(d, x, by - 1.5, 1, 1); for (let x = bx + 0.5; x < bx + p.w; x += 2) R(back(0x24523b), x, by - 2.8, 0.4, 0.3); }
  if (what === 'mine') { R(back(0x71413b), bx, by - 5, p.w * 0.6, 5); ctx.fillStyle = css(back(0x5b3138)); ctx.beginPath(); ctx.moveTo(bx * g, (by - 5) * g); ctx.lineTo((bx + p.w * 0.3) * g, (by - 6.5) * g); ctx.lineTo((bx + p.w * 0.6) * g, (by - 5) * g); ctx.fill(); for (let x = bx + 0.6; x < bx + p.w * 0.6 - 0.8; x += 1.6) R(back(0x141013), x, by - 4, 0.8, 1.2); ctx.strokeStyle = css(d); ctx.lineWidth = px1 * 2; ctx.beginPath(); ctx.moveTo((bx + p.w * 0.6) * g, (by - 3) * g); ctx.lineTo((bx + p.w) * g, (by - p.h) * g); ctx.stroke(); }
  if (what === 'silo') { for (let x = bx; x < bx + p.w; x += 0.5) R(d, x, by - 2, 1 / g, 2); R(d, bx, by - 2, p.w, 1 / g); R(back(0x6d758d), bx + p.w * 0.55, by - 3, 2.4, 3); R(back(0x141013), bx + p.w * 0.55 + 0.9, by - 2, 0.6, 2); ctx.fillStyle = css(hi); ctx.beginPath(); ctx.ellipse((bx + p.w * 0.25) * g, (by - 4.5) * g, 1.2 * g, 0.9 * g, -0.5, 0, Math.PI * 2); ctx.fill(); R(d, bx + p.w * 0.25 - 0.05, by - 4, 0.12, 4); }
  if (what === 'hatch') R(d, bx, by - 0.5, p.w, 0.5);
}

// far silhouettes on the horizon: base = y of their foot; color the silhouette, k scale
export function paintSkyline(ctx, sky, { x = 0, base = 300, color = '#403353', lit = '#ffd541', k = 1, alpha = 1 } = {}) {
  const c = css(snap(color)), dk = css(mix(color, 0x060608, 0.25)), L = css(snap(lit));
  ctx.save(); ctx.globalAlpha = alpha;
  for (const b of sky.list) {
    const bx = x + b.x * k, w = b.w * k, h = b.h * k, top = base - h;
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(bx), Math.round(top), Math.round(w), Math.ceil(h) + 2);
    if (b.roof === 'crown') { ctx.fillRect(Math.round(bx + w * 0.2), Math.round(top - 6 * k), Math.round(w * 0.6), Math.ceil(6 * k)); ctx.fillRect(Math.round(bx + w * 0.45), Math.round(top - 16 * k), Math.max(1, Math.round(w * 0.1)), Math.ceil(10 * k)); }
    if (b.roof === 'setback') ctx.fillRect(Math.round(bx + w * 0.15), Math.round(top - h * 0.12), Math.round(w * 0.7), Math.ceil(h * 0.12));
    if (b.roof === 'gable') { ctx.beginPath(); ctx.moveTo(bx, top); ctx.lineTo(bx + w / 2, top - w * 0.25); ctx.lineTo(bx + w, top); ctx.fill(); }
    if (b.roof === 'shed') for (let sx = bx; sx < bx + w - 8 * k; sx += 14 * k) { ctx.beginPath(); ctx.moveTo(sx, top); ctx.lineTo(sx + 12 * k, top - 8 * k); ctx.lineTo(sx + 12 * k, top); ctx.fill(); }
    if (b.roof === 'tank') { ctx.beginPath(); ctx.ellipse(bx + w / 2, top, w / 2, 8 * k, 0, Math.PI, 0); ctx.fill(); }
    for (const u of b.units) ctx.fillRect(Math.round(bx + u.x * k), Math.round(top - u.h * k), Math.max(1, Math.round(u.w * k)), Math.ceil(u.h * k));
    ctx.fillStyle = dk; ctx.fillRect(Math.round(bx + w - Math.max(1, 3 * k)), Math.round(top), Math.max(1, Math.round(3 * k)), Math.ceil(h));   // shade side
    ctx.fillStyle = L; for (const [wx, wy] of b.windows) ctx.fillRect(Math.round(bx + wx * k), Math.round(top + wy * k), Math.max(1, Math.round(3 * k)), Math.max(1, Math.round(4 * k)));
  }
  ctx.restore();
}

// the view out of a room window (#171, the same look as the landmark windows of #163): dusk sky, far city from the grammar
export function paintWindowView(ctx, x, y, w, h, { sky = null, seed = 1 } = {}) {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, '#285cc4'); grad.addColorStop(0.65, '#bc4a9b'); grad.addColorStop(1, '#f5a097');
  ctx.fillStyle = grad; ctx.fillRect(x, y, w, h);
  if (sky) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); paintSkyline(ctx, sky, { x: x - (seed * 37 % 200), base: y + h, color: '#403353', k: h / 260 }); ctx.restore(); }
}

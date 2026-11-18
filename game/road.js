// The road between two places, drawn by code (#053, Daniel 18.11.2026: „die Reise von POI zu POI ähnlich in Szene setzen wie bei Keep
// Driving … bau richtig tolle Lichteffekte, Sonnenuntergänge und Wetter aus Code ein“). A side view in layers that pass by at their own
// speed: sky by the hour (dithered bands, sun or moon, stars, milky way, clouds lit from below, rays at low sun), the city on the horizon,
// far relief by region (mesas, dunes, ridges, hills, salt flats), hills, things by the road (ruins, wrecks, water towers, billboards of
// the brands, pylons with wires), telegraph poles, the road, tufts in front. Weather: rain with lightning, dust, morning fog, heat haze.
// The incident of a leg stands by the road and comes closer (Welt › Encounter › Am Straßenrand).
//
// No DOM besides canvases: makeRoad(D, opts) → { draw(ctx, W, H, st) } draws into a small pixel canvas (480 × 270 background pixels,
// the caller scales it up sharp); light(ctx, …) and front(ctx, …) draw the big things over the rig (headlights, flares, rain, dust).
// st = { dist (px the rig has rolled), t (s), hour (clock hours), land: [from, to, k], wet, dust, fog, flash, stop: { kind, x } }
export const BW = 480, BH = 270, HORIZON = 148, ROAD = [214, 238], WHEEL_Y = 229;
export const RELIEFS = [['mesas', 'Tafelberge'], ['dunes', 'Dünen'], ['jagged', 'Grate'], ['hills', 'Hügel'], ['flat', 'Salzpfanne']];
export const ROADSIDE = [['', 'nichts am Rand'], ['barrier', 'Straßensperre'], ['creatures', 'Kreaturen mit leuchtenden Augen'], ['truck', 'Liegengebliebener LKW'],
  ['breakdown', 'Panne: Dampf aus dem Motor'], ['trader', 'Händler mit Laternen'], ['storm', 'Staubwand am Horizont'], ['hitchhiker', 'Anhalterin'], ['flare', 'Rauchfackel']];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hex = c => { const n = parseInt(String(c || '#000000').slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, k))));
const css = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
const hash = (a, b = 0) => { let x = Math.imul((a | 0) ^ 0x9e3779b9, 2654435761) ^ Math.imul((b | 0) + 0x632be5ab, 1597334677); x ^= x >>> 15; x = Math.imul(x, 2246822519); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
// value noise along x, smooth, 0…1
const noise = (x, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, s) * (1 - u) + hash(i + 1, s) * u; };

// ---------- configuration (Reisen › Fahrt, Reisen › Landschaften) ----------
export function driveConfig(D) {
  const R = D?.travel?.drive || {};
  return { enabled: R.enabled !== false, seconds: Math.max(3, R.seconds ?? 30), fast: Math.max(1, R.fast ?? 6), speed: R.speed ?? 120, stopAt: clamp((R.stopAt ?? 80) / 100, 0.3, 0.95),
    rigHeight: clamp((R.rigHeight ?? 34) / 100, 0.1, 0.7), rigX: clamp((R.rigX ?? 62) / 100, 0.3, 0.9), rays: (R.rays ?? 70) / 100, flare: (R.flare ?? 60) / 100,
    headlights: (R.headlights ?? 80) / 100, grain: (R.grain ?? 10) / 100, haze: (R.haze ?? 60) / 100, bounce: R.bounce ?? 3 };
}
const LAND = { region: '', relief: 'mesas', far: '#8e5252', mid: '#a08662', ground: '#dba463', road: '#333941', plants: '#5a4e44', rock: '#71413b',
  ruins: 15, wrecks: 12, towers: 6, signs: 10, plantsN: 30, poles: 1, pylons: 0, city: 20, dust: 15, fog: 10 };
export function landscapeOf(D, region) {
  const rows = D?.travel?.landscapes || [];
  return { ...LAND, ...(rows.find(r => !r.region) || {}), ...(rows.find(r => r.region && r.region === region) || {}) };
}

// ---------- the sky by the hour ----------
// [hour, top, middle, low, horizon, darkness]
const SKY = [
  [0, '#0a0a1c', '#121430', '#1c1f45', '#2a2a55', 0.85], [4.6, '#0d0d24', '#1a1a3c', '#30284e', '#4a3352', 0.8],
  [5.6, '#1a1838', '#3b2a5a', '#8a4a6a', '#e08a6a', 0.55], [6.6, '#2a3a78', '#6a6aa8', '#e8a080', '#ffd08a', 0.22],
  [8.2, '#3a6ab8', '#6a9ad0', '#a8c8e0', '#f0dcb0', 0.04], [12, '#285cc4', '#588dbe', '#9cc4e4', '#e8e6d8', 0],
  [16.6, '#3a5aa0', '#7088c0', '#d8b090', '#f8d090', 0.04], [18.2, '#2a1c4a', '#6a2a5a', '#d8503c', '#ffa050', 0.2],
  [19.2, '#160d2a', '#3a1a48', '#7a2a48', '#c05a40', 0.48], [20.6, '#0c0b22', '#161632', '#24224a', '#3a2c55', 0.75], [24, '#0a0a1c', '#121430', '#1c1f45', '#2a2a55', 0.85]];
export function skyAt(hours) {
  const h = ((hours % 24) + 24) % 24;
  let i = 1; while (i < SKY.length - 1 && SKY[i][0] <= h) i++;
  const a = SKY[i - 1], b = SKY[i], k = (h - a[0]) / (b[0] - a[0]);
  const c = j => mix(hex(a[j]), hex(b[j]), k);
  // the sun from 6 to 19 h, the moon the other way round; alt −1…1 over the horizon, x 0…1 across the sky
  const day = h >= 6 && h <= 19, sunK = (h - 6) / 13, nightK = ((h - 19 + 24) % 24) / 11;
  const sunAlt = day ? Math.sin(Math.PI * sunK) : -Math.sin(Math.PI * clamp(nightK)) * 0.6;
  const moonAlt = day ? -0.5 : Math.sin(Math.PI * clamp(nightK));
  const warm = clamp(1 - Math.abs(sunAlt - 0.04) / 0.32) * (h > 3 && h < 21 ? 1 : 0);
  const sunCol = mix(hex('#fffc40'), hex('#fa6a0a'), clamp(1 - sunAlt / 0.45));
  return { h, top: c(1), mid: c(2), low: c(3), hor: c(4), dark: a[5] + (b[5] - a[5]) * k, sun: { alt: sunAlt, x: 0.12 + 0.76 * clamp(sunK), col: sunCol },
    moon: { alt: moonAlt, x: 0.85 - 0.7 * clamp(nightK) }, warm, evening: h > 12 };
}

// ---------- the road ----------
export function makeRoad(D, { seed = 1, logos = null, brands = [] } = {}) {
  const sky = document.createElement('canvas'); sky.width = BW; sky.height = BH;
  const sctx = sky.getContext('2d');
  let skyKey = '';
  const stars = Array.from({ length: 140 }, (_, i) => ({ x: hash(i, seed + 1) * BW, y: hash(i, seed + 2) * HORIZON * 0.95, p: hash(i, 9) * 9, big: hash(i, 5) < 0.08, milk: hash(i, 6) }));
  const clouds = Array.from({ length: 16 }, (_, i) => ({ x: hash(i, seed + 3), y: 14 + hash(i, seed + 4) * 70, w: 24 + hash(i, 7) * 80, h: 2 + Math.floor(hash(i, 8) * 3), v: 0.4 + hash(i, 10) }));
  const drops = [], motes = [], weeds = [];
  let bolt = null;

  function drawSky(S, wet) {
    const key = [S.h.toFixed(2), Math.round(wet * 10)].join();
    if (key === skyKey) return;
    skyKey = key;
    const img = sctx.createImageData(BW, BH), stops = [[0, S.top], [0.42, S.mid], [0.78, S.low], [1, S.hor]];
    const grey = [70, 72, 92];
    const at = k => { for (let i = 1; i < stops.length; i++) if (k <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (k - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); return S.hor; };
    const bands = 12;
    for (let y = 0; y < BH; y++) {
      const k = clamp(y / HORIZON) * (bands - 1), lo = Math.floor(k), f = k - lo;
      let ca = at(lo / (bands - 1)), cb = at(Math.min(bands - 1, lo + 1) / (bands - 1));
      if (wet > 0) { const gr = grey.map(v => v * (1 - S.dark * 0.75)); ca = mix(ca, mix(gr, ca, 0.35), wet * 0.7); cb = mix(cb, mix(gr, cb, 0.35), wet * 0.7); }
      for (let x = 0; x < BW; x++) {
        const col = f * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? cb : ca, o = (y * BW + x) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    sctx.putImageData(img, 0, 0);
  }

  // colour of a thing in the landscape: far things fade into the horizon, evening tints it warm, night darkens it, dust and fog veil it
  function tone(c, depth, S, st) {
    let r = mix(hex(c), S.hor, depth * 0.7);
    if (S.warm > 0) r = mix(r, mix(hex('#b4202a'), hex('#fa6a0a'), 0.5), S.warm * 0.22 * (1 - depth * 0.5));
    r = mix(r, [14, 12, 32], S.dark * (0.97 - depth * 0.2));
    if (st.wet) r = mix(r, [58, 60, 80].map(v => v * (1 - S.dark * 0.7)), st.wet * 0.35 * (0.4 + depth));
    if (st.dust) r = mix(r, mix(hex('#c7b08b'), S.hor, 0.3).map(v => v * (1 - S.dark * 0.7)), st.dust * (0.3 + depth * 0.7));
    if (st.fog) r = mix(r, mix([200, 205, 215], S.hor, 0.4).map(v => v * (1 - S.dark * 0.6)), st.fog * (0.2 + depth * 0.8));
    return r;
  }

  // height of the relief at world x (layer coordinates), by the region's kind
  function relief(kind, x, s, H) {
    switch (kind) {
      case 'dunes': return H * (0.55 * noise(x / 70, s) + 0.3 * noise(x / 26, s + 1) + 0.15 * noise(x / 9, s + 2));
      case 'jagged': return H * ((1 - Math.abs(2 * noise(x / 34, s) - 1)) * 0.75 + 0.25 * noise(x / 7, s + 1));
      case 'hills': return H * (0.75 * noise(x / 110, s) + 0.25 * noise(x / 30, s + 1));
      case 'flat': return H * 0.12 * noise(x / 160, s) + 1;
      default: { const m = smooth(0.5, 0.56, noise(x / 62, s)) * (0.55 + 0.45 * noise(x / 23, s + 5)); return H * (0.12 + 0.75 * m + 0.06 * noise(x / 12, s + 1)) + (m > 0.98 ? 0 : 0.08 * H * noise(x / 5, s + 2)); }
    }
  }
  // the region of a world x at layer speed p: from and to are blended along the leg (k of the leg at the rig, later things are nearer to)
  const landAt = (st, xs) => { const [A, B, k] = st.land; return hash(Math.floor(xs / 40), seed + 77) < k + (xs - BW * 0.6) / 2400 ? B : A; };

  function drawLayer(ctx, st, S, { p, base, H, depth, s, color, kind = null, rim = true }) {
    const off = st.dist * p;
    for (let x = 0; x < BW; x++) {
      const L = landAt(st, x / Math.max(0.05, p)), k = kind || L.relief, h = Math.round(relief(k, x + off, s, H));
      if (h <= 0) continue;
      const c = tone(L[color] || color, depth, S, st);
      ctx.fillStyle = css(c); ctx.fillRect(x, base - h, 1, h + 1);
      // the side towards the sun catches its light; the top edge glows at low sun
      if (rim && S.sun.alt > -0.1 && S.dark < 0.7) {
        const hn = relief(k, x + off + (S.sun.x < 0.5 ? -1 : 1), s, H), lit = hn < h - 0.4;
        ctx.fillStyle = css(mix(c, S.sun.col, (lit ? 0.35 : 0.12) * (0.4 + S.warm) * (1 - S.dark)));
        ctx.fillRect(x, base - h, 1, lit ? 2 : 1);
      }
    }
  }

  // ---------- things by the road (pixel silhouettes) ----------
  function ruin(ctx, x, y, w, h, c, lit, r) {
    // a broken building: a block with a jagged top, dark window holes, now and then a lit one at night
    for (let i = 0; i < w; i++) { const cut = Math.floor(noise(i / 3, r * 7) * h * 0.45); ctx.fillStyle = css(c); ctx.fillRect(x + i, y - h + cut, 1, h - cut); }
    for (let wy = y - h + 6; wy < y - 4; wy += 6) for (let wx = x + 2; wx < x + w - 3; wx += 5) {
      if (wy < y - h + Math.floor(noise((wx - x) / 3, r * 7) * h * 0.45) + 2) continue;
      const on = lit > 0.35 && hash(wx * 7 + wy, r) < 0.14;
      ctx.fillStyle = on ? `rgba(255,190,90,${0.6 + 0.4 * lit})` : css(mix(c, [0, 0, 0], 0.45)); ctx.fillRect(wx, wy, 2, 3);
    }
  }
  function wreck(ctx, x, y, c, r) {
    const tilt = hash(r, 3) < 0.5 ? 1 : 0;
    ctx.fillStyle = css(c); ctx.fillRect(x, y - 5 - tilt, 18, 4); ctx.fillRect(x + 4, y - 9 - tilt, 9, 4);
    ctx.fillStyle = css(mix(c, [0, 0, 0], 0.5)); ctx.fillRect(x + 2, y - 2, 4, 2); if (hash(r, 4) < 0.6) ctx.fillRect(x + 12, y - 2, 4, 2);
    ctx.fillStyle = css(mix(c, [140, 170, 200], 0.25)); ctx.fillRect(x + 6, y - 8 - tilt, 5, 2);
  }
  function tower(ctx, x, y, c) {
    ctx.fillStyle = css(c); ctx.fillRect(x + 1, y - 26, 1, 26); ctx.fillRect(x + 9, y - 26, 1, 26); ctx.fillRect(x + 1, y - 14, 9, 1);
    ctx.fillRect(x - 1, y - 38, 13, 12); ctx.fillRect(x + 1, y - 40, 9, 2);
    ctx.fillStyle = css(mix(c, [255, 255, 255], 0.12)); ctx.fillRect(x - 1, y - 33, 13, 1);
  }
  function cactus(ctx, x, y, c, r) {
    const h = 6 + Math.floor(hash(r, 2) * 8);
    ctx.fillStyle = css(c); ctx.fillRect(x, y - h, 2, h);
    if (h > 8) { ctx.fillRect(x - 2, y - h + 3, 2, 3); ctx.fillRect(x - 2, y - h + 1, 1, 2); ctx.fillRect(x + 2, y - h + 5, 2, 2); ctx.fillRect(x + 3, y - h + 3, 1, 2); }
  }
  function bush(ctx, x, y, c, r, n = 6) {
    ctx.fillStyle = css(c);
    for (let i = 0; i < n; i++) ctx.fillRect(x + Math.floor(hash(r, i) * 7) - 3, y - 1 - Math.floor(hash(r, i + 9) * 3), 2, 2);
  }
  function billboard(ctx, x, y, c, b, S, t) {
    const lit = S.dark > 0.35;
    ctx.fillStyle = css(mix(c, [0, 0, 0], 0.4)); ctx.fillRect(x + 3, y - 18, 1, 18); ctx.fillRect(x + 22, y - 18, 1, 18);
    const face = mix(hex(b?.color || '#ffd27a'), [20, 18, 30], 0.15 + S.dark * 0.5);
    ctx.fillStyle = css(mix(c, [0, 0, 0], 0.3)); ctx.fillRect(x - 1, y - 33, 28, 16);
    ctx.fillStyle = css(face); ctx.fillRect(x, y - 32, 26, 14);
    const lg = typeof logos === 'function' ? logos() : logos;
    if (lg && b?.icon != null) { const cx = b.icon % 4, cy = Math.floor(b.icon / 4); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1 - S.dark * 0.45; ctx.drawImage(lg, cx * 64, cy * 64, 64, 64, x + 7, y - 32, 13, 13); ctx.globalAlpha = 1; }
    if (lit) {   // two lamps on the board at night, flickering a little
      const f = 0.75 + 0.25 * Math.sin(t * 17 + x);
      const g = ctx.createRadialGradient(x + 13, y - 34, 0, x + 13, y - 34, 18); g.addColorStop(0, `rgba(255,230,160,${0.35 * f})`); g.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 6, y - 50, 38, 34);
      ctx.fillStyle = `rgba(255,240,190,${f})`; ctx.fillRect(x + 6, y - 34, 2, 1); ctx.fillRect(x + 18, y - 34, 2, 1);
    }
  }
  function turbine(ctx, x, y, c, t, r) {
    ctx.fillStyle = css(c); ctx.fillRect(x, y - 34, 1, 34);
    const a0 = t * (0.4 + hash(r, 1)) + r;
    for (let i = 0; i < 3; i++) { const a = a0 + i * 2.094; for (let k = 1; k < 11; k++) ctx.fillRect(Math.round(x + Math.cos(a) * k), Math.round(y - 34 + Math.sin(a) * k), 1, 1); }
  }
  // a city on the horizon: blocks, a few towers with red lamps, windows and neon at night
  function city(ctx, st, S, L, t) {
    const off = st.dist * 0.012, k = (L.city ?? 20) / 100;
    if (k <= 0) return;
    for (let x = 0; x < BW; x++) {
      const wx = x + off, cell = Math.floor(wx / 7), on = noise(wx / 160, seed + 31);
      if (on < 1 - k * 0.9) continue;
      const h = Math.round(4 + hash(cell, seed + 32) * 22 * on + (hash(cell, seed + 33) < 0.06 ? 16 : 0));
      const c = tone('#4a5462', 0.85, S, st);
      ctx.fillStyle = css(c); ctx.fillRect(x, HORIZON - h, 1, h);
      if (S.dark > 0.3 && hash(Math.floor(wx), Math.floor(t * 0.5) + cell) < 0.05 * S.dark) { ctx.fillStyle = hash(cell, 4) < 0.5 ? 'rgba(255,90,200,.9)' : 'rgba(80,240,255,.9)'; ctx.fillRect(x, HORIZON - h + 2 + Math.floor(hash(wx, 3) * (h - 3)), 1, 1); }
      if (h > 20 && Math.floor(wx) % 7 === 3 && S.dark > 0.2 && Math.sin(t * 3 + cell) > 0) { ctx.fillStyle = 'rgba(255,60,60,1)'; ctx.fillRect(x, HORIZON - h - 1, 1, 1); }
    }
    if (S.dark > 0.3) {   // the glow of the city over the horizon
      const g = ctx.createLinearGradient(0, HORIZON - 40, 0, HORIZON); g.addColorStop(0, 'rgba(255,80,160,0)'); g.addColorStop(1, `rgba(255,80,160,${0.12 * S.dark * k})`);
      ctx.fillStyle = g; ctx.fillRect(0, HORIZON - 40, BW, 40);
    }
  }

  // the incident of the leg by the road: drawn where the road will stop the rig (x in background pixels on screen)
  function incident(ctx, kind, x0, S, t) {
    // drawn at the rig's size (people as tall as Leyla next to the van), standing on the road's far edge
    const k = 1.7, y = ROAD[0] + 9, x = x0;
    ctx.save(); ctx.translate(x0, y); ctx.scale(k, k); ctx.translate(-x0, -y);
    incidentArt(ctx, kind, x, y, S, t);
    ctx.restore();
  }
  function incidentArt(ctx, kind, x, y, S, t) {
    const dark = c => css(mix(hex(c), [12, 10, 24], S.dark * 0.6));
    const glow = (gx, gy, r, col, a) => { const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(gx - r, gy - r, r * 2, r * 2); };
    if (kind === 'barrier') {
      ctx.fillStyle = dark('#5a4e44'); for (let i = 0; i < 5; i++) ctx.fillRect(x + i * 6, y - 7 + (i % 2), 5, 7 - (i % 2));
      ctx.fillStyle = dark('#b4202a'); ctx.fillRect(x - 2, y - 11, 34, 2); ctx.fillStyle = dark('#fffc40'); for (let i = 0; i < 34; i += 6) ctx.fillRect(x - 2 + i, y - 11, 3, 2);
      ctx.fillStyle = dark('#322b28'); ctx.fillRect(x + 36, y - 9, 6, 9);   // a burning barrel
      const f = 0.7 + 0.3 * Math.sin(t * 23) * Math.sin(t * 7);
      glow(x + 39, y - 12, 26, '255,140,40', 0.35 * f); ctx.fillStyle = `rgba(255,${180 + 60 * f},60,1)`; ctx.fillRect(x + 37, y - 12 - Math.round(2 * f), 4, 3);
    } else if (kind === 'creatures') {   // eyes in the scrub behind the road; the creatures themselves stand by the road (Figuren)
      for (let i = 0; i < 7; i++) {
        const fx = x + 6 + i * 7 + Math.round(Math.sin(t * 0.7 + i) * 2), fy = y - 10 - (i % 3) * 3;
        ctx.fillStyle = dark('#24523b'); ctx.fillRect(fx - 3, fy - 1, 7, 4);
        if (Math.sin(t * 1.3 + i * 2.1) > -0.85) { ctx.fillStyle = 'rgba(160,255,90,1)'; ctx.fillRect(fx - 1, fy, 1, 1); ctx.fillRect(fx + 1, fy, 1, 1); glow(fx, fy, 4, '160,255,90', 0.45); }
      }
    } else if (kind === 'truck') {
      ctx.fillStyle = dark('#4a5462'); ctx.fillRect(x, y - 14, 30, 11); ctx.fillStyle = dark('#73172d'); ctx.fillRect(x + 30, y - 12, 10, 9); ctx.fillRect(x + 32, y - 15, 7, 3);
      ctx.fillStyle = dark('#141013'); for (const wx of [x + 3, x + 12, x + 33]) ctx.fillRect(wx, y - 3, 5, 3);
      ctx.fillStyle = dark('#a6fcdb'); ctx.fillRect(x + 34, y - 11, 4, 3);
      if (Math.sin(t * 6) > 0) { glow(x, y - 6, 10, '255,170,40', 0.6); glow(x + 40, y - 6, 10, '255,170,40', 0.6); ctx.fillStyle = 'rgb(255,190,60)'; ctx.fillRect(x - 1, y - 6, 2, 2); ctx.fillRect(x + 40, y - 6, 2, 2); }
      ctx.fillStyle = 'rgba(200,200,210,.5)'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 36 + Math.round(Math.sin(t + i) * 2), y - 18 - i * 3 - (t * 6 % 3), 2, 2);
    } else if (kind === 'trader') {
      ctx.fillStyle = dark('#5b3138'); ctx.fillRect(x, y - 12, 26, 9); ctx.fillStyle = dark('#e86a73'); for (let i = 0; i < 26; i += 4) ctx.fillRect(x + i, y - 16, 2, 4);
      ctx.fillStyle = dark('#fad6b8'); for (let i = 1; i < 26; i += 4) ctx.fillRect(x + i, y - 16, 2, 4);
      ctx.fillStyle = dark('#141013'); ctx.fillRect(x + 3, y - 3, 5, 3); ctx.fillRect(x + 18, y - 3, 5, 3);
      for (let i = 0; i < 4; i++) { const lx = x + 2 + i * 7, ly = y - 18 + (i % 2); const f = 0.8 + 0.2 * Math.sin(t * 5 + i); ctx.fillStyle = `rgba(255,200,90,${f})`; ctx.fillRect(lx, ly, 1, 2); glow(lx, ly, 7, '255,190,80', 0.25 * f); }
    } else if (kind === 'hitchhiker') {
      ctx.fillStyle = dark('#4a5462'); ctx.fillRect(x + 14, y - 18, 1, 18); ctx.fillStyle = dark('#df3e23'); ctx.fillRect(x + 10, y - 20, 9, 4);
      ctx.fillStyle = dark('#bb7547'); ctx.fillRect(x - 4, y - 4, 4, 4);
    } else if (kind === 'flare') {
      const f = 0.6 + 0.4 * Math.sin(t * 31) * Math.sin(t * 13);
      glow(x, y - 2, 30, '255,40,40', 0.45 * f); ctx.fillStyle = 'rgb(255,120,110)'; ctx.fillRect(x - 1, y - 2, 2, 2);
      ctx.fillStyle = 'rgba(230,90,90,.35)'; for (let i = 0; i < 7; i++) ctx.fillRect(x + Math.round(Math.sin(t * 0.8 + i) * 3 - i * 1.5), y - 6 - i * 4, 3 + i, 3);
    }
  }

  // the Sandsturm: a towering, churning wall of dust from x to the right edge, darker at its foot
  function dustWall(ctx, x0, S, st, t) {
    const col = mix(hex('#bb7547'), S.hor, 0.25).map(v => Math.round(v * (1 - S.dark * 0.7))), deep = col.map(v => Math.round(v * 0.62));
    for (let x = Math.max(0, Math.floor(x0 - 60)); x < BW; x++) {
      const k = Math.min(1, (x - x0 + 60) / 120), top = Math.round(30 + 60 * (1 - k) + 22 * noise((x + t * 30) / 26, seed + 90) + 10 * noise((x - t * 50) / 9, seed + 91));
      const g = ctx.createLinearGradient(0, top, 0, ROAD[1]); g.addColorStop(0, css(col, 0)); g.addColorStop(0.18, css(col, 0.75 * k)); g.addColorStop(1, css(deep, 0.95 * k));
      ctx.fillStyle = g; ctx.fillRect(x, top, 1, ROAD[1] - top);
    }
  }
  function draw(ctx, st) {
    const S = skyAt(st.hour), t = st.t, [A, B, k] = st.land, L = k < 0.5 ? A : B;
    drawSky(S, st.wet || 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sky, 0, 0);
    if (st.flash > 0) { ctx.fillStyle = `rgba(210,200,255,${0.55 * st.flash})`; ctx.fillRect(0, 0, BW, HORIZON + 10); }
    // stars and the milky way at night
    const night = smooth(0.35, 0.75, S.dark) * (1 - (st.wet || 0) * 0.9) * (1 - (st.dust || 0));
    if (night > 0) {
      for (const s of stars) {
        const x = Math.round((s.x - st.dist * 0.002) % BW + BW) % BW, tw = 0.55 + 0.45 * Math.sin(t * (1.1 + s.p * 0.3) + s.p * 7);
        ctx.fillStyle = `rgba(255,244,216,${night * tw})`; ctx.fillRect(x, Math.round(s.y), 1, 1);
        if (s.big) { ctx.fillStyle = `rgba(255,244,216,${night * tw * 0.4})`; ctx.fillRect(x - 1, Math.round(s.y), 3, 1); ctx.fillRect(x, Math.round(s.y) - 1, 1, 3); }
      }
      for (let i = 0; i < 260; i++) {   // the milky way: a diagonal band of faint dots
        const u = hash(i, seed + 50), x = Math.round(u * BW), y = Math.round(10 + u * 70 + (hash(i, seed + 51) - 0.5) * 26);
        ctx.fillStyle = `rgba(190,180,255,${night * 0.18 * hash(i, 52)})`; ctx.fillRect(x, y, 1, 1);
      }
    }
    // moon
    if (S.moon.alt > 0 && S.dark > 0.2) {
      const mx = Math.round(BW * S.moon.x), my = Math.round(HORIZON - 12 - S.moon.alt * 95), a = smooth(0.2, 0.6, S.dark) * (1 - (st.wet || 0) * 0.7);
      const g = ctx.createRadialGradient(mx, my, 2, mx, my, 34); g.addColorStop(0, `rgba(200,210,255,${0.22 * a})`); g.addColorStop(1, 'rgba(200,210,255,0)');
      ctx.fillStyle = g; ctx.fillRect(mx - 34, my - 34, 68, 68);
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (dx * dx + dy * dy <= 36 && (dx + 3) * (dx + 3) + (dy - 1) * (dy - 1) > 26) { ctx.fillStyle = `rgba(255,250,225,${a})`; ctx.fillRect(mx + dx, my + dy, 1, 1); }
    }
    // sun: big and striped near the horizon, small and white up high; rays fan out at low sun
    const sx = Math.round(BW * S.sun.x), sy = Math.round(HORIZON + 4 - S.sun.alt * 120), R = Math.round(8 + 14 * clamp(1 - S.sun.alt / 0.5));
    const veil = 1 - (st.wet || 0) * 0.85 - (st.dust || 0) * 0.5 - (st.fog || 0) * 0.4;
    if (S.sun.alt > -0.08 && veil > 0) {
      const g = ctx.createRadialGradient(sx, sy, R * 0.5, sx, sy, R * 5); g.addColorStop(0, css(S.sun.col, 0.45 * veil)); g.addColorStop(1, css(S.sun.col, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, BW, HORIZON + 30);
      const top = mix(hex('#fffc40'), S.sun.col, 0.3), bottom = mix(S.sun.col, hex('#b4202a'), S.warm * 0.6);
      for (let dy = -R; dy <= R; dy++) {
        const y = sy + dy; if (y > HORIZON + 1) break;
        const half = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy))), kk = (dy + R) / (2 * R);
        if (dy > 0 && S.warm > 0.3) { const band = R / 5, i = Math.floor(dy / band); if (dy - i * band < Math.min(band - 1, i * 0.9)) continue; }
        ctx.fillStyle = css(mix(top, bottom, Math.round(kk * 5) / 5), veil); ctx.fillRect(sx - half, y, half * 2, 1);
      }
    }
    // clouds: dark bodies, lit from below by a low sun, slowly drifting against the drive
    const cDark = mix(mix(S.top, S.mid, 0.5), [30, 20, 40], 0.4), cLight = S.warm > 0.1 ? mix(S.sun.col, hex('#f5a097'), 0.4) : mix([255, 255, 255], S.hor, 0.3);
    for (const c of clouds) {
      const x = Math.round(((c.x * (BW + 160) - st.dist * 0.03 * c.v - t * 1.5 * c.v) % (BW + 160) + (BW + 160)) % (BW + 160) - 80), y = Math.round(c.y);
      const day = 1 - S.dark;
      ctx.fillStyle = css(mix(cDark, mix([235, 235, 245], S.hor, 0.3), day * 0.7 * (1 - S.warm * 0.6)), 0.9); ctx.fillRect(x, y, Math.round(c.w), c.h);
      ctx.fillRect(x + 6, y - 1, Math.round(c.w * 0.5), 1);
      ctx.fillStyle = css(cLight, (0.25 + 0.6 * S.warm) * (1 - S.dark * 0.8)); ctx.fillRect(x + 3, y + c.h, Math.round(c.w * 0.75), 1);
    }
    // crepuscular rays from a low sun (Reisen › Fahrt › Lichtstrahlen)
    const rays = driveConfig(D).rays * smooth(0.5, 0.05, S.sun.alt) * (S.sun.alt > -0.12 ? 1 : 0) * clamp(veil);
    if (rays > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.05 + 0.9 * hash(i, seed + 60)) + Math.sin(t * 0.2 + i) * 0.03, len = 260, wdt = 0.05 + 0.05 * hash(i, 61);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, len); g.addColorStop(0, css(S.sun.col, 0.16 * rays * (0.6 + 0.4 * Math.sin(t * 0.7 + i * 2)))); g.addColorStop(1, css(S.sun.col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, len, Math.PI + a - wdt, Math.PI + a + wdt); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // lightning: a bolt somewhere over the horizon
    if (bolt && st.flash > 0.3) {
      ctx.fillStyle = `rgba(240,235,255,${st.flash})`;
      let bx = bolt.x, by = 0; while (by < HORIZON - 6) { ctx.fillRect(bx, by, 1, 3); by += 3; bx += Math.round((hash(by, bolt.s) - 0.5) * 4); if (hash(by, bolt.s + 1) < 0.08) { let cx = bx, cy = by; for (let j = 0; j < 6; j++) { cx += hash(j, cy) < 0.5 ? -1 : 1; cy += 2; ctx.fillRect(cx, cy, 1, 2); } } }
    }
    city(ctx, st, S, L, t);
    drawLayer(ctx, st, S, { p: 0.03, base: HORIZON + 1, H: 46, depth: 0.85, s: seed + 11, color: 'far' });
    // the plain between the hills and the road: dithered, lighter towards the horizon (salt flats shine)
    for (let y = HORIZON + 1; y < BH; y++) {
      const kk = (y - HORIZON) / (BH - HORIZON), c = tone(L.ground, 0.75 * (1 - kk) + 0.05, S, st), c2 = tone(L.ground, 0.75 * (1 - kk) + 0.12, S, st);
      for (let x = 0; x < BW; x += 4) { ctx.fillStyle = css(BAYER[(y & 3) * 4 + ((x >> 2) & 3)] < 6 ? c2 : c); ctx.fillRect(x, y, 4, 1); }
      if (y < ROAD[0]) {   // pebbles and scrub on the plain: every row passes at its own speed, slow far away, fast near the road
        const pp = 0.03 + 0.9 * Math.pow(kk / ((ROAD[0] - HORIZON) / (BH - HORIZON)), 1.6), o = st.dist * pp, dot = tone(L.plants, 0.75 * (1 - kk), S, st);
        ctx.fillStyle = css(dot, 0.7);
        for (let x = 0; x < BW; x++) if (hash(Math.floor(x + o), y * 131 + seed) < 0.012 + kk * 0.02) ctx.fillRect(x, y, kk > 0.3 ? 2 : 1, 1);
      }
    }
    if (L.relief === 'flat' && S.dark < 0.6) {   // mirage over the salt: a mirrored, shimmering stripe of the sky
      for (let y = 0; y < 6; y++) { const off = Math.round(Math.sin(t * 3 + y) * 2); ctx.globalAlpha = 0.35 * (1 - y / 6) * (1 - S.dark); ctx.drawImage(sky, 0, HORIZON - 4 - y, BW, 1, off, HORIZON + 2 + y, BW, 1); }
      ctx.globalAlpha = 1;
    }
    drawLayer(ctx, st, S, { p: 0.14, base: 176, H: 24, depth: 0.45, s: seed + 12, color: 'mid', kind: L.relief === 'flat' ? 'flat' : L.relief === 'jagged' ? 'jagged' : 'hills' });
    // things in the middle distance (p 0.35)
    const midOff = st.dist * 0.35, cw = 46;
    const brandsOn = brands.filter(b => b.icon != null);
    for (let ci = Math.floor((midOff - 60) / cw); ci * cw - midOff < BW + 20; ci++) {
      const x = Math.round(ci * cw - midOff + hash(ci, seed + 20) * 20), Lc = landAt(st, x / 0.35 + st.dist), r = hash(ci, seed + 21) * 100, y = 196;
      const c = tone(Lc.rock, 0.3, S, st), lit = S.dark;
      let acc = 0;
      if (r < (acc += Lc.ruins)) ruin(ctx, x, y, 14 + Math.floor(hash(ci, 3) * 18), 10 + Math.floor(hash(ci, 4) * 22), tone('#5a4e44', 0.3, S, st), lit, ci);
      else if (r < (acc += Lc.wrecks)) wreck(ctx, x, y, tone(hash(ci, 5) < 0.5 ? '#73172d' : '#285cc4', 0.35, S, st), ci);
      else if (r < (acc += Lc.towers)) (hash(ci, 6) < 0.5 ? tower : (cx, xx, yy, cc) => turbine(cx, xx, yy, cc, t, ci))(ctx, x, y, tone('#4a5462', 0.3, S, st));
      else if (r < (acc += Lc.signs) && brandsOn.length) billboard(ctx, x, y, tone('#322b28', 0.25, S, st), brandsOn[Math.floor(hash(ci, 7) * brandsOn.length)], S, t);
      else if (r < (acc += Lc.plantsN)) { cactus(ctx, x, y, tone(Lc.plants, 0.3, S, st), ci); bush(ctx, x + 9, y, tone(Lc.plants, 0.3, S, st), ci); }
      else if (r < acc + 15) { ctx.fillStyle = css(c); ctx.fillRect(x, y - 4, 7, 4); ctx.fillRect(x + 2, y - 6, 4, 2); }
    }
    // pylons with sagging wires (p 0.45)
    if ((L.pylons ?? 0) > 0) {
      const off = st.dist * 0.45, gap = 96, c = tone('#333941', 0.3, S, st), ys = [];
      ctx.fillStyle = css(c);
      for (let i = Math.floor((off - gap) / gap); i * gap - off < BW + gap; i++) {
        const x = Math.round(i * gap - off); ys.push(x);
        ctx.fillRect(x, 168, 1, 36); ctx.fillRect(x - 3, 170, 7, 1); ctx.fillRect(x - 2, 175, 5, 1); ctx.fillRect(x - 1, 180, 1, 24); ctx.fillRect(x + 1, 180, 1, 24);
      }
      ctx.strokeStyle = css(c, 0.8); ctx.lineWidth = 1; ctx.beginPath();
      for (let j = 0; j + 1 < ys.length; j++) for (const dy of [170, 175]) { ctx.moveTo(ys[j] - 3 + (dy === 175 ? 1 : 0), dy + 0.5); ctx.quadraticCurveTo((ys[j] + ys[j + 1]) / 2, dy + 9, ys[j + 1] - 3 + (dy === 175 ? 1 : 0), dy + 0.5); }
      ctx.stroke();
    }
    // tumbleweeds (dry regions, with dust or wind)
    if ((st.dust || 0) > 0.1 || L.relief === 'dunes') {
      while (weeds.length < 2) weeds.push({ x: BW + 20 + Math.random() * 300, v: 10 + Math.random() * 20, ph: Math.random() * 6 });
      for (const w of weeds) {
        w.x -= ((st.v || 0) * 0.7 + w.v * (1 + (st.dust || 0) * 2)) * (st.dt || 0);   // rolls against the drive, faster in the wind
        if (w.x < -20) { w.x = BW + 20 + Math.random() * 400; w.v = 10 + Math.random() * 20; }
        const y = 210 - Math.abs(Math.sin(t * 4 + w.ph)) * 4;
        ctx.fillStyle = css(tone('#796755', 0.1, S, st));
        for (let i = 0; i < 12; i++) { const a = i * 0.55 - t * 6; ctx.fillRect(Math.round(w.x + Math.cos(a) * 3), Math.round(y - 3 + Math.sin(a) * 3), 1, 1); }
        ctx.fillRect(Math.round(w.x) - 1, Math.round(y) - 4, 2, 2);
      }
    }
    // telegraph poles with two wires right by the road (p 0.8)
    if ((L.poles ?? 1) > 0) {
      const off = st.dist * 0.8, gap = 70, c = tone('#423934', 0.08, S, st), xs = [];
      for (let i = Math.floor((off - gap) / gap); i * gap - off < BW + gap; i++) {
        const x = Math.round(i * gap - off); xs.push(x);
        ctx.fillStyle = css(c); ctx.fillRect(x, 172, 2, 41); ctx.fillRect(x - 4, 175, 10, 1); ctx.fillRect(x - 4, 174, 1, 1); ctx.fillRect(x + 5, 174, 1, 1);
      }
      ctx.strokeStyle = css(c, 0.9); ctx.beginPath();
      for (let j = 0; j + 1 < xs.length; j++) for (const dx of [-4, 5]) { ctx.moveTo(xs[j] + dx + 0.5, 174.5); ctx.quadraticCurveTo((xs[j] + xs[j + 1]) / 2, 183, xs[j + 1] + dx + 0.5, 174.5); }
      ctx.stroke();
    }
    // the incident stands on the road's far edge; a dust storm is a wall rolling in from the right
    if (st.stop?.kind === 'storm' && st.stop.x != null) dustWall(ctx, st.stop.x, S, st, t);
    else if (st.stop?.kind && st.stop.x != null) incident(ctx, st.stop.kind, Math.round(st.stop.x), S, t);
    // the road: shoulder, asphalt with grain and patches, the dashed middle line (p 1)
    const roff = st.dist, asphalt = tone(L.road, 0, S, st), dash = tone('#ffd541', 0, S, st), edge = tone('#c7b08b', 0.02, S, st);
    ctx.fillStyle = css(edge); ctx.fillRect(0, ROAD[0], BW, 2);
    ctx.fillStyle = css(asphalt); ctx.fillRect(0, ROAD[0] + 2, BW, ROAD[1] - ROAD[0] - 4);
    for (let x = 0; x < BW; x++) {
      const wx = Math.floor(x + roff);
      if (hash(wx, seed + 40) < 0.25) { ctx.fillStyle = css(mix(asphalt, [0, 0, 0], 0.22)); ctx.fillRect(x, ROAD[0] + 3 + Math.floor(hash(wx, 41) * 20), 1, 1); }
      if (noise(wx / 30, seed + 42) > 0.9) { ctx.fillStyle = css(mix(asphalt, [10, 10, 14], 0.3)); ctx.fillRect(x, ROAD[0] + 6 + Math.floor(noise(wx / 13, 43) * 10), 1, 2); }
      if (((wx % 24) + 24) % 24 < 12) { ctx.fillStyle = css(dash, 1 - S.dark * 0.5); ctx.fillRect(x, 225, 1, 1); }
    }
    if (st.wet > 0.1) {   // wet asphalt mirrors the sky
      ctx.globalAlpha = 0.18 * st.wet; ctx.drawImage(sky, 0, HORIZON - 30, BW, 22, 0, ROAD[0] + 3, BW, ROAD[1] - ROAD[0] - 6); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = css(mix(asphalt, edge, 0.5)); ctx.fillRect(0, ROAD[1] - 2, BW, 2);
    // the near ground below the road and tufts in front (p 1.5, dark)
    const fo = st.dist * 1.5, fc = tone(L.ground, 0, S, st).map(v => Math.round(v * 0.62)), tuft = tone(L.plants, 0, S, st).map(v => Math.round(v * 0.55));
    ctx.fillStyle = css(fc); ctx.fillRect(0, ROAD[1], BW, BH - ROAD[1]);
    for (let x = -8; x < BW + 8; x++) {
      const wx = Math.floor(x + fo);
      if (hash(wx, seed + 44) < 0.02) {   // a tuft of grass: blades fanning out
        ctx.fillStyle = css(tuft); const hh = 6 + Math.floor(hash(wx, 46) * 9);
        for (let i = -3; i <= 3; i++) { const bh = Math.max(2, hh - Math.abs(i) * 2 - Math.floor(hash(wx, i + 9) * 3)); ctx.fillRect(x + i + Math.round(i * 0.4), BH - 3 - bh, 1, bh); }
        ctx.fillRect(x - 3, BH - 4, 7, 4);
      }
      if (hash(wx, seed + 45) < 0.012) { ctx.fillStyle = css(fc.map(v => v * 0.7)); ctx.fillRect(x, BH - 12, 10, 12); ctx.fillRect(x + 2, BH - 15, 6, 3); }
    }
    // fog lies in bands over the plain
    if (st.fog > 0) for (let i = 0; i < 4; i++) { const y = HORIZON + 8 + i * 16, o = ((t * (4 + i) + st.dist * 0.1 * (i + 1)) % BW); ctx.fillStyle = css(mix([210, 215, 225], S.hor, 0.4).map(v => v * (1 - S.dark * 0.6)), 0.18 * st.fog);
      for (let x = -BW; x < BW * 2; x += 120) ctx.fillRect(Math.round(x - o), y + Math.round(Math.sin(x + i) * 3), 90, 6); }
  }

  // ---------- over the rig, at full resolution ----------
  // lights: headlights and the road they light, the sun's glow and lens flare (lighter compositing)
  function light(ctx, W, H, st, rig) {
    const S = skyAt(st.hour), u = W / BW, C = driveConfig(D);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (rig && C.headlights > 0 && S.dark > 0.15) {
      const a = smooth(0.15, 0.6, S.dark) * C.headlights, hx = rig.front, hy = rig.lampY;
      const g = ctx.createLinearGradient(hx, 0, hx + W * 0.5, 0); g.addColorStop(0, `rgba(255,236,190,${0.42 * a})`); g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(hx, hy - 6 * u * 0.3); ctx.lineTo(hx + W * 0.55, hy - 30 * u); ctx.lineTo(hx + W * 0.55, WHEEL_Y * u + 22 * u); ctx.lineTo(hx, hy + 6 * u * 0.3); ctx.closePath(); ctx.fill();
      const p = ctx.createRadialGradient(hx + W * 0.16, WHEEL_Y * u, 0, hx + W * 0.16, WHEEL_Y * u, W * 0.2); p.addColorStop(0, `rgba(255,230,180,${0.28 * a})`); p.addColorStop(1, 'rgba(255,230,180,0)');
      ctx.fillStyle = p; ctx.save(); ctx.translate(0, WHEEL_Y * u); ctx.scale(1, 0.18); ctx.fillRect(hx - W * 0.05, -W * 0.3 / 0.18 * 0.18 - W, W * 0.5, W * 2); ctx.restore();
      const l = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14 * u); l.addColorStop(0, `rgba(255,250,230,${0.9 * a})`); l.addColorStop(1, 'rgba(255,250,230,0)');
      ctx.fillStyle = l; ctx.fillRect(hx - 14 * u, hy - 14 * u, 28 * u, 28 * u);
      if (st.wet > 0.1) { const r = ctx.createLinearGradient(0, WHEEL_Y * u, 0, WHEEL_Y * u + 9 * u); r.addColorStop(0, `rgba(255,236,190,${0.3 * a * st.wet})`); r.addColorStop(1, 'rgba(255,236,190,0)'); ctx.fillStyle = r; ctx.fillRect(hx, WHEEL_Y * u, W * 0.45, 9 * u); }
      // tail lights, red
      const tg = ctx.createRadialGradient(rig.back, rig.tailY, 0, rig.back, rig.tailY, 10 * u); tg.addColorStop(0, `rgba(255,40,40,${0.8 * a})`); tg.addColorStop(1, 'rgba(255,40,40,0)');
      ctx.fillStyle = tg; ctx.fillRect(rig.back - 10 * u, rig.tailY - 10 * u, 20 * u, 20 * u);
    }
    // the sun's flare: a glow, a horizontal streak and ghosts across the picture (Reisen › Fahrt › Lens Flare)
    const veil = clamp(1 - (st.wet || 0) * 0.9 - (st.dust || 0) * 0.6 - (st.fog || 0) * 0.5);
    if (C.flare > 0 && S.sun.alt > -0.05 && S.sun.alt < 0.6 && veil > 0) {
      const sx = W * S.sun.x, sy = (HORIZON + 4 - S.sun.alt * 120) * u, a = C.flare * veil * smooth(0.6, 0.15, S.sun.alt);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 90 * u); g.addColorStop(0, css(S.sun.col, 0.35 * a)); g.addColorStop(1, css(S.sun.col, 0));
      ctx.fillStyle = g; ctx.fillRect(sx - 90 * u, sy - 90 * u, 180 * u, 180 * u);
      const s = ctx.createLinearGradient(sx - W * 0.5, 0, sx + W * 0.5, 0); s.addColorStop(0, 'rgba(255,200,150,0)'); s.addColorStop(0.5, `rgba(255,220,170,${0.25 * a})`); s.addColorStop(1, 'rgba(255,200,150,0)');
      ctx.fillStyle = s; ctx.fillRect(sx - W * 0.5, sy - 1.5 * u, W, 3 * u);
      const cx = W / 2, cy = H / 2;
      [[0.35, 10, '255,170,90'], [0.65, 5, '120,220,255'], [1.15, 16, '255,120,200'], [1.45, 7, '255,220,120']].forEach(([f, r, col], i) => {
        const gx = sx + (cx - sx) * f * 2, gy = sy + (cy - sy) * f * 2, gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * u);
        gr.addColorStop(0, `rgba(${col},${0.1 * a})`); gr.addColorStop(0.7, `rgba(${col},${0.06 * a})`); gr.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, r * u, 0, Math.PI * 2); ctx.fill();
        if (i === 2) { ctx.strokeStyle = `rgba(${col},${0.08 * a})`; ctx.lineWidth = 2; ctx.stroke(); }
      });
    }
    ctx.restore();
  }
  // in front: rain streaks slanted by the speed, dust blowing by, a vignette and film grain
  function front(ctx, W, H, st) {
    const u = W / BW, S = skyAt(st.hour), C = driveConfig(D);
    if (st.wet > 0.02) {
      const n = Math.round(260 * st.wet), slant = 0.25 + (st.v || 0) / 300;
      while (drops.length < n) drops.push({ x: Math.random() * W, y: Math.random() * H, k: 0.5 + Math.random() * 0.8 });
      drops.length = n;
      ctx.strokeStyle = `rgba(190,205,240,${0.35 + 0.2 * S.dark})`; ctx.lineWidth = Math.max(1, u * 0.5); ctx.beginPath();
      for (const d of drops) {
        const vy = 900 * d.k * u / 4, vx = -vy * slant;
        d.x += vx * st.dt; d.y += vy * st.dt;
        if (d.y > H) { d.y = -20; d.x = Math.random() * (W * 1.4); }
        if (d.x < -20) d.x += W + 40;
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - vx * 0.03, d.y - vy * 0.03);
      }
      ctx.stroke();
      // splashes on the road
      ctx.fillStyle = 'rgba(200,215,245,.5)';
      for (let i = 0; i < 18 * st.wet; i++) { const x = Math.random() * W, y = (ROAD[0] + 3 + Math.random() * 20) * u; ctx.fillRect(x, y, 2 * u, u * 0.6); }
    }
    if (st.dust > 0.02) {
      const n = Math.round(320 * st.dust), col = mix(hex('#dba463'), S.hor, 0.3).map(v => Math.round(v * (1 - S.dark * 0.6)));
      while (motes.length < n) motes.push({ x: Math.random() * W, y: Math.random() * H, k: 0.4 + Math.random(), s: Math.random() });
      motes.length = n;
      for (const m of motes) {
        m.x -= ((st.v || 0) * u * 1.6 + 260 * u * m.k * st.dust) * st.dt; m.y += Math.sin(st.t * 2 + m.s * 9) * 0.6;
        if (m.x < -10) { m.x = W + Math.random() * 60; m.y = Math.random() * H; }
        ctx.fillStyle = css(col, 0.25 + 0.4 * m.s); ctx.fillRect(m.x, m.y, (2 + m.k * 6) * u * 0.5, Math.max(1, u * 0.5));
      }
      ctx.fillStyle = css(col, 0.22 * st.dust); ctx.fillRect(0, 0, W, H);
    }
    if (st.flash > 0) { ctx.fillStyle = `rgba(220,215,255,${0.25 * st.flash})`; ctx.fillRect(0, 0, W, H); }
    // vignette
    const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.95); v.addColorStop(0, 'rgba(6,5,10,0)'); v.addColorStop(1, `rgba(6,5,10,${0.45 + 0.25 * S.dark})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // grain
    if (C.grain > 0) { for (let i = 0; i < 220 * C.grain; i++) { ctx.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${0.05 * C.grain * 3})` : `rgba(0,0,0,${0.08 * C.grain * 3})`; ctx.fillRect(Math.random() * W, Math.random() * H, u * 0.5, u * 0.5); } }
  }
  // a new bolt for a lightning flash
  const strike = () => { bolt = { x: Math.round(40 + Math.random() * (BW - 80)), s: Math.floor(Math.random() * 1e6) }; };
  return { draw, light, front, strike, sky: skyAt };
}

// the weather of a leg: dust and fog by region and hour (the same leg always the same), the Sandsturm brings its own wall of dust
export function legWeather(D, seed, leg, region, hour) {
  const L = landscapeOf(D, region), h = ((hour % 24) + 24) % 24;
  return { dust: hash(seed, leg * 7 + 1) * 100 < (L.dust ?? 0) ? 0.35 + hash(seed, leg * 7 + 2) * 0.4 : 0,
    fog: h > 4 && h < 10 && hash(seed, leg * 7 + 3) * 100 < (L.fog ?? 0) ? 0.4 + hash(seed, leg * 7 + 4) * 0.5 : 0 };
}

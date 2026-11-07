// Weather: a pixel-art sky drawn by code behind transparent background pictures (sunset, clouds, a threatening glow)
// and rain in front. Used by the start page and the game. All values come from the area "Wetter" (data/weather.json).
//
// Everything is drawn in "background pixels" into a small canvas that the caller scales up sharp.
// Positions are in % of the background picture (box), sizes in background pixels.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];   // 4 × 4 ordered dither

const DEFAULTS = {
  sky: { top: '#140c26', middle: '#4a1d4a', low: '#b2413c', horizon: '#f5a052', bands: 9 },
  sun: { enabled: true, x: 62, y: 66, size: 34, color: '#ffe08a', color2: '#ff7a3a', stripes: 4, halo: 35 },
  clouds: { count: 14, color: '#2a1534', light: '#e0603e', speed: 2, band: [18, 60] },
  glow: { enabled: true, color: '#ff2a1a', at: [30, 70], size: [45, 30], strength: 55, pulse: 5, flicker: 15, embers: 18 },
  rain: { enabled: false, amount: 160, speed: 260, angle: 12, length: 7, color: '#a9b8e0', opacity: 45, darken: 25, flash: 2 },
};

const hex = c => { const n = parseInt((c || '#000').slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const css = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`;
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export function weatherDefaults() { return structuredClone(DEFAULTS); }

export function makeWeather(def = {}) {
  const D = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, { ...v, ...(def[k] || {}) }]));
  const r = rng(4711);
  const clouds = Array.from({ length: Math.max(0, D.clouds.count | 0) }, () => ({ x: r(), y: r(), w: 14 + r() * 50, h: 1 + Math.floor(r() * 3), v: 0.5 + r() }));
  const embers = Array.from({ length: Math.max(0, D.glow.embers | 0) }, () => ({ x: r(), y: r(), v: 4 + r() * 10, p: r() * 10 }));
  let drops = [], base = null, baseKey = '', flashUntil = 0, nextFlash = 0;

  // gradient with dithered bands + sun, cached per size and box
  function sky(w, h, box) {
    const key = [w, h, box.y, box.h, box.x, box.w].join(',');
    if (base && baseKey === key) return base;
    base = Object.assign(document.createElement('canvas'), { width: w, height: h }); baseKey = key;
    const c = base.getContext('2d'), img = c.createImageData(w, h), S = D.sky;
    const stops = [[0, hex(S.top)], [0.4, hex(S.middle)], [0.72, hex(S.low)], [1, hex(S.horizon)]];
    const at = k => { for (let i = 1; i < stops.length; i++) if (k <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (k - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); return stops[stops.length - 1][1]; };
    const bands = Math.max(2, S.bands | 0), horizon = box.y + box.h * (D.sun.y / 100);
    for (let y = 0; y < h; y++) {
      const k = Math.max(0, Math.min(1, y / Math.max(1, horizon))) * (bands - 1), lo = Math.floor(k), f = k - lo;
      const ca = at(lo / (bands - 1)), cb = at(Math.min(bands - 1, lo + 1) / (bands - 1));
      for (let x = 0; x < w; x++) {
        const col = f * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? cb : ca, o = (y * w + x) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    const U = D.sun;
    if (U.enabled) {
      const sx = Math.round(box.x + box.w * U.x / 100), sy = Math.round(box.y + box.h * U.y / 100), R = Math.max(2, U.size | 0);
      if (U.halo > 0) {
        const g = c.createRadialGradient(sx, sy, R * 0.6, sx, sy, R * 4);
        g.addColorStop(0, css(hex(U.color2), U.halo / 100)); g.addColorStop(1, css(hex(U.color2), 0));
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }
      const top = hex(U.color), bottom = hex(U.color2);
      for (let dy = -R; dy <= R; dy++) {
        const k = (dy + R) / (2 * R), half = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)));
        // stripes cut through the lower half, wider towards the horizon
        if (dy > 0 && U.stripes > 0) { const band = R / (U.stripes + 1), i = Math.floor(dy / band); if (dy - i * band < Math.min(band - 1, i * 0.9)) continue; }
        c.fillStyle = css(mix(top, bottom, Math.round(k * 5) / 5)); c.fillRect(sx - half, sy + dy, half * 2, 1);
      }
    }
    return base;
  }

  return {
    // sky behind the background picture; box = where the picture sits inside the canvas (background pixels)
    sky(ctx, w, h, t, box = { x: 0, y: 0, w, h }) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sky(w, h, box), 0, 0);
      const C = D.clouds, dark = hex(C.color), light = hex(C.light);
      for (const c of clouds) {
        const x = Math.round(((c.x * (w + 80) + t * C.speed * c.v) % (w + 80)) - 60), y = Math.round(box.y + box.h * (C.band[0] + (C.band[1] - C.band[0]) * c.y) / 100);
        ctx.fillStyle = css(dark); ctx.fillRect(x, y, Math.round(c.w), c.h);
        ctx.fillStyle = css(light, 0.7); ctx.fillRect(x + 3, y + c.h, Math.round(c.w * 0.7), 1);
      }
      const G = D.glow;
      if (G.enabled) {
        const gx = box.x + box.w * G.at[0] / 100, gy = box.y + box.h * G.at[1] / 100, rw = Math.max(1, box.w * G.size[0] / 200), rh = Math.max(1, box.h * G.size[1] / 200);
        const pulse = G.pulse > 0 ? 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / G.pulse) : 1;
        const flicker = 1 - (G.flicker / 100) * Math.max(0, Math.sin(t * 13.7) * Math.sin(t * 7.3));
        const a = (G.strength / 100) * (0.65 + 0.35 * pulse) * flicker, col = hex(G.color);
        ctx.save(); ctx.translate(gx, gy); ctx.scale(1, rh / rw);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
        g.addColorStop(0, css(col, a)); g.addColorStop(0.45, css(col, a * 0.45)); g.addColorStop(1, css(col, 0));
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = g; ctx.fillRect(-rw, -rw, rw * 2, rw * 2);
        ctx.restore();
        ctx.fillStyle = css(mix(col, [255, 220, 120], 0.5));
        for (const e of embers) {
          const life = ((t * e.v / 40 + e.p) % 1), ex = Math.round(gx + (e.x - 0.5) * rw * 1.6 + Math.sin(t + e.p * 6) * 3), ey = Math.round(gy - life * rh * 2.2);
          ctx.globalAlpha = (1 - life) * a; ctx.fillRect(ex, ey, 1, 1);
        }
        ctx.globalAlpha = 1;
      }
      const W = D.rain;
      if (W.enabled && W.darken > 0) { ctx.fillStyle = `rgba(12,10,24,${W.darken / 100})`; ctx.fillRect(0, 0, w, h); }
      if (W.enabled && W.flash > 0) {   // sheet lightning far away
        if (t > nextFlash) { flashUntil = t + 0.12 + Math.random() * 0.15; nextFlash = t + (60 / W.flash) * (0.5 + Math.random()); }
        if (t < flashUntil) { ctx.fillStyle = `rgba(200,190,255,${0.25 * Math.random()})`; ctx.fillRect(0, 0, w, h); }
      }
    },
    // rain in front of everything (transparent canvas)
    front(ctx, w, h, t, dt) {
      const W = D.rain;
      if (!W.enabled) return false;
      const n = Math.max(0, W.amount | 0), a = W.angle * Math.PI / 180, vx = Math.sin(a) * W.speed, vy = Math.cos(a) * W.speed;
      while (drops.length < n) drops.push({ x: Math.random() * (w + 40) - 20, y: Math.random() * h, k: 0.6 + Math.random() * 0.6 });
      drops.length = n;
      ctx.strokeStyle = css(hex(W.color), W.opacity / 100); ctx.lineWidth = 1; ctx.beginPath();
      const L = W.length / W.speed;
      for (const d of drops) {
        d.x += vx * d.k * dt; d.y += vy * d.k * dt;
        if (d.y > h || d.x > w + 20) { d.y = -W.length - Math.random() * 20; d.x = Math.random() * (w + 40) - 20 - vx * 0.3; }
        const x = Math.round(d.x) + 0.5, y = Math.round(d.y);
        ctx.moveTo(x, y); ctx.lineTo(Math.round(x + vx * L * d.k) + 0.5, Math.round(y + vy * L * d.k));
      }
      ctx.stroke();
      return true;
    },
    rain: !!D.rain.enabled,
  };
}

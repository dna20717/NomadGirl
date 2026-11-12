// Start page: background layers (pixel art, scaled sharp), Leyla running endlessly towards us, the ground sliding away under her.
// Everything comes from the area "Startseite" (data/splash.json) and the assets it points to.
// Online the data come live from the repository (/api/files), like in the game; otherwise the delivered files.
//
// Picture: Leyla and the camera move towards the viewer at the same speed, so the ground recedes:
// pebbles and cracks appear at the bottom edge and slide up to the horizon, getting smaller. Dust from her steps stays behind.
import { cloudFiles } from '../cloud_store.js';
import { makeWeather } from '../weather.js';
import { Cables, hullPoint } from '../drone_cables.js';

const BASE = new URL('../../projects/nomadgirl/', import.meta.url);
const Z_NEAR = 0.6, Z_FAR = 40;   // depth range of the ground (m)

export async function startSplash(canvas) {
  const cloud = await cloudFiles();
  const json = async f => cloud?.files.has(f) ? cloud.files.get(f) : (await fetch(new URL(f, BASE), { cache: 'no-store' })).json();
  const [S, A, WX, DR] = await Promise.all([json('data/splash.json'), json('data/assets.json'), json('data/weather.json').catch(() => ({})), json('data/drone.json').catch(() => ({}))]);
  // AvA hovers next to Leyla and shows random moods (face frame + kaomoji bubble)
  const SD = { show: true, at: [57, 44], height: 15, every: [3, 7], bob: 1.2, moods: 'kill, cleared, curious, scan, alert, bored, sleep, dash', ...(S.drone || {}) };
  const droneMoods = (DR.moods || []).filter(m => String(SD.moods).split(',').map(x => x.trim()).includes(m.mood));
  const drone = { frame: 0, until: 0, next: 0, bubble: '', bubbleUntil: 0 };
  // weather: sky behind the layers, rain in front (both in background pixels, scaled up sharp)
  const weather = S.weather && WX[S.weather] ? makeWeather(WX[S.weather]) : null;
  const skyCv = document.createElement('canvas'), rainCv = document.createElement('canvas');
  // horizon haze: dithered fade of the ground colour into the picture, shimmering rows (heat), a warm glow line
  const HZ = { enabled: true, fade: 14, band: 34, shimmer: 1.5, speed: 2.2, glow: 16, color: '#f5a052', ...(S.haze || {}) };
  if (S.weather && WX[S.weather]?.sky?.horizon && !S.haze?.color) HZ.color = WX[S.weather].sky.horizon;
  const bandCv = document.createElement('canvas'), fadeCv = document.createElement('canvas');
  let fadeKey = '';
  const image = id => A[id]?.file ? load(new URL(A[id].file, BASE).href) : Promise.resolve(null);
  const layers = (await Promise.all((S.background || []).map(image))).filter(Boolean);
  const droneImg = SD.show && DR.look ? await image(DR.look) : null, droneA = A[DR.look] || {};
  // modular drone (Daniel, 10.11.2026): face on the screen, glass above it, swinging cables below
  const faceImg = droneImg && DR.face?.look ? await image(DR.face.look) : null, faceA = A[DR.face?.look] || {};
  const glassImg = faceImg && DR.face?.glass ? await image(DR.face.glass) : null;
  const cables = new Cables(DR.cables, DR.cable);
  const parts = droneImg ? (await Promise.all((DR.parts || []).filter(r => r.on && A[r.look]).map(async r => ({ r, a: A[r.look], img: await image(r.look) })))).filter(p => p.img) : [];
  let blinkAt = 0, blinkUntil = 0, lastDrone = 0;
  // Leyla's gaits (run, walk …): picked at random by weight, switched now and then at the end of a cycle
  const gaits = (await Promise.all((S.runners || (S.runner ? [{ look: S.runner }] : [])).filter(r => A[r.look] && (r.weight ?? 1) > 0)
    .map(async r => ({ a: A[r.look], img: await image(r.look), weight: r.weight ?? 1, speed: r.speed ?? 1 })))).filter(g => g.img);
  const pick = not => { const list = gaits.length > 1 && not ? gaits.filter(g => g !== not) : gaits, sum = list.reduce((n, g) => n + g.weight, 0);
    let r = Math.random() * sum; return list.find(g => (r -= g.weight) < 0) || list[0]; };
  let gait = pick(), gaitStart = 0, nextSwitch = Infinity, pace = gait?.speed ?? 1, run = gait?.a, runImg = gait?.img;
  const [sw0, sw1] = S.switchEvery || [];
  const planSwitch = now => { nextSwitch = sw0 ? now + (sw0 + Math.random() * Math.max(0, (sw1 ?? sw0) - sw0)) * 1000 : Infinity; };
  const G = { speed: 6, specks: 140, color: '#4a4256', base: '#292330', dust: true, shadow: true, width: 4, edge: 16, shift: 0, fogFrom: 12, ...(S.ground || {}) };
  // ground texture (top view, tiles along the road): read once into a pixel array, projected row by row in background pixels
  const texImg = G.texture ? await image(G.texture) : null;
  const tex = texImg && (() => {
    const c = Object.assign(document.createElement('canvas'), { width: texImg.width, height: texImg.height }), g = c.getContext('2d');
    g.drawImage(texImg, 0, 0);
    return { w: c.width, h: c.height, px: new Uint32Array(g.getImageData(0, 0, c.width, c.height).data.buffer) };
  })();
  const groundCv = document.createElement('canvas'), groundCtx = groundCv.getContext('2d');
  let groundData = null, roll = 0;
  const rgb = s => { const n = parseInt(String(s || '#000').replace('#', ''), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.width = Math.round(innerWidth * dpr); H = canvas.height = Math.round(innerHeight * dpr);
    ctx.imageSmoothingEnabled = false;
  };
  addEventListener('resize', resize); resize();

  // pointer for the parallax (-1 … 1), eased; without a mouse a slow sway
  const aim = { x: 0, y: 0, at: -1e9 }, look = { x: 0, y: 0 };
  addEventListener('pointermove', e => { aim.x = e.clientX / innerWidth * 2 - 1; aim.y = e.clientY / innerHeight * 2 - 1; aim.at = performance.now(); });

  // curve (Daniel, 11.11.2026: stick sideways = Leyla runs a bend, she stays, the road bends softly and straightens without input):
  // -1 … 1, eased toward the stick / arrow keys; the road is pushed sideways by bend(z) metres, the background pans with the horizon
  const CV = { enabled: true, pan: 6, in: 1.4, out: 0.9, ...(S.curve || {}) }, steer = { aim: 0, v: 0, keys: 0 };
  if (CV.enabled !== false) {
    addEventListener('keydown', e => { if (e.key === 'ArrowLeft') steer.keys = -1; if (e.key === 'ArrowRight') steer.keys = 1; });
    addEventListener('keyup', e => { if ((e.key === 'ArrowLeft' && steer.keys < 0) || (e.key === 'ArrowRight' && steer.keys > 0)) steer.keys = 0; });
  }
  let bendA = 0, bendZ = 1.5;
  const bend = z => bendA * (z - bendZ) * (z - bendZ);

  // ground: pebbles (squares) and cracks (flat strokes), x in "screen widths at depth 1"
  const rnd = (a, b) => a + Math.random() * (b - a);
  const speck = (z = rnd(Z_NEAR, Z_FAR)) => ({ x: rnd(-1.6, 1.6), z, w: Math.random() < 0.25 ? Math.round(rnd(2, 5)) : 1, s: Math.random() < 0.15 ? 2 : 1, a: rnd(0.45, 1) });
  const specks = Array.from({ length: G.specks | 0 }, () => speck());
  const dust = [];
  let lastFrame = -1, last = performance.now();

  // a little surprise (Ava, 11.11.2026 – Daniel: „bau eine visuelle Kleinigkeit in den Homescreen ein“): now and then a tumbleweed
  // bounces across the highway behind Leyla and rolls off into the distance, and a shooting star crosses the evening sky.
  // Both from code, pixel sharp. splash.surprise() starts both at once (tests, or just for fun: click the sky).
  const weed = (() => {   // 18 x 18 background pixels of tangled twigs, drawn once
    const c = document.createElement('canvas'); c.width = c.height = 18;
    const x = c.getContext('2d'), cols = ['#796755', '#a08662', '#5a4e44', '#c7b08b'];
    for (let i = 0; i < 190; i++) { const a = Math.random() * 6.28, r = 1.5 + Math.sqrt(Math.random()) * 6.8; x.fillStyle = cols[i % 4]; x.fillRect(Math.round(9 + Math.cos(a) * r), Math.round(9 + Math.sin(a) * r), 1, 1); }
    for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28; x.fillStyle = cols[i % 3]; for (let t = 0; t < 7; t++) x.fillRect(Math.round(9 + Math.cos(a + t * 0.4) * (3 + t * 0.8)), Math.round(9 + Math.sin(a + t * 0.4) * (3 + t * 0.6)), 1, 1); }
    return c;
  })();
  let tumble = null, star = null, nextTumble = performance.now() + 9000 + Math.random() * 9000, nextStar = performance.now() + 5000 + Math.random() * 12000;
  const surprise = () => { nextTumble = nextStar = 0; };
  canvas.addEventListener('click', e => { if (e.clientY < innerHeight * (S.horizon ?? 60) / 100) nextStar = 0; });

  function haze(t, horizon, sc) {
    const hy = Math.round(horizon), p = Math.max(1, Math.round(sc));
    // heat shimmer: rows of background pixels around the horizon slide sideways a little, strongest at the horizon
    const bandH = Math.round(HZ.band * sc), y0 = Math.max(0, hy - bandH), y1 = Math.min(H, hy + Math.round(p * 3));
    if (HZ.shimmer > 0 && !still && y1 > y0) {
      if (bandCv.width !== W || bandCv.height !== y1 - y0) Object.assign(bandCv, { width: W, height: y1 - y0 });
      const bc = bandCv.getContext('2d'); bc.clearRect(0, 0, W, y1 - y0); bc.drawImage(canvas, 0, y0, W, y1 - y0, 0, 0, W, y1 - y0);
      for (let y = y0; y < y1; y += p) {
        const k = 1 - Math.min(1, Math.abs(hy - y) / Math.max(1, bandH));   // 1 at the horizon
        const dx = Math.round(Math.sin(t * HZ.speed * 2.3 + y * 0.09) * Math.sin(t * HZ.speed * 0.7 + y * 0.023) * HZ.shimmer * k * k) * p;
        if (dx) ctx.drawImage(bandCv, 0, y - y0, W, p, dx, y, W, p);
      }
    }
    // dithered fade: the ground colour reaches up into the picture (cached per size)
    const rows = Math.max(1, Math.round(HZ.fade)), cols = Math.ceil(W / p), key = [W, p, rows, G.base].join(',');
    if (key !== fadeKey) {
      fadeKey = key; Object.assign(fadeCv, { width: cols, height: rows });
      const fc = fadeCv.getContext('2d'), img = fc.createImageData(cols, rows), n = parseInt(G.base.slice(1), 16);
      const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const a = (y + 1) / (rows + 1), o = (y * cols + x) * 4;   // more ground towards the bottom
        if (a * 16 > B[(y & 3) * 4 + (x & 3)] + 0.5) { img.data[o] = n >> 16 & 255; img.data[o + 1] = n >> 8 & 255; img.data[o + 2] = n & 255; img.data[o + 3] = 255; }
      }
      fc.putImageData(img, 0, 0);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fadeCv, 0, hy - rows * p, cols * p, rows * p);
    // warm haze line, breathing slowly
    if (HZ.glow > 0) {
      const n = parseInt(HZ.color.slice(1), 16), c = `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`, a = HZ.glow / 100 * (0.8 + 0.2 * Math.sin(t * 0.8));
      const g = ctx.createLinearGradient(0, hy - bandH, 0, hy + p * 6);
      g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.75, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, hy - bandH, W, bandH + p * 6);
    }
  }

  function drawDrone(t, now) {
    if (!still && now > drone.next) {   // next random mood
      const m = droneMoods[Math.floor(Math.random() * droneMoods.length)];
      if (m) {
        const len = m.duration > 0 ? Math.max(m.duration, 1400) : 2600;
        Object.assign(drone, { frame: m.frame ?? 0, until: now + len, bubble: DR.bubble?.show !== false ? m.kaomoji || '' : '', bubbleUntil: now + Math.max(len, 1800) });
      }
      const [a, b] = SD.every; drone.next = now + (a + Math.random() * Math.max(0, (b ?? a) - a)) * 1000 + 1500;
    }
    if (now > drone.until) drone.frame = 0;
    const [fw, fh] = droneA.frameSize || [droneImg.width, droneImg.height], [ox, oy] = droneA.origin || [fw / 2, fh / 2];
    const wide = W / H > 1.15, k = H * SD.height / 100 / fh * (wide ? 1 : 0.75);
    const drift = Math.sin(t * 0.37) * 0.018 * W, bob = Math.sin(t * 2.1) * SD.bob / 100 * H;
    const x = W * (wide ? SD.at[0] : Math.max(20, 50 - (68 - SD.at[0]) * 2.6)) / 100 + drift - look.x * W * 0.008, y = H * (SD.at[1] + (wide ? 0 : 7)) / 100 + bob - look.y * H * 0.006;
    const rot = Math.cos(t * 0.37) * 0.06 + Math.cos(t * 2.1) * 0.03, px = Math.round(x), py = Math.round(y);
    if (cables.list.length) {   // behind the hull, in screen pixels
      const dtc = lastDrone ? Math.min(50, now - lastDrone) : 16; lastDrone = now;
      cables.step(dtc, hullPoint(px, py, rot, 1, k, ox, oy), k);
      const out = DR.cable?.outline || '#060608';
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const pass of [0, 1]) for (const c of cables.lines()) {
        ctx.strokeStyle = pass ? c.color : out; ctx.lineWidth = c.width * k + (pass ? 0 : 2 * k);
        ctx.beginPath(); ctx.moveTo(c.pts[0][0], c.pts[0][1]); for (const [qx, qy] of c.pts.slice(1)) ctx.lineTo(qx, qy); ctx.stroke();
      }
    }
    ctx.save(); ctx.imageSmoothingEnabled = !faceImg; ctx.translate(px, py); ctx.rotate(rot);
    const part = front => { for (const { r, a, img } of parts) if ((r.layer !== 'behind') === front) {
      const [qx, qy] = a.origin || [img.width / 2, img.height / 2], [ax, ay] = r.at || [ox, oy];
      ctx.drawImage(img, (ax - ox - qx) * k, (ay - oy - qy) * k, img.width * k, img.height * k);
    } };
    part(false);
    ctx.drawImage(droneImg, (faceImg ? 0 : drone.frame) * fw, 0, fw, fh, -ox * k, -oy * k, fw * k, fh * k);
    if (faceImg) {
      const B = DR.face.blink || {}, [cw, ch] = faceA.frameSize || [faceImg.width, faceImg.height], [cx, cy] = faceA.origin || [cw / 2, ch / 2], [sx, sy] = DR.face.screen || [ox, oy];
      if (now > blinkAt) { const [a, b] = B.every || [2.5, 6]; blinkAt = now + (a + Math.random() * (b - a)) * 1000; blinkUntil = now + (B.duration ?? 130); }
      const fr = !drone.frame && now < blinkUntil && B.frame != null ? B.frame : drone.frame || (DR.moods || []).find(m => m.mood === 'idle')?.frame || 0;
      ctx.globalAlpha = DR.face.flicker && Math.random() < 0.06 ? 1 - DR.face.flicker / 100 * Math.random() : 1;
      ctx.drawImage(faceImg, fr * cw, 0, cw, ch, (sx - ox - cx) * k, (sy - oy - cy) * k, cw * k, ch * k);
      ctx.globalAlpha = 1;
      if (glassImg) ctx.drawImage(glassImg, 0, 0, glassImg.width, glassImg.height, -ox * k, -oy * k, glassImg.width * k, glassImg.height * k);
    }
    part(true);
    ctx.restore(); ctx.imageSmoothingEnabled = false;
    if (drone.bubble && now < drone.bubbleUntil) {
      const B = DR.bubble || {}, size = Math.round(Math.max(14, H * 0.028)), fade = Math.min(1, (drone.bubbleUntil - now) / 300);
      ctx.font = `${size}px VT323, monospace`; const tw = ctx.measureText(drone.bubble).width, pad = size * 0.4;
      const bx = Math.round(x + fw * k * 0.15), by = Math.round(y - oy * k - size * 1.3);
      ctx.globalAlpha = fade; ctx.fillStyle = B.background || '#140c1c';
      ctx.beginPath(); ctx.roundRect(bx - pad, by - size * 0.95, tw + pad * 2, size * 1.35, size * 0.3); ctx.fill();
      ctx.fillStyle = B.color || '#7ff6ff'; ctx.textBaseline = 'alphabetic'; ctx.fillText(drone.bubble, bx, by + size * 0.1);
      ctx.globalAlpha = 1;
    }
  }

  // textured ground ("mode 7"): every row of background pixels below the horizon is one depth z,
  // every column one sideways position; the texture lies flat, G.width metres wide, and rolls away by `roll` metres
  function drawGround(horizon, top, K, px) {
    const y0 = Math.round(horizon), cols = Math.ceil(W / px), rows = Math.ceil((H - y0) / px);
    if (rows <= 0) return;
    if (!groundData || groundData.width !== cols || groundData.height !== rows) {
      Object.assign(groundCv, { width: cols, height: rows }); groundData = groundCtx.createImageData(cols, rows);
    }
    const out = new Uint32Array(groundData.data.buffer), { w: tw, h: th, px: tp } = tex;
    const gw = Math.max(0.1, G.width), edge = Math.max(1, Math.min(G.edge | 0, tw >> 1)), focal = W * Z_NEAR;
    const [fr, fg, fb] = rgb(G.fog || G.base), fog0 = Math.min(G.fogFrom, Z_FAR - 1);
    for (let r = 0; r < rows; r++) {
      const z = Math.min(Z_FAR, K / Math.max(1e-3, y0 + (r + 0.5) * px - top));
      const fog = Math.pow(Math.max(0, Math.min(1, (z - fog0) / (Z_FAR - fog0))), 0.6), keep = 1 - fog;
      const ty = ((Math.floor((z - roll) / gw * tw) % th) + th) % th, row = ty * tw;
      const scale = z / focal * tw / gw, base = (0.5 - W / 2 / focal * z / gw - (G.shift + bend(z)) / gw) * tw;
      for (let c = 0; c < cols; c++) {
        let tx = Math.floor(base + (c + 0.5) * px * scale);
        if (tx < 0) tx = ((tx % edge) + edge) % edge;                          // left edge repeats outwards
        else if (tx >= tw) tx = tw - edge + (tx - tw) % edge;                  // right edge repeats outwards
        const p = tp[row + tx];
        out[r * cols + c] = fog ? (0xff000000 | Math.round((p >> 16 & 255) * keep + fb * fog) << 16 | Math.round((p >> 8 & 255) * keep + fg * fog) << 8 | Math.round((p & 255) * keep + fr * fog)) >>> 0 : p | 0xff000000;
      }
    }
    groundCtx.putImageData(groundData, 0, 0);
    ctx.drawImage(groundCv, 0, y0, cols * px, rows * px);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = still ? 0 : now / 1000;
    // layout
    const horizon = H * (S.horizon ?? 80) / 100;
    const bw = layers[0]?.width || 576, bh = layers[0]?.height || 324;
    const par = (S.parallax ?? 2) / 100;
    const pan = CV.enabled !== false ? (CV.pan ?? 6) / 100 : 0;
    const sc = Math.max(W / bw, horizon / bh) * (1 + par * 2 + pan * 2);   // cover + room for the parallax and the bend
    const px = Math.max(1, Math.round(sc));                        // size of one background pixel for the ground details
    if (now - aim.at > 4000) { aim.x = Math.sin(t * 0.17) * 0.5; aim.y = Math.sin(t * 0.11) * 0.3; }
    look.x += (aim.x - look.x) * Math.min(1, dt * 3); look.y += (aim.y - look.y) * Math.min(1, dt * 3);
    const want = Math.max(-1, Math.min(1, steer.aim || steer.keys)), rate = want ? CV.in ?? 1.4 : CV.out ?? 0.9;
    steer.v += Math.sign(want - steer.v) * Math.min(Math.abs(want - steer.v), rate * dt);
    const ease = steer.v * (2 - Math.abs(steer.v)), shiftH = ease * pan * W;   // soft in and out; how far the horizon wanders

    // background, front layers move most
    ctx.fillStyle = G.base; ctx.fillRect(0, 0, W, H);
    const lx = Math.round((W - bw * sc) / 2), ly = Math.round(horizon - bh * sc);   // where layer 0 sits
    if (weather) {   // sky in background pixels from the top of the screen down to the horizon, the picture box inside it
      const cw = Math.ceil(W / sc) + 2, ch = Math.ceil(horizon / sc) + 1, bx = -lx / sc, by = ch - bh;
      if (skyCv.width !== cw || skyCv.height !== ch) Object.assign(skyCv, { width: cw, height: ch });
      weather.sky(skyCv.getContext('2d'), cw, ch, t, { x: bx, y: by, w: bw, h: bh });
      ctx.drawImage(skyCv, 0, Math.round(horizon - ch * sc), Math.round(cw * sc), Math.round(ch * sc));
    }
    if (!still && now >= nextStar && !star) { star = { t: 0, x: 0.15 + Math.random() * 0.6, y: 0.05 + Math.random() * 0.18, d: Math.random() < 0.5 ? -1 : 1 }; nextStar = now + 18000 + Math.random() * 25000; }
    if (star) {   // a short white streak with a fading tail, crossing the sky in under a second
      star.t += dt;
      const p = star.t / 0.9, m = Math.max(1, Math.round(sc)), len = 18;
      if (p >= 1) star = null;
      else for (let i = 0; i < len; i++) {
        const q = p - i * 0.012; if (q < 0) break;
        const x = (star.x + star.d * q * 0.28) * W, y = (star.y + q * 0.12) * horizon;
        ctx.globalAlpha = (1 - i / len) * Math.sin(Math.min(1, p) * Math.PI); ctx.fillStyle = i < 2 ? '#ffffff' : '#fef3c0';
        ctx.fillRect(Math.round(x / m) * m, Math.round(y / m) * m, m, m);
      }
      ctx.globalAlpha = 1;
    }
    layers.forEach((img, i) => {
      const depth = layers.length > 1 ? i / (layers.length - 1) : 0;
      const ox = -look.x * par * W * depth + shiftH, oy = -look.y * par * 0.4 * H * depth;
      ctx.drawImage(img, Math.round((W - bw * sc) / 2 + ox), Math.round(horizon - bh * sc + oy + par * 0.4 * H * depth), Math.round(bw * sc), Math.round(bh * sc));
    });
    ctx.fillStyle = G.base; ctx.fillRect(0, Math.round(horizon), W, H);

    // ground projection: y = top + K / z, so z = Z_FAR sits on the horizon and Z_NEAR just below the bottom edge
    const K = (H + 4 * px - horizon) / (1 / Z_NEAR - 1 / Z_FAR), top = horizon - K / Z_FAR;
    // the bend: zero under Leyla's feet, at the horizon as far as the background panned (screen x = metres × W·Z_NEAR / z)
    bendZ = K / Math.max(1, H * (S.runnerFeet ?? 94) / 100 - top);
    bendA = shiftH / (W * Z_NEAR / Z_FAR) / Math.max(1, (Z_FAR - bendZ) ** 2);
    if (tex) { if (!still) roll += G.speed * pace * dt; drawGround(horizon, top, K, px); }
    if (HZ.enabled) haze(t, horizon, sc);
    const project = (x, z) => [W / 2 + (x + bend(z)) * W * (Z_NEAR / z), top + K / z];

    // Leyla
    if (gaitStart === 0) { gaitStart = now; planSwitch(now); }
    if (!still && now > nextSwitch && gaits.length > 1 && Math.floor((now - gaitStart) / 1000 * (run?.fps || 5)) % (run?.frames || 1) === 0) {
      gait = pick(gait); run = gait.a; runImg = gait.img; gaitStart = now; planSwitch(now);   // switch at the start of a cycle
    }
    pace += ((gait?.speed ?? 1) - pace) * Math.min(1, dt * 2);   // ground speed eases to the new gait
    const fps = run?.fps || 5, n = run?.frames || 1, [fw, fh] = run?.frameSize || [96, 256], [ax, ay] = run?.origin || [fw / 2, fh];
    const f = still ? 0 : Math.floor((now - gaitStart) / 1000 * fps) % n;
    let k = H * (S.runnerHeight ?? 46) / 100 / fh;
    k = k * dpr >= 1 ? Math.round(k * dpr * 2) / 2 / dpr : k;   // whole or half device pixels per pixel: stays sharp
    const wide = W / H > 1.15;
    const cx = W * (wide ? (S.runnerX ?? 68) : 50) / 100, feet = H * (S.runnerFeet ?? 94) / 100;
    const zFeet = K / Math.max(1, feet - top);

    // move the world
    if (!still) {
      for (const s of specks) { s.z += G.speed * pace * dt * (s.z / 6 + 0.35); if (s.z > Z_FAR) Object.assign(s, speck(Z_NEAR)); }
      if (f !== lastFrame && G.dust && (f % Math.max(1, Math.round(n / 2)) === 0)) for (let i = 0; i < 3; i++)
        dust.push({ x: (cx - W / 2) / W / (Z_NEAR / zFeet) + rnd(-0.03, 0.03), z: zFeet + rnd(0, 0.15), up: 0, vy: rnd(0.4, 0.9), r: rnd(1.5, 3), life: 1 });
      lastFrame = f;
      for (const d of dust) { d.z += G.speed * pace * dt * (d.z / 6 + 0.35); d.up += d.vy * dt; d.life -= dt * 0.9; }
      while (dust.length && dust[0].life <= 0) dust.shift();
    }
    const drawSpecks = front => {
      ctx.fillStyle = G.color;
      for (const s of specks) {
        if ((s.z < zFeet) !== front) continue;
        const [x, y] = project(s.x, s.z), m = Math.max(1, Math.round(px * (Z_NEAR * 6) / s.z));   // pixel size shrinks with distance
        ctx.globalAlpha = s.a * Math.min(1, (Z_FAR - s.z) / 8);
        ctx.fillRect(Math.round(x / m) * m, Math.round(y / m) * m, s.w * s.s * m, s.s * m);
      }
      ctx.globalAlpha = 1;
    };
    drawSpecks(false);
    if (!still && now >= nextTumble && !tumble) { const d = Math.random() < 0.5 ? -1 : 1; tumble = { x: -d * 2.6, z: zFeet + 0.6 + Math.random() * 1.6, d, a: 0, h: 0, vh: 0 }; nextTumble = now + 22000 + Math.random() * 30000; }
    const drawTumble = front => {
      if (!tumble || (tumble.z < zFeet) !== front) return;
      const T = tumble, [x, y] = project(T.x, T.z), m = Math.max(1, Math.round(px * (Z_NEAR * 13) / T.z) / 2), size = 18 * m;
      ctx.save(); ctx.translate(Math.round(x), Math.round(y - size / 2 - T.h * m * 6)); ctx.rotate(T.a); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(weed, -size / 2, -size / 2, size, size); ctx.restore();
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x - size * 0.35), Math.round(y - m), Math.round(size * 0.7), Math.round(m * 2)); ctx.globalAlpha = 1;
    };
    if (tumble && !still) {   // it rolls sideways, hops, and the ground carries it away like everything else
      const T = tumble;
      T.x += T.d * 1.5 * dt; T.z += G.speed * pace * dt * (T.z / 6 + 0.35); T.a += T.d * dt * 7;
      T.vh -= 9 * dt; T.h = Math.max(0, T.h + T.vh * dt); if (!T.h) T.vh = 1.6 + Math.random() * 1.4;
      if (Math.abs(T.x) > 3.2 || T.z > Z_FAR * 0.6) tumble = null;
    }
    drawTumble(false);
    for (const d of dust) {   // little clouds of ground colour, lighter
      const [x, y] = project(d.x, d.z), m = Math.max(1, Math.round(px * 0.6 * zFeet / d.z)), r = Math.round(d.r * (1 + (1 - d.life)));
      ctx.globalAlpha = Math.max(0, d.life) * 0.55; ctx.fillStyle = G.color;
      for (let i = -r; i <= r; i++) ctx.fillRect(Math.round((x + i * m) / m) * m, Math.round((y - d.up * m * 6 - (r - Math.abs(i)) * m * 0.6) / m) * m, m, Math.max(1, r - Math.abs(i)) * m);
    }
    ctx.globalAlpha = 1;
    if (G.shadow) {   // flat pixel shadow, breathes with the steps
      const sw = fw * k * (0.5 + 0.06 * Math.sin(t * fps * Math.PI)), m = Math.max(1, Math.round(k * dpr) / dpr);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      for (let i = 0; i < 3; i++) { const w = sw * (1 - i * 0.22); ctx.fillRect(Math.round(cx - w / 2), Math.round(feet - m * (1 - i)), Math.round(w), Math.round(m * 2)); }
    }
    if (droneImg) drawDrone(t, now);   // behind Leyla
    if (runImg) ctx.drawImage(runImg, f * fw, 0, fw, fh, Math.round(cx - ax * k), Math.round(feet - ay * k), Math.round(fw * k), Math.round(fh * k));
    drawSpecks(true);
    drawTumble(true);
    if (weather?.rain) {   // rain in front of everything
      const rw = Math.ceil(W / sc), rh = Math.ceil(H / sc);
      if (rainCv.width !== rw || rainCv.height !== rh) Object.assign(rainCv, { width: rw, height: rh });
      const rc = rainCv.getContext('2d'); rc.clearRect(0, 0, rw, rh);
      weather.front(rc, rw, rh, t, still ? 0 : dt);
      ctx.drawImage(rainCv, 0, 0, Math.round(rw * sc), Math.round(rh * sc));
    }
    if (!still) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { surprise, tumble: () => !!tumble, star: () => !!star, steer: v => { steer.aim = v; }, curve: () => +steer.v.toFixed(3), still, weather: S.weather || null, drone: !!droneImg, droneFrame: () => drone.frame, layers: layers.length, runner: !!runImg, gaits: gaits.length, gait: () => run?.name, commit: cloud?.commit || null };
}

function load(src) {
  return new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
}

// Start page: background layers (pixel art, scaled sharp), Leyla running endlessly towards us, the ground sliding away under her.
// Everything comes from the area "Startseite" (data/splash.json) and the assets it points to.
// Online the data come live from the repository (/api/files), like in the game; otherwise the delivered files.
//
// Picture: Leyla and the camera move towards the viewer at the same speed, so the ground recedes:
// pebbles and cracks appear at the bottom edge and slide up to the horizon, getting smaller. Dust from her steps stays behind.
import { cloudFiles } from '../cloud_store.js';

const BASE = new URL('../../projects/nomadgirl/', import.meta.url);
const Z_NEAR = 0.6, Z_FAR = 40;   // depth range of the ground (m)

export async function startSplash(canvas) {
  const cloud = await cloudFiles();
  const json = async f => cloud?.files.has(f) ? cloud.files.get(f) : (await fetch(new URL(f, BASE), { cache: 'no-store' })).json();
  const [S, A] = await Promise.all([json('data/splash.json'), json('data/assets.json')]);
  const image = id => A[id]?.file ? load(new URL(A[id].file, BASE).href) : Promise.resolve(null);
  const layers = (await Promise.all((S.background || []).map(image))).filter(Boolean);
  const run = A[S.runner], runImg = await image(S.runner);
  const G = { speed: 6, specks: 140, color: '#4a4256', base: '#292330', dust: true, shadow: true, ...(S.ground || {}) };
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

  // ground: pebbles (squares) and cracks (flat strokes), x in "screen widths at depth 1"
  const rnd = (a, b) => a + Math.random() * (b - a);
  const speck = (z = rnd(Z_NEAR, Z_FAR)) => ({ x: rnd(-1.6, 1.6), z, w: Math.random() < 0.25 ? Math.round(rnd(2, 5)) : 1, s: Math.random() < 0.15 ? 2 : 1, a: rnd(0.45, 1) });
  const specks = Array.from({ length: G.specks | 0 }, () => speck());
  const dust = [];
  let lastFrame = -1, last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = still ? 0 : now / 1000;
    // layout
    const horizon = H * (S.horizon ?? 80) / 100;
    const bw = layers[0]?.width || 576, bh = layers[0]?.height || 324;
    const par = (S.parallax ?? 2) / 100;
    const sc = Math.max(W / bw, horizon / bh) * (1 + par * 2);   // cover + room for the parallax
    const px = Math.max(1, Math.round(sc));                        // size of one background pixel for the ground details
    if (now - aim.at > 4000) { aim.x = Math.sin(t * 0.17) * 0.5; aim.y = Math.sin(t * 0.11) * 0.3; }
    look.x += (aim.x - look.x) * Math.min(1, dt * 3); look.y += (aim.y - look.y) * Math.min(1, dt * 3);

    // background, front layers move most
    ctx.fillStyle = G.base; ctx.fillRect(0, 0, W, H);
    layers.forEach((img, i) => {
      const depth = layers.length > 1 ? i / (layers.length - 1) : 0;
      const ox = -look.x * par * W * depth, oy = -look.y * par * 0.4 * H * depth;
      ctx.drawImage(img, Math.round((W - bw * sc) / 2 + ox), Math.round(horizon - bh * sc + oy + par * 0.4 * H * depth), Math.round(bw * sc), Math.round(bh * sc));
    });
    ctx.fillStyle = G.base; ctx.fillRect(0, Math.round(horizon), W, H);

    // ground projection: y = top + K / z, so z = Z_FAR sits on the horizon and Z_NEAR just below the bottom edge
    const K = (H + 4 * px - horizon) / (1 / Z_NEAR - 1 / Z_FAR), top = horizon - K / Z_FAR;
    const project = (x, z) => [W / 2 + x * W * (Z_NEAR / z), top + K / z];

    // Leyla
    const fps = run?.fps || 5, n = run?.frames || 1, [fw, fh] = run?.frameSize || [96, 256], [ax, ay] = run?.origin || [fw / 2, fh];
    const f = still ? 0 : Math.floor(t * fps) % n;
    let k = H * (S.runnerHeight ?? 46) / 100 / fh;
    k = k * dpr >= 1 ? Math.round(k * dpr * 2) / 2 / dpr : k;   // whole or half device pixels per pixel: stays sharp
    const wide = W / H > 1.15;
    const cx = W * (wide ? (S.runnerX ?? 68) : 50) / 100, feet = H * (S.runnerFeet ?? 94) / 100;
    const zFeet = K / Math.max(1, feet - top);

    // move the world
    if (!still) {
      for (const s of specks) { s.z += G.speed * dt * (s.z / 6 + 0.35); if (s.z > Z_FAR) Object.assign(s, speck(Z_NEAR)); }
      if (f !== lastFrame && G.dust && (f % Math.max(1, Math.round(n / 2)) === 0)) for (let i = 0; i < 3; i++)
        dust.push({ x: (cx - W / 2) / W / (Z_NEAR / zFeet) + rnd(-0.03, 0.03), z: zFeet + rnd(0, 0.15), up: 0, vy: rnd(0.4, 0.9), r: rnd(1.5, 3), life: 1 });
      lastFrame = f;
      for (const d of dust) { d.z += G.speed * dt * (d.z / 6 + 0.35); d.up += d.vy * dt; d.life -= dt * 0.9; }
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
    if (runImg) ctx.drawImage(runImg, f * fw, 0, fw, fh, Math.round(cx - ax * k), Math.round(feet - ay * k), Math.round(fw * k), Math.round(fh * k));
    drawSpecks(true);
    if (!still) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { still, layers: layers.length, runner: !!runImg, commit: cloud?.commit || null };
}

function load(src) {
  return new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
}

// Loading bar: Leyla and AvA run from left to right as glowing outlines (Spiel › Ladebalken).
// Runs before the project is loaded, so it reads game.json and assets.json straight from the repo files.
// Daniel, 12.11.2026: "überall, wo tatsächlich geladen werden muss oder die Eingabe nicht möglich ist".
// One overlay for the whole page: page load (data 0–30 %, Phaser loader 30–95 %, first frame 100 %),
// camp ↔ run (show → loader → first frame), waits without input (timed: the bar runs over the wait).

const DEFAULTS = { leyla: 'leyla_run_side', drone: 'drone_hull', color: '#3ee8ff', accent: '#ff4fd8', height: 96, width: 70, text: '', fade: 350 };

export function createLoading(root, base) {
  const el = document.createElement('div');
  el.className = 'loading';
  el.innerHTML = '<div class="loading-track"><canvas></canvas><div class="loading-bar"><i></i></div><div class="loading-label"><span class="loading-text"></span><span class="loading-sub"></span><span class="loading-pct">0 %</span></div></div>';
  root.replaceChildren(el);
  root.classList.add('loading-on');
  const canvas = el.querySelector('canvas'), ctx = canvas.getContext('2d'), fill = el.querySelector('.loading-bar i');
  const pct = el.querySelector('.loading-pct'), text = el.querySelector('.loading-text'), track = el.querySelector('.loading-track');
  let cfg = { ...DEFAULTS }, leyla = null, drone = null, target = 0.02, shown = 0, finished = false, failed = false, raf = 0, t0 = performance.now();
  let visible = true, withDrone = true, timed = null, hideTimer = 0, last = 0;

  (async () => {
    try {
      const [game, assets] = await Promise.all(['data/game.json', 'data/assets.json'].map(f => fetch(new URL(f, base)).then(r => r.json())));
      cfg = { ...cfg, ...Object.fromEntries(Object.entries(game.loading || {}).filter(([, v]) => v !== '' && v != null)) };
      if (!text.textContent) text.textContent = cfg.text || '';
      track.style.width = `min(${cfg.width}vw, 1100px)`;
      track.style.setProperty('--load-color', cfg.color); track.style.setProperty('--load-accent', cfg.accent);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      [leyla, drone] = await Promise.all([outline(assets[cfg.leyla], base, cfg.height, cfg.color, dpr), outline(assets[cfg.drone], base, cfg.height * 0.55, cfg.accent, dpr)]);
    } catch (e) { console.warn('Ladebalken ohne Figuren:', e.message); }
  })();

  function frame(now) {
    if (timed) target = Math.max(target, 0.95 * Math.min(1, (now - timed.at) / timed.ms));
    // time based, so a stuttering first second of the game does not hold the bar up
    const dt = Math.min(0.25, Math.max(0, (now - (last || now)) / 1000)); last = now;
    shown += (target - shown) * (1 - Math.exp(-dt * 5));
    if (finished) shown = 1;
    const p = Math.min(1, shown);
    fill.style.width = `${(p * 100).toFixed(1)}%`;
    pct.textContent = `${Math.floor(p * 100)} %`;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = track.clientWidth, h = cfg.height * 1.3;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const t = (now - t0) / 1000;
    if (leyla) {
      const f = leyla.frames[Math.floor(t * leyla.fps) % leyla.frames.length];
      const room = canvas.width - f.width - (drone ? drone.frames[0].width * 1.1 : 0);
      const lx = Math.max(0, room * p), ly = canvas.height - f.height;
      ctx.drawImage(f, lx, ly);
      if (drone && withDrone) {   // AvA flies a little ahead, bobbing
        const d = drone.frames[0];
        const dx = lx + f.width * 0.95 + Math.sin(t * 2.1) * 5 * dpr, dy = Math.max(0, ly - d.height * 0.15) + (1 + Math.sin(t * 3.3)) * 5 * dpr;
        ctx.drawImage(d, dx, dy);
      }
    }
    if (finished) return close();   // full bar for one frame, then the CSS fade (independent of the frame rate)
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function close() {
    visible = false; raf = 0; last = 0;
    root.classList.add('loading-gone');
    hideTimer = setTimeout(() => root.classList.remove('loading-on'), cfg.fade);
  }

  const api = {
    get visible() { return visible; },
    // opens the overlay again: text (empty = Spiel › Ladebalken › Text), sub line, drone false = AvA is gone, ms = timed wait
    show({ text: t = '', sub = '', drone: d = true, ms = 0 } = {}) {
      if (failed) return api;
      clearTimeout(hideTimer);
      text.textContent = t || cfg.text || ''; el.querySelector('.loading-sub').textContent = sub;
      withDrone = d; timed = ms > 0 ? { at: performance.now(), ms } : null;
      if (!visible) { target = 0.04; shown = 0; finished = false; t0 = performance.now(); }
      visible = true;
      root.classList.add('loading-on'); root.classList.remove('loading-gone');
      if (!raf) raf = requestAnimationFrame(frame);
      return api;
    },
    data() { target = Math.max(target, 0.3); },
    progress(p) { if (visible && !finished) target = Math.max(target, 0.3 + 0.65 * p); },
    done() {   // close right away: the first frames of a scene are the slowest, waiting for them makes the start feel long
      if (failed || !visible) return;
      finished = true; timed = null; target = shown = 1;
      fill.style.width = '100%'; pct.textContent = '100 %';
      cancelAnimationFrame(raf); close();
    },
    fail(msg) { failed = true; cancelAnimationFrame(raf); root.classList.add('loading-on'); root.textContent = msg; root.classList.add('load-error'); },
  };
  return api;
}

// Draws every frame of an asset as an outline only (alpha edge, a little thick) in one color.
async function outline(asset, base, height, color, dpr) {
  if (!asset?.file) return null;
  const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error(asset.file)); i.src = new URL(asset.file, base).href; });
  const n = asset.frames || 1, [fw, fh] = asset.frameSize || [img.naturalWidth / n, img.naturalHeight];
  const s = (height * dpr) / fh, w = Math.max(1, Math.round(fw * s)), h = Math.max(1, Math.round(fh * s)), line = Math.max(1, Math.round(1.5 * dpr));
  const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  const frames = [];
  for (let k = 0; k < n; k++) {
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    const sc = src.getContext('2d'); sc.imageSmoothingEnabled = true;
    sc.drawImage(img, (k * fw) % img.naturalWidth, Math.floor((k * fw) / img.naturalWidth) * fh, fw, fh, 0, 0, w, h);
    const a = sc.getImageData(0, 0, w, h).data, solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 90;
    const out = sc.createImageData(w, h), o = out.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      let edge = false;
      for (let d = 1; d <= line && !edge; d++) edge = !solid(x - d, y) || !solid(x + d, y) || !solid(x, y - d) || !solid(x, y + d);
      if (!edge) continue;
      const i = (y * w + x) * 4; o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = 255;
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cc = c.getContext('2d'); cc.putImageData(out, 0, 0);
    // soft glow: the outline once more, blurred, behind itself
    const glow = document.createElement('canvas'); glow.width = w; glow.height = h;
    const gc = glow.getContext('2d'); gc.filter = `blur(${2 * dpr}px)`; gc.drawImage(c, 0, 0); gc.filter = 'none'; gc.drawImage(c, 0, 0);
    frames.push(glow);
  }
  return { frames, fps: asset.fps || 12 };
}

// Intro as a comic (Daniel, 12.11.2026, after his storyboard): panels appear one after another on comic pages,
// captions type themselves letter by letter, a slow camera move and small effects from code bring the pictures to life.
// Everything comes from the area "Intro" (data/intro.json, one entry per panel) and Startseite › Intro (data/splash.json).
// Started only from the main menu (intro.html, online /intro). Next: Enter, Space, →, click, A/RB; back: ←, LB; skip: Esc, B, Start.
import { cloudFiles } from '../cloud_store.js';

const BASE = new URL('../../projects/nomadgirl/', import.meta.url);
const PW = 1920, PH = 1080;   // a comic page in logical pixels (16:9)
const DEFAULTS = { typing: 45, appear: 0.45, dim: 35, cameraZoom: 8, cameraTime: 14, title: 'NomadGirl', subtitle: '' };
const SPEAKER_COLOR = { Leyla: '#e86a73', AvA: '#20d6c7' };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t), 3);
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export async function startIntro(canvas, { onEnd = () => {}, startAt = null } = {}) {
  const cloud = await cloudFiles();
  const json = async f => cloud?.files.has(f) ? cloud.files.get(f) : (await fetch(new URL(f, BASE), { cache: 'no-store' })).json();
  const [I, A, S] = await Promise.all([json('data/intro.json'), json('data/assets.json'), json('data/splash.json').catch(() => ({}))]);
  const C = { ...DEFAULTS, ...(S.intro || {}) };
  const panels = Object.entries(I).map(([id, x]) => ({ id, ...x })).filter(p => (p.size?.[0] ?? 0) > 0)
    .sort((a, b) => (a.page ?? 1) - (b.page ?? 1) || (a.order ?? 0) - (b.order ?? 0));
  const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  await Promise.all(panels.map(async p => { p.img = A[p.look]?.file ? await load(new URL(A[p.look].file, BASE).href) : null; }));
  try { await document.fonts.load('40px VT323'); } catch { /* fallback font */ }

  const ctx = canvas.getContext('2d');
  const halftone = makeHalftone();
  // where we are: panel index, caption index inside it, when things started (ms)
  let idx = -1, cap = 0, capAt = 0, doneAt = 0, pageAt = 0, ended = false, endAt = 0, left = false;
  const shownAt = new Map();
  const now = () => performance.now();
  const P = () => panels[idx];
  const captions = p => p?.captions || [];
  const typed = (p, i, t) => i < cap || p !== P() ? Infinity : i > cap ? 0 : (t - capAt) * C.typing / 1000;
  const capDone = t => { const c = captions(P())[cap]; return !c || typed(P(), cap, t) >= c.text.length; };

  function show(i, t = now()) {
    const prevPage = P()?.page;
    idx = i; cap = 0; capAt = t + C.appear * 600; doneAt = 0;
    if (!shownAt.has(P().id) || P().page !== prevPage) shownAt.set(P().id, t);
    if (prevPage !== undefined && P().page !== prevPage) { pageAt = t; for (const p of panels) if (p.page === P().page && p !== P()) shownAt.delete(p.id); }
  }
  function next() {
    const t = now();
    if (ended) { finish(); return; }
    if (idx < 0) { show(0, t); return; }
    const c = captions(P());
    if (cap < c.length && !capDone(t)) { capAt = -1e9; return; }          // finish typing the current box
    if (cap < c.length - 1) { cap++; capAt = t; doneAt = 0; return; }       // next box in this panel
    if (idx < panels.length - 1) { show(idx + 1, t); return; }
    ended = true; endAt = t;
  }
  function back() {
    if (ended) { ended = false; return; }
    if (idx <= 0) return;
    const t = now(), page = P().page;
    shownAt.delete(P().id);
    idx--; cap = Math.max(0, captions(P()).length - 1); capAt = -1e9;
    if (P().page !== page) { pageAt = t; for (const p of panels) if (p.page === P().page && panels.indexOf(p) <= idx) shownAt.set(p.id, t - 1e5); }
  }
  function finish() { if (left) return; left = true; onEnd(); }
  const skip = () => { if (!ended) { ended = true; endAt = now() - 600; } else finish(); };

  // ---------- input: keyboard, mouse/touch, controller ----------
  addEventListener('keydown', e => {
    if (e.repeat) return;
    if (['Enter', ' ', 'ArrowRight', 'd', 'D'].includes(e.key)) { next(); e.preventDefault(); }
    else if (['ArrowLeft', 'a', 'A'].includes(e.key)) back();
    else if (e.key === 'Escape') skip();
  });
  canvas.addEventListener('pointerdown', e => { if (e.button === 0) next(); });
  let padPrev = new Set();
  const pollPad = () => {
    const g = navigator.getGamepads ? [...navigator.getGamepads()].find(p => p && p.connected) : null;
    const down = new Set();
    if (g) g.buttons.forEach((b, i) => { if (b && (b.pressed || b.value > 0.5)) down.add(i); });
    const hit = i => down.has(i) && !padPrev.has(i);
    if (hit(0) || hit(5) || hit(15)) next();
    if (hit(4) || hit(14)) back();
    if (hit(1) || hit(9)) skip();
    padPrev = down;
  };

  // ---------- drawing ----------
  let view = { s: 1, ox: 0, oy: 0 };
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const s = Math.min(w / PW, h / PH) * dpr;
    view = { s, ox: (canvas.width - PW * s) / 2, oy: (canvas.height - PH * s) / 2 };
  };
  addEventListener('resize', resize); resize();
  const rectOf = p => ({ x: p.at[0] / 100 * PW, y: p.at[1] / 100 * PH, w: p.size[0] / 100 * PW, h: p.size[1] / 100 * PH });

  function drawPanel(p, t, focus) {
    const r = rectOf(p), since = (t - shownAt.get(p.id)) / 1000;
    const a = ease(since / Math.max(0.01, C.appear));
    let sc = 0.92 + 0.08 * a, dx = 0, dy = (1 - a) * 30;
    if (p.effect === 'alarm' && since < 1.2) { dx += Math.sin(since * 70) * 6 * (1.2 - since); dy += Math.cos(since * 55) * 4 * (1.2 - since); }
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(r.x + r.w / 2 + dx, r.y + r.h / 2 + dy); ctx.scale(sc, sc); ctx.translate(-r.w / 2, -r.h / 2);
    // frame: black outline, light border, drop shadow
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#060608'; ctx.fillRect(-10, -10, r.w + 20, r.h + 20);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#e3e6ff'; ctx.fillRect(-6, -6, r.w + 12, r.h + 12);
    ctx.fillStyle = '#060608'; ctx.fillRect(-2, -2, r.w + 4, r.h + 4);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, r.w, r.h); ctx.clip();
    drawPicture(p, r, since);
    drawEffect(p, r, since);
    if (p.display?.text || p.display?.sub || p.display?.bar != null) drawDisplay(p.display, r, since);
    if (!focus) { ctx.fillStyle = `rgba(6,6,8,${C.dim / 100})`; ctx.fillRect(0, 0, r.w, r.h); }
    ctx.restore();
    drawCaptions(p, r, t, focus);
    ctx.restore();
  }

  function drawPicture(p, r, since) {
    if (!p.img) { ctx.fillStyle = '#242234'; ctx.fillRect(0, 0, r.w, r.h); return; }
    const c = ease(since / Math.max(1, C.cameraTime)), Z = C.cameraZoom / 100;
    let z = 1, px = 0.5, py = 0.5;
    if (p.camera === 'in') z = 1 + Z * c;
    else if (p.camera === 'out') z = 1 + Z * (1 - c);
    else if (p.camera === 'left') { z = 1 + Z; px = 1 - c; }
    else if (p.camera === 'right') { z = 1 + Z; px = c; }
    else if (p.camera === 'up') { z = 1 + Z; py = 1 - c; }
    const iw = p.img.width, ih = p.img.height, cover = Math.max(r.w / iw, r.h / ih) * z;
    const w = iw * cover, h = ih * cover;
    ctx.imageSmoothingEnabled = cover < 2.2;   // big pixel art stays crisp, gentle moves stay smooth
    ctx.drawImage(p.img, -(w - r.w) * px, -(h - r.h) * py, w, h);
  }

  function drawEffect(p, r, t) {
    const [ex, ey] = (p.effectAt || [50, 50]).map((v, i) => v / 100 * (i ? r.h : r.w)), u = r.h / 540;
    ctx.save();
    if (p.effect === 'bubbles') {
      for (let i = 0; i < 22; i++) {
        const sp = 0.25 + hash(i) * 0.35, ph = (t * sp + hash(i + 50)) % 1;
        const x = ex + (hash(i + 9) - 0.5) * r.w * 0.09 + Math.sin(t * 2 + i) * 3 * u, y = ey + r.h * 0.2 - ph * r.h * 0.42;
        ctx.globalAlpha = 0.65 * Math.sin(ph * Math.PI);
        ctx.strokeStyle = '#cdf7e2'; ctx.lineWidth = 1.5 * u;
        ctx.beginPath(); ctx.arc(x, y, (2 + hash(i + 3) * 4) * u, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (p.effect === 'alarm') {
      const k = Math.pow(Math.sin(t * 3.2), 2);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(r.w * 0.3, 0, 0, r.w * 0.3, 0, r.w * 0.9);
      g.addColorStop(0, `rgba(223,62,35,${0.28 * k})`); g.addColorStop(1, 'rgba(223,62,35,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, r.w, r.h);
    } else if (p.effect === 'dust' || p.effect === 'embers') {
      const ember = p.effect === 'embers', n = ember ? 34 : 46;
      if (ember) {
        const fl = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, r.h * 0.55);
        g.addColorStop(0, `rgba(250,106,10,${0.32 * fl})`); g.addColorStop(1, 'rgba(250,106,10,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, r.w, r.h);
      }
      for (let i = 0; i < n; i++) {
        const sp = (ember ? 0.18 : 0.03) + hash(i) * (ember ? 0.25 : 0.05), ph = (t * sp + hash(i + 77)) % 1;
        const x = ember ? ex + (hash(i + 5) - 0.5) * r.w * 0.12 + Math.sin(t * 1.7 + i) * 14 * u * ph : ((hash(i + 5) + t * 0.012 * (hash(i) - 0.3)) % 1) * r.w;
        const y = ember ? ey - ph * r.h * 0.7 : ((hash(i + 17) - ph * 0.25 + 1) % 1) * r.h;
        ctx.globalAlpha = (ember ? 0.9 * (1 - ph) : 0.35 * Math.sin(ph * Math.PI)) * (0.6 + 0.4 * Math.sin(t * 7 + i));
        ctx.fillStyle = ember ? (hash(i + 2) > 0.5 ? '#f9a31b' : '#fa6a0a') : '#f4d29c';
        const s = (ember ? 2 + hash(i + 8) * 2.5 : 1.5 + hash(i + 8) * 2) * u;
        ctx.fillRect(x, y, s, s);
      }
    } else if (p.effect === 'searchlight') {
      ctx.globalCompositeOperation = 'lighter';
      for (const [bx, by, phase] of [[0.36, 0.3, 0], [0.62, 0.24, 2.1]]) {
        const ang = Math.PI / 2 + Math.sin(t * 0.55 + phase) * 0.75, len = r.h * 1.3, spread = 0.11;
        const x0 = bx * r.w, y0 = by * r.h;
        const g = ctx.createRadialGradient(x0, y0, 0, x0, y0, len);
        g.addColorStop(0, 'rgba(255,252,220,.42)'); g.addColorStop(1, 'rgba(255,252,220,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + Math.cos(ang - spread) * len, y0 + Math.sin(ang - spread) * len);
        ctx.lineTo(x0 + Math.cos(ang + spread) * len, y0 + Math.sin(ang + spread) * len);
        ctx.closePath(); ctx.fill();
      }
    } else if (p.effect === 'glitch') {
      // waking up: dark with flicker and torn rows, then the cyan eye glows steadily
      const wake = clamp((t - 0.3) / 1.6);
      if (wake < 1) {
        ctx.fillStyle = `rgba(6,6,8,${(1 - wake) * (hash(Math.floor(t * 18)) > 0.35 ? 0.85 : 0.4)})`; ctx.fillRect(0, 0, r.w, r.h);
        if (p.img && hash(Math.floor(t * 12) + 3) > 0.5) for (let i = 0; i < 4; i++) {
          const y = hash(Math.floor(t * 12) * 7 + i) * r.h, hh = (2 + hash(i + t) * 7) * u;
          const sh = (hash(Math.floor(t * 30) + i) - 0.5) * 40 * u;
          ctx.globalAlpha = 0.8; ctx.fillStyle = 'rgba(32,214,199,.18)'; ctx.fillRect(sh, y, r.w, hh);
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
      const pulse = wake * (0.75 + 0.25 * Math.sin(t * 2.4));
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, r.h * 0.45);
      g.addColorStop(0, `rgba(32,214,199,${0.35 * pulse})`); g.addColorStop(1, 'rgba(32,214,199,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, r.w, r.h);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#060608';
      for (let y = 0; y < r.h; y += 4 * u) ctx.fillRect(0, y, r.w, 1.5 * u);
    }
    ctx.restore();
  }

  // countdown like on a monitor or hologram: big digits, a word below, the tank bar as in the game (Daniel: "Beides")
  function drawDisplay(d, r, t) {
    const holo = d.style === 'holo', col = holo ? '#20d6c7' : '#df3e23', glow = holo ? '#a6fcdb' : '#fa6a0a';
    const cx = (d.at?.[0] ?? 50) / 100 * r.w, cy = (d.at?.[1] ?? 50) / 100 * r.h, fs = (d.size ?? 20) / 100 * r.h;
    const flick = hash(Math.floor(t * 14)) > 0.93 ? 0.45 : 1, on = clamp((t - 0.5) / 0.4);
    ctx.save();
    ctx.globalAlpha = on * flick;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (d.frame !== false) {   // dark glass behind the digits, so they read on any picture
      const bw = fs * 2.1, top = cy - fs * 0.95, bh = fs * (d.bar != null ? 1.95 : d.sub ? 1.6 : 1.15);
      ctx.fillStyle = 'rgba(6,6,8,.72)'; ctx.fillRect(cx - bw / 2, top, bw, bh);
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, fs * 0.035); ctx.shadowColor = glow; ctx.shadowBlur = fs * 0.2;
      ctx.strokeRect(cx - bw / 2, top, bw, bh);
    }
    ctx.shadowColor = glow; ctx.shadowBlur = fs * 0.35;
    ctx.fillStyle = col;
    ctx.font = `${fs}px VT323, monospace`;
    if (d.text) ctx.fillText(d.text, cx, cy);
    if (d.sub) { ctx.font = `${fs * 0.42}px VT323, monospace`; ctx.fillText(d.sub, cx, cy + fs * 0.42); }
    if (d.bar != null) {
      const bw = fs * 1.6, bh = fs * 0.14, bx = cx - bw / 2, by = cy + fs * (d.sub ? 0.6 : 0.2);
      const blink = d.bar < 15 && Math.sin(t * 8) < 0;
      ctx.shadowBlur = fs * 0.15; ctx.lineWidth = Math.max(2, fs * 0.03); ctx.strokeStyle = col;
      ctx.strokeRect(bx, by, bw, bh);
      if (!blink) ctx.fillRect(bx + 3, by + 3, Math.max(0, (bw - 6) * d.bar / 100), bh - 6);
      ctx.font = `${fs * 0.24}px VT323, monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`TANK ${Math.round(d.bar)} %`, bx, by + bh + fs * 0.05);
    }
    ctx.restore();
  }

  function wrap(text, maxW) {
    const words = text.split(' '), out = [];
    let line = '';
    for (const w of words) { const tryLine = line ? line + ' ' + w : w; if (ctx.measureText(tryLine).width > maxW && line) { out.push(line); line = w; } else line = tryLine; }
    if (line) out.push(line);
    return out;
  }

  function drawCaptions(p, r, t, focus) {
    const fs = Math.max(26, Math.min(38, r.h * 0.066)), pad = fs * 0.45, m = fs * 0.5;
    ctx.save();
    ctx.font = `${fs}px VT323, monospace`; ctx.textBaseline = 'top';
    const used = { tl: 0, tr: 0, bl: 0, br: 0 };
    captions(p).forEach((c, i) => {
      const n = typed(p, i, t);
      if (n <= 0) return;
      const maxW = Math.min(r.w * 0.56, Math.max(360, r.w * 0.44));
      const full = wrap(c.text, maxW - pad * 2), shown = c.text.slice(0, Math.floor(n));
      const w = Math.max(...full.map(l => ctx.measureText(l).width)) + pad * 2, h = full.length * fs * 1.05 + pad * 2;
      const corner = c.at || 'tl', top = corner[0] === 't', leftSide = corner[1] === 'l';
      const x = leftSide ? m : r.w - w - m;
      const y = top ? m + used[corner] : r.h - h - m - used[corner];
      used[corner] += h + (c.speaker ? fs * 0.9 : 0) + m * 0.5;
      const speaker = c.speaker, sc = SPEAKER_COLOR[speaker] || '#ffd541';
      ctx.globalAlpha = focus ? 1 : 1 - C.dim / 100 * 0.6;
      // box
      ctx.fillStyle = '#060608'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      ctx.fillStyle = speaker ? 'rgba(20,16,19,.94)' : '#fef3c0'; ctx.fillRect(x, y, w, h);
      if (speaker) {
        ctx.fillStyle = sc; ctx.fillRect(x, y, 5, h);
        const tag = speaker.toUpperCase(), tw = ctx.measureText(tag).width * 0.75 + pad * 1.2;
        ctx.save(); ctx.font = `${fs * 0.75}px VT323, monospace`;
        ctx.fillStyle = '#060608'; ctx.fillRect(x - 3, y - fs * 0.85 - 3, tw + 6, fs * 0.85 + 3);
        ctx.fillStyle = sc; ctx.fillRect(x, y - fs * 0.85, tw, fs * 0.85);
        ctx.fillStyle = '#060608'; ctx.fillText(tag, x + pad * 0.6, y - fs * 0.8);
        ctx.restore();
      }
      // text, typed up to n letters, following the final line breaks
      ctx.fillStyle = speaker ? '#e3e6ff' : '#141013';
      let left = shown.length;
      full.forEach((l, k) => { if (left <= 0) return; const part = l.slice(0, left); left -= l.length + 1; ctx.fillText(part, x + pad, y + pad + k * fs * 1.05); });
      if (focus && i === cap && n < c.text.length && Math.floor(t / 250) % 2) { ctx.fillStyle = speaker ? sc : '#b4202a'; ctx.fillRect(x + w - pad * 0.9, y + h - pad * 0.9, pad * 0.5, pad * 0.5); }
    });
    ctx.restore();
  }

  function drawEnd(t) {
    const a = ease((t - endAt) / 1400);
    ctx.fillStyle = `rgba(6,6,8,${a})`; ctx.fillRect(0, 0, PW, PH);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#bc4a9b'; ctx.shadowBlur = 40; ctx.fillStyle = '#e3e6ff';
    ctx.font = '170px VT323, monospace'; ctx.fillText(C.title || 'NomadGirl', PW / 2, PH / 2 - 30);
    ctx.shadowBlur = 0; ctx.fillStyle = '#20d6c7';
    if (C.subtitle) { ctx.font = '48px VT323, monospace'; ctx.fillText(C.subtitle, PW / 2, PH / 2 + 80); }
    ctx.restore();
  }

  function frame() {
    const t = now();
    pollPad();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#060608'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);
    ctx.fillStyle = '#141013'; ctx.fillRect(0, 0, PW, PH);
    ctx.drawImage(halftone, 0, 0, PW, PH);
    if (idx >= 0) {
      const page = P().page;
      for (const p of panels) if (p.page === page && shownAt.has(p.id) && panels.indexOf(p) <= idx) drawPanel(p, t, p === P());
      const turn = clamp((t - pageAt) / 450);
      if (turn < 1) { ctx.fillStyle = `rgba(6,6,8,${1 - turn})`; ctx.fillRect(0, 0, PW, PH); }
      // automatic advance after the last box (Intro › Automatisch weiter nach)
      const c = captions(P());
      if (!ended && cap >= c.length - 1 && capDone(t)) { if (!doneAt) doneAt = t; if (P().hold > 0 && t - doneAt > P().hold * 1000) next(); }
    } else {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#e3e6ff'; ctx.font = '64px VT323, monospace';
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t / 400); ctx.fillText('Weiter mit Enter, Klick oder A', PW / 2, PH / 2); ctx.restore();
    }
    if (ended) { drawEnd(t); if (t - endAt > 5200) finish(); }
    // help line
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#b9bffb'; ctx.font = '26px VT323, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('Enter / A weiter · ← / LB zurück · Esc / B überspringen', PW - 18, PH - 2); ctx.restore();
    requestAnimationFrame(frame);
  }
  // start at a panel (workshop › Spielen in the area Intro): the panels before it on the same page are already there
  const start = Math.max(0, panels.findIndex(p => p.id === startAt));
  for (const p of panels.slice(0, start)) if (p.page === panels[start].page) shownAt.set(p.id, now() - 1e5);
  show(start); pageAt = now();
  requestAnimationFrame(frame);

  return {
    panels: panels.length,
    images: panels.filter(p => p.img).length,
    next, back, skip,
    state: () => ({ index: idx, panel: P()?.id, page: P()?.page, caption: cap, captions: captions(P()).length, typing: !capDone(now()), ended, left, shown: [...shownAt.keys()] }),
  };
}

// comic page: fine dot screen fading towards the corners
function makeHalftone() {
  const c = document.createElement('canvas'); c.width = PW / 2; c.height = PH / 2;
  const g = c.getContext('2d');
  for (let y = 0; y < c.height; y += 9) for (let x = (y / 9) % 2 ? 4.5 : 0; x < c.width; x += 9) {
    const d = Math.hypot(x / c.width - 0.5, y / c.height - 0.5);
    g.fillStyle = `rgba(121,58,128,${0.05 + d * 0.22})`;
    g.beginPath(); g.arc(x, y, 1 + d * 2.2, 0, Math.PI * 2); g.fill();
  }
  return c;
}

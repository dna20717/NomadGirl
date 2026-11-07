// Sprite preview for the workshop: plays a sprite strip (frames side by side) on a canvas.
// Views: "Nah" (frame fitted), "1:1" (original pixels), "Im Spiel" (game viewport with tile grid at the game resolution,
// drawn like the game will: with pixelArt the sprite is scaled without smoothing). Settings live in w.spriteView and survive redraws.
import { el } from '../ui.js';
import { icon } from '../icons.js';

const VIEWS = [['near', 'Nah'], ['native', '1:1'], ['game', 'Im Spiel']];
const BACKS = [['check', 'Karo'], ['dark', 'Dunkel'], ['light', 'Hell']];

// Images are loaded once per URL (fetch + blob also works in the artifact sandbox)
function image(w, file) {
  const url = new URL(file, w.basis).href;
  w.images = w.images || new Map();
  if (!w.images.has(url)) w.images.set(url, fetch(url, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); }).then(b => createImageBitmap(b)));
  return w.images.get(url);
}

export function spritePreview(w, s) {
  const v = w.spriteView = w.spriteView || { view: 'near', back: 'check', anchor: true, playing: true, frame: 0 };
  const game = w.p.data.game || {}, [fw, fh] = s.frameSize || [0, 0], frames = Math.max(1, s.frames || 1);
  const canvas = el('canvas', { class: 'ng-sprite-canvas' }), info = el('span', { class: 'ng-sprite-info' });
  const box = el('div', { class: 'ng-sprite-stage back-' + v.back }, canvas);
  const seg = (list, key, after) => el('span', { class: 'ed-segment' }, ...list.map(([k, n]) =>
    el('button', { class: v[key] === k ? 'on' : '', onclick: () => { v[key] = k; after?.(); w.draw(); } }, n)));
  const step = d => { v.playing = false; v.frame = (v.frame + d + frames) % frames; w.draw(); };
  const controls = el('div', { class: 'ng-sprite-bar' },
    el('button', { class: 'ed-button small', title: v.playing ? 'Anhalten' : 'Abspielen', onclick: () => { v.playing = !v.playing; w.draw(); } }, icon(v.playing ? 'pause' : 'play', 14)),
    el('button', { class: 'ed-button small', title: 'Frame zurück', onclick: () => step(-1) }, icon('left', 14)),
    el('button', { class: 'ed-button small', title: 'Frame vor', onclick: () => step(1) }, icon('right', 14)),
    info, el('span', { class: 'ed-grow' }),
    el('button', { class: 'ed-button small' + (v.anchor ? ' on' : ''), title: 'Ankerpunkt zeigen', onclick: () => { v.anchor = !v.anchor; w.draw(); } }, icon('target', 14)));
  const wrap = el('div', { class: 'ng-sprite' }, el('div', { class: 'ng-sprite-bar' }, seg(VIEWS, 'view'), el('span', { class: 'ed-grow' }), seg(BACKS, 'back')), box, controls);
  if (!s.file || !fw || !fh) { box.replaceChildren(el('p', { class: 'ed-small' }, 'Datei und Frame-Größe eintragen, dann erscheint hier die Vorschau.')); return wrap; }

  image(w, s.file).then(img => {
    const ctx = canvas.getContext('2d'), t0 = performance.now();
    const [ox, oy] = s.origin || [fw / 2, fh];
    let seen = false, raf;
    const tile = game.tileSize || 32, [gw, gh] = game.resolution || [640, 360];
    // size of the canvas per view
    if (v.view === 'native') { canvas.width = fw; canvas.height = fh; }
    else if (v.view === 'game') { canvas.width = gw; canvas.height = gh; }
    else { const k = Math.min(300 / fh, 360 / fw); canvas.width = Math.round(fw * k); canvas.height = Math.round(fh * k); }
    canvas.classList.toggle('pixelated', v.view === 'game');
    const frameNow = now => {
      if (!v.playing) return v.frame;
      const n = Math.floor((now - t0) / 1000 * (s.fps || 1));
      return v.frame = s.loop === false ? Math.min(n, frames - 1) : n % frames;
    };
    const draw = now => {
      if (canvas.isConnected) seen = true; else if (seen || now - t0 > 3000) return cancelAnimationFrame(raf);
      const i = frameNow(now);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (v.view === 'game') {
        // game viewport: tile grid, ground two tiles above the bottom, sprite at its in-game height on the ground
        const ground = gh - 2 * tile, k = (s.height || fh) / fh, x = gw / 2;
        ctx.strokeStyle = 'rgba(128,128,128,.18)'; ctx.lineWidth = 1;
        for (let gx = 0; gx <= gw; gx += tile) { ctx.beginPath(); ctx.moveTo(gx + .5, 0); ctx.lineTo(gx + .5, gh); ctx.stroke(); }
        for (let gy = 0; gy <= gh; gy += tile) { ctx.beginPath(); ctx.moveTo(0, gy + .5); ctx.lineTo(gw, gy + .5); ctx.stroke(); }
        ctx.fillStyle = 'rgba(128,128,128,.35)'; ctx.fillRect(0, ground, gw, gh - ground);
        ctx.imageSmoothingEnabled = !game.pixelArt;
        ctx.drawImage(img, i * fw, 0, fw, fh, Math.round(x - ox * k), Math.round(ground - oy * k), Math.round(fw * k), Math.round(fh * k));
        if (v.anchor) cross(ctx, x, ground, 4);
      } else {
        const k = canvas.width / fw;
        ctx.imageSmoothingEnabled = v.view !== 'native';
        ctx.drawImage(img, i * fw, 0, fw, fh, 0, 0, canvas.width, canvas.height);
        if (v.anchor) cross(ctx, ox * k, oy * k, v.view === 'native' ? 10 : 7);
      }
      info.textContent = `Frame ${i + 1}/${frames}` + (v.view === 'game' ? ` · ${s.height || fh} px hoch bei ${gw}×${gh}` : v.view === 'native' ? ` · ${fw}×${fh} px` : '');
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
  }).catch(e => box.replaceChildren(el('p', { class: 'ng-inline error' }, icon('error', 14), ` ${s.file} lässt sich nicht laden (${e.message})`)));
  return wrap;
}

function cross(ctx, x, y, r) {
  ctx.save(); ctx.strokeStyle = '#ff3fa4'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke(); ctx.restore();
}

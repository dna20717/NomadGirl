// Asset previews for the workshop: animations (sprite strips, frames side by side) play on a canvas,
// images, references and originals (also animated GIFs) show as pictures with a full-size view. Thumbnails for lists and the gallery.
// Views: "Nah" (frame fitted), "1:1" (original pixels), "Im Spiel" (game viewport with tile grid at the game resolution,
// drawn like the game will: with pixelArt the sprite is scaled without smoothing). Settings live in w.spriteView and survive redraws.
import { el, openDialogue } from '../ui.js';
import { icon } from '../icons.js';

const VIEWS = [['near', 'Nah'], ['native', '1:1'], ['game', 'Im Spiel']];
const BACKS = [['check', 'Karo'], ['dark', 'Dunkel'], ['light', 'Hell']];

// Files are loaded once per URL as blob (fetch + blob also works in the artifact sandbox)
function blob(w, file) {
  const url = new URL(file, w.basis).href;
  w.blobs = w.blobs || new Map();
  if (!w.blobs.has(url)) w.blobs.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); }));
  return w.blobs.get(url);
}
function image(w, file) {
  w.bitmaps = w.bitmaps || new Map();
  if (!w.bitmaps.has(file)) w.bitmaps.set(file, blob(w, file).then(b => createImageBitmap(b)));
  return w.bitmaps.get(file);
}
function objectUrl(w, file) {
  w.urls = w.urls || new Map();
  if (!w.urls.has(file)) w.urls.set(file, blob(w, file).then(b => URL.createObjectURL(b)));
  return w.urls.get(file);
}
const failed = (file, e) => el('p', { class: 'ng-inline error' }, icon('error', 14), ` ${file} lässt sich nicht laden (${e.message})`);

// Preview of any asset: animation → player, everything else → picture
export function assetPreview(w, a) {
  return a?.kind === 'animation' ? spritePreview(w, a) : a?.kind === 'sound' ? soundPreview(w, a) : a?.kind === 'icons' ? iconSheet(w, a) : picturePreview(w, a);
}

// Icon sheet (asset kind "icons"): the whole grid, pixel-sharp, every cell with its number and name as tooltip.
// With pick = { value, set(i) } a cell can be chosen (inspector of an item, weapon or backpack).
export function iconSheet(w, a, pick) {
  const v = w.spriteView = w.spriteView || { view: 'near', back: 'check', anchor: true, playing: true, frame: 0 };
  const [fw, fh] = a.cell || [0, 0], [c, r] = a.grid || [0, 0];
  const info = el('span', { class: 'ng-sprite-info' });
  const box = el('div', { class: 'ng-sprite-stage picture back-' + v.back });
  const seg = el('span', { class: 'ed-segment' }, ...BACKS.map(([k, n]) => el('button', { class: v.back === k ? 'on' : '', onclick: () => { v.back = k; w.draw(); } }, n)));
  const wrap = el('div', { class: 'ng-sprite' }, el('div', { class: 'ng-sprite-bar' }, info, el('span', { class: 'ed-grow' }), seg), box);
  if (!a.file || !fw || !c || !r) { box.append(el('p', { class: 'ed-small' }, 'Datei, Feldgröße und Raster eintragen, dann erscheint hier das Raster.')); return wrap; }
  const name = i => a.names?.[i] || `Feld ${i}`;
  info.textContent = pick ? (pick.value !== undefined ? `Symbol ${pick.value}: ${name(pick.value)}` : 'Symbol anklicken') : `${c} × ${r} Symbole à ${fw} × ${fh} px`;
  objectUrl(w, a.file).then(src => {
    const grid = el('div', { class: 'ng-icons' + (pick ? ' pick' : ''), style: `--c:${c};--r:${r};aspect-ratio:${c * fw} / ${r * fh}` }, el('img', { src, alt: a.name || a.file }));
    for (let i = 0; i < c * r; i++) {
      const cell = el(pick ? 'button' : 'span', { class: 'ng-icon' + (pick?.value === i ? ' picked' : ''), title: `${i} · ${name(i)}`, style: `left:${(i % c) / c * 100}%;top:${Math.floor(i / c) / r * 100}%` });
      if (pick) cell.addEventListener('click', () => pick.set(i));
      grid.append(cell);
    }
    box.append(grid);
  }).catch(e => box.append(failed(a.file, e)));
  return wrap;
}

// Sound: a player (the browser's own controls), length shown once it is loaded
export function soundPreview(w, a) {
  const info = el('span', { class: 'ng-sprite-info' });
  const box = el('div', { class: 'ng-sprite-stage picture back-dark' });
  const wrap = el('div', { class: 'ng-sprite' }, el('div', { class: 'ng-sprite-bar' }, icon('music', 14), info), box);
  if (!a?.file) { box.append(el('p', { class: 'ed-small' }, 'Datei eintragen, dann lässt sich der Ton hier abspielen.')); return wrap; }
  objectUrl(w, a.file).then(src => {
    const audio = el('audio', { src, controls: true, loop: true, style: 'width: min(420px, 90%); margin: 24px auto; display: block' });
    audio.addEventListener('loadedmetadata', () => { info.textContent = ` ${audio.duration.toFixed(1).replace('.', ',')} s · ${a.file}`; });
    box.append(audio);
  }).catch(e => box.append(failed(a.file, e)));
  return wrap;
}

// Picture (image, reference, original): fitted, background switch, tap opens the full size
export function picturePreview(w, a) {
  const v = w.spriteView = w.spriteView || { view: 'near', back: 'check', anchor: true, playing: true, frame: 0 };
  const box = el('div', { class: 'ng-sprite-stage picture back-' + v.back });
  const seg = el('span', { class: 'ed-segment' }, ...BACKS.map(([k, n]) => el('button', { class: v.back === k ? 'on' : '', onclick: () => { v.back = k; w.draw(); } }, n)));
  const info = el('span', { class: 'ng-sprite-info' });
  const wrap = el('div', { class: 'ng-sprite' }, el('div', { class: 'ng-sprite-bar' }, info, el('span', { class: 'ed-grow' }), seg), box);
  if (!a?.file) { box.append(el('p', { class: 'ed-small' }, 'Datei eintragen, dann erscheint hier die Vorschau.')); return wrap; }
  objectUrl(w, a.file).then(src => {
    const img = el('img', { src, alt: a.name || a.file, class: 'ng-picture', title: 'Antippen: Originalgröße' });
    img.addEventListener('load', () => { info.textContent = `${img.naturalWidth} × ${img.naturalHeight} px · antippen für Originalgröße`; });
    img.addEventListener('click', () => openDialogue({ title: a.name || a.file, icon: 'image', wide: true, class: 'ng-lightbox', content: [el('div', { class: 'ng-lightbox-box back-' + v.back }, el('img', { src, alt: a.name || a.file }))] }));
    box.append(img);
  }).catch(e => box.append(failed(a.file, e)));
  return wrap;
}

// Small picture for lists and the gallery: first frame of an animation, otherwise the image itself
export function assetThumb(w, a, size = 28, cell) {
  const box = el('span', { class: 'ng-thumb', style: `--s:${size}px` });
  if (!a?.file) return box;
  if (a.kind === 'sound') { box.append(icon('music', Math.round(size * 0.7))); return box; }
  const sheet = a.kind === 'icons' && cell !== undefined && a.grid?.[0];   // one cell of an icon sheet
  if (a.kind === 'animation' || sheet) {
    const [fw, fh] = (sheet ? a.cell : a.frameSize) || [0, 0];
    if (!fw || !fh) return box;
    const sx = sheet ? (cell % a.grid[0]) * fw : 0, sy = sheet ? Math.floor(cell / a.grid[0]) * fh : 0;
    image(w, a.file).then(img => {
      const c = el('canvas'), k = sheet ? Math.max(1, Math.ceil(size * 2 / fw)) : Math.min(size * 2 / fh, size * 2 / fw);
      c.width = Math.max(1, Math.round(fw * k)); c.height = Math.max(1, Math.round(fh * k));
      const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = !sheet;
      ctx.drawImage(img, sx, sy, fw, fh, 0, 0, c.width, c.height);
      box.append(el('img', { src: c.toDataURL(), alt: '' }));   // as <img> so it scales like the other thumbnails
    }).catch(() => box.classList.add('broken'));
  } else objectUrl(w, a.file).then(src => box.append(el('img', { src, alt: '' }))).catch(() => box.classList.add('broken'));
  return box;
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
  }).catch(e => box.replaceChildren(failed(s.file, e)));
  return wrap;
}

function cross(ctx, x, y, r) {
  ctx.save(); ctx.strokeStyle = '#ff3fa4'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke(); ctx.restore();
}

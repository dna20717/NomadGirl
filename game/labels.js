// #170 (Daniel, 21.11.2026: „Texte sollen niemals in der Grafik sein“): text on pictures comes from data, never from the pixels.
// Assets › Schrift aus Code (field `labels`): rows { text, at: [x, y] centre in picture pixels, size (px), color, align, glow, width }.
// The text is drawn into a copy of the picture at the picture's own size, in VT323, its edges snapped to full pixels so it sits in the
// pixel art like painted letters; neon signs glow. Used by the game (scene.js: textures), the drive (drive_ui.js) and the workshop preview.
// No Phaser, no DOM beyond a canvas.

export const hasLabels = a => Array.isArray(a?.labels) && a.labels.some(l => l?.text && Array.isArray(l.at));

const FONT = 'VT323';
export function fontReady() {
  try { return document.fonts?.check?.(`16px ${FONT}`) ?? true; } catch { return true; }
}
export function loadFont() {
  try { return document.fonts?.load ? document.fonts.load(`16px ${FONT}`).catch(() => null) : Promise.resolve(); } catch { return Promise.resolve(); }
}

const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// one label as crisp pixels: draw, then every pixel is either the colour or empty (no soft edges in pixel art)
function stamp(L) {
  const size = Math.max(6, +L.size || 12), font = `${size}px ${FONT}, monospace`;
  const probe = canvasOf(4, 4).getContext('2d'); probe.font = font;
  const lines = String(L.text).split(/\\n|\n/), widths = lines.map(t => probe.measureText(t).width);
  const k = L.width > 0 ? Math.min(1, L.width / Math.max(1, ...widths)) : 1;   // squeeze into the plate
  const lh = Math.round(size * 0.9), W = Math.ceil(Math.max(...widths) * k) + 2, H = lh * lines.length + 2;
  const c = canvasOf(W, H), x = c.getContext('2d');
  x.font = font; x.fillStyle = L.color || '#ffffff'; x.textBaseline = 'middle';
  lines.forEach((t, i) => {
    const tw = widths[i] * k, left = L.align === 'left' ? 1 : L.align === 'right' ? W - 1 - tw : (W - tw) / 2;
    x.save(); x.translate(Math.round(left), Math.round(1 + lh * (i + 0.5))); x.scale(k, 1); x.fillText(t, 0, 0); x.restore();
  });
  const img = x.getImageData(0, 0, W, H), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 100 ? 255 : 0;
  x.putImageData(img, 0, 0);
  return c;
}

// draw the labels of an asset onto a 2D context whose origin is the picture's top left (k = picture pixels → context pixels)
export function drawLabels(ctx, labels, k = 1) {
  for (const L of labels || []) {
    if (!L?.text || !Array.isArray(L.at)) continue;
    const s = stamp(L), [cx, cy] = L.at;
    const x0 = L.align === 'left' ? cx : L.align === 'right' ? cx - s.width : cx - s.width / 2, y0 = cy - s.height / 2;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (L.glow) {   // neon: a soft halo in the same colour behind the letters
      ctx.save(); ctx.globalAlpha = 0.55; ctx.shadowColor = L.color || '#ffffff'; ctx.shadowBlur = Math.max(2, (+L.size || 12) * 0.35) * k;
      ctx.drawImage(s, Math.round(x0) * k, Math.round(y0) * k, s.width * k, s.height * k); ctx.restore();
    }
    ctx.drawImage(s, Math.round(x0) * k, Math.round(y0) * k, s.width * k, s.height * k);
    ctx.restore();
  }
}

// a copy of the picture with its labels (same size: frames of symbol grids stay where they are)
export function labeledCanvas(img, labels, into = null) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, c = into || canvasOf(w, h), x = c.getContext('2d');
  x.clearRect(0, 0, w, h); x.drawImage(img, 0, 0);
  drawLabels(x, labels);
  c.complete = true; c.naturalWidth = w; c.naturalHeight = h;   // reads like a loaded <img> for code that checks
  return c;
}

// Phaser: assets with labels load under a raw key (scene.js queueAssets); here they become the real texture, before anything uses it.
// If VT323 is not there yet, the text is drawn with the fallback and redrawn once the font arrives.
export const RAW = '~raw';
export function applyLabels(scene, assets) {
  const made = [];
  for (const [id, a] of Object.entries(assets || {})) {
    if (!hasLabels(a) || scene.textures.exists(id) || !scene.textures.exists(id + RAW)) continue;
    const img = scene.textures.get(id + RAW).getSourceImage(), c = labeledCanvas(img, a.labels);
    if (a.kind === 'icons' && a.cell) { const [fw, fh] = Array.isArray(a.cell) ? a.cell : [a.cell, a.cell]; scene.textures.addSpriteSheet(id, c, { frameWidth: fw, frameHeight: fh }); }
    else scene.textures.addCanvas(id, c);
    made.push({ id, img, c, labels: a.labels });
  }
  if (made.length && !fontReady()) loadFont().then(() => {
    for (const m of made) {
      if (!scene.textures.exists(m.id)) continue;
      labeledCanvas(m.img, m.labels, m.c);
      const t = scene.textures.get(m.id);
      if (t.refresh) t.refresh(); else t.source?.[0]?.update?.();
    }
  });
  return made.length;
}

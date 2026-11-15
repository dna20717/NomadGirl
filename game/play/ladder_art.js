// Ladders from one picture (#034, Daniel 15.11.2026: „hübsche Leitern mit Anfang, Ende, kaputtem Segment, einfärbbar, orthogonal“):
// Spiel › Leitern names a grey vertical strip and its parts (rows): the top end, the middle that repeats, a broken piece and the
// bottom end. A ladder of any height is put together from them on a canvas at picture resolution (cached per height), scaled to
// the tile width and tinted (grey picture × colour). Used by POI rooms, the camp's rig ladders and the mega rigs.
const NEAREST = () => Phaser.Textures.FilterMode.NEAREST;
const hash = (a, b) => { let h = (a * 73856093) ^ (b * 19349663); h = (h ^ (h >>> 13)) >>> 0; return (h % 1000) / 1000; };

export function ladderConfig(scene) {
  const L = scene.data_?.game?.ladder;
  return L?.look && scene.textures.exists(L.look) ? L : null;
}
// draws one ladder over x0…x1 from top to bottom (game px) → the image, or null without a ladder picture
// opts: { depth, tint, broken: true|false|undefined (= by chance), seed }
export function ladderArt(scene, x0, x1, top, bottom, opts = {}) {
  const L = ladderConfig(scene);
  if (!L) return null;
  const src = scene.textures.get(L.look).getSourceImage(), T = scene.T || 64, W = src.width;
  const k = (T * (L.width ?? 110) / 100) / W;   // game px per picture px
  const [t0, t1] = L.top || [0, 0], [m0, m1] = L.mid || [0, src.height], [b0, b1] = L.bottom || [src.height, src.height], [k0, k1] = L.broken || [0, 0];
  const lift = Math.round((t1 - t0) * k * 0.55);   // the hooks stick out above the top edge, so Leyla sees where to grab
  const H = Math.max(1, Math.round((bottom - top + lift) / k));
  const chance = (L.brokenChance ?? 0) / 100, seed = opts.seed ?? hash(Math.round(x0), Math.round(top));
  const broken = k1 > k0 && H > (t1 - t0) + (b1 - b0) + 2 * (k1 - k0) && (opts.broken ?? seed < chance);
  const key = `ladder_${L.look}_${H}_${broken ? Math.round(seed * 100) : 'x'}`;
  if (!scene.textures.exists(key)) {
    const c = scene.textures.createCanvas(key, W, H), ctx = c.getContext();
    ctx.imageSmoothingEnabled = false;
    const piece = (a, b, y, h = b - a) => ctx.drawImage(src, 0, a, W, Math.min(h, b - a), 0, y, W, Math.min(h, b - a));
    const topH = Math.min(t1 - t0, Math.floor(H / 2)), botH = Math.min(b1 - b0, H - topH);
    // the middle from below the top to above the bottom, the broken piece somewhere in the lower half
    let y = topH;
    const midEnd = H - botH, brokenAt = broken ? Math.floor(topH + (midEnd - topH - (k1 - k0)) * (0.45 + seed * 0.4)) : -1;
    let placedBroken = false;
    while (y < midEnd) {
      if (broken && !placedBroken && y + (m1 - m0) > brokenAt) { const h = Math.min(k1 - k0, midEnd - y); piece(k0, k1, y, h); y += h; placedBroken = true; continue; }
      const h = Math.min(m1 - m0, midEnd - y); piece(m0, m1, y, h); y += h;
    }
    piece(t0, t1, 0, topH);
    ctx.drawImage(src, 0, b1 - botH, W, botH, 0, H - botH, W, botH);   // the bottom end, its lowest rows (the feet) always
    c.refresh(); c.setFilter(NEAREST());
  }
  const im = scene.add.image((x0 + x1) / 2, bottom, key).setOrigin(0.5, 1).setScale(k).setDepth(opts.depth ?? -2.5);
  const tint = opts.tint ?? L.tint;
  if (tint) im.setTint(parseInt(String(tint).slice(1), 16));
  return im;
}

// Parallax-Hintergründe (#115, Daniel 19.11.2026: „Die Parallax-Hintergründe überall können bitte in hübsch umgesetzt werden. Modular.“):
// a set (Welt › Parallax-Sets) stacks painted layers (PixelLab, transparent sky) in front of the code sky: far to near, each with its
// own speed, its bottom relative to the horizon, a scale and how much the night darkens it. The pictures repeat mirrored (A | mirrored A),
// so every layer is seamless. Foreground silhouettes (black, painted) pass in front of the world faster than it.
//   setFor(D, region) → set id      parallaxLayers(scene, D, setId, { horizon, depth, night, worldW }) → [tileSprites]
//   foregroundStrip(scene, D, setId, { ground, worldW, depth, seed }) → [images]
import { landscapeOf } from '../road.js';

// the set of a region (Reisen › Landschaften › Parallax-Set; the row without region is the default)
export const setFor = (D, region) => landscapeOf(D, region).parallax || null;

// a mirrored pair of the picture side by side: repeats without a seam
export function mirroredTexture(scene, key) {
  const out = `${key}__mirror`;
  if (scene.textures.exists(out)) return out;
  if (!scene.textures.exists(key)) return null;
  const src = scene.textures.get(key).getSourceImage(), w = src.width, h = src.height;
  const t = scene.textures.createCanvas(out, w * 2, h), ctx = t.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0);
  ctx.save(); ctx.translate(w * 2, 0); ctx.scale(-1, 1); ctx.drawImage(src, 0, 0); ctx.restore();
  t.refresh(); t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return out;
}
const mixTint = (a, b, k) => { const c = (x, s) => (x >> s) & 255, m = s => Math.round(c(a, s) + (c(b, s) - c(a, s)) * k); return (m(16) << 16) | (m(8) << 8) | m(0); };

// the layers of a set on the background camera: each a tile sprite as wide as it needs to be for the world at its speed
export function parallaxLayers(scene, D, setId, { horizon, depth = -98.8, night = 0, worldW = 0, alpha = 1, maxSpeed = 100, veil = 0, veilColor = 0x6b4a6a } = {}) {
  const P = D.parallax?.[setId];
  if (!P) return [];
  const W = scene.scale.width, out = [], dark = parseInt(String(P.nightColor || '#262040').slice(1), 16);
  (P.layers || []).forEach((L, i) => {
    const key = L.look && mirroredTexture(scene, L.look);
    if (!key) return;
    if ((L.speed ?? 5) > maxSpeed) return;   // e.g. in POIs only the far layers: the near ones would look like props
    const src = scene.textures.get(key).getSourceImage(), k = (L.scale ?? 400) / 100, sf = (L.speed ?? 5) / 100;
    const w = W * 1.5 + worldW * sf + src.width * k, h = src.height * k;
    const ts = scene.add.tileSprite(-src.width * k * 0.25, Math.round(horizon + (L.bottom ?? 0)), w, h, key).setOrigin(0, 1).setTileScale(k).setScrollFactor(sf, 0)
      .setDepth(depth + i * 0.05).setAlpha(alpha * (L.alpha ?? 100) / 100);
    if (L.offset) ts.tilePositionX = L.offset;
    const n = Math.min(1, night * (L.night ?? 60) / 100);
    let tint = n > 0 ? mixTint(0xffffff, dark, n) : 0xffffff;
    if (veil > 0) tint = mixTint(tint, veilColor, veil * (1 - i * 0.25));   // a haze that pushes the layers back
    if (tint !== 0xffffff) ts.setTint(tint);
    out.push(ts);
  });
  return out;
}

// black silhouettes in front of everything, spread along the world (Parallax-Set › Vordergrund): faster than the world, so they slide by
export function foregroundStrip(scene, D, setId, { ground, worldW, depth = 39, seed = 1, x0 = 0 } = {}) {
  const P = D.parallax?.[setId], F = P?.fg;
  if (!F?.look || !scene.textures.exists(F.look)) return [];
  scene.textures.get(F.look).setFilter(Phaser.Textures.FilterMode.NEAREST);
  const A = D.assets?.[F.look], n = A?.grid ? A.grid[0] * A.grid[1] : 1, cells = String(F.cells || '').split(',').map(t => Number(t.trim()) - 1).filter(v => v >= 0 && v < n);
  const pool = cells.length ? cells : [...Array(n).keys()], sf = (F.speed ?? 130) / 100, out = [];
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  const [g0, g1] = F.gap || [700, 1600], [s0, s1] = F.size || [300, 500];
  for (let x = x0 + g0 * rnd(); x < x0 + worldW * sf + scene.scale.width; x += g0 + (g1 - g0) * rnd()) {
    const fr = pool[Math.floor(rnd() * pool.length)], k = (s0 + (s1 - s0) * rnd()) / 100;
    out.push(scene.add.image(x, ground + (F.drop ?? 30), F.look, fr).setOrigin(0.5, 1).setScale(k).setFlipX(rnd() < 0.5).setScrollFactor(sf, 1).setDepth(depth).setAlpha((F.alpha ?? 100) / 100));
  }
  return out;
}

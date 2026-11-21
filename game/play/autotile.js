// Autotiling from code (#158 step 6, Daniel 21.11.2026: „auch die Tilesets werden nicht korrekt genutzt“): the Kachel-Sets only bring
// a surface and fills; the missing cases are derived here, once per tile variant, as small canvas textures (no new graphics):
//   caps       a surface whose side is open (a run ends, outer corner, pillar, ledge): the crust overhang is rounded off, a darker rim
//   under      a tile with air below (ceiling underside, lower face of a ledge): shade, or the crust of the set flipped (rock)
//   roof       the surface of a roof (place type roof): fill + a roof cover (gravel, tar paper, sheet metal) instead of the desert crust
//   seams      where two sets meet side by side, the neighbour's tile runs into this one with a Bayer dither (like #156 between layers)
// Kachel-Sets › Autotiling (per set), Spiel › Kacheln › Set je Gebäude-Hülle (engine/dressing.js hullMap).
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export const AUTOTILE = { roof: 'gravel', under: 'shade', seam: 20, caps: true };
export const autotileOf = kit => { const a = kit?.def?.autotile || {}; return { on: a.enabled !== false, roof: a.roof || AUTOTILE.roof, under: a.under || AUTOTILE.under, seam: a.seam ?? AUTOTILE.seam, caps: a.caps !== false }; };

const rngOf = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
function pixels(scene, key, frame) {
  const f = scene.textures.getFrame(key, frame), w = f.cutWidth, h = f.cutHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(f.source.image, f.cutX, f.cutY, w, h, 0, 0, w, h);
  return { c, ctx, w, h };
}
// the roof cover on top of a fill tile: top edge at row `o` (the tile's top), drawn in the cell's crust space above it too
function roofCover(ctx, w, o, style, seed) {
  const r = rngOf(seed + 7), px = (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, ww, hh); };
  ctx.clearRect(0, 0, w, o);
  if (style === 'tar') {
    px(0, o - 2, w, 10, '#26252b'); px(0, o - 2, w, 1, '#55525d'); px(0, o + 8, w, 2, 'rgba(0,0,0,0.4)');
    for (let x = (seed * 7) % 21; x < w; x += 21) px(x, o - 1, 1, 9, '#17161b');
    for (let i = 0; i < 5; i++) px(Math.floor(r() * (w - 4)), o + 1 + Math.floor(r() * 5), 3, 2, '#34323a');
  } else if (style === 'metal') {
    for (let x = 0; x < w; x++) px(x, o - 3, 1, 11, x % 8 < 4 ? '#7d8590' : '#4d545d');
    px(0, o - 3, w, 1, '#aeb6c0'); px(0, o + 8, w, 2, 'rgba(0,0,0,0.4)');
    for (let i = 0; i < 4; i++) px(Math.floor(r() * (w - 5)), o - 2 + Math.floor(r() * 8), 2 + Math.floor(r() * 4), 2, '#8a4b2a');
  } else {   // gravel on bitumen
    px(0, o - 2, w, 11, '#3a3940'); px(0, o + 9, w, 2, 'rgba(0,0,0,0.4)');
    const cols = ['#5b5862', '#2b2a30', '#6e6975', '#47444e', '#807a86'];
    for (let i = 0; i < 46; i++) { const s = 1 + Math.floor(r() * 3); px(Math.floor(r() * (w - s)), o - 4 + Math.floor(r() * 12), s, s, cols[Math.floor(r() * cols.length)]); }
    px(0, o - 2, w, 1, 'rgba(255,244,220,0.18)');
  }
}
// round off the crust that hangs over an open side (quarter circle), darker rim down the side
function cap(ctx, w, o, left) {
  const R = 12, img = ctx.getImageData(0, 0, w, o + 4), d = img.data;
  for (let y = 0; y < o + 4; y++) for (let i = 0; i < R; i++) {
    const x = left ? i : w - 1 - i, dx = R - i, dy = o + 4 - y;
    if (dx * dx + dy * dy > R * R) d[(y * w + x) * 4 + 3] = 0;
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = 'rgba(6,6,8,0.28)'; ctx.fillRect(left ? 0 : w - 3, o, 3, 16);
}
// the underside: shade, or the crust of a surface tile flipped (rock hanging down)
function under(ctx, w, h, mode, crust) {
  if (mode === 'crust' && crust) {
    const band = Math.min(crust.h, 22);
    ctx.save(); ctx.translate(0, h); ctx.scale(1, -1); ctx.drawImage(crust.c, 0, Math.max(0, crust.o - 6), w, band, 0, 0, w, band); ctx.restore();
  } else {
    for (let i = 0; i < 10; i++) { ctx.fillStyle = `rgba(6,5,10,${0.42 * (1 - i / 10)})`; ctx.fillRect(0, h - 1 - i, w, 1); }
    ctx.fillStyle = 'rgba(255,244,220,0.10)'; ctx.fillRect(0, h - 12, w, 1);
  }
}
// the neighbour set runs in from one side over `S` px, Bayer-dithered (#156 style)
function seam(ctx, w, h, other, left, S) {
  const me = ctx.getImageData(0, 0, w, h), a = me.data, b = other.ctx.getImageData(0, 0, Math.min(w, other.w), Math.min(h, other.h)).data, ow = Math.min(w, other.w);
  for (let y = 0; y < Math.min(h, other.h); y++) for (let i = 0; i < S && i < ow; i++) {
    const x = left ? i : w - 1 - i, t = 1 - (i + 0.5) / S;
    if ((BAYER[y % 4][x % 4] + 0.5) / 16 >= t * 0.95) continue;
    const p = (y * w + x) * 4, q = (y * ow + x) * 4;
    if (b[q + 3] < 10 && a[p + 3] < 10) continue;
    a[p] = b[q]; a[p + 1] = b[q + 1]; a[p + 2] = b[q + 2]; a[p + 3] = b[q + 3];
  }
  ctx.putImageData(me, 0, 0);
}
// → { key, frame } of the derived tile (made once per variant and kept in the texture manager)
// v = { capL, capR, under, roof, crust: frame of a surface tile (for under = crust), seamL / seamR: { key, frame } of the neighbour }
export function autoTile(scene, kit, frame, v) {
  const A = autotileOf(kit), sig = [v.roof ? 'roof:' + A.roof : '', v.capL && A.caps ? 'l' : '', v.capR && A.caps ? 'r' : '', v.under ? 'u:' + A.under : '',
    v.seamL ? `sl:${v.seamL.key}:${v.seamL.frame}` : '', v.seamR ? `sr:${v.seamR.key}:${v.seamR.frame}` : ''].filter(Boolean).join('|');
  if (!sig) return { key: kit.key, frame };
  const id = `auto|${kit.key}|${frame}|${sig}`;
  if (scene.textures.exists(id)) return { key: id, frame: '__BASE' };
  const P = pixels(scene, kit.key, frame), o = kit.over, { w, h } = P;
  const tex = scene.textures.createCanvas(id, w, h), ctx = tex.getContext();
  ctx.drawImage(P.c, 0, 0);
  if (v.roof && A.roof !== 'none') roofCover(ctx, w, o, A.roof, typeof frame === 'number' ? frame : 1);
  if (v.seamL && A.seam > 0) seam(ctx, w, h, pixels(scene, v.seamL.key, v.seamL.frame), true, A.seam);
  if (v.seamR && A.seam > 0) seam(ctx, w, h, pixels(scene, v.seamR.key, v.seamR.frame), false, A.seam);
  if (v.under && A.under !== 'none') under(ctx, w, h, A.under, v.crust != null ? { ...pixels(scene, kit.key, v.crust), o } : null);
  if (v.capL && A.caps) cap(ctx, w, o, true);
  if (v.capR && A.caps) cap(ctx, w, o, false);
  tex.refresh();
  return { key: id, frame: '__BASE' };
}
// inner corner (a floor at the foot of a wall going up): soft shade in the crust where floor meets wall
export function innerCorner(g, px, py, T, left) {
  for (let i = 0; i < 4; i++) { const a = 0.24 * (1 - i / 4); g.fillStyle(0x07050c, a).fillRect(left ? px + i * 5 : px + T - (i + 1) * 5, py - 6, 5, 24); }
}

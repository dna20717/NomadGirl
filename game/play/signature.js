// Leyla's signature colour (#044, Daniel 16.11.2026: „Leyla ohne neue Grafiken die Möglichkeit geben, ihre Haare zu färben“; Antworten:
// Signaturfarbe, Spiegel im Camp, Färbemittel herstellen, feste Liste aus AAP-64). Her hair and the accents of her outfit share the
// same pink shades, so they change together: a colour swap (like the raider kit, enemy_kit.js swapper) over every texture of her look.
// Leyla › Signaturfarbe: which shades count (hue range, saturation, middle lightness) and the colours (name, colour, Färbemittel).
// The savegame keeps save.look = { color: index in the list (0 = as painted), unlocked: [indices] }.
import { swapper } from './enemy_kit.js';

export const sig = D => D.leyla?.signature || {};
export const colors = D => sig(D).colors || [];
// the colour Leyla wears now (a row of the list) or null = as painted
export function current(D, save) { const i = save?.look?.color ?? 0, c = colors(D)[i]; return i > 0 && c?.color ? c : null; }
export function swapFor(D, save) {
  const c = current(D, save), S = sig(D);
  if (!c) return null;
  const [h0, h1] = S.hue || [290, 350];
  return swapper([{ hueFrom: h0, hueTo: h1, satMin: S.satMin ?? 35, mid: S.mid ?? 55, sat: (S.sat ?? 75) / 100, to: c.color }]);
}
// what the mirror shows: every colour with its state; unlocked = free to put on again
export function mirrorRows(D, save, have) {
  const L = save.look || {}, un = new Set([0, ...(L.unlocked || [])]);
  return colors(D).map((c, i) => ({ i, name: c.name || `Farbe ${i + 1}`, color: c.color || null, item: c.item || null, on: (L.color ?? 0) === i, unlocked: un.has(i) || !c.item, have: c.item ? have(c.item) : 0 }));
}
// dye: unlock (one packet used up, if it was not unlocked) and wear it. take(id, n) → how many were taken. → { ok, used, reason }
export function dye(D, save, i, take) {
  const c = colors(D)[i];
  if (!c) return { ok: false, reason: 'Unbekannte Farbe' };
  const L = save.look ??= { color: 0, unlocked: [] };
  L.unlocked ??= [];
  let used = false;
  if (i && c.item && !L.unlocked.includes(i)) {
    if (take(c.item, 1) < 1) return { ok: false, reason: `Fehlt: ${D.items?.[c.item]?.name || c.item}` };
    L.unlocked.push(i); used = true;
  }
  L.color = i;
  return { ok: true, used };
}

// ---------- textures ----------
const ORIG = '__signatureOriginals';
// every texture of Leyla's look gets the colour; the painted originals are kept (per game) so a later colour starts from them.
// Called in create() before Leyla is built; animations and skinned copies (gun_skins.js, „id@skin“) are made again on demand.
export function applySignature(scene) {
  const D = scene.data_, save = scene.box?.save, swap = swapFor(D, save), key = current(D, save)?.color || '';
  const orig = scene.game[ORIG] ??= {};
  if ((scene.game.__signatureKey ?? '') === key) return false;
  const ids = new Set(Object.values(D.leyla?.look || {}).filter(id => id && D.assets?.[id]?.kind === 'animation'));
  for (const id of ids) {
    if (!scene.textures.exists(id)) continue;
    const A = D.assets[id], [fw, fh] = A.frameSize;
    const src = orig[id] ??= scene.textures.get(id).getSourceImage();
    const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    if (swap) recolor(ctx, cv.width, cv.height, swap);
    const filter = scene.textures.get(id).source[0]?.scaleMode ?? 0;
    for (const k of scene.textures.getTextureKeys()) if (k.startsWith(id + '@')) { scene.anims.remove(k); scene.textures.remove(k); }
    scene.anims.remove(id);
    scene.textures.remove(id);
    scene.textures.addSpriteSheet(id, swap ? cv : src, { frameWidth: fw, frameHeight: fh });
    scene.textures.get(id).setFilter(filter);
  }
  scene.game.__signatureKey = key;
  return true;
}
function recolor(ctx, w, h, swap) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const v = swap(d[i], d[i + 1], d[i + 2]); if (v) { d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; } }
  ctx.putImageData(img, 0, 0);
}
// a picture (URL) in Leyla's colour → data URL (the inventory portrait, the mirror preview); cached per URL and colour
const shots = new Map();
export function dyedUrl(D, save, url, onReady) {
  const swap = swapFor(D, save), key = (current(D, save)?.color || '') + '|' + url;
  if (!swap) return url;
  if (shots.has(key)) return shots.get(key) || url;
  shots.set(key, null);
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0); recolor(ctx, cv.width, cv.height, swap);
    shots.set(key, cv.toDataURL()); onReady?.();
  };
  img.src = url;
  return url;
}

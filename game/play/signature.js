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
export function swapFor(D, save) { return swapOf(D, current(D, save)); }
// the swap for one row of the list (null = as painted)
export function swapOf(D, c) {
  const S = sig(D);
  if (!c?.color) return null;
  const [h0, h1] = S.hue || [290, 350];
  return swapper([{ hueFrom: h0, hueTo: h1, satMin: S.satMin ?? 35, mid: S.mid ?? 55, sat: (S.sat ?? 75) / 100, to: c.color }]);
}
// what the mirror shows: every colour with its state; unlocked = free to put on again
export function mirrorRows(D, save, have) {
  const L = save.look || {}, un = new Set([0, ...(L.unlocked || [])]);
  return colors(D).map((c, i) => ({ i, name: c.name || `Farbe ${i + 1}`, brand: D.brands?.[c.brand]?.name || '', color: c.color || null, item: c.item || null, on: (L.color ?? 0) === i, unlocked: un.has(i) || !c.item, have: c.item ? have(c.item) : 0 }));
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

// #092 (Daniel 19.11.2026: „dass man Farbe im Inventar lernen kann … unabhängig vom Spiegel“): the colour of a Färbemittel
// → its index in Leyla › Signaturfarbe › Farben, or -1
export const colorOfItem = (D, id) => colors(D).findIndex((c, i) => i > 0 && c.item === id);
export const knowsColor = (save, i) => i === 0 || (save?.look?.unlocked || []).includes(i);
// learn it from the packet (the packet is used up), wear it later at the mirror → { ok, i, name } or { ok: false, reason }
export function learnColor(D, save, id) {
  const i = colorOfItem(D, id);
  if (i < 0) return { ok: false, reason: 'Kein Färbemittel' };
  if (knowsColor(save, i)) return { ok: false, reason: 'Schon gelernt' };
  const L = save.look ??= { color: 0, unlocked: [] };
  (L.unlocked ??= []).push(i);
  return { ok: true, i, name: colors(D)[i].name || `Farbe ${i + 1}` };
}

// ---------- textures ----------
const ORIG = '__signatureOriginals';
// every texture of Leyla's look gets the colour; the painted originals are kept (per game) so a later colour starts from them.
// Called in create() before Leyla is built; animations and skinned copies (gun_skins.js, „id@skin“) are made again on demand.
export function applySignature(scene) {
  const D = scene.data_, save = scene.box?.save, swap = swapFor(D, save), key = current(D, save)?.color || '';
  const orig = scene.game[ORIG] ??= {};
  if ((scene.game.__signatureKey ?? '') === key) return false;
  // every animation of Leyla: her look, the painted other direction (Asset › Gegenrichtung), rifles, random idles, sitting … (all „leyla_*“)
  const A = D.assets || {}, ids = new Set([...Object.values(D.leyla?.look || {}), ...Object.keys(A).filter(k => k.startsWith('leyla_'))].filter(id => A[id]?.kind === 'animation'));
  for (const id of [...ids]) if (A[A[id]?.mirror]?.kind === 'animation') ids.add(A[id].mirror);
  for (const id of ids) {
    if (!scene.textures.exists(id)) continue;
    const [fw, fh] = A[id].frameSize;
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
  // the scene keeps Leyla's looks over restarts (scene.js playLook: this.looks); they pointed at the old animations:
  // forget them and build the animations again, otherwise she plays nothing after a new colour (Daniel, 16.11.2026: „Animations-Reihenfolge kaputt“)
  scene.looks = {};
  for (const id of ids) if (scene.textures.exists(id)) scene.assetInfo?.(id);
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
// index: a colour of the list instead of the one she wears (the mirror shows the focused colour)
export function dyedUrl(D, save, url, onReady, index = null) {
  const row = index == null ? current(D, save) : colors(D)[index], swap = swapOf(D, row), key = (row?.color || '') + '|' + url;
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

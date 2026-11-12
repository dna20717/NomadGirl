// Gun skins from code (Daniel, 12.11.2026: „ohne einen Sprite anzufassen mal einen Test machen für einen Revolver: du legst Code-Grafik
// drüber und wir proben den Switch“). Leyla's animations are painted with the nail gun in her hands. For a weapon with Waffen › Aussehen
// aus Code (`skin`), every pose with the gun held out gets a copy of its strip at load time (the files stay untouched): in each frame the
// painted gun is found (the dark, grey cluster at the very front of the arms), its slide is cut away and the skin is painted in its place,
// grip and hand stay as they are. Poses with the gun at the chest keep the painted gun for now (that needs real art later).

// looks that hold the gun stretched out in front (Leyla › Aussehen)
export const SKIN_LOOKS = ['aim', 'aimWalk', 'shoot', 'shootWalk', 'runGun'];

const C = { line: [5, 4, 7], dark: [33, 28, 55], body: [71, 63, 99], light: [128, 120, 160], shine: [196, 190, 220], brass: [227, 166, 72], brassD: [160, 104, 40], wood: [122, 72, 48] };

// the painted gun in one frame (facing right): its slide band and tip, or null
function findGun(px, W, H) {
  const at = (x, y) => (y * W + x) * 4, alpha = (x, y) => px[at(x, y) + 3];
  let tx = -1, ty = -1;
  for (let y = Math.floor(H * 0.12); y < H * 0.4; y++) for (let x = W - 1; x > tx; x--) if (alpha(x, y)) { tx = x; ty = y; break; }
  if (tx < 0) return null;
  const gunlike = (x, y) => {
    const i = at(x, y); if (!px[i + 3]) return false;
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    const s = mx === mn ? 0 : l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
    return l < 0.62 && (s < 0.42 || l < 0.12);
  };
  const seen = new Set(), st = [[tx, ty]], maxLen = Math.round(W * 0.28);
  while (st.length) {
    const [x, y] = st.pop(), k = y * W + x;
    if (x < 0 || y < 0 || x >= W || y >= H || seen.has(k) || x < tx - maxLen || Math.abs(y - ty) > 30 || !gunlike(x, y)) continue;
    seen.add(k); st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  if (seen.size < 40) return null;
  // the slide = the wide rows near the top of the cluster (sights stick out above, the hand hangs below)
  const rows = new Map();
  for (const k of seen) { const x = k % W, y = (k - x) / W; const r = rows.get(y) || [x, x]; rows.set(y, [Math.min(r[0], x), Math.max(r[1], x)]); }
  const ys = [...rows.keys()].sort((a, b) => a - b), first = ys[0], wd = y => rows.has(y) ? rows.get(y)[1] - rows.get(y)[0] + 1 : 0;
  const near = ys.filter(y => y < first + 14), wide = Math.max(...near.map(wd));
  const top = near.find(y => wd(y) >= wide * 0.6);
  let bottom = top;
  while (wd(bottom + 1) >= wide * 0.6 && bottom - top < 9) bottom++;
  let x0 = W;
  for (let y = top; y <= bottom; y++) if (rows.has(y)) x0 = Math.min(x0, rows.get(y)[0]);
  if (tx - x0 < 15) return null;
  // cut away: sights + slide, plus what hangs under its front half (dust cover), never the hand further back
  const front = x0 + Math.round((tx - x0) * 0.45);
  const cells = [...seen].filter(k => { const y = Math.floor(k / W), x = k % W; return y <= bottom || (x >= front && y <= bottom + 4); });
  return { top, bottom, x0, tip: tx, cells };
}

// the skin's shape: a list of [x, y, colour] in frame pixels, built around the slide band g
function revolver(g) {
  const L = g.tip - g.x0 + 1, ext = Math.round(L * 0.3), sh = g.bottom - g.top + 1;
  const cyl0 = g.x0 + Math.round(L * 0.18), cw = Math.max(6, Math.round(L * 0.3)), end = g.tip + ext, t = g.top, b = g.top + sh;
  const shape = new Map(), put = (x, y, c) => shape.set(`${x},${y}`, [x, y, c]);
  // frame behind the cylinder (over the hand) + hammer spur
  for (let x = g.x0; x < cyl0; x++) for (let y = t + 1; y < b; y++) put(x, y, y === t + 1 ? C.light : y === b - 1 ? C.dark : C.body);
  put(g.x0 + 1, t, C.body); put(g.x0, t - 1, C.body); put(g.x0 - 1, t - 1, C.dark);
  // cylinder: a little taller than the slide, flutes, brass rim at the front
  for (let x = cyl0; x < cyl0 + cw; x++) for (let y = t; y <= b; y++)
    put(x, y, x === cyl0 + cw - 1 ? (y < t + 2 ? C.brass : C.brassD) : y === t ? C.shine : y === b ? C.dark : (x - cyl0) % 2 ? C.dark : C.light);
  // barrel: 4 px with rib and front sight, ejector rod below its back two thirds
  const by = t + 1;
  for (let x = cyl0 + cw; x <= end; x++) { put(x, by, C.shine); put(x, by + 1, C.light); put(x, by + 2, C.body); put(x, by + 3, C.dark); }
  put(end - 1, by - 1, C.body); put(end - 2, by - 1, C.body);
  for (let x = cyl0 + cw; x < cyl0 + cw + Math.round((end - cyl0 - cw) * 0.65); x++) put(x, by + 4, C.dark);
  // outline: every free neighbour of the shape becomes a line pixel
  const out = [...shape.values()];
  for (const [x, y] of [...shape.values()]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const k = `${x + dx},${y + dy}`; if (!shape.has(k)) { shape.set(k, [x + dx, y + dy, C.line]); out.push([x + dx, y + dy, C.line]); }
  }
  return out;
}
const SKINS = { revolver };

// a skinned copy of an animation strip → its texture key (made once); the frames keep their size, so origin and timing stay
export function skinnedLook(scene, id, skin) {
  const key = `${id}@${skin}`, A = scene.data_.assets?.[id];
  if (scene.textures.exists(key)) return key;
  const paint = SKINS[skin];
  if (!paint || !A || A.kind !== 'animation' || !scene.textures.exists(id)) return null;
  const src = scene.textures.get(id).getSourceImage(), [fw, fh] = A.frameSize, n = A.frames || 1, left = !!A.flip;
  const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  let last = null;
  for (let i = 0; i < n; i++) {
    // work facing right: a frame painted facing left is mirrored first and mirrored back at the end
    const fc = document.createElement('canvas'); fc.width = fw; fc.height = fh;
    const f = fc.getContext('2d', { willReadFrequently: true });
    if (left) { f.translate(fw, 0); f.scale(-1, 1); }
    f.drawImage(src, i * fw, 0, fw, fh, 0, 0, fw, fh);
    f.setTransform(1, 0, 0, 1, 0, 0);
    const img = f.getImageData(0, 0, fw, fh), px = img.data;
    const g = findGun(px, fw, fh) || last;   // muzzle-flash frames: the gun from the frame before
    if (g) {
      if (g !== last) for (const k of g.cells) px[k * 4 + 3] = 0;   // cut the painted slide away
      for (const [x, y, c] of paint(g)) if (x >= 0 && y >= 0 && x < fw && y < fh) { const k = (y * fw + x) * 4; px[k] = c[0]; px[k + 1] = c[1]; px[k + 2] = c[2]; px[k + 3] = 255; }
      last = g;
    }
    f.putImageData(img, 0, 0);
    ctx.save();
    if (left) { ctx.translate((i + 1) * fw, 0); ctx.scale(-1, 1); ctx.drawImage(fc, 0, 0); } else ctx.drawImage(fc, i * fw, 0);
    ctx.restore();
  }
  scene.textures.addSpriteSheet(key, cv, { frameWidth: fw, frameHeight: fh });
  scene.textures.get(key).setFilter(scene.textures.get(id).source[0].scaleMode ?? 0);
  if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: A.fps || 8, repeat: A.loop === false ? 0 : -1 });
  return key;
}

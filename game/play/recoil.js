// Slide recoil from the existing pixels (Daniel, 11.11.2026: "ohne neue Grafiken den Schlitten der Waffe bei jedem Schuss bewegen").
// Assets name the slide per frame (Assets › Schlitten: frame + box in frame pixels). For a shot the frame is copied once into a canvas,
// the opaque pixels inside the box move back by "Schlitten zurück" px and the front gap gets a short dark barrel. Leyla shows that copy
// for a moment on an overlay sprite while the animation keeps running underneath.

// rows of Assets › Schlitten that fit a frame (frame 0 = every frame, 1 = first)
export function slideBox(asset, index) {
  const rows = asset?.slide || [];
  const r = rows.find(x => Number(x.frame) === index + 1) || rows.find(x => !Number(x.frame));
  if (!r?.from || !r?.to) return null;
  return [Math.min(r.from[0], r.to[0]), Math.min(r.from[1], r.to[1]), Math.max(r.from[0], r.to[0]), Math.max(r.from[1], r.to[1])];
}

// pure pixel work (also used by the tests): data = RGBA of the whole frame, w × h; box inclusive; dir = +1 slide moves to the left (gun points right)
export function shiftSlide(data, w, h, box, shift, dir = 1) {
  const [x0, y0, x1, y1] = box, out = new Uint8ClampedArray(data);
  const at = (x, y) => (y * w + x) * 4;
  let rowsWith = [];
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
    const cells = [];
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) if (data[at(x, y) + 3]) cells.push(x);
    if (!cells.length) continue;
    rowsWith.push(y);
    // clear the row inside the box, then paint it again moved back
    for (const x of cells) out.fill(0, at(x, y), at(x, y) + 4);
    for (const x of cells) {
      const nx = x - dir * shift;
      if (nx < 0 || nx >= w) continue;
      const i = at(nx, y), j = at(x, y);
      for (let c = 0; c < 4; c++) out[i + c] = data[j + c];
    }
  }
  if (!rowsWith.length) return out;
  // the barrel sticks out where the slide was: darkest colour of the slide, middle rows only, one shade lighter rim
  let dark = null, lum = 1e9;
  for (const y of rowsWith) for (let x = x0; x <= x1; x++) {
    const j = at(x, y);
    if (data[j + 3] && data[j] + data[j + 1] + data[j + 2] < lum) { lum = data[j] + data[j + 1] + data[j + 2]; dark = [data[j], data[j + 1], data[j + 2]]; }
  }
  const top = rowsWith[0], bot = rowsWith[rowsWith.length - 1], n = bot - top + 1;
  const b0 = top + Math.floor(n * 0.45), b1 = Math.max(b0, top + Math.floor(n * 0.75) - 1);
  for (let y = b0; y <= b1; y++) {
    let front = -1;   // front end of the original row
    for (let x = x0; x <= x1; x++) if (data[at(x, y) + 3]) front = dir > 0 ? Math.max(front, x) : (front < 0 ? x : Math.min(front, x));
    if (front < 0) continue;
    for (let k = 0; k < shift; k++) {
      const x = front - dir * k, i = at(x, y);
      if (x < 0 || x >= w || out[i + 3]) continue;
      out[i] = dark[0]; out[i + 1] = dark[1]; out[i + 2] = dark[2]; out[i + 3] = 255;
    }
  }
  return out;
}

// texture of one frame with the slide back (made once, then cached); null if the asset names no slide for that frame
export function recoilTexture(scene, id, index) {
  const key = `${id}~recoil~${index}`;
  if (scene.textures.exists(key)) return key;
  const a = scene.data_.assets?.[id], box = slideBox(a, index);
  if (!box || !scene.textures.exists(id)) return null;
  const fr = scene.textures.get(id).get(index);
  if (!fr) return null;
  const w = fr.cutWidth, h = fr.cutHeight, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(fr.source.image, fr.cutX, fr.cutY, w, h, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  img.data.set(shiftSlide(img.data, w, h, box, a.slideShift ?? 3, a.flip ? -1 : 1));
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, cv);   // same smoothing as the animation itself
  return key;
}

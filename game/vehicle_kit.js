// Vehicles from a tileset (#076, Daniel 19.11.2026: „Tileset jetzt einbauen: Van im Code aus den Teilen zusammensetzen“).
// A kit picture has two rows of the same width (row 1 closed, row 2 the cutaway) and fixed columns:
//   rear 0 … rear | bay 1 rear … bay | strut bay … strut | bay 2 strut … bay2 | cab bay2 … width
// A vehicle with n workshop places becomes rear + bay 1 + (strut + bay 2) × (n − 1) + cab. With n = 2 that is the picture itself,
// pixel for pixel. Everything measured in image pixels behind bay 2 (the cab: door, anchor, dish) moves right by `shift`.
// No DOM here (layout + data); composeKits() at the bottom draws the strips in the browser.

// kit: { asset, rear, bay, strut, bay2 } (column ends), w = frame width → { width, shift, pieces: [{ sx, sw, dx }], bays: [[x0, x1]] }
export function kitLayout(kit, n, w) {
  const a = kit.rear, b = kit.bay, c = kit.strut, d = kit.bay2;
  if (!(a > 0 && b > a && c > b && d > c && w > d)) return null;
  n = Math.max(1, Math.round(n) || 1);
  const pieces = [{ sx: 0, sw: a, dx: 0 }], bays = [];
  let x = a;
  pieces.push({ sx: a, sw: b - a, dx: x }); bays.push([x, x + b - a]); x += b - a;
  for (let i = 1; i < n; i++) {
    pieces.push({ sx: b, sw: c - b, dx: x }); x += c - b;
    pieces.push({ sx: c, sw: d - c, dx: x }); bays.push([x, x + d - c]); x += d - c;
  }
  pieces.push({ sx: d, sw: w - d, dx: x }); x += w - d;   // one bay: strut and bay 2 stay out, the cab follows bay 1 directly
  return { width: x, shift: x - w, pieces, bays };
}
// image x of the original picture → x in the composed one (behind bay 2 = the cab moves)
export const shiftX = (L, kit, x) => (x >= kit.bay2 ? x + L.shift : x);

// the data of a kit vehicle: the asset entry for the composed strip, the tractor's door and bays, the spawn point (roof, dish)
// → { id, asset, tractor, spawn } (copies; nothing is changed) or null
export function kitData(D, tid) {
  const T = D.tractors?.[tid], K = T?.kit, base = D.assets?.[T?.look], src = D.assets?.[K?.asset];
  if (!K?.asset || !base || !src || base.kind !== 'animation' || !base.frameSize) return null;
  const [w, h] = base.frameSize, L = kitLayout(K, T.places || 1, w);
  if (!L) return null;
  const id = `${T.look}__kit${T.places || 1}`, sx = x => shiftX(L, K, x);
  const asset = { ...base, file: null, frameSize: [L.width, h], origin: base.origin ? [sx(base.origin[0]), base.origin[1]] : [L.width / 2, h], derivedFrom: K.asset, kit: true };
  const Dr = T.door || {}, B0 = Dr.bays || [], y = B0[0]?.y || Dr.y || [0, h];
  const bays = L.bays.map((x, i) => ({ x, y: B0[Math.min(i, B0.length - 1)]?.y || y, place: i }));
  const door = { ...Dr, x: [bays[0].x[0], bays[bays.length - 1].x[1]], bays, ...(Dr.enter != null ? { enter: sx(Dr.enter) } : {}) };
  const tractor = { ...T, look: id, door };
  const S = D.game?.spawn, spawn = S && S.look === T.look ? { ...S, look: id,
    roof: S.roof?.x ? { ...S.roof, x: [S.roof.x[0], sx(S.roof.x[1])] } : S.roof,
    dish: S.dish?.at ? { ...S.dish, at: [sx(S.dish.at[0]), S.dish.at[1]] } : S.dish } : null;
  return { id, asset, tractor, spawn, layout: L, frames: base.frames || 5, size: [w, h] };
}

// browser: draw every kit vehicle into a strip (closed → open as a cross-fade, like tools/van_side.py) and put it into the data
// (assets, tractors, game.spawn) before the game starts. A picture that does not load leaves the vehicle as it was.
export async function composeKits(D, base) {
  for (const tid of Object.keys(D.tractors || {})) {
    const k = kitData(D, tid);
    if (!k) continue;
    try {
      const img = new Image(); img.src = new URL(D.assets[D.tractors[tid].kit.asset].file, base).href; await img.decode();
      const [w, h] = k.size, W = k.layout.width, n = k.frames, cv = document.createElement('canvas');
      cv.width = W * n; cv.height = h;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      for (let f = 0; f < n; f++) for (const [row, alpha] of [[0, 1], [1, n > 1 ? f / (n - 1) : 1]]) {
        if (!alpha) continue;
        g.globalAlpha = alpha;
        for (const p of k.layout.pieces) g.drawImage(img, p.sx, row * h, p.sw, h, f * W + p.dx, 0, p.sw, h);
      }
      D.assets[k.id] = { ...k.asset, file: cv.toDataURL('image/png') };
      D.tractors[tid] = k.tractor;
      if (k.spawn) D.game.spawn = k.spawn;
    } catch (e) { console.warn(`Fahrzeug-Tileset ${tid}: ${e?.message || e}`); }
  }
}

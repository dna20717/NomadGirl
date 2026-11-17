// Code portraits of the Glitchlings (#048, Daniel 17.11.2026: „jeweils ein individuelles, animiertes Code-Porträt, das gleichzeitig das
// Item-Bild ist (in diesem Fall auch animiert)“). No assets: every Glitchling is a little screen in a bezel, a face of light on lines of
// code. Everything comes from its traits, so the same Glitchling always has the same face:
//   first name word → colour of the light (Amber orange, Cobalt blue …), second word → eyes and mouth, the name → screen shape,
//   glass and bezel; talent → what it wears (chef's hat, propeller, fedora …); bits → the lamps on the bezel; quirk kind → how it glitches;
//   unique ones get a gold rim.
// Since 17.11.2026 (Daniel: „mehr wie digitale Geister und weniger wie Fernseher … die Mimiken weiterhin aus dem Code, aber die Köpfe cool
// gepixelt“) Glitchlings are ghosts: a head from the sheet glitch_heads (PixelLab, pale with an empty black face), tinted in the
// Glitchling's light; the face (eyes, mouth, blinking, glitches) is drawn into the black void by code; it floats. The screen faces stay for
// Kammerjäger (software, no ghost) and as long as the heads are not loaded (Node, tests). renderGhost() paints that, setHeads() gives the heads.
// renderFace(g, t) paints one frame into RGBA pixels (SIZE × SIZE, no DOM: tests and Node), drawGlitchFace() puts it on a canvas,
// animateFace() keeps a canvas moving while it is on the page (workshop cards, later the item picture in the inventory).
import { rng } from './worldmap.js';

export const SIZE = 40;
export const FPS = 12;

const hex = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
// AAP-64: the light of the face by the first name word; unknown words get one of the bright ones
const TINT = { Marble: 'b3b9d1', Amber: 'ffd541', Velvet: 'e86a73', Chrome: 'dae0ea', Rust: 'df3e23', Neon: '20d6c7', Paper: 'fef3c0', Glass: 'a6fcdb',
  Ivory: 'f4d29c', Copper: 'bb7547', Static: 'e3e6ff', Moss: '9cdb43', Ink: '588dbe', Salt: 'cdf7e2', Honey: 'fffc40', Cinder: 'fa6a0a', Pearl: 'e9b5a3',
  Ash: '8b93af', Tin: '92dcba', Silk: 'fad6b8', Smoke: '849be4', Opal: '5daf8d', Cobalt: '249fde', Saffron: 'f9a31b', Frost: 'b9bffb', Quartz: 'ffffff',
  Plum: 'bc4a9b', Ochre: 'dba463', Indigo: '285cc4', Coral: 'f5a097', Lacquer: 'b4202a', Tinsel: 'd6f264' };
const BRIGHT = ['20d6c7', 'ffd541', '9cdb43', 'f5a097', '249fde', 'fa6a0a', 'a6fcdb', 'bc4a9b'];
const GLASS = ['141013', '143464', '24523b', '242234', '122020', '3b1725'];
const BEZEL = ['4a5462', '71413b', '5a4e44', '333941', '403353', '796755', '8e5252', '477d85'];
const GOLD = hex('ffd541'), LAMP = hex('20d6c7'), DARK = hex('060608'), WHITE = hex('ffffff');
export const SHAPES = ['crt', 'wide', 'round', 'tall'];
export const EYES = ['dots', 'blocks', 'bars', 'arcs', 'rings', 'odd'];
export const MOUTHS = ['smile', 'flat', 'o', 'zigzag', 'smirk', 'cat'];
// what a talent wears (by its stat, the name is free text in the workshop)
export const WEARS = { perfect: 'chef', refund: 'visor', growth: 'sprout', power: 'bolt', strain: 'cross', fuel: 'antenna', weaponDamage: 'crosshair',
  battery: 'propeller', rest: 'bowtie', value: 'monocle', freshness: 'snow', sleepHeal: 'zzz', archaeology: 'fedora' };

const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// the traits of a face (stable per Glitchling)
export function faceOf(g) {
  const [a = '', b = ''] = String(g.name || g.id || '').split(/\s+/), h = hash(g.id || g.name), hb = hash(b), r = rng(h);
  const tint = hex(TINT[a] || BRIGHT[hash(a) % BRIGHT.length]);
  // a Kammerjäger (#050, AntiGlitchling-Software): always the same stiff face, red light on a wide black screen, never glitches
  if (g.hunter) return { tint: hex(['df3e23', 'fa6a0a', 'e86a73', 'b4202a'][h % 4]), glass: hex('060608'), bezel: hex(['333941', '4a5462', '242234'][(h >>> 3) % 3]), shape: 'wide',
    eyes: 'bars', mouth: 'flat', wears: null, bits: 0, glitch: null, unique: false, blink: 99, phase: r() * 10, talk: 99, seed: h, hunter: true };
  return { tint, glass: hex(GLASS[h % GLASS.length]), bezel: hex(BEZEL[(h >>> 4) % BEZEL.length]), shape: SHAPES[(h >>> 8) % SHAPES.length],
    eyes: EYES[hb % EYES.length], mouth: MOUTHS[(hb >>> 5) % MOUTHS.length], wears: WEARS[g.stat] || null, bits: Math.max(0, Math.min(5, g.bits || 0)),
    glitch: g.quirkKind || null, unique: !!g.unique, blink: 2.4 + r() * 3.5, phase: r() * 10, talk: 3 + r() * 4, seed: h };
}

// the screen of a shape: bezel box and a test for „inside the glass“
function frame(shape) {
  const S = SIZE;
  if (shape === 'round') { const cx = 20, cy = 22, R = 15; return { cx, cy, box: [cx - R, cy - R, R * 2, R * 2], bezel: (x, y) => (x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2 <= R * R, glass: (x, y) => (x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2 <= (R - 3) ** 2, gap: 5 }; }
  const [x, y, w, h] = shape === 'wide' ? [2, 11, 36, 24] : shape === 'tall' ? [8, 7, 24, 31] : [4, 8, 32, 28];
  const round = (px, py, x0, y0, w0, h0, k) => { if (px < x0 || py < y0 || px >= x0 + w0 || py >= y0 + h0) return false; const dx = Math.max(x0 + k - 1 - px, px - (x0 + w0 - k), 0), dy = Math.max(y0 + k - 1 - py, py - (y0 + h0 - k), 0); return dx * dx + dy * dy <= k * k; };
  return { cx: x + w / 2, cy: y + h / 2 + (shape === 'tall' ? -2 : 0), box: [x, y, w, h], bezel: (px, py) => round(px, py, x, y, w, h, 4), glass: (px, py) => round(px, py, x + 3, y + 3, w - 6, h - 6 - (shape === 'tall' ? 5 : 0), 3), gap: shape === 'wide' ? 7 : shape === 'tall' ? 5 : 6, S };
}

// one frame: RGBA pixels, t in seconds (quantized to FPS: it moves like an old screen)
export function renderFace(g, t = 0, out = null) {
  const F = faceOf(g), S = SIZE, px = out || new Uint8ClampedArray(S * S * 4);
  px.fill(0);
  const fr = Math.floor(t * FPS), T = fr / FPS, r = rng(F.seed + fr * 7919), M = frame(F.shape);
  const put = (x, y, c, a = 1) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= S || y >= S) return; const i = (y * S + x) * 4, k = px[i + 3] ? a : 1; px[i] = px[i] * (1 - k) + c[0] * k; px[i + 1] = px[i + 1] * (1 - k) + c[1] * k; px[i + 2] = px[i + 2] * (1 - k) + c[2] * k; px[i + 3] = Math.max(px[i + 3], a * 255); };
  const mix = (c, d, k) => [c[0] + (d[0] - c[0]) * k, c[1] + (d[1] - c[1]) * k, c[2] + (d[2] - c[2]) * k];
  const rect = (x, y, w, h, c, a) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c, a); };

  // bezel with light from above, gold rim for the unique ones
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (M.bezel(x, y)) {
    const edge = !M.bezel(x - 1, y) || !M.bezel(x + 1, y) || !M.bezel(x, y - 1) || !M.bezel(x, y + 1);
    put(x, y, edge ? (F.unique ? GOLD : mix(F.bezel, DARK, 0.45)) : !M.bezel(x, y - 2) ? mix(F.bezel, WHITE, 0.25) : !M.bezel(x, y + 2) ? mix(F.bezel, DARK, 0.3) : F.bezel);
  }
  // the glass with lines of code scrolling up (a dim version of its light)
  const mood = F.glitch === 'mood' ? 0.85 + 0.15 * Math.sin(T * 1.7 + F.phase) : 1, light = mix(F.glass, F.tint, mood), code = mix(F.glass, F.tint, 0.2);
  const scroll = Math.floor(T * 4);
  for (let y = 0; y < S; y++) {
    const row = y + scroll, lr = rng(F.seed ^ (row * 2654435761)), indent = Math.floor(lr() * 4) * 2, len = 3 + Math.floor(lr() * 14), gap = lr() < 0.3;
    for (let x = 0; x < S; x++) if (M.glass(x, y)) {
      const cx = x - M.box[0] - 4;
      put(x, y, row % 2 === 0 && !gap && cx >= indent && cx < indent + len && (cx - indent) % 6 !== 4 ? code : F.glass);
    }
  }
  // the face: eyes and mouth in its light, with a soft glow
  const glow = [];
  const dot = (x, y) => glow.push([Math.round(x), Math.round(y)]);
  const cx = M.cx, ey = M.cy - 3, my = M.cy + 4, d = M.gap / 2 + 1.5;
  const blinkAt = (T + F.phase) % F.blink, shut = blinkAt < 0.17 || (F.glitch === 'time' && Math.sin(T * 0.5 + F.phase) > 0.7);
  const look = F.glitch === 'neighbour' ? Math.round(Math.sin(T * 0.9 + F.phase) * 1.4) : F.glitch === 'odd' && r() < 0.15 ? (r() < 0.5 ? -1 : 1) : Math.round(Math.sin(T * 0.4 + F.phase) * 0.7);
  for (const s of [-1, 1]) {
    const x = Math.round(cx + s * d - 0.5) + look, y = ey;
    if (shut) { for (let i = -1; i <= 1; i++) dot(x + i, y + 1); continue; }
    if (F.eyes === 'dots') { dot(x, y); dot(x + 1, y); dot(x, y + 1); dot(x + 1, y + 1); }
    else if (F.eyes === 'blocks') { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) dot(x + i, y + j + 1); }
    else if (F.eyes === 'bars') { for (let i = -1; i <= 2; i++) dot(x + i, y + 1); }
    else if (F.eyes === 'arcs') { dot(x - 1, y + 1); dot(x, y); dot(x + 1, y); dot(x + 2, y + 1); }
    else if (F.eyes === 'rings') { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (i || j) dot(x + i, y + j); }
    else { const big = s < 0; if (big) { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) dot(x + i, y + j); } else dot(x, y); }
    if (F.glitch === 'time' && !shut && Math.sin(T * 0.5 + F.phase) > 0.3) for (let i = -1; i <= 2; i++) dot(x + i, y - 2);   // sleepy lids
  }
  const talking = (T + F.phase * 3) % F.talk < 1 && fr % 3 !== 0;
  const mouth = talking ? 'o' : F.mouth;
  if (mouth === 'smile') { dot(cx - 3, my - 1); for (let i = -2; i <= 1; i++) dot(cx + i, my); dot(cx + 2, my - 1); }
  else if (mouth === 'flat') for (let i = -2; i <= 2; i++) dot(cx + i - 0.5, my);
  else if (mouth === 'o') { dot(cx - 1, my - 1); dot(cx, my - 1); dot(cx - 2, my); dot(cx + 1, my); dot(cx - 1, my + 1); dot(cx, my + 1); }
  else if (mouth === 'zigzag') for (let i = -3; i <= 2; i++) dot(cx + i, my - ((i & 1) ? 1 : 0));
  else if (mouth === 'smirk') { for (let i = -2; i <= 1; i++) dot(cx + i, my); dot(cx + 2, my - 1); dot(cx + 3, my - 2); }
  else { dot(cx - 3, my - 1); dot(cx - 2, my); dot(cx - 1, my - 1); dot(cx, my); dot(cx + 1, my - 1); }
  for (const [x, y] of glow) for (const [i, j] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (M.glass(x + i, y + j)) put(x + i, y + j, light, 0.35);
  for (const [x, y] of glow) if (M.glass(x, y)) put(x, y, light);
  // scanlines and a rolling bright band
  const band = Math.floor(T * 14) % (S + 12) - 6;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (M.glass(x, y)) {
    const i = (y * S + x) * 4, k = (y & 1 ? 0.82 : 1) * (Math.abs(y - band) < 2 ? 1.25 : 1);
    px[i] *= k; px[i + 1] *= k; px[i + 2] *= k;
  }
  // weather: static snow now and then
  if (F.glitch === 'weather' && (T + F.phase) % 5 < 0.6) for (let n = 0; n < 40; n++) { const x = Math.floor(r() * S), y = Math.floor(r() * S); if (M.glass(x, y)) put(x, y, mix(F.tint, WHITE, 0.5), 0.6); }

  wear(F, M, T, put, rect, mix);
  lamps(F, M, put);
  // glitches: rows slide sideways, the red light slips; how often comes from the quirk
  const every = { odd: 1.3, mood: 3, time: 5, weather: 2.5, neighbour: 3.5 }[F.glitch] ?? 4;
  if ((T + F.phase * 0.7) % every < 0.25) {
    for (let n = 1 + Math.floor(r() * 3); n > 0; n--) {
      const y0 = Math.floor(r() * S), h = 1 + Math.floor(r() * 3), sh = (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 3));
      for (let y = y0; y < Math.min(S, y0 + h); y++) {
        const row = px.slice(y * S * 4, (y + 1) * S * 4);
        for (let x = 0; x < S; x++) { const sx = x - sh, o = (y * S + x) * 4; if (sx < 0 || sx >= S) { px[o + 3] = 0; continue; } for (let c = 0; c < 4; c++) px[o + c] = row[sx * 4 + c]; }
      }
    }
    for (let y = 0; y < S; y++) for (let x = S - 1; x > 0; x--) { const o = (y * S + x) * 4; if (px[o + 3] && px[o - 1]) px[o] = Math.max(px[o], px[o - 4]); }
  }
  return px;
}

// what the talent wears, drawn over the bezel
function wear(F, M, T, put, rect, mix) {
  const [bx, by, bw] = M.box, top = by, mid = Math.round(bx + bw / 2);
  const C = { white: hex('fef3c0'), green: hex('59c135'), leaf: hex('9cdb43'), yellow: hex('ffd541'), red: hex('df3e23'), steel: hex('8b93af'), brown: hex('71413b'), dark: hex('242234'), ice: hex('a6fcdb'), gold: GOLD, band: hex('3b1725') };
  const at = { x: mid, y: top };
  switch (F.wears) {
    case 'chef': rect(at.x - 5, at.y - 2, 10, 3, C.white); rect(at.x - 6, at.y - 6, 4, 4, C.white); rect(at.x - 2, at.y - 7, 4, 5, C.white); rect(at.x + 2, at.y - 6, 4, 4, C.white); rect(at.x - 5, at.y - 1, 10, 1, mix(C.white, C.dark, 0.25)); break;
    case 'visor': rect(bx + 3, top - 1, bw - 6, 4, C.dark); rect(bx + 5, top, 6, 2, C.yellow); rect(bx + bw - 11, top, 6, 2, C.yellow); if (Math.floor(T * 6) % 5 === 0) { put(bx + bw - 2, top - 2, C.yellow); put(bx + bw - 1, top - 3, C.white); } break;
    case 'sprout': { const sway = Math.round(Math.sin(T * 2) * 0.6); rect(at.x, at.y - 5, 1, 5, C.green); rect(at.x - 3 + sway, at.y - 6, 3, 2, C.leaf); rect(at.x + 1 + sway, at.y - 8, 3, 2, C.leaf); break; }
    case 'bolt': { const on = Math.floor(T * 3) % 4 !== 0, c = on ? C.yellow : mix(C.yellow, C.dark, 0.5), x = bx + bw - 6, y = top - 6; for (const [i, j] of [[2, 0], [3, 0], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2], [2, 3], [1, 4], [0, 5]]) put(x + i, y + j, c); break; }
    case 'cross': rect(at.x - 1, at.y - 5, 3, 7, C.white); rect(at.x - 3, at.y - 3, 7, 3, C.white); rect(at.x - 1, at.y - 4, 3, 5, C.red); rect(at.x - 2, at.y - 3, 5, 3, C.red); break;
    case 'antenna': rect(at.x + 4, at.y - 8, 1, 8, C.steel); rect(at.x + 2, at.y - 1, 5, 1, C.steel); put(at.x + 4, at.y - 9, Math.floor(T * 2) % 2 ? C.red : mix(C.red, C.dark, 0.6)); break;
    case 'crosshair': { const x = Math.round(M.cx + M.gap / 2 + 1.5), y = M.cy - 2; for (let i = -4; i <= 4; i++) if (Math.abs(i) > 1) { put(x + i, y, C.red, 0.9); put(x, y + i, C.red, 0.9); } break; }
    case 'propeller': { rect(at.x, at.y - 3, 1, 3, C.steel); const k = Math.floor(T * FPS) % 3, w = [6, 3, 1][k]; rect(at.x - w, at.y - 4, w * 2 + 1, 1, C.steel); put(at.x, at.y - 4, C.red); break; }
    case 'bowtie': { const y = top + M.box[3] - 1, x = mid; rect(x - 4, y - 1, 3, 3, C.red); rect(x + 2, y - 1, 3, 3, C.red); rect(x - 1, y, 3, 1, mix(C.red, C.dark, 0.3)); break; }
    case 'monocle': { const x = Math.round(M.cx + M.gap / 2 + 1.5), y = M.cy - 2; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const q = i * i + j * j; if (q >= 6 && q <= 11) put(x + i, y + j, C.gold); } for (let j = 4; j < 9; j++) put(x + 2 + (j & 1), y + j, C.gold, 0.8); break; }
    case 'snow': { const x = bx + 3, y = top + 3; for (const [i, j] of [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [2, 3], [2, 4], [1, 1], [3, 3], [3, 1], [1, 3]]) put(x + i, y + j, C.ice, (i + j) % 2 ? 0.7 : 1); break; }
    case 'zzz': { const k = (T * 0.8) % 3, x = bx + bw - 4, y = top - 2 - Math.floor(k * 3); const Z = (x0, y0, a) => { rect(x0, y0, 3, 1, C.white, a); put(x0 + 1, y0 + 1, C.white, a); rect(x0, y0 + 2, 3, 1, C.white, a); }; Z(x, y, Math.max(0.2, 1 - k / 3)); if (k > 1) Z(x + 3, y - 4, Math.max(0.2, 1 - (k - 1) / 2)); break; }
    case 'fedora': rect(at.x - 9, at.y - 1, 18, 2, C.brown); rect(at.x - 5, at.y - 6, 10, 5, C.brown); rect(at.x - 5, at.y - 3, 10, 1, C.band); rect(at.x - 1, at.y - 6, 2, 1, mix(C.brown, C.dark, 0.4)); break;
  }
}
// the strength: five lamps on the lower bezel, lit by bits
function lamps(F, M, put) {
  const [bx, by, bw, bh] = M.box, y = F.shape === 'round' ? by + bh - 2 : by + bh - 2, x0 = Math.round(bx + bw / 2) - 4;
  if (F.shape === 'tall') { for (let i = 0; i < 5; i++) put(x0 + i * 2, by + bh - 4, i < F.bits ? LAMP : DARK); return; }
  for (let i = 0; i < 5; i++) put(x0 + i * 2, y, i < F.bits ? LAMP : DARK);
}


// ---------- ghosts (glitch_heads) ----------
export const GSIZE = 64;
let HEADS = null, loading = null;
const lum = (r, g, b) => (r * 0.3 + g * 0.59 + b * 0.11) / 255;
// the heads: [{ data: RGBA GSIZE × GSIZE, face: { cx, cy, rx, ry } }]; the face is the black void, found by filling from the middle
export function setHeads(cells) {
  HEADS = cells.map(data => {
    const S = GSIZE, dark = i => data[i * 4 + 3] > 128 && lum(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) < 0.16;
    let start = -1;
    for (let d = 0; d < 20 && start < 0; d++) for (const [x, y] of [[32, 30 + d], [32, 30 - d], [32 - d, 30], [32 + d, 30]]) if (start < 0 && dark(y * S + x)) start = y * S + x;
    let x0 = S, x1 = 0, y0 = S, y1 = 0;
    if (start >= 0) {
      const seen = new Uint8Array(S * S), todo = [start]; seen[start] = 1;
      while (todo.length) { const i = todo.pop(), x = i % S, y = (i / S) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        for (const j of [i - 1, i + 1, i - S, i + S]) if (j >= 0 && j < S * S && !seen[j] && Math.abs((j % S) - x) <= 1 && dark(j)) { seen[j] = 1; todo.push(j); } }
    }
    const ok = start >= 0 && x1 - x0 >= 8 && y1 - y0 >= 8;
    return { data, face: ok ? { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2 } : { cx: 32, cy: 30, rx: 10, ry: 12 } };
  });
  return HEADS;
}
export const headsReady = () => !!HEADS?.length;
// in the browser: load the sheet once (next to the game data)
export function loadHeads(url = new URL('../projects/nomadgirl/assets/glitchlings/heads.png', import.meta.url).href) {
  if (HEADS || loading || typeof document === 'undefined') return loading;
  loading = new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      const cells = [];
      for (let y = 0; y + GSIZE <= c.height; y += GSIZE) for (let k = 0; k + GSIZE <= c.width; k += GSIZE) { const d = x.getImageData(k, y, GSIZE, GSIZE).data; if (d.some((v, i) => i % 4 === 3 && v)) cells.push(new Uint8ClampedArray(d)); }
      res(setHeads(cells));
    };
    img.onerror = () => res(null);
    img.src = url;
  });
  return loading;
}
// one frame of a ghost: its head tinted, floating, the face from code in the void
export function renderGhost(g, t = 0, out = null) {
  const F = faceOf(g), S = GSIZE, px = out || new Uint8ClampedArray(S * S * 4), H = HEADS[(F.seed >>> 3) % HEADS.length], src = H.data, f = H.face;
  px.fill(0);
  const fr = Math.floor(t * FPS), T = fr / FPS, r = rng(F.seed + fr * 7919);
  const bob = Math.round(Math.sin(T * 2.1 + F.phase) * 1.4), dark = [10, 8, 18], gold = GOLD;
  const mood = F.glitch === 'mood' ? 0.85 + 0.15 * Math.sin(T * 1.7 + F.phase) : 1;
  // the head: brightness of the pale art → from deep shade to the light of the Glitchling (unique ones: gold outline)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const sy = y - bob; if (sy < 0 || sy >= S) continue;
    const i = (sy * S + x) * 4, a = src[i + 3]; if (!a) continue;
    const l = lum(src[i], src[i + 1], src[i + 2]), o = (y * S + x) * 4;
    let c;
    if (l < 0.16) c = dark;                                                      // the void and the outline stay dark
    else { const k = Math.min(1, (l - 0.16) / 0.75) * mood; c = [dark[0] + (F.tint[0] - dark[0]) * k + (255 - F.tint[0]) * Math.max(0, k - 0.8), dark[1] + (F.tint[1] - dark[1]) * k + (255 - F.tint[1]) * Math.max(0, k - 0.8), dark[2] + (F.tint[2] - dark[2]) * k + (255 - F.tint[2]) * Math.max(0, k - 0.8)]; }
    if (F.unique && l < 0.16) { const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = sy + dy; return xx < 0 || yy < 0 || xx >= S || yy >= S || !src[(yy * S + xx) * 4 + 3]; }); if (edge) c = gold; }
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = a;
  }
  // the face in the void: same eyes and mouth as the screens, placed by the void's size
  const put = (x, y, c, a = 1) => { x = Math.round(x); y = Math.round(y + bob); if (x < 0 || y < 0 || x >= S || y >= S) return; const i = (y * S + x) * 4; px[i] = px[i] * (1 - a) + c[0] * a; px[i + 1] = px[i + 1] * (1 - a) + c[1] * a; px[i + 2] = px[i + 2] * (1 - a) + c[2] * a; px[i + 3] = Math.max(px[i + 3], 255 * a); };
  const light = [Math.min(255, F.tint[0] + 70), Math.min(255, F.tint[1] + 70), Math.min(255, F.tint[2] + 70)];
  // big voids get chunkier features: every pattern pixel becomes k × k around its anchor (eye or mouth centre)
  const k = f.rx >= 11 ? 2 : 1, dots = []; let ax = 0, ay = 0;
  const dot = (x, y) => { const X = Math.round(ax + (x - ax) * k), Y = Math.round(ay + (y - ay) * k); for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) dots.push([X + i, Y + j]); };
  const cx = f.cx, ey = f.cy - f.ry * 0.22, my = f.cy + f.ry * 0.42, d = Math.max(3, f.rx * 0.45);
  const blinkAt = (T + F.phase) % F.blink, shut = blinkAt < 0.17 || (F.glitch === 'time' && Math.sin(T * 0.5 + F.phase) > 0.7);
  const look = F.glitch === 'neighbour' ? Math.round(Math.sin(T * 0.9 + F.phase) * 1.4) : F.glitch === 'odd' && r() < 0.15 ? (r() < 0.5 ? -1 : 1) : Math.round(Math.sin(T * 0.4 + F.phase) * 0.7);
  for (const sd of [-1, 1]) {
    const x = Math.round(cx + sd * d - 0.5) + look * k, y = Math.round(ey); ax = x; ay = y;
    if (shut) { for (let i = -1; i <= 1; i++) dot(x + i, y + 1); continue; }
    if (F.eyes === 'dots') { dot(x, y); dot(x + 1, y); dot(x, y + 1); dot(x + 1, y + 1); }
    else if (F.eyes === 'blocks') { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) dot(x + i, y + j + 1); }
    else if (F.eyes === 'bars') { for (let i = -1; i <= 2; i++) dot(x + i, y + 1); }
    else if (F.eyes === 'arcs') { dot(x - 1, y + 1); dot(x, y); dot(x + 1, y); dot(x + 2, y + 1); }
    else if (F.eyes === 'rings') { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (i || j) dot(x + i, y + j); }
    else if (sd < 0) { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) dot(x + i, y + j); } else dot(x, y);
  }
  const talking = (T + F.phase * 3) % F.talk < 1 && fr % 3 !== 0, mouth = talking ? 'o' : F.mouth, my_ = Math.round(my), mx = Math.round(cx); ax = mx; ay = my_;
  if (mouth === 'smile') { dot(mx - 3, my_ - 1); for (let i = -2; i <= 1; i++) dot(mx + i, my_); dot(mx + 2, my_ - 1); }
  else if (mouth === 'flat') for (let i = -2; i <= 2; i++) dot(mx + i, my_);
  else if (mouth === 'o') { dot(mx - 1, my_ - 1); dot(mx, my_ - 1); dot(mx - 2, my_); dot(mx + 1, my_); dot(mx - 1, my_ + 1); dot(mx, my_ + 1); }
  else if (mouth === 'zigzag') for (let i = -3; i <= 2; i++) dot(mx + i, my_ - ((i & 1) ? 1 : 0));
  else if (mouth === 'smirk') { for (let i = -2; i <= 1; i++) dot(mx + i, my_); dot(mx + 2, my_ - 1); dot(mx + 3, my_ - 2); }
  else { dot(mx - 3, my_ - 1); dot(mx - 2, my_); dot(mx - 1, my_ - 1); dot(mx, my_); dot(mx + 1, my_ - 1); }
  for (const [x, y] of dots) for (const [i, j] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(x + i, y + j, F.tint, 0.4);
  for (const [x, y] of dots) put(x, y, light);
  // glitches: rows slide, the ghost flickers (how often comes from the quirk)
  const every = { odd: 1.3, mood: 3, time: 5, weather: 2.5, neighbour: 3.5 }[F.glitch] ?? 4;
  if ((T + F.phase * 0.7) % every < 0.25) {
    for (let n = 1 + Math.floor(r() * 3); n > 0; n--) {
      const y0 = Math.floor(r() * S), h = 1 + Math.floor(r() * 3), sh = (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 3));
      for (let y = y0; y < Math.min(S, y0 + h); y++) { const row = px.slice(y * S * 4, (y + 1) * S * 4); for (let x = 0; x < S; x++) { const sx = x - sh, o = (y * S + x) * 4; if (sx < 0 || sx >= S) { px[o + 3] = 0; continue; } for (let c = 0; c < 4; c++) px[o + c] = row[sx * 4 + c]; } }
    }
  }
  if (F.glitch === 'weather' && (T + F.phase) % 5 < 0.6) for (let n = 0; n < 30; n++) { const x = Math.floor(r() * S), y = Math.floor(r() * S), o = (y * S + x) * 4; if (px[o + 3]) { px[o] = px[o + 1] = px[o + 2] = 230; } }
  return px;
}

// ---------- canvas ----------
// one frame onto a canvas context, scaled up with sharp pixels
const buffers = new WeakMap();
const ghostOf = g => !g?.hunter && headsReady();
export function drawGlitchFace(ctx, g, t = 0, x = 0, y = 0, size = SIZE * 4) {
  const ghost = ghostOf(g), N = ghost ? GSIZE : SIZE;
  let b = buffers.get(ctx);
  if (!b || b.n !== N) { const c = (ctx.canvas.ownerDocument || document).createElement('canvas'); c.width = c.height = N; b = { c, cx: c.getContext('2d'), n: N }; buffers.set(ctx, b); }
  const img = b.cx.createImageData(N, N);
  if (ghost) renderGhost(g, t, img.data); else renderFace(g, t, img.data);
  b.cx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(x, y, size, size);
  ctx.drawImage(b.c, x, y, size, size);
}
// a canvas element that moves while it is on the page (stops by itself when it is removed)
export function faceCanvas(g, size = SIZE * 3, doc = document) {
  const cv = doc.createElement('canvas');
  cv.width = cv.height = size; cv.className = 'glitch-face'; cv.style.imageRendering = 'pixelated';
  const ctx = cv.getContext('2d'), t0 = performance.now();
  let last = -1, seen = false;
  if (!headsReady()) loadHeads()?.then(() => { last = -1; });   // the ghost heads come a moment later
  const tick = now => {
    if (!cv.isConnected) { if (seen || now - t0 > 10000) return; } else seen = true;   // gone from the page, or never put there
    const fr = Math.floor((now - t0) / 1000 * FPS);
    if (fr !== last) { last = fr; drawGlitchFace(ctx, g, fr / FPS, 0, 0, size); }
    requestAnimationFrame(tick);
  };
  drawGlitchFace(ctx, g, 0, 0, size);
  requestAnimationFrame(tick);
  return cv;
}

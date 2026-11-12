// The camp before and after a run (area "Camp"): a flat campsite with Leyla's van, the rig behind it as a cutaway
// (dollhouse: every container shows its workshops), a campfire, companions with speech bubbles and day/night.
// Leyla walks around and uses things with E. Time only moves on actions (sleeping, sitting at the fire, driving, runs).
// Graphics are code placeholders for now; a "look" on containers, workshops or companions takes over later.
import { clockText, advance, hoursUntil, containers } from '../save.js';
import { budgets, partSlots, passengers } from '../rig.js';
import { Benches, benchTexture, crateTexture } from './benches.js';

const de = n => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 1 });
const NEAREST = () => Phaser.Textures.FilterMode.NEAREST;
const col = c => parseInt(String(c || '#000000').slice(1), 16);
const shadeOf = (c, k) => { const n = col(c), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return f(n >> 16 & 255) << 16 | f(n >> 8 & 255) << 8 | f(n & 255); };

// daytime row for an hour: the last row whose "from" is not after the hour (wrapping round midnight)
export function daytimeAt(C, hour) {
  const rows = [...(C?.daytime || [])].sort((a, b) => (a.from ?? 0) - (b.from ?? 0));
  if (!rows.length) return { weather: null, shade: 0, name: '' };
  return [...rows].reverse().find(r => (r.from ?? 0) <= hour) || rows[rows.length - 1];
}

// Daniel's modular trailer (Camp › Fahrgestell, 09.11.2026): a container with „Auf Fahrgestell“ that does not stand on another one
// gets a chassis as long as itself, put together from drawbar, front frame, middle pieces, axles and rear (art pixels, drawbar left).
// One axle: drawbar | frame | middles | axle | rear. Two or more: drawbar | a little frame | axle | middles | axle | rear.
export function chassisPlan(D, def) {
  const C = D.camp?.chassis, A = D.assets?.[def.look];
  if (!def.chassis || !C?.look || !D.assets?.[C.look] || !A?.frameSize || !def.inside?.x) return null;
  const w = r => Math.max(0, (r?.[1] ?? 0) - (r?.[0] ?? 0)), pad = C.pad ?? 9;
  const bed = Math.abs(def.inside.x[1] - def.inside.x[0]) + 2 * pad, axles = Math.max(1, C.axles?.[def.places || 1] ?? 1);
  const segs = [C.drawbar], mids = n => { const out = []; for (let left = n; left > 0; left -= w(C.middle)) out.push([C.middle[0], C.middle[0] + Math.min(w(C.middle), left)]); return out; };
  let rest = Math.max(0, bed - w(C.rear) - axles * w(C.axle));
  const front = Math.min(w(C.beam), axles > 1 ? Math.min(rest, C.frontMin ?? 12) : rest);
  if (front > 0) segs.push([C.beam[0], C.beam[0] + front]);
  rest -= front;
  if (axles === 1) segs.push(...mids(rest), C.axle);
  else { const gap = rest / (axles - 1); for (let i = 0; i < axles; i++) { segs.push(C.axle); if (i < axles - 1) segs.push(...mids(Math.round(gap * (i + 1)) - Math.round(gap * i))); } }
  segs.push(C.rear);
  const width = segs.reduce((n, r) => n + w(r), 0), drawbar = w(C.drawbar);
  return { segs, width, drawbar, bed: width - drawbar, pad, rows: C.rows || [163, 204], couple: C.couple ?? 172, look: C.look, middle: C.middle, beam: C.beamRows ?? 15, key: `chassis_${segs.map(r => r.join('-')).join('_')}_b${C.beamRows ?? 15}` };
}
// the chassis as a texture: the pieces side by side, mirrored so the drawbar points to the van (right)
export function chassisTexture(scene, plan) {
  if (scene.textures.exists(plan.key)) return plan.key;
  if (!scene.textures.exists(plan.look)) return null;
  const src = scene.textures.get(plan.look).getSourceImage(), [y0, y1] = plan.rows, h = y1 - y0;
  const tex = scene.textures.createCanvas(plan.key, plan.width, h), ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(plan.width, 0); ctx.scale(-1, 1);
  // behind everything: the long beam of the middle piece, all the way from the drawbar to the rear, so no gap shows where the
  // pieces meet (fender corners, rear) – Daniel, 09.11.2026: „Lücken zwischen den Tiles … Tiles hinter die Lücken legen“
  const [m0, m1] = plan.middle, bh = Math.min(h, plan.beam || 15);
  for (let bx = plan.drawbar; bx < plan.width; bx += m1 - m0) { const w = Math.min(m1 - m0, plan.width - bx); ctx.drawImage(src, m0, y0, w, bh, bx, 0, w, bh); }
  let x = 0;
  for (const [a, b] of plan.segs) { ctx.drawImage(src, a, y0, b - a, h, x, 0, b - a, h); x += b - a; }
  tex.refresh(); tex.setFilter(NEAREST());
  return plan.key;
}

// one container as it stands in the camp, from its left end x (rear) to the right (front, towards the van):
// a picture with an open side (Container › Aussehen + Innenraum) or a trailer from code: rear hitch, body on a chassis
// with axles, wheels and fenders, drawbar with coupling and jockey wheel at the front. Same art in the rig and on the scrapyard.
export function unitShape(D, def, ground, T = 64, { stacked = false } = {}) {
  const C = D.camp || {}, R = C.rig || {}, places = def.places || 1, A = D.assets?.[def.look];
  const plan = !stacked && chassisPlan(D, def);
  if (plan) {   // on its chassis: the container stands on the loading bed, the bed spans its posts, the drawbar reaches to the van
    const [fw] = A.frameSize, k = (A.height || A.frameSize[1]) / A.frameSize[1], [y0, y1] = plan.rows, lift = (y1 - y0) * k;
    const box = unitShape(D, def, ground - lift, T, { stacked: true }), left = Math.min(def.inside.x[0], def.inside.x[1]);
    const off = -((!!A.flip !== !!def.flip ? fw - Math.max(def.inside.x[0], def.inside.x[1]) : left) - plan.pad) * k, couple = ground - (y1 - plan.couple) * k;
    return { ...box, w: plan.width * k, in0: box.in0 + off, sprite: { ...box.sprite, cx: box.sprite.cx + off, dy: -lift },
      chassis: { plan, k, w: plan.width * k, lift }, hitch: [0, couple], coupling: [plan.width * k, couple] };
  }
  if (A?.frameSize && def.inside?.x && def.inside?.y) {
    const [fw, fh] = A.frameSize, k = (A.height || fh) / fh, [ox, oy] = A.origin || [fw / 2, fh], flip = !!A.flip !== !!def.flip, w = fw * k;
    const ix = v => flip ? fw - v : v, a = ix(def.inside.x[0]), b = ix(def.inside.x[1]), in0 = Math.min(a, b) * k, in1 = Math.max(a, b) * k;
    return { w, places, cell: (in1 - in0) / places, in0, inTop: ground - (oy - def.inside.y[0]) * k, floorY: ground - (oy - def.inside.y[1]) * k, deckY: ground - (oy - (def.deck ?? 0)) * k,
      sprite: { key: def.look, k, flip, ox: (flip ? fw - ox : ox) / fw, oy: oy / fh, cx: (flip ? fw - ox : ox) * k }, hitch: [0, ground - 40 * k / 3], coupling: [w, ground - 40 * k / 3] };
  }
  const cell = (R.placeWidth ?? 4) * T, lift = R.lift ?? 48, h = R.height ?? 248, rear = 44, bar = R.drawbar ?? 120;
  const in0 = rear, body = places * cell, floorY = ground - lift;
  return { w: rear + body + 12 + bar, places, cell, in0, inTop: floorY - h, floorY, deckY: floorY - h - 22, body, lift, bar, hitch: [0, ground - 40], coupling: [rear + body + 12 + bar, ground - 40] };
}
export const unitWidth = (D, def, T = 64) => unitShape(D, def, 0, T).w;

// the rig from the van to the left: the first container hangs right behind the van, each next one on the one in front.
// A stacked container (level > 0) stands on the deck of the unit below it, its interior centred over the one below.
export function rigUnits(D, rig, vanLeft, ground, T = 64) {
  const out = [];
  let right = vanLeft, below = null;
  rig.units.forEach((u, ui) => {
    if (u.kind === 'tractor') return;
    const def = D.containers?.[u.id] || {};
    if (u.level && below) {
      // container slots: offset 0 … P − p from the left edge of the interior below (u.slot), otherwise centred
      const base = below.deckY, sh = unitShape(D, def, base, T, { stacked: true }), wB = below.cell * below.places, wT = sh.cell * sh.places, n = below.places - sh.places;
      const x0 = u.slot != null && n > 0 ? below.in0 + (wB - wT) * Math.min(u.slot, n) / n - sh.in0 : below.in0 + wB / 2 - (sh.in0 + wT / 2);
      below = { ...u, ui, def, ...sh, base, x0, x1: x0 + sh.w, in0: x0 + sh.in0, sprite: sh.sprite && { ...sh.sprite, cx: x0 + sh.sprite.cx }, foot: below.foot ?? below };
      out.push(below);
      return;
    }
    const sh = unitShape(D, def, ground, T), x0 = right - sh.w;
    below = { ...u, ui, def, ...sh, base: ground, x0, x1: right, in0: x0 + sh.in0, sprite: sh.sprite && { ...sh.sprite, cx: x0 + sh.sprite.cx } };
    out.push(below);
    right = x0 + (sh.sprite ? 0 : 6);   // a code trailer's drawbar reaches into the towing eye of the one in front
  });
  return out;
}

// geometry of the camp in tiles and pixels: margin | scrapyard | room for the rig (as long as the tractor may pull) | van | campsite.
// The van stands still while building: the rig grows to the left from it.
export function campLayout(D, save, T = 64) {
  const C = D.camp || {}, gap = (C.rig?.gap ?? 1) * T, margin = C.margin ?? 6;
  let H = Math.max(8, C.height ?? 14);
  const vanA = D.assets?.[D.tractors?.[save.rig.tractor]?.look] || D.assets?.[D.game?.spawn?.look];
  const k = vanA?.frameSize ? (vanA.height || vanA.frameSize[1]) / vanA.frameSize[1] : 1;
  const vanLeft = vanA?.frameSize ? (vanA.origin?.[0] ?? vanA.frameSize[0] / 2) * k : 5 * T, vanRight = vanA?.frameSize ? vanA.frameSize[0] * k - vanLeft : 5 * T;
  const Y = C.yard || {}, yardW = Y.enabled === false ? 0 : Math.max(4, Y.width ?? 9) * T;
  const longest = Math.max(T * 4, ...Object.values(D.containers || {}).map(c => unitWidth(D, c, T)));
  const pull = Math.max(1, D.tractors?.[save.rig.tractor]?.length ?? 1);
  const rigRoom = pull * longest + (pull - 1) * gap;
  const vanCol = Math.ceil((margin * T + yardW + rigRoom + vanLeft) / T - 0.5), doorX = (vanCol + 0.5) * T;
  const W = vanCol + Math.max(8, C.campWidth ?? 20) + 1;
  let floor = H - 2;
  let units = rigUnits(D, save.rig, doorX - vanLeft, floor * T, T);
  // a high stack (container on a container on its chassis, ×4) must fit under the top of the world: Leyla has to stand up in the
  // upper container (Daniel 09.11.2026: "oben auf der Leiter kann man sich nicht mehr bewegen"); the camp grows by whole rows
  const highest = Math.min(Infinity, ...units.map(u => Math.min(u.inTop ?? u.floorY, u.floorY - 4 * T)));
  if (highest < T) {
    const more = Math.ceil((T - highest) / T);
    H += more; floor += more;
    units = rigUnits(D, save.rig, doorX - vanLeft, floor * T, T);
  }
  const tractor = save.rig.units.find(u => u.kind === 'tractor');
  // shaft on the left: a hole in the ground, closed off by an invisible wall above it (it cannot be entered)
  const S = C.shaft || {}, shaft = S.enabled === false ? null : { from: Math.max(1, S.at ?? 1), to: Math.max(1, S.at ?? 1) + Math.max(1, S.width ?? 3) - 1 };
  const blocked = x => x === 0 || x === W - 1 || (shaft && x <= shaft.to);
  const layout = Array.from({ length: H }, (_, y) => {
    let row = '';
    for (let x = 0; x < W; x++) row += y >= floor ? (shaft && x >= shaft.from && x <= shaft.to ? '.' : '#') : blocked(x) ? '#' : x === vanCol && y === floor - 1 ? 'L' : '.';
    return row;
  });
  const yard = yardW ? { x0: ((shaft ? shaft.to + 1 : 1) + 0.5) * T, x1: margin * T + yardW } : null;
  return { layout, W, H, floor, vanCol, shaft, hidden: (x, y) => y < floor && blocked(x), doorX, vanLeft: doorX - vanLeft, vanRight: doorX + vanRight, units, tractor, yard,
    rigRoom: [doorX - vanLeft - rigRoom, doorX - vanLeft], fireX: (vanCol + (C.fire?.at ?? 9) + 0.5) * T,
    companionX: [(vanCol + (C.companions?.at?.[0] ?? 6) + 0.5) * T, (vanCol + (C.companions?.at?.[1] ?? 13) + 0.5) * T] };
}

// background of the camp: weather sky from the Backdrop, a far plain with dunes and a tiny BigCityDelta on the horizon
export function drawCampBackground(scene, C) {
  const W = scene.scale.width, H = scene.scale.height, hy = Math.round(H * (C.horizon ?? 66) / 100), k = 3;
  const g = scene.make.graphics({}, false), far = C.ground?.far || '#6b4a36', base = col(far);
  // city silhouette (far, tiny, cool)
  let x = W * 0.58;
  const r = (s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(31);
  g.fillStyle(0x2a1d3a);
  while (x < W * 0.84) { const w = (3 + r() * 7) * k, h = (3 + r() * 12 + (r() < 0.15 ? 8 : 0)) * k; g.fillRect(Math.round(x / k) * k, hy - Math.round(h / k) * k, Math.round(w / k) * k, Math.round(h / k) * k + k); x += w + r() * 2 * k; }
  // plain: bands getting lighter towards us
  for (let i = 0; i < 6; i++) g.fillStyle(shadeOf(far, 0.62 + i * 0.09)).fillRect(0, hy + Math.round((H - hy) * Math.pow(i / 6, 1.6) / k) * k, W, H);
  // dunes
  for (let d = 0; d < 3; d++) {
    g.fillStyle(shadeOf(far, 0.7 + d * 0.12));
    const y0 = hy + (6 + d * 14) * k, amp = (3 + d * 3) * k, len = 120 + d * 70;
    for (let px = 0; px < W * 1.3; px += k) g.fillRect(px, y0 - Math.round(Math.max(0, Math.sin(px / len + d * 2) * amp) / k) * k, k, H);
  }
  const key = 'camp_far';
  if (scene.textures.exists(key)) scene.textures.remove(key);
  g.generateTexture(key, Math.ceil(W * 1.3), H); g.destroy();
  return scene.add.image(0, 0, key).setOrigin(0).setScrollFactor(0.05, 0).setDepth(-97);
}

// ground of the camp from the tileset (Camp › Platz › Boden-Kacheln, frames: 0 top, 1 fill, 2 top with wall left, 3 pillar,
// 4 wall left, 5 wall right, 6/7 grassy tops), with the shaft on the left. Returns false without tiles (then art.js draws earth).
export function drawCampGround(scene, D, geo, T) {
  const C = D.camp || {}, id = C.ground?.tiles, A = D.assets?.[id];
  if (!id || !scene.textures.exists(id) || !A?.frameSize) return false;
  scene.textures.get(id).setFilter(NEAREST());
  const [fw, fh] = A.frameSize, k = T / fw, over = (fh - fw) * k, sh = geo.shaft;
  const r = (seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296))(7);
  const hole = x => sh && x >= sh.from && x <= sh.to;
  for (let y = geo.floor; y < geo.H; y++) for (let x = 0; x < geo.W; x++) {
    if (hole(x)) continue;
    const top = y === geo.floor, leftRim = sh && x === sh.from - 1, rightRim = sh && x === sh.to + 1;
    let f = top ? (leftRim ? 3 : rightRim ? 2 : r() < 0.35 ? (r() < 0.5 ? 6 : 7) : 0) : (leftRim ? 5 : rightRim ? 4 : 1);
    if (f >= (A.frames || 1)) f = top ? 0 : 1;
    scene.add.image(x * T, y * T - over, id, f).setOrigin(0).setScale(k).setDepth(-10);
  }
  if (sh) drawShaft(scene, C.shaft || {}, sh, geo, T);
  return true;
}

// the shaft: darkness getting deeper, timber posts on the walls, a small headframe with a pulley and a rope into the dark
function drawShaft(scene, S, sh, geo, T) {
  const g = scene.add.graphics().setDepth(-11), x0 = sh.from * T, x1 = (sh.to + 1) * T, top = geo.floor * T, bottom = geo.H * T, p = 4;
  const dark = col(S.color || '#140d12');
  for (let i = 0; i < 8; i++) g.fillStyle(shadeOf(S.color || '#140d12', 1.6 - i * 0.2), 1).fillRect(x0, top + (bottom - top) * i / 8, x1 - x0, (bottom - top) / 8 + 1);
  g.fillStyle(dark).fillRect(x0, bottom - 24, x1 - x0, 24);
  if (S.glow) scene.add.image((x0 + x1) / 2, bottom, glowTexture(scene)).setDisplaySize(x1 - x0, 120).setTint(col(S.glow)).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(-10.5);   // something glows down there
  // timber posts along the walls and a cross brace
  g.fillStyle(0x4a3424).fillRect(x0 + 2 * p, top, 3 * p, bottom - top).fillRect(x1 - 5 * p, top, 3 * p, bottom - top);
  g.fillStyle(0x3a281c).fillRect(x0 + 2 * p, top + 40, x1 - x0 - 4 * p, 2 * p);
  // headframe above the shaft: two legs, a beam, a pulley, the rope
  const f = scene.add.graphics().setDepth(-12), cx = (x0 + x1) / 2, h = S.frameHeight ?? 200;
  if (h > 0) {
    f.fillStyle(0x5a3e28);
    for (let i = 0; i < h; i += p) { const k = i / h; f.fillRect(Math.round((x0 + 6 * p + (cx - x0 - 8 * p) * k) / p) * p, top - i, 3 * p, p); f.fillRect(Math.round((x1 - 9 * p - (x1 - cx - 8 * p) * k) / p) * p, top - i, 3 * p, p); }
    f.fillStyle(0x6b4a30).fillRect(cx - 14 * p, top - h - 2 * p, 28 * p, 3 * p);
    f.fillStyle(0x8b949e).fillCircle(cx, top - h + 4 * p, 4 * p).fillStyle(0x30363d).fillCircle(cx, top - h + 4 * p, 1.5 * p);
    f.fillStyle(0xb9a27a).fillRect(cx - p / 2 + 4 * p, top - h + 4 * p, p / 2 + 1, h + (bottom - top));
    f.fillStyle(0x7a6235).fillRect(cx + 2 * p, top + 70, 5 * p, 3 * p);   // the bucket somewhere down there
  }
}

// ---------- code art ----------
function figureTexture(scene, key, color, role) {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false), c = col(color || '#b9a2c8'), dark = shadeOf(color || '#b9a2c8', 0.55), skin = 0x9a6a4e;
  const px = (x, y, w, h, f) => g.fillStyle(f).fillRect(x, y, w, h);
  px(9, 66, 5, 9, 0x1b1d22); px(16, 66, 5, 9, 0x1b1d22);           // boots
  px(10, 46, 4, 21, dark); px(16, 46, 4, 21, dark);                 // legs
  px(7, 24, 16, 24, c); px(7, 44, 16, 3, dark);                     // jacket + belt
  px(19, 26, 4, 18, shadeOf(color || '#b9a2c8', 0.8)); px(19, 43, 4, 4, skin);   // arm
  px(10, 10, 12, 14, skin); px(18, 15, 2, 2, 0x111111);             // head + eye
  if (/koch/i.test(role || '')) { px(8, 0, 15, 8, 0xf2eef7); px(9, 7, 13, 3, 0xd8cfe2); }   // chef hat
  else { px(9, 7, 14, 6, 0x2a1d22); px(8, 9, 3, 10, 0x2a1d22); }  // hair
  if (/mechan/i.test(role || '')) { px(10, 12, 13, 3, 0x30363d); px(17, 12, 4, 3, 0x3fe0d0); }   // goggles
  g.generateTexture(key, 30, 75); g.destroy();
  scene.textures.get(key).setFilter(NEAREST());
  return key;
}

function glowTexture(scene) {
  if (scene.textures.exists('camp_glow')) return 'camp_glow';
  const t = scene.textures.createCanvas('camp_glow', 256, 256), c = t.getContext(), g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256); t.refresh();
  return 'camp_glow';
}

// furniture per workshop function, drawn into a cell (x, floor y, width, height)
function furniture(g, fn, x, y, w, h, light) {
  const f = (a, b, c, d, color) => g.fillStyle(color).fillRect(Math.round(a), Math.round(b), Math.round(c), Math.round(d));
  const L = col(light);
  switch (fn) {
    case 'sleep': f(x + 20, y - 52, w * 0.62, 34, 0x5a3a52); f(x + 20, y - 60, w * 0.62, 10, 0xd8cfe2); f(x + 24, y - 72, 44, 16, 0xf2eef7); f(x + 20, y - 18, 8, 18, 0x3a2a30); f(x + 20 + w * 0.62 - 8, y - 18, 8, 18, 0x3a2a30); break;
    case 'warroom': f(x + 26, y - 150, w - 52, 70, 0x101820); f(x + 32, y - 144, w - 64, 58, 0x123a44); for (let i = 0; i < 5; i++) f(x + 40 + i * 30, y - 130 + (i % 2) * 14, 18, 4, 0x3fe0d0); f(x + 40, y - 60, w - 80, 10, 0x4a3b2a); f(x + 50, y - 50, 8, 50, 0x3a2f22); f(x + w - 58, y - 50, 8, 50, 0x3a2f22); break;
    case 'kitchen': case 'foodtruck': f(x + 20, y - 70, w - 40, 70, 0x6b5a4a); f(x + 20, y - 76, w - 40, 8, 0x9a8a7a); f(x + 36, y - 84, 26, 10, 0x1b1d22); f(x + 76, y - 84, 26, 10, 0x1b1d22); f(x + 40, y - 106, 18, 20, 0x8b949e); f(x + w - 80, y - 170, 50, 8, 0x4a3b2a); f(x + w - 76, y - 186, 12, 16, 0xc77dff); f(x + w - 58, y - 182, 10, 12, 0xd6e04a); break;
    case 'craft': f(x + 18, y - 66, w - 36, 12, 0x7a6235); f(x + 24, y - 54, 10, 54, 0x4a3b20); f(x + w - 34, y - 54, 10, 54, 0x4a3b20); f(x + 28, y - 170, w - 56, 70, 0x3a2f22); for (let i = 0; i < 6; i++) f(x + 38 + i * 26, y - 160 + (i % 3) * 8, 6, 40, 0x8b949e); f(x + 40, y - 84, 30, 18, 0xff7a3d); break;
    case 'storage': case 'cooling': case 'cell': for (let r = 0; r < 3; r++) { f(x + 18, y - 40 - r * 60, w - 36, 6, 0x5a4a3a); for (let i = 0; i < 4; i++) f(x + 26 + i * (w - 52) / 4, y - 70 - r * 60, 26, 30, [0x7a5a3a, 0x4a5866, 0x5c6236][(r + i) % 3]); } break;
    case 'chill': f(x + 18, y - 50, w - 60, 40, 0x7a3b5a); f(x + 18, y - 76, w - 60, 28, 0x5a2a4a); for (let i = 0; i < 8; i++) f(x + 14 + i * (w - 28) / 8, y - h + 26 + (i % 2) * 6, 6, 6, L); break;
    default: f(x + 30, y - 90, w - 60, 90, 0x3a3f48); f(x + 40, y - 80, 20, 8, L);
  }
}

// a trailer from code (side view, cutaway): rear hitch, body on a chassis, axles with wheels and fenders, drawbar with coupling
// and jockey wheel towards the van. Bottom of the texture = ground. Cached per container type.
const KIND_COLORS = { trailer: ['#4a4f5a', '#2b2233'], shipping: ['#7a4a32', '#2a1d1a'], crate: ['#7a5a3a', '#2e2218'] };
export function shellTexture(scene, D, def, T = 64) {
  const R = D.camp?.rig || {}, sh = unitShape(D, def, 0, T), key = `shell_${def.kind || 'x'}_${sh.places}_${Math.round(sh.w)}`;
  if (scene.textures.exists(key)) return key;
  const [wallC, insideC] = KIND_COLORS[def.kind] || [R.wall || '#4a4f5a', R.inside || '#2b2233'];
  const wall = col(def.kind === 'trailer' || !KIND_COLORS[def.kind] ? R.wall || wallC : wallC), inside = col(def.kind === 'trailer' || !KIND_COLORS[def.kind] ? R.inside || insideC : insideC);
  const h = R.height ?? 248, Ht = sh.lift + h + 40, ground = Ht, floor = ground - sh.lift, top = floor - h, bx0 = sh.in0, bx1 = bx0 + sh.body;
  const g = scene.make.graphics({}, false), f = (x, y, w, hh, c, a = 1) => g.fillStyle(c, a).fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh));
  // drawbar (behind the body): two beams meeting in the coupling head, jockey wheel with crank, a safety chain
  const head = [sh.w - 10, ground - 40];
  g.lineStyle(12, 0x26292f).lineBetween(bx1 + 6, floor + 2, head[0], head[1]);
  g.lineStyle(6, 0x4a4f5a).lineBetween(bx1 + 6, floor - 6, head[0], head[1] - 4);
  f(head[0] - 14, head[1] - 9, 22, 16, 0x1b1d22); f(head[0] - 4, head[1] - 14, 12, 8, 0x8b949e);
  const jx = bx1 + 12 + sh.bar * 0.42, jy = floor + 2 + (head[1] - floor - 2) * 0.42 / 1;
  f(jx - 4, jy - 22, 8, ground - 14 - jy + 22, 0x6b7280); f(jx - 10, jy - 26, 20, 6, 0x30363d);
  g.fillStyle(0x15161a).fillCircle(jx, ground - 10, 10); g.fillStyle(0x6b7280).fillCircle(jx, ground - 10, 4);
  for (let i = 0; i < 6; i++) f(head[0] - 30 - i * 8, head[1] + 10 + Math.sin(i / 5 * Math.PI) * 14, 5, 5, 0x8b949e);
  // rear: towing eye for the next trailer
  f(8, ground - 46, bx0 - 20, 9, 0x26292f); g.lineStyle(5, 0x8b949e).strokeCircle(12, ground - 42, 8);
  // chassis under the floor
  f(bx0 - 6, floor, sh.body + 12, 12, 0x22252b);
  for (let x = bx0 + 20; x < bx1 - 10; x += 60) f(x, floor + 2, 8, 8, 0x30363d);
  // body: back wall (inside), planks, roof, end walls, floor beam
  f(bx0, top, sh.body, h, inside);
  for (let y = top + 30; y < floor - 10; y += 34) f(bx0 + 12, y, sh.body - 24, 2, shadeOf('#' + inside.toString(16).padStart(6, '0'), 1.25));
  f(bx0 - 12, top - 22, sh.body + 24, 22, wall); f(bx0 - 12, top, 12, h, wall); f(bx1, top, 12, h, wall);
  f(bx0 - 12, floor - 8, sh.body + 24, 8, 0x1b1d22);
  const hi = shadeOf('#' + wall.toString(16).padStart(6, '0'), 1.3), lo = shadeOf('#' + wall.toString(16).padStart(6, '0'), 0.75);
  if (def.kind === 'trailer') { f(bx0 - 4, top - 30, sh.body + 8, 8, hi); f(bx0 - 12, top - 22, 6, 22, hi); f(bx1 + 6, top - 22, 6, 22, hi); }   // rounded roof
  if (def.kind === 'shipping') { for (let x = bx0 - 8; x < bx1 + 8; x += 16) f(x, top - 20, 6, 18, lo); f(bx0 - 12, top + 10, 12, h - 30, lo); f(bx1, top + 10, 12, h - 30, lo); for (let y = top + 30; y < floor - 20; y += 40) { f(bx0 - 10, y, 8, 4, 0x8b949e); f(bx1 + 2, y, 8, 4, 0x8b949e); } }
  if (def.kind === 'crate') { for (let y = top - 22; y < top; y += 8) f(bx0 - 12, y, sh.body + 24, 3, lo); for (let y = top; y < floor - 8; y += 26) { f(bx0 - 12, y, 12, 3, lo); f(bx1, y, 12, 3, lo); } f(bx0 - 12, top, 12, 12, 0x30363d); f(bx1, top, 12, 12, 0x30363d); }
  // lights: red at the back, amber at the front corner
  f(bx0 - 18, floor - 34, 6, 16, 0xd0302a); f(bx0 - 18, floor - 18, 6, 8, 0xe0a030); f(bx1 + 12, floor - 26, 5, 10, 0xe0a030);
  // axles: one for a short body, two (tandem) for a long one, a little behind the middle; wheels with fenders
  const r = Math.min(sh.lift - 18, 30), n = sh.places >= 2 ? 2 : 1, c0 = bx0 + sh.body * 0.46;
  for (let i = 0; i < n; i++) {
    const cx = c0 + (i - (n - 1) / 2) * (2 * r + 14), cy = ground - r;
    f(cx - r - 8, floor - 6, 2 * r + 16, 10, lo); f(cx - r - 8, floor - 8, 2 * r + 16, 3, hi);   // fender
    g.fillStyle(0x15161a).fillCircle(cx, cy, r); g.fillStyle(0x2a2c32).fillCircle(cx, cy, r * 0.62);
    g.fillStyle(0x8b949e).fillCircle(cx, cy, r * 0.42); g.fillStyle(0x30363d).fillCircle(cx, cy, r * 0.16);
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; f(cx + Math.cos(a) * r * 0.3 - 2, cy + Math.sin(a) * r * 0.3 - 2, 4, 4, 0x4a4f5a); }
  }
  g.generateTexture(key, Math.ceil(sh.w), Ht); g.destroy();
  scene.textures.get(key).setFilter(NEAREST());
  return key;
}
// a workshop on its own (scrapyard pallet, in the hand while building): a slice of interior with its furniture
// ---------- rig parts from code (until they have a look): a box per slot kind, 34 × 30 px per "Feld" ----------
export function partTexture(scene, D, id) {
  const key = `part_${id}`;
  if (scene.textures.exists(key)) return key;
  const t = D.rigParts?.[id] || {}, [fw, fh] = t.size || [2, 2], w = Math.max(1, fw) * 34, h = Math.max(1, fh) * 30, c = col(t.color || '#8a6a3a');
  const lite = shadeOf(t.color || '#8a6a3a', 1.35), dark = shadeOf(t.color || '#8a6a3a', 0.6);
  const g = scene.make.graphics({}, false), f = (x, y, ww, hh, cc) => g.fillStyle(cc).fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
  f(0, 0, w, h, 0x0d0a12);
  if (t.slot === 'engine') {
    f(2, 8, w - 4, h - 10, c); f(2, h - 8, w - 4, 6, dark);
    for (let x = 8; x < w - 8; x += 10) f(x, 2, 5, 10, lite);   // cooling fins
    g.fillStyle(0x30363d).fillCircle(w - 10, h / 2 + 4, 6).fillStyle(0x8b949e).fillCircle(w - 10, h / 2 + 4, 2);
  } else if (t.slot === 'armor') {
    f(2, 2, w - 4, h - 4, c); f(2, 2, w - 4, 4, lite);
    g.lineStyle(3, dark).lineBetween(6, h - 8, w - 6, 8);   // weld seam
    for (const [x, y] of [[7, 9], [w - 7, 9], [7, h - 7], [w - 7, h - 7]]) g.fillStyle(lite).fillCircle(x, y, 2.5);
  } else if (t.slot === 'weapon') {
    f(4, h * 0.45, w * 0.6, h * 0.55 - 2, c); f(4, h * 0.45, w * 0.6, 4, lite);
    f(w * 0.3, h * 0.25, w * 0.68, 7, dark); f(w * 0.92, h * 0.2, 6, 12, 0x30363d);   // barrel
  } else {
    g.fillStyle(c).fillRoundedRect(2, 4, w - 4, h - 6, 8); f(6, h / 2, w - 12, 3, dark);
    for (const x of [w * 0.25, w * 0.72]) f(x, 4, 5, h - 6, 0x1b1d22);   // straps
    f(8, 6, w - 16, 3, lite);
  }
  g.generateTexture(key, w, h); g.destroy();
  return key;
}
// a rig part as a little view: box + glyph (origin bottom centre)
export function partView(scene, D, id, k = 1) {
  const t = D.rigParts?.[id] || {}, key = partTexture(scene, D, id), img = scene.add.image(0, 0, key).setOrigin(0.5, 1);
  const v = scene.add.container(0, 0, [img, scene.add.text(0, -img.height / 2, t.glyph || '', { fontFamily: 'VT323, monospace', fontSize: '24px', color: '#f2eef7', stroke: '#0d0a12', strokeThickness: 4 }).setOrigin(0.5)]).setScale(k);
  v.h = img.height * k; v.w = img.width * k;
  return v;
}
// the sockets on the tractor (Rig-Bau › Rig-Teile am Van): x = % of the van's width from the left, y = % of its height above the ground
export function socketRects(D, rig, geo, ground) {
  const S = D.build?.sockets || {}, [sw, sh] = S.size || [120, 80], vw = geo.vanRight - geo.vanLeft, vh = D.assets?.[D.tractors?.[rig.tractor]?.look]?.height || 400;
  const all = partSlots(D, rig), out = [];
  for (const p of all) {
    const n = all.filter(q => q.slot === p.slot).length, [px, py] = S[p.slot] || [50, 50];
    const cx = geo.vanLeft + vw * px / 100 + (p.i - (n - 1) / 2) * (sw + 12), cy = ground - vh * py / 100;
    out.push({ ...p, cx, cy, x0: cx - sw / 2, x1: cx + sw / 2, y0: cy - sh / 2, y1: cy + sh / 2 });
  }
  return out;
}
export function workshopTexture(scene, D, id, C = D.camp || {}) {
  const key = `ws_art_${id}`;
  if (scene.textures.exists(key)) return key;
  const R = C.rig || {}, def = D.workshops?.[id] || {}, cw = (R.placeWidth ?? 4) * scene.T * (def.places || 1), h = R.height ?? 248;
  // with a look: the picture itself (trimmed), as wide as its places
  const pic = benchTexture(scene, D, id, cw * 0.92, h);
  if (pic) return pic;
  const g = scene.make.graphics({}, false);
  g.fillStyle(col(R.inside || '#2b2233'), 0.92).fillRoundedRect(4, 30, cw - 8, h - 30, 10);
  g.fillStyle(col(R.wall || '#4a4f5a')).fillRect(4, 24, cw - 8, 10).fillRect(4, h - 6, cw - 8, 6);
  furniture(g, def.function, 0, h - 6, cw, h - 30, R.light || '#ffcf7a');
  g.generateTexture(key, Math.ceil(cw), h); g.destroy();
  return key;
}

export class Camp {
  constructor(scene, box, geo) {
    this.scene = scene; this.box = box; this.geo = geo;
    const D = scene.data_, C = D.camp || {}, T = scene.T, s = box.save;
    this.D = D; this.C = C;
    this.ground = geo.floor * T;
    this.day = daytimeAt(C, s.hour);
    this.hotspots = [];
    this.lights = [];
    // the rig and the scrapyard; also the budgets (Rig-Bau › Regeln): without power, workshops that need it do not work; too heavy, no driving
    this.drawRig();
    this.drawFire();
    this.placeChest();
    this.vanGlow();
    this.placeCompanions();
    this.startSound();
    // the van: E at its door shows the van's own workshops
    const vanWs = geo.tractor?.workshops || [];
    this.hotspots.push({ x: geo.doorX, w: 110, name: D.tractors?.[geo.tractor?.id]?.name || 'Van', hint: vanWs.length ? 'Einsteigen' : 'Van',
      act: () => this.vanMenu(vanWs) });
    // the van's own storage (Kofferraum): E at the rear door
    const T0 = D.tractors?.[geo.tractor?.id] || {};
    if (T0.storage?.[0]) this.storeHotspot('rig:0', geo.vanLeft + (geo.vanRight - geo.vanLeft) * (C.rig?.trunkAt ?? 12) / 100, T0.storageName || 'Kofferraum', false);
    // earth below the bottom of the world: visible when the camera zooms out to build
    scene.add.rectangle(-4000, geo.H * T, geo.W * T + 8000, 4000, col(C.ground?.color || '#4a3628')).setOrigin(0).setDepth(-9);
    scene.add.rectangle(-4000, geo.floor * T, 4000, geo.H * T, col(C.ground?.color || '#4a3628')).setOrigin(0).setDepth(-9);
    scene.add.rectangle(geo.W * T, geo.floor * T, 4000, geo.H * T, col(C.ground?.color || '#4a3628')).setOrigin(0).setDepth(-9);
    // night over the world, lights shine through it
    const shade = (this.day.shade ?? 0) / 100;
    this.night = scene.add.rectangle(-4000, -4000, geo.W * T + 8000, geo.H * T + 8000, 0x0a0820, shade).setOrigin(0).setDepth(30);
    this.lightK = (this.day.light ?? Math.min(100, shade * 200)) / 100;   // how strongly fire and windows shine (Tag & Nacht › Licht)
    for (const l of this.lights) l.setAlpha(l.base * this.lightK).setVisible(this.lightK > 0);
    this.prompt = null; this.barkAt = scene.time.now + 2500;
  }

  // ---------- the rig as a dollhouse ----------
  // Every container is its own view (a Phaser container standing on the ground), so building can redraw the rig on the spot
  // and let a single trailer wobble on its springs. Lights, interior platforms, labels and the workshops' E spots belong to it.
  drawRig({ hide = null } = {}) {
    const s = this.scene;
    this.hide = hide;   // building: a workshop that is in the hand right now is not drawn
    for (const o of this.rigObjs || []) o.destroy();
    this.rigObjs = [];
    for (const l of this.lights) if (l.rig) l.destroy();
    this.lights = this.lights.filter(l => !l.rig);
    this.hotspots = this.hotspots.filter(h => !h.rig);
    s.ladders = (s.ladders || []).filter(l => !l.rig);
    this.benches?.destroy();
    this.benches = new Benches(this);
    this.shut = Object.fromEntries((this.shells || []).map(c => [c.key, c.a]));
    this.shells = [];
    this.labels = [];
    this.geo.units = rigUnits(this.D, this.box.save.rig, this.geo.vanLeft, this.ground, s.T);
    this.budget = budgets(this.D, this.box.save.rig);
    this.noPower = this.D.build?.rules?.power !== false && this.budget.power.net < 0;
    this.tooHeavy = this.D.build?.rules?.weight !== false && this.budget.heavy;
    for (const u of this.geo.units) u.view = this.drawUnit(u);
    this.drawVanParts();
    this.drawVanDoor();
    this.drawYard();
    if (this.night) for (const l of this.lights) if (l.rig) l.setAlpha(l.base * this.lightK).setVisible(this.lightK > 0);
    this.updateShells(0);   // labels and lights of closed containers right away, not one frame later
  }
  // one container in the rig: shell (picture or code), furniture, lights, the interior floor as a platform, E spots
  drawUnit(u) {
    const s = this.scene, D = this.D, R = this.C.rig || {}, mid = (u.x0 + u.x1) / 2, G = u.base ?? this.ground, view = s.add.container(mid, G).setDepth(-21);
    this.curTop = u.level ? u.floorY : null;   // E spots of a stacked container only work up there
    this.rigObjs.push(view);
    const add = o => { view.add(o); return o; };
    if (u.chassis) {
      const key = chassisTexture(s, u.chassis.plan);
      if (key) add(s.add.image(u.x0 - mid, 0, key).setOrigin(0, 1).setScale(u.chassis.k));
    }
    if (u.sprite) {
      if (s.textures.exists(u.sprite.key)) {
        s.textures.get(u.sprite.key).setFilter(NEAREST());
        const img = add(s.add.image(u.sprite.cx - mid, u.sprite.dy || 0, u.sprite.key, 0).setOrigin(u.sprite.ox, u.sprite.oy).setScale(u.sprite.k).setFlipX(u.sprite.flip));
        // something stacked on top: the roof clutter above the deck is cut off, the container sits right on the roof (Container › Dachaufbau abschneiden)
        const U = this.box.save.rig.units, onTop = (U[u.ui + 1]?.level || 0) > (u.level || 0);
        if (onTop && u.def.deck != null && u.def.cropAbove !== false) { const f = img.frame; img.setCrop(0, u.def.deck, f.width, f.height - u.def.deck); }
        // closed shell (Container › Aussehen geschlossen): lies over the workshops and their effects, under Leyla; update() fades it
        const ck = u.def.lookClosed;
        if (ck && s.textures.exists(ck)) {
          s.textures.get(ck).setFilter(NEAREST());
          const shut = s.add.image(u.sprite.cx, G + (u.sprite.dy || 0), ck, 0).setOrigin(u.sprite.ox, u.sprite.oy).setScale(u.sprite.k).setFlipX(u.sprite.flip).setDepth(-19.5);
          if (onTop && u.def.deck != null && u.def.cropAbove !== false) { const f = shut.frame; shut.setCrop(0, u.def.deck, f.width, f.height - u.def.deck); }
          const was = this.shut?.[`${u.ui}:${u.id}`] ?? 1;   // redrawn rig (building): keep the current state, no flash
          shut.setAlpha(was);
          this.rigObjs.push(shut);
          this.shells.push({ u, img: shut, key: `${u.ui}:${u.id}`, a: was });
        }
      }
    } else add(s.add.image(u.x0 - mid, 0, shellTexture(s, D, u.def, s.T)).setOrigin(0, 1).setScale(1));
    // furniture: one texture per container, drawn in the interior
    const g = s.make.graphics({}, false), h = u.floorY - u.inTop, key = `camp_unit_${u.ui}`, shades = [];
    // a floor with depth for low top-down workshop pictures (Camp › Boden im Innenraum, Daniel 09.11.2026): the back feet stand on it,
    // Leyla walks along its front edge; pixel style in three tones, seams in the sheet
    const F = R.floor || {}, depth = u.def.floorStrip ? F.depth || 0 : 0, inset = u.def.benchInset ?? (depth ? Math.min(F.inset || 0, depth) : 0);
    if (depth > 0) {
      const fg = s.add.graphics(), x0 = u.in0, x1 = u.in0 + u.cell * u.places, y1 = u.floorY, y0 = y1 - depth, base = col(F.color || '#3a3f48');
      const tone = k => Phaser.Display.Color.IntegerToColor(base).darken(k).color, lift = k => Phaser.Display.Color.IntegerToColor(base).lighten(k).color;
      fg.fillStyle(base).fillRect(x0, y0, x1 - x0, depth);
      fg.fillStyle(tone(30)).fillRect(x0, y0, x1 - x0, Math.max(2, Math.round(depth * 0.18)));          // the far end under the back wall
      fg.fillStyle(tone(15)).fillRect(x0, y0 + Math.round(depth * 0.18), x1 - x0, Math.max(2, Math.round(depth * 0.2)));
      fg.fillStyle(lift(18)).fillRect(x0, y1 - 4, x1 - x0, 4);                                           // the front edge Leyla walks on
      if (F.seam > 0) for (let x = x0 + F.seam; x < x1 - 4; x += F.seam) fg.fillStyle(tone(22)).fillRect(Math.round(x), y0, 2, depth - 4);
      fg.x = -mid; fg.y = -G; add(fg);
    }
    for (const w of u.workshops) {
      if (this.hide && this.hide.ui === u.ui && this.hide.at === w.at) continue;
      const def = D.workshops?.[w.id] || {}, cx = u.in0 + w.at * u.cell - u.x0, cw = (def.places || 1) * u.cell, place = `${u.ui}:${w.at}`;
      // Daniel's picture with its lights and effects (benches.js), otherwise furniture from code
      const px0 = u.in0 + w.at * u.cell, clip = { x0: px0, x1: px0 + cw, y0: u.inTop, y1: u.floorY + 4 };   // the place inside the container
      const art = this.benches.add({ id: w.id, place, x0: px0, w: cw, floor: u.floorY - inset, h, view, mid, G, grid: def.grid && `store:${place}`, clip, unitScale: (u.def.benchScale ?? 100) / 100 });
      if (art) shades.push(clip);
      if (!art) furniture(g, def.function, cx, h + 40, cw, h, R.light || '#ffcf7a');
      if (!u.sprite && !art) g.fillStyle(0x0d0a12).fillRect(cx + cw / 2 - 26, 40 + 22, 52, 34).fillStyle(col(R.light || '#ffcf7a')).fillRect(cx + cw / 2 - 22, 40 + 26, 44, 26);   // window
      const l = this.light(u.in0 + w.at * u.cell + cw / 2, u.inTop + h * 0.35, 200, R.light || '#ffcf7a', 0.45); l.rig = true; l.unit = u.ui;
      this.workshopHotspot(u, w, def, u.in0 + w.at * u.cell, cw, u.inTop + 8);
    }
    // a little shade under the ceiling and along the walls, so the pictures sit inside the room (3 steps, pixel style)
    if (shades.length) {
      const sg = s.add.graphics(), x0 = u.in0, x1 = u.in0 + u.cell * u.places;
      [[0.32, 4], [0.18, 8], [0.08, 14]].forEach(([a, d]) => { sg.fillStyle(0x0d0a12, a).fillRect(x0, u.inTop, x1 - x0, d).fillRect(x0, u.inTop, d, h).fillRect(x1 - d, u.inTop, d, h); });
      for (const c of shades) if (c.x0 > x0 + 1) [[0.22, 3], [0.1, 7]].forEach(([a, d]) => sg.fillStyle(0x0d0a12, a).fillRect(c.x0 - d / 2, u.inTop, d, h));   // between two places
      sg.x = -mid; sg.y = -G; this.benchShade = sg;
    }
    if (!u.sprite) for (let i = 1; i < u.places; i++) g.fillStyle(col(R.wall || '#4a4f5a')).fillRect(u.in0 - u.x0 + i * u.cell - 3, 40, 6, h - 120);   // thin walls between the places
    if (s.textures.exists(key)) s.textures.remove(key);
    g.generateTexture(key, Math.ceil(u.x1 - u.x0), Math.ceil(h + 44)); g.destroy();
    add(s.add.image(u.x0 - mid, u.inTop - 40 - G, key).setOrigin(0));
    if (this.benchShade) { add(this.benchShade); this.benchShade = null; }
    // a divider between two workshop places, cut from the container's own picture (Container › Trennwand aus dem Bild, Daniel 09.11.2026):
    // only some columns (narrow post), its foot somewhere on the floor between back wall and front edge so Leyla walks past it in front,
    // a stepped shadow on the floor at its foot and on the back wall beside it
    const dv = u.def.divider;
    if (u.sprite && dv?.x?.length === 2 && dv?.y?.length === 2 && u.places > 1 && s.textures.exists(u.sprite.key)) {
      const k = u.sprite.k, [dx0, dx1] = dv.x, [dy0, dy1] = dv.y, [top, front] = u.def.inside?.y || [dy0, dy1];
      const cols = String(dv.keep || '').split(',').map(Number).filter(c => Number.isFinite(c) && c >= dx0 && c <= dx1);
      const keep = cols.length ? cols : Array.from({ length: dx1 - dx0 + 1 }, (_, i) => dx0 + i);
      // rows top … foot - 1: the post ends right under the ceiling beam
      const foot = Math.min(front, dv.foot ?? front), r0 = Math.max(dy0, dy1 - (foot - top) + 1), hh = dy1 - r0 + 1, w = keep.length;
      const tk = `divider_${u.sprite.key}_${keep.join('-')}_${r0}_${dy1}`;
      if (!s.textures.exists(tk)) {
        const c = s.textures.createCanvas(tk, w, hh), src = s.textures.get(u.sprite.key).getSourceImage();
        keep.forEach((x, i) => c.getContext().drawImage(src, x, r0, 1, hh, i, 0, 1, hh)); c.refresh();
      }
      s.textures.get(tk).setFilter(NEAREST());
      const a = (dv.shadow ?? 0) / 100, back = dv.back ?? foot, footY = u.floorY - (front - foot) * k, backY = u.floorY - (front - back) * k;
      // only where a workshop stands on at least one side, never through the middle of a workshop that takes several places (Daniel 09.11.2026)
      const occ = Array(u.places).fill(null);
      u.workshops.forEach((ws, n) => { for (let p = 0; p < (D.workshops?.[ws.id]?.places || 1); p++) if (ws.at + p < u.places) occ[ws.at + p] = n; });
      for (let i = 1; i < u.places; i++) {
        if (occ[i - 1] === occ[i] || (occ[i - 1] == null && occ[i] == null)) continue;
        const x = u.in0 + i * u.cell, half = w * k / 2;
        if (a > 0) {
          const sh = s.add.graphics();
          // back wall beside the post (two steps), then the floor: a dark patch at the foot that thins out towards the front
          [[0.45, 1], [0.2, 2]].forEach(([o, d]) => sh.fillStyle(0x07060a, a * o).fillRect(x - half - d * k, u.inTop, d * k, backY - u.inTop).fillRect(x + half, u.inTop, d * k, backY - u.inTop));
          sh.fillStyle(0x07060a, a * 0.55).fillRect(x - half - k, backY, w * k + 2 * k, footY - backY + k);
          sh.fillStyle(0x07060a, a * 0.3).fillRect(x - half - 2 * k, footY + k, w * k + 4 * k, k);
          sh.fillStyle(0x07060a, a * 0.14).fillRect(x - half - 3 * k, footY + 2 * k, w * k + 6 * k, k);
          sh.x = -mid; sh.y = -G; add(sh);
        }
        add(s.add.image(x - mid, footY - G, tk).setOrigin(0.5, 1).setScale(k).setFlipX(u.sprite.flip));
      }
    }
    // Deichselkasten: a little steel box on the drawbar (code), E opens the trailer's own storage
    if (u.def.storage?.[0]) {
      // stacked: no drawbar, the box stands on the floor at the front end
      const k = (this.C.rig?.boxAt ?? 55) / 100, b0 = u.in0 + (u.body || 0) + 12, bx = u.level ? u.in0 + u.cell * u.places - 34 : u.sprite ? u.x1 - 40 : b0 + (u.x1 - 10 - b0) * k;
      const by = u.level ? u.floorY : u.sprite ? G - 40 : u.floorY + (G - 40 - u.floorY) * k, bw = 44, bh = 26;
      const bg = s.add.graphics();
      bg.fillStyle(0x1b1d22).fillRect(bx - bw / 2 - 2, by - bh - 4, bw + 4, bh + 4).fillStyle(0x5a616b).fillRect(bx - bw / 2, by - bh - 2, bw, bh)
        .fillStyle(0x8b949e).fillRect(bx - bw / 2, by - bh - 2, bw, 4).fillStyle(0x2b2f36).fillRect(bx - 5, by - bh + 8, 10, 5)
        .fillStyle(0xd9a441).fillRect(bx - bw / 2 + 4, by - 8, bw - 8, 2);
      bg.x = -mid; bg.y = -G; add(bg);
      this.storeHotspot(`rig:${u.ui}`, bx, u.def.storageName || 'Deichselkasten');
    }
    // the interior floor carries Leyla (jump in), workshops are used with E from the ground or from inside
    const z = s.add.zone(u.in0 + u.cell * u.places / 2, u.floorY + 8, u.cell * u.places, 16);
    s.platforms.add(z);
    Object.assign(z.body.checkCollision, { down: false, left: false, right: false });
    this.rigObjs.push(z);
    // a stacked container has end walls: up there Leyla can walk from end to end without stepping off into the air (down = ladder)
    if (u.level) for (const wx of [u.in0 - 8, u.in0 + u.cell * u.places + 8]) {
      const wall = s.add.zone(wx, (u.inTop + u.floorY) / 2, 16, u.floorY - u.inTop);
      s.solids.add(wall); this.rigObjs.push(wall);
    }
    if (u.level) this.stackLadder(u);
    this.curTop = null;
    return view;
  }
  // a ladder from below up into a stacked container (Camp › Rig-Ansicht › Leiter bei): climbs like an H ladder, at the top she pulls herself in
  stackLadder(u) {
    const s = this.scene, R = this.C.rig || {}, foot = u.foot || u, below = this.geo.units.find(x => x.ui === u.ui - 1) || foot;
    // Camp › Rig-Ansicht › Leiter bei (% of the unit below), but always under the floor of the container on top:
    // a short container sits in the middle of a long trailer, a ladder beside it ended in the air (Daniel, 09.11.2026)
    const in1 = u.in0 + u.cell * u.places, edge = Math.min(s.T * 0.75, (in1 - u.in0) / 2);
    const x = Math.min(Math.max(foot.x0 + (foot.x1 - foot.x0) * (R.ladderAt ?? 8) / 100, u.in0 + edge), in1 - edge), top = u.floorY, bottom = u.level > 1 ? below.floorY : this.ground;
    const g = s.add.graphics().setDepth(-18);
    g.fillStyle(0x30363d).fillRect(x - 22, top - 30, 6, bottom - top + 30).fillRect(x + 16, top - 30, 6, bottom - top + 30);
    g.fillStyle(0x8b949e).fillRect(x - 22, top - 30, 2, bottom - top + 30).fillRect(x + 16, top - 30, 2, bottom - top + 30);
    for (let y = bottom - 20; y > top - 20; y -= 28) g.fillStyle(0x6b7280).fillRect(x - 16, y, 32, 5);
    this.rigObjs.push(g);
    s.ladders.push({ cx: x, x0: x - s.T / 2, x1: x + s.T / 2, top, bottom, rig: true });
  }
  // a small storage of its own (Kofferraum, Deichselkasten): E opens and closes it
  storeHotspot(key, x, name, rig = true) {
    const inv = () => this.scene.hud.inv, isOpen = () => inv()?.isOpen && inv().other?.key === key;
    this.hotspots.push({ rig, x, w: 50, top: this.curTop, name, hint: () => isOpen() ? 'Schließen' : 'Öffnen', store: key, act: () => { if (isOpen()) inv().close(); else this.scene.openContainer(key); } });
  }
  workshopHotspot(u, w, def, cx, cw, labelY) {
    const R = this.C.rig || {};
    const store = def.grid && `store:${u.ui}:${w.at}`;
    this.hotspots.push({ rig: true, place: `${u.ui}:${w.at}`, x: cx + cw / 2, w: cw / 2, top: this.curTop, floor: u.floorY, name: def.name || w.id, hint: store ? 'Öffnen' : this.noPower && def.power < 0 ? 'Kein Strom' : VERB[def.function] || 'Ansehen', ws: w.id, act: () => store ? this.scene.openContainer(store) : this.use(w.id, `${u.ui}:${w.at}`) });
    if (R.labels !== false && def.function !== 'tank') {   // the cryo tank has its own screen
      const t = this.scene.add.text(cx + cw / 2, labelY, def.name || w.id, { fontFamily: 'VT323, monospace', fontSize: '24px', color: '#ffd27a', stroke: '#0d0a12', strokeThickness: 5 }).setOrigin(0.5, 0).setDepth(-14);
      t.unit = u.ui; this.rigObjs.push(t); (this.labels ||= []).push(t);   // fades with a closed shell
    }
  }

  // ---------- scrapyard by the shaft: spare workshops on pallets, spare trailers parked behind, the dealer's pad ----------
  // built-in rig parts you can see from outside (Rig-Bau › Rig-Teile am Van › Im Camp sichtbar): Dachbox on the roof, plates on the side
  drawVanParts() {
    const s = this.scene, D = this.D, vis = D.build?.sockets?.visible || ['armor', 'weapon', 'roof'];
    if (s.hud.build?.active) return;   // building: the sockets show them
    for (const p of socketRects(D, this.box.save.rig, this.geo, this.ground)) {
      if (!p.id || !vis.includes(p.slot)) continue;
      const v = partView(s, D, p.id).setDepth(-19.5);
      v.setPosition(p.cx, p.cy + v.h / 2);
      this.rigObjs.push(v);
    }
  }
  // pixel magic at the van's sliding door (Zugmaschine › Blick durch die Tür): the workshop behind the door shows through the
  // open door, cut at the door frame, with its lights and effects; it fades in when the door is fully open
  drawVanDoor() {
    const s = this.scene, D = this.D, rig = this.box.save.rig, T0 = D.tractors?.[rig.tractor] || {}, Dr = T0.door, van = s.van;
    this.vanDoor = null;
    if (!Dr?.x || !Dr?.y || !van?.sprite) return;
    const w = (rig.units[0]?.workshops || []).find(x => x.at === (Dr.place ?? 0));
    if (!w || (this.hide && this.hide.ui === 0 && this.hide.at === w.at)) return;
    const a = van.toWorld(Dr.x[0], Dr.y[0]), b = van.toWorld(Dr.x[1], Dr.y[1]);
    const clip = { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: a.y, y1: b.y };
    const view = s.add.container(0, 0).setDepth(van.depth + 0.05);
    this.rigObjs.push(view);
    view.add(s.add.rectangle(clip.x0, clip.y0, clip.x1 - clip.x0, clip.y1 - clip.y0, col(Dr.backdrop || '#241a2c')).setOrigin(0));
    // the bench stands on the van's floor, centred in the door, in the shared scale
    const def = D.workshops?.[w.id] || {}, cw = Math.max(clip.x1 - clip.x0, 200);
    const bench = this.benches.add({ id: w.id, place: `0:${w.at}`, x0: (clip.x0 + clip.x1) / 2 - cw / 2, w: cw, floor: clip.y1, h: clip.y1 - clip.y0, view, mid: 0, G: 0, grid: def.grid && `store:0:${w.at}`, clip });
    if (!bench) { view.destroy(); return; }
    bench.door = true;
    view.setAlpha(0);
    this.vanDoor = { view, bench };
  }
  drawYard() {
    const s = this.scene, D = this.D, Y = this.geo.yard, sp = this.box.save.rig.spare || { workshops: [], containers: [] }, y = this.ground;
    this.yardItems = [];
    this.dealer = null;
    if (!Y) return;
    const C = this.C.yard || {}, keep = o => { this.rigObjs.push(o); return o; };
    const g = keep(s.add.graphics().setDepth(-19));
    let x = Y.x0;
    // dealer's pad: a steel plate with hazard stripes and a sign; drop things here to sell them, bought things are delivered here
    if (C.dealer !== false) {
      const w = C.dealerWidth ?? 170;
      g.fillStyle(0x30363d).fillRect(x, y - 10, w, 10).fillStyle(0x8b949e).fillRect(x, y - 12, w, 3);
      for (let i = 0; i < w; i += 24) g.fillStyle(0xe0b030).fillRect(x + i, y - 9, 12, 7);
      g.fillStyle(0x4a3424).fillRect(x + w - 26, y - 190, 8, 180);
      g.fillStyle(0x1b1d22).fillRect(x + w - 120, y - 230, 130, 56).fillStyle(0xe0b030).fillRect(x + w - 116, y - 226, 122, 48);
      keep(s.add.text(x + w - 55, y - 202, `${C.dealerName || 'Händler'} Δ`, { fontFamily: 'VT323, monospace', fontSize: '30px', color: '#1b1d22' }).setOrigin(0.5).setDepth(-18));
      this.dealer = { x0: x - 10, x1: x + w + 10, y0: y - 260, y1: y + 20, x: x + w / 2 };
      x += w + 30;
    }
    // spare trailers: parked further back, smaller and a little darker
    const far = (C.parkScale ?? 45) / 100;
    let px = x;
    sp.containers.forEach((id, i) => {
      const def = D.containers?.[id] || {}, sh = unitShape(D, def, 0, s.T, { stacked: true }), w = sh.w * far;
      const view = keep(s.add.container(px + w / 2, y - 24).setDepth(-23).setScale(far));
      if (sh.sprite && s.textures.exists(sh.sprite.key)) view.add(s.add.image(sh.sprite.cx - sh.w / 2, 0, sh.sprite.key, 0).setOrigin(sh.sprite.ox, sh.sprite.oy).setScale(sh.sprite.k).setFlipX(sh.sprite.flip).setTint(0xb8a8b0));
      else view.add(s.add.image(-sh.w / 2, 0, shellTexture(s, D, def, s.T)).setOrigin(0, 1).setTint(0xb8a8b0));
      const top = y - 24 - (sh.sprite ? (sh.sprite.k * (D.assets?.[def.look]?.frameSize?.[1] || 256) * sh.sprite.oy) : (sh.lift + (this.C.rig?.height ?? 248) + 30)) * far;
      this.yardItems.push({ kind: 'container', i, id, x0: px, x1: px + w, y0: top, y1: y, view, x: px + w / 2 });
      px += w + 20;
    });
    // spare workshops: packed in crates with a label (Camp › Verpackte Werkstätten), on pallets in front
    let wx = px;
    sp.workshops.forEach((id, i) => {
      const key = crateTexture(s, D, id), src = s.textures.get(key).getSourceImage(), w = src.width, hh = src.height;
      g.fillStyle(0x7a5a3a).fillRect(wx - 6, y - 12, w + 12, 12).fillStyle(0x4a3424);
      for (let k = 0; k < w + 12; k += 28) g.fillRect(wx - 6 + k + 4, y - 8, 12, 8);
      const view = keep(s.add.container(wx + w / 2, y - 12).setDepth(-17));
      view.add(s.add.image(0, 0, key).setOrigin(0.5, 1));
      this.yardItems.push({ kind: 'ws', i, id, x0: wx, x1: wx + w, y0: y - 12 - hh, y1: y, view, x: wx + w / 2 });
      wx += w + 24;
    });
    // spare rig parts: on a low rack after the workshops
    let qx = wx + (sp.workshops.length ? 10 : 0);
    (sp.parts || []).forEach((id, i) => {
      const v = keep(partView(s, D, id, (C.partScale ?? 80) / 100).setDepth(-17));
      g.fillStyle(0x4a3424).fillRect(qx, y - 10, v.w + 8, 10).fillStyle(0x7a5a3a).fillRect(qx, y - 12, v.w + 8, 3);
      v.setPosition(qx + 4 + v.w / 2, y - 12);
      this.yardItems.push({ kind: 'part', i, id, x0: qx, x1: qx + v.w + 8, y0: y - 12 - v.h, y1: y, view: v, x: qx + 4 + v.w / 2 });
      qx += v.w + 18;
    });
    // some scrap so the place reads as a yard even when it is empty: a tyre stack and a barrel
    const ex = Y.x1 - 70;
    for (let i = 0; i < 3; i++) g.fillStyle(0x15161a).fillRoundedRect(ex - 36, y - 22 - i * 20, 72, 20, 8).fillStyle(0x2a2c32).fillRect(ex - 14, y - 16 - i * 20, 28, 8);
    g.fillStyle(0x6a3a2a).fillRect(ex - 120, y - 70, 44, 70).fillStyle(0x8a4a32).fillRect(ex - 120, y - 56, 44, 6).fillRect(ex - 120, y - 24, 44, 6);
  }

  light(x, y, r, color, base, h = r) {
    const l = this.scene.add.image(x, y, glowTexture(this.scene)).setDisplaySize(r * 2, h * 2).setTint(col(color)).setBlendMode(Phaser.BlendModes.ADD).setDepth(31);
    l.base = base; this.lights.push(l);
    return l;
  }

  // ---------- closed containers: open near Leyla, while building or with the button „Rig offen“ ----------
  // (Daniel, 09.11.2026: „Wenn Leyla nicht in der Nähe oder im Baumodus ist oder die offene Ansicht getoggelt wird, sind sie zu“)
  updateShells(dt) {
    if (!this.shells?.length) return;
    const s = this.scene, l = s.leyla, O = this.C.rig?.open || {}, near = O.near ?? 160, fade = Math.max(1, O.fade ?? 350), leak = (O.lights ?? 15) / 100;
    const all = !!s.hud.build?.active || !!s.hud.rigOpen;
    for (const c of this.shells) {
      const u = c.u, top = u.inTop - 40, bottom = (u.base ?? this.ground) + 30;   // its own storey: from under its ceiling to its bottom rail
      const here = l && l.x > u.x0 - near && l.x < u.x1 + near && l.feet > top && l.feet < bottom;
      const target = all || here ? 0 : 1;
      if (c.a !== target) c.a = target > c.a ? Math.min(1, c.a + dt / fade) : Math.max(0, c.a - dt / fade);
      c.img.setAlpha(c.a).setVisible(c.a > 0.001);
      for (const lt of this.lights) if (lt.rig && lt.unit === u.ui) lt.setAlpha(lt.base * this.lightK * (1 - c.a * (1 - leak))).setVisible(this.lightK > 0);
      for (const t of this.labels) if (t.unit === u.ui) t.setAlpha(1 - c.a);
    }
  }

  // ---------- campfire ----------
  drawFire() {
    const F = this.C.fire || {};
    if (F.enabled === false) return;
    const s = this.scene, x = this.geo.fireX, y = this.ground;
    const info = F.look && s.assetInfo(F.look);
    if (info) {   // Daniel's pixel-art fire, sharp at whole pixels
      s.textures.get(info.key).setFilter(NEAREST());
      this.fireSprite = s.add.sprite(x, y, info.key).setOrigin(info.ox, info.oy).setScale(info.scale).setDepth(-4);
      if (info.anim) this.fireSprite.play(info.anim);
    } else {
      const g = s.add.graphics().setDepth(-5);
      g.fillStyle(0x3a2a1e).fillRect(x - 46, y - 14, 92, 14).fillStyle(0x5a4030).fillRect(x - 40, y - 22, 34, 10).fillRect(x + 6, y - 22, 34, 10);
      for (let i = -3; i <= 3; i++) g.fillStyle(0x6b6258).fillRect(x + i * 18 - 7, y - 10, 14, 10);
      this.flame = s.add.graphics().setDepth(-4);
    }
    // light: a big soft glow round the flames, a hot core and a warm pool on the ground (evening and night)
    const k = (F.strength ?? 100) / 100, lift = F.lift ?? 80, color = F.color || '#ff9a3a';
    this.fireLights = [
      this.light(x, y - lift, F.radius ?? 420, color, 0.6 * k),
      this.light(x, y - lift, (F.radius ?? 420) * 0.35, '#ffd27a', 0.45 * k),
      ...(F.pool ? [this.light(x, y + 6, F.pool, color, 0.5 * k, F.pool * 0.14)] : []),
    ];
    this.hotspots.push({ x, w: 90, name: 'Lagerfeuer', hint: 'Hinsetzen', act: () => this.sitDown() });
  }

  // ---------- van: at night warm light pours out of the open sliding door ----------
  vanGlow() {
    const V = this.C.vanLight || {};
    if (V.enabled === false) return;
    const x = this.geo.doorX, y = this.ground, k = (V.strength ?? 100) / 100, color = V.color || '#ffcf7a';
    this.doorLights = [
      this.light(x, y - (V.lift ?? 150), (V.width ?? 110), color, 0.55 * k, (V.height ?? 150)),   // the open doorway glows
      this.light(x + (V.spill ?? 40), y + 4, (V.pool ?? 260), color, 0.45 * k, (V.pool ?? 260) * 0.16),   // light spills onto the ground
    ];
  }

  // chest lid: open while its inventory is open (also while the window pauses the game)
  lid(dt) {
    const c = this.chest, s = this.scene;
    if (!c) return;
    c.open = !!(s.hud.inv?.isOpen && s.hud.inv.other?.key === 'chest');
    const target = c.open ? c.frames - 1 : 0;
    if (c.frame !== target) c.frame = c.frame < target ? Math.min(target, c.frame + c.fps * dt / 1000) : Math.max(target, c.frame - c.fps * dt / 1000);
    c.sprite.setFrame(Math.round(c.frame));
  }
  // ---------- chest: closed, E opens and closes it (the frames run forward or back) ----------
  placeChest() {
    const K = this.C.chest || {}, s = this.scene;
    const info = K.enabled !== false && K.look && s.assetInfo(K.look);
    if (!info) return;
    s.textures.get(info.key).setFilter(NEAREST());
    const x = (this.geo.vanCol + (K.at ?? 16) + 0.5) * s.T, A = this.D.assets?.[K.look] || {};
    const sprite = s.add.sprite(x, this.ground, info.key, 0).setOrigin(info.ox, info.oy).setScale(info.scale).setFlipX(!!K.flip).setDepth(-3);
    this.chest = { x, sprite, frames: A.frames || 1, fps: A.fps || 8, frame: 0, open: false };
    // E opens the lid and the chest's inventory, E again closes both
    const inv = () => this.scene.hud.inv, isOpen = () => inv()?.isOpen && inv().other?.key === 'chest';
    this.hotspots.push({ x, w: 70, name: 'Kiste', hint: () => isOpen() ? 'Schließen' : 'Öffnen', act: () => {
      if (isOpen()) inv().close(); else this.scene.openContainer('chest');
    } });
  }

  // ---------- sound: soft wind with gusts, the fire gets louder (and moves left/right) the closer Leyla comes ----------
  startSound() {
    const s = this.scene, S = this.C.sound || {}, vol = id => (this.D.assets?.[id]?.volume ?? 100) / 100;
    const play = (id, v, loop) => s.cache.audio.exists(id) ? s.sound.add(id, { loop, volume: v }) : null;
    this.wind = S.wind && play(S.wind, (S.windVolume ?? 20) / 100 * vol(S.wind), true);
    this.fireSound = S.fire && play(S.fire, 0, true);
    this.fireBase = vol(S.fire);
    this.wind?.play(); this.fireSound?.play();
    if (this.fireSound) this.fireSound.setSeek?.(Math.random() * 20);   // not always the same crackle
    this.gustAt = s.time.now + this.gustDelay();
  }
  cam() { return this.scene.cam || this.scene.cameras.main; }
  gustDelay() { const [a, b] = this.C.sound?.gustEvery || [9, 22]; return (a + Math.random() * (b - a)) * 1000; }
  updateSound(time) {
    const s = this.scene, S = this.C.sound || {}, l = s.leyla;
    if (this.fireSound) {
      const d = Math.abs(l.x - this.geo.fireX), near = S.fireNear ?? 120, range = S.fireRange ?? 1100;
      const k = Math.max(0, Math.min(1, 1 - (d - near) / Math.max(1, range - near)));
      const v = ((S.fireMin ?? 4) + ((S.fireVolume ?? 90) - (S.fireMin ?? 4)) * k * k) / 100 * this.fireBase;
      this.fireSound.setVolume(v);
      this.fireVolume = v;
      if (this.fireSound.setPan) this.fireSound.setPan(Math.max(-0.7, Math.min(0.7, (this.geo.fireX - l.x) / 900)));
    }
    // gaming at the fire: little retro blips from the handheld, chained at random, quiet and far away (Camp › Am Feuer sitzen › Töne)
    const sit = l.state === 'sit' && l.sit, F = this.C.fire?.sit || {}, list = (F.sounds || []).filter(id => s.cache.audio.exists(id));
    const gaming = sit && !sit.up && time - sit.at > (F.downTo ?? 6) * 1000 / (F.fps || 5) && list.length;
    if (!gaming) this.blipAt = 0;
    else if (!this.blipAt) this.blipAt = time + 300;
    else if (time > this.blipAt) {
      const id = list[Math.floor(Math.random() * list.length)], [g0, g1] = F.soundGap || [120, 650];
      const snd = s.sound.add(id, { volume: (F.soundVolume ?? 12) / 100 * (0.7 + Math.random() * 0.3) * ((this.D.assets?.[id]?.volume ?? 100) / 100), detune: (Math.random() - 0.5) * 200 });
      if (snd.setPan) snd.setPan(Math.max(-0.5, Math.min(0.5, (l.x - this.cam().midPoint.x) / 1500)));
      snd.once('complete', () => snd.destroy());
      snd.play();
      const len = (snd.duration || 0.3) * 1000;
      this.blipAt = time + len + g0 + Math.random() * (g1 - g0) + (Math.random() * 100 < (F.soundPause ?? 18) ? 1200 + Math.random() * 1800 : 0);   // now and then a longer pause
    }
    if (time > this.gustAt && (S.gusts || []).length) {
      const id = S.gusts[Math.floor(Math.random() * S.gusts.length)];
      if (s.cache.audio.exists(id)) s.sound.play(id, { volume: (S.gustVolume ?? 14) / 100 * ((this.D.assets?.[id]?.volume ?? 100) / 100) * (0.6 + Math.random() * 0.4) });
      this.gustAt = time + this.gustDelay();
    }
  }

  // ---------- companions ----------
  placeCompanions() {
    const s = this.scene, D = this.D, ids = this.box.save.companions || [], [a, b] = this.geo.companionX;
    this.companions = ids.map((id, i) => {
      const def = D.companions?.[id] || {}, x = ids.length > 1 ? a + (b - a) * i / (ids.length - 1) : (a + b) / 2;
      const info = def.look && s.assetInfo(def.look);
      const h = def.height ?? 170;
      const sprite = info ? s.add.sprite(x, this.ground, info.key).setOrigin(info.ox, info.oy).setScale(info.scale) : s.add.image(x, this.ground, figureTexture(s, 'comp_' + id, def.color, def.role)).setOrigin(0.5, 1).setScale(h / 75);
      if (info?.anim) sprite.play(info.anim);
      sprite.setDepth(-3).setFlipX(x > this.geo.fireX);
      const bubble = s.add.text(x, this.ground - h - 16, '', { fontFamily: 'VT323, monospace', fontSize: '30px', color: '#17111f', backgroundColor: '#f2eef7', padding: { x: 10, y: 4 }, wordWrap: { width: 420 }, align: 'center' }).setOrigin(0.5, 1).setDepth(25).setAlpha(0);
      const c = { id, def, x, sprite, bubble, h, until: 0, last: -1 };
      this.hotspots.push({ x, w: 70, name: def.name || id, hint: 'Reden', act: () => this.bark(c, true) });
      return c;
    });
  }
  bark(c, now = false) {
    const lines = c.def.lines || [];
    if (!lines.length) return;
    let i = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && i === c.last) i = (i + 1) % lines.length;
    c.last = i;
    c.bubble.setText(lines[i]).setAlpha(1);
    c.until = this.scene.time.now + (this.C.companions?.barkTime ?? 4) * 1000 + (now ? 1000 : 0);
  }

  // ---------- actions ----------
  use(id, place = null) {
    const def = this.D.workshops?.[id] || {}, s = this.scene;
    if (this.noPower && def.power < 0 && def.function !== 'warroom' && def.function !== 'tank')
      return s.hud.menu({ title: def.name || id, sub: `Kein Strom: das Rig erzeugt ${this.budget.power.made} ⚡ und braucht ${this.budget.power.used} ⚡. Generator einbauen oder Verbraucher ausbauen (B: Rig umbauen).`,
        items: [{ label: 'Rig umbauen', primary: true, act: () => s.openBuild() }, { label: 'Zurück', act: () => {} }] });
    if (def.function === 'sleep') return this.sleep(def);
    if (def.function === 'warroom') return this.warroom();
    if (['kitchen', 'craft', 'tank'].includes(def.function)) { s.hud.inv?.close(); return s.hud.craft?.open(id); }
    if (def.function === 'guests') {   // who sleeps here: the guests in order, as many as there are beds in all guest bunks
      const P = passengers(this.D, this.box.save), nm = c => this.D.companions?.[c]?.name || c, waiting = Object.entries(this.box.save.waiting || {});
      return s.hud.menu({ title: def.name || id, sub: [def.description, P.guests.length ? `Gäste an Bord: ${P.riding.map(nm).join(', ') || '–'} · ${P.beds} ${P.beds === 1 ? 'Bett' : 'Betten'} im Rig.` : `${P.beds} ${P.beds === 1 ? 'Bett' : 'Betten'} frei für Fahrgäste.`,
        P.staying.length ? `Kein Bett für ${P.staying.map(nm).join(', ')}: ${P.staying.length > 1 ? 'sie bleiben' : 'bleibt'} beim nächsten Fahren hier.` : null,
        waiting.length ? 'Wartet: ' + waiting.map(([loc, ids]) => `${ids.map(nm).join(', ')} bei ${this.D.locations?.[loc]?.name || loc}`).join(' · ') : null].filter(Boolean).join(' '), items: [{ label: 'Zurück', act: () => {} }] });
    }
    const who = (this.box.save.companions || []).map(c => this.D.companions?.[c]).filter(c => c?.workshops?.includes(id)).map(c => c.name);
    if (def.rest?.verb) return this.restMenu(id, def, place, who);
    s.hud.menu({ title: def.name || id, sub: [def.description, who.length ? `Betreut von ${who.join(' und ')}.` : null, SOON[def.function] || 'Funktion kommt später.'].filter(Boolean).join(' '),
      items: [{ label: 'Zurück', act: () => {} }] });
  }
  // a workshop to spend time at (Werkstätten › Benutzen): Chill Area, Drohnenwerkstatt … time passes, heals, gives its buff;
  // AvA can fly over and dock on the bench while it happens
  restMenu(id, def, place, who) {
    const s = this.scene, save = this.box.save, R = def.rest, buff = def.buff && this.D.buffs?.[def.buff]?.name;
    const facts = [R.hours ? `${de(R.hours)} h` : null, R.heal ? `heilt ${R.heal} %` : null, buff ? `danach ${buff}` : null].filter(Boolean).join(' · ');
    s.hud.menu({ title: def.name || id, sub: [def.description, who.length ? `Betreut von ${who.join(' und ')}.` : null, facts].filter(Boolean).join(' '),
      items: [{ label: R.verb, primary: true, act: () => {
        const done = () => {
          this.resting = null;
          advance(save, R.hours || 0);
          if (R.heal) save.health = Math.min(s.leyla.maxHealth, s.leyla.health + s.leyla.maxHealth * R.heal / 100);
          if (def.buff && !save.buffs.includes(def.buff)) save.buffs.push(def.buff);
          s.goCamp({ banner: [R.banner || def.name || id, clockText(save) + (buff ? ' · ' + buff : '')], fade: 700, keepPlace: true });
        };
        this.resting = place;   // the bench's "Bei Benutzung" effects run meanwhile
        const dock = R.drone && place && this.benches?.dockOf(place);
        if (dock && s.drone) { s.drone.dock = { ...dock, until: s.time.now + 3200 }; s.drone.react('cleared'); s.time.delayedCall(3000, done); }
        else s.time.delayedCall(1400, done);
      } }, { label: 'Zurück', act: () => {} }] });
  }
  vanMenu(ids) {
    if (!ids.length) return this.scene.hud.menu({ title: 'Van', sub: 'Keine Werkstätten im Van.', items: [{ label: 'Zurück', act: () => {} }] });
    this.scene.hud.menu({ title: this.D.tractors?.[this.geo.tractor.id]?.name || 'Van', sub: 'Was willst du im Van machen?',
      items: [...ids.map(w => { const d = this.D.workshops?.[w.id] || {}; return { label: `${VERB[d.function] || 'Ansehen'} · ${d.name || w.id}`, act: () => this.use(w.id) }; }), { label: 'Zurück', act: () => {} }] });
  }
  sleep(def) {
    const s = this.scene, box = this.box, save = box.save, C = this.C, max = s.leyla.maxHealth;
    const h = hoursUntil(save, C.clock?.wakeHour ?? 7);
    s.hud.menu({ title: def.name || 'Schlafen', sub: `Schlafen bis ${String(C.clock?.wakeHour ?? 7).padStart(2, '0')}:00 (${h} h). Heilt ${C.heal?.sleep ?? 100} %.${def.buff ? ` Danach: ${this.D.buffs?.[def.buff]?.name || def.buff} für den nächsten Run.` : ''}`,
      items: [{ label: 'Schlafen', primary: true, act: () => {
        advance(save, h);
        save.health = Math.min(max, Math.max(save.health, s.leyla.health) + max * (C.heal?.sleep ?? 100) / 100);
        if (def.buff && !save.buffs.includes(def.buff)) save.buffs.push(def.buff);
        s.drone.react('sleep');
        s.goCamp({ banner: ['Guten Morgen, Leyla', `${clockText(save)}${def.buff ? ' · ' + (this.D.buffs?.[def.buff]?.name || def.buff) : ''}`], fade: 900 });
      } }, { label: 'Noch nicht', act: () => {} }] });
  }
  // Leyla sits down next to the fire on the side she came from, facing the flames, and games (Camp › Am Feuer sitzen).
  // Standing up after a while: the time moves on and the fire heals; without a sit animation straight to that.
  sitDown() {
    const s = this.scene, l = s.leyla, S = this.C.fire?.sit || {}, side = l.x >= this.geo.fireX ? 1 : -1;
    const rest = () => {
      const save = this.box.save, C = this.C, max = l.maxHealth;
      advance(save, C.clock?.fireHours ?? 1);
      save.health = Math.min(max, l.health + max * (C.heal?.fire ?? 25) / 100);
      s.goCamp({ banner: ['Knistern und Funken', clockText(save)], fade: 600, keepPlace: true });
    };
    if (!S.look || !s.textures.exists(S.look)) return rest();
    l.startSit(S, this.geo.fireX + side * (S.distance ?? 150), -side, sat => { if (sat >= (S.minSeconds ?? 3)) rest(); });
  }
  // Warroom: plunder the POI here, or drive somewhere else
  warroom() {
    const s = this.scene, D = this.D, save = this.box.save, here = D.locations?.[save.location];
    const items = [];
    if (here?.poi && D.pois?.[here.poi]) {
      const p = D.pois[here.poi];
      items.push({ label: `Plündern: ${p.name}`, sub: `Gefahr ${'●'.repeat(p.danger || 1)} · ein Run dauert ${this.C.clock?.runHours ?? 3} h${save.buffs.length ? ' · Buffs: ' + save.buffs.map(b => D.buffs?.[b]?.name || b).join(', ') : ''}`,
        primary: true, act: () => s.startRun(here.poi) });
    }
    for (const [id, loc] of Object.entries(D.locations || {})) {
      if (id === save.location) continue;
      const t = travelCost(D, save, id), p = D.pois?.[loc.poi];
      items.push({ label: `Hinfahren: ${loc.name}`, sub: `${t.km} km · ${de(t.hours)} h · ${de(t.fuel)} l Sprit · ${loc.region || ''}${p ? ' · Gefahr ' + '●'.repeat(p.danger || 1) : ''}`,
        disabled: this.tooHeavy ? `Rig zu schwer (${this.budget.weight} von ${this.budget.pull} kg)` : t.fuel > save.fuel ? 'Zu wenig Sprit' : null, act: () => this.drive(id, t) });
    }
    items.push({ label: 'Zurück', act: () => {} });
    const P = passengers(D, save), names = ids => ids.map(c => D.companions?.[c]?.name || c).join(' und ');
    const guests = P.guests.length ? ` · Gäste ${P.guests.length}/${P.beds} Betten${P.staying.length ? `: ${names(P.staying)} ${P.staying.length > 1 ? 'bleiben' : 'bleibt'} beim Fahren hier (keine freie Gästekoje)` : ''}` : '';
    s.hud.menu({ title: 'Warroom', sub: `Du bist bei ${here?.name || '–'}. Sprit ${de(save.fuel)} l · Vorräte ${de(save.food)}${guests}`, items });
  }
  drive(id, t) {
    const save = this.box.save, D = this.D;
    advance(save, t.hours);
    save.fuel = Math.max(0, Math.round((save.fuel - t.fuel) * 10) / 10);
    save.food = Math.max(0, Math.round((save.food - t.food) * 10) / 10);
    // guests without a bed wait where they are; whoever waits at the new place comes back aboard
    const P = passengers(D, save), from = save.location;
    save.waiting ||= {};
    if (P.staying.length) { save.waiting[from] = [...new Set([...(save.waiting[from] || []), ...P.staying])]; save.companions = save.companions.filter(c => !P.staying.includes(c)); }
    const back = save.waiting[id] || [];
    if (back.length) { save.companions = [...new Set([...save.companions, ...back])]; delete save.waiting[id]; }
    save.location = id;
    const left = P.staying.map(c => D.companions?.[c]?.name || c), met = back.map(c => D.companions?.[c]?.name || c);
    this.scene.goCamp({ banner: [`Angekommen: ${D.locations?.[id]?.name || id}`, [`${clockText(save)} · ${t.km} km · −${de(t.fuel)} l Sprit`, left.length ? `${left.join(', ')} wartet bei ${D.locations?.[from]?.name || from}` : '', met.length ? `${met.join(', ')} steigt wieder ein` : ''].filter(Boolean).join(' · ')], fade: 900, arriving: true });
  }

  // ---------- loop ----------
  update(time, dt, input) {
    const s = this.scene, l = s.leyla, range = this.C.interactRange ?? 130;
    // the fire's light breathes and flickers
    if (this.fireLights && this.lightK > 0) {
      const t = time / 1000, fl = (this.C.fire?.flicker ?? 25) / 100;
      const wob = 1 - fl * (0.5 + 0.5 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1)) - fl * 0.3 * Math.random();
      for (const l of this.fireLights) l.setAlpha(l.base * this.lightK * wob);
    }
    // flames from code (without a look)
    if (this.flame) {
      const x = this.geo.fireX, y = this.ground - 18, f = this.flame.clear(), t = time / 1000;
      // three tongues of pixel flame: rows of 6 px getting narrower, swaying; red outside, yellow core
      for (const [dx, base, ph] of [[-16, 58, 0], [14, 50, 2.1], [0, 78, 4.3]]) {
        const hgt = base * (0.8 + 0.2 * Math.sin(t * 6 + ph) + 0.08 * Math.sin(t * 17 + ph)), rows = Math.max(3, Math.round(hgt / 6));
        for (let i = 0; i < rows; i++) {
          const k = 1 - i / rows, w = Math.max(6, Math.round(34 * Math.sqrt(k) / 6) * 6), sway = Math.round(Math.sin(t * 5 + ph + i * 0.5) * (i / rows) * 8 / 3) * 3;
          const cx = x + dx + sway, yy = y - i * 6;
          f.fillStyle(0xd8341a, 0.95).fillRect(cx - w / 2, yy - 6, w, 6);
          if (w > 12) f.fillStyle(0xff8a2a).fillRect(cx - w / 2 + 6, yy - 6, w - 12, 6);
          if (w > 24 && i < rows * 0.6) f.fillStyle(0xffe08a).fillRect(cx - w / 2 + 12, yy - 6, w - 24, 6);
        }
      }
      for (let i = 0; i < 4; i++) {   // sparks
        const life = (t * 0.7 + i * 0.27) % 1;
        f.fillStyle(0xffd27a, 1 - life).fillRect(Math.round(x + Math.sin(i * 9 + t * 2) * 24 + life * 10), Math.round(y - 60 - life * 140), 4, 4);
      }
    }
    // light out of the van door: as far as the door is open
    if (this.doorLights) {
      const v = s.van, open = v && v.frames > 1 ? v.frame / (v.frames - 1) : 0;
      for (const d of this.doorLights) d.setAlpha(d.base * this.lightK * open).setVisible(this.lightK > 0 && open > 0.02);
    }
    this.lid(dt);
    this.updateSound(time);
    // the van's door: the workshop behind it shows only while the door is fully open
    if (this.vanDoor) {
      const v = this.scene.van, open = v && Math.round(v.frame) === v.frames - 1 && !this.scene.hud.build?.active;
      const a = Math.max(0, Math.min(1, this.vanDoor.view.alpha + (open ? 1 : -1) * dt / 180));
      this.vanDoor.view.setAlpha(a).setVisible(a > 0);
      this.vanDoor.bench.shut = a < 0.99;
    }
    this.benches?.update(time, dt);
    this.updateShells(dt);
    // companions: random speech bubbles
    const B = this.C.companions?.barkEvery || [7, 15];
    if (time > this.barkAt && this.companions.length) {
      this.bark(this.companions[Math.floor(Math.random() * this.companions.length)]);
      this.barkAt = time + (B[0] + Math.random() * (B[1] - B[0])) * 1000;
    }
    for (const c of this.companions) {
      if (c.until && time > c.until) { c.bubble.setAlpha(Math.max(0, c.bubble.alpha - dt / 300)); if (c.bubble.alpha <= 0) c.until = 0; }
      c.sprite.setFlipX(l.x < c.x);
    }
    // nearest hotspot within reach (on the ground); not while building (Leyla works by herself then)
    this.atWorkshop = false;
    if (s.hud.build?.active) { if (this.promptText) { this.prompt = null; this.promptText = null; s.hud.prompt(null); } return; }
    if (l.state === 'sit') {   // sitting: only standing up (E or a direction, handled by Leyla)
      const text = l.sit?.up ? null : 'Aufstehen · Lagerfeuer';
      if (text !== this.promptText) { this.prompt = null; this.promptText = text; s.hud.prompt(text); }
      return;
    }
    let best = null, bd = Infinity;
    if (l.alive && l.body.blocked.down)
      for (const h of this.hotspots) {
        // up in a stacked container only its spots, on the ground (or in a trailer) only the ones down there
        // a workshop counts only on its own floor (Daniel 09.11.2026: work mode and "E · …" only on the same level as the bench,
        // a container on its chassis stands 164 px above the street), everything else by level as before
        if (h.floor != null) { if (Math.abs(l.feet - h.floor) > (this.C.rig?.sameFloor ?? 40)) continue; }
        else if (h.top != null ? Math.abs(l.feet - h.top) > 50 : l.feet < this.ground - (this.C.rig?.reachUp ?? 240)) continue;
        const d = Math.abs(l.x - h.x); if (d <= Math.max(h.w || 0, range) && d < bd) { best = h; bd = d; }
      }
    this.atWorkshop = !!(best?.ws && Math.abs(l.body.velocity.x) < 5);
    const hint = h => typeof h.hint === 'function' ? h.hint() : h.hint;
    // nothing to use here, but something lies on the ground: E picks it up (Boden-Leiste, floor_strip.js)
    const floor = !best && l.alive && !s.hud.inv?.isOpen ? s.hud.floor?.prompt() : null;
    const text = best ? `${hint(best)} · ${best.name}` : floor;
    if (best !== this.prompt || text !== this.promptText) { this.prompt = best; this.promptText = text; s.hud.prompt(text); }
    if (best && input.grab.pressed) best.act();
    else if (floor && input.grab.pressed) s.hud.floor.pick(s);
  }

  state() {
    const sv = this.box.save;
    return { clock: clockText(sv), day: sv.day, hour: sv.hour, daytime: this.day.name, location: sv.location, deltas: sv.deltas, fuel: sv.fuel, food: sv.food, health: sv.health, buffs: [...sv.buffs],
      prompt: this.promptText || null, hotspots: this.hotspots.map(h => ({ name: h.name, hint: typeof h.hint === 'function' ? h.hint() : h.hint, x: Math.round(h.x), floor: h.floor ?? null })),
      chest: this.chest && { open: this.chest.open, frame: Math.round(this.chest.frame) },
      sound: { wind: !!this.wind, fire: this.fireVolume != null ? Math.round(this.fireVolume * 100) : null, muted: this.scene.sound.mute },
      benches: this.benches?.state() || [], resting: this.resting || null,
      shells: (this.shells || []).map(c => ({ unit: c.u.ui, id: c.u.id, closed: Math.round(c.a * 100) / 100, x0: Math.round(c.u.x0), x1: Math.round(c.u.x1) })), rigOpen: !!this.scene.hud.rigOpen,
      yard: (this.yardItems || []).map(y => ({ kind: y.kind, id: y.id, x: Math.round(y.x), y0: Math.round(y.y0) })),
      rig: this.geo.units.map(u => ({ id: u.id, x0: u.x0, x1: u.x1, workshops: u.workshops.map(w => w.id) })), van: this.geo.tractor?.workshops.map(w => w.id) };
  }
}

const VERB = { sleep: 'Schlafen', warroom: 'Planen', kitchen: 'Kochen', foodtruck: 'Verkaufen', craft: 'Herstellen', storage: 'Lager', cooling: 'Kühlraum', chill: 'Chillen', drone: 'Drohne', engine: 'Motor', power: 'Energie', cell: 'Zelle', guests: 'Gäste', treasury: 'Schatzkammer', tank: 'Nach AvA sehen' };
const SOON = { foodtruck: 'Verkaufen kommt später.', power: 'Liefert Energie für die Werkstätten im Rig.',
  storage: 'Das Lager füllt sich mit Schritt 2 (Beute & Rucksack).', cooling: 'Das Lager füllt sich mit Schritt 2 (Beute & Rucksack).', chill: 'Chillen gibt bald einen Buff.' };

// distance, hours, fuel and food for driving from the current place to a location
export function travelCost(D, save, to) {
  const a = D.locations?.[save.location]?.position || [0, 0], b = D.locations?.[to]?.position || [0, 0], Tr = D.travel || {};
  const km = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]));
  const tons = save.rig.units.filter(u => u.kind === 'container').reduce((n, u) => n + (D.containers?.[u.id]?.weight || 0), 0) / 1000;
  const fuelUse = D.tractors?.[save.rig.tractor]?.fuelUse ?? 12;
  const hours = Math.max(0.25, Math.round(km / (Tr.speed || 40) * 4) / 4);
  const fuel = Math.round(km * fuelUse / 100 * (1 + (Tr.weightFuelFactor ?? 0) / 100 * tons) * 10) / 10;
  const food = Math.round(hours / (Tr.dayLength || 24) * (Tr.foodPerDay ?? 1) * (1 + (save.companions?.length || 0)) * 10) / 10;
  return { km, hours, fuel, food };
}

// The camp before and after a run (area "Camp"): a flat campsite with Leyla's van, the rig behind it as a cutaway
// (dollhouse: every container shows its workshops), a campfire, companions with speech bubbles and day/night.
// Leyla walks around and uses things with E. Time only moves on actions (sleeping, sitting at the fire, driving, runs).
// Graphics are code placeholders for now; a "look" on containers, workshops or companions takes over later.
import { clockText, advance, hoursUntil, containers } from '../save.js';

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

// geometry of the camp in tiles and pixels: margin | containers (farthest first) | van | campsite
export function campLayout(D, save, T = 64) {
  const C = D.camp || {}, pw = C.rig?.placeWidth ?? 4, gap = C.rig?.gap ?? 1, margin = C.margin ?? 6, H = Math.max(8, C.height ?? 14);
  const vanA = D.assets?.[D.tractors?.[save.rig.tractor]?.look] || D.assets?.[D.game?.spawn?.look];
  const k = vanA?.frameSize ? (vanA.height || vanA.frameSize[1]) / vanA.frameSize[1] : 1;
  const vanLeft = vanA?.frameSize ? (vanA.origin?.[0] ?? vanA.frameSize[0] / 2) * k : 5 * T, vanRight = vanA?.frameSize ? vanA.frameSize[0] * k - vanLeft : 5 * T;
  let x = margin * T;
  const units = [];
  for (const u of [...save.rig.units].reverse()) {
    if (u.kind === 'tractor') continue;
    const def = D.containers?.[u.id] || {}, places = def.places || 1, A = D.assets?.[def.look];
    if (A?.frameSize && def.inside?.x && def.inside?.y) {
      // a picture with an open side (Container › Aussehen + Innenraum): the workshops sit in its interior
      const [fw, fh] = A.frameSize, k = (A.height || fh) / fh, [ox, oy] = A.origin || [fw / 2, fh], flip = !!A.flip !== !!def.flip, w = fw * k;
      const ix = v => flip ? fw - v : v, a = ix(def.inside.x[0]), b = ix(def.inside.x[1]), in0 = x + Math.min(a, b) * k, in1 = x + Math.max(a, b) * k;
      const ground = (H - 2) * T;
      units.push({ ...u, def, x0: x, x1: x + w, places, cell: (in1 - in0) / places, in0, inTop: ground - (oy - def.inside.y[0]) * k, floorY: ground - (oy - def.inside.y[1]) * k,
        sprite: { key: def.look, k, flip, ox: (flip ? fw - ox : ox) / fw, oy: oy / fh, cx: x + (flip ? fw - ox : ox) * k } });
      x += w;
    } else {
      const w = places * pw * T;
      units.push({ ...u, def, x0: x, x1: x + w, places, cell: pw * T, in0: x });
      x += w + gap * T;
    }
  }
  const vanCol = Math.ceil((x + vanLeft) / T - 0.5), doorX = (vanCol + 0.5) * T;
  const tractor = save.rig.units.find(u => u.kind === 'tractor');
  const W = vanCol + Math.max(8, C.campWidth ?? 20) + 1, floor = H - 2;
  // shaft on the left: a hole in the ground, closed off by an invisible wall above it (it cannot be entered)
  const S = C.shaft || {}, shaft = S.enabled === false ? null : { from: Math.max(1, S.at ?? 1), to: Math.max(1, S.at ?? 1) + Math.max(1, S.width ?? 3) - 1 };
  const blocked = x => x === 0 || x === W - 1 || (shaft && x <= shaft.to);
  const layout = Array.from({ length: H }, (_, y) => {
    let row = '';
    for (let x = 0; x < W; x++) row += y >= floor ? (shaft && x >= shaft.from && x <= shaft.to ? '.' : '#') : blocked(x) ? '#' : x === vanCol && y === floor - 1 ? 'L' : '.';
    return row;
  });
  return { layout, W, H, floor, vanCol, shaft, hidden: (x, y) => y < floor && blocked(x), doorX, vanLeft: doorX - vanLeft, vanRight: doorX + vanRight, units, tractor, fireX: (vanCol + (C.fire?.at ?? 9) + 0.5) * T,
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

export class Camp {
  constructor(scene, box, geo) {
    this.scene = scene; this.box = box; this.geo = geo;
    const D = scene.data_, C = D.camp || {}, T = scene.T, s = box.save;
    this.D = D; this.C = C;
    this.ground = geo.floor * T;
    this.day = daytimeAt(C, s.hour);
    this.hotspots = [];
    this.lights = [];
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
    // night over the world, lights shine through it
    const shade = (this.day.shade ?? 0) / 100;
    this.night = scene.add.rectangle(0, 0, geo.W * T, geo.H * T, 0x0a0820, shade).setOrigin(0).setDepth(30);
    this.lightK = (this.day.light ?? Math.min(100, shade * 200)) / 100;   // how strongly fire and windows shine (Tag & Nacht › Licht)
    for (const l of this.lights) l.setAlpha(l.base * this.lightK).setVisible(this.lightK > 0);
    this.prompt = null; this.barkAt = scene.time.now + 2500;
  }

  // ---------- the rig as a dollhouse ----------
  drawRig() {
    const s = this.scene, D = this.D, R = this.C.rig || {}, T = s.T, y = this.ground, h = R.height ?? 248;
    const g = s.make.graphics({}, false), wall = col(R.wall || '#4a4f5a'), inside = col(R.inside || '#2b2233');
    const x1 = this.geo.vanLeft;
    for (const u of this.geo.units) {
      if (u.sprite) { this.drawPictureUnit(g, u, R); continue; }
      const top = y - h, kind = u.def.kind;
      // shell: back wall (inside), roof, end walls, floor, wheels
      g.fillStyle(inside).fillRect(u.x0, top, u.x1 - u.x0, h);
      g.fillStyle(shadeOf(R.inside || '#2b2233', 1.25)); for (let yy = top + 30; yy < y - 10; yy += 34) g.fillRect(u.x0 + 12, yy, u.x1 - u.x0 - 24, 2);   // planks
      g.fillStyle(wall).fillRect(u.x0 - 12, top - 22, u.x1 - u.x0 + 24, 22).fillRect(u.x0 - 12, top, 12, h).fillRect(u.x1, top, 12, h);
      if (kind === 'trailer') g.fillStyle(shadeOf(R.wall || '#4a4f5a', 1.3)).fillRect(u.x0 - 4, top - 30, u.x1 - u.x0 + 8, 8);   // rounded roof
      if (kind === 'shipping') { g.fillStyle(shadeOf(R.wall || '#4a4f5a', 0.8)); for (let xx = u.x0 - 8; xx < u.x1 + 8; xx += 16) g.fillRect(xx, top - 20, 6, 18); }
      if (kind === 'crate') { g.fillStyle(0x7a5a3a).fillRect(u.x0 - 12, top - 22, u.x1 - u.x0 + 24, 22).fillRect(u.x0 - 12, top, 12, h).fillRect(u.x1, top, 12, h); }
      g.fillStyle(0x1b1d22).fillRect(u.x0 - 12, y - 8, u.x1 - u.x0 + 24, 8);
      for (const wx of [u.x0 + 40, u.x1 - 40]) { g.fillStyle(0x15161a).fillCircle(wx, y + 6, 30); g.fillStyle(0x4a4f5a).fillCircle(wx, y + 6, 12); }
      // cells: thin walls between the places, workshops inside
      for (let i = 1; i < u.places; i++) g.fillStyle(wall).fillRect(u.x0 + i * u.cell - 3, top, 6, h - 120);
      for (const w of u.workshops) {
        const def = D.workshops?.[w.id] || {}, cx = u.x0 + w.at * u.cell, cw = (def.places || 1) * u.cell;
        furniture(g, def.function, cx, y - 8, cw, h - 8, R.light || '#ffcf7a');
        // window with warm light at night
        g.fillStyle(0x0d0a12).fillRect(cx + cw / 2 - 26, top + 22, 52, 34).fillStyle(col(R.light || '#ffcf7a')).fillRect(cx + cw / 2 - 22, top + 26, 44, 26);
        this.light(cx + cw / 2, top + 40, 220, R.light || '#ffcf7a', 0.5);
        this.workshopHotspot(u, w, def, cx, cw, top - 60);
      }
      // empty places
      for (let i = 0; i < u.places; i++) if (!u.workshops.some(w => i >= w.at && i < w.at + (D.workshops?.[w.id]?.places || 1)))
        g.fillStyle(0x5b5266, 0.5).fillRect(u.x0 + i * u.cell + u.cell / 2 - 30, y - 40, 60, 4);
    }
    // tow bar to the van (pictures bring their own)
    if (this.geo.units.length && !this.geo.units[this.geo.units.length - 1].sprite) { const last = this.geo.units[this.geo.units.length - 1]; g.fillStyle(0x30363d).fillRect(last.x1 + 12, y - 34, x1 - last.x1 + 20, 8); }
    if (this.geo.units.length) {
      const key = 'camp_rig';
      if (s.textures.exists(key)) s.textures.remove(key);
      g.generateTexture(key, Math.ceil(x1 + 40), Math.ceil(y + 40));
      s.add.image(0, 0, key).setOrigin(0).setDepth(-21);
    }
    g.destroy();
  }

  // a container with a picture (e.g. Daniel's trailer with the side folded open): picture behind, furniture in its interior,
  // the interior floor is a platform (jump in), workshops are used with E from the ground or from inside
  drawPictureUnit(g, u, R) {
    const s = this.scene, D = this.D, S = u.sprite;
    if (!s.textures.exists(S.key)) return;
    s.textures.get(S.key).setFilter(NEAREST());
    s.add.image(S.cx, this.ground, S.key, 0).setOrigin(S.ox, S.oy).setScale(S.k).setFlipX(S.flip).setDepth(-22);
    const top = u.inTop, floor = u.floorY, h = floor - top;
    for (const w of u.workshops) {
      const def = D.workshops?.[w.id] || {}, cx = u.in0 + w.at * u.cell, cw = (def.places || 1) * u.cell;
      furniture(g, def.function, cx, floor, cw, h, R.light || '#ffcf7a');
      this.light(cx + cw / 2, top + h * 0.35, 200, R.light || '#ffcf7a', 0.45);
      this.workshopHotspot(u, w, def, cx, cw, top + 8);
    }
    const z = s.add.zone((u.in0 + u.in0 + u.cell * u.places) / 2, floor + 8, u.cell * u.places, 16);
    s.platforms.add(z);
    Object.assign(z.body.checkCollision, { down: false, left: false, right: false });
  }
  workshopHotspot(u, w, def, cx, cw, labelY) {
    const R = this.C.rig || {}, units = this.box.save.rig.units;
    const store = def.grid && `store:${units.indexOf(units.find(x => x.id === u.id && x.workshops.includes(w)))}:${w.at}`;
    this.hotspots.push({ x: cx + cw / 2, w: cw / 2, name: def.name || w.id, hint: store ? 'Öffnen' : VERB[def.function] || 'Ansehen', ws: w.id, act: () => store ? this.scene.openContainer(store) : this.use(w.id) });
    if (R.labels !== false) this.scene.add.text(cx + cw / 2, labelY, def.name || w.id, { fontFamily: 'VT323, monospace', fontSize: '24px', color: '#ffd27a', stroke: '#0d0a12', strokeThickness: 5 }).setOrigin(0.5, 0).setDepth(-14);
  }

  light(x, y, r, color, base, h = r) {
    const l = this.scene.add.image(x, y, glowTexture(this.scene)).setDisplaySize(r * 2, h * 2).setTint(col(color)).setBlendMode(Phaser.BlendModes.ADD).setDepth(31);
    l.base = base; this.lights.push(l);
    return l;
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
  use(id) {
    const def = this.D.workshops?.[id] || {}, s = this.scene;
    if (def.function === 'sleep') return this.sleep(def);
    if (def.function === 'warroom') return this.warroom();
    if (['kitchen', 'craft'].includes(def.function)) { s.hud.inv?.close(); return s.hud.craft?.open(id); }
    const who = (this.box.save.companions || []).map(c => this.D.companions?.[c]).filter(c => c?.workshops?.includes(id)).map(c => c.name);
    s.hud.menu({ title: def.name || id, sub: [def.description, who.length ? `Betreut von ${who.join(' und ')}.` : null, SOON[def.function] || 'Funktion kommt später.'].filter(Boolean).join(' '),
      items: [{ label: 'Zurück', act: () => {} }] });
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
        disabled: t.fuel > save.fuel ? 'Zu wenig Sprit' : null, act: () => this.drive(id, t) });
    }
    items.push({ label: 'Zurück', act: () => {} });
    s.hud.menu({ title: 'Warroom', sub: `Du bist bei ${here?.name || '–'}. Sprit ${de(save.fuel)} l · Vorräte ${de(save.food)}`, items });
  }
  drive(id, t) {
    const save = this.box.save, D = this.D;
    advance(save, t.hours);
    save.fuel = Math.max(0, Math.round((save.fuel - t.fuel) * 10) / 10);
    save.food = Math.max(0, Math.round((save.food - t.food) * 10) / 10);
    save.location = id;
    this.scene.goCamp({ banner: [`Angekommen: ${D.locations?.[id]?.name || id}`, `${clockText(save)} · ${t.km} km · −${de(t.fuel)} l Sprit`], fade: 900, arriving: true });
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
    // chest lid: open while its inventory is open
    const c = this.chest;
    if (c) {
      c.open = !!(s.hud.inv?.isOpen && s.hud.inv.other?.key === 'chest');
      const target = c.open ? c.frames - 1 : 0;
      if (c.frame !== target) c.frame = c.frame < target ? Math.min(target, c.frame + c.fps * dt / 1000) : Math.max(target, c.frame - c.fps * dt / 1000);
      c.sprite.setFrame(Math.round(c.frame));
    }
    this.updateSound(time);
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
    // nearest hotspot within reach (on the ground)
    this.atWorkshop = false;
    if (l.state === 'sit') {   // sitting: only standing up (E or a direction, handled by Leyla)
      const text = l.sit?.up ? null : 'Aufstehen · Lagerfeuer';
      if (text !== this.promptText) { this.prompt = null; this.promptText = text; s.hud.prompt(text); }
      return;
    }
    let best = null, bd = Infinity;
    if (l.alive && l.body.blocked.down)
      for (const h of this.hotspots) { const d = Math.abs(l.x - h.x); if (d <= Math.max(h.w || 0, range) && d < bd) { best = h; bd = d; } }
    this.atWorkshop = !!(best?.ws && Math.abs(l.body.velocity.x) < 5);
    const hint = h => typeof h.hint === 'function' ? h.hint() : h.hint;
    const text = best && `${hint(best)} · ${best.name}`;
    if (best !== this.prompt || text !== this.promptText) { this.prompt = best; this.promptText = text; s.hud.prompt(text); }
    if (best && input.grab.pressed) best.act();
  }

  state() {
    const sv = this.box.save;
    return { clock: clockText(sv), day: sv.day, hour: sv.hour, daytime: this.day.name, location: sv.location, deltas: sv.deltas, fuel: sv.fuel, food: sv.food, health: sv.health, buffs: [...sv.buffs],
      prompt: this.promptText || null, hotspots: this.hotspots.map(h => ({ name: h.name, hint: typeof h.hint === 'function' ? h.hint() : h.hint, x: Math.round(h.x) })),
      chest: this.chest && { open: this.chest.open, frame: Math.round(this.chest.frame) },
      sound: { wind: !!this.wind, fire: this.fireVolume != null ? Math.round(this.fireVolume * 100) : null, muted: this.scene.sound.mute },
      rig: this.geo.units.map(u => ({ id: u.id, x0: u.x0, x1: u.x1, workshops: u.workshops.map(w => w.id) })), van: this.geo.tractor?.workshops.map(w => w.id) };
  }
}

const VERB = { sleep: 'Schlafen', warroom: 'Planen', kitchen: 'Kochen', foodtruck: 'Verkaufen', craft: 'Herstellen', storage: 'Lager', cooling: 'Kühlraum', chill: 'Chillen', drone: 'Drohne', engine: 'Motor', power: 'Energie', cell: 'Zelle' };
const SOON = { foodtruck: 'Verkaufen kommt später.',
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

// The camp before and after a run (area "Camp"): a flat campsite with Leyla's van, the rig behind it as a cutaway
// (dollhouse: every container shows its workshops), a campfire, companions with speech bubbles and day/night.
// Leyla walks around and uses things with E. Time only moves on actions (sleeping, sitting at the fire, driving, runs).
// Graphics are code placeholders for now; a "look" on containers, workshops or companions takes over later.
import { ensureMap, placeOf, roadKm, route, hops, mapConfig } from '../worldmap.js';
import { rollEncounter, choose, blocked } from '../travel.js';
import { powerBoost } from '../stations.js';
import { clockHours } from '../tank.js';
import { potsOf, stage, ripe, harvest, STAGES, canWater, waterOf, water } from '../garden.js';
import { level as cisternLevel, tap as cisternTap } from '../cistern.js';
import { anchors as lightAnchors, catenary, lightsConfig, mastAt } from '../string_lights.js';
import { clockText, advance, hoursUntil, solarState, storeKeyOf, CAMP } from '../save.js';
import { budgets, partSlots, passengers, roofFree, containerPlaces, containerWeight } from '../rig.js';
import { parallaxLayers, setFor } from './parallax.js';
import { occupancy } from '../inventory.js';
import { offers, accept, claim, progressOf, qstate } from '../quests.js';
import { Benches, benchTexture, crateTexture } from './benches.js';
import { wreckHere } from './camp_salvage.js';
import { campMegaLayout } from './camp_mega.js';
import { ladderArt } from './ladder_art.js';
import { activeMega, flies, travelSpeed } from '../mega.js';
import { balconies } from '../decor.js';
import { synergyAt, synergyText, links } from '../synergy.js';
import { titleOf, upgradeOf } from '../upgrades.js';
import { syncWorkers } from '../workers.js';
import { mod } from '../mods.js';

export const de = n => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 1 });
const NEAREST = () => Phaser.Textures.FilterMode.NEAREST;
const LABEL_ALPHA = 0.8;
let wireSeq = 0;
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


// #113 Container ziehen + höher (Daniel 19.11.2026: „die Container könnten größer sein, sie erscheinen mir niedrig“): a container
// „Aus Container-Kacheln“ gets its look for its own length and Camp › Container-Kacheln › Höhe: left end + (n − 1) × place + right
// end from the tile sheet, the wall grows in the middle (the band rows repeat; the ribs are vertical, so no seam). Everything below
// the band moves down by the extra rows: the interior floor, the divider, the bottom of the frame. Workbench pictures keep their size.
export function containerDef(D, u) {
  const base = D.containers?.[u?.id] || {}, n = containerPlaces(D, u) || base.places || 1, K = D.camp?.containers || {}, A0 = D.assets?.[base.look];
  if (!base.tiles || !K.tiles || !D.assets?.[K.tiles] || !A0?.frameSize || !base.inside) return n === base.places ? base : { ...base, places: n };
  const extra = Math.max(0, Math.round((K.inner ?? 160) * ((K.height ?? 100) - 100) / 100)), top = K.top ?? 153, cut = top + (K.band?.[1] ?? 96);
  const sh = y => (y >= cut ? y + extra : y), [L, R] = K.ends || [81, 241], step = K.step ?? 190, w = L + R + step * (n - 1), H = (K.frame ?? 512) + extra;
  const color = /^#[0-9a-f]{6}$/i.test(u?.color || '') ? u.color.toLowerCase() : null;   // #114 painted
  const k = (A0.height || A0.frameSize[1]) / A0.frameSize[1], oy = sh(A0.origin?.[1] ?? 372), key = kind => `ctiles_${kind}_${n}_${extra}${color ? '_' + color.slice(1) : ''}`;
  for (const kind of ['open', 'closed']) D.assets[key(kind)] ??= { kind: 'animation', frameSize: [w, H], frames: 1, origin: [w / 2, oy], height: k * H, virtual: { kind, n, extra, color } };
  const x0 = base.inside.x[0], dv = base.divider;
  return { ...base, places: n, weight: containerWeight(D, u), look: key('open'), lookClosed: key('closed'),
    inside: { x: [x0, x0 + step * n], y: base.inside.y.map(sh) }, deck: base.deck != null ? sh(base.deck) : base.deck,
    divider: dv && { ...dv, y: dv.y?.map(sh), foot: dv.foot != null ? sh(dv.foot) : dv.foot, back: dv.back != null ? sh(dv.back) : dv.back } };
}
// the texture of such a look (made once per length and height from Camp › Container-Kacheln)
export function containerTexture(scene, D, key) {
  const A = D.assets?.[key], V = A?.virtual, K = D.camp?.containers || {};
  if (!V || scene.textures.exists(key)) return scene.textures.exists(key);
  if (!scene.textures.exists(K.tiles)) return false;
  const src = scene.textures.get(K.tiles).getSourceImage(), [L, R] = K.ends || [81, 241], step = K.step ?? 190, rows = K.rows ?? 228, top = K.top ?? 153;
  const [b0, b1] = K.band || [84, 96], [w, H] = A.frameSize, sy = V.kind === 'closed' ? rows + 4 : 0;
  const tex = scene.textures.createCanvas(key, w, H), ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  // one horizontal strip of tile rows [r0, r1) drawn at frame row y: left end, the places, right end
  const strip = (r0, r1, y) => {
    const h = r1 - r0; if (h <= 0) return;
    ctx.drawImage(src, 0, sy + r0, L, h, 0, y, L, h);
    for (let i = 0; i < V.n - 1; i++) ctx.drawImage(src, L + 4, sy + r0, step, h, L + i * step, y, step, h);
    ctx.drawImage(src, L + step + 8, sy + r0, R, h, L + (V.n - 1) * step, y, R, h);
  };
  strip(0, b1, top);
  for (let e = 0; e < V.extra; e += b1 - b0) { const h = Math.min(b1 - b0, V.extra - e); strip(b0, b0 + h, top + b1 + e); }
  strip(b1, rows, top + b1 + V.extra);
  if (V.color) paintPixels(ctx, w, H, V.color, D.camp?.paint);
  tex.refresh(); tex.setFilter(NEAREST());
  return true;
}
// #114 Farbe wie Townscaper: the steel takes the colour, keeping its light and shade; saturated bits (hazard stripes, rust, signs)
// and the darkest outline stay as painted. Camp › Farben › Sättigung bis / Deckkraft
export function paintPixels(ctx, w, h, hex, P = {}) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data, n = parseInt(hex.slice(1), 16), tr = (n >> 16) & 255, tg = (n >> 8) & 255, tb = n & 255;
  const tl = 0.3 * tr + 0.59 * tg + 0.11 * tb || 1, satMax = (P.keepSat ?? 32) / 100, mix = (P.strength ?? 85) / 100;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = 0.3 * r + 0.59 * g + 0.11 * b;
    const sat = mx ? (mx - mn) / mx : 0;
    if (sat > satMax || l < 22) continue;   // stripes, rust, signs, the outline
    const k = Math.min(2.2, l / tl * 1.15);
    d[i] = Math.round(r * (1 - mix) + Math.min(255, tr * k) * mix); d[i + 1] = Math.round(g * (1 - mix) + Math.min(255, tg * k) * mix); d[i + 2] = Math.round(b * (1 - mix) + Math.min(255, tb * k) * mix);
  }
  ctx.putImageData(img, 0, 0);
}
// all lengths of the pullable containers, so the rig, the scrapyard and build mode can draw them
export function ensureContainerLooks(scene, D) {
  for (const [id, c] of Object.entries(D.containers || {})) {
    if (!c.tiles) continue;
    const r = c.resize || [c.places || 1, c.places || 1];
    for (let n = r[0]; n <= r[1]; n++) { const d = containerDef(D, { id, places: n }); for (const k of [d.look, d.lookClosed]) if (k) containerTexture(scene, D, k); }
  }
  for (const u of scene.box?.save?.rig?.units || []) if (u.color && D.containers?.[u.id]?.tiles) { const d = containerDef(D, u); for (const k of [d.look, d.lookClosed]) if (k) containerTexture(scene, D, k); }   // #114 painted
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
    const def = containerDef(D, u);   // #113 own length and height
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
  if (activeMega(D, save)) return campMegaLayout(D, save, T);   // #029: camp aboard the crawler / fatbird
  const C = D.camp || {}, gap = (C.rig?.gap ?? 1) * T, margin = C.margin ?? 6;
  let H = Math.max(8, C.height ?? 14);
  const vanA = D.assets?.[D.tractors?.[save.rig.tractor]?.look] || D.assets?.[D.game?.spawn?.look];
  const k = vanA?.frameSize ? (vanA.height || vanA.frameSize[1]) / vanA.frameSize[1] : 1;
  const vanLeft = vanA?.frameSize ? (vanA.origin?.[0] ?? vanA.frameSize[0] / 2) * k : 5 * T, vanRight = vanA?.frameSize ? vanA.frameSize[0] * k - vanLeft : 5 * T;
  const Y = C.yard || {}, yardW = Y.enabled === false ? 0 : Math.max(4, Y.width ?? 9) * T;
  const longest = Math.max(T * 4, ...Object.entries(D.containers || {}).map(([id, c]) => unitWidth(D, c.resize ? containerDef(D, { id, places: c.resize[1] }) : c, T)));   // #113 pulled to full length
  const pull = Math.max(1, D.tractors?.[save.rig.tractor]?.length ?? 1);
  const rigRoom = pull * longest + (pull - 1) * gap;
  const rearRoom = (C.decor?.rear ?? 8) * T;   // #117 room for decoration behind the rig, even at its full length: the camp is longer
  const vanCol = Math.ceil((margin * T + yardW + rearRoom + rigRoom + vanLeft) / T - 0.5), doorX = (vanCol + 0.5) * T;
  // salvage (#023): a wreck found here stands at the end of the camp, the camp grows by its width
  const wr = wreckHere(D, save), campW = Math.max(8, C.campWidth ?? 20);
  // a tractor wider than the van (the LKW) pushes the campsite to the right by the difference
  const wide = Math.max(0, Math.round((vanRight - 5 * T) / T)), campCol = vanCol + wide;   // the van: 0
  const W = campCol + campW + (wr ? wr.width + 2 : 0) + 1;
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
    rigRoom: [doorX - vanLeft - rigRoom, doorX - vanLeft], fireX: (campCol + (C.fire?.at ?? 9) + 0.5) * T, campCol,
    companionX: [(campCol + (C.companions?.at?.[0] ?? 6) + 0.5) * T, (campCol + (C.companions?.at?.[1] ?? 13) + 0.5) * T],
    wreck: wr ? { id: wr.id, x0: (campCol + campW + 1) * T, x1: (campCol + campW + 1 + wr.width) * T } : null };
}

// background of the camp: weather sky from the Backdrop, a far plain with dunes and a tiny BigCityDelta on the horizon
export function drawCampBackground(scene, C) {
  const W = scene.scale.width, H = scene.scale.height, hy = Math.round(H * (C.horizon ?? 66) / 100), k = 3;
  const E = C.epic || {}, day = daytimeAt(C, scene.box?.save?.hour ?? 20), night = Math.min(1, (day.light ?? Math.min(100, (day.shade ?? 0) * 2)) / 100);
  const r = (s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(31);
  const snap = v => Math.round(v / k) * k;
  const tex = (key, w, h, draw) => { if (scene.textures.exists(key)) scene.textures.remove(key); const t = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h)), ctx = t.getContext(); draw(ctx); t.refresh(); t.setFilter(NEAREST()); return key; };
  const px = (ctx, x, y, c, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(snap(x), snap(y), k, k); };
  // 1 · the Milky Way at night (#009, Daniel: „ein wenig epischer, mehr wie im Intro“): a diagonal band of stars and violet haze
  if (E.milkyWay !== false && night > 0.55) {
    scene.add.image(0, 0, tex('camp_milky', W * 1.1, hy, ctx => {
      const ax = W * 0.05, ay = hy * 0.95, bx = W * 1.05, by = hy * 0.02, len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
      const gauss = () => (r() + r() + r() - 1.5) / 1.5;
      for (let n = 0; n < 1100; n++) { const t = r(), o = gauss() * 120; px(ctx, ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o, ['#3b2f6b', '#793a80', '#285cc4'][n % 3], 0.09); }
      for (let n = 0; n < 650; n++) { const t = r(), o = gauss() * gauss() * 140; px(ctx, ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o, ['#ffffff', '#b9bffb', '#fad6b8', '#a6fcdb'][n % 4], 0.2 + r() * 0.5); }
      ctx.globalAlpha = 1;
    })).setOrigin(0).setScrollFactor(0.01, 0).setDepth(-99.5).setAlpha(night * (E.milkyWay ?? 85) / 100);
  }
  // #115 painted parallax layers (Welt › Parallax-Sets) instead of the ridges and the city from code: Camp › Parallax-Set, else the set
  // of the region the camp stands in (Reisen › Landschaften)
  const D = scene.data_ || {}, save = scene.box?.save, loc = D.locations?.[save?.location] || save?.map?.nodes?.find(n => n.id === save?.location);
  const plx = C.parallax || setFor(D, loc?.region);
  if (plx && D.parallax?.[plx]) parallaxLayers(scene, D, plx, { horizon: hy + k, depth: -98.8, night, worldW: scene.physics?.world?.bounds?.width || W * 4 });
  // 2 · far mountain ranges, two layers of jagged mesas with a lit rim
  // haze: by day the far layers fade into the sky (atmospheric perspective), at night they stand dark
  const haze = (near) => Math.min(1, near + (1 - near) * night);
  const ridge = (key, depth, sf, base, amp, col, rim, seed, near) => {
    const w = W * 1.4, rr = (s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(seed);
    const f = [rr() * 9, rr() * 9, rr() * 9];
    scene.add.image(-W * 0.1, 0, tex(key, w, hy + k, ctx => {
      let mesa = 0, mh = 0;
      for (let x = 0; x < w; x += k) {
        if (mesa <= 0 && rr() < (E.mesas ?? 0)) { mesa = (10 + rr() * 30) * k; mh = amp * (0.7 + rr() * 0.5); }
        let h = base + amp * (0.5 * Math.sin(x / 210 + f[0]) + 0.3 * Math.sin(x / 77 + f[1]) + 0.2 * Math.sin(x / 31 + f[2]));
        if (mesa > 0) { h = Math.max(h, base + mh); mesa -= k; }
        const top = snap(hy - Math.max(k, h));
        ctx.fillStyle = col; ctx.fillRect(x, top, k, hy + k - top);
        ctx.fillStyle = rim; ctx.fillRect(x, top, k, k);
      }
    })).setOrigin(0).setScrollFactor(sf, 0).setDepth(depth).setAlpha(haze(near));
  };
  const coded = !(plx && D.parallax?.[plx]);
  if (coded) ridge('camp_ridge_far', -98.8, 0.015, 70, 80, E.farRidge || '#2c2347', E.farRim || '#45386b', 11, 0.35);
  // 3 · BigCityDelta: bigger, with megatowers, spires and lit windows at night, a neon haze behind it
  const cw = W * 0.42, ch = Math.round(H * (E.cityHeight ?? 22) / 100), cx0 = W * (E.cityAt ?? 0.66);
  if (coded && night > 0.2) for (const [c, sx, a] of [['#e86a73', 1, 0.22], ['#20d6c7', 0.6, 0.14]])
    scene.add.image(cx0 + cw / 2, hy - 30, glowTexture(scene)).setDisplaySize(cw * 1.3 * sx, ch * 0.9).setTint(col(c)).setAlpha(a * night).setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0.03, 0).setDepth(-98.4);
  if (coded) scene.add.image(cx0, hy - ch, tex('camp_city', cw, ch, ctx => {
    const lit = ['#20d6c7', '#e86a73', '#ffd541', '#bc4a9b', '#fef3c0'];
    let x = 0;
    while (x < cw) {
      const mega = r() < 0.08, w = snap((mega ? 6 + r() * 4 : 2 + r() * 5) * k), edge = Math.min(1, x / (cw * 0.25), (cw - x) / (cw * 0.25));
      const h = snap(((mega ? 0.7 + r() * 0.25 : 0.12 + r() * 0.35) * ch) * (0.45 + 0.55 * edge));
      const top = ch - h;
      ctx.globalAlpha = 1; ctx.fillStyle = E.city || '#2a2147'; ctx.fillRect(x, top, w, h);
      ctx.fillStyle = E.cityRim || '#3d3266'; ctx.fillRect(x, top, k, h);   // lit edge
      if (mega) { const sx = x + snap(w / 2); ctx.fillStyle = E.city || '#2a2147'; ctx.fillRect(sx, top - 14 * k, k, 14 * k); ctx.fillRect(sx - k, top - 5 * k, 3 * k, 5 * k); px(ctx, sx, top - 15 * k, '#df3e23', 0.4 + 0.6 * night); }
      if (night > 0.2) for (let yy = top + 2 * k; yy < ch - k; yy += 2 * k) for (let xx = x + k; xx < x + w - k; xx += 2 * k) if (r() < (mega ? 0.22 : 0.14)) px(ctx, xx, yy, lit[Math.floor(r() * lit.length)], night * (0.5 + r() * 0.5));
      if (mega && night > 0.2 && r() < 0.7) { ctx.globalAlpha = 0.85 * night; ctx.fillStyle = lit[Math.floor(r() * 2)]; ctx.fillRect(x + k, top + snap(h * 0.2), w - 2 * k, k); }   // neon band
      x += w + (r() < 0.3 ? k : 0);
    }
    ctx.globalAlpha = 1;
  })).setOrigin(0).setScrollFactor(0.035, 0).setDepth(-98.2).setAlpha(haze(0.5));
  if (coded) ridge('camp_ridge_near', -97.6, 0.05, 6, 16, E.nearRidge || '#1d1626', E.nearRim || '#3a2b3d', 23, 0.8);
  // 4 · the plain: bands getting lighter towards us, dunes
  const g = scene.make.graphics({}, false), far = C.ground?.far || '#6b4a36';
  for (let i = 0; i < 6; i++) g.fillStyle(shadeOf(far, 0.62 + i * 0.09)).fillRect(0, hy + Math.round((H - hy) * Math.pow(i / 6, 1.6) / k) * k, W * 1.5, H);
  for (let d = 0; d < 3; d++) {
    g.fillStyle(shadeOf(far, 0.7 + d * 0.12));
    const y0 = hy + (6 + d * 14) * k, amp = (3 + d * 3) * k, len = 120 + d * 70;
    for (let x = 0; x < W * 1.5; x += k) g.fillRect(x, y0 - Math.round(Math.max(0, Math.sin(x / len + d * 2) * amp) / k) * k, k, H);
  }
  const key = 'camp_far';
  if (scene.textures.exists(key)) scene.textures.remove(key);
  g.generateTexture(key, Math.ceil(W * 1.5), H); g.destroy();
  return scene.add.image(-W * 0.15, 0, key).setOrigin(0).setScrollFactor(0.05, 0).setDepth(-97);
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
  // #117 (Daniel: „das Camp soll nach links und rechts nicht im Nichts enden“): the ground runs on beyond both edges of the world
  const ext = C.edge?.ground ?? 60;
  for (let y = geo.floor; y < geo.H; y++) for (let x = -ext; x < geo.W + ext; x++) {
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
export function figureTexture(scene, key, color, role) {
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

export function glowTexture(scene) {
  if (scene.textures.exists('camp_glow')) return 'camp_glow';
  const t = scene.textures.createCanvas('camp_glow', 256, 256), c = t.getContext(), g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');   // fades to black too: added (ADD) almost-transparent white edges showed as a square (#009)
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
  const key = `part_${id}`, look = D.rigParts?.[id]?.look;
  if (look && scene.textures.exists(look)) { scene.textures.get(look).setFilter(NEAREST()); return look; }   // its picture (e.g. the solar panel, #008)
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
  // solar sockets sit on the container roofs, one per place (#008)
  const roofs = []; for (const u of geo.units || []) if (u.kind !== 'tractor' && u.def?.kind !== 'crate' && roofFree(rig, u.ui)) for (let j = 0; j < (u.places || 0); j++) roofs.push({ cx: u.in0 + u.cell * (j + 0.5), y: u.deckY ?? u.inTop });
  for (const p of all) {
    if (p.slot === 'solar') { const r = roofs[p.i]; if (!r) continue; const w = Math.min(sw, (r.w || sw)), cy = r.y - sh / 2; out.push({ ...p, cx: r.cx, cy, x0: r.cx - w / 2, x1: r.cx + w / 2, y0: cy - sh / 2, y1: cy + sh / 2 }); continue; }
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
    this.campY = geo.campFloor != null ? geo.campFloor * T : this.ground;   // #077 the campsite (fire, board, crew): the ground, or the Hauptcontainer aboard
    this.day = daytimeAt(C, s.hour);
    this.hotspots = [];
    this.lights = [];
    // the rig and the scrapyard; also the budgets (Rig-Bau › Regeln): without power, workshops that need it do not work; too heavy, no driving
    this.drawRig();
    this.drawFire();
    this.vanGlow();
    this.placeCompanions();
    this.placeBoard();
    this.placeWreck();
    this.startSound();
    // the van: E at its door shows the van's own workshops
    const vanWs = geo.tractor?.workshops || [];
    // #056 the van in cross-section: getting in at the driver's door (Zugmaschine › Einsteigen bei), the benches in the bays have their own E spots
    const Dr0 = D.tractors?.[geo.tractor?.id]?.door, inBays = !geo.mega && Dr0?.bays?.length && scene.van, enterX = inBays && Dr0.enter != null ? scene.van.toWorld(Dr0.enter, 0).x : geo.doorX;
    this.hotspots.push({ x: enterX, w: inBays ? 60 : 110, floor: geo.doorFloor ?? undefined, name: geo.mega ? (geo.mega.b.kind === 'airship' ? 'Cockpit' : 'Kommandobrücke') : D.tractors?.[geo.tractor?.id]?.name || 'Van', hint: geo.mega ? 'Karte' : vanWs.length ? 'Einsteigen' : 'Fahrerhaus',
      act: () => this.vanMenu(vanWs) });   // the van's benches stay as shortcuts in the map's header
    // the van's own storage (Kofferraum): E at the rear door
    const T0 = D.tractors?.[geo.tractor?.id] || {};
    if (T0.storage?.[0]) this.storeHotspot(CAMP, geo.vanLeft + (geo.vanRight - geo.vanLeft) * (C.rig?.trunkAt ?? 12) / 100, T0.storageName || 'Kofferraum', false);   // #041: opens the Camp-Lager
    // #117 below the ground the darkness of the POIs (Daniel: „nach unten kommt die Dunkelheit aus den POIs“), with an easter egg
    this.drawDeep(geo, T);
    // night over the world, lights shine through it
    const shade = (this.day.shade ?? 0) / 100;
    this.night = scene.add.rectangle(-4000, -4000, geo.W * T + 8000, geo.H * T + 8000, 0x0a0820, shade).setOrigin(0).setDepth(30);
    this.lightK = (this.day.light ?? Math.min(100, shade * 200)) / 100;   // how strongly fire and windows shine (Tag & Nacht › Licht)
    for (const l of this.lights) l.setAlpha(l.base * this.lightK).setVisible(this.lightK > 0);
    this.setMood();
    this.prompt = null; this.barkAt = scene.time.now + 2500;
  }

  // under the camp: earth fading into black within a few tiles (Camp › Rand: Dunkelheit), a few stones and roots, and far down, barely
  // visible, a forgotten bunker room (Daniel: „ein witziges Easter Egg, das der Spieler sieht, das aber niemals eine Rolle spielt“)
  drawDeep(geo, T) {
    const s = this.scene, E = this.C.edge || {}, ext = (E.ground ?? 60) * T, x0 = -ext - 4000, w = geo.W * T + 2 * ext + 8000, top = geo.H * T, fade = E.fade ?? 520;
    const key = 'camp_deep';
    if (!s.textures.exists(key)) {
      const t = s.textures.createCanvas(key, 4, 256), ctx = t.getContext(), g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, this.C.ground?.color || '#4a3628'); g.addColorStop(0.35, '#1d1418'); g.addColorStop(1, '#060608');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256); t.refresh();
    }
    s.add.image(x0, top, key).setOrigin(0).setDisplaySize(w, fade).setDepth(-9);
    s.add.rectangle(x0, top + fade - 1, w, 6000, 0x060608).setOrigin(0).setDepth(-9);
    // stones and roots in the upper earth, fading with it
    const g = s.add.graphics().setDepth(-8.9), r = (seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296))(31);
    for (let i = 0; i < Math.round(w / 90); i++) {
      const x = x0 + r() * w, d = r(), y = top + 10 + d * fade * 0.7, a = 0.35 * (1 - d), c = r() < 0.6 ? 0x2a2026 : 0x3b2a22;
      if (r() < 0.75) g.fillStyle(c, a).fillRect(Math.round(x / 4) * 4, Math.round(y / 4) * 4, 8 + Math.round(r() * 3) * 4, 4 + Math.round(r() * 2) * 4);
      else { g.lineStyle(3, 0x241812, a); g.beginPath(); g.moveTo(x, top); let yy = top; for (let k = 0; k < 6; k++) { yy += 10 + r() * 18; g.lineTo(x + (r() - 0.5) * 22, yy); } g.strokePath(); }
    }
    this.drawBunker(geo, T, fade);
  }
  drawBunker(geo, T, fade) {
    const s = this.scene, E = this.C.edge || {}, id = E.egg, A = id && this.D.assets?.[id];
    if (!A || !s.textures.exists(id)) return;
    s.textures.get(id).setFilter(NEAREST());
    const k = (E.eggScale ?? 200) / 100, x = this.groundX(E.eggAt ?? -9), y = geo.H * T + fade * 0.55;
    const img = s.add.image(x, y, id).setOrigin(0.5, 0).setScale(k).setDepth(-8.8).setAlpha((E.eggAlpha ?? 55) / 100);
    // the bulb and the screen still have a little power: a weak glow that flickers now and then
    const glow = s.add.image(x, y + img.displayHeight * 0.45, glowTexture(s)).setDisplaySize(img.displayWidth * 1.4, img.displayHeight * 1.2).setTint(0x9cdb43).setBlendMode(Phaser.BlendModes.ADD).setDepth(-8.7).setAlpha(0.12);
    s.tweens.addCounter({ from: 0, to: 1, duration: 6000, repeat: -1, onUpdate: tw => { const v = tw.getValue(), off = (v > 0.71 && v < 0.73) || (v > 0.76 && v < 0.77); img.setAlpha(((E.eggAlpha ?? 55) / 100) * (off ? 0.55 : 1)); glow.setAlpha(off ? 0.03 : 0.1 + 0.03 * Math.sin(v * 40)); } });
    this.egg = { x, y, w: img.displayWidth, h: img.displayHeight };
  }

  // ---------- the rig as a dollhouse ----------
  // Every container is its own view (a Phaser container standing on the ground), so building can redraw the rig on the spot
  // and let a single trailer wobble on its springs. Lights, interior platforms, labels and the workshops' E spots belong to it.
  drawRig({ hide = null } = {}) {
    ensureContainerLooks(this.scene, this.D);   // #113
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
    this.geo.units = this.geo.mega ? [] : rigUnits(this.D, this.box.save.rig, this.geo.vanLeft, this.ground, s.T);
    syncWorkers(this.D, this.box.save);   // #060 Ingenieur-Entities add power
    this.budget = budgets(this.D, this.box.save.rig);
    // solar: in the sun full power, at night only while the battery holds (#008)
    this.solar = solarState(this.D, this.box.save);
    if (this.solar.live < this.solar.made) { this.budget.power.made -= this.solar.made - this.solar.live; this.budget.power.net = this.budget.power.made - this.budget.power.used; }
    { const x = powerBoost(this.box.save, clockHours(this.box.save)); if (x) { this.budget.power.made += x; this.budget.power.net = this.budget.power.made - this.budget.power.used; } }   // the regulator in the green band (#013)
    this.noPower = this.D.build?.rules?.power !== false && this.budget.power.net < 0;
    this.tooHeavy = this.D.build?.rules?.weight !== false && this.budget.heavy;
    if (this.geo.mega) { this.drawMega(); this.drawYard(); }   // #029 aboard a mega rig
    else {
      for (const u of this.geo.units) u.view = this.drawUnit(u);
      this.drawVanParts();
      this.drawVanDoor();
      this.drawYard();
      this.drawStringLights();
    }
    this.drawSynergies();
    this.drawDecor();   // #036
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
          this.shells.push({ u, img: shut, key: `${u.ui}:${u.id}`, a: was, extras: [] });
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
      const art = this.benches.add({ id: w.id, place, x0: px0, w: cw, floor: u.floorY - inset, h, view, mid, G, grid: def.grid && storeKeyOf(D, this.scene.box.save, ...place.split(':').map(Number)), clip, unitScale: (u.def.benchScale ?? 100) / 100 });
      if (art) shades.push(clip);
      if (!art) furniture(g, def.function, cx, h + 40, cw, h, R.light || '#ffcf7a');
      if (!u.sprite && !art) g.fillStyle(0x0d0a12).fillRect(cx + cw / 2 - 26, 40 + 22, 52, 34).fillStyle(col(R.light || '#ffcf7a')).fillRect(cx + cw / 2 - 22, 40 + 26, 44, 26);   // window
      const l = this.light(u.in0 + w.at * u.cell + cw / 2, u.inTop + h * 0.35, 200, R.light || '#ffcf7a', 0.45); l.rig = true; l.unit = u.ui;
      this.workshopHotspot(u, w, def, u.in0 + w.at * u.cell, cw, u.inTop + 8);
    }
    // clutter on the closed container's outer wall, matching the workshop behind it (Werkstätten › Außenwand, #008); fades with the shell
    const shell = this.shells.find(c => c.u === u);
    if (shell) for (const w of u.workshops) {
      const def = D.workshops?.[w.id] || {}, info = def.outside && s.assetInfo(def.outside);
      if (!info || (this.hide && this.hide.ui === u.ui && this.hide.at === w.at)) continue;
      s.textures.get(info.key).setFilter(NEAREST());
      const cw = (def.places || 1) * u.cell, [ox, oy] = def.outsideAt || [0, 0], k = R.outsideScale ?? 2;
      const x = u.in0 + w.at * u.cell + cw / 2 + ox, y = u.inTop + h * 0.52 + oy;
      const img = s.add.image(x, y, info.key, 0).setOrigin(0.5).setScale(k).setDepth(-19.4).setAlpha(shell.a);
      this.rigObjs.push(img); shell.extras.push(img);
      if (def.function === 'kitchen' || def.function === 'foodtruck') (shell.smoke ||= []).push({ x: x + img.displayWidth * 0.18, y: y - img.displayHeight / 2 });
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
    // the interior floor carries Leyla (jump in), workshops are used with E from the ground or from inside
    const z = s.add.zone(u.in0 + u.cell * u.places / 2, u.floorY + 8, u.cell * u.places, 16);
    s.platforms.add(z);
    Object.assign(z.body.checkCollision, { down: false, left: false, right: false });
    this.rigObjs.push(z);
    // the roof (Daniel 19.11.2026: „man soll wieder auf Container laufen können“): a platform like „=“ on every free container roof,
    // from below you jump through, S + space drops down (Camp › Rig-Ansicht › Dächer begehbar)
    if (this.C.rig?.roofWalk !== false && u.kind !== 'tractor' && u.def?.kind !== 'crate' && roofFree(this.box.save.rig, u.ui) && u.deckY != null) {
      const r = s.add.zone(u.in0 + u.cell * u.places / 2, u.deckY + 8, u.cell * u.places + 16, 16);
      s.platforms.add(r); Object.assign(r.body.checkCollision, { down: false, left: false, right: false });
      this.rigObjs.push(r);
    }
    // a stacked container has end walls: up there Leyla can walk from end to end without stepping off into the air (down = ladder)
    const balc = balconies(this.box.save.rig);   // #037: a balcony opens that end
    if (u.level) for (const [side, wx] of [[0, u.in0 - 8], [1, u.in0 + u.cell * u.places + 8]]) {
      if (balc.has(`${u.ui}:${side}`)) continue;
      const wall = s.add.zone(wx, (u.inTop + u.floorY) / 2, 16, u.floorY - u.inTop);
      s.solids.add(wall); this.rigObjs.push(wall);
    }
    if (u.level) this.stackLadder(u);
    // ground floor: a few rungs up into a raised container (Daniel, 13.11.2026: „ohne Doppelsprung müssen Leitern an den Container sein, auch für das Erdgeschoss“)
    else if (this.C.rig?.groundLadder !== false && this.ground - u.floorY > s.T * 0.6) this.groundLadder(u);
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
    const art = ladderArt(s, x - s.T / 2, x + s.T / 2, top, bottom, { depth: -18 });   // #034
    if (art) this.rigObjs.push(art);
    else {
      const g = s.add.graphics().setDepth(-18);
      g.fillStyle(0x30363d).fillRect(x - 22, top - 30, 6, bottom - top + 30).fillRect(x + 16, top - 30, 6, bottom - top + 30);
      g.fillStyle(0x8b949e).fillRect(x - 22, top - 30, 2, bottom - top + 30).fillRect(x + 16, top - 30, 2, bottom - top + 30);
      for (let y = bottom - 20; y > top - 20; y -= 28) g.fillStyle(0x6b7280).fillRect(x - 16, y, 32, 5);
      this.rigObjs.push(g);
    }
    s.ladders.push({ cx: x, x0: x - s.T / 2, x1: x + s.T / 2, top, bottom, rig: true });
  }
  // a short ladder from the ground into a container on the ground floor (Camp › Rig-Ansicht › Leiter ins Erdgeschoss bei),
  // at the other end than the ladder to the stack, so both can stand side by side
  groundLadder(u) {
    const s = this.scene, R = this.C.rig || {}, in1 = u.in0 + u.cell * u.places, edge = Math.min(s.T * 0.75, (in1 - u.in0) / 2);
    const x = Math.min(Math.max(u.in0 + (in1 - u.in0) * (R.groundLadderAt ?? 92) / 100, u.in0 + edge), in1 - edge), top = u.floorY, bottom = this.ground;
    // a folding metal stair (Camp › Gemütlichkeit › Klapptreppe, Daniel 13.11.2026): its landing reaches the container's floor
    // #035 (Daniel: „die Treppen für den LKW-Trailer durch Leitern ersetzen“): a container on its chassis gets a ladder
    const art = u.chassis && ladderArt(s, x - s.T / 2, x + s.T / 2, top, bottom, { depth: -18 });
    if (art) { this.rigObjs.push(art); s.ladders.push({ cx: x, x0: x - s.T / 2, x1: x + s.T / 2, top, bottom, rig: true, ground: true }); return; }
    const info = this.C.stairs?.look && s.assetInfo(this.C.stairs.look);
    if (info) {
      s.textures.get(info.key).setFilter(NEAREST());
      const src = s.textures.get(info.key).getSourceImage(), land = (this.C.stairs.landing ?? 26) / src.height, feet = (this.C.stairs.feet ?? 123) / src.height;
      const k = Math.max(0.6, (bottom - top) / ((feet - land) * src.height)), ox = (this.C.stairs.at ?? 85) / src.width;
      this.rigObjs.push(s.add.image(x, bottom + (1 - feet) * src.height * k, info.key).setOrigin(ox, 1).setScale(k).setDepth(-18));
    } else {
      const g = s.add.graphics().setDepth(-18);
      g.fillStyle(0x30363d).fillRect(x - 22, top - 30, 6, bottom - top + 30).fillRect(x + 16, top - 30, 6, bottom - top + 30);
      g.fillStyle(0x8b949e).fillRect(x - 22, top - 30, 2, bottom - top + 30).fillRect(x + 16, top - 30, 2, bottom - top + 30);
      for (let y = bottom - 20; y > top - 20; y -= 28) g.fillStyle(0x6b7280).fillRect(x - 16, y, 32, 5);
      this.rigObjs.push(g);
    }
    s.ladders.push({ cx: x, x0: x - s.T / 2, x1: x + s.T / 2, top, bottom, rig: true, ground: true, stairs: !!info });
  }
  // the Kofferraum at the rear door: E opens and closes the Camp-Lager (#041)
  storeHotspot(key, x, name, rig = true) {
    const inv = () => this.scene.hud.inv, isOpen = () => inv()?.isOpen && inv().other?.key === key;
    this.hotspots.push({ rig, x, w: 50, top: this.curTop, name, hint: () => isOpen() ? 'Schließen' : 'Öffnen', store: key, act: () => { if (isOpen()) inv().close(); else this.scene.openContainer(key); } });
  }
  workshopHotspot(u, w, def, cx, cw, labelY) {
    const R = this.C.rig || {};
    const store = def.grid && storeKeyOf(this.D, this.scene.box.save, u.ui, w.at);   // a Speziallager its own, a shelf the Camp-Lager (#041)
    this.hotspots.push({ rig: true, place: `${u.ui}:${w.at}`, x: cx + cw / 2, w: cw / 2, top: this.curTop, floor: u.floorY, name: def.name || w.id, hint: this.synHint(`${u.ui}:${w.at}`, store ? 'Öffnen' : this.noPower && def.power < 0 ? 'Kein Strom' : VERB[def.function] || 'Ansehen'), ws: w.id, act: () => store ? this.scene.openContainer(store) : this.use(w.id, `${u.ui}:${w.at}`) });
    if (R.labels !== false && def.function !== 'tank') {   // the cryo tank has its own screen
      // subtle (#008): small, soft, a little see-through; they still say what stands where
      const t = this.scene.add.text(cx + cw / 2, labelY, titleOf(this.D, w), { fontFamily: 'VT323, monospace', fontSize: '20px', color: '#e9d8b4', stroke: '#0d0a12', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(-14).setAlpha(LABEL_ALPHA);
      t.unit = u.ui; this.rigObjs.push(t); (this.labels ||= []).push(t);   // fades with a closed shell
    }
  }

  // ---------- synergies (#033): the bonus in the prompt, a glowing link between neighbours that like each other ----------
  synHint(place, verb) {
    const x = synergyAt(this.D, this.box.save, place);
    return x && (x.near || x.bad || x.chain > 1) ? () => `${verb} · ${synergyText(x)}` : verb;   // only with at least one partner (or foe, #076) next to it
  }
  drawSynergies() {
    const s = this.scene, T = s.T, save = this.box.save, L = links(this.D, save);
    if (!L.length) return;
    const where = p => this.geo.mega ? this.megaBenchAt(p) : this.benches?.dockOf(`${p.ui}:${p.at}`);
    const g = s.add.graphics().setDepth(-13.5);
    this.rigObjs.push(g);
    for (const { a, b, foe } of L) {
      const col = foe ? 0xff5c7a : 0x7ff6ff;   // #076 Gegenpaare: red
      const A = where(a), B = where(b);
      if (!A || !B) continue;
      const vert = Math.abs(A.x - B.x) < Math.abs(A.y - B.y), y = vert ? null : Math.min(A.y, B.y) - 0.6 * T;
      const pts = vert ? [A, B] : [{ x: A.x, y }, { x: B.x, y }];
      g.lineStyle(6, 0x0d0a12, 0.55).lineBetween(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
      g.lineStyle(2, col, 0.75).lineBetween(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
      for (const p of pts) g.fillStyle(col, 0.9).fillCircle(p.x, p.y, 4);
      const m = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const glow = s.add.image(m.x, m.y, glowTexture(s)).setDisplaySize(70, 70).setTint(col).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(-13.4);
      s.tweens.add({ targets: glow, alpha: 0.12, duration: 1100, yoyo: true, repeat: -1 });
      this.rigObjs.push(glow);
    }
  }

  // ---------- scrapyard by the shaft: spare workshops on pallets, spare trailers parked behind, the dealer's pad ----------
  // built-in rig parts you can see from outside (Rig-Bau › Rig-Teile am Van › Im Camp sichtbar): Dachbox on the roof, plates on the side
  drawVanParts() {
    const s = this.scene, D = this.D, vis = D.build?.sockets?.visible || ['armor', 'weapon', 'roof'];
    if (s.hud.build?.active) return;   // building: the sockets show them
    for (const p of socketRects(D, this.box.save.rig, this.geo, this.ground)) {
      if (!p.id || !(vis.includes(p.slot) || p.slot === 'solar')) continue;
      const v = partView(s, D, p.id).setDepth(-19.5);
      v.setPosition(p.cx, p.slot === 'solar' ? p.y1 : p.cy + v.h / 2);   // solar stands on the container roof (#008)
      this.rigObjs.push(v);
    }
  }
  // pixel magic at the van's sliding door (Zugmaschine › Blick durch die Tür): the workshop behind the door shows through the
  // open door, cut at the door frame, with its lights and effects; it fades in when the door is fully open
  drawVanDoor() {
    const s = this.scene, D = this.D, rig = this.box.save.rig, T0 = D.tractors?.[rig.tractor] || {}, Dr = T0.door, van = s.van;
    this.vanDoor = null; this.vanDoors = [];
    if (!van?.sprite || !Dr) return;
    // #056 the van in cross-section (Zugmaschine › Blick ins Innere › Nischen): one bench per bay, its place in the van; the old single door slot still works
    const bays = Dr.bays?.length ? Dr.bays : Dr.x && Dr.y ? [{ x: Dr.x, y: Dr.y, place: Dr.place ?? 0 }] : [];
    for (const B of bays) {
      const w = (rig.units[0]?.workshops || []).find(x => x.at === (B.place ?? 0));
      if (!w || !B.x || !B.y || (this.hide && this.hide.ui === 0 && this.hide.at === w.at)) continue;
      const a = van.toWorld(B.x[0], B.y[0]), b = van.toWorld(B.x[1], B.y[1]);
      const clip = { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: a.y, y1: b.y };
      const view = s.add.container(0, 0).setDepth(van.depth + 0.05);
      this.rigObjs.push(view);
      if (Dr.backdrop) view.add(s.add.rectangle(clip.x0, clip.y0, clip.x1 - clip.x0, clip.y1 - clip.y0, col(Dr.backdrop)).setOrigin(0));
      // the bench stands on the van's floor, centred in the opening, in the shared scale
      const def = D.workshops?.[w.id] || {}, cw = Math.max(clip.x1 - clip.x0, 200);
      const bench = this.benches.add({ id: w.id, place: `0:${w.at}`, x0: (clip.x0 + clip.x1) / 2 - cw / 2, w: cw, floor: clip.y1, h: clip.y1 - clip.y0, view, mid: 0, G: 0, grid: def.grid && storeKeyOf(this.D, this.scene.box.save, 0, w.at), clip });
      if (!bench) { view.destroy(); continue; }
      bench.door = true;
      view.setAlpha(0);
      this.vanDoors.push({ view, bench });
      // E in front of the bay uses its workshop like one in a container (a Speziallager opens, the rest does its thing)
      if (Dr.bays?.length) {
        const store = def.grid && storeKeyOf(this.D, this.scene.box.save, 0, w.at), place = `0:${w.at}`;
        this.hotspots.push({ rig: true, place, x: (clip.x0 + clip.x1) / 2, w: (clip.x1 - clip.x0) / 2, name: def.name || w.id,
          hint: this.synHint(place, store ? 'Öffnen' : this.noPower && def.power < 0 ? 'Kein Strom' : VERB[def.function] || 'Ansehen'), ws: w.id,
          act: () => store ? this.scene.openContainer(store) : this.use(w.id, place) });
      }
    }
    this.vanDoor = this.vanDoors[0] || null;
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
      const def = containerDef(D, { id }), sh = unitShape(D, def, 0, s.T, { stacked: true }), w = sh.w * far;
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

  // ---------- string lights (game/string_lights.js): pulled between the containers' corners in build mode ----------
  anchors() {
    // the van has corners too: front and back of its roof
    const r = this.scene.van?.roof, van = r ? [{ ui: 0, x0: r.x0 - 8, x1: r.x1 + 8, inTop: r.y + 34 - 14 }] : [];   // the roof rails (Spiel › Van › Dach)
    return lightAnchors([...van, ...this.geo.units.filter(u => u.ui !== 0)], mastAt(this.D, this.geo.fireX, this.campY));
  }
  wire(i) {
    const pair = this.box.save.rig.lights?.[i], A = Object.fromEntries(this.anchors().map(a => [a.id, a])), L = lightsConfig(this.D);
    return pair && A[pair[0]] && A[pair[1]] ? catenary(A[pair[0]], A[pair[1]], L.sag, L.spacing) : null;
  }
  // every string is its own picture with real bounds (#009, Daniel: „sie verschwinden, wenn sie nicht mehr vollständig auf dem Screen
  // sind“ und nach dem Zurückkommen ins Fenster): a canvas texture per string, drawn once, plus glow lights for the night
  drawStringLights() {
    const s = this.scene, L = lightsConfig(this.D);
    for (const k of this.wireKeys || []) if (s.textures.exists(k)) s.textures.remove(k);
    this.wireKeys = [];
    this.bulbs = [];
    if (!L.enabled) return;
    this.drawMast();
    (this.box.save.rig.lights || []).forEach((_, i) => {
      const w = this.wire(i);
      if (!w) return;
      const pts = [...w.line, ...w.bulbs.map(b => ({ x: b.x, y: b.y + 16 }))], pad = 8;
      const x0 = Math.floor(Math.min(...pts.map(p => p.x)) - pad), y0 = Math.floor(Math.min(...pts.map(p => p.y)) - pad);
      const x1 = Math.ceil(Math.max(...pts.map(p => p.x)) + pad), y1 = Math.ceil(Math.max(...pts.map(p => p.y)) + pad);
      const key = `string_lights_${i}_${++wireSeq}`, tex = s.textures.createCanvas(key, x1 - x0, y1 - y0), ctx = tex.getContext();
      ctx.imageSmoothingEnabled = false;
      ctx.strokeStyle = '#17111f'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath(); w.line.forEach((p, k) => k ? ctx.lineTo(p.x - x0, p.y - y0) : ctx.moveTo(p.x - x0, p.y - y0)); ctx.stroke();
      w.bulbs.forEach((b, j) => {
        const bx = Math.round(b.x - x0), by = Math.round(b.y - y0);
        ctx.fillStyle = '#17111f'; ctx.fillRect(bx - 3, by - 1, 6, 5);                                    // socket
        ctx.fillStyle = L.colors[j % L.colors.length]; ctx.fillRect(bx - 4, by + 4, 8, 8); ctx.fillRect(bx - 3, by + 12, 6, 2);   // bulb (pixel)
        ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillRect(bx - 2, by + 5, 2, 2);
      });
      tex.refresh(); tex.setFilter(NEAREST());
      this.wireKeys.push(key);
      this.rigObjs.push(s.add.image(x0, y0, key).setOrigin(0).setDepth(-16));
      w.bulbs.forEach((b, j) => { const l = this.light(b.x, b.y + 9, 46, L.colors[j % L.colors.length], 0.75); l.rig = true; l.bulb = j * 1.7 + i; this.bulbs.push(l); });
    });
  }

  // the mast at the campfire (#014): a weathered pole with a little crossbar and a hook on top, drawn from code
  drawMast() {
    const s = this.scene, m = mastAt(this.D, this.geo.fireX, this.campY);
    if (!m) return;
    const g = s.add.graphics().setDepth(-17), x = Math.round(m.x), top = Math.round(m.top), h = m.y - top;
    g.fillStyle(0x17111f).fillRect(x - 9, top - 2, 18, h + 2);                                 // outline
    g.fillStyle(0x5d4037).fillRect(x - 7, top, 14, h);                                         // pole
    g.fillStyle(0x7a5a44).fillRect(x - 7, top, 4, h);                                          // light side
    for (let y = top + 40; y < m.y - 20; y += 70) g.fillStyle(0x3f2a22).fillRect(x - 7, y, 14, 3);   // grain
    g.fillStyle(0x17111f).fillRect(x - 30, top + 16, 60, 10).fillStyle(0x6b4a38).fillRect(x - 28, top + 18, 56, 6);   // crossbar
    g.fillStyle(0x8b949e).fillRect(x - 3, top - 10, 6, 10).fillStyle(0x17111f).fillRect(x - 1, top - 8, 2, 6);         // hook
    g.fillStyle(0x3f2a22).fillRect(x - 16, m.y - 8, 32, 8).fillStyle(0x17111f).fillRect(x - 16, m.y - 8, 32, 2);       // stones at the foot
    this.rigObjs.push(g);
  }

  // ---------- mood (Camp › Gemütlichkeit): dark edge, warm shimmer at night, fireflies round the fire ----------
  setMood() {
    const s = this.scene, M = this.C.mood || {}, k = this.lightK;
    const v = (M.vignette ?? 0) / 100;
    if (v > 0 && s.renderer?.type === Phaser.WEBGL && s.cam?.postFX) this.vignette = s.cam.postFX.addVignette(0.5, 0.5, 0.95 - 0.3 * v, 0.55 * v);
    const warm = (M.warm ?? 0) / 100;
    if (warm > 0 && k > 0) s.add.rectangle(-4000, -4000, this.geo.W * s.T + 8000, this.geo.H * s.T + 8000, 0xff8a3a, warm * 0.09 * k).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(30.5);
    this.flies = [];
    const n = Math.round(M.fireflies ?? 0);
    if (n > 0 && k > 0.2) for (let i = 0; i < n; i++) {
      const f = s.add.image(0, 0, glowTexture(s)).setDisplaySize(16, 16).setTint(0xd8ff7a).setBlendMode(Phaser.BlendModes.ADD).setDepth(31);
      this.flies.push({ f, x: this.geo.fireX + (Math.random() - 0.5) * 1300, y: this.campY - 40 - Math.random() * 240, p: Math.random() * 100, sp: 0.4 + Math.random() * 0.6 });
    }
    this.puffAt = 0;
  }
  updateMood(time, dt) {
    const s = this.scene, k = this.lightK, t = time / 1000;
    for (const q of this.flies || []) {
      const x = q.x + Math.sin(t * 0.37 * q.sp + q.p) * 90 + Math.sin(t * 1.1 * q.sp + q.p * 2) * 24, y = q.y + Math.sin(t * 0.53 * q.sp + q.p * 3) * 40;
      q.f.setPosition(x, y).setAlpha(k * Math.max(0, Math.sin(t * 1.7 * q.sp + q.p)) * 0.9);
    }
    for (const b of this.bulbs || []) b.setAlpha(b.base * k * (0.8 + 0.2 * Math.sin(t * 2.3 + b.bulb)));
    // chimney smoke from kitchen walls (closed shells only)
    if (this.C.mood?.smoke !== false && time > this.puffAt) {
      this.puffAt = time + 520;
      for (const c of this.shells || []) if (c.a > 0.6) for (const p of c.smoke || []) {
        const puff = s.add.circle(p.x + (Math.random() - 0.5) * 6, p.y, 7 + Math.random() * 4, 0xb8b0c0, 0.32 * c.a).setDepth(-19.3);
        s.tweens.add({ targets: puff, y: p.y - 150 - Math.random() * 60, x: puff.x + 30 + Math.random() * 30, scale: 2.6, alpha: 0, duration: 2600, onComplete: () => puff.destroy() });
      }
    }
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
    // #117 (Daniel 20.11.2026: „damit man das Rig von außen dekorieren kann, muss es zu bleiben, auch wenn man mit Leyla oder AvA in der
    // Nähe ist; der Toggle sollte einfach sein“): while building the rig stays closed unless the inside is shown (R3 / Select / O, the
    // button) or needed (a workshop or inside decoration in hand, a marked cell)
    const B = s.hud.build, building = !!B?.active, all = building ? !!B.insideView?.() : !!s.hud.rigOpen;
    for (const c of this.shells) {
      const u = c.u, top = u.inTop - 40, bottom = (u.base ?? this.ground) + 30;   // its own storey: from under its ceiling to its bottom rail
      const here = !building && l && l.x > u.x0 - near && l.x < u.x1 + near && l.feet > top && l.feet < bottom;
      const target = all || here ? 0 : 1;
      if (c.a !== target) c.a = target > c.a ? Math.min(1, c.a + dt / fade) : Math.max(0, c.a - dt / fade);
      c.img.setAlpha(c.a).setVisible(c.a > 0.001);
      for (const lt of this.lights) if (lt.rig && lt.unit === u.ui) lt.setAlpha(lt.base * this.lightK * (1 - c.a * (1 - leak))).setVisible(this.lightK > 0);
      for (const t of this.labels) if (t.unit === u.ui) t.setAlpha(LABEL_ALPHA * (1 - c.a));
      for (const x of c.extras || []) x.setAlpha(c.a).setVisible(c.a > 0.001);
    }
  }

  // ---------- campfire ----------
  drawFire() {
    const F = this.C.fire || {};
    if (F.enabled === false) return;
    const s = this.scene, x = this.geo.fireX, y = this.campY;
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
    // #016: the campfire also opens the quest log (Daniel: „am Warroom / Lagerfeuer“)
    this.hotspots.push({ x, w: 90, floor: this.geo.campFloor != null ? this.campY : undefined, name: 'Lagerfeuer', hint: 'Hinsetzen · Questlog', act: () => this.fireMenu() });
    // deco round the fire (Camp › Gemütlichkeit › Deko ums Feuer): rug, chairs, a corner with canisters
    for (const d of this.C.deco || []) {
      const info = d.look && s.assetInfo(d.look);
      if (!info) continue;
      s.textures.get(info.key).setFilter(NEAREST());
      s.add.image(x + (d.x || 0), y + (d.y || 0), info.key).setOrigin(0.5, 1).setScale(d.scale || 2).setFlipX(!!d.flip).setDepth(d.front ? 5 : d.look.includes('rug') ? -6 : -5);
    }
  }

  // ---------- van: at night warm light pours out of the open sliding door ----------
  vanGlow() {
    const V = this.C.vanLight || {};
    if (V.enabled === false || this.geo.mega) return;
    // #056: with bays the light comes out of the cut-open box (between the bays), else out of the door
    const B = this.D.tractors?.[this.geo.tractor?.id]?.door?.bays, van = this.scene.van;
    const x = B?.length && van ? van.toWorld((Math.min(...B.map(b => b.x[0])) + Math.max(...B.map(b => b.x[1]))) / 2, 0).x : this.geo.doorX, y = this.ground, k = (V.strength ?? 100) / 100, color = V.color || '#ffcf7a';
    this.doorLights = [
      this.light(x, y - (V.lift ?? 150), (V.width ?? 110), color, 0.55 * k, (V.height ?? 150)),   // the open doorway glows
      this.light(x + (V.spill ?? 40), y + 4, (V.pool ?? 260), color, 0.45 * k, (V.pool ?? 260) * 0.16),   // light spills onto the ground
    ];
  }

  // ---------- loop ----------
  update(time, dt, input) {
    const s = this.scene, l = s.leyla, range = this.C.interactRange ?? 130;
    this.updateDecor?.(time, dt);
    // the fire's light breathes and flickers
    if (this.fireLights && this.lightK > 0) {
      const t = time / 1000, fl = (this.C.fire?.flicker ?? 25) / 100;
      const wob = 1 - fl * (0.5 + 0.5 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1)) - fl * 0.3 * Math.random();
      for (const l of this.fireLights) l.setAlpha(l.base * this.lightK * wob);
    }
    // flames from code (without a look)
    if (this.flame) {
      const x = this.geo.fireX, y = this.campY - 18, f = this.flame.clear(), t = time / 1000;
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
    this.updateSound(time);
    this.updateCritters?.(time, dt);   // #107
    // the van's door: the workshop behind it shows only while the door is fully open
    for (const d of this.vanDoors || []) {
      // the benches fade in with the van's frames (#056: closed → cross-section), or as before after the door opened
      const v = this.scene.van, k = v && v.frames > 1 ? v.frame / (v.frames - 1) : 0, build = !!this.scene.hud.build?.active;
      const a = this.D.tractors?.[this.box.save.rig.tractor]?.door?.bays?.length ? (build ? 0 : k) : Math.max(0, Math.min(1, d.view.alpha + (v && Math.round(v.frame) === v.frames - 1 && !build ? 1 : -1) * dt / 180));
      d.view.setAlpha(a).setVisible(a > 0);
      d.bench.shut = a < 0.99;
    }
    this.benches?.update(time, dt);
    this.updateShells(dt);
    this.updateMood(time, dt);
    // companions: random speech bubbles
    const B = this.C.companions?.barkEvery || [7, 15];
    if (time > this.barkAt && this.companions.length) {
      this.bark(this.companions[Math.floor(Math.random() * this.companions.length)]);
      this.barkAt = time + (B[0] + Math.random() * (B[1] - B[0])) * 1000;
    }
    for (const c of this.companions) {
      if (c.until && time > c.until) { c.bubble.setAlpha(Math.max(0, c.bubble.alpha - dt / 300)); if (c.bubble.alpha <= 0) c.until = 0; }
      c.mark?.setAlpha(c.until ? 0 : 1);   // the speech bubble covers the mark
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
      sound: { wind: !!this.wind, music: this.music ? Math.round(this.music.volume * 100) : null, fire: this.fireVolume != null ? Math.round(this.fireVolume * 100) : null, muted: this.scene.sound.mute },
      benches: this.benches?.state() || [], resting: this.resting || null,
      shells: (this.shells || []).map(c => ({ unit: c.u.ui, id: c.u.id, closed: Math.round(c.a * 100) / 100, x0: Math.round(c.u.x0), x1: Math.round(c.u.x1) })), rigOpen: !!this.scene.hud.rigOpen,
      yard: (this.yardItems || []).map(y => ({ kind: y.kind, id: y.id, x: Math.round(y.x), y0: Math.round(y.y0) })),
      rig: this.geo.units.map(u => ({ id: u.id, x0: u.x0, x1: u.x1, workshops: u.workshops.map(w => w.id) })), van: this.geo.tractor?.workshops.map(w => w.id) };
  }
}

export const VERB = { sleep: 'Schlafen', warroom: 'Planen', kitchen: 'Kochen', foodtruck: 'Verkaufen', craft: 'Herstellen', storage: 'Lager', cooling: 'Kühlraum', chill: 'Chillen', drone: 'Drohne', engine: 'Motor', power: 'Energie', cell: 'Zelle', guests: 'Gäste', treasury: 'Schatzkammer', tank: 'Nach AvA sehen', garden: 'Gärtnern', cistern: 'Wasser', armory: 'Waffenkammer', vehicle: 'Fahrzeuge', jobs: 'Aufträge' };
export const SOON = { foodtruck: 'Verkaufen kommt später.', power: 'Liefert Energie für die Werkstätten im Rig.',
  storage: 'Ein Lager fürs Camp: Kochen, Herstellen und Zerlegen nehmen sich, was hier liegt.', cooling: 'Hält Essen frisch. Kochen nimmt sich, was hier liegt.' };

// what a choice on the road costs or gives, short (for the menu)
export function costLine(D, o) {
  const p = [];
  if (o.use) p.push(`−${o.useCount || 1} ${D.items?.[o.use]?.name || o.use}`);
  if (o.hours) p.push(`${o.hours > 0 ? '+' : ''}${de(o.hours)} h`);
  if (o.fuel) p.push(`${o.fuel > 0 ? '−' : '+'}${de(Math.abs(o.fuel))} l`);
  if (o.food) p.push(`${o.food > 0 ? '−' : '+'}${de(Math.abs(o.food))} Vorräte`);
  if (o.deltas) p.push(`${o.deltas > 0 ? '+' : '−'}${Math.abs(o.deltas)} Δ`);
  if (o.health) p.push(`−${o.health} Leben`);
  if (o.item) p.push(`+${o.count || 1} ${D.items?.[o.item]?.name || o.item}`);
  if (o.loot) p.push('Beute');
  if (o.risk) p.push(`Risiko ${o.risk} %`);   // #054: may go wrong
  return p.join(' · ');
}
// distance, hours, fuel and food for driving from the current place to a location; since #014 over several legs: the shortest
// way by road through known places (worldmap.js route), the legs summed up → { km, hours, fuel, food, route: [ids], legs: [...] }
export function travelCost(D, save, to) {
  const from = save.location, M = save.map, reveal = mapConfig(D).reveal, hop = M ? hops(M, from) : {};
  // #029: the fatbird flies straight over the map, without roads (one leg)
  const way = flies(D, save.rig.tractor) ? [from, to] : (M && route(D, M, from, to, id => M.visited?.includes(id) || (hop[id] ?? 99) <= reveal)) || [from, to];
  const legs = way.slice(1).map((id, i) => legCost(D, save, way[i], id));
  const sum = k => Math.round(legs.reduce((n, l) => n + l[k], 0) * 100) / 100;
  return { km: sum('km'), hours: sum('hours'), fuel: Math.round(sum('fuel') * 10) / 10, food: Math.round(sum('food') * 10) / 10, route: way, legs };
}
// one leg of the way (one road)
export function legCost(D, save, fromId, to) {
  const a = placeOf(D, save, fromId), b = placeOf(D, save, to), Tr = D.travel || {};
  const air = flies(D, save.rig.tractor), km = a && b ? (air ? Math.round(roadKm(D, a, b) / (1 + (mapConfig(D).detour ?? 0) / 100)) : roadKm(D, a, b)) : 0;   // along the road on the map (#007), flying: straight (#029)
  const tons = save.rig.units.filter(u => u.kind === 'container').reduce((n, u) => n + containerWeight(D, u), 0) / 1000;
  const fuelUse = D.tractors?.[save.rig.tractor]?.fuelUse ?? 12;
  const hours = Math.max(0.25, Math.round(km / ((Tr.speed || 40) * travelSpeed(D, save.rig.tractor)) * 4) / 4);   // #029: the crawler crawls, the fatbird races
  const fuel = Math.round(km * fuelUse / 100 * (1 + (Tr.weightFuelFactor ?? 0) / 100 * tons) * (1 - Math.min(60, mod(D, save, 'fuel')) / 100) * 10) / 10;   // #060 Navigator at work: less fuel
  const food = Math.round(hours / (Tr.dayLength || 24) * (Tr.foodPerDay ?? 1) * (1 + (save.companions?.length || 0)) * 10) / 10;
  return { from: fromId, to, km, hours, fuel, food };
}

// Split (#017, backlog C8): companions + sound and the actions live in their own files
import { CampLife } from './camp_life.js';
import { CampActions } from './camp_actions.js';
import { CampSalvage } from './camp_salvage.js';
import { CampBoard } from './camp_board.js';
import { CampMega } from './camp_mega.js';
import { CampDecor } from './camp_decor.js';
for (const M of [CampLife, CampActions, CampSalvage, CampBoard, CampMega, CampDecor]) for (const k of Object.getOwnPropertyNames(M.prototype)) if (k !== 'constructor') Object.defineProperty(Camp.prototype, k, Object.getOwnPropertyDescriptor(M.prototype, k));

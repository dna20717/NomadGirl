// #173 Schacht-Motiv in the picture (engine/shaft.js plans it): the rocket of Silo Zero over the whole depth of the silo, stacked from
// its painted segments (assets/pois/rocket/, tools/rocket_tiles_173.py): nose at the top under the surface, hull with stage rings
// through every floor, tail and nozzles on the launch pad at the floor of the Wow room, the flame trench below it; the service tower
// beside it. Everything sits in one container behind the play layer (depth −10.95, in front of the back wall), cut by a mask to the
// air of the rooms the shaft crosses: walls, floors and collision stay as they are. Frames at the edges of every opening (−10.8).
import { shaftInLevel, stackSegments } from '../../engine/shaft.js';

const INK = 0x221c1a, DARK = 0x333941, STEEL = 0x6d758d, SHAFT = 0x141013, RIB = 0x242234;

export function drawShaft(scene) {
  const s = scene, D = s.data_, LI = s.levelInfo, T = s.T;
  const sh = shaftInLevel(D, s.levelPoi, LI);
  if (!sh) return null;
  const has = id => id && s.textures.exists(id);
  const segs = sh.cfg.segments.filter(g => has(g.image));
  const src = g => s.textures.get(g.image).getSourceImage();
  const bodyPx = sh.body[1] * T, bx = sh.body[0] * T, cx = bx + bodyPx / 2;
  const scaleOf = g => bodyPx / Math.max(1, (g.to ?? src(g).width) - (g.from ?? 0));
  const segH = g => src(g).height * scaleOf(g) / T;   // tiles
  const items = [];
  // the stand: the launch pad under the tail, its slab 3 tiles above the floor of the stand room, the trench reaching into the room below
  const tail = segs.find(g => g.part === 'engine'), padSeg = segs.find(g => g.part === 'pad');
  const footPx = sh.foot * T;
  let standPx = footPx, pad = null;
  if (padSeg) {
    const engW = tail ? src(tail).width * scaleOf(tail) : bodyPx * 2.2, k = engW * 1.05 / src(padSeg).width, h = src(padSeg).height * k;
    const slab = footPx - 3 * T, top = slab - 0.3 * h;
    pad = { key: padSeg.image, x: cx - src(padSeg).width * k / 2, y: top, k, w: src(padSeg).width * k, h };
    standPx = slab + 0.04 * h;
  }
  const plan = stackSegments({ ...sh, foot: standPx / T, cfg: { ...sh.cfg, segments: segs } }, segH);
  // the mask: the open tiles (air of the crossed rooms, the stand room, the trench), one rectangle per run in a row
  const mg = s.make.graphics({}, false).fillStyle(0xffffff);
  const standRoom = LI.rooms[sh.bottomRoom];
  const xs0 = Math.min(sh.x0, standRoom.x), xs1 = Math.max(sh.x0 + sh.w, standRoom.x + standRoom.w);
  const yEnd = Math.max(standRoom.y + standRoom.h, ...sh.trench.map(t => t.y + t.h + 1));
  for (let y = sh.top - 1; y < yEnd; y++) {
    let run = null;
    for (let x = xs0; x <= xs1; x++) {
      const o = x < xs1 && sh.open(x, y);
      if (o && run == null) run = x;
      if (!o && run != null) { mg.fillRect(run * T, y * T, (x - run) * T, T); run = null; }
    }
  }
  const box = s.add.container(0, 0).setDepth(-10.95);
  box.setMask(mg.createGeometryMask());
  // 1 · the shaft itself: dark concrete, ring beams every 6 tiles, cable runs on the far wall; in the stand room only the column
  const g = s.add.graphics();
  const x0 = sh.x0 * T, W = sh.w * T, y0 = (sh.top - 1) * T, y1 = yEnd * T;
  g.fillStyle(SHAFT, 1).fillRect(x0, y0, W, y1 - y0);
  for (let y = Math.ceil(y0 / (6 * T)) * 6 * T; y < y1; y += 6 * T) g.fillStyle(RIB, 1).fillRect(x0, y, W, 10).fillStyle(INK, 1).fillRect(x0, y + 10, W, 4);
  for (const f of [0.08, 0.93]) g.fillStyle(0x1b1820, 1).fillRect(x0 + W * f - 6, y0, 12, y1 - y0);
  g.fillGradientStyle(0x060608, 0x060608, SHAFT, SHAFT, 0.9, 0.9, 0, 0).fillRect(x0, footPx, W, 6 * T);   // deeper below the pad
  box.add(g);
  // 2 · the service tower: the lattice repeats from the top of the shaft down to the stand, a shade darker (it stands behind the hull)
  const tw = segs.find(gg => gg.part === 'tower');
  if (tw && sh.tower) {
    const k = sh.tower[1] * T / src(tw).width, h = src(tw).height * k;
    for (let y = sh.top * T - h * 0.3; y < standPx + T; y += h - 1) box.add(s.add.image(sh.tower[0] * T, y, tw.image).setOrigin(0).setScale(k).setTint(0xb3b9d1));
  }
  // 3 · the rocket, top to bottom (rounded to whole pixels, each copy overlaps the next by one pixel so no hairline shows)
  for (const p of plan) {
    const k = scaleOf(p.seg), left = bx - (p.seg.from ?? 0) * k, y = Math.round(p.y * T);
    const img = s.add.image(Math.round(left), y, p.image).setOrigin(0).setScale(k);
    if (p.cut) img.setCrop(0, 0, src(p.seg).width, Math.ceil(p.h * T / k) + 1);
    box.add(img); items.push({ part: p.part, y, h: p.h * T });
  }
  if (pad) box.add(s.add.image(pad.x, pad.y, pad.key).setOrigin(0).setScale(pad.k));
  // the frames: a steel post at both edges of the column in every crossed room, a sill under the opening (the gallery rail)
  const fr = s.add.graphics().setDepth(-10.8);
  for (const o of sh.rooms) {
    if (o.room === sh.bottomRoom) continue;
    const top = o.y * T, bot = (o.y + o.h) * T;
    for (const ex of [x0, x0 + W]) { fr.fillStyle(INK, 1).fillRect(ex - 9, top, 18, bot - top); fr.fillStyle(DARK, 1).fillRect(ex - 6, top, 12, bot - top); fr.fillStyle(STEEL, 1).fillRect(ex - 6, top, 3, bot - top); }
  }
  const tip = plan[0] ? plan[0].y * T : sh.top * T;
  return { sh, plan, pad, box, frames: fr, mask: mg, cx, bodyPx, top: tip, foot: footPx, stand: standPx, half: pad ? pad.w / 2 : bodyPx, items };
}

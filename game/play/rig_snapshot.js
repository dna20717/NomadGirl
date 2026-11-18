// The rig as one picture for the drive (#053, Daniel 18.11.2026: „das echte, selbst gebaute Rig mit Anhängern von der Seite“). Before the
// camp is left, everything that belongs to the rig (trailers, containers closed, van with its parts, roof decor) is drawn into a render
// texture, without Leyla, people, labels, the night and the lights; the drive (drive_ui.js) lets it roll through the landscape.
//   snapshotRig(scene) → Promise<{ img, w, h, cuts: [x of the joints in the picture], ground (y of the road in the picture) } | null>
const RIG_DEPTH = [-21.6, -19.0];   // camp.js: trailers -21, van -20, van parts, shells and decor up to -19.x; Leyla 10, night 30, lights 31

export function snapshotRig(scene) {
  const camp = scene.camp, geo = scene.campGeo;
  if (!camp || !geo || geo.mega) return Promise.resolve(null);   // aboard a mega rig: the drive shows the landscape alone
  // closed containers for the road: every shell full, its labels gone (camp.updateShells puts them back next frame)
  for (const c of camp.shells || []) { c.img.setAlpha(1).setVisible(true); for (const x of c.extras || []) x.setAlpha(1).setVisible(true); }
  // the sliding door shut, nothing to see through it (camp.drawVanDoor), no roof foreground
  const van = scene.van;
  if (van?.door) { van.frame = 0; van.open = false; van.place(); }
  for (const d of camp.vanDoors || []) d.view.setAlpha(0).setVisible(false);
  van?.front?.setVisible(false);
  const objs = scene.children.list.filter(o => o.visible && o.alpha > 0.01 && o.depth >= RIG_DEPTH[0] && o.depth <= RIG_DEPTH[1] && !['Text', 'Zone', 'BitmapText'].includes(o.type) && !o.isLadder);
  const units = geo.units || [], ground = camp.ground;
  const x0 = Math.min(geo.vanLeft, ...units.map(u => u.x0)) - 40, x1 = geo.vanRight + 40;
  let top = ground - 200;
  for (const o of objs) {
    if (o.type === 'Graphics' || o.type === 'Rectangle') continue;
    const b = o.getBounds?.();
    if (b && b.right > x0 && b.left < x1 && b.width < 4000) top = Math.min(top, b.top);
  }
  top = Math.max(top - 20, ground - 2400);
  const w = Math.ceil(x1 - x0), h = Math.ceil(ground + 6 - top);
  if (w < 20 || h < 20) return Promise.resolve(null);
  const rt = scene.make.renderTexture({ x: 0, y: 0, width: w, height: h }, false);
  for (const o of objs.sort((a, b) => a.depth - b.depth)) {
    // render textures put an object at the given position; graphics and rectangles keep their world drawing, shifted by the box
    rt.draw(o, o.x - x0, o.y - top);
  }
  // the joints between van and trailers (left edges of the units), so the drive can let each one sway on its own springs
  const cuts = [...new Set([geo.vanLeft, ...units.filter(u => !u.level).map(u => u.x0)].map(x => Math.round(x - x0)))].filter(x => x > 0 && x < w).sort((a, b) => a - b);
  return new Promise(res => {
    rt.snapshot(img => { rt.destroy(); res(img ? crop({ img, w, h, cuts, ground: ground - top }) : null); });
  });
}

// cut the picture to what is drawn (alpha), keep cuts and road line in the new frame → a canvas
function crop(r) {
  const c = document.createElement('canvas'); c.width = r.w; c.height = r.h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(r.img, 0, 0);
  const d = x.getImageData(0, 0, r.w, r.h).data;
  let x0 = r.w, x1 = -1, y0 = r.h, y1 = -1;
  for (let y = 0; y < r.h; y++) for (let i = 0; i < r.w; i++) if (d[(y * r.w + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0) return null;
  const w = x1 - x0 + 1, h = Math.max(y1, Math.round(r.ground)) - y0 + 1, out = document.createElement('canvas');
  out.width = w; out.height = h; out.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
  return { img: out, w, h, cuts: r.cuts.map(k => k - x0).filter(k => k > 4 && k < w - 4), ground: r.ground - y0 };
}

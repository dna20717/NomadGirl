// CampBuilder v2 (#196): the ground of the diorama, drawn with the game's own tile art (game/play/art.js drawRoom: Kachel-Sets, crust,
// autotiling, depth, clutter), so it looks exactly like a room in the game. The world is cut into chunks of CH columns; a chunk is
// drawn as a little room with PAD columns of its neighbours on each side (edges and shadows see across the cut) and cropped to its own
// columns. A change redraws only the chunks around it. room.ox keeps every variant and dice roll tied to the world column.
// New tiles pop in (squash & stretch) on their own sprite until the chunk is drawn again; removed tiles crumble.
import { drawRoom, terrainKits } from '../play/art.js';
import { setAt, solid, top, bottom } from './model.js';

export const CH = 12, PAD = 3, AIR = 3;
const mod = (i, n) => ((i % n) + n) % n;

export class TerrainView {
  constructor(scene, model, { details = true, margin = 40 } = {}) {
    this.s = scene; this.m = model; this.T = 64; this.margin = margin;
    this.chunks = new Map(); this.dirty = new Set(); this.pops = []; this.lastBake = -1e9; this.version = 0; this.bakes = 0;
    this.dust = new Map();
    this.setDetails(details, false);
  }
  // CampBuilder › Ansicht › Lebendige Details: without them the sets bring no clutter, decals or big clutter
  setDetails(on, redraw = true) {
    this.details = on;
    const D = this.s.data_, D2 = on ? D : { ...D, terrain: Object.fromEntries(Object.entries(D.terrain || {}).map(([k, t]) => [k, { ...t, clutterChance: 0, decalChance: 0, bigChance: 0 }])) };
    this.kits = terrainKits(this.s, D2);
    if (redraw) this.all();
  }
  kitOf(set) { return this.kits(set) || this.kits(this.m.base); }
  backOf(x) { const k = this.kitOf(setAt(this.m, x, bottom(this.m))); return k ? { ...k, shade: 58 } : null; }
  range() { const [x0, x1] = this.m.parcel; return [Math.floor((x0 - this.margin) / CH), Math.floor((x1 + this.margin) / CH)]; }
  all() { const [a, b] = this.range(); for (let c = a; c <= b; c++) this.dirty.add(c); }
  // a tile changed: its chunk and the neighbours that see it in their padding
  touch(x) { for (const c of new Set([Math.floor((x - PAD - 1) / CH), Math.floor(x / CH), Math.floor((x + PAD + 1) / CH)])) this.dirty.add(c); }
  // once per frame: redraw what changed (at most every 90 ms while the hands are busy, so the frame rate stays smooth)
  update(time, force = false) {
    const [a, b] = this.range();
    for (let c = a; c <= b; c++) if (!this.chunks.has(c)) this.dirty.add(c);
    if (!this.dirty.size || (!force && time - this.lastBake < 90)) { this.settle(); return false; }
    const list = [...this.dirty].sort((p, q) => Math.abs(p - this.focus(a, b)) - Math.abs(q - this.focus(a, b)));
    const n = force ? list.length : Math.min(list.length, 4);
    for (const c of list.slice(0, n)) { this.dirty.delete(c); if (c >= a && c <= b) this.bake(c); }
    this.lastBake = time; this.version++;
    this.settle();
    return true;
  }
  focus(a, b) { const cam = this.s.cameras?.main; return cam ? Math.floor(cam.midPoint.x / this.T / CH) : (a + b) / 2; }
  bake(c) {
    const s = this.s, m = this.m, T = this.T, wx0 = c * CH - PAD, wy0 = top(m) - AIR, w = CH + 2 * PAD, h = bottom(m) - wy0 + 1;
    const tiles = [];
    for (let y = 0; y < h; y++) { let r = ''; for (let x = 0; x < w; x++) r += solid(m, wx0 + x, wy0 + y) ? '#' : '.'; tiles.push(r); }
    const room = { w, h, tiles, ox: wx0, start: null };
    // below the old ground line air shows the earth behind it (dug holes, caves): the back wall of the set the column ends in
    const terrain = { at: (x, y) => { const v = setAt(m, wx0 + x, wy0 + y); return v ? this.kitOf(v) : null; }, back: (x, y) => wy0 + y >= 0 && !solid(m, wx0 + x, wy0 + y) ? this.backOf(wx0 + x) : null };
    const res = drawRoom(s, room, T, {}, null, terrain);
    for (const L of res.layers || []) { const lx = L.x, ly = L.y; L.setCrop(PAD * T - lx, 0, CH * T, h * T + 64); L.setPosition(wx0 * T + lx, wy0 * T + ly); L.setDepth(-10); }
    const old = this.chunks.get(c);
    this.chunks.set(c, { layers: res.layers || [], v: this.version + 1 });
    for (const L of old?.layers || []) L.destroy();
    this.bakes++;
  }
  // the frame a tile shows (as drawRoom picks it without autotiling): the surface where air is above, else the fill
  frameOf(x, y, set) {
    const k = this.kitOf(set);
    if (!k) return null;
    const list = !solid(this.m, x, y - 1) ? k.top : k.fill;
    return { key: k.key, frame: list[mod(x, list.length)], over: k.over };
  }
  // the colour of a set's dust: the middle of its surface tile, measured once
  dustOf(set) {
    if (this.dust.has(set)) return this.dust.get(set);
    let col = 0xc8a070;
    try {
      const k = this.kitOf(set), f = this.s.textures.getFrame(k.key, k.top[0]), c = document.createElement('canvas'); c.width = 8; c.height = 8;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(f.source.image, f.cutX + f.cutWidth * 0.3, f.cutY + k.over + 4, f.cutWidth * 0.4, 18, 0, 0, 8, 8);
      const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
      if (n) col = (Math.round(r / n) << 16) | (Math.round(gg / n) << 8) | Math.round(b / n);
    } catch { /* default dust */ }
    this.dust.set(set, col);
    return col;
  }
  // a new tile pops in from the ground: squashed, then it springs to its size
  pop(x, y, set, delay = 0) {
    const s = this.s, T = this.T, f = this.frameOf(x, y, set);
    if (!f || !s.textures.exists(f.key)) return;
    const img = s.add.image(x * T + T / 2, y * T + T, f.key, f.frame).setOrigin(0.5, 1).setDepth(-9.6).setScale(1.22, 0.12).setAlpha(0.85);
    const p = { img, x, v: Infinity, born: s.time.now };
    s.tweens.add({ targets: img, scaleX: 1, scaleY: 1, alpha: 1, duration: 260, delay, ease: 'Back.Out', easeParams: [2.2], onComplete: () => { p.v = this.version + 1; } });
    this.pops.push(p); this.touch(x);
  }
  // a tile goes: it crumbles down and fades, a few crumbs fly
  crumble(x, y, set, delay = 0) {
    const s = this.s, T = this.T, f = this.frameOf(x, y - 0, set);
    if (!f || !s.textures.exists(f.key)) { this.touch(x); return; }
    const img = s.add.image(x * T + T / 2, y * T + T, f.key, f.frame).setOrigin(0.5, 1).setDepth(-9.6);
    s.tweens.add({ targets: img, scaleX: 0.55, scaleY: 0.1, alpha: 0, y: img.y + 10, duration: 240, delay, ease: 'Quad.In', onComplete: () => img.destroy() });
    this.touch(x);
  }
  // pop sprites leave once their chunk has been drawn with the tile in it
  settle() {
    this.pops = this.pops.filter(p => {
      if (this.version < p.v || this.dirty.has(Math.floor(p.x / CH))) return true;
      this.s.tweens.add({ targets: p.img, alpha: 0, duration: 120, onComplete: () => p.img.destroy() });
      return false;
    });
  }
  destroy() { for (const ch of this.chunks.values()) for (const L of ch.layers) L.destroy(); this.chunks.clear(); for (const p of this.pops) p.img.destroy(); this.pops = []; }
}

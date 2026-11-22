// Hüllen G4 im Spiel (#171): the building around the rooms of a POI level, painted from its plan (engine/facade.js planHull, painter
// game/hull_paint.js) into chunks of canvas (Spiel › Hülle › Körnung pixels per tile, scaled up sharp to 64 px) behind the walls of the
// rooms (depth −12: behind the back wall −11 and the tiles −10). Room windows show the dusk and the far city through the back wall, with
// a frame like the landmark windows (#163). hullSkyline puts the far silhouettes of the same grammar on the background camera:
// BigCityDelta on the horizon and the neighbours of the region. Nothing here collides or blocks play.
import { paintHull, paintSkyline, paintWindowView, hullArtIds } from '../hull_paint.js';
import { hullGame, skylinePlan } from '../../engine/facade.js';
import { landmarkViews } from '../../engine/level_design.js';

const CHUNK = 2048;   // px per canvas side at the hull's grain

export class Hull {
  constructor(scene, plan) {
    const s = this.scene = scene, D = s.data_, G = hullGame(D), T = s.T;
    this.plan = plan; this.G = G;
    // #172 painted modules (loaded with the level, scene.js): the picture of an asset id, or null (the code paints instead)
    const ids = hullArtIds(plan.cfg), art = id => s.textures.exists(id) ? s.textures.get(id).getSourceImage() : null, mods = ids.some(id => art(id));
    const g = this.g = Math.max(4, Math.min(64, Math.round(mods ? G.artGrain : G.grain))), above = plan.above + 1, y0 = -above, Wt = plan.W, Ht = plan.H + above;
    this.modules = ids.filter(id => art(id)).length;
    const step = Math.max(8, Math.floor(CHUNK / g)), stamp = Date.now();
    // room windows: the landmark windows (#163) draw their own view; the others get the city
    const lw = new Set(landmarkViews(D, s.levelPoi, s.levelInfo).filter(v => v.win).map(v => `${v.win.x},${v.win.y}`));
    this.roomWindows = plan.windows.filter(w => w.where === 'room' && !lw.has(`${w.x},${w.y}`));
    const sky = skylinePlan(D, { region: this.region(), seed: s.levelSeed || 1, width: 700, height: 260, far: true });
    this.images = [];
    for (let cy = y0; cy < plan.H; cy += step) for (let cx = 0; cx < Wt; cx += step) {
      const w = Math.min(step, Wt - cx), h = Math.min(step, plan.H - cy);
      if (!this.busy(cx, cy, w, h)) continue;
      const key = `hull_${stamp}_${cx}_${cy}`, tex = s.textures.createCanvas(key, w * g, h * g), ctx = tex.getContext();
      paintHull(ctx, plan, { g, x0: cx, y0: cy, w, h, dim: G.backDim, art: mods ? art : null });
      for (const wn of this.roomWindows) {
        if (wn.x + wn.w < cx || wn.x > cx + w || wn.y + wn.h < cy || wn.y > cy + h) continue;
        paintWindowView(ctx, (wn.x - cx) * g, (wn.y - cy) * g, wn.w * g, wn.h * g, { sky, seed: wn.x * 7 + wn.y });
      }
      tex.refresh(); tex.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
      this.images.push(s.add.image(cx * T, cy * T, key).setOrigin(0).setDisplaySize(w * T, h * T).setDepth(-12));
    }
    // frames of the room windows (on the back wall, like the landmark windows)
    if (this.roomWindows.length) {
      const fr = this.frames = s.add.graphics().setDepth(-10.8);
      for (const { x, y, w, h } of this.roomWindows) {
        fr.lineStyle(10, 0x221c1a, 1).strokeRect(x * T - 4, y * T - 4, w * T + 8, h * T + 8);
        fr.lineStyle(5, 0x6d758d, 1).lineBetween((x + w / 2) * T, y * T, (x + w / 2) * T, (y + h) * T);
        if (h > 2) fr.lineBetween(x * T, (y + h / 2) * T, (x + w) * T, (y + h / 2) * T);
        fr.fillStyle(0x333941, 0.9).fillRect(x * T - 8, (y + h) * T + 4, w * T + 16, 10);
      }
    }
    s.events.once('shutdown', () => { for (const im of this.images) { const k = im.texture?.key; im.destroy(); if (k && s.textures.exists(k)) s.textures.remove(k); } });
  }
  region() { const sv = this.scene.box?.save; return sv?.map?.nodes?.find(n => n.id === sv.location)?.region || this.scene.data_.locations?.[sv?.location]?.region || ''; }
  // a chunk with anything to draw: hull tiles, a part or a room window in it
  busy(x0, y0, w, h) {
    const P = this.plan;
    for (let y = Math.max(0, y0); y < Math.min(P.H, y0 + h); y++) for (let x = x0; x < x0 + w; x++) if (P.cls[y * P.W + x]) return true;
    return P.parts.some(p => p.x < x0 + w && p.x + p.w > x0 && p.y < y0 + h && p.y + p.h > y0) || P.windows.some(q => q.x < x0 + w && q.x + q.w > x0 && q.y < y0 + h && q.y + q.h > y0);
  }
  // Fernsteuerung / tests: what the hull did
  state() { const P = this.plan, c = [0, 0, 0, 0, 0]; for (const v of P.cls) c[v]++; return { type: P.cfg.type, kind: P.cfg.kind, facade: c[1], open: c[2], earth: c[4], buildings: P.buildings.length, windows: P.windows.filter(w => w.where === 'facade').length, roomWindows: P.windows.filter(w => w.where === 'room').length, parts: P.parts.length, chunks: this.images.length, grain: this.g, modules: this.modules || 0 }; }
  lightAt(x, y) { const P = this.plan; return x >= 0 && y >= 0 && x < P.W && y < P.H && P.cls[y * P.W + x] ? this.G.light / 100 : null; }
}

// the far silhouettes on the background camera (call inside the background block of the scene): BigCityDelta small on the horizon behind
// the painted parallax, the region's neighbours a little nearer; repeats over the width the world needs at their speed
export function hullSkyline(scene, worldW) {
  const D = scene.data_, G = hullGame(D);
  if (G.enabled === false || G.skyline === false || !D.pois?.[scene.levelPoi]?.hull?.type) return [];
  const W = scene.scale.width, H = scene.scale.height, bd = scene.roomDef?.backdrop || {}, horizon = H * (bd.horizon ?? 64) / 100;
  const sv = scene.box?.save, region = sv?.map?.nodes?.find(n => n.id === sv.location)?.region || '';
  const out = [], seed = scene.levelSeed || 1, stamp = Date.now();
  for (const [far, sf, depth, hh, color, alpha] of [[true, 0.03, -97.97, H * 0.2, '#403353', 0.75], [false, 0.09, -97.46, H * 0.16, '#422433', 0.9]]) {
    const width = Math.min(8192, Math.ceil(W * 1.6 + worldW * sf)), sky = skylinePlan(D, { region, seed: seed + (far ? 0 : 17), width, height: hh, far });
    if (!sky.list.length || !far && !['city', 'outskirts', 'industry'].includes(sky.kind)) continue;   // open country: only the far city
    const key = `hullsky_${far ? 'far' : 'near'}_${stamp}`, tex = scene.textures.createCanvas(key, width, Math.ceil(hh * 1.4) + 40), ctx = tex.getContext();
    paintSkyline(ctx, sky, { x: 0, base: tex.height, color, k: 1, alpha });
    tex.refresh();
    out.push(scene.add.image(-W * 0.2, horizon + (far ? 2 : 8), key).setOrigin(0, 1).setScrollFactor(sf, 0).setDepth(depth));
  }
  scene.events.once('shutdown', () => { for (const im of out) { const k = im.texture?.key; im.destroy(); if (k && scene.textures.exists(k)) scene.textures.remove(k); } });
  return out;
}

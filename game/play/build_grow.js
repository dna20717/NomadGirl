// #116 Ziehen zum Wachsen (Daniel 19.11.2026: „Dinge wie Laterne so designen, dass man die Ziehen-Funktion benutzen kann, wie Laterne,
// Pfosten oder Wachturm … Kisten: ziehen macht einen Stapel … Zelte dynamisch in Breite und eingeschränkt in Höhe“). Every placed piece
// with Deko › Wachsen gets gold grips like a container's rear end: on top (height, stack) and, for tents, at the right end (width).
// Pull them: the piece snaps step by step (one middle section, one crate, one tile), no cost. The whole pull is one undo step.
// Controller: AvA on the grip, A = grab, ↑/↓ (or ←/→ at a side grip) = a step, A/B = done. Mixed into BuildMode (build_mode.js).
import { snapshot } from '../rig.js';
import { decorDef } from '../decor.js';

export class BuildGrow {
  // the grips of every grown piece: [{ i, axis: 'n' | 'm', side: 'top' | 'right', x, y, step (px per step) }]
  growGrips() {
    const D = this.D, camp = this.camp, out = [], R = this.save.rig.decor || [];
    R.forEach((o, i) => {
      const d = decorDef(D, o.id), b = camp.decorBoxes?.[i];
      if (!d?.grow || !b) return;
      const k = camp.kitScale(d), fr = camp.kitFrame(d, o.at), T = this.scene.T;
      if (d.grow === 'steps') { out.push({ i, axis: 'n', side: 'top', x: (b.x0 + b.x1) / 2, y: b.y0, step: 36 }); return; }   // #118 a bigger picture per step
      if (d.grow === 'stack') { const c = camp.kitContent(d.look, fr); out.push({ i, axis: 'n', side: 'top', x: (b.x0 + b.x1) / 2, y: b.y0, step: Math.max(20, (c?.h ?? 60) * k - 2) }); return; }
      if (d.art === 'ladder') { out.push({ i, axis: 'n', side: 'top', x: (b.x0 + b.x1) / 2, y: b.y0, step: T }); return; }
      const sl = camp.growSlices(d, fr);
      if (d.grow === 'up' && sl.y) out.push({ i, axis: 'n', side: 'top', x: b.x ?? (b.x0 + b.x1) / 2, y: b.y0, step: (sl.y[1] - sl.y[0]) * k });
      if (d.grow === 'side') {
        if (sl.x) out.push({ i, axis: 'n', side: 'right', x: b.x1 + 6, y: (b.y0 + b.y1) / 2 + 10, step: (sl.x[1] - sl.x[0]) * k / 2 });   // centred: the end moves half a section
        if (sl.y) out.push({ i, axis: 'm', side: 'top', x: (b.x0 + b.x1) / 2, y: b.y0, step: (sl.y[1] - sl.y[0]) * k * 1.5 });
      }
    });
    return out;
  }
  pickGrow(x, y) {
    const z = Math.max(0.3, this.scene.cam.zoom), R = 26 / z;
    for (const g of this.growGrips()) if (Math.abs(x - g.x) < R && Math.abs(y - g.y) < R) return { kind: 'grow', grip: g, i: g.i, item: { x0: g.x - R, x1: g.x + R, y0: g.y - R, y1: g.y + R } };
    return null;
  }
  growValue(i, axis) { const o = this.save.rig.decor[i], d = decorDef(this.D, o.id), g = this.camp.growOf(d, o.at); return axis === 'm' ? g.m : g.n; }
  growLimits(i, axis) { const d = decorDef(this.D, this.save.rig.decor[i].id); return (axis === 'm' ? d.growRange2 : d.growRange) || [0, 4]; }

  startGrow(hit, w, pad = false) {
    const g = hit.grip, v = this.growValue(g.i, g.axis);
    this.growing = { i: g.i, axis: g.axis, side: g.side, step: g.step, x: w.x, y: w.y, v0: v, v, snap: snapshot(this.save), pad };
    this.sfx.klack?.(); this.buzz('lift');
    const name = decorDef(this.D, this.save.rig.decor[g.i].id)?.name || 'Stück';
    this.say(pad ? (g.side === 'right' ? '← kürzer · → länger · A fertig' : '↑ höher · ↓ niedriger · A fertig') : `${name}: ${g.side === 'right' ? 'nach rechts länger' : 'nach oben höher'}`, 'idle');
    this.draw();
  }
  growMove(w) {
    const G = this.growing; if (!G || G.pad) return;
    const d = G.side === 'right' ? (w.x - G.x) : (G.y - w.y);
    this.growTo(G.v0 + Math.round(d / G.step));
  }
  growStep(dir) { const G = this.growing; if (G) this.growTo(G.v + dir); }
  growTo(v) {
    const G = this.growing, [lo, hi] = this.growLimits(G.i, G.axis);
    const want = Math.max(lo, Math.min(hi, v));
    if (want === G.v) { if (v !== want) { this.buzz('edge'); this.say(v > hi ? 'Höher bzw. länger geht es nicht' : 'Kleiner geht es nicht', 'idle'); } return; }
    const o = this.save.rig.decor[G.i];
    o.at = { ...o.at, [G.axis]: want };
    G.v = want;
    this.camp.drawRig();
    this.sfx.klack?.(); this.buzz('snap');
    const b = this.camp.decorBoxes?.[G.i];
    if (b) this.scene.fx?.dust?.((b.x0 + b.x1) / 2, b.y1, 5);
    const d = decorDef(this.D, o.id), [lo2, hi2] = this.growLimits(G.i, G.axis);
    this.say(`${d.name}: Stufe ${want - lo2 + 1} von ${hi2 - lo2 + 1}${d.growLight && G.axis === 'n' ? ' · leuchtet weiter' : ''}${d.growView ? ' · oben mehr Weitblick' : ''}`, 'ok');
    this.draw();
  }
  endGrow() {
    const G = this.growing; if (!G) return false;
    this.growing = null;
    if (G.v !== G.v0) {
      const d = decorDef(this.D, this.save.rig.decor[G.i]?.id), b = this.camp.decorBoxes?.[G.i];
      this.undo.push({ snap: G.snap, label: `${d?.name || 'Stück'} gezogen`, job: null, at: b ? { x: b.x, y: b.y } : null, done: false });
      this.sfx.klonk?.(1.1); this.buzz('drop');
      this.scene.box.persist?.();
    } else this.say('Gleich geblieben', 'idle');
    this.draw();
    return true;
  }
  // gold grips: a bar on top (height), a bar at the right end (width), arrows while hovered or pulled
  drawGrowGrips(g, label, z, pulse) {
    if (this.drag || this.decorHold || this.wire || this.painting != null) return;
    const w = this.ava?.on ? this.ava : this.pointer, hot = this.growing ? null : w && this.pickGrow(w.x, w.y);
    for (const q of this.growGrips()) {
      const on = (this.growing?.i === q.i && this.growing.axis === q.axis) || (hot?.i === q.i && hot.grip.axis === q.axis), v = q.side === 'right';
      const lw = 14 / z, ln = 40 / z;
      g.fillStyle(on ? 0xffd27a : 0x3fe0d0, on ? 0.95 : 0.45 * pulse);
      if (v) g.fillRoundedRect(q.x - lw / 2, q.y - ln / 2, lw, ln, 6 / z); else g.fillRoundedRect(q.x - ln / 2, q.y - lw / 2, ln, lw, 6 / z);
      for (const k of [-10, 0, 10]) g.fillStyle(0x141013, 0.8).fillRect(v ? q.x - 4 / z : q.x + (k - 1.5) / z, v ? q.y + (k - 1.5) / z : q.y - 4 / z, v ? 8 / z : 3 / z, v ? 3 / z : 8 / z);
      if (!on) continue;
      g.fillStyle(0xffd27a);
      if (v) g.fillTriangle(q.x + 30 / z, q.y, q.x + 18 / z, q.y - 8 / z, q.x + 18 / z, q.y + 8 / z);
      else g.fillTriangle(q.x, q.y - 32 / z, q.x - 8 / z, q.y - 20 / z, q.x + 8 / z, q.y - 20 / z);
      const val = this.growing?.i === q.i ? this.growing.v : this.growValue(q.i, q.axis), [lo, hi] = this.growLimits(q.i, q.axis);
      label(q.x, q.y - 50 / z, `${val - lo + 1} / ${hi - lo + 1}${this.growing ? '' : ' · ziehen'}`, '#ffd27a');
    }
  }

  // ---------- the buildable space (Daniel: „bebaubaren Raum ähnlich visualisieren wie Beute auf dem Boden im POI, wobei das Grid sich an
  // der Position von AvA orientiert“): a cyan scan grid like the Boden-Leiste, on the camp's own grid (half tiles), centred on AvA
  // and fading out towards its edge. Buildable cells glow: with a piece in hand exactly its free places (the one under AvA gold),
  // otherwise the ground of the campsite and the container roofs. Rig-Bau › Bau-Modus › Bau-Raster.
  drawBuildGrid(g, z, time) {
    const V = this.B.grid || {};
    if (V.enabled === false || this.painting != null) return;
    const w = this.ava?.on ? this.ava : this.pointer;
    if (!w) return;
    const camp = this.camp, T = this.scene.T, cell = T * (V.cell ?? 50) / 100, R = T * (V.radius ?? 5), A = (V.alpha ?? 60) / 100;
    const ox = camp.groundX(0), oy = camp.ground, fade = (x, y) => { const d = Math.hypot(x - w.x, y - w.y) / R; return d >= 1 ? 0 : 1 - d * d; };
    const i0 = Math.floor((w.x - R - ox) / cell), i1 = Math.ceil((w.x + R - ox) / cell), j0 = Math.floor((w.y - R - oy) / cell), j1 = Math.min(0, Math.ceil((w.y + R - oy) / cell));   // nothing to build below the ground
    // buildable cells: the free places of the piece in hand, else ground and roofs
    const cells = new Map(), key = (i, j) => `${i},${j}`, mark = (x, y, hot) => { const i = Math.floor((x - ox) / cell), j = Math.floor((y - 1 - oy) / cell); const k = key(i, j); if (!cells.has(k) || hot) cells.set(k, hot ? 2 : 1); };
    const h = this.decorHold;
    if (h && this.camp.decorSpots) {
      const t = this.decorTarget?.(w);
      for (const q of this.camp.decorSpots(h.id)) if (Math.abs(q.x - w.x) < R && Math.abs(q.y - w.y) < R) mark(q.x, q.y, t && t.x === q.x && t.y === q.y);
    } else if (!this.drag) {
      const [a, b] = this.D.camp?.decor?.ground || [-4, 20];
      for (let x = camp.groundX(a); x <= camp.groundX(b); x += cell) if (Math.abs(x - w.x) < R) mark(x + 1, oy, false);
      for (const u of camp.geo.units || []) if (u.ui > 0 && u.deckY != null) for (let x = u.x0 + cell / 2; x < u.x1; x += cell) if (Math.abs(x - w.x) < R) mark(x, u.deckY, false);
    }
    for (const [k, v] of cells) {
      const [i, j] = k.split(',').map(Number), x = ox + i * cell, y = oy + j * cell, f = fade(x + cell / 2, y + cell / 2);
      if (f <= 0) continue;
      g.fillStyle(v === 2 ? 0xffd27a : 0x3fe0d0, (v === 2 ? 0.6 : 0.32) * Math.max(f, v === 2 ? 0.7 : 0)).fillRect(x + 1 / z, y + 1 / z, cell - 2 / z, cell - 2 / z);
    }
    // the grid lines, each edge faded by its distance to AvA, and fine scan lines sweeping down
    const lw = 2.2 / z;
    for (let i = i0; i <= i1; i++) for (let j = j0; j < j1; j++) {
      const x = ox + i * cell, y = oy + j * cell, f = fade(x, y + cell / 2);
      if (f > 0.02) g.lineStyle(lw, 0x3fe0d0, A * f).lineBetween(x, y, x, y + cell);
    }
    for (let j = j0; j <= j1; j++) for (let i = i0; i < i1; i++) {
      const x = ox + i * cell, y = oy + j * cell, f = fade(x + cell / 2, y);
      if (f > 0.02) g.lineStyle(lw, 0x3fe0d0, A * f).lineBetween(x, y, x + cell, y);
    }
    const sweep = ((time / 1400) % 1) * 2 * R - R;
    for (let y = -R; y <= R; y += 6 / z) {
      if (w.y + y > oy) break;
      const f = fade(w.x, w.y + y), boost = Math.max(0, 1 - Math.abs(y - sweep) / (R * 0.12));
      if (f > 0.02) g.lineStyle(1 / z, 0x3fe0d0, (0.05 + 0.25 * boost) * A * f).lineBetween(w.x - Math.sqrt(Math.max(0, R * R - y * y)) * 0.9, w.y + y, w.x + Math.sqrt(Math.max(0, R * R - y * y)) * 0.9, w.y + y);
    }
  }
}

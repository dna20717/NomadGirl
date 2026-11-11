// Soft fog of war (Daniel, 11.11.2026: 1A „was Leyla einmal gesehen hat, bleibt aufgedeckt“, aber sinnvoll: nichts wird schwarz,
// nur weil es nicht erreichbar ist; 2A dunkler Dunst, Umrisse bleiben erkennbar; 4A hinter Secrets dicht).
// Only indoors (Raum-Bausteine › Innenraum, tunnel) and only over air Leyla can actually reach; walls take the fog of their air.
// One pixel per tile in a canvas, drawn smoothed over the world: soft edges. Sight lines from Leyla's eyes reveal, the reveal fades in.
import { SOLID_TILES } from '../../engine/room.js';

export class Fog {
  constructor(scene) {
    const s = scene, R = s.room, F = s.data_.game?.fog || {};
    this.scene = s; this.F = F;
    // under a camouflage cover (art.js) the secret already looks like solid wall: no fog there until it is found or broken
    this.covers = R ? (s.camo || []).map(c => ({ c, cells: new Set((c.cover || []).map(([x, y]) => y * R.w + x)) })) : [];
    this.on = F.enabled !== false && s.mode !== 'camp' && !!R?.start;
    if (!this.on) return;
    const w = R.w, h = R.h, inside = (x, y) => s.terrain?.inside?.(x, y) ?? false;
    const pass = (x, y) => { const t = R.tiles[y]?.[x]; return t != null && (!SOLID_TILES.has(t) || t === 'D') && t !== '%'; };
    // reachable without secrets, then with them
    const flood = (seeds, ok) => { const set = new Set(seeds.map(([x, y]) => x + ',' + y)), q = [...seeds]; while (q.length) { const [x, y] = q.pop(); for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { const k = nx + ',' + ny; if (!set.has(k) && ok(nx, ny)) { set.add(k); q.push([nx, ny]); } } } return set; };
    const normal = flood([R.start], pass);
    const any = flood([R.start], (x, y) => { const t = R.tiles[y]?.[x]; return t != null && (pass(x, y) || t === '%' || t === '$' || t === 'B'); });
    this.kind = new Uint8Array(w * h);   // 0 nothing, 1 normal air, 2 secret air, 3 wall
    let cells = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = x + ',' + y, i = y * w + x;
      if (!inside(x, y)) continue;
      if (normal.has(k)) { this.kind[i] = 1; cells++; } else if (any.has(k) && pass(x, y)) { this.kind[i] = 2; cells++; }
    }
    this.on = cells > 0;
    if (!this.on) return;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {   // walls next to fogged air
      const i = y * w + x;
      if (this.kind[i] || pass(x, y)) continue;
      for (let dy = -1; dy <= 1 && !this.kind[i]; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (y + dy) * w + x + dx; if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h && (this.kind[j] === 1 || this.kind[j] === 2)) { this.kind[i] = 3; break; } }
    }
    this.w = w; this.h = h;
    this.seen = new Uint8Array(w * h);
    this.alpha = new Float32Array(w * h);
    const dens = (F.density ?? 82) / 100, sec = (F.secretDensity ?? 97) / 100;
    for (let i = 0; i < w * h; i++) this.alpha[i] = this.kind[i] === 1 ? dens : this.kind[i] === 2 ? sec : 0;
    this.tex = s.textures.createCanvas('fog_' + Date.now(), w, h);
    this.ctx = this.tex.getContext();
    this.img = this.ctx.createImageData(w, h);
    const col = parseInt(String(F.color || '#07060c').slice(1), 16);
    this.rgb = [col >> 16 & 255, col >> 8 & 255, col & 255];
    this.sprite = s.add.image(0, 0, this.tex.key).setOrigin(0).setDisplaySize(w * s.T, h * s.T).setDepth(15.5);
    this.next = 0;
    this.reveal(true);
    this.draw(1);
  }

  opaque(x, y) {
    const t = this.scene.room.tiles[y]?.[x];
    if (t == null) return true;
    if (t === '%') return !!this.scene.level?.hides(x, y);
    return SOLID_TILES.has(t);
  }
  // sight lines from Leyla's eyes (Spiel › Nebel › Sicht in tiles); a wall that stops a line is seen too
  reveal(force = false) {
    if (!this.on) return;
    const s = this.scene, l = s.leyla, T = s.T, now = s.now ?? 0;
    if (!force && now < this.next) return;
    this.next = now + 90;
    const r = (this.F.sight ?? 11) * T, ex = l.x, ey = l.feet - l.height * 0.75, w = this.w, rays = 160, step = T / 3;
    const mark = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < this.h) this.seen[y * w + x] = 1; };
    // close around her: always
    const cx = Math.floor(l.x / T), cy = Math.floor((l.feet - 4) / T);
    for (let dy = -2; dy <= 0; dy++) for (let dx = -1; dx <= 1; dx++) mark(cx + dx, cy + dy);
    for (let a = 0; a < rays; a++) {
      const dx = Math.cos(a / rays * Math.PI * 2), dy = Math.sin(a / rays * Math.PI * 2);
      for (let d = 0; d <= r; d += step) {
        const tx = Math.floor((ex + dx * d) / T), ty = Math.floor((ey + dy * d) / T);
        mark(tx, ty);
        if (this.opaque(tx, ty)) break;
      }
    }
  }
  update(dt) {
    if (!this.on) return;
    this.reveal();
    this.draw(Math.min(1, dt / (this.F.fade ?? 450)));
  }
  // fade toward the target, walls follow the clearest air next to them
  draw(k) {
    const hidden = new Set();
    for (const { c, cells } of this.covers) if (c.rts?.[0]?.active && (c.rts[0].alpha ?? 1) > 0.5) for (const i of cells) hidden.add(i);
    const { w, h, kind, alpha, seen } = this, dens = (this.F.density ?? 82) / 100, sec = (this.F.secretDensity ?? 97) / 100, d = this.img.data;
    let changed = false;
    for (let i = 0; i < w * h; i++) {
      const kd = kind[i];
      if (kd !== 1 && kd !== 2) continue;
      const target = seen[i] ? 0 : kd === 1 ? dens : sec;
      if (alpha[i] !== target) { alpha[i] += Math.sign(target - alpha[i]) * Math.min(Math.abs(target - alpha[i]), k); changed = true; }
    }
    const sig = hidden.size;
    if (!changed && this.drawn && sig === this.sig) return;
    this.sig = sig;
    this.drawn = true;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let a = 0;
      if (hidden.has(i)) a = 0;
      else if (kind[i] === 1 || kind[i] === 2) a = alpha[i];
      else if (kind[i] === 3) {   // a wall: as clear as the clearest air beside it, a little lighter (outlines stay readable)
        a = 1;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (y + dy) * w + x + dx; if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h && (kind[j] === 1 || kind[j] === 2)) a = Math.min(a, alpha[j]); }
        a *= (this.F.walls ?? 80) / 100;
      }
      const o = i * 4;
      d[o] = this.rgb[0]; d[o + 1] = this.rgb[1]; d[o + 2] = this.rgb[2]; d[o + 3] = Math.round(a * 255);
    }
    this.ctx.putImageData(this.img, 0, 0);
    this.tex.refresh();
  }
  // a point under a camouflage cover that is still closed (lamps in secrets stay dark, game/play/atmosphere.js)
  hiddenAt(x, y) {
    const T = this.scene.T, i = Math.floor(y / T) * (this.scene.room.w) + Math.floor(x / T);
    return (this.covers || []).some(({ c, cells }) => c.rts?.[0]?.active && (c.rts[0].alpha ?? 1) > 0.5 && cells.has(i));
  }
  at(x, y) { const T = this.scene.T, i = Math.floor(y / T) * this.w + Math.floor(x / T); return this.on ? +(this.alpha[i] ?? 0).toFixed(2) : 0; }
  state() {
    if (!this.on) return { on: false };
    let seen = 0, total = 0;
    for (let i = 0; i < this.kind.length; i++) if (this.kind[i] === 1 || this.kind[i] === 2) { total++; if (this.seen[i]) seen++; }
    return { on: true, seen, total, secret: [...this.kind].filter(k => k === 2).length };
  }
}

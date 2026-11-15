// Decoration in the camp (#036): every piece of save.rig.decor drawn from code or from a cut-out of an existing picture, in strict
// side view on a 4 px grid with AAP-64 colours. Wall pieces sit on a container's outer wall and fade with it when it opens; roof
// pieces stand on top; ground pieces on the campsite; span pieces hang between two anchors (container corners, the mast, poles).
// Some move: neon flickers, banners and laundry sway, the windmill turns faster in gusts, the kettle steams, crows fly up when
// Leyla comes near. Mixed into Camp like CampLife (logic: game/decor.js).
import { decorDef, placeOf, plantStage, dstate } from '../decor.js';
import { catenary } from '../string_lights.js';
import { glowTexture } from './camp.js';
import { advance, clockText } from '../save.js';
import { ladderArt } from './ladder_art.js';

const PX = 4;
const col = c => parseInt(String(c || '#ff00ff').slice(1), 16);
const snap = v => Math.round(v / PX) * PX;
const C = { ink: '#141013', night: '#242234', violet: '#403353', grey: '#4a5462', steel: '#6d758d', silver: '#8b93af', pale: '#b3b9d1', white: '#dae0ea',
  mud: '#221c1a', brown: '#322b28', rust: '#71413b', copper: '#bb7547', sand: '#dba463', wood: '#5d4037', woodL: '#7a5a44', yellow: '#f9a31b', gold: '#ffd541', red: '#b4202a', green: '#59c135', leaf: '#328464', pot: '#8e5252' };
const hash = (...a) => { let h = 2166136261; for (const v of a) { h ^= Math.round(v * 97) & 0xffff; h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
const darker = (c, k = 0.6) => { const n = col(c); return ((Math.round(((n >> 16) & 255) * k)) << 16) | ((Math.round(((n >> 8) & 255) * k)) << 8) | Math.round((n & 255) * k); };

export class CampDecor {
  // ---------- where things go ----------
  decorUnit(ui) { return (this.geo.units || []).find(u => u.ui === ui) || null; }
  groundX(x) { return ((this.geo.campCol ?? 0) + x) * this.scene.T; }
  wallAt(ui, p) { const u = this.decorUnit(ui); return u && { u, x: u.in0 + (p + 0.5) * u.cell, y: u.inTop + (u.floorY - u.inTop) * 0.4 }; }
  roofAt(ui, p) { const u = this.decorUnit(ui); return u && { u, x: u.in0 + (p + 0.5) * u.cell, y: u.deckY ?? (u.inTop - 34) }; }
  // every point a span can hang on: container corners, the mast (string lights), and the tops of poles
  spanAnchors() {
    const out = this.geo.mega ? [] : [...(this.anchors?.() || [])], T = this.scene.T;
    (this.box.save.rig.decor || []).forEach((x, i) => {
      const d = decorDef(this.D, x.id);
      if (d?.art === 'pole') out.push({ id: `pole:${i}`, x: this.groundX(x.at.x), y: this.ground - (d.size?.[1] ?? 4) * T + 8 });
      if (d?.art === 'tower') out.push({ id: `tower:${i}`, x: this.groundX(x.at.x), y: this.ground - (d.size?.[1] ?? 4.5) * T, walk: true });
      if (d?.art === 'balcony') { const b = this.balconyAt(x.at.ui, x.at.side, d); if (b) out.push({ id: `balc:${i}`, x: b.tip, y: b.y, walk: true }); }
    });
    return out;
  }
  // a balcony at a unit's end: on the interior floor, as long as the free space allows (to the next box on that level)
  balconyAt(ui, side, d) {
    const u = this.decorUnit(ui), T = this.scene.T;
    if (!u) return null;
    const x0 = u.in0, x1 = u.in0 + u.cell * u.places, want = (d?.size?.[0] ?? 1.6) * T;
    const others = (this.geo.units || []).filter(o => o !== u && o.ui > 0 && Math.abs(o.floorY - u.floorY) < 40).map(o => side ? o.in0 : o.in0 + o.cell * o.places);
    const room = side ? Math.min(want, ...others.filter(x => x >= x1).map(x => x - x1 - 12)) : Math.min(want, ...others.filter(x => x <= x0).map(x => x0 - x - 12));
    if (room < T * 0.6) return null;
    return side ? { x0: x1, x1: x1 + room, tip: x1 + room - 6, y: u.floorY, u } : { x0: x0 - room, x1: x0, tip: x0 - room + 6, y: u.floorY, u };
  }
  spanPoint(id) { return this.spanAnchors().find(a => a.id === id) || null; }
  // candidate places for a piece of this kind (build mode): [{ at, x, y, label }]
  decorSpots(id) {
    const D = this.D, kind = placeOf(D, id), T = this.scene.T, out = [], save = this.box.save, used = new Set((save.rig.decor || []).map(x => JSON.stringify({ ...x.at, day: undefined })));
    if (kind === 'ground') {
      const [a, b] = D.camp?.decor?.ground || [-4, 20], step = 0.5;
      for (let x = a; x <= b; x += step) {
        const gx = this.groundX(x);
        if (this.geo.shaft && gx < (this.geo.shaft.to + 1) * T) continue;
        out.push({ at: { x }, x: gx, y: this.ground - 10, label: 'Hier hinstellen' });
      }
    } else if (kind === 'side') {
      if (this.geo.mega) return out;
      for (const u of this.geo.units || []) for (const side of [0, 1]) {
        if (u.ui === 0 || used.has(JSON.stringify({ ui: u.ui, side }))) continue;
        const b = this.balconyAt(u.ui, side, decorDef(D, id));
        if (b) out.push({ at: { ui: u.ui, side }, x: (b.x0 + b.x1) / 2, y: b.y, label: 'Balkon hier' });
      }
    } else if (kind === 'wall' || kind === 'roof') {
      if (this.geo.mega) return out;
      for (const u of this.geo.units || []) {
        if (u.ui === 0) continue;
        for (let p = 0; p < (u.places || 0); p++) {
          if (used.has(JSON.stringify({ ui: u.ui, p }))) continue;
          if (kind === 'roof' && (save.rig.units[u.ui + 1]?.level || 0) > (save.rig.units[u.ui]?.level || 0)) continue;   // something stands on it
          const q = kind === 'wall' ? this.wallAt(u.ui, p) : this.roofAt(u.ui, p);
          out.push({ at: { ui: u.ui, p }, x: q.x, y: q.y, label: kind === 'wall' ? 'An die Wand' : 'Aufs Dach' });
        }
      }
    }
    return out;
  }

  // ---------- drawing ----------
  drawDecor() {
    const R = dstate(this.box.save);
    this.walkTops = [];
    this.decorAnim = [];
    this.crows?.forEach(c => c.o.destroy()); this.crows = [];
    R.decor.forEach((x, i) => { try { this.drawPiece(x, i); } catch (e) { console.warn('Deko', x.id, e); } });
    if (R.decor.some(x => decorDef(this.D, x.id)?.art === 'birdhouse')) this.spawnCrows();
    this.drawRainBits();
  }
  dAdd(o) { this.rigObjs.push(o); return o; }
  shellOf(u) { return (this.shells || []).find(c => c.u === u) || null; }
  drawPiece(x, i) {
    const s = this.scene, D = this.D, d = decorDef(D, x.id), T = s.T;
    if (!d) return;
    const kind = d.place || 'ground', [sw, sh] = d.size || [1, 1], w = sw * T, h = sh * T, at = x.at || {};
    const seed = hash(i, at.x ?? 0, at.ui ?? 0, at.p ?? 0);
    const pick = list => { const L = String(list || '').split(/[|,]/).map(t => t.trim()).filter(Boolean); return L.length ? L[Math.floor(seed * L.length) % L.length] : ''; };
    if (kind === 'span') {
      const a = this.spanPoint(at.a), b = this.spanPoint(at.b);
      if (!a || !b) return;
      const [p, q] = a.x <= b.x ? [a, b] : [b, a];
      return this[`art_${d.art}`]?.(p, q, d, seed, pick);
    }
    if (kind === 'side') { const b = this.balconyAt(at.ui, at.side, d); if (b) this.art_balcony(b, d, seed, at.side); return; }
    let pos;
    if (kind === 'ground') pos = { x: this.groundX(at.x), y: this.ground };
    else if (kind === 'wall') pos = this.wallAt(at.ui, at.p);
    else pos = this.roofAt(at.ui, at.p);
    if (!pos) return;
    const before = new Set(s.children.list);
    this[`art_${d.art}`]?.(pos.x, pos.y, w, h, d, seed, pick, x);
    // wall pieces belong to the container's skin: they fade when it opens (like the workshops' outside pictures)
    if (kind === 'wall' && pos.u) { const sh0 = this.shellOf(pos.u); if (sh0) for (const o of s.children.list) if (!before.has(o) && o.setAlpha) sh0.extras.push(o); }
  }
  dG(depth) { return this.dAdd(this.scene.add.graphics().setDepth(depth)); }
  dR(g, x, y, w, h, c, a = 1) { g.fillStyle(col(c), a).fillRect(snap(x), snap(y), Math.max(PX, snap(w)), Math.max(PX, snap(h))); }

  // ---- wall ----
  art_neon(x, y, w, h, d, seed, pick) {
    const s = this.scene, text = pick(d.text) || 'OPEN', c = d.color || '#ff7ac0', g = this.dG(-19.2), fs = Math.round(h * 0.82);
    this.dR(g, x - w / 2 - PX, y - h / 2 - PX, w + 2 * PX, h + 2 * PX, C.ink);
    this.dR(g, x - w / 2, y - h / 2, w, h, C.night);
    for (const sx of [x - w / 2 + 2 * PX, x + w / 2 - 3 * PX]) this.dR(g, sx, y - h / 2 - 4 * PX, PX, 4 * PX, C.steel);   // wires up
    const t = this.dAdd(s.add.text(x, y, text, { fontFamily: 'VT323, monospace', fontSize: `${fs}px`, color: c, stroke: '#ffffff', strokeThickness: 1 }).setOrigin(0.5).setDepth(-19.1));
    t.setShadow(0, 0, c, 14, true, true);
    // at night the tubes shine through the dark (a glowing copy above the night shade, like the lights)
    const lit = this.dAdd(s.add.text(x, y, text, { fontFamily: 'VT323, monospace', fontSize: `${fs}px`, color: c }).setOrigin(0.5).setDepth(30.6).setBlendMode(Phaser.BlendModes.ADD));
    lit.setShadow(0, 0, c, 10, true, true);
    const glow = this.dAdd(s.add.image(x, y, glowTexture(s)).setDisplaySize(w * 1.6, h * 1.8).setTint(col(c)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(-19.15));
    const l = this.light(x, y + h, w * 0.9, c, 0.5); l.rig = true;
    this.decorAnim.push(time => { const off = Math.sin(time / 130 + seed * 40) > 0.985 || (seed > 0.6 && Math.sin(time / 47 + seed * 9) > 0.97), k = t.alpha > 0.01 ? 1 : 0; lit.setAlpha(k * (off ? 0.15 : 0.9) * (this.lightK || 0)); glow.setAlpha(k * (off ? 0.04 : 0.1 + 0.25 * (this.lightK || 0))); });
  }
  art_banner(x, y, w, h, d, seed) {
    const s = this.scene, c = d.color || '#b4202a', g = s.add.graphics(), top = -h / 2;
    this.dR(g, -w / 2 - 2 * PX, top - PX, w + 4 * PX, 2 * PX, C.ink); this.dR(g, -w / 2 - 2 * PX, top - PX, w + 4 * PX, PX, C.steel);   // the rod
    g.fillStyle(col(C.ink)).fillPoints([{ x: -w / 2 - PX, y: top }, { x: w / 2 + PX, y: top }, { x: w / 2 + PX, y: top + h + PX }, { x: 0, y: top + h * 0.82 }, { x: -w / 2 - PX, y: top + h + PX }], true);
    g.fillStyle(col(c)).fillPoints([{ x: -w / 2, y: top + PX }, { x: w / 2, y: top + PX }, { x: w / 2, y: top + h - PX }, { x: 0, y: top + h * 0.8 }, { x: -w / 2, y: top + h - PX }], true);
    g.fillStyle(darker(c, 0.7)).fillRect(-w / 2, top + PX, 2 * PX, h * 0.8).fillRect(w / 2 - 2 * PX, top + PX, 2 * PX, h * 0.8);   // folds
    const m = { x: 0, y: top + h * 0.38 }, k = w * 0.3;
    if (d.text === 'skull') {   // a pixel skull
      g.fillStyle(0xf2e3c4).fillRect(m.x - k * 0.6, m.y - k * 0.7, k * 1.2, k * 0.9).fillRect(m.x - k * 0.4, m.y + k * 0.2, k * 0.8, k * 0.35);
      g.fillStyle(col(C.ink)).fillRect(m.x - k * 0.4, m.y - k * 0.35, k * 0.28, k * 0.3).fillRect(m.x + k * 0.12, m.y - k * 0.35, k * 0.28, k * 0.3).fillRect(m.x - k * 0.06, m.y + k * 0.02, k * 0.12, k * 0.15);
    } else {   // the triangle of the world
      g.fillStyle(0xf9a31b).fillTriangle(m.x - k, m.y + k * 0.8, m.x, m.y - k * 0.9, m.x + k, m.y + k * 0.8);
      g.fillStyle(col(c)).fillTriangle(m.x - k * 0.5, m.y + k * 0.55, m.x, m.y - k * 0.25, m.x + k * 0.5, m.y + k * 0.55);
    }
    const box = this.dAdd(s.add.container(x, y - h * 0 + 0, [g]).setDepth(-19.2));
    this.decorAnim.push(time => { box.angle = Math.sin(time / 900 + seed * 7) * 1.6; });
  }
  art_graffiti(x, y, w, h, d, seed, pick) {
    const s = this.scene, c = pick(d.colors) || '#ff7ac0', text = pick(d.text) || 'LEYLA', fs = Math.round(h * 0.75);
    y += h * 1.1;   // low on the wall, under the workshop's outside picture
    const t = this.dAdd(s.add.text(x, y, text, { fontFamily: 'VT323, monospace', fontSize: `${fs}px`, color: c, stroke: '#' + darker(c, 0.45).toString(16).padStart(6, '0'), strokeThickness: 5 })
      .setOrigin(0.5).setAngle((seed - 0.5) * 9).setDepth(-19.25).setAlpha(0.88));
    const g = this.dG(-19.26), n = 3 + Math.floor(seed * 4);   // drips
    for (let k = 0; k < n; k++) { const dx = (hash(seed, k) - 0.5) * t.width * 0.9, len = 6 + hash(k, seed) * 26; this.dR(g, x + dx, y + fs * 0.25, PX, len, c, 0.75); }
  }
  art_addon(x, y, w, h, d, seed, pick, it) {
    const s = this.scene, A = this.D.rigAddons?.[d.addon];
    if (!A?.look || !s.textures.exists(A.look)) return;
    const tex = s.textures.get(A.look), name = `dc:${A.crop.at.join(',')}:${A.crop.size.join(',')}`;
    if (!tex.has(name)) tex.add(name, 0, A.crop.at[0], A.crop.at[1], A.crop.size[0], A.crop.size[1]);
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const place = d.place || 'ground', depth = place === 'wall' ? -19.2 : -16;
    const n = d.art === 'addon' && place === 'ground' && /rad/.test(d.addon) ? 2 : 1;   // tyres come in a stack
    for (let k = 0; k < n; k++) this.dAdd(s.add.image(x + (k ? (seed - 0.5) * w * 0.2 : 0), y - k * h * 0.55, A.look, name).setOrigin(0.5, place === 'wall' ? 0.5 : 1).setDisplaySize(w, h).setDepth(depth - k * 0.001));
  }
  // ---- ground ----
  art_trophies(x, y, w, h, d, seed) {
    const s = this.scene, g = this.dG(-16), ch = h * 0.55;
    this.dR(g, x - w / 2 - PX, y - ch - PX, w + 2 * PX, ch + PX, C.ink);
    this.dR(g, x - w / 2, y - ch, w, ch, C.wood); this.dR(g, x - w / 2, y - ch, w, PX, C.woodL);
    for (const k of [0.33, 0.66]) this.dR(g, x - w / 2 + w * k, y - ch, PX, ch, C.brown);
    this.dR(g, x - w / 2, y - ch * 0.5, w, PX, C.brown);
    const list = (d.items || []).filter(id => this.D.items?.[id]).slice(0, 4), cell = Math.min(w / Math.max(1, list.length), h * 0.6);
    list.forEach((id, k) => {
      const t = this.D.items[id], A = this.D.assets?.[t.look];
      if (!A || !s.textures.exists(t.look)) return;
      s.textures.get(t.look).setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.dAdd(s.add.image(x - w / 2 + cell * (k + 0.5) + (w - cell * list.length) / 2, y - ch + 2, t.look, t.icon).setOrigin(0.5, 1).setDisplaySize(cell * 0.92, cell * 0.92).setDepth(-15.9));
    });
  }
  art_plant(x, y, w, h, d, seed, pick, it) {
    const g = this.dG(d.place === 'roof' ? -16.5 : -16), st = plantStage(this.D, this.box.save, it), c = d.color || C.green, cactus = /kaktus/i.test(d.name || '');
    const pw = w * 0.7, ph = h * 0.35;
    this.dR(g, x - pw / 2 - PX, y - ph - PX, pw + 2 * PX, ph + PX, C.ink);
    this.dR(g, x - pw / 2, y - ph, pw, ph, cactus ? C.steel : C.pot); this.dR(g, x - pw / 2, y - ph, pw, PX, cactus ? C.pale : C.copper);
    const stem = ph + h * 0.18 * (st + 1);
    if (cactus) {
      this.dR(g, x - 2 * PX, y - stem - PX, 4 * PX, stem - ph + PX, C.ink); this.dR(g, x - PX, y - stem, 2 * PX, stem - ph, c);
      if (st >= 1) { this.dR(g, x - 4 * PX, y - stem * 0.7, 2 * PX, 2 * PX, c); this.dR(g, x - 4 * PX, y - stem * 0.85, PX, 2 * PX, c); }
      if (st >= 2) { this.dR(g, x + 2 * PX, y - stem * 0.8, 2 * PX, 2 * PX, c); this.dR(g, x + 3 * PX, y - stem * 0.95, PX, 2 * PX, c); }
      if (st >= 3) this.dR(g, x - PX, y - stem - 2 * PX, 2 * PX, 2 * PX, '#f5a097');
      return;
    }
    this.dR(g, x - PX / 2, y - stem, PX, stem - ph, C.leaf);
    for (let k = 0; k <= st; k++) { const ly = y - ph - (stem - ph) * (k + 0.6) / (st + 1.4), side = k % 2 ? 1 : -1; this.dR(g, x + side * PX * (side > 0 ? 1 : 3), ly, 3 * PX, 2 * PX, c); this.dR(g, x + side * PX * (side > 0 ? 3 : 4), ly - PX, PX, PX, C.leaf); }
    if (st >= 3) { const fc = ['#e86a73', '#ffd541', '#bc4a9b'][Math.floor(seed * 3)]; this.dR(g, x - 2 * PX, y - stem - 2 * PX, 4 * PX, 3 * PX, fc); this.dR(g, x - PX / 2, y - stem - PX, PX, PX, C.gold); }
  }
  art_tripod(x, y, w, h, d, seed) {
    const s = this.scene, g = this.dG(-14), top = y - h;
    g.lineStyle(2 * PX, col(C.ink)).lineBetween(x - w / 2, y, x, top).lineBetween(x + w / 2, y, x, top);
    g.lineStyle(PX, col(C.woodL)).lineBetween(x - w / 2, y, x, top).lineBetween(x + w / 2, y, x, top);
    this.dR(g, x - PX / 2, top, PX, h * 0.38, C.steel);   // the chain
    const ky = top + h * 0.38, kw = w * 0.5, kh = h * 0.28;
    g.fillStyle(col(C.ink)).fillEllipse(x, ky + kh / 2, kw + 2 * PX, kh + PX);
    g.fillStyle(col(C.grey)).fillEllipse(x, ky + kh / 2, kw, kh - PX);
    this.dR(g, x - kw / 2, ky, kw, PX, C.silver);
    const puffs = [];
    for (let k = 0; k < 4; k++) puffs.push(this.dAdd(s.add.image(x, ky, glowTexture(s)).setDisplaySize(26, 26).setTint(0xdae0ea).setAlpha(0).setDepth(-13.9)));
    this.decorAnim.push(time => puffs.forEach((p, k) => { const t = ((time / 2400 + k / 4 + seed) % 1); p.setPosition(x + Math.sin(t * 6 + k) * 10, ky - t * 110).setAlpha(0.35 * (1 - t)).setDisplaySize(18 + t * 40, 18 + t * 40); }));
  }
  art_lantern(x, y, w, h, d) {
    const s = this.scene, g = this.dG(-16), c = d.color || '#ffd27a';
    this.dR(g, x - PX, y - h, 2 * PX, h, C.ink); this.dR(g, x - PX / 2, y - h, PX, h, C.steel);
    this.dR(g, x - 3 * PX, y - h + PX, 6 * PX, 2 * PX, C.ink);
    this.dR(g, x - 4 * PX, y - h + 3 * PX, 8 * PX, 8 * PX, C.ink); this.dR(g, x - 3 * PX, y - h + 4 * PX, 6 * PX, 6 * PX, c);
    this.dR(g, x - 3 * PX, y - h + 4 * PX, PX, 6 * PX, '#ffffff', 0.5);
    const l = this.light(x, y - h + 7 * PX, 180, c, 0.75); l.rig = true;
    this.decorAnim.push(time => l.setAlpha(l.base * this.lightK * (0.88 + 0.12 * Math.sin(time / 170))));
  }
  art_pole(x, y, w, h) {
    const g = this.dG(-16.2);
    this.dR(g, x - 2 * PX, y - h, 4 * PX, h, C.ink); this.dR(g, x - PX, y - h, 2 * PX, h, C.woodL); this.dR(g, x - PX, y - h, PX, h, C.sand, 0.5);
    this.dR(g, x - 3 * PX, y - h - PX, 6 * PX, 3 * PX, C.steel);   // the ring on top
    g.lineStyle(PX, col(C.brown), 0.8).lineBetween(x, y - h + 2 * PX, x - h * 0.35, y).lineBetween(x, y - h + 2 * PX, x + h * 0.35, y);   // guy ropes
    this.dR(g, x - h * 0.35 - PX, y - 2 * PX, 2 * PX, 2 * PX, C.ink); this.dR(g, x + h * 0.35 - PX, y - 2 * PX, 2 * PX, 2 * PX, C.ink);
  }
  // ---- roof ----
  art_windmill(x, y, w, h, d, seed) {
    const s = this.scene, g = this.dG(-16.4), hub = { x, y: y - h * 0.82 };
    this.dR(g, x - PX, hub.y, 2 * PX, y - hub.y, C.ink); this.dR(g, x - PX / 2, hub.y, PX, y - hub.y, C.steel);
    this.dR(g, x - 3 * PX, y - 2 * PX, 6 * PX, 2 * PX, C.ink);
    this.dR(g, x + 2 * PX, hub.y - 2 * PX, 6 * PX, 3 * PX, C.ink); this.dR(g, x + 8 * PX, hub.y - 4 * PX, 2 * PX, 7 * PX, C.yellow);   // tail vane
    const blades = s.add.graphics(), L = w * 0.55;
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; blades.lineStyle(3 * PX, col(C.ink)).lineBetween(0, 0, Math.cos(a) * L, Math.sin(a) * L); blades.lineStyle(PX * 1.6, col(k % 2 ? d.color || C.white : C.red)).lineBetween(0, 0, Math.cos(a) * (L - PX), Math.sin(a) * (L - PX)); }
    blades.fillStyle(col(C.ink)).fillCircle(0, 0, 2 * PX).fillStyle(col(C.silver)).fillCircle(0, 0, PX);
    const box = this.dAdd(s.add.container(hub.x, hub.y, [blades]).setDepth(-16.3));
    let spin = 0;
    this.decorAnim.push((time, dt) => { const gust = this.gustAt && this.gustAt - time < 1500 && this.gustAt > time ? 3 : 1; spin += dt / 1000 * (1.2 + Math.sin(time / 4000 + seed * 9) * 0.6) * gust; box.rotation = spin; });
  }
  art_birdhouse(x, y, w, h) {
    const g = this.dG(-16.4), bw = w * 0.9, bh = h * 0.4, by = y - h;
    this.dR(g, x - PX, by + bh, 2 * PX, h - bh, C.ink); this.dR(g, x - PX / 2, by + bh, PX, h - bh, C.woodL);
    g.fillStyle(col(C.ink)).fillTriangle(x - bw / 2 - 2 * PX, by + PX, x, by - bh * 0.6, x + bw / 2 + 2 * PX, by + PX);
    g.fillStyle(col(C.rust)).fillTriangle(x - bw / 2, by, x, by - bh * 0.5, x + bw / 2, by);
    this.dR(g, x - bw / 2, by, bw, bh, C.wood); this.dR(g, x - bw / 2, by, bw, PX, C.woodL);
    this.dR(g, x - PX, by + bh * 0.35, 2 * PX, 2 * PX, C.ink);
    (this.perches ??= []).push({ x, y: by - bh * 0.5 });
  }
  // crows sit on roofs and anchors; within 260 px of Leyla they fly up and come back later
  spawnCrows() {
    const s = this.scene, spots = [...(this.perches || []), ...(this.anchors?.() || []).map(a => ({ x: a.x, y: a.y - 6 }))].slice(0, 6), n = Math.min(4, spots.length);
    if (!s.textures.exists('crow')) {
      const t = s.textures.createCanvas('crow', 10, 8), c = t.getContext(), p = (x, y, w, h, f) => { c.fillStyle = f; c.fillRect(x, y, w, h); };
      p(2, 2, 5, 4, '#141013'); p(6, 1, 3, 3, '#141013'); p(9, 2, 1, 1, '#f9a31b'); p(0, 3, 3, 2, '#141013'); p(3, 6, 1, 2, '#4a5462'); p(5, 6, 1, 2, '#4a5462'); p(3, 3, 3, 1, '#403353'); p(7, 2, 1, 1, '#dae0ea');
      t.refresh(); t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    for (let k = 0; k < n; k++) {
      const sp = spots[(k * 3) % spots.length], o = this.dAdd(s.add.image(sp.x + (k - 1) * 10, sp.y, 'crow').setOrigin(0.5, 1).setScale(PX).setFlipX(k % 2 === 1).setDepth(-15));
      this.crows.push({ o, home: { x: o.x, y: o.y }, away: 0 });
    }
    this.perches = [];
  }
  updateCrows(time) {
    const l = this.scene.leyla;
    for (const c of this.crows || []) {
      const near = l && Math.hypot(l.x - c.home.x, (l.feet ?? l.y) - c.home.y) < 260;
      if (near && !c.away) { c.away = time; this.scene.tweens.add({ targets: c.o, x: c.home.x + (Math.random() > 0.5 ? 600 : -600), y: c.home.y - 500, duration: 1600, ease: 'Quad.easeIn' }); }
      else if (!near && c.away && time - c.away > 9000) { c.away = 0; c.o.setPosition(c.home.x + 400, c.home.y - 300); this.scene.tweens.add({ targets: c.o, x: c.home.x, y: c.home.y, duration: 1800, ease: 'Quad.easeOut' }); }
      if (!c.away && Math.sin(time / 700 + c.home.x) > 0.995) c.o.setFlipX(!c.o.flipX);   // looks around now and then
    }
  }
  // ---- spans (p left, q right) ----
  art_line(p, q, d, seed) {
    const s = this.scene, g = this.dG(-15.5), cat = catenary(p, q, 30, 40), cols = String(d.colors || '#e86a73').split(',').map(t => t.trim());
    g.lineStyle(3, 0x141013, 0.9).beginPath(); g.moveTo(cat.line[0].x, cat.line[0].y); for (const pt of cat.line) g.lineTo(pt.x, pt.y); g.strokePath();
    const cloth = [];
    cat.bulbs.forEach((b, k) => {
      if (hash(seed, k) < 0.18) return;
      const c = cols[k % cols.length], w = 18 + hash(k, seed) * 18, h = 22 + hash(seed + 1, k) * 26, gg = s.add.graphics();
      gg.fillStyle(0x141013).fillRect(-w / 2 - 2, 0, w + 4, h + 2).fillStyle(col(c)).fillRect(-w / 2, 2, w, h - 2).fillStyle(darker(c, 0.75)).fillRect(-w / 2, h - 6, w, 4);
      gg.fillStyle(0xdae0ea).fillRect(-w / 2 + 2, -2, 3, 5).fillRect(w / 2 - 5, -2, 3, 5);   // pegs
      cloth.push(this.dAdd(s.add.container(b.x, b.y - 2, [gg]).setDepth(-15.45)));
    });
    this.decorAnim.push(time => cloth.forEach((c, k) => { c.angle = Math.sin(time / 700 + k * 1.3 + seed * 5) * (this.gustAt && this.gustAt - time < 1500 && this.gustAt > time ? 14 : 5); }));
  }
  // a cloth hanging between two points: top edge sagging a little, depth `drop`, vertical stripes; used by sail and hammock
  decorCloth(p, q, drop, sagTop, sagBottom, colors, depth) {
    const g = this.dG(depth), cols = String(colors || '#f9a31b,#f2e3c4').split(',').map(t => t.trim()), n = Math.max(6, Math.round((q.x - p.x) / 16));
    const at = (t, sag) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t + sag * 4 * t * (1 - t) });
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, a = at(t0, sagTop), b = at(t1, sagTop), c = at(t1, sagBottom + drop), e = at(t0, sagBottom + drop);
      c.y = Math.max(c.y, b.y + 4); e.y = Math.max(e.y, a.y + 4);
      g.fillStyle(col(cols[Math.floor(k / 2) % cols.length])).fillPoints([a, b, c, e], true);
    }
    g.lineStyle(PX, 0x141013, 0.9).beginPath(); for (let k = 0; k <= n; k++) { const pt = at(k / n, sagTop); k ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y); } g.strokePath();
    g.lineStyle(PX, 0x141013, 0.9).beginPath(); for (let k = 0; k <= n; k++) { const pt = at(k / n, sagBottom + drop); pt.y = Math.max(pt.y, at(k / n, sagTop).y + 4); k ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y); } g.strokePath();
    return g;
  }
  art_sail(p, q, d) { const T = this.scene.T, drop = (d.size?.[1] ?? 1.2) * T; this.decorCloth(p, q, drop, 14, 40 + drop * 0.3, d.colors, -15.6); }
  art_hammock(p, q, d) {
    const T = this.scene.T, len = Math.hypot(q.x - p.x, q.y - p.y), g = this.dG(-15.55), sag = Math.min(2.2 * T, 30 + len * 0.18);
    g.lineStyle(PX * 0.75, col(C.sand)).lineBetween(p.x, p.y, p.x + (q.x - p.x) * 0.18, p.y + sag * 0.55).lineBetween(q.x, q.y, q.x - (q.x - p.x) * 0.18, q.y + sag * 0.55);
    this.decorCloth({ x: p.x + (q.x - p.x) * 0.15, y: p.y + sag * 0.5 }, { x: q.x - (q.x - p.x) * 0.15, y: q.y + sag * 0.5 }, 16, sag * 0.9, sag * 0.9, d.colors, -15.5);
    // E under it: an hour in the hammock (heals a little, Gemütlichkeit makes the next buff stronger)
    const mx = (p.x + q.x) / 2, low = Math.max(p.y, q.y) + sag;
    this.hotspots.push({ rig: true, x: mx, w: Math.max(80, (q.x - p.x) / 3), top: this.ground - low < 260 ? undefined : low, name: d.name || 'Hängematte', hint: 'Abhängen', act: () => this.hammockRest(d) });
  }
  hammockRest(d) {
    const s = this.scene, save = this.box.save, heal = d.heal ?? 15, max = s.leyla.maxHealth;
    s.hud.menu({ title: d.name || 'Hängematte', sub: `Eine Stunde abhängen. Heilt ${heal} %.`, items: [
      { label: 'Abhängen', primary: true, act: () => { advance(save, 1); save.health = Math.min(max, Math.max(save.health, s.leyla.health) + max * heal / 100); s.box.persist?.(); s.goCamp({ banner: ['Kurz abgehangen', clockText(save)], fade: 600, keepPlace: true }); } },
      { label: 'Zurück', act: () => {} }] });
  }
  // the big tent (Daniel: „große Zelte zwischen zwei Containern“): the ridge hangs between the two points, the walls reach down to the
  // ground and out on both sides; a dark entrance in the middle, guy ropes, a warm glow inside at night
  art_tent(p, q, d, seed) {
    const s = this.scene, T = s.T, G = this.ground, g = this.dG(-17.2), cols = String(d.colors || '#8e5252,#c7b08b').split(',').map(t => t.trim());
    const ridge = t => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t + Math.min(40, (q.x - p.x) * 0.05) * 4 * t * (1 - t) });
    const spread = Math.max(T, (G - Math.min(p.y, q.y)) * 0.35), L = { x: p.x - spread, y: G }, R = { x: q.x + spread, y: G }, n = Math.max(6, Math.round((R.x - L.x) / 22));
    // the front: strips from the ridge (or the slope) down to the ground
    const roofAt = x => x < p.x ? p.y + (G - p.y) * (p.x - x) / spread : x > q.x ? q.y + (G - q.y) * (x - q.x) / spread : ridge((x - p.x) / Math.max(1, q.x - p.x)).y;
    for (let k = 0; k < n; k++) {
      const x0 = L.x + (R.x - L.x) * k / n, x1 = L.x + (R.x - L.x) * (k + 1) / n;
      g.fillStyle(col(cols[k % cols.length])).fillPoints([{ x: x0, y: roofAt(x0) }, { x: x1, y: roofAt(x1) }, { x: x1, y: G }, { x: x0, y: G }], true);
      g.fillStyle(0x000000, 0.12 + 0.1 * ((k / n) > 0.5 ? 1 : 0)).fillRect(x0, roofAt(x0) + 6, x1 - x0, G - roofAt(x0) - 6);   // a soft shade on one side
    }
    // the entrance
    const mx = (p.x + q.x) / 2, eh = Math.min(G - ridge(0.5).y - T * 0.4, 3.2 * T), ew = eh * 0.6;
    g.fillStyle(0x141013).fillTriangle(mx - ew / 2, G, mx, G - eh, mx + ew / 2, G);
    g.fillStyle(0x2b1a10).fillTriangle(mx - ew / 2 + 6, G, mx, G - eh + 14, mx + ew / 2 - 6, G);
    // outline, the ridge, the poles at the ends, ropes and pegs
    g.lineStyle(PX, 0x141013, 1).beginPath(); g.moveTo(L.x, L.y); g.lineTo(p.x, p.y); for (let k = 1; k <= 12; k++) { const pt = ridge(k / 12); g.lineTo(pt.x, pt.y); } g.lineTo(R.x, R.y); g.strokePath();
    for (const [a, sx] of [[p, -1], [q, 1]]) { g.lineStyle(PX * 0.75, col(C.sand), 0.9).lineBetween(a.x, a.y, a.x + sx * spread * 1.4, G); this.dR(g, a.x + sx * spread * 1.4 - PX, G - 2 * PX, 2 * PX, 2 * PX, C.ink); }
    const glow = this.dAdd(s.add.image(mx, G - eh * 0.3, glowTexture(s)).setDisplaySize(ew * 2.2, eh * 1.3).setTint(0xffb347).setBlendMode(Phaser.BlendModes.ADD).setDepth(-17.1).setAlpha(0.6 * (this.lightK || 0)));
    this.decorAnim.push(time => glow.setAlpha((this.lightK || 0) * (0.5 + 0.1 * Math.sin(time / 230 + seed * 5))));
  }

  // ---- more pieces (#036, second round) ----
  // a string of triangle pennants between two points
  art_pennants(p, q, d, seed) {
    const g = this.dG(-15.5), cat = catenary(p, q, 22, 30), cols = String(d.colors || '#df3e23,#ffd541,#249fde,#59c135').split(',').map(t => t.trim());
    g.lineStyle(2, 0x141013, 0.9).beginPath(); g.moveTo(cat.line[0].x, cat.line[0].y); for (const pt of cat.line) g.lineTo(pt.x, pt.y); g.strokePath();
    const flags = [];
    cat.bulbs.forEach((b, k) => {
      const c = cols[k % cols.length], gg = this.scene.add.graphics();
      gg.fillStyle(0x141013).fillTriangle(-11, -1, 11, -1, 0, 24).fillStyle(col(c)).fillTriangle(-9, 0, 9, 0, 0, 20).fillStyle(0xffffff, 0.25).fillTriangle(-9, 0, -2, 0, 0, 8);
      flags.push(this.dAdd(this.scene.add.container(b.x, b.y, [gg]).setDepth(-15.45)));
    });
    this.decorAnim.push(time => flags.forEach((f, k) => { f.angle = Math.sin(time / 520 + k * 0.9 + seed * 3) * 8; }));
  }
  // a parachute canopy: one big sagging cloth with panels, no walls
  art_canopy(p, q, d) {
    const T = this.scene.T, len = q.x - p.x, sag = Math.min(2.5 * T, 24 + len * 0.16);
    this.decorCloth(p, q, (d.size?.[1] ?? 0.6) * T, sag, sag * 1.05, d.colors || '#e9b5a3,#8e5252', -15.65);
    const g = this.dG(-15.6);   // the shroud lines at both ends
    for (const a of [p, q]) for (let k = 0; k < 3; k++) g.lineStyle(1.5, 0xdae0ea, 0.6).lineBetween(a.x, a.y, p.x + (q.x - p.x) * (a === p ? 0.08 + k * 0.05 : 0.92 - k * 0.05), a.y + sag * 0.5);
  }
  // an oil drum with a fire: flames from code, a warm light at night
  art_barrel(x, y, w, h, d, seed) {
    const s = this.scene, g = this.dG(-16), bw = w * 0.8, bh = h * 0.7;
    this.dR(g, x - bw / 2 - PX, y - bh - PX, bw + 2 * PX, bh + PX, C.ink);
    this.dR(g, x - bw / 2, y - bh, bw, bh, C.rust); this.dR(g, x - bw / 2, y - bh, PX * 2, bh, C.copper, 0.6);
    for (const k of [0.25, 0.6]) this.dR(g, x - bw / 2, y - bh + bh * k, bw, PX, C.brown);
    for (let k = 0; k < 4; k++) this.dR(g, x - bw / 2 + PX * 2 + k * bw / 4.5, y - bh * 0.45, PX, PX * 2, '#ffb347', 0.8);   // glowing holes
    const fl = this.dAdd(s.add.graphics().setDepth(-15.9));
    const l = this.light(x, y - bh, 220, '#ff8a2a', 0.8); l.rig = true;
    this.decorAnim.push(time => {
      fl.clear(); const t = time / 1000;
      for (const [dx, base, ph] of [[-bw * 0.25, 30, 0], [bw * 0.2, 26, 2.1], [0, 42, 4.3]]) {
        const top = base + Math.sin(t * 7 + ph + seed * 9) * 6;
        for (let yy = 0; yy < top; yy += 6) { const wd = Math.max(4, (1 - yy / top) * 18), sw = Math.sin(t * 5 + ph + yy / 9) * 3; fl.fillStyle(yy > top * 0.55 ? 0xff5a1f : yy > top * 0.25 ? 0xff9a2a : 0xffe08a).fillRect(x + dx + sw - wd / 2, y - bh - yy - 6, wd, 6); }
      }
      l.setAlpha(l.base * Math.max(0.35, this.lightK || 0) * (0.85 + 0.15 * Math.sin(t * 11 + seed)));
    });
  }
  // rain on the rig (#036, Wetter am Rig): puddles on the campsite and drips from the container edges while it rains
  drawRainBits() {
    const s = this.scene, T = s.T;
    if (!s.rain) return;
    const g = this.dG(-15.95), seed = this.box.save.day || 1;
    for (let k = 0; k < 7; k++) { const x = this.groundX(-2 + ((k * 3.7 + seed) % 22)), w = 60 + ((k * 37) % 70); g.fillStyle(0x285cc4, 0.35).fillEllipse(x, this.ground - 2, w, 8).fillStyle(0xa6fcdb, 0.25).fillEllipse(x - w * 0.15, this.ground - 3, w * 0.4, 3); }
    const drips = [];
    for (const u of this.geo.units || []) if (u.ui > 0) for (const x of [u.in0 + 6, u.in0 + u.cell * u.places - 6]) drips.push({ x, y: u.floorY + 8, o: this.dAdd(s.add.rectangle(x, u.floorY + 8, 3, 7, 0xa6fcdb, 0.8).setDepth(-15.9)), ph: Math.random() });
    this.decorAnim.push(time => drips.forEach(d => { const t = ((time / 900 + d.ph) % 1); d.o.y = d.y + t * (this.ground - d.y); d.o.setAlpha(0.8 * (1 - t * 0.6)); }));
  }

  // ---- walkable pieces (#037, Daniel: „Balkone und Brücken auch mitdenken“) ----
  // a one-way platform Leyla can stand on (like the interior floors), destroyed with the rig drawing
  walkZone(x0, x1, y) {
    const s = this.scene, z = this.dAdd(s.add.zone((x0 + x1) / 2, y + 8, Math.max(8, x1 - x0), 16));
    s.platforms.add(z);
    Object.assign(z.body.checkCollision, { down: false, left: false, right: false });
    (this.walkTops ??= []).push({ x0, x1, y });
    return z;
  }
  // sloped walkways (bridges) are steps of one-way platforms: walking on them, Leyla steps up onto the next one when it is at most
  // a small step higher (Arcade physics would let her walk under it and fall through)
  stepUpDecor() {
    const l = this.scene.leyla, b = l?.body;
    if (!b || !this.walkTops?.length || !b.blocked.down || Math.abs(b.velocity.x) < 5) return;
    const dir = Math.sign(b.velocity.x), feet = b.bottom, fx = l.x + dir * (b.width / 2 + 6);
    const next = this.walkTops.find(w => fx >= w.x0 && fx <= w.x1 && w.y < feet - 0.5 && w.y >= feet - 16);
    if (next) b.y -= feet - next.y + 0.5;
  }
  // a balcony at a container's end: a steel grating on brackets, a railing at the outer end, a little plant pot
  art_balcony(b, d, seed, side) {
    const g = this.dG(-17.5), T = this.scene.T, y = b.y, w = b.x1 - b.x0, rail = 1.1 * T, c = d.color || '#6d758d';
    this.dR(g, b.x0, y - PX, w, 4 * PX, C.ink); this.dR(g, b.x0, y - PX, w, PX, C.pale); this.dR(g, b.x0, y, w, 2 * PX, c);
    for (let x = b.x0 + 6; x < b.x1 - 4; x += 12) this.dR(g, x, y + PX, PX, PX, C.ink);
    // brackets under it, diagonal to the container wall
    const wallX = side ? b.x0 : b.x1;
    g.lineStyle(2 * PX, col(C.ink)).lineBetween(wallX, y + 0.9 * T, side ? b.x0 + w * 0.7 : b.x1 - w * 0.7, y + 3 * PX);
    g.lineStyle(PX, col(C.steel)).lineBetween(wallX, y + 0.9 * T, side ? b.x0 + w * 0.7 : b.x1 - w * 0.7, y + 3 * PX);
    // railing: posts and a top bar, the outer end closed
    const out = side ? b.x1 - 2 * PX : b.x0;
    for (let x = b.x0 + (side ? 12 : 0); x <= b.x1 - (side ? 0 : 12); x += 20) this.dR(g, x, y - rail * 0.75, PX, rail * 0.75, C.silver, 0.9);
    this.dR(g, b.x0, y - rail, w, 2 * PX, C.ink); this.dR(g, b.x0, y - rail, w, PX, C.pale);
    this.dR(g, out - PX, y - rail, 3 * PX, rail, C.ink); this.dR(g, out, y - rail, PX, rail, C.silver);
    if (seed > 0.4) { const px = side ? b.x1 - 0.55 * T : b.x0 + 0.35 * T; this.dR(g, px, y - 4 * PX, 4 * PX, 4 * PX, C.pot); this.dR(g, px + PX, y - 7 * PX, 2 * PX, 3 * PX, C.green); this.dR(g, px - PX, y - 6 * PX, 2 * PX, PX, C.leaf); }
    this.walkZone(b.x0, b.x1, y);
  }
  // a walkable bridge between two anchors: planks along a slight sag, two rope (or steel) rails, posts; platforms all along
  art_bridge(p, q, d, seed) {
    const s = this.scene, T = s.T, steel = /stahl|steel/i.test(d.name || ''), g = this.dG(-15.4), n = Math.max(4, Math.round((q.x - p.x) / 24));
    const sag = steel ? 4 : Math.min(26, (q.x - p.x) * 0.05), at = t => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t + sag * 4 * t * (1 - t) });
    const rail = 0.9 * T;
    for (let k = 0; k < n; k++) {
      const a = at(k / n), b = at((k + 1) / n);
      if (steel) { this.dR(g, a.x, Math.min(a.y, b.y) - PX, b.x - a.x + 1, 3 * PX, C.ink); this.dR(g, a.x, Math.min(a.y, b.y), b.x - a.x + 1, PX, C.pale); }
      else { g.fillStyle(0x141013).fillRect(a.x, a.y - 2, b.x - a.x - 2, 12); g.fillStyle(col(k % 3 ? C.wood : C.woodL)).fillRect(a.x + 1, a.y, b.x - a.x - 4, 8); }
      this.walkZone(a.x - 2, b.x + 2, Math.min(a.y, b.y) - 2);
    }
    const hand = (t, dy) => { const pt = at(t); return { x: pt.x, y: pt.y - dy }; };
    g.lineStyle(steel ? 2 * PX : PX, col(steel ? C.silver : C.sand), 0.95).beginPath();
    for (let k = 0; k <= 16; k++) { const pt = hand(k / 16, rail - (steel ? 0 : sag * 0.6 * 4 * (k / 16) * (1 - k / 16))); k ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y); } g.strokePath();
    for (let k = 0; k <= n; k += steel ? 2 : 3) { const pt = at(k / n); g.lineStyle(PX * 0.75, col(steel ? C.steel : C.sand), 0.9).lineBetween(pt.x, pt.y, pt.x, pt.y - rail + (steel ? 0 : sag * 0.6 * 4 * (k / n) * (1 - k / n))); }
  }
  // a lookout tower on the ground: a scaffold with a ladder up the side, a platform on top with a railing and a little roof
  art_tower(x, y, w, h, d, seed) {
    const s = this.scene, T = s.T, g = this.dG(-16.6), top = y - h, pw = Math.max(w, 1.6 * T);
    for (const lx of [x - pw / 2 + 2 * PX, x + pw / 2 - 4 * PX]) { this.dR(g, lx - PX, top, 4 * PX, h, C.ink); this.dR(g, lx, top, 2 * PX, h, C.grey); }
    for (let yy = top + T; yy < y - T * 0.5; yy += T * 1.1) { g.lineStyle(PX, col(C.ink)).lineBetween(x - pw / 2 + 3 * PX, yy, x + pw / 2 - 3 * PX, yy + T * 1.1); g.lineStyle(PX, col(C.ink)).lineBetween(x + pw / 2 - 3 * PX, yy, x - pw / 2 + 3 * PX, yy + T * 1.1); }
    this.dR(g, x - pw / 2 - 2 * PX, top - PX, pw + 4 * PX, 4 * PX, C.ink); this.dR(g, x - pw / 2 - 2 * PX, top - PX, pw + 4 * PX, PX, C.pale); this.dR(g, x - pw / 2 - 2 * PX, top, pw + 4 * PX, 2 * PX, d.color || C.wood);
    const r = 0.9 * T; this.dR(g, x - pw / 2, top - r, PX, r, C.silver); this.dR(g, x + pw / 2 - PX, top - r, PX, r, C.silver); this.dR(g, x - pw / 2, top - r, pw, PX * 1.5, C.pale);
    g.fillStyle(col(C.ink)).fillTriangle(x - pw / 2 - 3 * PX, top - r - 2 * PX, x, top - r - 0.9 * T, x + pw / 2 + 3 * PX, top - r - 2 * PX);
    g.fillStyle(col(d.colors?.split(',')[0] || C.rust)).fillTriangle(x - pw / 2, top - r - 3 * PX, x, top - r - 0.8 * T, x + pw / 2, top - r - 3 * PX);
    this.walkZone(x - pw / 2 - 8, x + pw / 2 + 8, top);
    // the ladder up the side (climbable, from the ladder picture)
    const lx = x - pw / 2 - T / 2 + 4;
    const art = ladderArt(s, lx - T / 2, lx + T / 2, top, y, { depth: -16.5 });
    if (art) this.dAdd(art);
    s.ladders.push({ cx: lx, x0: lx - T / 2, x1: lx + T / 2, top, bottom: y, rig: true });
  }

  updateDecor(time, dt) {
    this.stepUpDecor();
    for (const f of this.decorAnim || []) f(time, dt);
    this.updateCrows(time);
  }
}

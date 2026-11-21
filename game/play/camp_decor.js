// Decoration in the camp (#036): every piece of save.rig.decor drawn from code or from a cut-out of an existing picture, in strict
// side view on a 4 px grid with AAP-64 colours. Wall pieces sit on a container's outer wall and fade with it when it opens; roof
// pieces stand on top; ground pieces on the campsite; span pieces hang between two anchors (container corners, the mast, poles).
// Some move: neon flickers, banners and laundry sway, the windmill turns faster in gusts, the kettle steams, crows fly up when
// Leyla comes near. Mixed into Camp like CampLife (logic: game/decor.js).
import { decorDef, placeOf, plantStage, dstate, tagsOf, freeWhy, canCarry, cozy, paintedDef } from '../decor.js';
import { catenary } from '../string_lights.js';
import { glowTexture, paintPixels } from './camp.js';
import { advance, clockText } from '../save.js';
import { ladderArt } from './ladder_art.js';
import { mirrorRows, dye, dyedUrl } from './signature.js';
import { have, take } from '../crafting.js';

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
  // #117 the rear end of the rig: the last container's back (or the van's, without trailers)
  rigRear() { const U = (this.geo.units || []).filter(u => u.ui > 0 && !u.level); return U.length ? Math.min(...U.map(u => u.x0)) : (this.geo.vanLeft ?? 0); }
  wallAt(ui, p, row) { const u = this.decorUnit(ui); return u && { u, x: u.in0 + (p + 0.5) * u.cell, y: u.inTop + (u.floorY - u.inTop) * (row ?? 0.4) }; }
  // #114 inside a container: on its back wall (row = share of the interior height) or hanging from its ceiling (row 'top')
  insideAt(ui, p, row) { const u = this.decorUnit(ui); return u && { u, x: u.in0 + (p + 0.5) * u.cell, y: row === 'top' ? u.inTop + 2 : row === 'floor' ? u.floorY : u.inTop + (u.floorY - u.inTop) * (row ?? 0.25), hang: row !== 'floor', floor: row === 'floor', row }; }   // #118 everything on the back wall hangs by its top (a bigger pin board grows downwards)
  roofAt(ui, p) { const u = this.decorUnit(ui); return u && { u, x: u.in0 + (p + 0.5) * u.cell, y: u.deckY ?? (u.inTop - 34) }; }
  // every point a span can hang on: container corners, the mast (string lights), and the tops of poles
  spanAnchors() {
    const out = this.geo.mega ? [] : [...(this.anchors?.() || [])], T = this.scene.T;
    (this.box.save.rig.decor || []).forEach((x, i) => {
      const d = decorDef(this.D, x.id);
      const grown = d?.grow && d.look && this.scene.textures.exists(d.look);   // #116 the top of a grown pole, the deck of a grown tower
      if (d?.art === 'pole') out.push({ id: `pole:${i}`, x: this.groundX(x.at.x), y: grown ? this.ground - this.modTop(d, x.at) + 10 : this.ground - (d.size?.[1] ?? 4) * T + 8 });
      if (d?.art === 'tower') out.push({ id: `tower:${i}`, x: this.groundX(x.at.x), y: grown ? this.towerDeck(d, x.at, this.groundX(x.at.x)).y : this.ground - (d.size?.[1] ?? 4.5) * T, walk: true });
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
    if (placeOf(this.D, id) === 'free') return this.freeSpots(id);
    if (placeOf(this.D, id) === 'inside') return this.insideSpots(id);   // #114
    if (placeOf(this.D, id) === 'climb') return this.climbSpots(id);   // #114
    const D = this.D, kind = placeOf(D, id), T = this.scene.T, out = [], save = this.box.save, used = new Set((save.rig.decor || []).map(x => { const { day, v, f, ...r } = x.at || {}; return JSON.stringify(r); }));
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
        if (kind === 'wall' && decorDef(D, id)?.art === 'sprite') {   // #111: hung freely, half places, high or low
          const st = (T * 0.5) / u.cell;
          for (let p0 = -0.5 + st; p0 <= (u.places || 0) - 0.5 - st + 1e-6; p0 += st) for (const row of decorDef(D, id)?.foot ? [1] : [0.3, 0.62]) {   // #114 doors: on the floor
            const p = Math.round(p0 * 1000) / 1000, at = { ui: u.ui, p, row };
            if (used.has(JSON.stringify(at))) continue;
            const q = this.wallAt(u.ui, p, row);
            out.push({ at, x: q.x, y: q.y, label: 'An die Wand' });
          }
          continue;
        }
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
    this.freeAt = []; this.decorBoxes = []; this.towers = []; this.insideCount = new Map();
    if (this.board?.decor) { for (const n of this.board.notes) n.destroy(); this.board = null; }   // #128 the notice board as a placed piece is drawn anew
    R.decor.forEach((x, i) => { try { this.drawPiece(x, i); } catch (e) { console.warn('Deko', x.id, e); } });
    try { this.drawKitLights(); } catch (e) { console.warn('Deko-Lichterkette', e); }
    try { this.drawKitDetails(); } catch (e) { console.warn('Deko-Details', e); }
    if (R.decor.some(x => decorDef(this.D, x.id)?.art === 'birdhouse' || decorDef(this.D, x.id)?.crows)) this.spawnCrows();
    this.drawRainBits();
  }
  dAdd(o) { this.rigObjs.push(o); return o; }
  // #128 (Daniel: „Mach aus dem schwarzen Brett etwas, das man wie Deko im Camp platzieren kann“): the notes go on the plank area of the picture
  // (Deko › Zettel-Fläche, in Bildpixeln), E opens the jobs like the old fixed board
  decorBoard(d, img, x, y, k, flip) {
    const fw = img.width, fh = img.height, [ax, ay] = d.areaAt || [0, 0], [aw, ah] = d.areaSize || [fw, fh / 2];
    const left = x + ((flip ? fw - ax - aw : ax) - fw / 2) * k, top = y - (fh - ay) * k;
    this.board = { decor: true, x: left + aw * k / 2, top, w: aw * k, h: ah * k, g: img, notes: [] };
    this.hotspots.push({ rig: true, x, w: Math.max(80, aw * k), floor: this.geo.campFloor != null ? this.campY : undefined, name: d.name || this.C.board?.name || 'Schwarzes Brett', hint: () => this.boardHint(), act: () => this.boardMenu() });
    this.boardNotes();
  }
  shellOf(u) { return (this.shells || []).find(c => c.u === u) || null; }
  drawPiece(x, i) {
    const s = this.scene, D = this.D, d = paintedDef(decorDef(D, x.id), x.at), T = s.T;   // #114 painted cloth
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
    if (kind === 'free') { const q = this.freePos(i); if (q) this.art_sprite(q, d, x, i); return; }
    if (kind === 'climb') { const c = this.climbAt(at.ui, at.p); if (c) this[`art_${d.art}`]?.(c, d, x, i); return; }   // #114
    if (kind === 'inside') { const q = this.insideAt(at.ui, at.p, at.row); if (q) { if (d.art === 'stringlights') this.art_inlights(q, d, x, i); else this.art_sprite({ ...q, level: 0, inside: true }, d, x, i); } return; }   // #114, #118 string lights inside
    let pos;
    if (kind === 'ground') pos = { x: this.groundX(at.x), y: this.ground };
    else if (kind === 'wall') { pos = this.wallAt(at.ui, at.p, at.row); if (pos && d.foot) pos = { ...pos, y: pos.u.floorY, foot: true }; }   // #114 doors stand on the container's floor
    else pos = this.roofAt(at.ui, at.p);
    if (!pos) return;
    const before = new Set(s.children.list);
    if (d.art === 'sprite') this.art_sprite({ x: pos.x, y: pos.y, u: pos.u, level: 0, wall: kind === 'wall' && !pos.foot, foot: pos.foot, shell: kind === 'wall' }, d, x, i);
    else this[`art_${d.art}`]?.(pos.x, pos.y, w, h, d, seed, pick, x, i);
    // wall pieces belong to the container's skin: they fade when it opens (like the workshops' outside pictures)
    if (kind === 'wall' && pos.u) { const sh0 = this.shellOf(pos.u); if (sh0) for (const o of s.children.list) if (!before.has(o) && o.setAlpha) sh0.extras.push(o); }
  }
  dG(depth) { return this.dAdd(this.scene.add.graphics().setDepth(depth)); }
  dR(g, x, y, w, h, c, a = 1) { g.fillStyle(col(c), a).fillRect(snap(x), snap(y), Math.max(PX, snap(w)), Math.max(PX, snap(h))); }


  // ---------- #111 Camp-Baukasten: free pieces (ground, roof, on top of each other) ----------
  // the base point of a free piece: { x, y, u?, level, roof } (y = where its feet stand)
  freePos(i, seen = new Set()) {
    if (this.freeAt?.[i]) return this.freeAt[i];
    const L = this.box.save.rig.decor || [], o = L[i], T = this.scene.T;
    if (!o || seen.has(i)) return null;
    seen.add(i);
    const at = o.at || {}, m = /^deco:(\d+)$/.exec(at.on || '');
    let q = null;
    const mb = /^balc:(\d+)$/.exec(at.on || '');
    if (m) { const j = Number(m[1]), b = this.freePos(j, seen), top = b && this.kitTop(j); if (b && top != null) q = { x: b.x + (at.dx || 0) * T, y: b.y - top, u: b.u, level: b.level + 1, roof: b.roof, on: j }; }
    else if (mb) { const B = L[Number(mb[1])], bd = B && decorDef(this.D, B.id), b = bd && this.balconyAt(B.at.ui, B.at.side, bd); if (b) q = { x: (b.x0 + b.x1) / 2 + (at.dx || 0) * T, y: b.y, u: b.u, level: 0, balc: true }; }
    else if (at.ui != null && at.p != null) { const r = this.roofAt(at.ui, at.p); if (r) q = { x: r.x, y: r.y, u: r.u, level: 0, roof: true }; }
    else if (Number.isFinite(at.x)) q = { x: this.groundX(at.x), y: this.ground, level: 0 };
    else if (Number.isFinite(at.rear)) q = { x: this.rigRear() - at.rear * T, y: this.ground, level: 0 };   // #117 behind the rig
    if (q) (this.freeAt ??= [])[i] = q;
    return q;
  }
  kitFrame(d, at) {
    const a = this.D.assets?.[d.look], n = a?.grid ? a.grid[0] * a.grid[1] : 1;
    if (d.growStages) return Math.max(0, Math.min(n - 1, Math.floor(((this.box.save.day ?? 1) - (at?.day ?? this.box.save.day ?? 1)) / Math.max(1, d.growDays ?? 2))));   // grows by the days
    if (d.grow === 'steps') return Math.max(0, Math.min(n - 1, this.growOf(d, at).n));   // #118 a bigger picture per step (the pin board)
    const v = (at?.v ?? 0) + (d.variant || 0);   // Start-Variante: two pieces can share one sheet (Banner mit Dreieck / Gang-Banner)
    return ((v % n) + n) % n;
  }
  kitScale(d) { return (d.scale || 100) / 100; }
  // ---------- #116 Ziehen zum Wachsen (Daniel 19.11.2026): pieces from modules ----------
  // Deko › Wachsen: 'up' = head + n middle sections + foot (posts, tower), 'side' = left end + n sections + right end and a
  // little higher with m bands of its wall (tents), 'stack' = n crates on top of each other. n / m live in the placed piece (at.n, at.m).
  growOf(d, at) {
    if (!d?.grow) return null;
    const lim = (r, v, def) => { const [lo, hi] = r || [0, 4]; return Math.max(lo, Math.min(hi, Math.round(v ?? def))); };
    return { n: lim(d.growRange, at?.n, d.growStart ?? 1), m: lim(d.growRange2, at?.m, d.growStart2 ?? 1) };
  }
  // the middle sections of a variant (Deko › Wachsen › Mittelstück je Variante; one row = all variants)
  growSlices(d, fr) { const S = d.slices || []; const r = S[fr] || S[0] || {}; return { y: r.y0 != null ? [r.y0, r.y1] : null, x: r.x0 != null ? [r.x0, r.x1] : null }; }
  // geometry of a modular piece in picture pixels: total size and where a picture point lands
  modGeo(d, at, fr) {
    const s = this.scene, f = s.textures.getFrame(d.look, fr), g = this.growOf(d, at), sl = this.growSlices(d, fr);
    const ny = d.grow === 'up' ? g.n : d.grow === 'side' ? g.m : 1, nx = d.grow === 'side' ? g.n : 1;
    const py = sl.y ? sl.y[1] - sl.y[0] : 0, px = sl.x ? sl.x[1] - sl.x[0] : 0;
    const W = f.width + (sl.x ? (nx - 1) * px : 0), H = f.height + (sl.y ? (ny - 1) * py : 0);
    const map = (v, s2, n, p) => !s2 || v < s2[0] ? v : v >= s2[1] ? v + (n - 1) * p : v;
    return { f, sl, nx, ny, px, py, W, H, mx: v => map(v, sl.x, nx, px), my: v => map(v, sl.y, ny, py) };
  }
  // draws it as crops of its cell into a container: bottom middle at (x, y); → { box, at(px, py) → world point, top }
  drawModular(d, at, fr, x, y, k, flip, depth) {
    const s = this.scene, G = this.modGeo(d, at, fr), tex = s.textures.get(d.look), F = G.f;
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const segs = (len, sl, n) => { if (!sl) return [[0, len, 0]]; const out = [[0, sl[0], 0]], p = sl[1] - sl[0]; for (let j = 0; j < n; j++) out.push([sl[0], sl[1], sl[0] + j * p]); out.push([sl[1], len, sl[0] + n * p]); return out.filter(q => q[1] > q[0]); };
    const box = this.dAdd(s.add.container(Math.round(x), Math.round(y)).setDepth(depth));
    for (const [y0, y1, ty] of segs(F.height, G.sl.y, G.ny)) for (const [x0, x1, tx] of segs(F.width, G.sl.x, G.nx)) {
      const name = `m:${fr}:${x0},${y0},${x1 - x0},${y1 - y0}`;
      if (!tex.has(name)) tex.add(name, 0, F.cutX + x0, F.cutY + y0, x1 - x0, y1 - y0);
      box.add(s.add.image(tx - G.W / 2, ty - G.H, d.look, name).setOrigin(0, 0));
    }
    box.setScale(flip ? -k : k, k);
    const c = this.kitContent(d.look, fr) || { h: F.height, fh: F.height };
    const top = (G.H - (c.fh - c.h)) * k;   // painted height (the cell may have air above the head)
    return { box, G, top, w: G.W * k, at: (px, py) => ({ x: x + (flip ? -1 : 1) * (G.mx(px) - G.W / 2) * k, y: y - (G.H - G.my(py)) * k }) };
  }
  modTop(d, at) {
    const fr = this.kitFrame(d, at), G = this.modGeo(d, at, fr), c = this.kitContent(d.look, fr) || { h: G.f.height, fh: G.f.height };
    return (G.H - (c.fh - c.h)) * this.kitScale(d);
  }
  // a stack of crates: n pictures of the sheet on top of each other, every one another variant (Daniel: „Kiste ziehen macht einen Stapel“)
  drawStack(d, at, fr, x, y, k, flip, depth, n) {
    const s = this.scene, nv = Math.max(1, (this.D.assets?.[d.look]?.grid || [1, 1]).reduce((a, b) => a * b, 1)), out = [];
    let yy = y, w = 0;
    for (let j = 0; j < n; j++) {
      const v = (fr + j * 3) % nv, c = this.kitContent(d.look, v), f = s.textures.getFrame(d.look, v), dx = j ? Math.round((hash(j, x) - 0.5) * 10) : 0;
      out.push(this.dAdd(s.add.image(Math.round(x + dx), Math.round(yy), d.look, v).setOrigin(0.5, 1).setScale(k).setFlipX(j % 2 ? !flip : flip).setDepth(depth + j * 0.0001)));
      yy -= (c?.h ?? f.height) * k - 2; w = Math.max(w, f.width * k);
    }
    return { imgs: out, top: y - yy, w };
  }
  // height of the painted part of a frame (feet on the bottom row), cached per texture frame
  kitContent(key, frame) {
    const s = this.scene, k = `${key}:${frame}`, C = (CampDecor.content ??= new Map());
    if (C.has(k)) return C.get(k);
    const f = s.textures.getFrame(key, frame);
    if (!f) return null;
    // #125 (Backlog C3): one read of the whole frame (getPixelAlpha read the GPU back once per pixel: „GPU stall due to ReadPixels“)
    let top = f.height;
    const W = Math.max(1, f.cutWidth), H = Math.max(1, f.cutHeight), img = f.source?.image;
    let a = null;
    try {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, f.cutX, f.cutY, W, H, 0, 0, W, H);
      a = g.getImageData(0, 0, W, H).data;
    } catch { a = null; }
    for (let y = 0; y < f.height && top === f.height; y++) for (let x = 0; x < f.width; x += 2)
      if ((a ? (x < W && y < H ? a[(y * W + x) * 4 + 3] : 0) : s.textures.getPixelAlpha(x, y, key, frame)) > 40) { top = y; break; }
    const out = { h: f.height - top, w: f.width, fh: f.height };
    C.set(k, out);
    return out;
  }
  // where something stands on piece i: px above its feet, or null when nothing can stand on it
  kitTop(i) {
    const o = this.box.save.rig.decor?.[i], d = o && decorDef(this.D, o.id);
    if (!d || !canCarry(d) || !this.scene.textures.exists(d.look)) return null;
    const k = this.kitScale(d);
    if (d.carry === 'fixed') return (d.top || 0) * k;
    if (d.grow === 'stack') {   // #116 a stack of crates: all of them (as drawStack lays them)
      const n = this.growOf(d, o.at).n, nv = Math.max(1, (this.D.assets?.[d.look]?.grid || [1, 1]).reduce((a, b) => a * b, 1)), fr = this.kitFrame(d, o.at);
      let t = 0; for (let j = 0; j < n; j++) { const c = this.kitContent(d.look, (fr + j * 3) % nv); t += (c?.h ?? 0) * k - 2; }
      return t + 2;
    }
    const c = this.kitContent(d.look, this.kitFrame(d, o.at));
    return c ? c.h * k : null;
  }
  // which way the piece looks: toward the nearest piece with the „Dreht sich zu“ tag, else its rolled mirror
  kitFlip(d, o, i, q) {
    if (d.faces) {
      const near = (this.D.camp?.decor?.near ?? 2.5) * 2 * this.scene.T, L = this.box.save.rig.decor || [];
      let best = null;
      L.forEach((p, j) => { if (j === i || !tagsOf(decorDef(this.D, p.id)).includes(d.faces)) return; const r = this.freePos(j); if (!r || Math.abs(r.y - q.y) > 40 && !(r.level || q.level)) return; const dist = Math.abs(r.x - q.x); if (dist <= near && (!best || dist < best.dist)) best = { dist, x: r.x }; });
      if (best) return best.x < q.x;
    }
    return !!(d.flip && o.at?.f);
  }
  // #114 a picture sheet in a container's colour (camp.js paintPixels), made once per colour
  paintedSheet(key, hex) {
    const s = this.scene, out = `${key}__p${hex.slice(1)}`;
    if (s.textures.exists(out)) return out;
    const src = s.textures.get(key).getSourceImage(), A = this.D.assets?.[key], [cw, ch] = Array.isArray(A?.cell) ? A.cell : [A?.cell || src.width, A?.cell || src.height];
    const tex = s.textures.createCanvas(out, src.width, src.height), ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false; ctx.drawImage(src, 0, 0);
    paintPixels(ctx, src.width, src.height, hex, this.D.camp?.paint);
    tex.refresh();
    for (let n = 0, gx = Math.floor(src.width / cw), gy = Math.floor(src.height / ch); n < gx * gy; n++) tex.add(n, 0, (n % gx) * cw, Math.floor(n / gx) * ch, cw, ch);
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return out;
  }
  art_sprite(q, d, o, i) {
    const s = this.scene;
    if (!d.look || !s.textures.exists(d.look)) return;
    s.textures.get(d.look).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const unitColor = d.matchWall && q.u ? this.box.save.rig.units[q.u.ui]?.color : null, look = unitColor ? this.paintedSheet(d.look, unitColor) : d.look;   // #114 a window takes its container's colour
    const fr = this.kitFrame(d, o.at), k = this.kitScale(d), flip = this.kitFlip(d, o, i, q), f = s.textures.getFrame(look, fr);
    const x = Math.round(q.x), depth = q.shell || q.wall ? -16.2 + i * 0.00001 : -15.9 + q.level * 0.002 + i * 0.00001;
    const c = this.kitContent(d.look, fr) || { h: f.height, w: f.width };
    // wall pieces hang by their middle (the painted part), hanging ones by their top, the rest stand on their feet
    const y = Math.round(q.hang ? q.y + c.h * k : q.wall ? q.y + (c.h * k) / 2 : q.y);
    // a soft contact shadow under ground and roof pieces
    if (!q.level && !q.wall && !q.inside && !q.shell && d.shadow !== false) { const g = this.dG(depth - 0.0005); g.fillStyle(0x060608, 0.28).fillEllipse(x, y - 1, f.width * k * 0.8, 7); }
    let img, mod = null;
    const grow = d.grow && this.growOf(d, o.at);
    if (grow && (d.grow === 'up' || d.grow === 'side')) {   // #116 (#118 also inside a container, in its view behind the workshops)
      mod = this.drawModular(d, o.at, fr, x, y + (q.wall || q.shell ? 0 : 1), k, flip, depth);
      img = mod.box;
      if (q.inside && q.u?.view) { const v = q.u.view, mid = (q.u.x0 + q.u.x1) / 2, G = q.u.base ?? this.ground, si = v.list.findIndex(o2 => o2.texture?.key === q.u.sprite?.key); s.children.remove(img); img.setPosition(img.x - mid, img.y - G); v.addAt(img, this.insideSlot(v, si, q)); }
      (this.decorBoxes ??= [])[i] = { x0: x - mod.w / 2, x1: x + mod.w / 2, y0: y - mod.top, y1: y, x, y, top: mod.top };
    } else if (grow && d.grow === 'stack' && !q.inside) {
      const st = this.drawStack(d, o.at, fr, x, y + 1, k, flip, depth, grow.n);
      img = st.imgs[st.imgs.length - 1];
      (this.decorBoxes ??= [])[i] = { x0: x - st.w / 2, x1: x + st.w / 2, y0: y - st.top, y1: y, x, y, top: st.top };
    } else if (q.inside && q.u?.view) {   // #114 inside: on the container's back wall, behind its workshops (in the unit's view, right after its picture)
      const v = q.u.view, mid = (q.u.x0 + q.u.x1) / 2, G = q.u.base ?? this.ground, si = v.list.findIndex(o2 => o2.texture?.key === q.u.sprite?.key);
      img = s.add.image(x - mid, y - G, look, fr).setOrigin(0.5, 1).setScale(k).setFlipX(flip);
      v.addAt(img, this.insideSlot(v, si, q));
    } else img = this.dAdd(s.add.image(x, y + (q.wall || q.shell ? 0 : 1), look, fr).setOrigin(0.5, 1).setScale(k).setFlipX(flip).setDepth(depth));
    if (!grow || q.inside) (this.decorBoxes ??= [])[i] = { x0: x - f.width * k / 2, x1: x + f.width * k / 2, y0: y - c.h * k, y1: y, x, y };
    // pop in when it was just placed (Tiny Glade: every click answers)
    if (this.kitPop === i) { img.setScale(k * 0.6, k * 1.25); s.tweens.add({ targets: img, scaleX: k, scaleY: k, duration: 260, ease: 'Back.Out' }); this.kitPop = null; }
    // what the piece does when Leyla presses E at it (#111: the old code pieces keep their use)
    const bw = Math.max(70, f.width * k);
    if (d.use === 'mirror') this.hotspots.push({ rig: true, x, w: bw, name: d.name || 'Spiegel', hint: 'Haare färben', act: () => this.mirrorMenu(d) });
    if (d.use === 'board' && !this.board && !q.inside) this.decorBoard(d, img, x, y, k, flip);   // #128 the first placed board holds the jobs
    if (d.use === 'rest') this.hotspots.push({ rig: true, x, w: bw, top: q.level || q.roof || q.balc ? y - 10 : undefined, name: d.name || 'Liegestuhl', hint: d.useHint || 'Dösen', act: () => this.hammockRest(d) });
    if (d.crows) (this.perches ??= []).push({ x, y: y - c.h * k + 4 });
    if (d.extra === 'neon') return this.neonGlow(img, look, fr, k, flip, x, y - c.h * k / 2, d, fr, hash(i, x));
    if (!d.extra || !d.hook) return;
    if (d.lightVariants != null && d.lightVariants !== '' && !String(d.lightVariants).split(',').map(t => Number(t.trim()) - 1).includes(fr)) return;   // only these variants (1 = first)
    const hook = d.hooks?.[fr]?.at || d.hook;
    let hx = x + ((flip ? f.width - hook[0] : hook[0]) - f.width / 2) * k, hy = y - (f.height - hook[1]) * k;
    if (mod) ({ x: hx, y: hy } = mod.at(hook[0], hook[1]));
    this.decorBoxes[i].hook = { x: hx, y: hy };
    const growK = grow ? 1 + (d.growLight || 0) / 100 * (grow.n - (d.growStart ?? 1)) : 1;   // a taller post shines further
    const seed = hash(i, x);
    if (d.extra === 'steam') {
      const puffs = [];
      for (let n = 0; n < 4; n++) puffs.push(this.dAdd(s.add.image(hx, hy, glowTexture(s)).setDisplaySize(22, 22).setTint(0xdae0ea).setAlpha(0).setDepth(depth + 0.0008)));
      this.decorAnim.push(time => puffs.forEach((p, n) => { const t = ((time / 2400 + n / 4 + seed) % 1); p.setPosition(hx + Math.sin(t * 6 + n) * 8, hy - t * 90).setAlpha(0.32 * (1 - t)).setDisplaySize(14 + t * 34, 14 + t * 34); }));
      return;
    }
    if (d.extra === 'rotor') {   // strictly from the side: the blades turn in a plane seen edge-on, so they grow and shrink
      const g = this.dAdd(s.add.graphics().setDepth(depth + 0.0008)), L = (d.rotor || 34) * k;
      let spin = seed * 6;
      this.decorAnim.push((time, dt) => {
        const gust = this.gustAt && this.gustAt - time < 1500 && this.gustAt > time ? 3 : 1;
        spin += dt / 1000 * (2.2 + Math.sin(time / 4000 + seed * 9)) * gust;
        g.clear();
        for (let n = 0; n < 3; n++) {
          const a = spin + n * 2.094, len = Math.round(Math.sin(a) * L), w = (Math.abs(Math.cos(a)) > 0.7 ? 4 : 3) * Math.max(1, k * 0.8);
          g.fillStyle(0x141013).fillRect(Math.round(hx) - 1, Math.min(hy, hy - len) - 1, w + 2, Math.abs(len) + 2);
          g.fillStyle(n ? 0xdae0ea : 0xb4202a).fillRect(Math.round(hx), Math.min(hy, hy - len), w, Math.abs(len));
        }
        g.fillStyle(0x141013).fillRect(Math.round(hx) - 2, Math.round(hy) - 3, 6, 6).fillStyle(0x8b93af).fillRect(Math.round(hx) - 1, Math.round(hy) - 2, 4, 4);
      });
      return;
    }
    if (d.extra === 'light' || d.extra === 'candle') {
      const big = d.extra === 'light', l = this.light(hx, hy, (big ? 190 : 70) * growK, big ? '#ffd27a' : '#ffb347', big ? 0.75 : 0.6); l.rig = true;
      this.decorAnim.push(time => l.setAlpha(l.base * this.lightK * (0.86 + 0.14 * Math.sin(time / (big ? 170 : 90) + seed * 7))));
    }
    if (d.extra === 'fire') {
      const fl = this.dAdd(s.add.graphics().setDepth(depth + 0.0008)), bw = f.width * k * 0.5;
      const l = this.light(hx, hy - 20, 260, '#ff8a2a', 0.85); l.rig = true;
      this.decorAnim.push(time => {
        fl.clear(); const t = time / 1000;
        for (const [dx, base, ph] of [[-bw * 0.28, 26, 0], [bw * 0.25, 22, 2.1], [0, 40, 4.3], [-bw * 0.05, 30, 1.2]]) {
          const top = base + Math.sin(t * 7 + ph + seed * 9) * 6;
          for (let yy = 0; yy < top; yy += 4) { const wd = Math.max(2, Math.round((1 - yy / top) * 14 / 2) * 2), sw = Math.round(Math.sin(t * 5 + ph + yy / 9) * 2); fl.fillStyle(yy > top * 0.6 ? 0xdf3e23 : yy > top * 0.3 ? 0xfa6a0a : 0xffd541).fillRect(Math.round(hx + dx + sw - wd / 2), Math.round(hy - yy - 4), wd, 4); }
        }
        // sparks
        for (let n = 0; n < 3; n++) { const ph = (t * 0.7 + n / 3 + seed) % 1, sx = hx + Math.sin(n * 2.4 + t * 2) * 10 * ph; fl.fillStyle(0xffd541, 1 - ph).fillRect(Math.round(sx), Math.round(hy - 30 - ph * 60), 2, 2); }
        l.setAlpha(l.base * Math.max(0.35, this.lightK || 0) * (0.85 + 0.15 * Math.sin(t * 11 + seed)));
      });
    }
  }
  // posts with „Lichterkette zu Nachbarn“ close to each other string lights between their hooks (Townscaper: neighbours react)
  drawKitLights() {
    const D = this.D, L = this.box.save.rig.decor || [], T = this.scene.T, max = (D.camp?.decor?.linkMax ?? 8) * T;
    const posts = L.map((o, i) => ({ o, i, d: decorDef(D, o.id) })).filter(p => p.d?.linkLights && p.d.hook && this.decorBoxes?.[p.i]).map(p => {
      const b = this.decorBoxes[p.i], f = this.scene.textures.getFrame(p.d.look, this.kitFrame(p.d, p.o.at)), k = this.kitScale(p.d);
      if (b.hook) return { x: b.hook.x, y: b.hook.y - 14 * k, top: b.y };   // #116 the hook of a grown post
      return { x: b.x, y: b.y - (f.height - p.d.hook[1] + 14) * k, top: b.y };
    }).sort((a, b) => a.x - b.x);
    const colors = ['#ffd27a', '#fa6a0a', '#f9a31b', '#e86a73', '#a6fcdb'];
    for (let k = 1; k < posts.length; k++) {
      const p = posts[k - 1], q = posts[k];
      if (q.x - p.x > max || Math.abs(q.top - p.top) > 8) continue;
      const cat = catenary({ x: p.x, y: p.y }, { x: q.x, y: q.y }, 20, 30), g = this.dG(-15.95);
      g.lineStyle(2, 0x17111f, 0.95).beginPath(); cat.line.forEach((pt, n) => n ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y)); g.strokePath();
      cat.bulbs.forEach((b, j) => {
        const c = colors[(j + k) % colors.length];
        g.fillStyle(0x17111f).fillRect(Math.round(b.x) - 2, Math.round(b.y), 4, 3).fillStyle(col(c)).fillRect(Math.round(b.x) - 3, Math.round(b.y) + 3, 6, 6).fillStyle(0xffffff, 0.6).fillRect(Math.round(b.x) - 2, Math.round(b.y) + 4, 2, 2);
        const l = this.light(b.x, b.y + 6, 40, c, 0.7); l.rig = true;
        this.decorAnim.push(time => l.setAlpha(l.base * this.lightK * (0.8 + 0.2 * Math.sin(time / 600 + j * 1.7 + k))));
      });
    }
  }
  // ---------- #111 Auto-Details: what grows by itself (Townscaper/Tiny Glade: the camp lives) ----------
  // moss at the feet of pieces that stood long enough, ivy climbing crates next to plants, a cat that comes when the camp is cosy
  drawKitDetails() {
    const D = this.D, save = this.box.save, L = save.rig.decor || [], K = D.camp?.decor || {}, T = this.scene.T, day = save.day ?? 1;
    const boxes = this.decorBoxes || [], g = this.dG(-15.85);
    const near = (i, tag, dist) => L.some((o, j) => j !== i && boxes[j] && tagsOf(decorDef(D, o.id)).includes(tag) && Math.abs(boxes[j].x - boxes[i].x) <= dist * T && Math.abs(boxes[j].y - boxes[i].y) < 140);
    const leaf = (x, y, c) => g.fillStyle(0x141013, 0.9).fillRect(x - 1, y - 1, 6, 5).fillStyle(c).fillRect(x, y, 4, 3);
    L.forEach((o, i) => {
      const d = decorDef(D, o.id), b = boxes[i];
      if (!b || d?.art !== 'sprite' || d.place === 'wall') return;
      const age = day - (o.at?.day ?? day), tags = tagsOf(d), seed = hash(i, b.x);
      const q = this.freeAt?.[i];
      // moss: tufts at the foot (not on fire, not stacked)
      if (K.mossDays && age >= K.mossDays && !tags.includes('feuer') && !(q?.level)) {
        const n = Math.min(4, 1 + Math.floor((age - K.mossDays) / 2));
        for (let m = 0; m < n; m++) { const mx = Math.round(b.x0 + 4 + hash(seed, m) * (b.x1 - b.x0 - 12)); for (let t = 0; t < 3; t++) g.fillStyle([0x328464, 0x59c135, 0x23674e][t]).fillRect(mx + t * 3 - 3, Math.round(b.y1) - 3 - (t === 1 ? 2 : 0), 3, 3 + (t === 1 ? 2 : 0)); }
      }
      // ivy: up the side of pieces that carry (crates, tables) when a plant stands next to them, longer every day
      if (K.ivyDays && age >= K.ivyDays && canCarry(d) && near(i, 'grün', 1.6)) {
        const len = Math.min(b.y1 - b.y0 - 4, (age - K.ivyDays + 1) * 14), side = seed < 0.5 ? b.x0 + 3 : b.x1 - 5;
        g.fillStyle(0x23674e).fillRect(Math.round(side), Math.round(b.y1 - len), 2, Math.round(len));
        for (let yy = 4; yy < len; yy += 7) leaf(Math.round(side + ((yy / 7) % 2 ? 2 : -4)), Math.round(b.y1 - yy), (yy / 7) % 3 ? 0x59c135 : 0x9cdb43);
        if (age - K.ivyDays >= 3) for (let xx = 4; xx < (b.x1 - b.x0) * 0.6; xx += 8) leaf(Math.round((side < b.x ? b.x0 + xx : b.x1 - xx - 4)), Math.round(b.y0 + 2 + (xx % 16 ? 2 : 0)), 0x59c135);   // over the top edge
      }
    });
    this.drawCat();
  }
  // the camp cat: comes when Gemütlichkeit reaches Camp › Deko › Katze ab; sleeps on a free top (crate, table), else by the fire.
  // One cat per save (its look stays), its place changes by the day; E: streicheln
  drawCat() {
    const s = this.scene, D = this.D, save = this.box.save, K = D.camp?.decor || {}, key = K.cat;
    this.cat = null;
    if (!key || !s.textures.exists(key) || cozy(D, save) < (K.catCozy ?? 8)) return;
    const L = save.rig.decor || [], boxes = this.decorBoxes || [], T = s.T, day = save.day ?? 1;
    const covered = new Set(L.map(o => /^deco:(\d+)$/.exec(o.at?.on || '')?.[1]).filter(Boolean).map(Number));
    const spots = [];
    L.forEach((o, i) => { const b = boxes[i], top = b && this.kitTop(i), q = this.freeAt?.[i]; if (b && top != null && q && !covered.has(i)) spots.push({ x: q.x, y: q.y - top + 1, i }); });
    L.forEach((o, i) => { const b = boxes[i]; if (b && tagsOf(decorDef(D, o.id)).includes('feuer') && !this.freeAt?.[i]?.level) spots.push({ x: b.x + ((day % 2) ? -1 : 1) * 1.1 * T, y: b.y1, fire: true }); });
    if (!spots.length) return;
    const at = spots[Math.floor(hash(day, L.length) * spots.length) % spots.length], A = D.assets?.[key], n = A?.grid ? A.grid[0] * A.grid[1] : 1;
    const v = Math.floor(hash(save.seed ?? 7, 3) * n) % n, flip = hash(day, 5) < 0.5;
    s.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const img = this.dAdd(s.add.image(Math.round(at.x), Math.round(at.y) + 1, key, v).setOrigin(0.5, 1).setFlipX(flip).setDepth(-15.85));
    this.decorAnim.push(time => img.setScale(1, 1 + 0.035 * (0.5 + 0.5 * Math.sin(time / 900))));   // breathing
    this.cat = { x: at.x, y: at.y, img };
    this.hotspots.push({ rig: true, x: at.x, w: 70, top: at.y < this.ground - 40 ? at.y - 10 : undefined, name: K.catName || 'Katze', hint: 'Streicheln', act: () => {
      s.hud.toast(K.catName || 'Katze', ['Schnurrt.', 'Blinzelt dich an.', 'Streckt eine Pfote. Bleibt liegen.', 'Rollt sich enger ein.'][Math.floor(Math.random() * 4)], 'ok', 2200);
      for (let n = 0; n < 5; n++) s.time.delayedCall(n * 90, () => s.fx?.puff?.(at.x + (Math.random() - 0.5) * 30, at.y - 30 - n * 6, 0xe86a73));
      img.setScale(1.08, 0.94); s.tweens.add({ targets: img, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.Out' });
    } });
  }
  // #114 inside: every container, half-tile steps, hanging from the ceiling or on the back wall (two heights)
  // #118 the order inside a container, back to front: its picture, the back wall, then floor furniture, lamps and string lights; all behind
  // the workshops (which come after)
  insideSlot(v, si, q) {
    const C = (this.insideCount ??= new Map()), c = C.get(v) || { wall: 0, front: 0 };
    C.set(v, c);
    if (q.floor || q.row === 'top' || q.lights) { c.front++; return si + 1 + c.wall + c.front - 1; }
    c.wall++; return si + 1;
  }
  // is a place of a container taken by a workshop?
  placeTakenAt(ui, p) { return (this.box.save.rig.units[ui]?.workshops || []).some(w => p >= w.at && p < w.at + (this.D.workshops?.[w.id]?.places || 1)); }
  insideSpots(id) {
    const T = this.scene.T, out = [], used = new Set((this.box.save.rig.decor || []).map(x => { const { day, v, f, paint, ...r } = x.at || {}; return JSON.stringify(r); }));
    if (this.geo.mega) return out;
    for (const u of this.geo.units || []) {
      if (u.ui === 0) continue;
      const st = (T * 0.5) / u.cell;
      // #118 (Daniel: „Zellen-Typ Wohnen + hinter Werkstätten außer bei Lampen“): ceiling and floor only in free places, the back wall also
      // behind workshops (Deko › Innen: Reihe)
      const R = decorDef(this.D, id)?.insideRow, rows = R === 'top' ? ['top'] : R === 'floor' ? ['floor'] : R === 'wall' ? [0.2, 0.42] : ['top', 0.2, 0.42];
      for (let p0 = -0.5 + st; p0 <= (u.places || 0) - 0.5 - st + 1e-6; p0 += st) for (const row of rows) {
        const p = Math.round(p0 * 1000) / 1000, at = { ui: u.ui, p, row };
        if (used.has(JSON.stringify(at))) continue;
        if ((row === 'top' || row === 'floor') && R && this.placeTakenAt(u.ui, Math.round(p))) continue;
        const q = this.insideAt(u.ui, p, row);
        out.push({ at, x: q.x, y: q.y + (row === 'top' ? 20 : row === 'floor' ? -10 : 0), label: row === 'top' ? 'An die Decke' : row === 'floor' ? 'Auf den Boden' : 'Innen an die Wand', inside: true });
      }
    }
    return out;
  }
  // #114 Treppen & Wege frei: where a ladder or stair leans against a container (half-tile steps along it)
  climbAt(ui, p) {
    const u = this.decorUnit(ui); if (!u) return null;
    const x = u.in0 + (p + 0.5) * u.cell, G = u.base ?? this.ground, U = this.box.save.rig.units;
    // a container stacked right above that covers x: the ladder leads into it, else onto the roof
    const above = (this.geo.units || []).find(o => o.ui > ui && (U[o.ui]?.level || 0) === (U[ui]?.level || 0) + 1 && x > o.in0 && x < o.in0 + o.cell * o.places && Math.abs((o.base ?? 0) - (u.deckY ?? u.inTop)) < 40);
    return { u, x, bottom: G, roof: u.deckY ?? (u.inTop - 30), floor: u.floorY, into: above ? above.floorY : null };
  }
  climbSpots(id) {
    const T = this.scene.T, out = [], used = new Set((this.box.save.rig.decor || []).filter(x => placeOf(this.D, x.id) === 'climb').map(x => `${x.at.ui}:${x.at.p}`));
    if (this.geo.mega) return out;
    for (const u of this.geo.units || []) {
      if (u.ui === 0) continue;
      const st = (T * 0.5) / u.cell;
      for (let p0 = -0.5 + st; p0 <= (u.places || 0) - 0.5 - st + 1e-6; p0 += st) {
        const p = Math.round(p0 * 1000) / 1000; if (used.has(`${u.ui}:${p}`)) continue;
        const c = this.climbAt(u.ui, p);
        out.push({ at: { ui: u.ui, p }, x: c.x, y: (c.bottom + c.floor) / 2, label: decorDef(this.D, id)?.art === 'stairs' ? 'Treppe hierhin' : 'Leiter hierhin' });
      }
    }
    return out;
  }
  // a ladder up the container's wall onto its roof (or into the container stacked above): climbable like the rig's own
  art_ladder(c, d, o, i) {
    const s = this.scene, T = s.T, bottom = c.bottom, g = d.grow && this.growOf(d, o?.at);
    const top = (c.into ?? c.roof) - (g && c.into == null ? g.n * T : 0);   // #116 pulled longer: beyond the roof, a tile per step
    const art = ladderArt(s, c.x - T / 2, c.x + T / 2, top, bottom, { depth: -16.4, tint: d.color ? col(d.color) : undefined });
    if (art) this.dAdd(art);
    else { const g = this.dG(-16.4); this.dR(g, c.x - 22, top, 6, bottom - top, C.ink); this.dR(g, c.x + 16, top, 6, bottom - top, C.ink); for (let y = bottom - 20; y > top; y -= 28) this.dR(g, c.x - 16, y, 32, 4, C.steel); }
    s.ladders.push({ cx: c.x, x0: c.x - T / 2, x1: c.x + T / 2, top, bottom, rig: true });
    (this.decorBoxes ??= [])[i] = { x0: c.x - T / 2, x1: c.x + T / 2, y0: top, y1: bottom, x: c.x, y: bottom };
  }
  // a folding stair from the ground into the container (the Klapptreppe picture of Camp › Gemütlichkeit), freely along its side
  art_stairs(c, d, o, i) {
    const s = this.scene, T = s.T, top = c.floor, bottom = this.ground, info = this.C?.stairs?.look && s.assetInfo(this.C.stairs.look);
    if (info) {
      s.textures.get(info.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      const src = s.textures.get(info.key).getSourceImage(), land = (this.C.stairs.landing ?? 26) / src.height, feet = (this.C.stairs.feet ?? 123) / src.height;
      const k = Math.max(0.6, (bottom - top) / ((feet - land) * src.height)), ox = (this.C.stairs.at ?? 85) / src.width;
      this.dAdd(s.add.image(c.x, bottom + (1 - feet) * src.height * k, info.key).setOrigin(ox, 1).setScale(k).setFlipX(!!o.at?.f).setDepth(-16.4));
    } else this.art_ladder({ ...c, roof: top, into: null, bottom }, d, o, i);
    s.ladders.push({ cx: c.x, x0: c.x - T / 2, x1: c.x + T / 2, top, bottom, rig: true, ground: true, stairs: !!info });
    (this.decorBoxes ??= [])[i] = { x0: c.x - T / 2, x1: c.x + T / 2, y0: top, y1: bottom, x: c.x, y: bottom };
  }
  // candidate places for a free piece: on the ground, on roofs, on top of pieces that carry
  freeSpots(id) {
    const D = this.D, T = this.scene.T, save = this.box.save, out = [], L = save.rig.decor || [];
    const [a, b] = D.camp?.decor?.ground || [-4, 20];
    for (let x = a; x <= b; x += 0.25) {
      const gx = this.groundX(x);
      if (this.geo.shaft && gx < (this.geo.shaft.to + 1) * T) continue;
      out.push({ at: { x }, x: gx, y: this.ground - 10, label: 'Hier hinstellen' });
    }
    if (!this.geo.mega) for (const u of this.geo.units || []) {
      if (u.ui === 0 || (save.rig.units[u.ui + 1]?.level || 0) > (save.rig.units[u.ui]?.level || 0)) continue;
      const st = (T * 0.5) / u.cell;   // half a tile
      for (let p = -0.5 + st; p <= (u.places || 0) - 0.5 - st + 1e-6; p += st) { const pp = Math.round(p * 1000) / 1000, q = this.roofAt(u.ui, pp); if (q) out.push({ at: { ui: u.ui, p: pp }, x: q.x, y: q.y - 6, label: 'Aufs Dach' }); }
    }
    if (!this.geo.mega) L.forEach((o, j) => {
      const bd = decorDef(D, o.id);
      if (bd?.art !== 'balcony') return;
      const b = this.balconyAt(o.at.ui, o.at.side, bd);
      if (!b) return;
      const half = (b.x1 - b.x0) / 2 / T;
      for (let dx = -half + 0.4; dx <= half - 0.4 + 1e-6; dx += 0.25) out.push({ at: { on: `balc:${j}`, dx: Math.round(dx * 100) / 100 }, x: (b.x0 + b.x1) / 2 + dx * T, y: b.y - 6, label: 'Auf den Balkon', balc: true });
    });
    if (decorDef(D, id)?.stack) L.forEach((o, j) => {
      const top = this.kitTop(j), q = this.freePos(j), box = this.decorBoxes?.[j];
      if (top == null || !q || !box) return;
      const wide = (box.x1 - box.x0) > T * 1.1;
      for (const dx of wide ? [-0.3, 0, 0.3] : [0]) {
        const at = { on: `deco:${j}`, dx };
        if (freeWhy(D, save, id, at)) continue;
        out.push({ at, x: q.x + dx * T, y: q.y - top - 4, label: `Auf ${decorDef(D, o.id)?.name || 'das Stück'}`, stack: true });
      }
    });
    // #117 behind the rig (Daniel: „das Platzieren von Deko muss auch hinter den Containern möglich sein; ein neuer Container verschiebt
    // alles nach hinten“): tiles behind the last container's rear end, they move along when the rig gets longer (Camp › Deko › Hinter dem Rig)
    if (!this.geo.mega) { const n = D.camp?.decor?.rear ?? 8, rear = this.rigRear(); for (let r = 0.5; r <= n + 1e-6; r += 0.25) { const gx = rear - r * T; if (this.geo.yard && gx < this.geo.yard.x1 + T * 0.5) break; out.push({ at: { rear: r }, x: gx, y: this.ground - 10, label: 'Hinter das Rig' }); } }
    return out;
  }

  // a painted neon sign shines at night: a glowing copy above the night shade, a coloured light, flickering now and then
  neonGlow(img, look, fr, k, flip, x, cy, d, v, seed) {
    const s = this.scene, c = String(d.colors || '').split(',').map(t => t.trim())[v] || d.color || '#ff7ac0';
    const lit = this.dAdd(s.add.image(img.x, img.y, look, fr).setOrigin(0.5, 1).setScale(k).setFlipX(flip).setBlendMode(Phaser.BlendModes.ADD).setDepth(30.6).setAlpha(0));
    const glow = this.dAdd(s.add.image(x, cy, glowTexture(s)).setDisplaySize(img.displayWidth * 1.8, img.displayHeight * 1.8).setTint(col(c)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(-16.25));
    const l = this.light(x, cy + img.displayHeight * 0.6, Math.max(120, img.displayWidth * 1.4), c, 0.45); l.rig = true;
    this.decorAnim.push(time => { const off = Math.sin(time / 130 + seed * 40) > 0.985 || (seed > 0.6 && Math.sin(time / 47 + seed * 9) > 0.97), on = img.alpha > 0.01 ? 1 : 0; lit.setAlpha(on * (off ? 0.1 : 0.75) * (this.lightK || 0)); glow.setAlpha(on * (off ? 0.04 : 0.08 + 0.25 * (this.lightK || 0))); });
  }

  // #118 (Daniel: „Lichterketten auch innen“): a string of bulbs under the ceiling across the place (Deko › Größe: Breite in Plätzen)
  art_inlights(q, d, o, i) {
    const s = this.scene, u = q.u, n = Math.max(1, d.size?.[0] ?? 1), x0 = q.x - u.cell * n / 2 + 8, x1 = q.x + u.cell * n / 2 - 8, y = u.inTop + 10;
    const cat = catenary({ x: x0, y }, { x: x1, y }, 18 + 6 * n, Math.max(4, Math.round(5 * n))), g = this.dG(-16.3);
    g.lineStyle(2, 0x17111f, 0.95).beginPath(); cat.line.forEach((pt, k) => k ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y)); g.strokePath();
    const colors = String(d.colors || '#ffd27a,#fa6a0a,#e86a73,#a6fcdb').split(',').map(t => t.trim());
    cat.bulbs.forEach((b, j) => {
      const c = colors[j % colors.length];
      g.fillStyle(0x17111f).fillRect(Math.round(b.x) - 2, Math.round(b.y), 4, 3).fillStyle(col(c)).fillRect(Math.round(b.x) - 3, Math.round(b.y) + 3, 6, 6).fillStyle(0xffffff, 0.6).fillRect(Math.round(b.x) - 2, Math.round(b.y) + 4, 2, 2);
      if (j % 2 === 0) { const l = this.light(b.x, b.y + 6, 40, c, 0.32); l.rig = true; l.unit = u.ui; }
    });
    if (u.view) { const mid = (u.x0 + u.x1) / 2, G = u.base ?? this.ground, si = u.view.list.findIndex(o2 => o2.texture?.key === u.sprite?.key); s.children.remove(g); g.setPosition(-mid, -G); u.view.addAt(g, this.insideSlot(u.view, si, { floor: true })); }
    (this.decorBoxes ??= [])[i] = { x0, x1, y0: y - 10, y1: y + 30, x: q.x, y: y + 30 };
  }

  // ---- wall ----
  art_neon(x, y, w, h, d, seed, pick) {
    const s = this.scene, text = pick(d.text) || 'OPEN', c = d.color || '#ff7ac0', fs = Math.round(h * (d.look ? 0.62 : 0.82));
    if (d.look && s.textures.exists(d.look)) {   // the painted empty sign (Neon-Rahmen), stretched by its middle so the tube border stays crisp
      s.textures.get(d.look).setFilter(Phaser.Textures.FilterMode.NEAREST);
      const fr = d.icon ?? 0, f = s.textures.getFrame(d.look, fr), sl = Math.floor(Math.min(f.width, f.height) * 0.36);
      this.dAdd(s.add.nineslice(x, y, d.look, fr, w + 12, h + 10, sl, sl, sl, sl).setDepth(-19.2));
    } else {
      const g = this.dG(-19.2);
      this.dR(g, x - w / 2 - PX, y - h / 2 - PX, w + 2 * PX, h + 2 * PX, C.ink);
      this.dR(g, x - w / 2, y - h / 2, w, h, C.night);
      for (const sx of [x - w / 2 + 2 * PX, x + w / 2 - 3 * PX]) this.dR(g, sx, y - h / 2 - 4 * PX, PX, 4 * PX, C.steel);   // wires up
    }
    const t = this.dAdd(s.add.text(x, y, text, { fontFamily: 'VT323, monospace', fontSize: `${fs}px`, color: c, stroke: d.look ? '#141013' : '#ffffff', strokeThickness: d.look ? 4 : 1 }).setOrigin(0.5).setDepth(-19.1));
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
  // a picture from an icon sheet (Daniel, 17.11.2026: NomadCola-Automaten als Kauf-Deko): stands on its base (ground) or hangs centred
  // (wall, roof); the square cell is h high, its width follows (the transparent margins of the cell stay invisible)
  art_icon(x, y, w, h, d) {
    const s = this.scene;
    if (!d.look || !s.textures.exists(d.look)) return;
    s.textures.get(d.look).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const f = s.textures.getFrame(d.look, d.icon ?? 0), k = h / (f?.height || 64), ground = d.place !== 'wall';
    this.dAdd(s.add.image(x, ground ? y + 4 : y, d.look, d.icon ?? 0).setOrigin(0.5, ground ? 1 : 0.5).setScale(k).setDepth(ground ? -15.9 : -16.2));
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
  art_pole(x, y, w, h, d, seed, pick, o, i) {
    const s = this.scene;
    if (d?.grow && d.look && s.textures.exists(d.look)) {   // #116 head + shaft sections + foot; the top is the anchor
      const m = this.drawModular(d, o?.at, this.kitFrame(d, o?.at), x, y + 2, this.kitScale(d), !!o?.at?.f, -16.2);
      (this.decorBoxes ??= [])[i] = { x0: x - Math.max(30, m.w / 2), x1: x + Math.max(30, m.w / 2), y0: y - m.top, y1: y, x, y, top: m.top };
      return;
    }
    if (d?.look && s.textures.exists(d.look)) {
      s.textures.get(d.look).setFilter(Phaser.Textures.FilterMode.NEAREST);
      const fr = this.kitFrame(d, o?.at), f = s.textures.getFrame(d.look, fr), c = this.kitContent(d.look, fr) || { h: f.height }, k = (h + 8) / c.h;
      return this.dAdd(s.add.image(x, y + 2, d.look, fr).setOrigin(0.5, 1).setScale(k).setFlipX(!!o?.at?.f).setDepth(-16.2));
    }
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
  // a standing mirror (#044): rusty frame on two feet, glass with a sheen; E = Leylas Signaturfarbe (game/play/signature.js)
  art_mirror(x, y, w, h, d) {
    const g = this.dG(-15.6), [fc, gc] = String(d.colors || '#bb7547,#b9bffb').split(',').map(c => c.trim()), fw = Math.max(10 * PX, w * 0.7), fh = h * 0.8, top = y - h;
    this.dR(g, x - fw / 2 - 2 * PX, y - 2 * PX, 3 * PX, 2 * PX, C.ink); this.dR(g, x + fw / 2 - PX, y - 2 * PX, 3 * PX, 2 * PX, C.ink);   // feet
    this.dR(g, x - fw / 2, y - h * 0.2, PX, h * 0.2, C.ink); this.dR(g, x + fw / 2 - PX, y - h * 0.2, PX, h * 0.2, C.ink);
    this.dR(g, x - fw / 2 - PX, top - PX, fw + 2 * PX, fh + 2 * PX, C.ink);
    this.dR(g, x - fw / 2, top, fw, fh, fc);
    this.dR(g, x - fw / 2 + 2 * PX, top + 2 * PX, fw - 4 * PX, fh - 4 * PX, gc, 0.85);
    this.dR(g, x - fw / 2 + 2 * PX, top + 2 * PX, fw - 4 * PX, fh * 0.35, '#ffffff', 0.18);
    for (let k = 0; k < 3; k++) this.dR(g, x - fw / 2 + (4 + k * 3) * PX, top + (4 + k * 5) * PX, PX, (6 - k) * PX, '#ffffff', 0.55);   // the sheen
    this.hotspots.push({ rig: true, x, w: Math.max(70, fw), name: d.name || 'Spiegel', hint: 'Haare färben', act: () => this.mirrorMenu(d) });
  }
  mirrorMenu(d) {
    const s = this.scene, D = this.D, save = this.box.save;
    const rows = mirrorRows(D, save, id => have(D, save, id)), P = D.assets?.[D.leyla?.inventory?.portrait], url = P?.file ? new URL(P.file, s.base).href : null;
    // the focused colour in the glass: Leyla dyed with it (made once per colour, then cached)
    const show = i => { if (!url || !s.hud.mirrorImg) return; const img = s.hud.mirrorImg, u = dyedUrl(D, save, url, () => { if (s.hud.menuIndex === i) img.src = dyedUrl(D, save, url, null, i); }, i); img.src = u; };
    const name = id => D.items?.[id]?.name || id;
    s.hud.menu({ title: d.name || 'Spiegel', sub: 'Leylas Signaturfarbe: Haare und Akzente. Ein Färbemittel schaltet eine Farbe für immer frei.', mirror: { image: url ? dyedUrl(D, save, url, null) : null },
      items: rows.map(r => ({ label: r.name, primary: r.on, swatch: r.color || '#ff7ac0',
        sub: [r.brand, r.on ? 'trägst du' : r.unlocked ? 'frei' : `${r.have} da`].filter(Boolean).join(' · '),
        disabled: !r.on && !r.unlocked && !r.have ? [r.brand, 'fehlt'].filter(Boolean).join(' · ') : null,
        onFocus: () => show(r.i),
        act: () => { if (r.on) return; const res = dye(D, save, r.i, (id, n) => take(D, save, id, n)); if (!res.ok) return s.hud.toast(res.reason, '', 'warn', 2600); s.box.persist?.(); s.goCamp({ banner: [`Signaturfarbe: ${r.name}`, res.used ? 'Ein Färbemittel verbraucht' : 'Schon freigeschaltet'], fade: 500, keepPlace: true }); } })) });
    show(rows.find(r => r.on)?.i ?? 0);
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
  // #116 on top of a tower the camera zooms out: the higher, the further Leyla sees (Deko › Wachsen › Weitblick je Etage)
  towerView(dt) {
    const s = this.scene, l = s.leyla, cam = s.cam;
    if (!cam || !l?.body || s.hud?.build?.active || cam.zoomEffect?.isRunning) return;
    const base = s.data_.game?.camera?.zoom || 1, feet = l.body.bottom;
    const t = (this.towers || []).find(w => l.x >= w.x0 && l.x <= w.x1 && Math.abs(feet - w.y) < 6 && l.body.blocked.down);
    const want = t ? base / (1 + (t.view || 0) / 100 * (t.n + 1)) : base;
    if (!t && !this.towerZoomed) return;
    this.towerZoomed = !!t || Math.abs(cam.zoom - base) > 0.002;
    cam.setZoom(cam.zoom + (want - cam.zoom) * Math.min(1, dt / 600));
    if (!this.towerZoomed) cam.setZoom(base);
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
    const s = this.scene;
    if (d.look && s.textures.exists(d.look)) {
      s.textures.get(d.look).setFilter(Phaser.Textures.FilterMode.NEAREST);
      const f = s.textures.getFrame(d.look, 0), k = (b.x1 - b.x0) / f.width, floor = (d.hook?.[1] ?? 33) * k, wallLeft = !!side;
      this.dAdd(s.add.image(wallLeft ? b.x0 : b.x1, b.y - floor, d.look, 0).setOrigin(wallLeft ? 0 : 1, 0).setScale(k).setFlipX(!wallLeft).setDepth(-17.5));
      return this.walkZone(b.x0, b.x1, b.y);
    }
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
  // the deck of a (grown) tower: where Leyla stands, and the painted ladder up to it
  towerDeck(d, at, x) {
    const fr = this.kitFrame(d, at), G = this.modGeo(d, at, fr), k = this.kitScale(d), [hx, hy] = d.hook || [G.f.width / 2, G.f.height * 0.36];
    return { y: this.ground - (G.H - G.my(hy)) * k, lx: x + (G.mx(hx) - G.W / 2) * k, x0: x - G.W * k / 2, x1: x + G.W * k / 2, n: this.growOf(d, at).n };
  }
  art_tower(x, y, w, h, d, seed, pick, o, i) {
    const s = this.scene, T = s.T;
    if (d.grow && d.look && s.textures.exists(d.look)) {   // #116 storeys: the deck and the ladder grow with them
      const m = this.drawModular(d, o?.at, this.kitFrame(d, o?.at), x, y + 2, this.kitScale(d), false, -16.6), dk = this.towerDeck(d, o?.at, x);
      this.walkZone(dk.x0 + 10, dk.x1 - 10, dk.y);
      s.ladders.push({ cx: dk.lx, x0: dk.lx - T / 2, x1: dk.lx + T / 2, top: dk.y, bottom: y, rig: true });
      (this.towers ??= []).push({ x0: dk.x0, x1: dk.x1, y: dk.y, n: dk.n, view: d.growView || 0, start: d.growStart ?? 1 });
      (this.decorBoxes ??= [])[i] = { x0: dk.x0, x1: dk.x1, y0: y - m.top, y1: y, x, y, top: m.top };
      return;
    }
    if (d.look && s.textures.exists(d.look)) {
      s.textures.get(d.look).setFilter(Phaser.Textures.FilterMode.NEAREST);
      const f = s.textures.getFrame(d.look, 0), [hx, hy] = d.hook || [f.width / 2, f.height * 0.36], k = h / (f.height - hy), top = y - h, x0 = x - f.width * k / 2;
      this.dAdd(s.add.image(x, y + 2, d.look, 0).setOrigin(0.5, 1).setScale(k).setDepth(-16.6));
      this.walkZone(x0 + 6 * k, x0 + (f.width - 6) * k, top);
      const lx = x0 + hx * k;
      s.ladders.push({ cx: lx, x0: lx - T / 2, x1: lx + T / 2, top, bottom: y, rig: true });
      return;
    }
    const g = this.dG(-16.6), top = y - h, pw = Math.max(w, 1.6 * T);
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
    this.towerView(dt);
    for (const f of this.decorAnim || []) f(time, dt);
    this.updateCrows(time);
  }
}

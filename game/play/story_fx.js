// Erzählschicht im POI (#167 G1): Tropes als Spuren-Bausteine (gemalt oder aus Code), Zettel zum Lesen (E), der Splitter des Ortes,
// Durchsagen, Funk und AvAs Worte beim Betreten, Leylas Spuren vom letzten Besuch (offene Kisten, kaputte Sirenen, der Fleck des Bosses)
// und das Aufzeichnen neuer Spuren. Was gefunden wird, steht als Meldung im Bild und wandert ins Logbuch (Kategorie Story); wichtige Funde
// kommentiert AvA kurz. Logic in engine/storylets.js, engine/history.js, engine/tropes.js.
import { storyContext, pickStorylets, render, see, nextMemory, eligible, storyState, visit, fits, rng, hashStr } from '../../engine/storylets.js';
import { addTrace, freshTraces, tidyTraces } from '../../engine/history.js';
import { planTropes, tropeSpots } from '../../engine/tropes.js';
import { roomStory } from '../../engine/story.js';
import { alarmPoints } from './traits/alarm.js';

const GANG_COLORS = { Gelb: 0xf9a31b, Orange: 0xfa6a0a, Magenta: 0xbc4a9b, Cyan: 0x20d6c7, Rot: 0xb4202a, Grün: 0x59c135, Blau: 0x249fde, Weiß: 0xdae0ea, Schwarz: 0x333941, Violett: 0x793a80 };

export class StoryFx {
  constructor(scene) {
    const s = this.scene = scene, LI = s.levelInfo, D = this.D = s.data_;
    this.on = !!LI?.def && !!s.levelPoi && (s.mode === 'run' || s.mode === 'test') && !s.megarig;
    this.notes = []; this.tropes = []; this.splinter = null; this.said = [];
    if (!this.on) return;
    this.T = s.T; this.seed = s.levelSeed || 0; this.poi = s.levelPoi;
    const save = this.save = s.box?.save || null;
    this.node = save?.run?.location || s.levelPoi;
    if (save) { storyState(save); tidyTraces(D, save); this.visits = visit(save, this.node); }
    this.ctx = storyContext(D, save, this.node);
    this.r = rng((this.seed ^ hashStr('story:' + this.node + ':' + (this.visits || 0))) >>> 0);
    this.g = s.add.graphics().setDepth(-3.4);
    this.wall = s.add.graphics().setDepth(-9.6);
    this.applyTraces();
    this.placeTropes();
    this.placeNotes();
    this.placeSplinter();
    this.scheduleVoices();
  }
  get H() { return this.D.history || {}; }

  // ---------- where things lie ----------
  roomAt(tx, ty) { const LI = this.scene.levelInfo; return LI?.rooms?.find(r => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) || null; }
  taken(x, y, w = 1) { return (this.used ??= []).some(([ux, uy, uw]) => uy === y && x < ux + uw + 1 && x + w + 1 > ux); }
  take(x, y, w = 1) { (this.used ??= []).push([x, y, w]); }
  // a free floor spot in a room of these roles (rest rooms first: „Die Atempause ist ein Story-Raum“), never the first room
  spot(roles = [], { prefer = 'rest', w = 1 } = {}) {
    const LI = this.scene.levelInfo, tiles = LI.def.layout, P = this.D.pois?.[this.poi] || {};
    const rooms = LI.rooms.map((rm, i) => ({ rm, i })).filter(({ i }) => i > 0)
      .filter(({ rm }) => !roles.length || roles.includes(roomStory(P, this.D.rooms?.[rm.id] || {}).role));
    const order = rooms.sort((a, b) => ((b.rm[prefer] ? 1 : 0) - (a.rm[prefer] ? 1 : 0)) || (this.r() - 0.5));
    for (const { rm } of order) {
      const spots = tropeSpots(tiles, rm, w).filter(([x, y]) => !this.taken(x, y, w));
      if (spots.length) { const [x, y] = spots[Math.floor(this.r() * spots.length)]; this.take(x, y, w); return { x, y, room: rm }; }
    }
    return null;
  }

  // ---------- tropes ----------
  placeTropes() {
    const s = this.scene, T = this.T, D = this.D;
    for (const p of planTropes(D, this.poi, s.levelInfo, this.seed, this.ctx)) {
      const t = D.tropes[p.id], cx = (p.x + p.w / 2) * T, feet = (p.y + 1) * T;
      this.take(p.x, p.y, p.w);
      const item = { id: p.id, x: cx, feet, w: p.w, place: p.place, room: s.levelInfo.rooms[p.room]?.id, art: null };
      if ((t.decals || []).length) s.dressingFx?.drawTale?.({ decals: t.decals }, { x: p.x - 1, y: p.y - 2, w: p.w + 2, h: 3 });
      const info = t.image && s.assetInfo(t.image);
      if (info) {
        const src = s.textures.get(t.image).getSourceImage(), pxPerCm = (D.assets?.[D.leyla?.look?.idle]?.height || 192) / (D.game?.tiles?.leylaCm || 170);
        const k = (t.cm ?? 100) * pxPerCm / src.height, wall = p.place === 'wall';
        item.art = s.add.image(cx, wall ? feet - T * 0.55 : feet + 2, t.image).setOrigin(info.ox, info.oy).setScale(k).setDepth(wall ? -9.6 : -3.5);
        if (wall) item.art.setTint(0xc8c0c8).setAlpha(0.92);
        if (this.r() < 0.5 && !wall) item.art.setFlipX(true);
      } else this.drawArt(t, item);
      this.tropeLight(t, item, p);
      if (p.note && D.storylets?.[p.note] && fits(D, this.ctx, { ...D.storylets[p.note], id: p.note, weight: 1 })) this.addNote(p.note, cx + (p.w / 2 + 0.4) * T, feet);
      this.tropes.push(item);
    }
  }
  // #170 (Tropes sichtbarer): a soft key light of its own from above, so the scene reads in a dark room.
  // Tropes › Licht (else Zeitschichten › Erzählen › Trope-Licht); strength 0 = none
  tropeLight(t, item, p) {
    const s = this.scene, A = s.atmo, H = this.D.history?.tropeLight || {};
    if (!A?.on || !A.lights) return;
    const strength = t.lightStrength ?? H.strength ?? 45;
    if (!(strength > 0)) return;
    const h = item.art ? item.art.displayHeight : this.T * 1.4, base = p.place === 'wall' ? item.feet - this.T * 0.55 : item.feet;
    const hex = String(t.light || H.color || '#ffd9a0').replace('#', ''), c = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) || 0);
    const x = item.x, y = base - h - (H.above ?? 70), radius = t.lightRadius || H.radius || Math.max(260, h * 2.4);
    const halo = s.add.image(x, y, s.fx.glowKey()).setVisible(false);
    item.light = { kind: 'ceiling', x, y, c, radius, strength: strength / 100, behavior: t.lightBehavior || 'steady', seed: ((x * 13 + y * 7) % 1000) / 1000, clip: null, halo, haloA: 0, f: 1, trope: t.name || item.id };
    A.lights.push(item.light);
  }
  // tropes without a picture: an advert against reality, a machine that runs on, the new order of a gang
  drawArt(t, it) {
    const s = this.scene, g = t.place === 'wall' ? this.wall : this.g, T = this.T, x = it.x, f = it.feet;
    if (t.art === 'ad') {
      const brands = Object.values(this.D.brands || {}).filter(b => b.slogan), b = brands[Math.floor(this.r() * brands.length)];
      const w = T * 1.9, h = T * 1.2, y = f - T * 2.2;
      g.fillStyle(0xe4d2aa, 1).fillRect(x - w / 2, y, w, h); g.fillStyle([0xb4202a, 0x249fde, 0xf9a31b, 0x59c135][Math.floor(this.r() * 4)], 1).fillRect(x - w / 2 + 6, y + 6, w - 12, h * 0.45);
      g.fillStyle(0x5a4e44, 0.5).fillTriangle(x + w / 2 - 30, y + h, x + w / 2, y + h, x + w / 2, y + h - 26);   // torn corner
      if (b) it.label = s.add.text(x, y + h * 0.72, `„${b.slogan}“`, { fontFamily: 'VT323, monospace', fontSize: '20px', color: '#322b28', align: 'center', wordWrap: { width: w - 12 } }).setOrigin(0.5).setDepth(-9.55);
    } else if (t.art === 'machine') {
      g.fillStyle(0x4a5462, 1).fillRect(x - 22, f - 92, 44, 92); g.fillStyle(0x333941, 1).fillRect(x - 16, f - 84, 32, 30); g.fillStyle(0x8b93af, 1).fillRect(x - 10, f - 40, 20, 14);
      const led = s.add.rectangle(x + 10, f - 48, 6, 6, 0x59c135).setDepth(-3.3);
      s.tweens.add({ targets: led, alpha: 0.15, duration: 520, yoyo: true, repeat: -1 });
      it.timer = s.time.addEvent({ delay: 1700, loop: true, callback: () => s.fx?.puff?.(x - 4, f - 96, 0xdae0ea) });
    } else if (t.art === 'order') {
      const G = this.D.pois?.[this.poi]?.gang, col = GANG_COLORS[(Object.values(this.D.pois || {}).find(P => P.gang?.name === this.ctx.owner)?.gang || G)?.color] ?? 0xb4202a;
      for (let i = 0; i < 3; i++) { const bx = x - T * 1.2 + i * T * 0.82; g.fillStyle(0x71413b, 1).fillRect(bx, f - 46, 46, 46); g.lineStyle(2, 0x3b1725, 1).strokeRect(bx, f - 46, 46, 46); g.fillStyle(col, 0.9).fillRect(bx + 6, f - 30, 34, 8); }
    }
  }

  // ---------- notes ----------
  addNote(id, x, feet) {
    const g = this.g, glow = this.scene.add.circle(x, feet - 8, 16, 0xfef3c0, 0.0).setDepth(-3.45).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(0xe4d2aa, 1).fillRect(x - 11, feet - 5, 22, 5); g.fillStyle(0xfef3c0, 1).fillRect(x - 9, feet - 7, 18, 4);
    g.fillStyle(0x796755, 1).fillRect(x - 7, feet - 6, 12, 1).fillRect(x - 7, feet - 4, 9, 1);
    this.scene.tweens.add({ targets: glow, fillAlpha: 0.28, duration: 1100, yoyo: true, repeat: -1, delay: this.r() * 900 });
    const n = { id, x, feet, read: false, glow };
    this.notes.push(n);
    return n;
  }
  placeNotes() {
    const D = this.D, [lo, hi] = this.H.notes?.perVisit || [1, 2], want = lo + Math.floor(this.r() * (Math.max(lo, hi) - lo + 1));
    const have = new Set(this.notes.map(n => n.id));
    for (const [id, st] of pickStorylets(D, this.ctx, 'note', want + have.size, this.seed + (this.visits || 0)).filter(([id]) => !have.has(id)).slice(0, want)) {
      const p = this.spot(st.roles || []) || this.spot([]);
      if (p) this.addNote(id, (p.x + 0.5) * this.T, (p.y + 1) * this.T);
    }
  }
  read(n) {
    const s = this.scene, D = this.D, st = D.storylets?.[n.id]; if (!st || n.read) return;
    n.read = true; n.glow?.destroy(); n.glow = null;
    const R = render(D, this.ctx, { ...st, id: n.id });
    if (this.save) see(this.save, n.id, D);
    s.hud.toast(R.title, R.text, 'story', 7000, { cat: 'story' });
    s.drone?.react?.('curious');
    if (R.important && R.ava) this.avaSay(R.ava);
    s.box?.persist?.();
  }

  // ---------- the Splitter of this place ----------
  placeSplinter() {
    const D = this.D, S = this.save ? storyState(this.save) : null;
    if (S?.shards?.[this.node] != null || !nextMemory(D, this.save)) return;
    const [hit] = eligible(D, this.ctx, 'splinter');
    if (!hit || this.r() * 100 >= (this.H.notes?.splinter ?? 100)) return;
    const p = this.spot([], { prefer: 'wow' }); if (!p) return;
    const s = this.scene, x = (p.x + 0.5) * this.T, feet = (p.y + 1) * this.T;
    const glow = s.add.image(x, feet - 22, s.textures.exists('fx_glow') ? 'fx_glow' : '__WHITE').setBlendMode(Phaser.BlendModes.ADD).setDepth(-3.3).setTint(0x20d6c7).setScale(1.4).setAlpha(0.6);
    s.tweens.add({ targets: glow, alpha: 0.2, scale: 1.1, duration: 800, yoyo: true, repeat: -1 });
    const g = this.g; g.fillStyle(0x20d6c7, 1).fillTriangle(x - 7, feet, x + 7, feet, x + 2, feet - 26); g.fillStyle(0xa6fcdb, 1).fillTriangle(x - 2, feet - 2, x + 3, feet - 2, x + 1, feet - 18);
    this.splinter = { id: hit[0], x, feet, taken: false, glow };
  }
  takeSplinter() {
    const sp = this.splinter, s = this.scene, D = this.D; if (!sp || sp.taken) return;
    sp.taken = true; sp.glow?.destroy();
    this.g.fillStyle(0x221c1a, 1).fillRect(sp.x - 9, sp.feet - 28, 18, 28);   // the crystal is gone
    const find = render(D, this.ctx, { ...D.storylets[sp.id], id: sp.id }), mem = nextMemory(D, this.save);
    if (this.save) { see(this.save, sp.id, D); storyState(this.save).shards[this.node] = this.save.day ?? 1; }
    s.fx?.sparks?.(sp.x, sp.feet - 20, 0x20d6c7, 18);
    s.hud.toast(find.title, find.text, 'story', 7000, { cat: 'story' });
    s.drone?.react?.('love');
    if (!mem) return;
    const M = render(D, this.ctx, { ...mem[1], id: mem[0] });
    if (this.save) see(this.save, mem[0], D);
    sp.memory = mem[0];
    s.time.delayedCall(1200, () => s.hud.toast(M.title, M.text, 'story', 8000, { cat: 'story' }));
    if (M.ava) this.avaSay(M.ava, 1200 + (this.H.ava?.delay ?? 1400));
    s.box?.persist?.();
  }

  // ---------- AvA, announcements, radio ----------
  avaSay(text, delay = this.H.ava?.delay ?? 1400) {
    const s = this.scene;
    this.said.push(text);
    s.time.delayedCall(delay, () => { s.hud.toast('AvA', text, 'ava', 6000, { cat: 'story' }); s.drone?.react?.('curious'); });
  }
  scheduleVoices() {
    const s = this.scene, D = this.D, N = this.H.notes || {}, seed = this.seed + (this.visits || 0);
    const avas = pickStorylets(D, this.ctx, 'ava', 4, seed), ava = avas.find(([, x]) => x.important) || avas[0];   // an event (aufgeräumt, übernommen) goes first
    if (ava) { const R = render(D, this.ctx, { ...ava[1], id: ava[0] }); if (this.save) see(this.save, ava[0], D); this.avaSay(R.text, 2600); }
    const [an] = this.r() * 100 < (N.announce ?? 70) ? pickStorylets(D, this.ctx, 'announce', 1, seed) : [];
    if (an) s.time.delayedCall(4800, () => this.say(an));
    const [ra] = this.r() * 100 < (N.radio ?? 50) ? pickStorylets(D, this.ctx, 'radio', 1, seed) : [];
    if (ra) s.time.delayedCall((N.radioAfter ?? 45) * 1000, () => this.say(ra));
  }
  say([id, st]) {
    const R = render(this.D, this.ctx, { ...st, id });
    if (this.save) see(this.save, id, this.D);
    this.scene.hud.toast(R.title, R.text, 'story', 6500, { cat: 'story' });
    if (R.important && R.ava) this.avaSay(R.ava);
    (this.heard ??= []).push(id);
  }

  // ---------- Leyla's traces ----------
  // what she left last time: chests at the same place in the same room stay open and empty, sirens stay broken, the boss's stain lies there
  applyTraces() {
    if (!this.save) return;
    const s = this.scene, T = this.T, LI = s.levelInfo, lv = s.level;
    this.old = freshTraces(this.D, this.save, this.node);
    for (const t of this.old) {
      const rm = LI.rooms.find(r => r.id === t.room); if (!rm || t.rx == null) continue;
      const x = (rm.x + t.rx + 0.5) * T, feet = (rm.y + t.ry + 1) * T;
      if (t.kind === 'chest') { const c = lv?.chests?.find(c => !c.bonus && Math.abs(c.x - x) < T / 2 && Math.abs(c.feet - feet) < T / 2); if (c) { c.open = true; c.looted = true; c.trace = t.fade; if (c.sprite) c.sprite.setFrame(Math.max(0, (c.frames || 1) - 1)).setAlpha(0.75 + 0.25 * t.fade); else lv.drawChest(c); } }
      if (t.kind === 'siren') { const p = alarmPoints(s).find(p => Math.abs(p.x - x) < T / 2 && Math.abs(p.feet - feet) < T * 3); if (p) { p.broken = true; p.on = false; p.hp = 0; p.trace = t.fade; } }
      if (t.kind === 'boss') this.drawStain(x, feet, t.fade);
      if (t.kind === 'door') lv?.doorways?.applyTrace(t);   // #174 the door she broke stays broken
    }
  }
  drawStain(x, feet, a = 1) {
    const g = this.g;
    g.fillStyle(0x3b1725, 0.85 * a).fillEllipse(x, feet - 2, 150, 12); g.fillStyle(0x73172d, 0.6 * a).fillEllipse(x - 20, feet - 3, 70, 7).fillCircle(x + 58, feet - 3, 5);
    g.lineStyle(2, 0xdae0ea, 0.55 * a).strokeEllipse(x, feet - 6, 190, 22);   // chalk ring of the gang
    (this.stains ??= []).push({ x, feet, alpha: +a.toFixed(2) });
  }
  // a new trace now: kind chest | siren | boss at a world point
  trace(kind, x, feet) {
    if (!this.on || !this.save) return null;
    const T = this.T, tx = Math.floor(x / T), ty = Math.floor(feet / T) - 1, rm = this.roomAt(tx, ty);
    return addTrace(this.save, this.node, { kind, room: rm?.id || null, rx: rm ? tx - rm.x : null, ry: rm ? ty - rm.y : null });
  }

  // ---------- E ----------
  nearest(close) {
    if (!this.on) return null;
    if (this.splinter && !this.splinter.taken && close(this.splinter)) return { text: 'Splitter aufheben', act: () => this.takeSplinter() };
    for (const n of this.notes) if (!n.read && close(n)) return { text: 'Zettel lesen', act: () => this.read(n) };
    return null;
  }
  state() {
    return { on: this.on, node: this.node, visits: this.visits || 0, layers: this.ctx?.layers?.map(l => l.text) || [],
      notes: this.notes.map(n => ({ id: n.id, x: Math.round(n.x), feet: n.feet, read: n.read })), tropes: this.tropes.map(t => ({ id: t.id, x: Math.round(t.x), feet: t.feet, room: t.room, image: !!t.art, h: t.art ? Math.round(t.art.displayHeight) : 0, light: t.light ? Math.round(t.light.strength * 100) : 0 })),
      splinter: this.splinter ? { id: this.splinter.id, x: Math.round(this.splinter.x), feet: this.splinter.feet, taken: this.splinter.taken, memory: this.splinter.memory || null } : null,
      old: (this.old || []).map(t => ({ kind: t.kind, room: t.room, fade: +t.fade.toFixed(2) })), stains: this.stains || [], said: this.said, heard: this.heard || [] };
  }
}

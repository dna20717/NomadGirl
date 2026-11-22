// Türen im Spiel (#174, engine/doors.js plans them). Two kinds:
//   side  Durchgangstüren im Profil („/“ in the layout): shut = a solid zone and solid tiles (sight lines, shots, fog stop there), E opens
//         and shuts them, enemies open them while they hunt (Spiel › Türen › Gegner öffnen Türen), hits, shots and grenades break them by
//         material (Welt › Türen › Leben, Zerstörbar durch); a broken door stays broken as one of Leyla's traces (#167). Locked ones:
//         E hacks them (Glitch-Duell), or force breaks them.
//   front Rückwand-Türen frontal: scenery on the back wall; a paired one (link) is a real way: E steps through into its partner.
// Pictures: the door sets of Welt › Türen (PixelLab, AAP-64, 32 px per tile, scaled sharp); an open swing door shows its leaf narrow
// beside the doorway (like Terraria), a sliding door and a shutter pull into the wall / the box above.
import { addTrace } from '../../engine/history.js';
import { doorConfig, pickType, hash } from '../../engine/doors.js';
import { hullConfig } from '../../engine/facade.js';

const NEAREST = () => Phaser.Textures.FilterMode.NEAREST;
const col = c => { try { return Phaser.Display.Color.HexStringToColor(c || '#796755').color; } catch { return 0x796755; } };

export class Doors {
  constructor(scene, level) {
    const s = this.scene = scene; this.level = level; this.T = s.T; this.D = s.data_;
    this.cfg = doorConfig(this.D);
    const plan = s.levelInfo?.doors || this.fromMarks();
    this.side = (plan.side || []).map(p => this.makeSide(p)).filter(Boolean);
    this.front = (plan.front || []).map(p => this.makeFront(p)).filter(Boolean);
    this.hits = 0; this.broke = 0; this.opened = 0;
  }
  // a single room with „/“ marks (test rooms, hand-built layouts without the planner)
  fromMarks() {
    const s = this.scene, R = s.room, out = { side: [], front: [] }, seen = new Set(), type = Object.keys(this.D.doors || {})[0];
    if (!type) return out;
    for (const [x, y] of R.marks?.['/'] || []) {
      if (seen.has(x + ',' + y)) continue;
      let y1 = y; while (R.tiles[y1 + 1]?.[x] === '/') { y1++; seen.add(x + ',' + y1); }
      out.side.push({ id: `d${out.side.length}`, x, y, h: y1 - y + 1, feet: y1, kind: 'hand', type, material: this.D.doors[type].material, state: 'closed', room: s.roomId, rx: x, ry: y1 });
    }
    return out;
  }
  img(id) { return id && this.scene.textures.exists(id) ? id : null; }

  // ---------- side doors ----------
  makeSide(p) {
    const s = this.scene, T = this.T, t = this.D.doors?.[p.type];
    if (!t) return null;
    const d = { p, t, x: p.x, y0: p.y, y1: p.feet, cx: (p.x + 0.5) * T, top: p.y * T, feet: (p.feet + 1) * T, h: (p.feet - p.y + 1) * T, state: p.state, hp: t.health ?? 40, dir: hash(p.x, p.feet, 5) < 0.5 ? -1 : 1, lastHit: -1e9, tried: false };
    const closedKey = this.img(t.side?.closed), brokenKey = this.img(t.side?.broken), leafKey = this.img(t.front?.closed);
    // the casing stays whatever happens to the leaf: a header under the lintel, two jambs, a threshold (it reads as a doorway, not a pole)
    {
      const g = d.frame = s.add.graphics().setDepth(-9.3), x0 = p.x * T, c = col(t.splinter), dark = 0x15131a;
      g.fillStyle(dark, 1).fillRect(x0 - 4, d.top, T + 8, 12); g.fillStyle(c, 0.9).fillRect(x0 - 4, d.top + 9, T + 8, 3);
      for (const jx of [x0 - 2, x0 + T - 6]) { g.fillStyle(dark, 1).fillRect(jx, d.top, 8, d.h); g.fillStyle(c, 0.55).fillRect(jx + 2, d.top + 10, 2, d.h - 12); }
      g.fillStyle(dark, 1).fillRect(x0 - 6, d.feet - 5, T + 12, 5);
    }
    if (closedKey) {
      s.textures.get(closedKey).setFilter(NEAREST());
      const src = s.textures.get(closedKey).getSourceImage(), k = d.h / src.height;
      d.k = k; d.srcH = src.height;
      d.sprite = s.add.image(d.cx, d.feet, closedKey).setOrigin(0.5, 1).setScale(k).setDepth(-9.2);
    } else {   // from code: a plain slab
      d.sprite = s.add.rectangle(d.cx, d.feet, T * 0.36, d.h, col(t.splinter)).setOrigin(0.5, 1).setDepth(-9.2);
      d.k = 1; d.srcH = d.h;
    }
    if (brokenKey) {
      s.textures.get(brokenKey).setFilter(NEAREST());
      const src = s.textures.get(brokenKey).getSourceImage();
      d.wreck = s.add.image(d.cx, d.feet, brokenKey).setOrigin(0.5, 1).setScale(d.h / src.height).setDepth(-9.2).setVisible(false);
    }
    // the leaf of a swinging door stands beside the doorway when open: the frontal picture, narrow and a little darker (it faces the camera)
    if ((t.opening || 'swing') === 'swing' && leafKey) {
      s.textures.get(leafKey).setFilter(NEAREST());
      const src = s.textures.get(leafKey).getSourceImage(), k = d.h * 0.98 / src.height;
      d.leaf = s.add.image(d.cx, d.feet, leafKey).setOrigin(0.5, 1).setScale(k * 0.42, k).setDepth(-10.5).setTint(0xb8b4c0).setVisible(false);
    }
    // a little red lamp on locked doors (like the cycle graph's locks)
    if (p.state === 'locked') d.lamp = s.add.circle(d.cx, d.top + d.h * 0.45, 5, 0xff4060).setDepth(-9.1);
    this.setState(d, p.state, true);
    return d;
  }
  shut(d) { return d.state === 'closed' || d.state === 'locked'; }
  // tiles, body and pictures follow the state; quiet = no animation (setup, traces)
  setState(d, state, quiet = false) {
    const s = this.scene, T = this.T, was = d.state;
    d.state = state;
    const shut = this.shut(d);
    for (let y = d.y0; y <= d.y1; y++) if (s.room.tiles[y]) s.room.tiles[y][d.x] = shut ? '/' : '.';
    if (shut && !d.zone) { d.zone = s.add.zone(d.cx, d.top + d.h / 2, T, d.h); s.solids.add(d.zone); }
    if (!shut && d.zone) { s.solids.remove(d.zone, true, true); d.zone = null; }
    const opening = d.t.opening || 'swing';
    s.tweens.killTweensOf([d.sprite, d.leaf].filter(Boolean));
    if (state === 'broken') {
      d.sprite.setVisible(false); d.leaf?.setVisible(false); d.wreck?.setVisible(true); d.lamp?.destroy(); d.lamp = null;
      if (!d.wreck) d.sprite.setVisible(true).setAlpha(0.5).setScale(d.k * 0.6, d.k * 0.35);
      return;
    }
    d.wreck?.setVisible(false);
    if (state === 'open') {
      if (opening === 'swing' && d.leaf) {
        // the leaf swings away from whoever opened it, against the wall beside the doorway
        const lw = d.leaf.displayWidth, x = d.cx + d.dir * (T * 0.5 + lw / 2 - 4);
        d.leaf.setPosition(x, d.feet).setVisible(true);
        if (!quiet) { d.leaf.setAlpha(0); s.tweens.add({ targets: d.leaf, alpha: 1, duration: 160 }); s.tweens.add({ targets: d.sprite, alpha: 0, duration: 120, onComplete: () => d.sprite.setVisible(false).setAlpha(1) }); }
        else d.sprite.setVisible(false);
      } else {   // slide into the wall / roll up into the box: only the top stays
        d.sprite.setVisible(true).setAlpha(1);
        const keep = opening === 'roll' ? 0.2 : 0.08, full = d.srcH;
        if (d.sprite.setCrop) {
          if (quiet) d.sprite.setCrop(0, 0, d.sprite.width, full * keep);
          else { const o = { h: full }; s.tweens.add({ targets: o, h: full * keep, duration: opening === 'roll' ? 700 : 380, ease: 'Sine.easeInOut', onUpdate: () => d.sprite.setCrop(0, 0, d.sprite.width, o.h) }); }
          // the crop is from the top, but the picture hangs from its feet: lift it so the kept part sits under the lintel
          d.sprite.setOrigin(0.5, 0).setY(d.top);
        } else d.sprite.setVisible(false);
      }
      return;
    }
    // shut (closed / locked)
    d.leaf?.setVisible(false);
    d.sprite.setOrigin(0.5, 1).setY(d.feet).setVisible(true).setAlpha(1);
    if (d.sprite.setCrop) d.sprite.setCrop();
    if (!quiet && was === 'open') { d.sprite.setScale(d.k * 0.3, d.k); s.tweens.add({ targets: d.sprite, scaleX: d.k, duration: 140 }); }
  }
  sound(d, what) {
    const id = d.t.sounds?.[what] || { open: 'door_swing', shut: 'door_shut', hit: 'door_hit_wood', break: 'door_break_wood' }[what];
    this.scene.sfx?.(id, { x: d.cx });
  }
  // something stands in the doorway (Leyla, an enemy): it cannot shut
  blocked(d) {
    const s = this.scene, x0 = d.x * this.T, x1 = x0 + this.T, inside = b => b.right > x0 + 2 && b.left < x1 - 2 && b.bottom > d.top && b.top < d.feet;
    return inside(s.leyla.body) || (s.enemies || []).some(e => e.alive && inside(e.body));
  }
  open(d, by = null) {
    if (!this.shut(d)) return false;
    if (by) d.dir = Math.sign(d.cx - by.x) || d.dir;   // swings away from the opener
    this.setState(d, 'open');
    this.sound(d, 'open'); this.opened++;
    if (d.lamp) { d.lamp.destroy(); d.lamp = null; }
    this.scene.fog?.reveal?.(true);
    return true;
  }
  close(d) {
    if (d.state !== 'open' || this.blocked(d)) return false;
    this.setState(d, 'closed');
    this.sound(d, 'shut');
    return true;
  }
  // ---------- damage ----------
  // kind 'melee' | 'shot' | 'blast'; a door takes one blow per 120 ms (a strike touches it on several rows)
  damage(d, dmg, kind, time = this.scene.time.now) {
    if (!this.shut(d) || time - d.lastHit < 120) return false;
    d.lastHit = time;
    const s = this.scene, b = d.t.breaks || 'all', ok = b === 'all' || (b === 'heavy' && kind !== 'shot') || (b === 'blast' && kind === 'blast');
    const cx = d.cx, cy = d.top + d.h * 0.5, c = col(d.t.splinter);
    this.sound(d, 'hit'); this.hits++;
    s.fx.sparks(cx, cy, ok ? c : 0xffd27a, ok ? 6 : 4);
    if (!ok) { if (kind !== 'shot' && !d.told) { d.told = true; s.hud.toast(`${d.t.name || 'Tür'} hält`, b === 'blast' ? 'Nur eine Granate sprengt das auf' : b === 'heavy' ? 'Schüsse prallen ab · Hiebe oder eine Granate' : 'Unzerstörbar', 'info', 2600); } return false; }
    d.hp -= kind === 'blast' ? dmg * 3 : dmg;
    if (d.sprite?.setTintFill) { d.sprite.setTintFill(0xffffff); s.time.delayedCall(60, () => d.sprite?.clearTint?.()); }
    if (d.hp <= 0) this.smash(d, kind);
    return true;
  }
  smash(d, kind = 'melee') {
    const s = this.scene, T = this.T, c = col(d.t.splinter), n = this.cfg.splinters ?? 14;
    this.setState(d, 'broken');
    this.sound(d, 'break'); this.broke++;
    s.cam.shake(kind === 'blast' ? 300 : 180, 0.006);
    // splinters: small slabs in the material's colour fly off with gravity and lie on the floor for a while
    const dir = Math.sign(d.cx - s.leyla.x) || 1;
    for (let i = 0; i < n; i++) {
      const r = (k) => hash(d.x * 31 + i, d.y1 + k, 9), w = 4 + r(1) * 12, h = 3 + r(2) * 6;
      const p = s.add.rectangle(d.cx, d.top + r(3) * d.h, w, h, i % 3 ? c : 0x2a2520).setDepth(9).setAngle(r(4) * 360);
      const vx = dir * (120 + r(5) * 420) * (r(6) < 0.2 ? -0.6 : 1), up = 160 + r(7) * 360, fall = d.feet - 3 - r(8) * 4;
      const o = { t: 0 }, x0 = p.x, y0 = p.y;
      s.tweens.add({ targets: o, t: 1, duration: 520 + r(9) * 260, onUpdate: () => { const tt = o.t; p.x = x0 + vx * tt * 0.6; p.y = Math.min(fall, y0 - up * tt * 0.6 + 1400 * tt * tt * 0.36); p.angle += 9; },
        onComplete: () => s.tweens.add({ targets: p, alpha: 0, delay: 5000, duration: 1200, onComplete: () => p.destroy() }) });
    }
    for (let y = d.y0; y <= d.y1; y++) s.fx.puff(d.cx, (y + 1) * T, c);
    s.fog?.reveal?.(true);
    // Leyla's trace (#167): the door stays broken when she comes back (until the new residents clear up)
    const sf = s.storyFx;
    if (sf?.on && sf.save && d.p.room) addTrace(sf.save, sf.node, { kind: 'door', room: d.p.room, rx: d.p.rx, ry: d.p.ry });
    s.noise?.(d.cx, d.top + d.h / 2, 700);
  }
  // world rect of Leyla's or an enemy's strike → damage the shut doors it touches
  hitRect(x0, x1, y0, y1, dmg, kind = 'melee', time) {
    let any = false;
    for (const d of this.side) if (this.shut(d) && x1 >= d.x * this.T - 2 && x0 <= (d.x + 1) * this.T + 2 && y1 >= d.top && y0 <= d.feet) any = this.damage(d, dmg, kind, time) || any;
    return any;
  }
  // a nail stopped at (x, y): was it a door?
  shot(x, y, dmg, time) {
    const tx = Math.floor(x / this.T), ty = Math.floor(y / this.T), d = this.side.find(o => this.shut(o) && o.x === tx && ty >= o.y0 && ty <= o.y1);
    return d ? this.damage(d, dmg, 'shot', time) || true : false;
  }
  blast(x, y, radius, dmg, time) {
    for (const d of this.side) if (this.shut(d) && Math.hypot(d.cx - x, Math.max(0, Math.abs(d.top + d.h / 2 - y) - d.h / 2)) < radius + this.T * 0.5) this.damage(d, dmg, 'blast', time);
  }
  // ---------- enemies (#169 rounds too, when Spiel › Türen › Auch auf Runde) ----------
  // an enemy walking into a shut door: it opens it after a short grab (not a locked one) → true while the door is in the way
  enemyAt(e, dir) {
    if (this.cfg.enemies === false || e.kind === 'flyer') return false;
    const T = this.T, fx = e.x + dir * (e.w / 2 + 14), tx = Math.floor(fx / T), ty = Math.floor((e.feet - 8) / T);
    const d = this.side.find(o => this.shut(o) && o.x === tx && ty >= o.y0 && ty <= o.y1);
    if (!d) return false;
    if (d.state === 'locked' || (e.state === 'patrol' && !this.cfg.patrol)) return d.state === 'locked' ? 'locked' : false;
    const now = this.scene.time.now;
    if (!e.doorAt || e.doorFor !== d) { e.doorAt = now + 260; e.doorFor = d; }
    if (now >= e.doorAt) { this.open(d, e); e.doorAt = 0; e.doorFor = null; (this.byEnemy ??= []).push(d.p.id); }
    return true;
  }
  // ---------- traces from the last visit ----------
  applyTrace(t) {
    const d = this.side.find(o => o.p.room === t.room && Math.abs(o.p.rx - t.rx) <= 1 && Math.abs(o.p.ry - t.ry) <= 1);
    if (!d) return false;
    this.setState(d, 'broken', true);
    d.trace = t.fade; d.wreck?.setAlpha(0.6 + 0.4 * (t.fade ?? 1));
    return true;
  }

  // ---------- front doors ----------
  makeFront(p) {
    const s = this.scene, T = this.T, t = this.D.doors?.[p.type];
    if (!t) return null;
    const key = this.img(t.front?.[p.state]) || this.img(t.front?.closed);
    if (!key) return null;
    s.textures.get(key).setFilter(NEAREST());
    const src = s.textures.get(key).getSourceImage(), H = T * 3.3, k = H / src.height;
    const f = { p, t, x: (p.x + 1.5) * T, feet: (p.feet + 1) * T, k, state: p.state, link: p.link ?? null };
    // behind an open or broken one: the dark way in
    if (p.state === 'open' || p.state === 'broken' || f.link != null) f.dark = s.add.rectangle(f.x, f.feet - H * 0.46, src.width * k * 0.62, H * 0.86, 0x07060a).setDepth(-10.66).setVisible(p.state !== 'closed');
    f.sprite = s.add.image(f.x, f.feet, key).setOrigin(0.5, 1).setScale(k).setDepth(-10.6).setTint(f.link != null ? 0xe8e4ee : 0xc4c0cc);
    if (f.link != null) f.glow = s.add.ellipse(f.x, f.feet - 6, src.width * k * 0.9, 16, 0xffd27a, 0.08).setDepth(-10.55);   // light under the real ones
    return f;
  }
  frontOpen(f, on = true) {
    const key = this.img(f.t.front?.[on ? 'open' : 'closed']);
    if (key) f.sprite.setTexture(key);
    f.dark?.setVisible(on);
    f.state = on ? 'open' : 'closed';
  }
  // E through a paired front door: into its partner (a side room of the graph and back)
  goThrough(f) {
    const s = this.scene, to = this.front[f.link];
    if (!to) return;
    this.frontOpen(f, true); this.frontOpen(to, true);
    this.sound(f, 'open');
    const l = s.leyla;
    s.cam.fadeOut(140, 7, 6, 10);
    s.time.delayedCall(150, () => {
      l.body.reset(to.x, to.feet - l.body.height / 2); l.body.setVelocity(0, 0);
      s.cam.fadeIn(220, 7, 6, 10);
      s.fog?.reveal?.(true);
      this.went = (this.went || 0) + 1;
    });
  }

  // ---------- E ----------
  nearest(l, range) {
    const T = this.T;
    for (const d of this.side) {
      if (d.state === 'broken' || Math.abs(d.cx - l.x) > range * 0.85 || l.feet < d.top + T || l.feet > d.feet + 6) continue;
      if (d.state === 'open') return this.blocked(d) ? null : { text: `${d.t.name || 'Tür'} schließen`, act: () => this.close(d) };
      if (d.state === 'closed') return { text: `${d.t.name || 'Tür'} öffnen`, act: () => this.open(d, l) };
      return d.tried ? { text: `${d.t.name || 'Tür'} · verschlossen · aufbrechen oder sprengen` } : { text: `${d.t.name || 'Tür'} · verschlossen · hacken (Glitch-Duell)`, act: () => this.hack(d) };
    }
    for (const f of this.front) if (f.link != null && Math.abs(f.x - l.x) < T * 1.2 && Math.abs(f.feet - l.feet) < 40) return { text: 'Durch die Tür', act: () => this.goThrough(f) };
    return null;
  }
  // a locked door: one try at its lock (Glitch-Duell, #052); won = open, lost = force is left
  hack(d) {
    const s = this.scene;
    d.tried = true;
    const done = won => { if (won) { this.setState(d, 'closed', true); this.open(d, s.leyla); s.hud.toast('Schloss geknackt', d.t.name || 'Tür', 'good', 2600); } else s.hud.toast('Das Schloss hält', 'Aufbrechen (Hiebe) oder sprengen (Granate)', 'warn', 3200); };
    if (!s.hud.duel || !this.level?.duelAt) return done(true);
    const host = { x: d.cx, feet: d.feet, quiet: true };
    this.level.duelAt(host, d.t.name || 'Tür', `door${this.side.indexOf(d)}`);
    // duelAt marks the host when the duel ends; the result comes from the toast-less flag below
    const wait = s.time.addEvent({ delay: 200, loop: true, callback: () => { if (!host.dueled) return; wait.remove(); done(host.won ?? true); } });
  }
  // the cycle graph's locks (#168) of kind door, valve, grate, fuse: the painted door of their kind in front of the code drawing
  lockArt(o) {
    const s = this.scene, T = this.T, k = o.info?.kind || 'door';
    if (o.hatch || k === 'gate') return null;
    const want = { grate: 'grate', valve: 'bulkhead', fuse: 'steel' }[k];
    let type = want ? Object.keys(this.D.doors || {}).find(id => this.D.doors[id].material === want) : null;
    if (!type) type = pickType(this.D, { hull: hullConfig(this.D, s.levelPoi).type, role: null, kind: 'seam', view: 'side', r: 0.5 });
    const key = type && this.img(this.D.doors[type].side?.closed);
    if (!key) return null;
    const src = s.textures.get(key).getSourceImage(), h = (o.y1 - o.y0) * T;
    return s.add.image((o.x0 + o.x1) / 2 * T, o.y1 * T, key).setOrigin(0.5, 1).setScale(h / src.height).setDepth(-8.9);
  }
  state() {
    return {
      side: this.side.map(d => ({ id: d.p.id, x: d.x, y0: d.y0, y1: d.y1, cx: Math.round(d.cx), feet: d.feet, kind: d.p.kind, type: d.p.type, material: d.p.material, state: d.state, hp: d.hp, room: d.p.room, trace: d.trace ?? null })),
      front: this.front.map(f => ({ id: f.p.id, x: Math.round(f.x), feet: f.feet, type: f.p.type, state: f.state, link: f.link, room: f.p.room })),
      hits: this.hits, broke: this.broke, opened: this.opened, byEnemy: this.byEnemy || [], went: this.went || 0,
    };
  }
}

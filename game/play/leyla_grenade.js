// Leyla's grenade (#140, Daniel 21.11.2026: „Granaten sind nicht numerisch vorhanden, sondern ein extra Skill mit einem Cooldown
// (z. B. 3 Stück und dann 180 Sekunden warten)“; „ordentliche Animationen, die kompatibel mit Gehen, Rennen und Springen sind“).
// Values: Leyla › Granate (Skill). The flight, the marker and the bang are the Werfer's code (game/play/throwables.js).
//
// The throw is an upper-body layer: Leyla keeps walking, running or jumping in her own animation, the throwing arm is laid over it
// (Leyla › Granate › Wurf-Oberkörper: an animation strip with only the upper body, same frame box and anchor as her other looks).
// Until that exists a placeholder from code swings the arm. HUD: charges and cooldown next to DASH.
import { Throwables } from './throwables.js';
// #176 the throwing knives share this throw (pose, painted throw, Wende-Wurf): pose.kind says which one leaves the hand
export const THROW_KINDS = { grenade: 'Granate', knife: 'Wurfmesser' };

const BLOCKED = new Set(['climb', 'hang', 'mantle', 'swing', 'slide', 'dead', 'sit', 'pose', 'dash', 'turnThrow']);

export class LeylaGrenade {
  constructor(leyla) { this.l = leyla; this.charges = null; this.refillAt = null; this.pose = null; this.thrown = 0; }
  // #176 the active throw: 'grenade' or 'knife' (Z, controller: hold the grenade button); Leyla › Wurfmesser › Aktiv am Anfang
  get kind() {
    const K = this.l.knives;
    if (!K?.c.enabled) return 'grenade';
    if (!this.c.enabled) return 'knife';
    return (this.active ??= this.l.scene.box?.save?.throwKind || this.l.d.knives?.start || 'grenade');
  }
  setKind(k, time) {
    const s = this.l.scene;
    if (!THROW_KINDS[k] || k === this.kind) return;
    this.active = k; this.swappedAt = time;
    if (s.box?.save) s.box.save.throwKind = k;
    s.fx?.text(this.l.x, this.l.feet - this.l.height - 34, THROW_KINDS[k], { color: k === 'knife' ? '#ff4fa0' : '#3fe0d0', size: 34, rise: 34 });
    s.sfx?.('item_equip', { x: this.l.x });
  }
  swap(time) { this.setKind(this.kind === 'knife' ? 'grenade' : 'knife', time); }
  // charges of the active throw
  activeReady() { return this.kind === 'knife' ? this.l.knives.ready() : (this.charges ?? this.c.charges) > 0; }
  get c() {
    const G = this.l.d.grenade || {};
    return { enabled: G.enabled !== false, charges: Math.max(1, G.charges ?? 3), cooldown: (G.cooldown ?? 180) * 1000, refill: G.refill || 'all', item: G.item || 'granate',
      fuse: G.fuse ?? 900, radius: G.radius ?? 160, damage: G.damage ?? 40, burn: G.burn ?? 3, velocity: G.velocity || [620, -900], throwTime: G.throwTime ?? 220, releaseFrame: G.releaseFrame, hand: G.hand || [30, 170], look: G.look || '', arm: G.arm || '', icon: G.icon || '', shoulder: (G.shoulder ?? 69) / 100 };
  }
  now() { return this.l.scene.now ?? this.l.scene.time.now; }
  reset() { this.pose = null; }

  update(time, input) {
    const c = this.c, l = this.l, s = l.scene;
    if (this.charges == null) this.charges = c.charges;
    const now = this.now();
    // cooldown: all charges together after the first throw of a series, or one by one
    if (this.refillAt != null && now >= this.refillAt) {
      if (c.refill === 'each') { this.charges = Math.min(c.charges, this.charges + 1); this.refillAt = this.charges < c.charges ? now + c.cooldown : null; }
      else { this.charges = c.charges; this.refillAt = null; }
      if (this.charges === c.charges) s.fx?.text(l.x, l.feet - l.height - 30, 'Granaten bereit', { color: '#3fe0d0', size: 34, rise: 40 });
    }
    l.knives?.tick(time);   // #176
    if (this.pose && time >= this.pose.release && !this.pose.done) this.release(time, input);
    if (this.pose && time >= this.pose.end) this.pose = null;
    if (input.throwSwap?.pressed && !this.pose && s.mode !== 'camp') this.swap(time);   // #176
    if (this.skip === time) return;   // #164 the press went to the Wende-Wurf (or was turned down there)
    const kind = this.kind, knife = kind === 'knife';
    if (!input.grenade?.pressed || !(knife || c.enabled) || s.mode === 'camp' || !l.alive || BLOCKED.has(l.state) || this.pose) return;
    if (!this.activeReady()) { s.staminaDenied?.('grenade'); this.denied = time; return; }
    const fast = knife ? l.knives.c.armSpeed : 1;   // #176 the knife leaves quicker: the same painted throw, faster
    // #161 a painted throw (Leyla › Granate › Wurf, the rifle brings its own in Waffen › Posen › throw): its length and release frame set the timing
    const T = this.throwLook(), A = T && s.data_.assets?.[T];
    const dur = A?.frames ? A.frames / (A.fps || 22) * 1000 / fast : 0, rel = A?.frames ? (c.releaseFrame ?? Math.round(A.frames * 0.72)) / (A.fps || 22) * 1000 / fast : 0;
    this.pose = dur ? { at: time, release: time + rel, end: time + dur, look: T, up: !!input.up?.down, down: !!input.down?.down, done: false, kind }
      : { at: time, release: time + c.throwTime / fast, end: time + (c.throwTime + 260) / fast, up: !!input.up?.down, down: !!input.down?.down, done: false, kind };
    l.fightTrigger?.(time);
  }

  // #164 Wende-Wurf: the painted throw starts after the turn (Leyla › Wende-Wurf › Umdrehen) from the wind-up frame, whole body,
  // faster than the normal throw; the grenade leaves flat and fast backwards (release() reads P.turn)
  turn(time, T) {
    const s = this.l.scene, K = this.throwLook(), A = K && s.data_.assets?.[K], n = A?.frames || 0, c = this.c;
    const kind = this.kind, at = time + T.turn, dur = Math.max(60, T.throwTime) / (kind === 'knife' ? Math.max(1, this.l.knives.c.armSpeed * 0.7) : 1);
    const f0 = n ? Math.min(n - 1, Math.max(0, T.fromFrame - 1)) : 0, rf = n ? Math.min(n - 1, c.releaseFrame ?? Math.round(n * 0.72)) : 0;
    const rel = n ? at + Math.max(0, (rf - f0) / Math.max(1, n - f0)) * dur : at + dur * 0.45;
    const a = T.angle * Math.PI / 180;
    this.pose = { at, release: rel, end: at + dur, look: K, f0: n ? f0 : 0, full: true, done: false, kind, turn: { vx: T.speed * Math.cos(a), vy: -T.speed * Math.sin(a) } };
    this.skip = time;
  }

  // the painted throw for the weapon in hand: Waffen › Posen › throw (Sturmgewehr), else Leyla › Granate › Wurf (with a pistol)
  throwLook() { const k = this.l.d?.look?.throw || this.c.look; return k && this.l.scene.textures.exists(k) ? k : null; }
  hand() {
    const l = this.l, c = this.c, k = l.size.h / 168;   // the hand values are for the 192 px Leyla (box 168 high)
    return { x: l.x + l.facing * c.hand[0] * k, y: l.feet - c.hand[1] * k };
  }
  release(time, input) {
    const c = this.c, l = this.l, s = l.scene, P = this.pose, h = this.hand();
    P.done = true;
    if (P.kind === 'knife') return l.knives.release(time, P, h, input);   // #176
    let [vx, vy] = c.velocity;
    if (P.turn) [vx, vy] = [P.turn.vx, P.turn.vy];   // #164 flat and fast, without her own speed (she slides the other way)
    else if (P.up || input.up?.down) { vx *= 0.7; vy *= 1.25; } else if (P.down || input.down?.down) { vx *= 1.1; vy *= 0.45; }
    const carry = P.turn ? 0 : 1;
    Throwables.of(s).throw({ x: h.x, y: h.y, vx: l.facing * vx + l.body.velocity.x * 0.5 * carry, vy: vy + Math.min(0, l.body.velocity.y * 0.3) * carry, item: c.item, fuse: c.fuse,
      radius: c.radius, damage: c.damage, burn: c.burn, friendly: true, from: l, time, turn: !!P.turn });
    if (P.turn) l.turnRelease?.(time, h);
    const now = this.now();
    if (this.charges === c.charges || this.refillAt == null) this.refillAt = this.refillAt ?? now + c.cooldown;
    this.charges--; this.thrown++;
  }

  // ---------- look: the arm layer over whatever she does ----------
  draw(time) {
    const l = this.l, s = l.scene, P = this.pose, c = this.c;
    this.g ??= s.add.graphics().setDepth(10.6);
    this.g.clear();
    const sp = l.sprite, A = c.look && s.data_.assets?.[c.look];
    if (!P) { if (this.hidBody) { sp.setVisible(true); this.hidBody = false; } if (this.cutBody) { sp.setCrop(); this.cutBody = false; } this.over?.setVisible(false); this.arm?.setVisible(false); return; }
    if (time < P.at) {   // #164 Wende-Wurf: still turning (her own picture), the throw comes after
      if (this.hidBody) { sp.setVisible(true); this.hidBody = false; } if (this.cutBody) { sp.setCrop(); this.cutBody = false; }
      this.over?.setVisible(false); this.arm?.setVisible(false); return;
    }
    const p = Math.min(1, (time - P.at) / (P.end - P.at)), key = P.look, TA = key && s.data_.assets?.[key];
    if (TA) {   // #161 the painted throw: standing = the whole body (lunge), moving or in the air = only the upper body over her legs
      this.over ??= s.add.sprite(sp.x, sp.y, key).setDepth(10.5);
      const n = TA.frames || 1, [fw, fh] = TA.frameSize || [sp.width, sp.height], o = TA.origin || [fw / 2, fh];
      const still = P.full || (l.body.blocked.down && Math.abs(l.body.velocity.x) < 40 && l.state === 'normal');   // #164 the Wende-Wurf: always the whole body (lunge while she skids)
      const f0 = P.f0 || 0;
      this.over.setVisible(true).setTexture(key, Math.min(n - 1, f0 + Math.floor(p * (n - f0)))).setOrigin(o[0] / fw, o[1] / fh)
        .setPosition(l.x, l.feet).setScale((TA.height || l.height) / fh).setFlipX(l.facing < 0);
      const waist = TA.waist ?? Math.round(fh * 0.5);
      if (still) this.over.setCrop(); else this.over.setCrop(0, 0, fw, waist);
      sp.setVisible(!still); this.hidBody = still;
      // moving: her own upper body (gun arm of the run) would show under the throw, so it is cut off at the same waist line
      if (!still && sp.frame) { const bo = sp.displayOriginY ?? sp.frame.height, cut = Math.max(0, bo - (o[1] - waist)); sp.setCrop(0, cut, sp.frame.width, sp.frame.height - cut); this.cutBody = true; }
      else if (this.cutBody) { sp.setCrop(); this.cutBody = false; }
      return;
    }
    if (A && s.textures.exists(c.look)) {   // painted upper body: same box, anchor and flip as the body under it
      this.over ??= s.add.sprite(sp.x, sp.y, c.look).setDepth(10.5);
      const n = A.frames || 1, [fw, fh] = A.frameSize || [sp.width, sp.height], o = A.origin || [fw / 2, fh];
      this.over.setVisible(true).setTexture(c.look, Math.min(n - 1, Math.floor(p * n))).setOrigin(o[0] / fw, o[1] / fh)
        .setPosition(sp.x, sp.y).setScale((A.height || l.height) / fh).setFlipX(l.facing < 0);
      return;
    }
    // the arm swings from behind the head over the top and forward, the grenade leaves at „release“
    const f = l.facing, wind = Math.min(1, (time - P.at) / Math.max(1, P.release - P.at));
    const ang = P.done ? -0.2 + Math.min(1, (time - P.release) / 200) * 0.9 : -2.6 + wind * 2.4;   // radians from forward, negative = up/back
    const B = c.arm && s.data_.assets?.[c.arm];
    if (B && s.textures.exists(c.arm)) {   // #140 the painted arm (PixelLab), turned at the shoulder: fits standing, walking, running, jumping
      const [fw, fh] = B.frameSize || [128, 64], o = B.origin || [12, 32], k = l.height / (s.data_.assets?.leyla_idle_side?.frameSize?.[1] || 242);   // the same pixel size as Leyla's own pictures
      this.arm ??= s.add.sprite(0, 0, c.arm, 0).setDepth(10.55);
      this.arm.setVisible(true).setFrame(P.done ? 1 : 0).setOrigin(o[0] / fw, o[1] / fh).setScale(k).setFlipX(f < 0)
        .setPosition(l.x - f * l.height * 0.03, l.feet - l.height * c.shoulder).setRotation(f > 0 ? ang : -ang);
      if (P.done && (time - P.release) > 260) this.arm.setAlpha(Math.max(0, 1 - (time - P.release - 260) / 120)); else this.arm.setAlpha(1);
      return;
    }
    const sx = l.x - f * 6, sy = l.feet - l.height * 0.88, len = l.height * 0.32;
    const ex = sx + f * Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
    this.g.lineStyle(12, 0x0d0a12, 0.9).lineBetween(sx, sy, ex, ey);
    this.g.lineStyle(7, 0xe8b89a, 1).lineBetween(sx, sy, ex, ey);
    if (!P.done) { this.g.fillStyle(0x0d0a12, 1).fillCircle(ex, ey, 10); this.g.fillStyle(0x4e5a3a, 1).fillCircle(ex, ey, 7); }
    else { this.g.lineStyle(3, 0x3fe0d0, 0.5 * (1 - p)).beginPath(); this.g.arc(sx, sy, len, f > 0 ? -2.6 : Math.PI + 2.6 - Math.PI * 2, f > 0 ? 0.6 : Math.PI - 0.6, f < 0); this.g.strokePath(); }
  }

  // HUD (#176): next to DASH, both throws side by side, the active one big and lit: its symbol (Leyla › Granate / Wurfmesser ›
  // HUD-Symbol), one small symbol per charge that fills from below while it comes back, the seconds; the other one small and dim
  hud(scene) {
    const H = scene.hud, K = this.l.knives, kinds = [this.c.enabled && 'grenade', K?.c.enabled && 'knife'].filter(Boolean);
    if (!H?.dash?.parentNode || !kinds.length) { if (this.el) this.el.hidden = true; return; }
    if (!this.el) {
      this.el = document.createElement('span');
      this.el.className = 'hud-throw';
      this.el.title = 'Wurf: T wirft, Z wechselt Granate / Wurfmesser (Controller: rechten Stick drücken, halten = wechseln)';
      H.dash.after(this.el);
      this.slots = {};
    }
    const active = this.kind, now = this.now();
    for (const k of ['grenade', 'knife']) {
      const on = kinds.includes(k), src = k === 'knife' ? K : this, c = src?.c;
      let S = this.slots[k];
      if (!on) { if (S) S.box.hidden = true; continue; }
      if (!S) {
        const box = document.createElement('span'); box.className = `hud-throw-slot ${k}`;
        const A = scene.data_.assets?.[c.icon], url = A?.file && scene.base ? new URL(A.file, scene.base).href : '';
        const ic = document.createElement(url ? 'img' : 'b'); ic.className = 'hud-throw-icon'; if (url) { ic.src = url; ic.alt = ''; } else ic.textContent = k === 'knife' ? 'MESSER' : 'GRANATE';
        const pips = document.createElement('span'); pips.className = 'hud-throw-pips';
        const time = document.createElement('small'); time.className = 'hud-throw-time';
        box.append(ic, pips, time); this.el.append(box);
        S = this.slots[k] = { box, pips, time, url, n: -1 };
      }
      S.box.hidden = false;
      const max = c.charges, have = Math.max(0, src.charges ?? max), left = src.refillAt != null ? Math.max(0, src.refillAt - now) : 0;
      const fill = left ? 1 - left / Math.max(1, c.cooldown) : 0;
      if (S.n !== max) {   // one symbol per charge: dim underneath, lit in a box that grows from below
        S.n = max; S.pips.replaceChildren();
        for (let i = 0; i < max; i++) {
          const pip = document.createElement('i'); pip.className = 'hud-throw-pip';
          if (S.url) { const a = document.createElement('img'); a.src = S.url; a.alt = ''; const b = document.createElement('b'); const z = document.createElement('img'); z.src = S.url; z.alt = ''; b.append(z); pip.append(a, b); }
          else pip.append(document.createElement('b'));
          S.pips.append(pip);
        }
      }
      [...S.pips.children].forEach((pip, i) => {
        const f = i < have ? 1 : (c.refill === 'all' || i === have) ? fill : 0;
        const pct = Math.round(f * 100) + '%';
        const b = pip.lastChild; if (b.style.height !== pct) b.style.height = pct;
        pip.classList.toggle('full', f >= 1);
      });
      const sec = Math.ceil(left / 1000), text = left && have < max ? (sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}s`) : '';
      if (S.time.textContent !== text) S.time.textContent = text;
      S.box.classList.toggle('active', k === active);
      S.box.classList.toggle('empty', have <= 0);
      S.box.classList.toggle('flash', this.swappedAt != null && k === active && (this.l.scene.now ?? 0) - this.swappedAt < 400);
    }
    this.el.hidden = scene.mode === 'camp';
    this.el.dataset.active = active;
  }
  state() { const c = this.c; return { charges: this.charges ?? c.charges, max: c.charges, refillIn: this.refillAt != null ? Math.round(this.refillAt - this.now()) : 0, throwing: !!this.pose, thrown: this.thrown, kind: this.kind, hud: this.el ? { active: this.el.dataset.active, slots: Object.fromEntries(Object.entries(this.slots || {}).filter(([, S]) => !S.box.hidden).map(([k, S]) => [k, { active: S.box.classList.contains('active'), pips: S.pips.children.length, full: S.pips.querySelectorAll('.full').length, time: S.time.textContent, icon: !!S.url }])) } : null }; }
}

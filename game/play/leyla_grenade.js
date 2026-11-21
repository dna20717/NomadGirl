// Leyla's grenade (#140, Daniel 21.11.2026: „Granaten sind nicht numerisch vorhanden, sondern ein extra Skill mit einem Cooldown
// (z. B. 3 Stück und dann 180 Sekunden warten)“; „ordentliche Animationen, die kompatibel mit Gehen, Rennen und Springen sind“).
// Values: Leyla › Granate (Skill). The flight, the marker and the bang are the Werfer's code (game/play/throwables.js).
//
// The throw is an upper-body layer: Leyla keeps walking, running or jumping in her own animation, the throwing arm is laid over it
// (Leyla › Granate › Wurf-Oberkörper: an animation strip with only the upper body, same frame box and anchor as her other looks).
// Until that exists a placeholder from code swings the arm. HUD: charges and cooldown next to DASH.
import { Throwables } from './throwables.js';

const BLOCKED = new Set(['climb', 'hang', 'mantle', 'swing', 'slide', 'dead', 'sit', 'pose', 'dash']);

export class LeylaGrenade {
  constructor(leyla) { this.l = leyla; this.charges = null; this.refillAt = null; this.pose = null; this.thrown = 0; }
  get c() {
    const G = this.l.d.grenade || {};
    return { enabled: G.enabled !== false, charges: Math.max(1, G.charges ?? 3), cooldown: (G.cooldown ?? 180) * 1000, refill: G.refill || 'all', item: G.item || 'granate',
      fuse: G.fuse ?? 900, radius: G.radius ?? 160, damage: G.damage ?? 40, burn: G.burn ?? 3, velocity: G.velocity || [620, -900], throwTime: G.throwTime ?? 220, hand: G.hand || [30, 170], look: G.look || '' };
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
    if (this.pose && time >= this.pose.release && !this.pose.done) this.release(time, input);
    if (this.pose && time >= this.pose.end) this.pose = null;
    if (!input.grenade?.pressed || !c.enabled || s.mode === 'camp' || !l.alive || BLOCKED.has(l.state) || this.pose) return;
    if (this.charges <= 0) { s.staminaDenied?.('grenade'); this.denied = time; return; }
    this.pose = { at: time, release: time + c.throwTime, end: time + c.throwTime + 260, up: !!input.up?.down, down: !!input.down?.down, done: false };
    l.fightTrigger?.(time);
  }

  hand() {
    const l = this.l, c = this.c, k = l.size.h / 168;   // the hand values are for the 192 px Leyla (box 168 high)
    return { x: l.x + l.facing * c.hand[0] * k, y: l.feet - c.hand[1] * k };
  }
  release(time, input) {
    const c = this.c, l = this.l, s = l.scene, P = this.pose, h = this.hand();
    P.done = true;
    let [vx, vy] = c.velocity;
    if (P.up || input.up?.down) { vx *= 0.7; vy *= 1.25; } else if (P.down || input.down?.down) { vx *= 1.1; vy *= 0.45; }
    Throwables.of(s).throw({ x: h.x, y: h.y, vx: l.facing * vx + l.body.velocity.x * 0.5, vy: vy + Math.min(0, l.body.velocity.y * 0.3), item: c.item, fuse: c.fuse,
      radius: c.radius, damage: c.damage, burn: c.burn, friendly: true, from: l, time });
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
    if (!P) { this.over?.setVisible(false); return; }
    const p = Math.min(1, (time - P.at) / (P.end - P.at));
    if (A && s.textures.exists(c.look)) {   // painted upper body: same box, anchor and flip as the body under it
      this.over ??= s.add.sprite(sp.x, sp.y, c.look).setDepth(10.5);
      const n = A.frames || 1, [fw, fh] = A.frameSize || [sp.width, sp.height], o = A.origin || [fw / 2, fh];
      this.over.setVisible(true).setTexture(c.look, Math.min(n - 1, Math.floor(p * n))).setOrigin(o[0] / fw, o[1] / fh)
        .setPosition(sp.x, sp.y).setScale((A.height || l.height) / fh).setFlipX(l.facing < 0);
      return;
    }
    // placeholder from code: the arm swings from behind the head over the top and forward, the grenade leaves at „release“
    const f = l.facing, sx = l.x - f * 6, sy = l.feet - l.height * 0.88, len = l.height * 0.32;
    const wind = Math.min(1, (time - P.at) / Math.max(1, P.release - P.at));
    const ang = P.done ? -0.2 + Math.min(1, (time - P.release) / 200) * 0.9 : -2.6 + wind * 2.4;   // radians from forward, negative = up/back
    const ex = sx + f * Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
    this.g.lineStyle(12, 0x0d0a12, 0.9).lineBetween(sx, sy, ex, ey);
    this.g.lineStyle(7, 0xe8b89a, 1).lineBetween(sx, sy, ex, ey);
    if (!P.done) { this.g.fillStyle(0x0d0a12, 1).fillCircle(ex, ey, 10); this.g.fillStyle(0x4e5a3a, 1).fillCircle(ex, ey, 7); }
    else { this.g.lineStyle(3, 0x3fe0d0, 0.5 * (1 - p)).beginPath(); this.g.arc(sx, sy, len, f > 0 ? -2.6 : Math.PI + 2.6 - Math.PI * 2, f > 0 ? 0.6 : Math.PI - 0.6, f < 0); this.g.strokePath(); }
  }

  // HUD: next to DASH, without touching hud.js (its own little element)
  hud(scene) {
    const H = scene.hud, c = this.c;
    if (!H?.dash?.parentNode || !c.enabled) { if (this.el) this.el.hidden = true; return; }
    if (!this.el) {
      this.el = document.createElement('span');
      this.el.className = 'hud-dash hud-grenade';
      this.el.title = 'Granate (T, Controller: rechten Stick drücken)';
      H.dash.after(this.el);
    }
    const left = this.refillAt != null ? Math.max(0, Math.ceil((this.refillAt - this.now()) / 1000)) : 0;
    const text = `GRANATE ${'●'.repeat(Math.max(0, this.charges ?? c.charges))}${'○'.repeat(Math.max(0, c.charges - (this.charges ?? c.charges)))}${left ? ` ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : ''}`;
    if (text !== this.text) { this.text = text; this.el.textContent = text; }
    this.el.hidden = scene.mode === 'camp';
    this.el.classList.toggle('ready', (this.charges ?? c.charges) > 0);
  }
  state() { const c = this.c; return { charges: this.charges ?? c.charges, max: c.charges, refillIn: this.refillAt != null ? Math.round(this.refillAt - this.now()) : 0, throwing: !!this.pose, thrown: this.thrown }; }
}

// Wende-Wurf (#164, Daniel 21.11.2026): during the dash the opposite direction + grenade (T, controller: the grenade button) turns
// Leyla around mid-dash, she throws the grenade flat and fast backwards (at whoever chases her) and skids on backwards with what is
// left of the dash, looking the way she threw. A short slow motion when the grenade leaves her hand (game/play/slowmo.js).
// Costs one grenade charge (Leyla › Granate) and stamina (Leyla › Wende-Wurf › Ausdauer). Without either: the dash goes on.
// Values: Leyla › Wende-Wurf. Mixed into Leyla like LeylaMoves.
//
// Look, put together from pictures she already has (no new strip): the turn = Bremsen frames (feet planted, facing the dash way),
// then the painted throw (#161, whole body, from the wind-up frame) facing back while she skids; effects from code: afterimages,
// dust, a whirl at the turn, speed lines, sparks and a camera punch at the release.
import { startSlow } from './slowmo.js';

const approach = (v, target, step) => v < target ? Math.min(target, v + step) : Math.max(target, v - step);

export class LeylaTurnThrow {
  get TT() {
    const T = this.d.turnThrow || {};
    return { enabled: T.enabled !== false, stamina: Math.max(0, T.stamina ?? 30), buffer: Math.max(0, T.buffer ?? 120), turn: Math.max(0, T.turnTime ?? 70),
      throwTime: Math.max(60, T.throwTime ?? 320), fromFrame: T.fromFrame ?? 4, speed: T.speed ?? 1350, angle: T.angle ?? 12,
      slide: T.slide ?? 900, friction: Math.max(0, T.friction ?? 2200), slowTime: Math.max(0, T.slowTime ?? 200), slowFactor: Math.min(1, Math.max(0.05, (T.slowFactor ?? 35) / 100)),
      look: T.look || this.d.look?.brake || '', frames: T.frames || [2, 5] };
  }

  // called before the state machine: grenade pressed with the opposite direction during the dash (or just after it, Leyla › Wende-Wurf › Puffer)
  turnThrowTry(time, input, dir) {
    if (!input.grenade?.pressed) return false;
    const T = this.TT, D = this.dashDir, G = this.grenade;
    if (!T.enabled || !D || dir !== -D || !this.alive || this.scene.mode === 'camp' || !G?.c.enabled || G.pose) return false;
    const inDash = this.state === 'dash', late = this.state === 'normal' && time - (this.dashEndAt ?? -1e9) <= T.buffer;
    if (!inDash && !late) return false;
    G.skip = time;   // the press belongs to the move: no normal throw right after the dash
    if ((G.charges ?? G.c.charges) <= 0) { this.scene.staminaDenied?.('grenade'); G.denied = time; this.turnDenied = 'charges'; return true; }   // the dash goes on
    if (!this.spend('turnThrow', time)) { this.turnDenied = 'stamina'; return true; }
    this.startTurnThrow(time, D);
    return true;
  }

  startTurnThrow(time, D) {
    const T = this.TT, b = this.body;
    this.state = 'turnThrow';
    this.tt = { at: time, dir: D, flip: time + T.turn, end: time + T.turn + T.throwTime, turned: false, nextGhost: 0, nextDust: 0, released: 0, sparks: [] };
    this.turnThrows = (this.turnThrows || 0) + 1; this.turnDenied = null;
    this.facing = D;   // the turn: feet planted, still facing the way she dashed
    this.flipUntil = 0; this.attack = null; this.charging = null; this.combo = null; this.hitAnim = null;
    b.allowGravity = true;
    b.setVelocity(D * T.slide, Math.min(0, b.velocity.y));
    this.squash = { x: 1.18, y: 0.88 };
    this.grenade.turn(time, T);
    this.scene.fx.dust(this.x + D * this.size.w * 0.4, this.feet, 10);
    this.scene.sfx?.('slide', { x: this.x, ms: T.turn + T.throwTime });
    this.scene.drone?.react('dash');
    this.fightTrigger?.(time);
  }

  turnThrow(time, s, input, grounded) {
    const T = this.TT, t = this.tt, b = this.body;
    if (!t) { this.state = 'normal'; return; }
    if (!t.turned && time >= t.flip) {   // turned around: from now on she looks the way she throws
      t.turned = true; this.facing = -t.dir;
      this.squash = { x: 0.86, y: 1.12 };
      this.scene.fx.dust(this.x, this.feet, 8);
    }
    // the rest of the dash: she skids on backwards, friction takes it off (less in the air)
    b.setVelocityX(approach(b.velocity.x, 0, T.friction * (grounded ? 1 : 0.35) * s));
    if ((t.dir > 0 && b.blocked.right) || (t.dir < 0 && b.blocked.left)) b.setVelocityX(0);
    const speed = Math.abs(b.velocity.x);
    if (time >= t.nextGhost && speed > 60) {
      const over = this.grenade.over?.visible ? this.grenade.over : this.sprite;
      this.scene.fx.ghost(over, t.turned ? 0xff4fa0 : 0x3fe0d0, 0.38, 200);
      t.nextGhost = time + 38;
    }
    if (grounded && time >= t.nextDust && speed > 120) { this.scene.fx.dust(this.x + t.dir * this.size.w * 0.3, this.feet, 3); t.nextDust = time + 55; }
    // once the grenade is gone she may jump out of it
    if (this.grenade.pose?.done && input.jump.pressed && grounded) { this.endTurnThrow(); this.jump(1); return; }
    if (time >= t.end) this.endTurnThrow();
  }
  endTurnThrow() {
    if (this.state === 'turnThrow') this.state = 'normal';
    this.body.allowGravity = true;
    if (this.tt) this.tt.over = true;
    this.tt = null;
  }

  // from the grenade (leyla_grenade.js release): the moment it leaves the hand
  turnRelease(time, h) {
    const T = this.TT, s = this.scene, f = this.facing;
    if (this.tt) this.tt.released = time;
    startSlow(s, T.slowTime, T.slowFactor);
    s.fx.flash(h.x, h.y, 0xc8fff4, 30);
    s.fx.sparks(h.x, h.y, 0x3fe0d0, 10);
    s.fx.sparks(this.x - f * this.size.w * 0.4, this.feet - 6, 0xffd27a, 8);   // the skidding heel
    s.cam?.shake?.(110, 0.005);
    this.lastTurnThrow = { at: time, dir: f, x: Math.round(this.x) };
  }

  // the look of the move (from look()): the turn = Leyla › Wende-Wurf › Aussehen frames (Bremsen 2–3), facing the dash;
  // after that the painted throw covers her (leyla_grenade.js draw), underneath the skid frames stay as a fallback
  turnThrowLook(time) {
    const T = this.TT, t = this.tt, A = T.look && this.scene.data_.assets?.[T.look];
    if (!t || !A || !this.scene.textures.exists(T.look)) return null;
    const n = A.frames || 1, [a, z] = [Math.max(1, T.frames[0] || 1), Math.min(n, T.frames[1] || n)];
    const mid = Math.min(z, a + 1);
    const k = !t.turned ? Math.min(1, (time - t.at) / Math.max(1, t.flip - t.at)) * (mid - a) : (mid - a) + Math.min(1, (time - t.flip) / Math.max(1, t.end - t.flip)) * (z - mid);
    const frame = a + k;   // 1-based, fractional
    return { look: T.look, from: a, p: n > a ? (frame - a) / (n - a) : 0 };
  }

  // speed lines and the whirl of the turn (graphics from code, cleared when the move is over)
  turnThrowFx(time) {
    const t = this.tt;
    if (!t) { if (this.ttG?.visible) this.ttG.clear().setVisible(false); return; }
    const s = this.scene, g = (this.ttG ??= s.add.graphics().setDepth(9.6));
    g.clear().setVisible(true);
    const x = this.x, chest = this.feet - this.size.h * 0.62, D = t.dir, h = this.size.h;
    // whirl: a ring that winds around her during the turn and fades after it
    const w = Math.min(1, (time - t.at) / Math.max(60, (t.flip - t.at) + 120));
    if (w < 1) {
      const r = h * 0.46, a0 = D > 0 ? -Math.PI * 0.9 : -Math.PI * 0.1, sweep = Math.PI * 1.7 * Math.min(1, w * 1.6) * (D > 0 ? 1 : -1);
      g.lineStyle(10 * (1 - w), 0x3fe0d0, 0.75 * (1 - w)).beginPath().arc(x, chest, r, Math.min(a0, a0 + sweep), Math.max(a0, a0 + sweep), false).strokePath();
      g.lineStyle(4 * (1 - w), 0xff4fa0, 0.8 * (1 - w)).beginPath().arc(x, chest, r * 0.82, Math.min(a0, a0 + sweep * 0.8), Math.max(a0, a0 + sweep * 0.8), false).strokePath();
    }
    // speed lines behind the skid (on the side she slides away from), longer the faster she is
    const v = Math.abs(this.body.velocity.x), k = Math.min(1, v / 900);
    if (k > 0.08) for (let i = 0; i < 5; i++) {
      const y = this.feet - h * (0.12 + i * 0.17), j = Math.sin(time / 37 + i * 2.3), len = (70 + 50 * j) * k, x0 = x - D * (this.size.w * 0.7 + 14 * i);
      g.lineStyle(i % 2 ? 2 : 3, i % 2 ? 0xff4fa0 : 0xf2f5f8, 0.55 * k).lineBetween(x0, y, x0 - D * len, y);
    }
  }
}

// Scharfschütze (#139, concept 3.1): stands still, a laser follows Leyla with a delay (turns at most „Folgt mit“ °/s), locks on while
// the laser lies on her and fires one hard shot after „Aufschalten“. Walls and chests end the laser; cover breaks the lock, a hit too.
// While he does not see her, a glint at the scope gives him away.
import { trace, wrapAngle, clamp, hexColor } from './util.js';

export default {
  id: 'sniper', key: 'sniper',
  defaults: c => ({ lock: c.lock ?? 1400, track: c.track ?? 90, damage: c.damage ?? 250, color: c.color || '#ff3040', breakOnHit: c.breakOnHit !== false, speed: c.speed ?? 2600 }),
  init(e) { e.sn = { ang: null, lock: 0, on: false, end: null, blocked: null, onLeyla: false, shots: 0 }; },

  think(e, time, dt, l) {
    const S = e.sn, c = e.tc.sniper;
    if (e.state !== 'engage' || !e.seeing || !l.alive) { S.on = false; S.lock = 0; if (e.state !== 'engage') S.ang = null; return false; }
    e.stop();
    const m = e.muzzle(), want = Math.atan2(l.chest - m.y, l.x - m.x);
    if (S.ang == null) S.ang = e.facing > 0 ? Math.min(0.4, Math.max(-0.4, want)) : wrapAngle(Math.PI);   // starts level, then swings onto her
    const step = c.track * Math.PI / 180 * dt / 1000;
    S.ang = wrapAngle(S.ang + clamp(wrapAngle(want - S.ang), -step, step));
    e.facing = Math.cos(S.ang) >= 0 ? 1 : -1;
    const t = trace(e.scene, m.x, m.y, S.ang);
    S.on = true; S.end = t.end; S.blocked = t.blocked; S.onLeyla = t.onLeyla;
    if (t.onLeyla) S.lock += dt;
    else if (t.blocked) S.lock = 0;   // cover in between breaks it
    else S.lock = Math.max(0, S.lock - dt * 1.5);   // she slipped out of the line: it fades
    if (S.lock >= c.lock && time >= e.readyAt) this.fire(e, time, m);
    return true;
  },

  fire(e, time, m) {
    const S = e.sn, c = e.tc.sniper, s = e.scene, dmg = Math.max(1, Math.round((e.d.damage ?? 9) * c.damage / 100));
    S.lock = 0; S.shots++;
    e.readyAt = time + (e.a.cooldown ?? 1800); e.shotAt = time;
    const vx = Math.cos(S.ang), vy = Math.sin(S.ang);
    s.fx.flash(m.x, m.y, 0xfff2b0, 30);
    s.fx.light?.(m.x, m.y, { radius: 260, color: hexColor(c.color), alpha: 0.7, life: 120 });
    s.sfx?.('enemy_shot', { x: m.x });
    s.cam?.shake(90, 0.003);
    s.noise?.(m.x, m.y, 1400);
    s.combat.spawn({ key: 'nail_enemy', x: m.x, y: m.y, vx: vx * c.speed, vy: vy * c.speed, life: 1800 / c.speed * 1000, friendly: false, damage: dmg, knockback: 0, time: s.time.now, from: e, sniper: true });
  },

  onHit(e) { const S = e.sn; if (e.tc.sniper.breakOnHit && S.lock > 0) { S.lock = 0; S.ang = wrapAngle((S.ang ?? 0) + (Math.random() < 0.5 ? -0.35 : 0.35)); } },

  draw(e, time, g) {
    const S = e.sn, c = e.tc.sniper, col = hexColor(c.color);
    if (!e.alive) return;
    if (S.on && S.end) {
      const m = e.muzzle(), p = Math.min(1, S.lock / c.lock);
      g.lineStyle(2 + 3 * p, col, 0.3 + 0.6 * p).lineBetween(m.x, m.y, S.end.x, S.end.y);
      g.lineStyle(1, 0xffffff, 0.25 + 0.5 * p).lineBetween(m.x, m.y, S.end.x, S.end.y);
      g.fillStyle(col, 0.9).fillCircle(S.end.x, S.end.y, 4 + 4 * p);
      if (p > 0.7) e.warn.setVisible(true);
    } else if (['patrol', 'search', 'alert'].includes(e.state)) {   // the glint at the scope
      const k = (time + e.id.length * 300) % 1600;
      if (k < 260) {
        const m = e.muzzle(), r = 6 + 10 * Math.sin(k / 260 * Math.PI);
        g.lineStyle(3, 0xffffff, 0.9).lineBetween(m.x - r, m.y, m.x + r, m.y).lineBetween(m.x, m.y - r, m.x, m.y + r);
        g.fillStyle(col, 0.8).fillCircle(m.x, m.y, 3);
      }
    }
  },
  state: e => ({ lock: Math.round(e.sn.lock), on: e.sn.on, blocked: e.sn.blocked, onLeyla: e.sn.onLeyla, shots: e.sn.shots }),
};

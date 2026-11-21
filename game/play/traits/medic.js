// Sanitäter (#139, concept 3.3): heals allies around him, runs to a fallen one, kneels (crouch pose) and brings him back
// (death animation backwards, stands with „Steht auf mit“ % life). The fallen lie „Liegen“ s; their kill counts only when no
// medic can fetch them any more (Enemy.die → pendingKill). A hit while kneeling breaks it off.

const sameFloor = (a, b) => Math.abs(a.feet - b.feet) < 48;

export default {
  id: 'medic', key: 'medic',
  defaults: c => ({ heal: c.heal ?? 2, range: c.range ?? 420, reviveTime: c.reviveTime ?? 2200, reviveHp: c.reviveHp ?? 40, bodyTime: c.bodyTime ?? 8, max: c.max ?? 2 }),
  init(e) { e.medicLeft = e.tc.medic.max; e.md = { target: null, until: 0, healFx: 0, revived: 0 }; },

  think(e, time, dt) {
    const c = e.tc.medic, M = e.md, s = e.scene;
    // healing aura: allies in reach slowly get their life back
    if (c.heal > 0) for (const o of s.enemies) {
      if (o === e || !o.alive || o.hp >= o.maxHp || Math.hypot(o.x - e.x, o.chest - e.chest) > c.range) continue;
      o.hp = Math.min(o.maxHp, o.hp + c.heal * dt / 1000);
      if (time >= (o.healFxAt || 0)) { o.healFxAt = time + 900; s.fx.text(o.x, o.body.top - 8, '+', { color: '#7fe08a', size: 40, rise: 40, life: 600 }); }
    }
    if (e.state === 'revive') {
      e.stop();
      const t = M.target;
      if (!t || !t.pendingKill) return this.stand(e, time);
      if (time >= M.until) {
        t.revive(time, c.reviveHp);
        e.medicLeft--; M.revived++;
        e.say('Steh auf!', '#7fe08a');
        return this.stand(e, time);
      }
      return true;
    }
    if (e.medicLeft <= 0 || ['windup', 'strike', 'dodge', 'stagger', 'duck', 'cover'].includes(e.state)) return false;
    // the nearest fallen ally on this floor that nobody fetches yet
    let best = null, bd = e.S.sight * 1.2;
    for (const o of s.enemies) {
      if (o === e || !o.pendingKill || o.reviver || time >= o.bodyUntil || !sameFloor(o, e)) continue;
      const d = Math.abs(o.x - e.x);
      if (d < bd) { best = o; bd = d; }
    }
    if (!best) return false;
    if (Math.abs(best.x - e.x) > 34 && !e.stuck) { e.walk(Math.sign(best.x - e.x), (e.d.speed ?? 160) * 1.2, 0); return true; }
    // kneel down next to him
    e.state = 'revive'; e.kneel = true; e.duckAt = time; M.target = best; M.until = time + c.reviveTime; best.reviver = e;
    e.facing = Math.sign(best.x - e.x) || e.facing;
    e.say('Halt durch!', '#7fe08a');
    return true;
  },
  stand(e, time) {
    const M = e.md;
    if (M.target?.reviver === e) M.target.reviver = null;
    M.target = null; e.kneel = false;
    e.state = e.seeing ? 'engage' : 'search'; e.searchStart = time;
    return true;
  },

  onHit(e, time) { if (e.state === 'revive') { this.stand(e, time); e.say('Argh!', '#ff4060'); } },
  onDeath(e) { const t = e.md.target; if (t?.reviver === e) t.reviver = null; e.md.target = null; e.kneel = false; },

  draw(e, time, g) {
    if (!e.alive) return;
    // armband with a cross (code overlay over the painted kit)
    const x = e.x - e.facing * e.w * 0.18, y = e.body.top + e.body.height * 0.3;
    g.fillStyle(0xf2f5f8, 1).fillCircle(x, y, 9); g.fillStyle(0xe5484d, 1).fillRect(x - 6, y - 2, 12, 4).fillRect(x - 2, y - 6, 4, 12);
    const t = e.md.target;
    if (e.state === 'revive' && t) {
      const p = 1 - Math.max(0, e.md.until - time) / e.tc.medic.reviveTime, cx = t.x, cy = t.feet - 70;
      g.lineStyle(3, 0x7fe08a, 0.4 + 0.3 * Math.sin(time / 80)).lineBetween(e.x, e.chest, cx, t.feet - 20);
      g.lineStyle(6, 0x0d0a12, 0.8).strokeCircle(cx, cy, 22);
      g.lineStyle(5, 0x7fe08a, 1).beginPath(); g.arc(cx, cy, 22, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.strokePath();
      g.fillStyle(0xf2f5f8, 1).fillRect(cx - 7, cy - 2, 14, 4).fillRect(cx - 2, cy - 7, 4, 14);
    }
  },
  state: e => ({ left: e.medicLeft, reviving: e.state === 'revive', target: e.md.target?.id || null, revived: e.md.revived }),
};

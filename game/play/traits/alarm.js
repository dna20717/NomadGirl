// Alarmgeber (#139, concept 3.4): when he spots Leyla he runs to the nearest alarm point (room character „!“, a siren on the wall),
// cranks it for „Dauer“ ms and then it howls: every enemy of the POI (or in „Reichweite“) comes looking, „Verstärkung“ enemies
// appear. Without an alarm point he blows a horn where he stands. Caught before = quiet.
// The sirens themselves (scene.alarmPts) are drawn from code here too (alarmPoints / tickAlarms).
import { poiPool, siren } from './util.js';

// the alarm points of the room: tile character „!“ (engine/room.js)
export function alarmPoints(scene) {
  if (scene.alarmRoom === scene.room) return scene.alarmPts;
  const T = scene.T;
  scene.alarmRoom = scene.room;
  scene.alarmG?.destroy();
  scene.alarmG = scene.add.graphics().setDepth(-2);
  const R = scene.room, floor = (x, y) => { let k = y + 1; while (k < (R?.h ?? 0) && !R.solid(x, k)) k++; return k * T; };   // the siren hangs on the wall, the floor below is where he cranks it
  scene.alarmPts = (R?.marks?.['!'] || []).map(([x, y], i) => ({ i, x: (x + 0.5) * T, y: (y + 0.45) * T, feet: floor(x, y), on: false, at: 0 }));
  return scene.alarmPts;
}
export function tickAlarms(scene, time) {
  const pts = alarmPoints(scene), g = scene.alarmG;
  if (!g) return;
  g.clear();
  for (const p of pts) {
    // a grey box with a horn and a red dome; howling: the dome glows and a light turns
    g.fillStyle(0x0d0a12, 1).fillRoundedRect(p.x - 22, p.y - 18, 44, 40, 6);
    g.fillStyle(0x5d6670, 1).fillRoundedRect(p.x - 18, p.y - 14, 36, 32, 5);
    g.fillStyle(0x2a3138, 1).fillTriangle(p.x + 14, p.y - 2, p.x + 34, p.y - 14, p.x + 34, p.y + 14);
    const on = p.on && time - p.at < 12000, blink = on ? 0.6 + 0.4 * Math.sin(time / 60) : 0.35;
    g.fillStyle(0xe5484d, blink).fillCircle(p.x - 2, p.y - 18, 11);
    g.fillStyle(0xffffff, on ? 0.8 : 0.25).fillCircle(p.x - 5, p.y - 21, 3);
    if (on) {
      const a = time / 220;
      for (const k of [0, Math.PI]) {
        const ax = Math.cos(a + k), ay = Math.sin(a + k) * 0.35;
        g.fillStyle(0xff4060, 0.18).fillTriangle(p.x - 2, p.y - 18, p.x - 2 + ax * 420 - ay * 120, p.y - 18 + ay * 420 + ax * 40, p.x - 2 + ax * 420 + ay * 120, p.y - 18 + ay * 420 - ax * 40);
      }
      if (Math.floor(time / 120) % 3 === 0) scene.fx.light?.(p.x, p.y - 18, { radius: 300, color: 0xff3040, alpha: 0.3, life: 140 });
    }
  }
}

export default {
  id: 'alarm', key: 'alarm',
  defaults: c => ({ time: c.time ?? 2500, adds: c.adds ?? 2, radius: c.radius ?? 0, flee: !!c.flee, addEnemy: c.addEnemy || '' }),
  init(e) { e.al = { phase: 'idle', point: null, until: 0, raised: false }; },

  think(e, time, dt, l) {
    const A = e.al, c = e.tc.alarm, s = e.scene;
    if (A.phase === 'done' || A.phase === 'dead') return false;
    if (A.phase === 'idle') {
      if (!(e.state === 'engage' || (e.state === 'alert' && e.seeing)) || e.peaceful) return false;
      const pts = alarmPoints(s);
      let best = null, bd = Infinity;
      for (const p of pts) { const d = Math.abs(p.x - e.x) + Math.abs(p.feet - e.feet) * 3; if (d < bd) { best = p; bd = d; } }
      A.point = best; A.phase = 'run';
      e.say(best ? 'Alarm!' : 'Hooorn!', '#ff4060');
    }
    if (A.phase === 'run') {
      const p = A.point;
      if (p && Math.abs(p.x - e.x) > 26 && !e.stuck) { e.walk(Math.sign(p.x - e.x), (e.d.speed ?? 200) * 1.25, e.M.drop); return true; }
      A.phase = 'crank'; A.until = time + c.time; e.stop();
      if (p) e.facing = Math.sign(p.x - e.x) || e.facing;
      return true;
    }
    if (A.phase === 'crank') {
      e.stop();
      if (time >= A.until) this.raise(e, time, l);
      return true;
    }
    return false;
  },

  raise(e, time, l) {
    const A = e.al, c = e.tc.alarm, s = e.scene, T = s.T;
    A.phase = 'done'; A.raised = true;
    if (A.point) { A.point.on = true; A.point.at = time; }
    e.afraid = e.afraid || c.flee;
    siren(s, 3600);
    s.cam?.shake(200, 0.004);
    s.hud?.toast?.('Alarm!', A.point ? 'Die Sirene heult · alle kommen' : 'Ein Horn · alle kommen', 'warn', 3200);
    const k = { x: l.x, y: l.chest, at: time }, called = [];
    for (const o of s.enemies) {
      if (o === e || !o.alive || o.peaceful || (c.radius > 0 && Math.abs(o.x - e.x) > c.radius)) continue;
      o.lastKnown = { ...k }; o.sirenAt = time; called.push(o.id);
      if (['patrol', 'alert'].includes(o.state)) { o.state = 'search'; o.searchStart = time; }
      else if (o.state === 'search') o.searchStart = time;
    }
    // help: from the alarm point's side away from Leyla (⚠️ no doors yet), the POI's weakest kit enemies or „Verstärkung“
    const pool = c.addEnemy ? [c.addEnemy] : poiPool(s, 'alarm'), from = A.point || e, adds = [];
    for (let i = 0; i < c.adds && pool.length; i++) {
      const away = Math.sign(from.x - l.x) || 1, side = i % 2 ? -away : away;
      const x = from.x + side * (220 + 90 * Math.floor(i / 2)), col = Math.max(1, Math.min(s.room.w - 2, Math.round(x / T - 0.5))), row = Math.round(from.feet / T) - 1, id = pool[i % pool.length];
      const en = s.addEnemy(id, col, row);
      if (!en) continue;
      en.state = 'search'; en.searchStart = time; en.lastKnown = { ...k }; en.sirenAt = time; en.added = 'alarm';
      s.fx.puff?.(en.x, en.feet, 0xc0a080);
      adds.push(id);
    }
    s.lastSiren = { by: e.id, at: time, called, adds, point: A.point ? A.point.i : null };
  },

  onDeath(e) { if (e.al.phase !== 'done') e.al.phase = 'dead'; },
  draw(e, time, g) {
    if (!e.alive || e.al.phase !== 'crank') return;
    const p = 1 - Math.max(0, e.al.until - time) / e.tc.alarm.time, x = e.x, y = e.body.top - 40;
    e.warn.setVisible(Math.floor(time / 120) % 2 === 0);
    g.fillStyle(0x0d0a12, 0.8).fillRect(x - 40, y - 6, 80, 12);
    g.fillStyle(0xff4060, 1).fillRect(x - 37, y - 3, 74 * p, 6);
  },
  state: e => ({ phase: e.al.phase, point: e.al.point ? e.al.point.i : null, raised: e.al.raised }),
};

// Alarmgeber (#139, concept 3.4): when he spots Leyla he runs to the nearest alarm point (room character „!“, a siren on the wall),
// cranks it for „Dauer“ ms and then it howls: every enemy of the POI (or in „Reichweite“) comes looking, „Verstärkung“ enemies
// appear. Without an alarm point he blows a horn where he stands. Caught before = quiet.
// The sirens themselves (scene.alarmPts) are drawn from code here too (alarmPoints / tickAlarms).
// #155 (Daniel 21.11.2026): a siren can be shot, struck or blown up (Spiel › Kampf › Sirene: Leben); a broken one cannot be cranked.
// Hacking comes later: it only needs to set p.hacked (hackSiren). The help comes out of the room's doors (D), else from an open edge,
// the nearest to the siren that Leyla does not see; without either beside the siren as before.
import { poiPool, siren } from './util.js';

export const sirenWorks = p => !!p && !p.broken && !p.hacked;
const sirenBox = p => ({ x0: p.x - 26, x1: p.x + 36, y0: p.y - 32, y1: p.y + 24 });

// the alarm points of the room: tile character „!“ (engine/room.js)
export function alarmPoints(scene) {
  if (scene.alarmRoom === scene.room) return scene.alarmPts;
  const T = scene.T;
  scene.alarmRoom = scene.room;
  scene.alarmG?.destroy();
  scene.alarmG = scene.add.graphics().setDepth(-2);
  const R = scene.room, floor = (x, y) => { let k = y + 1; while (k < (R?.h ?? 0) && !R.solid(x, k)) k++; return k * T; };   // the siren hangs on the wall, the floor below is where he cranks it
  const hp = scene.data_?.game?.combat?.sirenHp ?? 30;
  scene.alarmPts = (R?.marks?.['!'] || []).map(([x, y], i) => ({ i, x: (x + 0.5) * T, y: (y + 0.45) * T, feet: floor(x, y), on: false, at: 0, hp, maxHp: hp, broken: false, hacked: false }));
  return scene.alarmPts;
}
// Leyla's hits on the sirens: rects { x0, x1, y0, y1 } (a melee zone, a bullet's point) → how many sirens were hit
export function damageSirens(scene, rects, dmg, time = scene.now ?? 0) {
  if (!(scene.room?.marks?.['!'] || []).length) return 0;
  let n = 0;
  for (const p of alarmPoints(scene)) {
    if (p.broken) continue;
    const b = sirenBox(p);
    if (![].concat(rects).some(r => r.x1 > b.x0 && r.x0 < b.x1 && r.y1 > b.y0 && r.y0 < b.y1)) continue;
    n++; p.hp -= dmg; p.hitAt = time;
    scene.fx.sparks(p.x, p.y, 0xffd27a, 6);
    if (p.hp <= 0) breakSiren(scene, p, time);
  }
  if (n) scene.sfx?.('hit_metal', { x: alarmPoints(scene)[0]?.x });
  return n;
}
// an explosion at (x, y) with radius r
export function blastSirens(scene, x, y, r, dmg, time) {
  for (const p of (scene.room?.marks?.['!'] || []).length ? alarmPoints(scene) : []) {
    const b = sirenBox(p), nx = Math.max(b.x0, Math.min(x, b.x1)), ny = Math.max(b.y0, Math.min(y, b.y1));
    if (Math.hypot(nx - x, ny - y) <= r) damageSirens(scene, [b], dmg, time);
  }
}
export function breakSiren(scene, p, time = scene.now ?? 0) {
  if (p.broken) return;
  p.broken = true; p.on = false; p.hp = 0; p.brokeAt = time;
  scene.storyFx?.trace?.('siren', p.x, p.feet);   // #167 Leyla's trace
  scene.fx.sparks(p.x, p.y, 0xffd27a, 22); scene.fx.sparks(p.x, p.y - 18, 0xff4060, 10); scene.fx.puff?.(p.x, p.y, 0x5d6670);
  scene.fx.light?.(p.x, p.y, { radius: 260, color: 0xffd27a, alpha: 0.8, life: 160 });
  scene.fx.text?.(p.x, p.y - 50, 'Sirene kaputt', { color: '#ffd27a', size: 40, rise: 40 });
  scene.cam?.shake(120, 0.004);
}
// hook for hacking (later, design.md › Hacking): a hacked siren stays quiet for them
export function hackSiren(scene, i) { const p = alarmPoints(scene)[i]; if (p) { p.hacked = true; p.on = false; } return p || null; }

// where the help comes from: the doors of the level (D, PoiLevel) or test doors, else an open edge of the room → [{ col, row, dir, door }]
function exits(s) {
  const R = s.room, out = [];
  if (!R) return out;
  const stand = (c, r) => c > 0 && c < R.w - 1 && r > 1 && !R.solid(c, r) && !R.solid(c, r - 1) && R.solid(c, r + 1);
  for (const d of [...(s.level?.doors || []), ...(s.testDoors || [])]) {
    const row = d.y1 - 1, mid = Math.floor((d.x0 + d.x1 - 1) / 2);
    if (d.open && stand(mid, row)) { out.push({ col: mid, row, dir: 0, door: d }); continue; }
    for (const [c, dir] of [[d.x0 - 1, -1], [d.x1, 1]]) if (stand(c, row)) out.push({ col: c, row, dir, door: d });
  }
  if (!out.length) for (const [edge, c, dir] of [[0, 1, 1], [R.w - 1, R.w - 2, -1]]) for (let r = 2; r < R.h - 1; r++) if (!R.solid(edge, r) && stand(c, r)) out.push({ col: c, row: r, dir, edge: true });
  return out;
}
function bestExit(s, from) {
  // in Leyla's view: the camera's size around her (the camera itself trails a little behind)
  const T = s.T, v = s.cameras?.main?.worldView, l = s.leyla, seen = o => !!(v?.width && l) && Math.abs((o.col + 0.5) * T - l.x) < v.width / 2 + 60 && Math.abs((o.row - 0.5) * T - l.chest) < v.height / 2 + 60;
  let best = null, bd = Infinity;
  for (const o of exits(s)) { const d = Math.abs((o.col + 0.5) * T - from.x) + Math.abs((o.row + 1) * T - from.feet) * 3 + (seen(o) ? 1e6 : 0); if (d < bd) { best = { ...o, seen: seen(o) }; bd = d; } }
  return best;
}
// the door opens a little and lets light through (art of PoiLevel doors goes up and down again; doors without art just glow)
function openBriefly(s, o, time) {
  const T = s.T, d = o.door;
  (s.alarmDoorFx ??= []).push({ x0: d ? d.x0 * T : o.col * T, x1: d ? d.x1 * T : (o.col + 1) * T, y0: d ? d.y0 * T : (o.row - 2) * T, y1: d ? d.y1 * T : (o.row + 1) * T, at: time });
  if (d?.art && !d.open && !s.tweens.isTweening(d.art)) s.tweens.add({ targets: d.art, y: -(d.y1 - d.y0) * T * 0.8, duration: 260, hold: 900, yoyo: true, ease: 'Sine.easeOut' });
  s.sfx?.('door_open', { x: (o.col + 0.5) * T });
}
export function tickAlarms(scene, time) {
  const pts = alarmPoints(scene), g = scene.alarmG;
  if (!g) return;
  g.clear();
  for (const f of scene.alarmDoorFx || []) {   // light out of the doorway the help came through
    const k = 1 - (time - f.at) / 1400;
    if (k > 0) { g.fillStyle(0xffd27a, 0.35 * k).fillRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0); g.lineStyle(4, 0xffe6a8, 0.8 * k).strokeRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0); }
  }
  if (scene.alarmDoorFx) scene.alarmDoorFx = scene.alarmDoorFx.filter(f => time - f.at < 1400);
  for (const p of pts) {
    if (p.broken) { drawBroken(scene, g, p, time); continue; }
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
    if (p.hp < p.maxHp) g.lineStyle(2, 0x0d0a12, 1).lineBetween(p.x - 12, p.y - 10, p.x - 2, p.y + 2).lineBetween(p.x - 2, p.y + 2, p.x + 8, p.y - 4);   // dented
    if (p.hacked) g.fillStyle(0x3fe0d0, 0.5 + 0.3 * Math.sin(time / 200)).fillCircle(p.x + 12, p.y + 12, 4);
  }
}
// broken: dark box, the horn hangs down, the dome cracked, wires and sparks now and then
function drawBroken(scene, g, p, time) {
  g.fillStyle(0x0d0a12, 1).fillRoundedRect(p.x - 22, p.y - 14, 44, 36, 6);
  g.fillStyle(0x3a3f46, 1).fillRoundedRect(p.x - 18, p.y - 10, 36, 28, 5);
  g.fillStyle(0x1b1f24, 1).fillTriangle(p.x + 12, p.y + 10, p.x + 22, p.y + 40, p.x + 36, p.y + 30);   // horn hanging by a screw
  g.fillStyle(0x5a1a20, 1).fillCircle(p.x - 2, p.y - 14, 10);
  g.lineStyle(2, 0x0d0a12, 1).lineBetween(p.x - 10, p.y - 18, p.x + 2, p.y - 10).lineBetween(p.x - 2, p.y - 22, p.x - 4, p.y - 8).lineBetween(p.x - 14, p.y - 2, p.x + 10, p.y + 12);
  g.lineStyle(3, 0x8a6a30, 1).lineBetween(p.x - 8, p.y + 22, p.x - 14, p.y + 44).lineStyle(3, 0x6a2a2a, 1).lineBetween(p.x + 4, p.y + 22, p.x + 6, p.y + 50);   // wires
  const t = (time + p.i * 377) % 1300;
  if (t < 140) {
    const ex = p.x + 6 + ((time / 40) % 3 - 1) * 3, ey = p.y + 50;
    g.lineStyle(2, 0xbff8ff, 0.9).lineBetween(ex, ey, ex + 10, ey + 8).lineBetween(ex + 10, ey + 8, ex + 2, ey + 16);
    if (t < 20) { scene.fx.sparks(ex, ey, 0xffd27a, 4); scene.fx.light?.(ex, ey, { radius: 120, color: 0xbff8ff, alpha: 0.5, life: 90 }); }
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
      if (!this.pick(e)) return false;
      e.say(A.point ? 'Alarm!' : 'Hooorn!', '#ff4060');
      A.phase = 'run';
    }
    if (A.point && !sirenWorks(A.point) && !this.pick(e)) return false;   // #155 shot to pieces (or hacked) on the way: the next one
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

  // the nearest working siren; without sirens in the room a horn; all sirens broken: no alarm (false)
  pick(e) {
    const A = e.al, pts = alarmPoints(e.scene);
    let best = null, bd = Infinity;
    for (const p of pts) { if (!sirenWorks(p)) continue; const d = Math.abs(p.x - e.x) + Math.abs(p.feet - e.feet) * 3; if (d < bd) { best = p; bd = d; } }
    if (!best && pts.length) { A.phase = 'done'; A.point = null; A.broken = true; e.say(['Mist, kaputt!', 'Die Sirene!', 'Na toll.'][Math.floor(Math.random() * 3)], '#ffd27a'); return false; }
    if (A.phase === 'crank' && best !== A.point) A.phase = 'run';
    A.point = best;
    return true;
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
    // help (#155): out of the door nearest to the siren that Leyla does not see (else an open edge, else beside the siren on the side
    // away from her); the POI's weakest kit enemies or „Verstärkung“
    const pool = c.addEnemy ? [c.addEnemy] : poiPool(s, 'alarm'), from = A.point || e, adds = [], exit = c.adds > 0 && pool.length ? bestExit(s, from) : null;
    if (exit) openBriefly(s, exit, time);
    for (let i = 0; i < c.adds && pool.length; i++) {
      const away = Math.sign(from.x - l.x) || 1, side = i % 2 ? -away : away, id = pool[i % pool.length];
      let col, row;
      if (exit) { const step = exit.dir || (i % 2 ? -1 : 1), k = Math.ceil(i / (exit.dir ? 1 : 2)); col = exit.col + step * k; row = exit.row; if (s.room.solid(col, row) || !s.room.solid(col, row + 1)) col = exit.col; }
      else { const x = from.x + side * (220 + 90 * Math.floor(i / 2)); col = Math.max(1, Math.min(s.room.w - 2, Math.round(x / T - 0.5))); row = Math.round(from.feet / T) - 1; }
      const en = s.addEnemy(id, col, row);
      if (!en) continue;
      en.state = 'search'; en.searchStart = time; en.lastKnown = { ...k }; en.sirenAt = time; en.added = 'alarm';
      s.fx.puff?.(en.x, en.feet, 0xc0a080);
      adds.push(id);
    }
    s.lastSiren = { by: e.id, at: time, called, adds, point: A.point ? A.point.i : null, from: exit ? (exit.edge ? 'edge' : 'door') : 'siren', exit: exit && { col: exit.col, row: exit.row, seen: exit.seen } };
  },

  onDeath(e) { if (e.al.phase !== 'done') e.al.phase = 'dead'; },
  draw(e, time, g) {
    if (!e.alive || e.al.phase !== 'crank') return;
    const p = 1 - Math.max(0, e.al.until - time) / e.tc.alarm.time, x = e.x, y = e.body.top - 40;
    e.warn.setVisible(Math.floor(time / 120) % 2 === 0);
    g.fillStyle(0x0d0a12, 0.8).fillRect(x - 40, y - 6, 80, 12);
    g.fillStyle(0xff4060, 1).fillRect(x - 37, y - 3, 74 * p, 6);
  },
  state: e => ({ phase: e.al.phase, point: e.al.point ? e.al.point.i : null, raised: e.al.raised, broken: !!e.al.broken }),
};

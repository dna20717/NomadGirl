// Werfer (#139, concept 3.2): keeps his distance and lobs grenades, molotovs or acid at Leyla in a high arc, also over chests at
// the place he last saw her. The landing marker shows from the throw on (game/play/throwables.js, shared with Leyla's grenade #140).
// The throw borrows the kit's attack animation (windup frames while aiming, the rest on the throw).
import { Throwables } from '../throwables.js';

export default {
  id: 'grenadier', key: 'throw',
  defaults: c => ({ item: c.item || 'granate', fuse: c.fuse ?? 900, radius: c.radius ?? 140, damage: c.damage ?? 100, count: Math.max(1, c.count ?? 1), burn: c.burn ?? 3 }),
  init(e) { e.gr = { aiming: false, target: null, thrown: 0 }; },

  think(e, time, dt, l) {
    const G = e.gr, s = e.scene;
    if (e.state === 'windup' && G.aiming) {
      e.stop();
      e.facing = Math.sign(G.target.x - e.x) || e.facing;
      if (time >= e.windupEnd) this.release(e, time);
      return true;
    }
    if (e.state !== 'engage' || !l.alive) return false;
    // she hid: lob it at the last place he saw her for a little while
    const k = e.seeing ? { x: l.x + l.body.velocity.x * 0.25, y: l.feet } : (time - e.lastSeen < 3000 && e.lastKnown ? { x: e.lastKnown.x, y: l.feet } : null);
    if (!k) return false;
    const dist = Math.abs(l.x - e.x), range = e.a.range ?? 560;
    if (dist < range * 0.45 && e.safeStep(-Math.sign(l.x - e.x) || -e.facing)) e.walk(-Math.sign(l.x - e.x) || -e.facing, (e.d.speed ?? 160) * 0.9, 0);
    else if (dist > range * 1.25) e.walk(Math.sign(l.x - e.x), (e.d.speed ?? 160) * 0.8, e.M.drop);
    else e.stop();
    e.facing = Math.sign(l.x - e.x) || e.facing;
    if (time >= e.readyAt && dist < range * 1.6) {
      e.state = 'windup'; e.windupEnd = time + (e.a.windup ?? 700); G.aiming = true; G.target = k;
    }
    return true;
  },

  release(e, time) {
    const G = e.gr, c = e.tc.grenadier, s = e.scene, T = Throwables.of(s);
    G.aiming = false;
    const hx = e.x + e.facing * e.w * 0.4, hy = e.body.top + e.body.height * 0.15;
    for (let i = 0; i < c.count; i++) {
      const tx = G.target.x + (i - (c.count - 1) / 2) * c.radius * 0.9, v = Throwables.aim(hx, hy, tx, G.target.y - 8);
      T.throw({ x: hx, y: hy, vx: v.vx, vy: v.vy, item: c.item, fuse: c.fuse, radius: c.radius, damage: Math.round((e.d.damage ?? 10) * c.damage / 100), burn: c.burn, friendly: false, from: e, time });
      G.thrown++;
    }
    e.state = 'recover'; e.until = time + 420; e.strikeAt = time; e.struck = true;
    e.readyAt = time + (e.a.cooldown ?? 2600);
    e.say(c.item === 'molotow' ? 'Brenn!' : c.item === 'saeure' ? 'Friss das!' : 'Fang!', '#ffb070');
  },
  onHit(e) { if (e.gr.aiming) { e.gr.aiming = false; } },

  draw(e, time, g) {
    if (!e.alive || !(e.state === 'windup' && e.gr.aiming)) return;
    const c = e.tc.grenadier, x = e.x - e.facing * e.w * 0.3, y = e.body.top + e.body.height * 0.1;
    g.fillStyle(0x0d0a12, 1).fillCircle(x, y, 11);
    g.fillStyle(c.item === 'molotow' ? 0xb06a2a : c.item === 'saeure' ? 0x7fbf3a : 0x4e5a3a, 1).fillCircle(x, y, 8);
    if (c.item === 'molotow') g.fillStyle(0xffd27a, 0.6 + 0.4 * Math.sin(time / 40)).fillCircle(x, y - 12, 5);
  },
  state: e => ({ aiming: e.gr.aiming, thrown: e.gr.thrown }),
};

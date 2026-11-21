// Feigling (#139, concept 3.8): below „Flieht ab“ % life (or after he raised the alarm) he runs away from Leyla, towards his
// friends if there are any on the far side; on the first fright he may drop his loot. Cornered at a wall, he fights again.
import { rollLoot } from '../../inventory.js';

export default {
  id: 'coward', key: 'flee',
  defaults: c => ({ at: c.at ?? 35, drop: c.drop ?? 50 }),
  init(e) { e.cw = { fleeing: false, dropped: false, cornered: 0 }; },

  think(e, time, dt, l) {
    const W = e.cw, c = e.tc.coward, s = e.scene;
    if (!['engage', 'search', 'alert', 'recover'].includes(e.state) || !l.alive) return false;
    if (!W.fleeing && (e.afraid || e.hp / e.maxHp * 100 <= c.at)) {
      W.fleeing = true;
      e.say(['Ich hau ab!', 'Nicht schießen!', 'Hilfe!'][Math.floor(Math.random() * 3)], '#ffd27a');
      if (!W.dropped && Math.random() * 100 < c.drop) this.drop(e);
    }
    if (!W.fleeing || time < W.cornered) return false;
    const away = Math.sign(e.x - l.x) || 1, speed = (e.d.speed ?? 200) * 1.2;
    if (Math.abs(e.x - l.x) > e.S.sight * 1.3) { e.stop(); e.facing = -away; return true; }   // far enough: catches his breath
    e.walk(away, speed, e.M.drop);
    if (e.stuck) { W.cornered = time + 2500; e.facing = -away; e.say('Na gut!', '#ff4060'); return false; }
    return true;
  },
  drop(e) {
    const s = e.scene, D = s.data_;
    e.cw.dropped = true;
    if (!e.d.loot || !s.loot) return;
    const t = (s.lootRoll ? s.lootRoll(e.d.loot) : rollLoot(D, e.d.loot)) || [];
    e.d = { ...e.d, loot: null };   // what he drops now is gone from his body
    if (t.length) s.loot.drop(e.x, e.feet, t);
  },
  state: e => ({ fleeing: e.cw.fleeing, dropped: e.cw.dropped }),
};

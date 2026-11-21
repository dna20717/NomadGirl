// Trait register (#139, docs/concepts/enemy_kit.md › 2): behaviour from building blocks. A trait is one file with the hooks it needs:
//   init(e, cfg)                       after the constructor (cfg = e.tc[id], the trait's section with its defaults)
//   think(e, time, dt, l) → true       before the state machine: true = the trait drives this frame
//   onSee(e, time, l) · onAlarm(e, time) · onHit(e, time, dmg, info) → dmg? · onHurt(e, time, info) (after the damage)
//   onDeath(e, time) · onAllyDeath(e, ally, time) · draw(e, time, g) (code graphics) · state(e) → for nomad.state()
// Gegner › Bausteine (`traits`, multi) picks them, each has its own section in the area „Gegner“ (key = the data block).
import sniper from './sniper.js';
import medic from './medic.js';
import alarm, { tickAlarms } from './alarm.js';
import coward from './coward.js';
import grenadier from './grenadier.js';
import surrender, { surrenderUse } from './surrender.js';

export const TRAITS = { sniper, medic, alarm, coward, grenadier, surrender };
export { surrenderUse };

// the traits of one enemy, in a fixed order (surrender first: a kneeling enemy does nothing else)
const ORDER = ['surrender', 'coward', 'medic', 'alarm', 'sniper', 'grenadier'];
export function traitsOf(e) {
  const want = new Set(e.d.traits || []);
  e.tc = {};
  const list = ORDER.filter(id => want.has(id)).map(id => TRAITS[id]);
  for (const t of list) e.tc[t.id] = t.defaults(e.d[t.key] || {});
  return list;
}
// call one hook on every trait of e; the last defined answer wins (think: any true wins)
export function fire(e, name, ...args) {
  let out;
  for (const t of e.traits || []) {
    const f = t[name];
    if (!f) continue;
    const v = f.call(t, e, ...args);
    if (name === 'think') { if (v) return true; } else if (v !== undefined) out = v;
  }
  return out;
}

// once per frame for the whole scene: the sirens on the walls
export function sceneTick(scene, time) {
  const g = scene.leyla?.grenade;   // #140 Leyla's grenade: arm layer and HUD
  if (g) { g.draw(time); g.hud(scene); }
  if (scene.mode === 'camp' || !scene.room) return;
  if ((scene.room.marks?.['!'] || []).length || scene.alarmPts?.length) tickAlarms(scene, time);
}

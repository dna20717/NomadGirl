// Ergibt sich (#139, concept 3.8, Daniel 21.11.2026: „Ergeben ja“): below „Ergibt sich ab“ % life, once, with „Chance“ %, he throws
// his weapon away and kneels (crouch pose). Leyla decides with Benutzen (E / ↑ / stick up, docs/features/ui.md):
//   Gefangen nehmen  he lies tied up like loot (#079 game/prisoners.js), no Ruf lost for him
//   Laufen lassen    Ruf with the POI's gang + „Ruf fürs Laufenlassen“, he runs off (counts as beaten, no loot)
//   Erledigen        Ruf − „Ruf fürs Erledigen“ on top of the kill
// A hit while he kneels that kills him counts as Erledigen.
import { capture } from '../../prisoners.js';
import { addRep, levelName } from '../../reputation.js';

export default {
  id: 'surrender', key: 'surrender',
  defaults: c => ({ at: c.at ?? 30, chance: c.chance ?? 50, repFree: c.repFree ?? 3, repKill: c.repKill ?? 5 }),
  init(e) { e.sr = { rolled: false, given: false, outcome: null, leaveUntil: 0 }; },

  onHurt(e, time) {
    const R = e.sr, c = e.tc.surrender;
    if (!e.alive || R.rolled || e.state === 'surrender' || e.hp / e.maxHp * 100 > c.at) return;
    R.rolled = true;
    if (Math.random() * 100 < c.chance) this.give(e, time);
  },
  give(e, time) {
    const s = e.scene, R = e.sr;
    R.given = true;
    e.state = 'surrender'; e.kneel = true; e.duckAt = time; e.readyAt = 1e12; e.stop(); e.aim.clear(); e.warn.setVisible(false);
    e.say(['Ich ergebe mich!', 'Nicht schießen!', 'Gnade!'][Math.floor(Math.random() * 3)], '#f2f5f8');
    // the weapon flies away: with „Lässt seine Waffe fallen“ % it lies there to pick up
    s.fx.sparks(e.x - e.facing * 40, e.chest, 0xc0c8d0, 8);
    if (e.d.weapon && s.loot && Math.random() * 100 < (e.d.dropWeapon ?? 0)) s.loot.drop(e.x - e.facing * 70, e.feet, [{ a: 'weapons', id: e.d.weapon, n: 1 }]);
    e.d = { ...e.d, dropWeapon: 0 };
  },

  think(e, time) {
    const R = e.sr;
    if (e.state === 'surrender') { e.stop(); return true; }
    if (e.state === 'leaving') {   // laufen lassen: off he goes, away from her, and fades
      const away = Math.sign(e.x - e.scene.leyla.x) || 1;
      e.walk(away, (e.d.speed ?? 180) * 1.3, e.M.drop);
      e.sprite.setAlpha(Math.max(0, (R.leaveUntil - time) / 1500));
      if (time >= R.leaveUntil) gone(e, time);
      return true;
    }
    return false;
  },
  onDeath(e) {
    const R = e.sr;
    if (R.given && !R.outcome) { R.outcome = 'killed'; rep(e, -e.tc.surrender.repKill, 'Hingerichtet'); }
  },
  draw(e, time, g) {
    if (e.state !== 'surrender') return;
    const x = e.x, y = e.body.top - 34 + Math.sin(time / 300) * 4;   // a little white flag
    g.lineStyle(3, 0x8b949e, 1).lineBetween(x, y + 30, x, y - 10);
    g.fillStyle(0xf2f5f8, 0.95).fillTriangle(x, y - 10, x + 26 + Math.sin(time / 120) * 3, y - 2, x, y + 6);
  },
  state: e => ({ given: e.sr.given, outcome: e.sr.outcome }),
};

function rep(e, n, why) {
  const s = e.scene, G = s.gang?.(), save = s.box?.save;
  if (!G?.name || !save || !n) return null;
  const r = addRep(s.data_, save, G.name, n);
  s.hud?.toast?.(`${G.name}: Ruf ${n > 0 ? '+' : '−'}${Math.abs(n)}`, r?.changed ? `${why} · jetzt ${levelName(r.level)}` : why, n > 0 ? 'good' : 'warn', 3200);
  return r;
}
// he is off the field without a fight: counts as beaten (ranking), no Ruf loss for the kill (scene.onKill reads e.spared)
function gone(e, time) {
  const s = e.scene;
  e.state = 'dead'; e.diedAt = time; e.kneel = false; e.body.enable = false;
  e.warn.setVisible(false); e.aim.clear(); e.bar.clear(); e.gear.clear(); e.tg?.clear();
  s.tweens.add({ targets: e.sprite, alpha: 0, duration: 400 });
  s.onKill(e);
}

// the decision (Benutzen): called by the scene every frame → true while a kneeling enemy is in reach (it owns the E prompt then)
export function surrenderUse(s, input) {
  const l = s.leyla, range = s.data_.camp?.interactRange ?? 130;
  const e = l?.alive && !s.hud.modal ? s.enemies.find(o => o.alive && o.state === 'surrender' && Math.abs(o.x - l.x) < range && Math.abs(o.feet - l.feet) < 60) : null;
  if (!e) { if (s.surrenderPrompt) { s.surrenderPrompt = false; s.hud.prompt(null); s.vanPrompt = undefined; } return false; }
  const text = `${e.d.name || 'Gegner'} ergibt sich · entscheiden`;
  if (!s.surrenderPrompt || s.hud.promptText !== text) { s.surrenderPrompt = true; s.vanPrompt = undefined; s.hud.prompt(text, 'E'); }
  if (input.grab?.pressed) decide(s, e);
  return true;
}
export function decide(s, e) {
  const c = e.tc.surrender, G = s.gang?.(), g = G?.name ? ` bei ${G.name}` : '';
  s.hud.menu({ title: `${e.d.name || 'Gegner'} ergibt sich`, sub: 'Er kniet, die Waffe liegt weg. Was jetzt?', items: [
    { label: 'Gefangen nehmen', sub: 'Gefesselt liegt er da wie Beute · die Zelle im Rig nimmt ihn auf', disabled: s.box ? false : 'Nur im Run mit Spielstand', act: () => resolve(s, e, 'capture') },
    { label: 'Laufen lassen', sub: `Ruf${g} +${c.repFree} · keine Beute`, act: () => resolve(s, e, 'free') },
    { label: 'Erledigen', sub: `Ruf${g} −${c.repKill}`, act: () => resolve(s, e, 'kill') },
  ] });
}
export function resolve(s, e, how) {
  if (!e.alive || e.state !== 'surrender') return false;
  const time = s.now ?? s.time.now, R = e.sr;
  if (how === 'capture') {
    R.outcome = 'captured'; e.spared = 'captured'; e.lastHit = { kind: 'spared' };
    if (s.loot && s.box) s.loot.drop(e.x, e.feet, [capture(s.data_, e, s.gang?.()?.name || null)]);
    s.fx.text(e.x, e.body.top - 20, 'Gefesselt', { color: '#c7b08b', size: 44, rise: 40 });
    gone(e, time);
  } else if (how === 'free') {
    R.outcome = 'freed'; e.spared = 'freed'; e.kneel = false;
    rep(e, cfgOf(e).repFree, 'Laufen gelassen');
    e.say('Danke …', '#9fe0a0');
    e.state = 'leaving'; R.leaveUntil = time + 1500;
  } else {
    R.outcome = 'killed';
    rep(e, -cfgOf(e).repKill, 'Erledigt');
    e.hit(time, Math.ceil(e.hp) + 999, 120, s.leyla.facing || 1, false, { kind: 'melee', heavy: true });
  }
  return true;
}
const cfgOf = e => e.tc.surrender;

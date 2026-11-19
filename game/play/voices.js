// Gibberish in the game (game/voice.js): the dialogue box babbles along with the typed line, speech bubbles in the camp babble
// quieter with distance, Leyla answers with a short noise, raiders shout when they spot Leyla, get hit or fall.
// Spiel › Stimmen switches and scales it; silent when the game is muted.
import { speak, sound, voiceOf, answerSound } from '../voice.js';

export function voices(scene) {
  const D = () => scene.data_ || {}, V = () => D().game?.voice || {};
  const ctx = () => { const c = scene.sound?.context; return c && !scene.sound.mute && !scene.muted && c.state !== 'closed' && V().enabled !== false ? c : null; };
  const vol = k => ((V().volume ?? 70) / 100) * k;
  let line = null;
  const lastBark = new WeakMap(), who = new WeakMap(); let nth = 0;
  return {
    // the dialogue box: who = { id, name, voice, style }; returns the handle (stop() when the player skips)
    line(text, who) {
      const c = ctx(); this.stop(0.05);
      if (!c || !text || !who) return null;
      line = speak(c, c.destination, voiceOf(D(), who), text, { volume: vol(1), max: V().max ?? 4 });
      return line;
    },
    stop(fade = 0.08) { line?.stop(fade); line = null; },
    // a speech bubble in the world: quieter the further Leyla is
    bubble(text, who, x) {
      const c = ctx(); if (!c || !text) return null;
      const l = scene.leyla, d = l && Number.isFinite(x) ? Math.abs(l.x - x) : 0, k = Number.isFinite(d) ? Math.max(0, 1 - d / 900) : 1;
      if (k <= 0.05) return null;
      return speak(c, c.destination, voiceOf(D(), who), text, { volume: vol((V().bubbles ?? 60) / 100) * k, max: 2.5 });
    },
    // Leyla's short noise when she answers (Spiel › Stimmen › Leyla macht Laute)
    leyla(label) {
      const c = ctx(); if (!c || V().leyla === false) return null;
      return sound(c, c.destination, voiceOf(D(), { voice: D().leyla?.voice, name: 'Leyla' }), answerSound(label), { volume: vol(0.9) });
    },
    // an enemy shouts: kind = alert | hurt | die | taunt; at most every Rufe höchstens alle s per enemy (dying always)
    bark(enemy, kind) {
      const c = ctx(); if (!c || V().barks === false || !enemy) return null;
      const now = scene.time?.now ?? performance.now(), gap = (V().barkGap ?? 4) * 1000;
      if (kind !== 'die' && now - (lastBark.get(enemy) ?? -1e9) < gap) return null;
      if (kind === 'hurt' && Math.random() * 100 > (V().barkChance ?? 35)) return null;
      lastBark.set(enemy, now);
      const def = enemy.d || D().enemies?.[enemy.id] || {}, l = scene.leyla, d = l ? Math.hypot(l.x - enemy.x, (l.chest ?? l.feet ?? enemy.y ?? 0) - (enemy.chest ?? enemy.y ?? l.chest ?? 0)) : 0, k = Number.isFinite(d) ? Math.max(0.15, 1 - d / 1400) : 1;
      // every raider its own voice from the pool (unless its kind has one): picked by kind and a running number
      if (!who.has(enemy)) who.set(enemy, { voice: def.voice, name: `${def.name || enemy.id}#${nth++}`, style: def.family === 'anomaly' ? 'glitch' : def.family === 'machine' ? 'robot' : 'beast' });
      return sound(c, c.destination, voiceOf(D(), who.get(enemy)), kind, { volume: vol(0.8) * k });
    },
  };
}

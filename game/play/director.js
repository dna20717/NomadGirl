// Regie im POI (#169 G3, wie der Director in Left 4 Dead): Spannung baut sich auf (Gegner im Kampf, Treffer, Kills, Sirenen), platzt an
// der Spitze und klingt in der Ruhe ab. Verstärkung (Sirene #155, eigene Wellen aus Türen außer Sicht) kommt nur in Aufbau und Spitze,
// nie in der Ruhe, nie in einer Atempause, nie in den ersten Sekunden im Wow-Raum. Die Musik-Schichten aus der Radio-Engine
// (game/radio.js + radio_audio.js) folgen: Ruhe = Flächen und Bass, Anspannung = dazu Hi-Hat und Melodie, Kampf = alles.
// Logic in engine/ecosystem.js (directorStep, mayReinforce, musicLayer, wantsWave).
import { lifeConfig, newDirector, directorStep, mayReinforce, musicLayer, wantsWave } from '../../engine/ecosystem.js';
import { roomType } from '../../engine/level_design.js';
import { song } from '../radio.js';
import { RadioSynth } from '../radio_audio.js';
import { reinforce } from './traits/alarm.js';
import { poiPool } from './traits/util.js';

const LAYERS = { calm: ['pad', 'bass'], tension: ['pad', 'bass', 'hat', 'lead'], combat: null };
const FIGHT = new Set(['engage', 'windup', 'strike', 'recover', 'cover', 'duck', 'dodge', 'stagger']);

export class Director {
  constructor(scene) {
    const s = this.scene = scene, C = lifeConfig(s.data_);
    this.on = !!s.levelInfo?.def && (s.mode === 'run' || s.mode === 'test') && !s.megarig && C.enabled;
    if (!this.on) return;
    this.R = C.director; this.st = newDirector();
    this.hp = s.leyla.health; this.kills = 0; this.sirenAt = null; this.room = null; this.enterAt = 0; this.held = 0; this.layer = null; this.waveLog = [];
    this.music = this.R.music > 0 ? new RadioSynth(() => { const c = s.sound?.context; return c && c.state === 'running' && !s.sound.mute ? c : null; }) : null;
    this.song = song(s.data_, { style: 'synth', bpm: 92, scale: 'minor' }, (s.levelSeed || 1) >>> 0);
    s.events.once('shutdown', () => this.music?.stop(0.2));
  }
  // the room Leyla stands in (POI level)
  here() {
    const s = this.scene, LI = s.levelInfo, l = s.leyla, tx = l.x / s.T, ty = l.feet / s.T - 0.5;
    return LI.rooms.find(r => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) || null;
  }
  ctx(time) {
    const r = this.room, R = r ? this.scene.data_.rooms?.[r.id] : null, t = R ? roomType(R) : null;
    return { rest: !!(r?.rest || t === 'rest'), wow: !!(r?.wow || t === 'wow'), inRoom: (time - this.enterAt) / 1000, arena: !!r && r.band === 'main' && ['arena', 'corridor', 'vertical'].includes(t) };
  }
  // may help come now (the siren asks)?
  allowHelp(time = this.scene.now ?? 0) { const ok = !this.on || mayReinforce(this.st, this.ctx(time), this.R); if (!ok) this.held++; return ok; }
  siren() { this.sirenNow = true; }
  update(time, dt) {
    if (!this.on) return;
    const s = this.scene, l = s.leyla, here = this.here();
    if (here !== this.room) { this.room = here; this.enterAt = time; }
    const engaged = s.enemies.filter(e => e.alive && FIGHT.has(e.state) && !e.peaceful).length;
    const hurt = Math.max(0, this.hp - l.health); this.hp = l.health;
    const kills = Math.max(0, (s.kills || 0) - this.kills); this.kills = s.kills || 0;
    const ctx = this.ctx(time);
    directorStep(this.st, { dt, engaged, hurt, kills, siren: !!this.sirenNow, rest: ctx.rest }, this.R);
    this.sirenNow = false;
    if (wantsWave(this.st, ctx, this.R) && l.alive) this.wave(time);
    const layer = musicLayer(this.st, this.R);
    if (layer !== this.layer) this.setLayer(layer);
    else if (this.music && !this.music.playing && time > (this.retry ?? 0)) { this.retry = time + 2000; this.sound(); }   // the audio woke up later
  }
  // a wave in a long lull: a few of the POI's weakest out of a door she does not see, looking where she is
  wave(time) {
    const s = this.scene, pool = poiPool(s, 'alarm'), l = s.leyla;
    this.st.waves++; this.st.lullSince = 0;
    if (!pool.length) return;
    const ids = Array.from({ length: this.R.waveSize }, (_, i) => pool[i % Math.min(pool.length, 2)]);
    const r = reinforce(s, { x: l.x, feet: l.feet }, ids, { x: l.x, y: l.chest, at: time }, time, 'director');
    this.waveLog.push({ t: Math.round(time), room: this.room?.id || null, adds: r.adds, from: r.exit ? (r.exit.edge ? 'edge' : 'door') : 'near', seen: !!r.exit?.seen });
    if (r.adds.length) s.hud?.toast?.('Schritte', 'Hinter einer Tür kommt jemand', 'warn', 2600);
  }
  setLayer(layer) {
    this.layer = layer; this.changes = (this.changes || 0) + 1;
    this.sound();
  }
  sound() {
    const m = this.music, layer = this.layer; if (!m || !layer) return;
    if (!m.playing && !m.play(this.song, 'synth', 0.35 * this.R.music / 100)) return;
    m.setVoices(LAYERS[layer]);
    m.setVolume(0.35 * this.R.music / 100 * (layer === 'calm' ? 0.6 : layer === 'tension' ? 0.8 : 1));
  }
  state() {
    if (!this.on) return { on: false };
    const st = this.st;
    return { on: true, phase: st.phase, tension: Math.round(st.tension), peaks: st.peaks, waves: st.waves, waveLog: this.waveLog.slice(-4), log: st.log.slice(-10), held: this.held,
      layer: this.layer, changes: this.changes || 0, playing: !!this.music?.playing, room: this.room?.id || null, ctx: this.room ? this.ctx(this.scene.now ?? 0) : null, help: this.room ? mayReinforce(st, this.ctx(this.scene.now ?? 0), this.R) : true };
  }
}

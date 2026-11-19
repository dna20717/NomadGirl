// Rig-Radio (#090): the chip at the bottom right, the station loop (song → DJ → song …), N for the next station (after the last one: off),
// the pause menu entry. Plays in the camp and on the drive (TravelMode), never in a POI (the radio is in the rig) and not when muted.
// What it says comes from game/radio.js, the music from game/radio_audio.js. On/off and the station are kept in this browser.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { radioConfig, song, talk, jammed, rng } from '../radio.js';
import { RadioSynth } from '../radio_audio.js';

const KEY = 'nomadgirl-radio';
export class RadioUI {
  constructor(root, host) {
    this.host = host;
    let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* private mode */ }
    this.on = !!saved.on; this.idx = saved.station || 0;
    this.synth = new RadioSynth(() => { const c = this.scene?.sound?.context; return c && c.state !== 'closed' ? c : null; });
    this.seg = null; this.songs = 0; this.seed = (Date.now() / 1000) | 0;
    this.el = el('button', { class: 'radio-chip', title: 'Rig-Radio (N: nächster Sender)', onclick: e => { e.currentTarget.blur(); this.next(); } });
    root.append(this.el);
    this.timer = setInterval(() => this.tick(), 250);
    this.paint();
  }
  get scene() { return this.host.scene(); }
  get D() { return this.scene?.data_; }
  get C() { return radioConfig(this.D); }
  get station() { const S = this.C.stations; return S.length ? S[((this.idx % S.length) + S.length) % S.length] : null; }
  get playing() { return this.synth.playing; }
  keep() { try { localStorage.setItem(KEY, JSON.stringify({ on: this.on, station: this.idx })); } catch { /* private mode */ } }
  // where it may play: the camp, the drive; a run (POI) is quiet
  allowed() {
    const s = this.scene, h = s?.hud;
    return !!(s && this.D && this.C.enabled && this.station && !(s.muted ?? s.sound?.mute) && (s.mode === 'camp' || h?.drive?.isOpen) && s.box);
  }
  // N / the chip: next station; after the last one the radio goes off, from off it starts with the first
  next() {
    if (!this.D || !this.C.enabled || !this.C.stations.length) return;
    if (!this.on) { this.on = true; this.idx = 0; } else if (this.idx + 1 >= this.C.stations.length) { this.on = false; } else this.idx++;
    this.keep(); this.switched();
  }
  set(i) { this.on = i != null; if (i != null) this.idx = i; this.keep(); this.switched(); }
  switched() { this.seg = null; if (this.playing || this.on) this.synth.crackle(); this.synth.stop(0.15); this.tick(); this.paint(); }
  tick() {
    const want = this.on && this.allowed(), now = performance.now(), C = this.D ? this.C : null;
    const sig = `${want}|${this.scene?.mode}|${!!this.D}`; if (sig !== this.sig) { this.sig = sig; this.paint(); }
    if (!want) { if (this.playing) { this.synth.stop(0.6); this.seg = null; this.paint(); } return; }
    const st = this.station, save = this.scene.box?.save;
    const jam = jammed(this.D, save, st);
    if (jam) { if (this.seg?.kind !== 'jam') { this.seg = { kind: 'jam', text: jam, until: Infinity }; this.synth.play({ bpm: 60, steps: 16, events: [], title: '' }, 'synth', C.volume); this.paint(); } return; }
    if (!this.seg || this.seg.kind === 'jam' || now >= this.seg.until) {
      const talkNow = this.seg?.kind === 'song' && (this.songs % C.talkEvery === 0);
      if (talkNow) {
        const T = talk(this.D, save, st, rng(this.seed++));
        this.seg = { kind: 'talk', text: T.text, about: T.kind, until: now + C.talk * 1000 };
        if (!this.playing) this.startSong(st, C);
        this.synth.duck(true);
      } else {
        this.startSong(st, C);
        const [a, b] = C.song, len = a + Math.random() * Math.max(0, b - a);
        this.seg = { kind: 'song', title: this.song.title, until: now + len * 1000 }; this.songs++;
        this.synth.duck(false);
      }
      this.paint();
    }
  }
  startSong(st, C) { this.song = song(this.D, st, this.seed++); this.synth.play(this.song, st.style, C.volume); }
  paint() {
    const st = this.station, on = this.on && this.allowed();
    this.el.hidden = !this.D || !this.C.enabled || !this.C.stations.length || !this.scene?.box || this.scene.mode === 'run';
    this.el.classList.toggle('on', on); this.el.classList.toggle('talk', on && (this.seg?.kind === 'talk' || this.seg?.kind === 'jam'));
    const what = !this.on ? 'Radio aus' : !on ? `${st?.name || ''} · leise` : this.seg?.kind === 'talk' ? `${st.dj || st.name}: ${this.seg.text}` : this.seg?.kind === 'jam' ? this.seg.text : `♪ ${this.seg?.title || ''}`;
    this.el.replaceChildren(icon(this.on ? 'music' : 'loudspeaker', 14), el('b', {}, this.on && st ? `${st.name} ${st.freq || ''}` : 'Radio'), el('span', {}, what), el('kbd', {}, 'N'));
  }
  // pause menu: the stations and off
  menu(hud) {
    const S = this.C.stations;
    hud.menu({ title: 'Rig-Radio', sub: 'Läuft im Camp und auf der Fahrt · N schaltet weiter', items: [
      ...S.map((s, i) => ({ label: `${s.name} ${s.freq || ''}`, sub: [s.dj ? `mit ${s.dj}` : '', s.djLine || ''].filter(Boolean).join(' · '), primary: this.on && i === this.idx, icon: 'music', act: () => this.set(i) })),
      { label: 'Aus', icon: 'x', act: () => this.set(null) }] });
  }
  state() { return { on: this.on, station: this.station?.id || null, playing: this.playing, allowed: this.allowed(), seg: this.seg ? { kind: this.seg.kind, text: this.seg.text || this.seg.title || '' } : null, chip: this.el.hidden ? null : this.el.textContent }; }
}

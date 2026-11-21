// Rig-Radio (#090): plays a song from game/radio.js on Web Audio. Every sound from code: oscillators and noise, through a radio-ish
// band (high-pass + low-pass) with a little hiss. A look-ahead scheduler (setInterval 50 ms, 0.3 s ahead) keeps time without the game loop.
//   const R = new RadioSynth(() => audioContext); R.play(song, style, volume); R.duck(true) while the DJ talks; R.crackle(); R.stop()
const VOICES = {   // per style: oscillator types and how bright
  synth: { pad: 'sawtooth', bass: 'square', lead: 'square', cut: 2600, padVol: 0.05, leadDecay: 0.18 },
  dust: { pad: 'triangle', bass: 'triangle', lead: 'triangle', cut: 2200, padVol: 0.06, leadDecay: 0.5 },
  glitch: { pad: 'square', bass: 'sawtooth', lead: 'square', cut: 3600, padVol: 0.035, leadDecay: 0.08 },
  ambient: { pad: 'sine', bass: 'sine', lead: 'sine', cut: 1800, padVol: 0.08, leadDecay: 2.2 },
};
const hz = n => 440 * Math.pow(2, (n - 69) / 12);

export class RadioSynth {
  constructor(getCtx) { this.getCtx = getCtx; this.timer = null; this.song = null; this.out = null; }
  get playing() { return !!this.song; }
  // the chain: voices → bus → high-pass → low-pass → master (volume) → destination; hiss into the master
  chain(c, volume) {
    const master = c.createGain(), hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), bus = c.createGain(), duck = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = 160; lp.type = 'lowpass'; lp.frequency.value = 5200;
    master.gain.value = 0.0001; master.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), c.currentTime + 0.6);
    bus.connect(duck).connect(hp).connect(lp).connect(master).connect(c.destination);
    const hiss = this.noise(c, 2); hiss.loop = true; const hg = c.createGain(); hg.gain.value = 0.012; const hf = c.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 3000;
    hiss.connect(hf).connect(hg).connect(master); hiss.start();
    return { master, bus, duck, hiss };
  }
  noise(c, len) {
    const b = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; return s;
  }
  play(song, style = 'synth', volume = 0.35) {
    const c = this.getCtx(); if (!c) return false;
    this.stop(0.25);
    this.song = song; this.style = VOICES[style] ? style : 'synth'; this.vol = volume;
    this.out = this.chain(c, volume);
    this.step = 0; this.next = c.currentTime + 0.12; this.dur = 60 / (song.bpm || 90) / 4;
    this.byStep = new Map(); for (const e of song.events) { if (!this.byStep.has(e.step)) this.byStep.set(e.step, []); this.byStep.get(e.step).push(e); }
    this.timer = setInterval(() => this.tick(), 50);
    this.tick();
    return true;
  }
  tick() {
    const c = this.getCtx(); if (!c || !this.song || !this.out) return;
    if (this.next < c.currentTime - 1) this.next = c.currentTime + 0.05;   // the tab slept: no burst of old notes
    while (this.next < c.currentTime + 0.3) {
      for (const e of this.byStep.get(this.step % this.song.steps) || []) this.voice(c, e, this.next);
      this.step++; this.next += this.dur;
    }
  }
  voice(c, e, t) {
    if (this.voices && !this.voices.has(e.voice)) return;   // #169 music layers: only the voices of the layer play
    const V = VOICES[this.style], bus = this.out.bus, len = e.len * this.dur;
    const env = (g, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const osc = (type, f, peak, a, d, cut) => {
      const o = c.createOscillator(), g = c.createGain(), f2 = c.createBiquadFilter();
      o.type = type; o.frequency.value = f; f2.type = 'lowpass'; f2.frequency.value = cut || V.cut;
      env(g, a, peak, d); o.connect(f2).connect(g).connect(bus); o.start(t); o.stop(t + a + d + 0.05);
      return o;
    };
    const noiseHit = (type, f, peak, d) => { const n = this.noise(c, d + 0.05), fl = c.createBiquadFilter(), g = c.createGain(); fl.type = type; fl.frequency.value = f; env(g, 0.002, peak, d); n.connect(fl).connect(g).connect(bus); n.start(t); };
    const v = e.vel ?? 1;
    switch (e.voice) {
      case 'pad': { const a = this.style === 'ambient' ? len * 0.4 : 0.08; osc(V.pad, hz(e.note), V.padVol * v, a, Math.max(0.1, len - a)); if (this.style === 'synth') osc(V.pad, hz(e.note) * 1.006, V.padVol * v * 0.7, a, Math.max(0.1, len - a)); break; }
      case 'bass': osc(V.bass, hz(e.note), 0.16 * v, 0.005, Math.max(0.08, len * 0.9), 700); break;
      case 'lead': osc(V.lead, hz(e.note), 0.07 * v, 0.004, Math.min(V.leadDecay, len + V.leadDecay)); break;
      case 'kick': { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); env(g, 0.003, 0.45 * v, 0.18); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.25); break; }
      case 'snare': noiseHit('bandpass', 1800, 0.22 * v, 0.14); break;
      case 'hat': noiseHit('highpass', 7000, 0.08 * v, 0.04); break;
      case 'noise': noiseHit('bandpass', 900 + Math.random() * 2000, 0.12 * v, len); break;
    }
  }
  // #169 music layers (POI director): which voices play from now on (null = all)
  setVoices(list) { this.voices = list ? new Set(list) : null; }
  // the DJ talks: music down, back up after
  duck(on) { const c = this.getCtx(); if (!c || !this.out) return; const g = this.out.duck.gain; g.cancelScheduledValues(c.currentTime); g.setTargetAtTime(on ? 0.22 : 1, c.currentTime, 0.25); }
  setVolume(v) { const c = this.getCtx(); this.vol = v; if (!c || !this.out) return; this.out.master.gain.setTargetAtTime(Math.max(0.0002, v), c.currentTime, 0.2); }
  // switching stations: a short burst of static
  crackle(sec = 0.45, volume = this.vol ?? 0.35) {
    const c = this.getCtx(); if (!c) return;
    const n = this.noise(c, sec), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
    f.type = 'bandpass'; f.frequency.setValueAtTime(1200, t); f.frequency.linearRampToValueAtTime(3800, t + sec); f.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.35 * volume), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
    n.connect(f).connect(g).connect(c.destination); n.start(t);
  }
  stop(fade = 0.4) {
    clearInterval(this.timer); this.timer = null; this.song = null;
    const o = this.out, c = this.getCtx(); this.out = null;
    if (!o || !c) return;
    o.master.gain.cancelScheduledValues(c.currentTime); o.master.gain.setTargetAtTime(0.0001, c.currentTime, Math.max(0.01, fade / 3));
    setTimeout(() => { try { o.hiss.stop(); o.master.disconnect(); } catch { /* already gone */ } }, fade * 1000 + 200);
  }
}

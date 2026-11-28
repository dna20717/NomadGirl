// CampBuilder v2 (#196): the sound, all from code (Web Audio). A slow pad plays the chords of CampBuilder › Klang › Akkorde, a
// little wind lies under it; every building step plays a note of the same major pentatonic (in it any sequence sounds right), drawn
// The building itself sounds like craft (foley from code: weight, material, crumbs; CampBuilder › Material je Kachel-Set); a note
// of the music's pentatonic can lie under it (CampBuilder › Klang › Musikalisch, 0 = none), drawn onto the beat.
//   const t = new Tones(cfg); t.unlock() on a user gesture · t.play('add', { degree, material }) · t.music(on) · t.state()
// Silent and harmless without an AudioContext (tests, before the first gesture): nothing throws, play() returns null.

const PENTA = [0, 2, 4, 7, 9];
const STEPS = { I: [0, 'maj'], ii: [2, 'min'], iii: [4, 'min'], IV: [5, 'maj'], V: [7, 'maj'], vi: [9, 'min'], II: [2, 'maj'], III: [4, 'maj'], VI: [9, 'maj'], iv: [5, 'min'], v: [7, 'min'], bVII: [10, 'maj'] };
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
export function chordsOf(text) {
  const out = String(text || 'I vi IV V').split(/\s+/).map(s => STEPS[s]).filter(Boolean);
  return out.length ? out : [STEPS.I];
}
// the notes of a chord (MIDI, around the root): root, third, fifth, seventh, ninth
export function chordNotes(root, [deg, q]) {
  const r = root + deg;
  return q === 'maj' ? [r, r + 4, r + 7, r + 11, r + 14] : [r, r + 3, r + 7, r + 10, r + 14];
}
// the pentatonic notes over two octaves from the root, those of the chord first in line
export function ladder(root, chord) {
  const notes = [];
  for (let o = -1; o <= 2; o++) for (const p of PENTA) notes.push(root + 12 * o + p);
  const inChord = new Set(chordNotes(root, chord).map(n => ((n - root) % 12 + 12) % 12));
  return { all: notes, warm: notes.filter(n => inChord.has(((n - root) % 12 + 12) % 12)) };
}

export class Tones {
  constructor(cfg = {}) {
    this.cfg = cfg; this.ctx = null; this.musicOn = cfg.music?.enabled !== false; this.tonesOn = true; this.log = [];
    this.chords = chordsOf(cfg.music?.chords); this.root = cfg.music?.root ?? 62;
  }
  get bpm() { return this.cfg.music?.bpm || 72; }
  get beat() { return 60 / this.bpm; }
  // the AudioContext, made lazily; a user gesture must resume it once (browsers)
  ensure() {
    if (this.ctx) return this.ctx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    const c = this.ctx = new AC();
    this.out = c.createGain(); this.out.gain.value = 0.9;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.out.connect(comp); comp.connect(c.destination);
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(3.2);
    this.wet = c.createGain(); this.wet.gain.value = 0.5; this.verb.connect(this.wet); this.wet.connect(this.out);
    this.musicBus = c.createGain(); this.musicBus.gain.value = (this.cfg.music?.volume ?? 34) / 100 * (this.musicOn ? 1 : 0); this.musicBus.connect(this.out);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = (this.cfg.tones?.volume ?? 70) / 100; this.sfxBus.connect(this.out);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.t0 = c.currentTime + 0.1; this.nextChord = 0; this.nextBar = 0;
    return c;
  }
  impulse(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  }
  // on a key, a tap or a click: browsers only let sound start then (a controller button does not count everywhere)
  unlock() {
    const c = this.ensure();
    if (!c) return false;
    if (c.state !== 'running') c.resume?.().catch?.(() => {});
    this.startLoop();
    return c.state === 'running';
  }
  get running() { return this.ctx?.state === 'running'; }
  state() { return { running: this.running, music: this.musicOn, tones: this.tonesOn, chord: this.chordIndex(), played: this.log.length }; }
  music(on) { this.musicOn = on; if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? (this.cfg.music?.volume ?? 34) / 100 : 0, this.ctx.currentTime, 0.6); }
  sounds(on) { this.tonesOn = on; }

  // ---------- the music: chords every two bars, a sub bass, now and then a soft bell from the chord, wind ----------
  chordIndex(t = this.ctx?.currentTime ?? 0) { return Math.max(0, Math.floor((t - (this.t0 || 0)) / (this.beat * 8))) % this.chords.length; }
  startLoop() {
    if (this.loop || !this.ctx) return;
    this.wind();
    this.loop = setInterval(() => this.schedule(), 120);
    this.schedule();
  }
  schedule() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const ahead = c.currentTime + 0.6, len = this.beat * 8;
    while (this.t0 + this.nextChord * len < ahead) {
      const at = this.t0 + this.nextChord * len, ch = this.chords[this.nextChord % this.chords.length];
      this.pad(ch, at, len);
      this.nextChord++;
    }
    while (this.t0 + this.nextBar * this.beat * 4 < ahead) {
      const at = this.t0 + this.nextBar * this.beat * 4, ch = this.chords[Math.floor(this.nextBar / 2) % this.chords.length];
      if (Math.random() < 0.38) { const L = ladder(this.root + 12, ch).warm; this.pluck(hz(L[Math.floor(Math.random() * L.length)]), at + this.beat * Math.floor(Math.random() * 4), { vel: 0.12, bus: this.musicBus, dur: 2.4, send: 0.9 }); }
      this.nextBar++;
    }
  }
  pad(chord, at, len) {
    const c = this.ctx, notes = chordNotes(this.root - 12, chord).slice(0, 4);
    for (const [i, n] of notes.entries()) {
      const g = c.createGain(), f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(520, at); f.frequency.linearRampToValueAtTime(1100 + i * 120, at + len * 0.5); f.frequency.linearRampToValueAtTime(600, at + len + 2);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.05, at + 2.2); g.gain.setValueAtTime(0.05, at + len - 0.2); g.gain.linearRampToValueAtTime(0, at + len + 2.4);
      for (const det of [-7, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det; o.connect(f); o.start(at); o.stop(at + len + 2.6); }
      f.connect(g); g.connect(this.musicBus); const s = c.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(this.verb);
    }
    const sub = c.createOscillator(), sg = c.createGain();
    sub.type = 'sine'; sub.frequency.value = hz(this.root - 24 + chord[0]);
    sg.gain.setValueAtTime(0, at); sg.gain.linearRampToValueAtTime(0.07, at + 1.5); sg.gain.linearRampToValueAtTime(0, at + len + 1.5);
    sub.connect(sg); sg.connect(this.musicBus); sub.start(at); sub.stop(at + len + 1.6);
  }
  wind() {
    const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    src.buffer = this.noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 460; f.Q.value = 0.6;
    g.gain.value = 0.028; lfo.frequency.value = 0.07; lg.gain.value = 0.018; lfo.connect(lg); lg.connect(g.gain);
    const lf2 = c.createOscillator(), l2g = c.createGain(); lf2.frequency.value = 0.031; l2g.gain.value = 180; lf2.connect(l2g); l2g.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(this.musicBus); src.start(); lfo.start(); lf2.start();
  }

  // ---------- notes ----------
  pluck(freq, when, { vel = 0.5, dur = 0.9, bright = 1, bus = this.sfxBus, send = 0.45 } = {}) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(Math.min(9000, freq * 6 * bright), when); f.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.5), when + dur * 0.6);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vel, when + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const a = c.createOscillator(), b = c.createOscillator(), bg = c.createGain();
    a.type = 'sine'; a.frequency.value = freq; b.type = 'triangle'; b.frequency.value = freq * 2; bg.gain.value = 0.28;
    a.connect(f); b.connect(bg); bg.connect(f); f.connect(g); g.connect(bus);
    const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(this.verb);
    a.start(when); b.start(when); a.stop(when + dur + 0.05); b.stop(when + dur + 0.05);
  }
  // on the beat: the next 1/16 (CampBuilder › Klang › Auf den Takt), unless that is further than „Höchstens warten“ (only for the
  // optional note under the craft, Klang › Musikalisch; the craft itself sounds at once)
  when() {
    const c = this.ctx, now = c.currentTime + 0.005, g = this.beat * 4 / (this.cfg.tones?.grid || 16), wait = (this.cfg.tones?.wait ?? 70) / 1000;
    const next = this.t0 + Math.ceil((now - this.t0) / g) * g;
    return next - now <= wait ? next : now;
  }
  // a note of the ladder: degree 0 = the middle, up = higher; warm = a chord note
  note(degree, warm = true) {
    const ch = this.chords[this.chordIndex()], L = ladder(this.root + 12, ch), list = warm ? L.warm : L.all, mid = Math.floor(list.length / 3);
    return list[Math.max(0, Math.min(list.length - 1, mid + Math.round(degree)))];
  }

  // ---------- the craft (Daniel, 28.11.2026: „mehr handwerklich satt klingen und wenig wie ein Instrument“) ----------
  // Every sound is built from layers like a foley take: the weight (a low thump that drops in pitch), the material's own voice
  // (sand pours, stone clacks, metal clanks, wood knocks), then a tail of crumbs that settle. Each take varies a little (pitch, time,
  // how many crumbs), so a stroke over many tiles never sounds like a machine. Panned to where AvA works.
  bus(pan = 0) {
    const c = this.ctx;
    if (!c.createStereoPanner) return this.sfxBus;
    const p = c.createStereoPanner(); p.pan.value = Math.max(-0.8, Math.min(0.8, pan)); p.connect(this.sfxBus);
    setTimeout(() => { try { p.disconnect(); } catch { /* gone */ } }, 3000);
    return p;
  }
  burst(at, out, { type = 'bandpass', freq = 1000, q = 1, vel = 0.2, dur = 0.05, to = null, attack = 0.002 }) {
    const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; src.playbackRate.value = 0.75 + Math.random() * 0.5;
    f.type = type; f.frequency.setValueAtTime(freq, at); if (to) f.frequency.exponentialRampToValueAtTime(to, at + dur); f.Q.value = q;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vel, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f); f.connect(g); g.connect(out); src.start(at, Math.random() * 1.5); src.stop(at + dur + 0.05);
  }
  weight(at, out, freq = 70, vel = 0.4, dur = 0.16) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq * 2.2, at); o.frequency.exponentialRampToValueAtTime(freq, at + 0.04);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vel, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(out); o.start(at); o.stop(at + dur + 0.05);
  }
  knock(at, out, freq, vel = 0.2, dur = 0.07) {   // a short tuned body: wood, brick, a hollow pillar
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(freq * 1.15, at); o.frequency.exponentialRampToValueAtTime(freq, at + 0.02);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vel, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(out); o.start(at); o.stop(at + dur + 0.05);
  }
  clank(at, out, base, vel = 0.1, dur = 0.35) {   // sheet metal: a few inharmonic partials, a little different every time
    for (const r of [1, 2.13 + Math.random() * 0.2, 3.7 + Math.random() * 0.4, 5.9]) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = base * r;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vel / r, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + dur / Math.sqrt(r));
      o.connect(g); g.connect(out); o.start(at); o.stop(at + dur + 0.05);
    }
  }
  crumbs(at, out, n = 5, spread = 0.22, freq = 3000, vel = 0.05) {   // little pieces that settle after the hit
    for (let i = 0; i < n; i++) { const t = at + 0.03 + Math.pow(Math.random(), 1.6) * spread; this.burst(t, out, { freq: freq * (0.6 + Math.random() * 0.8), q: 3, vel: vel * (1 - (t - at) / (spread + 0.1)), dur: 0.012 + Math.random() * 0.02 }); }
  }
  // one take of a material: kind 'set' (a tile goes in), 'take' (a tile comes out), 'heave' (the ground rises a step), 'sink'
  craft(m, kind, at, out, k = 1) {
    const v = Math.min(1.3, k), j = 0.92 + Math.random() * 0.16, take = kind === 'take' || kind === 'sink', heavy = kind === 'heave' || kind === 'sink';
    const W = { sand: 60, earth: 58, stone: 85, concrete: 52, metal: 75, wood: 95, glass: 110 }[m] || 70;
    if (!take) this.weight(at, out, W * j, (heavy ? 0.5 : 0.34) * v, heavy ? 0.24 : 0.15);
    if (m === 'sand') { this.burst(at, out, { type: 'lowpass', freq: 2200 * j, to: 500, vel: 0.16 * v, dur: take ? 0.32 : 0.22, attack: 0.012 }); this.crumbs(at, out, take ? 9 : 4, 0.3, 4200, 0.035 * v); }
    else if (m === 'earth') { this.burst(at, out, { type: 'lowpass', freq: 900 * j, to: 250, vel: 0.22 * v, dur: 0.14 }); this.crumbs(at, out, take ? 10 : 6, 0.28, 2600, 0.05 * v); }
    else if (m === 'stone') { this.burst(at, out, { freq: 2300 * j, q: 2.2, vel: 0.26 * v, dur: 0.03 }); this.knock(at, out, 240 * j, 0.14 * v, 0.06); this.crumbs(at, out, take ? 8 : 3, 0.22, 3400, 0.045 * v); }
    else if (m === 'concrete') { this.burst(at, out, { freq: 1100 * j, q: 1.2, vel: 0.24 * v, dur: 0.07, to: 600 }); this.knock(at, out, 150 * j, 0.12 * v, 0.08); this.crumbs(at, out, take ? 10 : 5, 0.3, 2800, 0.05 * v); }
    else if (m === 'metal') { this.clank(at, out, (take ? 210 : 260) * j, 0.11 * v, heavy ? 0.5 : 0.32); this.burst(at, out, { freq: 3500, q: 1, vel: 0.06 * v, dur: 0.04 }); if (take) this.burst(at + 0.05, out, { freq: 1800, q: 6, vel: 0.05, dur: 0.18, to: 900 }); }
    else if (m === 'wood') { this.knock(at, out, 190 * j, 0.24 * v, 0.09); this.burst(at, out, { freq: 1300 * j, q: 3, vel: 0.16 * v, dur: 0.05 }); if (take) this.burst(at + 0.04, out, { freq: 700, q: 8, vel: 0.06, dur: 0.22, to: 1100 }); }
    else if (m === 'glass') { this.clank(at, out, 1200 * j, 0.04 * v, 0.4); this.crumbs(at, out, take ? 9 : 2, 0.25, 6000, 0.04 * v); }
    if (heavy) this.burst(at + 0.02, out, { type: 'lowpass', freq: 500, to: 160, vel: 0.12 * v, dur: 0.35, attack: 0.03 });   // the ground grinds as it moves
  }
  // kind: add · remove · hill · dig · grow · undo · redo · select · move · menu · open; pan −1 … 1
  play(kind, { degree = 0, material = 'sand', vel = 1, pan = 0 } = {}) {
    this.log.push(kind);
    if (this.log.length > 200) this.log.shift();
    const c = this.ctx;
    if (!c || c.state !== 'running' || !this.tonesOn) return null;
    const at = now(c), out = this.bus(pan), mus = (this.cfg.tones?.musical ?? 0) / 100;
    if (kind === 'add' || kind === 'hill') { this.craft(material, kind === 'hill' ? 'heave' : 'set', at, out, vel); if (mus) this.pluck(hz(this.note(degree)), this.when(), { vel: 0.3 * mus * vel }); }
    else if (kind === 'remove' || kind === 'dig') { this.craft(material, kind === 'dig' ? 'sink' : 'take', at, out, vel); if (mus) this.pluck(hz(this.note(degree, false) - 12), this.when(), { vel: 0.2 * mus * vel, dur: 0.7, bright: 0.6 }); }
    else if (kind === 'grow') { for (let i = 0; i < 2; i++) { this.knock(at + i * 0.16, out, 170, 0.26, 0.1); this.burst(at + i * 0.16, out, { freq: 1500, q: 2, vel: 0.12, dur: 0.04 }); } this.weight(at + 0.32, out, 55, 0.25, 0.2); }
    else if (kind === 'undo' || kind === 'redo') { const up = kind === 'redo'; this.burst(at, out, { freq: up ? 500 : 1600, q: 1.4, vel: 0.07, dur: 0.16, to: up ? 1600 : 450 }); this.craft(material, up ? 'set' : 'take', at + 0.06, out, 0.45); }
    else if (kind === 'select') { this.knock(at, out, 900, 0.08, 0.03); this.burst(at, out, { freq: 3800, q: 5, vel: 0.05, dur: 0.02 }); this.knock(at + 0.05, out, 1300, 0.05, 0.03); }
    else if (kind === 'move') this.burst(at, out, { freq: 3200, q: 5, vel: 0.03, dur: 0.015 });
    else if (kind === 'menu' || kind === 'open') { this.burst(at, out, { type: 'lowpass', freq: kind === 'open' ? 900 : 400, to: kind === 'open' ? 2200 : 200, vel: 0.06, dur: 0.18, attack: 0.03 }); this.knock(at + 0.03, out, kind === 'open' ? 700 : 480, 0.05, 0.04); }
    return at;
  }
}
const now = c => c.currentTime + 0.002;

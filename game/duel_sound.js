// Sound of the Bit-Stapel / Glitch-Duell (#151, Daniel 21.11.2026: „Das Entitäten-Duell braucht ein wenig Sound“), the same everywhere like
// the haptics (/duel, /mobile and the duel window in the game): small glitchy chip sounds from code (Web Audio), no files.
// haptics.js › buzz() calls play(kind) for every moment of the board: pick, send, wipe, hit, heavy, overflow, win, lose.
// One switch: localStorage „nomad.duelSound“ ('0' = off); the game mutes it with setDuelMuted() while its sound is off (M).
const KEY = 'nomad.duelSound';
let ctx = null, muted = false, volume = 0.45;
const log = [];   // what was played (tests)
export const duelSoundLog = () => log;

export function duelSoundOn() { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } }
export function setDuelSound(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ } if (on) play('pick'); }
export function setDuelMuted(m) { muted = !!m; }
export function setDuelVolume(v) { volume = Math.max(0, Math.min(1, v)); }

function ac() {
  if (typeof window === 'undefined') return null;
  const A = window.AudioContext || window.webkitAudioContext;
  if (!A) return null;
  ctx ??= new A();
  if (ctx.state === 'suspended') ctx.resume?.().catch?.(() => {});
  return ctx;
}
// one tone: type, frequency from → to over dur, attack/decay envelope, optional bit-crush wobble
function tone(c, out, { type = 'square', f0 = 440, f1 = f0, at = 0, dur = 0.08, gain = 0.3, wobble = 0 }) {
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  if (wobble) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = wobble; lg.gain.value = f0 * 0.08; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur); }
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
// a burst of noise (shatter, static), band-passed
function noise(c, out, { at = 0, dur = 0.12, gain = 0.25, freq = 2400, q = 1.2 }) {
  const t = c.currentTime + at, n = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) * (i % 7 < 3 ? 1 : 0.4);   // crunchy, a little bit-crushed
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
  s.connect(f).connect(g).connect(out); s.start(t);
}
// the recipes: what each moment sounds like
const RECIPES = {
  pick: (c, o) => tone(c, o, { type: 'square', f0: 1320, f1: 1180, dur: 0.035, gain: 0.12 }),
  send: (c, o) => { tone(c, o, { type: 'square', f0: 420, f1: 980, dur: 0.09, gain: 0.22 }); tone(c, o, { type: 'triangle', f0: 1960, dur: 0.05, at: 0.07, gain: 0.12 }); },
  wipe: (c, o) => { noise(c, o, { dur: 0.22, gain: 0.32, freq: 3200 }); tone(c, o, { type: 'sawtooth', f0: 900, f1: 120, dur: 0.24, gain: 0.18, wobble: 38 }); },
  hit: (c, o) => { tone(c, o, { type: 'square', f0: 260, f1: 140, dur: 0.12, gain: 0.24 }); noise(c, o, { dur: 0.06, gain: 0.12, freq: 900 }); },
  heavy: (c, o) => { tone(c, o, { type: 'sawtooth', f0: 180, f1: 55, dur: 0.32, gain: 0.3, wobble: 22 }); noise(c, o, { dur: 0.25, gain: 0.22, freq: 600, q: 0.7 }); },
  overflow: (c, o) => { for (let i = 0; i < 3; i++) tone(c, o, { type: 'square', f0: 1560, f1: 1480, dur: 0.05, at: i * 0.08, gain: 0.14 }); },
  win: (c, o) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, o, { type: 'square', f0: f, dur: 0.12, at: i * 0.085, gain: 0.18 })); tone(c, o, { type: 'triangle', f0: 2093, dur: 0.4, at: 0.42, gain: 0.12 }); },
  lose: (c, o) => { [440, 370, 311, 233].forEach((f, i) => tone(c, o, { type: 'sawtooth', f0: f, f1: f * 0.94, dur: 0.2, at: i * 0.16, gain: 0.16, wobble: 9 })); noise(c, o, { at: 0.55, dur: 0.45, gain: 0.14, freq: 1400 }); },
  start: (c, o) => { noise(c, o, { dur: 0.18, gain: 0.16, freq: 2600 }); [196, 392, 784].forEach((f, i) => tone(c, o, { type: 'square', f0: f, dur: 0.08, at: 0.12 + i * 0.06, gain: 0.15 })); },
};
export function play(kind) {
  log.push(kind);
  if (muted || !duelSoundOn() || !RECIPES[kind]) return;
  try {
    const c = ac(); if (!c) return;
    const out = c.createGain(); out.gain.value = volume; out.connect(c.destination);
    RECIPES[kind](c, out);
  } catch { /* no audio */ }
}

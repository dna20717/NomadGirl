// Little sounds from code (Web Audio), for building the rig: klonk when something heavy sits down, klack of a coupling,
// ratchet while Leyla screws, coins at the dealer. Quiet, a bit random, silent when the game is muted.
export function makeSfx(scene, volume = 0.5) {
  const ctx = () => { const c = scene.sound?.context; return c && !scene.sound.mute && c.state !== 'closed' ? c : null; };
  const noise = (c, len) => {
    const b = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; return s;
  };
  const env = (c, g, t, a, peak, len) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + len); };
  const out = c => { const g = c.createGain(); g.gain.value = volume; g.connect(c.destination); return g; };
  const tone = (c, dest, type, f0, f1, t, len, peak) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
    env(c, g, t, 0.004, peak, len); o.connect(g).connect(dest); o.start(t); o.stop(t + len + 0.02);
  };
  const thud = (c, dest, t, len, cut, peak) => {
    const n = noise(c, len), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = cut; env(c, g, t, 0.003, peak, len);
    n.connect(f).connect(g).connect(dest); n.start(t);
  };
  return {
    // a kept beat in the melee combo: a short soft blip, a little higher with every hit
    tick(n = 1) {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c), f = 880 * Math.pow(1.122, Math.min(5, n - 1));
      tone(c, o, 'sine', f, f * 0.99, t, 0.07, 0.18); tone(c, o, 'triangle', f * 2, f * 1.98, t, 0.04, 0.05);
    },
    // heavy metal thing sits down
    klonk(weight = 1) {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c), k = 0.9 + Math.random() * 0.2;
      tone(c, o, 'square', 150 * k / Math.sqrt(weight), 60, t, 0.22, 0.25);
      tone(c, o, 'triangle', 620 * k, 410, t, 0.16, 0.12);
      thud(c, o, t, 0.12, 900, 0.6);
    },
    // a coupling snaps shut
    klack() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c);
      tone(c, o, 'square', 1400, 900, t, 0.03, 0.15); tone(c, o, 'square', 1100, 700, t + 0.06, 0.04, 0.18);
      thud(c, o, t + 0.06, 0.06, 2400, 0.3);
    },
    // the ratchet while Leyla screws
    ratchet() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c);
      for (let i = 0; i < 3; i++) tone(c, o, 'square', 2200 + Math.random() * 400, 1800, t + i * 0.045, 0.018, 0.05);
    },
    // Δ for something sold
    coins() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c);
      tone(c, o, 'sine', 988, 980, t, 0.09, 0.2); tone(c, o, 'sine', 1319, 1310, t + 0.08, 0.22, 0.2);
    },
    // picked up
    lift() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c);
      tone(c, o, 'triangle', 240, 420, t, 0.12, 0.08);
    },
    // does not fit
    // AvA hops onto a target in the build mode (#010): a short soft click, a little random
    snap() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c), f = 1300 + Math.random() * 160;
      tone(c, o, 'triangle', f, f * 0.7, t, 0.035, 0.09); thud(c, o, t, 0.02, 3000, 0.08);
    },
    nope() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c);
      tone(c, o, 'square', 220, 180, t, 0.09, 0.08); tone(c, o, 'square', 180, 140, t + 0.1, 0.12, 0.08);
    },
    // toasts (#014, Daniel 13.11.2026: „Toast und Sound“): every kind of message has its own little sound
    // achievement: a short fanfare, four rising notes and a shimmer on top
    fanfare() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c);
      [523, 659, 784, 1047].forEach((f, i) => { tone(c, o, 'triangle', f, f, t + i * 0.09, i === 3 ? 0.55 : 0.12, 0.2); tone(c, o, 'square', f / 2, f / 2, t + i * 0.09, 0.1, 0.03); });
      tone(c, o, 'sine', 2093, 2080, t + 0.3, 0.5, 0.05);
    },
    // a recipe learnt: two bright bell notes
    chime() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c);
      tone(c, o, 'sine', 1175, 1170, t, 0.25, 0.16); tone(c, o, 'sine', 1568, 1560, t + 0.1, 0.35, 0.14); tone(c, o, 'sine', 3136, 3130, t + 0.1, 0.2, 0.02);
    },
    // a plain note: one soft blip
    ping() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c);
      tone(c, o, 'sine', 880, 870, t, 0.14, 0.12); tone(c, o, 'triangle', 1760, 1750, t, 0.06, 0.03);
    },
    // something good: blip up
    good() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c);
      tone(c, o, 'sine', 660, 660, t, 0.08, 0.12); tone(c, o, 'sine', 990, 990, t + 0.07, 0.16, 0.12);
    },
    // a secret: a run of glittering notes
    sparkle() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c);
      [1319, 1568, 1976, 2637, 3136].forEach((f, i) => tone(c, o, 'sine', f, f, t + i * 0.05, 0.18, 0.07));
    },
    // dark moments (k.o., AvA gone): a low falling hum
    low() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, o = out(c);
      tone(c, o, 'sawtooth', 110, 70, t, 0.9, 0.06); tone(c, o, 'sine', 220, 140, t, 0.8, 0.08); thud(c, o, t, 0.4, 300, 0.2);
    },
  };
}

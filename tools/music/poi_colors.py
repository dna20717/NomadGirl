"""POI-Ton: Hörproben der 5 Färbungen je Region + Momente (Atempause, Wow, Tresor), #180.
Jede Färbung liegt taktgleich über poi_explore (120 BPM, 32 Takte, 64 s, Akkorde aus dem Kanon).
Die Färbung ist im Spiel eine Live-Schicht; diese Datei ist das Rezept zum Anhören und Abnehmen.
  python3 poi_colors.py EXPLORE_WAV OUTDIR   (EXPLORE_WAV = poi_explore.wav aus leyla_poi.py)"""
import os, sys
import numpy as np
from scipy.io import wavfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import music_engine as M
from music_engine import (SR, hz, lp, hp, bp, blep_saw, blep_pulse, ladder, compressor, drift, adsr,
                          supersaw, ping, chorus, reverb_ir, fftconvolve)
M.seed(2211)
rng = M.rng

BPM = 120; Q = 60 / BPM; E = Q / 2; S = Q / 4; BAR = 4 * Q
NB = 32; LOOP = NB * BAR; N = int(SR * LOOP)
CH = {'Dm': [50, 57, 62, 65, 69], 'C': [48, 55, 60, 64, 67], 'Bb': [46, 53, 58, 62, 65],
      'A': [45, 52, 57, 61, 64], 'F': [41, 48, 53, 57, 60], 'Gm': [43, 50, 55, 58, 62]}
PATTERN = [0, 1, 2, 3, 4, 3]
prog_a = ['Dm', 'C', 'Bb', 'A', 'Dm', 'F', 'Gm', 'A']
prog_b = ['Bb', 'F', 'Gm', 'Dm', 'Bb', 'C', 'A', 'A']
SEC = ['A1', 'A2', 'B', 'A3']
mel_b4 = [(0,0,74,3),(0,3,72,3),(0,6,70,2), (1,0,69,5),(1,5,72,3), (2,0,70,3),(2,3,69,3),(2,6,67,2),
          (3,0,69,8), (4,0,74,2),(4,2,77,4),(4,6,76,2), (5,0,76,3),(5,3,72,5), (6,0,73,3),(6,3,76,3),(6,6,73,2),
          (7,0,69,8)]
mel_a4 = [(1,4,72,4),(3,0,73,3),(3,3,69,5),(5,4,72,2),(5,6,69,2),(7,0,73,8)]

def bars():
    for b in range(NB):
        s = SEC[b // 8]; prog = prog_b if s == 'B' else prog_a
        yield b, s, b * BAR, CH[prog[b % 8]]

class Bus:
    def __init__(self, n=N): self.dry = np.zeros((2, n)); self.wet = np.zeros((2, n)); self.n = n
    def add(self, sig, t, pan=0.5, wet=0.0, gain=1.0):
        s = int(round(t * SR))
        if s < 0: sig = sig[..., -s:]; s = 0
        if s >= self.n: return
        e = min(self.n, s + sig.shape[-1]); sig = sig[..., :e - s] * gain
        if sig.ndim == 1: sig = np.stack([sig * np.sqrt(1 - pan), sig * np.sqrt(pan)])
        self.dry[:, s:e] += sig; self.wet[:, s:e] += sig * wet
    def mix(self, ir, wet=1.0, loop=True):
        v = np.stack([fftconvolve(self.wet[c], ir[c]) for c in range(2)])
        out = self.dry.copy()
        if loop:                                   # wrap the reverb tail to the start: seamless loop
            k = v.shape[1]; out += wet * v[:, :self.n]
            if k > self.n: out[:, :k - self.n] += wet * v[:, self.n:]
        else: out += wet * v[:, :self.n]
        return out

def wrap_add(dst, sig, s):
    """add with wrap-around (looping layer)"""
    n = dst.shape[1]; L = sig.shape[1]; a = s % n
    first = min(L, n - a); dst[:, a:a + first] += sig[:, :first]
    if L > first: dst[:, :L - first] += sig[:, first:]

# ---------------- instruments ----------------
try:
    from numba import njit
    @njit(cache=True)
    def _ks_core(f, buf, decay):
        n = len(f); Nmax = len(buf); out = np.zeros(n); w = 0
        for i in range(n):
            L = SR / f[i]; ri = (w - L) % Nmax; i0 = int(ri); fr = ri - i0
            y = buf[i0] * (1 - fr) + buf[(i0 + 1) % Nmax] * fr
            y2 = buf[(i0 - 1) % Nmax]
            buf[w] = decay * (0.5 * y + 0.5 * y2); out[i] = y; w = (w + 1) % Nmax
        return out
    def ks(freq, dur, bright=0.5, decay=0.996, glide=None):
        n = int(SR * dur); tt = np.arange(n) / SR
        f = np.full(n, float(freq))
        if glide:
            st, tg = glide; f = freq * 2 ** ((st * np.clip(1 - tt / tg, 0, 1) ** 1.5) / 12)
        Nmax = int(SR / f.min()) + 2
        buf = lp(rng.uniform(-1, 1, Nmax), 1500 + 6000 * bright).copy()
        return _ks_core(f, buf, decay) * np.clip(np.arange(n) / 30, 0, 1)
except ImportError:
    raise SystemExit('numba fehlt: pip install numba')

def fm(f, n, ratio, idx, idx_dec, amp_dec, att=0.002):
    tt = np.arange(n) / SR
    mod = idx * np.exp(-tt * idx_dec) * np.sin(2 * np.pi * f * ratio * tt)
    return np.sin(2 * np.pi * f * tt + mod) * np.exp(-tt * amp_dec) * np.clip(tt / att, 0, 1)

def noise(n, ch=1): return rng.normal(0, 1, (ch, n)) if ch > 1 else rng.normal(0, 1, n)

def formant(src, formants):
    return sum(g * bp(src, f * 0.85, f * 1.15) for f, g in formants)

# ================= HIGHWAY: slide guitar, wind, squeaky sign, radio static =================
def highway():
    bus = Bus()
    body_ir = reverb_ir(0.25, 18, 4000, 0.0)
    def slide(m, t, dur, g, pan, st=-2, tg=0.12):
        x = ks(hz(m), dur + 1.5, 0.4, 0.9975, glide=(st, tg))
        x = lp(x + 0.25 * fftconvolve(x, body_ir[0])[:len(x)], 3200)
        x = np.tanh(x * 1.3) * adsr(len(x), 0.003, dur, 0.85, 0.6, dur)
        bus.add(x, t, pan, wet=0.5, gain=g)
    for b, s, tb, notes in bars():
        if s in ('A1', 'A3'):                         # sparse picking fragments with slides
            if b % 2 == 0:
                slide(notes[2], tb, 1.2, 0.5, 0.35, st=-2)
                slide(notes[3] + 12, tb + 3 * E, 0.8, 0.35, 0.65, st=-1)
            else:
                slide(notes[4], tb + Q, 1.5, 0.4, 0.6, st=-3, tg=0.25)
        elif s == 'A2':                                # long slid chord tones under the flute
            if b % 2 == 0: slide(notes[1], tb, 3.5, 0.45, 0.4, st=-5, tg=0.4)
            slide(notes[3], tb + 2 * Q + E, 1.2, 0.3, 0.6, st=-1)
        else:                                          # B: answer the theme in the gaps, an octave down
            if b % 8 in (3, 7): slide(notes[0] + 12, tb, 3.0, 0.5, 0.45, st=-7, tg=0.5)
            else: slide(notes[2] - 12 + 12, tb + Q, 1.2, 0.3, 0.55, st=-2)
    # wind: filtered noise with slow gust envelope
    tt = np.arange(N) / SR
    gust = 0.5 + 0.5 * np.sin(2 * np.pi * tt / 11.0) * np.sin(2 * np.pi * tt / 4.3 + 1)
    w = np.stack([bp(noise(N), 250, 1800), bp(noise(N), 250, 1800)]) * (0.3 + 0.7 * gust ** 2) * 0.05
    bus.dry += w
    # squeaky sign: slow metal creak every 6-10 s
    t = 2.0
    while t < LOOP - 2:
        n = int(SR * 0.9); x = np.zeros(n); k = np.arange(n) / SR
        f = 700 + 500 * np.sin(np.pi * k / 0.9)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR + 2 * np.sin(2 * np.pi * f * 1.51 * k)) * np.sin(np.pi * k / 0.9) ** 2
        bus.add(bp(x, 500, 3000) * 0.05, t, rng.uniform(0.2, 0.8), wet=0.4)
        t += rng.uniform(6, 10)
    # radio static bursts
    for _ in range(6):
        n = int(SR * rng.uniform(0.3, 0.9)); x = bp(noise(n), 800, 4500) * np.hanning(n)
        x *= 1 + 0.8 * np.sign(np.sin(2 * np.pi * rng.uniform(8, 20) * np.arange(n) / SR))
        bus.add(x * 0.025, rng.uniform(0, LOOP - 1), rng.uniform(0.2, 0.8))
    return bus.mix(reverb_ir(2.6, 2.2, 4000, 0.03), 0.6)

# ================= STADTRAND: broken mall muzak, gong, city hum, big hall =================
def rhodes(m, n):
    f = hz(m); tt = np.arange(n) / SR
    x = fm(f, n, 1.0, 1.6, 3.0, 1.2) + 0.25 * fm(f, n, 14.0, 1.0, 40, 6)
    return x * (1 + 0.15 * np.sin(2 * np.pi * 4.5 * tt))
def wobble(x, depth=0.006, rate=0.45):
    """tape wow & flutter: time-varying delay"""
    n = len(x); t = np.arange(n) / SR
    d = (0.01 + depth * np.sin(2 * np.pi * rate * t) + 0.0012 * np.sin(2 * np.pi * 6.3 * t)
         + 0.003 * np.interp(t, np.linspace(0, t[-1], 40), rng.normal(0, 1, 40))) * SR
    idx = np.arange(n) - d
    return np.interp(idx, np.arange(n), x, left=0)
def stadtrand():
    dry = np.zeros(N)
    for b, s, tb, notes in bars():                   # lounge comp on 2 and 4 + anticipation
        for k, (pos, g) in enumerate(((Q, 0.8), (2 * Q + E, 0.5), (3 * Q, 0.7))):
            if s == 'A1' and b % 8 < 2: continue
            n = int(SR * 1.2); x = sum(rhodes(m + 12, n) for m in notes[1:4]) * 0.3 * g
            s0 = int((tb + pos) * SR); e = min(N, s0 + n); dry[s0:e] += x[:e - s0]
        if s in ('A1', 'A3'):                         # vibraphone arpeggio, slow
            for k in range(4):
                n = int(SR * 2.0); m = notes[PATTERN[(b + k) % 6]] + 24
                x = fm(hz(m), n, 4.0, 0.6, 8, 1.6) * (1 + 0.3 * np.sin(2 * np.pi * 5.5 * np.arange(n) / SR)) * 0.18
                s0 = int((tb + k * Q + E) * SR); e = min(N, s0 + n); dry[s0:e] += x[:e - s0]
    dry = bp(wobble(dry), 220, 4200)
    dry = np.tanh(dry * 1.5) / 1.5
    bus = Bus(); bus.add(np.stack([dry * 0.9, np.roll(dry, 400) * 0.9]), 0, wet=0.8)
    # PA gong (A-F-D, the stinger notes) at bar 0 and 16
    for tb in (0.5, 16 * BAR + 0.5):
        for i, m in enumerate((81, 77, 74)):
            n = int(SR * 2.5); x = fm(hz(m), n, 3.01, 1.2, 2, 1.4) * 0.22
            x = bp(x, 400, 5000)
            bus.add(x, tb + i * 0.42, 0.5, wet=0.9)
    # distant city hum
    tt = np.arange(N) / SR
    hum = lp(noise(N), 180) * 0.06 * (1 + 0.3 * np.sin(2 * np.pi * tt / 13))
    bus.dry += np.stack([hum, np.roll(hum, 900)])
    return bus.mix(reverb_ir(4.5, 1.2, 3500, 0.06), 0.55)

# ================= SALT FLATS: bowed metal, morse, geiger, ventilation, hard short room =================
def bowed_metal(m, n, g):
    f = hz(m); tt = np.arange(n) / SR
    parts = ((1, 1.0), (2.32, 0.5), (4.25, 0.3), (6.63, 0.15))
    x = sum(a * np.sin(2 * np.pi * f * r * tt * drift(n, 4) + rng.random() * 6) for r, a in parts)
    bow = 1 + 0.15 * lp(noise(n), 30)
    return x * bow * adsr(n, 1.2, 2, 0.8, 1.5, n / SR - 1.5) * g
def saltflats():
    bus = Bus()
    for b, s, tb, notes in bars():
        if b % 2 == 0:
            bus.add(bowed_metal(notes[0] + 12, int(SR * 2 * BAR + SR), 0.06), tb, 0.4, wet=0.5)
        if s in ('A2', 'B') and b % 2 == 1:
            bus.add(bowed_metal(notes[3] + 12, int(SR * BAR + SR), 0.035), tb + Q, 0.65, wet=0.5)
        if b % 4 == 2:                                # morse in the 3-3-2 rhythm of the 4/4 theme
            for k, ln in enumerate((3, 3, 2, 1, 1, 3)):
                pos = sum((3, 3, 2, 1, 1, 3)[:k]) * S
                dur = S * (0.9 if ln >= 2 else 0.4); n = int(SR * dur); tt = np.arange(n) / SR
                x = np.sin(2 * np.pi * 1180 * tt) * np.clip(tt * 300, 0, 1) * np.clip((dur - tt) * 300, 0, 1)
                bus.add(bp(x, 600, 3000) * 0.05, tb + 2 * Q + pos, 0.72, wet=0.3)
    # geiger: poisson clicks with bursts
    t = 0.0
    while t < LOOP:
        rate = 3 + 25 * (rng.random() < 0.06)
        t += rng.exponential(1 / rate)
        n = 90; x = hp(noise(n), 2000) * np.exp(-np.arange(n) / 12)
        bus.add(x * 0.07, t, rng.uniform(0.3, 0.7))
    # ventilation: 50 Hz hum + harmonics + duct noise
    tt = np.arange(N) / SR
    v = sum(np.sin(2 * np.pi * 50 * h * tt) / h for h in (1, 2, 3, 5)) * 0.02 + bp(noise(N), 90, 600) * 0.03
    v *= 1 + 0.1 * np.sin(2 * np.pi * tt / 3.1)
    bus.dry += np.stack([v, np.roll(v, 300)])
    return bus.mix(reverb_ir(0.9, 6.0, 6000, 0.008), 0.5)

# ================= DELTA RING: cold organ, choir, clockwork, typewriter, steam =================
def organ(m, n):
    f = hz(m); tt = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * h * tt * drift(n, 1)) for h, a in ((0.5, 0.6), (1, 1), (2, 0.6), (3, 0.35), (4, 0.25), (8, 0.12)))
    return x * adsr(n, 0.25, 1, 0.95, 0.8, n / SR - 0.8)
def choir(m, n, vowel='a'):
    fs = {'a': ((700, 1.0), (1150, 0.6), (2600, 0.25)), 'o': ((450, 1.0), (800, 0.5), (2830, 0.1)),
          'u': ((320, 1.0), (700, 0.3), (2500, 0.05))}[vowel]
    st = supersaw(hz(m), n, 5, 14)
    return np.stack([formant(st[c], fs) for c in range(2)]) * adsr(n, 0.9, 2, 0.9, 1.4, n / SR - 1.4)
def deltaring():
    bus = Bus()
    for b, s, tb, notes in bars():
        if b % 2 == 0:
            n = int(SR * (2 * BAR + 1))
            x = sum(organ(m, n) for m in (notes[1], notes[2], notes[3])) * 0.05
            bus.add(np.stack([x, np.roll(x, 200)]), tb, wet=0.7)
            if s in ('A2', 'B'): bus.add(choir(notes[2] + 12, n, 'a') * 0.08, tb, wet=0.9)
        for q in range(4):                            # clockwork: tick-tock on the quarters
            n = int(SR * 0.05); tt = np.arange(n) / SR
            x = bp(noise(n), 2500 if q % 2 == 0 else 1700, 7000) * np.exp(-tt * 180)
            x += np.sin(2 * np.pi * (3100 if q % 2 == 0 else 2400) * tt) * np.exp(-tt * 300) * 0.4
            bus.add(x * 0.08, tb + q * Q, 0.6, wet=0.3)
        if s in ('A1', 'A3') and b % 4 in (1, 2):    # typewriter in 16ths, bell at the end of the line
            for k in range(16):
                if rng.random() < 0.6:
                    n = int(SR * 0.04); tt = np.arange(n) / SR
                    x = bp(noise(n), 1200, 6000) * np.exp(-tt * 120) + lp(noise(n), 300) * np.exp(-tt * 200) * 0.6
                    bus.add(x * 0.07, tb + k * S + rng.normal(0, 0.005), 0.38, wet=0.3)
            if b % 4 == 2:
                n = int(SR * 1.2); bus.add(fm(hz(93), n, 3.5, 1, 3, 3) * 0.05, tb + 15 * S, 0.3, wet=0.5)
        if b % 8 == 7:                                # steam valve hiss as accent
            n = int(SR * 1.4); tt = np.arange(n) / SR
            x = hp(noise(n), 3000) * np.clip(tt * 20, 0, 1) * np.exp(-tt * 2.5)
            bus.add(x * 0.05, tb + 3 * Q, 0.7, wet=0.5)
    return bus.mix(reverb_ir(5.0, 1.0, 3000, 0.07), 0.6)

# ================= VERSTECKT: deep choir, theremin, countdown, sub =================
def theremin(seq, n0):
    """seq of (t, midi, dur) -> continuous sine with portamento"""
    out = np.zeros(n0); f = np.zeros(n0); amp = np.zeros(n0)
    for t, m, d in seq:
        a = int(t * SR); e = min(n0, int((t + d) * SR)); f[a:e] = hz(m); amp[a:e] = 1
    last = hz(62)
    for i in range(n0):
        if f[i] == 0: f[i] = last
        last = f[i]
    f = lp(f, 6)                                       # portamento
    amp = lp(amp, 4)
    tt = np.arange(n0) / SR
    f = f * (1 + 0.012 * np.sin(2 * np.pi * 5.2 * tt))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)) * amp
def versteckt():
    bus = Bus()
    for b, s, tb, notes in bars():
        if b % 2 == 0:
            n = int(SR * (2 * BAR + 1.5))
            bus.add(choir(notes[0], n, 'u') * 0.12, tb, wet=0.9)
            bus.add(choir(notes[2] - 12, n, 'o') * 0.07, tb, wet=0.9)
        if b % 2 == 0:                                 # countdown beep every 2 bars, double every 8
            for k in range(2 if b % 8 == 6 else 1):
                n = int(SR * 0.16); tt = np.arange(n) / SR
                x = np.sin(2 * np.pi * 988 * tt) * np.clip(tt * 300, 0, 1) * np.clip((0.16 - tt) * 300, 0, 1)
                bus.add(x * 0.04, tb + 3 * Q + k * 0.22, 0.3, wet=0.6)
    seq = []
    for (b_, e_, m, ln) in mel_b4:                      # theme one octave down under the flute (B)
        seq.append((16 * BAR + b_ * BAR + e_ * E, m - 12, ln * E))
    for b0 in (8, 24):                                  # long tones elsewhere
        for k, m in enumerate((62, 65, 64, 61)):
            seq.append(((b0 + 2 * k) * BAR, m, 2 * BAR - 0.2))
    th = theremin(seq, N) * 0.07
    bus.add(th, 0, 0.55, wet=0.7)
    tt = np.arange(N) / SR
    sub = np.sin(2 * np.pi * 36.7 * tt) * 0.05 * (1 + 0.4 * np.sin(2 * np.pi * tt / 8))
    bus.dry += np.stack([sub, sub])
    return bus.mix(reverb_ir(6.0, 0.8, 2500, 0.08), 0.7)

# ================= mixing helpers =================
def rms(x): return np.sqrt(np.mean(x ** 2) + 1e-12)
def finish(x, peak=0.9):
    x = compressor(x / np.max(np.abs(x)), 0.6, 2.0, 0.01, 0.2, 1.0)
    return x / np.max(np.abs(x)) * peak
def write(path, x):
    wavfile.write(path, SR, (np.clip(x, -1, 1).T * 32767).astype(np.int16))

def camp_guitar(seg_bars, b0):
    """Atempause: Karplus-Strong fingerpicking (6 against 8) + answer motif, 4/4 canon, 120 BPM"""
    bus = Bus(int(SR * seg_bars * BAR + SR * 3))
    for bi in range(seg_bars):
        b = b0 + bi; s = SEC[b // 8]; prog = prog_b if s == 'B' else prog_a; notes = CH[prog[b % 8]]
        tb = bi * BAR
        for k in range(8):
            idx = PATTERN[(b * 8 + k) % 6]
            x = ks(hz(notes[idx]), 2.5, 0.4, 0.9982) * (0.9 if k == 0 else 0.55)
            bus.add(x, tb + k * E + rng.normal(0, 0.008), 0.35 + 0.08 * idx, wet=0.4, gain=0.35)
        for (bb, e_, m, ln) in mel_a4:
            if bb == b % 8:
                bus.add(ks(hz(m), ln * E + 2, 0.7, 0.9985), tb + e_ * E, 0.62, wet=0.5, gain=0.5)
    return bus.mix(reverb_ir(2.4, 2.8, 3500, 0.02), 0.5, loop=False)

def main():
    src, out = sys.argv[1], sys.argv[2]
    sr, ex = wavfile.read(src); ex = ex.T.astype(float) / 32767
    ex = ex[:, :N]
    colors = [('highway', highway), ('stadtrand', stadtrand), ('saltflats', saltflats),
              ('deltaring', deltaring), ('versteckt', versteckt)]
    layers = {}
    for name, fn in colors:
        c = fn(); c *= rms(ex) / rms(c) * 10 ** (-2 / 20)       # colour sits ~2 dB under the explore layer
        layers[name] = c
        write(os.path.join(out, f'farbe_{name}_layer.wav'), c / max(1, np.max(np.abs(c)) / 0.9))
        write(os.path.join(out, f'farbe_{name}.wav'), finish(ex + c))
        print('colour', name)
    # --- Atempause: explore at 30 % + camp guitar (bars 8–23: A2 and B) ---
    b0, nb = 8, 16
    seg = ex[:, int(b0 * BAR * SR):int((b0 + nb) * BAR * SR)]
    g = camp_guitar(nb, b0)[:, :seg.shape[1]]
    g *= rms(seg) / rms(g) * 10 ** (1 / 20)
    t = np.arange(seg.shape[1]) / SR
    duck = 1 - 0.7 * np.clip(t / 3, 0, 1)                         # explore glides down to 30 %
    write(os.path.join(out, 'moment_atempause.wav'), finish(seg * duck + g * np.clip(t / 2, 0, 1)))
    print('atempause')
    # --- Wow (Silo Zero / Versteckt): 6 s explore → 1 s silence → stinger → theme (B) with colour ---
    lay = ex + layers['versteckt']
    pre = lay[:, int(12 * BAR * SR):int(12 * BAR * SR + 6 * SR)].copy()
    pre[:, -int(SR * 0.6):] *= np.linspace(1, 0, int(SR * 0.6))
    gap = np.zeros((2, int(SR * 1.0)))
    n = int(SR * 4.5); tt = np.arange(n) / SR
    boom = np.tanh(np.sin(2 * np.pi * np.cumsum(30 + 70 * np.exp(-tt * 5)) / SR) * np.exp(-tt * 1.2) * 1.8) * 0.8
    chord = choir(50, n, 'a') * 0.5 + choir(57, n, 'o') * 0.4 + choir(62, n, 'a') * 0.3
    sting = chord + np.stack([boom, boom])
    ir = reverb_ir(5, 0.9, 3000, 0.05)
    sting = sting + 0.5 * np.stack([fftconvolve(sting[c], ir[c])[:n] for c in range(2)])
    sting /= np.max(np.abs(sting))
    theme = lay[:, int(16 * BAR * SR):int(24 * BAR * SR)].copy() * 1.25
    theme[:, :int(SR * 0.8)] *= np.linspace(0, 1, int(SR * 0.8))
    k = int(SR * 2.2); body = theme.copy(); body[:, :n - k] += 0  # theme starts under the stinger tail
    full = np.concatenate([pre, gap, np.zeros((2, k)), theme], 1)
    s0 = pre.shape[1] + gap.shape[1]; full[:, s0:s0 + n] += sting * 0.55 * np.max(np.abs(theme))
    full[:, -int(SR * 2):] *= np.linspace(1, 0, int(SR * 2))
    write(os.path.join(out, 'moment_wow_silo.wav'), finish(full))
    print('wow')
    # --- Tresor jingle: theme bars 5–8 compressed, picardy D major at the end ---
    seqj = [(0.00, 74, 0.14), (0.14, 77, 0.28), (0.42, 76, 0.14), (0.56, 73, 0.14), (0.70, 76, 0.14), (0.84, 74, 1.6)]
    n = int(SR * 3.2); bus = Bus(n)
    for t0, m, d in seqj:
        x = fm(hz(m + 12), int(SR * 2.2), 3.5, 2.0, 4, 1.5)
        bus.add(x * 0.3, t0, 0.5 + 0.1 * (m - 74) / 3, wet=0.6)
        bus.add(ks(hz(m), 2.0, 0.8, 0.998) * 0.25, t0, 0.4, wet=0.4)
    pad = sum(supersaw(hz(m), int(SR * 2.4), 5, 12) for m in (50, 57, 62, 66, 69)) * 0.12   # D major
    pad = np.stack([lp(pad[c], 2500) for c in range(2)]) * adsr(int(SR * 2.4), 0.05, 1, 0.8, 1.0, 1.2)
    bus.add(pad, 0.84, wet=0.7)
    for i in range(10):                                # gold sparkle
        bus.add(fm(hz(rng.choice([86, 90, 93, 98])), int(SR * 0.6), 5, 1, 10, 6) * 0.06, 0.84 + i * 0.07, rng.uniform(0.2, 0.8), wet=0.8)
    jing = bus.mix(reverb_ir(2.5, 2.4, 5000, 0.02), 0.5, loop=False)
    write(os.path.join(out, 'moment_tresor.wav'), finish(jing, 0.85))
    print('tresor')

if __name__ == '__main__':
    main()

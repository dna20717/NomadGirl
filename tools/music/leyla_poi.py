"""Leyla Theme – POI-Variante (Erkundung + Kampf als Schichten).
Kopie aus dem claude.ai-Projekt (claude/music/leyla_poi.py), 22.11.2026 ins Repo übernommen (#180).
Vier gleich lange, taktgenaue Schleifen (32 Takte, 120 BPM, 64 s):
  explore = Grundschicht, läuft immer: geheimnisvoll, halber Puls, ohne Schlagzeug
  tension = Spannung (Streicher-Tremolo, Shepard-Ton, Taiko), ohne Tempowechsel
  jitter  = Nervosität (zerhackter Akkord, Glitches, Ticks, AvAs Chirps), leicht neben dem Raster
  combat  = Puls: Four-on-the-floor, Bass, Arp, Lead (wirkt doppelt so schnell)
Dazu zwei Stinger (Kampf beginnt / Kampf vorbei) und Demos mit Übergängen.
Melodie/Akkorde = Kanon (claude.ai-Projekt › leyla-theme.md, 4/4-Fassung).
  python3 leyla_poi.py OUTDIR      (braucht numpy, scipy, numba)"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import music_engine as M
from music_engine import (SR, hz, lp, hp, bp, blep_saw, blep_pulse, ladder, compressor, limiter,
                          drift, adsr, supersaw, ping, chorus, reverb_ir, fftconvolve)
M.seed(1313)
rng = M.rng

BPM = 120
Q = 60 / BPM; E = Q / 2; S = Q / 4; BAR = 4 * Q
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'

CH = {'Dm': [50, 57, 62, 65, 69], 'C': [48, 55, 60, 64, 67], 'Bb': [46, 53, 58, 62, 65],
      'A': [45, 52, 57, 61, 64], 'F': [41, 48, 53, 57, 60], 'Gm': [43, 50, 55, 58, 62]}
PATTERN = [0, 1, 2, 3, 4, 3]
prog_a = ['Dm', 'C', 'Bb', 'A', 'Dm', 'F', 'Gm', 'A']
prog_b = ['Bb', 'F', 'Gm', 'Dm', 'Bb', 'C', 'A', 'A']
mel_b4 = [(0,0,74,3),(0,3,72,3),(0,6,70,2), (1,0,69,5),(1,5,72,3), (2,0,70,3),(2,3,69,3),(2,6,67,2),
          (3,0,69,8), (4,0,74,2),(4,2,77,4),(4,6,76,2), (5,0,76,3),(5,3,72,5), (6,0,73,3),(6,3,76,3),(6,6,73,2),
          (7,0,69,8)]
mel_a4 = [(1,4,72,4),(3,0,73,3),(3,3,69,5),(5,4,72,2),(5,6,69,2),(7,0,73,8)]

# four 8-bar sections: A1 (still), A2 (answer motif), B (theme), A3 (sparse)
SECTIONS = [dict(n='A1', prog=prog_a, mel=None), dict(n='A2', prog=prog_a, mel=mel_a4),
            dict(n='B', prog=prog_b, mel=mel_b4), dict(n='A3', prog=prog_a, mel=None)]
NB = 32; LOOP = NB * BAR
N = int(SR * (LOOP + 8))
L1 = {k: np.zeros((2, N)) for k in ['drone', 'pad', 'bell', 'flute', 'tex', 'heart', 'verb']}    # explore
L2 = {k: np.zeros((2, N)) for k in ['kick', 'snare', 'hat', 'bass', 'arp', 'stab', 'lead', 'verb']}  # combat: pulse
L3 = {k: np.zeros((2, N)) for k in ['strings', 'shep', 'taiko', 'verb']}                         # combat: tension (no tempo change)
L4 = {k: np.zeros((2, N)) for k in ['gate', 'glitch', 'tick', 'chirp', 'verb']}                   # combat: jitter (nervous, glitchy)
duck2 = np.ones(N)

def add(bus, name, sig, t, pan=0.5):
    s = int(round(t * SR))
    if s >= N or s < 0: return
    e = min(N, s + sig.shape[-1]); sig = sig[..., :e - s]
    if sig.ndim == 1:
        bus[name][0, s:e] += sig * np.sqrt(1 - pan); bus[name][1, s:e] += sig * np.sqrt(pan)
    else:
        bus[name][:, s:e] += sig

def filt2(st, cut, res, drive=1.0):
    return np.stack([ladder(st[0], cut, res, drive), ladder(st[1], cut, res, drive)])

# ================= EXPLORE layer =================
def drone(root, t, dur):
    n = int(SR * (dur + 1.5)); tt = np.arange(n) / SR
    f = hz(root - 12)
    x = blep_saw(f * drift(n, 2), rng.random()) + blep_saw(f * 1.5 * drift(n, 2), rng.random()) * 0.5
    cut = 220 + 120 * np.sin(2 * np.pi * 0.07 * tt + t)
    y = ladder(x, cut, 0.3, 0.9) + 0.6 * np.sin(2 * np.pi * f * tt)
    add(L1, 'drone', y * adsr(n, 1.2, 2, 1, 1.3, dur) * 0.22, t)

def glass_pad(notes, t, dur, g):
    n = int(SR * (dur + 2.5)); tt = np.arange(n) / SR
    voice = [notes[1], notes[2], notes[3], notes[2] + 14]          # fifth, octave, third, add9
    st = sum(supersaw(hz(m), n, 4, 9) for m in voice) * 0.4
    st = filt2(st, 750 + 350 * np.sin(2 * np.pi * 0.11 * tt + t), 0.25, 0.6)
    st = np.stack([hp(st[0], 160), hp(st[1], 160)])
    env = adsr(n, 1.6, 3, 0.9, 2.2, dur)
    add(L1, 'pad', st * env * g * 0.5, t); add(L1, 'verb', st * env * g * 0.35, t)

def fm_bell(m, t, g, pan, ratio=3.5, idx=2.2, dec=1.6):
    n = int(SR * 2.4); tt = np.arange(n) / SR; f = hz(m)
    mod = idx * np.exp(-tt * 3) * np.sin(2 * np.pi * f * ratio * tt)
    x = np.sin(2 * np.pi * f * tt + mod) * np.exp(-tt * dec) * np.clip(tt * 900, 0, 1)
    add(L1, 'bell', x * g * 0.22, t, pan); add(L1, 'verb', x * g * 0.2, t, 1 - pan)

def flute(m, t, dur, g, prev=None):
    """breathy 'glass flute' for the melody: soft pulse + band noise, slow attack, delayed vibrato"""
    n = int(SR * (dur + 0.9)); tt = np.arange(n) / SR
    base = hz(m) if not prev else hz(m) * (hz(prev) / hz(m)) ** np.exp(-tt / 0.05)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 4.8 * tt) * np.clip((tt - 0.35) * 2, 0, 1)
    fr = base * vib * drift(n, 3)
    tone = blep_pulse(fr, rng.random(), 0.5) * 0.45 + np.sin(2 * np.pi * np.cumsum(fr) / SR) * 0.8
    tone = lp(tone, 2600)
    breath = bp(rng.normal(0, 1, n), hz(m) * 1.5, min(hz(m) * 6, 9000)) * 0.25 * (0.4 + 0.6 * np.exp(-tt * 4))
    env = adsr(n, 0.09, 0.8, 0.85, 0.35, dur)
    y = (tone + breath) * env * g * 0.3
    add(L1, 'flute', y, t, 0.56); add(L1, 'verb', np.stack([y, y]) * 0.55, t)

def heartbeat(t, g):
    for k, gg in ((0, 1.0), (0.24, 0.6)):
        n = int(SR * 0.5); tt = np.arange(n) / SR
        x = np.sin(2 * np.pi * np.cumsum(55 + 30 * np.exp(-tt * 25)) / SR) * np.exp(-tt * 9)
        add(L1, 'heart', np.tanh(x * 1.4) * g * gg * 0.5, t + k)

def metal_ping(t):
    n = int(SR * 3); tt = np.arange(n) / SR; f = rng.choice([880, 1175, 1320, 1568]) * rng.uniform(0.98, 1.02)
    x = sum(np.sin(2 * np.pi * f * r * tt) * np.exp(-tt * d) for r, d in ((1, 1.2), (2.76, 2.2), (5.4, 3.5))) * np.clip(tt * 2000, 0, 1)
    p = rng.uniform(0.15, 0.85)
    add(L1, 'tex', x * 0.035, t, p); add(L1, 'verb', x * 0.07, t, 1 - p)

def swell(t, dur):
    n = int(SR * dur); tt = np.arange(n) / SR
    x = lp(rng.normal(0, 1, (2, n)), 1800) * (tt / dur) ** 2.5
    add(L1, 'tex', x * 0.05, t); add(L1, 'verb', x * 0.04, t)

def beep(t):
    n = int(SR * 0.13); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * 1760 * tt) * np.clip(tt * 400, 0, 1) * np.clip((0.13 - tt) * 400, 0, 1)
    add(L1, 'tex', x * 0.035, t, 0.7); add(L1, 'verb', x * 0.04, t, 0.7)

# ================= COMBAT layer =================
def kick(t, g=1.0):
    n = int(SR * 0.4); tt = np.arange(n) / SR
    f = 48 + 140 * np.exp(-tt * 34) + 40 * np.exp(-tt * 180)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 6.5) + hp(rng.normal(0, 1, n), 2500) * np.exp(-tt * 400) * 0.35
    add(L2, 'kick', np.tanh(x * 2.5) * g * 0.9, t)
    s = int(t * SR); Ln = min(N - s, int(SR * 0.35))
    if Ln > 0:
        c = 1 - 0.5 * g * np.exp(-np.arange(Ln) / (0.09 * SR)) * np.clip(np.arange(Ln) / 60, 0, 1)
        duck2[s:s + Ln] = np.minimum(duck2[s:s + Ln], c)

def snare(t, g=1.0):
    n = int(SR * 0.4); tt = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 190 * tt * (1 + 0.15 * np.exp(-tt * 60))) * np.exp(-tt * 30)
    noise = bp(rng.normal(0, 1, n), 1800, 11000) * np.exp(-tt * 13)
    clap = sum(np.concatenate([np.zeros(int(d * SR)), bp(rng.normal(0, 1, n - int(d * SR)), 900, 4500) * np.exp(-np.arange(n - int(d * SR)) / SR * 70)]) for d in (0, 0.009, 0.018))
    x = np.tanh((0.8 * tone + 0.7 * noise + 0.4 * clap) * 1.6) * g * 0.55
    add(L2, 'snare', x, t); add(L2, 'verb', x * 0.5, t)

METAL = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]
def hat(t, g=1.0, open_=False):
    n = int(SR * (0.28 if open_ else 0.05)); tt = np.arange(n) / SR
    m = sum(np.sign(np.sin(2 * np.pi * f * 1.9 * tt + rng.random() * 6)) for f in METAL)
    x = bp(m * 0.6 + rng.normal(0, 1, n) * 0.5, 7000, 15500) * np.exp(-tt * (10 if open_ else 80))
    add(L2, 'hat', x * g * 0.3, t, 0.6 if open_ else 0.42)

def tom(t, f, g=1.0):
    n = int(SR * 0.5); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.5 * np.exp(-tt * 20))) / SR) * np.exp(-tt * 7)
    x += bp(rng.normal(0, 1, n), 300, 3000) * np.exp(-tt * 30) * 0.3
    add(L2, 'kick', np.tanh(x * 1.8) * g * 0.5, t, 0.3 + 0.4 * (f < 120)); add(L2, 'verb', x * g * 0.2, t)

def crash(t):
    n = int(SR * 2.2); tt = np.arange(n) / SR
    m = sum(np.sign(np.sin(2 * np.pi * f * 2.7 * tt + rng.random() * 6)) for f in METAL)
    x = hp(m * 0.3 + rng.normal(0, 1, n), 4500) * np.exp(-tt * 1.8) * np.clip(tt * 400, 0, 1)
    add(L2, 'hat', np.stack([x, np.roll(x, 41)]) * 0.11, t)

def bass16(root, t):
    f = hz(root)
    for k in range(16):
        dur = S * 0.8; n = int(SR * (dur + 0.05)); tt = np.arange(n) / SR
        o = 2 if k % 4 == 3 else 1
        x = 0.7 * blep_saw(f * o * drift(n, 4), rng.random()) + 0.7 * blep_saw(f * o * 1.004 * drift(n, 4), rng.random())
        mid = ladder(x, 180 + 1600 * np.exp(-tt / 0.055), 0.42, 2.2)
        sub = np.sin(2 * np.pi * f * tt) * 0.9
        sig = (np.tanh(hp(mid, 110) * 1.6) * 0.75 + np.tanh(sub * 1.2)) * adsr(n, 0.002, 0.25, 0.8, 0.02, dur) * 0.4
        add(L2, 'bass', sig, t + k * S)

def arp16(notes, t, g):
    for k in range(16):
        idx = PATTERN[k % 6]; m = notes[idx] + 12
        n = int(SR * 0.4); tt = np.arange(n) / SR
        x = 0.55 * blep_saw(hz(m) * drift(n), rng.random()) + 0.5 * blep_pulse(hz(m) * 1.003 * drift(n), rng.random(), 0.3)
        y = ladder(x, 900 + 3600 * np.exp(-tt / 0.04), 0.5, 1.3) * adsr(n, 0.001, 0.09, 0.0, 0.06, 0.12)
        add(L2, 'arp', y * g * (1.0 if k % 6 == 0 else 0.7) * 0.3, t + k * S, 0.3 + 0.1 * idx)

def stab(notes, t, g):
    dur = E * 1.2; n = int(SR * (dur + 0.4)); tt = np.arange(n) / SR
    st = sum(supersaw(hz(m), n, 5, 14) for m in notes[1:4])
    st = filt2(st, 400 + 3200 * np.exp(-tt / 0.08), 0.15, 1.5)
    env = adsr(n, 0.004, 0.15, 0.5, 0.12, dur)
    add(L2, 'stab', st * env * g * 0.3, t); add(L2, 'verb', st * env * g * 0.12, t)

def lead(m, t, dur, g, prev=None):
    n = int(SR * (dur + 0.5)); tt = np.arange(n) / SR
    vib = 1 + 0.0045 * np.sin(2 * np.pi * 5.4 * tt) * np.clip((tt - 0.25) * 3, 0, 1)
    st = supersaw(hz(m), n, 9, 22, glide_from=hz(prev) if prev else None, vib=vib)
    st += 0.5 * supersaw(hz(m) / 2, n, 3, 6, vib=vib)
    st = filt2(st, 2300 + 2800 * np.exp(-tt / 0.15), 0.12, 1.0)
    env = adsr(n, 0.006, 0.4, 0.85, 0.18, dur)
    add(L2, 'lead', st * env * g * 0.4, t); add(L2, 'verb', st * env * g * 0.14, t)

def riser2(t, dur):
    n = int(SR * dur); tt = np.arange(n) / SR; ramp = (tt / dur) ** 2
    noise = rng.normal(0, 1, (2, n)); out = np.zeros((2, n))
    for i in range(24):
        a, b = i * n // 24, (i + 1) * n // 24; fc = 400 * (30 ** (i / 24))
        for c in range(2): out[c, a:b] = bp(noise[c, a:b], fc * 0.6, min(fc * 1.6, 19000))
    add(L2, 'hat', out * ramp * 0.09, t)

# ================= TENSION layer (no tempo change) =================
def tremolo_strings(notes, t, dur, g):
    n = int(SR * (dur + 0.6)); tt = np.arange(n) / SR
    voice = [notes[0] - 12, notes[0], notes[1], notes[2] + 1]       # low root, root, fifth + a rubbing minor second
    st = sum(supersaw(hz(m), n, 6, 14, vib=1 + 0.003 * np.sin(2 * np.pi * 5.8 * tt + i)) * (0.35 if i == 3 else 1.0) for i, m in enumerate(voice))
    st = np.stack([lp(bp(st[c], 90, 5000), 3200) for c in range(2)])
    trem = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * (1 / S * 2) * tt))   # bowed tremolo in 32nds
    trem = lp(trem, 180)
    env = adsr(n, 0.35, 1.5, 0.9, 0.4, dur)
    add(L3, 'strings', st * trem * env * g * 0.16, t); add(L3, 'verb', st * env * g * 0.06, t)

def shepard(t, dur):
    """endless rising tone over 8 bars (repeats seamlessly)"""
    n = int(SR * dur); tt = np.arange(n) / SR; out = np.zeros(n)
    for k in range(6):
        pos = (k + tt / dur) % 6 / 6                         # 0..1 position in the 6-octave window
        f = 55 * 2 ** (pos * 6)
        amp = np.sin(np.pi * pos) ** 2
        out += np.sin(2 * np.pi * np.cumsum(f) / SR) * amp
    out = lp(out, 2500) * 0.05
    add(L3, 'shep', np.stack([out, np.roll(out, 300)]), t); add(L3, 'verb', np.stack([out, out]) * 0.6, t)

def taiko(t, g=1.0):
    n = int(SR * 0.9); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(62 + 40 * np.exp(-tt * 14)) / SR) * np.exp(-tt * 4.5)
    x += lp(rng.normal(0, 1, n), 900) * np.exp(-tt * 25) * 0.5
    add(L3, 'taiko', np.tanh(x * 1.6) * g * 0.55, t); add(L3, 'verb', np.stack([x, x]) * g * 0.25, t)

# ================= JITTER layer (nervous, glitchy, off-grid) =================
def jit(): return rng.normal(0, 0.006)                       # timing jitter ~6 ms

def gated_chord(notes, t, g):
    """chord chopped into random 32nd gates – stuttering, nervous"""
    n = int(SR * (BAR + 0.1)); tt = np.arange(n) / SR
    st = sum(supersaw(hz(m + 12), n, 3, 10) for m in notes[1:4])
    st = np.stack([bp(st[c], 500, 7000) for c in range(2)])
    gate = np.zeros(n); step = S / 2
    for k in range(32):
        if rng.random() < (0.55 if k % 2 == 0 else 0.35):
            a = int((k * step + jit()) * SR); b = a + int(step * rng.uniform(0.3, 0.9) * SR)
            a = max(0, a); gate[a:min(n, b)] = rng.uniform(0.5, 1.0)
    gate = lp(gate, 600)
    add(L4, 'gate', st * gate * g * 0.22, t)

def crush(x, bits=5, hold=6):
    x = np.repeat(x[::hold], hold)[:len(x)]
    q = 2 ** (bits - 1); return np.round(x * q) / q

def glitch(t, g=1.0):
    """ratchet: a tiny slice repeated faster and faster, bit-crushed"""
    sl = int(SR * rng.uniform(0.018, 0.04)); f = hz(rng.choice([69, 74, 77, 81, 86]))
    tt = np.arange(sl) / SR
    src = (blep_saw(np.full(sl, f), rng.random()) * 0.6 + rng.normal(0, 0.4, sl)) * np.hanning(sl)
    reps = rng.integers(4, 9); out = []
    for r in range(reps):
        seg = src[:max(40, int(sl * (1 - r / (reps + 1))))]
        out.append(seg * (1 - r / (reps * 1.4)))
    y = crush(np.concatenate(out), int(rng.integers(3, 6)), int(rng.integers(4, 10)))
    y = bp(y, 400, 9000)
    p = rng.uniform(0.1, 0.9)
    add(L4, 'glitch', y * g * 0.22, t + jit(), p); add(L4, 'verb', y * g * 0.08, t, 1 - p)

def tick(t, g=1.0):
    n = int(SR * 0.02); tt = np.arange(n) / SR
    x = hp(rng.normal(0, 1, n), 6000) * np.exp(-tt * 300) + np.sin(2 * np.pi * 3200 * tt) * np.exp(-tt * 400) * 0.5
    add(L4, 'tick', x * g * 0.25, t + jit(), rng.uniform(0.25, 0.75))

def chirp(t):
    """AvA's systems panicking: short FM data blips, random pitch"""
    n = int(SR * 0.07); tt = np.arange(n) / SR
    f0 = rng.uniform(900, 2400); f1 = f0 * rng.choice([0.5, 1.5, 2.0])
    f = f0 + (f1 - f0) * tt / tt[-1]
    x = np.sin(2 * np.pi * np.cumsum(f) / SR + 3 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.hanning(n)
    add(L4, 'chirp', crush(x, 6, 3) * 0.07, t + jit(), rng.uniform(0.2, 0.8))

# ================= arrangement =================
t0 = 0.0
for si, sec in enumerate(SECTIONS):
    prev = None
    for bi, ch in enumerate(sec['prog']):
        tb = t0 + bi * BAR; notes = CH[ch]; gbar = si * 8 + bi
        # --- explore ---
        drone(notes[0], tb, BAR)
        glass_pad(notes, tb, BAR, 0.8 if sec['n'] != 'A1' else 0.65)
        if sec['n'] != 'A1' or bi >= 2:                       # picking pattern as bells, 8ths (6 against 8)
            for k in range(8):
                idx = PATTERN[(gbar * 8 + k) % 6]
                fm_bell(notes[idx] + 12, tb + k * E, (0.9 if k % 4 == 0 else 0.6) * (0.7 if sec['n'] == 'B' else 1.0), 0.3 + 0.1 * idx)
        if sec['n'] in ('A2', 'B'):
            heartbeat(tb, 0.75 if sec['n'] == 'B' else 0.55)
        if rng.random() < 0.35: metal_ping(tb + rng.integers(0, 8) * E)
        if sec['n'] == 'A1' and bi in (0, 4): beep(tb + Q); beep(tb + Q + 0.3)
        if bi == 7: swell(tb, BAR)
        if sec['mel']:
            for (b_, e_, m, ln) in sec['mel']:
                if b_ == bi:
                    flute(m - (12 if sec['n'] == 'A2' else 0), tb + e_ * E, ln * E - 0.03, 0.9, prev and prev - (12 if sec['n'] == 'A2' else 0))
                    prev = m
        # --- combat ---
        for q in range(4): kick(tb + q * Q)
        snare(tb + Q); snare(tb + 3 * Q)
        for e in range(8): hat(tb + e * E, 0.7); hat(tb + e * E + S, 0.35)
        hat(tb + Q + E, 0.5, True); hat(tb + 3 * Q + E, 0.5, True)
        bass16(notes[0] - 12, tb)
        arp16(notes, tb, 0.75 if sec['n'] == 'B' else 0.95)
        if sec['n'] in ('A1', 'A3'):
            stab(notes, tb, 1.0); stab(notes, tb + 3 * E, 0.8)
        if bi == 0: crash(tb)
        if bi == 7:
            for k, f in zip(range(8, 16), (210, 210, 170, 170, 140, 140, 105, 90)): tom(tb + k * S, f, 0.6 + 0.04 * k)
        if sec['n'] == 'A3' and bi == 6: riser2(tb, 2 * BAR)
    if sec['mel']:
        prevc = None
        for (b_, e_, m, ln) in sec['mel']:
            lead(m, t0 + b_ * BAR + e_ * E, ln * E - 0.03, 1.0 if sec['n'] == 'B' else 0.8, prevc); prevc = m
    t0 += 8 * BAR

# tension + jitter, on the same timeline and chords
t0 = 0.0
for si, sec in enumerate(SECTIONS):
    shepard(t0, 8 * BAR)
    for bi, ch in enumerate(sec['prog']):
        tb = t0 + bi * BAR; notes = CH[ch]
        tremolo_strings(notes, tb, BAR, 1.0)
        taiko(tb, 1.0); taiko(tb + 3 * E, 0.6); taiko(tb + 2 * Q, 0.8)
        gated_chord(notes, tb, 1.0)
        for k in range(16):                                   # nervous ticks in 16th triplets feel + random 32nds
            if rng.random() < 0.55: tick(tb + k * S, 1.0 if k % 4 == 0 else 0.55)
            if rng.random() < 0.25: tick(tb + k * S + S / 2, 0.4)
        for _ in range(rng.integers(2, 5)): glitch(tb + rng.integers(0, 16) * S, rng.uniform(0.6, 1.0))
        for _ in range(rng.integers(1, 4)): chirp(tb + rng.integers(0, 32) * S / 2)
    t0 += 8 * BAR

L1['tex'] += lp(hp(rng.normal(0, 1, (2, N)), 300), 1400) * 0.006 * (1 + 0.6 * np.sin(2 * np.pi * np.arange(N) / SR / 9))  # wind/air

# ================= mix =================
loop_n = int(round(SR * LOOP))
def wrap(x):
    o = x[:, :loop_n].copy(); o[:, :N - loop_n] += x[:, loop_n:]; return o

def master(x, ceil=0.93, drive=1.1):
    x = hp(x, 28)
    x = compressor(x / np.max(np.abs(x)), 0.5, 2.0, 0.015, 0.25, 1.0)
    x = np.tanh(x * drive) / np.tanh(drive)
    return x

ir_big = reverb_ir(4.0, 1.5, 4500, 0.04)
verb1 = np.stack([fftconvolve(L1['verb'][c], ir_big[c])[:N] for c in range(2)])
L1['pad'] = chorus(L1['pad']); L1['bell'] = ping(L1['bell'], 3 * E, 0.4, 4, 2500)
G1 = dict(drone=1.0, pad=2.2, bell=1.3, flute=1.2, tex=3.0, heart=1.3)
explore = sum(L1[k] * G1[k] for k in G1) + 0.45 * verb1

ir_room = reverb_ir(1.4, 4.0, 5000, 0.02)
verb2 = np.stack([fftconvolve(L2['verb'][c], ir_room[c])[:N] for c in range(2)])
for k in ['bass', 'arp', 'stab']: L2[k] *= duck2
L2['arp'] = ping(L2['arp'], 3 * S, 0.25, 2)
b_ = L2['bass'].mean(0); L2['bass'] = np.stack([b_, b_])
drums = compressor(L2['kick'] + L2['snare'] + L2['hat'], 0.35, 4.0, 0.003, 0.09, 1.3)
G2 = dict(bass=1.0, arp=4.0, stab=1.6, lead=1.8)
combat = 0.8 * drums + sum(L2[k] * G2[k] for k in G2) + 0.5 * verb2

ir_mid = reverb_ir(2.2, 2.6, 4500, 0.03)
verb3 = np.stack([fftconvolve(L3['verb'][c], ir_mid[c])[:N] for c in range(2)])
tension = sum(L3[k] for k in ['strings', 'shep', 'taiko']) + 0.5 * verb3
verb4 = np.stack([fftconvolve(L4['verb'][c], ir_room[c])[:N] for c in range(2)])
jitter = L4['gate'] * 1.0 + L4['glitch'] * 1.0 + L4['tick'] * 1.0 + L4['chirp'] * 1.0 + 0.5 * verb4
tension = wrap(tension); jitter = wrap(jitter)
explore = wrap(explore); combat = wrap(combat)
def rms(x): return np.sqrt(np.mean(x ** 2))
tension *= rms(combat) / rms(tension) * 10 ** (-4 / 20)     # target levels relative to the pulse layer
jitter *= rms(combat) / rms(jitter) * 10 ** (-5 / 20)
# common gain staging: both layers are scaled by the SAME factor so their sum keeps the intended balance
ref = np.max(np.abs(explore + combat + tension + jitter)) * 0.75
explore /= ref; combat /= ref; tension /= ref; jitter /= ref
expl_out = master(explore * 1.6, drive=1.0); expl_out *= 0.55 / np.max(np.abs(expl_out))   # explore alone, quieter on purpose
comb_out = combat * 0.9                                                                      # layer stays linear, so the game can sum it

from scipy.io import wavfile
def write(name, x): wavfile.write(os.path.join(OUT, name), SR, (np.clip(x, -1, 1).T * 32767).astype(np.int16))
write('poi_explore.wav', expl_out)
write('poi_combat.wav', comb_out)
ten_out = tension * 0.9; jit_out = np.tanh(jitter * 1.8) / 1.8 * 0.95   # tame glitch peaks
write('poi_tension.wav', ten_out); write('poi_jitter.wav', jit_out)

# preview: explore + combat as the game would play it
both = expl_out + comb_out * 1.0
write('poi_both.wav', both / max(1, np.max(np.abs(both)) / 0.95))

# ---- stingers ----
def stinger_start():
    n = int(SR * 2.2); tt = np.arange(n) / SR; out = np.zeros((2, n))
    boom = np.sin(2 * np.pi * np.cumsum(32 + 80 * np.exp(-tt * 7)) / SR) * np.exp(-tt * 2.2)
    out += np.tanh(boom * 1.6) * 0.6
    st = sum(supersaw(hz(m), n, 7, 18) for m in (50, 57, 62, 65))
    st = filt2(st, 300 + 4000 * np.exp(-tt / 0.15), 0.2, 1.6) * adsr(n, 0.003, 0.3, 0.4, 0.5, 0.35)
    out += st * 0.35
    out += np.stack([hp(rng.normal(0, 1, n), 5000) * np.exp(-tt * 2.5)] * 2) * 0.08
    return out
def stinger_end():
    n = int(SR * 4.0); tt = np.arange(n) / SR; out = np.zeros((2, n))
    for i, m in enumerate((69, 65, 62)):                                   # A – F – D, settling down
        s = int(i * 0.35 * SR); k = n - s; t2 = np.arange(k) / SR
        x = np.sin(2 * np.pi * hz(m + 12) * t2 + 2 * np.exp(-t2 * 3) * np.sin(2 * np.pi * hz(m + 12) * 3.5 * t2)) * np.exp(-t2 * 1.4)
        out[:, s:] += x * 0.25
    pad = sum(supersaw(hz(m), n, 4, 9) for m in (50, 57, 62, 65))
    out += filt2(pad, np.full(n, 900.0), 0.2, 0.6) * adsr(n, 0.8, 2, 0.8, 1.2, 2.2) * 0.25
    return out
for name, f in (('poi_stinger_start.wav', stinger_start), ('poi_stinger_end.wav', stinger_end)):
    x = f(); ir = reverb_ir(3.0, 2.0, 4500, 0.03)
    x = x + 0.4 * np.stack([fftconvolve(x[c], ir[c])[:x.shape[1]] for c in range(2)])
    write(name, x / np.max(np.abs(x)) * 0.8)

# ---- demo: explore → fight (bar 10–22) → calm again; 48 bars = 1.5 loops ----
dn = int(SR * 48 * BAR)
ex = np.concatenate([expl_out, expl_out], 1)[:, :dn]; cb = np.concatenate([comb_out, comb_out], 1)[:, :dn]
t = np.arange(dn) / SR
g = np.clip((t - 10 * BAR) / (0.5 * BAR), 0, 1) * np.clip(1 - (t - 22 * BAR) / (2 * BAR), 0, 1)
demo = ex + cb * g
for (tt_, f) in ((10 * BAR - 0.15, stinger_start), (22 * BAR, stinger_end)):
    s_ = f(); s_ /= np.max(np.abs(s_)); i = int(tt_ * SR); demo[:, i:i + s_.shape[1]] += s_[:, :dn - i] * 0.45
write('poi_demo.wav', demo / max(1, np.max(np.abs(demo)) / 0.95))
print('loop', LOOP, 's · demo', 48 * BAR, 's')

# ---- demo: escalation in steps (explore → tension → +jitter → +pulse → calm) ----
def env_on(t, a, b, fin=0.5, fout=2.0):
    return np.clip((t - a * BAR) / (fin * BAR), 0, 1) * np.clip(1 - (t - b * BAR) / (fout * BAR), 0, 1)
def loopx(x, n): return np.tile(x, (1, int(np.ceil(n / x.shape[1]))))[:, :n]
dn = int(SR * 36 * BAR); t = np.arange(dn) / SR
demo = (loopx(expl_out, dn) + loopx(ten_out, dn) * env_on(t, 6, 26) + loopx(jit_out, dn) * env_on(t, 12, 26)
        + loopx(comb_out, dn) * env_on(t, 18, 26))
for (tt_, f, gg) in ((18 * BAR - 0.15, stinger_start, 0.45), (26 * BAR, stinger_end, 0.45)):
    s_ = f(); s_ /= np.max(np.abs(s_)); i = int(tt_ * SR); demo[:, i:i + s_.shape[1]] += s_[:, :dn - i] * gg
write('poi_eskalation.wav', demo / max(1, np.max(np.abs(demo)) / 0.95))
# ---- demo: nervous fight WITHOUT the tempo layer ----
dn = int(SR * 28 * BAR); t = np.arange(dn) / SR
demo = loopx(expl_out, dn) + (loopx(ten_out, dn) + loopx(jit_out, dn)) * env_on(t, 6, 20)
s_ = stinger_start(); s_ /= np.max(np.abs(s_)); i = int((6 * BAR - 0.15) * SR); demo[:, i:i + s_.shape[1]] += s_ * 0.4
s_ = stinger_end(); s_ /= np.max(np.abs(s_)); i = int(20 * BAR * SR); demo[:, i:i + s_.shape[1]] += s_[:, :dn - i] * 0.4
write('poi_nervoes.wav', demo / max(1, np.max(np.abs(demo)) / 0.95))
print('stems: explore, tension, jitter, combat(pulse)')

"""Leyla Theme, Camp-Version (13.11.2026, Ava + Daniel). Noten = Kanon, siehe claude.ai-Projekt › leyla-theme.md.
Akustische Gitarre aus Code (Karplus-Strong), Feuerknistern, Hall. Schreibt eine nahtlose Schleife:
32 Takte, der Ausklang wird über den Anfang gelegt (beides d-Moll).
  python3 tools/music/leyla_theme_camp.py /tmp/loop.wav
  ffmpeg -i /tmp/loop.wav -c:a aac -b:a 128k projects/nomadgirl/assets/music/leyla_theme_camp.m4a
  ffmpeg -i /tmp/loop.wav -c:a libvorbis -q:a 4 projects/nomadgirl/assets/music/leyla_theme_camp.ogg
"""
import sys
import numpy as np
from scipy.signal import lfilter, butter, fftconvolve
from scipy.io import wavfile

SR = 44100
rng = np.random.default_rng(7)
BPM = 66
EIGHTH = 60 / BPM / 2

def midi_hz(m): return 440 * 2 ** ((m - 69) / 12)

rng2 = np.random.default_rng(99)   # timbre-only randomness, keeps timing identical

def _ks(freq, n, burst, decay, s):
    N = len(burst); out = np.zeros(n); buf = burst.copy(); i = 0
    while i < n:
        k = min(N, n - i); out[i:i + k] = buf[:k]
        buf = decay * ((1 - s) * buf + s * np.roll(buf, -1)); i += k
    return out

def pluck(freq, dur, vel=0.8, bright=0.5):
    """Steel-string acoustic pluck (Karplus-Strong, two polarisations + pick click)."""
    n = int(SR * dur)
    N = int(SR / freq)
    burst = rng.uniform(-1, 1, N)
    b, a = butter(1, 2500 + 7000 * bright, fs=SR)
    burst = lfilter(b, a, burst)
    p = max(1, int(N * 0.18))
    burst = burst - 0.85 * np.concatenate([np.zeros(p), burst[:-p]])
    decay = 0.9975 + 0.0018 * min(1, 220 / freq) ** 0.3
    s = 0.32 + 0.1 * min(1, freq / 600)                 # light damping = bright steel
    a1 = _ks(freq, n, burst, decay, s)
    N2 = max(2, int(round(SR / (freq * 1.0012))))         # 2nd polarisation, slight detune
    b2 = np.interp(np.linspace(0, N - 1, N2), np.arange(N), burst)
    a2 = _ks(freq, n, b2, decay * 0.9995, s + 0.05)
    out = 0.6 * a1 + 0.4 * a2
    c = min(n, 220)                                      # pick click
    click = rng2.normal(0, 1, c) * np.exp(-np.arange(c) / 25)
    click = lfilter(*butter(2, 2500, btype='high', fs=SR), click)
    out[:c] += 0.25 * bright * click
    env = np.minimum(1, np.linspace(0, 60, n))
    return out * env * vel

def body(x):
    """Acoustic guitar body: convolve with a modal impulse response."""
    tt = np.arange(int(SR * 0.35)) / SR
    modes = [(98, 0.9, 12), (196, 0.7, 18), (232, 0.5, 20), (290, 0.35, 25),
             (385, 0.3, 30), (455, 0.25, 35), (560, 0.2, 40), (760, 0.15, 50),
             (1020, 0.12, 60), (1500, 0.08, 80), (2350, 0.06, 110), (3200, 0.04, 140)]
    ir = np.zeros_like(tt); ir[0] = 1.0
    for f, g, d in modes:
        ir += g * np.sin(2 * np.pi * f * tt + rng2.random()) * np.exp(-tt * d) * 0.05
    y = fftconvolve(x, ir)[:len(x)]
    b, a = butter(1, 4000, btype='high', fs=SR)          # a touch of string air
    return y + 0.15 * lfilter(b, a, x)

# Dm-ish open-string voicings: (bass, 5th, root8, 3rd, top)
CH = {
    'Dm': [50, 57, 62, 65, 69],
    'C':  [48, 55, 60, 64, 67],
    'Bb': [46, 53, 58, 62, 65],
    'A':  [45, 52, 57, 61, 64],
    'F':  [41, 48, 53, 57, 60],
    'Gm': [43, 50, 55, 58, 62],
    'Am': [45, 52, 57, 60, 64],
}
PATTERN = [0, 1, 2, 3, 4, 3]   # 3/4 fingerpicking, six eighths

prog_a = ['Dm', 'C', 'Bb', 'A', 'Dm', 'F', 'Gm', 'A']
prog_b = ['Bb', 'F', 'Gm', 'Dm', 'Bb', 'C', 'A', 'A']
# original melody for B section: (bar, eighth, midi, length_in_eighths)
mel_b = [
    (0, 0, 74, 3), (0, 3, 72, 2), (0, 5, 70, 1),
    (1, 0, 69, 4), (1, 4, 72, 2),
    (2, 0, 70, 2), (2, 2, 69, 2), (2, 4, 67, 2),
    (3, 0, 69, 6),
    (4, 0, 74, 2), (4, 2, 77, 3), (4, 5, 76, 1),
    (5, 0, 76, 3), (5, 3, 72, 3),
    (6, 0, 73, 3), (6, 3, 76, 2), (6, 5, 73, 1),
    (7, 0, 74 - 5, 6),
]
mel_a2 = [
    (1, 3, 72, 3), (3, 0, 73, 3), (3, 3, 69, 3),
    (5, 3, 72, 2), (5, 5, 69, 1), (7, 0, 73, 6),
]

form = [('A', None, 0.55), ('A', mel_a2, 0.7), ('B', mel_b, 0.8), ('A', mel_a2, 0.65)]
bars = sum(8 for _ in form)
total = bars * 6 * EIGHTH + 6
L = np.zeros(int(SR * total)); R = np.zeros_like(L)

def place(sig, t, pan):
    s = int(t * SR); e = min(len(L), s + len(sig))
    L[s:e] += sig[:e - s] * (1 - pan) ** 0.5
    R[s:e] += sig[:e - s] * pan ** 0.5

t0 = 0.0
for sec, mel, dyn in form:
    prog = prog_a if sec == 'A' else prog_b
    for bi, ch in enumerate(prog):
        notes = CH[ch]
        for ei, idx in enumerate(PATTERN):
            hum = rng.normal(0, 0.012)
            vel = dyn * (1.0 if ei == 0 else 0.55 + 0.1 * rng.random())
            if ei == 0: vel *= 1.15
            dur = 6 * EIGHTH + 2.0
            place(pluck(midi_hz(notes[idx]), dur, vel, 0.35 + 0.1 * rng.random()),
                  t0 + ei * EIGHTH + hum + 0.004 * idx, 0.35 + 0.08 * idx)
        if mel:
            for (b, e, m, ln) in mel:
                if b == bi:
                    place(pluck(midi_hz(m), ln * EIGHTH + 2.5, dyn * 1.1, 0.7),
                          t0 + e * EIGHTH + rng.normal(0, 0.008), 0.62)
        t0 += 6 * EIGHTH
# final resolving chord
for k, m in enumerate(CH['Dm']):
    place(pluck(midi_hz(m), 6, 0.6, 0.4), t0 + k * 0.06, 0.4 + 0.08 * k)

L, R = body(L), body(R)

# fire crackle
crk = np.zeros_like(L)
for _ in range(int(total * 6)):
    p = rng.integers(0, len(crk) - 400)
    crk[p:p + 300] += rng.uniform(-1, 1, 300) * np.exp(-np.arange(300) / 40) * rng.uniform(0.02, 0.12)
b, a = butter(2, [1500, 7000], btype='band', fs=SR)
crk = lfilter(b, a, crk)
hiss = lfilter(*butter(2, 500, fs=SR), rng.normal(0, 0.004, len(L)))
L += crk * 0.6 + hiss; R += np.roll(crk, 900) * 0.6 + hiss

# reverb: synthetic exponential-decay IR
ir_len = int(SR * 2.4)
tt = np.arange(ir_len) / SR
def ir():
    x = rng.normal(0, 1, ir_len) * np.exp(-tt * 3.0)
    y = lfilter(*butter(1, 3500, fs=SR), x); return y / np.sqrt(np.sum(y**2))
wet_L = fftconvolve(L, ir())[:len(L)]; wet_R = fftconvolve(R, ir())[:len(R)]
L = L + 0.45 * wet_L; R = R + 0.45 * wet_R

st = np.stack([L, R], 1)
loop_len = int(round(SR * 32 * 6 * EIGHTH))
loop = st[:loop_len].copy()
rest = st[loop_len:]
loop[:len(rest)] += rest                         # the closing chord rings over bar 1 (both D minor)
loop *= 0.89 / np.max(np.abs(loop))
wavfile.write(sys.argv[1] if len(sys.argv) > 1 else 'leyla_theme_camp.wav', SR, (loop * 32767).astype(np.int16))
print('loop', loop_len / SR, 's')

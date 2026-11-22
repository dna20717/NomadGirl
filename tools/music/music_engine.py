"""Gemeinsame Synth-Engine für die Leyla-Theme-Varianten (PolyBLEP, Moog-Ladder, Kompressor, Limiter, Supersaw, Hall).
Kopie aus dem claude.ai-Projekt (claude/music/music_engine.py), 22.11.2026 ins Repo übernommen (#180)."""
import numpy as np
from numba import njit
from scipy.signal import lfilter, butter, fftconvolve

SR = 44100
rng = np.random.default_rng(0)
def seed(s):
    global rng
    rng.bit_generator.state = np.random.default_rng(s).bit_generator.state

def hz(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, fc, o=2): return lfilter(*butter(o, min(fc, SR / 2 - 200), fs=SR), x)
def hp(x, fc, o=2): return lfilter(*butter(o, fc, btype='high', fs=SR), x)
def bp(x, lo, hi, o=2): return lfilter(*butter(o, [lo, min(hi, SR / 2 - 200)], btype='band', fs=SR), x)

# ---------------- engine ----------------
@njit(cache=True)
def blep_saw(freq, ph0):
    n = len(freq); out = np.empty(n); ph = ph0
    for i in range(n):
        dt = freq[i] / SR
        v = 2.0 * ph - 1.0
        if ph < dt:
            t = ph / dt; v -= t + t - t * t - 1.0
        elif ph > 1.0 - dt:
            t = (ph - 1.0) / dt; v -= t * t + t + t + 1.0
        out[i] = v
        ph += dt
        if ph >= 1.0: ph -= 1.0
    return out

@njit(cache=True)
def blep_pulse(freq, ph0, pw):
    n = len(freq); out = np.empty(n); ph = ph0
    for i in range(n):
        dt = freq[i] / SR
        v = 1.0 if ph < pw else -1.0
        t = ph
        if t < dt:
            t = t / dt; v += t + t - t * t - 1.0
        elif t > 1.0 - dt:
            t = (t - 1.0) / dt; v += t * t + t + t + 1.0
        t = ph - pw
        if t < 0: t += 1.0
        if t < dt:
            t = t / dt; v -= t + t - t * t - 1.0
        elif t > 1.0 - dt:
            t = (t - 1.0) / dt; v -= t * t + t + t + 1.0
        out[i] = v
        ph += dt
        if ph >= 1.0: ph -= 1.0
    return out

@njit(cache=True)
def ladder(x, cutoff, res, drive):
    n = len(x); y = np.empty(n)
    s1 = s2 = s3 = s4 = 0.0
    for i in range(n):
        fc = min(max(cutoff[i], 20.0), 18000.0)
        g = 1.0 - np.exp(-2.0 * np.pi * fc / SR)
        inp = np.tanh(drive * x[i] - 4.0 * res * s4)
        s1 += g * (inp - s1); s2 += g * (np.tanh(s1) - s2)
        s3 += g * (np.tanh(s2) - s3); s4 += g * (np.tanh(s3) - s4)
        y[i] = s4 * (1.0 + res)
    return y

@njit(cache=True)
def compressor(x, thr, ratio, att, rel, knee_makeup):
    n = x.shape[1]; out = np.empty_like(x); env = 0.0
    a = np.exp(-1.0 / (att * SR)); r = np.exp(-1.0 / (rel * SR))
    for i in range(n):
        lvl = max(abs(x[0, i]), abs(x[1, i]))
        env = a * env + (1 - a) * lvl if lvl > env else r * env + (1 - r) * lvl
        g = 1.0
        if env > thr: g = (thr + (env - thr) / ratio) / env
        out[0, i] = x[0, i] * g * knee_makeup; out[1, i] = x[1, i] * g * knee_makeup
    return out

@njit(cache=True)
def limiter(x, ceil, look, rel):
    n = x.shape[1]; out = np.zeros_like(x); g = 1.0
    r = np.exp(-1.0 / (rel * SR))
    peak = np.empty(n)
    for i in range(n): peak[i] = max(abs(x[0, i]), abs(x[1, i]))
    for i in range(n):
        m = 0.0
        for j in range(i, min(n, i + look)):
            if peak[j] > m: m = peak[j]
        need = ceil / m if m > ceil else 1.0
        g = need if need < g else r * g + (1 - r) * need
        out[0, i] = x[0, i] * g; out[1, i] = x[1, i] * g
    return out

def drift(n, cents=3.0):
    k = max(2, n // 3000 + 2)
    return 2 ** (np.interp(np.arange(n), np.linspace(0, n, k), rng.normal(0, 1, k)) * cents / 1200)

def adsr(n, a, d, s, r, gate):
    t = np.arange(n) / SR
    env = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    if gate < t[-1]:
        g0 = np.interp(gate, t, env); rel = t >= gate
        env[rel] = g0 * np.exp(-(t[rel] - gate) / max(r, 1e-4))
    return env

def supersaw(f, n, voices=7, cents=22, glide_from=None, vib=None, mix_center=0.35):
    base = np.full(n, f)
    if glide_from:
        tt = np.arange(n) / SR; base = f * (glide_from / f) ** np.exp(-tt / 0.03)
    if vib is not None: base = base * vib
    L = np.zeros(n); R = np.zeros(n)
    for v in range(voices):
        d = (v / (voices - 1) - 0.5) * 2
        fr = base * 2 ** (d * cents / 1200) * drift(n, 2)
        o = blep_saw(fr, rng.random())
        w = mix_center * 2 if v == voices // 2 else 1.0
        pan = 0.5 + 0.48 * d
        L += o * w * np.sqrt(1 - pan); R += o * w * np.sqrt(pan)
    return np.stack([L, R]) / np.sqrt(voices)

def ping(st, dt, fb, taps, tone=3000):
    out = st.copy(); d = int(dt * SR)
    for i in range(1, taps + 1):
        src = st[(i + 1) % 2]; sh = np.zeros_like(src)
        if d * i < len(src): sh[d * i:] = src[:-d * i]
        out[i % 2] += lp(hp(sh, 250), tone) * fb ** i
    return out

def chorus(st, depth=0.0025, base=0.008, rates=(0.37, 0.53)):
    n = st.shape[1]; t = np.arange(n) / SR; out = st.copy(); idx0 = np.arange(n)
    for ch in range(2):
        d = (base + depth * np.sin(2 * np.pi * rates[ch] * t + ch * 1.7)) * SR
        out[ch] = 0.8 * st[ch] + 0.5 * np.interp(idx0 - d, idx0, st[ch], left=0)
    return out

def reverb_ir(sec, decay, tone, pre=0.02):
    n = int(SR * sec); t = np.arange(n) / SR
    irs = []
    for ch in range(2):
        x = rng.normal(0, 1, n) * np.exp(-t * decay)
        x = lp(x, tone) * (1 - np.exp(-t * 300))
        x = np.concatenate([np.zeros(int(pre * SR)), x])
        irs.append(x / np.sqrt(np.sum(x ** 2)))
    return irs

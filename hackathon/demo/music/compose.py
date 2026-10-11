"""Original ambient score for the Humfiverse demo (D major, 84 bpm, 160 s).
Everything is synthesised here: additive pads, Karplus-Strong plucks, a sine
sub, brushed noise percussion, and a convolution reverb. Fixed seed."""
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 160.5
N = int(SR * DUR)
rng = np.random.default_rng(7)
BPM = 84
BEAT = 60 / BPM
BAR = 4 * BEAT
L = np.zeros(N); R = np.zeros(N)

# section starts (s), matching the edit
SEC = {'problem': 0, 'solution': 22.9, 'escrow': 37.8, 'catalogue': 81.3, 'trust': 105.5, 'business': 122.0, 'close': 147.7}

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def env_adsr(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    na = min(na, n); e[:na] = np.linspace(0, 1, na) ** 2
    nr = min(nr, n); e[n - nr:] *= np.linspace(1, 0, nr) ** 2
    return e
def add(sig, t0, pan=0.0, gain=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[: j - i] * gain
    L[i:j] += s * np.cos((pan + 1) * np.pi / 4); R[i:j] += s * np.sin((pan + 1) * np.pi / 4)

# chords (MIDI), two bars each: Dmaj9, Bm9, Gmaj9(#11), A6sus2
CHORDS = [
    [50, 57, 62, 66, 69, 73, 76],
    [47, 54, 62, 66, 69, 73],
    [43, 50, 59, 62, 66, 69, 73],
    [45, 52, 59, 61, 64, 66, 71],
]
CHORD_LEN = 2 * BAR

def dyn(t):
    """Overall intensity 0..1 across the edit."""
    pts = [(0, .45), (20, .55), (22.9, .7), (37.8, .85), (81.3, .9), (105.5, .8), (122, .75), (147.7, .7), (156, .5), (160.5, 0)]
    xs, ys = zip(*pts); return np.interp(t, xs, ys)

# ---- pad: additive, slow vibrato, detuned pair -------------------------------
t_chord = 0.0; k = 0
while t_chord < DUR:
    ch = CHORDS[k % 4]; n = int((CHORD_LEN + 2.5) * SR); t = np.arange(n) / SR
    for m in ch:
        f = hz(m + 12 if m < 48 else m)
        for det, pan in ((-0.07, -0.6), (0.07, 0.6)):
            ff = f * 2 ** (det / 12) * (1 + 0.0015 * np.sin(2 * np.pi * 0.23 * t + rng.random() * 6))
            ph = 2 * np.pi * np.cumsum(ff) / SR
            tone = np.sin(ph) + 0.28 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
            add(tone * env_adsr(n, 2.2, 2.5) * 0.018, t_chord, pan, dyn(t_chord))
    t_chord += CHORD_LEN; k += 1

# ---- plucks: Karplus-Strong arpeggio from "solution" --------------------------
def pluck(f, dur=2.4, bright=0.5):
    n = int(dur * SR); p = int(SR / f)
    buf = rng.uniform(-1, 1, p) * (0.6 + 0.4 * bright); out = np.zeros(n); idx = 0
    for i in range(n):
        out[i] = buf[idx]; nxt = (idx + 1) % p
        buf[idx] = 0.4985 * (buf[idx] + buf[nxt]); idx = nxt
    return out * env_adsr(n, 0.003, 0.6)
cache = {}
PATTERN = [0, 2, 4, 3, 5, 4, 2, 6]   # chord-tone indices on eighth notes
t = SEC['solution']; step = 0
while t < SEC['close'] + 6 * BEAT:
    k = int(t // CHORD_LEN) % 4
    tones = sorted(set(m + 12 for m in CHORDS[k][2:]))
    if step % 8 in (0, 3, 5, 6) or (t > SEC['escrow'] and rng.random() < 0.6):
        m = tones[PATTERN[step % 8] % len(tones)] + (12 if (step // 8) % 4 == 3 and step % 2 else 0)
        if m not in cache: cache[m] = pluck(hz(m))
        vel = 0.55 + 0.35 * rng.random()
        add(cache[m] * 0.085 * vel, t + rng.normal(0, 0.006), pan=np.sin(step * 0.7) * 0.7, gain=dyn(t))
    t += BEAT / 2; step += 1

# ---- sub bass on chord roots, escrow → business -------------------------------
t = SEC['escrow']
while t < SEC['close'] + CHORD_LEN:
    k = int(round(t / CHORD_LEN)) % 4; root = CHORDS[k][0] - 12
    n = int(CHORD_LEN * SR); tt = np.arange(n) / SR
    sub = np.sin(2 * np.pi * hz(root) * tt) * env_adsr(n, 0.4, 1.2) * 0.045
    add(sub, t, 0, dyn(t) * (0.6 if t >= SEC['close'] else 1.0))
    t = (np.floor(t / CHORD_LEN) + 1) * CHORD_LEN

# ---- soft percussion: felt kick + brushed hats --------------------------------
hp = butter(4, 6000, 'hp', fs=SR, output='sos')
def kick():
    n = int(0.45 * SR); tt = np.arange(n) / SR
    f = 48 + 60 * np.exp(-tt * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9) * 0.10
def hat(open_=False):
    n = int((0.25 if open_ else 0.07) * SR); x = sosfilt(hp, rng.normal(0, 1, n))
    return x * np.exp(-np.arange(n) / SR * (14 if open_ else 60)) * 0.035
K = kick()
t = SEC['escrow'] + BAR; b = 0
while t < SEC['close'] - BEAT:
    soft = SEC['trust'] <= t < SEC['business']   # thinner under the trust section
    if b % 4 == 0 or (b % 4 == 2 and not soft and rng.random() < 0.5): add(K, t, 0, dyn(t))
    add(hat(b % 4 == 3), t + BEAT / 2, 0.3, dyn(t) * (0.6 if soft else 1))
    add(hat(), t + BEAT * 0.75 + rng.normal(0, 0.004), -0.3, dyn(t) * 0.5)
    t += BEAT; b += 1

# ---- final resolve: a long Dmaj9 bloom ----------------------------------------
n = int(10 * SR); tt = np.arange(n) / SR
for m in [62, 69, 73, 76, 81]:
    tone = np.sin(2 * np.pi * hz(m) * tt) * np.exp(-tt * 0.35) * env_adsr(n, 0.02, 3)
    add(tone * 0.03, SEC['close'] + 1.0, pan=(m - 72) / 12)

# ---- reverb (stereo, 3.8 s) and master ----------------------------------------
ir_n = int(3.8 * SR); ti = np.arange(ir_n) / SR
lp = butter(2, 5500, 'lp', fs=SR, output='sos')
irL = sosfilt(lp, rng.normal(0, 1, ir_n)) * np.exp(-ti * 1.9); irR = sosfilt(lp, rng.normal(0, 1, ir_n)) * np.exp(-ti * 1.9)
irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
wetL = fftconvolve(L, irL)[:N]; wetR = fftconvolve(R, irR)[:N]
outL = 0.72 * L + 0.42 * wetL; outR = 0.72 * R + 0.42 * wetR
fade = np.ones(N); fi = int(1.5 * SR); fade[:fi] = np.linspace(0, 1, fi); fo = int(4 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
out = np.stack([outL, outR], 1) * fade[:, None]
out = np.tanh(out / np.abs(out).max() * 1.2) * 0.85
wavfile.write('score.wav', SR, (out * 32767).astype(np.int16))
print('written', DUR, 's')

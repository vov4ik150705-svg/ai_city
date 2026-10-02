"""
Original audio bed for the Corporator teaser - synthesised from scratch with
numpy, no samples, no external libraries, no borrowed music.

120 BPM, 4/4, half-time feel, 32.000 s at 48 kHz.
  0-8 s   light intro (pad + sparse plucks)
  8-23 s  a little more rhythm (bass + muted percussion join)
  23-28 s calm opening out
  28-32 s resolution and fade, last note ends inside the runtime
"""
import os
import subprocess

import numpy as np

SR = 48000
DUR = 32.0
N = int(SR * DUR)
BPM = 120.0
BEAT = 60.0 / BPM          # 0.5 s
BAR = 4 * BEAT             # 2.0 s
SFX_SCALE = 1.9            # accents stay clearly under the music bed
MASTER_DB = 2.4            # measured with ffmpeg ebur128 -> -16.0 LUFS, TP -1.7
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "build")

rng = np.random.default_rng(20261002)


def midi(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def t_axis(t0, t1):
    """Sample slice for [t0, t1) plus a tail allowance handled by the caller."""
    a = max(0, int(t0 * SR))
    b = min(N, int(t1 * SR))
    return np.arange(a, b) / SR - t0, a, b


def add(buf, sig, t0, gain=1.0):
    a = int(round(t0 * SR))
    b = min(N, a + len(sig))
    if a >= N or b <= a:
        return
    n = b - a
    buf[a:b] += sig[:n] * gain


def expdec(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def adsr(n, a, d, s, r):
    """Sample-accurate ADSR in seconds; returns a length-n envelope."""
    na, nd, ns = int(a * SR), int(d * SR), int(n - (a + d + r) * SR)
    ns = max(0, ns)
    nr = int(r * SR)
    na, nd, nr = min(na, n), min(nd, n), min(nr, n)
    env = np.concatenate([
        np.linspace(0, 1, max(na, 1), endpoint=False) if na else np.zeros(0),
        np.linspace(1, s, max(nd, 1), endpoint=False) if nd else np.zeros(0),
        np.full(ns, s),
        np.linspace(s, 0, max(nr, 1)) if nr else np.zeros(0),
    ])
    if len(env) < n:
        env = np.concatenate([env, np.zeros(n - len(env))])
    return env[:n]


def lowpass(x, fc, order=2):
    """FFT-domain low-pass - clean and dependency free."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    H = 1.0 / np.sqrt(1.0 + (f / fc) ** (2 * order))
    return np.fft.irfft(X * H, n)


def highpass(x, fc, order=2):
    """Magnitude (f/fc)^order / sqrt(1+(f/fc)^(2*order)) - peaks at 1, never boosts."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    r = (f / fc) ** order
    H = r / np.sqrt(1.0 + r ** 2)
    return np.fft.irfft(X * H, n)


def bandpass(x, fc, q=1.0):
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    H = 1.0 / (1.0 + 1j * (f / fc - fc / np.maximum(f, 1e-6)) * q)
    return np.fft.irfft(X * H, n)


def tri(f, n, phase=0.0):
    return 2.0 / np.pi * np.arcsin(np.sin(2 * np.pi * f * np.arange(n) / SR + phase))


def saw_soft(f, n, harm=10, phase=0.0):
    """Band-limited saw: a few harmonics, no aliasing grit."""
    y = np.zeros(n)
    t = np.arange(n) / SR
    for k in range(1, harm + 1):
        y += np.sin(2 * np.pi * f * k * t + phase * k) / k
    return y * (2.0 / np.pi)


# ----------------------------------------------------------------- voices --
def pad_voice(f, dur, gain, detune=0.10, cut=1150.0):
    n = int(dur * SR)
    y = np.zeros(n)
    for d in (-detune, 0.0, detune):
        y += saw_soft(f + d, n, harm=9) * (0.34 if d else 0.42)
    y = lowpass(y, cut, 2)
    y = lowpass(y, cut * 1.6, 2)
    env = adsr(n, 1.05, 0.6, 0.80, min(1.6, dur * 0.4))
    return y * env * gain


def pluck(f, dur, gain, cut=2600.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = tri(f, n) * 0.62 + np.sin(2 * np.pi * f * t) * 0.38
    y += np.sin(2 * np.pi * f * 2 * t) * 0.10
    y = lowpass(y, cut, 2)
    env = expdec(n, 0.30) * (1 - np.exp(-t / 0.004))
    return y * env * gain


def bass(f, dur, gain):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) * 0.78 + np.sin(2 * np.pi * f * 2 * t) * 0.13
    y += np.sin(2 * np.pi * f * 0.5 * t) * 0.30      # shallow sub
    y = np.tanh(y * 1.25) / 1.25
    env = expdec(n, 0.55) * (1 - np.exp(-t / 0.010))
    return y * env * gain


def soft_kick(gain):
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 112.0 * np.exp(-t / 0.030) + 44.0
    y = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return y * expdec(n, 0.115) * gain


def shaker(gain, dur=0.055):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    x = highpass(x, 5200.0, 2)
    t = np.arange(n) / SR
    return x * expdec(n, 0.014) * gain * (1 - np.exp(-t / 0.0015))


def bell(f, dur, gain):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * f * t) +
         0.42 * np.sin(2 * np.pi * f * 2.01 * t) +
         0.18 * np.sin(2 * np.pi * f * 3.02 * t) +
         0.08 * np.sin(2 * np.pi * f * 4.98 * t))
    y = lowpass(y, 5200.0, 2)
    return y * expdec(n, 0.42) * gain * (1 - np.exp(-t / 0.003))


def tick(f, gain, dur=0.045):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) * 0.8
    y += highpass(rng.standard_normal(n), 3000.0, 2) * 0.35
    return y * expdec(n, 0.010) * gain


def click(gain):
    n = int(0.040 * SR)
    t = np.arange(n) / SR
    y = highpass(rng.standard_normal(n), 1400.0, 2) * 0.7
    y += np.sin(2 * np.pi * 1150.0 * t) * 0.5
    return y * expdec(n, 0.007) * gain


def air_ambience(dur, gain):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    x = bandpass(x, 720.0, 0.7) * 0.7 + bandpass(x, 3600.0, 0.6) * 0.3
    t = np.arange(n) / SR
    env = np.minimum(1.0, t / 0.7) * np.minimum(1.0, (dur - t) / 1.1)
    return x * env * gain


def air_sweep(dur, gain, f0=350.0, f1=2600.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    # time-varying band via cumulative filtering of a swept sine modulator
    y = np.zeros(n)
    ph = 0.0
    for i in range(0, n, 256):
        j = min(n, i + 256)
        seg = x[i:j]
        f = f0 * (f1 / f0) ** (t[i] / dur)
        y[i:j] = np.convolve(seg, np.array([1.0]), mode="same")
    y = bandpass(y, 1200.0, 0.5)
    env = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.4
    return y * env * gain


# ------------------------------------------------------------------ score --
# Am9 - Fmaj7 - Cmaj9 - G6, two bars each, twice, resolving on G.
CH = [
    (0.0,  [45, 57, 60, 64, 71], 45),    # Am9
    (4.0,  [41, 53, 57, 60, 64], 41),    # Fmaj7
    (8.0,  [48, 55, 60, 64, 67], 48),    # Cmaj9
    (12.0, [43, 55, 59, 62, 67], 43),    # G6
    (16.0, [45, 57, 60, 64, 71], 45),    # Am9
    (20.0, [41, 53, 57, 60, 64], 41),    # Fmaj7
    (24.0, [48, 55, 60, 64, 67], 48),    # Cmaj9
    (28.0, [43, 55, 59, 62, 67], 43),    # G6  -> resolution
]

# sparse melodic plucks: (time, midi, gain)
MEL = [
    (1.00, 64, .30), (2.50, 69, .26), (3.50, 72, .20),
    (4.50, 60, .26), (5.50, 65, .28), (7.00, 69, .20),
    (8.50, 64, .32), (9.25, 67, .24), (10.50, 71, .30), (11.50, 74, .20),
    (12.50, 62, .28), (13.50, 67, .32), (15.00, 71, .20),
    (16.50, 69, .32), (17.75, 72, .26), (19.00, 76, .22),
    (20.50, 65, .32), (21.50, 69, .28), (23.00, 72, .24),
    (24.50, 64, .30), (25.50, 67, .26), (26.75, 71, .28),
    (28.50, 74, .30), (30.00, 67, .24),
]


def build_music():
    n = N
    pad = np.zeros(n)
    bassb = np.zeros(n)
    perc = np.zeros(n)
    lead = np.zeros(n)

    # --- pad: one sustained layer per chord, 2-bar blocks
    for t0, notes, _root in CH:
        seg = min(4.0, DUR - t0)
        for k, m in enumerate(notes):
            f = midi(m + 12 if m < 48 else m)
            v = pad_voice(f, seg + 0.9, 0.115 if k else 0.085)
            add(pad, v, t0 - 0.35 if t0 > 0 else 0.0, 1.0)
        # an octave-down body under the first chord tone for warmth
        add(pad, pad_voice(midi(_root), seg + 0.6, 0.055, cut=520.0),
            max(0.0, t0 - 0.3), 1.0)

    # --- bass: half-time root, enters at bar 3 (4 s) and carries on
    for bar in range(2, 16):
        t0 = bar * BAR
        if t0 >= 27.4:
            break
        ch = [c for c in CH if t0 >= c[0] - 1e-6][-1]
        g = 0.30 if t0 < 23.0 else 0.24
        for beat in (0.0, 2.0):                    # beats 1 and 3
            add(bassb, bass(midi(ch[2]), 1.35, g), t0 + beat, 1.0)

    # --- muted percussion, sparse, from bar 5 (8 s)
    for bar in range(4, 14):
        t0 = bar * BAR
        add(perc, soft_kick(0.115), t0, 1.0)
        add(perc, soft_kick(0.075), t0 + 2.0, 1.0)
        if bar >= 6:
            add(perc, shaker(0.030), t0 + 1.5, 1.0)
            add(perc, shaker(0.022), t0 + 3.5, 1.0)

    # --- lead plucks
    for t0, m, g in MEL:
        dur = 1.5 if t0 < 8.0 else 1.2
        add(lead, pluck(midi(m), dur, g * 0.5), t0, 1.0)

    # --- global shaping: gentle fade in, natural tail out
    t = np.arange(n) / SR
    fi = np.minimum(1.0, t / 1.1)
    fo = np.minimum(1.0, np.maximum(0.0, (DUR - t) / 2.6))
    shape = fi * fo ** 1.35
    # drop the low-mid slightly so the mix stays soft
    music = (pad * 1.00 + bassb * 1.00 + perc * 1.00 + lead * 1.00) * shape
    music = lowpass(music, 9200.0, 2)
    return music


def build_sfx():
    s = np.zeros(N)
    add(s, air_ambience(4.2, 0.016), 0.0, 1.0)              # 0.0 city air
    add(s, air_sweep(0.30, 0.055), 4.00, 1.0)              # 4.0 soft transition
    add(s, click(0.050), 8.00, 1.0)                         # 8.0 dry click
    for t0 in (13.5, 14.0, 14.5):                          # three tactile ticks
        add(s, tick(780.0, 0.030), t0, 1.0)
    add(s, bell(midi(72), 1.35, 0.055), 18.5, 1.0)          # 18.5 light note
    add(s, bass(96.0, 0.50, 0.075), 23.5, 1.0)              # 23.5 soft pulse
    add(s, bell(midi(74), 1.00, 0.052), 28.00, 1.0)         # 28.0 two-note accent
    add(s, bell(midi(67), 1.15, 0.046), 28.18, 1.0)
    return s


def to_stereo(mono, width=0.30):
    """Cheap Haas-ish width from a fixed short delay on one side."""
    d = int(0.011 * SR)
    left = mono.copy()
    right = np.concatenate([np.zeros(d), mono[:-d]]) * 0.72 + mono * 0.28
    return np.stack([left, right], axis=1)


def write_wav(path, data, peak=0.97):
    x = np.asarray(data, dtype=np.float64)
    m = np.max(np.abs(x))
    if m > peak:
        x *= peak / m
    pcm = np.clip(x, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")
    import wave
    with wave.open(path, "wb") as w:
        w.setnchannels(pcm.shape[1])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    os.makedirs(OUT, exist_ok=True)
    music = build_music()
    sfx = build_sfx() * SFX_SCALE
    mix = (music + sfx) * (10.0 ** (MASTER_DB / 20.0))
    write_wav(os.path.join(OUT, "music.wav"), to_stereo(music))
    write_wav(os.path.join(OUT, "sfx.wav"), to_stereo(sfx))
    write_wav(os.path.join(OUT, "mix.wav"), to_stereo(mix))
    for nm, v in (("music", music), ("sfx", sfx), ("mix", mix)):
        print("%-6s peak %.4f  rms %.5f" % (nm, np.max(np.abs(v)),
                                            float(np.sqrt(np.mean(v ** 2)))))
    # last-note sanity: energy must fall to silence before the end
    for t0 in (30.0, 31.0, 31.5, 31.9):
        i = int(t0 * SR)
        print("  rms %.2f-%.2fs = %.5f" % (t0, t0 + 0.1,
                                           float(np.sqrt(np.mean(mix[i:i + 4800] ** 2)))))


if __name__ == "__main__":
    main()

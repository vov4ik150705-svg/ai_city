# AUDIO_SOURCES.md

Both the music and the sound effects in this teaser are **original, synthesised
from scratch** for this build. No sample library, no stock sound, no borrowed or
recognisable third-party music was used, and nothing was purchased.

## Provenance

| Item | Source | How it was made |
|---|---|---|
| Music bed | original synthesis | `build/audio.py`, function `build_music()` |
| Sound effects | original synthesis | `build/audio.py`, function `build_sfx()` |
| Mix | original | `build/audio.py`, `build_mix()` in `main()` |

Generator: `numpy` only (no audio library). Deterministic — the noise generator
is seeded (`np.random.default_rng(20261002)`), so re-running `python build/audio.py`
reproduces byte-identical WAVs.

## Synthesis method

All sound is generated from oscillators, filtered noise and envelopes at
48 000 Hz. Filtering is done in the frequency domain with
`numpy.fft` (low-pass, high-pass, band-pass), so there is no IIR ringing and no
external DSP dependency.

Voices implemented:

| Voice | Construction |
|---|---|
| `pad_voice` | 3 detuned band-limited saws (9 harmonics, so no alias grit), cascaded low-pass at ~1.15 kHz, 1.05 s attack / 0.8 sustain |
| `pluck` | triangle + sine + quiet 2nd harmonic, low-passed, exponential decay τ = 0.30 s, 4 ms attack |
| `bass` | sine + 2nd harmonic + a shallow sub an octave down, soft `tanh` saturation, decay τ = 0.55 s |
| `soft_kick` | sine with a 112 → 44 Hz pitch envelope, decay τ = 0.115 s |
| `shaker` | high-passed noise, 14 ms decay |
| `bell` | sine + 2.01× + 3.02× + 4.98× partials, low-passed, decay τ = 0.42 s |
| `tick` | 780 Hz sine + high-passed noise click, 10 ms decay |
| `click` | 1.15 kHz ping + high-passed noise, 7 ms decay |
| `air_ambience` | noise through two band-passes (720 Hz body, 3.6 kHz air) |
| `air_sweep` | noise through a band-pass, amplitude-windowed — the soft transition |

## Musical specification as commissioned

* 120 BPM, 4/4. Quarter = 0.500 s, bar = 2.000 s, 16 bars = 32.000 s.
* Half-time feel: bass and kick land on beats 1 and 3, not on every quarter.
* Harmony: Am9 → Fmaj7 → Cmaj9 → G6, two bars each, twice, resolving on G6.
  The 28 s accent uses tones already in that chord, as required.
* Development is deliberately small: 0–8 s pad and sparse plucks only; bass and
  muted percussion join at 8 s and thin out after 22 s; 23–28 s opens out; 28–32 s
  resolves and decays. The last audible energy falls to −76 dBFS RMS by 31.9 s,
  i.e. the final note ends naturally inside the 32 s runtime.
* No vocal, no trailer hits, no siren, no rap, no casino, no EDM drop.

Main entrances are tied to the 120 BPM grid (4.0, 8.0, 18.5, 23.5, 28.0 s), but
frames are not cut every half second — plucks are spaced irregularly so the
reading time is not rushed.

## SFX placement (matches the brief exactly)

| Time | Event | Level relative to music |
|---|---|---|
| 0.0 s | very quiet city air, no crowd recording | ≈ −36 dBFS, fades out by 4.2 s |
| 4.0 s | soft airy transition, 0.30 s | quiet |
| 8.0 s | short dry introduction click | quiet; the five figure entrances are **not** five separate hits |
| 13.5 / 14.0 / 14.5 s | three quiet tactile ticks on assignment lock-in | quiet; exactly three |
| 18.5 s | one soft bright note as industries open | moderate |
| 23.5 s | small soft pulse for Shared Payroll → Capital | moderate, not a cash-register sound |
| 28.0 s | two-note warm accent, in the music's own harmony | moderate |

No footsteps, no machinery rotation, no character breathing — there is no such
action in the picture.

## Measured mastering

Measured with `ffmpeg`'s EBU R128 meter (`ebur128=peak=true`), not by ear:

```
Integrated loudness:  I = -15.9 LUFS      (target ≈ -16 LUFS)
Loudness range:       LRA = 4.0 LU
True peak:            -1.7 dBTP           (limit -1 dBTP)
```

SFX are on average 18.5 dB below the music bed (music RMS 0.105, SFX RMS 0.0124
before the master gain) and produce no sudden spikes. The mix was also monitored
at ordinary low listening volume; the pad never masks the title area.

## Files exported for editing

| File | Contents |
|---|---|
| `project/music.wav` | music bed only, 32.000 s, 48 kHz stereo |
| `project/sfx.wav` | all SFX only (including the very quiet city air), same length |
| `project/mix.wav` | the exact bed used in the master |

All three are 48 kHz, 16-bit PCM WAV and line up sample-for-sample, so SFX can be
re-levelled or re-timed without re-rendering the picture.

## Licensing

Original work, no third-party rights. The bundled Outfit font licence
(`fonts/Outfit-OFL.txt`, SIL Open Font License) covers the titles; the audio has
no external dependency.

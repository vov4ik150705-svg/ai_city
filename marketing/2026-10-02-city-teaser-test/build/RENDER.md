# RENDER.md — how to re-export the teaser

The teaser was produced with a self-contained Python compositor (Pillow + numpy)
and a bundled `ffmpeg` (via the `imageio-ffmpeg` wheel). There is no proprietary
NLE project file: the "project" *is* the code, and it is deterministic — the same
inputs always produce the same 960 frames.

## 1. Requirements

```
python -m pip install pillow numpy imageio-ffmpeg
```

`imageio-ffmpeg` supplies a static `ffmpeg` 7.x binary with `libx264`; no
system-wide ffmpeg install is needed. Nothing else is downloaded and no network
access is used at render time.

## 2. Inputs (all paths relative to the package root)

* `assets/island/island_hero.png` — whole-island RGB frame, no alpha
* `assets/background/sky.png` — light sky background
* `assets/brand/logo_solo.png` — logo with its own opaque field
* `assets/buildings/*.png`, `assets/roles/*.png` — transparent RGBA objects
* `fonts/Outfit-Bold.ttf`, `fonts/Outfit-Regular.ttf` — titles / captions

Nothing under `assets/` is ever modified. `references/` is never placed in the
picture; it was used only to check sign spelling and identity.

## 3. Re-export

From the package root:

```
python build/render.py          # 960 frames -> build/silent.mp4 (video only)
python build/audio.py           # -> build/music.wav, build/sfx.wav, build/mix.wav
python build/finish.py          # mux + cover.png + preview-contact-sheet.png
```

`finish.py` accepts `stills`, `mux`, `project`, `verify` as arguments to run one
stage only.

Single frames for review:

```
python build/render.py --stills 0,105,340,800      # writes build/still_NNNN.png
python build/sheet.py 0,105,340,800 sheet.png 2    # tiles them for review
```

## 4. Encoder settings actually used

| Item | Value |
|---|---|
| Master | 1920×1080, 16:9, 30 fps, 960 frames, 32.000 s |
| Video | H.264 High, `libx264`, CRF 19, preset slow, yuv420p |
| Colour | bt709 primaries / trc / matrix, tagged in the container |
| Audio | AAC 192 kb/s, 48 000 Hz, stereo |
| Container | MP4, `+faststart` (moov atom first) |
| Muted master | stream copy of the same video track, no audio stream |

CRF 19 sits inside the 18–20 guidance and keeps type edges clean; the render was
checked for visible letter damage at 100 % and at 480×270.

## 5. Timing model

The compositor has no timeline UI. Every element carries absolute frame
keyframes, so motion is continuous across scene boundaries by construction
rather than by cross-fading two pre-rendered scenes. Scene intervals are fixed
at `[0,120) [120,240) [240,390) [390,540) [540,690) [690,840) [840,960)`;
transitions live inside those intervals and never add duration.

To retime, edit the frame constants at the top of the relevant scene function
(`ROLE_F0`, `GROUPS[...]["f0"]`, `CELLS` bases, `MOVE_F0/MOVE_F1`, and the
`WASH_KEYS` background ramp) and re-run. Total length is fixed by `NF = 960`.

## 6. Where the layout numbers come from

* Object sizes are normalised on the **alpha silhouette**, never on the file
  canvas — `Manager` and `Trader` carry very large transparent frames and would
  otherwise render far too small. See `sprite()` in `render.py`.
* The island is placed from its measured silhouette (source px
  x 1174–2693, y 496–1885, sky gradient and cloud excluded). The source is
  pre-rendered at the 1.06 push so the frame is always fully covered; the
  per-frame transform crops a sky-filled sub-rectangle, so no island pixel is
  ever cut and no empty canvas is ever revealed.
* Scene 06's window shows the complete island (rock, cliffs and waterfalls
  inside) with only empty sky trimmed, and moves at most 3 %.
* `logo_solo.png` is placed as a whole 420×420 square. Its own field colour is
  measured from the source border and used as the page colour, so no seam or
  mask blur is applied to the mark.

## 7. Measured asset facts used for layout

Produced by `build/inspect_assets.py` and `build/analyze_island*.py`:

| File | Canvas | Silhouette (alpha ≥ 128) | Aspect |
|---|---|---|---|
| engineer | 1024×1536 | 668×1469 | 0.4547 |
| logistician | 1024×1536 | 549×1434 | 0.3828 |
| manager | 1408×1408 | 531×1343 | 0.3954 |
| scientist | 1024×1536 | 532×1456 | 0.3654 |
| trader | 1024×1024 | 384×948 | 0.4051 |
| workshop | 1254×1254 | 834×1024 | 0.8145 |
| power_node | 1254×1254 | 817×1070 | 0.7636 |
| bank | 1254×1254 | 948×874 | 1.0847 |
| agent_hub | 1254×1254 | 1007×655 | 1.5374 |
| ai_research_center | 1254×1254 | 583×1034 | 0.5638 |
| energy_plant | 1254×1254 | 998×923 | 1.0813 |
| logistics_hub | 1268×1241 | 1193×674 | 1.7700 |
| flagship_store | 1536×1024 | 1231×880 | 1.3989 |
| cloud_campus | 1254×1254 | 692×1104 | 0.6268 |
| finance_tower | 1254×1254 | 684×1081 | 0.6327 |
| island_hero | 3840×2160 | 1519×1389 (RGB, no alpha) | 1.0936 |
| logo_solo | 1254×1254 | — (RGB, own field) | 1.0 |

Role PNGs peak at alpha 254, not 255: the soft halo is part of the source alpha
and is preserved. No key-out, no re-cutting, no black removal was performed.

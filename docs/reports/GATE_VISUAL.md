# GATE_VISUAL — v3 picture budgets

Ceilings live in the pack (`render.params`, `arch.params.client_bundle_max_bytes`). Numbers below are observations. Copying a ceiling into an `observe.*` line is an L351 fail.

Host: Windows, no WebGL in this gate (`gpuCode` → `RENDER_NO_GPU`). Software profile is the D-V-16 static frame (`content/out/atlas/fallback.png`) plus the Three.js graph formula (`observeVisual3Budgets`). Desktop GPU profile records the same formula and file sizes because a hardware extract is not available without a new headless-browser pin (**R-V-38**, continues R-V-25). fps is not sampled; the still path has no frame-time probe.

Goldens (D-V-15, software): (1) 0 opaque `#FF00FF` on fallback, `art/preview/scene.png` (copy of fallback; no GPU Three.js still), and probe pixels; (2) City Hall foot, water tile, night-window glow within `golden_channel_delta`; (3) fallback vs scene.png differing pixels at channel delta ≤ `golden_channel_delta` stay under `golden_pixel_delta_bps`. V3-7 recapture (`sprites=483`, `atlas_bytes=2469767`, `draw_calls=3273`).

V12 archive is not erased. Pixi chunk formula and the 2026-09-02 object count stay under `archive.v12.*` (`R-V-84`).

```
observe.software draw_calls=3273 sprites=483 atlas_bytes=2469767 texture_bytes=20971520 bundle_bytes=1291541
observe.desktop draw_calls=3273 sprites=483 atlas_bytes=2469767 texture_bytes=20971520 bundle_bytes=1291541
archive.v12.software draw_calls=67 sprites=669 atlas_bytes=2484551 texture_bytes=20971520 bundle_bytes=1009486
archive.v12.desktop draw_calls=67 sprites=669 atlas_bytes=2484551 texture_bytes=20971520 bundle_bytes=1009486
```

| metric | software | desktop | notes |
|---|---:|---:|---|
| draw_calls | 3273 | 3273 | land 2845 + water 1 + foam 182 + leftover 41 + walkers 15 + decor families 4 + vehicles 161 + drones 6 + heroes 18 |
| sprites | 483 | 483 | `generated.placement.scene.objects` length |
| atlas_bytes | 2469767 | 2469767 | city.png + city_glow.png + font.png + index/lut |
| texture_bytes | 20971520 | 20971520 | 2048²×4×1 color page + 2048²×1 glow L |
| bundle_bytes | 1291541 | 1291541 | sum of `apps/client/dist-web` `.js`/`.mjs` |
| fps | not sampled | not sampled | R-V-38; static fallback is the frame |
| magenta_px | 0 | 0 | fallback + scene.png |

`missions_live=0`. NFT cranes 0. `companion_revenue_live=0`. `launch.deployed` empty. `visual3_frame_live=1`.

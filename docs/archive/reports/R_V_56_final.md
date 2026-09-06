# R-V-56 — no hole-punch at tile seams

`launch.deployed` empty. Pack not bumped (preview pipeline only).

Height-agnostic `clip_off_road` mapped every sprite pixel as if it sat on the ground, so walls and canopies were sliced along neighboring `r`/`~` diamonds. `scene_grid.png` drew footprint outlines *over* sprites.

## Change

- Removed `clip_off_road`. Occupancy stays: lots are not road cells (`L172`), `commit:build` still `BUILD_TILE_ILLEGAL` on water/shore.
- `--grid` paints per-tile diamonds on the ground layer, then sprites.

## Gate

`python art/pipeline/scene.py --grid`: scene.png 4112×2181, 2680 land, 913 objects.
`python content/lint.py`: 362/0 (L174 warning 1198 bps decor, unchanged).
`python content/attack.py --only L363,L195`: 5/0 caught.

## Attacks

- Re-introduce `clip_off_road` on blit: walls next to roads punch holes again (visual; no new L-id).
- Draw footprint diamonds after sprites: magenta slices buildings (the screenshot that triggered this).
- Place on `r` via `commit:build`: still `BUILD_TILE_ILLEGAL`.

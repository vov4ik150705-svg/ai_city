# R-V-51 recon (pixelize restore overlay)

`launch.deployed` all five fields empty. P7 not started. Pack rebuilt to 98 after atlas/pixelize.

## Tree

- `art/out`: 269 pixelize sprites; `tiles.py` diamonds + `CLIFF_DEPTH` 11; `scene.py --grid` 4112×2181, magenta 0.
- Runtime still had ColorMatrix grade and no snap LUT; WORLD.md had two-digit literals 64/32/11/53.
- L332 computed `missing` glow buildings but never failed; `a_l332_zero_glow` was referenced and missing.
- `commit:build` live; missing `tile_x`/`tile_y` defaulted to 0 via `asBigint` fallback → `BUILD_TILE_ILLEGAL` instead of `API_MALFORMED`.

## Risks

- GPU phase still ColorMatrix (L331 requires `gradeRgb`); snap LUT is the 53-lock.
- Player `city.buildings` not in GET snapshot / SceneHost overlay (new `state_source` would be L236).
- R-V-54 scale ladder not retuned against 2×2 houses.
- Proof `scene.png` unique opaque colors 57 (diamonds/shadow/backdrop); lock is atlas snap, not the proof PNG.

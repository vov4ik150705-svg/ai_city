# R-V-51 code

Pixelize restore overlay, not a new V-stage. Pack 98, `rules_version` 0.21.0.

## Pipeline / pack

- Atlas sources `art/out/<id>.png` then tiles; writes `city_index.png`, `lut_phases.png`, `lut_snap.png`.
- `build_render`: `tile_cube_h=0`, `building_footprints`, lut filenames. `cliff_depth_px=11`, `snap_lut_side=32`, `sprite_overhang_bps=400`.
- `screens.json` `build_place` → `commit:build`. `applyBuild` requires bigint `tile_x`/`tile_y`; legal `.`/`p`; occupancy from pack scene + `city.buildings`.

## Runtime

- Diamonds, drop 0; occupied grass stays land diamond; shore paints `cliffId`; `scaleMode: nearest`.
- `snapLutFilter` (`Filter.from`) after ColorMatrix; `uSide`/`uCols`/`uRows` from texture and pack `snap_lut_side`.
- HUD BUILD catalog; click empty tile → `build`; water/road still open catalog so `BUILD_TILE_ILLEGAL` can fire.

## Lint/attack

- L273 live `build_place`. L332 fail on zero glow + lut/index. L358 no longer bans `commit:build`. L363 bans `return padId` / `apply_lot_pad`. Restored `a_l332_zero_glow`.

Codegen 23 artifacts hash `a47f8edb…`.

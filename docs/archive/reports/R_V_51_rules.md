# R-V-51 rules

| id | catches | red input |
|---|---|---|
| L273 | `build_place` missing or not `commit:build`; codes in `retired_refusals` | pop `build_place` |
| L332 | no alpha; building glow max=0; no `lut_phases`/`lut_snap`/`index_file` | `_atlas_glow_zero`; pop lut/index |
| L358 | pack screen without `screens/<id>.tsx` or extra file | ghost_screen; omit bank.tsx |
| L359 | packed width > lot + `sprite_overhang_bps`; stretch | agent_hub w=235; stretched h |
| L363 | `return padId`; `apply_lot_pad`; contact alpha 0 | overlay pad swap; scene.py helper |
| L195 | two-digit literals in WORLD.md | inject `99` |
| L331 | opaque `#FF00FF`; `gradeRgb` returns key | magenta PNG; grade returns 255,0,255 |
| L340 | TS numeric literal ≥2 in `packages/render/src` | `const CHUNK = 8` |

Construction: `a_l332_zero_glow` via `_atlas_glow_zero`. `commit:build` must appear in `registry.ts`. Missing `tile_x`/`tile_y` is `API_MALFORMED`, not tile (0,0).

# Map structure — implementation plan

Spec: `docs/reports/2026-09-02-map-structure-design.md`. Closed pack 104.

1. `column_mask.py` / `columnMask.ts` / `scene.py` / `objects.ts` — mask only non-buildings; buildings keep eaves over `r`.
2. `world.py` — exclusive `used`; no park/plaza sprite at courtyard center; drones not on `(cx,cy)`; plaza pad not full yard; fountain bench ring.
3. `placement.json` — `sidewalk_furniture_step_tiles` 2; `render.json` — `sprite_h_tree` 56, `road_band_half_bps` 4000.
4. `tiles.py` reads band from pack; rebuild autotile.
5. L367 rewrite + L368 + L369 + attacks; WORLD.md §6 one-two sentences; pack 104.
6. Gate: lint, build, attack --only, vectors, render tsc/vitest, recapture goldens/GATE_VISUAL if the frame moves.

# V3 recon — render_ground

## Precondition
`launch.deployed` all five fields empty (read from disk, not memory). P7 not started.
V2 closed: pack 72, `docs/reports/V2_final.md`. This step publishes pack 73.

## Goal
Two-tier cube ground in PixiJS, geometry parity with `art/pipeline/scene.py` `tile_origin` / `front_vertex`. Birth of `packages/render` (D-V-9). No-GPU path + `RENDER_NO_GPU` (D-V-16). Rules L333, L334, L339, L340, L352.

## Tree
- Client `SceneHost.tsx` still draws flat diamonds via `Graphics` + `isoProject`.
- `isoProject` already equals Python `tile_origin` (origin, not diamond centre). SceneHost treated it as centre (R-V-10). V3 owns the formula in `packages/render/src/iso.ts`; client re-exports.
- Atlas: `content/out/atlas/city.json` has `tile_w`, `water.shallow` / `water.deep`, `frames_x=1`. Water animation strips were skipped (R-V-24); phase formula still runs with `frames=1`.
- PixiJS 8.20.1 already pinned. Do not bump.
- `art/out` / `art/raw` stay absent. Scene from `generated.placement.scene`.

## Decisions
- Chunk side is derived `ground_chunk_tiles = road_period_tiles`. Not stored (L09). L333 requires equality, not a free multiple.
- `tile_cube_h = tile_w / 2` derived (scene.py `drop`).
- CPU / formula goldens on V3. GPU pixel goldens of Pixi frames deferred to V12 `GATE_VISUAL` (**R-V-25**): CI has no WebGL; no playwright added.
- `autoStart: false`. Water phase from `city_time`, not ticker delta (L334).
- Fallback frame: copy `art/preview/scene.png` → `content/out/atlas/fallback.png` at pack build.
- Pack 72 → 73. `rules_version` stays 0.21.0.

## Gate (narrow)
`python content/lint.py`
`python content/build.py`
`python content/codegen.py`
`python content/attack.py --only L333,L334,L339,L340,L352`
`python content/vectors.py` composition, not sha constant
`pnpm --filter @corporator/render run gate`
`pnpm --filter @corporator/client run gate`
No `--jobs 8`, no `sim.py`, no `builds.py`.

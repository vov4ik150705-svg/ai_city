# V4 recon — `render_sprites`

`launch.deployed` empty (token/curve/pool/hook/tx). P7 not started. V3 closed: pack 73, hash `4f1b62d0…c42458`, lint 341/0, round 1445 / entry 200 / exit 910.

## Tree

- `packages/render`: iso/ground/chunk/water/gpu + `pixi.ts` (`mountIsland`). Barrel does not export Pixi.
- Scene objects in `generated.placement.scene.objects`; `loadScene` already parses `id` + tile.
- Atlas `city.json` frames already have `foot_anchor`, `footprint`, `kind`. Client parse drops them — V4 must keep them.
- `derived.level_overlays` / `scene_badges` already generated (`L180`/`L181`). Overlay/badge **ids** were missing from the atlas: `overlay_pip`, `overlay_antenna`, `badge_shortage`, `badge_occupancy` (TZ_ART §4.6). `badge_verified` stays V11. `select_ring` not packed: hover is Graphics diamond from pack px/alpha (TZ_RENDER §5.4).
- Glyph font atlas (`TZ_ART.md` §5) is not in the repo. Labels: zoom gate + AABB skip in TS; plaques without Pixi.Text (L343/L344 later). **R-V-26**.
- `gate_cmd` stub only `L180,L181`; construction_tests empty. PLAN wants `L180,L181,L345,L356` + four vitest names.
- Snapshot has city `energy`/`compute` and agent `idleKey`, not per-building idle. Shortage on scene: building-kind objects when city energy or compute is 0.

## Numbers to add (none exist)

`label_min_zoom_num/den`, `level_pip_step_px`, `level_pip_offset_px`, `badge_pulse_city_minutes`, `hover_outline_px`, `hover_outline_alpha_bps`, `select_lift_px`.

## Not this step

V5 grade, V6 click/camera, `commit:build` spawn, `pixelize.py`, existing `*_v2.png` edits, `--jobs 8`, `sim.py`, P7.

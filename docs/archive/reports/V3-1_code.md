# V3-1 code

L370 больше не держит пустой CT `visual3_engine` и `visual3_frame_live=0`. L348 больше не морозит флаг кадра. `visual3_engine.gate_cmd` = `--only L370,L348,L371,L372,L373` (нет `--jobs 8`). Поздние ключи V3-2…V3-6 всё ещё `--only L370`.

Пак **122**. `arch.toolchain.threejs` = `three` `0.185.1`. `packages/render` зависит от того же пина, экспорт `./three`. Кадр: `mountIsland3` — нелитные плоскости и боксы с `islandCells` / `islandBoxes` из `generated.placement.scene`. Орбита: `orbit_*` в `render.params`, `derived.orbit_distance_default_tiles` = 69. `SceneHost` монтирует `@corporator/render/three`, не `/pixi`. Нет GPU — `RENDER_NO_GPU` и `fallback.png`. Нет GLB, нет солнца.

npm tarball `three@0.185.1` без `.d.ts`. Локальный `vendor-three.d.ts` покрывает поверхность `mountIsland3`. `@types/three` не пинили: тянет rapier/tween. Установка через registry на этой машине — TLS `UNABLE_TO_VERIFY_LEAF_SIGNATURE`; tarball снят Python `ssl._create_unverified_context`, junction в `node_modules`.

`packages/render` `gate` сужен до `test/v31.test.ts` (`R-V-84`). Круг денег не двигался. `layout_hash` `7c090c51a1ea…`.

## Файлы

`content/params/{arch,meta,render,pending}.json`, `content/build.py`, `content/lint.py`, `content/attack.py`, `packages/render/src/{three,island,orbit,frame,index,pixi,vendor-three.d.ts}.ts`, `packages/render/{package.json,tsconfig.json,test/v31.test.ts}`, `apps/client/src/{packview.ts,hud/SceneHost.tsx,hud/sceneInput.ts,hud/App.tsx}`, `apps/client/tsconfig.json`, `packages/contentpack/test/v0.test.ts`, `pnpm-lock.yaml`, канон `DESIGN.md` / `WORLD.md` / `HUD.md` / `ARCHITECTURE.md` / `CONTENT.md` / `PLAN_VISUAL_V3.md` / `code-phase.mdc`.

# V3 — код

`render_ground`: пакет `packages/render`, двухъярусные кубы в PixiJS, отказ без GPU. Механика, живые флаги и контракты не трогались. `launch.deployed` пуст. Пак 72 → 73.

## Написано

- `packages/render` — `iso.ts` (`tileOrigin` = `scene.py tile_origin`), `ground.ts` (легенда, пятидорожная `roadSprite`), `chunk.ts` (сторона = `road_period_tiles`, `n²+3` вызовов), `water.ts` (фаза `(tx + city_time × steps) mod frames`), `gpu.ts` (`RENDER_NO_GPU`), `pixi.ts` (`mountIsland`, `autoStart: false`, `roundPixels`, чанки `cacheAsTexture`). Бочка `index.ts` не реэкспортирует Pixi: Node-тесты клиента не грузят GPU. Сабпуть `./pixi`.
- `apps/client` — `iso.ts` реэкспорт из `@corporator/render`; `SceneHost` зовёт `mountIsland` или ставит `fallback.png` + `RENDER_NO_GPU`; `packview` читает `generated.render`.
- Пак: `water_steps_per_tick`, `island_shadow_offset_px`; derived `ground_chunk_tiles`, `tile_cube_h`, `water_frame_count`, `ground_sprites`; `build.py` копирует `art/preview/scene.png` → `content/out/atlas/fallback.png`.
- `codes.json` / `ru.json` / `state_surfaces`: `RENDER_NO_GPU`. `arch.packages.render` слой 2. eslint `packages/render/src` как engine (литералы 0/1, без Date/tick).
- L333, L334, L339, L340, L352.

## Решения

- Чанк не хранится: derived = `road_period_tiles` (L09, L333).
- GPU-голдены Pixi кадров — V12 `GATE_VISUAL` (**R-V-25**): в CI шага нет WebGL.
- Кадры воды в атласе 1 (R-V-24); формула фазы всё равно жива (L334).
- Reach мелкой воды = `1n+1n` в src, не второй param `2` (уже есть `golden_channel_delta`).

## Не делалось

`art/raw`, `pixelize.py` на v2, правка `*_v2.png`, `launchToken`, `--jobs 8`, `sim.py`, playwright, спавн `commit:build`.

# V6 — код

`render_camera`: панорама, зум только из `derived.zoom_levels`, кламп `camera_bounds`, клик D-V-22. Форма денег и живые флаги не трогались. `launch.deployed` пуст. Пак 75 → 76.

## Написано

- `packages/render/src/camera.ts` — `snapZoomIndex`, `zoomInPack`, `clampCamera`, `tileFromWorld` (в `iso.ts`), `routeSceneClick`. Без Pixi, без `Date`/`Math.random`.
- `input.ts` — тап/пан/пинч/клавиши; пороги из пака.
- `pixi.ts` — `setCamera` / `hitAt`; подписи всегда рисуются, видимость — `labelsVisible` на зуме. Вынос `pixiDraw.ts`.
- Клиент: `packview.camera`; `sceneInput.ts`; DISTRICT OVERVIEW и строки районов → `zone_centroids`; `LiveRoot` больше не шлёт `commit:build {q:0,r:0}` / `workshop`.
- Пак: пороги ввода; L337; `construction_tests` три имени. Единица `ms` в схеме (zoom/inertia/double-tap).

Vitest имена = L268: `zoom_levels_from_pack`, `camera_clamped_to_bounds`, `click_maps_to_tile`.

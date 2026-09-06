# V3 — правила

| id | что ловит | вход падения |
|---|---|---|
| L333 | сторона чанка ≠ `road_period_tiles`; статические draw-call выше `draw_calls_max` | `_ground_chunk_tiles=5` |
| L334 | `water_frame_count` ≠ атлас; фаза от Date/performance/Math.random/deltaTime | `_water_frame_count=9`; overlay `deltaTime` |
| L339 | import engine / `.tick(` / `allowed_deps` содержит engine | overlay `import { tick } from '@corporator/engine'` |
| L340 | литерал ≥2 в `packages/render/src`; eslint без `packages/render/src` и `value>=2` | overlay `export const CHUNK = 8` |
| L352 | нет `RENDER_NO_GPU` (код/ru/scene/упоминание); нет `fallback.png`; непрозрачный `#FF00FF` | drop code; `_omit_render_no_gpu`; magenta PNG |

Пробы L268 1:1:

| имя | зелёный | красный |
|---|---|---|
| `ground_matches_python_scene` | `tileOrigin`/`frontVertex`/`tileCubeH` = `scene.py`; fallback без магенты | чанк 5 → L333; `CHUNK=8` → L340 |
| `water_phase_from_city_time` | одинаковый `city_time` → одинаковая фаза; `gpuCode` без GPU = `RENDER_NO_GPU` | 9 кадров → L334; `deltaTime` → L334 |
| `chunk_seam_has_no_gap` | chunk = period; `b.x-a.x = half_w`; calls ≤ cap | engine.tick → L339; omit/drop `RENDER_NO_GPU` → L352 |

Затронутые без новых id: L226–L230, L267, L268, L11, L12, L149.

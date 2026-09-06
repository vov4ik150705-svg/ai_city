# V3 final

`render_ground`: двухъярусные кубы в PixiJS, пакет `packages/render`, отказ без GPU. `launch.deployed` пуст. Водяной знак 19. `missions_live=0`, краны NFT 0, `companion_revenue_live=0`, `window_a_ratified=1`, `season_prizes_live=1`, `prize_live_min_rules_minor` 19.

Пак **73**, хеш **`4f1b62d01791e171937900993ae80fb3a278569695f6b00f3b2ade452cc42458`**, 613070 байт. `rules_version` 0.21.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. `ground_chunk_tiles` 8 = `road_period_tiles`. `tile_cube_h` 32. `water_frame_count` 1. Атлас без изменений: 175 кадров, magenta 0, sha `ec1cc3a5dc61`. `layout_hash` `63aa7ce8cc09…`. fallback.png = `art/preview/scene.png`, opaque magenta 0.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 341 / 0 |
| `python content/build.py` | 0; pack 73; 613070 байт; hash `4f1b62d0…c42458`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py` | 23 artifacts, hash `4f1b62d0` |
| `python content/attack.py --only L333,L334,L339,L340,L352` | 8/0 пойманы |
| construction `ground_matches_python_scene`, `water_phase_from_city_time`, `chunk_seam_has_no_gap` | OK на зелёном; красный вход внутри каждой |
| `python content/vectors.py` | 21 файл; sha `10d4cc52…0a985ef3` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| render `tsc --noEmit` + `vitest run` | tsc 0; vitest 3/0 |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 10/0 (3 files) |
| eslint `packages/render/src` | 0 |

`pnpm` registry на машине падает `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (attestations). Гейт пакетов — локальные `tsc`/`vitest` и junction `node_modules`, как на V2. Importers в `pnpm-lock.yaml` приведены к манифестам (`@corporator/render`, pixi у render). `sim.py` / `builds.py` / `--jobs 8` не в команде этапа.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `_ground_chunk_tiles=5` | L333 | caught |
| `_water_frame_count=9` | L334 | caught |
| overlay `deltaTime` | L334 | caught |
| `import { tick } from '@corporator/engine'` | L339 | caught |
| `export const CHUNK = 8` | L340 | caught |
| снят `RENDER_NO_GPU` из codes | L352 | caught |
| `_omit_render_no_gpu` | L352 | caught |
| fallback 8×8 непрозрачная магента | L352 | caught |
| `--jobs 8` в шаговом `gate_cmd` | нет (A-V-26) | нет |
| `scene.json?url` | клиент читает пак (A-V-1) | `placement["scene"]` |
| бочка `@corporator/render` тянет Pixi в Node | нет | сабпуть `./pixi`; client `index` / iso без Pixi |
| `city_id` задаёт геометрию | нет (D-V-21) | чанк/карта из пака |

Выстояло (не закрывается кодом V3): попиксельный GPU-голден кадра Pixi (**R-V-25**, V12 `GATE_VISUAL`); различие пикселя аппаратного и программного GPU; сглаживание шрифта ОС; горячий ключ аттестатора; тонкий пул тестовой сети; `R-M-6`/`R-M-9`/`R-M-10`; TLS npm-attestations на этой машине.

## Расхождения

- **R-V-10.** Закрыто: канон `tileOrigin` в `packages/render` = `scene.py tile_origin`.
- **R-V-21.** Закрыто: пакет `packages/render` рождён.
- **R-V-25.** GPU-голдены Pixi отложены до V12.
- **R-V-14.** sha векторов сдвинулся с `pack_hash`; состав 21 / layout v1 / homes тот же.
- **R-V-24.** Атлас воды 1 кадр; фаза всё равно от `city_time`.

## Готовность

Критерий PLAN_VISUAL §4 V3: паритет геометрии со `scene.py` командой (vitest `ground_matches_python_scene`); draw-call формула ≤ `draw_calls_max` (67 ≤ 96); шов на периоде дорог; нет WebGL → `fallback.png` + `RENDER_NO_GPU`. Попиксельный GPU-кадр — R-V-25 / V12. Next: V4 — `render_sprites`.

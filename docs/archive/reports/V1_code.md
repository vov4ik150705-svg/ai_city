# V1 — код

Детерминированный painterly-атлас. Механика, живые флаги и контракты не трогались. `packages/render` не заводился (D-V-9, R-V-21).

## Написано

- `content/atlas.py` — shelf-упаковщик: key-out flood-fill (`assets/_regen_key.py`), crop, масштаб к `(cols+rows)×(tile_w/2)` (R-V-20), glow по ближайшей рампе + запас `kind=building`, PNG `compress_level=9` дважды в процессе. Сортировка: высота ↓, затем UTF-8 id. Выход `content/out/atlas/` (`city.png` RGBA, `city_glow.png` L, `city.json`, `atlas.sha256`). Штамп `inputs.sha256` пропускает перекодировку при неизменных входах.
- `art/pipeline/assets.json` — 166 id на `assets/<cat>/*_v2.png`. Алиасы: `vehicle` → `vehicles/vehicle_car_v2.png`, `mini_island` → `terrain/island_block_v2.png`. `wind_turbine` из `decor/`. Исходники не переписывались (D-V-12).
- `content/params/render.json` — `atlas_padding_px=2`, `glow_window=200`, `glow_sign=255`. Derived: `atlas_sha256`, `atlas_bytes`, `atlas_page_count`, `atlas_frame_count`, `palette_sha256`, `atlas_opaque_magenta_px`, `atlas_glow_building_count`.
- `build_render()` зовёт `atlas.ensure_atlas`. `IMPLEMENTED_DERIVED` дополнен.
- L330 / L331 / L332. `art_atlas.gate_cmd`: `--only L330,L331,L332,L178`. `ts_gate_cmd` остаётся `@corporator/contentpack`.
- `packages/contentpack/test/v1.test.ts` — ровно три `it()` §6. `v0.test.ts` открывает `construction_tests` у `art_atlas`.
- `pack_version` 71. `rules_version` 0.21.0. Водяной знак 19.

## Решения

- Нативные ~800–1500 px не влезают в страницу 2048 и в 4 МиБ — масштаб к футпринту, не `pixelize` и не правка PNG (R-V-20).
- Пакет `packages/render` — V3. Гейт TS — contentpack (R-V-21).
- `page==0` валиден: L330 читает `"page" in fr`, не `fr.get("page") or -1`.
- L331/L332 сначала смотрят `city_png_mode`: `Image.convert("RGBA")` прятал RGB-атаку.

## Не делалось

`packages/render`, `art/out`/`art/raw`, `pixelize.py` на v2, правка существующих `*_v2.png`, `launchToken`, полный `--jobs 8`, `sim.py`.

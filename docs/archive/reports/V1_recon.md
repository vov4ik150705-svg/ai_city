# V1 — разведка

`art_atlas`: детерминированный RGBA-атлас, glow-маска, манифест `foot_anchor`/`footprint`. `launch.deployed` пуст. P7 не начат.

## Предусловие

`content/params/launch.json` `deployed`: пять полей пустые. Вход V0: пак **70**, `rules_version` **0.21.0**, хеш `0ae86d41d61f64fec50aae659c1fd1e4b525229868559086932bf2fdbccce0d4`, lint **331/0**. `missions_live=0`, краны NFT 0, `window_a_ratified=1`.

## Дерево

- `assets/<cat>/*_v2.png`: **164** файла, все RGB, фон-ключ на холсте. Контент ~800–1500 px. Сумма PNG ≈ 110 МБ, сумма пикселей ≈ 1.15e8. Нативная упаковка не влезает в `atlas_max_bytes` 4194304 и в страницу 2048.
- `art/pipeline/assets.json`: 33 id, поле `raw` на пустой `art/raw`. `wind_turbine` без файла и без сцены. `mini_island` и `vehicle` в реестре и в `world.py`, файлов `*_v2` с этими id нет.
- `art/pipeline/atlas.py` на диске нет. `pixelize.py` на v2 не гонять. `packages/render` нет (V3, D-V-9).
- `render.json`: есть `atlas_max_bytes`, `atlas_page_px`. Нет `atlas_padding_px`, glow-величин.
- Строка `art_atlas`: `construction_tests: []`, `gate_cmd` без L330+. `_visual_form_errors` требует пустые `construction_tests` у всех V кроме `visual_form` — на V1 строку надо открыть.
- PLAN gate цитирует `pnpm --filter @corporator/render` — пакет появится на V3. D-V-9 / R-V-19: `ts_gate_cmd` остаётся contentpack.

## ТЗ шага

Выходы PLAN_VISUAL §4 V1: новый сборщик в `content/` (не старый `art/pipeline/atlas.py`); `city.png` / `city_glow.png` / `city.json` / `atlas.sha256` в `content/out/atlas/`; реестр на `*_v2.png`; L330, L331, L332; три пробы §6; ключи `render.atlas_*`.

Критерий: два прогона одинаковые байты; ноль непрозрачной `#FF00FF`; сумма байт ≤ потолка; каждый id реестра в манифесте с `foot_anchor` и `footprint`.

## Риски

Упаковка от порядка `os.listdir` (A-V-3) — только сортировка id. Painterly окна не в 53 цветах — glow по ближайшей рампе + запас для `kind=building`. Масштаб кадра — футпринт × `tile_w/2`, исходник не переписывается (D-V-12).

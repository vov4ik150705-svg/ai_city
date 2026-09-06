# L5b code — спрайты T10 и отказ тайла

Пак **38**, `rules_version` **0.18.0**, хеш **`a26da3e45b44fafe91d163a6c76bc96594932470534cdc04cf59107082fc8e2f`**, 507025 байт. `layout.sha256` `b08a419ddb2e4fa6ae66aa9f99f8e030f100a9ef4f57cfe670add8c68d88e7e7`. Новых npm-зависимостей нет.

## 1. Девятнадцать raw → `assets.json`

Существующие `art/raw/raw_*.png` четырнадцати закрытых id не трогались. Добавлены 19 файлов того же контракта (1024×1024, фон `#FF00FF`). `assets_pending.json` оставлен с `assets: []`: WORLD.md §11 и `content/build.py` всё ещё читают файл.

`pixelize.py` отдал 33 спрайта, у каждого `blk=2`. `drone` держит `sprite_h: 48`. Палитра не расширена: 53 цвета, 10 рамп.

`content/world.py` кладёт в сцену фонари, деревья, мини-острова, **vehicles и drones** — раньше декор считался, но не рисовался, пока id не было в `assets.json`. Эталон: 409 объектов (было 329 в L5a). `park` / `plaza` / `district_billboard` остаются грамматикой карты и декора (`skip` в `world.py`), не лотами; `office_block` / `silo_warehouse` ждут fill неиграбельных районов. L178 требует спрайт у вида, не присутствие на сиде 0.

## 2. Отказ тайла

Один код `BUILD_TILE_ILLEGAL`, категория `refusal`, слотов нет. Текст: «сюда нельзя строить: вода, берег, дорога и двор закрыты». Capability `build_tile` — unlock **31**, предикат `codes.codes.BUILD_TILE_ILLEGAL`. `build_place.requires` = `city_level` (30), `build_tile` (31), `build_slot`, `capital`. L150: минимум на действии остаётся единственным (`city_level`). `LAW_C_TOKEN_GROUP["build_tile"] = "unlock"`.

`pending.json`: снята только `build_tile_refusal`. `district_stake_reference` на месте.

## 3. Гейт и пробы

- `L273` — код, строка, не pending, `build_tile` на `build_place`, capability на код.
- `art/pipeline/sprites_probe.py`: `pending_assets_closed`, `closed_ids_are_drawn`, `sprite_pixels_in_palette`.
- `art_sprites.construction_tests` пустой (как `art_ground`): пробы не vitest, L268 не трогать.
- `construction_t8_pending_kept` теперь **падает**, если `build_tile_refusal` ещё в pending.
- `construction_live_stage_keys_exist` падает, если у `art_sprites` появились `construction_tests`.
- `a_l178_footprint_5x3` ломает несуществующий `ghost_shed` `[5,3]`, не `workshop`.
- `L268` больше не спускается в `node_modules` / `dist` / `.git` (`os.walk` + prune). `rglob` всё равно обходил pnpm-копии, и каждый probe атаки сканировал диск минутами. Скан имён: 58 имён, 0.014 с.

## Отклонения

1. План называл инвариант `build_tile_refusal_has_string`. Правило — `L273`, проба атаки — то же имя в `CONSTRUCTION`. Vitest `it()` с этим именем нет.
2. `pack_version` 37→38 одним бампом. В дереве уже live `leaderboard_claim` без `L1_final` (`R-L-17`).
3. Хост/движок пока не вычисляют тайл: отказ живёт в паке и матрице. Исполнение `commit:build` — L2.

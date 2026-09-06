# V2 — код

`art_content`: кубы земли, легенда, ребаланс декора. Механика, живые флаги и контракты не трогались. `packages/render` не заводился (D-V-9).

## Написано

- `content/world.py` — легенда `~ . r s c p k b d w`; `build_map` красит тротуар/площадь/парковку/пляж/пирс/водопад/переход; extras: fountain/bench/planter, park, wind_turbine, pier, clouds. Деревья не на `s`/`p`. Четыре `TREE_KINDS`.
- `art/pipeline/tiles.py` — `GROUND_KINDS` таблица id; `main()` не пишет `art/out`. Рисовалки 64×32 только для `tiles_probe`.
- `art/pipeline/scene.py` — стек кубов (`island_dirt`/`island_cliff`/`cliff_rock` + верх), key-out как атлас, `art/preview/scene.png`.
- `art/pipeline/layout.py` — сверка `layout_hash`, без `art/out` (R-V-22).
- `content/atlas.py --registry` — 175 id; `sign_box` маяков из размера PNG.
- Дозапись `assets/terrain/{sidewalk,plaza_tile,parking,beach,crosswalk,waterfall,cliff_rock}_v2.png`, `assets/fx/cloud_{small,large}_v2.png`. Существующие `*_v2.png` не правились (D-V-12).
- L354, L355; `art_content.construction_tests` три имени; `pack_version` 72.

## Решения

- Разметка дороги — новый id `crosswalk`, не впись в `road_straight_v2` (D-V-12, R-V-24).
- Цель декора не понижалась: 1411 в полосе 1200±400 (R-V-7).
- Водопад берётся с живого берега после джиттера, иначе символ `w` пропадал.

## Не делалось

`packages/render`, `art/raw`, `pixelize.py` на v2, правка существующих PNG, `launchToken`, `--jobs 8`, `sim.py`, автотайл 15 кадров, TZ_ART §4.5–4.7.

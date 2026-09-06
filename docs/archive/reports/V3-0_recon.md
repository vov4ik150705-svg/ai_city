# V3-0 recon

`launch.deployed` все пять полей пусты (команда, не память). Ставка не снята. P7 не начат.

Прочитано: `PLAN_VISUAL_V3.md`, `code-phase.mdc`, `arch.roadmap_order`, `content/params/launch.json`, `render.json`, фикстура `authored_layout.json`.

## Находки

- Восемь ключей v3 ещё не стояли между `visual_close` и `mainnet_launch` до этого шага; `L268` требовал имя пробы в vitest 1:1.
- `road_span_tiles=2` паковал NS-лоты ядра как `[4, 1]`: 4-wide `logistics_hub` оставлял 1-тайловый обрез, банк и биржа не вставали в core (`L177`).
- Студийный оверлей: 34 `placements` на чужих зонах, 4 props, `replace_*=1`, 2656 тайлов. Декор 15 bps. Это не эталон R-V-61 (пустая фикстура, L174 warn 1198).
- `release_stage_keys_exist` фильтровал только 13 visual-ключей; без visual3 хвост после `rebalance_close` не равен девяти ключам выхода.
- Three.js в `packages/render` нет. Pixi 8.20.1 на месте.

## Риски этапа

- Чинить геометрию лотов в S0 (план запрещал `world.py`) — иначе lint не зелёный. Принято как `R-V-79`.
- Тайлы студии затирали derived `p`/`b`/`d` — `R-V-80`.
- `pnpm` на машине: `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Гейт TS — локальные `tsc`/`vitest`.
- L328 по-прежнему отсутствует (R-V-8). `prize_live_min_rules_minor` 19.

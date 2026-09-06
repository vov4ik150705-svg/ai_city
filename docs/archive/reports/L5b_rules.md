# L5b rules — новые правила и пробы

## Lint

| id | что ловит | вход падения | вывод на нём |
|---|---|---|---|
| `L273` | отказ тайла не закрыт: pending, нет кода/строки, нет `build_tile` на `build_place`, capability не на `BUILD_TILE_ILLEGAL` | `build_place.requires` без `build_tile` | `build_place does not require build_tile` |
| `L273` | то же | `build_tile_refusal` снова в `pending.json` | `build_tile_refusal is still in pending.json` |
| `L178` | футпринт вне лимита после закрытия 19 id (иначе атака молчала на workshop) | filler `ghost_shed` footprint `[5,3]` в `_assets_pending` | `ghost_shed footprint 5x3 long side > 4` и `depth 3 > lot_ring_depth 2` |
| `L150` | два unlock в минимуме на `build_place` | `build_tile.tier = 30` | `competing blocking gates at tier 30: city_level, build_tile` |
| `L151` | новый токен без группы | capability `ghost_tile` вне `LAW_C_TOKEN_GROUP` | `capability ghost_tile has no law-C group` |
| `L16` | ссылка на неотрисованный id | `city_hall.sprite = ghost_sprite` | `references sprite 'ghost_sprite' absent` |

## sprites_probe.py

Запуск: `python art/pipeline/sprites_probe.py`, код 1 при любой упавшей пробе.

| id | что ловит | вход падения | вывод на нём |
|---|---|---|---|
| `pending_assets_closed` | `status=todo` после L5b | `assets_pending.assets` с `ghost_shed` todo | `assets_pending still has todo ['ghost_shed']` |
| `closed_ids_are_drawn` | 19 id нет в `assets.json` или нет raw | нет `raw_<id>.png` | `raw file missing for …` |
| `sprite_pixels_in_palette` | непрозрачный пиксель вне 53 цветов | `(254,1,2)` в `art/out/workshop.png` | `workshop uses off-palette colour (254, 1, 2)` |

## Construction

| id | что ловит | вход падения |
|---|---|---|
| `construction_l5b_build_tile_refusal_has_string` | pending / нет кода / нет строки / нет requires | `build_tile_refusal` в pending |
| `construction_t8_pending_kept` | L5b не закрыл строку | `build_tile_refusal` в pending → `pending still open build_tile_refusal` |
| `construction_live_stage_keys_exist` | vitest-имена у арт-этапа | `art_sprites.construction_tests = ["ghost"]` |

## Что пробы не ловят и почему принято

- Смысл русской фразы. L12 сверяет слоты (их нет); смысл держит канон WORLD.md §2.
- Посадку `park`/`plaza`/`office_block` на сиде 0. L178 требует спрайт вида; fill и `skip` — грамматика T10, не новый этап.
- Исполнение отказа в `commit:build`. Пак и матрица закрыты; процесс — L2.

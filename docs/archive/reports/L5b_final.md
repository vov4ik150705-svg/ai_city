# L5b final — спрайты T10 и отказ тайла

## Гейт

| команда | результат |
|---|---|
| `python art/pipeline/pixelize.py` | 33 спрайта в `art/out`, 19 новых raw; у всех `blk=2` |
| `python art/pipeline/pixelize.py --report` | палитра **53** цвета, 10 рамп |
| `python content/build.py` | pack 507025 B, hash `a26da3e45b44fafe91d163a6c76bc96594932470534cdc04cf59107082fc8e2f`, rules 0.18.0, pack_version **38**; круг 14.47% / Trader 11.67% |
| `python art/pipeline/layout.py` | `scene.json` 63 строки, **409** объектов; `layout.sha256` `b08a419ddb2e4fa6ae66aa9f99f8e030f100a9ef4f57cfe670add8c68d88e7e7` совпал с паком |
| `python art/pipeline/scene.py` | `scene.png` 4112×2096, 3969 тайлов (2680 земли, борт 11 px), 409 объектов, **53 цвета в кадре** |
| `python art/pipeline/sprites_probe.py` | пробы 3 / упало 0 |
| `python art/pipeline/tiles_probe.py` | пробы 3 / упало 0 |
| `python content/lint.py` | правил **273**, ошибок **0**, PENDING **6** (нет строк sprite, нет `build_tile_refusal`) |
| `python content/codegen.py --check` | 15 match `a26da3e45b44fafe` |
| `python content/vectors.py` | 21; sha256 `ad379f822de92d4cacdeac8c6f0bb40b8873a17e0b20ac33cf14f9b2d755f82c` |
| `tsc -b` / eslint / depcruise | ok; **362/0** |
| vitest run | **58/0** |
| `python content/attack.py --jobs 8` | **522** probes, **273** covered, construction **155/0**, 1055.2s |
| `ReadLints` на `lint.py`, `attack.py`, `sprites_probe.py`, `world.py` | ошибок нет |

Критерий готовности из PLAN_LIVE §4 выполнен буквально: PENDING без 19 sprite-строк, `build_tile_refusal` нет, сцена собралась, палитра не расширена.

## Атаки

Проведено 18, выстояло 9, нашлось 9 — все девять закрыты здесь же.

| # | атака | результат |
|---|---|---|
| 1 | `build_place.requires` без `build_tile` | **нашлось** → L273 `does not require build_tile`; закрыто правилом |
| 2 | `build_tile_refusal` вернуть в pending | **нашлось** → L273 и `construction_t8_pending_kept` / `construction_l5b_*` |
| 3 | `a_l178` ломает workshop после переноса в assets | **нашлось** (стала бы декорация) → перенацелено на `ghost_shed` `[5,3]`; L178 красный |
| 4 | `build_tile.tier = 30` рядом с `city_level` | **нашлось** → L150 competing gates at 30 |
| 5 | capability без `LAW_C_TOKEN_GROUP` | **нашлось** → L151 `ghost_tile has no law-C group` |
| 6 | `assets_pending` todo `ghost_shed` | **нашлось** → `pending_assets_closed` exit 1 |
| 7 | непрозрачный `(254,1,2)` в `workshop.png` | **нашлось** → `sprite_pixels_in_palette`; файл восстановлен |
| 8 | `art_sprites.construction_tests = ["ghost"]` | **нашлось** → `construction_live_stage_keys_exist` |
| 9 | `rglob("*.test.ts")` через pnpm-копии | **нашлось** → L268 сканировал диск минутами на каждый probe; закрыто `os.walk` + prune |
| 10 | полный `attack.py --jobs 8` | выстояло: 0 SURVIVED, 0 UNATTACKED, L273/L178/L184/L16 пойманы |
| 11 | расширить палитру новым цветом | выстояло: квант + 53 в кадре, `sprite_pixels_in_palette` зелёный |
| 12 | KeyError манифеста на новом id | выстояло: `scene.py` 409 объектов после `pixelize` |
| 13 | `layout_hash` пака ≠ sha256 сцены | выстояло: `construction_t10_layout_hash_is_scene` |
| 14 | magenta в ключевании | выстояло: все 33 `blk=2` |
| 15 | park как дерево | выстояло: park 66×39, tree 70×98 |
| 16 | L11/L12 на новом коде | выстояло: слотов нет, строка есть; атаки L11/L12 красные на чужих входах |
| 17 | `a_l150` через `district_open` на `build_place` | выстояло: L150 по-прежнему ловит (city_level и district_open оба 30) |
| 18 | `commit:build` без проверки тайла в engine | принято: отказ в паке и матрице; исполнение — L2 |

## Расхождения

- `R-L-17` — открыто: пак 38 одним бампом несёт L5b и уже live `leaderboard_claim` (`leaderboard_claim_live.v=1`) без `L1_final`. L1_recon ждал 37→38 для клейма. Не откатывалось: гейт L162 биективен на live. Закрытие — отчёт L1.
- Park / plaza / billboard / office_block / silo_warehouse не стоят на сиде 0. Спрайты есть; fill и `skip` — грамматика T10. Не дефект L178.

## Что осталось за границей этапа

- Исполнение `BUILD_TILE_ILLEGAL` в `commit:build` — хост L2.
- Анимация, шейдеры, свет — после клиентского бюджета L3 (`R-C-12`).
- Шесть S_min и цена LLM — L6. PENDING 6.

## Готовность и следующий шаг

L5b закрыт: гейт зелёный числами, каждая новая проба показала красный прогон на подготовленном входе, все восемнадцать атак названы.

Next Step: **L1** — `prize_claim_live` (данные в паке уже live; нужен гейт и `L1_final`, `R-L-17`).

# G5 — разведка

`companion_live`: ненулевой `idle_reduction`; `set_manager_focus` в allowed; третий пересчёт окна A. `launch.deployed` пуст. Водяной знак призов 19. `rules_version` 0.20.0. Пак 59. G4_final на диске.

## Предусловие

Пять полей `deployed` пустые. Manager жив (G2). `companion_rows_live=0`, `companion_idle_relief_bps=0`, `set_manager_focus` forbidden `v1_1`. `demo_companion=0`. `companion_revenue_live=0`. Краны NFT 0.

## Что уже есть

Строка `companion_idle` → `idle_reduction_bps`, `magnitude_from: companion_idle_relief_bps`, `paid=0`. Свидетель аптайма — `mul_remainder` по величине, не по флагу (`construction_t8_uptime_from_magnitude`). L124: ноль величин при `live=0`. L140: companion ≤ optimizer и (пока) companion == minimalist. L143: `live≠0` красный. L77 форточка покрывает `source_kind=companion`. L126 запрещает `offline_cap_hours` даже нулём. Тик режет запрос `residual_idle_bps` из `balance.json`, не строкой компаньона: рычаг G5 — свидетель аптайма и content_floor, не второй haircut в `_pay`. Формула окна A T2 — от `residual_idle_bps` 500; `sim.py` — свидетель рычага (`D-G-5`).

Потолок ключа: `10000 − residual_idle_bps` = 9500. Route = два кванта 500. Величина G5 — 1000 (тот же квант, не новый литерал семьи). После `mul_remainder`: 500×9000/10000 = 450 > 0.

## Риски

Поднять флаг без свидетеля (`A-G-4`, `L143`). Величина режет residual ниже пола (`L311`). Строка на `output_bps` (`A-G-5`, `L77`). Строка на `offline_cap_hours` (`A-G-6`, `L126`). Демо + компаньон (`A-G-15`). Подгонка окна A (`A-G-11`). T8-пробы, завязанные на честный ноль (`construction_t8_zero_noop_fuse`, `window_a_unmoved`, `uptime_from_magnitude`, атака L124 при уже живом флаге). Полный `--jobs 8` на закрытии: правится `lint.py` (`L143`).

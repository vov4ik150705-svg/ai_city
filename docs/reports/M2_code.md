# M2 code

Пак 48, `rules_version` 0.19.0 не двигался. `prize_periods_per_season` = 3. Длина периода, часы, индекс и `qualify_days` — derived.

## Рантайм

`content/seasons.py` / `packages/engine/src/seasons.ts`: `prize_period_days = season // n`; qualify от периода; `i_period` = сумма переданного окна; `period_settle_due` / `season_settle_due`; `PRIZE_PERIOD_SETTLED` на первом часе нового периода; `SEASON_SETTLED` только на границе сезона. `settle_prizes` / `seasonSettle` без дня — прежний `SEASON_SETTLED` (C11, L110).

Тик: фрагменты по-прежнему каждый `efficiency_recalc_hour`; сезоны — только `period_settle_due`. Литерала длины периода в тике нет.

## Пак

Код `PRIZE_PERIOD_SETTLED`, поверхность `leaderboard`, capability `period_open` (limit / 70). `arch.prize_period.construction_tests` = три имени. `m0` / `_money_form_errors` принимают этот набор.

## Генератор

`build_seasons` печатает `prize_period_city_days`, `prize_period_real_hours`, формулу индекса. Секция GENERATED «M2: период призов». Свидетели Influence считаются в окне периода.

Кодоген переписан командой, не руками.

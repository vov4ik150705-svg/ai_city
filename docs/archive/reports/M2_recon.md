# M2 recon

M1 закрыт: пак 47, `rules_version` 0.19.0, `launch.deployed` пуст, ставка 200 / vault 200.

## Предусловие

`launch.json` `deployed` все `''`. `prize_periods_per_season` ещё нет. `qualify_days` = 90 × 2000 / 10000 = 18. `settle_prizes` каждый день в час 6 пишет `SEASON_SETTLED`.

## Цель

`prize_period`: делитель 3, длина периода derived, квалификация от периода (6 суток), интеграл Influence в окне периода, `PRIZE_PERIOD_SETTLED` на границе периода, `SEASON_SETTLED` только на границе 90.

## Находки в дереве

- `L119` считает qualify от `season_days` — перевести на `prize_period_days`.
- `seasons.ts` `qualifyDays` читает `season_city_days` напрямую.
- `_settle_seasons_hour` / `hourSix` селят каждый `efficiency_recalc_hour`, не границу.
- `m0.test.ts` и `_money_form_errors` ждут пустой `prize_period.construction_tests`.
- `c11.test.ts` need = season × qualify / bps (станет 18 при баре 6 — клон всё ещё пройдёт; формулу сменить).
- Код `PRIZE_PERIOD_SETTLED` нет; нужен surface на leaderboard (L149) и capability в LAW_C (L151).
- `rules_version` не двигать. Пак +1 → 48.

## Риски

`RK-M-6` хранимая 30. `RK-M-7` qualify 6 (кап доли — M3).

# M2 rules

| id | ловит | вход падения |
|---|---|---|
| L282 | сезон не делится на делитель; длина/часы/индекс хранятся | `prize_periods_per_season=4`; хранимый `prize_period_city_days` / `_real_hours` / `_index` |
| L119 | qualify не от периода или хранится | хранимый `qualify_days` (атака L119) |
| L106 | оптимизатор ≤ вялый кит на окне периода | coverage 0/0 = 0 |
| L121 | интеграл снят | `snapshot_last_day` |
| L220 | live без водяного знака | как M1 |

## Construction (имена = `it()`)

| имя | зелёный | красный |
|---|---|---|
| `prize_period_divides_season` | 90 % 3 = 0, 30 не в params, день периода+1 → `PRIZE_PERIOD_SETTLED`, день сезона+1 → оба кода | делитель 4; хранимая длина |
| `influence_integral_per_period` | окно свидетеля = период, opt > lazy, concat окон не схлопывается | сезонное окно в `days` |
| `qualify_days_from_period` | need = период × 2000 / BPS; клон 2 суток → `PRIZE_NOT_QUALIFIED` | qualify от сезона (18) |

L282 не роняет делитель 1 (90 делится). Красный вход на этом — vitest `expect(periods).toBe(3)` и construction, не L282.

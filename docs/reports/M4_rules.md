# M4 rules

| id | ловит | вход падения |
|---|---|---|
| L285 | haircut не ссылка; второй хранимый 3; второе расписание | `prize_hop_haircut_bps`=3; `haircut_ref` на seasons; второе `buyback_cadence_city_hours` |
| L286 | транш без капа; перелив остатка; ceil против фонда; второй кап | `basket_reallocate`; `basket_no_depth_cap`; `basket_ceil_prize`; второе `buyback_tranche_cap_bps` |

## Construction (имена = `it()`)

| имя | зелёный | красный |
|---|---|---|
| `basket_uniform_budget_per_ticker` | 6 равных бюджетов, haircut с пака | неравный spend |
| `thin_pool_throttles_not_reallocates` | AMZN=кап, carry>0, NVDA не вырос | realloc / no_cap |
| `basket_failure_does_not_block_tick` | spend 0, lag 1, `blocks_tick`=0 | hop потратил ETH |
| `basket_leg_floor_favours_fund` | eth=1 → fund=1 prize=0 | ceil призовой ноги |

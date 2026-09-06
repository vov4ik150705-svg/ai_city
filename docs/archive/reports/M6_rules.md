# M6 rules

| id | ловит | вход падения |
|---|---|---|
| L302 | кнопка drain/pause, «залочено навсегда», Treasury не `tick.capital`, лидерборд без следствия, корзина не aggregate | `a_l302_drain_button`, `a_l302_forever_copy`, `a_l302_treasury_is_vault`, `a_l302_hide_uncovered` |
| L268 | `it()` без строки `prize_surface.construction_tests` | ghost `ghost_m6` / empty list |
| L155/L162/L165 | заглушки, PRIZE_* на поверхности, wallet на клейме | прежние атаки этапа T9 |

Пробы (имя = `it()`):

- `leaderboard_shows_basket_composition` — шесть тикеров пака, без `$CORP`, срок = `prize_period_real_hours`
- `drain_notice_visible_on_leaderboard` — `PRIZE_POOL_EMPTY` и `PRIZE_CLAIM_UNCOVERED` из `codes`/`ru.json`; меню без drain/pause
- `claim_returns_every_asset` — `claimEveryAsset` по `prize_assets`; сухой `pool_in` → `PRIZE_CLAIM_UNCOVERED` на каждом

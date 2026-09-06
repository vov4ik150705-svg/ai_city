# M3 code

Пак 49, `rules_version` 0.19.0 не двигался. `prize_assets` = шесть `districts[].ticker` (NVDA TSLA AMZN AAPL MSFT COIN), never CORP. Сплит трат 10000/0. Кап доли derived, k = 73334.

## Рантайм

`content/seasons.py` / `packages/engine/src/seasons.ts`: `seasonSettle` принимает `pool: int | dict`, отдаёт выплаты по активам (`amounts`, `by_asset`). Zipf один раз, колонка на тикер. Σ ≤ пул **по каждому** активу. Пыль не кросс-зачёт. `DEMO_NO_PRIZE` раньше qualify. Кап при N≥2; N=1 без капа. Возврат snake_case (`sum_payout`, `mints_capital`) как Python.

Тик: `season_prize_pools` map, иначе broadcast `season_prize_pool`. `fragments.settle` принимает `contributions` + `share_cap_bps` для фарм-котла.

## Пак

Код `PRIZE_SHARE_CAPPED[cap]`. `arch.prize_basket.construction_tests` = четыре имени. Таблицы `prize_pools` / `prize_payouts`. `seasons.derived.prize_asset` инвертирован (R-M-3). GENERATED «M3: корзина Zipf и кап доли».

Кодоген переписан командой, не руками.

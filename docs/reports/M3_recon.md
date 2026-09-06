# M3 recon

Вход: M2 закрыт, пак **48**, `rules_version` **0.19.0**, хеш `8e850c0eb1f09cbb57ec7bf99b41bc4532f902ffa00a0ca21bd67cb9a0e18360`, lint **285/0**, vitest **82/0**, construction **179/0**. `launch.deployed` все `''`. `rules_version` не двигается.

## Канон через §15

`prize_assets` = 6 `districts[].ticker` (NVDA TSLA AMZN AAPL MSFT COIN), never `$CORP` (`D-M-11`, `L294`). Сплит трат `10000/0` (`D-M-16`, `L304`): десятка → фарм, не T7 `$CORP`. Кап доли derived (`D-M-7`, `L291`). Базис не `playable_v1` (`L283`). Σ ≤ пул по активу (`L284`). `DEMO_NO_PRIZE` раньше квалификации на каждом тикере (`L292`).

`arch.prize_basket.construction_tests` пуст — заполнить четырьмя именами. `R-M-3`/`R-M-11`: фразу `prize_asset` инвертировать. `R-M-15` закрыть сплитом.

## Дерево

`seasons.prize_asset()` → CORP; L108/L109/L112 и construction T6/T7 split ждут 6000/4000 и CORP. `seasonSettle` — один `pool: int`. `port.groups` = 4 (M5). Конвейер — M4.

## Риски

`RK-M-8` playable-базис. `RK-M-9`/`RK-M-10` кап k и сивил. Цел на гармонике и пыль между активами. 4000 bps обратно в T7 или Zipf месяца (`A-23`).

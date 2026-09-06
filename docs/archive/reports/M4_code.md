# M4 code

Пак 50, `rules_version` 0.19.0 не двигался. Конвейер — вторая нога `services/buyback` (`stepBasket`), не шестой процесс.

## Рантайм

`content/basket.py` / `services/buyback/src/basket.ts`: `splitCollected` floor призовой ноги, остаток фонду; studio floor с призовой ноги; `uniformBudget`; транш = `buybackTranche` того же капа. Carry по тикеру. `hopOk` — записанный вход. Отказ: spend 0, lag +1, ETH в carry. `studio_eth_recipient` пуст: studioHeld, не sent.

`loadBuybackPack` читает `prize_payer`, `prize_assets`, `quote_asset_by_ticker`, `fragment_hop_haircut_bps`. Haircut не копируется в seasons.

## Пак

`arch.basket_routes` month=`uniform` / farm=`by_demand`, `haircut_ref` = `fragments.params.fragment_hop_haircut_bps`. `arch.basket_order` = eth_split → quote_swapped → stock_bought → custody_confirmed. Таблица `basket_batches`. Ключ `prize_payer`. `construction_tests` ×4. GENERATED «M4: равномерный бюджет и тонкие пулы».

Кодоген переписан командой, не руками.

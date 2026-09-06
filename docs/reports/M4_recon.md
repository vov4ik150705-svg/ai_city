# M4 recon

M3 closed: pack 49, rules 0.19.0, lint 291/0. `launch.deployed` empty. `rules_version` stays.

## Canon (PLAN_MONEY §4 M4 through §15)

Second buyback leg `stepBasket`, not a sixth process (`D-M-9`). Six district tickers, never CORP (`D-M-11`). Studio ETH from prize leg before swap (`D-M-12`). Haircut by ref `fragments.params.fragment_hop_haircut_bps` (`L285`). Tranche cap and cadence remain the launch pair (`L244`). Leftover stays with the thin ticker (`L286`). Hop failure does not block the tick. Farm hop of the spend tenth is the other `basket_routes` row (`by_demand`); this step fills `month`.

## Tree

Buyback: `stepBuyback` fund stamps only. `arch.basket_routes` / `basket_order` absent. `prize_payer` absent. `basket_batches` absent. `construction_tests` of `basket_conveyor` empty. `port.groups` stays 4 (M5 is 5). `studio_eth_recipient` is `""` — hold studio wei, do not invent an EOA.

## Attacks to wire

A-11 equal tranche vs thin AMZN. A-12 leftover into NVDA. A-17 copied haircut 3 in seasons. Floor of prize leg favours fund (odd wei). Hop revert leaves ETH. Second cadence / second cap.

## Not this stage

`prize_treasury`, `vault_safety`, fifth `.sol`, HUD, `returnUnsettled`, `launchToken`.

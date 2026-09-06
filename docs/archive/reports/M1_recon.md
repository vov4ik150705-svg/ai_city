# M1 recon

M0 закрыт: пак 46, `rules_version` 0.18.0, `launch.deployed` пуст, девять ключей §15.8.

## Предусловие

`launch.json` `deployed` = `{token,curve,pool,hook,tx}` все `''`. `creator_tax_bps` = 100, `vault_fee_bps` = 400. `launchToken` не подписан.

## Цель

`fee_split`: ставка 200, вход vault 200, пол фонда 100 bps, `rules_version` 0.19.0. Вариант A. Rev-A: `studio_eth_*`, derived `fee_split` 1.0/0.8/0.2.

## Находки в дереве

- `L120` требует `prize_creator_tax_share_bps = 0` — переписать: cork/nft остаются 0, T7-бюджет без DEX-налога; доля 5000 — нога корзины, не кран T7 `$CORP`.
- `L94` не трогать: `fragment_creator_tax_share_bps` остаётся 0.
- `_buyback` ест весь `treasury_eth`. После сплита в `treasury_eth` только нога фонда; `treasury_basket_eth` не выкупается (M4).
- Атаки, которые сломает ставка 200: `a_l22` транш 50×3=150 < 200; `a_l279_tax_mismatch` и `construction_deployed_tax_matches_pack` drift на 200 при паке 200.
- `m0.test.ts` / `_money_form_errors` ждут пустой `fee_split.construction_tests`.
- `pending.exit_uncovered_at_band_floor` = 267 от старого drop 1273; пересчёт той же формулой L48.

## Риски

`RK-M-3` круг, `RK-M-4` окно A, `RK-M-5` derived. `R-M-6` витрина 300 bps — принято.

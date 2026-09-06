# M1 — журнал кода

Ставка 200 bps, вход vault 200 bps (вариант A). Сплит DEX: фонд / стоки / студия = 100 / 80 / 20 bps оборота. `launchToken` не подписывался.

Пак после `python content/build.py`: **529 209** канонических байт, хеш **`394cb00b63bbabc851d6d28edca9abb72712565abbc10e77b3229136f7bfbaf9`**, `pack_version` **47**, `rules_version` **0.19.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/contentpack/test/m1.test.ts` | три имени `fee_split.construction_tests` |
| `docs/reports/M1_recon.md` | разведка |
| `docs/reports/M1_code.md` | этот журнал |
| `docs/reports/M1_rules.md` | пробы и поимки |
| `docs/reports/M1_final.md` | гейт и атаки |

## 2. Изменено

`economy.json` — `creator_tax_bps` 100→200, `vault_fee_bps` 400→200, `studio_eth_share_bps`/`ceiling` 2000, `studio_eth_recipient` `""`, derived fund/prize/fee_split. `meta.json` 0.19.0 / пак 47 / `fund_effective_tax_floor_bps`=100. `seasons.json` watermark 19, `prize_creator_tax_share_bps`=5000. `pending.exit_uncovered_at_band_floor` v=409.

`content/build.py` — `split_tax_bps` / `split_tax_atoms`, печать круга/breakeven/fee_split, секция GENERATED «M1: состав трения при 2%», сток `split_creator_tax_atoms` в L210.

`content/tick.py` / `sim.py` / `packages/engine/src/{config,economy,state}.ts` — `credit_creator_tax`: floor призовой ноги, остаток фонду; `treasury_eth` только нога фонда; `treasury_basket_eth` не выкупается.

`content/lint.py` — L120 без запрета доли 5000; L280, L281, L290, L295, L296; L47 читает окно A из генератора.

`content/attack.py` — drift tax+1, транш `tax//safety+1`, три construction M1, атаки L280/L281/L290/L295/L296/L13 uncompensated; `a_l42` = derived `window_lo-1`; `FEE_SPLIT_CONSTRUCTION`.

Канон пословно: `DESIGN.md` §2.1/§2.3/§2.5/§2.6/§12/§5.7; `docs/LAUNCH.md` §3/§5; `docs/BRIEF.md`; `docs/BALANCE.md`; `docs/CONTENT.md`; `.cursor/rules/economy-determinism.mdc`.

Кодоген 19 артефактов, `CREATOR_TAX_BPS = 200`. `services/api/test/c11.test.ts` pin `rules_version` 0.19.0.

Новых npm-зависимостей нет. Арт не тронут.

## 3. Решения без развилки

- Вариант A: vault 200 вместе со ставкой 200. Полоса `[1400, 1600]` не двигалась.
- D-M-3 в bps, D-M-12 в атомах. Студия в тике не снимается (M4 `stepBasket`).
- `fragment_creator_tax_share_bps` остаётся 0 (`L94`).
- Recipient студии пустой: адрес не выдумывать.

## 4. Числа генератора

Круг **1445** bps / 14.45%; Trader **1164** / 11.64%; вход 200 / выход 910 (Trader 611); витрина 300; mint rate 51; vault_mint_rate 1960; fee split 100/80/20; breakeven fund 72250 / protocol 36125; unit capture 4277; окно A T2 [12275, 15783]. `sim.py` calibration `A_t2=14217` внутри `[12278, 15787]`.

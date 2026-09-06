# M7 rules

| id | ловит | вход падения |
|---|---|---|
| L293 | пакет ≠ ставка развёртывания; витрина > `maxCreatorTaxBps`; снимок потолка ≠ 1000 | `_onchain_creator_tax_bps=100`; `creator_tax_bps=1100`; `curve_fee_bps=900`; `max_creator_tax_bps=2000` |
| L268 | `it()` без строки `launch_freeze.construction_tests` | ghost `ghost_m7` / empty list |
| L24 | кривая ≠ фикстура KOTS | фикстура считает своей ставкой 100, не пакетной |
| L279 | PackConstants / доля покупки / частичный `deployed` | прежние атаки L9 |

Пробы (имя = `it()`):

- `pack_tax_equals_deploy_rate` — пак 200 = PackConstants, ≠ KOTS 100; overlay 100 роняет L293
- `vitrine_under_factory_ceiling` — `tax+curve` ≤ `max_creator_tax_bps`; 1100 и curve 900 роняют L293

`deployed_tax_matches_pack` остаётся на `pons_launch` (L9).

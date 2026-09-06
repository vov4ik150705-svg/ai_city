# M1 — правила и пробы

## Новые правила

| id | что ловит | вход падения |
|---|---|---|
| L280 | эффективная ставка фонда ≥ `fund_effective_tax_floor_bps` | `prize_creator_tax_share_bps`=7500 при tax 200 → fund 50 < 100 |
| L281 | сплит не хранится; fund+prize = tax | хранимый `creator_tax_fund_bps` |
| L290 | watermark = minor `rules_version` | live=1, floor 18, `0.19.0` |
| L295 | take студии только с призовой ноги | prize share 0 и `studio_eth_share_bps` 2000 |
| L296 | share ≤ ceiling; recipient пустой или EOA | share 10000 > ceiling 2000 |

L120: cork/nft = 0; бюджет T7 = protocol×prizes. Доля 5000 больше не красная.

## Construction `fee_split`

| имя | зелёный пак | красный вход |
|---|---|---|
| `round_trip_after_tax_two_percent` | tax/vault 200, круг в полосе | vault 400 → L13 1620 bps |
| `fund_tax_floor_holds` | fund 100 ≥ 100 | prize 7500 → L280 |
| `dex_visible_fee_under_ceiling` | visible 300, tax 200 ≤ 1000 | tax 1100 > factory 1000 |

## Починенные атаки старых правил

| атака | было | стало |
|---|---|---|
| `a_l22_tranche_eats_the_tax` | cap=50 молчал при tax 200 | cap = tax//safety+1 → 67×3=201 > 200 |
| `a_l279_tax_mismatch` | replace 100→200 no-op | drift `tax+1` |
| `construction_t8_window_a_unmoved` | freeze [12278, 15787] | endpoints из формулы T2 |
| L47 literals | freeze 12278/3990 | токены из `build_balance` |
| `a_l42_boundary_below_window` | freeze A=12277 (внутри нового окна) | A = derived `window_lo - 1` → return_min 3499 |

## L210

Новый `//` в `split_creator_tax_atoms`: каталог +1, remainder — призовой floor, остаток фонду (D-M-12).

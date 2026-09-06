# M3 rules

| id | ловит | вход падения |
|---|---|---|
| L283 | базис не все `districts[].ticker` | `prize_assets` = playable_v1; тройка NVDA/TSLA/AAPL; хранимый список |
| L284 | Σ выплат актива > пул; ceil; пыль на другой тикер | rounding=ceil; `cross_asset_dust` |
| L291 | кап хранится / снят / режет N=1 / не режет клонов / режет оптимизатора | stored k; `force_share_cap_n1`; `disable_share_cap` |
| L292 | демо берёт сток; DEMO после qualify; `demo_transfer_edges` | `demo_after_qualify`; непустой edge |
| L294 | список ≠ районы или есть CORP | `prize_assets` + CORP |
| L304 | сплит не 10000/0 | fragments 6000 / prizes 4000 |
| L108 | T7 снова пьёт десятку | prizes ≠ 0 |
| L109 | актив CORP/Capital или hop ≠ 0 | `prize_asset=Capital` |

## Construction (имена = `it()`)

| имя | зелёный | красный |
|---|---|---|
| `basket_covers_all_district_tickers` | 6 тикеров файла, не playable, не CORP, не в params | playable / тройка |
| `per_asset_payout_within_pool` | N=1 забирает каждый пул; пустой актив не блокирует; n10 гармоника | ceil сверх пула |
| `prize_share_cap_binds_farm` | 10 клонов 0.1% срезаны; оптимизатор не срезан; 10000/0 | k=0 / stored k |
| `demo_takes_no_basket_asset` | 0 атомов, edges пуст, `demo_takes_zero=1` | DEMO после qualify |

L284 на честном паке: ceil n=10 pool=BPS даёт 10005>10000 — мета-чек жив.

# C11 — пробы и поимки

L115: `season_prizes_live≠0` без пересчёта `rules_version` (minor < `prize_live_min_rules_minor`). L220: live=0 и payout>0, либо live=1 без пересчёта, либо live=1 после пересчёта и честный settle платит 0. Новых `L*` нет.

Пак: **492314** байт, хеш **`08867647fa2983a661fff0718cbb1224b970cb297371592dd792188d0d4a8ddb`**, `pack_version` **36**.

Конструкция vitest (`seasons_prizes_v1_1.construction_tests`), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `season_prize_distribution_proportional` | `expect(live).toBe(0n)` | expected 0n, got 1n |

Прочие красные входы:

| вход | правило | факт |
|---|---|---|
| live=1 + `rules_version=0.17.0` | L115 | without recount: $CORP payout would be yield |
| live=1 + `rules_version=0.17.0` | L220 | without recount: $CORP payout would be yield |
| live=0 + probe `sum_payout=40` | L220 | season_prizes_live=0 but sum_payout=40 |
| N=0 Zipf | construction | dust=pool, sum=0 |
| N=1 Zipf | construction | payouts=[pool] |
| live=0 ненулевой ранг | construction | sum_payout=0, payouts непусты |
| demo row | vitest | `DEMO_NO_PRIZE`, sum 0 |
| `prize_asset=Capital` | L109 | не CORP |
| ceil Zipf | L107 | Σ превышает пул |

`S_min` не заводился. Приз не минтит Capital.

# C11 — разведка

Призы сезонов включаются пересчётом пака, не голым флагом. Строка ROADMAP `seasons_prizes_v1_1`. Зависит от C3, C10.

## Прочитано

PLAN_CODE §4 C11, RK-12, RK-4; PRIZES.md §6.4–§6.5; DESIGN.md §11–§12; TICK.md §12; L107 L109 L112–L115 L117 L120 L121 L220 L266 L268; seasons.py `zipf_payout` / `settle_prizes`; engine stub `seasonSettle`; C10_final.

## Дерево до шага

`season_prizes_live=0`. L115/L220 запрещают live=1. Python Zipf floor уже в `seasons.py`. TS `seasonSettle` — заглушка. `hourSix` не кладёт `season_settlement`. `seasons_prizes_v1_1.construction_tests` пустые.

## Решения

- Один новый `it()`: `season_prize_distribution_proportional`. C3-имена не дублировать.
- live=1 только при `rules_version` ≥ `prize_live_min_rules_minor` (0.18.0). Флаг на 0.17.0 роняет L115 и L220.
- live=0 на другом городе: ранг есть, выплата 0. Zipf = payroll `weight × pool / total`. N=0 пул цел. Приз `$CORP`, hop 0, демо `DEMO_NO_PRIZE`.
- `rules_version` minor 0.17.0→0.18.0 (layout v1, L266 major остаётся 0). Формула Zipf не менялась.

## Риски

RK-12 демо-приз. RK-4 дрейф Python↔TS: тот же floor, что `seasons.py`.

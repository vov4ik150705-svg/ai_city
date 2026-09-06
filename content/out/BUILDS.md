# Сгенерированные билды T4

Артефакт `python content/builds.py`. Источники: `progression.json`, `districts.json`,
`balance.json`, `time.json`, `sim.json` архетипы, `tick.py` конфиг через pack.
Руками не править.

## Счёт

| величина | значение |
|---|---:|
| builds_raw | 160608177 |
| builds_raw_v1 | 160608177 |
| builds_terminal | 3911153 |
| builds_eval (семейство анализа) | 131777 |
| из них affordable хоть в одном сценарии | 131777 |
| justified | 92622 |
| unjustified | 39155 |
| осмысленно различных (justified) | 92622 |
| сценариев | 432 |
| пар (сценарий, цель) | 1728 |

## Доминирование

Доминирующих билдов: 0.
Мёртвых узлов: 0.
Обязательных узлов: 0.
depth/breadth переворот на slots (all_mid/optimizer/surplus/open): 2.
Доля пар, где automation в argmax offline: 10000 bps.

## Свидетели строгого доминирования

Неоправданный билд закрыт свидетелем: строгое доминирование, sibling exclusive-куба,
грань тиров (between) при том же наборе районов, срез merge-пары (2-open),
либо срез 3-куба C(6,3) когда все шесть районов live.
Иначе ошибка L69. Ось горизонта day/mid/season — способ (b) на смешанные тиры.
Осмысленно различных билдов = justified.

| величина | значение |
|---|---:|
| свидетелей | 39155 |
| причина vector | 2658 |
| причина cheaper | 0 |
| причина sibling (тот же tiers×merge, другая сторона) | 30593 |
| причина between (грань тиров при том же наборе районов) | 3376 |
| причина pair_slice (пара-срез семейства; не-v1 или 2-open при шести live) | 0 |
| причина cube_slice (3-open C(6,3) при шести live) | 2528 |
| непокрытых (ни justified, ни свидетель) | 0 |
| из них уникальных (cost, vector) | 0 |

Примеры пар (укорочено до восьми):

- `automation:0 compute:0 consumer:2aa energy:0 finance:0 logistics:0 m=` ← `automation:0 compute:1a consumer:2aa energy:0 finance:0 logistics:0 m=` (vector)
- `automation:0 compute:0 consumer:2ba energy:0 finance:0 logistics:0 m=` ← `automation:0 compute:1a consumer:2ba energy:0 finance:0 logistics:0 m=` (vector)
- `automation:0 compute:0 consumer:2ab energy:0 finance:0 logistics:0 m=` ← `automation:0 compute:1a consumer:2ab energy:0 finance:0 logistics:0 m=` (vector)
- `automation:0 compute:0 consumer:2bb energy:0 finance:0 logistics:0 m=` ← `automation:0 compute:1a consumer:2bb energy:0 finance:0 logistics:0 m=` (vector)
- `automation:0 compute:0 consumer:3baa energy:0 finance:0 logistics:0 m=` ← `automation:0 compute:1a consumer:3baa energy:0 finance:0 logistics:0 m=` (vector)
- `automation:0 compute:0 consumer:3bba energy:0 finance:0 logistics:0 m=` ← `automation:0 compute:1a consumer:3bba energy:0 finance:0 logistics:0 m=` (vector)
- `automation:0 compute:1a consumer:1a energy:0 finance:0 logistics:0 m=` ← `automation:1a compute:1a consumer:1a energy:0 finance:0 logistics:0 m=` (vector)
- `automation:0 compute:1a consumer:1b energy:0 finance:0 logistics:0 m=` ← `automation:1a compute:1a consumer:1b energy:0 finance:0 logistics:0 m=` (vector)

## Узел → сценарии, где он в argmax

Сгенерировано. Укорочено до восьми меток на узел; полный счёт — `node_best_counts`.

| узел | пар | пример |
|---|---:|---|
| `n_automation_breadth` | 813 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_automation_capital` | 626 | minimalist/surplus/mid/free/open/all_lo::offline_tolerance |
| `n_automation_depth` | 813 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_automation_paper` | 576 | minimalist/surplus/mid/free/open/all_lo::offline_tolerance |
| `n_automation_scale` | 918 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_automation_thrift` | 756 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_compute_breadth` | 822 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_compute_capital` | 788 | minimalist/surplus/mid/free/open/all_lo::offline_tolerance |
| `n_compute_depth` | 822 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_compute_paper` | 576 | minimalist/surplus/mid/free/open/all_lo::offline_tolerance |
| `n_compute_scale` | 918 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_compute_thrift` | 942 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_consumer_breadth` | 927 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_consumer_capital` | 862 | minimalist/surplus/mid/free/open/all_lo::capital_season_net |
| `n_consumer_depth` | 927 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_consumer_paper` | 576 | minimalist/surplus/mid/free/open/all_lo::offline_tolerance |
| `n_consumer_scale` | 972 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_consumer_thrift` | 954 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_energy_breadth` | 909 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_energy_capital` | 818 | minimalist/surplus/mid/free/open/all_lo::offline_tolerance |
| `n_energy_depth` | 909 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_energy_paper` | 576 | minimalist/surplus/mid/free/open/all_lo::offline_tolerance |
| `n_energy_scale` | 918 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_energy_thrift` | 972 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_finance_breadth` | 756 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_finance_capital` | 660 | minimalist/surplus/mid/free/open/all_lo::withdraw_season |
| `n_finance_depth` | 756 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_finance_paper` | 576 | minimalist/surplus/mid/free/open/all_lo::offline_tolerance |
| `n_finance_scale` | 948 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_finance_thrift` | 756 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_logistics_breadth` | 720 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_logistics_capital` | 448 | minimalist/surplus/mid/free/open/all_lo::offline_tolerance |
| `n_logistics_depth` | 720 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_logistics_paper` | 576 | minimalist/surplus/mid/free/open/all_lo::offline_tolerance |
| `n_logistics_scale` | 756 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |
| `n_logistics_thrift` | 732 | minimalist/surplus/day/free/open/all_lo::offline_tolerance |

## Стоимости

тир 1: 0, тир 2: 34217877, тир 3: 128317038, merge: 42772346.


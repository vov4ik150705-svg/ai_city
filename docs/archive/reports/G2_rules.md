# G2 — пробы и поимки

Новое правило **L308**. Затронуты L70, L72, L73, L85, L86 (гейт `--only`, регрессия красным входом).

Пак: **559 806** байт, хеш **`56f98bfaef0ad769d1b880bacb161ef3a47eefd55b67cccef23f44d103cee564`**, `pack_version` **57**, `rules_version` **0.20.0**.

## L308

| что ловит | вход падения | поимка |
|---|---|---|
| train не live | `train.v1=false` | `objective train v1 is false` |
| не пять ролей | `scientist.v1=false` (+ объективы) | `live roles 4 != 5` |
| величина снова ноль | `magnitude_from=v1_1_zero` на train/research | `train_xp magnitude_from is v1_1_zero` |
| compute слит с energy | `train_compute.key=energy_cost_bps` + keys | `train has no compute_cost_bps` |
| величина выше потолка | `train_xp.magnitude=20000` | `train_xp magnitude 20000 composes above xp_rate_bps cap 16000` |
| возвраты вне полос | `fund_amplification_target_bps=10000` | `return_min_bps 2851 outside envelope` |

План §5: красный вход L308 — оставить `train.v1 = false`. Пойман.

Авторский `magnitude_from` проверяется отдельно от generated: deepcopy с кэшем `_lint_t5` больше не прячет ноль.

## L70 / L72 / L73 / L85 / L86

| id | вход | поимка |
|---|---|---|
| L70 | 50 строк +2000 выхода | content_floor > cap_max |
| L70 | output_growth 11000 | fragment_rate floor > cap |
| L70 | два района на одно здание | fragment_rate floor > cap |
| L70 | потолок 0 | cap_max 0 is not a positive bound |
| L72 | строка на unknown key | ghost_row unknown key |
| L73 | порядок стадий переставлен | stage order ≠ канон |
| L73 | `output_bps` stage=objective | v1 objective slot is identity |
| L85 | у Overclock нет строки energy | keys ≠ rows |
| L86 | потолки 10^40 | numerator 371 bits > 192 |
| L86 | числитель 193 бит | 193 bits > 192 |

## Конструкции `archetypes_live.construction_tests`

| имя | вход падения | факт |
|---|---|---|
| `five_roles_live` | scientist false | L308 `4 != 5` |
| `scientist_spends_compute` | merge compute→energy | L308 |
| `manager_focus_picks_contour` | focus.v1 false | L308 |
| `train_grants_xp` | `v1_1_zero` | L308 authored |
| `window_a_in_envelope_after_archetypes` | A=10000 | L308 return_min 2851 |

Vitest: пять `it()` = пять имён. Зелёный пакет + синтетический красный внутри теста.

Конструкций в харнессе: **211**.

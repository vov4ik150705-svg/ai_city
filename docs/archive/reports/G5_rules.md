# G5 — пробы и поимки

Новое правило **L311**. Изменён замок **L143**. Затронуты L77, L140 (гейт `--only`). Полный `--jobs 8` на закрытии: правился `lint.py`.

Пак: **562 065** байт, хеш **`3faf064f6214329c6b656617971a0fe23a4f364f49b9c6afbf051c81881de600`**, `pack_version` **60**, `rules_version` **0.20.0**.

## L311

| что ловит | вход падения | поимка |
|---|---|---|
| флаг без рекаунта | `fund_amplification_target_bps=10000` при live=1 | `return_min_bps 2851 outside envelope` |
| focus снова forbidden | `set_manager_focus` в forbidden | `still in the forbidden dictionary` |

План §5: красный вход L311 — поднять флаг без свидетеля окна A. Пойман (`a_l143_without_recount`, тот же вход бьёт L143).

Пол `residual_idle`: при капе 9500 `mul_remainder` даёт минимум 25, поэтому `relief=10000` сначала падает на кап. Проверка `reduced <= 0` жива, если кап поднимут.

## L143 / L77 / L140

| id | вход | поимка |
|---|---|---|
| L143 | A=10000 при live=1 | `without recount: return_min_bps 2851` |

L124: при live=1 честный ноль не требуется; атака ставит `live=0` + relief=1000.

Полный `--jobs 8` нашёл KeyError `research.nodes.tools` в L40 (G3 перевёл дерево на оси, пробы не переписал). Закрыто: `a_l40_zero_effect` ставит `axes.tools.tier=0`; stored-cost пишет authored `nodes.tools.cost_capital=1`.


| имя | вход падения | факт |
|---|---|---|
| `manager_focus_allowed` | focus → forbidden | L311 |
| `residual_idle_floor_held` | relief=10000 | L311 above cap 9500 |

Vitest: четыре `it()` = четыре имени. Зелёный пакет + синтетический красный внутри теста.

Конструкций в харнессе: **221**.

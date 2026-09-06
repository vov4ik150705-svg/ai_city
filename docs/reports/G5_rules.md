# G5 — пробы и поимки

Новое правило **L311**. Изменён замок **L143**. Затронуты L77, L140 (гейт `--only`). Полный `--jobs 8` на закрытии: правился `lint.py`.

Пак: **562 065** байт, хеш **`3faf064f6214329c6b656617971a0fe23a4f364f49b9c6afbf051c81881de600`**, `pack_version` **60**, `rules_version` **0.20.0**.

## L311

| что ловит | вход падения | поимка |
|---|---|---|
| флаг без рекаунта | `fund_amplification_target_bps=10000` при live=1 | `return_min_bps 2851 outside envelope` |
| величина нулевая | `companion_idle_relief_bps=0` | `is zero: companion row is decorative` |
| величина выше потолка / пол | `companion_idle_relief_bps=10000` | `> idle_reduction cap 9500` (пол 0 тоже, но кап раньше) |
| focus снова forbidden | `set_manager_focus` в forbidden | `still in the forbidden dictionary` |
| флаг снят | `companion_rows_live=0` | `!= 1: flag lifted only with a recount` |

План §5: красный вход L311 — поднять флаг без свидетеля окна A. Пойман (`a_l143_without_recount`, тот же вход бьёт L143).

Пол `residual_idle`: при капе 9500 `mul_remainder` даёт минимум 25, поэтому `relief=10000` сначала падает на кап. Проверка `reduced <= 0` жива, если кап поднимут.

## L143 / L77 / L140

| id | вход | поимка |
|---|---|---|
| L143 | A=10000 при live=1 | `without recount: return_min_bps 2851` |
| L77 | companion +700 `output_bps` | free stack 13535 > window 13300 |
| L140 | uptime probe 9600 | companion 9600 > optimizer 9500 |
| L140 | relief=0 | companion == minimalist (на зелёном паке relief=1000, companion 4775 > 4750) |

L124: при live=1 честный ноль не требуется; атака ставит `live=0` + relief=1000.

Полный `--jobs 8` нашёл KeyError `research.nodes.tools` в L40 (G3 перевёл дерево на оси, пробы не переписал). Закрыто: `a_l40_zero_effect` ставит `axes.tools.tier=0`; stored-cost пишет authored `nodes.tools.cost_capital=1`.

## Конструкции `companion_live.construction_tests`

| имя | вход падения | факт |
|---|---|---|
| `companion_relief_non_zero` | relief=0 | L311 decorative |
| `manager_focus_allowed` | focus → forbidden | L311 |
| `residual_idle_floor_held` | relief=10000 | L311 above cap 9500 |
| `window_a_in_envelope_after_companion` | A=10000 | L311 return_min 2851 |

Vitest: четыре `it()` = четыре имени. Зелёный пакет + синтетический красный внутри теста.

Конструкций в харнессе: **221**.

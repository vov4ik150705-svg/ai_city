# G7 — правила

Новое правило **L313**. Замки L13/L14/L42/L63–L65/L69 не менялись; L313 повторяет их на сведённых рычагах. Полный `--jobs 8` на закрытии: правился `lint.py`.

## L313

Ловит: `window_a_ratified ≠ 1`; играбельных районов ≠ 6; круг вне `[round_trip_floor_bps, round_trip_ceiling_bps]`; вход ≥ выход; `_return_bands_in_envelope` (A=10000 → `return_min` вне полосы); касса (unit/ceiling / mint > `capital_anchor`); оффлайн `base+automation ≠ 18`; `companion_rows_live ≠ 1` или relief ≤ 0; scientist/train не live; `force_dominating`; dominating/dead/mandatory/uncovered ≠ 0; `demo_companion ≠ 0`; `season_prizes_live` снят.

План §5: красный вход — сдвинуть полосу за конверт (`fund_amplification_target_bps=10000`). Пойман (`a_l42_amplification_too_low`).

Ратификация — флаг, не копия окна. Конверт meta 3500–4500 / 7000–9000 не подогнан (`A-G-11`).

## Пробы

| id | красный вход | что ловит |
|---|---|---|
| `friction_budget_held` | `bank_markup_bps=200` | L313 круг вне полосы |
| `no_dominant_no_dead_no_mandatory` | `force_dominating` | L313 именованная стратегия |
| `window_a_ratified` | флаг 0; A=10000 | L313 флаг / конверт |

## Затронутые

L13/L14 — круг и вход<выход, без правки, повтор в L313. L63–L65/L69 — доминирование, без правки, повтор. L47 — окно A не хранится.

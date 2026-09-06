# V5 — правила

| id | что ловит | вход падения |
|---|---|---|
| L335 | час фазы литералом; `phase_blend_city_minutes`/`grade_bps` ≤ 0; нет `phaseBlendBps`; фаза от Date/delta | overlay `if (hour >= 20)`; `phase_blend_city_minutes=0` |
| L336 | `day.lights` ≠ 0; `day` в `lanterns_on_phases`; нет `glowGainBps` | `_lint_t10` day lights=1; lanterns+day; overlay без `glowGainBps` |
| L331 | непрозрачный `#FF00FF` в атласе; грейд без `gradeRgb` или возврат ключа | overlay PNG магента; `gradeRgb` → `[255,0,255]` |

Затронутые: L179 (фазы из `time.json`), L268 (три имени vitest).

Пробы L268 1:1:

| имя | зелёный | красный |
|---|---|---|
| `frame_has_no_magenta_leak` | `gradeRgb` по четырём тинтам не даёт ключ; mix=0 — тождество | PNG магента / грейд-ключ → L331 |
| `lights_off_at_day` | day `lights=0`, `glowGainBps=0`; dawn/dusk/night > 0 | day lights=1 → L336 |
| `phase_blend_is_monotonic` | внутри фазы blend не убывает; первый час следующей = 0 | `hour>=20` / blend=0 → L335; inverted hours → L179 |

Мутаторы L336 снимают `_lint_t10`.

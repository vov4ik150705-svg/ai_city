# V5 final


Пак **75**, хеш **`a8b41502d98303997761e95528bde00f217721457a97f5a73ead1e56aca8b45a`**, 615849 байт. `rules_version` 0.21.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. Атлас 179 кадров, magenta 0, sha `acd419041ca4`. `layout_hash` `63aa7ce8cc09…` (геометрия не сдвинулась). Объектов сцены **466**.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 345 / 0 |
| `python content/build.py` | 0; pack 75; 615849 байт; hash `a8b41502…aca8b45a`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py` | 23 artifacts, hash `a8b41502` |
| `python content/attack.py --only L179,L331,L335,L336` | 10/0 пойманы |
| construction три имени V5 | OK на зелёном; красный вход внутри каждой |
| `python content/vectors.py` | 21 файл; sha `5ab25276…bb42ec8d` (сдвиг с pack_hash, R-V-14); инвентарь homes 25, тот же |
| render `tsc --noEmit` + `vitest run` | tsc 0; vitest 10/0 (3 V3 + 4 V4 + 3 V5) |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 10/0 |
| contentpack vitest | 59/0 |
| eslint `packages/render/src` | 0 |

`pnpm` registry на машине падает `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Гейт пакетов — локальные `tsc`/`vitest`. `sim.py` / `builds.py` / `--jobs 8` не в команде этапа (A-V-26).

## Атаки

| вход | ожидание | факт |
|---|---|---|
| inverted `bank_close` < `bank_open` | L179 | caught |
| `dawn_hour` stored param | L179 | caught |
| overlay PNG `#FF00FF` | L331 | caught |
| `gradeRgb` → `[255,0,255]` | L331 | caught |
| `if (hour >= 20)` | L335 | caught |
| `phase_blend_city_minutes=0` | L335 | caught |
| day `lights=1` (кэш `_lint_t10` снят) | L336 | caught |
| `lanterns_on_phases` + `day` | L336 | caught |
| overlay без `glowGainBps` | L336 | caught |
| `--jobs 8` в `gate_cmd` этапа | нет (A-V-26) | нет |
| `Date.now` / `Math.random` / engine в render | нет | нет |
| `city_id` задаёт геометрию | нет | `layout_hash` прежний |
| свет в `day` через blend | нет | `glowGain` от текущего `lights`, не от blend |

Выстояло (не закрывается кодом V5): GPU-голден Pixi (**R-V-25**, V12); глиф-шрифт подписей (**R-V-26**); один кадр воды (**R-V-24**); различие пикселя GPU; сглаживание шрифта ОС; горячий ключ аттестатора; тонкий пул тестовой сети; `R-M-6`/`R-M-9`/`R-M-10`; TLS npm-attestations. TZ_RENDER §6.2–6.4 LUT/snap не исполнен — приоритет D-V-4.

## Расхождения

- **R-V-25.** GPU-голдены Pixi отложены до V12. Критерий «нет `#ff00ff` в кадре» доказан чистым `gradeRgb` + атлас magenta 0.
- **R-V-26.** Подписи — Graphics-плашки без `Pixi.Text`.
- **R-V-14.** sha векторов сдвинулся с `pack_hash`; состав 21 / layout v1 / homes 25 тот же.
- **R-V-24.** Атлас воды 1 кадр.
- Счётчик конструкционных проб в `CONTENT.md` раньше писал 256; живой `len(CONSTRUCTION)` = **266** (три новые V5). Не подогнано задним числом к 256.

## Готовность

Критерий PLAN_VISUAL §4 V5: грейд четырёх фаз не даёт фон-ключ (`frame_has_no_magenta_leak`); в `day` слой свечения ноль (`lights_off_at_day`, `glowGainBps=0`); blend внутри фазы не убывает, на границе следующей фазы 0 (`phase_blend_is_monotonic`). Next: V6 — `render_camera`.

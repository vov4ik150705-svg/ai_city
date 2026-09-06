# V9 final

`hud_screens`: 15 экранов и 11 панелей живые, с пустотой, загрузкой и одним blocking-кодом на кнопке. `build_place`/`commit:build` сняты. `launch.deployed` пуст. Водяной знак 19. `missions_live=0`, краны NFT 0, `companion_revenue_live=0`, `window_a_ratified=1`, `season_prizes_live=1`, `prize_live_min_rules_minor` 19.

Пак **79**, хеш **`407317d028f6a23a9a549a49c754376c94d10bce97365adbc686f1c796a0c185`**, 622145 байт. `rules_version` 0.21.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. Атлас 179 кадров, magenta 0. `layout_hash` `63aa7ce8cc09…` (геометрия не сдвинулась). T9: 34 элемента, 46 действий, unreachable 0.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 353 / 0 |
| `python content/build.py` | 0; pack 79; 622145 байт; hash `407317d0…0c185`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py` | 23 artifacts, hash `407317d0`; `--check` match; `/command/build` нет |
| `python content/attack.py --only L145,L148,L149,L150,L151,L273,L358` | 13/0 пойманы |
| construction три имени V9 | OK на зелёном (None); красный вход внутри каждой |
| `python content/vectors.py` | 21 файл; sha `415b24f9…aae3d7` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 17/0 (14 прежних + 3 V9) |
| contentpack `v0.test.ts` | 5/0 |
| eslint `apps/client/src/hud` + packview/index/demo/v9.test | 0 |
| api `tsc --noEmit` | 0 |

`pnpm` registry на машине падает `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Гейт пакетов — локальные `tsc`/`vitest`. `sim.py` / `builds.py` / `--jobs 8` не в команде этапа (A-V-26). `len(CONSTRUCTION)` = **279**.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `agents` без `empty_kind` | L145 | caught |
| capability с кодом вне `codes.json` | L148 | caught |
| blocking с category `state` | L148 | caught |
| снять `PAYROLL_TRIMMED` с поверхностей | L149 | caught |
| ghost refusal | L149 | caught |
| retired `WALLET_NOT_CONNECTED` | L149 | caught |
| два unlock на `building_upgrade` | L150 | caught |
| `district_open` tier 55 | L151 | caught |
| `wallet_chain` tier 9 | L151 | caught |
| restore `build_place` + `commit:build` | L273 | caught |
| `ghost_screen.tsx` | L358 | caught |
| omit `bank.tsx` | L358 | caught |
| `commit:build` в `build.tsx` | L358 | caught |
| A-V-12 спавн модели | нет | L273/L358; `/command/build` → `API_MALFORMED` |
| A-V-17 payroll | строка только при trim | vitest V8 жив |
| A-V-22 `missions_live` | 0, stub `commit:noop` | L347/L348 зелёные |
| `--jobs 8` в `gate_cmd` этапа | нет (A-V-26) | нет |
| кириллица в компоненте | L343 | construction |
| `city_id` задаёт геометрию | нет | `layout_hash` прежний |

Выстояло (не закрывается кодом V9): GPU-голден Pixi (**R-V-25**, V12); глиф-шрифт подписей (**R-V-26**); один кадр воды (**R-V-24**); различие пикселя GPU; сглаживание шрифта ОС; горячий ключ аттестатора; тонкий пул тестовой сети; `R-M-6`/`R-M-9`/`R-M-10`; TLS npm-attestations.

## Расхождения

- **R-V-34.** L273: посадка снята; коды остаются decodeable + `retired_refusals`.
- PLAN §4 не назвал `missions` в выходах; TZ_HUD §8.2 включает заглушку — **15 экранов, включая missions stub**.
- **R-V-35.** Курс минта / лимит банка / интервал витрины на экранах — pack-derived свидетели `generated.*`, не новый канал снимка.
- Наследуются **R-V-14, 24, 25, 26, 27, 28, 29, 31, 32, 33**. `L353`/`L328` — владелец фазы выхода.

## Готовность

Критерий PLAN_VISUAL §4 V9: матрица T9 покрыта 1:1; онбординг 6 шагов; на выводе без кошелька `WALLET_NOT_CONNECTED`, не Capital. Next: V10 — `companion_screen`.

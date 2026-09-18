# V10 final


Пак **80**, хеш **`e5a1e96cbbd54c7400529201826b2185018a4a6156a5411758c9708bda92d3cd`**, 628079 байт. `rules_version` 0.21.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. Атлас 179 кадров, magenta 0. `layout_hash` `63aa7ce8cc09…`. T9: 35 элементов, 50 действий, unreachable 0.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 354 / 0 |
| `python content/build.py` | 0; pack 80; 628079 байт; hash `e5a1e96c…d3cd`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py` | 23 artifacts, hash `e5a1e96c`; `--check` match |
| `python content/attack.py --only L128,L163,L311,L312,L346` | 21/0 пойманы |
| construction три имени V10 | OK на зелёном; красный вход внутри каждой |
| `python content/vectors.py` | 21 файл; sha `99ef841d…dc63c5` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 20/0 (17 прежних + 3 V10) |
| contentpack vitest | 59/0 |
| eslint `apps/client/src/hud` + packview + v10.test | 0 |
| api/protocol `tsc --noEmit` | 0 |

`pnpm` registry на машине падает `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Гейт пакетов — локальные `tsc`/`vitest`. `sim.py` / `builds.py` / `--jobs 8` не в команде этапа (A-V-26). `len(CONSTRUCTION)` = **279**.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| fragment/prize NFT кран при revenue=0 | L128 | caught |
| relief 0 / cap punch / focus forbidden / live=0 / window A | L311 | caught |
| prize/fragment crane, revenue=1, sink pool/missing, empty interval, split, fund floor | L312 | caught |
| тумблер stub при флаге 1 | L163 | caught |
| settings row stub | L346 | caught |
| A-V-22 `missions_live` | 0, stub `commit:noop` | L347/L348 |
| `--jobs 8` в `gate_cmd` этапа | нет (A-V-26) | нет |
| `city_id` задаёт геометрию | нет | `layout_hash` прежний |

Выстояло (не закрывается кодом V10): GPU-голден Pixi (**R-V-25**, V12); глиф-шрифт подписей (**R-V-26**); один кадр воды (**R-V-24**); различие пикселя GPU; сглаживание шрифта ОС; горячий ключ аттестатора; тонкий пул тестовой сети; `R-M-6`/`R-M-9`/`R-M-10`; TLS npm-attestations.

## Расхождения

- Наследуются **R-V-14, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35**. `L353`/`L328` — владелец фазы выхода.

## Готовность

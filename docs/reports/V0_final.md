# V0 final

`visual_form`: секция `render`, 13 ключей, минор 0.21.0, сцена из пака. `launch.deployed` пуст. Водяной знак 19.

Пак **70**, хеш **`0ae86d41d61f64fec50aae659c1fd1e4b525229868559086932bf2fdbccce0d4`**, 607013 байт. `rules_version` 0.21.0. `frame_budget_us` 16666.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 331 / 0 |
| `python content/build.py` | 0; pack 70; 607013 байт; hash `0ae86d41…cce0d4`; rules 0.21.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py` | 23 artifacts match `0ae86d41` |
| `python content/attack.py --only L306,L329,L347,L348,L353` | 16/0 пойманы |
| `python content/vectors.py` | 21 файл; sha `b8e6872f…f89decff` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25 полей, тот же инвентарь |
| contentpack `tsc --noEmit` + `vitest run` | tsc 0; vitest 53/0 (16 files) |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 10/0 (3 files) |
| пять конструкций V0 | OK на зелёном; красный вход внутри каждой |
| два `build_world` | `layout_hash` `6bde21dd…` = `6bde21dd…` |
| `apps/client/src` `scene.json?url` | нет |

`pnpm` не в PATH; гейт пакетов — локальные `tsc`/`vitest`. `sim.py` / `builds.py` / `--jobs 8` не в команде этапа. `--jobs 8` **нет** в `visual_form.gate_cmd`.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `scene.json?url` в client overlay | L329 | caught |
| `art/out/scene.json` import | L329 | caught |
| `layout_hash` нули | L329 | caught |
| `missions_live=1` | L347 | caught |
| `missions_start` live commit | L347 | caught |
| семь сдвигов замороженных флагов | L348 | caught ×7 |
| `L328` в `mainnet_launch.gate_cmd` | L353 | caught |
| минор 0.19.0 / снят v11_form / пустые рычаги | L306 | caught ×3 |
| снят `visual_form`; 14-й ключ после `ops_watch` | construction | caught |
| ghost `art_atlas.construction_tests` | construction | caught |
| `visual-phase.mdc` alwaysApply | construction | classified |
| вставка `ghost_p` после `ops_watch` | release filter | caught |

`--jobs 8` в шаговом `gate_cmd` нет (A-V-26). Дисковый `art/out` не источник: клиент читает пак (A-V-1).

Выстояло (не закрывается кодом V0): различие пикселя GPU, сглаживание шрифта ОС, горячий ключ аттестатора, тонкий пул тестовой сети, `R-M-6`/`R-M-9`/`R-M-10`.

## Расхождения

- **R-V-3.** Потолки §7 как первая редакция. Пересчёт — V12.
- **R-V-8.** `L328` снят из живого `gate_cmd`; L353 ловит вставку. Регистрация — P7.
- **R-V-14.** sha векторов сдвинулся с `pack_hash`; состав 21 / layout v1 / homes тот же.
- **R-V-19.** V1–V12 в паке цитируют только зарегистрированные L id до своего этапа.
- **L164.** Голый `D-V-22` в `SCREENS.md` — в backticks.

## Готовность

Критерий PLAN_VISUAL §4 V0 выполнен командами выше. Next: V1 — атлас RGBA + glow, манифест `foot_anchor`.

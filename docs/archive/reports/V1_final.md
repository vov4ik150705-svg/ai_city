# V1 final

`art_atlas`: RGBA + glow + манифест `foot_anchor`. `launch.deployed` пуст. Водяной знак 19.

Пак **71**, хеш **`21bbfc661c331bfc2969c46711d16e9ed5a47abe5cb7ae0d08eb66f3e53c75aa`**, 608709 байт. `rules_version` 0.21.0. Атлас: 166 кадров, 1 страница, 2490702 B, opaque magenta 0, glow buildings 27, sha `3a7d5c744297…c653137`.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 334 / 0 |
| `python content/build.py` | 0; pack 71; 608709 байт; hash `21bbfc66…3c75aa`; rules 0.21.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783]; `layout_hash` `6bde21dd…` без сдвига |
| `python content/codegen.py` | 23 artifacts match `21bbfc66` |
| `python content/attack.py --only L330,L331,L332,L178` | 8/0 пойманы |
| construction `atlas_*` ×3 | OK на зелёном; красный вход внутри каждой |
| два `pack_atlas(write=False)` | sha/png/glow = диску, байты 2490702 = 2490702 |
| `python content/vectors.py` | 21 файл; sha `706cf632…dbe3cb6` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25 полей, тот же инвентарь |
| contentpack `tsc --noEmit` + `vitest run` | tsc 0; vitest 56/0 (17 files) |

`pnpm` не в PATH; гейт пакета — локальные `tsc`/`vitest`. `sim.py` / `builds.py` / `--jobs 8` не в команде этапа. `--jobs 8` **нет** в `art_atlas.gate_cmd`. `packages/render` нет.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| снят sha атласа | L330 | caught |
| `atlas_max_bytes = 2490701` | L330 | caught |
| обмен x/y двух кадров | L330 | caught |
| непрозрачная магента / key-out off | L331 | caught ×2 |
| city.png mode RGB | L332 | caught |
| glow зданий занулён | L332 | caught |
| спека 5×3 | L178 | caught |
| порядок обхода id реверс при `sort_ids=True` | тот же shelf (A-V-3) | инвариант; без сортировки полка другая |
| `--jobs 8` в шаговом `gate_cmd` | нет (A-V-26) | нет |

Выстояло (не закрывается кодом V1): различие пикселя GPU, сглаживание шрифта ОС, горячий ключ аттестатора, тонкий пул тестовой сети, `R-M-6`/`R-M-9`/`R-M-10`.

## Расхождения

- **R-V-20.** Кадр масштабируется к футпринту; `*_v2.png` не переписываются.
- **R-V-21.** TS-гейт V1 — contentpack, не `@corporator/render`.
- **R-V-14.** sha векторов сдвинулся с `pack_hash`; состав 21 / layout v1 / homes тот же.

## Готовность

Критерий PLAN_VISUAL §4 V1 выполнен командами выше. Next: V2 — `art_content`, кубы земли, ребаланс декора (R-V-7).

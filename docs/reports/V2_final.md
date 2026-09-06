# V2 final

`art_content`: плотность мокапа, двухъярусные кубы, легенда земли. `launch.deployed` пуст. Водяной знак 19.

Пак **72**, хеш **`40e02f7bf3f3cb1b5927cb4ced0c6464c0729373f9977f69b15f6f1064077bc6`**, 610137 байт. `rules_version` 0.21.0. Атлас: 175 кадров, 1 страница, 2563249 B, opaque magenta 0, sha `ec1cc3a5dc61`. `layout_hash` `63aa7ce8cc09…a2fb7963`. `decor_realized_share_bps` **1411** (цель 1200 ±400). Деревья 305. Сцена 63×63, 466 objects.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 336 / 0 |
| `python content/build.py` | 0; pack 72; 610137 байт; hash `40e02f7b…077bc6`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py` | 23 artifacts match `40e02f7b` |
| `python content/attack.py --only L169,L174,L184,L186,L187,L189,L190,L191,L354,L355` | 11/0 пойманы |
| construction `new_ground_kinds_registered`, `decor_share_within_band`, `beacon_has_logo_and_ticker` | OK на зелёном; красный вход внутри каждой |
| `python art/pipeline/layout.py` | 63 rows, 466 objects, hash = пак |
| `python content/world.py` ×8 сидов | один вектор `counters` (L175) |
| `python art/pipeline/scene.py --grid` | `scene.png` 4112×2201; magenta 0; TZ_ART §6 |
| `python content/vectors.py` | 21 файл; sha `69a910a8…e45608ce` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| contentpack `tsc --noEmit` + `vitest run` | tsc 0; vitest 59/0 (18 files) |

`pnpm` не в PATH; гейт пакета — локальные `tsc`/`vitest`. `sim.py` / `builds.py` / `--jobs 8` не в команде этапа. `packages/render` нет.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| extra kind `x` в tiles без легенды | L354 | caught |
| символ карты `x` | L354 | caught |
| с `finance_tower` снят `sign_box` | L355 | caught |
| `decor_target_share_bps=9000` | L174 | caught (1749 vs 9000±400) |
| период дорог 4 | L169 | caught |
| ручной `art/pipeline/scene.json` | L184 | caught |
| `water_margin_tiles=0` | L186 | caught |
| лот на берегу | L187 | caught |
| фонари без night/dusk | L189 | caught |
| машина → ключ модификатора | L190 | caught |
| джиттер перевернул квартал | L191 | caught |
| водопад на unjittered shore, тайл ушёл в воду | карта без `w` | найдено, закрыто: живой берег |
| preview без key-out | кадр сплошная магента | найдено, закрыто: `scene.py` key-out |
| подмена `art/out/scene.json` | клиент читает пак (A-V-1) | `layout.py` не пишет `art/out` |
| `--jobs 8` в шаговом `gate_cmd` | нет (A-V-26) | нет |
| `pixelize.py` на v2 | не гонялся | не гонялся |
| восемь сидов | counters идентичны (L175) | 1 blob |

Выстояло (не закрывается кодом V2): различие пикселя GPU, сглаживание шрифта ОС, горячий ключ аттестатора, тонкий пул тестовой сети, `R-M-6`/`R-M-9`/`R-M-10`, слабый тикер на крыше части маяков (R-V-23).

## Расхождения

- **R-V-7.** 1411 в полосе; цель 1200 не двигалась.
- **R-V-22.** `layout.py` только сверка хеша.
- **R-V-23.** `sign_box` вычислен, PNG маяков не переписывались.
- **R-V-24.** Нет 15-кадрового автотайла и нет TZ_ART §4.5–4.7 (V7/V4/pending).
- **R-V-14.** sha векторов сдвинулся с `pack_hash`; состав 21 / layout v1 / homes тот же.

## Готовность

Критерий PLAN_VISUAL §4 V2 выполнен командами выше. Next: V3 — `render_ground`, пакет `packages/render`, кубы в PixiJS.

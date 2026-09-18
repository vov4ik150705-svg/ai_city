# TZ_ART final — арт-контент закрыт

Не этап V13 и не P7. `launch.deployed` пуст. `missions_live=0`, краны NFT 0. `rules_version` 0.21.0. Пак **84**, хеш **`507c09076ba0e353fb1886347cff16a3c4acf6a6013d9ef64201f5a57f4cbf2e`**, 632402 байт. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. Атлас 218 кадров, 1 страница, 2943684 B (+ `font.png` 3025 B в digest, не в `atlas_bytes`), magenta 0, sha `067b1c84ff41`. `layout_hash` `9ed5d3f99673…` (сдвиг от пешеходов в `scene.objects`, не от экономики). Объекты 504, walkers 38 на `s`, 0 на лотах. Глифы 146. `bird` в реестре.

## Что закрыто

| пункт ТЗ | факт |
|---|---|
| §4.4 `bird` | `assets/fx/bird_v2.png`, кадр атласа, `birdVisible(city_time)` |
| §4.5 / §4.6 | ART_FRAMES (пак 83); здесь не перерисовывались |
| §4.7 пешеходы | семья `walker_*` на `s`, `background=1`, без `agent_id` и клика. Поток PRNG `walker`. Не в `decor` / `vehicle_count` (L174 = 1411) |
| §5 битмап-шрифт | `art/pipeline/font.py` + `glyphs.txt`; `font.png`; плашки + блиты; строки `UI_BLD_*` |
| R-V-12 | закрыт посадкой, не через `assets_pending` |
| R-V-26 | закрыт глиф-атласом сцены |

`glow_small` / `glow_large` не рисовались: `glow_window=200` > 0, ТЗ необязательны. 16-way автотайл и 4 кадра воды закрыты в `R_V_24.md` (пак 85). Четыре направления `agent_walker` нет: **R-V-39**.

L190 расширен: walkers на лоте, с ключом, `background≠1`, или легенда ≠ `s`.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 84; 632402 B; hash `507c0907…4cbf2e`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py --check` | 23 artifacts, hash `507c0907` |
| `python content/lint.py` | 357 / 0 |
| `python content/attack.py --only L09,L174,L175,L178,L183,L190,L195,L329,L330,L331,L338,L340,L343,L344,L345,L351` | 31/31 пойманы |
| `python content/attack.py --only L190,L351` | 7/7 (walker lot / `~` / observe) |
| `python content/attack.py --jobs 8` | 357 covered; construction 280 held; SURVIVED 0; 18.6s (правлены `lint.py`/`attack.py`) |
| `python content/vectors.py` | 21 файл; sha `7ef9a0c6…8eee30` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| render `tsc --noEmit` + vitest | tsc 0; vitest 18/0 |
| client `tsc --noEmit` + vitest | tsc 0; vitest 20/0 |
| eslint render/client (правленые) | 0 |

`sim.py` не в команде этого закрытия. `GATE_VISUAL.md` observe: sprites=504, atlas_bytes=2943684, bundle_bytes=1002840.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| пешеход на лоте | L190 | caught `walker_exosuit` at 28,28 |
| пешеход на `~` | L190 | caught legend `'~'` |
| машина с ключом модификатора | L190 | caught |
| первая посадка walkers на `p` | только `s` | **нашлось**, закрыто фильтром `ch == "s"` |
| L190 не смотрел walkers | правило-декорация | **нашлось**, L190 расширен + пробы lot/`~` |
| `decor_target` 9000 | L174 | caught 1749 vs 9000; факт 1411 (walkers вне доли) |
| счётчики от сида | L175 | caught |
| cap атласа − 1 | L330 | caught 2943684 vs 2943683 |
| непрозрачная магента в атласе | L331 | caught |
| `Math.random` в motion | L338 | caught |
| `const CHUNK = 8` | L340 | caught |
| кириллица в App.tsx | L343 | caught |
| CDN-шрифт | L344 | caught |
| observe = порог | L351 | caught |
| пустой `glyphs.txt` / нет `font.png` | L330 | caught (R-V-40) |
| jobs 8 construction `background_units_hold_no_lot` | walker lot / off-sidewalk | held |

## Расхождения

- **R-V-12** закрыт. **R-V-26** закрыт. **R-V-24** закрыт.
- **R-V-39** закрыт в `R_V_39.md`: 16 flip `_w`, heading по тротуару.
- **R-V-40** закрыт в `R_V_40.md`: пустые глифы / нет font.png роняют L330; font в `atlas_bytes`.
- **R-V-41** закрыт в `R_V_41.md`: `sprite_h`, earth-кубы, пляж-дуга, все скины walker/robot, мебель в бюджете L174.
- **R-V-43** закрыт в `R_V_43.md`: кластер заполнителя, изгородь на фасаде пустого лота, пол высоты зданий, трава `island_block`, мини-остров не куб суши.
- **R-V-11** закрыт в `R_V_11.md`: `warn()` на L174 в полосе, но не на цели.
- **R-V-38.** GPU-голден Pixi / fps на этом хосте нет.
- Принятые: различие пикселя GPU; сглаживание шрифта ОС; горячий ключ аттестатора; тонкий пул тестовой сети; `R-M-6`/`R-M-9`/`R-M-10`. `glow_small`/`glow_large` не рисовались (ТЗ: необязательны при `glow_window>0`).

## Готовность

TZ_ART исполнен в границах D-V-12. Форма денег не сдвинута. Миссии выключены. Краны NFT 0. P7 не начат. Next: не V13; R-V-5 (тестовая сеть) у владельца.

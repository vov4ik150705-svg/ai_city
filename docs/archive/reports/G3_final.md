# G3 final

`research_tree`: пять осей; цена fused `steps=0`; объектив `research` открывает узел за compute. `launch.deployed` пуст. Водяной знак призов 19.

Пак **58**, хеш **`cc83992b51883aed8caccf61eb5a83223d747ee3fa8f9726736596d557763028`**, 561482 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 58; 561482 байт; hash `cc83992b…55763028`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/lint.py` | 309 / 0 |
| `python content/codegen.py --check` | 19 artifacts match `cc83992b` |
| `python content/vectors.py` | 21 files; sha256 `7e11cd35e13fce911ad865057efbcccd02c6566c20f22f1f67e25127e1f419af` |
| `python content/builds.py` | dominating 0 dead 0 mandatory 0 uncovered 0; justified 6321 |
| `python content/attack.py --only L61,L62,L68,L71,L309` | targeted caught; 11 probes |
| `pnpm --filter @corporator/engine run gate` | tsc 0; vitest 25/0 (4 files) |

`sim.py` на G3 не гейт (не band). Полный `--jobs 8` не гейт шага.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| четвёртый узел с ценой | L309 | caught (`A-G-3`) |
| оси снова тройка | L309 | caught |
| research.v1 false | L309 | caught |
| cfg `research_objective=""` | L309 | сначала мимо хелпера; закрыто проверкой src |
| дубль `output_bps` | L309 | caught |
| `offline_cap_hours` на оси | L309 | caught (`A-G-10` сосед) |
| `fund_share` / `idle_reduction` | L309 | caught |
| литерал effect/cost на оси | L309 | caught |
| generated.cost +1 | L309 | **выстояло**: `_t2` пересчитывает из осей |
| compute+energy | L309 | caught (`A-G-8`) |
| keys без compute | L309 | caught |
| L77 free output +500 | L77 | caught (`A-G-10`) |
| produce / empty / need=0 | no-op | (0,0) |
| три конструкции G3 | L309 | OK на зелёном; красный внутри |
| L61/L62/L68/L71 | гейт | 7/7 caught |
| robotics_lab | не тронут | не тронут |
| повторный флип призов | A-G-17 | `season_prizes_live` остался 1 |
| `launch.deployed` | A-G-2 | пять полей пустые |
| подгонка окна A | A-G-11 | не подогнано; окно то же |

Выстояло (принято): оверлей `generated.research_nodes.cost` — узлы из осей, не из generated; `R-T8-2`; `R-T5-12`. Окно не подогнано (`A-G-11`).

## Расхождения

Новых `R-G-*` нет. v1 цены Grid/Tools/Handbook не сдвинулись (`steps=0`).

## Незакрытое



Next Step: **G4** — `synergy_buildings` (пять зданий правилом «оба района играбельны»; матрица аффинити с каноном).

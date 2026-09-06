# R-V-46 final

Не P7. `launch.deployed` пуст. `rules_version` 0.21.0. `pack_version` 91. Хеш `2f7a7f57f327f1edfed1dd2a7e35feea7835f112d0f531b014a869af14407c5a`. Круг 1445, вход 200, выход 910. Окно A не сдвигалось. `missions_live=0`.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 361/0 (WARN L174: realized 1198 vs target 1200, в полосе ±400) |
| `python content/build.py` | 0; layout_hash `4d55051d84fa`; atlas 269/2271708 B |
| `python content/codegen.py` | 23 артефакта под тот же хеш |
| `python content/attack.py --only L359,L360,L361,L362,L169,L174,L175,L178,L192,L193,L268,L319,L330` | 24/24 |
| construction L359–L362 | 4/4 red+green |
| `python content/vectors.py` | 21 файл; sha `b85f6f2f…299c1f` (сдвиг с pack_hash, R-V-14); layout_version 1; `record_field_homes` 25, тот же инвентарь |
| render `tsc --noEmit` + vitest | 22 passed (после пересъёма GATE_VISUAL и probes) |
| `python art/pipeline/scene.py --grid` | scene.png 4112×2200; scene_grid.png |

`sim.py` и полный `--jobs 8` не гейт шага.

## Атаки (этот шаг)

Проведено 24 + 4 construction. Выстояло 0. Сработало:

- L359 `agent_hub.w=235` > футпринт 128
- L360 `residential_block` встык к `flagship_store`
- L361 `phone_booth` на `.`
- L362 overlay без `placeWaterPlane` / цикл `placeCube` по `~`
- L175 лоты от сида; L174 target 9000 и лес overlay; L169/L178/L192/L193 как раньше
- L268 пустой `ts_gate_cmd` / пустые construction_tests; L319 `--jobs 8` на push; L330 sha/cap/shelf

Дополнительно закрыто здесь: `tree_count` зависел от `zone_rotation` (pool=count) — теперь `n_trees=min(cap, room)=105`, добор с тротуаров; дерево на `~` после shore jitter — `dry_cell` + L361 на `~`.

## Расхождения

**R-V-46** — грамматика кубов и районов (этот шаг). Принятые, кодом не закрываемые: различие GPU-пикселя (R-V-38), L174 1198≠1200 в полосе, `L353`/`L328` фазы выхода.

## Next

Студия — ручная полировка после зелёного генератора. P7 не начинать.

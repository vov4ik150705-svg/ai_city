# G7 — код

`rebalance_close`: четыре рычага вместе; доминирование на всех `C(6,3)` 3-кубах; окно A ратифицировано флагом; пак опубликован. `launchToken` не подписывался. Водяной знак призов 19. `rules_version` 0.20.0.

## Решение

Ратификация = `meta.params.window_a_ratified=1`, не копия окна A (L47/L68/L281). Конверт T2 не подогнан (`A-G-11`). Семья билдов: все 20 троек играбельных районов + одиночные + пары merge. Не 15^6 (`R-G-5`): полный декарт сделает lint ночным прогоном (`A-G-16`). 3-open тир-1, который не выигрывает ни одну пару (сценарий, цель), закрыт свидетелем `cube_slice` — тот же класс, что G1 `pair_slice` для 2-open.

## Пак

`meta.json` — `pack_version` 62, `window_a_ratified` 1. `arch.json` — три `construction_tests`. Конверт 3500–4500 / 7000–9000 не двигался.

## Код

`content/builds.py` — `combinations` всех 3-кубов; fingerprint `all_3cubes_cube_slice_when_six_live`; свидетель `cube_slice`. `content/lint.py` — `l313_rebalance_close`; RULES 313; `builds_gate` не вызывает `analyse()` (промах отпечатка роняет L63–L69, а не пересчитывает 131k). `content/attack.py` — семь проб L313, три конструкции, `REBALANCE_CLOSE_CONSTRUCTION` в `expected_ct`.

## Тесты

`packages/contentpack/test/g7.test.ts` — имена проб дословно (ts_gate workspace). `packages/contentpack/test/g0.test.ts` — ветка `rebalance_close` и флаг в инвентаре.

## Документы

`docs/BALANCE.md` §6: флаг, конверт не подогнан. `docs/PROGRESSION.md` §7: семья C(6,3) + `cube_slice`. `docs/CONTENT.md` L313, 313 правил, пак 62 / 562954. `docs/SIMULATION.md` §10: T8 перегоняет sim; G7 ратифицирует флагом.

# V3-1 final

`visual3_engine`: Three.js остров из легенды пака, орбита из `orbit_*`, `RENDER_NO_GPU`. `launch.deployed` пуст. P7 не начат. Pixi не удалён. GLB и солнце не этого этапа.

Пак **122**, хеш **`20956666e3699bc94f850797786eb5b5abf7a451e592da1fe741c7b0570080cc`**, 640789 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. `layout_hash` `7c090c51a1ea…`. Декор 1087 bps (L174 warn). `visual3_frame_live=1`. `orbit_distance_default_tiles` 69. `missions_live=0`. Краны NFT 0.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 371 / 0 |
| `python content/build.py` | 0; pack 122; hash `20956666…0080cc`; круг 1445; вход 200; выход 910 |
| `python content/codegen.py` | 23 artifacts, тот же hash |
| `python content/attack.py --only L370,L348,L371,L372,L373` | 20/20 пойманы |
| `python content/vectors.py` | 21 файл; sha `870923f6…527248` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| `python content/attack.py --only L317` | 2/2 |
| render `tsc --noEmit` + `vitest run test/v31.test.ts` | tsc 0; vitest 3/0 |
| contentpack `tsc --noEmit` + `vitest run` | tsc 0; vitest 60/0 (18 files) |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 20/0 (6 files) |
| eslint changed TS | 0 |

`--jobs 8` нет в `visual3_engine.gate_cmd`. `sim.py` / `builds.py` не в команде этапа. `pnpm` registry: TLS; гейт — локальные бинарники (`corepack pnpm` висит на lockfile verify).

## Атаки

| вход | ожидание | факт |
|---|---|---|
| снят `visual3_form` | L370 | caught |
| ghost после `visual_close` | L370 | caught |
| CT `visual3_engine` ghost / пуст | L370 | caught ×2 |
| минор 0.21.0 | L370 | caught |
| шесть сдвигов L348 (не флаг кадра) | L348 | caught |
| `visual3_frame_live=0` | L371 | caught (A-V3-4) |
| нет `from "three"` | L371 | caught (A-V3-13) |
| Pixi как живой кадр | L371 | caught (A-V3-12) |
| снят pin `threejs` | L371 | caught |
| `--jobs 8` в engine `gate_cmd` | L372 | caught (A-V3-14) |
| stub `--only L370` | L372 | caught |
| дистанция = `zoom_levels` | L373 | caught (R-V-83) |
| tilt min ≥ max | L373 | caught |
| нет `orbit.ts`/`clampOrbit` | L373 | caught |
| `owner_address` в спеке записи | L317 | caught |
| полный render vitest (`scene.png`, `sprites=669`) | архив `V12` красный | найдено, не закрыто кодом острова (`R-V-84`) |
| `vehicles[0]` на `.` | motion on-road | найдено, `layout_hash` не двигаем (`R-V-85`) |

Выстояло: 20/20 шаговых проб; GPU/шрифт ОС; горячий ключ аттестатора; тонкий пул testnet; R-M-6/9/10; R-V-8 (L328 нет). TLS/`pnpm add` — среда, не канон.

## Расхождения

R-V-73…R-V-85. R-V-81…83 закрыты этим этапом. R-V-84/85 названы, не лечатся пересъёмкой `V12` и не правкой `world.py`.

## Готовность

Критерий `PLAN_VISUAL_V3` §11 выполнен. Next: V3-2 — 18 GLB по id зданий, LOD; `commit:build` по-прежнему сажает лот.

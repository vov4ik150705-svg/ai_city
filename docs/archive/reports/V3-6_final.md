# V3-6 final

`visual3_world`: декор, вода, fill без физики. `launch.deployed` пуст. P7 не начат. Pixi не удалён.

Пак **127**, хеш **`9bb7952b66a92e16913a54d46b30bd3050ee2a1bd7b2a95518679b8869c7f5ce`**, 654978 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. `layout_hash` `7c090c51a1ea…`. Декор 1087 bps (L174 warn). `visual3_frame_live=1`. `missions_live=0`. Краны NFT 0.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 381 / 0 |
| `python content/build.py` | 0; pack 127; hash `9bb7952b…c7f5ce`; круг 1445; вход 200; выход 910 |
| `python content/codegen.py --check` | 23 artifacts, тот же hash |
| `python content/attack.py --only L370,L372,L382,L383` | 38/38 пойманы |
| construction `visual3_water_one_plane` / `decor_instanced` / `fill_light_no_physics` | held (красные входы внутри проб) |
| `python content/vectors.py` | 21 файл; sha `172ef689…64fad3` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| `python content/attack.py --only L317` | 2/2 |
| render `tsc --noEmit` + `vitest run test/v31.test.ts` … `test/v36.test.ts` | tsc 0; vitest 18/0 |
| contentpack `tsc --noEmit` + `vitest run` | tsc 0; vitest 60/0 (18 files) |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 20/0 (6 files) |
| eslint changed TS | 0 |
| depcruise `packages/render` | 0 (93 modules) |

`--jobs 8` нет в `visual3_world.gate_cmd`. `sim.py` / `builds.py` не в команде этапа. `pnpm` не в PATH; гейт — локальные `tsc`/`vitest`/`eslint`/`depcruise`.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| снят `visual3_form` / ghost / CT engine·assets·light·input·units·world ghost/пуст / минор 21 | L370 | caught ×15 |
| `--jobs 8` / stub `--only L370` engine / assets / light / input / units / world | L372 | caught ×10 |
| нет `plantWater` / `landCells` / `shoreFoam` / `HemisphereLight` | L382 | caught ×4 |
| `HemisphereLight` без `fill.intensity` | L382 | найдено на ревю, закрыто: caught ×1 |
| нет `plantDecor` / 1×1 / нет `InstancedMesh` / нет `poseVehicle` / height=0 / physics / `Math.random` / `vehicle_` в pick | L383 | caught ×8 |
| construction три пробы | красные входы | held |
| `owner_address` в спеке записи / `layout_version` 2 | L317 | caught ×2 |
| полный render vitest (`scene.png`, `sprites=669`) | архив `V12` красный | найдено, не закрыто (`R-V-84`) |
| `InstancedMesh` без `setMatrixAt` | L383 identifier-gate | выжило: живой кадр штампует матрицы; тот же класс, что остальные visual3 source-gates |

Выстояло: 38/38 шаговых + 3 CT. GPU/шрифт ОС; горячий ключ аттестатора; тонкий пул testnet; R-M-6/9/10; R-V-8 (L328 нет). Полный `--jobs 8` на шаге не гонялся (A-V3-5), хотя правились `lint.py`/`attack.py`; закрытие — V3-7. Кадр мира на GPU не снимался: `GATE_VISUAL.md` — V3-7.

## Расхождения

R-V-73…R-V-90. R-V-82: world цитирует L382/L383; поздний `visual3_close` всё ещё `--only L370`. R-V-84: gate render включает `v36.test.ts`. R-V-85: 151/161 машин на `.`. R-V-90: hemi поверх ambient; toy-боксы до Meshy-декора.

## Готовность

Критерий `PLAN_VISUAL_V3` §16 выполнен. Next: V3-7 — полный прогон и публикация пака.

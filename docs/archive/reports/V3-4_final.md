# V3-4 final

`visual3_input`: луч в тайл сетки, BUILD, стейк, HUD не дырявый. `launch.deployed` пуст. P7 не начат. Pixi не удалён. `App` без `districts_opened` (`R-V-88`).

Пак **125**, хеш **`c3acd9ee4eb49a8eb3980bb915c435ca4c8172e8133b89c769e2d2d3c6b5a17f`**, 652382 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. `layout_hash` `7c090c51a1ea…`. Декор 1087 bps (L174 warn). `visual3_frame_live=1`. `missions_live=0`. Краны NFT 0.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 377 / 0 |
| `python content/build.py` | 0; pack 125; hash `c3acd9ee…b5a17f`; круг 1445; вход 200; выход 910 |
| `python content/codegen.py` | 23 artifacts, тот же hash |
| `python content/attack.py --only L370,L372,L378,L379` | 24/24 пойманы |
| construction `visual3_ray_hits_tile` / `empty_opens_build` / `hud_not_a_hole` | held (красные входы внутри проб) |
| `python content/vectors.py` | 21 файл; sha `1a1c0ab4…6a95dc60d` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| `python content/attack.py --only L317` | 2/2 |
| render `tsc --noEmit` + `vitest run test/v31.test.ts test/v32.test.ts test/v33.test.ts test/v34.test.ts` | tsc 0; vitest 12/0 |
| contentpack `tsc --noEmit` + `vitest run` | tsc 0; vitest 60/0 (18 files) |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 20/0 (6 files) |
| eslint changed TS | 0 |

`--jobs 8` нет в `visual3_input.gate_cmd`. `sim.py` / `builds.py` не в команде этапа. `pnpm` registry: TLS (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`); гейт — локальные `tsc`/`vitest`/`eslint`.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| снят `visual3_form` / ghost / CT engine·assets·light·input ghost/пуст / минор 21 | L370 | caught ×9 |
| `--jobs 8` / stub `--only L370` engine / assets / light / input | L372 | caught ×6 |
| `--jobs 8` в `visual3_input.gate_cmd` (extra в наборе) | L372 | caught |
| нет `pickFromRay` / iso `tileFromWorld` / нет `Raycaster` | L378 | caught ×3 |
| нет повторного луча в `waterY` | L378 | caught; дыра закрыта в правиле |
| `kind` не `building` / `pointer-events: none` на `.hud-col` / нет `hudBlocksPick` | L379 | caught ×3 |
| луч снизу вверх в плоскость суши (vitest miss) | пустая клетка | найдено: это попадание; тест сменён на луч от плоскости |
| `owner_address` в спеке записи / `layout_version` 2 | L317 | caught ×2 |
| полный render vitest (`scene.png`, `sprites=669`) | архив `V12` красный | найдено, не закрыто (`R-V-84`) |
| HUD-снимок без `districts_opened` | живой стейк всех маяков | принято (`R-V-88`) |

Выстояло: 24/24 шаговых + 3 CT. GPU/шрифт ОС; горячий ключ аттестатора; тонкий пул testnet; R-M-6/9/10; R-V-8 (L328 нет). TLS/`pnpm` — среда, не канон. Полный `--jobs 8` на шаге не гонялся (A-V3-5); закрытие — V3-7. Кадр пика на GPU не снимался: `GATE_VISUAL.md` — V3-7. Вода → экран `build` + `BUILD_TILE_ILLEGAL` через `tileBad` (`R-V-55`).

## Расхождения

R-V-73…R-V-88. R-V-82: input цитирует L378/L379; поздние ключи V3-5…V3-6 всё ещё `--only L370`. R-V-84: gate render включает `v34.test.ts`. R-V-88 принято: пустая карта opened.

## Готовность

Критерий `PLAN_VISUAL_V3` §14 выполнен. Next: V3-5 — агенты.

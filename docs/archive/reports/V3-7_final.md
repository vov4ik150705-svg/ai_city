# V3-7 final — паспорт входа в P7


Пак **128**, хеш **`104c68788d738984332b884f9d67d576866b2eb82655d2c7d73bae5815d330cf`**, 655227 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783], A_t2 **14217**. `layout_hash` `7c090c51a1ea…`. `visual3_frame_live=1`.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 382 / 0 |
| `python content/build.py` | 0; pack 128; 655227 байт; hash `104c6878…d330cf`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py --check` | 23 artifacts, hash `104c6878` |
| `python content/attack.py --only L370,L384,L351,L317` | 27/27 пойманы |
| construction `visual3_budgets_measured` / `visual3_golden_frames_match` | held (красные входы внутри проб) |
| `python content/attack.py --jobs 8` | 382 rules covered; construction 306 held; SURVIVED 0; 34.1s |
| `python content/sim.py` | calibration A_t2=14217; окно A не сдвинуто |
| `python content/vectors.py` | 21 файл; sha `33c1ad73…da20c9` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| render `tsc --noEmit` + `vitest run test/v31.test.ts` … `test/v37.test.ts` | tsc 0; vitest 20/0 |
| render `vitest run test/v12.test.ts` | 2/0 (после `scene.png` = fallback) |
| contentpack `tsc --noEmit` + `vitest run` | tsc 0; vitest 60/0 (18 files) |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 20/0 (6 files) |
| eslint changed TS | 0 |
| depcruise `packages/render` | 0 (94 modules) |

`pnpm` registry на машине может падать TLS; эквивалент `pnpm -w run gate`: локальные `tsc`/`vitest`/`eslint`/`depcruise`. `builds.py` не в команде этапа.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| снят `visual3_form` / ghost / CT ghost/пуст engine…world/close / минор 21 | L370 | caught ×17 |
| `--jobs 8` снят с close / нет `sim.py` / нет `observeVisual3Budgets` / заголовок V12 | L384 | caught ×4 |
| `observedFromThresholds` / observe=4096 / нет GATE / нет `observeVisualBudgets` | L351 | caught ×4 |
| `owner_address` в спеке записи / `layout_version` 2 | L317 | caught ×2 |
| construction две пробы | красные входы | held |
| `missions_live` / NFT / revenue | нули | L348 |
| `launch.deployed` | пять пустых | команда |
| `city_id` задаёт геометрию | `layout_hash` прежний | `7c090c51a1ea…` |
| `--jobs 8` в шаговом `gate_cmd` | L372 | held (не в close) |
| `--jobs 8` в `visual3_close` | должно быть | есть (L384 / D-V3-16) |
| полный render vitest архива `V12` | `scene.png` + sprites=483 | held (`R-V-84` закрыт) |

Выстояло: 27/27 шаговых + 2 CT + полный `--jobs 8`. GPU/шрифт ОС; горячий ключ аттестатора; тонкий пул testnet; R-M-6/9/10; R-V-8 (L328 нет); R-V-38 (desktop = software); R-V-85 (151/161 машин на `.`); R-V-91 (суша — меш на клетку).

## Расхождения

R-V-73…R-V-91. R-V-82: close цитирует `--jobs 8`/`sim.py` и два CT. R-V-84 закрыт пересъёмкой. R-V-85 не закрыт кодом (layout_hash). R-V-91: потолок draw 4096 с замера 3273.

## Готовность

Критерий `PLAN_VISUAL_V3` §17 выполнен. Форма денег не сдвинута. Миссии выключены. Краны NFT 0. Next: **P7** только по решению владельца — эта фаза его не начинает.

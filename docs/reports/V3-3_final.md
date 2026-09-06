# V3-3 final

`visual3_light`: сутки — направленное солнце и emissive окон/вывесок от `city_time`. Albedo без запечённого солнца. Остров Lambert. `launch.deployed` пуст. P7 не начат. Pixi не удалён. Meshy emission map нет (`R-V-87`).

Пак **124**, хеш **`8212821fff632bb23a54efc30b76e1711a81a0e0e0d7a85e6d30d1b9ca85924f`**, 651978 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. `layout_hash` `7c090c51a1ea…`. Декор 1087 bps (L174 warn). `visual3_frame_live=1`. `missions_live=0`. Краны NFT 0. Каталог 18; файлов GLB 36.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 375 / 0 |
| `python content/build.py` | 0; pack 124; hash `8212821f…85924f`; круг 1445; вход 200; выход 910 |
| `python content/codegen.py` | 23 artifacts, тот же hash |
| `python content/attack.py --only L370,L372,L376,L377` | 22/22 пойманы |
| construction `visual3_sun_from_city_time` / `windows_emissive` / `no_baked_sun` | held (красные входы внутри проб) |
| `python content/vectors.py` | 21 файл; sha `8a1450d5…8dc495` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| `python content/attack.py --only L317` | 2/2 |
| render `tsc --noEmit` + `vitest run test/v31.test.ts test/v32.test.ts test/v33.test.ts` | tsc 0; vitest 9/0 |
| contentpack `tsc --noEmit` + `vitest run` | tsc 0; vitest 60/0 (18 files) |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 20/0 (6 files) |
| eslint changed TS | 0 |

`--jobs 8` нет в `visual3_light.gate_cmd`. `sim.py` / `builds.py` не в команде этапа. `pnpm` registry: TLS (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`); гейт — локальные `tsc`/`vitest`/`eslint`.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| снят `visual3_form` / ghost / CT engine·assets·light ghost/пуст / минор 21 | L370 | caught ×9 |
| `--jobs 8` / stub `--only L370` engine / assets / light | L372 | caught ×4 |
| `--jobs 8` в `visual3_light.gate_cmd` (extra) | L372 | caught |
| снят `sun_elevation_bps` / invert elevation / invert intensity / distance=0 | L376 | caught ×4 |
| `void cityTime` / `Date.now` в sun.ts | L376 | caught ×2 (ветки после правки оверлея) |
| нет `DirectionalLight` (extra) | L376 | caught |
| MeshBasic / нет window / NdotL baked sun | L377 | caught ×3 |
| day `lights=1` (extra) | L377 | caught |
| `owner_address` в спеке записи / `layout_version` 2 | L317 | caught ×2 |
| полный render vitest (`scene.png`, `sprites=669`) | архив `V12` красный | найдено, не закрыто (`R-V-84`) |
| `vehicles[0]` на `.` | motion on-road | найдено, `layout_hash` не двигаем (`R-V-85`) |
| toy emissive vs Meshy 2K maps | placeholder | принято (`R-V-87`) |
| первые оверлеи void/Date били `sunPose missing` | целевая ветка L376 | закрыто: оверлей держит sunPose/sunDir/DirectionalLight |

Выстояло: 22/22 шаговых + 3 extra + 3 CT. GPU/шрифт ОС; горячий ключ аттестатора; тонкий пул testnet; R-M-6/9/10; R-V-8 (L328 нет). TLS/`pnpm` — среда, не канон. Полный `--jobs 8` на шаге не гонялся (A-V3-5); закрытие — V3-7. Кадр суток на GPU не снимался: `GATE_VISUAL.md` — V3-7.

## Расхождения

R-V-73…R-V-87. R-V-82: light цитирует L376/L377; поздние ключи V3-4…V3-6 всё ещё `--only L370`. R-V-84: gate render включает `v33.test.ts`. R-V-87 принято: примитивы `window`/`sign` + `emissiveFactor`, не 2K map.

## Готовность

Критерий `PLAN_VISUAL_V3` §13 выполнен. Next: V3-4 — луч в тайл, BUILD, стейк.

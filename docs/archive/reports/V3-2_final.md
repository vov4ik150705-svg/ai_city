# V3-2 final

`visual3_assets`: 18 GLB по id `buildings.json`, два LOD, посадка на лот. `commit:build` сажает лот-плитку. `launch.deployed` пуст. P7 не начат. Pixi не удалён. Солнца нет (V3-3). Meshy-бинарников нет (`R-V-86`).

Пак **123**, хеш **`ad4878660ab1f982202145ca2896f8089fa70c63584276baa73188c2251de3e7`**, 647599 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. `layout_hash` `7c090c51a1ea…`. Декор 1087 bps (L174 warn). `visual3_frame_live=1`. `missions_live=0`. Краны NFT 0. Каталог 18; файлов GLB 36.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 373 / 0 |
| `python content/build.py` | 0; pack 123; hash `ad487866…1de3e7`; круг 1445; вход 200; выход 910 |
| `python content/codegen.py` | 23 artifacts, тот же hash |
| `python content/attack.py --only L370,L372,L374,L375` | 24/24 пойманы |
| construction `visual3_heroes_*` / `lod_*` / `plant_on_lot` | held (красные входы внутри проб) |
| `python content/vectors.py` | 21 файл; sha `4e2a1e3c…224897` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| `python content/attack.py --only L317` | 2/2 |
| render `tsc --noEmit` + `vitest run test/v31.test.ts test/v32.test.ts` | tsc 0; vitest 6/0 |
| contentpack `tsc --noEmit` + `vitest run` | tsc 0; vitest 60/0 (18 files) |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 20/0 (6 files) |
| eslint changed TS | 0 |

`--jobs 8` нет в `visual3_assets.gate_cmd`. `sim.py` / `builds.py` не в команде этапа. `pnpm` registry: TLS; гейт — локальные бинарники.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| снят `visual3_form` / ghost / CT ghost/пуст / минор 21 | L370 | caught ×7 |
| `--jobs 8` / stub `--only L370` engine / assets | L372 | caught ×3 |
| снят `bank` / extra `ghost_hero` | L374 | caught ×2 |
| clone sha / lod low≥high / NVIDIA на workshop | L374 | caught ×3 |
| нет `bank_lod0.glb` / high_quads=1000 / нет loader | L374 | caught ×3 |
| нет `plantHeroes` / нет spanX / `commit:spawn_mesh` | L375 | caught ×3 |
| GLTFLoader в engine / filler / лот 1×1 | L375 | caught ×3 |
| `owner_address` в спеке записи | L317 | caught |
| полный render vitest (`scene.png`, `sprites=669`) | архив `V12` красный | найдено, не закрыто (`R-V-84`) |
| `vehicles[0]` на `.` | motion on-road | найдено, `layout_hash` не двигаем (`R-V-85`) |
| фактические quads ≪ 30000/5000 | toy vs Meshy target | принято (`R-V-86`) |

Выстояло: 24/24 шаговых проб; GPU/шрифт ОС; горячий ключ аттестатора; тонкий пул testnet; R-M-6/9/10; R-V-8 (L328 нет). TLS/`pnpm add` — среда, не канон. Полный `--jobs 8` на шаге не гонялся (A-V3-5); закрытие — V3-7.

## Расхождения

R-V-73…R-V-86. R-V-82 дописан: assets цитирует L374/L375; поздние ключи теперь V3-3…V3-6. R-V-84: gate render включает `v32.test.ts`. R-V-86 принято: генератор, не Meshy на диске.

## Готовность

Критерий `PLAN_VISUAL_V3` §12 выполнен. Next: V3-3 — направленное солнце и emissive; albedo без запечённого солнца.

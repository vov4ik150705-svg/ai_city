# V3-0 final

`visual3_form`: восемь ключей v3, L370, кадр Three.js выключен. `launch.deployed` пуст. P7 не начат. Pixi не удалён.

Пак **120**, хеш **`c30e90d66b8137466753666a384154f18592289879cf27c3bffaa2939b893a4b`**, 638217 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. `layout_hash` `7c090c51a1ea…`. Декор 1087 bps (L174 warn). `visual3_frame_live=0`. `missions_live=0`. Краны NFT 0.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 368 / 0 |
| `python content/build.py` | 0; pack 120; hash `c30e90d6…9b893a4b`; круг 1445; вход 200; выход 910 |
| `python content/codegen.py` | 23 artifacts, тот же hash |
| `python content/attack.py --only L370,L348,L353` | 13/13 пойманы |
| `python content/vectors.py` | 21 файл; sha `cd8c506b…24b4611` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| contentpack `tsc --noEmit` + `vitest run` | tsc 0; vitest 60/0 (18 files) |
| construction `visual3_stage_keys_exist` | OK на зелёном; снятие `visual3_form` → L370 |

`--jobs 8` нет в `visual3_form.gate_cmd`. `sim.py` / `builds.py` не в команде этапа. `pnpm` registry: TLS; гейт — локальные бинарники.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| снят `visual3_form` | L370 | caught |
| ghost после `visual_close` | L370 | caught |
| nonempty CT у `visual3_engine` | L370 | caught |
| минор 0.21.0 | L370 | caught |
| `visual3_frame_live=1` | L348 и L370 | caught ×2 |
| L328 в `mainnet_launch.gate_cmd` | L353 | caught |
| семь прочих сдвигов L348 | L348 | caught |
| drop `city_hall` в оверлее | L177 | caught |
| маяк в core | L177 | caught |
| лес в оверлее | L174 | caught |
| будка на траве | L361 | caught |
| 14-й ключ / drop visual3 в vitest | construction | caught |

Выстояло: различие GPU, шрифт ОС, горячий ключ аттестатора, тонкий пул testnet, R-M-6/9/10, R-V-8 (L328 нет). Найдено и закрыто: ядро не держало 6 base при span=2 (`R-V-79`); кисть затирала `p/b/d` (`R-V-80`); WIP-оверлей 34 здания на чужих зонах — генератор picks, тайлы оставлены.

## Расхождения

R-V-73…R-V-80. План S0 запрещал `world.py`; без R-V-79 lint не зеленеет — правка узкая, сетка 63 / 150 лотов та же.

## Готовность

Критерий `PLAN_VISUAL_V3` §10 выполнен. Next: V3-1 — Three.js остров из легенды, орбита, `RENDER_NO_GPU`; пин Three.js в `arch.toolchain`.

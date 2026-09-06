# R-V-47 final

Не P7. `launch.deployed` пуст. `rules_version` 0.21.0. `pack_version` 93. Хеш `1e1b6e91e5320d4f70e8e9135e095480082716286968949b7232d6961e97fe06`. Круг 1445, вход 200, выход 910. Окно A [12275, 15783]. `missions_live=0`. Тела зданий — прежние `*_v2`; плинтус `plaza_tile`; контакт — эллипс.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 362/0 (WARN L174: realized 1198 vs target 1200, в полосе ±400) |
| `python content/build.py` | 0; 659322 B; hash `1e1b6e91…fe06`; layout_hash `82bb5e29709e`; atlas 269/2291126 B; magenta 0 |
| `python content/codegen.py --check` | 23 артефакта, hash `1e1b6e91` |
| `python content/attack.py --only L363,L09,L340,L268,L319` | 13/13 |
| construction `lot_pad_under_building` | OK (healthy + 4 red) |
| `python content/vectors.py` | 21 файл; sha `875fa7e7…8cd485` (сдвиг с pack_hash, R-V-14); layout_version 1; `record_field_homes` 25, тот же инвентарь |
| render `tsc --noEmit` + vitest | tsc 0; 22/0 |
| client `tsc --noEmit` | 0 |
| eslint изменённых ts/tsx | 0 |
| `python art/pipeline/scene.py --grid` | scene.png 4112×2200; 2680 land cubes, 913 objects |

`pnpm` не в PATH; эквивалент `pnpm --filter @corporator/render run gate`: `npx tsc` + `npx vitest`. `sim.py` и полный `--jobs 8` не гейт шага.

## Атаки (этот шаг)

Проведено 13 targeted + 1 construction + 3 vitest. Выстояло 0 из сломанных входов. Сработало:

- L363 `lot_pad=island_block` → «buildings sit on turf»
- L363 pixi без `groundTopId` → occupied grass stays island_block
- L363 skip без `park` → greenery would be paved
- L363 `contact_shadow_alpha_bps=0` → no contact AO
- L09 / L268 / L319 / L340 — свои входы, все caught
- vitest: Hall на `.` → `plaza_tile`; `park` не pad; клетка `r` не pad

Обход, формально зелёный у L363: правило смотрит имена и params, не GPU-кадр. Закрыто vitest на сцене пака, не пиксельным оракулом. Не закрывается кодом: различие GPU vs CPU (R-V-38).

Не делалось (канон): новые PNG зданий, легенда, 3D-меши, `commit:build` спавн, per-user сид.

## Расхождения

**R-V-47** — occupancy (этот шаг). Принятые: R-V-38 (нет WebGL на хосте), L174 1198≠1200 в полосе, `L353`/`L328` фазы выхода, R-V-5 живой `getRoot`.

## Next

Студия / взгляд в браузере на плинтус. P7 не начинать.

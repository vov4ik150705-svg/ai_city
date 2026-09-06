# V3-5 final

`visual3_units`: пешеходы — билборды/простые меши, не RPG-толпа. `launch.deployed` пуст. P7 не начат. Pixi не удалён.

Пак **126**, хеш **`c751d90338f8870716467455380a58862e69bfdcf9b1dbef5da5fbf6b24b3b96`**, 653518 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. `layout_hash` `7c090c51a1ea…`. Декор 1087 bps (L174 warn). `visual3_frame_live=1`. `missions_live=0`. Краны NFT 0.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 379 / 0 |
| `python content/build.py` | 0; pack 126; hash `c751d903…b24b3b96`; круг 1445; вход 200; выход 910 |
| `python content/codegen.py --check` | 23 artifacts, тот же hash |
| `python content/attack.py --only L370,L372,L380,L381` | 31/31 пойманы |
| construction `visual3_walkers_from_pack` / `units_billboard_or_mesh` / `units_not_lootable` | held (красные входы внутри проб) |
| `python content/vectors.py` | 21 файл; sha `20cb1441…dac9022` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| `python content/attack.py --only L317` | 2/2 |
| render `tsc --noEmit` + `vitest run test/v31.test.ts … test/v35.test.ts` | tsc 0; vitest 15/0 |
| contentpack `tsc --noEmit` + `vitest run` | tsc 0; vitest 60/0 (18 files) |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 20/0 (6 files) |
| eslint changed TS | 0 |
| depcruise `packages/render` | 0 (91 modules) |

`--jobs 8` нет в `visual3_units.gate_cmd`. `sim.py` / `builds.py` не в команде этапа. `pnpm` не в PATH; гейт — локальные `tsc`/`vitest`/`eslint`/`depcruise`.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| снят `visual3_form` / ghost / CT engine·assets·light·input·units ghost/пуст / минор 21 | L370 | caught ×11 |
| `--jobs 8` / stub `--only L370` engine / assets / light / input / units | L372 | caught ×8 |
| нет `plantUnits` / 1×1 кубы / нет `mesh.lookAt` / height=0 / span≥grade | L380 | caught ×5 |
| void `cityTime` / `agent_id` / `agentId` / `Math.random` / `walker_` в pick | L381 | caught ×5; `agentId` и `Math.random` закрыты на этом шаге |
| construction три пробы | красные входы | held |
| `owner_address` в спеке записи / `layout_version` 2 | L317 | caught ×2 |
| `PlaneGeometry` → `BoxGeometry` при живом `lookAt` | L380 | выжило: D-V3-7 «билборд или простой меш»; живой кадр — плоскость |
| полный render vitest (`scene.png`, `sprites=669`) | архив `V12` красный | найдено, не закрыто (`R-V-84`) |

Выстояло: 31/31 шаговых + 3 CT. GPU/шрифт ОС; горячий ключ аттестатора; тонкий пул testnet; R-M-6/9/10; R-V-8 (L328 нет). Машины сцены остаются 1×1 — V3-6. Полный `--jobs 8` на шаге не гонялся (A-V3-5); закрытие — V3-7. Кадр юнитов на GPU не снимался: `GATE_VISUAL.md` — V3-7.

## Расхождения

R-V-73…R-V-89. R-V-82: units цитирует L380/L381; поздний `visual3_world` всё ещё `--only L370`. R-V-84: gate render включает `v35.test.ts`. R-V-89: палитра Lambert, не PNG атласа V12.

## Готовность

Критерий `PLAN_VISUAL_V3` §15 выполнен. Next: V3-6 — декор, вода, свет без физики.

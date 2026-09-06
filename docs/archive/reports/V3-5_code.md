# V3-5 code

`visual3_units`: пешеходы и роботы легенды — камерные плоскости, не 1×1 кубы и не RPG-толпа. Поза `f(city_time)`. Нанятый агент не моб сцены. `launch.deployed` пуст. P7 не начат.

Пак **126**, хеш `c751d90338f8870716467455380a58862e69bfdcf9b1dbef5da5fbf6b24b3b96`, 653518 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. `layout_hash` `7c090c51a1ea…` (геометрия не двигалась). Декор 1087 bps (L174 warn). `visual3_frame_live=1`. `missions_live=0`. Краны NFT 0. Юнитов сцены **15** (`walker_*`/`robot_*`).

## Решения

`packages/render/src/units.ts`: `plantUnits` читает `generated.placement.scene`; `isPackedWalker` режет `walker_`/`robot_`. Сдвиг — треугольник `unitShiftBps` через `cityMinutes(cityTime)`. Амплитуда `unit_shift_span_bps` < `grade_bps`, иначе клетка тротуара покинута (`L380`). Высота `unit_height_bps`, не `sprite_h_unit`.

`three.ts`: packed walkers пропускаются в `islandBoxes`; сажается `PlaneGeometry` + `MeshLambertMaterial` цвета палитры; в `paint()` — `unitWorldPos` и `mesh.lookAt(cam.x, pos.y, cam.z)`. Pixi/атлас V12 не кормят кадр (`R-V-74`, `R-V-89`). Пикинг остаётся плоскостью сетки: клик по тротуару — BUILD, не карточка юнита (`L381`).

Ключи пака: `unit_height_bps=5000`, `unit_shift_period_city_minutes=8`, `unit_shift_span_bps=4000`. `visual3_units.gate_cmd` = `--only L370,L372,L380,L381` (нет `--jobs 8`). CT: три пробы V3-5. Поздний ключ `visual3_world` — заглушка L370 (`R-V-82`). Render gate = `v31`…`v35` (`R-V-84`).

Сломанный реэкспорт `motion.js` в `index.ts` сшит. В `vendor-three.d.ts` у `Mesh` добавлены `scale` и `lookAt`.

## Файлы

`packages/render/src/{units,three,index,vendor-three.d.ts}`, `packages/render/test/v35.test.ts`, `packages/render/package.json`, `apps/client/src/{packview.ts,hud/SceneHost.tsx,hud/App.tsx}`, `packages/contentpack/test/v0.test.ts`, `content/params/{render,meta,arch}.json`, `content/{lint,attack}.py`, канон `DESIGN.md` / `WORLD.md` / `ARCHITECTURE.md` / `CONTENT.md` / `PLAN_VISUAL_V3.md` / `code-phase.mdc`.

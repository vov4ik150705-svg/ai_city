# V3-6 code

`visual3_world`: декор, вода, fill без физики. Глубокая вода — одна плоскость плюс ортогональная пена. Декор — `InstancedMesh` из легенды. Машины и дроны — простые меши с позой `f(city_time)`. Fill — `HemisphereLight` с `fill.intensity` от `ambient_bps`. `launch.deployed` пуст. P7 не начат. Pixi не удалён.

Пак **127**, хеш `9bb7952b66a92e16913a54d46b30bd3050ee2a1bd7b2a95518679b8869c7f5ce`, 654978 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. `layout_hash` `7c090c51a1ea…` (геометрия не двигалась). Декор 1087 bps (L174 warn). `visual3_frame_live=1`. `missions_live=0`. Краны NFT 0.

## Решения

`packages/render/src/island.ts`: `landCells` режет `~`; `plantWater` — один квад на `grid_size`; `shoreFoam` — `isShoreWater`. `islandCells` по-прежнему перечисляет воду, чтобы `visual3_island_from_legend` не краснел.

`packages/render/src/world.ts`: `plantDecor` / `decorKind` (lantern, furniture, plant, hull); `isPackedVehicle` / `isPackedDrone`; `poseVehicle` / `poseDrone` зовут `vehiclePose` / `dronePose` от `city_time`. Узкий `kind === ""` (не `.length`), иначе `DecorKind | ""` не сужается.

`three.ts`: суша через `landCells`; одно море; пена; packed decor/vehicle/drone вырезаны из 1×1; четыре семьи `InstancedMesh`; `HemisphereLight` + `fill.intensity` из `pose.ambientBps` поверх `AmbientLight` V3-3 (`R-V-90`). Пикинг — плоскость сетки: машина и фонарь не моб (`L383`).

Ключи пака: `decor_height_bps=2800`, `lantern_height_bps=7500`, `canopy_height_bps=6200`, `vehicle_height_bps=3500`, `drone_hover_height_bps=9000`. `visual3_world.gate_cmd` = `--only L370,L372,L382,L383` (нет `--jobs 8`). CT: три пробы V3-6. Поздний ключ `visual3_close` — заглушка L370 (`R-V-82`). Render gate = `v31`…`v36` (`R-V-84`).

## Файлы

`packages/render/src/{world,three,island,index,vendor-three.d.ts}`, `packages/render/test/v36.test.ts`, `packages/render/package.json`, `apps/client/src/{packview.ts,hud/SceneHost.tsx,hud/App.tsx}`, `packages/contentpack/test/v0.test.ts`, `content/params/{render,meta,arch}.json`, `content/{lint,attack}.py`, канон `DESIGN.md` / `WORLD.md` / `ARCHITECTURE.md` / `CONTENT.md` / `HUD.md` / `PLAN_VISUAL_V3.md` / `code-phase.mdc`.

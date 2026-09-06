# V3-5 recon

`launch.deployed` все пять полей пусты (команда, не память). Ставка не снята. P7 не начат.

Прочитано: `PLAN_VISUAL_V3.md` §4 V3-5 / D-V3-7 / D-V3-8, `V3-4_final.md`, `WORLD.md` § пешеходы, `TZ_ART.md` §4.7, `assets/_STYLE_V3.txt`, `packages/render/src/{three,island,motion,objects}.ts`, `apps/client/src/hud/SceneHost.tsx`, `visual3_units.gate_cmd` = `--only L370`, CT пуст. Цель пака: «Shift walkers as billboards or simple meshes, not an RPG crowd».

## Находки

- Свободный id **L380**. L370 держит пустой CT у `visual3_units`…`visual3_close`. Непустой CT этапа красный, пока L370 не сузить.
- `visual3_units.gate_cmd` — заглушка L370 (`R-V-82`). L372 не требует id юнитов, пока этап их не цитирует.
- `islandBoxes` сажает **все** `scene.objects` кубом 1×1, включая `walker_*` / `robot_*`. Пешеходы уже в легенде пака, но как декор-ящики, не как юниты.
- `generated.placement.walkers` и объекты сцены совпадают: фон, тайл `s`, `background: 1`, без `agent_id`, без клика (`L190`, TZ_ART §4.7). Нанятые агенты — HUD-сотрудники, не мобы сцены.
- Пикинг — плоскость сетки (`L378`): клик по тротуару с пешеходом открывает BUILD, не карточку юнита. Это закон, не дыра.
- Поза должна быть `f(city_time)` (`D-V3-7`). V12 пешеходы стоят; v3 сдвигает вдоль heading соседей тротуара. Период и амплитуда — новые ключи пака, не литералы.
- Атлас V12 на билборд не кормить (`R-V-74`): плоскость + `MeshLambertMaterial` + `lookAt` камеры, цвет из палитры клиента.

## Риски этапа

- Сузить L370 до заполнения CT `visual3_units`.
- L372: `visual3_units.gate_cmd` цитирует L380/L381, не stub L370; `--jobs 8` запрещён.
- Литералы ≥2 не в `packages/render/src`.
- Не физика, не толпа RPG, не `agent_id` на пешеходе, не клик-моб.
- `visual3_world` остаётся с пустым CT и stub L370.

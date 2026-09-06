# V3-6 recon

`launch.deployed` все пять полей пусты (команда, не память). Ставка не снята. P7 не начат.

Прочитано: `PLAN_VISUAL_V3.md` §4 V3-6 / D-V3-6 / D-V3-5, `V3-5_final.md`, `WORLD.md` §2 вода / §6 декор, `assets/_STYLE_V3.txt`, `packages/render/src/{three,island,water,motion,light,units}.ts`, `apps/client/src/hud/SceneHost.tsx`, `visual3_world.gate_cmd` = `--only L370`, CT пуст. Цель пака: «Decor, water and fill light without physics».

## Находки

- Свободный id **L382**. L370 держит пустой CT у `visual3_world` и `visual3_close`. Непустой CT этапа красный, пока L370 не сузить.
- `visual3_world.gate_cmd` — заглушка L370 (`R-V-82`). L372 не требует id мира, пока этап их не цитирует.
- `islandCells` отдаёт каждый `~` как 1×1 плоскость. Живой кадр сажает **1124** водных тайла. Канон: одна плоскость ниже плато, пена — ортогональный берег (`L362` архива Pixi; v3 кадр это ещё не делает). Shore `isShoreWater` = **182**.
- `islandBoxes` сажает оставшиеся `scene.objects` кубом 1×1: фонари 10, мебель/растения ~200, машины 161, дроны. Пешеходы уже скип. Машины явно оставлены V3-5 на V3-6.
- `AmbientLight.intensity` уже из `pose.ambientBps` (V3-3). Fill v3 — `HemisphereLight` с теми же bps, не Cannon/Rapier. Meshy декора нет: toy-боксы + `InstancedMesh` (`R-V-86` для героев; декор той же дисциплины).
- Позы машин/дронов уже чистая функция `city_time` в `motion.ts`. Кадр v3 их не зовёт.
- Деревья в паке **0**; бюджет — `flower`/`bush`/`bench`/`planter`. `layout_hash` не двигаем.

## Риски этапа

- Сузить L370 до заполнения CT `visual3_world`. Поздний ключ — только `visual3_close`.
- L372: `visual3_world.gate_cmd` цитирует L382/L383, не stub L370; `--jobs 8` запрещён.
- Литералы ≥2 не в `packages/render/src`. `three.ts` >400 строк — вынести world/water helpers.
- Не физика, не спавн GLB, не Pixi-кадр, не двигать `layout_hash`.
- `visual3_island_from_legend` (V3-1) читает `islandCells` с водой — не вырезать `~` из перечисления легенды; резать посадку.
- `v31`…`v35` не краснеют: `landCells` рядом с `islandCells`.

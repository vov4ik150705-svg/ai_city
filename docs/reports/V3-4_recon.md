# V3-4 recon

`launch.deployed` все пять полей пусты (команда, не память). Ставка не снята. P7 не начат.

Прочитано: `PLAN_VISUAL_V3.md` §4 V3-4 / D-V3-15, `V3-3_final.md`, `HUD.md` §6.1, `WORLD.md` §8, `packages/render/src/{three,camera,frame}.ts`, `apps/client/src/hud/{sceneInput,SceneHost,App,hud.css}`, `visual3_input.gate_cmd` = `--only L370`, CT пуст.

## Находки

- Свободный id **L378**. L370 держит пустой CT у `visual3_input`…`visual3_close`. Непустой CT этапа красный, пока L370 не сузить.
- `visual3_input.gate_cmd` — заглушка L370 (`R-V-82`). L372 не требует id ввода, пока этап их не цитирует.
- `hitAt` уже сечёт плоскость `landY` через `Raycaster.setFromCamera`, но: (1) объект только в клетке origin, не в футпринте лота; (2) `kind` = `object`/`tile`, а `routeSceneClick` ждёт `building`; закрытый сток не открывает стейк.
- Вода на `waterY`, суша на `landY`: один луч в плоскость суши смещает тайл над водой. Нужен повтор по плоскости воды.
- HUD: `e.target !== canvas` уже режет клик не по холсту. Дыра — `pointer-events: none` на колонке/меню/экране: клик проходит в холст. `App` всегда шлёт `NO_OPENED`: живого `districts_opened` в HUD-снимке нет.
- BUILD каталог и `commit:build` живы (`build.tsx`, `L273`, `L375`). Вода/берег → экран `build` + `BUILD_TILE_ILLEGAL` через `tileBad`.

## Риски этапа

- Сузить L370 до заполнения CT `visual3_input`.
- L372: `visual3_input.gate_cmd` цитирует L378/L379, не stub L370; `--jobs 8` запрещён.
- Литералы ≥2 не в `packages/render/src`.
- Не тащить iso `tileFromWorld` в живой `hitAt`.
- Снимок без `districts_opened` не выдумывать: ветка opened остаётся в `routeSceneClick`, клиент честно шлёт пустую карту.

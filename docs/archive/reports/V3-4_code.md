# V3-4 code

`visual3_input`: луч из орбиты бьёт в тайл легенды; пустой тайл открывает BUILD; закрытый сток — стейк; HUD chrome не дырявый. `launch.deployed` пуст. P7 не начат.

Пак **125**, хеш `c3acd9ee4eb49a8eb3980bb915c435ca4c8172e8133b89c769e2d2d3c6b5a17f`, 652382 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. `layout_hash` `7c090c51a1ea…` (геометрия не двигалась). Декор 1087 bps (L174 warn). `visual3_frame_live=1`. `missions_live=0`. Краны NFT 0.

## Решения

Пикинг — `packages/render/src/pick.ts`: `Raycaster.setFromCamera` в `three.ts` отдаёт origin/dir в `pickFromRay`. Сначала плоскость `landY`; клетка `~` — повтор по `waterY` (косой луч иначе крадёт воду). Герой — футпринт лота (`heroAtTile`), не origin 1×1. `kind: "building"` для `routeSceneClick`. Промах (луч от плоскости) — `emptyHit`.

HUD: `hudSurfaceBlocksPick` только `"scene"` пропускает; клиент `hudBlocksPick` режет chrome и пустой target. Canvas — единственная цель пика. `.hud-col` / `.hud-topbar` / `.hud-menu` / `.hud-screen` — `pointer-events: auto` (`L379`).

`visual3_input.gate_cmd` = `--only L370,L372,L378,L379` (нет `--jobs 8`). CT: три пробы V3-4. Поздние ключи V3-5…V3-6 — заглушка L370. Render gate = `v31`+`v32`+`v33`+`v34` (`R-V-84`). `App` шлёт `NO_OPENED` (`R-V-88`). Вода открывает каталог BUILD, посадка режется `BUILD_TILE_ILLEGAL` (`R-V-55`, `tileBad`).

## Файлы

`packages/render/src/{pick,three,index}.ts`, `packages/render/test/v34.test.ts`, `packages/render/package.json`, `apps/client/src/hud/sceneInput.ts`, `packages/contentpack/test/v0.test.ts`, `content/params/{arch,meta}.json`, `content/{lint,attack}.py`, канон `DESIGN.md` / `WORLD.md` / `HUD.md` / `ARCHITECTURE.md` / `SCREENS.md` / `CONTENT.md` / `PLAN_VISUAL_V3.md` / `code-phase.mdc`.

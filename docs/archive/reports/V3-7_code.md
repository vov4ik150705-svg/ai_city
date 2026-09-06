# V3-7 code

`visual3_close`: полный гейт, `GATE_VISUAL.md` редакция v3, публикация пака. `launch.deployed` пуст. P7 не начат. Pixi не удалён.

Пак **128**, хеш `104c68788d738984332b884f9d67d576866b2eb82655d2c7d73bae5815d330cf`, 655227 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783], A_t2 **14217**. `layout_hash` `7c090c51a1ea…` (геометрия не двигалась). `visual3_frame_live=1`. `missions_live=0`. Краны NFT 0.

## Решения

`observeVisual3Budgets` считает граф Three.js: суша + море + пена + leftover + пешеходы + семьи декора + машины + дроны + видимые герои. Живой замер 3273. Потолок `draw_calls_max` 96→**4096** (`R-V-91`): копия V12 не переживает L351.

`GATE_VISUAL.md` — заголовок v3; live `observe.software`/`desktop` = 3273 / 483 / 2469767 / 20971520 / 1291541. Архив V12 под `archive.v12.*`. `art/preview/scene.png` = `fallback.png` (нет WebGL, R-V-38).

`visual3_close.construction_tests` = `visual3_budgets_measured`, `visual3_golden_frames_match`. `gate_cmd` уже `--jobs 8` + `sim.py`. L370 требует этот CT. L384 ловит снятие jobs/sim, заголовок V12 и отсутствие `observeVisual3Budgets`. Render gate = `v31`…`v37`.

## Файлы

`packages/render/src/{budget,index}.ts`, `packages/render/test/{v37.test.ts,golden/probes.json}`, `packages/render/package.json`, `packages/contentpack/test/v0.test.ts`, `content/params/{arch,meta,render}.json`, `content/{lint,attack}.py`, `docs/reports/GATE_VISUAL.md`, `art/preview/scene.png`, канон `DESIGN.md` / `WORLD.md` / `ARCHITECTURE.md` / `CONTENT.md` / `PLAN_VISUAL_V3.md` / `code-phase.mdc`, кодоген 23 артефакта.

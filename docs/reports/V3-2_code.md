# V3-2 code

`visual3_assets`: 18 hero GLB keyed by `buildings.json`, two LODs, plant on `reference_layout` lots. `commit:build` stays `commit:build`. No sun. No Meshy binaries (`R-V-86`).

Пак **123**. `art/pipeline/heroes.py` пишет `content/out/heroes/{id}_lod0.glb` и `{id}_lod1.glb` (36 файлов). `compute_brick` только на `ai_research_center`. Каталог — `generated.render.hero_catalog` / `hero_sha256`. Цели remesh в паке: `hero_lod_high_quads=30000`, `hero_lod_low_quads=5000`, `hero_texture_px=2048`, `hero_lod_near_tiles=53`. Фактические quad counts легче целей и уникальны; low < high.

Рантайм: `packages/render/src/heroes.ts` (`loadHeroCatalog`, `plantHeroes`, `pickHeroLod`); `three.ts` сажает GLB в футпринт лота (`spanX`/`spanZ`), 1×1-боксы только у не-героев. Клиент: `import.meta.glob` на `content/out/heroes/*.glb`, байты в `heroBytes`. Движок GLB не читает.

`visual3_assets.gate_cmd` = `--only L370,L372,L374,L375` (нет `--jobs 8`). CT: три пробы V3-2. Поздние ключи V3-3…V3-6 — заглушка L370. `packages/render` gate = `v31` + `v32` (`R-V-84`). Круг денег не двигался. `layout_hash` `7c090c51a1ea…`.

## Файлы

`art/pipeline/heroes.py`, `content/out/heroes/*.glb`, `content/params/{arch,meta,render}.json`, `content/build.py`, `content/lint.py`, `content/attack.py`, `packages/render/src/{heroes,three,index,vendor-three.d.ts}.ts`, `packages/render/{package.json,test/v32.test.ts}`, `apps/client/src/{packview.ts,hud/SceneHost.tsx,hud/App.tsx,vite-env.d.ts}`, `apps/client/{tsconfig.json,vite.config.ts}`, `packages/contentpack/test/v0.test.ts`, канон `DESIGN.md` / `WORLD.md` / `HUD.md` / `ARCHITECTURE.md` / `CONTENT.md` / `PLAN_VISUAL_V3.md` / `code-phase.mdc`.

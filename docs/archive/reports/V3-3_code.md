# V3-3 code

`visual3_light`: направленное солнце и emissive окон/вывесок от `city_time`. Albedo без запечённого солнца. Остров — `MeshLambertMaterial`. `launch.deployed` пуст. P7 не начат.

Пак **124**, хеш `8212821fff632bb23a54efc30b76e1711a81a0e0e0d7a85e6d30d1b9ca85924f`, 651978 байт. `rules_version` 0.22.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. `layout_hash` `7c090c51a1ea…` (геометрия не двигалась). Декор 1087 bps (L174 warn). Каталог 18; GLB 36.

## Решения

Поза солнца — четыре ключа на фазу в `placement.phases` (`sun_azimuth_bps`, `sun_elevation_bps`, `sun_intensity_bps`, `ambient_bps`) плюс `render.params.sun_distance_tiles=89`. Рантайм: `packages/render/src/sun.ts` (`sunPose`, `sunDir`, `windowGainBps`, `signGainBps`). `three.ts` ставит `AmbientLight` + `DirectionalLight`, `applySun` из `setCityTime` (нет `void cityTime`). День `lights=0` гасит неон; город держит солнце.

Герои: `heroes.py` пишет узлы `body` / `window` / `sign`; window/sign несут `emissiveFactor`; рантайм масштабирует `emissiveIntensity` (`R-V-87`). Stub `vendor-three.d.ts` дополнен светом и Lambert/Standard.

`visual3_light.gate_cmd` = `--only L370,L372,L376,L377` (нет `--jobs 8`). CT: три пробы V3-3. Поздние ключи V3-4…V3-6 — заглушка L370. Render gate = `v31`+`v32`+`v33` (`R-V-84`).

## Файлы

`packages/render/src/{sun,three,light,index,vendor-three.d.ts}.ts`, `packages/render/test/v33.test.ts`, `packages/render/package.json`, `art/pipeline/heroes.py`, `content/out/heroes/*.glb`, `content/params/{arch,meta,render,placement}.json`, `content/{lint,attack,world,build}.py`, `content/schema/corporator.schema.json`, `apps/client/src/{packview.ts,hud/SceneHost.tsx,hud/App.tsx}`, `packages/contentpack/test/v0.test.ts`, канон `DESIGN.md` / `WORLD.md` / `HUD.md` / `ARCHITECTURE.md` / `CONTENT.md` / `PLAN_VISUAL_V3.md` / `code-phase.mdc`.

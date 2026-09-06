# V3-3 recon

`launch.deployed` все пять полей пусты (команда, не память). Ставка не снята. P7 не начат.

Прочитано: `PLAN_VISUAL_V3.md` §4 V3-3 / D-V3-5 / D-V3-7 / D-V3-8, `V3-2_final.md`, `assets/_STYLE_V3.txt` LIGHT, `WORLD.md` §7, `packages/render/src/{three,light,frame}.ts`, `art/pipeline/heroes.py`, `visual3_light.gate_cmd` = `--only L370`, CT пуст.

## Находки

- Свободный id **L376**. L370 держит пустой CT у `visual3_light`…`visual3_close`. Непустой CT этапа красный, пока L370 не сузить.
- `visual3_light.gate_cmd` — заглушка L370 (`R-V-82`). L372 не требует id света, пока этап их не цитирует.
- `setCityTime` в `three.ts` глотает `cityTime` (`void`). Направленного солнца нет. Остров — `MeshBasicMaterial` (свет игнорируется).
- Фазы суток уже в паке: `generated.placement.phases` из `time.json` (L179). `day.lights=0`, `lanterns_on_phases` без `day` (L336). Pixi V5 грейд жив; кадр v3 его не читает.
- Герои GLB — плоский `COLOR_0` без `emissiveFactor` и без примитивов window/sign. STYLE требует отдельное свечение окон, не запечённое солнце на albedo. Meshy 2K emission map нет (`R-V-86`): плейсхолдер — отдельный примитив + `emissiveFactor`.
- Часы — `apps/client/src/clock.ts`. `Date` / `Math.random` в render запрещены (L338, L335). Числа солнца — секция пака (L340).

## Риски этапа

- Сузить L370 до заполнения CT `visual3_light`.
- L372: `visual3_light.gate_cmd` цитирует L376/L377, не stub L370; `--jobs 8` запрещён.
- День не включает `lights` (L336): город держит направленное солнце, неон окон/вывесок гаснет.
- Литералы ≥2 не в `packages/render/src`.
- GLB sha сдвинется с окнами; ключи каталога те же 18 id.

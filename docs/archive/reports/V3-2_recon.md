# V3-2 recon

`launch.deployed` все пять полей пусты (команда, не память). Ставка не снята. P7 не начат.

Прочитано: `PLAN_VISUAL_V3.md` §4 V3-2 / D-V3-6 / D-V3-15, `V3-1_final.md`, `assets/_STYLE_V3.txt`, `buildings.json` (ровно 18 id), `packages/render` (`mountIsland3` сажает 1×1 боксы на каждый scene object), `visual3_assets.gate_cmd` = `--only L370`, CT пуст, GLB на диске нет.

## Находки

- Свободный id **L374**. L370 держит пустой CT у `visual3_assets`…`visual3_close`. Непустой CT этапа красный, пока L370 не сузить как на V3-1.
- `visual3_assets.gate_cmd` — заглушка L370 (`R-V-82` для поздних ключей). A-V3-5/14 молчат на этом ключе, пока L372 не потребует L374.
- 18 id зданий есть и в `reference_layout`, и в `scene.objects`. Fillers (30) — не герои.
- Meshy-бинарников нет. Вход этапа — генератор уникальных toy-GLB по id; цели remesh 30000/5000 и текстура 2048 — параметры пака (`R-V-86`).
- `commit:build` жив (`L273`, `build_place`). Спавна меша нет и не будет.
- `packages/render` gate узкий (`R-V-84`): не открывать полный vitest архива V12.

## Риски этапа

- Сузить L370 до заполнения CT `visual3_assets`, иначе собственные пробы красные.
- L372: `visual3_assets.gate_cmd` цитирует L374/L375, не stub L370; `--jobs 8` по-прежнему запрещён.
- Литералы ≥2 не в `packages/render/src` (L340). Каталог и LOD — из пака.
- NVIDIA brick + green eye только на `ai_research_center`.
- Посадка по футпринту `reference_layout` (w×h), не 1×1 на клетке дороги.
- 36 GLB пишет `build.py` в `content/out/heroes/`; клиент читает файлы, не `scene.json?url`.

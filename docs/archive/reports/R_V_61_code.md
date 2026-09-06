# R-V-61 code — управление и полный каталог

## Решение

Свободный drag тела спрайта (ox и oy вместе), порог 3 px, pointer capture. Ресайз только SE. Подъём — Alt+drag / `[` `]`. Зум колесом не вызывает `fitView`; «В кадр» — единственный fit. `enableLive` не пересобирает землю и не вписывает остров повторно.

`flip` в оверлее и `instance_place` (якорь с правого края + PIL/canvas/Pixi `scale.x = -1`). Q/E циклит `vehicle_dir_*` и суффикс `_w`. Каталог — `art/pipeline/assets.json` (здания / декор / техника / юниты), поиск. Юниты и машины правятся; оверлей заменяет бакет, если в props есть id этого семейства.

Посадка здания/декора не копирует geom с прошлого выбора. Stage hits без rebake земли.

## Файлы

`content/studio.html`, `content/studio.py`, `content/world.py`, `content/schema/corporator.schema.json`, `art/pipeline/scene.py`, `packages/render/src/{ground,sprites,objects,index}.ts`, `packages/render/test/v3.test.ts`, `docs/WORLD.md` §5.

Пак не поднимался. `authored_layout` пуст.

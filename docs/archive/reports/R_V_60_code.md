# R-V-60 code — живой слой студии

## Решение

Студия больше не печёт весь остров на каждый пиксель. Земля — PNG (`/preview/ground.png`, кэш `art/preview/studio_ground.png`). Спрайты — canvas поверх, `drawImage` nearest, позиция как `scene.instance_place`.

## Ключевые правки

- `art/pipeline/scene.py`: `oy` входит в y; `paint_ground_canvas` без спрайтов; hits несут `native_w/h`, `ax/ay`, `cols/rows`, geom.
- `content/studio.py`: отдача PNG, не JPEG; `/preview/ground.png`; stage без rebuild на nudge; Save по-прежнему пишет фикстуру.
- `content/studio.html`: зум/пан, таск 1 px, Shift 8 px, `[` `]` подъём, ручки E/S/SE размер и N подъём, масштаб %, кисть `.kps`.
- `packages/render/test/v3.test.ts`: паритет `instanceFoot`+`spriteScreenPos` с Python внутри `ground_matches_python_scene` (имя пробы не плодили — L268).
- `docs/WORLD.md` §5: одна фраза про живой слой.

Пак не поднимался. `authored_layout` пуст.

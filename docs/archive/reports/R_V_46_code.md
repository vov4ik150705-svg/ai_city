# R-V-46 code

Не P7. Пак **91**. `rules_version` 0.21.0.

## Упаковка

`packed_wh`: `kind=building` — ширина всегда `target_width(footprint)`. Высота из лестницы `sprite_h_*`. `building_min_sprite_h=0`.

## Лестница

Классы в `content/params/render.json`. `atlas.sprite_h_for` читает пак.

## Клин

`shop_row` (consumer, `kiosk_tall`), `finance_annex` (`bank`). Дома не ортогональные соседи маяка. Compute не клеит annex встык, пока хватает лотов. Счётчик fill тот же (`district_fill_step_bps` не двигать).

## Декор

Деревья: двор парка + аллея `s` non-industrial; недобор `tree_cap` — остальные тротуары (не `.`). `tree_count=105` инвариантен к `zone_rotation` (L175). Мебель: каденс по `s`/`p`. `street` в derived.

## Вода

`placeWaterPlane` + `isShoreWater`. `placeCube` только берег, `lift=0`. `scene.py` то же.

Студия не трогалась.

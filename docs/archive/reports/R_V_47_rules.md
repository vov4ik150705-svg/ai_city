# R-V-47 rules

| id | ловит | вход падения |
|---|---|---|
| L363 | `lot_pad` = трава / `island_block`; нет `groundTopId`/`padFootprints`/`drawContact`; pixi без `groundTopId`; `lot_pad_skip` без `park`; `contact_shadow_alpha_bps` ≤ 0 | `_lot_pad=island_block`; stub pixi `topSpriteId`; skip=`["plaza"]`; alpha=0 |

Проба construction: `construction_lot_pad_under_building` (healthy + 4 мутации). Имя vitest не добавлялось: asserts в `ground_matches_python_scene` (Hall→pad, park не мостят, `r` не pad).

Затронутые: L09 (derived `lot_pad`/`lot_pad_skip`), L340 (литералы в render src), L268 (имена `it()`), L319 (трек CI).

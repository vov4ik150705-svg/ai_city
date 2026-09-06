# R-V-59 code

Пак **104**. `rules_version` 0.21.0. Форма денег не двигалась.

Маска: `kind=="building"` → `pixel_kept` всегда true. Не-здание клипает чужой `r~bdw` и чужой лот здания. `scene.py` зовёт `clip_rgba` только если `kind != "building"`. Рантайм — `keepMaskGraphics` только при `mapped.kind !== "building"`.

`world.py`: exclusive `used`; `p` только пад фонтана (центр + орто, ≤5); двор — трава; спрайт `park`/`plaza` в центр двора не ставится; дрон не на `(cx,cy)`; фонтан + кольцо лавок на паде; пирс пропускает занятое. Каденс мебели `sidewalk_furniture_step_tiles` 2 по `s`/`p`.

Пак: `sprite_h_tree` 56, `road_band_half_bps` 4000. `tiles.py` читает полосу из пака; крап тротуара — серые площади, не пляж.

Проба `ground_matches_python_scene`: земля под зданием на `.` и под `tree_*`, не объект `park` (спека: парк = трава и кроны).

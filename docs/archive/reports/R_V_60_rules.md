# R-V-60 rules

Новых id линтера нет. Ловят уже существующие:

| id | что ловит | вход падения |
|---|---|---|
| L177 | база/маяк/синергия в эталоне | оверлей без `city_hall` |
| L184 | ручной `scene.json` | файл возвращён в `art/pipeline/` |
| L175 | лоты не от `city_id` | сид лотов |
| L273 | `commit:build` не геометрия острова | `build_place` снят |
| L329 | сцена из пака | `scene.json?url` |
| L367 | маска карниза | clip снят |
| L368 | два объекта на тайле | `city_hall`×2 |
| L268 | имя vitest = construction_tests | отдельный `instance_place_matches_python` |

Схема `fixture_authored_layout_file` уже содержит geom; пустой оверлей не пишет нули в scene objects.

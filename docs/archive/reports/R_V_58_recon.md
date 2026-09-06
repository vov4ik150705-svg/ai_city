# R-V-58 recon

Не P7. `launch.deployed` пуст (пять полей `""`).

Канон фазы закрыт на V12. Расхождение картинки: масштаб декора vs зданий, аллея на `s`, изгородь 66 px, клип стены по `tileAt` (R-V-56).

Прочитано: `content/atlas.py` `packed_wh` / `sprite_h_*`; `content/world.py` `decor_plan`; `art/pipeline/scene.py`; `packages/render/src/objects.ts`; `docs/WORLD.md` §6; `TZ_ART.md` §12; диагноз `MAP_ISO_ANALYSIS.md`.

Находки: атлас брал `art/out` как есть (дерево 56 при `sprite_h_tree` 80); 105 деревьев и 248 изгородей; L359 стережёт только здания.

Риски: L175 если `tree_count` следует размеру двора; L174 недобор без изгороди; L340 на индексах маски; голдены V12 после клипа.

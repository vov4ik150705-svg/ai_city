# R-V-58 code

Пак **103**. `rules_version` 0.21.0. Лестница в `render.json`: unit 20, furniture 16, bench 18, hedge 22, vehicle 24, booth 28, lantern 32, tree 40. Здания не растягивали (R-V-48).

`atlas.py` `packed_wh` всегда сжимает 1×1 декор в `tile_w`; высота следует ширине. `art/out` больше не замораживает 56 px. `assets.json` у декора/юнита равен паку; лодки не юниты.

`world.py`: деревья только внутренность двора занятого не-пром квартала, не `s`; изгородь-кольцо снято; недобор бюджета — мебель. `tree_cap_share_bps` 54, чтобы `tree_count` = 14 на всех восьми сидах L175.

`column_mask.py` / `columnMask.ts`: отвес вниз, keep = свой футпринт + орто `.psk`; clip чужой `rc~bdw`. Печка `clip_rgba` по экземпляру. Рантайм — Graphics-маска, не `tileAt` по стене.

Голдены и `GATE_VISUAL.md` пересняты: sprites 687, atlas 2454502 B.

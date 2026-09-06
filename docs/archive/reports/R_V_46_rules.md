# R-V-46 rules

| id | ловит | вход падения |
|---|---|---|
| L359 | `frame.w` здания > футпринт + overhang | `agent_hub.w=235` |
| L360 | filler чужого района; `residential_block` ortho маяку | дом встык к `flagship_store` |
| L361 | будка не на `s`/`p`; дерево на `r`/`k`/`~` / промдвор | `phone_booth` на `.` |
| L362 | нет `placeWaterPlane` / `isShoreWater`, или `placeCube(waterLayer)` по всем `~` | цикл `placeCube` на каждый `~` |

Пробы: `sprite_fits_footprint_width`, `district_fabric_not_glued`, `decor_follows_tile_tag`, `water_plane_not_tiled_cubes`.

Затронутые: L169/L174/L175/L178/L192/L193, L268, L330, L334.

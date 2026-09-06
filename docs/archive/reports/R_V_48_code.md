# R-V-48 code

Не P7. Пак **94**. `rules_version` 0.21.0.

`atlas.packed_wh` для `kind=building`: равномерный масштаб в ширину лота. `sprite_h_*` — потолок высоты: если исходник выше, ширина сжимается (плинтус виден вокруг). PNG не переписывались.

`L359` сравнивает кадр с `packed_wh` кропа. Атака: `h` удвоен → «stretched from source».

Голдены и `GATE_VISUAL.md` пересняты: `atlas_bytes=1983915`. `fallback.png` = новый `scene.png`.

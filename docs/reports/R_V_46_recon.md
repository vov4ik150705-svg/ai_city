# R-V-46 recon

Не P7. `launch.deployed` пуст (пять полей `""`).

Канон фазы закрыт на V12. Это расхождение картинки: занятость куба, лестница масштаба, ткань клина, декор по тегу, вода-плоскость.

Прочитано: `content/atlas.py` `packed_wh` / `building_min_sprite_h`; `content/world.py` `reference_layout` / `decor_plan`; `packages/render/src/pixi.ts` вода; `content/params/buildings.json` `filler.kinds`; `docs/WORLD.md` §2/5/6; `TZ_ART.md` §1.3.

Находки: `building_min_sprite_h=168` тянул ширину; consumer filler только `residential_block`; деревья из `free` травы; каждый `~` — `placeCube`.

Риски: L174 недобор после снятия Poisson; L175 счётчики; L330 байты атласа; L193 точный n_fill.

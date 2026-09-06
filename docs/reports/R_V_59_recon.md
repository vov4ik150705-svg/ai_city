# R-V-59 recon

Не P7. `launch.deployed` пуст (пять полей `""`).

Спека `docs/reports/2026-09-02-map-structure-design.md` (ок владельца 2026-09-02). Кадр после R-V-58: здания режет дорога, стек в центре двора, «песок» внутри квартала, узкая полоса `r`, деревья ниже людей, мало лавок.

Прочитано: `column_mask.py` / `columnMask.ts`; `world.py` `decor_plan` / `build_map`; `scene.py` `clip_rgba`; `packages/render/src/objects.ts`; `tiles.py` `ROAD_HALF`; `WORLD.md` §6; `TZ_ART.md` §3/§6/§12; `v3.test.ts` `ground_matches_python_scene`.

Находки: L367 требовал срезать карниз здания над `r`; extras ставили `park`/`plaza`/`fountain` в `(cx,cy)` вместе с дроном; `p` красил весь двор маяка; `ROAD_HALF` 0.23 литералом; тротуар красили пляжными серыми; проба V3 требовала объект `park` в сцене.

Риски: L175 если `tree_count` следует двору; L368 ложные срабатывания на `wind_turbine`/`district_billboard`; голдены после сдвига дронов.

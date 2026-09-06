# V3-6 rules

| id | что ловит | вход падения |
|---|---|---|
| L370 | нет восьми `visual3_*`; CT engine/assets/light/input/units/world ≠ пробам этапа; nonempty CT позднего ключа; минор < 22 | снят `visual3_form`; ghost; CT ghost/пуст у world; `rules_version` 0.21.0 |
| L372 | `--jobs 8` в `gate_cmd` V3-1…V3-6; world без L382/L383 | `--jobs 8` на world; stub `--only L370` на world |
| L382 | нет `plantWater` / `landCells` / `shoreFoam` / `isShoreWater`; нет `HemisphereLight`; нет `fill.intensity` | нет `plantWater`; нет `landCells`; нет `shoreFoam`; нет hemi; hemi без intensity |
| L383 | нет `plantDecor` / `isPackedDecor` / `InstancedMesh`; поза не `city_time`; физика; `vehicle_` в pick; height ≤ 0 | нет `plantDecor`; 1×1 кубы; нет `InstancedMesh`; нет `poseVehicle`; `decor_height_bps=0`; physics import; `Math.random`; `vehicle_` в pick |
| `visual3_water_one_plane` | море — одна плоскость; суша без `~` | нет `plantWater` → L382; нет `landCells` → L382; нет `shoreFoam` → L382 |
| `visual3_decor_instanced` | декор instanced из пака; gate не stub | нет `plantDecor` → L383; нет `InstancedMesh` → L383; stub world gate → L372 |
| `visual3_fill_light_no_physics` | fill hemi живой; нет физики; поза от часов | нет hemi / мёртвый hemi → L382; physics / void pose / `Math.random` → L383 |

L328 в линтере нет (R-V-8). `prize_live_min_rules_minor` 19. Правил 381. Свободный id **L384**.

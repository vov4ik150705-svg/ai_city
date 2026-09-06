# V3-1 rules

| id | что ловит | вход падения |
|---|---|---|
| L370 | нет восьми `visual3_*`; CT `visual3_engine` ≠ трём пробам V3-1; nonempty CT позднего ключа; минор < 22 | снят `visual3_form`; ghost; CT ghost/пуст; `rules_version` 0.21.0 |
| L348 | замороженные живые флаги **без** `visual3_frame_live` | `missions_live=1`, NFT-кран ≠ 0, снят `window_a_ratified` |
| L371 | `visual3_frame_live` ≠ 1; нет пина/импорта Three.js; нет `mountIsland3`/`islandCells`; Pixi как живой кадр | флаг 0; нет `from "three"`; `SceneHost` → `/pixi`; снят `toolchain.threejs` |
| L372 | `--jobs 8` в `gate_cmd` V3-1…V3-6; `visual3_engine.gate_cmd` без L371 и L373 | `--jobs 8`; stub `--only L370` |
| L373 | нет `orbit_*`; min ≥ max; дистанция = числитель `zoom_levels` den=1; нет `clampOrbit` | копия iso-зума; invert tilt; нет `orbit.ts` |
| `visual3_island_from_legend` | меш с легенды пака | нет `from "three"` → L371 |
| `visual3_orbit_from_pack` | орбита из пака | копия `zoom_levels` → L373; stub gate → L372 |
| `visual3_no_gpu_stays` | отказ без GPU; Pixi не кадр | Pixi live / флаг 0 → L371 |

L328 в линтере нет (R-V-8). `prize_live_min_rules_minor` 19. Правил 371.

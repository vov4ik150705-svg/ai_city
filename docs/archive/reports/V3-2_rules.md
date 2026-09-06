# V3-2 rules

| id | что ловит | вход падения |
|---|---|---|
| L370 | нет восьми `visual3_*`; CT `visual3_engine` ≠ трём пробам V3-1; CT `visual3_assets` ≠ трём пробам V3-2; nonempty CT позднего ключа; минор < 22 | снят `visual3_form`; ghost; CT ghost/пуст; `rules_version` 0.21.0 |
| L372 | `--jobs 8` в `gate_cmd` V3-1…V3-6; engine без L371/L373; assets без L374/L375 | `--jobs 8`; stub `--only L370` на engine или assets |
| L374 | каталог ≠ 18 id `buildings.json`; sha/material не уникальны; low ≥ high; NVIDIA brick не на research; нет GLB; цели remesh съехали; нет `plantHeroes`/`GLTFLoader` | снят `bank`; clone sha; lod low=high; brick на workshop; нет `bank_lod0.glb`; `hero_lod_high_quads=1000`; `ghost_hero`; overlay без loader |
| L375 | герои не на лоте; нет `spanX`/`spanZ`; `build_place` ≠ `commit:build`; filler в каталоге; лот 1×1; GLB в engine | нет `plantHeroes`; overlay без span; `commit:spawn_mesh`; `kind=filler`; `w=h=1`; `GLTFLoader` в engine |
| `visual3_heroes_by_building_id` | 18 GLB по id | drop `bank` / NVIDIA на workshop → L374 |
| `visual3_lod_lighter_than_high` | LOD low легче high; gate не stub | lod low≥high → L374; stub assets gate → L372 |
| `visual3_plant_on_lot` | посадка на лот; клик не спавнит меш | нет spanX / `commit:spawn_mesh` → L375 |

L328 в линтере нет (R-V-8). `prize_live_min_rules_minor` 19. Правил 373.

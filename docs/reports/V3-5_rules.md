# V3-5 rules

| id | что ловит | вход падения |
|---|---|---|
| L370 | нет восьми `visual3_*`; CT engine/assets/light/input/units ≠ пробам этапа; nonempty CT позднего ключа; минор < 22 | снят `visual3_form`; ghost; CT ghost/пуст у units; `rules_version` 0.21.0 |
| L372 | `--jobs 8` в `gate_cmd` V3-1…V3-6; units без L380/L381 | `--jobs 8` на units; stub `--only L370` на units |
| L380 | нет `plantUnits` / `isPackedWalker`; `three.ts` не сажает и не скипает walkers; нет `mesh.lookAt`; height/period/span ≤ 0; span ≥ grade; импорт pixi в `three.ts` | нет `plantUnits`; 1×1 кубы; нет `lookAt`; `unit_height_bps=0`; span=grade |
| L381 | поза не `cityMinutes(cityTime)`; `agent_id`/`agentId` в `units.ts` или `pick.ts`; `Date`/`Math.random` в `units.ts`; `walker_` в `pick.ts`; physics import | void `cityTime`; `agent_id`; `agentId`; `Math.random`; `walker_` в pick |
| `visual3_walkers_from_pack` | пешеходы из пака; height из пака | нет `plantUnits` → L380; height=0 → L380 |
| `visual3_units_billboard_or_mesh` | билборд/меш, не куб-остаток; gate не stub | 1×1 кубы → L380; нет `lookAt` → L380; stub units gate → L372 |
| `visual3_units_not_lootable` | не моб; поза от часов города | `agent_id`/`agentId`/`Math.random`/`void cityTime`/`walker_` в pick → L381 |

L328 в линтере нет (R-V-8). `prize_live_min_rules_minor` 19. Правил 379. Свободный id **L382**.

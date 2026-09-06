# V3-4 rules

| id | что ловит | вход падения |
|---|---|---|
| L370 | нет восьми `visual3_*`; CT engine/assets/light/input ≠ пробам этапа; nonempty CT позднего ключа; минор < 22 | снят `visual3_form`; ghost; CT ghost/пуст у input; `rules_version` 0.21.0 |
| L372 | `--jobs 8` в `gate_cmd` V3-1…V3-6; engine без L371/L373; assets без L374/L375; light без L376/L377; input без L378/L379 | `--jobs 8` на input; stub `--only L370` на input |
| L378 | нет `pickFromRay`/`hitPlaneY`/`heroAtTile`; `three.ts` без `Raycaster`/`setFromCamera` или с iso `tileFromWorld`; нет повторного луча в `waterY` / клетку `~` | снят `pickFromRay`; `tileFromWorld` в `three.ts`; нет `Raycaster`; снят `waterY` |
| L379 | пустой тайл не BUILD; закрытый сток не стейк; HUD chrome `pointer-events: none` или нет `hudBlocksPick` | `kind` не `building`; `.hud-col { pointer-events: none }`; нет `hudBlocksPick` |
| `visual3_ray_hits_tile` | луч в тайл сетки; gate не stub | нет `pickFromRay` → L378; iso hitAt → L378; нет `waterY` → L378; stub input gate → L372 |
| `visual3_empty_opens_build` | пустой → BUILD; закрытый сток → districts | `kind: "object"` → L379 |
| `visual3_hud_not_a_hole` | chrome ловит клик | `pointer-events: none` на `.hud-col` → L379; нет `hudBlocksPick` → L379 |

L328 в линтере нет (R-V-8). `prize_live_min_rules_minor` 19. Правил 377. Свободный id **L380**.

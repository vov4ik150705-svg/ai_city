# V3-0 rules

| id | что ловит | вход падения |
|---|---|---|
| L370 | нет восьми `visual3_*` между `visual_close` и `mainnet_launch`; чужое имя C/L/M/G/P/V; nonempty CT у позднего этапа; `visual3_frame_live` ≠ 0; минор < 22 | снят `visual3_form`; ghost после `visual_close`; `visual3_engine.construction_tests=["ghost_v3"]`; флаг 1; `rules_version` 0.21.0 |
| L348 | замороженные флаги, включая `visual3_frame_live=0` | `visual3_frame_live=1` |
| L353 | L-id в `gate_cmd` не зарегистрирован | `mainnet_launch` цитирует L328 |
| `visual3_stage_keys_exist` | окно после `visual_close` и 1:1 с vitest | снят ключ / ghost / нет V3-0 в `code-phase.mdc` |

L328 в линтере нет (R-V-8). `prize_live_min_rules_minor` 19. L306 минор v1.1 `>= 20`.

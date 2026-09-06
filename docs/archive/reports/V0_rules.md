# V0 — правила и пробы

| id | Что ловит | Вход падения |
|---|---|---|
| L306 | нет ключа v1.1; минор < 20; пустые рычаги | `rules_version=0.19.0`; снят `v11_form`; `v11_levers={}` |
| L329 | `scene.json?url` / `art/out/scene.json` в client src; нет `placement["scene"]`; `layout_hash` ≠ sha256(scene) | overlay `import scene.json?url`; `_attack_layout_hash` |
| L347 | `missions_live≠0` или `missions_start` не stub | `missions_live=1`; `effect=commit:missions_start` |
| L348 | сдвиг замороженного флага | каждый из семи: revenue/missions/autopilot=1, window_a=0, prizes=0, nft cranes=400 |
| L353 | `gate_cmd` цитирует незарегистрированный `L*` | `mainnet_launch.gate_cmd` += `,L328` |

Пробы `visual_form` (L268 1:1):

| имя | Красный вход внутри `it()` / construction |
|---|---|
| `visual_stage_keys_exist` | снят `visual_form`; 14-й ключ после `ops_watch` |
| `scene_comes_from_pack` | ghost `scene.json?url`; поддельный `layout_hash` |
| `code_phase_rule_still_single` | `visual-phase.mdc` alwaysApply |
| `missions_stay_stubbed` | `missions_live=1`; живой effect |
| `visual_flag_inventory_holds` | любой из семи флагов |

`release_stage_keys_exist`: хвост после `rebalance_close` **фильтр** 13 визуальных id, не сырой slice.

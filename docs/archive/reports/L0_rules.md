# L0 — пробы и поимки

Новых `L*` нет. Зона: `live_form.construction_tests`, `content/attack.py` конструкции, L262/L268 как держатели таблицы.

Пак: **503 502** байт, хеш **`226adb8a4ba399c1894c72a9c1c9cced84a3bcc8bf1a3b6d5db2c94bb497a684`**, `pack_version` **37**, `rules_version` **0.18.0**.

Конструкции vitest (`live_form.construction_tests`), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `live_stage_keys_exist` | снят `live_form` из `roadmap_order` и `roadmap` | `missingLiveKeys` = `['live_form']` |
| `live_stage_keys_exist` | `live_form` повторён в `roadmap_order` | `duplicate_order_id` |
| `live_stage_keys_exist` | ключ `ghost_stage` только в dict | `extra:ghost_stage` |
| `code_phase_rule_not_always` | синтетический `live-phase.mdc` + `alwaysApply: true` | `phaseAlwaysNames` ≠ `['code-phase.mdc']` |

Python-конструкции с тем же смыслом. Поимки L262/L268:

| id | что ловит | вход | дословная поимка |
|---|---|---|---|
| L262 | этап без `gate_cmd` | `pack_gate.gate_cmd=""` | `L262  stage pack_gate has no gate command` |
| L268 | пустой `ts_gate_cmd` | `pack_gate.ts_gate_cmd=""` | `L268  stage pack_gate has no ts_gate_cmd` |
| L268 | имя не в vitest | `construction_tests` + `ghost_l0` | `L268  construction test 'ghost_l0' occurs 0 times in vitest, want 1` |
| construction | нет живого ключа | снят `pons_launch` | `live stage keys missing: ['pons_launch']` |

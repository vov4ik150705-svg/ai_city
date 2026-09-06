# M0 — пробы и поимки

Новых `L*` нет. Зона: `money_form.construction_tests`, `content/attack.py` конструкции, L262/L268 как держатели таблицы, пустой `launch.deployed`.

Пак: **527 288** байт, хеш **`80abab53042634c4d8ea8f4a82cee004a6b8d9c83e4b01c6608f8ff6e07509e0`**, `pack_version` **46**, `rules_version` **0.18.0**.

Конструкции vitest (`money_form.construction_tests`), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `money_stage_keys_exist` | снят `money_form` из `roadmap_order` и `roadmap` | `money stage keys missing: ['money_form']` |
| `money_stage_keys_exist` | `money_form` повторён в `roadmap_order` | `duplicate_order_id` |
| `money_stage_keys_exist` | ключ `ghost_stage` только в dict | `extra:ghost_stage` |
| `money_stage_keys_exist` | `owner_drain` в порядке и dict | `owner_drain is not a money-phase key` |
| `money_stage_keys_exist` | `ghost_money` сразу после `pons_launch` | suffix ≠ девять ключей |
| `money_stage_keys_exist` | `fee_split.construction_tests = ["ghost_m0"]` | must stay empty until its stage |
| `launch_precondition_not_launched` | `deployed.token` заполнен | `filled ['token']` |
| `launch_precondition_not_launched` | все пять полей заполнены | `filled ['token', 'curve', 'pool', 'hook', 'tx']` (L279 молчит) |

Python-конструкции с тем же смыслом. Поимки L262/L268:

| id | что ловит | вход | дословная поимка |
|---|---|---|---|
| L262 | этап без `gate_cmd` | `pack_gate.gate_cmd=""` | `L262  stage pack_gate has no gate command` |
| L268 | пустой `ts_gate_cmd` | `pack_gate.ts_gate_cmd=""` | `L268  stage pack_gate has no ts_gate_cmd` |
| construction | нет денежного ключа | снят `money_form` | `money stage keys missing: ['money_form']` |
| construction | запрещённый ключ §4 | `owner_drain` | `owner_drain is not a money-phase key` |

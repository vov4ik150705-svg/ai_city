# G0 — пробы и поимки

Новое правило **L306**. L290 изменён: водяной знак пин 19, не lockstep с minor `rules_version`.

Пак: **556 183** байт, хеш **`2a39425f88b7d0c23b610e0691b06803c3836c4c7eca900d09299f3432a0162e`**, `pack_version` **55**, `rules_version` **0.20.0**.

## L306

| что ловит | вход падения | поимка |
|---|---|---|
| нет ключа этапа | снят `v11_form` | `v1.1 stage keys missing: ['v11_form']` |
| минор ≠ 20 | `rules_version` `0.19.0` | `rules_version minor 19 != 20` |
| пустой инвентарь | `v11_levers = {}` | `v11_levers inventory is empty` |

## L290

| что ловит | вход | поимка |
|---|---|---|
| знак снижен | `prize_live_min_rules_minor=18` | `18 != prize-formula minor 19` |
| знак поднят lockstep | `=20` | `20 != prize-formula minor 19` |

## Конструкции `v11_form.construction_tests`

| имя | вход падения | факт |
|---|---|---|
| `v11_stage_keys_exist` | снят `v11_form` | missing |
| `v11_stage_keys_exist` | дубль / ghost / девятый `owner_drain` / вставка после `launch_freeze` | gaps / suffix |
| `v11_stage_keys_exist` | `districts_live.construction_tests` непустой | must stay empty until its stage |
| `rules_minor_is_twenty` | `0.19.0` | L306 |
| `live_flags_inventoried` | пустой инвентарь | L306 |
| `live_flags_inventoried` | `logistics.playable_v1=true` | flip detected |
| `live_flags_inventoried` | водяной знак 20 | D-G-3 |

Vitest: три `it()` = три имени, красный прогон на синтетическом входе внутри теста, затем зелёный на диске.

L262/L268: `gate_cmd=""` / `ts_gate_cmd=""` пойманы как раньше.

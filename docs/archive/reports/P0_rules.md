# P0 — пробы и поимки

Новое правило **L314**. L306 сужен: хвост после `launch_freeze` — префикс из восьми ключей v1.1.

Пак: **572 712** байт, хеш **`4f26daf18e7ac2c61d8275babd9cf53e3f931b85efd1000f96a1cd8712d93071`**, `pack_version` **63**, `rules_version` **0.20.0**.

## L314

| что ловит | вход падения | поимка |
|---|---|---|
| 32-байтовый ключ | `0x`+64 в `services/api/src/boot.ts` | `contains a 32-byte hex key` |
| hex-адрес вне deployed | `0x`+40 в `boot.ts` | `hex address outside launch.deployed / chain.deployed` |
| ключ в `.env` | `deploy/.env` `PRIVATE_KEY=0x`+64 | `contains a 32-byte hex key` |

Не ловит (так задумано): адрес HEVM `0x7109709ECfa91a80626fF3989D68f67F5b1DD12D`; адрес, перечисленный в `launch.deployed`; непрефиксные 64 hex.

## L268 / L262

| что ловит | вход | поимка |
|---|---|---|
| пустые `release_form.construction_tests` | `construction_tests=[]` | `vitest names not in construction_tests: ['release_stage_keys_exist', 'no_key_material_in_repo']` |
| нет `ts_gate_cmd` | как раньше | `pack_gate has no ts_gate_cmd` |
| нет `gate_cmd` | как раньше | `pack_gate has no gate command` |

## Конструкции `release_form.construction_tests`

| имя | вход падения | факт |
|---|---|---|
| `release_stage_keys_exist` | снят `release_form` | missing |
| `release_stage_keys_exist` | дубль / ghost / десятый `owner_drain` / вставка после `rebalance_close` | gaps / tail |
| `release_stage_keys_exist` | `player_identity.construction_tests` непустой | must stay empty until its stage |
| `no_key_material_in_repo` | 64 hex в boot.ts | L314 |
| `no_key_material_in_repo` | HEVM | не роняет |
| `no_key_material_in_repo` | адрес в `launch.deployed` | не роняет |

Vitest: два `it()` = два имени, красный прогон на синтетическом входе внутри теста, затем зелёный на диске.

## L306 после ключей P

Префикс из восьми после `launch_freeze` совпадает с `V11_STAGE_IDS`. Девятый ключ, вставленный сразу после `launch_freeze`, по-прежнему роняет конструкцию G0.

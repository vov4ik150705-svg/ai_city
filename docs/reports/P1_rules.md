# P1 — пробы и поимки

Новые правила **L315**–**L318**. L232/L235/L247–L251/L255 не ослаблены.

Пак: **577 238** байт, хеш **`12b0703d8d63f3ade53be3c13345b9685b253f24b35f4781d9f8a286960ee765`**, `pack_version` **64**, `rules_version` **0.20.0**.

## L315

| что ловит | вход падения | поимка |
|---|---|---|
| `city_id` из тела | `asText(obj["city_id"])` в `commands.ts` | `reads city_id from the command body` |
| нет сессии на командном пути | `commands.ts` без `sessionFromHeaders` / `session.cityId` | `command path has no session check` |

## L316

| что ловит | вход | поимка |
|---|---|---|
| литерал `/auth/session` в `http.ts` | ветка `path === "/auth/session"` | `hardcodes an auth path` |
| снят `auth_nonce` | `path_rules` без ключа | `auth_nonce template is not POST /auth/nonce from the pack` |
| `message_fields` не канон | `["domain"]` | `session message_fields ['domain'] != pack canon` |

`/auth/` в `command_endpoints` тоже роняет (биекция `commit:*` закрыта).

## L317

| что ловит | вход | поимка |
|---|---|---|
| идентичность в записи | `owner_address` в спеке `DecisionRecord` | `DecisionRecord spec carries identity field owner_address` |
| layout съехал | `layout_version` 2 | `layout_version 2 moved off v1` |

То же для заголовка тика и `record_field_homes`.

## L318

| что ловит | вход | поимка |
|---|---|---|
| лимит в памяти | `RateGate` на хосте | `keeps the command rate in process memory` |
| нет таблицы | нет `command_rates` | `command_rates table is missing` |
| нет инкремента | `rates.ts` без `command_rates` | `command path does not increment command_rates` |

## Конструкции `player_identity.construction_tests`

| имя | вход падения | факт |
|---|---|---|
| `command_without_session_refused` | POST команды без `Authorization` | HTTP 401, `API_UNAUTHORIZED`; GET снимка без сессии 200 |
| `city_id_comes_from_session` | тело `city_id=zzz` при сессии `"a"` | `DEMO_NO_PRIZE`, города `zzz` нет |
| `demo_session_has_no_address` | `POST /auth/session` `{account_kind:demo}` | нет поля `address` в ответе и в строке |
| `identity_absent_from_record_bytes` | тик после сессии | маркеры идентичности не в header/record; `layout_version` 1 |
| `rate_limit_survives_restart` | лимит на host1, новый host на том же store | второй хост сразу `API_RATE_LIMITED` |

Vitest: пять `it()` = пять имён, красный прогон на подготовленном входе внутри теста, затем зелёный на диске. Шестого `it()` нет (`L268`).

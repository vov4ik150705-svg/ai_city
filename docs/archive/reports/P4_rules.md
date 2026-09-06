# P4 — правила и пробы

## L322 `prod_profile_has_no_source_mount` / `two_replicas_tick_once` / пин образа

Ловит: `volumes: ..:/app` или `.:/app` в прод-yaml; нет `migrate:`; нет healthcheck/restart; нет postgres; runtime без `USER node` или с `USER root`; `image.pin` не `pack_hash`; нет `ENV PACK_HASH`; нет вшитого `/app/pack.json`; `content/` в runtime; нет таблицы `tick_locks`.

| вход падения | правило | факт |
|---|---|---|
| `_compose_prod` с `volumes: ..:/app` | L322 | `prod profile mounts the repository` |
| Dockerfile overlay `USER root` | L322 | `runtime image is root` |
| прод-yaml без `migrate:` | L322 | `migrations are not a separate job` |
| снят `schema_tables.tick_locks` | L322 | `tick_locks table is missing` |

Vitest `prod_profile_has_no_source_mount`: dev yaml содержит `..:/app`, prod — нет; `/ready` несёт `pack_hash` и CSP без `unsafe-inline`.

Vitest `two_replicas_tick_once`: без замка два `tickOnce` на общем state → 2 строки `tick_inputs`; с `pgTickLock` → 1 строка; реплика отвечает на GET `/ready`.

`image_pins_pack_hash` не дублируется: имя уже есть в C9, L268 требует ровно один `it()`.

## L323 секреты

Ловит: роль `arch.keys` без строки в `arch.secrets`; пустой `env`; одно имя на две роли; лишняя роль; имя встречается `>1` раз в compose+prod+Dockerfile.

| вход падения | факт |
|---|---|
| два ключа `CORPORATOR_VOUCHER_SIGNER` в yaml | `appears 4 times` (ключ и `${…}` на каждой строке) |
| снят `secrets.roles.voucher_signer` | `key role voucher_signer has no secrets row` |

Ноль вхождений имени в yaml — норма: значения идут из `env_file`.

## L324 бэкап

Ловит: пустой `arch.backup`; `schedule_kind` не `city_day`; `retention_src` не резолвится; нет `restore_cmd` или файла; нет `replay_witness` или свидетель не в `prod_image.construction_tests`.

| вход падения | факт |
|---|---|
| снят `replay_witness` | `backup has no replay witness` |

Vitest `restore_replay_matches_origin`: дамп `tick_inputs` → чистый store → `replayStored` байт-равен оригиналу.

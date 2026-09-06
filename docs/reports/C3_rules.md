# C3 — пробы и поимки

Новых правил `L*` нет. L268 сканер не заходит в `node_modules`. Cruiser слой считает только `packages|apps|services` и `@corporator/*`. `migrate:check` требует полный текст CONSTRAINT.

Пак: **485143** байт, хеш **`df73e02dd75b3b8187e64c0e23a62f310b4764128a35200744a6f77018b1f659`**, `pack_version` **28**, `rules_version` **0.17.0**.

Конструкции vitest (`host_db_replay.construction_tests`), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `replay_from_storage` | реплей без байтов header | не совпали с генезисным прогоном |
| `snapshot_tail_equals_full_replay` | хвост без cut `hour===0n` | байты ≠ полный реплей |
| `intent_replay_once` | второй POST без lookup | второй эффект / не `API_INTENT_REPLAY` |
| `stale_expected_city_time` | сверка времени выключена | команда прошла |
| `rate_limit_derived` | лимит+1 принят | нет `API_RATE_LIMITED`; ключа в params нет |
| `demo_barrier_holds` | CHECK снят | INSERT demo→wallet прошёл |
| `endpoint_bijection` | путь вне `commit:*` | множества разошлись |
| `refusal_matrix_matches_t9` | порядок кодов сменён | withdraw ≠ generated |
| `stub_endpoint_no_spend` | `claim_prize` живой spend | fund сдвинулся |
| `channels_partition_state_sources` | источник без канала | `partitionsSources` false |
| `clock_has_no_channel` | канал `clock` | `channelOf("clock")` задан |
| `readiness_requires_pack` | head.pack_hash=`00` | ready true |
| `invariants_all_metered` | литеральный порог / `pending` throw | длина ≠ metrics или исключение |
| `services_do_not_block_tick` | await аттестатора / чужой hash без halt | `called===true` или тик не PACK_HASH |

Первый полный прогон 14/14 красный: `metricsFromPack` ходил в `sections.time.derived`, ключ живёт в `generated.time`; `pending.*` не в `pack.sections`. Закрыто walk + порог = строка src.

Прочие красные входы:

| вход | правило | факт |
|---|---|---|
| pnpm link `services/api/node_modules/@corporator/engine/test` | L268 | `toolchain_matches_manifests` n=2; T9 empty-requires красный; skip `node_modules` |
| cruiser `to.pathNot` без фильтра workspace | layer-api | 5 errors: pglite, fs, path, url |
| `import "@corporator/client"` в `store.ts` | layer-api | 1 violation; файл восстановлен |
| CONSTRAINT заменён комментарием `-- demo_wallet_barrier` | migrate:check | сначала INSERT прошёл; после правки — `DDL missing` exit 1 |
| `demo_transfer_edges = ["demo_to_wallet"]` в генераторе | construction DDL | CHECK исчезает |
| L255/L260/L267/L268/L270 overlay | attack.py --only | все пойманы |

Python-конструкции добавлены: L268 skip links; DDL CHECK ↔ пустые edges.

# C3 — итоговый отчёт шага

Хост `services/api` с PGlite, реплеем из байтов и 14 конструкционными `it()`. Neon не запрашивался. CID не делался (`R-C-6`). Solidity/RPC — C4/C10.

Пак **28**, `rules_version` **0.17.0**, хеш **`df73e02dd75b3b8187e64c0e23a62f310b4764128a35200744a6f77018b1f659`**, 485143 канонических байт.

---

## 1. Что закрыто

- Реплей ≥ `ticks_per_city_day` (24) тиков: header+record байты = генезисный прогон.
- Хвост от снапшота `hour===0n` = полный реплей побайтово.
- Повтор `intent_id` → HTTP 200 + `API_INTENT_REPLAY`, fund без второго эффекта.
- Устаревшая `expected_city_time` → `API_PACK_STALE`.
- Лимит команд derived, ключа в params нет; лимит+1 → `API_RATE_LIMITED`.
- INSERT demo→wallet режется CHECK БД; `migrate:check` требует полный CONSTRAINT.
- readiness красный при `pack_hash` ≠ пак.
- Метрики без литеральных порогов; `pending` threshold_src не выдумывает число.
- 14 имён = 14 `it()`. L268 1:1.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0 проблем канона; `pack_version` 28; круг 14.47% / Trader 11.67% |
| хеш пака | `df73e02dd75b3b8187e64c0e23a62f310b4764128a35200744a6f77018b1f659` |
| канонические байты | 485143 |
| `python content/lint.py` | **272 правила, 0 ошибок**, PENDING 27 |
| `python content/vectors.py` | 20 файлов; sha256 `26b143e0a893c22fdd21713c3bd99601f3ab0f4bcac825c5cf8cb4021740747c` |
| `python content/codegen.py --check` | 12 артефактов match `df73e02dd75b3b81` |
| `python content/attack.py --construction-only` | **145/0** (было 143; +L268 skip, +DDL CHECK) |
| `pnpm --filter @corporator/api run gate` | tsc ok; vitest **14/0** |
| `pnpm --filter @corporator/api run migrate:check` | green |
| protocol / contentpack / engine gate | tsc; contentpack **6/0**; engine **13/0** |
| `pnpm -w run gate` | tsc-b + eslint + depcruise **189/0**; vitest **33/0** |
| `python content/attack.py --only L255,L260,L267,L268,L270` | все overlay пойманы |

## 3. Конструкционные пробы C3 (имена дословно)

`replay_from_storage`, `snapshot_tail_equals_full_replay`, `intent_replay_once`, `stale_expected_city_time`, `rate_limit_derived`, `demo_barrier_holds`, `endpoint_bijection`, `refusal_matrix_matches_t9`, `stub_endpoint_no_spend`, `channels_partition_state_sources`, `clock_has_no_channel`, `readiness_requires_pack`, `invariants_all_metered`, `services_do_not_block_tick`.

## 4. Расхождения R-C-*

| id | суть | статус |
|---|---|---|
| R-C-6 | нет CID в оракуле | не в C3; PENDING C8 |
| R-C-11 | engine `no-magic-numbers` off | C1, не трогали |
| R-C-13 | canonical/sha256 скопированы в contentpack | C2, не трогали |
| R-C-14 | PLAN C3 перечисляет `pack_hash_mismatch_halts` и `record_fields_have_homes` | **принято:** имена остаются C2-only (L268 1:1) |
| R-C-15 | план намекает на `pg` / hosted URL | **принято:** гейт C3 = PGlite 0.5.7; `pg` в toolchain не в манифесте api |

`bank_withdraw_rate_ceiling_only` остаётся owner T3. `district_stake_usd_assumption` — T3; C3 держит `district_stake_usd_target_8dec` через engine `loadConfig`.

## 5. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| rglob `*.test.ts` через pnpm link | L268 n=1 | n=2 `toolchain_matches_manifests` | закрыто: skip `node_modules` |
| cruiser pathNot на любой не-allowed путь | 0 violations | 5 errors pglite/fs | закрыто: запрет только workspace + `@corporator/` |
| `import "@corporator/client"` из api | layer-api | 1 error | правило не декорация |
| CHECK → комментарий с тем же именем | migrate:check ≠ | INSERT прошёл, затем string `includes(name)` тоже | закрыто: полный текст CONSTRAINT |
| `pending.*` threshold_src вне sections | не throw / не 267 | throw до фикса | закрыто: порог = строка src |
| `time.derived.*` в sections | метрики | ключ в generated | закрыто walk |
| demo→wallet INSERT | отказ | CHECK | держит |
| intent дважды | один эффект | replay envelope | держит |
| pack_hash `00` в head | ready false | false | держит |
| чужой pack_hash во входе тика | PACK_HASH, rollback | halt | держит |
| аттестатор throw | тик не wait | `called===false` | держит |

Выжившее без исправления: engine test `jsonBigint` перезаписывает дубликаты (C1). `pg` в toolchain не используется api. PGlite ~2 с/тест на wasm init.

## 6. Незакрытое

C4: `packages/chainport` mock+rpc stub. C5 не добавляет второй `it("demo_barrier_holds")`. CID — C8. Hosted Postgres — когда появится `DATABASE_URL`, не гейт C3.

Next: C4 — port_mock.

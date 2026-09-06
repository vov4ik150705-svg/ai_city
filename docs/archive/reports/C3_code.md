# C3 — журнал кода

Хост команд и состояния, forward-only миграции, байтовый реплей из PGlite. Neon / `DATABASE_URL` не требовались. Экономические формулы не тронуты. Круг 14.47% / Trader 11.67%.

Пак после `python content/build.py`: **485143** канонических байт, хеш **`df73e02dd75b3b8187e64c0e23a62f310b4764128a35200744a6f77018b1f659`**, `pack_version` **28**, `rules_version` **0.17.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `services/api/src/values.ts` | `asObj` / `asBigint` / `walk`; без `!` |
| `services/api/src/pack_ctx.ts` | лимит команд, ticks/day, отказы, заглушки, шаблоны — только из пака |
| `services/api/src/store.ts` | PGlite; `putBytes` / `putJson` / `getBytes` |
| `services/api/src/migrate.ts` | SQL + `schema_migrations.head` `{version, pack_hash}` |
| `services/api/src/migrate_check.ts` | PGlite+fs; полный `CONSTRAINT demo_wallet_barrier CHECK (...)` |
| `services/api/src/envelope.ts` | ok/error; HTTP из `transportHttp` |
| `services/api/src/channels.ts` | in-process fanout из `channelMap` |
| `services/api/src/metrics.ts` | 10 метрик; `threshold_src` walk; `pending.*` не в секциях — порог = строка src |
| `services/api/src/readiness.ts` | ready iff hash+version |
| `services/api/src/tick_host.ts` | BEGIN→`tick()`→header/records/outbox→snapshot `hour===0n`→COMMIT; аттестатор не await |
| `services/api/src/commands.ts` | replay intent; stale → `API_PACK_STALE`; stub → `FEATURE_NOT_IN_V1` |
| `services/api/src/http.ts` | POST `/command/{effect}`, GET pack, GET state |
| `services/api/src/host.ts` | `createHost` |
| `services/api/test/harness.ts` | `bootHost`, `makeInputs`, genesis из пака |
| `services/api/test/c3.test.ts` | 14 имён `host_db_replay.construction_tests` |

GEN: `services/api/migrations/001_from_pack.sql` (DDL + CHECK при пустых `demo_transfer_edges`).

## 2. Изменено

`content/params/meta.json` (27→28), `arch.json` (`construction_tests`, `schema_migrations`, toolchain `electric_sql_pglite` 0.5.7, workspace engine/contentpack), `content/codegen.py` (`emit_schema_ddl` CHECK; `emit_layer_cruiser` запрещает только workspace/`@corporator/*` вне `allowed_deps`), `content/lint.py` (L268 skip `node_modules`/`dist`), `content/attack.py` (две конструкции), `packages/engine` и `contentpack` exports, `vitest.workspace.ts`, `eslint.config.js` (Date/Math на `tick_host.ts`), `docs/CONTENT.md` §5 байты, `.dependency-cruiser.cjs` GEN.

## 3. Решения без развилки

- БД гейта — `@electric-sql/pglite`. `pg` в toolchain остаётся для позднего URL. **R-C-15.**
- `pack_hash_mismatch_halts` / `record_fields_have_homes` не дублируются в C3. **R-C-14.**
- `demo_barrier_holds` — единственный `it()` с этим именем (C5 не добавляет второй).
- HTTP 200 ok = `transportHttp.API_INTENT_REPLAY`, не литерал.
- Снапшот state — canonical contentpack (null в паке). Engine canonical null запрещает.
- WS TCP нет (`ws` нет в toolchain). Каналы in-process.
- `migrate:check` без импорта contentpack: Node `--experimental-strip-types` не резолвит `.js`→`.ts` workspace.

## 4. Инертность

`python content/build.py`: круг 14.47% / Trader 11.67%. Касса и фонд не минтятся хостом без депозита в тике.

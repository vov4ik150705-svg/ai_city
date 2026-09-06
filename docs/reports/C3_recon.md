# C3 — разведка

Хост команд и состояния, forward-only миграции, байтовый реплей из хранилища. Строка ROADMAP `host_db_replay`. Neon / hosted Postgres не требуются: гейт и локальный хост — `@electric-sql/pglite`, пин в `arch.toolchain`. `pg` остаётся в toolchain для позднего `DATABASE_URL` (не C3).

## Прочитано

PLAN_CODE §4 C3, D-C-9, D-C-10; ARCHITECTURE §3 §5 §9; API.md §1–§6; TICK.md §2 §6 §9; C2_final; schema_tables; metrics; readiness; api.path_rules; engine `tick`/`catchUp`/`encodeRecord`; contentpack `loadPack`/`canonical`/`getPack`; codegen `emit_schema_ddl`; L251–L260, L267, L268.

## Дерево до шага

`services/api/src/index.ts` = `export {}`. Gate = `tsc --noEmit`. `migrations/001_from_pack.sql` — GEN, без барьера demo↔wallet (комментарий). `construction_tests` у `host_db_replay` были пустые.

## Решения

- PGlite, не Neon. Пользователь отложил креды.
- `pack_hash_mismatch_halts` и `record_fields_have_homes` остаются единственными `it()` в C2 (L268). C3 не дублирует. **R-C-14.**
- `demo_barrier_holds` — имя vitest у C3 (INSERT на CHECK). C5 не добавляет второе `it()`.
- Снапшот state через canonical contentpack (null в `mon`/`day_budget_day`). Engine canonical null запрещает.
- Chainport не импортируется. Live-команды без порта отдают первый код T9. Заглушки — `FEATURE_NOT_IN_V1`, spend none.
- WS TCP не добавляется (`ws` нет в toolchain). Каналы — in-process fanout.
- HTTP 200 для ok берётся из `transportHttp.API_INTENT_REPLAY`, не литерал.

## Риски этапа

RK-6 DDL/CHECK, RK-7, RK-8 снапшот на границе суток, RK-12 барьер демо, RK-13.

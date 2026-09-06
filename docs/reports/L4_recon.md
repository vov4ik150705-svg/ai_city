# L4 — разведка

Прод-хранилище и один состав сервисов. PGlite остаётся харнессом.

Вход: пак **40**, `rules_version` **0.18.0**, хеш **`316bb22fbccadb21050838b6e788bc7bf733adca2acde3707794912440b6df90`**, lint **275/0**, vitest **63/0**. L3 закрыт. `R-L-5`, `R-L-10` открыты.

## Прочитано

PLAN_LIVE §4 L4, D-L-6, D-C-9, D-L-3, RK-L-5/6/14, R-L-5, R-L-10; ARCHITECTURE §5/§9; `services/api/src/store.ts` только `openPglite`; `createHost` всегда PGlite; `deploy/Dockerfile` копирует только `api/dist`; compose нет; `pg` в toolchain 8.23.0, в манифесте api нет; `arch.environments` только `migrations: forward`; `pg_compose.construction_tests` пустой. Имена C3/C9 заняты. Docker в PATH нет.

## Дерево до шага

- `Store` уже интерфейс. Второй драйвер отсутствует.
- `migrate:check` — PGlite. DDL `001_from_pack.sql` из пака, CHECK `demo_wallet_barrier`.
- `listen.bind` = `127.0.0.1`. В контейнере процесс на loopback не слышен соседям.
- `image.runtime_python` / `copy_content` = 0. `runtime_pglite` нет. `image_has_no_python` не ищет pglite.
- Порты 7460–7464 в `arch.listen`. Postgres-порта в паке нет.

## ТЗ на шаг

1. `openPg` через `pg` 8.23.0. `createHost` / C3 остаются на PGlite. `startMain` требует `DATABASE_URL`.
2. Compose `dev`/`staging`/`prod` из пака (профили). Сервисы = entrypoint `services/*` + Postgres. Порты и DSN из пака.
3. Dockerfile копирует все пять `dist`. Runtime без python, content/, pglite.
4. Реплей суток на Postgres = байты PGlite. Docker нет: харнесс `embedded-postgres`, не второй прод-драйвер.
5. L276 + два construction: `postgres_replay_matches_pglite`, `compose_from_pack`. Пак **41**.
6. Не тащить: L5, L6, L7, клиент, `AssetPort.kind=rpc`.

## Риски

- Литерал порта в compose и Dockerfile (RK-L-14).
- DEFAULT/CHECK с числом экономики в DDL (RK-L-5) — DDL только из пака.
- `pg` в client/engine (L230/L228).
- Образ тащит pglite (RK-L-6).
- `it()` без строки L268.
- Docker нет: без живого Postgres критерий реплея не закрыть. Рекомендация: embedded-postgres как тестовый сервер, compose image major из `toolchain.postgres`.

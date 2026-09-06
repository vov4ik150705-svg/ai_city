# L4 — код

Postgres в процессе. PGlite остаётся харнессом. Compose из пака.

## Написано

- Пак **41**: `arch.postgres`, `listen.container_bind`, `image.runtime_pglite=0`, `codegen.compose`, toolchain `pg` 8.23.0 и `embedded_postgres` 18.4.0-beta.17. `pg_compose.construction_tests` = `postgres_replay_matches_pglite`, `compose_from_pack`. L276.
- `openPg`: один `pg.Client`, `SET client_encoding UTF8`, BYTEA через `Buffer`/`Uint8Array.from`. `createHost` по умолчанию `openPglite`. `startMain` требует `DATABASE_URL`.
- Кодоген: `deploy/compose.yaml` (профили `dev`/`staging`/`prod`, пять entrypoint + postgres); Dockerfile копирует все пять `dist`.
- Харнесс теста: `DATABASE_URL` → docker `postgres:16` → `embedded-postgres`. `pnpm-workspace.yaml` `allowBuilds` для нативных бинарников (pnpm 11 не читает `package.json#pnpm`).
- C3/C9 не переписывались. `image_has_no_python` ищет ещё `pglite` / `embedded-postgres`.

## Решения

- Один Client, не Pool: `runTick` держит `BEGIN`/`COMMIT` на одном соединении (`docs/ARCHITECTURE.md` §9).
- Host bind остаётся `127.0.0.1`; в контейнере `container_bind` `0.0.0.0`.
- DDL-комментарий ASCII: Windows Postgres по умолчанию WIN1252.

## Не это этап

`docker compose up` пяти контейнеров, образ с `node_modules`, Solidity, RPC live, L6.

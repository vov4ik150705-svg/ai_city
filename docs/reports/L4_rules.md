# L4 — правила и пробы

| id | что ловит | вход падения |
|---|---|---|
| L276 | compose не из пака, нет сервиса/порта, Dockerfile без всех `dist`, `runtime_pglite≠0` | overlay yaml без `llm`; `runtime_pglite=1`; Dockerfile только `api/dist` |
| `compose_from_pack` | yaml без сервиса или Dockerfile без `services/*/dist` | overlay compose без sampler; Dockerfile без sampler/dist |
| `postgres_replay_matches_pglite` | нет `openPg(` / `from "pg"`; pglite в runtime deps | overlay `openPglite` без `openPg(` |

Vitest: сутки на Postgres = байты PGlite; `INSERT` demo→wallet падает CHECK; readiness отдаёт `pack_hash`. `runtime_pglite=0` как falsy ловил L276 до явного `int(...) != 0`.

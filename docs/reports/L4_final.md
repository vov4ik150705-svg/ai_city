# L4 — итоговый отчёт шага

Прод-хранилище Postgres. PGlite остаётся харнессом. Compose из пака. `R-L-5` и `R-L-10` закрыты.

Пак **41**, `rules_version` **0.18.0**, хеш **`d4714818738c59832538059532c268cef9aea8e91170abe4fada967b88315be3`**, 512348 байт.

## 1. Что закрыто

- `openPg` на одном `pg.Client`; `startMain` требует `DATABASE_URL`. C3 остаётся на PGlite.
- Реплей суток на Postgres = байты PGlite. `INSERT` demo→wallet падает CHECK. Readiness = `pack_hash` + `migration_version`.
- Compose `dev`/`staging`/`prod`: api, sampler, buyback, attestor, llm + postgres. Dockerfile копирует все пять `dist`. Runtime без python/pglite.
- L276 + два construction. `pg` 8.23.0 runtime; `embedded-postgres` 18.4.0-beta.17 — тест.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0 проблем; pack 41; круг 14.47% / Trader 11.67% |
| хеш пака | `d4714818738c59832538059532c268cef9aea8e91170abe4fada967b88315be3` |
| канонические байты | 512348 |
| `python content/lint.py` | **276/0**, PENDING 6 |
| `python content/vectors.py` | 21; sha256 `3cda72e7667296ceeab26ad112e61c7def4157461ce0db7516e1dfc1c28fbdea` |
| `python content/codegen.py --check` | 17 match `d4714818738c5983` |
| tsc / eslint | ok |
| depcruise | **428/0** |
| vitest run | **65/0** |
| `python content/attack.py --only L276` | 3/0, construction **162/0** |
| `python content/attack.py --jobs 8` | **370/0**, construction **162/0**, 276 covered, 686.8s |
| `python content/sim.py` | калибровка `A_t2=14011`, возвраты 2837/8213 |
| `migrate:check` | 0 |
| `replay_from_storage` / `image_has_no_python` | 2/0 |

Новые зависимости: `pg` 8.23.0 (runtime api), `embedded-postgres` 18.4.0-beta.17 (dev). `pnpm` через corepack + `NODE_OPTIONS=--use-system-ca`.

## 3. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| `runtime_pglite=0` и `int(x or 1)` | L276 молчит | `runtime image allows pglite` | закрыто: явный `int(...) != 0` |
| `runtime_pglite=1` | L276 | `runtime image allows pglite` | D-L-6 |
| compose без llm | L276 | `compose is missing service llm` | пять entrypoint |
| Dockerfile только api/dist | L276 | `does not copy services/attestor/dist` | R-L-10 |
| overlay `openPglite` без `openPg(` | construction | сначала ложно `from "pg"` (`openPg` префикс `openPglite`); после `openPg(` → `openPg missing` | закрыто |
| `Pool.query` + BEGIN/COMMIT | тик на одном соединении | пул прыгает | закрыто: один Client |
| DDL с `↔` на WIN1252 | миграция | `0xe2 0x86 0x94` / WIN1252 | закрыто: UTF8 + ASCII-комментарий |
| overlay compose без sampler | construction | `compose missing sampler was accepted` не случилось | L276 |
| demo→wallet INSERT | CHECK | crossed=false | L255 |
| сутки PGlite vs Postgres | байты | 65/0, replay совпал | catchup_eq_replay |

Выжило (названо): `R-L-18` — нет Docker, `compose up` не гонялся; Dockerfile без `node_modules`/`pg`; embedded 18 vs compose `postgres:16`. `pnpm run test -- -t a -t b` на vitest 4 не парсится (один pattern); прогон regexp 2/0.

## 4. Расхождения R-L-*

| id | суть | статус |
|---|---|---|
| R-L-5 | PGlite ≠ Postgres | **закрыто** |
| R-L-10 | Dockerfile только api/dist | **закрыто** |
| R-L-18 | compose YAML ≠ `compose up`; dist-only image; PG 18 vs 16 | принято |
| R-L-8 | миссии stub | принято |

## 5. Незакрытое

PENDING 6 (T2/T3/owner). L6 ждёт датированный снимок фида.

Next Step: **L6** — `owner_freeze`.

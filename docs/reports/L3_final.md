# L3 — итоговый отчёт шага

Клиент читает снимок и шлёт `POST /command/*`. Предпросмотр readonly. `R-L-3` закрыт. `R-C-12` закрыт строкой бюджета.

Пак **40**, `rules_version` **0.18.0**, хеш **`316bb22fbccadb21050838b6e788bc7bf733adca2acde3707794912440b6df90`**, 510870 байт.

## 1. Что закрыто

- Boot: `GET /pack/{hash}` immutable, затем `GET /city/{id}/state`. Нет `city_time` — код `API_PACK_STALE`, не нули.
- `Date.now` только в `clock.ts`. `expected_city_time` с конверта. `demo` с `account_kind`.
- `hire`/`build` на mock: `applySpend`, следующий снимок `tick.capital` меньше. Нет `tile` → `BUILD_TILE_ILLEGAL`.
- L275 + два construction. Бандл без chainport/pg. Потолок JS — ключ пака.
- C5 `client_preview_is_readonly`, `demo_barrier_holds`, `claim_prize` → `DEMO_NO_PRIZE` не сломаны.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0 проблем; pack 40; круг 14.47% / Trader 11.67% |
| хеш пака | `316bb22fbccadb21050838b6e788bc7bf733adca2acde3707794912440b6df90` |
| канонические байты | 510870 |
| `python content/lint.py` | **275/0**, PENDING 6 |
| `python content/vectors.py` | 21; sha256 `5a5040233c5d2f0ae6149ebdd47dc3e8774bcf11ea29335612941bd91a630c57` |
| `python content/codegen.py --check` | 16 match `316bb22fbccadb21` |
| tsc / eslint | ok |
| depcruise | **413/0** |
| vitest run | **63/0** |
| `python content/attack.py --only L275` | 2/0, construction **160/0** |
| `python content/attack.py --jobs 8` | **532/0**, construction **160/0**, 275 covered, 1015.7s |
| `python content/sim.py` | калибровка `A_t2=14011`, возвраты 2837/8213 |

Новых зависимостей нет. `pnpm` не в PATH; гейт TS — `node_modules/.bin`.

## 3. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| `Date.now` в `main.tsx` | L275 | `calls Date.now; allowlist is clock.ts` | D-L-4 |
| `Date.now` в `hud/App.tsx` | L275 | то же | HUD не часы |
| overlay `emptySnapshot()` в main | construction | `main.tsx uses emptySnapshot` | не нули |
| overlay `command.ts` без `intent_id` | construction | `does not send intent_id` | D-L-11 |
| boot без сервера | `API_PACK_STALE` | `ok:false` | критерий |
| конверт без `city_time` | `API_PACK_STALE` | сработало | не Date.now |
| build без `tile` | `BUILD_TILE_ILLEGAL` | код совпал | L273 жив |
| hire затем build | capital падает дважды | совпало | applySpend |
| `state["city_time"]=0n` в genesis | L2 `mid===anchor` | `expected 12n, received 1n` | закрыто: поле не писать |
| `fetch(body: Uint8Array)` в DOM | tsc | `not assignable to BodyInit` | закрыто: `ArrayBuffer` copy |
| `claim_prize` на demo | `DEMO_NO_PRIZE` | C3 в 63/0 | RK-L-12 |
| preview write | tsc readonly | C5 | RK-L-7 |
| бандл chainport | нет | grep dist-web | L230 |

Выжило (названо): Pixi chunk warning >500 kB при потолке пака; геометрия тайла WORLD.md не исполняется (L3); hire пишет слот, не полный агент для тика; анимация закрыта. `GET` до первого тика даёт `city_time=0` через `asBigint` (L2). Параллельный `layout.py` в attack напечатал «pack.json is missing» — диск цел, хеш не сдвинулся.

## 4. Расхождения R-L-*

| id | суть | статус |
|---|---|---|
| R-L-3 | клиент Date.now и emptySnapshot | **закрыто** |
| R-C-12 | нет клиентского бюджета | **закрыто** — GATE_PERF §7 + ключ пака |
| R-L-5 | PGlite ≠ Postgres | открыто, L4 |
| R-L-10 | Dockerfile копирует только api/dist | открыто, L4 |
| R-L-8 | миссии stub | принято |

## 5. Незакрытое

PENDING 6 (T2/T3/owner). Postgres (`R-L-5`).

Next Step: **L4** — `pg_compose`.

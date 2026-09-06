# L2 — итоговый отчёт шага

Пять сервисов слушают. Тик по `city_time`. `R-L-4` закрыт.

Пак **39**, `rules_version` **0.18.0**, хеш **`38611d150835651e40e9c204dba641b9a42f02568dd859bcbbfa0c7d4b5d5db9`**, 510473 байт.

## 1. Что закрыто

- `services/*/src/main.ts`. HTTP из `route`. WS `/city/{id}/ws` + пульс `ws_heartbeat_ms`.
- 3 × 15 с = 45 ≤ `sampler_period_s` 50. Listen-порты из пака. Dockerfile дефолт из пака.
- Планировщик: `city_time` из state, не `Date`. `main.ts` без `tick(` / `mulBps` / `Date`.
- Убитый attestor: выплата идёт, `attest_lag` растёт.
- L274 + три construction. PGlite харнесс. `art/` не читался.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0 проблем; pack 39; круг 14.47% / Trader 11.67% |
| хеш пака | `38611d150835651e40e9c204dba641b9a42f02568dd859bcbbfa0c7d4b5d5db9` |
| канонические байты | 510473 |
| `python content/lint.py` | **274/0**, PENDING 6 |
| `python content/vectors.py` | 21; sha256 `5f261a1af3c27470720d1cac773b3e4dc1b92d58e9e77e6a8513ca52e7600de5` |
| `python content/codegen.py --check` | 16 match `38611d150835651e` |
| tsc / eslint | ok |
| depcruise | **408/0** |
| vitest run | **61/0** |
| `python content/attack.py` | **528/0**, construction **158/0**, 274 covered, jobs=8, 300.9s |
| `python content/sim.py` | калибровка `A_t2=14011`, возвраты 2837/8213 |

Новых зависимостей нет. `pnpm` не в PATH; гейт TS — `node_modules/.bin`.

## 3. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| `listen(8080)` в src | L274 | `hardcodes a listen port` | D-L-3 |
| sampler port = api | L274 | `port 7460 used by api and sampler` | уникальность |
| `ws_heartbeat_s=30` | L274 | `does not fit three pulses in 50` | why heartbeat |
| Date в scheduler overlay | construction | `scheduler.ts uses Date` | tick_pure |
| нет sampler main | construction | `main.ts missing for sampler` | A-5 |
| 3×30 > 50 | construction | `fewer than three pulses` | derived |
| GET state с сокета | конверт | `city_time` + `pack_hash` | A-5 |
| три `pulse()` по WS | ≥3 сообщений | 3 | критерий |
| два `tickOnce` | city_time = anchor, затем +length, < 1e9 | совпало | не Date |
| attestor не слушает | выплата, лаг=2 | payout ≥ 0, lag 2n | fail-open |
| C3 `services_do_not_block_tick` | зелёный | в 61/0 | RK-L-11 |

Выжило (названо): `CORPORATOR_LISTEN_PORT` перекрывает дефолт пака (D-L-3); `GET` до первого тика даёт `city_time=0`; `attestLag` не сбрасывается корнем (L8); образ копирует только `api/dist` (`R-L-10`).

## 4. Расхождения R-L-*

| id | суть | статус |
|---|---|---|
| R-L-4 | нет процесса HTTP | **закрыто** |
| R-L-10 | Dockerfile копирует только api/dist | открыто, L4 |
| R-L-3 | клиент Date.now | L3 |
| R-L-8 | миссии stub | принято |

## 5. Незакрытое

PENDING 6 (T2/T3/owner). Клиент на хосте (`R-L-3`). Postgres (`R-L-5`).

Next Step: **L3** — `client_on_host`.

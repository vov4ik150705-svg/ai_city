# L6 — итоговый отчёт шага

Freeze шести `S_min` из датированного снимка Chainlink. Точку LLM не выдумывали: `R-L-19`. `R-L-12` закрыт (снимок — объект `snapshot.at`, не поле `snapshot_at`).

Пак **42**, `rules_version` **0.18.0**, хеш **`c4d69e0eacdd2f66a8e97b0410598ba38b705d44c618002ee45921c0e261d16f`**, 514673 байт.

## 1. Что закрыто

- Снимок 2026-08-29T23:19:30Z, RPC chain 4663, шесть `latestRoundData` (`0xfeaf968c`). `S_min = 10000000000 × 10^18 // answer` в атомах, `u: "tokens"`. Floor ≤ 100 $.
- `district_stake_reference` derived `equals_s_min`. Pending без `district_stake_*`.
- L39: доллар, нет снимка, нет `at`, дрейф формулы, дыра в тикерах. Construction `smin_frozen_in_tokens`. Vitest + C2 bigint 63.
- Критерий PLAN_LIVE «без `companion_llm_price_snapshot`» не выполнен: счёта нет. `L141` держит строку. Это `R-L-19`.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0; pack 42; круг **14.47%** / Trader **11.67%** |
| хеш пака | `c4d69e0eacdd2f66a8e97b0410598ba38b705d44c618002ee45921c0e261d16f` |
| канонические байты | 514673 |
| `python content/lint.py` | **276/0**, PENDING **3** |
| `python content/vectors.py` | 21; sha256 `853ac99d42cb1e0e04f3ee50b279fc5e582ae4be0ae6e8ccd316283afb76294f` |
| `python content/codegen.py --check` | 17 match `c4d69e0eacdd2f66` |
| tsc -b / eslint | ok |
| depcruise | **429/0** |
| vitest run | **66/0** (полный прогон 65 + EBUSY на l4; isolated `l4.test.ts` **2/0**) |
| `python content/attack.py --only L39` | **5/0**, construction **163/0**, 276 covered, 260.4s |
| `python content/attack.py --jobs 8` | **541/0**, construction **163/0**, 276 covered, 1564.2s |
| `python content/sim.py` | калибровка `A_t2=14011`, возвраты 2837/8213 |

Касса: минт Capital только через депозит $CORP; круг и sim не сдвинулись. Новых runtime-зависимостей нет.

## 3. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| `s_min.u = usd_8dec` | L39 | `live dollar gate` | критерий, OK |
| `snapshot: null` при `s_min` | L39 | `without a dated feed snapshot` | критерий, OK |
| снимок без `at` | L39 | `has no date at` | критерий, OK |
| NVDA `v+1` | L39 | `458…754, formula 458…753` | OK |
| нет COIN | L39 | `missing tickers ['COIN']` | OK |
| NVDA `v=1` без формулы | L39 | `is 1, formula gives 458…` | OK |
| лишний `GOOGL` | L39 | `unknown tickers ['GOOGL']` | OK |
| `feeds={}` | L39 | нет answer на всех шести | OK |
| `u: "wei"` при верных атомах | проходит | [] | канон допускает wei |
| `v=1` + answer подобран под формулу | L39 молчит | [] | новый freeze, хеш пака едет; не живой RPC |
| подмена `proxy`, answer тот же | L39 молчит | не ловит | ложь источника, не принтер; адреса не runtime |
| вторая копия атомов в `S_ref` | C2 63 | стало 69 | закрыто: `equals_s_min` |
| селектор `0xfeaf827c` | фид 0 | revert | закрыто до записи |
| RPC без `Origin` | 403/1010 | Cloudflare | lint RPC не зовёт |
| сток-фиды пятницы в воскресенье | freeze с `updated_at` | записано | heartbeat 86400 |
| снять `companion_llm_price_snapshot` | L141 | не снимали | `R-L-19` |
| vitest ∥ lint на Windows | l4 EBUSY | rmdir temp | isolated 2/0 |

## 4. Расхождения R-L-*

| id | суть | статус |
|---|---|---|
| R-L-12 | поле `snapshot_at` vs объект `snapshot.at` | **закрыто** |
| R-L-19 | критерий L6 требовал снять LLM-точку; счёта нет | принято; pending + L141 |
| R-L-18 | compose YAML ≠ `compose up` | принято (L4) |

## 5. Незакрытое

PENDING 3: `companion_llm_price_snapshot` (owner, R-L-19), `exit_uncovered_at_band_floor` (owner), `bank_withdraw_rate_ceiling_only` (T3).

Next Step: **L7** — Solidity четырёх групп.

# C8 — итоговый отчёт шага

Дерево, корни и CID суток города локально. Fail-open: IPFS/RPC не останавливают выплату. Живой корень — C10/C11.

Пак **33**, `rules_version` **0.17.0**, хеш **`781a85b4f7b1f1206faf52dde1fd322ae9a0bf4ea7cd52ae5edd3ad11cc2fe87`**, 488352 байт.

---

## 1. Что закрыто

- TS `merkleRoot` байт-равен вектору Python (`cid_city_day` / `merkle_shapes`). Один лист = корень. Нечётный уровень не дублируется. Домен листа ≠ домен узла.
- CID суток = оракул `content/cid.py` и вектор `cid_city_day`. Коды `attest.params.cid_*`. `cid_mh_length` = `hashlib.sha256().digest_size`.
- IPFS/RPC down: выплата через `tick` идёт, outbox не пуст, `attest_lag_ticks` растёт, при пороге пака `SERVICE_DEGRADED`. `blocks_tick=0`, `fail_mode=open`.
- Период = `attest.params.attest_root_period_s`. Ключ агрегата `(city_id, city_day)`, не wall hour.
- L203 ловит второй `merkleRoot` в attestor. L268: два `it()` = два `construction_tests`. **R-C-6 закрыто.** **R-C-20:** имя `pack_hash_mismatch_halts` остаётся на C2.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | pack 33; круг 14.47% / Trader 11.67% |
| хеш | `781a85b4f7b1f1206faf52dde1fd322ae9a0bf4ea7cd52ae5edd3ad11cc2fe87` |
| байты | 488352 |
| `python content/lint.py` | **272/0**, PENDING 26 |
| `python content/vectors.py` | 21; sha256 `68db6ad87cf2bbad6d115c103e840cceb1ece1ffb1d99b4a317346ff0e3bbd09` |
| `python content/codegen.py --check` | 12 match `781a85b4f7b1f120` |
| `python content/attack.py --only L246,L207` | 2/2 пойманы |
| `python content/attack.py --only L203,L246,L207` | 4/4 пойманы |
| `python content/attack.py --jobs 8` | **503/0**, construction **145/0**, 536.3s |
| `pnpm --filter @corporator/attestor run gate` | tsc; vitest **2/0** |
| `pnpm -w run gate` | tsc-b + eslint + depcruise **326/0**; vitest **48/0** |

## 3. Конструкционные пробы C8

`attestor_down_pay_continues`, `cid_matches_oracle`. Красный прогон каждого — `C8_rules.md`.

## 4. Расхождения R-C-*

| id | суть | статус |
|---|---|---|
| R-C-6 | CID | **закрыто** |
| R-C-11 | engine magic-numbers off | C1 |
| R-C-13 | canonical копия в contentpack | C2 |
| R-C-14 | C2-имена не дублировать | C3 |
| R-C-15 | PGlite не Neon | C3 |
| R-C-16 | список RPC-модулей | принято |
| R-C-17 | `demo_barrier_holds` на C5 | принято |
| R-C-18 | `services_do_not_block_tick` имя на C3 | принято |
| R-C-19 | workspace vitest timeout | принято |
| R-C-20 | `pack_hash_mismatch_halts` имя на C2; C8 держит L207 и вызов tick в `attestor_down_pay_continues` | принято |

## 5. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| свой `merkleRoot` в attestor | L203 | tree.ts | одна реализация |
| дубль нечётного в record.py | L203 | duplicated | позиционное дерево |
| CID ≠ вектор | cid_matches_oracle | байты равны | RK-2 |
| leaf ≠ vector при expect false | красный | got true | проба живая |
| halted false при deadbeef | красный | got true | PACK_HASH жив |
| IPFS/RPC false | outbox+lag | lag 1→2, degraded | RK-11 |
| tick после down | не throw | ok | выплата не ждёт |
| пустые листья + down | lag растёт | **не растёт** | нет flush; принято |
| wall_hour в ключе | L205 | wall_hour | L205 |
| Date в src | eslint | banned | край |
| `tick` import в src | eslint | banned | тик снаружи |

Выжившее: пустая минута не растит lag (нечего публиковать). Живой RPC — C10. Спрайты — T10.

## 6. Незакрытое

C9: observability / CI / LLM host. C10: rpc parity. Спрайты T10. `build_tile_refusal` — T10.

Next: C9 — метрики, readiness, `services/llm`.

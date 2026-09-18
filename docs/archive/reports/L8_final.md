# L8 — итоговый отчёт шага

`RpcTransport` шлёт `eth_chainId` / `eth_call` / `eth_sendTransaction`. Молчание = `SERVICE_DEGRADED`. Тик не ждёт. `R-L-6` закрыт на инъецированном HTTP. `R-L-21`: viem не встал (TLS registry).

Пак **44**, `rules_version` **0.18.0**, хеш **`fb79ffed32cbbeba359d5a46650a4b499a34b384ac3a45f4fb8396c45e69f7e7`**, 517129 байт.

## 1. Что закрыто

- `createLiveTransport` в `rpc/`. JSON-число в JSON-RPC — молчание. URL и chain id со снимка фида. Таймаут — `wsHeartbeatMs`.
- Attestor: `rootJobs` + `drainRootOutbox`. Тихий `putRoot` не бросает в `tick()`.
- Клиент: нет chainport, viem, 32-байтного hex-ключа. `arch.keys.*.client = 0`.
- L278 + `rpc_http_eth_methods` + `attestor_putroot_retries` + `client_bundle_has_no_keys`.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0; pack 44; круг **14.47%** / Trader **11.67%** |
| хеш пака | `fb79ffed32cbbeba359d5a46650a4b499a34b384ac3a45f4fb8396c45e69f7e7` |
| канонические байты | 517129 |
| `python content/lint.py` | **278/0**, PENDING **3** |
| `python content/vectors.py` | 21; sha256 `a0a9727753b6df6a9b8e460703ea8aa88ea3ffbbf9a897fda7fb1cb480b53e87` |
| `python content/codegen.py --check` | 19 match `fb79ffed32cbbeba` |
| tsc / eslint | ok |
| depcruise | **444/0** |
| vitest run | **71/0** |
| `python content/attack.py --only L246,L257,L278` | **278 covered**, construction **168**, L278 **4/0** |
| `python content/attack.py --jobs 8` | **557/0**, construction **168/0**, 278 covered, 611.0s |
| `python content/sim.py` | калибровка `A_t2=14011`, возвраты 2837/8213 |

Касса и круг не сдвинулись. Новых npm-зависимостей нет.

## 3. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| live.ts без `eth_chainId` | L278 | does not post | OK |
| нет `rpc/live.ts` | L278 | missing live.ts | OK |
| `0x`+64 hex в client | L278 | 32-byte hex key | OK |
| `eth_call` в mock.ts | L278 | outside rpc/ | OK |
| JSON-число в result | SERVICE_DEGRADED | vitest PASS | OK |
| silent drain | rest=jobs, tick идёт | vitest PASS | OK |
| mock drain | rest empty | vitest PASS | OK |
| viem npm install | pin в toolchain | TLS leaf | **R-L-21** |
| `eth_sendRawTransaction` подписанный | L9 | unsigned `eth_sendTransaction` | L9 |
| живой Robinhood в CI | не обязателен | инъецированный HTTP | R-L-6 закрыт так |

## 4. Расхождения R-L-*

| id | суть | статус |
|---|---|---|
| R-L-6 | `eth_*` на инъецированном HTTP; CI не ходит на Robinhood | закрыто L8 |
| R-L-20 | TTL `block.timestamp`; лимит пула на сервере | принято (L7) |
| R-L-21 | viem не установлен: registry TLS; ABI локальный, селекторы keccak сигнатур | принято; eslint по-прежнему банит viem вне `rpc/` |
| R-L-19 | LLM точка без счёта | принято (L6) |

## 5. Незакрытое


Next Step: **L9** — запуск на pons.

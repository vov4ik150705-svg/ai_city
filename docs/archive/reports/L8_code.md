# L8 — журнал кода

Живой `RpcTransport` шлёт `eth_*`. Молчание открыто. Банк на сервере. Строка ROADMAP `rpc_live`.

Пак: **517129** байт, хеш **`fb79ffed32cbbeba359d5a46650a4b499a34b384ac3a45f4fb8396c45e69f7e7`**, `pack_version` **44**, `rules_version` **0.18.0**. Круг 14.47% / Trader 11.67%.

## 1. Создано

| путь | роль |
|---|---|
| `packages/chainport/src/rpc/jsonrpc.ts` | POST JSON-RPC; JSON-число → silence |
| `packages/chainport/src/rpc/abi.ts` | селекторы keccak сигнатур контрактов; encode/decode без npm-RPC |
| `packages/chainport/src/rpc/live.ts` | `createLiveTransport`: `eth_chainId` / `eth_call` / `eth_sendTransaction` |
| `services/attestor/src/drain.ts` | `drainRootOutbox`: ретрай `putRoot`, не throw |
| `packages/chainport/test/l8.test.ts` | `rpc_http_eth_methods`, `client_bundle_has_no_keys` |
| `services/attestor/test/l8.test.ts` | `attestor_putroot_retries` |
| `docs/reports/L8_*.md` | отчёты |

## 2. Изменено

`meta.json` 43→44; `rpc_live.construction_tests` три имени; `gate_cmd` + L278; `lint.py` L278; `attack.py` четыре атаки + три construction; `stepAttestor.rootJobs`; DESIGN.md §6.4; ARCHITECTURE.md §6; CONTENT.md L278.

## 3. Решения

- viem в npm не встал: registry `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. ABI локальный, селекторы из `content/keccak.py`. eslint по-прежнему держит viem внутри `rpc/`. **R-L-21.**
- Адреса контрактов — аргумент транспорта, не `launch.deployed` (L9).
- URL и chain id — снимок фида. Таймаут — `wsHeartbeatMs`.
- `stepAttestor` чистый; drain на краю. Тик не ждёт RPC.

## 4. Инертность

Круг 14.47% / 11.67%. Engine без chainport. Касса не тронута. Layout 1.
